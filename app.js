/* ════════════════════════════════════════════════════════════════
   SAND BLAST CIPSA · app.js  (vanilla JS, sin dependencias)
   Índice:
     01 Config y utilidades        07 Superficie de arenado (hero / proceso)
     02 Bucle maestro              08 Comparador de grados Sa
     03 Texto: split + rotador     09 Reveal, contadores, parallax, scroll
     04 Texturas procedurales      10 Navegación y menú
     05 Partículas ambientales     11 Pestañas, FAQ, video, formulario
     06 Loader                     12 Cursor, magnéticos, arranque
   ════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

/* ───────── 01 · CONFIG Y UTILIDADES ───────── */
// Número de WhatsApp del negocio (formato internacional sin "+")
const WA_NUMBER = '522223526068';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const LOWPOWER = (navigator.hardwareConcurrency || 4) <= 2 || !!(navigator.connection && navigator.connection.saveData);
const waLink = (msg) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;

/** Observa un elemento y llama a show/hide según su visibilidad. */
function whenVisible(el, show, hide, margin = '120px') {
  if (!('IntersectionObserver' in window)) { show(); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? show() : hide && hide())), { rootMargin: margin });
  io.observe(el);
}

/* ───────── 02 · BUCLE MAESTRO (un solo requestAnimationFrame para todo) ───────── */
const Loop = (() => {
  const tasks = new Set();
  let raf = 0, last = 0;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tasks.forEach((fn) => fn(now / 1000, dt));
    raf = tasks.size ? requestAnimationFrame(frame) : 0;
  };
  return {
    add(fn) { tasks.add(fn); if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
    remove(fn) { tasks.delete(fn); },
  };
})();

/* ───────── 03 · TEXTO: SPLIT POR PALABRAS + ROTADOR ───────── */
function splitWords(el) {
  let idx = 0;
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  const walk = (node, hl) => {
    Array.from(node.childNodes).forEach((ch) => {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
          const i = document.createElement('span'); i.className = 'wi' + (hl ? ' hl-w' : ''); i.style.setProperty('--wi', idx++); i.textContent = part;
          w.appendChild(i); frag.appendChild(w);
        });
        node.replaceChild(frag, ch);
      } else if (ch.nodeType === 1) {
        const isHl = ch.classList.contains('hl');
        if (isHl) ch.classList.add('is-split');
        walk(ch, hl || isHl);
      }
    });
  };
  walk(el, false);
}

function initRotator() {
  const el = $('#rot');
  if (!el || REDUCED) return;
  const words = el.dataset.words.split('|');
  let i = 0;
  setInterval(() => {
    el.classList.add('is-out');
    setTimeout(() => {
      i = (i + 1) % words.length;
      el.textContent = words[i];
      el.classList.remove('is-out'); el.classList.add('is-pre');
      void el.offsetWidth;
      el.classList.remove('is-pre');
    }, 480);
  }, 2800);
}

/* ───────── 04 · TEXTURAS PROCEDURALES (óxido + acero cepillado) ───────── */
const TEX = { S: 0, rust: null, steel: null, field: null, ready: false };

const NOISE = (() => {
  const N = 256, T = new Float32Array(N * N);
  let s = 20261009;
  const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < T.length; i++) T[i] = rnd();
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const x0 = xi & 255, y0 = yi & 255, x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255;
    const a = T[y0 * N + x0], b = T[y0 * N + x1], c = T[y1 * N + x0], d = T[y1 * N + x1];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y, o) => {
    let amp = 0.5, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < o; i++) { sum += amp * noise(x * f, y * f); norm += amp; amp *= 0.5; f *= 2.03; }
    return sum / norm;
  };
  return { noise, fbm };
})();

function makeLUT(stops) {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, c0] = stops[k], [t1, c1] = stops[k + 1];
    const f = clamp((t - t0) / (t1 - t0), 0, 1);
    for (let j = 0; j < 3; j++) lut[i * 3 + j] = c0[j] + (c1[j] - c0[j]) * f;
  }
  return lut;
}

/** Genera las texturas en bloques para no congelar la interfaz (alimenta el progreso del loader). */
function generateTextures(onProgress) {
  return new Promise((resolve) => {
    const S = innerWidth < 760 ? 640 : 960;
    const rust = mk(S, S), steel = mk(S, S);
    const rctx = rust.getContext('2d'), sctx = steel.getContext('2d');
    const rimg = rctx.createImageData(S, S), simg = sctx.createImageData(S, S);
    const rd = rimg.data, sd = simg.data, field = new Float32Array(S * S);
    const lut = makeLUT([[0, [30, 12, 6]], [0.22, [66, 26, 10]], [0.42, [120, 49, 16]], [0.6, [174, 75, 24]], [0.78, [220, 107, 38]], [1, [246, 152, 74]]]);
    const { noise, fbm } = NOISE;
    let y = 0;
    const rows = Math.ceil(S / 26);

    const chunk = () => {
      const end = Math.min(S, y + rows);
      for (; y < end; y++) {
        const ny = y / S;
        for (let x = 0; x < S; x++) {
          const nx = x / S, i = y * S + x, p = i * 4;
          /* — óxido — */
          const b = fbm(nx * 4.2 + 7.1, ny * 4.2 + 3.3, 5);
          const m = fbm(nx * 15 + 1.7, ny * 15 + 9.2, 4);
          let v = (b * 0.62 + m * 0.38 - 0.32) / 0.38; v = v < 0 ? 0 : v > 1 ? 1 : v;
          const rel = noise(nx * 34, ny * 34) - noise(nx * 34 + 0.35, ny * 34 + 0.35);
          const gr = noise(nx * 340, ny * 340) - 0.5;
          const pit = noise(nx * 72 + 20, ny * 72 + 5);
          let light = 1 + rel * 0.9 + gr * 0.35;
          if (pit > 0.84) light *= 0.5;
          if (gr > 0.36 && v > 0.55) light *= 1.3;
          const li = ((v * 255) | 0) * 3;
          rd[p] = lut[li] * light; rd[p + 1] = lut[li + 1] * light; rd[p + 2] = lut[li + 2] * light; rd[p + 3] = 255;
          field[i] = v + gr * 0.08;
          /* — acero cepillado — */
          const br = noise(nx * 2.2, ny * 190) * 0.5 + noise(nx * 7 + 3, ny * 70) * 0.35 + noise(nx * 26, ny * 24) * 0.15;
          const sh = 0.66 + br * 0.82;
          const base = 108 + (1 - (nx * 0.45 + ny * 0.55)) * 84;
          const spec = Math.max(0, 1 - Math.abs(nx * 0.8 + ny * 0.4 - 0.55) * 4.4) * 0.34;
          const L = base * sh * (1 + spec);
          sd[p] = L * 0.84; sd[p + 1] = L * 0.95; sd[p + 2] = L * 1.12; sd[p + 3] = 255;
        }
      }
      onProgress && onProgress(y / S);
      if (y < S) { setTimeout(chunk, 0); return; }

      rctx.putImageData(rimg, 0, 0); sctx.putImageData(simg, 0, 0);
      /* detalles de placa: juntas y remaches */
      [0.33, 0.66].forEach((f) => {
        sctx.fillStyle = 'rgba(0,0,0,.38)'; sctx.fillRect(0, S * f, S, 3);
        sctx.fillStyle = 'rgba(255,255,255,.22)'; sctx.fillRect(0, S * f + 3, S, 2);
        [0.07, 0.5, 0.93].forEach((bx) => {
          const g = sctx.createRadialGradient(S * bx - 3, S * f - 14, 1, S * bx, S * f - 11, S * 0.017);
          g.addColorStop(0, '#e9f0f8'); g.addColorStop(1, '#4b5b70');
          sctx.fillStyle = g; sctx.beginPath(); sctx.arc(S * bx, S * f - 11, S * 0.0125, 0, 7); sctx.fill();
        });
      });
      TEX.S = S; TEX.rust = rust; TEX.steel = steel; TEX.field = field;
      TEX.ready = true;
      resolve();
    };
    chunk();
  });
}

