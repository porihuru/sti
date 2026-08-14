"use strict";

var assert = require("assert");
var fs = require("fs");
var http = require("http");
var path = require("path");
var root = path.join(__dirname, "..");
var server;

function serve(request, response) {
  var relative = request.url === "/" ? "index.html" : request.url.replace(/^\//, "");
  var filename = path.resolve(root, relative);
  if (filename.indexOf(path.resolve(root)) !== 0) {
    response.writeHead(403);
    response.end();
    return;
  }
  fs.readFile(filename, function (error, data) {
    if (error) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { "Content-Type": relative.slice(-4) === ".csv" ? "text/csv; charset=utf-8" : "text/html; charset=utf-8" });
    response.end(data);
  });
}

function request(port, url) {
  return new Promise(function (resolve, reject) {
    http.get({ hostname: "127.0.0.1", port: port, path: url }, function (response) {
      var chunks = [];
      response.on("data", function (chunk) { chunks.push(chunk); });
      response.on("end", function () {
        resolve({ status: response.statusCode, body: Buffer.concat(chunks) });
      });
    }).on("error", reject);
  });
}

server = http.createServer(serve);
server.listen(0, "127.0.0.1", function () {
  var port = server.address().port;
  Promise.all([request(port, "/index.html"), request(port, "/db/R8db.csv")])
    .then(function (responses) {
      assert.strictEqual(responses[0].status, 200);
      assert.ok(responses[0].body.toString("utf8").indexOf("条文学習室") >= 0);
      assert.strictEqual(responses[1].status, 200);
      assert.ok(responses[1].body.length > 3000000);
      console.log("HTTP smoke test passed");
      server.close();
    })
    .catch(function (error) {
      console.error(error.stack || error.message);
      server.close(function () { process.exit(1); });
    });
});
