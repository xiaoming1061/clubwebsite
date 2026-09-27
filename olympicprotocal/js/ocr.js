/* 从课表截图里读出课程
 *
 * 思路不是"把字认出来"就完事，而是靠表格的几何结构还原内容：
 *   表头（Monday…Friday）决定列 → 左侧时间刻度决定纵轴 → 每个格子是一节课
 * 所以 OCR 只负责给出"哪些文字、在什么位置"，剩下的都是规则问题。
 *
 * 分两层：
 *   parseWords() 及以下全是纯函数，喂进去带坐标的文字就能出课程，可离线单测
 *   run() 是浏览器驱动层，负责图片预处理、调用 Tesseract、串起整条流程
 */

window.OP = window.OP || {};

(function (OP) {
  "use strict";

  /* Tesseract 从 CDN 按需加载，不打开 OCR 功能就不会下载 */
  var SCRIPT_CDNS = [
    "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist",
    "https://unpkg.com/tesseract.js@5.1.1/dist"
  ];
  var DEFAULT_LANG_PATH = "https://tessdata.projectnaptha.com/4.0.0";

  var WEEKDAY_EN = {
    monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3, weds: 3,
    thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5,
    saturday: 6, sat: 6, sunday: 7, sun: 7
  };

  var WEEKDAY_CN = {
    "星期一": 1, "星期一": 1, "周一": 1, "礼拜一": 1,
    "星期二": 2, "周二": 2, "礼拜二": 2,
    "星期三": 3, "周三": 3, "礼拜三": 3,
    "星期四": 4, "周四": 4, "礼拜四": 4,
    "星期五": 5, "周五": 5, "礼拜五": 5,
    "星期六": 6, "周六": 6, "礼拜六": 6,
    "星期日": 7, "星期天": 7, "周日": 7, "周天": 7, "礼拜日": 7, "礼拜天": 7
  };

  var TYPE_WORDS = [
    "lecture", "tutorial", "interactive tutorial", "laboratory", "lab", "seminar",
    "assembly", "workshop", "class", "practical", "studio", "field study",
    "讲座", "导修", "实验", "实验课", "大会", "研讨", "实践", "课程", "课"
  ];

  var NON_SECTION = ["lecture", "tutorial", "laboratory", "assembly", "waiting",
    "location", "venue", "tba", "am", "pm"];

  /* ================= 基础工具 ================= */

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function hm(text) {
    var p = String(text || "0:00").split(":");
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }

  function fmtMinutes(minutes) {
    var total = ((Math.round(minutes) % 1440) + 1440) % 1440;
    return pad2(Math.floor(total / 60)) + ":" + pad2(total % 60);
  }

  function snap5(minutes) { return Math.round(minutes / 5) * 5; }

  function median(numbers) {
    if (!numbers.length) return 0;
    var sorted = numbers.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function normKey(text) {
    return String(text || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
  }

  /* 把 OCR 常见的形近字符规整一下：时间里的 O/o 当 0，l/I 当 1 */
  function cleanTimeToken(token) {
    return String(token).replace(/[Oo]/g, "0").replace(/[lI]/g, "1");
  }

  function lower(text) { return String(text || "").toLowerCase(); }

  function isTypeWord(text) {
    var t = lower(text).trim();
    if (!t) return false;
    for (var i = 0; i < TYPE_WORDS.length; i++) {
      if (t === TYPE_WORDS[i]) return true;
    }
    return false;
  }

  function hasTypeWord(text) {
    var t = lower(text);
    for (var i = 0; i < TYPE_WORDS.length; i++) {
      if (TYPE_WORDS[i].length > 2 && t.indexOf(TYPE_WORDS[i]) >= 0) return true;
    }
    return false;
  }

  /* ================= 1. 表头：找出星期几在哪一列 ================= */

  function weekdayOf(text) {
    var raw = String(text || "").trim();
    if (!raw) return 0;
    var key = raw.replace(/[\s.,:：]/g, "");
    if (WEEKDAY_CN[key]) return WEEKDAY_CN[key];
    var en = lower(raw).replace(/[^a-z]/g, "");
    if (WEEKDAY_EN[en]) return WEEKDAY_EN[en];
    return 0;
  }

  /**
   * @returns {Array} 按 x 排序的表头 [{ day, x, y0, y1 }]
   */
  function parseWeekdayHeader(words) {
    var hits = [];
    (words || []).forEach(function (w) {
      var day = weekdayOf(w.text);
      if (!day) return;
      hits.push({
        day: day,
        x: (w.x0 + w.x1) / 2,
        y: (w.y0 + w.y1) / 2,
        y0: w.y0,
        y1: w.y1
      });
    });
    if (!hits.length) return [];

    hits.sort(function (a, b) { return a.y - b.y; });

    /* 只保留最上面那一组，避免把正文里出现的星期字样也算进来 */
    var heights = hits.map(function (h) { return h.y1 - h.y0; });
    var tolerance = Math.max(median(heights) * 1.6, 12);
    var top = hits[0].y;
    var header = hits.filter(function (h) { return Math.abs(h.y - top) <= tolerance; });

    /* 同一天只留最靠左的那个 */
    var byDay = {};
    header.forEach(function (h) {
      if (!byDay[h.day] || h.x < byDay[h.day].x) byDay[h.day] = h;
    });

    return Object.keys(byDay).map(function (k) { return byDay[k]; })
      .sort(function (a, b) { return a.x - b.x; });
  }

  /* 表头中心点之间取中点当列边界 */
  function buildColumns(header) {
    if (!header || header.length < 2) return [];

    return header.map(function (h, i) {
      var left, right;
      if (i === 0) {
        left = h.x - (header[1].x - header[0].x) / 2;
        right = (h.x + header[1].x) / 2;
      } else if (i === header.length - 1) {
        left = (header[i - 1].x + h.x) / 2;
        right = h.x + (h.x - header[i - 1].x) / 2;
      } else {
        left = (header[i - 1].x + h.x) / 2;
        right = (h.x + header[i + 1].x) / 2;
      }
      return { day: h.day, center: h.x, left: Math.max(0, left), right: right };
    });
  }

  /* ================= 2. 时间轴：纵坐标 → 时刻 ================= */

  /**
   * @param {Array} words
   * @param {number} maxX 只看这个 x 左边的文字（也就是左侧那一列刻度）
   */
  function buildTimeAxis(words, maxX) {
    var hits = [];

    (words || []).forEach(function (w) {
      var text = cleanTimeToken(String(w.text).trim());
      var m = /^([0-9]{1,2})[:.·]([0-9]{2})$/.exec(text);
      if (!m) return;
      var cx = (w.x0 + w.x1) / 2;
      if (maxX !== undefined && cx > maxX) return;
      hits.push({ y: (w.y0 + w.y1) / 2, minutes: parseInt(m[1], 10) * 60 + parseInt(m[2], 10) });
    });

    if (hits.length < 3) return null;
    hits.sort(function (a, b) { return a.y - b.y; });

    /* 截图常常把左边的时间刻度裁掉首位数（10:00 显示成 0:00），
       所以强制让时刻严格递增，靠加 60 分钟把缺掉的十位补回来 */
    for (var i = 1; i < hits.length; i++) {
      var guard = 0;
      while (hits[i].minutes <= hits[i - 1].minutes && guard < 40) {
        hits[i].minutes += 60;
        guard++;
      }
    }

    /* 最小二乘拟合 y → 分钟 */
    var n = hits.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    hits.forEach(function (h) {
      sx += h.y; sy += h.minutes; sxx += h.y * h.y; sxy += h.y * h.minutes;
    });
    var denom = n * sxx - sx * sx;
    if (!denom) return null;

    var k = (n * sxy - sx * sy) / denom;
    var b = (sy - k * sx) / n;

    return {
      points: hits,
      minutesPerPixel: k,
      toMinutes: function (y) { return k * y + b; },
      toY: function (minutes) { return (minutes - b) / k; }
    };
  }

  /* ================= 3. 把一列里的文字切成一个个格子 ================= */

  function splitBlocks(words, options) {
    options = options || {};
    var list = (words || []).slice().sort(function (a, b) { return a.y0 - b.y0; });
    if (!list.length) return [];

    var heights = list.map(function (w) { return w.y1 - w.y0; });
    var lineHeight = median(heights) || 20;

    if (list.length === 1) {
      return [{ words: list, y0: list[0].y0, y1: list[0].y1 }];
    }

    var gaps = [];
    for (var i = 1; i < list.length; i++) {
      gaps.push(Math.max(0, list[i].y0 - list[i - 1].y1));
    }
    var threshold = options.gap || Math.max(median(gaps) * 2.5, lineHeight * 0.8);

    var blocks = [];
    var current = { words: [list[0]], y0: list[0].y0, y1: list[0].y1 };
    blocks.push(current);

    for (var j = 1; j < list.length; j++) {
      if (list[j].y0 - current.y1 > threshold) {
        current = { words: [list[j]], y0: list[j].y0, y1: list[j].y1 };
        blocks.push(current);
      } else {
        current.words.push(list[j]);
        current.y1 = Math.max(current.y1, list[j].y1);
        current.y0 = Math.min(current.y0, list[j].y0);
      }
    }

    return blocks;
  }

  /* 一个格子里的文字按行合并成字符串数组 */
  function groupLines(words, tolerance) {
    var list = (words || []).slice().sort(function (a, b) {
      return a.y0 - b.y0 || a.x0 - b.x0;
    });
    if (!list.length) return [];

    var lineHeight = median(list.map(function (w) { return w.y1 - w.y0; })) || 20;
    var tol = tolerance || lineHeight * 0.6;

    var lines = [];
    var current = null;

    list.forEach(function (w) {
      var cy = (w.y0 + w.y1) / 2;
      if (current && Math.abs(cy - current.cy) <= tol) {
        current.words.push(w);
      } else {
        current = { cy: cy, words: [w] };
        lines.push(current);
      }
    });

    return lines.map(function (line) {
      return line.words
        .sort(function (a, b) { return a.x0 - b.x0; })
        .map(function (w) { return String(w.text).trim(); })
        .filter(function (t) { return t; })
        .join(" ");
    });
  }

  /* ================= 4. 解析一个格子 ================= */

  /* "Science Centre L5" → 楼栋 Science Centre，房间 L5 */
  function parseVenue(text) {
    var t = String(text || "")
      .replace(/^\s*(location|venue|地点|地點|教室|上课地点)\s*[:：]\s*/i, "")
      .trim();

    if (!t) return { building: "", room: "", tba: false };
    if (/^(tba|t\.b\.a\.?|待定|另定|to be announced|to be confirmed|tbc)$/i.test(t)) {
      return { building: "", room: "", tba: true };
    }

    var parts = t.split(/\s+/);
    if (parts.length >= 2) {
      var last = parts[parts.length - 1];
      /* 房间号长得像 504 / L5 / LT2 / C3 / 301A */
      if (/^[A-Z]{0,3}\d{1,4}[A-Z]?$/i.test(last)) {
        return { building: parts.slice(0, -1).join(" "), room: last, tba: false };
      }
    }
    return { building: t, room: "", tba: false };
  }

  /* 把 "BMEG 2410 - -" / "T02" 这类拼成课程全名 */
  function composeName(code, section, type) {
    var parts = [];
    if (code) parts.push(section ? code + "-" + section : code);
    if (type) parts.push(type);
    return parts.join(" ");
  }

  function parseBlockLines(lines) {
    var flat = lines.join(" ");
    var out = {
      code: "", section: "", type: "", start: "", end: "",
      buildingName: "", room: "", tba: false,
      waiting: /\bwaiting\b|候补|候補|待補|待补/i.test(flat),
      raw: lines.slice()
    };

    /* --- 时间 --- */
    var timeRegex = /([0-9OoIl]{1,2})\s*[:.·]\s*([0-9OoIl]{2})\s*[-–—~～至]\s*([0-9OoIl]{1,2})\s*[:.·]\s*([0-9OoIl]{2})/;
    var tm = timeRegex.exec(cleanTimeToken(flat));
    if (tm) {
      out.start = pad2(parseInt(tm[1], 10)) + ":" + tm[2];
      out.end = pad2(parseInt(tm[3], 10)) + ":" + tm[4];
    }

    /* --- 课程代码 --- */
    var cm = /\b([A-Z]{2,5})\s?([0-9]{3,4})\b/.exec(flat);
    var codeLineIndex = -1;
    if (cm) {
      out.code = cm[1] + " " + cm[2];
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf(cm[1]) >= 0 && lines[i].indexOf(cm[2]) >= 0) { codeLineIndex = i; break; }
      }

      /* 代码同一行的破折号后面就是课节号 */
      if (codeLineIndex >= 0) {
        var after = lines[codeLineIndex].slice(lines[codeLineIndex].indexOf(cm[2]) + cm[2].length);
        var sm = /\b([A-Z]{1,5}[0-9]{0,3})\b/.exec(after.replace(/[-–—]/g, " "));
        if (sm && !isTypeWord(sm[1]) && NON_SECTION.indexOf(lower(sm[1])) === -1) {
          out.section = sm[1];
        }
      }
    }

    /* --- 课节号另起一行的情况（BMEG 2410 - - / T02） --- */
    if (!out.section && codeLineIndex >= 0) {
      for (var k = codeLineIndex + 1; k < lines.length; k++) {
        var token = lines[k].trim();
        if (/^[0-9]/.test(token)) break;
        if (/^[A-Z]{1,5}[0-9]{0,3}$/.test(token) &&
            !isTypeWord(token) && NON_SECTION.indexOf(lower(token)) === -1) {
          out.section = token;
          break;
        }
      }
    }

    /* --- 类型 --- */
    for (var t = 0; t < lines.length; t++) {
      if (isTypeWord(lines[t])) { out.type = lines[t].trim(); break; }
    }
    if (!out.type) {
      for (var t2 = 0; t2 < TYPE_WORDS.length; t2++) {
        var word = TYPE_WORDS[t2];
        if (word.length > 3 && lower(flat).indexOf(word) >= 0) { out.type = word; break; }
      }
    }

    /* --- 地点：不是代码行、不是课节、不是类型、不是时间的那一行 --- */
    var venueCandidates = lines.filter(function (line, idx) {
      var t3 = line.trim();
      if (!t3) return false;
      if (idx === codeLineIndex) return false;
      if (isTypeWord(t3)) return false;
      if (/^[-–—\s]*[A-Z]{1,5}[0-9]{0,3}[-–—\s]*$/.test(t3) && t3.replace(/[-–—\s]/g, "").length <= 5) return false;
      if (/[0-9OoIl]{1,2}\s*[:.·]\s*[0-9OoIl]{2}/.test(cleanTimeToken(t3))) return false;
      if (/^waiting\b/i.test(t3)) return false;
      return /[A-Za-z\u4e00-\u9fa5]/.test(t3);
    });

    if (venueCandidates.length) {
      /* 地点常常折成两行（"Lee Shau Kee" / "Building LT3"），要拼起来再解析 */
      var venue = parseVenue(venueCandidates.join(" "));
      out.buildingName = venue.building;
      out.room = venue.room;
      out.tba = venue.tba;
    }

    out.name = composeName(out.code, out.section, out.type);
    return out;
  }

  /* ================= 5. 整张表的还原 ================= */

  function parseWords(words, options) {
    options = options || {};
    var warnings = [];

    var header = parseWeekdayHeader(words);
    if (header.length < 2) {
      return {
        courses: [], columns: [], timeAxis: null,
        warnings: ["没找到表头里的星期行，无法确定每一列是哪一天。确认截图里包含 Monday…Friday 那一行。"]
      };
    }

    var columns = buildColumns(header);
    var timeAxis = buildTimeAxis(words, columns[0].left);
    if (!timeAxis) {
      warnings.push("没找到左侧的时间刻度，将只用格子内写的时间。");
    }

    var headerBottom = Math.max.apply(null, header.map(function (h) { return h.y1; }));
    var tableLeft = columns[0].left;
    var tableRight = columns[columns.length - 1].right;

    var content = (words || []).filter(function (w) {
      var cx = (w.x0 + w.x1) / 2;
      var cy = (w.y0 + w.y1) / 2;
      if (cy <= headerBottom) return false;
      return cx >= tableLeft && cx <= tableRight;
    });

    var courses = [];

    columns.forEach(function (col) {
      var colWords = content.filter(function (w) {
        var cx = (w.x0 + w.x1) / 2;
        return cx >= col.left && cx < col.right;
      });
      if (!colWords.length) return;

      splitBlocks(colWords, options).forEach(function (block) {
        var lines = groupLines(block.words);
        var item = parseBlockLines(lines);

        /* 既没代码也不像课程类型，多半是误识别的零碎文字 */
        if (!item.code && !item.type) return;

        item.weekday = col.day;

        if (!item.start && timeAxis) {
          item.start = fmtMinutes(snap5(timeAxis.toMinutes(block.y0)));
          item.end = fmtMinutes(snap5(timeAxis.toMinutes(block.y1)));
          item.timeFromGrid = true;
        }
        if (!item.start || !item.end || hm(item.end) <= hm(item.start)) {
          warnings.push(item.code + " 的时间没读出来，需要手工补。");
          item.needsTime = true;
        }
        if (!item.buildingName && !item.tba) {
          warnings.push((item.code || item.name) + " 的地点没读出来。");
        }

        courses.push(item);
      });
    });

    courses.sort(function (a, b) {
      return a.weekday - b.weekday || hm(a.start) - hm(b.start);
    });

    return { courses: courses, columns: columns, timeAxis: timeAxis, warnings: warnings };
  }

  /* ================= 6. 楼栋匹配 ================= */

  /** 把识别出来的楼名对应到已录入的楼栋 */
  function matchBuilding(name, buildings) {
    var key = normKey(name);
    if (!key) return null;

    var list = buildings || [];
    var i;

    for (i = 0; i < list.length; i++) {
      var names = [list[i].name].concat(list[i].alias || []);
      for (var j = 0; j < names.length; j++) {
        if (normKey(names[j]) === key) return { id: list[i].id, exact: true };
      }
    }

    var best = null;
    for (i = 0; i < list.length; i++) {
      var cand = [list[i].name].concat(list[i].alias || []);
      for (var k = 0; k < cand.length; k++) {
        var ck = normKey(cand[k]);
        if (!ck || Math.min(ck.length, key.length) < 4) continue;
        if (ck.indexOf(key) >= 0 || key.indexOf(ck) >= 0) {
          if (!best || ck.length > normKey(best.name).length) {
            best = { id: list[i].id, exact: false, name: list[i].name };
          }
        }
      }
    }
    return best;
  }

  /* ================= 7. 浏览器驱动层 ================= */

  function loadEngine(cdnBase) {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);

    var sources = cdnBase ? [cdnBase].concat(SCRIPT_CDNS) : SCRIPT_CDNS;

    function attempt(i) {
      if (i >= sources.length) {
        return Promise.reject(new Error("加载识别引擎失败，检查网络后重试"));
      }
      return new Promise(function (resolve, reject) {
        var script = document.createElement("script");
        script.src = sources[i] + "/tesseract.min.js";
        script.onload = function () {
          if (window.Tesseract) resolve(window.Tesseract);
          else reject(new Error("引擎脚本加载了但不可用"));
        };
        script.onerror = function () { reject(new Error("这个 CDN 不通")); };
        document.head.appendChild(script);
      }).catch(function () { return attempt(i + 1); });
    }

    return attempt(0);
  }

  /* 放大 + 灰度 + 对比度拉伸，明显提升小字识别率 */
  function preprocess(file, options) {
    options = options || {};
    var targetWidth = options.targetWidth || 1800;

    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();

      img.onload = function () {
        var scale = Math.min(3, Math.max(1, targetWidth / img.width));
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        var ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);

        try {
          var image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          stretchContrast(image.data);
          ctx.putImageData(image, 0, 0);
        } catch (err) {
          /* 跨域图片可能取不到像素，那就直接用原图 */
        }

        resolve(canvas);
      };

      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("这张图片读不出来，换一张试试"));
      };

      img.src = url;
    });
  }

  function stretchContrast(data) {
    var histogram = new Array(256);
    for (var i = 0; i < 256; i++) histogram[i] = 0;

    var n = data.length / 4;
    var gray = new Uint8ClampedArray(n);

    for (var p = 0; p < n; p++) {
      var o = p * 4;
      var v = Math.round(0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]);
      gray[p] = v;
      histogram[v]++;
    }

    var lowTarget = n * 0.02;
    var highTarget = n * 0.98;
    var acc = 0, lo = 0, hi = 255;

    for (var a = 0; a < 256; a++) {
      acc += histogram[a];
      if (acc >= lowTarget) { lo = a; break; }
    }
    acc = 0;
    for (var b = 255; b >= 0; b--) {
      acc += histogram[b];
      if (acc >= n - highTarget) { hi = b; break; }
    }
    if (hi - lo < 20) { lo = 0; hi = 255; }

    var span = hi - lo;
    for (var q = 0; q < n; q++) {
      var out = ((gray[q] - lo) * 255) / span;
      out = out < 0 ? 0 : out > 255 ? 255 : out;
      var idx = q * 4;
      data[idx] = data[idx + 1] = data[idx + 2] = out;
      data[idx + 3] = 255;
    }
  }

  /* Tesseract 的 TSV 输出格式跨版本最稳定，就从它取词和坐标 */
  function wordsFromTsv(tsv) {
    var out = [];
    String(tsv || "").split("\n").forEach(function (line, index) {
      if (index === 0) return;
      var cells = line.split("\t");
      if (cells.length < 12) return;
      if (cells[0] !== "5") return;                 /* level 5 = 词 */

      var conf = parseFloat(cells[10]);
      var text = cells.slice(11).join("\t").trim();
      if (!text || (conf === conf && conf < 30)) return;

      var x0 = Number(cells[6]), y0 = Number(cells[7]);
      var width = Number(cells[8]), height = Number(cells[9]);
      if (!isFinite(x0) || !isFinite(y0) || !isFinite(width) || !isFinite(height)) return;

      out.push({ text: text, x0: x0, y0: y0, x1: x0 + width, y1: y0 + height, conf: conf });
    });
    return out;
  }

  async function recognizeOnce(worker, canvas, psm) {
    await worker.setParameters({
      tessedit_pageseg_mode: String(psm),
      preserve_interword_spaces: "1"
    });
    const result = await worker.recognize(canvas);
    return { words: wordsFromTsv(result.data.tsv), text: result.data.text || "" };
  }

  /**
   * 完整流程：图片 → 预处理 → OCR → 结构化课程
   * @param {File|Blob} file
   * @param {object} options { lang, cdnBase, langPath, onProgress, onStage }
   */
  async function run(file, options) {
    options = options || {};
    const report = options.onProgress || function () {};

    report("正在处理图片", 0.02);
    const canvas = await preprocess(file, options);

    report("正在加载识别引擎", 0.08);
    const Tesseract = await loadEngine(options.cdnBase);

    const worker = await Tesseract.createWorker(options.lang || "eng", 1, {
      logger: function (m) {
        if (m && m.status === "recognizing text") report("正在识别文字", m.progress);
      },
      langPath: options.langPath || DEFAULT_LANG_PATH
    });

    try {
      /* 先按"一整块文字"识别，表格类截图通常最准 */
      let attempt = await recognizeOnce(worker, canvas, 6);
      let parsed = parseWords(attempt.words, options);

      /* 效果不好就换成稀疏文字模式再试一次 */
      if (parsed.courses.length < 2 || !parsed.timeAxis) {
        report("换一种识别方式重试", 0.1);
        const second = await recognizeOnce(worker, canvas, 11);
        const parsedSecond = parseWords(second.words, options);
        if (parsedSecond.courses.length > parsed.courses.length) {
          attempt = second;
          parsed = parsedSecond;
        }
      }

      parsed.words = attempt.words;
      parsed.text = attempt.text;
      parsed.canvas = canvas;
      return parsed;
    } finally {
      await worker.terminate();
    }
  }

  OP.Ocr = {
    SCRIPT_CDNS: SCRIPT_CDNS,
    DEFAULT_LANG_PATH: DEFAULT_LANG_PATH,
    weekdayOf: weekdayOf,
    parseWeekdayHeader: parseWeekdayHeader,
    buildColumns: buildColumns,
    buildTimeAxis: buildTimeAxis,
    splitBlocks: splitBlocks,
    groupLines: groupLines,
    parseVenue: parseVenue,
    parseBlockLines: parseBlockLines,
    parseWords: parseWords,
    matchBuilding: matchBuilding,
    wordsFromTsv: wordsFromTsv,
    preprocess: preprocess,
    loadEngine: loadEngine,
    run: run
  };
})(window.OP);
