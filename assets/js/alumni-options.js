(function (global) {
  var DEPARTMENTS = [
    { id: "International Business and Trade", zh: "國際貿易", en: "International Business and Trade" },
    { id: "Business Administration", zh: "企業管理", en: "Business Administration" },
    { id: "Accounting", zh: "會計", en: "Accounting" },
    { id: "Finance", zh: "財務金融", en: "Finance" },
    { id: "Information Management", zh: "資訊管理", en: "Information Management" },
    { id: "Economics", zh: "經濟", en: "Economics" },
    { id: "Law", zh: "法律", en: "Law" },
    { id: "Statistics", zh: "統計", en: "Statistics" }
  ];
  var DEGREES = [
    { id: "Bachelor", zh: "學士", en: "Bachelor" },
    { id: "Master", zh: "碩士", en: "Master" },
    { id: "Doctoral", zh: "博士", en: "Doctoral" },
    { id: "Other", zh: "其他", en: "Other" }
  ];

  function isEn() {
    return document.documentElement.getAttribute("data-locale") === "en";
  }

  function label(item) {
    return isEn() ? item.en : item.zh;
  }

  function years() {
    var list = [];
    var year;
    for (year = 120; year >= 100; year -= 1) list.push(year);
    return list;
  }

  function yearOk(value) {
    var year = Number(value);
    return Number.isInteger(year) && ((year >= 90 && year <= 130) || (year >= 1950 && year <= 2100));
  }

  function yearLabel(value) {
    if (value == null || value === "") return "";
    return String(value);
  }

  function departmentLabel(id) {
    var i;
    for (i = 0; i < DEPARTMENTS.length; i += 1) {
      if (DEPARTMENTS[i].id === id) return label(DEPARTMENTS[i]);
    }
    return id || "";
  }

  function degreeLabel(id) {
    var i;
    for (i = 0; i < DEGREES.length; i += 1) {
      if (DEGREES[i].id === id) return label(DEGREES[i]);
    }
    return id || "";
  }

  function fillSelect(select, items, opts) {
    opts = opts || {};
    var current = select.value;
    var html = "";
    if (opts.blank) {
      html += '<option value="">' + (opts.blankLabel || "—") + "</option>";
    }
    items.forEach(function (item) {
      var value = typeof item === "object" ? item.id : item;
      var text = typeof item === "object" ? label(item) : opts.itemLabel(item);
      html += '<option value="' + String(value).replace(/"/g, "&quot;") + '">' + text + "</option>";
    });
    select.innerHTML = html;
    select.value = current;
  }

  global.ImMbaAlumniOptions = {
    departments: DEPARTMENTS,
    degrees: DEGREES,
    years: years,
    yearOk: yearOk,
    yearLabel: yearLabel,
    departmentLabel: departmentLabel,
    degreeLabel: degreeLabel,
    fillSelect: fillSelect
  };
})(window);
