# CampusFlow Discord Bot：Cloudflare Workers 免費部署

這版不使用 Render worker，改用 Cloudflare Workers：

- Discord slash commands 由 Worker 的 `/interactions` 接收。
- 到期提醒、新增任務提醒、問題回報轉發由 Cloudflare Cron 每 15 分鐘檢查一次。
- 不需要常駐 Node process，比 Render background worker 更適合免費部署。

## 1. 需要準備的資料

Discord Developer Portal：

```text
DISCORD_TOKEN=Bot Token
DISCORD_CLIENT_ID=1510658803002249296
DISCORD_PUBLIC_KEY=General Information 頁面的 Public Key
```

Firebase Console > 專案設定 > 服務帳戶 > 產生新的私密金鑰：

```text
FIREBASE_SERVICE_ACCOUNT_JSON=整份 service account JSON
FIREBASE_PROJECT_ID=campusflow-3edb8
```

## 2. 登入 Cloudflare

```bash
npx wrangler login
```

## 3. 設定 Cloudflare Worker secrets

```bash
npx wrangler secret put DISCORD_TOKEN
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON
```

`DISCORD_CLIENT_ID` 和 `FIREBASE_PROJECT_ID` 已寫在 `wrangler.toml`。

## 4. 部署 Worker

```bash
npm run worker:deploy
```

部署後會得到類似：

```text
https://campusflow-discord-bot.<你的帳號>.workers.dev
```

## 5. 設定 Discord Interactions Endpoint URL

到 Discord Developer Portal > 你的 Application > General Information：

```text
https://campusflow-discord-bot.<你的帳號>.workers.dev/interactions
```

按 Save。

## 6. 註冊 Slash Commands

```bash
npm run bot:commands
```

## 7. 邀請 Bot 到伺服器

```text
https://discord.com/oauth2/authorize?client_id=1510658803002249296&permissions=2147485696&integration_type=0&scope=bot+applications.commands
```

## 8. Discord 指令

```text
/bind group_code
/unbind
/tasks
/due
/leaderboard
/unfinished name
/task keyword
/set-report-channel
/campusflow-help
```

`/set-report-channel` 會把網站「問題回報」轉發到目前頻道。

## 提醒規則

- 新增任務：提醒一次。
- 截止前三天：提醒一次。
- 截止前 24 小時：提醒一次。
- 已超期：每天提醒一次。
