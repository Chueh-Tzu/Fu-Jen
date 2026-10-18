(function () {
  /** Structured announcements collected from the official imMBA news page. */
  var ANNOUNCEMENTS = [
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

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cardHtml(item) {
    var topBadge = item.top
      ? '<span class="announce-top">TOP</span>'
      : "";
    return (
      '<article class="announce-card" data-announce="' +
      escapeHtml(item.id) +
      '">' +
      '<a class="announce-card-hit zh" href="' +
      escapeHtml(item.zh.url) +
      '">' +
      '<span class="announce-meta">' +
      '<time class="announce-date" datetime="' +
      escapeHtml(item.date) +
      '">' +
      escapeHtml(item.dateLabel) +
      "</time>" +
      topBadge +
      "</span>" +
      '<span class="announce-title">' +
      escapeHtml(item.zh.title) +
      "</span>" +
      '<span class="announce-link">' +
      SOURCE.zh.details +
      "</span>" +
      "</a>" +
      '<a class="announce-card-hit en" href="' +
      escapeHtml(item.en.url) +
      '">' +
      '<span class="announce-meta">' +
      '<time class="announce-date" datetime="' +
      escapeHtml(item.date) +
      '">' +
      escapeHtml(item.dateLabel) +
      "</time>" +
      topBadge +
      "</span>" +
      '<span class="announce-title">' +
      escapeHtml(item.en.title) +
      "</span>" +
      '<span class="announce-link">' +
      SOURCE.en.details +
      "</span>" +
      "</a>" +
      "</article>"
    );
  }

  function render() {
    var root = document.getElementById("home-announcements");
    if (!root) return;

    var cards = ANNOUNCEMENTS.map(cardHtml).join("");
    root.innerHTML =
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
      "</p>";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
