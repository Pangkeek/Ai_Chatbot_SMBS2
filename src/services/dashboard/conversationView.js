export const modeLabels = { active: 'บอทเปิดทำงาน', paused: 'พักบอท', human: 'แอดมินดูแล' };
export const statusLabels = { open: 'เปิดอยู่', closed: 'ปิดแล้ว' };
const roleLabels = { customer: 'ลูกค้า', assistant: 'บอท', agent: 'แอดมิน', system: 'ระบบ' };
export const channelLabel = channel => channel === 'line' ? 'LINE' : 'เว็บ';
export const formatTime = value => new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
const number = value => Number(value).toLocaleString('th-TH');

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  // ข้อความลูกค้าและข้อความจาก API ต้องเป็น text เสมอ ไม่แปลงเป็น HTML
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderStatistics(section, stats) {
  for (const node of section.querySelectorAll('[data-stat]')) node.textContent = stats ? number(stats[node.dataset.stat]) : '—';
  section.querySelector('#conversation-stat-breakdown').textContent = stats
    ? `ห้อง LINE ${number(stats.line_conversations)} · ห้องเว็บ ${number(stats.web_conversations)} | ข้อความลูกค้า ${number(stats.customer_messages)} · บอท ${number(stats.assistant_messages)} · แอดมิน ${number(stats.agent_messages)} · ระบบ ${number(stats.system_messages)}` : '';
  section.querySelector('#conversation-updated').textContent = stats ? `อัปเดต ${formatTime(stats.generated_at)} (เวลาไทย) · ตรวจข้อมูลใหม่ทุก 15 วินาทีขณะเปิดหน้านี้` : '';
}

export function renderRooms(container, rows, selectedId, select) {
  container.replaceChildren();
  if (!rows.length) container.append(element('p', 'py-8 text-center text-sm text-slate-500', 'ไม่พบบทสนทนาตามเงื่อนไขที่เลือก'));
  for (const room of rows) {
    const button = element('button', 'w-full rounded-2xl border border-slate-200 p-3 text-left hover:bg-blue-50');
    button.type = 'button';
    button.id = `conversation-room-${room.id}`;
    button.dataset.conversationId = room.id;
    button.setAttribute('aria-pressed', String(room.id === selectedId));
    if (room.id === selectedId) button.classList.add('bg-blue-50', 'border-blue-500');
    button.append(element('p', 'break-words text-sm text-slate-900', room.customer_name));
    button.append(element('p', 'mt-1 text-xs text-slate-600', `${channelLabel(room.channel)} · ${statusLabels[room.status]} · ${modeLabels[room.bot_mode]}`));
    button.append(element('p', 'mt-2 truncate text-xs text-slate-500', room.last_message === null ? 'ยังไม่มีข้อความ' : room.last_message));
    button.append(element('p', 'mt-2 text-xs text-slate-400', `${number(room.message_count)} ข้อความ · ${formatTime(room.updated_at)}`));
    button.addEventListener('click', () => select(room.id));
    container.append(button);
  }
}

export function renderMessages(container, messages) {
  container.replaceChildren();
  if (!messages.length) container.append(element('p', 'py-8 text-center text-sm text-slate-500', 'ห้องนี้ยังไม่มีข้อความ'));
  for (const message of messages) {
    const color = message.role === 'assistant' ? 'border-blue-100 bg-blue-50'
      : message.role === 'agent' ? 'border-amber-100 bg-amber-50' : 'border-slate-200 bg-white';
    const bubble = element('article', `rounded-2xl border p-3 ${color}`);
    bubble.append(element('p', 'text-xs text-slate-500', `${roleLabels[message.role]} · ${formatTime(message.created_at)} (เวลาไทย)`));
    bubble.append(element('p', 'mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800', message.content));
    container.append(bubble);
  }
}

export function pageLabel(offset, count, total) {
  return total ? `${number(offset + 1)}–${number(offset + count)} จาก ${number(total)}` : '0 จาก 0';
}
