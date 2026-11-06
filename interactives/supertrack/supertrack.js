'use strict';
/* SuperTrack (Fussell, Bergamin, Holden, ACM TOG 2021) taken apart into eleven scenes. Hyperparameters come from the paper's Tables 1 to 3;
   curves in scene 10 were read from its vector figures. Every scene exposes update(p), a pure function of the timeline p.
   Scenes 4 to 9 run a real toy: a planar two-link chain, its simulator, a world model and a policy are all below and are trained
   in this page. Backpropagation through W, Integrate and Local is hand-written; its result is checked against finite differences.
   The toy is not a humanoid and nothing here claims to reproduce the paper's results. */
/* Toy: planar two-link chain in maximal coordinates. Real simulator is a reduced-coordinate double pendulum with PD. */
const Toy = (function () {
  const G = 9.81, L1 = 0.5, L2 = 0.5, M1 = 1, M2 = 1, I1 = M1 * L1 * L1 / 12, I2 = M2 * L2 * L2 / 12, DT = 1 / 60, SUB = 4, KP = 30, KD = 3, BASE = [0, 1.2];
  const ALPHA = 1.0, SIGMA = 0.1;
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  /* simulator: q=[a, b] a = link 1 world angle from +z(up)?? angle measured from +x, b = joint 2 relative */
  function simSub(s, t, td, h) {
    const [a, b, wa, wb] = s; const c2 = Math.cos(b), s2 = Math.sin(b), r1 = L1 / 2, r2 = L2 / 2;
    const d11 = I1 + I2 + M1 * r1 * r1 + M2 * (L1 * L1 + r2 * r2 + 2 * L1 * r2 * c2), d12 = I2 + M2 * (r2 * r2 + L1 * r2 * c2), d22 = I2 + M2 * r2 * r2;
    const hh = M2 * L1 * r2 * s2, c1 = -hh * wb * wb - 2 * hh * wa * wb, cc2 = hh * wa * wa;
    const g1 = (M1 * r1 + M2 * L1) * G * Math.cos(a) + M2 * r2 * G * Math.cos(a + b), g2 = M2 * r2 * G * Math.cos(a + b);
    const tau1 = KP * (t[0] - a) + KD * (td[0] - wa), tau2 = KP * (t[1] - b) + KD * (td[1] - wb);
    const r1h = tau1 - c1 - g1, r2h = tau2 - cc2 - g2, det = d11 * d22 - d12 * d12;
    const aa = (d22 * r1h - d12 * r2h) / det, ab = (-d12 * r1h + d11 * r2h) / det;
    s[2] = wa + h * aa; s[3] = wb + h * ab; s[0] = a + h * s[2]; s[1] = b + h * s[3];
  }
  function simFrame(s, t, td) { for (let i = 0; i < SUB; i++) simSub(s, t, td, DT / SUB); }
  /* maximal: [p1x,p1z,v1x,v1z,th1,w1, p2x,p2z,v2x,v2z,th2,w2] */
  function toMax(s, X = new Float64Array(12)) {
    const [a, b, wa, wb] = s, ca = Math.cos(a), sa = Math.sin(a), c = Math.cos(a + b), sn = Math.sin(a + b), r1 = L1 / 2, r2 = L2 / 2, w2 = wa + wb;
    X[0] = BASE[0] + r1 * ca; X[1] = BASE[1] + r1 * sa; X[2] = -r1 * sa * wa; X[3] = r1 * ca * wa; X[4] = a; X[5] = wa;
    X[6] = BASE[0] + L1 * ca + r2 * c; X[7] = BASE[1] + L1 * sa + r2 * sn; X[8] = -L1 * sa * wa - r2 * sn * w2; X[9] = L1 * ca * wa + r2 * c * w2; X[10] = a + b; X[11] = w2;
    return X;
  }
  const NF = 18, NT = 2, NA = 6;
  function local(X, F, o = 0) {
    const th = X[4], c = Math.cos(th), s = Math.sin(th);
    for (let b = 0; b < 2; b++) { const i = b * 6, k = o + b * 8;
      const px = X[i] - X[0], pz = X[i + 1] - X[1], vx = X[i + 2], vz = X[i + 3], d = X[i + 4] - th;
      F[k] = c * px + s * pz; F[k + 1] = -s * px + c * pz; F[k + 2] = c * vx + s * vz; F[k + 3] = -s * vx + c * vz; F[k + 4] = Math.cos(d); F[k + 5] = Math.sin(d); F[k + 6] = X[i + 5]; F[k + 7] = X[i + 1]; }
    F[o + 16] = s; F[o + 17] = c; /* up (0,1) in root frame */
  }
  /* vector-Jacobian of local: A[o..o+18] -> dX (adds) */
  function localVJP(X, A, o, dX) {
    const th = X[4], c = Math.cos(th), s = Math.sin(th);
    for (let b = 0; b < 2; b++) { const i = b * 6, k = o + b * 8;
      const px = X[i] - X[0], pz = X[i + 1] - X[1], vx = X[i + 2], vz = X[i + 3], d = X[i + 4] - th;
      const a0 = A[k], a1 = A[k + 1], a2 = A[k + 2], a3 = A[k + 3];
      const dpx = a0 * c - a1 * s, dpz = a0 * s + a1 * c;
      dX[i] += dpx; dX[i + 1] += dpz; dX[0] -= dpx; dX[1] -= dpz;
      dX[4] += a0 * (-s * px + c * pz) + a1 * (-c * px - s * pz);
      dX[i + 2] += a2 * c - a3 * s; dX[i + 3] += a2 * s + a3 * c;
      dX[4] += a2 * (-s * vx + c * vz) + a3 * (-c * vx - s * vz);
      const dd = A[k + 4] * (-Math.sin(d)) + A[k + 5] * Math.cos(d); dX[i + 4] += dd; dX[4] -= dd;
      dX[i + 5] += A[k + 6]; dX[i + 1] += A[k + 7]; }
    dX[4] += A[o + 16] * c - A[o + 17] * s;
  }
  /* MLP with ELU */
  function MLP(sizes, r, lastScale = 1) {
    let n = 0; for (let i = 0; i + 1 < sizes.length; i++) n += (sizes[i] + 1) * sizes[i + 1];
    const w = new Float64Array(n); let k = 0;
    for (let i = 0; i + 1 < sizes.length; i++) { const a = sizes[i], b = sizes[i + 1], sc = Math.sqrt(1 / a) * (i + 2 === sizes.length ? lastScale : 1.3);
      for (let u = 0; u < b; u++) { for (let v = 0; v < a; v++) w[k++] = gauss(r) * sc; w[k++] = 0; } }
    const m = { sizes, w, n };
    m.acts = sizes.map(s => new Float64Array(s)); m.pre = sizes.map(s => new Float64Array(s));
    return m;
  }
  /* forward; if cache given, store layer inputs (post activation) for backward */
  function fwd(m, x, y, cache) {
    const S = m.sizes, w = m.w; let k = 0; let inp = x;
    for (let l = 0; l + 1 < S.length; l++) {
      const a = S[l], b = S[l + 1], out = (l + 2 === S.length) ? y : (cache ? cache[l + 1] : m.acts[l + 1]), last = l + 2 === S.length, dv = cache ? cache.d[l + 1] : null;
      for (let u = 0; u < b; u++) { let s = 0; for (let v = 0; v < a; v++) s += w[k + v] * inp[v]; s += w[k + a]; k += a + 1;
        if (last) out[u] = s; else if (s > 0) { out[u] = s; if (dv) dv[u] = 1; } else { const e = Math.exp(s); out[u] = e - 1; if (dv) dv[u] = e; } }
      inp = out;
    }
  }
  function newCache(m) { const c = m.sizes.map(s => new Float64Array(s)); c.d = m.sizes.map(s => new Float64Array(s)); return c; }
  /* backward: adj over outputs -> adj over inputs (written into xAdj), param grads added to g (if given) */
  function bwd(m, c, x, yAdj, xAdj, g) {
    const S = m.sizes, w = m.w; let k = m.n; let adj = yAdj;
    for (let l = S.length - 2; l >= 0; l--) {
      const a = S[l], b = S[l + 1], inp = l === 0 ? x : c[l], prev = l === 0 ? xAdj : m.pre[l], dv = l + 2 === S.length ? null : c.d[l + 1];
      prev.fill(0); k -= (a + 1) * b; let q = k;
      for (let u = 0; u < b; u++) { const A = dv ? adj[u] * dv[u] : adj[u];
        if (A !== 0) { for (let v = 0; v < a; v++) { prev[v] += w[q + v] * A; if (g) g[q + v] += inp[v] * A; } if (g) g[q + a] += A; }
        q += a + 1; }
      adj = prev;
    }
    /* adj now in xAdj */
  }
  function adam(n, lr) { const m = new Float64Array(n), v = new Float64Array(n); let t = 0; return (w, g, clip = 1) => { t++; let nn = 0; for (let i = 0; i < n; i++) nn += g[i] * g[i]; nn = Math.sqrt(nn); const sc = nn > clip ? clip / nn : 1; const b1 = .9, b2 = .999; const c1 = 1 - Math.pow(b1, t), c2 = 1 - Math.pow(b2, t);
      for (let i = 0; i < n; i++) { const G_ = g[i] * sc; m[i] = b1 * m[i] + (1 - b1) * G_; v[i] = b2 * v[i] + (1 - b2) * G_ * G_; w[i] -= lr * (m[i] / c1) / (Math.sqrt(v[i] / c2) + 1e-8); } return nn; }; }
  /* normalisation constants (fixed by hand from data statistics, like the paper's offline mean/std) */
  const FM = new Float64Array(NF + NT), FS = new Float64Array(NF + NT).fill(1);
  const ASC = 20; /* output scale */
  function ref(clip, t) { /* joint-space reference: q, qd at time t */
    const c = clip; let a = c.a0, b = c.b0, wa = 0, wb = 0;
    for (const h of c.ha) { a += h[0] * Math.sin(h[1] * t + h[2]); wa += h[0] * h[1] * Math.cos(h[1] * t + h[2]); }
    for (const h of c.hb) { b += h[0] * Math.sin(h[1] * t + h[2]); wb += h[0] * h[1] * Math.cos(h[1] * t + h[2]); }
    return [a, b, wa, wb];
  }
  function randClip(r) { const hs = (A) => [[A * (0.5 + r()), 1.5 + 3 * r(), r() * 6.28], [A * 0.5 * r(), 3 + 4 * r(), r() * 6.28]];
    return { a0: -0.35 + 0.7 * r(), b0: 0.2 + 0.9 * r(), ha: hs(0.45), hb: hs(0.5) }; }
  /* world model step with optional cache: X -> Y, using T */
  function wmStep(W, X, T, Y, ctx) {
    const I = ctx.inp, F = ctx.F; local(X, F, 0); for (let i = 0; i < NF; i++) I[i] = (F[i] - FM[i]) / FS[i]; I[NF] = (T[0] - FM[NF]) / FS[NF]; I[NF + 1] = (T[1] - FM[NF + 1]) / FS[NF + 1];
    fwd(W, I, ctx.o, ctx.c);
    const th = X[4], c = Math.cos(th), s = Math.sin(th), o = ctx.o, md = ctx.vel ? 1 : 0;
    for (let b = 0; b < 2; b++) { const i = b * 6, k = b * 3, lx = o[k] * ASC, lz = o[k + 1] * ASC, la = o[k + 2] * ASC;
      const ax = c * lx - s * lz, az = s * lx + c * lz;
      if (!md) { Y[i + 2] = X[i + 2] + DT * ax; Y[i + 3] = X[i + 3] + DT * az; Y[i + 5] = X[i + 5] + DT * la; }
      else { Y[i + 2] = ax * VS; Y[i + 3] = az * VS; Y[i + 5] = la * VS; }
      Y[i] = X[i] + DT * Y[i + 2]; Y[i + 1] = X[i + 1] + DT * Y[i + 3]; Y[i + 4] = X[i + 4] + DT * Y[i + 5]; }
  }
  const VS = 3 / ASC;
  function wmVJP(W, X, dY, dX, ctx, dT) {
    /* dY adj on Y -> dX adj on X (dX pre-zeroed by caller), dT adj on T */
    const th = X[4], c = Math.cos(th), s = Math.sin(th), o = ctx.o, oA = ctx.oA;
    /* position update: Y_p = X_p + DT*Y_v => adj Y_v += DT*adj Y_p */
    const a = ctx.t12; for (let i = 0; i < 12; i++) a[i] = dY[i];
    for (let b = 0; b < 2; b++) { const i = b * 6; a[i + 2] += DT * a[i]; a[i + 3] += DT * a[i + 1]; a[i + 5] += DT * a[i + 4]; }
    for (let i = 0; i < 12; i++) dX[i] = a[i];
    const f = ctx.vel ? VS : DT;
    if (ctx.vel) for (let b = 0; b < 2; b++) { const i = b * 6; dX[i + 2] = 0; dX[i + 3] = 0; dX[i + 5] = 0; }
    for (let b = 0; b < 2; b++) { const i = b * 6, k = b * 3, lx = o[k] * ASC, lz = o[k + 1] * ASC, Ax = a[i + 2] * f, Az = a[i + 3] * f;
      /* Y_v = X_v + DT * R(th) l */
      oA[k] = (c * Ax + s * Az) * ASC; oA[k + 1] = (-s * Ax + c * Az) * ASC; oA[k + 2] = a[i + 5] * f * ASC;
      dX[4] += Ax * (-s * lx - c * lz) + Az * (c * lx - s * lz);
    }
    bwd(W, ctx.c, ctx.inp, oA, ctx.iA, ctx.gW || null);
    for (let i = 0; i < NF; i++) ctx.fA[i] = ctx.iA[i] / FS[i];
    localVJP(X, ctx.fA, 0, dX);
    if (dT) { dT[0] = ctx.iA[NF] / FS[NF]; dT[1] = ctx.iA[NF + 1] / FS[NF + 1]; }
  }
  function mkCtx(W, gW) { return { vel: !!W.vel, inp: new Float64Array(NF + NT), F: new Float64Array(NF), o: new Float64Array(NA), oA: new Float64Array(NA), c: newCache(W), iA: new Float64Array(NF + NT), fA: new Float64Array(NF), t12: new Float64Array(12), gW }; }
  /* buffer of episodes */
  function makeBuffer(cap) { return { X: new Float64Array(cap * 12), T: new Float64Array(cap * 2), K: new Float64Array(cap * 12), Kt: new Float64Array(cap * 2), ok: new Uint8Array(cap), cap, n: 0, h: 0 }; }
  const PD = { in: NF * 2, out: 2 };
  function normP(Xf, Kf, I) { for (let i = 0; i < NF; i++) { I[i] = (Xf[i] - FM[i]) / FS[i]; I[NF + i] = (Kf[i] - FM[i]) / FS[i]; } }
  function collect(buf, Pi, clips, r, nChars, frames, noise) {
    const Fa = new Float64Array(NF), Fb = new Float64Array(NF), I = new Float64Array(NF * 2), O = new Float64Array(2), td = [0, 0];
    for (let ch = 0; ch < nChars; ch++) {
      const clip = clips[Math.floor(r() * clips.length)]; let t = r() * 8; const s = ref(clip, t).slice();
      s[0] += 0.05 * gauss(r); s[1] += 0.05 * gauss(r);
      for (let f = 0; f < frames; f++) {
        const h = buf.h, X = toMax(s), kn = ref(clip, t + DT), Kn = toMax(kn);
        let o0 = 0, o1 = 0; if (Pi) { local(X, Fa); local(Kn, Fb); normP(Fa, Fb, I); fwd(Pi, I, O); o0 = O[0]; o1 = O[1]; }
        const bA = Pi && Pi.abs ? 0 : 1; const T = [bA * kn[0] + ALPHA * (o0 + noise * gauss(r)), bA * kn[1] + ALPHA * (o1 + noise * gauss(r))];
        buf.X.set(X, h * 12); buf.T.set(T, h * 2); buf.K.set(Kn, h * 12); buf.Kt[h * 2] = kn[0]; buf.Kt[h * 2 + 1] = kn[1]; buf.ok[h] = f + 1 < frames ? 1 : 0;
        buf.h = (h + 1) % buf.cap; buf.n = Math.min(buf.cap, buf.n + 1);
        td[0] = kn[2]; td[1] = kn[3]; simFrame(s, T, td); t += DT;
      }
    }
  }
  function sampleStart(buf, N, r) { for (;;) { const i = Math.floor(r() * buf.n); let ok = true; for (let j = 0; j < N; j++) { const q = (i + j) % buf.cap; if (!buf.ok[q] || q === buf.h) { ok = false; break; } } if (ok) return i; } }
  function trainW(W, opt, buf, N, B, r) {
    const g = new Float64Array(W.n), Xs = []; for (let i = 0; i <= N; i++) Xs.push(new Float64Array(12));
    const ctxs = []; for (let i = 0; i < N; i++) ctxs.push(mkCtx(W, g)); const adj = new Float64Array(12), dX = new Float64Array(12); let tot = 0;
    const wt = [1, 1, 1, 1, 1, .3, 1, 1, 1, 1, 1, .3];
    for (let b = 0; b < B; b++) { const i0 = sampleStart(buf, N + 1, r);
      Xs[0].set(buf.X.subarray(i0 * 12, i0 * 12 + 12));
      for (let i = 0; i < N; i++) { const q = (i0 + i) % buf.cap; const T = [buf.T[q * 2], buf.T[q * 2 + 1]]; wmStep(W, Xs[i], T, Xs[i + 1], ctxs[i]); }
      adj.fill(0);
      for (let i = N - 1; i >= 0; i--) { const q = (i0 + i + 1) % buf.cap; for (let k = 0; k < 12; k++) { const e = Xs[i + 1][k] - buf.X[q * 12 + k]; tot += wt[k] * Math.abs(e); adj[k] += wt[k] * Math.sign(e) / (B * N); }
        wmVJP(W, Xs[i], adj, dX, ctxs[i]); adj.set(dX); } }
    opt(W.w, g, 5);
    return tot / (B * N);
  }
  function trainP(W, Pi, opt, buf, N, B, r, sigma = SIGMA, regw = 0.01) {
    const g = new Float64Array(Pi.n); let tot = 0;
    const Xs = [], ctxs = [], cps = [], Ip = [], Op = [], Fa = new Float64Array(NF), Fk = new Float64Array(NF), Kl = [];
    for (let i = 0; i <= N; i++) { Xs.push(new Float64Array(12)); }
    for (let i = 0; i < N; i++) { ctxs.push(mkCtx(W, null)); cps.push(newCache(Pi)); Ip.push(new Float64Array(NF * 2)); Op.push(new Float64Array(2)); Kl.push(new Float64Array(NF)); }
    const adj = new Float64Array(12), dX = new Float64Array(12), dT = new Float64Array(2), iA = new Float64Array(NF * 2), oA = new Float64Array(2), fA = new Float64Array(NF), Fp = new Float64Array(NF), T = new Float64Array(2);
    for (let b = 0; b < B; b++) { const i0 = sampleStart(buf, N + 1, r);
      Xs[0].set(buf.X.subarray(i0 * 12, i0 * 12 + 12));
      for (let i = 0; i < N; i++) { const q = (i0 + i) % buf.cap; const Kn = buf.K.subarray(q * 12, q * 12 + 12);
        local(Xs[i], Fa); local(Kn, Kl[i]); normP(Fa, Kl[i], Ip[i]); fwd(Pi, Ip[i], Op[i], cps[i]);
        const bA = Pi.abs ? 0 : 1; T[0] = bA * buf.Kt[q * 2] + ALPHA * (Op[i][0] + sigma * gauss(r)); T[1] = bA * buf.Kt[q * 2 + 1] + ALPHA * (Op[i][1] + sigma * gauss(r));
        wmStep(W, Xs[i], T, Xs[i + 1], ctxs[i]); }
      adj.fill(0);
      for (let i = N - 1; i >= 0; i--) {
        /* loss at P_{i+1} vs K_{i+1}, local */
        local(Xs[i + 1], Fp); fA.fill(0);
        for (let k = 0; k < NF; k++) { const e = Fp[k] - Kl[i][k], wk = LW[k]; tot += wk * Math.abs(e); fA[k] = wk * Math.sign(e) / (B * N); }
        localVJP(Xs[i + 1], fA, 0, adj);
        wmVJP(W, Xs[i], adj, dX, ctxs[i], dT);
        oA[0] = dT[0] * ALPHA + regw * (2 * Op[i][0] + Math.sign(Op[i][0])) / (B * N); oA[1] = dT[1] * ALPHA + regw * (2 * Op[i][1] + Math.sign(Op[i][1])) / (B * N);
        bwd(Pi, cps[i], Ip[i], oA, iA, g);
        for (let k = 0; k < NF; k++) fA[k] = iA[k] / FS[k];
        localVJP(Xs[i], fA, 0, dX);
        adj.set(dX);
      } }
    opt(Pi.w, g, 5);
    return tot / (B * N);
  }
  const LW = new Float64Array(NF).fill(1);
  function initNorm(buf) { const n = buf.n, Fa = new Float64Array(NF), m = new Float64Array(NF), v = new Float64Array(NF); let tm0 = 0, tm1 = 0, tv0 = 0, tv1 = 0;
    for (let i = 0; i < n; i++) { local(buf.X.subarray(i * 12, i * 12 + 12), Fa); for (let k = 0; k < NF; k++) { m[k] += Fa[k]; v[k] += Fa[k] * Fa[k]; } tm0 += buf.T[i * 2]; tm1 += buf.T[i * 2 + 1]; tv0 += buf.T[i * 2] ** 2; tv1 += buf.T[i * 2 + 1] ** 2; }
    for (let k = 0; k < NF; k++) { FM[k] = m[k] / n; FS[k] = Math.max(.05, Math.sqrt(Math.max(0, v[k] / n - FM[k] ** 2))); }
    FM[NF] = tm0 / n; FM[NF + 1] = tm1 / n; FS[NF] = Math.max(.05, Math.sqrt(tv0 / n - FM[NF] ** 2)); FS[NF + 1] = Math.max(.05, Math.sqrt(tv1 / n - FM[NF + 1] ** 2));
    /* loss weights: inverse std of features, like "roughly equal contribution" */
    for (let k = 0; k < NF; k++) LW[k] = 0;
    const lw = [0, 0, 1, 1, 1, 1, .1, 1, 1, 1, .3, .3, 1, 1, .1, 1, 1, 1]; for (let k = 0; k < NF; k++) LW[k] = lw[k];
  }

  /* ---- evaluation and gradients ---- */
  function policyAct(P, X, Kn, tmp) { local(X, tmp.a); local(Kn, tmp.b); normP(tmp.a, tmp.b, tmp.i); fwd(P, tmp.i, tmp.o); return tmp.o; }
  const mkTmp = () => ({ a: new Float64Array(NF), b: new Float64Array(NF), i: new Float64Array(NF * 2), o: new Float64Array(2) });
  /* closed-loop rollout in the real simulator; P may be null (PD on the reference only) */
  function simTrack(P, clip, frames, t0 = 0) {
    const s = ref(clip, t0).slice(), tmp = mkTmp(), Xs = [], Ks = [], Os = []; let t = t0, e = 0;
    Xs.push(toMax(s).slice()); Ks.push(toMax(ref(clip, t0)).slice()); Os.push([0, 0]);
    for (let f = 0; f < frames; f++) {
      const kn = ref(clip, t + DT), Kn = toMax(kn); let o0 = 0, o1 = 0;
      if (P) { const o = policyAct(P, Xs[f], Kn, tmp); o0 = o[0]; o1 = o[1]; }
      simFrame(s, [kn[0] + ALPHA * o0, kn[1] + ALPHA * o1], [kn[2], kn[3]]); t += DT;
      const Y = toMax(s).slice(); Xs.push(Y); Ks.push(Kn.slice()); Os.push([o0, o1]);
      const d = Math.hypot(Y[6] + 0.25 * Math.cos(Y[10]) - Kn[6] - 0.25 * Math.cos(Kn[10]), Y[7] + 0.25 * Math.sin(Y[10]) - Kn[7] - 0.25 * Math.sin(Kn[10])); e += d;
      if (!isFinite(e) || e > 1e5) return { Xs, Ks, Os, err: Infinity };
    }
    return { Xs, Ks, Os, err: e / frames };
  }
  /* open-loop prediction by W next to the simulator from the same state, same targets; drawn in scene 5 */
  function predVsSim(W, clip, t0, frames, restart = 0) {
    const s = ref(clip, t0).slice(), c = mkCtx(W, null), P = toMax(s).slice(), Y = new Float64Array(12), Ps = [P.slice()], Ss = [toMax(s).slice()], Ts = []; let t = t0;
    for (let i = 0; i < frames; i++) {
      const kn = ref(clip, t + DT), Tg = [kn[0], kn[1]]; wmStep(W, P, Tg, Y, c); P.set(Y); simFrame(s, Tg, [kn[2], kn[3]]); t += DT; const X = toMax(s).slice();
      if (restart && (i + 1) % restart === 0) P.set(X);
      for (let k = 0; k < 12; k++) if (!isFinite(P[k]) || Math.abs(P[k]) > 1e3) P[k] = Math.sign(P[k] || 1) * 1e3;
      Ps.push(P.slice()); Ss.push(X); Ts.push(Tg);
    }
    return { Ps, Ss, Ts };
  }
  const tipOf = X => [X[6] + 0.25 * Math.cos(X[10]), X[7] + 0.25 * Math.sin(X[10])];
  const gapOf = X => Math.hypot(X[0] + 0.25 * Math.cos(X[4]) - X[6] + 0.25 * Math.cos(X[10]), X[1] + 0.25 * Math.sin(X[4]) - X[7] + 0.25 * Math.sin(X[10]));
  /* mean tip error and joint gap at given horizons over many start states, W from S0 with PD on the reference */
  function wmErr(W, clips, Ns, trials = 36) {
    const rr = rng(99), N = Ns[Ns.length - 1], e = new Float64Array(N + 1), g = new Float64Array(N + 1);
    for (let k = 0; k < trials; k++) { const r = predVsSim(W, clips[k % clips.length], rr() * 4, N);
      for (let i = 1; i <= N; i++) { const a = tipOf(r.Ps[i]), b = tipOf(r.Ss[i]); e[i] += Math.min(100, Math.hypot(a[0] - b[0], a[1] - b[1])) / trials; g[i] += Math.min(100, gapOf(r.Ps[i])) / trials; } }
    return { err: Ns.map(n => e[n]), gap: Ns.map(n => g[n]) };
  }
  /* tracking loss in the simulator for a fixed offset sequence o (black box: this is all a finite difference can see) */
  function lossSim(s0, clip, t0, o, N) {
    const s = s0.slice(); let t = t0, L = 0; const Fa = new Float64Array(NF), Fk = new Float64Array(NF);
    for (let i = 0; i < N; i++) { const kn = ref(clip, t + DT); simFrame(s, [kn[0] + o[2 * i], kn[1] + o[2 * i + 1]], [kn[2], kn[3]]); t += DT; local(toMax(s), Fa); local(toMax(kn), Fk); for (let k = 0; k < NF; k++) L += LW[k] * Math.abs(Fa[k] - Fk[k]); }
    return L;
  }
  /* same loss through W by reverse mode; g gets dL/do_i. Hand-written backprop through Integrate, the root rotation, Local and the network. */
  function gradW(W, s0, clip, t0, o, N, g) {
    const Xs = [], ctxs = []; for (let i = 0; i <= N; i++) Xs.push(new Float64Array(12)); for (let i = 0; i < N; i++) ctxs.push(mkCtx(W, null));
    toMax(s0, Xs[0]); let t = t0, L = 0; const Fa = new Float64Array(NF), Fk = new Float64Array(NF), fA = new Float64Array(NF), adj = new Float64Array(12), dX = new Float64Array(12), dT = new Float64Array(2), Ks = [];
    for (let i = 0; i < N; i++) { const kn = ref(clip, t + DT); Ks.push(toMax(kn).slice()); wmStep(W, Xs[i], [kn[0] + o[2 * i], kn[1] + o[2 * i + 1]], Xs[i + 1], ctxs[i]); t += DT; }
    for (let i = N - 1; i >= 0; i--) { local(Xs[i + 1], Fa); local(Ks[i], Fk); fA.fill(0); for (let k = 0; k < NF; k++) { const e = Fa[k] - Fk[k]; L += LW[k] * Math.abs(e); fA[k] = LW[k] * Math.sign(e); }
      localVJP(Xs[i + 1], fA, 0, adj); wmVJP(W, Xs[i], adj, dX, ctxs[i], dT); if (g) { g[2 * i] = dT[0]; g[2 * i + 1] = dT[1]; } adj.set(dX); }
    return L;
  }
  function fdSim(s0, clip, t0, N) { const o = new Float64Array(2 * N), g = new Float64Array(2 * N), e = 1e-4; for (let i = 0; i < 2 * N; i++) { o[i] = e; const a = lossSim(s0, clip, t0, o, N); o[i] = -e; const b = lossSim(s0, clip, t0, o, N); o[i] = 0; g[i] = (a - b) / (2 * e); } return g; }
  function fdW(W, s0, clip, t0, N) { const o = new Float64Array(2 * N), g = new Float64Array(2 * N), e = 1e-5; for (let i = 0; i < 2 * N; i++) { o[i] = e; const a = gradW(W, s0, clip, t0, o, N, null); o[i] = -e; const b = gradW(W, s0, clip, t0, o, N, null); o[i] = 0; g[i] = (a - b) / (2 * e); } return g; }
  /* likelihood-ratio estimate with M noisy rollouts of the simulator; same class of estimator PPO uses, without critic or clipping */
  function lrEstimate(s0, clip, t0, N, M, sig, r) {
    const d = 2 * N, h = new Float64Array(d), eps = new Float64Array(d), q = new Float64Array(d), L0 = lossSim(s0, clip, t0, q, N);
    for (let m = 0; m < M; m++) { for (let i = 0; i < d; i++) { eps[i] = gauss(r); q[i] = sig * eps[i]; } const L = lossSim(s0, clip, t0, q, N); for (let i = 0; i < d; i++) h[i] += (L - L0) * eps[i] / sig / M; }
    return h;
  }
  const cos = (a, b) => { let x = 0, y = 0, z = 0; for (let i = 0; i < a.length; i++) { x += a[i] * b[i]; y += a[i] * a[i]; z += b[i] * b[i]; } return x / Math.sqrt(y * z + 1e-30); };
  const norm = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s); };
  /* ---- the whole training loop of section 3.6, small ---- */
  let normed = false;
  function setup(seed) { const r = rng(seed), clips = []; for (let i = 0; i < 12; i++) clips.push(randClip(r)); const buf = makeBuffer(4000); collect(buf, null, clips, r, 16, 200, SIGMA); if (!normed) { initNorm(buf); normed = true; } return { r, clips, buf }; }
  const EVAL = { a0: 0.1, b0: 0.7, ha: [[0.55, 2.6, 0], [0.12, 5.1, 1]], hb: [[0.5, 3.4, 1.2], [0.1, 6.3, 0.3]] };
  function trainWOnly(seed, NW, iters) { const S = setup(seed), W = MLP([20, 32, 32, 6], S.r, 0.1), o = adam(W.n, 1e-3), B = Math.max(1, Math.round(64 / NW)); for (let i = 0; i < iters; i++) trainW(W, o, S.buf, NW, B, S.r); return { W, S }; }
  function run(seed = 1, o = {}) {
    const NW = o.NW || 8, NP = o.NP || 32, iters = o.iters || 1000, S = setup(seed), r = S.r, W = MLP([20, 32, 32, 6], r, 0.1), Pi = MLP([36, 32, 32, 2], r, 0.01), oW = adam(W.n, 1e-3), oP = adam(Pi.n, 1e-3);
    const BW = Math.max(1, Math.round(64 / NW)), BP = Math.max(1, Math.round(64 / NP)), curve = [], snaps = [], s0 = ref(EVAL, 1).slice(), gt = fdSim(s0, EVAL, 1, 32), gb = new Float64Array(64);
    const rec = it => { const tr = simTrack(Pi, EVAL, 240); gradW(W, s0, EVAL, 1, new Float64Array(64), 32, gb); const we = wmErr(W, S.clips, [32], 8).err[0]; curve.push({ it, track: tr.err, wm: we, cos: cos(gb, gt) }); snaps.push({ it, W: W.w.slice(), Pi: Pi.w.slice() }); };
    const t0 = Date.now(); rec(0);
    for (let it = 1; it <= iters; it++) { trainW(W, oW, S.buf, NW, BW, r); trainP(W, Pi, oP, S.buf, NP, BP, r); if (it % 25 === 0) collect(S.buf, Pi, S.clips, r, 1, 200, SIGMA); if (it % 50 === 0) rec(it); }
    return { W, Pi, S, curve, snaps, ms: Date.now() - t0, base: simTrack(null, EVAL, 240).err, gt };
  }
  return { run, setup, EVAL, trainWOnly, simTrack, predVsSim, tipOf, gapOf, wmErr, lossSim, gradW, fdSim, fdW, lrEstimate, cos, norm, policyAct, mkTmp, rng, gauss, simFrame, toMax, local, localVJP, MLP, fwd, bwd, newCache, adam, ref, randClip, wmStep, wmVJP, mkCtx, makeBuffer, collect, trainW, trainP, initNorm, normP, NF, NT, NA, DT, ALPHA, SIGMA, FM, FS, LW };
})();
if (typeof window === 'undefined') { module.exports = Toy; } else (function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { sim: 0x8e9bb8, buf: 0x3aa8e0, wm: 0x4fc98a, pi: 0x38d1ff, loss: 0xf2c14e, grad: 0xff7a59, ref: 0xe6ecf7, pred: 0xf0963c, bad: 0xe05d5d, lr: 0x7cb8ff, crit: 0x9d8cff, tru: 0xd45fa0 };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyNote = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const f2 = (x, n = 2) => (isFinite(x) ? x.toFixed(n) : '发散');
  const memo = (() => { const m = {}; return (k, fn) => (k in m ? m[k] : (m[k] = fn())); })();
  const has = (() => { const seen = new Set(); return { add: k => seen.add(k), has: k => seen.has(k) }; })();

  /* results read from the paper's vector figures (pdftocairo -svg, axes calibrated on the gridlines), 50 bins per curve */
  const PAPER = {"seed":{"xmax":20,"series":[{"n":"ST-1","c":"38d1ff","dash":false,"pts":[[0,0.124],[0.61,0.306],[1.004,0.447],[1.419,0.566],[1.782,0.638],[2.231,0.677],[2.614,0.702],[3.007,0.714],[3.408,0.725],[3.802,0.735],[4.202,0.755],[4.606,0.771],[4.975,0.782],[5.397,0.79],[5.796,0.794],[6.199,0.799],[6.57,0.812],[7.005,0.822],[7.373,0.819],[7.811,0.815],[8.183,0.821],[8.599,0.833],[9.022,0.841],[9.406,0.842],[9.817,0.851],[10.206,0.857],[10.594,0.855],[10.997,0.855],[11.407,0.852],[11.82,0.861],[12.201,0.858],[12.591,0.865],[13.006,0.869],[13.382,0.871],[13.801,0.882],[14.208,0.897],[14.597,0.897],[14.991,0.893],[15.384,0.878],[15.805,0.882],[16.21,0.895],[16.6,0.905],[17.013,0.913],[17.382,0.909],[17.788,0.909],[18.184,0.91],[18.578,0.916],[18.994,0.915],[19.403,0.907],[19.799,0.909],[20.004,0.909]],"lx":0.4,"ly":0.42},{"n":"ST-2","c":"1f9fc0","dash":false,"pts":[[0,0.122],[0.587,0.242],[0.955,0.33],[1.343,0.424],[1.747,0.511],[2.101,0.565],[2.518,0.624],[2.895,0.66],[3.3,0.683],[3.675,0.699],[4.038,0.729],[4.442,0.732],[4.84,0.758],[5.213,0.771],[5.613,0.776],[5.975,0.783],[6.365,0.794],[6.755,0.794],[7.149,0.813],[7.548,0.822],[7.915,0.819],[8.317,0.831],[8.688,0.836],[9.089,0.847],[9.457,0.851],[9.841,0.844],[10.246,0.853],[10.628,0.855],[11.016,0.847],[11.395,0.86],[11.776,0.868],[12.181,0.862],[12.562,0.856],[12.935,0.854],[13.317,0.861],[13.714,0.861],[14.113,0.87],[14.484,0.858],[14.859,0.852],[15.264,0.86],[15.632,0.868],[16.011,0.867],[16.412,0.874],[16.792,0.881],[17.171,0.877],[17.554,0.876],[17.938,0.885],[18.362,0.883],[18.727,0.893],[19.141,0.885],[19.309,0.885]],"lx":1.1,"ly":-0.28},{"n":"ST-3","c":"9fe9ff","dash":false,"pts":[[0,0.121],[0.599,0.244],[1.013,0.346],[1.348,0.425],[1.706,0.491],[2.121,0.573],[2.468,0.627],[2.876,0.663],[3.26,0.691],[3.641,0.714],[3.999,0.724],[4.385,0.741],[4.769,0.75],[5.17,0.762],[5.533,0.776],[5.907,0.778],[6.303,0.773],[6.691,0.77],[7.064,0.785],[7.477,0.796],[7.821,0.815],[8.204,0.811],[8.584,0.83],[8.975,0.841],[9.35,0.827],[9.728,0.826],[10.121,0.816],[10.502,0.818],[10.917,0.827],[11.267,0.829],[11.663,0.836],[12.026,0.829],[12.392,0.83],[12.813,0.847],[13.153,0.841],[13.561,0.858],[13.931,0.85],[14.318,0.859],[14.682,0.861],[15.088,0.861],[15.477,0.854],[15.85,0.866],[16.232,0.877],[16.63,0.883],[17.014,0.879],[17.364,0.882],[17.761,0.865],[18.183,0.876],[18.519,0.878],[18.908,0.87],[19.098,0.87]],"lx":1.3,"ly":-0.95},{"n":"PPO-1","c":"ff7a59","dash":false,"pts":[[0,0.097],[0.594,0.201],[1.009,0.219],[1.393,0.229],[1.824,0.235],[2.202,0.243],[2.595,0.25],[3.002,0.249],[3.405,0.256],[3.796,0.26],[4.185,0.269],[4.596,0.276],[4.992,0.275],[5.42,0.252],[5.809,0.272],[6.21,0.292],[6.598,0.304],[7.01,0.307],[7.387,0.311],[7.772,0.318],[8.192,0.292],[8.599,0.311],[8.986,0.323],[9.377,0.323],[9.81,0.329],[10.199,0.336],[10.589,0.339],[10.992,0.332],[11.394,0.335],[11.81,0.335],[12.206,0.336],[12.627,0.341],[13.001,0.352],[13.409,0.356],[13.811,0.351],[14.195,0.367],[14.619,0.369],[14.993,0.362],[15.411,0.364],[15.794,0.359],[16.201,0.369],[16.603,0.368],[17.0,0.372],[17.395,0.376],[17.796,0.385],[18.197,0.389],[18.604,0.399],[19.006,0.395],[19.39,0.395],[19.791,0.394],[20.0,0.394]],"lx":0,"ly":0.3}],"cap":"ST 三个种子在第 2 小时读到 <b>0.66、0.55、0.55</b>，ST-1 最快；PPO 三个种子几乎重合（只画了一条）"},"engine":{"xmax":20,"series":[{"n":"ST-PhysX","c":"38d1ff","dash":false,"pts":[[0,0.124],[0.61,0.306],[1.004,0.447],[1.419,0.565],[1.782,0.637],[2.231,0.677],[2.614,0.701],[3.007,0.714],[3.408,0.724],[3.802,0.735],[4.202,0.755],[4.606,0.771],[4.975,0.782],[5.397,0.79],[5.796,0.793],[6.199,0.798],[6.57,0.812],[7.005,0.822],[7.373,0.819],[7.811,0.814],[8.183,0.821],[8.599,0.832],[9.022,0.841],[9.406,0.842],[9.817,0.851],[10.206,0.857],[10.594,0.855],[10.997,0.855],[11.407,0.852],[11.82,0.861],[12.201,0.858],[12.591,0.865],[13.006,0.869],[13.382,0.871],[13.801,0.881],[14.208,0.897],[14.597,0.897],[14.991,0.892],[15.384,0.877],[15.805,0.882],[16.21,0.895],[16.6,0.905],[17.013,0.913],[17.382,0.909],[17.788,0.909],[18.184,0.909],[18.578,0.915],[18.994,0.915],[19.403,0.906],[19.799,0.908],[20.004,0.908]],"lx":-3.4,"ly":-0.9},{"n":"ST-Havok","c":"9fe9ff","dash":false,"pts":[[0,0.102],[0.577,0.181],[1.01,0.221],[1.413,0.261],[1.806,0.296],[2.212,0.326],[2.603,0.348],[3.011,0.373],[3.414,0.396],[3.779,0.42],[4.174,0.439],[4.599,0.452],[4.999,0.469],[5.411,0.483],[5.798,0.495],[6.182,0.515],[6.601,0.536],[6.998,0.562],[7.397,0.582],[7.801,0.598],[8.196,0.626],[8.595,0.653],[9.018,0.664],[9.392,0.679],[9.772,0.701],[10.203,0.724],[10.603,0.742],[10.988,0.771],[11.397,0.789],[11.806,0.796],[12.203,0.81],[12.596,0.831],[12.992,0.836],[13.413,0.844],[13.8,0.854],[14.22,0.863],[14.603,0.862],[14.985,0.87],[15.404,0.877],[15.783,0.882],[16.212,0.885],[16.59,0.891],[16.996,0.891],[17.402,0.9],[17.803,0.902],[18.2,0.909],[18.604,0.906],[18.988,0.914],[19.415,0.912],[19.8,0.915],[20.0,0.915]],"lx":1.6,"ly":-0.55},{"n":"ST-Bullet","c":"4fc98a","dash":false,"pts":[[0,0.13],[0.593,0.214],[1.042,0.309],[1.422,0.384],[1.781,0.434],[2.209,0.498],[2.6,0.561],[2.99,0.622],[3.396,0.675],[3.801,0.732],[4.19,0.766],[4.603,0.797],[4.998,0.822],[5.4,0.847],[5.805,0.869],[6.196,0.89],[6.595,0.895],[6.987,0.9],[7.42,0.907],[7.8,0.918],[8.212,0.92],[8.594,0.928],[9.013,0.94],[9.373,0.942],[9.819,0.948],[10.203,0.952],[10.606,0.955],[11.022,0.95],[11.375,0.951],[11.801,0.952],[12.218,0.956],[12.606,0.958],[12.992,0.96],[13.403,0.965],[13.794,0.964],[14.22,0.964],[14.627,0.971],[14.992,0.966],[15.396,0.967],[15.781,0.969],[16.212,0.967],[16.639,0.966],[16.984,0.967],[17.429,0.968],[17.788,0.973],[18.178,0.973],[18.588,0.971],[18.992,0.974],[19.392,0.973],[19.831,0.976],[20.002,0.976]],"lx":0,"ly":0.25},{"n":"PPO-PhysX","c":"ff7a59","dash":false,"pts":[[0,0.096],[0.594,0.201],[1.009,0.219],[1.393,0.229],[1.824,0.234],[2.2,0.243],[2.595,0.25],[3.002,0.248],[3.405,0.255],[3.796,0.26],[4.185,0.269],[4.596,0.275],[4.992,0.275],[5.42,0.252],[5.809,0.272],[6.21,0.291],[6.598,0.303],[7.01,0.306],[7.387,0.311],[7.772,0.317],[8.192,0.292],[8.599,0.311],[8.986,0.323],[9.377,0.322],[9.81,0.329],[10.199,0.336],[10.589,0.338],[10.992,0.331],[11.394,0.334],[11.81,0.334],[12.206,0.335],[12.627,0.341],[13.001,0.352],[13.409,0.355],[13.811,0.351],[14.195,0.367],[14.619,0.369],[14.993,0.362],[15.411,0.364],[15.794,0.358],[16.201,0.369],[16.603,0.368],[17.0,0.372],[17.395,0.376],[17.796,0.385],[18.197,0.389],[18.604,0.399],[19.006,0.395],[19.39,0.395],[19.791,0.394],[20.0,0.394]],"lx":-3.4,"ly":-1.05},{"n":"PPO-Havok","c":"f2c14e","dash":false,"pts":[[0,0.094],[0.61,0.168],[0.989,0.178],[1.398,0.188],[1.795,0.192],[2.202,0.196],[2.595,0.198],[2.996,0.2],[3.395,0.203],[3.804,0.204],[4.198,0.207],[4.592,0.212],[4.988,0.214],[5.404,0.217],[5.796,0.22],[6.184,0.223],[6.586,0.232],[6.985,0.237],[7.387,0.239],[7.803,0.247],[8.193,0.259],[8.602,0.279],[9.012,0.302],[9.402,0.31],[9.813,0.333],[10.208,0.369],[10.588,0.421],[10.999,0.459],[11.408,0.497],[11.806,0.526],[12.212,0.529],[12.603,0.554],[13.01,0.564],[13.394,0.575],[13.791,0.595],[14.194,0.607],[14.598,0.616],[15.008,0.618],[15.401,0.631],[15.79,0.645],[16.197,0.639],[16.603,0.645],[17.0,0.649],[17.407,0.667],[17.788,0.657],[18.192,0.685],[18.608,0.685],[19.001,0.686],[19.396,0.677],[19.799,0.668],[20.0,0.668]],"lx":0,"ly":0},{"n":"PPO-Bullet","c":"ffa58c","dash":false,"pts":[[0,0.097],[0.611,0.165],[1.013,0.185],[1.391,0.193],[1.801,0.201],[2.181,0.209],[2.611,0.218],[3.006,0.222],[3.396,0.225],[3.775,0.232],[4.225,0.229],[4.605,0.237],[4.981,0.242],[5.431,0.244],[5.78,0.248],[6.206,0.254],[6.598,0.262],[7.019,0.265],[7.399,0.263],[7.809,0.263],[8.198,0.27],[8.589,0.279],[9.0,0.29],[9.398,0.297],[9.8,0.301],[10.208,0.307],[10.6,0.315],[11.03,0.321],[11.401,0.329],[11.81,0.334],[12.198,0.338],[12.59,0.346],[13.0,0.342],[13.369,0.346],[13.801,0.363],[14.186,0.359],[14.591,0.359],[15.007,0.356],[15.419,0.35],[15.812,0.362],[16.215,0.377],[16.602,0.402],[17.004,0.393],[17.399,0.393],[17.807,0.407],[18.202,0.409],[18.607,0.404],[19.005,0.414],[19.407,0.426],[19.811,0.437],[20.001,0.437]],"lx":0,"ly":0.15}],"cap":"末端：ST <b>0.91、0.92、0.98</b>；PPO <b>0.39、0.67、0.44</b>。PPO 的极差约是 ST 的 4 倍（我的计算）"},"exp":{"xmax":22,"series":[{"n":"ST 基线","c":"38d1ff","dash":true,"pts":[[0,0.124],[0.645,0.319],[1.113,0.481],[1.564,0.599],[1.946,0.656],[2.421,0.692],[2.848,0.708],[3.314,0.724],[3.754,0.734],[4.181,0.754],[4.629,0.773],[5.041,0.782],[5.504,0.795],[5.924,0.792],[6.391,0.807],[6.839,0.819],[7.24,0.822],[7.724,0.815],[8.103,0.819],[8.564,0.832],[9.039,0.841],[9.46,0.843],[9.883,0.853],[10.346,0.857],[10.8,0.855],[11.206,0.853],[11.654,0.859],[12.068,0.859],[12.533,0.864],[12.978,0.869],[13.416,0.873],[13.848,0.883],[14.289,0.898],[14.758,0.897],[15.185,0.886],[15.626,0.881],[16.067,0.889],[16.481,0.901],[16.958,0.914],[17.36,0.909],[17.817,0.91],[18.258,0.911],[18.696,0.916],[19.111,0.912],[19.592,0.908],[20.01,0.912],[20.464,0.922],[20.887,0.924],[21.344,0.922],[21.789,0.925],[21.995,0.925]],"lx":-2.8,"ly":0.45},{"n":"ST 扔 70%","c":"38d1ff","dash":false,"pts":[[0,0.174],[0.66,0.312],[1.114,0.408],[1.534,0.485],[1.989,0.555],[2.44,0.632],[2.852,0.674],[3.304,0.705],[3.734,0.735],[4.189,0.739],[4.619,0.759],[5.041,0.75],[5.49,0.771],[5.932,0.766],[6.369,0.762],[6.815,0.779],[7.26,0.769],[7.692,0.792],[8.151,0.79],[8.592,0.818],[9.021,0.821],[9.464,0.816],[9.877,0.828],[10.34,0.83],[10.759,0.827],[11.227,0.843],[11.659,0.838],[12.089,0.842],[12.546,0.838],[12.958,0.833],[13.41,0.845],[13.867,0.857],[14.306,0.857],[14.755,0.881],[15.177,0.888],[15.627,0.884],[16.043,0.883],[16.501,0.883],[16.94,0.898],[17.369,0.886],[17.82,0.866],[18.255,0.889],[18.703,0.877],[19.119,0.889],[19.577,0.906],[20.016,0.901],[20.464,0.895],[20.879,0.896],[21.336,0.898],[21.768,0.914],[21.999,0.914]],"lx":-2.4,"ly":-1},{"n":"PPO 基线","c":"ff7a59","dash":true,"pts":[[0,0.097],[0.656,0.205],[1.091,0.221],[1.551,0.233],[1.987,0.238],[2.405,0.249],[2.888,0.249],[3.31,0.253],[3.726,0.259],[4.186,0.27],[4.609,0.276],[5.078,0.268],[5.498,0.256],[5.942,0.278],[6.383,0.3],[6.815,0.305],[7.254,0.308],[7.707,0.318],[8.164,0.293],[8.575,0.31],[9.016,0.323],[9.456,0.324],[9.886,0.33],[10.349,0.339],[10.779,0.335],[11.219,0.333],[11.647,0.337],[12.093,0.333],[12.561,0.341],[12.979,0.351],[13.427,0.355],[13.884,0.353],[14.304,0.371],[14.734,0.367],[15.167,0.361],[15.613,0.361],[16.077,0.367],[16.515,0.367],[16.935,0.373],[17.373,0.375],[17.83,0.386],[18.244,0.39],[18.703,0.399],[19.119,0.395],[19.567,0.395],[20.026,0.397],[20.465,0.404],[20.896,0.402],[21.337,0.403],[21.763,0.407],[21.995,0.407]],"lx":-2.2,"ly":0.1},{"n":"PPO 扔 70%","c":"ff7a59","dash":false,"pts":[[0,0.094],[0.668,0.176],[1.086,0.192],[1.535,0.2],[1.992,0.194],[2.42,0.194],[2.844,0.201],[3.31,0.163],[3.743,0.19],[4.18,0.206],[4.615,0.219],[5.047,0.226],[5.498,0.229],[5.927,0.229],[6.389,0.238],[6.809,0.242],[7.255,0.242],[7.689,0.237],[8.151,0.21],[8.585,0.233],[9.012,0.244],[9.452,0.242],[9.896,0.247],[10.334,0.25],[10.771,0.248],[11.204,0.25],[11.673,0.262],[12.099,0.259],[12.543,0.268],[12.971,0.274],[13.421,0.263],[13.859,0.258],[14.289,0.264],[14.727,0.271],[15.195,0.269],[15.625,0.267],[16.058,0.262],[16.491,0.263],[16.941,0.26],[17.366,0.266],[17.816,0.27],[18.252,0.27],[18.71,0.282],[19.106,0.279],[19.572,0.275],[20.024,0.277],[20.47,0.277],[20.882,0.285],[21.347,0.278],[21.765,0.282],[21.996,0.282]],"lx":-2.2,"ly":-0.9}],"cap":"ST 几乎不变。PPO 到 0.26 从约 <b>4.0 小时变成约 11.9 小时</b>，约 3 倍；保留的数据少了 3.3 倍（读数，我的计算）"},"sync":{"xmax":18.5,"series":[{"n":"ST 基线","c":"38d1ff","dash":true,"pts":[[0,0.124],[0.569,0.29],[0.919,0.419],[1.277,0.528],[1.674,0.621],[2.032,0.664],[2.394,0.69],[2.762,0.704],[3.146,0.72],[3.513,0.725],[3.874,0.739],[4.245,0.757],[4.631,0.771],[4.975,0.782],[5.369,0.789],[5.748,0.795],[6.099,0.793],[6.451,0.81],[6.852,0.819],[7.223,0.822],[7.624,0.813],[7.934,0.814],[8.344,0.829],[8.68,0.834],[9.07,0.842],[9.452,0.842],[9.82,0.851],[10.155,0.856],[10.533,0.856],[10.917,0.855],[11.299,0.851],[11.662,0.859],[12.03,0.859],[12.421,0.861],[12.76,0.868],[13.14,0.868],[13.509,0.874],[13.888,0.884],[14.254,0.899],[14.608,0.897],[14.981,0.892],[15.368,0.879],[15.752,0.882],[16.1,0.89],[16.459,0.9],[16.837,0.913],[17.206,0.91],[17.583,0.909],[17.947,0.908],[18.324,0.912],[18.503,0.912]],"lx":-1,"ly":0.45},{"n":"ST-15","c":"38d1ff","dash":false,"pts":[[0,0.123],[0.584,0.247],[0.919,0.329],[1.318,0.432],[1.684,0.513],[2.05,0.577],[2.413,0.633],[2.764,0.67],[3.136,0.7],[3.509,0.722],[3.882,0.735],[4.258,0.739],[4.623,0.742],[4.984,0.748],[5.369,0.758],[5.734,0.775],[6.1,0.779],[6.453,0.784],[6.837,0.792],[7.222,0.772],[7.573,0.779],[7.951,0.788],[8.342,0.806],[8.703,0.809],[9.051,0.814],[9.44,0.83],[9.827,0.816],[10.199,0.821],[10.518,0.819],[10.931,0.83],[11.282,0.83],[11.67,0.84],[12.028,0.858],[12.386,0.86],[12.754,0.848],[13.146,0.855],[13.521,0.851],[13.877,0.856],[14.278,0.867],[14.611,0.874],[14.988,0.877],[15.356,0.878],[15.734,0.868],[16.106,0.859],[16.453,0.874],[16.842,0.875],[17.216,0.878],[17.573,0.882],[17.954,0.882],[18.337,0.884],[18.506,0.884]],"lx":-1.6,"ly":-0.95},{"n":"ST-100","c":"4fc98a","dash":false,"pts":[[0,0.122],[0.389,0.211],[0.656,0.297],[0.846,0.354],[1.123,0.439],[1.39,0.526],[1.653,0.595],[1.91,0.647],[2.142,0.663],[2.408,0.689],[2.654,0.702],[2.923,0.715],[3.186,0.734],[3.435,0.749],[3.663,0.756],[3.929,0.764],[4.184,0.762],[4.451,0.771],[4.697,0.779],[4.944,0.787],[5.209,0.79],[5.471,0.799],[5.726,0.805],[5.955,0.809],[6.232,0.813],[6.468,0.826],[6.736,0.819],[6.986,0.826],[7.248,0.826],[7.506,0.832],[7.746,0.833],[7.977,0.833],[8.271,0.849],[8.509,0.848],[8.76,0.827],[9.029,0.844],[9.29,0.856],[9.532,0.862],[9.791,0.864],[10.036,0.869],[10.297,0.871],[10.554,0.866],[10.794,0.865],[11.062,0.868],[11.311,0.871],[11.567,0.87],[11.828,0.868],[12.081,0.868],[12.335,0.87],[12.581,0.871],[12.711,0.871]],"lx":-0.6,"ly":0.45},{"n":"PPO 基线","c":"ff7a59","dash":true,"pts":[[0,0.096],[0.55,0.198],[0.895,0.215],[1.266,0.226],[1.662,0.233],[2.025,0.238],[2.406,0.249],[2.78,0.25],[3.139,0.249],[3.515,0.258],[3.887,0.262],[4.255,0.27],[4.617,0.276],[5.003,0.276],[5.373,0.25],[5.738,0.269],[6.1,0.286],[6.466,0.301],[6.845,0.305],[7.214,0.307],[7.591,0.315],[7.943,0.307],[8.316,0.297],[8.691,0.313],[9.071,0.324],[9.423,0.323],[9.823,0.329],[10.168,0.335],[10.539,0.34],[10.92,0.332],[11.3,0.333],[11.659,0.337],[12.03,0.332],[12.369,0.337],[12.765,0.345],[13.138,0.355],[13.488,0.354],[13.9,0.352],[14.254,0.369],[14.625,0.369],[14.99,0.362],[15.368,0.363],[15.724,0.359],[16.103,0.367],[16.477,0.366],[16.847,0.371],[17.217,0.37],[17.582,0.382],[17.969,0.386],[18.313,0.392],[18.505,0.392]],"lx":0,"ly":0},{"n":"PPO-15","c":"ff7a59","dash":false,"pts":[[0,0.096],[0.555,0.158],[0.926,0.167],[1.28,0.173],[1.631,0.176],[2.066,0.175],[2.438,0.163],[2.779,0.164],[3.095,0.162],[3.529,0.158],[3.872,0.153],[4.251,0.147],[4.627,0.155],[4.993,0.164],[5.36,0.176],[5.756,0.177],[6.12,0.181],[6.478,0.173],[6.855,0.178],[7.189,0.185],[7.562,0.186],[7.943,0.192],[8.309,0.188],[8.673,0.192],[9.082,0.195],[9.435,0.197],[9.803,0.212],[10.174,0.197],[10.543,0.202],[10.915,0.21],[11.261,0.227],[11.688,0.232],[12.007,0.23],[12.416,0.228],[12.705,0.21],[13.112,0.176],[13.544,0.196],[13.871,0.189],[14.241,0.203],[14.593,0.205],[14.981,0.218],[15.371,0.2],[15.719,0.196],[16.113,0.2],[16.476,0.206],[16.845,0.22],[17.217,0.206],[17.596,0.212],[17.933,0.215],[18.314,0.224],[18.504,0.224]],"lx":0,"ly":-0.8}],"cap":"环境里的策略落后 15 或 100 次迭代：ST 基本不受影响，PPO 从 <b>0.40 掉到 0.23</b>。ST-100 只画到 12.7 小时"},"imb":{"xmax":10,"series":[{"n":"ST","c":"38d1ff","dash":false,"pts":[[0,0.103],[0.182,0.119],[0.299,0.147],[0.446,0.206],[0.566,0.277],[0.681,0.36],[0.821,0.444],[0.933,0.5],[1.056,0.559],[1.179,0.611],[1.312,0.652],[1.441,0.684],[1.568,0.712],[1.677,0.727],[1.801,0.75],[1.942,0.766],[2.061,0.778],[2.183,0.786],[2.309,0.797],[2.433,0.811],[2.554,0.82],[2.695,0.826],[2.817,0.83],[2.935,0.833],[3.067,0.851],[3.196,0.862],[3.321,0.872],[3.44,0.869],[3.568,0.866],[3.696,0.868],[3.815,0.87],[3.939,0.866],[4.063,0.865],[4.198,0.868],[4.318,0.872],[4.442,0.874],[4.573,0.878],[4.69,0.88],[4.812,0.882],[4.927,0.88],[5.078,0.888],[5.194,0.884],[5.313,0.879],[5.453,0.886],[5.568,0.893],[5.695,0.894],[5.803,0.898],[5.955,0.893],[6.061,0.898],[6.199,0.907],[6.256,0.907]],"lx":0,"ly":0},{"n":"PPO","c":"ff7a59","dash":false,"pts":[[0,0.094],[0.297,0.144],[0.513,0.173],[0.706,0.201],[0.894,0.233],[1.109,0.282],[1.292,0.311],[1.494,0.327],[1.713,0.369],[1.911,0.397],[2.1,0.416],[2.298,0.43],[2.503,0.453],[2.702,0.475],[2.896,0.477],[3.094,0.493],[3.301,0.502],[3.501,0.515],[3.696,0.502],[3.896,0.507],[4.095,0.513],[4.301,0.526],[4.496,0.52],[4.694,0.518],[4.905,0.522],[5.101,0.534],[5.3,0.532],[5.503,0.531],[5.701,0.541],[5.905,0.538],[6.1,0.519],[6.3,0.534],[6.514,0.54],[6.704,0.545],[6.903,0.553],[7.1,0.563],[7.286,0.551],[7.497,0.561],[7.695,0.57],[7.916,0.554],[8.1,0.556],[8.3,0.564],[8.492,0.566],[8.7,0.556],[8.901,0.564],[9.108,0.571],[9.296,0.578],[9.501,0.578],[9.707,0.575],[9.906,0.572],[10.002,0.572]],"lx":0,"ly":0}],"mark":[1.5,"1.5 小时"],"cap":"Motion Matching 数据集，Walk 过采样 10 倍。竖线是论文标的 ST 学会跑步的时刻；PPO 10 小时后只有走路稳定"},"wm":{"xmax":3,"series":[{"n":"N_W=8","c":"38d1ff","dash":false,"pts":[[0,0.125],[0.092,0.171],[0.148,0.192],[0.209,0.205],[0.27,0.212],[0.331,0.223],[0.388,0.24],[0.448,0.249],[0.513,0.258],[0.569,0.27],[0.631,0.279],[0.691,0.293],[0.749,0.307],[0.811,0.318],[0.874,0.328],[0.927,0.34],[0.991,0.35],[1.051,0.359],[1.109,0.373],[1.168,0.383],[1.232,0.397],[1.287,0.407],[1.353,0.422],[1.41,0.43],[1.471,0.443],[1.532,0.454],[1.593,0.46],[1.651,0.471],[1.71,0.481],[1.769,0.488],[1.83,0.501],[1.889,0.505],[1.952,0.505],[2.011,0.516],[2.071,0.532],[2.13,0.539],[2.191,0.544],[2.249,0.554],[2.31,0.565],[2.372,0.573],[2.427,0.569],[2.49,0.569],[2.55,0.582],[2.61,0.592],[2.672,0.595],[2.732,0.605],[2.789,0.609],[2.854,0.608],[2.912,0.615],[2.972,0.619],[3.001,0.619]],"lx":0,"ly":0},{"n":"N_W=16","c":"9fe9ff","dash":false,"pts":[[0,0.121],[0.084,0.133],[0.156,0.147],[0.213,0.156],[0.278,0.168],[0.324,0.176],[0.391,0.185],[0.453,0.198],[0.512,0.21],[0.573,0.222],[0.616,0.229],[0.695,0.245],[0.753,0.256],[0.81,0.266],[0.869,0.274],[0.927,0.287],[0.982,0.299],[1.054,0.314],[1.105,0.327],[1.167,0.339],[1.236,0.35],[1.291,0.359],[1.352,0.37],[1.413,0.386],[1.472,0.397],[1.534,0.404],[1.596,0.412],[1.651,0.423],[1.713,0.434],[1.78,0.445],[1.832,0.456],[1.89,0.47],[1.954,0.481],[2.013,0.488],[2.066,0.49],[2.13,0.498],[2.194,0.507],[2.254,0.512],[2.315,0.52],[2.371,0.526],[2.434,0.53],[2.495,0.538],[2.565,0.551],[2.614,0.559],[2.67,0.567],[2.734,0.577],[2.796,0.583],[2.855,0.587],[2.906,0.589],[2.98,0.602],[3.005,0.602]],"lx":0,"ly":-0.75},{"n":"N_W=32","c":"f2c14e","dash":false,"pts":[[0,0.124],[0.085,0.165],[0.152,0.18],[0.209,0.182],[0.267,0.18],[0.334,0.183],[0.39,0.186],[0.45,0.187],[0.509,0.191],[0.569,0.199],[0.631,0.203],[0.694,0.205],[0.754,0.206],[0.809,0.21],[0.87,0.212],[0.927,0.216],[0.992,0.223],[1.048,0.229],[1.11,0.236],[1.169,0.243],[1.23,0.249],[1.294,0.254],[1.352,0.258],[1.406,0.265],[1.471,0.271],[1.533,0.271],[1.591,0.279],[1.645,0.284],[1.71,0.284],[1.773,0.292],[1.828,0.298],[1.89,0.303],[1.952,0.309],[2.007,0.314],[2.071,0.316],[2.125,0.318],[2.191,0.327],[2.247,0.33],[2.312,0.335],[2.37,0.341],[2.43,0.344],[2.492,0.346],[2.549,0.352],[2.609,0.364],[2.667,0.372],[2.731,0.375],[2.788,0.378],[2.852,0.383],[2.909,0.387],[2.967,0.396],[3.001,0.396]],"lx":0,"ly":0},{"n":"N_W=64","c":"ff7a59","dash":false,"pts":[[0,0.122],[0.09,0.164],[0.154,0.177],[0.211,0.178],[0.272,0.169],[0.331,0.174],[0.393,0.174],[0.453,0.173],[0.507,0.173],[0.571,0.175],[0.63,0.175],[0.692,0.177],[0.747,0.176],[0.808,0.182],[0.874,0.184],[0.928,0.183],[0.994,0.186],[1.049,0.189],[1.108,0.19],[1.163,0.191],[1.23,0.199],[1.288,0.2],[1.347,0.204],[1.414,0.205],[1.473,0.206],[1.53,0.207],[1.588,0.208],[1.652,0.207],[1.703,0.206],[1.767,0.209],[1.832,0.211],[1.887,0.208],[1.953,0.209],[2.01,0.213],[2.07,0.213],[2.126,0.216],[2.191,0.219],[2.248,0.225],[2.309,0.221],[2.371,0.224],[2.433,0.228],[2.488,0.231],[2.551,0.233],[2.611,0.229],[2.67,0.229],[2.733,0.235],[2.789,0.237],[2.85,0.234],[2.909,0.237],[2.974,0.239],[3.0,0.239]],"lx":0,"ly":0}],"cap":"3 小时读数 <b>0.62、0.60、0.39、0.24</b>。窗口太大 W 可能忽略动作，策略就学不动（论文的解释）"},"pi":{"xmax":3.5,"series":[{"n":"N_Π=16","c":"9fe9ff","dash":false,"pts":[[0,0.125],[0.108,0.16],[0.174,0.183],[0.25,0.209],[0.312,0.227],[0.383,0.242],[0.459,0.255],[0.527,0.265],[0.594,0.271],[0.664,0.277],[0.734,0.285],[0.803,0.288],[0.874,0.291],[0.936,0.292],[1.011,0.293],[1.092,0.299],[1.162,0.307],[1.225,0.31],[1.29,0.312],[1.369,0.315],[1.438,0.317],[1.509,0.32],[1.577,0.322],[1.644,0.322],[1.713,0.319],[1.783,0.322],[1.859,0.326],[1.923,0.328],[1.989,0.329],[2.064,0.328],[2.134,0.332],[2.21,0.334],[2.281,0.336],[2.346,0.336],[2.42,0.339],[2.482,0.339],[2.549,0.344],[2.621,0.348],[2.684,0.349],[2.767,0.345],[2.834,0.344],[2.907,0.345],[2.976,0.347],[3.043,0.352],[3.114,0.356],[3.183,0.352],[3.254,0.351],[3.321,0.356],[3.397,0.36],[3.468,0.363],[3.5,0.363]],"lx":0,"ly":0},{"n":"N_Π=32","c":"38d1ff","dash":false,"pts":[[0,0.122],[0.109,0.157],[0.177,0.176],[0.25,0.196],[0.315,0.214],[0.379,0.233],[0.456,0.251],[0.524,0.266],[0.597,0.276],[0.673,0.298],[0.734,0.314],[0.805,0.334],[0.88,0.354],[0.948,0.368],[1.017,0.382],[1.086,0.401],[1.158,0.42],[1.227,0.442],[1.29,0.454],[1.366,0.468],[1.438,0.48],[1.502,0.498],[1.574,0.514],[1.644,0.528],[1.714,0.539],[1.788,0.545],[1.853,0.556],[1.924,0.57],[1.996,0.572],[2.07,0.582],[2.136,0.59],[2.206,0.592],[2.275,0.597],[2.342,0.613],[2.416,0.618],[2.487,0.627],[2.556,0.638],[2.628,0.646],[2.696,0.651],[2.77,0.661],[2.836,0.67],[2.903,0.678],[2.976,0.685],[3.048,0.682],[3.115,0.688],[3.183,0.686],[3.257,0.697],[3.329,0.708],[3.396,0.713],[3.469,0.719],[3.502,0.719]],"lx":-0.8,"ly":0},{"n":"N_Π=64","c":"ff7a59","dash":false,"pts":[[0,0.123],[0.057,0.14],[0.097,0.154],[0.131,0.163],[0.173,0.175],[0.212,0.182],[0.254,0.19],[0.281,0.195],[0.327,0.201],[0.364,0.205],[0.399,0.212],[0.436,0.219],[0.476,0.227],[0.511,0.236],[0.55,0.242],[0.588,0.249],[0.629,0.261],[0.664,0.265],[0.703,0.274],[0.739,0.28],[0.775,0.29],[0.818,0.307],[0.855,0.326],[0.896,0.349],[0.936,0.367],[0.965,0.382],[1.007,0.399],[1.044,0.416],[1.087,0.44],[1.125,0.461],[1.164,0.478],[1.196,0.489],[1.237,0.496],[1.273,0.506],[1.312,0.525],[1.352,0.542],[1.388,0.561],[1.429,0.573],[1.467,0.589],[1.5,0.6],[1.543,0.61],[1.579,0.622],[1.613,0.634],[1.658,0.641],[1.694,0.646],[1.731,0.649],[1.769,0.645],[1.804,0.648],[1.845,0.655],[1.888,0.659],[1.902,0.659]],"lx":0.1,"ly":0.2}],"mark":[1.9,"N_Π=64 在此终止"],"cap":"N_Π = 64 在 1.9 小时终止，读数 <b>0.66</b>，那时 N_Π = 32 只有 <b>0.56</b>：它之前学得比 32 快，然后训练不稳定而终止"},"off":{"xmax":11,"series":[{"n":"PD 偏移","c":"38d1ff","dash":false,"pts":[[0,0.125],[0.308,0.198],[0.557,0.285],[0.768,0.365],[0.992,0.445],[1.219,0.512],[1.423,0.568],[1.653,0.619],[1.862,0.65],[2.096,0.669],[2.32,0.684],[2.537,0.702],[2.749,0.702],[2.974,0.714],[3.186,0.722],[3.41,0.725],[3.624,0.727],[3.851,0.739],[4.075,0.748],[4.284,0.76],[4.514,0.768],[4.743,0.778],[4.952,0.782],[5.173,0.781],[5.387,0.791],[5.622,0.799],[5.841,0.792],[6.056,0.792],[6.277,0.803],[6.485,0.811],[6.732,0.815],[6.933,0.823],[7.136,0.823],[7.361,0.82],[7.603,0.813],[7.818,0.816],[8.027,0.813],[8.239,0.826],[8.474,0.831],[8.699,0.835],[8.915,0.841],[9.134,0.842],[9.355,0.843],[9.576,0.844],[9.797,0.851],[10.018,0.855],[10.197,0.857],[10.45,0.858],[10.685,0.854],[10.894,0.856],[11.004,0.856]],"lx":-2.2,"ly":0.2},{"n":"PD 绝对","c":"ff7a59","dash":false,"pts":[[0,0.096],[0.309,0.133],[0.564,0.143],[0.769,0.165],[0.995,0.176],[1.214,0.196],[1.439,0.21],[1.647,0.215],[1.871,0.224],[2.089,0.228],[2.296,0.234],[2.527,0.236],[2.756,0.239],[2.969,0.239],[3.204,0.239],[3.406,0.246],[3.635,0.25],[3.839,0.252],[4.071,0.255],[4.289,0.254],[4.508,0.254],[4.725,0.256],[4.948,0.261],[5.177,0.263],[5.385,0.259],[5.609,0.267],[5.825,0.262],[6.054,0.261],[6.264,0.259],[6.491,0.261],[6.712,0.262],[6.913,0.264],[7.141,0.26],[7.369,0.255],[7.59,0.257],[7.803,0.263],[8.035,0.267],[8.255,0.268],[8.468,0.267],[8.687,0.266],[8.907,0.264],[9.128,0.264],[9.354,0.27],[9.569,0.267],[9.807,0.262],[10.002,0.258],[10.229,0.259],[10.453,0.257],[10.656,0.256],[10.894,0.261],[11.0,0.261]],"lx":-1.8,"ly":0.2}],"cap":"输出偏移约 <b>0.86</b>，输出绝对目标约 <b>0.26</b>"},"out":{"xmax":20,"series":[{"n":"加速度","c":"38d1ff","dash":false,"pts":[[0,0.125],[0.61,0.306],[1.004,0.447],[1.419,0.566],[1.782,0.638],[2.231,0.678],[2.614,0.702],[3.007,0.714],[3.407,0.725],[3.802,0.736],[4.202,0.755],[4.606,0.771],[4.975,0.782],[5.397,0.79],[5.796,0.794],[6.199,0.799],[6.57,0.813],[7.005,0.822],[7.373,0.819],[7.811,0.815],[8.183,0.822],[8.599,0.833],[9.022,0.842],[9.406,0.842],[9.817,0.851],[10.2,0.857],[10.594,0.855],[10.997,0.856],[11.407,0.853],[11.82,0.861],[12.201,0.859],[12.582,0.865],[13.012,0.869],[13.386,0.872],[13.801,0.882],[14.208,0.898],[14.597,0.897],[14.992,0.893],[15.384,0.878],[15.805,0.882],[16.21,0.895],[16.6,0.905],[17.013,0.913],[17.382,0.91],[17.788,0.91],[18.184,0.91],[18.579,0.916],[18.996,0.916],[19.401,0.907],[19.799,0.909],[20.004,0.909]],"lx":-2.3,"ly":0.25},{"n":"速度","c":"ff7a59","dash":false,"pts":[[0,0.124],[0.617,0.22],[1.004,0.285],[1.386,0.333],[1.809,0.388],[2.199,0.457],[2.606,0.517],[2.985,0.549],[3.416,0.548],[3.814,0.553],[4.183,0.566],[4.596,0.569],[5.003,0.585],[5.417,0.609],[5.815,0.616],[6.211,0.62],[6.581,0.623],[7.012,0.633],[7.424,0.641],[7.8,0.655],[8.223,0.656],[8.601,0.692],[8.988,0.691],[9.404,0.708],[9.801,0.725],[10.192,0.716],[10.598,0.7],[11.009,0.716],[11.405,0.725],[11.791,0.728],[12.198,0.722],[12.611,0.738],[12.996,0.747],[13.396,0.764],[13.801,0.782],[14.182,0.772],[14.615,0.766],[15.014,0.774],[15.4,0.77],[15.798,0.766],[16.193,0.771],[16.601,0.779],[17.016,0.786],[17.424,0.802],[17.813,0.806],[18.212,0.806],[18.605,0.813],[19.003,0.822],[19.387,0.839],[19.793,0.84],[20.007,0.84]],"lx":-1.6,"ly":-0.95}],"cap":"输出加速度 20 小时约 <b>0.91</b>，输出速度约 <b>0.84</b>，前期差得更多（第 2 小时 0.66 对 0.42）"}};

  const SCENES = [
    { n: 1, part: '总览', title: '两个网络，一个数据缓存', sub: '环境写缓存；世界模型和策略都从缓存里取窗口', dur: 15, cam: [0.1, 1.05, 31, [0.3, 3.6, 0]],
      html: dl([['环境', '256 个角色，约 5000 样本/秒'], ['缓存', '循环缓存，约 150,000 个样本，存 S、K、T'], ['世界模型 W', '取 8 帧窗口，学预测物理'], ['策略 Π', '取 32 帧窗口，穿过 W 学跟踪']]) +
        '<p>每次迭代做四件事：把环境的新数据拉进缓存；把当前策略发回环境；用算法 1 训练 W 一步；用算法 2 训练 Π 一步。两个网络都只是最小化一个损失，这就是标题里 supervised learning 的意思。</p>' +
        '<p>环境（PhysX 这类游戏物理引擎）不提供梯度，也不需要提供。它只产生数据。W 学会之后，就是一个能求导的仿真器替身，梯度从 W 穿过去。</p>' +
        '<p>论文说这件事靠四个观察：跟踪损失是状态的简单可导函数；参考动作不受模拟角色影响，所以 K 不用预测；模拟角色的转移来自确定性物理，前馈网络就能拟合；W 可导，所以损失能一路反传到 Π。</p>' +
        '<p>点画面里的方框可以跳到对应那一幕。</p>' + src('§1 · §3.6') },
    { n: 2, part: '环境', title: '256 个角色和一个 30 秒的缓存', sub: '回合长度、复位规则、缓存能存多久', dur: 15, cam: [-0.05, 1.05, 29, [0.6, 0.9, 0.6]],
      html: dl([['角色', '256 个，并行'], ['复位', '超过 512 帧，或超过 48 帧且头高偏差 > 25 cm'], ['RSI', '随机动作的随机帧，竖直修正防穿地'], ['速率', '约 5000 样本/秒'], ['缓存', '约 150,000 样本'], ['物理', '240 Hz，约束求解 20 次迭代']]) +
        '<p>写法和 <a class="ds" href="https://arxiv.org/abs/1804.02717" target="_blank" rel="noopener">DeepMimic</a> 的训练环境类似。RSI（reference state initialization）是把角色直接放到参考动作的某一帧开始，这样后面的动作也练得到。回合结束后，这一段样本才整段写进缓存。</p>' +
        '<p>这一幕的时间轴是墙钟 30 秒。按论文的两个数字算：150,000 ÷ 5000 = <b>30 秒</b>，缓存就转完一圈。所以缓存里的数据总是最近半分钟产生的。256 × 60 = 15,360 帧/秒才算实时，5000 样本/秒约是实时的三分之一（我的计算，<a href="../../papers/supertrack.html#n3" target="_top">读者注 3</a>）。</p>' +
        guess('每个小人是同一个小图形，摇摆和复位时刻是我用随机数排的，只满足 48 到 512 帧的规则。写入缓存的累计数按 5000 样本/秒算。') + src('§3.1 · §3.6 · §5.3') },
    { n: 3, part: '表示', title: '世界坐标换成角色局部坐标', sub: '式 (1) 到 (7)：同一个姿态，网络看到的输入不变', dur: 16, cam: [0.05, 1.22, 27, [-0.4, 2.6, 0]], ctl: { label: '看哪个刚体', items: ['右手', '头', '左脚'] },
      html: dl([['世界状态 X', 'xᵖ 3B、ẋᵖ 3B、xʳ 4B、ẋʳ 3B'], ['Local(X)', 'x^lp 3B、ẋ^lp 3B、x^lr 6B、ẋ^lr 3B、xʰ B、x^up 3'], ['总维度', '16B + 3 = 323（B = 20，我的加法）']]) +
        '<p>同一个动作换个地点、换个朝向，物理是一样的。所以先乘上根刚体（通常是胯）变换的逆，换到角色空间，网络不用重新学每个朝向。</p>' +
        '<p>四元数还有双重覆盖问题：q 和 −q 是同一个旋转，但数值完全不同。换成旋转矩阵的前两列（two-axis，6 维）就没有这个问题。动画后段页面会现算 q 和 −q 的 two-axis 给你看。</p>' +
        '<p>丢掉了全局位置和朝向之后，还要把接触线索补回来：xʰ 是每个刚体离地（或高度图）的高度，x^up 是竖直方向在根坐标系里的方向。论文说网络可以从这两项推断接触。最后每个量按动作库离线统计的均值和标准差归一化。</p>' +
        guess('20 个刚体的摆法是我手摆的，论文只给了数量 B = 20、J = 19。柱子和数字是用式 (2) 现算的，不是假数据：角色在移动和旋转，世界坐标在变，局部坐标不变。') + src('§3.2 · §3.3 式 (1)–(7) · 表 2') },
    { n: 4, part: '世界模型', title: 'W 走一步：预测加速度，再积分', sub: '这一幕的数字来自玩具上现训的 W 和真实仿真', dur: 15, toy: true, cam: [0, 1.32, 19, [1.2, 3.8, 0]],
      html: dl([['输入', 'Local(P), T'], ['输出', '局部加速度 ẍ^lp、ẍ^lr，共 6B 维'], ['网络', '5 层隐藏，每层 1024，ELU'], ['积分', '式 (8)–(12)，先更新速度，再用新速度更新位置']]) +
        '<div class="eq-mini">ẏ = dt·ẍ + ẋ，y = dt·ẏ + x，yʳ = exp(dt/2·ẏʳ) ⊗ xʳ</div>' +
        '<p>网络不直接输出下一状态，只输出局部坐标系里的加速度。转回世界系（乘根刚体旋转）和积分都是写死的公式，而且都可导。这样物理的一部分结构不用学。</p>' +
        '<p>注意每个刚体的位置和旋转是分开预测的，这叫最大坐标。没有什么东西强制关节连着，关节约束只能靠学。下一幕长时间滚动时可以看到连接断开，论文图 14 也有同样的现象。</p>' +
        toyNote('二维的两连杆，B = 2，关节由 PD 驱动，240 Hz 子步，每帧 1/60 秒。网络是 2 层、每层 32，只有约 2000 个参数，页面打开这一幕时现场训练。玩具没有接触，也不是人形。橙色箭头是 W 的预测，粉色箭头是仿真器真实的加速度。') + src('§3.4 式 (8)–(12) · 算法 1 · 表 1') },
    { n: 5, part: '世界模型', title: 'W 的训练：滚 8 帧，比 8 帧', sub: '切换窗口，看自由滚动误差和关节断开', dur: 18, toy: true, cam: [0, 1.32, 21, [3.0, 3.6, 0]], ctl: { label: '窗口 N_W', items: ['1', '2', '8', '32'], def: 2 },
      html: dl([['窗口', 'N_W = 8 帧 = 0.133 秒（60 Hz）'], ['起点', 'P₀ = S₀，缓存里的真实状态'], ['目标 T', '缓存里记录的 PD 目标'], ['批量', '2048，学习率 0.001，RAdam'], ['损失', '世界空间 L1：位置、速度、旋转、角速度']]) +
        '<p>从 S₀ 出发，W 吃自己上一步的预测继续往前滚，每一帧都和真实 S 比，误差一路反传回每一步。窗口结束后重新从真值开始，所以论文把它看成每 N_W 帧做一次 teacher forcing。</p>' +
        '<p><b>动画前 30%</b> 是训练时的样子，每 N_W 帧跳回真值。<b>后 70%</b> 是自由滚动 128 帧，不再重置。橙色是 W，灰色是仿真器，两者收到同样的目标。切换窗口会重训一次 W，右边柱子现算自由滚动误差。</p>' +
        '<p>玩具上 N_W = 1 只训练下一步，滚长了就飞出画面。这正是窗口训练要解决的问题。不过玩具上窗口越长、W 自由滚动越准，它本身看不出论文 §6.1 说的“窗口太长有害”，那个现象要看第 8 幕对策略的影响和第 10 幕的原图数据。</p>' +
        toyNote('同第 4 幕。每个窗口训练 800 次，总帧数大致相同。误差是末端位置误差（米），36 个起点的平均。') + src('§3.4 · 算法 1 · 图 2 · 图 14 · §6.1') },
    { n: 6, part: '策略', title: '策略只输出 PD 偏移', sub: '偏移乘到参考姿态上；玩具上现算 PD 的下垂和修正', dur: 15, toy: true, cam: [0, 1.32, 17, [1.0, 3.9, 0]], ctl: { label: '角色', items: ['只用 PD', '加上 Π', '都显示'], def: 2 },
      html: dl([['输入', 'Local(P), Local(K)'], ['输出', 'o ∈ R³ᴶ（J = 19 时 57 维）'], ['目标', 't = exp(α/2 · ô) ⊗ kᵗ，ṫ = k̇ᵗ'], ['噪声', 'ô = o + σN(0,1)，σ = 0.1'], ['缩放', 'α = 120']]) +
        '<p>Π 不直接给关节目标，只给一个小的旋转，乘到参考姿态上。什么都不输出时，角色就是在用 PD 硬跟参考。</p>' +
        '<p>只用 PD 跟不上，主要是因为重力和动态力矩。浅色粗的是参考；红色只用 PD，明显下垂；青色加了 Π。细线是 PD 的目标：Π 让它比参考更高一点，这样 PD 才能把手臂托到参考的位置。</p>' +
        '<p>图 15 的消融：直接输出绝对目标（PD-abs）在 LaFAN 上约 0.26，偏移版约 0.86。论文解释是参考姿态提供了一个很好的起点。这个玩具上两者差别不大，任务太简单。</p>' +
        '<p>论文里 α = 120 没写单位。按乘到旋转上的用法只能是度，那么 o = 1 对应 120°，σ = 0.1 的噪声相当于约 12°（我的推断，<a href="../../papers/supertrack.html#n2" target="_top">读者注 2</a>）。</p>' +
        toyNote('二维里 exp 就是角度相加。玩具的 α = 1 弧度。动作是我写的正弦组合，训练 1000 次后在真实仿真器里评测。') + src('§3.2 · §3.5 · §6.2 · 算法 2 · 表 1') },
    { n: 7, part: '策略', title: '穿过 W 反传 32 帧', sub: '柱高是页面现算的每帧梯度，粉框是仿真器上的有限差分', dur: 17, toy: true, cam: [0, 1.25, 25, [0, 3.6, 0]], ctl: { label: '窗口 N_Π', items: ['8', '16', '32', '64', '128'], def: 2 },
      html: dl([['窗口', 'N_Π = 32 帧 = 0.533 秒'], ['起点', 'P₀ = S₀'], ['每帧', 'Π 出偏移 → T → W → 积分 → 下一帧 P'], ['损失', '局部空间 L1：位置、速度、旋转、角速度、高度、up；再加 o 的 L2 和 L1 正则'], ['批量', '1024，学习率 0.0001']]) +
        '<p>Π 和 W 交替展开 32 次。损失和参考 K 比，在局部空间算。只更新 Π 的权重，W 的权重在这一步不动，但梯度要穿过它，还要穿过积分和局部坐标变换。正则项 L2 和 L1 比其他损失小两个数量级，用来压住大偏移。</p>' +
        '<p>这一幕现算两种梯度，都是跟踪损失对每一帧偏移的导数，起点是偏移全零：<b>绿柱</b>是页面手写的反向传播穿过 W 得到的；<b>粉框</b>是在真实仿真器上逐个扰动、做中心差分得到的，这是“正确答案”。W 的结果另外和对 W 本身做的有限差分比对过，用来确认反向传播没写错。</p>' +
        '<p>切换窗口可以看梯度随步数怎么变，和真实梯度的夹角在长窗口下怎样变差。</p>' +
        toyNote('二维两连杆，用现场训练 1000 次后的 W。论文不是对偏移序列求导，而是对 Π 的权重求导。对权重的梯度也在第 8 幕训练时真实使用。') + src('§3.5 · 算法 2 · 图 3') },
    { n: 8, part: '训练', title: '一次迭代：W 一步，Π 一步', sub: '玩具上按 §3.6 的循环现场训练；可切换种子和 N_W', dur: 18, toy: true, cam: [0, 1.32, 25, [2.8, 4.0, 0]], ctl: { label: '这一轮', items: ['种子 1', '种子 2', '种子 3', '种子 1, N_W=32'] },
      html: dl([['顺序', '拉新数据 → 发策略 → W 一步 → Π 一步'], ['开始平衡', '约 10,000 次，约 2 小时（GTX 1070）'], ['完整训练', '10 到 20 万次，约 20 到 40 小时'], ['每次用到的帧', 'W 2048×8 = 16,384；Π 1024×32 = 32,768（我的乘法）']]) +
        '<p>10,000 次对应 2 小时，就是每秒约 1.4 次迭代；20 万次 40 小时也一样，论文这几个数自洽。按 5000 样本/秒，每次迭代约进 3600 个新样本（我的计算）。</p>' +
        '<p>右边三条线都是现算的：<b>跟踪误差</b>是 Π 在真实仿真器里跑 4 秒的平均末端误差；<b>W 的 32 帧误差</b>是 W 自由滚动的误差；<b>梯度余弦</b>是穿过 W 的梯度和仿真器上有限差分梯度的夹角余弦，一开始 W 没学会，方向甚至相反。</p>' +
        '<p>切到 <b>N_W = 32</b> 看：W 自由滚动更准，策略却在几百次迭代后恶化甚至发散。这和论文图 15 的趋势同向（窗口大的曲线更差），但论文曲线是学得慢，不是发散，机制也未必相同。我在玩具上三个种子都看到了恶化或发散，没有查清原因。</p>' +
        toyNote('用 Adam 代替 RAdam，学习率都是 0.001，批量很小，共 1000 次，几秒内跑完。全部在这个页面的 JavaScript 里手写。切换种子会重训，要等一两秒。玩具没有任何可外推到人形的结论。') + src('§3.6 · 表 1 · 图 15') },
    { n: 9, part: '对比 PPO', title: '解析梯度和似然比估计', sub: '在同一个玩具上比方向，切换样本数 M', dur: 15, toy: true, cam: [0, 1.18, 21, [0.5, 5.0, 0]], ctl: { label: '每次估计的滚动数 M', items: ['8', '64', '512'], def: 1 },
      html: dl([['维度 d', '玩具 2×32 = 64；论文 57×32 = 1824'], ['似然比', 'ĝ = (1/M) Σ (L(o+σε)−L(o)) ε/σ'], ['BPTT', '一次 W 前向＋一次反向']]) +
        '<p>粉色箭头是有限差分算出的真实梯度。16 根蓝色箭头各是一次似然比估计，每次滚动 M 条仿真轨迹。这是 PPO 所用那一类梯度估计的最简形式，没有评论家、没有裁剪，所以<b>它不是 PPO 本身</b>，只用来看样本数和维度的关系。绿色是穿过 W 的梯度。</p>' +
        '<p>各向同性噪声下有 cos ≈ √(M/(M+d))。维度越高，同样精度要的样本越多。玩具 d = 64，M = 64 时余弦约 0.7；论文角色 d = 1824，同样精度就要约 1800 条轨迹（这个公式和数字是我的推断）。</p>' +
        '<p>代价也不一样。似然比不用模型，只要仿真器；穿过 W 的梯度要先有一个准的 W，它的方向误差不会随 M 变小。论文 §8 的说法和这一致，还补了 PPO 的长处：它靠探索能找到梯度找不到的行为（比如摔倒时迈步恢复）；§8 还说脚滑这类瑕疵来自短窗口看不到 PPO 那样长的回报。</p>' +
        toyNote('箭头的方向按真实的夹角画：沿粉箭头的分量是余弦，其余两个方向是把估计投影到两个固定的正交方向上。') + src('§8 · §5.1') },
    { n: 10, part: '结果', title: '和 PPO 比：LaFAN 上的完成度', sub: '切换实验，曲线从原文矢量图读出', dur: 13, cam: [0, 1.46, 26, [0.0, 5.2, 0]], ctl: { label: '实验', items: ['种子', '引擎', '经验率', '同步', '失衡', 'N_W', 'N_Π', '偏移', '加速度'] },
      html: dl([['指标', '平均回合长度 ÷ 512'], ['下限', '48 ÷ 512 ≈ 0.094（最短回合，我的计算）'], ['硬件', 'GTX 1070'], ['PPO 网络', '2 层 × 256']]) +
        '<p>同一个环境、同样的状态和动作表示，同样 20 小时：ST 约 0.91，PPO 约 0.40。所有曲线都是我从原文矢量图读的，所以是重画。</p>' +
        '<p>几个值得看的地方：<b>随机种子</b>里 ST-1 明显比另外两个种子快，它正是其他面板虚线基线那一条；<b>经验率</b>里 PPO 到同样水平慢了约 3 倍，论文写的是两倍；<b>策略同步</b>里 ST 不受影响，PPO 明显掉；<b>N_Π</b> 里 64 在第 1.9 小时终止之前其实跑在 32 上面。细节和计算见精读页的读者注。</p>' +
        src('图 9 · 图 11 · 图 15（矢量图读数）') },
    { n: 11, part: '局限和后续', title: '窗口之外看不到，SuperMimic 补了什么', sub: '同一条时间轴上比较视野；切换两篇论文', dur: 14, cam: [0, 1.3, 26, [-1.2, 2.2, 0]], ctl: { label: '论文', items: ['SuperTrack', 'SuperMimic'] },
      html: dl([['ST 窗口', 'N_W 8，N_Π 32，60 Hz'], ['SuperMimic', 'k 8，H 32，50 Hz，加评论家'], ['折扣', 'PPO γ = 0.99，约 100 帧']]) +
        '<p>论文 §7 自己说了局限：前瞻不超过窗口 N_Π；窗口拉长训练就不稳，W 的误差会累积，梯度裁剪只能帮一点；所以大概只适合短视野、奖励稠密的任务，比如跟踪。</p>' +
        '<p>γ = 0.99 的有效视野大约是 1/(1−γ) = 100 帧，1.67 秒，是 N_Π 的约 3 倍（我的计算）。这就是 §8 说的脚滑一类问题的来源。</p>' +
        '<p>切到 SuperMimic 看：它用了一样的 8 和 32，但在窗口末端接了一个评论家估计窗口之外的回报。它在 <a href="../../papers/supermimic.html#s3-3" target="_top">§3.3</a> 里直接点名 SuperTrack 这类方法“省略评论家，只优化 H 步奖励和”，并在 §4.3 用受推恢复的实验说明差别。</p>' +
        src('§7 · §8 · 表 1 · 表 3 · SuperMimic §2、§3.3') }
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
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.6, phi: 1.0, dist: 24, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);
  let LABS = [], refDist = 24, PICKS = [];
  function lab(text, pos, o = {}) { const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: o.size || 24, pos, color: o.color, border: o.border, bg: o.bg }); sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp; }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) { const im = new THREE.InstancedMesh(geo, L.mat(0xffffff, { opacity: o.opacity, roughness: 0.65, emissive: o.emissive }), Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s, q) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, q || _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, Object.assign({ edgeOpacity: 0.3 }, o)); m.position.set(...pos); return m; }
  function glow(m, v) { if (m.material && m.material.emissive) { m.material.emissive.setHex(m.material.color.getHex()); m.material.emissiveIntensity = v; } }
  /* particles along a polyline; call f(pts, q, on) each frame */
  function stream(G, n, color, r = 0.13) { const im = inst(BALL, n, { emissive: color }); im.material.color.setHex(color); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.6; G.add(im);
    return (pts, q, on) => { const ls = []; let T = 0; for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); ls.push(l); T += l; }
      for (let k = 0; k < n; k++) { let d = ((q + k / n) % 1) * T, i = 0; while (i < ls.length - 1 && d > ls[i]) { d -= ls[i]; i++; } const u = d / ls[i], a = pts[i], b = pts[i + 1]; setI(im, k, [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u], on ? r : 0.0001); } done(im); }; }
  function arrowLine(a, b, c, op = 0.75) { return L.line([a, b], c, { opacity: op }); }
  /* a mutable arrow from a to b (thin box plus a cone) */
  function dynArrow(G, color, r = 0.05) { const g = new THREE.Group(), sh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), L.mat(color, { emissive: color })), hd = new THREE.Mesh(new THREE.ConeGeometry(r * 2.6, r * 6, 12), L.mat(color, { emissive: color })); sh.material.emissiveIntensity = hd.material.emissiveIntensity = 0.35; g.add(sh, hd); G.add(g); const up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3();
    return (a, b) => { d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const l = d.length(); g.visible = l > 1e-4 && isFinite(l); if (!g.visible) return; const hl = Math.min(l * 0.5, r * 6); g.position.set(a[0], a[1], a[2]); g.quaternion.setFromUnitVectors(up, d.clone().normalize()); sh.scale.y = Math.max(1e-3, l - hl); sh.position.y = (l - hl) / 2; hd.position.y = l - hl / 2; hd.scale.y = hl / (r * 6); }; }

  /* ---------- toy drawing: world (x,z) of the simulator to scene (x,y), 4 units per metre ---------- */
  const SC = 4, tx = (x, ox = 0) => x * SC + ox, ty = z => z * SC;
  function stand(G, ox = 0, oz = 0) { G.add(block(0.5, ty(1.2) - 0.05, 0.5, 0x3b4660, [ox, (ty(1.2) - 0.05) / 2, oz], { edges: false })); const j = L.sphere(0.16, 0x9aa6bf); j.position.set(ox, ty(1.2), oz); G.add(j); }
  function armViz(G, color, o = {}) { const mk = () => { const m = new THREE.Mesh(BOX, L.mat(color, { opacity: o.opacity ?? 1, emissive: o.emissive })); G.add(m); return m; }, a = mk(), b = mk(), w = o.w ?? 0.22, ox = o.ox ?? 0, oz = o.oz ?? 0;
    const set = X => { const ok = Math.abs(X[0]) < 3 && Math.abs(X[1] - 1.2) < 3 && Math.abs(X[6]) < 3 && Math.abs(X[7] - 1.2) < 3; a.visible = b.visible = ok && !set.hide; if (!ok) return false;
      a.position.set(tx(X[0], ox), ty(X[1]), oz); a.rotation.z = X[4]; a.scale.set(0.5 * SC, w, w); b.position.set(tx(X[6], ox), ty(X[7]), oz); b.rotation.z = X[10]; b.scale.set(0.5 * SC, w * 0.8, w * 0.8); return true; };
    set.meshes = [a, b]; return set; }
  const tipScene = (X, ox = 0) => { const t = Toy.tipOf(X); return [tx(t[0], ox), ty(t[1])]; };
  function trail(G, n, color, op = 0.9) { const pos = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })); l.frustumCulled = false; G.add(l); return { set(i, x, y, z = 0) { pos[3 * i] = x; pos[3 * i + 1] = y; pos[3 * i + 2] = z; g.attributes.position.needsUpdate = true; }, count(k) { g.setDrawRange(0, k); }, l }; }
  /* the toy runs: trained once, kept for the whole page */
  const RUN = (seed = 1, NW = 8) => memo(`run${seed}_${NW}`, () => Toy.run(seed, { NW }));
  const main = () => RUN();

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    G.add(L.grid(30, 30));
    const gym = block(5, 2.2, 3, COL.sim, [-8.6, 1.3, 0]), buf = block(9, 1.3, 2.2, COL.buf, [0, 0.8, 3.2]), wm = block(3.6, 2.6, 2.6, COL.wm, [-2.2, 6.2, -1.2]), pi = block(3.6, 2.6, 2.6, COL.pi, [5.6, 6.2, -1.2]), loss = block(2.8, 1.1, 1.8, COL.loss, [9.8, 3.0, -1.2]);
    gym.userData.go = 1; buf.userData.go = 1; wm.userData.go = 4; pi.userData.go = 6; PICKS = [gym, buf, wm, pi]; G.add(gym, buf, wm, pi, loss);
    G.add(lab('环境 · 256 个角色\nPD 驱动，240 Hz（点我）', [-8.6, 3.5, 0], { size: 22 }), lab('循环缓存 · ~150,000 样本（点我）', [0, 1.95, 4.2], { size: 22 }), lab('世界模型 W（点我）\n5 × 1024 ELU，lr 0.001', [-2.2, 8.5, -1.2], { size: 22 }), lab('策略 Π（点我）\n5 × 1024 ELU，lr 0.0001', [5.6, 8.5, -1.2], { size: 22 }), lab('跟踪损失（局部空间）', [11.2, 1.8, -1.2], { size: 21 }));
    const a1 = lab('S, K, T', [-4.3, 2.2, 2.8], { size: 20 }), a2 = lab('8 帧窗口', [-3.2, 3.5, 0.9], { size: 20 }), a3 = lab('S₀ + 32 帧的 K', [4.6, 3.5, 2.2], { size: 20 }), a4 = lab('把当前策略发回环境', [-2.0, 11.2, -1.2], { size: 21, border: 'rgba(56,209,255,.8)' }), a5 = lab('W 的权重不动，梯度穿过', [1.7, 4.6, -1.2], { size: 20, border: 'rgba(255,122,89,.8)' }); G.add(a1, a2, a3, a4, a5);
    const f1 = stream(G, 6, COL.sim), f2 = stream(G, 6, COL.buf), f3 = stream(G, 6, COL.buf), f4 = stream(G, 8, COL.pi), f5 = stream(G, 6, COL.grad, 0.15);
    G.add(arrowLine([-6, 1.2, 1], [-4.5, 0.8, 3], COL.sim), arrowLine([-2.5, 1.5, 2.5], [-2.2, 4.9, -0.2], COL.buf), arrowLine([3, 1.5, 2.5], [5.6, 4.9, -0.2], COL.buf));
    return { update(p) {
      const q = (p * 12) % 1, ph = p < 0.28 ? 0 : p < 0.56 ? 1 : p < 0.82 ? 2 : 3;
      f1([[-6, 1.2, 1], [-4.5, 0.8, 3.2]], q, ph === 0); f4([[5.6, 7.5, -1.2], [5.6, 10.6, -1.2], [-8.6, 10.6, -1.2], [-8.6, 2.4, 0]], q, ph === 3);
      f2([[-2.5, 1.5, 2.5], [-2.2, 4.9, -0.2]], q, ph === 1); f3([[3, 1.5, 2.5], [5.6, 4.9, -0.2]], q, ph === 2);
      f5([[9.8, 3.6, -1.2], [8.4, 5.2, -1.2], [-0.2, 6.2, -1.2], [3.8, 6.2, -1.2]], 1 - q, ph === 2);
      glow(gym, ph === 0 ? 0.35 : 0); glow(buf, ph === 0 || ph === 1 ? 0.25 : 0); glow(wm, ph === 1 ? 0.45 : 0); glow(pi, ph === 2 ? 0.45 : 0); glow(loss, ph === 2 ? 0.45 : 0);
      a1.visible = ph === 0; a2.visible = ph === 1; a3.visible = a5.visible = ph === 2; a4.visible = ph === 3;
      cap(['环境里的 256 个角色一边跑，一边把<b>模拟状态 S、参考状态 K、PD 目标 T</b> 写进缓存', '算法 1：取 <b>8 帧窗口</b>，让 W 自己滚动预测，和真实 S 比', '算法 2：取 <b>32 帧窗口</b>，Π 和 W 交替展开。W 不更新，只把梯度传回 Π', '再把新策略发回环境，下一次迭代从头开始。<b>环境始终不需要可导</b>'][ph]);
    } };
  }

  /* ---------- scene 2: 256 characters, cyclic buffer, 30 seconds of wall clock ---------- */
  function s2(G) {
    G.add(L.grid(34, 34));
    const n = 256, body = inst(BOX, n), head = inst(BALL, n); G.add(body, head); const r = L.rng(7), ep = [];
    /* each character has a list of episode lengths in frames: min 48, max 512. Rate: 5000/256 = 19.53 samples/s per character */
    for (let i = 0; i < n; i++) { const a = [0]; let t = 0; while (t < 700) { const u = r(), len = u < 0.55 ? 512 : Math.round(48 + r() * 464); t += len; a.push(t); } ep.push({ ends: a, ph: r() * 6.28, sp: 1.3 + r() }); }
    const gx = i => -9.7 + (i % 16) * 0.82, gz = i => -5.2 + Math.floor(i / 16) * 0.82;
    const cells = 150, x0 = 3.3, cw = 0.075, bar = inst(BOX, cells); G.add(bar);
    G.add(lab('一格 = 1000 样本 · 共 150 格 ≈ 缓存容量', [x0 + cells * cw / 2 - 1.2, 2.5, 4.4], { size: 21 }), lab('256 个角色', [-3.6, 2.9, -5.4], { size: 22 }));
        const fl = stream(G, 8, COL.buf, 0.11); const R0 = new THREE.Quaternion(), EE = new THREE.Euler();
    return { update(p) {
      const sec = p * 30, fr = sec * 5000 / 256, tot = sec * 5000; let resets = 0;
      for (let i = 0; i < n; i++) { const e = ep[i], x = gx(i), z = gz(i); let k = 0; while (k + 1 < e.ends.length && e.ends[k + 1] <= fr) k++; resets += k; const age = fr - e.ends[k], flash = age < 7 && k > 0;
        const left = (e.ends[k + 1] ?? 1e9) - fr, tilt = 0.14 * Math.sin(e.ph + fr * 0.11 * e.sp) + (left < 40 ? (40 - left) / 40 * 0.9 : 0);
        EE.set(0, 0, tilt); R0.setFromEuler(EE); setI(body, i, [x + 0.3 * Math.sin(tilt), 0.42 * Math.cos(tilt), z], [0.17, 0.82, 0.17], R0); setI(head, i, [x + 0.92 * Math.sin(tilt) * 0.9, 0.95 * Math.cos(tilt), z], 0.13);
        const c = flash ? hex3(COL.loss) : hex3(0xc9d4ea); colI(body, i, c); colI(head, i, c); }
      done(body); done(head);
      for (let i = 0; i < cells; i++) { const on = (i + 0.5) * 1000 <= tot % 150000 || tot >= 150000, h = on ? 0.9 : 0.08; setI(bar, i, [x0 + i * cw, h / 2, 3.2], [cw * 0.86, h, 1.4]); colI(bar, i, on ? hex3(COL.buf) : hex3(0x2b3650)); } done(bar);
      fl([[-3, 0.6, 2], [x0, 0.7, 3.2]], (p * 26) % 1, 1);
            cap(`墙钟 <b>${sec.toFixed(1)}</b> 秒 · 已写入 <b>${Math.round(tot).toLocaleString('en-US')}</b> 样本 · 累计复位 <b>${resets}</b> 次（黄色闪一下）${p > 0.93 ? ' · <b>缓存刚好转完一圈</b>' : ''}`);
    } };
  }

  /* ---------- scene 3: world versus local coordinates, eq. (2) computed live ---------- */
  const HUM = [['胯', 0, 0, 0, .55, .3, .3], ['腰', 0, .32, 0, .5, .3, .28], ['胸', 0, .68, 0, .62, .42, .3], ['头', 0, 1.2, 0, .3, .36, .3], ['左肩', .38, .92, 0, .3, .14, .14], ['左上臂', .7, .78, 0, .14, .42, .14], ['左前臂', .8, .42, .08, .12, .4, .12], ['左手', .85, .14, .14, .12, .16, .12], ['右肩', -.38, .92, 0, .3, .14, .14], ['右上臂', -.72, .86, .1, .42, .14, .14], ['右前臂', -1.1, .9, .24, .4, .12, .12], ['右手', -1.4, .94, .34, .16, .1, .12], ['左大腿', .17, -.42, .02, .18, .56, .18], ['左小腿', .2, -.94, -.08, .15, .54, .15], ['左脚', .2, -1.28, .02, .15, .1, .34], ['左脚尖', .2, -1.31, .24, .14, .07, .12], ['右大腿', -.17, -.38, .14, .18, .56, .18], ['右小腿', -.18, -.88, .06, .15, .54, .15], ['右脚', -.18, -1.24, .14, .15, .1, .34], ['右脚尖', -.18, -1.27, .36, .14, .07, .12]];
  const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const qrot = (q, v) => { const u = [q[0], q[1], q[2]], w = q[3], c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], d = [u[1] * c[2] - u[2] * c[1], u[2] * c[0] - u[0] * c[2], u[0] * c[1] - u[1] * c[0]]; return [v[0] + 2 * (w * c[0] + d[0]), v[1] + 2 * (w * c[1] + d[1]), v[2] + 2 * (w * c[2] + d[2])]; };
  const qinv = q => [-q[0], -q[1], -q[2], q[3]];
  const twoAxis = q => [qrot(q, [1, 0, 0]), qrot(q, [0, 1, 0])].flat();
  function s3(G, k) {
    G.add(L.grid(26, 26)); const sel = [11, 3, 14][k], SCH = 1.55, parts = HUM.map((h, i) => { const m = block(h[4] * SCH, h[5] * SCH, h[6] * SCH, i === sel ? COL.loss : 0xc9d4ea, [0, 0, 0], { edgeOpacity: 0.2 }); G.add(m); return m; });
    const axes = new THREE.AxesHelper(2.1); axes.material.depthTest = false; axes.renderOrder = 5; G.add(axes); const lRoot = lab('根坐标系（胯）', [0, 0, 0], { size: 19 }); G.add(lRoot);
    const X0 = 3.0, bars = inst(BOX, 6); G.add(bars);
    G.add(lab(`世界 xᵖ（${HUM[sel][0]}）`, [X0 + 1.2, 6.6, 0], { size: 21, border: 'rgba(240,150,60,.8)' }), lab(`局部 x^lp（${HUM[sel][0]}）`, [X0 + 5.8, 6.6, 0], { size: 21, border: 'rgba(79,201,138,.8)' }));
    const vLabs = []; for (let i = 0; i < 6; i++) { const t = lab('', [0, 0, 0], { size: 20 }); vLabs.push(t); }
    const axn = ['x', 'y', 'z'], tagL = []; for (let i = 0; i < 6; i++) { const t = lab(axn[i % 3], [X0 + (i < 3 ? i * 1.2 : 4.6 + (i - 3) * 1.2), -0.6, 0], { size: 18 }); G.add(t); tagL.push(t); }
    /* stacked 323-dim input */
    const SEG = [['x^lp', 60, COL.wm], ['ẋ^lp', 60, COL.pi], ['x^lr (two-axis)', 120, COL.pred], ['ẋ^lr', 60, COL.crit], ['xʰ', 20, COL.loss], ['x^up', 3, COL.ref]]; let acc = 0; const zb = 5.2, xs = 0.031, xb = -9.6;
    SEG.forEach(s => { const w = s[1] * xs, m = block(w - 0.02, 0.5, 0.8, s[2], [xb + (acc + s[1] / 2) * xs, 0.26, zb]); G.add(m); G.add(lab(`${s[0]} ${s[1]}`, [xb + (acc + s[1] / 2) * xs + (s[1] === 3 ? 1.1 : 0), s[1] < 30 ? 1.5 + (s[1] === 3 ? 0.62 : 0) : 0.92, zb], { size: 16 })); acc += s[1]; });
    G.add(lab('Local(X)，共 323 维（B = 20）', [xb + 4.4, 2.9, zb], { size: 20 }));
    let lastTxt = {}; const relabel = (i, s, pos) => { const old = vLabs[i]; if (lastTxt[i] !== s) { G.remove(old); L.dispose(old); LABS = LABS.filter(q => q !== old); const n = lab(s, pos, { size: 20 }); G.add(n); vLabs[i] = n; lastTxt[i] = s; } else vLabs[i].position.set(...pos); };
    const qUnit = (ax, a) => [ax[0] * Math.sin(a / 2), ax[1] * Math.sin(a / 2), ax[2] * Math.sin(a / 2), Math.cos(a / 2)];
    return { update(p) {
      const px = -7.6 + 6.2 * L.ease(p < 0.5 ? p * 2 : 2 - p * 2), pz = -1.6 + 2.2 * Math.sin(p * 6.283), yaw = 0.35 + 3.0 * Math.sin(p * 3.14), rq = qUnit([0, 1, 0], yaw), rp = [px, 2.2, pz];
      HUM.forEach((h, i) => { const w = qrot(rq, [h[1] * SCH, h[2] * SCH, h[3] * SCH]); parts[i].position.set(rp[0] + w[0], rp[1] + w[1], rp[2] + w[2]); parts[i].quaternion.set(...rq); });
      axes.position.set(...rp); axes.quaternion.set(...rq); lRoot.position.set(rp[0], rp[1] + 3.9, rp[2]);
      const sw = parts[sel].position, wp = [sw.x, sw.y, sw.z], d = [wp[0] - rp[0], wp[1] - rp[1], wp[2] - rp[2]], lp = qrot(qinv(rq), d), vals = [...wp, ...lp], sc = 0.5;
      vals.forEach((v, i) => { const x = X0 + (i < 3 ? i * 1.2 : 4.6 + (i - 3) * 1.2), h = Math.abs(v) * sc + 0.02; setI(bars, i, [x, h / 2, 0], [0.8, h, 0.8]); colI(bars, i, hex3(i < 3 ? (v >= 0 ? COL.pred : 0xb56a22) : (v >= 0 ? COL.wm : 0x2f8f60))); relabel(i, v.toFixed(2), [x, h + 0.42, 0]); }); done(bars);
      const q = qmul(rq, qUnit([0, 0, 1], 0.6)), nq = q.map(v => -v), t1 = twoAxis(q), t2 = twoAxis(nq);
      cap(p < 0.7 ? `角色在走、在转。<b>世界坐标一直变，局部坐标 ${lp.map(v => v.toFixed(2)).join(', ')} 不变</b>（式 2 现算）`
        : `q = (${q.map(v => v.toFixed(2)).join(', ')})，−q 的每个分量都反号。两者的 two-axis 前两项：<b>${t1[0].toFixed(3)}, ${t1[1].toFixed(3)}</b> 和 <b>${t2[0].toFixed(3)}, ${t2[1].toFixed(3)}</b>，完全相同`);
    } };
  }

  /* ---------- scene 4: one world model step on the toy ---------- */
  function s4(G) {
    const R = main(), W = R.W, clip = Toy.EVAL, t0 = 1.3, s = Toy.ref(clip, t0).slice(), X = Toy.toMax(s).slice(), kn = Toy.ref(clip, t0 + Toy.DT), T = [kn[0], kn[1]], Y = new Float64Array(12), ctx = Toy.mkCtx(W, null);
    Toy.wmStep(W, X, T, Y, ctx); const sb = s.slice(); Toy.simFrame(sb, T, [kn[2], kn[3]]); const Xs = Toy.toMax(sb), DT = Toy.DT;
    /* accelerations in world and root frames */
    const am = (A, B, i) => [(B[i + 2] - A[i + 2]) / DT, (B[i + 3] - A[i + 3]) / DT], c = Math.cos(X[4]), sn = Math.sin(X[4]), toL = a => [c * a[0] + sn * a[1], -sn * a[0] + c * a[1]];
    const aP = [am(X, Y, 0), am(X, Y, 6)], aS = [am(X, Xs, 0), am(X, Xs, 6)], aL = aP.map(toL), ox = -3.4; stand(G, ox); G.add(L.grid(22, 22));
    const armX = armViz(G, 0xc9d4ea, { ox }); armX(X); const ghost = armViz(G, COL.pred, { ox, opacity: 0.55, w: 0.14 });
    const net = []; for (let i = 0; i < 5; i++) { const m = block(0.28, 3.2 - i * 0.14, 2.2, COL.wm, [2.6 + i * 0.68, 5.0, 0]); net.push(m); G.add(m); }
    G.add(lab('W（论文 5 × 1024；玩具 2 × 32）', [3.9, 7.1, 0], { size: 21 }), lab('输入 Local(P) + T', [1.1, 2.9, 0], { size: 20 }), lab('输出局部加速度', [6.6, 2.9, 0], { size: 20 }));
    const f1 = stream(G, 6, COL.pi, 0.1), f2 = stream(G, 6, COL.pred, 0.1);
    const ap1 = dynArrow(G, COL.pred, 0.055), ap2 = dynArrow(G, COL.pred, 0.055), as1 = dynArrow(G, COL.tru, 0.04), as2 = dynArrow(G, COL.tru, 0.04); const AS = 0.1;
    const axX = dynArrow(G, COL.wm, 0.03), axZ = dynArrow(G, COL.wm, 0.03), cP = [tx(X[0], ox), ty(X[1])], cB = [tx(X[6], ox), ty(X[7])];
    const lX = lab('根坐标系', [cP[0] - 0.4, cP[1] - 1.6, 0], { size: 18 }); G.add(lX);
    return { update(p) {
      const q = (p * 16) % 1, a = p < 0.3 ? 0 : p < 0.55 ? 1 : p < 0.78 ? 2 : 3, u = seg(p, 0.55, 0.78), ang = a === 1 ? X[4] : a === 2 ? X[4] * (1 - u) : 0;
      f1([[cP[0], cP[1], 0], [2.4, 5, 0]], q, a === 0); f2([[5.4, 5, 0], [6.6, 3.6, 0], [cB[0] + 0.6, cB[1] - 0.6, 0]], q, a === 1);
      net.forEach((m, i) => glow(m, a === 0 ? 0.08 + 0.4 * Math.max(0, Math.sin((p / 0.3) * 6 - i)) : 0));
      axX([cP[0], cP[1], 0], [cP[0] + 1.3 * Math.cos(X[4]), cP[1] + 1.3 * Math.sin(X[4]), 0]); axZ([cP[0], cP[1], 0], [cP[0] - 1.3 * Math.sin(X[4]), cP[1] + 1.3 * Math.cos(X[4]), 0]);
      const on = a >= 1, va = (al, wa) => { /* drawn at the world angle ang after rotating local vector */ const ca = Math.cos(ang), sa = Math.sin(ang); return a < 2 ? [ca * al[0] - sa * al[1], sa * al[0] + ca * al[1]] : [c * al[0] - sn * al[1], sn * al[0] + c * al[1]]; };
      const v1 = on ? va(aL[0]) : [0, 0], v2 = on ? va(aL[1]) : [0, 0];
      ap1([cP[0], cP[1], 0.25], [cP[0] + v1[0] * AS, cP[1] + v1[1] * AS, 0.25]); ap2([cB[0], cB[1], 0.25], [cB[0] + v2[0] * AS, cB[1] + v2[1] * AS, 0.25]);
      const sh = a >= 2 ? 1 : 0; as1([cP[0], cP[1], -0.25], [cP[0] + sh * aS[0][0] * AS, cP[1] + sh * aS[0][1] * AS, -0.25]); as2([cB[0], cB[1], -0.25], [cB[0] + sh * aS[1][0] * AS, cB[1] + sh * aS[1][1] * AS, -0.25]);
      if (a === 3) { /* integrate: exaggerate by showing 6 frames ahead along the predicted acceleration */ const f = 1 + 5 * seg(p, 0.78, 0.98), G2 = Y.slice(); for (const i of [0, 6]) { G2[i] = X[i] + (Y[i] - X[i]) * f; G2[i + 1] = X[i + 1] + (Y[i + 1] - X[i + 1]) * f; G2[i + 4] = X[i + 4] + (Y[i + 4] - X[i + 4]) * f; } ghost.hide = false; ghost(G2); } else { ghost.hide = true; ghost(X); }
      const e1 = Math.hypot(aP[1][0] - aS[1][0], aP[1][1] - aS[1][1]), m1 = Math.hypot(aS[1][0], aS[1][1]);
      cap(a === 0 ? '当前状态换到根坐标系（绿色轴），和 PD 目标 T 一起进网络'
        : a === 1 ? `网络输出<b>根坐标系里</b>的加速度。末端连杆：(${aL[1][0].toFixed(1)}, ${aL[1][1].toFixed(1)}) m/s²`
        : a === 2 ? `乘上根旋转转回世界系。橙色是 W，粉色是仿真器真值：差 <b>${e1.toFixed(1)}</b>，真值大小 ${m1.toFixed(1)} m/s²`
        : `积分：先更新速度，再更新位置。预测位置和真实差 <b>${(Math.hypot(Y[6] - Xs[6], Y[7] - Xs[7]) * 1000).toFixed(2)} mm</b>（一帧。淡橙色把一帧的位移放大了最多 6 倍）`);
    } };
  }

  /* ---------- scene 5: windows ---------- */
  const NWS = [1, 2, 8, 32];
  function s5(G, k) {
    const NW = NWS[k], m = memo('wo' + NW, () => { const r = Toy.trainWOnly(1, NW, 800); r.e = Toy.wmErr(r.W, r.S.clips, [8, 32, 64, 128]); return r; }), W = m.W, ox = -3.5;
    stand(G, ox); G.add(L.grid(26, 26));
    const A = Toy.predVsSim(W, Toy.EVAL, 1.0, 32, NW), B = Toy.predVsSim(W, Toy.EVAL, 1.0, 128, 0), ss = armViz(G, 0x9aa6bf, { ox, opacity: 0.85 }), pp = armViz(G, COL.pred, { ox, w: 0.15 }), ts = trail(G, 129, 0x9aa6bf), tp = trail(G, 129, COL.pred);
    const jg = L.sphere(0.13, COL.bad); G.add(jg);
    /* live error bars, log scale: all window sizes that were already trained plus the current one */
    const hs = [8, 32, 64, 128], X0 = 4.3, bw = 1.25, e = m.e.err, y = v => Math.max(0.05, (Math.log10(Math.max(v, 0.003)) + 2.6) * 1.55), bars = inst(BOX, 4); G.add(bars);
    G.add(lab(`N_W = ${NW} 时的自由滚动误差（对数高度）`, [X0 + 1.9, 7.6, 0], { size: 21 }));
    hs.forEach((h, i) => { const x = X0 + i * bw; setI(bars, i, [x, y(e[i]) / 2, 0], [0.9, y(e[i]), 0.9]); colI(bars, i, hex3(e[i] > 0.5 ? COL.bad : COL.pred)); G.add(lab(`${e[i] < 1 ? (e[i] * 100).toFixed(1) + ' cm' : e[i].toFixed(1) + ' m'}`, [x, y(e[i]) + 0.5, 0], { size: 19 }), lab(`${h} 帧`, [x, -0.55, 0], { size: 18 })); }); done(bars);
    const FF = 0.3;
    return { update(p) {
      const train = p < FF, r = train ? A : B, N = train ? 32 : 128, f = Math.min(N, Math.floor((train ? p / FF : (p - FF) / (1 - FF)) * (N + 0.999))), Pf = r.Ps[f], Sf = r.Ss[f];
      ss(Sf); const v = pp(Pf);
      for (let i = 0; i <= f; i++) { const a = tipScene(r.Ss[i], ox), b = tipScene(r.Ps[i], ox), cl = q => clamp(q, -30, 30); ts.set(i, cl(a[0]), cl(a[1])); tp.set(i, cl(b[0]), cl(b[1])); } ts.count(f + 1); tp.count(f + 1);
      const gp = Toy.gapOf(Pf), a = tipScene(Sf, ox), b = tipScene(Pf, ox), er = Math.hypot(Toy.tipOf(Pf)[0] - Toy.tipOf(Sf)[0], Toy.tipOf(Pf)[1] - Toy.tipOf(Sf)[1]);
      jg.position.set(tx(Pf[0] + 0.25 * Math.cos(Pf[4]), ox), ty(Pf[1] + 0.25 * Math.sin(Pf[4])), 0); jg.visible = v && gp > 0.03;
      const rs = NW > 0 && f > 0 && f % NW === 0;
      cap(train ? `训练视角：第 <b>${f}</b> 帧${rs ? ' · <b>回到真值</b>' : ''}。每 <b>${NW}</b> 帧 teacher forcing 一次，窗口内误差全部反传`
        : !v ? `自由滚动第 <b>${f}</b> 帧：W 的预测已经<b>飞出画面</b>，只训练短窗口滚长了就这样`
        : `自由滚动第 <b>${f}</b> 帧（${(f / 60).toFixed(2)} 秒）：末端差 <b>${(er * 100).toFixed(1)} cm</b>，关节断开 <b>${(gp * 100).toFixed(1)} cm</b>${gp > 0.03 ? '（红点是断开处）' : ''}`);
    } };
  }

  /* ---------- scene 6: PD offsets ---------- */
  function s6(G, k) {
    const R = main(), clip = Toy.EVAL, F = 240, noPi = Toy.simTrack(null, clip, F), wiPi = Toy.simTrack(R.Pi, clip, F), ox = -1;
    stand(G, ox); G.add(L.grid(22, 22));
    const kk = armViz(G, 0xa9b6d0, { ox, opacity: 0.75, w: 0.28 }), a0 = armViz(G, COL.bad, { ox, w: 0.16 }), a1 = armViz(G, COL.pi, { ox, w: 0.16 }); a0.hide = k === 1; a1.hide = k === 0;
    const tg = trail(G, 3, COL.pi, 0.95), tK = trail(G, 3, COL.ref, 0.6); tg.count(3); tK.count(3); tg.l.visible = k !== 0;
    G.add(lab('浅色粗：参考 K', [5.6, 7.0, 0], { size: 19 }), lab('红：只用 PD', [5.6, 6.2, 0], { size: 19, color: '#ff9c8f' }), lab('青：PD + Π', [5.6, 5.4, 0], { size: 19, color: '#8fe6ff' }), lab('细线：PD 目标', [5.6, 4.6, 0], { size: 19 }));
        const polyT = (t0, t1, tr) => { const j1 = [ox, ty(1.2)], j2 = [j1[0] + 2 * Math.cos(t0), j1[1] + 2 * Math.sin(t0)], j3 = [j2[0] + 2 * Math.cos(t0 + t1), j2[1] + 2 * Math.sin(t0 + t1)]; tr.set(0, j1[0], j1[1], 0.3); tr.set(1, j2[0], j2[1], 0.3); tr.set(2, j3[0], j3[1], 0.3); };
    return { update(p) {
      const f = Math.min(F, Math.floor(p * F)), t = f * Toy.DT, kn = Toy.ref(clip, t), oo = wiPi.Os[f];
      kk(wiPi.Ks[f]); a0(noPi.Xs[f]); a1(wiPi.Xs[f]); polyT(kn[0], kn[1], tK); polyT(kn[0] + Toy.ALPHA * oo[0], kn[1] + Toy.ALPHA * oo[1], tg);
      const off = Math.hypot(oo[0], oo[1]) * 57.3, tip = (X, Kx) => { const a = Toy.tipOf(X), b = Toy.tipOf(Kx); return Math.hypot(a[0] - b[0], a[1] - b[1]) * 100; };
      cap(k === 0 ? `只用 PD：此刻末端差 <b>${tip(noPi.Xs[f], noPi.Ks[f]).toFixed(1)} cm</b>，4 秒平均 <b>${(noPi.err * 100).toFixed(1)} cm</b>`
        : k === 1 ? `加上 Π：此刻末端差 <b>${tip(wiPi.Xs[f], wiPi.Ks[f]).toFixed(1)} cm</b>，4 秒平均 <b>${(wiPi.err * 100).toFixed(1)} cm</b>；Π 此刻的偏移约 <b>${off.toFixed(1)}°</b>`
        : `4 秒平均末端误差：只用 PD <b>${(noPi.err * 100).toFixed(1)} cm</b>，加上 Π <b>${(wiPi.err * 100).toFixed(1)} cm</b>。Π 此刻把目标抬高约 <b>${off.toFixed(1)}°</b>（都在真实仿真器里跑的）`);
    } };
  }

  /* ---------- scene 7: BPTT through W, gradients computed live ---------- */
  const NPS = [8, 16, 32, 64, 128];
  function s7(G, k) {
    const N = NPS[k], R = main(), clip = Toy.EVAL, s0 = Toy.ref(clip, 1).slice(),
      gr = memo('g' + N, () => { const o = new Float64Array(2 * N), g = new Float64Array(2 * N); Toy.gradW(R.W, s0, clip, 1, o, N, g); const fd = Toy.fdSim(s0, clip, 1, N); return { g, fd, cos: Toy.cos(g, fd), ng: Toy.norm(g), nf: Toy.norm(fd), chk: N <= 32 ? (() => { const fw = Toy.fdW(R.W, s0, clip, 1, N); let d = 0; for (let i = 0; i < 2 * N; i++) d += (g[i] - fw[i]) ** 2; return Math.sqrt(d) / Toy.norm(fw); })() : null }; });
    const W_ = 19, cw = W_ / N, x0 = -W_ / 2 + 1.2 + cw / 2, pis = inst(BOX, N), wms = inst(BOX, N), gb = inst(BOX, N), gf = inst(BOX, N); G.add(pis, wms, gb, gf); gf.material.wireframe = true;
    const hg = new Float64Array(N), hf = new Float64Array(N); let mx = 0; for (let i = 0; i < N; i++) { hg[i] = Math.hypot(gr.g[2 * i], gr.g[2 * i + 1]); hf[i] = Math.hypot(gr.fd[2 * i], gr.fd[2 * i + 1]); mx = Math.max(mx, hg[i], hf[i]); } const hs = 5.2 / mx;
    G.add(L.grid(26, 26));
    G.add(lab('Π', [x0 - cw / 2 - 0.7, 1.9, 0], { size: 22, border: 'rgba(56,209,255,.8)' }), lab('W', [x0 - cw / 2 - 0.7, 0.9, 0], { size: 22, border: 'rgba(79,201,138,.8)' }), lab('每帧的 |∂L/∂o|：绿 = 穿过 W，粉框 = 仿真器差分', [1.2, 8.9, 0], { size: 20 }));
    const front = L.sphere(0.2, COL.pi); G.add(front); const back = L.sphere(0.22, COL.grad); G.add(back);
    return { update(p) {
      const a = seg(p, 0.03, 0.42), b = seg(p, 0.46, 0.92), xf = a * N, xb = N * (1 - b);
      for (let i = 0; i < N; i++) { const x = x0 + i * cw, fon = i < xf, bon = b > 0 && i >= xb; setI(pis, i, [x, 1.9, 0], [cw * 0.72, 0.8, 0.8]); colI(pis, i, hex3(fon ? COL.pi : 0x2b3650)); setI(wms, i, [x, 0.9, 0], [cw * 0.72, 0.8, 0.8]); colI(wms, i, hex3(fon ? COL.wm : 0x2b3650));
        const h = bon ? hg[i] * hs + 0.01 : 0.001, hF = bon ? hf[i] * hs + 0.01 : 0.001; setI(gb, i, [x, 2.5 + h / 2, 0], [cw * 0.46, h, 0.5]); colI(gb, i, hex3(COL.wm)); setI(gf, i, [x, 2.5 + hF / 2, 0], [cw * 0.72, hF, 0.8]); colI(gf, i, hex3(COL.tru)); }
      [pis, wms, gb, gf].forEach(done); front.visible = a > 0 && a < 1; front.position.set(x0 + xf * cw, 2.6, 0.6); back.visible = b > 0 && b < 1; back.position.set(x0 + xb * cw, 2.6, 0.6);
      cap(p < 0.44 ? `<b>前向：</b>Π 和 W 交替展开 <b>${N}</b> 帧，共 ${(N / 60).toFixed(2)} 秒`
        : p < 0.93 ? `<b>反向：</b>梯度从后往前，穿过积分、根旋转、Local 和 W 的雅可比`
        : `和仿真器真实梯度的<b>余弦 ${gr.cos.toFixed(3)}</b>；范数 ${gr.ng.toFixed(1)} 对 ${gr.nf.toFixed(1)}${gr.chk != null ? `；手写反传和差分的相对差 ${gr.chk.toExponential(1)}` : ''}`);
    } };
  }

  /* ---------- scene 8: the whole loop on the toy ---------- */
  const RUNS = [[1, 8], [2, 8], [3, 8], [1, 32]];
  function s8(G, k) {
    const R = RUN(...RUNS[k]), C = R.curve, n = C.length, ox = -5.6, clip = Toy.EVAL, tmpW = R.Pi.w.slice();
    const sims = memo('sims' + k, () => R.snaps.map(s => { R.Pi.w.set(s.Pi); const r = Toy.simTrack(R.Pi, clip, 240); return r; })); R.Pi.w.set(tmpW);
    stand(G, ox); G.add(L.grid(30, 30));
    const kk = armViz(G, 0xa9b6d0, { ox, opacity: 0.75, w: 0.28 }), a1 = armViz(G, COL.pi, { ox, w: 0.16 });
    /* three small plots: x = iteration; each its own y range */
    const PX = 1.6, PW = 9.5, plots = [{ y: 6.6, h: 2.1, key: 'track', c: COL.pi, name: '跟踪误差（米，对数）', lo: 0.005, hi: 2, log: true }, { y: 3.5, h: 2.1, key: 'wm', c: COL.pred, name: 'W 的 32 帧误差（米，对数）', lo: 0.03, hi: 3, log: true }, { y: 0.4, h: 2.1, key: 'cos', c: COL.wm, name: '梯度余弦（−1 到 1）', lo: -1, hi: 1 }];
    const dots = plots.map(pl => { const yv = v => { const q = pl.log ? (Math.log10(clamp(v, pl.lo, pl.hi)) - Math.log10(pl.lo)) / (Math.log10(pl.hi) - Math.log10(pl.lo)) : (clamp(v, pl.lo, pl.hi) - pl.lo) / (pl.hi - pl.lo); return pl.y + q * pl.h; }; pl.yv = yv;
      G.add(L.line([[PX, pl.y, 0], [PX + PW, pl.y, 0]], 0x6b7794), L.line([[PX, pl.y, 0], [PX, pl.y + pl.h, 0]], 0x6b7794)); G.add(lab(pl.name, [PX + 2.4, pl.y + pl.h + 0.3, 0], { size: 18 }), lab(String(pl.hi), [PX - 0.55, pl.y + pl.h, 0], { size: 15 }), lab(String(pl.lo), [PX - 0.55, pl.y, 0], { size: 15 }));
      const tr = trail(G, n, pl.c); C.forEach((c, i) => { const v = isFinite(c[pl.key]) ? c[pl.key] : pl.hi; tr.set(i, PX + i / (n - 1) * PW, yv(v), 0); }); pl.tr = tr; const d = L.sphere(0.13, pl.c); G.add(d); return d; });
    if (plots[2]) G.add(L.line([[PX, plots[2].yv(0), 0], [PX + PW, plots[2].yv(0), 0]], 0x4a5878, { opacity: 0.6 }));
    G.add(lab('迭代 0', [PX, -0.3, 0], { size: 17 }), lab(`${C[n - 1].it}`, [PX + PW, -0.3, 0], { size: 17 }));
    const t0 = Math.floor(0);
    return { update(p) {
      const i = Math.min(n - 1, Math.floor(p * n)), c = C[i], u = (p * n) % 1, f = Math.floor(u * 200) + 20, sm = sims[i], ff = Math.min(sm.Xs.length - 1, f);
      kk(sm.Ks[ff]); a1(sm.Xs[ff]);
      plots.forEach((pl, j) => { pl.tr.count(i + 1); const v = isFinite(c[pl.key]) ? c[pl.key] : pl.hi; dots[j].position.set(PX + i / (n - 1) * PW, pl.yv(v), 0); });
      cap(`迭代 <b>${c.it}</b>：Π 在真实仿真器里跟踪误差 <b>${isFinite(c.track) ? (c.track * 100).toFixed(1) + ' cm' : '发散'}</b>（只用 PD ${(R.base * 100).toFixed(1)} cm）· W 滚 32 帧差 <b>${c.wm > 20 ? '已发散' : c.wm >= 1 ? c.wm.toFixed(1) + ' m' : (c.wm * 100).toFixed(1) + ' cm'}</b> · 梯度余弦 <b>${isFinite(c.cos) ? c.cos.toFixed(2) : '—'}</b>`);
    } };
  }

  /* ---------- scene 9: gradient direction, BPTT versus likelihood ratio ---------- */
  const MS = [8, 64, 512];
  function s9(G, k) {
    const M = MS[k], R = main(), clip = Toy.EVAL, N = 32, s0 = Toy.ref(clip, 1).slice(), g0 = memo('g9', () => { const fd = Toy.fdSim(s0, clip, 1, N), o = new Float64Array(2 * N), g = new Float64Array(2 * N); Toy.gradW(R.W, s0, clip, 1, o, N, g); return { fd, g }; });
    const es = memo('lr' + M, () => { const r = Toy.rng(11 + M), out = []; for (let i = 0; i < 16; i++) out.push(Toy.lrEstimate(s0, clip, 1, N, M, 0.1, r)); return out; });
    /* basis: e1 along the true gradient, e2 and e3 orthogonal, fixed */
    const d = 2 * N, e1 = g0.fd.map(v => v / Toy.norm(g0.fd)), gs = (seed) => { const r = Toy.rng(seed), v = new Float64Array(d); for (let i = 0; i < d; i++) v[i] = Toy.gauss(r); return v; }, dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0), orth = (v, us) => { for (const u of us) { const q = dot(v, u); for (let i = 0; i < d; i++) v[i] -= q * u[i]; } const n = Toy.norm(v); for (let i = 0; i < d; i++) v[i] /= n; return v; }, e2 = orth(g0.g.slice(), [e1]), e3 = orth(gs(3), [e1, e2]), Lg = 6;
    const dir = g => { const n = Toy.norm(g), a = dot(g, e1) / n, r2 = g.map((x, i) => x / n - a * e1[i]), b = dot(r2, e2), c = dot(r2, e3), rest = Toy.norm(r2) || 1e-9, sc = Math.sqrt(Math.max(0, 1 - a * a)) / Math.max(Math.hypot(b, c), 1e-9); return [a * Lg, b * sc * Lg, c * sc * Lg, a]; };
    const dirs = es.map(dir), bp = dir(g0.g), cs = dirs.map(x => x[3]), mean = cs.reduce((a, b) => a + b) / cs.length, sd = Math.sqrt(cs.reduce((a, b) => a + (b - mean) ** 2, 0) / cs.length);
    const O = [-3.6, 4.1, 0], arr = es.map(() => dynArrow(G, COL.lr, 0.035)), aTrue = dynArrow(G, COL.tru, 0.075), aB = dynArrow(G, COL.wm, 0.07);
    aTrue(O, [O[0] + Lg, O[1], O[2]]); G.add(lab('仿真器真实梯度（有限差分）', [O[0] + Lg + 2.4, O[1] - 0.2, 0], { size: 19, border: 'rgba(212,95,160,.8)' }));
    const lB = lab(`穿过 W：余弦 ${bp[3].toFixed(3)}`, [O[0] + bp[0] + 2.2, O[1] + bp[1] + 0.2, bp[2]], { size: 19, border: 'rgba(79,201,138,.8)' }), lL = lab(`M = ${M} 的 16 次估计\n平均余弦 ${mean.toFixed(3)} ± ${sd.toFixed(3)}\n公式 √(M/(M+d)) = ${Math.sqrt(M / (M + d)).toFixed(3)}`, [-8.0, 4.1, 0], { size: 19, border: 'rgba(124,184,255,.8)' }); G.add(lB, lL);
    return { update(p) {
      const show = 16 * seg(p, 0.05, 0.7), bon = p > 0.72;
      dirs.forEach((v, i) => { const on = i < show; if (on) arr[i](O, [O[0] + v[0], O[1] + v[1], O[2] + v[2]]); else arr[i](O, O); });
      aB(O, bon ? [O[0] + bp[0], O[1] + bp[1], O[2] + bp[2]] : O); lB.visible = bon;
      cap(!bon ? `每根蓝箭头用 <b>${M}</b> 条仿真轨迹估计一次。维度 d = ${d}，<b>${Math.ceil(show)}</b> 次估计已画出`
        : `穿过 W 只要一次前向和一次反向，余弦 <b>${bp[3].toFixed(3)}</b>。蓝箭头这一组用了 <b>${16 * M}</b> 条仿真轨迹（玩具，起点偏移全零）`);
    } };
  }

  /* ---------- scene 10: the paper's curves ---------- */
  const EXP = [['seed', '图 9 · 随机种子：3 个种子'], ['engine', '图 9 · 物理引擎'], ['exp', '图 11 · 经验率：扔掉 70% 的回合（虚线是基线）'], ['sync', '图 11 · 策略同步（虚线是基线）'], ['imb', '图 11 · 数据失衡：Walk 过采样 10 倍'], ['wm', '图 15 · 世界模型窗口 N_W'], ['pi', '图 15 · 策略窗口 N_Π'], ['off', '图 15 · PD 偏移对绝对目标'], ['out', '图 15 · 输出加速度对速度']];
  const CCOL = { 'ST': COL.pi, 'PPO': COL.grad };
  function s10(G, k) {
    const ex = PAPER[EXP[k][0]], X0 = -9, Y0 = 0.3, W_ = 17, H = 8.4, xm = ex.xmax, ym = ex.ymax ?? 1, xf = v => X0 + v / xm * W_, yf = v => Y0 + v / ym * H, pal = [COL.pi, 0x1f9fc0, 0x7be0ff, COL.grad, 0xc4543a, 0xffa58c, COL.loss, COL.wm];
    G.add(L.line([[X0, Y0, 0], [X0 + W_, Y0, 0]], 0x8e9bb8), L.line([[X0, Y0, 0], [X0, Y0 + H, 0]], 0x8e9bb8));
    for (let i = 0; i <= 5; i++) { const v = ym * i / 5; G.add(L.line([[X0, yf(v), 0], [X0 + W_, yf(v), 0]], 0x4a5878, { opacity: 0.35 })); G.add(lab(v.toFixed(1), [X0 - 0.7, yf(v), 0], { size: 18 })); }
    const nt = 5; for (let i = 0; i <= nt; i++) { const v = xm * i / nt; G.add(lab(Number.isInteger(v) ? String(v) : v.toFixed(1), [xf(v), Y0 - 0.55, 0], { size: 18 })); }
    G.add(lab('训练时间（小时）', [X0 + W_ / 2, Y0 - 1.25, 0], { size: 19 }), lab(EXP[k][1] + ' · 重画', [X0 + W_ / 2, Y0 + H + 0.6, 0], { size: 22 }));
    const curves = ex.series.map((s, i) => { const c = s.c ? parseInt(s.c, 16) : pal[i % pal.length], mat = L.mat(c, { emissive: c, opacity: s.dash ? 0.55 : 1 }); mat.emissiveIntensity = 0.4; const pts = s.pts.map(q => new THREE.Vector3(xf(q[0]), yf(Math.min(q[1], ym)), s.dash ? -0.1 : 0)); const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), Math.max(8, pts.length * 2), s.dash ? 0.035 : 0.06, 5, false), mat); G.add(m); const e = s.pts[s.pts.length - 1], t = lab(`${s.n} ${e[1].toFixed(2)}`, [xf(e[0]) + 0.2 + (s.lx || 0), yf(e[1]) + 0.32 + (s.ly || 0), 0.1], { size: 18, color: '#' + c.toString(16).padStart(6, '0') }); t.visible = false; G.add(t); return { m, t, n: m.geometry.index.count, end: e[0] / xm }; });
    if (ex.mark) { G.add(L.line([[xf(ex.mark[0]), Y0, 0], [xf(ex.mark[0]), Y0 + H, 0]], 0xe6ecf7, { dashed: true, opacity: 0.8 }), lab(ex.mark[1], [xf(ex.mark[0]) + 1.2, Y0 + H - 0.5, 0], { size: 18 })); }
    return { update(p) {
      const u = seg(p, 0.03, 0.8); curves.forEach(c => { const q = clamp(u / Math.max(c.end, 0.001), 0, 1); c.m.geometry.setDrawRange(0, Math.floor(q * c.n / 6) * 6); c.t.visible = q > 0.98; });
      cap(ex.cap);
    } };
  }

  /* ---------- scene 11: horizons on one time axis ---------- */
  function s11(G, k) {
    const sm = k === 1, X0 = -9.5, sec = 6.4, xf = v => X0 + v * sec, row = (y, t, c, name, o = {}) => { const w = t * sec, m = block(w, 0.7, 1, c, [X0 + w / 2, y, 0], { opacity: o.op ?? 1 }); G.add(m); G.add(lab(name, [X0 + 3.4 + (o.tw || 0), y + 0.72, 0], { size: 19 })); return m; };
    G.add(L.line([[X0, 0.1, 0], [X0 + 2.6 * sec, 0.1, 0]], 0x8e9bb8)); for (let i = 0; i <= 5; i++) { const v = i * 0.5; G.add(L.line([[xf(v), 0.1, 0], [xf(v), 6.6, 0]], 0x4a5878, { opacity: 0.35 })); G.add(lab(v.toFixed(1) + ' s', [xf(v), -0.4, 0], { size: 18 })); }
    const hz = sm ? 50 : 60, nW = 8, nP = 32, a = row(5.6, nW / hz, COL.wm, `${sm ? 'k' : 'N_W'} = 8 帧 = ${(8 / hz).toFixed(3)} 秒`, {}), b = row(4.2, nP / hz, COL.pi, `${sm ? 'H' : 'N_Π'} = 32 帧 = ${(32 / hz).toFixed(3)} 秒`, {});
    const gamma = 100 / hz, c = row(2.8, gamma, sm ? COL.crit : COL.grad, sm ? `γ = 0.99：约 100 步 = ${gamma.toFixed(2)} 秒，窗口外靠评论家` : `PPO 的 γ = 0.99：约 100 帧 = ${gamma.toFixed(2)} 秒`, { tw: 1.7, op: 0.75 });
    const crit = block(Math.max(0.1, (gamma - 32 / hz) * sec), 0.5, 1.1, COL.crit, [X0 + (32 / hz + gamma) / 2 * sec, 4.2, 0], { opacity: 0.8 }); crit.visible = sm; G.add(crit); if (sm) G.add(lab('评论家 V 估计窗口之外', [X0 + (32 / hz + gamma) / 2 * sec + 2.2, 4.95, 0], { size: 18, border: 'rgba(157,140,255,.8)' }));
    const line = (t) => { const l = L.line([[xf(t), 0.1, 0.8], [xf(t), 6.6, 0.8]], COL.loss); G.add(l); return l; }, cur = block(0.08, 6.5, 0.08, COL.loss, [X0, 3.3, 0.8]); G.add(cur);
    const rows = sm ? [['世界模型', '(2048, 2048, 2048)；状态细节没写'], ['损失', 'L2＋奖励、观测、终止头'], ['评论家', '(256, 128)，λ = 0.95'], ['动作', 'q_sp = αa + q⁰（绕默认姿态）'], ['仿真', 'MuJoCo Warp，4096 环境/GPU，50 Hz'], ['数据', '最多 264 小时；上真机']]
      : [['世界模型', '5 × 1024 ELU；预测加速度再积分'], ['损失', 'L1，只跟踪项；没有奖励头'], ['评论家', '没有'], ['动作', 't = exp(α/2·ô) ⊗ kᵗ（绕参考）'], ['仿真', 'PhysX 等，256 角色，60 Hz 控制'], ['数据', '最多约 7 小时；不上真机']];
    rows.forEach((r, i) => G.add(lab(`${r[0]}：${r[1]}`, [X0 + 4.6 + (i % 2) * 10.2, -1.5 - Math.floor(i / 2) * 0.86, 0], { size: 18 })));
    return { update(p) {
      const t = p * 2.5; cur.position.x = xf(t);
      glow(a, t < 8 / hz ? 0.35 : 0); glow(b, t < 32 / hz ? 0.35 : 0); glow(c, t < gamma ? 0.25 : 0);
      cap(sm ? `窗口 8 和 32 帧数相同。SuperMimic 在第 32 步后接<b>评论家</b>，所以比 SuperTrack 多看到窗口外的回报`
        : `一条动作的梯度只来自 <b>${(32 / hz).toFixed(2)} 秒</b>内的损失。此刻 t = <b>${t.toFixed(2)}</b> 秒${t > 32 / hz ? '，已经超出 N_Π，<b>这之后的后果策略看不到</b>' : ''}`);
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];
  const CTL = SCENES.map(s => (s.ctl ? (s.ctl.def || 0) : 0));
  /* ---------- player ---------- */
  let cur = 0, api = null, playing = !L.reduced(), t0 = 0, pNow = 0, tw = null, token = 0;
  const HOLD = 1.8;
  const aspectFix = () => { const el = $('stage'), asp = (el.clientWidth || 1) / (el.clientHeight || 1); return Math.min(2.2, Math.max(1, 1.45 / asp)); };
  function fly(th, ph, d, tg) { let dth = th - S.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth)); d *= aspectFix(); tw = { t0: performance.now(), from: [S.theta, S.phi, S.dist, S.target.clone()], to: [S.theta + dth, ph, d, new THREE.Vector3(...tg)] }; refDist = d; }
  function setPlay(on) { playing = on; $('play').textContent = on ? '❚❚ 暂停' : '▶ 播放'; $('play').setAttribute('aria-label', on ? '暂停' : '播放'); }
  function renderCtl(sc, i) { const box = $('ctl'); if (sc.ctl) { box.hidden = false; box.innerHTML = `<span>${sc.ctl.label}</span>` + sc.ctl.items.map((t, q) => `<button type="button" data-k="${q}" aria-pressed="${q === CTL[i]}">${t}</button>`).join(''); } else { box.hidden = true; box.innerHTML = ''; } }
  function build(i, p0, keepCam) {
    const sc = SCENES[i]; L.clear(root); LABS = []; PICKS = []; lastCap = null;
    if (!keepCam) fly(...sc.cam); refDist = sc.cam[2] * aspectFix();
    const G = new THREE.Group(); root.add(G); api = BUILD[i](G, CTL[i]); pNow = p0; t0 = performance.now() - p0 * sc.dur * 1000; api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
  }
  function go(i, p0 = 0, keepCam = false) {
    cur = (i + SCENES.length) % SCENES.length; showInfo(cur); const sc = SCENES[cur], mine = ++token; renderCtl(sc, cur);
    if (!S) return;
    const slow = (sc.toy && !has.has('toy')) || (cur === 7 && !has.has('r' + CTL[7])) || (cur === 4 && !has.has('w' + CTL[4]));
    if (slow) { L.clear(root); LABS = []; api = null; lastCap = null; cap('玩具正在这个页面里现场训练，约一两秒…'); setTimeout(() => { if (mine !== token) return; has.add('toy'); if (cur === 7) has.add('r' + CTL[7]); if (cur === 4) has.add('w' + CTL[4]); build(cur, p0, keepCam); window.__stReady = true; }, 40); if (!keepCam) fly(...sc.cam); return; }
    build(cur, p0, keepCam); window.__stReady = true;
  }
  if (S) {
    S.onTick(() => {
      if (playing && api) { const sc = SCENES[cur], el = (performance.now() - t0) / 1000; if (el > sc.dur + HOLD) { t0 = performance.now(); pNow = 0; } else pNow = Math.min(1, el / sc.dur); api.update(pNow); $('scrub').value = Math.round(pNow * 1000); }
      if (tw) { const k = L.reduced() ? 1 : Math.min(1, (performance.now() - tw.t0) / 900), e = L.ease(k), a = tw.from, b = tw.to; S.setView(L.lerp(a[0], b[0], e), L.lerp(a[1], b[1], e), L.lerp(a[2], b[2], e), a[3].clone().lerp(b[3], e).toArray()); if (k >= 1) tw = null; }
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
