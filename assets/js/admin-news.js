(function () {
  var api = window.ImMbaAnnouncements;
  if (!api) return;

  var listEl = document.getElementById("admin-list");
  var countEl = document.getElementById("admin-count");
  var statusEl = document.getElementById("admin-status");
  var formPanel = document.getElementById("admin-form-panel");
  var form = document.getElementById("admin-form");
  var formTitle = document.getElementById("admin-form-title");
  var syncBox = document.getElementById("admin-sync-box");
  var syncText = document.getElementById("admin-sync-text");
  var previewPanel = document.getElementById("admin-preview-panel");
  var previewGrid = document.getElementById("admin-preview-grid");
  var autoTranslateEl = document.getElementById("admin-auto-translate");

  var editingId = null;
  var statusTimer = null;
  var translateTimer = null;
  var translating = false;
  /** Fields filled by auto-translate; cleared when user edits that field. */
  var autoFilled = { "en-title": false, "en-content": false, "zh-title": false, "zh-content": false };
  var mediaDraft = { photoUrl: "", fileUrl: "", fileName: "" };
  var MAX_MEDIA_BYTES = 1.5 * 1024 * 1024;

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
    }, 4800);
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

  function getTranslateDir() {
    var checked = form.querySelector('input[name="admin-translate-dir"]:checked');
    return checked ? checked.value : "zh-en";
  }

  function els() {
    return {
      date: document.getElementById("admin-date"),
      top: document.getElementById("admin-top"),
      zhTitle: document.getElementById("admin-zh-title"),
      zhUrl: document.getElementById("admin-zh-url"),
      zhContent: document.getElementById("admin-zh-content"),
      enTitle: document.getElementById("admin-en-title"),
      enUrl: document.getElementById("admin-en-url"),
      enContent: document.getElementById("admin-en-content")
    };
  }

  function setPhotoPreview(url) {
    var box = document.getElementById("admin-photo-preview");
    var img = document.getElementById("admin-photo-preview-img");
    if (!box || !img) return;
    if (url) {
      img.src = url;
      box.hidden = false;
    } else {
      img.removeAttribute("src");
      box.hidden = true;
    }
  }

  function setFilePreview(name) {
    var box = document.getElementById("admin-file-preview");
    var label = document.getElementById("admin-file-name");
    if (!box || !label) return;
    if (name) {
      label.textContent = name;
      box.hidden = false;
    } else {
      label.textContent = "";
      box.hidden = true;
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        resolve("");
        return;
      }
      if (file.size > MAX_MEDIA_BYTES) {
        reject(new Error(t("檔案需小於 1.5 MB。", "File must be smaller than 1.5 MB.")));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(new Error(t("讀取檔案失敗。", "Failed to read file.")));
      };
      reader.readAsDataURL(file);
    });
  }

  function readForm() {
    var e = els();
    var date = e.date.value.trim();
    var prev = editingId ? findById(editingId) : null;
    return api.normalizeItem({
      id: editingId || newId(),
      date: date,
      dateLabel: api.dateLabelFromIso(date),
      top: e.top.checked,
      published: prev ? prev.published !== false : true,
      photoUrl: mediaDraft.photoUrl || "",
      fileUrl: mediaDraft.fileUrl || "",
      fileName: mediaDraft.fileName || "",
      zh: {
        title: e.zhTitle.value.trim(),
        url: e.zhUrl.value.trim(),
        content: e.zhContent.value.trim()
      },
      en: {
        title: e.enTitle.value.trim(),
        url: e.enUrl.value.trim(),
        content: e.enContent.value.trim()
      }
    });
  }

  function fillForm(item) {
    var e = els();
    document.getElementById("admin-id").value = item ? item.id : "";
    e.date.value = item ? item.date : "";
    e.top.checked = !!(item && item.top);
    e.zhTitle.value = item ? item.zh.title : "";
    e.zhUrl.value = item ? item.zh.url : "";
    e.zhContent.value = item ? item.zh.content || "" : "";
    e.enTitle.value = item ? item.en.title : "";
    e.enUrl.value = item ? item.en.url : "";
    e.enContent.value = item ? item.en.content || "" : "";
    mediaDraft = {
      photoUrl: item && item.photoUrl ? item.photoUrl : "",
      fileUrl: item && item.fileUrl ? item.fileUrl : "",
      fileName: item && item.fileName ? item.fileName : ""
    };
    var photoInput = document.getElementById("admin-photo");
    var fileInput = document.getElementById("admin-file");
    if (photoInput) photoInput.value = "";
    if (fileInput) fileInput.value = "";
    setPhotoPreview(mediaDraft.photoUrl);
    setFilePreview(mediaDraft.fileName || (mediaDraft.fileUrl ? t("已附加檔案", "Attached file") : ""));
    autoFilled = { "en-title": false, "en-content": false, "zh-title": false, "zh-content": false };
    updateSyncCheck();
    hidePreview();
  }

  function openForm(mode, item) {
    editingId = mode === "edit" && item ? item.id : null;
    formTitle.innerHTML =
      mode === "edit"
        ? '<span class="zh">編輯</span><span class="en">Update</span>'
        : '<span class="zh">新增</span><span class="en">Create</span>';
    fillForm(item || null);
    if (!item) {
      var today = new Date();
      var iso =
        today.getFullYear() +
        "-" +
        String(today.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(today.getDate()).padStart(2, "0");
      els().date.value = iso;
    }
    formPanel.hidden = false;
    formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    els().date.focus();
    updateSyncCheck();
  }

  function closeForm() {
    editingId = null;
    form.reset();
    mediaDraft = { photoUrl: "", fileUrl: "", fileName: "" };
    setPhotoPreview("");
    setFilePreview("");
    if (autoTranslateEl) autoTranslateEl.checked = true;
    var dirZhEn = form.querySelector('input[name="admin-translate-dir"][value="zh-en"]');
    if (dirZhEn) dirZhEn.checked = true;
    autoFilled = { "en-title": false, "en-content": false, "zh-title": false, "zh-content": false };
    hidePreview();
    formPanel.hidden = true;
  }

  function persist(list, messageZh, messageEn) {
    var next = syncListOrder(list);
    api.saveAll(next);
    renderList();
    showStatus(t(messageZh, messageEn), "ok");
  }

  /** Sync check: both languages present as one paired record (URLs optional). */
  function getSyncState(item) {
    var zhOk = !!item.zh.title;
    var enOk = !!item.en.title;
    var dateOk = !!item.date;
    var bothContent = !!(item.zh.content && item.en.content);
    var oneContent = !!(item.zh.content || item.en.content);
    if (!dateOk || !zhOk || !enOk) {
      return {
        level: "err",
        zh:
          "尚未同步：請同時填妥中英文標題（以及共用日期），才可儲存為同一則公告。連結為選填。",
        en:
          "Not synced: fill Chinese and English titles (plus the shared date) before saving as one record. URLs are optional."
      };
    }
    if (oneContent && !bothContent) {
      return {
        level: "warn",
        zh:
          "部分同步：標題已齊，但僅有一邊有內容。建議補齊另一語系內容，或使用自動翻譯後再編輯。",
        en:
          "Partially synced: titles are ready, but only one language has body text. Fill the other side or auto-translate, then edit."
      };
    }
    return {
      level: "ok",
      zh: "已同步：中英文將作為同一則公告紀錄儲存／發佈。刪除時兩邊會一併移除。",
      en: "Synced: Chinese and English will be saved/published as one announcement record. Deleting removes both together."
    };
  }

  function updateSyncCheck() {
    if (!syncBox || !syncText) return;
    var state = getSyncState(readForm());
    syncBox.className = "admin-sync-box is-" + state.level;
    syncText.textContent = t(state.zh, state.en);
  }

  function translateText(text, from, to) {
    if (!text || !String(text).trim()) {
      return Promise.resolve("");
    }
    var pair = from + "|" + to;
    var url =
      "https://api.mymemory.translated.net/get?q=" +
      encodeURIComponent(String(text).slice(0, 450)) +
      "&langpair=" +
      encodeURIComponent(pair);
    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("translate failed");
        return res.json();
      })
      .then(function (data) {
        var out =
          data &&
          data.responseData &&
          data.responseData.translatedText
            ? String(data.responseData.translatedText)
            : "";
        if (!out || /PLEASE SELECT TWO DISTINCT LANGUAGES/i.test(out)) {
          throw new Error("empty translation");
        }
        return out;
      });
  }

  function setAutoField(el, key, value) {
    if (!el) return;
    el.value = value;
    autoFilled[key] = true;
  }

  function runAutoTranslate(force) {
    if (translating) return Promise.resolve();
    if (!force && autoTranslateEl && !autoTranslateEl.checked) return Promise.resolve();

    var dir = getTranslateDir();
    var e = els();
    var jobs = [];

    translating = true;
    showStatus(t("正在自動翻譯…", "Auto-translating…"), "ok");

    if (dir === "zh-en") {
      if (force || autoFilled["en-title"] || !e.enTitle.value.trim()) {
        jobs.push(
          translateText(e.zhTitle.value, "zh-TW", "en").then(function (out) {
            if (out) setAutoField(e.enTitle, "en-title", out);
          })
        );
      }
      if (e.zhContent.value.trim() && (force || autoFilled["en-content"] || !e.enContent.value.trim())) {
        jobs.push(
          translateText(e.zhContent.value, "zh-TW", "en").then(function (out) {
            if (out) setAutoField(e.enContent, "en-content", out);
          })
        );
      }
      if (!e.enUrl.value.trim() && e.zhUrl.value.trim()) {
        e.enUrl.value = e.zhUrl.value.trim();
      }
    } else {
      if (force || autoFilled["zh-title"] || !e.zhTitle.value.trim()) {
        jobs.push(
          translateText(e.enTitle.value, "en", "zh-TW").then(function (out) {
            if (out) setAutoField(e.zhTitle, "zh-title", out);
          })
        );
      }
      if (e.enContent.value.trim() && (force || autoFilled["zh-content"] || !e.zhContent.value.trim())) {
        jobs.push(
          translateText(e.enContent.value, "en", "zh-TW").then(function (out) {
            if (out) setAutoField(e.zhContent, "zh-content", out);
          })
        );
      }
      if (!e.zhUrl.value.trim() && e.enUrl.value.trim()) {
        e.zhUrl.value = e.enUrl.value.trim();
      }
    }

    return Promise.all(jobs)
      .then(function () {
        translating = false;
        updateSyncCheck();
        showStatus(
          t("自動翻譯完成，可再手動編輯任一語系。", "Auto-translate done. You can still edit either language."),
          "ok"
        );
      })
      .catch(function () {
        translating = false;
        updateSyncCheck();
        showStatus(
          t(
            "自動翻譯暫時無法使用，請手動填寫另一語系後再預覽。",
            "Auto-translate is unavailable right now. Please fill the other language manually, then preview."
          ),
          "err"
        );
      });
  }

  function scheduleAutoTranslate() {
    if (!autoTranslateEl || !autoTranslateEl.checked) return;
    clearTimeout(translateTimer);
    translateTimer = setTimeout(function () {
      runAutoTranslate(false);
    }, 900);
  }

  function hidePreview() {
    if (previewPanel) previewPanel.hidden = true;
    if (previewGrid) previewGrid.innerHTML = "";
  }

  function previewCard(langLabel, title, url, content, dateLabel, top) {
    return (
      '<article class="admin-preview-card">' +
      '<p class="admin-preview-lang">' +
      escapeHtml(langLabel) +
      "</p>" +
      '<div class="admin-preview-meta">' +
      "<time>" +
      escapeHtml(dateLabel || "—") +
      "</time>" +
      (top ? '<span class="announce-top">TOP</span>' : "") +
      "</div>" +
      "<h4>" +
      escapeHtml(title || "—") +
      "</h4>" +
      (content
        ? '<p class="admin-preview-body">' + escapeHtml(content).replace(/\n/g, "<br>") + "</p>"
        : "") +
      (url
        ? '<p class="admin-preview-url"><a class="link-mark" href="' +
          escapeHtml(url) +
          '" target="_blank" rel="noopener">' +
          escapeHtml(url) +
          "</a></p>"
        : "") +
      "</article>"
    );
  }

  function showPreview(item) {
    if (!previewPanel || !previewGrid) return;
    var state = getSyncState(item);
    previewGrid.innerHTML =
      previewCard(t("中文", "CHI"), item.zh.title, item.zh.url, item.zh.content, item.dateLabel, item.top) +
      previewCard(t("英文", "EN"), item.en.title, item.en.url, item.en.content, item.dateLabel, item.top) +
      '<p class="admin-preview-sync is-' +
      state.level +
      '">' +
      escapeHtml(t(state.zh, state.en)) +
      "</p>";
    previewPanel.hidden = false;
    previewPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderList() {
    var list = api.getAll();
    if (countEl) {
      countEl.textContent = t(
        "共 " + list.length + " 則雙語公告",
        list.length + " bilingual announcement" + (list.length === 1 ? "" : "s")
      );
    }
    if (!listEl) return;

    if (!list.length) {
      listEl.innerHTML =
        '<p class="admin-empty">' +
        t(
          "目前沒有公告。請新增一則雙語公告，或還原預設清單。",
          "No announcements yet. Add a bilingual announcement, or restore the default list."
        ) +
        "</p>";
      return;
    }

    listEl.innerHTML = list
      .map(function (item, index) {
        var sync = getSyncState(item);
        var top = item.top ? '<span class="announce-top">TOP</span>' : "";
        var published = item.published !== false;
        return (
          '<article class="admin-row admin-news-row" data-id="' +
          escapeHtml(item.id) +
          '">' +
          '<div class="admin-news-main">' +
          '<div class="admin-news-copy">' +
          '<div class="admin-row-meta">' +
          '<time datetime="' +
          escapeHtml(item.date) +
          '">' +
          escapeHtml(item.dateLabel) +
          "</time>" +
          top +
          '<span class="admin-sync-pill is-' +
          sync.level +
          '">' +
          t(
            sync.level === "ok" ? "雙語已同步" : sync.level === "warn" ? "部分同步" : "未同步",
            sync.level === "ok" ? "Synced" : sync.level === "warn" ? "Partial" : "Not synced"
          ) +
          "</span>" +
          "</div>" +
          '<h3 class="admin-row-title">' +
          escapeHtml(item.zh.title || "—") +
          (item.en.title ? " / " + escapeHtml(item.en.title) : "") +
          "</h3>" +
          '<p class="admin-row-sub">' +
          escapeHtml(item.zh.content || item.en.content || t("（無內文）", "(No body text)")) +
          "</p>" +
          "</div></div>" +
          '<div class="admin-row-actions">' +
          '<button type="button" class="btn btn-outline" data-action="up"' +
          (index === 0 ? " disabled" : "") +
          ">" +
          t("上移", "Up") +
          "</button>" +
          '<button type="button" class="btn btn-outline" data-action="down"' +
          (index === list.length - 1 ? " disabled" : "") +
          ">" +
          t("下移", "Down") +
          "</button>" +
          '<button type="button" class="btn btn-outline" data-action="edit">' +
          t("編輯", "Edit") +
          "</button>" +
          '<button type="button" class="btn admin-btn-delete" data-action="delete">' +
          t("刪除", "Delete") +
          "</button>" +
          '<span class="admin-published-badge' +
          (published ? " is-on" : " is-off") +
          '" aria-label="' +
          (published ? t("已發布", "Published") : t("未發布", "Unpublished")) +
          '">' +
          (published ? t("已發布", "Published") : t("未發布", "Unpublished")) +
          "</span>" +
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

  var photoInput = document.getElementById("admin-photo");
  if (photoInput) {
    photoInput.addEventListener("change", async function () {
      var file = photoInput.files && photoInput.files[0];
      if (!file) return;
      try {
        mediaDraft.photoUrl = await readFileAsDataUrl(file);
        setPhotoPreview(mediaDraft.photoUrl);
        showStatus(t("照片已選取（選填）。", "Photo selected (optional)."), "ok");
      } catch (err) {
        photoInput.value = "";
        showStatus(t("照片上傳失敗：", "Photo upload failed: ") + (err.message || err), "err");
      }
    });
  }

  var clearPhotoBtn = document.getElementById("admin-btn-clear-photo");
  if (clearPhotoBtn) {
    clearPhotoBtn.addEventListener("click", function () {
      mediaDraft.photoUrl = "";
      if (photoInput) photoInput.value = "";
      setPhotoPreview("");
    });
  }

  var fileInput = document.getElementById("admin-file");
  if (fileInput) {
    fileInput.addEventListener("change", async function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      try {
        mediaDraft.fileUrl = await readFileAsDataUrl(file);
        mediaDraft.fileName = file.name || "attachment";
        setFilePreview(mediaDraft.fileName);
        showStatus(t("檔案已選取（選填）。", "File selected (optional)."), "ok");
      } catch (err) {
        fileInput.value = "";
        showStatus(t("檔案上傳失敗：", "File upload failed: ") + (err.message || err), "err");
      }
    });
  }

  var clearFileBtn = document.getElementById("admin-btn-clear-file");
  if (clearFileBtn) {
    clearFileBtn.addEventListener("click", function () {
      mediaDraft.fileUrl = "";
      mediaDraft.fileName = "";
      if (fileInput) fileInput.value = "";
      setFilePreview("");
    });
  }

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

  document.getElementById("admin-btn-translate").addEventListener("click", function () {
    runAutoTranslate(true);
  });

  document.getElementById("admin-btn-preview").addEventListener("click", function () {
    var item = readForm();
    updateSyncCheck();
    showPreview(item);
  });

  document.getElementById("admin-btn-preview-close").addEventListener("click", hidePreview);

  ["admin-zh-title", "admin-zh-content", "admin-en-title", "admin-en-content", "admin-zh-url", "admin-en-url", "admin-date"].forEach(
    function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", function () {
        var key = el.getAttribute("data-lang-field");
        if (key && autoFilled[key]) autoFilled[key] = false;
        updateSyncCheck();
        if (id === "admin-zh-title" || id === "admin-zh-content" || id === "admin-en-title" || id === "admin-en-content") {
          scheduleAutoTranslate();
        }
      });
      el.addEventListener("change", updateSyncCheck);
    }
  );

  document.getElementById("admin-top").addEventListener("change", updateSyncCheck);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;

    var item = readForm();
    var sync = getSyncState(item);
    if (sync.level === "err") {
      updateSyncCheck();
      showStatus(t(sync.zh, sync.en), "err");
      showPreview(item);
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
      persist(
        list,
        "雙語公告已更新（同一則紀錄），並同步到前台最新消息。",
        "Bilingual announcement updated as one record and synced to the homepage."
      );
    } else {
      list.unshift(item);
      persist(
        list,
        "雙語公告已新增（同一則紀錄），並同步到前台最新消息。",
        "Bilingual announcement added as one record and synced to the homepage."
      );
    }
    closeForm();
  });

  listEl.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-action]");
    if (!btn) return;
    var rowEl = btn.closest("[data-id]");
    if (!rowEl) return;
    var id = rowEl.getAttribute("data-id");
    var action = btn.getAttribute("data-action");
    var list = api.getAll();
    var index = list.findIndex(function (row) {
      return row.id === id;
    });
    var target = index >= 0 ? list[index] : null;

    if (action === "edit" && target) {
      openForm("edit", target);
      return;
    }

    if (action === "up" || action === "down") {
      if (index < 0) return;
      var swapWith = action === "up" ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= list.length) return;
      var tmp = list[index];
      list[index] = list[swapWith];
      list[swapWith] = tmp;
      persist(
        list,
        "公告排序已更新，並同步到前台。",
        "Announcement order updated and synced to the homepage."
      );
      return;
    }

    if (action === "delete") {
      var label = target
        ? t(target.zh.title, target.en.title) +
          "\nCHI: " +
          (target.zh.title || "—") +
          "\nEN: " +
          (target.en.title || "—")
        : id;
      var ok = window.confirm(
        t(
          "確定刪除這則公告？中英文版本會一併移除。\n\n",
          "Delete this announcement? Both Chinese and English will be removed together.\n\n"
        ) + label
      );
      if (!ok) return;
      var next = list.filter(function (row) {
        return row.id !== id;
      });
      if (editingId === id) closeForm();
      persist(
        next,
        "公告已刪除（中英文一併移除），並同步到前台。",
        "Announcement deleted (both languages removed) and synced to the homepage."
      );
    }
  });

  var localeToggle = document.querySelector("[data-locale-toggle]");
  if (localeToggle) {
    localeToggle.addEventListener("click", function () {
      setTimeout(function () {
        renderList();
        updateSyncCheck();
      }, 0);
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
