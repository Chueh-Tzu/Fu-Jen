(function (global) {
  var STORAGE_KEY = "immba-announcements-v1";
  var TABLE = "announcements";
  var cache = null;
  var loadPromise = null;
  var client = null;

  /** Default announcements collected from the official imMBA news page. */
  var DEFAULT_ANNOUNCEMENTS = [
    {
      id: "2689",
      date: "2026-08-19",
      dateLabel: "2026/08/19",
      top: true,
      zh: {
        title: "(國際經管-全英MBA) 116甄試招生報名：2026/09/30-10/13",
        url: "https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=2689"
      },
      en: {
        title: "Spring 2027, apply NOW!! (Sep 14 - Oct 14) - This track is open to international students only",
        url: "https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=187"
      }
    },
    {
      id: "2905",
      date: "2025-01-30",
      dateLabel: "2025/01/30",
      top: true,
      zh: {
        title: "管理學院職涯平台-工作職缺",
        url: "https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=2905"
      },
      en: {
        title: "College of Management Career Platform – Job Openings",
        url: "https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=398"
      }
    },
    {
      id: "3417",
      date: "2026-10-13",
      dateLabel: "2026/10/13",
      top: false,
      zh: {
        title: "【下一站，澳洲黃金海岸？｜國際經管imMBA 與 Bond University 洽談 1+1 雙碩士合作】",
        url: "https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3417"
      },
      en: {
        title: "【Next Stop: Australia's Gold Coast? | imMBA × Bond University】",
        url: "https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=428"
      }
    },
    {
      id: "3415",
      date: "2026-10-06",
      dateLabel: "2026/10/06",
      top: false,
      zh: {
        title: "【國際經管 imMBA × UT Dallas｜雙碩士合作持續推進中】",
        url: "https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3415"
      },
      en: {
        title: "【imMBA × UT Dallas | Dual Master's Collaboration Moving Forward】",
        url: "https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=426"
      }
    },
    {
      id: "3412",
      date: "2026-09-29",
      dateLabel: "2026/09/29",
      top: false,
      zh: {
        title: "【 9/29 招生說明會重點回顧｜明天開始報名！】",
        url: "https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3412"
      },
      en: {
        title: "【9/29 Admissions Info Session Recap｜Local Student Applications Open Tomorrow!】",
        url: "https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=424"
      }
    },
    {
      id: "3408",
      date: "2026-09-22",
      dateLabel: "2026/09/22",
      top: false,
      zh: {
        title: "【 碩士兩年，不只一個學位。】",
        url: "https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3408"
      },
      en: {
        title: "【Two Years, More Than One Master's Degree.】",
        url: "https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=423"
      }
    },
    {
      id: "3402",
      date: "2026-09-15",
      dateLabel: "2026/09/15",
      top: false,
      zh: {
        title: "【你身邊有正在考慮 MBA 的國際學生嗎？】",
        url: "https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3402"
      },
      en: {
        title: "【International Students: Get to Know Fu Jen imMBA at Our Info Session!】",
        url: "https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=422"
      }
    },
    {
      id: "3396",
      date: "2026-09-08",
      dateLabel: "2026/09/08",
      top: false,
      zh: {
        title: "【碩士兩年，可以有多大可能？】",
        url: "https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3396"
      },
      en: {
        title: "【How much is possible in two years?】",
        url: "https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=421"
      }
    },
    {
      id: "3391",
      date: "2026-09-02",
      dateLabel: "2026/09/02",
      top: false,
      zh: {
        title: "【90 Seconds with the Professor｜AI × Product】",
        url: "https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3391"
      },
      en: {
        title: "【90 Seconds with the Professor｜AI × Product】",
        url: "https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=420"
      }
    },
    {
      id: "3387",
      date: "2026-08-26",
      dateLabel: "2026/08/26",
      top: false,
      zh: {
        title: "【New Course Spotlight｜Data Analytics for International Business】",
        url: "https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3387"
      },
      en: {
        title: "【New Course Spotlight｜Data Analytics for International Business】",
        url: "https://www.management.fju.edu.tw/esubweb/immbaengindex/news-detail.php?NID=419"
      }
    },
    {
      id: "3383",
      date: "2026-08-19",
      dateLabel: "2026/08/19",
      top: false,
      zh: {
        title: "【New Course Spotlight｜AI-Assisted Digital Product Development】",
        url: "https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3383"
      },
      en: {
        title: "【New Course Spotlight｜AI-Assisted Digital Product Development】",
        url: "https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3383"
      }
    },
    {
      id: "3379",
      date: "2026-08-05",
      dateLabel: "2026/08/05",
      top: false,
      zh: {
        title: "【Summer Pause】",
        url: "https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3379"
      },
      en: {
        title: "【Summer Pause】",
        url: "https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=3379"
      }
    }
  ];

  var SOURCE = {
    zh: {
      label: "資料來源：",
      name: "輔仁大學國際經管(imMBA)官方公告",
      url: "https://www.management.fju.edu.tw/subweb/immba/news.php",
      details: "查看詳細內容",
      more: "更多公告"
    },
    en: {
      label: "Source: ",
      name: "Fu Jen imMBA Official News",
      url: "https://www.management.fju.edu.tw/esubweb/immbaengindex/news.php",
      details: "View Details",
      more: "More announcements"
    }
  };

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULT_ANNOUNCEMENTS));
  }

  function dateLabelFromIso(iso) {
    return String(iso || "").replace(/-/g, "/");
  }

  function normalizeItem(item) {
    var date = item.date || "";
    return {
      id: String(item.id || ""),
      date: date,
      dateLabel: item.dateLabel || dateLabelFromIso(date),
      top: !!item.top,
      // Default published so existing localStorage / seed items stay visible on the homepage
      published: item.published !== false,
      photoUrl: String(item.photoUrl || "").trim(),
      fileUrl: String(item.fileUrl || "").trim(),
      fileName: String(item.fileName || "").trim(),
      zh: {
        title: (item.zh && item.zh.title) || "",
        url: (item.zh && item.zh.url) || "",
        content: (item.zh && item.zh.content) || ""
      },
      en: {
        title: (item.en && item.en.title) || "",
        url: (item.en && item.en.url) || "",
        content: (item.en && item.en.content) || ""
      }
    };
  }

  function getClient() {
    if (client) return client;
    if (global.ImMbaAuth && typeof global.ImMbaAuth.getClient === "function") {
      client = global.ImMbaAuth.getClient();
      return client;
    }
    var cfg = global.ImMbaSupabaseConfig;
    if (!cfg || !cfg.url || !cfg.anonKey) {
      throw new Error("Missing ImMbaSupabaseConfig (url / anonKey).");
    }
    if (!global.supabase || typeof global.supabase.createClient !== "function") {
      throw new Error("Supabase JS SDK not loaded.");
    }
    client = global.supabase.createClient(cfg.url, cfg.anonKey);
    return client;
  }

  function rowToItem(row) {
    return normalizeItem({
      id: row.id,
      date: row.date,
      top: row.top,
      published: row.published,
      photoUrl: row.photo_url,
      fileUrl: row.file_url,
      fileName: row.file_name,
      zh: {
        title: row.title_zh,
        url: row.url_zh,
        content: row.content_zh
      },
      en: {
        title: row.title_en,
        url: row.url_en,
        content: row.content_en
      }
    });
  }

  function itemToRow(item, sortOrder) {
    var n = normalizeItem(item);
    return {
      id: n.id,
      date: n.date,
      top: !!n.top,
      published: n.published !== false,
      sort_order: sortOrder != null ? sortOrder : 0,
      photo_url: n.photoUrl || null,
      file_url: n.fileUrl || null,
      file_name: n.fileName || null,
      title_zh: n.zh.title || "",
      url_zh: n.zh.url || null,
      content_zh: n.zh.content || null,
      title_en: n.en.title || "",
      url_en: n.en.url || null,
      content_en: n.en.content || null
    };
  }

  function clearLocalMirror() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {}
  }

  function getPublished() {
    return getAll().filter(function (item) {
      return item.published !== false;
    });
  }

  /** Sync snapshot after cloud load; before load, built-in defaults (temporary). */
  function getAll() {
    if (cache) return cache.map(normalizeItem);
    return cloneDefaults();
  }

  async function refreshFromCloud() {
    var sb = getClient();
    var result = await sb
      .from(TABLE)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("date", { ascending: false });
    if (result.error) throw result.error;
    cache = (result.data || []).map(rowToItem);
    clearLocalMirror();
    return cache.slice();
  }

  function ensureLoaded() {
    if (cache) return Promise.resolve(cache.slice());
    if (loadPromise) return loadPromise;
    loadPromise = refreshFromCloud()
      .catch(function (err) {
        console.warn("[ImMbaAnnouncements] cloud load failed; using built-in defaults.", err);
        cache = cloneDefaults();
        return cache.slice();
      })
      .finally(function () {
        loadPromise = null;
      });
    return loadPromise;
  }

  /**
   * Replace the full announcements set in Supabase (create / update / reorder / delete).
   * Requires an admin session (RLS).
   */
  async function saveAll(list) {
    var normalized = (list || []).map(normalizeItem).filter(function (item) {
      return !!item.id;
    });
    var sb = getClient();
    var rows = normalized.map(function (item, index) {
      return itemToRow(item, (index + 1) * 10);
    });

    var existing = await sb.from(TABLE).select("id");
    if (existing.error) throw existing.error;
    var keep = {};
    rows.forEach(function (row) {
      keep[row.id] = true;
    });
    var toDelete = (existing.data || [])
      .map(function (row) {
        return row.id;
      })
      .filter(function (id) {
        return !keep[id];
      });

    if (rows.length) {
      var upsert = await sb.from(TABLE).upsert(rows, { onConflict: "id" });
      if (upsert.error) throw upsert.error;
    }
    if (toDelete.length) {
      var del = await sb.from(TABLE).delete().in("id", toDelete);
      if (del.error) throw del.error;
    }

    cache = normalized;
    clearLocalMirror();
    return cache.slice();
  }

  async function restoreDefaults() {
    return saveAll(cloneDefaults());
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bodyHtml(content) {
    if (!content) return "";
    return (
      '<span class="announce-body">' +
      escapeHtml(content).replace(/\n/g, "<br>") +
      "</span>"
    );
  }

  function mediaHtml(item, locale) {
    var bits = [];
    if (item.photoUrl) {
      bits.push(
        '<img class="announce-photo" src="' +
          escapeHtml(item.photoUrl) +
          '" alt="' +
          escapeHtml((item[locale] && item[locale].title) || "") +
          '">'
      );
    }
    if (item.fileUrl) {
      var label =
        locale === "en"
          ? "Download file" + (item.fileName ? ": " + item.fileName : "")
          : "下載檔案" + (item.fileName ? "：" + item.fileName : "");
      bits.push(
        '<a class="announce-file link-mark" href="' +
          escapeHtml(item.fileUrl) +
          '" download="' +
          escapeHtml(item.fileName || "attachment") +
          '">' +
          escapeHtml(label) +
          "</a>"
      );
    }
    return bits.length ? '<span class="announce-media">' + bits.join("") + "</span>" : "";
  }

  function detailHref(item) {
    return "announcement.html?id=" + encodeURIComponent(item.id);
  }

  function hasOnSiteBody(item) {
    return !!(
      (item.zh && item.zh.content) ||
      (item.en && item.en.content) ||
      item.photoUrl ||
      item.fileUrl
    );
  }

  /**
   * Link target for list cards:
   * - If there is on-site content/photo/file → detail page
   * - If only an external URL (no body) → open that URL directly
   */
  function cardHref(locale, item) {
    var loc = item[locale] || {};
    var other = item[locale === "en" ? "zh" : "en"] || {};
    if (hasOnSiteBody(item)) return detailHref(item);
    return loc.url || other.url || detailHref(item);
  }

  /** List cards show title only; body/photo open on the detail page. */
  function cardHit(locale, item, detailsLabel) {
    var loc = item[locale] || {};
    var href = cardHref(locale, item);
    var topBadge = item.top ? '<span class="announce-top">TOP</span>' : "";
    var inner =
      '<span class="announce-meta">' +
      '<time class="announce-date" datetime="' +
      escapeHtml(item.date) +
      '">' +
      escapeHtml(item.dateLabel) +
      "</time>" +
      topBadge +
      "</span>" +
      '<span class="announce-main">' +
      '<span class="announce-title">' +
      escapeHtml(loc.title || "—") +
      "</span>" +
      "</span>" +
      '<span class="announce-link">' +
      detailsLabel +
      "</span>";
    return (
      '<a class="announce-card-hit ' +
      locale +
      '" href="' +
      escapeHtml(href) +
      '">' +
      inner +
      "</a>"
    );
  }

  function cardHtml(item) {
    return (
      '<article class="announce-card" data-announce="' +
      escapeHtml(item.id) +
      '">' +
      cardHit("zh", item, SOURCE.zh.details) +
      cardHit("en", item, SOURCE.en.details) +
      "</article>"
    );
  }

  function listMarkup() {
    var list = getPublished();
    var cards = list.map(cardHtml).join("");
    return (
      '<div class="announce-grid">' +
      cards +
      "</div>" +
      '<p class="announce-more">' +
      '<a class="link-mark zh" href="' +
      SOURCE.zh.url +
      '">' +
      SOURCE.zh.more +
      "</a>" +
      '<a class="link-mark en" href="' +
      SOURCE.en.url +
      '">' +
      SOURCE.en.more +
      "</a>" +
      "</p>" +
      '<p class="announce-source">' +
      '<span class="zh">' +
      SOURCE.zh.label +
      '<a class="link-mark" href="' +
      SOURCE.zh.url +
      '">' +
      SOURCE.zh.name +
      "</a></span>" +
      '<span class="en">' +
      SOURCE.en.label +
      '<a class="link-mark" href="' +
      SOURCE.en.url +
      '">' +
      SOURCE.en.name +
      "</a></span>" +
      "</p>"
    );
  }

  function renderHome() {
    var root = document.getElementById("home-announcements");
    if (!root) return;
    root.innerHTML = listMarkup();
  }

  function pageLocale() {
    return document.documentElement.getAttribute("data-locale") === "en" ? "en" : "zh";
  }

  function itemSearchBlob(item) {
    return [
      item.date,
      item.dateLabel,
      item.zh && item.zh.title,
      item.zh && item.zh.content,
      item.en && item.en.title,
      item.en && item.en.content
    ]
      .join("\n")
      .toLowerCase();
  }

  function suggestionTitle(item, locale) {
    var loc = item[locale] || {};
    var other = item[locale === "en" ? "zh" : "en"] || {};
    return loc.title || other.title || "—";
  }

  /** Public pages whose visible copy is included in homepage search. */
  var SITE_PAGES = [
    { href: "index.html", zh: "首頁", en: "Home" },
    { href: "about.html", zh: "特色與排名", en: "Overview and Ranking" },
    { href: "environment.html", zh: "學習環境", en: "Learning Environment" },
    { href: "apply.html", zh: "申請輔大 imMBA", en: "Apply" },
    { href: "curriculum.html", zh: "課程與修業規定", en: "Curriculum" },
    { href: "faculty.html", zh: "師資介紹", en: "Faculty" },
    { href: "guide.html", zh: "imMBA全攻略", en: "Student Guide" },
    { href: "graduation.html", zh: "畢業與離校", en: "Graduation" },
    { href: "dual-degree.html", zh: "跨國雙碩士", en: "Dual Master’s" },
    { href: "exchange.html", zh: "海外交換", en: "Exchange" },
    { href: "news.html", zh: "公告", en: "News" },
    { href: "books.html", zh: "書籍與教材市集", en: "Books and Materials" },
    { href: "gallery.html", zh: "相片集錦", en: "Photo Gallery" },
    { href: "contact.html", zh: "聯絡我們", en: "Contact" }
  ];

  var siteEntries = [];
  var siteIndexPromise = null;

  function extractMainText(html) {
    if (!html) return "";
    var doc = new DOMParser().parseFromString(html, "text/html");
    var main = doc.querySelector("main") || doc.body;
    if (!main) return "";
    main.querySelectorAll("script, style").forEach(function (node) {
      node.remove();
    });
    return String(main.textContent || "").replace(/\s+/g, " ").trim();
  }

  function snippetAround(text, query) {
    var source = String(text || "").replace(/\s+/g, " ").trim();
    var q = String(query || "").trim().toLowerCase();
    if (!source || !q) return "";
    var at = source.toLowerCase().indexOf(q);
    if (at < 0) return "";
    var start = Math.max(0, at - 16);
    var end = Math.min(source.length, at + q.length + 36);
    var slice = source.slice(start, end).trim();
    return (start > 0 ? "…" : "") + slice + (end < source.length ? "…" : "");
  }

  function loadSiteIndex() {
    if (siteIndexPromise) return siteIndexPromise;
    var pages = Promise.all(
      SITE_PAGES.map(function (page) {
        return fetch(page.href)
          .then(function (res) {
            return res.ok ? res.text() : "";
          })
          .then(function (html) {
            return {
              kind: "page",
              href: page.href,
              zh: page.zh,
              en: page.en,
              text: page.zh + " " + page.en + " " + extractMainText(html)
            };
          })
          .catch(function () {
            return {
              kind: "page",
              href: page.href,
              zh: page.zh,
              en: page.en,
              text: page.zh + " " + page.en
            };
          });
      })
    );
    var faculty = Promise.resolve([]);
    try {
      faculty = getClient()
        .from("faculty")
        .select(
          "name_zh,name_en,title_zh,title_en,education_zh,education_en,research_fields_zh,research_fields_en"
        )
        .then(function (result) {
          return (result.data || []).map(function (row) {
            var zh = row.name_zh || row.name_en || "師資";
            var en = row.name_en || row.name_zh || "Faculty";
            return {
              kind: "faculty",
              href: "faculty.html",
              zh: zh,
              en: en,
              text: [
                zh,
                en,
                row.title_zh,
                row.title_en,
                row.education_zh,
                row.education_en,
                row.research_fields_zh,
                row.research_fields_en
              ].join(" ")
            };
          });
        })
        .catch(function () {
          return [];
        });
    } catch (err) {
      faculty = Promise.resolve([]);
    }
    siteIndexPromise = Promise.all([pages, faculty]).then(function (parts) {
      siteEntries = parts[0].concat(parts[1]);
      return siteEntries;
    });
    return siteIndexPromise;
  }

  var homeSearchBound = false;
  var suggestActive = -1;

  function hideHomeSuggestions() {
    var list = document.getElementById("home-news-suggest");
    var input = document.getElementById("home-news-q");
    if (list) {
      list.hidden = true;
      list.innerHTML = "";
    }
    if (input) input.setAttribute("aria-expanded", "false");
    suggestActive = -1;
  }

  function setSuggestActive(index) {
    var list = document.getElementById("home-news-suggest");
    if (!list) return;
    var links = list.querySelectorAll("a");
    if (!links.length) {
      suggestActive = -1;
      return;
    }
    if (index < 0) index = links.length - 1;
    if (index >= links.length) index = 0;
    suggestActive = index;
    links.forEach(function (link, i) {
      if (i === suggestActive) link.classList.add("is-active");
      else link.classList.remove("is-active");
    });
    var current = links[suggestActive];
    var input = document.getElementById("home-news-q");
    if (current.id && input) input.setAttribute("aria-activedescendant", current.id);
    if (current.scrollIntoView) current.scrollIntoView({ block: "nearest" });
  }

  function renderHomeSuggestions(query) {
    var list = document.getElementById("home-news-suggest");
    var input = document.getElementById("home-news-q");
    if (!list || !input) return;
    var q = String(query || "").trim().toLowerCase();
    if (!q) {
      hideHomeSuggestions();
      return;
    }
    var locale = pageLocale();
    var results = [];
    getPublished().forEach(function (item) {
      var blob = itemSearchBlob(item);
      if (blob.indexOf(q) === -1) return;
      var title = suggestionTitle(item, locale);
      results.push({
        href: cardHref(locale, item),
        title: title,
        meta: item.dateLabel || item.date || (locale === "en" ? "News" : "公告"),
        snippet: snippetAround(
          ((item[locale] && item[locale].content) || "") + " " + title,
          q
        ),
        rank: title.toLowerCase().indexOf(q) !== -1 ? 0 : 1
      });
    });
    var scholarshipQuery =
      q.indexOf("獎學金") !== -1 ||
      q.indexOf("獎助") !== -1 ||
      q.indexOf("scholarship") !== -1;
    var scholarshipTarget = null;
    if (scholarshipQuery) {
      var englishScholarship = q.indexOf("scholarship") !== -1 && locale === "en";
      scholarshipTarget = englishScholarship
        ? {
            href: "apply.html#tuition-scholarships",
            title: "Apply for Fu Jen imMBA",
            meta: "Admissions",
            snippet: "Tuition Fees and Scholarships",
            rank: -1
          }
        : {
            href: "apply.html#scholarships",
            title: "申請輔大 imMBA",
            meta: "招生資訊",
            snippet: "獎助學金資訊",
            rank: -1
          };
    }
    siteEntries.forEach(function (entry) {
      var blob = String(entry.text || "").toLowerCase();
      if (blob.indexOf(q) === -1) return;
      if (entry.href === "scholarships.html") return;
      if (scholarshipQuery && entry.href === "apply.html") return;
      var title = locale === "en" ? entry.en : entry.zh;
      var meta =
        entry.kind === "faculty"
          ? locale === "en"
            ? "Faculty"
            : "師資"
          : locale === "en"
            ? "Page"
            : "頁面";
      results.push({
        href: entry.href,
        title: title || entry.zh || entry.en,
        meta: meta,
        snippet: snippetAround(entry.text, q),
        rank: String(title || "").toLowerCase().indexOf(q) !== -1 ? 0 : 2
      });
    });
    if (scholarshipTarget) results.unshift(scholarshipTarget);
    results.sort(function (a, b) {
      return a.rank - b.rank;
    });
    results = results.slice(0, 8);
    suggestActive = -1;
    input.removeAttribute("aria-activedescendant");
    if (!results.length) {
      list.innerHTML =
        '<li class="home-news-suggest-empty" role="presentation">' +
        (locale === "en" ? "No matching content" : "沒有符合的內容") +
        "</li>";
    } else {
      list.innerHTML = results
        .map(function (item, index) {
          var snippet =
            item.snippet && item.snippet !== item.title
              ? '<span class="home-news-suggest-snippet">' +
                escapeHtml(item.snippet) +
                "</span>"
              : "";
          return (
            '<li role="presentation">' +
            '<a role="option" id="home-news-opt-' +
            index +
            '" href="' +
            escapeHtml(item.href) +
            '">' +
            '<span class="home-news-suggest-date">' +
            escapeHtml(item.meta) +
            "</span>" +
            '<span class="home-news-suggest-title">' +
            escapeHtml(item.title) +
            "</span>" +
            snippet +
            "</a></li>"
          );
        })
        .join("");
    }
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function bindHomeNewsSearch() {
    var input = document.getElementById("home-news-q");
    if (!input || homeSearchBound) return;
    homeSearchBound = true;
    input.addEventListener("input", function () {
      var typed = String(input.value || "").trim().toLowerCase();
      if (
        pageLocale() === "en" &&
        (typed === "scholarship" || typed === "scholarships")
      ) {
        location.href = "apply.html#tuition-scholarships";
        return;
      }
      renderHomeSuggestions(input.value);
    });
    input.addEventListener("keydown", function (event) {
      var list = document.getElementById("home-news-suggest");
      var open = list && !list.hidden;
      if (event.key === "ArrowDown" && open) {
        event.preventDefault();
        setSuggestActive(suggestActive + 1);
      } else if (event.key === "ArrowUp" && open) {
        event.preventDefault();
        setSuggestActive(suggestActive - 1);
      } else if (event.key === "Enter") {
        var typed = String(input.value || "").trim().toLowerCase();
        var goScholarship =
          typed.indexOf("獎學金") !== -1 ||
          typed.indexOf("獎助") !== -1 ||
          typed.indexOf("scholarship") !== -1;
        if (open && suggestActive >= 0) {
          var picked = list.querySelectorAll("a")[suggestActive];
          if (picked) {
            event.preventDefault();
            location.href = picked.getAttribute("href");
          }
        } else if (goScholarship) {
          event.preventDefault();
          location.href =
            pageLocale() === "en" && typed.indexOf("scholarship") !== -1
              ? "apply.html#tuition-scholarships"
              : "apply.html#scholarships";
        }
      } else if (event.key === "Escape") {
        hideHomeSuggestions();
      }
    });
    document.addEventListener("click", function (event) {
      var box = document.querySelector(".home-news-search");
      if (!box || box.contains(event.target)) return;
      hideHomeSuggestions();
    });
    document.querySelectorAll("[data-locale-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTimeout(function () {
          input.placeholder = pageLocale() === "en" ? "Search" : "搜尋";
          if (input.value.trim()) renderHomeSuggestions(input.value);
        }, 0);
      });
    });
  }

  /** News page uses the same published list and card markup as homepage「最新消息」. */
  function renderNewsPage() {
    var root = document.getElementById("news-announcements");
    if (!root) return;
    root.innerHTML = listMarkup();
  }

  function renderAllFront() {
    renderHome();
    renderNewsPage();
  }

  global.ImMbaAnnouncements = {
    STORAGE_KEY: STORAGE_KEY,
    getDefaults: cloneDefaults,
    getAll: getAll,
    getPublished: getPublished,
    saveAll: saveAll,
    restoreDefaults: restoreDefaults,
    refreshFromCloud: refreshFromCloud,
    ensureLoaded: ensureLoaded,
    dateLabelFromIso: dateLabelFromIso,
    normalizeItem: normalizeItem,
    renderHome: renderHome,
    renderNewsPage: renderNewsPage,
    renderAllFront: renderAllFront,
    detailHref: detailHref,
    bodyHtml: bodyHtml,
    mediaHtml: mediaHtml,
    escapeHtml: escapeHtml
  };

  function boot() {
    bindHomeNewsSearch();
    ensureLoaded()
      .then(function () {
        renderAllFront();
        var input = document.getElementById("home-news-q");
        if (input && input.value.trim()) renderHomeSuggestions(input.value);
      })
      .catch(function () {
        renderAllFront();
      });
    loadSiteIndex().then(function () {
      var input = document.getElementById("home-news-q");
      if (input && input.value.trim()) renderHomeSuggestions(input.value);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
