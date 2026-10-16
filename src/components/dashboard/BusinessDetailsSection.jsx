import BusinessHoursField from "./BusinessHoursField.jsx";
import ChatbotPersonaField from "./ChatbotPersonaField.jsx";

export default function BusinessDetailsSection() {
  return (
    <section id="business-settings-section" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <form id="business-settings-form" className="space-y-6">
                <div>
                  <label
                    htmlFor="settings-name"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    ชื่อธุรกิจ
                    <span className="text-red-500">*</span>
                  </label>

                  <input
                    id="settings-name"
                    name="name"
                    maxLength="120"
                    required={true}
                    placeholder="เช่น บ้านกาแฟ"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="settings-description"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    รายละเอียดธุรกิจ
                  </label>

                  <textarea
                    id="settings-description"
                    name="description"
                    rows="5"
                    maxLength="5000"
                    placeholder="อธิบายว่าร้านขายสินค้าหรือให้บริการอะไร"
                    className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  ></textarea>

                  <p className="mt-2 text-xs text-slate-400">
                    ตัวอย่าง: ร้านกาแฟและเบเกอรี
                    มีบริการนั่งที่ร้านและซื้อกลับบ้าน
                  </p>
                </div>

                <BusinessHoursField />

                <ChatbotPersonaField />

                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p
                    id="settings-shop-id"
                    className="text-xs text-slate-400"
                  ></p>

                  <button
                    type="submit"
                    className="app-primary-button rounded-xl px-6 py-3 text-sm font-semibold"
                  >
                    บันทึกการตั้งค่า
                  </button>
                </div>
              </form>
            </section>
  );
}
