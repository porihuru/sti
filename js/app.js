(function () {
  "use strict";

  var state = {
    rows: [],
    rowsById: {},
    ready: false,
    session: null,
    lastConfig: null
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

  function showView(id) {
    var views = document.querySelectorAll(".view");
    var i;
    for (i = 0; i < views.length; i += 1) {
      views[i].classList.remove("active");
    }
    byId(id).classList.add("active");
    if (id === "homeView") { renderHomeStats(); }
    if (id === "analysisView") { renderAnalysis(); }
    if (id === "setupView") { updateSetupSummary(); }
    window.scrollTo(0, 0);
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
    byId("selectedModeName").textContent = modeNames[config.mode];
    byId("eligibleCount").textContent = state.ready ? eligible.length + "件" : "--件";
    byId("conditionCategory").textContent = config.category === "all" ? "すべて" : config.category;
    byId("conditionImportance").textContent = config.importance === 1 ? "1のみ" : "1～" + config.importance;
    byId("conditionDifficulty").textContent = config.difficulty === "初級" ? "初級のみ" : "初級～" + config.difficulty;

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
    container.appendChild(element("span", "meta-badge", row.difficulty));
    container.appendChild(element("span", "meta-badge", "重要度 " + row.importance));
  }

  function renderQuestion() {
    var session = state.session;
    var area = byId("questionArea");
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
    var focusButton;
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
      focusButton = element("button", "focus-reading-button choice-focus-button", letters[i] + "を集中して読む");
      focusButton.type = "button";
      focusButton.setAttribute("data-focus-index", String(i));
      focusButton.addEventListener("click", fourChoiceFocusClick);
      choiceItem.appendChild(button);
      choiceItem.appendChild(focusButton);
      list.appendChild(choiceItem);
    }
    area.appendChild(list);
  }

  function fourChoiceFocusClick(event) {
    var index = parseInt(event.currentTarget.getAttribute("data-focus-index"), 10);
    var current = state.session.current;
    openLawModal("選択肢 " + letters[index] + " の全文", current.options[index].text, event.currentTarget);
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
    if (current.answered) { return; }
    current.answered = true;
    correct = judgement === current.isOriginal;
    button.classList.add("chosen");
    disableButtons(container);
    details = [{ row: current.target, explanation: current.isOriginal ? "表示された条文は元の正しい条文です。" : current.target.explanation }];
    finishAnswer(correct, current.target, details, current.text);
  }

  function answerFourChoice(index, button) {
    var session = state.session;
    var current = session.current;
    var option;
    var buttons;
    var i;
    var details = [];
    if (current.answered) { return; }
    current.answered = true;
    option = current.options[index];
    buttons = byId("questionArea").querySelectorAll(".choice-button");
    button.classList.add("chosen");
    for (i = 0; i < buttons.length; i += 1) {
      buttons[i].disabled = true;
      if (current.options[i].isAnswer) { buttons[i].classList.add("answer-correct"); }
    }
    if (!option.isAnswer) { button.classList.add("answer-wrong"); }
    for (i = 0; i < current.options.length; i += 1) {
      if (current.options[i].isWrongText) {
        details.push({ row: current.options[i].row, explanation: current.options[i].row.explanation });
      }
    }
    finishAnswer(option.isAnswer, current.target, details, option.text);
  }

  function finishAnswer(correct, target, details, selectedText) {
    var session = state.session;
    var panel = byId("feedbackPanel");
    var nextButton = byId("nextButton");
    session[correct ? "correct" : "wrong"] += 1;
    session.answers.push({
      number: session.index + 1,
      row: target,
      correct: correct,
      selectedText: selectedText,
      details: details
    });
    STIHistory.record(target, session.config.mode, correct);
    renderHomeStats();

    panel.hidden = false;
    panel.className = "feedback-panel " + (correct ? "correct" : "incorrect");
    byId("resultSymbol").textContent = correct ? "○" : "×";
    byId("feedbackTitle").textContent = correct ? "正解です" : "不正解です";
    renderFeedbackBody(target, details);
    nextButton.textContent = session.index === session.rows.length - 1 ? "結果を見る" : "次の問題へ";
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderFeedbackBody(target, details) {
    var body = byId("feedbackBody");
    var correctSection = element("section", "feedback-section");
    var i;
    var section;
    clear(body);
    correctSection.appendChild(element("h3", "", "正しい条文（ID " + target.id + "）"));
    correctSection.appendChild(createLawReader(target.original, "正しい条文（ID " + target.id + "）", "feedback-law-reader"));
    body.appendChild(correctSection);
    for (i = 0; i < details.length; i += 1) {
      section = element("section", "feedback-section");
      section.appendChild(element("h3", "", details.length > 1 ? "変更箇所の解説（ID " + details[i].row.id + "）" : "変更箇所と解説"));
      section.appendChild(element("p", "", details[i].explanation));
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
    return (config.category === "all" ? "全カテゴリ" : config.category) + "／重要度1～" + config.importance + "／" +
      (config.difficulty === "初級" ? "初級" : "初級～" + config.difficulty);
  }

  function renderResults() {
    var session = state.session;
    var total = session.answers.length;
    var summary = byId("resultSummary");
    var conditions = byId("reportConditions");
    var detailsContainer = byId("resultDetails");
    var wrongAnswers = [];
    var i;
    var score;
    var stat;
    var entry;
    var detail;

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
    addCondition(conditions, "所要時間", elapsedText(session.startedAt, new Date()));
    byId("reportDate").textContent = formatDate(new Date());

    for (i = 0; i < session.answers.length; i += 1) {
      if (!session.answers[i].correct) { wrongAnswers.push(session.answers[i]); }
    }
    clear(detailsContainer);
    detailsContainer.appendChild(element("h2", "", "不正解だった問題"));
    if (!wrongAnswers.length) {
      detailsContainer.appendChild(element("p", "empty-state", "全問正解です。不得意問題の記録も改善されます。"));
    } else {
      for (i = 0; i < wrongAnswers.length; i += 1) {
        entry = element("article", "result-entry");
        entry.appendChild(element("h3", "", "第" + wrongAnswers[i].number + "問　ID " + wrongAnswers[i].row.id + "・" + wrongAnswers[i].row.category));
        entry.appendChild(element("p", "", "正しい条文：" + wrongAnswers[i].row.original));
        for (detail = 0; detail < wrongAnswers[i].details.length; detail += 1) {
          entry.appendChild(element("p", "entry-explanation", wrongAnswers[i].details[detail].explanation));
        }
        detailsContainer.appendChild(entry);
      }
    }
    showView("resultView");
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
    if (!window.confirm("正解数、不正解数、不得意問題、前回の設定をすべて消去します。よろしいですか？")) { return; }
    STIHistory.reset();
    renderHomeStats();
    renderAnalysis();
    showToast("学習履歴を消去しました。");
  }

  function printResults() {
    document.body.classList.add("print-result");
    window.print();
    window.setTimeout(function () { document.body.classList.remove("print-result"); }, 1000);
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

  function setupEvents() {
    addEventToAll("[data-view]", "click", function (event) {
      showView(event.currentTarget.getAttribute("data-view"));
    });
    addEventToAll("[data-start-mode]", "click", function (event) {
      selectMode(event.currentTarget.getAttribute("data-start-mode"));
      showView("setupView");
    });
    addEventToAll('input[name="mode"]', "change", modeRadioChanged);
    addEventToAll("#categorySelect, #importanceSelect, #difficultySelect, #orderSelect", "change", settingChanged);
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
    byId("retryButton").addEventListener("click", function () {
      if (state.lastConfig) { startSession(state.lastConfig); }
    });
    byId("resetHistoryButton").addEventListener("click", resetHistory);
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
    window.addEventListener("afterprint", function () { document.body.classList.remove("print-result"); });
  }

  function dataLoaded(rows) {
    var i;
    state.rows = rows;
    state.rows.sort(function (a, b) { return a.id - b.id; });
    for (i = 0; i < state.rows.length; i += 1) { state.rowsById[state.rows[i].id] = state.rows[i]; }
    state.ready = true;
    setLoading(rows.length.toLocaleString("ja-JP") + "件の条文を利用できます", "ready");
    byId("dataSummary").textContent = rows.length.toLocaleString("ja-JP") + "件・4カテゴリの条文を収録";
    byId("startButton").disabled = false;
    updateSetupSummary();
    renderAnalysis();
  }

  function dataFailed(error) {
    state.ready = false;
    setLoading(error.message + " サーバーから開いているか確認してください。", "error");
    byId("formMessage").textContent = "条文データを読み込めないため、学習を開始できません。";
    byId("startButton").disabled = true;
  }

  function init() {
    setupEvents();
    applyTextSize(STIHistory.loadDisplay(), false);
    applySavedSettings();
    updateSetupSummary();
    renderHomeStats();
    if (!STIHistory.cookiesAvailable()) {
      showToast("Cookieが利用できません。ブラウザの設定をご確認ください。");
    }
    STICsv.load("db/R8db.csv", dataLoaded, dataFailed);
  }

  init();
}());
