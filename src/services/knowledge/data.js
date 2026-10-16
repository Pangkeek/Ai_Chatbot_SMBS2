export const PAGE_SIZE = 8;
const LOAD_SIZE = 100;

// ค้นหาและแบ่งหน้าโดยไม่แก้ข้อมูลต้นฉบับ
export function filterKnowledgeEntries(entries, filters) {
  const query = filters.query.trim().toLocaleLowerCase("th");
  return entries.filter((entry) => {
    const matchesQuery =
      !query ||
      entry.title.toLocaleLowerCase("th").includes(query) ||
      entry.content.toLocaleLowerCase("th").includes(query);
    const matchesKind = filters.kind === "all" || entry.kind === filters.kind;
    const matchesStatus =
      filters.status === "all" || entry.status === filters.status;
    return matchesQuery && matchesKind && matchesStatus;
  });
}

export function paginateKnowledgeEntries(entries, page, pageSize = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    entries: entries.slice(start, start + pageSize),
    page: safePage,
    pageCount,
    start,
  };
}

export async function fetchAllKnowledgeEntries({ shopId, apiRequest, signal }) {
  const all = [];
  let offset = 0;
  let total = 0;
  do {
    const payload = await apiRequest(
      `/shops/${encodeURIComponent(shopId)}/knowledge?limit=${LOAD_SIZE}&offset=${offset}`,
      { withMeta: true, signal }
    );
    all.push(...payload.data);
    total = payload.meta.total;
    if (payload.data.length === 0) break;
    offset += payload.data.length;
  } while (offset < total);
  return all;
}
