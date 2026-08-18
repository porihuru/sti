(function (root) {
  "use strict";

  function parseRows(text) {
    var source = String(text || "");
    var rawRows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    var i;
    var character;

    for (i = 0; i < source.length; i += 1) {
      character = source.charAt(i);

      if (inQuotes) {
        if (character === '"') {
          if (source.charAt(i + 1) === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += character;
        }
      } else if (character === '"') {
        inQuotes = true;
      } else if (character === ",") {
        row.push(field);
        field = "";
      } else if (character === "\n") {
        row.push(field);
        rawRows.push(row);
        row = [];
        field = "";
      } else if (character !== "\r") {
        field += character;
      }
    }

    if (inQuotes) {
      throw new Error("CSV内の引用符が閉じられていません。");
    }

    if (field !== "" || row.length > 0) {
      row.push(field);
      rawRows.push(row);
    }

    return rawRows;
  }

  function parse(text) {
    return toObjects(parseRows(text));
  }

  function toObjects(rawRows) {
    var headers;
    var headerMap = {};
    var indexes;
    var result = [];
    var i;
    var name;
    var item;

    if (!rawRows.length) {
      return result;
    }

    headers = rawRows[0];
    if (headers[0] && headers[0].charCodeAt(0) === 0xFEFF) {
      headers[0] = headers[0].substring(1);
    }

    for (i = 0; i < headers.length; i += 1) {
      name = headers[i].replace(/^\s+|\s+$/g, "");
      if (!name) {
        throw new Error("CSVのヘッダーに空の列名があります。");
      }
      if (headerMap[name] !== undefined) {
        throw new Error("CSVのヘッダーが重複しています: " + name);
      }
      headerMap[name] = i;
    }

    indexes = {
      id: requiredIndex(headerMap, ["id"]),
      importance: requiredIndex(headerMap, ["Importance", "importance"]),
      difficulty: requiredIndex(headerMap, ["difficult", "difficulty"]),
      category1: requiredIndex(headerMap, ["category1", "category"]),
      category2: optionalIndex(headerMap, ["category2"]),
      original: requiredIndex(headerMap, ["original"]),
      question: requiredIndex(headerMap, ["question"]),
      explanation: requiredIndex(headerMap, ["explanation"]),
      notes1: optionalIndex(headerMap, ["notes1"]),
      notes2: optionalIndex(headerMap, ["notes2"]),
      notes3: optionalIndex(headerMap, ["notes3"]),
      notes4: optionalIndex(headerMap, ["notes4"]),
      notes5: optionalIndex(headerMap, ["notes5"])
    };

    for (i = 1; i < rawRows.length; i += 1) {
      if (rawRows[i].length === 1 && rawRows[i][0] === "") {
        continue;
      }
      if (rawRows[i].length !== headers.length) {
        throw new Error("CSVの" + (i + 1) + "行目の列数が一致しません。");
      }

      item = {
        id: parseInt(valueAt(rawRows[i], indexes.id), 10),
        importance: parseInt(valueAt(rawRows[i], indexes.importance), 10),
        difficulty: valueAt(rawRows[i], indexes.difficulty),
        category1: valueAt(rawRows[i], indexes.category1),
        category2: valueAt(rawRows[i], indexes.category2),
        original: valueAt(rawRows[i], indexes.original),
        question: valueAt(rawRows[i], indexes.question),
        explanation: valueAt(rawRows[i], indexes.explanation),
        notes1: valueAt(rawRows[i], indexes.notes1),
        notes2: valueAt(rawRows[i], indexes.notes2),
        notes3: valueAt(rawRows[i], indexes.notes3),
        notes4: valueAt(rawRows[i], indexes.notes4),
        notes5: valueAt(rawRows[i], indexes.notes5)
      };
      item.category = item.category1;

      if (!item.id || !item.importance || !item.difficulty || !item.category1 ||
          !item.original || !item.question || !item.explanation) {
        throw new Error("CSVの" + (i + 1) + "行目に不足している値があります。");
      }
      result.push(item);
    }

    return result;
  }

  function optionalIndex(headerMap, names) {
    var i;
    for (i = 0; i < names.length; i += 1) {
      if (headerMap[names[i]] !== undefined) {
        return headerMap[names[i]];
      }
    }
    return -1;
  }

  function requiredIndex(headerMap, names) {
    var index = optionalIndex(headerMap, names);
    if (index < 0) {
      throw new Error("CSVに必要な列がありません: " + names.join(" または "));
    }
    return index;
  }

  function valueAt(row, index) {
    return index >= 0 ? row[index] : "";
  }

  function load(url, onSuccess, onError) {
    var request = new XMLHttpRequest();
    request.open("GET", url, true);
    if (request.overrideMimeType) {
      request.overrideMimeType("text/csv;charset=utf-8");
    }
    request.onreadystatechange = function () {
      if (request.readyState !== 4) {
        return;
      }
      if ((request.status >= 200 && request.status < 300) || request.status === 304) {
        try {
          onSuccess(parse(request.responseText));
        } catch (error) {
          onError(error);
        }
      } else {
        onError(new Error("条文データを取得できませんでした（HTTP " + request.status + "）。"));
      }
    };
    request.onerror = function () {
      onError(new Error("条文データの通信に失敗しました。"));
    };
    request.send(null);
  }

  /*
   * Modern Edge batch editor save refresh.
   * After the final CSV write succeeds, reopen the same file through the
   * existing batch-editor loader. This makes the saved file the new baseline,
   * clearing added/edited/deleted markers without duplicating editor state.
   * IE mode is intentionally excluded because msSaveBlob cannot report whether
   * the user actually completed the Windows save dialog.
   */
  function installModernSaveRefresh() {
    var documentObject;
    var nativePicker;
    var handlePrototype;
    var nativeCreateWritable;
    var lastHandles = null;
    var reuseHandlesOnce = false;
    var finalSavePending = false;
    var pendingTimer = null;

    if (!root || !root.document || root.document.documentMode ||
        !root.showOpenFilePicker || !root.Promise || !root.FileSystemFileHandle) {
      return;
    }

    documentObject = root.document;
    nativePicker = root.showOpenFilePicker;
    handlePrototype = root.FileSystemFileHandle.prototype;
    nativeCreateWritable = handlePrototype && handlePrototype.createWritable;
    if (!nativeCreateWritable) { return; }

    root.showOpenFilePicker = function (options) {
      if (reuseHandlesOnce && lastHandles && lastHandles.length) {
        reuseHandlesOnce = false;
        return root.Promise.resolve(lastHandles);
      }
      return nativePicker.call(root, options).then(function (handles) {
        if (handles && handles.length) { lastHandles = handles; }
        return handles;
      });
    };

    handlePrototype.createWritable = function () {
      var handle = this;
      var args = arguments;
      return nativeCreateWritable.apply(handle, args).then(function (writable) {
        var nativeClose;
        if (!writable || !writable.close || writable.__stiSaveRefreshWrapped) {
          return writable;
        }
        nativeClose = writable.close;
        writable.__stiSaveRefreshWrapped = true;
        writable.close = function () {
          var closeArgs = arguments;
          var result;
          try {
            result = nativeClose.apply(writable, closeArgs);
          } catch (error) {
            clearPendingSave();
            throw error;
          }
          if (!result || !result.then) { return result; }
          return result.then(function (value) {
            if (finalSavePending && lastHandles && lastHandles.length) {
              clearPendingSave();
              root.setTimeout(refreshSavedCsv, 0);
            }
            return value;
          }, function (error) {
            clearPendingSave();
            throw error;
          });
        };
        return writable;
      });
    };

    function clearPendingSave() {
      finalSavePending = false;
      if (pendingTimer) {
        root.clearTimeout(pendingTimer);
        pendingTimer = null;
      }
    }

    function markPendingSave() {
      clearPendingSave();
      finalSavePending = true;
      pendingTimer = root.setTimeout(clearPendingSave, 10000);
    }

    function refreshSavedCsv() {
      var button = documentObject.getElementById("openLocalCsvButton");
      var message = documentObject.getElementById("editorMessage");
      var originalConfirm = root.confirm;
      var observer = null;
      if (!button || !lastHandles || !lastHandles.length) { return; }

      reuseHandlesOnce = true;
      root.confirm = function (text) {
        if (String(text || "").indexOf("CSVへ保存していない変更があります。別のCSVを開くと変更は失われます。続けますか？") === 0) {
          return true;
        }
        return originalConfirm.apply(root, arguments);
      };

      if (root.MutationObserver && message) {
        observer = new root.MutationObserver(function () {
          if (String(message.textContent || "").indexOf("ローカルCSVを読み込みました。") === 0) {
            message.textContent = "変更内容をローカルCSVへ保存しました。続けて編集できます。";
            observer.disconnect();
            observer = null;
          }
        });
        observer.observe(message, { childList: true, characterData: true, subtree: true });
      }

      try {
        button.click();
      } finally {
        root.confirm = originalConfirm;
      }

      root.setTimeout(function () {
        reuseHandlesOnce = false;
        if (observer) { observer.disconnect(); }
      }, 3000);
    }

    documentObject.addEventListener("click", function (event) {
      var target = event.target;
      if (target && target.id === "saveAllCsvButton") {
        markPendingSave();
      }
    }, true);
  }

  var api = { parse: parse, parseRows: parseRows, load: load };
  root.STICsv = api;
  installModernSaveRefresh();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
}(this));