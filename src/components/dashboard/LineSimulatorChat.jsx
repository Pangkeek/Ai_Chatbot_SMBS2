import { simulatorButton, simulatorInput } from './lineSimulatorStyles';

// หน้าต่างแชตทดสอบและช่องส่งข้อความ
export default function LineSimulatorChat() {
  return (
    <div className="min-w-0 overflow-hidden rounded-[20px] border border-[#dbe3e9] shadow-[0_12px_32px_-20px_#33415570]">
      <header className="flex items-center gap-2.5 bg-white p-4">
        <span
          className="grid size-[38px] shrink-0 place-items-center rounded-[13px] bg-[#06c755] text-2xl text-white"
          aria-hidden="true"
        >
          ✦
        </span>
        <div className="min-w-0">
          <strong
            id="line-sim-shop-name"
            className="block text-[13px] [overflow-wrap:anywhere]"
          >
            บอทร้านค้า
          </strong>
          <p className="mt-[3px] text-[10px] text-slate-500">
            ตัวอย่างบทสนทนา · LINE OA
          </p>
        </div>
        <span className="ml-auto text-[8px] tracking-[.1em] text-slate-500 max-[540px]:hidden">
          PREVIEW
        </span>
      </header>
      <div
        id="line-sim-result"
        className="h-[340px] overflow-y-auto overscroll-contain bg-[#e8f0ee] bg-[radial-gradient(#cadbd5_0.7px,transparent_0.7px)] bg-[length:16px_16px] px-4 py-5 max-[540px]:h-[310px]"
        role="log"
        aria-label="บทสนทนาทดสอบ"
        aria-live="polite"
        aria-relevant="additions text"
      >
        <div className="sim-empty flex h-full flex-col items-center justify-center gap-3 text-center text-[#334f46]">
          <span
            className="grid h-14 w-[62px] place-items-center rounded-[20px_20px_20px_5px] bg-white text-[25px] tracking-[3px] text-[#06a847] shadow-[0_6px_20px_#1665340d]"
            aria-hidden="true"
          >
            •••
          </span>
          <strong className="text-[15px]">
            บทสนทนาดี ๆ เริ่มตรงนี้
          </strong>
          <p className="text-[11px] leading-[1.9] text-[#5a756c]">
            เลือกคำถามตัวอย่าง หรือพิมพ์ข้อความด้านล่าง
            <br />
            เพื่อเริ่มทดสอบบอทของคุณ
          </p>
          <span className="rounded-full bg-white/65 px-3 py-1.5 text-[9px]">
            ลูกค้าถาม → บอทตอบ → ดูผลลัพธ์
          </span>
        </div>
      </div>
      <form
        id="line-sim-form"
        className="bg-white px-4 pb-2.5 pt-[14px]"
      >
        <label
          htmlFor="line-sim-text"
          className="mb-[7px] block text-[11px] font-semibold text-slate-600"
        >
          ข้อความจากลูกค้า
        </label>
        <div className="flex gap-2 max-[540px]:flex-wrap">
          <input
            id="line-sim-text"
            className={`${simulatorInput} max-[540px]:flex-[1_1_150px]`}
            type="text"
            placeholder="พิมพ์ข้อความที่อยากลองถาม…"
            maxLength="10000"
            required={true}
            autoComplete="off"
          />
          <button
            id="line-sim-btn"
            className={`${simulatorButton} shrink-0 rounded-[10px] bg-[#087f3c] px-3 py-2.5 text-[11px] font-semibold text-white hover:bg-[#06652f] max-[540px]:flex-[1_0_auto]`}
            type="submit"
          >
            ส่งข้อความ ↗
          </button>
        </div>
        <p className="mt-2 text-[10px] leading-[1.8] text-slate-500">
          กด Enter เพื่อส่งข้อความ
        </p>
      </form>
      <footer className="flex items-center justify-between gap-3 border-t border-[#eef2f6] bg-slate-50 px-4 py-2.5 text-[10px] text-slate-500">
        <span id="line-sim-status" role="status">
          พร้อมทดสอบ
        </span>
        <button
          id="line-sim-clear"
          className={`${simulatorButton} shrink-0 underline underline-offset-[3px]`}
          type="button"
          title="ล้างเฉพาะข้อความที่แสดง ไม่ลบประวัติในระบบ"
        >
          ล้างหน้าจอ
        </button>
      </footer>
    </div>
  );
}
