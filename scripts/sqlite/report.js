export function printTransferReport({ manifestPath, manifest }) {
  console.log(`SQLite ${manifest.mode}: ${manifest.status}`);
  console.log(`Target: ${manifest.target.hostname}:${manifest.target.port}/${manifest.target.database} (schema ${manifest.target.schema})`);
  console.log(`Source SHA-256: ${manifest.source.sha256}`);
  console.log(`Table counts: ${JSON.stringify(Object.fromEntries(Object.entries(manifest.source.tables).map(([table, stat]) => [table, stat.count])))}`);
  console.log(`Manifest: ${manifestPath}`);
}
