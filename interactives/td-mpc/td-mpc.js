'use strict';
/* TD-MPC (arXiv 2203.04955) taken apart into eleven animated scenes. Hyperparameters come from the paper's Tables 4, 7 and the
   released code nicklashansen/tdmpc@f4d85ec; bars in scenes 9 and 10 are values read from the paper's vector figures.
   Two toys compute for real in the page. Plan: Algorithm 1 (MPPI with top-k, Eq. 3-5) on a 2D point in a U-shaped trap.
   Told: a tiny TOLD trained by Algorithm 2 with reverse-mode autodiff. Every scene's update(p) is a pure function of p. */
const Toy = (function () {
  const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const gaussF = r => { const u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * v); };
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

  /* ---------- planner toy: the world. A point in [-10,10]^2, velocity control, a U-shaped wall between it and the goal ---------- */
  const W = { step: 0.6, gamma: 0.99, goal: [7, 0], start: [-7, 0.3], goalR: 1.0, T: 60,
    /* wall rectangles [x0,x1,y0,y1] */
    rects: [[2.0, 3.2, -5.8, 5.8], [-3.0, 3.2, 4.6, 5.8], [-3.0, 3.2, -5.8, -4.6]] };
  function blocked(x, y) { if (x < -10 || x > 10 || y < -10 || y > 10) return true; for (const r of W.rects) if (x > r[0] && x < r[1] && y > r[2] && y < r[3]) return true; return false; }
  /* one model step: the toy's d(z,a). Moves axis by axis so the point slides along a wall. Writes OUT[0..1]. */
  const OUT = [0, 0];
  function move(x, y, ax, ay) {
    const nx = x + W.step * ax, ny = y + W.step * ay;
    let px = x, py = y;
    if (!blocked(nx, py)) px = nx;
    if (!blocked(px, ny)) py = ny;
    OUT[0] = px; OUT[1] = py;
  }
  const rewardOf = (x, y, sparse) => { const d = Math.hypot(x - W.goal[0], y - W.goal[1]); return sparse ? (d < W.goalR ? 1 : 0) : (d < W.goalR ? 1 : -d / 10); };
  /* value iteration on a grid: this stands in for the learned Q. It is the true optimum of the toy, a thing no real run has. */
  const G = 61, CELL = 20 / (G - 1);
  const DIRS = (() => { const a = [[0, 0]]; for (let i = 0; i < 16; i++) a.push([Math.cos(i * Math.PI / 8), Math.sin(i * Math.PI / 8)]); return a; })();
  let TRANS = null;
  function buildTrans() {
    TRANS = new Float32Array(G * G * DIRS.length * 2);
    for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const x = -10 + j * CELL, y = -10 + i * CELL; for (let k = 0; k < DIRS.length; k++) { move(x, y, DIRS[k][0], DIRS[k][1]); const o = 2 * ((i * G + j) * DIRS.length + k); TRANS[o] = OUT[0]; TRANS[o + 1] = OUT[1]; } }
  }
  function lookup(V, x, y) {
    const u = clamp((x + 10) / CELL, 0, G - 1.001), v = clamp((y + 10) / CELL, 0, G - 1.001), j = u | 0, i = v | 0, a = u - j, b = v - i, o = i * G + j;
    return (1 - a) * (1 - b) * V[o] + a * (1 - b) * V[o + 1] + (1 - a) * b * V[o + G] + a * b * V[o + G + 1];
  }
  const VCACHE = {};
  function valueFn(sparse) {
    const key = sparse ? 's' : 'd'; if (VCACHE[key]) return VCACHE[key];
    if (!TRANS) buildTrans();
    let V = new Float32Array(G * G), N = new Float32Array(G * G);
    for (let it = 0; it < 450; it++) {
      for (let c = 0; c < G * G; c++) {
        let best = -Infinity; const o0 = 2 * c * DIRS.length;
        for (let k = 0; k < DIRS.length; k++) { const nx = TRANS[o0 + 2 * k], ny = TRANS[o0 + 2 * k + 1], q = rewardOf(nx, ny, sparse) + W.gamma * lookup(V, nx, ny); if (q > best) best = q; }
        N[c] = best;
      }
      const t = V; V = N; N = t;
    }
    return (VCACHE[key] = V);
  }
  /* "wrong" Q: the true V plus a fixed smooth error with bumps about 3 world units wide, scaled to the task's value range */
  function bumpyValue(sparse) {
    const key = sparse ? 'sb' : 'db'; if (VCACHE[key]) return VCACHE[key];
    const V = valueFn(sparse), B = new Float32Array(G * G); let lo = Infinity, hi = -Infinity; for (let c = 0; c < G * G; c++) { if (V[c] < lo) lo = V[c]; if (V[c] > hi) hi = V[c]; }
    const A = 0.03 * (hi - lo);
    for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const x = -10 + j * CELL, y = -10 + i * CELL; B[i * G + j] = V[i * G + j] + A * (Math.sin(2.1 * x + 0.7) * Math.cos(1.9 * y - 0.4) + 0.5 * Math.sin(1.3 * x - 1.7 * y)); }
    return (VCACHE[key] = B);
  }
  /* the toy's deterministic pi: one-step greedy on whichever Q it is paired with, then noise as in the code's pi(z, std): Gaussian clipped to +-0.3 */
  function piAct(V, x, y, sparse, out) {
    let best = -Infinity, bi = 0;
    for (let k = 1; k < DIRS.length; k++) { move(x, y, DIRS[k][0], DIRS[k][1]); const q = rewardOf(OUT[0], OUT[1], sparse) + W.gamma * lookup(V, OUT[0], OUT[1]); if (q > best) { best = q; bi = k; } }
    out[0] = DIRS[bi][0]; out[1] = DIRS[bi][1];
  }

  /* ---------- Algorithm 1. cfg: N, H, J, tau, eps, valueMode 0 off / 1 exact / 2 wrong, usePi, sparse, keep (trajectories kept for display) ---------- */
  function planCfg(o) { const N = o.N ?? 512; return { N, H: o.H ?? 5, J: o.J ?? 6, tau: o.tau ?? 0.5, eps: o.eps ?? 0.05, mom: o.mom ?? 0.1, valueMode: o.valueMode ?? 1, usePi: o.usePi ?? true, sparse: !!o.sparse, K: o.K ?? Math.max(2, Math.round(N / 8)), keep: o.keep ?? 48, piOnce: o.piOnce ?? true, piStd: o.piStd ?? 0.05 }; }
  const noise = (rnd, s) => { const e = gaussF(rnd) * s; return e < -0.3 ? -0.3 : e > 0.3 ? 0.3 : e; };
  function plan(x0, y0, prevMu, c, rnd) {
    const { N, H, J, K, tau, sparse } = c, Npi = c.usePi ? Math.max(1, Math.floor(0.05 * N)) : 0, M = N + Npi;
    const V = c.valueMode === 1 ? valueFn(sparse) : c.valueMode === 2 ? bumpyValue(sparse) : null;
    const PV = c.valueMode === 2 ? bumpyValue(sparse) : valueFn(sparse);
    const mu = new Float32Array(2 * H), sg = new Float32Array(2 * H).fill(2); if (prevMu) { const Hp = prevMu.length / 2; for (let t = 0; t < H - 1 && t + 1 < Hp; t++) { mu[2 * t] = prevMu[2 * t + 2]; mu[2 * t + 1] = prevMu[2 * t + 3]; } }
    const acts = new Float32Array(M * H * 2), val = new Float64Array(M), rs = new Float64Array(M), qs = new Float64Array(M), path = new Float32Array(M * (H + 1) * 2), tmp = [0, 0];
    const sampPi = () => { for (let m = N; m < M; m++) { let x = x0, y = y0; for (let t = 0; t < H; t++) { piAct(PV, x, y, sparse, tmp); const ax = clamp(tmp[0] + noise(rnd, c.piStd), -1, 1), ay = clamp(tmp[1] + noise(rnd, c.piStd), -1, 1); acts[2 * (m * H + t)] = ax; acts[2 * (m * H + t) + 1] = ay; move(x, y, ax, ay); x = OUT[0]; y = OUT[1]; } } };
    if (Npi && c.piOnce) sampPi();
    const iters = [], idx = new Array(M); let score = null, eliteIdx = null;
    for (let j = 0; j < J; j++) {
      for (let m = 0; m < N; m++) for (let t = 0; t < H; t++) for (let d = 0; d < 2; d++) acts[2 * (m * H + t) + d] = clamp(mu[2 * t + d] + sg[2 * t + d] * gaussF(rnd), -1, 1);
      if (Npi && !c.piOnce) sampPi();
      for (let m = 0; m < M; m++) {
        let x = x0, y = y0, ret = 0, disc = 1; path[2 * m * (H + 1)] = x; path[2 * m * (H + 1) + 1] = y;
        for (let t = 0; t < H; t++) { const o = 2 * (m * H + t); move(x, y, acts[o], acts[o + 1]); x = OUT[0]; y = OUT[1]; ret += disc * rewardOf(x, y, sparse); disc *= W.gamma; const p = 2 * (m * (H + 1) + t + 1); path[p] = x; path[p + 1] = y; }
        rs[m] = ret; const q = V ? disc * lookup(V, x, y) : 0; qs[m] = q; val[m] = ret + q; idx[m] = m;
      }
      idx.sort((a, b) => val[b] - val[a]);
      eliteIdx = idx.slice(0, K);
      const vmax = val[eliteIdx[0]]; score = eliteIdx.map(m => Math.exp(tau * (val[m] - vmax))); const sm = score.reduce((a, b) => a + b, 0); score = score.map(s => s / sm);
      const nm = new Float32Array(2 * H), ns = new Float32Array(2 * H);
      for (let e = 0; e < K; e++) for (let i = 0; i < 2 * H; i++) nm[i] += score[e] * acts[2 * eliteIdx[e] * H + i];
      for (let e = 0; e < K; e++) for (let i = 0; i < 2 * H; i++) { const dl = acts[2 * eliteIdx[e] * H + i] - nm[i]; ns[i] += score[e] * dl * dl; }
      for (let i = 0; i < 2 * H; i++) { ns[i] = clamp(Math.sqrt(ns[i]), c.eps, 2); mu[i] = c.mom * mu[i] + (1 - c.mom) * nm[i]; sg[i] = ns[i]; }
      /* what to draw: the elites first (up to half), then an even sample of the rest, policy trajectories always */
      const show = []; const seen = new Set(); const Ke = Math.min(K, c.keep >> 1);
      for (let e = 0; e < Ke; e++) { show.push(eliteIdx[e]); seen.add(eliteIdx[e]); }
      for (let m = N; m < M && show.length < c.keep; m++) if (!seen.has(m)) { show.push(m); seen.add(m); }
      const step = Math.max(1, Math.floor(M / Math.max(1, c.keep - show.length)));
      for (let m = 0; m < M && show.length < c.keep; m += step) if (!seen.has(m)) { show.push(m); seen.add(m); }
      const rank = new Map(); idx.forEach((m, r) => rank.set(m, r)); const wt = new Map(); eliteIdx.forEach((m, e) => wt.set(m, score[e]));
      const L = show.length, tr = new Float32Array(L * (H + 1) * 2), info = [];
      show.forEach((m, l) => { tr.set(path.subarray(2 * m * (H + 1), 2 * (m + 1) * (H + 1)), 2 * l * (H + 1)); info.push({ v: val[m], r: rs[m], q: qs[m], w: wt.get(m) || 0, elite: rank.get(m) < K, pi: m >= N, rank: rank.get(m) }); });
      /* mean trajectory rolled through the model */
      const mt = new Float32Array(2 * (H + 1)); { let x = x0, y = y0; mt[0] = x; mt[1] = y; for (let t = 0; t < H; t++) { move(x, y, clamp(mu[2 * t], -1, 1), clamp(mu[2 * t + 1], -1, 1)); x = OUT[0]; y = OUT[1]; mt[2 * t + 2] = x; mt[2 * t + 3] = y; } }
      let piW = 0, nPiElite = 0; eliteIdx.forEach((m, e) => { if (m >= N) { piW += score[e]; nPiElite++; } });
      let sigAvg = 0; for (let i = 0; i < 2 * H; i++) sigAvg += sg[i]; sigAvg /= 2 * H;
      iters.push({ tr, info, L, mt, best: val[eliteIdx[0]], bestR: rs[eliteIdx[0]], bestQ: qs[eliteIdx[0]], eliteMin: val[eliteIdx[K - 1]], piW, nPiElite, sigAvg, mu: mu.slice(0, 2), sig0: [sg[0], sg[1]] });
    }
    /* code: pick one elite by score, take its first action (no extra noise in eval mode). Algorithm 1 line 11 would sample N(mu, sigma) instead */
    let u = rnd(), pick = 0; for (let e = 0; e < K; e++) { u -= score[e]; if (u <= 0) { pick = e; break; } pick = e; }
    const m = eliteIdx[pick];
    return { a: [acts[2 * m * H], acts[2 * m * H + 1]], mu, sg, iters, H, M, Npi };
  }
  /* a whole episode of receding-horizon MPC, or of the policy alone. Same seed for same settings, so a frame is a pure function of p. */
  function episode(o) {
    const c = planCfg(o), rnd = mulberry(o.seed ?? 11), T = o.T ?? W.T, mode = o.mode || 'plan';
    let x = (o.start || W.start)[0], y = (o.start || W.start)[1], prev = null, R = 0, reached = -1;
    const steps = [], tmp = [0, 0], PV = c.valueMode === 2 ? bumpyValue(c.sparse) : valueFn(c.sparse), xs = [x], ys = [y], rew = [];
    for (let t = 0; t < T; t++) {
      let a, pl = null;
      if (mode === 'plan') { pl = plan(x, y, o.warm === false ? null : prev, c, rnd); a = pl.a; prev = pl.mu; }
      else { piAct(PV, x, y, c.sparse, tmp); a = tmp.slice(); }
      if (o.lite) pl = null; else if (pl && o.lastOnly) pl.iters = [pl.iters[pl.iters.length - 1]];
      move(x, y, a[0], a[1]); x = OUT[0]; y = OUT[1];
      const r = rewardOf(x, y, c.sparse); R += r; rew.push(r); xs.push(x); ys.push(y);
      if (reached < 0 && Math.hypot(x - W.goal[0], y - W.goal[1]) < W.goalR) reached = t + 1;
      steps.push(pl);
    }
    return { steps, xs, ys, R, reached, rew, c };
  }

  /* ---------- TOLD toy: tape-based reverse-mode autodiff, enough for small MLPs ---------- */
  const CAP = 1 << 20, tv = new Float64Array(CAP), ta = new Int32Array(CAP), tb = new Int32Array(CAP), da = new Float64Array(CAP), db = new Float64Array(CAP), tg = new Float64Array(CAP);
  let tn = 0;
  const leaf = v => { tv[tn] = v; ta[tn] = -1; tb[tn] = -1; return tn++; };
  const add = (a, b) => { tv[tn] = tv[a] + tv[b]; ta[tn] = a; tb[tn] = b; da[tn] = 1; db[tn] = 1; return tn++; };
  const sub = (a, b) => { tv[tn] = tv[a] - tv[b]; ta[tn] = a; tb[tn] = b; da[tn] = 1; db[tn] = -1; return tn++; };
  const mul = (a, b) => { tv[tn] = tv[a] * tv[b]; ta[tn] = a; tb[tn] = b; da[tn] = tv[b]; db[tn] = tv[a]; return tn++; };
  const scl = (a, k) => { tv[tn] = tv[a] * k; ta[tn] = a; tb[tn] = -1; da[tn] = k; return tn++; };
  const elu = a => { const x = tv[a]; if (x > 0) { tv[tn] = x; da[tn] = 1; } else { const e = Math.exp(x); tv[tn] = e - 1; da[tn] = e; } ta[tn] = a; tb[tn] = -1; return tn++; };
  const tanh = a => { const h = Math.tanh(tv[a]); tv[tn] = h; ta[tn] = a; tb[tn] = -1; da[tn] = 1 - h * h; return tn++; };
  function backward(root) { tg.fill(0, 0, tn); tg[root] = 1; for (let i = tn - 1; i >= 0; i--) { const g = tg[i]; if (g === 0) continue; if (ta[i] >= 0) tg[ta[i]] += g * da[i]; if (tb[i] >= 0) tg[tb[i]] += g * db[i]; } }
  /* a network is a flat Float64Array plus an apply(ids, inputs) that reads parameter leaves */
  function linear(ins, nOut, P, off) { const out = []; let o = off; const n = ins.length; for (let i = 0; i < nOut; i++) { let s = P[o + n]; for (let j = 0; j < n; j++) s = add(s, mul(P[o + j], ins[j])); out.push(s); o += n + 1; } return out; }
  const linN = (i, o) => (i + 1) * o;
  function mlpN(i, h, o) { return linN(i, h) + linN(h, o); }
  function mlp(ins, h, nOut, P, off) { const hid = linear(ins, h, P, off).map(elu); return linear(hid, nOut, P, off + linN(ins.length, h)); }

  /* s = (x, v, n1..n4). Only x, v matter for reward. n1..n4 are two rotating pairs, larger than x and v and independent of the action. */
  const SD = 6; let AMP = 5;
  function envStep(s, a, rnd) { const v = 0.9 * s[1] + 0.25 * a, x = s[0] + 0.25 * v, c1 = Math.cos(0.3), s1 = Math.sin(0.3), c2 = Math.cos(0.5), s2 = Math.sin(0.5); return [x, v, c1 * s[2] - s1 * s[3], s1 * s[2] + c1 * s[3], c2 * s[4] - s2 * s[5], s2 * s[4] + c2 * s[5]]; }
  const envR = (s, a) => Math.exp(-s[0] * s[0]) - 0.02 * a * a;
  function makeData(rnd, eps, len) {
    const D = [];
    for (let e = 0; e < eps; e++) {
      const th1 = rnd() * 6.283, th2 = rnd() * 6.283; let s = [(rnd() - 0.5) * 5, (rnd() - 0.5) * 2, AMP * Math.cos(th1), AMP * Math.sin(th1), AMP * Math.cos(th2), AMP * Math.sin(th2)];
      const S = [s], A = [], R = []; let a = 0;
      for (let t = 0; t < len; t++) { a = clamp(0.7 * a + 0.7 * (2 * rnd() - 1), -1, 1); A.push(a); R.push(envR(s, a)); s = envStep(s, a, rnd); S.push(s); }
      D.push({ S, A, R });
    }
    return D;
  }
  /* parameter layout */
  function layout(Z, hid) { const o = {}; let n = 0; const put = (k, c) => { o[k] = n; n += c; }; put('h', linN(SD, Z)); put('d', linN(Z + 1, Z)); put('R', mlpN(Z + 1, hid, 1)); put('Q', mlpN(Z + 1, hid, 1)); put('pi', mlpN(Z, 8, 1)); put('dec', linN(Z, SD)); o.n = n; return o; }
  /* Algorithm 2 on the toy. mode: 'told' (Eq. 8-10), 'nocons' (c3 = 0), 'recon' (c3 term replaced by a reconstruction loss through a decoder) */
  function trainTold(o = {}) {
    AMP = o.amp ?? 5; const mode = o.mode || 'told', seed = o.seed ?? 3, Z = o.Z ?? 2, hid = 12, H = 3, rho = 0.5, gamma = 0.9, c1 = 0.5, c2 = 0.1, c3 = 2, lr = o.lr ?? 0.003, steps = o.steps ?? 3000, bs = o.bs ?? 8, zeta = 0.01;
    const rnd = mulberry(seed), Lt = layout(Z, hid), th = new Float64Array(Lt.n); for (let i = 0; i < Lt.n; i++) th[i] = gaussF(rnd) * 0.25;
    const thT = th.slice(), mA = new Float64Array(Lt.n), vA = new Float64Array(Lt.n), D = makeData(rnd, 60, 40), Test = makeData(mulberry(seed + 99), 12, 40);
    const log = [], snaps = []; let t = 0;
    const encConst = (par, s) => { const out = []; let off = Lt.h; for (let i = 0; i < Z; i++) { let v = par[off + SD]; for (let j = 0; j < SD; j++) v += par[off + j] * s[j]; out.push(v); off += SD + 1; } return out; };
    const evalAll = () => {
      /* linear regression of x, v and of the distractors on z, on held-out data: how much of each does the latent keep? */
      const Zs = [], Y = [];
      for (const ep of Test) for (let k = 0; k < ep.S.length; k++) { Zs.push(encConst(th, ep.S[k])); Y.push(ep.S[k]); }
      const r2 = c => { /* least squares on [z1, z2, 1] */
        const q = Z + 1, A = Array.from({ length: q }, () => new Array(q).fill(0)), b = new Array(q).fill(0); let my = 0, n = Zs.length;
        for (let i = 0; i < n; i++) { const f = Zs[i].concat([1]), y = Y[i][c]; my += y; for (let a = 0; a < q; a++) { b[a] += f[a] * y; for (let d = 0; d < q; d++) A[a][d] += f[a] * f[d]; } } my /= n;
        for (let i = 0; i < q; i++) A[i][i] += 1e-6;
        for (let i = 0; i < q; i++) { let piv = i; for (let k = i + 1; k < q; k++) if (Math.abs(A[k][i]) > Math.abs(A[piv][i])) piv = k; [A[i], A[piv]] = [A[piv], A[i]];[b[i], b[piv]] = [b[piv], b[i]]; for (let k = i + 1; k < q; k++) { const f = A[k][i] / A[i][i]; for (let d = i; d < q; d++) A[k][d] -= f * A[i][d]; b[k] -= f * b[i]; } }
        const w = new Array(q).fill(0); for (let i = q - 1; i >= 0; i--) { let s = b[i]; for (let d = i + 1; d < q; d++) s -= A[i][d] * w[d]; w[i] = s / A[i][i]; }
        let ssr = 0, sst = 0; for (let i = 0; i < n; i++) { let p = w[Z]; for (let d = 0; d < Z; d++) p += w[d] * Zs[i][d]; const y = Y[i][c]; ssr += (y - p) * (y - p); sst += (y - my) * (y - my); } return 1 - ssr / sst;
      };
      /* 3-step reward prediction error on held-out data, rolled in latent space */
      tn = 0; const Pt = []; for (let i = 0; i < Lt.n; i++) Pt.push(leaf(th[i]));
      let e = 0, cnt = 0;
      for (const ep of Test) for (let k = 0; k + 3 < ep.A.length; k += 4) {
        tn = Lt.n; let z = linear(ep.S[k].map(leaf), Z, Pt, Lt.h);
        for (let q = 0; q < 3; q++) { const inp = z.concat([leaf(ep.A[k + q])]); const r = mlp(inp, hid, 1, Pt, Lt.R)[0]; z = linear(inp, Z, Pt, Lt.d); if (q === 2) { const dl = tv[r] - ep.R[k + q]; e += dl * dl; cnt++; } }
      }
      return { x: r2(0), v: r2(1), n: (r2(2) + r2(3) + r2(4) + r2(5)) / 4, rErr: e / cnt };
    };
    for (t = 0; t <= steps; t++) {
      if (t % 150 === 0) { log.push({ t, ...evalAll() }); snaps.push(th.slice()); }
      if (t === steps) break;
      tn = 0; const P = []; for (let i = 0; i < Lt.n; i++) P.push(leaf(th[i]));
      const PT = thT;
      let J = leaf(0), Jpi = null; const lastZ = [];
      for (let b = 0; b < bs; b++) {
        const ep = D[Math.floor(rnd() * D.length)], k0 = Math.floor(rnd() * (ep.A.length - H));
        let z = linear(ep.S[k0].map(leaf), Z, P, Lt.h), w = 1;
        for (let i = 0; i < H; i++) {
          const s1 = ep.S[k0 + i + 1], a = ep.A[k0 + i], r = ep.R[k0 + i];
          const inp = z.concat([leaf(a)]), rh = mlp(inp, hid, 1, P, Lt.R)[0], qh = mlp(inp, hid, 1, P, Lt.Q)[0], zn = linear(inp, Z, P, Lt.d);
          /* TD target, no gradient: code computes next z with the online encoder, Q with the target net. Everything here is plain numbers. */
          const nzOn = encConst(th, s1), ztarg = encConst(PT, s1);
          tvSave = tn; const piIn = nzOn.map(leaf), aN = tanh(mlp(piIn, 8, 1, P, Lt.pi)[0]), aNv = tv[aN];
          const qT = (() => { const inT = nzOn.concat([aNv]); const lay = []; let off = Lt.Q, n = inT.length; let hs = []; for (let u = 0; u < hid; u++) { let v = PT[off + n]; for (let j = 0; j < n; j++) v += PT[off + j] * inT[j]; hs.push(v > 0 ? v : Math.exp(v) - 1); off += n + 1; } let y = PT[off + hid]; for (let u = 0; u < hid; u++) y += PT[off + u] * hs[u]; return y; })();
          tn = tvSave;
          const y = r + gamma * qT, dr = sub(rh, leaf(r)), dq = sub(qh, leaf(y));
          let lss = add(scl(mul(dr, dr), c1), scl(mul(dq, dq), c2));
          if (mode === 'told') { for (let d = 0; d < Z; d++) { const e = sub(zn[d], leaf(ztarg[d])); lss = add(lss, scl(mul(e, e), c3 / Z)); } }
          if (mode === 'recon') { const rec = linear(zn, SD, P, Lt.dec); for (let d = 0; d < SD; d++) { const e = sub(rec[d], leaf(s1[d])); lss = add(lss, scl(mul(e, e), c3 / SD)); } }
          J = add(J, scl(lss, w / (bs * H)));
          lastZ.push(zn.map(q => tv[q]));
          z = zn; w *= rho;
        }
      }
      backward(J);
      const g = new Float64Array(Lt.n); for (let i = 0; i < Lt.n; i++) g[i] = tg[P[i]];
      /* Eq. 11 is a separate update in the code: maximise Q(z, pi(z)) over pi's parameters only, with z detached */
      tn = 0; const P2 = []; for (let i = 0; i < Lt.n; i++) P2.push(leaf(th[i]));
      let Jp = leaf(0); const nz = lastZ.length; for (let q = 0; q < nz; q += 3) { const zc = lastZ[q].map(leaf), ap = tanh(mlp(zc, 8, 1, P2, Lt.pi)[0]), Qv = mlp(zc.concat([ap]), hid, 1, P2, Lt.Q)[0]; Jp = add(Jp, scl(Qv, -3 / nz)); }
      backward(Jp); for (let i = Lt.pi; i < Lt.pi + mlpN(Z, 8, 1); i++) g[i] = tg[P2[i]];
      /* Adam, Table 4's betas */
      const b1 = 0.9, b2 = 0.999; for (let i = 0; i < Lt.n; i++) { mA[i] = b1 * mA[i] + (1 - b1) * g[i]; vA[i] = b2 * vA[i] + (1 - b2) * g[i] * g[i]; th[i] -= lr * (mA[i] / (1 - Math.pow(b1, t + 1))) / (Math.sqrt(vA[i] / (1 - Math.pow(b2, t + 1))) + 1e-8); }
      if (t % 2 === 0) for (let i = 0; i < Lt.n; i++) thT[i] += zeta * (th[i] - thT[i]);
    }
    /* latent scatter from held-out states, coloured later by x */
    const pts = []; for (const ep of Test) for (let k = 0; k < ep.S.length; k += 3) { const z = snaps[snaps.length - 1] && encConst(th, ep.S[k]); pts.push([ep.S[k], z]); }
    const Eval = (thX) => { const out = []; for (const ep of Test) for (let k = 0; k < ep.S.length; k += 3) out.push(encConst(thX, ep.S[k])); return out; };
    const states = []; for (const ep of Test) for (let k = 0; k < ep.S.length; k += 3) states.push(ep.S[k]);
    return { log, snaps, mode, Eval, states, final: log[log.length - 1], th, Lt };
  }
  let tvSave = 0;
  return { W, G, CELL, valueFn, bumpyValue, lookup, move, OUT, rewardOf, blocked, plan, planCfg, episode, trainTold, mulberry, gaussF, piAct };
})();
const FIG = {fig6:{"H":{"vals":[724.5,863.4,929.5,945.0,937.6],"x":[1.0,3.0,5.0,7.0,9.0],"star":[5.0,942.2],"policy":[0.0,830.9]},"I":{"vals":[703.1,928.5,932.6,926.1,931.8],"x":[1.0,3.0,5.0,7.0,9.0],"star":[6.0,942.2],"policy":[0.0,830.9]}},fig8:{"QuadrupedRun":{"H":{"vals":[760.5,810.0,796.8,782.5,787.3],"x":[1.0,3.0,5.0,7.0,9.0],"star":[5.0,811.9],"policy":[0.0,669.4]},"I":{"vals":[629.0,757.5,788.2,800.5,805.3],"x":[1.0,3.0,5.0,7.0,9.0],"star":[6.0,811.9],"policy":[-0.0,669.4]}},"FishSwim":{"H":{"vals":[603.3,719.1,758.6,728.9,707.1],"x":[1.0,3.0,5.0,7.0,9.0],"star":[5.0,749.9],"policy":[-0.0,696.2]},"I":{"vals":[669.1,709.6,713.8,726.1,714.7],"x":[1.0,3.0,5.0,7.0,9.0],"star":[6.0,749.9],"policy":[0.0,696.2]}},"ReacherHard":{"H":{"vals":[891.6,919.1,973.5,945.2,956.2],"x":[1.0,3.0,5.0,7.0,9.0],"star":[5.0,965.3],"policy":[0.0,923.1]},"I":{"vals":[912.7,954.6,961.3,955.5,967.7],"x":[1.0,3.0,5.0,7.0,9.0],"star":[6.0,965.3],"policy":[-0.0,923.1]}},"CartpoleSparse":{"H":{"vals":[845.6,846.7,846.9,846.3,845.1],"x":[1.0,3.0,5.0,7.0,9.0],"star":[5.0,846.1],"policy":[0.0,840.7]},"I":{"vals":[840.1,846.8,846.9,847.0,847.2],"x":[1.0,3.0,5.0,7.0,9.0],"star":[6.0,846.1],"policy":[0.0,840.7]}}},fig11:{"H":{"vals":[11.7,16.1,20.7,21.7,22.8],"x":[1.0,3.0,5.0,7.0,9.0],"star":[5.0,20.4],"policy":[-0.0,0.9]},"I":{"vals":[7.7,12.9,18.0,23.1,28.3],"x":[1.0,3.0,5.0,7.0,9.0],"star":[6.0,20.4],"policy":[-0.0,0.9]}}};
if (typeof document !== 'undefined') (function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { h: 0x3aa8e0, d: 0x4fc98a, R: 0xf2c14e, Q: 0x9d8cff, pi: 0x38d1ff, tgt: 0x8e9bb8, grad: 0xff7a59, bad: 0xe05d5d, wall: 0x6b7794, sm: 0xd45fa0, line: 0x8e9bb8 };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyNote = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  const SCENES = [
    { n: 1, part: '总览', title: '两个循环：每步规划，每回合学习', sub: '点任何一站跳到对应的幕', dur: 14, cam: [0.1, 1.02, 40, [0, 0.5, 1.2]],
      html: dl([['决策循环', '观测 → 编码 → 规划 → 第一个动作 → 环境'], ['学习循环', '回放缓存 → 训练 TOLD → 新参数给规划'], ['模型', 'h, d, R, Q, π，全是确定性 MLP'], ['默认', 'H = 5，N = 512，J = 6']]) +
        '<p>TD-MPC 的策略不是一个网络，是一段程序：每个决策步从当前潜状态出发，用学到的模型试几百条动作序列，挑好的，只执行第一个动作，下一步重来。这叫<b>滚动时域 MPC</b>。</p>' +
        '<p>网络 π 也有，但它只有两个用途：给 TD 目标提供动作（第 3 幕），给规划补几条候选（第 7 幕）。</p>' +
        '<p>蓝色小球走决策循环，每个决策步一圈；橙色小球走学习循环。两个循环共用一套参数 θ。</p>' +
        guess('站点的摆放和小球的速度是示意。中间那团轨迹是第 5 幕的玩具真算出来的。') + src('§3、§4 · 图 1 · 算法 1、2') },
    { n: 2, part: '§4 TOLD', title: '五个部件，没有解码器', sub: '式 (6)。点部件看形状，切换任务看参数量', dur: 12, cam: [0.1, 1.0, 40, [-1, 1.0, 1.5]],
      html: dl([['表征', 'z_t = h_θ(s_t)'], ['动力学', 'z_{t+1} = d_θ(z_t, a_t)'], ['奖励', 'r̂_t = R_θ(z_t, a_t)'], ['价值', 'q̂_t = Q_θ(z_t, a_t)'], ['策略', 'â_t ~ π_θ(z_t)']]) +
        '<p>Task-Oriented Latent Dynamics（面向任务的潜动力学）。潜状态 z 是编码器的输出向量，不要求它能还原观测。图里红色的解码器在 TD-MPC 里<b>不存在</b>，它是消融实验 (ii) 和 PlaNet、Dreamer 才有的部件，放在这里是为了让你看到省掉的是什么。</p>' +
        '<p>全部是确定性 MLP，没有 RNN，没有概率潜变量。代码里 Q 是两个（Q1、Q2），规划和目标都取较小值。</p>' +
        '<p>方块体积正比于该部件的参数量，这个数是按附录 F 的结构现算的。附录写总数约 1,507,000，我算出来 1,507,693（Walker Run）。</p>' + src('式 (6) · 附录 F · 表 4 · tdmpc.py TOLD') },
    { n: 3, part: '§4 训练', title: '一条轨迹怎样同时训练三件事', sub: '式 (7) 到 (11)，算法 2。选一项损失看它的通路', dur: 15, cam: [0.03, 1.15, 40, [0, 2.2, 0.6]],
      html: dl([['奖励', 'c₁ = 0.5 · ‖R − r‖²'], ['价值', 'c₂ = 0.1 · ‖Q − (r + γQ⁻)‖²'], ['一致性', 'c₃ = 2 · ‖d − h⁻(s′)‖²'], ['时间权重', 'λⁱ，λ = 0.5'], ['策略', '−Q(z, π(sg(z)))，单独一步']]) +
        '<p>只有第一帧观测 s₀ 走在线编码器，之后的 z 全部由 d 递推，三项损失的梯度都沿这条链反传。这和“先训练模型、再训练策略”的做法不同：奖励和价值的梯度直接塑造编码器和动力学。</p>' +
        '<p>后面帧的 s 只用来做目标，走<b>目标网络</b> h⁻，那是在线参数的慢速滑动平均，不回传梯度。</p>' +
        '<p>策略损失是另一条：z 停梯度（sg），只优化 π 的参数，Q 被冻住。所以 π 只看单步 Q，没有穿过 d 的反传，这和 SuperMimic 的策略更新完全不同（第 11 幕）。</p>' +
        '<p>两个按钮能对照论文式 (9) 和代码的差别：式里写 z_{i+1}，代码用在线编码器重编 s′。</p>' + src('式 (7)–(11) · 图 2 · 算法 2 · tdmpc.py update') },
    { n: 4, part: '§4 损失', title: '玩具 TOLD：现场训练，看潜变量留下了什么', sub: '三种损失、两种潜维度。手写自动微分，真的在算', dur: 14, cam: [0.25, 1.0, 34, [0, 1.8, 0]],
      html: '<p>观测 6 维：位置 x、速度 v、四个干扰量（两对匀速旋转的量，和动作、奖励都无关，幅度 5，比 x、v 大）。奖励只看 x。</p>' +
        dl([['网络', 'h、d 线性；R、Q 12 隐单元 ELU；π 8 隐单元'], ['训练', '算法 2，H = 3，λ = 0.5，c = (0.5, 0.1, 2)'], ['步数', '3000 步 Adam，批 8'], ['数据', '60 条随机动作轨迹，离线']]) +
        '<p>柱子是留出数据上的线性回归 R²：用 z 能解释多少 x、v、干扰量。平面上的点是潜状态的前两个主成分，颜色是真实的 x。颜色分层，说明 z 里有 x。</p>' +
        '<p>三个种子上的结果（3、4、5 的均值）：Z = 4 时，重建模式的 x 只有 0.007，干扰量 0.999，容量全被干扰占了；TOLD 的 x 是 0.96。</p>' +
        '<p><b>同一张表里也有不利于“一致性”的结果：</b>Z = 2 时 TOLD 的 x 也只有 0.03，而去掉一致性（c₃ = 0）是 1.00。一致性损失没有过滤作用，它不关心预测的是不是和任务有关，匀速旋转的干扰量一样好预测。挑选任务信息的是奖励和价值项。</p>' +
        toyNote('玩具很小，动力学线性，这里 c₃ = 0 反而误差最低，不能外推：论文附录 D 的 15 个任务上，无正则的基线平均更差。玩具只说明机制。') + src('式 (8)–(10)，消融 (i)(ii) 的结构；玩具是我设的') },
    { n: 5, part: '§3 MPPI', title: '一次规划内部：采样、打分、精英、更新', sub: '式 (3)(4)(5)，算法 1。拖 N 和 H，当场重算', dur: 20, cam: [0.15, 0.62, 34, [0, 0, 1.5]],
      html: dl([['采样', 'N 条长 H 的序列，a ~ N(μ, σ²)'], ['打分', 'φ = Σγᵗ R(z_t, a_t) + γᴴ Q(z_H, a_H)'], ['精英', '取前 k = 64 条'], ['权重', 'Ω = exp(τ φ)，τ = 0.5'], ['更新', 'μ, σ ← 精英的加权均值、标准差'], ['重复', 'J = 6 轮（狗 8，人形 12）']]) +
        '<p>MPPI（Model Predictive Path Integral，模型预测路径积分）是不求导的采样优化。这里每个时间步、每个动作维度各有一对独立的 μ、σ。整个过程没有反向传播，模型只被前向调用。</p>' +
        '<p>灰线是淘汰的轨迹，橙线是精英，颜色越亮权重越大，白点是用当前 μ 滚出来的轨迹。竖条高度是这条轨迹的 φ，第一轮最散，到最后几轮收拢。</p>' +
        '<p>H = 5、N = 512、J = 6 时一个决策步要调用 d、R 共 (512 + 25) × 5 × 6 = 16,110 次，批量做的，论文报告单卡约 20 ms。</p>' +
        toyNote('二维质点，速度控制，步长 0.6，U 形墙挡在目标前面。这里的 d、R 是真实的环境，Q 用值迭代算出，比真实学到的模型准确得多。数值只说明算法的行为。精英比例固定 N/8，和 64/512 一样。') + src('§3 · 算法 1 · tdmpc.py plan') },
    { n: 6, part: '§3 终值', title: '终值函数：把 H 步以外接上', sub: 'γᴴQ(z_H, a_H)。开关它，看规划者是否走得出陷阱', dur: 14, cam: [0.15, 0.68, 37, [3.5, 0, 1.5]],
      html: '<p>点在 U 形墙里面。式 (2) 只看 H 步以内的奖励，所以是短视的：往外退一步，离目标更远，短期奖励变差，宁可贴墙不动。</p>' +
        '<p>终值函数把 H 步之外的回报折算进来。它知道“退出去绕过墙”最后更好，所以 H = 1 就能走出来。</p>' +
        '<p>第 2 组按钮切到<b>稀疏奖励</b>：只有进入目标圈才给 1。这时没有 Q，所有轨迹的 φ 都是 0，权重全相等，规划退化成随机游走。论文说 MPC:sim 在稀疏奖励任务上失败，机理就是这个。</p>' +
        '<p>右边两根柱：最好那条轨迹的 Σγᵗr 和 γᴴQ。Q 通常占绝对大头，H 步奖励只是修正。图中颜色是所选 Q 的热度（亮 = 高）。</p>' +
        '<p>代码和式 (3) 有差别：序列只有 H 个动作，式里的 a_H 由 π(z_H) 给（再加 0.05 噪声）。玩具里 π 是 Q 的贪心，Q(z, π(z)) = V(z)，所以直接用 V。</p>' +
        toyNote('“有误差”：真 V 上叠加一个固定的、宽约 3 个单位的正弦扰动，幅度是取值范围的 3%，代表学到的 Q 不准。') + src('式 (2)(3) · 图 3 · tdmpc.py estimate_value') },
    { n: 7, part: '§3 策略', title: '策略引导采样：多 5% 的候选', sub: '小 N 时差别才显出来。π 轨迹是蓝色', dur: 16, cam: [0.15, 0.68, 37, [3, 0, 1.5]],
      html: dl([['数量', 'N_π = ⌊0.05 N⌋，N = 512 时 25 条'], ['来源', 'π(z_t) 加噪声，经 d 滚出'], ['进入方式', '和高斯样本一起排名'], ['两种结局', '差就落选，好就按 φ 分权重']]) +
        '<p>π 的候选没有特权：它们和其他样本一样打分，差的进不了前 k。所以 π 错了，规划也不必听它。这和 LOOP 不同，LOOP 约束规划贴近 SAC 策略。</p>' +
        '<p>算法 1 把第 4 行写在循环内，意思是每轮重采。代码在循环外采一次，之后 6 轮用同一批 π 动作（读者注 3）。按钮可切换，算的结果当场变。</p>' +
        '<p>说明行里的数字是页面现算的 6 个种子的平均：同样的预算下，有和没有 π 候选的回合回报和到达次数。样本越多差距越小。</p>' +
        toyNote('玩具 π 是所选 Q 的单步贪心，不是训练出来的。') + src('§3 · 算法 1 第 4 行 · tdmpc.py plan') },
    { n: 8, part: '§3 滚动', title: '滚动时域：只执行第一步', sub: '整回合。N、H、Q、π、热启动都能改', dur: 18, cam: [0.1, 0.62, 34, [0, 0, 1.5]],
      html: dl([['执行', '只执行序列的第一个动作'], ['热启动', 'μ 左移一步接着用，最后一格补 0'], ['σ', '每步重置为 2，防止陷入局部极小'], ['回合', '玩具 60 步']]) +
        '<p>每个决策步都重新规划一次，所以模型误差和干扰都有下一步来修正。白点是当前规划的均值轨迹，绿点是已经走过的路。</p>' +
        '<p>代码最后的动作是按权重抽一条精英、取它的第一个动作，不是算法 1 第 11 行写的“从 N(μ, σ²) 采样”（读者注 3）。玩具照代码做。</p>' +
        toyNote('玩具用评估模式：不再额外加探索噪声。') + src('§3 · 算法 1 · tdmpc.py plan') },
    { n: 9, part: '§3 探索', title: 'ε 下限和两个调度', sub: '式 (5)。图 9 是真实读数，右边玩具现算', dur: 13, cam: [0.1, 0.8, 40, [-3, 1.0, 1.5]],
      html: dl([['式 (5)', 'σ ← max(√(加权方差), ε)'], ['ε 调度', '0.5 → 0.05，前 25k 决策步'], ['H 调度', '1 → 5，前 25k 决策步'], ['代码上限', 'σ 还裁到 2 以下']]) +
        '<p>规划分布的 σ 收敛速度任务之间差别很大，太早收到很小就没有探索。论文的办法是给 σ 设一个线性衰减的下限 ε。</p>' +
        '<p>规划长度也从 1 开始涨，因为早期模型不准，长规划等于放大模型偏差。</p>' +
        '<p>左边三根柱是图 9 的矢量读数（训练末段最后 0.2M 步的平均）：Stand 0.069，Walk 0.098，Run 0.134。任务越难，σ 留得越大，论文把这解释为“探索和利用自动平衡”。</p>' +
        '<p>论文说 π 动作的噪声也按 ε 退火；代码里 π 的噪声一直是 min_std = 0.05（读者注 4）。</p>' +
        toyNote('右边是一个决策步最后一轮的样本。ε 大时，下一步的动作散得开。') + src('式 (5) · 图 9 · 表 4 · 附录 E · default.yaml') },
    { n: 10, part: '§5 预算', title: '多算一点值不值：真实读数和玩具扫描', sub: '图 6、8、11 的矢量读数。玩具热图现算', dur: 12, cam: [0.02, 1.2, 46, [-1, 3.0, 1]],
      html: '<p>前五个按钮是训练好的智能体在不同规划预算下的回报，从原文矢量图读出：蓝柱改 H（J 固定 6），绿柱改 J（H 固定 5），紫柱是只用 π，橙柱是默认设置（H = 5，J = 6）。</p>' +
        '<ul><li>规划比 π 好多少看任务：Quadruped Run 差 142，Cartpole Swingup Sparse 差 5。</li><li>动作维度越高差距越大，这是附录 C 的说法，读数支持。</li><li>同一个默认设置画了两次（星号和 H = 5 的点），Quadruped Walk 上差 13，可以当这张图的噪声尺度。</li></ul>' +
        '<p>“耗时”按钮是图 11。H 和 J 从默认减半，时间都没有减半；只用 π 约 0.9 ms，是默认 20.4 ms 的 1/23，正文写的是“接近 6 倍”（读者注 14）。</p>' +
        '<p>“玩具”按钮现场扫一遍 N × H（3 个种子），柱高是回合回报。</p>' +
        toyNote('玩具的 N、H 和真实任务的数值没有对应关系。') + src('图 6、8、11 · 附录 C、H') },
    { n: 11, part: '对照', title: '在线规划，还是训练好的策略：和 SuperMimic 逐项比', sub: '选一项看差别。两边的玩具智能体同时跑', dur: 16, cam: [0.0, 0.72, 44, [0, 0, 3]],
      html: '<p>SuperMimic 的关系只有一句引用：§2 说 TD-MPC “结合短视野规划和终值预测”。它没说从这里拿什么。下面是我逐项对比两篇的结果。</p>' +
        dl([['动作从哪来', 'TD-MPC：每步跑一次 MPPI；SuperMimic：a = π_θ(o, g)，一次前向'], ['H 的角色', 'TD-MPC：推理时试的长度，5；SuperMimic：训练时反传的长度，32'], ['模型的角色', 'TD-MPC：推理时被调用 16,110 次；SuperMimic：部署不用'], ['求导', 'TD-MPC 规划不求导；SuperMimic 训练全靠穿过 f_ω 的 BPTT']]) +
        '<p>两者的目标函数长得几乎一样：短 H 步奖励 + γᴴ × 价值。差别在<b>什么时候解这个优化、对什么变量解</b>。TD-MPC 在每个决策步、对这一条动作序列用采样解；SuperMimic 在训练时、对网络参数 θ 用梯度解，所有状态共享一个结果。</p>' +
        '<p>代价相应地分布在不同的时刻。TD-MPC 推理贵，但遇到没见过的状态能用模型再算一次。SuperMimic 推理几乎不花钱，能力固定在 θ 里。</p>' +
        '<p>左右是同一个玩具、同一个 Q 的两种执行方式。切到“Q 有误差”：右边贪心地掉进 Q 的假极大值停住，左边 H 步内的真实奖励把它拉出来。</p>' +
        toyNote('右边的 π 是玩具 Q 的贪心，不是 BPTT 训练出来的，不代表 SuperMimic 的策略质量；它只说明“执行时不再计算”的后果。SuperMimic 的真实表现见它的精读页。') + src('SuperMimic §2、§3.1、§3.3、§4.4；TD-MPC §3、附录 H') },
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
  }
  let lastCap = null;
  const cap = h => { if (h !== lastCap) { lastCap = h; $('cap').innerHTML = h; } };

  /* ---------- 3D helpers ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.6, phi: 1.0, dist: 24, maxDist: 160, minDist: 3 }); } catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);
  let LABS = [], refDist = 24, PICKS = [];
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: o.size || 24, pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  function relab(G, old, text, pos, o) { if (old) { G.remove(old); L.dispose(old); LABS = LABS.filter(s => s !== old); } const n = lab(text, pos, o); G.add(n); return n; }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 14, 10);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65, emissive: o.emissive }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; for (let i = 0; i < Math.max(1, n); i++) { im.setMatrixAt(i, _M.compose(_P.set(0, -500, 0), _Q0, _Sv.set(1e-4, 1e-4, 1e-4))); im.setColorAt(i, _C.setRGB(1, 1, 1)); } return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function hide(im, n) { setI(im, n, [0, -500, 0], 0.0001); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function bar(im, n, x, y0, y1, z, w, d, c) { const h = Math.abs(y1 - y0); if (h < 1e-4) hide(im, n); else setI(im, n, [x, (y0 + y1) / 2, z], [w, h, d]); if (c) colI(im, n, c); }
  /* many line segments with per-vertex colour, rewritten every frame */
  function segLines(maxSegs) {
    const g = new THREE.BufferGeometry(), pos = new Float32Array(maxSegs * 6), col = new Float32Array(maxSegs * 6);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 })); m.frustumCulled = false;
    let n = 0;
    m.userData = { begin() { n = 0; }, add(x0, y0, z0, x1, y1, z1, c) { if (n >= maxSegs) return; const o = n * 6; pos[o] = x0; pos[o + 1] = y0; pos[o + 2] = z0; pos[o + 3] = x1; pos[o + 4] = y1; pos[o + 5] = z1; for (let i = 0; i < 2; i++) { col[o + 3 * i] = c[0]; col[o + 3 * i + 1] = c[1]; col[o + 3 * i + 2] = c[2]; } n++; }, end() { g.setDrawRange(0, n * 2); g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; } };
    return m;
  }
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const textBtns = (label, items, cur, key) => `<span>${label}</span>` + items.map((t, k) => `<button type="button" data-g="${key}" data-k="${k}" aria-pressed="${k === cur}">${t}</button>`).join('');
  const slider = (label, id, min, max, val, show) => `<label class="hz">${label}<input id="${id}" type="range" min="${min}" max="${max}" value="${val}"><b id="${id}v">${show}</b></label>`;
  const NS = [8, 16, 32, 64, 128, 256, 512, 1024], memo = new Map();
  const remember = (k, f) => { if (!memo.has(k)) memo.set(k, f()); return memo.get(k); };

  /* ---------- the planner toy's world, drawn on the floor ---------- */
  const Wd = Toy.W;
  function heatCanvas(V) {
    const c = document.createElement('canvas'); c.width = c.height = Toy.G; const g = c.getContext('2d'), im = g.createImageData(Toy.G, Toy.G);
    let lo = Infinity, hi = -Infinity; if (V) for (const v of V) { if (v < lo) lo = v; if (v > hi) hi = v; }
    for (let i = 0; i < Toy.G; i++) for (let j = 0; j < Toy.G; j++) {
      const o = 4 * ((Toy.G - 1 - i) * Toy.G + j), t = V ? Math.pow((V[i * Toy.G + j] - lo) / (hi - lo + 1e-9), 1.2) : 0;
      const a = V ? mix3([0.08, 0.13, 0.27], t < 0.6 ? [0.12, 0.45, 0.62] : [0.85, 0.82, 0.45], t < 0.6 ? t / 0.6 : (t - 0.6) / 0.4) : [0.13, 0.16, 0.22];
      const b = V && t >= 0.6 ? mix3([0.12, 0.45, 0.62], [0.85, 0.82, 0.45], (t - 0.6) / 0.4) : a;
      im.data[o] = b[0] * 255; im.data[o + 1] = b[1] * 255; im.data[o + 2] = b[2] * 255; im.data[o + 3] = 255;
    }
    g.putImageData(im, 0, 0); const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.LinearFilter; return tex;
  }
  function world(G, cx = 0, s = 1) {
    const g = new THREE.Group(); g.position.set(cx, 0, 0); g.scale.set(s, 1, s); G.add(g);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color: 0xffffff })); fl.rotation.x = -Math.PI / 2; g.add(fl);
    Wd.rects.forEach(r => { const b = L.box(r[1] - r[0], 1.1, r[3] - r[2], COL.wall, { opacity: 0.92 }); b.position.set((r[0] + r[1]) / 2, 0.55, -(r[2] + r[3]) / 2); g.add(b); });
    const go = L.cyl(Wd.goalR, Wd.goalR, 0.25, L.C.gold); go.position.set(Wd.goal[0], 0.13, -Wd.goal[1]); g.add(go);
    const agent = L.sphere(0.42, 0xffffff); agent.position.y = 0.45; g.add(agent);
    let cur = null;
    return { g, agent, setHeat(V) { if (fl.material.map) fl.material.map.dispose(); fl.material.map = heatCanvas(V); fl.material.needsUpdate = true; cur = V; }, at(x, y) { agent.position.set(x, 0.45, -y); } };
  }
  const C_DIM = [0.27, 0.32, 0.42], C_EL = hex3(0xff7a59), C_ELH = [1, 0.85, 0.35], C_PI = [0.2, 0.75, 1], C_MU = [1, 1, 1];
  /* draws one iteration of Algorithm 1 at world group W. f0: fraction of each path drawn; sel: 0..1 fades the losers; spike: 0..1 height of the score bars */
  function drawIter(lines, spikes, it, H, f0, sel, spike, cx = 0, sc = 1) {
    const P = H + 1, lo = it.info.reduce((a, b) => Math.min(a, b.v), Infinity), hi = it.info.reduce((a, b) => Math.max(a, b.v), -Infinity), wm = it.info.reduce((a, b) => Math.max(a, b.w), 1e-9), tf = f0 * H;
    lines.userData.begin();
    for (let l = it.L - 1; l >= 0; l--) {
      const I = it.info[l], o = 2 * l * P;
      let c = I.pi ? C_PI : (I.elite ? mix3(C_EL, C_ELH, Math.sqrt(I.w / wm)) : C_DIM);
      if (!I.pi && !I.elite) c = mix3([0.5, 0.56, 0.68], C_DIM, sel);
      const y = 0.16 + (I.elite ? 0.05 : 0);
      for (let t = 0; t < H; t++) { if (t >= tf) break; const k = Math.min(1, tf - t), ax = it.tr[o + 2 * t], ay = it.tr[o + 2 * t + 1], bx = it.tr[o + 2 * t + 2], by = it.tr[o + 2 * t + 3]; lines.userData.add(cx + sc * ax, y, -sc * ay, cx + sc * (ax + (bx - ax) * k), y, -sc * (ay + (by - ay) * k), c); }
    }
    lines.userData.end();
    if (spikes) { for (let l = 0; l < spikes.count; l++) { if (l < it.L && spike > 0) { const I = it.info[l], o = 2 * (l * P + H), h = 0.05 + 3.0 * spike * (I.v - lo) / (hi - lo + 1e-9); bar(spikes, l, cx + sc * it.tr[o], 0.2, 0.2 + h, -sc * it.tr[o + 1], 0.13, 0.13, I.pi ? C_PI : I.elite && sel > 0.2 ? C_EL : C_DIM); } else hide(spikes, l); } done(spikes); }
  }
  function drawMean(balls, it, H, on, cx = 0, sc = 1) { for (let t = 0; t < balls.count; t++) { if (t <= H && on > 0) { setI(balls, t, [cx + sc * it.mt[2 * t], 0.32, -sc * it.mt[2 * t + 1]], 0.13 * on); colI(balls, t, C_MU); } else hide(balls, t); } done(balls); }
  const qName = ['关', '准确', '有误差'];
  const qFn = (mode, sparse) => mode === 1 ? Toy.valueFn(sparse) : mode === 2 ? Toy.bumpyValue(sparse) : null;
  const heatFor = (mode, sparse) => qFn(mode, sparse);
  /* ---------- scene 1: the two loops ---------- */
  function s1(G) {
    G.add(L.grid(44, 30));
    const st = [
      { n: '观测 s_t', x: -15, z: -6, c: COL.line, go: 1 }, { n: '编码 h_θ', x: -7, z: -6, c: COL.h, go: 1 }, { n: '规划 MPPI', x: 2.5, z: -6, c: COL.grad, go: 4, w: 7 }, { n: '第一个动作', x: 13, z: -6, c: COL.R, go: 7 },
      { n: '环境', x: 13, z: 5.5, c: COL.d, go: 7 }, { n: '回放缓存 B', x: 2.5, z: 5.5, c: COL.line, go: 2 }, { n: '训练 TOLD\n式 (7)–(11)', x: -7, z: 5.5, c: COL.Q, go: 2, w: 5 } ];
    st.forEach(s => { const b = L.box(s.w || 4, 1.3, 3, s.c, { edgeOpacity: 0.3, opacity: 0.92 }); b.position.set(s.x, 0.65, s.z); b.userData.go = s.go; PICKS.push(b); G.add(b); G.add(lab(s.n, [s.x, 2.6, s.z], { size: 21 })); });
    const loopA = [[-15, 1, -6], [-7, 1, -6], [2.5, 1, -6], [13, 1, -6], [13, 1, 5.5], [13, 1, 0], [-15, 1, -2.5], [-15, 1, -6]], loopB = [[13, 1, 5.5], [2.5, 1, 5.5], [-7, 1, 5.5], [-7, 1, 1.5], [2.5, 1, 1.5], [2.5, 1, -4.5]];
    G.add(L.line(loopA, COL.pi, { opacity: 0.8 }), L.line(loopB, COL.grad, { opacity: 0.7 }));
    G.add(lab('新参数 θ', [-2.3, 1.4, 1.5], { size: 19, border: 'rgba(255,122,89,.8)' }), lab('下一个决策步', [-1, 1.4, -2.0], { size: 19, border: 'rgba(56,209,255,.8)' }));
    const a = L.sphere(0.45, COL.pi), b = L.sphere(0.45, COL.grad); G.add(a, b);
    const at = (pts, u, o) => { const ls = []; let T = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]); ls.push(d); T += d; } let q = u * T; for (let i = 0; i < ls.length; i++) { if (q <= ls[i]) { const k = q / ls[i]; o.position.set(L.lerp(pts[i][0], pts[i + 1][0], k), 1.1, L.lerp(pts[i][2], pts[i + 1][2], k)); return; } q -= ls[i]; } };
    const pl = remember('s1plan', () => Toy.plan(1.0, 1.0, null, Toy.planCfg({ N: 256, H: 6, J: 6, keep: 28, usePi: false }), Toy.mulberry(5))), it = pl.iters[3], P = 7, lines = segLines(28 * 6), pg = new THREE.Group(); pg.add(lines); G.add(pg);
    const place = { cx: 2.5, cz: -6, s: 0.62 };
    return { update(p) {
        at(loopA, (p * 3) % 1, a); at(loopB, p, b);
        lines.userData.begin(); for (let l = 0; l < it.L; l++) { const I = it.info[l], c = I.elite ? C_EL : C_DIM; for (let t = 0; t < 6; t++) { const o = 2 * (l * P + t); lines.userData.add(place.cx + place.s * (it.tr[o] - 1), 1.45, place.cz - place.s * (it.tr[o + 1] - 1), place.cx + place.s * (it.tr[o + 2] - 1), 1.45, place.cz - place.s * (it.tr[o + 3] - 1), c); } } lines.userData.end();
        cap(p < 0.66 ? '蓝球：决策循环。规划在<b>每个决策步</b>都跑一次，只把第一个动作交给环境' : '橙球：学习循环。收集一回合之后更新 TOLD，代码里更新次数等于这回合的决策步数（第一次是 seed_steps）');
      } };
  }

  /* ---------- scene 2: the five parts ---------- */
  function s2(G) {
    G.add(L.grid(44, 30));
    const TASK = [{ n: 'Walker Run', S: 24, A: 6, Z: 50 }, { n: 'Humanoid', S: null, A: 21, Z: 100 }, { n: 'Dog', S: null, A: 38, Z: 100 }];
    const lin = (i, o) => (i + 1) * o, mlp2 = (i, o) => lin(i, 512) + lin(512, 512) + lin(512, o);
    const cnt = t => { const q = lin(t.Z + t.A, 512) + 1024 + lin(512, 512) + lin(512, 1); return { h: t.S ? lin(t.S, 256) + lin(256, t.Z) : null, d: mlp2(t.Z + t.A, t.Z), R: mlp2(t.Z + t.A, 1), Q: q * 2, pi: mlp2(t.Z, t.A) }; };
    const PART = { h: { x: -12, z: 0, c: COL.h, name: 'h_θ 编码器', io: t => `s (${t.S ?? 'S'} 维) → z (${t.Z} 维)`, ar: '状态：256 隐单元一层，ELU。像素：4 层 CNN（核 7,5,3,3，步长 2，32 通道）' },
      d: { x: 0, z: -5, c: COL.d, name: 'd_θ 潜动力学', io: t => `(z, a) (${t.Z + t.A} 维) → z′ (${t.Z} 维)`, ar: '2 层 512，ELU。只预测潜状态，不预测观测' },
      R: { x: 9, z: -6, c: COL.R, name: 'R_θ 奖励', io: t => `(z, a) (${t.Z + t.A} 维) → r̂`, ar: '2 层 512，ELU，最后一层权重和偏置初始化为 0' },
      Q: { x: 9, z: 2, c: COL.Q, name: 'Q_θ 价值（两个）', io: t => `(z, a) (${t.Z + t.A} 维) → q̂`, ar: '2 层 512，LayerNorm + Tanh，再 ELU；最后一层初始化为 0；代码里取 Q1、Q2 的较小值' },
      pi: { x: 0, z: 6, c: COL.pi, name: 'π_θ 策略', io: t => `z (${t.Z} 维) → a (${t.A} 维)`, ar: '2 层 512，ELU，输出过 tanh。确定性，加噪声采样' } };
    let tI = 0, sel = 'd'; const mesh = {};
    const decoder = L.box(3.4, 3.4, 3.4, COL.bad, { opacity: 0.25, depthWrite: false }); decoder.position.set(-11, 1.8, 7.5); G.add(decoder);
    G.add(lab('解码器：TD-MPC 没有', [-11, 4.6, 7.5], { size: 20, border: 'rgba(224,93,93,.9)' }));
    G.add(L.line([[-12.9, 0.2, 5.6], [-9.1, 3.5, 9.4]], COL.bad), L.line([[-12.9, 3.5, 5.6], [-9.1, 0.2, 9.4]], COL.bad));
    G.add(L.line([[-7, 1.2, 0.8], [-10.5, 1.2, 5.6]], COL.bad, { dashed: true }));
    const labs = {}; Object.entries(PART).forEach(([k, s]) => { const m = L.box(1, 1, 1, s.c, { edgeOpacity: 0.3 }); m.position.set(s.x, 0, s.z); m.userData.part = k; PICKS.push(m); mesh[k] = m; G.add(m); });
    const zNode = L.sphere(0.7, 0xffffff); zNode.position.set(-6.5, 1.2, 0); G.add(zNode); G.add(lab('z', [-6.5, 3.0, 0], { size: 22 }));
    Object.values(PART).forEach(s => { if (s !== PART.h) G.add(L.line([[-6.5, 1.2, 0], [s.x, 1.2, s.z]], COL.line, { opacity: 0.5 })); }); G.add(L.line([[-12, 1.2, 0], [-6.5, 1.2, 0]], COL.h));
    function layout() {
      const t = TASK[tI], c = cnt(t); const ref = c.h ?? 19250;
      Object.entries(PART).forEach(([k, s]) => { const n = c[k] ?? 19250, d = Math.cbrt(n) * 0.04; mesh[k].scale.set(d, d, d); mesh[k].position.y = d / 2; labs[k] = relab(G, labs[k], `${s.name.split(' ')[0]}  ${c[k] != null ? c[k].toLocaleString('en') : 'S 论文未给'}`, [s.x, d + 1.2, s.z], { size: 20, border: '#' + s.c.toString(16).padStart(6, '0') }); });
    }
    layout();
    const api = { ctl: { html: textBtns('任务', TASK.map(t => t.n), 0, 't'), on(g, k) { tI = k; layout(); } },
      pick(k) { sel = k; },
      update(p) {
        Object.entries(mesh).forEach(([k, m]) => { const c = hex3(PART[k].c), g = k === sel ? 0.25 + 0.25 * Math.abs(Math.sin(p * 12.56)) : 0; m.material.emissive.setRGB(c[0] * g, c[1] * g, c[2] * g); });
        const t = TASK[tI], c = cnt(t), s = PART[sel], tot = c.h != null ? c.h + c.d + c.R + c.Q + c.pi : null;
        cap(`<b>${s.name}</b>：${s.io(t)}。${s.ar}。${tot ? `全模型 <b>${tot.toLocaleString('en')}</b> 参数（我按附录 F 算）` : '观测维度论文没写，所以不算总数'}`);
      } };
    return api;
  }

  /* ---------- scene 3: one training trajectory ---------- */
  function s3(G) {
    G.add(L.grid(44, 30));
    let H = 5, sel = 0, code = 0; const grp = new THREE.Group(); G.add(grp); let nodes = [], LP = [], LB = null, puls = null;
    const X = (i, n) => -15 + (30 / n) * i, Yz = 3.2, Ys = 9.4, Yh = 6.4, Yq = 0.7;
    function build() {
      while (grp.children.length) { const c = grp.children.pop(); L.dispose(c); LABS = LABS.filter(s => s !== c); }
      for (let i = 0; i <= H; i++) {
        const x = X(i, H);
        const z = L.sphere(0.75, i === 0 ? COL.h : 0xdfe7f5); z.position.set(x, Yz, 0); grp.add(z); grp.add(lab(`z${'₀₁₂₃₄₅'[i]}`, [x, Yz, 1.3], { size: 19 }));
        const s = L.box(1.8, 0.9, 1.8, COL.line); s.position.set(x, Ys, 0); grp.add(s); grp.add(lab(`s${'₀₁₂₃₄₅'[i]}`, [x, Ys + 1.2, 0], { size: 18 }));
        const e = L.box(1.5, 1, 1.5, i === 0 ? COL.h : COL.tgt, { opacity: i === 0 ? 1 : 0.7 }); e.position.set(x, Yh, 0); grp.add(e); grp.add(lab(i === 0 ? 'h' : 'h⁻', [x + 1.5, Yh, 0], { size: 18 }));
        grp.add(L.line([[x, Ys - 0.45, 0], [x, Yh + 0.5, 0]], COL.line, { opacity: 0.6 }));
        if (i === 0) grp.add(L.line([[x, Yh - 0.5, 0], [x, Yz + 0.75, 0]], COL.h));
        if (i < H) { const nx = X(i + 1, H); grp.add(L.line([[x + 0.75, Yz, 0], [nx - 0.75, Yz, 0]], COL.d)); grp.add(lab('d', [(x + nx) / 2, Yz + 0.8, 0], { size: 18, color: '#7fe7ad' })); }
        const bits = [[COL.Q, -1.1, 'Q'], [COL.R, 0, 'R'], [COL.pi, 1.1, 'π']];
        if (i < H || true) bits.forEach(([c, dx, n]) => { if (i === H && n !== 'π') return; const b = L.box(0.85, 0.85, 0.85, c); b.position.set(x + dx * (H > 3 ? 1 : 1.2), Yq, 0); b.userData.tag = n; grp.add(b); });
      }
      LB = inst(BOX, 8); grp.add(LB); puls = inst(BALL, 12, { emissive: 0x552211 }); grp.add(puls);
      grp.add(lab('损失的时间权重 λⁱ', [X(H, H) - 3, -1.8, 4.5], { size: 18 }));
    }
    build();
    const NAMES = ['奖励 式 (8)', '价值 式 (9)', '一致性 式 (10)', '策略 式 (11)'], tx = [
      '奖励：每步 ‖R(z_i, a_i) − r_i‖²，系数 c₁ = 0.5。梯度穿过之前所有的 d 回到 h',
      '', '一致性：每步 ‖d(z_i, a_i) − h⁻(s_{i+1})‖²，系数 c₃ = 2。目标来自目标网络，不回传。代码对潜维度取平均，不是求和',
      '策略：−Q(z_i, π(sg(z_i)))。<b>z 停梯度</b>，Q 不更新，所以梯度只到 π。代码有 H + 1 项（z₀ 到 z_H），模型损失只有 H 项' ];
    const trace = new THREE.Group(); G.add(trace); let tl = null;
    function hlt() {
      while (trace.children.length) { const c = trace.children.pop(); L.dispose(c); }
      if (sel === 1) { const pts = []; for (let i = 0; i < H; i++) { const x = X(i + 1, H); if (code) { trace.add(L.line([[x, Ys - 0.45, 0.9], [x + 0.2, Yz + 1.5, 0.9], [x - 1.1, Yq + 0.5, 0.9]], COL.grad)); } else trace.add(L.line([[x, Yz - 0.7, 0.9], [x - 1.1, Yq + 0.5, 0.9]], COL.grad)); } }
    }
    hlt();
    return { ctl: { html: textBtns('损失', ['奖励', '价值', '一致性', '策略'], 0, 's') + textBtns('H', ['1', '3', '5'], 2, 'h') + textBtns('TD 目标的 z′', ['论文式 (9)', '代码'], 0, 'c'), on(g, k) { if (g === 's') sel = k; if (g === 'h') { H = [1, 3, 5][k]; build(); } if (g === 'c') code = k; hlt(); } },
      update(p) {
        const w = []; for (let i = 0; i < H; i++) w.push(Math.pow(0.5, i)); if (sel === 3) w.push(Math.pow(0.5, H));
        const q = seg(p, 0.02, 0.4); for (let i = 0; i < 8; i++) { if (i < w.length) bar(LB, i, X(i, H) + 0.6, 0, Math.max(0.002, q * w[i] * 3.2), 3.6, 1.2, 0.9, hex3([COL.R, COL.Q, COL.d, COL.pi][sel])); else hide(LB, i); } done(LB);
        const u = seg(p, 0.45, 0.95); const nP = 12;
        for (let j = 0; j < nP; j++) { const f = (u * 1.6 - j * 0.11); if (u > 0 && f > 0 && f < 1 && sel !== 3) { const x = X(H, H) + (X(0, H) - X(H, H)) * f; setI(puls, j, [x, Yz, 0], 0.26); colI(puls, j, hex3(COL.grad)); } else hide(puls, j); }
        done(puls);
        tx[1] = code ? '价值（代码）：Q_i 对 r_i + γ min Q⁻(h(s_{i+1}), π(h(s_{i+1})))。下一潜状态用<b>在线编码器</b>重编真实观测，π 加 0.05 噪声，整个目标不回传' : '价值（论文）：Q_i 对 r_i + γQ⁻(z_{i+1}, π(z_{i+1}))。按论文的记法，z_{i+1} 是 d 递推出的潜状态。系数 c₂ = 0.1';
        const sum = w.reduce((a, b) => a + b, 0);
        cap(`<b>${NAMES[sel].split(' ').slice(1).join(' ')}</b>　${tx[sel]}。权重之和 ${sum.toFixed(3)}${sel === 3 ? '' : `，算法 2 第 18 行再乘 1/H`}`);
      } };
  }

  /* ---------- scene 4: toy TOLD, trained in the page ---------- */
  function s4(G) {
    G.add(L.grid(36, 24));
    const MODES = ['told', 'nocons', 'recon'], MN = ['TOLD', '无一致性 c₃ = 0', '重建（带解码器）'];
    let m = 0, Zi = 1, ampI = 1; const ZS = [2, 4], AM = [1, 5];
    const pts = inst(BALL, 200), bars = inst(BOX, 4); G.add(pts, bars);
    const X0 = 1.6, names = ['R²(x)', 'R²(v)', 'R²(干扰)', '3 步奖励误差'], colr = [COL.d, COL.d, COL.bad, COL.R];
    names.forEach((n, i) => G.add(lab(n, [X0 + 2.9 * i + 0.7, -0.9, 3.0], { size: 18 })));
    G.add(L.line([[X0 - 0.8, 6.5, 0], [X0 + 11.4, 6.5, 0]], COL.line, { opacity: 0.45 }), lab('R² = 1', [X0 - 0.6, 7.1, 0], { size: 17 }));
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.MeshBasicMaterial({ color: 0x223044, transparent: true, opacity: 0.55, side: THREE.DoubleSide })); plane.rotation.x = -Math.PI / 2; plane.position.set(-8.5, 0.02, 0); G.add(plane);
    G.add(lab('潜状态前两个主成分，颜色 = 真实 x', [-8.5, -0.9, 7.2], { size: 19 }));
    let R, Zpcs, msT = 0;
    function pca(zs) {
      const d = zs[0].length, n = zs.length, m0 = new Array(d).fill(0); zs.forEach(z => z.forEach((v, i) => m0[i] += v / n)); const X = zs.map(z => z.map((v, i) => v - m0[i]));
      const C = Array.from({ length: d }, () => new Array(d).fill(0)); X.forEach(x => { for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) C[a][b] += x[a] * x[b] / n; });
      const pow = (C, seed) => { let v = new Array(d).fill(0).map((_, i) => i === seed ? 1 : 0.3); for (let it = 0; it < 60; it++) { const u = C.map(r => r.reduce((s, c, j) => s + c * v[j], 0)), l = Math.hypot(...u) || 1; v = u.map(x => x / l); } const lam = v.reduce((s, x, i) => s + x * C[i].reduce((q, c, j) => q + c * v[j], 0), 0); return [v, lam]; };
      const [v1, l1] = pow(C, 0); const C2 = C.map((r, a) => r.map((c, b) => c - l1 * v1[a] * v1[b])); const [v2] = pow(C2, 1);
      const out = X.map(x => [x.reduce((s, c, i) => s + c * v1[i], 0), x.reduce((s, c, i) => s + c * v2[i], 0)]); const sc = Math.max(1e-6, ...out.map(o => Math.max(Math.abs(o[0]), Math.abs(o[1])))); return out.map(o => [o[0] / sc * 5, o[1] / sc * 5]);
    }
    function run() {
      const key = `told:${MODES[m]}:${ZS[Zi]}:${AM[ampI]}`; const t0 = performance.now();
      R = remember(key, () => { const r = Toy.trainTold({ mode: MODES[m], Z: ZS[Zi], amp: AM[ampI], seed: 3 }); r.ms = performance.now() - t0; r.pcs = r.snaps.map(th => pca(r.Eval(th))); return r; });
    }
    run();
    const ramp = t => t < 0.5 ? mix3([0.2, 0.5, 1], [0.92, 0.92, 0.92], t * 2) : mix3([0.92, 0.92, 0.92], [1, 0.4, 0.25], (t - 0.5) * 2);
    return { ctl: { html: textBtns('损失', MN, 0, 'm') + textBtns('潜维度 Z', ZS.map(String), 1, 'z') + textBtns('干扰幅度', AM.map(String), 1, 'a'), on(g, k) { if (g === 'm') m = k; if (g === 'z') Zi = k; if (g === 'a') ampI = k; run(); } },
      update(p) {
        const q = clamp(p * 1.08, 0, 1), f = q * (R.log.length - 1), i0 = Math.floor(f), i1 = Math.min(R.log.length - 1, i0 + 1), k = f - i0, A = R.pcs[i0], B = R.pcs[i1], lg = R.log[i0];
        for (let i = 0; i < pts.count; i++) { if (i < A.length) { const x = L.lerp(A[i][0], B[i][0], k), y = L.lerp(A[i][1], B[i][1], k), s = R.states[i][0]; setI(pts, i, [-8.5 + x, 0.3, -y], 0.17); colI(pts, i, ramp(clamp((s + 2.5) / 5, 0, 1))); } else hide(pts, i); } done(pts);
        const vals = [lg.x, lg.v, lg.n, Math.min(1, lg.rErr / 0.15)];
        vals.forEach((v, i) => bar(bars, i, X0 + 2.9 * i + 0.7, 0, 0.003 + Math.max(0, v) * 6.5, 0, 2.0, 1.6, hex3(colr[i]))); done(bars);
        cap(`<b>${MN[m]}</b>，Z = ${ZS[Zi]}，幅度 ${AM[ampI]}，第 ${lg.t} / 3000 步：R²(x) = <b>${lg.x.toFixed(2)}</b>，R²(v) = ${lg.v.toFixed(2)}，R²(干扰) = <b>${lg.n.toFixed(2)}</b>，3 步奖励 MSE = ${lg.rErr.toFixed(3)}（柱高满格 = 0.15）。种子 3，页面现算 ${R.ms.toFixed(0)} ms`);
      } };
  }

  /* ---------- planner scenes share these ---------- */
  function planCtl(state, on, parts) {
    const html = (parts.includes('N') ? slider('N', 'nr', 0, NS.length - 1, NS.indexOf(state.N), state.N) : '') + (parts.includes('H') ? slider('H', 'hr', 1, 30, state.H, state.H) : '');
    return { html, bind(box) {
      const n = box.querySelector('#nr'), h = box.querySelector('#hr');
      if (n) n.oninput = e => { state.N = NS[+e.target.value]; box.querySelector('#nrv').textContent = state.N; on(); this.owner.update(pNow); };
      if (h) h.oninput = e => { state.H = +e.target.value; box.querySelector('#hrv').textContent = state.H; on(); this.owner.update(pNow); };
    } };
  }
  function ballTrail(G, n, c = [0.3, 1, 0.55]) { const b = inst(BALL, n, { emissive: 0x114422 }); G.add(b); return (xs, ys, t, cx = 0, sc = 1) => { for (let i = 0; i < n; i++) { if (i <= t && i < xs.length) { setI(b, i, [cx + sc * xs[i], 0.3, -sc * ys[i]], 0.14); colI(b, i, c); } else hide(b, i); } done(b); }; }
  /* scene 5 */
  function s5(G) {
    const Wg = world(G), st = { N: 512, H: 5 }; G.add(lab('目标', [Wd.goal[0], 1.5, -Wd.goal[1]], { size: 18 }));
    const lines = segLines(60 * 30), spikes = inst(BOX, 60), balls = inst(BALL, 31, { emissive: 0x666666 }); G.add(lines, spikes, balls);
    const x0 = -5.5, y0 = 2.5; let pl, ms = 0; Wg.at(x0, y0); Wg.setHeat(Toy.valueFn(false));
    const calc = () => { const t = performance.now(); pl = Toy.plan(x0, y0, null, Toy.planCfg({ N: st.N, H: st.H, keep: 60, usePi: false }), Toy.mulberry(21)); ms = performance.now() - t; };
    calc();
    const base = planCtl(st, calc, ['N', 'H']);
    return { ctl: base, update(p) {
        const J = pl.iters.length, f = clamp(p * 1.04, 0, 0.9999) * J, j = Math.floor(f), u = f - j, it = pl.iters[j], fd = seg(u, 0, 0.3), sp = seg(u, 0.25, 0.5), sel = seg(u, 0.5, 0.7), mo = seg(u, 0.7, 0.92);
        drawIter(lines, spikes, it, pl.H, fd, sel, sp); drawMean(balls, it, pl.H, mo);
        const calls = (st.N) * st.H * J;
        cap(`第 <b>${j + 1}</b> / ${J} 轮 · ${u < 0.25 ? '采样并经 d 滚动' : u < 0.5 ? '式 (3) 打分' : u < 0.7 ? `留前 k = ${Math.max(2, Math.round(st.N / 8))}` : '式 (4)(5) 更新 μ, σ'}。φ 最高 <b>${it.best.toFixed(2)}</b>，精英最低 ${it.eliteMin.toFixed(2)}，σ 平均 <b>${it.sigAvg.toFixed(3)}</b>。这个决策步调用 d、R ${calls.toLocaleString('en')} 次，页面现算 ${ms.toFixed(1)} ms`);
      } };
  }
  /* scene 6 */
  function s6(G) {
    const Wg = world(G), st = { N: 512, H: 5 }; const lines = segLines(48 * 30), spikes = inst(BOX, 48), balls = inst(BALL, 31, { emissive: 0x666666 }), bars = inst(BOX, 2); G.add(lines, spikes, balls, bars);
    let q = 1, sp = 0, pl, ep; const x0 = 1.0, y0 = 1.0, tr6 = ballTrail(G, 61); Wg.at(x0, y0);
    const lr = lab('Σγᵗ r', [13.2, -0.8, 2.5], { size: 18 }), lq = lab('γᴴ Q', [16.6, -0.8, 2.5], { size: 18 }); G.add(lr, lq); G.add(L.line([[11.6, 0, 0], [18.2, 0, 0]], COL.line));
    const calc = () => { pl = Toy.plan(x0, y0, null, Toy.planCfg({ N: st.N, H: st.H, keep: 48, valueMode: q, usePi: false, sparse: !!sp }), Toy.mulberry(31)); Wg.setHeat(heatFor(q, !!sp)); ep = remember(`s6:${st.N}:${st.H}:${q}:${sp}`, () => Toy.episode({ N: Math.min(st.N, 256), H: st.H, valueMode: q, usePi: false, sparse: !!sp, lite: true, start: [x0, y0], seed: 41 })); };
    calc();
    const base = planCtl(st, calc, ['H']);
    return { ctl: { html: textBtns('Q', qName, 1, 'q') + textBtns('奖励', ['稠密', '稀疏'], 0, 'r') + base.html, bind: base.bind, on(g, k) { if (g === 'q') q = k; else sp = k; calc(); } }, update(p) {
        const J = pl.iters.length, it = pl.iters[Math.min(J - 1, Math.floor(clamp(p * 1.15, 0, 1) * J * 0.9999))]; drawIter(lines, spikes, it, pl.H, 1, 1, 1); drawMean(balls, it, pl.H, 1);
        /* episode trail in the same view */
        const tt = Math.floor(seg(p, 0.45, 1) * (ep.xs.length - 1)); Wg.at(ep.xs[tt], ep.ys[tt]); tr6(ep.xs, ep.ys, tt);
        const mx = Math.max(1, Math.abs(it.bestR), Math.abs(it.bestQ)), ht = v => Math.abs(v) / mx * 5.5;
        bar(bars, 0, 13.2, 0, Math.max(0.01, ht(it.bestR)), 0, 2, 1.6, hex3(COL.R)); bar(bars, 1, 16.6, 0, Math.max(0.01, ht(it.bestQ)), 0, 2, 1.6, hex3(COL.Q)); done(bars);
        const out = ep.reached > 0 ? `第 ${ep.reached} 步到达目标` : `60 步内没到，停在 (${ep.xs[ep.xs.length - 1].toFixed(1)}, ${ep.ys[ep.ys.length - 1].toFixed(1)})`;
        cap(`Q ${qName[q]}，${sp ? '稀疏' : '稠密'}，H = ${st.H}。最好轨迹 φ = <b>${it.best.toFixed(2)}</b> = 奖励 ${it.bestR.toFixed(2)} + 终值 ${it.bestQ.toFixed(2)}。从这一点跑完整回合：<b>${out}</b>`);
      } };
  }
  /* scene 7 */
  function s7(G) {
    const Wg = world(G), st = { N: 64, H: 5 }; const lines = segLines(48 * 30), spikes = inst(BOX, 48), balls = inst(BALL, 31, { emissive: 0x666666 }), bars = inst(BOX, 6); G.add(lines, spikes, balls, bars);
    let usePi = 1, once = 1, q = 2, pl; const x0 = -5, y0 = 2.2; Wg.at(x0, y0); G.add(lab('π 占权重\n第 1 到 6 轮', [15.3, 7.2, 0], { size: 18, border: 'rgba(56,209,255,.8)' })); G.add(L.line([[11.5, 0, 0], [19.5, 0, 0]], COL.line), L.line([[11.5, 5.5, 0], [19.5, 5.5, 0]], COL.line, { opacity: 0.35 }));
    const stats = o => { const r = []; for (let s = 0; s < 6; s++) r.push(Toy.episode({ ...o, lite: true, seed: 100 + s })); return { R: r.reduce((a, b) => a + b.R, 0) / 6, n: r.filter(e => e.reached > 0).length }; };
    let SA, SB;
    const calc = () => { pl = Toy.plan(x0, y0, null, Toy.planCfg({ N: st.N, H: st.H, keep: 48, valueMode: q, usePi: !!usePi, piOnce: !!once }), Toy.mulberry(51)); Wg.setHeat(heatFor(q, false)); const key = `s7:${st.N}:${st.H}:${q}:${once}`; [SA, SB] = remember(key, () => [stats({ N: st.N, H: st.H, valueMode: q, usePi: true, piOnce: !!once }), stats({ N: st.N, H: st.H, valueMode: q, usePi: false })]); };
    calc();
    const base = planCtl(st, calc, ['N']);
    return { ctl: { html: textBtns('π 候选', ['无', '有'], 1, 'u') + textBtns('采样', ['每轮（算法 1）', '一次（代码）'], 1, 'o') + textBtns('Q', qName.slice(1), 1, 'q') + base.html, bind: base.bind, on(g, k) { if (g === 'u') usePi = k; if (g === 'o') once = k; if (g === 'q') q = k + 1; calc(); } }, update(p) {
        const J = pl.iters.length, f = clamp(p * 1.05, 0, 0.9999) * J, j = Math.floor(f), it = pl.iters[j], u = f - j; drawIter(lines, spikes, it, pl.H, seg(u, 0, 0.35), seg(u, 0.4, 0.7), seg(u, 0.25, 0.5)); drawMean(balls, it, pl.H, seg(u, 0.7, 0.9));
        pl.iters.forEach((I, i) => bar(bars, i, 12.2 + i * 1.25, 0, 0.01 + 5.5 * I.piW, 0, 1.0, 1.0, hex3(i === j ? COL.pi : COL.line))); done(bars);
        cap(`第 ${j + 1} 轮：π 候选 ${pl.Npi} 条，进精英 <b>${it.nPiElite}</b> 条，占权重 <b>${(it.piW * 100).toFixed(0)}%</b>（右边柱，1–6 轮）。6 个种子跑完整回合：有 π 回报 <b>${SA.R.toFixed(1)}</b>、到达 ${SA.n}/6；无 π 回报 <b>${SB.R.toFixed(1)}</b>、到达 ${SB.n}/6`);
      } };
  }
  /* scene 8 */
  function s8(G) {
    const Wg = world(G), st = { N: 256, H: 5 }; const lines = segLines(48 * 30), balls = inst(BALL, 31, { emissive: 0x666666 }), tr8 = ballTrail(G, 61); G.add(lines, balls);
    let q = 1, usePi = 1, warm = 1, ep, ms = 0;
    const calc = () => { const t = performance.now(); ep = remember(`s8:${st.N}:${st.H}:${q}:${usePi}:${warm}`, () => Toy.episode({ N: st.N, H: st.H, keep: 48, valueMode: q, usePi: !!usePi && q > 0, warm: !!warm, lastOnly: true, seed: 61 })); ms = performance.now() - t; Wg.setHeat(heatFor(q, false)); };
    calc();
    const base = planCtl(st, calc, ['N', 'H']);
    return { ctl: { html: textBtns('Q', qName, 1, 'q') + textBtns('π', ['关', '开'], 1, 'u') + textBtns('热启动', ['关', '开'], 1, 'w') + base.html, bind: base.bind, on(g, k) { if (g === 'q') q = k; if (g === 'u') usePi = k; if (g === 'w') warm = k; calc(); } }, update(p) {
        const T = ep.steps.length, t = Math.min(T - 1, Math.floor(clamp(p * 1.03, 0, 1) * T)), pl = ep.steps[t], it = pl.iters[0];
        drawIter(lines, null, it, pl.H, 1, 1, 0); drawMean(balls, it, pl.H, 1); Wg.at(ep.xs[t], ep.ys[t]);
        tr8(ep.xs, ep.ys, t);
        let R = 0; for (let i = 0; i <= t; i++) R += ep.rew[i];
        cap(`决策步 <b>${t + 1}</b> / ${T}，累计回报 <b>${R.toFixed(1)}</b>。${ep.reached > 0 ? `第 ${ep.reached} 步到达` : '这回合没到目标'}。最后回报 ${ep.R.toFixed(1)}。每步模型调用 ${((st.N + (usePi && q ? Math.max(1, Math.floor(0.05 * st.N)) : 0)) * st.H * 6).toLocaleString('en')} 次，整回合现算 ${ms.toFixed(0)} ms（第二次走缓存）`);
      } };
  }
  /* scene 9 */
  function s9(G) {
    const Wg = world(G, 5, 0.85), EPS = [0.5, 0.2, 0.05, 0.01]; let eI = 2, pl; const lines = segLines(48 * 8), bars = inst(BOX, 3), sig = inst(BOX, 6); G.add(lines, bars, sig);
    const x0 = -5, y0 = 0; Wg.at(x0, y0); Wg.setHeat(Toy.valueFn(false));
    const F9 = [['Stand', 0.069, COL.h], ['Walk', 0.098, COL.bad], ['Run', 0.134, COL.d]];
    const ox = -19, YS = 5.8 / 0.15; G.add(L.line([[ox - 0.5, 0, 0], [ox + 8, 0, 0]], COL.line), lab('图 9 读数：训练末段 σ', [ox + 3.4, 7.8, 0], { size: 19, border: 'rgba(242,193,78,.8)' }));
    F9.forEach(([n, v], i) => { G.add(lab(`${n} ${v}`, [ox + 0.8 + i * 2.8, -0.9, 2.2], { size: 17 })); });
    const calc = () => { pl = Toy.plan(x0, y0, null, Toy.planCfg({ N: 512, H: 5, keep: 48, eps: EPS[eI], valueMode: 1, usePi: false }), Toy.mulberry(71)); };
    calc();
    return { ctl: { html: textBtns('ε', EPS.map(String), 2, 'e'), on(g, k) { eI = k; calc(); } }, update(p) {
        const q = seg(p, 0, 0.3); F9.forEach(([n, v, c], i) => bar(bars, i, ox + 0.8 + i * 2.8, 0, 0.01 + q * v * YS, 0, 2.0, 1.6, hex3(c))); done(bars);
        const J = pl.iters.length, j = Math.min(J - 1, Math.floor(seg(p, 0.1, 0.9) * J)), it = pl.iters[j]; drawIter(lines, null, it, pl.H, 1, 0.9, 0, 5, 0.85);
        cap(`玩具现算：ε = <b>${EPS[eI]}</b>，第 ${j + 1} 轮后第一个动作的 σ = (${it.sig0[0].toFixed(3)}, ${it.sig0[1].toFixed(3)})，全序列平均 <b>${it.sigAvg.toFixed(3)}</b>。式 (5) 把 σ 托在 ε 以上`);
      } };
  }
  /* scene 10 */
  function s10(G) {
    G.add(L.grid(44, 30));
    const D = FIG; const TASK = ['Quadruped Walk', 'Quadruped Run', 'Fish Swim', 'Reacher Hard', 'Cartpole Sparse'], KEY = ['QW', 'QuadrupedRun', 'FishSwim', 'ReacherHard', 'CartpoleSparse'], AD = [12, 12, 5, 2, 1];
    let m = 0; const bars = inst(BOX, 40), grp = new THREE.Group(); G.add(bars, grp); let items = [], capT = '', job = null;
    const NSW = [16, 64, 256, 512], HSW = [1, 3, 5, 9, 15]; let swq = 2, sw = {};
    const tl = (t, x, y, z = 0, o = {}) => grp.add(lab(t, [x, y, z], { size: o.size || 18, border: o.border }));
    const clearG = () => { while (grp.children.length) { const c = grp.children.pop(); L.dispose(c); LABS = LABS.filter(s => s !== c); } };
    function runSweep() {
      if (job) clearTimeout(job); const key = q => `sw:${q}`; const q = swq; sw = memo.get(key(q)) || {}; memo.set(key(q), sw); let i = 0; const cells = []; NSW.forEach(n => HSW.forEach(h => cells.push([n, h])));
      const tick = () => { while (i < cells.length && sw[cells[i].join()]) i++; if (i >= cells.length || m !== 6 || !api.alive) return; const [n, h] = cells[i]; let R = 0, ok = 0; for (let s = 0; s < 3; s++) { const e = Toy.episode({ N: n, H: h, valueMode: q, usePi: false, lite: true, seed: 300 + s }); R += e.R / 3; if (e.reached > 0) ok++; } sw[n + ',' + h] = { R, ok }; api.update(pNow); job = setTimeout(tick, 0); };
      job = setTimeout(tick, 30);
    }
    function build() {
      clearG(); items = [];
      if (m < 5) {
        const o = D.fig8[KEY[m]] || D.fig6, H = o.H, I = o.I, lo = Math.min(...H.vals, ...I.vals, H.policy[1]), hi = Math.max(...H.vals, ...I.vals, H.star[1]), base = Math.floor(lo / 50) * 50 - 50, Yv = v => (v - base) / (hi - base) * 9;
        const Xa = i => -19 + i * 2.6, Xb = i => -3.5 + i * 2.6;
        [1, 3, 5, 7, 9].forEach((h, i) => { items.push({ x: Xa(i), y: Yv(H.vals[i]), c: COL.h }); items.push({ x: Xb(i), y: Yv(I.vals[i]), c: COL.d }); tl(`H=${h}`, Xa(i), -0.8, 1.8, { size: 18 }); tl(`J=${h}`, Xb(i), -0.8, 1.8, { size: 18 }); tl(H.vals[i].toFixed(0), Xa(i), Yv(H.vals[i]) + 0.8, 0, { size: 18 }); tl(I.vals[i].toFixed(0), Xb(i), Yv(I.vals[i]) + 0.8, 0, { size: 18 }); });
        items.push({ x: 12, y: Yv(H.star[1]), c: 0xf0963c }); items.push({ x: 15.5, y: Yv(H.policy[1]), c: COL.Q });
        tl(`默认 ${H.star[1].toFixed(0)}`, 12, Yv(H.star[1]) + 0.8, 0, { size: 18, border: 'rgba(240,150,60,.8)' }); tl(`π ${H.policy[1].toFixed(0)}`, 15.5, Yv(H.policy[1]) + 0.8, 0, { size: 18, border: 'rgba(157,140,255,.8)' });
        tl(`柱底是回报 ${base}，不是 0`, 13.7, -0.8, 1.8, { size: 18 });
        capT = `<b>${TASK[m]}</b>（动作 ${AD[m]} 维）。规划比 π 高 <b>${(H.star[1] - H.policy[1]).toFixed(0)}</b>，${((H.star[1] - H.policy[1]) / H.star[1] * 100).toFixed(1)}%。H=5 的点 ${H.vals[2].toFixed(1)}，星号 ${H.star[1].toFixed(1)}，同一设置，差 ${Math.abs(H.vals[2] - H.star[1]).toFixed(1)}。回报为 5 次运行平均，${m ? '图 8' : '图 6'}矢量读数`;
      } else if (m === 5) {
        const H = D.fig11.H, I = D.fig11.I, Yv = v => v / 30 * 10, Xa = i => -19 + i * 2.6, Xb = i => -3.5 + i * 2.6;
        [1, 3, 5, 7, 9].forEach((h, i) => { items.push({ x: Xa(i), y: Yv(H.vals[i]), c: COL.h }); items.push({ x: Xb(i), y: Yv(I.vals[i]), c: COL.d }); tl(`H=${h}`, Xa(i), -0.8, 1.8, { size: 18 }); tl(`J=${h}`, Xb(i), -0.8, 1.8, { size: 18 }); tl(H.vals[i].toFixed(1), Xa(i), Yv(H.vals[i]) + 0.8, 0, { size: 18 }); tl(I.vals[i].toFixed(1), Xb(i), Yv(I.vals[i]) + 0.8, 0, { size: 18 }); });
        items.push({ x: 12, y: Yv(H.star[1]), c: 0xf0963c }); items.push({ x: 15.5, y: Yv(H.policy[1]), c: COL.Q });
        tl(`默认 ${H.star[1].toFixed(1)}`, 12, Yv(H.star[1]) + 0.8, 0, { size: 18, border: 'rgba(240,150,60,.8)' }); tl(`π ${H.policy[1].toFixed(1)}`, 15.5, Yv(H.policy[1]) + 0.8, 0, { size: 18, border: 'rgba(157,140,255,.8)' });
        capT = '图 11，Quadruped Run，单张 RTX3090，毫秒每决策步。J 每加 1 约加 2.6 ms，H 增长后期变缓。π 只要 <b>0.9 ms</b>。J = 3 比默认省 37%，不到一半';
      } else {
        NSW.forEach((n, a) => tl(`N=${n}`, -12 + a * 7.2, -0.9, 8.5, { size: 16 })); HSW.forEach((h, b) => tl(`H=${h}`, -17, -0.9, -5.5 + b * 3.3, { size: 16 }));
        runSweep();
      }
    }
    const api = { alive: true, ctl: { html: textBtns('看', ['QWalk', 'QRun', 'Fish', 'Reacher', 'Cartpole', '耗时', '玩具扫描'], 0, 'm') + textBtns('玩具 Q', qName, 2, 'q'), on(g, k) { if (g === 'm') { m = k; if (S) { if (k === 6) fly(0.72, 0.98, 48, [0, 2.5, 1]); else fly(0.02, 1.2, 46, [-1, 3.0, 1]); } } else { swq = k; } build(); } },
      dispose() { this.alive = false; if (job) clearTimeout(job); },
      update(p) {
        const q = seg(p, 0, 0.4);
        if (m < 6) { for (let i = 0; i < bars.count; i++) { if (i < items.length) bar(bars, i, items[i].x, 0, 0.01 + q * items[i].y, 0, 2.0, 1.6, hex3(items[i].c)); else hide(bars, i); } done(bars); cap(capT); }
        else {
          let k = 0, n = 0; NSW.forEach((nn, a) => HSW.forEach((h, b) => { const c = sw[nn + ',' + h]; if (c) { n++; const v = clamp((c.R + 90) / 100, 0.02, 1); bar(bars, k, -12 + a * 7.2, 0, 0.01 + q * v * 9, -5.5 + b * 3.3, 3.2, 2.4, c.ok === 3 ? hex3(COL.d) : c.ok > 0 ? hex3(COL.R) : hex3(COL.bad)); } else hide(bars, k); k++; })); for (; k < bars.count; k++) hide(bars, k); done(bars);
          cap(`玩具现算（J = 6，Q ${qName[swq]}）：已算 ${n} / 20 格。柱高 = 3 个种子的平均回报（−90 到 +10），绿 = 3 次都到，黄 = 部分到，红 = 没到。无 Q 时再大的 N、H 也出不去`);
        }
      } };
    build();
    return api;
  }
  /* scene 11 */
  function s11(G) {
    const A = world(G, -10.5, 0.92), B = world(G, 10.5, 0.92), lines = segLines(48 * 8), ballsA = inst(BALL, 8, { emissive: 0x666666 }), tA = ballTrail(G, 61), tB = ballTrail(G, 61); G.add(lines, ballsA);
    G.add(lab('TD-MPC 式：每步在线规划\nH = 5，N = 512，J = 6', [-10.5, 1.2, 11.6], { size: 20, border: 'rgba(255,122,89,.9)' }), lab('训练好的策略式：一次前向\n没有模型调用', [10.5, 1.2, 11.6], { size: 20, border: 'rgba(212,95,160,.9)' }));
    let q = 2, row = 0, epA, epB;
    const ROW = [
      ['动作从哪来', '<b>动作来源。</b>TD-MPC：每个决策步跑 J 轮 MPPI，返回一个动作。SuperMimic：a<sub>t</sub> = π<sub>θ</sub>(o<sub>t</sub>, g<sub>t</sub>)，确定性，一次前向（§3.1）'],
      ['每步模型调用', '<b>每决策步。</b>TD-MPC：d、R 共 537 × 5 × 6 = 16,110 次，π、Q 另 3,222 次，单卡约 20 ms（图 11）。SuperMimic：部署时不调用 f<sub>ω</sub>，50 Hz；我没找到它报告单次推理耗时'],
      ['优化什么', '<b>优化变量。</b>TD-MPC 的式 (3) 优化这一步的动作序列（线上，不求导）。SuperMimic 的式 (2) 优化策略参数 θ（线下，BPTT），部署时已经解完'],
      ['H', '<b>H。</b>TD-MPC 5：规划试探的长度，默认来自 §5；越过 H 交给 Q。SuperMimic 32：训练反传的长度，越过 H 交给 V<sub>ψ</sub>（§3.3）。部署时它没有 H'],
      ['模型目标', '<b>模型。</b>TD-MPC 不预测观测，靠奖励、价值、潜一致性，三者反传进 h 和 d。SuperMimic 显式预测 ŝ、ō、r̂、d̂（式 1），和策略分开拟合，k = 8'],
      ['策略怎么学', '<b>策略。</b>TD-MPC：最大化 Q(z, π(sg(z)))，不穿过 d，单步。SuperMimic：穿过冻结的 f<sub>ω</sub> 反传 32 步，用到模型的雅可比'],
      ['价值', '<b>价值。</b>TD-MPC：Q(z, a)，1 步 TD，有 EMA 目标网络，训练用回放真实转移。SuperMimic：V(ŝ, g, ξ)，TD(λ)，没有目标网络，只用想象转移'],
      ['何时试错', '<b>收集数据。</b>TD-MPC：训练时也用规划收集（算法 2 第 4 行）。SuperMimic：策略加动作噪声收集，噪声只服务模型拟合（§3.1）'] ];
    const calc = () => { epA = remember(`s11A:${q}`, () => Toy.episode({ N: 256, H: 5, keep: 24, valueMode: q, usePi: true, lastOnly: true, seed: 11 })); epB = remember(`s11B:${q}`, () => Toy.episode({ mode: 'pi', valueMode: q, lite: true })); A.setHeat(heatFor(q, false)); B.setHeat(heatFor(q, false)); };
    calc();
    return { ctl: { html: textBtns('玩具 Q', qName.slice(1), 1, 'q') + textBtns('比', ROW.map(r => r[0]), 0, 'r'), on(g, k) { if (g === 'q') { q = k + 1; calc(); } else row = k; } }, update(p) {
        const T = epA.steps.length, t = Math.min(T - 1, Math.floor(clamp(p * 1.03, 0, 1) * T)), pl = epA.steps[t], it = pl.iters[0];
        A.at(epA.xs[t], epA.ys[t]); B.at(epB.xs[t], epB.ys[t]);
        drawIter(lines, null, it, pl.H, 1, 1, 0, -10.5, 0.92); drawMean(ballsA, it, pl.H, 1, -10.5, 0.92);
        tA(epA.xs, epA.ys, t, -10.5, 0.92); tB(epB.xs, epB.ys, t, 10.5, 0.92);
        cap(`${ROW[row][1]}。<span style="opacity:.8">玩具第 ${t + 1} 步：左 ${epA.reached > 0 && t + 1 >= epA.reached ? '已到达' : '未到'}，右 ${epB.reached > 0 && t + 1 >= epB.reached ? '已到达' : '未到'}</span>`);
      } };
  }
  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player ---------- */
  let cur = 0, api = null, playing = !L.reduced(), t0 = 0, pNow = 0, tw = null;
  const HOLD = 1.8;
  const aspectFix = () => { const el = $('stage'), asp = (el.clientWidth || 1) / (el.clientHeight || 1); return Math.min(2.2, Math.max(1, 1.45 / asp)); };
  function fly(th, ph, d, tg) { let dth = th - S.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth)); d *= aspectFix(); tw = { t0: performance.now(), from: [S.theta, S.phi, S.dist, S.target.clone()], to: [S.theta + dth, ph, d, new THREE.Vector3(...tg)] }; }
  function setPlay(on) { playing = on; $('play').textContent = on ? '❚❚ 暂停' : '▶ 播放'; $('play').setAttribute('aria-label', on ? '暂停' : '播放'); }
  function go(i, p0 = 0) {
    cur = (i + SCENES.length) % SCENES.length; showInfo(cur);
    if (!S) return;
    if (api && api.dispose) api.dispose();
    L.clear(root); LABS = []; PICKS = []; lastCap = null;
    const sc = SCENES[cur]; fly(...sc.cam); refDist = sc.cam[2] * aspectFix();
    const G = new THREE.Group(); root.add(G); api = BUILD[cur](G);
    const box = $('ctl');
    if (api.ctl) { box.hidden = false; box.innerHTML = api.ctl.html; api.ctl.owner = api; if (api.ctl.bind) api.ctl.bind(box); } else { box.hidden = true; box.innerHTML = ''; }
    pNow = p0; t0 = performance.now() - p0 * sc.dur * 1000; api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
  }
  if (S) {
    S.onTick(() => {
      if (playing && api) { const sc = SCENES[cur], el = (performance.now() - t0) / 1000; if (el > sc.dur + HOLD) { t0 = performance.now(); pNow = 0; } else pNow = Math.min(1, el / sc.dur); api.update(pNow); $('scrub').value = Math.round(pNow * 1000); }
      if (tw) { const k = L.reduced() ? 1 : Math.min(1, (performance.now() - tw.t0) / 900), e = L.ease(k), [a, b] = [tw.from, tw.to]; S.setView(L.lerp(a[0], b[0], e), L.lerp(a[1], b[1], e), L.lerp(a[2], b[2], e), a[3].clone().lerp(b[3], e).toArray()); if (k >= 1) tw = null; }
      const f = clamp(S.dist / refDist, 0.6, 1.6); for (const sp of LABS) sp.scale.copy(sp.userData.s0).multiplyScalar(f);
    });
    S.onClick(() => PICKS, hit => { const o = hit?.object, g = o?.userData?.go ?? o?.parent?.userData?.go, pt = o?.userData?.part ?? o?.parent?.userData?.part; if (g != null) go(g); else if (pt && api?.pick) { api.pick(pt); api.update(pNow); } });
    S.onHover(() => PICKS, hit => { $('stage').style.cursor = hit ? 'pointer' : ''; });
  }
  $('ctl').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !api?.ctl?.on) return; const g = b.dataset.g, k = +b.dataset.k; $('ctl').querySelectorAll(`button[data-g="${g}"]`).forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.k === k))); api.ctl.on(g, k); api.update(pNow); });
  $('play').onclick = () => { if (!playing) t0 = performance.now() - pNow * SCENES[cur].dur * 1000; setPlay(!playing); };
  $('scrub').oninput = e => { setPlay(false); pNow = e.target.value / 1000; if (api) api.update(pNow); };
  $('prev').onclick = () => go(cur - 1); $('next').onclick = () => go(cur + 1);
  btns.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); });
  stepsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; go(+b.dataset.i); if (!document.body.classList.contains('embed')) $('stage').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' && e.key !== ' ') return; if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1); else if (e.key === ' ') { e.preventDefault(); $('play').click(); } });
  const s0 = clamp((parseInt(qs.get('scene'), 10) || 1) - 1, 0, SCENES.length - 1), pq = qs.get('p');
  setPlay(playing && pq == null);
  go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0));
  /* test hook: ?ctl=g:k,g:k presses scene buttons, ?N=64&H=9 moves the sliders; for screenshots and checks */
  (qs.get('ctl') || '').split(',').filter(Boolean).forEach(x => { const [g, k] = x.split(':'); const b = document.querySelector(`#ctl button[data-g="${g}"][data-k="${k}"]`); if (b) b.click(); });
  ['N', 'H'].forEach(n => { const v = qs.get(n), el = document.getElementById(n === 'N' ? 'nr' : 'hr'); if (v && el) { el.value = n === 'N' ? NS.indexOf(+v) : +v; el.dispatchEvent(new Event('input')); } });
})();
