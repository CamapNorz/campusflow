# Google Drive 目錄

## 已完成的接線

- 使用既有 Firebase Google 登入帳號，以 `reauthenticateWithPopup` 單獨取得 Drive 授權，不更換 CampusFlow 帳號。
- CampusFlow 專案 `campusflow-3edb8` 的 Google Drive API 已啟用。
- 預設專題根目錄已經由 Drive 連接器確認；ID 在 `src/lib/drive.js` 的 `PROJECT_FOLDER_ID`。網頁只查詢此根目錄與使用者點入的子資料夾，不掃描整個 Drive，也不跟隨捷徑到其他樹。
- 組員登入後開啟「雲端檔案目錄」，按「連接 Google Drive」。Google 的授權畫面需由本人確認；同時必須有原資料夾的共用權限。
- 授權範圍為 `https://www.googleapis.com/auth/drive.metadata.readonly`。這是 Google 的檔案中繼資料唯讀範圍，涵蓋範圍比單一資料夾廣；程式將讀取限制在上述專題目錄。

## OAuth 設定與驗收界線

目前已完成程式、API 啟用、示範瀏覽器驗證及模擬授權／API 測試，**尚未完成真實使用者的 Google 授權驗收**。既有 Firebase 登入能用，不代表額外的 Drive scope 一定獲准。

如果 Google 拒絕授權，專案擁有者應在 [Google Auth Platform](https://console.cloud.google.com/auth/overview?project=campusflow-3edb8) 核對：

1. Data Access 加入上面的 `drive.metadata.readonly` scope。
2. 若 External 應用程式處於 Testing，Audience 的 Test users 包含要驗收的 Google 帳號。
3. 此 scope 屬 Restricted。對外發布時依 Google 的要求完成適用的驗證；不要把測試成功當成所有帳號都可使用。
4. 維持既有 OAuth client 與 Firebase Google provider，不要為了目錄替換登入 client、公開資料夾或改 Firestore rules。

參考：[Google OAuth consent 設定](https://developers.google.com/workspace/guides/configure-oauth-consent)、[Drive scope 分類](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)。

## 資料與權限

- 目錄讀取直接從使用者瀏覽器到 Google Drive；只取 ID、名稱、類型、更新時間、大小及開啟連結，不取內容、擁有者 email 或縮圖內容。
- Google access token 與檔案中繼資料只放元件記憶體，不存 localStorage、Firestore、公開 JSON 或 Git。離開頁面、換帳號／組別或重新整理會清空；Google 登入本身仍沿用既有 Firebase 機制。
- 「中斷連接」只清空本頁憑證，不等於撤銷 Google 帳號對應用程式的授權。
- 授權過期會清空目錄並提示重新連接；沒權限的資料夾不當成空目錄。Google 權限維持原狀。
- 沒有刪檔、上傳、搬動、重新命名或分享操作。檔案及 PNG／JPG 同名截圖在 Google Drive 開啟。
- 搜尋、篩選與截圖比對只作用於目前資料夾已載入的項目。每頁 100 筆；有下一頁時必須按「載入更多檔案」。重新整理會重新讀取目前資料夾。
- 示範模式只使用程式內虛構資料，不要求授權、不發送 Drive 請求。

## 維護與測試

- `src/lib/drive.test.js` 檢查 parent query、分頁、metadata 欄位、ID 驗證、安全連結、授權／權限錯誤、版本截圖及排序。
- 本機瀏覽器腳本在專題工作區 `output/campusflow-release/drive-qa-v01.cjs`，模擬授權與 API 回應，不含憑證。真實授權需用原有權限的測試帳號另行驗收。
- 驗收順序：登入 → 同意 Drive 唯讀授權 → 看見根目錄 → 點入子資料夾 → 開啟檔案／截圖 → 在 Drive 新增版本後重新整理 → 使用未共享帳號確認拒絕存取。
