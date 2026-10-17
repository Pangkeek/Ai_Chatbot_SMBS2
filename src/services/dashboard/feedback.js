import { icons } from './elements.js';

export function createDashboardFeedback(elements) {
  let notificationTimer;

  // แสดงข้อความแจ้งเตือน แล้วซ่อนอัตโนมัติ
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

  return { showNotification, dispose: () => clearTimeout(notificationTimer) };
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

export { setButtonLoading };
