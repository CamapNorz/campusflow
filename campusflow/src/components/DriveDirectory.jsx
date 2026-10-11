import { useEffect, useRef, useState } from 'react'
import { getAuth } from 'firebase/auth'
import Icon from './Icon'
import { PROJECT_FOLDER_ID, FOLDER_MIME, readProjectDirectory, driveLink, fileKind, sameNamePreviews, filterDriveFiles, driveErrorMessage, demoDriveFolders } from '../lib/drive'
import '../drive-directory.css'

const kindNames = { folder: '資料夾', blender: 'Blender', image: '圖片', video: '影片', other: '文件／其他' }
const initialPath = [{ id: PROJECT_FOLDER_ID, name: '畢業專題' }]
function sizeLabel(value) {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || value == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}
function dateLabel(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })
}

export default function DriveDirectory({ demo = false, user }) {
  const [session, setSession] = useState(demo ? { demo: true } : null)
  const [path, setPath] = useState(initialPath)
  const [folderName, setFolderName] = useState(initialPath[0].name)
  const [files, setFiles] = useState([])
  const [nextPage, setNextPage] = useState('')
  const [request, setRequest] = useState({ pageToken: '', revision: 0 })
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [incomplete, setIncomplete] = useState(false)
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('all')
  const [order, setOrder] = useState('name')
  const [updatedAt, setUpdatedAt] = useState(null)
  const connectionEpoch = useRef(0)
  const folderId = path.at(-1).id

  useEffect(() => () => { connectionEpoch.current += 1 }, [])
  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      if (!request.pageToken) { setFiles([]); setNextPage(''); setUpdatedAt(null); setIncomplete(false) }
      try {
        const options = { signal: controller.signal }
        const authUser = demo ? null : getAuth().currentUser
        if (!demo && authUser?.uid !== user?.uid) throw Object.assign(new Error('Login required'), {status:401})
        const result = demo ? { folder: {name: folderId === PROJECT_FOLDER_ID ? '示範專題' : path.at(-1).name}, files: demoDriveFolders[folderId] || [] } : await readProjectDirectory(await authUser.getIdToken(), folderId, { ...options, pageToken: request.pageToken })
        if (!active) return
        setFolderName(result.folder.name)
        setFiles(previous => [...new Map([...(request.pageToken ? previous : []), ...(result.files || [])].map(file => [file.id, file])).values()])
        setNextPage(result.nextPageToken || '')
        setIncomplete(previous => previous || Boolean(result.incompleteSearch))
        setUpdatedAt(new Date())
      } catch (caught) {
        if (!active || caught.name === 'AbortError') return
        setError(driveErrorMessage(caught))
        if ([401, 403].includes(caught.status)) {
          setSession(null); setFiles([]); setNextPage(''); setUpdatedAt(null)
        }
      } finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false; controller.abort() }
  }, [demo, session, folderId, path, request, user?.uid])

  async function connect() {
    const authUser = getAuth().currentUser
    if (!authUser || authUser.uid !== user?.uid) { setError('請先使用你的 Google 帳號登入 CampusFlow。'); return }
    const epoch = connectionEpoch.current
    setConnecting(true); setError('')
    try {
      await authUser.getIdToken()
      if (epoch !== connectionEpoch.current) return
      setRequest({ pageToken: '', revision: 0 }); setPath(initialPath); setSession({ connected: true })
    } catch (caught) {
      if (epoch !== connectionEpoch.current) return
      setError(driveErrorMessage(caught))
    } finally { if (epoch === connectionEpoch.current) setConnecting(false) }
  }

  function navigate(nextPath) {
    setFiles([]); setNextPage(''); setSearch(''); setKind('all'); setError('')
    setFolderName(nextPath.at(-1).name); setUpdatedAt(null)
    setRequest({ pageToken: '', revision: 0 }); setPath(nextPath)
  }
  function disconnect() {
    connectionEpoch.current += 1
    setSession(null); setFiles([]); setNextPage(''); setError(''); setLoading(false); setUpdatedAt(null)
  }

  const visible = filterDriveFiles(files, search, kind, order)
  return <section className="drive-directory" aria-label="雲端檔案目錄">
    <div className="drive-connection">
      <div><h2>{demo ? '示範雲端目錄' : '專題共用資料夾'}</h2><p>{demo ? '以下是虛構示範檔案，可體驗資料夾瀏覽與篩選。' : '專題成員可查看檔名、類型與更新時間。檔案內容在 Google Drive 開啟。'}</p></div>
      <div className="drive-actions">
        {!demo && (session ? <button className="secondary-button" onClick={disconnect}>關閉目錄</button> : <button className="primary-button" disabled={connecting} onClick={connect}>{connecting ? '確認登入中…' : '讀取雲端目錄'}</button>)}
        {!demo && <a className="secondary-button" href={`https://drive.google.com/drive/folders/${folderId}`} target="_blank" rel="noopener noreferrer">在 Drive 開啟 <Icon name="arrow" size={16}/></a>}
      </div>
    </div>
    {!demo && <p className="drive-privacy">目錄僅供指定專題空間的成員查看，離頁後清空。網站只讀取此專題資料夾內的檔案資訊；開啟原檔仍需 Google Drive 共用權限。</p>}
    {error && <div className="feedback error" role="alert">{error}</div>}
    {session ? <>
      <nav className="drive-breadcrumb" aria-label="雲端資料夾路徑">{path.map((folder, index) => <span key={folder.id}>{index > 0 && <span aria-hidden="true"> / </span>}{index === path.length - 1 ? <span aria-current="location">{folderName}</span> : <button className="text-action" onClick={() => navigate(path.slice(0, index + 1))}>{demo && index === 0 ? '示範專題' : folder.name}</button>}</span>)}</nav>
      <div className="drive-toolbar">
        <label className="search-field"><Icon name="search" size={18}/><input aria-label="搜尋此資料夾" placeholder="搜尋此資料夾已載入的檔案…" value={search} onChange={event => setSearch(event.target.value)}/></label>
        <select aria-label="雲端檔案類型" value={kind} onChange={event => setKind(event.target.value)}><option value="all">所有類型</option>{Object.entries(kindNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select aria-label="雲端檔案排序" value={order} onChange={event => setOrder(event.target.value)}><option value="name">名稱排序</option><option value="updated">最近更新</option></select>
        <button className="secondary-button" disabled={loading} onClick={() => setRequest(previous => ({ pageToken: '', revision: previous.revision + 1 }))}><Icon name="refresh" size={16}/>重新整理</button>
      </div>
      <div className="drive-result-status" role="status">{loading ? '讀取中…' : `顯示 ${visible.length} 項，已載入 ${files.length} 項${nextPage ? '（尚有更多）' : ''}`}{updatedAt && <span>讀取時間：{dateLabel(updatedAt)}</span>}</div>
      {incomplete && <p className="drive-privacy">Google 回傳的目錄可能不完整，請重新整理或在 Drive 確認。</p>}
      <div className="drive-table-wrap"><table className="drive-table"><caption className="sr-only">目前資料夾的檔案；同名截圖僅比對已載入內容。</caption><thead><tr><th scope="col">名稱</th><th scope="col">類型</th><th scope="col">更新時間</th><th scope="col">大小</th><th scope="col">同名截圖</th></tr></thead><tbody>
        {visible.map(file => <tr key={file.id}>
          <td><div className="drive-file-name"><Icon name={file.mimeType === FOLDER_MIME ? 'folder' : 'files'} size={18}/>{file.mimeType === FOLDER_MIME ? <button className="text-action" onClick={() => navigate([...path, { id: file.id, name: file.name }])}>{file.name}</button> : demo ? <span>{file.name}</span> : <a href={driveLink(file)} target="_blank" rel="noopener noreferrer">{file.name}</a>}</div></td>
          <td>{kindNames[fileKind(file)]}</td><td>{dateLabel(file.modifiedTime)}</td><td>{sizeLabel(file.size)}</td>
          <td>{fileKind(file) === 'blender' ? sameNamePreviews(file, files).length ? sameNamePreviews(file, files).map(preview => demo ? <span key={preview.id}>已附 {preview.name.split('.').at(-1).toUpperCase()}</span> : <a key={preview.id} href={driveLink(preview)} target="_blank" rel="noopener noreferrer">查看 {preview.name.split('.').at(-1).toUpperCase()}</a>) : <span>{nextPage ? '已載入項目中未找到' : '未找到同名截圖'}</span> : '—'}</td>
        </tr>)}
      </tbody></table></div>
      {!loading && !error && !visible.length && <div className="empty-message"><h3>{search || kind !== 'all' ? '沒有符合條件的已載入檔案' : '目前資料夾沒有檔案'}</h3><p>{search || kind !== 'all' ? '調整搜尋或類型篩選；如果還有下一頁，可繼續載入。' : '可回到上一層，或上傳到 Drive 後重新整理。'}</p></div>}
      {nextPage && <button className="secondary-button drive-more" disabled={loading} onClick={() => setRequest(previous => ({ ...previous, pageToken: nextPage }))}>載入更多檔案</button>}
    </> : !error && <div className="empty-message"><Icon name="folder" size={28}/><h3>讀取後顯示雲端目錄</h3><p>使用 CampusFlow 登入即可讀取，無需另外授權 Google Drive。</p></div>}
  </section>
}
