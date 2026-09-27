/* 校园简图：用 SVG 画楼栋点位、当前位置和当天的路线链
 *
 * 这是按真实经纬度等比投影出来的示意图，不是街道地图，
 * 所以不会有道路细节；需要真实的转弯导航时，用「路线」页里的地图跳转按钮。
 */

window.OP = window.OP || {};

(function (OP) {
  "use strict";

  var W = 1000;
  var H = 700;
  var PAD = 1.32;   // 视野留白系数
  var LAT_M = 110540;                       // 1 度纬度 ≈ 米
  var LNG_M = 111320;                       // 1 度经度 ≈ 米（赤道），再乘 cos(纬度)

  function esc(text) {
    return String(text === undefined || text === null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function makeProjector(points) {
    var lats = [], lngs = [];
    points.forEach(function (p) { lats.push(p.lat); lngs.push(p.lng); });

    var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
    var minLng = Math.min.apply(null, lngs), maxLng = Math.max.apply(null, lngs);
    var cLat = (minLat + maxLat) / 2;
    var cLng = (minLng + maxLng) / 2;

    var mPerLng = LNG_M * Math.cos((cLat * Math.PI) / 180);
    var spanX = Math.max((maxLng - minLng) * mPerLng, 120);   // 至少留 120 米的尺度
    var spanY = Math.max((maxLat - minLat) * LAT_M, 120);

    /* 横向纵向用同一个比例尺，保证不会被拉扁 */
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
   *   buildings  [{ id, name, lat, lng }]
   *   position   { lat, lng } | null
   *   activeId   下一节课所在楼栋的 id
   *   legs       buildLegs() 的结果，用来画路线链和距离
   */
  function render(svg, opts) {
    if (!svg) return;
    opts = opts || {};

    var buildings = (opts.buildings || []).filter(function (b) {
      return typeof b.lat === "number" && typeof b.lng === "number";
    });

    if (!buildings.length) {
      svg.innerHTML = '<text x="500" y="350" class="bld-label">还没有楼栋坐标，去「设置」里添加</text>';
      return;
    }

    var points = buildings.map(function (b) { return { lat: b.lat, lng: b.lng }; });
    if (opts.position) points.push({ lat: opts.position.lat, lng: opts.position.lng });

    var project = makeProjector(points);
    var parts = [grid()];

    /* ---- 路线链 ---- */
    var legs = opts.legs || [];
    if (opts.position && legs.length) {
      var chain = [{ x: project(opts.position).x, y: project(opts.position).y }];
      legs.forEach(function (leg) {
        if (leg.toPoint) {
          var p = project(leg.toPoint);
          chain.push({ x: p.x, y: p.y });
        }
      });
      if (chain.length > 1) {
        parts.push('<polyline class="route-line" points="' +
          chain.map(function (p) { return p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" ") +
          '"/>');
      }
      /* 每段的距离标注 */
      legs.forEach(function (leg, i) {
        if (!leg.metrics || !leg.toPoint) return;
        var a = project(i === 0 ? opts.position : legs[i - 1].toPoint);
        var b = project(leg.toPoint);
        var mx = (a.x + b.x) / 2;
        var my = (a.y + b.y) / 2 - 12;
        parts.push('<text class="dist-label" x="' + mx.toFixed(0) + '" y="' + my.toFixed(0) + '">' +
          esc(OP.Geo.formatDistance(leg.metrics.distance)) + "</text>");
      });
    }

    /* ---- 楼栋 ---- */
    buildings.forEach(function (b) {
      var p = project(b);
      var active = opts.activeId && b.id === opts.activeId;
      parts.push('<g>' +
        '<circle class="bld' + (active ? " is-active" : "") + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="21"/>' +
        '<text class="bld-label' + (active ? " is-active" : "") + '" x="' + p.x.toFixed(1) + '" y="' +
        (p.y + 7).toFixed(1) + '" style="font-size:19px">' + esc(b.id) + "</text>" +
        '<text class="bld-label' + (active ? " is-active" : "") + '" x="' + p.x.toFixed(1) + '" y="' +
        (p.y + 44).toFixed(1) + '" style="font-size:18px">' + esc(b.name) + "</text>" +
        "</g>");
    });

    /* ---- 我的位置 ---- */
    if (opts.position) {
      var me = project(opts.position);
      parts.push('<g>' +
        '<circle class="me-ring" cx="' + me.x.toFixed(1) + '" cy="' + me.y.toFixed(1) + '" r="12"/>' +
        '<circle class="me-dot" cx="' + me.x.toFixed(1) + '" cy="' + me.y.toFixed(1) + '" r="9"/>' +
        '<text class="me-label" x="' + me.x.toFixed(1) + '" y="' + (me.y - 24).toFixed(1) + '">我的位置</text>' +
        "</g>");
    }

    svg.innerHTML = parts.join("");
  }

  OP.MapView = { render: render };
})(window.OP);
