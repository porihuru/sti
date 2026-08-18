"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
var jsSource = fs.readFileSync(path.join(root, "js", "ie11.js"), "utf8");
var cssSource = fs.readFileSync(path.join(root, "css", "ie11.css"), "utf8");
var cssWithoutComments = cssSource.replace(/\/\*[\s\S]*?\*\//g, "");

assert.ok(jsSource.indexOf("document.documentMode") >= 0, "IE11判定がありません");
assert.ok(jsSource.indexOf("Element.prototype.scrollIntoView") >= 0, "scrollIntoView互換処理がありません");
assert.ok(jsSource.indexOf("requestAnimationFrame") >= 0, "requestAnimationFrameフォールバックがありません");
assert.ok(jsSource.indexOf("cancelAnimationFrame") >= 0, "cancelAnimationFrameフォールバックがありません");
assert.ok(!/\b(?:let|const)\b/.test(jsSource), "ie11.jsにIE11非対応のlet/constが含まれています");
assert.ok(jsSource.indexOf("=>") < 0, "ie11.jsにIE11非対応のアロー関数が含まれています");
assert.ok(jsSource.indexOf("fetch(") < 0, "ie11.jsにIE11非対応のfetchが含まれています");
assert.ok(!/\bPromise\b/.test(jsSource), "ie11.jsにIE11非対応のPromiseが含まれています");

assert.ok(cssSource.indexOf("-ms-high-contrast") >= 0, "IE11専用CSSのスコープがありません");
assert.ok(cssSource.indexOf("display: -ms-flexbox") >= 0, "IE11用Flexboxフォールバックがありません");
assert.ok(cssWithoutComments.indexOf("var(") < 0, "ie11.cssにCSS変数が含まれています");
assert.ok(!/display\s*:\s*grid\s*;/i.test(cssWithoutComments), "ie11.cssにCSS Gridが含まれています");
assert.ok(!/(^|[;{\s])gap\s*:/i.test(cssWithoutComments), "ie11.cssに未対応のgapが含まれています");
assert.ok(!/\b(?:min|max|clamp)\s*\(/i.test(cssWithoutComments), "ie11.cssに未対応のmin/max/clamp関数が含まれています");
assert.ok(!/(^|[;{\s])inset\s*:/i.test(cssWithoutComments), "ie11.cssに未対応のinsetが含まれています");
assert.ok(!/position\s*:\s*sticky\s*;/i.test(cssWithoutComments), "ie11.cssに未対応のsticky指定が含まれています");

console.log("IE11 compatibility layer validation passed");
