(function () {
  var api = window.ImMbaAnnouncements;
  if (!api) return;

  var listEl = document.getElementById("admin-list");
  var countEl = document.getElementById("admin-count");
  var statusEl = document.getElementById("admin-status");
  var formPanel = document.getElementById("admin-form-panel");
  var form = document.getElementById("admin-form");
  var formTitle = document.getElementById("admin-form-title");
  var editingId = null;
  var statusTimer = null;

  function isEn() {
    return document.documentElement.getAttribute("data-locale") === "en";
  }

  function t(zh, en) {
    return isEn() ? en : zh;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showStatus(message, kind) {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.className = "admin-status is-" + (kind || "ok");
    statusEl.textContent = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () {
      statusEl.hidden = true;
    }, 4200);
  }

  function syncListOrder(list) {
    return list.slice().sort(function (a, b) {
      if (!!a.top !== !!b.top) return a.top ? -1 : 1;
      return String(b.date).localeCompare(String(a.date));
    });
  }

  function newId() {
    return "local-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function readForm() {
    var date = document.getElementById("admin-date").value.trim();
    return api.normalizeItem({
      id: editingId || newId(),
      date: date,
      dateLabel: api.dateLabelFromIso(date),
      top: document.getElementById("admin-top").checked,
      zh: {
        title: document.getElementById("admin-zh-title").value.trim(),
        url: document.getElementById("admin-zh-url").value.trim(),
        content: document.getElementById("admin-zh-content").value.trim()
      },
      en: {
        title: document.getElementById("admin-en-title").value.trim(),
        url: document.getElementById("admin-en-url").value.trim(),
        content: document.getElementById("admin-en-content").value.trim()
      }
    });
  }

  function fillForm(item) {
    document.getElementById("admin-id").value = item ? item.id : "";
    document.getElementById("admin-date").value = item ? item.date : "";
    document.getElementById("admin-top").checked = !!(item && item.top);
    document.getElementById("admin-zh-title").value = item ? item.zh.title : "";
    document.getElementById("admin-zh-url").value = item ? item.zh.url : "";
    document.getElementById("admin-zh-content").value = item ? item.zh.content || "" : "";
    document.getElementById("admin-en-title").value = item ? item.en.title : "";
    document.getElementById("admin-en-url").value = item ? item.en.url : "";
    document.getElementById("admin-en-content").value = item ? item.en.content || "" : "";
  }

  function openForm(mode, item) {
    editingId = mode === "edit" && item ? item.id : null;
    formTitle.innerHTML =
      mode === "edit"
        ? '<span class="zh">編輯公告</span><span class="en">Edit announcement</span>'
        : '<span class="zh">新增公告</span><span class="en">Add announcement</span>';
    fillForm(item || null);
    formPanel.hidden = false;
    formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("admin-date").focus();
  }

  function closeForm() {
    editingId = null;
    form.reset();
    formPanel.hidden = true;
  }

  function persist(list, messageZh, messageEn) {
    var next = syncListOrder(list);
    api.saveAll(next);
    renderList();
    showStatus(t(messageZh, messageEn), "ok");
  }

  function renderList() {
    var list = api.getAll();
    if (countEl) {
      countEl.textContent = t(
        "共 " + list.length + " 則公告",
        list.length + " announcement" + (list.length === 1 ? "" : "s")
      );
    }
    if (!listEl) return;

    if (!list.length) {
      listEl.innerHTML =
        '<p class="admin-empty">' +
        t("目前沒有公告。請新增一則，或還原預設清單。", "No announcements yet. Add one, or restore the default list.") +
        "</p>";
      return;
    }

    listEl.innerHTML = list
      .map(function (item) {
        var title = isEn() ? item.en.title : item.zh.title;
        var top = item.top ? '<span class="announce-top">TOP</span>' : "";
        return (
          '<article class="admin-row" data-id="' +
          escapeHtml(item.id) +
          '">' +
          '<div class="admin-row-main">' +
          '<div class="admin-row-meta">' +
          '<time datetime="' +
          escapeHtml(item.date) +
          '">' +
          escapeHtml(item.dateLabel) +
          "</time>" +
          top +
          "</div>" +
          '<h3 class="admin-row-title">' +
          escapeHtml(title) +
          "</h3>" +
          '<p class="admin-row-sub">' +
          escapeHtml(isEn() ? item.zh.title : item.en.title) +
          "</p>" +
          (function () {
            var body = isEn() ? item.en.content : item.zh.content;
            if (!body) return "";
            var preview = body.length > 120 ? body.slice(0, 120) + "…" : body;
            return '<p class="admin-row-body">' + escapeHtml(preview) + "</p>";
          })() +
          "</div>" +
          '<div class="admin-row-actions">' +
          '<button type="button" class="btn btn-outline admin-btn-edit" data-edit="' +
          escapeHtml(item.id) +
          '">' +
          t("編輯", "Edit") +
          "</button>" +
          '<button type="button" class="btn admin-btn-delete" data-delete="' +
          escapeHtml(item.id) +
          '">' +
          t("刪除", "Delete") +
          "</button>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function findById(id) {
    return api.getAll().find(function (item) {
      return item.id === id;
    });
  }

  document.getElementById("admin-btn-add").addEventListener("click", function () {
    openForm("add");
  });

  document.getElementById("admin-btn-cancel").addEventListener("click", closeForm);

  document.getElementById("admin-btn-restore").addEventListener("click", function () {
    var ok = window.confirm(
      t(
        "確定要還原預設公告清單嗎？目前自訂內容將被清除。",
        "Restore the default announcement list? Custom changes will be cleared."
      )
    );
    if (!ok) return;
    closeForm();
    api.restoreDefaults();
    renderList();
    showStatus(
      t("已還原預設公告清單，並同步到前台。", "Default list restored and synced to the homepage."),
      "ok"
    );
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;

    var item = readForm();
    if (!item.zh.title || !item.en.title || !item.zh.url || !item.en.url || !item.date) {
      showStatus(t("請完整填寫必填欄位。", "Please complete all required fields."), "err");
      return;
    }

    var list = api.getAll();
    if (editingId) {
      var updated = false;
      list = list.map(function (row) {
        if (row.id !== editingId) return row;
        updated = true;
        return item;
      });
      if (!updated) list.unshift(item);
      persist(list, "公告已更新，並同步到前台最新消息。", "Announcement updated and synced to the homepage.");
    } else {
      list.unshift(item);
      persist(list, "公告已新增，並同步到前台最新消息。", "Announcement added and synced to the homepage.");
    }
    closeForm();
  });

  listEl.addEventListener("click", function (event) {
    var editBtn = event.target.closest("[data-edit]");
    if (editBtn) {
      var editItem = findById(editBtn.getAttribute("data-edit"));
      if (editItem) openForm("edit", editItem);
      return;
    }
    var deleteBtn = event.target.closest("[data-delete]");
    if (deleteBtn) {
      var id = deleteBtn.getAttribute("data-delete");
      var target = findById(id);
      var label = target
        ? isEn()
          ? target.en.title
          : target.zh.title
        : id;
      var ok = window.confirm(
        t("確定刪除這則公告？\n", "Delete this announcement?\n") + label
      );
      if (!ok) return;
      var next = api.getAll().filter(function (row) {
        return row.id !== id;
      });
      if (editingId === id) closeForm();
      persist(next, "公告已刪除，並同步到前台。", "Announcement deleted and synced to the homepage.");
    }
  });

  var localeToggle = document.querySelector("[data-locale-toggle]");
  if (localeToggle) {
    localeToggle.addEventListener("click", function () {
      setTimeout(renderList, 0);
    });
  }

  window.addEventListener("storage", function (event) {
    if (event.key === api.STORAGE_KEY) renderList();
  });

  function boot() {
    renderList();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
