# CampusFlow Discord Bot

## Discord 邀請連結

把 bot 加到伺服器時可用這個連結：

```text
https://discord.com/oauth2/authorize?client_id=1510658803002249296&permissions=2147485696&integration_type=0&scope=bot+applications.commands
```

## 本機或部署環境變數

必要：

```text
DISCORD_TOKEN=你的 Discord bot token
DISCORD_CLIENT_ID=1510658803002249296
FIREBASE_PROJECT_ID=campusflow-3edb8
```

Render / Railway 上還需要 Firebase Admin 憑證，二選一：

```text
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

或：

```text
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

可選：

```text
BOT_CHECK_INTERVAL_MS=300000
```

## 啟動流程

先註冊 Discord slash commands：

```bash
npm run bot:commands
```

再啟動 bot：

```bash
npm run bot
```

## Discord 指令

```text
/bind group_code
/unbind
/tasks
/due
/task keyword
/set-report-channel
/campusflow-help
```

`/set-report-channel` 需要 Discord 的「管理伺服器」權限。網站上的「問題回報」會送到這個頻道。

## 提醒規則

- 新增任務：提醒一次。
- 截止前三天：提醒一次。
- 截止前 24 小時：提醒一次。
- 已超期：每天提醒一次。
