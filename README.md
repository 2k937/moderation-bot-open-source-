# Moderation Logs Bot

> Next Update: Adding custom status soon.

A Discord moderation bot template built with Discord.js v15. Logs all moderation actions such as warnings, mutes, kicks, and bans to a dedicated channel. Fully configurable, open-source, and ready for customization.

---

## Features

- ⚡ Moderation Logs: Automatically logs warnings, mutes, kicks, and bans with rich embeds.
- 📝 Warn System: Track user warnings. Auto-timeout or ban users when they reach configurable limits.
- 🎨 Embed Support: Color-coded embeds for different moderation actions.
- 🔧 Configurable: Easily set log channel, prefixes, and maximum warnings.
- 🌐 Open Source: Fully customizable for your own server needs.

---

## Upcoming

- 🌟 Custom bot status
- ⏱ Auto-expiring temp-mutes
- 🛠 Advanced moderation features

---

## Setup

1. Clone the repo: git clone https://github.com/YourUsername/moderation-logs-bot.git
2. Install dependencies: npm install
3. Configure `index.js` with your bot token.
4. Run the bot: node index.js



---

## Commands

All commands support both user mentions and user IDs:

- `warn @user <userID> <reason>` — Warn a user and log it.
- `unwarn @user <userID> <reason>` — Remove a warning from a user.
- `kick @user <userID> <reason>` — Kick a user from the server.
- `ban @user <userID> <reason>` — Ban a user from the server.
- `unban <userID>` — Unban a user by their ID.
- `purge <number>` — Delete a number of messages from a channel.
- `timeout @user <userID> <duration> <reason>` — Temporarily mute a user.
- `untimeout @user <userID>` — Remove a user's timeout.

> More commands will be added in future updates.

---

## Contribution

Contributions are welcome! Fork the repo and submit a pull request.  
Please report any bugs or issues in the GitHub Issues tab.

---

## License


MIT License — free to use and modify.


