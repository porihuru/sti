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

  function loadOptionalScript(id, src) {
    var head = document.getElementsByTagName("head")[0];
    var script;

    if (!head || document.getElementById(id)) { return; }

    try {
      script = document.createElement("script");
      script.id = id;
      script.type = "text/javascript";
      script.src = src;
      script.async = true;
      script.onerror = function () {};
      head.appendChild(script);
    } catch (e) {
      // Optional UI helpers must never affect the main quiz application.
    }
  }

  function loadSetupQuestionCount() {
    loadOptionalScript("stiSetupQuestionCountScript", "js/setup-question-count.js");
  }

  function loadFourChoiceFeedbackFix() {
    loadOptionalScript("stiFourChoiceFeedbackFixScript", "js/four-choice-feedback-fix.js");
  }

  function loadCsvEditorPassword() {
    loadOptionalScript("stiCsvEditorPasswordScript", "js/csv-editor-password.js");
  }

  function loadLearnLayoutFix() {
    loadOptionalScript("stiLearnLayoutFixScript", "js/learn-layout-fix.js");
  }

  function init() {
    var label = document.getElementById("sessionModeLabel");
    var learnView = document.getElementById("learnView");

    updateVisibility();
    loadSetupQuestionCount();
    loadFourChoiceFeedbackFix();
    loadCsvEditorPassword();
    loadLearnLayoutFix();

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
