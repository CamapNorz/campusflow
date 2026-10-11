import { createRemoteJWKSet, jwtVerify, importPKCS8, SignJWT } from 'jose'

const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))
const FOLDER = 'application/vnd.google-apps.folder'
const validId = value => typeof value === 'string' && /^[\w-]{10,160}$/.test(value)
function fail(status) { throw Object.assign(new Error('Directory request denied'), { status }) }

export async function verifyIdentity(token, project, keySet = keys) {
  const { payload } = await jwtVerify(token, keySet, { algorithms: ['RS256'], audience: project, issuer: `https://securetoken.google.com/${project}`, requiredClaims: ['exp', 'iat', 'auth_time', 'sub'] })
  const now = Date.now() / 1000
  if (!payload.sub || payload.sub.length > 128 || typeof payload.iat !== 'number' || payload.iat > now || typeof payload.auth_time !== 'number' || payload.auth_time > now) fail(401)
  return payload.sub
}

async function jsonRequest(url, init = {}, fetcher = fetch) {
  // Workers supports manual/follow, but rejects Node's redirect:error before I/O.
  // Manual mode plus the status check prevents forwarding bearer tokens on redirects.
  const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(12000), redirect: 'manual' })
  if (!response.ok) throw Object.assign(new Error('Upstream request failed'), {status:[401,403,404].includes(response.status) ? 403 : 503,upstreamStatus:response.status})
  const reader = response.body.getReader()
  const chunks = []; let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > 1024 * 1024) { await reader.cancel(); fail(503) }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return JSON.parse(new TextDecoder().decode(bytes))
}

export async function assertMember(uid, token, env, fetcher = fetch) {
  const base = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT}/databases/(default)/documents`
  const headers = { Authorization: `Bearer ${token}` }
  const profile = await jsonRequest(`${base}/users/${encodeURIComponent(uid)}`, {headers}, fetcher)
  if (profile.fields?.groupId?.stringValue !== env.GROUP_ID) fail(403)
  await jsonRequest(`${base}/groups/${env.GROUP_ID}/members/${encodeURIComponent(uid)}`, {headers}, fetcher)
}

export async function serviceToken(secret, fetcher = fetch) {
  const account = JSON.parse(secret)
  const key = await importPKCS8(account.private_key, 'RS256')
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/drive.metadata.readonly' }).setProtectedHeader({alg:'RS256'}).setIssuer(account.client_email).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('5m').sign(key)
  const data = await jsonRequest('https://oauth2.googleapis.com/token', {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})}, fetcher)
  if (!data.access_token) fail(503)
  return data.access_token
}

export async function readDirectory(folderId, pageToken, env, accessToken, fetcher = fetch) {
  const headers = {Authorization:`Bearer ${accessToken}`}
  const getFolder = id => jsonRequest(`https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,mimeType,parents,trashed&supportsAllDrives=true`, {headers}, fetcher)
  let current = folderId; const seen = new Set(); let folder
  for (let depth = 0; depth < 24; depth++) {
    if (!validId(current) || seen.has(current)) fail(403)
    seen.add(current)
    const item = await getFolder(current)
    if (item.trashed || item.mimeType !== FOLDER) fail(403)
    folder ||= {id:item.id,name:item.name,mimeType:item.mimeType}
    if (current === env.ROOT_FOLDER) {
      const params = new URLSearchParams({q:`'${folderId}' in parents and trashed = false`,fields:'nextPageToken,incompleteSearch,files(id,name,mimeType,modifiedTime,size,webViewLink)',pageSize:'100',orderBy:'folder,name_natural',spaces:'drive',supportsAllDrives:'true',includeItemsFromAllDrives:'true'})
      if (pageToken) params.set('pageToken', pageToken)
      const result = await jsonRequest(`https://www.googleapis.com/drive/v3/files?${params}`, {headers}, fetcher)
      return {folder,files:result.files || [],nextPageToken:result.nextPageToken || '',incompleteSearch:Boolean(result.incompleteSearch)}
    }
    if (item.parents?.length !== 1) fail(403)
    current = item.parents[0]
  }
  fail(403)
}

export function createHandler(deps = {}) {
  return async (request, env) => {
    const origin = request.headers.get('Origin')
    const headers = {'Cache-Control':'private, no-store','Content-Type':'application/json','Vary':'Origin','X-Content-Type-Options':'nosniff'}
    const allowed = env.ALLOWED_ORIGINS.split(',').includes(origin)
    if (origin && !allowed) return new Response('{"error":"access_denied"}', {status:403,headers})
    if (allowed) Object.assign(headers, {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Authorization','Access-Control-Max-Age':'600'})
    const reply = (status, body) => new Response(JSON.stringify(body), {status,headers})
    let stage = 'request'
    try {
      const url = new URL(request.url)
      if (url.pathname !== '/directory') return reply(404,{error:'not_found'})
      if (request.method === 'OPTIONS') return new Response(null,{status:204,headers})
      if (request.method !== 'GET') return reply(405,{error:'method_not_allowed'})
      if ([...url.searchParams.keys()].some(key => !['folderId','pageToken'].includes(key)) || [...url.searchParams.keys()].some(key => url.searchParams.getAll(key).length !== 1)) fail(400)
      const folderId = url.searchParams.get('folderId') || env.ROOT_FOLDER
      const pageToken = url.searchParams.get('pageToken') || ''
      if (!validId(folderId) || pageToken.length > 4096) fail(400)
      const match = /^Bearer ([^\s]{1,8192})$/.exec(request.headers.get('Authorization') || '')
      if (!match) fail(401)
      let uid
      try { uid = await (deps.verifyIdentity || verifyIdentity)(match[1],env.FIREBASE_PROJECT) } catch { fail(401) }
      if (!(await env.DIRECTORY_LIMITER.limit({key:uid})).success) fail(429)
      stage = 'membership'
      await (deps.assertMember || assertMember)(uid,match[1],env)
      stage = 'service_auth'
      const token = await (deps.serviceToken || serviceToken)(env.DRIVE_SERVICE_ACCOUNT)
      stage = 'drive_read'
      return reply(200,await (deps.readDirectory || readDirectory)(folderId,pageToken,env,token))
    } catch (error) {
      return reply(error.status || 503,{error:error.status === 401 ? 'login_required' : error.status === 403 ? 'access_denied' : error.status === 429 ? 'rate_limited' : `${stage}_unavailable`})
    }
  }
}
export default {fetch:createHandler()}
