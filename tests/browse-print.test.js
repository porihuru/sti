"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
var html = fs.readFileSync(path.join(root, "index.html"), "utf8");
var app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
var printCss = fs.readFileSync(path.join(root, "css", "print.css"), "utf8");

assert.ok(html.indexOf('id="browsePrintButton"') >= 0, "条文一覧PDFボタンがありません");
assert.ok(html.indexOf('id="browsePrintDocument"') >= 0, "条文一覧の印刷領域がありません");
assert.ok(app.indexOf('session.config.mode !== "browse"') >= 0, "閲覧モードだけにPDFボタンを表示する制御がありません");
assert.ok(app.indexOf("margin: 15mm 15mm 15mm 25mm") >= 0, "PDFの左余白が25mmではありません");
assert.ok(app.indexOf("size: A4 portrait") >= 0, "PDFがA4縦に設定されていません");
assert.ok(printCss.indexOf("@page { size: A4 portrait; margin: 15mm 15mm 15mm 25mm; }") >= 0, "学習結果PDFの左余白が25mmではありません");
assert.ok(app.indexOf('element("h1", "", "条文一覧")') >= 0, "PDF先頭の見出しが条文一覧ではありません");
assert.ok(printCss.indexOf("body.print-browse #browsePrintDocument") >= 0, "条文一覧の印刷表示設定がありません");
assert.ok(printCss.indexOf(".browse-print-law") >= 0, "条文一覧の読みやすい書式がありません");
assert.ok(printCss.indexOf("font-size: 14pt") >= 0, "PDF見出しのフォントが小さく調整されていません");
assert.ok(printCss.indexOf("border-top: 2.5pt double") >= 0, "PDF見出し上部の装飾線がありません");
assert.ok(printCss.indexOf(".browse-print-header h1:after") >= 0, "PDF見出しのアクセントラインがありません");

console.log("Browse PDF print validation passed");
