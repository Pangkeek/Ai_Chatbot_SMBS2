import { presetButton, simulatorInput } from './lineSimulatorStyles';

// ส่วนกำหนดผู้ทดสอบและเลือกคำถามตัวอย่าง
export default function LineSimulatorSetup() {
  return (
    <aside className="min-w-0 pt-1.5">
      <div className="mb-4 flex items-center gap-2.5 text-[11px] font-bold text-slate-400">
        01{" "}
        <span className="text-[13px] text-slate-700">
          ตั้งค่าผู้ทดสอบ
        </span>
      </div>
      <label
        htmlFor="line-sim-user"
        className="mb-[7px] block text-[11px] font-semibold text-slate-600"
      >
        รหัสลูกค้า LINE
      </label>
      <input
        id="line-sim-user"
        className={simulatorInput}
        type="text"
        defaultValue="line-user-demo-1"
        maxLength="100"
        autoComplete="off"
      />
      <p className="mt-2 text-[10px] leading-[1.8] text-slate-500">
        ใช้รหัสเดิมเพื่อทดสอบบทสนทนาต่อเนื่อง
        หรือเปลี่ยนรหัสเพื่อจำลองลูกค้าคนอื่น
      </p>
      <div className="mb-4 mt-[26px] flex items-center gap-2.5 text-[11px] font-bold text-slate-400">
        02{" "}
        <span className="text-[13px] text-slate-700">
          เลือกคำถามเริ่มต้น
        </span>
      </div>
      <div className="grid gap-[9px] min-[541px]:max-[1150px]:grid-cols-3">
        <button
          className={presetButton}
          type="button"
          data-sim-prompt="ลาเต้เย็นราคาเท่าไหร่"
          data-sim-prompt-flower="ช่อกุหลาบราคาเท่าไหร่"
        >
          <span
            className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-green-50 text-lg text-green-700"
            aria-hidden="true"
          >
            ✦
          </span>
          <span>
            ค้นข้อมูลสินค้า
            <small className="mt-[3px] block text-[10px] font-normal text-slate-500">
              ตัวอย่างค้นความรู้ที่ไม่ใช่ FAQ
            </small>
          </span>
          <span
            className="ml-auto text-slate-400 max-[1150px]:hidden"
            aria-hidden="true"
          >
            ↗
          </span>
        </button>
        <button
          className={presetButton}
          type="button"
          data-sim-prompt="ร้านเปิดปิดกี่โมงครับ"
        >
          <span
            className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-green-50 text-lg text-green-700"
            aria-hidden="true"
          >
            ◷
          </span>
          <span>
            เวลาเปิดทำการ
            <small className="mt-[3px] block text-[10px] font-normal text-slate-500">
              เช็กข้อมูลพื้นฐานของร้าน
            </small>
          </span>
          <span
            className="ml-auto text-slate-400 max-[1150px]:hidden"
            aria-hidden="true"
          >
            ↗
          </span>
        </button>
        <button
          className={presetButton}
          type="button"
          data-sim-prompt="ขอคุยกับเจ้าหน้าที่ได้ไหมครับ"
        >
          <span
            className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-green-50 text-lg text-green-700"
            aria-hidden="true"
          >
            ☏
          </span>
          <span>
            ติดต่อเจ้าหน้าที่
            <small className="mt-[3px] block text-[10px] font-normal text-slate-500">
              ลองทดสอบการส่งต่อแชต
            </small>
          </span>
          <span
            className="ml-auto text-slate-400 max-[1150px]:hidden"
            aria-hidden="true"
          >
            ↗
          </span>
        </button>
      </div>
      <div className="mt-[22px] rounded-xl bg-slate-50 p-[14px] text-[11px] leading-[1.8] text-slate-500 max-[1150px]:mt-[14px]">
        <strong className="text-slate-600">
          พื้นที่ทดลองของร้านคุณ
        </strong>
        <p className="mt-1">
          ข้อความจะถูกบันทึกในระบบ แต่จะไม่ส่งไปยัง LINE
          ของลูกค้าจริง
        </p>
      </div>
    </aside>
  );
}
