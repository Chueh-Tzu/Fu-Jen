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

  function line(labelZh, labelEn, value, asHtml) {
    if (!value) return "";
    return (
      "<p>" +
      '<span class="zh">' + labelZh + "：" + (asHtml || escapeHtml(value)) + "</span>" +
      '<span class="en">' + labelEn + ": " + (asHtml || escapeHtml(value)) + "</span>" +
      "</p>"
    );
  }

  function renderCard(row) {
    var chair = api.isChair(row);
    var idAttr = chair ? ' id="chair"' : "";
    var chairClass = chair ? " is-chair" : "";
    var photo = row.image_url
      ? '<img class="faculty-photo" src="' + escapeHtml(row.image_url) + '" alt="' + escapeHtml(row.name) + '">'
      : "";
    var websiteHtml = row.website
      ? '<a class="link-mark" href="' + escapeHtml(row.website) + '" target="_blank" rel="noopener">' +
        escapeHtml(row.website) + "</a>"
      : "";
    var emailHtml = row.email
      ? '<a class="link-mark" href="mailto:' + escapeHtml(row.email) + '">' + escapeHtml(row.email) + "</a>"
      : "";

    return (
      '<article class="faculty-card' + chairClass + '" data-faculty="' + escapeHtml(row.category) + '"' + idAttr + ">" +
      photo +
      "<h3>" + escapeHtml(row.name) + "</h3>" +
      (row.title ? '<div class="role">' + escapeHtml(row.title) + "</div>" : "") +
      line("學歷", "Education", row.education) +
      line("研究領域", "Specialties", row.research_fields) +
      (row.website
        ? '<p><span class="zh">個人網站：' + websiteHtml + '</span><span class="en">Personal website: ' + websiteHtml + "</span></p>"
        : "") +
      line("聯絡電話", "TEL", row.phone) +
      (row.email
        ? '<p><span class="zh">聯絡信箱：' + emailHtml + '</span><span class="en">E-mail: ' + emailHtml + "</span></p>"
        : "") +
      "</article>"
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
      var seeded = await api.seedDefaultsIfEmpty();
      var rows = seeded.list;
      var full = rows.filter(function (row) { return row.category !== "adjunct"; });
      var adjunct = rows.filter(function (row) { return row.category === "adjunct"; });

      if (fullGrid) {
        fullGrid.innerHTML = full.length
          ? full.map(renderCard).join("")
          : '<p class="faculty-empty">No full-time faculty yet.</p>';
      }
      if (adjunctGrid) {
        adjunctGrid.innerHTML = adjunct.length
          ? adjunct.map(renderCard).join("")
          : '<p class="faculty-empty">No adjunct faculty yet.</p>';
      }
      setStatus("");
      applyFilter();
    } catch (err) {
      setStatus("Cannot load faculty from Supabase: " + (err.message || err), true);
      if (fullGrid) fullGrid.innerHTML = "";
      if (adjunctGrid) adjunctGrid.innerHTML = "";
    }
  })();

  var q = document.getElementById("faculty-q");
  var type = document.getElementById("faculty-type");
  if (q) q.addEventListener("input", applyFilter);
  if (type) type.addEventListener("change", applyFilter);
})();
