import { runInit } from './initCommand.js';
import { runInstallHooks } from './installHooksCommand.js';
import { runInstallSkill } from './installSkillCommand.js';
import { runTest } from './testCommand.js';
import { loadConfig } from './config.js';

export async function runSetup() {
  process.stdout.write(
    'claude-yo setup — runs init, installs hook/skill for the chosen mode, then sends a test.\n\n',
  );

  const initCode = await runInit();
  if (initCode !== 0) {
    process.stdout.write('\nsetup stopped at init.\n');
    return initCode;
  }

  const cfg = await loadConfig();
  const mode = cfg.ok ? (cfg.config.mode ?? 'on-demand') : 'on-demand';

  if (mode === 'on-demand') {
    process.stdout.write('\n— installing notify-on-demand skill —\n\n');
    const skillCode = await runInstallSkill({ assumeYes: true });
    if (skillCode !== 0) {
      process.stdout.write('\nsetup stopped at install-skill.\n');
      return skillCode;
    }
  } else {
    process.stdout.write('\n— installing Claude Code hooks —\n\n');
    const hookCode = await runInstallHooks();
    if (hookCode !== 0) {
      process.stdout.write('\nsetup stopped at install-hooks.\n');
      return hookCode;
    }
  }

  process.stdout.write('\n— sending test notification —\n\n');
  const testCode = await runTest();
  if (testCode !== 0) {
    process.stdout.write(
      '\ntest notification failed. Run "claude-yo doctor" to diagnose.\n',
    );
    return testCode;
  }

  process.stdout.write('\n✓ setup complete.\n');
  if (mode === 'on-demand') {
    process.stdout.write(
      `Tip: in any Claude Code conversation, just say "ping me when this is done".\n`,
    );
  } else if (mode === 'armed') {
    process.stdout.write(
      `Tip: run "claude-yo arm" before a long task; the next hook fires once.\n`,
    );
  }
  return 0;
}
