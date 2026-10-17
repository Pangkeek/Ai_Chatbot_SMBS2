import { openDatabase } from '../src/lib/db.js';
import { rebuildKnowledgeIndex } from '../src/services/rag.js';

const db = await openDatabase();
try {
  console.log(await rebuildKnowledgeIndex(db));
} finally {
  await db.close();
}
