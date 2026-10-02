/* 从学校接口拉回来的课表 → 我们自己的课程结构
 *
 * 上游是港中大官方 App「Student Class Timetable」的私有后端（见 worker/README.md），
 * 通过我们自己那台 Cloudflare Worker 代理转发回来。返回的是一个 JSON 数组，
 * 每一条是"一节课的一次安排"——同一门课有 Lecture + Tutorial 就是两条。
 *
 * 字段名是照着公开的逆向项目抄的（SUBJECT / FDESCR / MEETING_TIME_START …），
 * 但**没人见过真实数据**，不同学期还可能微调。所以这里取字段时：
 *
 *   1. 大小写、下划线、空格、连字符一律不计较（`Meeting_Time_Start` = `MEETINGTIMESTART`）；
 *   2. 每个概念留几个候选名，取到哪个算哪个；
 *   3. 一年到头取不到就留空，**绝不抛错**——宁可少一条信息，也不能整个导入挂掉。
 *
 * 真跑一次之后，看页面「原始字段」面板把对的留下、缺的补上就行。
 */

window.OP = window.OP || {};

(function (OP) {
  "use strict";

  /* ---------- 字段名 ---------- */

  var NAMES = {
    subject: ["SUBJECT", "SUBJ", "SUBJECT_CODE", "COURSE_SUBJECT"],
    catalog: ["CATALOG_NBR", "CATALOG", "CATALOG_NUMBER", "CATALOGNO", "COURSE_NBR"],
    section: ["CLASS_SECTION", "SECTION", "CLASS_NBR", "SECTION_CODE"],
    descr: ["DESCR", "DESCRIPTION", "COURSE_TITLE", "TITLE", "COURSE_DESCR"],
    type: ["COMDESC", "COMPONENT", "COMPONENT_DESCR", "CLASS_TYPE", "COMPONENT_CODE"],
    venue: ["FDESCR", "FACILITY_DESCR", "ROOM_DESCR", "LOCATION", "FACILITY", "VENUE"],
    roomField: ["ROOM", "ROOM_NBR", "FACILITY_ID"],
    startDate: ["START_DT", "START_DATE", "MEETING_START_DT"],
    endDate: ["END_DT", "END_DATE", "MEETING_END_DT"],
    startTime: ["MEETING_TIME_START", "START_TIME", "MEETING_START_TIME"],
    endTime: ["MEETING_TIME_END", "END_TIME", "MEETING_END_TIME"],
    weekDay: ["MEETING_DAY", "DAY_OF_WEEK", "WEEKDAY", "MEETDAY"],
    teacher: ["INSTRUCTORS", "INSTRUCTOR", "TEACHER", "STAFF"],
    lat: ["LAT", "LATITUDE"],
    lng: ["LNG", "LON", "LONG", "LONGITUDE"]
  };

  /* 默认学期第一周的周一（和页面设置里的 termStart 同一个口径） */
  var DEFAULT_TERM_START = "2026-09-07";

  function bare(text) {
    return String(text || "").toLowerCase().replace(/[_\s-]/g, "");
  }

  /* 一行数据的字段名索引：`MEETING_TIME_START` 也认 `meetingtimestart` */
  function keyIndexes(row) {
    var index = {};
    Object.keys(row || {}).forEach(function (key) {
      index[bare(key)] = key;
    });
    return index;
  }

  function pick(index, row, names) {
    for (var i = 0; i < names.length; i++) {
      var key = index[bare(names[i])];
      if (key === undefined) continue;
      var value = row[key];
      if (value === null || value === undefined) continue;
      var text = String(value).trim();
      if (text) return text;
    }
    return "";
  }

  /* ---------- 值的归一化 ---------- */

  /* "2026-09-07"、"2026-09-07 00:00:00.0"、"2026/9/7" 都收 */
  function normDate(text) {
    var raw = String(text || "").trim();
    if (!raw) return null;
    var m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(raw);
    if (!m) return null;
    var date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(date.getTime()) ? null : date;
  }

  /* "9:30"、"09:30:00" 都收成 "09:30" */
  function normTime(text) {
    var raw = String(text || "").trim();
    if (!raw) return "";
    var m = /^(\d{1,2})[:.](\d{2})/.exec(raw);
    if (!m) return "";
    var h = Number(m[1]);
    var mm = Number(m[2]);
    if (h > 23 || mm > 59) return "";
    return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm;
  }

  var DAY_WORDS = {
    mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
    sun: 7, sunday: 7
  };

  /* 星期几：优先从日期推（上游那种"开始日期 + 每周重复"的写法就靠它），
     实在没有日期才看专门的星期字段 */
  function weekdayOf(dateText, dayText) {
    var date = normDate(dateText);
    if (date) return OP.Planner.isoDow(date);

    var raw = String(dayText || "").trim();
    if (!raw) return 0;
    if (/^[1-7]$/.test(raw)) return Number(raw);
    return DAY_WORDS[raw.toLowerCase()] || 0;
  }

  /* 地名拆成"楼 + 教室"："Science Centre L3" → 楼 Science Centre、教室 L3 */
  function splitVenue(venue) {
    var text = String(venue || "").trim();
    if (!text) return { building: "", room: "", tba: true };
    if (/tba|to be announced|待定|no room|\u4e0d\u9700/.test(text.toLowerCase())) {
      return { building: "", room: "", tba: true };
    }

    var stripped = (OP.Ocr && OP.Ocr.stripRoomSuffix) ? OP.Ocr.stripRoomSuffix(text) : text;
    var room = text.slice(stripped.length).trim();
    return { building: stripped, room: room, tba: false };
  }

  /* ---------- 主函数 ---------- */

  /**
   * 把上游那批行转成我们的课程。
   *
   * @param rows   上游返回的数组（原样，别改）
   * @param opts   { termStart, buildings, minWeek, maxWeek }
   * @returns { courses, report }
   *          courses 里每条：{ name, teacher, buildingId, buildingName, room,
   *                           weekdays, start, end, weeks, lat, lng, code, type, raw }
   *          report：{ rows, kept, skipped, keys }
   */
  function toCourses(rows, opts) {
    var options = opts || {};
    var termStart = options.termStart || DEFAULT_TERM_START;
    var buildings = options.buildings || [];
    var minWeek = options.minWeek === undefined ? 1 : options.minWeek;
    var maxWeek = options.maxWeek === undefined ? 17 : options.maxWeek;

    var courses = [];
    var keys = [];
    var seenKey = {};
    var skipped = 0;

    (rows || []).forEach(function (row) {
      if (!row || typeof row !== "object") { skipped++; return; }

      Object.keys(row).forEach(function (key) {
        if (!seenKey[key]) { seenKey[key] = true; keys.push(key); }
      });

      var index = keyIndexes(row);
      var subject = pick(index, row, NAMES.subject);
      var catalog = pick(index, row, NAMES.catalog);
      var section = pick(index, row, NAMES.section);
      var descr = pick(index, row, NAMES.descr);
      var type = pick(index, row, NAMES.type);

      var code = [subject, catalog].filter(Boolean).join(" ") +
        (section ? "-" + section : "");
      /* 名字照课表上的写法：代号 + 类型（Tutorial / Lecture …），跟截图导入那边一致 */
      var name = [code, type].filter(Boolean).join(" ").trim() || descr;
      if (!name) { skipped++; return; }

      var start = normTime(pick(index, row, NAMES.startTime));
      var end = normTime(pick(index, row, NAMES.endTime));
      if (!start || !end) { skipped++; return; }

      var startDate = pick(index, row, NAMES.startDate);
      var endDate = pick(index, row, NAMES.endDate);
      var weekday = weekdayOf(startDate, pick(index, row, NAMES.weekDay));
      if (!weekday) { skipped++; return; }

      /* 周次：从开始/结束日期换算成教学周。换算不出来（没设学期开始日）就用默认区间 */
      var from = minWeek;
      var to = maxWeek;
      var first = normDate(startDate);
      var last = normDate(endDate);
      if (first) {
        var wk = OP.Planner.weekNumber(first, termStart);
        if (wk !== null) from = Math.max(minWeek, wk);
      }
      if (last) {
        var wk2 = OP.Planner.weekNumber(last, termStart);
        if (wk2 !== null) to = Math.min(maxWeek, Math.max(from, wk2));
      }

      var venue = splitVenue(pick(index, row, NAMES.venue));
      var directRoom = pick(index, row, NAMES.roomField);

      var lat = Number(pick(index, row, NAMES.lat));
      var lng = Number(pick(index, row, NAMES.lng));
      var hasCoords = isFinite(lat) && isFinite(lng) && lat !== 0 && lng !== 0;

      var buildingId = "";
      if (venue.building && OP.Ocr && OP.Ocr.matchBuilding) {
        var hit = OP.Ocr.matchBuilding(venue.building, buildings);
        if (hit) buildingId = hit.id;
      }

      courses.push({
        name: name,
        teacher: pick(index, row, NAMES.teacher),
        code: code,
        type: type,
        descr: descr,
        buildingId: buildingId,
        buildingName: venue.building,
        room: venue.room || directRoom,
        weekdays: [weekday],
        start: start,
        end: end,
        weeks: [from, to],
        lat: hasCoords ? lat : null,
        lng: hasCoords ? lng : null,
        tba: venue.tba,
        raw: row
      });
    });

    return {
      courses: courses,
      report: { rows: (rows || []).length, kept: courses.length, skipped: skipped, keys: keys }
    };
  }

  /**
   * 上游可能把"同一节课"拆成好几行（比如每个星期一行）。
   * 这里按"代号 + 星期 + 时间 + 地点"合并，周次取并集里最宽的那段。
   */
  function mergeCourses(list) {
    var out = [];
    var index = {};

    (list || []).forEach(function (c) {
      var key = [c.code, c.weekdays.join("+"), c.start, c.end, c.buildingName, c.room].join("|");
      var hit = index[key];
      /* 注意是 `=== undefined` 不是 `!hit`：排在第一个的课位置是 0，
         用 `!hit` 判断的话它永远不是合并目标（第二行会另起一条）。 */
      if (hit === undefined) {
        index[key] = out.length;
        out.push(c);
        return;
      }
      var merged = out[hit];
      merged.weeks = [
        Math.min(merged.weeks[0], c.weeks[0]),
        Math.max(merged.weeks[1], c.weeks[1])
      ];
    });

    return out;
  }

  OP.Timetable = {
    NAMES: NAMES,
    bare: bare,
    keyIndexes: keyIndexes,
    pick: pick,
    normDate: normDate,
    normTime: normTime,
    weekdayOf: weekdayOf,
    splitVenue: splitVenue,
    toCourses: toCourses,
    mergeCourses: mergeCourses
  };
})(window.OP);
