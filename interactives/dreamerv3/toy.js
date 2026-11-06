'use strict';
/* DreamerV3 toy computations, all pure functions, no DOM. They use the formulas of arXiv 2301.04104v2 and of the official
   code (github.com/danijar/dreamerv3 e01491f) on small problems made up for this page. None of them is the Dreamer network. */
const Toy = (function () {
  const sign = x => (x > 0 ? 1 : x < 0 ? -1 : 0);
  const symlog = x => sign(x) * Math.log1p(Math.abs(x));
  const symexp = x => sign(x) * Math.expm1(Math.abs(x));
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const gauss = r => { const u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const softmax = l => { const m = Math.max(...l), e = l.map(x => Math.exp(x - m)), s = e.reduce((a, b) => a + b, 0); return e.map(x => x / s); };

  /* ---- bins and two-hot: heads.py symexp_twohot and outs.py TwoHot (255 bins, weights linear in the raw value) ---- */
  const N = 255, half = Array.from({ length: 128 }, (_, i) => symexp(-20 + 20 * i / 127));
  const BINS = half.concat(half.slice(0, -1).reverse().map(x => -x));
  const SPACE = BINS.map(symlog);
  function twohot(y) {
    let lo = 0; for (let i = 0; i < N; i++) if (BINS[i] <= y) lo = i;
    let hi = lo; if (BINS[lo] < y && lo < N - 1) hi = lo + 1;
    if (y < BINS[0]) { lo = 0; hi = 0; }
    if (lo === hi) return { k: lo, k1: lo, wk: 1, wk1: 0 };
    const d0 = Math.abs(BINS[lo] - y), d1 = Math.abs(BINS[hi] - y), t = d0 + d1;
    return { k: lo, k1: hi, wk: d1 / t, wk1: d0 / t };
  }
  function target(y) { const t = new Array(N).fill(0), h = twohot(y); t[h.k] += h.wk; t[h.k1] += h.wk1; return t; }
  /* expected value, symmetric sum as in outs.py */
  function readSym(p) { const m = 127; let a = 0; for (let i = 0; i < m; i++) a = Math.fround(a + Math.fround(Math.fround(p[m - 1 - i] * BINS[m - 1 - i]) + Math.fround(p[m + 1 + i] * BINS[m + 1 + i]))); return Math.fround(a + Math.fround(p[m] * BINS[m])); }
  /* naive left to right float32 sum, the version the code comment warns about */
  function readNaive(p) { let a = 0; for (let i = 0; i < N; i++) a = Math.fround(a + Math.fround(Math.fround(p[i]) * Math.fround(BINS[i]))); return a; }
  /* gradient descent on free logits against the two-hot target, zero initial logits as in the code (outscale 0) */
  function trainHot(y, lr, steps) {
    const t = target(y), l = new Array(N).fill(0), out = [];
    for (let s = 0; s <= steps; s++) {
      const p = softmax(l); let ce = 0, g2 = 0; for (let i = 0; i < N; i++) { if (t[i] > 0) ce -= t[i] * Math.log(Math.max(p[i], 1e-300)); const g = p[i] - t[i]; g2 += g * g; }
      let v = 0; for (let i = 0; i < N; i++) v += p[i] * BINS[i];
      out.push({ p: p.slice(), ce, gn: Math.sqrt(g2), v });
      for (let i = 0; i < N; i++) l[i] -= lr * (p[i] - t[i]);
    }
    return out;
  }

  /* ---- symlog squared error against squared and Huber error on a two-layer scalar net f = w1 w2 ---- */
  function trainScalar(kind, y, lr, steps) {
    let w1 = 1.2, w2 = 0.8, div = -1, hit = -1; const hist = [], tgt = kind === 'sym' ? symlog(y) : y;
    for (let s = 0; s <= steps; s++) {
      const f = w1 * w2, read = kind === 'sym' ? symexp(f) : f;
      if (div < 0 && (!isFinite(f) || Math.abs(f) > 1e12)) div = s;
      if (div >= 0) { hist.push({ read: NaN, g: NaN }); continue; }
      if (hit < 0 && Math.abs(read - y) <= 0.1 * Math.max(Math.abs(y), 1e-9)) hit = s;
      const e = f - tgt, de = kind === 'hub' ? Math.max(-1, Math.min(1, e)) : e;
      hist.push({ read, g: Math.hypot(de * w2, de * w1) });
      const a = de * w2, b = de * w1; w1 -= lr * a; w2 -= lr * b;
    }
    return { hist, div, hit };
  }

  /* ---- KL balancing and free bits: categorical q(z|x) for m equally likely inputs, one prior p(z), 1% unimix ----
     L = w_pred * (-ln q(z=x|x)) + bdyn * max(free, KL(sg q || p)) + brep * max(free, KL(q || sg p)), gradient descent on the logits. */
  function klRun(o) {
    const K = 8, m = o.m, mix = s => s.map(x => (o.unimix === 0 ? x : 0.99 * x + 0.01 / K)), r = rng(11);
    const Q = Array.from({ length: m }, () => Array.from({ length: K }, () => 0.02 * gauss(r))), P = Array.from({ length: K }, () => 0.02 * gauss(r)), hist = [];
    for (let s = 0; s <= o.steps; s++) {
      const sp = softmax(P), pp = mix(sp); let kl = 0, pred = 0, act = 0, mi = 0; const gP = new Array(K).fill(0), gQ = Q.map(() => new Array(K).fill(0)), qs = [], avg = new Array(K).fill(0);
      for (let x = 0; x < m; x++) {
        const sq = softmax(Q[x]), qq = mix(sq); qs.push(qq); for (let c = 0; c < K; c++) avg[c] += qq[c] / m;
        let d = 0; for (let c = 0; c < K; c++) d += qq[c] * Math.log(qq[c] / pp[c]);
        kl += d / m; pred += -Math.log(qq[x]) / m;
        const on = d >= o.free ? 1 : 0; act += on / m;
        const dq = new Array(K).fill(0), dp = new Array(K).fill(0);
        dq[x] += -o.wPred / qq[x];
        for (let c = 0; c < K; c++) { if (on) { dq[c] += o.brep * (Math.log(qq[c] / pp[c]) + 1); dp[c] += o.bdyn * (-qq[c] / pp[c]); } }
        const f = o.unimix === 0 ? 1 : 0.99;
        for (let j = 0; j < K; j++) { let a = 0, b = 0; for (let c = 0; c < K; c++) { a += dq[c] * f * sq[c] * ((c === j) - sq[j]); b += dp[c] * f * sp[c] * ((c === j) - sp[j]); } gQ[x][j] += a; gP[j] += b / m; }
      }
      for (let x = 0; x < m; x++) for (let c = 0; c < K; c++) mi += (qs[x][c] / m) * Math.log(qs[x][c] / avg[c]);
      hist.push({ q: qs, p: pp, kl, pred, act, mi });
      for (let x = 0; x < m; x++) for (let j = 0; j < K; j++) Q[x][j] -= o.lr * gQ[x][j];
      for (let j = 0; j < K; j++) P[j] -= o.lr * gP[j];
    }
    return hist;
  }

  /* ---- lambda returns on a finite chain of states, tabular critic: what each recursion converges to ----
     n states in a line, reward 1 on state a, the episode ends after state n-1 (c = 0 there). H-step rollouts from every state. */
  function chainValues(mode, gamma, lam, n, a, H = 15, sweeps = 800) {
    const r = new Array(n + 1).fill(0); r[a] = 1; const v = new Array(n + 1).fill(0);
    const cont = i => (i >= n - 1 ? 0 : 1);
    for (let it = 0; it < sweeps; it++) {
      const nv = v.slice();
      for (let s = 0; s < n; s++) {
        const end = Math.min(s + H, n - 1); let R = v[end];
        for (let i = end - 1; i >= s; i--) {
          if (mode === 'v1') R = r[i] + gamma * cont(i) * ((1 - lam) * v[i + 1] + lam * R);      /* arXiv v1 eq. (7) */
          else if (mode === 'v2') R = r[i] + gamma * cont(i) * ((1 - lam) * v[i] + lam * R);     /* arXiv v2 and Nature eq. (5), read literally */
          else R = r[i + 1] + gamma * cont(i + 1) * ((1 - lam) * v[i + 1] + lam * R);            /* agent.py lambda_return */
        }
        if (end === s) R = mode === 'code' ? 0 : r[s];
        nv[s] = v[s] + 0.5 * (R - v[s]);
      }
      for (let i = 0; i < n; i++) v[i] = nv[i];
    }
    return v.slice(0, n);
  }
  function chainTrue(mode, gamma, n, a) { const o = []; for (let s = 0; s < n; s++) { const d = a - s; if (mode === 'code') o.push(d >= 1 ? Math.pow(gamma, d - 1) : 0); else o.push(d >= 0 ? Math.pow(gamma, d) : 0); } return o; }
  /* one imagined rollout: r, v given, return R^lambda under each recursion */
  function lamReturn(mode, r, v, gamma, lam) {
    const T = r.length - 1, R = new Array(T + 1); R[T] = v[T];
    for (let t = T - 1; t >= 0; t--) {
      if (mode === 'v1') R[t] = r[t] + gamma * ((1 - lam) * v[t + 1] + lam * R[t + 1]);
      else if (mode === 'v2') R[t] = r[t] + gamma * ((1 - lam) * v[t] + lam * R[t + 1]);
      else R[t] = r[t + 1] + gamma * ((1 - lam) * v[t + 1] + lam * R[t + 1]);
    }
    return R;
  }

  /* ---- return normalization ---- */
  function percentile(sorted, q) { const i = (sorted.length - 1) * q / 100, a = Math.floor(i), b = Math.min(sorted.length - 1, a + 1); return sorted[a] + (sorted[b] - sorted[a]) * (i - a); }
  function returnBatch(scale, outlier, n = 1024) {
    const r = rng(23), out = [];
    for (let i = 0; i < n; i++) { let x = (0.5 + 0.18 * gauss(r)); if (outlier && r() < 0.02) x = 8 + 4 * r(); out.push(x * scale); }
    return out.sort((a, b) => a - b);
  }
  function emaS(range, t, decay = 0.99) { return range * (1 - Math.pow(decay, t)); } /* code: debias False, starts from 0 */
  /* softmax policy on three arms. method: 'ret' max(1,S), 'adv' std of advantage, 'none'. scenario: 'dense' or 'noise'. */
  function bandit(method, scale, scenario, o = {}) {
    const eta = o.eta ?? 3e-4, lr = o.lr ?? 0.05, steps = o.steps ?? 6000, r = rng(5); let l = [0, 0, 0], S = 0; const base = [0, 1, 0.2];
    let ent = 0, pi = [1 / 3, 1 / 3, 1 / 3];
    for (let s = 0; s < steps; s++) {
      pi = softmax(l); const Q = scenario === 'dense' ? base.map(x => x * scale) : base.map(() => scale * gauss(r));
      const V = pi[0] * Q[0] + pi[1] * Q[1] + pi[2] * Q[2], adv = Q.map(q => q - V);
      S = 0.99 * S + 0.01 * (Math.max(...Q) - Math.min(...Q));
      let D = 1; if (method === 'ret') D = Math.max(1, S); else if (method === 'adv') { const va = pi[0] * adv[0] * adv[0] + pi[1] * adv[1] * adv[1] + pi[2] * adv[2] * adv[2]; D = Math.sqrt(va) + 1e-8; }
      const H = -pi.reduce((a, b) => a + (b > 0 ? b * Math.log(b) : 0), 0);
      for (let j = 0; j < 3; j++) { const lp = Math.log(Math.max(pi[j], 1e-300)); l[j] += lr * (pi[j] * adv[j] / D + eta * (-pi[j]) * (lp + H)); l[j] = Math.max(-200, Math.min(200, l[j])); }
    }
    pi = softmax(l); ent = -pi.reduce((a, b) => a + (b > 0 ? b * Math.log(b) : 0), 0);
    return { ent, pi };
  }

  /* ---- actor gradients: dynamics x' = x + 0.3 a + c sin(2x), terminal reward -(x_H - g)^2, one scalar parameter ---- */
  const G = 1.5;
  function rollC(th, eps, sig, c, H) { /* continuous: a = th + sig eps, returns R, pathwise gradient dR/dth, score sum */
    let x = 0, dx = 0, score = 0;
    for (let t = 0; t < H; t++) { const a = th + sig * eps[t]; score += (a - th) / (sig * sig); dx = dx * (1 + 2 * c * Math.cos(2 * x)) + 0.3; x = x + 0.3 * a + c * Math.sin(2 * x); }
    return { R: -(x - G) * (x - G), path: -2 * (x - G) * dx, score };
  }
  function rollD(th, u, c, H) { /* discrete: a in {-1, +1}, P(+1) = sigmoid(th). straight-through passes dR/da to dmu/dth */
    const pp = 1 / (1 + Math.exp(-th)), dmu = 2 * pp * (1 - pp); let x = 0, dx = 0, score = 0;
    for (let t = 0; t < H; t++) { const up = u[t] < pp, a = up ? 1 : -1; score += up ? 1 - pp : -pp; dx = dx * (1 + 2 * c * Math.cos(2 * x)) + 0.3 * dmu; x = x + 0.3 * a + c * Math.sin(2 * x); }
    return { R: -(x - G) * (x - G), path: -2 * (x - G) * dx, score };
  }
  function exactD(th, c, H) { /* exact policy gradient by enumerating all 2^H action sequences */
    const pp = 1 / (1 + Math.exp(-th)); let g = 0, J = 0;
    for (let m = 0; m < (1 << H); m++) { let x = 0, lp = 1, sc = 0; for (let t = 0; t < H; t++) { const up = (m >> t) & 1, a = up ? 1 : -1; lp *= up ? pp : 1 - pp; sc += up ? 1 - pp : -pp; x = x + 0.3 * a + c * Math.sin(2 * x); } const R = -(x - G) * (x - G); J += lp * R; g += lp * R * sc; }
    return { g, J };
  }
  function grads(o) {
    /* batches of N rollouts, M batches: mean and std of each estimator */
    const { type, th, sig, c, H, N: NN, M } = o, r = rng(o.seed || 3); const re = [], bp = [];
    for (let b = 0; b < M; b++) {
      const Rs = [], sc = [], pa = [];
      for (let i = 0; i < NN; i++) {
        const e = Array.from({ length: H }, () => (type === 'cont' ? gauss(r) : r())), ro = type === 'cont' ? rollC(th, e, sig, c, H) : rollD(th, e, c, H);
        Rs.push(ro.R); sc.push(ro.score); pa.push(ro.path);
      }
      const base = Rs.reduce((a, x) => a + x, 0) / NN; let gr = 0, gb = 0;
      for (let i = 0; i < NN; i++) { gr += (Rs[i] - base) * sc[i] / NN; gb += pa[i] / NN; }
      re.push(gr); bp.push(gb);
    }
    const stat = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; const v = a.reduce((x, y) => x + (y - m) * (y - m), 0) / a.length; return { m, s: Math.sqrt(v) }; };
    let truth;
    let refRe = null;
    if (type === 'cont') { const r2 = rng(99); let g = 0, Rm = 0, gs = 0; const n = 40000; for (let i = 0; i < n; i++) { const e = Array.from({ length: H }, () => gauss(r2)), ro = rollC(th, e, sig, c, H); g += ro.path / n; Rm += ro.R / n; gs += ro.R * ro.score / n; } truth = g; refRe = gs; }
    else truth = exactD(th, c, H).g;
    return { re: stat(re), bp: stat(bp), truth, refRe };
  }
  /* finite difference of the continuous objective with common random numbers, used as a check on the pathwise gradient */
  function fdCont(th, sig, c, H, n = 40000) { const d = 1e-4; let a = 0, b = 0; const r = rng(99); for (let i = 0; i < n; i++) { const e = Array.from({ length: H }, () => gauss(r)); a += rollC(th + d, e, sig, c, H).R / n; b += rollC(th - d, e, sig, c, H).R / n; } return (a - b) / (2 * d); }

  /* ---- discrete latent numbers ---- */
  const SIZES = [['1M', 64], ['12M', 256], ['25M', 384], ['50M', 512], ['100M', 768], ['200M', 1024], ['400M', 1536]];
  const entropy = p => -p.reduce((a, b) => a + (b > 0 ? b * Math.log(b) : 0), 0);
  function peaked(K, conc, unimix, at) { const s = Array.from({ length: K }, (_, i) => (i === at ? conc : 0)), p = softmax(s); return unimix ? p.map(x => 0.99 * x + 0.01 / K) : p; }
  const klCat = (q, p) => q.reduce((a, x, i) => a + (x > 0 ? x * Math.log(x / Math.max(p[i], 1e-300)) : 0), 0);

  return { symlog, symexp, rng, gauss, softmax, N, BINS, SPACE, twohot, target, readSym, readNaive, trainHot, trainScalar, klRun, chainValues, chainTrue, lamReturn, percentile, returnBatch, emaS, bandit, rollC, rollD, exactD, grads, fdCont, SIZES, entropy, peaked, klCat, G };
})();
if (typeof module !== 'undefined') module.exports = Toy;
