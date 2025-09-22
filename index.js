// index.js
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require("discord.js");
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

// Load data
const warningsFile = path.join(__dirname, 'warnings.json');
const appDataFile = path.join(__dirname, 'applications.json');

let warnings = fs.existsSync(warningsFile) ? JSON.parse(fs.readFileSync(warningsFile, 'utf8')) : {};
let applications = fs.existsSync(appDataFile) ? JSON.parse(fs.readFileSync(appDataFile, 'utf8')) : {};

// Save helpers
function saveWarnings() { fs.writeFileSync(warningsFile, JSON.stringify(warnings, null, 2)); }
function saveApplications() { fs.writeFileSync(appDataFile, JSON.stringify(applications, null, 2)); }

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

  // === Moderation ===
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

  // === Application Setup ===
  if (cmd === "setupapply") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return message.reply("No permission");
    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
    if (!channel) return message.reply("Please provide a valid channel");
    const hexColor = args[1] || "#00FFFF";

    message.reply("Please type your application questions separated by `|` (example: Question1 | Question2 | Question3):");
    const filter = m => m.author.id === message.author.id;
    const collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000 });
    if (!collected.size) return message.reply("Setup timed out.");
    const questions = collected.first().content.split("|").map(q=>q.trim());
    if (questions.length > 12) return message.reply("You can only set up a maximum of 12 questions.");

    applications[message.guild.id] = { channel: channel.id, questions, enabled: true, hexColor };
    saveApplications();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("apply_button").setLabel("Apply").setStyle(ButtonStyle.Primary).setDisabled(false)
    );

    const embed = new EmbedBuilder()
      .setTitle("Application")
      .setDescription("Click the button below to start your application!")
      .setColor(hexColor);

    await channel.send({ embeds: [embed], components: [row] });
    message.reply("Application system set up successfully!");
  }

  // === Add / Remove Questions ===
  if (cmd === "addquestion") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return message.reply("No permission");
    const app = applications[message.guild.id];
    if (!app) return message.reply("No application system set up");

    const extraQuestion = args.join(" ");
    if (!extraQuestion) return message.reply("Please provide a question to add.");
    if (app.questions.length >= 12) return message.reply("You cannot have more than 12 questions.");

    app.questions.push(extraQuestion);
    saveApplications();
    message.reply(`Question added! Total questions: ${app.questions.length}/12`);
  }

  if (cmd === "removequestion") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return message.reply("No permission");
    const app = applications[message.guild.id];
    if (!app) return message.reply("No application system set up");

    const index = parseInt(args[0]) - 1;
    if (isNaN(index) || index < 0 || index >= app.questions.length) return message.reply("Please provide a valid question number to remove.");

    const removed = app.questions.splice(index, 1);
    saveApplications();
    message.reply(`Removed question #${index + 1}: "${removed[0]}". Total questions: ${app.questions.length}/12`);
  }

  // === Open / Close Applications ===
  if (cmd === "open") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return message.reply("No permission");
    const app = applications[message.guild.id];
    if (!app) return message.reply("No application system set up.");
    app.enabled = true;
    saveApplications();
    message.reply("Application button is now OPEN.");
  }

  if (cmd === "close") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return message.reply("No permission");
    const app = applications[message.guild.id];
    if (!app) return message.reply("No application system set up.");
    app.enabled = false;
    saveApplications();
    message.reply("Application button is now CLOSED.");
  }
});

// === Button Interaction ===
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "apply_button") return;

  const app = applications[interaction.guild.id];
  if (!app || !app.enabled) return interaction.reply({ content: "Applications are currently closed.", ephemeral: true });

  try {
    const dm = await interaction.user.send("Starting your application. Type `cancel` anytime to stop.");
    const answers = [];
    for (const question of app.questions) {
      await dm.send(question);
      const filter = m => m.author.id === interaction.user.id;
      const collected = await dm.channel.awaitMessages({ filter, max: 1, time: 300000 });
      if (!collected.size) return dm.send("Application timed out.");
      const response = collected.first().content;
      if (response.toLowerCase() === "cancel") return dm.send("Application cancelled.");
      answers.push({ question, answer: response });
    }

    const submissionChannel = interaction.guild.channels.cache.get(app.channel);
    if (!submissionChannel) return dm.send("Submission channel not found.");

    const embed = new EmbedBuilder()
      .setTitle(`New Application from ${interaction.user.tag}`)
      .setColor(app.hexColor)
      .setDescription(answers.map(a=>`**${a.question}**\n${a.answer}`).join("\n\n"))
      .setFooter({ text: `User ID: ${interaction.user.id}` });

    submissionChannel.send({ embeds: [embed] });
    dm.send("Your application has been submitted successfully!");
    interaction.reply({ content: "Check your DMs to complete the application!", ephemeral: true });
  } catch (err) {
    interaction.reply({ content: "Unable to DM you. Please enable DMs.", ephemeral: true });
  }
});

client.login("YOUR_BOT_TOKEN");
