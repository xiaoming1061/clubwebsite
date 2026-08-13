(() => {
  "use strict";

  const BPM = 178;
  const BEAT = 60 / BPM;
  const HEAD_H = 34;
  const BUFFER = 600;
  const SAVE_KEY = "rgs.chart";

  /* 預設譜面（與遊戲 play.js 相同，t / lane / chord / hold） */
  const DEFAULT_CHART = [{"t":16.684,"lane":2,"chord":false},{"t":17.02,"lane":3,"chord":false},{"t":17.357,"lane":0,"chord":false},{"t":17.694,"lane":1,"chord":false},{"t":18.019,"lane":2,"chord":false},{"t":18.355,"lane":3,"chord":false},{"t":22.117,"lane":2,"chord":false},{"t":22.686,"lane":0,"chord":false},{"t":23.023,"lane":1,"chord":false},{"t":23.359,"lane":2,"chord":false},{"t":23.684,"lane":3,"chord":false},{"t":24.184,"lane":0,"chord":false},{"t":24.52,"lane":1,"chord":false},{"t":24.857,"lane":2,"chord":false},{"t":25.182,"lane":3,"chord":false},{"t":25.519,"lane":0,"chord":false},{"t":25.855,"lane":1,"chord":false},{"t":26.192,"lane":2,"chord":false},{"t":26.691,"lane":3,"chord":false},{"t":27.191,"lane":0,"chord":false},{"t":27.516,"lane":1,"chord":false},{"t":28.026,"lane":2,"chord":false},{"t":28.363,"lane":3,"chord":false},{"t":28.688,"lane":0,"chord":false},{"t":29.025,"lane":1,"chord":false},{"t":29.362,"lane":2,"chord":false},{"t":29.687,"lane":3,"chord":false},{"t":30.023,"lane":0,"chord":false},{"t":30.36,"lane":1,"chord":false},{"t":30.859,"lane":2,"chord":false},{"t":31.184,"lane":3,"chord":false},{"t":31.521,"lane":0,"chord":false},{"t":32.02,"lane":1,"chord":false},{"t":32.357,"lane":2,"chord":false},{"t":32.694,"lane":3,"chord":false},{"t":33.019,"lane":0,"chord":false},{"t":33.518,"lane":1,"chord":false},{"t":33.855,"lane":2,"chord":false},{"t":34.191,"lane":3,"chord":false},{"t":34.516,"lane":0,"chord":false},{"t":34.853,"lane":1,"chord":false},{"t":35.352,"lane":2,"chord":false},{"t":35.689,"lane":3,"chord":false},{"t":36.026,"lane":0,"chord":false},{"t":36.513,"lane":1,"chord":false},{"t":36.85,"lane":2,"chord":false},{"t":37.361,"lane":3,"chord":false},{"t":37.686,"lane":0,"chord":false},{"t":38.023,"lane":1,"chord":false},{"t":38.359,"lane":2,"chord":false},{"t":38.859,"lane":3,"chord":false},{"t":39.184,"lane":0,"chord":false},{"t":39.52,"lane":1,"chord":false},{"t":39.857,"lane":2,"chord":false},{"t":40.194,"lane":3,"chord":false},{"t":40.519,"lane":0,"chord":false},{"t":40.856,"lane":1,"chord":false},{"t":41.192,"lane":2,"chord":false},{"t":41.552,"lane":3,"chord":false},{"t":41.854,"lane":0,"chord":false},{"t":42.191,"lane":1,"chord":false},{"t":42.69,"lane":2,"chord":false},{"t":43.027,"lane":3,"chord":false},{"t":43.352,"lane":0,"chord":false},{"t":43.688,"lane":1,"chord":false},{"t":44.025,"lane":2,"chord":false},{"t":44.35,"lane":3,"chord":false},{"t":44.849,"lane":0,"chord":false},{"t":45.685,"lane":2,"chord":false},{"t":46.184,"lane":3,"chord":false},{"t":46.521,"lane":0,"chord":false},{"t":47.276,"lane":2,"chord":false},{"t":48.019,"lane":1,"chord":false},{"t":48.356,"lane":2,"chord":false},{"t":48.855,"lane":3,"chord":false},{"t":49.191,"lane":0,"chord":false},{"t":49.691,"lane":1,"chord":false},{"t":50.016,"lane":2,"chord":false},{"t":50.77,"lane":1,"chord":false},{"t":51.107,"lane":2,"chord":false},{"t":51.606,"lane":3,"chord":false},{"t":52.187,"lane":2,"chord":false},{"t":52.941,"lane":1,"chord":false},{"t":53.278,"lane":2,"chord":false},{"t":53.94,"lane":0,"chord":false},{"t":54.602,"lane":3,"chord":false},{"t":54.938,"lane":0,"chord":true},{"t":55.438,"lane":1,"chord":false},{"t":55.937,"lane":2,"chord":false},{"t":56.274,"lane":3,"chord":false},{"t":56.773,"lane":0,"chord":true},{"t":57.109,"lane":1,"chord":false},{"t":57.609,"lane":2,"chord":false},{"t":57.945,"lane":3,"chord":false},{"t":58.445,"lane":0,"chord":true},{"t":58.77,"lane":1,"chord":false},{"t":59.106,"lane":2,"chord":false},{"t":59.606,"lane":3,"chord":false},{"t":60.105,"lane":0,"chord":true},{"t":60.604,"lane":1,"chord":false},{"t":61.022,"lane":2,"chord":false},{"t":61.521,"lane":3,"chord":false},{"t":61.939,"lane":0,"chord":true},{"t":62.276,"lane":1,"chord":false},{"t":62.601,"lane":2,"chord":false},{"t":62.938,"lane":3,"chord":false},{"t":63.274,"lane":0,"chord":true},{"t":63.611,"lane":1,"chord":false},{"t":63.936,"lane":2,"chord":false},{"t":64.273,"lane":3,"chord":false},{"t":64.61,"lane":0,"chord":true},{"t":64.935,"lane":1,"chord":false},{"t":65.271,"lane":2,"chord":false},{"t":65.608,"lane":3,"chord":false},{"t":65.945,"lane":0,"chord":true},{"t":66.606,"lane":3,"chord":false,"hold":68.2},{"t":66.943,"lane":0,"chord":false},{"t":67.268,"lane":1,"chord":false},{"t":67.942,"lane":0,"chord":true},{"t":68.441,"lane":1,"chord":false},{"t":68.94,"lane":2,"chord":false},{"t":69.277,"lane":3,"chord":false},{"t":69.776,"lane":0,"chord":true},{"t":70.275,"lane":1,"chord":false},{"t":70.612,"lane":2,"chord":false},{"t":71.111,"lane":3,"chord":false},{"t":71.436,"lane":0,"chord":true},{"t":71.773,"lane":1,"chord":false},{"t":72.272,"lane":2,"chord":false},{"t":72.609,"lane":3,"chord":false},{"t":72.945,"lane":0,"chord":true},{"t":73.271,"lane":1,"chord":false},{"t":73.607,"lane":2,"chord":false},{"t":73.944,"lane":3,"chord":false},{"t":74.269,"lane":0,"chord":true},{"t":74.606,"lane":1,"chord":false},{"t":75.105,"lane":2,"chord":false},{"t":75.442,"lane":3,"chord":false},{"t":75.778,"lane":0,"chord":true},{"t":76.103,"lane":1,"chord":false},{"t":76.44,"lane":2,"chord":false},{"t":76.939,"lane":3,"chord":false},{"t":77.439,"lane":0,"chord":true},{"t":77.775,"lane":1,"chord":false},{"t":78.274,"lane":2,"chord":false},{"t":78.774,"lane":3,"chord":false},{"t":84.277,"lane":1,"chord":false,"hold":86.0},{"t":86.274,"lane":0,"chord":false},{"t":88.271,"lane":2,"chord":false,"hold":89.9},{"t":90.279,"lane":0,"chord":false},{"t":92.299,"lane":2,"chord":false,"hold":94.0},{"t":94.285,"lane":0,"chord":false},{"t":96.282,"lane":3,"chord":false,"hold":97.9},{"t":98.278,"lane":1,"chord":false}];

  /* ================= DOM ================= */
  const $ = (id) => document.getElementById(id);
  const playfield = $("playfield");
  const efTrack = $("efTrack");
  const efRuler = $("efRuler");
  const efNotes = $("efNotes");
  const efPreview = $("efPreview");
  const lanesEl = $("efLanes");
  const audio = $("music");
  const playBtn = $("playBtn");
  const timeDisplay = $("timeDisplay");
  const zoomInput = $("zoom");
  const snapSelect = $("snap");
  const typeSelect = $("noteType");
  const noteCount = $("noteCount");
  const chartText = $("chartText");

  for (let i = 0; i < 4; i++) {
    const d = document.createElement("div");
    d.className = "ef-lane";
    lanesEl.appendChild(d);
  }

  /* ================= 狀態 ================= */
  let chart = load();
  let playing = false;
  let raf = 0;
  let PPS = 160;
  let scrollOffset = 0;
  let lastPlayhead = 0;
  let holdStart = null;      // 長按工具：開始時間
  let dragging = null;       // 拖曳中的音符

  function load() {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      if (s) {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) return arr;
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_CHART));
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(chart));
    } catch (e) {}
  }

  function maxTime() {
    return chart.reduce((m, n) => Math.max(m, n.hold || n.t), 0);
  }

  function judgeY() {
    return playfield.clientHeight - 90;
  }

  function snapTime(t) {
    const d = BEAT / Number(snapSelect.value);
    return Math.max(0, Math.round(t / d) * d);
  }

  /* ================= 渲染 ================= */
  function render() {
    const mT = maxTime();
    efTrack.style.height = (mT * PPS + BUFFER * 2 + 400) + "px";

    efRuler.innerHTML = "";
    const beatCount = Math.ceil(mT / BEAT) + 1;
    for (let i = 0; i <= beatCount; i++) {
      const tt = i * BEAT;
      const div = document.createElement("div");
      div.className = "ef-beat";
      div.style.top = (BUFFER - tt * PPS) + "px";
      efRuler.appendChild(div);
    }

    efNotes.innerHTML = "";
    const sorted = [...chart].sort((a, b) => a.t - b.t);
    for (const n of sorted) {
      efNotes.appendChild(buildNoteEl(n));
    }

    positionTrack(playing ? audio.currentTime : lastPlayhead);
    updateStats();
  }

  function buildNoteEl(n) {
    const el = document.createElement("div");
    el.className = "ef-note lane" + n.lane + (n.hold ? " hold" : "");
    el.style.left = (n.lane * 25 + 2) + "%";
    el.style.top = (BUFFER - n.t * PPS) + "px";
    if (n.hold) el.style.height = ((n.hold - n.t) * PPS + HEAD_H) + "px";
    el.dataset.idx = chart.indexOf(n);

    el.addEventListener("pointerdown", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      dragging = { n, origT: n.t, origLane: n.lane, startY: ev.clientY, startX: ev.clientX };
      el.setPointerCapture(ev.pointerId);
    });
    el.addEventListener("pointermove", (ev) => {
      if (!dragging || dragging.n !== n) return;
      const rect = playfield.getBoundingClientRect();
      const dy = ev.clientY - dragging.startY;
      const dx = ev.clientX - dragging.startX;
      const lane = Math.max(0, Math.min(3, Math.round((n.lane * 25 + 12.5 + dx / rect.width * 100) / 25)));
      n.lane = lane;
      n.t = Math.max(0, dragging.origT - dy / PPS);
      el.className = "ef-note lane" + lane + (n.hold ? " hold" : "");
      el.style.left = (lane * 25 + 2) + "%";
      el.style.top = (BUFFER - n.t * PPS) + "px";
    });
    el.addEventListener("pointerup", (ev) => {
      if (!dragging || dragging.n !== n) return;
      n.t = snapTime(n.t);
      dragging = null;
      save();
      render();
    });
    el.addEventListener("dblclick", (ev) => {
      ev.stopPropagation();
      const i = chart.indexOf(n);
      if (i > -1) {
        chart.splice(i, 1);
        save();
        render();
      }
    });
    return el;
  }

  function positionTrack(playheadT) {
    const jy = judgeY();
    efTrack.style.transform = "translateY(" + (jy - BUFFER + playheadT * PPS + scrollOffset).toFixed(1) + "px)";
  }

  function updateStats() {
    const holds = chart.filter(n => n.hold).length;
    noteCount.textContent = chart.length + " 音符 · " + holds + " 長按";
  }

  /* ================= 播放 ================= */
  function fmt(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 1000);
    return m + ":" + String(s).padStart(2, "0") + "." + String(ms).padStart(3, "0");
  }

  playBtn.addEventListener("click", () => {
    if (!playing) {
      const first = chart.length ? Math.min(...chart.map(n => n.t)) : 0;
      audio.currentTime = Math.max(0, first - 2);
      audio.play().then(() => {
        playing = true;
        playBtn.textContent = "⏸ 暫停";
        scrollOffset = 0;
      }).catch(() => {});
    } else {
      audio.pause();
      playing = false;
      playBtn.textContent = "▶ 播放";
      lastPlayhead = audio.currentTime;
    }
  });

  function loop() {
    if (playing) {
      const t = audio.currentTime;
      lastPlayhead = t;
      timeDisplay.textContent = fmt(t);
      positionTrack(t);
      if (audio.ended) {
        playing = false;
        playBtn.textContent = "▶ 播放";
      }
    }
    raf = requestAnimationFrame(loop);
  }

  /* ================= 新增音符 ================= */
  function timeFromClientY(y) {
    const rect = playfield.getBoundingClientRect();
    const yLocal = y - rect.top;
    const ph = playing ? audio.currentTime : lastPlayhead;
    return snapTime(ph + (judgeY() - yLocal + scrollOffset) / PPS);
  }

  playfield.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest(".ef-note")) return;
    ev.preventDefault();
    const t = timeFromClientY(ev.clientY);
    const lane = Math.max(0, Math.min(3, Math.floor((ev.clientX - playfield.getBoundingClientRect().left) / (playfield.clientWidth / 4))));

    if (typeSelect.value === "hold") {
      holdStart = { t, lane };
      efPreview.style.display = "block";
      efPreview.style.left = (lane * 25 + 2) + "%";
      efPreview.style.top = (BUFFER - t * PPS) + "px";
      efPreview.style.height = "34px";
    } else {
      chart.push({ t, lane, chord: false });
      save();
      render();
    }
  });

  playfield.addEventListener("pointermove", (ev) => {
    if (!holdStart) return;
    const t = timeFromClientY(ev.clientY);
    if (t > holdStart.t + 0.02) {
      efPreview.style.top = (BUFFER - holdStart.t * PPS) + "px";
      efPreview.style.height = ((t - holdStart.t) * PPS + HEAD_H) + "px";
      efPreview.style.display = "block";
    }
  });

  playfield.addEventListener("pointerup", (ev) => {
    if (holdStart) {
      const t = timeFromClientY(ev.clientY);
      const dur = t - holdStart.t;
      if (dur >= 0.05) {
        chart.push({ t: holdStart.t, lane: holdStart.lane, chord: false, hold: t });
      } else {
        chart.push({ t: holdStart.t, lane: holdStart.lane, chord: false });
      }
      holdStart = null;
      efPreview.style.display = "none";
      save();
      render();
    }
  });

  playfield.addEventListener("wheel", (ev) => {
    if (playing) return;
    ev.preventDefault();
    scrollOffset -= ev.deltaY;
    const minS = judgeY() - BUFFER - maxTime() * PPS - 300;
    const maxS = judgeY() - BUFFER + 300;
    scrollOffset = Math.max(minS, Math.min(maxS, scrollOffset));
    positionTrack(lastPlayhead);
  }, { passive: false });

  /* ================= 匯入 / 匯出 ================= */
  $("exportBtn").addEventListener("click", () => {
    chartText.value = JSON.stringify(chart, null, 1);
  });

  $("copyBtn").addEventListener("click", async () => {
    const text = JSON.stringify(chart);
    try {
      await navigator.clipboard.writeText(text);
      $("copyBtn").textContent = "已複製 ✓";
      setTimeout(() => { $("copyBtn").textContent = "複製"; }, 1200);
    } catch (e) {
      chartText.value = text;
      chartText.select();
    }
  });

  $("downloadBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(chart, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chart.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $("importBtn").addEventListener("click", () => {
    try {
      const arr = JSON.parse(chartText.value);
      if (!Array.isArray(arr)) throw new Error("不是陣列");
      for (const n of arr) {
        if (typeof n.t !== "number" || !Number.isFinite(n.t)) throw new Error("缺少 t");
        if (![0, 1, 2, 3].includes(n.lane)) throw new Error("lane 需為 0-3");
      }
      chart = arr;
      save();
      render();
      chartText.value = "";
    } catch (e) {
      alert("載入失敗：" + e.message);
    }
  });

  $("resetBtn").addEventListener("click", () => {
    if (!confirm("確定恢復為預設譜面？目前編輯內容會被覆蓋。")) return;
    chart = JSON.parse(JSON.stringify(DEFAULT_CHART));
    save();
    render();
  });

  /* ================= 控制項 ================= */
  zoomInput.addEventListener("input", () => {
    PPS = Number(zoomInput.value);
    render();
  });
  snapSelect.addEventListener("change", render);
  typeSelect.addEventListener("change", () => {
    efPreview.style.display = "none";
    holdStart = null;
  });

  /* ================= 啟動 ================= */
  render();
  loop();
})();
