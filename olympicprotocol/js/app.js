/* 界面控制：把课表、定位、语音、路线串起来 */

(function () {
  "use strict";

  var OP = window.OP;
  var P = OP.Planner;
  var Geo = OP.Geo;
  var Store = OP.Store;

  var data = Store.load();
  /* load() 会把默认楼栋里新补的楼并进本地那份，启动后提示一句 */
  var pendingBuildingSync = Store.lastSync();
  var state = {
    view: "today",
    now: new Date(),
    position: null,
    locating: false,
    geoError: "",
    fired: Store.loadFired(),
    lastCheck: 0,
    hintShown: false,
    places: [],
    placesStatus: "未搜索",
    placesRaw: null,
    /* 校区楼栋列表默认收起，只看前几栋 */
    buildingListExpanded: false,
    ocr: { courses: [], warnings: [], busy: false }
  };

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function esc(text) {
    return String(text === undefined || text === null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  /**
   * 当前跑的是哪一次构建。
   *
   * 部署脚本会给 js/css 的地址加一个 ?v=xxx 的时间戳，直接从 script 标签上
   * 读回来就行——不用再单独维护一个"构建号"，省得两边对不上。
   * 本地直接打开源码时没有这个参数，就显示「本地」。
   */
  function buildStamp() {
    var tags = document.querySelectorAll("script[src]");
    for (var i = 0; i < tags.length; i++) {
      var hit = /[?&]v=([^&"']+)/.exec(tags[i].getAttribute("src") || "");
      if (hit) return hit[1];
    }
    return "本地";
  }

  /* ---------- 页尾留白 ----------
   * 底部导航是固定定位的，会盖住页尾内容。
   * 先按它实际占掉的高度预留，渲染完再核对一次"滑到底时最后一个卡片
   * 会不会被盖住"，会就继续加大。只按高度估算是不够的——
   * 不同浏览器算出来的视口高度不一样，总会差一截。
   */

  var MAX_BOTTOM_SPACE = 480;

  /* 校区楼栋列表收起时显示几栋 */
  var BUILDING_PREVIEW = 5;

  /* 读当前生效的留白值。不能只看内联样式——初始时它是空的，
     会被当成 0，反而把 CSS 里那个偏大的兜底值覆盖成更小的。 */
  function currentBottomSpace() {
    var root = document.documentElement;
    var inline = parseFloat(root.style.getPropertyValue("--bottom-space"));
    if (!isNaN(inline)) return inline;
    return parseFloat(window.getComputedStyle(root).getPropertyValue("--bottom-space")) || 0;
  }

  function setBottomSpace(px) {
    var current = currentBottomSpace();
    var next = Math.min(MAX_BOTTOM_SPACE, px);
    if (next > current) {
      document.documentElement.style.setProperty("--bottom-space", Math.round(next) + "px");
    }
  }

  function measureBottomSpace() {
    var bar = document.querySelector(".tabbar");
    if (!bar) return;

    var barTop = bar.getBoundingClientRect().top;
    var occupied = Math.max(0, window.innerHeight - barTop);
    if (occupied > 0) setBottomSpace(occupied + 28);
  }

  /* 把"滑到最底部时最后一个卡片的位置"算出来，和导航栏顶端比一比。
     不用真的滚动页面就能算，所以不会闪。 */
  function ensureBottomClearance() {
    var bar = document.querySelector(".tabbar");
    var active = document.querySelector(".view.is-active");
    if (!bar || !active) return;

    var cards = active.querySelectorAll(".card");
    var last = null;
    for (var i = cards.length - 1; i >= 0; i--) {
      if (cards[i].offsetParent !== null) { last = cards[i]; break; }
    }
    if (!last) return;

    var root = document.documentElement;
    var docBottom = last.getBoundingClientRect().bottom + window.scrollY;
    var maxScroll = Math.max(0, root.scrollHeight - window.innerHeight);
    var bottomAtEnd = docBottom - maxScroll;
    var barTop = bar.getBoundingClientRect().top;

    var shortfall = Math.ceil(bottomAtEnd + 16 - barTop);
    if (shortfall > 0) {
      setBottomSpace(currentBottomSpace() + shortfall);
    }
  }

  var clearanceTimer = null;

  function scheduleClearanceCheck() {
    window.clearTimeout(clearanceTimer);
    clearanceTimer = window.setTimeout(ensureBottomClearance, 120);
  }

  /* ================= 位置 ================= */

  function effectivePosition() {
    var sim = data.settings.simulate;
    if (sim && typeof sim.lat === "number") {
      return { lat: sim.lat, lng: sim.lng, elevation: sim.elevation, simulated: true };
    }
    return state.position;
  }

  /* 给一个坐标补上海拔。查不到就留着不管，按平地算，
     不影响其它功能——海拔只是让时间更准，不是必需项。 */
  function fillElevation(target, onDone) {
    if (!target || typeof target.lat !== "number") return;
    if (typeof target.elevation === "number") return;

    OP.Elevation.at(target.lat, target.lng).then(function (value) {
      if (typeof value !== "number") return;
      target.elevation = value;
      if (onDone) onDone();
    }).catch(function () { /* 查不到就算了 */ });
  }

  function positionHint() {
    if (data.settings.simulate) return "模拟位置";
    if (state.position) return "定位正常";
    if (state.geoError) return "定位不可用";
    return "定位未启用";
  }

  /* ================= 提示条 ================= */

  function toast(title, body, kind) {
    var wrap = $("#toasts");
    var el = document.createElement("div");
    el.className = "toast" + (kind ? " is-" + kind : "");
    el.innerHTML = "<strong>" + esc(title) + "</strong>" + (body ? esc(body) : "");
    wrap.appendChild(el);
    window.setTimeout(function () {
      el.style.transition = "opacity .3s ease";
      el.style.opacity = "0";
      window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 320);
    }, 6500);
  }

  /* ================= 页面内确认弹窗 =================
   * 不用 window.confirm()：内置浏览器和 App 里的 WebView 常把它静默屏蔽，
   * 结果就是点按钮"完全没反应"——不报错，只是永远返回 false。 */

  var pendingConfirm = null;

  function askConfirm(message, onOk) {
    pendingConfirm = onOk || null;
    $("#confirmText").textContent = message;
    $("#confirmBox").hidden = false;
  }

  function closeConfirm() {
    $("#confirmBox").hidden = true;
    pendingConfirm = null;
  }

  /* ================= 播报 ================= */

  function say(text, label) {
    if (!OP.Speech.supported()) {
      toast("这个浏览器不支持语音合成", "换 Chrome、Edge 或 Safari 试试", "warn");
      return false;
    }
    var ok = OP.Speech.speak(text, data.settings);
    if (ok && label) toast(label, text, "ok");
    return ok;
  }

  /* ================= 当天信息 ================= */

  function nextInfo() {
    var pos = effectivePosition();
    var legs = P.buildLegs(data, pos, state.now);
    var route = legs.filter(function (l) { return l.status === "upcoming"; });
    return {
      found: P.nextCourse(data, state.now),
      legs: legs,
      route: route,
      leg: route.length ? route[0] : null,
      position: pos
    };
  }

  function countdownText(target, now) {
    var total = Math.floor((target.getTime() - now.getTime()) / 1000);
    if (total <= 0) return "00:00";
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    return (h > 0 ? h + ":" : "") + pad2(m) + ":" + pad2(s);
  }

  /* ================= 渲染：顶栏 ================= */

  function renderTop() {
    var now = state.now;
    $("#clock").textContent = pad2(now.getHours()) + ":" + pad2(now.getMinutes()) + ":" + pad2(now.getSeconds());

    var label = P.dateLabel(now);
    var wk = P.weekNumber(now, data.settings.termStart);
    if (wk !== null && wk >= 1 && wk <= 30) label += " · 第 " + wk + " 周";
    $("#todayLabel").textContent = label;

    var pill = $("#geoStatus");
    pill.textContent = positionHint();
    pill.className = "pill " + (
      data.settings.simulate ? "pill-warn" :
      state.position ? "pill-ok" :
      state.geoError ? "pill-err" : "pill-idle"
    );
  }

  /* ================= 渲染：今日 ================= */

  function renderToday() {
    var info = nextInfo();
    var hero = $("#nextCard");
    var list = P.todayCourses(data, state.now);

    hero.classList.remove("is-imminent");

    if (!info.found) {
      $("#nextTag").textContent = "今日结束";
      $("#nextCountdown").textContent = "--:--";
      $("#nextName").textContent = list.length ? "今天的课都上完了" : "今天没有课";
      $("#nextMeta").textContent = list.length
        ? "共 " + list.length + " 节课，已经全部结束"
        : "好好安排自己的时间";
      $("#nextDistance").textContent = "--";
      $("#nextWalk").textContent = "--";
      $("#nextLeave").textContent = "--";
    } else {
      var c = info.found.course;
      var b = P.buildingById(data, c.buildingId);
      var ongoing = info.found.status === "ongoing";
      var target = ongoing ? P.at(state.now, c.end) : P.at(state.now, c.start);

      $("#nextTag").textContent = ongoing ? "正在进行" : "下一节课";
      $("#nextCountdown").textContent = countdownText(target, state.now);
      $("#nextName").textContent = c.name;
      $("#nextMeta").textContent =
        P.cnTime(c.start) + " – " + P.cnTime(c.end) + " · " +
        P.placeText(c, b) + (c.teacher ? " · " + c.teacher : "");

      /* 正在上的课只显示状态，不再算"还要走多远" */
      var leg = null;
      info.legs.forEach(function (l) { if (l.course.id === c.id) leg = l; });

      if (ongoing) {
        $("#nextDistance").textContent = "--";
        $("#nextWalk").textContent = "--";
        $("#nextLeave").textContent = "已在上课";
        $("#nextClimbWrap").hidden = true;
      } else if (leg && leg.metrics) {
        var buffer = Number(data.settings.bufferMinutes) || 0;
        $("#nextDistance").textContent = Geo.formatDistance(leg.metrics.distance);
        $("#nextWalk").textContent = Geo.formatDuration(leg.metrics.minutes);
        $("#nextLeave").textContent = P.fmtHM(P.hm(c.start) - leg.metrics.minutes - buffer);

        /* 有明显爬升时多显示一格，没有就藏起来 */
        var rise = leg.metrics.hasElevation ? Math.round(leg.metrics.rise) : 0;
        $("#nextClimbWrap").hidden = rise < 3;
        /* 不要加箭头：小字号下 ↑ 会被看成数字 1，118 米变成 1118 米 */
        if (rise >= 3) $("#nextClimb").textContent = rise + " 米";

        if (leg.slackMin !== null && leg.slackMin <= 10) hero.classList.add("is-imminent");
      } else {
        $("#nextDistance").textContent = "打开定位";
        $("#nextWalk").textContent = "--";
        $("#nextLeave").textContent = "打开定位";
        $("#nextClimbWrap").hidden = true;
      }
    }

    /* ---- 今日时间轴 ---- */
    var ol = $("#todayList");
    if (!list.length) {
      ol.innerHTML = '<li class="empty">今天没有课程安排</li>';
    } else {
      var nextId = info.found ? info.found.course.id : null;
      ol.innerHTML = list.map(function (c) {
        var bld = P.buildingById(data, c.buildingId);
        var st = P.statusOf(c, state.now);
        var cls = st === "past" ? " is-past" : (st === "ongoing" ? " is-now" : (c.id === nextId ? " is-next" : ""));
        var badge = st === "ongoing"
          ? '<span class="tl-badge is-now">进行中</span>'
          : (st === "past" ? "" : (c.id === nextId ? '<span class="tl-badge">下一节</span>' : ""));
        return '<li class="tl-item' + cls + '">' +
          '<div class="tl-time">' + esc(c.start) + "<small>" + esc(c.end) + "</small></div>" +
          '<div><div class="tl-name">' + esc(c.name) + "</div>" +
          '<div class="tl-meta">' + esc(P.placeText(c, bld)) +
          (c.teacher ? " · " + esc(c.teacher) : "") + "</div></div>" +
          badge + "</li>";
      }).join("");
    }

    $("#todaySummary").textContent = list.length ? list.length + " 节课" : "无课";
  }

  /* ================= 渲染：路线 ================= */

  /* ================= 校巴方案 ================= */

  /**
   * 这一段能不能坐校巴。
   *
   * 上车站取离你最近的、下车站取离教室最近的；最近那个站坐不了才退到第二近。
   * 只要能到目的地附近的车站，这条线就列出来——慢的、赶不上的都列，
   * 由你自己判断。
   *
   * **只写时长，不写"几点到"**：校巴到站时间太不稳，报了反而误导。
   * 每行是「走到车站 + 车程 + 走到教室 = 合计」，再加这条线大概几分钟一班。
   */
  function busOptions(leg, course) {
    if (!leg.fromPoint || !leg.toPoint) return "";

    /* 模块没加载上说明页面是旧缓存（HTML 里没有 js/shuttle.js 那一行），
       这种情况要明说，不能跟"这段没车"长得一样 */
    if (!OP.Shuttle || !(OP.SHUTTLE_ROUTES || []).length) {
      return '<div class="leg-bus is-missing"><div class="leg-bus-head">校巴</div>' +
        '<div class="bus-none">校巴模块没加载——页面是旧缓存。强制刷新一次就会好' +
        '（iOS 加到桌面的话：删掉图标重新添加）。</div></div>';
    }

    var plan = leg.busPlan;
    if (!plan) return "";

    /* 全部列出来：比走路慢也好、赶不上这一节也好，都摆出来让人自己挑。
       排在前面的仍然是"上车站离你最近"的那些。 */
    var groups = plan.groups || [];
    if (!groups.length) {
      return '<div class="leg-bus is-none"><div class="leg-bus-head">校巴</div>' +
        '<div class="bus-none">' + esc(plan.reason || "这段没有合适的班次") + "</div></div>";
    }

    function renderGroup(g) {
      var flags = [];
      if (g.caveat === "teaching" || g.route.group === "meetclass") flags.push("只在教学日");
      if (g.caveat === "nonTeaching") flags.push("只在非教学日");
      if (g.route.group === "night") flags.push("晚间/假日线");
      if (g.boardNote) flags.push("上车：" + g.boardNote);
      if (g.alightNote) flags.push("下车：" + g.alightNote);

      /* 只写预估时长，不写"几点到"——校巴到站时间不稳，报了反而误导 */
      var verdict = "";
      var tone = "";
      if (g.saves !== null && g.saves >= 1) { verdict = "比走路快 " + Math.round(g.saves) + " 分"; tone = " is-faster"; }
      else if (g.saves !== null && g.saves <= -1) verdict = "比走路慢 " + Math.round(-g.saves) + " 分";
      else if (g.saves !== null) verdict = "和走路差不多";

      return '<div class="bus-group">' +
        '<div class="bus-where">' +
          '<span class="bus-tag">' + esc(g.route.no) + "</span>" + esc(g.route.nameZh) +
        "</div>" +
        '<div class="bus-stops">' + esc(g.board.stop.zh) + " 上车 → " +
          esc(g.alight.stop.zh) + " 下车" +
        "</div>" +
        '<div class="bus-ride' + tone + '">' +
          "走到车站 <b>" + Math.round(g.walkBeforeMin) + "</b> 分 + 车程 <b>" +
            Math.round(g.rideMin) + "</b> 分 + 走到教室 <b>" + Math.round(g.walkAfterMin) +
            "</b> 分 = 合计 <b>" + Math.round(g.totalMin) + "</b> 分" +
          (g.headwayMin ? ' · 约每 <b>' + g.headwayMin + "</b> 分钟一班" : "") +
          (verdict ? ' <span class="bus-verdict">' + verdict + "</span>" : "") +
        "</div>" +
        (flags.length ? '<div class="bus-breakdown">' + esc(flags.join(" · ")) + "</div>" : "") +
      "</div>";
    }

    /* 现在在开的排前面；停运的（比如白天的 H 线、晚间的 N 线）自动折叠起来 */
    var running = groups.filter(function (g) { return g.runningNow; });
    var stopped = groups.filter(function (g) { return !g.runningNow; });

    var html = running.map(renderGroup).join("");
    if (stopped.length) {
      html += '<details class="bus-off"><summary>现在停运的线路（' + stopped.length + " 条）</summary>" +
        stopped.map(renderGroup).join("") + "</details>";
    }

    return '<div class="leg-bus"><div class="leg-bus-head">校巴</div>' + html + "</div>";
  }

  function renderRoute() {
    var info = nextInfo();
    var buildings = (data.campus && data.campus.buildings) || [];
    var buffer = Number(data.settings.bufferMinutes) || 0;
    var route = info.route;

    /* 今天要去的楼栋：同一栋去了两次就合并成一条，时间都列出来 */
    var byId = {};
    var stops = [];
    P.todayCourses(data, state.now).forEach(function (course) {
      var b = P.buildingById(data, course.buildingId);
      if (!b || typeof b.lat !== "number" || typeof b.lng !== "number") return;

      if (!byId[b.id]) {
        byId[b.id] = { building: b, order: stops.length + 1, times: [], isNext: false };
        stops.push(byId[b.id]);
      }
      byId[b.id].times.push(course.start);
    });

    var nextBuildingId = route.length && route[0].building ? route[0].building.id : null;
    stops.forEach(function (s) {
      s.time = s.times.join(" · ");
      s.isNext = s.building.id === nextBuildingId;
    });

    /*
     * 先把每段行程的校巴方案算出来。
     * 必须在地图之前算：地图要标出这些车站（在哪上车、在哪下车）。
     */
    var busStops = [];
    var busSeen = {};
    /* 地图上要画的两种连线：我去车站、车站去教室 */
    var busLinks = [];
    var hasShuttle = !!(OP.Shuttle && (OP.SHUTTLE_ROUTES || []).length);

    function rememberStop(entry, role) {
      if (!entry || !entry.stop) return;
      var key = entry.id;
      if (!busSeen[key]) {
        busSeen[key] = { id: entry.id, stop: entry.stop, roles: {} };
        busStops.push(busSeen[key]);
      }
      busSeen[key].roles[role] = true;
    }

    route.forEach(function (leg) {
      leg.busPlan = hasShuttle
        ? OP.Shuttle.plan(leg.fromPoint, leg.toPoint, leg.start,
          leg.metrics ? leg.metrics.minutes : null, data.settings)
        : null;
      if (!leg.busPlan) return;

      /* 实际用到的上下车站 */
      (leg.busPlan.groups || []).forEach(function (g) {
        rememberStop(g.board, "board");
        rememberStop(g.alight, "alight");
      });

      /* 取第一条线（现在在开的排最前）的上下车站画连线 */
      var best = (leg.busPlan.groups || [])[0];
      if (best) {
        if (leg.fromPoint && best.board.stop) {
          busLinks.push({ from: leg.fromPoint, to: best.board.stop });
        }
        if (best.alight.stop && leg.toPoint) {
          busLinks.push({ from: best.alight.stop, to: leg.toPoint });
        }
      }
    });

    /* 三种底图：简图（离线 SVG）/ OSM 街道图 / 港中文校园地图 */
    var mode = data.settings.mapMode || "schematic";
    var svg = $("#mapSvg");
    var realBox = $("#mapReal");

    $$(".map-mode").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.mapmode === mode);
    });

    if (mode === "schematic") {
      /* 注意：SVG 元素没有 hidden 这个 DOM 属性，
         写 svg.hidden = true 只是挂了个没用的变量，属性根本不会设上。
         所以这里直接控制 display。 */
      svg.style.display = "";
      realBox.style.display = "none";
      OP.RealMap.dispose();

      OP.MapView.render(svg, {
        buildings: buildings,
        position: info.position,
        stops: stops,
        busStops: busStops,
        busLinks: busLinks,
        detourFactor: data.settings.detourFactor
      });
    } else {
      svg.style.display = "none";
      realBox.style.display = "";

      OP.RealMap.render(realBox, {
        source: mode,
        position: info.position,
        stops: stops,
        busStops: busStops,
        busLinks: busLinks
      }).catch(function (err) {
        toast("地图加载失败", err.message + "。可以先切回「简图」。", "err");
      });
    }

    /* 简图才需要图例；真实地图上的标记自带标签 */
    $("#mapLegend").hidden = mode !== "schematic";

    var box = $("#routeList");

    if (!route.length) {
      box.innerHTML = '<p class="empty">今天没有需要前往的教室了</p>';
      $("#routeSummary").textContent = "无待办路线";
      return;
    }

    $("#routeSummary").textContent = route.length + " 段行程";

    var html = route.map(function (leg, i) {
      var c = leg.course;
      var b = leg.building;
      var links = b ? Geo.navLinks(b.name, b.lat, b.lng) : [];

      var metrics = leg.metrics
        ? '<div class="leg-meta">' +
            "<span>距离 <b>" + esc(Geo.formatDistance(leg.metrics.distance)) + "</b></span>" +
            (leg.metrics.hasElevation && leg.metrics.rise >= 3
              ? "<span>爬升 <b>" + Math.round(leg.metrics.rise) + " 米</b></span>"
              : "") +
            "<span>步行 <b>" + esc(Geo.formatDuration(leg.metrics.minutes)) + "</b></span>" +
            "<span>建议出发 <b>" + esc(P.fmtHM(P.hm(c.start) - leg.metrics.minutes - buffer)) + "</b></span>" +
          "</div>"
        : "";

      var warn = "";
      if (leg.missed) {
        warn = '<div class="leg-warn">按现在的余量已经很紧了，直接出发吧</div>';
      } else if (leg.slackMin !== null && leg.slackMin <= 10) {
        warn = '<div class="leg-warn">余量只有 ' + Math.max(0, Math.round(leg.slackMin)) + " 分钟，别拖了</div>";
      }

      return '<div class="leg">' +
        '<div class="leg-head">' +
          '<div class="leg-title"><span class="idx">' + (i + 1) + "</span>" +
            esc((leg.fromName || "起点") + " → " + (b ? b.name : "未知地点")) + "</div>" +
          '<div class="leg-time">' + esc(c.start) + " – " + esc(c.end) + "</div>" +
        "</div>" +
        '<div class="leg-meta"><span>' + esc(c.name) +
          (c.room ? " · " + esc(c.room) : "") +
          (c.teacher ? " · " + esc(c.teacher) : "") + "</span></div>" +
        metrics + busOptions(leg, c) + warn +
        '<div class="leg-actions">' +
          links.map(function (l) {
            if (l.copy) {
              return '<button type="button" class="nav-link" data-copy="' + esc(l.copy) + '">' +
                esc(l.label) + "</button>";
            }
            return '<a class="nav-link" href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
              esc(l.label) + "</a>";
          }).join("") +
        "</div>" +
      "</div>";
    }).join("");

    box.innerHTML = html;
  }

  /* ================= 渲染：课表 ================= */

  function renderCourse() {
    var box = $("#courseList");
    var courses = (data.courses || []).slice();

    /* 已经有课的时候才显示「导入前清空」那个选项 */
    $("#ocrReplaceWrap").hidden = !courses.length;

    if (!courses.length) {
      box.innerHTML = '<p class="empty">还没有课程，点右上角「新增课程」开始</p>';
      return;
    }

    box.innerHTML = [1, 2, 3, 4, 5, 6, 7].map(function (day) {
      var dayCourses = courses
        .filter(function (c) { return (c.weekdays || []).indexOf(day) >= 0; })
        .sort(function (a, b) { return P.hm(a.start) - P.hm(b.start); });
      if (!dayCourses.length) return "";

      return '<div class="day-group"><p class="day-title">' + esc(P.WEEKDAYS[day]) + "</p>" +
        dayCourses.map(function (c) {
          var b = P.buildingById(data, c.buildingId);
          return '<div class="course-item">' +
            '<div class="ci-main">' +
              '<div class="ci-title">' + esc(c.name) + "</div>" +
              '<div class="ci-meta">' + esc(c.start) + " – " + esc(c.end) +
                " · " + esc(P.placeText(c, b)) +
                (c.teacher ? " · " + esc(c.teacher) : "") + "<br>" +
                esc(P.weekText(c)) + "</div>" +
            "</div>" +
            '<div class="ci-actions">' +
              '<button class="btn btn-small" data-edit-course="' + esc(c.id) + '">编辑</button>' +
              '<button class="btn btn-small btn-danger" data-del-course="' + esc(c.id) + '">删除</button>' +
            "</div>" +
          "</div>";
        }).join("") + "</div>";
    }).join("");
  }

  function buildWeekdayPicker() {
    $("#cfWeekdays").innerHTML = [1, 2, 3, 4, 5, 6, 7].map(function (d) {
      return '<label class="wd"><input type="checkbox" name="wd" value="' + d + '"><span>' +
        esc(P.WEEKDAYS_SHORT[d]) + "</span></label>";
    }).join("");
  }

  function buildBuildingOptions(selected) {
    var list = (data.campus && data.campus.buildings) || [];
    $("#cfBuilding").innerHTML = list.map(function (b) {
      return '<option value="' + esc(b.id) + '"' + (b.id === selected ? " selected" : "") + ">" +
        esc(b.name) + "</option>";
    }).join("");
  }

  /* ================= 渲染：设置 ================= */

  function renderSettings() {
    var s = data.settings;

    $("#verApp").textContent = "v" + (OP.APP_VERSION || "0.0.0");
    $("#verBuild").textContent = buildStamp();
    $("#verData").textContent = "v" + (OP.Store.defaultBuildingsVersion() || 0);

    $("#vEnabled").checked = s.voiceEnabled !== false;
    $("#vRate").value = s.voiceRate;
    $("#vRateVal").textContent = Number(s.voiceRate).toFixed(2);
    $("#vVolume").value = s.voiceVolume;
    $("#vVolumeVal").textContent = Number(s.voiceVolume).toFixed(2);

    $("#sLead").value = s.leadMinutes;
    $("#sBuffer").value = s.bufferMinutes;
    $("#sSpeed").value = s.walkingSpeed;
    $("#sBusSpeed").value = Number(s.busSpeed) || OP.Shuttle.DEFAULT_BUS_SPEED;
    $("#sDetour").value = s.detourFactor;
    $("#sTermStart").value = s.termStart || "";
    $("#sClimb").value = s.climbFactor;
    $("#campusName").value = (data.campus && data.campus.name) || "";

    $("#plRadius").value = data.settings.placesRadius || 800;
    $("#plMerge").checked = data.settings.placesMerge !== false;
    $("#plEnglish").checked = data.settings.placesEnglish !== false;
    renderPlaces();

    var pos = effectivePosition();
    var nearest = P.nearestBuilding(pos, (data.campus && data.campus.buildings) || []);

    $("#locState").textContent = data.settings.simulate
      ? "模拟位置"
      : (state.locating
        ? "定位中"
        : (state.position ? "已定位" : (state.geoError ? "定位不可用" : "未开始")));
    $("#locCoords").textContent = pos ? pos.lat.toFixed(5) + ", " + pos.lng.toFixed(5) : "--";
    $("#locAccuracy").textContent = (state.position && !data.settings.simulate)
      ? "±" + Math.round(state.position.accuracy) + " 米" : "--";
    $("#locNearest").textContent = nearest ? nearest.building.name : "--";

    var list = (data.campus && data.campus.buildings) || [];
    /* 一栋都没有的时候没必要显示清空按钮 */
    $("#btnClearBuildings").hidden = !list.length;
    renderBuildingList(list);
  }

  /* 楼栋列表：支持关键词搜索和「只看缺坐标的」 */
  function renderBuildingList(all) {
    var query = ($("#buildingSearch").value || "").trim();
    var missingOnly = $("#buildingMissingOnly").checked;
    var shown = P.filterBuildings(all, query, missingOnly);

    var missingCount = all.filter(function (b) {
      return typeof b.lat !== "number" || typeof b.lng !== "number";
    }).length;
    var noElevation = all.filter(function (b) {
      return typeof b.lat === "number" && typeof b.lng === "number" &&
        typeof b.elevation !== "number";
    }).length;

    var count = "共 " + all.length + " 栋";
    if (missingCount) count += "，其中 " + missingCount + " 栋还没坐标";
    if (noElevation) count += "，" + noElevation + " 栋还没海拔（点「获取海拔」补）";
    if (missingOnly) count += " · 「只看还没坐标的」已开启";
    if (query || missingOnly) count += " · 当前显示 " + shown.length + " 栋";
    $("#buildingCount").textContent = count;

    if (!shown.length) {
      $("#buildingList").innerHTML = '<p class="empty">' + esc(emptyMessage(all, query, missingOnly)) + "</p>";
      return;
    }

    /* 收起时只显示前几栋。搜索/筛选时不收起——那说明你正在找某一栋 */
    var searching = !!(query || missingOnly);
    var visible = (searching || state.buildingListExpanded)
      ? shown
      : shown.slice(0, BUILDING_PREVIEW);

    var items = visible.map(function (b) {
      var hasCoords = typeof b.lat === "number" && typeof b.lng === "number";
      var coordText = hasCoords
        ? Number(b.lat).toFixed(5) + ", " + Number(b.lng).toFixed(5)
        : '<span class="bi-missing">还没坐标</span>';
      var alias = (b.alias && b.alias.length) ? b.alias.join("、") : "";
      var elevText = typeof b.elevation === "number"
        ? "海拔 " + Math.round(b.elevation) + " 米"
        : (hasCoords ? '<span class="bi-missing">海拔未知</span>' : "");

      return '<div class="building-item">' +
        '<div><div class="bi-name">' + esc(b.name) + "</div>" +
        '<div class="bi-meta">' + coordText +
        (elevText ? " · " + elevText : "") +
        (alias ? " · " + esc(alias) : "") + "</div></div>" +
        '<div class="ci-actions">' +
          '<button class="btn btn-small" data-edit-building="' + esc(b.id) + '">编辑</button>' +
          '<button class="btn btn-small btn-danger" data-del-building="' + esc(b.id) + '">删除</button>' +
        "</div></div>";
    }).join("");

    /* 只在没搜索的时候给"展开/收起"，这时才有"全部"这个概念 */
    var more = "";
    if (!searching && shown.length > BUILDING_PREVIEW) {
      more = '<button type="button" class="btn btn-small btn-ghost building-more" data-toggle-buildings>' +
        (state.buildingListExpanded
          ? "收起（只看前 " + BUILDING_PREVIEW + " 栋）"
          : "显示全部 " + shown.length + " 栋") +
        "</button>";
    }

    $("#buildingList").innerHTML = items + more;

    scheduleClearanceCheck();
  }

  /**
   * 筛不出东西时说清楚是哪一步把结果滤掉的。
   *
   * 踩过的坑：搜 "lady shaw" 明明有这栋楼却什么都不显示，
   * 因为上面那个「只看还没坐标的」还勾着——而原来的提示只说"没有匹配的楼栋"，
   * 完全没提这个可能性，非常难自查。
   */
  function emptyMessage(all, query, missingOnly) {
    if (!query && !missingOnly) return "还没有楼栋，先添加一个";

    if (missingOnly) {
      var matched = query ? P.filterBuildings(all, query, false).length : 0;
      if (matched) {
        return "有 " + matched + " 栋符合" + (query ? "「" + query + "」" : "") +
          "，但被「只看还没坐标的」筛掉了 —— 取消勾选就能看到";
      }
      if (!query) return "所有楼栋都已经有坐标了";
    }

    return "没有匹配「" + query + "」的楼栋";
  }

  /* ================= 总渲染 ================= */

  /* 复制文本：优先用剪贴板 API，老浏览器退回临时输入框 */
  function copyText(text, label) {
    function finish(ok) {
      toast(ok ? "坐标已复制" : "复制失败",
        ok ? text + "（粘到任何地图 App 的搜索框都行）" : "手动选中这串数字吧：" + text,
        ok ? "ok" : "err");
    }

    function fallback() {
      var input = document.createElement("textarea");
      input.value = text;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();

      var ok = false;
      try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
      document.body.removeChild(input);
      finish(ok);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { finish(true); }, fallback);
      return;
    }
    fallback();
    void label;
  }

  function render() {
    renderTop();
    if (state.view === "today") renderToday();
    else if (state.view === "route") renderRoute();
    else if (state.view === "course") renderCourse();
    else if (state.view === "settings") renderSettings();
    /* 内容变了，页尾留白要重新核对 */
    scheduleClearanceCheck();
  }

  function save() {
    /* 楼栋统一按名字排序，这样列表、下拉框、导出的顺序都一致 */
    if (data.campus) data.campus.buildings = Store.sortBuildings(data.campus.buildings);
    Store.save(data);
  }

  function saveAndRender() {
    save();
    render();
  }

  /* ================= 定位 ================= */

  function startLocate() {
    if (!Geo.supported()) {
      toast("这个浏览器不支持定位", "换 Chrome、Edge 或 Safari 试试", "err");
      return;
    }
    state.locating = true;
    state.geoError = "";
    render();

    Geo.watch(function (pos) {
      /* 每次定位都换一个新对象，把已经查到的海拔带过去，省得重复请求 */
      if (state.position && typeof state.position.elevation === "number") {
        pos.elevation = state.position.elevation;
      }
      state.position = pos;
      state.locating = true;
      state.geoError = "";
      render();
      fillElevation(state.position, render);
    }, function (err) {
      state.locating = false;
      state.geoError = Geo.readableError(err);
      render();
    });

    toast("开始定位", "首次使用请在弹窗里允许位置权限", "ok");
  }

  function stopLocate() {
    Geo.stop();
    state.locating = false;
    render();
    toast("已停止定位", "");
  }

  /* ================= 提醒 ================= */

  function firedKey(kind, courseId) {
    return P.dateKey(state.now) + "|" + courseId + "|" + kind;
  }

  function pruneFired() {
    var today = P.dateKey(state.now);
    Object.keys(state.fired).forEach(function (k) {
      if (k.indexOf(today) !== 0) delete state.fired[k];
    });
  }

  function checkAlerts() {
    pruneFired();
    var info = nextInfo();
    if (!info.found || !info.leg) return;
    if (info.found.status === "ongoing") return;

    var leg = info.leg;
    var now = state.now;
    var lead = Number(data.settings.leadMinutes) || 0;
    var leadAt = new Date(leg.start.getTime() - lead * 60000);

    var leadKey = firedKey("lead", leg.course.id);
    if (!state.fired[leadKey] && lead > 0 && now >= leadAt && now < leg.start) {
      state.fired[leadKey] = Date.now();
      Store.saveFired(state.fired);
      say(P.nextText(data, now, effectivePosition()), "课前提醒");
    }

    var leaveKey = firedKey("leave", leg.course.id);
    if (!state.fired[leaveKey] && now >= leg.departAt && now < leg.start) {
      state.fired[leaveKey] = Date.now();
      Store.saveFired(state.fired);
      say(P.leaveText(leg, now), "出发提醒");
    }
  }

  /* ================= 课程表单 ================= */

  function openCourseForm(course) {
    buildWeekdayPicker();
    buildBuildingOptions(course ? course.buildingId : null);
    $("#courseFormTitle").textContent = course ? "编辑课程" : "新增课程";
    $("#cfId").value = course ? course.id : "";
    $("#cfName").value = course ? course.name : "";
    $("#cfRoom").value = course ? (course.room || "") : "";
    $("#cfTeacher").value = course ? (course.teacher || "") : "";
    $("#cfStart").value = course ? course.start : "08:00";
    $("#cfEnd").value = course ? course.end : "09:40";
    var weeks = (course && course.weeks) || [1, 16];
    $("#cfWeeksFrom").value = weeks[0];
    $("#cfWeeksTo").value = weeks[1];

    $$('#cfWeekdays input[name="wd"]').forEach(function (input) {
      input.checked = !!(course && (course.weekdays || []).indexOf(Number(input.value)) >= 0);
    });
    if (!course) $("#cfWeekdays input[value='1']").checked = true;

    $("#courseFormCard").hidden = false;
    $("#courseFormCard").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeCourseForm() { $("#courseFormCard").hidden = true; }

  function submitCourse(ev) {
    ev.preventDefault();

    var days = $$('#cfWeekdays input[name="wd"]')
      .filter(function (i) { return i.checked; })
      .map(function (i) { return Number(i.value); });

    if (!days.length) {
      toast("还没有选上课星期", "至少勾选一天", "warn");
      return;
    }
    if (P.hm($("#cfEnd").value) <= P.hm($("#cfStart").value)) {
      toast("时间不对", "下课时间要晚于上课时间", "warn");
      return;
    }

    var id = $("#cfId").value;
    var payload = {
      name: $("#cfName").value.trim(),
      buildingId: $("#cfBuilding").value,
      room: $("#cfRoom").value.trim(),
      teacher: $("#cfTeacher").value.trim(),
      start: $("#cfStart").value,
      end: $("#cfEnd").value,
      weekdays: days.sort(function (a, b) { return a - b; }),
      weeks: [Number($("#cfWeeksFrom").value) || 1, Number($("#cfWeeksTo").value) || 16]
    };

    if (id) {
      var target = P.courseById(data, id);
      if (target) Object.keys(payload).forEach(function (k) { target[k] = payload[k]; });
    } else {
      payload.id = Store.uid("c");
      data.courses.push(payload);
    }

    closeCourseForm();
    saveAndRender();
    toast(id ? "已更新课程" : "已添加课程", payload.name, "ok");
  }

  /* ================= 楼栋表单 ================= */

  /* ================= 从地图读取附近楼栋 ================= */

  function renderPlaces() {
    var box = $("#placesList");
    var list = state.places || [];
    $("#plStatus").textContent = state.placesStatus;

    if (!list.length) {
      box.innerHTML = "";
      return;
    }

    var split = OP.Places.splitDuplicates(list, (data.campus && data.campus.buildings) || [], 25);
    var freshSet = split.fresh;

    box.innerHTML = list.map(function (item, i) {
      var dup = freshSet.indexOf(item) === -1;
      var badges = "";
      if (item.teaching) badges += '<span class="pi-badge">教学楼</span>';
      if (item.merged > 1) badges += '<span class="pi-badge">合并 ' + item.merged + " 个点</span>";
      if (dup) badges += '<span class="pi-badge is-muted">已在列表</span>';

      var meta = [
        item.distance !== null ? Geo.formatDistance(item.distance) : "",
        "OpenStreetMap",
        item.kind || "",
        item.address || ""
      ].filter(function (t) { return t; }).join(" · ");

      return '<label class="place-item">' +
        '<input type="checkbox" data-place-idx="' + i + '"' + (dup ? "" : " checked") + ">" +
        '<div class="pi-main">' +
          '<div class="pi-name">' + esc(item.name) + badges + "</div>" +
          (item.alias && item.alias.length
            ? '<div class="pi-alias">又名：' + esc(item.alias.slice(0, 4).join("、")) + "</div>"
            : "") +
          '<div class="pi-meta">' + esc(meta) + "</div>" +
          (item.merged > 1 && item.mergedNames && item.mergedNames.length
            ? '<div class="pi-meta">同栋楼内还有：' + esc(item.mergedNames.join("、")) + "</div>"
            : "") +
          (dup
            ? '<button type="button" class="btn btn-small place-merge" data-place-idx="' + i +
              '">把这些名字补进已有楼栋</button>'
            : "") +
        "</div></label>";
    }).join("");
  }

  /* 之前只导入了中文名的楼栋，可以用这个把英文名补进别名 */
  function mergePlaceAliases(index) {
    var item = (state.places || [])[index];
    if (!item) return;

    var buildings = (data.campus && data.campus.buildings) || [];
    var target = OP.Places.findExisting(item, buildings, 25);
    if (!target) {
      toast("没找到对应的楼栋", "列表可能已经变了，重新搜一次", "warn");
      return;
    }

    var added = OP.Places.mergeAliases(item, target);
    if (!added) {
      toast("没有需要补的名字", "「" + target.name + "」已经有这些名字了");
      return;
    }

    saveAndRender();
    renderPlaces();
    toast("已补充 " + added + " 个名字", "「" + target.name + "」以后课表里出现这些名字都能匹配上", "ok");
  }

  function searchPlaces() {
    var pos = effectivePosition();

    if (!pos) {
      toast("还没有位置", "先在「定位」里开启定位，或用模拟位置", "warn");
      return;
    }

    var radius = Number($("#plRadius").value) || 800;
    data.settings.placesRadius = radius;
    save();

    state.placesRaw = null;
    state.places = [];
    renderPlaces();
    $("#btnSearchPlaces").disabled = true;
    startPlacesTicker(radius);

    var options = placeOptions(pos, radius);
    options.onRaw = function (raw) { state.placesRaw = raw; };

    OP.Places.search(options).then(function (list) {
      stopPlacesTicker();
      state.places = list;
      state.placesStatus = list.length ? "找到 " + list.length + " 个" : "没找到";
      renderPlaces();
      if (!list.length) {
        toast("没有找到建筑", "换个来源、把半径调大，或清空名称过滤再试", "warn");
      } else if (state.placesRaw && state.placesRaw.length >= OP.Places.resultLimitFor(radius)) {
        /* 结果顶到上限，说明很可能被截断了 */
        toast("结果已达上限，可能有楼栋没列出来",
          "这个半径下带名字的建筑超过 " + OP.Places.resultLimitFor(radius) +
          " 栋。找指定的楼用上面的「按名字搜」。", "warn");
      }
    }).catch(function (err) {
      stopPlacesTicker();
      state.placesRaw = null;
      state.places = [];
      state.placesStatus = "搜索失败";
      renderPlaces();
      toast("搜索失败", err.message, "err");
    }).then(function () {
      $("#btnSearchPlaces").disabled = false;
    });
  }

  /* 搜索参数集中在这里，重新排序和重新联网都走同一份 */
  function placeOptions(pos, radius) {
    return {
      lat: pos.lat,
      lng: pos.lng,
      radius: radius,
      keyword: $("#plKeyword").value,
      merge: data.settings.placesMerge !== false,
      preferEnglish: data.settings.placesEnglish !== false
    };
  }

  /**
   * 只改本地展示，不重新联网。
   * 「合并同一栋楼」「优先用英文名」「名称过滤」都走这里——瞬间生效。
   */
  function reshapePlaces() {
    var pos = effectivePosition();
    if (!state.placesRaw || !pos) return;

    var radius = Number($("#plRadius").value) || 800;
    state.places = OP.Places.shape(state.placesRaw, placeOptions(pos, radius));
    state.placesStatus = state.places.length ? "找到 " + state.places.length + " 个" : "没找到";
    renderPlaces();
  }

  /* 搜索时显示已用秒数，免得看起来像卡死了 */
  /**
   * 按名字找指定的楼。
   *
   * 半径搜索有结果条数上限，校园里楼多的时候想找的那一栋可能被截断在外，
   * 所以"找某个具体的楼"必须走名字检索，和"看看附近有什么"是两件事。
   */
  function searchPlacesByName() {
    var query = $("#plNameQuery").value.trim();
    if (!query) {
      toast("请输入楼栋名字", "中文英文都行，例如 Lady Shaw 或 邵逸夫", "warn");
      return;
    }

    var pos = effectivePosition();
    state.placesRaw = null;
    state.places = [];
    renderPlaces();
    $("#btnSearchByName").disabled = true;
    $("#plStatus").textContent = "搜索中…";

    OP.Places.searchByName(query, pos ? { lat: pos.lat, lng: pos.lng } : {}).then(function (list) {
      state.places = OP.Places.shape(list, placeOptions(pos || { lat: 0, lng: 0 },
        Number($("#plRadius").value) || 800));
      state.placesStatus = list.length ? "按名字找到 " + state.places.length + " 个" : "没找到";
      renderPlaces();
      if (!list.length) {
        toast("没找到这个楼栋", "换个写法试试，比如只输一部分名字", "warn");
      }
    }).catch(function (err) {
      state.places = [];
      state.placesStatus = "搜索失败";
      renderPlaces();
      toast("按名字搜索失败", err.message, "err");
    }).then(function () {
      $("#btnSearchByName").disabled = false;
    });
  }

  var placesTicker = null;

  function startPlacesTicker(radius) {
    stopPlacesTicker();
    var started = Date.now();
    var limit = Math.round(OP.Places.timeoutFor(radius) / 1000);
    $("#plStatus").textContent = "搜索中… 0 秒";
    placesTicker = window.setInterval(function () {
      var sec = Math.floor((Date.now() - started) / 1000);
      var text = "搜索中… " + sec + " 秒（最多等 " + limit + " 秒）";
      /* 等久了给句话，免得看起来像卡死 */
      if (sec >= 30) text += " · 地图服务繁忙，请再等等";
      $("#plStatus").textContent = text;
    }, 1000);
  }

  function stopPlacesTicker() {
    if (placesTicker) {
      window.clearInterval(placesTicker);
      placesTicker = null;
    }
  }

  function addSelectedPlaces() {
    var list = state.places || [];
    var picked = $$("#placesList input[data-place-idx]:checked")
      .map(function (input) { return Number(input.getAttribute("data-place-idx")); });

    if (!picked.length) {
      toast("没有勾选任何建筑", "先勾上要去的那几栋", "warn");
      return;
    }

    var added = 0;
    picked.forEach(function (idx) {
      var item = list[idx];
      if (!item) return;
      data.campus.buildings.push({
        id: Store.uid("b"),
        name: item.name,
        alias: (item.alias || []).slice(0, 8),
        lat: Number(Number(item.lat).toFixed(6)),
        lng: Number(Number(item.lng).toFixed(6))
      });
      added++;
    });

    saveAndRender();
    renderPlaces();
    toast("已加入 " + added + " 栋楼", "可以在下面的「校区楼栋」里改名和加别名", "ok");
  }

  /* ================= 从截图导入课表 ================= */

  /* ================= 自动补齐楼栋 =================
   *
   * 导入课表时，匹配不上已有楼栋的地点会先建一个"没有坐标"的占位。
   * 这里逐个拿它们的名字去 OSM 找，挑名字最像的那一栋，把坐标和别名填进去。
   */

  /* Nominatim 的使用条款要求每秒最多一次请求 */
  var NOMINATIM_GAP = 1100;

  function pendingBuildings() {
    return ((data.campus && data.campus.buildings) || []).filter(function (b) {
      return b.name && (typeof b.lat !== "number" || typeof b.lng !== "number");
    });
  }

  /**
   * @param {Function} onProgress (已完成, 总数, 当前楼栋名)
   * @returns {Promise<{total, filled, skipped}>}
   */
  function autoFillBuildings(onProgress) {
    var todo = pendingBuildings();
    if (!todo.length) return Promise.resolve({ total: 0, filled: 0, skipped: [] });

    var pos = effectivePosition();
    var near = pos ? { lat: pos.lat, lng: pos.lng } : {};
    var filled = 0;
    var skipped = [];
    var index = 0;

    function step() {
      if (index >= todo.length) return Promise.resolve();

      var building = todo[index++];
      if (onProgress) onProgress(index, todo.length, building.name);

      return OP.Places.searchByName(building.name, near).then(function (candidates) {
        var match = OP.Places.bestNameMatch(building.name, candidates, 0.6);
        if (!match) {
          skipped.push(building.name);
          return;
        }
        building.lat = Number(Number(match.lat).toFixed(6));
        building.lng = Number(Number(match.lng).toFixed(6));
        /* 显示名保留课表里的写法，OSM 的中英文名补进别名 */
        OP.Places.mergeAliases(match, building);
        filled++;
      }).catch(function () {
        skipped.push(building.name);
      }).then(function () {
        return new Promise(function (done) { window.setTimeout(done, NOMINATIM_GAP); });
      }).then(step);
    }

    return step().then(function () {
      saveAndRender();
      return { total: todo.length, filled: filled, skipped: skipped };
    });
  }

  function runAutoFill(silentWhenEmpty) {
    var button = $("#btnAutoFillBuildings");
    var original = button ? button.textContent : "";
    if (button) button.disabled = true;

    return autoFillBuildings(function (done, total) {
      if (button) button.textContent = "补齐中 " + done + "/" + total;
    }).then(function (result) {
      if (button) {
        button.disabled = false;
        button.textContent = original;
      }

      if (!result.total) {
        if (!silentWhenEmpty) toast("没有需要补的楼栋", "所有楼栋都有坐标了", "ok");
        return result;
      }

      var detail = result.filled + " / " + result.total + " 栋已补上坐标";
      if (result.skipped.length) {
        detail += "；没找到：" + result.skipped.join("、");
      }
      toast("自动补齐完成", detail, result.filled ? "ok" : "warn");
      return result;
    });
  }

  function ocrProgress(text, ratio) {
    var box = $("#ocrProgress");
    var bar = $("#ocrProgressBar");
    var label = $("#ocrProgressText");

    if (text === null) {
      box.hidden = true;
      label.hidden = true;
      return;
    }
    box.hidden = false;
    label.hidden = false;
    bar.style.width = Math.max(2, Math.round((ratio || 0) * 100)) + "%";
    label.textContent = text + (ratio ? "  " + Math.round(ratio * 100) + "%" : "");
  }

  function clearOcr(keepStatus) {
    state.ocr.courses = [];
    state.ocr.warnings = [];
    state.ocr.lastResult = null;
    $("#ocrResult").innerHTML = "";
    $("#ocrActions").hidden = true;
    $("#ocrDebug").hidden = true;
    ocrProgress(null);
    if (!keepStatus) $("#ocrStatus").textContent = "未开始";
  }

  /* 识别明细，用来判断问题出在哪一步（引擎没吐字 / 找不到表头 / 拼不出格子） */
  function renderOcrDebug(result) {
    var box = $("#ocrDebug");
    if (!result || !result.wordCount) {
      box.hidden = true;
      return;
    }

    var cols = (result.columns || []).map(function (c) {
      return P.WEEKDAYS_SHORT[c.day];
    }).join(" ");
    var axis = result.timeAxis
      ? (result.timeAxis.points || []).length + " 个时间刻度"
      : "没找到时间刻度";

    box.hidden = false;
    var rejected = result.rejected || [];

    $("#ocrDebugSummary").textContent =
      "文字块 " + result.wordCount + " 个 · 分割模式 " + result.mode +
      (result.variant ? " · 像素处理 " + result.variant : "") +
      " · 试了 " + result.tries + " 遍 · 列：" + (cols || "没找到") +
      " · " + axis + " · 拼出课程 " + (result.courses || []).length + " 条" +
      " · 丢弃 " + rejected.length + " 个格子";

    var parts = [];
    if (rejected.length) {
      parts.push("【被丢弃的格子】判定标准是必须同时有「4 字母 + 4 数字」的课程代号和课程类型：");
      rejected.forEach(function (r) {
        parts.push("· " + r.reason + "：" + r.text);
      });
      parts.push("");
    }
    parts.push("【引擎识别到的原文】");
    parts.push((result.text || "").slice(0, 4000) || "（引擎没有返回文字内容）");

    $("#ocrDebugText").textContent = parts.join("\n");
  }

  function handleOcrFile(file) {
    if (state.ocr.busy) return;
    if (!file || !/^image\//.test(file.type || "")) {
      toast("这不是图片", "截图之后再拖进来，或者直接按 Ctrl+V 粘贴", "warn");
      return;
    }

    state.ocr.busy = true;
    state.ocr.courses = [];
    $("#ocrResult").innerHTML = "";
    $("#ocrActions").hidden = true;
    $("#ocrStatus").textContent = "识别中…";
    ocrProgress("正在准备", 0.02);

    OP.Ocr.run(file, {
      lang: $("#ocrChinese").checked ? "eng+chi_sim" : "eng",
      onProgress: ocrProgress
    }).then(function (result) {
      ocrProgress(null);
      state.ocr.lastResult = result;
      state.ocr.courses = result.courses || [];
      state.ocr.warnings = result.warnings || [];
      renderOcrDebug(result);

      if (!state.ocr.courses.length) {
        $("#ocrStatus").textContent = "没认出来";

        var words = result.wordCount || 0;
        var reason;
        if (!words) {
          reason = "识别引擎没有从这张图里读出一个字。多半是图片太小或太糊——" +
            "试试把课表区域放大后重新截图，别截图整个手机屏幕。";
        } else if (!result.columns || !result.columns.length) {
          reason = "读到了 " + words + " 个文字，但没找到星期那一行表头。" +
            "确认截图里完整包含 Monday…Friday（或周一…周五）这一行。";
        } else {
          reason = "读到了 " + words + " 个文字，也找到了表头，但没能拼出课程。" +
            "展开下面的识别详情，把里面的内容发给我，我按实际情况调。";
        }
        $("#ocrResult").innerHTML = '<p class="empty">' + esc(reason) + "</p>";
        return;
      }

      $("#ocrStatus").textContent = "识别出 " + state.ocr.courses.length + " 条";
      renderOcrResult();
    }).catch(function (err) {
      ocrProgress(null);
      $("#ocrStatus").textContent = "失败";
      toast("识别失败", err.message, "err");
    }).then(function () {
      state.ocr.busy = false;
    });
  }

  function renderOcrResult() {
    var list = state.ocr.courses;
    var buildings = (data.campus && data.campus.buildings) || [];

    var html = '<div class="ocr-list">';

    list.forEach(function (c, i) {
      var match = OP.Ocr.matchBuilding(c.buildingName, buildings);
      /* 「不需要教室」的课没有地点，下拉里说清楚，别让人以为漏读了 */
      var options = '<option value="">' + (c.noRoom ? "（不需要教室）" : "（未指定）") + "</option>" +
        buildings.map(function (b) {
          return '<option value="' + esc(b.id) + '"' + (match && match.id === b.id ? " selected" : "") + ">" +
            esc(b.name) + "</option>";
        }).join("");

      if (c.buildingName && !match) {
        options += '<option value="__new__" selected>＋ 新建楼栋：' + esc(c.buildingName) + "</option>";
      }

      var notes = [];
      if (c.waiting) notes.push("原课表标记为候补（Waiting）");
      if (c.needsTime) notes.push("时间没读准，请核对");
      if (c.buildingName && !match) {
        notes.push("「" + c.buildingName + "」不在楼栋列表里，导入时会新建，之后要补坐标");
      } else if (match && !match.exact) {
        /* 只报把握度：匹配到哪一栋，上面那个下拉框里已经选中了，不用再念一遍 */
        notes.push("自动匹配 " + Math.round(match.score * 100) + "%");
      }

      /* 黄框只给"页面上确实写了原因"的行留着。
         地点待定（TBA）不再单独提醒，所以也不标黄——
         否则会出现"黄框但一个字都没说"的怪状态，下拉框里显示"（未指定）"已经说明问题。 */
      var bad = c.needsTime || (c.buildingName && !match) || (match && !match.exact);

      html += '<div class="ocr-row' + (bad ? " is-bad" : "") + '" data-idx="' + i + '"' +
        ' data-building-name="' + esc(c.buildingName || "") + '">' +
        '<div class="ocr-row-head">' +
          '<select class="ocr-day">' + [1, 2, 3, 4, 5, 6, 7].map(function (d) {
            return '<option value="' + d + '"' + (d === c.weekday ? " selected" : "") + ">" +
              esc(P.WEEKDAYS_SHORT[d]) + "</option>";
          }).join("") + "</select>" +
          '<input class="ocr-start" type="time" value="' + esc(c.start || "") + '">' +
          '<span class="ocr-dash">–</span>' +
          '<input class="ocr-end" type="time" value="' + esc(c.end || "") + '">' +
          '<button type="button" class="btn btn-small btn-danger ocr-remove">移除</button>' +
        "</div>" +
        '<input class="ocr-name" type="text" value="' + esc(c.name || "") + '" placeholder="课程名称">' +
        '<div class="field-row">' +
          '<select class="ocr-building">' + options + "</select>" +
          '<input class="ocr-room" type="text" value="' + esc(c.room || "") + '" placeholder="房间">' +
        "</div>" +
        (notes.length ? '<div class="ocr-note">' + esc(notes.join("；")) + "</div>" : "") +
      "</div>";
    });

    html += "</div>";
    $("#ocrResult").innerHTML = html;
    $("#ocrActions").hidden = false;
    $("#ocrReplaceWrap").hidden = !(data.courses && data.courses.length);
    /* 结果一出来卡片会变高很多，重新核对页尾留白 */
    scheduleClearanceCheck();
  }

  function importOcrCourses(skipConfirm) {
    var rows = $$(".ocr-row");
    if (!rows.length) return;

    var weekFrom = Number($("#ocrWeekFrom").value) || 1;
    var weekTo = Number($("#ocrWeekTo").value) || 30;
    var clearFirst = $("#ocrReplace").checked;

    if (clearFirst && !skipConfirm) {
      askConfirm("会用识别结果覆盖现在的全部课程，确定吗？", function () {
        importOcrCourses(true);
      });
      return;
    }

    var added = 0;
    var skipped = 0;
    var createdBuildings = [];

    if (clearFirst) data.courses = [];

    rows.forEach(function (row) {
      var name = row.querySelector(".ocr-name").value.trim();
      var start = row.querySelector(".ocr-start").value;
      var end = row.querySelector(".ocr-end").value;

      if (!name || !start || !end) { skipped++; return; }

      var buildingId = row.querySelector(".ocr-building").value;

      if (buildingId === "__new__") {
        var newName = row.getAttribute("data-building-name") || "新楼栋";
        var created = { id: Store.uid("b"), name: newName, alias: [], lat: null, lng: null };
        data.campus.buildings.push(created);
        buildingId = created.id;
        createdBuildings.push(newName);
      }

      data.courses.push({
        id: Store.uid("c"),
        name: name,
        teacher: "",
        buildingId: buildingId || "",
        room: row.querySelector(".ocr-room").value.trim(),
        weekdays: [Number(row.querySelector(".ocr-day").value)],
        start: start,
        end: end,
        weeks: [weekFrom, weekTo]
      });
      added++;
    });

    saveAndRender();
    clearOcr(true);
    $("#ocrStatus").textContent = "已导入 " + added + " 条";

    var detail = [];
    if (skipped) detail.push("跳过 " + skipped + " 条（信息不全）");
    if (createdBuildings.length) detail.push("新建了 " + createdBuildings.length + " 栋楼");
    toast("已导入 " + added + " 条课程", detail.join("；"), "ok");

    if (createdBuildings.length) {
      toast("这些楼栋还没有坐标",
        createdBuildings.join("、") + "。去「设置 → 校区楼栋」补一下，路线才能算。", "warn");
    }

    /* 导入完直接去 OSM 找这些楼，省得手工一栋栋补 */
    if (createdBuildings.length) {
      window.setTimeout(function () { runAutoFill(true); }, 900);
    }
  }

  function openBuildingForm(building) {
    $("#buildingForm").hidden = false;
    $("#bfId").value = building ? building.id : "";
    $("#bfName").value = building ? building.name : "";
    $("#bfAlias").value = (building && building.alias) ? building.alias.join(",") : "";
    $("#bfLat").value = building ? building.lat : "";
    $("#bfLng").value = building ? building.lng : "";
    $("#buildingForm").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submitBuilding(ev) {
    ev.preventDefault();

    var id = $("#bfId").value;
    var alias = $("#bfAlias").value.split(/[,，、]/)
      .map(function (t) { return t.trim(); })
      .filter(function (t) { return t; });

    var payload = {
      name: $("#bfName").value.trim(),
      alias: alias,
      lat: Number($("#bfLat").value),
      lng: Number($("#bfLng").value)
    };

    if (!payload.name || isNaN(payload.lat) || isNaN(payload.lng)) {
      toast("信息不完整", "楼栋名称和经纬度都要填", "warn");
      return;
    }

    var replaced = false;
    if (id) {
      data.campus.buildings.forEach(function (b) {
        if (b.id === id) {
          Object.keys(payload).forEach(function (k) { b[k] = payload[k]; });
          replaced = true;
        }
      });
    }
    if (!replaced) {
      payload.id = id || Store.uid("b");
      data.campus.buildings.push(payload);
    }

    $("#buildingForm").hidden = true;
    saveAndRender();
    toast(id ? "已更新楼栋" : "已添加楼栋", payload.name, "ok");
  }

  /* ================= 事件绑定 ================= */

  function bindEvents() {
    $$(".tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.view = btn.dataset.tab;
        $$(".tab").forEach(function (b) { b.classList.toggle("is-active", b === btn); });
        $$(".view").forEach(function (v) { v.classList.toggle("is-active", v.dataset.view === state.view); });
        render();
      });
    });

    /* --- 地图底图切换 --- */
    $$(".map-mode").forEach(function (btn) {
      btn.addEventListener("click", function () {
        data.settings.mapMode = btn.dataset.mapmode;
        saveAndRender();
      });
    });

    /* --- 行程卡片里的「复制坐标」 --- */
    $("#routeList").addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-copy]");
      if (!btn) return;
      ev.preventDefault();
      copyText(btn.getAttribute("data-copy"), btn.textContent);
    });

    /* --- 今日 --- */
    $("#btnSpeakNext").addEventListener("click", function () {
      say(P.nextText(data, state.now, effectivePosition()), "播报下一节");
    });

    $("#btnBrief").addEventListener("click", function () {
      say(P.briefingText(data, state.now, effectivePosition()), "今日课表");
    });

    $("#btnStartNow").addEventListener("click", function () {
      var info = nextInfo();
      if (!info.leg || !info.leg.building) {
        toast("暂时没有要去的教室", "");
        return;
      }
      if (info.leg.metrics) say(P.leaveText(info.leg, state.now), "出发提醒");
      var links = Geo.navLinks(info.leg.building.name, info.leg.building.lat, info.leg.building.lng);
      /* 默认用 Google 地图（links 里标了 primary 的那条） */
      var pick = links.filter(function (l) { return l.primary && l.url; })[0] ||
        links.filter(function (l) { return l.url; })[0];
      if (!pick) {
        toast("这个地点没有坐标", "先去「设置 → 校区楼栋」补一下", "warn");
        return;
      }
      window.open(pick.url, "_blank", "noopener");
    });

    /* --- 定位 --- */
    $("#btnLocate").addEventListener("click", startLocate);
    $("#btnStopLocate").addEventListener("click", stopLocate);

    $("#btnSimHere").addEventListener("click", function () {
      var pos = effectivePosition();
      if (!pos) {
        toast("现在还没有位置", "先点「开始实时定位」，或手动填写楼栋坐标", "warn");
        return;
      }
      data.settings.simulate = { lat: pos.lat, lng: pos.lng };
      saveAndRender();
      fillElevation(data.settings.simulate, saveAndRender);
      toast("已设为模拟位置", pos.lat.toFixed(5) + ", " + pos.lng.toFixed(5), "ok");
    });

    $("#btnClearSim").addEventListener("click", function () {
      data.settings.simulate = null;
      saveAndRender();
      toast("已清除模拟位置", "");
    });

    /* --- 语音 --- */
    $("#vEnabled").addEventListener("change", function () {
      data.settings.voiceEnabled = this.checked;
      save();
    });

    $("#vVoiceSelect").addEventListener("change", function () {
      data.settings.voiceURI = this.value;
      save();
    });

    $("#vRate").addEventListener("input", function () {
      data.settings.voiceRate = Number(this.value);
      $("#vRateVal").textContent = Number(this.value).toFixed(2);
      save();
    });

    $("#vVolume").addEventListener("input", function () {
      data.settings.voiceVolume = Number(this.value);
      $("#vVolumeVal").textContent = Number(this.value).toFixed(2);
      save();
    });

    $("#btnTestVoice").addEventListener("click", function () {
      say("这是 Olympic Protocol 的语音测试。今天有课，记得按时出发。", "试听");
    });

    $("#btnStopVoice").addEventListener("click", function () {
      OP.Speech.stop();
    });

    /* --- 提醒参数 --- */
    [["#sLead", "leadMinutes"], ["#sBuffer", "bufferMinutes"],
     ["#sSpeed", "walkingSpeed"], ["#sDetour", "detourFactor"],
     ["#sBusSpeed", "busSpeed"]].forEach(function (pair) {
      $(pair[0]).addEventListener("change", function () {
        data.settings[pair[1]] = Number(this.value);
        saveAndRender();
      });
    });

    $("#sTermStart").addEventListener("change", function () {
      data.settings.termStart = this.value;
      saveAndRender();
    });

    $("#sClimb").addEventListener("change", function () {
      data.settings.climbFactor = Number(this.value);
      saveAndRender();
    });

    $("#btnTestAlert").addEventListener("click", function () {
      var info = nextInfo();
      if (!info.leg) {
        say("现在没有要前往的教室。", "测试");
        return;
      }
      say(P.leaveText(info.leg, state.now), "出发提醒");
    });

    /* 提醒与步行参数一键回到默认值。
       只重置这一张卡片里的项，不动语音、地图、楼栋和课表 */
    $("#btnResetWalk").addEventListener("click", function () {
      askConfirm("提醒与步行参数会变回默认值，确定吗？", function () {
        var base = OP.Store.defaults().settings;
        ["leadMinutes", "bufferMinutes", "walkingSpeed", "busSpeed",
          "detourFactor", "climbFactor", "termStart"].forEach(function (key) {
          data.settings[key] = base[key];
        });
        saveAndRender();
        toast("已恢复默认配置", "", "ok");
      });
    });

    /* --- 校区 --- */
    $("#campusName").addEventListener("change", function () {
      data.campus.name = this.value.trim() || data.campus.name;
      save();
    });

    /* 楼栋搜索：纯本地筛选，边打边出，不联网 */
    $("#buildingSearch").addEventListener("input", function () {
      renderBuildingList((data.campus && data.campus.buildings) || []);
    });

    $("#buildingMissingOnly").addEventListener("change", function () {
      renderBuildingList((data.campus && data.campus.buildings) || []);
    });

    $("#btnAddBuilding").addEventListener("click", function () { openBuildingForm(null); });

    /* --- 获取楼栋海拔 --- */
    $("#btnAutoFillBuildings").addEventListener("click", function () { runAutoFill(false); });

    $("#btnFetchElevation").addEventListener("click", function () {
      var button = this;
      var list = (data.campus && data.campus.buildings) || [];
      var todo = list.filter(function (b) {
        return typeof b.lat === "number" && typeof b.lng === "number" &&
          typeof b.elevation !== "number";
      });

      if (!todo.length) {
        toast("海拔都齐了", list.length + " 栋楼都已有海拔", "ok");
        return;
      }

      button.disabled = true;
      button.textContent = "查询中…";

      OP.Elevation.lookup(todo.map(function (b) { return { lat: b.lat, lng: b.lng }; }),
        function (done, total) {
          button.textContent = "查询中 " + done + "/" + total;
        }
      ).then(function (values) {
        var filled = 0;
        todo.forEach(function (b, i) {
          if (typeof values[i] === "number") {
            b.elevation = values[i];
            filled++;
          }
        });
        saveAndRender();
        toast("海拔已更新", filled + " 栋（待查 " + todo.length + " 栋）", "ok");
      }).catch(function (err) {
        toast("查询海拔失败", err.message, "err");
      }).then(function () {
        button.disabled = false;
        button.textContent = "获取海拔";
      });
    });

    /* --- 确认弹窗 --- */
    $("#confirmOk").addEventListener("click", function () {
      var action = pendingConfirm;
      closeConfirm();
      if (action) action();
    });

    $("#confirmCancel").addEventListener("click", closeConfirm);

    $("#confirmBox").addEventListener("click", function (ev) {
      /* 点弹窗外的遮罩也算取消 */
      if (ev.target === this) closeConfirm();
    });

    $("#btnClearBuildings").addEventListener("click", function () {
      var list = (data.campus && data.campus.buildings) || [];
      if (!list.length) {
        toast("楼栋列表本来就是空的", "");
        return;
      }

      /* 清空会连坐标一起删掉，先算清楚有多少课程会受影响 */
      var affected = (data.courses || []).filter(function (c) {
        return list.some(function (b) { return b.id === c.buildingId; });
      }).length;

      var message = "会删掉全部 " + list.length + " 栋楼，包括已经录好的坐标。\n\n" +
        "课表不会被动，但之后就重新对应地点了。";
      if (affected) {
        message += "\n\n注意：有 " + affected + " 条课程安排在这些楼里，删掉后会显示成「未知地点」。";
      }
      message += "\n\n确定清空吗？";

      askConfirm(message, function () {
        data.campus.buildings = [];
        $("#buildingForm").hidden = true;
        saveAndRender();
        toast("已清空全部楼栋", "可以重新搜一次导入，这次会带上英文名", "ok");
      });
    });

    /* --- 从地图读取楼栋 --- */
    $("#plRadius").addEventListener("change", function () {
      data.settings.placesRadius = Number(this.value) || 800;
      save();
    });

    /* 名称过滤也是纯本地筛选，边打边筛 */
    var keywordTimer = null;
    $("#plKeyword").addEventListener("input", function () {
      window.clearTimeout(keywordTimer);
      keywordTimer = window.setTimeout(reshapePlaces, 250);
    });

    $("#plMerge").addEventListener("change", function () {
      data.settings.placesMerge = this.checked;
      save();
      reshapePlaces();
    });

    $("#plEnglish").addEventListener("change", function () {
      data.settings.placesEnglish = this.checked;
      save();
      reshapePlaces();
    });

    $("#btnSearchPlaces").addEventListener("click", searchPlaces);
    $("#btnSearchByName").addEventListener("click", searchPlacesByName);

    /* 名字框里直接回车也能搜 */
    $("#plNameQuery").addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        searchPlacesByName();
      }
    });

    $("#placesList").addEventListener("click", function (ev) {
      var btn = ev.target.closest(".place-merge");
      if (!btn) return;
      /* 这个按钮在 label 里面，不拦一下会顺带把勾选框切掉 */
      ev.preventDefault();
      ev.stopPropagation();
      mergePlaceAliases(Number(btn.getAttribute("data-place-idx")));
    });

    $("#btnAddSelectedPlaces").addEventListener("click", addSelectedPlaces);
    $("#btnClearPlaces").addEventListener("click", function () {
      state.places = [];
      state.placesStatus = "未搜索";
      renderPlaces();
    });

    $("#bfCancel").addEventListener("click", function () { $("#buildingForm").hidden = true; });
    $("#buildingForm").addEventListener("submit", submitBuilding);

    $("#bfUseHere").addEventListener("click", function () {
      var pos = effectivePosition();
      if (!pos) {
        toast("现在还没有位置", "先点「开始实时定位」", "warn");
        return;
      }
      $("#bfLat").value = pos.lat.toFixed(6);
      $("#bfLng").value = pos.lng.toFixed(6);
    });

    $("#buildingList").addEventListener("click", function (ev) {
      var toggle = ev.target.closest("[data-toggle-buildings]");
      if (toggle) {
        state.buildingListExpanded = !state.buildingListExpanded;
        renderBuildingList((data.campus && data.campus.buildings) || []);
        return;
      }
      var edit = ev.target.closest("[data-edit-building]");
      if (edit) {
        var bid = edit.getAttribute("data-edit-building");
        var found = null;
        data.campus.buildings.forEach(function (x) { if (x.id === bid) found = x; });
        if (found) openBuildingForm(found);
        return;
      }
      var del = ev.target.closest("[data-del-building]");
      if (del) {
        var did = del.getAttribute("data-del-building");
        var used = data.courses.some(function (c) { return c.buildingId === did; });
        var msg = used
          ? "还有课程安排在这栋楼，删除后这些课程会失去地点。确定删除吗？"
          : "确定删除这栋楼吗？";
        askConfirm(msg, function () {
          data.campus.buildings = data.campus.buildings.filter(function (x) { return x.id !== did; });
          saveAndRender();
        });
      }
    });

    /* --- 课表 --- */
    $("#btnAddCourse").addEventListener("click", function () { openCourseForm(null); });
    $("#cfCancel").addEventListener("click", closeCourseForm);
    $("#courseForm").addEventListener("submit", submitCourse);

    /* --- 从截图导入 --- */
    $("#ocrDrop").addEventListener("click", function () { $("#ocrFile").click(); });

    $("#ocrFile").addEventListener("change", function () {
      if (this.files && this.files[0]) handleOcrFile(this.files[0]);
      this.value = "";
    });

    ["dragenter", "dragover"].forEach(function (type) {
      $("#ocrDrop").addEventListener(type, function (ev) {
        ev.preventDefault();
        this.classList.add("is-over");
      });
    });

    ["dragleave", "drop"].forEach(function (type) {
      $("#ocrDrop").addEventListener(type, function (ev) {
        ev.preventDefault();
        this.classList.remove("is-over");
      });
    });

    $("#ocrDrop").addEventListener("drop", function (ev) {
      var file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (file) handleOcrFile(file);
    });

    /* 在课表页直接按 Ctrl+V 粘贴截图 */
    document.addEventListener("paste", function (ev) {
      if (state.view !== "course") return;
      var items = ev.clipboardData && ev.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf("image") === 0) {
          var file = items[i].getAsFile();
          if (file) {
            ev.preventDefault();
            handleOcrFile(file);
          }
          return;
        }
      }
    });

    $("#ocrResult").addEventListener("click", function (ev) {
      var btn = ev.target.closest(".ocr-remove");
      if (btn) {
        var row = btn.closest(".ocr-row");
        if (row) row.remove();
      }
    });

    $("#btnOcrImport").addEventListener("click", importOcrCourses);
    $("#btnOcrCancel").addEventListener("click", function () { clearOcr(false); });

    $("#courseList").addEventListener("click", function (ev) {
      var edit = ev.target.closest("[data-edit-course]");
      if (edit) {
        var c = P.courseById(data, edit.getAttribute("data-edit-course"));
        if (c) openCourseForm(c);
        return;
      }
      var del = ev.target.closest("[data-del-course]");
      if (del) {
        var id = del.getAttribute("data-del-course");
        var course = P.courseById(data, id);
        if (!course) return;
        askConfirm("确定删除「" + course.name + "」吗？", function () {
          data.courses = data.courses.filter(function (x) { return x.id !== id; });
          saveAndRender();
        });
      }
    });

    $("#btnExport").addEventListener("click", function () {
      Store.exportFile(data);
      toast("已导出", "文件里包含课表和楼栋坐标", "ok");
    });

    $("#btnImport").addEventListener("click", function () { $("#importFile").click(); });
    $("#importFile").addEventListener("change", function () {
      var file = this.files && this.files[0];
      if (!file) return;
      Store.readFile(file).then(function (next) {
        var outcome = Store.applyImport(data, next);
        saveAndRender();
        var detail = [];
        if (outcome.addedBuildings) detail.push("新增 " + outcome.addedBuildings + " 栋楼");
        if (outcome.replacedCourses) detail.push("课表已替换");
        toast("导入成功", detail.join("；") || "内容已合并", "ok");
        /* 新导入的课表若带来没坐标的楼栋，顺手去 OSM 补齐 */
        window.setTimeout(function () { runAutoFill(true); }, 900);
      }).catch(function () {
        toast("导入失败", "文件不是有效的 JSON", "err");
      });
      this.value = "";
    });

    $("#btnResetData").addEventListener("click", function () {
      askConfirm("课表和楼栋都会变回默认的（楼栋 = 内置校区数据，课表 = 空），确定吗？", function () {
        data = Store.reset();
        saveAndRender();
        toast("已恢复默认数据", "楼栋回到内置校区数据，课表清空", "ok");
      });
    });

    /* --- 切回前台立刻刷新 --- */
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        state.now = new Date();
        state.lastCheck = 0;
        render();
      }
    });
  }

  /* ================= 语音音色 ================= */

  function fillVoiceOptions() {
    var sel = $("#vVoiceSelect");
    var list = OP.Speech.voices();
    if (!list.length) {
      sel.innerHTML = '<option value="">默认音色</option>';
      return;
    }
    sel.innerHTML = list.map(function (v) {
      return '<option value="' + esc(v.voiceURI) + '"' +
        (v.voiceURI === data.settings.voiceURI ? " selected" : "") + ">" +
        esc(v.name + " (" + v.lang + ")") + "</option>";
    }).join("");
  }

  /* ================= 主循环 ================= */

  function tick() {
    state.now = new Date();
    renderTop();

    /* 倒计时只刷新文字，整页重绘会打断输入框 */
    var info = nextInfo();
    if (state.view === "today" && info.found) {
      var c = info.found.course;
      var ongoing = info.found.status === "ongoing";
      $("#nextCountdown").textContent = countdownText(
        ongoing ? P.at(state.now, c.end) : P.at(state.now, c.start), state.now);
    }

    if (state.now.getTime() - state.lastCheck > 30000) {
      state.lastCheck = state.now.getTime();
      checkAlerts();
      if (state.view === "today" || state.view === "route") render();
    }
  }

  function boot() {
    OP.Speech.init();
    OP.Speech.onChange(fillVoiceOptions);

    bindEvents();
    fillVoiceOptions();
    measureBottomSpace();
    render();

    window.setInterval(tick, 1000);

    /* 默认楼栋更新了，告诉用户补了什么 */
    if (pendingBuildingSync.added.length || pendingBuildingSync.aliased.length) {
      var synced = [];
      if (pendingBuildingSync.added.length) {
        var names = pendingBuildingSync.added.map(function (b) { return b.name; });
        synced.push("新增 " + names.length + " 栋：" + names.slice(0, 4).join("、") +
          (names.length > 4 ? " 等" : ""));
      }
      if (pendingBuildingSync.aliased.length) {
        synced.push("补了 " + pendingBuildingSync.aliased.length + " 个别名");
      }
      toast("楼栋数据已更新", synced.join("；") + "（只补不加改）", "ok");
    }

    window.addEventListener("resize", function () {
      measureBottomSpace();
      scheduleClearanceCheck();
    });
    window.addEventListener("orientationchange", function () {
      window.setTimeout(function () {
        measureBottomSpace();
        scheduleClearanceCheck();
      }, 160);
    });

    /* 支持用地址栏直达某个页签，例如 index.html#route，
       截图和排查时不用手动点。 */
    var wanted = (window.location.hash || "").replace(/^#/, "");
    if (wanted) {
      var tab = document.querySelector('.tab[data-tab="' + wanted + '"]');
      if (tab) tab.click();
    }

    /* 拿到权限就直接开始定位，不用用户再点一次 */
    if (Geo.supported()) {
      Geo.once().then(function (pos) {
        state.position = pos;
        render();
        fillElevation(state.position, render);
      }).catch(function (err) {
        state.geoError = Geo.readableError(err);
        render();
      });
    }

    window.setTimeout(function () {
      if (state.hintShown) return;
      state.hintShown = true;
      if (!OP.Speech.supported()) {
        toast("这个浏览器不支持语音播报", "换 Chrome、Edge 或 Safari 试试", "warn");
      }
    }, 1600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
