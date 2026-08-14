"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
var html = fs.readFileSync(path.join(root, "index.html"), "utf8");
var assetPattern = /(?:src|href)="([^"]+)"/g;
var match;
var asset;
var files = [
  "index.html",
  "css/style.css",
  "css/print.css",
  "js/csv.js",
  "js/history.js",
  "js/app.js"
];
var i;

while ((match = assetPattern.exec(html)) !== null) {
  asset = match[1];
  assert.ok(!/^https?:\/\//i.test(asset), "外部アセットが指定されています: " + asset);
  assert.ok(fs.existsSync(path.join(root, asset)), "ローカルアセットがありません: " + asset);
}

for (i = 0; i < files.length; i += 1) {
  assert.ok(!/https?:\/\//i.test(fs.readFileSync(path.join(root, files[i]), "utf8")), "外部URLが含まれています: " + files[i]);
}

assert.ok(fs.existsSync(path.join(root, "db", "R8db.csv")), "CSVがありません");
assert.ok(html.indexOf('name="viewport"') >= 0, "スマートフォン用viewport設定がありません");
assert.ok(fs.readFileSync(path.join(root, "css", "style.css"), "utf8").indexOf("@media (max-width: 520px)") >= 0, "スマートフォン用CSSがありません");

console.log("Offline asset validation passed");
