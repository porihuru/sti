(function (root) {
  "use strict";

  var SUMMARY_COOKIE = "sti_summary";
  var WEAK_COOKIE = "sti_weak";
  var SETTINGS_COOKIE = "sti_settings";
  var DISPLAY_COOKIE = "sti_display";
  var COOKIE_DAYS = 365;
  var MAX_WEAK_ITEMS = 160;
  var MAX_WEAK_LENGTH = 3000;
  var previewMode = false;

  var categoryIndex = { "会計": 0, "給与": 1, "旅費": 2, "契約": 3 };
  var difficultyIndex = { "初級": 0, "中級": 1, "上級": 2 };
  var modeIndex = { trueFalse: 0, fourCorrect: 1, fourWrong: 2 };

  function historyCookieName(name) {
    return previewMode ? "sti_preview_" + name.substring(4) : name;
  }

  function emptySummary() {
    return {
      v: 1,
      t: 0,
      c: 0,
      w: 0,
      m: [[0, 0], [0, 0], [0, 0]],
      g: [[0, 0], [0, 0], [0, 0], [0, 0]],
      d: [[0, 0], [0, 0], [0, 0]],
      i: [[0, 0], [0, 0], [0, 0], [0, 0]]
    };
  }

  function getCookie(name) {
    var prefix = name + "=";
    var parts = document.cookie ? document.cookie.split(";") : [];
    var i;
    var part;
    for (i = 0; i < parts.length; i += 1) {
      part = parts[i].replace(/^\s+/, "");
      if (part.indexOf(prefix) === 0) {
        try {
          return decodeURIComponent(part.substring(prefix.length));
        } catch (error) {
          return "";
        }
      }
    }
    return "";
  }

  function setCookie(name, value) {
    var expires = new Date();
    var cookie;
    expires.setTime(expires.getTime() + COOKIE_DAYS * 24 * 60 * 60 * 1000);
    cookie = name + "=" + encodeURIComponent(value) + "; expires=" + expires.toUTCString() + "; path=/; SameSite=Lax";
    if (window.location.protocol === "https:") {
      cookie += "; Secure";
    }
    document.cookie = cookie;
  }

  function deleteCookie(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax";
  }

  function safeParse(value, fallback) {
    if (!value) {
      return fallback;
    }
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function isPair(value) {
    return value && value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number";
  }

  function isValidSummary(value) {
    var groups;
    var i;
    var j;
    if (!value || value.v !== 1 || typeof value.t !== "number" || typeof value.c !== "number" || typeof value.w !== "number") {
      return false;
    }
    groups = [value.m, value.g, value.d, value.i];
    for (i = 0; i < groups.length; i += 1) {
      if (!groups[i] || !groups[i].length) {
        return false;
      }
      for (j = 0; j < groups[i].length; j += 1) {
        if (!isPair(groups[i][j])) {
          return false;
        }
      }
    }
    return true;
  }

  function loadSummary() {
    var summary = safeParse(getCookie(historyCookieName(SUMMARY_COOKIE)), null);
    return isValidSummary(summary) ? summary : emptySummary();
  }

  function parseWeak() {
    var value = getCookie(historyCookieName(WEAK_COOKIE));
    var result = {};
    var items;
    var i;
    var fields;
    var id;
    if (!value) {
      return result;
    }
    items = value.split("_");
    for (i = 0; i < items.length; i += 1) {
      fields = items[i].split(".");
      if (fields.length !== 3) {
        continue;
      }
      id = parseInt(fields[0], 36);
      if (id > 0) {
        result[id] = {
          wrong: parseInt(fields[1], 36) || 0,
          correct: parseInt(fields[2], 36) || 0
        };
      }
    }
    return result;
  }

  function weakScore(item) {
    return item.wrong * 2 - item.correct;
  }

  function serializeWeak(weak) {
    var items = [];
    var id;
    var output = [];
    var candidate;
    var i;
    for (id in weak) {
      if (Object.prototype.hasOwnProperty.call(weak, id) && weakScore(weak[id]) > 0) {
        items.push({ id: parseInt(id, 10), wrong: weak[id].wrong, correct: weak[id].correct });
      }
    }
    items.sort(function (a, b) {
      var scoreDifference = weakScore(b) - weakScore(a);
      return scoreDifference || b.wrong - a.wrong || a.id - b.id;
    });
    items = items.slice(0, MAX_WEAK_ITEMS);
    for (i = 0; i < items.length; i += 1) {
      candidate = items[i].id.toString(36) + "." + items[i].wrong.toString(36) + "." + items[i].correct.toString(36);
      if ((output.join("_") + (output.length ? "_" : "") + candidate).length > MAX_WEAK_LENGTH) {
        break;
      }
      output.push(candidate);
    }
    return output.join("_");
  }

  function incrementPair(pair, correct) {
    pair[correct ? 0 : 1] += 1;
  }

  function record(row, mode, correct) {
    var summary = loadSummary();
    var weak = parseWeak();
    var cIndex = categoryIndex[row.category];
    var dIndex = difficultyIndex[row.difficulty];
    var mIndex = modeIndex[mode];
    var iIndex = row.importance - 1;

    summary.t += 1;
    summary[correct ? "c" : "w"] += 1;
    if (mIndex !== undefined) { incrementPair(summary.m[mIndex], correct); }
    if (cIndex !== undefined) { incrementPair(summary.g[cIndex], correct); }
    if (dIndex !== undefined) { incrementPair(summary.d[dIndex], correct); }
    if (iIndex >= 0 && iIndex < summary.i.length) { incrementPair(summary.i[iIndex], correct); }

    if (!correct) {
      if (!weak[row.id]) { weak[row.id] = { wrong: 0, correct: 0 }; }
      weak[row.id].wrong += 1;
    } else if (weak[row.id]) {
      weak[row.id].correct += 1;
      if (weakScore(weak[row.id]) <= 0) {
        delete weak[row.id];
      }
    }

    setCookie(historyCookieName(SUMMARY_COOKIE), JSON.stringify(summary));
    setCookie(historyCookieName(WEAK_COOKIE), serializeWeak(weak));
  }

  function getWeakList() {
    var weak = parseWeak();
    var list = [];
    var id;
    for (id in weak) {
      if (Object.prototype.hasOwnProperty.call(weak, id) && weakScore(weak[id]) > 0) {
        list.push({
          id: parseInt(id, 10),
          wrong: weak[id].wrong,
          correct: weak[id].correct,
          score: weakScore(weak[id])
        });
      }
    }
    list.sort(function (a, b) { return b.score - a.score || b.wrong - a.wrong || a.id - b.id; });
    return list;
  }

  function saveSettings(settings) {
    var compact = {
      m: settings.mode,
      g: settings.category,
      r: settings.relatedGroup || "all",
      i: settings.importance,
      d: settings.difficulty,
      o: settings.order,
      n: settings.count,
      s: settings.startValue
    };
    setCookie(historyCookieName(SETTINGS_COOKIE), JSON.stringify(compact));
  }

  function loadSettings() {
    return safeParse(getCookie(historyCookieName(SETTINGS_COOKIE)), null);
  }

  function saveDisplay(size) {
    if (size === "small" || size === "medium" || size === "large") {
      setCookie(DISPLAY_COOKIE, size);
    }
  }

  function loadDisplay() {
    var size = getCookie(DISPLAY_COOKIE);
    return size === "small" || size === "large" ? size : "medium";
  }

  function reset() {
    deleteCookie(historyCookieName(SUMMARY_COOKIE));
    deleteCookie(historyCookieName(WEAK_COOKIE));
    deleteCookie(historyCookieName(SETTINGS_COOKIE));
  }

  function usePreview(enabled) {
    previewMode = !!enabled;
  }

  function isPreview() {
    return previewMode;
  }

  function cookiesAvailable() {
    var name = "sti_cookie_test";
    setCookie(name, "1");
    if (getCookie(name) !== "1") {
      return false;
    }
    deleteCookie(name);
    return true;
  }

  root.STIHistory = {
    record: record,
    summary: loadSummary,
    weakList: getWeakList,
    saveSettings: saveSettings,
    loadSettings: loadSettings,
    saveDisplay: saveDisplay,
    loadDisplay: loadDisplay,
    reset: reset,
    usePreview: usePreview,
    isPreview: isPreview,
    cookiesAvailable: cookiesAvailable
  };
}(this));
