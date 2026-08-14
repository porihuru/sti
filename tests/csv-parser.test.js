"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var csv = require(path.join(__dirname, "..", "js", "csv.js"));
var source = fs.readFileSync(path.join(__dirname, "..", "db", "R8db.csv"), "utf8");
var rows = csv.parse(source);
var categories = {};
var difficulties = {};
var importance = {};
var ids = {};
var i;

assert.strictEqual(rows.length, 2436, "CSVのレコード数が想定と異なります");
assert.strictEqual(rows[0].id, 1, "先頭IDが1ではありません");
assert.strictEqual(rows[rows.length - 1].id, 2436, "末尾IDが2436ではありません");

for (i = 0; i < rows.length; i += 1) {
  assert.ok(!ids[rows[i].id], "IDが重複しています: " + rows[i].id);
  ids[rows[i].id] = true;
  assert.ok(rows[i].original, "originalが空です: " + rows[i].id);
  assert.ok(rows[i].question, "questionが空です: " + rows[i].id);
  assert.ok(rows[i].explanation, "explanationが空です: " + rows[i].id);
  assert.notStrictEqual(rows[i].original, rows[i].question, "元条文と問題文が同じです: " + rows[i].id);
  categories[rows[i].category] = (categories[rows[i].category] || 0) + 1;
  difficulties[rows[i].difficulty] = (difficulties[rows[i].difficulty] || 0) + 1;
  importance[rows[i].importance] = (importance[rows[i].importance] || 0) + 1;
}

assert.deepStrictEqual(categories, { "会計": 1006, "給与": 940, "旅費": 159, "契約": 331 });
assert.deepStrictEqual(difficulties, { "初級": 238, "中級": 1325, "上級": 873 });
assert.deepStrictEqual(importance, { "1": 1539, "2": 728, "3": 157, "4": 12 });

console.log("CSV validation passed: " + rows.length + " records");
