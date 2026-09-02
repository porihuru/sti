// Keep the learning screen inside the visible main area.
// Overrides old viewport-centering rules that could push the left side off-screen.
// ES5 / IE11 compatible.
(function (root) {
  "use strict";

  var document = root.document;

  if (!document) { return; }

  function installStyles() {
    var head = document.getElementsByTagName("head")[0];
    var style;
    var css;

    if (!head || document.getElementById("stiLearnLayoutFixStyle")) { return; }

    css =
      "html body #learnView{width:100%!important;max-width:100%!important;margin-left:0!important;margin-right:0!important;box-sizing:border-box!important;}" +
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
      "left:auto!important;width:100%!important;max-width:100%!important;" +
      "margin-left:0!important;margin-right:0!important;transform:none!important;}" +
      "html body #learnView #questionArea," +
      "html body #learnView .choice-list," +
      "html body #learnView .choice-item," +
      "html body #learnView .choice-button{max-width:100%!important;box-sizing:border-box!important;}" +
      "html body #learnView .choice-text{min-width:0!important;max-width:100%!important;overflow-wrap:break-word!important;word-wrap:break-word!important;}" +
      "@media (max-width:760px){" +
      "html body #learnView>.question-card{padding-left:12px!important;padding-right:12px!important;}" +
      "html body #learnView>.session-header{padding-left:4px!important;padding-right:4px!important;}" +
      "}";

    style = document.createElement("style");
    style.id = "stiLearnLayoutFixStyle";
    style.type = "text/css";
    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
    head.appendChild(style);
  }

  if (document.readyState === "loading") {
    if (root.addEventListener) {
      root.addEventListener("DOMContentLoaded", installStyles, false);
    } else if (root.attachEvent) {
      root.attachEvent("onload", installStyles);
    }
  } else {
    installStyles();
  }
}(this));
