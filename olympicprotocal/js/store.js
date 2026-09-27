/* 数据存取：localStorage 持久化 + 导入导出 */

window.OP = window.OP || {};

(function (OP) {
  "use strict";

  var KEY = "olympic-protocal.data.v1";
  var FIRED_KEY = "olympic-protocal.fired.v1";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function defaults() {
    return clone(OP.DEFAULT_DATA);
  }

  /* 把存档和默认值做一次浅层合并，避免旧存档缺字段导致界面报错 */
  function merge(saved) {
    var base = defaults();
    if (!saved || typeof saved !== "object") return base;

    if (saved.campus && Array.isArray(saved.campus.buildings) && saved.campus.buildings.length) {
      base.campus.name = saved.campus.name || base.campus.name;
      base.campus.buildings = saved.campus.buildings;
    }
    if (Array.isArray(saved.courses)) base.courses = saved.courses;
    if (saved.settings) {
      Object.keys(base.settings).forEach(function (k) {
        if (saved.settings[k] !== undefined) base.settings[k] = saved.settings[k];
      });
    }
    return base;
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return defaults();
      return merge(JSON.parse(raw));
    } catch (err) {
      console.warn("[OP] 读取本地数据失败，已回退到示例数据", err);
      return defaults();
    }
  }

  function save(data) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      console.warn("[OP] 保存失败", err);
      return false;
    }
  }

  function reset() {
    try {
      window.localStorage.removeItem(KEY);
    } catch (err) {
      /* 忽略：隐私模式下可能不可写 */
    }
    return defaults();
  }

  /* 已经播报过的提醒，按「日期 + 课程」记账，避免重复播报 */
  function loadFired() {
    try {
      var raw = window.localStorage.getItem(FIRED_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      return {};
    }
  }

  function saveFired(map) {
    try {
      window.localStorage.setItem(FIRED_KEY, JSON.stringify(map));
    } catch (err) {
      /* 忽略 */
    }
  }

  function uid(prefix) {
    return (prefix || "id") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function exportFile(data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = "olympic-protocal-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          resolve(merge(JSON.parse(String(reader.result))));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = function () { reject(reader.error || new Error("读取失败")); };
      reader.readAsText(file);
    });
  }

  OP.Store = {
    load: load,
    save: save,
    reset: reset,
    defaults: defaults,
    merge: merge,
    loadFired: loadFired,
    saveFired: saveFired,
    uid: uid,
    exportFile: exportFile,
    readFile: readFile
  };
})(window.OP);
