import { button, field, label, section } from './styles';
export default function AuthenticationSection() {
  return (
    <section className={section}>
          <h2 className="mb-4 text-xl font-semibold">1. เข้าสู่ระบบ</h2>
          <p className="mb-4 leading-[1.7] text-[#495c6b]">
            รัน seed ก่อนใช้บัญชีตัวอย่าง รหัสผ่านทั้งสองบัญชี:{" "}
            <code>DemoPass!2026</code>
          </p>
          <form id="login" className="flex flex-wrap items-end gap-4">
            <label className={label}>
              อีเมล
              <select id="email" className={field}>
                <option>coffee@example.test</option>
                <option>flower@example.test</option>
              </select>
            </label>
            <label className={label}>
              รหัสผ่าน
              <input
                id="password"
                className={field}
                type="password"
                defaultValue="DemoPass!2026"
                autoComplete="current-password"
              />
            </label>
            <button className={`${button} bg-[#086b64] text-white`}>
              เข้าสู่ระบบ
            </button>
            <button
              id="logout"
              className={`${button} bg-[#e8efef] text-[#244746]`}
              type="button"
            >
              ออกจากระบบ
            </button>
          </form>
          <p
            id="auth-state"
            className="mt-4 [overflow-wrap:anywhere]"
            role="status"
          >
            ยังไม่ได้เข้าสู่ระบบ
          </p>
        </section>
  );
}
