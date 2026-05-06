import { loadConfig } from './config.js';
import { send, buildRequest, redactRequest } from './ntfy.js';

const TEST_NOTIFICATION = {
  title: '✓ claude-watch-notify - Test successful',
  body: 'If you see this on your watch, the bridge works.',
  priority: 'default',
  tags: ['white_check_mark', 'robot'],
};

const TROUBLESHOOTING = `If it doesn't appear on your watch, check:
  1. The ntfy app is installed and subscribed to the same topic.
  2. Your phone's smartwatch companion app allows ntfy notifications to mirror to the watch.
  3. Notifications are enabled on the watch for the ntfy app.
`;

export async function runTest({ dryRun = false } = {}) {
  const cfg = await loadConfig();
  if (!cfg.ok) {
    process.stderr.write(`✗ ${cfg.reason}\n`);
    process.stderr.write(
      `Run "claude-watch-notify init" to create a config first.\n`,
    );
    return 1;
  }

  if (dryRun) {
    const req = buildRequest(cfg.config.ntfy, TEST_NOTIFICATION);
    process.stdout.write(JSON.stringify(redactRequest(req), null, 2) + '\n');
    return 0;
  }

  const result = await send(cfg.config.ntfy, TEST_NOTIFICATION);
  if (!result.ok) {
    process.stderr.write(
      `✗ failed to send test notification: ${result.error ?? result.status}\n`,
    );
    return 1;
  }
  process.stdout.write('✓ Notification sent.\n');
  process.stdout.write(TROUBLESHOOTING);
  return 0;
}
