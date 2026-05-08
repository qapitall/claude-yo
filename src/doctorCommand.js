import { readFile } from 'node:fs/promises';
import { loadConfig, DEFAULT_CONFIG_PATH } from './config.js';
import { DEFAULT_SETTINGS_PATH, HOOK_EVENTS } from './hookInstaller.js';
import { isArmed, readArmState, DEFAULT_ARM_PATH } from './armState.js';
import * as providers from './providers.js';

const TEST_NOTIFICATION = {
  title: '✓ claude-watch-notify - doctor check',
  body: 'doctor command verified the bridge.',
  priority: 'default',
  tags: ['white_check_mark', 'robot'],
};

function tick(ok) {
  return ok ? '✓' : '✗';
}

async function checkConfig(report) {
  const cfg = await loadConfig();
  if (!cfg.ok) {
    report.push({
      ok: false,
      label: `config file at ${DEFAULT_CONFIG_PATH}`,
      hint:
        cfg.reason === 'config not found'
          ? 'Run: claude-watch-notify init'
          : `Reason: ${cfg.reason}`,
    });
    return null;
  }
  const providerName = providers.activeProviderName(cfg.config);
  const mode = cfg.config.mode ?? 'on-demand';
  report.push({
    ok: true,
    label: `config file at ${DEFAULT_CONFIG_PATH} (mode: ${mode}, provider: ${providerName})`,
  });
  return cfg.config;
}

async function checkSkill(config, report) {
  const mode = config?.mode ?? 'on-demand';
  if (mode !== 'on-demand') return;
  const { homedir } = await import('node:os');
  const { join } = await import('node:path');
  const skillPath = join(
    homedir(),
    '.claude',
    'skills',
    'notify-on-demand',
    'SKILL.md',
  );
  try {
    await readFile(skillPath);
    report.push({ ok: true, label: `notify-on-demand skill at ${skillPath}` });
  } catch {
    report.push({
      ok: false,
      label: `notify-on-demand skill at ${skillPath}`,
      hint: 'Run: claude-watch-notify install-skill',
    });
  }
}

async function checkArmedState(config, report) {
  if ((config?.mode ?? 'on-demand') !== 'armed') return;
  const armed = await isArmed();
  if (armed) {
    const state = await readArmState();
    report.push({
      ok: true,
      label: `armed at ${state?.armedAt ?? 'unknown time'} (${DEFAULT_ARM_PATH})`,
    });
  } else {
    report.push({
      ok: true,
      label: `not currently armed (run "arm" before your next long task)`,
    });
  }
}

async function checkHooks(config, report) {
  const mode = config?.mode ?? 'on-demand';
  if (mode === 'on-demand') return;
  let raw;
  try {
    raw = await readFile(DEFAULT_SETTINGS_PATH, 'utf8');
  } catch {
    report.push({
      ok: false,
      label: `hooks installed in ${DEFAULT_SETTINGS_PATH}`,
      hint: 'Run: claude-watch-notify install-hooks',
    });
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    report.push({
      ok: false,
      label: `hooks installed in ${DEFAULT_SETTINGS_PATH}`,
      hint: 'settings.json is not valid JSON; fix it before installing hooks',
    });
    return;
  }
  const found = HOOK_EVENTS.filter((ev) => {
    const list = parsed?.hooks?.[ev];
    if (!Array.isArray(list)) return false;
    return list.some((entry) =>
      Array.isArray(entry?.hooks) &&
      entry.hooks.some(
        (h) =>
          typeof h?.command === 'string' &&
          h.command.includes('claude-watch-notify'),
      ),
    );
  });
  if (found.length === HOOK_EVENTS.length) {
    report.push({
      ok: true,
      label: `hooks installed in ${DEFAULT_SETTINGS_PATH} (${found.join(', ')})`,
    });
  } else {
    const missing = HOOK_EVENTS.filter((e) => !found.includes(e));
    report.push({
      ok: false,
      label: `hooks installed in ${DEFAULT_SETTINGS_PATH}`,
      hint: `missing for: ${missing.join(', ')}. Run: claude-watch-notify install-hooks`,
    });
  }
}

async function checkSend(config, report) {
  if (!config) return;
  const result = await providers.send(config, TEST_NOTIFICATION);
  if (result.ok) {
    report.push({
      ok: true,
      label: `test notification sent (status ${result.status})`,
    });
  } else {
    report.push({
      ok: false,
      label: `test notification`,
      hint: `failed: ${result.error ?? `status ${result.status}`}`,
    });
  }
}

export async function runDoctor({ skipSend = false } = {}) {
  process.stdout.write('claude-watch-notify doctor\n\n');
  const report = [];

  const config = await checkConfig(report);
  await checkSkill(config, report);
  await checkHooks(config, report);
  await checkArmedState(config, report);
  if (!skipSend) await checkSend(config, report);

  for (const r of report) {
    process.stdout.write(`[${tick(r.ok)}] ${r.label}\n`);
    if (!r.ok && r.hint) process.stdout.write(`    ${r.hint}\n`);
  }

  const allOk = report.every((r) => r.ok);
  process.stdout.write(
    `\n${allOk ? '✓ everything looks good.' : '✗ one or more checks failed (see above).'}\n`,
  );
  if (allOk) {
    process.stdout.write(
      `\nIf the notification didn't reach the device you expected, that's a provider-app setting on that device (notification permission, Do Not Disturb, mirroring rules) — see README "Troubleshooting".\n`,
    );
  }
  return allOk ? 0 : 1;
}
