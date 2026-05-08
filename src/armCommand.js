import { arm, disarm, isArmed, readArmState } from './armState.js';
import { loadConfig } from './config.js';

export async function runArm({ message = '' } = {}) {
  const cfg = await loadConfig();
  if (cfg.ok) {
    const mode = cfg.config.mode ?? 'on-demand';
    if (mode !== 'armed') {
      process.stderr.write(
        `⚠ current mode is "${mode}" — armed flag will be ignored unless you switch.\n`,
      );
      process.stderr.write(
        `   Run: claude-watch-notify mode armed\n`,
      );
    }
  }
  const path = await arm(message);
  process.stdout.write(`✓ armed (${path})\n`);
  process.stdout.write(
    `Next Stop or Notification hook will fire and disarm itself.\n`,
  );
  return 0;
}

export async function runDisarm() {
  const removed = await disarm();
  if (removed) process.stdout.write(`✓ disarmed.\n`);
  else process.stdout.write(`(was not armed; nothing to do)\n`);
  return 0;
}

export async function runArmStatus() {
  const armed = await isArmed();
  if (!armed) {
    process.stdout.write(`disarmed\n`);
    return 0;
  }
  const state = await readArmState();
  process.stdout.write(`armed at ${state?.armedAt ?? 'unknown time'}\n`);
  if (state?.message) process.stdout.write(`message: ${state.message}\n`);
  return 0;
}
