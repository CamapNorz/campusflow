import "dotenv/config"
import {
    Client,
    GatewayIntentBits,
    PermissionFlagsBits,
} from "discord.js"
import admin from "firebase-admin"

const DISCORD_CLIENT_ID =
    process.env.DISCORD_CLIENT_ID ?? "1510658803002249296"
const DISCORD_TOKEN = process.env.DISCORD_TOKEN
const FIREBASE_PROJECT_ID =
    process.env.FIREBASE_PROJECT_ID ?? "campusflow-3edb8"
const CHECK_INTERVAL_MS = Number(process.env.BOT_CHECK_INTERVAL_MS ?? 5 * 60 * 1000)
const DAY_MS = 24 * 60 * 60 * 1000
const ALL_ASSIGNEE = "全員"

if (!DISCORD_TOKEN) {
    throw new Error("Missing DISCORD_TOKEN in environment variables.")
}

function initializeFirebaseAdmin() {
    if (admin.apps.length) return

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    if (serviceAccountJson) {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
            projectId: FIREBASE_PROJECT_ID,
        })
        return
    }

    admin.initializeApp({ projectId: FIREBASE_PROJECT_ID })
}

initializeFirebaseAdmin()

const db = admin.firestore()
const client = new Client({ intents: [GatewayIntentBits.Guilds] })

const statusLabels = {
    todo: "未執行",
    doing: "執行中",
    done: "已完成",
}

const toDate = (value) => {
    if (!value) return null
    if (value.toDate) return value.toDate()
    if (value instanceof Date) return value
    return null
}

const formatDate = (value) => {
    const date = toDate(value)
    return date ? date.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : "未設定"
}

const formatTaskLine = (task) => {
    const status = statusLabels[task.status] ?? task.status ?? "未執行"
    const assignee = task.assignee ?? "未指派"
    const deadline = formatDate(task.deadlineAt)
    const stars = "★".repeat(Number(task.importance ?? 0))
    return `• ${task.text}｜${assignee}｜${status}｜截止：${deadline}${stars ? `｜${stars}` : ""}`
}

const bindingId = (guildId, channelId) => `${guildId}_${channelId}`

async function getBinding(guildId, channelId) {
    const snapshot = await db
        .collection("discordBindings")
        .doc(bindingId(guildId, channelId))
        .get()
    return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null
}

async function getGroupTasks(groupId) {
    const snapshot = await db.collection("groups").doc(groupId).collection("tasks").get()
    return snapshot.docs
        .map((doc) => ({
            id: doc.id,
            ...doc.data(),
            status: doc.data().status ?? (doc.data().done ? "done" : "todo"),
        }))
        .sort((a, b) => {
            const ad = toDate(a.deadlineAt)?.getTime() ?? Number.MAX_SAFE_INTEGER
            const bd = toDate(b.deadlineAt)?.getTime() ?? Number.MAX_SAFE_INTEGER
            return ad - bd
        })
}

async function replyMissingBinding(interaction) {
    await interaction.reply({
        content: "這個頻道還沒有綁定 CampusFlow 組別，請先使用 `/bind group_code:你的組別代碼`。",
        ephemeral: true,
    })
}

async function handleBind(interaction) {
    const groupId = interaction.options.getString("group_code", true).trim()
    const groupSnapshot = await db.collection("groups").doc(groupId).get()

    if (!groupSnapshot.exists) {
        await interaction.reply({
            content: "找不到這個 CampusFlow 組別代碼，請確認是否複製完整。",
            ephemeral: true,
        })
        return
    }

    await db.collection("discordBindings").doc(bindingId(interaction.guildId, interaction.channelId)).set(
        {
            groupId,
            groupName: groupSnapshot.data().name ?? "",
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            createdByDiscordUserId: interaction.user.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastSeenTaskCreatedAt: admin.firestore.Timestamp.now(),
        },
        { merge: true }
    )

    await interaction.reply(`已將本頻道綁定到「${groupSnapshot.data().name ?? groupId}」。`)
}

async function handleUnbind(interaction) {
    await db
        .collection("discordBindings")
        .doc(bindingId(interaction.guildId, interaction.channelId))
        .delete()
    await interaction.reply("已解除這個頻道的 CampusFlow 綁定。")
}

