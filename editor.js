(() => {
  "use strict";

  const BPM = 120;
  const BEAT = 60 / BPM;
  const HEAD_H = 34;
  const BUFFER = 600;
  const SAVE_KEY = "rgs.chart.v4";
  const SNAP_DIV = 32;         // 強制 32 分網格

  /* 預設譜面（與遊戲 play.js 相同，t / lane / chord / hold） */
  const DEFAULT_CHART = [{"t":0.25,"lane":6,"chord":false},{"t":0.5,"lane":6,"chord":false},{"t":1,"lane":5,"chord":false},{"t":1.5,"lane":4,"chord":false},{"t":2,"lane":3,"chord":false},{"t":2.5,"lane":4,"chord":false},{"t":3,"lane":3,"chord":false},{"t":3.5,"lane":4,"chord":false},{"t":4,"lane":5,"chord":false},{"t":4.5,"lane":4,"chord":false},{"t":5,"lane":3,"chord":false},{"t":5.5,"lane":4,"chord":false},{"t":6,"lane":3,"chord":false},{"t":6.25,"lane":5,"chord":false},{"t":6.5,"lane":6,"chord":false},{"t":6.75,"lane":7,"chord":false},{"t":7,"lane":6,"chord":false},{"t":7.5,"lane":5,"chord":false},{"t":7.75,"lane":4,"chord":false},{"t":8,"lane":4,"chord":false},{"t":8.5,"lane":3,"chord":false},{"t":8.75,"lane":2,"chord":false},{"t":9,"lane":1,"chord":false},{"t":9.25,"lane":0,"chord":false},{"t":9.5,"lane":1,"chord":false},{"t":10,"lane":4,"chord":false},{"t":10.5,"lane":5,"chord":false},{"t":11,"lane":4,"chord":false},{"t":11.5,"lane":3,"chord":false},{"t":12,"lane":4,"chord":false},{"t":12.5,"lane":3,"chord":false},{"t":13,"lane":2,"chord":false},{"t":13.5,"lane":1,"chord":false},{"t":14,"lane":4,"chord":false},{"t":14.5,"lane":4,"chord":false},{"t":15,"lane":3,"chord":false},{"t":15.25,"lane":2,"chord":false},{"t":15.5,"lane":1,"chord":false},{"t":16,"lane":3,"chord":false},{"t":16,"lane":4,"chord":false},{"t":16.25,"lane":4,"chord":false},{"t":16.5,"lane":5,"chord":false},{"t":16.75,"lane":6,"chord":false},{"t":17,"lane":7,"chord":false},{"t":17.25,"lane":6,"chord":false},{"t":17.5,"lane":5,"chord":false},{"t":17.75,"lane":4,"chord":false},{"t":18,"lane":4,"chord":false},{"t":18.25,"lane":3,"chord":false},{"t":18.5,"lane":1,"chord":false},{"t":18.75,"lane":0,"chord":false},{"t":19,"lane":1,"chord":false},{"t":19.25,"lane":2,"chord":false},{"t":19.5,"lane":3,"chord":false},{"t":19.75,"lane":4,"chord":false},{"t":19.875,"lane":5,"chord":false},{"t":20,"lane":0,"chord":false},{"t":20,"lane":7,"chord":false},{"t":20.25,"lane":6,"chord":false},{"t":20.5,"lane":5,"chord":false},{"t":20.75,"lane":4,"chord":false},{"t":21,"lane":3,"chord":false},{"t":21.25,"lane":2,"chord":false},{"t":21.5,"lane":0,"chord":false},{"t":21.75,"lane":1,"chord":false},{"t":22,"lane":4,"chord":false},{"t":22.25,"lane":5,"chord":false},{"t":22.5,"lane":6,"chord":false},{"t":22.75,"lane":7,"chord":false},{"t":23,"lane":6,"chord":false},{"t":23.25,"lane":5,"chord":false},{"t":23.5,"lane":4,"chord":false},{"t":24,"lane":2,"chord":false},{"t":24,"lane":6,"chord":false},{"t":24.25,"lane":5,"chord":false},{"t":24.5,"lane":4,"chord":false},{"t":25,"lane":3,"chord":false},{"t":25.25,"lane":2,"chord":false},{"t":25.5,"lane":1,"chord":false},{"t":25.625,"lane":0,"chord":false},{"t":25.75,"lane":1,"chord":false},{"t":26,"lane":4,"chord":false},{"t":26.25,"lane":5,"chord":false},{"t":26.5,"lane":5,"chord":false},{"t":26.625,"lane":7,"chord":false},{"t":27,"lane":6,"chord":false},{"t":27.25,"lane":4,"chord":false},{"t":27.5,"lane":3,"chord":false},{"t":27.75,"lane":2,"chord":false},{"t":28,"lane":3,"chord":false},{"t":28,"lane":4,"chord":false},{"t":28.25,"lane":2,"chord":false},{"t":28.5,"lane":1,"chord":false},{"t":28.75,"lane":0,"chord":false},{"t":29,"lane":1,"chord":false},{"t":29.25,"lane":2,"chord":false},{"t":29.5,"lane":3,"chord":false},{"t":29.75,"lane":4,"chord":false},{"t":30,"lane":3,"chord":false},{"t":30.25,"lane":4,"chord":false},{"t":30.5,"lane":5,"chord":false},{"t":30.75,"lane":6,"chord":false},{"t":31,"lane":7,"chord":false},{"t":31.25,"lane":6,"chord":false},{"t":31.5,"lane":5,"chord":false},{"t":31.75,"lane":4,"chord":false},{"t":32,"lane":3,"chord":false},{"t":32,"lane":4,"chord":false},{"t":32.25,"lane":3,"chord":false},{"t":32.5,"lane":2,"chord":false},{"t":32.625,"lane":0,"chord":false},{"t":32.75,"lane":0,"chord":false},{"t":33,"lane":1,"chord":false},{"t":33.25,"lane":2,"chord":false},{"t":33.5,"lane":3,"chord":false},{"t":34,"lane":1,"chord":false},{"t":34.25,"lane":2,"chord":false},{"t":34.5,"lane":4,"chord":false},{"t":35,"lane":3,"chord":false},{"t":35.25,"lane":2,"chord":false},{"t":35.5,"lane":1,"chord":false},{"t":36,"lane":2,"chord":false},{"t":36,"lane":4,"chord":false},{"t":36.25,"lane":4,"chord":false},{"t":36.5,"lane":5,"chord":false},{"t":37,"lane":4,"chord":false},{"t":37.25,"lane":3,"chord":false},{"t":37.5,"lane":2,"chord":false},{"t":37.75,"lane":1,"chord":false},{"t":38,"lane":3,"chord":false},{"t":38.25,"lane":3,"chord":false},{"t":38.5,"lane":4,"chord":false},{"t":39,"lane":3,"chord":false},{"t":39.25,"lane":2,"chord":false},{"t":39.5,"lane":1,"chord":false},{"t":40,"lane":3,"chord":false},{"t":40,"lane":4,"chord":false},{"t":40.25,"lane":4,"chord":false},{"t":40.5,"lane":5,"chord":false},{"t":41,"lane":6,"chord":false},{"t":41.25,"lane":7,"chord":false},{"t":41.5,"lane":6,"chord":false},{"t":41.75,"lane":5,"chord":false},{"t":42,"lane":3,"chord":false},{"t":42.25,"lane":2,"chord":false},{"t":42.5,"lane":1,"chord":false},{"t":43,"lane":0,"chord":false},{"t":43.25,"lane":1,"chord":false},{"t":43.5,"lane":2,"chord":false},{"t":44,"lane":2,"chord":false},{"t":44,"lane":5,"chord":false},{"t":44.25,"lane":3,"chord":false},{"t":44.5,"lane":4,"chord":false},{"t":44.625,"lane":5,"chord":false},{"t":44.875,"lane":5,"chord":false},{"t":45,"lane":6,"chord":false},{"t":45.125,"lane":7,"chord":false},{"t":45.25,"lane":6,"chord":false},{"t":45.375,"lane":5,"chord":false},{"t":45.5,"lane":4,"chord":false},{"t":45.75,"lane":3,"chord":false},{"t":46,"lane":4,"chord":false},{"t":46.25,"lane":3,"chord":false},{"t":46.5,"lane":1,"chord":false},{"t":46.75,"lane":0,"chord":false},{"t":47,"lane":1,"chord":false},{"t":47.25,"lane":2,"chord":false},{"t":47.5,"lane":3,"chord":false},{"t":47.875,"lane":4,"chord":false},{"t":48,"lane":2,"chord":false},{"t":48,"lane":5,"chord":false},{"t":48.25,"lane":6,"chord":false},{"t":48.375,"lane":7,"chord":false},{"t":48.5,"lane":6,"chord":false},{"t":48.625,"lane":5,"chord":false},{"t":48.875,"lane":4,"chord":false},{"t":49,"lane":3,"chord":false},{"t":49.125,"lane":2,"chord":false},{"t":49.25,"lane":0,"chord":false},{"t":49.5,"lane":1,"chord":false},{"t":50,"lane":4,"chord":false},{"t":50.5,"lane":5,"chord":false},{"t":50.75,"lane":6,"chord":false},{"t":51,"lane":7,"chord":false},{"t":51.5,"lane":6,"chord":false},{"t":52,"lane":4,"chord":false},{"t":52.5,"lane":4,"chord":false},{"t":53,"lane":3,"chord":false},{"t":53.25,"lane":2,"chord":false},{"t":53.5,"lane":1,"chord":false},{"t":53.625,"lane":0,"chord":false},{"t":54,"lane":2,"chord":false},{"t":54.25,"lane":3,"chord":false},{"t":54.5,"lane":4,"chord":false},{"t":54.625,"lane":5,"chord":false},{"t":54.75,"lane":7,"chord":false},{"t":54.875,"lane":7,"chord":false},{"t":55,"lane":6,"chord":false},{"t":55.25,"lane":5,"chord":false},{"t":55.5,"lane":4,"chord":false},{"t":56,"lane":3,"chord":false},{"t":56,"lane":5,"chord":false},{"t":56.25,"lane":4,"chord":false},{"t":56.5,"lane":5,"chord":false},{"t":56.625,"lane":6,"chord":false},{"t":56.75,"lane":7,"chord":false},{"t":57,"lane":7,"chord":false},{"t":57.25,"lane":7,"chord":false},{"t":57.5,"lane":6,"chord":false},{"t":58,"lane":3,"chord":false},{"t":58.25,"lane":2,"chord":false},{"t":58.5,"lane":1,"chord":false},{"t":58.625,"lane":0,"chord":false},{"t":58.75,"lane":0,"chord":false},{"t":59,"lane":0,"chord":false},{"t":59.0833,"lane":1,"chord":false},{"t":59.1667,"lane":0,"chord":false},{"t":59.25,"lane":1,"chord":false},{"t":59.3333,"lane":0,"chord":false},{"t":59.4167,"lane":1,"chord":false},{"t":59.5,"lane":0,"chord":false},{"t":60,"lane":3,"chord":false},{"t":60,"lane":4,"chord":false},{"t":60.25,"lane":4,"chord":false},{"t":60.5,"lane":5,"chord":false},{"t":60.625,"lane":6,"chord":false},{"t":61,"lane":7,"chord":false},{"t":61.25,"lane":6,"chord":false},{"t":61.5,"lane":5,"chord":false},{"t":61.75,"lane":4,"chord":false},{"t":62,"lane":3,"chord":false},{"t":62.25,"lane":4,"chord":false},{"t":62.5,"lane":5,"chord":false},{"t":62.625,"lane":6,"chord":false},{"t":63,"lane":7,"chord":false},{"t":63.125,"lane":6,"chord":false},{"t":63.25,"lane":5,"chord":false},{"t":63.5,"lane":4,"chord":false},{"t":64,"lane":3,"chord":false},{"t":64,"lane":4,"chord":false},{"t":64.25,"lane":4,"chord":false},{"t":64.5,"lane":5,"chord":false},{"t":64.625,"lane":6,"chord":false},{"t":65,"lane":6,"chord":false},{"t":65.25,"lane":7,"chord":false},{"t":65.5,"lane":7,"chord":false},{"t":65.625,"lane":6,"chord":false},{"t":65.75,"lane":5,"chord":false},{"t":66,"lane":4,"chord":false},{"t":66.25,"lane":6,"chord":false},{"t":66.5,"lane":7,"chord":false},{"t":66.625,"lane":7,"chord":false},{"t":67,"lane":7,"chord":false},{"t":67.0833,"lane":6,"chord":false},{"t":67.1667,"lane":7,"chord":false},{"t":67.25,"lane":6,"chord":false},{"t":67.3333,"lane":7,"chord":false},{"t":67.4167,"lane":6,"chord":false},{"t":67.5,"lane":7,"chord":false},{"t":68,"lane":2,"chord":false},{"t":68,"lane":5,"chord":false},{"t":68.25,"lane":4,"chord":false},{"t":68.375,"lane":3,"chord":false},{"t":68.5,"lane":1,"chord":false},{"t":68.625,"lane":0,"chord":false},{"t":69,"lane":1,"chord":false},{"t":69.25,"lane":2,"chord":false},{"t":69.5,"lane":3,"chord":false},{"t":69.625,"lane":4,"chord":false},{"t":69.75,"lane":5,"chord":false},{"t":70,"lane":4,"chord":false},{"t":70.25,"lane":5,"chord":false},{"t":70.5,"lane":5,"chord":false},{"t":70.625,"lane":6,"chord":false},{"t":71,"lane":7,"chord":false},{"t":71.25,"lane":6,"chord":false},{"t":71.5,"lane":5,"chord":false},{"t":72,"lane":3,"chord":false},{"t":72,"lane":4,"chord":false},{"t":72.25,"lane":5,"chord":false},{"t":72.5,"lane":6,"chord":false},{"t":72.625,"lane":7,"chord":false},{"t":73,"lane":6,"chord":false},{"t":73.25,"lane":5,"chord":false},{"t":73.5,"lane":4,"chord":false},{"t":74,"lane":3,"chord":false},{"t":74.25,"lane":4,"chord":false},{"t":74.5,"lane":5,"chord":false},{"t":74.625,"lane":6,"chord":false},{"t":75,"lane":6,"chord":false},{"t":75.0833,"lane":5,"chord":false},{"t":75.1667,"lane":6,"chord":false},{"t":75.25,"lane":5,"chord":false},{"t":75.3333,"lane":6,"chord":false},{"t":75.4167,"lane":5,"chord":false},{"t":75.5,"lane":6,"chord":false},{"t":76,"lane":3,"chord":false},{"t":76,"lane":5,"chord":false},{"t":76.25,"lane":2,"chord":false},{"t":76.5,"lane":1,"chord":false},{"t":76.625,"lane":0,"chord":false},{"t":77,"lane":0,"chord":false},{"t":77.125,"lane":0,"chord":false},{"t":77.25,"lane":1,"chord":false},{"t":77.5,"lane":2,"chord":false},{"t":78,"lane":2,"chord":false},{"t":78.5,"lane":1,"chord":false},{"t":79,"lane":0,"chord":false},{"t":79.5,"lane":0,"chord":false},{"t":80,"lane":2,"chord":false},{"t":80,"lane":5,"chord":false},{"t":80.25,"lane":3,"chord":false},{"t":80.5,"lane":4,"chord":false},{"t":80.625,"lane":5,"chord":false},{"t":80.75,"lane":6,"chord":false},{"t":80.875,"lane":7,"chord":false},{"t":81,"lane":6,"chord":false},{"t":81.125,"lane":5,"chord":false},{"t":81.25,"lane":4,"chord":false},{"t":81.5,"lane":3,"chord":false},{"t":81.625,"lane":2,"chord":false},{"t":82,"lane":4,"chord":false},{"t":82.25,"lane":4,"chord":false},{"t":82.5,"lane":5,"chord":false},{"t":83,"lane":6,"chord":false},{"t":83.25,"lane":7,"chord":false},{"t":83.5,"lane":6,"chord":false},{"t":84,"lane":3,"chord":false},{"t":84,"lane":4,"chord":false},{"t":84.25,"lane":2,"chord":false},{"t":84.5,"lane":1,"chord":false},{"t":84.75,"lane":0,"chord":false},{"t":85,"lane":1,"chord":false},{"t":85.25,"lane":2,"chord":false},{"t":85.5,"lane":3,"chord":false},{"t":86,"lane":4,"chord":false},{"t":86.25,"lane":2,"chord":false},{"t":86.5,"lane":1,"chord":false},{"t":87,"lane":0,"chord":false},{"t":87.25,"lane":1,"chord":false},{"t":87.5,"lane":2,"chord":false},{"t":87.75,"lane":3,"chord":false},{"t":88,"lane":3,"chord":false},{"t":88,"lane":4,"chord":false},{"t":88.25,"lane":2,"chord":false},{"t":88.5,"lane":1,"chord":false},{"t":89,"lane":2,"chord":false},{"t":89.25,"lane":3,"chord":false},{"t":89.5,"lane":4,"chord":false},{"t":89.875,"lane":5,"chord":false},{"t":90,"lane":6,"chord":false},{"t":90.25,"lane":7,"chord":false},{"t":90.5,"lane":6,"chord":false},{"t":91,"lane":4,"chord":false},{"t":91.25,"lane":3,"chord":false},{"t":91.5,"lane":2,"chord":false},{"t":92,"lane":3,"chord":false},{"t":92,"lane":5,"chord":false},{"t":92.25,"lane":2,"chord":false},{"t":92.5,"lane":1,"chord":false},{"t":93,"lane":2,"chord":false},{"t":93.25,"lane":3,"chord":false},{"t":93.5,"lane":4,"chord":false},{"t":94,"lane":4,"chord":false},{"t":94.25,"lane":5,"chord":false},{"t":94.5,"lane":6,"chord":false},{"t":95,"lane":7,"chord":false},{"t":95.25,"lane":6,"chord":false},{"t":95.5,"lane":5,"chord":false},{"t":96,"lane":3,"chord":false},{"t":96,"lane":4,"chord":false},{"t":96.25,"lane":2,"chord":false},{"t":96.5,"lane":1,"chord":false},{"t":97,"lane":0,"chord":false},{"t":97.25,"lane":1,"chord":false},{"t":97.5,"lane":3,"chord":false},{"t":97.75,"lane":4,"chord":false},{"t":98,"lane":5,"chord":false},{"t":98.25,"lane":3,"chord":false},{"t":98.5,"lane":2,"chord":false},{"t":98.75,"lane":1,"chord":false},{"t":99,"lane":0,"chord":false},{"t":99.5,"lane":1,"chord":false},{"t":100,"lane":2,"chord":false},{"t":100.5,"lane":3,"chord":false},{"t":101,"lane":4,"chord":false},{"t":101.5,"lane":3,"chord":false},{"t":102,"lane":4,"chord":false},{"t":102.5,"lane":3,"chord":false},{"t":103,"lane":4,"chord":false},{"t":103.25,"lane":5,"chord":false},{"t":103.5,"lane":6,"chord":false},{"t":103.75,"lane":7,"chord":false},{"t":104,"lane":4,"chord":false},{"t":104.25,"lane":3,"chord":false},{"t":104.5,"lane":2,"chord":false},{"t":105,"lane":3,"chord":false},{"t":105.25,"lane":4,"chord":false},{"t":105.5,"lane":5,"chord":false},{"t":106,"lane":4,"chord":false},{"t":106.5,"lane":3,"chord":false},{"t":107,"lane":4,"chord":false},{"t":107.25,"lane":5,"chord":false}];

  /* ================= DOM ================= */
  const $ = (id) => document.getElementById(id);
  const playfield = $("playfield");
  const efTrack = $("efTrack");
  const efTime = $("efTime");
  const efNotes = $("efNotes");
  const efGrid = document.querySelector(".ef-grid");
  const efPreview = $("efPreview");
  const lanesEl = $("efLanes");
  const audio = $("music");
  const playBtn = $("playBtn");
  const timeDisplay = $("timeDisplay");
  const zoomInput = $("zoom");
  const posInput = $("pos");
  const posVal = $("posVal");
  const typeSelect = $("noteType");
  const noteCount = $("noteCount");
  const chartText = $("chartText");

  for (let i = 0; i < 8; i++) {
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
  let selectedNote = null;   // 選中的音符
  let mode = "edit";         // edit | delete

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

  function viewCenterTime() {
    const ph = playing ? audio.currentTime : lastPlayhead;
    return ph + (judgeY() - playfield.clientHeight / 2 + scrollOffset) / PPS;
  }

  function clampScroll() {
    const jy = judgeY();
    const H = playfield.clientHeight;
    const ph = playing ? audio.currentTime : lastPlayhead;
    const lo = -jy - ph * PPS - 300;
    const hi = H - jy + (chartDuration() - ph) * PPS + 300;
    scrollOffset = Math.max(lo, Math.min(hi, scrollOffset));
  }

  function syncPosSlider() {
    const dur = chartDuration();
    const c = viewCenterTime();
    posInput.value = dur > 0 ? Math.round(Math.min(1000, Math.max(0, c / dur * 1000))) : 0;
    posVal.textContent = Math.floor(c / 60) + ":" + String(Math.floor(c % 60)).padStart(2, "0");
  }

  function snapTime(t) {
    const d = BEAT * 4 / SNAP_DIV;
    return Math.max(0, Math.round(t / d) * d);
  }

  /* ================= 渲染 ================= */
  function chartDuration() {
    const d = audio.duration && Number.isFinite(audio.duration) ? audio.duration : 115;
    return Math.max(maxTime(), d);
  }

  function render() {
    const mT = chartDuration();
    efTrack.style.height = (mT * PPS + BUFFER * 2 + 400) + "px";

    // 網格：32 分細線 + 每拍粗線，覆蓋整首歌
    efGrid.innerHTML = "";
    const stepDur = BEAT * 4 / SNAP_DIV;
    for (let t = 0; t <= mT + 0.001; t += stepDur) {
      const isBeat = Math.abs(t / BEAT - Math.round(t / BEAT)) < 1e-6;
      const div = document.createElement("div");
      div.className = "ef-gline" + (isBeat ? " beat" : "");
      div.style.top = (BUFFER - t * PPS) + "px";
      efGrid.appendChild(div);
    }

    // 縱向時間標尺（整首歌）
    efTime.innerHTML = "";
    const labelGap = PPS >= 120 ? 1 : PPS >= 60 ? 2 : 5;
    for (let tt = 0; tt <= mT + 0.001; tt += labelGap) {
      const span = document.createElement("span");
      span.textContent = Math.floor(tt / 60) + ":" + String(Math.floor(tt % 60)).padStart(2, "0");
      span.style.top = (BUFFER - tt * PPS) + "px";
      efTime.appendChild(span);
    }

    efNotes.innerHTML = "";
    const sorted = [...chart].sort((a, b) => a.t - b.t);
    for (const n of sorted) {
      const el = buildNoteEl(n);
      if (n === selectedNote) el.classList.add("selected");
      efNotes.appendChild(el);
    }

    positionTrack(playing ? audio.currentTime : lastPlayhead);
    updateStats();
  }

  function buildNoteEl(n) {
    const el = document.createElement("div");
    el.className = "ef-note lane" + n.lane + (n.hold ? " hold" : "");
    el.style.left = (n.lane * 12.5 + 1.25) + "%";
    el.style.top = (BUFFER - n.t * PPS) + "px";
    if (n.hold) el.style.height = ((n.hold - n.t) * PPS + HEAD_H) + "px";
    el.dataset.idx = chart.indexOf(n);

    el.addEventListener("pointerdown", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      if (mode === "delete") {
        const i = chart.indexOf(n);
        if (i > -1) {
          chart.splice(i, 1);
          save();
          render();
        }
        return;
      }
      selectedNote = n;
      efNotes.querySelectorAll(".ef-note.selected").forEach((x) => x.classList.remove("selected"));
      el.classList.add("selected");
      dragging = { n, origT: n.t, startY: ev.clientY, el };
      window.addEventListener("pointermove", onDragMove);
      window.addEventListener("pointerup", onDragEnd);
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

  function onDragMove(ev) {
    if (!dragging) return;
    const rect = playfield.getBoundingClientRect();
    const laneW = rect.width - 56;
    const lane = Math.max(0, Math.min(7, Math.floor((ev.clientX - rect.left - 56) / (laneW / 8))));
    const n = dragging.n;
    n.lane = lane;
    n.t = snapTime(Math.max(0, dragging.origT - (ev.clientY - dragging.startY) / PPS));
    const el = dragging.el;
    el.className = "ef-note lane" + lane + (n.hold ? " hold" : "");
    el.style.left = (lane * 12.5 + 1.25) + "%";
    el.style.top = (BUFFER - n.t * PPS) + "px";
  }

  function onDragEnd() {
    if (!dragging) return;
    dragging.n.t = snapTime(dragging.n.t);
    dragging = null;
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
    save();
    render();
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
      audio.currentTime = Math.max(0, viewCenterTime());   // 從目前視圖位置開始播放
      scrollOffset = 0;
      audio.play().then(() => {
        playing = true;
        playBtn.textContent = "⏸ 暫停";
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
      syncPosSlider();
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
    if (mode === "delete") return;
    selectedNote = null;
    efNotes.querySelectorAll(".ef-note.selected").forEach((x) => x.classList.remove("selected"));
    const t = timeFromClientY(ev.clientY);
    const rect = playfield.getBoundingClientRect();
    const lane = Math.max(0, Math.min(7, Math.floor((ev.clientX - rect.left - 56) / ((playfield.clientWidth - 56) / 8))));

    if (typeSelect.value === "hold") {
      holdStart = { t, lane };
      efPreview.style.display = "block";
      efPreview.style.left = (lane * 12.5 + 1.25) + "%";
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
    clampScroll();
    positionTrack(lastPlayhead);
    syncPosSlider();
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
        if (![0, 1, 2, 3, 4, 5, 6, 7].includes(n.lane)) throw new Error("lane 需為 0-7");
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

  /* 編輯／刪除模式切換 */
  function setMode(m) {
    mode = m;
    $("modeEdit").classList.toggle("active", m === "edit");
    $("modeDelete").classList.toggle("active", m === "delete");
    playfield.classList.toggle("delete-mode", m === "delete");
  }
  $("modeEdit").addEventListener("click", () => setMode("edit"));
  $("modeDelete").addEventListener("click", () => setMode("delete"));

  /* 刪除選中的音符（編輯模式用） */
  function deleteSelected() {
    if (!selectedNote) return;
    const i = chart.indexOf(selectedNote);
    if (i > -1) {
      chart.splice(i, 1);
      selectedNote = null;
      save();
      render();
    }
  }

  window.addEventListener("keydown", (ev) => {
    if (ev.target.closest("textarea, input, select")) return;
    if (mode === "edit" && (ev.key === "Delete" || ev.key === "Backspace") && selectedNote) {
      ev.preventDefault();
      deleteSelected();
    }
    // 播放中即時錄譜：按 A S D F J K L ; 在對應軌道、目前時間（吸附最近網格）加音符
    if (!ev.repeat && playing) {
      const REC_KEYS = { KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3, KeyJ: 4, KeyK: 5, KeyL: 6, Semicolon: 7 };
      const lane = REC_KEYS[ev.code];
      if (lane !== undefined) {
        ev.preventDefault();
        chart.push({ t: snapTime(audio.currentTime), lane, chord: false });
        save();
        render();
      }
    }
  });

  /* ================= 控制項 ================= */
  zoomInput.addEventListener("input", () => {
    const newPPS = Number(zoomInput.value);
    const jy = judgeY();
    const ph = playing ? audio.currentTime : lastPlayhead;
    const centerTime = viewCenterTime();
    PPS = newPPS;
    scrollOffset = playfield.clientHeight / 2 - jy + (centerTime - ph) * PPS;
    clampScroll();
    render();
    syncPosSlider();
  });

  posInput.addEventListener("input", () => {
    const dur = chartDuration();
    const c = Math.max(0, dur * Number(posInput.value) / 1000);
    if (playing) {
      audio.currentTime = c;   // 播放中拖動位置＝跳轉
    } else {
      const ph = lastPlayhead;
      scrollOffset = playfield.clientHeight / 2 - judgeY() + (c - ph) * PPS;
      clampScroll();
      positionTrack(ph);
      syncPosSlider();
    }
  });
  typeSelect.addEventListener("change", () => {
    efPreview.style.display = "none";
    holdStart = null;
  });

  /* ================= 啟動 ================= */
  audio.addEventListener("loadedmetadata", render);
  render();
  syncPosSlider();
  loop();
})();
