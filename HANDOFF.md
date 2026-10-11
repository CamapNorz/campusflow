# CampusFlow：GPT-6.1 交接

整理日期：2026-10-11。此文件是交接入口；實作以原始碼及目前 Git 狀態為準。

## 2026-10-11 修正：正式目錄連線失敗

- 使用者回報登入後讀取失敗，已在使用者現有 Chrome 登入 session 重現。根因是 jsonRequest 的 redirect:error 在 Workers/workerd 不支援，於會員查詢發送前拋 TypeError；Node 測試未反映此執行環境差異。
- 改 redirect:manual 並拒絕所有非成功 HTTP 回應，維持不跟隨轉址／不轉送 Firebase 或服務帳號憑證。成員資格、原 rules、根目錄範圍與限流沒有放寬。
- 前端區分成員查詢、服務授權、Drive 與非 JSON gateway 回應，後端只回傳固定安全錯誤碼，不回傳私人 upstream 原文或記錄憑證。
- 後端與 Hosting 已部署。使用真實既有登入帳號確認根目錄 9 項、子資料夾 6 項及麵包屑返回，這次已驗收該帳號的正式目錄流程；其他帳號仍未逐一測試。
- lint、23 項單元測試與 test:directory-runtime 通過（workerd 使用合成無效 token，確認 request 到上游驗證回應，不使用真實憑證）。正式網站資產雜湊／未登入頁與示範 QA 亦重新驗證。
- 本機證據 output/campusflow-release/production-drive-authenticated-v04.png 含使用者專題畫面，僅保留本機，不提交 Git／公開部署。


## 2026-10-11 接續：取消個人 Drive OAuth，改後端唯讀目錄

- 使用者指定空間 2LpXms9L1hDyM2AS37e6，授權专用服務帳號與 root-folder reader 共享，並明確同意將專用金鑰存 Cloudflare Worker secret。未公開資料夾，未授予專案 IAM 角色。
- 新增 directory/index.js、directory/index.test.js、directory/wrangler.jsonc，獨立 campusflow-drive-directory Worker 已部署；保留原 Discord Worker、Firebase rules 與所有功能。
- 前端改以 Firebase ID token 呼叫後端，不再使用 Google Drive 個人 restricted scope。安全細節、部署命令、原檔權限與金鑰維護在 campusflow/GOOGLE_DRIVE_SETUP.md。
- 真正服務帳號根目錄／子資料夾讀取成功；正式端點匿名／偽造 token／不允許 origin 拒絕。21 項測試、lint、build、Chrome 合成帳號與示範 desktop/mobile QA 通過。真實組員登入尚未驗收。
- 專題空間成員可查看 reader 帳號可讀到的此專題檔名；原檔開啟仍受個人 Drive 權限限制。不要將私人資料放到專題根內。
- 金鑰備份是工作區 output/campusflow-release/drive-reader-private-v01.json，ACL 限本機使用者；未進 Git，不能自行刪除。Worker secret 名 DRIVE_SERVICE_ACCOUNT。讀取 .env.example 的公開 endpoint 建置；不得將金鑰放 VITE_ 變數。
- 相容更新 Firebase 至 12.19.0、React Router 至 7.18.4，覆寫 gRPC 至相同主版的 1.14.6；npm audit --omit=dev 為 0 公告。開發工具仍有 20 項公告，未宣稱全依賴零風險。舊 OAuth 描述屬歷史紀錄，以本段與最新版 setup 文件為準。
- 前端已僅部署 Firebase Hosting，CLI release complete；獨立 reviewer 對兩項文件／錯誤文案修正均判定 resolved（ship）。最終 Chrome v03 檢查通過。正式入口維持 https://campusflow-3edb8.web.app/?view=drive。

## 2026-10-11 接續：雲端檔案目錄

