// Keep the learning screen inside the visible browser area.
// Prevent horizontal overflow and reset accidental horizontal scrolling.
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
      "html body #learnView{position:relative!important;left:auto!important;right:auto!important;" +
      "width:100%!important;max-width:100%!important;margin-left:0!important;margin-right:0!important;" +
      "padding-left:8px!important;padding-right:8px!important;transform:none!important;box-sizing:border-box!important;}" +
      "html body #learnView>.session-header," +
      "html body #learnView>.question-card," +
      "html body #learnView>.feedback-panel{" +
      "position:relative!important;left:auto!important;right:auto!important;" +
      "width:100%!important;max-width:100%!important;" +
      "margin-left:0!important;margin-right:0!important;" +
      "transform:none!important;box-sizing:border-box!important;}" +
      "html body #learnView.four-choice-layout>.question-card," +
      "html body #learnView.four-choice-session>.question-card," +
      "html body #learnView>.question-card.four-choice-card{" +
      "position:relative!important;left:auto!important;right:auto!important;" +
      "width:100%!important;max-width:100%!important;" +
      "margin-left:0!important;margin-right:0!important;transform:none!important;}" +
      "html body #learnView #questionArea," +
      "html body #learnView .choice-list," +
      "html body #learnView .choice-item," +
      "html body #learnView .choice-button{width:100%!important;max-width:100%!important;box-sizing:border-box!important;}" +
      "html body #learnView .choice-text{min-width:0!important;max-width:100%!important;overflow-wrap:break-word!important;word-wrap:break-word!important;}" +
      "@media (max-width:760px){" +
      "html body #learnView{padding-left:6px!important;padding-right:6px!important;}" +
      "html body #learnView>.question-card{padding-left:10px!important;padding-right:10px!important;}" +
      "html body #learnView>.session-header{padding-left:2px!important;padding-right:2px!important;}" +
      "}";

    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      while (style.firstChild) { style.removeChild(style.firstChild); }
      style.appendChild(document.createTextNode(css));
    }
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

  function correctWhenActive() {
    if (!learnIsActive()) { return; }
    resetHorizontalScroll();
    root.setTimeout(resetHorizontalScroll, 0);
    root.setTimeout(resetHorizontalScroll, 80);
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
      observer.observe(learn, { attributes: true, attributeFilter: ["class"] });
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
