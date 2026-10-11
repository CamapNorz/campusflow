# CampusFlow｜畢業專題工作室

學生小組與指導老師的繁體中文專題管理網站。接手開發先讀 [交接紀錄](../HANDOFF.md)。

快速啟動：`npm ci` → `npm run dev`。開啟本機網址後可使用登入頁的「先看看示範工作室」，或直接開啟 `/?demo=1`。

## 開發指令

在此目錄（Git 根目錄下的 `campusflow/`）執行：

```sh
npm run dev -- --host 127.0.0.1
npm run lint
npm test
npm run build
npm run preview
```

`preview` 用於檢查已建置的 `dist`，不代表正式部署。React 19、Vite 8、Tailwind 3、Firebase Auth／Firestore；確切版本以 `package-lock.json` 為準。

## 文件

- [使用與開發指南](WORKSPACE_GUIDE.md)：示範角色、功能操作、甘特圖提報／匯出與驗證邊界。
- [產品規格](PRODUCT.md)：必須保留的功能及限制。
- [設計規格](DESIGN.md)：色彩、排版及響應式互動。
- [Discord 設定](BOT_SETUP.md)：機器人設定參考。

請勿將 token、私鑰或本機環境檔提交到 Git。正式帳號與外部整合尚需實際驗收，詳見交接紀錄。
