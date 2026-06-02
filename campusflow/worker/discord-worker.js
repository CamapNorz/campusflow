const CLIENT_ID = "1510658803002249296"
const DAY_MS = 24 * 60 * 60 * 1000
const FIRESTORE_BASE = (projectId) =>
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`

let cachedToken = null

const commands = [
    {
        name: "bind",
        description: "綁定這個 Discord 頻道到 CampusFlow 組別",
        options: [
            {
                type: 3,
                name: "group_code",
                description: "CampusFlow 組別代碼",
                required: true,
            },
        ],
    },
    { name: "unbind", description: "解除這個頻道的 CampusFlow 綁定" },
    {
        name: "tasks",
        description: "列出這個組別的任務",
        options: [
            {
                type: 3,
                name: "assignee",
                description: "依指派對象篩選",
                required: false,
            },
            {
                type: 3,
                name: "status",
                description: "依狀態篩選",
                required: false,
                choices: [
                    { name: "未執行", value: "todo" },
                    { name: "執行中", value: "doing" },
                    { name: "已完成", value: "done" },
                ],
            },
        ],
    },
    { name: "due", description: "查看三天內到期與已超期任務" },
    {
        name: "task",
        description: "用關鍵字搜尋任務內容",
        options: [
            {
                type: 3,
                name: "keyword",
                description: "任務標題或詳細內容關鍵字",
                required: true,
            },
        ],
    },
    {
        name: "set-report-channel",
        description: "把這個頻道設為網站問題回報接收處",
        default_member_permissions: "32",
    },
    { name: "campusflow-help", description: "顯示 CampusFlow bot 指令" },
]

export default {
    async fetch(request, env) {
        const url = new URL(request.url)

        if (request.method === "GET" && url.pathname === "/commands") {
            return json(commands)
        }

        if (request.method === "POST" && url.pathname === "/interactions") {
            const body = await request.text()
            const verified = await verifyDiscordRequest(request, body, env.DISCORD_PUBLIC_KEY)
            if (!verified) return new Response("Bad request signature.", { status: 401 })

            const interaction = JSON.parse(body)
            if (interaction.type === 1) return json({ type: 1 })
            if (interaction.type !== 2) return json(commandResponse("不支援的互動類型。", true))

            try {
                return json(await handleCommand(interaction, env))
            } catch (error) {
                console.error(error)
                return json(commandResponse(`指令執行失敗：${error.message ?? String(error)}`, true))
            }
        }

        return new Response("CampusFlow Discord Worker is running.")
    },

    async scheduled(_event, env, ctx) {
        ctx.waitUntil(runScheduledJobs(env))
    },
}

async function handleCommand(interaction, env) {
    const name = interaction.data.name
    const guildId = interaction.guild_id
    const channelId = interaction.channel_id
    const options = Object.fromEntries(
        (interaction.data.options ?? []).map((option) => [option.name, option.value])
    )

    if (name === "bind") return bindGroup(env, guildId, channelId, interaction.member?.user?.id, options.group_code)
    if (name === "unbind") return unbindGroup(env, guildId, channelId)
    if (name === "tasks") return listTasks(env, guildId, channelId, options)
    if (name === "due") return listDueTasks(env, guildId, channelId)
    if (name === "task") return searchTask(env, guildId, channelId, options.keyword)
    if (name === "set-report-channel") return setReportChannel(env, guildId, channelId, interaction.member?.user?.id)
    if (name === "campusflow-help") return help()

    return commandResponse("未知指令。", true)
}

async function bindGroup(env, guildId, channelId, discordUserId, groupId) {
    const group = await getDoc(env, `groups/${groupId}`)
    if (!group) return commandResponse("找不到這個組別代碼，請確認是否完整複製。", true)

    await setDoc(env, `discordBindings/${bindingId(guildId, channelId)}`, {
        groupId,
        groupName: group.name ?? "",
        guildId,
        channelId,
        createdByDiscordUserId: discordUserId ?? "",
        createdAt: new Date(),
        lastSeenTaskCreatedAt: new Date(),
    })

    return commandResponse(`已將本頻道綁定到「${group.name ?? groupId}」。`)
}

async function unbindGroup(env, guildId, channelId) {
    await deleteDoc(env, `discordBindings/${bindingId(guildId, channelId)}`)
    return commandResponse("已解除這個頻道的 CampusFlow 綁定。")
}

async function listTasks(env, guildId, channelId, options) {
    const binding = await requireBinding(env, guildId, channelId)
    if (!binding) return missingBinding()

    const tasks = (await getTasks(env, binding.groupId))
        .filter((task) => !options.assignee || task.assignee === options.assignee)
        .filter((task) => !options.status || task.status === options.status)
        .slice(0, 12)

    if (!tasks.length) return commandResponse("目前沒有符合條件的任務。")
    return commandResponse(`**${binding.groupName || "CampusFlow"} 任務**\n${tasks.map(formatTask).join("\n")}`)
}

async function listDueTasks(env, guildId, channelId) {
    const binding = await requireBinding(env, guildId, channelId)
    if (!binding) return missingBinding()

    const now = Date.now()
    const tasks = (await getTasks(env, binding.groupId))
        .filter((task) => task.status !== "done")
        .filter((task) => {
            const deadline = task.deadlineAt?.getTime()
            return deadline && deadline <= now + 3 * DAY_MS
        })
        .slice(0, 12)

    if (!tasks.length) return commandResponse("目前沒有三天內到期或已超期的任務。")
    return commandResponse(`**即將到期 / 已超期**\n${tasks.map(formatTask).join("\n")}`)
}

async function searchTask(env, guildId, channelId, keyword) {
    const binding = await requireBinding(env, guildId, channelId)
    if (!binding) return missingBinding()

    const query = String(keyword ?? "").toLowerCase()
    const task = (await getTasks(env, binding.groupId)).find((item) =>
        `${item.text ?? ""}\n${item.details ?? ""}`.toLowerCase().includes(query)
    )

    if (!task) return commandResponse("找不到符合關鍵字的任務。")
    return commandResponse(`${formatTask(task)}${task.details ? `\n詳細內容：${task.details}` : ""}`)
}

async function setReportChannel(env, guildId, channelId, discordUserId) {
    await setDoc(env, "botSettings/reportChannel", {
        guildId,
        channelId,
        updatedByDiscordUserId: discordUserId ?? "",
        updatedAt: new Date(),
    })
    return commandResponse("已將這個頻道設定為 CampusFlow 問題回報接收處。")
}

function help() {
    return commandResponse([
        "**CampusFlow Bot 指令**",
        "`/bind group_code` 綁定這個頻道到組別",
        "`/tasks` 列出任務，可加 assignee/status 篩選",
        "`/due` 查看三天內到期與已超期任務",
        "`/task keyword` 搜尋單一任務詳細內容",
        "`/set-report-channel` 設定網站問題回報送達頻道",
        "`/unbind` 解除綁定",
    ].join("\n"))
}

async function runScheduledJobs(env) {
    const bindings = await listCollection(env, "discordBindings")
    for (const binding of bindings) {
        const tasks = await getTasks(env, binding.groupId)
        await notifyNewTasks(env, binding, tasks)
        await notifyDueTasks(env, binding, tasks)
    }
    await forwardIssueReports(env)
}

async function notifyNewTasks(env, binding, tasks) {
    const lastSeen = binding.lastSeenTaskCreatedAt?.getTime?.() ?? 0
    const newTasks = tasks.filter((task) => task.createdAt?.getTime?.() > lastSeen)
    if (!newTasks.length) return

    for (const task of newTasks.slice(0, 5)) {
        await sendDiscordMessage(env, binding.channelId, `**新增任務**\n${formatTask(task)}`)
    }

    const maxCreatedAt = Math.max(...newTasks.map((task) => task.createdAt?.getTime?.() ?? 0))
    await patchDoc(env, `discordBindings/${binding.id}`, {
        lastSeenTaskCreatedAt: new Date(maxCreatedAt),
    })
}

async function notifyDueTasks(env, binding, tasks) {
    const now = Date.now()
    const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })

    for (const task of tasks) {
        if (task.status === "done" || !task.deadlineAt) continue

        const statePath = `discordBindings/${binding.id}/taskNotifications/${task.id}`
        const state = (await getDoc(env, statePath)) ?? {}
        const remainingMs = task.deadlineAt.getTime() - now

        if (remainingMs > DAY_MS && remainingMs <= 3 * DAY_MS && !state.threeDaySent) {
            await sendDiscordMessage(env, binding.channelId, `**截止前三天提醒**\n${formatTask(task)}`)
            await patchDoc(env, statePath, { threeDaySent: true })
        }

        if (remainingMs >= 0 && remainingMs <= DAY_MS && !state.oneDaySent) {
            await sendDiscordMessage(env, binding.channelId, `**截止前 24 小時提醒**\n${formatTask(task)}`)
            await patchDoc(env, statePath, { oneDaySent: true })
        }

        if (remainingMs < 0 && state.overdueDateSent !== todayKey) {
            await sendDiscordMessage(env, binding.channelId, `**任務已超期**\n${formatTask(task)}`)
            await patchDoc(env, statePath, { overdueDateSent: todayKey })
        }
    }
}

async function forwardIssueReports(env) {
    const setting = await getDoc(env, "botSettings/reportChannel")
    if (!setting?.channelId) return

    const reports = await runQuery(env, {
        structuredQuery: {
            from: [{ collectionId: "issueReports" }],
            where: {
                fieldFilter: {
                    field: { fieldPath: "discordForwarded" },
                    op: "EQUAL",
                    value: { booleanValue: false },
                },
            },
            limit: 10,
        },
    })

    for (const report of reports) {
        await sendDiscordMessage(env, setting.channelId, [
            "**CampusFlow 問題回報**",
            `組別：${report.groupName || report.groupId || "未知"}`,
            `回報者：${report.reporterName || "未知"}`,
            `頁面：${report.page || "未知"}`,
            `內容：${report.message}`,
        ].join("\n"))
        await patchDoc(env, `issueReports/${report.id}`, {
            discordForwarded: true,
            forwardedAt: new Date(),
        })
    }
}

async function requireBinding(env, guildId, channelId) {
    return getDoc(env, `discordBindings/${bindingId(guildId, channelId)}`)
}

function missingBinding() {
    return commandResponse("這個頻道還沒有綁定 CampusFlow 組別，請先使用 `/bind group_code:你的組別代碼`。", true)
}

async function getTasks(env, groupId) {
    const tasks = await listCollection(env, `groups/${groupId}/tasks`)
    return tasks
        .map((task) => ({
            ...task,
            status: task.status ?? (task.done ? "done" : "todo"),
        }))
        .sort((a, b) => {
            const ad = a.deadlineAt?.getTime?.() ?? Number.MAX_SAFE_INTEGER
            const bd = b.deadlineAt?.getTime?.() ?? Number.MAX_SAFE_INTEGER
            return ad - bd
        })
}

function formatTask(task) {
    const labels = { todo: "未執行", doing: "執行中", done: "已完成" }
    const deadline = task.deadlineAt
        ? task.deadlineAt.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })
        : "未設定"
    const stars = "★".repeat(Number(task.importance ?? 0))
    return `• ${task.text}｜${task.assignee ?? "未指派"}｜${labels[task.status] ?? task.status}｜截止：${deadline}${stars ? `｜${stars}` : ""}`
}

function bindingId(guildId, channelId) {
    return `${guildId}_${channelId}`
}

function commandResponse(content, ephemeral = false) {
    return {
        type: 4,
        data: {
            content: limitDiscordContent(content),
            flags: ephemeral ? 64 : undefined,
        },
    }
}

async function sendDiscordMessage(env, channelId, content) {
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
            Authorization: `Bot ${env.DISCORD_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: limitDiscordContent(content) }),
    })
}

