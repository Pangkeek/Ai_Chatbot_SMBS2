import { parseChatbotPersona } from "../utils/chatbotPersona.js";

const openings = {
  "สุภาพและเป็นกันเอง": "ยินดีครับ ",
  "อบอุ่นและใส่ใจ": "ยินดีช่วยดูให้นะครับ ",
  "กระชับและตรงประเด็น": "",
  "สดใสและสนุกสนาน": "ได้เลย! ",
  "ทางการและมืออาชีพ": "ข้อมูลของทางร้านมีดังนี้: ",
};

export function formatChatbotReply(answer, personaText) {
  // คำตอบเมื่อไม่มีหลักฐานต้องคงเดิม และไม่เติมข้อความที่ทำให้ดูเหมือนยืนยันข้อมูลได้
  if (answer.method === "no_evidence" || answer.method === "handover") return answer.text;
  const { style } = parseChatbotPersona(personaText);
  return `${openings[style] || ""}${answer.text}`;
}
