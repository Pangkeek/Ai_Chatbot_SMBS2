import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// The instrumentation runtime owns bounded shutdown; Next's default signal exit
// would otherwise terminate before the worker's asynchronous drain completes.
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '0.0.0.0'], {
  stdio: 'inherit', env: { ...process.env, NEXT_MANUAL_SIG_HANDLE: '1' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', () => { console.error('Server could not start'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
