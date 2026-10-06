import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
// Run the installed CLI in this process so platform signals reach instrumentation
// directly, without an intermediate child that can exit before the worker drains.
const cli = require.resolve('next/dist/bin/next');
process.env.NEXT_MANUAL_SIG_HANDLE = '1';
process.argv = [process.execPath, cli, 'start', '--hostname', '0.0.0.0', ...process.argv.slice(2)];
await import(pathToFileURL(cli).href);
