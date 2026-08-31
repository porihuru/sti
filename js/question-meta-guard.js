// Hide source-record metadata while answering quiz questions.
// Keep metadata visible only in browse mode. ES5 / IE11 compatible.
(function (root) {
  "use strict";

  var document = root.document;
  var observer = null;

  if (!document) { return; }

  function trim(value) {
    return String(value === undefined || value === null ? "" : value).replace(/^\s+|\s+$/g, "");
  }

  function updateVisibility() {
    var label = document.getElementById("sessionModeLabel");
    var meta = document.getElementById("questionMeta");
    var mode;

    if (!meta) { return; }
    mode = label ? trim(label.textContent || label.innerText) : "";

    // The metadata is generated from current.target, which is the answer source.
    // It is therefore shown only for plain article browsing, never while answering.
    meta.style.display = mode === "条文閲覧" ? "" : "none";
    meta.setAttribute("aria-hidden", mode === "条文閲覧" ? "false" : "true");
  }

  function init() {
    var label = document.getElementById("sessionModeLabel");
    var learnView = document.getElementById("learnView");

    updateVisibility();

    if (root.MutationObserver && (label || learnView)) {
      observer = new root.MutationObserver(function () {
        updateVisibility();
      });
      observer.observe(label || learnView, {
        childList: true,
        subtree: true,
        characterData: true
      });
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
