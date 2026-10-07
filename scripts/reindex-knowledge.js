import { openDatabase } from '../src/lib/db.js';
import { rebuildKnowledgeIndex } from '../src/services/rag.js';

const db = openDatabase();
try {
  console.log(rebuildKnowledgeIndex(db));
} finally {
  db.close();
}
