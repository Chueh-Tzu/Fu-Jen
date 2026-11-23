(function () {
  var auth = window.ImMbaAuth;
  if (!auth) return;

  var listEl = document.getElementById("users-list");
  var countEl = document.getElementById("users-count");
  var statusEl = document.getElementById("users-status");
  var dialog = document.getElementById("users-remove-dialog");
  var dialogCopy = document.getElementById("users-remove-copy");
  var confirmBtn = document.getElementById("users-remove-confirm");
  var cancelBtn = document.getElementById("users-remove-cancel");
  var me = null;
  var pending = null;

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
    if (role === "buyer") return t("買家", "Buyer");
    if (role === "market") return t("賣家", "Seller");
    if (role === "both") return t("買賣家", "Buyer and seller");
    if (role === "pending") return t("待審核", "Pending");
    if (role === "rejected") return t("已拒絕", "Rejected");
    return t("一般訪客", "Visitor");
  }

  function showStatus(message, kind) {
    statusEl.hidden = false;
    statusEl.className = "admin-status is-" + (kind || "ok");
    statusEl.textContent = message;
  }

  function applyNote(row) {
    if (row.signup_channel !== "market") return "";
    if (row.role !== "pending" && row.role !== "rejected") return "";
    if (row.apply_as === "seller") {
      return '<p class="admin-row-note">' + escapeHtml(t("備註：賣家申請", "Note: seller application")) + "</p>";
    }
    if (row.apply_as === "buyer") {
      return '<p class="admin-row-note">' + escapeHtml(t("備註：買家申請", "Note: buyer application")) + "</p>";
    }
    return "";
  }

  function roleButton(role, label, extraClass) {
    return (
      '<button type="button" class="btn ' + (extraClass || "btn-outline") + '" data-role="' + role + '">' +
      label + "</button>"
    );
  }

  function render(rows) {
    var order = { pending: 0, rejected: 1, visitor: 2, buyer: 3, market: 4, both: 5, admin: 6, super_admin: 7 };
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
        if (row.signup_channel === "market") {
          actions =
            roleButton("buyer", t("核准為買家", "Approve as buyer"), "btn-gold") +
            roleButton("market", t("核准為賣家", "Approve as seller"), "btn-outline") +
            roleButton("both", t("核准為買賣家", "Approve as buyer and seller"), "btn-outline") +
            (row.role === "pending" ? roleButton("rejected", t("拒絕", "Reject"), "btn-outline") : "");
        } else {
          actions =
            roleButton("admin", t("核准為管理員", "Approve as admin"), "btn-gold") +
            (row.role === "pending" ? roleButton("rejected", t("拒絕", "Reject"), "btn-outline") : "");
        }
      } else if (row.role === "buyer") {
        actions =
          roleButton("market", t("改為賣家", "Change to seller"), "btn-outline") +
          roleButton("both", t("改為買賣家", "Change to buyer and seller"), "btn-outline") +
          roleButton("visitor", t("設為一般訪客", "Set as visitor"), "btn-outline");
      } else if (row.role === "market") {
        actions =
          roleButton("buyer", t("改為買家", "Change to buyer"), "btn-outline") +
          roleButton("both", t("改為買賣家", "Change to buyer and seller"), "btn-outline") +
          roleButton("visitor", t("設為一般訪客", "Set as visitor"), "btn-outline");
      } else if (row.role === "both") {
        actions =
          roleButton("buyer", t("改為買家", "Change to buyer"), "btn-outline") +
          roleButton("market", t("改為賣家", "Change to seller"), "btn-outline") +
          roleButton("visitor", t("設為一般訪客", "Set as visitor"), "btn-outline");
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
        applyNote(row) +
        "</div>" +
        '<div class="admin-row-actions">' + actions +
        (row.role === "super_admin" ? "" :
          '<button type="button" class="btn btn-outline" data-remove="' + escapeHtml(row.id) + '">' +
          t("移除帳號", "Remove account") + "</button>") +
        "</div></article>"
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

  function accountName(row) {
    return row.display_name || row.email || row.id;
  }

  function paintDialog() {
    if (!pending) return;
    dialogCopy.textContent = t(
      "確定要移除「" + accountName(pending) + "」嗎？移除後這個帳號無法再登入。",
      "Remove “" + accountName(pending) + "”? This account will no longer be able to sign in."
    );
  }

  function openDialog(row) {
    pending = row;
    paintDialog();
    dialog.hidden = false;
    cancelBtn.focus();
  }

  function closeDialog() {
    pending = null;
    dialog.hidden = true;
    confirmBtn.disabled = false;
    cancelBtn.disabled = false;
  }

  listEl.addEventListener("click", async function (event) {
    var removeBtn = event.target.closest("[data-remove]");
    if (removeBtn) {
      var card = removeBtn.closest("[data-id]");
      openDialog({
        id: removeBtn.getAttribute("data-remove"),
        display_name: card ? card.querySelector(".admin-row-title").textContent : "",
        email: card ? card.querySelector(".admin-row-sub").textContent : ""
      });
      return;
    }
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

  cancelBtn.addEventListener("click", closeDialog);
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) closeDialog();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !dialog.hidden) closeDialog();
  });
  confirmBtn.addEventListener("click", async function () {
    if (!pending) return;
    if (me && me.profile && me.profile.id === pending.id) {
      closeDialog();
      showStatus(t("不能移除目前登入的帳號。", "You cannot remove the account you are using."), "err");
      return;
    }
    var target = pending;
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    try {
      await auth.removeAccount(target.id);
      if (auth.writeActivity) {
        try {
          await auth.writeActivity({
            action: "DELETE",
            entity_type: "profile",
            entity_id: target.id,
            entity_label: accountName(target),
            summary: "removed account"
          });
        } catch (logErr) {}
      }
      closeDialog();
      showStatus(t("已移除帳號「" + accountName(target) + "」。", "Removed “" + accountName(target) + "”."), "ok");
      await refresh();
    } catch (err) {
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      showStatus(t("移除失敗：", "Could not remove the account: ") + (err.message || err), "err");
    }
  });

  var localeToggle = document.querySelector("[data-locale-toggle]");
  if (localeToggle) {
    localeToggle.addEventListener("click", function () {
      setTimeout(function () {
        paintDialog();
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
