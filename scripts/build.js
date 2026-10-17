import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'build', '--webpack'], {
  stdio: 'inherit', env: { ...process.env, LINE_WORKER_ENABLED: 'false', NEXT_MANUAL_SIG_HANDLE: '' },
});
child.on('error', () => { console.error('Build could not start'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
