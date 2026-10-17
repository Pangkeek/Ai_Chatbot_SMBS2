// จัดการผลทดสอบแชต โดยแยกออกจากการนำทางของแดชบอร์ด
export function createLineSimulator({ elements, listen, apiRequest, getSelectedShopId, setButtonLoading }) {
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
    listen(button, "click", () => {
      elements.lineSimText.value = getSelectedShopId() === "shop-flower"
        ? button.dataset.simPromptFlower || button.dataset.simPrompt
        : button.dataset.simPrompt;
      elements.lineSimText.focus();
    });
  }
  listen(elements.lineSimClear, "click", resetSimulator);
  listen(elements.lineSimUser, "change", resetSimulator);
  listen(elements.lineSimForm, "submit", async (event) => {
    event.preventDefault();
    if (!getSelectedShopId() || simulatorBusy) return;
    const userId = elements.lineSimUser.value.trim() || "line-user-demo-1";
    const text = elements.lineSimText.value.trim();
    if (!text) {
      elements.lineSimText.focus();
      return;
    }
    const shopId = getSelectedShopId();
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
      if (version !== simulatorVersion || shopId !== getSelectedShopId()) return;
      pending.remove();
      if (result.replied && result.reply_text) {
        appendSimulatorMessage("bot", result.reply_text);
        const methodLabels = {
          faq: "FAQ ตรงคำถาม",
          generator: "AI เลือกคำตอบจากข้อมูลที่ค้นได้",
          extractive: "คัดคำตอบจากข้อมูลร้านหรือคลังความรู้",
          no_evidence: "ไม่พบหลักฐานเพียงพอ",
        };
        const sourceIds = Array.isArray(result.reply_source_ids) ? result.reply_source_ids : [];
        appendSimulatorMessage("system", [
          `วิธีตอบ: ${methodLabels[result.reply_method] || "ไม่ระบุ"}`,
          `แหล่งข้อมูล: ${sourceIds.length ? sourceIds.map(id => id.endsWith(":business-profile") ? "ข้อมูลธุรกิจ" : id).join(", ") : "ไม่มี"}`,
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
      if (version !== simulatorVersion || shopId !== getSelectedShopId()) return;
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
  return { resetSimulator };
}
