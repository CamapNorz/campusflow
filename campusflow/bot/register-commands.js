import "dotenv/config"
import { REST, Routes } from "discord.js"
import { commandJson } from "./commands.js"

const token = process.env.DISCORD_TOKEN
const clientId = process.env.DISCORD_CLIENT_ID ?? "1510658803002249296"

if (!token) {
    throw new Error("Missing DISCORD_TOKEN in environment variables.")
}

const rest = new REST({ version: "10" }).setToken(token)

await rest.put(Routes.applicationCommands(clientId), { body: commandJson })

console.log(`Registered ${commandJson.length} Discord commands.`)
