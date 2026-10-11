# CampusFlow｜畢業專題工作室

學生小組與指導老師的繁體中文專題管理網站。新版操作方式、啟動指令與驗證範圍請見 [使用與開發指南](WORKSPACE_GUIDE.md)，設計紀錄請見 [DESIGN.md](DESIGN.md)。

快速啟動：`npm ci` → `npm run dev`。開啟本機網址後可使用登入頁的「先看看示範工作室」，或直接開啟 `/?demo=1`。

以下保留原始 Vite 開發參考。

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
