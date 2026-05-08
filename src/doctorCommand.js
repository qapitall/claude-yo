import { readFile } from 'node:fs/promises';
import { loadConfig, DEFAULT_CONFIG_PATH } from './config.js';
import { DEFAULT_SETTINGS_PATH, HOOK_EVENTS } from './hookInstaller.js';
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
  report.push({
    ok: true,
    label: `config file at ${DEFAULT_CONFIG_PATH} (provider: ${providerName})`,
  });
  return cfg.config;
}

async function checkHooks(report) {
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
  await checkHooks(report);
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
      `\nIf your watch isn't getting notifications, see README "Smartwatch setup" for your watch brand.\n`,
    );
  }
  return allOk ? 0 : 1;
}