function limitDiscordContent(content) {
    return content.length > 1900 ? `${content.slice(0, 1890)}...` : content
}

async function verifyDiscordRequest(request, body, publicKeyHex) {
    if (!publicKeyHex) return false
    const signature = request.headers.get("x-signature-ed25519")
    const timestamp = request.headers.get("x-signature-timestamp")
    if (!signature || !timestamp) return false

    const key = await crypto.subtle.importKey(
        "raw",
        hexToBytes(publicKeyHex),
        { name: "NODE-ED25519", namedCurve: "NODE-ED25519" },
        false,
        ["verify"]
    ).catch(() => null)
    if (!key) return false

    return crypto.subtle.verify(
        "NODE-ED25519",
        key,
        hexToBytes(signature),
        new TextEncoder().encode(timestamp + body)
    )
}

async function accessToken(env) {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
        return cachedToken.token
    }

    const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON)
    const now = Math.floor(Date.now() / 1000)
    const jwtHeader = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    const jwtPayload = base64Url(JSON.stringify({
        iss: account.client_email,
        scope: "https://www.googleapis.com/auth/datastore",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
    }))
    const signingInput = `${jwtHeader}.${jwtPayload}`
    const key = await crypto.subtle.importKey(
        "pkcs8",
        pemToArrayBuffer(account.private_key),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    )
    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        key,
        new TextEncoder().encode(signingInput)
    )
    const assertion = `${signingInput}.${base64UrlBytes(new Uint8Array(signature))}`
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion,
        }),
    })
    if (!response.ok) throw new Error(`Google token failed: ${await response.text()}`)
    const data = await response.json()
    cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
    }
    return cachedToken.token
}