- 使用者要求從既有雲端讀取檔案並顯示目錄。新增側欄「雲端檔案目錄」與 `?view=drive`，沿用先前正式站台。
- `src/components/DriveDirectory.jsx`、`src/drive-directory.css`、`src/lib/drive.js` 及 `drive.test.js`；Firebase 既有角色、資料模型、規則及 Discord 不改。
- Drive 連接器確認專題根資料夾與九個既有編號子資料夾；沒有將實際檔案清單複製到公開靜態資料。預設根 ID 在程式設定中。
- 已以既有專案管理授權啟用 Google Drive API。網頁透過目前 Firebase Google 帳號另行取得 metadata.readonly 授權；憑證與目錄只在元件記憶體，換帳號／組別、離頁或重整清空。失效授權清空資料，不改 Drive 共用權限。
- 支援逐層瀏覽、麵包屑、已載入項目的搜尋／類型／排序、分頁、重新整理、同版本 Blender PNG／JPG 截圖連結。只讀中繼資料，內容在 Drive 開啟；沒有上傳、刪除或移動操作。
- lint、17 項測試、build 及桌面／手機示範 QA 通過。另以瀏覽器模擬 Google 授權與 API 驗證分頁去重、scope、安全連結、401 清空、404 不列內容、403 限流、記憶體憑證及中斷連接。獨立介面 reviewer 判定 ship；detector 無發現。
- **真實使用者的 Google OAuth 授權仍需本人完成驗收**；Restricted scope 可能需要 Google Auth Platform 的 Data Access／測試使用者／驗證設定。完整說明在 `campusflow/GOOGLE_DRIVE_SETUP.md`，不得把模擬測試宣稱為真實 Drive 登入驗收。
- 本機 QA、截圖及結果位於工作區 `output/campusflow-release/drive-*-v01.*`，不納入 Git。Hosting 產生的 `.firebase/` 已加入忽略並保留。
- 本次目錄新版已正式部署到 Firebase Hosting（release complete）。公開 HTML／JS／CSS SHA-256 與本機建置一致；全新瀏覽器的正式登入入口、線上示範目錄及手機版通過。未授權與示範模式都沒有 Drive API 請求。公開入口為 `https://campusflow-3edb8.web.app/?view=drive`；不要把示範網址當正式資料入口。

## 2026-10-11 正式發布

- 使用者明確要求正式上線並取得可分享給組員的連結。正式入口：https://campusflow-3edb8.web.app（不加 `demo=1`）。
- 已使用既有 Firebase 專案 `campusflow-3edb8` 執行 `firebase deploy --only hosting --project campusflow-3edb8 --non-interactive`，CLI 確認 release complete。沒有部署 Firestore rules、Discord Worker 或修改正式資料。
- 發布的功能提交為 `7a48128a63a30f7e86c59a867d86bbf27419f381`。重新建置後部署，公開 HTML、JS 與 CSS 的 SHA-256 都與本機 dist 一致。
- 全新瀏覽器環境確認 HTTPS 200、正式 Google 登入按鈕可見且可操作、沒有示範標示。線上示範檔案規範頁及 390px 版面通過，沒有瀏覽器執行錯誤。
- 未代使用者登入 Google，未驗收跨帳號正式資料寫入；組員登入後使用組長提供的空間代碼加入。既有建置提示仍在。
- 本機發布驗證腳本、截圖與 JSON 保留於 `../output/campusflow-release/`（相對本 Git 根目錄），不納入 Git。以下未部署描述均為先前工作的歷史紀錄，以本段為最新發布狀態。

## 2026-10-11 接續：檔案協作規範

- 新增側欄「檔案協作規範」，支援 `?demo=1&view=files` 及既有組長／組員／老師示範角色。
- 規範採直接分類上傳，不新增待審區。包含不得覆蓋他人、版本保留、英文檔名與路徑、不加姓名、Blender 同名截圖、動畫預覽、素材依賴、交接及更新通知。
- `src/components/FileGuidelines.jsx`、`src/file-guidelines.css` 是新增介面；`Dashboard.jsx` 僅新增入口、標題與路由分支，`Icon.jsx` 補充圖示。
- 提供複製規範及可編輯更新通知；草稿只在元件記憶體，離頁／重新整理即清空。複製失敗提供手動選取文字。不存入 Firebase、不連接 Drive、不代傳群組訊息，也不宣稱實際阻擋雲端覆蓋。
- 本次 lint、12 項既有測試、build 通過；Chrome 示範 QA 驗證三種角色、既有導覽、剪貼簿成功／失敗、草稿重置、1440px／390px 無水平溢出。未觀察到正式 Firebase 請求或瀏覽器執行錯誤；這不代表正式登入／權限驗收。
- 本機 QA 腳本 `file-guidelines-qa-v01.cjs` 與 `.impeccable/review/file-guidelines-*-v01.png` 保留，不刪除。原有 bundle／Browserslist 提示仍在。
- 本段為本次工作紀錄；下方「目前狀態」的提交 SHA 屬前次基準。以 Git 最新狀態判斷是否已提交或推送；本次未執行部署。