/** Dibuja una textura cuadrada cubriendo (cover) un lienzo de cualquier proporción. */
function drawCover(ctx, img, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/* ───────── 05 · PARTÍCULAS AMBIENTALES (brasas / abrasivo) ───────── */
class Embers {
  constructor(canvas, opt) {
    this.c = canvas; this.g = canvas.getContext('2d');
    this.count = opt.count; this.colors = opt.colors; this.blend = opt.blend || 'lighter'; this.up = opt.up !== false;
    this.sprites = this.colors.map((c) => {
      const s = mk(48, 48), g = s.getContext('2d'), gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
      gr.addColorStop(0, `rgba(${c},1)`); gr.addColorStop(0.28, `rgba(${c},.55)`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, 48, 48); return s;
    });
    this.p = []; this.mouse = { x: -999, y: -999 }; this.resize();
    for (let i = 0; i < this.count; i++) this.p.push(this.spawn(true));
    window.addEventListener('pointermove', (e) => { const r = this.c.getBoundingClientRect(); this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top; }, { passive: true });
  }
  resize() {
    const r = this.c.getBoundingClientRect(); this.w = r.width; this.h = r.height;
    const d = Math.min(devicePixelRatio || 1, 1.5);
    this.c.width = Math.round(this.w * d); this.c.height = Math.round(this.h * d); this.g.setTransform(d, 0, 0, d, 0, 0);
  }
  spawn(init) {
    const z = 0.25 + Math.random() * 0.75;
    return { x: Math.random() * this.w, y: init ? Math.random() * this.h : this.h + 20, z, s: (0.7 + Math.random() * 2.2) * z * 4.2, a: 0.25 + Math.random() * 0.7, ph: Math.random() * 6.28, k: (Math.random() * this.sprites.length) | 0, ox: 0, oy: 0 };
  }
  tick(t, dt) {
    const { g, w, h } = this;
    g.clearRect(0, 0, w, h); g.globalCompositeOperation = this.blend;
    for (const p of this.p) {
      p.x += (14 + p.z * 46) * dt + Math.sin(t * 0.6 + p.ph) * 6 * dt;
      p.y -= (10 + p.z * 40) * dt * (this.up ? 1 : -0.4);
      const dx = p.x - this.mouse.x, dy = p.y - this.mouse.y, d2 = dx * dx + dy * dy;
      if (d2 < 19600) { const f = (1 - Math.sqrt(d2) / 140) * 160 * dt; const d = Math.sqrt(d2) || 1; p.ox += (dx / d) * f; p.oy += (dy / d) * f; }
      p.ox *= 0.94; p.oy *= 0.94;
      if (p.x > w + 20 || p.y < -20 || p.y > h + 30) Object.assign(p, this.spawn(false), { x: Math.random() * w * 0.9 - 20 });
      const tw = 0.55 + 0.45 * Math.sin(t * 2 + p.ph);
      g.globalAlpha = p.a * tw;
      g.drawImage(this.sprites[p.k], p.x + p.ox - p.s, p.y + p.oy - p.s, p.s * 2, p.s * 2);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
}

/* ───────── 06 · LOADER ───────── */
function runLoader(realProgress) {
  return new Promise((resolve) => {
    const loader = $('#loader'), num = $('#ld-num'), fill = $('#ld-fill'), status = $('#ld-status');
    const msgs = ['Calibrando presión', 'Seleccionando abrasivo', 'Preparando la superficie', 'Generando perfil de anclaje', 'Todo listo'];
    const MIN = REDUCED ? 300 : 2500, t0 = performance.now();
    let shown = 0, finished = false;
    const finish = () => {
      if (finished) return; finished = true;
      num.textContent = '100'; fill.style.transform = 'scaleX(1)'; status.textContent = msgs[4];
      setTimeout(() => {
        loader.classList.add('is-done'); document.body.classList.remove('is-loading');
        setTimeout(() => { $('.hero').classList.add('hero-go'); resolve(); }, REDUCED ? 0 : 650);
        setTimeout(() => { loader.classList.add('is-gone'); loader.remove(); }, REDUCED ? 50 : 1500);
      }, REDUCED ? 0 : 380);
    };
    const tick = () => {
      if (finished) return;
      const timeP = clamp((performance.now() - t0) / MIN, 0, 1);
      const target = Math.min(realProgress(), 1 - Math.pow(1 - timeP, 2.2));
      shown += (target - shown) * 0.12;
      const pct = Math.min(99, Math.round(shown * 100));
      num.textContent = String(pct).padStart(3, '0'); fill.style.transform = `scaleX(${shown})`;
      status.textContent = msgs[Math.min(3, Math.floor(shown * 4))];
      if (shown > 0.985 && timeP >= 1 && realProgress() >= 0.999) finish(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(finish, 9000); // seguro: nunca dejar al usuario atrapado en el loader
  });
}

/* ───────── 07 · SUPERFICIE DE ARENADO (hero interactivo / proceso con scroll) ───────── */
class Blast {
  constructor(root, o = {}) {
    this.root = root; this.mode = o.mode || 'interactive'; this.onStats = o.onStats;
    this.cs = $('.bl-steel', root); this.cr = $('.bl-rust', root); this.cf = $('.bl-fx', root);
    this.gs = this.cs.getContext('2d'); this.gr = this.cr.getContext('2d'); this.gf = this.cf.getContext('2d');
    this.parts = []; this.acc = 0;
    this.rate = (o.rate || 10) * 60;
    this.ptr = { x: 0, y: 0, on: false, t: -99 };
    this.aim = { x: 0, y: 0 }; this.last = null; this.spray = this.mode === 'interactive';
    this.q = 0; this.lastQ = -1; this.statT = 0; this.visible = false;
    this.resize();
    if (this.mode === 'interactive') this.bind();
  }

  resize() {
    const w = this.root.clientWidth, h = this.root.clientHeight;
    if (!w || !h || !TEX.ready) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.6);
    this.w = w; this.h = h;
    [this.cs, this.cr, this.cf].forEach((c) => { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); });
    [this.gs, this.gr, this.gf].forEach((g) => g.setTransform(dpr, 0, 0, dpr, 0, 0));
    this.R = clamp(Math.min(w, h) * 0.1, 30, 60);
    this.origin = { x: w * 1.05, y: -h * 0.08 };
    this.rows = this.mode === 'scroll' ? 7 : 7;
    drawCover(this.gs, TEX.steel, w, h);
    this.paintRust(); this.initMask(); this.last = null;
    this.aim.x = w * 0.5; this.aim.y = h * 0.3;
    if (this.mode === 'scroll') { this.lastQ = -1; this.setQ(this.q); }
    if (REDUCED && this.mode === 'interactive') this.staticClean();
  }

  paintRust() { const g = this.gr; g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, this.w, this.h); drawCover(g, TEX.rust, this.w, this.h); }

  /* Máscara de limpieza (media resolución). Cada celda guarda cuánto se limpió (0‒1) y se
     "disuelve" con el ruido del propio óxido: el óxido vuelve primero por las picaduras oscuras. */
  initMask() {
    if (this.mode !== 'interactive') return;
    const mw = Math.ceil(this.w / 2), mh = Math.ceil(this.h / 2), S = TEX.S, sc = Math.max(this.w / S, this.h / S);
    const ox = (this.w - S * sc) / 2, oy = (this.h - S * sc) / 2;
    this.mw = mw; this.mh = mh; this.C = new Float32Array(mw * mh); this.F = new Float32Array(mw * mh);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const tx = clamp(Math.round((x * 2 - ox) / sc), 0, S - 1), ty = clamp(Math.round((y * 2 - oy) / sc), 0, S - 1);
      this.F[y * mw + x] = clamp(TEX.field[ty * S + tx], 0, 1) * 0.9;
    }
    this.mc = mk(mw, mh); this.mg = this.mc.getContext('2d'); this.mimg = this.mg.createImageData(mw, mh);
  }

  /** Recalcula qué parte del óxido sigue visible y la aplica sobre la capa de óxido. */
  renderMask(dt) {
    const { C, F, mw, mh } = this, d = this.mimg.data, n = mw * mh, decay = dt * 0.17;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      let c = C[i];
      if (c > 0) { c -= decay; if (c < 0) c = 0; C[i] = c; }
      const x = ((1 - c) - F[i]) / 0.16 + 0.5, v = x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
      d[i * 4 + 3] = (1 - v) * 255; sum += 1 - v;
    }
    this.mg.putImageData(this.mimg, 0, 0);
    const g = this.gr; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, this.w, this.h); drawCover(g, TEX.rust, this.w, this.h);
    g.globalCompositeOperation = 'destination-out'; g.imageSmoothingEnabled = true; g.drawImage(this.mc, 0, 0, this.w, this.h);
    g.globalCompositeOperation = 'source-over';
    this.clean = sum / n;
  }

  /** Modo movimiento reducido: una franja limpia fija, sin animación. */
  staticClean() {
    const { w, h } = this;
    for (let i = 0; i <= 26; i++) { const f = i / 26; this.stamp(w * (0.15 + f * 0.7), h * (0.78 - f * 0.55), this.R * 1.1); }
    this.renderMask(0); this.onStats && this.onStats(this.clean);
  }

  bind() {
    const f = this.root;
    const pos = (e) => { const r = f.getBoundingClientRect(); return { x: (e.clientX - r.left) * (this.w / r.width), y: (e.clientY - r.top) * (this.h / r.height) }; };
    const move = (e) => { const p = pos(e); this.ptr.x = p.x; this.ptr.y = p.y; this.ptr.on = true; this.ptr.t = performance.now() / 1000; $('#hud-hint') && $('#hud-hint').classList.add('is-hidden'); };
    f.addEventListener('pointermove', move, { passive: true });
    f.addEventListener('pointerdown', (e) => { move(e); this.aim.x = this.ptr.x; this.aim.y = this.ptr.y; }, { passive: true });
    f.addEventListener('pointerleave', () => { this.ptr.on = false; });
    f.addEventListener('pointercancel', () => { this.ptr.on = false; });
  }

  stamp(x, y, r) {
    const { C, mw, mh } = this, mx = x / 2, my = y / 2, mr = r / 2;
    const x0 = Math.max(0, Math.floor(mx - mr)), x1 = Math.min(mw - 1, Math.ceil(mx + mr));
    const y0 = Math.max(0, Math.floor(my - mr)), y1 = Math.min(mh - 1, Math.ceil(my + mr));
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      const f = 1 - Math.hypot(xx - mx, yy - my) / mr;
      if (f > 0) { const v = f * 1.7 > 1 ? 1 : f * 1.7, i = yy * mw + xx; if (v > C[i]) C[i] = v; }
    }
  }

  strokeTo(x, y) {
    if (!this.last) this.last = { x, y };
    const dx = x - this.last.x, dy = y - this.last.y, d = Math.hypot(dx, dy), step = this.R * 0.3, n = Math.max(1, Math.ceil(d / step));
    for (let i = 1; i <= n; i++) this.stamp(this.last.x + (dx * i) / n, this.last.y + (dy * i) / n, this.R * (0.92 + Math.random() * 0.16));
    this.last = { x, y };
  }

  autoPos(t) {
    const { w, h } = this, m = this.R * 0.7, rows = this.rows, T = t / 1.0, r = Math.floor(T) % (rows * 2);
    const rr = r < rows ? r : rows * 2 - 1 - r, f = T - Math.floor(T), e = 0.5 - 0.5 * Math.cos(Math.PI * f);
    const x = r % 2 === 0 ? lerp(m, w - m, e) : lerp(w - m, m, e);
    return { x, y: lerp(m + 34, h - m - 88, rr / (rows - 1)) + Math.sin(f * Math.PI * 2) * 7 };
  }

  /* — modo scroll: dibuja la ruta de arenado hasta el progreso q (0‒1) — */
  rasterPts(q) {
    const { w, h } = this, rows = this.rows, m = 26, xL = m, xR = w - m, yT = 44, yB = h - 96, rowH = (yB - yT) / (rows - 1), s = q * rows, pts = [];
    this.rowH = rowH;
    for (let r = 0; r < rows && s > r; r++) {
      const f = Math.min(1, s - r), y = yT + rowH * r, dir = r % 2 === 0 ? 1 : -1, xs = dir > 0 ? xL : xR, xe = dir > 0 ? xR : xL;
      pts.push({ x: xs, y }); pts.push({ x: lerp(xs, xe, f), y });
    }
    return pts;
  }

  setQ(q) {
    this.q = q;
    if (!this.w || Math.abs(q - this.lastQ) < 0.0006) return;
    this.lastQ = q;
    const g = this.gr, { w, h } = this, pts = this.rasterPts(q);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, w, h); drawCover(g, TEX.rust, w, h);
    if (pts.length > 1) {
      g.globalCompositeOperation = 'destination-out'; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = this.rowH * 1.8; g.stroke();
      g.strokeStyle = '#000'; g.lineWidth = this.rowH * 1.1; g.stroke();
      g.globalCompositeOperation = 'source-over';
    }
    const head = pts.length ? pts[pts.length - 1] : { x: 26, y: 44 };
    this.head = head;
  }

  emit(dt) {
    this.acc += dt * this.rate;
    const o = this.origin, a = this.aim, dx = a.x - o.x, dy = a.y - o.y, dist = Math.hypot(dx, dy) || 1, ux = dx / dist, uy = dy / dist, speed = Math.max(1000, dist * 3.4);
    while (this.acc >= 1) {
      this.acc--;
      const sp = (Math.random() - 0.5) * 0.07, c = Math.cos(sp), s = Math.sin(sp), v = speed * (0.9 + Math.random() * 0.2);
      this.parts.push({ k: 0, x: o.x + (Math.random() - 0.5) * 10, y: o.y + (Math.random() - 0.5) * 10, vx: (ux * c - uy * s) * v, vy: (ux * s + uy * c) * v, t: 0, life: (dist / v) * (0.96 + Math.random() * 0.08) });
    }
  }

  step(dt) {
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.t += dt;
      if (p.k === 0) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.t >= p.life) {
          if (P.length < 420) {
            if (Math.random() < 0.5) for (let n = 0; n < 2; n++) { const an = Math.random() * 6.28, sp = 120 + Math.random() * 380; P.push({ k: 1, x: p.x, y: p.y, vx: Math.cos(an) * sp - 60, vy: Math.sin(an) * sp - 160, t: 0, life: 0.35 + Math.random() * 0.45 }); }
            if (Math.random() < 0.16) P.push({ k: 2, x: p.x, y: p.y, vx: -20 + Math.random() * 40, vy: -30 - Math.random() * 30, t: 0, life: 0.9 + Math.random() * 0.6, r: 6 });
          }
          P[i] = P[P.length - 1]; P.pop();
        }
      } else if (p.k === 1) {
        p.vy += 760 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.t >= p.life) { P[i] = P[P.length - 1]; P.pop(); }
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 34;
        if (p.t >= p.life) { P[i] = P[P.length - 1]; P.pop(); }
      }
    }
  }

  draw(t) {
    const g = this.gf, { w, h, R } = this, a = this.aim;
    g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    if (this.spray) {
      const gl = g.createRadialGradient(a.x, a.y, 0, a.x, a.y, R * 1.7);
      gl.addColorStop(0, 'rgba(255,176,100,.6)'); gl.addColorStop(0.35, 'rgba(255,106,26,.24)'); gl.addColorStop(1, 'rgba(255,106,26,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(a.x, a.y, R * 1.7, 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(255,240,224,.6)'; g.lineWidth = 1.3; g.beginPath();
    for (const p of this.parts) if (p.k === 0) { g.moveTo(p.x - p.vx * 0.013, p.y - p.vy * 0.013); g.lineTo(p.x, p.y); }
    g.stroke();
    g.globalCompositeOperation = 'source-over';
    for (const p of this.parts) if (p.k === 2) { g.fillStyle = `rgba(214,190,160,${0.16 * (1 - p.t / p.life)})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); }
    g.globalCompositeOperation = 'lighter';
    for (const p of this.parts) if (p.k === 1) { const f = 1 - p.t / p.life; g.fillStyle = `rgba(255,${150 + 90 * f | 0},${70 + 60 * f | 0},${f})`; g.fillRect(p.x - 1, p.y - 1, 2.4, 2.4); }
    g.globalCompositeOperation = 'source-over';
    if (this.spray) { // mira de enfoque
      g.save(); g.translate(a.x, a.y); g.rotate(t * 1.3);
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1; g.setLineDash([5, 8]); g.beginPath(); g.arc(0, 0, R * 0.9, 0, 7); g.stroke();
      g.setLineDash([]); g.strokeStyle = 'rgba(255,106,26,.95)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R * 0.9, 0, 1.1); g.stroke();
      g.restore();
    }
  }

  tick(t, dt) {
    if (!this.w) return;
    if (this.mode === 'interactive') {
      const idle = !this.ptr.on || t - this.ptr.t > 2.2;
      const tg = idle ? this.autoPos(t) : this.ptr;
      const k = 1 - Math.exp(-dt * (idle ? 8 : 18));
      this.aim.x += (tg.x - this.aim.x) * k; this.aim.y += (tg.y - this.aim.y) * k;
      this.strokeTo(this.aim.x, this.aim.y);
      this.renderMask(dt);
      this.statT += dt; if (this.statT > 0.2) { this.statT = 0; this.onStats && this.onStats(this.clean); }
    } else if (this.head) {
      const k = 1 - Math.exp(-dt * 12);
      this.aim.x += (this.head.x - this.aim.x) * k; this.aim.y += (this.head.y - this.aim.y) * k;
    }
    if (this.spray) { this.emit(dt); } else { this.acc = 0; }
    this.step(dt); this.draw(t);
  }

  start() { if (this.visible || REDUCED) return; this.visible = true; this._f = (t, dt) => this.tick(t, dt); Loop.add(this._f); }
  stop() { this.visible = false; Loop.remove(this._f); }
}

/* — Hero: placa oxidada interactiva + lecturas HUD — */
function initHeroBlast() {
  const frame = $('.blast-frame'); if (!frame) return;
  const cleanEl = $('#hud-clean'), bar = $('#hud-bar'), psi = $('#hud-psi');
  let shown = 0, tgt = 0;
  const blast = new Blast(frame, {
    mode: 'interactive', rate: innerWidth < 760 ? 6 : 10,
    onStats: (c) => { tgt = c; },
  });
  Loop.add((t) => {
    shown += (tgt - shown) * 0.12;
    cleanEl.textContent = Math.round(shown * 100);
    bar.style.transform = `scaleX(${shown})`;
    psi.textContent = 100 + Math.round(Math.sin(t * 3.1) * 1.4 + Math.sin(t * 7.3) * 0.8);
  });
  whenVisible(frame, () => blast.start(), () => blast.stop(), '50px');
  new ResizeObserver(debounce(() => { blast.resize(); }, 200)).observe(frame);
}

/* — Proceso: el panel se "limpia" y se protege según el scroll — */
function initProcess() {
  const grid = $('#proc'), panel = $('#proc-panel'), steps = $$('.step'), list = $('#proc-steps'), sticky = $('.proc-sticky');
  if (!grid) return;
  const blast = new Blast(panel, { mode: 'scroll', rate: innerWidth < 760 ? 6 : 9 });
  const names = ['Diagnóstico', 'Preparación del área', 'Arenado', 'Protección y entrega'];
  const stageEl = $('#pp-stage'), nameEl = $('#pp-name'), pctEl = $('#pp-pct'), arc = $('#pp-arc');
  let u = 0, uShown = 0, stage = -1, visible = false;

  const compute = () => {
    const vh = innerHeight, first = steps[0].getBoundingClientRect(), last = steps[3].getBoundingClientRect();
    const desktop = innerWidth >= 980;
    const ref = desktop ? vh * 0.5 : (sticky.getBoundingClientRect().bottom + vh) / 2;
    const c0 = first.top + first.height / 2, c3 = last.top + last.height / 2;
    u = clamp(((ref - c0) / (c3 - c0)) * 3, 0, 3);
  };

  const tick = (t, dt) => {
    compute();
    uShown += (u - uShown) * (1 - Math.exp(-dt * 6));
    const us = uShown, st = clamp(Math.round(us), 0, 3), p = us / 3;
    blast.setQ(clamp(us - 1.5, 0, 1));
    blast.spray = us > 1.5 && us < 2.5;
    const cp = clamp((us - 2.5) / 0.5, 0, 1);
    panel.style.setProperty('--cp', cp.toFixed(3));
    panel.classList.toggle('is-done', cp > 0.97);
    if (st !== stage) {
      stage = st; panel.dataset.stage = st;
      stageEl.textContent = `0${st + 1} / 04`; nameEl.textContent = names[st];
      steps.forEach((s, i) => s.classList.toggle('is-active', i === st));
    }
    pctEl.textContent = Math.round(p * 100) + '%'; arc.style.strokeDashoffset = 100 - p * 100;
    blast.tick(t, dt);
  };

  const run = () => { if (visible) return; visible = true; Loop.add(tick); };
  const halt = () => { visible = false; Loop.remove(tick); };
  whenVisible(grid, run, halt, '200px');
  if (REDUCED) { compute(); blast.setQ(clamp(u - 1.5, 0, 1)); }
  new ResizeObserver(debounce(() => blast.resize(), 200)).observe(panel);
  steps[0].classList.add('is-active');
}

/* ───────── 08 · COMPARADOR DE GRADOS Sa ───────── */
const GRADES = [
  { k: 'Limpieza ligera', t: 'Sa 1', d: 'Se elimina la escama suelta, el óxido suelto y la pintura mal adherida. Quedan residuos firmemente adheridos y la superficie conserva parte de su aspecto original. Útil para exposiciones leves o repintados de baja exigencia.', ssp: 'SSPC-SP 7', res: '≈ 35 %', use: 'Repintados de baja exigencia', cov: 0.38, al: 1 },
  { k: 'Limpieza a fondo', t: 'Sa 2', d: 'Casi toda la escama, el óxido y la pintura se elimina. Pueden quedar manchas o residuos firmemente adheridos en forma de vetas o puntos. Buen equilibrio entre costo y desempeño en ambientes moderados.', ssp: 'SSPC-SP 6', res: '≈ 15 %', use: 'Herrería, maquinaria, ambientes moderados', cov: 0.15, al: 0.95 },
  { k: 'Limpieza muy a fondo · casi metal blanco', t: 'Sa 2½', d: 'No quedan a la vista aceite, grasa, suciedad, escama, óxido ni pintura. Solo se aceptan ligeras sombras o vetas en la superficie. Es el grado que piden la mayoría de los recubrimientos industriales de alto desempeño.', ssp: 'SSPC-SP 10', res: '≈ 5 %', use: 'Estructuras, tanques, ambientes agresivos', cov: 0.06, al: 0.6 },
  { k: 'Limpieza hasta metal visualmente limpio', t: 'Sa 3', d: 'La superficie queda con un color metálico uniforme: sin rastro visible de escama, óxido, pintura ni contaminantes. Es el máximo nivel de limpieza, para servicios críticos como inmersión o químicos agresivos.', ssp: 'SSPC-SP 5', res: '≈ 0 %', use: 'Inmersión, ambientes químicos, servicio crítico', cov: 0, al: 0 },
];

function initGrades() {
  const cmp = $('#cmp'); if (!cmp) return;
  const ca = $('.cmp-a', cmp), cb = $('.cmp-b', cmp), handle = $('#cmp-handle'), seg = $('#seg'), btns = $$('button', seg);
  const ga = ca.getContext('2d'), gb = cb.getContext('2d');
  const masked = [];
  let grade = 2, userMoved = false;

  const rustFor = (i) => {
    if (masked[i]) return masked[i];
    const S = TEX.S, f = TEX.field, G = GRADES[i], c = mk(S, S), g = c.getContext('2d');
    g.drawImage(TEX.rust, 0, 0);
    if (G.cov < 1) {
      const hist = new Uint32Array(256);
      for (let k = 0; k < f.length; k++) hist[clamp((f[k] * 255) | 0, 0, 255)]++;
      let acc = 0, thr = 255; const want = f.length * (1 - G.cov);
      for (let k = 0; k < 256; k++) { acc += hist[k]; if (acc >= want) { thr = k / 255; break; } }
      const img = g.getImageData(0, 0, S, S), d = img.data;
      for (let k = 0; k < f.length; k++) { const x = (f[k] - thr) / 0.035 + 0.5; d[k * 4 + 3] = G.cov === 0 ? 0 : 255 * G.al * (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x)); }
      g.putImageData(img, 0, 0);
    }
    return (masked[i] = c);
  };

  const paint = () => {
    const w = cmp.clientWidth, h = cmp.clientHeight; if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.6);
    [ca, cb].forEach((c) => { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); });
    ga.setTransform(dpr, 0, 0, dpr, 0, 0); gb.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCover(ga, TEX.rust, w, h);
    drawCover(gb, TEX.steel, w, h); drawCover(gb, rustFor(grade), w, h);
  };

  const setPos = (pct) => {
    pct = clamp(pct, 2, 98); cmp.style.setProperty('--pos', pct + '%'); handle.setAttribute('aria-valuenow', Math.round(pct));
  };
  const posFrom = (e) => { const r = cmp.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; };

  let drag = false;
  const down = (e) => { drag = true; userMoved = true; cmp.classList.add('is-drag'); cmp.setPointerCapture(e.pointerId); setPos(posFrom(e)); };
  cmp.addEventListener('pointerdown', down);
  cmp.addEventListener('pointermove', (e) => { if (drag) setPos(posFrom(e)); });
  const up = () => { drag = false; cmp.classList.remove('is-drag'); };
  cmp.addEventListener('pointerup', up); cmp.addEventListener('pointercancel', up);
  handle.addEventListener('keydown', (e) => {
    const cur = parseFloat(handle.getAttribute('aria-valuenow'));
    if (e.key === 'ArrowLeft') { setPos(cur - 5); e.preventDefault(); userMoved = true; }
    if (e.key === 'ArrowRight') { setPos(cur + 5); e.preventDefault(); userMoved = true; }
  });

  const select = (i, byUser) => {
    grade = i; const G = GRADES[i];
    btns.forEach((b, k) => b.setAttribute('aria-selected', k === i ? 'true' : 'false'));
    seg.style.setProperty('--i', i);
    $('#g-k').textContent = G.k; $('#g-title').textContent = G.t; $('#g-desc').textContent = G.d;
    $('#g-ssp').textContent = G.ssp; $('#g-res').textContent = G.res; $('#g-use').textContent = G.use;
    $('#cmp-tag-r').textContent = 'Después · ' + G.t;
    $('#g-cta-t').textContent = `Quiero cotizar con grado ${G.t}`;
    const cta = $('#g-cta'); cta.dataset.wa = `Hola CIPSA, quiero cotizar un arenado con grado ${G.t}.`; cta.href = waLink(cta.dataset.wa);
    if (TEX.ready) { const w = cmp.clientWidth, h = cmp.clientHeight; gb.clearRect(0, 0, w, h); drawCover(gb, TEX.steel, w, h); drawCover(gb, rustFor(i), w, h); }
    if (byUser) { $('.grade-body').classList.remove('is-swap'); void $('.grade-body').offsetWidth; $('.grade-body').classList.add('is-swap'); cb.classList.remove('is-swap'); void cb.offsetWidth; cb.classList.add('is-swap'); }
  };
  btns.forEach((b, i) => b.addEventListener('click', () => select(i, true)));
  seg.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const n = clamp(grade + (e.key === 'ArrowRight' ? 1 : -1), 0, 3); select(n, true); btns[n].focus(); e.preventDefault();
  });

  paint(); select(2, false);
  new ResizeObserver(debounce(() => { paint(); }, 200)).observe(cmp);

  // Demostración automática del divisor la primera vez que se ve
  if (!REDUCED) {
    let played = false;
    whenVisible(cmp, () => {
      if (played) return; played = true;
      const t0 = performance.now(), seq = [[0, 50], [0.9, 18], [1.9, 78], [2.8, 50]];
      const run = (now) => {
        if (userMoved) return;
        const s = (now - t0) / 1000;
        let k = 0; while (k < seq.length - 2 && s > seq[k + 1][0]) k++;
        const [a, b] = [seq[k], seq[k + 1]], f = clamp((s - a[0]) / (b[0] - a[0]), 0, 1), e = 0.5 - 0.5 * Math.cos(Math.PI * f);
        setPos(lerp(a[1], b[1], e));
        if (s < seq[seq.length - 1][0]) requestAnimationFrame(run);
      };
      setTimeout(() => requestAnimationFrame(run), 500);
    }, null, '-20%');
  }
}

/* ───────── 09 · REVEAL, CONTADORES, PARALLAX, SCROLL ───────── */
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

function initReveal() {
  $$('[data-split]').forEach(splitWords);
  $$('[data-stagger]').forEach((g) => $$('[data-reveal]', g).forEach((el, i) => el.style.setProperty('--i', i % 6)));
  if (!('IntersectionObserver' in window) || REDUCED) { $$('[data-reveal],[data-split]').forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
  $$('[data-reveal],[data-split]:not([data-split="hero"])').forEach((el) => io.observe(el));
}

function initCounters() {
  const fmt = new Intl.NumberFormat('es-MX');
  const els = $$('[data-count]');
  const run = (el) => {
    const to = +el.dataset.count, dur = 1900, t0 = performance.now();
    if (REDUCED || to === 0) { el.textContent = fmt.format(to); return; }
    const f = (now) => {
      const p = clamp((now - t0) / dur, 0, 1);
      el.textContent = fmt.format(p >= 1 ? to : Math.round(to * (1 - Math.pow(2, -10 * p))));
      if (p < 1) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  };
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }), { threshold: 0.6 });
  els.forEach((e) => io.observe(e));
}

function initScrollFX() {
  const prog = $('#progress'), nav = $('#nav'), hv = $('.hero-visual'), hc = $('.hero-copy');
  const pillars = $$('[data-progress]').map((el) => ({ el, cur: 0 }));
  const cards = $$('.vcard[data-par]').map((el) => ({ el, k: el.dataset.par === '1' ? -0.075 : 0.05, cur: 0 }));
  let lastY = -1;
  Loop.add((t, dt) => {
    const y = window.scrollY, vh = innerHeight;
    const settle = pillars.some((p) => p.settling) || cards.some((c) => c.settling);
    if (y === lastY && !settle) return;
    lastY = y;
    const max = document.documentElement.scrollHeight - vh;
    prog.style.setProperty('--sp', max > 0 ? (y / max).toFixed(4) : 0);
    nav.classList.toggle('is-stuck', y > 24);
    if (y < vh * 1.2) {
      const hp = clamp(y / (vh * 0.9), 0, 1);
      if (hv) hv.style.transform = `translate3d(0,${hp * 50}px,0) scale(${1 - hp * 0.05})`;
      if (hc) { hc.style.transform = `translate3d(0,${hp * -26}px,0)`; hc.style.opacity = 1 - hp * 0.75; }
    }
    const k = 1 - Math.exp(-dt * 7);
    pillars.forEach((p) => {
      const r = p.el.getBoundingClientRect();
      const target = REDUCED ? 1 : clamp((vh * 0.86 - r.top) / (vh * 0.5), 0, 1);
      p.cur += (target - p.cur) * k; p.settling = Math.abs(target - p.cur) > 0.002;
      p.el.style.setProperty('--p', p.cur.toFixed(4));
    });
    if (innerWidth >= 900 && !REDUCED) cards.forEach((c) => {
      const r = c.el.getBoundingClientRect(), target = (r.top + r.height / 2 - vh / 2) * c.k;
      c.cur += (target - c.cur) * k; c.settling = Math.abs(target - c.cur) > 0.2;
      c.el.style.transform = `translate3d(0,${c.cur.toFixed(1)}px,0)`;
    });
  });
  // Movimiento de las tarjetas flotantes del hero con el puntero
  if (FINE && !REDUCED && hv) {
    const hero = $('.hero');
    hero.addEventListener('pointermove', (e) => { const r = hero.getBoundingClientRect(); hv.style.setProperty('--hx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3)); hv.style.setProperty('--hy', ((e.clientY - r.top) / r.height - 0.5).toFixed(3)); }, { passive: true });
  }
}

/* ───────── 10 · NAVEGACIÓN Y MENÚ ───────── */
function initNav() {
  const burger = $('#burger'), menu = $('#menu'), main = $('#contenido');
  $$('.menu-nav a').forEach((a, i) => a.style.setProperty('--k', i));
  const setMenu = (open) => {
    burger.setAttribute('aria-expanded', open); burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    menu.classList.toggle('is-open', open); menu.setAttribute('aria-hidden', !open);
    document.body.classList.toggle('no-scroll', open);
    open ? main.setAttribute('inert', '') : main.removeAttribute('inert');
  };
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false); });
  addEventListener('resize', () => { if (innerWidth >= 1080 && menu.classList.contains('is-open')) setMenu(false); });

  // Sección activa en el menú
  const links = $$('.nav-links a[data-spy]'), map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { const a = map.get(e.target.id); if (a && e.isIntersecting) { links.forEach((l) => l.classList.remove('is-active')); a.classList.add('is-active'); } }), { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); s && io.observe(s); });
    const hero = $('#inicio'); new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && links.forEach((l) => l.classList.remove('is-active'))), { rootMargin: '-45% 0px -50% 0px' }).observe(hero);
  }
}

/* ───────── 11 · PESTAÑAS, FAQ, VIDEO, FORMULARIO ───────── */
function initTabs() {
  const tabs = $$('#tab-list [role="tab"]'), panels = $$('.tab-panel'), cta = $('#tab-cta'), txt = $('#tab-cta-t');
  const select = (i, focus) => {
    tabs.forEach((t, k) => { t.setAttribute('aria-selected', k === i); t.tabIndex = k === i ? 0 : -1; });
    panels.forEach((p, k) => { p.hidden = k !== i; });
    const target = panels[i].dataset.target;
    txt.textContent = `Quiero esto para ${target}`;
    cta.dataset.wa = `Hola CIPSA, quiero cotizar el arenado de ${target}.`; cta.href = waLink(cta.dataset.wa);
    if (focus) tabs[i].focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', (e) => {
      const n = tabs.length; let k = i;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') k = (i + 1) % n;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') k = (i - 1 + n) % n;
      else if (e.key === 'Home') k = 0; else if (e.key === 'End') k = n - 1; else return;
      e.preventDefault(); select(k, true);
    });
  });
}

function initFaq() {
  const items = $$('.qa'), ease = 'cubic-bezier(.16,1,.3,1)';
  const close = (d) => {
    const a = $('.qa-a', d), h = a.offsetHeight;
    d.dataset.busy = 1;
    const an = a.animate([{ height: h + 'px' }, { height: '0px' }], { duration: REDUCED ? 1 : 420, easing: ease, fill: 'forwards' });
    an.onfinish = () => { d.open = false; an.cancel(); delete d.dataset.busy; };
  };
  const open = (d) => {
    d.open = true; const a = $('.qa-a', d), h = a.offsetHeight; d.dataset.busy = 1;
    const an = a.animate([{ height: '0px' }, { height: h + 'px' }], { duration: REDUCED ? 1 : 560, easing: ease });
    an.onfinish = () => { delete d.dataset.busy; };
  };
  items.forEach((d) => $('summary', d).addEventListener('click', (e) => {
    e.preventDefault(); if (d.dataset.busy) return;
    if (d.open) close(d); else { items.forEach((o) => o !== d && o.open && close(o)); open(d); }
  }));
}

function initVideos() {
  const vids = $$('.vcard video'), dlg = $('#lightbox'), lv = $('#lb-video'), lt = $('#lb-title');
  const auto = !REDUCED && !LOWPOWER;
  if (auto && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; v.play().catch(() => {}); } else v.pause();
    }), { threshold: 0.55 });
    vids.forEach((v) => io.observe(v));
  }
  $$('.vbtn').forEach((b) => b.addEventListener('click', () => {
    lv.src = b.dataset.video; lt.textContent = b.dataset.title;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    lv.currentTime = 0; lv.play().catch(() => {});
  }));
  const shut = () => { lv.pause(); lv.removeAttribute('src'); lv.load(); };
  $('#lb-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', shut);
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.classList.contains('lb-in')) dlg.close(); });
}

function initForm() {
  const form = $('#wa-form'); if (!form) return;
  const name = $('#f-name'), note = $('#form-note'), card = form.closest('.form-card');
  const setErr = (field, msg) => { field.classList.toggle('is-invalid', !!msg); const e = $('.err', field); if (e) e.textContent = msg || ''; };
  name.addEventListener('input', () => setErr(name.closest('.field'), ''));
  $$('input[name="superficie"]', form).forEach((r) => r.addEventListener('change', () => setErr(r.closest('.field'), '')));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = (n) => (new FormData(form).get(n) || '').toString().trim();
    let ok = true;
    if (val('nombre').length < 2) { setErr(name.closest('.field'), 'Escribe tu nombre para saber con quién hablamos.'); ok = false; }
    if (!val('superficie')) { setErr($('input[name="superficie"]', form).closest('.field'), 'Elige qué quieres arenar.'); ok = false; }
    if (!ok) { const bad = $('.is-invalid', form); bad && bad.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' }); return; }
    const lines = [`Hola CIPSA, soy ${val('nombre')}.`, `Quiero cotizar el arenado de: ${val('superficie')}.`];
    if (val('tamano')) lines.push(`Tamaño aproximado: ${val('tamano')}.`);
    if (val('mensaje')) lines.push(`Detalles: ${val('mensaje')}`);
    if (val('telefono')) lines.push(`Mi teléfono: ${val('telefono')}`);
    lines.push('(Mensaje enviado desde la página web)');
    window.open(waLink(lines.join('\n')), '_blank', 'noopener');
    card.classList.add('is-sent'); note.textContent = '¡Listo! Se abrió WhatsApp con tu mensaje. Solo falta que lo envíes.';
    setTimeout(() => { card.classList.remove('is-sent'); note.textContent = 'Se abrirá WhatsApp con tu mensaje listo. Respondemos lo antes posible.'; }, 7000);
  });
}

function initWaFloat() {
  const fl = $('#wa-float'), bub = $('#wa-bubble');
  const msgs = ['¿Cotizamos tu proyecto?', 'Cotización sin costo', 'Respondemos por WhatsApp', '¿Tienes una duda? Escríbenos'];
  let i = 0;
  const cycle = () => { bub.textContent = msgs[i++ % msgs.length]; bub.classList.add('is-show'); setTimeout(() => bub.classList.remove('is-show'), 4200); };
  setTimeout(() => { fl.classList.add('is-in'); }, 400);
  // En móvil el globo aparece una sola vez para no tapar contenido
  if (innerWidth < 760) { setTimeout(cycle, 6000); return; }
  setTimeout(() => { cycle(); setInterval(cycle, 12000); }, 4500);
}

/* ───────── 12 · CURSOR, MAGNÉTICOS, SPOTLIGHT, ARRANQUE ───────── */
function initPointerFX() {
  // Spotlight que sigue al cursor (tarjetas)
  $$('.spot').forEach((el) => el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); el.style.setProperty('--mx', e.clientX - r.left + 'px'); el.style.setProperty('--my', e.clientY - r.top + 'px'); }, { passive: true }));
  if (!FINE || REDUCED) return;
  // Botones magnéticos
  $$('[data-magnetic]').forEach((b) => {
    b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${clamp((e.clientX - r.left - r.width / 2) * 0.22, -10, 10)}px,${clamp((e.clientY - r.top - r.height / 2) * 0.3, -8, 8)}px)`; });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });
  // Cursor personalizado
  const cur = $('#cursor'); if (!cur) return;
  let x = -100, y = -100, cx = x, cy = y;
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; cur.classList.add('is-on'); cur.classList.toggle('is-hover', !!e.target.closest('a, button, summary, [data-cursor], .cmp')); }, { passive: true });
  document.addEventListener('pointerleave', () => cur.classList.remove('is-on'));
  Loop.add(() => { cx += (x - cx) * 0.2; cy += (y - cy) * 0.2; cur.style.transform = `translate3d(${cx}px,${cy}px,0)`; });
}