async function handleTasks(interaction) {
    const binding = await getBinding(interaction.guildId, interaction.channelId)
    if (!binding) return replyMissingBinding(interaction)

    const assignee = interaction.options.getString("assignee")?.trim()
    const status = interaction.options.getString("status")
    const tasks = (await getGroupTasks(binding.groupId))
        .filter((task) => !assignee || task.assignee === assignee)
        .filter((task) => !status || task.status === status)
        .slice(0, 12)

    if (!tasks.length) {
        await interaction.reply("目前沒有符合條件的任務。")
        return
    }

    await interaction.reply(`**${binding.groupName || "CampusFlow"} 任務**\n${tasks.map(formatTaskLine).join("\n")}`)
}

async function handleDue(interaction) {
    const binding = await getBinding(interaction.guildId, interaction.channelId)
    if (!binding) return replyMissingBinding(interaction)

    const now = Date.now()
    const tasks = (await getGroupTasks(binding.groupId))
        .filter((task) => task.status !== "done")
        .filter((task) => {
            const deadline = toDate(task.deadlineAt)?.getTime()
            return deadline && deadline <= now + 3 * DAY_MS
        })
        .slice(0, 12)

    if (!tasks.length) {
        await interaction.reply("目前沒有三天內到期或已超期的任務。")
        return
    }

    await interaction.reply(`**即將到期 / 已超期**\n${tasks.map(formatTaskLine).join("\n")}`)
}

async function handleTaskSearch(interaction) {
    const binding = await getBinding(interaction.guildId, interaction.channelId)
    if (!binding) return replyMissingBinding(interaction)

    const keyword = interaction.options.getString("keyword", true).trim().toLowerCase()
    const task = (await getGroupTasks(binding.groupId)).find((item) => {
        const text = `${item.text ?? ""}\n${item.details ?? ""}`.toLowerCase()
        return text.includes(keyword)
    })

    if (!task) {
        await interaction.reply("找不到符合關鍵字的任務。")
        return
    }

    const details = task.details ? `\n詳細內容：${task.details}` : ""
    await interaction.reply(`${formatTaskLine(task)}${details}`)
}

async function handleSetReportChannel(interaction) {
    const hasPermission = interaction.memberPermissions?.has(
        PermissionFlagsBits.ManageGuild
    )
    if (!hasPermission) {
        await interaction.reply({
            content: "只有具備管理伺服器權限的人可以設定問題回報頻道。",
            ephemeral: true,
        })
        return
    }

    await db.collection("botSettings").doc("reportChannel").set(
        {
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            updatedByDiscordUserId: interaction.user.id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    )

    await interaction.reply("已將這個頻道設定為 CampusFlow 問題回報接收處。")
}

async function handleHelp(interaction) {
    await interaction.reply(
        [
            "**CampusFlow Bot 指令**",
            "`/bind group_code` 綁定這個頻道到組別",
            "`/tasks` 列出任務，可加 assignee/status 篩選",
            "`/due` 查看三天內到期與已超期任務",
            "`/task keyword` 搜尋單一任務詳細內容",
            "`/set-report-channel` 設定網站問題回報送達頻道",
            "`/unbind` 解除綁定",
        ].join("\n")
    )
}

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return

    try {
        if (interaction.commandName === "bind") await handleBind(interaction)
        if (interaction.commandName === "unbind") await handleUnbind(interaction)
        if (interaction.commandName === "tasks") await handleTasks(interaction)
        if (interaction.commandName === "due") await handleDue(interaction)
        if (interaction.commandName === "task") await handleTaskSearch(interaction)
        if (interaction.commandName === "set-report-channel") await handleSetReportChannel(interaction)
        if (interaction.commandName === "campusflow-help") await handleHelp(interaction)
    } catch (err) {
        console.error("Discord command failed:", err)
        const payload = {
            content: `指令執行失敗：${err.message ?? String(err)}`,
            ephemeral: true,
        }
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(payload)
        } else {
            await interaction.reply(payload)
        }
    }
})

async function sendChannelMessage(channelId, content) {
    const channel = await client.channels.fetch(channelId)
    if (!channel?.isTextBased()) return
    await channel.send(content)
}

