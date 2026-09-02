// Keep the learning screen inside the visible browser area.
// Overrides legacy viewport-centering rules, including !important declarations.
// ES5 / IE11 compatible.
(function (root) {
  "use strict";

  var document = root.document;
  var observer = null;

  if (!document) { return; }

  function installStyles() {
    var head = document.getElementsByTagName("head")[0];
    var style;
    var css;

    if (!head) { return; }

    style = document.getElementById("stiLearnLayoutFixStyle");
    if (!style) {
      style = document.createElement("style");
      style.id = "stiLearnLayoutFixStyle";
      style.type = "text/css";
      head.appendChild(style);
    }

    css =
      "html,body{max-width:100%!important;overflow-x:hidden!important;}" +
      "html body .app-shell{max-width:100%!important;overflow-x:hidden!important;}" +
      "html body main{box-sizing:border-box!important;}" +
      "html body main #learnView{position:relative!important;left:auto!important;right:auto!important;" +
      "width:100%!important;max-width:100%!important;margin-left:0!important;margin-right:0!important;" +
      "padding-left:24px!important;padding-right:24px!important;transform:none!important;box-sizing:border-box!important;}" +
      "html body main #learnView>.session-header," +
      "html body main #learnView>.question-card," +
      "html body main #learnView>.feedback-panel{" +
      "position:relative!important;left:auto!important;right:auto!important;" +
      "width:100%!important;max-width:100%!important;" +
      "margin-left:0!important;margin-right:0!important;" +
      "transform:none!important;box-sizing:border-box!important;}" +
      "html body main #learnView.four-choice-layout>.question-card," +
      "html body main #learnView.four-choice-session>.question-card," +
      "html body main #learnView>.question-card.four-choice-card{" +
      "position:relative!important;left:auto!important;right:auto!important;" +
      "width:100%!important;max-width:100%!important;" +
      "margin-left:0!important;margin-right:0!important;transform:none!important;}" +
      "html body main #learnView.four-choice-layout .question-card-content{" +
      "width:75%!important;max-width:75%!important;box-sizing:border-box!important;}" +
      "html body main #learnView.four-choice-layout .feedback-panel{" +
      "width:25%!important;max-width:25%!important;box-sizing:border-box!important;}" +
      "html body main #learnView #questionArea," +
      "html body main #learnView .choice-list," +
      "html body main #learnView .choice-item," +
      "html body main #learnView .choice-button{width:100%!important;max-width:100%!important;box-sizing:border-box!important;}" +
      "html body main #learnView .choice-text{min-width:0!important;max-width:100%!important;word-wrap:break-word!important;}" +
      "@media (max-width:760px){" +
      "html body main #learnView{padding-left:14px!important;padding-right:14px!important;}" +
      "html body main #learnView.four-choice-layout>.question-card{display:block!important;}" +
      "html body main #learnView.four-choice-layout .question-card-content," +
      "html body main #learnView.four-choice-layout .feedback-panel{width:100%!important;max-width:100%!important;}" +
      "}";

    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      while (style.firstChild) { style.removeChild(style.firstChild); }
      style.appendChild(document.createTextNode(css));
    }
  }

  function setImportant(node, property, value) {
    if (!node || !node.style) { return; }
    try {
      if (node.style.setProperty) {
        node.style.setProperty(property, value, "important");
      } else {
        node.style.cssText += ";" + property + ":" + value + " !important";
      }
    } catch (e) {
      // Layout correction must never affect quiz operation.
    }
  }

  function forceInside(node) {
    if (!node) { return; }
    setImportant(node, "position", "relative");
    setImportant(node, "left", "auto");
    setImportant(node, "right", "auto");
    setImportant(node, "width", "100%");
    setImportant(node, "max-width", "100%");
    setImportant(node, "margin-left", "0");
    setImportant(node, "margin-right", "0");
    setImportant(node, "transform", "none");
    setImportant(node, "box-sizing", "border-box");
  }

  function currentScrollTop() {
    return root.pageYOffset ||
      (document.documentElement ? document.documentElement.scrollTop : 0) ||
      (document.body ? document.body.scrollTop : 0) || 0;
  }

  function resetHorizontalScroll() {
    var top = currentScrollTop();
    try {
      if (document.documentElement) { document.documentElement.scrollLeft = 0; }
      if (document.body) { document.body.scrollLeft = 0; }
      root.scrollTo(0, top);
    } catch (e) {
      // Layout correction must never affect quiz operation.
    }
  }

  function learnIsActive() {
    var learn = document.getElementById("learnView");
    return learn && (" " + learn.className + " ").indexOf(" active ") >= 0;
  }

  function enforceGeometry() {
    var learn = document.getElementById("learnView");
    var header;
    var card;
    var panel;

    if (!learn || !learnIsActive()) { return; }

    setImportant(learn, "position", "relative");
    setImportant(learn, "left", "auto");
    setImportant(learn, "right", "auto");
    setImportant(learn, "width", "100%");
    setImportant(learn, "max-width", "100%");
    setImportant(learn, "margin-left", "0");
    setImportant(learn, "margin-right", "0");
    setImportant(learn, "padding-left", "24px");
    setImportant(learn, "padding-right", "24px");
    setImportant(learn, "transform", "none");
    setImportant(learn, "box-sizing", "border-box");

    header = learn.querySelector ? learn.querySelector(".session-header") : null;
    card = learn.querySelector ? learn.querySelector(".question-card") : null;
    panel = learn.querySelector ? learn.querySelector(".feedback-panel") : null;
    forceInside(header);
    forceInside(card);

    // In four-choice mode the feedback panel lives inside the question card.
    // Do not force it to 100%, because its intended desktop width is 25%.
    if (panel && panel.parentNode === learn) { forceInside(panel); }

    resetHorizontalScroll();
  }

  function correctWhenActive() {
    if (!learnIsActive()) { return; }
    enforceGeometry();
    root.setTimeout(enforceGeometry, 0);
    root.setTimeout(enforceGeometry, 80);
    root.setTimeout(enforceGeometry, 300);
  }

  function init() {
    var learn = document.getElementById("learnView");

    installStyles();
    resetHorizontalScroll();
    correctWhenActive();

    if (root.MutationObserver && learn) {
      observer = new root.MutationObserver(function () {
        correctWhenActive();
      });
      observer.observe(learn, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ["class", "hidden"]
      });
    }

    if (root.addEventListener) {
      root.addEventListener("resize", correctWhenActive, false);
    } else if (root.attachEvent) {
      root.attachEvent("onresize", correctWhenActive);
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
