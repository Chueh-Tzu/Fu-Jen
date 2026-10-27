(function (global) {
  var client = null;
  var cached = { session: null, profile: null, loadedAt: 0 };
  var ADMIN_NAV_KEY = "immba-admin-nav";

  function setAdminNavAccess(enabled) {
    try {
      if (enabled) localStorage.setItem(ADMIN_NAV_KEY, "1");
      else localStorage.removeItem(ADMIN_NAV_KEY);
    } catch (err) {}
  }

  function getClient() {
    if (client) return client;
    var cfg = global.ImMbaSupabaseConfig;
    if (!cfg || !cfg.url || !cfg.anonKey) {
      throw new Error("Missing ImMbaSupabaseConfig.");
    }
    if (!global.supabase || typeof global.supabase.createClient !== "function") {
      throw new Error("Supabase JS SDK not loaded.");
    }
    client = global.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return client;
  }

  function normalizeProfile(row) {
    if (!row) return null;
    return {
      id: row.id,
      email: String(row.email || "").trim(),
      display_name: String(row.display_name || "").trim(),
      role: row.role === "admin" || row.role === "super_admin" ? row.role : "pending",
      created_at: row.created_at || null,
      updated_at: row.updated_at || null
    };
  }

  function isAdminRole(role) {
    return role === "admin" || role === "super_admin";
  }

  /** Absolute URL for login.html on this site (used for email redirects). */
  function loginPageUrl(query) {
    var base =
      location.origin +
      location.pathname.replace(/[^/]+$/, "") +
      "login.html";
    if (!query) return base;
    return base + (query.charAt(0) === "?" ? query : "?" + query);
  }

  /**
   * Map Supabase Auth errors to bilingual user-facing text.
   * @returns {{ zh: string, en: string }}
   */
  function mapAuthError(err) {
    var code = String((err && err.code) || "");
    var msg = String((err && err.message) || err || "");
    var lower = msg.toLowerCase();
    if (
      code === "email_not_confirmed" ||
      lower.indexOf("email not confirmed") !== -1
    ) {
      return {
        zh: "信箱尚未驗證。請先到信箱點擊確認連結，完成後再登入。",
        en: "Email not confirmed. Open the confirmation link in your inbox, then sign in."
      };
    }
    if (
      code === "over_email_send_rate_limit" ||
      lower.indexOf("rate limit") !== -1
    ) {
      return {
        zh: "寄信次數已達上限，請稍後再試（或於 Supabase 設定自訂 SMTP）。",
        en: "Email rate limit reached. Try again later (or configure custom SMTP in Supabase)."
      };
    }
    if (
      code === "email_address_not_authorized" ||
      lower.indexOf("not authorized") !== -1
    ) {
      return {
        zh: "目前內建寄信無法寄到此信箱。請在 Supabase 設定自訂 SMTP，或改用專案成員信箱測試。",
        en: "Built-in email cannot send to this address. Configure custom SMTP in Supabase, or test with a team-member inbox."
      };
    }
    if (
      lower.indexOf("user already registered") !== -1 ||
      lower.indexOf("already been registered") !== -1
    ) {
      return {
        zh: "此信箱已註冊。請直接登入，或使用忘記密碼。",
        en: "This email is already registered. Sign in, or use Forgot password."
      };
    }
    if (lower.indexOf("invalid login credentials") !== -1) {
      return {
        zh: "帳號或密碼錯誤。",
        en: "Invalid email or password."
      };
    }
    return { zh: msg, en: msg };
  }

  async function getSession() {
    var sb = getClient();
    var result = await sb.auth.getSession();
    if (result.error) throw result.error;
    cached.session = result.data.session || null;
    return cached.session;
  }

  async function getProfile(force) {
    var session = await getSession();
    if (!session || !session.user) {
      cached.profile = null;
      setAdminNavAccess(false);
      return null;
    }
    if (!force && cached.profile && cached.profile.id === session.user.id) {
      setAdminNavAccess(isAdminRole(cached.profile.role));
      return cached.profile;
    }
    var sb = getClient();
    var result = await sb
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();
    if (result.error) throw result.error;
    cached.profile = normalizeProfile(result.data);
    // If trigger lagged, create a pending profile row once.
    if (!cached.profile) {
      var upsert = await sb.from("profiles").upsert({
        id: session.user.id,
        email: session.user.email,
        display_name: (session.user.user_metadata && session.user.user_metadata.display_name) ||
          String(session.user.email || "").split("@")[0],
        role: "pending"
      }).select().maybeSingle();
      if (upsert.error) throw upsert.error;
      cached.profile = normalizeProfile(upsert.data);
    }
    setAdminNavAccess(cached.profile && isAdminRole(cached.profile.role));
    return cached.profile;
  }

  async function signUp(email, password, displayName) {
    var sb = getClient();
    // Confirm-email link returns users to the login page (role stays pending in profiles).
    var emailRedirectTo = loginPageUrl("email_confirmed=1");
    var result = await sb.auth.signUp({
      email: String(email || "").trim(),
      password: String(password || ""),
      options: {
        data: { display_name: String(displayName || "").trim() || null },
        emailRedirectTo: emailRedirectTo
      }
    });
    if (result.error) throw result.error;
    cached.session = result.data.session || null;
    cached.profile = null;
    return result.data;
  }

  /** Resend signup confirmation email (Confirm email must be enabled in Dashboard). */
  async function resendConfirmation(email) {
    var sb = getClient();
    var result = await sb.auth.resend({
      type: "signup",
      email: String(email || "").trim(),
      options: { emailRedirectTo: loginPageUrl("email_confirmed=1") }
    });
    if (result.error) throw result.error;
    return result.data;
  }

  async function signIn(email, password) {
    var sb = getClient();
    var result = await sb.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: String(password || "")
    });
    if (result.error) throw result.error;
    cached.session = result.data.session || null;
    cached.profile = null;
    return result.data;
  }

  async function signOut() {
    var sb = getClient();
    var result = await sb.auth.signOut();
    if (result.error) throw result.error;
    cached.session = null;
    cached.profile = null;
    setAdminNavAccess(false);
  }

  /**
   * Send password-reset email. redirectTo should be allow-listed in Supabase Auth.
   * @param {string} email
   * @param {string} [redirectTo]
   */
  async function resetPassword(email, redirectTo) {
    var sb = getClient();
    var result = await sb.auth.resetPasswordForEmail(String(email || "").trim(), {
      redirectTo: redirectTo || loginPageUrl("mode=reset")
    });
    if (result.error) throw result.error;
    return result.data;
  }

  async function updatePassword(newPassword) {
    var sb = getClient();
    var result = await sb.auth.updateUser({ password: String(newPassword || "") });
    if (result.error) throw result.error;
    return result.data;
  }

  async function listProfiles() {
    var sb = getClient();
    var result = await sb
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });
    if (result.error) throw result.error;
    return (result.data || []).map(normalizeProfile);
  }

  async function setRole(userId, role) {
    if (!/^(pending|admin|super_admin)$/.test(role)) {
      throw new Error("Invalid role.");
    }
    var sb = getClient();
    var result = await sb
      .from("profiles")
      .update({ role: role })
      .eq("id", userId)
      .select()
      .single();
    if (result.error) throw result.error;
    return normalizeProfile(result.data);
  }

  /**
   * Guard for admin pages. Returns { session, profile } or redirects.
   * @param {{ redirectTo?: string, allowPendingPage?: boolean }} [opts]
   */
  async function requireAdmin(opts) {
    opts = opts || {};
    var redirectTo = opts.redirectTo || "login.html";
    var session = await getSession();
    if (!session) {
      location.replace(redirectTo + "?next=" + encodeURIComponent(location.pathname.split("/").pop() || "admin-faculty.html"));
      return null;
    }
    var profile = await getProfile(true);
    if (!profile || !isAdminRole(profile.role)) {
      location.replace("login.html?denied=1");
      return null;
    }
    return { session: session, profile: profile };
  }

  async function requireSuperAdmin(opts) {
    var gate = await requireAdmin(opts);
    if (!gate) return null;
    if (gate.profile.role !== "super_admin") {
      location.replace("admin-faculty.html?need_super=1");
      return null;
    }
    return gate;
  }

  global.ImMbaAuth = {
    getClient: getClient,
    getSession: getSession,
    getProfile: getProfile,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    resendConfirmation: resendConfirmation,
    resetPassword: resetPassword,
    updatePassword: updatePassword,
    listProfiles: listProfiles,
    setRole: setRole,
    requireAdmin: requireAdmin,
    requireSuperAdmin: requireSuperAdmin,
    isAdminRole: isAdminRole,
    mapAuthError: mapAuthError,
    loginPageUrl: loginPageUrl,
    setAdminNavAccess: setAdminNavAccess,
    ADMIN_NAV_KEY: ADMIN_NAV_KEY
  };
})(window);

