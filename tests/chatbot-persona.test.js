import test from "node:test";
import assert from "node:assert/strict";
import { parseChatbotPersona, formatChatbotPersona } from "../src/utils/chatbotPersona.js";

test("บุคลิกที่เลือกพร้อมรายละเอียดอ่านกลับได้", () => {
  const saved = formatChatbotPersona("อบอุ่นและใส่ใจ", "เรียกลูกค้าว่าคุณลูกค้า");
  assert.deepEqual(parseChatbotPersona(saved), {
    style: "อบอุ่นและใส่ใจ",
    details: "เรียกลูกค้าว่าคุณลูกค้า",
  });
});

test("บุคลิกข้อความเดิมยังแก้ต่อได้ในช่องรายละเอียด", () => {
  assert.deepEqual(parseChatbotPersona("ตอบสุภาพ กระชับ เป็นกันเอง"), {
    style: "สุภาพและเป็นกันเอง",
    details: "ตอบสุภาพ กระชับ เป็นกันเอง",
  });
});
