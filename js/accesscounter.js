// STI access counter
// SharePoint access counter is intentionally isolated from the main STI application.
// If SharePoint is unavailable, only "ACCESS 未接続" is shown.
// ES5 / XMLHttpRequest only for IE11 / Edge IE mode compatibility.
(function (root) {
  "use strict";

  var document = root.document;
  var CONFIG_PATH = "config/accesscounter.txt";
  var started = false;
  var countedThisPage = false;
  var valueElement = null;

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

  function readItems(apiRoot, listName, success, error) {
    var title = escapeListTitle(listName);
    var url = apiRoot + "/web/lists/getbytitle('" + title + "')/items?$top=5000&$select=Id,Title,count";

    xhr("GET", url, { "Accept": "application/json;odata=verbose" }, null, function (req) {
      var data;
      var items;
      try {
        data = JSON.parse(req.responseText);
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
        data = JSON.parse(req.responseText);
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
        data = JSON.parse(req.responseText);
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

  function writeCounter(apiRoot, listName, total, next, success, error) {
    getEntityType(apiRoot, listName, function (entityType) {
      getDigest(apiRoot, function (digest) {
        var title = escapeListTitle(listName);
        var url;
        var body;
        var headers = {
          "Accept": "application/json;odata=verbose",
          "Content-Type": "application/json;odata=verbose",
          "X-RequestDigest": digest
        };

        if (total) {
          url = apiRoot + "/web/lists/getbytitle('" + title + "')/items(" + total.Id + ")";
          headers["X-HTTP-Method"] = "MERGE";
          headers["IF-MATCH"] = "*";
          body = JSON.stringify({ "__metadata": { "type": entityType }, "count": next });
        } else {
          url = apiRoot + "/web/lists/getbytitle('" + title + "')/items";
          body = JSON.stringify({ "__metadata": { "type": entityType }, "Title": "total", "count": next });
        }

        xhr("POST", url, headers, body, success, error);
      }, error);
    }, error);
  }

  function runCounter(config) {
    var webRoot = normalizeRoot(config.WEB_ROOT);
    var listName = trim(config.COUNTER_LIST || "stiaccesscounter");
    var apiRoot;

    if (!webRoot || !listName) {
      setDisconnected();
      return;
    }

    apiRoot = webRoot + "/_api";

    readItems(apiRoot, listName, function (items) {
      var total = findTotal(items);
      var current = total ? parseInt(total.count, 10) : 0;
      var next;

      if (isNaN(current) || current < 0) { current = 0; }

      if (countedThisPage) {
        setValue(formatNumber(current));
        return;
      }

      countedThisPage = true;
      next = current + 1;

      writeCounter(apiRoot, listName, total, next, function () {
        setValue(formatNumber(next));
      }, function () {
        setDisconnected();
      });
    }, function () {
      setDisconnected();
    });
  }

  function loadConfig() {
    xhr("GET", CONFIG_PATH + "?v=1", null, null, function (req) {
      var config;
      try {
        config = parseConfig(req.responseText);
        runCounter(config);
      } catch (e) {
        setDisconnected();
      }
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
      loadConfig();
    } catch (e) {
      setDisconnected();
    }
  }

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
