(function () {
  "use strict";

  /* IE11 / Microsoft Edge IE mode only. */
  if (!document.documentMode) { return; }

  document.documentElement.className += " ie11-mode";

  /* IE11 implements the older Boolean form of scrollIntoView(). */
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

  if (window.HTMLFormElement && !HTMLFormElement.prototype.reportValidity) {
    HTMLFormElement.prototype.reportValidity = function () {
      return this.checkValidity ? this.checkValidity() : true;
    };
  }

  /* Minimal Promise implementation used by the IE file compatibility layer. */
  if (!window.Promise) {
    (function () {
      function runHandler(promise, handler) {
        window.setTimeout(function () {
          var callback = promise._state === 1 ? handler.onFulfilled : handler.onRejected;
          if (!callback) {
            if (promise._state === 1) { handler.resolve(promise._value); }
            else { handler.reject(promise._value); }
            return;
          }
          try { handler.resolve(callback(promise._value)); }
          catch (error) { handler.reject(error); }
        }, 0);
      }

      function flush(promise) {
        var handlers = promise._handlers.slice(0);
        var i;
        promise._handlers.length = 0;
        for (i = 0; i < handlers.length; i += 1) { runHandler(promise, handlers[i]); }
      }

      function SimplePromise(executor) {
        var self = this;
        self._state = 0;
        self._value = undefined;
        self._handlers = [];

        function reject(reason) {
          if (self._state !== 0) { return; }
          self._state = 2;
          self._value = reason;
          flush(self);
        }

        function resolve(value) {
          var then;
          var called = false;
          if (self._state !== 0) { return; }
          if (value === self) { reject(new TypeError("Promise cannot resolve itself")); return; }
          if (value && (typeof value === "object" || typeof value === "function")) {
            try { then = value.then; }
            catch (error) { reject(error); return; }
            if (typeof then === "function") {
              try {
                then.call(value, function (nextValue) {
                  if (called) { return; }
                  called = true;
                  resolve(nextValue);
                }, function (reason) {
                  if (called) { return; }
                  called = true;
                  reject(reason);
                });
              } catch (error2) {
                if (!called) { reject(error2); }
              }
              return;
            }
          }
          self._state = 1;
          self._value = value;
          flush(self);
        }

        try { executor(resolve, reject); }
        catch (error3) { reject(error3); }
      }

      SimplePromise.prototype.then = function (onFulfilled, onRejected) {
        var self = this;
        return new SimplePromise(function (resolve, reject) {
          var handler = {
            onFulfilled: typeof onFulfilled === "function" ? onFulfilled : null,
            onRejected: typeof onRejected === "function" ? onRejected : null,
            resolve: resolve,
            reject: reject
          };
          if (self._state === 0) { self._handlers.push(handler); }
          else { runHandler(self, handler); }
        });
      };
      SimplePromise.prototype.catch = function (onRejected) { return this.then(null, onRejected); };
      SimplePromise.resolve = function (value) {
        return new SimplePromise(function (resolve) { resolve(value); });
      };
      SimplePromise.reject = function (reason) {
        return new SimplePromise(function (resolve, reject) { reject(reason); });
      };
      window.Promise = SimplePromise;
    }());
  }

  /* File System Access API surface needed by app.js. */
  if (!window.showOpenFilePicker && window.FileReader && window.Blob &&
      window.navigator && window.navigator.msSaveBlob) {
    window.isSecureContext = true;

    window.showOpenFilePicker = function () {
      return new window.Promise(function (resolve, reject) {
        var previous = document.getElementById("ie11CsvPicker");
        var input;
        if (previous && previous.parentNode) { previous.parentNode.removeChild(previous); }
        input = document.createElement("input");
        input.id = "ie11CsvPicker";
        input.type = "file";
        input.accept = ".csv,text/csv";
        input.style.position = "absolute";
        input.style.left = "-9999px";
        input.style.width = "1px";
        input.style.height = "1px";

        input.onchange = function () {
          var file = input.files && input.files[0];
          var handle;
          if (input.parentNode) { input.parentNode.removeChild(input); }
          if (!file) {
            reject({ name: "AbortError", message: "CSV selection cancelled" });
            return;
          }
          handle = {
            name: file.name,
            queryPermission: function () { return window.Promise.resolve("granted"); },
            requestPermission: function () { return window.Promise.resolve("granted"); },
            getFile: function () { return window.Promise.resolve(file); },
            createWritable: function () {
              var outputText = "";
              return window.Promise.resolve({
                write: function (value) {
                  outputText = String(value === undefined || value === null ? "" : value);
                  return window.Promise.resolve();
                },
                close: function () {
                  return new window.Promise(function (closeResolve, closeReject) {
                    var blob;
                    var started;
                    try {
                      blob = new Blob([outputText], { type: "text/csv;charset=utf-8" });
                      started = window.navigator.msSaveBlob(blob, file.name || "R8db.csv");
                      if (started === false) {
                        closeReject(new Error("CSV保存を開始できませんでした。"));
                        return;
                      }
                      closeResolve();
                    } catch (saveError) { closeReject(saveError); }
                  });
                }
              });
            }
          };
          resolve([handle]);
        };

        document.body.appendChild(input);
        try { input.click(); }
        catch (clickError) {
          if (input.parentNode) { input.parentNode.removeChild(input); }
          reject(clickError);
        }
      });
    };
  }

  /*
   * IE-mode batch editor.
   * Record changes stay in memory until the user presses "CSVを保存".
   * Added/edited/deleted records remain visible with distinct status colors.
   */
  function setupIeBatchEditor() {
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
      var key;
      var value;
      for (key in batch.status) {
        if (!batch.status.hasOwnProperty(key)) { continue; }
        value = batch.status[key];
        if (value === "added") { added += 1; }
        else if (value === "edited") { edited += 1; }
        else if (value === "deleted") { deleted += 1; }
      }
      byId("editorAddedCount").textContent = added;
      byId("editorEditedCount").textContent = edited;
      byId("editorDeletedCount").textContent = deleted;
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
      var i;
      for (i = 0; i < rows.length; i += 1) {
        if (rows[i].id === batch.currentId) { index = i; break; }
      }
      byId("previousRecordButton").disabled = batch.isNew || index <= 0;
      byId("nextRecordButton").disabled = batch.isNew || index < 0 || index >= rows.length - 1;
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
      setMessage("Windowsの保存画面を開いています…");
      batch.fileHandle.createWritable().then(function (writable) {
        return writable.write(text).then(function () { return writable.close(); });
      }).then(function () {
        byId("saveAllCsvButton").textContent = "CSVを再保存";
        setMessage("保存画面で元のR8db.csvを指定し、上書きしてください。変更内容は画面内にも残しています。");
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
      if (id === "previousRecordButton" || id === "nextRecordButton") {
        stopEvent(event);
        if (batch.dirty && !window.confirm("現在入力中の変更を破棄して移動しますか？")) { return; }
        setDirty(false);
        navigate(id === "previousRecordButton" ? -1 : 1);
        return;
      }
      if (id === "saveAllCsvButton") { stopEvent(event); saveAll(); return; }
      if (id === "previewLocalDbButton") {
        stopEvent(event);
        setMessage("IEモードでは一括編集内容をCSV保存後に確認してください。");
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
    setMessage("IEモード：ローカルCSVを開き、複数件を編集して最後にCSVを保存できます。");
  }

  document.addEventListener("DOMContentLoaded", setupIeBatchEditor);
}());
