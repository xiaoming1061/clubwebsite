/* Olympic Protocol — 课表与设置的默认值
 *
 * 楼栋不在这里：它单独放在 data/buildings.js，是真实校区数据，
 * 由「设置 → 校区楼栋 → 导出」出来的结果生成（见 tools/make-buildings.js）。
 *
 * 页面把三样东西分开存：
 *   楼栋  → localStorage 的 buildings 键
 *   课表  → courses 键
 *   设置  → settings 键
 * 所以换课表不会动到楼栋，改楼栋也不会动到课表。
 */

window.OP = window.OP || {};

window.OP.DEFAULT_DATA = {
  version: 1,

  /* 默认楼栋来自 data/buildings.js，要改请改那个文件 */
  campus: {
    name: window.OP.DEFAULT_BUILDINGS.name,
    buildings: window.OP.DEFAULT_BUILDINGS.buildings
  },

  /*
   * 课表默认是空的：它是每个人自己的东西，第一次打开时用课表截图导入，
   * 或者到「课表 → 新增课程」手动加。楼栋已经有默认值了，不用再导入。
   */
  courses: [],

  settings: {
    leadMinutes: 10,        // 上课前多少分钟播报一次
    bufferMinutes: 5,       // 到楼之后再留出的缓冲
    walkingSpeed: 75,       // 米/分钟
    detourFactor: 1.3,      // 直线距离 → 实际步行距离的折算系数
    climbFactor: 8,         // 1 米爬升折算成几米平路（Naismith 经验值）
    voiceEnabled: true,
    voiceRate: 1.0,
    voiceVolume: 1.0,
    voiceURI: "",
    termStart: "2026-09-01",
    simulate: null,         // { lat, lng } 手动指定的位置，便于在电脑上测试
    placesRadius: 800,
    placesMerge: true,      // 合并坐标几乎重合的点位
    placesEnglish: true,    // 地图取楼栋时优先用英文名，中文名存成别名
    mapMode: "schematic"    // schematic 简图 / osm 街道图 / cuhk 港中文地图
  }
};
