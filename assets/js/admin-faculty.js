(function () {
  var api = window.ImMbaFaculty;
  if (!api) return;

  var listEl = document.getElementById("admin-list");
  var countEl = document.getElementById("admin-count");
  var statusEl = document.getElementById("admin-status");
  var formPanel = document.getElementById("admin-form-panel");
  var form = document.getElementById("admin-form");
  var formTitle = document.getElementById("admin-form-title");

  var editingId = null;
  var rows = [];
  var statusTimer = null;
  var busy = false;

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
      name: document.getElementById("admin-name"),
      category: document.getElementById("admin-category"),
      title: document.getElementById("admin-title"),
      education: document.getElementById("admin-education"),
      research: document.getElementById("admin-research"),
      email: document.getElementById("admin-email"),
      phone: document.getElementById("admin-phone"),
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
      name: e.name.value.trim(),
      category: e.category.value,
      title: e.title.value.trim(),
      education: e.education.value.trim(),
      research_fields: e.research.value.trim(),
      email: e.email.value.trim(),
      phone: e.phone.value.trim(),
      website: e.website.value.trim(),
      image_url: e.image.value.trim(),
      sort_order: Number(e.sort.value) || 0
    };
  }

  function fillForm(row) {
    var e = els();
    e.id.value = row && row.id != null ? String(row.id) : "";
    e.name.value = row ? row.name : "";
    e.category.value = row && row.category === "adjunct" ? "adjunct" : "full";
    e.title.value = row ? row.title : "";
    e.education.value = row ? row.education : "";
    e.research.value = row ? row.research_fields : "";
    e.email.value = row ? row.email : "";
    e.phone.value = row ? row.phone : "";
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
    els().name.focus();
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
        '<h3 class="admin-row-title">' + escapeHtml(row.name) + "</h3>" +
        '<p class="admin-row-sub">' + escapeHtml(row.title || "—") + "</p>" +
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
          name: els().name.value || file.name,
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
    var confirmMsg = rows.length
      ? t(
        "將清空現有資料並匯入官方清單，確定嗎？",
        "This replaces the current list with the official seed. Continue?"
      )
      : t("匯入官方教職員清單到 Supabase？", "Import the official faculty list into Supabase?");
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      rows = await api.replaceWithDefaults();
      renderList();
      showStatus(t("已匯入 " + rows.length + " 位教職員。", "Imported " + rows.length + " faculty."), "ok");
    } catch (err) {
      showStatus(t("匯入失敗：", "Import failed: ") + (err.message || err), "err");
    } finally {
      setBusy(false);
    }
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (busy) return;
    var data = readForm();
    if (!data.name) {
      showStatus(t("請填寫姓名。", "Name is required."), "err");
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

  (async function init() {
    setBusy(true);
    try {
      var seeded = await api.seedDefaultsIfEmpty();
      rows = seeded.list;
      renderList();
      if (seeded.seeded) {
        showStatus(t("資料表為空，已自動匯入官方清單。", "Table was empty — official list imported."), "ok");
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
