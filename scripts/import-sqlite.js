import { transferSqlite } from './sqlite/transfer.js';
import { printTransferReport } from './sqlite/report.js';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--dry-run') || args.length > 1) {
  console.error('Usage: npm run db:import:sqlite -- [--dry-run] (no force/reset flags supported)');
  process.exitCode = 1;
} else {
  try {
    const result = await transferSqlite({ mode: args.includes('--dry-run') ? 'dry-run' : 'import' });
    printTransferReport(result);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
