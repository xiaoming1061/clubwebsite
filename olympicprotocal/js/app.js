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
    placesRaw: null,
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

  /* 底部导航是固定的，实测它的高度写进 CSS 变量，
     这样页面底部永远留得够，不会出现"最后一个按钮被挡住又滑不下去" */
  function syncTabbarHeight() {
    var bar = document.querySelector(".tabbar");
    if (!bar) return;
    var height = Math.round(bar.getBoundingClientRect().height);
    if (height > 0) {
      document.documentElement.style.setProperty("--tabbar-h", height + "px");
    }
  }

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

    $("#plRadius").value = data.settings.placesRadius || 800;
    $("#plMerge").checked = data.settings.placesMerge !== false;
    $("#plEnglish").checked = data.settings.placesEnglish !== false;
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
    /* 一栋都没有的时候没必要显示清空按钮 */
    $("#btnClearBuildings").hidden = !list.length;

    $("#buildingList").innerHTML = list.length ? list.map(function (b) {
      var hasCoords = typeof b.lat === "number" && typeof b.lng === "number";
      var coordText = hasCoords
        ? Number(b.lat).toFixed(5) + ", " + Number(b.lng).toFixed(5)
        : '<span class="bi-missing">还没坐标</span>';

      return '<div class="building-item">' +
        '<div><div class="bi-name">' + esc(b.name) + "</div>" +
        '<div class="bi-meta">' + coordText +
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

    var html = '<p class="hint">这是识别出来的草稿，导入前核对一遍。下面的内容都可以直接改。</p>';
    html += '<div class="ocr-list">';

    list.forEach(function (c, i) {
      var match = OP.Ocr.matchBuilding(c.buildingName, buildings);
      var options = '<option value="">（未指定）</option>' +
        buildings.map(function (b) {
          return '<option value="' + esc(b.id) + '"' + (match && match.id === b.id ? " selected" : "") + ">" +
            esc(b.name) + "</option>";
        }).join("");

      if (c.buildingName && !match) {
        options += '<option value="__new__" selected>＋ 新建楼栋：' + esc(c.buildingName) + "</option>";
      }

      var notes = [];
      if (c.waiting) notes.push("原课表标记为候补（Waiting）");
      if (c.tba) notes.push("地点是待定（TBA），导入后需要自己补");
      if (c.needsTime) notes.push("时间没读准，请核对");
      if (c.buildingName && !match) {
        notes.push("「" + c.buildingName + "」不在楼栋列表里，导入时会新建，之后要补坐标");
      } else if (match && !match.exact) {
        notes.push("自动匹配到「" + match.name + "」（把握 " + Math.round(match.score * 100) +
          "%），请确认是不是这栋，不对就在下拉里换");
      }

      var bad = c.tba || c.needsTime || (c.buildingName && !match) || (match && !match.exact);

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
        data = next;
        saveAndRender();
        toast("导入成功", "", "ok");
      }).catch(function () {
        toast("导入失败", "文件不是有效的 JSON", "err");
      });
      this.value = "";
    });

    $("#btnResetData").addEventListener("click", function () {
      askConfirm("会用示例数据覆盖现在的课表和楼栋，确定吗？", function () {
        data = Store.reset();
        saveAndRender();
        toast("已恢复示例数据", "", "ok");
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
    syncTabbarHeight();
    render();

    window.setInterval(tick, 1000);

    window.addEventListener("resize", syncTabbarHeight);
    window.addEventListener("orientationchange", function () {
      window.setTimeout(syncTabbarHeight, 120);
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
