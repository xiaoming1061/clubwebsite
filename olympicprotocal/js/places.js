/* 从 OpenStreetMap 读取当前位置附近的建筑
 *
 * 用 Overpass API，免费、免密钥、国内可直接访问，允许浏览器跨域调用，
 * 所以纯静态页面也能用，不需要任何后端转发。
 *
 * 坐标一律使用 WGS-84，和手机 GPS 一致。
 */

window.OP = window.OP || {};

(function (OP) {
  "use strict";

  /* Overpass 主节点偶尔会返回「服务器繁忙」，所以准备一个备用的 */
  var ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];

  var REQUEST_TIMEOUT = 20000;

  /* 名字里带这些词的，大概率是要找的教学楼 */
  var TEACHING_HINTS = [
    "教学楼", "教学", "实验楼", "实验", "综合楼", "图书", "图书馆", "馆",
    "中心", "学院", "楼", "校区", "Lecture", "Building", "Hall", "Centre", "Center", "Laboratory"
  ];

  /* ================= 名称与过滤 ================= */

  function isTeachingName(name) {
    var text = String(name);
    for (var i = 0; i < TEACHING_HINTS.length; i++) {
      var hint = TEACHING_HINTS[i];
      if (text.indexOf(hint) >= 0) return true;
      if (hint.length > 2 && text.toLowerCase().indexOf(hint.toLowerCase()) >= 0) return true;
    }
    return false;
  }

  /* 补上距离、限制半径、把像教学楼的排前面 */
  function finalize(results, origin, radius) {
    var out = [];
    var seen = {};

    (results || []).forEach(function (item) {
      if (!item || !item.name) return;
      var key = item.name + "|" + item.lat.toFixed(5) + "|" + item.lng.toFixed(5);
      if (seen[key]) return;
      seen[key] = true;

      item.distance = origin ? OP.Geo.haversine(origin, { lat: item.lat, lng: item.lng }) : null;
      if (radius && item.distance !== null && item.distance > radius) return;
      item.teaching = isTeachingName(item.name);
      out.push(item);
    });

    out.sort(function (a, b) {
      if (a.teaching !== b.teaching) return a.teaching ? -1 : 1;
      return (a.distance || 0) - (b.distance || 0);
    });
    return out;
  }

  function filterByName(results, keyword) {
    var word = String(keyword || "").trim().toLowerCase();
    if (!word) return results;
    return results.filter(function (item) {
      return String(item.name).toLowerCase().indexOf(word) >= 0 ||
        String(item.address || "").toLowerCase().indexOf(word) >= 0;
    });
  }

  /* ================= 合并同一点位 ================= */

  /* 同一栋楼里挑哪个名字当代表：先看像不像教学楼，再看名字短不短 */
  function pickLead(a, b) {
    if (!b) return true;
    if (a.teaching !== b.teaching) return a.teaching;
    return String(a.name).length < String(b.name).length;
  }

  /**
   * 把坐标几乎重合的结果并成一个点。
   * OpenStreetMap 里同一栋楼可能既有中文名又有英文名，或者拆成几个入口点，
   * 不合并的话列表里会出现好几个几乎一样的位置。
   *
   * @returns {Array} 每个点带 merged（合并了几个）和 mergedNames（被合并掉的名字）
   */
  function cluster(results, meters) {
    var tol = Number(meters) > 0 ? Number(meters) : 25;
    var clusters = [];

    (results || []).forEach(function (item) {
      var hit = null;
      for (var i = 0; i < clusters.length; i++) {
        var d = OP.Geo.haversine(clusters[i].anchor, { lat: item.lat, lng: item.lng });
        if (d !== null && d < tol) { hit = clusters[i]; break; }
      }

      if (hit) {
        hit.members.push(item);
        if (pickLead(item, hit.lead)) hit.lead = item;
      } else {
        clusters.push({
          anchor: { lat: item.lat, lng: item.lng },
          lead: item,
          members: [item]
        });
      }
    });

    return clusters.map(function (group) {
      var out = Object.assign({}, group.lead);
      out.merged = group.members.length;
      out.mergedNames = group.members
        .filter(function (m) { return m !== group.lead; })
        .map(function (m) { return m.name; })
        .slice(0, 8);
      return out;
    });
  }

  /**
   * 已经录过的楼栋不再重复导入（按名字或 25 米内视为同一个）
   * @returns {{ fresh: Array, duplicated: number }}
   */
  function splitDuplicates(results, existing, minMeters) {
    var tol = minMeters || 25;
    var fresh = [];
    var duplicated = 0;

    (results || []).forEach(function (item) {
      var hit = (existing || []).some(function (b) {
        if (b.name === item.name) return true;
        var d = OP.Geo.haversine({ lat: b.lat, lng: b.lng }, { lat: item.lat, lng: item.lng });
        return d !== null && d < tol;
      });
      if (hit) duplicated++;
      else fresh.push(item);
    });

    return { fresh: fresh, duplicated: duplicated };
  }

  /* ================= Overpass ================= */

  function buildOverpassQuery(lat, lng, radius) {
    var r = Math.round(radius || 800);
    return "[out:json][timeout:25];" +
      'nwr["building"]["name"](around:' + r + "," + lat.toFixed(6) + "," + lng.toFixed(6) + ");" +
      "out center 150;";
  }

  function parseOverpass(json, origin, radius) {
    var elements = (json && json.elements) || [];
    var results = elements.map(function (el) {
      var lat = el.lat !== undefined ? el.lat : (el.center && el.center.lat);
      var lng = el.lon !== undefined ? el.lon : (el.center && el.center.lon);
      if (lat === undefined || lng === undefined) return null;

      var tags = el.tags || {};
      var name = tags["name:zh"] || tags.name || tags["name:en"];
      if (!name) return null;

      var address = [tags["addr:street"], tags["addr:housenumber"]]
        .filter(function (t) { return t; }).join(" ");

      return {
        id: el.type + "/" + el.id,
        name: name,
        lat: lat,
        lng: lng,
        source: "osm",
        kind: tags.building || tags.amenity || "",
        address: address
      };
    }).filter(function (x) { return x; });

    return finalize(results, origin, radius);
  }

  /* 上游偶尔会长时间不响应，必须自己设超时 */
  function fetchWithTimeout(url, options) {
    if (typeof AbortController !== "function") return fetch(url, options);

    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT);
    var opts = Object.assign({}, options, { signal: controller.signal });

    return fetch(url, opts).then(function (res) {
      window.clearTimeout(timer);
      return res;
    }, function (err) {
      window.clearTimeout(timer);
      if (err && err.name === "AbortError") {
        throw new Error("请求超时（" + REQUEST_TIMEOUT / 1000 + " 秒）—— 地图服务可能正忙，稍后再试");
      }
      throw err;
    });
  }

  function queryOverpass(query) {
    var options = {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(query)
    };
    var lastError = null;

    function attempt(i) {
      if (i >= ENDPOINTS.length) {
        return Promise.reject(lastError || new Error("Overpass 查询失败"));
      }
      return fetchWithTimeout(ENDPOINTS[i], options)
        .then(function (res) {
          return res.text().then(function (text) {
            var json;
            try {
              json = JSON.parse(text);
            } catch (err) {
              throw new Error("返回的不是 JSON（HTTP " + res.status + "）");
            }
            if (!res.ok) throw new Error("请求失败（HTTP " + res.status + "）");
            return json;
          });
        })
        .catch(function (err) {
          lastError = err;
          return attempt(i + 1);
        });
    }

    return attempt(0);
  }

  /* ================= 对外入口 ================= */

  /**
   * @param {object} opts { lat, lng, radius, keyword, merge, mergeMeters }
   * @returns {Promise<Array>}
   */
  function search(opts) {
    opts = opts || {};
    var origin = { lat: opts.lat, lng: opts.lng };
    var radius = Number(opts.radius) || 800;

    if (typeof fetch !== "function") {
      return Promise.reject(new Error("这个浏览器不支持网络请求"));
    }
    if (typeof opts.lat !== "number" || typeof opts.lng !== "number") {
      return Promise.reject(new Error("还没有位置信息，请先定位或设置模拟位置"));
    }

    return queryOverpass(buildOverpassQuery(opts.lat, opts.lng, radius)).then(function (json) {
      var list = filterByName(parseOverpass(json, origin, radius), opts.keyword);
      return opts.merge === false ? list : cluster(list, opts.mergeMeters || 25);
    });
  }

  OP.Places = {
    ENDPOINTS: ENDPOINTS,
    buildOverpassQuery: buildOverpassQuery,
    parseOverpass: parseOverpass,
    finalize: finalize,
    filterByName: filterByName,
    cluster: cluster,
    pickLead: pickLead,
    splitDuplicates: splitDuplicates,
    isTeachingName: isTeachingName,
    search: search
  };
})(window.OP);
