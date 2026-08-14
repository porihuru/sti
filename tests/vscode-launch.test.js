"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
var launch = JSON.parse(fs.readFileSync(path.join(root, ".vscode", "launch.json"), "utf8"));
var configuration = launch.configurations[0];

assert.strictEqual(configuration.type, "pwa-node");
assert.strictEqual(configuration.request, "launch");
assert.strictEqual(configuration.program, "${workspaceFolder}/server.js");
assert.ok(configuration.args.indexOf("8000") >= 0);
assert.ok(configuration.args.indexOf("--open-edge") >= 0);
assert.strictEqual(configuration.preLaunchTask, undefined, "ブラウザーへ接続するpreLaunchTaskを使用してはいけません");
assert.ok(fs.existsSync(path.join(root, "server.js")));

console.log("VS Code non-attached Edge launch validation passed");
