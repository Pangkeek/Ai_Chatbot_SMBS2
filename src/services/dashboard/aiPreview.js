function addBusinessLine(container, label, value) {
  const row = document.createElement("p");
  row.className = "whitespace-pre-line";
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  row.append(strong, document.createTextNode(value || "ยังไม่ได้ระบุ"));
  container.append(row);
}

function renderPreview(result) {
  document.querySelector("#ai-preview-connection").textContent = result.aiConfigured
    ? "ตั้งค่าบริการ AI ภายนอกแล้ว ระบบจะตรวจคำตอบกับหลักฐานก่อนส่ง (หน้านี้ยังไม่ได้ทดสอบการเชื่อมต่อ)"
    : "ยังไม่ได้เชื่อมต่อบริการ AI ภายนอก ระบบตอบโดยคัดข้อความจากหลักฐานในเครื่อง";
  const business = document.querySelector("#ai-preview-business");
  const sources = document.querySelector("#ai-preview-sources");
  business.replaceChildren();
  sources.replaceChildren();

  addBusinessLine(business, "ชื่อร้าน", result.shop.name);
  addBusinessLine(business, "รายละเอียดธุรกิจ", result.shop.description);
  addBusinessLine(business, "เวลาเปิดให้บริการ", result.shop.opening_hours);
  addBusinessLine(business, "บุคลิก Chatbot", result.shop.persona);

  if (result.sources.length === 0) {
    const empty = document.createElement("p");
    empty.className = "rounded-xl bg-amber-50 p-4 text-sm text-amber-800";
    empty.textContent = "ยังไม่พบข้อมูลที่ยืนยันคำตอบนี้ได้ ลองเพิ่ม FAQ หรือรายละเอียดธุรกิจที่เกี่ยวข้อง";
    sources.append(empty);
  }

  for (const source of result.sources) {
    const card = document.createElement("article");
    card.className = "rounded-xl border border-slate-200 p-4";
    const title = document.createElement("h5");
    title.className = "text-sm font-semibold text-slate-800";
    title.textContent = `${source.sourceType === "business" ? "ข้อมูลธุรกิจ" : "FAQ/คลังความรู้"} · ${source.title}`;
    const content = document.createElement("p");
    content.className = "mt-2 whitespace-pre-line text-sm leading-6 text-slate-600";
    content.textContent = source.content;
    card.append(title, content);
    sources.append(card);
  }

  document.querySelector("#ai-preview-prompt").textContent = JSON.stringify(result.prompt, null, 2);
  document.querySelector("#ai-preview-result").classList.remove("hidden");
}

export function createAiPreview({ listen, apiRequest, getSelectedShopId, setButtonLoading }) {
  const form = document.querySelector("#ai-preview-form");
  const question = document.querySelector("#ai-preview-question");
  const button = document.querySelector("#ai-preview-button");
  const error = document.querySelector("#ai-preview-error");
  const result = document.querySelector("#ai-preview-result");
  let version = 0;

  function reset() {
    version++;
    question.value = "";
    question.disabled = false;
    setButtonLoading(button, false);
    error.classList.add("hidden");
    result.classList.add("hidden");
  }

  listen(form, "submit", async (event) => {
    event.preventDefault();
    const shopId = getSelectedShopId();
    if (!shopId) return;
    const asked = question.value.trim();
    const requestVersion = ++version;
    error.classList.add("hidden");
    result.classList.add("hidden");
    question.disabled = true;
    setButtonLoading(button, true, "กำลังค้นหา...");

    try {
      const preview = await apiRequest(`/shops/${encodeURIComponent(shopId)}/ai/preview`, {
        method: "POST",
        body: { question: asked },
      });
      if (requestVersion === version && shopId === getSelectedShopId()) renderPreview(preview);
    } catch (caught) {
      if (requestVersion === version) {
        error.textContent = caught.message;
        error.classList.remove("hidden");
      }
    } finally {
      if (requestVersion === version) {
        question.disabled = false;
        setButtonLoading(button, false);
      }
    }
  });

  return { reset };
}
