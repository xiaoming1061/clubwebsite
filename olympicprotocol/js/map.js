/* 校园简图：用 SVG 画今天的行程
 *
 * 只画三类信息，其余楼栋一律不画：
 *   我的位置       —— 会脉冲的圆点
 *   下一节课        —— 高亮 + 「下一节」旗标
 *   今天要去的楼栋   —— 按先后编号，标出上课时间
 * 没在今天的行程里的楼栋完全不画——导入一次可能带回上百栋，
 * 全画上去反而是干扰。
 *
 * 这是按真实经纬度等比投影出来的示意图，不是街道地图，
 * 需要转弯导航时用「路线」页里的地图跳转按钮。
 */

window.OP = window.OP || {};

(function (OP) {
  "use strict";

  var W = 1000;
  var H = 700;
  var PAD = 1.32;   // 视野留白系数
  var LAT_M = 110540;
  var LNG_M = 111320;

  function esc(text) {
    return String(text === undefined || text === null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function hasCoords(b) {
    return !!(b && typeof b.lat === "number" && typeof b.lng === "number");
  }

  function makeProjector(points) {
    var lats = [], lngs = [];
    points.forEach(function (p) { lats.push(p.lat); lngs.push(p.lng); });

    var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
    var minLng = Math.min.apply(null, lngs), maxLng = Math.max.apply(null, lngs);
    var cLat = (minLat + maxLat) / 2;
    var cLng = (minLng + maxLng) / 2;

    var mPerLng = LNG_M * Math.cos((cLat * Math.PI) / 180);
    var spanX = Math.max((maxLng - minLng) * mPerLng, 120);
    var spanY = Math.max((maxLat - minLat) * LAT_M, 120);

    /* 横纵用同一个比例尺，画面才不会被拉扁 */
    var scale = Math.min(W / (spanX * PAD), H / (spanY * PAD));

    return function (point) {
      return {
        x: W / 2 + (point.lng - cLng) * mPerLng * scale,
        y: H / 2 - (point.lat - cLat) * LAT_M * scale
      };
    };
  }

  function grid() {
    var out = '<g class="svg-grid">';
    for (var i = 1; i < 8; i++) {
      var x = (W / 8) * i;
      var y = (H / 8) * i;
      out += '<line x1="' + x.toFixed(0) + '" y1="0" x2="' + x.toFixed(0) + '" y2="' + H + '"/>';
      out += '<line x1="0" y1="' + y.toFixed(0) + '" x2="' + W + '" y2="' + y.toFixed(0) + '"/>';
    }
    return out + "</g>";
  }

  /**
   * @param {SVGElement} svg
   * @param {object} opts
 *   buildings  [{ id, name, lat, lng }]  全部楼栋，只用来判断"有没有楼栋"
   *   position   { lat, lng } | null       我的位置
   *   stops      [{ building, order, time, isNext }]  今天要去的楼栋，按顺序
   *   detourFactor                          直线距离折算成步行距离的系数
   */
  function render(svg, opts) {
    if (!svg) return;
    opts = opts || {};

    var all = (opts.buildings || []).filter(hasCoords);
    var stops = (opts.stops || []).filter(function (s) {
      return s && hasCoords(s.building);
    });

    if (!all.length) {
      svg.innerHTML = '<text x="500" y="350" class="bld-label">还没有楼栋坐标，去「设置」里添加</text>';
      return;
    }

    /* 取景范围只按"今天要去的楼 + 我的位置"来算，
       这样画面会自然放大到有用的那块，而不是被上百栋楼撑开 */
    var frame = stops.map(function (s) { return s.building; });
    if (opts.position) frame.push(opts.position);

    if (!frame.length) {
      svg.innerHTML = '<text x="500" y="350" class="bld-label">今天没有要去的地方</text>';
      return;
    }

    var project = makeProjector(frame);
    var parts = [grid()];

    /* ---- 行程点：我的位置 → 第一节 → 第二节 … ---- */
    var nodes = [];
    if (opts.position) nodes.push({ point: opts.position, stop: null });
    stops.forEach(function (s) { nodes.push({ point: s.building, stop: s }); });

    if (nodes.length > 1) {
      parts.push('<polyline class="route-line" points="' + nodes.map(function (n) {
        var p = project(n.point);
        return p.x.toFixed(1) + "," + p.y.toFixed(1);
      }).join(" ") + '"/>');
    }

    /* ---- 每段的距离（和路线列表用同一套折算方式，数字对得上） ---- */
    var detour = Number(opts.detourFactor) || 1.3;
    for (var i = 1; i < nodes.length; i++) {
      var straight = OP.Geo.haversine(nodes[i - 1].point, nodes[i].point);
      if (straight === null) continue;

      var a = project(nodes[i - 1].point);
      var b2 = project(nodes[i].point);
      parts.push('<text class="dist-label" x="' + ((a.x + b2.x) / 2).toFixed(0) +
        '" y="' + ((a.y + b2.y) / 2 - 12).toFixed(0) + '">' +
        esc(OP.Geo.formatDistance(straight * detour)) + "</text>");
    }

    /* ---- 今天要去的楼栋 ---- */
    stops.forEach(function (s) {
      var b = s.building;
      var p = project(b);
      /* 圆圈缩小了：标签本身已经够说明问题，圈太大反而压住路线 */
      var r = s.isNext ? 17 : 14;

      parts.push("<g>" +
        '<circle class="bld' + (s.isNext ? " is-next" : " is-today") +
          '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + r + '"/>' +
        '<text class="bld-order' + (s.isNext ? " is-next" : "") +
          '" x="' + p.x.toFixed(1) + '" y="' + (p.y + 6).toFixed(1) + '">' +
          esc(s.order || "") + "</text>" +
        '<text class="bld-label' + (s.isNext ? " is-next" : "") +
          '" x="' + p.x.toFixed(1) + '" y="' + (p.y + r + 22).toFixed(1) + '">' +
          esc(b.name) + "</text>" +
        (s.time
          ? '<text class="bld-time" x="' + p.x.toFixed(1) + '" y="' + (p.y + r + 42).toFixed(1) + '">' +
            esc(s.time) + "</text>"
          : "") +
        (s.isNext
          ? '<text class="bld-flag" x="' + p.x.toFixed(1) + '" y="' + (p.y - r - 10).toFixed(1) + '">下一节</text>'
          : "") +
        "</g>");
    });

    /* ---- 我的位置 ---- */
    if (opts.position) {
      var me = project(opts.position);
      parts.push("<g>" +
        '<circle class="me-ring" cx="' + me.x.toFixed(1) + '" cy="' + me.y.toFixed(1) + '" r="12"/>' +
        '<circle class="me-dot" cx="' + me.x.toFixed(1) + '" cy="' + me.y.toFixed(1) + '" r="9"/>' +
        '<text class="me-label" x="' + me.x.toFixed(1) + '" y="' + (me.y - 24).toFixed(1) + '">我的位置</text>' +
        "</g>");
    } else if (stops.length) {
      /* 没定位时在图上说一句，免得以为坏了 */
      parts.push('<text class="map-note" x="500" y="666">打开定位后会显示你的位置</text>');
    }

    svg.innerHTML = parts.join("");
  }

  OP.MapView = { render: render };
})(window.OP);
