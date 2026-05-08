#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runFromHook } from '../src/index.js';
import { runInit } from '../src/initCommand.js';
import { runTest } from '../src/testCommand.js';
import { runInstallHooks } from '../src/installHooksCommand.js';
import { runInstallSkill } from '../src/installSkillCommand.js';
import { runSetup } from '../src/setupCommand.js';
import { runDoctor } from '../src/doctorCommand.js';
import { runPing } from '../src/pingCommand.js';
import { runArm, runDisarm, runArmStatus } from '../src/armCommand.js';
import { runMode } from '../src/modeCommand.js';
import { runUninstall } from '../src/uninstallCommand.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = {
    command: null,
    event: null,
    message: null,
    title: null,
    priority: null,
    dryRun: false,
    yes: false,
    help: false,
    version: false,
    positional: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--version' || a === '-v') args.version = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--yes' || a === '-y') args.yes = true;
    else if (a === '--event') args.event = argv[++i] ?? null;
    else if (a.startsWith('--event=')) args.event = a.slice('--event='.length);
    else if (a === '--message' || a === '-m') args.message = argv[++i] ?? null;
    else if (a.startsWith('--message='))
      args.message = a.slice('--message='.length);
    else if (a === '--title') args.title = argv[++i] ?? null;
    else if (a.startsWith('--title=')) args.title = a.slice('--title='.length);
    else if (a === '--priority') args.priority = argv[++i] ?? null;
    else if (a.startsWith('--priority='))
      args.priority = a.slice('--priority='.length);
    else if (!a.startsWith('-')) args.positional.push(a);
  }
  if (args.positional[0]) args.command = args.positional[0];
  return args;
}

function printHelp() {
  process.stdout.write(`claude-watch-notify - push notifications for Claude Code

Usage:
  claude-watch-notify setup                 One-shot init + (skill or hooks) + test
  claude-watch-notify init                  Interactive config setup
  claude-watch-notify ping [--message TXT]  Send a one-shot notification (used by the skill)
  claude-watch-notify arm [--message TXT]   Arm: next hook fires once (only in armed mode)
  claude-watch-notify disarm                Clear armed state
  claude-watch-notify mode [name]           Show or switch mode (on-demand | armed | always)
  claude-watch-notify install-hooks         Auto-merge hook block into ~/.claude/settings.json
  claude-watch-notify install-skill         Install the notify-on-demand skill
  claude-watch-notify uninstall             Remove hooks, skill, armed flag, and config
  claude-watch-notify test                  Send a test notification
  claude-watch-notify doctor                Check config, mode, hooks/skill, connectivity
  claude-watch-notify --event Stop          Used by Claude Code hooks (stdin = JSON)
  claude-watch-notify --dry-run             Print the request without sending
  claude-watch-notify --help                Show this help
  claude-watch-notify --version             Show version

Modes:
  on-demand  Notifications fire only via "ping" (or the notify-on-demand skill). Default.
  armed      Notifications fire only after "arm"; the next hook fires once and disarms.
  always     Notifications fire on every Stop/Notification hook (filtered by minDurationSeconds).

Flags:
  --message, -m   Message body for ping/arm
  --title         Title for ping
  --priority      Priority for ping (low | default | high | urgent)
  --yes, -y       Non-interactive: auto-confirm prompts
  --dry-run       Show what would be sent instead of sending
`);
}

async function readVersion() {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const raw = await readFile(pkgPath, 'utf8');
    return JSON.parse(raw).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return 0;
  }
  if (args.version) {
    process.stdout.write((await readVersion()) + '\n');
    return 0;
  }

  switch (args.command) {
    case 'init':
      return await runInit();
    case 'setup':
      return await runSetup();
    case 'install-hooks':
      return await runInstallHooks({ assumeYes: args.yes });
    case 'install-skill':
      return await runInstallSkill({ assumeYes: args.yes });
    case 'test':
      return await runTest({ dryRun: args.dryRun });
    case 'doctor':
      return await runDoctor();
    case 'ping':
      return await runPing({
        message: args.message ?? '',
        title: args.title ?? '',
        priority: args.priority ?? 'default',
        dryRun: args.dryRun,
      });
    case 'arm':
      return await runArm({ message: args.message ?? '' });
    case 'disarm':
      return await runDisarm();
    case 'arm-status':
      return await runArmStatus();
    case 'mode':
      return await runMode({ target: args.positional[1] ?? null });
    case 'uninstall':
      return await runUninstall({ assumeYes: args.yes });
  }

  // Default: hook handler. Always exit 0 so we never block Claude Code.
  await runFromHook({ event: args.event, dryRun: args.dryRun });
  return 0;
}

main()
  .then((code) => {
    process.exit(code ?? 0);
  })
  .catch((err) => {
    process.stderr.write(`✗ unexpected error: ${err?.message ?? err}\n`);
    process.exit(0);
  });
