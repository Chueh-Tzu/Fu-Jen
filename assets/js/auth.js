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
      role: row.role === "admin" || row.role === "super_admin" || row.role === "pending" || row.role === "rejected" || row.role === "visitor"
        ? row.role
        : "visitor",
      profile_completed: row.profile_completed === false ? false : true,
      student_id: row.student_id || "",
      department: row.department || "",
      degree_program: row.degree_program || "",
      admission_year: row.admission_year == null ? null : row.admission_year,
      graduation_year: row.graduation_year == null ? null : row.graduation_year,
      phone: row.phone || "",
      company: row.company || "",
      job_title: row.job_title || "",
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
    if (!cached.profile) {
      cached.profile = await insertOwnProfile(sb, session);
    }
    setAdminNavAccess(cached.profile && isAdminRole(cached.profile.role));
    return cached.profile;
  }

  async function insertOwnProfile(sb, session) {
    var row = {
      id: session.user.id,
      email: session.user.email,
      display_name: (session.user.user_metadata && session.user.user_metadata.display_name) ||
        String(session.user.email || "").split("@")[0]
    };
    var created = await sb.from("profiles").insert(Object.assign({ role: "pending", profile_completed: false }, row)).select().maybeSingle();
    if (created.error && String(created.error.message || "").indexOf("profile_completed") !== -1) {
      created = await sb.from("profiles").insert(Object.assign({ role: "pending" }, row)).select().maybeSingle();
    }
    if (created.error) throw created.error;
    return normalizeProfile(created.data);
  }

  async function recordLogin(profile) {
    try {
      var session = cached.session || (await getSession());
      if (!session || !session.user) return;
      var allowed = { visitor: 1, pending: 1, rejected: 1, admin: 1, super_admin: 1 };
      var role = profile && allowed[profile.role] ? profile.role : "visitor";
      var name =
        (profile && profile.display_name) ||
        (session.user.user_metadata && session.user.user_metadata.display_name) ||
        String(session.user.email || "").split("@")[0];
      var sb = getClient();
      await sb.from("login_logs").insert({
        user_id: session.user.id,
        display_name: name,
        email: (profile && profile.email) || session.user.email || "",
        role: role
      });
    } catch (err) {}
  }

  async function listLoginLogs() {
    var sb = getClient();
    var result = await sb
      .from("login_logs")
      .select("*")
      .order("logged_in_at", { ascending: false })
      .limit(300);
    if (result.error) throw result.error;
    return result.data || [];
  }

  function activityActor() {
    var profile = cached.profile || {};
    var session = cached.session;
    var email = profile.email || (session && session.user && session.user.email) || "";
    var name =
      profile.display_name ||
      (session && session.user && session.user.user_metadata && session.user.user_metadata.display_name) ||
      String(email || "").split("@")[0] ||
      "";
    return {
      actor_id: (session && session.user && session.user.id) || profile.id || null,
      actor_email: email,
      actor_name: name,
      actor_role: profile.role || ""
    };
  }

  function activityInsertRow(entry) {
    var actor = activityActor();
    var changes = Object.assign({}, entry.changes || {});
    if (actor.actor_name) changes.actor_name = actor.actor_name;
    if (actor.actor_role) changes.actor_role = actor.actor_role;
    return {
      actor_id: actor.actor_id,
      actor_email: actor.actor_email,
      action: entry.action,
      entity_type: entry.entity_type || "record",
      entity_id: entry.entity_id == null || entry.entity_id === "" ? null : String(entry.entity_id),
      entity_label: entry.entity_label || null,
      summary: entry.summary || null,
      changes: changes
    };
  }

  async function writeActivity(entry) {
    if (!cached.session) await getSession();
    if (!cached.profile) await getProfile(true);
    var sb = getClient();
    var result = await sb.from("audit_logs").insert(activityInsertRow(entry));
    if (result.error) throw result.error;
  }

  async function listActivityLogs() {
    var sb = getClient();
    var result = await sb
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (result.error) throw result.error;
    var profiles = await sb.from("profiles").select("id, display_name, email, role");
    var byId = {};
    if (!profiles.error) {
      (profiles.data || []).forEach(function (profile) {
        byId[profile.id] = profile;
      });
    }
    return (result.data || []).map(function (row) {
      var changes = row.changes || {};
      var profile = byId[row.actor_id] || {};
      return {
        display_name: changes.actor_name || profile.display_name || "",
        email: row.actor_email || profile.email || "",
        logged_at: row.created_at,
        role: changes.actor_role || profile.role || "",
        action: row.action,
        entity_type: row.entity_type || "",
        entity_label: row.entity_label || "",
        entity_id: row.entity_id || ""
      };
    });
  }

  async function signUp(email, password, displayName) {
    var sb = getClient();
    // Confirm-email link returns users to the login page (role stays visitor until approval).
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
    var profile = null;
    try {
      profile = await getProfile(true);
    } catch (err) {}
    await recordLogin(profile);
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
    if (!/^(visitor|pending|rejected|admin|super_admin)$/.test(role)) {
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

  async function saveOwnProfile(fields) {
    var session = await getSession();
    if (!session || !session.user) throw new Error("Not signed in.");
    var sb = getClient();
    var patch = {
      display_name: fields.full_name,
      student_id: fields.student_id || null,
      department: fields.department || null,
      degree_program: fields.degree_program || null,
      admission_year: fields.admission_year,
      graduation_year: fields.graduation_year,
      phone: fields.phone || null,
      company: fields.company || null,
      job_title: fields.job_title || null,
      profile_completed: true
    };
    var result = await sb.from("profiles").update(patch).eq("id", session.user.id).select("*").single();
    if (result.error) throw result.error;
    cached.profile = normalizeProfile(result.data);
    try {
      if (!isAdminRole(cached.profile.role)) return cached.profile;
      var alumniRow = {
        full_name: fields.full_name,
        student_id: fields.student_id || null,
        department: fields.department || null,
        degree_program: fields.degree_program || null,
        admission_year: fields.admission_year,
        graduation_year: fields.graduation_year,
        email: session.user.email || null,
        phone: fields.phone || null,
        company: fields.company || null,
        job_title: fields.job_title || null,
        updated_by: session.user.id
      };
      var existing = await sb.from("alumni").select("id").eq("created_by", session.user.id).limit(1);
      if (existing.error) return cached.profile;
      if (existing.data && existing.data[0]) {
        await sb.from("alumni").update(alumniRow).eq("id", existing.data[0].id);
      } else {
        alumniRow.created_by = session.user.id;
        var inserted = await sb.from("alumni").insert(alumniRow).select("id,full_name").single();
        if (!inserted.error && inserted.data) {
          await sb.from("audit_logs").insert({
            actor_id: session.user.id,
            actor_email: session.user.email,
            action: "CREATE",
            entity_type: "alumni",
            entity_id: String(inserted.data.id),
            entity_label: inserted.data.full_name,
            summary: "profile",
            changes: { after: alumniRow }
          });
        }
      }
    } catch (err) {}
    return cached.profile;
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
      if (profile && (profile.role === "pending" || profile.role === "rejected")) {
        try { sessionStorage.setItem("immba-visitor-note", profile.role); } catch (err) {}
        location.replace("index.html");
        return null;
      }
      location.replace("login.html?denied=1");
      return null;
    }
    if (profile.profile_completed === false && opts.skipProfile !== true) {
      var here = location.pathname.split("/").pop() || "admin-news.html";
      if (here !== "profile-setup.html") {
        location.replace("profile-setup.html?next=" + encodeURIComponent(here));
        return null;
      }
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
    listLoginLogs: listLoginLogs,
    listActivityLogs: listActivityLogs,
    writeActivity: writeActivity,
    activityInsertRow: activityInsertRow,
    recordLogin: recordLogin,
    setRole: setRole,
    requireAdmin: requireAdmin,
    requireSuperAdmin: requireSuperAdmin,
    saveOwnProfile: saveOwnProfile,
    isAdminRole: isAdminRole,
    mapAuthError: mapAuthError,
    loginPageUrl: loginPageUrl,
    setAdminNavAccess: setAdminNavAccess,
    ADMIN_NAV_KEY: ADMIN_NAV_KEY
  };
})(window);

