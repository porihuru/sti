// Password gate for the top navigation CSV editor button.
// Client-side UI protection only. ES5 / IE11 compatible.
(function (root) {
  "use strict";

  var document = root.document;
  var PASSWORD = "snk";
  var bypassNextClick = false;
  var lastButton = null;
  var overlay = null;
  var input = null;
  var message = null;

  if (!document) { return; }

  function hasClass(node, className) {
    return node && (" " + node.className + " ").indexOf(" " + className + " ") >= 0;
  }

  function findEditorButton(target) {
    var node = target;
    while (node && node !== document) {
      if (node.tagName && node.tagName.toLowerCase() === "button" &&
          node.getAttribute("data-view") === "editorView") {
        var parent = node.parentNode;
        while (parent && parent !== document) {
          if (hasClass(parent, "main-nav")) { return node; }
          parent = parent.parentNode;
        }
        return null;
      }
      node = node.parentNode;
    }
    return null;
  }

  function installStyles() {
    var head = document.getElementsByTagName("head")[0];
    var style;
    var css;
    if (!head || document.getElementById("csvEditorPasswordStyle")) { return; }

    css =
      ".csv-password-overlay{position:fixed;top:0;right:0;bottom:0;left:0;z-index:3000;display:none;" +
      "align-items:center;justify-content:center;padding:20px;background:rgba(10,29,26,.72);}" +
      ".csv-password-overlay.open{display:-ms-flexbox;display:flex;}" +
      ".csv-password-dialog{width:100%;max-width:390px;padding:24px;background:#fffdf8;border:1px solid #d8d4c8;" +
      "border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.28);font-family:\"Yu Gothic UI\",\"Yu Gothic\",Meiryo,sans-serif;color:#18312d;}" +
      ".csv-password-dialog h2{margin:0 0 8px;font-size:22px;}" +
      ".csv-password-dialog p{margin:0 0 14px;color:#4f615d;font-size:14px;line-height:1.6;}" +
      ".csv-password-input{width:100%;min-height:42px;padding:8px 11px;border:1px solid #b9b5aa;border-radius:8px;box-sizing:border-box;font:inherit;}" +
      ".csv-password-input:focus{outline:3px solid rgba(8,127,115,.22);border-color:#087f73;}" +
      ".csv-password-message{min-height:22px;margin:7px 0 0!important;color:#9b3027!important;font-size:13px!important;font-weight:700;}" +
      ".csv-password-actions{display:-ms-flexbox;display:flex;justify-content:flex-end;margin-top:14px;}" +
      ".csv-password-actions button{min-height:38px;padding:7px 16px;border-radius:999px;font:inherit;font-weight:800;cursor:pointer;}" +
      ".csv-password-cancel{margin-right:8px;background:#fff;border:1px solid #d8d4c8;color:#18312d;}" +
      ".csv-password-submit{border:1px solid #087f73;background:#087f73;color:#fff;}";

    style = document.createElement("style");
    style.id = "csvEditorPasswordStyle";
    style.type = "text/css";
    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
    head.appendChild(style);
  }

  function closeDialog() {
    if (!overlay) { return; }
    overlay.className = "csv-password-overlay";
    overlay.setAttribute("aria-hidden", "true");
    if (input) { input.value = ""; }
    if (message) { message.innerText = ""; }
    if (lastButton && lastButton.focus) { lastButton.focus(); }
  }

  function unlock() {
    if (!input) { return; }
    if (input.value === PASSWORD) {
      var button = lastButton;
      closeDialog();
      if (button) {
        bypassNextClick = true;
        button.click();
      }
    } else {
      message.innerText = "パスワードが違います。";
      input.value = "";
      input.focus();
    }
  }

  function createDialog() {
    var dialog;
    var title;
    var note;
    var actions;
    var cancel;
    var submit;

    if (overlay) { return; }

    overlay = document.createElement("div");
    overlay.id = "csvEditorPasswordOverlay";
    overlay.className = "csv-password-overlay";
    overlay.setAttribute("aria-hidden", "true");

    dialog = document.createElement("div");
    dialog.className = "csv-password-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "csvPasswordTitle");

    title = document.createElement("h2");
    title.id = "csvPasswordTitle";
    title.appendChild(document.createTextNode("CSV編集"));

    note = document.createElement("p");
    note.appendChild(document.createTextNode("CSV編集画面を開くにはパスワードを入力してください。"));

    input = document.createElement("input");
    input.className = "csv-password-input";
    input.type = "password";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("aria-label", "CSV編集パスワード");

    message = document.createElement("p");
    message.className = "csv-password-message";
    message.setAttribute("role", "alert");

    actions = document.createElement("div");
    actions.className = "csv-password-actions";

    cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "csv-password-cancel";
    cancel.appendChild(document.createTextNode("キャンセル"));

    submit = document.createElement("button");
    submit.type = "button";
    submit.className = "csv-password-submit";
    submit.appendChild(document.createTextNode("開く"));

    cancel.onclick = closeDialog;
    submit.onclick = unlock;
    input.onkeydown = function (event) {
      event = event || root.event;
      if (event.keyCode === 13) {
        if (event.preventDefault) { event.preventDefault(); }
        unlock();
      } else if (event.keyCode === 27) {
        if (event.preventDefault) { event.preventDefault(); }
        closeDialog();
      }
    };
    overlay.onclick = function (event) {
      event = event || root.event;
      if ((event.target || event.srcElement) === overlay) { closeDialog(); }
    };

    actions.appendChild(cancel);
    actions.appendChild(submit);
    dialog.appendChild(title);
    dialog.appendChild(note);
    dialog.appendChild(input);
    dialog.appendChild(message);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }

  function openDialog(button) {
    createDialog();
    lastButton = button;
    overlay.className = "csv-password-overlay open";
    overlay.setAttribute("aria-hidden", "false");
    message.innerText = "";
    input.value = "";
    root.setTimeout(function () { input.focus(); }, 0);
  }

  function intercept(event) {
    var button = findEditorButton(event.target || event.srcElement);
    if (!button) { return; }

    if (bypassNextClick) {
      bypassNextClick = false;
      return;
    }

    if (event.preventDefault) { event.preventDefault(); }
    if (event.stopPropagation) { event.stopPropagation(); }
    if (event.stopImmediatePropagation) { event.stopImmediatePropagation(); }
    event.cancelBubble = true;
    openDialog(button);
  }

  function init() {
    installStyles();
    createDialog();
    if (document.addEventListener) {
      document.addEventListener("click", intercept, true);
    } else if (document.attachEvent) {
      document.attachEvent("onclick", intercept);
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
