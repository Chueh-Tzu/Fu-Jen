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
    if (role === "pending") return t("待審核", "Pending");
    if (role === "rejected") return t("已拒絕", "Rejected");
    return t("一般訪客", "Visitor");
  }

  function showStatus(message, kind) {
    statusEl.hidden = false;
    statusEl.className = "admin-status is-" + (kind || "ok");
    statusEl.textContent = message;
  }

  function roleButton(role, label, extraClass) {
    return (
      '<button type="button" class="btn ' + (extraClass || "btn-outline") + '" data-role="' + role + '">' +
      label + "</button>"
    );
  }

  function render(rows) {
    var order = { pending: 0, rejected: 1, visitor: 2, admin: 3, super_admin: 4 };
    rows = rows.slice().sort(function (a, b) {
      return (order[a.role] == null ? 9 : order[a.role]) - (order[b.role] == null ? 9 : order[b.role]);
    });
    var pendingCount = rows.filter(function (row) { return row.role === "pending"; }).length;
    countEl.textContent = t(
      "共 " + rows.length + " 位，待審核 " + pendingCount + " 位",
      rows.length + " accounts, " + pendingCount + " pending"
    );
    if (!rows.length) {
      listEl.innerHTML = '<p class="admin-empty">' + escapeHtml(t("尚無帳號。", "No accounts yet.")) + "</p>";
      return;
    }
    listEl.innerHTML = rows.map(function (row) {
      var isSelf = me && me.profile && me.profile.id === row.id;
      var actions = "";
      if (row.role === "pending" || row.role === "rejected") {
        actions =
          roleButton("admin", t("核准為管理員", "Approve as admin"), "btn-gold") +
          (row.role === "pending" ? roleButton("rejected", t("拒絕", "Reject"), "btn-outline") : "");
      } else {
        actions =
          roleButton("admin", t("核准為管理員", "Approve as admin"), "btn-gold") +
          roleButton("visitor", t("設為一般訪客", "Set as visitor"), "btn-outline") +
          roleButton("super_admin", t("設為超級管理員", "Make super admin"), "btn-outline");
      }
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
        '<div class="admin-row-actions">' + actions + "</div></article>"
      );
    }).join("");
    listEl.querySelectorAll("[data-role]").forEach(function (btn) {
      var row = btn.closest("[data-id]");
      var current = rows.filter(function (item) { return item.id === row.getAttribute("data-id"); })[0];
      if (current && btn.getAttribute("data-role") === current.role) btn.disabled = true;
    });
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
