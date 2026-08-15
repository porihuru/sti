"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var localDb = require("../js/local-db.js");
var source = fs.readFileSync(path.join(__dirname, "..", "db", "R8db.csv"), "utf8");
var rows = localDb.parse(source, "R8db.csv");
var sample;
var serialized;
var roundTrip;

assert.strictEqual(rows.length, 2436, "実データを厳格形式で読み込めません");
assert.strictEqual(localDb.dateStamp(new Date(2026, 7, 15)), "2026_08_15");
assert.strictEqual(localDb.outputFilename("m", new Date(2026, 7, 15)), "2026_08_15_m_R8db.csv");

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
assert.throws(function () { localDb.outputFilename("bad/name"); }, /使用できない文字/);

console.log("Local CSV editor validation passed");
