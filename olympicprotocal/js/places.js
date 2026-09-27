/* 从地图服务读取当前位置附近的建筑
 *
 * 支持三个来源，各自适用场景不同：
 *   osm    OpenStreetMap —— 免费、免密钥、国内可直接访问，校园建筑覆盖一般
 *   amap   高德地图      —— 国内校园数据最全，需要免费申请的 Key
 *   google Google Maps   —— 需要 Key + 结算账号，大陆网络不通且楼栋数据很薄
 *
 * 坐标约定：对外一律使用 WGS-84（和 GPS、OpenStreetMap 一致），
 * 只有跟高德交互时才临时转成 GCJ-02，拿回来再转回来。
 */

window.OP = window.OP || {};

(function (OP) {
  "use strict";

  /* Overpass 主节点偶尔会返回「服务器繁忙」，所以准备一个备用的 */
  var OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];
  var GOOGLE = "https://places.googleapis.com/v1/places:searchNearby";
  var AMAP = "https://restapi.amap.com/v3/place/around";

  var PROVIDERS = [
    {
      id: "osm",
      label: "OpenStreetMap（免费 · 免密钥）",
      needKey: false,
      note: "免密钥，国内网络可直接访问。高校建筑在 OSM 里覆盖还算可以，但可能只有英文名或干脆没名字。"
    },
    {
      id: "amap",
      label: "高德地图（需 Key）",
      needKey: true,
      note: "国内校园楼栋数据最全，Key 免费申请。浏览器跨域受限，需要配合 node tools/serve.js 使用。"
    },
    {
      id: "google",
      label: "Google Maps（需 Key）",
      needKey: true,
      note: "需要 Key 与 Cloud 结算账号。中国大陆无法直接访问，且中国境内的单体楼栋数据极不完整，仅建议海外校区使用。"
    }
  ];

  /* 名字里带这些词的，大概率是要找的教学楼 */
  var TEACHING_HINTS = ["教学楼", "教学", "实验楼", "实验", "综合楼", "图书", "图书馆", "馆", "中心", "学院", "楼", "校区"];

  /* 高德返回的是英文错误标识，翻译成能直接照做的中文 */
  var AMAP_ERRORS = {
    INVALID_USER_KEY: "Key 无效。检查是不是复制多了空格，或者这个 Key 已经被删掉了。",
    USERKEY_PLAT_NOMATCH: "Key 平台类型不对。这里必须用「Web服务」类型的 Key，不能用 JS API / iOS / Android 的 Key。",
    INVALID_USER_SCODE: "缺少或写错了安全密钥（jscode）。Web服务类型的 Key 一般不需要它。",
    SERVICE_NOT_AVAILABLE: "这个服务没开通。去控制台把该 Key 的服务范围勾上「Web服务」。",
    DAILY_QUERY_OVER_LIMIT: "今天的调用次数用完了，明天恢复。",
    USER_DAILY_QUERY_OVER_LIMIT: "个人账号的日配额用完了，明天恢复。",
    ACCESS_TOO_FREQUENT: "调用太频繁，等几秒再试。",
    QPS_HAS_EXCEEDED_THE_LIMIT: "每秒请求数超限，等几秒再试。",
    INSUFFICIENT_PRIVILEGES: "这个 Key 没有「周边搜索」的权限。",
    INSUFFICIENT_ABROAD_PRIVILEGES: "没有海外位置的查询权限。",
    INVALID_USER_IP: "被 IP 白名单拦了。去控制台把当前 IP 加进去，或者取消白名单限制。",
    INVALID_USER_DOMAIN: "被域名白名单拦了，检查控制台里的域名设置。",
    INVALID_USER_SIGNATURE: "数字签名校验失败。要么在控制台关掉「数字签名」，要么在请求里补上 sig 参数。",
    USER_KEY_RECYCLED: "这个 Key 已被回收（长期不使用会被高德回收），重新建一个。",
    INVALID_PARAMS: "请求参数有问题，检查半径和坐标。",
    NEARBY_AREAS_NOT_FOUND: "这个位置附近没有数据。",
    INVALID_LATLNG: "坐标不合法。"
  };

  function amapErrorText(info, infocode) {
    var raw = String(info || "").trim();
    if (AMAP_ERRORS[raw]) return AMAP_ERRORS[raw] + "（" + raw + "）";
    if (raw) return "高德返回错误：" + raw + (infocode ? "（" + infocode + "）" : "");
    return "高德接口返回错误，且没有给出原因";
  }

  /* ================= 通用工具 ================= */

  function isTeachingName(name) {
    for (var i = 0; i < TEACHING_HINTS.length; i++) {
      if (String(name).indexOf(TEACHING_HINTS[i]) >= 0) return true;
    }
    return false;
  }

  /* 补上距离、限制半径、按距离排序 */
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
    var word = String(keyword || "").trim();
    if (!word) return results;
    return results.filter(function (item) {
      return item.name.indexOf(word) >= 0 || (item.address || "").indexOf(word) >= 0;
    });
  }

  /* ---------- 合并同一点位 ---------- */

  /* 同一栋楼里挑哪个名字当代表：先看像不像教学楼，再看名字短不短 */
  function pickLead(a, b) {
    if (!b) return true;
    if (a.teaching !== b.teaching) return a.teaching;
    return String(a.name).length < String(b.name).length;
  }

  /**
   * 把坐标几乎重合的结果并成一个点。
   *
   * 高德返回的是 POI 而不是楼栋，同一栋楼里会有「某实验室」「某报告厅」
   * 「某中心」等十几个点，坐标完全一样。不合并的话列表里全是同一栋楼的房间名，
   * 根本没法选。OpenStreetMap 返回的本来就是楼栋轮廓，一般不触发合并。
   *
   * @returns {Array} 每个点带 merged（合并了几个）和 mergedNames（被合并掉的别名）
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

  /* ================= OpenStreetMap / Overpass ================= */

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

  /* ================= 高德 ================= */

  function buildAmapUrl(key, lat, lng, radius) {
    /* 高德吃的是 GCJ-02，必须先把手机坐标转过去，否则整体偏移几百米 */
    var gcj = OP.Geo.wgs84ToGcj02(lat, lng);
    return AMAP + "?key=" + encodeURIComponent(key) +
      "&location=" + gcj.lng.toFixed(6) + "," + gcj.lat.toFixed(6) +
      "&radius=" + Math.round(radius || 800) +
      "&types=%E7%A7%91%E6%95%99%E6%96%87%E5%8C%96%E6%9C%8D%E5%8A%A1" +
      "&offset=50&page=1&extensions=base";
  }

  function parseAmap(json, origin, radius) {
    if (!json || String(json.status) !== "1") {
      throw new Error(amapErrorText(json && json.info, json && json.infocode));
    }

    var results = (json.pois || []).map(function (poi) {
      var parts = String(poi.location || "").split(",");
      if (parts.length !== 2) return null;
      var wgs = OP.Geo.gcj02ToWgs84(Number(parts[1]), Number(parts[0]));
      if (isNaN(wgs.lat) || isNaN(wgs.lng)) return null;

      return {
        id: "amap/" + (poi.id || poi.name),
        name: poi.name,
        lat: wgs.lat,
        lng: wgs.lng,
        source: "amap",
        kind: poi.type || "",
        address: poi.address || ""
      };
    }).filter(function (x) { return x; });

    return finalize(results, origin, radius);
  }

  /* ================= Google Places ================= */

  function buildGoogleRequest(key, lat, lng, radius) {
    return {
      url: GOOGLE,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress,places.types"
      },
      body: JSON.stringify({
        includedTypes: ["university", "school", "library"],
        maxResultCount: 20,
        languageCode: "zh-CN",
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: Math.min(Math.max(radius || 800, 1), 50000)
          }
        }
      })
    };
  }

  function parseGoogle(json, origin, radius) {
    if (json && json.error) {
      throw new Error("Google 接口返回错误：" + (json.error.message || json.error.status));
    }

    var results = (json && json.places ? json.places : []).map(function (place) {
      var loc = place.location || {};
      return {
        id: "google/" + (place.id || (place.displayName && place.displayName.text)),
        name: (place.displayName && place.displayName.text) || "",
        lat: loc.latitude,
        lng: loc.longitude,
        source: "google",
        kind: (place.types || []).join(", "),
        address: place.formattedAddress || ""
      };
    }).filter(function (x) { return x && x.name && typeof x.lat === "number"; });

    return finalize(results, origin, radius);
  }

  /* ================= 本地代理 ================= */

  var proxyReady = false;
  var proxyChecked = false;

  /* tools/serve.js 提供了一个 /api/proxy，用来绕开浏览器的跨域限制 */
  function detectProxy() {
    if (proxyChecked) return Promise.resolve(proxyReady);
    proxyChecked = true;
    if (typeof fetch !== "function") return Promise.resolve(false);

    return fetch("/api/health", { cache: "no-store" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (json) {
        proxyReady = !!(json && json.proxy);
        return proxyReady;
      })
      .catch(function () {
        proxyReady = false;
        return false;
      });
  }

  function proxied(url) {
    return "/api/proxy?url=" + encodeURIComponent(url);
  }

  var REQUEST_TIMEOUT = 20000;

  /* 上游偶尔会长时间不响应（Overpass 尤其常见），必须自己设超时 */
  function fetchWithTimeout(target, options) {
    if (typeof AbortController !== "function") return fetch(target, options);

    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT);
    var opts = Object.assign({}, options, { signal: controller.signal });

    return fetch(target, opts).then(function (res) {
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

  function doFetch(url, options, useProxy) {
    var target = useProxy ? proxied(url) : url;
    return fetchWithTimeout(target, options).then(function (res) {
      return res.text().then(function (text) {
        var json;
        try {
          json = JSON.parse(text);
        } catch (err) {
          throw new Error("返回的不是 JSON（HTTP " + res.status + "）：" + text.slice(0, 120));
        }
        if (!res.ok) {
          throw new Error("请求失败（HTTP " + res.status + "）：" + JSON.stringify(json).slice(0, 160));
        }
        return json;
      });
    });
  }

  /* 依次尝试各个 Overpass 节点，前一个失败就换下一个 */
  function queryOverpass(query) {
    var options = {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(query)
    };
    var lastError = null;

    function attempt(i) {
      if (i >= OVERPASS_ENDPOINTS.length) {
        return Promise.reject(lastError || new Error("Overpass 查询失败"));
      }
      return doFetch(OVERPASS_ENDPOINTS[i], options, false).catch(function (err) {
        lastError = err;
        return attempt(i + 1);
      });
    }

    return attempt(0);
  }

  /* ================= 对外入口 ================= */

  /**
   * @param {string} provider  osm | amap | google
   * @param {object} opts      { lat, lng, radius, key, keyword }
   * @returns {Promise<Array>}
   */
  function search(provider, opts) {
    opts = opts || {};
    var origin = { lat: opts.lat, lng: opts.lng };
    var radius = Number(opts.radius) || 800;
    var key = String(opts.key || "").trim();

    if (typeof fetch !== "function") {
      return Promise.reject(new Error("这个浏览器不支持网络请求"));
    }
    if (typeof opts.lat !== "number" || typeof opts.lng !== "number") {
      return Promise.reject(new Error("还没有位置信息，请先定位或设置模拟位置"));
    }

    var def = PROVIDERS.filter(function (p) { return p.id === provider; })[0];
    if (!def) return Promise.reject(new Error("未知的数据来源：" + provider));
    if (def.needKey && !key) return Promise.reject(new Error("这个来源需要先填 API Key"));

    return detectProxy().then(function (useProxy) {
      /* 高德和 Google 的接口不返回跨域头，必须走本地代理 */
      var mustProxy = provider === "amap" || provider === "google";
      if (mustProxy && !useProxy) {
        throw new Error(
          "浏览器跨域限制：请用 node tools/serve.js 启动页面（http://localhost:5173）之后再搜索" +
          "，或者把请求放到自己的后端转发"
        );
      }

      /* 合并同一栋楼内的点位：默认开启，opt.merge === false 可关掉 */
      var shape = function (list) {
        var filtered = filterByName(list, opts.keyword);
        return opts.merge === false ? filtered : cluster(filtered, opts.mergeMeters || 25);
      };

      if (provider === "osm") {
        return queryOverpass(buildOverpassQuery(opts.lat, opts.lng, radius))
          .then(function (json) { return shape(parseOverpass(json, origin, radius)); });
      }

      if (provider === "amap") {
        return doFetch(buildAmapUrl(key, opts.lat, opts.lng, radius), { method: "GET" }, true)
          .then(function (json) { return shape(parseAmap(json, origin, radius)); });
      }

      var req = buildGoogleRequest(key, opts.lat, opts.lng, radius);
      return doFetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body
      }, true).then(function (json) {
        return shape(parseGoogle(json, origin, radius));
      });
    });
  }

  OP.Places = {
    PROVIDERS: PROVIDERS,
    OVERPASS_ENDPOINTS: OVERPASS_ENDPOINTS,
    AMAP_ERRORS: AMAP_ERRORS,
    amapErrorText: amapErrorText,
    buildOverpassQuery: buildOverpassQuery,
    parseOverpass: parseOverpass,
    buildAmapUrl: buildAmapUrl,
    parseAmap: parseAmap,
    buildGoogleRequest: buildGoogleRequest,
    parseGoogle: parseGoogle,
    finalize: finalize,
    filterByName: filterByName,
    cluster: cluster,
    pickLead: pickLead,
    splitDuplicates: splitDuplicates,
    isTeachingName: isTeachingName,
    detectProxy: detectProxy,
    search: search
  };
})(window.OP);
