// หัวข้อและสถานะของพื้นที่ทดลองแชต
export default function LineSimulatorIntro() {
  return (
    <div className="mb-[22px] flex items-center justify-between gap-4 max-[540px]:items-start">
      <div>
        <p className="text-[10px] font-extrabold tracking-[.16em] text-green-700">
          CHAT PLAYGROUND
        </p>
        <h3
          id="line-sim-title"
          className="mt-1 text-2xl font-bold tracking-[-.04em] max-[540px]:text-[21px]"
        >
          LINE Simulator
        </h3>
        <p className="mt-1 text-[13px] text-slate-500 max-[540px]:text-xs">
          ลองเป็นลูกค้า แล้วดูว่าบอทของร้านตอบอย่างไร
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-[7px] rounded-full border border-green-200 bg-green-50 px-2.5 py-1.5 text-[11px] text-green-800">
        <span className="size-1.5 rounded-full bg-green-600" />
        โหมดทดสอบ
      </span>
    </div>
  );
}
