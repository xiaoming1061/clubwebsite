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
   * 关键词同时匹配名字和别名，所以搜中文、英文、简称都能搜到。
   *
   * @param {Array} buildings
   * @param {string} query
   * @param {boolean} missingOnly 只看还没录坐标的
   */
  function filterBuildings(buildings, query, missingOnly) {
    var word = String(query || "").trim().toLowerCase();

    return (buildings || []).filter(function (b) {
      var hasCoords = typeof b.lat === "number" && typeof b.lng === "number";
      if (missingOnly && hasCoords) return false;
      if (!word) return true;

      var names = [b.name].concat(b.alias || []);
      return names.some(function (n) {
        return String(n || "").toLowerCase().indexOf(word) >= 0;
      });
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
    return {
      straight: straight,
      distance: distance,
      minutes: distance / speed,
      speed: speed,
      detour: detour
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

    remaining.forEach(function (course, i) {
      var building = buildingById(data, course.buildingId);
      var metrics = walkMetrics(fromPoint, building, data.settings || {});
      var start = at(date, course.start);
      var end = at(date, course.end);
      var bufferMs = (Number((data.settings || {}).bufferMinutes) || 0) * 60000;
      var travelMs = metrics ? metrics.minutes * 60000 : 0;

      var ideal = new Date(start.getTime() - travelMs - bufferMs);
      var departAt = new Date(Math.max(prevEnd.getTime(), ideal.getTime()));

      var slackMin = metrics ? minutesBetween(date, start) - metrics.minutes - bufferMs / 60000 : null;

      legs.push({
        index: i + 1,
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
      fromPoint = building ? { lat: building.lat, lng: building.lng } : fromPoint;
      fromName = building ? building.name : fromName;
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

  function nextLine(leg) {
    var c = leg.course;
    return [
      c.name,
      cnTime(c.start),
      "到",
      cnTime(c.end),
      "，在",
      placeText(c, leg.building)
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
        "，在" + placeText(c, b);
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
      return c.name + "正在" + placeText(c, b) + "进行，还有大约 " + Math.max(0, endLeft) + " 分钟下课。";
    }

    var text = "下一节课是" + c.name + "，" + cnTime(c.start) + "开始，还有大约 " +
      Math.max(0, left) + " 分钟，在" + placeText(c, b) + "。";

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
    } else {
      text += "打开定位后我可以帮你算步行时间。";
    }
    return text;
  }

  function leaveText(leg, date) {
    var c = leg.course;
    var left = Math.round(minutesBetween(date, leg.start));
    var text = "该出发了。" + c.name + "还有 " + Math.max(0, left) + " 分钟开始，在" +
      placeText(c, leg.building) + "。";
    if (leg.metrics) {
      text += "距离大约 " + OP.Geo.formatDistance(leg.metrics.distance) + "，步行约 " +
        OP.Geo.formatDuration(leg.metrics.minutes) + "。";
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
    nextLine: nextLine,
    briefingText: briefingText,
    nextText: nextText,
    leaveText: leaveText,
    weekText: weekText
  };
})(window.OP);
