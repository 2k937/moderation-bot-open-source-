const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
  ChannelType
} = require("discord.js");

module.exports = async (client) => {
  const APPEAL_CATEGORY_ID = "APPEAL_CATEGORY_ID";
  const STAFF_ROLE_ID = "STAFF_ROLE_ID";
  const PANEL_CHANNEL_ID = "APPEAL_PANEL_CHANNEL_ID";
  const MAIN_GUILD_ID = "MAIN_SERVER_ID";

  if (!APPEAL_CATEGORY_ID || !STAFF_ROLE_ID || !PANEL_CHANNEL_ID || !MAIN_GUILD_ID) return;

  client.on("ready", async () => {
    const channel = client.channels.cache.get(PANEL_CHANNEL_ID);
    if (!channel) return;

    const messages = await channel.messages.fetch({ limit: 50 }).catch(() => []);
    messages.forEach(msg => {
      if (msg.author.id === client.user.id) msg.delete().catch(() => {});
    });

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

  client.on("interactionCreate", async (interaction) => {
    const mainGuild = client.guilds.cache.get(MAIN_GUILD_ID);

    // --- SELECT MENU ---
    if (interaction.isStringSelectMenu() && interaction.customId === "appeal_menu") {
      const appealType = interaction.values[0];
      const userId = interaction.user.id;
      const member = await mainGuild.members.fetch(userId).catch(() => null);
      const bans = await mainGuild.bans.fetch().catch(() => new Map());

      if (appealType === "ban" && !bans.has(userId)) {
        return interaction.reply({ content: "❌ You are not banned.", ephemeral: true });
      }
      if (appealType === "timeout" && (!member || !member.communicationDisabledUntilTimestamp || member.communicationDisabledUntilTimestamp <= Date.now())) {
        return interaction.reply({ content: "❌ You are not timed out.", ephemeral: true });
      }

      const existingChannel = interaction.guild.channels.cache.find(c => c.name === `appeal-${userId}`);
      if (existingChannel) return interaction.reply({ content: "❌ You already have an active appeal channel.", ephemeral: true });

      // --- MODAL ---
      const modal = new ModalBuilder()
        .setCustomId(`appeal_modal_${appealType}`)
        .setTitle(`Submit ${appealType} appeal`);

      const discordInfoInput = new TextInputBuilder()
        .setCustomId("discord_info")
        .setLabel("Your Discord Username and ID")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(`${interaction.user.tag} | ${userId} (read-only, do not change)`)
        .setRequired(true);

      const reasonInput = new TextInputBuilder()
        .setCustomId("appeal_reason")
        .setLabel("Reason for Appeal")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Explain why your appeal should be accepted")
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(discordInfoInput),
        new ActionRowBuilder().addComponents(reasonInput)
      );

      await interaction.showModal(modal);
    }

    // --- MODAL SUBMISSION ---
    if (interaction.isModalSubmit() && interaction.customId.startsWith("appeal_modal_")) {
      const appealType = interaction.customId.split("appeal_modal_")[1];
      const userId = interaction.user.id;

      // Automatically use Discord info from the user object
      const discordInfo = `${interaction.user.tag} | ${userId}`;
      const reason = interaction.fields.getTextInputValue("appeal_reason");

      const existingChannel = interaction.guild.channels.cache.find(c => c.name === `appeal-${userId}`);
      if (existingChannel) return interaction.reply({ content: "❌ You already have an active appeal channel.", ephemeral: true });

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
        content: `<@&${STAFF_ROLE_ID}> 📩 **${interaction.user.tag}** submitted a **${appealType} appeal**.\n**Discord Info:** ${discordInfo}\n**Reason:** ${reason}\nStaff can accept/deny/close.`,
        components: [row]
      });

      await interaction.reply({ content: "✅ Your appeal has been submitted.", ephemeral: true });
    }

    // --- BUTTON HANDLER ---
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