## 目前狀態

- 使用者已確認「專題工作室」方向：深藍導覽、淺色工作區，保留原有功能並改善操作與外觀。
- 網站改版及甘特圖修正已完成，已推送 GitHub `main`。
- 功能基準提交：[`598747d4a6a465570aee4603d4f7c6a284a67568`](https://github.com/CamapNorz/campusflow/commit/598747d4a6a465570aee4603d4f7c6a284a67568)。推送後曾核對遠端 SHA 與本機一致。
- 交接文件為上述提交後的文件整理；接手時使用 `git log -3 --oneline` 和 `git status --short` 確認最新狀態。
- 沒有已知中斷中的實作工作。這次僅整理文件，不代表重新驗收產品或新增功能。
- 已完成程式碼推送，**未另外部署正式網站，也未確認線上站台是否自動更新**。

## 使用者明確要求

1. 刪除任何地方的檔案前，必須取得使用者同意；不要自行清除舊檔、QA 產物或暫存腳本。
2. 盡量節省 token：先讀此文件及必要原始碼，避免重掃整個工作區。
3. PowerShell 使用 UTF-8，命令文字使用英文；繁體中文文件可用檔案編輯工具撰寫。
4. 設計避免綠色，除非使用者主動允許。
5. 保留原有功能；文案要簡潔說明欄位用途，不要加入 slogan。
6. 已確認的設計方向直接執行，不要重新詢問相同規格。

## 路徑與啟動

- Git 根目錄：`C:/Users/User/Documents/畢業專題/campusflow`
- 應用程式目錄：`C:/Users/User/Documents/畢業專題/campusflow/campusflow`
- 遠端：`https://github.com/CamapNorz/campusflow.git`
- 分支：`main`

在應用程式目錄執行：

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

若 `node_modules` 已存在且依賴未變，可直接啟動，不必重裝。網址以 Vite 終端輸出為準；上次預覽為 `http://127.0.0.1:5173/?demo=1`，不要假設服務仍在執行。

| 示範路徑 | 用途 |
| --- | --- |
| `/?demo=1` | 組長工作室 |
| `/?demo=1&role=member` | 組員介面 |
| `/?demo=1&role=teacher` | 老師介面 |
| `/?demo=1&view=gantt` | 直接檢查甘特圖 |

示範資料只存記憶體，重新整理還原，不訂閱或寫入 Firebase。保留示範標示；示範驗證不等於正式權限驗證。

## 已完成內容與程式位置

| 範圍 | 內容／位置（相對於應用程式目錄） |
| --- | --- |
| 工作室、帳號與協作 | `src/pages/Dashboard.jsx`；保留 Google 登入、組別建立／加入、老師審核、角色權限、排行榜、改名及問題回報 |
| 總覽 | `src/components/Overview.jsx`；進度、逾期、本週完成、截止任務、成員統計及看板 |
| 任務操作 | 共用新增／編輯視窗、搜尋、篩選、排序、我的任務、CSV、日期檢查及錯誤回饋 |
| 任務工具及測試 | `src/lib/tasks.js`、`src/lib/tasks.test.js` |
| 甘特圖 | `src/components/GanttChart.jsx`、`src/lib/gantt.js`、`src/lib/gantt.test.js`、`src/gantt.css` |
| 示範資料 | `src/lib/demo.js` |
| 外觀 | `src/workspace.css`、`src/components/Icon.jsx`；桌面與手機介面、鍵盤焦點及低動態偏好 |
| Discord | `worker/`；本次僅移除未使用常數，沒有改寫整合流程 |

### 甘特圖決策與不可退化的行為

- 主要採網頁「提報模式」，另提供 PNG／SVG 插入簡報；不必二選一。
- 長條位置與長度依實際時間戳計算，標籤顯示日期及時分；切換日／週／月／配合寬度只改尺度，不得把工期取整為天。
- 可設定日期範圍，結束日包含整天；跨範圍任務裁切並標示邊界，同時起訖用菱形表示。
- 未填開始時以建立時間替代，未填截止時以完成時間替代，使用 † 註明；無效／反向日期另提示。
- 任務標題完整換行；固定欄位桌面 450px、手機可見部分 225px，時間軸保留橫向捲動。
- 匯出完整篩選結果，不只目前可見區域；包含專題、區間、時區、來源註記、更新時間及示範標示。
- PNG 最高 2 倍解析度且單邊上限 8192px；過大時使用 SVG 或縮小範圍。
- 提報使用原生 dialog；Escape／結束提報返回，保留焦點操作。
- 原「開始任務」會更新開始時間。圖表表示目前儲存的任務時程，**不是計畫基準與實際進度比較**；若要增加此功能需另定資料模型。

## 驗證紀錄與界線

功能推送前已重新執行並通過：

```sh
npm run lint
npm test
npm run build
```

- 12 項單元測試通過：搜尋／排序／日期／CSV，以及甘特圖精度、裁切、里程碑、刻度與長標題等。
- `git diff --check` 通過。
- 先前瀏覽器 QA 通過：新增／編輯、錯誤日期、任務狀態、搜尋篩選、CSV、取消刪除、五個頁面、老師示範唯讀、1440px／390px 版面。
- 先前甘特圖 QA 通過：日期範圍、尺度、調色／排序、提報與 Escape、手機捲動、PNG／SVG 下載；曾實際開啟 PNG 檢查。這是先前測試紀錄，本次文件整理未重跑瀏覽器。
- 尚未實際驗收：Google 登入、跨帳號權限、老師審核、正式 Firestore 寫入及 Discord 收訊。
- 建置仍有超過 500 kB 的 JS bundle 提示與 Browserslist 資料過舊提示；不影響當次建置成功。未進行依賴升級，先前套件 advisory 狀態需另行查核，不宣稱已修復。

## 接續工作的優先順序

目前沒有使用者指定的新功能待辦，先依下一個要求工作；若要準備正式上線：

1. 用測試帳號驗收上述正式登入、權限與整合流程，勿用示範資料污染正式資料。
2. 確認實際部署平台、設定與線上版本；GitHub push 成功不等於部署成功。
3. 處理現存綠色色票與最新偏好的差異：舊甘特圖仍可能提供 `bg-emerald-700` 或保留既有綠色資料。未在此次文件整理更動；之後 UI 調整應避免新增綠色，並保留已存資料，不可自行批次改色。
4. 若使用者要求效能／依賴維護，再評估拆分 bundle 與套件更新並回歸測試。

不要為了交接重新設計網站、重建 Firebase、改權限或執行部署。需要刪檔時遵守使用者的明確同意要求。

## 文件與本機工具

- [WORKSPACE_GUIDE.md](campusflow/WORKSPACE_GUIDE.md)：使用方式與功能細節。
- [PRODUCT.md](campusflow/PRODUCT.md)：產品限制與已確認方向。
- [DESIGN.md](campusflow/DESIGN.md)：實作設計規格；`.impeccable/design.json` 是機器可讀補充，使用者最新要求優先。
- [BOT_SETUP.md](campusflow/BOT_SETUP.md)：Discord 設定說明；部署前需依當時設定核對。
- Git 根目錄的 `gantt-qa.cjs`、`check-flows.cjs` 及其他改版腳本僅存在本機、已被忽略；新 clone 不會取得。它們不是交接必要檔案，使用前先讀內容，尤其不要重跑一次性改寫腳本。
- 過去 QA 截圖可能在 `campusflow/.impeccable/review/`，亦未納入 Git。可用示範模式重現，勿假設其他電腦已有這些產物。
- 上次提交環境沒有 Git 作者設定，使用單次 `git -c user.name=Codex -c user.email=codex@openai.local commit ...`，沿用既有作者格式，沒有改全域 Git 設定。正常推送 `git push origin main`，不要 force push。
