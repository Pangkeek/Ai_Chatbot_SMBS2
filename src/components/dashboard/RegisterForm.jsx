export default function RegisterForm() {
  return (
    <form id="register-form" className="mt-8 hidden space-y-5">
              <div>
                <label
                  htmlFor="register-name"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  ชื่อผู้ใช้งาน
                </label>

                <input
                  id="register-name"
                  name="name"
                  autoComplete="name"
                  placeholder="เช่น สมชาย ใจดี"
                  maxLength="100"
                  required={true}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="register-email"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  อีเมล
                </label>

                <input
                  id="register-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  maxLength="254"
                  required={true}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="register-password"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  รหัสผ่าน
                </label>

                <input
                  id="register-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="อย่างน้อย 10 ตัวอักษร"
                  minLength="10"
                  maxLength="128"
                  required={true}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />

                <p className="mt-2 text-xs text-slate-400">
                  ใช้อย่างน้อย 10 ตัวอักษร
                </p>
              </div>

              <button
                type="submit"
                className="app-primary-button w-full rounded-xl px-5 py-3.5 text-sm font-semibold"
              >
                สร้างบัญชี
              </button>
            </form>
  );
}
