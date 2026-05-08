import { unlink, stat, rmdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { uninstallHooks, DEFAULT_SETTINGS_PATH } from './hookInstaller.js';
import { DEFAULT_CONFIG_PATH } from './config.js';
import { DEFAULT_ARM_PATH } from './armState.js';

const SKILL_PATH = join(
  homedir(),
  '.claude',
  'skills',
  'notify-on-demand',
  'SKILL.md',
);

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function tryUnlink(p) {
  try {
    await unlink(p);
    return true;
  } catch {
    return false;
  }
}

function makeConfirmer(rl, assumeYes) {
  return async (prompt) => {
    if (assumeYes) return true;
    const ans = (await rl.question(`${prompt} [y/N]: `)).trim().toLowerCase();
    return ans === 'y' || ans === 'yes';
  };
}

export async function runUninstall({ assumeYes = false } = {}) {
  output.write('claude-watch-notify uninstall\n\n');
  output.write('Will check the following items:\n');
  output.write(`  1. claude-watch-notify hooks in ${DEFAULT_SETTINGS_PATH}\n`);
  output.write(`  2. notify-on-demand skill at ${SKILL_PATH}\n`);
  output.write(`  3. armed flag at ${DEFAULT_ARM_PATH}\n`);
  output.write(`  4. config at ${DEFAULT_CONFIG_PATH}\n\n`);

  const rl = assumeYes ? null : createInterface({ input, output });
  try {
    const ask = makeConfirmer(rl, assumeYes);

    output.write('--- 1. Hooks ---\n');
    const proceedHooks = await ask('Remove claude-watch-notify hooks?');
    if (proceedHooks) {
      await uninstallHooks({
        confirm: async () => true,
        out: output,
        err: process.stderr,
      });
    } else {
      output.write('  skipped.\n');
    }

    output.write('\n--- 2. Skill ---\n');
    if (await exists(SKILL_PATH)) {
      const yes = await ask(`Delete ${SKILL_PATH}?`);
      if (yes) {
        const ok = await tryUnlink(SKILL_PATH);
        output.write(ok ? `  ✓ removed ${SKILL_PATH}\n` : `  (could not remove)\n`);
        // Try to clean the empty parent dir.
        await rmdir(dirname(SKILL_PATH)).catch(() => {});
      } else {
        output.write('  skipped.\n');
      }
    } else {
      output.write('  (not present)\n');
    }

    output.write('\n--- 3. Armed flag ---\n');
    if (await exists(DEFAULT_ARM_PATH)) {
      const yes = await ask(`Delete ${DEFAULT_ARM_PATH}?`);
      if (yes) {
        const ok = await tryUnlink(DEFAULT_ARM_PATH);
        output.write(ok ? `  ✓ removed ${DEFAULT_ARM_PATH}\n` : `  (could not remove)\n`);
      } else {
        output.write('  skipped.\n');
      }
    } else {
      output.write('  (not present)\n');
    }

    output.write('\n--- 4. Config ---\n');
    if (await exists(DEFAULT_CONFIG_PATH)) {
      const yes = await ask(`Delete ${DEFAULT_CONFIG_PATH}?`);
      if (yes) {
        const ok = await tryUnlink(DEFAULT_CONFIG_PATH);
        output.write(ok ? `  ✓ removed ${DEFAULT_CONFIG_PATH}\n` : `  (could not remove)\n`);
      } else {
        output.write('  skipped.\n');
      }
    } else {
      output.write('  (not present)\n');
    }

    output.write('\n✓ uninstall complete.\n');
    output.write('To remove the binary itself:\n');
    output.write('  npm uninstall -g claude-watch-notify\n');
    return 0;
  } finally {
    if (rl) rl.close();
  }
}
