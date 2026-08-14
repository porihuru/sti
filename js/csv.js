(function (root) {
  "use strict";

  function parse(text) {
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

    if (field !== "" || row.length > 0) {
      row.push(field);
      rawRows.push(row);
    }

    return toObjects(rawRows);
  }

  function toObjects(rawRows) {
    var headers;
    var result = [];
    var i;
    var item;

    if (!rawRows.length) {
      return result;
    }

    headers = rawRows[0];
    if (headers[0] && headers[0].charCodeAt(0) === 0xFEFF) {
      headers[0] = headers[0].substring(1);
    }

    for (i = 1; i < rawRows.length; i += 1) {
      if (rawRows[i].length === 1 && rawRows[i][0] === "") {
        continue;
      }
      if (rawRows[i].length !== headers.length) {
        throw new Error("CSVの" + (i + 1) + "行目の列数が一致しません。");
      }

      item = {
        id: parseInt(rawRows[i][0], 10),
        importance: parseInt(rawRows[i][1], 10),
        difficulty: rawRows[i][2],
        category: rawRows[i][3],
        original: rawRows[i][4],
        question: rawRows[i][5],
        explanation: rawRows[i][6]
      };

      if (!item.id || !item.importance || !item.difficulty || !item.category ||
          !item.original || !item.question || !item.explanation) {
        throw new Error("CSVの" + (i + 1) + "行目に不足している値があります。");
      }
      result.push(item);
    }

    return result;
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

  var api = { parse: parse, load: load };
  root.STICsv = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
}(this));
