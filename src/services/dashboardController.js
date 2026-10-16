import { createKnowledgeManager } from "./knowledgeManager.js";
import Router from "next/router";
import { elements } from './dashboard/elements.js';
import { createApiClient } from './dashboard/apiClient.js';
import { showNotification, setButtonLoading } from './dashboard/feedback.js';
import { renderShops } from './dashboard/shopCards.js';
import { parseDashboardRoute, shopRoute } from "../utils/dashboardRoutes.js";

const TOKEN_KEY = "smb_access_token";

let accessToken = sessionStorage.getItem(TOKEN_KEY) || "";
const apiRequest = createApiClient(() => accessToken);

// เก็บรหัสร้านที่กำลังแก้ไขเพื่อส่งคำขอไปยังร้านที่ถูกต้อง
let selectedShopId = "";
let selectedShopRole = "agent";
let openShopVersion = 0;

function showAuthView() {
  elements.authView.classList.remove("hidden");
  elements.dashboardView.classList.add("hidden");
  elements.businessSettingsView.classList.add("hidden");
}

function showDashboardView() {
  elements.authView.classList.add("hidden");
  elements.dashboardView.classList.remove("hidden");
}

// แสดงหน้าหลักที่รวมรายการร้านค้าของผู้ใช้
function showDashboardHomeView() {
  elements.businessSettingsView.classList.add("hidden");
  elements.dashboardHomeView.classList.remove("hidden");

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

const settingsContent = {
  business: {
    eyebrow: "Business Settings",
    title: "ตั้งค่าข้อมูลธุรกิจ",
    description: "ข้อมูลส่วนนี้จะช่วยให้ Chatbot เข้าใจร้านและตอบลูกค้าได้เหมาะสมขึ้น",
    tab: elements.settingsBusinessTab,
    section: elements.businessSettingsSection,
  },
  knowledge: {
    eyebrow: "Knowledge Management",
    title: "จัดการ FAQ และข้อมูลความรู้",
    description: "ดูแลข้อมูลอ้างอิงของร้าน ค้นหา แก้ไข และกำหนดสถานะก่อนนำไปใช้ตอบลูกค้า",
    tab: elements.settingsKnowledgeTab,
    section: elements.knowledgeManagementSection,
  },
  line: {
    eyebrow: "Channel Integration",
    title: "การเชื่อมต่อ LINE",
    description: "ตั้งค่า LINE Official Account และทดลองการตอบข้อความของร้าน",
    tab: elements.settingsLineTab,
    section: elements.lineIntegrationSection,
  },
};

function activateSettingsTab(name) {
  if (name === "line" && selectedShopRole !== "owner") return;
  const active = settingsContent[name] || settingsContent.business;
  for (const item of Object.values(settingsContent)) {
    const selected = item === active;
    item.section.classList.toggle("hidden", !selected);
    item.tab.setAttribute("aria-selected", String(selected));
    item.tab.className = (selected
      ? "shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
      : "shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100");
    item.tab.hidden = item === settingsContent.line && selectedShopRole !== "owner";
  }
  elements.settingsEyebrow.textContent = active.eyebrow;
  elements.settingsTitle.textContent = active.title;
  elements.settingsDescriptionText.textContent = active.description;
  if (name === "knowledge") knowledgeManager.load();
  if (name === "line") loadLineConfig(selectedShopId);
}

// แสดงหน้าตั้งค่าธุรกิจของร้านที่ผู้ใช้เลือก
function showBusinessSettingsView() {
  elements.dashboardHomeView.classList.add("hidden");
  elements.businessSettingsView.classList.remove("hidden");

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

// เก็บรหัสร้านและนำข้อมูลเดิมมาแสดงในแบบฟอร์ม
function fillBusinessSettingsForm(shop) {
  if (selectedShopId !== shop.id) resetSimulator();
  selectedShopId = shop.id;
  selectedShopRole = shop.member_role;
  elements.lineSimShopName.textContent = shop.name;
  elements.settingsName.value = shop.name;
  elements.settingsDescription.value = shop.description || "";
  elements.settingsOpeningHours.value = shop.opening_hours || "";
  elements.settingsPersona.value = shop.persona || "";
  elements.settingsShopId.textContent = `รหัสร้าน: ${shop.id}`;
  const owner = shop.member_role === "owner";
  for (const field of elements.businessSettingsForm.elements) {
    if (field.type !== "submit") field.disabled = !owner;
  }
  elements.businessSettingsForm.querySelector('button[type="submit"]').hidden = !owner;
  elements.settingsLineTab.hidden = !owner;
  knowledgeManager.setShop(shop);

  // อัปเดตข้อมูลส่วนสรุปเดิมให้ตรงกับค่าล่าสุดด้วย
  elements.selectedShopName.textContent = shop.name;
  elements.selectedShopDescription.textContent =
    shop.description || "ยังไม่ได้เพิ่มรายละเอียดร้าน";
  elements.selectedShopHours.textContent =
    shop.opening_hours || "ยังไม่ได้กำหนดเวลาเปิดให้บริการ";
}

function saveSession(authData) {
  accessToken = authData.access_token;
  sessionStorage.setItem(TOKEN_KEY, accessToken);
}

function clearSession() {
  resetSimulator();
  knowledgeManager.reset();
  openShopVersion++;
  accessToken = "";
  selectedShopId = "";
  selectedShopRole = "agent";
  sessionStorage.removeItem(TOKEN_KEY);

  elements.shopList.replaceChildren();
  elements.shopDetail.classList.add("hidden");
  elements.businessSettingsForm.reset();
  elements.settingsShopId.textContent = "";

  showAuthView();
}

const knowledgeManager = createKnowledgeManager({
  apiRequest,
  showNotification,
  onUnauthorized(error) {
    clearSession();
    showNotification("error", "กรุณาเข้าสู่ระบบใหม่", error.message);
  },
});

function switchAuthTab(tab) {
  const loginSelected = tab === "login";

  elements.loginForm.classList.toggle("hidden", !loginSelected);
  elements.registerForm.classList.toggle("hidden", loginSelected);

  elements.loginTab.className = loginSelected
    ? "rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition"
    : "rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900";

  elements.registerTab.className = !loginSelected
    ? "rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition"
    : "rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900";
}

async function loadLineConfig(shopId) {
  try {
    const origin = window.location.origin;
    elements.lineWebhookUrl.value = `${origin}/api/v1/shops/${encodeURIComponent(
      shopId
    )}/line/webhook`;

    const config = await apiRequest(
      `/shops/${encodeURIComponent(shopId)}/line/config`
    );
    if (shopId !== selectedShopId) return;
    elements.verifyLineBtn.disabled = !config.configured;
    if (config.configured) {
      elements.lineStatusBadge.textContent = "บันทึกแล้ว · ยังไม่ตรวจสอบ";
      elements.lineStatusBadge.className =
        "inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700";
      elements.lineVerificationDetail.textContent = "กดตรวจสอบกับ LINE เพื่อยืนยัน Token และ Webhook URL";
      elements.lineChannelId.value = config.channel_id || "";
      elements.lineChannelSecret.value = "";
      elements.lineChannelSecret.placeholder =
        config.channel_secret_masked ||
        "ตั้งค่าแล้ว (เว้นว่างไว้หากไม่ต้องการเปลี่ยน)";
      elements.lineChannelSecret.required = false;
      elements.lineChannelToken.value = "";
      elements.lineChannelToken.placeholder =
        config.channel_access_token_masked ||
        "ตั้งค่าแล้ว (เว้นว่างไว้หากไม่ต้องการเปลี่ยน)";
      elements.lineChannelToken.required = false;
    } else {
      elements.lineStatusBadge.textContent = "ยังไม่ได้ตั้งค่า";
      elements.lineStatusBadge.className =
        "inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600";
      elements.lineVerificationDetail.textContent = "บันทึกข้อมูลก่อน แล้วกดตรวจสอบกับ LINE";
      elements.lineChannelId.value = "";
      elements.lineChannelSecret.value = "";
      elements.lineChannelSecret.placeholder =
        "Channel Secret จาก LINE Developers Console";
      elements.lineChannelSecret.required = true;
      elements.lineChannelToken.value = "";
      elements.lineChannelToken.placeholder =
        "Channel Access Token (long-lived) จาก LINE Developers Console";
      elements.lineChannelToken.required = true;
    }
  } catch (error) {
    console.error("Failed to load LINE config:", error);
    if (shopId === selectedShopId) {
      elements.verifyLineBtn.disabled = true;
      elements.lineStatusBadge.textContent = "โหลดสถานะไม่สำเร็จ";
      elements.lineVerificationDetail.textContent = error.message;
    }
  }
}

const lineStatusMessages = {
  connected: "LINE ยืนยัน Token และส่ง webhook ทดสอบถึง URL นี้สำเร็จ",
  token_invalid: "Channel Access Token ใช้กับ LINE ไม่ได้ กรุณาตรวจ Token แล้วบันทึกใหม่",
  webhook_not_configured: "Token ใช้ได้ แต่ยังไม่ได้ตั้ง Webhook URL ใน LINE Developers Console",
  webhook_mismatch: "Token ใช้ได้ แต่ Webhook URL ใน LINE ไม่ตรงกับ URL ที่แสดงด้านบน",
  webhook_inactive: "Token ใช้ได้ แต่ยังไม่ได้เปิด Use webhook ใน LINE Developers Console",
  webhook_not_public: "Token ใช้ได้ แต่ LINE ต้องการ Webhook URL แบบ HTTPS ที่เข้าถึงได้จากภายนอก",
  webhook_failed: "Token ใช้ได้ แต่ LINE ส่ง webhook ทดสอบมาไม่สำเร็จ ตรวจ Channel Secret และ URL",
  line_unavailable: "ติดต่อ LINE เพื่อตรวจสอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
};

async function verifyLineForShop(shopId) {
  if (!shopId || elements.verifyLineBtn.disabled) return;
  setButtonLoading(elements.verifyLineBtn, true, "กำลังตรวจสอบ…");
  elements.lineVerificationDetail.textContent = "กำลังตรวจสอบกับ LINE…";
  try {
    const result = await apiRequest(`/shops/${encodeURIComponent(shopId)}/line/verify`, {
      method: "POST",
      body: { webhook_url: elements.lineWebhookUrl.value },
    });
    if (shopId !== selectedShopId) return;
    const connected = result.status === "connected";
    elements.lineStatusBadge.textContent = connected
      ? "เชื่อมต่อและตรวจสอบแล้ว"
      : result.status === "line_unavailable" ? "ตรวจสอบไม่ได้" : "ยังไม่พร้อมใช้งานจริง";
    elements.lineStatusBadge.className = connected
      ? "inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
      : result.status === "token_invalid"
        ? "inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"
        : "inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700";
    const account = result.bot_display_name ? ` (${result.bot_display_name})` : "";
    const lineUrl = result.status === "webhook_mismatch" && result.line_webhook_url
      ? ` LINE ตั้งไว้: ${result.line_webhook_url}` : "";
    elements.lineVerificationDetail.textContent = `${lineStatusMessages[result.status] || lineStatusMessages.line_unavailable}${account}${lineUrl}`;
  } catch (error) {
    if (shopId !== selectedShopId) return;
    elements.lineStatusBadge.textContent = "ตรวจสอบไม่สำเร็จ";
    elements.lineVerificationDetail.textContent = error.message;
  } finally {
    if (shopId === selectedShopId) setButtonLoading(elements.verifyLineBtn, false);
  }
}

elements.verifyLineBtn.addEventListener("click", () => verifyLineForShop(selectedShopId));

async function openShop(shopId, tab = "business") {
  const version = ++openShopVersion;
  try {
    const shop = await apiRequest(`/shops/${encodeURIComponent(shopId)}`);
    if (version !== openShopVersion) return false;

    // ใช้ข้อมูลจาก API โดยตรงเพื่อป้องกันการแสดงข้อมูลเก่า
    fillBusinessSettingsForm(shop);

    if (tab === "line" && selectedShopRole !== "owner") {
      await Router.replace(shopRoute(shopId), undefined, { shallow: true, scroll: false });
      return true;
    }

    activateSettingsTab(tab);
    showBusinessSettingsView();
    return true;
  } catch (error) {
    if (version !== openShopVersion) return false;
    showNotification("error", "เปิดข้อมูลร้านไม่สำเร็จ", error.message);
    return false;
  }
}

async function syncDashboardRoute(url = window.location.pathname) {
  const route = parseDashboardRoute(url);
  if (!route || !accessToken) return;

  if (!route.shopId) {
    // ยกเลิกคำขอเปิดร้านที่ยังไม่เสร็จเมื่อกลับหน้ารวมร้าน
    openShopVersion++;
    showDashboardHomeView();
    showDashboardView();
    return;
  }

  const tab = route.tab === "settings" ? "business" : route.tab;
  if (selectedShopId === route.shopId) {
    if (tab === "line" && selectedShopRole !== "owner") {
      await Router.replace(shopRoute(route.shopId), undefined, { shallow: true, scroll: false });
      return;
    }
    activateSettingsTab(tab);
    showBusinessSettingsView();
    showDashboardView();
    return;
  }

  const opened = await openShop(route.shopId, tab);
  // คำขอเก่าต้องไม่พาออกจากร้านใหม่ที่ผู้ใช้เปิดระหว่างรอ API
  const currentRoute = parseDashboardRoute(window.location.pathname);
  if (!opened && currentRoute?.shopId === route.shopId && currentRoute.tab === route.tab) {
    await Router.replace("/app", undefined, { shallow: true, scroll: false });
  }
}

async function loadDashboard() {
  elements.shopLoading.classList.remove("hidden");
  elements.emptyShops.classList.add("hidden");
  elements.shopList.replaceChildren();

  try {
    const [user, shops] = await Promise.all([
      apiRequest("/users/me"),
      apiRequest("/shops"),
    ]);

    elements.headerUserName.textContent = user.name;
    elements.headerUserEmail.textContent = user.email;
    elements.welcomeName.textContent = user.name;

    renderShops(shops);
    if (parseDashboardRoute(window.location.pathname)?.shopId) {
      elements.dashboardHomeView.classList.add("hidden");
    }
    showDashboardView();
    await syncDashboardRoute();
  } catch (error) {
    clearSession();

    showNotification("error", "กรุณาเข้าสู่ระบบใหม่", error.message);
  }
}

// ปุ่มย้อนกลับจากหน้าตั้งค่าไปยังหน้ารวมร้านค้า
elements.settingsBackButton.addEventListener("click", () => {
  Router.push("/app", undefined, { shallow: true, scroll: false });
});

elements.settingsBusinessTab.addEventListener("click", () => {
  Router.push(shopRoute(selectedShopId), undefined, { shallow: true, scroll: false });
});

elements.settingsKnowledgeTab.addEventListener("click", () => {
  Router.push(shopRoute(selectedShopId, "knowledge"), undefined, { shallow: true, scroll: false });
});

elements.settingsLineTab.addEventListener("click", () => {
  Router.push(shopRoute(selectedShopId, "line"), undefined, { shallow: true, scroll: false });
});

// ส่งข้อมูลที่แก้ไขไปบันทึกด้วย PATCH เฉพาะร้านที่กำลังเลือก
elements.businessSettingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedShopId || selectedShopRole !== "owner") {
    showNotification(
      "error",
      "ไม่สามารถบันทึกได้",
      "กรุณาเลือกร้านที่ต้องการแก้ไขก่อน"
    );
    return;
  }

  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const button = formElement.querySelector('button[type="submit"]');

  // ตัดช่องว่างหัวท้ายก่อนส่งข้อมูลไปยัง API
  const readField = (name) => String(form.get(name) || "").trim();

  setButtonLoading(button, true, "กำลังบันทึก...");

  try {
    const shop = await apiRequest(
      `/shops/${encodeURIComponent(selectedShopId)}`,
      {
        method: "PATCH",
        body: {
          name: readField("name"),
          description: readField("description"),
          opening_hours: readField("opening_hours"),
          persona: readField("persona"),
        },
      }
    );

    // ใช้ข้อมูลที่ server ตอบกลับเป็นค่าจริงหลังบันทึก
    fillBusinessSettingsForm(shop);

    // โหลดรายการใหม่เพื่อให้ชื่อและรายละเอียดบนการ์ดเป็นปัจจุบัน
    const shops = await apiRequest("/shops");
    renderShops(shops);

    showNotification(
      "success",
      "บันทึกสำเร็จ",
      `อัปเดตข้อมูลร้าน “${shop.name}” เรียบร้อยแล้ว`
    );
  } catch (error) {
    showNotification("error", "บันทึกการตั้งค่าไม่สำเร็จ", error.message);
  } finally {
    setButtonLoading(button, false);
  }
});

