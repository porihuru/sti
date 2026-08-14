"use strict";

var fs = require("fs");
var http = require("http");
var path = require("path");
var childProcess = require("child_process");
var root = path.resolve(__dirname);
var requestedPort = parseInt(process.argv[2], 10) || 8000;
var port = requestedPort;
var maximumPort = requestedPort + 20;
var host = "127.0.0.1";
var shouldOpenEdge = process.argv.indexOf("--open-edge") >= 0;
var mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

function safeFilename(requestUrl) {
  var pathname;
  var filename;
  try {
    pathname = decodeURIComponent(String(requestUrl || "/").split("?")[0]);
  } catch (error) {
    return null;
  }
  if (pathname === "/") { pathname = "/index.html"; }
  filename = path.resolve(root, pathname.replace(/^\/+/, ""));
  if (filename !== root && filename.indexOf(root + path.sep) !== 0) { return null; }
  return filename;
}

function send(response, status, body, type) {
  response.writeHead(status, {
    "Content-Type": type || "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(body);
}

function serve(request, response) {
  var filename = safeFilename(request.url);
  if (!filename) {
    send(response, 403, "Forbidden");
    return;
  }
  fs.stat(filename, function (statError, stat) {
    if (statError || !stat.isFile()) {
      send(response, 404, "Not Found");
      return;
    }
    fs.readFile(filename, function (readError, data) {
      if (readError) {
        send(response, 500, "Internal Server Error");
        return;
      }
      send(response, 200, data, mimeTypes[path.extname(filename).toLowerCase()] || "application/octet-stream");
    });
  });
}

function openEdge(url) {
  var candidates = [];
  var programFilesX86 = process.env["ProgramFiles(x86)"];
  var programFiles = process.env.ProgramFiles;
  var localAppData = process.env.LOCALAPPDATA;
  var i;
  var browser;

  if (programFilesX86) { candidates.push(path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe")); }
  if (programFiles) { candidates.push(path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe")); }
  if (localAppData) { candidates.push(path.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe")); }

  for (i = 0; i < candidates.length; i += 1) {
    if (fs.existsSync(candidates[i])) {
      try {
        browser = childProcess.spawn(candidates[i], [url], { detached: true, stdio: "ignore" });
        browser.unref();
        console.log("Opened Microsoft Edge without debugger attachment");
        return;
      } catch (error) {
        console.error("Microsoft Edge could not be opened: " + error.message);
        return;
      }
    }
  }
  console.error("Microsoft Edge was not found. Open " + url + " manually.");
}

console.log("Starting local server");
var server = http.createServer(serve);
server.on("error", function (error) {
  if (error.code === "EADDRINUSE") {
    if (port < maximumPort) {
      console.log("Port " + port + " is already in use; trying port " + (port + 1));
      port += 1;
      setTimeout(function () { server.listen(port, host); }, 50);
      return;
    }
    console.error("Ports " + requestedPort + " through " + maximumPort + " are already in use.");
  } else {
    console.error(error.message);
  }
  process.exit(1);
});
server.listen(port, host, function () {
  var url = "http://" + host + ":" + port + "/";
  console.log("Ready: " + url);
  if (shouldOpenEdge) { openEdge(url); }
});

function stop() {
  if (server.listening) {
    server.close(function () { process.exit(0); });
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
