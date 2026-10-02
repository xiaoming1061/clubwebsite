/* 把课表画成一张图片
 *
 * 为什么不用 html2canvas 之类的库：这个项目是**零依赖**的（离线、加到主屏也要能跑），
 * 而且那种库还得把 DOM、字体、背景全都还原一遍，体积和不确定性都不划算。
 * 我们自己画：一张周课表就是"几天 × 几小时"的网格加几个方块，几何很确定。
 *
 * 分成两半：
 *   layout(courses, opts)  —— **纯计算**：排哪几天、时间轴起止、每节课在第几个车道。
 *                             不碰 canvas，所以能在 node 里单测（见 tools/selftest.js）。
 *   draw(ctx, model, opts) —— 只管把算好的坐标画出来。
 *   render(courses, opts)  —— 上面两步 + 建 canvas（浏览器里用这个）。
 */

window.OP = window.OP || {};

(function (OP) {
  "use strict";

  /* 导出图的配色。刻意**不用**页面上那套半透明玻璃色——图片没有背景视频，
     要的是一张干净、能直接发给别人的图。主色跟着页面主题走（app.js 会传进来）。 */
  var PALETTE = {
    bg: "#fff8fc",
    panel: "#ffffff",
    line: "#ffd3e4",
    accent: "#ff5fa2",
    accentSoft: "#ffe6f1",
    text: "#4a2b3a",
    textDim: "#8a6b78"
  };

  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif';

  /* 尺寸都按"逻辑像素"写，最后统一乘 scale 输出（默认 2 倍，够清楚又不至于太大） */
  var METRICS = {
    pad: 22,
    titleH: 58,
    headH: 32,
    labelW: 54,
    colW: 148,
    colW6: 124,          // 6 天以上时列窄一点，别让图太宽
    minGridH: 420,
    pxPerMin: 0.85,
    radius: 10,
    gap: 4,
    scale: 2
  };

  var PAD_BEFORE_MIN = 5;      // 最早那节课之前留一点
  var PAD_AFTER_MIN = 10;      // 最晚那节课之后留一点
  var MIN_SPAN_MIN = 6 * 60;   // 只有一节课时也别画成一条扁带

  /* ---------- 时间小工具 ---------- */

  function hmToMin(text) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(text || ""));
    if (!m) return NaN;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function minToHM(min) {
    var h = Math.floor(min / 60);
    var m = min % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function courseDays(course) {
    return (course && course.weekdays || []).filter(function (d) {
      return typeof d === "number" && d >= 1 && d <= 7;
    });
  }

  /* ---------- 排版（纯计算） ---------- */

  /**
   * 同一节课一周上几天就要画几个格子；同一天里**时间重叠**的课并排成几车道。
   *
   * 车道是"每个重叠簇单独算宽度"的：上午两节课撞车、下午只有一节，
   * 下午那节不该被上午挤成半宽（日历 App 都是这么做的）。
   */
  function assignLanes(items) {
    var laneEnds = [];      // 每个车道里最后一节课的结束时间
    var cluster = [];
    var clusterEnd = -1;

    function flush() {
      var width = 0;
      cluster.forEach(function (item) { width = Math.max(width, item.lane + 1); });
      cluster.forEach(function (item) { item.lanes = width; });
      cluster = [];
      clusterEnd = -1;
    }

    items.forEach(function (item) {
      if (cluster.length && item.start >= clusterEnd) flush();

      var lane = -1;
      for (var i = 0; i < laneEnds.length; i++) {
        if (laneEnds[i] <= item.start) { lane = i; break; }
      }
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(item.end);
      } else {
        laneEnds[lane] = item.end;
      }

      item.lane = lane;
      cluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.end);
    });
    flush();
  }

  /**
   * @param courses 课程数组（就是 localStorage 里那份）
   * @param opts    { days }（可选，强制要画哪几天）
   * @returns { empty, days, events, startMin, endMin, marks, count }
   *          events 里每条：{ course, day, startMin, endMin, lane, lanes }
   */
  function layout(courses, opts) {
    var options = opts || {};
    var list = (courses || []).filter(function (course) {
      return course && courseDays(course).length &&
        isFinite(hmToMin(course.start)) && isFinite(hmToMin(course.end)) &&
        hmToMin(course.end) > hmToMin(course.start);
    });

    if (!list.length) {
      return { empty: true, days: [], events: [], startMin: 0, endMin: 0, marks: [], count: 0 };
    }

    /* 周一到周五固定画；周六周日有课才加一列 */
    var has = {};
    list.forEach(function (course) {
      courseDays(course).forEach(function (day) { has[day] = true; });
    });
    var days = options.days || [1, 2, 3, 4, 5]
      .concat(has[6] ? [6] : [], has[7] ? [7] : []);

    var minStart = Infinity;
    var maxEnd = -Infinity;
    list.forEach(function (course) {
      minStart = Math.min(minStart, hmToMin(course.start));
      maxEnd = Math.max(maxEnd, hmToMin(course.end));
    });

    /* 上端取整到整点（时间刻度是整点的，起点对齐看着才顺），
       下端取整到半小时——按整点收的话最后一节课下课后会多出一小时空白 */
    var startMin = Math.floor((minStart - PAD_BEFORE_MIN) / 60) * 60;
    var endMin = Math.ceil((maxEnd + PAD_AFTER_MIN) / 30) * 30;
    if (endMin - startMin < MIN_SPAN_MIN) endMin = startMin + MIN_SPAN_MIN;

    var events = [];
    days.forEach(function (day) {
      var todays = list
        .filter(function (course) { return courseDays(course).indexOf(day) >= 0; })
        .map(function (course) {
          return { course: course, start: hmToMin(course.start), end: hmToMin(course.end) };
        })
        .sort(function (a, b) { return a.start - b.start || b.end - a.end; });

      assignLanes(todays);
      todays.forEach(function (item) {
        events.push({
          course: item.course,
          day: day,
          startMin: item.start,
          endMin: item.end,
          lane: item.lane,
          lanes: item.lanes
        });
      });
    });

    var marks = [];
    for (var m = startMin; m <= endMin; m += 60) marks.push({ min: m, label: minToHM(m) });

    return {
      empty: false, days: days, events: events, startMin: startMin, endMin: endMin,
      marks: marks, count: list.length
    };
  }

  /* ---------- 画 ---------- */

  function roundRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * 按宽度折行，最后一行放不下就用省略号收尾。
   *
   * **优先在空格处断**——英文课名要是按字符硬断，会断成 "SAT 1000-A Lectu / re" 这种。
   * 只有"一个词自己就比整行还宽"（超长英文、或者中文那种本来就不空格的）才按字符切。
   * 第一版就是无脑按字符切，画出来一眼就看出难看。
   */
  function wrapText(ctx, text, maxWidth, maxLines) {
    var words = String(text || "").split(/(\s+)/).filter(function (part) { return part !== ""; });
    var lines = [];
    var line = "";

    words.forEach(function (word) {
      var candidate = line + word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        return;
      }
      if (line) { lines.push(line); line = ""; }
      if (!/\S/.test(word)) return;                   // 纯空白，丢掉

      /* 一个词自己就放不下：按字符切（中文天然走这条） */
      var rest = word;
      while (ctx.measureText(rest).width > maxWidth && rest.length > 1) {
        var cut = rest.length;
        while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    });
    if (line) lines.push(line);

    var cleaned = lines.map(function (one) { return one.replace(/\s+$/, ""); })
      .filter(function (one) { return one !== ""; });
    if (cleaned.length <= maxLines) return cleaned;

    var kept = cleaned.slice(0, maxLines);
    var last = kept[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + "…").width > maxWidth) {
      last = last.slice(0, -1);
    }
    kept[maxLines - 1] = last.replace(/\s+$/, "") + "…";
    return kept;
  }

  /* 一节课那个方块里写什么：课名（最多两行）、时间、地点。
     格子太窄（跟别人并排时）就不写地点了——硬塞只会断成 "Academ / ic…" 那种。 */
  var PLACE_MIN_W = 88;

  function blockLines(event, place, blockWidth) {
    var course = event.course;
    var out = [{ text: course.name || "（没有课名）", weight: 600, size: 13, lines: 2 }];
    out.push({ text: course.start + "–" + course.end, weight: 400, size: 11, color: "textDim", lines: 1 });
    if (place && blockWidth >= PLACE_MIN_W) {
      out.push({ text: place, weight: 400, size: 11, color: "textDim", lines: 2 });
    }
    return out;
  }

  /**
   * @param ctx    canvas 的 2d context
   * @param model  layout() 的结果
   * @param opts   { title, subtitle, badge, placeOf(course), palette, metrics }
   * @returns { width, height }（逻辑尺寸；canvas 实际像素是它乘 scale）
   */
  function draw(ctx, model, opts) {
    var options = opts || {};
    var palette = Object.assign({}, PALETTE, options.palette || {});
    var m = Object.assign({}, METRICS, options.metrics || {});
    var placeOf = options.placeOf || function () { return ""; };

    var colW = model.days.length >= 6 ? m.colW6 : m.colW;
    var gridW = colW * model.days.length;
    var gridH = Math.max(m.minGridH, Math.round((model.endMin - model.startMin) * m.pxPerMin));
    var width = m.pad * 2 + m.labelW + gridW;
    var height = m.pad * 2 + m.titleH + m.headH + gridH;

    var gridTop = m.pad + m.titleH + m.headH;
    var gridLeft = m.pad + m.labelW;
    var pxPerMin = gridH / (model.endMin - model.startMin);

    /* 选壁纸比例时画布比课表大，内容居中，多出来的地方铺底色 */
    var surface = {
      width: Math.round(options.surfaceWidth || width),
      height: Math.round(options.surfaceHeight || height)
    };
    var offsetX = Math.max(0, Math.round((surface.width - width) / 2));
    var offsetY = Math.max(0, Math.round((surface.height - height) / 2));

    ctx.save();
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, surface.width, surface.height);
    ctx.translate(offsetX, offsetY);

    /* ---- 标题区 ---- */
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = palette.text;
    ctx.font = "700 20px " + FONT;
    ctx.textAlign = "left";
    ctx.fillText(options.title || "课表", m.pad, m.pad + 24);

    if (options.badge) {
      ctx.font = "600 13px " + FONT;
      var badgeW = ctx.measureText(options.badge).width + 20;
      ctx.fillStyle = palette.accentSoft;
      roundRect(ctx, width - m.pad - badgeW, m.pad + 3, badgeW, 26, 13);
      ctx.fill();
      ctx.fillStyle = palette.accent;
      ctx.textAlign = "center";
      ctx.fillText(options.badge, width - m.pad - badgeW / 2, m.pad + 21);
    }

    if (options.subtitle) {
      ctx.fillStyle = palette.textDim;
      ctx.font = "400 12px " + FONT;
      ctx.textAlign = "left";
      ctx.fillText(options.subtitle, m.pad, m.pad + 46);
    }

    /* ---- 表头：星期 ---- */
    ctx.fillStyle = palette.panel;
    ctx.fillRect(m.pad, gridTop - m.headH, m.labelW + gridW, m.headH);
    ctx.font = "600 13px " + FONT;
    ctx.textAlign = "center";
    ctx.fillStyle = palette.accent;
    model.days.forEach(function (day, i) {
      ctx.fillText(OP.Planner.WEEKDAYS_SHORT[day] || ("第" + day + "天"),
        gridLeft + i * colW + colW / 2, gridTop - m.headH / 2 + 5);
    });

    /* ---- 网格：整点横线 + 竖向发丝线 ---- */
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1;
    model.marks.forEach(function (mark) {
      var y = Math.round(gridTop + (mark.min - model.startMin) * pxPerMin) + 0.5;
      /* 贴着下边框那一条不画：横线正好压在边框上，标签也会被切掉半截 */
      if (y >= gridTop + gridH - 1) return;
      ctx.beginPath();
      ctx.moveTo(m.pad, y);
      ctx.lineTo(gridLeft + gridW, y);
      ctx.stroke();

      ctx.fillStyle = palette.textDim;
      ctx.font = "400 11px " + FONT;
      ctx.textAlign = "right";
      ctx.fillText(mark.label, gridLeft - 8, y - 4);
    });
    ctx.strokeStyle = palette.line;
    for (var i = 0; i <= model.days.length; i++) {
      var x = Math.round(gridLeft + i * colW) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, gridTop);
      ctx.lineTo(x, gridTop + gridH);
      ctx.stroke();
    }
    ctx.strokeRect(m.pad + 0.5, gridTop + 0.5, m.labelW + gridW - 1, gridH - 1);

    /* ---- 课程方块 ---- */
    model.events.forEach(function (event) {
      var dayIndex = model.days.indexOf(event.day);
      if (dayIndex < 0) return;

      var laneW = colW / (event.lanes || 1);
      var x = gridLeft + dayIndex * colW + event.lane * laneW + m.gap / 2;
      var y = gridTop + (event.startMin - model.startMin) * pxPerMin + 1;
      var w = laneW - m.gap;
      var h = Math.max(22, (event.endMin - event.startMin) * pxPerMin - 2);

      ctx.save();
      ctx.fillStyle = palette.accentSoft;
      roundRect(ctx, x, y, w, h, m.radius);
      ctx.fill();
      /* 左边一道主色竖条，代替整块描边（干净一点） */
      ctx.fillStyle = palette.accent;
      roundRect(ctx, x, y + 3, 3, Math.max(6, h - 6), 1.5);
      ctx.fill();

      ctx.beginPath();
      roundRect(ctx, x, y, w, h, m.radius);
      ctx.clip();

      var textX = x + 9;
      var textW = w - 16;
      var cursor = y + 16;
      var place = placeOf(event.course);

      blockLines(event, place, w).forEach(function (part) {
        if (cursor > y + h - 3) return;
        ctx.fillStyle = part.color === "textDim" ? palette.textDim : palette.text;
        ctx.font = part.weight + " " + part.size + "px " + FONT;
        ctx.textAlign = "left";
        var lineH = part.size + 4;
        var lines = wrapText(ctx, part.text, textW, part.lines);
        lines.forEach(function (line) {
          if (cursor > y + h - 2) return;
          ctx.fillText(line, textX, cursor);
          cursor += lineH;
        });
        cursor += 1;
      });
      ctx.restore();
    });

    ctx.restore();
    return {
      width: surface.width, height: surface.height,
      contentWidth: width, contentHeight: height
    };
  }

  /**
   * 按目标比例算画布尺寸（纯计算，能单测）。
   *
   * 只放大不缩小：课表按"刚好放下"的最小尺寸排，比例需要更多空间时往那个方向长，
   * 多出来的由 draw() 居中留白。这样手机壁纸（竖长）不会把课表压扁、也不会裁掉。
   */
  function fitSurface(content, ratio, pad) {
    var edge = pad === undefined ? 24 : pad;
    var w = content.width + edge * 2;
    var h = content.height + edge * 2;
    if (ratio) {
      if (w / h < ratio) w = h * ratio;
      else h = w / ratio;
    }
    return { width: Math.round(w), height: Math.round(h) };
  }

  /**
   * 浏览器里用的入口：排好版、建 canvas、画，返回 canvas。
   * 空课表返回 null（调用方负责提示"还没有课程"）。
   */
  function render(courses, opts) {
    var options = opts || {};
    var model = layout(courses, options);
    if (model.empty) return null;

    var scale = options.scale || METRICS.scale;
    var probe = document.createElement("canvas").getContext("2d");
    var content = draw(probe, model, options);       // 先空跑一次量出内容尺寸
    var surface = fitSurface(
      { width: content.contentWidth, height: content.contentHeight },
      options.ratio);

    var canvas = document.createElement("canvas");
    canvas.width = Math.round(surface.width * scale);
    canvas.height = Math.round(surface.height * scale);
    var ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    draw(ctx, model, Object.assign({}, options, {
      surfaceWidth: surface.width,
      surfaceHeight: surface.height
    }));

    return {
      canvas: canvas, model: model, ratio: options.ratio || 0,
      width: surface.width, height: surface.height
    };
  }

  OP.ExportImage = {
    PALETTE: PALETTE,
    METRICS: METRICS,
    hmToMin: hmToMin,
    minToHM: minToHM,
    assignLanes: assignLanes,
    fitSurface: fitSurface,
    layout: layout,
    draw: draw,
    render: render
  };
})(window.OP);
