"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var csv = require(path.join(__dirname, "..", "js", "csv.js"));
var source = fs.readFileSync(path.join(__dirname, "..", "db", "R8db.csv"), "utf8");
var rows = csv.parse(source);
var categories = {};
var relatedGroups = {};
var relatedGroupCategories = {};
var difficulties = {};
var importance = {};
var ids = {};
var i;

assert.strictEqual(rows.length, 2436, "CSVのレコード数が想定と異なります");
assert.strictEqual(rows[0].id, 1, "先頭IDが1ではありません");
assert.strictEqual(rows[rows.length - 1].id, 2436, "末尾IDが2436ではありません");
assert.strictEqual(rows[0].category1, "会計", "category1を正しく読み取れていません");
assert.strictEqual(rows[0].category2, "財政法", "category2を正しく読み取れていません");
assert.ok(rows[0].original.indexOf("財政法第１条") === 0, "originalの列位置がずれています");
assert.ok(rows[0].question.indexOf("財政法第１条") === 0, "questionの列位置がずれています");
assert.ok(rows[0].explanation.indexOf("誤り") >= 0, "explanationの列位置がずれています");
assert.strictEqual(rows[0].notes1, "2026_08_15");
assert.strictEqual(rows[0].notes2, "m");

for (i = 0; i < rows.length; i += 1) {
  assert.ok(!ids[rows[i].id], "IDが重複しています: " + rows[i].id);
  ids[rows[i].id] = true;
  assert.ok(rows[i].original, "originalが空です: " + rows[i].id);
  assert.ok(rows[i].question, "questionが空です: " + rows[i].id);
  assert.ok(rows[i].explanation, "explanationが空です: " + rows[i].id);
  assert.ok(rows[i].category2, "category2が空です: " + rows[i].id);
  assert.notStrictEqual(rows[i].original, rows[i].question, "元条文と問題文が同じです: " + rows[i].id);
  categories[rows[i].category] = (categories[rows[i].category] || 0) + 1;
  relatedGroups[rows[i].category2] = (relatedGroups[rows[i].category2] || 0) + 1;
  relatedGroupCategories[rows[i].category2] = relatedGroupCategories[rows[i].category2] || {};
  relatedGroupCategories[rows[i].category2][rows[i].category1] = true;
  difficulties[rows[i].difficulty] = (difficulties[rows[i].difficulty] || 0) + 1;
  importance[rows[i].importance] = (importance[rows[i].importance] || 0) + 1;
}

assert.deepStrictEqual(categories, { "会計": 1006, "給与": 940, "旅費": 159, "契約": 331 });
assert.deepStrictEqual(difficulties, { "初級": 238, "中級": 1325, "上級": 873 });
assert.deepStrictEqual(importance, { "1": 1539, "2": 728, "3": 157, "4": 12 });
assert.strictEqual(Object.keys(relatedGroups).length, 43, "関連法規グループ数が想定と異なります");
Object.keys(relatedGroupCategories).forEach(function (group) {
  assert.strictEqual(Object.keys(relatedGroupCategories[group]).length, 1, "関連法規グループが複数の大分類に属しています: " + group);
});

var legacy = csv.parse("id,Importance,difficult,category,original,question,explanation\n1,1,初級,会計,正しい条文,誤った条文,解説");
assert.strictEqual(legacy[0].category1, "会計", "旧category列を読み取れません");
assert.strictEqual(legacy[0].category, "会計", "互換categoryが設定されていません");
assert.strictEqual(legacy[0].category2, "", "旧形式のcategory2は空である必要があります");
assert.strictEqual(legacy[0].original, "正しい条文");

var reordered = csv.parse("question,category2,explanation,id,category1,original,difficult,Importance\n誤文,関連法規,解説,9,契約,正文,上級,3");
assert.strictEqual(reordered[0].id, 9, "ヘッダー順変更に対応できていません");
assert.strictEqual(reordered[0].category2, "関連法規");
assert.strictEqual(reordered[0].original, "正文");
assert.throws(function () {
  csv.parse("id,Importance,difficult,category1,question,explanation\n1,1,初級,会計,誤文,解説");
}, /original/, "必須ヘッダーの欠落を検出できていません");

console.log("CSV validation passed: " + rows.length + " records");
