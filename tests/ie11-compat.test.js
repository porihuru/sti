"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
var jsSource = fs.readFileSync(path.join(root, "js", "ie11.js"), "utf8");
var cssSource = fs.readFileSync(path.join(root, "css", "ie11.css"), "utf8");
var indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
var cssWithoutComments = cssSource.replace(/\/\*[\s\S]*?\*\//g, "");

function between(source, startText, endText) {
  var start = source.indexOf(startText);
  var end;
  assert.ok(start >= 0, startText + " が見つかりません");
  end = source.indexOf(endText, start + startText.length);
  assert.ok(end > start, endText + " が見つかりません");
  return source.substring(start, end);
}

assert.ok(jsSource.indexOf("document.documentMode") >= 0, "IE11判定がありません");
assert.ok(jsSource.indexOf("Element.prototype.scrollIntoView") >= 0, "scrollIntoView互換処理がありません");
assert.ok(jsSource.indexOf("requestAnimationFrame") >= 0, "requestAnimationFrameフォールバックがありません");
assert.ok(jsSource.indexOf("cancelAnimationFrame") >= 0, "cancelAnimationFrameフォールバックがありません");
assert.ok(jsSource.indexOf("function SimplePromise") >= 0, "IE11用Promise互換実装がありません");
assert.ok(jsSource.indexOf("window.Promise = SimplePromise") >= 0, "IE11用Promise互換実装が登録されていません");
assert.ok(jsSource.indexOf("window.showOpenFilePicker") >= 0, "IE11用CSVファイル選択互換処理がありません");
assert.ok(jsSource.indexOf("window.FileReader") >= 0, "IE11用FileReader確認がありません");
assert.ok(jsSource.indexOf("navigator.msSaveBlob") >= 0, "IE11用CSV保存処理がありません");
assert.ok(jsSource.indexOf("function setupIeBatchEditor()") >= 0, "IEモード一括編集処理がありません");
assert.ok(!/\b(?:let|const)\b/.test(jsSource), "ie11.jsにIE11非対応のlet/constが含まれています");
assert.ok(jsSource.indexOf("=>") < 0, "ie11.jsにIE11非対応のアロー関数が含まれています");
assert.ok(jsSource.indexOf("fetch(") < 0, "ie11.jsにIE11非対応のfetchが含まれています");

assert.ok(jsSource.indexOf('batch.status[String(row.id)] = "added"') >= 0, "追加状態の記録処理がありません");
assert.ok(jsSource.indexOf('batch.status[String(row.id)] = "edited"') >= 0, "編集状態の記録処理がありません");
assert.ok(jsSource.indexOf('batch.status[String(row.id)] = "deleted"') >= 0, "削除予定状態の記録処理がありません");
assert.ok(jsSource.indexOf('return "【追加】"') >= 0, "追加レコードの一覧表示がありません");
assert.ok(jsSource.indexOf('return "【編集】"') >= 0, "編集レコードの一覧表示がありません");
assert.ok(jsSource.indexOf('return "【削除予定】"') >= 0, "削除予定レコードの一覧表示がありません");
assert.ok(jsSource.indexOf('textContent = deleted ? "削除を取り消す" : "削除"') >= 0, "削除予定の取消操作がありません");
assert.ok(jsSource.indexOf('byId("editorAddedCount").textContent = added') >= 0, "追加件数表示がありません");
assert.ok(jsSource.indexOf('byId("editorEditedCount").textContent = edited') >= 0, "編集件数表示がありません");
assert.ok(jsSource.indexOf('byId("editorDeletedCount").textContent = deleted') >= 0, "削除件数表示がありません");
assert.ok(jsSource.indexOf('byId("saveAllCsvButton").disabled = added + edited + deleted === 0') >= 0, "一括保存ボタンの状態制御がありません");

var commitCurrentSource = between(jsSource, "function commitCurrent()", "function startAdd()");
var toggleDeleteSource = between(jsSource, "function toggleDelete()", "function navigate(direction)");
var saveAllSource = between(jsSource, "function saveAll()", "function editorField(target)");
assert.ok(commitCurrentSource.indexOf("createWritable") < 0, "1レコード確定時にCSVへ直接書き込んでいます");
assert.ok(toggleDeleteSource.indexOf("createWritable") < 0, "削除予定設定時にCSVへ直接書き込んでいます");
assert.ok(saveAllSource.indexOf("activeRows()") >= 0, "一括保存時に削除予定を除外する処理がありません");
assert.ok(saveAllSource.indexOf("STILocalDb.serialize(rows)") >= 0, "一括保存用CSVの生成処理がありません");
assert.ok(saveAllSource.indexOf("createWritable") >= 0, "CSVを保存するときの書き込み開始処理がありません");
assert.ok(saveAllSource.indexOf("writable.write(text)") >= 0, "CSVを保存するときの書き込み処理がありません");

assert.ok(indexSource.indexOf('id="editorRecordList"') >= 0, "色分けレコード一覧領域がありません");
assert.ok(indexSource.indexOf('id="editorAddedCount"') >= 0, "追加件数表示領域がありません");
assert.ok(indexSource.indexOf('id="editorEditedCount"') >= 0, "編集件数表示領域がありません");
assert.ok(indexSource.indexOf('id="editorDeletedCount"') >= 0, "削除件数表示領域がありません");
assert.ok(indexSource.indexOf('id="saveAllCsvButton"') >= 0, "CSV一括保存ボタンがありません");
assert.ok(indexSource.indexOf("compact-editor-fields-all") >= 0, "短い入力項目のコンパクト配置がありません");

assert.ok(cssSource.indexOf("-ms-high-contrast") >= 0, "IE11専用CSSのスコープがありません");
assert.ok(cssSource.indexOf("display: -ms-flexbox") >= 0, "IE11用Flexboxフォールバックがありません");
assert.ok(cssWithoutComments.indexOf("var(") < 0, "ie11.cssにCSS変数が含まれています");
assert.ok(!/display\s*:\s*grid\s*;/i.test(cssWithoutComments), "ie11.cssにCSS Gridが含まれています");
assert.ok(!/(^|[;{\s])gap\s*:/i.test(cssWithoutComments), "ie11.cssに未対応のgapが含まれています");
assert.ok(!/\b(?:min|max|clamp)\s*\(/i.test(cssWithoutComments), "ie11.cssに未対応のmin/max/clamp関数が含まれています");
assert.ok(!/(^|[;{\s])inset\s*:/i.test(cssWithoutComments), "ie11.cssに未対応のinsetが含まれています");
assert.ok(!/position\s*:\s*sticky\s*;/i.test(cssWithoutComments), "ie11.cssに未対応のsticky指定が含まれています");
assert.ok(cssSource.indexOf("border: 11px solid #dcece7;") >= 0, "IE11用の正答率リング境界線がありません");
assert.ok(cssSource.indexOf("border-left: 5px solid #244a61;") >= 0, "IE11用の条文左境界線がありません");
assert.ok(cssSource.indexOf("border-top: 6px solid #087f73;") >= 0, "IE11用の正解パネル上境界線がありません");
assert.ok(cssSource.indexOf("border-top: 6px solid #c95c4b;") >= 0, "IE11用の不正解パネル上境界線がありません");
assert.ok(cssSource.indexOf(".record-status-added { background: #e6f4ea;") >= 0, "追加レコードの色分けCSSがありません");
assert.ok(cssSource.indexOf(".record-status-edited { background: #fff3cd;") >= 0, "編集レコードの色分けCSSがありません");
assert.ok(cssSource.indexOf(".record-status-deleted { background: #fde8e7;") >= 0, "削除予定レコードの色分けCSSがありません");
assert.ok(cssSource.indexOf("max-height: 520px;") >= 0, "レコード一覧の内部スクロール上限がありません");
assert.ok(cssSource.indexOf("max-height: 180px;") >= 0, "長文入力欄の内部スクロール上限がありません");
assert.ok(cssSource.indexOf(".compact-field-id") >= 0, "ID欄のコンパクト配置CSSがありません");
assert.ok(cssSource.indexOf(".compact-field-short") >= 0, "重要度・難易度欄のコンパクト配置CSSがありません");

console.log("IE11 compatibility and batch CSV editor validation passed");
