import { createKnowledgeManager } from "./knowledgeManager.js";
import Router from "next/router";
import { getDashboardElements } from './dashboard/elements.js';
import { createApiClient } from './dashboard/apiClient.js';
import { createDashboardFeedback, setButtonLoading } from './dashboard/feedback.js';
import { renderShops } from './dashboard/shopCards.js';
import { createLineSettings } from './dashboard/lineSettings.js';
import { createLineSimulator } from './dashboard/lineSimulator.js';
import { parseDashboardRoute, shopRoute } from "../utils/dashboardRoutes.js";
import { fillBusinessHours, readBusinessHours, setupBusinessHoursForm } from "./dashboard/businessHoursForm.js";
import { CHATBOT_PERSONA_STYLES, parseChatbotPersona, formatChatbotPersona } from "../utils/chatbotPersona.js";
import { fillBusinessProfile, readBusinessProfile, setupBusinessProfileForm } from "./dashboard/businessProfileForm.js";
import { summarizeBusinessProfile } from "../utils/businessProfile.js";
import { createAiPreview } from "./dashboard/aiPreview.js";

const TOKEN_KEY = "smb_access_token";

export function initializeDashboard() {
  const elements = getDashboardElements();
  const lifetime = new AbortController();
  let disposed = false;
  const listen = (target, event, handler) => target.addEventListener(event, handler, { signal: lifetime.signal });
  const feedback = createDashboardFeedback(elements);
  const showNotification = (...args) => {
    if (!disposed) feedback.showNotification(...args);
  };
  let accessToken = sessionStorage.getItem(TOKEN_KEY) || "";
  const request = createApiClient(() => accessToken);

  async function apiRequest(path, options = {}) {
    lifetime.signal.throwIfAborted();
    const result = await request(path, { ...options, signal: options.signal || lifetime.signal });
    // คำตอบจากหน้าที่ปิดไปแล้วต้องไม่เปลี่ยน session หรือหน้าปัจจุบัน
    lifetime.signal.throwIfAborted();
    return result;
  }

  // เก็บรหัสร้านที่กำลังแก้ไขเพื่อส่งคำขอไปยังร้านที่ถูกต้อง
  let selectedShopId = "";
  let selectedShopRole = "agent";
  let openShopVersion = 0;

  const { loadLineConfig } = createLineSettings({
    elements,
    listen,
    apiRequest,
    getSelectedShopId: () => selectedShopId,
    showNotification,
    setButtonLoading,
  });
  const { resetSimulator } = createLineSimulator({
    elements,
    listen,
    apiRequest,
    getSelectedShopId: () => selectedShopId,
    setButtonLoading,
  });
  const { reset: resetAiPreview } = createAiPreview({
    listen,
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
    if (selectedShopId !== shop.id) {
      resetSimulator();
      resetAiPreview();
    }
    selectedShopId = shop.id;
    selectedShopRole = shop.member_role;
    elements.lineSimShopName.textContent = shop.name;
    elements.settingsName.value = shop.name;
    fillBusinessProfile(elements.businessSettingsForm, shop.description);
    fillBusinessHours(elements.businessSettingsForm, shop.opening_hours);
    const persona = parseChatbotPersona(shop.persona);
    elements.settingsPersonaStyle.value = persona.style;
    elements.settingsPersonaDetails.value = persona.details;
    elements.businessSettingsForm.dataset.originalPersona = shop.persona || "";
    elements.businessSettingsForm.dataset.personaChanged = "false";
    updatePersonaHint();
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
      summarizeBusinessProfile(shop.description);
    elements.selectedShopHours.textContent =
      shop.opening_hours || "ยังไม่ได้กำหนดเวลาเปิดให้บริการ";
  }

  function saveSession(authData) {
    accessToken = authData.access_token;
    sessionStorage.setItem(TOKEN_KEY, accessToken);
  }

  function clearSession() {
    if (disposed) return;
    resetSimulator();
    resetAiPreview();
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
    listen,
    apiRequest,
    showNotification,
    onUnauthorized(error) {
      clearSession();
      showNotification("error", "กรุณาเข้าสู่ระบบใหม่", error.message);
    },
  });

  setupBusinessHoursForm(elements.businessSettingsForm, listen);
  setupBusinessProfileForm(elements.businessSettingsForm, listen);

  function updatePersonaHint() {
    const selected = CHATBOT_PERSONA_STYLES.find(([style]) => style === elements.settingsPersonaStyle.value);
    elements.settingsPersonaHint.textContent = selected?.[1] || "";
  }

  listen(elements.settingsPersonaStyle, "change", () => {
    elements.businessSettingsForm.dataset.personaChanged = "true";
    updatePersonaHint();
  });
  listen(elements.settingsPersonaDetails, "input", () => {
    elements.businessSettingsForm.dataset.personaChanged = "true";
  });

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
    if (disposed || !route || !accessToken) return;

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
    if (disposed) return;
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

      renderShops(shops, elements);
      if (parseDashboardRoute(window.location.pathname)?.shopId) {
        elements.dashboardHomeView.classList.add("hidden");
      }
      showDashboardView();
      await syncDashboardRoute();
    } catch (error) {
      if (disposed) return;
      elements.shopLoading.classList.add("hidden");
      // ตัด session เฉพาะเมื่อ server ปฏิเสธสิทธิ์ ไม่ใช่เมื่อเครือข่ายสะดุด
      if (error.status === 401) clearSession();
      showNotification("error", error.status === 401 ? "กรุณาเข้าสู่ระบบใหม่" : "โหลดข้อมูลไม่สำเร็จ", error.message);
    }
  }

  // ปุ่มย้อนกลับจากหน้าตั้งค่าไปยังหน้ารวมร้านค้า
  listen(elements.settingsBackButton, "click", () => {
    Router.push("/app", undefined, { shallow: true, scroll: false });
  });

  listen(elements.settingsBusinessTab, "click", () => {
    Router.push(shopRoute(selectedShopId), undefined, { shallow: true, scroll: false });
  });

  listen(elements.settingsKnowledgeTab, "click", () => {
    Router.push(shopRoute(selectedShopId, "knowledge"), undefined, { shallow: true, scroll: false });
  });

  listen(elements.settingsLineTab, "click", () => {
    Router.push(shopRoute(selectedShopId, "line"), undefined, { shallow: true, scroll: false });
  });

  // ส่งข้อมูลที่แก้ไขไปบันทึกด้วย PATCH เฉพาะร้านที่กำลังเลือก
  listen(elements.businessSettingsForm, "submit", async (event) => {
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

    let openingHours;
    try {
      openingHours = readBusinessHours(formElement);
    } catch (error) {
      showNotification("error", "ตรวจสอบเวลาเปิดให้บริการ", error.message);
      return;
    }

    setButtonLoading(button, true, "กำลังบันทึก...");

    try {
      const shop = await apiRequest(
        `/shops/${encodeURIComponent(selectedShopId)}`,
        {
          method: "PATCH",
          body: {
            name: readField("name"),
            description: readBusinessProfile(formElement),
            opening_hours: openingHours,
            // ถ้ายังไม่ได้แก้บุคลิก ให้คงข้อความเก่าไว้เมื่อบันทึกข้อมูลส่วนอื่น
            persona: formElement.dataset.personaChanged === "true" || !formElement.dataset.originalPersona
              ? formatChatbotPersona(elements.settingsPersonaStyle.value, elements.settingsPersonaDetails.value)
              : formElement.dataset.originalPersona,
          },
        }
      );

      // ใช้ข้อมูลที่ server ตอบกลับเป็นค่าจริงหลังบันทึก
      resetAiPreview();
      fillBusinessSettingsForm(shop);

      // โหลดรายการใหม่เพื่อให้ชื่อและรายละเอียดบนการ์ดเป็นปัจจุบัน
      const shops = await apiRequest("/shops");
      renderShops(shops, elements);

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

  listen(elements.loginForm, "submit", async (event) => {
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

  listen(elements.registerForm, "submit", async (event) => {
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

  listen(elements.shopForm, "submit", async (event) => {
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

  listen(elements.logoutButton, "click", async () => {
    elements.logoutButton.disabled = true;

    try {
      await apiRequest("/auth/logout", {
        method: "POST",
      });
    } catch {
      // ลบ session ใน browser แม้ server จะติดต่อไม่ได้
    } finally {
      if (disposed) return;
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

  const onRouteChange = (url) => {
    if (url.startsWith("/app")) void syncDashboardRoute(url);
  };
  Router.events.on("routeChangeComplete", onRouteChange);

  if (accessToken) {
    showDashboardView();
    loadDashboard();
  } else {
    showAuthView();
  }

  return () => {
    disposed = true;
    openShopVersion++;
    lifetime.abort();
    knowledgeManager.reset();
    resetAiPreview();
    resetSimulator();
    feedback.dispose();
    Router.events.off("routeChangeComplete", onRouteChange);
  };
}
