export const BUSINESS_DAYS = [
  ["monday", "จันทร์"],
  ["tuesday", "อังคาร"],
  ["wednesday", "พุธ"],
  ["thursday", "พฤหัสบดี"],
  ["friday", "ศุกร์"],
  ["saturday", "เสาร์"],
  ["sunday", "อาทิตย์"],
];

const timeRange = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/;

// ข้อความเดิมอาจมีรูปแบบต่างกัน ถ้าอ่านไม่ได้จะคืน null เพื่อเก็บค่าเดิมไว้
export function parseBusinessHours(value) {
  const text = String(value || "").trim();
  if (!text || text === "ปิดทุกวัน") return {};

  const everyday = text.match(/^ทุกวัน\s+(\d{2}:\d{2}-\d{2}:\d{2})$/);
  if (everyday) return Object.fromEntries(BUSINESS_DAYS.map(([key]) => [key, everyday[1]]));

  const mondayToSaturday = text.match(/^จันทร์-เสาร์\s+(\d{2}:\d{2}-\d{2}:\d{2})\s+ปิดวันอาทิตย์$/);
  if (mondayToSaturday) return Object.fromEntries(BUSINESS_DAYS.slice(0, 6).map(([key]) => [key, mondayToSaturday[1]]));

  const result = {};
  for (const part of text.split(/,\s*/)) {
    const day = BUSINESS_DAYS.find(([, label]) => part.startsWith(`วัน${label} `));
    if (!day) return null;
    const hours = part.slice(`วัน${day[1]} `.length);
    if (!timeRange.test(hours) || result[day[0]]) return null;
    result[day[0]] = hours;
  }
  return result;
}

export function formatBusinessHours(hours) {
  const openDays = BUSINESS_DAYS.filter(([key]) => hours[key]);
  if (openDays.length === 0) return "ปิดทุกวัน";
  return openDays.map(([key, label]) => `วัน${label} ${hours[key]}`).join(", ");
}
