const statistics = [
  ['total_conversations', 'บทสนทนาทั้งหมด'], ['total_messages', 'ข้อความทั้งหมด'],
  ['open_conversations', 'ห้องที่เปิดอยู่'], ['closed_conversations', 'ห้องที่ปิดแล้ว'],
  ['active_conversations', 'บอทเปิดทำงาน'], ['paused_conversations', 'พักบอท'],
  ['human_conversations', 'ส่งต่อแอดมินปัจจุบัน'], ['agent_messages', 'ข้อความจากแอดมิน'],
];
const input = 'min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800';
const button = 'min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';

export default function ConversationsSection() {
  return (
    <section id="conversations-section" className="hidden space-y-6" aria-label="บทสนทนาและสถิติ">
      <div className="outlined-panel rounded-3xl bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl text-slate-900">ภาพรวมการสนทนา</h2>
            <p className="mt-1 text-sm text-slate-500">ยอดทั้งหมดของร้านนี้ตั้งแต่เริ่มใช้งาน รวม LINE และเว็บ ไม่เปลี่ยนตามตัวกรองรายการห้อง</p>
          </div>
          <button id="conversation-refresh" type="button" className={button}>รีเฟรชข้อมูล</button>
        </div>
        <p id="conversation-load-status" role="status" className="mt-3 text-sm text-slate-500" />
        <p id="conversation-load-error" role="alert" className="mt-3 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700" />
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statistics.map(([key, label]) => (
            <div key={key} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-600">{label}</p>
              <p data-stat={key} className="mt-2 text-2xl text-[#3855b8]">—</p>
            </div>
          ))}
        </div>
        <p id="conversation-stat-breakdown" className="mt-4 text-sm leading-6 text-slate-600" />
        <p className="mt-2 text-xs leading-5 text-slate-500">“ส่งต่อแอดมินปัจจุบัน” นับห้องที่อยู่ในโหมดแอดมินขณะนี้ ไม่ใช่จำนวนครั้งสะสม ส่วน “ข้อความทั้งหมด” รวมข้อความระบบด้วย</p>
        <p id="conversation-updated" className="mt-2 text-xs text-slate-500" />
      </div>

      <form id="conversation-filters" className="outlined-panel grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="ค้นหาและกรองบทสนทนา">
        <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-600">ชื่อลูกค้าหรือรหัสลูกค้า
          <input id="conversation-search" type="search" maxLength={200} className={input} placeholder="ค้นหาลูกค้า" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">ช่องทาง
          <select id="conversation-channel" className={input}><option value="">ทุกช่องทาง</option><option value="line">LINE</option><option value="web">เว็บ</option></select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">สถานะห้อง
          <select id="conversation-status" className={input}><option value="">ทุกสถานะ</option><option value="open">เปิดอยู่</option><option value="closed">ปิดแล้ว</option></select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">สถานะบอท
          <select id="conversation-mode" className={input}><option value="">ทุกโหมด</option><option value="active">บอทเปิดทำงาน</option><option value="paused">พักบอท</option><option value="human">แอดมินดูแล</option></select>
        </label>
        <div className="flex items-end gap-2"><button type="submit" className="app-primary-button min-h-11 rounded-xl px-4 py-2 text-sm text-white">ค้นหา</button><button id="conversation-clear" type="button" className={button}>ล้าง</button></div>
      </form>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="outlined-panel min-w-0 rounded-3xl bg-white p-4">
          <h2 className="text-lg text-slate-900">ห้องสนทนา</h2>
          <div id="conversation-list" className="mt-3 space-y-2" aria-label="รายการห้องสนทนา" />
          <p id="conversation-list-page" className="mt-4 text-center text-xs text-slate-500" role="status" />
          <div className="mt-3 flex justify-between gap-2"><button id="conversation-list-prev" type="button" className={button} disabled>ก่อนหน้า</button><button id="conversation-list-next" type="button" className={button} disabled>ถัดไป</button></div>
        </div>
        <div className="outlined-panel min-w-0 rounded-3xl bg-white p-4 sm:p-5">
          <h2 id="conversation-detail-title" className="break-words text-lg text-slate-900">เลือกห้องเพื่ออ่านประวัติ</h2>
          <p id="conversation-detail-meta" className="mt-1 break-all text-xs leading-6 text-slate-500" />
          <div className="mt-3 flex flex-wrap gap-2" aria-label="ควบคุมบอท">
            <button id="conversation-takeover" type="button" className="app-primary-button min-h-11 rounded-xl px-4 py-2 text-sm text-white disabled:opacity-40" disabled>รับช่วงสนทนา</button>
            <button id="conversation-pause" type="button" className={button} disabled>Pause · พักบอท</button>
            <button id="conversation-resume" type="button" className={button} disabled>Resume · เปิดบอท</button>
          </div>
          <p id="conversation-action-status" role="status" className="mt-2 text-sm leading-6 text-slate-600" />
          <p id="conversation-detail-error" role="alert" className="mt-3 hidden rounded-xl bg-red-50 p-3 text-sm text-red-700" />
          <p id="conversation-message-page" className="mt-4 text-center text-xs text-slate-500" role="status" />
          <div className="my-3 flex justify-between gap-2"><button id="conversation-messages-prev" type="button" className={button} disabled>ข้อความเก่ากว่า</button><button id="conversation-messages-next" type="button" className={button} disabled>ข้อความใหม่กว่า</button></div>
          <div id="conversation-messages" className="max-h-[36rem] min-h-48 space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-3" aria-label="ประวัติข้อความ" />
          <form id="conversation-composer" className="mt-4 space-y-3" aria-label="ส่งข้อความแอดมิน">
            <label className="block text-sm text-slate-700" htmlFor="conversation-reply">ข้อความจากแอดมิน</label>
            <textarea id="conversation-reply" rows={3} maxLength={5000} required disabled className={`${input} w-full resize-y disabled:opacity-50`} placeholder="รับช่วงหรือพักบอทก่อนส่งข้อความไป LINE" />
            <p id="conversation-composer-help" className="text-xs leading-5 text-slate-500">เลือกห้องสนทนาก่อนส่งข้อความ</p>
            <button id="conversation-send" type="submit" className="app-primary-button min-h-11 rounded-xl px-5 py-2 text-sm text-white disabled:opacity-40" disabled>ส่งไป LINE</button>
          </form>
          <div id="conversation-deliveries" className="mt-4 space-y-2 text-xs leading-5 text-slate-600" aria-label="สถานะการส่งข้อความแอดมิน" />
        </div>
      </div>
    </section>
  );
}
