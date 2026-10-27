(function () {
  var auth = window.ImMbaAuth;
  if (!auth) return;

  var statusEl = document.getElementById("auth-status");
  var sessionBox = document.getElementById("auth-session");
  var sessionText = document.getElementById("auth-session-text");
  var usersLink = document.getElementById("auth-link-users");
  var facultyLink = document.getElementById("auth-link-faculty");
  var newsLink = document.getElementById("auth-link-news");
  var panel = document.querySelector(".auth-panel-single");
  var viewLogin = document.getElementById("auth-view-login");
  var viewRegister = document.getElementById("auth-view-register");
  var viewForgot = document.getElementById("auth-view-forgot");
  var viewReset = document.getElementById("auth-view-reset");
  var tabLogin = document.getElementById("auth-tab-login");
  var tabRegister = document.getElementById("auth-tab-register");
  var tabForgot = document.getElementById("auth-tab-forgot");
  var loginForm = document.getElementById("login-form");
  var registerForm = document.getElementById("register-form");
  var forgotForm = document.getElementById("forgot-form");
  var resetForm = document.getElementById("reset-form");
  var params = new URLSearchParams(location.search);
  var hashParams = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
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

  function syncPasswordToggleLabel(btn, visible) {
    var label = visible
      ? t("隱藏密碼", "Hide password")
      : t("顯示密碼", "Show password");
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
    btn.setAttribute("aria-pressed", visible ? "true" : "false");
  }

  function bindPasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach(function (btn) {
      syncPasswordToggleLabel(btn, false);
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-password-toggle");
        var input = id ? document.getElementById(id) : null;
        if (!input) return;
        var show = input.type === "password";
        input.type = show ? "text" : "password";
        syncPasswordToggleLabel(btn, show);
      });
    });
  }

  bindPasswordToggles();

  var localeToggle = document.querySelector("[data-locale-toggle]");
  if (localeToggle) {
    localeToggle.addEventListener("click", function () {
      setTimeout(function () {
        document.querySelectorAll("[data-password-toggle]").forEach(function (btn) {
          syncPasswordToggleLabel(btn, btn.getAttribute("aria-pressed") === "true");
        });
      }, 0);
    });
  }

  function nextPage() {
    var next = params.get("next") || "admin-news.html";
    if (!/^[a-z0-9\-]+\.html$/i.test(next)) next = "admin-news.html";
    return next;
  }

  function isRecoveryLanding() {
    var type = params.get("type") || hashParams.get("type") || "";
    return params.get("mode") === "reset" || type === "recovery";
  }

  function setTabStyle(btn, active) {
    if (!btn) return;
    btn.setAttribute("aria-pressed", active ? "true" : "false");
    btn.className = "btn " + (active ? "btn-gold" : "btn-outline");
  }

  /** Hide login block after successful sign-in (keep reset-password form). */
  function setGuestAuthVisible(visible) {
    if (panel) panel.hidden = !visible;
  }

  function setMode(nextMode) {
    if (nextMode === "register") mode = "register";
    else if (nextMode === "forgot") mode = "forgot";
    else if (nextMode === "reset") mode = "reset";
    else mode = "login";

    if (panel) panel.setAttribute("data-auth-mode", mode);
    if (viewLogin) viewLogin.hidden = mode !== "login";
    if (viewRegister) viewRegister.hidden = mode !== "register";
    if (viewForgot) viewForgot.hidden = mode !== "forgot";
    if (viewReset) viewReset.hidden = mode !== "reset";

    setTabStyle(tabLogin, mode === "login");
    setTabStyle(tabRegister, mode === "register");
    setTabStyle(tabForgot, mode === "forgot" || mode === "reset");

    if (mode === "login") {
      var loginEmail = document.getElementById("login-email");
      if (loginEmail) loginEmail.focus();
    } else if (mode === "register") {
      var regName = document.getElementById("reg-name");
      if (regName) regName.focus();
    } else if (mode === "forgot") {
      var forgotEmail = document.getElementById("forgot-email");
      if (forgotEmail) forgotEmail.focus();
    } else if (mode === "reset") {
      var resetPw = document.getElementById("reset-password");
      if (resetPw) resetPw.focus();
    }
  }

  async function refreshSessionBox() {
    var session = await auth.getSession();
    if (!session) {
      sessionBox.hidden = true;
      if (facultyLink) facultyLink.hidden = true;
      if (newsLink) newsLink.hidden = true;
      if (usersLink) usersLink.hidden = true;
      if (mode !== "reset") setGuestAuthVisible(true);
      return;
    }

    // Password-recovery session: keep the reset form visible.
    if (mode === "reset") {
      if (panel) panel.hidden = false;
      sessionBox.hidden = true;
      return;
    }

    setGuestAuthVisible(false);
    var profile = await auth.getProfile(true);
    var role = profile ? profile.role : "pending";
    var email = (profile && profile.email) || session.user.email || "";
    sessionBox.hidden = false;
    sessionText.textContent = t(
      "已登入：" + email + "｜角色：" + roleLabel(role),
      "Signed in as " + email + " · role: " + roleLabel(role)
    );
    if (newsLink) newsLink.hidden = !auth.isAdminRole(role);
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
        t(
          "已登入，可進入公告後台或教職員後台。",
          "Signed in — you can open announcement or faculty admin."
        ),
        "ok"
      );
    }
  }

  function authErrorText(err) {
    if (auth.mapAuthError) {
      var mapped = auth.mapAuthError(err);
      return t(mapped.zh, mapped.en);
    }
    return String((err && err.message) || err || "");
  }

  function isEmailConfirmLanding() {
    var type = params.get("type") || hashParams.get("type") || "";
    return (
      params.get("email_confirmed") === "1" ||
      type === "signup" ||
      type === "email"
    );
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
      showStatus(t("登入失敗：", "Sign-in failed: ") + authErrorText(err), "err");
    }
  }

  async function doRegister() {
    var email = document.getElementById("reg-email").value;
    var pw = document.getElementById("reg-password").value;
    var pw2 = document.getElementById("reg-password2").value;
    if (pw !== pw2) {
      showStatus(t("兩次輸入的密碼不一致。", "Passwords do not match."), "err");
      return;
    }
    try {
      var data = await auth.signUp(email, pw, document.getElementById("reg-name").value);
      var identities = (data.user && data.user.identities) || [];
      // Supabase may return an obfuscated user when the email is already registered.
      if (data.user && identities.length === 0) {
        showStatus(
          t(
            "此信箱可能已註冊。請直接登入，或使用忘記密碼／重寄確認信。",
            "This email may already be registered. Sign in, or use Forgot password / resend confirmation."
          ),
          "err"
        );
        setMode("login");
        var loginEmailEl = document.getElementById("login-email");
        if (loginEmailEl) loginEmailEl.value = String(email || "").trim();
        return;
      }
      if (data.session) {
        // Confirm email is OFF in Dashboard — still keep role pending for Super Admin.
        showStatus(
          t(
            "註冊成功。角色為「待審核」，請等待超級管理員核准後再進後台。",
            "Registered. Role is pending until a super_admin approves you."
          ),
          "ok"
        );
        await refreshSessionBox();
      } else {
        // Confirm email is ON — user must verify before sign-in.
        setMode("login");
        var loginEmail = document.getElementById("login-email");
        if (loginEmail) loginEmail.value = String(email || "").trim();
        showStatus(
          t(
            "註冊成功！確認信已寄出，請到信箱點擊連結完成驗證後再登入。驗證後角色仍為「待審核」，需超級管理員核准。",
            "Registered! Check your inbox and click the confirmation link, then sign in. After verification your role stays pending until a super_admin approves you."
          ),
          "ok"
        );
      }
    } catch (err) {
      showStatus(t("註冊失敗：", "Registration failed: ") + authErrorText(err), "err");
    }
  }

  async function doResendConfirmation() {
    var emailEl = document.getElementById("login-email");
    var email = emailEl ? String(emailEl.value || "").trim() : "";
    if (!email) {
      showStatus(
        t("請先在登入欄填入電子郵件，再重寄確認信。", "Enter your email in the sign-in field, then resend."),
        "err"
      );
      return;
    }
    if (!auth.resendConfirmation) {
      showStatus(t("此功能無法使用。", "Resend is unavailable."), "err");
      return;
    }
    try {
      await auth.resendConfirmation(email);
      showStatus(
        t(
          "若此信箱已註冊且尚未驗證，確認信已重新寄出。請檢查信箱（含垃圾郵件）。",
          "If this email is registered and unverified, a new confirmation email was sent. Check inbox (and spam)."
        ),
        "ok"
      );
    } catch (err) {
      showStatus(t("重寄失敗：", "Resend failed: ") + authErrorText(err), "err");
    }
  }

  async function doForgot() {
    try {
      var email = document.getElementById("forgot-email").value;
      var redirectTo =
        location.origin +
        location.pathname.replace(/[^/]+$/, "") +
        "login.html?mode=reset&next=" +
        encodeURIComponent(nextPage());
      await auth.resetPassword(email, redirectTo);
      showStatus(
        t(
          "若此信箱已註冊，重設密碼郵件已寄出，請至信箱點擊連結。",
          "If this email is registered, a reset link has been sent. Check your inbox."
        ),
        "ok"
      );
    } catch (err) {
      showStatus(t("寄送失敗：", "Could not send reset email: ") + authErrorText(err), "err");
    }
  }

  async function doResetPassword() {
    var pw = document.getElementById("reset-password").value;
    var pw2 = document.getElementById("reset-password2").value;
    if (pw !== pw2) {
      showStatus(t("兩次輸入的密碼不一致。", "Passwords do not match."), "err");
      return;
    }
    try {
      await auth.updatePassword(pw);
      showStatus(
        t("密碼已更新，請使用新密碼登入。", "Password updated. Please sign in with the new password."),
        "ok"
      );
      try {
        await auth.signOut();
      } catch (e) {}
      sessionBox.hidden = true;
      setMode("login");
      if (history.replaceState) {
        history.replaceState({}, "", "login.html?next=" + encodeURIComponent(nextPage()));
      }
    } catch (err) {
      showStatus(t("更新密碼失敗：", "Could not update password: ") + authErrorText(err), "err");
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

  if (forgotForm) {
    forgotForm.addEventListener("submit", function (event) {
      event.preventDefault();
      doForgot();
    });
  }

  if (resetForm) {
    resetForm.addEventListener("submit", function (event) {
      event.preventDefault();
      doResetPassword();
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

  if (tabForgot) {
    tabForgot.addEventListener("click", function () {
      if (mode === "forgot") {
        if (forgotForm && forgotForm.reportValidity()) doForgot();
      } else if (mode === "reset") {
        if (resetForm && resetForm.reportValidity()) doResetPassword();
      } else {
        setMode("forgot");
      }
    });
  }

  var resendBtn = document.getElementById("auth-btn-resend-confirm");
  if (resendBtn) {
    resendBtn.addEventListener("click", function () {
      doResendConfirmation();
    });
  }

  document.getElementById("auth-btn-logout").addEventListener("click", async function () {
    try {
      await auth.signOut();
      sessionBox.hidden = true;
      if (facultyLink) facultyLink.hidden = true;
      if (newsLink) newsLink.hidden = true;
      if (usersLink) usersLink.hidden = true;
      setGuestAuthVisible(true);
      showStatus(t("已登出。", "Signed out."), "ok");
      setMode("login");
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
    var startMode = "login";
    if (params.get("mode") === "register") startMode = "register";
    else if (params.get("mode") === "forgot") startMode = "forgot";
    else if (isRecoveryLanding()) startMode = "reset";

    setMode(startMode);

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
      // Let Supabase pick up confirm / recovery tokens from the URL hash first.
      await auth.getSession();
      if (isRecoveryLanding()) {
        var session = await auth.getSession();
        if (session) {
          setMode("reset");
          showStatus(
            t(
              "驗證成功，請設定新密碼。",
              "Verified — please set a new password."
            ),
            "ok"
          );
        } else {
          setMode("forgot");
          showStatus(
            t(
              "重設連結無效或已過期，請重新申請忘記密碼。",
              "Reset link is invalid or expired. Request a new one."
            ),
            "err"
          );
        }
      } else if (isEmailConfirmLanding()) {
        setMode("login");
        var confirmedSession = await auth.getSession();
        if (confirmedSession) {
          showStatus(
            t(
              "信箱驗證成功！角色仍為「待審核」，請等待超級管理員核准後再進入後台。",
              "Email verified! Your role stays pending until a super_admin approves you."
            ),
            "ok"
          );
        } else {
          showStatus(
            t(
              "信箱已驗證（或連結已處理）。請使用帳密登入；角色仍為「待審核」，需超級管理員核准。",
              "Email confirmed. Please sign in; your role stays pending until a super_admin approves you."
            ),
            "ok"
          );
        }
        if (history.replaceState) {
          history.replaceState(
            {},
            "",
            "login.html?next=" + encodeURIComponent(nextPage())
          );
        }
      }
      await refreshSessionBox();
    } catch (err) {
      showStatus(t("無法讀取登入狀態：", "Cannot read session: ") + authErrorText(err), "err");
    }
  })();
})();
