const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const fs = require("fs");

// Load warnings.json
let warnings = {};
if (fs.existsSync("./warnings.json")) {
  warnings = JSON.parse(fs.readFileSync("./warnings.json", "utf8"));
} else {
  fs.writeFileSync("./warnings.json", JSON.stringify({}));
}

// Track if automod is enabled per server
let automodEnabled = {};

module.exports = (client, PREFIX) => {
  client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

// ----- AutoMod -----
if (automodEnabled[message.guild.id]) {
  const member = message.guild.members.cache.get(message.author.id);
  if (!member) return;

  // WHITELIST: skip admins and manage-guild perms
  if (member.permissions.has("Administrator") || member.permissions.has("ManageGuild")) return;

  const inviteRegex = /(discord\.gg|discord\.com\/invite)/i;
  const linkRegex = /(https?:\/\/[^\s]+)/i;

  if (inviteRegex.test(message.content) || linkRegex.test(message.content)) {
    await message.delete().catch(() => {});

    if (!warnings[message.author.id]) warnings[message.author.id] = { warns: 0 };
    warnings[message.author.id].warns += 1;
    fs.writeFileSync("./warnings.json", JSON.stringify(warnings, null, 2));

    message.channel.send(
      `⚠️ ${message.author}, posting links/invites is not allowed! Warning **${warnings[message.author.id].warns}**.`
    );

    const warns = warnings[message.author.id].warns;
    if (warns === 1) await member.timeout(6 * 60 * 1000).catch(() => {});
    else if (warns === 2) await member.timeout(12 * 60 * 1000).catch(() => {});
    else if (warns === 3) await member.kick({ reason: "3 warnings (AutoMod)" }).catch(() => {});
    else if (warns >= 4) await member.ban({ reason: "4+ warnings (AutoMod)" }).catch(() => {});
  }
}


    // ----- Commands -----
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    // ----- Lock -----
    if (cmd === "lock") {
      if (
        !message.member.permissions.has(PermissionsBitField.Flags.ManageMessages) &&
        !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
      ) return message.reply("❌ You do not have permission to lock channels.");

      const reason = args.join(" ") || "No reason provided";
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });

      const embed = new EmbedBuilder()
        .setTitle("🚨 Channel Locked")
        .setDescription(`This channel has been temporarily locked.\n**Reason:** ${reason}`)
        .setColor("#FF0000")
        .setFooter({ text: "Staff will unlock the channel once everything is back to normal." })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    }

    // ----- Unlock -----
    if (cmd === "unlock") {
      if (
        !message.member.permissions.has(PermissionsBitField.Flags.ManageMessages) &&
        !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
      ) return message.reply("❌ You do not have permission to unlock channels.");

      const reason = args.join(" ") || "No reason provided";
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true });

      const embed = new EmbedBuilder()
        .setTitle("✅ Channel Unlocked")
        .setDescription(`This channel has been unlocked.\n**Reason:** ${reason}`)
        .setColor("#00FF00")
        .setFooter({ text: "Thank you for your patience!" })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    }

    // ----- Role Management -----
    if (cmd === "role") {
      const sub = args.shift();
      const target = args.shift();
      const roleName = args.join(" ");
      if (!sub || !target || !roleName) return message.reply(`Usage: ${PREFIX}role a|r @user RoleName`);

      const member = message.mentions.members.first() || message.guild.members.cache.get(target);
      if (!member) return message.reply("User not found.");

      const role = message.guild.roles.cache.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
      if (!role) return message.reply("Role not found.");

      if (sub === "a") {
        await member.roles.add(role).catch(() => {});
        message.reply(`✅ Added role ${role.name} to ${member.user.tag}`);
      } else if (sub === "r") {
        await member.roles.remove(role).catch(() => {});
        message.reply(`✅ Removed role ${role.name} from ${member.user.tag}`);
      } else {
        message.reply("Invalid subcommand, use `a` to add or `r` to remove.");
      }
    }

    // ----- Setup AutoMod -----
    if (cmd === "setup") {
      const type = args[0];
      if (type === "automod") {
        automodEnabled[message.guild.id] = true;
        message.channel.send("✅ AutoMod enabled! Links and Discord invites will be blocked and warned.");
      }
    }
  });
};