if (elements.copyWebhookBtn) {
  elements.copyWebhookBtn.addEventListener("click", async () => {
    if (!elements.lineWebhookUrl.value) return;
    try {
      await navigator.clipboard.writeText(elements.lineWebhookUrl.value);
      const originalText = elements.copyWebhookBtn.textContent;
      elements.copyWebhookBtn.textContent = "คัดลอกแล้ว!";
      setTimeout(() => {
        elements.copyWebhookBtn.textContent = originalText;
      }, 2000);
    } catch {
      elements.lineWebhookUrl.select();
      document.execCommand("copy");
    }
  });
}

if (elements.lineSettingsForm) {
  elements.lineSettingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedShopId) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const button = elements.saveLineBtn;

    const channelId = String(form.get("channel_id") || "").trim();
    const channelSecret = String(form.get("channel_secret") || "").trim();
    const channelAccessToken = String(
      form.get("channel_access_token") || ""
    ).trim();

    const body = {};
    if (channelId) body.channel_id = channelId;
    if (channelSecret) body.channel_secret = channelSecret;
    if (channelAccessToken) body.channel_access_token = channelAccessToken;

    if (!channelSecret && elements.lineChannelSecret.required) {
      showNotification("error", "ข้อมูลไม่ครบ", "กรุณาระบุ Channel Secret");
      return;
    }
    if (!channelAccessToken && elements.lineChannelToken.required) {
      showNotification(
        "error",
        "ข้อมูลไม่ครบ",
        "กรุณาระบุ Channel Access Token"
      );
      return;
    }

    setButtonLoading(button, true, "กำลังบันทึก...");
    try {
      await apiRequest(
        `/shops/${encodeURIComponent(selectedShopId)}/line/config`,
        {
          method: "PUT",
          body,
        }
      );
      await loadLineConfig(selectedShopId);
      showNotification("success", "บันทึกสำเร็จ", "บันทึกข้อมูล LINE แล้ว กรุณากดตรวจสอบกับ LINE");
    } catch (error) {
      showNotification("error", "บันทึกไม่สำเร็จ", error.message);
    } finally {
      setButtonLoading(button, false);
    }
  });
}

