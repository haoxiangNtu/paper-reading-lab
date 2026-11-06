'use strict';
/* Toy core. Two small problems computed in this page, neither is the paper's experiment:
   (1) the project page's ball-wall function f(theta,v,H,L), fitted by two MLPs (ReLU, SiLU) from the same initial weights;
   (2) a 1-D sled tracking a reference, with a learned next-state model W and a linear policy, for comparing gradient sources.
   Backprop and forward-mode are hand-written and checked against finite differences by test.js. */
const Toy = (function () {
  const rng = seed => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const ACT = { relu: { f: x => (x > 0 ? x : 0), d: x => (x > 0 ? 1 : 0) },
    silu: { f: x => { const s = 1 / (1 + Math.exp(-x)); return x * s; }, d: x => { const s = 1 / (1 + Math.exp(-x)); return s + x * s * (1 - s); } } };
  function MLP(sizes, act, seed) {
    let n = 0; for (let i = 0; i + 1 < sizes.length; i++) n += (sizes[i] + 1) * sizes[i + 1];
    const w = new Float64Array(n), r = rng(seed); let k = 0;
    for (let i = 0; i + 1 < sizes.length; i++) { const a = sizes[i], b = sizes[i + 1], sc = Math.sqrt(2 / a); for (let u = 0; u < b; u++) { for (let v = 0; v < a; v++) w[k++] = gauss(r) * sc; w[k++] = 0; } }
    return { sizes, act: ACT[act], actName: act, w, n, h: sizes.map(s => new Float64Array(s)), dz: sizes.map(s => new Float64Array(s)) };
  }
  function fwd(m, x, y) {
    const S = m.sizes, w = m.w, L = S.length - 1, f = m.act.f, d = m.act.d; let k = 0; m.h[0].set(x);
    for (let l = 0; l < L; l++) { const a = S[l], b = S[l + 1], inp = m.h[l], out = m.h[l + 1], dz = m.dz[l + 1];
      for (let u = 0; u < b; u++) { let s = 0; for (let v = 0; v < a; v++) s += w[k + v] * inp[v]; s += w[k + a]; k += a + 1;
        if (l + 1 === L) { out[u] = s; } else { out[u] = f(s); dz[u] = d(s); } } }
    if (y) y.set(m.h[L]); return m.h[L];
  }
  /* reverse pass after fwd: adds d(g.y)/dw into grad (optional), returns d(g.y)/dx */
  function bwd(m, gy, grad) {
    const S = m.sizes, w = m.w, L = S.length - 1; let g = Float64Array.from(gy), k = m.n;
    for (let l = L - 1; l >= 0; l--) { const a = S[l], b = S[l + 1], inp = m.h[l], g2 = new Float64Array(a); k -= (a + 1) * b;
      for (let u = 0; u < b; u++) { const q = k + u * (a + 1), gu = g[u]; if (gu === 0) continue;
        for (let v = 0; v < a; v++) { if (grad) grad[q + v] += gu * inp[v]; g2[v] += gu * w[q + v]; } if (grad) grad[q + a] += gu; }
      if (l > 0) { const dz = m.dz[l]; for (let v = 0; v < a; v++) g2[v] *= dz[v]; } g = g2; }
    return g;
  }
  /* RAdam (Liu et al. 2019). Betas are the common defaults, not stated by the project page. */
  function radam(n, lr, b1 = 0.9, b2 = 0.999) {
    const m = new Float64Array(n), v = new Float64Array(n); let t = 0; const rInf = 2 / b2 - 1;
    return { step(w, g) { t++; const b1t = Math.pow(b1, t), b2t = Math.pow(b2, t), N = rInf - 2 * t * b2t / (1 - b2t), adaptive = N >= 5, r = adaptive ? Math.sqrt((N - 4) * (N - 2) * rInf / ((rInf - 4) * (rInf - 2) * N)) : 0;
      for (let i = 0; i < n; i++) { v[i] = b2 * v[i] + (1 - b2) * g[i] * g[i]; m[i] = b1 * m[i] + (1 - b1) * g[i]; const mh = m[i] / (1 - b1t); w[i] -= adaptive ? lr * r * mh / (Math.sqrt(v[i] / (1 - b2t)) + 1e-8) : lr * mh; } } };
  }

  /* ---------- 1. ball-wall, formula from the project page's figure ---------- */
  const G = 9.81, RANGE = { th: [0, 90], v: [5, 15], H: [1, 4], L: [3, 12] }, DEG = Math.PI / 180;
  function ball(thDeg, v, H, L) { /* returns x and whether the wall stopped it */
    const th = Math.min(thDeg, 89.9) * DEG, tl = 2 * v * Math.sin(th) / G, th_ = L / (v * Math.cos(th)), yh = v * Math.sin(th) * th_ - 0.5 * G * th_ * th_;
    if (th_ < tl && yh < H) return { x: L, wall: true, yh };
    return { x: v * v * Math.sin(2 * th) / G, wall: false, yh };
  }
  const ballDx = (thDeg, v, H, L) => { const b = ball(thDeg, v, H, L); return b.wall ? 0 : 2 * v * v * Math.cos(2 * Math.min(thDeg, 89.9) * DEG) / G * DEG; }; /* per degree */
  const norm = (th, v, H, L) => [th / 45 - 1, (v - 10) / 5, (H - 2.5) / 1.5, (L - 7.5) / 4.5];
  const NBW = 1500, BBW = 300, EPOCHS = 200, SLICE = { H: 2.5, L: 8 }, GN = 46, GM = 21;
  function makeBW(seed = 11) { const r = rng(seed), X = [], Y = []; for (let i = 0; i < NBW; i++) { const th = r() * 90, v = 5 + r() * 10, H = 1 + r() * 3, L = 3 + r() * 9; X.push(norm(th, v, H, L)); Y.push(ball(th, v, H, L).x / 10); } return { X, Y }; }
  function surface(m) { const out = new Float64Array(GN * GM), y = new Float64Array(1); for (let j = 0; j < GM; j++) for (let i = 0; i < GN; i++) { const th = 90 * i / (GN - 1), v = 5 + 10 * j / (GM - 1); fwd(m, norm(th, v, SLICE.H, SLICE.L), y); out[j * GN + i] = y[0] * 10; } return out; }
  function gtSurface() { const out = new Float64Array(GN * GM); for (let j = 0; j < GM; j++) for (let i = 0; i < GN; i++) out[j * GN + i] = ball(90 * i / (GN - 1), 5 + 10 * j / (GM - 1), SLICE.H, SLICE.L).x; return out; }
  function trainBW(act, data, lr = 5e-3) {
    const m = MLP([4, 32, 32, 1], act, 7), opt = radam(m.n, lr), grad = new Float64Array(m.n), r = rng(23), idx = Array.from({ length: NBW }, (_, i) => i), y = new Float64Array(1), gy = new Float64Array(1), snaps = [surface(m)], loss = [];
    for (let e = 1; e <= EPOCHS; e++) { for (let i = NBW - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)), t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
      let tot = 0; for (let b = 0; b + BBW <= NBW; b += BBW) { grad.fill(0); for (let q = b; q < b + BBW; q++) { const i = idx[q]; fwd(m, data.X[i], y); const d = y[0] - data.Y[i]; tot += d * d; gy[0] = 2 * d / BBW; bwd(m, gy, grad); } opt.step(m.w, grad); }
      if (e % 10 === 0) { snaps.push(surface(m)); loss.push(Math.sqrt(tot / NBW) * 10); } }
    return { m, snaps, loss };
  }
  function nnX(m, thDeg, v) { const y = new Float64Array(1), gy = new Float64Array([1]); fwd(m, norm(thDeg, v, SLICE.H, SLICE.L), y); const g = bwd(m, gy); return { x: y[0] * 10, dx: g[0] * 10 / 45 }; }
  /* gradient ascent on theta; lr in deg^2/m. Same rule for ground truth and networks. */
  function ascent(dxf, xf, th0, steps = 80, lr = 6) { const pts = []; let th = th0; for (let i = 0; i <= steps; i++) { const d = dxf(th); pts.push([th, xf(th), d]); th = Math.max(0, Math.min(89.9, th + lr * d)); } return pts; }

  /* ---------- 2. sled tracking: true dynamics hidden from the learner except through samples ---------- */
  const DT = 0.05, T = 40, HOR = 16;
  function sim(s, u) { const a = u - 0.5 * s[1] - 1.2 * Math.tanh(3 * s[1]) * (1 + 0.5 * Math.sin(s[0] * 2)), v = s[1] + DT * a; return [s[0] + DT * v, v]; }
  const refX = (t, ph) => Math.sin(1.1 * t + ph) + 0.5 * Math.sin(2.3 * t + 2 * ph);
  const refV = (t, ph) => 1.1 * Math.cos(1.1 * t + ph) + 1.15 * Math.cos(2.3 * t + 2 * ph);
  const FEAT = (s, t, ph) => [refX(t, ph) - s[0], refV(t, ph) - s[1], refV(t, ph)];
  const act = (th, f) => Math.max(-14, Math.min(14, th[0] * f[0] + th[1] * f[1] + th[2] * f[2]));
  function rollSim(th, ph, n = T, s0, sink) { let s = s0 ? s0.slice() : [refX(0, ph), refV(0, ph)], L = 0; const tr = [s]; for (let i = 0; i < n; i++) { const t = i * DT, u = act(th, FEAT(s, t, ph)), s2 = sim(s, u); if (sink) sink.push([s[0], s[1], u, s2[0] - s[0], s2[1] - s[1]]); s = s2; const e = refX(t + DT, ph) - s[0]; L += e * e; tr.push(s); } return { L: L / n, tr }; }
  const EVAL = [0, 1.3, 2.6, 3.9, 5.2];
  const evalErr = th => { let a = 0; for (const p of EVAL) a += rollSim(th, p).L; return Math.sqrt(a / EVAL.length); };
  /* W: (x,v,u) -> (dx,dv)/0.1 */
  const wIn = (s, u) => [s[0] / 2, s[1] / 2, u / 8];
  function fitW(W, opt, buf, steps, r, bs = 64) { const y = new Float64Array(2), g = new Float64Array(W.n), gy = new Float64Array(2); for (let k = 0; k < steps; k++) { g.fill(0); for (let b = 0; b < bs; b++) { const q = buf[Math.floor(r() * buf.length)]; fwd(W, wIn([q[0], q[1]], q[2]), y); gy[0] = 2 * (y[0] - q[3] / 0.1) / bs; gy[1] = 2 * (y[1] - q[4] / 0.1) / bs; bwd(W, gy, g); } opt.step(W.w, g); } }
  /* one W step with derivatives from reverse mode: returns next state and Jacobians */
  function wStep(W, s, u) { const inp = wIn(s, u), y = new Float64Array(2); fwd(W, inp, y); const ny = [y[0], y[1]], g0 = bwd(W, [1, 0]), g1 = bwd(W, [0, 1]);
    return { s: [s[0] + 0.1 * ny[0], s[1] + 0.1 * ny[1]], Js: [[1 + 0.1 * g0[0] / 2, 0.1 * g0[1] / 2], [0.1 * g1[0] / 2, 1 + 0.1 * g1[1] / 2]], Ju: [0.1 * g0[2] / 8, 0.1 * g1[2] / 8] }; }
  /* loss of a rollout through W and its exact gradient wrt policy parameters (forward-mode over 3 parameters) */
  function modelLossGrad(W, th, s0, t0, ph, H = HOR) { let s = s0.slice(), L = 0; let ds = [[0, 0, 0], [0, 0, 0]]; const g = [0, 0, 0];
    for (let i = 0; i < H; i++) { const t = t0 + i * DT, f = FEAT(s, t, ph), u = act(th, f), sat = Math.abs(th[0] * f[0] + th[1] * f[1] + th[2] * f[2]) < 14 ? 1 : 0, r = wStep(W, s, u), dn = [[0, 0, 0], [0, 0, 0]];
      for (let k = 0; k < 3; k++) { const dfx = -ds[0][k], dfv = -ds[1][k], du = sat * (f[k] + th[0] * dfx + th[1] * dfv); dn[0][k] = r.Js[0][0] * ds[0][k] + r.Js[0][1] * ds[1][k] + r.Ju[0] * du; dn[1][k] = r.Js[1][0] * ds[0][k] + r.Js[1][1] * ds[1][k] + r.Ju[1] * du; }
      s = r.s; ds = dn; const e = refX(t + DT, ph) - s[0]; L += e * e / H; for (let k = 0; k < 3; k++) g[k] += -2 * e * ds[0][k] / H; }
    return { L, g };
  }
  const unit = g => { const n = Math.hypot(...g) || 1; return g.map(x => x / n); };
  const MODES = ['rl', 'model', 'mix', 'badmodel', 'badmix'], ITERS = 70;
  /* biased W: fitted only on slow, small-action samples, then frozen */
  function pretrain(W, opt, r, n, uMax, vMax, steps) { const buf = []; for (let i = 0; i < n; i++) { const s = [(r() - 0.5) * 4, (r() - 0.5) * 2 * vMax], u = (r() - 0.5) * 2 * uMax, s2 = sim(s, u); buf.push([s[0], s[1], u, s2[0] - s[0], s2[1] - s[1]]); } fitW(W, opt, buf, steps, r); return buf; }
  function trainPolicy(mode, alpha = 0.5, seed = 5) {
    const r = rng(seed); let th = [0.5, 0.5, 0]; const useModel = mode !== 'rl', bad = mode.startsWith('bad'), useRL = mode === 'rl' || mode.endsWith('mix');
    const W = MLP([3, 24, 24, 2], 'silu', 3), optW = radam(W.n, 2e-3); let buf = [];
    if (useModel) { if (bad) pretrain(W, optW, r, 400, 2, 0.4, 500); else { buf = pretrain(W, optW, r, 400, 10, 2.5, 500); } }
    const optP = radam(3, 0.08), curve = [[0, evalErr(th), th.slice()]]; let used = useModel ? 400 : 0; const M = mode === 'rl' ? 8 : 2, sig = 0.25;
    for (let it = 1; it <= ITERS; it++) { const ph = r() * 6.28; let gm = null, gr = null;
      if (useModel) { const sink = []; const rr = rollSim(th, ph, T, null, sink); used += T; if (!bad) { buf.push(...sink); if (buf.length > 3000) buf.splice(0, buf.length - 3000); fitW(W, optW, buf, 20, r); }
        gm = [0, 0, 0]; for (let q = 0; q < 6; q++) { const i = Math.floor(r() * (T - HOR)), res = modelLossGrad(W, th, rr.tr[i], i * DT, ph); for (let k = 0; k < 3; k++) gm[k] += res.g[k] / 6; } }
      if (useRL) { gr = [0, 0, 0]; for (let q = 0; q < M; q++) { const eps = [gauss(r), gauss(r), gauss(r)], p = th.map((v, k) => v + sig * eps[k]), n = th.map((v, k) => v - sig * eps[k]), ph2 = r() * 6.28, d = rollSim(p, ph2).L - rollSim(n, ph2).L; used += 2 * T; for (let k = 0; k < 3; k++) gr[k] += d * eps[k] / (2 * sig * M); } }
      const g = gm && gr ? unit(gm).map((v, k) => alpha * v + (1 - alpha) * unit(gr)[k]) : (gm || gr), a = Float64Array.from(th); optP.step(a, Float64Array.from(unit(g))); th = Array.from(a); curve.push([used, evalErr(th), th.slice()]); }
    return { th, curve, W };
  }
  /* open-loop check of W on a fresh rollout, with the sim's own actions replayed */
  function openLoop(W, th, ph, n) { let s = [refX(0, ph), refV(0, ph)], p = s.slice(); const ref = [refX(0, ph)], tru = [s[0]], pred = [p[0]], y = new Float64Array(2); for (let i = 0; i < n; i++) { const t = i * DT, u = act(th, FEAT(s, t, ph)); s = sim(s, u); fwd(W, wIn(p, u), y); p = [p[0] + 0.1 * y[0], p[1] + 0.1 * y[1]]; ref.push(refX(t + DT, ph)); tru.push(s[0]); pred.push(p[0]); } return { ref, tru, pred }; }
  return { rng, gauss, MLP, fwd, bwd, radam, ball, ballDx, makeBW, trainBW, gtSurface, surface, nnX, ascent, sim, modelLossGrad, wStep, rollSim, evalErr, trainPolicy, openLoop, refX, refV, act, FEAT, MODES, DT, T, HOR, GN, GM, SLICE, ITERS, NBW, BBW, EPOCHS };
})();
if (typeof module !== 'undefined') module.exports = Toy;
if (typeof window !== 'undefined') (function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const COL = { wm: 0x4fc98a, pi: 0x38d1ff, loss: 0xf2c14e, grad: 0xff7a59, ref: 0xe05d5d, track: 0x3aa8e0, pred: 0xf0963c, mute: 0x6b7794, rl: 0x9d8cff, white: 0xe6ecf7, unread: 0x59627a };
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyNote = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const unread = t => `<p class="guess"><b>没读到 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const memo = (() => { const m = {}; return (k, fn) => (k in m ? m[k] : (m[k] = fn())); })();

  /* numbers copied from the archived project page. Table text in HTML, benchmark table from its benchmark.png. */
  const PW = [['P(SiLU) W(SiLU)', 96.8, 24.3, 19.8, 2.3, 3.1, 0, 0], ['P(SiLU) W(ReLU)', 93.9, 30.6, 24.4, 2.6, 3.6, 0, 1], ['P(ReLU) W(ReLU)', 95.8, 25.7, 19.9, 2.7, 3.3, 1, 1], ['P(ReLU) W(SiLU)', 97.9, 21.1, 16.6, 2.5, 3.0, 1, 0]];
  const METRICS = ['Succ', 'E_g-mpjpe', 'E_mpjpe', 'E_acc', 'E_vel'];
  const BENCH = [ /* name, time, train[succ,g,mpjpe,acc,vel], test[...] */
    ['PHC', '7 days', [98.9, 37.5, 26.9, 3.3, 4.9], [96.4, 47.4, 30.9, 6.8, 9.1]],
    ['PHC+', '7+ days', [100, 26.6, 21.1, 2.7, 3.9], [99.2, 36.1, 24.1, 6.2, 8.1]],
    ['PULSE', '蒸馏', [99.8, 39.2, 35.0, 3.1, 5.2], [97.1, 54.1, 43.5, 7.0, 10.3]],
    ['Ours*', '3 days', [99.2, 27.7, 15.5, 2.1, 2.7], [98.5, 32.1, 23.9, 5.5, 7.1]],
    ['Ours(FT)*', '3 days', [99.0, 20.3, 16.1, 1.9, 2.6], [98.1, 27.0, 20.2, 5.0, 6.4]],
    ['PHC+* (env 3072)', '2 days', [98.4, 30.9, 23.6, 2.4, 3.6], [97.8, 30.5, 23.5, 5.6, 8.0]],
    ['Ours+* (env 1024)', '2 days', [98.8, 16.9, 13.3, 2.3, 2.7], [97.9, 26.5, 19.5, 5.6, 6.5]]];
  /* histogram bar heights: pixel-read from world_eval_*.png, calibrated on the y gridlines. Test counts come out as integers summing to 140. */
  const HIST = { train: { n: 11313, bins: [6165, 4455, 415, 129, 87, 53, 9] }, test: { n: 140, bins: [16, 96, 15, 8, 2, 3, 0] } };
  const BIN = 1 / 30;
  const CURVES = {"standing_sd":[[0.088,16.58,6.71,20.49],[0.274,24.51,22.64,25.86],[0.461,26.82,26.1,27.49],[0.647,27.73,27.41,28.09],[0.834,27.97,27.65,28.25],[1.02,28.01,27.69,28.61],[1.206,28.17,27.85,28.49],[1.393,28.45,28.17,28.69],[1.579,28.73,28.45,29.08],[1.765,28.73,28.49,28.89],[1.952,28.89,28.65,29.32],[2.138,29.04,28.81,29.2],[2.325,29.12,28.96,29.28],[2.511,29.28,29.04,29.96],[2.697,29.36,29.16,29.52],[2.884,29.52,29.36,29.68],[3.07,29.68,29.44,30.08],[3.256,29.72,29.6,29.88],[3.443,29.92,29.72,30.24],[3.629,30.08,29.88,30.28],[3.816,30.16,30.0,30.28],[4.002,30.24,30.08,30.48],[4.188,30.28,30.12,30.48],[4.375,30.32,30.16,30.48]],"standing_dr":[[0.089,5.76,4.56,6.15],[0.276,6.43,5.76,7.11],[0.464,6.31,5.4,6.63],[0.651,6.04,5.52,6.71],[0.839,7.87,6.23,9.5],[1.026,5.56,5.2,8.3],[1.214,6.67,5.6,7.59],[1.401,6.79,6.27,8.42],[1.589,8.7,6.91,10.57],[1.777,9.78,8.58,11.33],[1.964,8.03,6.91,10.1],[2.152,7.95,6.99,9.06],[2.339,8.26,7.03,9.18],[2.527,8.46,7.59,9.22],[2.714,8.5,7.99,9.9],[2.902,9.02,7.87,10.21],[3.089,8.98,8.38,10.02],[3.277,11.37,9.22,13.28],[3.464,12.05,10.69,13.16],[3.652,10.65,8.14,12.36],[3.84,12.72,11.29,14.04],[4.027,12.4,9.42,15.11],[4.215,13.72,11.09,15.15],[4.402,13.6,9.66,15.95],[4.59,12.96,11.21,14.47],[4.777,13.08,11.77,14.95],[4.965,14.32,12.48,15.79],[5.152,14.99,12.92,17.02],[5.34,16.9,13.6,18.34],[5.527,17.86,15.87,19.21],[5.715,19.01,17.1,20.49],[5.903,18.34,16.82,19.53],[6.09,18.57,15.83,19.73],[6.278,20.25,19.09,20.92],[6.465,21.16,20.45,21.68],[6.653,21.88,21.48,22.12],[6.84,22.0,21.76,22.16],[7.028,21.88,21.32,22.16],[7.215,22.04,21.56,22.28],[7.403,21.92,20.96,22.2]],"handball_sd":[[0.044,0.23,-0.62,2.49],[0.14,-1.64,-3.0,-0.53],[0.235,0.45,-2.36,2.62],[0.331,3.85,2.23,4.87],[0.427,7.89,4.91,8.96],[0.522,10.23,9.21,11.26],[0.618,12.19,10.96,13.3],[0.713,15.09,13.13,16.57],[0.809,17.64,16.62,18.74],[0.904,18.87,17.81,19.68],[1.0,19.94,18.79,21.21],[1.095,20.4,19.13,21.3],[1.191,21.04,20.15,21.89],[1.286,21.51,20.36,22.53],[1.382,22.02,21.26,22.74],[1.477,22.06,21.04,22.87],[1.573,22.91,22.06,23.64],[1.668,23.17,22.28,23.98],[1.764,23.13,22.11,23.85],[1.859,23.09,22.23,23.89],[1.955,23.09,22.36,23.89],[2.05,23.21,22.36,23.89],[2.146,23.47,22.87,24.28],[2.241,23.51,22.57,24.28],[2.337,23.55,22.57,24.28],[2.432,23.64,22.87,24.4],[2.528,23.89,23.13,24.57],[2.623,23.68,22.7,24.36],[2.719,23.6,22.49,24.4],[2.814,23.6,22.83,24.23],[2.91,24.02,23.21,24.74],[3.005,24.02,23.17,24.74],[3.101,23.98,23.34,24.62],[3.196,24.19,23.34,24.87],[3.292,24.11,23.38,24.79],[3.387,24.11,23.3,25.0],[3.483,24.23,23.47,24.83],[3.578,24.19,23.43,24.91],[3.674,24.36,23.72,24.96],[3.769,24.19,23.55,24.91]],"handball_dr":[[0.038,5.13,3.55,5.47],[0.119,5.89,5.64,6.11],[0.201,5.94,5.72,6.19],[0.283,6.15,5.64,6.74],[0.364,5.98,5.81,6.23],[0.446,5.64,5.3,6.06],[0.528,5.51,5.38,5.64],[0.61,5.89,5.47,6.15],[0.691,5.85,5.55,6.15],[0.773,5.43,5.17,5.6],[0.855,5.51,5.09,5.81],[0.936,5.13,4.79,5.3],[1.018,5.13,4.96,5.43],[1.1,5.68,5.34,5.89],[1.182,6.02,5.64,6.19],[1.263,5.64,5.17,5.94],[1.345,6.06,5.64,6.28],[1.427,5.81,5.09,6.11],[1.508,5.72,5.6,5.89],[1.59,5.81,5.6,6.11],[1.672,5.68,5.47,6.06],[1.754,5.98,5.64,6.53],[1.835,5.47,5.13,5.68],[1.917,6.02,5.85,6.23],[1.999,5.89,4.91,6.19],[2.08,5.26,5.17,5.38],[2.162,4.87,4.62,5.51],[2.244,5.09,4.96,5.21],[2.326,5.17,5.04,5.26],[2.407,5.34,5.21,5.64],[2.489,5.38,5.21,5.51],[2.571,5.34,5.26,5.51],[2.652,5.26,5.13,5.38],[2.734,5.21,5.04,5.43],[2.816,5.34,5.09,5.47],[2.898,5.17,5.04,5.38],[2.979,5.17,5.0,5.34],[3.061,5.72,5.64,5.89],[3.143,5.72,5.64,5.81],[3.224,5.34,5.0,5.81]]};

  const SCENES = [
    { n: 1, part: '总览', title: '读到了什么，没读到什么', sub: '绿色有数字，黄色只有一句话，灰色没读到；点方框跳转', dur: 10, cam: [0, 1.32, 25, [0, 1.0, 0]],
      html: '<p class="guess"><b>先看这个 · </b>这一页没有读到论文全文。OpenReview 的 PDF 对脚本返回 403，我没有绕过。下面的内容来自摘要、一份项目页存档和 SuperMimic、∇Mimic 的引用句。</p>' +
        '<p>摘要给出的框架只有一句：学一个神经动力学模型，提出一个把监督学习和强化学习结合起来的框架，用来学可扩展的人形控制器。</p>' +
        '<p>方框的摆放是我按来源分类排的，不是论文的架构图。网络结构、损失、两种学习怎么组合，都没读到。</p>' + src('ML Anthology 上的摘要 · 项目页存档（2026-03-03）') },
    { n: 2, part: '神经动力学', title: '开环预测：只给动作，让模型自己往前滚', sub: '玩具上现场算；切换预测时长', dur: 11, toy: 1, cam: [0, 1.4, 25, [0, 0.8, 0]], ctl: { label: '预测时长', items: ['0.5 秒', '1.5 秒', '3 秒'], def: 1 },
      html: dl([['论文的量', '每关节误差小于 0.066 m（1.5 秒后）'], ['项目页配色', '红 = 参考，蓝 = 策略跟踪，橙 = 模型开环预测'], ['网络', '没读到；摘要只说 medium-sized']]) +
        '<p><b>开环</b>的意思是模型的输入来自它自己上一步的输出，误差会累积，所以它比单步误差难得多。这一幕沿用项目页的配色。</p>' +
        toyNote('一维滑块，W 是 3→24→24→2 的 SiLU MLP，由采样转移做监督回归。动作是仿真里那条轨迹的动作。这不是人形，也不是论文的网络，数字不能和 0.066 m 比。') + src('项目页 “Evaluation of Dynamics Model”') },
    { n: 3, part: '神经动力学', title: '0.066 m 覆盖了多少段动作', sub: '直方图读数；拖进度看阈值扫过去；切换训练集和测试集', dur: 10, cam: [0, 1.36, 24, [0, 2.4, 0]], ctl: { label: '数据集', items: ['AMASS 训练集', 'AMASS 测试集'] },
      html: dl([['柱宽', '约 1/30 m，第 2 根的右端约 0.0667 m（我量的）'], ['测试集读数', '16、96、15、8、2、3，合计 140'], ['训练集读数', '约 6165、4455、415、129、87、53，其余读不出']]) +
        '<p>项目页写“每关节误差小于 0.066 m”，紧接着放这两张直方图。把柱子读出来，测试集合计正好 140，训练集约 11300，和 11313 对得上，所以每个样本大概是一段动作。</p>' +
        '<p>0.066 恰好接近第 2 根柱子的右端（这是我的推断）。按这个切分，它覆盖训练集约 94%、测试集 80%，不是全部。</p>' + src('项目页 world_eval_amass_train.png、world_eval_test.png，从像素读数后重画') },
    { n: 4, part: '为什么用网络', title: '球和墙：真实目标函数有梯度为零的平台', sub: '公式来自项目页，当场计算；切换墙高', dur: 12, cam: [0, 1.38, 27, [0, 3, 0]], ctl: { label: '墙高 H', items: ['1.5', '2.5', '3.5'], def: 1 },
      html: '<p>项目页用这个例子说明为什么选神经网络而不选可微仿真器：球以速度 v、角度 θ 发出，距离 L 处有高 H 的墙，要最大化前进距离 x。为简化，球碰墙就粘住。</p>' +
        '<p>\\(x=L\\)（在落地前碰到墙且高度低于 H），否则 \\(x=v^2\\sin 2\\theta/g\\)。所以 x(θ) 有两段平台（低角度撞墙，高角度下落时撞墙），平台上 dx/dθ 恰好为 0；球刚好越过墙的角度有一次跳变。</p>' +
        '<p>右边的曲线和左边的抛物线是同一个公式。看 θ 走进平台时梯度如何变成 0。</p>' + guess('v = 12、L = 8、g = 9.81 和三档 H 是我选的。项目页的图只给公式，交互图的数值范围我没读到（存档缺失）。') + src('项目页 “Case Study: Ball-wall experiment” 的图') },
    { n: 5, part: '为什么用网络', title: '把它拟合成网络，再沿梯度爬', sub: '三个面都当场算；前半段看训练，后半段看爬坡；切换起点', dur: 15, bw: 1, cam: [0.2, 1.05, 42, [0, 2.6, 0]], ctl: { label: '起始 θ', items: ['8°', '25°', '70°'] },
      html: dl([['项目页设置', '两个 MLP：ReLU 和 SiLU，相同初始权重，RADAM，200 epoch，批量 300'], ['项目页结论', '学到的面更光滑，梯度也更光滑；真值面上策略容易困在梯度为零的地方'], ['这一幕', '切片 H = 2.5、L = 8；小球在 v = 12 上爬']]) +
        '<p>前半段：网络从同一个初值开始拟合。后半段：三个面用同一条更新规则 θ ← θ + 6·dx/dθ 走 80 步。真值面的梯度是解析式，两个网络的梯度由反传算出。</p>' +
        toyNote('网络 4→32→32→1，1500 个样本，学习率 0.005，都是我选的（项目页没给）。我试过 0.002、0.005、0.01 三档：0.002 时 SiLU 从 8° 出发也会困在 x = 8，所以这个结果依赖拟合质量，不能当成一般结论。') + src('项目页 “Case Study”。交互图的数据没有被存档，这里是我重新算的') },
    { n: 6, part: '监督 + 强化', title: '两种梯度来源，以及模型有偏差时会怎样', sub: '论文的组合方式没读到；这是我写的玩具；切换五种方式', dur: 14, toy: 1, cam: [0, 1.42, 29, [0, 1.3, 0]], ctl: { label: '方式', items: ['只用 RL', '穿过 W', '各一半', '穿过坏 W', '坏 W + RL'], def: 2 },
      html: unread('摘要只写“结合监督学习和强化学习”。两者的损失、权重、谁更新谁，我都没读到。“各一半”是我的写法，不是论文的公式。') +
        '<p>能从现有来源确定的：项目页有“用神经网络的梯度”训练策略的对比视频，SuperMimic 把这一类方法的共同点概括为学到的动力学加解析策略梯度。</p>' +
        '<p>横轴是消耗的仿真转移数，对数刻度。<b>穿过 W</b>：W 由回归训练，策略的梯度穿过 W 的开环滚动算出。<b>只用 RL</b>：只看回报的扰动估计，不用模型。<b>坏 W</b>：只用慢速、小动作数据拟合后冻结，它在别的区域是错的。</p>' +
        toyNote('一维滑块跟踪两个正弦之和，线性策略 3 个参数。视野 16 步，RL 用对偶扰动。曲线是这个页面算的，换种子会变。它说明两种梯度各自的性质，不代表论文的结果。') + src('摘要 · 项目页 · SuperMimic §2') },
    { n: 7, part: '结果', title: '策略和模型各用什么激活函数', sub: '项目页表格；切换指标', dur: 9, cam: [0.5, 1.05, 34, [0, 2.8, 0]], ctl: { label: '指标', items: METRICS.map(m => m === 'Succ' ? '成功率' : m) },
      html: dl([['设置', '都在 AMASS 上训练 24 小时'], ['P、W', '项目页没展开；P 应是策略、W 应是世界模型（我的推断）'], ['单位', '表上没写']]) +
        '<p>项目页的假设：SiLU 梯度更光滑，所以动力学模型用 SiLU 应当更好。按它的表做配对比较：固定 P，把 W 从 ReLU 换成 SiLU，两组的 5 个指标全部变好（我核对过）。</p>' +
        '<p>4 个组合里最好的不是两个都用 SiLU，而是 P(ReLU) W(SiLU)。这和基准表的 Our+ “把策略的激活从 SiLU 换成 ReLU”一致。</p>' + src('项目页 “Connecting with Choice of Activation Function”') },
    { n: 8, part: '结果', title: 'AMASS 模仿基准', sub: '七行七组数字原样画出；切换集合和指标', dur: 9, cam: [0, 1.38, 28, [0, 2.6, 0]], ctl: { label: '指标', items: [...METRICS.map(m => '训练 ' + m.replace('E_', '')), ...METRICS.map(m => '测试 ' + m.replace('E_', ''))], def: 1 },
      html: dl([['数据', 'AMASS-Train* 11313 段，AMASS-Test* 140 段'], ['*', '单张 NVIDIA A6000 上的结果'], ['FT', 'future tracks'], ['Ours+', '还把策略激活从 SiLU 换成 ReLU'], ['PULSE', '蒸馏方法，项目页说不能直接比']]) +
        '<p>带 * 的行才是同一硬件。最后两行最接近同条件比较：都是 2 天，PHC+ 用 3072 个环境，Ours+ 用 1024 个。</p>' +
        '<p>Ours* 一行在原表里整行加粗，但它不是每列最优：训练集成功率 99.2 低于 PHC+ 的 100。</p>' + src('项目页 benchmark.png。单位图上没写') },
    { n: 9, part: '结果', title: '和 DreamerV1 比单段动作', sub: '从 PNG 读数重画；切换动作', dur: 9, cam: [0, 1.42, 26, [0, 2.2, 0]], ctl: { label: '动作', items: ['Standing', 'Handball'] },
      html: dl([['纵轴', 'avg_rewards'], ['横轴', 'Step，项目页没说一步是什么'], ['范围', '只在单段动作上过拟合']]) +
        '<p>粗线是每段横轴内的中位数，细线是 10% 和 90% 分位。原图的噪声比这里大。</p>' +
        '<p>项目页说 DreamerV1 和 DreamerV3 在 AMASS 全集上的结果“之后再补”。存档里没有这部分。两条曲线的 Step 是否同一单位也没写，所以只能看终值，不能直接换算成样本效率。</p>' + src('项目页 dreamerv1_standing2.png、dreamerv1_handball.png，按网格线标定后读像素，重画') },
    { n: 10, part: '规模', title: '“几万段”和我读到的数字', sub: '一格 100 段，面积正比于段数；切换高亮', dur: 8, cam: [0, 0.85, 36, [-1.5, 0, 1]], ctl: { label: '高亮', items: ['测试 140', '训练 11313', '摘要的说法', 'SuperMimic 129514'], def: 1 },
      html: '<p>摘要和 SuperMimic 都说“几万段动作”（tens of thousands）。我读到的唯一具体数字是项目页的 11313 + 140，也就是一万一千多段。全文可能用了更大的数据集，这一点我核对不了。</p>' +
        '<p>摘要还提到稀疏奖励任务和动力学模型迁移。项目页只有速度跟踪和轨迹跟随的视频，迁移学习和“scaling law”两节在页面源码里被注释掉了，标着 Todos。所以这两项我没有数字可给。</p>' +
        guess('“几万”没有精确值，虚线框画的是 2 万和 9 万两个边界，是我选的。SuperMimic 的 129514 是另一个数据集和过滤流程，只作规模参照。') + src('摘要 · 项目页 · SuperMimic §1 和附录') }
  ];

  const stepsEl = $('steps'), btns = $('sceneBtns');
  SCENES.forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" data-i="${i}"><span class="k">${s.n} · ${s.part}</span>${s.title}<small>${s.sub}</small></button>`;
    stepsEl.appendChild(li);
    const b = document.createElement('button'); b.type = 'button'; b.dataset.i = i; b.textContent = s.n; b.title = s.title; b.setAttribute('aria-pressed', 'false'); btns.appendChild(b);
  });
  function showInfo(i) {
    const s = SCENES[i];
    $('infoTag').textContent = `第 ${s.n} 幕 · ${s.part}`; $('infoTitle').textContent = s.title; $('infoBody').innerHTML = s.html; $('stepNo').textContent = `${s.n} / ${SCENES.length}`;
    stepsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(+b.dataset.i === i)));
    btns.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
    if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([$('infoBody')]).catch(() => {});
  }
  let lastCap = null;
  const cap = h => { if (h !== lastCap) { lastCap = h; $('cap').innerHTML = h; } };

  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0, phi: 1.3, dist: 26, maxDist: 160, minDist: 3 }); } catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);
  let LABS = [], refDist = 24, PICKS = [];
  const FG = () => getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#e6ecf7';
  function lab(text, pos, o = {}) { const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: o.size || 24, pos, color: o.color || (o.bg === false ? FG() : undefined), border: o.border, bg: o.bg }); sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, Object.assign({ edgeOpacity: 0.3 }, o)); m.position.set(...pos); return m; }
  function glow(m, v) { if (m.material && m.material.emissive) { m.material.emissive.setHex(m.material.color.getHex()); m.material.emissiveIntensity = v; } }
  function setBar(m, h, y0 = 0) { m.scale.y = Math.max(h, 0.001); m.position.y = y0 + Math.max(h, 0.001) / 2; }
  const unitBar = (w, d, color, x, z = 0) => { const m = block(w, 1, d, color, [x, 0.5, z], { edges: false }); return m; };
  /* a chart frame in the z = 0 plane */
  function frame(G, X0, Y0, W, H, x, y, o = {}) {
    const fx = v => X0 + (x.log ? (Math.log10(Math.max(v, x.min)) - Math.log10(x.min)) / (Math.log10(x.max) - Math.log10(x.min)) : (v - x.min) / (x.max - x.min)) * W, fy = v => Y0 + (clamp(v, y.min, y.max) - y.min) / (y.max - y.min) * H;
    G.add(L.line([[X0, Y0, 0], [X0 + W, Y0, 0]], 0x8e9bb8), L.line([[X0, Y0, 0], [X0, Y0 + H, 0]], 0x8e9bb8));
    x.ticks.forEach(v => { G.add(L.line([[fx(v), Y0, 0], [fx(v), Y0 + H, 0]], 0x4a5878, { opacity: 0.3 }), lab(x.fmt ? x.fmt(v) : String(v), [fx(v), Y0 - 0.55, 0], { size: 17, bg: false })); });
    y.ticks.forEach(v => { G.add(L.line([[X0, fy(v), 0], [X0 + W, fy(v), 0]], 0x4a5878, { opacity: 0.3 }), lab(y.fmt ? y.fmt(v) : String(v), [X0 - 0.75, fy(v), 0], { size: 17, bg: false })); });
    if (x.label) G.add(lab(x.label, [X0 + W / 2, Y0 - 1.3, 0], { size: 18, bg: false }));
    if (y.label) G.add(lab(y.label, [X0 + (o.yLabX ?? 1.6), Y0 + H + 0.55, 0], { size: 18, bg: false }));
    return { fx, fy };
  }
  function polyline(G, pts, color, o = {}) { const l = L.line(pts.map(p => [p[0], p[1], p[2] || 0.02]), color, { opacity: o.opacity ?? 1 }); l.userData.n = pts.length; G.add(l); return l; }
  function thick(G, pts, color, r = 0.06, o = {}) { const n = pts.length, g = new THREE.Group(), mat = L.mat(color, { emissive: color, opacity: o.opacity }); mat.emissiveIntensity = 0.45; const cyl = new THREE.CylinderGeometry(r, r, 1, 6), up = new THREE.Vector3(0, 1, 0), segs = [];
    for (let i = 0; i + 1 < n; i++) { const a = new THREE.Vector3(pts[i][0], pts[i][1], o.z || 0.03), b = new THREE.Vector3(pts[i + 1][0], pts[i + 1][1], o.z || 0.03), d = b.clone().sub(a), m = new THREE.Mesh(cyl, mat); m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.y = d.length() + 0.001; m.quaternion.setFromUnitVectors(up, d.normalize()); g.add(m); segs.push(m); }
    G.add(g); return { reveal(q) { const k = Math.floor(q * segs.length + 1e-9); segs.forEach((m, i) => { m.visible = i < k; }); return k; }, g }; }
  const dot = (G, r, c) => { const m = L.sphere(r, c, { emissive: c }); m.material.emissiveIntensity = 0.5; G.add(m); return m; };

  /* ---------- 1 ---------- */
  function s1(G) {
    const GOOD = 0x2f9e6e, ONE = 0xc98500, NONE = COL.unread;
    const B = [['动作库\n11313 + 140 段', -9, 4.6, GOOD, 9], ['神经动力学 W\n结构没读到', -3, 4.6, ONE, 1], ['开环误差\n0.066 m，直方图', 3, 4.6, GOOD, 2], ['球墙实验\n公式 + 设置', 9, 4.6, GOOD, 3],
      ['监督 + 强化\n组合方式没读到', -9, 0.6, NONE, 5], ['激活函数\n2 × 2 表', -3, 0.6, GOOD, 6], ['AMASS 基准\n7 行', 3, 0.6, GOOD, 7], ['DreamerV1 对比\n2 张曲线', 9, 0.6, GOOD, 8]];
    const ms = B.map(([t, x, y, c, go]) => { const m = block(5, 2.2, 1, c, [x, y, 0], { opacity: 0.92 }); m.userData.go = go; G.add(m); PICKS.push(m); G.add(lab(t, [x, y, 0.7], { size: 22, bg: 'rgba(12,18,32,0.82)' })); return m; });
    const key = [['绿：有数字', GOOD, -7], ['黄：只有一句话', ONE, 0], ['灰：没读到', NONE, 7]]; key.forEach(([t, c, x]) => { G.add(block(0.5, 0.5, 0.5, c, [x - 1.5, -1.5, 0])); G.add(lab(t, [x + 0.3, -1.5, 0], { size: 21, bg: false })); });
    return { update(p) { const k = Math.floor(p * ms.length * 0.999); ms.forEach((m, i) => glow(m, i === k ? 0.45 : 0)); const b = B[k]; cap(`点方框跳到对应一幕。现在看：<b>${b[0].replace('\n', '，')}</b>。<b>全文没读到</b>，这张总览按来源分类，不是论文的架构图`); } };
  }
  /* ---------- 2 ---------- */
  function s2(G, k) {
    const res = memo('model', () => Toy.trainPolicy('model')), n = [10, 30, 60][k], o = memo('ol' + n, () => Toy.openLoop(res.W, res.th, 1.3, n)), X0 = -10, W_ = 20, Y0 = -0.8, H = 5.6;
    const F = frame(G, X0, Y0, W_, H, { min: 0, max: n * Toy.DT, ticks: [0, 1, 2, 3].map(t => t * (n * Toy.DT) / 3), fmt: v => v.toFixed(1), label: '时间（秒）' }, { min: -1.5, max: 1.5, ticks: [-1, 0, 1], label: '位置（玩具）' });
    const toP = a => a.map((v, i) => [F.fx(i * Toy.DT), F.fy(v)]), A = thick(G, toP(o.ref), COL.ref, 0.05), Bt = thick(G, toP(o.tru), COL.track, 0.05), C = thick(G, toP(o.pred), COL.pred, 0.06, { z: 0.08 });
    [['红 = 参考', COL.ref, -6], ['蓝 = 策略在真实仿真里', COL.track, 0.5], ['橙 = W 开环预测', COL.pred, 7]].forEach(([t, c, x]) => { G.add(lab(t, [x, -5.0, 0], { size: 18 })); });
    const rail = block(20, 0.1, 0.1, 0x8e9bb8, [0, -3.6, 0]); G.add(rail); const rx = v => clamp(v, -2.2, 2.2) * 4.3, a = dot(G, 0.32, COL.ref), b = dot(G, 0.32, COL.track), c = dot(G, 0.32, COL.pred);
    return { update(p) { const q = p, i = Math.min(n, Math.floor(q * n)); [A, Bt, C].forEach(s => s.reveal(q)); a.position.set(rx(o.ref[i]), -3.15, 0); b.position.set(rx(o.tru[i]), -3.6, 0); c.position.set(rx(o.pred[i]), -4.05, 0);
      cap(`玩具开环 t = <b>${(i * Toy.DT).toFixed(2)}</b> 秒：|预测 − 真实| = <b>${Math.abs(o.pred[i] - o.tru[i]).toFixed(3)}</b>（玩具单位）。论文的 0.066 m 是人形每关节误差，两者不能比`); } };
  }
  /* ---------- 3 ---------- */
  function s3(G, k) {
    const D = k ? HIST.test : HIST.train, X0 = -9.5, W_ = 19, F = frame(G, X0, 0, W_, 7, { min: 0, max: 0.2333, ticks: [0, 0.05, 0.1, 0.15, 0.2], fmt: v => v.toFixed(2), label: '每关节误差（米）' }, { min: 0, max: 0.8, ticks: [0, 0.2, 0.4, 0.6, 0.8], fmt: v => Math.round(v * 100) + '%', label: '占比' });
    const bw = BIN / 0.2333 * W_, bars = D.bins.map((c, i) => { const h = F.fy(c / D.n), m = block(bw * 0.92, h, 1.6, COL.track, [F.fx((i + 0.5) * BIN), h / 2, 0], { edges: false }); G.add(m); if (c) G.add(lab(k ? String(c) : '≈' + c, [F.fx((i + 0.5) * BIN), h + 0.45, 0.9], { size: 18 })); return m; });
    const mark = F.fx(2 * BIN); G.add(L.line([[mark, 0, 1], [mark, 7.2, 1]], COL.loss), lab('0.066 m 附近', [mark + 1.7, 7.4, 1], { size: 18 }));
    const sweep = block(0.06, 7, 0.06, 0x8e9bb8, [X0, 3.5, 1], { edges: false }); G.add(sweep);
    return { update(p) { const t = 0.2333 * p; sweep.position.x = F.fx(t); let c = 0; D.bins.forEach((b, i) => { const r = (i + 1) * BIN, on = r <= t + 1e-9; if (on) c += b; bars[i].material.color.setHex(on ? COL.wm : COL.mute); });
      cap(`阈值 <b>${t.toFixed(3)}</b> m：累积到完整柱子，约 <b>${(c / D.n * 100).toFixed(1)}%</b> 的${k ? '测试' : '训练'}动作落在里面（${k ? '' : '约 '}${c} / ${D.n}）。第 2 根右端的累计是 <b>${((D.bins[0] + D.bins[1]) / D.n * 100).toFixed(1)}%</b>`); } };
  }
  /* ---------- 4 ---------- */
  function s4(G, k) {
    const H = [1.5, 2.5, 3.5][k], v = 12, Lw = 8, sc = 0.72, ox = -13, ground = 0;
    const toW = (x, y) => [ox + x * sc, ground + y * sc, 0];
    G.add(block(17 * sc, 0.1, 2, 0x8e9bb8, [ox + 8.5 * sc, -0.05, 0], { edges: false }));
    const wall = block(0.2, H * sc, 2, COL.pred, [ox + Lw * sc, H * sc / 2, 0]); G.add(wall); G.add(lab(`墙 H = ${H}，L = ${Lw}`, [ox + Lw * sc, H * sc + 0.7, 1.1], { size: 18 }));
    const N = 80, traj = new THREE.BufferGeometry(); traj.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); const tl = new THREE.Line(traj, new THREE.LineBasicMaterial({ color: COL.pi })); G.add(tl);
    const ballM = dot(G, 0.28, COL.pi), land = dot(G, 0.24, COL.loss);
    const X0 = 2.8, W_ = 10.2, F = frame(G, X0, 0, W_, 7, { min: 0, max: 90, ticks: [0, 30, 45, 60, 90], fmt: v => v + '°', label: '发射角 θ' }, { min: 0, max: 16, ticks: [0, 4, 8, 12, 16], label: 'x（米）' });
    let prev = null; const segs = []; for (let i = 0; i <= 360; i++) { const a = i / 4, b = Toy.ball(a, v, H, Lw); const pt = [F.fx(a), F.fy(b.x)]; if (prev && Math.abs(prev.x - b.x) > 2) { segs.push([]); } if (!segs.length) segs.push([]); segs[segs.length - 1].push(pt); prev = b; }
    segs.forEach(s => { if (s.length > 1) thick(G, s.filter((_, i) => i % 3 === 0 || i === s.length - 1), COL.wm, 0.05); });
    const cur = dot(G, 0.24, COL.loss), pb = F.fy(0);
    const pos = traj.attributes.position, iv = []; let st = null; for (let i = 0; i <= 3600; i++) { const a = i / 40, w = Toy.ball(a, v, H, Lw).wall; if (w && st == null) st = a; if (!w && st != null) { iv.push([st, a]); st = null; } }
    iv.forEach(([a, b]) => G.add(lab(`平台\n${a.toFixed(1)}°–${b.toFixed(1)}°`, [F.fx((a + b) / 2) + (b - a < 10 ? 0.7 : 0), F.fy(8) - 1.0, 0], { size: 15 })));
    return { update(p) { const th = 2 + 86 * p, b = Toy.ball(th, v, H, Lw), dx = Toy.ballDx(th, v, H, Lw), r = th * Math.PI / 180, end = b.wall ? Lw / (v * Math.cos(r)) : 2 * v * Math.sin(r) / 9.81;
      for (let i = 0; i < N; i++) { const t = end * i / (N - 1), w = toW(v * Math.cos(r) * t, Math.max(0, v * Math.sin(r) * t - 4.905 * t * t)); pos.setXYZ(i, w[0], w[1], 0); } pos.needsUpdate = true;
      const e = toW(b.x, b.wall ? Math.max(0, b.yh) : 0); land.position.set(e[0], e[1], 0); const u = (p * 3) % 1, t2 = end * u; ballM.position.set(...toW(v * Math.cos(r) * t2, Math.max(0, v * Math.sin(r) * t2 - 4.905 * t2 * t2))); cur.position.set(F.fx(th), F.fy(b.x), 0.2);
      cap(`θ = <b>${th.toFixed(1)}°</b>，x = <b>${b.x.toFixed(2)}</b> m，dx/dθ = <b>${dx.toFixed(3)}</b> m/度${b.wall ? '：<b>撞墙，梯度为 0</b>，沿梯度走不出去' : ''}`); } };
  }
  /* ---------- 5 ---------- */
  function s5(G, k) {
    const bw = memo('bw', () => { const d = Toy.makeBW(); return { relu: Toy.trainBW('relu', d), silu: Toy.trainBW('silu', d), gt: Toy.gtSurface() }; }), v = 12, th0 = [8, 25, 70][k], W_ = 9.2, D_ = 6, hs = 0.3, xs = [-10.8, 0, 10.8];
    const col = x => { const t = clamp(x / 23, 0, 1); return [0.16 + 0.1 * t, 0.3 + 0.55 * t, 0.42 + 0.5 * t]; };
    const mk = (cx, name) => { const g = new THREE.BufferGeometry(), n = Toy.GN * Toy.GM, pos = new Float32Array(n * 3), c = new Float32Array(n * 3), idx = []; for (let j = 0; j + 1 < Toy.GM; j++) for (let i = 0; i + 1 < Toy.GN; i++) { const a = j * Toy.GN + i, b = a + 1, d = a + Toy.GN, e = d + 1; idx.push(a, d, b, b, d, e); }
      g.setIndex(idx); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.75, metalness: 0 })); G.add(m); G.add(lab(name, [cx, 6.9, 0], { size: 19 })); G.add(lab('θ →', [cx + W_ / 2 - 0.5, -0.5, D_ / 2 + 0.3], { size: 15, bg: false }), lab('v ↗', [cx + W_ / 2 + 0.5, -0.1, -D_ / 2 + 0.5], { size: 15, bg: false }));
      return { set(s) { for (let j = 0; j < Toy.GM; j++) for (let i = 0; i < Toy.GN; i++) { const q = j * Toy.GN + i, x = s[q], rgb = col(x); pos[3 * q] = cx - W_ / 2 + W_ * i / (Toy.GN - 1); pos[3 * q + 1] = clamp(x, -1, 24) * hs; pos[3 * q + 2] = D_ / 2 - D_ * j / (Toy.GM - 1); c[3 * q] = rgb[0]; c[3 * q + 1] = rgb[1]; c[3 * q + 2] = rgb[2]; } g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.computeVertexNormals(); } }; };
    const sG = mk(xs[0], '真值（可微仿真器的位置）'), sR = mk(xs[1], 'MLP · ReLU'), sS = mk(xs[2], 'MLP · SiLU'); sG.set(bw.gt);
    const pathG = Toy.ascent(a => Toy.ballDx(a, v, Toy.SLICE.H, Toy.SLICE.L), a => Toy.ball(a, v, Toy.SLICE.H, Toy.SLICE.L).x, th0), f = m => Toy.ascent(a => Toy.nnX(m, a, v).dx, a => Toy.nnX(m, a, v).x, th0), pathR = memo('pr' + k, () => f(bw.relu.m)), pathS = memo('ps' + k, () => f(bw.silu.m));
    const zv = D_ / 2 - D_ * (v - 5) / 10, bs = [dot(G, 0.24, COL.loss), dot(G, 0.24, COL.loss), dot(G, 0.24, COL.loss)]; let lastSnap = -1;
    const place = (b, cx, pt) => b.position.set(cx - W_ / 2 + W_ * pt[0] / 90, clamp(pt[1], -1, 24) * hs + 0.2, zv);
    return { update(p) { const tr = clamp(p / 0.42, 0, 1), snap = Math.round(tr * 20); if (snap !== lastSnap) { lastSnap = snap; sR.set(bw.relu.snaps[snap]); sS.set(bw.silu.snaps[snap]); }
      const q = clamp((p - 0.45) / 0.55, 0, 1), i = Math.round(q * 80), pg = pathG[i], pr = pathR[i], ps = pathS[i]; place(bs[0], xs[0], pg); place(bs[1], xs[1], pr); place(bs[2], xs[2], ps);
      const tx = a => Toy.ball(a, v, Toy.SLICE.H, Toy.SLICE.L).x.toFixed(2); if (p < 0.45) cap(`训练到第 <b>${snap * 10}</b> / 200 个 epoch，批量 300。起点相同，两个网络逐渐长出和真值相近的形状，但没有跳变和平台`);
      else cap(`第 <b>${i}</b> / 80 步，起点 ${th0}°。真实距离 x：真值面 <b>θ=${pg[0].toFixed(1)}° x=${tx(pg[0])}</b> · ReLU <b>θ=${pr[0].toFixed(1)}° x=${tx(pr[0])}</b> · SiLU <b>θ=${ps[0].toFixed(1)}° x=${tx(ps[0])}</b>`); } };
  }
  /* ---------- 6 ---------- */
  function s6(G, k) {
    const LBL = ['只用 RL', '穿过 W', '各一半', '穿过坏 W', '坏 W + RL'], CC = [COL.rl, COL.wm, COL.pi, COL.ref, COL.pred], runs = memo('pol', () => Toy.MODES.map(m => Toy.trainPolicy(m))), X0 = -10.5, W_ = 12.5, Y0 = -1.4, H_ = 6;
    const F = frame(G, X0, Y0, W_, H_, { min: 100, max: 60000, log: true, ticks: [100, 1000, 10000], fmt: v => v >= 1000 ? (v / 1000) + 'k' : String(v), label: '消耗的仿真转移数（对数）' }, { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], label: '真实仿真里的跟踪 RMSE（玩具）', }, { yLabX: 3.6 });
    const ths = runs.map((r, i) => { const pts = r.curve.map(c => [F.fx(Math.max(c[0], 100)), F.fy(c[1])]); return i === k ? thick(G, pts, CC[i], 0.075, { z: 0.1 }) : (polyline(G, pts, CC[i], { opacity: 0.75 }), null); });
    const end = runs[k].curve[runs[k].curve.length - 1]; const m1 = dot(G, 0.17, CC[k]);
    runs.forEach((r, i) => { const e = r.curve[r.curve.length - 1]; if (i !== k) G.add(lab(LBL[i], [F.fx(e[0]) - 0.1, F.fy(e[1]) + (i === 4 ? -0.42 : i === 0 ? 0.42 : 0.42), 0], { size: 14, bg: false })); });
    const useW = k !== 0, useR = k === 0 || k === 2 || k === 4, bad = k >= 3, bx = 7.6;
    const box = (t, y, c, on) => { const m = block(5, 1.45, 1, on ? c : COL.unread, [bx, y, 0], { opacity: on ? 0.95 : 0.4 }); G.add(m); G.add(lab(t, [bx, y, 0.7], { size: 17, bg: 'rgba(12,18,32,0.8)' })); return m; };
    const b1 = box('仿真样本 → 回归 W\n（监督）', 4.6, COL.wm, useW && !bad); box(bad ? 'W 已冻结，训练时\n只见过慢速小动作' : '策略穿过 W 滚 16 步\n（解析梯度）', 2.8, bad ? COL.ref : COL.wm, useW); box('仿真回报的扰动估计\n（RL 那一类）', 1.0, COL.rl, useR);
    const b4 = block(5, 1.45, 1, COL.loss, [bx, -0.8, 0]); G.add(b4); G.add(lab('更新策略 3 个参数', [bx, -0.8, 0.7], { size: 17, bg: 'rgba(12,18,32,0.8)' }));
    const rx = v => clamp(v, -2.2, 2.2) * 2.6, ry = -3.7; G.add(block(13, 0.08, 0.08, 0x8e9bb8, [bx - 6.6 + 0.3, ry, 0])); const ra = dot(G, 0.24, COL.ref), rb = dot(G, 0.24, COL.track); const rxo = bx - 6.3;
    return { update(p) { const n = runs[k].curve.length - 1, q = clamp(p / 0.85, 0, 1), i = Math.round(q * n), c = runs[k].curve[i]; ths[k].reveal(q); m1.position.set(F.fx(Math.max(c[0], 100)), F.fy(c[1]), 0.2);
      const t = 1.0 * ((p * 5) % 1) * Toy.T * Toy.DT, st = Math.min(Toy.T, Math.round(t / Toy.DT)), roll = Toy.rollSim(c[2], 1.3); ra.position.set(rxo + rx(Toy.refX(st * Toy.DT, 1.3)), ry + 0.3, 0); rb.position.set(rxo + rx(roll.tr[st][0]), ry - 0.3, 0);
      cap(`<b>${LBL[k]}</b>（玩具）：第 ${i} / ${n} 次迭代，用了 <b>${c[0].toLocaleString('en')}</b> 个转移，RMSE <b>${c[1].toFixed(3)}</b>。终点 ${end[0].toLocaleString('en')} 个转移，RMSE ${end[1].toFixed(3)}`); } };
  }
  /* ---------- 7 ---------- */
  function s7(G, k) {
    const hi = k === 0 ? 100 : Math.max(...PW.map(r => r[k + 1])), best = k === 0 ? Math.max(...PW.map(r => r[1])) : Math.min(...PW.map(r => r[k + 1])), bars = PW.map(r => { const x = r[6] ? 4.2 : -4.2, z = r[7] ? 3.6 : -3.6, v = r[k + 1], c = r[7] ? COL.mute : COL.wm, m = unitBar(3, 3, c, x, z); G.add(m); const t = lab(`${r[0]}
${v}${v === best ? ' · 最好' : ''}`, [x, 0, z], { size: 17 }); G.add(t); return { m, v, t }; });
    G.add(L.grid(18, 9));
    G.add(lab('绿：W 用 SiLU · 灰：W 用 ReLU', [0, 0.1, 7.6], { size: 18, bg: false }));
    return { update(p) { const u = L.ease(clamp(p / 0.6, 0, 1)); bars.forEach(b => { const h = u * b.v / hi * 5; setBar(b.m, h); b.t.position.y = h + 0.8; }); const name = k === 0 ? '成功率（越高越好）' : METRICS[k] + '（越低越好）';
      const d0 = PW[0][k + 1] - PW[1][k + 1], d1 = PW[3][k + 1] - PW[2][k + 1]; cap(`<b>${name}</b>。把 W 从 ReLU 换成 SiLU：P 用 SiLU 时变化 <b>${d0 > 0 ? '+' : ''}${d0.toFixed(1)}</b>，P 用 ReLU 时变化 <b>${d1 > 0 ? '+' : ''}${d1.toFixed(1)}</b>。柱子从 0 起`); } };
  }
  /* ---------- 8 ---------- */
  function s8(G, k) {
    const test = k >= 5, mi = k % 5, rows = BENCH.map(r => r[test ? 3 : 2][mi]), hi = Math.max(...rows), good = mi === 0 ? Math.max(...rows) : Math.min(...rows), gap = 2.8, x0 = -gap * 3;
    const bars = BENCH.map((r, i) => { const x = x0 + gap * i + (i >= 5 ? 0.35 : 0), ours = r[0].startsWith('Ours'), m = unitBar(1.9, 1.5, ours ? COL.wm : COL.mute, x); G.add(m); G.add(lab(r[0].replace(' (', '\n('), [x, -0.95, 0.8], { size: 15, bg: false }), lab(r[1], [x, -2.3, 0.8], { size: 14, bg: false })); const t = lab(String(rows[i]) + (rows[i] === good ? ' · 最好' : ''), [x, 0, 1], { size: 18 }); G.add(t); return { m, t, v: rows[i] }; });
    G.add(L.line([[x0 + gap * 4.68, -2.7, 0], [x0 + gap * 4.68, 6.4, 0]], 0x8e9bb8, { dashed: true }), lab('这条线右边：同一张 A6000，同样 2 天', [x0 + gap * 5.7, 6.7, 0], { size: 16 }));
    return { update(p) { const u = L.ease(clamp(p / 0.6, 0, 1)); bars.forEach(b => { const h = u * b.v / hi * 5; setBar(b.m, h); b.t.position.y = h + 0.5; b.t.visible = u > 0.95; }); cap(`AMASS-${test ? 'Test' : 'Train'} · <b>${METRICS[mi]}</b>，${mi === 0 ? '越高越好' : '越低越好'}。数字照录，单位图上没写。柱子从 0 起`); } };
  }
  /* ---------- 9 ---------- */
  function s9(G, k) {
    const hb = k === 1, sd = hb ? CURVES.handball_sd : CURVES.standing_sd, dr = hb ? CURVES.handball_dr : CURVES.standing_dr, xmax = hb ? 4 : 8, ymin = hb ? -5 : 0, ymax = hb ? 30 : 34, F = frame(G, -10, 0, 20, 6.4, { min: 0, max: xmax, ticks: hb ? [0, 1, 2, 3, 4] : [0, 2, 4, 6, 8], fmt: v => v + 'k', label: 'Step（原图的单位，定义没写）' }, { min: ymin, max: ymax, ticks: hb ? [-5, 5, 15, 25] : [0, 10, 20, 30], label: 'avg_rewards' });
    const cs = [0x3987e5, 0xd95926], draw = (d, c) => { [2, 3].forEach(j => polyline(G, d.map(r => [F.fx(r[0]), F.fy(r[j])]), c, { opacity: 0.3 })); return thick(G, d.map(r => [F.fx(r[0]), F.fy(r[1])]), c, 0.07); }, A = draw(sd, cs[0]), B = draw(dr, cs[1]), eS = sd[sd.length - 1], eD = dr[dr.length - 1], la = lab(`SuperDyno ≈ ${eS[1].toFixed(0)}`, [F.fx(eS[0]) - 1, F.fy(eS[1]) + 0.65, 0], { size: 18 }), lb = lab(`DreamerV1 ≈ ${eD[1].toFixed(0)}`, [F.fx(eD[0]) - 1, F.fy(eD[1]) + 0.65, 0], { size: 18 }); G.add(la, lb);
    return { update(p) { const q = clamp(p / 0.85, 0, 1); A.reveal(q); B.reveal(q); la.visible = lb.visible = q > 0.98; cap(`${hb ? 'Handball' : 'Standing'}，单段动作：<b>SuperDyno 约 ${eS[1].toFixed(1)}</b>（到 ${eS[0].toFixed(1)}k），<b>DreamerV1 约 ${eD[1].toFixed(1)}</b>（到 ${eD[0].toFixed(1)}k）。读数是目测级，重画自 PNG`); } };
  }
  /* ---------- 10 ---------- */
  function s10(G, k) {
    const SET = [['测试集', 140, -13.5], ['训练集', 11313, -10], ['SuperMimic', 129514, 8]], tile = 0.26, geo = new THREE.BoxGeometry(tile * 0.88, 0.16, tile * 0.88), im = [];
    SET.forEach(([n, c, cx], q) => { const m = Math.max(1, Math.round(c / 100)), side = Math.ceil(Math.sqrt(m)), hl = (q === 0 && k === 0) || (q === 1 && k === 1) || (q === 2 && k === 3), mesh = new THREE.InstancedMesh(geo, L.mat(hl ? COL.wm : COL.mute), m), M = new THREE.Matrix4(); mesh.count = m; for (let i = 0; i < m; i++) { M.makeTranslation(cx + (i % side - (side - 1) / 2) * tile, 0.08, (Math.floor(i / side) - (side - 1) / 2) * tile); mesh.setMatrixAt(i, M); } mesh.frustumCulled = false; G.add(mesh); im.push({ mesh, m }); G.add(lab(`${n}\n${c.toLocaleString('en')} 段`, [cx, 0.5, side * tile / 2 + 1.1], { size: 18 })); });
    /* ghost outlines for 20k and 90k */
    const sqr = (c, color) => { const m = Math.round(c / 100), s = Math.ceil(Math.sqrt(m)) * tile / 2, cx = -2.4; return L.line([[cx - s, 0.05, -s], [cx + s, 0.05, -s], [cx + s, 0.05, s], [cx - s, 0.05, s], [cx - s, 0.05, -s]], color, { dashed: true }); }; const hl2 = k === 2; G.add(sqr(20000, hl2 ? COL.loss : 0x8e9bb8), sqr(90000, hl2 ? COL.loss : 0x8e9bb8)); G.add(lab('摘要：tens of thousands\n虚线是 2 万和 9 万（我选的边界）', [-2.4, 0.5, 5.2], { size: 17 }));
    const CAP = ['测试集 140 段（项目页），不到一格半', '训练集 11,313 段（项目页）。这是我读到的 SuperDyno 最大的具体数字', '摘要和 SuperMimic 都说 tens of thousands，没有给精确数。11,313 够不上“几万”，全文是否用了更大的数据集，我核对不了', 'SuperMimic 的基准是 129,514 段（它自己的过滤流程），约是 11,313 的 11.4 倍。数据集不同，只作规模参照'];
    return { update(p) { const u = L.ease(clamp(p / 0.7, 0, 1)); im.forEach(o => { o.mesh.count = Math.max(1, Math.round(o.m * u)); }); cap(CAP[k]); } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10];
  const CTL = SCENES.map(s => (s.ctl ? (s.ctl.def || 0) : 0));
  let cur = 0, api = null, playing = !L.reduced(), t0 = 0, pNow = 0, tw = null, token = 0;
  const HOLD = 1.8, has = new Set();
  const aspectFix = () => { const el = $('stage'), asp = (el.clientWidth || 1) / (el.clientHeight || 1); return Math.min(2.2, Math.max(1, 1.45 / asp)); };
  function fly(th, ph, d, tg) { let dth = th - S.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth)); d *= aspectFix(); tw = { t0: performance.now(), from: [S.theta, S.phi, S.dist, S.target.clone()], to: [S.theta + dth, ph, d, new THREE.Vector3(...tg)] }; }
  function setPlay(on) { playing = on; $('play').textContent = on ? '❚❚ 暂停' : '▶ 播放'; $('play').setAttribute('aria-label', on ? '暂停' : '播放'); }
  function renderCtl(sc, i) { const box = $('ctl'); if (sc.ctl) { box.hidden = false; box.innerHTML = `<span>${sc.ctl.label}</span>` + sc.ctl.items.map((t, q) => `<button type="button" data-k="${q}" aria-pressed="${q === CTL[i]}">${t}</button>`).join(''); } else { box.hidden = true; box.innerHTML = ''; } }
  function build(i, p0, keepCam) { const sc = SCENES[i]; L.clear(root); LABS = []; PICKS = []; lastCap = null; if (!keepCam) fly(...sc.cam); refDist = sc.cam[2] * aspectFix(); const G = new THREE.Group(); root.add(G); api = BUILD[i](G, CTL[i]); pNow = p0; t0 = performance.now() - p0 * sc.dur * 1000; api.update(pNow); $('scrub').value = Math.round(pNow * 1000); }
  function go(i, p0 = 0, keepCam = false) {
    cur = (i + SCENES.length) % SCENES.length; showInfo(cur); const sc = SCENES[cur], mine = ++token; renderCtl(sc, cur); if (!S) { window.__sdReady = true; return; }
    if (sc.bw && !has.has('bw')) { L.clear(root); LABS = []; api = null; lastCap = null; cap('两个网络正在这个页面里现场训练，约几秒…'); window.__sdReady = false; setTimeout(() => { if (mine !== token) return; has.add('bw'); build(cur, p0, keepCam); window.__sdReady = true; }, 60); return; }
    build(cur, p0, keepCam); window.__sdReady = true;
  }
  if (S) {
    S.onTick(() => {
      if (playing && api) { const sc = SCENES[cur], el = (performance.now() - t0) / 1000; if (el > sc.dur + HOLD) { t0 = performance.now(); pNow = 0; } else pNow = Math.min(1, el / sc.dur); api.update(pNow); $('scrub').value = Math.round(pNow * 1000); }
      if (tw) { const q = L.reduced() ? 1 : Math.min(1, (performance.now() - tw.t0) / 900), e = L.ease(q), a = tw.from, b = tw.to; S.setView(L.lerp(a[0], b[0], e), L.lerp(a[1], b[1], e), L.lerp(a[2], b[2], e), [L.lerp(a[3].x, b[3].x, e), L.lerp(a[3].y, b[3].y, e), L.lerp(a[3].z, b[3].z, e)]); if (q >= 1) tw = null; }
      const f = clamp(S.dist / refDist, 0.6, 1.6); for (const sp of LABS) sp.scale.copy(sp.userData.s0).multiplyScalar(f);
    });
    S.onClick(() => PICKS, hit => { const g = hit?.object?.userData?.go ?? hit?.object?.parent?.userData?.go; if (g != null) go(g); });
    S.onHover(() => PICKS, hit => { $('stage').style.cursor = hit ? 'pointer' : ''; });
  }
  $('ctl').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; CTL[cur] = +b.dataset.k; go(cur, pNow, true); });
  $('play').onclick = () => { if (!playing) t0 = performance.now() - pNow * SCENES[cur].dur * 1000; setPlay(!playing); };
  $('scrub').oninput = e => { setPlay(false); pNow = e.target.value / 1000; if (api) api.update(pNow); };
  $('prev').onclick = () => go(cur - 1); $('next').onclick = () => go(cur + 1);
  btns.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); });
  stepsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; go(+b.dataset.i); if (!document.body.classList.contains('embed')) $('stage').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' && e.key !== ' ') return; if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1); else if (e.key === ' ') { e.preventDefault(); $('play').click(); } });
  const s0 = clamp((parseInt(qs.get('scene'), 10) || 1) - 1, 0, SCENES.length - 1), pq = qs.get('p'), kq = qs.get('k');
  if (kq != null && SCENES[s0].ctl) CTL[s0] = clamp(parseInt(kq, 10) || 0, 0, SCENES[s0].ctl.items.length - 1);
  setPlay(playing && pq == null);
  go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0));
})();
