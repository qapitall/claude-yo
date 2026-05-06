import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { randomBytes } from 'node:crypto';
import { DEFAULT_CONFIG, DEFAULT_CONFIG_PATH, saveConfig } from './config.js';

function suggestTopic() {
  return 'claude-watch-' + randomBytes(3).toString('hex');
}

async function ask(rl, prompt, defaultValue) {
  const hint = defaultValue ? ` [${defaultValue}]` : '';
  const answer = (await rl.question(`${prompt}${hint}: `)).trim();
  return answer === '' ? (defaultValue ?? '') : answer;
}

async function askYesNo(rl, prompt, defaultYes) {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = (await rl.question(`${prompt} ${hint}: `)).trim().toLowerCase();
  if (answer === '') return defaultYes;
  return answer === 'y' || answer === 'yes';
}

function settingsSnippet() {
  return JSON.stringify(
    {
      hooks: {
        Stop: [
          {
            matcher: '*',
            hooks: [
              {
                type: 'command',
                command: 'claude-watch-notify --event Stop',
                timeout: 8,
              },
            ],
          },
        ],
        Notification: [
          {
            matcher: '*',
            hooks: [
              {
                type: 'command',
                command: 'claude-watch-notify --event Notification',
                timeout: 8,
              },
            ],
          },
        ],
      },
    },
    null,
    2,
  );
}

export async function runInit() {
  const rl = createInterface({ input, output });
  output.write('claude-watch-notify init\n\n');
  output.write(
    'This will create ~/.claude-watch-notify.json and print the hook config to add to Claude Code.\n\n',
  );

  try {
    const topic = await ask(rl, 'ntfy topic', suggestTopic());
    const server = await ask(
      rl,
      'ntfy server (use https://ntfy.sh unless self-hosted)',
      DEFAULT_CONFIG.ntfy.server,
    );
    const tokenAns = await ask(
      rl,
      'ntfy auth token (leave empty for public topic)',
      '',
    );
    const minSec = await ask(
      rl,
      'minimum task duration before notifying (seconds)',
      String(DEFAULT_CONFIG.filters.minDurationSeconds),
    );
    const enableQuiet = await askYesNo(rl, 'enable quiet hours?', false);
    let quietStart = DEFAULT_CONFIG.quietHours.start;
    let quietEnd = DEFAULT_CONFIG.quietHours.end;
    if (enableQuiet) {
      quietStart = await ask(rl, 'quiet hours start (HH:MM)', quietStart);
      quietEnd = await ask(rl, 'quiet hours end (HH:MM)', quietEnd);
    }

    const config = {
      ntfy: {
        topic,
        server,
        authToken: tokenAns === '' ? null : tokenAns,
      },
      filters: {
        minDurationSeconds: Number.isFinite(Number(minSec))
          ? Number(minSec)
          : DEFAULT_CONFIG.filters.minDurationSeconds,
        events: [...DEFAULT_CONFIG.filters.events],
      },
      quietHours: {
        enabled: enableQuiet,
        start: quietStart,
        end: quietEnd,
        allowHighPriority: DEFAULT_CONFIG.quietHours.allowHighPriority,
      },
      summary: { ...DEFAULT_CONFIG.summary },
    };

    const path = await saveConfig(config, DEFAULT_CONFIG_PATH);
    output.write(`\n✓ wrote ${path}\n\n`);

    output.write('Next steps:\n');
    output.write(
      `  1. Install the ntfy app on your phone (https://ntfy.sh/app, App Store, or Play Store).\n`,
    );
    output.write(
      `  2. Subscribe to topic: ${topic}\n`,
    );
    output.write(
      `  3. Make sure your smartwatch's companion app mirrors notifications from ntfy (see README "Smartwatch setup").\n`,
    );
    output.write(
      `  4. Add the following to your Claude Code ~/.claude/settings.json:\n\n`,
    );
    output.write(settingsSnippet() + '\n\n');
    output.write(
      `  5. Send a test notification: claude-watch-notify test\n`,
    );
    return 0;
  } catch (err) {
    output.write(`\n⚠ init aborted: ${err?.message ?? err}\n`);
    return 1;
  } finally {
    rl.close();
  }
}
