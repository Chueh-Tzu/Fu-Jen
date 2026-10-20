(function () {
  var api = window.ImMbaFaculty;
  if (!api) return;

  var fullGrid = document.getElementById("faculty-grid-full");
  var adjunctGrid = document.getElementById("faculty-grid-adjunct");
  var statusEl = document.getElementById("faculty-load-status");

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bilingualText(zh, en) {
    var z = String(zh || "").trim();
    var e = String(en || "").trim();
    if (!z && !e) return "";
    return (
      '<span class="zh">' + escapeHtml(z || e) + "</span>" +
      '<span class="en">' + escapeHtml(e || z) + "</span>"
    );
  }

  function bilingualLine(labelZh, labelEn, valueZh, valueEn) {
    var z = String(valueZh || "").trim();
    var e = String(valueEn || "").trim();
    if (!z && !e) return "";
    return (
      "<p>" +
      '<span class="zh">' + labelZh + "：" + escapeHtml(z || e) + "</span>" +
      '<span class="en">' + labelEn + "： " + escapeHtml(e || z) + "</span>" +
      "</p>"
    );
  }

  function renderCard(row) {
    var chair = api.isChair(row);
    var idAttr = chair ? ' id="chair"' : "";
    var chairClass = chair ? " is-chair" : "";
    var displayName = row.name_en || row.name_zh || row.name || "";
    var photo = row.image_url
      ? '<img class="faculty-photo" src="' + escapeHtml(row.image_url) + '" alt="' + escapeHtml(displayName) + '">'
      : '<div class="faculty-photo is-empty" aria-hidden="true"></div>';
    var websiteHtml = row.website
      ? '<a class="link-mark" href="' + escapeHtml(row.website) + '" target="_blank" rel="noopener">' +
        escapeHtml(row.website) + "</a>"
      : "";
    var emailHtml = row.email
      ? '<a class="link-mark" href="mailto:' + escapeHtml(row.email) + '">' + escapeHtml(row.email) + "</a>"
      : "";

    return (
      '<article class="faculty-card' + chairClass + '" data-faculty="' + escapeHtml(row.category) + '"' + idAttr + ">" +
      '<div class="faculty-card-inner">' +
      '<div class="faculty-media">' + photo + "</div>" +
      '<div class="faculty-body">' +
      "<h3>" + bilingualText(row.name_zh, row.name_en) + "</h3>" +
      ((row.title_zh || row.title_en)
        ? '<div class="role">' + bilingualText(row.title_zh, row.title_en) + "</div>"
        : "") +
      bilingualLine("學歷", "Education", row.education_zh, row.education_en) +
      bilingualLine("研究領域", "Specialties", row.research_fields_zh, row.research_fields_en) +
      (row.website
        ? '<p><span class="zh">個人網站：' + websiteHtml + '</span><span class="en">Personal website: ' + websiteHtml + "</span></p>"
        : "") +
      bilingualLine("聯絡電話", "TEL", row.phone_zh, row.phone_en) +
      (row.email
        ? '<p><span class="zh">聯絡信箱：' + emailHtml + '</span><span class="en">E-mail： ' + emailHtml + "</span></p>"
        : "") +
      "</div></div></article>"
    );
  }

  function applyFilter() {
    var q = document.getElementById("faculty-q");
    var type = document.getElementById("faculty-type");
    if (!q || !type) return;
    var keyword = (q.value || "").trim().toLowerCase();
    var kind = type.value || "all";
    document.querySelectorAll("[data-faculty]").forEach(function (card) {
      var text = card.textContent.toLowerCase();
      var matchType = kind === "all" || card.getAttribute("data-faculty") === kind;
      var matchText = !keyword || text.includes(keyword);
      card.style.display = matchType && matchText ? "" : "none";
    });
    document.querySelectorAll("[data-faculty-group]").forEach(function (group) {
      var groupKind = group.getAttribute("data-faculty-group");
      if (kind !== "all" && kind !== groupKind) {
        group.style.display = "none";
        return;
      }
      var visible = Array.prototype.some.call(
        group.querySelectorAll("[data-faculty]"),
        function (card) { return card.style.display !== "none"; }
      );
      group.style.display = visible ? "" : "none";
    });
  }

  function setStatus(message, isError) {
    if (!statusEl) return;
    if (!message) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      return;
    }
    statusEl.hidden = false;
    statusEl.className = "faculty-load-status" + (isError ? " is-err" : "");
    statusEl.textContent = message;
  }

  (async function init() {
    setStatus("Loading faculty from Supabase…");
    try {
      // Front-end is read-only for visitors; seeding/sync happens in AdminFaculty after login.
      var rows = await api.list();
      var full = rows.filter(function (row) { return row.category !== "adjunct"; });
      var adjunct = rows.filter(function (row) { return row.category === "adjunct"; });

      if (fullGrid) {
        fullGrid.innerHTML = full.length
          ? full.map(renderCard).join("")
          : '<p class="faculty-empty"><span class="zh">尚無專任教師資料。</span><span class="en">No full-time faculty yet.</span></p>';
      }
      if (adjunctGrid) {
        adjunctGrid.innerHTML = adjunct.length
          ? adjunct.map(renderCard).join("")
          : '<p class="faculty-empty"><span class="zh">尚無兼任教師資料。</span><span class="en">No adjunct faculty yet.</span></p>';
      }
      setStatus("");
      applyFilter();
    } catch (err) {
      var msg = String(err.message || err);
      if (/name_zh|column|schema cache/i.test(msg)) {
        setStatus(
          "資料庫尚未加入中英欄位。請先在 Supabase SQL Editor 執行 schema-bilingual.sql，再重新整理。 / " + msg,
          true
        );
      } else {
        setStatus("Cannot load faculty from Supabase: " + msg, true);
      }
      if (fullGrid) fullGrid.innerHTML = "";
      if (adjunctGrid) adjunctGrid.innerHTML = "";
    }
  })();

  var q = document.getElementById("faculty-q");
  var type = document.getElementById("faculty-type");
  if (q) q.addEventListener("input", applyFilter);
  if (type) type.addEventListener("change", applyFilter);
})();
