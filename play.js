(() => {
  "use strict";

  /* ================= 譜面 ================= */
  // [時間(秒), 軌道(0-3), 是否雙押]
  const RAW = [{"t":0.25,"lane":6,"chord":false},{"t":0.5,"lane":6,"chord":false},{"t":1,"lane":5,"chord":false},{"t":1.5,"lane":4,"chord":false},{"t":2,"lane":3,"chord":false},{"t":2.5,"lane":4,"chord":false},{"t":3,"lane":3,"chord":false},{"t":3.5,"lane":4,"chord":false},{"t":4,"lane":5,"chord":false},{"t":4.5,"lane":4,"chord":false},{"t":5,"lane":3,"chord":false},{"t":5.5,"lane":4,"chord":false},{"t":6,"lane":3,"chord":false},{"t":6.25,"lane":5,"chord":false},{"t":6.5,"lane":6,"chord":false},{"t":6.75,"lane":7,"chord":false},{"t":7,"lane":6,"chord":false},{"t":7.5,"lane":5,"chord":false},{"t":7.75,"lane":4,"chord":false},{"t":8,"lane":4,"chord":false},{"t":8.5,"lane":3,"chord":false},{"t":8.75,"lane":2,"chord":false},{"t":9,"lane":1,"chord":false},{"t":9.25,"lane":0,"chord":false},{"t":9.5,"lane":1,"chord":false},{"t":10,"lane":4,"chord":false},{"t":10.5,"lane":5,"chord":false},{"t":11,"lane":4,"chord":false},{"t":11.5,"lane":3,"chord":false},{"t":12,"lane":4,"chord":false},{"t":12.5,"lane":3,"chord":false},{"t":13,"lane":2,"chord":false},{"t":13.5,"lane":1,"chord":false},{"t":14,"lane":4,"chord":false},{"t":14.5,"lane":4,"chord":false},{"t":15,"lane":3,"chord":false},{"t":15.25,"lane":2,"chord":false},{"t":15.5,"lane":1,"chord":false},{"t":16,"lane":3,"chord":false},{"t":16,"lane":4,"chord":false},{"t":16.25,"lane":4,"chord":false},{"t":16.5,"lane":5,"chord":false},{"t":16.75,"lane":6,"chord":false},{"t":17,"lane":7,"chord":false},{"t":17.25,"lane":6,"chord":false},{"t":17.5,"lane":5,"chord":false},{"t":17.75,"lane":4,"chord":false},{"t":18,"lane":4,"chord":false},{"t":18.25,"lane":3,"chord":false},{"t":18.5,"lane":1,"chord":false},{"t":18.75,"lane":0,"chord":false},{"t":19,"lane":1,"chord":false},{"t":19.25,"lane":2,"chord":false},{"t":19.5,"lane":3,"chord":false},{"t":19.75,"lane":4,"chord":false},{"t":19.875,"lane":5,"chord":false},{"t":20,"lane":0,"chord":false},{"t":20,"lane":7,"chord":false},{"t":20.25,"lane":6,"chord":false},{"t":20.5,"lane":5,"chord":false},{"t":20.75,"lane":4,"chord":false},{"t":21,"lane":3,"chord":false},{"t":21.25,"lane":2,"chord":false},{"t":21.5,"lane":0,"chord":false},{"t":21.75,"lane":1,"chord":false},{"t":22,"lane":4,"chord":false},{"t":22.25,"lane":5,"chord":false},{"t":22.5,"lane":6,"chord":false},{"t":22.75,"lane":7,"chord":false},{"t":23,"lane":6,"chord":false},{"t":23.25,"lane":5,"chord":false},{"t":23.5,"lane":4,"chord":false},{"t":24,"lane":2,"chord":false},{"t":24,"lane":6,"chord":false},{"t":24.25,"lane":5,"chord":false},{"t":24.5,"lane":4,"chord":false},{"t":25,"lane":3,"chord":false},{"t":25.25,"lane":2,"chord":false},{"t":25.5,"lane":1,"chord":false},{"t":25.625,"lane":0,"chord":false},{"t":25.75,"lane":1,"chord":false},{"t":26,"lane":4,"chord":false},{"t":26.25,"lane":5,"chord":false},{"t":26.5,"lane":5,"chord":false},{"t":26.625,"lane":7,"chord":false},{"t":27,"lane":6,"chord":false},{"t":27.25,"lane":4,"chord":false},{"t":27.5,"lane":3,"chord":false},{"t":27.75,"lane":2,"chord":false},{"t":28,"lane":3,"chord":false},{"t":28,"lane":4,"chord":false},{"t":28.25,"lane":2,"chord":false},{"t":28.5,"lane":1,"chord":false},{"t":28.75,"lane":0,"chord":false},{"t":29,"lane":1,"chord":false},{"t":29.25,"lane":2,"chord":false},{"t":29.5,"lane":3,"chord":false},{"t":29.75,"lane":4,"chord":false},{"t":30,"lane":3,"chord":false},{"t":30.25,"lane":4,"chord":false},{"t":30.5,"lane":5,"chord":false},{"t":30.75,"lane":6,"chord":false},{"t":31,"lane":7,"chord":false},{"t":31.25,"lane":6,"chord":false},{"t":31.5,"lane":5,"chord":false},{"t":31.75,"lane":4,"chord":false},{"t":32,"lane":3,"chord":false},{"t":32,"lane":4,"chord":false},{"t":32.25,"lane":3,"chord":false},{"t":32.5,"lane":2,"chord":false},{"t":32.625,"lane":0,"chord":false},{"t":32.75,"lane":0,"chord":false},{"t":33,"lane":1,"chord":false},{"t":33.25,"lane":2,"chord":false},{"t":33.5,"lane":3,"chord":false},{"t":34,"lane":1,"chord":false},{"t":34.25,"lane":2,"chord":false},{"t":34.5,"lane":4,"chord":false},{"t":35,"lane":3,"chord":false},{"t":35.25,"lane":2,"chord":false},{"t":35.5,"lane":1,"chord":false},{"t":36,"lane":2,"chord":false},{"t":36,"lane":4,"chord":false},{"t":36.25,"lane":4,"chord":false},{"t":36.5,"lane":5,"chord":false},{"t":37,"lane":4,"chord":false},{"t":37.25,"lane":3,"chord":false},{"t":37.5,"lane":2,"chord":false},{"t":37.75,"lane":1,"chord":false},{"t":38,"lane":3,"chord":false},{"t":38.25,"lane":3,"chord":false},{"t":38.5,"lane":4,"chord":false},{"t":39,"lane":3,"chord":false},{"t":39.25,"lane":2,"chord":false},{"t":39.5,"lane":1,"chord":false},{"t":40,"lane":3,"chord":false},{"t":40,"lane":4,"chord":false},{"t":40.25,"lane":4,"chord":false},{"t":40.5,"lane":5,"chord":false},{"t":41,"lane":6,"chord":false},{"t":41.25,"lane":7,"chord":false},{"t":41.5,"lane":6,"chord":false},{"t":41.75,"lane":5,"chord":false},{"t":42,"lane":3,"chord":false},{"t":42.25,"lane":2,"chord":false},{"t":42.5,"lane":1,"chord":false},{"t":43,"lane":0,"chord":false},{"t":43.25,"lane":1,"chord":false},{"t":43.5,"lane":2,"chord":false},{"t":44,"lane":2,"chord":false},{"t":44,"lane":5,"chord":false},{"t":44.25,"lane":3,"chord":false},{"t":44.5,"lane":4,"chord":false},{"t":44.625,"lane":5,"chord":false},{"t":44.875,"lane":5,"chord":false},{"t":45,"lane":6,"chord":false},{"t":45.125,"lane":7,"chord":false},{"t":45.25,"lane":6,"chord":false},{"t":45.375,"lane":5,"chord":false},{"t":45.5,"lane":4,"chord":false},{"t":45.75,"lane":3,"chord":false},{"t":46,"lane":4,"chord":false},{"t":46.25,"lane":3,"chord":false},{"t":46.5,"lane":1,"chord":false},{"t":46.75,"lane":0,"chord":false},{"t":47,"lane":1,"chord":false},{"t":47.25,"lane":2,"chord":false},{"t":47.5,"lane":3,"chord":false},{"t":47.875,"lane":4,"chord":false},{"t":48,"lane":2,"chord":false},{"t":48,"lane":5,"chord":false},{"t":48.25,"lane":6,"chord":false},{"t":48.375,"lane":7,"chord":false},{"t":48.5,"lane":6,"chord":false},{"t":48.625,"lane":5,"chord":false},{"t":48.875,"lane":4,"chord":false},{"t":49,"lane":3,"chord":false},{"t":49.125,"lane":2,"chord":false},{"t":49.25,"lane":0,"chord":false},{"t":49.5,"lane":1,"chord":false},{"t":50,"lane":4,"chord":false},{"t":50.5,"lane":5,"chord":false},{"t":50.75,"lane":6,"chord":false},{"t":51,"lane":7,"chord":false},{"t":51.5,"lane":6,"chord":false},{"t":52,"lane":4,"chord":false},{"t":52.5,"lane":4,"chord":false},{"t":53,"lane":3,"chord":false},{"t":53.25,"lane":2,"chord":false},{"t":53.5,"lane":1,"chord":false},{"t":53.625,"lane":0,"chord":false},{"t":54,"lane":2,"chord":false},{"t":54.25,"lane":3,"chord":false},{"t":54.5,"lane":4,"chord":false},{"t":54.625,"lane":5,"chord":false},{"t":54.75,"lane":7,"chord":false},{"t":54.875,"lane":7,"chord":false},{"t":55,"lane":6,"chord":false},{"t":55.25,"lane":5,"chord":false},{"t":55.5,"lane":4,"chord":false},{"t":56,"lane":3,"chord":false},{"t":56,"lane":5,"chord":false},{"t":56.25,"lane":4,"chord":false},{"t":56.5,"lane":5,"chord":false},{"t":56.625,"lane":6,"chord":false},{"t":56.75,"lane":7,"chord":false},{"t":57,"lane":7,"chord":false},{"t":57.25,"lane":7,"chord":false},{"t":57.5,"lane":6,"chord":false},{"t":58,"lane":3,"chord":false},{"t":58.25,"lane":2,"chord":false},{"t":58.5,"lane":1,"chord":false},{"t":58.625,"lane":0,"chord":false},{"t":58.75,"lane":0,"chord":false},{"t":59,"lane":0,"chord":false},{"t":59.0833,"lane":1,"chord":false},{"t":59.1667,"lane":0,"chord":false},{"t":59.25,"lane":1,"chord":false},{"t":59.3333,"lane":0,"chord":false},{"t":59.4167,"lane":1,"chord":false},{"t":59.5,"lane":0,"chord":false},{"t":60,"lane":3,"chord":false},{"t":60,"lane":4,"chord":false},{"t":60.25,"lane":4,"chord":false},{"t":60.5,"lane":5,"chord":false},{"t":60.625,"lane":6,"chord":false},{"t":61,"lane":7,"chord":false},{"t":61.25,"lane":6,"chord":false},{"t":61.5,"lane":5,"chord":false},{"t":61.75,"lane":4,"chord":false},{"t":62,"lane":3,"chord":false},{"t":62.25,"lane":4,"chord":false},{"t":62.5,"lane":5,"chord":false},{"t":62.625,"lane":6,"chord":false},{"t":63,"lane":7,"chord":false},{"t":63.125,"lane":6,"chord":false},{"t":63.25,"lane":5,"chord":false},{"t":63.5,"lane":4,"chord":false},{"t":64,"lane":3,"chord":false},{"t":64,"lane":4,"chord":false},{"t":64.25,"lane":4,"chord":false},{"t":64.5,"lane":5,"chord":false},{"t":64.625,"lane":6,"chord":false},{"t":65,"lane":6,"chord":false},{"t":65.25,"lane":7,"chord":false},{"t":65.5,"lane":7,"chord":false},{"t":65.625,"lane":6,"chord":false},{"t":65.75,"lane":5,"chord":false},{"t":66,"lane":4,"chord":false},{"t":66.25,"lane":6,"chord":false},{"t":66.5,"lane":7,"chord":false},{"t":66.625,"lane":7,"chord":false},{"t":67,"lane":7,"chord":false},{"t":67.0833,"lane":6,"chord":false},{"t":67.1667,"lane":7,"chord":false},{"t":67.25,"lane":6,"chord":false},{"t":67.3333,"lane":7,"chord":false},{"t":67.4167,"lane":6,"chord":false},{"t":67.5,"lane":7,"chord":false},{"t":68,"lane":2,"chord":false},{"t":68,"lane":5,"chord":false},{"t":68.25,"lane":4,"chord":false},{"t":68.375,"lane":3,"chord":false},{"t":68.5,"lane":1,"chord":false},{"t":68.625,"lane":0,"chord":false},{"t":69,"lane":1,"chord":false},{"t":69.25,"lane":2,"chord":false},{"t":69.5,"lane":3,"chord":false},{"t":69.625,"lane":4,"chord":false},{"t":69.75,"lane":5,"chord":false},{"t":70,"lane":4,"chord":false},{"t":70.25,"lane":5,"chord":false},{"t":70.5,"lane":5,"chord":false},{"t":70.625,"lane":6,"chord":false},{"t":71,"lane":7,"chord":false},{"t":71.25,"lane":6,"chord":false},{"t":71.5,"lane":5,"chord":false},{"t":72,"lane":3,"chord":false},{"t":72,"lane":4,"chord":false},{"t":72.25,"lane":5,"chord":false},{"t":72.5,"lane":6,"chord":false},{"t":72.625,"lane":7,"chord":false},{"t":73,"lane":6,"chord":false},{"t":73.25,"lane":5,"chord":false},{"t":73.5,"lane":4,"chord":false},{"t":74,"lane":3,"chord":false},{"t":74.25,"lane":4,"chord":false},{"t":74.5,"lane":5,"chord":false},{"t":74.625,"lane":6,"chord":false},{"t":75,"lane":6,"chord":false},{"t":75.0833,"lane":5,"chord":false},{"t":75.1667,"lane":6,"chord":false},{"t":75.25,"lane":5,"chord":false},{"t":75.3333,"lane":6,"chord":false},{"t":75.4167,"lane":5,"chord":false},{"t":75.5,"lane":6,"chord":false},{"t":76,"lane":3,"chord":false},{"t":76,"lane":5,"chord":false},{"t":76.25,"lane":2,"chord":false},{"t":76.5,"lane":1,"chord":false},{"t":76.625,"lane":0,"chord":false},{"t":77,"lane":0,"chord":false},{"t":77.125,"lane":0,"chord":false},{"t":77.25,"lane":1,"chord":false},{"t":77.5,"lane":2,"chord":false},{"t":78,"lane":2,"chord":false},{"t":78.5,"lane":1,"chord":false},{"t":79,"lane":0,"chord":false},{"t":79.5,"lane":0,"chord":false},{"t":80,"lane":2,"chord":false},{"t":80,"lane":5,"chord":false},{"t":80.25,"lane":3,"chord":false},{"t":80.5,"lane":4,"chord":false},{"t":80.625,"lane":5,"chord":false},{"t":80.75,"lane":6,"chord":false},{"t":80.875,"lane":7,"chord":false},{"t":81,"lane":6,"chord":false},{"t":81.125,"lane":5,"chord":false},{"t":81.25,"lane":4,"chord":false},{"t":81.5,"lane":3,"chord":false},{"t":81.625,"lane":2,"chord":false},{"t":82,"lane":4,"chord":false},{"t":82.25,"lane":4,"chord":false},{"t":82.5,"lane":5,"chord":false},{"t":83,"lane":6,"chord":false},{"t":83.25,"lane":7,"chord":false},{"t":83.5,"lane":6,"chord":false},{"t":84,"lane":3,"chord":false},{"t":84,"lane":4,"chord":false},{"t":84.25,"lane":2,"chord":false},{"t":84.5,"lane":1,"chord":false},{"t":84.75,"lane":0,"chord":false},{"t":85,"lane":1,"chord":false},{"t":85.25,"lane":2,"chord":false},{"t":85.5,"lane":3,"chord":false},{"t":86,"lane":4,"chord":false},{"t":86.25,"lane":2,"chord":false},{"t":86.5,"lane":1,"chord":false},{"t":87,"lane":0,"chord":false},{"t":87.25,"lane":1,"chord":false},{"t":87.5,"lane":2,"chord":false},{"t":87.75,"lane":3,"chord":false},{"t":88,"lane":3,"chord":false},{"t":88,"lane":4,"chord":false},{"t":88.25,"lane":2,"chord":false},{"t":88.5,"lane":1,"chord":false},{"t":89,"lane":2,"chord":false},{"t":89.25,"lane":3,"chord":false},{"t":89.5,"lane":4,"chord":false},{"t":89.875,"lane":5,"chord":false},{"t":90,"lane":6,"chord":false},{"t":90.25,"lane":7,"chord":false},{"t":90.5,"lane":6,"chord":false},{"t":91,"lane":4,"chord":false},{"t":91.25,"lane":3,"chord":false},{"t":91.5,"lane":2,"chord":false},{"t":92,"lane":3,"chord":false},{"t":92,"lane":5,"chord":false},{"t":92.25,"lane":2,"chord":false},{"t":92.5,"lane":1,"chord":false},{"t":93,"lane":2,"chord":false},{"t":93.25,"lane":3,"chord":false},{"t":93.5,"lane":4,"chord":false},{"t":94,"lane":4,"chord":false},{"t":94.25,"lane":5,"chord":false},{"t":94.5,"lane":6,"chord":false},{"t":95,"lane":7,"chord":false},{"t":95.25,"lane":6,"chord":false},{"t":95.5,"lane":5,"chord":false},{"t":96,"lane":3,"chord":false},{"t":96,"lane":4,"chord":false},{"t":96.25,"lane":2,"chord":false},{"t":96.5,"lane":1,"chord":false},{"t":97,"lane":0,"chord":false},{"t":97.25,"lane":1,"chord":false},{"t":97.5,"lane":3,"chord":false},{"t":97.75,"lane":4,"chord":false},{"t":98,"lane":5,"chord":false},{"t":98.25,"lane":3,"chord":false},{"t":98.5,"lane":2,"chord":false},{"t":98.75,"lane":1,"chord":false},{"t":99,"lane":0,"chord":false},{"t":99.5,"lane":1,"chord":false},{"t":100,"lane":2,"chord":false},{"t":100.5,"lane":3,"chord":false},{"t":101,"lane":4,"chord":false},{"t":101.5,"lane":3,"chord":false},{"t":102,"lane":4,"chord":false},{"t":102.5,"lane":3,"chord":false},{"t":103,"lane":4,"chord":false},{"t":103.25,"lane":5,"chord":false},{"t":103.5,"lane":6,"chord":false},{"t":103.75,"lane":7,"chord":false},{"t":104,"lane":4,"chord":false},{"t":104.25,"lane":3,"chord":false},{"t":104.5,"lane":2,"chord":false},{"t":105,"lane":3,"chord":false},{"t":105.25,"lane":4,"chord":false},{"t":105.5,"lane":5,"chord":false},{"t":106,"lane":4,"chord":false},{"t":106.5,"lane":3,"chord":false},{"t":107,"lane":4,"chord":false},{"t":107.25,"lane":5,"chord":false}];

  const NOTES = [];
  for (const { t, lane, chord, hold } of RAW) {
    NOTES.push({ t, lane, holdEnd: hold || null });
    if (chord) NOTES.push({ t, lane: (lane + 1) % 8, holdEnd: hold || null });
  }
  NOTES.sort((a, b) => a.t - b.t);
  const HAS_NOTES = NOTES.length > 0;
  const FIRST_T = HAS_NOTES ? NOTES[0].t : 0;
  const LAST_T = HAS_NOTES ? Math.max(...NOTES.map(n => n.holdEnd || n.t)) : 0;

  /* ================= 設定 ================= */
  const KEYS = { KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3, KeyJ: 4, KeyK: 5, KeyL: 6, Semicolon: 7 };
  const PERFECT_WIN = 0.050;   // 秒
  const GOOD_WIN = 0.120;
  const MISS_WIN = 0.150;
    const PREROLL_MARGIN = 0.25;   // 預滾：首音符在頂部上方出現的額外距離（秒）
  const LEAD = 2.2;            // 音符提前出現秒數
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 可調配置：延遲(毫秒) 與流速(0-10 級)，記憶於瀏覽器 */
  function clampNum(raw, min, max, def) {
    if (raw === null || raw === undefined || raw === "") return def;
    const v = Number(raw);
    if (!Number.isFinite(v)) return def;
    return Math.max(min, Math.min(max, v));
  }
  let SYNC = clampNum(localStorage.getItem("rgs.offset"), -200, 200, 0);
  // 流速等級 0-10 → 150~3000 px/s；舊版存的是 px/s，自動換算成等級
  const SPEED_PER_LEVEL = 285;
  let speedLevel = 2;
  {
    const rawSpeed = localStorage.getItem("rgs.speed");
    const v = Number(rawSpeed);
    if (Number.isFinite(v) && rawSpeed !== null && rawSpeed !== "") {
      speedLevel = v > 10 ? Math.round((v - 150) / 85) : v;
    }
    speedLevel = Math.max(0, Math.min(10, speedLevel));
  }
  let SPEED = 150 + speedLevel * SPEED_PER_LEVEL;

  /* ================= 排行榜（Supabase） ================= */
  // 填入你的 Supabase 專案：Project URL 與 anon public key
  const SUPA_URL = "https://gonbwxbvzeupncjmtwdr.supabase.co";
  const SUPA_KEY = "sb_publishable_ZzXvb2vMnMmRbV4UTUY0ZQ_cvcbUdot";

  /* ================= DOM ================= */
  const $ = (id) => document.getElementById(id);
  const stage = $("stage");
  const noteLayer = $("noteLayer");
  const fxLayer = $("fxLayer");
  const lanesEl = [...document.querySelectorAll(".lane")];
  const audio = $("music");
  const startOverlay = $("startOverlay");
  const pauseOverlay = $("pauseOverlay");
  const resultOverlay = $("resultOverlay");
  const scoreEl = $("score");
  const accEl = $("acc");
  const comboEl = $("combo");
  const progressEl = $("progress");
  const offsetInput = $("setOffset");
  const speedInput = $("setSpeed");
  const offsetVal = $("offsetVal");
  const speedVal = $("speedVal");
  const sideOffsetInput = $("sideOffset");
  const sideSpeedInput = $("sideSpeed");
  const sideOffsetVal = $("sideOffsetVal");
  const sideSpeedVal = $("sideSpeedVal");
  const lbList = $("leaderboard");
  const lbNote = $("lbNote");
  const lbRefresh = $("lbRefresh");
  const nameInput = $("nameInput");
  const submitBtn = $("submitScoreBtn");
  const submitStatus = $("submitStatus");

  const countdownEl = document.createElement("div");
  countdownEl.className = "countdown";
  stage.appendChild(countdownEl);

  /* ================= 設置 ================= */
  function saveSettings() {
    try {
      localStorage.setItem("rgs.offset", String(SYNC));
      localStorage.setItem("rgs.speed", String(speedLevel));
    } catch (e) {}
  }

  function paintSettings() {
    offsetInput.value = SYNC;
    sideOffsetInput.value = SYNC;
    speedInput.value = speedLevel;
    sideSpeedInput.value = speedLevel;
    const offText = (SYNC > 0 ? "+" : "") + SYNC + "ms";
    offsetVal.textContent = offText;
    sideOffsetVal.textContent = offText;
    speedVal.textContent = speedLevel;
    sideSpeedVal.textContent = speedLevel;
  }

  function syncOffsetFrom(el) {
    SYNC = clampNum(el.value, -200, 200, 0);
    paintSettings();
    saveSettings();
  }

  function syncSpeedFrom(el) {
    speedLevel = clampNum(el.value, 0, 10, 2);
    SPEED = 150 + speedLevel * SPEED_PER_LEVEL;
    paintSettings();
    saveSettings();
  }

  offsetInput.addEventListener("input", () => syncOffsetFrom(offsetInput));
  sideOffsetInput.addEventListener("input", () => syncOffsetFrom(sideOffsetInput));
  speedInput.addEventListener("input", () => syncSpeedFrom(speedInput));
  sideSpeedInput.addEventListener("input", () => syncSpeedFrom(sideSpeedInput));
  paintSettings();

  /* ================= 狀態 ================= */
  let state = "idle";          // idle | playing | paused | done
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let counts = { perfect: 0, good: 0, miss: 0 };
  let notes = [];
  let nextIdx = 0;
  let clockOffset = 0;       // 遊戲時間偏移（預滾階段逐步推進）
  let prerolling = false;    // 音樂開始前的靜音滾入階段
  let prerollStartT = 0;     // 預滾起始偏移
  let prerollStartAt = 0;    // 預滾起始時間戳
  let rafId = 0;
  let audioCtx = null;

  /* ================= 背景星塵 ================= */
  const bg = document.getElementById("bg");
  if (bg && !reduceMotion) {
    const ctx = bg.getContext("2d");
    const COLORS = ["#37e6f5", "#8b7cf6", "#f472e0", "#ffe066"];
    let w = 0, h = 0, stars = [];
    function resize() {
      w = bg.width = window.innerWidth;
      h = bg.height = window.innerHeight;
    }
    function spawn(init) {
      return {
        x: Math.random() * w,
        y: init ? Math.random() * h : -20,
        r: 1 + Math.random() * 2.4,
        vy: 0.2 + Math.random() * 0.5,
        color: COLORS[(Math.random() * COLORS.length) | 0]
      };
    }
    resize();
    stars = Array.from({ length: Math.min(26, Math.max(14, Math.floor(w / 60))) }, () => spawn(true));
    (function draw() {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.y += s.vy;
        if (s.y > h + 20) Object.assign(s, spawn(false));
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    })();
    window.addEventListener("resize", resize);
  }

  /* ================= 工具 ================= */
  function lineY() {
    return stage.clientHeight * 0.88;
  }

  function gameT() {
    return clockOffset + (prerolling ? 0 : audio.currentTime) + SYNC / 1000;
  }

  function resetGame() {
    score = 0;
    combo = 0;
    maxCombo = 0;
    counts = { perfect: 0, good: 0, miss: 0 };
    notes = [];
    nextIdx = 0;
    noteLayer.innerHTML = "";
    fxLayer.innerHTML = "";
    scoreEl.textContent = "0";
    accEl.textContent = "100.0%";
    comboEl.textContent = "0";
    comboEl.classList.remove("bump");
    progressEl.style.width = "0%";
    startOverlay.classList.add("hidden");
    resultOverlay.classList.add("hidden");
    pauseOverlay.classList.add("hidden");
  }

  function startGame() {
    resetGame();
    audio.pause();
    audio.volume = 0;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    // 預滾起點：讓首音符從頂部上方滾入，音樂在首拍前才響起
    clockOffset = FIRST_T - lineY() / SPEED - PREROLL_MARGIN;
    if (clockOffset > -0.15) clockOffset = -0.15; // 至少保留一小段滾入時間
    prerollStartT = clockOffset;
    state = "countdown";
    runCountdown(() => {
      setTimeout(() => {
        // 倒數結束：音樂先暫停，進入靜音滾入階段，讓首音符從頂部出現
        audio.pause();
        audio.currentTime = 0;
        prerolling = true;
        prerollStartAt = performance.now();
        state = "playing";
        rafId = requestAnimationFrame(tick);
      }, 500);
    });
  }

  /* ================= 倒數 ================= */
  function runCountdown(onDone) {
    let i = 3;
    const step = () => {
      if (i > 0) {
        showCount(String(i));
        i--;
        setTimeout(step, 500);
      } else {
        showCount("GO");
        setTimeout(() => {
          if (onDone) onDone();
        }, 480);
      }
    };
    step();
  }

  function showCount(text) {
    countdownEl.textContent = text;
    countdownEl.animate(
      [
        { opacity: 0, transform: "translate(-50%, -50%) scale(1.25)" },
        { opacity: 1, transform: "translate(-50%, -50%) scale(1)", offset: 0.25 },
        { opacity: 1, transform: "translate(-50%, -50%) scale(1)", offset: 0.8 },
        { opacity: 0, transform: "translate(-50%, -50%) scale(1.08)" }
      ],
      { duration: 480, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
    );
  }

  /* ================= 主迴圈 ================= */
  function tick() {
    if (state !== "playing") return;
    if (prerolling) {
      clockOffset = prerollStartT + (performance.now() - prerollStartAt) / 1000;
      if (clockOffset >= 0) {
        prerolling = false;
        clockOffset = 0;
        audio.currentTime = 0;
        audio.volume = 1;
        audio.play().catch(() => {});
      }
    }
    const t = gameT();

    while (nextIdx < NOTES.length && NOTES[nextIdx].t - t < LEAD) {
      spawnNote(NOTES[nextIdx]);
      nextIdx++;
    }

    const ly = lineY();
    for (const n of notes) {
      if (n.judged) continue;
      n.el.style.transform = "translateY(" + (ly - n.h / 2 - (n.t - t) * SPEED).toFixed(1) + "px)";
      if (t > n.t && !n.holding) n.el.classList.add("passed");
      if (n.holdEnd) {
        if (n.holding && t >= n.holdEnd) completeHold(n);
        else if (!n.holding && t > n.holdEnd + MISS_WIN) missNote(n);
      } else if (t > n.t + MISS_WIN) {
        missNote(n);
      }
    }

    updateHud(t);

    const endT = HAS_NOTES ? LAST_T + 2.2 : audio.duration - 0.3;
    if (t >= endT || audio.ended) {
      finish();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  const HEAD_H = window.innerWidth <= 600 ? 26 : 34;

  function spawnNote(n) {
    const el = document.createElement("div");
    el.className = "note n" + n.lane + (n.holdEnd ? " hold" : "");
    el.style.left = (n.lane * 12.5 + 1.25).toFixed(2) + "%";
    if (n.holdEnd) {
      el.style.height = ((n.holdEnd - n.t) * SPEED + HEAD_H).toFixed(1) + "px";
    }
    noteLayer.appendChild(el);
    notes.push({
      t: n.t,
      lane: n.lane,
      holdEnd: n.holdEnd || null,
      el,
      h: n.holdEnd ? HEAD_H : (el.offsetHeight || 34),
      judged: false,
      holding: false,
      headKind: null,
      headScore: 0
    });
  }

  /* ================= 判定 ================= */
  function pressLane(lane) {
    if (state !== "playing" || prerolling) return;
    flashLane(lane);
    const t = gameT();
    let best = null;
    let bestD = Infinity;
    for (const n of notes) {
      if (n.judged || n.holding || n.lane !== lane) continue;
      const d = Math.abs(n.t - t);
      if (d <= GOOD_WIN && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    if (best) {
      if (best.holdEnd) hitHoldHead(best, bestD);
      else hitNote(best, bestD);
    }
  }

  function hitNote(n, d) {
    n.judged = true;
    const kind = d <= PERFECT_WIN ? "perfect" : "good";
    counts[kind]++;
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    score += kind === "perfect" ? 300 : 100;

    comboEl.textContent = combo;
    comboEl.classList.remove("bump");
    void comboEl.offsetWidth;
    comboEl.classList.add("bump");
    setTimeout(() => comboEl.classList.remove("bump"), 150);

    showJudgeText(kind);
    showBurst(n, kind);
    flashJudgeLine();
    playTick(kind);
    n.el.remove();
  }

  function missNote(n) {
    n.judged = true;
    counts.miss++;
    combo = 0;
    comboEl.textContent = "0";
    comboEl.classList.remove("bump");
    showJudgeText("miss", n.lane);
    showBurst(n, "miss");
    n.el.style.opacity = "0";
    setTimeout(() => n.el.remove(), 260);
  }

  /* ---------- Hold 長條音符 ---------- */
  function hitHoldHead(n, d) {
    const kind = d <= PERFECT_WIN ? "perfect" : "good";
    n.headKind = kind;
    n.headScore = kind === "perfect" ? 300 : 100;
    counts[kind]++;
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    score += n.headScore;
    n.holding = true;

    comboEl.textContent = combo;
    comboEl.classList.remove("bump");
    void comboEl.offsetWidth;
    comboEl.classList.add("bump");
    setTimeout(() => comboEl.classList.remove("bump"), 150);

    showJudgeText(kind);
    showBurst(n, kind);
    flashJudgeLine();
    playTick(kind);
    n.el.classList.add("holding");
  }

  function completeHold(n) {
    n.judged = true;
    n.el.remove();
  }

  function breakHold(n) {
    n.judged = true;
    if (n.headKind) counts[n.headKind]--;
    score = Math.max(0, score - n.headScore);
    counts.miss++;
    combo = 0;
    comboEl.textContent = "0";
    comboEl.classList.remove("bump");
    showJudgeText("miss", n.lane);
    showBurst(n, "miss");
    n.el.classList.add("broken");
    setTimeout(() => n.el.remove(), 240);
  }

  function releaseLane(lane) {
    if (state !== "playing" || prerolling) return;
    const t = gameT();
    for (const n of notes) {
      if (n.judged || !n.holding || n.lane !== lane) continue;
      if (t < n.holdEnd - 0.08) breakHold(n);
      else completeHold(n);
    }
  }

  function flashJudgeLine() {
    const line = document.querySelector(".judge-line");
    line.classList.add("hit");
    clearTimeout(line._ht);
    line._ht = setTimeout(() => line.classList.remove("hit"), 140);
  }

  function flashLane(lane) {
    const el = lanesEl[lane];
    el.classList.add("flash");
    clearTimeout(el._ft);
    el._ft = setTimeout(() => el.classList.remove("flash"), 140);
    el.classList.add("press");
    clearTimeout(el._pt);
    el._pt = setTimeout(() => el.classList.remove("press"), 120);
  }

  function showJudgeText(kind, lane) {
    const el = document.createElement("div");
    el.className = "judge-text " + kind;
    el.textContent = kind === "perfect" ? "PERFECT" : kind === "good" ? "GOOD" : "MISS";
    el.style.top = (lineY() - 64) + "px";
    el.style.left = lane !== undefined ? ((lane + 0.5) / 8 * 100) + "%" : "50%";
    fxLayer.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("show")));
    setTimeout(() => el.remove(), 320);
  }

  function showBurst(n, kind) {
    const el = document.createElement("div");
    el.className = "burst " + kind;
    el.style.top = lineY() + "px";
    el.style.left = ((n.lane + 0.5) / 8 * 100) + "%";
    fxLayer.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("show")));
    setTimeout(() => el.remove(), 240);
  }

  function updateHud(t) {
    const total = counts.perfect + counts.good + counts.miss;
    const acc = total ? (counts.perfect + counts.good * 0.6) / total * 100 : 100;
    accEl.textContent = acc.toFixed(1) + "%";
    scoreEl.textContent = score;
    const span = HAS_NOTES ? (LAST_T - FIRST_T) : audio.duration;
    const p = span > 0 ? Math.min(1, Math.max(0, (t - (HAS_NOTES ? FIRST_T : 0)) / span)) : 0;
    progressEl.style.width = (p * 100).toFixed(1) + "%";
  }

  /* ================= 結束 ================= */
  function finish() {
    state = "done";
    cancelAnimationFrame(rafId);
    // 不暫停音樂：讓完整版播到自然結束

    const total = counts.perfect + counts.good + counts.miss;
    const acc = total ? (counts.perfect + counts.good * 0.6) / total * 100 : 100;
    let rank = "D";
    if (acc >= 99.5) rank = "SS";
    else if (acc >= 95) rank = "S";
    else if (acc >= 90) rank = "A";
    else if (acc >= 80) rank = "B";
    else if (acc >= 70) rank = "C";

    $("rank").textContent = rank;
    $("finalScore").textContent = score;
    $("rPerfect").textContent = counts.perfect;
    $("rGood").textContent = counts.good;
    $("rMiss").textContent = counts.miss;
    $("rCombo").textContent = maxCombo;
    $("rAcc").textContent = acc.toFixed(1) + "%";
    lastAcc = acc;
    nameInput.value = (() => {
      try { return localStorage.getItem("rgs.name") || ""; } catch (e) { return ""; }
    })();
    submitStatus.textContent = "";
    submitStatus.className = "submit-status";
    if (HAS_NOTES) {
      submitBtn.disabled = false;
      nameInput.disabled = false;
    } else {
      submitBtn.disabled = true;
      nameInput.disabled = true;
      submitStatus.textContent = "空譜面不計入排行榜";
    }
    resultOverlay.classList.remove("hidden");
  }

  /* ================= 音效 ================= */
  function initAudioCtx() {
    if (audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }

  function playTick(kind) {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = kind === "perfect" ? 1320 : 880;
    g.gain.setValueAtTime(0.10, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.08);
  }

  /* ================= 排行榜 ================= */
  let lastAcc = 0;

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function loadLeaderboard() {
    if (!SUPA_URL || !SUPA_KEY) {
      lbList.innerHTML = '<li class="lb-empty">排行榜尚未連接</li>';
      lbNote.textContent = "在 play.js 填入 Supabase 密鑰後啟用";
      return;
    }
    lbNote.textContent = "載入中…";
    try {
      const res = await fetch(SUPA_URL + "/rest/v1/scores?select=name,score,acc,combo&order=score.desc&limit=10", {
        headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY }
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const rows = await res.json();
      if (!rows.length) {
        lbList.innerHTML = '<li class="lb-empty">暫無成績，來當第一名！</li>';
        lbNote.textContent = "";
        return;
      }
      lbList.innerHTML = rows.map((r, i) =>
        '<li class="lb-item' + (i < 3 ? " top" + (i + 1) : "") + '">' +
        '<span class="lb-rank">' + (i + 1) + "</span>" +
        '<span class="lb-name">' + escapeHtml(String(r.name || "玩家")) + "</span>" +
        '<span class="lb-score">' + r.score + "</span>" +
        "</li>"
      ).join("");
      lbNote.textContent = "榜首 ACC " + Math.round((rows[0].acc || 0) * 10) / 10 + "%";
    } catch (e) {
      lbList.innerHTML = '<li class="lb-empty">載入失敗</li>';
      lbNote.textContent = "請檢查網絡或密鑰設定";
    }
  }

  async function submitScore() {
    if (!SUPA_URL || !SUPA_KEY) {
      submitStatus.textContent = "排行榜尚未連接";
      submitStatus.className = "submit-status err";
      return;
    }
    const name = nameInput.value.trim().slice(0, 12) || "玩家";
    submitBtn.disabled = true;
    submitStatus.textContent = "提交中…";
    submitStatus.className = "submit-status";
    try {
      const res = await fetch(SUPA_URL + "/rest/v1/scores", {
        method: "POST",
        headers: {
          apikey: SUPA_KEY,
          Authorization: "Bearer " + SUPA_KEY,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({ name, score, acc: Math.round(lastAcc * 10) / 10, combo: maxCombo })
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      try {
        localStorage.setItem("rgs.name", name);
      } catch (e) {}
      submitStatus.textContent = "已上榜！";
      submitStatus.className = "submit-status ok";
      loadLeaderboard();
    } catch (e) {
      submitStatus.textContent = "提交失敗，請重試";
      submitStatus.className = "submit-status err";
    } finally {
      setTimeout(() => { submitBtn.disabled = false; }, 1500);
    }
  }

  /* ================= 暫停 ================= */
  function pauseGame() {
    if (state !== "playing") return;
    state = "paused";
    cancelAnimationFrame(rafId);
    audio.pause();
    pauseOverlay.classList.remove("hidden");
  }

  function resumeGame() {
    if (state !== "paused") return;
    pauseOverlay.classList.add("hidden");
    if (prerolling) {
      prerollStartT = clockOffset;
      prerollStartAt = performance.now();
    } else {
      audio.play().catch(() => {});
    }
    state = "playing";
    rafId = requestAnimationFrame(tick);
  }

  /* ================= 事件 ================= */
  $("startBtn").addEventListener("click", () => {
    initAudioCtx();
    startGame();
  });
  $("againBtn").addEventListener("click", () => {
    initAudioCtx();
    startGame();
  });
  $("resumeBtn").addEventListener("click", resumeGame);
  $("retryBtn").addEventListener("click", () => {
    initAudioCtx();
    startGame();
  });
  $("pauseBtn").addEventListener("click", pauseGame);
  $("restartBtn").addEventListener("click", () => {
    initAudioCtx();
    startGame();
  });

  let touchLane = null;
  lanesEl.forEach((el) => {
    el.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      touchLane = Number(el.dataset.lane);
      pressLane(touchLane);
    });
  });
  stage.addEventListener("pointerup", () => {
    if (touchLane !== null) releaseLane(touchLane);
    touchLane = null;
  });
  stage.addEventListener("pointercancel", () => {
    if (touchLane !== null) releaseLane(touchLane);
    touchLane = null;
  });

  window.addEventListener("keydown", (ev) => {
    if (ev.code === "Space" || ev.code === "Enter") {
      if (state === "idle" || state === "done") {
        ev.preventDefault();
        initAudioCtx();
        startGame();
      }
    }
    if (KEYS[ev.code] !== undefined) {
      ev.preventDefault();
      pressLane(KEYS[ev.code]);
    }
    if (ev.code === "Escape" || ev.code === "KeyP") {
      if (state === "playing") pauseGame();
      else if (state === "paused") resumeGame();
    }
  });

  window.addEventListener("keyup", (ev) => {
    if (KEYS[ev.code] !== undefined) releaseLane(KEYS[ev.code]);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing") pauseGame();
  });

  /* ================= 排行榜事件 ================= */
  lbRefresh.addEventListener("click", () => {
    lbRefresh.classList.add("spin");
    loadLeaderboard().finally(() => setTimeout(() => lbRefresh.classList.remove("spin"), 320));
  });
  submitBtn.addEventListener("click", submitScore);
  nameInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") submitScore();
  });
  loadLeaderboard();

  /* 空譜面提示 */
  const emptyNotice = $("emptyNotice");
  if (!HAS_NOTES && emptyNotice) {
    emptyNotice.classList.remove("hidden");
    $("startBtn").textContent = "♪ 試聽完整版";
  }

  /* ================= 隱藏菜單（Konami 密技） ================= */
  const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "KeyB", "KeyA"];
  let konamiIdx = 0;
  window.addEventListener("keydown", (ev) => {
    if (ev.code.indexOf("Arrow") === 0) ev.preventDefault();
    if (ev.code === KONAMI[konamiIdx]) {
      konamiIdx++;
      if (konamiIdx === KONAMI.length) {
        konamiIdx = 0;
        const toast = document.createElement("div");
        toast.className = "konami-toast show";
        toast.textContent = "♪ 隱藏菜單開啟";
        document.body.appendChild(toast);
        setTimeout(() => { location.href = "editor.html"; }, 650);
      }
    } else {
      konamiIdx = ev.code === KONAMI[0] ? 1 : 0;
    }
  });

})();
