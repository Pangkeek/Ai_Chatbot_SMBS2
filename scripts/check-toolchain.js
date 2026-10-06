import { readFileSync } from 'node:fs';
const expectedNode = readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8').trim();
const { packageManager } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const expectedNpm = packageManager.slice('npm@'.length);
const actualNpm = process.env.npm_config_user_agent?.match(/^npm\/([^ ]+)/)?.[1];
if (process.version !== `v${expectedNode}` || actualNpm !== expectedNpm) {
  console.error(`Toolchain requires Node ${expectedNode} and npm ${expectedNpm}; run this check via the pinned npm version`);
  process.exitCode = 1;
} else console.log(`Toolchain OK: Node ${expectedNode}, npm ${expectedNpm}`);
