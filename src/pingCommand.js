import { basename } from 'node:path';
import { loadConfig } from './config.js';
import * as providers from './providers.js';
import { summarize } from './summarizer.js';

function defaultTitle(includeProject) {
  if (!includeProject) return '✓ Done';
  const project = basename(process.cwd());
  if (!project) return '✓ Done';
  return `✓ ${project} - Done`;
}

export async function runPing({
  message = '',
  title = '',
  priority = 'default',
  dryRun = false,
} = {}) {
  const cfg = await loadConfig();
  if (!cfg.ok) {
    process.stderr.write(`✗ ${cfg.reason}\n`);
    process.stderr.write(
      `Run "claude-watch-notify init" to create a config first.\n`,
    );
    return 1;
  }

  const summaryCfg = cfg.config.summary ?? {};
  const maxLen = summaryCfg.maxLength ?? 100;
  const includeProject = summaryCfg.includeProjectName !== false;

  const notification = {
    title:
      summarize(title, maxLen) ||
      defaultTitle(includeProject),
    body: summarize(message, maxLen),
    priority,
    tags: ['white_check_mark', 'robot'],
  };

  if (dryRun) {
    const req = providers.buildRequest(cfg.config, notification);
    process.stdout.write(
      JSON.stringify(providers.redactRequest(cfg.config, req), null, 2) + '\n',
    );
    return 0;
  }

  const result = await providers.send(cfg.config, notification);
  if (!result.ok) {
    process.stderr.write(
      `✗ ping failed: ${result.error ?? result.status}\n`,
    );
    return 1;
  }
  process.stdout.write(
    `✓ pinged via ${providers.activeProviderName(cfg.config)}.\n`,
  );
  return 0;
}
