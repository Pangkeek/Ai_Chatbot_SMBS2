import { PAGE_SIZE, filterKnowledgeEntries, paginateKnowledgeEntries, fetchAllKnowledgeEntries } from './knowledge/data.js';
import { getKnowledgeElements } from './knowledge/elements.js';
import { createKnowledgeCard } from './knowledge/card.js';

export { filterKnowledgeEntries, paginateKnowledgeEntries, fetchAllKnowledgeEntries } from './knowledge/data.js';

export function createKnowledgeManager({
  listen,
  apiRequest,
  showNotification,
  onUnauthorized,
}) {
  const elements = getKnowledgeElements();
  const knowledgeCard = (entry) => createKnowledgeCard(entry, {
    isOwner,
    openForm,
    toggleStatus,
    openDelete,
  });

  const state = {
    shopId: "",
    memberRole: "agent",
    entries: [],
    page: 1,
    loaded: false,
    loading: false,
    requestVersion: 0,
    controller: null,
    editingEntry: null,
    deletingEntry: null,
    formSnapshot: "",
    returnFocus: null,
  };

  const isOwner = () => state.memberRole === "owner";

  function filters() {
    return {
      query: elements.search.value,
      kind: elements.kindFilter.value,
      status: elements.statusFilter.value,
    };
  }

  function setHidden(node, hidden) {
    node.classList.toggle("hidden", hidden);
  }

  function updateStats() {
    elements.totalCount.textContent = String(state.entries.length);
    elements.publishedCount.textContent = String(
      state.entries.filter((entry) => entry.status === "published").length
    );
    elements.draftCount.textContent = String(
      state.entries.filter((entry) => entry.status === "draft").length
    );
  }

  function render() {
    updateStats();
    elements.list.replaceChildren();
    setHidden(elements.loading, true);
    setHidden(elements.error, true);

    const filtered = filterKnowledgeEntries(state.entries, filters());
    const pageData = paginateKnowledgeEntries(filtered, state.page);
    state.page = pageData.page;

    const noEntries = state.entries.length === 0;
    const noMatches = !noEntries && filtered.length === 0;
    setHidden(elements.empty, !noEntries && !noMatches);
    if (noEntries || noMatches) {
      elements.emptyTitle.textContent = noEntries
        ? "ยังไม่มีข้อมูลความรู้"
        : "ไม่พบข้อมูลที่ค้นหา";
      elements.emptyMessage.textContent = noEntries
        ? isOwner()
          ? "เพิ่มข้อมูลแรกเพื่อให้ Chatbot เริ่มตอบจากข้อมูลของร้าน"
          : "ร้านนี้ยังไม่มีข้อมูลความรู้"
        : "ลองเปลี่ยนคำค้นหา ประเภท หรือสถานะ แล้วค้นหาอีกครั้ง";
    }

    for (const entry of pageData.entries) {
      elements.list.append(knowledgeCard(entry));
    }

    const hasResults = filtered.length > 0;
    setHidden(elements.pagination, !hasResults);
    if (hasResults) {
      const first = pageData.start + 1;
      const last = Math.min(pageData.start + PAGE_SIZE, filtered.length);
      elements.resultsSummary.textContent = `แสดง ${first}–${last} จาก ${filtered.length} รายการ`;
      elements.pageLabel.textContent = `หน้า ${state.page}/${pageData.pageCount}`;
      elements.prevButton.disabled = state.page <= 1;
      elements.nextButton.disabled = state.page >= pageData.pageCount;
    }
  }

  function showLoadError(error) {
    setHidden(elements.loading, true);
    setHidden(elements.empty, true);
    setHidden(elements.pagination, true);
    elements.list.replaceChildren();
    elements.errorMessage.textContent = error.message;
    setHidden(elements.error, false);
  }

  async function load({ force = false } = {}) {
    if (!state.shopId || (!force && (state.loading || state.loaded))) return;
    state.loading = true;
    state.loaded = false;
    const shopId = state.shopId;
    const version = ++state.requestVersion;
    state.controller?.abort();
    state.controller = new AbortController();

    setHidden(elements.error, true);
    setHidden(elements.empty, true);
    setHidden(elements.pagination, true);
    elements.list.replaceChildren();
    setHidden(elements.loading, false);

    try {
      const all = await fetchAllKnowledgeEntries({
        shopId,
        apiRequest,
        signal: state.controller.signal,
      });

      if (version !== state.requestVersion || shopId !== state.shopId) return;
      state.entries = all;
      state.loaded = true;
      state.page = 1;
      render();
    } catch (error) {
      if (error.name === "AbortError") return;
      if (error.status === 401) {
        onUnauthorized(error);
        return;
      }
      if (version === state.requestVersion && shopId === state.shopId) {
        showLoadError(error);
      }
    } finally {
      if (version === state.requestVersion) state.loading = false;
    }
  }

  function formValues() {
    const formData = new FormData(elements.form);
    return {
      kind: String(formData.get("kind") || "faq"),
      title: String(formData.get("title") || "").trim(),
      content: String(formData.get("content") || "").trim(),
      status: String(formData.get("status") || "draft"),
    };
  }

  function serializeForm() {
    return JSON.stringify(formValues());
  }

  function formIsDirty() {
    return serializeForm() !== state.formSnapshot;
  }

  function updateFormLabels() {
    const faq = elements.kind.value === "faq";
    elements.titleLabel.textContent = faq ? "คำถาม" : "หัวข้อ";
    elements.contentLabel.textContent = faq ? "คำตอบ" : "เนื้อหา";
    elements.title.placeholder = faq
      ? "เช่น ร้านเปิดกี่โมง"
      : "ระบุหัวข้อที่ค้นหาได้ง่าย";
    elements.content.placeholder = faq
      ? "เขียนคำตอบที่ชัดเจนและพร้อมให้ Chatbot นำไปใช้"
      : "อธิบายข้อมูลให้ครบถ้วนและไม่กำกวม";
  }

  function updateCounts() {
    elements.titleCount.textContent = `${elements.title.value.length}/200`;
    elements.contentCount.textContent = `${elements.content.value.length.toLocaleString("th-TH")}/20,000`;
  }

  function clearFormErrors() {
    for (const node of [
      elements.titleError,
      elements.contentError,
      elements.formError,
    ]) {
      node.textContent = "";
      setHidden(node, true);
    }
    elements.title.removeAttribute("aria-invalid");
    elements.content.removeAttribute("aria-invalid");
  }

  function showFieldError(field, message) {
    const input = field === "title" ? elements.title : elements.content;
    const error = field === "title" ? elements.titleError : elements.contentError;
    input.setAttribute("aria-invalid", "true");
    error.textContent = message;
    setHidden(error, false);
  }

  function validateForm(values) {
    clearFormErrors();
    let valid = true;
    if (!values.title) {
      showFieldError("title", "กรุณากรอกหัวข้อ");
      valid = false;
    }
    if (!values.content) {
      showFieldError("content", "กรุณากรอกเนื้อหา");
      valid = false;
    }
    return valid;
  }

  function openForm(entry = null) {
    if (!isOwner()) return;
    state.editingEntry = entry;
    state.returnFocus = document.activeElement;
    elements.form.reset();
    elements.kind.value = entry?.kind || "faq";
    elements.title.value = entry?.title || "";
    elements.content.value = entry?.content || "";
    const selectedStatus = elements.form.querySelector(
      `input[name="status"][value="${entry?.status || "draft"}"]`
    );
    if (selectedStatus) selectedStatus.checked = true;
    elements.modalTitle.textContent = entry
      ? "แก้ไขข้อมูลความรู้"
      : "เพิ่มข้อมูลความรู้";
    elements.formSubmit.textContent = entry ? "บันทึกการแก้ไข" : "บันทึกข้อมูล";
    clearFormErrors();
    updateFormLabels();
    updateCounts();
    state.formSnapshot = serializeForm();
    elements.modal.classList.remove("hidden");
    elements.modal.classList.add("flex");
    document.body.classList.add("overflow-hidden");
    window.setTimeout(() => elements.title.focus(), 0);
  }

  function closeForm({ force = false } = {}) {
    if (!elements.modal.classList.contains("hidden") && !force && formIsDirty()) {
      const discard = window.confirm(
        "มีข้อมูลที่ยังไม่ได้บันทึก ต้องการปิดและละทิ้งการแก้ไขหรือไม่?"
      );
      if (!discard) return false;
    }
    elements.modal.classList.add("hidden");
    elements.modal.classList.remove("flex");
    document.body.classList.remove("overflow-hidden");
    state.editingEntry = null;
    state.returnFocus?.focus?.();
    return true;
  }

  function mutationError(error, fallback) {
    if (error.status === 401) {
      closeForm({ force: true });
      closeDelete();
      onUnauthorized(error);
      return true;
    }
    const message =
      error.status === 403
        ? "เฉพาะเจ้าของร้านเท่านั้นที่แก้ไขข้อมูลความรู้ได้"
        : error.status === 404
          ? "ไม่พบรายการนี้แล้ว กรุณาปิดหน้าต่างและโหลดข้อมูลใหม่"
          : error.message || fallback;
    return message;
  }

  async function submitForm(event) {
    event.preventDefault();
    if (!isOwner() || elements.formSubmit.disabled) return;
    const values = formValues();
    if (!validateForm(values)) return;

    const shopId = state.shopId;
    const editingId = state.editingEntry?.id;
    elements.formSubmit.disabled = true;
    elements.formSubmit.textContent = "กำลังบันทึก…";
    clearFormErrors();
    try {
      const path = editingId
        ? `/shops/${encodeURIComponent(shopId)}/knowledge/${encodeURIComponent(editingId)}`
        : `/shops/${encodeURIComponent(shopId)}/knowledge`;
      await apiRequest(path, {
        method: editingId ? "PATCH" : "POST",
        body: values,
      });
      if (shopId !== state.shopId) return;
      closeForm({ force: true });
      await load({ force: true });
      showNotification(
        "success",
        editingId ? "บันทึกการแก้ไขแล้ว" : "เพิ่มข้อมูลแล้ว",
        `อัปเดต “${values.title}” เรียบร้อยแล้ว`
      );
    } catch (error) {
      const message = mutationError(error, "บันทึกข้อมูลไม่สำเร็จ");
      if (message === true) return;
      elements.formError.textContent = message;
      setHidden(elements.formError, false);
      for (const detail of error.details || []) {
        if (detail.field?.endsWith(".title")) showFieldError("title", detail.message);
        if (detail.field?.endsWith(".content")) showFieldError("content", detail.message);
      }
    } finally {
      elements.formSubmit.disabled = false;
      elements.formSubmit.textContent = state.editingEntry
        ? "บันทึกการแก้ไข"
        : "บันทึกข้อมูล";
    }
  }

  async function toggleStatus(entry, button) {
    if (!isOwner() || button.disabled) return;
    const shopId = state.shopId;
    const status = entry.status === "published" ? "draft" : "published";
    button.disabled = true;
    const original = button.textContent;
    button.textContent = "กำลังบันทึก…";
    try {
      await apiRequest(
        `/shops/${encodeURIComponent(shopId)}/knowledge/${encodeURIComponent(entry.id)}`,
        { method: "PATCH", body: { status } }
      );
      if (shopId !== state.shopId) return;
      await load({ force: true });
      showNotification(
        "success",
        status === "published" ? "เผยแพร่แล้ว" : "เปลี่ยนเป็นฉบับร่างแล้ว",
        `อัปเดตสถานะ “${entry.title}” เรียบร้อยแล้ว`
      );
    } catch (error) {
      const message = mutationError(error, "เปลี่ยนสถานะไม่สำเร็จ");
      if (message !== true) showNotification("error", "เปลี่ยนสถานะไม่สำเร็จ", message);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function openDelete(entry) {
    if (!isOwner()) return;
    state.deletingEntry = entry;
    state.returnFocus = document.activeElement;
    elements.deleteDescription.textContent = `รายการ “${entry.title}” จะถูกลบถาวรและไม่สามารถกู้คืนได้`;
    elements.deleteError.textContent = "";
    setHidden(elements.deleteError, true);
    elements.deleteModal.classList.remove("hidden");
    elements.deleteModal.classList.add("flex");
    document.body.classList.add("overflow-hidden");
    window.setTimeout(() => elements.deleteCancel.focus(), 0);
  }

  function closeDelete() {
    elements.deleteModal.classList.add("hidden");
    elements.deleteModal.classList.remove("flex");
    if (elements.modal.classList.contains("hidden")) {
      document.body.classList.remove("overflow-hidden");
    }
    state.deletingEntry = null;
    state.returnFocus?.focus?.();
  }

  async function confirmDelete() {
    const entry = state.deletingEntry;
    if (!entry || !isOwner() || elements.deleteConfirm.disabled) return;
    const shopId = state.shopId;
    elements.deleteConfirm.disabled = true;
    elements.deleteConfirm.textContent = "กำลังลบ…";
    try {
      await apiRequest(
        `/shops/${encodeURIComponent(shopId)}/knowledge/${encodeURIComponent(entry.id)}`,
        { method: "DELETE" }
      );
      if (shopId !== state.shopId) return;
      closeDelete();
      await load({ force: true });
      showNotification("success", "ลบข้อมูลแล้ว", `ลบ “${entry.title}” เรียบร้อยแล้ว`);
    } catch (error) {
      const message = mutationError(error, "ลบข้อมูลไม่สำเร็จ");
      if (message === true) return;
      elements.deleteError.textContent = message;
      setHidden(elements.deleteError, false);
    } finally {
      elements.deleteConfirm.disabled = false;
      elements.deleteConfirm.textContent = "ลบถาวร";
    }
  }

  function trapFocus(event, container) {
    if (event.key !== "Tab") return;
    const focusable = [...container.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter((node) => !node.closest(".hidden"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function reset() {
    state.requestVersion++;
    state.controller?.abort();
    state.shopId = "";
    state.entries = [];
    state.loaded = false;
    state.loading = false;
    state.page = 1;
    closeForm({ force: true });
    closeDelete();
    elements.search.value = "";
    elements.kindFilter.value = "all";
    elements.statusFilter.value = "all";
    render();
  }

  function setShop(shop) {
    const changed = state.shopId !== shop.id;
    if (changed) {
      state.requestVersion++;
      state.controller?.abort();
      state.entries = [];
      state.loaded = false;
      state.loading = false;
      state.page = 1;
      elements.search.value = "";
      elements.kindFilter.value = "all";
      elements.statusFilter.value = "all";
    }
    state.shopId = shop.id;
    state.memberRole = shop.member_role;
    elements.addButton.hidden = !isOwner();
    setHidden(elements.readonlyNotice, isOwner());
    render();
  }

  listen(elements.addButton, "click", () => openForm());
  listen(elements.retryButton, "click", () => load({ force: true }));
  for (const control of [elements.search, elements.kindFilter, elements.statusFilter]) {
    listen(control, "input", () => {
      state.page = 1;
      render();
    });
  }
  listen(elements.prevButton, "click", () => {
    state.page--;
    render();
    elements.section.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  listen(elements.nextButton, "click", () => {
    state.page++;
    render();
    elements.section.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  listen(elements.kind, "change", updateFormLabels);
  listen(elements.title, "input", updateCounts);
  listen(elements.content, "input", updateCounts);
  listen(elements.form, "submit", submitForm);
  listen(elements.modalClose, "click", () => closeForm());
  listen(elements.formCancel, "click", () => closeForm());
  listen(elements.modal, "click", (event) => {
    if (event.target === elements.modal) closeForm();
  });
  listen(elements.deleteCancel, "click", closeDelete);
  listen(elements.deleteConfirm, "click", confirmDelete);
  listen(elements.deleteModal, "click", (event) => {
    if (event.target === elements.deleteModal) closeDelete();
  });
  listen(document, "keydown", (event) => {
    if (!elements.deleteModal.classList.contains("hidden")) {
      if (event.key === "Escape") closeDelete();
      trapFocus(event, elements.deleteModal);
      return;
    }
    if (!elements.modal.classList.contains("hidden")) {
      if (event.key === "Escape") closeForm();
      trapFocus(event, elements.modal);
    }
  });

  return { load, reset, setShop };
}
