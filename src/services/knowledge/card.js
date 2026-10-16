const kindLabels = {
  faq: "คำถามที่พบบ่อย",
  product: "สินค้า/บริการ",
  policy: "นโยบาย",
  general: "ข้อมูลทั่วไป",
};

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
});

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// สร้างการ์ดความรู้และปุ่มที่เจ้าของร้านใช้งานได้
export function createKnowledgeCard(entry, { isOwner, openForm, toggleStatus, openDelete }) {
  const card = element(
    "article",
    "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-violet-200 hover:shadow-md"
  );
  const header = element("div", "flex flex-wrap items-start justify-between gap-3");
  const badges = element("div", "flex flex-wrap gap-2");
  const kind = element(
    "span",
    "rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700",
    kindLabels[entry.kind]
  );
  const published = entry.status === "published";
  const status = element(
    "span",
    published
      ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
      : "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700",
    published ? "เผยแพร่แล้ว" : "ฉบับร่าง"
  );
  badges.append(kind, status);

  const date = element(
    "time",
    "text-xs text-slate-400",
    `แก้ไข ${dateFormatter.format(new Date(entry.updated_at))}`
  );
  date.dateTime = entry.updated_at;
  header.append(badges, date);

  const title = element(
    "h3",
    "mt-4 text-lg font-bold leading-7 text-slate-900",
    entry.title
  );
  const content = element(
    "p",
    "mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-slate-600",
    entry.content
  );
  card.append(header, title, content);

  if (isOwner()) {
    const actions = element(
      "div",
      "mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4"
    );
    const edit = element(
      "button",
      "rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50",
      "แก้ไข"
    );
    edit.type = "button";
    edit.addEventListener("click", () => openForm(entry));

    const toggle = element(
      "button",
      published
        ? "rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
        : "rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50",
      published ? "เปลี่ยนเป็นฉบับร่าง" : "เผยแพร่"
    );
    toggle.type = "button";
    toggle.addEventListener("click", () => toggleStatus(entry, toggle));

    const remove = element(
      "button",
      "ml-auto rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50",
      "ลบ"
    );
    remove.type = "button";
    remove.addEventListener("click", () => openDelete(entry));
    actions.append(edit, toggle, remove);
    card.append(actions);
  }

  return card;
}
