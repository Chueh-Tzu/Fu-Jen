(function () {
  var api = window.ImMbaFaculty;
  var auth = window.ImMbaAuth;
  if (!api || !auth) return;

  var listEl = document.getElementById("admin-list");
  var countEl = document.getElementById("admin-count");
  var statusEl = document.getElementById("admin-status");
  var formPanel = document.getElementById("admin-form-panel");
  var form = document.getElementById("admin-form");
  var formTitle = document.getElementById("admin-form-title");
  var authMeta = document.getElementById("admin-auth-meta");
  var usersLink = document.getElementById("admin-link-users");

  var editingId = null;
  var rows = [];
  var statusTimer = null;
  var busy = false;
  var gate = null;

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
    }, 5200);
  }

  function setBusy(on) {
    busy = !!on;
    document.querySelectorAll(".admin-toolbar button, .admin-form-actions button, .admin-row-actions button").forEach(function (btn) {
      btn.disabled = busy;
    });
  }

  function els() {
    return {
      id: document.getElementById("admin-id"),
      nameZh: document.getElementById("admin-name-zh"),
      nameEn: document.getElementById("admin-name-en"),
      category: document.getElementById("admin-category"),
      titleZh: document.getElementById("admin-title-zh"),
      titleEn: document.getElementById("admin-title-en"),
      educationZh: document.getElementById("admin-education-zh"),
      educationEn: document.getElementById("admin-education-en"),
      researchZh: document.getElementById("admin-research-zh"),
      researchEn: document.getElementById("admin-research-en"),
      email: document.getElementById("admin-email"),
      phoneZh: document.getElementById("admin-phone-zh"),
      phoneEn: document.getElementById("admin-phone-en"),
      website: document.getElementById("admin-website"),
      photo: document.getElementById("admin-photo"),
      image: document.getElementById("admin-image"),
      sort: document.getElementById("admin-sort"),
      preview: document.getElementById("admin-photo-preview"),
      previewImg: document.getElementById("admin-photo-preview-img")
    };
  }

  function setPhotoPreview(url) {
    var e = els();
    if (!e.preview || !e.previewImg) return;
    var clean = String(url || "").trim();
    if (clean) {
      e.previewImg.src = clean;
      e.preview.hidden = false;
      e.preview.setAttribute("aria-hidden", "false");
    } else {
      e.previewImg.removeAttribute("src");
      e.preview.hidden = true;
      e.preview.setAttribute("aria-hidden", "true");
    }
  }

  function readForm() {
    var e = els();
    return {
      name_zh: e.nameZh.value.trim(),
      name_en: e.nameEn.value.trim(),
      category: e.category.value,
      title_zh: e.titleZh.value.trim(),
      title_en: e.titleEn.value.trim(),
      education_zh: e.educationZh.value.trim(),
      education_en: e.educationEn.value.trim(),
      research_fields_zh: e.researchZh.value.trim(),
      research_fields_en: e.researchEn.value.trim(),
      email: e.email.value.trim(),
      phone_zh: e.phoneZh.value.trim(),
      phone_en: e.phoneEn.value.trim(),
      website: e.website.value.trim(),
      image_url: e.image.value.trim(),
      sort_order: Number(e.sort.value) || 0
    };
  }

  function fillForm(row) {
    var e = els();
    e.id.value = row && row.id != null ? String(row.id) : "";
    e.nameZh.value = row ? (row.name_zh || "") : "";
    e.nameEn.value = row ? (row.name_en || row.name || "") : "";
    e.category.value = row && row.category === "adjunct" ? "adjunct" : "full";
    e.titleZh.value = row ? (row.title_zh || "") : "";
    e.titleEn.value = row ? (row.title_en || row.title || "") : "";
    e.educationZh.value = row ? (row.education_zh || "") : "";
    e.educationEn.value = row ? (row.education_en || row.education || "") : "";
    e.researchZh.value = row ? (row.research_fields_zh || "") : "";
    e.researchEn.value = row ? (row.research_fields_en || row.research_fields || "") : "";
    e.email.value = row ? row.email : "";
    e.phoneZh.value = row ? (row.phone_zh || "") : "";
    e.phoneEn.value = row ? (row.phone_en || row.phone || "") : "";
    e.website.value = row ? row.website : "";
    e.image.value = row ? row.image_url : "";
    if (e.photo) e.photo.value = "";
    e.sort.value = row ? String(row.sort_order) : String((rows.length + 1) * 10);
    setPhotoPreview(row && row.image_url ? row.image_url : "");
  }

  function openForm(row) {
    editingId = row && row.id != null ? row.id : null;
    fillForm(row || null);
    formTitle.innerHTML = editingId
      ? '<span class="zh">編輯教職員</span><span class="en">Edit faculty</span>'
      : '<span class="zh">新增教職員</span><span class="en">Add faculty</span>';
    formPanel.hidden = false;
    els().nameZh.focus();
  }

  function closeForm() {
    editingId = null;
    form.reset();
    setPhotoPreview("");
    formPanel.hidden = true;
  }

  function categoryLabel(category) {
    return category === "adjunct"
      ? t("兼任", "Adjunct")
      : t("專任", "Full-time");
  }

  function renderList() {
    if (!listEl) return;
    countEl.textContent = t("共 " + rows.length + " 位", rows.length + " faculty");

    if (!rows.length) {
      listEl.innerHTML =
        '<p class="admin-empty">' +
        escapeHtml(t(
          "尚無教職員資料。請新增，或按「匯入官方清單」。",
          "No faculty yet. Add one, or import the official list."
        )) +
        "</p>";
      return;
    }

    listEl.innerHTML = rows.map(function (row, index) {
      var chair = api.isChair(row) ? ' <span class="admin-pill">Chair</span>' : "";
      var photo = row.image_url
        ? '<img class="admin-faculty-thumb" src="' + escapeHtml(row.image_url) + '" alt="">'
        : '<div class="admin-faculty-thumb is-empty" aria-hidden="true"></div>';
      return (
        '<article class="admin-row admin-faculty-row" data-id="' + row.id + '">' +
        '<div class="admin-faculty-main">' +
        photo +
        '<div class="admin-faculty-copy">' +
        '<div class="admin-row-meta">' +
        '<span class="admin-pill">' + escapeHtml(categoryLabel(row.category)) + "</span>" +
        "<span>#" + escapeHtml(String(row.sort_order)) + "</span>" +
        chair +
        "</div>" +
        '<h3 class="admin-row-title">' +
        escapeHtml(row.name_zh || row.name_en || row.name || "") +
        (row.name_en && row.name_zh ? ' / ' + escapeHtml(row.name_en) : "") +
        "</h3>" +
        '<p class="admin-row-sub">' +
        escapeHtml(row.title_zh || row.title_en || row.title || "—") +
        "</p>" +
        '<p class="admin-row-body">' + escapeHtml(row.email || "") +
        (row.phone ? " · " + escapeHtml(row.phone) : "") +
        "</p>" +
        "</div></div>" +
        '<div class="admin-row-actions">' +
        '<button type="button" class="btn btn-outline" data-action="up"' + (index === 0 ? " disabled" : "") + ">" +
        t("上移", "Up") + "</button>" +
        '<button type="button" class="btn btn-outline" data-action="down"' + (index === rows.length - 1 ? " disabled" : "") + ">" +
        t("下移", "Down") + "</button>" +
        '<button type="button" class="btn btn-outline" data-action="edit">' + t("編輯", "Edit") + "</button>" +
        '<button type="button" class="btn admin-btn-delete" data-action="delete">' + t("刪除", "Delete") + "</button>" +
        "</div></article>"
      );
    }).join("");
  }

  async function refresh() {
    rows = await api.list();
    renderList();
  }

  async function moveRow(id, direction) {
    var index = rows.findIndex(function (row) { return String(row.id) === String(id); });
    if (index < 0) return;
    var target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= rows.length) return;
    var ordered = rows.map(function (row) { return row.id; });
    var tmp = ordered[index];
    ordered[index] = ordered[target];
    ordered[target] = tmp;
    setBusy(true);
    try {
      rows = await api.reorder(ordered);
      renderList();
      showStatus(t("排序已同步至 Supabase。", "Order synced to Supabase."), "ok");
    } catch (err) {
      showStatus(t("排序失敗：", "Reorder failed: ") + (err.message || err), "err");
    } finally {
      setBusy(false);
    }
  }

  document.getElementById("admin-btn-add").addEventListener("click", function () {
    openForm(null);
  });

  document.getElementById("admin-btn-cancel").addEventListener("click", closeForm);

  var clearPhotoBtn = document.getElementById("admin-btn-clear-photo");
  if (clearPhotoBtn) {
    clearPhotoBtn.addEventListener("click", function () {
      var e = els();
      if (e.photo) e.photo.value = "";
      e.image.value = "";
      setPhotoPreview("");
    });
  }

  var imageInput = document.getElementById("admin-image");
  if (imageInput) {
    imageInput.addEventListener("input", function () {
      setPhotoPreview(imageInput.value.trim());
    });
  }

  var photoInput = document.getElementById("admin-photo");
  if (photoInput) {
    photoInput.addEventListener("change", async function () {
      var file = photoInput.files && photoInput.files[0];
      if (!file || busy) return;

      // Local preview first (so you always see something after choosing a file)
      try {
        if (photoInput._localPreviewUrl) URL.revokeObjectURL(photoInput._localPreviewUrl);
        photoInput._localPreviewUrl = URL.createObjectURL(file);
        setPhotoPreview(photoInput._localPreviewUrl);
      } catch (previewErr) { /* ignore */ }

      setBusy(true);
      showStatus(t("正在上傳照片到 Supabase Storage…", "Uploading photo to Supabase Storage…"), "ok");
      try {
        var uploaded = await api.uploadPhoto(file, {
          name: els().nameEn.value || els().nameZh.value || file.name,
          id: editingId
        });
        els().image.value = uploaded.publicUrl;
        setPhotoPreview(uploaded.publicUrl);
        showStatus(
          t(
            "照片已上傳，網址已自動填入。請按下方「儲存至 Supabase」。",
            "Photo uploaded and URL filled in. Click “Save to Supabase” below."
          ),
          "ok"
        );
      } catch (err) {
        var detail = (err && err.message) || String(err);
        showStatus(t("照片上傳失敗：", "Photo upload failed: ") + detail, "err");
      } finally {
        setBusy(false);
      }
    });
  }

  document.getElementById("admin-btn-seed").addEventListener("click", async function () {
    if (busy) return;
    var confirmMsg = t(
      "依官方師資頁同步中英文文字與照片網址，確定嗎？",
      "Sync official Chinese/English text and photo URLs from the Fu Jen faculty page. Continue?"
    );
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      rows = await api.syncOfficialBilingual();
      renderList();
      showStatus(
        t(
          "已同步官方中英文與照片 " + rows.length + " 位。",
          "Synced official ZH/EN text and photos for " + rows.length + " faculty."
        ),
        "ok"
      );
    } catch (err) {
      var detail = err.message || err;
      if (/name_zh|column|schema cache/i.test(String(detail))) {
        detail = t(
          "請先在 Supabase 執行 schema-bilingual.sql。",
          "Run schema-bilingual.sql in Supabase first. "
        ) + detail;
      }
      showStatus(t("同步失敗：", "Sync failed: ") + detail, "err");
    } finally {
      setBusy(false);
    }
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (busy) return;
    var data = readForm();
    if (!data.name_zh && !data.name_en) {
      showStatus(t("請填寫中文或英文姓名。", "Chinese or English name is required."), "err");
      return;
    }
    setBusy(true);
    try {
      if (editingId != null) {
        await api.update(editingId, data);
        showStatus(t("已更新並同步至 Supabase。", "Updated and synced to Supabase."), "ok");
      } else {
        await api.create(data);
        showStatus(t("已新增並同步至 Supabase。", "Created and synced to Supabase."), "ok");
      }
      closeForm();
      await refresh();
    } catch (err) {
      showStatus(t("儲存失敗：", "Save failed: ") + (err.message || err), "err");
    } finally {
      setBusy(false);
    }
  });

  listEl.addEventListener("click", async function (event) {
    var btn = event.target.closest("[data-action]");
    if (!btn || busy) return;
    var rowEl = btn.closest("[data-id]");
    if (!rowEl) return;
    var id = rowEl.getAttribute("data-id");
    var action = btn.getAttribute("data-action");
    var row = rows.find(function (item) { return String(item.id) === String(id); });

    if (action === "edit" && row) {
      openForm(row);
      return;
    }
    if (action === "up" || action === "down") {
      await moveRow(id, action);
      return;
    }
    if (action === "delete") {
      if (!window.confirm(t("確定刪除此教職員？", "Delete this faculty member?"))) return;
      setBusy(true);
      try {
        await api.remove(id);
        showStatus(t("已刪除。", "Deleted."), "ok");
        await refresh();
      } catch (err) {
        showStatus(t("刪除失敗：", "Delete failed: ") + (err.message || err), "err");
      } finally {
        setBusy(false);
      }
    }
  });

  var logoutBtn = document.getElementById("admin-btn-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      await auth.signOut();
      location.href = "login.html";
    });
  }

  (async function init() {
    setBusy(true);
    try {
      gate = await auth.requireAdmin();
      if (!gate) return;
      if (authMeta) {
        authMeta.hidden = false;
        authMeta.textContent = t(
          "已登入：" + gate.profile.email + "（" + gate.profile.role + "）",
          "Signed in: " + gate.profile.email + " (" + gate.profile.role + ")"
        );
      }
      if (usersLink) usersLink.hidden = gate.profile.role !== "super_admin";

      var seeded = await api.seedDefaultsIfEmpty();
      rows = seeded.list;
      renderList();
      if (seeded.seeded) {
        showStatus(t("資料表為空，已自動匯入官方清單。", "Table was empty — official list imported."), "ok");
      } else {
        showStatus(
          t("已通過身分驗證，可管理教職員。", "Authenticated — you can manage faculty."),
          "ok"
        );
      }
      if (new URLSearchParams(location.search).get("need_super") === "1") {
        showStatus(
          t("管理員審核僅限 super_admin。", "Admin approval is for super_admin only."),
          "err"
        );
      }
    } catch (err) {
      listEl.innerHTML =
        '<p class="admin-empty">' +
        escapeHtml(t("無法連接 Supabase：", "Cannot reach Supabase: ") + (err.message || err)) +
        "</p>";
      showStatus(t("載入失敗：", "Load failed: ") + (err.message || err), "err");
    } finally {
      setBusy(false);
    }
  })();
})();
