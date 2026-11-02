(function () {
  var auth = window.ImMbaAuth;
  if (!auth) return;

  var bodyEl = document.getElementById("log-body");
  var countEl = document.getElementById("log-count");
  var activityBodyEl = document.getElementById("activity-body");
  var activityCountEl = document.getElementById("activity-count");
  var statusEl = document.getElementById("log-status");

  function isEn() {
    return document.documentElement.getAttribute("data-locale") === "en";
  }

  function t(zh, en) {
    return isEn() ? en : zh;
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
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

  function formatTime(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    var parts = {};
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(date).forEach(function (part) {
      parts[part.type] = part.value;
    });
    return parts.year + "-" + parts.month + "-" + parts.day + " " + parts.hour + ":" + parts.minute;
  }

  function showStatus(message, kind) {
    statusEl.hidden = false;
    statusEl.className = "admin-status is-" + (kind || "ok");
    statusEl.textContent = message;
  }

  var cachedRows = [];
  var activityRows = [];
  var statusCode = "";
  var statusDetail = "";

  function applyStatus() {
    if (statusCode === "missing") {
      showStatus(
        t(
          "登入紀錄資料表尚未建立。請在 Supabase SQL Editor 執行 schema-visitor-login.sql。",
          "The login log table is not set up yet. Run schema-visitor-login.sql in the Supabase SQL Editor."
        ),
        "err"
      );
    } else if (statusCode === "err") {
      showStatus(t("載入失敗：", "Load failed: ") + statusDetail, "err");
    }
  }

  function render(rows) {
    countEl.textContent = t("共 " + rows.length + " 筆", rows.length + " records");
    if (!rows.length) {
      bodyEl.innerHTML =
        '<tr><td colspan="4">' + escapeHtml(t("尚無登入紀錄。", "No sign-ins yet.")) + "</td></tr>";
      return;
    }
    bodyEl.innerHTML = rows.map(function (row) {
      return (
        "<tr>" +
        "<td>" + escapeHtml(row.display_name || "—") + "</td>" +
        "<td>" + escapeHtml(row.email || "—") + "</td>" +
        "<td>" + escapeHtml(formatTime(row.logged_in_at)) + "</td>" +
        "<td>" + escapeHtml(roleLabel(row.role)) + "</td>" +
        "</tr>"
      );
    }).join("");
  }

  function actionLabel(action) {
    if (action === "CREATE") return t("新增", "Add");
    if (action === "UPDATE") return t("修改", "Edit");
    if (action === "DELETE") return t("刪除", "Delete");
    return action || "—";
  }

  function recordLabel(row) {
    var name = row.entity_label || row.entity_id || "—";
    if (row.entity_type === "announcement") return t("公告：", "Announcement: ") + name;
    if (row.entity_type === "faculty") return t("師資：", "Faculty: ") + name;
    if (row.entity_type === "alumni") return t("校友：", "Alumni: ") + name;
    return name;
  }

  function renderActivity(rows) {
    activityCountEl.textContent = t("共 " + rows.length + " 筆", rows.length + " records");
    if (!rows.length) {
      activityBodyEl.innerHTML =
        '<tr><td colspan="6">' + escapeHtml(t("尚無活動紀錄。", "No activity yet.")) + "</td></tr>";
      return;
    }
    activityBodyEl.innerHTML = rows.map(function (row) {
      return (
        "<tr>" +
        "<td>" + escapeHtml(row.display_name || "—") + "</td>" +
        "<td>" + escapeHtml(row.email || "—") + "</td>" +
        "<td>" + escapeHtml(formatTime(row.logged_at)) + "</td>" +
        "<td>" + escapeHtml(row.role ? roleLabel(row.role) : "—") + "</td>" +
        "<td>" + escapeHtml(actionLabel(row.action)) + "</td>" +
        "<td>" + escapeHtml(recordLabel(row)) + "</td>" +
        "</tr>"
      );
    }).join("");
  }

  (async function init() {
    var gate = await auth.requireAdmin();
    if (!gate) return;
    try {
      cachedRows = await auth.listLoginLogs();
      statusCode = "";
      render(cachedRows);
    } catch (err) {
      var message = String((err && err.message) || err || "");
      statusDetail = message;
      statusCode = (message.indexOf("login_logs") !== -1 || message.indexOf("schema cache") !== -1) ? "missing" : "err";
      applyStatus();
      cachedRows = [];
      render(cachedRows);
    }
    try {
      activityRows = await auth.listActivityLogs();
      renderActivity(activityRows);
    } catch (err) {
      var activityMessage = String((err && err.message) || err || "");
      showStatus(t("活動紀錄載入失敗：", "Activity log failed to load: ") + activityMessage, "err");
      activityRows = [];
      renderActivity(activityRows);
    }
  })();

  var localeToggle = document.querySelector("[data-locale-toggle]");
  if (localeToggle) {
    localeToggle.addEventListener("click", function () {
      setTimeout(function () {
        render(cachedRows);
        renderActivity(activityRows);
        applyStatus();
      }, 0);
    });
  }
})();