const simulatorEmptyState = elements.lineSimResult.innerHTML;
let simulatorVersion = 0;
let simulatorBusy = false;

function resetSimulator() {
  simulatorVersion += 1;
  elements.lineSimResult.innerHTML = simulatorEmptyState;
  elements.lineSimStatus.textContent = "พร้อมทดสอบ";
  elements.lineSimText.value = "";
}

function appendSimulatorMessage(role, text) {
  elements.lineSimResult.querySelector(".sim-empty")?.remove();
  const row = document.createElement("div");
  row.className =
    role === "customer"
      ? "mb-[18px] flex flex-col items-end"
      : "mb-[18px] flex flex-col items-start";
  const label = document.createElement("span");
  label.className = "mb-[5px] text-[9px] text-[#526b64]";
  label.textContent =
    (role === "customer"
      ? "คุณ · ลูกค้าทดสอบ"
      : role === "bot"
      ? "บอทร้านค้า"
      : "สถานะการทดสอบ") +
    " · " +
    new Date().toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const bubble = document.createElement("p");
  bubble.className =
    role === "customer"
      ? "max-w-[90%] rounded-[15px_3px_15px_15px] bg-[#b5f38e] px-[14px] py-[11px] text-xs leading-[1.8] text-[#203b24] whitespace-pre-wrap shadow-[0_2px_3px_#33415508] [overflow-wrap:anywhere]"
      : role === "system"
      ? "max-w-[90%] rounded-[3px_15px_15px] bg-white/70 px-[14px] py-[11px] text-[11px] leading-[1.8] text-[#526b64] whitespace-pre-wrap [overflow-wrap:anywhere]"
      : "max-w-[90%] rounded-[3px_15px_15px] bg-white px-[14px] py-[11px] text-xs leading-[1.8] whitespace-pre-wrap shadow-[0_2px_3px_#33415508] [overflow-wrap:anywhere]";
  bubble.textContent = text;
  row.append(label, bubble);
  elements.lineSimResult.append(row);
  elements.lineSimResult.scrollTop = elements.lineSimResult.scrollHeight;
  return row;
}