async function firestoreFetch(env, path, init = {}) {
    const token = await accessToken(env)
    const response = await fetch(`${FIRESTORE_BASE(env.FIREBASE_PROJECT_ID)}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
        },
    })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Firestore failed: ${await response.text()}`)
    return response.json()
}

async function getDoc(env, path) {
    const doc = await firestoreFetch(env, `/${path}`)
    return doc ? decodeDocument(doc) : null
}

async function setDoc(env, path, data) {
    return firestoreFetch(env, `/${path}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: encodeFields(data) }),
    })
}

async function patchDoc(env, path, data) {
    const params = Object.keys(data)
        .map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
        .join("&")
    return firestoreFetch(env, `/${path}?${params}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: encodeFields(data) }),
    })
}

async function deleteDoc(env, path) {
    return firestoreFetch(env, `/${path}`, { method: "DELETE" })
}

async function listCollection(env, path) {
    const result = await firestoreFetch(env, `/${path}`)
    return (result?.documents ?? []).map(decodeDocument)
}

async function runQuery(env, query) {
    const result = await firestoreFetch(env, ":runQuery", {
        method: "POST",
        body: JSON.stringify(query),
    })
    return (result ?? [])
        .map((row) => row.document)
        .filter(Boolean)
        .map(decodeDocument)
}

