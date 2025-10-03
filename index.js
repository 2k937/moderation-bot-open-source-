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

// === Data Files ===
const warningsFile = path.join(__dirname, 'warnings.json');
let warnings = fs.existsSync(warningsFile) ? JSON.parse(fs.readFileSync(warningsFile, 'utf8')) : {};

// === Helpers ===
function saveWarnings() { fs.writeFileSync(warningsFile, JSON.stringify(warnings, null, 2)); }

function resolveMember(message, arg) {
  if (!arg) return null;
  const id = arg.replace(/[<@!>]/g, "");
  return message.guild.members.cache.get(id) || message.mentions.members.first();
}

function createEmbed(title, description, color = "#FF0000") {
  return new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
}

// === Bot Ready ===
client.on("ready", () => console.log(`Logged in as ${client.user.tag}`));

// === Message Handler ===
client.on("messageCreate", async message => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // === HELP COMMAND ===
  if (cmd === "help") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply({ embeds: [createEmbed("Help", "You are not authorized to view this help menu.", "#FF0000")] });
    }

    const embed = new EmbedBuilder()
      .setTitle("Moderation Commands Help")
      .setColor("#00FFFF")
      .setDescription("Commands for moderators:")
      .addFields(
        { name: ".ban <user> [reason]", value: "Ban a member" },
        { name: ".unban <user> [reason]", value: "Unban a member" },
        { name: ".kick <user> [reason]", value: "Kick a member" },
        { name: ".warn <user> [reason]", value: "Warn a member" },
        { name: ".unwarn <user> <#>", value: "Remove a specific warning" },
        { name: ".warnings [user]", value: "Check warnings (mods: any user, members: self only)" },
        { name: ".timeout <user> <minutes>", value: "Timeout a member" },
        { name: ".untimeout <user>", value: "Remove timeout" },
        { name: ".purge <#>", value: "Delete messages (1-100)" }
      )
      .setFooter({ text: "Only Moderators can see this help menu" })
      .setTimestamp();

    return message.author.send({ embeds: [embed] }).catch(() => {
      message.reply("I couldn't DM you the help menu. Make sure your DMs are open.");
    });
  }

  // === BAN ===
  if (cmd === "ban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply("No permission");
    const member = resolveMember(message, args[0]);
    if (!member) return message.reply("User not found");
    const reason = args.slice(1).join(" ") || "No reason provided";
    await member.ban({ reason });
    message.channel.send({ embeds: [createEmbed("Ban", `${member.user.tag} was banned.\nReason: ${reason}`, "#FF0000")] });
  }

  // === UNBAN ===
  if (cmd === "unban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply("No permission");
    const userId = args[0];
    if (!userId) return message.reply("Please provide the ID of the user to unban.");
    const reason = args.slice(1).join(" ") || "No reason provided";

    try {
      const bannedUsers = await message.guild.bans.fetch();
      const bannedUser = bannedUsers.get(userId);
      if (!bannedUser) return message.reply("This user is not banned.");

      await message.guild.members.unban(userId, reason);
      message.channel.send({ embeds: [createEmbed("Unban", `${bannedUser.user.tag} has been unbanned.\nReason: ${reason}`, "#00FF00")] });
    } catch (err) {
      console.error(err);
      message.reply("There was an error trying to unban that user.");
    }
  }

  // === KICK ===
  if (cmd === "kick") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply("No permission");
    const member = resolveMember(message, args[0]);
    if (!member) return message.reply("User not found");
    const reason = args.slice(1).join(" ") || "No reason provided";
    await member.kick(reason);
    message.channel.send({ embeds: [createEmbed("Kick", `${member.user.tag} was kicked.\nReason: ${reason}`, "#FF4500")] });
  }

  // === WARN ===
  if (cmd === "warn") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("No permission");
    const member = resolveMember(message, args[0]);
    if (!member) return message.reply("User not found");
    const reason = args.slice(1).join(" ") || "No reason provided";

    if (!warnings[member.id]) warnings[member.id] = [];
    warnings[member.id].push({ reason, date: new Date().toISOString() });
    saveWarnings();

    message.channel.send({ embeds: [createEmbed("Warn", `${member.user.tag} was warned.\nReason: ${reason}`, "#FFA500")] });

    // Auto actions
    const warnCount = warnings[member.id].length;

    if (warnCount === 3) {
      await member.timeout(10 * 60 * 1000, "Reached 3 warnings (auto timeout)");
      message.channel.send({ embeds: [createEmbed("Auto Timeout (10 min)", `${member.user.tag} timed out automatically for 10 minutes.`, "#00FFFF")] });
    } else if (warnCount === 5) {
      await member.timeout(60 * 60 * 1000, "Reached 5 warnings (auto timeout)");
      message.channel.send({ embeds: [createEmbed("Auto Timeout (1 hour)", `${member.user.tag} timed out automatically for 1 hour.`, "#00FFFF")] });
    } else if (warnCount >= 10) {
      await member.ban({ reason: "Reached 10 warnings (auto ban)" });
      message.channel.send({ embeds: [createEmbed("Auto Ban", `${member.user.tag} was banned automatically for 10 warnings.`, "#FF0000")] });
    }
  }

  // === UNWARN ===
  if (cmd === "unwarn") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("No permission");
    const member = resolveMember(message, args[0]);
    const index = parseInt(args[1]) - 1;
    if (!member || !warnings[member.id] || !warnings[member.id][index]) return message.reply("Warning not found");
    warnings[member.id].splice(index, 1);
    saveWarnings();
    message.channel.send({ embeds: [createEmbed("Warning Removed", `Removed warning #${index+1} from ${member.user.tag}`, "#00FF00")] });
  }

  // === WARNINGS ===
  if (cmd === "warnings") {
    let member = resolveMember(message, args[0]);
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      member = message.member;
    }
    if (!member) return message.reply("User not found");
    const userWarnings = warnings[member.id] || [];
    const embed = new EmbedBuilder()
      .setTitle(`${member.user.tag} Warnings`)
      .setColor("#FF00FF")
      .setDescription(userWarnings.length 
        ? userWarnings.map((w,i) => `${i+1}. ${w.reason} - ${w.date}`).join("\n")
        : "No warnings")
      .setTimestamp();
    message.channel.send({ embeds: [embed] });
  }

  // === TIMEOUT ===
  if (cmd === "timeout") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("No permission");
    const member = resolveMember(message, args[0]);
    const minutes = parseInt(args[1]);
    if (!member || isNaN(minutes)) return message.reply("Usage: .timeout <user> <minutes>");
    await member.timeout(minutes*60*1000);
    message.channel.send({ embeds: [createEmbed("Timeout", `${member.user.tag} timed out for ${minutes} minutes.`, "#00FFFF")] });
  }

  // === UNTIMEOUT ===
  if (cmd === "untimeout") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply("No permission");
    const member = resolveMember(message, args[0]);
    if (!member) return message.reply("User not found");
    await member.timeout(null);
    message.channel.send({ embeds: [createEmbed("Timeout Removed", `${member.user.tag}'s timeout removed.`, "#00FF00")] });
  }

  // === PURGE ===
  if (cmd === "purge") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return message.reply("No permission");
    const count = parseInt(args[0]);
    if (isNaN(count) || count < 1 || count > 100) return message.reply("Specify a number between 1-100");
    const deleted = await message.channel.bulkDelete(count, true);
    message.channel.send({ embeds: [createEmbed("Messages Purged", `Deleted ${deleted.size} messages.`, "#FFAA00")] })
      .then(msg => setTimeout(() => msg.delete(), 5000));
  }

});

client.login("YOUR_BOT_TOKEN");
