(function () {
  var path = location.pathname.replace(/\\/g, "/");
  var file = path.split("/").pop() || "index.html";
  if (!file.includes(".")) file = "index.html";
  var inNews = path.includes("/news/");
  var prefix = inNews ? "../" : "";
  var newsPrefix = inNews ? "" : "news/";

  function t(zh, en) {
    return '<span class="zh">' + zh + '</span><span class="en">' + en + "</span>";
  }

  function navLink(href, zh, en, current, attrs) {
    var aria = current ? ' aria-current="page"' : "";
    var extra = attrs ? " " + attrs : "";
    return '<a href="' + prefix + href + '"' + aria + extra + ">" + t(zh, en) + "</a>";
  }

  function hasAdminNavAccess() {
    try {
      return localStorage.getItem("immba-admin-nav") === "1";
    } catch (err) {
      return false;
    }
  }

  function current() {
    return {
      index: file === "index.html" || file === "",
      about: file === "about.html",
      environment: file === "environment.html",
      admissions: file === "admissions.html",
      apply: file === "apply.html",
      curriculum: file === "curriculum.html",
      faculty: file === "faculty.html",
      guide: file === "guide.html",
      graduation: file === "graduation.html",
      dual: file === "dual-degree.html",
      exchange: file === "exchange.html",
      news: file === "news.html" || file === "announcement.html" || inNews,
      scholarships: file === "scholarships.html",
      contact: file === "contact.html",
      adminNews: file === "admin-news.html",
      adminFaculty: file === "admin-faculty.html",
      adminUsers: file === "admin-users.html",
      login: file === "login.html",
    };
  }

  var c = current();

  var header = document.getElementById("site-header");
  if (header) {
    header.innerHTML =
      '<header class="site-chrome">' +
      /* 1. Top notice bar */
      '<div class="notice-bar">' +
      '<div class="wrap notice-inner">' +
      '<p class="notice-text">' +
      '<span class="zh">本網頁為學生 Zoe Chueh 製作之課程教學網。This is not the official website.</span>' +
      '<span class="en">Teaching-site notice by student Zoe Chueh. This is not the official website.</span>' +
      "</p>" +
      '<div class="notice-actions">' +
      '<a class="notice-link" href="https://www.management.fju.edu.tw/subweb/immba/">' +
      t("官方網站請點此連結", "Official website") +
      "</a>" +
      '<button type="button" class="notice-collapse-btn" data-collapse-menu aria-controls="site-main-nav" aria-expanded="true">' +
      '<span class="zh" data-collapse-label-zh>隱藏主選單</span>' +
      '<span class="en" data-collapse-label-en>Collapse this menu</span>' +
      "</button>" +
      "</div>" +
      "</div></div>" +
      /* 2. Branding header */
      '<div class="branding-header">' +
      '<div class="wrap branding-inner">' +
      '<div class="brand">' +
      '<a class="brand-logo" href="' + prefix + 'login.html?next=admin-news.html" title="AdminNews / Authentication">' +
      '<img src="' + prefix + 'assets/img/immba-logo.jpg" alt="International Management imMBA">' +
      "</a>" +
      '<a class="brand-text" href="' + prefix + 'index.html">' +
      '<span class="brand-kicker">Fu Jen Catholic University · College of Management</span>' +
      '<span class="brand-name">' + t("國際經營管理碩士班（imMBA）", "International Management (imMBA)") + "</span>" +
      "</a></div>" +
      '<button class="menu-toggle" type="button" aria-label="Menu" data-menu-toggle>☰</button>' +
      "</div></div>" +
      '<div class="chrome-sticky">' +
      /* 3. Navigation bar */
      '<div class="nav-bar" id="site-main-nav" data-main-nav>' +
      '<div class="wrap nav-bar-inner">' +
      '<nav class="nav" data-nav aria-label="Primary">' +
      '<div class="drop' + (c.about || c.environment ? " is-current" : "") + '">' +
      '<button type="button" class="drop-trigger" aria-haspopup="true">' + t("簡介", "About") + "</button>" +
      '<div class="drop-menu">' +
      navLink("about.html", "特色與排名", "Overview and Ranking", c.about) +
      navLink("environment.html", "學習環境", "Our Learning Environment", c.environment) +
      "</div></div>" +
      '<div class="drop' + (c.apply ? " is-current" : "") + '">' +
      '<button type="button" class="drop-trigger" aria-haspopup="true">' + t("招生資訊", "Admissions") + "</button>" +
      '<div class="drop-menu">' +
      navLink("apply.html", "申請輔大 imMBA", "Apply for Fu JEN imMBA", c.apply) +
      "</div></div>" +
      '<div class="drop' + (c.curriculum ? " is-current" : "") + '">' +
      '<button type="button" class="drop-trigger" aria-haspopup="true">' + t("課程", "Courses") + "</button>" +
      '<div class="drop-menu">' +
      navLink("curriculum.html", "課程與修業規定", "Curriculum and Requirements", c.curriculum) +
      "</div></div>" +
      (function () {
        var facultyAdmin = hasAdminNavAccess();
        var facultyHref = facultyAdmin ? "admin-faculty.html" : "faculty.html";
        var facultyCurrent = c.faculty || (facultyAdmin && c.adminFaculty);
        return navLink(facultyHref, "師資介紹", "Faculty", facultyCurrent, 'data-nav-faculty="1"');
      })() +
      navLink("guide.html", "imMBA全攻略", "Student guide", c.guide) +
      navLink("graduation.html", "畢業與離校", "Graduation", c.graduation) +
      navLink("dual-degree.html", "跨國雙碩士", "Dual master’s", c.dual) +
      navLink("exchange.html", "海外交換", "Exchange", c.exchange) +
      navLink("news.html", "公告", "News", c.news) +
      navLink("contact.html", "聯絡我們", "Contact", c.contact) +
      "</nav>" +
      '<div class="nav-actions">' +
      '<button type="button" class="lang-toggle" data-locale-toggle>EN</button>' +
      '<a class="btn btn-gold" href="https://www.management.fju.edu.tw/esubweb/immbaengindex/">' + t("我要報名", "Apply Now") + "</a>" +
      "</div></div></div>" +
      "</div></header>";
  }

  var footer = document.getElementById("site-footer");
  if (footer) {
    footer.innerHTML =
      '<footer class="site-footer"><div class="wrap footer-grid">' +
      "<div><h3>imMBA</h3><p>" +
      t(
        "輔仁大學國際經營管理碩士班。全英語授課、AACSB 認證，培養具備國際移動力的管理人才。",
        "Fu Jen Catholic University International Management (imMBA). Fully English-taught and AACSB-accredited, preparing globally mobile managers."
      ) +
      "</p></div>" +
      "<div><h3>" + t("快速連結", "Explore") + "</h3>" +
      navLink("apply.html", "申請輔大 imMBA", "Apply for Fu JEN imMBA", false) + "<br>" +
      navLink("dual-degree.html", "跨國雙碩士", "Dual master’s", false) + "<br>" +
      navLink("news.html", "最新公告", "News", false) + "<br>" +
      navLink("login.html", "管理員登入", "Admin login", c.login) + "<br>" +
      navLink("contact.html", "聯絡我們", "Contact", false) +
      "</div>" +
      "<div><h3>" + t("聯絡", "Contact") + "</h3>" +
      "<p>T +886-2-2905-2750<br>E <a href='mailto:imMBA@mail.fju.edu.tw'>imMBA@mail.fju.edu.tw</a><br>" +
      t("新北市新莊區中正路510號 LM208-1", "No. 510 Zhongzheng Rd, Xinzhuang, New Taipei City, LM208-1") +
      "</p></div></div>" +
      '<div class="wrap legal">' +
      t("內容整理自輔仁大學國際經管官網公開資訊，供新版網站展示使用。", "Content adapted from publicly available Fu Jen imMBA materials for this redesigned site.") +
      " © Fu Jen Catholic University imMBA</div></footer>";
  }

  var params = new URLSearchParams(location.search);
  var queryLocale = params.get("locale");
  var saved = localStorage.getItem("immba-locale");
  var locale =
    queryLocale === "en" || queryLocale === "zh"
      ? queryLocale
      : saved || (navigator.language && navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en");

  var langToggle = document.querySelector("[data-locale-toggle]");
  if (langToggle) {
    langToggle.addEventListener("click", function () {
      var currentLocale = document.documentElement.getAttribute("data-locale");
      setLocale(currentLocale === "en" ? "zh" : "en");
    });
  }

  setLocale(locale);

  if (queryLocale === "en" || queryLocale === "zh") {
    try {
      params.delete("locale");
      var nextSearch = params.toString();
      var nextUrl = location.pathname + (nextSearch ? "?" + nextSearch : "") + location.hash;
      history.replaceState(null, "", nextUrl);
    } catch (err) {}
  }

  function setLocale(next) {
    var isEn = next === "en";
    document.documentElement.lang = isEn ? "en" : "zh-Hant";
    document.documentElement.setAttribute("data-locale", isEn ? "en" : "zh");
    localStorage.setItem("immba-locale", isEn ? "en" : "zh");
    if (langToggle) {
      langToggle.textContent = isEn ? "中文" : "EN";
      langToggle.setAttribute("aria-label", isEn ? "切換為中文" : "Switch to English");
    }
  }

  var toggle = document.querySelector("[data-menu-toggle]");
  if (toggle) {
    toggle.addEventListener("click", function () {
      document.body.classList.toggle("nav-open");
    });
  }

  var MENU_COLLAPSE_KEY = "immba-menu-collapsed";
  var collapseBtn = document.querySelector("[data-collapse-menu]");
  var mainNav = document.querySelector("[data-main-nav]");

  function applyMenuCollapsed(collapsed) {
    document.body.classList.toggle("menu-collapsed", collapsed);
    if (mainNav) {
      if (collapsed) mainNav.setAttribute("hidden", "");
      else mainNav.removeAttribute("hidden");
    }
    if (collapseBtn) {
      collapseBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      var zhLabel = collapseBtn.querySelector("[data-collapse-label-zh]");
      var enLabel = collapseBtn.querySelector("[data-collapse-label-en]");
      if (zhLabel) zhLabel.textContent = collapsed ? "顯示主選單" : "隱藏主選單";
      if (enLabel) enLabel.textContent = collapsed ? "Expand this menu" : "Collapse this menu";
    }
    try {
      localStorage.setItem(MENU_COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch (err) {}
  }

  if (collapseBtn) {
    var savedCollapsed = false;
    try {
      savedCollapsed = localStorage.getItem(MENU_COLLAPSE_KEY) === "1";
    } catch (err) {}
    applyMenuCollapsed(savedCollapsed);
    collapseBtn.addEventListener("click", function () {
      applyMenuCollapsed(!document.body.classList.contains("menu-collapsed"));
    });
  }

  var form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var topic = form.topic.value;
      var name = form.name.value.trim();
      var email = form.email.value.trim();
      var phone = form.phone.value.trim();
      var message = form.message.value.trim();
      var subject = encodeURIComponent("[imMBA] " + topic + " / " + name);
      var body = encodeURIComponent("Name: " + name + "\nEmail: " + email + "\nPhone: " + phone + "\nTopic: " + topic + "\n\n" + message);
      window.location.href = "mailto:imMBA@mail.fju.edu.tw?subject=" + subject + "&body=" + body;
      var ok = document.getElementById("form-success");
      if (ok) ok.style.display = "block";
      form.reset();
    });
  }

  var q = document.getElementById("faculty-q");
  var type = document.getElementById("faculty-type");
  if (q || type) {
    function filterFaculty() {
      var query = (q ? q.value : "").toLowerCase();
      var kind = type ? type.value : "all";
      document.querySelectorAll("[data-faculty]").forEach(function (card) {
        var text = card.textContent.toLowerCase();
        var matchType = kind === "all" || card.getAttribute("data-faculty") === kind;
        card.style.display = matchType && text.indexOf(query) !== -1 ? "" : "none";
      });
    }
    if (q) q.addEventListener("input", filterFaculty);
    if (type) type.addEventListener("change", filterFaculty);
  }

  var newsQ = document.getElementById("news-q");
  if (newsQ) {
    newsQ.addEventListener("input", function () {
      var query = newsQ.value.toLowerCase();
      document.querySelectorAll("[data-news], [data-announce]").forEach(function (item) {
        item.style.display = item.textContent.toLowerCase().indexOf(query) !== -1 ? "" : "none";
      });
    });
  }

  function applyFacultyNavLink(isAdmin) {
    var link = document.querySelector("[data-nav-faculty]");
    if (!link) return;
    link.href = prefix + (isAdmin ? "admin-faculty.html" : "faculty.html");
    if (isAdmin && c.adminFaculty) link.setAttribute("aria-current", "page");
    else if (!isAdmin && c.faculty) link.setAttribute("aria-current", "page");
    else if (!(c.faculty || (isAdmin && c.adminFaculty))) link.removeAttribute("aria-current");
  }

  // Keep「師資介紹 / Faculty」pointing at faculty admin after admin login.
  if (window.ImMbaAuth && typeof window.ImMbaAuth.getProfile === "function") {
    window.ImMbaAuth.getProfile(true)
      .then(function (profile) {
        applyFacultyNavLink(!!(profile && window.ImMbaAuth.isAdminRole(profile.role)));
      })
      .catch(function () {
        applyFacultyNavLink(hasAdminNavAccess());
      });
  } else {
    applyFacultyNavLink(hasAdminNavAccess());
  }
})();
