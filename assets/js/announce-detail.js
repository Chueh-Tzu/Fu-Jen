(function () {
  var api = window.ImMbaAnnouncements;
  if (!api) return;

  var params = new URLSearchParams(location.search);
  var id = String(params.get("id") || "").trim();
  var titleEl = document.getElementById("announce-detail-title");
  var metaEl = document.getElementById("announce-detail-meta");
  var root = document.getElementById("announce-detail-root");
  var statusEl = document.getElementById("announce-detail-status");

  function isEn() {
    return document.documentElement.getAttribute("data-locale") === "en";
  }

  function t(zh, en) {
    return isEn() ? en : zh;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showMissing() {
    if (titleEl) {
      titleEl.innerHTML =
        '<span class="zh">找不到這則公告</span><span class="en">Announcement not found</span>';
    }
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = t(
        "這則公告不存在或尚未發佈。請返回公告列表。",
        "This announcement is missing or unpublished. Please return to the news list."
      );
    }
    if (root) {
      root.insertAdjacentHTML(
        "beforeend",
        '<p class="announce-detail-actions">' +
          '<a class="btn btn-navy" href="news.html"><span class="zh">返回公告</span><span class="en">Back to News</span></a> ' +
          '<a class="btn btn-outline" href="index.html"><span class="zh">回首頁</span><span class="en">Home</span></a>' +
          "</p>"
      );
    }
  }

  function render(item) {
    var loc = isEn() ? item.en : item.zh;
    var other = isEn() ? item.zh : item.en;
    var sourceUrl = (loc && loc.url) || (other && other.url) || "";
    var content = (loc && loc.content) || (other && other.content) || "";
    var title = (loc && loc.title) || (other && other.title) || "—";

    document.title = title + " | International Management (imMBA)";
    if (titleEl) {
      titleEl.innerHTML =
        '<span class="zh">' +
        escapeHtml((item.zh && item.zh.title) || title) +
        '</span><span class="en">' +
        escapeHtml((item.en && item.en.title) || title) +
        "</span>";
    }

    if (metaEl) {
      metaEl.hidden = false;
      metaEl.innerHTML =
        '<time datetime="' +
        escapeHtml(item.date) +
        '">' +
        escapeHtml(item.dateLabel) +
        "</time>" +
        (item.top ? '<span class="announce-top">TOP</span>' : "");
    }

    var html = "";
    if (item.photoUrl) {
      html +=
        '<figure class="announce-detail-photo">' +
        '<img src="' +
        escapeHtml(item.photoUrl) +
        '" alt="' +
        escapeHtml(title) +
        '">' +
        "</figure>";
    }

    if (content) {
      html +=
        '<div class="announce-detail-body prose">' +
        "<p>" +
        escapeHtml(content).replace(/\n/g, "<br>") +
        "</p></div>";
    } else {
      html +=
        '<p class="announce-detail-empty">' +
        escapeHtml(
          t(
            "這則公告目前沒有站內內文，請點下方「查看原文」開啟官方內容。",
            "This announcement has no on-site body text yet. Use “View original” below for the official article."
          )
        ) +
        "</p>";
    }

    if (item.fileUrl) {
      var fileLabel =
        t("下載檔案", "Download file") +
        (item.fileName ? (isEn() ? ": " : "：") + item.fileName : "");
      html +=
        '<p class="announce-detail-file"><a class="link-mark" href="' +
        escapeHtml(item.fileUrl) +
        '" download="' +
        escapeHtml(item.fileName || "attachment") +
        '">' +
        escapeHtml(fileLabel) +
        "</a></p>";
    }

    html += '<p class="announce-detail-actions">';
    if (sourceUrl) {
      html +=
        '<a class="btn btn-gold" href="' +
        escapeHtml(sourceUrl) +
        '" target="_blank" rel="noopener">' +
        '<span class="zh">查看原文</span><span class="en">View original</span></a> ';
    }
    html +=
      '<a class="btn btn-navy" href="news.html"><span class="zh">返回公告</span><span class="en">Back to News</span></a> ' +
      '<a class="btn btn-outline" href="index.html"><span class="zh">回首頁</span><span class="en">Home</span></a>' +
      "</p>";

    if (root) {
      var status = document.getElementById("announce-detail-status");
      root.innerHTML = "";
      if (status) {
        status.hidden = true;
        root.appendChild(status);
      }
      root.insertAdjacentHTML("beforeend", html);
    }
  }

  function boot() {
    if (!id) {
      showMissing();
      return;
    }
    var item = api.getPublished().find(function (row) {
      return String(row.id) === id;
    });
    if (!item) {
      showMissing();
      return;
    }
    render(item);
  }

  document.querySelectorAll("[data-locale-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setTimeout(boot, 0);
    });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
