/* Hilbert vs Z-order: why PTv3 serializes points along space-filling curves and alternates them.
   Everything on this page is computed in the browser from the rules below; nothing is loaded from a model. */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  const STATIC = Q.has('static');
  const $ = s => document.querySelector(s);
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  const C = () => ({ fg: css('--fg'), mu: css('--muted'), line: css('--line'), bg: css('--bg2'), acc: css('--accent'), note: css('--note'), jump: '#ff5d6c' });

  /* ---------- keys ---------- */
  /* 2D Morton: x in the high bit of each pair (same convention as z_order.py, where x is the top bit of each group) */
  const morton2 = (x, y, b) => { let c = 0; for (let i = b - 1; i >= 0; i--) c = c * 4 + ((x >> i & 1) * 2 + (y >> i & 1)); return c; };
  /* 2D Hilbert, the textbook xy2d */
  function hilbert2(x, y, n) {
    let d = 0;
    for (let s = n >> 1; s > 0; s >>= 1) {
      const rx = (x & s) ? 1 : 0, ry = (y & s) ? 1 : 0;
      d += s * s * ((3 * rx) ^ ry);
      if (ry === 0) { if (rx === 1) { x = n - 1 - x; y = n - 1 - y; } const t = x; x = y; y = t; }
    }
    return d;
  }
  const morton3 = (x, y, z, b) => { let c = 0; for (let i = b - 1; i >= 0; i--) c = c * 8 + ((x >> i & 1) * 4 + (y >> i & 1) * 2 + (z >> i & 1)); return c; };
  /* 3D Hilbert by Skilling's transpose method (the steps of PTv3's serialization/hilbert.py, re-written) */
  function hilbert3(l, nb) {
    const g = [0, 1, 2].map(d => Array.from({ length: nb }, (_, b) => (l[d] >> (nb - 1 - b)) & 1));
    for (let bit = 0; bit < nb; bit++) for (let dim = 0; dim < 3; dim++) {
      const m = g[dim][bit];
      for (let j = bit + 1; j < nb; j++) g[0][j] ^= m;
      for (let j = bit + 1; j < nb; j++) if (!m && (g[0][j] ^ g[dim][j])) { g[dim][j] ^= 1; g[0][j] ^= 1; }
    }
    let acc = 0, c = 0; for (let b = 0; b < nb; b++) for (let d = 0; d < 3; d++) { acc ^= g[d][b]; c = c * 2 + acc; }
    return c;
  }
  const ORD = {
    raster: { name: '逐行扫描', key: (x, y, n) => y * n + x },
    z: { name: 'Z-order', key: (x, y, n, b) => morton2(x, y, b) },
    zt: { name: 'z-trans', key: (x, y, n, b) => morton2(y, x, b) },
    h: { name: 'Hilbert', key: (x, y, n) => hilbert2(x, y, n) },
    ht: { name: 'hilbert-trans', key: (x, y, n) => hilbert2(y, x, n) },
  };
  /* sort the given cells by an order */
  function serialize(cells, ord, n) { const b = Math.log2(n); return cells.map(c => [ORD[ord].key(c[0], c[1], n, b), c]).sort((a, z) => a[0] - z[0]).map(a => a[1]); }
  const fullGrid = n => { const a = []; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) a.push([x, y]); return a; };
  const stepStats = seq => { let jumps = 0, mx = 0, sum = 0; for (let i = 1; i < seq.length; i++) { const d = Math.hypot(seq[i][0] - seq[i - 1][0], seq[i][1] - seq[i - 1][1]); sum += d; if (d > 1.0001) jumps++; mx = Math.max(mx, d); } return { jumps, mx, mean: sum / Math.max(1, seq.length - 1) }; };

  /* ---------- toy shapes on a 32 x 32 grid ---------- */
  function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shape(kind, n = 32) {
    const out = [], r = rng(7);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const u = (x + 0.5) / n, v = (y + 0.5) / n;
      let on = false;
      if (kind === 'cup') { /* side view of a mug: two walls, a base, a handle ring */
        const wall = (u > 0.14 && u < 0.24) || (u > 0.6 && u < 0.7); const inBody = v > 0.12 && v < 0.88;
        const base = v > 0.12 && v < 0.2 && u > 0.14 && u < 0.7;
        const hr = Math.hypot(u - 0.72, v - 0.52); const handle = hr > 0.12 && hr < 0.19 && u > 0.7;
        on = (wall && inBody) || base || handle;
      } else if (kind === 'disk') on = Math.hypot(u - 0.5, v - 0.5) < 0.42;
      else on = r() < 0.38;
      if (on) out.push([x, y]);
    }
    return out;
  }
  const PAL = i => `hsl(${(i * 137.508) % 360} 68% 56%)`;

  /* ---------- canvas helpers ---------- */
  function fit(cv, h) {
    const w = cv.parentElement.clientWidth, dpr = Math.min(2, window.devicePixelRatio || 1);
    const H = h || w; cv.style.width = w + 'px'; cv.style.height = H + 'px'; cv.width = Math.round(w * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, w, h: H };
  }
  /* geometry of an n x n grid inside a w x h canvas, y pointing up */
  function frame(w, h, n, pad = 10) { const c = Math.min((w - 2 * pad) / n, (h - 2 * pad) / n); const ox = (w - c * n) / 2, oy = (h - c * n) / 2; return { c, ox, oy, P: (x, y) => [ox + (x + 0.5) * c, oy + (n - 1 - y + 0.5) * c], cell: (px, py) => [Math.floor((px - ox) / c), n - 1 - Math.floor((py - oy) / c)] }; }
  function gridLines(g, F, n, col) { g.strokeStyle = col; g.lineWidth = 1; g.globalAlpha = 0.5; g.beginPath(); for (let i = 0; i <= n; i++) { g.moveTo(F.ox + i * F.c, F.oy); g.lineTo(F.ox + i * F.c, F.oy + n * F.c); g.moveTo(F.ox, F.oy + i * F.c); g.lineTo(F.ox + n * F.c, F.oy + i * F.c); } g.stroke(); g.globalAlpha = 1; }
  /* draw a serialized path up to index `upto`; unit steps coloured along the path, jumps dashed red */
  function path(g, F, seq, upto, K) {
    const col = C(), lw = Math.max(1.2, Math.min(3, F.c * 0.18));
    for (let i = 1; i <= upto && i < seq.length; i++) {
      const a = F.P(...seq[i - 1]), b = F.P(...seq[i]), d = Math.hypot(seq[i][0] - seq[i - 1][0], seq[i][1] - seq[i - 1][1]);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
      if (d > 1.0001) { g.setLineDash([4, 3]); g.strokeStyle = col.jump; g.lineWidth = lw; }
      else { g.setLineDash([]); g.strokeStyle = `hsl(${200 - 160 * i / seq.length} 75% 55%)`; g.lineWidth = lw; }
      g.stroke();
    }
    g.setLineDash([]);
    if (upto < seq.length) { const p = F.P(...seq[Math.max(0, Math.min(upto, seq.length - 1))]); g.fillStyle = col.fg; g.beginPath(); g.arc(p[0], p[1], Math.max(3, F.c * 0.25), 0, 7); g.fill(); }
  }
  const fmt = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);
  const pct = v => (v * 100).toFixed(1) + '%';

  /* segmented buttons */
  function seg(el, items, val, on) {
    el.innerHTML = ''; items.forEach(([v, t]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.setAttribute('aria-pressed', String(v === val)); b.onclick = () => { [...el.children].forEach(c => c.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); on(v); }; el.appendChild(b); });
  }

  /* ---------- animation loop: only visible sections tick ---------- */
  const secs = [];
  const vis = new Set();
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? vis.add(e.target) : vis.delete(e.target)), { rootMargin: '100px' }) : null;
  function register(el, s) { secs.push({ el, ...s }); if (io) io.observe(el); else vis.add(el); }
  let last = performance.now();
  function loop(t) { const dt = Math.min(0.1, (t - last) / 1000); last = t; secs.forEach(s => { if (vis.has(s.el) && s.tick) s.tick(dt); }); requestAnimationFrame(loop); }

  /* ===== 1. three ways to walk the grid ===== */
  function S1() {
    const el = $('#s1'); let bits = 3, play = !STATIC, prog = STATIC ? 1 : 0, speed = 1;
    const cvs = ['raster', 'z', 'h'].map(k => ({ k, cv: el.querySelector(`canvas[data-o="${k}"]`), st: el.querySelector(`[data-st="${k}"]`) }));
    const pb = el.querySelector('.play');
    seg(el.querySelector('.bits'), [[1, '2×2'], [2, '4×4'], [3, '8×8'], [4, '16×16'], [5, '32×32']], bits, v => { bits = v; prog = 0; draw(); });
    seg(el.querySelector('.spd'), [[0.5, '慢'], [1, '中'], [3, '快']], speed, v => { speed = v; });
    pb.onclick = () => { play = !play; if (play && prog >= 1) prog = 0; pb.textContent = play ? '❚❚ 暂停' : '▶ 播放'; };
    pb.textContent = play ? '❚❚ 暂停' : '▶ 播放';
    el.querySelector('.end').onclick = () => { prog = 1; play = false; pb.textContent = '▶ 播放'; draw(); };
    function draw() {
      const n = 1 << bits, col = C();
      cvs.forEach(o => {
        const { g, w, h } = fit(o.cv); g.clearRect(0, 0, w, h); const F = frame(w, h, n); gridLines(g, F, n, col.line);
        const seq = serialize(fullGrid(n), o.k, n), upto = Math.floor(prog * (seq.length - 1));
        path(g, F, seq, upto);
        if (n <= 8) { g.fillStyle = col.mu; g.font = `${Math.max(9, Math.min(13, F.c * 0.3))}px var(--font-mono), monospace`; g.textAlign = 'center'; g.textBaseline = 'top'; seq.forEach((c, i) => { if (i <= upto) { const p = F.P(...c); g.fillText(String(i), p[0], p[1] + F.c * 0.14); } }); }
        const s = stepStats(seq);
        o.st.innerHTML = `一共 ${seq.length - 1} 步 · <b class="${s.jumps ? 'bad' : 'good'}">跳 ${s.jumps} 次</b> · 最远一步 ${fmt(s.mx, 2)} 格 · 平均 ${fmt(s.mean, 2)} 格`;
      });
    }
    register(el, { draw, tick(dt) { if (!play) return; const n = 1 << bits; prog = Math.min(1, prog + dt * speed * 6 / Math.max(6, n * n) * Math.max(1, n / 2)); if (prog >= 1) { play = false; pb.textContent = '▶ 播放'; } draw(); } });
    draw();
  }

  /* ===== 2. how Hilbert is built ===== */
  function S2() {
    const el = $('#s2'); let L = 2;
    const cH = el.querySelector('canvas[data-o="h"]'), cZ = el.querySelector('canvas[data-o="z"]'), note = el.querySelector('.note2');
    seg(el.querySelector('.lvl'), [[1, '第 1 阶'], [2, '第 2 阶'], [3, '第 3 阶'], [4, '第 4 阶']], L, v => { L = v; draw(); });
    function one(cv, ord) {
      const n = 1 << L, col = C(); const { g, w, h } = fit(cv); g.clearRect(0, 0, w, h); const F = frame(w, h, n);
      const half = n / 2, qc = ['rgba(56,209,255,.13)', 'rgba(255,179,71,.15)', 'rgba(126,240,176,.15)', 'rgba(204,140,255,.15)'];
      const seq = serialize(fullGrid(n), ord, n);
      if (L > 1) { /* shade the four sub-blocks in the order the curve visits them */
        const seen = []; seq.forEach(c => { const q = (c[0] >= half ? 1 : 0) + (c[1] >= half ? 2 : 0); if (!seen.includes(q)) seen.push(q); });
        seen.forEach((q, i) => { const x0 = q & 1 ? half : 0, y0 = q & 2 ? half : 0; g.fillStyle = qc[i]; g.fillRect(F.ox + x0 * F.c, F.oy + (n - y0 - half) * F.c, half * F.c, half * F.c); g.fillStyle = col.mu; g.font = '600 13px var(--font-body), sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(`子块 ${i + 1}`, F.ox + x0 * F.c + 4, F.oy + (n - y0 - half) * F.c + 3); });
      }
      gridLines(g, F, n, col.line); path(g, F, seq, seq.length);
      const a = F.P(...seq[0]), b = F.P(...seq[seq.length - 1]); g.fillStyle = col.acc; g.font = '600 12px var(--font-body), sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText('起点', a[0], a[1] - 6); g.fillText('终点', b[0], b[1] - 6);
      return stepStats(seq);
    }
    function draw() {
      const sh = one(cH, 'h'), sz = one(cZ, 'z');
      note.innerHTML = L === 1
        ? '第 1 阶只有 4 格，两条曲线都是“U”形和“Z”形，一个连续、一个斜着跳一步。'
        : `第 ${L} 阶 = 4 个第 ${L - 1} 阶拷贝。<b>Hilbert</b> 把每个子块里的曲线旋转或翻转，让上一块的终点正好贴着下一块的起点，所以 ${4 ** L - 1} 步全是 1 格（跳 ${sh.jumps} 次）。<b>Z-order</b> 只是原样复制，子块之间直接跳过去：跳 ${sz.jumps} 次，最远 ${fmt(sz.mx, 2)} 格。`;
    }
    register(el, { draw }); draw();
  }

  /* shared: patches of K consecutive cells in an order */
  function patches(cells, ord, n, K) { const seq = serialize(cells, ord, n); const pid = new Map(); seq.forEach((c, i) => pid.set(c[0] + ',' + c[1], Math.floor(i / K))); return { seq, pid, count: Math.ceil(seq.length / K) }; }
  /* how many 4-connected pieces each patch falls into */
  function pieces(cells, pid) {
    const by = new Map(); cells.forEach(c => { const p = pid.get(c[0] + ',' + c[1]); (by.get(p) || by.set(p, []).get(p)).push(c); });
    const res = []; by.forEach((list, p) => {
      const set = new Set(list.map(c => c[0] + ',' + c[1])), seen = new Set(); let k = 0;
      list.forEach(c => { const key = c[0] + ',' + c[1]; if (seen.has(key)) return; k++; const st = [c]; seen.add(key); while (st.length) { const [x, y] = st.pop(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const q = (x + dx) + ',' + (y + dy); if (set.has(q) && !seen.has(q)) { seen.add(q); st.push([x + dx, y + dy]); } }); } });
      let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; list.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
      res[p] = { k, box: [x0, y0, x1, y1], diag: Math.hypot(x1 - x0 + 1, y1 - y0 + 1) };
    });
    return res;
  }

  /* ===== 3. cut into patches of K ===== */
  function S3() {
    const el = $('#s3'); let kind = 'disk', K = 16; const n = 32;
    const cvs = ['z', 'h'].map(k => ({ k, cv: el.querySelector(`canvas[data-o="${k}"]`), st: el.querySelector(`[data-st="${k}"]`) }));
    seg(el.querySelector('.shape'), [['disk', '实心圆盘'], ['cup', '杯子侧影（薄壁）'], ['rand', '随机散点']], kind, v => { kind = v; draw(); });
    seg(el.querySelector('.kk'), [[4, 'K = 4'], [8, '8'], [16, '16'], [32, '32'], [64, '64']], K, v => { K = v; draw(); });
    function draw() {
      const cells = shape(kind, n), col = C();
      cvs.forEach(o => {
        const { g, w, h } = fit(o.cv); g.clearRect(0, 0, w, h); const F = frame(w, h, n);
        gridLines(g, F, n, col.line);
        const P = patches(cells, o.k, n, K), pc = pieces(cells, P.pid);
        cells.forEach(c => { const p = P.pid.get(c[0] + ',' + c[1]); g.fillStyle = PAL(p); const [x, y] = F.P(...c); g.fillRect(x - F.c / 2 + 0.5, y - F.c / 2 + 0.5, F.c - 1, F.c - 1); });
        pc.forEach((q, p) => { if (!q || q.k < 2) return; const [x0, y0, x1, y1] = q.box; g.strokeStyle = col.jump; g.lineWidth = 1.6; g.setLineDash([4, 3]); g.strokeRect(F.ox + x0 * F.c, F.oy + (n - 1 - y1) * F.c, (x1 - x0 + 1) * F.c, (y1 - y0 + 1) * F.c); g.setLineDash([]); });
        const split = pc.filter(q => q && q.k > 1).length, md = pc.reduce((a, q) => a + (q ? q.diag : 0), 0) / P.count, mk = pc.reduce((a, q) => a + (q ? q.k : 0), 0) / P.count;
        o.st.innerHTML = `${cells.length} 个格子，切成 ${P.count} 块 · <b class="${split ? 'bad' : 'good'}">${split} 块被拆成不相连的几团</b>（红虚框）· 平均每块 ${fmt(mk, 2)} 团 · 块外接框对角线平均 ${fmt(md, 1)} 格`;
      });
    }
    register(el, { draw }); draw();
  }

  /* ===== 4. a point's patch-mates vs its true nearest neighbours ===== */
  function S4() {
    const el = $('#s4'); let K = 16, kind = 'disk'; const n = 32; let cells = shape(kind, n), q = null;
    const cvs = ['z', 'h'].map(k => ({ k, cv: el.querySelector(`canvas[data-o="${k}"]`), st: el.querySelector(`[data-st="${k}"]`) }));
    const tbl = el.querySelector('.avg');
    seg(el.querySelector('.shape'), [['disk', '实心圆盘'], ['cup', '杯子侧影（薄壁）'], ['rand', '随机散点']], kind, v => { kind = v; cells = shape(kind, n); q = null; draw(); });
    seg(el.querySelector('.kk'), [[8, 'K = 8'], [16, '16'], [32, '32'], [64, '64']], K, v => { K = v; draw(); });
    const knn = (c, m) => cells.map(d => [Math.hypot(d[0] - c[0], d[1] - c[1]), d]).filter(a => a[0] > 0).sort((a, b) => a[0] - b[0] || a[1][1] - b[1][1] || a[1][0] - b[1][0]).slice(0, m).map(a => a[1][0] + ',' + a[1][1]);
    function overlap(P, c) { const p = P.pid.get(c[0] + ',' + c[1]); const mates = []; P.pid.forEach((v, key) => { if (v === p && key !== c[0] + ',' + c[1]) mates.push(key); }); if (!mates.length) return { mates, nn: [], r: 1 }; const nn = knn(c, mates.length); const s = new Set(nn); return { mates, nn, r: mates.filter(m => s.has(m)).length / mates.length }; }
    function averages() {
      const keep = cells, out = {}; ['disk', 'cup', 'rand', 'full'].forEach(sh => { cells = sh === 'full' ? fullGrid(n) : shape(sh, n); out[sh] = {}; ['raster', 'z', 'h'].forEach(o => { const P = patches(cells, o, n, K); let s = 0; cells.forEach(c => { s += overlap(P, c).r; }); out[sh][o] = s / cells.length; }); }); cells = keep; return out;
    }
    let avgCache = null, avgKey = '';
    function draw() {
      const col = C(); if (!q) q = cells[Math.floor(cells.length * 0.37)];
      cvs.forEach(o => {
        const { g, w, h } = fit(o.cv); g.clearRect(0, 0, w, h); const F = frame(w, h, n); o.F = F;
        gridLines(g, F, n, col.line);
        const P = patches(cells, o.k, n, K), ov = overlap(P, q), mates = new Set(ov.mates), nn = new Set(ov.nn);
        cells.forEach(c => { const key = c[0] + ',' + c[1]; const [x, y] = F.P(...c); g.fillStyle = mates.has(key) ? col.acc : col.line; g.globalAlpha = mates.has(key) ? 0.9 : 0.55; g.fillRect(x - F.c / 2 + 1, y - F.c / 2 + 1, F.c - 2, F.c - 2); g.globalAlpha = 1; if (nn.has(key)) { g.strokeStyle = col.note; g.lineWidth = 2; g.strokeRect(x - F.c / 2 + 1.5, y - F.c / 2 + 1.5, F.c - 3, F.c - 3); } });
        const [x, y] = F.P(...q); g.fillStyle = col.fg; g.beginPath(); g.arc(x, y, F.c * 0.38, 0, 7); g.fill();
        o.st.innerHTML = `同块的 ${ov.mates.length} 个格子里，<b>${Math.round(ov.r * ov.mates.length)}</b> 个也在“离它最近的 ${ov.mates.length} 个”里 · 重合 <b>${pct(ov.r)}</b>`;
      });
      const key = 'K' + K; if (key !== avgKey) { avgCache = averages(); avgKey = key; }
      const nm = { disk: '实心圆盘', cup: '杯子侧影（薄壁）', rand: '随机散点', full: '整块正方形（每格都有点）' };
      tbl.innerHTML = `<caption>K = ${K} 时，所有格子平均的“组员和真正最近邻的重合率”（当场算）</caption><tr><th>形状</th><th>逐行扫描</th><th>Z-order</th><th>Hilbert</th><th>Hilbert − Z</th></tr>` + Object.keys(nm).map(sh => { const a = avgCache[sh], d = a.h - a.z; return `<tr${sh === kind ? ' class="cur"' : ''}><td>${nm[sh]}</td><td>${pct(a.raster)}</td><td>${pct(a.z)}</td><td>${pct(a.h)}</td><td>${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)} 点</td></tr>`; }).join('');
    }
    cvs.forEach(o => o.cv.addEventListener('click', e => { const r = o.cv.getBoundingClientRect(); const [cx, cy] = o.F.cell(e.clientX - r.left, e.clientY - r.top); const hit = cells.find(c => c[0] === cx && c[1] === cy); if (hit) { q = hit; draw(); } }));
    register(el, { draw }); draw();
  }

  /* ===== 5. why alternate orders ===== */
  function S5() {
    const el = $('#s5'); let K = 16, kind = 'disk'; const n = 32; let cells = shape(kind, n), q = null;
    const ords = ['z', 'zt', 'h', 'ht']; const cvs = ords.map(k => ({ k, cv: el.querySelector(`canvas[data-o="${k}"]`), st: el.querySelector(`[data-st="${k}"]`) }));
    const uni = el.querySelector('canvas[data-o="union"]'), ust = el.querySelector('[data-st="union"]'), sum = el.querySelector('.sum5');
    seg(el.querySelector('.shape'), [['disk', '实心圆盘'], ['cup', '杯子侧影（薄壁）'], ['rand', '随机散点']], kind, v => { kind = v; cells = shape(kind, n); q = null; draw(); });
    seg(el.querySelector('.kk'), [[8, 'K = 8'], [16, '16'], [32, '32']], K, v => { K = v; draw(); });
    const edges = () => { const set = new Set(cells.map(c => c[0] + ',' + c[1])), E = []; cells.forEach(([x, y]) => { if (set.has((x + 1) + ',' + y)) E.push([[x, y], [x + 1, y]]); if (set.has(x + ',' + (y + 1))) E.push([[x, y], [x, y + 1]]); }); return E; };
    function draw() {
      const col = C(), E = edges(); if (!q) q = cells[Math.floor(cells.length * 0.52)];
      const Ps = ords.map(o => patches(cells, o, n, K)); const qk = q[0] + ',' + q[1];
      const cutBy = E.map(([a, b]) => Ps.map(P => P.pid.get(a + '') !== P.pid.get(b + '')));
      const unionMates = new Set();
      cvs.forEach((o, i) => {
        const { g, w, h } = fit(o.cv); g.clearRect(0, 0, w, h); const F = frame(w, h, n, 4); o.F = F; const P = Ps[i], pq = P.pid.get(qk);
        cells.forEach(c => { const key = c[0] + ',' + c[1], m = P.pid.get(key) === pq; if (m) unionMates.add(key); const [x, y] = F.P(...c); g.fillStyle = m ? col.acc : PAL(P.pid.get(key)); g.globalAlpha = m ? 0.95 : 0.35; g.fillRect(x - F.c / 2, y - F.c / 2, F.c, F.c); g.globalAlpha = 1; });
        g.strokeStyle = col.jump; g.lineWidth = 1.6; g.beginPath(); E.forEach(([a, b], j) => { if (!cutBy[j][i]) return; const pa = F.P(...a), pb = F.P(...b), mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2; if (a[1] === b[1]) { g.moveTo(mx, my - F.c / 2); g.lineTo(mx, my + F.c / 2); } else { g.moveTo(mx - F.c / 2, my); g.lineTo(mx + F.c / 2, my); } }); g.stroke();
        const [x, y] = F.P(...q); g.fillStyle = col.fg; g.beginPath(); g.arc(x, y, F.c * 0.42, 0, 7); g.fill();
        o.st.innerHTML = `切断 ${cutBy.filter(c => c[i]).length} / ${E.length} 条相邻边（${pct(cutBy.filter(c => c[i]).length / E.length)}）`;
      });
      { const { g, w, h } = fit(uni); g.clearRect(0, 0, w, h); const F = frame(w, h, n, 4); uni.F = F;
        cells.forEach(c => { const key = c[0] + ',' + c[1], m = unionMates.has(key); const [x, y] = F.P(...c); g.fillStyle = m ? col.acc : col.line; g.globalAlpha = m ? 0.95 : 0.5; g.fillRect(x - F.c / 2, y - F.c / 2, F.c, F.c); g.globalAlpha = 1; });
        g.strokeStyle = col.jump; g.lineWidth = 2; g.beginPath(); E.forEach(([a, b], j) => { if (!cutBy[j].every(Boolean)) return; const pa = F.P(...a), pb = F.P(...b), mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2; if (a[1] === b[1]) { g.moveTo(mx, my - F.c / 2); g.lineTo(mx, my + F.c / 2); } else { g.moveTo(mx - F.c / 2, my); g.lineTo(mx + F.c / 2, my); } }); g.stroke();
        const [x, y] = F.P(...q); g.fillStyle = col.fg; g.beginPath(); g.arc(x, y, F.c * 0.42, 0, 7); g.fill();
        const never = cutBy.filter(c => c.every(Boolean)).length;
        ust.innerHTML = `四种序轮流用：它在至少一层里和 <b>${unionMates.size - 1}</b> 个格子同块 · 四层都被切断的边 <b>${never}</b> / ${E.length}（${pct(never / E.length)}）`;
        const single = ords.map((o, i) => cutBy.filter(c => c[i]).length / E.length);
        sum.innerHTML = `只用一种序时，每一层有 ${single.map(pct).join('、')} 的相邻边被块边界切断，两边的点在这一层互相看不见。四种序轮流用，四层都被切断的边只剩 <b>${pct(never / E.length)}</b>。也就是说，绝大多数“在这一层被切开”的邻居，在下一层就落进了同一块。`;
      }
    }
    [...cvs.map(o => o.cv), uni].forEach(cv => cv.addEventListener('click', e => { const r = cv.getBoundingClientRect(); const [cx, cy] = cv.F.cell(e.clientX - r.left, e.clientY - r.top); const hit = cells.find(c => c[0] === cx && c[1] === cy); if (hit) { q = hit; draw(); } }));
    register(el, { draw }); draw();
  }

  /* ===== 6. the same thing in 3D ===== */
  function S6() {
    const el = $('#s6'); let bits = 2, ord = 'h', yaw = 0.7, pitch = 0.45, play = !STATIC, prog = STATIC ? 1 : 0, drag = null;
    const cv = el.querySelector('canvas'), st = el.querySelector('[data-st]'), pb = el.querySelector('.play');
    seg(el.querySelector('.bits'), [[1, '2×2×2'], [2, '4×4×4'], [3, '8×8×8']], bits, v => { bits = v; prog = 0; play = true; pb.textContent = '❚❚ 暂停'; draw(); });
    seg(el.querySelector('.ord'), [['z', 'Z-order'], ['h', 'Hilbert']], ord, v => { ord = v; prog = 0; play = true; pb.textContent = '❚❚ 暂停'; draw(); });
    pb.onclick = () => { play = !play; if (play && prog >= 1) prog = 0; pb.textContent = play ? '❚❚ 暂停' : '▶ 播放'; }; pb.textContent = play ? '❚❚ 暂停' : '▶ 播放';
    cv.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY, yaw, pitch]; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (!drag) return; yaw = drag[2] + (e.clientX - drag[0]) * 0.01; pitch = Math.max(-1.4, Math.min(1.4, drag[3] + (e.clientY - drag[1]) * 0.01)); draw(); });
    cv.addEventListener('pointerup', () => { drag = null; });
    function seq3() { const n = 1 << bits, a = []; for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) a.push([ord === 'h' ? hilbert3([x, y, z], bits) : morton3(x, y, z, bits), [x, y, z]]); return a.sort((p, q) => p[0] - q[0]).map(p => p[1]); }
    function draw() {
      const n = 1 << bits, col = C(); const { g, w, h } = fit(cv, Math.min(460, cv.parentElement.clientWidth)); g.clearRect(0, 0, w, h);
      const s = Math.min(w, h) * 0.5 / n, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const pr = ([x, y, z]) => { const X = x - (n - 1) / 2, Y = y - (n - 1) / 2, Z = z - (n - 1) / 2; const x1 = X * cy - Z * sy, z1 = X * sy + Z * cy; const y2 = Y * cp - z1 * sp, z2 = Y * sp + z1 * cp; return [w / 2 + x1 * s, h / 2 - y2 * s, z2]; };
      /* cube outline */
      const c0 = -0.5, c1 = n - 0.5, V = [[c0, c0, c0], [c1, c0, c0], [c1, c1, c0], [c0, c1, c0], [c0, c0, c1], [c1, c0, c1], [c1, c1, c1], [c0, c1, c1]].map(pr);
      g.strokeStyle = col.line; g.lineWidth = 1; g.beginPath(); [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([a, b]) => { g.moveTo(V[a][0], V[a][1]); g.lineTo(V[b][0], V[b][1]); }); g.stroke();
      const sq = seq3(), up = Math.floor(prog * (sq.length - 1)); let jumps = 0, mx = 0;
      for (let i = 1; i < sq.length; i++) { const d = Math.hypot(...[0, 1, 2].map(k => sq[i][k] - sq[i - 1][k])); if (d > 1.0001) jumps++; mx = Math.max(mx, d); if (i > up) continue; const a = pr(sq[i - 1]), b = pr(sq[i]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); if (d > 1.0001) { g.setLineDash([4, 3]); g.strokeStyle = col.jump; g.lineWidth = 1.6; } else { g.setLineDash([]); g.strokeStyle = `hsl(${200 - 160 * i / sq.length} 75% 55%)`; g.lineWidth = 2.4; } g.stroke(); }
      g.setLineDash([]); const hp = pr(sq[up]); g.fillStyle = col.fg; g.beginPath(); g.arc(hp[0], hp[1], 4, 0, 7); g.fill();
      st.innerHTML = `${n}³ = ${sq.length} 格，${sq.length - 1} 步 · <b class="${jumps ? 'bad' : 'good'}">跳 ${jumps} 次</b> · 最远一步 ${fmt(mx, 2)} 格 · 拖动画面可以旋转`;
    }
    register(el, { draw, tick(dt) { if (!play) return; prog = Math.min(1, prog + dt * 0.12 * (bits === 3 ? 0.5 : 1)); if (prog >= 1) { play = false; pb.textContent = '▶ 播放'; } draw(); } });
    draw();
  }

  function init() {
    if (Q.has('embed')) document.body.classList.add('embed');
    S1(); S2(); S3(); S4(); S5(); S6();
    let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => secs.forEach(s => s.draw()), 120); });
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => secs.forEach(s => s.draw()));
    requestAnimationFrame(loop);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
