# claude-yo

[![CI](https://github.com/qapitall/claude-yo/actions/workflows/ci.yml/badge.svg)](https://github.com/qapitall/claude-yo/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![Node ≥18](https://img.shields.io/badge/node-%E2%89%A518-339933?style=flat-square&logo=node.js&logoColor=white)
![Zero dependencies](https://img.shields.io/badge/dependencies-zero-success?style=flat-square)

A small CLI that sends you a push notification when Claude Code finishes a task — but only when you actually ask for one.

## 🤔 The problem it solves

Long Claude Code tasks leave you wondering: is it done yet? Did it stop because it got stuck? Has it been waiting on me for the last 20 minutes? You don't want to babysit the terminal, but you also don't want a buzz on every short reply.

This tool sits between Claude Code and your phone (via ntfy, Telegram, or Discord) and pings you exactly when you wanted to be pinged.

## ✨ What it looks like

After a one-time setup, in any Claude Code conversation you can just say:

> "Run the test suite and **ping me when it's done**."

Claude does the work. Right before it sends its final reply, it quietly runs `claude-yo ping` once. Your phone pops a notification:

> **✓ Tests passed**

That's it. No buzz on short answers, no extra subscriptions, no babysitting.

## 🚀 Get started

```bash
npm install -g claude-yo
claude-yo setup
```

`setup` asks a handful of questions — pick a mode, pick a provider, paste a token or topic — then sends a real test notification so you can confirm everything works.

> [!TIP]
> Stuck? `claude-yo doctor` shows a green/red checklist of what's broken.

## 🎛️ How notifications fire (three modes)

You pick one of these during `setup`. Switch any time with `claude-yo mode <name>`.

| Mode | When notifications fire | When to pick it |
|---|---|---|
| 🟢 **on-demand** *(default)* | Only when Claude runs `ping` — which it does when you ask ("ping me when…"). | Most people. Zero noise. |
| 🟡 **armed** | Only after you run `claude-yo arm`. The next task-end fires once and clears itself. | Long tasks where you don't want to rely on Claude remembering. |
| 🔴 **always** | On every Stop/Notification hook. Filtered by `minDurationSeconds` and quiet hours. | Power users who want every-task pings. |

## 📡 Pick a provider

You need somewhere for the notification to actually arrive. Three options:

- **ntfy** *(default)* — Free, open-source, dedicated channel. Install the ntfy app and subscribe to a topic. Works on phone, web, and desktop.
- **Telegram** — Already use Telegram? No new app needed. A one-time bot setup and the messages appear in chat with your bot, on every device you're signed in to.
- **Discord** — The shortest setup. Open a Discord channel you own, make a webhook, paste the URL. No bot, no token.

Detailed steps for each below.

### ntfy

1. `claude-yo init` and choose `ntfy`. It suggests a long random topic name like `cyo-a3b7f9e2c1d4e8f6`.
2. Install the **ntfy** app on your phone:

   <p>
     <a href="https://apps.apple.com/us/app/ntfy/id1625396347">
       <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" height="44">
     </a>
     &nbsp;
     <a href="https://play.google.com/store/apps/details?id=io.heckel.ntfy">
       <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get on Google Play" height="65">
     </a>
   </p>

3. Open the URL `init` printed (`https://ntfy.sh/<your-topic>`) on your device — the ntfy app intercepts it and offers to subscribe.

For private channels, get an [ntfy access token](https://docs.ntfy.sh/config/#access-tokens) or self-host ntfy. Either way, drop the token into `ntfy.authToken` in your config.

### Telegram

1. In Telegram, talk to **[@BotFather](https://t.me/BotFather)**. Send `/newbot`, pick a name. It hands you a bot token that looks like `123456789:ABCdef...`.
2. Send `/start` to your new bot so it's allowed to message you back.
3. Find your **chat ID**. Easiest path: send a message to **@userinfobot**, it tells you. (Or visit `https://api.telegram.org/bot<TOKEN>/getUpdates` and find `"chat":{"id":...}`.)
4. `claude-yo init`, choose `telegram`, paste both.

### Discord

1. Open a Discord server channel you control. **Edit Channel → Integrations → Webhooks → New Webhook → Copy Webhook URL**.
2. `claude-yo init`, choose `discord`, paste the URL.

> [!NOTE]
> No server? Discord lets you [make one in a minute](https://support.discord.com/hc/en-us/articles/204849977) — empty, no members, no problem.

## 🔧 Commands you'll actually use

| Command | What it does |
|---|---|
| `setup` | Run this once: asks questions, installs what's needed, sends a test |
| `ping --message "..."` | Send a notification right now (the skill uses this for you) |
| `arm [--message "..."]` | Arm the next hook fire (only relevant in `armed` mode) |
| `mode <name>` | Switch between `on-demand` / `armed` / `always` |
| `doctor` | "Is everything wired up correctly?" — green/red checklist |
| `test` | Send a test notification to verify the pipeline |
| `uninstall` | Remove everything this tool installed |

A few more exist (`init`, `install-skill`, `install-hooks`, `disarm`, `arm-status`) — `--help` shows them all.

## ⚙️ Configuration

The config lives at `~/.claude-yo.json`. `init` writes it for you, but you can edit it by hand any time.

| Path | Default | Meaning |
|---|---|---|
| `mode` | `"on-demand"` | When notifications fire. See "Three modes" above. |
| `provider` | `"ntfy"` | `"ntfy"`, `"discord"`, or `"telegram"`. |
| `ntfy.topic` | — | The ntfy topic name. |
| `ntfy.server` | `"https://ntfy.sh"` | For self-hosted ntfy, override this. |
| `ntfy.authToken` | `null` | Bearer token if your topic is protected. |
| `discord.webhookUrl` | — | Discord channel webhook URL. |
| `telegram.botToken` | — | Telegram bot token from @BotFather. |
| `telegram.chatId` | — | Where messages go. |
| `filters.minDurationSeconds` | `30` | In `always` mode, skip tasks shorter than this. |
| `filters.events` | `["Stop","Notification"]` | In `always` mode, which hook events count. |
| `quietHours.enabled` | `false` | Turn quiet hours on or off. |
| `quietHours.start` / `.end` | `"23:00"` / `"08:00"` | 24-hour. Cross-midnight ranges work. |
| `quietHours.allowHighPriority` | `true` | Even in quiet hours, still send input-needed alerts. |
| `summary.maxLength` | `100` | Trim the body to this many characters. `0` = title only. |
| `summary.includeProjectName` | `true` | Put the project folder name in the title. |

## 🩹 When something doesn't work

Start with `claude-yo doctor` — it usually points you at the broken step.

**No notification at all.** Try `claude-yo test --dry-run` to see exactly what would be sent. The URL, headers, and body should look reasonable. Then drop the `--dry-run` to actually send. If dry-run looks correct but the live send fails, something in your provider config (token, URL, chat ID) is wrong.

**Notification reaches one device but not another.** That's a provider-app setting on the receiving device — notification permission, mirroring rules, Do Not Disturb. The CLI's job ends once the provider accepts the message.

**Hooks never fire.** Run Claude Code with `claude --debug` and watch for hook output. Make sure `claude-yo` is on the `PATH` Claude Code sees. Re-running `claude-yo install-hooks` is usually the fix.

**Notifications at 3 AM.** Set `quietHours.enabled: true` and pick a window. Set `allowHighPriority: false` too if you want to silence input-needed alerts during quiet hours.

## 🗑️ Removing it

```bash
claude-yo uninstall          # asks per item
claude-yo uninstall --yes    # nukes everything without prompting
npm uninstall -g claude-yo   # the binary itself
```

`uninstall` only removes hooks it installed (any `command` containing `claude-yo`); anything else in your `~/.claude/settings.json` stays put. It also leaves `*.backup-*` files behind in case you want to undo.

## 🔒 Security

- Secrets (`ntfy.authToken`, `telegram.botToken`, `discord.webhookUrl`) never appear in dry-run output or error messages — they're replaced with `[REDACTED]`. Even network error strings are scrubbed.
- The CLI doesn't run shell commands. All network IO uses Node's built-in `fetch`.
- Your config file is written with `0600` permissions (only your user can read it).
- ntfy.sh public topics are world-readable to anyone who guesses the topic name. The default suggestion is 64 bits of entropy (16 hex chars) — unguessable in practice. For sensitive content, use ntfy with an auth token, switch to Telegram or Discord, or self-host ntfy.

## 🤝 Contributing

Issues and PRs welcome — the project is small on purpose, no runtime dependencies.

```bash
git clone https://github.com/qapitall/claude-yo
cd claude-yo
```

## 📄 License

[MIT](LICENSE)
