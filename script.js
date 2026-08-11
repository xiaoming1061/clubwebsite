(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const shotMode = new URLSearchParams(location.search).has("shot");

  /* 預覽模式：給無頭瀏覽器/截圖用，立即顯示全部內容、關閉動畫 */
  if (shotMode) {
    document.documentElement.classList.remove("js-anim");
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("visible"));
  }

  /* ---------- 背景下落音符（canvas） ---------- */
  const canvas = document.getElementById("bg");
  if (canvas && !reduceMotion && !shotMode) {
    const ctx = canvas.getContext("2d");
    const COLORS = ["#37e6f5", "#8b7cf6", "#f472e0", "#ffe066"];
    let w = 0, h = 0;
    let notes = [];

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }

    function spawn(init) {
      return {
        x: Math.random() * w,
        y: init ? Math.random() * h : -24,
        r: 2 + Math.random() * 4,
        vy: 0.35 + Math.random() * 0.9,
        vx: (Math.random() - 0.5) * 0.25,
        rot: Math.random() * Math.PI,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        shape: Math.random() < 0.5 ? "circle" : "note"
      };
    }

    resize();
    notes = Array.from({ length: Math.min(34, Math.max(16, Math.floor(w / 42))) }, () => spawn(true));

    let tick = 0;
    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (const n of notes) {
        n.y += n.vy;
        n.x += n.vx + Math.sin((tick + n.r) * 0.02) * 0.08;
        n.rot += 0.008;
        if (n.y > h + 24) Object.assign(n, spawn(false));

        ctx.globalAlpha = 0.5;
        ctx.fillStyle = n.color;
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.rotate(n.rot);
        if (n.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, n.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(-n.r, -n.r);
          ctx.lineTo(n.r, 0);
          ctx.lineTo(-n.r, n.r);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      tick++;
      requestAnimationFrame(draw);
    }
    draw();
    window.addEventListener("resize", resize);
  }

  /* ---------- 導航列收縮 ---------- */
  const nav = document.querySelector("header.nav");
  window.addEventListener("scroll", () => {
    nav.classList.toggle("scrolled", window.scrollY > 30);
  }, { passive: true });

  /* ---------- 滾動時高亮當前 section ---------- */
  const sections = [...document.querySelectorAll("section[id]")];
  const links = [...document.querySelectorAll("nav.links a")];
  const sectionIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        links.forEach((l) => {
          l.classList.toggle("active", l.getAttribute("href") === "#" + e.target.id);
        });
      }
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => sectionIO.observe(s));

  /* ---------- 進場動畫 ---------- */
  const revealIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        revealIO.unobserve(e.target);
      }
    }
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((el) => {
    let idx = 0;
    let prev = el;
    while ((prev = prev.previousElementSibling)) {
      if (prev.classList.contains("reveal")) idx++;
    }
    const delay = el.dataset.delay !== undefined ? Number(el.dataset.delay) : Math.min(idx * 60, 360);
    if (!reduceMotion) el.style.transitionDelay = delay + "ms";
    revealIO.observe(el);
  });

  /* ---------- 數字滾動計數 ---------- */
  const statsEl = document.querySelector(".stats");
  if (statsEl) {
    const countIO = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.querySelectorAll("[data-count]").forEach((el) => {
            const target = Number(el.dataset.count);
            const dur = 900;
            const t0 = performance.now();
            (function step(t) {
              const p = Math.min(1, (t - t0) / dur);
              el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
              if (p < 1) requestAnimationFrame(step);
            })(t0);
          });
          countIO.unobserve(e.target);
        }
      }
    }, { threshold: 0.5 });
    countIO.observe(statsEl);
  }

  /* ---------- Combo 彩蛋：點擊螢幕 ---------- */
  const layer = document.getElementById("combo-layer");
  let combo = 0;
  let resetTimer = null;
  const JUDGE = [
    { t: "PERFECT", cls: "perfect", w: 0.18 },
    { t: "GREAT", cls: "great", w: 0.32 },
    { t: "GOOD", cls: "good", w: 0.5 }
  ];

  function pickJudge() {
    const r = Math.random();
    let acc = 0;
    for (const j of JUDGE) {
      acc += j.w;
      if (r <= acc) return j;
    }
    return JUDGE[0];
  }

  window.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest("input, textarea, a, button, form")) return;
    clearTimeout(resetTimer);
    combo++;
    const j = pickJudge();
    const el = document.createElement("div");
    el.className = "combo-pop " + j.cls;
    el.style.left = ev.clientX + "px";
    el.style.top = ev.clientY + "px";
    el.innerHTML = combo > 1 ? j.t + "<small>COMBO ×" + combo + "</small>" : j.t;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 900);
    resetTimer = setTimeout(() => { combo = 0; }, 1600);
  });

})();
