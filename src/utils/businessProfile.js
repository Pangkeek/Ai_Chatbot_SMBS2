export const BUSINESS_TYPES = [
  ["food", "อาหารและเครื่องดื่ม"],
  ["retail", "ค้าปลีกและร้านค้าทั่วไป"],
  ["online", "ร้านค้าออนไลน์"],
  ["wholesale", "ค้าส่งและจัดจำหน่าย"],
  ["beauty", "ความงามและดูแลตัวเอง"],
  ["health", "สุขภาพและการแพทย์"],
  ["education", "การศึกษาและสอนพิเศษ"],
  ["finance", "การเงิน ประกัน และบัญชี"],
  ["property", "อสังหาริมทรัพย์"],
  ["construction", "ก่อสร้างและตกแต่ง"],
  ["automotive", "ยานยนต์และขนส่ง"],
  ["travel", "ท่องเที่ยวและที่พัก"],
  ["logistics", "จัดส่งและโลจิสติกส์"],
  ["technology", "เทคโนโลยีและดิจิทัล"],
  ["professional", "บริการวิชาชีพและที่ปรึกษา"],
  ["repair", "ซ่อมแซมและบริการช่าง"],
  ["agriculture", "เกษตรกรรมและอาหารแปรรูป"],
  ["manufacturing", "การผลิตและอุตสาหกรรม"],
  ["events", "บันเทิง กีฬา และอีเวนต์"],
  ["nonprofit", "องค์กรสาธารณะและไม่แสวงกำไร"],
  ["other", "อื่น ๆ"],
];

export const SERVICE_MODES = [
  ["store", "หน้าร้าน"],
  ["online", "ออนไลน์"],
  ["both", "หน้าร้านและออนไลน์"],
  ["onsite", "ไปให้บริการนอกสถานที่"],
  ["appointment", "ให้บริการตามนัดหมาย"],
];

const HEADER = "ข้อมูลธุรกิจ:";
const TYPE_LABEL = "ประเภทธุรกิจ: ";
const OFFERING_LABEL = "สินค้าหรือบริการหลัก: ";
const MODE_LABEL = "รูปแบบการให้บริการ: ";
const DETAILS_LABEL = "รายละเอียดเพิ่มเติมของธุรกิจ: ";

const labelOf = (choices, value) => choices.find(([key]) => key === value)?.[1] || "";
const keyOf = (choices, label) => choices.find(([, text]) => text === label)?.[0] || "";

export function parseBusinessProfile(value) {
  const text = String(value || "").trim();
  const empty = { type: "", otherType: "", offering: "", mode: "", details: "" };
  if (!text) return empty;

  // ข้อมูลแบบเดิมไม่มีหัวข้อ จึงเก็บไว้ในช่องรายละเอียดเพิ่มเติม
  if (!text.startsWith(`${HEADER}\n`)) return { ...empty, details: text };

  const lines = text.split("\n").slice(1);
  const result = { ...empty };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.startsWith(TYPE_LABEL)) {
      const typeName = line.slice(TYPE_LABEL.length);
      result.type = keyOf(BUSINESS_TYPES, typeName) || "other";
      result.otherType = result.type === "other" && typeName !== "อื่น ๆ" ? typeName : "";
    } else if (line.startsWith(OFFERING_LABEL)) {
      result.offering = line.slice(OFFERING_LABEL.length);
    } else if (line.startsWith(MODE_LABEL)) {
      result.mode = keyOf(SERVICE_MODES, line.slice(MODE_LABEL.length));
    } else if (line.startsWith(DETAILS_LABEL)) {
      result.details = [line.slice(DETAILS_LABEL.length), ...lines.slice(index + 1)].join("\n");
      break;
    }
  }
  return result;
}

export function formatBusinessProfile(profile) {
  const type = profile.type === "other"
    ? String(profile.otherType || "").trim()
    : labelOf(BUSINESS_TYPES, profile.type);
  const offering = String(profile.offering || "").trim();
  const mode = labelOf(SERVICE_MODES, profile.mode);
  const details = String(profile.details || "").trim();
  const lines = [
    type && `${TYPE_LABEL}${type}`,
    offering && `${OFFERING_LABEL}${offering}`,
    mode && `${MODE_LABEL}${mode}`,
    details && `${DETAILS_LABEL}${details}`,
  ].filter(Boolean);
  return lines.length ? `${HEADER}\n${lines.join("\n")}` : "";
}

export function summarizeBusinessProfile(value) {
  const profile = parseBusinessProfile(value);
  const type = profile.type === "other" ? profile.otherType : labelOf(BUSINESS_TYPES, profile.type);
  return [type, profile.offering].filter(Boolean).join(" · ") || profile.details || "ยังไม่ได้เพิ่มรายละเอียดร้าน";
}
