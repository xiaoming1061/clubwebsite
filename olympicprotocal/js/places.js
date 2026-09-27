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

  /* Overpass 的公共节点经常很慢甚至超时。实测下来只有主节点稳定，
     所以不再"失败了再换下一个"——那会让最坏情况变成两次超时叠加。
     改成对冲：主节点发出后若迟迟不响应，并行发一份到备用节点，谁先回来用谁。 */
  var ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];

  var HEDGE_DELAY = 3500;      // 主节点 3.5 秒没动静就开始问备用
  var OVERALL_TIMEOUT = 15000; // 总共最多等 15 秒，比原来的 40 秒短得多

  /* 名字里带这些词的，大概率是要找的教学楼 */
  var TEACHING_HINTS = [
    "教学楼", "教学", "实验楼", "实验", "综合楼", "图书", "图书馆", "馆",
    "中心", "学院", "楼", "校区", "Lecture", "Building", "Hall", "Centre", "Center", "Laboratory"
  ];

  /* OSM 里一栋楼常常同时挂着好几个名字标记，全都收下来，
     这样不管是中文课表还是英文课表都能对上 */
  var NAME_TAGS = [
    "name", "name:zh", "name:zh-Hant", "name:zh-Hans", "name:en",
    "int_name", "alt_name", "official_name", "short_name"
  ];

  function collectNames(tags) {
    var seen = {};
    var all = [];

    NAME_TAGS.forEach(function (tag) {
      var value = tags[tag];
      if (!value) return;
      /* 有些标记用分号分隔多个别名 */
      String(value).split(";").forEach(function (part) {
        var name = part.trim();
        if (!name) return;
        var key = name.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        all.push(name);
      });
    });

    return all;
  }

  /**
   * 挑一个名字当显示名，其余的进别名。
   *
   * OSM 里港中文这类学校通常是这样标的：
   *   name    = "科學館東座 Science Centre East Block"   ← 中英拼在一起
   *   name:zh = "科學館東座"
   *   name:en = "Science Centre East Block"
   * 课表上一般写英文，所以默认拿英文当显示名，中文进别名——
   * 反过来也行，两个名字都会被保留，匹配时都会用到。
   */
  function pickNames(tags, preferEnglish) {
    var all = collectNames(tags);
    if (!all.length) return null;

    var en = tags["name:en"] || "";
    var zh = tags["name:zh"] || tags["name:zh-Hant"] || tags["name:zh-Hans"] || "";
    var primary = (preferEnglish && en) ? en : (zh || all[0]);

    /* "中文 English" 这种拼接名不用再当别名，信息重复 */
    var joined = tags.name || "";
    var isJoined = zh && en && (joined === zh + " " + en || joined === zh + en);

    var alias = all.filter(function (name) {
      if (name === primary) return false;
      if (isJoined && name === joined) return false;
      return true;
    });

    return {
      name: primary,
      alias: alias,
      nameEn: en,
      nameZh: zh,
      allNames: all,
      joinedName: joined
    };
  }

  /**
   * 切换"优先英文 / 优先中文"时重新挑显示名。
   * 用的还是当初解析出来的那份名字，所以不用重新联网。
   */
  function reorderNames(item, preferEnglish) {
    var all = item.allNames || [];
    if (!all.length) return item;

    var en = item.nameEn || "";
    var zh = item.nameZh || "";
    var primary = (preferEnglish !== false && en) ? en : (zh || all[0]);
    var joined = item.joinedName || "";
    var isJoined = zh && en && (joined === zh + " " + en || joined === zh + en);

    item.name = primary;
    item.alias = all.filter(function (name) {
      if (name === primary) return false;
      if (isJoined && name === joined) return false;
      return true;
    });
    item.teaching = looksLikeTeaching(item);
    return item;
  }

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

  /* 主名或任一别名像教学楼就算 */
  function looksLikeTeaching(item) {
    if (isTeachingName(item.name)) return true;
    return (item.alias || []).some(function (n) { return isTeachingName(n); });
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
      item.teaching = looksLikeTeaching(item);
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
      if (String(item.name).toLowerCase().indexOf(word) >= 0) return true;
      if (String(item.address || "").toLowerCase().indexOf(word) >= 0) return true;
      /* 中文名和英文名都能用来筛 */
      return (item.alias || []).some(function (n) {
        return String(n).toLowerCase().indexOf(word) >= 0;
      });
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
   * 这个名字是不是已经录过了。按"任一名字相同"或"25 米内"判断，
   * 中文名和英文名都算数。
   * @returns {object|null} 命中的已有楼栋
   */
  function findExisting(item, existing, minMeters) {
    var tol = minMeters || 25;
    var found = null;

    (existing || []).forEach(function (b) {
      if (found) return;
      var names = [b.name].concat(b.alias || []);
      if (names.indexOf(item.name) >= 0) { found = b; return; }
      if ((item.alias || []).some(function (n) { return names.indexOf(n) >= 0; })) { found = b; return; }

      if (typeof b.lat !== "number" || typeof b.lng !== "number") return;
      var d = OP.Geo.haversine({ lat: b.lat, lng: b.lng }, { lat: item.lat, lng: item.lng });
      if (d !== null && d < tol) found = b;
    });

    return found;
  }

  /**
   * 已经录过的楼栋不再重复导入
   * @returns {{ fresh: Array, matched: Array, duplicated: number }}
   */
  function splitDuplicates(results, existing, minMeters) {
    var fresh = [];
    var matched = [];
    var duplicated = 0;

    (results || []).forEach(function (item) {
      var hit = findExisting(item, existing, minMeters);
      if (hit) {
        duplicated++;
        matched.push(hit);
      } else {
        fresh.push(item);
        matched.push(null);
      }
    });

    return { fresh: fresh, matched: matched, duplicated: duplicated };
  }

  /**
   * 把地图上读到的其它名字补进已有楼栋的别名里。
   * 用来救"之前只导入了中文名"的情况，补完课表里的英文名就能匹配上了。
   * @returns {number} 补进去几个名字
   */
  function mergeAliases(item, building) {
    if (!item || !building) return 0;
    var existing = [building.name].concat(building.alias || []);
    var added = [];

    (item.alias || []).concat(item.name ? [item.name] : []).forEach(function (name) {
      if (!name || existing.indexOf(name) >= 0) return;
      if (added.indexOf(name) >= 0) return;
      added.push(name);
    });

    if (added.length) building.alias = (building.alias || []).concat(added);
    return added.length;
  }

  /* ================= Overpass ================= */

  function buildOverpassQuery(lat, lng, radius) {
    var r = Math.round(radius || 800);
    return "[out:json][timeout:25];" +
      'nwr["building"]["name"](around:' + r + "," + lat.toFixed(6) + "," + lng.toFixed(6) + ");" +
      "out center 150;";
  }

  function parseOverpass(json, origin, radius, options) {
    options = options || {};
    var elements = (json && json.elements) || [];
    var results = elements.map(function (el) {
      var lat = el.lat !== undefined ? el.lat : (el.center && el.center.lat);
      var lng = el.lon !== undefined ? el.lon : (el.center && el.center.lon);
      if (lat === undefined || lng === undefined) return null;

      var tags = el.tags || {};
      var names = pickNames(tags, options.preferEnglish !== false);
      if (!names) return null;

      var address = [tags["addr:street"], tags["addr:housenumber"]]
        .filter(function (t) { return t; }).join(" ");

      return {
        id: el.type + "/" + el.id,
        name: names.name,
        alias: names.alias,
        nameEn: names.nameEn,
        nameZh: names.nameZh,
        allNames: names.allNames,
        joinedName: names.joinedName,
        lat: lat,
        lng: lng,
        source: "osm",
        kind: tags.building || tags.amenity || "",
        address: address
      };
    }).filter(function (x) { return x; });

    return finalize(results, origin, radius);
  }

  function readOverpassJson(res) {
    return res.text().then(function (text) {
      var json;
      try {
        json = JSON.parse(text);
      } catch (err) {
        /* 节点繁忙时会返回一段说明文字而不是 JSON */
        throw new Error("地图服务返回了预期之外的内容（HTTP " + res.status + "）");
      }
      if (!res.ok) throw new Error("地图服务返回 HTTP " + res.status);
      return json;
    });
  }

  function queryOverpass(query) {
    var options = {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(query)
    };

    return new Promise(function (resolve, reject) {
      var settled = false;
      var controllers = [];
      var timers = [];
      var lastError = null;
      var started = 0;
      var failed = 0;

      var overall = window.setTimeout(function () {
        finish(new Error("地图服务响应太慢，超过 " + OVERALL_TIMEOUT / 1000 +
          " 秒还没返回。稍后再试，或者把搜索半径调小一点。"));
      }, OVERALL_TIMEOUT);

      function cleanup() {
        window.clearTimeout(overall);
        timers.forEach(window.clearTimeout);
        controllers.forEach(function (c) {
          try { c.abort(); } catch (err) { /* 已经结束了 */ }
        });
      }

      function finish(err, json) {
        if (settled) return;
        settled = true;
        cleanup();
        if (err) reject(err);
        else resolve(json);
      }

      function start(url) {
        if (settled) return;
        started++;

        var controller = typeof AbortController === "function" ? new AbortController() : null;
        if (controller) controllers.push(controller);

        var opts = controller ? Object.assign({}, options, { signal: controller.signal }) : options;

        fetch(url, opts)
          .then(readOverpassJson)
          .then(function (json) { finish(null, json); })
          .catch(function (err) {
            failed++;
            lastError = err;
            /* 所有节点都已经试过且都失败了，就不用等到总超时 */
            if (failed >= ENDPOINTS.length && started >= ENDPOINTS.length) finish(lastError);
          });
      }

      ENDPOINTS.forEach(function (url, i) {
        if (i === 0) start(url);
        else timers.push(window.setTimeout(function () { start(url); }, i * HEDGE_DELAY));
      });
    });
  }

  /* ================= 对外入口 ================= */

  /**
   * @param {object} opts { lat, lng, radius, keyword, merge, mergeMeters }
   * @returns {Promise<Array>}
   */
  /* 同一个位置短时间内重复搜索直接用缓存（坐标取到约 11 米精度，
     所以走动一点点也能命中）。Overpass 一次要好几秒，缓存省得很明显。 */
  var CACHE_TTL = 5 * 60 * 1000;
  var cache = {};

  function cacheKey(lat, lng, radius) {
    return lat.toFixed(4) + "," + lng.toFixed(4) + "," + Math.round(radius);
  }

  function clearCache() { cache = {}; }

  function fetchBuildings(opts, radius) {
    var key = cacheKey(opts.lat, opts.lng, radius);
    var hit = cache[key];

    if (hit && (Date.now() - hit.at) < CACHE_TTL) {
      return Promise.resolve(hit.json);
    }

    return queryOverpass(buildOverpassQuery(opts.lat, opts.lng, radius)).then(function (json) {
      cache[key] = { at: Date.now(), json: json };
      return json;
    });
  }

  /**
   * 把原始结果整理成展示用的列表。
   * 纯本地计算——切换「合并」或「优先英文名」时不用重新联网，瞬间就能重排。
   */
  function shape(raw, opts) {
    opts = opts || {};
    var list = (raw || []).map(function (item) {
      return reorderNames(item, opts.preferEnglish);
    });
    list = filterByName(list, opts.keyword);

    /* 换了显示名之后"像不像教学楼"可能变，所以要重新排一遍 */
    list.sort(function (a, b) {
      if (a.teaching !== b.teaching) return a.teaching ? -1 : 1;
      return (a.distance || 0) - (b.distance || 0);
    });

    return opts.merge === false ? list : cluster(list, opts.mergeMeters || 25);
  }

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

    return fetchBuildings(opts, radius).then(function (json) {
      var raw = parseOverpass(json, origin, radius, { preferEnglish: opts.preferEnglish });
      if (typeof opts.onRaw === "function") opts.onRaw(raw);
      return shape(raw, opts);
    });
  }

  OP.Places = {
    ENDPOINTS: ENDPOINTS,
    NAME_TAGS: NAME_TAGS,
    collectNames: collectNames,
    pickNames: pickNames,
    reorderNames: reorderNames,
    buildOverpassQuery: buildOverpassQuery,
    parseOverpass: parseOverpass,
    finalize: finalize,
    filterByName: filterByName,
    cluster: cluster,
    pickLead: pickLead,
    findExisting: findExisting,
    splitDuplicates: splitDuplicates,
    mergeAliases: mergeAliases,
    isTeachingName: isTeachingName,
    shape: shape,
    clearCache: clearCache,
    search: search
  };
})(window.OP);