for (const button of document.querySelectorAll("[data-sim-prompt]")) {
  button.addEventListener("click", () => {
    elements.lineSimText.value = selectedShopId === "shop-flower"
      ? button.dataset.simPromptFlower || button.dataset.simPrompt
      : button.dataset.simPrompt;
    elements.lineSimText.focus();
  });
}
elements.lineSimClear.addEventListener("click", resetSimulator);
elements.lineSimUser.addEventListener("change", resetSimulator);
elements.lineSimForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedShopId || simulatorBusy) return;
  const userId = elements.lineSimUser.value.trim() || "line-user-demo-1";
  const text = elements.lineSimText.value.trim();
  if (!text) {
    elements.lineSimText.focus();
    return;
  }
  const shopId = selectedShopId;
  const version = simulatorVersion;
  simulatorBusy = true;
  setButtonLoading(elements.lineSimBtn, true, "กำลังส่ง…");
  elements.lineSimUser.disabled = true;
  elements.lineSimClear.disabled = true;
  appendSimulatorMessage("customer", text);
  const pending = appendSimulatorMessage("system", "กำลังรอคำตอบจากบอท…");
  elements.lineSimStatus.textContent = "กำลังประมวลผล…";
  try {
    const result = await apiRequest(
      "/shops/" + encodeURIComponent(shopId) + "/line/simulate",
      {
        method: "POST",
        body: { user_id: userId, text },
      }
    );
    if (version !== simulatorVersion || shopId !== selectedShopId) return;
    pending.remove();
    if (result.replied && result.reply_text) {
      appendSimulatorMessage("bot", result.reply_text);
      const methodLabels = {
        faq: "FAQ ตรงคำถาม",
        generator: "AI เลือกคำตอบจากข้อมูลที่ค้นได้",
        extractive: "ค้นข้อมูลแล้วคัดข้อความหลักฐาน (ยังไม่ได้ต่อ AI)",
        no_evidence: "ไม่พบหลักฐานเพียงพอ",
      };
      const sourceIds = Array.isArray(result.reply_source_ids) ? result.reply_source_ids : [];
      appendSimulatorMessage("system", [
        `วิธีตอบ: ${methodLabels[result.reply_method] || "ไม่ระบุ"}`,
        `แหล่งความรู้: ${sourceIds.length ? sourceIds.join(", ") : "ไม่มี"}`,
      ].join("\n"));
      elements.lineSimStatus.textContent = "ตอบกลับสำเร็จ";
    } else {
      appendSimulatorMessage(
        "system",
        "บันทึกข้อความแล้ว · บอทไม่ได้ตอบกลับอัตโนมัติในครั้งนี้"
      );
      elements.lineSimStatus.textContent = "ไม่มีคำตอบอัตโนมัติ";
    }
    if (elements.lineSimText.value.trim() === text)
      elements.lineSimText.value = "";
  } catch (error) {
    if (version !== simulatorVersion || shopId !== selectedShopId) return;
    pending.remove();
    appendSimulatorMessage("system", "ทดสอบไม่สำเร็จ: " + error.message);
    elements.lineSimStatus.textContent =
      "เกิดข้อผิดพลาด · ตรวจสอบก่อนลองอีกครั้ง";
  } finally {
    simulatorBusy = false;
    setButtonLoading(elements.lineSimBtn, false);
    elements.lineSimUser.disabled = false;
    elements.lineSimClear.disabled = false;
    if (version === simulatorVersion) elements.lineSimText.focus();
  }
});

