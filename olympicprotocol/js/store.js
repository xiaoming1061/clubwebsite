/* 数据存取：localStorage 持久化 + 导入导出
 *
 * 三样东西分开存，各用各的键：
 *   olympic-protocol.buildings.v1 —— 校区名 + 楼栋（默认值来自 data/buildings.js）
 *   olympic-protocol.courses.v1   —— 课表
 *   olympic-protocol.settings.v1  —— 各种设置
 *
 * 分开的好处：换课表不会碰到楼栋，清空楼栋也不会把课表带走；
 * 楼栋还能整体换成别的校区，而课表照旧。
 * 导入导出仍然是一个整包 JSON，方便备份和换设备。
 */

window.OP = window.OP || {};

(function (OP) {
  "use strict";

  var BUILDINGS_KEY = "olympic-protocol.buildings.v1";
  var COURSES_KEY = "olympic-protocol.courses.v1";
  var SETTINGS_KEY = "olympic-protocol.settings.v1";
  var FIRED_KEY = "olympic-protocol.fired.v1";

  /* 更早的版本把三样东西塞在一个键里，读到就拆开写进新的三个键。
     第二个是那时拼错的拼写（protocal），一起认。 */
  var LEGACY_BUNDLE_KEYS = ["olympic-protocol.data.v1", "olympic-protocal.data.v1"];
  var LEGACY_FIRED_KEY = "olympic-protocal.fired.v1";

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

  /* ---------- localStorage 小工具 ---------- */

  function readRaw(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function readJSON(key) {
    var raw = readRaw(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function writeJSON(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function removeKey(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (err) {
      /* 忽略：隐私模式下可能不可写 */
    }
  }

  /* ---------- 默认楼栋的版本同步 ---------- */

  /* 最近一次 load() 补了什么（新楼、别名），界面拿它提示一句 */
  var lastSync = { added: [], aliased: [] };

  function shippedBuildings() {
    var shipped = OP.DEFAULT_BUILDINGS;
    if (!shipped || !Array.isArray(shipped.buildings)) {
      return { version: 0, name: "", buildings: [] };
    }
    return {
      version: Number(shipped.version) || 0,
      name: shipped.name || "",
      buildings: shipped.buildings
    };
  }

  /* 比对楼栋是否同一个：忽略大小写、空格和标点 */
  function buildingKey(text) {
    return String(text || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
  }

  function rememberKeys(index, building) {
    if (building.id) index["id:" + building.id] = building;
    if (building.name) index["n:" + buildingKey(building.name)] = building;
    (building.alias || []).forEach(function (alias) {
      if (alias) index["n:" + buildingKey(alias)] = building;
    });
  }

  /* 本地列表里有没有这栋（同 id、同名或同别名），有就返回它 */
  function findKnown(index, building) {
    if (building.id && index["id:" + building.id]) return index["id:" + building.id];
    if (building.name && index["n:" + buildingKey(building.name)]) {
      return index["n:" + buildingKey(building.name)];
    }
    var hit = null;
    (building.alias || []).forEach(function (alias) {
      if (!hit && alias && index["n:" + buildingKey(alias)]) {
        hit = index["n:" + buildingKey(alias)];
      }
    });
    return hit;
  }

  /**
   * 把默认楼栋里「本地还没有的」补进来，顺手把缺的别名补上。
   *
   * 只加不改：本地已有的（同 id、同名或同别名）保留原样，
   * 名字、坐标、用户自己写的别名都不会被默认值覆盖；
   * 只有"默认数据里有、本地没有"的别名才会追加进去——
   * 默认数据里改的是"课表上那种写法"，不补的话用户那边永远对不上。
   *
   * 为什么需要它：默认楼栋会跟着仓库更新（补录新楼、修正坐标），
   * 但用户一旦在本地存过楼栋，默认值就不再自动生效了——
   * 没有这一步，后来补录的楼永远进不到他们那儿。
   */
  function mergeShippedBuildings(list, shipped) {
    var index = {};
    list.forEach(function (b) { rememberKeys(index, b); });

    var added = [];
    var aliased = [];

    (shipped.buildings || []).forEach(function (b) {
      if (!b || !b.name) return;

      var local = findKnown(index, b);

      if (!local) {
        var copy = clone(b);
        list.push(copy);
        rememberKeys(index, copy);
        added.push(copy);
        return;
      }

      /* 已经在列表里：只补别名 */
      if (!Array.isArray(local.alias)) local.alias = [];
      (b.alias || []).forEach(function (alias) {
        if (!alias) return;
        var aliasKey = "n:" + buildingKey(alias);
        /* 别的楼已经占着这个名字了，就别硬塞，免得一栋楼被两处认领 */
        if (index[aliasKey] && index[aliasKey] !== local) return;
        if (local.alias.some(function (a) { return buildingKey(a) === aliasKey.slice(2); })) return;
        local.alias.push(alias);
        index[aliasKey] = local;
        aliased.push({ name: local.name, alias: alias });
      });
    });

    return { added: added, aliased: aliased };
  }

  /* ---------- 三份数据各自的合并规则 ---------- */

  /**
   * 楼栋：存过就用存的，哪怕是空的。
   *
   * 以前"空列表 = 没存过"，于是点了「清空全部」再刷新，楼栋会自己长回来。
   * 现在只有从来没存过楼栋时，才用 data/buildings.js 里的默认值。
   */
  function pickCampus(saved, fallback) {
    if (saved && Array.isArray(saved.buildings)) {
      return {
        name: saved.name || fallback.name,
        buildings: sortBuildings(saved.buildings)
      };
    }
    return {
      name: fallback.name,
      buildings: sortBuildings(fallback.buildings)
    };
  }

  /* 设置：按字段合并，旧存档缺哪个字段就用默认值，避免界面报错 */
  function pickSettings(saved, fallback) {
    var out = {};
    Object.keys(fallback).forEach(function (key) { out[key] = fallback[key]; });
    if (saved && typeof saved === "object") {
      Object.keys(out).forEach(function (key) {
        if (saved[key] !== undefined) out[key] = saved[key];
      });
    }
    return out;
  }

  /* 把三份数据拼成页面内部一直用的那个形状 */
  function compose(buildings, courses, settings) {
    var base = defaults();
    return {
      version: 1,
      campus: pickCampus(buildings, base.campus),
      courses: Array.isArray(courses) ? courses : base.courses,
      settings: pickSettings(settings, base.settings)
    };
  }

  function readLegacyBundle() {
    for (var i = 0; i < LEGACY_BUNDLE_KEYS.length; i++) {
      var parsed = readJSON(LEGACY_BUNDLE_KEYS[i]);
      if (parsed && typeof parsed === "object") return parsed;
    }
    return null;
  }

  function load() {
    var shipped = shippedBuildings();
    var parts = {
      buildings: readJSON(BUILDINGS_KEY),
      courses: readJSON(COURSES_KEY),
      settings: readJSON(SETTINGS_KEY)
    };

    /* 三个新键一个都没有，多半是有老版本留下的整包存档，拆开用 */
    var fromLegacy = false;
    if (!parts.buildings && !parts.courses && !parts.settings) {
      var bundle = readLegacyBundle();
      if (bundle) {
        parts.buildings = bundle.campus || null;
        parts.courses = Array.isArray(bundle.courses) ? bundle.courses : null;
        parts.settings = bundle.settings || null;
        fromLegacy = true;
      }
    }

    /* 默认楼栋有新版本就把缺的补进来。
       本地楼栋是空的时候不补：那是用户自己清空的，别硬塞回去。 */
    var sync = { added: [], aliased: [] };
    if (parts.buildings && Array.isArray(parts.buildings.buildings) &&
        parts.buildings.buildings.length &&
        shipped.version > (Number(parts.buildings.defaultVersion) || 0)) {
      sync = mergeShippedBuildings(parts.buildings.buildings, shipped);
      parts.buildings.defaultVersion = shipped.version;
    }

    var data = compose(parts.buildings, parts.courses, parts.settings);

    /* 拆老存档的时候要落盘，并把老键删掉。
       不删的话，「清空数据」之后老键还在，下次打开又会被拆一遍，
       看起来像数据自己长回来了。 */
    if (fromLegacy) {
      save(data);
      LEGACY_BUNDLE_KEYS.forEach(removeKey);
    } else if (sync.added.length || sync.aliased.length) {
      save(data);
    }

    lastSync = sync;
    return data;
  }

  function save(data) {
    try {
      writeJSON(BUILDINGS_KEY, {
        /* 记下这份列表已经合到哪一版默认楼栋，避免每次打开都重算一遍 */
        defaultVersion: shippedBuildings().version,
        name: (data.campus && data.campus.name) || "",
        buildings: (data.campus && data.campus.buildings) || []
      });
      writeJSON(COURSES_KEY, data.courses || []);
      writeJSON(SETTINGS_KEY, data.settings || {});
      return true;
    } catch (err) {
      console.warn("[OP] 保存失败", err);
      return false;
    }
  }

  function reset() {
    [BUILDINGS_KEY, COURSES_KEY, SETTINGS_KEY].concat(LEGACY_BUNDLE_KEYS).forEach(removeKey);
    return defaults();
  }

  /* 已经播报过的提醒，按「日期 + 课程」记账，避免重复播报 */
  function loadFired() {
    var raw = readRaw(FIRED_KEY);
    if (!raw) {
      /* 早先版本用的是拼错的键，搬过来。旧键留着不删，万一新键出问题还能退回去。 */
      raw = readRaw(LEGACY_FIRED_KEY);
      if (raw) {
        try { window.localStorage.setItem(FIRED_KEY, raw); } catch (err) { /* 忽略 */ }
      }
    }
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (err) {
      return {};
    }
  }

  function saveFired(map) {
    try {
      writeJSON(FIRED_KEY, map);
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
    a.download = "olympic-protocol-" + stamp + ".json";
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
   * 把导入的内容并到**当前数据**上，而不是并到默认数据上。
   *
   * 这里踩过一个坑：原来是把导入内容和默认数据合并，
   * 所以导入一个"只有楼栋、没有课表"的文件时，课表会被默认课程顶掉。
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
    /* 把一个整包存档并进默认值，返回页面内部的形状 */
    merge: function (saved) {
      if (!saved || typeof saved !== "object") return defaults();
      return compose(saved.campus, saved.courses, saved.settings);
    },
    loadFired: loadFired,
    saveFired: saveFired,
    uid: uid,
    exportFile: exportFile,
    readFile: readFile,
    applyImport: applyImport,
    appendBuildings: appendBuildings,
    /* 上一次 load() 补了什么：新增的楼栋、补上的别名（界面用来提示） */
    lastSync: function () {
      return { added: lastSync.added.slice(), aliased: lastSync.aliased.slice() };
    },
    /* 默认楼栋当前的版本号 */
    defaultBuildingsVersion: function () { return shippedBuildings().version; },
    KEYS: {
      buildings: BUILDINGS_KEY,
      courses: COURSES_KEY,
      settings: SETTINGS_KEY,
      fired: FIRED_KEY
    }
  };
})(window.OP);
