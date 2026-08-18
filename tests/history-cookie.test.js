"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var cookies = {};
var documentMock = {};
var historyPath = path.join(__dirname, "..", "js", "history.js");
var historySource = fs.readFileSync(historyPath, "utf8");

Object.defineProperty(documentMock, "cookie", {
  get: function () {
    return Object.keys(cookies).map(function (name) { return name + "=" + cookies[name]; }).join("; ");
  },
  set: function (value) {
    var first = value.split(";")[0];
    var separator = first.indexOf("=");
    var name = first.substring(0, separator);
    var cookieValue = first.substring(separator + 1);
    if (value.indexOf("Thu, 01 Jan 1970") >= 0) {
      delete cookies[name];
    } else {
      cookies[name] = cookieValue;
    }
  }
});

global.document = documentMock;
global.window = { location: { protocol: "https:" } };

var history = require(historyPath).STIHistory;
var i;
var row;

assert.ok(historySource.indexOf("document.cookie") >= 0, "履歴保存にCookieが使われていません");
assert.ok(!/\b(?:let|const)\b/.test(historySource), "history.jsにIE11非対応のlet/constが含まれています");
assert.ok(historySource.indexOf("=>") < 0, "history.jsにIE11非対応のアロー関数が含まれています");
assert.ok(historySource.indexOf("fetch(") < 0, "history.jsにIE11非対応のfetchが含まれています");
assert.ok(!/\bPromise\b/.test(historySource), "history.jsにIE11非対応のPromiseが含まれています");
assert.ok(history.cookiesAvailable(), "Cookieの利用可否判定に失敗しました");

for (i = 1; i <= 500; i += 1) {
  row = {
    id: i,
    importance: (i % 4) + 1,
    difficulty: ["初級", "中級", "上級"][i % 3],
    category: ["会計", "給与", "旅費", "契約"][i % 4]
  };
  history.record(row, ["trueFalse", "fourCorrect", "fourWrong"][i % 3], false);
}

assert.strictEqual(history.summary().t, 500);
assert.strictEqual(history.summary().w, 500);
assert.strictEqual(history.summary().c, 0);
assert.ok(history.weakList().length <= 160, "不得意問題の保存上限を超えています");
assert.ok((cookies.sti_weak || "").length < 4000, "不得意問題Cookieが4KBを超えています");
assert.ok((cookies.sti_summary || "").length < 4000, "集計Cookieが4KBを超えています");

history.saveSettings({ mode: "fourWrong", category: "会計", relatedGroup: "財政法", importance: 3, difficulty: "中級", order: "random", count: 20, startValue: 1 });
assert.strictEqual(history.loadSettings().m, "fourWrong");
assert.strictEqual(history.loadSettings().n, 20);
assert.strictEqual(history.loadSettings().r, "財政法");

history.saveDisplay("large");
assert.strictEqual(history.loadDisplay(), "large");

history.usePreview(true);
assert.strictEqual(history.summary().t, 0, "確認履歴が通常履歴と分離されていません");
history.record({ id: 1, importance: 1, difficulty: "初級", category: "会計" }, "trueFalse", true);
assert.strictEqual(history.summary().t, 1);
assert.ok(cookies.sti_preview_summary, "確認用Cookieが作成されていません");
history.reset();
assert.strictEqual(history.summary().t, 0);

history.usePreview(false);
assert.strictEqual(history.summary().t, 500, "確認履歴が通常履歴を変更しました");

history.reset();
assert.strictEqual(history.summary().t, 0);
assert.strictEqual(history.weakList().length, 0);
assert.strictEqual(history.loadDisplay(), "large", "履歴消去後も表示設定は保持される必要があります");

console.log("Cookie history validation passed");
