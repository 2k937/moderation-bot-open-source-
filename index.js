const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionsBitField } = require("discord.js");
const fs = require("fs");
const path = require("path");

const PREFIX = ".";
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Load warnings data
const warningsFile = path.join(__dirname, 'warnings.json');
let warnings = fs.existsSync(warningsFile) ? JSON.parse(fs.readFileSync(warningsFile, 'utf8')) : {};

// Save helpers
function saveWarnings() { fs.writeFileSync(warningsFile, JSON.stringify(warnings, null, 2)); }

// Moderation Helpers
function resolveMember(message, arg) {
  if (!arg) return null;
  const id = arg.replace(/[<@!>]/g, "");
  return message.guild.members.cache.get(id) || message.mentions.members.first();
}

// Ready
client.on("ready", () => console.log(`Logged in as ${client.user.tag}`));

// Message handler
client.on("messageCreate", async message => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // === Moderation Commands ===
  if (cmd === "ban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply("No permission");
    const member = resolveMember(message, args[0]);
    if (!member) return message.reply("User not found");
    const reason = args.slice(1).join(" ") || "No reason provided";
    await member.ban({ reason });
    message.reply({ embeds: [new EmbedBuilder().setTitle("User Banned").setDescription(`${member.user.tag} was banned.\nReason: ${reason}`).setColor("#FF0000")] });
  }

  if (cmd === "kick") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply("No permission");
    const member = resolveMember(message, args[0]);
    if (!member) return message.reply("User not found");
    const reason = args.slice(1).join(" ") || "No reason provided";
    await member.kick(reason);
    message.reply({ embeds: [new EmbedBuilder().setTitle("User Kicked").setDescription(`${member.user.tag} was kicked.\nReason: ${reason}`).setColor("#FF4500")] });
  }

  if (cmd === "warn") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("You don't have permission to warn members.");
    const member = resolveMember(message, args[0]);
    if (!member) return message.reply("User not found");
    const reason = args.slice(1).join(" ") || "No reason provided";
    if (!warnings[member.id]) warnings[member.id] = [];
    warnings[member.id].push({ reason, date: new Date().toISOString() });
    saveWarnings();
    message.reply({ embeds: [new EmbedBuilder().setTitle("User Warned").setDescription(`${member.user.tag} was warned.\nReason: ${reason}`).setColor("#FFA500")] });
  }

  if (cmd === "unwarn") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("You don't have permission to remove warnings.");
    const member = resolveMember(message, args[0]);
    const index = parseInt(args[1]) - 1;
    if (!member || !warnings[member.id] || !warnings[member.id][index]) return message.reply("Warning not found");
    warnings[member.id].splice(index, 1);
    saveWarnings();
    message.reply({ embeds: [new EmbedBuilder().setTitle("Warning Removed").setDescription(`Removed warning #${index+1} from ${member.user.tag}`).setColor("#00FF00")] });
  }

  if (cmd === "warnings") {
    const member = resolveMember(message, args[0]);
    if (!member) return message.reply("User not found");
    const userWarnings = warnings[member.id] || [];
    const embed = new EmbedBuilder().setTitle(`${member.user.tag} Warnings`).setColor("#FF00FF")
      .setDescription(userWarnings.length ? userWarnings.map((w,i)=>`${i+1}. ${w.reason} - ${w.date}`).join("\n") : "No warnings");
    message.reply({ embeds: [embed] });
  }

  if (cmd === "timeout") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("No permission");
    const member = resolveMember(message, args[0]);
    const minutes = parseInt(args[1]);
    if (!member || isNaN(minutes)) return message.reply("Usage: .timeout <user> <minutes>");
    await member.timeout(minutes*60*1000);
    message.reply({ embeds: [new EmbedBuilder().setTitle("User Timed Out").setDescription(`${member.user.tag} timed out for ${minutes} minutes`).setColor("#00FFFF")] });
  }

  if (cmd === "untimeout") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("No permission");
    const member = resolveMember(message, args[0]);
    if (!member) return message.reply("User not found");
    await member.timeout(null);
    message.reply({ embeds: [new EmbedBuilder().setTitle("Timeout Removed").setDescription(`${member.user.tag} timeout removed`).setColor("#00FF00")] });
  }
});

// Login
client.login("YOUR_BOT_TOKEN");

