(function () {
  var auth = window.ImMbaAuth;
  if (!auth) return;

  var statusEl = document.getElementById("auth-status");
  var sessionBox = document.getElementById("auth-session");
  var sessionText = document.getElementById("auth-session-text");
  var usersLink = document.getElementById("auth-link-users");
  var facultyLink = document.getElementById("auth-link-faculty");
  var panel = document.querySelector(".auth-panel-single");
  var viewLogin = document.getElementById("auth-view-login");
  var viewRegister = document.getElementById("auth-view-register");
  var tabLogin = document.getElementById("auth-tab-login");
  var tabRegister = document.getElementById("auth-tab-register");
  var loginForm = document.getElementById("login-form");
  var registerForm = document.getElementById("register-form");
  var params = new URLSearchParams(location.search);
  var mode = "login";

  function isEn() {
    return document.documentElement.getAttribute("data-locale") === "en";
  }

  function t(zh, en) {
    return isEn() ? en : zh;
  }

  function roleLabel(role) {
    if (role === "admin") return t("管理員", "admin");
    if (role === "super_admin") return t("超級管理員", "super_admin");
    return t("待審核", "pending");
  }

  function showStatus(message, kind) {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.className = "admin-status is-" + (kind || "ok");
    statusEl.textContent = message;
  }

  function nextPage() {
    var next = params.get("next") || "admin-faculty.html";
    if (!/^[a-z0-9\-]+\.html$/i.test(next)) next = "admin-faculty.html";
    return next;
  }

  function setMode(nextMode) {
    mode = nextMode === "register" ? "register" : "login";
    if (panel) panel.setAttribute("data-auth-mode", mode);
    if (viewLogin) viewLogin.hidden = mode !== "login";
    if (viewRegister) viewRegister.hidden = mode !== "register";

    if (tabLogin) {
      tabLogin.setAttribute("aria-pressed", mode === "login" ? "true" : "false");
      tabLogin.className = "btn " + (mode === "login" ? "btn-gold" : "btn-outline");
    }
    if (tabRegister) {
      tabRegister.setAttribute("aria-pressed", mode === "register" ? "true" : "false");
      tabRegister.className = "btn " + (mode === "register" ? "btn-gold" : "btn-outline");
    }

    if (mode === "login") {
      var loginEmail = document.getElementById("login-email");
      if (loginEmail) loginEmail.focus();
    } else {
      var regName = document.getElementById("reg-name");
      if (regName) regName.focus();
    }
  }

  async function refreshSessionBox() {
    var session = await auth.getSession();
    if (!session) {
      sessionBox.hidden = true;
      if (facultyLink) facultyLink.hidden = true;
      if (usersLink) usersLink.hidden = true;
      return;
    }
    var profile = await auth.getProfile(true);
    var role = profile ? profile.role : "pending";
    var email = (profile && profile.email) || session.user.email || "";
    sessionBox.hidden = false;
    sessionText.textContent = t(
      "已登入：" + email + "｜角色：" + roleLabel(role),
      "Signed in as " + email + " · role: " + roleLabel(role)
    );
    if (facultyLink) facultyLink.hidden = !auth.isAdminRole(role);
    if (usersLink) usersLink.hidden = role !== "super_admin";

    if (role === "pending") {
      showStatus(
        t(
          "帳號為「待審核」，尚不能進入後台。請等待超級管理員核准。",
          "Your role is pending. Wait for a super_admin to approve you."
        ),
        "err"
      );
    } else if (auth.isAdminRole(role)) {
      showStatus(
        t("已核准，可進入教職員後台。", "Approved — you can open AdminFaculty."),
        "ok"
      );
    }
  }

  async function doLogin() {
    try {
      await auth.signIn(
        document.getElementById("login-email").value,
        document.getElementById("login-password").value
      );
      var profile = await auth.getProfile(true);
      if (profile && auth.isAdminRole(profile.role)) {
        location.href = nextPage();
        return;
      }
      await refreshSessionBox();
    } catch (err) {
      showStatus(t("登入失敗：", "Sign-in failed: ") + (err.message || err), "err");
    }
  }

  async function doRegister() {
    try {
      var data = await auth.signUp(
        document.getElementById("reg-email").value,
        document.getElementById("reg-password").value,
        document.getElementById("reg-name").value
      );
      if (data.session) {
        showStatus(
          t(
            "註冊成功。角色為「待審核」，請等待核准後再進後台。",
            "Registered. Role is pending until a super_admin approves you."
          ),
          "ok"
        );
        await refreshSessionBox();
      } else {
        showStatus(
          t(
            "註冊成功。若啟用信箱驗證，請先到信箱點連結，再回來登入。",
            "Registered. If email confirmation is on, verify your inbox, then sign in."
          ),
          "ok"
        );
      }
    } catch (err) {
      showStatus(t("註冊失敗：", "Registration failed: ") + (err.message || err), "err");
    }
  }

  if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      doLogin();
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", function (event) {
      event.preventDefault();
      doRegister();
    });
  }

  if (tabLogin) {
    tabLogin.addEventListener("click", function () {
      if (mode === "login") {
        if (loginForm && loginForm.reportValidity()) doLogin();
      } else {
        setMode("login");
      }
    });
  }

  if (tabRegister) {
    tabRegister.addEventListener("click", function () {
      if (mode === "register") {
        if (registerForm && registerForm.reportValidity()) doRegister();
      } else {
        setMode("register");
      }
    });
  }

  document.getElementById("auth-btn-logout").addEventListener("click", async function () {
    try {
      await auth.signOut();
      sessionBox.hidden = true;
      if (facultyLink) facultyLink.hidden = true;
      if (usersLink) usersLink.hidden = true;
      showStatus(t("已登出。", "Signed out."), "ok");
    } catch (err) {
      showStatus(t("登出失敗：", "Sign-out failed: ") + (err.message || err), "err");
    }
  });

  document.querySelectorAll("[data-locale-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setTimeout(function () {
        refreshSessionBox().catch(function () {});
      }, 0);
    });
  });

  (async function init() {
    setMode(params.get("mode") === "register" ? "register" : "login");
    if (params.get("denied") === "1") {
      showStatus(
        t(
          "尚未獲准進入後台（需要管理員或超級管理員）。",
          "Access denied — admin or super_admin role required."
        ),
        "err"
      );
    }
    try {
      await refreshSessionBox();
    } catch (err) {
      showStatus(t("無法讀取登入狀態：", "Cannot read session: ") + (err.message || err), "err");
    }
  })();
})();
