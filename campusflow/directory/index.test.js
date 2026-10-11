import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPair, SignJWT, createLocalJWKSet, exportJWK} from 'jose'
import {verifyIdentity, assertMember, readDirectory, createHandler} from './index.js'

const env = {FIREBASE_PROJECT:'test-project',GROUP_ID:'permitted-group',ROOT_FOLDER:'root-folder-123',ALLOWED_ORIGINS:'https://allowed.example',DIRECTORY_LIMITER:{limit:async()=>({success:true})}}
const json = value => new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}})
test('Firebase identity rejects forged, expired, wrong-project and future authentication claims', async () => {
  const {privateKey,publicKey} = await generateKeyPair('RS256')
  const jwk = await exportJWK(publicKey); jwk.kid = 'test'
  const keySet = createLocalJWKSet({keys:[jwk]})
  const mint = (claims={}) => new SignJWT({auth_time:Math.floor(Date.now()/1000)-5,...claims}).setProtectedHeader({alg:'RS256',kid:'test'}).setAudience(env.FIREBASE_PROJECT).setIssuer(`https://securetoken.google.com/${env.FIREBASE_PROJECT}`).setSubject('member-uid').setIssuedAt().setExpirationTime('5m').sign(privateKey)
  assert.equal(await verifyIdentity(await mint(),env.FIREBASE_PROJECT,keySet),'member-uid')
  await assert.rejects(verifyIdentity(await mint(), 'wrong-project', keySet))
  await assert.rejects(verifyIdentity(await mint({auth_time:Date.now()/1000+100}),env.FIREBASE_PROJECT,keySet))
  const expired = await new SignJWT({auth_time:1}).setProtectedHeader({alg:'RS256',kid:'test'}).setAudience(env.FIREBASE_PROJECT).setIssuer(`https://securetoken.google.com/${env.FIREBASE_PROJECT}`).setSubject('member').setIssuedAt().setExpirationTime(1).sign(privateKey)
  await assert.rejects(verifyIdentity(expired,env.FIREBASE_PROJECT,keySet))
  const forged = (await mint()).split('.'); forged[2] = 'AAAA'
  await assert.rejects(verifyIdentity(forged.join('.'),env.FIREBASE_PROJECT,keySet))
})
test('Membership requires current profile group and readable membership under caller credentials',async()=>{
  let calls=0
  const fetcher=async(url,options)=>{calls++;assert.equal(options.redirect,'manual');assert.equal(options.headers.Authorization,'Bearer caller-token');return url.includes('/users/') ? json({fields:{groupId:{stringValue:env.GROUP_ID}}}) : json({fields:{name:{stringValue:'Member'}}})}
  await assertMember('member','caller-token',env,fetcher)
  assert.equal(calls,2)
  await assert.rejects(assertMember('member','caller-token',env,async()=>json({fields:{groupId:{stringValue:'other'}}})),{status:403})
  await assert.rejects(assertMember('member','caller-token',env,async(url)=>url.includes('/users/') ? json({fields:{groupId:{stringValue:env.GROUP_ID}}}) : new Response('',{status:404})),{status:403})
})
test('Authenticated upstream redirects fail closed without following the target or exposing response text',async()=>{
 let calls=0
 await assert.rejects(assertMember('member','caller-token',env,async(_url,options)=>{
  calls++;assert.equal(options.redirect,'manual')
  return new Response('private redirect details',{status:302,headers:{Location:'https://evil.example'}})
 }),{status:503})
 assert.equal(calls,1)
 const handler=createHandler({verifyIdentity:async()=> 'member',assertMember:async()=>{throw Object.assign(new Error('private upstream'),{status:503})}})
 const response=await handler(new Request('https://api.example/directory',{headers:{Authorization:'Bearer valid'}}),env)
 assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'membership_unavailable'})
})
test('Folder ancestry enforces root, rejects shortcuts, trash, cycles and outside folders; pagination is metadata-only',async()=>{
  const folder=(id,parents)=>({id,name:'Folder',mimeType:'application/vnd.google-apps.folder',parents})
  const fetcher=async url=>{
    const parsed=new URL(url)
    if (parsed.pathname.endsWith('/files')) {
      assert.equal(parsed.searchParams.get('q'),"'child-folder-123' in parents and trashed = false")
      assert.equal(parsed.searchParams.get('pageSize'),'100')
      assert.equal(parsed.searchParams.get('pageToken'),'opaque+/token')
      assert.equal(parsed.searchParams.get('fields').includes('owners'),false)
      return json({files:[],nextPageToken:'next'})
    }
    return json(parsed.pathname.endsWith(env.ROOT_FOLDER)?folder(env.ROOT_FOLDER):folder('child-folder-123',[env.ROOT_FOLDER]))
  }
  const result=await readDirectory('child-folder-123','opaque+/token',env,'service-token',fetcher)
  assert.equal(result.nextPageToken,'next')
  for(const metadata of [folder('outside-folder-123',[]),folder('child-folder-123',['child-folder-123']),{...folder('child-folder-123',[env.ROOT_FOLDER]),trashed:true},{id:'shortcut-file-123',mimeType:'application/vnd.google-apps.shortcut'}]) {
    await assert.rejects(readDirectory('child-folder-123','',env,'service-token',async()=>json(metadata)),{status:403})
  }
})
test('HTTP boundary prevents anonymous, forged and nonmember reads before service account use, limits methods and parameters',async()=>{
  let serviceCalls=0
  const deps={verifyIdentity:async token=>{if(token!=='valid')throw Error();return 'member'},assertMember:async()=>{},serviceToken:async()=>{serviceCalls++;return 'secret'},readDirectory:async()=>({files:[]})}
  const request=(options={},query='')=>new Request('https://api.example/directory'+query,options)
  const handler=createHandler(deps)
  assert.equal((await handler(request(),env)).status,401)
  assert.equal((await handler(request({headers:{Authorization:'Bearer forged'}}),env)).status,401)
  assert.equal((await handler(request({headers:{Origin:'https://evil.example',Authorization:'Bearer valid'}}),env)).status,403)
  assert.equal((await handler(request({method:'POST'}),env)).status,405)
  assert.equal((await handler(request({},'?q=anything'),env)).status,400)
  assert.equal((await handler(request({},'?folderId=one&folderId=two'),env)).status,400)
  assert.equal(serviceCalls,0)
  const denied=createHandler({...deps,assertMember:async()=>{throw Object.assign(new Error('private'),{status:403})}})
  const response=await denied(request({headers:{Authorization:'Bearer valid'}}),env)
  assert.equal(response.status,403);assert.equal(serviceCalls,0);assert.equal((await response.text()).includes('private'),false)
  const limited=await handler(request({headers:{Authorization:'Bearer valid'}}),{...env,DIRECTORY_LIMITER:{limit:async()=>({success:false})}})
  assert.equal(limited.status,429);assert.equal(serviceCalls,0)
  const allowed=await handler(request({headers:{Authorization:'Bearer valid',Origin:'https://allowed.example'}}),env)
  assert.equal(allowed.status,200);assert.equal(allowed.headers.get('Access-Control-Allow-Origin'),'https://allowed.example');assert.equal(allowed.headers.get('Cache-Control'),'private, no-store')
  assert.equal(serviceCalls,1)
})
