const outcomes = {
  sending: 'กำลังส่งไป LINE…',
  sent: 'LINE รับข้อความแล้ว (ไม่ใช่สถานะอ่าน)',
  failed: 'LINE ปฏิเสธข้อความ — ยังไม่ส่ง กรุณาตรวจการตั้งค่าแล้วลองใหม่',
  unknown: 'ยังยืนยันการส่งไม่ได้ — LINE อาจรับแล้ว ไม่ส่งซ้ำอัตโนมัติ กรุณาตรวจสอบใน LINE',
};

export function createHandoverManager({ node, listen, apiRequest, onUnauthorized, onChanged }) {
  let shopId = '', room = null, deliveries = [], busy = false, version = 0, request = null;
  function render() {
    const pending = deliveries.some(item => item.status === 'sending');
    const disabled = !room || room.status !== 'open' || busy || pending;
    for (const [id, mode] of [['takeover', 'human'], ['pause', 'paused'], ['resume', 'active']]) {
      node(id).disabled = disabled || room?.bot_mode === mode;
    }
    const canSend = !disabled && room.channel === 'line' && room.bot_mode !== 'active';
    node('reply').disabled = !canSend;
    node('send').disabled = !canSend;
    node('send').textContent = request ? 'ตรวจสถานะการส่ง' : 'ส่งไป LINE';
    node('composer-help').textContent = !room ? 'เลือกห้องสนทนาก่อนส่งข้อความ'
      : room.status !== 'open' ? 'ห้องนี้ปิดแล้ว ไม่สามารถส่งข้อความได้'
      : room.channel !== 'line' ? 'ห้องเว็บนี้เป็นประวัติทดสอบ ยังไม่รองรับการส่งออก'
      : room.bot_mode === 'active' ? 'รับช่วงหรือ Pause ก่อนส่ง เพื่อไม่ให้บอทตอบแทรก'
      : 'ส่งไปยังลูกค้า LINE ของห้องนี้ · Resume มีผลกับข้อความใหม่ ไม่ส่งคำตอบเก่าค้างไว้';
    node('deliveries').replaceChildren(...deliveries.map(item => {
      const entry = document.createElement('p');
      entry.className = 'break-words rounded-xl bg-slate-50 p-3';
      entry.textContent = `${outcomes[item.status]} · ${item.content}`;
      return entry;
    }));
  }
  function setRoom(nextShopId, nextRoom, nextDeliveries = []) {
    if (shopId !== nextShopId || room?.id !== nextRoom?.id) {
      version++; busy = false; request = null;
      node('reply').value = ''; node('action-status').textContent = '';
    }
    shopId = nextShopId; room = nextRoom; deliveries = nextDeliveries; render();
  }
  async function act(body, sending = false) {
    if (busy || !room) return;
    const current = version;
    const path = `/shops/${encodeURIComponent(shopId)}/conversations/${encodeURIComponent(room.id)}`;
    busy = true; render();
    node('action-status').textContent = sending ? 'กำลังส่งข้อความ…' : 'กำลังเปลี่ยนโหมด…';
    try {
      const result = await apiRequest(sending ? `${path}/replies` : path, { method: sending ? 'POST' : 'PATCH', body });
      if (current !== version) return;
      if (sending) {
        node('action-status').textContent = outcomes[result.status];
        if (result.status === 'sent') { node('reply').value = ''; request = null; }
        if (result.status === 'failed') request = null;
      } else node('action-status').textContent = 'เปลี่ยนโหมดแล้ว';
      await onChanged();
    } catch (error) {
      if (current !== version) return;
      node('action-status').textContent = sending
        ? `ยังยืนยันการส่งไม่ได้: ${error.message} กดตรวจสถานะก่อนส่งข้อความเดิมซ้ำ`
        : `เปลี่ยนโหมดไม่สำเร็จ: ${error.message}`;
      if (error.status === 401) onUnauthorized(error);
      // HTTP ปฏิเสธก่อนส่ง สามารถแก้เนื้อหาและเริ่มคำขอใหม่ได้
      if (sending && error.status >= 400 && error.status < 500) request = null;
    } finally { if (current === version) { busy = false; render(); } }
  }
  for (const [id, mode] of [['takeover', 'human'], ['pause', 'paused'], ['resume', 'active']]) {
    listen(node(id), 'click', () => { if (!node(id).disabled) void act({ bot_mode: mode }); });
  }
  listen(node('composer'), 'submit', event => {
    event.preventDefault();
    if (node('send').disabled) return;
    const content = node('reply').value.trim();
    if (!content) { node('action-status').textContent = 'กรุณาพิมพ์ข้อความก่อนส่ง'; return; }
    request ||= { request_id: crypto.randomUUID(), content };
    void act(request, true);
  });
  listen(node('reply'), 'input', () => {
    // เก็บกุญแจเดิมเมื่อเนื้อหาไม่เปลี่ยน ป้องกันส่งซ้ำหลังเครือข่ายขาด
    if (!busy && request && node('reply').value.trim() !== request.content) { request = null; render(); }
  });
  return { setRoom, reset() { setRoom('', null); } };
}
