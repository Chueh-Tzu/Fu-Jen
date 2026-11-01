(function () {
  var auth = window.ImMbaAuth;
  if (!auth) return;

  var listEl = document.getElementById("users-list");
  var countEl = document.getElementById("users-count");
  var statusEl = document.getElementById("users-status");
  var me = null;

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

  function roleLabel(role) {
    if (role === "super_admin") return t("超級管理員", "Super admin");
    if (role === "admin") return t("管理員", "Admin");
    return t("一般訪客", "Visitor");
  }

  function showStatus(message, kind) {
    statusEl.hidden = false;
    statusEl.className = "admin-status is-" + (kind || "ok");
    statusEl.textContent = message;
  }

  function render(rows) {
    countEl.textContent = t("共 " + rows.length + " 位", rows.length + " accounts");
    if (!rows.length) {
      listEl.innerHTML = '<p class="admin-empty">' + escapeHtml(t("尚無帳號。", "No accounts yet.")) + "</p>";
      return;
    }
    listEl.innerHTML = rows.map(function (row) {
      var isSelf = me && me.profile && me.profile.id === row.id;
      return (
        '<article class="admin-row" data-id="' + escapeHtml(row.id) + '">' +
        "<div>" +
        '<div class="admin-row-meta">' +
        '<span class="admin-pill">' + escapeHtml(roleLabel(row.role)) + "</span>" +
        (isSelf ? '<span class="admin-pill">you</span>' : "") +
        "</div>" +
        '<h3 class="admin-row-title">' + escapeHtml(row.display_name || row.email || row.id) + "</h3>" +
        '<p class="admin-row-sub">' + escapeHtml(row.email || "") + "</p>" +
        "</div>" +
        '<div class="admin-row-actions">' +
        '<button type="button" class="btn btn-gold" data-role="admin"' +
        (row.role === "admin" ? " disabled" : "") + ">" +
        t("核准為管理員", "Approve as admin") + "</button>" +
        '<button type="button" class="btn btn-outline" data-role="visitor"' +
        (row.role === "visitor" ? " disabled" : "") + ">" +
        t("設為一般訪客", "Set as visitor") + "</button>" +
        '<button type="button" class="btn btn-outline" data-role="super_admin"' +
        (row.role === "super_admin" ? " disabled" : "") + ">" +
        t("設為超級管理員", "Make super admin") + "</button>" +
        "</div></article>"
      );
    }).join("");
  }

  async function refresh() {
    var rows = await auth.listProfiles();
    render(rows);
  }

  listEl.addEventListener("click", async function (event) {
    var btn = event.target.closest("[data-role]");
    if (!btn) return;
    var row = btn.closest("[data-id]");
    if (!row) return;
    var id = row.getAttribute("data-id");
    var role = btn.getAttribute("data-role");
    try {
      await auth.setRole(id, role);
      showStatus(t("已更新身分為", "Role updated to ") + roleLabel(role) + "。", "ok");
      await refresh();
    } catch (err) {
      showStatus(t("更新失敗：", "Update failed: ") + (err.message || err), "err");
    }
  });

  var localeToggle = document.querySelector("[data-locale-toggle]");
  if (localeToggle) {
    localeToggle.addEventListener("click", function () {
      setTimeout(function () {
        if (!listEl.querySelector("[data-id]")) return;
        refresh().then(function () {
          if (statusEl.classList.contains("is-ok")) {
            showStatus(
              t("以超級管理員身分管理帳號。", "Managing accounts as super admin."),
              "ok"
            );
          }
        }).catch(function () {});
      }, 0);
    });
  }

  document.getElementById("users-btn-logout").addEventListener("click", async function () {
    await auth.signOut();
    location.href = "login.html";
  });

  (async function init() {
    me = await auth.requireSuperAdmin();
    if (!me) return;
    try {
      await refresh();
      showStatus(
        t("以超級管理員身分管理帳號。", "Managing accounts as super admin."),
        "ok"
      );
    } catch (err) {
      showStatus(t("載入失敗：", "Load failed: ") + (err.message || err), "err");
    }
  })();
})();
