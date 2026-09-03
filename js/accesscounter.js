// STI access counter and encrypted session-start event collector.
// SharePoint access is intentionally isolated from the main STI application.
// If SharePoint is unavailable, only the optional counter is affected.
// ES5 / XMLHttpRequest only for IE11 / Edge IE mode compatibility.
(function (root) {
  "use strict";

  var document = root.document;
  var CONFIG_PATH = "config/accesscounter.txt";
  var started = false;
  var valueElement = null;
  var loadedConfig = null;
  var loadingConfig = false;
  var configWaiters = [];

  if (!document) { return; }

  function trim(value) {
    return String(value === undefined || value === null ? "" : value).replace(/^\s+|\s+$/g, "");
  }

  function setValue(value) {
    if (valueElement) {
      valueElement.innerText = String(value);
    }
  }

  function setDisconnected() {
    setValue("未接続");
  }

  function formatNumber(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function addStyle() {
    var head = document.getElementsByTagName("head")[0];
    var style;
    var css;

    if (!head || document.getElementById("stiAccessCounterStyle")) { return; }

    css =
      ".site-header{position:relative;}" +
      ".sti-access-counter{position:absolute;top:3px;right:14px;z-index:3;" +
      "font-family:\"Yu Gothic UI\",\"Yu Gothic\",Meiryo,sans-serif;font-size:11px;" +
      "font-weight:800;line-height:1.2;letter-spacing:.08em;white-space:nowrap;color:#4f615d;}" +
      ".sti-access-counter-value{margin-left:5px;color:#075e57;font-size:12px;letter-spacing:.02em;}" +
      "@media (max-width:760px){.sti-access-counter{top:2px;right:8px;font-size:10px;}" +
      ".sti-access-counter-value{font-size:10px;}}";

    style = document.createElement("style");
    style.id = "stiAccessCounterStyle";
    style.type = "text/css";
    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
    head.appendChild(style);
  }

  function loadQuestionMetaGuard() {
    var head = document.getElementsByTagName("head")[0];
    var script;

    if (!head || document.getElementById("stiQuestionMetaGuardScript")) { return; }

    try {
      script = document.createElement("script");
      script.id = "stiQuestionMetaGuardScript";
      script.type = "text/javascript";
      script.src = "js/question-meta-guard.js";
      script.async = true;
      script.onerror = function () {};
      head.appendChild(script);
    } catch (e) {
      // Quiz protection failure must not affect the main application.
    }
  }

  function createDisplay() {
    var header = document.querySelector ? document.querySelector(".site-header") : null;
    var wrapper;
    var label;
    var value;

    if (!header) { return false; }

    wrapper = document.getElementById("stiAccessCounter");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.id = "stiAccessCounter";
      wrapper.className = "sti-access-counter";
      wrapper.setAttribute("aria-label", "アクセスカウンター");
      wrapper.setAttribute("aria-live", "polite");

      label = document.createElement("span");
      label.appendChild(document.createTextNode("ACCESS"));

      value = document.createElement("span");
      value.id = "stiAccessCounterValue";
      value.className = "sti-access-counter-value";
      value.appendChild(document.createTextNode("未接続"));

      wrapper.appendChild(label);
      wrapper.appendChild(value);
      header.appendChild(wrapper);
    }

    valueElement = document.getElementById("stiAccessCounterValue");
    return !!valueElement;
  }

  function parseConfig(text) {
    var config = {};
    var lines = String(text || "").split(/\r?\n/);
    var i;
    var line;
    var pos;
    var key;
    var value;

    for (i = 0; i < lines.length; i += 1) {
      line = trim(lines[i]);
      if (!line || line.charAt(0) === "#") { continue; }
      pos = line.indexOf("=");
      if (pos < 1) { continue; }
      key = trim(line.substring(0, pos));
      value = trim(line.substring(pos + 1));
      if (key) { config[key] = value; }
    }
    return config;
  }

  function xhr(method, url, headers, body, success, error) {
    var req;
    var key;
    var finished = false;

    function fail() {
      if (finished) { return; }
      finished = true;
      if (error) { error(req); }
    }

    try {
      req = new XMLHttpRequest();
      req.open(method, url, true);
      req.timeout = 5000;

      if (headers) {
        for (key in headers) {
          if (headers.hasOwnProperty(key)) {
            req.setRequestHeader(key, headers[key]);
          }
        }
      }

      req.onreadystatechange = function () {
        var status;
        if (req.readyState !== 4 || finished) { return; }
        status = req.status === 1223 ? 204 : req.status;
        finished = true;
        if (status >= 200 && status < 300) {
          if (success) { success(req); }
        } else if (error) {
          error(req);
        }
      };
      req.onerror = fail;
      req.ontimeout = fail;
      req.send(body || null);
    } catch (e) {
      fail();
    }
  }

  function parseJson(response) {
    return JSON.parse(response.responseText || "{}");
  }

  function escapeListTitle(title) {
    return String(title || "").replace(/'/g, "''");
  }

  function normalizeRoot(webRoot) {
    var rootPath = trim(webRoot);
    if (rootPath.length > 1 && rootPath.charAt(rootPath.length - 1) === "/") {
      rootPath = rootPath.substring(0, rootPath.length - 1);
    }
    return rootPath;
  }

  function findTotal(items) {
    var i;
    for (i = 0; i < items.length; i += 1) {
      if (String(items[i].Title || "").toLowerCase() === "total") {
        return items[i];
      }
    }
    return null;
  }

  function readItems(apiRoot, listName, select, success, error) {
    var title = escapeListTitle(listName);
    var url = apiRoot + "/web/lists/getbytitle('" + title + "')/items?$top=5000&$select=" + select;

    xhr("GET", url, { "Accept": "application/json;odata=verbose" }, null, function (req) {
      var data;
      var items;
      try {
        data = parseJson(req);
        items = data && data.d && data.d.results ? data.d.results : [];
        success(items);
      } catch (e) {
        error(req);
      }
    }, error);
  }

  function getEntityType(apiRoot, listName, success, error) {
    var title = escapeListTitle(listName);
    var url = apiRoot + "/web/lists/getbytitle('" + title + "')?$select=ListItemEntityTypeFullName";

    xhr("GET", url, { "Accept": "application/json;odata=verbose" }, null, function (req) {
      var data;
      try {
        data = parseJson(req);
        if (!data || !data.d || !data.d.ListItemEntityTypeFullName) {
          error(req);
          return;
        }
        success(data.d.ListItemEntityTypeFullName);
      } catch (e) {
        error(req);
      }
    }, error);
  }

  function getDigest(apiRoot, success, error) {
    xhr("POST", apiRoot + "/contextinfo", { "Accept": "application/json;odata=verbose" }, null, function (req) {
      var data;
      var info;
      try {
        data = parseJson(req);
        info = data && data.d ? data.d.GetContextWebInformation : null;
        if (!info || !info.FormDigestValue) {
          error(req);
          return;
        }
        success(info.FormDigestValue);
      } catch (e) {
        error(req);
      }
    }, error);
  }

  function writeItem(apiRoot, listName, body, success, error) {
    getEntityType(apiRoot, listName, function (entityType) {
      getDigest(apiRoot, function (digest) {
        var title = escapeListTitle(listName);
        var url;
        var headers = {
          "Accept": "application/json;odata=verbose",
          "Content-Type": "application/json;odata=verbose",
          "X-RequestDigest": digest
        };

        url = apiRoot + "/web/lists/getbytitle('" + title + "')/items";
        body.__metadata = { "type": entityType };

        xhr("POST", url, headers, JSON.stringify(body), success, error);
      }, error);
    }, error);
  }

  function readCurrentUser(apiRoot, success, error) {
    xhr("GET", apiRoot + "/web/currentuser?$select=Id,LoginName,Title", {
      "Accept": "application/json;odata=verbose"
    }, null, function (req) {
      var data;
      var user;
      try {
        data = parseJson(req);
        user = data && data.d ? data.d : null;
        if (!user || !user.Id) { error(req); return; }
        success(user);
      } catch (e) {
        error(req);
      }
    }, error);
  }

  function readTotal(apiRoot, listName, success, error) {
    readItems(apiRoot, listName, "Id,Title,count", function (items) {
      var total = findTotal(items);
      var current = total ? parseInt(total.count, 10) : 0;
      if (isNaN(current) || current < 0) { current = 0; }
      success(total, current);
    }, error);
  }

  function incrementTotal(config, success, error) {
    var apiRoot = normalizeRoot(config.WEB_ROOT) + "/_api";
    var listName = trim(config.COUNTER_LIST || "stiaccesscounter");
    if (!normalizeRoot(config.WEB_ROOT) || !listName) { error(); return; }

    readTotal(apiRoot, listName, function (total, current) {
      var body;
      var title = escapeListTitle(listName);
      var next = current + 1;

      if (total) {
        var url = apiRoot + "/web/lists/getbytitle('" + title + "')/items(" + total.Id + ")";
        var headers = {
          "Accept": "application/json;odata=verbose",
          "Content-Type": "application/json;odata=verbose",
          "X-HTTP-Method": "MERGE",
          "IF-MATCH": "*"
        };
        getEntityType(apiRoot, listName, function (entityType) {
          getDigest(apiRoot, function (digest) {
            headers["X-RequestDigest"] = digest;
            body = JSON.stringify({ "__metadata": { "type": entityType }, "count": next });
            xhr("POST", url, headers, body, function () { success(next); }, error);
          }, error);
        }, error);
        return;
      }

      writeItem(apiRoot, listName, { "Title": "total", "count": next }, function () {
        success(next);
      }, error);
    }, error);
  }

  function getSubtle() {
    var crypto = root.crypto || root.msCrypto;
    return crypto && crypto.subtle ? crypto.subtle : null;
  }

  function operationPromise(operation) {
    if (!operation) { return root.Promise.reject(new Error("暗号処理を開始できません。")); }
    if (typeof operation.then === "function") { return operation; }
    return new root.Promise(function (resolve, reject) {
      operation.oncomplete = function () { resolve(operation.result); };
      operation.onerror = function () { reject(new Error("暗号処理に失敗しました。")); };
      operation.onabort = function () { reject(new Error("暗号処理が中断されました。")); };
    });
  }

  function base64ToBytes(value) {
    var binary = root.atob(String(value || "").replace(/\s/g, ""));
    var bytes = new Uint8Array(binary.length);
    var i;
    for (i = 0; i < binary.length; i += 1) { bytes[i] = binary.charCodeAt(i); }
    return bytes;
  }

  function bytesToBase64(bytes) {
    var binary = "";
    var i;
    for (i = 0; i < bytes.length; i += 1) { binary += String.fromCharCode(bytes[i]); }
    return root.btoa(binary);
  }

  function utf8Bytes(value) {
    var encoded = unescape(encodeURIComponent(value));
    var bytes = new Uint8Array(encoded.length);
    var i;
    for (i = 0; i < encoded.length; i += 1) { bytes[i] = encoded.charCodeAt(i); }
    return bytes;
  }

  function publicKeyText(value) {
    return String(value || "")
      .replace(/-----BEGIN PUBLIC KEY-----/g, "")
      .replace(/-----END PUBLIC KEY-----/g, "")
      .replace(/\s/g, "");
  }

  function encryptPayload(config, payload, success, error) {
    var subtle = getSubtle();
    var keyText = publicKeyText(config.ENCRYPTION_PUBLIC_KEY_B64);
    var keyBytes;
    var algorithm = { name: "RSA-OAEP", hash: { name: "SHA-1" } };

    if (!subtle || !root.Promise || !keyText) { error(new Error("暗号化公開鍵またはWeb Crypto APIがありません。")); return; }

    try {
      keyBytes = base64ToBytes(keyText);
      operationPromise(subtle.importKey("spki", keyBytes, algorithm, false, ["encrypt"]))
        .then(function (key) {
          return operationPromise(subtle.encrypt({ name: "RSA-OAEP" }, key, utf8Bytes(JSON.stringify(payload))));
        })
        .then(function (encrypted) {
          success("STI-RSA-OAEP-SHA1-v1:" + bytesToBase64(new Uint8Array(encrypted)));
        })
        .catch(error);
    } catch (e) {
      error(e);
    }
  }

  function makeEventKey() {
    return "session-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000000000);
  }

  function writeSessionEvent(config, encrypted, success, error) {
    var apiRoot = normalizeRoot(config.WEB_ROOT) + "/_api";
    var listName = trim(config.USER_EVENT_LIST || "stiuseraccess");
    var body;

    if (!normalizeRoot(config.WEB_ROOT) || !listName) { error(); return; }
    body = {
      "Title": makeEventKey(),
      "EncryptedPayload": encrypted,
      "SchemaVersion": 1
    };
    writeItem(apiRoot, listName, body, success, error);
  }

  function recordSessionStart(config) {
    var apiRoot = normalizeRoot(config.WEB_ROOT) + "/_api";
    var payload;

    if (!normalizeRoot(config.WEB_ROOT) || !trim(config.USER_EVENT_LIST) || !trim(config.ENCRYPTION_PUBLIC_KEY_B64)) {
      return;
    }

    readCurrentUser(apiRoot, function (user) {
      payload = {
        "eventType": "session_start",
        "userId": String(user.Id),
        "lastAccessUtc": new Date().toISOString()
      };
      encryptPayload(config, payload, function (encrypted) {
        writeSessionEvent(config, encrypted, function () {
          incrementTotal(config, function (next) {
            setValue(formatNumber(next));
          }, function () {
            // The encrypted event is already stored; only the display refresh failed.
          });
        }, function () {
          setDisconnected();
        });
      }, function () {
        setDisconnected();
      });
    }, function () {
      setDisconnected();
    });
  }

  function loadConfig(callback) {
    var i;
    if (loadedConfig) { callback(loadedConfig); return; }
    configWaiters.push(callback);
    if (loadingConfig) { return; }
    loadingConfig = true;
    xhr("GET", CONFIG_PATH + "?v=1", null, null, function (req) {
      var config;
      try {
        config = parseConfig(req.responseText);
        loadedConfig = config;
      } catch (e) {
        loadedConfig = null;
      }
      loadingConfig = false;
      for (i = 0; i < configWaiters.length; i += 1) { configWaiters[i](loadedConfig); }
      configWaiters = [];
    }, function () {
      loadingConfig = false;
      for (i = 0; i < configWaiters.length; i += 1) { configWaiters[i](null); }
      configWaiters = [];
    });
  }

  function refreshDisplay(config) {
    var webRoot = normalizeRoot(config.WEB_ROOT);
    var listName = trim(config.COUNTER_LIST || "stiaccesscounter");
    if (!webRoot || !listName) { setDisconnected(); return; }
    readTotal(webRoot + "/_api", listName, function (total, current) {
      setValue(formatNumber(current));
    }, function () {
      setDisconnected();
    });
  }

  function init() {
    if (started) { return; }
    started = true;

    try {
      loadQuestionMetaGuard();
      addStyle();
      if (!createDisplay()) { return; }
      setDisconnected();
      loadConfig(function (config) {
        if (config) { refreshDisplay(config); }
      });
    } catch (e) {
      setDisconnected();
    }
  }

  root.STIAccessCounter = {
    recordSessionStart: function () {
      loadConfig(function (config) {
        if (config) { recordSessionStart(config); }
      });
    }
  };

  if (document.readyState === "loading") {
    if (root.addEventListener) {
      root.addEventListener("DOMContentLoaded", init, false);
    } else if (root.attachEvent) {
      root.attachEvent("onload", init);
    }
  } else {
    init();
  }
}(this));
