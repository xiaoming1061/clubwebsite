/* 校巴乘坐规划
 *
 * 数据在 data/shuttle.js（路线、有序站点、坐标、海拔、发车分钟）。
 * 这里只做"能不能坐、要多久、值不值得"：
 *
 *   走到上车站 → 等车 → 坐车 → 下车走到目的地
 *
 * 几条必须说清楚的规矩：
 *
 * 1. **车站就近**。上车站按"从这里走过去要多久"排序，取最近的；
 *    下车站按"从这里走到目的地要多久"排序，取离目的地最近的。
 *    最近的那个站如果没有车能坐，才退到第二近的。
 * 2. **海拔算进去**。车站和楼栋都有海拔：走路那段按"1 米爬升 ≈ N 米平路"
 *    折算（和页面算步行时间用的是同一个 climbFactor）；坐车那段把高差
 *    算进实际路程（√(水平² + 高差²)）。爬山校园里这条最要紧——
 *    同一个站，从山上走下去和从山下走上去，时间能差好几倍。
 * 3. **发车时间指"从该路线第一站开出"**，官网/路线图给的就是这个。
 *    所以到了后面的站要加上"首站 → 该站"的行驶时间，才是车到这个站的时刻。
 * 4. 行驶时间用站点之间的距离估算（乘道路系数），没有真实路网，只是量级参考。
 * 5. 穿梭/晚间/假日线按**环线**处理（坐过头会绕一圈回来）；
 *    转堂校巴（5/6A/6B/7）是单向的，不能绕。
 * 6. 公众假期和教学日算不出来（没有校历），只按星期几判断；
 *    受影响的站点会在结果里标出来。
 */

window.OP = window.OP || {};

