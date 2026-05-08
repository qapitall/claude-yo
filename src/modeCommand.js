import { loadConfig, saveConfig, VALID_MODES } from './config.js';

export async function runMode({ target } = {}) {
  if (!target) {
    const cfg = await loadConfig();
    if (!cfg.ok) {
      process.stderr.write(`✗ ${cfg.reason}\n`);
      return 1;
    }
    process.stdout.write(`current mode: ${cfg.config.mode ?? 'on-demand'}\n`);
    process.stdout.write(`available: ${VALID_MODES.join(', ')}\n`);
    return 0;
  }
  if (!VALID_MODES.includes(target)) {
    process.stderr.write(
      `✗ unknown mode "${target}" (must be one of: ${VALID_MODES.join(', ')})\n`,
    );
    return 1;
  }
  const cfg = await loadConfig();
  if (!cfg.ok && cfg.reason !== 'config not found') {
    process.stderr.write(`✗ ${cfg.reason}\n`);
    return 1;
  }
  if (!cfg.ok) {
    process.stderr.write(
      `✗ no config yet — run "claude-yo init" first.\n`,
    );
    return 1;
  }
  cfg.config.mode = target;
  await saveConfig(cfg.config);
  process.stdout.write(`✓ mode set to "${target}"\n`);
  if (target === 'on-demand') {
    process.stdout.write(
      `   Notifications fire only when invoked via "claude-yo ping" (or via the notify-on-demand skill).\n`,
    );
  } else if (target === 'armed') {
    process.stdout.write(
      `   Notifications fire only after "claude-yo arm"; the next hook fires once and disarms.\n`,
    );
  } else {
    process.stdout.write(
      `   Notifications fire on every Stop/Notification hook (filtered by minDurationSeconds).\n`,
    );
  }
  return 0;
}
