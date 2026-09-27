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

  /**
   * 楼栋按名字排序。
   *
   * 用浏览器自带的多语言排序：英文按字母，中文按拼音，数字按大小
   * （"Building 2" 排在 "Building 10" 前面，而不是按字符逐位比）。
   * sensitivity: "base" 让大小写不参与比较。
   */
  function compareBuildings(a, b) {
    return String((a && a.name) || "").localeCompare(String((b && b.name) || ""), "zh-Hans", {
      numeric: true,
      sensitivity: "base"
    });
  }

  function sortBuildings(list) {
    return (list || []).slice().sort(compareBuildings);
  }

  function normalize(data) {
    if (data && data.campus) {
      data.campus.buildings = sortBuildings(data.campus.buildings);
    }
    return data;
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
      if (!raw) return normalize(defaults());
      return normalize(merge(JSON.parse(raw)));
    } catch (err) {
      console.warn("[OP] 读取本地数据失败，已回退到示例数据", err);
      return normalize(defaults());
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
    return normalize(defaults());
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
          resolve(JSON.parse(String(reader.result)));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = function () { reject(reader.error || new Error("读取失败")); };
      reader.readAsText(file);
    });
  }

  /* 导入时按名字去重后追加楼栋，返回实际加了几栋 */
  function appendBuildings(current, incoming) {
    var list = (current.campus && current.campus.buildings) || [];
    var known = {};

    list.forEach(function (b) {
      known[b.name] = true;
      (b.alias || []).forEach(function (a) { known[a] = true; });
    });

    var added = 0;
    (incoming || []).forEach(function (b) {
      if (!b || !b.name) return;
      var clash = known[b.name] || (b.alias || []).some(function (a) { return known[a]; });
      if (clash) return;

      list.push(b);
      known[b.name] = true;
      (b.alias || []).forEach(function (a) { known[a] = true; });
      added++;
    });

    current.campus.buildings = list;
    return added;
  }

  /**
   * 把导入的内容并到**当前数据**上，而不是并到示例数据上。
   *
   * 这里踩过一个坑：原来是把导入内容和默认数据合并，
   * 所以导入一个"只有楼栋、没有课表"的文件时，课表会被示例课程顶掉。
   *
   * 另外，只带楼栋的文件按**追加**处理（按名字去重），
   * 因为那种文件的意思显然是"再加几栋楼"，不是"把楼栋全换掉"。
   *
   * @returns {{ addedBuildings: number, replacedCourses: boolean }}
   */
  function applyImport(current, saved) {
    var result = { addedBuildings: 0, replacedCourses: false };
    if (!saved || typeof saved !== "object") return result;

    var hasCourses = Array.isArray(saved.courses);
    var incomingBuildings = (saved.campus && Array.isArray(saved.campus.buildings))
      ? saved.campus.buildings : null;

    if (saved.campus && saved.campus.name) {
      current.campus.name = saved.campus.name;
    }

    if (incomingBuildings) {
      if (hasCourses) {
        /* 带课表的文件是完整备份，楼栋整体替换 */
        current.campus.buildings = incomingBuildings;
      } else {
        /* 只带楼栋的文件，按追加处理 */
        result.addedBuildings = appendBuildings(current, incomingBuildings);
      }
    }

    if (hasCourses) {
      current.courses = saved.courses;
      result.replacedCourses = true;
    }

    if (saved.settings) {
      Object.keys(current.settings).forEach(function (k) {
        if (saved.settings[k] !== undefined) current.settings[k] = saved.settings[k];
      });
    }

    return result;
  }

  OP.Store = {
    load: load,
    save: save,
    reset: reset,
    defaults: defaults,
    sortBuildings: sortBuildings,
    compareBuildings: compareBuildings,
    merge: merge,
    loadFired: loadFired,
    saveFired: saveFired,
    uid: uid,
    exportFile: exportFile,
    readFile: readFile,
    applyImport: applyImport,
    appendBuildings: appendBuildings
  };
})(window.OP);
