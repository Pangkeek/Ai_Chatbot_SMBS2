import { transferSqlite } from './sqlite/transfer.js';
import { printTransferReport } from './sqlite/report.js';

if (process.argv.length > 2) { console.error('Usage: npm run db:verify:import'); process.exitCode = 1; }
else {
  try { printTransferReport(await transferSqlite({ mode: 'verify' })); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