(function (OP) {
  "use strict";

  var DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  var ROAD_FACTOR = 1.15;       // 站点直线距离 → 校巴实际走的路
  var DWELL_MIN = 0.25;         // 每停一站的时间
  var MAX_ACCESS = 650;         // 走到车站超过这个距离就不考虑了
  var MAX_BOARD_CANDIDATES = 3; // 最多退到第几近的上车站
  var MAX_ALIGHT_CANDIDATES = 3;
  var MAX_RIDES = 8;            // 每个组合最多列几班车
  var WORTH_MIN = -2;           // 比走路慢超过这个数就不值得坐，前后端共用这个阈值
  var DEFAULT_BUS_SPEED = 330;  // 米/分钟，约 20 km/h（含停站）
  var DEFAULT_CLIMB = 8;        // 1 米爬升 ≈ 几米平路

  function stopTable() { return OP.SHUTTLE_STOPS || {}; }
  function routeTable() { return OP.SHUTTLE_ROUTES || []; }

  function stopIds(route) {
    return (route.stops || []).map(function (s) {
      return typeof s === "string" ? s : s.id;
    });
  }

  function stopNote(route, id) {
    var hit = (route.stops || []).filter(function (s) {
      return typeof s === "object" && s.id === id;
    })[0];
    return hit ? (hit.note || "") : "";
  }

  function hm(text) {
    var p = String(text || "0:00").split(":");
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }

  function positive(value, fallback) {
    var n = Number(value);
    return isFinite(n) && n >= 0 ? n : fallback;
  }

  function busSpeed(settings) {
    var v = Number((settings || {}).busSpeed);
    return isFinite(v) && v > 0 ? v : DEFAULT_BUS_SPEED;
  }

  /* climbFactor：0 是有效值（表示不考虑高差），只有缺字段或负数才回退 */
  function climbFactor(settings) {
    var v = Number((settings || {}).climbFactor);
    return isFinite(v) && v >= 0 ? v : DEFAULT_CLIMB;
  }

  function elevationOf(point) {
    return point && typeof point.elevation === "number" ? point.elevation : null;
  }

  /**
   * 走路时间：从 a 走到 b。
   *
   * 和页面算步行时间同一套算法——水平距离乘路程系数，再把爬升按
   * "1 米爬升 ≈ N 米平路"折成等效距离。走下山不算爬升。
   */
  function walkMinutes(a, b, settings) {
    if (!a || !b) return null;
    var straight = OP.Geo.haversine(a, { lat: b.lat, lng: b.lng });
    if (straight === null) return null;

    var detour = Number((settings || {}).detourFactor) || 1.3;
    var speed = Number((settings || {}).walkingSpeed) || 75;
    var distance = straight * detour;

    var rise = 0;
    var ea = elevationOf(a);
    var eb = elevationOf(b);
    if (ea !== null && eb !== null) rise = Math.max(0, eb - ea);

    return (distance + rise * climbFactor(settings)) / speed;
  }

  /**
   * 坐车时间：从 a 站坐到 b 站那一段。
   * 高差算进实际路程（3D 距离）——山路爬升就是实打实多走的路。
   */
  function legMinutes(a, b, settings) {
    if (!a || !b) return null;
    var straight = OP.Geo.haversine(a, { lat: b.lat, lng: b.lng });
    if (straight === null) return null;

    var horizontal = straight * ROAD_FACTOR;
    var ea = elevationOf(a);
    var eb = elevationOf(b);
    var rise = (ea !== null && eb !== null) ? Math.abs(eb - ea) : 0;
    var length = Math.sqrt(horizontal * horizontal + rise * rise);

    return length / busSpeed(settings);
  }

  /* 环线：穿梭校巴 / 晚间及假日都绕圈；转堂校巴是单向的 */
  function isCircular(route) {
    return route.group === "shuttle" || route.group === "night";
  }

  /**
   * 从第 i 站坐到第 j 站要多久。
   * 环线允许"坐过头绕回来"，单向线不允许。
   */
  function rideMinutes(route, i, j, settings) {
    var ids = stopIds(route);
    var table = stopTable();
    if (i === j) return null;

    var order = [];
    if (j > i) {
      for (var k = i; k <= j; k++) order.push(k);
    } else if (isCircular(route)) {
      for (var m = i; m < ids.length; m++) order.push(m);
      for (var n = 0; n <= j; n++) order.push(n);
    } else {
      return null;
    }

    var total = 0;
    for (var p = 0; p < order.length - 1; p++) {
      var one = legMinutes(table[ids[order[p]]], table[ids[order[p + 1]]], settings);
      if (one === null) return null;
      total += one;
      if (p > 0) total += DWELL_MIN;   // 中间站停一下
    }
    return total;
  }

  /* 这条路线今天开不开 */
  function sessionFor(route, date) {
    var key = DAY_KEYS[date.getDay()];
    return (route.sessions || []).filter(function (s) {
      return (s.days || []).indexOf(key) >= 0;
    })[0] || null;
  }

  function runsOn(route, date) {
    return !!sessionFor(route, date);
  }

  /* 从 after 起，这条路线（首站）接下来的发车时刻 */
  function nextDepartures(route, after, count) {
    var out = [];
    var session = sessionFor(route, after);
    if (!session) return out;

    var limit = hm(session.to);
    var from = hm(session.from);
    var minutes = route.everyHour || [];

    var cur = new Date(after.getTime());
    cur.setSeconds(0, 0);
    if (cur.getTime() < after.getTime()) cur = new Date(cur.getTime() + 60000);

    for (var step = 0; step < 60 * 6 && out.length < count; step++) {
      var now = cur.getHours() * 60 + cur.getMinutes();
      if (now > limit) break;
      if (now >= from && minutes.indexOf(cur.getMinutes()) >= 0) {
        out.push(new Date(cur.getTime()));
      }
      cur = new Date(cur.getTime() + 60000);
    }
    return out;
  }

  /**
   * 把站点附注翻译成可判断的规则。
   *
   * 两类条件：
   *   1. 「逢 00 分開出的班次才停」/「逢 31 至 00 分開出的班次才停」
   *      —— 说的是"哪几班车停"，用发车分钟就能精确判断；
   *   2. 「只在教學日」/「只在非教學日」
   *      —— 取决于校历，程序算不出来，只能标出来让人确认。
   */
  function noteRules(note) {
    var text = String(note || "");
    var rules = { minutes: null, dayType: "" };

    if (text.indexOf("非教學日") >= 0) rules.dayType = "nonTeaching";
    else if (text.indexOf("教學日") >= 0) rules.dayType = "teaching";

    var range = /逢\s*(\d{1,2})\s*至\s*(\d{1,2})\s*分/.exec(text);
    if (range) {
      var from = parseInt(range[1], 10);
      var to = parseInt(range[2], 10);
      rules.minutes = [];
      for (var i = from; i < 60; i++) rules.minutes.push(i);
      for (var j = 0; j <= to; j++) rules.minutes.push(j);
      return rules;
    }

    var single = /逢\s*(\d{1,2})\s*分/.exec(text);
    if (single) rules.minutes = [parseInt(single[1], 10) % 60];
    return rules;
  }

  /* 这一班车停不停那个站 */
  function runStops(rules, departure) {
    if (!rules || !rules.minutes) return true;
    return rules.minutes.indexOf(departure.getMinutes()) >= 0;
  }

  /**
   * 按"走过去要多久"排的候选车站（含海拔），最近的在前。
   *
   * 注意排的是**时间**不是直线距离：同一个站，从山上走下去和从山下走上去
   * 差好几倍，用直线距离排会挑错。
   */
  function nearbyStops(point, settings, maxMeters, limit) {
    var table = stopTable();
    var out = [];
    Object.keys(table).forEach(function (id) {
      var s = table[id];
      if (s.lat === null || s.lng === null) return;
      var straight = OP.Geo.haversine(point, { lat: s.lat, lng: s.lng });
      if (straight === null || straight > maxMeters) return;
      var minutes = walkMinutes(point, s, settings);
      if (minutes === null) return;
      out.push({ id: id, stop: s, distance: straight, minutes: minutes });
    });
    out.sort(function (a, b) {
      if (a.minutes !== b.minutes) return a.minutes - b.minutes;
      return a.distance - b.distance;
    });
    return limit ? out.slice(0, limit) : out;
  }

  /**
   * 给一段行程找校巴方案。
   *
   * @param from     起点 { lat, lng, elevation }
   * @param to       终点 { lat, lng, elevation }
   * @param when     什么时候从起点出发（Date）
   * @param walkMin  走路要多少分钟（用来比较值不值得坐车）
   * @param settings 设置
   * @param deadline 最晚什么时候要到（一般是上课时间），超过的班次不列
   * @returns {board, alight, groups} —— groups 里每个是"一条路线 + 一对上下车站 + 所有能坐的班次"
   */
  function plan(from, to, when, walkMin, settings, deadline) {
    var empty = { board: null, alight: null, groups: [] };
    if (!from || !to || !when) return empty;

    var boards = nearbyStops(from, settings, MAX_ACCESS, MAX_BOARD_CANDIDATES);
    var alights = nearbyStops(to, settings, MAX_ACCESS, MAX_ALIGHT_CANDIDATES);
    if (!boards.length || !alights.length) return empty;

    var combos = [];

    boards.forEach(function (b, bRank) {
      /* 走到车站的时刻 */
      var atStop = new Date(when.getTime() + b.minutes * 60000);

      alights.forEach(function (a, aRank) {
        if (a.id === b.id) return;
        var walkAfter = walkMinutes(a.stop, to, settings);
        if (walkAfter === null) return;

        routeTable().forEach(function (route) {
          var ids = stopIds(route);
          if (ids.length < 2) return;

          var i = ids.indexOf(b.id);
          var j = ids.indexOf(a.id);
          if (i < 0 || j < 0 || i === j) return;

          var toBoard = i === 0 ? 0 : rideMinutes(route, 0, i, settings);
          if (toBoard === null) return;
          var ride = rideMinutes(route, i, j, settings);
          if (ride === null) return;

          var boardRules = noteRules(stopNote(route, b.id));
          var alightRules = noteRules(stopNote(route, a.id));
          var caveat = boardRules.dayType || alightRules.dayType;

          /* 能坐的班次：车到这个站的时间不早于你到站的时刻 */
          var departures = nextDepartures(route, new Date(atStop.getTime() - toBoard * 60000), MAX_RIDES + 4);
          var rides = [];

          for (var n = 0; n < departures.length; n++) {
            var date = departures[n];
            var busAtBoard = new Date(date.getTime() + toBoard * 60000);
            if (busAtBoard.getTime() < atStop.getTime() - 1000) continue;
            if (!runStops(boardRules, date)) continue;
            if (!runStops(alightRules, date)) continue;

            var busAtAlight = new Date(busAtBoard.getTime() + ride * 60000);
            var arriveAt = new Date(busAtAlight.getTime() + walkAfter * 60000);
            var total = (arriveAt.getTime() - when.getTime()) / 60000;

            if (deadline && arriveAt.getTime() > deadline.getTime()) break;

            rides.push({
              departAt: date,
              busAtBoard: busAtBoard,
              busAtAlight: busAtAlight,
              arriveAt: arriveAt,
              waitMin: (busAtBoard.getTime() - atStop.getTime()) / 60000,
              rideMin: ride,
              walkAfterMin: walkAfter,
              totalMin: total,
              saves: (walkMin === null || walkMin === undefined) ? null : walkMin - total
            });
            if (rides.length >= MAX_RIDES) break;
          }

          if (!rides.length) return;

          combos.push({
            route: route,
            board: b,
            alight: a,
            boardRank: bRank,
            alightRank: aRank,
            caveat: caveat,
            boardNote: stopNote(route, b.id),
            alightNote: stopNote(route, a.id),
            wrapped: j < i,
            circular: isCircular(route),
            rides: rides
          });
        });
      });
    });

    /* 排序：
       1) 上车站越近越前（用户要的"优先最近的车站"）
       2) 下车站越近目的地越前
       3) 要看校历才能确定的车次往后放
       4) 最后才比谁先到 */
    /* 先扔掉"所有班次都不如走路"的组合：留着只会挡着真正有用的方案 */
    var usable = combos.filter(function (c) {
      return c.rides.some(function (r) { return r.saves === null || r.saves >= WORTH_MIN; });
    });

    usable.sort(function (a, b) {
      var ra = a.boardRank + a.alightRank;
      var rb = b.boardRank + b.alightRank;
      if (ra !== rb) return ra - rb;
      if (!!a.caveat !== !!b.caveat) return a.caveat ? 1 : -1;
      return a.rides[0].arriveAt - b.rides[0].arriveAt;
    });

    /* 同一条线只留最合适的那一组：同一趟车在近站和远站都上得去，
       列两遍只是重复，真正有用的是"还有哪条线能坐" */
    var seenRoute = {};
    var deduped = usable.filter(function (c) {
      if (seenRoute[c.route.no]) return false;
      seenRoute[c.route.no] = true;
      return true;
    });

    return {
      board: boards[0],
      alight: alights[0],
      groups: deduped
    };
  }

  /* 今日还有哪些路线在开 */
  function routesOn(date) {
    return routeTable().filter(function (r) { return runsOn(r, date); });
  }

  OP.Shuttle = {
    plan: plan,
    routesOn: routesOn,
    runsOn: runsOn,
    sessionFor: sessionFor,
    nextDepartures: nextDepartures,
    rideMinutes: rideMinutes,
    legMinutes: legMinutes,
    walkMinutes: walkMinutes,
    nearbyStops: nearbyStops,
    stopIds: stopIds,
    stopNote: stopNote,
    noteRules: noteRules,
    runStops: runStops,
    isCircular: isCircular,
    MAX_ACCESS: MAX_ACCESS,
    MAX_RIDES: MAX_RIDES,
    WORTH_MIN: WORTH_MIN,
    DEFAULT_BUS_SPEED: DEFAULT_BUS_SPEED
  };
})(window.OP);
