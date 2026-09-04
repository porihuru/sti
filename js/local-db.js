(function (root) {
  "use strict";

  var csv = root.STICsv;
  var HEADERS = [
    "id", "Importance", "difficult", "category1", "category2",
    "original", "question", "explanation", "notes1", "notes2",
    "notes3", "notes4", "notes5"
  ];
  var DIFFICULTIES = { "初級": true, "中級": true, "上級": true };

  if (typeof module !== "undefined" && module.exports) {
    csv = require("./csv.js");
  }

  function trim(value) {
    return String(value === undefined || value === null ? "" : value).replace(/^\s+|\s+$/g, "");
  }

  function validateFilename(filename) {
    if (!/\.csv$/i.test(String(filename || ""))) {
      throw new Error("CSV形式のファイルを選択してください。ファイルは読み込まれませんでした。");
    }
  }

  function validateHeader(rawRows) {
    var headers;
    var i;
    if (!rawRows.length) {
      throw new Error("CSVにヘッダーがありません。ファイルは読み込まれませんでした。");
    }
    headers = rawRows[0].slice(0);
    if (headers[0] && headers[0].charCodeAt(0) === 0xFEFF) {
      headers[0] = headers[0].substring(1);
    }
    if (headers.length !== HEADERS.length) {
      throw new Error("ヘッダーは" + HEADERS.length + "列必要です。現在は" + headers.length + "列です。ファイルは読み込まれませんでした。");
    }
    for (i = 0; i < HEADERS.length; i += 1) {
      if (headers[i] !== HEADERS[i]) {
        throw new Error("ヘッダーの" + (i + 1) + "列目は「" + HEADERS[i] + "」である必要があります。ファイルは読み込まれませんでした。");
      }
    }
  }

  function validateRows(rawRows, rows) {
    var ids = {};
    var rawIndex;
    var id;
    var importance;
    var requiredIndexes = [0, 1, 2, 3, 4, 5, 6, 7];
    var i;
    for (rawIndex = 1; rawIndex < rawRows.length; rawIndex += 1) {
      if (rawRows[rawIndex].length === 1 && rawRows[rawIndex][0] === "") { continue; }
      if (rawRows[rawIndex].length !== HEADERS.length) {
        throw new Error("CSVの" + (rawIndex + 1) + "行目は" + HEADERS.length + "列ではありません。ファイルは読み込まれませんでした。");
      }
      for (i = 0; i < requiredIndexes.length; i += 1) {
        if (!trim(rawRows[rawIndex][requiredIndexes[i]])) {
          throw new Error("CSVの" + (rawIndex + 1) + "行目に必須項目の空欄があります。ファイルは読み込まれませんでした。");
        }
      }
      id = parseInt(rawRows[rawIndex][0], 10);
      importance = parseInt(rawRows[rawIndex][1], 10);
      if (String(id) !== trim(rawRows[rawIndex][0]) || id < 1) {
        throw new Error("CSVの" + (rawIndex + 1) + "行目のidが正の整数ではありません。ファイルは読み込まれませんでした。");
      }
      if (ids[id]) {
        throw new Error("id " + id + " が重複しています。ファイルは読み込まれませんでした。");
      }
      ids[id] = true;
      if (String(importance) !== trim(rawRows[rawIndex][1]) || importance < 1 || importance > 4) {
        throw new Error("CSVの" + (rawIndex + 1) + "行目のImportanceは1～4である必要があります。ファイルは読み込まれませんでした。");
      }
      if (!DIFFICULTIES[trim(rawRows[rawIndex][2])]) {
        throw new Error("CSVの" + (rawIndex + 1) + "行目のdifficultが初級・中級・上級ではありません。ファイルは読み込まれませんでした。");
      }
      if (rawRows[rawIndex][5] === rawRows[rawIndex][6]) {
        throw new Error("CSVの" + (rawIndex + 1) + "行目はoriginalとquestionが同じです。ファイルは読み込まれませんでした。");
      }
    }
    if (!rows.length) {
      throw new Error("編集できるレコードがありません。ファイルは読み込まれませんでした。");
    }
  }

  function parse(text, filename) {
    var rawRows;
    var rows;
    validateFilename(filename);
    rawRows = csv.parseRows(text);
    validateHeader(rawRows);
    rows = csv.parse(text);
    validateRows(rawRows, rows);
    return rows;
  }

  function csvField(value) {
    var text = String(value === undefined || value === null ? "" : value);
    if (/[",\r\n]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function serialize(rows) {
    var lines = [HEADERS.join(",")];
    var i;
    var row;
    var values;
    for (i = 0; i < rows.length; i += 1) {
      row = rows[i];
      values = [
        row.id, row.importance, row.difficulty, row.category1 || row.category,
        row.category2, row.original, row.question, row.explanation,
        row.notes1, row.notes2, row.notes3, row.notes4, row.notes5
      ];
      lines.push(values.map(csvField).join(","));
    }
    return "\uFEFF" + lines.join("\r\n") + "\r\n";
  }

  function dateStamp(date) {
    var value = date || new Date();
    return value.getFullYear() + "_" + ("0" + (value.getMonth() + 1)).slice(-2) + "_" + ("0" + value.getDate()).slice(-2);
  }

  function validateNickname(nickname) {
    var value = trim(nickname);
    if (!value) { throw new Error("ニックネームを入力してください。"); }
    if (value.length > 40) { throw new Error("ニックネームは40文字以内で入力してください。"); }
    return value;
  }

  function setupEditorCategorySuggestions() {
    var document = root.document;
    var input;
    var list;
    var originalPicker;
    if (!document || !root.addEventListener) { return; }
    input = document.getElementById("editCategory1");
    if (!input) { return; }

    list = document.getElementById("editCategory1Options");
    if (!list) {
      list = document.createElement("datalist");
      list.id = "editCategory1Options";
      input.parentNode.appendChild(list);
    }
    input.setAttribute("list", list.id);

    function populate(rows) {
      var seen = {};
      var names = [];
      var i;
      var name;
      var option;
      while (list.firstChild) { list.removeChild(list.firstChild); }
      for (i = 0; i < rows.length; i += 1) {
        name = trim(rows[i].category1 || rows[i].category);
        if (name && !seen[name]) {
          seen[name] = true;
          names.push(name);
        }
      }
      names.sort(function (a, b) { return a.localeCompare(b, "ja"); });
      for (i = 0; i < names.length; i += 1) {
        option = document.createElement("option");
        option.value = names[i];
        list.appendChild(option);
      }
    }

    root.STILocalDb.populateCategorySuggestions = populate;
    originalPicker = root.showOpenFilePicker;
    if (!originalPicker || originalPicker.__stiCategoryWrapped) { return; }

    function wrappedPicker(options) {
      return originalPicker.call(root, options).then(function (handles) {
        var handle = handles && handles[0];
        if (!handle || !handle.getFile || !root.FileReader || !root.Promise) { return handles; }
        return handle.getFile().then(function (file) {
          return new root.Promise(function (resolve) {
            var reader = new root.FileReader();
            reader.onload = function () {
              try { populate(parse(reader.result, file.name)); }
              catch (error) { /* Main editor shows validation errors. */ }
              resolve(handles);
            };
            reader.onerror = function () { resolve(handles); };
            reader.readAsText(file, "UTF-8");
          });
        }, function () { return handles; });
      });
    }

    wrappedPicker.__stiCategoryWrapped = true;
    root.showOpenFilePicker = wrappedPicker;
  }

  function applyIeSetupLayoutFix() {
    var document = root.document;
    var setupView;
    var heading;
    if (!document || !document.documentMode) { return; }
    setupView = document.getElementById("setupView");
    if (!setupView) { return; }
    heading = setupView.querySelector(".page-heading");
    setupView.style.paddingTop = "10px";
    if (!heading) { return; }
    heading.style.display = "block";
    heading.style.width = "100%";
    heading.style.marginTop = "0";
    heading.style.marginBottom = "12px";
    heading.style.textAlign = "center";
  }

  function applyIeLearnLayoutFix() {
    var document = root.document;
    var style;
    if (!document || !document.documentMode) { return; }
    if (document.getElementById("ieLearnLayoutFix")) { return; }
    style = document.createElement("style");
    style.id = "ieLearnLayoutFix";
    style.type = "text/css";
    style.styleSheet.cssText =
      "#learnView > .question-card,#learnView > .feedback-panel{" +
      "position:relative;width:150%;max-width:calc(100vw - 64px);" +
      "margin-left:50%;margin-right:0;transform:translateX(-50%);}" +
      "#learnView #questionArea{width:100%;margin-left:auto;margin-right:auto;}" +
      "#learnView .choice-list{width:100%;}" +
      "#learnView .choice-button{width:100%;}" +
      "#learnView .choice-text{width:100%;max-width:none;}";
    document.getElementsByTagName("head")[0].appendChild(style);
  }

  root.STILocalDb = {
    headers: HEADERS.slice(0),
    parse: parse,
    serialize: serialize,
    dateStamp: dateStamp,
    validateNickname: validateNickname
  };

  if (root.document && root.addEventListener) {
    root.addEventListener("DOMContentLoaded", function () {
      setupEditorCategorySuggestions();
      applyIeSetupLayoutFix();
      applyIeLearnLayoutFix();
    });
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.STILocalDb;
  }
}(this));

// Load the optional SharePoint access counter without coupling it to STI startup.
(function (root) {
  "use strict";

  var document = root && root.document;

  if (!document) { return; }

  function loadAccessCounter() {
    var head;
    var script;

    try {
      if (document.getElementById("stiAccessCounterScript")) { return; }
      head = document.getElementsByTagName("head")[0];
      if (!head) { return; }

      script = document.createElement("script");
      script.id = "stiAccessCounterScript";
      script.type = "text/javascript";
      script.src = "js/accesscounter.js?v=4";
      script.async = true;
      script.onerror = function () {
        // Counter loading failures must never affect the main STI application.
      };
      head.appendChild(script);
    } catch (e) {
      // Intentionally ignored: access counting is an optional side feature.
    }
  }

  if (document.readyState === "loading") {
    if (root.addEventListener) {
      root.addEventListener("DOMContentLoaded", loadAccessCounter, false);
    } else if (root.attachEvent) {
      root.attachEvent("onload", loadAccessCounter);
    }
  } else {
    loadAccessCounter();
  }
}(this));