async function notifyNewTasks(binding, tasks) {
    const lastSeen = toDate(binding.lastSeenTaskCreatedAt)?.getTime() ?? 0
    const newTasks = tasks.filter((task) => {
        const createdAt = toDate(task.createdAt)?.getTime()
        return createdAt && createdAt > lastSeen
    })

    if (!newTasks.length) return

    for (const task of newTasks.slice(0, 5)) {
        await sendChannelMessage(
            binding.channelId,
            `**新增任務**\n${formatTaskLine(task)}${task.assignee === ALL_ASSIGNEE ? "\n指派：全員" : ""}`
        )
    }

    const maxCreatedAt = Math.max(
        ...newTasks.map((task) => toDate(task.createdAt)?.getTime() ?? 0)
    )
    await db.collection("discordBindings").doc(binding.id).set(
        {
            lastSeenTaskCreatedAt: admin.firestore.Timestamp.fromDate(
                new Date(maxCreatedAt)
            ),
        },
        { merge: true }
    )
}

async function notifyDueTasks(binding, tasks) {
    const now = Date.now()
    const todayKey = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Taipei",
    })

    for (const task of tasks) {
        if (task.status === "done") continue
        const deadline = toDate(task.deadlineAt)
        if (!deadline) continue

        const stateRef = db
            .collection("discordBindings")
            .doc(binding.id)
            .collection("taskNotifications")
            .doc(task.id)
        const stateSnapshot = await stateRef.get()
        const state = stateSnapshot.exists ? stateSnapshot.data() : {}
        const remainingMs = deadline.getTime() - now

        if (remainingMs > DAY_MS && remainingMs <= 3 * DAY_MS && !state.threeDaySent) {
            await sendChannelMessage(binding.channelId, `**截止前三天提醒**\n${formatTaskLine(task)}`)
            await stateRef.set({ threeDaySent: true }, { merge: true })
        }

        if (remainingMs >= 0 && remainingMs <= DAY_MS && !state.oneDaySent) {
            await sendChannelMessage(binding.channelId, `**截止前 24 小時提醒**\n${formatTaskLine(task)}`)
            await stateRef.set({ oneDaySent: true }, { merge: true })
        }

        if (remainingMs < 0 && state.overdueDateSent !== todayKey) {
            await sendChannelMessage(binding.channelId, `**任務已超期**\n${formatTaskLine(task)}`)
            await stateRef.set({ overdueDateSent: todayKey }, { merge: true })
        }
    }
}

async function forwardIssueReports() {
    const settingSnapshot = await db.collection("botSettings").doc("reportChannel").get()
    if (!settingSnapshot.exists) return

    const { channelId } = settingSnapshot.data()
    if (!channelId) return

    const reportSnapshot = await db
        .collection("issueReports")
        .where("discordForwarded", "==", false)
        .limit(10)
        .get()

    for (const reportDoc of reportSnapshot.docs) {
        const report = reportDoc.data()
        await sendChannelMessage(
            channelId,
            [
                "**CampusFlow 問題回報**",
                `組別：${report.groupName || report.groupId || "未知"}`,
                `回報者：${report.reporterName || "未知"}`,
                `頁面：${report.page || "未知"}`,
                `內容：${report.message}`,
            ].join("\n")
        )
        await reportDoc.ref.set(
            {
                discordForwarded: true,
                forwardedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        )
    }
}

async function runNotificationCycle() {
    const bindingSnapshot = await db.collection("discordBindings").get()
    for (const bindingDoc of bindingSnapshot.docs) {
        const binding = { id: bindingDoc.id, ...bindingDoc.data() }
        try {
            const tasks = await getGroupTasks(binding.groupId)
            await notifyNewTasks(binding, tasks)
            await notifyDueTasks(binding, tasks)
        } catch (err) {
            console.error(`Notification failed for binding ${binding.id}:`, err)
        }
    }

    try {
        await forwardIssueReports()
    } catch (err) {
        console.error("Issue report forwarding failed:", err)
    }
}

client.once("ready", () => {
    console.log(`CampusFlow bot logged in as ${client.user.tag}. App ${DISCORD_CLIENT_ID}`)
    runNotificationCycle()
    setInterval(runNotificationCycle, CHECK_INTERVAL_MS)
})

await client.login(DISCORD_TOKEN)
