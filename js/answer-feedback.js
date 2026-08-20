(function (root) {
  "use strict";

  var rowsByQuestion = {};
  var originalParse;
  var suppressing = false;

  function byId(id) { return document.getElementById(id); }

  function trim(value) {
    return String(value === undefined || value === null ? "" : value).replace(/^\s+|\s+$/g, "");
  }

  function cacheRows(rows) {
    var i;
    var row;
    rowsByQuestion = {};
    for (i = 0; i < rows.length; i += 1) {
      row = rows[i];
      if (row && row.question) { rowsByQuestion[trim(row.question)] = row; }
    }
  }

  function wrapLocalDbParse() {
    if (!root.STILocalDb || !root.STILocalDb.parse || root.STILocalDb.parse.__stiFeedbackWrapped) { return; }
    originalParse = root.STILocalDb.parse;
    function wrappedParse(text, filename) {
      var rows = originalParse(text, filename);
      cacheRows(rows);
      return rows;
    }
    wrappedParse.__stiFeedbackWrapped = true;
    root.STILocalDb.parse = wrappedParse;
  }

  function loadServerRows() {
    if (!root.STICsv || !root.STICsv.load) { return; }
    root.STICsv.load("db/R8db.csv", function (rows) { cacheRows(rows); }, function () {});
  }

  function findChoiceButton(target) {
    var node = target;
    while (node && node !== document) {
      if ((" " + node.className + " ").indexOf(" choice-button ") >= 0) { return node; }
      node = node.parentNode;
    }
    return null;
  }

  function isFourCorrectMode() {
    var label = byId("sessionModeLabel");
    return label && trim(label.textContent) === "4択・正しい条文";
  }

  function addClass(node, name) {
    if (!node) { return; }
    if ((" " + node.className + " ").indexOf(" " + name + " ") < 0) {
      node.className += (node.className ? " " : "") + name;
    }
  }

  function create(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.appendChild(document.createTextNode(String(text))); }
    return node;
  }

  function explanationForButton(button) {
    var textNode = button.querySelector(".choice-text");
    var text = textNode ? trim(textNode.textContent) : "";
    var row = rowsByQuestion[text];
    return row && row.explanation ? row.explanation : "この選択肢は正しい条文から変更された誤った条文です。";
  }

  function appendExplanation(choiceItem, button) {
    var box;
    var title;
    if (!choiceItem || choiceItem.querySelector(".inline-choice-explanation")) { return; }
    box = create("div", "inline-choice-explanation");
    title = create("strong", "inline-choice-explanation-title", "解説（誤り）");
    box.appendChild(title);
    box.appendChild(create("p", "", explanationForButton(button)));
    choiceItem.appendChild(box);
  }

  function appendStatus(choiceItem, text, correct) {
    var status;
    if (!choiceItem || choiceItem.querySelector(".inline-choice-status")) { return; }
    status = create("div", "inline-choice-status " + (correct ? "correct" : "wrong"), text);
    choiceItem.appendChild(status);
  }

  function renderInlineFeedback(selectedIndex) {
    var area = byId("questionArea");
    var panel = byId("feedbackPanel");
    var list;
    var items;
    var buttons;
    var selectedButton;
    var selectedCorrect;
    var correctIndex = -1;
    var i;
    var summary;
    var nextWrap;
    var next;
    var nextLabel;

    if (!area || !isFourCorrectMode()) { return; }
    list = area.querySelector(".choice-list");
    if (!list) { return; }
    items = list.querySelectorAll(".choice-item");
    buttons = list.querySelectorAll(".choice-button");
    selectedButton = buttons[selectedIndex];
    if (!selectedButton) { return; }

    for (i = 0; i < buttons.length; i += 1) {
      if ((" " + buttons[i].className + " ").indexOf(" answer-correct ") >= 0) {
        correctIndex = i;
        break;
      }
    }
    selectedCorrect = selectedIndex === correctIndex;

    if (panel) { panel.hidden = true; }
    for (i = 0; i < buttons.length; i += 1) {
      if (i === correctIndex) {
        appendStatus(items[i], "○ 正解", true);
      }
    }

    if (selectedCorrect) {
      for (i = 0; i < buttons.length; i += 1) {
        if (i !== correctIndex) { appendExplanation(items[i], buttons[i]); }
      }
    } else {
      appendStatus(items[selectedIndex], "× 不正解・あなたの回答", false);
      appendExplanation(items[selectedIndex], buttons[selectedIndex]);
    }

    summary = create("div", "inline-answer-summary " + (selectedCorrect ? "correct" : "wrong"));
    if (selectedCorrect) {
      summary.appendChild(document.createTextNode("あなたの回答：" + String.fromCharCode(65 + selectedIndex) + " → 正解"));
    } else {
      summary.appendChild(document.createTextNode("あなたの回答：" + String.fromCharCode(65 + selectedIndex) + " → 不正解　正解：" + String.fromCharCode(65 + correctIndex)));
    }
    area.appendChild(summary);

    nextWrap = create("div", "inline-next-wrap");
    nextLabel = byId("nextButton") ? byId("nextButton").textContent : "次の問題へ";
    next = create("button", "button primary inline-next-button", nextLabel);
    next.type = "button";
    next.addEventListener("click", function () {
      var original = byId("nextButton");
      if (original) { original.click(); }
    });
    nextWrap.appendChild(next);
    area.appendChild(nextWrap);
  }

  function installStyles() {
    var style;
    if (byId("inlineAnswerFeedbackStyle")) { return; }
    style = document.createElement("style");
    style.id = "inlineAnswerFeedbackStyle";
    style.type = "text/css";
    style.appendChild(document.createTextNode(
      ".inline-choice-explanation{margin:8px 0 4px;padding:10px 13px;background:#fdf1ef;border:1px solid #e6bbb3;border-radius:8px;color:#5b302a;}" +
      ".inline-choice-explanation-title{display:block;margin-bottom:4px;color:#a33c31;font-size:13px;}" +
      ".inline-choice-explanation p{margin:0;white-space:pre-wrap;line-height:1.65;}" +
      ".inline-choice-status{margin:5px 4px 0;text-align:right;font-weight:800;font-size:13px;}" +
      ".inline-choice-status.correct{color:#16703f;}" +
      ".inline-choice-status.wrong{color:#a33c31;}" +
      ".inline-answer-summary{margin:14px 0 8px;padding:10px 14px;border-radius:8px;font-weight:800;}" +
      ".inline-answer-summary.correct{color:#116535;background:#e9f5ec;border:1px solid #76b98b;}" +
      ".inline-answer-summary.wrong{color:#9b3027;background:#fdf0ee;border:1px solid #df8d83;}" +
      ".inline-next-wrap{text-align:center;margin:14px 0 4px;}" +
      ".inline-next-button{min-width:220px;}"
    ));
    document.getElementsByTagName("head")[0].appendChild(style);
  }

  function interceptChoiceClick(event) {
    var button = findChoiceButton(event.target);
    var panel;
    var originalScroll;
    var index;
    if (!button || !isFourCorrectMode() || button.disabled || suppressing) { return; }
    index = parseInt(button.getAttribute("data-choice-index"), 10);
    if (isNaN(index)) { return; }

    panel = byId("feedbackPanel");
    originalScroll = panel && panel.scrollIntoView;
    if (panel && originalScroll) {
      suppressing = true;
      panel.scrollIntoView = function () {};
    }
    root.setTimeout(function () {
      renderInlineFeedback(index);
      if (panel && originalScroll) { panel.scrollIntoView = originalScroll; }
      suppressing = false;
    }, 0);
  }

  installStyles();
  wrapLocalDbParse();
  loadServerRows();
  document.addEventListener("click", interceptChoiceClick, true);
}(this));
