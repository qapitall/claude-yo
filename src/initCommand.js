import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { randomBytes } from 'node:crypto';
import { DEFAULT_CONFIG, DEFAULT_CONFIG_PATH, saveConfig } from './config.js';

function suggestTopic() {
  return 'cyo-' + randomBytes(8).toString('hex');
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

async function askChoice(rl, prompt, choices, defaultChoice) {
  while (true) {
    const ans = (
      await rl.question(`${prompt} (${choices.join('/')}) [${defaultChoice}]: `)
    )
      .trim()
      .toLowerCase();
    const value = ans === '' ? defaultChoice : ans;
    if (choices.includes(value)) return value;
    output.write(`  please answer one of: ${choices.join(', ')}\n`);
  }
}

async function configureNtfy(rl) {
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
  return {
    topic,
    server,
    authToken: tokenAns === '' ? null : tokenAns,
  };
}

async function configureDiscord(rl) {
  output.write(
    '\nTo get a Discord webhook URL: open Discord → server channel → Edit Channel → Integrations → Webhooks → "New Webhook" → "Copy Webhook URL".\n\n',
  );
  const webhookUrl = await ask(rl, 'discord webhook URL', '');
  return { webhookUrl: webhookUrl === '' ? null : webhookUrl };
}

async function configureTelegram(rl) {
  output.write(
    '\nTo get a Telegram bot token: open Telegram, talk to @BotFather, send /newbot, follow the prompts.\nTo get your chat ID: send /start to your new bot, then talk to @userinfobot or visit https://api.telegram.org/bot<TOKEN>/getUpdates.\n\n',
  );
  const botToken = await ask(rl, 'telegram bot token', '');
  const chatId = await ask(rl, 'telegram chat ID', '');
  return {
    botToken: botToken === '' ? null : botToken,
    chatId: chatId === '' ? null : chatId,
  };
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
                command: 'claude-yo --event Stop',
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
                command: 'claude-yo --event Notification',
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

function postInstallHints(provider, providerCfg, mode = 'on-demand') {
  output.write('\nNext steps:\n');
  if (provider === 'ntfy') {
    const url = `${providerCfg.server.replace(/\/+$/, '')}/${providerCfg.topic}`;
    output.write(`  1. Install the ntfy app: https://ntfy.sh/app\n`);
    output.write(`  2. Subscribe to your topic — open this URL on your device:\n`);
    output.write(`       ${url}\n`);
    output.write(
      `     The link opens the ntfy app (if installed) and prompts to subscribe.\n`,
    );
  } else if (provider === 'discord') {
    output.write(
      `  1. Notifications will appear in the Discord channel that owns the webhook,\n` +
        `     on every device signed in to that account.\n`,
    );
    output.write(
      `  2. Make sure notifications are enabled for Discord on that device.\n`,
    );
  } else if (provider === 'telegram') {
    output.write(
      `  1. Notifications will appear in the Telegram chat with your bot,\n` +
        `     on every device signed in to that account.\n`,
    );
    output.write(
      `  2. Make sure notifications are enabled for Telegram on that device.\n`,
    );
  }
  if (mode === 'on-demand') {
    output.write(
      `  3. Install the on-demand skill so Claude can ping you when you ask:\n`,
    );
    output.write(`       claude-yo install-skill\n`);
    output.write(
      `     Then in chat just say "ping me when this is done" and Claude will run\n` +
        `     "claude-yo ping" automatically at the end.\n`,
    );
  } else {
    output.write(
      `  3. Install the Claude Code hook automatically: claude-yo install-hooks\n`,
    );
    output.write(`     (or paste the snippet below into ~/.claude/settings.json):\n\n`);
    output.write(settingsSnippet() + '\n\n');
    if (mode === 'armed') {
      output.write(
        `     Mode "armed": run "claude-yo arm" before a long task; the next hook fires once.\n`,
      );
    }
  }
  output.write(
    `  4. Send a test notification: claude-yo test\n`,
  );
}

export async function runInit() {
  const rl = createInterface({ input, output });
  output.write('claude-yo init\n\n');
  output.write(
    'This will create ~/.claude-yo.json with your notification provider settings.\n\n',
  );

  try {
    output.write(
      'Mode controls when notifications fire:\n' +
        '  on-demand  — only when you (or Claude on your behalf) call `ping`. Recommended.\n' +
        '  armed      — only after `arm`; the next hook fires once and disarms.\n' +
        '  always     — every Stop/Notification hook (filtered by minDurationSeconds).\n\n',
    );
    const mode = await askChoice(
      rl,
      'Which mode?',
      ['on-demand', 'armed', 'always'],
      'on-demand',
    );

    const provider = await askChoice(
      rl,
      'Which provider?',
      ['ntfy', 'discord', 'telegram'],
      'ntfy',
    );

    let providerSection;
    if (provider === 'ntfy') providerSection = await configureNtfy(rl);
    else if (provider === 'discord') providerSection = await configureDiscord(rl);
    else providerSection = await configureTelegram(rl);

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
      mode,
      provider,
      ntfy: { ...DEFAULT_CONFIG.ntfy },
      discord: { ...DEFAULT_CONFIG.discord },
      telegram: { ...DEFAULT_CONFIG.telegram },
      [provider]: providerSection,
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
    output.write(`\n✓ wrote ${path}\n`);

    postInstallHints(provider, providerSection, mode);
    return 0;
  } catch (err) {
    output.write(`\n⚠ init aborted: ${err?.message ?? err}\n`);
    return 1;
  } finally {
    rl.close();
  }
}
