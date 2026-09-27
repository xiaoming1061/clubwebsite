/* 界面控制：把课表、定位、语音、路线串起来 */

(function () {
  "use strict";

  var OP = window.OP;
  var P = OP.Planner;
  var Geo = OP.Geo;
  var Store = OP.Store;

  var data = Store.load();
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
    placesProviderShown: null,
    proxyReady: false
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

  /* ================= 位置 ================= */

  function effectivePosition() {
    if (data.settings.simulate && typeof data.settings.simulate.lat === "number") {
      return { lat: data.settings.simulate.lat, lng: data.settings.simulate.lng, simulated: true };
    }
    return state.position;
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
      } else if (leg && leg.metrics) {
        var buffer = Number(data.settings.bufferMinutes) || 0;
        $("#nextDistance").textContent = Geo.formatDistance(leg.metrics.distance);
        $("#nextWalk").textContent = Geo.formatDuration(leg.metrics.minutes);
        $("#nextLeave").textContent = P.fmtHM(P.hm(c.start) - leg.metrics.minutes - buffer);
        if (leg.slackMin !== null && leg.slackMin <= 10) hero.classList.add("is-imminent");
      } else {
        $("#nextDistance").textContent = "打开定位";
        $("#nextWalk").textContent = "--";
        $("#nextLeave").textContent = "打开定位";
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

  function renderRoute() {
    var info = nextInfo();
    var buildings = (data.campus && data.campus.buildings) || [];
    var buffer = Number(data.settings.bufferMinutes) || 0;
    var route = info.route;

    OP.MapView.render($("#mapSvg"), {
      buildings: buildings,
      position: info.position,
      activeId: route.length && route[0].building ? route[0].building.id : null,
      legs: route
    });

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
            "<span>步行 <b>" + esc(Geo.formatDuration(leg.metrics.minutes)) + "</b></span>" +
            "<span>建议出发 <b>" + esc(P.fmtHM(P.hm(c.start) - leg.metrics.minutes - buffer)) + "</b></span>" +
          "</div>"
        : '<div class="leg-meta">打开定位后可以算出步行时间和建议出发时间</div>';

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
        metrics + warn +
        '<div class="leg-actions">' +
          links.map(function (l) {
            return '<a class="nav-link" href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
              esc(l.label) + "</a>";
          }).join("") +
        "</div>" +
      "</div>";
    }).join("");

    if (!info.position) {
      html = '<p class="hint">还没有位置信息，下面按「从上一节课的楼栋出发」估算。打开定位会更准。</p>' + html;
    }
    box.innerHTML = html;
  }

  /* ================= 渲染：课表 ================= */

  function renderCourse() {
    var box = $("#courseList");
    var courses = (data.courses || []).slice();

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

    $("#vEnabled").checked = s.voiceEnabled !== false;
    $("#vRate").value = s.voiceRate;
    $("#vRateVal").textContent = Number(s.voiceRate).toFixed(2);
    $("#vVolume").value = s.voiceVolume;
    $("#vVolumeVal").textContent = Number(s.voiceVolume).toFixed(2);

    $("#sLead").value = s.leadMinutes;
    $("#sBuffer").value = s.bufferMinutes;
    $("#sSpeed").value = s.walkingSpeed;
    $("#sDetour").value = s.detourFactor;
    $("#sTermStart").value = s.termStart || "";
    $("#campusName").value = (data.campus && data.campus.name) || "";

    $("#plProvider").value = data.settings.placesProvider || "osm";
    $("#plRadius").value = data.settings.placesRadius || 800;
    $("#plMerge").checked = data.settings.placesMerge !== false;
    syncPlacesProvider(false);
    renderPlaces();

    var pos = effectivePosition();
    var nearest = P.nearestBuilding(pos, (data.campus && data.campus.buildings) || []);

    $("#locState").textContent = data.settings.simulate
      ? "模拟位置"
      : (state.locating ? "定位中" : (state.position ? "已定位" : "未开始"));
    $("#locCoords").textContent = pos ? pos.lat.toFixed(5) + ", " + pos.lng.toFixed(5) : "--";
    $("#locAccuracy").textContent = (state.position && !data.settings.simulate)
      ? "±" + Math.round(state.position.accuracy) + " 米" : "--";
    $("#locNearest").textContent = nearest ? nearest.building.name : "--";

    var hint = $("#locHint");
    if (!Geo.supported()) {
      hint.textContent = "这个浏览器不支持定位。";
    } else if (state.geoError) {
      hint.textContent = state.geoError;
    } else if (data.settings.simulate) {
      hint.textContent = "当前用的是模拟位置，所有距离都按它计算。";
    } else if (state.position) {
      hint.textContent = "定位正常，正在实时更新。";
    } else {
      hint.textContent = "手机浏览器或 App 里需要先允许「位置信息」权限。电脑上没有 GPS 时，可以手填坐标或用模拟位置。";
    }

    var list = (data.campus && data.campus.buildings) || [];
    $("#buildingList").innerHTML = list.length ? list.map(function (b) {
      return '<div class="building-item">' +
        '<div><div class="bi-name">' + esc(b.name) + "</div>" +
        '<div class="bi-meta">' + Number(b.lat).toFixed(5) + ", " + Number(b.lng).toFixed(5) +
        ((b.alias && b.alias.length) ? " · " + esc(b.alias.join("、")) : "") + "</div></div>" +
        '<div class="ci-actions">' +
          '<button class="btn btn-small" data-edit-building="' + esc(b.id) + '">编辑</button>' +
          '<button class="btn btn-small btn-danger" data-del-building="' + esc(b.id) + '">删除</button>' +
        "</div></div>";
    }).join("") : '<p class="empty">还没有楼栋，先添加一个</p>';
  }

  /* ================= 总渲染 ================= */

  function render() {
    renderTop();
    if (state.view === "today") renderToday();
    else if (state.view === "route") renderRoute();
    else if (state.view === "course") renderCourse();
    else if (state.view === "settings") renderSettings();
  }

  function save() { Store.save(data); }

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
      state.position = pos;
      state.locating = true;
      state.geoError = "";
      render();
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

  function placesProviderDef(id) {
    var list = OP.Places.PROVIDERS;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return list[0];
  }

  function sourceLabel(id) {
    if (id === "osm") return "OpenStreetMap";
    if (id === "amap") return "高德";
    if (id === "google") return "Google";
    return id;
  }

  function initPlacesUi() {
    $("#plProvider").innerHTML = OP.Places.PROVIDERS.map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(p.label) + "</option>";
    }).join("");
  }

  /* 切换来源时，把 Key 输入框和说明文字跟着换掉 */
  function syncPlacesProvider(force) {
    var def = placesProviderDef($("#plProvider").value);
    $("#plKeyField").hidden = !def.needKey;

    /* 只有在切换来源时才回填 Key，否则会把用户正在输入的内容冲掉 */
    if (force || state.placesProviderShown !== def.id) {
      $("#plKey").value = (data.settings.placesKeys || {})[def.id] || "";
      state.placesProviderShown = def.id;
    }

    var note = def.note;
    if (def.needKey && !state.proxyReady) {
      note += " 当前没有检测到本地代理，请用 node tools/serve.js 启动页面后再试。";
    }
    $("#plNote").textContent = note;
  }

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
        sourceLabel(item.source),
        item.kind || "",
        item.address || ""
      ].filter(function (t) { return t; }).join(" · ");

      return '<label class="place-item">' +
        '<input type="checkbox" data-place-idx="' + i + '"' + (dup ? "" : " checked") + ">" +
        '<div class="pi-main">' +
          '<div class="pi-name">' + esc(item.name) + badges + "</div>" +
          '<div class="pi-meta">' + esc(meta) + "</div>" +
          (item.merged > 1 && item.mergedNames && item.mergedNames.length
            ? '<div class="pi-meta">同栋楼内还有：' + esc(item.mergedNames.join("、")) + "</div>"
            : "") +
        "</div></label>";
    }).join("");
  }

  function searchPlaces() {
    var provider = $("#plProvider").value;
    var pos = effectivePosition();

    if (!pos) {
      toast("还没有位置", "先在「定位」里开启定位，或用模拟位置", "warn");
      return;
    }

    var radius = Number($("#plRadius").value) || 800;
    var key = $("#plKey").value.trim();

    data.settings.placesProvider = provider;
    data.settings.placesRadius = radius;
    data.settings.placesKeys = data.settings.placesKeys || {};
    data.settings.placesKeys[provider] = key;
    save();

    state.placesStatus = "搜索中…";
    state.places = [];
    renderPlaces();
    $("#btnSearchPlaces").disabled = true;

    OP.Places.search(provider, {
      lat: pos.lat,
      lng: pos.lng,
      radius: radius,
      key: key,
      keyword: $("#plKeyword").value,
      merge: data.settings.placesMerge !== false
    }).then(function (list) {
      state.places = list;
      state.placesStatus = list.length ? "找到 " + list.length + " 个" : "没找到";
      renderPlaces();
      if (!list.length) {
        toast("没有找到建筑", "换个来源、把半径调大，或清空名称过滤再试", "warn");
      }
    }).catch(function (err) {
      state.places = [];
      state.placesStatus = "搜索失败";
      renderPlaces();
      toast("搜索失败", err.message, "err");
    }).then(function () {
      $("#btnSearchPlaces").disabled = false;
    });
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
        alias: [],
        lat: Number(Number(item.lat).toFixed(6)),
        lng: Number(Number(item.lng).toFixed(6))
      });
      added++;
    });

    saveAndRender();
    renderPlaces();
    toast("已加入 " + added + " 栋楼", "可以在下面的「校区楼栋」里改名和加别名", "ok");
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
      window.open(links[0].url, "_blank", "noopener");
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
      say("这是 Olympic Protocal 的语音测试。今天有课，记得按时出发。", "试听");
    });

    $("#btnStopVoice").addEventListener("click", function () {
      OP.Speech.stop();
    });

    /* --- 提醒参数 --- */
    [["#sLead", "leadMinutes"], ["#sBuffer", "bufferMinutes"],
     ["#sSpeed", "walkingSpeed"], ["#sDetour", "detourFactor"]].forEach(function (pair) {
      $(pair[0]).addEventListener("change", function () {
        data.settings[pair[1]] = Number(this.value);
        saveAndRender();
      });
    });

    $("#sTermStart").addEventListener("change", function () {
      data.settings.termStart = this.value;
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

    /* --- 校区 --- */
    $("#campusName").addEventListener("change", function () {
      data.campus.name = this.value.trim() || data.campus.name;
      save();
    });

    $("#btnAddBuilding").addEventListener("click", function () { openBuildingForm(null); });

    /* --- 从地图读取楼栋 --- */
    $("#plProvider").addEventListener("change", function () {
      data.settings.placesProvider = this.value;
      save();
      syncPlacesProvider(true);
    });

    $("#plRadius").addEventListener("change", function () {
      data.settings.placesRadius = Number(this.value) || 800;
      save();
    });

    $("#plMerge").addEventListener("change", function () {
      data.settings.placesMerge = this.checked;
      save();
      if (state.places.length) searchPlaces();
    });

    $("#btnSearchPlaces").addEventListener("click", searchPlaces);
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
        if (!window.confirm(msg)) return;
        data.campus.buildings = data.campus.buildings.filter(function (x) { return x.id !== did; });
        saveAndRender();
      }
    });

    /* --- 课表 --- */
    $("#btnAddCourse").addEventListener("click", function () { openCourseForm(null); });
    $("#cfCancel").addEventListener("click", closeCourseForm);
    $("#courseForm").addEventListener("submit", submitCourse);

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
        if (!window.confirm("确定删除「" + course.name + "」吗？")) return;
        data.courses = data.courses.filter(function (x) { return x.id !== id; });
        saveAndRender();
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
        data = next;
        saveAndRender();
        toast("导入成功", "", "ok");
      }).catch(function () {
        toast("导入失败", "文件不是有效的 JSON", "err");
      });
      this.value = "";
    });

    $("#btnResetData").addEventListener("click", function () {
      if (!window.confirm("会用示例数据覆盖现在的课表和楼栋，确定吗？")) return;
      data = Store.reset();
      saveAndRender();
      toast("已恢复示例数据", "", "ok");
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

    initPlacesUi();
    bindEvents();
    fillVoiceOptions();
    render();

    window.setInterval(tick, 1000);

    /* 检测有没有本地代理（决定高德 / Google 能不能用） */
    OP.Places.detectProxy().then(function (ok) {
      state.proxyReady = ok;
      if (state.view === "settings") syncPlacesProvider(false);
    });

    /* 拿到权限就直接开始定位，不用用户再点一次 */
    if (Geo.supported()) {
      Geo.once().then(function (pos) {
        state.position = pos;
        render();
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
