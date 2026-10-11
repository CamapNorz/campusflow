# Google Drive 目錄（後端唯讀版）

## 組員使用

正式入口：https://campusflow-3edb8.web.app/?view=drive

登入 CampusFlow、加入指定專題空間，按「讀取雲端目錄」。不再要求個人 Google Drive OAuth 權限，所以不需略過「未驗證應用程式」警告。開啟原檔或同名 PNG／JPG 截圖仍由 Google Drive 檢查個人的共用權限。

目錄支援子資料夾、麵包屑、已載入項目的搜尋／類型／排序、分頁與重新整理。同名截圖只比對已載入內容；沒有遞迴搜尋、上傳、刪除或搬移操作。關閉目錄、離頁、換帳號／組別或重新整理會清空本頁資料。示範模式只使用虛構資料，不讀取真實目錄。

## 後端與權限

- 獨立 Worker：campusflow-drive-directory，設定 directory/wrangler.jsonc；既有 Discord Worker 不改。
- 每次請求驗證 Firebase ID token 的 RS256 簽章、專案、issuer、有效期限與登入時間。
- 以呼叫者 Firebase 憑證讀取 Firestore 的當前個人 groupId 與指定群組的 members 文件；需兩者符合。沿用原安全規則，不授予服務帳號 Firestore 管理權限。
- 固定允許空間與根資料夾設定在 Worker vars。每次讀取逐層確認是根資料夾的後代，拒絕垃圾桶、捷徑、循環與超過 24 層的路徑。
- 專用帳號 campusflow-drive-reader@campusflow-3edb8.iam.gserviceaccount.com 沒有專案 IAM 角色，只以 reader 共用此專題根資料夾。OAuth 僅用 drive.metadata.readonly，僅回傳名稱／ID／類型／時間／大小／原檔連結，不取得內容、擁有者 email 或縮圖。
- 金鑰存 Cloudflare DRIVE_SERVICE_ACCOUNT Secret，絕不放 VITE_ 變數、GitHub 或 dist。請求和目錄無應用程式日誌或持久儲存，回應 private,no-store。只允許兩個正式 Hosting origin；每位驗證使用者每個 Cloudflare 位置約 60 次／分鐘，這是濫用限制而非精確帳務上限。
- 指定空間的合格成員可以看到專題內檔名；即使個別原檔未對該成員共用，目錄也可能顯示名稱。若子資料夾含私人檔案，請放到此專題根之外，或取消對服務帳號的共用。新增其他空間前必須取得明確授權。

## 維護與部署

前端 public endpoint：.env.example 的 VITE_DIRECTORY_URL，複製至本機環境設定後建置。不要複製服務帳號金鑰到前端。

後端：npx wrangler deploy --config directory/wrangler.jsonc。秘密更新用 wrangler secret put DRIVE_SERVICE_ACCOUNT --config directory/wrangler.jsonc，直接透過安全 stdin 傳入；不要在 shell 命令或日誌印出金鑰。

前端：npm run lint、npm test、npm run build 後，firebase deploy --only hosting --project campusflow-3edb8 --non-interactive。不要部署既有 Firestore rules 或 Discord Worker。

本機備份金鑰在工作區 output/campusflow-release/drive-reader-private-v01.json，Windows ACL 已限制目前使用者。未納入 Git，使用者要求刪除任何檔案前須先取得同意。未設定自動輪替，後續需由管理者安排更新或撤銷。無需 Google end-user restricted-scope 驗證即可使用此後端流程；原 Google 登入 OAuth 設定維持不變。

## 驗證界線

2026-10-11 正式問題修正：Workers 不接受 redirect:error；後端改為 redirect:manual 並拒絕非成功狀態，避免任何憑證跟隨轉址。23 項單元測試通過，新增 npm run test:directory-runtime 使用實際 workerd 與合成無效 token 驗證上游連線。這項檢查需要 workerd 可啟動及網路，與離線單元測試分開。

已在使用者既有 Chrome 登入 session 確認正式根目錄、子資料夾及麵包屑返回成功；不代表每個組員或每種原檔共用權限都已驗收。下列「尚未真實登入」為修正前驗證界線。

21 項單元測試涵蓋 JWT 偽造／逾期／錯專案、成員與目前群組、資料夾範圍、匿名請求、CORS、限流及原功能。Chrome 的桌面／手機示範與合成已登入介面確認分頁去重、同名截圖、401／403 清空及無新增 Drive OAuth popup。

已用真正專用帳號讀取根目錄與子資料夾，正式 Worker 拒絕匿名、偽造憑證與不允許的 origin。尚未代真實組員登入驗收；不要把上述檢查宣稱為跨帳號正式驗收。QA 保留 output/campusflow-release 的 v02 產物，不提交私人檔案名稱與金鑰。

最後 v03 回歸亦通過。相容更新 Firebase／React Router，gRPC 以 overrides 鎖定已修補的相同主版；npm audit --omit=dev 為 0 公告。完整 audit 仍列開發工具 20 項公告（未打包進前端／目錄 Worker），不使用可能破壞功能的 audit fix --force。JS bundle 的大檔提示與 Browserslist 舊資料提示仍在，後續可另做效能／開發工具維護。
