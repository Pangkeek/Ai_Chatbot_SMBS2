export default function LoginForm() {
  return (
    <form id="login-form" className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  อีเมล
                </label>

                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  required={true}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  รหัสผ่าน
                </label>

                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="กรอกรหัสผ่าน"
                  minLength="10"
                  maxLength="128"
                  required={true}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                className="app-primary-button w-full rounded-xl px-5 py-3.5 text-sm font-semibold"
              >
                เข้าสู่ระบบ
              </button>

            </form>
  );
}
