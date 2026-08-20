(function (root) {
  "use strict";

  var rowsByQuestion = {};
  var rowsByOriginal = {};
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
    rowsByOriginal = {};
    for (i = 0; i < rows.length; i += 1) {
      row = rows[i];
      if (row && row.question) { rowsByQuestion[trim(row.question)] = row; }
      if (row && row.original) { rowsByOriginal[trim(row.original)] = row; }
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

  function findJudgeButton(target) {
    var node = target;
    while (node && node !== document) {
      if ((" " + node.className + " ").indexOf(" judge-button ") >= 0) { return node; }
      node = node.parentNode;
    }
    return null;
  }

  function isFourChoiceFeedbackMode() {
    var label = byId("sessionModeLabel");
    var value = label ? trim(label.textContent) : "";
    return value === "4択・正しい条文" || value === "4択・誤った条文";
  }

  function isTrueFalseFeedbackMode() {
    var label = byId("sessionModeLabel");
    return label ? trim(label.textContent) === "正誤問題" : false;
  }

  function create(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.appendChild(document.createTextNode(String(text))); }
    return node;
  }

  function addClass(node, className) {
    if (!node || (" " + node.className + " ").indexOf(" " + className + " ") >= 0) { return; }
    node.className += " " + className;
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

  function trueFalseExplanationInfo() {
    var area = byId("questionArea");
    var law = area ? area.querySelector(".law-text") : null;
    var text = law ? trim(law.textContent) : "";
    var row = rowsByQuestion[text];
    var fallback;
    if (row && row.explanation) {
      return { wrong: true, text: row.explanation };
    }
    row = rowsByOriginal[text];
    if (row) {
      return { wrong: false, text: "この条文は正しい条文です。" };
    }
    fallback = byId("feedbackBody");
    return {
      wrong: false,
      text: fallback && trim(fallback.textContent) ? trim(fallback.textContent) : "回答内容を確認してください。"
    };
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

  function createNextButton() {
    var nextWrap = create("div", "inline-next-wrap");
    var nextLabel = byId("nextButton") ? byId("nextButton").textContent : "次の問題へ";
    var next = create("button", "button primary inline-next-button", nextLabel);
    next.type = "button";
    next.addEventListener("click", function () {
      var original = byId("nextButton");
      if (original) { original.click(); }
    });
    nextWrap.appendChild(next);
    return nextWrap;
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
    area.appendChild(createNextButton());
  }

  function renderTrueFalseInlineFeedback(selectedButton) {
    var area = byId("questionArea");
    var panel = byId("feedbackPanel");
    var buttonsContainer;
    var buttons;
    var selectedIsTrue;
    var selectedCorrect;
    var correctIsTrue;
    var i;
    var buttonIsTrue;
    var feedback;
    var status;
    var summary;
    var info;
    var explanation;
    var title;

    if (!area || !selectedButton || !isTrueFalseFeedbackMode()) { return; }
    if (area.querySelector(".inline-truefalse-feedback")) { return; }
    buttonsContainer = area.querySelector(".judge-buttons");
    if (!buttonsContainer) { return; }

    selectedIsTrue = selectedButton.getAttribute("data-judgement") === "true";
    selectedCorrect = panel && (" " + panel.className + " ").indexOf(" correct ") >= 0;
    correctIsTrue = selectedCorrect ? selectedIsTrue : !selectedIsTrue;
    buttons = buttonsContainer.querySelectorAll(".judge-button");

    for (i = 0; i < buttons.length; i += 1) {
      buttonIsTrue = buttons[i].getAttribute("data-judgement") === "true";
      if (buttonIsTrue === correctIsTrue) { addClass(buttons[i], "inline-judge-correct"); }
      if (buttons[i] === selectedButton && !selectedCorrect) { addClass(buttons[i], "inline-judge-wrong"); }
    }

    if (panel) { panel.hidden = true; }

    feedback = create("div", "inline-truefalse-feedback " + (selectedCorrect ? "correct" : "wrong"));
    status = create("div", "inline-choice-status " + (selectedCorrect ? "correct" : "wrong"), selectedCorrect ? "○ 正解" : "× 不正解");
    feedback.appendChild(status);

    summary = create("div", "inline-answer-summary " + (selectedCorrect ? "correct" : "wrong"));
    if (selectedCorrect) {
      summary.appendChild(document.createTextNode("あなたの回答：" + (selectedIsTrue ? "正しい条文" : "誤った条文") + " → 正解"));
    } else {
      summary.appendChild(document.createTextNode(
        "あなたの回答：" + (selectedIsTrue ? "正しい条文" : "誤った条文") +
        " → 不正解　正解：" + (correctIsTrue ? "正しい条文" : "誤った条文")
      ));
    }
    feedback.appendChild(summary);

    info = trueFalseExplanationInfo();
    explanation = create("div", "inline-choice-explanation " + (info.wrong ? "wrong" : "correct"));
    title = create("strong", "inline-choice-explanation-title", info.wrong ? "解説（誤り）" : "解説");
    explanation.appendChild(title);
    explanation.appendChild(create("p", "", info.text));
    feedback.appendChild(explanation);
    feedback.appendChild(createNextButton());

    if (buttonsContainer.nextSibling) {
      area.insertBefore(feedback, buttonsContainer.nextSibling);
    } else {
      area.appendChild(feedback);
    }
  }

  function installStyles() {
    var style;
    if (byId("inlineAnswerFeedbackStyle")) { return; }
    style = document.createElement("style");
    style.id = "inlineAnswerFeedbackStyle";
    style.type = "text/css";
    style.appendChild(document.createTextNode(
      "#setupView{width:94vw!important;margin-left:calc(50% - 47vw)!important;padding-top:6px!important;padding-bottom:10px!important;}" +
      "#setupView .page-heading{display:block!important;margin:0 auto 6px!important;text-align:center!important;}" +
      "#setupView .page-heading .eyebrow{margin-bottom:2px!important;}" +
      "#setupView .page-heading h1{margin:0!important;font-size:30px!important;line-height:1.2!important;}" +
      "#setupView .page-heading>p{margin-top:2px!important;line-height:1.35!important;}" +
      "#setupView .setup-layout{display:-ms-flexbox!important;display:flex!important;-ms-flex-direction:column!important;flex-direction:column!important;width:100%!important;margin:0 auto!important;}" +
      "#setupView .settings-card{display:block!important;width:100%!important;max-width:none!important;margin:0!important;padding:4px 18px!important;box-sizing:border-box!important;}" +
      "#setupView .form-section{padding-top:8px!important;padding-bottom:9px!important;}" +
      "#setupView .form-section h2{margin-bottom:6px!important;font-size:16px!important;line-height:1.25!important;}" +
      "#setupView .form-section h2>span{width:22px!important;height:22px!important;font-size:12px!important;}" +
      "#setupView .mode-options{margin-right:-8px!important;}" +
      "#setupView .mode-option{width:calc(25% - 8px)!important;margin-right:8px!important;margin-bottom:6px!important;}" +
      "#setupView .form-grid>.field{margin-bottom:8px!important;}" +
      "#setupView .field>span{margin-bottom:2px!important;line-height:1.25!important;}" +
      "#setupView .field select,#setupView .field input{min-height:34px!important;padding-top:4px!important;padding-bottom:4px!important;}" +
      "#setupView .count-presets{margin-top:3px!important;}" +
      "#setupView .count-presets button{min-height:28px!important;padding-top:3px!important;padding-bottom:3px!important;}" +
      "#setupView .form-message,#setupView .start-note{margin-top:3px!important;margin-bottom:0!important;line-height:1.3!important;}" +
      "#learnView>.session-header,#learnView>.question-card,#learnView>.feedback-panel{" +
      "position:relative!important;left:50%!important;width:80vw!important;max-width:80vw!important;" +
      "margin-left:-40vw!important;margin-right:0!important;transform:none!important;box-sizing:border-box!important;}" +
      "#learnView>.session-header{display:-ms-flexbox!important;display:flex!important;-ms-flex-wrap:wrap!important;flex-wrap:wrap!important;-ms-flex-align:center!important;align-items:center!important;}" +
      "#learnView>.session-header>div:first-child{min-width:0!important;-ms-flex:1 1 180px!important;flex:1 1 180px!important;}" +
      "#learnView>.session-header .session-progress{min-width:220px!important;-ms-flex:1 1 280px!important;flex:1 1 280px!important;margin-left:16px!important;margin-right:16px!important;}" +
      "#learnView>.session-header .session-header-actions{display:-ms-flexbox!important;display:flex!important;-ms-flex:0 0 auto!important;flex:0 0 auto!important;-ms-flex-wrap:wrap!important;flex-wrap:wrap!important;max-width:100%!important;margin-left:auto!important;margin-right:0!important;box-sizing:border-box!important;}" +
      "#learnView>.session-header .session-header-actions .button{max-width:100%!important;box-sizing:border-box!important;white-space:nowrap!important;}" +
      "#learnView #questionArea,#learnView .choice-list,#learnView .choice-item,#learnView .choice-button{" +
      "width:100%!important;max-width:none!important;box-sizing:border-box!important;}" +
      "#learnView .choice-text{display:block!important;width:100%!important;max-width:none!important;text-align:left!important;}" +
      "#learnView #questionArea>.law-reader{width:calc(100% - 40px)!important;max-width:none!important;margin-left:20px!important;margin-right:20px!important;box-sizing:border-box!important;}" +
      "#learnView #questionArea>.law-reader>.law-text{width:100%!important;max-width:none!important;box-sizing:border-box!important;}" +
      "#learnView .law-reader-actions{margin:0 0 8px!important;}" +
      "#learnView .choice-focus-button{display:block!important;margin:0 0 8px!important;}" +
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
      ".inline-truefalse-feedback{margin:14px 0 4px;padding:12px 14px;background:#fff;border:1px solid #d8d4c8;border-radius:12px;box-sizing:border-box;}" +
      ".judge-button.inline-judge-correct{opacity:1!important;background:#e5f3ef!important;border-color:#087f73!important;}" +
      ".judge-button.inline-judge-wrong{opacity:1!important;background:#f8e4df!important;border-color:#c95c4b!important;}" +
      ".inline-next-wrap{text-align:center;margin:14px 0 4px;}" +
      ".inline-next-button{min-width:220px;}"
    ));
    document.getElementsByTagName("head")[0].appendChild(style);
  }

  function moveFocusButtonsToTop() {
    var area = byId("questionArea");
    var readers;
    var items;
    var actions;
    var law;
    var focusButton;
    var choiceButton;
    var i;

    if (!area) { return; }

    readers = area.querySelectorAll(".law-reader");
    for (i = 0; i < readers.length; i += 1) {
      actions = readers[i].querySelector(".law-reader-actions");
      law = readers[i].querySelector(".law-text");
      if (actions && law && actions.nextSibling !== law) {
        readers[i].insertBefore(actions, law);
      }
    }

    items = area.querySelectorAll(".choice-item");
    for (i = 0; i < items.length; i += 1) {
      focusButton = items[i].querySelector(".choice-focus-button");
      choiceButton = items[i].querySelector(".choice-button");
      if (focusButton && choiceButton && focusButton.nextSibling !== choiceButton) {
        items[i].insertBefore(focusButton, choiceButton);
      }
    }
  }

  function installFocusButtonPositioning() {
    var area = byId("questionArea");
    var observer;
    if (!area) { return; }
    moveFocusButtonsToTop();
    if (root.MutationObserver) {
      observer = new root.MutationObserver(function () { moveFocusButtonsToTop(); });
      observer.observe(area, { childList: true, subtree: true });
    }
  }

  function suppressFeedbackScroll(panel) {
    var originalScroll = panel && panel.scrollIntoView;
    if (panel && originalScroll) {
      suppressing = true;
      panel.scrollIntoView = function () {};
    }
    return originalScroll;
  }

  function restoreFeedbackScroll(panel, originalScroll) {
    if (panel && originalScroll) { panel.scrollIntoView = originalScroll; }
    suppressing = false;
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
    originalScroll = suppressFeedbackScroll(panel);
    root.setTimeout(function () {
      renderInlineFeedback(index);
      restoreFeedbackScroll(panel, originalScroll);
    }, 0);
  }

  function interceptTrueFalseClick(event) {
    var button = findJudgeButton(event.target);
    var panel;
    var originalScroll;
    if (!button || !isTrueFalseFeedbackMode() || button.disabled || suppressing) { return; }

    panel = byId("feedbackPanel");
    originalScroll = suppressFeedbackScroll(panel);
    root.setTimeout(function () {
      renderTrueFalseInlineFeedback(button);
      restoreFeedbackScroll(panel, originalScroll);
    }, 0);
  }

  installStyles();
  wrapLocalDbParse();
  loadServerRows();
  installFocusButtonPositioning();
  document.addEventListener("click", interceptChoiceClick, true);
  document.addEventListener("click", interceptTrueFalseClick, true);
}(this));
