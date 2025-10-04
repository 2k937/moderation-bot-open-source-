const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType } = require("discord.js");

module.exports = async (client) => {
  // === CONFIG ===
  const APPEAL_CATEGORY_ID = "APPEAL_CATEGORY_ID"; // Appeal category ID
  const STAFF_ROLE_ID = "STAFF_ROLE_ID"; // Staff role
  const PANEL_CHANNEL_ID = "APPEAL_PANEL_CHANNEL_ID"; // Panel channel
  const MAIN_GUILD_ID = "MAIN_SERVER_ID"; // Main server for bans/timeouts

  // Skip module if any config is missing
  if (!APPEAL_CATEGORY_ID || !STAFF_ROLE_ID || !PAnoNEL_CHANNEL_ID || !MAIN_GUILD_ID) return;

  // === SEND PANEL ===
  client.on("ready", async () => {
    const channel = client.channels.cache.get(PANEL_CHANNEL_ID);
    if (!channel) return;

    // Delete old panel messages
    const messages = await channel.messages.fetch({ limit: 50 }).catch(() => []);
    messages.forEach(msg => {
      if (msg.author.id === client.user.id) msg.delete().catch(() => {});
    });

    // Create dropdown menu
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("appeal_menu")
        .setPlaceholder("Select appeal type")
        .addOptions([
          { label: "Ban Appeal", value: "ban" },
          { label: "Timeout Appeal", value: "timeout" },
          { label: "Other", value: "other" },
        ])
    );

    channel.send({ content: "📩 Submit an appeal:", components: [row] });
  });

  // === INTERACTIONS ===
  client.on("interactionCreate", async (interaction) => {
    if (interaction.isStringSelectMenu() && interaction.customId === "appeal_menu") {
      const appealType = interaction.values[0];
      const mainGuild = client.guilds.cache.get(MAIN_GUILD_ID);
      if (!mainGuild) return interaction.reply({ content: "❌ Main server not found.", ephemeral: true });

      const userId = interaction.user.id;
      const member = await mainGuild.members.fetch(userId).catch(() => null);
      const bans = await mainGuild.bans.fetch().catch(() => new Map());

      // Check Ban/Timeout appeals
      if (appealType === "ban" && !bans.has(userId)) {
        interaction.user.send("❌ You are not banned in the main server. You cannot submit a Ban Appeal.").catch(() => {});
        return interaction.reply({ content: "❌ Check your DMs.", ephemeral: true });
      }

      if (appealType === "timeout" && (!member || !member.communicationDisabledUntilTimestamp || member.communicationDisabledUntilTimestamp <= Date.now())) {
        interaction.user.send("❌ You are not timed out in the main server. You cannot submit a Timeout Appeal.").catch(() => {});
        return interaction.reply({ content: "❌ Check your DMs.", ephemeral: true });
      }

      // Prevent duplicate channels
      const existingChannel = interaction.guild.channels.cache.find(c => c.name === `appeal-${userId}`);
      if (existingChannel) return interaction.reply({ content: "❌ You already have an active appeal channel.", ephemeral: true });

      // Ask user for reason in DMs
      interaction.user.send(`📩 You selected a **${appealType} appeal**. Please reply to this DM with the reason for your appeal.`)
        .then(() => interaction.reply({ content: "✅ Check your DMs to submit your appeal reason.", ephemeral: true }))
        .catch(() => interaction.reply({ content: "❌ I couldn't DM you. Please enable DMs and try again.", ephemeral: true }));

      // Collect the reason from user
      const filter = m => m.author.id === userId;
      const dmChannel = await interaction.user.createDM();
      dmChannel.awaitMessages({ filter, max: 1, time: 10 * 60 * 1000, errors: ["time"] })
        .then(async collected => {
          const reason = collected.first().content;

          // Create appeal channel
          const category = interaction.guild.channels.cache.get(APPEAL_CATEGORY_ID);
          const appealChannel = await interaction.guild.channels.create({
            name: `appeal-${userId}`,
            type: ChannelType.GuildText,
            parent: category ? category.id : undefined,
            permissionOverwrites: [
              { id: interaction.guild.id, deny: ["ViewChannel"] },
              { id: STAFF_ROLE_ID, allow: ["ViewChannel", "SendMessages"] },
              { id: userId, allow: ["ViewChannel", "SendMessages"] },
            ],
          });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("accept_appeal").setLabel("Accept").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("deny_appeal").setLabel("Deny").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("close_appeal").setLabel("Close").setStyle(ButtonStyle.Secondary)
          );

          await appealChannel.send({
            content: `<@&${STAFF_ROLE_ID}> 📩 **${interaction.user.tag}** submitted a **${appealType} appeal**.\n**Reason:** ${reason}\nStaff can accept/deny/close.`,
            components: [row]
          });

        }).catch(() => {
          interaction.user.send("❌ You did not provide a reason in time. Appeal cancelled.").catch(() => {});
        });
    }

    // === BUTTON HANDLER ===
    if (interaction.isButton()) {
      if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) return interaction.reply({ content: "❌ Only staff can use this.", ephemeral: true });

      const channel = interaction.channel;
      const userId = channel.name.split("appeal-")[1];
      const user = await interaction.client.users.fetch(userId).catch(() => null);

      if (interaction.customId === "close_appeal") {
        await interaction.reply({ content: "🔒 Closing appeal in 5 seconds...", ephemeral: true });
        setTimeout(async () => {
          if (user) await user.send(`📩 Your appeal in **${interaction.guild.name}** has been closed by staff.`).catch(() => {});
          channel.delete().catch(() => null);
        }, 5000);
      }

      if (interaction.customId === "accept_appeal") {
        if (user) await user.send(`✅ Your appeal in **${interaction.guild.name}** has been accepted by staff.`).catch(() => {});
        interaction.reply({ content: "✅ Appeal accepted.", ephemeral: true });
      }

      if (interaction.customId === "deny_appeal") {
        if (user) await user.send(`❌ Your appeal in **${interaction.guild.name}** has been denied by staff.`).catch(() => {});
        interaction.reply({ content: "❌ Appeal denied.", ephemeral: true });
      }
    }
  });
};