elements.loginTab.addEventListener("click", () => {
  switchAuthTab("login");
});

elements.registerTab.addEventListener("click", () => {
  switchAuthTab("register");
});

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const button = formElement.querySelector('button[type="submit"]');

  setButtonLoading(button, true, "กำลังเข้าสู่ระบบ...");

  try {
    const authData = await apiRequest("/auth/login", {
      method: "POST",
      body: {
        email: form.get("email"),
        password: form.get("password"),
      },
    });

    saveSession(authData);
    formElement.reset();

    await loadDashboard();

    showNotification(
      "success",
      "เข้าสู่ระบบสำเร็จ",
      "ยินดีต้อนรับกลับเข้าสู่ระบบ"
    );
  } catch (error) {
    showNotification("error", "เข้าสู่ระบบไม่สำเร็จ", error.message);
  } finally {
    setButtonLoading(button, false);
  }
});

elements.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const button = formElement.querySelector('button[type="submit"]');

  setButtonLoading(button, true, "กำลังสร้างบัญชี...");

  try {
    const authData = await apiRequest("/auth/register", {
      method: "POST",
      body: {
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
      },
    });

    saveSession(authData);
    formElement.reset();

    await loadDashboard();

    showNotification(
      "success",
      "สมัครสมาชิกสำเร็จ",
      "สร้างบัญชีเรียบร้อยแล้ว คุณสามารถสร้างร้านแรกได้เลย"
    );
  } catch (error) {
    showNotification("error", "สมัครสมาชิกไม่สำเร็จ", error.message);
  } finally {
    setButtonLoading(button, false);
  }
});

