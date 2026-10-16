import { CHATBOT_PERSONA_STYLES } from "../../utils/chatbotPersona.js";

export default function ChatbotPersonaField() {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="settings-persona-style" className="mb-2 block text-sm font-semibold text-slate-700">
          บุคลิกของ Chatbot
        </label>
        <select id="settings-persona-style" defaultValue={CHATBOT_PERSONA_STYLES[0][0]} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
          {CHATBOT_PERSONA_STYLES.map(([style]) => <option key={style} value={style}>{style}</option>)}
        </select>
        <p id="settings-persona-hint" className="mt-2 text-xs text-slate-500">
          {CHATBOT_PERSONA_STYLES[0][1]}
        </p>
      </div>

      <div>
        <label htmlFor="settings-persona-details" className="mb-2 block text-sm font-semibold text-slate-700">
          รายละเอียดบุคลิกเพิ่มเติม
        </label>
        <textarea id="settings-persona-details" rows="4" maxLength="4800" placeholder="เช่น เรียกลูกค้าว่า ‘คุณลูกค้า’ ตอบสั้น ๆ และแนะนำสินค้าเฉพาะที่มีข้อมูลในร้าน" className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
        <p className="mt-2 text-xs text-slate-500">เขียนวิธีเรียกลูกค้า คำที่อยากใช้ หรือสิ่งที่ไม่อยากให้บอทพูด</p>
      </div>
    </div>
  );
}
