import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js"

export const commands = [
    new SlashCommandBuilder()
        .setName("bind")
        .setDescription("Bind this Discord channel to a CampusFlow group.")
        .addStringOption((option) =>
            option
                .setName("group_code")
                .setDescription("CampusFlow group code")
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName("unbind")
        .setDescription("Remove the CampusFlow binding from this channel."),
    new SlashCommandBuilder()
        .setName("tasks")
        .setDescription("List tasks in the bound CampusFlow group.")
        .addStringOption((option) =>
            option
                .setName("assignee")
                .setDescription("Filter by assignee name")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("status")
                .setDescription("Filter by task status")
                .setRequired(false)
                .addChoices(
                    { name: "未執行", value: "todo" },
                    { name: "執行中", value: "doing" },
                    { name: "已完成", value: "done" }
                )
        ),
    new SlashCommandBuilder()
        .setName("due")
        .setDescription("Show upcoming and overdue tasks."),
    new SlashCommandBuilder()
        .setName("task")
        .setDescription("Search one task by title or detail keyword.")
        .addStringOption((option) =>
            option
                .setName("keyword")
                .setDescription("Task title or detail keyword")
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName("set-report-channel")
        .setDescription("Use this channel for CampusFlow issue reports.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder()
        .setName("campusflow-help")
        .setDescription("Show CampusFlow bot commands."),
]

export const commandJson = commands.map((command) => command.toJSON())
