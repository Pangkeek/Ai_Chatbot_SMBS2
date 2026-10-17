import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const expectedNode = readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8').trim();
const { packageManager } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const expectedNpm = packageManager.slice('npm@'.length);
// npm exec can preserve the outer npm's user agent. Inspect the executing CLI instead.
let actualNpm;
try {
  const npmPackage = JSON.parse(readFileSync(resolve(dirname(process.env.npm_execpath), '../package.json'), 'utf8'));
  if (npmPackage.name === 'npm') actualNpm = npmPackage.version;
} catch {
  // Missing or unrecognized CLI must fail the version check.
}
if (process.version !== `v${expectedNode}` || actualNpm !== expectedNpm) {
  console.error(`Toolchain requires Node ${expectedNode} and npm ${expectedNpm}; run this check via the pinned npm version`);
  process.exitCode = 1;
} else console.log(`Toolchain OK: Node ${expectedNode}, npm ${expectedNpm}`);
