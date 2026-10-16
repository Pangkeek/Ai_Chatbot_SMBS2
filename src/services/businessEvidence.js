import { BUSINESS_TYPES, SERVICE_MODES, parseBusinessProfile } from "../utils/businessProfile.js";

function selectedLabel(options, value) {
  return options.find(([key]) => key === value)?.[1] || "";
}

function chunks(text, size = 800) {
  const result = [];
  for (let start = 0; start < text.length; start += size) {
    result.push(text.slice(start, start + size));
  }
  return result;
}

// ข้อมูลร้านที่เจ้าของบันทึกเป็นหลักฐานได้ทันที โดยไม่ต้องทำดัชนีใหม่
export function buildBusinessEvidence(shop) {
  if (!shop) return [];
  const profile = parseBusinessProfile(shop.description);
  const type = profile.type === "other"
    ? profile.otherType
    : selectedLabel(BUSINESS_TYPES, profile.type);
  const mode = selectedLabel(SERVICE_MODES, profile.mode);
  const facts = [
    ["name", "ชื่อร้าน", shop.name],
    ["type", "ประเภทธุรกิจ", type],
    ["offering", "สินค้าหรือบริการหลัก", profile.offering],
    ["mode", "รูปแบบการให้บริการ", mode],
    ["hours", "เวลาเปิดให้บริการ", shop.opening_hours],
    ["details", "รายละเอียดธุรกิจ", profile.details],
  ];

  return facts.flatMap(([field, title, value]) => {
    if (!value?.trim()) return [];
    return chunks(`${title}: ${value.trim()}`).map((content, index) => ({
      chunk_id: `${shop.id}:business:${field}:${index}`,
      knowledge_entry_id: `${shop.id}:business-profile`,
      source_type: "business",
      source_field: field,
      title,
      content,
      full_content: content,
    }));
  });
}

export function matchesBusinessQuestion(query, field) {
  const patterns = {
    name: /(?:ชื่อร้าน|ร้านชื่อ|ชื่อธุรกิจ)/u,
    type: /(?:ประเภทธุรกิจ|ธุรกิจประเภท|ธุรกิจอะไร|ร้านประเภท|ร้านแบบไหน)/u,
    offering: /(?:ขายอะไร|สินค้าอะไร|บริการอะไร|มีอะไรขาย|ทำธุรกิจอะไร|สินค้าหรือบริการ)/u,
    mode: /(?:รูปแบบการให้บริการ|หน้าร้าน|ออนไลน์|นอกสถานที่|นัดหมาย)/u,
    hours: /(?:เปิดกี่โมง|ปิดกี่โมง|เวลาเปิด|เวลาปิด|เวลาทำการ|วันไหนเปิด|เปิดวันไหน)/u,
  };
  return patterns[field]?.test(query) || false;
}
