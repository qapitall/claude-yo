import { loadConfig } from './config.js';
import * as providers from './providers.js';

const TEST_NOTIFICATION = {
  title: '✓ claude-watch-notify - Test successful',
  body: 'If you see this, the bridge works.',
  priority: 'default',
  tags: ['white_check_mark', 'robot'],
};

const TROUBLESHOOTING = `If it doesn't arrive on the device you expected:
  1. The notification provider's app is installed and signed in on that device.
  2. Notifications are enabled for that app on that device (no Do Not Disturb).
  3. If forwarding to another device, that device's mirroring rules allow this app.
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
    const req = providers.buildRequest(cfg.config, TEST_NOTIFICATION);
    process.stdout.write(
      JSON.stringify(providers.redactRequest(cfg.config, req), null, 2) + '\n',
    );
    return 0;
  }

  const result = await providers.send(cfg.config, TEST_NOTIFICATION);
  if (!result.ok) {
    process.stderr.write(
      `✗ failed to send test notification: ${result.error ?? result.status}\n`,
    );
    return 1;
  }
  process.stdout.write(
    `✓ Notification sent via ${providers.activeProviderName(cfg.config)}.\n`,
  );
  process.stdout.write(TROUBLESHOOTING);
  return 0;
}
