(function () {
  "use strict";

  var state = {
    rows: [],
    rowsById: {},
    serverRows: [],
    ready: false,
    session: null,
    lastConfig: null,
    savedRelatedGroup: "all",
    previewMode: false,
    dataLabel: "R8db.csv",
    editor: {
      rows: [],
      filename: "",
      outputFilename: "",
      nickname: "",
      fileHandle: null,
      currentId: null,
      previousId: null,
      isNew: false,
      dirty: false,
      pendingAction: null
    }
  };

  var modeNames = {
    browse: "正しい条文を読む",
    fourCorrect: "正しい条文を選ぶ",
    fourWrong: "誤った条文を選ぶ",
    trueFalse: "正誤を判断する"
  };
  var modeLabels = {
    browse: "条文閲覧",
    fourCorrect: "4択・正しい条文",
    fourWrong: "4択・誤った条文",
    trueFalse: "正誤問題"
  };
  var difficultyRank = { "初級": 1, "中級": 2, "上級": 3 };
  var categoryNames = ["会計", "給与", "旅費", "契約"];
  var difficultyNames = ["初級", "中級", "上級"];
  var modeAnalysisNames = ["正誤問題", "正しい条文を選ぶ", "誤った条文を選ぶ"];
  var letters = ["A", "B", "C", "D"];
  var toastTimer = null;
  var modalReturnFocus = null;
  var printReturnTitle = null;

  function byId(id) { return document.getElementById(id); }

  function clear(element) {
    while (element.firstChild) { element.removeChild(element.firstChild); }
  }

  function element(tagName, className, text) {
    var item = document.createElement(tagName);
    if (className) { item.className = className; }
    if (text !== undefined && text !== null) { item.appendChild(document.createTextNode(String(text))); }
    return item;
  }

  function addEventToAll(selector, eventName, handler) {
    var items = document.querySelectorAll(selector);
    var i;
    for (i = 0; i < items.length; i += 1) {
      items[i].addEventListener(eventName, handler);
    }
  }

  function setLoading(message, type) {
    var bar = byId("loadingBar");
    byId("loadingText").textContent = message;
    bar.className = "loading-bar" + (type ? " " + type : "");
  }

  function showToast(message) {
    var toast = byId("toast");
    if (toastTimer) { window.clearTimeout(toastTimer); }
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(function () { toast.hidden = true; }, 3500);
  }

  function activeViewId() {
    var active = document.querySelector(".view.active");
    return active ? active.id : "";
  }

  function showViewDirect(id) {
    var views = document.querySelectorAll(".view");
    var i;
    for (i = 0; i < views.length; i += 1) {
      views[i].classList.remove("active");
    }
    byId(id).classList.add("active");
    if (id === "homeView") { renderHomeStats(); }
    if (id === "analysisView") { renderAnalysis(); }
    if (id === "setupView") { updateSetupSummary(); }
    if (id === "editorView" && state.editor.rows.length) {
      renderEditorRecordList();
      window.setTimeout(resizeEditorTextareas, 0);
    }
    window.scrollTo(0, 0);
  }

  function showView(id) {
    if (activeViewId() === "editorView" && id !== "editorView" && state.editor.dirty) {
      requestEditorAction(function () { showViewDirect(id); });
      return;
    }
    showViewDirect(id);
  }

  function selectedMode() {
    var checked = document.querySelector('input[name="mode"]:checked');
    return checked ? checked.value : "fourCorrect";
  }

  function selectMode(mode) {
    var radio = document.querySelector('input[name="mode"][value="' + mode + '"]');
    if (radio) { radio.checked = true; }
    updateSetupSummary();
  }

  function readConfig() {
    var count = parseInt(byId("questionCount").value, 10);
    var startValue = parseInt(byId("startValueInput").value, 10);
    if (!count || count < 1) { count = 1; }
    if (count > 200) { count = 200; }
    if (!startValue || startValue < 1) { startValue = 1; }
    return {
      mode: selectedMode(),
      category: byId("categorySelect").value,
      relatedGroup: byId("relatedGroupSelect").value,
      importance: parseInt(byId("importanceSelect").value, 10),
      difficulty: byId("difficultySelect").value,
      order: byId("orderSelect").value,
      count: count,
      startValue: startValue
    };
  }

  function filteredRows(config) {
    var maxDifficulty = difficultyRank[config.difficulty];
    var result = [];
    var i;
    var row;
    for (i = 0; i < state.rows.length; i += 1) {
      row = state.rows[i];
      if ((config.category === "all" || row.category === config.category) &&
          (config.relatedGroup === "all" || row.category2 === config.relatedGroup) &&
          row.importance <= config.importance &&
          difficultyRank[row.difficulty] <= maxDifficulty) {
        result.push(row);
      }
    }
    return result;
  }

  function cloneAndShuffle(items) {
    var result = items.slice(0);
    var i;
    var j;
    var temporary;
    for (i = result.length - 1; i > 0; i -= 1) {
      j = Math.floor(Math.random() * (i + 1));
      temporary = result[i];
      result[i] = result[j];
      result[j] = temporary;
    }
    return result;
  }

  function selectSessionRows(pool, config) {
    var result = [];
    var weak;
    var allowed = {};
    var i;
    var startIndex;

    if (config.order === "random") {
      return cloneAndShuffle(pool).slice(0, config.count);
    }

    if (config.order === "weak") {
      weak = STIHistory.weakList();
      for (i = 0; i < pool.length; i += 1) { allowed[pool[i].id] = pool[i]; }
      for (i = 0; i < weak.length && result.length < config.count; i += 1) {
        if (allowed[weak[i].id]) { result.push(allowed[weak[i].id]); }
      }
      return result;
    }

    startIndex = 0;
    if (config.order === "startId") {
      startIndex = pool.length;
      for (i = 0; i < pool.length; i += 1) {
        if (pool[i].id >= config.startValue) {
          startIndex = i;
          break;
        }
      }
    } else if (config.order === "position") {
      startIndex = config.startValue - 1;
    }
    return pool.slice(startIndex, startIndex + config.count);
  }

  function applySavedSettings() {
    var saved = STIHistory.loadSettings();
    var radio;
    if (!saved) { return; }
    radio = document.querySelector('input[name="mode"][value="' + saved.m + '"]');
    if (radio) { radio.checked = true; }
    setSelectValue("categorySelect", saved.g);
    state.savedRelatedGroup = saved.r || "all";
    setSelectValue("importanceSelect", String(saved.i));
    setSelectValue("difficultySelect", saved.d);
    setSelectValue("orderSelect", saved.o);
    if (saved.n && saved.n >= 1 && saved.n <= 200) { byId("questionCount").value = saved.n; }
    if (saved.s && saved.s >= 1) { byId("startValueInput").value = saved.s; }
  }

  function setSelectValue(id, value) {
    var select = byId(id);
    var i;
    for (i = 0; i < select.options.length; i += 1) {
      if (select.options[i].value === value) {
        select.value = value;
        return;
      }
    }
  }

  function populateRelatedGroups(preferredValue) {
    var select = byId("relatedGroupSelect");
    var category = byId("categorySelect").value;
    var seen = {};
    var groups = [];
    var option;
    var i;
    var group;
    clear(select);
    option = element("option", "", "すべて");
    option.value = "all";
    select.appendChild(option);
    if (state.ready) {
      for (i = 0; i < state.rows.length; i += 1) {
        group = state.rows[i].category2;
        if (group && (category === "all" || state.rows[i].category === category) && !seen[group]) {
          seen[group] = true;
          groups.push(group);
        }
      }
      groups.sort(function (a, b) { return a.localeCompare(b, "ja"); });
      for (i = 0; i < groups.length; i += 1) {
        option = element("option", "", groups[i]);
        option.value = groups[i];
        select.appendChild(option);
      }
    }
    setSelectValue("relatedGroupSelect", preferredValue || "all");
  }

  function categoryChanged() {
    populateRelatedGroups("all");
    updateSetupSummary();
  }

  function updateStartField() {
    var order = byId("orderSelect").value;
    var field = byId("startValueField");
    var label = byId("startValueLabel");
    field.hidden = order !== "startId" && order !== "position";
    label.textContent = order === "position" ? "開始位置" : "開始ID";
  }

  function updatePresetButtons() {
    var value = byId("questionCount").value;
    var buttons = document.querySelectorAll("[data-count]");
    var i;
    for (i = 0; i < buttons.length; i += 1) {
      if (buttons[i].getAttribute("data-count") === value) {
        buttons[i].classList.add("selected");
      } else {
        buttons[i].classList.remove("selected");
      }
    }
  }

  function updateSetupSummary() {
    var config = readConfig();
    var eligible = state.ready ? filteredRows(config) : [];
    var message = "";
    var weakCount;

    updateStartField();
    updatePresetButtons();
    if (state.ready && eligible.length === 0) {
      message = "条件に該当する条文がありません。";
    } else if (state.ready && (config.mode === "fourCorrect" || config.mode === "fourWrong") && eligible.length < 4) {
      message = "4択問題には異なる条文が4件以上必要です。";
    } else if (state.ready && config.order === "weak") {
      weakCount = eligibleWeakCount(eligible);
      if (weakCount === 0) {
        message = "この条件に該当する不得意問題はありません。";
      } else if (weakCount < config.count) {
        message = "不得意問題" + weakCount + "件を出題します。";
      }
    } else if (state.ready && eligible.length < config.count) {
      message = "該当する" + eligible.length + "件を出題します。";
    }

    byId("formMessage").textContent = message;
    byId("startButton").disabled = !state.ready || eligible.length === 0 ||
      ((config.mode === "fourCorrect" || config.mode === "fourWrong") && eligible.length < 4) ||
      (config.order === "weak" && eligibleWeakCount(eligible) === 0);
  }

  function eligibleWeakCount(pool) {
    var weak = STIHistory.weakList();
    var ids = {};
    var count = 0;
    var i;
    for (i = 0; i < pool.length; i += 1) { ids[pool[i].id] = true; }
    for (i = 0; i < weak.length; i += 1) {
      if (ids[weak[i].id]) { count += 1; }
    }
    return count;
  }

  function modeRadioChanged() { updateSetupSummary(); }
  function settingChanged() { updateSetupSummary(); }

  function chooseDifferentRows(target, pool, count, textProperty, usedText) {
    var candidates = cloneAndShuffle(pool);
    var result = [];
    var seen = {};
    var i;
    var text;
    if (usedText) { seen[usedText] = true; }
    for (i = 0; i < candidates.length && result.length < count; i += 1) {
      text = candidates[i][textProperty];
      if (candidates[i].id !== target.id && !seen[text]) {
        seen[text] = true;
        result.push(candidates[i]);
      }
    }
    return result;
  }

  function buildCurrentQuestion(session) {
    var target = session.rows[session.index];
    var distractors;
    var options = [];
    var i;
    var isOriginal;

    if (session.config.mode === "browse") {
      return { target: target, answered: true };
    }

    if (session.config.mode === "trueFalse") {
      isOriginal = session.truthPattern[session.index];
      return {
        target: target,
        isOriginal: isOriginal,
        text: isOriginal ? target.original : target.question,
        answered: false
      };
    }

    if (session.config.mode === "fourCorrect") {
      distractors = chooseDifferentRows(target, session.pool, 3, "question", target.original);
      options.push({ row: target, text: target.original, isAnswer: true, isWrongText: false });
      for (i = 0; i < distractors.length; i += 1) {
        options.push({ row: distractors[i], text: distractors[i].question, isAnswer: false, isWrongText: true });
      }
    } else {
      distractors = chooseDifferentRows(target, session.pool, 3, "original", target.question);
      options.push({ row: target, text: target.question, isAnswer: true, isWrongText: true });
      for (i = 0; i < distractors.length; i += 1) {
        options.push({ row: distractors[i], text: distractors[i].original, isAnswer: false, isWrongText: false });
      }
    }

    if (options.length !== 4) {
      throw new Error("重複しない4つの選択肢を作成できませんでした。条件を広げてください。");
    }
    return { target: target, options: cloneAndShuffle(options), answered: false };
  }

  function startSession(config) {
    var pool = filteredRows(config);
    var rows = selectSessionRows(pool, config);
    var truthPattern = [];
    var i;

    if (!rows.length) {
      byId("formMessage").textContent = config.order === "weak" ?
        "この条件に該当する不得意問題はありません。" : "指定した開始位置以降に条文がありません。";
      return;
    }
    if ((config.mode === "fourCorrect" || config.mode === "fourWrong") && pool.length < 4) {
      byId("formMessage").textContent = "4択問題には異なる条文が4件以上必要です。";
      return;
    }

    for (i = 0; i < rows.length; i += 1) { truthPattern.push(i % 2 === 0); }
    truthPattern = cloneAndShuffle(truthPattern);
    state.session = {
      config: config,
      pool: pool,
      rows: rows,
      truthPattern: truthPattern,
      index: 0,
      correct: 0,
      wrong: 0,
      answers: [],
      startedAt: new Date(),
      current: null
    };
    state.lastConfig = config;
    STIHistory.saveSettings(config);
    showView("learnView");
    renderQuestion();
  }

  function renderMeta(row) {
    var container = byId("questionMeta");
    clear(container);
    container.appendChild(element("span", "meta-badge", "ID " + row.id));
    container.appendChild(element("span", "meta-badge", row.category));
    if (row.category2) { container.appendChild(element("span", "meta-badge related-group-badge", row.category2)); }
    container.appendChild(element("span", "meta-badge", row.difficulty));
    container.appendChild(element("span", "meta-badge", "重要度 " + row.importance));
  }

  function renderQuestion() {
    var session = state.session;
    var area = byId("questionArea");
    var learnView = byId("learnView");
    var questionCard = learnView ? learnView.querySelector(".question-card") : null;
    var current;
    var progress;
    var title;
    try {
      current = buildCurrentQuestion(session);
    } catch (error) {
      showToast(error.message);
      showView("setupView");
      return;
    }
    session.current = current;
    progress = session.index + 1;
    byId("sessionModeLabel").textContent = modeLabels[session.config.mode];
    title = session.config.mode === "browse" ? "条文 " + progress : "第" + progress + "問";
    byId("learnTitle").textContent = title;
    byId("progressText").textContent = progress + " / " + session.rows.length;
    byId("progressBar").style.width = Math.round(progress / session.rows.length * 100) + "%";
    byId("browsePrintButton").hidden = session.config.mode !== "browse";
    if (learnView) {
      learnView.classList.remove("four-choice-layout");
      learnView.classList.remove("four-choice-session");
      learnView.classList.remove("true-false-session");
      if (session.config.mode === "fourCorrect" || session.config.mode === "fourWrong" || session.config.mode === "trueFalse") {
        learnView.classList.add("four-choice-layout");
      }
      if (session.config.mode === "fourCorrect" || session.config.mode === "fourWrong") {
        learnView.classList.add("four-choice-session");
      }
      if (session.config.mode === "trueFalse") {
        learnView.classList.add("true-false-session");
      }
    }
    if (questionCard) { questionCard.classList.remove("four-choice-card"); }
    if (questionCard && (session.config.mode === "fourCorrect" || session.config.mode === "fourWrong")) {
      questionCard.classList.add("four-choice-card");
    }
    renderMeta(current.target);
    byId("feedbackPanel").hidden = true;
    byId("feedbackPanel").className = "feedback-panel";
    clear(area);

    if (session.config.mode === "browse") {
      renderBrowse(area, current);
    } else if (session.config.mode === "trueFalse") {
      renderTrueFalse(area, current);
    } else {
      renderFourChoice(area, current);
    }
    window.scrollTo(0, 0);
  }

  function createLawReader(text, title, extraClass) {
    var reader = element("div", "law-reader" + (extraClass ? " " + extraClass : ""));
    var law = element("p", "law-text", text);
    var actions = element("div", "law-reader-actions");
    var focusButton = element("button", "focus-reading-button", "集中して読む");
    focusButton.type = "button";
    focusButton.addEventListener("click", function (event) {
      event.stopPropagation();
      openLawModal(title, text, focusButton);
    });
    actions.appendChild(focusButton);
    reader.appendChild(law);
    reader.appendChild(actions);
    return reader;
  }

  function openLawModal(title, text, returnFocus) {
    modalReturnFocus = returnFocus || document.activeElement;
    byId("lawModalTitle").textContent = title || "条文全文";
    byId("lawModalText").textContent = text;
    byId("lawModal").hidden = false;
    document.body.classList.add("modal-open");
    byId("lawModalClose").focus();
  }

  function closeLawModal() {
    if (byId("lawModal").hidden) { return; }
    byId("lawModal").hidden = true;
    document.body.classList.remove("modal-open");
    if (modalReturnFocus && modalReturnFocus.focus) { modalReturnFocus.focus(); }
    modalReturnFocus = null;
  }

  function applyTextSize(size, save) {
    var buttons = document.querySelectorAll("[data-text-size]");
    var i;
    document.body.classList.remove("reader-small");
    document.body.classList.remove("reader-large");
    if (size === "small") { document.body.classList.add("reader-small"); }
    if (size === "large") { document.body.classList.add("reader-large"); }
    for (i = 0; i < buttons.length; i += 1) {
      if (buttons[i].getAttribute("data-text-size") === size) {
        buttons[i].classList.add("selected");
        buttons[i].setAttribute("aria-pressed", "true");
      } else {
        buttons[i].classList.remove("selected");
        buttons[i].setAttribute("aria-pressed", "false");
      }
    }
    if (save) { STIHistory.saveDisplay(size); }
  }

  function renderBrowse(area, current) {
    var controls = element("div", "browse-controls");
    var previous = element("button", "button secondary", "前の条文");
    var next = element("button", "button primary", state.session.index === state.session.rows.length - 1 ? "閲覧を終える" : "次の条文");
    byId("questionInstruction").textContent = "正しい元条文を確認してください。";
    area.appendChild(createLawReader(current.target.original, "正しい条文（ID " + current.target.id + "）"));
    previous.type = "button";
    previous.disabled = state.session.index === 0;
    previous.addEventListener("click", function () {
      state.session.index -= 1;
      renderQuestion();
    });
    next.type = "button";
    next.addEventListener("click", function () {
      if (state.session.index === state.session.rows.length - 1) {
        showToast(state.session.rows.length + "件の条文を閲覧しました。");
        showView("homeView");
      } else {
        state.session.index += 1;
        renderQuestion();
      }
    });
    controls.appendChild(previous);
    controls.appendChild(next);
    area.appendChild(controls);
  }

  function renderTrueFalse(area, current) {
    var buttons = element("div", "judge-buttons");
    var correctButton = element("button", "judge-button correct-choice", "正しい条文");
    var wrongButton = element("button", "judge-button wrong-choice", "誤った条文");
    byId("questionInstruction").textContent = "この条文は正しいですか、誤っていますか。";
    area.appendChild(createLawReader(current.text, "問題の条文（ID " + current.target.id + "）"));
    correctButton.type = "button";
    wrongButton.type = "button";
    correctButton.setAttribute("data-judgement", "true");
    wrongButton.setAttribute("data-judgement", "false");
    correctButton.addEventListener("click", function () { answerTrueFalse(true, correctButton, buttons); });
    wrongButton.addEventListener("click", function () { answerTrueFalse(false, wrongButton, buttons); });
    buttons.appendChild(correctButton);
    buttons.appendChild(wrongButton);
    area.appendChild(buttons);
  }

  function renderFourChoice(area, current) {
    var list = element("div", "choice-list");
    var i;
    var button;
    var choiceItem;
    var letter;
    var text;
    byId("questionInstruction").textContent = state.session.config.mode === "fourCorrect" ?
      "4つのうち、正しい条文を1つ選んでください。" :
      "4つのうち、誤っている条文を1つ選んでください。";
    for (i = 0; i < current.options.length; i += 1) {
      choiceItem = element("div", "choice-item");
      button = element("button", "choice-button");
      button.type = "button";
      button.setAttribute("data-choice-index", String(i));
      letter = element("span", "choice-letter", letters[i]);
      text = element("span", "choice-text", current.options[i].text);
      button.appendChild(letter);
      button.appendChild(text);
      button.addEventListener("click", fourChoiceClick);
      choiceItem.appendChild(button);
      list.appendChild(choiceItem);
    }
    area.appendChild(list);
  }

  function fourChoiceClick(event) {
    var button = event.currentTarget;
    var index = parseInt(button.getAttribute("data-choice-index"), 10);
    answerFourChoice(index, button);
  }

  function disableButtons(container) {
    var buttons = container.querySelectorAll("button");
    var i;
    for (i = 0; i < buttons.length; i += 1) { buttons[i].disabled = true; }
  }

  function answerTrueFalse(judgement, button, container) {
    var current = state.session.current;
    var correct;
    var details;
    var answerInfo;
    if (current.answered) { return; }
    current.answered = true;
    correct = judgement === current.isOriginal;
    button.classList.add("chosen");
    disableButtons(container);
    details = [{
      row: current.target,
      explanation: current.isOriginal ? "" : current.target.explanation,
      isCorrectLaw: current.isOriginal
    }];
    answerInfo = {
      mode: "trueFalse",
      questionText: current.text,
      userAnswer: judgement ? "正しい条文" : "誤った条文",
      correctAnswer: current.isOriginal ? "正しい条文" : "誤った条文",
      resultDetails: details
    };
    finishAnswer(correct, current.target, details, answerInfo);
  }

  function answerFourChoice(index, button) {
    var session = state.session;
    var current = session.current;
    var option;
    var buttons;
    var answerInfo;
    var resultDetails = [];
    var optionSnapshot = [];
    var correctIndex = -1;
    var targetIndex = -1;
    var i;
    var details = [];
    if (current.answered) { return; }
    current.answered = true;
    option = current.options[index];
    buttons = byId("questionArea").querySelectorAll(".choice-button");
    button.classList.add("chosen");
    for (i = 0; i < buttons.length; i += 1) {
      buttons[i].disabled = true;
      if (current.options[i].isAnswer) {
        buttons[i].classList.add("answer-correct");
        correctIndex = i;
      }
      if (current.options[i].row.id === current.target.id) { targetIndex = i; }
      optionSnapshot.push({
        letter: letters[i],
        text: current.options[i].text,
        isAnswer: current.options[i].isAnswer
      });
    }
    if (!option.isAnswer) { button.classList.add("answer-wrong"); }
    for (i = 0; i < current.options.length; i += 1) {
      if (current.options[i].isAnswer) {
        details.push({
          row: current.options[i].row,
          explanation: session.config.mode === "fourWrong" ? (current.options[i].row.explanation || "") : "",
          letter: letters[i],
          isCorrectOption: true
        });
      } else if (current.options[i].isWrongText) {
        details.push({ row: current.options[i].row, explanation: current.options[i].row.explanation, letter: letters[i] });
      } else if (session.config.mode === "fourWrong") {
        details.push({ row: current.options[i].row, explanation: "", letter: letters[i], isCorrectLaw: true });
      }
    }
    if (!option.isAnswer) {
      if (session.config.mode === "fourCorrect") {
        resultDetails.push({ row: option.row, explanation: option.row.explanation, letter: letters[index] });
      } else {
        resultDetails.push({ row: current.target, explanation: current.target.explanation, letter: letters[targetIndex] });
      }
    }
    answerInfo = {
      mode: session.config.mode,
      options: optionSnapshot,
      selectedIndex: index,
      correctIndex: correctIndex,
      resultDetails: resultDetails
    };
    finishAnswer(option.isAnswer, current.target, details, answerInfo);
  }

  function finishAnswer(correct, target, details, answerInfo) {
    var session = state.session;
    var panel = byId("feedbackPanel");
    var nextButton = byId("nextButton");
    session[correct ? "correct" : "wrong"] += 1;
    session.answers.push({
      number: session.index + 1,
      row: target,
      correct: correct,
      details: answerInfo && answerInfo.resultDetails ? answerInfo.resultDetails : details,
      answerInfo: answerInfo || null
    });
    STIHistory.record(target, session.config.mode, correct);
    renderHomeStats();

    panel.hidden = false;
    panel.className = "feedback-panel " + (correct ? "correct" : "incorrect");
    byId("resultSymbol").textContent = correct ? "○" : "×";
    byId("feedbackTitle").textContent = correct ? "正解です" : "不正解です";
    renderFeedbackBody(target, details, answerInfo);
    nextButton.textContent = session.index === session.rows.length - 1 ? "結果を見る" : "次の問題へ";
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderFeedbackBody(target, details, answerInfo) {
    var body = byId("feedbackBody");
    var correctSection = element("section", "feedback-section");
    var answerSummary;
    var isFourChoice = answerInfo && (answerInfo.mode === "fourCorrect" || answerInfo.mode === "fourWrong");
    var isTrueFalse = answerInfo && answerInfo.mode === "trueFalse";
    var isQuizMode = isFourChoice || isTrueFalse;
    var selectedCorrect = isFourChoice && answerInfo.selectedIndex === answerInfo.correctIndex;
    var correctChoiceLabel = answerInfo && answerInfo.mode === "fourWrong" ? "誤っている条文" : "正しい条文";
    var i;
    var section;
    clear(body);
    if (isFourChoice) {
      answerSummary = element("div", "feedback-answer-summary " +
        (selectedCorrect ? "correct" : "incorrect"));
      answerSummary.appendChild(element("strong", "", "あなたの回答：" + letters[answerInfo.selectedIndex]));
      answerSummary.appendChild(document.createTextNode("　正解：" + letters[answerInfo.correctIndex]));
      body.appendChild(answerSummary);
    } else if (isTrueFalse) {
      answerSummary = element("div", "feedback-answer-summary " +
        (answerInfo.userAnswer === answerInfo.correctAnswer ? "correct" : "incorrect"));
      answerSummary.appendChild(element("strong", "", "あなたの回答：" + answerInfo.userAnswer));
      answerSummary.appendChild(document.createTextNode("　正解：" + answerInfo.correctAnswer));
      body.appendChild(answerSummary);
    }
    // 学習問題では左側に条文が表示されているため、正しい条文を再掲しない。
    if (!isQuizMode) {
      correctSection.appendChild(element("h3", "", "正しい条文（ID " + target.id + "）"));
      correctSection.appendChild(createLawReader(target.original, "正しい条文（ID " + target.id + "）", "feedback-law-reader"));
      body.appendChild(correctSection);
    }
    for (i = 0; i < details.length; i += 1) {
      section = element("section", "feedback-section");
      if (isFourChoice) {
        var heading = element("div", "feedback-section-heading");
        heading.appendChild(element("span", "feedback-choice-icon", details[i].letter || ""));
        heading.appendChild(element("h3", "", details[i].isCorrectOption ? correctChoiceLabel : (details[i].isCorrectLaw ? "正しい条文" : (details.length > 1 ? "変更箇所の解説（ID " + details[i].row.id + "）" : "変更箇所と解説"))));
        section.appendChild(heading);
      } else if (isTrueFalse) {
        section.appendChild(element("h3", "", details[i].isCorrectLaw ? "正しい条文" : "変更箇所と解説"));
      } else {
        section.appendChild(element("h3", "", details.length > 1 ? "変更箇所の解説（ID " + details[i].row.id + "）" : "変更箇所と解説"));
      }
      if (details[i].explanation) { section.appendChild(element("p", "", details[i].explanation)); }
      body.appendChild(section);
    }
  }

  function nextQuestion() {
    var session = state.session;
    if (!session || !session.current || !session.current.answered) { return; }
    if (session.index >= session.rows.length - 1) {
      renderResults();
    } else {
      session.index += 1;
      renderQuestion();
    }
  }

  function percent(correct, total) {
    return total ? Math.round(correct / total * 100) : 0;
  }

  function orderName(config) {
    var names = { sequential: "連番", startId: "開始ID " + config.startValue, position: "開始位置 " + config.startValue, random: "ランダム", weak: "不得意問題" };
    return names[config.order];
  }

  function rangeName(config) {
    var group = config.relatedGroup === "all" ? "" : "／" + config.relatedGroup;
    return (config.category === "all" ? "全大分類" : config.category) + group + "／重要度1～" + config.importance + "／" +
      (config.difficulty === "初級" ? "初級" : "初級～" + config.difficulty);
  }

  function renderResults() {
    var session = state.session;
    var total = session.answers.length;
    var summary = byId("resultSummary");
    var conditions = byId("reportConditions");
    var detailsContainer = byId("resultDetails");
    var i;
    var score;
    var entry;

    clear(summary);
    score = element("div", "result-score");
    score.appendChild(element("strong", "", percent(session.correct, total)));
    score.appendChild(element("span", "", "%"));
    summary.appendChild(score);
    addResultStat(summary, "出題", total, "問");
    addResultStat(summary, "正解", session.correct, "問");
    addResultStat(summary, "不正解", session.wrong, "問");

    clear(conditions);
    addCondition(conditions, "学習方法", modeNames[session.config.mode]);
    addCondition(conditions, "対象", rangeName(session.config));
    addCondition(conditions, "出題順", orderName(session.config));
    if (state.previewMode) { addCondition(conditions, "確認DB", state.dataLabel); }
    addCondition(conditions, "所要時間", elapsedText(session.startedAt, new Date()));
    byId("reportDate").textContent = formatDate(new Date());

    clear(detailsContainer);
    detailsContainer.appendChild(element("h2", "", "出題順と回答結果"));
    for (i = 0; i < session.answers.length; i += 1) {
      entry = createResultEntry(session.answers[i]);
      detailsContainer.appendChild(entry);
    }
    showView("resultView");
  }

  function createResultEntry(answer) {
    var info = answer.answerInfo || {};
    var entry = element("article", "result-entry " + (answer.correct ? "result-entry-correct" : "result-entry-wrong"));
    var status = answer.correct ? "○ 正解" : "× 不正解";
    var i;
    var option;
    var optionText;

    entry.appendChild(element("h3", "", "第" + answer.number + "問　" + status + "　ID " + answer.row.id + "・" + answer.row.category));

    if (info.mode === "trueFalse") {
      entry.appendChild(element("p", "result-question-text", "出題された条文：" + info.questionText));
      entry.appendChild(element("p", "result-user-answer", "あなたの回答：" + info.userAnswer));
      entry.appendChild(element("p", "result-correct-answer", "正解：" + info.correctAnswer));
    } else if (info.options && info.options.length) {
      entry.appendChild(element("p", "result-choice-title", "出題された選択肢（出題時の順番）"));
      for (i = 0; i < info.options.length; i += 1) {
        option = info.options[i];
        optionText = option.letter + "　" + option.text;
        if (i === info.selectedIndex) { optionText += "　【あなたの回答】"; }
        if (i === info.correctIndex) { optionText += "　【正解】"; }
        entry.appendChild(element("p", "result-choice-line", optionText));
      }
      if (typeof info.selectedIndex === "number" && info.selectedIndex >= 0) {
        entry.appendChild(element("p", "result-user-answer", "あなたの回答：" + letters[info.selectedIndex] + "（" + (info.selectedIndex + 1) + "番目）"));
      }
      if (typeof info.correctIndex === "number" && info.correctIndex >= 0) {
        entry.appendChild(element("p", "result-correct-answer", "正解：" + letters[info.correctIndex] + "（" + (info.correctIndex + 1) + "番目）"));
      }
    }

    if (!answer.correct) {
      entry.appendChild(element("h4", "", "何が誤りだったか"));
      if (answer.details && answer.details.length) {
        for (i = 0; i < answer.details.length; i += 1) {
          entry.appendChild(element("p", "entry-explanation", answer.details[i].explanation));
        }
      }
      entry.appendChild(element("p", "result-correct-law", "正しい条文：" + answer.row.original));
    }
    return entry;
  }

  function addResultStat(container, label, value, suffix) {
    var stat = element("div", "summary-stat");
    stat.appendChild(element("span", "", label));
    stat.appendChild(element("strong", "", value));
    stat.appendChild(element("span", "", suffix));
    container.appendChild(stat);
  }

  function addCondition(container, label, value) {
    var wrapper = element("span", "");
    wrapper.appendChild(document.createTextNode(label));
    wrapper.appendChild(element("strong", "", value));
    container.appendChild(wrapper);
  }

  function formatDate(date) {
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    var hour = ("0" + date.getHours()).slice(-2);
    var minute = ("0" + date.getMinutes()).slice(-2);
    return year + "年" + month + "月" + day + "日 " + hour + ":" + minute;
  }

  function elapsedText(start, end) {
    var seconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
    var minutes = Math.floor(seconds / 60);
    seconds %= 60;
    return minutes ? minutes + "分" + seconds + "秒" : seconds + "秒";
  }

  function renderHomeStats() {
    var summary = STIHistory.summary();
    var weak = STIHistory.weakList();
    byId("homeRate").textContent = summary.t ? percent(summary.c, summary.t) : "--";
    byId("homeTotal").textContent = summary.t;
    byId("homeCorrect").textContent = summary.c;
    byId("homeWeak").textContent = weak.length;
  }

  function renderAnalysis() {
    var container = byId("analysisContent");
    var summary = STIHistory.summary();
    var weak = STIHistory.weakList();
    var top;
    var card;
    var rate;
    var totals;
    var breakdown;
    var weakCard;
    var table;
    var body;
    var i;
    var row;
    var dataRow;
    var startWeak;
    clear(container);

    top = element("div", "analysis-grid");
    card = element("section", "analysis-card");
    card.appendChild(element("h2", "", "累計正答率"));
    rate = element("div", "big-rate");
    rate.appendChild(element("strong", "", summary.t ? percent(summary.c, summary.t) : "--"));
    rate.appendChild(element("span", "", "%"));
    card.appendChild(rate);
    totals = element("div", "analysis-totals");
    addAnalysisTotal(totals, "回答", summary.t);
    addAnalysisTotal(totals, "正解", summary.c);
    addAnalysisTotal(totals, "不正解", summary.w);
    card.appendChild(totals);
    top.appendChild(card);

    breakdown = element("section", "analysis-card");
    breakdown.appendChild(element("h2", "", "問題形式別"));
    breakdown.appendChild(createBarList(modeAnalysisNames, summary.m));
    top.appendChild(breakdown);
    container.appendChild(top);

    breakdown = element("div", "analysis-grid");
    card = element("section", "analysis-card");
    card.appendChild(element("h2", "", "カテゴリ別"));
    card.appendChild(createBarList(categoryNames, summary.g));
    breakdown.appendChild(card);
    card = element("section", "analysis-card");
    card.appendChild(element("h2", "", "難易度別"));
    card.appendChild(createBarList(difficultyNames, summary.d));
    breakdown.appendChild(card);
    container.appendChild(breakdown);

    weakCard = element("section", "analysis-card");
    weakCard.appendChild(element("h2", "", "不得意問題（最大20件表示）"));
    if (!weak.length) {
      weakCard.appendChild(element("p", "empty-state", "不得意問題はまだありません。問題に回答すると、間違えた条文がここに表示されます。"));
    } else {
      startWeak = element("button", "button primary", "不得意問題を学習する");
      startWeak.type = "button";
      startWeak.addEventListener("click", prepareWeakStudy);
      weakCard.appendChild(startWeak);
      table = element("table", "weak-table");
      table.appendChild(createTableHeader(["ID", "分類", "正しい条文", "不正解", "正解"]));
      body = document.createElement("tbody");
      for (i = 0; i < weak.length && i < 20; i += 1) {
        row = state.rowsById[weak[i].id];
        if (!row) { continue; }
        dataRow = document.createElement("tr");
        dataRow.appendChild(element("td", "", row.id));
        dataRow.appendChild(element("td", "", row.category + "／" + row.difficulty));
        dataRow.appendChild(element("td", "law-cell", shorten(row.original, 135)));
        dataRow.appendChild(element("td", "", weak[i].wrong));
        dataRow.appendChild(element("td", "", weak[i].correct));
        body.appendChild(dataRow);
      }
      table.appendChild(body);
      weakCard.appendChild(table);
    }
    container.appendChild(weakCard);
  }

  function addAnalysisTotal(container, label, value) {
    var item = element("div", "");
    item.appendChild(element("span", "", label));
    item.appendChild(element("strong", "", value));
    container.appendChild(item);
  }

  function createBarList(names, pairs) {
    var list = element("div", "bar-list");
    var i;
    var row;
    var track;
    var fill;
    var total;
    var rate;
    for (i = 0; i < names.length; i += 1) {
      total = pairs[i][0] + pairs[i][1];
      rate = total ? percent(pairs[i][0], total) : 0;
      row = element("div", "bar-row");
      row.appendChild(element("span", "bar-label", names[i]));
      track = element("span", "bar-track");
      fill = element("span", "");
      fill.style.width = rate + "%";
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(element("span", "bar-value", total ? rate + "%（" + total + "問）" : "未回答"));
      list.appendChild(row);
    }
    return list;
  }

  function createTableHeader(labels) {
    var head = document.createElement("thead");
    var row = document.createElement("tr");
    var i;
    for (i = 0; i < labels.length; i += 1) { row.appendChild(element("th", "", labels[i])); }
    head.appendChild(row);
    return head;
  }

  function shorten(text, length) {
    return text.length > length ? text.substring(0, length) + "…" : text;
  }

  function prepareWeakStudy() {
    selectMode("trueFalse");
    byId("orderSelect").value = "weak";
    showView("setupView");
  }

  function resetHistory() {
    var targetName = state.previewMode ? "ローカルDB確認履歴" : "学習履歴";
    if (!window.confirm(targetName + "の正解数、不正解数、不得意問題、前回の設定をすべて消去します。よろしいですか？")) { return; }
    STIHistory.reset();
    renderHomeStats();
    renderAnalysis();
    showToast(targetName + "を消去しました。");
  }

  function printResults() {
    cleanupPrintMode();
    document.body.classList.add("print-result");
    window.print();
    window.setTimeout(cleanupPrintMode, 1000);
  }

  function renderBrowsePrintDocument() {
    var session = state.session;
    var container = byId("browsePrintDocument");
    var header = element("header", "browse-print-header");
    var item;
    var row;
    var sourceText;
    var i;
    clear(container);
    header.appendChild(element("h1", "", "条文一覧"));
    header.appendChild(element("p", "", "抽出件数：" + session.rows.length + "件"));
    header.appendChild(element("p", "", "抽出条件：" + rangeName(session.config) + "／" + orderName(session.config)));
    sourceText = "作成日時：" + formatDate(new Date());
    if (state.previewMode) { sourceText += "／確認DB：" + state.dataLabel; }
    header.appendChild(element("p", "", sourceText));
    container.appendChild(header);
    for (i = 0; i < session.rows.length; i += 1) {
      row = session.rows[i];
      item = element("article", "browse-print-item");
      item.appendChild(element("h2", "", (i + 1) + "．ID " + row.id + "　" + (row.category2 || row.category)));
      item.appendChild(element("p", "browse-print-meta", "大分類：" + row.category + "／関連法規：" + (row.category2 || "-") + "／難易度：" + row.difficulty + "／重要度：" + row.importance));
      item.appendChild(element("p", "browse-print-law", row.original));
      container.appendChild(item);
    }
  }

  function printBrowseRows() {
    var session = state.session;
    if (!session || session.config.mode !== "browse" || !session.rows.length) {
      showToast("PDFにする条文がありません。");
      return;
    }
    cleanupPrintMode();
    renderBrowsePrintDocument();
    printReturnTitle = document.title;
    document.title = "NAF-CSM_正しい条文一覧_" + STILocalDb.dateStamp();
    byId("dynamicPrintPageStyle").textContent = "@page { size: A4 portrait; margin: 15mm 15mm 15mm 25mm; }";
    document.body.classList.add("print-browse");
    window.print();
    window.setTimeout(cleanupPrintMode, 1000);
  }

  function cleanupPrintMode() {
    document.body.classList.remove("print-result");
    document.body.classList.remove("print-browse");
    byId("dynamicPrintPageStyle").textContent = "";
    if (printReturnTitle !== null) {
      document.title = printReturnTitle;
      printReturnTitle = null;
    }
  }

  function quitSession() {
    var session = state.session;
    if (!session) { showView("homeView"); return; }
    if (!window.confirm("現在の学習を終了しますか？回答済みの成績は保存されています。")) { return; }
    if (session.config.mode !== "browse" && session.answers.length) {
      renderResults();
    } else {
      showView("homeView");
    }
  }

  function cloneRow(row) {
    return {
      id: row.id,
      importance: row.importance,
      difficulty: row.difficulty,
      category1: row.category1 || row.category,
      category2: row.category2 || "",
      category: row.category1 || row.category,
      original: row.original,
      question: row.question,
      explanation: row.explanation,
      notes1: row.notes1 || "",
      notes2: row.notes2 || "",
      notes3: row.notes3 || "",
      notes4: row.notes4 || "",
      notes5: row.notes5 || ""
    };
  }

  function cloneRows(rows) {
    var result = [];
    var i;
    for (i = 0; i < rows.length; i += 1) { result.push(cloneRow(rows[i])); }
    return result;
  }

  function editorFieldIds() {
    return [
      "editId", "editImportance", "editDifficulty", "editCategory1", "editCategory2",
      "editOriginal", "editQuestion", "editExplanation", "editNotes2", "editNotes3",
      "editNotes4", "editNotes5"
    ];
  }

  function setEditorDirty(dirty) {
    state.editor.dirty = !!dirty;
    byId("unsavedBadge").hidden = !state.editor.dirty;
  }

  function currentEditorRow() {
    var i;
    for (i = 0; i < state.editor.rows.length; i += 1) {
      if (state.editor.rows[i].id === state.editor.currentId) { return state.editor.rows[i]; }
    }
    return null;
  }

  function resizeEditorTextarea(textarea) {
    if (!textarea) { return; }
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  }

  function resizeEditorTextareas() {
    if (byId("editorWorkspace").hidden || activeViewId() !== "editorView") { return; }
    resizeEditorTextarea(byId("editOriginal"));
    resizeEditorTextarea(byId("editQuestion"));
    resizeEditorTextarea(byId("editExplanation"));
  }

  function fillEditorForm(row, isNew) {
    byId("editId").value = row.id || "";
    byId("editImportance").value = String(row.importance || 1);
    byId("editDifficulty").value = row.difficulty || "初級";
    byId("editCategory1").value = row.category1 || row.category || "";
    byId("editCategory2").value = row.category2 || "";
    byId("editOriginal").value = row.original || "";
    byId("editQuestion").value = row.question || "";
    byId("editExplanation").value = row.explanation || "";
    byId("editNotes1").value = STILocalDb.dateStamp();
    byId("editNotes2").value = row.notes2 && row.notes2 !== "-" ? row.notes2 : (state.editor.nickname || "");
    byId("editNotes3").value = row.notes3 || "";
    byId("editNotes4").value = row.notes4 || "";
    byId("editNotes5").value = row.notes5 || "";
    resizeEditorTextareas();
    byId("recordEditorTitle").textContent = isNew ? "新しいレコード" : "ID " + row.id + "を編集";
    byId("deleteRecordButton").disabled = !!isNew;
    byId("deleteRecordButtonTop").disabled = !!isNew;
    byId("recordEditorMessage").textContent = "";
    setEditorDirty(!!isNew);
  }

  function editorSearchRows() {
    var query = byId("editorSearch").value.replace(/^\s+|\s+$/g, "").toLowerCase();
    var result = [];
    var i;
    var row;
    var haystack;
    for (i = 0; i < state.editor.rows.length; i += 1) {
      row = state.editor.rows[i];
      haystack = [row.id, row.category1, row.category2, row.original].join(" ").toLowerCase();
      if (!query || haystack.indexOf(query) >= 0) { result.push(row); }
    }
    return result;
  }

  function renderEditorRecordList() {
    var select = byId("editorRecordSelect");
    var rows = editorSearchRows();
    var option;
    var i;
    clear(select);
    for (i = 0; i < rows.length; i += 1) {
      option = element("option", "", rows[i].id + "｜" + (rows[i].category2 || rows[i].category1) + "｜" + shorten(rows[i].original, 28));
      option.value = String(rows[i].id);
      if (!state.editor.isNew && rows[i].id === state.editor.currentId) { option.selected = true; }
      select.appendChild(option);
    }
    byId("editorRecordCount").textContent = rows.length.toLocaleString("ja-JP") + "件を表示／全" + state.editor.rows.length.toLocaleString("ja-JP") + "件";
    updateEditorNavigation(rows);
  }

  function updateEditorNavigation(rows) {
    var currentIndex = -1;
    var position = byId("editorRecordPosition");
    var previousDisabled;
    var nextDisabled;
    var i;
    for (i = 0; i < rows.length; i += 1) {
      if (rows[i].id === state.editor.currentId) { currentIndex = i; break; }
    }
    previousDisabled = state.editor.isNew || currentIndex <= 0;
    nextDisabled = state.editor.isNew || currentIndex < 0 || currentIndex >= rows.length - 1;
    byId("previousRecordButton").disabled = previousDisabled;
    byId("previousRecordButtonTop").disabled = previousDisabled;
    byId("previousRecordButtonEditorTop").disabled = previousDisabled;
    byId("nextRecordButton").disabled = nextDisabled;
    byId("nextRecordButtonTop").disabled = nextDisabled;
    byId("nextRecordButtonEditorTop").disabled = nextDisabled;
    if (state.editor.isNew) {
      position.textContent = "現在のレコード：新規入力";
    } else if (currentIndex < 0) {
      position.textContent = rows.length ? "現在のレコード：検索結果外" : "現在のレコード：該当なし";
    } else {
      position.textContent = "現在のレコード：" + (currentIndex + 1).toLocaleString("ja-JP") + "件目／" + rows.length.toLocaleString("ja-JP") + "件";
    }
  }

  function openEditorRecord(id) {
    var row;
    var parsedId = parseInt(id, 10);
    var i;
    for (i = 0; i < state.editor.rows.length; i += 1) {
      if (state.editor.rows[i].id === parsedId) { row = state.editor.rows[i]; break; }
    }
    if (!row) { return; }
    state.editor.currentId = row.id;
    state.editor.previousId = null;
    state.editor.isNew = false;
    fillEditorForm(row, false);
    renderEditorRecordList();
  }

  function requestEditorAction(action) {
    if (!state.editor.dirty) { action(); return; }
    state.editor.pendingAction = action;
    byId("editorLeaveModal").hidden = false;
    byId("continueEditingButton").focus();
  }

  function closeEditorLeaveModal() {
    byId("editorLeaveModal").hidden = true;
  }

  function runPendingEditorAction() {
    var action = state.editor.pendingAction;
    state.editor.pendingAction = null;
    closeEditorLeaveModal();
    if (action) { action(); }
  }

  function addEditorRecord() {
    var maxId = 0;
    var i;
    for (i = 0; i < state.editor.rows.length; i += 1) {
      if (state.editor.rows[i].id > maxId) { maxId = state.editor.rows[i].id; }
    }
    state.editor.previousId = state.editor.currentId;
    state.editor.currentId = null;
    state.editor.isNew = true;
    byId("editorSearch").value = "";
    byId("editorRecordSelect").selectedIndex = -1;
    fillEditorForm({ id: maxId + 1, importance: 1, difficulty: "初級", notes2: state.editor.nickname || "" }, true);
    byId("editCategory1").focus();
  }

  function editorRowFromForm() {
    var nickname = STILocalDb.validateNickname(byId("editNotes2").value);
    var row = {
      id: parseInt(byId("editId").value, 10),
      importance: parseInt(byId("editImportance").value, 10),
      difficulty: byId("editDifficulty").value,
      category1: byId("editCategory1").value.replace(/^\s+|\s+$/g, ""),
      category2: byId("editCategory2").value.replace(/^\s+|\s+$/g, ""),
      original: byId("editOriginal").value.replace(/^\s+|\s+$/g, ""),
      question: byId("editQuestion").value.replace(/^\s+|\s+$/g, ""),
      explanation: byId("editExplanation").value.replace(/^\s+|\s+$/g, ""),
      notes1: STILocalDb.dateStamp(),
      notes2: nickname,
      notes3: byId("editNotes3").value,
      notes4: byId("editNotes4").value,
      notes5: byId("editNotes5").value
    };
    row.category = row.category1;
    return row;
  }

  function makeEditorCandidate(row) {
    var result = [];
    var replaced = false;
    var i;
    for (i = 0; i < state.editor.rows.length; i += 1) {
      if (!state.editor.isNew && state.editor.rows[i].id === state.editor.currentId) {
        result.push(row);
        replaced = true;
      } else {
        result.push(cloneRow(state.editor.rows[i]));
      }
    }
    if (!replaced) { result.push(row); }
    result.sort(function (a, b) { return a.id - b.id; });
    return result;
  }

  function writeCsvToHandle(handle, text, filename, onSuccess, onError) {
    handle.createWritable().then(function (writable) {
      return writable.write(text).then(function () { return writable.close(); });
    }).then(function () {
      state.editor.fileHandle = handle;
      onSuccess(filename);
    }).catch(onError);
  }

  function requestReadWritePermission(handle, onSuccess, onError) {
    var options = { mode: "readwrite" };
    if (!handle || !handle.requestPermission || !handle.queryPermission) {
      onError(new Error("このブラウザーではCSVへの書き込み権限を取得できません。"));
      return;
    }
    handle.queryPermission(options).then(function (permission) {
      if (permission === "granted") { onSuccess(); return; }
      return handle.requestPermission(options).then(function (requested) {
        if (requested === "granted") { onSuccess(); return; }
        onError(new Error("CSVへの書き込みが許可されませんでした。"));
      });
    }).catch(onError);
  }

  function overwriteLocalCsv(text, filename, onSuccess, onError) {
    if (!state.editor.fileHandle) {
      onError(new Error("書き込み可能なCSVが開かれていません。"));
      return;
    }
    requestReadWritePermission(state.editor.fileHandle, function () {
      writeCsvToHandle(state.editor.fileHandle, text, filename, onSuccess, onError);
    }, onError);
  }

  function commitEditorRows(rows, currentId, filename, message) {
    state.editor.rows = rows;
    state.editor.outputFilename = filename;
    state.editor.currentId = currentId;
    state.editor.previousId = null;
    state.editor.isNew = false;
    setEditorDirty(false);
    byId("editorFilename").textContent = filename;
    byId("editorFileSummary").textContent = filename + "／" + rows.length.toLocaleString("ja-JP") + "件";
    renderEditorRecordList();
    if (currentId !== null) { openEditorRecord(currentId); }
    if (state.previewMode) { activateData(cloneRows(rows), true, filename); }
    showToast(message);
  }

  function saveEditorRecord(afterSave) {
    var form = byId("recordEditorForm");
    var row;
    var rows;
    var filename;
    var text;
    if (!form.checkValidity()) {
      form.reportValidity();
      byId("recordEditorMessage").textContent = "必須項目を入力してください。";
      return;
    }
    try {
      row = editorRowFromForm();
      rows = makeEditorCandidate(row);
      filename = state.editor.filename;
      text = STILocalDb.serialize(rows);
      STILocalDb.parse(text, filename);
    } catch (error) {
      byId("recordEditorMessage").textContent = error.message;
      return;
    }
    byId("recordEditorMessage").textContent = "CSVを更新しています…";
    overwriteLocalCsv(text, filename, function () {
      state.editor.nickname = row.notes2;
      byId("recordEditorMessage").textContent = "";
      commitEditorRows(rows, row.id, filename, "ID " + row.id + "をCSVへ反映しました。");
      if (afterSave) { afterSave(); }
    }, function (error) {
      if (error && error.name === "AbortError") {
        byId("recordEditorMessage").textContent = "更新がキャンセルされました。編集内容は未保存です。";
      } else {
        byId("recordEditorMessage").textContent = "CSVを更新できませんでした。Edgeのファイル書き込み権限を確認してください。";
      }
    });
  }

  function deleteEditorRecordNow() {
    var current = currentEditorRow();
    var nickname;
    var rows = [];
    var nextId = null;
    var filename;
    var text;
    var i;
    if (!current || state.editor.rows.length <= 1) {
      byId("recordEditorMessage").textContent = "最後の1件は削除できません。";
      return;
    }
    try { nickname = STILocalDb.validateNickname(byId("editNotes2").value); }
    catch (error) { byId("recordEditorMessage").textContent = error.message; return; }
    if (!window.confirm("ID " + current.id + "を削除しますか？この操作は保存先CSVへ反映されます。")) { return; }
    for (i = 0; i < state.editor.rows.length; i += 1) {
      if (state.editor.rows[i].id !== current.id) { rows.push(cloneRow(state.editor.rows[i])); }
    }
    nextId = rows[Math.min(state.editor.rows.indexOf(current), rows.length - 1)].id;
    filename = state.editor.filename;
    text = STILocalDb.serialize(rows);
    overwriteLocalCsv(text, filename, function () {
      state.editor.nickname = nickname;
      commitEditorRows(rows, nextId, filename, "ID " + current.id + "を削除して保存しました。");
    }, function (error) {
      byId("recordEditorMessage").textContent = error && error.name === "AbortError" ? "削除保存をキャンセルしました。" : "削除結果を保存できませんでした。";
    });
  }

  function navigateEditorRecord(direction) {
    var rows = editorSearchRows();
    var index = -1;
    var i;
    for (i = 0; i < rows.length; i += 1) {
      if (rows[i].id === state.editor.currentId) { index = i; break; }
    }
    if (index + direction >= 0 && index + direction < rows.length) {
      openEditorRecord(rows[index + direction].id);
    }
  }

  function discardEditorChanges() {
    var row;
    if (state.editor.isNew) {
      state.editor.currentId = state.editor.previousId || (state.editor.rows.length ? state.editor.rows[0].id : null);
      state.editor.previousId = null;
      state.editor.isNew = false;
    }
    row = currentEditorRow();
    if (row) { fillEditorForm(row, false); }
    else { setEditorDirty(false); }
    renderEditorRecordList();
  }

  function loadLocalCsvFile(file, handle) {
    var reader;
    if (!file) { return; }
    byId("editorMessage").textContent = "CSV形式を確認しています…";
    reader = new FileReader();
    reader.onload = function () {
      var rows;
      try {
        if (String(reader.result).indexOf("\uFFFD") >= 0) {
          throw new Error("UTF-8として読み取れない文字があります。ファイルは読み込まれませんでした。");
        }
        rows = STILocalDb.parse(reader.result, file.name);
      } catch (error) {
        byId("editorMessage").textContent = error.message;
        return;
      }
      if (state.previewMode) { restoreServerData(false); }
      state.editor.rows = cloneRows(rows);
      state.editor.filename = file.name;
      state.editor.outputFilename = file.name;
      state.editor.fileHandle = handle;
      state.editor.currentId = rows[0].id;
      state.editor.previousId = null;
      state.editor.isNew = false;
      state.editor.nickname = rows[0].notes2 && rows[0].notes2 !== "-" ? rows[0].notes2 : "";
      byId("editorWorkspace").hidden = false;
      byId("editorFilename").textContent = file.name;
      byId("editorFileSummary").textContent = file.name + "／" + rows.length.toLocaleString("ja-JP") + "件";
      byId("editorMessage").textContent = "";
      byId("editorSearch").value = "";
      openEditorRecord(rows[0].id);
      showToast(rows.length.toLocaleString("ja-JP") + "件をローカルで読み込みました。");
    };
    reader.onerror = function () {
      byId("editorMessage").textContent = "ファイルを読み取れませんでした。ファイルは読み込まれませんでした。";
    };
    reader.readAsText(file, "UTF-8");
  }

  function directFileEditingAvailable() {
    return !!(window.isSecureContext && window.showOpenFilePicker);
  }

  function openLocalCsvPicker() {
    var options;
    if (!directFileEditingAvailable()) {
      byId("editorMessage").textContent = "この環境ではCSVを直接更新できません。Windows版Edge 95以上で、localhostまたはHTTPSから開いてください。";
      return;
    }
    options = {
      multiple: false,
      types: [{ description: "R8db CSV", accept: { "text/csv": [".csv"] } }],
      excludeAcceptAllOption: true
    };
    window.showOpenFilePicker(options).then(function (handles) {
      var handle = handles && handles[0];
      if (!handle) { return; }
      requestReadWritePermission(handle, function () {
        handle.getFile().then(function (file) { loadLocalCsvFile(file, handle); }).catch(function () {
          byId("editorMessage").textContent = "CSVファイルを読み取れませんでした。";
        });
      }, function () {
        byId("editorMessage").textContent = "CSVへの読み書きが許可されませんでした。ファイルは読み込まれませんでした。";
      });
    }).catch(function (error) {
      if (!error || error.name !== "AbortError") {
        byId("editorMessage").textContent = "CSVファイルを開けませんでした。";
      }
    });
  }

  function updateEditorCapability() {
    var available = directFileEditingAvailable();
    byId("openLocalCsvButton").disabled = !available;
    if (!available) {
      byId("editorMessage").textContent = "CSV直接編集はWindows版Edge 95以上のlocalhostまたはHTTPS環境で利用できます。";
    }
  }

  function beginLocalPreview() {
    var filename = state.editor.outputFilename || state.editor.filename;
    var rows;
    try {
      rows = STILocalDb.parse(STILocalDb.serialize(state.editor.rows), filename);
    } catch (error) {
      byId("editorMessage").textContent = error.message;
      return;
    }
    state.session = null;
    STIHistory.usePreview(true);
    activateData(cloneRows(rows), true, filename);
    applySavedSettings();
    showViewDirect("setupView");
    showToast("ローカルDB確認モードを開始しました。");
  }

  function restoreServerData(showEditor) {
    state.session = null;
    STIHistory.usePreview(false);
    activateData(cloneRows(state.serverRows), false, "R8db.csv");
    applySavedSettings();
    if (showEditor) { showViewDirect("editorView"); }
  }

  function exitLocalPreview() {
    if (!state.previewMode) { return; }
    if (state.session && !window.confirm("ローカルDBの確認を終了して通常DBへ戻しますか？")) { return; }
    restoreServerData(true);
    showToast("通常のR8db.csvへ戻しました。");
  }

  function setupEvents() {
    addEventToAll("[data-view]", "click", function (event) {
      showView(event.currentTarget.getAttribute("data-view"));
    });
    addEventToAll("[data-start-mode]", "click", function (event) {
      selectMode(event.currentTarget.getAttribute("data-start-mode"));
      showView("setupView");
    });
    addEventToAll('input[name="mode"]', "change", modeRadioChanged);
    byId("categorySelect").addEventListener("change", categoryChanged);
    addEventToAll("#relatedGroupSelect, #importanceSelect, #difficultySelect, #orderSelect", "change", settingChanged);
    byId("questionCount").addEventListener("input", updateSetupSummary);
    byId("startValueInput").addEventListener("input", updateSetupSummary);
    addEventToAll("[data-count]", "click", function (event) {
      byId("questionCount").value = event.currentTarget.getAttribute("data-count");
      updateSetupSummary();
    });
    byId("setupForm").addEventListener("submit", function (event) {
      event.preventDefault();
      startSession(readConfig());
    });
    byId("homeButton").addEventListener("click", function () { showView("homeView"); });
    byId("nextButton").addEventListener("click", nextQuestion);
    byId("quitButton").addEventListener("click", quitSession);
    byId("printButton").addEventListener("click", printResults);
    byId("browsePrintButton").addEventListener("click", printBrowseRows);
    byId("retryButton").addEventListener("click", function () {
      if (state.lastConfig) { startSession(state.lastConfig); }
    });
    byId("resetHistoryButton").addEventListener("click", resetHistory);
    byId("openLocalCsvButton").addEventListener("click", function () {
      requestEditorAction(openLocalCsvPicker);
    });
    byId("editorSearch").addEventListener("input", renderEditorRecordList);
    byId("editorRecordSelect").addEventListener("change", function (event) {
      var id = event.target.value;
      renderEditorRecordList();
      requestEditorAction(function () { openEditorRecord(id); });
    });
    byId("previousRecordButton").addEventListener("click", function () {
      requestEditorAction(function () { navigateEditorRecord(-1); });
    });
    byId("previousRecordButtonTop").addEventListener("click", function () {
      requestEditorAction(function () { navigateEditorRecord(-1); });
    });
    byId("previousRecordButtonEditorTop").addEventListener("click", function () {
      requestEditorAction(function () { navigateEditorRecord(-1); });
    });
    byId("nextRecordButton").addEventListener("click", function () {
      requestEditorAction(function () { navigateEditorRecord(1); });
    });
    byId("nextRecordButtonTop").addEventListener("click", function () {
      requestEditorAction(function () { navigateEditorRecord(1); });
    });
    byId("nextRecordButtonEditorTop").addEventListener("click", function () {
      requestEditorAction(function () { navigateEditorRecord(1); });
    });
    byId("addRecordButton").addEventListener("click", function () { requestEditorAction(addEditorRecord); });
    byId("recordEditorForm").addEventListener("submit", function (event) {
      event.preventDefault();
      saveEditorRecord();
    });
    addEventToAll("[data-delete-record]", "click", function () {
      requestEditorAction(deleteEditorRecordNow);
    });
    byId("saveRecordButtonTop").addEventListener("click", function () { saveEditorRecord(); });
    byId("previewLocalDbButton").addEventListener("click", function () {
      requestEditorAction(beginLocalPreview);
    });
    byId("exitPreviewButton").addEventListener("click", exitLocalPreview);
    byId("saveAndLeaveButton").addEventListener("click", function () {
      saveEditorRecord(runPendingEditorAction);
    });
    byId("discardAndLeaveButton").addEventListener("click", function () {
      discardEditorChanges();
      runPendingEditorAction();
    });
    byId("continueEditingButton").addEventListener("click", function () {
      state.editor.pendingAction = null;
      closeEditorLeaveModal();
    });
    addEventToAll("#recordEditorForm input:not([readonly]), #recordEditorForm select, #recordEditorForm textarea", "input", function (event) {
      setEditorDirty(true);
      byId("recordEditorMessage").textContent = "";
      if (event.currentTarget.tagName.toLowerCase() === "textarea") { resizeEditorTextarea(event.currentTarget); }
    });
    addEventToAll("[data-text-size]", "click", function (event) {
      applyTextSize(event.currentTarget.getAttribute("data-text-size"), true);
    });
    byId("lawModalClose").addEventListener("click", closeLawModal);
    byId("lawModal").addEventListener("click", function (event) {
      if (event.target === byId("lawModal")) { closeLawModal(); }
    });
    document.addEventListener("keydown", function (event) {
      if ((event.key === "Escape" || event.keyCode === 27) && !byId("lawModal").hidden) {
        closeLawModal();
      }
    });
    window.addEventListener("afterprint", cleanupPrintMode);
    window.addEventListener("resize", resizeEditorTextareas);
    window.addEventListener("beforeunload", function (event) {
      if (!state.editor.dirty) { return; }
      event.preventDefault();
      event.returnValue = "";
      return "";
    });
  }

  function populateCategoryOptions() {
    var select = byId("categorySelect");
    var current = select.value;
    var seen = {};
    var names = [];
    var option;
    var i;
    clear(select);
    option = element("option", "", "すべて");
    option.value = "all";
    select.appendChild(option);
    for (i = 0; i < state.rows.length; i += 1) {
      if (state.rows[i].category && !seen[state.rows[i].category]) {
        seen[state.rows[i].category] = true;
        names.push(state.rows[i].category);
      }
    }
    names.sort(function (a, b) { return a.localeCompare(b, "ja"); });
    for (i = 0; i < names.length; i += 1) {
      option = element("option", "", names[i]);
      option.value = names[i];
      select.appendChild(option);
    }
    setSelectValue("categorySelect", current || "all");
  }

  function activateData(rows, preview, label) {
    var i;
    var groupNames = {};
    var groupCount = 0;
    var categories = {};
    var categoryCount = 0;
    state.rows = rows;
    state.rowsById = {};
    state.previewMode = !!preview;
    state.dataLabel = label || "R8db.csv";
    state.rows.sort(function (a, b) { return a.id - b.id; });
    for (i = 0; i < state.rows.length; i += 1) {
      state.rowsById[state.rows[i].id] = state.rows[i];
      if (state.rows[i].category && !categories[state.rows[i].category]) {
        categories[state.rows[i].category] = true;
        categoryCount += 1;
      }
      if (state.rows[i].category2 && !groupNames[state.rows[i].category2]) {
        groupNames[state.rows[i].category2] = true;
        groupCount += 1;
      }
    }
    state.ready = true;
    populateCategoryOptions();
    populateRelatedGroups(state.savedRelatedGroup);
    setLoading(preview ? "ローカルDB確認モード｜" + label + "｜" + rows.length.toLocaleString("ja-JP") + "件" : rows.length.toLocaleString("ja-JP") + "件の条文を利用できます", preview ? "preview" : "ready");
    byId("exitPreviewButton").hidden = !preview;
    byId("dataSummary").textContent = rows.length.toLocaleString("ja-JP") + "件・" + categoryCount + "大分類・" + groupCount + "関連法規グループを収録";
    byId("analysisTitle").textContent = preview ? "ローカルDB確認分析" : "学習分析";
    byId("resetHistoryButton").textContent = preview ? "確認履歴を消去" : "学習履歴を消去";
    document.querySelector("#analysisView .eyebrow").textContent = preview ? "確認用Cookieに保存された記録" : "Cookieに保存された記録";
    document.querySelector(".start-note").textContent = preview ? "確認結果は通常履歴とは別のCookieに保存されます。" : "学習結果はこのブラウザのCookieに保存されます。";
    byId("startButton").disabled = false;
    updateSetupSummary();
    renderAnalysis();
  }

  function dataLoaded(rows) {
    state.serverRows = cloneRows(rows);
    if (state.previewMode) { return; }
    STIHistory.usePreview(false);
    activateData(cloneRows(rows), false, "R8db.csv");
  }

  function dataFailed(error) {
    if (state.previewMode) { return; }
    state.ready = false;
    setLoading(error.message + " サーバーから開いているか確認してください。", "error");
    byId("formMessage").textContent = "条文データを読み込めないため、学習を開始できません。";
    byId("startButton").disabled = true;
  }

  function verifyBrandBeforeDbLoad() {
    var brand = byId("brandMark");
    var gate = byId("dbIntegrityGate");
    var value = brand ? String(brand.textContent || "") : "";
    if (value !== "北会") {
      gate.hidden = false;
      setLoading("ブランド文字を確認できないためDBを開けません。", "error");
      return false;
    }
    gate.hidden = true;
    return true;
  }

  function init() {
    setupEvents();
    updateEditorCapability();
    applyTextSize(STIHistory.loadDisplay(), false);
    applySavedSettings();
    updateSetupSummary();
    renderHomeStats();
    if (!STIHistory.cookiesAvailable()) {
      showToast("Cookieが利用できません。ブラウザの設定をご確認ください。");
    }
    if (verifyBrandBeforeDbLoad()) {
      STICsv.load("db/R8db.csv", dataLoaded, dataFailed);
    }
  }

  init();

  /* Modern Edge uses the same batch CSV editing workflow as IE mode. */
  function setupBatchEditorForModernEdge() {
    if (document.documentMode) { return; }
    var form = document.getElementById("recordEditorForm");
    var editorView = document.getElementById("editorView");
    var fieldIds = [
      "editId", "editImportance", "editDifficulty", "editCategory1", "editCategory2",
      "editOriginal", "editQuestion", "editExplanation", "editNotes2", "editNotes3",
      "editNotes4", "editNotes5"
    ];
    var batch = {
      rows: [],
      originalById: {},
      status: {},
      previousStatus: {},
      filename: "",
      fileHandle: null,
      currentId: null,
      previousId: null,
      isNew: false,
      dirty: false,
      loaded: false,
      nickname: ""
    };

    if (!form || !editorView || !window.STILocalDb) { return; }

    function byId(id) { return document.getElementById(id); }

    function stopEvent(event) {
      event.preventDefault();
      if (event.stopImmediatePropagation) { event.stopImmediatePropagation(); }
      event.stopPropagation();
    }

    function cloneRow(row) {
      return {
        id: row.id,
        importance: row.importance,
        difficulty: row.difficulty,
        category1: row.category1 || row.category,
        category2: row.category2 || "",
        category: row.category1 || row.category,
        original: row.original,
        question: row.question,
        explanation: row.explanation,
        notes1: row.notes1 || "",
        notes2: row.notes2 || "",
        notes3: row.notes3 || "",
        notes4: row.notes4 || "",
        notes5: row.notes5 || ""
      };
    }

    function cloneRows(rows) {
      var result = [];
      var i;
      for (i = 0; i < rows.length; i += 1) { result.push(cloneRow(rows[i])); }
      return result;
    }

    function indexOriginalRows(rows) {
      var i;
      batch.originalById = {};
      for (i = 0; i < rows.length; i += 1) {
        batch.originalById[String(rows[i].id)] = cloneRow(rows[i]);
      }
    }

    function recordStatus(id) { return batch.status[String(id)] || ""; }

    function hasChanges() {
      var key;
      for (key in batch.status) {
        if (batch.status.hasOwnProperty(key) && batch.status[key]) { return true; }
      }
      return false;
    }

    function activeRows() {
      var rows = [];
      var i;
      for (i = 0; i < batch.rows.length; i += 1) {
        if (recordStatus(batch.rows[i].id) !== "deleted") { rows.push(cloneRow(batch.rows[i])); }
      }
      rows.sort(function (a, b) { return a.id - b.id; });
      return rows;
    }

    function rowsEqual(a, b) {
      var fields = [
        "id", "importance", "difficulty", "category1", "category2", "original",
        "question", "explanation", "notes2", "notes3", "notes4", "notes5"
      ];
      var i;
      if (!a || !b) { return false; }
      for (i = 0; i < fields.length; i += 1) {
        if (String(a[fields[i]] === undefined ? "" : a[fields[i]]) !==
            String(b[fields[i]] === undefined ? "" : b[fields[i]])) { return false; }
      }
      return true;
    }

    function setMessage(message) { byId("editorMessage").textContent = message || ""; }

    function setDirty(dirty) {
      batch.dirty = !!dirty;
      byId("unsavedBadge").hidden = !batch.dirty;
    }

    function updateChangeSummary() {
      var added = 0;
      var edited = 0;
      var deleted = 0;
      var importance = { "1": 0, "2": 0, "3": 0, "4": 0 };
      var difficulty = { "初級": 0, "中級": 0, "上級": 0 };
      var key;
      var value;
      var i;
      for (key in batch.status) {
        if (!batch.status.hasOwnProperty(key)) { continue; }
        value = batch.status[key];
        if (value === "added") { added += 1; }
        else if (value === "edited") { edited += 1; }
        else if (value === "deleted") { deleted += 1; }
      }
      for (i = 0; i < batch.rows.length; i += 1) {
        importance[String(batch.rows[i].importance)] = (importance[String(batch.rows[i].importance)] || 0) + 1;
        difficulty[batch.rows[i].difficulty] = (difficulty[batch.rows[i].difficulty] || 0) + 1;
      }
      byId("editorAddedCount").textContent = added;
      byId("editorEditedCount").textContent = edited;
      byId("editorDeletedCount").textContent = deleted;
      byId("editorImportance1Count").textContent = importance["1"];
      byId("editorImportance2Count").textContent = importance["2"];
      byId("editorImportance3Count").textContent = importance["3"];
      byId("editorImportance4Count").textContent = importance["4"];
      byId("editorDifficultyBasicCount").textContent = difficulty["初級"];
      byId("editorDifficultyMiddleCount").textContent = difficulty["中級"];
      byId("editorDifficultyAdvancedCount").textContent = difficulty["上級"];
      byId("saveAllCsvButton").disabled = added + edited + deleted === 0;
    }

    function findRow(id) {
      var parsed = parseInt(id, 10);
      var i;
      for (i = 0; i < batch.rows.length; i += 1) {
        if (batch.rows[i].id === parsed) { return batch.rows[i]; }
      }
      return null;
    }

    function setFieldsDisabled(disabled, isNew) {
      var i;
      for (i = 0; i < fieldIds.length; i += 1) { byId(fieldIds[i]).disabled = !!disabled; }
      byId("editId").readOnly = !isNew;
      byId("editNotes1").disabled = false;
      byId("editNotes1").readOnly = true;
    }

    function resizeTextareas() {
      var ids = ["editOriginal", "editQuestion", "editExplanation"];
      var i;
      var item;
      for (i = 0; i < ids.length; i += 1) {
        item = byId(ids[i]);
        item.style.height = "auto";
        item.style.height = item.scrollHeight + "px";
      }
    }

    function fillForm(row, isNew) {
      var status = isNew ? "" : recordStatus(row.id);
      var deleted = status === "deleted";
      byId("editId").value = row.id || "";
      byId("editImportance").value = String(row.importance || 1);
      byId("editDifficulty").value = row.difficulty || "初級";
      byId("editCategory1").value = row.category1 || row.category || "会計";
      byId("editCategory2").value = row.category2 || "";
      byId("editOriginal").value = row.original || "";
      byId("editQuestion").value = row.question || "";
      byId("editExplanation").value = row.explanation || "";
      byId("editNotes1").value = row.notes1 || STILocalDb.dateStamp();
      byId("editNotes2").value = row.notes2 && row.notes2 !== "-" ? row.notes2 : batch.nickname;
      byId("editNotes3").value = row.notes3 || "";
      byId("editNotes4").value = row.notes4 || "";
      byId("editNotes5").value = row.notes5 || "";
      setFieldsDisabled(deleted, isNew);
      if (deleted) { byId("recordEditorTitle").textContent = "ID " + row.id + "（削除予定）"; }
      else if (status === "added") { byId("recordEditorTitle").textContent = "ID " + row.id + "（追加）"; }
      else if (status === "edited") { byId("recordEditorTitle").textContent = "ID " + row.id + "（編集済み）"; }
      else { byId("recordEditorTitle").textContent = isNew ? "新しいレコード" : "ID " + row.id + "を編集"; }
      byId("deleteRecordButton").disabled = !!isNew;
      byId("deleteRecordButtonTop").disabled = !!isNew;
      byId("deleteRecordButton").textContent = deleted ? "削除を取り消す" : "削除";
      byId("deleteRecordButtonTop").textContent = deleted ? "削除を取り消す" : "削除";
      byId("saveRecordButton").disabled = deleted;
      byId("saveRecordButtonTop").disabled = deleted;
      byId("recordEditorMessage").textContent = deleted ? "削除予定です。CSV保存前なら取り消せます。" : "";
      setDirty(!!isNew);
      window.setTimeout(resizeTextareas, 0);
    }

    function searchRows() {
      var query = byId("editorSearch").value.replace(/^\s+|\s+$/g, "").toLowerCase();
      var rows = [];
      var row;
      var text;
      var i;
      for (i = 0; i < batch.rows.length; i += 1) {
        row = batch.rows[i];
        text = [row.id, row.category1, row.category2, row.original].join(" ").toLowerCase();
        if (!query || text.indexOf(query) >= 0) { rows.push(row); }
      }
      return rows;
    }

    function statusPrefix(status) {
      if (status === "added") { return "【追加】"; }
      if (status === "edited") { return "【編集】"; }
      if (status === "deleted") { return "【削除予定】"; }
      return "";
    }

    function renderList() {
      var list = byId("editorRecordList");
      var select = byId("editorRecordSelect");
      var rows = searchRows();
      var button;
      var status;
      var label;
      var i;
      while (list.firstChild) { list.removeChild(list.firstChild); }
      list.hidden = false;
      select.hidden = true;
      for (i = 0; i < rows.length; i += 1) {
        status = recordStatus(rows[i].id);
        label = statusPrefix(status) + rows[i].id + "｜" + (rows[i].category2 || rows[i].category1) + "｜" +
          (rows[i].original.length > 28 ? rows[i].original.substring(0, 28) + "…" : rows[i].original);
        button = document.createElement("button");
        button.type = "button";
        button.className = "record-list-item";
        button.setAttribute("data-ie-record-id", String(rows[i].id));
        button.appendChild(document.createTextNode(label));
        button.style.display = "block";
        button.style.width = "100%";
        button.style.padding = "7px 8px";
        button.style.marginBottom = "3px";
        button.style.textAlign = "left";
        button.style.border = rows[i].id === batch.currentId ? "2px solid #244a61" : "1px solid #cfd8dc";
        button.style.backgroundColor = "#ffffff";
        if (status === "added") { button.style.backgroundColor = "#e6f4ea"; }
        else if (status === "edited") { button.style.backgroundColor = "#fff3cd"; }
        else if (status === "deleted") {
          button.style.backgroundColor = "#fde8e7";
          button.style.textDecoration = "line-through";
        }
        list.appendChild(button);
      }
      byId("editorRecordCount").textContent = rows.length.toLocaleString("ja-JP") + "件表示／全" + batch.rows.length.toLocaleString("ja-JP") + "件";
      list.style.maxHeight = "520px";
      list.style.overflowY = "auto";
      updateChangeSummary();
      updateNavigation(rows);
    }

    function updateNavigation(rows) {
      var index = -1;
      var position = byId("editorRecordPosition");
      var previousDisabled;
      var nextDisabled;
      var i;
      for (i = 0; i < rows.length; i += 1) {
        if (rows[i].id === batch.currentId) { index = i; break; }
      }
      previousDisabled = batch.isNew || index <= 0;
      nextDisabled = batch.isNew || index < 0 || index >= rows.length - 1;
      byId("previousRecordButton").disabled = previousDisabled;
      byId("previousRecordButtonTop").disabled = previousDisabled;
      byId("previousRecordButtonEditorTop").disabled = previousDisabled;
      byId("nextRecordButton").disabled = nextDisabled;
      byId("nextRecordButtonTop").disabled = nextDisabled;
      byId("nextRecordButtonEditorTop").disabled = nextDisabled;
      if (batch.isNew) {
        position.textContent = "現在のレコード：新規入力";
      } else if (index < 0) {
        position.textContent = rows.length ? "現在のレコード：検索結果外" : "現在のレコード：該当なし";
      } else {
        position.textContent = "現在のレコード：" + (index + 1).toLocaleString("ja-JP") + "件目／" + rows.length.toLocaleString("ja-JP") + "件";
      }
    }

    function openRecord(id) {
      var row = findRow(id);
      if (!row) { return; }
      batch.currentId = row.id;
      batch.previousId = null;
      batch.isNew = false;
      fillForm(row, false);
      renderList();
    }

    function rowFromForm() {
      var nickname = STILocalDb.validateNickname(byId("editNotes2").value);
      var row = {
        id: parseInt(byId("editId").value, 10),
        importance: parseInt(byId("editImportance").value, 10),
        difficulty: byId("editDifficulty").value,
        category1: byId("editCategory1").value.replace(/^\s+|\s+$/g, ""),
        category2: byId("editCategory2").value.replace(/^\s+|\s+$/g, ""),
        original: byId("editOriginal").value.replace(/^\s+|\s+$/g, ""),
        question: byId("editQuestion").value.replace(/^\s+|\s+$/g, ""),
        explanation: byId("editExplanation").value.replace(/^\s+|\s+$/g, ""),
        notes1: STILocalDb.dateStamp(),
        notes2: nickname,
        notes3: byId("editNotes3").value,
        notes4: byId("editNotes4").value,
        notes5: byId("editNotes5").value
      };
      row.category = row.category1;
      return row;
    }

    function commitCurrent() {
      var row;
      var original;
      var currentStatus;
      var i;
      var wasNew = batch.isNew;
      if (!form.checkValidity()) {
        if (form.reportValidity) { form.reportValidity(); }
        byId("recordEditorMessage").textContent = "必須項目を入力してください。";
        return false;
      }
      try { row = rowFromForm(); }
      catch (error) { byId("recordEditorMessage").textContent = error.message; return false; }

      if (batch.isNew) {
        if (findRow(row.id)) {
          byId("recordEditorMessage").textContent = "同じIDが既に存在します。";
          return false;
        }
        batch.rows.push(row);
        batch.rows.sort(function (a, b) { return a.id - b.id; });
        batch.status[String(row.id)] = "added";
      } else {
        currentStatus = recordStatus(batch.currentId);
        if (currentStatus === "deleted") { return false; }
        original = batch.originalById[String(batch.currentId)];
        for (i = 0; i < batch.rows.length; i += 1) {
          if (batch.rows[i].id === batch.currentId) { batch.rows[i] = row; break; }
        }
        if (currentStatus === "added") {
          batch.status[String(row.id)] = "added";
        } else if (original && rowsEqual(row, original)) {
          row.notes1 = original.notes1;
          batch.rows[i] = row;
          delete batch.status[String(row.id)];
        } else {
          batch.status[String(row.id)] = "edited";
        }
      }
      batch.nickname = row.notes2;
      if (wasNew) {
        batch.currentId = row.id;
        batch.isNew = false;
        setDirty(false);
        startAdd(row);
        setMessage("ID " + row.id + "の追加を確定しました。続けて次のレコードを入力できます。最後に「CSVを保存」を押してください。");
        return true;
      }
      batch.currentId = row.id;
      batch.isNew = false;
      setDirty(false);
      openRecord(row.id);
      setMessage("ID " + row.id + "の変更を確定しました。最後に「CSVを保存」を押してください。");
      return true;
    }

    function startAdd(sourceRow) {
      var maxId = 0;
      var source = sourceRow || findRow(batch.currentId);
      var template;
      var i;
      for (i = 0; i < batch.rows.length; i += 1) {
        if (batch.rows[i].id > maxId) { maxId = batch.rows[i].id; }
      }
      batch.previousId = source ? source.id : batch.currentId;
      batch.currentId = null;
      batch.isNew = true;
      byId("editorSearch").value = "";
      template = {
        id: maxId + 1,
        importance: source ? source.importance : 1,
        difficulty: source ? source.difficulty : "初級",
        category1: source ? (source.category1 || source.category || "") : "",
        category2: source ? (source.category2 || "") : "",
        notes2: source && source.notes2 && source.notes2 !== "-" ? source.notes2 : batch.nickname,
        notes3: source ? (source.notes3 || "") : "",
        notes4: source ? (source.notes4 || "") : "",
        notes5: source ? (source.notes5 || "") : ""
      };
      fillForm(template, true);
      setDirty(false);
      renderList();
      byId("editOriginal").focus();
    }

    function toggleDelete() {
      var row = findRow(batch.currentId);
      var status;
      var previous;
      var active;
      var next;
      var i;
      if (!row) { return; }
      status = recordStatus(row.id);
      if (status === "deleted") {
        previous = batch.previousStatus[String(row.id)] || "";
        if (previous) { batch.status[String(row.id)] = previous; }
        else { delete batch.status[String(row.id)]; }
        delete batch.previousStatus[String(row.id)];
        openRecord(row.id);
        setMessage("ID " + row.id + "の削除予定を取り消しました。");
        return;
      }
      active = activeRows();
      if (active.length <= 1) {
        byId("recordEditorMessage").textContent = "最後の1件は削除できません。";
        return;
      }
      if (!window.confirm("ID " + row.id + "を削除予定にしますか？CSV保存までは取り消せます。")) { return; }
      if (status === "added") {
        for (i = batch.rows.length - 1; i >= 0; i -= 1) {
          if (batch.rows[i].id === row.id) { batch.rows.splice(i, 1); break; }
        }
        delete batch.status[String(row.id)];
        next = batch.rows.length ? batch.rows[0].id : null;
        batch.currentId = next;
        if (next !== null) { openRecord(next); }
        renderList();
        setMessage("追加予定だったレコードを取り消しました。");
        return;
      }
      batch.previousStatus[String(row.id)] = status;
      batch.status[String(row.id)] = "deleted";
      setDirty(false);
      openRecord(row.id);
      setMessage("ID " + row.id + "を削除予定にしました。");
    }

    function navigate(direction) {
      var rows = searchRows();
      var index = -1;
      var i;
      for (i = 0; i < rows.length; i += 1) {
        if (rows[i].id === batch.currentId) { index = i; break; }
      }
      if (index + direction >= 0 && index + direction < rows.length) { openRecord(rows[index + direction].id); }
    }

    function readCsvFile(file, handle) {
      var reader = new FileReader();
      setMessage("CSV形式を確認しています…");
      reader.onload = function () {
        var rows;
        try {
          if (String(reader.result).indexOf("\uFFFD") >= 0) { throw new Error("UTF-8として読み取れない文字があります。"); }
          rows = STILocalDb.parse(reader.result, file.name);
        } catch (error) { setMessage(error.message); return; }
        batch.rows = cloneRows(rows);
        indexOriginalRows(rows);
        batch.status = {};
        batch.previousStatus = {};
        batch.filename = file.name;
        batch.fileHandle = handle;
        batch.currentId = rows[0].id;
        batch.previousId = null;
        batch.isNew = false;
        batch.dirty = false;
        batch.loaded = true;
        batch.nickname = rows[0].notes2 && rows[0].notes2 !== "-" ? rows[0].notes2 : "";
        byId("editorWorkspace").hidden = false;
        byId("editorFilename").textContent = file.name;
        byId("editorFileSummary").textContent = file.name + "／" + rows.length.toLocaleString("ja-JP") + "件";
        byId("editorSearch").value = "";
        byId("saveAllCsvButton").textContent = "CSVを保存";
        openRecord(rows[0].id);
        setMessage("ローカルCSVを読み込みました。編集後、最後にCSVを保存してください。");
      };
      reader.onerror = function () { setMessage("CSVファイルを読み取れませんでした。"); };
      reader.readAsText(file, "UTF-8");
    }

    function openCsv() {
      var options;
      if ((batch.dirty || hasChanges()) &&
          !window.confirm("CSVへ保存していない変更があります。別のCSVを開くと変更は失われます。続けますか？")) { return; }
      options = {
        multiple: false,
        types: [{ description: "R8db CSV", accept: { "text/csv": [".csv"] } }],
        excludeAcceptAllOption: true
      };
      window.showOpenFilePicker(options).then(function (handles) {
        var handle = handles && handles[0];
        if (!handle) { return; }
        handle.getFile().then(function (file) { readCsvFile(file, handle); }).catch(function () {
          setMessage("CSVファイルを読み取れませんでした。");
        });
      }).catch(function (error) {
        if (!error || error.name !== "AbortError") { setMessage("CSVファイルを開けませんでした。"); }
      });
    }

    function saveAll() {
      var rows;
      var text;
      if (!batch.loaded || !batch.fileHandle) { return; }
      if (batch.dirty && !commitCurrent()) { return; }
      if (!hasChanges()) { setMessage("保存する変更はありません。"); return; }
      rows = activeRows();
      try {
        text = STILocalDb.serialize(rows);
        STILocalDb.parse(text, batch.filename);
      } catch (error) { setMessage(error.message); return; }
      setMessage("CSVへ保存しています…");
      batch.fileHandle.createWritable().then(function (writable) {
        return writable.write(text).then(function () { return writable.close(); });
      }).then(function () {
        byId("saveAllCsvButton").textContent = "CSVを再保存";
        setMessage("変更内容をローカルCSVへ保存しました。");
      }).catch(function () {
        setMessage("CSV保存を開始できませんでした。変更内容は画面内に残っています。");
      });
    }

    function editorField(target) {
      var id = target && target.id;
      var i;
      if (!id) { return false; }
      for (i = 0; i < fieldIds.length; i += 1) {
        if (fieldIds[i] === id) { return true; }
      }
      return false;
    }

    document.addEventListener("click", function (event) {
      var target = event.target;
      var id = target && target.id;
      var recordId = target && target.getAttribute ? target.getAttribute("data-ie-record-id") : null;
      if (!editorView.contains(target)) { return; }
      if (recordId) {
        stopEvent(event);
        if (batch.dirty && !window.confirm("現在入力中の変更を破棄して別のレコードへ移動しますか？")) { return; }
        setDirty(false);
        openRecord(recordId);
        return;
      }
      if (id === "openLocalCsvButton") { stopEvent(event); openCsv(); return; }
      if (!batch.loaded) { return; }
      if (id === "addRecordButton") {
        stopEvent(event);
        if (batch.dirty && !window.confirm("現在入力中の変更を破棄して新規追加へ移動しますか？")) { return; }
        setDirty(false);
        startAdd();
        return;
      }
      if (id === "saveRecordButton" || id === "saveRecordButtonTop") { stopEvent(event); commitCurrent(); return; }
      if (id === "deleteRecordButton" || id === "deleteRecordButtonTop" ||
          (target.getAttribute && target.getAttribute("data-delete-record") !== null)) {
        stopEvent(event);
        toggleDelete();
        return;
      }
      if (id === "previousRecordButton" || id === "previousRecordButtonTop" ||
          id === "previousRecordButtonEditorTop" || id === "nextRecordButton" ||
          id === "nextRecordButtonTop" || id === "nextRecordButtonEditorTop") {
        stopEvent(event);
        if (batch.dirty && !window.confirm("現在入力中の変更を破棄して移動しますか？")) { return; }
        setDirty(false);
        navigate(id === "previousRecordButton" || id === "previousRecordButtonTop" ||
          id === "previousRecordButtonEditorTop" ? -1 : 1);
        return;
      }
      if (id === "saveAllCsvButton") { stopEvent(event); saveAll(); return; }
      if (id === "previewLocalDbButton") {
        stopEvent(event);
        setMessage("一括編集内容をCSV保存後に確認してください。");
      }
    }, true);

    document.addEventListener("submit", function (event) {
      if (event.target === form && batch.loaded) { stopEvent(event); commitCurrent(); }
    }, true);

    document.addEventListener("input", function (event) {
      if (!editorView.contains(event.target) || !batch.loaded) { return; }
      if (event.target.id === "editorSearch") {
        if (event.stopImmediatePropagation) { event.stopImmediatePropagation(); }
        event.stopPropagation();
        renderList();
      } else if (editorField(event.target)) {
        if (event.stopImmediatePropagation) { event.stopImmediatePropagation(); }
        event.stopPropagation();
        setDirty(true);
        byId("recordEditorMessage").textContent = "";
        if (event.target.tagName.toLowerCase() === "textarea") { resizeTextareas(); }
      }
    }, true);

    document.addEventListener("change", function (event) {
      if (!editorView.contains(event.target) || !batch.loaded) { return; }
      if (editorField(event.target)) {
        if (event.stopImmediatePropagation) { event.stopImmediatePropagation(); }
        event.stopPropagation();
        setDirty(true);
      }
    }, true);

    window.addEventListener("beforeunload", function (event) {
      if (!batch.dirty && !hasChanges()) { return; }
      event.returnValue = "";
      return "";
    });

    byId("editorRecordList").hidden = false;
    byId("editorRecordSelect").hidden = true;
    byId("saveAllCsvButton").disabled = true;
    setMessage("ローカルCSVを開き、複数件を編集して最後にCSVを保存できます。");
  }

  document.addEventListener("DOMContentLoaded", setupBatchEditorForModernEdge);

}());
