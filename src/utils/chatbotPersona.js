export const CHATBOT_PERSONA_STYLES = [
  ["สุภาพและเป็นกันเอง", "เหมาะกับร้านค้าทั่วไป ตอบอย่างสุภาพและเข้าถึงง่าย"],
  ["อบอุ่นและใส่ใจ", "เหมาะกับบริการที่อยากดูแลลูกค้าอย่างใกล้ชิด"],
  ["กระชับและตรงประเด็น", "เหมาะกับลูกค้าที่ต้องการคำตอบรวดเร็ว"],
  ["สดใสและสนุกสนาน", "เหมาะกับแบรนด์ที่มีโทนคุยแบบร่าเริง"],
  ["ทางการและมืออาชีพ", "เหมาะกับบริการที่ต้องการความน่าเชื่อถือ"],
];

const defaultStyle = CHATBOT_PERSONA_STYLES[0][0];

export function parseChatbotPersona(value) {
  const text = String(value || "").trim();
  if (!text) return { style: defaultStyle, details: "" };

  const [firstLine, ...otherLines] = text.split("\n");
  const style = firstLine.replace(/^บุคลิก: /, "");
  if (CHATBOT_PERSONA_STYLES.some(([option]) => option === style)) {
    return {
      style,
      details: otherLines.join("\n").replace(/^รายละเอียดเพิ่มเติม: /, "").trim(),
    };
  }

  // ข้อมูลเดิมเป็นข้อความอิสระ นำมาไว้ช่องเพิ่มเติมเพื่อให้ผู้ใช้แก้ต่อได้
  return { style: defaultStyle, details: text };
}

export function formatChatbotPersona(style, details) {
  const selected = CHATBOT_PERSONA_STYLES.some(([option]) => option === style) ? style : defaultStyle;
  const extra = String(details || "").trim();
  return extra ? `บุคลิก: ${selected}\nรายละเอียดเพิ่มเติม: ${extra}` : `บุคลิก: ${selected}`;
}
