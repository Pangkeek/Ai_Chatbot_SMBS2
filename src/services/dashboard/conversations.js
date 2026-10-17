import { renderStatistics, renderRooms, renderMessages, pageLabel, modeLabels, statusLabels, channelLabel } from './conversationView.js';

const ROOM_LIMIT = 20;
const MESSAGE_LIMIT = 50;

export function createConversationsManager({ listen, apiRequest, onUnauthorized }) {
  const section = document.getElementById('conversations-section');
  const node = id => section.querySelector(`#conversation-${id}`);
  let shopId = '', active = false, offset = 0, messageOffset = 0, selectedId = '';
  let rooms = [], roomTotal = 0, messageTotal = 0, filters = {}, followLatest = true;
  let listVersion = 0, detailVersion = 0, listController, detailController, timer;

  const hide = (target, value) => target.classList.toggle('hidden', value);
  const base = () => `/shops/${encodeURIComponent(shopId)}`;
  function showError(target, error) {
    target.textContent = `โหลดไม่สำเร็จ: ${error.message} กรุณากดรีเฟรชข้อมูลเพื่อลองอีกครั้ง`;
    hide(target, false);
    if (error.status === 401) onUnauthorized(error);
  }
  function cancel() {
    clearTimeout(timer);
    listVersion++; detailVersion++;
    listController?.abort(); detailController?.abort();
  }
  function clearDetail() {
    detailVersion++; detailController?.abort();
    selectedId = ''; messageOffset = 0; messageTotal = 0;
    node('detail-title').textContent = 'เลือกห้องเพื่ออ่านประวัติ';
    node('detail-meta').textContent = '';
    node('messages').replaceChildren();
    node('message-page').textContent = '';
    hide(node('detail-error'), true);
    node('messages-prev').disabled = true;
    node('messages-next').disabled = true;
    node('messages').setAttribute('aria-busy', 'false');
  }
  function reset() {
    active = false; cancel(); shopId = ''; offset = 0; filters = {}; rooms = []; roomTotal = 0;
    node('filters').reset(); clearDetail(); renderStatistics(section, null);
    node('list').replaceChildren(); node('list-page').textContent = '';
    node('load-status').textContent = ''; hide(node('load-error'), true);
    node('list-prev').disabled = true; node('list-next').disabled = true;
    node('list').setAttribute('aria-busy', 'false');
  }
  function renderList() {
    renderRooms(node('list'), rooms, selectedId, selectRoom);
    node('list-page').textContent = pageLabel(offset, rooms.length, roomTotal);
    node('list-prev').disabled = offset === 0;
    node('list-next').disabled = offset + ROOM_LIMIT >= roomTotal;
  }
  async function loadMessages() {
    if (!active || !shopId || !selectedId) return;
    const version = ++detailVersion;
    detailController?.abort(); detailController = new AbortController();
    const signal = detailController.signal;
    const path = `${base()}/conversations/${encodeURIComponent(selectedId)}`;
    node('messages').setAttribute('aria-busy', 'true');
    hide(node('detail-error'), true);
    node('messages-prev').disabled = true; node('messages-next').disabled = true;
    try {
      let [room, result] = await Promise.all([
        apiRequest(path, { signal }),
        apiRequest(`${path}/messages?limit=${MESSAGE_LIMIT}&offset=${messageOffset}`, { signal, withMeta: true }),
      ]);
      if (version !== detailVersion) return;
      const lastOffset = Math.max(0, Math.floor((result.meta.total - 1) / MESSAGE_LIMIT) * MESSAGE_LIMIT);
      const targetOffset = followLatest ? lastOffset : Math.min(messageOffset, lastOffset);
      if (targetOffset !== messageOffset) {
        messageOffset = targetOffset;
        result = await apiRequest(`${path}/messages?limit=${MESSAGE_LIMIT}&offset=${messageOffset}`, { signal, withMeta: true });
      }
      if (version !== detailVersion) return;
      messageTotal = result.meta.total;
      node('detail-title').textContent = room.customer_name;
      node('detail-meta').textContent = `${channelLabel(room.channel)} · ${room.customer_external_id} · ${statusLabels[room.status]} · ${modeLabels[room.bot_mode]}`;
      renderMessages(node('messages'), result.data);
      node('message-page').textContent = pageLabel(messageOffset, result.data.length, messageTotal);
      node('messages-prev').disabled = messageOffset === 0;
      node('messages-next').disabled = messageOffset + MESSAGE_LIMIT >= messageTotal;
    } catch (error) {
      if (version !== detailVersion || signal.aborted) return;
      node('messages').replaceChildren(); node('message-page').textContent = '';
      showError(node('detail-error'), error);
    } finally {
      if (version === detailVersion) node('messages').setAttribute('aria-busy', 'false');
    }
  }
  function selectRoom(id) {
    clearDetail(); selectedId = id; followLatest = true;
    renderList(); node('detail-title').textContent = 'กำลังโหลดประวัติ…';
    void loadMessages();
  }
  async function refresh() {
    if (!active || !shopId) return;
    clearTimeout(timer);
    const version = ++listVersion;
    listController?.abort(); listController = new AbortController();
    const signal = listController.signal;
    node('load-status').textContent = 'กำลังโหลดข้อมูล…';
    hide(node('load-error'), true);
    node('list').setAttribute('aria-busy', 'true');
    node('list-prev').disabled = true; node('list-next').disabled = true;
    const query = new URLSearchParams({ ...filters, limit: ROOM_LIMIT, offset });
    try {
      let [stats, result] = await Promise.all([
        apiRequest(`${base()}/statistics`, { signal }),
        apiRequest(`${base()}/conversations?${query}`, { signal, withMeta: true }),
      ]);
      if (version !== listVersion) return;
      // ห้องอาจถูกลบจากอีกหน้าหนึ่ง จึงปรับกลับหน้าสุดท้ายที่ยังมีอยู่
      const lastOffset = Math.max(0, Math.floor((result.meta.total - 1) / ROOM_LIMIT) * ROOM_LIMIT);
      if (offset > lastOffset) {
        offset = lastOffset; query.set('offset', offset);
        result = await apiRequest(`${base()}/conversations?${query}`, { signal, withMeta: true });
      }
      if (version !== listVersion) return;
      rooms = result.data; roomTotal = result.meta.total;
      renderStatistics(section, stats); renderList();
      node('load-status').textContent = '';
      await loadMessages();
    } catch (error) {
      if (version !== listVersion || signal.aborted) return;
      rooms = []; roomTotal = 0; node('list').replaceChildren(); node('list-page').textContent = '';
      renderStatistics(section, null); node('load-status').textContent = '';
      showError(node('load-error'), error);
    } finally {
      if (version === listVersion) {
        node('list').setAttribute('aria-busy', 'false');
        if (active && !document.hidden) timer = setTimeout(refresh, 15000);
      }
    }
  }
  function setActive(value) {
    active = value;
    if (value) void refresh(); else cancel();
  }
  function setShop(shop) {
    if (shop.id === shopId) return;
    reset(); shopId = shop.id;
  }
  listen(node('filters'), 'submit', event => {
    event.preventDefault();
    filters = {};
    for (const [field, input] of [['search', 'search'], ['channel', 'channel'], ['status', 'status'], ['bot_mode', 'mode']]) {
      const value = node(input).value.trim();
      if (value) filters[field] = value;
    }
    offset = 0; clearDetail(); void refresh();
  });
  listen(node('clear'), 'click', () => {
    node('filters').reset(); filters = {}; offset = 0; clearDetail(); void refresh();
  });
  listen(node('refresh'), 'click', () => void refresh());
  listen(node('list-prev'), 'click', () => { offset = Math.max(0, offset - ROOM_LIMIT); void refresh(); });
  listen(node('list-next'), 'click', () => { offset += ROOM_LIMIT; void refresh(); });
  listen(node('messages-prev'), 'click', () => { followLatest = false; messageOffset = Math.max(0, messageOffset - MESSAGE_LIMIT); void loadMessages(); });
  listen(node('messages-next'), 'click', () => { messageOffset += MESSAGE_LIMIT; followLatest = messageOffset + MESSAGE_LIMIT >= messageTotal; void loadMessages(); });
  listen(document, 'visibilitychange', () => {
    if (!active) return;
    if (document.hidden) cancel(); else void refresh();
  });
  return { setShop, setActive, reset };
}
