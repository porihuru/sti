(function () {
  "use strict";

  /* IE11 / Microsoft Edge IE mode only. */
  if (!document.documentMode) { return; }

  document.documentElement.className += " ie11-mode";

  /*
   * IE11 implements the older Boolean form of scrollIntoView().
   * app.js uses the modern options-object form after an answer, so translate
   * that call to the older align-to-top form instead of letting IE interpret
   * an unsupported options object.
   */
  if (window.Element && Element.prototype.scrollIntoView) {
    (function () {
      var nativeScrollIntoView = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (argument) {
        if (argument && typeof argument === "object") {
          nativeScrollIntoView.call(this, true);
          return;
        }
        nativeScrollIntoView.call(this, argument);
      };
    }());
  }

  /* Defensive fallbacks. IE11 normally provides these, but locked-down
     intranet configurations can expose older document behavior. */
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = function (callback) {
      return window.setTimeout(callback, 16);
    };
  }
  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = function (id) {
      window.clearTimeout(id);
    };
  }
}());
