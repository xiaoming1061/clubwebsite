/* 宿舍：默认数据 + 用户自己补的几处
 *
 * 默认宿舍来自 data/dorms.js（OpenStreetMap 里按
 * 宿舍 / 舍堂 / 書院 / Hostel / Residence / Dormitory / Hall 搜出来的），
 * 只读；用户在页面上用「用当前位置添加」补的是另一份，存在 settings.addedDorms 里。
 *
 * 故意不做「默认数据自动并进本地」那一套（楼栋那套的复杂度不值得再来一遍）：
 * 宿舍是个人属性——一个人只住一个地方，多出来的列表对他没用。
 */

window.OP = window.OP || {};

(function (OP) {
  "use strict";

  function shipped() {
    var data = OP.DEFAULT_DORMS;
    return data && Array.isArray(data.dorms) ? data.dorms : [];
  }

  function extras(settings) {
    var list = settings && settings.addedDorms;
    return Array.isArray(list) ? list : [];
  }

  function hasCoords(d) {
    return !!(d && typeof d.lat === "number" && typeof d.lng === "number");
  }

  /* ---------- 繁简 + 拼音首字母 ----------
   *
   * 港中文的宿舍名是繁体（知行樓、應林堂），但很多人打字用简体（知行楼、应林堂），
   * 也有人只打首字母（zxl）。要让这些都能搜到，就需要"繁→简"和"字→拼音首字母"两张表。
   *
   * 静态站点没有构建步骤，也不想为了这个再拉一个转换库进来（那得几百 KB），
   * 所以这里只收**宿舍名字里真正出现过的汉字**——一共 103 个，够用又不臃肿。
   * 自检里有一条盯着"数据里的每个字都在表里"，以后数据里冒出新字会直接报错，
   * 不会悄悄漏掉某个字的拼音。
   *
   * 格式： "字": ["简体写法", "拼音首字母"]
   * 繁体和简体都各写一条（比如 "樓" 和 "楼"），查表时不用判断是哪种。
   */
  var ZH = {
    "一": ["一", "y"], "七": ["七", "q"], "三": ["三", "s"], "中": ["中", "z"],
    "二": ["二", "e"], "五": ["五", "w"], "人": ["人", "r"], "仙": ["仙", "x"],
    "伍": ["伍", "w"], "宜": ["宜", "y"], "孫": ["孙", "s"], "晨": ["晨", "c"],
    "興": ["兴", "x"],
    "伉": ["伉", "k"], "伯": ["伯", "b"], "低": ["低", "d"], "何": ["何", "h"],
    "偉": ["伟", "w"], "儷": ["俪", "l"], "六": ["六", "l"], "利": ["利", "l"],
    "北": ["北", "b"], "十": ["十", "s"], "南": ["南", "n"], "博": ["博", "b"],
    "友": ["友", "y"], "合": ["合", "h"], "和": ["和", "h"], "員": ["员", "y"],
    "善": ["善", "s"], "四": ["四", "s"], "國": ["国", "g"], "園": ["园", "y"],
    "培": ["培", "p"], "基": ["基", "j"], "堂": ["堂", "t"], "夏": ["夏", "x"],
    "大": ["大", "d"], "夫": ["夫", "f"], "學": ["学", "x"], "宿": ["宿", "s"],
    "崇": ["崇", "c"], "工": ["工", "g"], "座": ["座", "z"], "志": ["志", "z"],
    "思": ["思", "s"], "恒": ["恒", "h"], "應": ["应", "y"], "教": ["教", "j"],
    "文": ["文", "w"], "旬": ["旬", "x"], "昆": ["昆", "k"], "明": ["明", "m"],
    "書": ["书", "s"], "會": ["会", "h"], "有": ["有", "y"], "望": ["望", "w"],
    "林": ["林", "l"], "格": ["格", "g"], "梅": ["梅", "m"], "棟": ["栋", "d"],
    "楙": ["楙", "m"], "樓": ["楼", "l"], "樹": ["树", "s"], "添": ["添", "t"],
    "港": ["港", "g"], "湯": ["汤", "t"], "漢": ["汉", "h"], "生": ["生", "s"],
    "知": ["知", "z"], "研": ["研", "y"], "神": ["神", "s"], "究": ["究", "j"],
    "第": ["第", "d"], "節": ["节", "j"], "紫": ["紫", "z"], "繼": ["继", "j"],
    "群": ["群", "q"], "聯": ["联", "l"], "聲": ["声", "s"], "職": ["职", "z"],
    "肇": ["肇", "z"], "舍": ["舍", "s"], "芝": ["芝", "z"], "芬": ["芬", "f"],
    "苑": ["苑", "y"], "若": ["若", "r"], "華": ["华", "h"], "蔡": ["蔡", "c"],
    "行": ["行", "x"], "衡": ["衡", "h"], "費": ["费", "f"], "質": ["质", "z"],
    "賽": ["赛", "s"], "連": ["连", "l"], "逸": ["逸", "y"], "鐵": ["铁", "t"],
    "院": ["院", "y"], "陳": ["陈", "c"], "際": ["际", "j"], "雅": ["雅", "y"],
    "雲": ["云", "y"], "震": ["震", "z"], "霞": ["霞", "x"], "顧": ["顾", "g"],
    "香": ["香", "x"], "馬": ["马", "m"], "高": ["高", "g"],
    /* 简体那半边 */
    "伟": ["伟", "w"], "俪": ["俪", "l"], "员": ["员", "y"], "国": ["国", "g"],
    "园": ["园", "y"], "学": ["学", "x"], "应": ["应", "y"], "书": ["书", "s"],
    "会": ["会", "h"], "栋": ["栋", "d"], "楼": ["楼", "l"], "树": ["树", "s"],
    "汤": ["汤", "t"], "汉": ["汉", "h"], "节": ["节", "j"], "继": ["继", "j"],
    "联": ["联", "l"], "声": ["声", "s"], "职": ["职", "z"], "华": ["华", "h"],
    "费": ["费", "f"], "质": ["质", "z"], "赛": ["赛", "s"], "连": ["连", "l"],
    "铁": ["铁", "t"], "陈": ["陈", "c"], "际": ["际", "j"], "云": ["云", "y"],
    "顾": ["顾", "g"], "马": ["马", "m"], "兴": ["兴", "x"], "孙": ["孙", "s"]
  };

  /**
   * 繁体转简体。表里没有的字原样保留——
   * 表不全时宁可"这个字没转"，也不能把字吃掉。
   */
  function toSimplified(text) {
    return String(text === undefined || text === null ? "" : text)
      .replace(/[\u3400-\u4dbf\u4e00-\u9fff]/g, function (ch) {
        var row = ZH[ch];
        return row ? row[0] : ch;
      });
  }

  /** 中文拼音首字母：只取名字里的汉字，英文部分不参与（"zxl" → 知行樓） */
  function initialsOf(text) {
    var out = "";
    String(text === undefined || text === null ? "" : text)
      .replace(/[\u3400-\u4dbf\u4e00-\u9fff]/g, function (ch) {
        var row = ZH[ch];
        if (row && row[1]) out += row[1];
        return "";
      });
    return out;
  }

  /** 比较用的统一写法：小写 + 转简体 */
  function normalize(text) {
    return toSimplified(text).toLowerCase();
  }

  /* 显示用的名字：英文 + 中文并排，两个都看得见才有用
     （只写 "Bethlehem Hall" 或只写 "伯利衡宿舍" 都有人认不出来） */
  function labelOf(d) {
    var zh = d.nameZh || "";
    if (!zh || zh === d.name) return d.name;
    return d.name + " " + zh;
  }

  /* 补齐字段：搜索和播报都要能拿到 alias 数组，别到处判断 undefined */
  function shape(d, custom) {
    var allNames = [d.name, d.nameZh, d.nameEn, d.label].concat(d.alias || []).filter(Boolean);
    return {
      id: d.id,
      name: d.name,
      nameZh: d.nameZh || "",
      nameEn: d.nameEn || "",
      label: labelOf(d),
      alias: (d.alias || []).slice(),
      /* 搜"知行楼"（简体）和"zxl"（首字母）时用的中间结果，
         在 shape 里算一次，搜索时不用反复算 */
      zhSimple: toSimplified(d.nameZh || ""),
      zhInitials: initialsOf(allNames.join(" ")),
      lat: d.lat,
      lng: d.lng,
      kind: d.kind || "",
      custom: !!custom
    };
  }

  /** 全部宿舍，按名字排序（中英文混排就让 localeCompare 去管） */
  function all(settings) {
    var out = shipped().filter(hasCoords).map(function (d) { return shape(d, false); });
    extras(settings).forEach(function (d) {
      if (!hasCoords(d)) return;
      if (out.some(function (x) { return x.id === d.id; })) return;
      out.push(shape(d, true));
    });
    out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return out;
  }

  function byId(settings, id) {
    if (!id) return null;
    var found = all(settings).filter(function (d) { return d.id === id; })[0];
    return found || null;
  }

  /** 中英文、别名都能搜；空关键词返回全部 */
  function search(settings, query) {
    var list = all(settings);
    var raw = String(query === undefined || query === null ? "" : query).trim();
    if (!raw) return list;

    /* 统一成"小写 + 简体"再比：这样简繁两种写法能互相搜到 */
    var q = normalize(raw);
    if (!q) return list;

    /* 纯字母数字的查询再当一次"中文首字母"来试：输 zxl 也能找到知行樓。
       只对纯字母的查询这么做，不然"宿舍"这种中文查询会白算一遍 */
    var letters = /^[a-z0-9\s]+$/.test(q) ? q.replace(/[^a-z0-9]/g, "") : "";

    return list.filter(function (d) {
      var hay = normalize(names(d).join(" "));
      if (hay.indexOf(q) >= 0) return true;
      return !!(letters && d.zhInitials && d.zhInitials.indexOf(letters) >= 0);
    });
  }

  /* 收录的所有名字（英文 / 中文 / 并排的那个写法 / 别名），搜索和播报都用它 */
  function names(dorm) {
    if (!dorm) return [];
    var out = [];
    [dorm.name, dorm.nameZh, dorm.nameEn, dorm.label]
      .concat(dorm.alias || [])
      .filter(Boolean)
      .forEach(function (n) {
        if (out.indexOf(n) < 0) out.push(n);
      });
    return out;
  }

  function nearest(point, settings) {
    if (!point) return null;
    var best = null;
    all(settings).forEach(function (d) {
      var distance = OP.Geo.haversine(point, { lat: d.lat, lng: d.lng });
      if (distance === null) return;
      if (!best || distance < best.distance) best = { dorm: d, distance: distance };
    });
    return best;
  }

  /* 用户自己加的宿舍：id 带 d- 前缀，跟 OSM 的 way-/relation- 分开 */
  function makeId() {
    return "dorm-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e4).toString(36);
  }

  function add(settings, name, point) {
    var clean = String(name || "").trim();
    if (!clean || !point || typeof point.lat !== "number") return null;

    var entry = {
      id: makeId(),
      name: clean,
      nameZh: "",
      nameEn: "",
      alias: [],
      lat: Number(point.lat.toFixed(6)),
      lng: Number(point.lng.toFixed(6)),
      kind: "custom"
    };
    if (typeof point.elevation === "number") entry.elevation = point.elevation;

    if (!Array.isArray(settings.addedDorms)) settings.addedDorms = [];
    settings.addedDorms.push(entry);
    return entry;
  }

  /** 默认宿舍删不掉（那是数据文件里的），只能删自己加的 */
  function remove(settings, id) {
    if (!Array.isArray(settings.addedDorms)) return false;
    var before = settings.addedDorms.length;
    settings.addedDorms = settings.addedDorms.filter(function (d) { return d.id !== id; });
    return settings.addedDorms.length !== before;
  }

  OP.Dorm = {
    all: all,
    byId: byId,
    search: search,
    names: names,
    label: labelOf,
    toSimplified: toSimplified,
    initialsOf: initialsOf,
    normalize: normalize,
    ZH_CHARS: Object.keys(ZH),
    nearest: nearest,
    add: add,
    remove: remove,
    hasCoords: hasCoords
  };
})(window.OP);
