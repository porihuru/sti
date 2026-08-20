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

  function isFourChoiceFeedbackMode() {
    var label = byId("sessionModeLabel");
    var value = label ? trim(label.textContent) : "";
    return value === "4択・正しい条文" || value === "4択・誤った条文";
  }

  function create(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.appendChild(document.createTextNode(String(text))); }
    return node;
  }

  function explanationInfoForButton(button) {
    var textNode = button.querySelector(".choice-text");
    var text = textNode ? trim(textNode.textContent) : "";
    var row = rowsByQuestion[text];
    if (row && row.explanation) {
      return { wrong: true, text: row.explanation };
    }
    return { wrong: false, text: "この選択肢は正しい条文です。" };
  }

  function appendExplanation(choiceItem, button) {
    var box;
    var title;
    var info;
    if (!choiceItem || choiceItem.querySelector(".inline-choice-explanation")) { return; }
    info = explanationInfoForButton(button);
    box = create("div", "inline-choice-explanation " + (info.wrong ? "wrong" : "correct"));
    title = create("strong", "inline-choice-explanation-title", info.wrong ? "解説（誤り）" : "解説");
    box.appendChild(title);
    box.appendChild(create("p", "", info.text));
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

    if (!area || !isFourChoiceFeedbackMode()) { return; }
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
      } else if (i === selectedIndex) {
        appendStatus(items[i], "× 不正解・あなたの回答", false);
      }
      appendExplanation(items[i], buttons[i]);
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
      "#learnView>.session-header,#learnView>.question-card,#learnView>.feedback-panel{" +
      "position:relative!important;left:50%!important;width:80vw!important;max-width:80vw!important;" +
      "margin-left:-40vw!important;margin-right:0!important;transform:none!important;box-sizing:border-box!important;}" +
      "#learnView #questionArea,#learnView .choice-list,#learnView .choice-item,#learnView .choice-button{" +
      "width:100%!important;max-width:none!important;box-sizing:border-box!important;}" +
      "#learnView .choice-text{display:block!important;width:100%!important;max-width:none!important;text-align:left!important;}" +
      ".inline-choice-explanation{margin:8px 0 10px;padding:10px 13px;border-radius:8px;}" +
      ".inline-choice-explanation.wrong{background:#fdf1ef;border:1px solid #e6bbb3;color:#5b302a;}" +
      ".inline-choice-explanation.correct{background:#edf8f0;border:1px solid #9dcaaa;color:#245c35;}" +
      ".inline-choice-explanation-title{display:block;margin-bottom:4px;font-size:13px;}" +
      ".inline-choice-explanation.wrong .inline-choice-explanation-title{color:#a33c31;}" +
      ".inline-choice-explanation.correct .inline-choice-explanation-title{color:#16703f;}" +
      ".inline-choice-explanation p{margin:0;white-space:pre-wrap;line-height:1.65;}" +
      ".inline-choice-status{margin:10px 0 6px!important;text-align:left!important;font-weight:800!important;font-size:39px!important;line-height:1.1!important;}" +
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
    if (!button || !isFourChoiceFeedbackMode() || button.disabled || suppressing) { return; }
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
