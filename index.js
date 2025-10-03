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
let caseCounter = fs.existsSync('cases.json') ? JSON.parse(fs.readFileSync('cases.json', 'utf8')) : { count: 0 };

function saveWarnings() { fs.writeFileSync(warningsFile, JSON.stringify(warnings, null, 2)); }
function saveCases() { fs.writeFileSync('cases.json', JSON.stringify(caseCounter, null, 2)); }

// Moderation Helpers
function resolveMember(message, arg) {
  if (!arg) return null;
  const id = arg.replace(/[<@!>]/g, "");
  return message.guild.members.cache.get(id) || message.mentions.members.first();
}

function createCase(action, moderator, target, reason) {
  caseCounter.count++;
  saveCases();
  return new EmbedBuilder()
    .setTitle(`${action} | Case #${caseCounter.count}`)
    .addFields(
      { name: "Moderator", value: moderator.user.tag, inline: true },
      { name: "User", value: target.user.tag, inline: true },
      { name: "Reason", value: reason || "No reason provided" }
    )
    .setColor("#FF0000")
    .setTimestamp();
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
    message.channel.send({ embeds: [createCase("Ban", message.member, member, reason)] });
  }

  if (cmd === "kick") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply("No permission");
    const member = resolveMember(message, args[0]);
    if (!member) return message.reply("User not found");
    const reason = args.slice(1).join(" ") || "No reason provided";
    await member.kick(reason);
    message.channel.send({ embeds: [createCase("Kick", message.member, member, reason)] });
  }

  if (cmd === "warn") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("No permission");
    const member = resolveMember(message, args[0]);
    if (!member) return message.reply("User not found");
    const reason = args.slice(1).join(" ") || "No reason provided";
    if (!warnings[member.id]) warnings[member.id] = [];
    warnings[member.id].push({ reason, date: new Date().toISOString() });
    saveWarnings();
    message.channel.send({ embeds: [createCase("Warn", message.member, member, reason)] });
  }

  if (cmd === "unwarn") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("No permission");
    const member = resolveMember(message, args[0]);
    const index = parseInt(args[1]) - 1;
    if (!member || !warnings[member.id] || !warnings[member.id][index]) return message.reply("Warning not found");
    warnings[member.id].splice(index, 1);
    saveWarnings();
    message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle("Warning Removed")
      .setDescription(`Removed warning #${index+1} from ${member.user.tag}`)
      .setColor("#00FF00")
      .setTimestamp()
    ]});
  }

  if (cmd === "warnings") {
    const member = resolveMember(message, args[0]);
    if (!member) return message.reply("User not found");
    const userWarnings = warnings[member.id] || [];
    const embed = new EmbedBuilder()
      .setTitle(`${member.user.tag} Warnings`)
      .setColor("#FF00FF")
      .setDescription(userWarnings.length ? userWarnings.map((w,i)=>`${i+1}. ${w.reason} - ${w.date}`).join("\n") : "No warnings");
    message.channel.send({ embeds: [embed] });
  }

  if (cmd === "timeout") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("No permission");
    const member = resolveMember(message, args[0]);
    const minutes = parseInt(args[1]);
    if (!member || isNaN(minutes)) return message.reply("Usage: .timeout <user> <minutes>");
    await member.timeout(minutes*60*1000);
    message.channel.send({ embeds: [createCase("Timeout", message.member, member, `${minutes} minutes`)] });
  }

  if (cmd === "untimeout") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("No permission");
    const member = resolveMember(message, args[0]);
    if (!member) return message.reply("User not found");
    await member.timeout(null);
    message.channel.send({ embeds: [createCase("Timeout Removed", message.member, member, "Manual removal")] });
  }

  // === Purge Messages ===
  if (cmd === "purge") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return message.reply("No permission");
    const count = parseInt(args[0]);
    if (isNaN(count) || count < 1 || count > 100) return message.reply("Specify a number between 1-100");
    const deleted = await message.channel.bulkDelete(count, true);
    message.channel.send({ embeds: [new EmbedBuilder()
      .setTitle("Messages Purged")
      .setDescription(`Deleted ${deleted.size} messages.`)
      .setColor("#FFAA00")
      .setTimestamp()
    ]}).then(msg => setTimeout(() => msg.delete(), 5000));
  }
});

client.login("YOUR_BOT_TOKEN");
