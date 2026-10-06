import { createKnowledgeManager } from "./knowledgeManager.js";
import Router from "next/router";
import { parseDashboardRoute, shopRoute } from "../utils/dashboardRoutes.js";

const API_BASE = "/api/v1";
const TOKEN_KEY = "smb_access_token";

let accessToken = sessionStorage.getItem(TOKEN_KEY) || "";
let notificationTimer;

// เก็บรหัสร้านที่กำลังแก้ไขเพื่อส่งคำขอไปยังร้านที่ถูกต้อง
let selectedShopId = "";
let selectedShopRole = "agent";
let openShopVersion = 0;

const elements = {
  authView: document.querySelector("#auth-view"),
  dashboardView: document.querySelector("#dashboard-view"),

  // ส่วนที่ใช้สลับระหว่างหน้าหลักกับหน้าตั้งค่าธุรกิจ
  dashboardHomeView: document.querySelector("#dashboard-home-view"),
  businessSettingsView: document.querySelector("#business-settings-view"),
  settingsBackButton: document.querySelector("#settings-back-button"),
  businessSettingsForm: document.querySelector("#business-settings-form"),
  settingsName: document.querySelector("#settings-name"),
  settingsDescription: document.querySelector("#settings-description"),
  settingsOpeningHours: document.querySelector("#settings-opening-hours"),
  settingsPersona: document.querySelector("#settings-persona"),
  settingsShopId: document.querySelector("#settings-shop-id"),
  settingsEyebrow: document.querySelector("#settings-eyebrow"),
  settingsTitle: document.querySelector("#settings-title"),
  settingsDescriptionText: document.querySelector("#settings-description-text"),
  settingsBusinessTab: document.querySelector("#settings-business-tab"),
  settingsKnowledgeTab: document.querySelector("#settings-knowledge-tab"),
  settingsLineTab: document.querySelector("#settings-line-tab"),
  businessSettingsSection: document.querySelector("#business-settings-section"),
  knowledgeManagementSection: document.querySelector("#knowledge-management-section"),

  loginTab: document.querySelector("#login-tab"),
  registerTab: document.querySelector("#register-tab"),
  loginForm: document.querySelector("#login-form"),
  registerForm: document.querySelector("#register-form"),
  shopForm: document.querySelector("#shop-form"),
  logoutButton: document.querySelector("#logout-button"),

  notification: document.querySelector("#notification"),
  notificationIcon: document.querySelector("#notification-icon"),
  notificationTitle: document.querySelector("#notification-title"),
  notificationMessage: document.querySelector("#notification-message"),

  headerUserName: document.querySelector("#header-user-name"),
  headerUserEmail: document.querySelector("#header-user-email"),
  welcomeName: document.querySelector("#welcome-name"),
  shopCount: document.querySelector("#shop-count"),

  shopLoading: document.querySelector("#shop-loading"),
  emptyShops: document.querySelector("#empty-shops"),
  shopList: document.querySelector("#shop-list"),

  shopDetail: document.querySelector("#shop-detail"),
  selectedShopName: document.querySelector("#selected-shop-name"),
  selectedShopDescription: document.querySelector("#selected-shop-description"),
  selectedShopHours: document.querySelector("#selected-shop-hours"),

  lineIntegrationSection: document.querySelector("#line-integration-section"),
  lineStatusBadge: document.querySelector("#line-status-badge"),
  lineWebhookUrl: document.querySelector("#line-webhook-url"),
  copyWebhookBtn: document.querySelector("#copy-webhook-btn"),
  lineSettingsForm: document.querySelector("#line-settings-form"),
  lineChannelId: document.querySelector("#line-channel-id"),
  lineChannelSecret: document.querySelector("#line-channel-secret"),
  lineChannelToken: document.querySelector("#line-channel-token"),
  saveLineBtn: document.querySelector("#save-line-btn"),
  verifyLineBtn: document.querySelector("#verify-line-btn"),
  lineVerificationDetail: document.querySelector("#line-verification-detail"),
  lineSimUser: document.querySelector("#line-sim-user"),
  lineSimText: document.querySelector("#line-sim-text"),
  lineSimBtn: document.querySelector("#line-sim-btn"),
  lineSimResult: document.querySelector("#line-sim-result"),
  lineSimForm: document.querySelector("#line-sim-form"),
  lineSimStatus: document.querySelector("#line-sim-status"),
  lineSimClear: document.querySelector("#line-sim-clear"),
  lineSimShopName: document.querySelector("#line-sim-shop-name"),
};

const errorMessages = {
  EMAIL_EXISTS: "อีเมลนี้ถูกสมัครสมาชิกไว้แล้ว",
  INVALID_CREDENTIALS: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  UNAUTHORIZED: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่",
  VALIDATION_ERROR: "กรุณาตรวจสอบข้อมูลที่กรอกอีกครั้ง",
  RATE_LIMITED: "ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอประมาณ 1 นาที",
  FORBIDDEN: "บัญชีนี้ไม่มีสิทธิ์แก้ไขข้อมูลร้าน",
  NOT_FOUND: "ไม่พบข้อมูล หรือคุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้",
};

