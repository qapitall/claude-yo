# claude-watch-notify

Get a notification on your smartwatch when Claude Code finishes a task — but only when you ask for it.

## Quick start

```bash
npm install -g claude-watch-notify
claude-watch-notify setup
```

`setup` walks you through:
1. **init** — pick a mode, pick a provider, fill in a few fields.
2. **install-skill** (or **install-hooks**, depending on mode) — wires Claude Code into the notifier.
3. **test** — sends a real notification so you confirm everything works.

After that, in any Claude Code conversation just say:

> "Run the test suite and **ping me when it's done**."

Claude finishes the work, runs `claude-watch-notify ping` once, and your watch buzzes. No notification on every short reply.

If something doesn't work, run `claude-watch-notify doctor` for a green/red checklist.

## Three modes

| Mode | When notifications fire | Best for |
|---|---|---|
| **on-demand** (default) | Only when you say "ping me" — Claude runs `ping` once at the end of the turn. | Most users. Zero noise. |
| **armed** | Only after you run `claude-watch-notify arm`. The next Stop or Notification hook fires once and disarms. | Long, well-defined tasks where you don't want to involve Claude in the decision. |
| **always** | On every Stop and Notification hook (still filtered by `minDurationSeconds` and quiet hours). | Power users who want to be told about every task. |

Switch any time with `claude-watch-notify mode <on-demand|armed|always>`.

## Why?

Long Claude Code tasks leave you wondering whether they're done. You don't want to babysit the terminal. This CLI hooks into Claude Code's `Stop` and `Notification` events, sends a push to one of three providers, and your phone mirrors that push to whichever smartwatch you wear.

```
Claude Code hook → stdin (JSON) → CLI → HTTP POST → provider → phone → watch
```

The bridge is **device-agnostic**. There is no watch-specific code in this project. The phone does the mirroring; the watch just shows the notification.

## Pick a provider

| Provider | New app on phone? | Setup time | Best for |
|---|---|---|---|
| **ntfy** (default) | yes (free, FOSS) | ~3 min | clean dedicated channel, self-hostable |
| **Telegram** | no, if you already use Telegram | ~3 min | "I don't want a new app" |
| **Discord** | no, if you already use Discord | ~1 min | shortest setup, no bot needed |

You can switch later by re-running `claude-watch-notify init`.

## Compatibility

This works with any smartwatch that mirrors phone notifications:

- **Apple Watch** (via iPhone)
- **Wear OS** watches (Pixel Watch, TicWatch, Fossil, etc.)
- **Samsung Galaxy Watch**
- **Garmin** watches (via Garmin Connect)
- **Huawei** watches (via Huawei Health) — GT, Fit, and Watch series including Watch Fit 4
- **Xiaomi / Amazfit / Mi Band** (via Zepp or Mi Fitness)
- **Fitbit** (Versa, Sense, etc.)
- Any other watch that mirrors phone app notifications

## Provider setup

### ntfy (default)
1. Run `claude-watch-notify init` — it suggests a long random topic name.
2. Install the **ntfy** app on your phone:
   - https://ntfy.sh/app, the App Store, or the Play Store
3. Open the URL printed by `init` (looks like `https://ntfy.sh/<your-topic>`) on your phone — the ntfy app intercepts it and offers to subscribe.

