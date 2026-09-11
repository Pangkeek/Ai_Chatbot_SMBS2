import { readFileSync, writeFileSync } from 'node:fs';
import { openapi } from '../src/contracts.mjs';
const path = new URL('../docs/openapi.json', import.meta.url);
const content = JSON.stringify(openapi, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== content) throw new Error('OpenAPI artifact is stale. Run node scripts/openapi.mjs');
  console.log('OpenAPI artifact matches the running API contract.');
} else {
  writeFileSync(path, content);
  console.log('Generated docs/openapi.json');
}
