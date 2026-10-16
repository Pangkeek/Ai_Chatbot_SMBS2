import test from "node:test";
import assert from "node:assert/strict";
import {
  BUSINESS_TYPES,
  parseBusinessProfile,
  formatBusinessProfile,
  summarizeBusinessProfile,
} from "../src/utils/businessProfile.js";

test("หมวดอื่น ๆ รองรับธุรกิจที่ไม่มีในรายการ", () => {
  assert.ok(BUSINESS_TYPES.some(([key]) => key === "other"));
  const profile = {
    type: "other",
    otherType: "สตูดิโอออกแบบเสียง",
    offering: "บันทึกเสียงโฆษณา",
    mode: "appointment",
    details: "รับงานตามคิว\nติดต่อก่อนเข้าร้าน",
  };
  const saved = formatBusinessProfile(profile);
  assert.deepEqual(parseBusinessProfile(saved), profile);
  assert.equal(summarizeBusinessProfile(saved), "สตูดิโอออกแบบเสียง · บันทึกเสียงโฆษณา");
});

test("ข้อมูลเดิมย้ายมาแสดงในรายละเอียดเพิ่มเติม", () => {
  const oldText = "ร้านกาแฟและเบเกอรี มีบริการนั่งที่ร้าน";
  assert.deepEqual(parseBusinessProfile(oldText), {
    type: "",
    otherType: "",
    offering: "",
    mode: "",
    details: oldText,
  });
  assert.equal(summarizeBusinessProfile(oldText), oldText);
});

test("ข้อมูลธุรกิจที่เลือกจากรายการอ่านกลับได้", () => {
  const profile = {
    type: "food",
    otherType: "",
    offering: "กาแฟและเบเกอรี",
    mode: "both",
    details: "มีบริการซื้อกลับบ้าน",
  };
  assert.deepEqual(parseBusinessProfile(formatBusinessProfile(profile)), profile);
});
