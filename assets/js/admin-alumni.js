(function () {
  var auth = window.ImMbaAuth;
  if (!auth) return;

  var HEADERS = [
    "full_name", "student_id", "department", "degree_program",
    "admission_year", "graduation_year", "email", "phone",
    "company", "job_title", "notes"
  ];
  var DEGREES = ["Bachelor", "Master", "Doctoral", "Other"];
  var COLUMNS = [
    { id: "full_name", zh: "姓名", en: "Name", on: true },
    { id: "student_id", zh: "學號", en: "Student ID", on: false },
    { id: "department", zh: "系所", en: "Department", on: true },
    { id: "degree_program", zh: "學位", en: "Degree", on: true },
    { id: "admission_year", zh: "入學年", en: "Admission year", on: false },
    { id: "graduation_year", zh: "畢業年", en: "Graduation year", on: true },
    { id: "email", zh: "電子郵件", en: "Email", on: false },
    { id: "phone", zh: "電話", en: "Phone", on: false },
    { id: "company", zh: "公司", en: "Company", on: true },
    { id: "job_title", zh: "職稱", en: "Job title", on: false },
    { id: "notes", zh: "備註", en: "Notes", on: false }
  ];
  var DEGREE_LABEL = {
    Bachelor: ["學士", "Bachelor"],
    Master: ["碩士", "Master"],
    Doctoral: ["博士", "Doctoral"],
    Other: ["其他", "Other"]
  };
  var COLUMN_KEY = "immba-alumni-columns";

  var statusEl = document.getElementById("admin-status");
  var authMeta = document.getElementById("admin-auth-meta");
  var formPanel = document.getElementById("alumni-form-panel");
  var form = document.getElementById("alumni-form");
  var formTitle = document.getElementById("alumni-form-title");
  var countEl = document.getElementById("alumni-count");
  var tableEl = document.getElementById("alumni-table");
  var auditEl = document.getElementById("alumni-audit");
  var auditCountEl = document.getElementById("alumni-audit-count");
  var columnsEl = document.getElementById("alumni-columns");
  var columnsBtn = document.getElementById("alumni-columns-btn");
  var importPanel = document.getElementById("alumni-import-panel");
  var fileInput = document.getElementById("alumni-import-file");

  var rows = [];
  var logs = [];
  var gate = null;
  var pendingImport = null;
  var lastImport = null;
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
          "校友資料表尚未建立。請在 Supabase SQL Editor 執行 schema-alumni.sql。",
          "The alumni tables are not set up yet. Run schema-alumni.sql in the Supabase SQL Editor."
        ),
        "err"
      );
    } else if (statusCode === "err") {
      showStatus(t("載入失敗：", "Load failed: ") + statusDetail, "err");
    }
  }

  function renderMeta() {
    if (!gate || !authMeta) return;
    authMeta.hidden = false;
    authMeta.textContent = t("已登入：" + gate.profile.email, "Signed in: " + gate.profile.email);
  }

  function fieldLabel(id) {
    var i;
    for (i = 0; i < COLUMNS.length; i += 1) {
      if (COLUMNS[i].id === id) return t(COLUMNS[i].zh, COLUMNS[i].en);
    }
    return id;
  }

  function loadColumns() {
    try {
      var saved = JSON.parse(localStorage.getItem(COLUMN_KEY) || "null");
      if (!saved || !saved.length) return;
      COLUMNS.forEach(function (col) {
        col.on = saved.indexOf(col.id) !== -1;
      });
    } catch (err) {}
    if (!COLUMNS.some(function (col) { return col.on; })) COLUMNS[0].on = true;
  }

  function saveColumns() {
    var ids = COLUMNS.filter(function (col) { return col.on; }).map(function (col) { return col.id; });
    try { localStorage.setItem(COLUMN_KEY, JSON.stringify(ids)); } catch (err) {}
  }

  function fillChoices() {
    var opt = window.ImMbaAlumniOptions;
    var yearItems = opt.years();
    opt.fillSelect(document.getElementById("alumni-department"), opt.departments, {
      blank: true,
      blankLabel: t("請選擇", "Choose")
    });
    opt.fillSelect(document.getElementById("alumni-degree"), opt.degrees, {
      blank: true,
      blankLabel: t("請選擇", "Choose")
    });
    opt.fillSelect(document.getElementById("alumni-admission-year"), yearItems, {
      blank: true,
      blankLabel: t("請選擇", "Choose"),
      itemLabel: opt.yearLabel
    });
    opt.fillSelect(document.getElementById("alumni-graduation-year"), yearItems, {
      blank: true,
      blankLabel: t("未填", "Not set"),
      itemLabel: opt.yearLabel
    });
    opt.fillSelect(document.getElementById("alumni-filter-degree"), opt.degrees, {
      blank: true,
      blankLabel: t("全部", "All")
    });
    opt.fillSelect(document.getElementById("alumni-filter-year"), yearItems, {
      blank: true,
      blankLabel: t("全部", "All"),
      itemLabel: opt.yearLabel
    });
    opt.fillSelect(document.getElementById("alumni-filter-dept"), opt.departments, {
      blank: true,
      blankLabel: t("全部", "All")
    });
  }

  function renderColumnPicker() {
    columnsEl.innerHTML = COLUMNS.map(function (col) {
      return (
        '<label><input type="checkbox" data-column="' + col.id + '"' + (col.on ? " checked" : "") + "> " +
        escapeHtml(t(col.zh, col.en)) + "</label>"
      );
    }).join("");
  }

  function blank(value) {
    var text = String(value == null ? "" : value).trim();
    return text ? text : null;
  }

  function yearValue(value) {
    var text = String(value == null ? "" : value).trim();
    if (!text) return null;
    var year = Number(text);
    if (!window.ImMbaAlumniOptions.yearOk(year)) return undefined;
    return year;
  }

  function readForm() {
    return {
      full_name: blank(document.getElementById("alumni-full-name").value),
      student_id: blank(document.getElementById("alumni-student-id").value),
      department: blank(document.getElementById("alumni-department").value),
      degree_program: blank(document.getElementById("alumni-degree").value),
      admission_year: yearValue(document.getElementById("alumni-admission-year").value),
      graduation_year: yearValue(document.getElementById("alumni-graduation-year").value),
      email: blank(document.getElementById("alumni-email").value),
      phone: blank(document.getElementById("alumni-phone").value),
      company: blank(document.getElementById("alumni-company").value),
      job_title: blank(document.getElementById("alumni-job-title").value),
      notes: blank(document.getElementById("alumni-notes").value)
    };
  }

  function formProblems(record, ignoreId) {
    var problems = [];
    if (!record.full_name) problems.push(t("姓名為必填。", "Name is required."));
    if (record.admission_year === undefined) problems.push(t("入學年請從清單選擇。", "Choose an admission year from the list."));
    if (record.graduation_year === undefined) problems.push(t("畢業年請從清單選擇。", "Choose a graduation year from the list."));
    if (record.degree_program && DEGREES.indexOf(record.degree_program) === -1) {
      problems.push(t("學位只能是 Bachelor、Master、Doctoral 或 Other。", "Degree must be Bachelor, Master, Doctoral, or Other."));
    }
    if (record.email && record.email.indexOf("@") === -1) problems.push(t("電子郵件格式不正確。", "Email looks invalid."));
    if (record.student_id) {
      var dup = rows.some(function (row) {
        return row.id !== ignoreId && row.student_id && String(row.student_id).toLowerCase() === record.student_id.toLowerCase();
      });
      if (dup) problems.push(t("學號已存在。", "This student ID already exists."));
    }
    return problems;
  }

  function cellText(row, id) {
    var opt = window.ImMbaAlumniOptions;
    if (id === "degree_program") return opt.degreeLabel(row[id]);
    if (id === "department") return opt.departmentLabel(row[id]);
    if (id === "admission_year" || id === "graduation_year") return opt.yearLabel(row[id]);
    return row[id] == null ? "" : String(row[id]);
  }

  function filteredRows() {
    var name = document.getElementById("alumni-q").value.trim().toLowerCase();
    var degree = document.getElementById("alumni-filter-degree").value;
    var year = document.getElementById("alumni-filter-year").value;
    var dept = document.getElementById("alumni-filter-dept").value;
    var company = document.getElementById("alumni-filter-company").value.trim().toLowerCase();
    return rows.filter(function (row) {
      if (name && String(row.full_name || "").toLowerCase().indexOf(name) === -1) return false;
      if (degree && row.degree_program !== degree) return false;
      if (year && String(row.graduation_year || "") !== year) return false;
      if (dept && row.department !== dept) return false;
      if (company && String(row.company || "").toLowerCase().indexOf(company) === -1) return false;
      return true;
    });
  }

  function renderTable() {
    var visible = COLUMNS.filter(function (col) { return col.on; });
    var list = filteredRows();
    countEl.textContent = t("共 " + list.length + " 筆", list.length + " records");
    var head = visible.map(function (col) {
      return "<th>" + escapeHtml(t(col.zh, col.en)) + "</th>";
    }).join("") + "<th>" + escapeHtml(t("操作", "Actions")) + "</th>";
    var body = list.map(function (row) {
      var cells = visible.map(function (col) {
        return "<td>" + escapeHtml(cellText(row, col.id)) + "</td>";
      }).join("");
      return (
        '<tr data-id="' + escapeHtml(row.id) + '">' + cells +
        '<td class="alumni-actions">' +
        '<button type="button" class="admin-news-action-btn" data-action="edit">' + escapeHtml(t("修改", "Edit")) + "</button>" +
        '<button type="button" class="admin-news-action-btn is-delete" data-action="delete">' + escapeHtml(t("刪除", "Delete")) + "</button>" +
        "</td></tr>"
      );
    }).join("");
    if (!list.length) {
      body = '<tr><td class="alumni-empty" colspan="' + (visible.length + 1) + '">' +
        escapeHtml(t("尚無符合的校友。可新增或匯入 CSV。", "No matching alumni. Add one or import a CSV.")) +
        "</td></tr>";
    }
    tableEl.innerHTML = "<thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody>";
  }

  function formatTime(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    var parts = {};
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(date).forEach(function (part) {
      parts[part.type] = part.value;
    });
    return parts.year + "-" + parts.month + "-" + parts.day + " " + parts.hour + ":" + parts.minute;
  }

  function changeText(log) {
    var changes = log.changes || {};
    if (log.action === "CREATE") return t("新增紀錄", "New record");
    if (log.action === "DELETE") return t("紀錄已刪除", "Record deleted");
    var fields = changes.fields || [];
    if (!fields.length) return t("已更新", "Updated");
    return fields.map(function (field) {
      return fieldLabel(field.field) + ": " + (field.before || "—") + " → " + (field.after || "—");
    }).join("; ");
  }

  function renderAudit() {
    auditCountEl.textContent = t("最近 " + logs.length + " 筆", "Latest " + logs.length);
    var head =
      "<th>" + escapeHtml(t("時間", "Time")) + "</th>" +
      "<th>" + escapeHtml(t("管理員", "Admin")) + "</th>" +
      "<th>" + escapeHtml(t("動作", "Action")) + "</th>" +
      "<th>" + escapeHtml(t("紀錄", "Record")) + "</th>" +
      "<th>" + escapeHtml(t("變更", "Change")) + "</th>";
    var body = logs.map(function (log) {
      return (
        "<tr><td>" + escapeHtml(formatTime(log.created_at)) + "</td>" +
        "<td>" + escapeHtml(log.actor_email || "—") + "</td>" +
        "<td>" + escapeHtml(log.action) + "</td>" +
        "<td>" + escapeHtml(log.entity_label || log.entity_id || "—") + "</td>" +
        "<td>" + escapeHtml(changeText(log)) + "</td></tr>"
      );
    }).join("");
    if (!logs.length) {
      body = '<tr><td class="alumni-empty" colspan="5">' +
        escapeHtml(t("尚無活動紀錄。", "No activity yet.")) + "</td></tr>";
    }
    auditEl.innerHTML = "<thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody>";
  }

  function renderAll() {
    fillChoices();
    renderColumnPicker();
    renderTable();
    renderAudit();
    renderMeta();
    if (lastImport && !importPanel.hidden) showImport(lastImport);
    applyStatus();
  }

  function openForm(row) {
    formPanel.hidden = false;
    document.getElementById("alumni-id").value = row ? row.id : "";
    document.getElementById("alumni-full-name").value = row ? row.full_name || "" : "";
    document.getElementById("alumni-student-id").value = row ? row.student_id || "" : "";
    document.getElementById("alumni-department").value = row ? row.department || "" : "";
    document.getElementById("alumni-degree").value = row ? row.degree_program || "" : "";
    document.getElementById("alumni-admission-year").value = row && row.admission_year != null ? row.admission_year : "";
    document.getElementById("alumni-graduation-year").value = row && row.graduation_year != null ? row.graduation_year : "";
    document.getElementById("alumni-email").value = row ? row.email || "" : "";
    document.getElementById("alumni-phone").value = row ? row.phone || "" : "";
    document.getElementById("alumni-company").value = row ? row.company || "" : "";
    document.getElementById("alumni-job-title").value = row ? row.job_title || "" : "";
    document.getElementById("alumni-notes").value = row ? row.notes || "" : "";
    formTitle.innerHTML = row
      ? '<span class="zh">修改校友</span><span class="en">Edit alumni</span>'
      : '<span class="zh">新增校友</span><span class="en">Add alumni</span>';
    formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeForm() {
    formPanel.hidden = true;
    form.reset();
    document.getElementById("alumni-id").value = "";
  }

  function diffFields(before, after) {
    return HEADERS.filter(function (key) {
      return String(before[key] == null ? "" : before[key]) !== String(after[key] == null ? "" : after[key]);
    }).map(function (key) {
      return {
        field: key,
        before: before[key] == null ? "" : String(before[key]),
        after: after[key] == null ? "" : String(after[key])
      };
    });
  }

  async function writeAudit(entry) {
    var sb = auth.getClient();
    var result = await sb.from("audit_logs").insert({
      actor_id: gate.session.user.id,
      actor_email: gate.profile.email,
      action: entry.action,
      entity_type: "alumni",
      entity_id: entry.entity_id ? String(entry.entity_id) : null,
      entity_label: entry.entity_label || null,
      summary: entry.summary || null,
      changes: entry.changes || {}
    });
    if (result.error) throw result.error;
  }

  async function refresh() {
    var sb = auth.getClient();
    var alumni = await sb.from("alumni").select("*").order("full_name", { ascending: true }).limit(2000);
    if (alumni.error) throw alumni.error;
    var audit = await sb.from("audit_logs").select("*").eq("entity_type", "alumni").order("created_at", { ascending: false }).limit(200);
    if (audit.error) throw audit.error;
    rows = alumni.data || [];
    logs = audit.data || [];
    statusCode = "";
    renderAll();
  }

  function csvCell(value) {
    var text = value == null ? "" : String(value);
    if (/[",\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function downloadCsv(filename, records) {
    var lines = [HEADERS.join(",")];
    records.forEach(function (row) {
      lines.push(HEADERS.map(function (key) { return csvCell(row[key]); }).join(","));
    });
    var blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function parseCsv(text) {
    var delimiter = (function () {
      var first = String(text || "").split(/\r?\n/)[0] || "";
      var commas = (first.match(/,/g) || []).length;
      var semis = (first.match(/;/g) || []).length;
      return semis > commas ? ";" : ",";
    })();
    var rowsOut = [];
    var row = [];
    var cell = "";
    var quoted = false;
    var i;
    for (i = 0; i < text.length; i += 1) {
      var ch = text.charAt(i);
      if (quoted) {
        if (ch === '"') {
          if (text.charAt(i + 1) === '"') { cell += '"'; i += 1; }
          else quoted = false;
        } else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delimiter) { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); rowsOut.push(row); row = []; cell = ""; }
      else if (ch !== "\r") cell += ch;
    }
    if (cell.length || row.length) { row.push(cell); rowsOut.push(row); }
    return rowsOut;
  }

  function validateCsv(text) {
    var errors = [];
    if (text.indexOf("\uFFFD") !== -1) {
      errors.push(t("檔案編碼可能不是 UTF-8。請用 UTF-8 另存後再匯入。", "This file may not be UTF-8. Save it as UTF-8 and try again."));
    }
    var grid = parseCsv(text.replace(/^\uFEFF/, ""));
    if (!grid.length) {
      errors.push(t("檔案是空的。", "The file is empty."));
      return { errors: errors, records: [] };
    }
    var header = grid[0].map(function (cell) { return String(cell || "").trim(); });
    if (header.join("|") !== HEADERS.join("|")) {
      errors.push(t(
        "欄位名稱需與範本完全一致：" + HEADERS.join(", "),
        "Column names must match the template exactly: " + HEADERS.join(", ")
      ));
      return { errors: errors, records: [] };
    }
    var records = [];
    var seenId = {};
    var seenEmail = {};
    grid.slice(1).forEach(function (line, index) {
      var lineNo = index + 2;
      var values = line.map(function (cell) { return String(cell || "").trim(); });
      if (values.every(function (cell) { return !cell; })) return;
      if (values[1] === "EXAMPLE") return;
      var record = {};
      HEADERS.forEach(function (key, col) { record[key] = values[col] || ""; });
      if (!record.full_name) errors.push(t("第 " + lineNo + " 列缺少姓名。", "Row " + lineNo + " is missing a name."));
      if (record.degree_program && DEGREES.indexOf(record.degree_program) === -1) {
        errors.push(t("第 " + lineNo + " 列的學位不正確。", "Row " + lineNo + " has an invalid degree."));
      }
      if (record.department && window.ImMbaAlumniOptions.departments.every(function (item) { return item.id !== record.department; })) {
        errors.push(t("第 " + lineNo + " 列的系所不在清單中。", "Row " + lineNo + " has a department that is not in the list."));
      }
      ["admission_year", "graduation_year"].forEach(function (key) {
        if (!record[key]) { record[key] = null; return; }
        var year = Number(record[key]);
        if (!window.ImMbaAlumniOptions.yearOk(year)) {
          errors.push(t("第 " + lineNo + " 列的年份不正確。請用年份，例如 114。", "Row " + lineNo + " has an invalid year. Use a year such as 114."));
          record[key] = null;
        } else record[key] = year;
      });
      if (record.email && record.email.indexOf("@") === -1) {
        errors.push(t("第 " + lineNo + " 列的電子郵件不正確。", "Row " + lineNo + " has an invalid email."));
      }
      var sid = record.student_id.toLowerCase();
      if (sid) {
        if (seenId[sid]) errors.push(t("第 " + lineNo + " 列的學號與檔案內其他列重複。", "Row " + lineNo + " repeats a student ID in the file."));
        seenId[sid] = true;
        if (rows.some(function (row) { return row.student_id && String(row.student_id).toLowerCase() === sid; })) {
          errors.push(t("第 " + lineNo + " 列的學號已在資料庫。", "Row " + lineNo + " uses a student ID already in the database."));
        }
      }
      var mail = record.email.toLowerCase();
      if (mail) {
        if (seenEmail[mail]) errors.push(t("第 " + lineNo + " 列的電子郵件與檔案內其他列重複。", "Row " + lineNo + " repeats an email in the file."));
        seenEmail[mail] = true;
      }
      HEADERS.forEach(function (key) {
        if (key === "admission_year" || key === "graduation_year") return;
        record[key] = record[key] ? record[key] : null;
      });
      records.push(record);
    });
    if (!records.length && !errors.length) errors.push(t("沒有可匯入的資料列。", "There are no data rows to import."));
    return { errors: errors, records: records };
  }

  function showImport(result) {
    lastImport = result;
    pendingImport = result.errors.length ? null : result.records;
    var html = result.errors.length
      ? "<strong>" + escapeHtml(t("匯入前檢查未通過，尚未寫入資料。", "Validation failed. Nothing was imported.")) + "</strong><ul>" +
        result.errors.slice(0, 20).map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") + "</ul>"
      : "<strong>" + escapeHtml(t("檢查通過，可匯入 " + result.records.length + " 筆。", "Ready to import " + result.records.length + " records.")) + "</strong>" +
        '<div class="alumni-import-actions"><button type="button" class="btn btn-gold" id="alumni-import-go">' +
        escapeHtml(t("確認匯入", "Confirm import")) + "</button></div>";
    importPanel.hidden = false;
    importPanel.innerHTML = html;
  }

  document.getElementById("alumni-add").addEventListener("click", function () { openForm(null); });
  document.getElementById("alumni-cancel").addEventListener("click", closeForm);
  columnsBtn.addEventListener("click", function () {
    columnsEl.hidden = !columnsEl.hidden;
    columnsBtn.setAttribute("aria-expanded", columnsEl.hidden ? "false" : "true");
  });
  columnsEl.addEventListener("change", function (event) {
    var input = event.target;
    if (!input || !input.getAttribute("data-column")) return;
    var id = input.getAttribute("data-column");
    var stillOn = COLUMNS.some(function (col) { return col.id !== id && col.on; });
    if (!input.checked && !stillOn) {
      input.checked = true;
      showStatus(t("至少要顯示一個欄位。", "Keep at least one column visible."), "err");
      return;
    }
    COLUMNS.forEach(function (col) { if (col.id === id) col.on = input.checked; });
    saveColumns();
    renderTable();
  });
  ["alumni-q", "alumni-filter-degree", "alumni-filter-year", "alumni-filter-dept", "alumni-filter-company"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", renderTable);
    document.getElementById(id).addEventListener("change", renderTable);
  });

  document.getElementById("alumni-template").addEventListener("click", function () {
    downloadCsv("alumni-template.csv", [{
      full_name: "Example Alumni",
      student_id: "EXAMPLE",
      department: "International Business and Trade",
      degree_program: "Master",
      admission_year: 114,
      graduation_year: 116,
      email: "alumni@example.com",
      phone: "02-29052750",
      company: "ABC Corp",
      job_title: "Manager",
      notes: "Sample row. The importer skips student_id EXAMPLE."
    }]);
  });

  document.getElementById("alumni-export").addEventListener("click", function () {
    var list = filteredRows();
    if (!list.length) {
      showStatus(t("目前篩選沒有資料可匯出。", "The current filter has nothing to export."), "err");
      return;
    }
    downloadCsv("alumni-filtered.csv", list);
  });

  document.getElementById("alumni-import-pick").addEventListener("click", function () {
    fileInput.value = "";
    fileInput.click();
  });

  fileInput.addEventListener("change", function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      showImport(validateCsv(String(reader.result || "")));
    };
    reader.readAsText(file, "UTF-8");
  });

  importPanel.addEventListener("click", async function (event) {
    var button = event.target.closest("#alumni-import-go");
    if (!button || !pendingImport) return;
    button.disabled = true;
    try {
      var sb = auth.getClient();
      var payload = pendingImport.map(function (record) {
        var copy = Object.assign({}, record);
        copy.created_by = gate.session.user.id;
        copy.updated_by = gate.session.user.id;
        return copy;
      });
      var inserted = [];
      var i;
      for (i = 0; i < payload.length; i += 100) {
        var result = await sb.from("alumni").insert(payload.slice(i, i + 100)).select("id,full_name,student_id");
        if (result.error) throw result.error;
        inserted = inserted.concat(result.data || []);
      }
      var audits = inserted.map(function (row) {
        return {
          actor_id: gate.session.user.id,
          actor_email: gate.profile.email,
          action: "CREATE",
          entity_type: "alumni",
          entity_id: String(row.id),
          entity_label: row.full_name,
          summary: "created",
          changes: { after: { full_name: row.full_name, student_id: row.student_id } }
        };
      });
      for (i = 0; i < audits.length; i += 100) {
        var auditResult = await sb.from("audit_logs").insert(audits.slice(i, i + 100));
        if (auditResult.error) throw auditResult.error;
      }
      pendingImport = null;
      importPanel.hidden = true;
      await refresh();
      showStatus(t("已匯入 " + inserted.length + " 筆，並寫入活動紀錄。", "Imported " + inserted.length + " records and wrote the activity log."), "ok");
    } catch (err) {
      button.disabled = false;
      showStatus(t("匯入失敗：", "Import failed: ") + (err.message || err), "err");
    }
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var id = document.getElementById("alumni-id").value;
    var record = readForm();
    var problems = formProblems(record, id);
    if (problems.length) {
      showStatus(problems[0], "err");
      return;
    }
    try {
      var sb = auth.getClient();
      record.updated_by = gate.session.user.id;
      if (!id) {
        record.created_by = gate.session.user.id;
        var created = await sb.from("alumni").insert(record).select("*").single();
        if (created.error) throw created.error;
        await writeAudit({
          action: "CREATE",
          entity_id: created.data.id,
          entity_label: created.data.full_name,
          summary: "created",
          changes: { after: record }
        });
        showStatus(t("已新增校友。", "Alumni added."), "ok");
      } else {
        var before = rows.find(function (row) { return row.id === id; }) || {};
        var updated = await sb.from("alumni").update(record).eq("id", id).select("*").single();
        if (updated.error) throw updated.error;
        var fields = diffFields(before, updated.data);
        await writeAudit({
          action: "UPDATE",
          entity_id: id,
          entity_label: updated.data.full_name,
          summary: "updated",
          changes: { fields: fields }
        });
        showStatus(t("已更新校友。", "Alumni updated."), "ok");
      }
      closeForm();
      await refresh();
    } catch (err) {
      showStatus(t("儲存失敗：", "Save failed: ") + (err.message || err), "err");
    }
  });

  tableEl.addEventListener("click", async function (event) {
    var button = event.target.closest("[data-action]");
    if (!button) return;
    var rowEl = button.closest("[data-id]");
    if (!rowEl) return;
    var id = rowEl.getAttribute("data-id");
    var row = rows.find(function (item) { return item.id === id; });
    if (!row) return;
    if (button.getAttribute("data-action") === "edit") {
      openForm(row);
      return;
    }
    if (!window.confirm(t("確定刪除「" + row.full_name + "」？", "Delete “" + row.full_name + "”?"))) return;
    try {
      var sb = auth.getClient();
      var removed = await sb.from("alumni").delete().eq("id", id);
      if (removed.error) throw removed.error;
      await writeAudit({
        action: "DELETE",
        entity_id: id,
        entity_label: row.full_name,
        summary: "deleted",
        changes: { before: { full_name: row.full_name, student_id: row.student_id, company: row.company } }
      });
      showStatus(t("已刪除，並寫入活動紀錄。", "Deleted and recorded in the activity log."), "ok");
      await refresh();
    } catch (err) {
      showStatus(t("刪除失敗：", "Delete failed: ") + (err.message || err), "err");
    }
  });

  var localeToggle = document.querySelector("[data-locale-toggle]");
  if (localeToggle) {
    localeToggle.addEventListener("click", function () {
      setTimeout(renderAll, 0);
    });
  }

  loadColumns();

  (async function init() {
    gate = await auth.requireAdmin();
    if (!gate) return;
    if (authMeta) renderMeta();
    try {
      await refresh();
    } catch (err) {
      var message = String((err && err.message) || err || "");
      statusDetail = message;
      statusCode = message.indexOf("alumni") !== -1 || message.indexOf("audit_logs") !== -1 || message.indexOf("schema cache") !== -1 ? "missing" : "err";
      renderAll();
    }
  })();
})();
