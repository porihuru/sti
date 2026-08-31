// Show the number of questions matching the current setup filters.
// Display-only helper; it does not alter quiz selection or session logic.
// ES5 / IE11 compatible.
(function (root) {
  "use strict";

  var document = root.document;
  var rows = [];
  var ready = false;
  var difficultyRank = { "初級": 1, "中級": 2, "上級": 3 };

  if (!document) { return; }

  function byId(id) {
    return document.getElementById(id);
  }

  function trim(value) {
    return String(value === undefined || value === null ? "" : value).replace(/^\s+|\s+$/g, "");
  }

  function ensureDisplay() {
    var orderSelect = byId("orderSelect");
    var section;
    var heading;
    var display;

    if (!orderSelect) { return null; }
    section = orderSelect.parentNode;
    while (section && section !== document && (" " + section.className + " ").indexOf(" form-section ") < 0) {
      section = section.parentNode;
    }
    if (!section || section === document) { return null; }

    heading = section.getElementsByTagName("h2")[0];
    if (!heading) { return null; }

    display = byId("eligibleQuestionCount");
    if (!display) {
      display = document.createElement("strong");
      display.id = "eligibleQuestionCount";
      display.className = "eligible-question-count";
      display.style.display = "inline-block";
      display.style.marginLeft = "14px";
      display.style.padding = "2px 10px";
      display.style.border = "1px solid #b9c8c4";
      display.style.borderRadius = "999px";
      display.style.background = "#eef5f2";
      display.style.color = "#075e57";
      display.style.fontSize = "13px";
      display.style.fontWeight = "800";
      display.style.lineHeight = "1.5";
      display.style.verticalAlign = "middle";
      display.style.whiteSpace = "nowrap";
      display.appendChild(document.createTextNode("対象 --問"));
      heading.appendChild(display);
    }
    return display;
  }

  function currentFilters() {
    var category = byId("categorySelect");
    var group = byId("relatedGroupSelect");
    var importance = byId("importanceSelect");
    var difficulty = byId("difficultySelect");

    return {
      category: category ? category.value : "all",
      group: group ? group.value : "all",
      importance: importance ? parseInt(importance.value, 10) : 4,
      difficulty: difficulty ? difficulty.value : "上級"
    };
  }

  function countEligible() {
    var filters = currentFilters();
    var maxDifficulty = difficultyRank[filters.difficulty] || 3;
    var maxImportance = isNaN(filters.importance) ? 4 : filters.importance;
    var count = 0;
    var i;
    var row;
    var rowCategory;
    var rowGroup;
    var rowImportance;
    var rowDifficulty;

    for (i = 0; i < rows.length; i += 1) {
      row = rows[i] || {};
      rowCategory = trim(row.category || row.category1);
      rowGroup = trim(row.category2);
      rowImportance = parseInt(row.importance !== undefined ? row.importance : row.Importance, 10);
      rowDifficulty = trim(row.difficulty || row.difficult);

      if (filters.category !== "all" && rowCategory !== filters.category) { continue; }
      if (filters.group !== "all" && rowGroup !== filters.group) { continue; }
      if (!isNaN(rowImportance) && rowImportance > maxImportance) { continue; }
      if ((difficultyRank[rowDifficulty] || 99) > maxDifficulty) { continue; }
      count += 1;
    }
    return count;
  }

  function updateDisplay() {
    var display = ensureDisplay();
    if (!display) { return; }
    display.innerText = ready ? "対象 " + countEligible() + "問" : "対象 --問";
  }

  function deferredUpdate() {
    root.setTimeout(updateDisplay, 0);
  }

  function bindFilter(id) {
    var control = byId(id);
    if (!control) { return; }
    if (control.addEventListener) {
      control.addEventListener("change", deferredUpdate, false);
    } else if (control.attachEvent) {
      control.attachEvent("onchange", deferredUpdate);
    }
  }

  function loadRows() {
    if (!root.STICsv || !root.STICsv.load) {
      root.setTimeout(loadRows, 100);
      return;
    }

    root.STICsv.load("db/R8db.csv", function (loadedRows) {
      rows = loadedRows || [];
      ready = true;
      updateDisplay();
    }, function () {
      rows = [];
      ready = false;
      updateDisplay();
    });
  }

  function init() {
    ensureDisplay();
    bindFilter("categorySelect");
    bindFilter("relatedGroupSelect");
    bindFilter("importanceSelect");
    bindFilter("difficultySelect");
    loadRows();
  }

  if (document.readyState === "loading") {
    if (root.addEventListener) {
      root.addEventListener("DOMContentLoaded", init, false);
    } else if (root.attachEvent) {
      root.attachEvent("onload", init);
    }
  } else {
    init();
  }
}(this));
