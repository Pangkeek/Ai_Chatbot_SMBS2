import { BUSINESS_TYPES, SERVICE_MODES } from "../../utils/businessProfile.js";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

export default function BusinessProfileFields() {
  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
      <div>
        <label htmlFor="settings-business-type" className="mb-2 block text-sm font-semibold text-slate-700">ประเภทธุรกิจ</label>
        <select id="settings-business-type" defaultValue="" className={inputClass}>
          <option value="">เลือกประเภทธุรกิจ</option>
          {BUSINESS_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <p className="mt-2 text-xs text-slate-500">หากไม่พบประเภทที่ตรงกับธุรกิจ ให้เลือก “อื่น ๆ” แล้วระบุเอง</p>
      </div>

      <div id="settings-other-type-wrap" className="hidden">
        <label htmlFor="settings-other-type" className="mb-2 block text-sm font-semibold text-slate-700">ระบุประเภทธุรกิจ</label>
        <input id="settings-other-type" type="text" maxLength="120" placeholder="เช่น สตูดิโอออกแบบเสียง" className={inputClass} />
      </div>

      <div>
        <label htmlFor="settings-offering" className="mb-2 block text-sm font-semibold text-slate-700">สินค้าหรือบริการหลัก</label>
        <input id="settings-offering" type="text" maxLength="300" placeholder="เช่น กาแฟสด เบเกอรี และเครื่องดื่ม" className={inputClass} />
        <p className="mt-2 text-xs text-slate-500">บอกสิ่งที่ลูกค้าสามารถซื้อหรือใช้บริการได้จริง</p>
      </div>

      <div>
        <label htmlFor="settings-service-mode" className="mb-2 block text-sm font-semibold text-slate-700">รูปแบบการให้บริการ</label>
        <select id="settings-service-mode" defaultValue="" className={inputClass}>
          <option value="">เลือกรูปแบบการให้บริการ</option>
          {SERVICE_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="settings-description" className="mb-2 block text-sm font-semibold text-slate-700">รายละเอียดเพิ่มเติมของธุรกิจ</label>
        <textarea id="settings-description" rows="4" maxLength="4000" placeholder="เช่น มีบริการนั่งที่ร้านและซื้อกลับบ้าน" className={`${inputClass} resize-y leading-6`} />
        <p className="mt-2 text-xs text-slate-500">ใส่เฉพาะข้อมูลที่เปิดเผยกับลูกค้าได้ ไม่ใส่รหัสผ่าน เลขบัตร หรือข้อมูลส่วนตัวของลูกค้า</p>
      </div>
    </div>
  );
}