elements.shopForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const button = formElement.querySelector('button[type="submit"]');

  setButtonLoading(button, true, "กำลังสร้างร้าน...");

  try {
    const shop = await apiRequest("/shops", {
      method: "POST",
      body: {
        name: form.get("name"),
        description: form.get("description"),
      },
    });

    formElement.reset();

    await loadDashboard();
    if (await openShop(shop.id)) {
      await Router.push(shopRoute(shop.id), undefined, { shallow: true, scroll: false });
    }

    showNotification(
      "success",
      "สร้างร้านสำเร็จ",
      `สร้างร้าน “${shop.name}” เรียบร้อยแล้ว`
    );
  } catch (error) {
    showNotification("error", "สร้างร้านไม่สำเร็จ", error.message);
  } finally {
    setButtonLoading(button, false);
  }
});

elements.logoutButton.addEventListener("click", async () => {
  elements.logoutButton.disabled = true;

  try {
    await apiRequest("/auth/logout", {
      method: "POST",
    });
  } catch {
    // ลบ session ใน browser แม้ server จะติดต่อไม่ได้
  } finally {
    clearSession();
    await Router.replace("/app", undefined, { shallow: true, scroll: false });
    elements.logoutButton.disabled = false;

    showNotification(
      "success",
      "ออกจากระบบแล้ว",
      "Session บนเครื่องนี้ถูกลบเรียบร้อยแล้ว"
    );
  }
});

// ลิงก์สมัครสมาชิกจาก /home เปิดแท็บสมัครโดยตรง ส่วน /app ปกติเปิดแท็บเข้าสู่ระบบ
switchAuthTab(new URLSearchParams(window.location.search).get("mode") === "register" ? "register" : "login");

Router.events.on("routeChangeComplete", (url) => {
  if (url.startsWith("/app")) void syncDashboardRoute(url);
});

if (accessToken) {
  loadDashboard();
} else {
  showAuthView();
}
