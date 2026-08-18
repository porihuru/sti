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

  /* app.js uses reportValidity() in the local CSV editor. */
  if (window.HTMLFormElement && !HTMLFormElement.prototype.reportValidity) {
    HTMLFormElement.prototype.reportValidity = function () {
      return this.checkValidity ? this.checkValidity() : true;
    };
  }

  /*
   * Minimal Promise implementation for the File System Access compatibility
   * layer below. It intentionally implements only the features used by app.js:
   * constructor, then(), catch(), resolve() and reject().
   */
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
          try {
            handler.resolve(callback(promise._value));
          } catch (error) {
            handler.reject(error);
          }
        }, 0);
      }

      function flush(promise) {
        var handlers = promise._handlers.slice(0);
        var i;
        promise._handlers.length = 0;
        for (i = 0; i < handlers.length; i += 1) {
          runHandler(promise, handlers[i]);
        }
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
          if (value === self) {
            reject(new TypeError("Promise cannot resolve itself"));
            return;
          }
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

      SimplePromise.prototype.catch = function (onRejected) {
        return this.then(null, onRejected);
      };

      SimplePromise.resolve = function (value) {
        return new SimplePromise(function (resolve) { resolve(value); });
      };

      SimplePromise.reject = function (reason) {
        return new SimplePromise(function (resolve, reject) { reject(reason); });
      };

      window.Promise = SimplePromise;
    }());
  }

  /*
   * IE11 has FileReader and navigator.msSaveBlob(), but does not have the
   * Chromium File System Access API used by app.js. Emulate only the API
   * surface that the editor needs. Reading uses a temporary <input type=file>.
   * Saving opens the Windows/IE save UI; the user selects the original
   * R8db.csv and confirms overwrite.
   */
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
            queryPermission: function () {
              return window.Promise.resolve("granted");
            },
            requestPermission: function () {
              return window.Promise.resolve("granted");
            },
            getFile: function () {
              return window.Promise.resolve(file);
            },
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
                    } catch (saveError) {
                      closeReject(saveError);
                    }
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
}());
