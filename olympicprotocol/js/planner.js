/* 课表计算：今日课程、下一节课、出发时间、路线链、播报文案 */

window.OP = window.OP || {};

(function (OP) {
  "use strict";

  var WEEKDAYS = ["", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];
  var WEEKDAYS_SHORT = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];

  /* ---------- 时间工具 ---------- */

  function hm(text) {
    var p = String(text || "00:00").split(":");
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }

  function fmtHM(minutes) {
    var total = ((Math.round(minutes) % 1440) + 1440) % 1440;
    var h = Math.floor(total / 60);
    var m = total % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  /* 把某个日期 + "HH:MM" 组合成 Date */
  function at(date, text) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    var p = String(text || "00:00").split(":");
    d.setHours(parseInt(p[0], 10) || 0, parseInt(p[1], 10) || 0, 0, 0);
    return d;
  }

  /* 周一 = 1 … 周日 = 7 */
  function isoDow(date) {
    return ((date.getDay() + 6) % 7) + 1;
  }

  function weekNumber(date, termStart) {
    if (!termStart) return null;
    var start = new Date(termStart + "T00:00:00");
    if (isNaN(start.getTime())) return null;
    var day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var diff = Math.floor((day - start) / 86400000);
    return Math.floor(diff / 7) + 1;
  }

  function dateKey(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

  function dateLabel(date) {
    return (date.getMonth() + 1) + " 月 " + date.getDate() + " 日 · " + WEEKDAYS[isoDow(date)];
  }

  /* 中文时间读法：14:00 → 下午 2 点整 */
  function cnTime(text) {
    var total = hm(text);
    var h = Math.floor(total / 60);
    var m = total % 60;
    var period = h < 6 ? "凌晨" : h < 12 ? "上午" : h < 13 ? "中午" : h < 18 ? "下午" : "晚上";
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return period + h12 + " 点" + (m === 0 ? "整" : m + " 分");
  }

  function minutesBetween(a, b) {
    return (b.getTime() - a.getTime()) / 60000;
  }

  function humanGap(minutes) {
    var m = Math.max(0, Math.round(minutes));
    if (m < 60) return m + " 分钟";
    var h = Math.floor(m / 60);
    var rest = m % 60;
    return rest ? h + " 小时 " + rest + " 分钟" : h + " 小时";
  }

  /* ---------- 数据查询 ---------- */

  function buildingById(data, id) {
    var list = (data.campus && data.campus.buildings) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function courseById(data, id) {
    for (var i = 0; i < data.courses.length; i++) {
      if (data.courses[i].id === id) return data.courses[i];
    }
    return null;
  }

  /**
   * 按关键词和"是否缺坐标"筛选楼栋。
   *
   * 关键词同时匹配名字和别名，而且走的是和宿舍搜索同一条规则
   * （js/zh.js 的 OP.Zh.matches）：**中文英文、简体繁体、拼音首字母都能搜**——
   * 「教研楼」「教研樓」「jylyz」都能找到 Academic Building No.1。
   *
   * @param {Array} buildings
   * @param {string} query
   * @param {boolean} missingOnly 只看还没录坐标的
   */
  function filterBuildings(buildings, query, missingOnly) {
    var word = String(query || "").trim();

    return (buildings || []).filter(function (b) {
      var hasCoords = typeof b.lat === "number" && typeof b.lng === "number";
      if (missingOnly && hasCoords) return false;
      if (!word) return true;

      return OP.Zh.matches(word, [b.name].concat(b.alias || []));
    });
  }

  function courseOnDay(course, date, termStart) {
    var wd = isoDow(date);
    if ((course.weekdays || []).indexOf(wd) === -1) return false;
    var weeks = course.weeks || [1, 30];
    var from = weeks[0] || 1;
    var to = weeks[1] || 30;
    var wk = weekNumber(date, termStart);
    if (wk === null) return true;
    return wk >= from && wk <= to;
  }

  function todayCourses(data, date) {
    var termStart = data.settings ? data.settings.termStart : null;
    return (data.courses || [])
      .filter(function (c) { return courseOnDay(c, date, termStart); })
      .sort(function (a, b) { return hm(a.start) - hm(b.start); });
  }

  function statusOf(course, date) {
    var now = date.getTime();
    var s = at(date, course.start).getTime();
    var e = at(date, course.end).getTime();
    if (now >= e) return "past";
    if (now >= s) return "ongoing";
    return "upcoming";
  }

  /* 下一节课 = 还没结束的第一节课（正在上的也算） */
  function nextCourse(data, date) {
    var list = todayCourses(data, date);
    for (var i = 0; i < list.length; i++) {
      if (at(date, list[i].end).getTime() > date.getTime()) {
        return { course: list[i], status: statusOf(list[i], date) };
      }
    }
    return null;
  }

  /* 当前位置最近的楼栋 */
  function nearestBuilding(position, buildings) {
    if (!position || !buildings || !buildings.length) return null;
    var best = null;
    buildings.forEach(function (b) {
      /* 还没录坐标的楼栋（比如从课表截图导入后新建的）直接跳过 */
      if (typeof b.lat !== "number" || typeof b.lng !== "number") return;
      var d = OP.Geo.haversine(position, { lat: b.lat, lng: b.lng });
      if (d !== null && (!best || d < best.distance)) best = { building: b, distance: d };
    });
    return best;
  }

  /* ---------- 步行与出发时间 ---------- */

  function walkMetrics(from, building, settings) {
    if (!from || !building) return null;
    if (typeof building.lat !== "number" || typeof building.lng !== "number") return null;
    var straight = OP.Geo.haversine(from, { lat: building.lat, lng: building.lng });
    if (straight === null) return null;
    var detour = Number(settings.detourFactor) || 1.3;
    var speed = Number(settings.walkingSpeed) || 75;
    var distance = straight * detour;

    /* 高差要算进去。爬山校园里从山脚到山顶比平地慢好几倍，
       1 米爬升按 8 米平路折算（接近登山常用的 Naismith 经验值）。 */
    var climbFactor = Number(settings.climbFactor);
    /* 0 是有效值，表示"不考虑高差"；只有缺字段或负数才回退到默认 */
    if (!isFinite(climbFactor) || climbFactor < 0) climbFactor = 8;

    var rise = 0;
    if (typeof from.elevation === "number" && typeof building.elevation === "number") {
      rise = Math.max(0, building.elevation - from.elevation);
    }
    var effective = distance + rise * climbFactor;

    return {
      straight: straight,
      distance: distance,
      minutes: effective / speed,
      speed: speed,
      detour: detour,
      rise: rise,
      climbFactor: climbFactor,
      effectiveDistance: effective,
      /* 有没有海拔数据要区分开：没有时"爬升 0"是未知，不是真的平路 */
      hasElevation: typeof from.elevation === "number" && typeof building.elevation === "number"
    };
  }

  /**
   * 生成当天的路线链：当前位置 → 第一节 → 第二节 → …
   * 每段带上「必须几点出发」，出发时间不会早于上一节课下课。
   */
  function buildLegs(data, position, date) {
    var list = todayCourses(data, date);
    var remaining = list.filter(function (c) {
      return at(date, c.end).getTime() > date.getTime();
    });

    var legs = [];
    var fromPoint = position || null;
    var fromName = position ? "我的位置" : null;
    var prevEnd = date;
    var prevBuilding = null;

    remaining.forEach(function (course) {
      var building = buildingById(data, course.buildingId);
      var start = at(date, course.start);
      var end = at(date, course.end);

      /*
       * 连堂课：两节在同一栋楼、中间只隔十几分钟。
       * 这种不用再拆出一段"从这栋楼去这栋楼"的行程——距离是 0，
       * 校巴方案也会变成"原地打转"，只会让人以为是坏了。
       */
      var samePlace = !!(building && prevBuilding && building.id === prevBuilding.id);

      if (!samePlace) {
        var metrics = walkMetrics(fromPoint, building, data.settings || {});
        var bufferMs = (Number((data.settings || {}).bufferMinutes) || 0) * 60000;
        var travelMs = metrics ? metrics.minutes * 60000 : 0;

        var ideal = new Date(start.getTime() - travelMs - bufferMs);
        var departAt = new Date(Math.max(prevEnd.getTime(), ideal.getTime()));

        var slackMin = metrics
          ? minutesBetween(date, start) - metrics.minutes - bufferMs / 60000
          : null;

        legs.push({
          index: legs.length + 1,
          course: course,
          building: building,
          fromName: fromName,
          fromPoint: fromPoint,
          toPoint: building ? { lat: building.lat, lng: building.lng } : null,
          metrics: metrics,
          start: start,
          end: end,
          departAt: departAt,
          slackMin: slackMin,
          missed: metrics ? departAt.getTime() <= date.getTime() : false,
          status: statusOf(course, date)
        });

        prevEnd = new Date(Math.max(end.getTime(), departAt.getTime()));
      } else {
        prevEnd = new Date(Math.max(prevEnd.getTime(), end.getTime()));
      }

      /* 通往下一段的起点是这栋楼，海拔要一起带上——
         之前只复制了经纬度，导致第二段之后爬升全部按"未知"处理 */
      fromPoint = building
        ? { lat: building.lat, lng: building.lng, elevation: building.elevation }
        : fromPoint;
      fromName = building ? building.name : fromName;
      prevBuilding = building || prevBuilding;
    });

    return legs;
  }

  /* 真正需要"走过去"的行程：已经在上的课不算，因为你不可能再赶过去了 */
  function routeLegs(data, position, date) {
    return buildLegs(data, position, date).filter(function (leg) {
      return leg.status === "upcoming";
    });
  }

  /* ---------- 播报文案 ---------- */

  function placeText(course, building) {
    var where = building ? building.name : "未知地点";
    return course.room ? where + " " + course.room : where;
  }

  /* ---------- 播报专用的念法 ---------- */

  /* 把一个名字拆成中文部分和英文部分（"李兆基樓 Lee Shau Kee Building" 两种都有） */
  function splitName(text) {
    var raw = String(text || "");
    return {
      zh: (raw.match(/[\u4e00-\u9fa5]+/g) || []).join(""),
      en: (raw.match(/[A-Za-z0-9][A-Za-z0-9\s.'&()-]*/g) || []).join(" ").replace(/\s+/g, " ").trim()
    };
  }

  /* 楼栋的中文名和英文名，从显示名和别名里凑出来 */
  function buildingNames(building) {
    var found = { zh: "", en: "" };
    if (!building) return found;

    [building.name].concat(building.alias || []).forEach(function (name) {
      var parts = splitName(name);
      if (!found.zh && parts.zh) found.zh = parts.zh;
      if (!found.en && parts.en) found.en = parts.en;
    });

    return found;
  }

  /* 念英文时去掉结尾的通用词，但要留够两个词 */
  var GENERIC_SUFFIX = [
    "building", "bldg", "hall", "centre", "center", "tower", "block",
    "complex", "house", "college", "school", "institute",
    "theatre", "theater", "laboratory", "lab"
  ];

  function shortEnglishName(name) {
    var text = String(name || "").trim();
    if (!text) return "";

    var words = text.split(/\s+/);
    /* 至少三个词才削——否则 "Science Centre" 会被削成没意义的 "Science" */
    if (words.length < 3) return text;

    var last = words[words.length - 1].toLowerCase().replace(/[^a-z]/g, "");
    return GENERIC_SUFFIX.indexOf(last) >= 0 ? words.slice(0, -1).join(" ") : text;
  }

  /**
   * 播报时楼栋怎么念：中文名 + 英文简称。
   *
   * 中文全名让人一听就懂，英文简称对得上现场指示牌和时间表上的写法，
   * 例如「李兆基樓 Lee Shau Kee」。只有一种语言时就用那一种。
   */
  function spokenName(building) {
    if (!building) return "未知地点";

    var names = buildingNames(building);
    var en = shortEnglishName(names.en);

    if (names.zh && en) return names.zh + " " + en;
    return names.zh || en || building.name || "未知地点";
  }

  function spokenPlace(course, building) {
    var where = spokenName(building);
    /* 播报里用逗号断开，念出来有个自然停顿 */
    return course.room ? where + "，" + course.room : where;
  }

  function nextLine(leg) {
    var c = leg.course;
    return [
      c.name,
      cnTime(c.start),
      "到",
      cnTime(c.end),
      "，在",
      spokenPlace(c, leg.building)
    ].join("");
  }

  function briefingText(data, date, position) {
    var list = todayCourses(data, date);
    var parts = [];

    parts.push(
      "现在是 " + (date.getMonth() + 1) + " 月 " + date.getDate() + " 日，" +
      WEEKDAYS[isoDow(date)] + "，" +
      cnTime(pad2(date.getHours()) + ":" + pad2(date.getMinutes())) + "。"
    );

    if (!list.length) {
      parts.push("今天没有安排课程，好好休息。");
      return parts.join("");
    }

    parts.push("今天共有 " + list.length + " 节课。");

    list.forEach(function (c, i) {
      var b = buildingById(data, c.buildingId);
      var line = "第 " + (i + 1) + " 节，" + c.name + "，" + cnTime(c.start) +
        "，在" + spokenPlace(c, b);
      if (c.teacher) line += "，" + c.teacher;
      parts.push(line + "。");
    });

    var next = nextCourse(data, date);
    if (next && position) {
      var metrics = walkMetrics(position, buildingById(data, next.course.buildingId), data.settings || {});
      if (metrics) {
        var left = minutesBetween(date, at(date, next.course.start));
        parts.push(
          "下一节课" + next.course.name + "还有 " + Math.max(0, Math.round(left)) + " 分钟开始，" +
          "距离你大约 " + OP.Geo.formatDistance(metrics.distance) + "，" +
          "步行约 " + OP.Geo.formatDuration(metrics.minutes) + "。"
        );
        var depart = at(date, fmtHM(hm(next.course.start) - metrics.minutes - (Number((data.settings || {}).bufferMinutes) || 0)));
        parts.push("建议 " + cnTime(pad2(depart.getHours()) + ":" + pad2(depart.getMinutes())) + " 出发。");
      }
    } else if (next) {
      parts.push("下一节课是" + next.course.name + "。打开定位后我可以帮你算步行时间。");
    }

    return parts.join("");
  }

  function nextText(data, date, position) {
    var found = nextCourse(data, date);
    if (!found) return "今天的课已经全部结束了，没有需要前往的教室。";

    var c = found.course;
    var b = buildingById(data, c.buildingId);
    var left = Math.round(minutesBetween(date, at(date, c.start)));

    if (found.status === "ongoing") {
      var endLeft = Math.round(minutesBetween(date, at(date, c.end)));
      return c.name + "正在" + spokenPlace(c, b) + "进行，还有大约 " + Math.max(0, endLeft) + " 分钟下课。";
    }

    var text = "下一节课是" + c.name + "，" + cnTime(c.start) + "开始，还有大约 " +
      Math.max(0, left) + " 分钟，在" + spokenPlace(c, b) + "。";

    var metrics = walkMetrics(position, b, data.settings || {});
    if (metrics) {
      text += "距离你大约 " + OP.Geo.formatDistance(metrics.distance) + "，步行约 " +
        OP.Geo.formatDuration(metrics.minutes) + "。";
      var buffer = Number((data.settings || {}).bufferMinutes) || 0;
      var departMin = hm(c.start) - metrics.minutes - buffer;
      if (departMin <= hm(pad2(date.getHours()) + ":" + pad2(date.getMinutes()))) {
        text += "该出发了。";
      } else {
        text += "建议 " + cnTime(fmtHM(departMin)) + " 出发。";
      }
      if (metrics.hasElevation && metrics.rise >= 3) {
        text += "中间要爬升 " + Math.round(metrics.rise) + " 米。";
      }
    } else {
      text += "打开定位后我可以帮你算步行时间。";
    }
    return text;
  }

  function leaveText(leg, date) {
    var c = leg.course;
    var left = Math.round(minutesBetween(date, leg.start));
    var text = "该出发了。" + c.name + "还有 " + Math.max(0, left) + " 分钟开始，在" +
      spokenPlace(c, leg.building) + "。";
    if (leg.metrics) {
      text += "距离大约 " + OP.Geo.formatDistance(leg.metrics.distance) + "，步行约 " +
        OP.Geo.formatDuration(leg.metrics.minutes) + "。";
      if (leg.metrics.hasElevation && leg.metrics.rise >= 3) {
        text += "要爬升 " + Math.round(leg.metrics.rise) + " 米。";
      }
    }
    return text;
  }

  function weekText(course) {
    var days = (course.weekdays || []).slice().sort(function (a, b) { return a - b; })
      .map(function (d) { return WEEKDAYS_SHORT[d]; }).join("、");
    var weeks = course.weeks || [1, 16];
    return days + " · " + weeks[0] + "-" + weeks[1] + " 周";
  }

  OP.Planner = {
    WEEKDAYS: WEEKDAYS,
    WEEKDAYS_SHORT: WEEKDAYS_SHORT,
    hm: hm,
    fmtHM: fmtHM,
    at: at,
    isoDow: isoDow,
    weekNumber: weekNumber,
    dateKey: dateKey,
    dateLabel: dateLabel,
    cnTime: cnTime,
    minutesBetween: minutesBetween,
    humanGap: humanGap,
    buildingById: buildingById,
    filterBuildings: filterBuildings,
    courseById: courseById,
    todayCourses: todayCourses,
    statusOf: statusOf,
    nextCourse: nextCourse,
    nearestBuilding: nearestBuilding,
    walkMetrics: walkMetrics,
    buildLegs: buildLegs,
    routeLegs: routeLegs,
    placeText: placeText,
    splitName: splitName,
    buildingNames: buildingNames,
    shortEnglishName: shortEnglishName,
    spokenName: spokenName,
    spokenPlace: spokenPlace,
    nextLine: nextLine,
    briefingText: briefingText,
    nextText: nextText,
    leaveText: leaveText,
    weekText: weekText
  };
})(window.OP);
