import { createKnowledgeManager } from "./knowledgeManager.js";
import Router from "next/router";
import { elements } from './dashboard/elements.js';
import { createApiClient } from './dashboard/apiClient.js';
import { showNotification, setButtonLoading } from './dashboard/feedback.js';
import { renderShops } from './dashboard/shopCards.js';
import { createLineSettings } from './dashboard/lineSettings.js';
import { createLineSimulator } from './dashboard/lineSimulator.js';
import { parseDashboardRoute, shopRoute } from "../utils/dashboardRoutes.js";

const TOKEN_KEY = "smb_access_token";

let accessToken = sessionStorage.getItem(TOKEN_KEY) || "";
const apiRequest = createApiClient(() => accessToken);

// เก็บรหัสร้านที่กำลังแก้ไขเพื่อส่งคำขอไปยังร้านที่ถูกต้อง
let selectedShopId = "";
let selectedShopRole = "agent";
let openShopVersion = 0;

const { loadLineConfig } = createLineSettings({
  apiRequest,
  getSelectedShopId: () => selectedShopId,
  showNotification,
  setButtonLoading,
});
const { resetSimulator } = createLineSimulator({
  apiRequest,
  getSelectedShopId: () => selectedShopId,
  setButtonLoading,
});

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
    item.tab.className = selected
      ? "app-settings-tab app-settings-tab--active"
      : "app-settings-tab";
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
    ? "app-auth-tab app-auth-tab--active"
    : "app-auth-tab";

  elements.registerTab.className = !loginSelected
    ? "app-auth-tab app-auth-tab--active"
    : "app-auth-tab";
}

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
