---
name: notify-on-demand
description: Send a push notification via claude-yo when the user explicitly asks to be pinged, notified, or alerted when a task finishes. Trigger phrases include "ping me", "notify me when done", "let me know when this finishes", "alert me", and Turkish equivalents like "bitince haber ver", "tamam olunca bildir", "haber et".
---

# Notify on demand

This skill sends a one-shot push notification through the `claude-yo`
CLI. **Use it only when the user explicitly asks** to be pinged.

## When to invoke

The user says something like:
- "ping me when this is done"
- "notify me when it finishes"
- "let me know when X is ready"
- "alert me when the build is done"
- Turkish: "bitince haber ver", "tamam olunca bildir", "haber et"

If the user did not ask to be notified, do not use this skill.

## How to use

After completing the work the user asked for, and **right before your final
text reply for the turn**, run this Bash command:

```bash
claude-yo ping --message "<one-line summary, ≤100 chars>"
```

You can optionally pass `--title "<short title>"` to override the default
title (which is `✓ <project-folder> - Done`).

You can also pass `--priority high` for urgent attention or `--priority urgent`
for the noisiest tier.

## Rules

- Only ping when the user explicitly asked. Don't ping by default.
- Ping at most once per turn.
- The summary should be specific. Prefer "✓ tests passed (107/107)" over
  "done"; prefer "build succeeded, deploy URL: …" over "task complete".
- Do not include secrets, tokens, or long error stacks in the message. Keep
  it short.
- If `claude-yo` is not installed (the Bash call exits with
  `command not found`), say so once and continue without pinging.
- Don't ping for trivial responses (yes/no answers, simple confirmations).

## Examples

User: "Run the test suite and ping me when it's done."
You: (run tests) → `claude-yo ping --message "Tests passed: 107/107"` → final reply.

User: "Bu refactor'ı bitirdiğinde haber ver."
You: (do refactor) → `claude-yo ping --message "Refactor done, 4 files changed"` → final reply.

User: "What's 2+2?"
You: "4." (no ping — user didn't ask, and it's a trivial answer.)
