import "dotenv/config"
import { commands } from "./discord-worker.js"

const token = process.env.DISCORD_TOKEN
const clientId = process.env.DISCORD_CLIENT_ID ?? "1510658803002249296"

if (!token) {
    throw new Error("Missing DISCORD_TOKEN in environment variables.")
}

const response = await fetch(
    `https://discord.com/api/v10/applications/${clientId}/commands`,
    {
        method: "PUT",
        headers: {
            Authorization: `Bot ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(commands),
    }
)

if (!response.ok) {
    throw new Error(`Discord command registration failed: ${await response.text()}`)
}

console.log(`Registered ${commands.length} Discord commands.`)
