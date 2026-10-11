import { useState } from 'react'
import Icon from './Icon'
import '../file-guidelines.css'

const rules = [
  ['直接分類上傳', '放進雲端既有的對應資料夾，不另設待審區。不要自行新增最外層資料夾。'],
  ['保留版本，不覆蓋他人', '不得覆蓋別人的檔案。自己的更新也另存新版本，依序使用 v001、v002、v003，保留舊版供回復與引用。'],
  ['檔名與路徑統一', '工程、素材與子資料夾只用英文字母、數字、底線或連字號；副檔名保留。檔名不用加姓名，不用「最新版」或「最終版」。'],
  ['工程附同名預覽', 'Blender 等無法快速預覽的工程，附同檔名 PNG 或 JPG 截圖；更新工程時一起更新預覽。動畫另附 MP4 動作預覽。'],
  ['交齊依賴素材', '交可編輯原檔與所需貼圖、影片及快取。Blender 優先打包可打包的素材，其餘放同一交件資料夾並使用相對路徑；確認沒有缺檔。'],
  ['修改前先交接', '同一工程每次只由一人修改。開始前在群組說明接手的檔名與版本，交接時指定下一位要使用的版本。'],
  ['上傳完成後標記更新', '確認所有檔案上傳完成，再貼項目、版本、改動摘要、修改者與資料夾連結；標記受影響的組員。代傳時說明實際修改者。'],
  ['整理既有檔案先確認', '刪除、搬動或重新命名既有檔案前，先取得負責人同意，避免其他人的連結與素材引用失效。'],
]

const rulesText = `雲端檔案協作規範\n\n${rules.map(([title, text], index) => `${index + 1}. ${title}\n${text}`).join('\n\n')}\n\n命名範例：Office_Desk_v003.blend / Office_Desk_v003.png\n外部素材請附來源連結與使用限制；不要上傳密碼、金鑰或無關個人資料。`
const initialNotice = `項目：\n本次版本：\n接續版本：\n修改者（代傳請註明）：\n改動摘要：\n尚缺內容／注意事項：\n軟體與版本：\n資料夾連結：\n需通知的組員：`

export default function FileGuidelines() {
  const [notice, setNotice] = useState(initialNotice)
  const [copyState, setCopyState] = useState({ target: '', message: '', failed: false })
  const [copying, setCopying] = useState(false)

  async function copyText(target, value) {
    setCopying(true)
    setCopyState({ target, message: '', failed: false })
    try {
      await navigator.clipboard.writeText(value)
      setCopyState({ target, message: '已複製，可貼到群組。', failed: false })
    } catch {
      setCopyState({ target, message: '瀏覽器無法複製，請選取下方文字手動複製。', failed: true })
    } finally {
      setCopying(false)
    }
  }

  return <div className="file-guidelines">
    <section className="file-rules" aria-labelledby="file-rules-title">
      <div className="section-title">
        <h2 id="file-rules-title">雲端上傳與更新</h2>
        <button className="secondary-button" disabled={copying} onClick={() => copyText('rules', rulesText)}><Icon name="copy" size={16}/>複製完整規範</button>
      </div>
      <p className="file-intro">直接放進對應資料夾；更新用版本號辨識，完成後在群組標記。</p>
      {copyState.target === 'rules' && <p className="file-copy-status" role="status">{copyState.message}</p>}
      {copyState.target === 'rules' && copyState.failed && <div><label className="file-field" htmlFor="file-rules-text">規範文字</label><textarea id="file-rules-text" readOnly value={rulesText} rows={8} onFocus={event => event.target.select()}/></div>}
      <dl className="file-rule-list">{rules.map(([title, text]) => <div key={title}><dt>{title}</dt><dd>{text}</dd></div>)}</dl>
      <p className="file-source-note">外部素材請附來源連結與使用限制；不要上傳密碼、金鑰或無關個人資料。</p>
    </section>

    <div className="file-reference">
      <section className="file-example" aria-labelledby="file-example-title">
        <h2 id="file-example-title">檔名與預覽範例</h2>
        <p><code>項目_內容_v003.副檔名</code></p>
        <ul className="file-example-list">
          <li><code>Office_Desk_v003.blend</code><span>可編輯工程</span></li>
          <li><code>Office_Desk_v003.png</code><span>同名截圖</span></li>
          <li><code>Office_Desk_v003_side.png</code><span>補充角度（選用）</span></li>
        </ul>
        <p>截圖要看清本次交件內容。動畫例如 <code>SC03_Walk_v002.blend</code>，同時附 <code>SC03_Walk_v002.png</code> 與 <code>SC03_Walk_v002.mp4</code>。</p>
      </section>

      <section className="file-notice" aria-labelledby="file-notice-title">
        <h2 id="file-notice-title">更新通知範本</h2>
        <p id="file-notice-help">填好後複製到群組，讓組員知道接下來使用哪一版。草稿只保留在此頁，離開或重新整理後清空。</p>
        <label className="file-field" htmlFor="file-notice-text">通知內容</label>
        <textarea id="file-notice-text" aria-describedby="file-notice-help" value={notice} rows={10} maxLength={4000} spellCheck={false} onChange={event => { setNotice(event.target.value); setCopyState({ target: '', message: '', failed: false }) }}/>
        <button className="primary-button" disabled={copying || !notice.trim()} onClick={() => copyText('notice', notice)}><Icon name="copy" size={16}/>複製更新通知</button>
        {copyState.target === 'notice' && <p className="file-copy-status" role="status">{copyState.message}</p>}
      </section>
    </div>
    <p className="file-scope-note">此頁提供共同規範；雲端檔案權限與版本仍由原儲存服務管理。</p>
  </div>
}
