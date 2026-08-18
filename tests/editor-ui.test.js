"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
var html = fs.readFileSync(path.join(root, "index.html"), "utf8");
var app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
var idPattern = /\bid="([^"]+)"/g;
var byIdPattern = /byId\("([^"]+)"\)/g;
var ids = {};
var match;

while ((match = idPattern.exec(html)) !== null) {
  assert.ok(!ids[match[1]], "HTMLのidが重複しています: " + match[1]);
  ids[match[1]] = true;
}

while ((match = byIdPattern.exec(app)) !== null) {
  assert.ok(ids[match[1]], "app.jsが存在しないHTML要素を参照しています: " + match[1]);
}

[
  "editorView", "openLocalCsvButton", "editorWorkspace", "recordEditorForm",
  "saveRecordButton", "deleteRecordButton", "addRecordButton",
  "saveRecordButtonTop", "deleteRecordButtonTop", "previewLocalDbButton",
  "exitPreviewButton", "editorLeaveModal"
].forEach(function (id) {
  assert.ok(ids[id], "CSV編集画面に必要な要素がありません: " + id);
});

assert.ok(html.indexOf('src="js/csv.js"') < html.indexOf('src="js/local-db.js"'), "CSVパーサーより先にローカルDB機能が読み込まれています");
assert.ok(html.indexOf('src="js/local-db.js"') < html.indexOf('src="js/app.js"'), "アプリより後にローカルDB機能が読み込まれています");
assert.ok(app.indexOf("window.showOpenFilePicker") >= 0, "書き込み可能なローカルファイル読み込みが実装されていません");
assert.ok(app.indexOf("return !!(window.isSecureContext && window.showOpenFilePicker);") >= 0, "未対応ブラウザーでFile System Access APIを無効化する判定がありません");
assert.ok(app.indexOf("if (!directFileEditingAvailable())") >= 0, "CSVファイル選択前の互換性ガードがありません");
assert.ok(app.indexOf('byId("openLocalCsvButton").disabled = !available;') >= 0, "未対応ブラウザーでCSV直接編集ボタンを無効化していません");
assert.ok(app.indexOf("window.showSaveFilePicker") < 0, "別名保存処理が残っています");
assert.ok(app.indexOf("downloadLocalCsv") < 0, "CSVダウンロード処理が残っています");
assert.ok(app.indexOf("createWritable()") >= 0, "選択したCSVの直接更新が実装されていません");
assert.ok(app.indexOf("STIHistory.usePreview(true)") >= 0, "確認履歴の分離が実装されていません");
assert.ok(app.indexOf("function resizeEditorTextarea") >= 0, "長文欄の高さ自動調整が実装されていません");
assert.ok(/id="editOriginal" rows="1"/.test(html), "original欄が最小の高さから始まりません");
assert.ok(/id="editQuestion" rows="1"/.test(html), "question欄が最小の高さから始まりません");
assert.ok(/id="editExplanation" rows="1"/.test(html), "explanation欄が最小の高さから始まりません");
assert.ok(app.indexOf("fetch(") < 0, "ローカルCSVを送信する可能性のあるfetchが含まれています");

console.log("Local CSV editor UI validation passed");
