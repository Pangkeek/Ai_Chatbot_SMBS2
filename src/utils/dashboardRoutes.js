const tabs = new Set(["settings", "knowledge", "line", "conversations"]);

export function parseDashboardRoute(url) {
  const pathname = String(url).split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  if (pathname === "/app") return { shopId: null, tab: null };

  const match = /^\/app\/shops\/([^/]+)\/(settings|knowledge|line|conversations)$/.exec(pathname);
  if (!match) return null;

  try {
    const shopId = decodeURIComponent(match[1]);
    if (!shopId || shopId.includes("/")) return null;
    return { shopId, tab: match[2] };
  } catch {
    return null;
  }
}

export function shopRoute(shopId, tab = "settings") {
  if (!shopId || !tabs.has(tab)) throw new Error("Invalid shop route");
  return `/app/shops/${encodeURIComponent(shopId)}/${tab}`;
}
