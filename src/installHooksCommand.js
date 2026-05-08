import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { installHooks } from './hookInstaller.js';

export async function runInstallHooks({ assumeYes = false } = {}) {
  const confirm = async () => {
    if (assumeYes) return true;
    const rl = createInterface({ input, output });
    try {
      const ans = (await rl.question('Apply these changes? [Y/n]: '))
        .trim()
        .toLowerCase();
      return ans === '' || ans === 'y' || ans === 'yes';
    } finally {
      rl.close();
    }
  };
  const result = await installHooks({ confirm });
  return result.ok ? 0 : 1;
}