For private channels, set up an [ntfy.sh access token](https://docs.ntfy.sh/config/#access-tokens) or self-host ntfy and put the auth token into your config.

### Telegram (no new app if you already use Telegram)
1. In Telegram, talk to **@BotFather** and send `/newbot`. Choose a name; it gives you a **bot token** like `123456789:ABCdef...`.
2. Send `/start` to your new bot (so it can message you).
3. Get your **chat ID**: send a message to **@userinfobot** in Telegram, or open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and look for `"chat":{"id":...}`.
4. Run `claude-watch-notify init`, choose `telegram`, paste the token and chat ID.

### Discord (shortest setup, no bot needed)
1. In Discord, open a server channel you control → **Edit Channel** → **Integrations** → **Webhooks** → **New Webhook** → **Copy Webhook URL**.
2. Run `claude-watch-notify init`, choose `discord`, paste the URL.

If you don't have a server, you can [create one in Discord](https://support.discord.com/hc/en-us/articles/204849977) for free; it can have just one channel and no other members.

## Smartwatch setup

**General principle:** most watches mirror phone notifications automatically. You just need to make sure your provider's app (ntfy / Telegram / Discord) is allowed to send notifications, and your watch's companion app whitelists it.

### Apple Watch
Settings → Notifications → [your provider app] → enable "Mirror iPhone alerts" (or per-app: turn on Notifications → Allow Notifications).

### Wear OS (Pixel Watch, TicWatch, Fossil, etc.)
Phone → Wear OS / Pixel Watch app → Notifications → make sure your provider app is enabled.

### Samsung Galaxy Watch
Phone → Galaxy Wearable app → Notifications → manage app notifications → enable the provider app.

### Garmin
Garmin Connect → Notifications → App notifications → enable the provider app.

### Huawei (Health app)
Huawei Health → Devices → [your watch] → Notifications → toggle the provider app on. Make sure background app permissions for the provider and Health are granted on the phone.

### Xiaomi / Amazfit (Zepp / Mi Fitness)
Zepp or Mi Fitness → Profile → [your watch] → App alerts → enable the provider app.

### Fitbit
Fitbit app → [your device] → Notifications → App notifications → enable the provider app.

If your watch isn't listed, the recipe is the same: open your watch's companion app on your phone, find "App notifications" or similar, and turn on your provider.

## Commands

| Command | What it does |
|---|---|
| `setup` | One-shot: init + (install-skill or install-hooks) + test |
| `init` | Interactive config setup |
| `ping [--message TXT]` | Send a one-shot notification immediately (used by the skill) |
| `arm [--message TXT]` | Arm: next hook fires once. Only effective in `armed` mode |
| `disarm` | Clear armed state |
| `mode [name]` | Show or switch between `on-demand`, `armed`, `always` |
| `install-skill` | Install the notify-on-demand skill at `~/.claude/skills/notify-on-demand/SKILL.md` |
| `install-hooks` | Auto-merge hook block into `~/.claude/settings.json` (shows a diff first) |
| `test` | Send a test notification |
| `test --dry-run` | Print the request without sending |
| `doctor` | Green/red checklist: config, mode, skill/hooks, network |
| `--event Stop` / `--event Notification` | Used by Claude Code hooks; pipe JSON over stdin |
| `--help`, `--version` | Self-explanatory |

Both `install-hooks` and `install-skill` are **idempotent**: running them twice does not duplicate. They create `*.backup-<timestamp>` of the previous file before overwriting.

## How on-demand works

When you run `install-skill`, it places a [SKILL.md](skills/notify-on-demand/SKILL.md) file under `~/.claude/skills/notify-on-demand/`. Claude Code reads that skill on every session. It tells Claude:

> When the user says "ping me when this is done" (or similar), finish the work, then run `claude-watch-notify ping --message "<one-line summary>"` once before your final reply.

There are no hooks installed in `on-demand` mode, so nothing fires automatically. The notification only happens when Claude (acting on your explicit request) runs `ping`.

## How armed mode works

```bash
claude-watch-notify arm --message "deploy finished"   # before starting a long task
# … Claude does the work …
# the next Stop hook fires once, sends the notification, and disarms itself
```

If a hook fires and the system isn't armed, nothing happens. This is useful for tasks where you'd rather not rely on Claude remembering to ping.

## Hook setup (manual, only for `armed` or `always` mode)

In `on-demand` mode you don't need any hooks. For `armed` or `always` mode, run `claude-watch-notify install-hooks`. If you'd rather edit by hand, paste this into your Claude Code `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "claude-watch-notify --event Stop",
        "timeout": 8
      }]
    }],
    "Notification": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "claude-watch-notify --event Notification",
        "timeout": 8
      }]
    }]
  }
}
```

The CLI never blocks the hook: it always exits 0 and writes any errors to stderr.

## Config reference

Config file: `~/.claude-watch-notify.json`. Run `claude-watch-notify init` to create it.

| Path | Type | Default | Meaning |
|---|---|---|---|
| `mode` | `"on-demand"` \| `"armed"` \| `"always"` | `"on-demand"` | When notifications fire (see "Three modes" above) |
| `provider` | `"ntfy"` \| `"discord"` \| `"telegram"` | `"ntfy"` | Which provider sends the notification |
| `ntfy.topic` | string | (required for ntfy) | The ntfy topic name |
| `ntfy.server` | string | `https://ntfy.sh` | Override for self-hosted ntfy |
| `ntfy.authToken` | string \| null | `null` | Bearer token for protected topics |
| `discord.webhookUrl` | string | (required for discord) | Discord channel webhook URL |
| `telegram.botToken` | string | (required for telegram) | Telegram bot token from @BotFather |
| `telegram.chatId` | string \| number | (required for telegram) | Chat ID to send to |
| `filters.minDurationSeconds` | number | `30` | Skip Stop notifications shorter than this |
| `filters.events` | string[] | `["Stop","Notification"]` | Hook event allowlist |
| `quietHours.enabled` | boolean | `false` | Master toggle |
| `quietHours.start` | string | `"23:00"` | `HH:MM`, 24-hour. Cross-midnight ranges work |
| `quietHours.end` | string | `"08:00"` | `HH:MM`, exclusive |
| `quietHours.allowHighPriority` | boolean | `true` | When in quiet hours, still allow `Notification` events |
| `summary.maxLength` | number | `100` | Truncate the body to this many characters |
| `summary.includeProjectName` | boolean | `true` | Prepend the project folder basename to the title |

## Troubleshooting

Run `claude-watch-notify doctor` first — it tells you which step is broken.

- **No notification at all** — `claude-watch-notify test --dry-run` to inspect the payload, then `claude-watch-notify test` to actually send. If dry-run looks right but `test` fails, the provider section of your config is wrong (token, URL, or chat ID).
- **Phone gets it but the watch doesn't** — open your watch's companion app on your phone (see "Smartwatch setup" above) and confirm your provider app is in the allowed-notifications list. Also check Do Not Disturb on the watch.
- **Hooks never fire** — `claude --debug` and look for hook output. Make sure `claude-watch-notify` is on Claude Code's `PATH`. Or re-run `claude-watch-notify install-hooks`.
- **Body looks wrong or truncated** — adjust `summary.maxLength`. If the body is empty for Stop events, the transcript reader couldn't find a recent assistant message; harmless.
- **Notifications at 3am** — set `quietHours.enabled: true` and pick a window. Use `allowHighPriority: false` to silence input-needed alerts too.

## Security notes

- All secrets (`ntfy.authToken`, `telegram.botToken`, `discord.webhookUrl`) are redacted in `--dry-run` output and any error messages.
- Header values are sanitized to strip `\r` and `\n` (CRLF injection guard).
- Discord webhook URL tokens are redacted by replacing the trailing token segment with `[REDACTED]`.
- Telegram bot tokens are redacted in the request URL.
- The CLI does not exec a shell. All network IO uses Node's built-in `fetch`.
- The config file is written with mode `0600` (only your user can read it).
- ntfy.sh public topics are world-readable by anyone who guesses the topic name. The default suggestion is 64 bits of entropy (16 hex chars), which is unguessable in practice. For sensitive content, use ntfy with auth tokens, or pick the Telegram / Discord provider, or self-host ntfy.

## Contributing

Issues and PRs welcome. Keep modules small (≤ 200 lines), use ES modules, and don't add runtime dependencies — Node ≥18 has everything we need.

```bash
git clone https://github.com/<your-fork>/claude-watch-notify
cd claude-watch-notify
npm test
```

## License

[MIT](LICENSE)
