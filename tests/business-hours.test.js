import test from "node:test";
import assert from "node:assert/strict";
import { parseBusinessHours, formatBusinessHours } from "../src/utils/businessHours.js";

test("อ่านเวลาเดิมของร้านได้โดยไม่ทำข้อมูลหาย", () => {
  const everyDay = parseBusinessHours("ทุกวัน 08:00-18:00");
  assert.equal(Object.keys(everyDay).length, 7);
  assert.equal(everyDay.sunday, "08:00-18:00");

  const sixDays = parseBusinessHours("จันทร์-เสาร์ 09:00-19:00 ปิดวันอาทิตย์");
  assert.equal(sixDays.monday, "09:00-19:00");
  assert.equal(sixDays.sunday, undefined);
  assert.equal(parseBusinessHours("เปิดตามนัดหมาย"), null);
});

test("แปลงเวลาที่เลือกเป็นข้อความและอ่านกลับได้", () => {
  const hours = { monday: "09:00-18:00", sunday: "10:00-16:00" };
  assert.deepEqual(parseBusinessHours(formatBusinessHours(hours)), hours);
  assert.equal(formatBusinessHours({}), "ปิดทุกวัน");
});
