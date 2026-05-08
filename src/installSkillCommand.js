import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');

const SKILL_NAME = 'notify-on-demand';
const SOURCE_PATH = join(PACKAGE_ROOT, 'skills', SKILL_NAME, 'SKILL.md');
const DEFAULT_TARGET = join(homedir(), '.claude', 'skills', SKILL_NAME, 'SKILL.md');

async function fileExists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

export async function runInstallSkill({ assumeYes = false, target = DEFAULT_TARGET } = {}) {
  const sourceOk = await fileExists(SOURCE_PATH);
  if (!sourceOk) {
    process.stderr.write(`✗ skill source not found at ${SOURCE_PATH}\n`);
    return 1;
  }

  const exists = await fileExists(target);
  if (exists && !assumeYes) {
    process.stdout.write(
      `Skill already exists at ${target}.\nOverwrite? [y/N]: `,
    );
    const ans = await readOneLine();
    if (!/^y(es)?$/i.test(ans.trim())) {
      process.stdout.write(`aborted; left existing file alone.\n`);
      return 0;
    }
    // Backup
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await copyFile(target, `${target}.backup-${stamp}`).catch(() => {});
  }

  await mkdir(dirname(target), { recursive: true });
  const content = await readFile(SOURCE_PATH, 'utf8');
  await writeFile(target, content, 'utf8');
  process.stdout.write(`✓ wrote ${target}\n`);
  process.stdout.write(
    `Claude Code will pick up the skill on next session.\n`,
  );
  return 0;
}

function readOneLine() {
  return new Promise((resolve) => {
    let buf = '';
    const onData = (chunk) => {
      buf += chunk.toString();
      const nl = buf.indexOf('\n');
      if (nl >= 0) {
        process.stdin.off('data', onData);
        process.stdin.pause();
        resolve(buf.slice(0, nl));
      }
    };
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}
