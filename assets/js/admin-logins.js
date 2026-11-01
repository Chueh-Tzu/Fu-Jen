(function () {
  var auth = window.ImMbaAuth;
  if (!auth) return;

  var bodyEl = document.getElementById("log-body");
  var countEl = document.getElementById("log-count");
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
  })();

  var localeToggle = document.querySelector("[data-locale-toggle]");
  if (localeToggle) {
    localeToggle.addEventListener("click", function () {
      setTimeout(function () {
        render(cachedRows);
        applyStatus();
      }, 0);
    });
  }
})();
