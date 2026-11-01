(function () {
  var auth = window.ImMbaAuth;
  if (!auth) return;

  var statsEl = document.getElementById("db-stats");
  var lineEl = document.getElementById("db-line");
  var pieEl = document.getElementById("db-pie");
  var barsEl = document.getElementById("db-bars");
  var dailyEl = document.getElementById("db-daily");
  var dailyNote = document.getElementById("db-daily-note");
  var downloadsEl = document.getElementById("db-downloads");
  var downloadNote = document.getElementById("db-download-note");
  var trendNote = document.getElementById("db-trend-note");
  var noteEl = document.getElementById("db-click-note");
  var pageNote = document.getElementById("db-page-note");
  var statusEl = document.getElementById("db-status");
  var CHART_COLORS = ["#1a3d66", "#c4a35a", "#3d6b8c", "#8c5a3d", "#4f7d62", "#6e5a8c", "#a33d4a", "#5c6b8a", "#b08968", "#2f6f62"];
  var MENU_SECTIONS = [
    { id: "about", files: ["about.html", "environment.html"], zh: "簡介", en: "About" },
    { id: "admissions", files: ["apply.html", "admissions.html"], zh: "招生資訊", en: "Admissions" },
    { id: "courses", files: ["curriculum.html"], zh: "課程", en: "Courses" },
    { id: "faculty", files: ["faculty.html"], zh: "師資介紹", en: "Faculty" },
    { id: "guide", files: ["guide.html"], zh: "imMBA全攻略", en: "Student guide" },
    { id: "graduation", files: ["graduation.html"], zh: "畢業與離校", en: "Graduation" },
    { id: "dual", files: ["dual-degree.html"], zh: "跨國雙碩士", en: "Dual master's" },
    { id: "exchange", files: ["exchange.html"], zh: "海外交換", en: "Exchange" },
    { id: "news", files: ["news.html", "announcement.html"], zh: "公告", en: "News" },
    { id: "contact", files: ["contact.html"], zh: "聯絡我們", en: "Contact" }
  ];
  var cached = [];
  var statusCode = "";
  var statusDetail = "";

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

  function showStatus(message, kind) {
    statusEl.hidden = false;
    statusEl.className = "admin-status is-" + (kind || "ok");
    statusEl.textContent = message;
  }

  function applyStatus() {
    if (statusCode === "missing") {
      showStatus(
        t(
          "瀏覽資料表尚未建立。請在 Supabase SQL Editor 執行 schema-site-analytics.sql。",
          "The browsing table is not set up yet. Run schema-site-analytics.sql in the Supabase SQL Editor."
        ),
        "err"
      );
    } else if (statusCode === "err") {
      showStatus(t("載入失敗：", "Load failed: ") + statusDetail, "err");
    } else {
      statusEl.hidden = true;
    }
  }

  function formatStay(seconds) {
    seconds = Math.max(0, Math.round(seconds || 0));
    var minutes = Math.floor(seconds / 60);
    var remain = seconds % 60;
    if (minutes <= 0) return t(seconds + " 秒", seconds + " sec");
    return t(minutes + " 分 " + remain + " 秒", minutes + " min " + remain + " sec");
  }

  function dayKey(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function recentDays(count) {
    var keys = [];
    var cursor = new Date();
    var today = dayKey(cursor.toISOString());
    var parts = today.split("-");
    var utc = Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var i;
    for (i = count - 1; i >= 0; i -= 1) {
      keys.push(new Date(utc - i * 86400000).toISOString().slice(0, 10));
    }
    return keys;
  }

  function shortDay(key) {
    return key.slice(5).replace("-", "/");
  }

  function emptyMessage() {
    return '<p class="db-empty">' + escapeHtml(t("尚無資料。有人瀏覽網站後，這裡會出現圖表。", "No data yet. Charts appear after someone browses the site.")) + "</p>";
  }

  function lineChart(days, views, visitors) {
    var width = 640;
    var height = 230;
    var pad = { l: 36, r: 12, t: 16, b: 28 };
    var max = 1;
    views.concat(visitors).forEach(function (value) {
      if (value > max) max = value;
    });
    var innerW = width - pad.l - pad.r;
    var innerH = height - pad.t - pad.b;
    function xAt(index) {
      if (days.length <= 1) return pad.l + innerW / 2;
      return pad.l + (innerW * index) / (days.length - 1);
    }
    function yAt(value) {
      return pad.t + innerH - (innerH * value) / max;
    }
    function points(series) {
      return series.map(function (value, index) {
        return xAt(index).toFixed(1) + "," + yAt(value).toFixed(1);
      }).join(" ");
    }
    function dots(series, color) {
      return series.map(function (value, index) {
        if (!value) return "";
        return '<circle cx="' + xAt(index).toFixed(1) + '" cy="' + yAt(value).toFixed(1) + '" r="4" fill="' + color + '"/>';
      }).join("");
    }
    var grid = [0, 0.5, 1].map(function (step) {
      var y = yAt(max * step);
      var label = String(Math.round(max * step));
      return (
        '<line x1="' + pad.l + '" y1="' + y.toFixed(1) + '" x2="' + (width - pad.r) + '" y2="' + y.toFixed(1) + '" stroke="#e4e0d7" stroke-width="1"/>' +
        '<text x="' + (pad.l - 6) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="#7a7468">' + label + "</text>"
      );
    }).join("");
    var labels = days.map(function (key, index) {
      if (index % 2 !== 0 && index !== days.length - 1) return "";
      return '<text x="' + xAt(index).toFixed(1) + '" y="' + (height - 8) + '" text-anchor="middle" font-size="11" fill="#7a7468">' + shortDay(key) + "</text>";
    }).join("");
    var viewPts = points(views);
    var visitorPts = points(visitors);
    var area = viewPts + " " + xAt(days.length - 1).toFixed(1) + "," + yAt(0).toFixed(1) + " " + xAt(0).toFixed(1) + "," + yAt(0).toFixed(1);
    return (
      '<svg viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="' + escapeHtml(t("近 14 日瀏覽折線圖", "Line chart of the last 14 days")) + '">' +
      grid +
      '<polygon points="' + area + '" fill="#1a3d66" opacity="0.12"/>' +
      '<polyline points="' + viewPts + '" fill="none" stroke="#1a3d66" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<polyline points="' + visitorPts + '" fill="none" stroke="#c4a35a" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      dots(views, "#1a3d66") +
      dots(visitors, "#c4a35a") +
      labels +
      "</svg>" +
      '<ul class="db-legend">' +
      '<li><span class="db-swatch" style="background:#1a3d66"></span>' + escapeHtml(t("瀏覽次數", "Page views")) + "</li>" +
      '<li><span class="db-swatch" style="background:#c4a35a"></span>' + escapeHtml(t("瀏覽人數", "Visitors")) + "</li>" +
      "</ul>"
    );
  }

  function sectionId(value) {
    var path = String(value || "").split("?")[0].split("#")[0];
    if (path.indexOf("/news/") !== -1) return "news";
    var file = path.split("/").pop() || "";
    var i;
    for (i = 0; i < MENU_SECTIONS.length; i += 1) {
      if (MENU_SECTIONS[i].files.indexOf(file) !== -1) return MENU_SECTIONS[i].id;
    }
    return "";
  }

  function donutChart(slices, total) {
    var cx = 90;
    var cy = 90;
    var outer = 72;
    var inner = 44;
    var angle = -Math.PI / 2;
    var paths = "";
    if (total) {
      slices.forEach(function (slice, index) {
        if (!slice.count) return;
        var sweep = (slice.count / total) * Math.PI * 2;
        var end = angle + Math.min(sweep, Math.PI * 2 - 0.001);
        var path = donutPath(cx, cy, outer, inner, angle, end);
        angle = end;
        paths += '<path d="' + path + '" fill="' + CHART_COLORS[index % CHART_COLORS.length] + '"><title>' +
          escapeHtml(slice.label) + " " + slice.count + "</title></path>";
      });
    }
    var legend = slices.map(function (slice, index) {
      var share = total ? Math.round((slice.count / total) * 1000) / 10 : 0;
      return (
        "<li><span class=\"db-swatch\" style=\"background:" + CHART_COLORS[index % CHART_COLORS.length] + "\"></span>" +
        "<span>" + escapeHtml(slice.label) + " · " + share + "%</span></li>"
      );
    }).join("");
    var graphic = paths
      ? '<svg viewBox="0 0 180 180" role="img" aria-label="' + escapeHtml(t("主選單頁面點閱圓餅圖", "Pie chart of menu page visits")) + '">' +
        paths +
        '<text x="90" y="86" text-anchor="middle" font-size="22" font-weight="700" fill="#1a3d66">' + total + "</text>" +
        '<text x="90" y="106" text-anchor="middle" font-size="11" fill="#7a7468">' + escapeHtml(t("次點閱", "visits")) + "</text>" +
        "</svg>"
      : '<p class="db-empty">' + escapeHtml(t("這十個頁面尚無點閱。", "No visits to these ten pages yet.")) + "</p>";
    return '<div class="db-pie-layout">' + graphic + '<ul class="db-legend">' + legend + "</ul></div>";
  }

  function donutPath(cx, cy, outer, inner, a0, a1) {
    function point(radius, angle) {
      return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    }
    var start = point(outer, a0);
    var end = point(outer, a1);
    var innerEnd = point(inner, a1);
    var innerStart = point(inner, a0);
    var large = a1 - a0 > Math.PI ? 1 : 0;
    return (
      "M " + start[0].toFixed(2) + " " + start[1].toFixed(2) +
      " A " + outer + " " + outer + " 0 " + large + " 1 " + end[0].toFixed(2) + " " + end[1].toFixed(2) +
      " L " + innerEnd[0].toFixed(2) + " " + innerEnd[1].toFixed(2) +
      " A " + inner + " " + inner + " 0 " + large + " 0 " + innerStart[0].toFixed(2) + " " + innerStart[1].toFixed(2) +
      " Z"
    );
  }

  function dailyPeopleChart(days, counts) {
    var width = 640;
    var height = 220;
    var pad = { l: 28, r: 8, t: 20, b: 28 };
    var max = 1;
    counts.forEach(function (count) {
      if (count > max) max = count;
    });
    var innerW = width - pad.l - pad.r;
    var innerH = height - pad.t - pad.b;
    var gap = 8;
    var barW = (innerW - gap * (days.length - 1)) / days.length;
    var bars = counts.map(function (count, index) {
      var barH = count ? Math.max(4, (innerH * count) / max) : 0;
      var x = pad.l + index * (barW + gap);
      var y = pad.t + innerH - barH;
      var label = "";
      if (index % 2 === 0 || index === days.length - 1) {
        label = '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (height - 8) + '" text-anchor="middle" font-size="11" fill="#7a7468">' + shortDay(days[index]) + "</text>";
      }
      var value = count
        ? '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + Math.max(14, y - 4).toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#1a3d66">' + count + "</text>"
        : "";
      var fill = index === counts.length - 1 ? "#c4a35a" : "#1a3d66";
      return (
        '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + barH.toFixed(1) + '" rx="4" fill="' + fill + '"/>' +
        value + label
      );
    }).join("");
    return (
      '<svg viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="' +
      escapeHtml(t("近 14 日每日瀏覽人數長條圖", "Bar chart of daily visitors for the last 14 days")) + '">' +
      bars + "</svg>"
    );
  }

  function downloadKind(row) {
    var label = String(row.label || "");
    if (label.indexOf("download:brochure") === 0) return "brochure";
    if (label.indexOf("download:map") === 0) return "map";
    if (label.indexOf("download:form") === 0) return "form";
    var href = "";
    try { href = decodeURIComponent(String(row.href || "")).toLowerCase(); } catch (err) { href = String(row.href || "").toLowerCase(); }
    var text = label.toLowerCase();
    if (text.indexOf("簡章") !== -1 || text.indexOf("brochure") !== -1 || href.indexOf("116 immba.pdf") !== -1 || href.indexOf("fjcu_115-2admission.pdf") !== -1) return "brochure";
    if (
      href.indexOf("0907.pdf") !== -1 ||
      href.indexOf("course introduction") !== -1 ||
      href.indexOf("curriculum structure") !== -1 ||
      text.indexOf("上課時間表") !== -1 ||
      text.indexOf("課程目錄") !== -1 ||
      text.indexOf("修課規劃") !== -1 ||
      text.indexOf("course structure") !== -1 ||
      text.indexOf("course catalog") !== -1 ||
      text.indexOf("curriculum (pdf)") !== -1
    ) return "map";
    if (
      href.indexOf("116 0819") !== -1 ||
      href.indexOf("1121(1).pdf") !== -1 ||
      href.indexOf("/0310.pdf") !== -1 ||
      text.indexOf("書面資料") !== -1 ||
      text.indexOf("自傳") !== -1 ||
      text.indexOf("申請書") !== -1 ||
      text.indexOf("dual-degree application") !== -1
    ) return "form";
    return "";
  }

  function downloadChart(items) {
    var top = 0;
    items.forEach(function (item) {
      if (item.count > top) top = item.count;
    });
    return items.map(function (item) {
      var width = top && item.count ? Math.max(6, Math.round((item.count / top) * 100)) : 0;
      return (
        '<div class="db-bar-row">' +
        '<span class="db-bar-label">' + escapeHtml(item.label) + "</span>" +
        '<span class="db-bar-track"><span class="db-bar-fill" style="width:' + width + '%"></span></span>' +
        '<span class="db-bar-value">' + item.count + "</span>" +
        "</div>"
      );
    }).join("");
  }

  function render(rows) {
    var visitors = {};
    var views = 0;
    var sessionTime = {};
    var clicks = {};
    var clickTotal = 0;
    var downloads = { brochure: 0, map: 0, form: 0 };
    var sectionCounts = {};
    MENU_SECTIONS.forEach(function (item) { sectionCounts[item.id] = 0; });

    var days = recentDays(14);
    var dayViews = {};
    var dayVisitors = {};
    days.forEach(function (key) {
      dayViews[key] = 0;
      dayVisitors[key] = {};
    });

    rows.forEach(function (row) {
      if (row.event_type === "pageview") {
        views += 1;
        if (row.visitor_id) visitors[row.visitor_id] = true;
        var key = dayKey(row.created_at);
        if (Object.prototype.hasOwnProperty.call(dayViews, key)) {
          dayViews[key] += 1;
          if (row.visitor_id) dayVisitors[key][row.visitor_id] = true;
        }
        var section = sectionId(row.path);
        if (section) sectionCounts[section] += 1;
      } else if (row.event_type === "duration" && row.session_id) {
        sessionTime[row.session_id] = (sessionTime[row.session_id] || 0) + (Number(row.duration_seconds) || 0);
      } else if (row.event_type === "click") {
        var kind = downloadKind(row);
        if (kind) {
          downloads[kind] += 1;
        } else {
          clickTotal += 1;
          var key = (row.href || "") + "|" + (row.label || "");
          if (!clicks[key]) clicks[key] = { label: row.label || row.href || "—", href: row.href || "", count: 0 };
          clicks[key].count += 1;
        }
      }
    });

    var people = Object.keys(visitors).length;
    var sessions = Object.keys(sessionTime);
    var totalStay = sessions.reduce(function (sum, id) { return sum + sessionTime[id]; }, 0);
    var averageStay = sessions.length ? totalStay / sessions.length : 0;

    statsEl.innerHTML =
      statCard(t("瀏覽人數", "Visitors"), String(people), t("不同的訪客", "Distinct people")) +
      statCard(t("瀏覽次數", "Page views"), String(views), t("頁面被打開的次數", "Times a page was opened")) +
      statCard(t("平均停留", "Time on site"), formatStay(averageStay), t("每人每次造訪大約停留", "Typical stay per visit"));

    trendNote.textContent = t("近 14 日", "Last 14 days");
    var viewSeries = days.map(function (key) { return dayViews[key]; });
    var visitorSeries = days.map(function (key) { return Object.keys(dayVisitors[key]).length; });
    var hasTrend = viewSeries.some(function (value) { return value > 0; });
    lineEl.innerHTML = hasTrend ? lineChart(days, viewSeries, visitorSeries) : emptyMessage();

    var hasPeople = visitorSeries.some(function (count) { return count > 0; });
    dailyNote.textContent = t("近 14 日，每一條是當天不同的訪客", "Last 14 days. Each bar is that day's distinct visitors");
    dailyEl.innerHTML = hasPeople ? dailyPeopleChart(days, visitorSeries) : emptyMessage();

    var sectionTotal = 0;
    var pieSlices = MENU_SECTIONS.map(function (item) {
      sectionTotal += sectionCounts[item.id];
      return { label: t(item.zh, item.en), count: sectionCounts[item.id] };
    });
    noteEl.textContent = t("主選單這十個頁面的點閱占比", "Share of visits to these ten menu pages");
    pieEl.innerHTML = donutChart(pieSlices, sectionTotal);

    var sectionBars = MENU_SECTIONS.map(function (item, index) {
      return { label: t(item.zh, item.en), count: sectionCounts[item.id], order: index };
    });
    sectionBars.sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return a.order - b.order;
    });
    pageNote.textContent = t("這十個主選單頁面的瀏覽次數", "Views of these ten menu pages");
    barsEl.innerHTML = downloadChart(sectionBars);

    var downloadItems = [
      { id: "brochure", count: downloads.brochure, label: t("簡章 PDF", "Brochure PDF") },
      { id: "map", count: downloads.map, label: t("課程地圖", "Curriculum map") },
      { id: "form", count: downloads.form, label: t("申請表單", "Application form") }
    ];
    downloadItems.sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return ["brochure", "map", "form"].indexOf(a.id) - ["brochure", "map", "form"].indexOf(b.id);
    });
    var downloadTotal = downloads.brochure + downloads.map + downloads.form;
    downloadNote.textContent = downloadTotal
      ? t("最長的長條是下載最多次的檔案", "The longest bar is downloaded most often")
      : t("尚無下載", "No downloads yet");
    downloadsEl.innerHTML = downloadChart(downloadItems);
  }

  function statCard(label, value, hint) {
    return (
      '<article class="db-stat">' +
      '<p class="db-stat-label">' + escapeHtml(label) + "</p>" +
      '<p class="db-stat-value">' + escapeHtml(value) + "</p>" +
      '<p class="db-stat-hint">' + escapeHtml(hint) + "</p>" +
      "</article>"
    );
  }

  (async function init() {
    var gate = await auth.requireAdmin();
    if (!gate) return;
    try {
      var sb = auth.getClient();
      var result = await sb
        .from("site_events")
        .select("visitor_id,session_id,event_type,path,label,href,duration_seconds,created_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (result.error) throw result.error;
      cached = result.data || [];
      statusCode = "";
      render(cached);
      applyStatus();
    } catch (err) {
      var message = String((err && err.message) || err || "");
      statusDetail = message;
      statusCode = (message.indexOf("site_events") !== -1 || message.indexOf("schema cache") !== -1) ? "missing" : "err";
      cached = [];
      render(cached);
      applyStatus();
    }
  })();

  var localeToggle = document.querySelector("[data-locale-toggle]");
  if (localeToggle) {
    localeToggle.addEventListener("click", function () {
      setTimeout(function () {
        render(cached);
        applyStatus();
      }, 0);
    });
  }
})();
