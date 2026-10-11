export const PROJECT_FOLDER_ID = '1w-jkzwHLj1oOL3pplpuJIAPk-LPvYWM2'
export const FOLDER_MIME = 'application/vnd.google-apps.folder'
const validId = value => typeof value === 'string' && /^[\w-]{10,160}$/.test(value)

async function driveRequest(token, url, { signal, fetcher = fetch } = {}) {
  if (!token) throw new Error('Drive authorization required')
  const response = await fetcher(url, { headers: { Authorization: `Bearer ${token}` }, signal, cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) {
    const error = new Error('Drive request failed')
    error.status = response.status
    error.reason = data.error?.details?.find(detail => detail.reason)?.reason || data.error?.errors?.[0]?.reason || ''
    throw error
  }
  return data
}

export async function readProjectDirectory(token, folderId, { pageToken, endpoint = import.meta.env?.VITE_DIRECTORY_URL, ...options } = {}) {
  if (!validId(folderId)) throw new Error('Invalid folder ID')
  const params = new URLSearchParams({ folderId })
  if (pageToken) params.set('pageToken', pageToken)
  if (!endpoint) throw new Error('Directory endpoint unavailable')
  return driveRequest(token, `${endpoint}/directory?${params}`, options)
}

export function driveLink(file) {
  if (!validId(file.id)) return null
  try {
    const url = new URL(file.webViewLink)
    if (url.protocol === 'https:' && ['drive.google.com', 'docs.google.com'].includes(url.hostname)) return url.href
  } catch { /* Use the canonical Drive link when metadata has no safe URL. */ }
  return file.mimeType === FOLDER_MIME ? `https://drive.google.com/drive/folders/${file.id}` : `https://drive.google.com/file/d/${file.id}/view`
}

export function fileKind(file) {
  if (file.mimeType === FOLDER_MIME) return 'folder'
  if (/\.blend$/i.test(file.name)) return 'blender'
  if (file.mimeType?.startsWith('image/')) return 'image'
  if (file.mimeType?.startsWith('video/')) return 'video'
  return 'other'
}

export function sameNamePreviews(file, files) {
  if (fileKind(file) !== 'blender') return []
  const stem = file.name.replace(/\.blend$/i, '').toLowerCase()
  return files.filter(candidate => fileKind(candidate) === 'image' && candidate.name.replace(/\.(png|jpe?g)$/i, '').toLowerCase() === stem)
}

export function filterDriveFiles(files, search, kind, order) {
  const query = search.trim().toLocaleLowerCase()
  return files.filter(file => file.name.toLocaleLowerCase().includes(query) && (kind === 'all' || fileKind(file) === kind)).sort((a, b) => {
    const folderFirst = Number(b.mimeType === FOLDER_MIME) - Number(a.mimeType === FOLDER_MIME)
    if (folderFirst) return folderFirst
    if (order === 'updated') {
      const difference = (Date.parse(b.modifiedTime) || 0) - (Date.parse(a.modifiedTime) || 0)
      if (difference) return difference
    }
    return a.name.localeCompare(b.name, 'zh-Hant', { numeric: true })
  })
}

export function driveErrorMessage(error) {
  if (error.status === 401) return '登入已過期，請重新登入 CampusFlow 後讀取目錄。'
  if (error.status === 404) return '找不到此資料夾或目錄服務尚未設定。請確認專題空間，並聯絡負責人檢查目錄服務。'
  if (error.reason === 'SERVICE_DISABLED' || error.reason === 'accessNotConfigured') return 'Drive API 尚未啟用，請聯絡專題負責人。'
  if (error.status === 429 || ['rateLimitExceeded', 'userRateLimitExceeded'].includes(error.reason)) return 'Google 暫時限制讀取次數，請稍後重新整理。'
  if (error.status === 403) return '此目錄僅限指定專題空間的成員。請確認加入正確空間；若仍無法讀取，請聯絡專題負責人確認目錄服務。'
  return '無法讀取雲端目錄，請確認網路後重新整理。'
}

// Fictional metadata only. Demo mode never connects to Google Drive.
export const demoDriveFolders = {
  [PROJECT_FOLDER_ID]: [
    { id: 'demo-folder-props', name: '04_Props', mimeType: FOLDER_MIME },
    { id: 'demo-folder-animation', name: '05_Animation', mimeType: FOLDER_MIME },
    { id: 'demo-file-readme', name: 'Upload_Guide_v001.pdf', mimeType: 'application/pdf', modifiedTime: '2026-10-10T03:00:00Z', size: '120000' },
  ],
  'demo-folder-props': [
    { id: 'demo-file-model', name: 'Office_Desk_v003.blend', mimeType: 'application/octet-stream', modifiedTime: '2026-10-11T02:00:00Z', size: '8240000' },
    { id: 'demo-file-preview', name: 'Office_Desk_v003.png', mimeType: 'image/png', modifiedTime: '2026-10-11T02:00:00Z', size: '620000' },
    { id: 'demo-file-model-old', name: 'Office_Desk_v002.blend', mimeType: 'application/octet-stream', modifiedTime: '2026-10-09T02:00:00Z', size: '7120000' },
  ],
  'demo-folder-animation': [],
}
