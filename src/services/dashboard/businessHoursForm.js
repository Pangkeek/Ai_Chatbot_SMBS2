import { BUSINESS_DAYS, parseBusinessHours, formatBusinessHours } from "../../utils/businessHours.js";

function rows(form) {
  return [...form.querySelectorAll("[data-hours-day]")];
}

function showLegacyText(form, text) {
  const notice = form.querySelector("#settings-hours-legacy");
  notice.textContent = `เวลาที่บันทึกไว้: ${text} — เลือกวันและเวลาใหม่เมื่อต้องการเปลี่ยน`;
  notice.classList.toggle("hidden", !text);
}

export function fillBusinessHours(form, value) {
  const oldText = String(value || "").trim();
  const parsed = parseBusinessHours(oldText);
  form.dataset.originalHours = oldText;
  form.dataset.hoursChanged = "false";

  for (const row of rows(form)) {
    const hours = parsed?.[row.dataset.hoursDay];
    const [start, end] = hours ? hours.split("-") : ["09:00", "18:00"];
    row.querySelector("[data-hours-open]").checked = Boolean(hours);
    row.querySelector("[data-hours-start]").value = start;
    row.querySelector("[data-hours-end]").value = end;
  }
  showLegacyText(form, parsed === null ? oldText : "");
}

export function readBusinessHours(form) {
  // ยังไม่แตะค่าเก่าที่แปลงไม่ได้ จึงส่งค่าเดิมกลับไปเพื่อไม่ให้ข้อมูลหาย
  if (form.dataset.hoursChanged !== "true") return form.dataset.originalHours || "";

  const hours = {};
  for (const row of rows(form)) {
    if (!row.querySelector("[data-hours-open]").checked) continue;
    const start = row.querySelector("[data-hours-start]").value;
    const end = row.querySelector("[data-hours-end]").value;
    if (!start || !end || start === end) {
      throw new Error(`กรุณาตรวจสอบเวลาเปิดและเวลาปิดของวัน${BUSINESS_DAYS.find(([key]) => key === row.dataset.hoursDay)[1]}`);
    }
    hours[row.dataset.hoursDay] = `${start}-${end}`;
  }
  return formatBusinessHours(hours);
}

export function setupBusinessHoursForm(form, listen) {
  listen(form, "change", (event) => {
    if (!event.target.closest("[data-hours-day]")) return;
    form.dataset.hoursChanged = "true";
    showLegacyText(form, "");
  });

  listen(form, "click", (event) => {
    const preset = event.target.closest("[data-hours-preset]");
    if (!preset) return;
    const keys = BUSINESS_DAYS.map(([key]) => key);
    const selected = {
      everyday: keys,
      weekdays: keys.slice(0, 5),
      weekend: keys.slice(5),
      closed: [],
    }[preset.dataset.hoursPreset];
    for (const row of rows(form)) row.querySelector("[data-hours-open]").checked = selected.includes(row.dataset.hoursDay);
    form.dataset.hoursChanged = "true";
    showLegacyText(form, "");
  });
}