function initLinks() {
  $$('[data-wa]').forEach((a) => { a.href = waLink(a.dataset.wa); });
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  $$('[data-marquee]').forEach((t) => { t.innerHTML += t.innerHTML; });
}

function initAmbient() {
  const hero = $('#fx-hero'), cta = $('#fx-cta');
  if (hero && !REDUCED) {
    const e = new Embers(hero, { count: innerWidth < 760 ? 34 : LOWPOWER ? 40 : 84, colors: ['255,138,64', '255,106,26', '255,226,200', '150,185,220'] });
    let on = false; const f = (t, dt) => e.tick(t, dt);
    whenVisible(hero.parentElement, () => { if (!on) { on = true; Loop.add(f); } }, () => { on = false; Loop.remove(f); }, '80px');
    new ResizeObserver(debounce(() => e.resize(), 200)).observe(hero);
  }
  if (cta && !REDUCED) {
    const e = new Embers(cta, { count: innerWidth < 760 ? 26 : 60, colors: ['255,255,255', '6,25,41', '255,236,214'], blend: 'source-over' });
    let on = false; const f = (t, dt) => e.tick(t, dt);
    whenVisible(cta.parentElement, () => { if (!on) { on = true; Loop.add(f); } }, () => { on = false; Loop.remove(f); }, '80px');
    new ResizeObserver(debounce(() => e.resize(), 200)).observe(cta);
  }
}

/* — Arranque — */
function boot() {
  initLinks(); initReveal(); initNav(); initTabs(); initFaq(); initVideos(); initForm(); initPointerFX(); initScrollFX(); initRotator(); initCounters(); initWaFloat();

  let texP = 0, fontsP = 0, loadP = document.readyState === 'complete' ? 1 : 0;
  addEventListener('load', () => { loadP = 1; });
  const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  fonts.then(() => { fontsP = 1; }); setTimeout(() => { fontsP = 1; }, 3500);

  const texReady = generateTextures((p) => { texP = p; }).then(() => { texP = 1; });
  runLoader(() => Math.min(1, texP * 0.72 + fontsP * 0.14 + loadP * 0.14));

  texReady.then(() => {
    try { initHeroBlast(); initProcess(); initGrades(); initAmbient(); } catch (err) { console.error('CIPSA init:', err); }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
