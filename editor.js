(() => {
  "use strict";

  const BPM = 178;
  const BEAT = 60 / BPM;
  const HEAD_H = 34;
  const BUFFER = 600;
  const SAVE_KEY = "rgs.chart.v2";

  /* 預設譜面（與遊戲 play.js 相同，t / lane / chord / hold） */
  const DEFAULT_CHART = [];

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
      audio.currentTime = 0;   // 完整版：從頭播放，不掐頭去尾
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
