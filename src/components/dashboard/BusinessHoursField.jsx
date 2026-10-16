import { BUSINESS_DAYS } from "../../utils/businessHours.js";

export default function BusinessHoursField() {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-slate-700">เวลาเปิดให้บริการ</legend>
      <p className="mb-4 text-xs text-slate-500">เลือกวันที่เปิด แล้วกดเลือกเวลาเปิดและเวลาปิดของแต่ละวัน</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          ["everyday", "ทุกวัน"],
          ["weekdays", "จันทร์–ศุกร์"],
          ["weekend", "เสาร์–อาทิตย์"],
          ["closed", "ปิดทุกวัน"],
        ].map(([value, label]) => (
          <button key={value} type="button" data-hours-preset={value} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100">
            {label}
          </button>
        ))}
      </div>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
        {BUSINESS_DAYS.map(([key, label]) => (
          <div key={key} data-hours-day={key} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
            <label className="flex min-w-28 items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" data-hours-open className="size-4 accent-blue-600" />
              วัน{label}
            </label>
            <div className="ml-auto flex items-center gap-2 text-sm text-slate-500">
              <label className="sr-only" htmlFor={`hours-${key}-start`}>เวลาเปิดวัน{label}</label>
              <input id={`hours-${key}-start`} type="time" data-hours-start defaultValue="09:00" className="rounded-lg border border-slate-200 px-2 py-1.5 text-slate-700 focus:border-blue-500" />
              <span>ถึง</span>
              <label className="sr-only" htmlFor={`hours-${key}-end`}>เวลาปิดวัน{label}</label>
              <input id={`hours-${key}-end`} type="time" data-hours-end defaultValue="18:00" className="rounded-lg border border-slate-200 px-2 py-1.5 text-slate-700 focus:border-blue-500" />
            </div>
          </div>
        ))}
      </div>
      <p id="settings-hours-legacy" className="mt-3 hidden rounded-xl bg-amber-50 p-3 text-xs text-amber-900"></p>
      <p className="mt-2 text-xs text-slate-500">หากเวลาปิดน้อยกว่าเวลาเปิด ระบบจะถือว่าปิดในวันถัดไป</p>
    </fieldset>
  );
}
