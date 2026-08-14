"use strict";

var assert = require("assert");
var childProcess = require("child_process");
var http = require("http");
var path = require("path");
var blocker = http.createServer(function (request, response) { response.end("occupied"); });
var child = null;
var timeout = null;

function finish(error) {
  if (timeout) { clearTimeout(timeout); }
  if (child && !child.killed) { child.kill(); }
  blocker.close(function () {
    if (error) {
      console.error(error.stack || error.message);
      process.exit(1);
    }
    console.log("Server port fallback validation passed");
  });
}

blocker.listen(0, "127.0.0.1", function () {
  var occupiedPort = blocker.address().port;
  var output = "";
  child = childProcess.spawn(process.execPath, [path.join(__dirname, "..", "server.js"), String(occupiedPort)], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", function (chunk) {
    var match;
    output += chunk.toString("utf8");
    match = /Ready: http:\/\/127\.0\.0\.1:(\d+)\//.exec(output);
    if (match) {
      try {
        assert.strictEqual(parseInt(match[1], 10), occupiedPort + 1);
        assert.ok(output.indexOf("already in use; trying port") >= 0);
        finish();
      } catch (error) {
        finish(error);
      }
    }
  });
  child.stderr.on("data", function (chunk) { output += chunk.toString("utf8"); });
  child.on("exit", function (code) {
    if (code && !child.killed) { finish(new Error("Fallback server exited with code " + code + ": " + output)); }
  });
  timeout = setTimeout(function () { finish(new Error("Fallback server did not start: " + output)); }, 5000);
});
