/* Olympic Protocal — 示例数据
 *
 * 这里的坐标是示例值，请用「设置 → 校区楼栋 → 用我的当前位置填入」改成你学校的真实坐标。
 * 课表同样可以直接在「课表」页里增删改，或导入导出的 JSON。
 */

window.OP = window.OP || {};

window.OP.DEFAULT_DATA = {
  version: 1,
  campus: {
    name: "示例校区",
    /*
     * 门禁/集合点之类的固定点位，会一起参与"最近楼栋"计算。
     */
    buildings: [
      { id: "A", name: "第一教学楼", alias: ["一教", "A楼", "教一"], lat: 31.2320, lng: 121.4710 },
      { id: "B", name: "第二教学楼", alias: ["二教", "B楼", "教二"], lat: 31.2315, lng: 121.4760 },
      { id: "C", name: "实验楼", alias: ["C楼", "机房"], lat: 31.2290, lng: 121.4745 },
      { id: "D", name: "图书馆", alias: ["馆"], lat: 31.2298, lng: 121.4700 },
      { id: "E", name: "体育馆", alias: ["操场", "体育场"], lat: 31.2268, lng: 121.4762 },
      { id: "F", name: "学生食堂", alias: ["食堂", "饭堂"], lat: 31.2302, lng: 121.4788 },
      { id: "G", name: "宿舍区", alias: ["宿舍", "寝室"], lat: 31.2338, lng: 121.4752 },
      { id: "H", name: "音乐厅", alias: ["礼堂"], lat: 31.2278, lng: 121.4712 }
    ]
  },

  courses: [
    { id: "c1",  name: "高等数学",   teacher: "张老师", buildingId: "A", room: "A301", weekdays: [1, 3], start: "08:00", end: "09:40", weeks: [1, 16] },
    { id: "c2",  name: "线性代数",   teacher: "孙老师", buildingId: "A", room: "A208", weekdays: [1],    start: "14:00", end: "15:40", weeks: [1, 16] },
    { id: "c3",  name: "大学英语",   teacher: "李老师", buildingId: "B", room: "B205", weekdays: [1, 4], start: "10:00", end: "11:40", weeks: [1, 16] },
    { id: "c4",  name: "数据结构",   teacher: "王老师", buildingId: "C", room: "C401", weekdays: [2, 5], start: "08:00", end: "09:40", weeks: [1, 16] },
    { id: "c5",  name: "大学物理",   teacher: "陈老师", buildingId: "A", room: "A102", weekdays: [2],    start: "14:00", end: "15:40", weeks: [1, 16] },
    { id: "c6",  name: "概率论",     teacher: "吴老师", buildingId: "A", room: "A305", weekdays: [3],    start: "10:00", end: "11:40", weeks: [1, 16] },
    { id: "c7",  name: "体育（羽毛球）", teacher: "刘老师", buildingId: "E", room: "主馆", weekdays: [3], start: "16:00", end: "17:30", weeks: [1, 16] },
    { id: "c8",  name: "算法实验",   teacher: "王老师", buildingId: "C", room: "C501", weekdays: [4],    start: "08:00", end: "09:40", weeks: [1, 16] },
    { id: "c9",  name: "音乐鉴赏",   teacher: "周老师", buildingId: "H", room: "音乐厅", weekdays: [4],   start: "14:00", end: "15:40", weeks: [1, 16] },
    { id: "c10", name: "软件工程",   teacher: "赵老师", buildingId: "C", room: "C302", weekdays: [5],    start: "14:00", end: "15:40", weeks: [1, 16] }
  ],

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
