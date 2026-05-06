# claude-watch-notify

Get a notification on your smartwatch when Claude Code finishes a task or needs your input.

## Why?

Long Claude Code tasks leave you wondering whether they're done. You don't want to babysit the terminal. This CLI hooks into Claude Code's `Stop` and `Notification` events, sends a push to a self-hosted or public [ntfy](https://ntfy.sh) topic, and your phone mirrors that push to whichever smartwatch you wear.

```
Claude Code hook → stdin (JSON) → CLI → HTTP POST → ntfy → phone → watch
```

The bridge is **device-agnostic**. There is no watch-specific code in this project. The phone does the mirroring; the watch just shows the notification.

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

## Quick start

```bash
npm install -g claude-watch-notify
claude-watch-notify init
claude-watch-notify test
```

`init` walks you through topic setup and writes `~/.claude-watch-notify.json`. `test` sends a real notification so you can confirm the bridge works end to end.

## Phone setup

1. Install the **ntfy** app on your phone:
   - Web app: https://ntfy.sh/app
   - iOS: search "ntfy" on the App Store
   - Android: search "ntfy" on the Play Store, or use F-Droid
2. In the app, **subscribe to the topic** you chose during `init` (e.g. `claude-watch-abc123`).
3. Make sure notifications are enabled for the ntfy app on your phone.

## Smartwatch setup

**General principle:** most watches mirror phone notifications automatically. You just need to make sure the ntfy app on your phone is allowed to send notifications, and your watch's companion app whitelists ntfy.

### Apple Watch
Settings → Notifications → ntfy → enable "Mirror iPhone alerts" (or per-app: turn on Notifications → Allow Notifications).

### Wear OS (Pixel Watch, TicWatch, Fossil, etc.)
Phone → Wear OS / Pixel Watch app → Notifications → make sure ntfy is enabled.

### Samsung Galaxy Watch
Phone → Galaxy Wearable app → Notifications → manage app notifications → enable ntfy.

### Garmin
Garmin Connect → Notifications → App notifications → enable ntfy.

### Huawei (Health app)
Huawei Health → Devices → [your watch] → Notifications → toggle ntfy on. Make sure background app permissions for ntfy and Health are granted on the phone.

### Xiaomi / Amazfit (Zepp / Mi Fitness)
Zepp or Mi Fitness → Profile → [your watch] → App alerts → enable ntfy.

### Fitbit
Fitbit app → [your device] → Notifications → App notifications → enable ntfy.

If your watch isn't listed, the recipe is the same: open your watch's companion app on your phone, find "App notifications" or similar, and turn on ntfy.

## Hook setup

Add this block to your Claude Code `~/.claude/settings.json`:

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

Config file: `~/.claude-watch-notify.json`. Run `claude-watch-notify init` to create it interactively.

| Path | Type | Default | Meaning |
|---|---|---|---|
| `ntfy.topic` | string | (required) | The ntfy topic name. Anyone with this name can publish/read; pick something unguessable. |
| `ntfy.server` | string | `https://ntfy.sh` | Override for self-hosted ntfy. |
| `ntfy.authToken` | string \| null | `null` | Bearer token for protected topics. Never logged in plain text. |
| `filters.minDurationSeconds` | number | `30` | Skip Stop notifications for tasks shorter than this. Computed from transcript timestamps; if missing, the filter is skipped. |
| `filters.events` | string[] | `["Stop","Notification"]` | Allowlist of hook event names that should produce a notification. |
| `quietHours.enabled` | boolean | `false` | Master toggle. |
| `quietHours.start` | string | `"23:00"` | `HH:MM`, 24-hour. Cross-midnight ranges (e.g. `23:00`–`08:00`) work. |
| `quietHours.end` | string | `"08:00"` | `HH:MM`, exclusive. |
| `quietHours.allowHighPriority` | boolean | `true` | When in the quiet window, still send `Notification` (high-priority) events. |
| `summary.maxLength` | number | `100` | Truncate the notification body to this many characters. |
| `summary.includeProjectName` | boolean | `true` | Prepend the project folder basename to the notification title. |

## Troubleshooting

- **No notification at all** — run `claude-watch-notify test --dry-run` to inspect the payload, then `claude-watch-notify test` to actually send it. If the dry-run looks correct but `test` fails, check `ntfy.server`, `ntfy.topic`, and (if set) `authToken`.
- **Phone gets it but the watch doesn't** — open your watch's companion app on your phone (see "Smartwatch setup" above) and confirm ntfy is in the allowed-notifications list. Also check Do Not Disturb settings on the watch.
- **Hooks never fire** — run Claude Code with `claude --debug` and look for hook output. Make sure the path in `command` resolves (use the full path to the binary if `claude-watch-notify` isn't on Claude Code's `PATH`).
- **Body looks wrong or truncated** — adjust `summary.maxLength`. If the body is empty for `Stop` events, the transcript reader couldn't find a recent assistant message; this is harmless.
- **Notification arrived in the middle of the night** — enable `quietHours` and pick a sensible window. Set `allowHighPriority: false` if you want to silence input-needed alerts too.

## Security notes

- `authToken` is redacted (`[REDACTED]`) in `--dry-run` output and in any error messages written to stderr.
- Header values are sanitized to strip `\r` and `\n` (CRLF injection guard).
- The CLI does not exec a shell. All network IO is through Node's built-in `fetch`.
- The config file is written with mode `0600` so other users on the machine can't read your token.

## Contributing

Issues and PRs welcome. Keep modules small (≤ 200 lines), use ES modules, and don't add runtime dependencies — Node ≥18 has everything we need.

```bash
git clone https://github.com/<your-fork>/claude-watch-notify
cd claude-watch-notify
npm test
```

## License

[MIT](LICENSE)
