export default function CreateShopForm() {
  return (
    <form id="shop-form" className="mt-6 space-y-5">
                  <div>
                    <label
                      htmlFor="shop-name"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      ชื่อร้าน
                    </label>

                    <input
                      id="shop-name"
                      name="name"
                      placeholder="เช่น บ้านกาแฟ"
                      maxLength="120"
                      required={true}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="shop-description"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      รายละเอียดร้าน
                    </label>

                    <textarea
                      id="shop-description"
                      name="description"
                      rows="3"
                      placeholder="อธิบายเกี่ยวกับร้านแบบสั้น ๆ"
                      maxLength="5000"
                      className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    สร้างร้านค้า
                  </button>
                </form>
  );
}
