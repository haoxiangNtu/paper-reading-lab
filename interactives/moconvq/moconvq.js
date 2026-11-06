'use strict';
/* MoConVQ (arXiv 2310.10198) taken apart into eleven scenes. Sizes and hyperparameters come from the paper and the official code.
   Scenes 3, 4, 6, 7, 8, 10 run a real, tiny MoConVQ on one joint, trained in this tab with a fixed seed. Scenes 2 and 5 compute receptive fields from the architecture.
   Each scene's update(p) is a pure function of the timeline p. */
/* TOY-BEGIN : a real, tiny MoConVQ on a two-joint arm, trained in this browser tab with a fixed seed. No baked weights, no canned curves. */
const Toy = (function () {
  function RNG(seed) {
    let a = seed >>> 0, spare = null;
    const u = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const n = () => { if (spare != null) { const s = spare; spare = null; return s; } let x = 0, y = 0, r = 0; do { x = 2 * u() - 1; y = 2 * u() - 1; r = x * x + y * y; } while (r >= 1 || r === 0); const f = Math.sqrt(-2 * Math.log(r) / r); spare = y * f; return x * f; };
    return { u, n, int: k => Math.floor(u() * k) };
  }
  /* one hidden layer, ELU, hand-written vector-Jacobian product so a whole rollout backpropagates cheaply */
  class MLP {
    constructor(nI, nH, nO, rng, gain = 1) {
      this.nI = nI; this.nH = nH; this.nO = nO; this.p = new Float64Array(nH * (nI + 1) + nO * (nH + 1));
      const s1 = 1 / Math.sqrt(nI + 1), s2 = 0.3 * gain / Math.sqrt(nH + 1), split = nH * (nI + 1);
      for (let i = 0; i < this.p.length; i++) this.p[i] = rng.n() * (i < split ? s1 : s2);
      this.g = new Float64Array(this.p.length); this.m = new Float64Array(this.p.length); this.v = new Float64Array(this.p.length); this.tt = 0;
    }
    f(x) {
      const { nI, nH, nO, p } = this, a = new Float64Array(nH), d = new Float64Array(nH), y = new Float64Array(nO);
      let k = 0;
      for (let h = 0; h < nH; h++) { let s = p[k + nI]; for (let i = 0; i < nI; i++) s += p[k + i] * x[i]; k += nI + 1; if (s > 0) { a[h] = s; d[h] = 1; } else { const e = Math.exp(s); a[h] = e - 1; d[h] = e; } }
      for (let o = 0; o < nO; o++) { let s = p[k + nH]; for (let h = 0; h < nH; h++) s += p[k + h] * a[h]; k += nH + 1; y[o] = s; }
      return { x, a, d, y };
    }
    vjp(c, cot, learn) {
      const { nI, nH, nO, p, g } = this, split = nH * (nI + 1), ch = new Float64Array(nH), ci = new Float64Array(nI);
      let k = split;
      for (let o = 0; o < nO; o++) { const co = cot[o]; if (co !== 0) { for (let h = 0; h < nH; h++) { ch[h] += co * p[k + h]; if (learn) g[k + h] += co * c.a[h]; } if (learn) g[k + nH] += co; } k += nH + 1; }
      k = 0;
      for (let h = 0; h < nH; h++) { const q = ch[h] * c.d[h]; for (let i = 0; i < nI; i++) { ci[i] += q * p[k + i]; if (learn) g[k + i] += q * c.x[i]; } if (learn) g[k + nI] += q; k += nI + 1; }
      return ci;
    }
    adam(lr, clip = 1) {
      const { p, g, m, v } = this; this.tt++; let n = 0; for (let i = 0; i < g.length; i++) n += g[i] * g[i]; n = Math.sqrt(n);
      if (!isFinite(n)) { g.fill(0); return n; }
      const sc = n > clip ? clip / n : 1, b1 = 0.9, b2 = 0.999, c1 = 1 - Math.pow(b1, this.tt), c2 = 1 - Math.pow(b2, this.tt);
      for (let i = 0; i < g.length; i++) { const q = g[i] * sc; m[i] = b1 * m[i] + (1 - b1) * q; v[i] = b2 * v[i] + (1 - b2) * q * q; p[i] -= lr * (m[i] / c1) / (Math.sqrt(v[i] / c2) + 1e-8); g[i] = 0; }
      return n;
    }
  }
  /* The black-box "simulator": a two-joint arm, PD-driven, under gravity and friction. Same PD gains and rates as the paper: (400, 50), 120 Hz inside, 20 Hz outside.
     The learner never sees these formulas, only transitions. State = (th1, w1, th2, w2) with w = omega / 4 so everything is of order 1. */
  const DT = 0.05, SUB = 6, W_SCALE = 4, NJ = 2;
  function sim(s, a0) {
    const a1 = Math.max(-3, Math.min(3, a0[0])), a2 = Math.max(-3, Math.min(3, a0[1])), h = DT / SUB; let t1 = s[0], o1 = s[1] * W_SCALE, t2 = s[2], o2 = s[3] * W_SCALE;
    for (let i = 0; i < SUB; i++) {
      const g2 = Math.sin(t1 + t2), f1 = 400 * (a1 - t1) - 50 * o1 - 90 * Math.sin(t1) - 40 * g2 - 10 * Math.tanh(4 * o1), f2 = 400 * (a2 - t2) - 50 * o2 - 60 * g2 - 8 * Math.tanh(4 * o2) - 6 * o1 * o1 * Math.sin(t2);
      o1 += h * f1 / 2.4; o2 += h * f2 / 2.0; t1 += h * o1; t2 += h * o2;
    }
    return [t1, o1 / W_SCALE, t2, o2 / W_SCALE];
  }
  /* motion dataset: one long unstructured joint-angle curve at 20 Hz. Each "skill" is a sine; parameters change every 1 to 3 s and are low-pass filtered so the curve stays smooth */
  function curve1(r, N) {
    const th = new Float64Array(N); let A = 0.6, f = 0.5, o = 0, tA = A, tf = f, to = o, ph = r.u() * 6.28, left = 0;
    for (let i = 0; i < N; i++) {
      if (left-- <= 0) { tA = 0.2 + r.u() * 1.0; tf = 0.3 + r.u() * 0.8; to = (r.u() * 2 - 1) * 0.5; left = 20 + r.int(40); }
      A += 0.08 * (tA - A); f += 0.08 * (tf - f); o += 0.08 * (to - o); ph += 2 * Math.PI * f * DT; th[i] = o + A * Math.sin(ph);
    }
    const w = new Float64Array(N); for (let i = 0; i < N - 1; i++) w[i] = (th[i + 1] - th[i]) / DT / W_SCALE; w[N - 1] = w[N - 2];
    return { th, w };
  }
  function makeD(seed, N = 3000) { const r = RNG(seed), a = curve1(r, N), b = curve1(r, N); return { th: a.th, w: a.w, th2: b.th, w2: b.w, N }; }
  const st0 = (D, o) => [D.th[o], D.w[o], D.th2[o], D.w2[o]];
  const NW = 12, HOP = 4, T = 24, K = 7;                     /* encoder window, frames per code, frames per clip; K = 6 codes + 1 so the last frames can interpolate */
  const winOf = (D, c) => { const x = new Array(2 * NW), n = D.th.length; for (let j = 0; j < NW; j++) { const q = Math.max(0, Math.min(n - 1, c - 4 + j)); x[j] = D.th[q] / 1.5; x[NW + j] = D.th2[q] / 1.5; } return x; };
  /* Deconv stand-in: frame t reads codes k and k+1 with fixed linear weights */
  const upK = t => { const x = (t - 2) / HOP, k = Math.max(0, Math.floor(x)); return [k, Math.max(0, x - k)]; };
  const interp = (Z, t) => { const [k, f] = upK(t), a = Z[k], b = Z[Math.min(Z.length - 1, k + 1)]; return [a[0] * (1 - f) + b[0] * f, a[1] * (1 - f) + b[1] * f]; };

  /* residual quantizer: Algorithm 1 of the paper. Returns z, indices, the residual chain */
  function quant(B, v, L) {
    const r = [v[0], v[1]], z = [0, 0], I = [], chain = [];
    for (let d = 0; d < L; d++) {
      const C = B[d]; let bi = 0, bd = 1e18; for (let i = 0; i < C.length; i++) { const e = (C[i][0] - r[0]) ** 2 + (C[i][1] - r[1]) ** 2; if (e < bd) { bd = e; bi = i; } }
      chain.push({ r: [r[0], r[1]], c: C[bi], i: bi, d2: bd }); I.push(bi); r[0] -= C[bi][0]; r[1] -= C[bi][1]; z[0] += C[bi][0]; z[1] += C[bi][1];
    }
    return { z, I, chain, rest: r };
  }
  function kmeans(P, Kc, r, it = 12) {
    const C = []; const pick = () => P[r.int(P.length)]; C.push(pick().slice());
    while (C.length < Kc) { /* k-means++ */
      const D = P.map(p => { let b = 1e18; for (const c of C) { const e = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2; if (e < b) b = e; } return b; }); let s = 0; for (const d of D) s += d; let t = r.u() * s, j = 0; for (; j < P.length - 1; j++) { t -= D[j]; if (t <= 0) break; } C.push(P[j].slice());
    }
    for (let q = 0; q < it; q++) {
      const S = C.map(() => [0, 0, 0]); for (const p of P) { let b = 1e18, bi = 0; for (let i = 0; i < Kc; i++) { const e = (C[i][0] - p[0]) ** 2 + (C[i][1] - p[1]) ** 2; if (e < b) { b = e; bi = i; } } S[bi][0] += p[0]; S[bi][1] += p[1]; S[bi][2]++; }
      for (let i = 0; i < Kc; i++) if (S[i][2]) { C[i][0] = S[i][0] / S[i][2]; C[i][1] = S[i][1] / S[i][2]; }
    }
    return C;
  }
  /* residual k-means: the released code initialises each layer with k-means on the residuals of the first batch */
  function residualBooks(P, Kc, L, r) {
    let R = P.map(p => p.slice()); const B = [];
    for (let d = 0; d < L; d++) { const C = kmeans(R, Math.min(Kc, R.length), r); B.push(C); R = R.map(p => { let b = 1e18, bi = 0; for (let i = 0; i < C.length; i++) { const e = (C[i][0] - p[0]) ** 2 + (C[i][1] - p[1]) ** 2; if (e < b) { b = e; bi = i; } } return [p[0] - C[bi][0], p[1] - C[bi][1]]; }); }
    return B;
  }
  const WA2 = 0.002;
  const fW = (A, s, a) => A.W.f([s[0], s[1], s[2], s[3], a[0], a[1]]);
  const stepW = (s, y) => { const w1 = s[1] + y[0], w2 = s[3] + y[1]; return [s[0] + w1 * DT * W_SCALE, w1, s[2] + w2 * DT * W_SCALE, w2]; };
  const fPi = (A, s, u) => A.Pi.f([s[0], s[1], s[2], s[3], u[0], u[1]]);
  /* collect: track random clips in the true simulator with the current model */
  function encodeClip(A, D, o) { const V = []; for (let k = 0; k < K; k++) V.push(A.E.f(winOf(D, o + HOP * k + 2)).y); return V; }
  function quantClip(A, V, L, r) {
    if (A.cont) return V.map(v => [v[0] + A.sigma * (r ? r.n() : 0), v[1] + A.sigma * (r ? r.n() : 0)]);
    return V.map(v => quant(A.B, v, L).z);
  }
  function collect(A, D, r, n, buf) {
    for (let e = 0; e < n; e++) {
      const o = 8 + r.int(D.N - T - 20), V = encodeClip(A, D, o), Z = quantClip(A, V, r.int(A.L) + 1, r); let s = st0(D, o).map(x => x + 0.15 * r.n()); const tr = { s: [s], a: [] };
      for (let t = 0; t < T; t++) { const y = fPi(A, s, interp(Z, t)).y, a = [y[0] + 0.1 * r.n(), y[1] + 0.1 * r.n()], s2 = sim(s, a); tr.a.push(a); tr.s.push(s2); s = s2; }
      buf.push(tr);
    }
    while (buf.length > 100) buf.shift();
  }
  function trainW(A, buf, r, Tw, bs, lr) {
    let tot = 0, c = 0;
    for (let b = 0; b < bs; b++) {
      const tr = buf[r.int(buf.length)], o = r.int(T - Tw + 1); let s = tr.s[o]; const tape = [];
      for (let t = 0; t < Tw; t++) { const C = fW(A, s, tr.a[o + t]), n = stepW(s, C.y), g = tr.s[o + t + 1], sg = [0, 0, 0, 0]; for (let j = 0; j < 4; j++) { const e = n[j] - g[j]; tot += Math.abs(e) / 2; sg[j] = Math.sign(e); } c++; tape.push({ C, sg }); s = n; }
      const c_ = [0, 0, 0, 0];
      for (let t = Tw - 1; t >= 0; t--) { for (let j = 0; j < 4; j++) c_[j] += tape[t].sg[j]; const h = DT * W_SCALE, cw1 = c_[1] + h * c_[0], cw2 = c_[3] + h * c_[2], ci = A.W.vjp(tape[t].C, [cw1, cw2], true); c_[0] += ci[0]; c_[1] = cw1 + ci[1]; c_[2] += ci[2]; c_[3] = cw2 + ci[3]; }
    }
    const k = 1 / (bs * Tw); for (let i = 0; i < A.W.g.length; i++) A.W.g[i] *= k;
    A.W.adam(lr); return c ? tot / c : 0;
  }
  /* one rollout through the world model (Eq. 4, Eq. 6). st = false cuts the straight-through path. Returns the per-step story */
  function rollout(A, D, o, L, opt = {}) {
    const beta = opt.beta ?? A.beta, gam = opt.gam ?? 0.95, st = opt.st ?? A.st, r = opt.r, learn = !!opt.learn;
    const Enc = []; const V = []; for (let k = 0; k < K; k++) { const C = A.E.f(winOf(D, o + HOP * k + 2)); Enc.push(C); V.push(C.y); }
    const Qs = A.cont ? null : V.map(v => quant(A.B, v, L)); const Eps = V.map(() => r ? [r.n(), r.n()] : [0, 0]);
    const Z = A.cont ? V.map((v, k) => [v[0] + A.sigma * Eps[k][0], v[1] + A.sigma * Eps[k][1]]) : Qs.map(q => q.z);
    let s = opt.s0 || st0(D, o), Lr = 0, La = 0; const tape = [], path = [s];
    for (let t = 0; t < T; t++) {
      const u = interp(Z, t), Cp = fPi(A, s, u), a = [Cp.y[0] + (r ? 0.03 * r.n() : 0), Cp.y[1] + (r ? 0.03 * r.n() : 0)], Cw = fW(A, s, a), n = stepW(s, Cw.y), g = Math.pow(gam, t), gt = st0(D, o + t + 1), sg = [0, 0, 0, 0];
      for (let j = 0; j < 4; j++) { const e = n[j] - gt[j]; Lr += g * (j % 2 ? 0.3 : 1) * Math.abs(e); sg[j] = Math.sign(e) * (j % 2 ? 0.3 : 1); }
      La += g * WA2 * (a[0] * a[0] + a[1] * a[1]); tape.push({ Cp, Cw, u, a, g, sg, n, s }); s = n; path.push(n);
    }
    const c_ = [0, 0, 0, 0], cz = V.map(() => [0, 0]), gu = new Array(T), hh = DT * W_SCALE;
    for (let t = T - 1; t >= 0; t--) {
      const q = tape[t], g = q.g; for (let j = 0; j < 4; j++) c_[j] += g * q.sg[j];
      const cw1 = c_[1] + hh * c_[0], cw2 = c_[3] + hh * c_[2], ci = A.W.vjp(q.Cw, [cw1, cw2], false), cp = A.Pi.vjp(q.Cp, [ci[4] + 2 * g * WA2 * q.a[0], ci[5] + 2 * g * WA2 * q.a[1]], learn);
      const [k, f] = upK(t), k1 = Math.min(K - 1, k + 1); cz[k][0] += (1 - f) * cp[4]; cz[k][1] += (1 - f) * cp[5]; cz[k1][0] += f * cp[4]; cz[k1][1] += f * cp[5];
      gu[t] = Math.hypot(cp[4], cp[5]); c_[0] += ci[0] + cp[0]; c_[1] = cw1 + ci[1] + cp[1]; c_[2] += ci[2] + cp[2]; c_[3] = cw2 + ci[3] + cp[3];
    }
    /* commitment (or KL for the continuous baseline). Each layer's residual r_d depends on v through dr_d/dv = I, the code terms are stop-gradient */
    let Lc = 0; const gradZ = [], gradC = [];
    for (let k = 0; k < K; k++) {
      let cc = [0, 0];
      if (A.cont) { cc = [2 * beta * V[k][0], 2 * beta * V[k][1]]; Lc += beta * (V[k][0] ** 2 + V[k][1] ** 2); }
      else for (const c of Qs[k].chain) { const e0 = c.r[0] - c.c[0], e1 = c.r[1] - c.c[1]; Lc += beta * (e0 * e0 + e1 * e1); cc[0] += 2 * beta * e0; cc[1] += 2 * beta * e1; }
      const pass = st || A.cont; gradZ.push(Math.hypot(cz[k][0], cz[k][1])); gradC.push(Math.hypot(cc[0], cc[1]));
      const ci = A.E.vjp(Enc[k], [(pass ? cz[k][0] : 0) + cc[0], (pass ? cz[k][1] : 0) + cc[1]], learn); void ci;
    }
    return { Lr, La, Lc, tape, path, V, Z, Qs, gu, gradZ, gradC };
  }
  /* EMA codebook update as in the released VQEmbeddingMovingAverage: keep (1 - decay) of the new statistics; reset dead codes from the batch */
  function emaUpdate(A, Vs, L, r, decay) {
    let R = Vs.map(v => v.slice());
    for (let d = 0; d < L; d++) {
      const C = A.B[d], nC = C.length, cnt = new Float64Array(nC), sum = C.map(() => [0, 0]), R2 = [];
      for (const p of R) { let b = 1e18, bi = 0; for (let i = 0; i < nC; i++) { const e = (C[i][0] - p[0]) ** 2 + (C[i][1] - p[1]) ** 2; if (e < b) { b = e; bi = i; } } cnt[bi]++; sum[bi][0] += p[0]; sum[bi][1] += p[1]; R2.push([p[0] - C[bi][0], p[1] - C[bi][1]]); }
      for (let i = 0; i < nC; i++) {
        A.emaN[d][i] = decay * A.emaN[d][i] + (1 - decay) * cnt[i]; A.emaW[d][i][0] = decay * A.emaW[d][i][0] + (1 - decay) * sum[i][0]; A.emaW[d][i][1] = decay * A.emaW[d][i][1] + (1 - decay) * sum[i][1];
        if (A.emaN[d][i] < 0.05) { const p = R[r.int(R.length)]; C[i][0] = p[0] + 0.01 * r.n(); C[i][1] = p[1] + 0.01 * r.n(); A.emaN[d][i] = 1; A.emaW[d][i] = [C[i][0], C[i][1]]; A.resets++; }
        else { C[i][0] = A.emaW[d][i][0] / A.emaN[d][i]; C[i][1] = A.emaW[d][i][1] / A.emaN[d][i]; }
      }
      R = R2;
    }
  }
  function initBooks(A, D, r) {
    const P = []; for (let i = 0; i < 500; i++) P.push(A.E.f(winOf(D, 8 + r.int(D.N - 20))).y);
    A.B = residualBooks(P, A.Kc, A.L, r); A.emaN = A.B.map(C => new Float64Array(C.length).fill(1)); A.emaW = A.B.map(C => C.map(c => c.slice()));
    /* start from real counts so the first EMA steps do not jump */
    let R = P; A.B.forEach((C, d) => { const n = C.map(() => 0), s = C.map(() => [0, 0]), R2 = []; for (const p of R) { let b = 1e18, bi = 0; C.forEach((c, i) => { const e = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2; if (e < b) { b = e; bi = i; } }); n[bi]++; s[bi][0] += p[0]; s[bi][1] += p[1]; R2.push([p[0] - C[bi][0], p[1] - C[bi][1]]); } const fac = 24 / P.length; C.forEach((c, i) => { A.emaN[d][i] = Math.max(0.2, n[i] * fac); A.emaW[d][i] = [c[0] * A.emaN[d][i], c[1] * A.emaN[d][i]]; }); R = R2; });
  }
  function makeAgent(o) {
    const r = RNG(o.seed);
    const A = { Kc: o.Kc, L: o.L, cont: !!o.cont, sigma: o.sigma ?? 0.08, beta: o.beta, st: o.st !== false, E: new MLP(2 * NW, 32, 2, r, 3), Pi: new MLP(6, 48, 2, r, 2), W: new MLP(6, 48, 2, r, 0.3), resets: 0 };
    return A;
  }
  function trainAll(o = {}) {
    const cfg = Object.assign({ seed: 7, Kc: 16, L: 4, beta: 0.05, epochs: 150, st: true, cont: false }, o);
    const D = makeD(11), A = makeAgent(cfg), r = RNG(cfg.seed * 31 + 5), buf = [], log = [], snaps = [];
    if (!A.cont) initBooks(A, D, r);
    for (let e = 0; e < cfg.epochs; e++) {
      collect(A, D, r, 6, buf);
      let Lw = 0; for (let i = 0; i < 8; i++) Lw += trainW(A, buf, r, 8, 4, 3e-3); Lw /= 8;
      let Lr = 0, Lc = 0, La = 0;
      for (let i = 0; i < 8; i++) {
        const bs = 5, Vs = []; const Ld = A.cont ? 0 : 1 + r.int(A.L);
        for (let b = 0; b < bs; b++) { const o2 = 8 + r.int(D.N - T - 20); const R = rollout(A, D, o2, Ld, { r, learn: true, s0: st0(D, o2).map(x => x + 0.05 * r.n()) }); Lr += R.Lr / T; Lc += R.Lc / K; La += R.La / T; Vs.push(...R.V); }
        const k = 1 / (bs * T); for (const N of [A.E, A.Pi]) { for (let q = 0; q < N.g.length; q++) N.g[q] *= k; N.adam(3e-3); }
        if (!A.cont) emaUpdate(A, Vs, Ld, r, 0.95);
      }
      log.push({ e, Lw, Lr: Lr / 40, Lc: Lc / 40, La: La / 40 });
      if (e % 10 === 0 || e === cfg.epochs - 1) snaps.push({ e, W: A.W.p.slice() });
    }
    return { A, D, buf, log, snaps, cfg, Test: makeD(101, 1600) };
  }
  /* run a clip in the true simulator: encode the (optionally noisy) reference Dn, quantize with L layers, decode with pi + sim */
  function track(A, Dn, o, n, L, s0) {
    const nk = Math.ceil(n / HOP) + 2, V = []; for (let k = 0; k < nk; k++) V.push(A.E.f(winOf(Dn, o + HOP * k + 2)).y);
    const Z = quantClip(A, V, L, null); let s = s0 || st0(Dn, o); const out = [s], act = [];
    for (let t = 0; t < n; t++) { const a = fPi(A, s, interp(Z, t)).y.slice(); s = sim(s, a); out.push(s); act.push(a); }
    return { out, act, Z, V };
  }
  const noisy = (T0, o, n, sig, r) => { const Dn = { th: Float64Array.from(T0.th), th2: Float64Array.from(T0.th2), N: T0.N, w: T0.w, w2: T0.w2 }; if (sig > 0) for (let q = Math.max(0, o - 12); q < Math.min(T0.N, o + n + 16); q++) { Dn.th[q] += sig * r.n(); Dn.th2[q] += sig * r.n(); } return Dn; };
  function evalTrack(A, T0, L, sig, seed = 3, nc = 60, n = 96) {
    const r = RNG(seed); let E = 0, c = 0;
    for (let i = 0; i < nc; i++) { const o = 16 + r.int(T0.N - n - 40), R = track(A, noisy(T0, o, n, sig, r), o, n, L, st0(T0, o)); for (let t = 1; t <= n; t++) { E += (Math.abs(R.out[t][0] - T0.th[o + t]) + Math.abs(R.out[t][2] - T0.th2[o + t])) / 2; c++; } }
    return E / c;
  }
  function decodeZ(A, Z, n, s0) { let s = s0; const out = [s]; for (let t = 0; t < n; t++) { s = sim(s, fPi(A, s, interp(Z, t)).y.slice()); out.push(s); } return out; }
  return { RNG, MLP, DT, HOP, T, K, NW, sim, makeD, winOf, upK, interp, quant, kmeans, residualBooks, stepW, fW, fPi, rollout, trainAll, track, evalTrack, decodeZ, st0, noisy };
})();
/* TOY-END */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const fx = (x, n = 2) => (x == null || !isFinite(x)) ? '–' : x.toFixed(n);
  const vv = (v, n = 2) => '(' + v.map(x => fx(x, n)).join(', ') + ')';
  const COL = { enc: 0x3aa8e0, code: 0xf2c14e, dec: 0x38d1ff, pi: 0x4fc98a, wm: 0x9d8cff, sim: 0x8e9bb8, data: 0xd45fa0, grad: 0xff7a59, white: 0xe6ecf7, dim: 0x46536e };
  const LAY = [0xf2c14e, 0xf0963c, 0xd45fa0, 0x9d8cff];
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyB = t => `<p class="guess toy"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const LIVE = '<div id="live" class="live"></div><div id="miniBox" class="minibox" hidden><canvas id="mini" height="150"></canvas><p id="miniLeg" class="minileg"></p></div>';

  /* ---------- models, trained once per variant in this tab, deterministically ---------- */
  const cache = {};
  function M(c = {}) { const k = JSON.stringify(c); if (!cache[k]) cache[k] = Toy.trainAll(Object.assign({ Kc: 4, L: 4 }, c)); return cache[k]; }
  const main = () => M();
  const U = {};
  function resetU() { Object.assign(U, { k3: 1, b3: 0, v3: null, ema: 0, k4: 1, l4: 2, v4: null, drop: 0, t2: 0, a2: 0, sel2: null, a5: 0, h6: 1, st7: 0, b7: 1, n8: 0, k8: 0, sel8: 3, goal: null, sp9: 0, seed10: 1, lay10: 2, tmp10: 0, ex11: 0 }); }
  resetU();

  const SCENES = [
    { n: 1, part: '总览', title: '编码器、码本、物理解码器', sub: '图 2 的结构，点方块跳到讲它的那一幕', dur: 15, cam: [0, 1.0, 40, [0, 2.6, 0]],
      html: dl([['编码', '\\(V=\\mathcal E(M)\\)，1D 卷积，24 帧变 6 个向量'], ['量化', '\\(Z=\\mathcal B(V)\\)，每个向量换成最近的码，再量化残差'], ['解码', '\\(\\tilde M=\\mathcal D(Z)\\)：反卷积、策略 π、仿真器'], ['训练', '仿真器换成世界模型 \\(\\mathcal W\\)，整条路就可导了']]) +
        '<p>解码器里包着一个仿真器，这是它和普通 VQ-VAE 的主要区别。训练好以后，下游任务接在中间：跟踪走完整条路（编码器加解码器），其他任务只用解码器，分别在 \\(v_k\\)、\\(z_k\\) 或索引 \\(I_k\\) 上给输入。</p><p>点方块可以跳到讲它的那一幕。</p>' +
        guess('方块大小和摆放是我画的，不代表耗时或维度。连线来自原文图 2 和第 3、4 节。') + src('§3.1 · 图 2 · 式 1 · 式 3 · §4') },
    { n: 2, part: '§3.1 编码器', title: '24 帧压成 6 个码，每个码看多少帧', sub: '点上面的码，看它的感受野；现算', dur: 14, cam: [0, 1.0, 37, [0.4, 3.8, 0]],
      html: LIVE + '<p>编码器是 1D 全卷积网络：两次步长 2 的下采样，每次后面接 3 个残差块，所以每 4 帧出一个向量，每个向量 768 维。输入每帧 323 维（代码，20 个刚体各 16 维，加 3 维上方向）。</p><p>这里的高亮不是画的：页面按网络结构逐层推出每个输出依赖哪些输入。可以切论文表 5 和代码两种结构。</p><p>两个结果：训练窗口 \\(T=24\\) 时每个码都看到整段；无限长输入时感受野比窗口还长，是 54 帧（代码）。</p>' +
        src('§3.1 · §3.4 · 表 5 · §5.1 · 代码 <code>convvq.py: ConvEncoder</code>') },
    { n: 3, part: '§3.1 码本', title: '拖一个 v，看最近的码和承诺项', sub: '改码本大小；地形高度就是 d²', dur: 16, cam: [0, 0.88, 25, [0, 0.5, 0.9]],
      html: LIVE + '<p>拖平面上的白点放一个 \\(v\\)。粉点是玩具编码器对真实片段的输出，金球是码。地形高度是 \\(\\min_i\\|v-z_i\\|^2\\)：每个码是一个碗的底，碗和碗相交的折线就是沃罗诺伊边界（最近的码在这里换人）。</p><p><b>式 2</b> 只取最小值，所以索引是跳变的，不可导。<b>承诺项</b> \\(\\beta_1\\|v-\\mathrm{sg}(z)\\|^2\\) 把编码器拉向码，<b>VQ 目标</b>把码拉向编码器，数值相同，梯度的去向不同。</p><p>码本变大，平均 \\(d^2\\) 下降，但在二维里 \\(K\\) 翻 4 倍 \\(d^2\\) 才大约变成 1/4。维度越高越慢：同一比例下把距离减半要 \\(2^D\\) 倍的码。这是 §3.2 要用残差结构的原因。</p>' +
        toyB('二维隐空间。论文是 768 维、\\(|\\mathcal B|=512\\)。这里切码本大小只是在同一批 v 上重跑 k-means，没有重训网络（官方代码也用 k-means 初始化）。“EMA 拉 20 次”按代码的衰减 0.99 算。') + src('式 2 · 式 6 · 式 10 · §3.2 · §5.1') },
    { n: 4, part: '§3.2 残差 VQ', title: '算法 1：一层量化，下一层量化余下的', sub: '拖 v，改层数和每层大小', dur: 16, cam: [0, 0.62, 37, [0, 0, 1]],
      html: LIVE + '<p>四个平面是前四层。第 \\(d\\) 层拿到 \\(r_d=v-\\sum_{j&lt;d}z_j\\)，在自己的码本里找最近的码。残差越来越小，所以每个平面的缩放不同，面上写了比例。平面旁的柱子是这一层量化后剩下的 \\(\\|r_{d+1}\\|\\)。</p><p>索引元组 \\((I_0,\\dots,I_N)\\) 就是这个向量的离散表示。\\(L\\) 层的组合数是 \\(K^L\\)，内存只增长 \\(K\\times L\\)。</p><p><b>量化器 dropout：</b>训练时随机只用前几层重建，所以任何前缀都能解码。点“抽前缀”看只用前几层时误差多大。</p>' +
        toyB('码本在玩具编码器的输出上按算法 1 逐层跑 k-means。同样比特的单层 VQ 也是现算：在二维里它的误差反而比残差结构小。残差结构换来的是码向量个数从 \\(K^L\\) 降到 \\(K\\times L\\)，论文还提到训练稳定性（码坍缩），这个玩具看不出后者。') + src('§3.2 · 算法 1 · §3.4 · §5.1') },
    { n: 5, part: '§3.1 解码器', title: '5 Hz 的码、20 Hz 的策略、120 Hz 的仿真', sub: '第 t 帧要用到哪些码，现算', dur: 15, cam: [0, 0.98, 36, [0.3, 5.4, 0]],
      html: LIVE + '<p>反卷积把码上采样 4 倍，得到每帧一个 \\(u_t\\)（代码里 256 维）。策略 \\(a_t=\\pi(s_t,u_t)\\)，输出是所有关节的 PD 目标（19×3 = 57 维），下一次策略之前连续走 6 个 120 Hz 仿真步。</p><p>这里算的是：第 t 帧的 \\(u_t\\) 依赖哪些码。代码的结构给出前后共 16 或 17 个码（看 t 落在码的哪个位置），其中 <b>7 或 8 个在未来</b>，约 1.4 到 1.6 秒。这是上界，感受野边缘的权重可能很小。§6 把“需要未来的码”列为限制。</p>' +
        guess('六个专家方块的亮度是示意，不是门控网络的输出。') + src('式 3 · 式 7 · §3.1 · §3.4 · §5.1 · §6 · 表 5') },
    { n: 6, part: '§3.3 世界模型', title: '仿真器跑出来的数据，拟合 W', sub: '进度条是训练轮数，切开环步数', dur: 15, cam: [0, 1.2, 39, [-1.2, 4.2, 0]],
      html: LIVE + '<p>当前模型在<b>真仿真器</b>里跟踪随机片段，写进先进先出缓存。然后 \\(\\mathcal W\\) 重放同样的动作，用式 5 贴近记录。论文说这个缓存对稳定训练至关重要（\\(5\\times10^4\\) 帧，每轮换 1024 帧）。</p><p>曲线是一段固定动作序列：灰线是仿真器的真实结果，绿线是 \\(\\mathcal W\\) 只看动作开环滚出来的结果。进度条拖到后面，绿线逐渐贴上灰线。</p>' +
        toyB('两个关节：\\(\\tau=400(a-\\theta)-50\\dot\\theta\\)（式 7，增益和论文相同），外加重力、摩擦和耦合，120 Hz 积分，20 Hz 控制。学习器看不到公式。150 轮，每轮 8 次更新，都在你这个标签页里跑。图上只画关节 1。') + src('式 4 · 式 5 · §3.3 · §3.4（World Model）') },
    { n: 7, part: '§3.3 穿过 W 训练', title: '梯度从动作回到编码器，要跨过量化', sub: '关掉直通，或改 β₁，都现算', dur: 17, cam: [0, 1.14, 44, [-1.2, 6.0, 0]],
      html: LIVE + '<p>参考片段 → \\(\\mathcal E\\) → 量化 → 插值 → \\(\\pi\\) → \\(\\mathcal W\\)，滚 24 帧，和参考比（式 6 第一项）。\\(\\mathcal W\\) 在这一步不更新，只提供雅可比。红柱是 \\(\\|\\partial\\mathcal L/\\partial u_t\\|\\)，一次真实的反向传播；玩具的反传和有限差分核对过。</p><p>量化不可导，\\(\\partial\\mathcal L/\\partial z\\) 被原样抄给 \\(v\\)（直通估计，van den Oord 2017）。<b>关掉直通</b>后编码器只剩承诺项的梯度，也就收不到“动作错了”这个信号，下面的曲线是两种情况各训一次的结果。</p>' +
        toyB('编码器和策略都是一个隐层。没有 MoE。Deconv 换成固定线性插值。学习率 3e-3（论文 1e-5）。') + src('式 6 · §3.3 · 代码 <code>train_policy</code>、<code>vq_st</code>') },
    { n: 8, part: '§5.6 消融', title: '层数越多越细；加噪声会怎样', sub: '对照图 17、图 18，都是真仿真器跑的', dur: 15, cam: [0, 1.3, 40, [1.4, 5.2, 0]],
      html: LIVE + '<p>同一段没见过的参考（粉），用前 1、2、3、4 层的码解码，都在真仿真器里跑（蓝）。这就是原文图 18 的玩具版：只用第一层时大形状对，细节缺失，层数多了贴上去。</p><p>原文图 17 的结论有两条：干净数据上连续 VAE 更准；加噪声后连续 VAE 明显变差，MoConVQ 基本不变。玩具复现了前一条，<b>没有</b>复现第二条的交叉：噪声下 4 层 VQ 和连续 VAE 差不多（6 个种子的表见精读页）。</p>' +
        toyB('玩具的编码器看 12 帧，本身有平滑作用，所以噪声不太会影响连续 VAE。不能用这一幕证明或否定原文图 17。') + src('§5.6 · 图 17 · 图 18') },
    { n: 9, part: '§4.2 交互控制', title: '式 14：用户输入和策略预测怎么混', sub: '拖目标点，或切速度', dur: 14, cam: [0, 0.82, 24, [0, 0.2, 0.6]],
      html: LIVE + '<p>高层策略 \\(v_k,g^\\pi_{k+1}=\\pi_{\\rm steering}(z_{k-1},g_k)\\)（式 11）是纯监督学习：先把数据集编码成 \\((z^*_k,g^*_k)\\)，再回归。不经过世界模型。这是它和 ControlVAE 任务策略最大的不同。</p><p>运行时 \\(g=(1-\\tau^\\gamma)\\odot g^\\pi+\\tau^\\gamma\\odot g^u\\)。\\(\\tau=[1/3,2/3,1]\\) 对应未来 0.3、0.6、0.9 秒。位置用 \\(\\gamma=0.5\\)，朝向用 \\(\\gamma=2\\)。下面算的就是这个公式：近处相信预测，远处相信用户；朝向比位置更晚才转向用户。</p>' +
        guess('灰色的 \\(g^\\pi\\) 是我手写的一条弧线，不是网络输出，因为式 14 只需要一个输入。混合结果是式 14 现算的。') + src('式 11 至 14 · §4.2 · §5.3 · 图 9') },
    { n: 10, part: '§4.3 MoConGPT', title: '两个方向的自回归：先按时间，再按层', sub: '从索引分布采样，解码回运动', dur: 16, cam: [0, 1.08, 33, [1.1, 6.2, 0]],
      html: LIVE + '<p>式 16：temporal 变换器 \\(f(I^{&lt;k})\\) 聚合过去的码，depth 变换器在同一时刻逐层预测 \\(I^k_d\\)。如果摊平成一条长序列，长度是 \\(K\\times N\\)，论文说代价按长度的平方增长。</p><p>下面网格的每一列是一个时刻，每一行是一层，亮的格子是正在预测的索引，橙线是条件。采样完送进解码器，下面那条是仿真器走出来的角度。</p>' +
        toyB('这里<b>没有变换器</b>：我用计数表估计 \\(p(I^k_d|I^{k-1}_d,I^k_{d-1})\\)，只是为了让“采索引 → 解码”真的跑起来。结构是式 16 的，模型不是。') + src('式 15 至 17 · 图 3 · §5.4 · 代码 <code>rq_trans_fixsum.py</code>') },
    { n: 11, part: '§4.4 接入大语言模型', title: '索引当文字：一串数字就是一段运动', sub: '切三个原文例子，数字都是原文的', dur: 15, cam: [0, 1.12, 34, [0, 6, 0]],
      html: LIVE + '<p>给 Claude-2 一个文件，1600 行，每行一句动作描述加上它的 VQ 索引（只用第 0 层）。不微调，直接问。模型回答一串数字，交给物理解码器。</p><p>一个索引是 4 帧，也就是 0.2 秒。所以“走很久”在附录 B.1 里是 4 遍 5 个索引，一共 4 秒。</p><p>解码这一步只用第 0 层，相当于原文图 17 的绿色那个模型（没有残差层），精度明显低于 8 层。</p>' +
        guess('方块摆放和每段的颜色是我画的。这里没有实际解码：我没有下载预训练权重，也没跑代码。数字和每段的说明全部抄自原文图 4 和附录 B。') + src('§4.4 · §5.5 · 图 4 · 图 12 · 图 13 · 附录 B') },
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
    if (window.MathJax?.typesetPromise) MathJax.typesetPromise([$('infoBody')]).catch(() => {});
  }
  let lastCap = null, lastLive = null;
  const cap = h => { if (h !== lastCap) { lastCap = h; $('cap').innerHTML = h; } };
  const live = rows => { const el = $('live'); if (!el) return; const h = dl(rows); if (h !== lastLive) { lastLive = h; el.innerHTML = '<p class="lt">现算</p>' + h; } };

  /* ---------- small chart in the panel: one log or linear y axis, 2px lines, legend, hover read-out ---------- */
  const PAL = () => matchMedia('(prefers-color-scheme: light)').matches ? ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'] : ['#3987e5', '#d95926', '#199e70', '#c98500'];
  let chartState = null;
  function drawChart(hx) {
    const c = chartState, cv = $('mini'); if (!c || !cv) return;
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const W = cv.clientWidth || 260, H = 150, dpr = Math.min(2, devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
    const m = { l: 42, r: 8, t: 8, b: 26 }, pw = W - m.l - m.r, ph = H - m.t - m.b, n = c.series[0].data.length;
    const all = c.series.flatMap(s => s.data).filter(v => v != null && isFinite(v) && (!c.log || v > 0));
    let y0 = Math.min(...all), y1 = Math.max(...all); const tf = v => c.log ? Math.log10(v) : v;
    if (c.log) { y0 = Math.pow(10, Math.floor(Math.log10(y0))); y1 = Math.pow(10, Math.ceil(Math.log10(y1))); } else { y0 = 0; y1 *= 1.1; }
    const X = i => m.l + pw * i / Math.max(1, n - 1), Y = v => m.t + ph * (1 - (tf(v) - tf(y0)) / (tf(y1) - tf(y0)));
    g.font = '11px ' + (css('--font-mono') || 'monospace'); g.fillStyle = css('--muted'); g.strokeStyle = css('--line'); g.lineWidth = 1; g.textBaseline = 'middle'; g.textAlign = 'right';
    const ticks = []; if (c.log) for (let e = Math.log10(y0); e <= Math.log10(y1) + 1e-6; e++) ticks.push(Math.pow(10, e)); else for (let k = 0; k <= 3; k++) ticks.push(y1 * k / 3);
    ticks.forEach(t => { const y = Y(t); g.globalAlpha = 0.6; g.beginPath(); g.moveTo(m.l, y); g.lineTo(W - m.r, y); g.stroke(); g.globalAlpha = 1; g.fillText(c.log ? String(+t.toPrecision(1)) : t.toFixed(t < 1 ? 2 : 1), m.l - 4, y); });
    g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(c.xlabel, m.l + pw / 2, H - 13);
    const col = PAL();
    c.series.forEach((s, k) => { g.strokeStyle = col[k]; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath(); let on = false; s.data.forEach((v, i) => { if (v == null || !isFinite(v) || (c.log && v <= 0)) return; on ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)); on = true; }); g.stroke(); if (s.data.length < 12) { g.fillStyle = col[k]; s.data.forEach((v, i) => { if (v == null || !isFinite(v)) return; g.beginPath(); g.arc(X(i), Y(v), 3, 0, 7); g.fill(); }); } });
    const mk = hx != null ? hx : c.mark;
    if (mk != null) { g.strokeStyle = css('--muted'); g.lineWidth = 1; g.beginPath(); g.moveTo(X(mk), m.t); g.lineTo(X(mk), m.t + ph); g.stroke(); }
    const i = mk != null ? clamp(Math.round(mk), 0, n - 1) : n - 1;
    $('miniLeg').innerHTML = c.series.map((s, k) => `<span><i style="background:${col[k]}"></i>${s.name} ${fx(s.data[i], 3)}</span>`).join('') + `<span class="mx">${c.xname} ${c.x ? c.x(i) : i}</span>`;
    cv.onpointermove = e => { const r = cv.getBoundingClientRect(); drawChart(clamp((e.clientX - r.left - m.l) / pw, 0, 1) * (n - 1)); };
    cv.onpointerleave = () => drawChart(null);
  }
  function chart(o) { chartState = o; const b = $('miniBox'); if (b) { b.hidden = !o; if (o) drawChart(null); } }
  const chartMark = i => { if (chartState && chartState.mark !== i) { chartState.mark = i; drawChart(null); } };

  /* ---------- 3D helpers ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0, phi: 0.85, dist: 33, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);
  let LABS = [], refDist = 33, PICKS = [], dragFn = null, dragPlane = null, dragInv = null, api = null;
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.0125) * refDist / 22, size: o.size || 26, pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  const paint = (m, color, k = 0) => { m.material.color.setHex(color); m.userData.c = hex3(color); glow(m, k); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.17) {
    const balls = []; for (let i = 0; i < n; i++) { const b = L.sphere(1, color, { emissive: color, seg: 10 }); b.material.emissiveIntensity = 0.55; G.add(b); balls.push(b); }
    return (pts, ph, on) => balls.forEach((b, i) => { b.visible = on > 0; if (on) { b.position.set(...along(pts, (ph + i / n) % 1)); b.scale.setScalar(r * on); } });
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.55, dashed: o.dashed }); G.add(l); return l; };
  function poly(G, n, color, op = 1, y = 0.05) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })); l.frustumCulled = false; G.add(l);
    l.userData.set = pts => { const A = g.attributes.position.array, m = Math.min(n, pts.length); for (let i = 0; i < m; i++) { A[3 * i] = pts[i][0]; A[3 * i + 1] = pts[i][1] ?? y; A[3 * i + 2] = pts[i][2]; } g.setDrawRange(0, m); g.attributes.position.needsUpdate = true; };
    return l;
  }
  function dots(G, n, size, color) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const c0 = hex3(color ?? 0xffffff), Ca = g.attributes.color.array; for (let i = 0; i < n; i++) Ca.set(c0, 3 * i);
    const m = new THREE.Points(g, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false })); m.frustumCulled = false; G.add(m);
    m.userData.set = (pts, cols) => { const A = g.attributes.position.array, q = Math.min(n, pts.length); for (let i = 0; i < q; i++) { A.set(pts[i], 3 * i); if (cols) Ca.set(hex3(cols[i]), 3 * i); } g.setDrawRange(0, q); g.attributes.position.needsUpdate = true; if (cols) g.attributes.color.needsUpdate = true; };
    return m;
  }
  const marker = (G, color, r = 0.2) => { const m = L.sphere(r, color, { emissive: color }); m.material.emissiveIntensity = 0.6; G.add(m); return m; };
  function bar(G, color, w = 0.5, d = 0.5) { const m = block(w, 1, d, color, [0, 0, 0], { edgeOpacity: 0.2 }); G.add(m); m.userData.at = (x, y0, z, h) => { const q = Math.max(0.001, h); m.scale.y = q; m.position.set(x, y0 + q / 2, z); }; return m; }
  function plane(G, x, z, half, op = 0.28) {
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(2 * half, 2 * half), new THREE.MeshBasicMaterial({ color: 0x223044, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }));
    hit.rotation.x = -Math.PI / 2; hit.position.set(x, 0, z); G.add(hit); const gr = L.grid(2 * half, 6); gr.position.set(x, 0.01, z); G.add(gr); return hit;
  }
  /* curve panel: time on x, value on y, standing up at depth z */
  const curve = (x0, w, y0, h, z, n, vmax = 1.8) => (i, v) => [x0 + w * i / (n - 1), y0 + h * clamp(v / vmax, -1, 1), z];
  function curveFrame(G, x0, w, y0, h, z, tag) {
    wire(G, [[x0, y0, z], [x0 + w, y0, z]], COL.dim, { opacity: 0.8 }); wire(G, [[x0, y0 - h, z], [x0, y0 + h, z]], COL.dim, { opacity: 0.8 });
    if (tag) G.add(lab(tag, [x0 - 1.1, y0, z], { size: 21 }));
  }

  /* ---------- real dependency arithmetic for the convolution stacks: interval per output, no drawing tricks ---------- */
  const RF = (function () {
    const iv = n => Array.from({ length: n }, (_, i) => [i, i]);
    const merge = (a, b) => a ? (b ? [Math.min(a[0], b[0]), Math.max(a[1], b[1])] : a) : b;
    function conv(d, k, s = 1, p = 0) { const n = d.length, m = Math.floor((n + 2 * p - (k - 1) - 1) / s) + 1, o = []; for (let i = 0; i < m; i++) { let q = null; for (let j = 0; j < k; j++) { const x = i * s + j - p; if (x >= 0 && x < n) q = merge(q, d[x]); } o.push(q); } return o; }
    function tconv(d, k, s, p) { const n = d.length, m = (n - 1) * s - 2 * p + k, o = new Array(m).fill(null); for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) { const x = i * s + j - p; if (x >= 0 && x < m) o[x] = merge(o[x], d[i]); } return o; }
    const res1 = d => conv(conv(d, 3, 1, 1), 1).map((q, i) => merge(q, d[i]));
    const res3 = d => res1(res1(res1(d)));
    /* mode 0 = released code (convvq.py), mode 1 = paper Table 5. Returns every level so the scene can draw them. */
    function encoder(T, mode) { const lv = []; let d = iv(T); if (mode === 1) d = conv(d, 3, 1, 1); for (let i = 0; i < 2; i++) { d = res3(conv(d, 4, 2, 1)); lv.push(d); } d = conv(d, 3, 1, 1); lv.push(d); return lv; }
    function decoder(K, mode) { const lv = []; let d = conv(iv(K), 3, 1, 1); for (let i = 0; i < 2; i++) { d = tconv(res3(d), 4, 2, 1); lv.push(d); } if (mode === 1) { d = res3(conv(d, 3, 1, 1)); d = conv(d, 3, 1, 1); } else { d = tconv(d, 3, 1, 1); d = conv(d, 3, 1, 1); d = res3(d); d = conv(d, 3, 1, 1); } lv.push(d); return lv; }
    /* top-level outputs expressed in level-1 and level-2 cells: run the remaining ops on those levels */
    function encUp(T) { const n1 = T >> 1, n2 = T >> 2, d2 = conv(iv(n2), 3, 1, 1), d1 = conv(res3(conv(iv(n1), 4, 2, 1)), 3, 1, 1); return [d1, d2]; }
    return { encoder, decoder, encUp };
  })();

  /* latent cloud: real encoder outputs of the toy */
  function cloud() {
    if (cache.cloud) return cache.cloud; const m = main(), P = [], r = Toy.RNG(77); for (let i = 0; i < 500; i++) P.push(m.A.E.f(Toy.winOf(m.D, 8 + r.int(m.D.N - 30))).y);
    let a = 1e9, b = -1e9, c = 1e9, e = -1e9; for (const p of P) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); e = Math.max(e, p[1]); }
    const cx = (a + b) / 2, cy = (c + e) / 2, R = Math.max(b - a, e - c) / 2 * 1.12, seq = []; for (let k = 0; k < 90; k++) seq.push(m.A.E.f(Toy.winOf(m.D, 600 + 4 * k)).y);
    return cache.cloud = { P, cx, cy, R, seq };
  }
  const seqAt = (q, p) => { const n = q.length - 1, x = clamp(p, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i; return [q[i][0] * (1 - f) + q[i + 1][0] * f, q[i][1] * (1 - f) + q[i + 1][1] * f]; };

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    const y = 1.2, parts = [
      ['M', 2.8, 2.2, COL.data, [-16.5, y, 0], '参考动作 M\n24 帧', null],
      ['E', 3, 2.4, COL.enc, [-11.5, y, 0], '编码器 E\n1D 卷积', 1],
      ['D', 2.6, 2.2, COL.dec, [2, y, 0], 'Deconv\n码到每帧', 4],
      ['P', 2.6, 2.4, COL.pi, [7, y, 0], '策略 π\n20 Hz', 4],
      ['W', 2.8, 2.4, COL.wm, [12, y, 0], 'Sim / W\n120 Hz', 5],
      ['O', 2.2, 2.2, COL.data, [16.5, y, 0], 'M̃', null]];
    const q = {}; parts.forEach(([k, w, h, c, pos, t, go]) => { const m = block(w, h, 2.2, c, pos); q[k] = m; G.add(m); if (go != null) { m.userData.go = go; PICKS.push(m); } G.add(lab(t, [pos[0], pos[1] + h / 2 + 1.35, 0.4], { size: 22 })); });
    const qs_ = []; for (let i = 0; i < 4; i++) { const m = block(1.1, 2.4, 2.4 - i * 0.2, LAY[i], [-7 + i * 1.65, y, 0]); m.userData.go = i ? 3 : 2; PICKS.push(m); G.add(m); qs_.push(m); }
    G.add(lab('码本 VQ + RVQ 1…N', [-4.5, y + 2.5, 0.4], { size: 22 }));
    const pa = m => m.position.toArray(), P = [q.M, q.E, qs_[0], qs_[1], qs_[2], qs_[3], q.D, q.P, q.W, q.O].map(pa);
    for (let i = 0; i + 1 < P.length; i++) wire(G, [P[i], P[i + 1]], 0x8ea2c4);
    const fb = [[12, y - 1.2, 0], [12, y - 2.3, 0], [7, y - 2.3, 0], [7, y - 1.2, 0]]; wire(G, fb, COL.grad, { opacity: 0.8 }); G.add(lab('sₜ 自回归', [9.5, y - 3.1, 0], { size: 20 }));
    const tok = lab('索引 I = (122, 222, …, 77)', [-4.5, y - 2.6, 0.2], { size: 22, border: '#f2c14e' }); G.add(tok);
    const dn = [['跟踪：编码器 + 解码器', -11.5, 8], ['转向：出 v，再量化', -5.2, 3], ['MoConGPT：出索引', 0.8, 9], ['LLM：只用 I₀', 7, 10]].map(([t, x, g]) => { const m = block(5.2, 0.9, 1.5, 0x2b3650, [x, y + 6.2, -3]); m.userData.go = g; PICKS.push(m); G.add(m, lab(t, [x, y + 6.2, -2], { size: 21 })); wire(G, [[x, y + 5.7, -3], [-4.5, y + 1.3, 0]], 0xf2c14e, { opacity: 0.3 }); return m; });
    G.add(lab('下游任务接在码上，解码器冻结', [-2, y + 7.6, -3], { size: 22 }));
    const a = stream(G, 6, COL.code), b = stream(G, 6, COL.pi), c = stream(G, 3, COL.grad, 0.13);
    return { update(p) {
      const ph = p < 0.38 ? 0 : p < 0.76 ? 1 : 2, r = (p * 16) % 1;
      [...Object.values(q), ...qs_, ...dn].forEach(m => glow(m, 0));
      if (ph === 0) { a(P.slice(0, 6), r, 1); b([], 0, 0); c([], 0, 0); glow(q.E, .8); qs_.forEach((m, i) => glow(m, seg(p, .1 + i * .05, .2 + i * .05))); cap('<b>编码：</b>每 4 帧一个向量，逐层量化，变成一组索引'); }
      if (ph === 1) { a([], 0, 0); b(P.slice(5, 10), r, 1); c(fb, r, 1); glow(q.D, .7); glow(q.P, .9); glow(q.W, .9); cap('<b>解码：</b>π 每步看当前状态，动作交给仿真器。训练时仿真器换成 W，路径可导'); }
      if (ph === 2) { a([], 0, 0); b([], 0, 0); c([], 0, 0); dn.forEach((m, i) => { const k = seg(p, .78 + i * .04, .82 + i * .04); m.material.color.setHex(k > .5 ? 0x3a4a6b : 0x2b3650); }); cap('<b>下游：</b>同一套解码器接四种任务，各自在 v、z 或 I 上给输入'); }
    } };
  }

  /* ---------- scene 2: encoder, real receptive field ---------- */
  function s2(G) {
    G.position.x = 1.6; const Ts = [24, 96], T = Ts[U.t2], lv = RF.encoder(T, U.a2), Wd = 25, rowY = [0.2, 2.2, 4.2, 6.3], base = Array.from({ length: T }, (_, i) => [i, i]), up = RF.encUp(T);
    const rows = [base, lv[0], lv[1], lv[2]], cubes = rows.map((r, ri) => r.map((_, i) => { const w = Wd / r.length, m = block(Math.max(0.1, w * 0.86), ri === 3 ? 1.0 : 0.6, 1.2, ri === 3 ? COL.code : ri === 0 ? COL.data : COL.enc, [-Wd / 2 + (i + .5) * w, rowY[ri], 0], { edges: T < 30 }); G.add(m); return m; }));
    cubes[3].forEach((m, k) => { m.userData.fn = () => { U.sel2 = k; setPlay(false); api.update(pNow); }; PICKS.push(m); });
    [['帧 T=' + T, 0], ['↓2 + 3 残差', 1], ['↓2 + 3 残差', 2], ['码 K=' + rows[3].length + '\n768 维', 3]].forEach(([t, i]) => G.add(lab(t, [-Wd / 2 - 1.9, rowY[i], 0], { size: 20 })));
    const l1 = poly(G, 2, COL.code, 0.9), l2 = poly(G, 2, COL.code, 0.9), K = rows[3].length;
    return { ctl: [{ label: '窗口', items: ['T = 24（训练）', 'T = 96（流式）'], get: () => U.t2, set: i => { U.t2 = i; U.sel2 = null; go(cur, pNow); } }, { label: '结构', items: ['代码', '表 5'], get: () => U.a2, set: i => { U.a2 = i; U.sel2 = null; go(cur, pNow); } }],
      update(p) {
        const k = U.sel2 ?? (T > 30 ? clamp(Math.floor(K * .3 + p * K * .4), 0, K - 1) : clamp(Math.floor(p * K), 0, K - 1)), iv = rows[3][k];
        cubes.forEach((r, ri) => r.forEach((m, i) => { const on = ri === 3 ? i === k : (ri === 0 ? (i >= iv[0] && i <= iv[1]) : (up[ri - 1][k][0] <= i && i <= up[ri - 1][k][1])); glow(m, on ? 0.75 : 0); m.material.opacity = on ? 1 : 0.28; m.material.transparent = true; }));
        const x0 = -Wd / 2 + (iv[0] + .1) * Wd / T, x1 = -Wd / 2 + (iv[1] + .9) * Wd / T, cx = cubes[3][k].position.x; l1.userData.set([[x0, rowY[0] + .3, 0.65], [cx, rowY[3] - .5, 0.65]]); l2.userData.set([[x1, rowY[0] + .3, 0.65], [cx, rowY[3] - .5, 0.65]]);
        const n = iv[1] - iv[0] + 1, c0 = 4 * k + 2;
        live([['选中的码', `k = ${k} / ${K - 1}`], ['依赖的帧', `${iv[0]} … ${iv[1]}（共 ${n} 帧）`], ['时长（20 FPS）', fx(n / 20) + ' 秒'], ['码的中心之后还看', Math.max(0, iv[1] - c0 + 1) + ' 帧'], ['无限长输入的感受野', rfInf(U.a2) + ' 帧 = ' + fx(rfInf(U.a2) / 20, 2) + ' 秒']]);
        cap(T === 24 ? `<b>T = 24：</b>第 ${k} 个码依赖 ${n} 帧，也就是整段。点上面的金块换一个码` : `<b>流式：</b>第 ${k} 个码依赖 ${n} 帧（${fx(n / 20, 2)} 秒），比训练窗口 1.2 秒长`);
      } };
  }
  const rfInf = mode => { const lv = RF.encoder(400, mode)[2], c = lv[50]; return c[1] - c[0] + 1; };

  /* ---------- scene 3: VQ, nearest code, commitment ---------- */
  function s3(G) {
    const q = cloud(), Ks = [4, 16, 64, 256], Betas = [0.05, 0.25, 1], HALF = 7.2, pz = 0.8, sc = HALF / q.R, w = v => [(v[0] - q.cx) * sc, 0, pz - (v[1] - q.cy) * sc], inv = pt => [pt.x / sc + q.cx, -(pt.z - pz) / sc + q.cy];
    const hit = plane(G, 0, pz, HALF, 0.12); dragPlane = hit; dragInv = inv; dragFn = v => { U.v3 = v; };
    const geo = new THREE.PlaneGeometry(2 * HALF, 2 * HALF, 110, 110); geo.rotateX(-Math.PI / 2);
    const terr = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, transparent: true, opacity: 0.86, side: THREE.DoubleSide })); terr.position.set(0, 0, pz); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3)); G.add(terr);
    const dp = dots(G, 500, 0.2, COL.data); dp.userData.set(q.P.map(v => { const a = w(v); return [a[0], 0.08, a[2]]; }));
    const codes = dots(G, 256, 0.55, COL.code); codes.material.depthTest = false; codes.renderOrder = 5; const V = marker(G, COL.white, 0.26), Zm = marker(G, COL.grad, 0.3), link = poly(G, 2, COL.grad, 1), drop = poly(G, 2, COL.white, 0.7), ar = poly(G, 2, COL.grad, 1);
    G.add(lab('v₁', [HALF + 0.6, 0.1, pz], { size: 21 }), lab('v₂', [0, 0.1, pz + HALF + 0.7], { size: 21 }), lab('高度 = min d²，各 K 同一比例', [-HALF + 3.2, 0.1, pz + HALF + 0.8], { size: 20 }));
    let C = null, key = '', vs = 1; const r = Toy.RNG(5);
    function rebuild() {
      const k = U.k3 + '|' + U.ema; if (k === key) return; if (!cache['km' + U.k3]) cache['km' + U.k3] = Toy.kmeans(q.P, Ks[U.k3], Toy.RNG(3 + U.k3), 16); C = cache['km' + U.k3].map(c => c.slice());
      for (const e of EMA) if (e.k === U.k3) { const c = C[e.i]; for (let s = 0; s < 20; s++) { c[0] = 0.99 * c[0] + 0.01 * e.v[0]; c[1] = 0.99 * c[1] + 0.01 * e.v[1]; } }
      key = k; const P = geo.attributes.position, Ca = geo.attributes.color; vs = 1.7 / maxD0();
      for (let i = 0; i < P.count; i++) { const x = P.getX(i) / sc + q.cx, y = -P.getZ(i) / sc + q.cy; let b = 1e18; for (const c of C) { const e = (c[0] - x) ** 2 + (c[1] - y) ** 2; if (e < b) b = e; } const h = Math.min(2.4, b * vs); P.setY(i, h); const t = Math.pow(h / 2.4, 0.6); Ca.setXYZ(i, 0.13 + 0.15 * t, 0.26 + 0.42 * t, 0.42 + 0.34 * t); }
      P.needsUpdate = true; Ca.needsUpdate = true; geo.computeVertexNormals();
      codes.userData.set(C.map(c => { const a = w(c); return [a[0], 0.16, a[2]]; }));
      dp.userData.set(q.P.map(v => { let b = 1e18; for (const c of C) { const e = (c[0] - v[0]) ** 2 + (c[1] - v[1]) ** 2; if (e < b) b = e; } const a = w(v); return [a[0], Math.min(2.4, b * vs) + 0.04, a[2]]; }));
      /* mean squared distance on the cloud, for all codebook sizes */
      chart({ log: true, xlabel: '码本大小 K', xname: 'K =', x: i => Ks[i], mark: U.k3, series: [{ name: '平均 d²', data: Ks.map((K0, i) => meanD(i)) }, { name: 'K·d²/10', data: Ks.map((K0, i) => meanD(i) * K0 / 10) }] });
    }
    function maxD0() { if (cache.mx0) return cache.mx0; if (!cache.km0) cache.km0 = Toy.kmeans(q.P, 4, Toy.RNG(3), 16); let m0 = 0; for (const p of q.P) { let b = 1e18; for (const c of cache.km0) { const e = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2; if (e < b) b = e; } m0 = Math.max(m0, b); } return cache.mx0 = m0; }
    function meanD(i) { const kk = 'md' + i; if (cache[kk] != null) return cache[kk]; if (!cache['km' + i]) cache['km' + i] = Toy.kmeans(q.P, Ks[i], Toy.RNG(3 + i), 16); const CC = cache['km' + i]; let s = 0; for (const p of q.P) { let b = 1e18; for (const c of CC) { const e = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2; if (e < b) b = e; } s += b; } return cache[kk] = s / q.P.length; }
    const nearest = v => { let b = 1e18, bi = 0; C.forEach((c, i) => { const e = (c[0] - v[0]) ** 2 + (c[1] - v[1]) ** 2; if (e < b) { b = e; bi = i; } }); return [bi, b]; };
    let curV = null, curI = 0;
    return { ctl: [{ label: '码本 K', items: ['4', '16', '64', '256'], get: () => U.k3, set: i => { U.k3 = i; } }, { label: 'β₁', items: ['0.05（代码）', '0.25（VQ-VAE 原文）', '1'], get: () => U.b3, set: i => { U.b3 = i; } }, { label: '', items: ['EMA 拉 20 次', '清除'], get: () => -1, set: i => { if (i === 0 && curV) { EMA.push({ k: U.k3, i: curI, v: curV.slice() }); U.ema++; } else if (i === 1) { EMA.length = 0; U.ema++; U.v3 = null; } } }],
      onShow() { key = ''; rebuild(); },
      update(p) {
        rebuild(); const v = U.v3 || seqAt(q.seq.slice(0, 50), p), [i, d2] = nearest(v), c = C[i], b1 = Betas[U.b3], a = w(v), z = w(c), h = Math.min(2.4, d2 * vs); curV = v; curI = i;
        V.position.set(a[0], h + 0.25, a[2]); Zm.position.set(z[0], 0.25, z[2]); link.userData.set([[a[0], 0.2, a[2]], [z[0], 0.2, z[2]]]); drop.userData.set([[a[0], 0.2, a[2]], [a[0], h + 0.25, a[2]]]);
        const gr = [2 * b1 * (v[0] - c[0]), 2 * b1 * (v[1] - c[1])]; ar.visible = false;
        live([['K / 每个索引的比特', Ks[U.k3] + ' / ' + fx(Math.log2(Ks[U.k3]), 0)], ['v', vv(v)], ['最近的码 i', String(i)], ['z_i', vv(c)], ['d² = ‖v − z‖²', fx(d2, 4)], ['承诺项 β₁d²', fx(b1 * d2, 4)], ['∂承诺项/∂v', vv(gr, 3)], ['VQ 目标 ‖sg(v) − z‖²', fx(d2, 4)], ['整批平均 d²', fx(meanD(U.k3), 4)]]);
        cap(U.v3 ? `最近的码是第 ${i} 个。承诺项 = ${fx(b1, 2)} × ${fx(d2, 3)} = <b>${fx(b1 * d2, 3)}</b>。切 K 看地形压平` : '白点是一段真实动作的编码器输出在隐空间里走。橙线连到最近的码，<b>拖平面放自己的点</b>');
      } };
  }
  const EMA = [];

  /* ---------- scene 4: residual VQ ---------- */
  function s4(G) {
    const q = cloud(), Ks = [2, 4, 8, 16], Ls = [1, 2, 4, 8], HALF = 3.6, X = [-13.2, -4.4, 4.4, 13.2];
    const planes = X.map((x, i) => { const h = plane(G, x, 0, HALF, 0.3); G.add(lab(i ? `RVQ ${i}` : 'VQ（第 0 层）', [x, 0.1, HALF + 0.9], { size: 22, color: '#' + LAY[i].toString(16).padStart(6, '0') })); return h; });
    dragPlane = planes[0]; const s0 = HALF / q.R, inv = pt => [(pt.x - X[0]) / s0 + q.cx, -pt.z / s0 + q.cy]; dragFn = v => { U.v4 = v; }; dragInv = inv;
    const dp = dots(G, 500, 0.12, COL.data); dp.userData.set(q.P.map(v => [X[0] + (v[0] - q.cx) * s0, 0.05, -(v[1] - q.cy) * s0]));
    const codeDots = X.map((_, i) => dots(G, 16, 0.42, LAY[i])), Rm = X.map(() => marker(G, COL.white, 0.17)), Zm = X.map(() => marker(G, COL.grad, 0.2)), Link = X.map(() => poly(G, 2, COL.grad, 1)), Next = X.slice(0, 3).map(() => poly(G, 2, 0xffffff, 0.35)), Bars = X.map((x, i) => bar(G, LAY[i], 0.7, 0.7)), zoomL = X.map((x, i) => { const s = lab(' ', [x, 0.1, -HALF - 0.7], { size: 19 }); return s; });
    const Zsum = marker(G, COL.pi, 0.17); let key = '', B = null, zlab = [];
    function rebuild() {
      const K = Ks[U.k4], Lk = Ls[U.l4], k = K + '|' + Lk; if (k === key) return; key = k; const ck = 'rb' + K; if (!cache[ck]) cache[ck] = Toy.residualBooks(q.P, K, 8, Toy.RNG(9)); B = cache[ck];
      /* zoom per layer = residual radius at that layer */
      zlab = []; let R = q.P.map(p => [p[0] - q.cx, p[1] - q.cy]); const errs = []; R = q.P.map(p => p.slice());
      for (let d = 0; d < 8; d++) { const C = B[d]; let e = 0, mx = 0; R = R.map(p => { let b = 1e18, bi = 0; C.forEach((c, i) => { const q2 = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2; if (q2 < b) { b = q2; bi = i; } }); if (d < 4) mx = Math.max(mx, Math.hypot(p[0], p[1])); return [p[0] - C[bi][0], p[1] - C[bi][1]]; }); for (const p of R) e += p[0] ** 2 + p[1] ** 2; errs.push(e / R.length); zlab.push(d === 0 ? s0 : HALF / Math.max(1e-3, mx * 1.08)); }
      const flat = []; for (let d = 1; d <= 8; d++) { const N = Math.pow(K, d); if (N > 256) { flat.push(null); continue; } const fk = 'fl' + N; if (cache[fk] == null) { const CC = Toy.kmeans(q.P, N, Toy.RNG(13 + N), 14); let s = 0; for (const p of q.P) { let b = 1e18; for (const c of CC) { const e = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2; if (e < b) b = e; } s += b; } cache[fk] = s / q.P.length; } flat.push(cache[fk]); }
      chart({ log: true, xlabel: '用到第几层', xname: '层数', x: i => i + 1, mark: Lk - 1, series: [{ name: 'RVQ 平均‖r‖²', data: errs }, { name: '同比特单层 VQ', data: flat }] });
      X.forEach((x, d) => { const on = d < Lk, sc = zlab[d], off = d === 0 ? [q.cx, q.cy] : [0, 0]; codeDots[d].userData.set(B[d].slice(0, K).map(c => [x + (c[0] - off[0]) * sc, 0.1, -(c[1] - off[1]) * sc])); codeDots[d].visible = on; planes[d].material.opacity = on ? 0.3 : 0.08; G.remove(zoomL[d]); LABS = LABS.filter(l => l !== zoomL[d]); zoomL[d] = lab(d ? `放大 ×${fx(sc / s0, 1)}` : '比例 ×1', [x, 0.1, -HALF - 0.7], { size: 19 }); G.add(zoomL[d]); });
    }
    return { ctl: [{ label: '每层 K', items: ['2', '4', '8', '16'], get: () => U.k4, set: i => { U.k4 = i; U.drop = 0; } }, { label: '层数 L', items: ['1', '2', '4', '8'], get: () => U.l4, set: i => { U.l4 = i; U.drop = 0; } }, { label: '', items: ['抽前缀', '用全部', '清除 v'], get: () => -1, set: i => { if (i === 0) { const r = Toy.RNG(Date.now() % 1e6 | 0); U.drop = 1 + r.int(Ls[U.l4]); } else if (i === 1) U.drop = 0; else U.v4 = null; } }],
      onShow() { key = ''; rebuild(); },
      update(p) {
        rebuild(); const K = Ks[U.k4], Lk = Ls[U.l4], use = U.drop || Lk, v = U.v4 || seqAt(q.seq.slice(0, 50), p), Q = Toy.quant(B, v, use), full = Toy.quant(B, v, Lk);
        X.forEach((x, d) => { const c = Q.chain[d], on = d < use, sc = zlab[d], off = d === 0 ? [q.cx, q.cy] : [0, 0]; Rm[d].visible = Zm[d].visible = Link[d].visible = Bars[d].visible = on; if (d < 3) Next[d].visible = on && d + 1 < use; if (!on) return;
          const w = a => [x + (a[0] - off[0]) * sc, 0.25, -(a[1] - off[1]) * sc], rw = w(c.r), zw = w(c.c); Rm[d].position.set(...rw); Zm[d].position.set(...zw); Link[d].userData.set([rw, zw]);
          const nr = Math.hypot(c.r[0] - c.c[0], c.r[1] - c.c[1]); Bars[d].userData.at(x + HALF + 0.65, 0, 0, Math.max(0.05, 5.5 * nr / q.R * 1.8)); });
        for (let d = 0; d < 3; d++) if (d + 1 < use) { const c = Q.chain[d], c2 = Q.chain[d + 1], sc = zlab[d], off = d === 0 ? [q.cx, q.cy] : [0, 0]; Next[d].userData.set([[X[d] + (c.r[0] - off[0]) * sc, 0.25, -(c.r[1] - off[1]) * sc], [X[d + 1] + c2.r[0] * zlab[d + 1], 0.25, -c2.r[1] * zlab[d + 1]]]); }
        Zsum.position.set(X[0] + (Q.z[0] - q.cx) * s0, 0.32, -(Q.z[1] - q.cy) * s0);
        const com = 0.05 * Q.chain.reduce((a, c) => a + c.d2, 0), err = Q.rest[0] ** 2 + Q.rest[1] ** 2, cp = Math.pow(K, Lk);
        live([['索引元组 I', '(' + Q.I.join(', ') + ')'], ['用到的层', use + (U.drop ? '（量化器 dropout 抽到）' : '')], ['‖v − Σz‖²', fx(err, 5)], ['承诺项求和（β₁ = 0.05）', fx(com, 4)], ['组合数 K^L', cp > 1e6 ? cp.toExponential(2) : String(cp)], ['比特 / 码向量个数', fx(Math.log2(cp), 0) + ' / ' + K * Lk], ['同比特单层 VQ 要几个码', cp > 1e6 ? cp.toExponential(2) : String(cp)]]);
        cap(U.drop ? `<b>量化器 dropout：</b>这次只用前 ${use} 层。绿球是重建，白球是 v` : '第 0 层看 v，后面每层只看上一层的残差。<b>拖第一个平面</b>放 v，绿球是累加的重建');
      } };
  }

  /* ---------- scene 5: decoder clocks and dependency ---------- */
  function s5(G) {
    G.position.x = 1.6; const Kn = 30, lv = RF.decoder(Kn, U.a5), Wd = 26, rowY = [6.4, 4.3, 2.4], lastLv = lv[lv.length - 1], Tn = lastLv.length;
    const codes = Array.from({ length: Kn }, (_, i) => { const m = block(Wd / Kn * .86, 0.9, 1.1, COL.code, [-Wd / 2 + (i + .5) * Wd / Kn, rowY[0], 0]); G.add(m); return m; });
    const frames = Array.from({ length: Tn }, (_, i) => { const m = block(Wd / Tn * .8, 0.6, 1.1, COL.dec, [-Wd / 2 + (i + .5) * Wd / Tn, rowY[1], 0], { edges: false }); G.add(m); return m; });
    G.add(lab('码 z\n5 Hz', [-Wd / 2 - 1.9, rowY[0], 0], { size: 21 }), lab('uₜ\n20 Hz', [-Wd / 2 - 1.9, rowY[1], 0], { size: 21 }));
    const expert = Array.from({ length: 6 }, (_, i) => { const m = block(0.85, 0.85, 1.1, COL.pi, [-11.2 + i * 1.05, 1.2, 0]); G.add(m); return m; }); G.add(lab('π：6 个专家 + 门控', [-8.6, 2.5, 0.2], { size: 21 }));
    const pd = block(3, 1, 1.1, COL.wm, [-1.9, 1.2, 0]); G.add(pd, lab('PD（式 7）', [-1.9, 2.5, 0.2], { size: 21 }));
    const ticks = Array.from({ length: 24 }, (_, i) => { const m = block(0.34, 0.8, 0.8, COL.sim, [1.6 + i * 0.47, 1.2, 0], { edges: false }); G.add(m); return m; });
    G.add(lab('一个码 = 4 帧 = 24 个仿真步', [7, 2.5, 0.2], { size: 21 }));
    const b0 = poly(G, 2, COL.grad, .9), b1 = poly(G, 2, COL.grad, .9);
    return { ctl: [{ label: '结构', items: ['代码', '表 5'], get: () => U.a5, set: i => { U.a5 = i; go(cur, pNow); } }],
      update(p) {
        const t = clamp(Math.floor(Tn * (0.42 + 0.2 * p)), 0, Tn - 1), iv = lastLv[t], kc = Math.floor(t / 4), fut = iv[1] - kc, pas = kc - iv[0];
        codes.forEach((m, i) => { const on = i >= iv[0] && i <= iv[1]; paint(m, i > kc && on ? COL.grad : COL.code, on ? 0.6 : 0); m.material.transparent = true; m.material.opacity = on ? 1 : 0.25; });
        frames.forEach((m, i) => { const me = i === t; glow(m, me ? 1 : 0); m.material.transparent = true; m.material.opacity = me || Math.floor(i / 4) === kc ? 1 : 0.3; m.scale.y = me ? 1.8 : 1; });
        const fx0 = frames[t].position.x; b0.userData.set([[fx0, rowY[1] + .4, .6], [codes[iv[0]].position.x, rowY[0] - .5, .6]]); b1.userData.set([[fx0, rowY[1] + .4, .6], [codes[iv[1]].position.x, rowY[0] - .5, .6]]);
        const st = Math.floor(((p * 40) % 1) * 24); ticks.forEach((m, i) => { const pol = i % 6 === 0; paint(m, pol ? COL.pi : COL.sim, i === st ? 1 : 0); m.scale.y = pol ? 1.4 : 1; });
        expert.forEach((m, i) => glow(m, 0.25 + 0.3 * Math.sin(i * 1.7 + p * 9) ** 2));
        live([['帧 t', String(t)], ['当前码', 'k = ' + kc], ['依赖的码', `${iv[0]} … ${iv[1]}（${iv[1] - iv[0] + 1} 个）`], ['过去 / 未来', pas + ' / ' + fut + ' 个码'], ['未来时长（5 Hz）', fx(fut * 0.2, 1) + ' 秒（上界）'], ['编码器也要看未来，加起来', fx((fut * 4 + rfFutureFrames(U.a5)) / 20, 1) + ' 秒（上界）']]);
        cap(`第 ${t} 帧依赖 ${iv[1] - iv[0] + 1} 个码，其中 <b>${fut} 个在未来</b>（橙）。下面：浅绿是策略更新，灰色是 PD 保持目标时的仿真步`);
      } };
  }
  const rfFutureFrames = mode => { const lv = RF.encoder(400, mode)[2], k = 50; return lv[k][1] - (4 * k + 2) + 1; };

  /* ---------- scene 6: world model fit ---------- */
  function s6(G) {
    const m = main(), A = m.A, Hs = [8, 24, 60], x0 = -15.5, W = 20, y0 = 3.2, h = 3, N = 60; curveFrame(G, x0, W, y0, h, 0);
    G.add(lab('θ₁（rad）', [x0 - 1.4, y0 + h + 0.3, 0], { size: 20 }), lab('时间，20 Hz →', [x0 + W - 2, y0 - h - 0.5, 0], { size: 20 }));
    const f = curve(x0, W, y0, h, 0, N + 1, 1.25), gs = poly(G, N + 1, COL.sim, 1), gw = poly(G, N + 1, COL.pi, 1), head = marker(G, COL.pi, 0.17);
    /* a fixed action sequence: the final policy tracking an unseen clip, in the true simulator */
    const Te = m.Test, o = 300, tr = Toy.track(A, Te, o, N, 4, Toy.st0(Te, o));
    gs.userData.set(tr.out.map((s, i) => f(i, s[0])));
    const Rx = 10.8, n = 40, slots = Array.from({ length: n }, (_, i) => { const a = i / n * 2 * Math.PI, mm = block(0.62, 0.55, 0.9, COL.buf || 0x9d8cff, [Rx + 3.4 * Math.cos(a), 3.2, 3.4 * Math.sin(a)], { edges: false }); mm.rotation.y = -a; mm.userData.c = hex3(0x9d8cff); G.add(mm); return mm; });
    G.add(lab('缓存（先进先出）', [Rx, 3.2, 0], { size: 21 }), lab('灰 = 仿真器\n绿 = W 开环', [x0 + W - 2.4, y0 + h + 0.4, 0], { size: 20 }));
    const Wn = Object.create(Toy.MLP.prototype); Object.assign(Wn, A.W);
    chart({ log: false, xlabel: '训练轮 →', xname: '轮', mark: 0, series: [{ name: '式 5（L1）', data: m.log.map(l => l.Lw) }] });
    return { ctl: [{ label: '开环步数', items: ['8（代码 T_w）', '24', '60'], get: () => U.h6, set: i => { U.h6 = i; } }],
      onShow() { chart({ log: false, xlabel: '训练轮 →', xname: '轮', mark: 0, series: [{ name: '式 5（L1）', data: m.log.map(l => l.Lw) }] }); },
      update(p) {
        const si = clamp(Math.floor(p * m.snaps.length), 0, m.snaps.length - 1), sn = m.snaps[si]; Wn.p = sn.W; const H = Hs[U.h6], w = { W: Wn }; let s = tr.out[0]; const path = [f(0, s[0])]; let err = 0; const per = [];
        for (let t = 0; t < H; t++) { s = Toy.stepW(s, Toy.fW(w, s, tr.act[t]).y); path.push(f(t + 1, clamp(s[0], -4, 4))); const e = (Math.abs(s[0] - tr.out[t + 1][0]) + Math.abs(s[2] - tr.out[t + 1][2])) / 2; err += e; per.push(e); }
        gw.userData.set(path); head.position.set(...path[path.length - 1]);
        const fill = Math.min(1, (sn.e + 1) * 6 / 100), hd = Math.floor((sn.e * 6) % n); slots.forEach((mm, i) => { const on = i < fill * n; mm.material.transparent = true; mm.material.opacity = on ? 1 : 0.2; glow(mm, on && ((i - hd + n) % n) < 4 ? 0.9 : on ? 0.2 : 0); });
        chartMark(sn.e);
        live([['训练轮', sn.e + ' / 149'], ['开环步数', H + ' 步 = ' + fx(H * .05, 2) + ' 秒'], ['平均 |θ 误差|（两关节）', fx(err / H, 4) + ' rad'], ['末步 |θ 误差|', fx(per[H - 1], 4) + ' rad'], ['缓存已满', fx(fill * 100, 0) + '%（玩具 100 段）']]);
        cap(`第 ${sn.e} 轮的 W 重放同一串动作，<b>绿线</b>开环滚 ${H} 步。灰线是仿真器的结果`);
      } };
  }

  /* ---------- scene 7: training through W, straight-through ---------- */
  function s7(G) {
    const Bt = [0, 0.05, 1], y = 0.6, Ex = -17, Qx = -12.2, cx0 = -7.6, cw = 23.4, Tn = Toy.T;
    const E_ = block(2.8, 2.0, 2, COL.enc, [Ex, y + .4, 0]), Q_ = block(2.8, 2.0, 2, COL.code, [Qx, y + .4, 0]); G.add(E_, Q_, lab('E', [Ex, y + 2, .4], { size: 24 }), lab('量化 + 直通', [Qx, y + 2, .4], { size: 22 }));
    const cells = Array.from({ length: Tn }, (_, i) => { const a = block(.75, .6, 1.1, COL.pi, [cx0 + cw * i / (Tn - 1), y - .1, -.1], { edges: false }), b = block(.75, .6, 1.1, COL.wm, [cx0 + cw * i / (Tn - 1), y + .55, -.1], { edges: false }); G.add(a, b); return [a, b]; });
    G.add(lab('π + W，滚 24 帧（W 不更新）', [cx0 + cw / 2 - 2, y - 1.2, .8], { size: 21 }));
    const bars = cells.map(() => bar(G, COL.grad, .55, .55)), bZ = bar(G, COL.grad, .9, .9), bC = bar(G, COL.code, .9, .9), bE = bar(G, COL.grad, .9, .9), bE2 = bar(G, COL.code, .9, .9);
    const P = [[Ex, y, 0], [Qx, y, 0], [cx0, y, 0], [cx0 + cw, y, 0]]; wire(G, P, 0x8ea2c4, { opacity: .4 }); const fwd = stream(G, 6, COL.pi), bak = stream(G, 6, COL.grad);
    const cy = 9.8, cz = -1.2, chh = 2.4, f = curve(cx0, cw, cy, chh, cz, Tn + 1, 1.25); curveFrame(G, cx0, cw, cy, chh, cz);
    const gr = poly(G, Tn + 1, COL.data, 1), gw = poly(G, Tn + 1, COL.pi, 1), gs = poly(G, Tn + 1, COL.sim, 1);
    G.add(lab('关节 1\n粉 = 参考 M\n绿 = W 里滚出的 M̃\n灰 = 同样动作进仿真器', [-13.2, cy + 0.2, cz], { size: 20 }));
    const key = () => U.st7 === 1 ? { st: false } : U.b7 === 1 ? {} : { beta: Bt[U.b7] };
    let R = null, m = null, simP = null, e = 0;
    function rec() {
      m = M(key()); const D = m.Test; let o = 200, br = 0; for (let q = 40; q < 1400; q += 12) { let a0 = 9, a1 = -9; for (let i = 0; i <= Tn; i++) { a0 = Math.min(a0, D.th[q + i]); a1 = Math.max(a1, D.th[q + i]); } if (a1 - a0 > br) { br = a1 - a0; o = q; } } R = Toy.rollout(m.A, D, o, 4, { beta: Bt[U.b7], st: U.st7 === 0 });
      let s = R.path[0]; simP = [s]; for (let t = 0; t < Tn; t++) { s = Toy.sim(s, R.tape[t].a); simP.push(s); } e = 0; for (let t = 0; t <= Tn; t++) e += (Math.abs(simP[t][0] - R.path[t][0]) + Math.abs(simP[t][2] - R.path[t][2])) / 2; e /= Tn + 1;
      gr.userData.set(Array.from({ length: Tn + 1 }, (_, i) => f(i, D.th[o + i]))); gw.userData.set(R.path.map((s2, i) => f(i, s2[0]))); gs.userData.set(simP.map((s2, i) => f(i, s2[0])));
      const base = M(), alt = U.st7 === 1 ? M({ st: false }) : (U.b7 !== 1 ? M({ beta: Bt[U.b7] }) : null);
      chart({ log: false, xlabel: '训练轮 →', xname: '轮', series: alt ? [{ name: '默认 L_rec', data: base.log.map(l => l.Lr) }, { name: U.st7 ? '无直通 L_rec' : `β₁=${Bt[U.b7]} L_rec`, data: alt.log.map(l => l.Lr) }] : [{ name: 'L_rec', data: base.log.map(l => l.Lr) }, { name: 'L_c × 10', data: base.log.map(l => l.Lc * 10) }] });
    }
    rec();
    return { ctl: [{ label: '直通', items: ['开', '关'], get: () => U.st7, set: i => { U.st7 = i; } }, { label: 'β₁', items: ['0', '0.05（代码）', '1'], get: () => U.b7, set: i => { U.b7 = i; } }],
      onShow: rec,
      update(p) {
        const ph = p < 0.42 ? 0 : 1, q = (p * 14) % 1, mxg = Math.max(...R.gu, 1e-6), reveal = ph === 0 ? 0 : seg(p, .42, .92);
        cells.forEach((c, i) => { const act = ph === 0 ? (i / Tn <= p / .42) : 1; glow(c[0], act * .5); glow(c[1], act * .5); const on = (1 - i / (Tn - 1)) <= reveal + 1e-6; bars[i].visible = on; bars[i].userData.at(c[0].position.x, y + 1, 0, 3.2 * R.gu[i] / mxg); });
        const gz = R.gradZ.reduce((a, b) => a + b) / R.gradZ.length, gc = R.gradC.reduce((a, b) => a + b) / R.gradC.length, sc = 3.2 / Math.max(gz, gc, 1e-6), showQ = reveal > .95;
        bZ.visible = bC.visible = showQ; bZ.userData.at(Qx - .55, y + 1.5, -1.3, gz * sc); bC.userData.at(Qx + .55, y + 1.5, -1.3, gc * sc);
        const toE = U.st7 === 0; bE.visible = showQ && toE; bE2.visible = showQ; bE.userData.at(Ex - .55, y + 1.5, -1.3, gz * sc); bE2.userData.at(Ex + .55, y + 1.5, -1.3, gc * sc);
        glow(E_, ph === 0 ? .5 : (toE ? .8 : .1)); glow(Q_, ph === 0 ? .5 : .7);
        if (ph === 0) { fwd(P, q, 1); bak([], 0, 0); cap('<b>前向：</b>编码、量化、在 W 里滚 24 帧。粉线是目标，绿线是 W 里的结果'); }
        else { fwd([], 0, 0); bak(toE ? P : P.slice(1), 1 - q, 1); cap(toE ? '<b>反向：</b>红柱 = 每帧的 ‖∂L/∂u‖。到量化这里梯度被原样抄给 v，编码器才知道动作错了' : '<b>直通关掉：</b>重建梯度停在量化。编码器只剩金色的承诺项，学不到东西（粉绿两线对不上）'); }
        live([['L_rec（式 6 第一项，这段）', fx(R.Lr / Tn, 4)], ['L_c = β₁ Σ d²（平均每码）', fx(R.Lc / Toy.K, 5)], ['‖∂L_rec/∂z‖ 平均', fx(gz, 3)], ['‖∂L_c/∂v‖ 平均', fx(gc, 3)], ['编码器收到', toE ? '两项（红 + 金）' : '只有金'], ['M̃_W 和 M̃_sim 的差（|θ| 平均）', fx(e, 4)]]);
      } };
  }

  /* ---------- scene 8: layers, noise ---------- */
  function s8(G) {
    const Sig = [0, 0.1, 0.3], Ks = [4, 16], x0 = -13, W = 23, n = 96, rows = [[1, 8.8], [2, 6.6], [3, 4.4], [4, 2.2], ['连续', 0]], h = 0.95, r3 = [];
    const f = rows.map(([, y]) => curve(x0, W, y, h, 0, n + 1, 1.2));
    rows.forEach(([t, y], i) => { curveFrame(G, x0, W, y, h, 0); r3.push({ ref: poly(G, n + 1, COL.data, .95), clean: poly(G, n + 1, 0xffffff, .45), out: poly(G, n + 1, COL.enc, 1), L: null }); });
    const Lb = rows.map(() => null), cur_ = rows.map(() => marker(G, COL.white, .13)); const AX = [14.4, 6.6, 0], axis = block(.5, .5, .5, 0x3b4660, AX); G.add(axis);
    const link = (c, t) => { const m = block(1.9, t, t, c, AX); G.add(m); return m; }, aS = [link(COL.enc, .3), link(COL.enc, .24)], aR = [link(COL.data, .12), link(COL.data, .12)]; G.add(lab('两关节臂\n蓝：4 层；粉：目标', [14.4, 9.6, 0], { size: 19 }));
    const pose = (A2, t1, t2) => { const e = [AX[0] + 1.9 * Math.sin(t1), AX[1] - 1.9 * Math.cos(t1)], a2 = t1 + t2; A2[0].rotation.z = t1 - Math.PI / 2; A2[0].position.set(AX[0] + .95 * Math.sin(t1), AX[1] - .95 * Math.cos(t1), 0); A2[1].rotation.z = a2 - Math.PI / 2; A2[1].position.set(e[0] + .95 * Math.sin(a2), e[1] - .95 * Math.cos(a2), 0); };
    let key = '', run = null;
    function rec() {
      const k = U.n8 + '|' + U.k8; if (k === key) return; key = k; const m = M({ Kc: Ks[U.k8] }), c = M({ cont: true, beta: 0.002 }), Te = m.Test, o = 500, r = Toy.RNG(42), sg = Sig[U.n8], Dn = Toy.noisy(Te, o, n, sg, r), th = Dn.th, s00 = Toy.st0(Te, o);
      const res = rows.map(([t]) => t === '连续' ? Toy.track(c.A, Dn, o, n, 1, s00) : Toy.track(m.A, Dn, o, n, t, s00));
      const err = res.map(x => { let e = 0; for (let t = 1; t <= n; t++) e += (Math.abs(x.out[t][0] - Te.th[o + t]) + Math.abs(x.out[t][2] - Te.th2[o + t])) / 2; return e / n; });
      rows.forEach(([t], i) => { r3[i].ref.userData.set(Array.from({ length: n + 1 }, (_, j) => f[i](j, th[o + j]))); r3[i].clean.userData.set(Array.from({ length: n + 1 }, (_, j) => f[i](j, Te.th[o + j]))); r3[i].out.userData.set(res[i].out.map((s, j) => f[i](j, s[0]))); if (Lb[i]) { G.remove(Lb[i]); LABS = LABS.filter(l => l !== Lb[i]); } Lb[i] = lab((t === '连续' ? '连续 VAE' : t + ' 层') + '\n误差 ' + fx(err[i], 3), [x0 - 2.2, rows[i][1], 0], { size: 19 }); G.add(Lb[i]); });
      const ev = (mm, L0, s) => { const ck = 'ev' + JSON.stringify(mm.cfg) + L0 + '|' + s; if (cache[ck] == null) cache[ck] = Toy.evalTrack(mm.A, mm.Test, L0, s); return cache[ck]; }, sv = Sig[U.n8] || 0.1;
      const a0 = [1, 2, 3, 4].map(L0 => ev(m, L0, 0)), a1 = [1, 2, 3, 4].map(L0 => ev(m, L0, sv)), c0 = ev(c, 1, 0), c1 = ev(c, 1, sv);
      chart({ log: false, xlabel: '用到的层数 →（60 段没见过的片段）', xname: '层', x: i => i + 1, series: [{ name: '干净', data: a0 }, { name: `σ=${sv}`, data: a1 }, { name: '连续 干净', data: [c0, c0, c0, c0] }, { name: `连续 σ=${sv}`, data: [c1, c1, c1, c1] }] });
      run = { res, err, th, Te, o, a0, a1, c0, c1 };
    }
    rec();
    return { ctl: [{ label: '输入噪声 σ', items: ['0', '0.1', '0.3'], get: () => U.n8, set: i => { U.n8 = i; } }, { label: '每层 K', items: ['4', '16'], get: () => U.k8, set: i => { U.k8 = i; } }],
      onShow() { key = ''; rec(); },
      update(p) {
        rec(); const t = Math.min(n, Math.floor(p * n)); rows.forEach((_, i) => cur_[i].position.set(...f[i](t, run.res[i].out[t][0])));
        const q = run.res[3].out[t]; pose(aS, q[0], q[2]); pose(aR, run.Te.th[run.o + t], run.Te.th2[run.o + t]);
        live([['这段的 |θ 误差|', run.err.slice(0, 4).map(e => fx(e, 3)).join(' / ') + '（1–4 层）'], ['连续 VAE', fx(run.err[4], 3)], ['60 段平均，干净', run.a0.map(e => fx(e, 3)).join(' / ')], ['连续，干净', fx(run.c0, 3)], ['60 段平均，噪声', run.a1.map(e => fx(e, 3)).join(' / ')], ['连续，噪声', fx(run.c1, 3)]]);
        cap(`<b>粉</b> = 编码器的输入，<b>淡白</b> = 干净的目标，<b>蓝</b> = 仿真器走出来的关节 1 角度。输入噪声 σ = ${Sig[U.n8]}，每层 K = ${Ks[U.k8]}`);
      } };
  }

  /* ---------- scene 9: Eq. 14 blending ---------- */
  function s9(G) {
    const HALF = 8; let sc = 2; const hit = plane(G, 0, 0, HALF, 0.22); dragPlane = hit; dragInv = pt => [pt.x / sc, -pt.z / sc]; dragFn = v => { U.goal = v; };
    const body = block(.36, 1, .36, COL.white, [0, .5, 0]); G.add(body);
    const tau = [1 / 3, 2 / 3, 1], gp = .5, gr = 2, Tm = [.3, .6, .9];
    const mk = (c, r) => tau.map(() => marker(G, c, r)), Pi_ = mk(COL.sim, .22), Uu = mk(COL.enc, .22), Bl = mk(COL.code, .3), lines = [poly(G, 4, COL.sim, 1), poly(G, 4, COL.enc, 1), poly(G, 4, COL.code, 1)], heads = tau.map(() => [poly(G, 2, COL.code, 1), poly(G, 2, COL.sim, .9), poly(G, 2, COL.enc, .9)]), goal = marker(G, COL.grad, .28);
    G.add(lab('灰 gᵖⁱ（手写）', [-5.2, .1, HALF + .7], { size: 21 }), lab('蓝 gᵘ（用户）', [0, .1, HALF + .7], { size: 21 }), lab('金 g（式 14）', [5.2, .1, HALF + .7], { size: 21 }));
    const pw = tau.map(t => Math.pow(t, gp)), rw = tau.map(t => Math.pow(t, gr));
    chart({ log: false, xlabel: '未来帧 0.3 / 0.6 / 0.9 秒', xname: 't =', x: i => Tm[i] + ' s', series: [{ name: 'τ^0.5 位置', data: pw }, { name: 'τ² 朝向', data: rw }] });
    return { ctl: [{ label: '速度', items: ['1.5 m/s', '3.5 m/s'], get: () => U.sp9, set: i => { U.sp9 = i; } }, { label: '', items: ['清除目标'], get: () => -1, set: () => { U.goal = null; } }],
      onShow() { chart({ log: false, xlabel: '未来帧 0.3 / 0.6 / 0.9 秒', xname: 't =', x: i => Tm[i] + ' s', series: [{ name: 'τ^0.5 位置', data: pw }, { name: 'τ² 朝向', data: rw }] }); },
      update(p) {
        const sp = [1.5, 3.5][U.sp9]; sc = 6.8 / (sp * .9); const ang = U.goal ? Math.atan2(U.goal[1], U.goal[0]) : Math.PI / 2 - 2.6 * L.ease(p), dir = [Math.cos(ang), Math.sin(ang)];
        const piP = Tm.map(t => { const a = 0.55 * t; return [sp * t * Math.cos(Math.PI / 2 - a), sp * t * Math.sin(Math.PI / 2 - a)]; }), piF = Tm.map(t => Math.PI / 2 - 0.55 * t * 2), uP = Tm.map(t => [sp * t * dir[0], sp * t * dir[1]]);
        const blP = tau.map((_, i) => [(1 - pw[i]) * piP[i][0] + pw[i] * uP[i][0], (1 - pw[i]) * piP[i][1] + pw[i] * uP[i][1]]), blF = tau.map((_, i) => { const a = [Math.cos(piF[i]), Math.sin(piF[i])]; return [(1 - rw[i]) * a[0] + rw[i] * dir[0], (1 - rw[i]) * a[1] + rw[i] * dir[1]]; });
        const w = (q, y = .2) => [q[0] * sc, y, -q[1] * sc]; [[piP, lines[0], Pi_], [uP, lines[1], Uu], [blP, lines[2], Bl]].forEach(([P, l, ms]) => { l.userData.set([[0, .2, 0], ...P.map(q => w(q))]); ms.forEach((m, i) => m.position.set(...w(P[i], .25))); });
        tau.forEach((_, i) => { const n = Math.hypot(...blF[i]) || 1, a = w(blP[i], .3); heads[i][0].userData.set([a, [a[0] + 1.3 * blF[i][0] / n, .3, a[2] - 1.3 * blF[i][1] / n]]); const b = w(piP[i], .3); heads[i][1].userData.set([b, [b[0] + .9 * Math.cos(piF[i]), .3, b[2] - .9 * Math.sin(piF[i])]]); const c = w(uP[i], .3); heads[i][2].userData.set([c, [c[0] + .9 * dir[0], .3, c[2] - .9 * dir[1]]]); });
        const gpos = U.goal || [dir[0] * 3.2, dir[1] * 3.2]; goal.position.set(...w(gpos, .3));
        const ag = i => fx(Math.atan2(blF[i][1], blF[i][0]) * 180 / Math.PI, 0) + '°';
        live([['τ', '1/3, 2/3, 1'], ['τ^0.5（位置）', pw.map(x => fx(x, 3)).join(', ')], ['τ²（朝向）', rw.map(x => fx(x, 3)).join(', ')], ['用户方向', fx(ang * 180 / Math.PI, 0) + '°'], ['g 位置 @0.9 s', vv(blP[2])], ['g 朝向 @0.3 / 0.6 / 0.9', ag(0) + ' / ' + ag(1) + ' / ' + ag(2)], ['时长（§4.2）', '0.9 秒，每 0.3 秒一个点']]);
        cap('红球 = 用户方向，<b>拖平面改它</b>。金线是式 14 的结果：离得越远越靠近用户');
      } };
  }

  /* ---------- scene 10: autoregressive indices ---------- */
  const tokenModel = () => {
    if (cache.tm) return cache.tm; const m = main(), B = m.A.B, Kc = B[0].length, Ld = B.length;
    const tok = D => { const out = []; for (let i = 8; i + 8 < D.N; i += Toy.HOP) out.push(Toy.quant(B, m.A.E.f(Toy.winOf(D, i + 2)).y, Ld).I); return out; };
    const Tr = tok(m.D), Te = tok(m.Test), cnt = []; for (let d = 0; d < Ld; d++) { cnt.push(Array.from({ length: Kc }, () => Array.from({ length: Kc }, () => new Float64Array(Kc).fill(0.5)))); }
    for (let k = 1; k < Tr.length; k++) for (let d = 0; d < Ld; d++) cnt[d][Tr[k - 1][d]][d ? Tr[k][d - 1] : 0][Tr[k][d]]++;
    const P = (d, prevT, prevD) => { const c = cnt[d][prevT][prevD], s = c.reduce((a, b) => a + b); return Array.from(c, x => x / s); };
    let nll = 0, n = 0; for (let k = 1; k < Te.length; k++) for (let d = 0; d < Ld; d++) { nll -= Math.log(P(d, Te[k - 1][d], d ? Te[k][d - 1] : 0)[Te[k][d]]); n++; }
    return cache.tm = { P, Kc, Ld, nll: nll / n, nTok: Tr.length, Tr };
  };
  function s10(G) {
    const Kn = 24, m = main(), tm = tokenModel(), Ld = tm.Ld, cx = i => -10.4 + i * 1.0, ry = d => 8.8 - d * 1.15, Lm = [1, 2, 4], Tm = [1, 0.5];
    const cells = [], txt = []; for (let d = 0; d < Ld; d++) { const a = [], b = []; for (let k = 0; k < Kn; k++) { const c = block(.86, .95, .4, LAY[d], [cx(k), ry(d), 0]); G.add(c); a.push(c); const t = lab('0', [cx(k), ry(d), .4], { size: 20, bg: false }); t.visible = false; G.add(t); b.push(t); } cells.push(a); txt.push(b); G.add(lab(d ? `RVQ ${d}` : 'VQ', [cx(0) - 2, ry(d), 0], { size: 21 })); }
    const lT = poly(G, 2, COL.grad, 1), lD = poly(G, 2, COL.grad, 1); G.add(lab('时间（每列 0.2 秒）→', [cx(Kn - 1) - 3.5, ry(0) + 1.1, 0], { size: 21 }));
    const x0 = cx(0), wd = cx(Kn - 1) - x0, yC = 1.6, hC = 1.5, n = Kn * Toy.HOP - 2; curveFrame(G, x0, wd, yC, hC, 0, 'θ₁'); const f = curve(x0, wd, yC, hC, 0, n + 1), gr = poly(G, n + 1, COL.enc, 1), hd = marker(G, COL.enc, .16); let key = '', run = null;
    function rec() {
      const k = [U.seed10, U.lay10, U.tmp10].join(); if (k === key) return; key = k; const r = Toy.RNG(100 + U.seed10), tp = Tm[U.tmp10], use = Lm[U.lay10], I = [], draw = q => { const w = q.map(x => Math.pow(x, 1 / tp)), s = w.reduce((a, b) => a + b); let u = r.u() * s, i = 0; for (; i < w.length - 1; i++) { u -= w[i]; if (u <= 0) break; } return i; };
      let prev = tm.Tr[r.int(tm.Tr.length)]; for (let q = 0; q < Kn + 2; q++) { const c = []; for (let d = 0; d < Ld; d++) c.push(draw(tm.P(d, prev[d], d ? c[d - 1] : 0))); I.push(c); prev = c; }
      const Z = I.map(c => { const z = [0, 0]; for (let d = 0; d < use; d++) { z[0] += m.A.B[d][c[d]][0]; z[1] += m.A.B[d][c[d]][1]; } return z; }), out = Toy.decodeZ(m.A, Z, n, [0, 0, 0, 0]); run = { I, out, use }; gr.userData.set(out.map((s, i) => f(i, s[0])));
    }
    rec();
    return { ctl: [{ label: '解码用', items: ['1 层', '2 层', '4 层'], get: () => U.lay10, set: i => { U.lay10 = i; } }, { label: '温度', items: ['1', '0.5'], get: () => U.tmp10, set: i => { U.tmp10 = i; } }, { label: '', items: ['重抽'], get: () => -1, set: () => { U.seed10++; } }],
      onShow: rec,
      update(p) {
        rec(); const totalN = Kn * Ld, st = Math.min(totalN - 1, Math.floor(p * totalN)), kN = Math.floor(st / Ld), dN = st % Ld;
        for (let d = 0; d < Ld; d++) for (let k = 0; k < Kn; k++) { const idx = k * Ld + d, on = idx <= st, c = cells[d][k], t = txt[d][k], val = run.I[k][d]; c.material.transparent = true; c.material.opacity = on ? (d < run.use ? 1 : .35) : .1; glow(c, idx === st ? 1 : 0); if (t.userData.v !== val) { t.material.map?.dispose?.(); const nt = L.label(String(val), { size: 24, bg: false, color: '#0b1020', scale: .0125 * refDist / 22 }); t.material.map = nt.material.map; t.scale.copy(nt.scale); t.userData.s0 = nt.scale.clone(); t.material.needsUpdate = true; t.userData.v = val; } t.visible = on; }
        const pos = cells[dN][kN].position; lT.visible = kN > 0; if (kN > 0) lT.userData.set([cells[dN][kN - 1].position.toArray(), pos.toArray()]); lD.visible = dN > 0; if (dN > 0) lD.userData.set([cells[dN - 1][kN].position.toArray(), pos.toArray()]);
        const t = Math.min(n, kN * Toy.HOP + Toy.HOP); gr.geometry.setDrawRange(0, t + 1); hd.position.set(...f(t, run.out[t][0]));
        const pr = tm.P(dN, kN ? run.I[kN - 1][dN] : 0, dN ? run.I[kN][dN - 1] : 0);
        live([['正在采', `k = ${kN}，第 ${dN} 层`], ['p(I)，K = ' + tm.Kc, pr.map(x => fx(x, 2)).join(' ')], ['采到', String(run.I[kN][dN])], ['测试集 NLL / 每索引', fx(tm.nll, 3) + ' nat'], ['均匀分布', fx(Math.log(tm.Kc), 3) + ' nat'], ['论文规模：摊平 (K×N)²', '(50×8)² = 160000'], ['分开 K² + K·N²', '2500 + 3200 = 5700（我的估算）']]);
        cap(`金色方块逐个亮起：先看同一层上一个时刻（橙线），再看同一时刻的上一层。下面蓝线是这串索引的 <b>${run.use} 层</b>解码进仿真器的结果`);
      } };
  }

  /* ---------- scene 11: LLM. All numbers are copied from Fig. 4 and Appendix B ---------- */
  const EX = [
    { n: '图 4', q: 'a person walks forward and sits down', ph: [['走', [297, 471, 246, 463, 463]], ['屈膝', [511, 456]], ['坐下', [206, 274, 370]], ['站起', [41, 41, 370, 370]]] },
    { n: '附录 B.1', q: "a person walks forward for a long time and kicks, then he begins to dance", ph: [['走 × 4', [297, 471, 246, 463, 463, 297, 471, 246, 463, 463, 297, 471, 246, 463, 463, 297, 471, 246, 463, 463]], ['踢', [145, 160, 223, 117, 424, 299, 178, 166, 330, 391]], ['跳舞', [472, 133, 132, 357, 492, 435, 217, 322, 106, 88, 279, 217, 387, 274, 134, 470, 175, 466, 252, 156, 134, 352, 436, 394, 77, 379, 297, 315, 185, 112, 428, 206, 98, 14, 390, 390, 390, 14, 196, 395, 334]]] },
    { n: '附录 B.2', q: 'door, key, chair（抽象任务）', ph: [['走到钥匙', [297, 471, 246, 463, 463]], ['弯腰捡', [246, 192, 408, 205, 205]], ['站直', [205, 198, 408]], ['转身走回', [463, 297, 471, 246]], ['插钥匙转动', [129, 129, 433]], ['推门', [179, 179, 179]], ['过门', [297, 471, 246, 463]], ['坐下', [241, 241, 241]]] }];
  const PHC = [0x3987e5, 0xd95926, 0x199e70, 0xc98500, 0x9d8cff, 0xd45fa0, 0x38d1ff, 0xe6ecf7];
  function s11(G) {
    const ex = EX[U.ex11], seq = []; ex.ph.forEach((ph, i) => ph[1].forEach(v => seq.push([v, i]))); const per = Math.min(18, Math.max(14, Math.ceil(Math.sqrt(seq.length * 4.5)))), rowsN = Math.ceil(seq.length / per), cell = 1.45, ytop = 5.4, xs = -cell * (per - 1) / 2;
    const File_ = block(4.2, 1.3, 1.2, COL.data, [-9.5, 8.4, 0]), Llm = block(4.2, 1.3, 1.2, COL.wm, [0, 8.4, 0]), Dec = block(4.2, 1.3, 1.2, COL.pi, [9.5, 8.4, 0]); G.add(File_, Llm, Dec, lab('1600 行\n描述 + VQ 索引', [-9.5, 8.4, .7], { size: 20 }), lab('Claude-2\n100k 上下文', [0, 8.4, .7], { size: 20 }), lab('物理解码器\n（这里没跑）', [9.5, 8.4, .7], { size: 20 }));
    wire(G, [[-9.5, 8.4, 0], [0, 8.4, 0]], 0x8ea2c4); wire(G, [[0, 7.7, 0], [0, ytop + 1, 0]], 0x8ea2c4); wire(G, [[0, ytop + 1, 0], [9.5, ytop + 1, 0], [9.5, 7.7, 0]], 0x8ea2c4);
    const ROWH = 1.85; const tiles = seq.map(([v, ph], i) => { const r = Math.floor(i / per), c = i % per, m = block(cell * .92, .9, .5, PHC[ph], [xs + c * cell, ytop - r * ROWH, 0]); G.add(m, lab(String(v), [xs + c * cell, ytop - r * ROWH, .5], { size: 20, bg: false, color: ph === 7 ? '#0b1020' : '#ffffff' })); if (i === 0 || seq[i - 1][1] !== ph) G.add(lab(ex.ph[ph][0], [xs + c * cell + .3, ytop - r * ROWH - .85, .5], { size: 18 })); return m; });
    const dur = seq.length * 0.2, n = ex.ph.length, cum = []; let s_ = 0; ex.ph.forEach(q => { cum.push(s_); s_ += q[1].length; });
    return { ctl: [{ label: '例子', items: EX.map(e => e.n), get: () => U.ex11, set: i => { U.ex11 = i; go(cur, 0); } }],
      update(p) {
        const t = Math.min(seq.length - 1, Math.floor(p * seq.length)), ph = seq[t][1]; tiles.forEach((m, i) => { m.material.transparent = true; m.material.opacity = i <= t ? 1 : .5; glow(m, i === t ? 1 : (seq[i][1] === ph && i <= t ? .3 : 0)); });
        const rows2 = ex.ph.map(q => [q[0], q[1].length + ' 个，' + fx(q[1].length * .2, 1) + ' 秒']); live([['问题', ex.q], ['索引总数', seq.length + ' 个 = ' + fx(dur, 1) + ' 秒'], ...rows2, ['上下文', '1600 × 167 字符 = 267200 字符']]);
        cap(`第 ${t} 个索引 <b>${seq[t][0]}</b>，属于“${ex.ph[ph][0]}”，时间 ${fx(t * .2, 1)} 秒。一个索引 = 4 帧 = 0.2 秒`);
      } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player ---------- */
  let cur = 0, playing = !L.reduced(), t0 = 0, pNow = 0, tw_ = null;
  const HOLD = 1.8;
  const aspectFix = () => { const el = $('stage'), asp = (el.clientWidth || 1) / (el.clientHeight || 1); return clamp(1.45 / asp, 1, 2.2); };
  function fly(th, ph, d, tg) {
    let dth = th - S.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth)); d *= aspectFix();
    tw_ = { t0: performance.now(), from: [S.theta, S.phi, S.dist, S.target.clone()], to: [S.theta + dth, ph, d, new THREE.Vector3(...tg)] }; refDist = d;
  }
  function setPlay(on) { playing = on; $('play').textContent = on ? '❚❚ 暂停' : '▶ 播放'; $('play').setAttribute('aria-label', on ? '暂停' : '播放'); }
  function renderCtl() {
    const box = $('ctl'), c = api?.ctl; box.hidden = !c; if (!c) { box.innerHTML = ''; return; }
    box.innerHTML = c.map((g, k) => `<span class="row">${g.label ? `<span>${g.label}</span>` : ''}` + g.items.map((t, i) => `<button type="button" data-g="${k}" data-k="${i}" aria-pressed="${g.get() === i}">${t}</button>`).join('') + '</span>').join('');
  }
  function go(i, p0 = 0) {
    const nx = (i + SCENES.length) % SCENES.length; if (nx !== cur) { U.v3 = U.v4 = U.goal = U.sel2 = null; U.drop = 0; }
    cur = nx; lastLive = null; chartState = null; dragFn = null; dragPlane = null; dragInv = null; showInfo(cur);
    if (!S) return;
    L.clear(root); LABS = []; PICKS = []; lastCap = null;
    const sc = SCENES[cur]; fly(...sc.cam); refDist = sc.cam[2] * aspectFix();
    const G = new THREE.Group(); root.add(G); api = BUILD[cur](G); renderCtl(); api.onShow?.();
    pNow = p0; t0 = performance.now() - p0 * sc.dur * 1000; api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
  }
  if (S) {
    S.onTick(() => {
      if (playing && api) {
        const sc = SCENES[cur], el = (performance.now() - t0) / 1000;
        if (el > sc.dur + HOLD) { t0 = performance.now(); pNow = 0; } else pNow = Math.min(1, el / sc.dur);
        api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
      }
      if (tw_) { const k = L.reduced() ? 1 : Math.min(1, (performance.now() - tw_.t0) / 900), e = L.ease(k), a = tw_.from, b = tw_.to; S.setView(L.lerp(a[0], b[0], e), L.lerp(a[1], b[1], e), L.lerp(a[2], b[2], e), a[3].clone().lerp(b[3], e).toArray()); if (k >= 1) tw_ = null; }
      const f = clamp(S.dist / refDist, 0.6, 1.6); for (const sp of LABS) sp.scale.copy(sp.userData.s0).multiplyScalar(f);
    });
    S.onClick(() => PICKS, hit => { const u = hit?.object?.userData; if (u?.go != null) go(u.go); else if (u?.fn) u.fn(); });
    S.onHover(() => PICKS, hit => { if (!dragFn) $('stage').style.cursor = hit ? 'pointer' : ''; });
    const host = $('stage'); let dragging = false;
    const dragAt = e => { S.scene.updateMatrixWorld(); S.cam.updateMatrixWorld(); const h = S.pick(e, [dragPlane]); if (h && dragFn && dragInv) { dragFn(dragInv(h.point)); setPlay(false); api.update(pNow); return true; } return false; };
    host.addEventListener('pointerdown', e => { if (!dragFn || !dragPlane) return; if (dragAt(e)) { dragging = true; e.stopPropagation(); } }, true);
    window.addEventListener('pointermove', e => { if (dragging) dragAt(e); });
    window.addEventListener('pointerup', () => { dragging = false; });
  }
  $('ctl').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !api?.ctl) return; const g = api.ctl[+b.dataset.g], k = +b.dataset.k;
    g.set(k); lastLive = null; setPlay(false); renderCtl(); api.onShow?.(); api.update(pNow);
  });
  $('play').onclick = () => { if (!playing) t0 = performance.now() - pNow * SCENES[cur].dur * 1000; setPlay(!playing); };
  $('scrub').oninput = e => { setPlay(false); pNow = e.target.value / 1000; if (api) api.update(pNow); };
  $('prev').onclick = () => go(cur - 1); $('next').onclick = () => go(cur + 1);
  btns.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); });
  stepsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; go(+b.dataset.i); if (!document.body.classList.contains('embed')) $('stage').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' && e.key !== ' ') return; if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1); else if (e.key === ' ') { e.preventDefault(); $('play').click(); } });
  const s0 = clamp((parseInt(qs.get('scene'), 10) || 1) - 1, 0, SCENES.length - 1), pq = qs.get('p');
  setPlay(playing && pq == null);
  cur = s0; go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0));
})();