function decodeDocument(doc) {
    const parts = doc.name.split("/")
    return {
        id: parts.at(-1),
        ...decodeFields(doc.fields ?? {}),
    }
}

function decodeFields(fields) {
    return Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, decodeValue(value)])
    )
}

function decodeValue(value) {
    if ("stringValue" in value) return value.stringValue
    if ("booleanValue" in value) return value.booleanValue
    if ("integerValue" in value) return Number(value.integerValue)
    if ("doubleValue" in value) return value.doubleValue
    if ("timestampValue" in value) return new Date(value.timestampValue)
    if ("nullValue" in value) return null
    if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decodeValue)
    if ("mapValue" in value) return decodeFields(value.mapValue.fields ?? {})
    return undefined
}

function encodeFields(data) {
    return Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, encodeValue(value)])
    )
}

function encodeValue(value) {
    if (value instanceof Date) return { timestampValue: value.toISOString() }
    if (typeof value === "string") return { stringValue: value }
    if (typeof value === "boolean") return { booleanValue: value }
    if (Number.isInteger(value)) return { integerValue: String(value) }
    if (typeof value === "number") return { doubleValue: value }
    if (value === null || value === undefined) return { nullValue: null }
    if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } }
    return { mapValue: { fields: encodeFields(value) } }
}

function json(value) {
    return new Response(JSON.stringify(value), {
        headers: { "Content-Type": "application/json" },
    })
}

function base64Url(input) {
    return base64UrlBytes(new TextEncoder().encode(input))
}

function base64UrlBytes(bytes) {
    let binary = ""
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function hexToBytes(hex) {
    return new Uint8Array(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)))
}

function pemToArrayBuffer(pem) {
    const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "")
        .replace(/-----END PRIVATE KEY-----/, "")
        .replace(/\s/g, "")
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes.buffer
}

export { commands }
