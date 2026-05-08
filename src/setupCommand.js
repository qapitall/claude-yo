import { runInit } from './initCommand.js';
import { runInstallHooks } from './installHooksCommand.js';
import { runTest } from './testCommand.js';

export async function runSetup() {
  process.stdout.write(
    'claude-watch-notify setup — runs init, install-hooks, then test in one go.\n\n',
  );

  const initCode = await runInit();
  if (initCode !== 0) {
    process.stdout.write('\nsetup stopped at init.\n');
    return initCode;
  }

  process.stdout.write('\n— installing Claude Code hooks —\n\n');
  const hookCode = await runInstallHooks();
  if (hookCode !== 0) {
    process.stdout.write('\nsetup stopped at install-hooks.\n');
    return hookCode;
  }

  process.stdout.write('\n— sending test notification —\n\n');
  const testCode = await runTest();
  if (testCode !== 0) {
    process.stdout.write(
      '\ntest notification failed. Run "claude-watch-notify doctor" to diagnose.\n',
    );
    return testCode;
  }

  process.stdout.write('\n✓ setup complete.\n');
  return 0;
}
