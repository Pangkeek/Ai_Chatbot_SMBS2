import { parseBusinessProfile, formatBusinessProfile } from "../../utils/businessProfile.js";

function fields(form) {
  return {
    type: form.querySelector("#settings-business-type"),
    otherType: form.querySelector("#settings-other-type"),
    otherTypeWrap: form.querySelector("#settings-other-type-wrap"),
    offering: form.querySelector("#settings-offering"),
    mode: form.querySelector("#settings-service-mode"),
    details: form.querySelector("#settings-description"),
  };
}

function showOtherType(form) {
  const { type, otherType, otherTypeWrap } = fields(form);
  const isOther = type.value === "other";
  otherTypeWrap.classList.toggle("hidden", !isOther);
  otherType.required = isOther;
}

export function fillBusinessProfile(form, value) {
  const profile = parseBusinessProfile(value);
  const controls = fields(form);
  controls.type.value = profile.type;
  controls.otherType.value = profile.otherType;
  controls.offering.value = profile.offering;
  controls.mode.value = profile.mode;
  controls.details.value = profile.details;
  form.dataset.originalDescription = value || "";
  form.dataset.descriptionChanged = "false";
  showOtherType(form);
}

export function readBusinessProfile(form) {
  // ถ้าแก้ส่วนอื่นของร้านแต่ไม่ได้แตะข้อมูลธุรกิจ ให้คงข้อความเดิมไว้
  if (form.dataset.descriptionChanged !== "true") return form.dataset.originalDescription || "";
  const controls = fields(form);
  return formatBusinessProfile({
    type: controls.type.value,
    otherType: controls.otherType.value,
    offering: controls.offering.value,
    mode: controls.mode.value,
    details: controls.details.value,
  });
}

export function setupBusinessProfileForm(form, listen) {
  const controls = fields(form);
  const editable = [controls.type, controls.otherType, controls.offering, controls.mode, controls.details];
  for (const field of editable) {
    listen(field, "input", () => {
      form.dataset.descriptionChanged = "true";
      if (field === controls.type) showOtherType(form);
    });
    listen(field, "change", () => {
      form.dataset.descriptionChanged = "true";
      if (field === controls.type) showOtherType(form);
    });
  }
}
