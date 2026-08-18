"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var localDbPath = path.join(__dirname, "..", "js", "local-db.js");
var localDbSource = fs.readFileSync(localDbPath, "utf8");
var localDb = require(localDbPath);
var source = fs.readFileSync(path.join(__dirname, "..", "db", "R8db.csv"), "utf8");
var rows = localDb.parse(source, "R8db.csv");
var sample;
var serialized;
var roundTrip;

assert.ok(!/\b(?:let|const)\b/.test(localDbSource), "local-db.jsにIE11非対応のlet/constが含まれています");
assert.ok(localDbSource.indexOf("=>") < 0, "local-db.jsにIE11非対応のアロー関数が含まれています");
assert.ok(localDbSource.indexOf("fetch(") < 0, "local-db.jsにIE11非対応のfetchが含まれています");
assert.ok(!/\bPromise\b/.test(localDbSource), "local-db.jsにIE11非対応のPromiseが含まれています");

assert.strictEqual(rows.length, 2436, "実データを厳格形式で読み込めません");
assert.strictEqual(localDb.dateStamp(new Date(2026, 7, 15)), "2026_08_15");

sample = [rows[0]];
sample[0].notes3 = "カンマ,引用符\"と\n改行";
serialized = localDb.serialize(sample);
roundTrip = localDb.parse(serialized, "2026_08_15_m_R8db.csv");
assert.strictEqual(roundTrip.length, 1);
assert.strictEqual(roundTrip[0].notes3, sample[0].notes3, "CSVの特殊文字を往復できません");

assert.throws(function () { localDb.parse(source, "R8db.txt"); }, /CSV形式/);
assert.throws(function () {
  localDb.parse("id,Importance,difficult\n1,1,初級", "bad.csv");
}, /ヘッダー/);
assert.throws(function () {
  localDb.parse("id,Importance,difficult,category1,category2,original,question,explanation,notes1,notes2,notes3,notes4,notes5\n1,5,初級,会計,法規,正文,誤文,解説,,,,,", "bad.csv");
}, /Importance/);
assert.throws(function () {
  localDb.parse("id,Importance,difficult,category1,category2,original,question,explanation,notes1,notes2,notes3,notes4,notes5\n1,1,初級,会計,法規,正文,誤文,解説,,,,,\n1,1,初級,会計,法規,正文2,誤文2,解説2,,,,,", "bad.csv");
}, /重複/);
assert.throws(function () { localDb.validateNickname("   "); }, /ニックネーム/);
assert.strictEqual(localDb.validateNickname("担当/者"), "担当/者");

console.log("Local CSV editor validation passed");
