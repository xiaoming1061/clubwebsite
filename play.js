(() => {
  "use strict";

  /* ================= 譜面 ================= */
  // [時間(秒), 軌道(0-3), 是否雙押]
  const RAW = [{"t":16.684,"lane":2,"chord":false},{"t":17.02,"lane":3,"chord":false},{"t":17.357,"lane":0,"chord":false},{"t":17.694,"lane":1,"chord":false},{"t":18.019,"lane":2,"chord":false},{"t":18.355,"lane":3,"chord":false},{"t":22.117,"lane":2,"chord":false},{"t":22.686,"lane":0,"chord":false},{"t":23.023,"lane":1,"chord":false},{"t":23.359,"lane":2,"chord":false},{"t":23.684,"lane":3,"chord":false},{"t":24.184,"lane":0,"chord":false},{"t":24.52,"lane":1,"chord":false},{"t":24.857,"lane":2,"chord":false},{"t":25.182,"lane":3,"chord":false},{"t":25.519,"lane":0,"chord":false},{"t":25.855,"lane":1,"chord":false},{"t":26.192,"lane":2,"chord":false},{"t":26.691,"lane":3,"chord":false},{"t":27.191,"lane":0,"chord":false},{"t":27.516,"lane":1,"chord":false},{"t":28.026,"lane":2,"chord":false},{"t":28.363,"lane":3,"chord":false},{"t":28.688,"lane":0,"chord":false},{"t":29.025,"lane":1,"chord":false},{"t":29.362,"lane":2,"chord":false},{"t":29.687,"lane":3,"chord":false},{"t":30.023,"lane":0,"chord":false},{"t":30.36,"lane":1,"chord":false},{"t":30.859,"lane":2,"chord":false},{"t":31.184,"lane":3,"chord":false},{"t":31.521,"lane":0,"chord":false},{"t":32.02,"lane":1,"chord":false},{"t":32.357,"lane":2,"chord":false},{"t":32.694,"lane":3,"chord":false},{"t":33.019,"lane":0,"chord":false},{"t":33.518,"lane":1,"chord":false},{"t":33.855,"lane":2,"chord":false},{"t":34.191,"lane":3,"chord":false},{"t":34.516,"lane":0,"chord":false},{"t":34.853,"lane":1,"chord":false},{"t":35.352,"lane":2,"chord":false},{"t":35.689,"lane":3,"chord":false},{"t":36.026,"lane":0,"chord":false},{"t":36.513,"lane":1,"chord":false},{"t":36.85,"lane":2,"chord":false},{"t":37.361,"lane":3,"chord":false},{"t":37.686,"lane":0,"chord":false},{"t":38.023,"lane":1,"chord":false},{"t":38.359,"lane":2,"chord":false},{"t":38.859,"lane":3,"chord":false},{"t":39.184,"lane":0,"chord":false},{"t":39.52,"lane":1,"chord":false},{"t":39.857,"lane":2,"chord":false},{"t":40.194,"lane":3,"chord":false},{"t":40.519,"lane":0,"chord":false},{"t":40.856,"lane":1,"chord":false},{"t":41.192,"lane":2,"chord":false},{"t":41.552,"lane":3,"chord":false},{"t":41.854,"lane":0,"chord":false},{"t":42.191,"lane":1,"chord":false},{"t":42.69,"lane":2,"chord":false},{"t":43.027,"lane":3,"chord":false},{"t":43.352,"lane":0,"chord":false},{"t":43.688,"lane":1,"chord":false},{"t":44.025,"lane":2,"chord":false},{"t":44.35,"lane":3,"chord":false},{"t":44.849,"lane":0,"chord":false},{"t":45.685,"lane":2,"chord":false},{"t":46.184,"lane":3,"chord":false},{"t":46.521,"lane":0,"chord":false},{"t":47.276,"lane":2,"chord":false},{"t":48.019,"lane":1,"chord":false},{"t":48.356,"lane":2,"chord":false},{"t":48.855,"lane":3,"chord":false},{"t":49.191,"lane":0,"chord":false},{"t":49.691,"lane":1,"chord":false},{"t":50.016,"lane":2,"chord":false},{"t":50.77,"lane":1,"chord":false},{"t":51.107,"lane":2,"chord":false},{"t":51.606,"lane":3,"chord":false},{"t":52.187,"lane":2,"chord":false},{"t":52.941,"lane":1,"chord":false},{"t":53.278,"lane":2,"chord":false},{"t":53.94,"lane":0,"chord":false},{"t":54.602,"lane":3,"chord":false},{"t":54.938,"lane":0,"chord":true},{"t":55.438,"lane":1,"chord":false},{"t":55.937,"lane":2,"chord":false},{"t":56.274,"lane":3,"chord":false},{"t":56.773,"lane":0,"chord":true},{"t":57.109,"lane":1,"chord":false},{"t":57.609,"lane":2,"chord":false},{"t":57.945,"lane":3,"chord":false},{"t":58.445,"lane":0,"chord":true},{"t":58.77,"lane":1,"chord":false},{"t":59.106,"lane":2,"chord":false},{"t":59.606,"lane":3,"chord":false},{"t":60.105,"lane":0,"chord":true},{"t":60.604,"lane":1,"chord":false},{"t":61.022,"lane":2,"chord":false},{"t":61.521,"lane":3,"chord":false},{"t":61.939,"lane":0,"chord":true},{"t":62.276,"lane":1,"chord":false},{"t":62.601,"lane":2,"chord":false},{"t":62.938,"lane":3,"chord":false},{"t":63.274,"lane":0,"chord":true},{"t":63.611,"lane":1,"chord":false},{"t":63.936,"lane":2,"chord":false},{"t":64.273,"lane":3,"chord":false},{"t":64.61,"lane":0,"chord":true},{"t":64.935,"lane":1,"chord":false},{"t":65.271,"lane":2,"chord":false},{"t":65.608,"lane":3,"chord":false},{"t":65.945,"lane":0,"chord":true},{"t":66.606,"lane":3,"chord":false,"hold":68.2},{"t":66.943,"lane":0,"chord":false},{"t":67.268,"lane":1,"chord":false},{"t":67.942,"lane":0,"chord":true},{"t":68.441,"lane":1,"chord":false},{"t":68.94,"lane":2,"chord":false},{"t":69.277,"lane":3,"chord":false},{"t":69.776,"lane":0,"chord":true},{"t":70.275,"lane":1,"chord":false},{"t":70.612,"lane":2,"chord":false},{"t":71.111,"lane":3,"chord":false},{"t":71.436,"lane":0,"chord":true},{"t":71.773,"lane":1,"chord":false},{"t":72.272,"lane":2,"chord":false},{"t":72.609,"lane":3,"chord":false},{"t":72.945,"lane":0,"chord":true},{"t":73.271,"lane":1,"chord":false},{"t":73.607,"lane":2,"chord":false},{"t":73.944,"lane":3,"chord":false},{"t":74.269,"lane":0,"chord":true},{"t":74.606,"lane":1,"chord":false},{"t":75.105,"lane":2,"chord":false},{"t":75.442,"lane":3,"chord":false},{"t":75.778,"lane":0,"chord":true},{"t":76.103,"lane":1,"chord":false},{"t":76.44,"lane":2,"chord":false},{"t":76.939,"lane":3,"chord":false},{"t":77.439,"lane":0,"chord":true},{"t":77.775,"lane":1,"chord":false},{"t":78.274,"lane":2,"chord":false},{"t":78.774,"lane":3,"chord":false},{"t":84.277,"lane":1,"chord":false,"hold":86.0},{"t":86.274,"lane":0,"chord":false},{"t":88.271,"lane":2,"chord":false,"hold":89.9},{"t":90.279,"lane":0,"chord":false},{"t":92.299,"lane":2,"chord":false,"hold":94.0},{"t":94.285,"lane":0,"chord":false},{"t":96.282,"lane":3,"chord":false,"hold":97.9},{"t":98.278,"lane":1,"chord":false}];

  const NOTES = [];
  for (const { t, lane, chord, hold } of RAW) {
    NOTES.push({ t, lane, holdEnd: hold || null });
    if (chord) NOTES.push({ t, lane: (lane + 1) % 4, holdEnd: hold || null });
  }
  NOTES.sort((a, b) => a.t - b.t);
  const FIRST_T = NOTES[0].t;
  const LAST_T = Math.max(...NOTES.map(n => n.holdEnd || n.t));

  /* ================= 設定 ================= */
  const KEYS = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 };
  const PERFECT_WIN = 0.050;   // 秒
  const GOOD_WIN = 0.120;
  const MISS_WIN = 0.150;
  const START_AT = 14.8;       // 從主歌前奏開始，跳過寂靜開場
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
    audio.currentTime = START_AT;
    audio.play().catch(() => {});
    state = "playing";
    runCountdown();
    rafId = requestAnimationFrame(tick);
  }

  /* ================= 倒數 ================= */
  function runCountdown() {
    let i = 3;
    const step = () => {
      if (i > 0) {
        showCount(String(i));
        i--;
        setTimeout(step, 500);
      } else {
        showCount("GO");
        setTimeout(() => {
          countdownEl.animate([
            { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
            { opacity: 0, transform: "translate(-50%, -50%) scale(1.1)" }
          ], { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
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
    const t = audio.currentTime + SYNC / 1000;

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

    if (t > LAST_T + 2.2 || audio.ended) {
      finish();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  const HEAD_H = window.innerWidth <= 600 ? 26 : 34;

  function spawnNote(n) {
    const el = document.createElement("div");
    el.className = "note n" + n.lane + (n.holdEnd ? " hold" : "");
    el.style.left = (n.lane * 25 + 2).toFixed(2) + "%";
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
    if (state !== "playing") return;
    flashLane(lane);
    const t = audio.currentTime + SYNC / 1000;
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
    if (state !== "playing") return;
    const t = audio.currentTime + SYNC / 1000;
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
    el.style.left = lane !== undefined ? ((lane + 0.5) / 4 * 100) + "%" : "50%";
    fxLayer.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("show")));
    setTimeout(() => el.remove(), 320);
  }

  function showBurst(n, kind) {
    const el = document.createElement("div");
    el.className = "burst " + kind;
    el.style.top = lineY() + "px";
    el.style.left = ((n.lane + 0.5) / 4 * 100) + "%";
    fxLayer.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("show")));
    setTimeout(() => el.remove(), 240);
  }

  function updateHud(t) {
    const total = counts.perfect + counts.good + counts.miss;
    const acc = total ? (counts.perfect + counts.good * 0.6) / total * 100 : 100;
    accEl.textContent = acc.toFixed(1) + "%";
    scoreEl.textContent = score;
    const p = Math.min(1, Math.max(0, (t - FIRST_T) / (LAST_T - FIRST_T)));
    progressEl.style.width = (p * 100).toFixed(1) + "%";
  }

  /* ================= 結束 ================= */
  function finish() {
    state = "done";
    cancelAnimationFrame(rafId);
    audio.pause();

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
    submitBtn.disabled = false;
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
    audio.play().catch(() => {});
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

})();
