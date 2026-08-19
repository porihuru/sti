from pathlib import Path
import re

p = Path('js/app.js')
s = p.read_text(encoding='utf-8')

def sub_once(pattern, replacement, text, name):
    out, n = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(name + ' not found')
    return out

answer_true_false = '''  function answerTrueFalse(judgement, button, container) {
    var current = state.session.current;
    var correct;
    var details;
    var answerInfo;
    if (current.answered) { return; }
    current.answered = true;
    correct = judgement === current.isOriginal;
    button.classList.add("chosen");
    disableButtons(container);
    details = [{ row: current.target, explanation: current.isOriginal ? "表示された条文は元の正しい条文です。" : current.target.explanation }];
    answerInfo = {
      mode: "trueFalse",
      questionText: current.text,
      userAnswer: judgement ? "正しい条文" : "誤った条文",
      correctAnswer: current.isOriginal ? "正しい条文" : "誤った条文",
      resultDetails: details
    };
    finishAnswer(correct, current.target, details, answerInfo);
  }

'''
s = sub_once(r'  function answerTrueFalse\(judgement, button, container\) \{.*?\n  \}\n\n(?=  function answerFourChoice)', answer_true_false, s, 'answerTrueFalse')

answer_four_choice = '''  function answerFourChoice(index, button) {
    var session = state.session;
    var current = session.current;
    var option;
    var buttons;
    var answerInfo;
    var resultDetails = [];
    var optionSnapshot = [];
    var correctIndex = -1;
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
      optionSnapshot.push({
        letter: letters[i],
        text: current.options[i].text,
        isAnswer: current.options[i].isAnswer
      });
    }
    if (!option.isAnswer) { button.classList.add("answer-wrong"); }
    for (i = 0; i < current.options.length; i += 1) {
      if (current.options[i].isWrongText) {
        details.push({ row: current.options[i].row, explanation: current.options[i].row.explanation });
      }
    }
    if (!option.isAnswer) {
      if (session.config.mode === "fourCorrect") {
        resultDetails.push({ row: option.row, explanation: option.row.explanation });
      } else {
        resultDetails.push({ row: current.target, explanation: current.target.explanation });
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

'''
s = sub_once(r'  function answerFourChoice\(index, button\) \{.*?\n  \}\n\n(?=  function finishAnswer)', answer_four_choice, s, 'answerFourChoice')

finish_answer = '''  function finishAnswer(correct, target, details, answerInfo) {
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
    renderFeedbackBody(target, details);
    nextButton.textContent = session.index === session.rows.length - 1 ? "結果を見る" : "次の問題へ";
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

'''
s = sub_once(r'  function finishAnswer\(correct, target, details, selectedText\) \{.*?\n  \}\n\n(?=  function renderFeedbackBody)', finish_answer, s, 'finishAnswer')

result_body = '''    clear(detailsContainer);
    detailsContainer.appendChild(element("h2", "", "出題順と回答結果"));
    for (i = 0; i < session.answers.length; i += 1) {
      entry = createResultEntry(session.answers[i]);
      detailsContainer.appendChild(entry);
    }
    showView("resultView");
'''
s = sub_once(r'    for \(i = 0; i < session\.answers\.length; i \+= 1\) \{.*?    showView\("resultView"\);\n', result_body, s, 'renderResults body')

helper = '''  function createResultEntry(answer) {
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

'''
marker = '  function addResultStat(container, label, value, suffix) {\n'
if marker not in s:
    raise SystemExit('addResultStat marker not found')
s = s.replace(marker, helper + marker, 1)

s = s.replace('    var wrongAnswers = [];\n', '', 1)
s = s.replace('    var stat;\n', '', 1)
s = s.replace('    var detail;\n', '', 1)

p.write_text(s, encoding='utf-8')
