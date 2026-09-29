/* 校巴乘坐规划
 *
 * 数据在 data/shuttle.js（路线、有序站点、坐标、发车分钟）。
 * 这里只做"能不能坐、要多久、值不值得"：
 *
 *   走到上车站 → 等车 → 坐车 → 下车走到目的地
 *
 * 几个必须说清楚的假设（都写在这里，免得以后忘了为什么这么算）：
 *
 * 1. 发车时间指"从该路线第一站开出"的时刻，官网/路线图给的就是这个。
 *    所以到了后面的站要加上"首站→该站"的行驶时间。
 * 2. 行驶时间用站点之间的直线距离估算（乘一个道路系数），没有真实路网。
 *    校园里绕路多，这个值只是量级参考。
 * 3. 穿梭/晚间/假日线按**环线**处理：坐过站了会绕一圈再回来。
 *    转堂校巴（5/6A/6B/7）是单向的，不能绕。
 * 4. 公众假期和教学日算不出来（没有校历），只按星期几判断；
 *    受影响的路线会在结果里标出来。
 */

window.OP = window.OP || {};

(function (OP) {
  "use strict";

  var DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  var ROAD_FACTOR = 1.15;   // 站点直线距离 → 校巴实际走的路
  var DWELL_MIN = 0.25;     // 每停一站的时间
  var MAX_ACCESS = 650;     // 走到车站超过这个距离就不考虑了
  var DEFAULT_BUS_SPEED = 330;  // 米/分钟，约 20 km/h（含停站）

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

  /**
   * 把站点附注翻译成可判断的规则。
   *
   * 附注里有两类条件：
   *   1. 「逢 00 分開出的班次才停」/「逢 31 至 00 分開出的班次才停」
   *      —— 说的是"哪几班车停"，可以用发车分钟精确判断；
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

  function hm(text) {
    var p = String(text || "0:00").split(":");
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }

  function busSpeed(settings) {
    var v = Number((settings || {}).busSpeed);
    return isFinite(v) && v > 0 ? v : DEFAULT_BUS_SPEED;
  }

  /* 两个站点之间坐车要多久（只算一段） */
  function legMinutes(a, b, settings) {
    var straight = OP.Geo.haversine(a, b);
    if (straight === null) return null;
    return (straight * ROAD_FACTOR) / busSpeed(settings);
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
      var a = table[ids[order[p]]];
      var b = table[ids[order[p + 1]]];
      if (!a || !b || a.lat === null || b.lat === null) return null;
      var one = legMinutes(a, b, settings);
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

  /* 目的地附近的车站 */
  function nearbyStops(point, maxMeters) {
    var table = stopTable();
    var out = [];
    Object.keys(table).forEach(function (id) {
      var s = table[id];
      if (s.lat === null || s.lng === null) return;
      var d = OP.Geo.haversine(point, { lat: s.lat, lng: s.lng });
      if (d === null || d > maxMeters) return;
      out.push({ id: id, stop: s, distance: d });
    });
    out.sort(function (a, b) { return a.distance - b.distance; });
    return out;
  }

  /* 走过去要多久：和走路估算用同一套参数（不含爬升——车站没有海拔） */
  function accessMinutes(point, stop, settings) {
    var d = OP.Geo.haversine(point, { lat: stop.lat, lng: stop.lng });
    if (d === null) return null;
    var detour = Number((settings || {}).detourFactor) || 1.3;
    var speed = Number((settings || {}).walkingSpeed) || 75;
    return (d * detour) / speed;
  }

  /**
   * 给一段行程找校巴方案。
   *
   * @param from    起点 { lat, lng }
   * @param to      终点 { lat, lng }
   * @param when    什么时候从起点出发（Date）
   * @param walkMin 走路要多少分钟（用来比较值不值得坐车）
   * @param settings 设置
   * @returns 方案数组，按"到达时间"从早到晚
   */
  function plan(from, to, when, walkMin, settings) {
    if (!from || !to || !when) return [];
    var boardStops = nearbyStops(from, MAX_ACCESS);
    var alightStops = nearbyStops(to, MAX_ACCESS);
    if (!boardStops.length || !alightStops.length) return [];

    var options = [];

    routeTable().forEach(function (route) {
      var ids = stopIds(route);
      if (ids.length < 2) return;

      boardStops.forEach(function (b) {
        var i = ids.indexOf(b.id);
        if (i < 0) return;
        var walkBefore = accessMinutes(from, b.stop, settings);
        if (walkBefore === null) return;

        var toBoard = i === 0 ? 0 : rideMinutes(route, 0, i, settings);
        if (toBoard === null) return;

        alightStops.forEach(function (a) {
          var j = ids.indexOf(a.id);
          if (j < 0 || j === i) return;

          var ride = rideMinutes(route, i, j, settings);
          if (ride === null) return;

          var walkAfter = accessMinutes(to, a.stop, settings);
          if (walkAfter === null) return;

          /* 走到车站的时刻 */
          var atStop = new Date(when.getTime() + walkBefore * 60000);

          var boardRules = noteRules(stopNote(route, b.id));
          var alightRules = noteRules(stopNote(route, a.id));

          /* 找一班"到站时间不早于你到站、而且真的停这两个站"的车 */
          var departures = nextDepartures(route, new Date(atStop.getTime() - toBoard * 60000), 8);
          var picked = null;
          for (var n = 0; n < departures.length; n++) {
            var boardAt = new Date(departures[n].getTime() + toBoard * 60000);
            if (boardAt.getTime() < atStop.getTime() - 1000) continue;
            if (!runStops(boardRules, departures[n])) continue;
            if (!runStops(alightRules, departures[n])) continue;
            picked = departures[n];
            break;
          }
          if (!picked) return;

          var boardAt2 = new Date(picked.getTime() + toBoard * 60000);
          var arriveAtAlight = new Date(boardAt2.getTime() + ride * 60000);
          var arriveAt = new Date(arriveAtAlight.getTime() + walkAfter * 60000);
          var total = (arriveAt.getTime() - when.getTime()) / 60000;

          options.push({
            route: route,
            board: { id: b.id, stop: b.stop, distance: b.distance, minutes: walkBefore },
            alight: { id: a.id, stop: a.stop, distance: a.distance, minutes: walkAfter },
            departAt: picked,
            boardAt: boardAt2,
            arriveAt: arriveAt,
            waitMin: (boardAt2.getTime() - atStop.getTime()) / 60000,
            rideMin: ride,
            totalMin: total,
            circular: isCircular(route),
            wrapped: j < i,
            boardNote: stopNote(route, b.id),
            alightNote: stopNote(route, a.id),
            /* 校历算不出来，只能提醒 */
            caveat: boardRules.dayType || alightRules.dayType,
            saves: walkMin === null || walkMin === undefined ? null : walkMin - total
          });
        });
      });
    });

    /* 同一班车（同一条线、同一个上车时刻）只留最快到的那条 */
    var best = {};
    options.forEach(function (o) {
      var key = o.route.no + "@" + o.board.id + "@" + o.departAt.getTime();
      if (!best[key] || o.totalMin < best[key].totalMin) best[key] = o;
    });
    var list = Object.keys(best).map(function (k) { return best[k]; });
    /* 有"要看校历"这类前提的排在后面：能用没前提的方案就用没前提的 */
    list.sort(function (a, b) {
      if (!!a.caveat !== !!b.caveat) return a.caveat ? 1 : -1;
      return a.arriveAt - b.arriveAt;
    });

    /* 上车时刻早于"现在"的（赶不上）已经在上面挡掉了；
       这里再把"上车时间比走路到达还晚"的挑出来排前面也不合适，
       直接按到达时间给，谁快谁在前。 */
    return list.slice(0, 3);
  }

  /* 今日还有哪些路线在开（给设置页/调试看） */
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
    nearbyStops: nearbyStops,
    stopIds: stopIds,
    stopNote: stopNote,
    noteRules: noteRules,
    runStops: runStops,
    isCircular: isCircular,
    MAX_ACCESS: MAX_ACCESS,
    DEFAULT_BUS_SPEED: DEFAULT_BUS_SPEED
  };
})(window.OP);
