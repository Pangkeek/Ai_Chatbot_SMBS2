// ดูแลการตั้งค่า LINE ของร้านที่กำลังเปิดอยู่
export function createLineSettings({ elements, listen, apiRequest, getSelectedShopId, showNotification, setButtonLoading }) {
  async function loadLineConfig(shopId) {
    try {
      const origin = window.location.origin;
      elements.lineWebhookUrl.value = `${origin}/api/v1/shops/${encodeURIComponent(
        shopId
      )}/line/webhook`;

      const config = await apiRequest(
        `/shops/${encodeURIComponent(shopId)}/line/config`
      );
      if (shopId !== getSelectedShopId()) return;
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
      if (shopId === getSelectedShopId()) {
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
      if (shopId !== getSelectedShopId()) return;
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
      if (shopId !== getSelectedShopId()) return;
      elements.lineStatusBadge.textContent = "ตรวจสอบไม่สำเร็จ";
      elements.lineVerificationDetail.textContent = error.message;
    } finally {
      if (shopId === getSelectedShopId()) setButtonLoading(elements.verifyLineBtn, false);
    }
  }

  listen(elements.verifyLineBtn, "click", () => verifyLineForShop(getSelectedShopId()));

  if (elements.copyWebhookBtn) {
    listen(elements.copyWebhookBtn, "click", async () => {
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
    listen(elements.lineSettingsForm, "submit", async (event) => {
      event.preventDefault();
      if (!getSelectedShopId()) return;

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
          `/shops/${encodeURIComponent(getSelectedShopId())}/line/config`,
          {
            method: "PUT",
            body,
          }
        );
        await loadLineConfig(getSelectedShopId());
        showNotification("success", "บันทึกสำเร็จ", "บันทึกข้อมูล LINE แล้ว กรุณากดตรวจสอบกับ LINE");
      } catch (error) {
        showNotification("error", "บันทึกไม่สำเร็จ", error.message);
      } finally {
        setButtonLoading(button, false);
      }
    });
  }
  return { loadLineConfig };
}
