// Stabilize four-choice feedback layout and make the result immediately obvious.
// Keeps A-D choices in place, moves explanations below the list, and shows a clear result line.
// ES5 / IE11 compatible.
(function (root) {
  "use strict";

  var document = root.document;

  if (!document) { return; }

  function trim(value) {
    return String(value === undefined || value === null ? "" : value).replace(/^\s+|\s+$/g, "");
  }

  function addClass(node, className) {
    if (!node || (" " + node.className + " ").indexOf(" " + className + " ") >= 0) { return; }
    node.className += " " + className;
  }

  function removeClass(node, className) {
    var value;
    if (!node) { return; }
    value = " " + node.className + " ";
    while (value.indexOf(" " + className + " ") >= 0) {
      value = value.replace(" " + className + " ", " ");
    }
    node.className = trim(value);
  }

  function findChoiceButton(target) {
    var node = target;
    while (node && node !== document) {
      if ((" " + node.className + " ").indexOf(" choice-button ") >= 0) { return node; }
      node = node.parentNode;
    }
    return null;
  }

  function isFourChoiceMode() {
    var label = document.getElementById("sessionModeLabel");
    var value = label ? trim(label.textContent || label.innerText) : "";
    return value === "4択・正しい条文" || value === "4択・誤った条文";
  }

  function installStyles() {
    var head = document.getElementsByTagName("head")[0];
    var style;
    var css;

    if (!head || document.getElementById("fourChoiceFeedbackFixStyle")) { return; }

    css =
      "#learnView .choice-list .inline-choice-explanation{display:none!important;}" +
      "#learnView .question-instruction.four-choice-result{margin-top:8px!important;margin-bottom:14px!important;padding:10px 14px!important;border-radius:10px!important;font-size:22px!important;font-weight:900!important;line-height:1.35!important;}" +
      "#learnView .question-instruction.four-choice-result.correct{color:#116535!important;background:#e9f5ec!important;border:2px solid #76b98b!important;}" +
      "#learnView .question-instruction.four-choice-result.wrong{color:#9b3027!important;background:#fdf0ee!important;border:2px solid #df8d83!important;}" +
      "#learnView .choice-button{position:relative!important;}" +
      "#learnView .choice-button.four-choice-selected-correct{box-shadow:0 0 0 3px rgba(22,112,63,.22)!important;}" +
      "#learnView .choice-button.four-choice-selected-wrong{box-shadow:0 0 0 3px rgba(163,60,49,.22)!important;}" +
      "#learnView .choice-button.four-choice-correct-answer{box-shadow:0 0 0 3px rgba(8,127,115,.18)!important;}" +
      "#learnView .four-choice-result-tag{display:inline-block;margin:0 0 6px;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:900;line-height:1.4;}" +
      "#learnView .four-choice-result-tag.correct{color:#116535;background:#e9f5ec;border:1px solid #76b98b;}" +
      "#learnView .four-choice-result-tag.wrong{color:#9b3027;background:#fdf0ee;border:1px solid #df8d83;}" +
      "#learnView .four-choice-explanation-summary{margin:14px 0 4px;padding:12px 14px;background:#fffaf0;border:1px solid #d8d4c8;border-radius:10px;box-sizing:border-box;}" +
      "#learnView .four-choice-explanation-summary h3{margin:0 0 6px;font-size:15px;}" +
      "#learnView .four-choice-explanation-summary p{margin:5px 0;white-space:pre-wrap;line-height:1.65;}" +
      "@media (max-width:760px){#learnView .question-instruction.four-choice-result{font-size:18px!important;}}";

    style = document.createElement("style");
    style.id = "fourChoiceFeedbackFixStyle";
    style.type = "text/css";
    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
    head.appendChild(style);
  }

  function explanationText(item) {
    var box = item ? item.querySelector(".inline-choice-explanation") : null;
    var paragraph = box ? box.getElementsByTagName("p")[0] : null;
    return paragraph ? trim(paragraph.textContent || paragraph.innerText) : "";
  }

  function removeInlineExplanations(list) {
    var boxes = list ? list.querySelectorAll(".inline-choice-explanation") : [];
    var i;
    for (i = boxes.length - 1; i >= 0; i -= 1) {
      if (boxes[i].parentNode) { boxes[i].parentNode.removeChild(boxes[i]); }
    }
  }

  function removeOldPopup() {
    var popups = document.querySelectorAll(".answer-result-popup");
    var i;
    for (i = popups.length - 1; i >= 0; i -= 1) {
      if (popups[i].parentNode) { popups[i].parentNode.removeChild(popups[i]); }
    }
  }

  function removeOldSummary(area) {
    var old = area ? area.querySelector(".four-choice-explanation-summary") : null;
    if (old && old.parentNode) { old.parentNode.removeChild(old); }
  }

  function createExplanationSummary(area, list, selectedText, correctText, selectedCorrect) {
    var box;
    var heading;
    var p;
    var nextWrap;

    if (!area || !list) { return; }
    if (!selectedText && !correctText) { return; }

    box = document.createElement("div");
    box.className = "four-choice-explanation-summary";
    heading = document.createElement("h3");
    heading.appendChild(document.createTextNode("解説"));
    box.appendChild(heading);

    if (selectedCorrect) {
      p = document.createElement("p");
      p.appendChild(document.createTextNode(correctText || selectedText));
      box.appendChild(p);
    } else {
      if (selectedText) {
        p = document.createElement("p");
        p.appendChild(document.createTextNode("あなたが選んだ選択肢：" + selectedText));
        box.appendChild(p);
      }
      if (correctText && correctText !== selectedText) {
        p = document.createElement("p");
        p.appendChild(document.createTextNode("正解の選択肢：" + correctText));
        box.appendChild(p);
      }
    }

    nextWrap = area.querySelector(".inline-next-wrap");
    if (nextWrap) {
      area.insertBefore(box, nextWrap);
    } else {
      area.appendChild(box);
    }
  }

  function applyFeedback(selectedButton) {
    var area = document.getElementById("questionArea");
    var instruction = document.getElementById("questionInstruction");
    var list;
    var items;
    var buttons;
    var selectedIndex = -1;
    var correctIndex = -1;
    var selectedCorrect;
    var selectedText = "";
    var correctText = "";
    var tag;
    var i;

    if (!area || !instruction || !selectedButton || !isFourChoiceMode()) { return; }
    list = area.querySelector(".choice-list");
    if (!list) { return; }
    items = list.querySelectorAll(".choice-item");
    buttons = list.querySelectorAll(".choice-button");

    for (i = 0; i < buttons.length; i += 1) {
      removeClass(buttons[i], "four-choice-selected-correct");
      removeClass(buttons[i], "four-choice-selected-wrong");
      removeClass(buttons[i], "four-choice-correct-answer");
      if (buttons[i] === selectedButton) { selectedIndex = i; }
      if ((" " + buttons[i].className + " ").indexOf(" answer-correct ") >= 0) { correctIndex = i; }
    }

    if (selectedIndex < 0 || correctIndex < 0) { return; }
    selectedCorrect = selectedIndex === correctIndex;
    selectedText = explanationText(items[selectedIndex]);
    correctText = explanationText(items[correctIndex]);

    instruction.className = "question-instruction four-choice-result " + (selectedCorrect ? "correct" : "wrong");
    instruction.textContent = selectedCorrect ?
      "○ 正解です　あなたの回答：" + String.fromCharCode(65 + selectedIndex) :
      "× 不正解です　あなたの回答：" + String.fromCharCode(65 + selectedIndex) + "　正解：" + String.fromCharCode(65 + correctIndex);

    if (selectedCorrect) {
      addClass(buttons[selectedIndex], "four-choice-selected-correct");
      tag = document.createElement("span");
      tag.className = "four-choice-result-tag correct";
      tag.appendChild(document.createTextNode("あなたの回答・正解"));
      items[selectedIndex].insertBefore(tag, items[selectedIndex].firstChild);
    } else {
      addClass(buttons[selectedIndex], "four-choice-selected-wrong");
      addClass(buttons[correctIndex], "four-choice-correct-answer");

      tag = document.createElement("span");
      tag.className = "four-choice-result-tag wrong";
      tag.appendChild(document.createTextNode("あなたの回答・不正解"));
      items[selectedIndex].insertBefore(tag, items[selectedIndex].firstChild);

      tag = document.createElement("span");
      tag.className = "four-choice-result-tag correct";
      tag.appendChild(document.createTextNode("正解"));
      items[correctIndex].insertBefore(tag, items[correctIndex].firstChild);
    }

    removeInlineExplanations(list);
    removeOldPopup();
    removeOldSummary(area);
    createExplanationSummary(area, list, selectedText, correctText, selectedCorrect);
  }

  function cleanupForNewQuestion() {
    var instruction = document.getElementById("questionInstruction");
    var area = document.getElementById("questionArea");
    var text = instruction ? trim(instruction.textContent || instruction.innerText) : "";
    var tags;
    var i;

    if (!instruction || text.indexOf("4つのうち") !== 0) { return; }
    instruction.className = "question-instruction";
    if (!area) { return; }
    tags = area.querySelectorAll(".four-choice-result-tag");
    for (i = tags.length - 1; i >= 0; i -= 1) {
      if (tags[i].parentNode) { tags[i].parentNode.removeChild(tags[i]); }
    }
    removeOldSummary(area);
  }

  function init() {
    var instruction = document.getElementById("questionInstruction");
    var observer;

    installStyles();

    document.addEventListener("click", function (event) {
      var button = findChoiceButton(event.target);
      if (!button || !isFourChoiceMode() || button.disabled) { return; }
      root.setTimeout(function () { applyFeedback(button); }, 0);
    }, true);

    if (root.MutationObserver && instruction) {
      observer = new root.MutationObserver(function () { cleanupForNewQuestion(); });
      observer.observe(instruction, { childList: true, subtree: true, characterData: true });
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
