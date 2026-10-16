export default function ConsoleIntro() {
  return (
    <header className="mb-8">
          <span className="text-xs font-bold tracking-[1.5px] text-[#086b64]">
            DEVELOPER WORKSPACE · v0.1.0
          </span>
          <h1 className="my-[14px] text-[30px] tracking-[-1px] min-[601px]:text-[40px]">
            SMB Chatbot API
          </h1>
          <p className="leading-[1.7] text-[#495c6b]">
            พื้นที่ทดสอบ API สำหรับทีม · ข้อมูลแยกตามร้าน ·
            บันทึกข้อความในฐานข้อมูลท้องถิ่น
          </p>
          <a className="text-[#086b64] underline" href="/openapi.json">
            ดาวน์โหลด OpenAPI 3.1
          </a>
        </header>
  );
}
