(function () {
  var auth = window.ImMbaAuth;
  var opt = window.ImMbaAlumniOptions;
  if (!auth || !opt) return;

  var statusEl = document.getElementById("profile-status");
  var form = document.getElementById("profile-form");
  var params = new URLSearchParams(location.search);
  var profile = null;

  function isEn() {
    return document.documentElement.getAttribute("data-locale") === "en";
  }

  function t(zh, en) {
    return isEn() ? en : zh;
  }

  function showStatus(message, kind) {
    statusEl.hidden = false;
    statusEl.className = "admin-status is-" + (kind || "ok");
    statusEl.textContent = message;
  }

  function nextPage() {
    var next = params.get("next") || "admin-news.html";
    if (!/^[a-z0-9-]+\.html$/i.test(next)) return "admin-news.html";
    return next;
  }

  function fillChoices() {
    var years = opt.years();
    opt.fillSelect(document.getElementById("profile-department"), opt.departments, {
      blank: true,
      blankLabel: t("請選擇", "Choose")
    });
    opt.fillSelect(document.getElementById("profile-degree"), opt.degrees, {
      blank: true,
      blankLabel: t("請選擇", "Choose")
    });
    opt.fillSelect(document.getElementById("profile-admission"), years, {
      blank: true,
      blankLabel: t("請選擇", "Choose"),
      itemLabel: opt.yearLabel
    });
    opt.fillSelect(document.getElementById("profile-graduation"), years, {
      blank: true,
      blankLabel: t("未填", "Not set"),
      itemLabel: opt.yearLabel
    });
  }

  function applyProfile() {
    if (!profile) return;
    document.getElementById("profile-name").value = profile.display_name || "";
    document.getElementById("profile-student-id").value = profile.student_id || "";
    document.getElementById("profile-email").value = profile.email || "";
    document.getElementById("profile-phone").value = profile.phone || "";
    document.getElementById("profile-department").value = profile.department || "";
    document.getElementById("profile-degree").value = profile.degree_program || "";
    document.getElementById("profile-admission").value = profile.admission_year == null ? "" : String(profile.admission_year);
    document.getElementById("profile-graduation").value = profile.graduation_year == null ? "" : String(profile.graduation_year);
    document.getElementById("profile-company").value = profile.company || "";
    document.getElementById("profile-job").value = profile.job_title || "";
  }

  function leave() {
    if (profile && auth.isAdminRole(profile.role)) {
      location.href = nextPage();
      return;
    }
    try { sessionStorage.setItem("immba-visitor-note", "1"); } catch (err) {}
    location.href = "index.html";
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var admission = document.getElementById("profile-admission").value;
    var graduation = document.getElementById("profile-graduation").value;
    var fields = {
      full_name: document.getElementById("profile-name").value.trim(),
      student_id: document.getElementById("profile-student-id").value.trim(),
      department: document.getElementById("profile-department").value,
      degree_program: document.getElementById("profile-degree").value,
      admission_year: admission ? Number(admission) : null,
      graduation_year: graduation ? Number(graduation) : null,
      phone: document.getElementById("profile-phone").value.trim(),
      company: document.getElementById("profile-company").value.trim(),
      job_title: document.getElementById("profile-job").value.trim()
    };
    if (!fields.full_name || !fields.department || !fields.degree_program || !fields.admission_year) {
      showStatus(t("請填寫姓名，並選擇系所、學位與入學年。", "Enter your name, then choose department, degree, and admission year."), "err");
      return;
    }
    try {
      profile = await auth.saveOwnProfile(fields);
      leave();
    } catch (err) {
      var message = String((err && err.message) || err || "");
      showStatus(
        message.indexOf("profile_completed") !== -1 || message.indexOf("department") !== -1
          ? t("個人資料欄位尚未建立。請在 Supabase SQL Editor 執行 schema-profile-setup.sql。", "Profile fields are not set up yet. Run schema-profile-setup.sql in the Supabase SQL Editor.")
          : t("儲存失敗：", "Save failed: ") + message,
        "err"
      );
    }
  });

  var localeToggle = document.querySelector("[data-locale-toggle]");
  if (localeToggle) {
    localeToggle.addEventListener("click", function () {
      setTimeout(function () {
        fillChoices();
        applyProfile();
      }, 0);
    });
  }

  (async function init() {
    var session = await auth.getSession();
    if (!session) {
      location.replace("login.html?next=profile-setup.html");
      return;
    }
    profile = await auth.getProfile(true);
    fillChoices();
    applyProfile();
  })();
})();