const icons = {
  alert: `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8.25v4.5m0 3h.01M10.33 4.63 3.96 16.1a1.5 1.5 0 0 0 1.31 2.23h13.46a1.5 1.5 0 0 0 1.31-2.23L13.67 4.63a.96.96 0 0 0-1.68 0Z" /></svg>`,
  check: `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="m5.25 12.75 4.5 4.5 9-9" /></svg>`,
  arrow: `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 12h13.5m-5.25-5.25L18.75 12l-5.25 5.25" /></svg>`,
  store: `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-7"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.25h16.5l-1.25-4.5H5l-1.25 4.5Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 9.25v9.5h13.5v-9.5M9 18.75V14h6v4.75" /></svg>`,
};

async function apiRequest(
  path,
  { method = "GET", body, signal, withMeta = false } = {}
) {
  const headers = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    signal,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const code = payload.error?.code;
    const message =
      errorMessages[code] ||
      payload.error?.message ||
      `เกิดข้อผิดพลาด HTTP ${response.status}`;

    const error = new Error(message);
    error.code = code;
    error.status = response.status;
    error.details = payload.error?.details || [];

    throw error;
  }

  return withMeta ? payload : payload.data;
}

function showNotification(type, title, message) {
  clearTimeout(notificationTimer);

  const isSuccess = type === "success";

  elements.notification.classList.remove("hidden");
  elements.notification.classList.toggle("border-emerald-200", isSuccess);
  elements.notification.classList.toggle("border-red-200", !isSuccess);

  elements.notificationIcon.className = [
    "flex size-9 shrink-0 items-center justify-center rounded-full",
    isSuccess ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
  ].join(" ");

  elements.notificationIcon.innerHTML = isSuccess ? icons.check : icons.alert;
  elements.notificationTitle.textContent = title;
  elements.notificationMessage.textContent = message;

  notificationTimer = setTimeout(() => {
    elements.notification.classList.add("hidden");
  }, 4500);
}

function setButtonLoading(button, loading, loadingText) {
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    return;
  }

  button.textContent = button.dataset.originalText || button.textContent;
  button.disabled = false;
}

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

function createShopCard(shop) {
  const card = document.createElement("button");

  card.type = "button";
  card.className = [
    "group rounded-3xl border border-slate-200 bg-white p-5 text-left",
    "shadow-sm transition hover:-translate-y-1 hover:border-blue-200",
    "hover:shadow-xl hover:shadow-blue-900/5",
  ].join(" ");

  const top = document.createElement("div");
  top.className = "flex items-start justify-between gap-4";

  const icon = document.createElement("div");
  icon.className = [
    "flex size-12 items-center justify-center rounded-2xl",
    "bg-gradient-to-br from-blue-100 to-cyan-100 text-2xl",
  ].join(" ");
  icon.innerHTML = icons.store;

  const arrow = document.createElement("span");
  arrow.className = [
    "text-lg text-slate-300 transition",
    "group-hover:translate-x-1 group-hover:text-blue-600",
  ].join(" ");
  arrow.innerHTML = icons.arrow;

  top.append(icon, arrow);

  const name = document.createElement("h3");
  name.className = "mt-5 text-lg font-bold text-slate-900";
  name.textContent = shop.name;

  const description = document.createElement("p");
  description.className =
    "mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500";
  description.textContent = shop.description || "ยังไม่ได้เพิ่มรายละเอียดร้าน";

  const footer = document.createElement("div");
  footer.className =
    "mt-5 flex items-center justify-between border-t border-slate-100 pt-4";

  const role = document.createElement("span");
  role.className =
    "rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700";
  role.textContent = shop.member_role === "owner" ? "เจ้าของร้าน" : "เจ้าหน้าที่";

  const action = document.createElement("span");
  action.className = "text-xs font-semibold text-slate-400";
  action.textContent = "เปิดร้าน";

  footer.append(role, action);
  card.append(top, name, description, footer);

  card.addEventListener("click", () => {
    Router.push(shopRoute(shop.id), undefined, { shallow: true, scroll: false });
  });

  return card;
}

function renderShops(shops) {
  elements.shopList.replaceChildren();
  elements.shopCount.textContent = String(shops.length);
  elements.shopLoading.classList.add("hidden");

  if (shops.length === 0) {
    elements.emptyShops.classList.remove("hidden");
    return;
  }

  elements.emptyShops.classList.add("hidden");

  for (const shop of shops) {
    elements.shopList.append(createShopCard(shop));
  }
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

switchAuthTab("login");

Router.events.on("routeChangeComplete", (url) => {
  if (url.startsWith("/app")) void syncDashboardRoute(url);
});

if (accessToken) {
  loadDashboard();
} else {
  showAuthView();
}
