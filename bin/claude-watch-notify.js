#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runFromHook } from '../src/index.js';
import { runInit } from '../src/initCommand.js';
import { runTest } from '../src/testCommand.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = {
    command: null,
    event: null,
    dryRun: false,
    help: false,
    version: false,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--version' || a === '-v') args.version = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--event') args.event = argv[++i] ?? null;
    else if (a.startsWith('--event=')) args.event = a.slice('--event='.length);
    else if (!a.startsWith('-')) positional.push(a);
  }
  if (positional[0]) args.command = positional[0];
  return args;
}

function printHelp() {
  process.stdout.write(`claude-watch-notify - smartwatch notifications for Claude Code

Usage:
  claude-watch-notify --event Stop          Send a notification for a Stop hook
  claude-watch-notify --event Notification  Send a notification for an input-needed hook
  claude-watch-notify init                  Interactive config setup
  claude-watch-notify test                  Send a test notification
  claude-watch-notify --dry-run             Print the request without sending
  claude-watch-notify --help                Show this help
  claude-watch-notify --version             Show version

In a hook, Claude Code pipes a JSON payload over stdin. The CLI never blocks
the hook: it always exits 0 and prints any errors to stderr.
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
  if (args.command === 'init') {
    return await runInit();
  }
  if (args.command === 'test') {
    return await runTest({ dryRun: args.dryRun });
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
