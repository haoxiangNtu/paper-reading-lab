'use strict';
/* ControlVAE (arXiv 2210.06063) taken apart into eleven scenes. Sizes and hyperparameters come from the paper and the
   official code. Scenes 2 to 10 run a real, tiny ControlVAE on a toy: trained in this tab with a fixed seed. Each scene's
   update(p) is a pure function of the timeline p. Scene 1 and 11 are structure only. */
/* TOY-BEGIN : a real, tiny ControlVAE trained in this browser tab. No baked weights, no canned curves. */
const Toy = (function () {
  function RNG(seed) {
    let a = seed >>> 0, spare = null;
    const u = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const n = () => { if (spare != null) { const s = spare; spare = null; return s; } let x = 0, y = 0, r = 0; do { x = 2 * u() - 1; y = 2 * u() - 1; r = x * x + y * y; } while (r >= 1 || r === 0); const f = Math.sqrt(-2 * Math.log(r) / r); spare = y * f; return x * f; };
    return { u, n, int: k => Math.floor(u() * k) };
  }
  /* one hidden layer, ELU (the paper uses ELU), hand-written vector-Jacobian product so a whole rollout backpropagates cheaply */
  class MLP {
    constructor(nI, nH, nO, rng, gain = 1) {
      this.nI = nI; this.nH = nH; this.nO = nO;
      this.p = new Float64Array(nH * (nI + 1) + nO * (nH + 1));
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
    vjp(c, cot, learn) {  /* returns the cotangent on the input; accumulates dL/dparams into this.g when learn is true */
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
  /* The black-box "simulator". The learner never sees these formulas: it only sees transitions.
     s = (u forward speed, w yaw rate); a = (target speed, target yaw rate), a first-order servo plus coupled drag. */
  const DT = 0.25;
  const lim = x => Math.max(-4, Math.min(4, x));
  const sim = (s, a0) => { const a = [lim(a0[0]), lim(a0[1])]; return simc(s, a); };
  const simc = (s, a) => [s[0] + 0.45 * (a[0] - s[0]) - 0.05 * s[0] * Math.abs(s[0]) - 0.04 * s[1] * s[1] * s[0], s[1] + 0.45 * (a[1] - s[1]) - 0.05 * s[0] * s[1]];
  const SKILLS = [['停', 0, 0], ['走', 1, 0], ['跑', 2.5, 0], ['左转', 1, 1.2], ['右转', 1, -1.2]];
  const pose = (P, s) => { const th = P[2] + s[1] * DT; return [P[0] + s[0] * Math.cos(th) * DT, P[1] + s[0] * Math.sin(th) * DT, th]; };
  const wrap = x => Math.atan2(Math.sin(x), Math.cos(x));
  /* motion dataset D: an unstructured kinematic sequence that wanders between the five skills */
  function makeD(seed, N = 900) {
    const r = RNG(seed), S = new Array(N), lab = new Int8Array(N); let k = 1, u = 1, w = 0, left = 0;
    for (let i = 0; i < N; i++) { if (left-- <= 0) { k = r.int(5); left = 12 + r.int(20); } u += 0.25 * (SKILLS[k][1] - u) + 0.025 * r.n(); w += 0.25 * (SKILLS[k][2] - w) + 0.025 * r.n(); S[i] = [u, w]; lab[i] = k; }
    return { S, lab, N };
  }
  const NZ = 2;
  function makeAgent(seed, nc, sig) {
    const r = RNG(seed);
    return { nc, sig: sig ?? (nc ? 1 : 0.3), P: new MLP(2, 12, NZ, r, 1), Q: new MLP(4, 16, NZ, r, 1), Pi: new MLP(4, 20, 2, r, 3), W: new MLP(4, 24, 2, r, 1) };
  }
  const muP = (A, s) => A.nc ? null : A.P.f(s);
  const pm = (A, s) => { if (A.nc) return [0, 0]; const y = A.P.f(s).y; return [y[0], y[1]]; };
  const qm = (A, s, t) => { const y = A.Q.f([s[0], s[1], t[0], t[1]]).y; return [y[0], y[1]]; };
  const act = (A, s, z) => { const y = A.Pi.f([s[0], s[1], z[0], z[1]]).y; return [y[0], y[1]]; };
  const wm = (A, s, a) => { const y = A.W.f([s[0], s[1], a[0], a[1]]).y; return [s[0] + y[0], s[1] + y[1]]; };

  function collect(A, D, r, n, pPrior, buf, stats) {
    let cnt = 0, rsum = 0;
    while (cnt < n) {
      let i = r.int(D.N - 2), s = D.S[i].slice(), bad = 0, t = 0;
      const tr = { s: [s], a: [], tgt: [] };
      while (t < 64) {
        const tg = D.S[i + 1], mp = pm(A, s);
        const usePrior = r.u() < pPrior, mq = usePrior ? [0, 0] : qm(A, s, tg);
        const z = [mp[0] + mq[0] + A.sig * r.n(), mp[1] + mq[1] + A.sig * r.n()];
        const a0 = act(A, s, z), a = [a0[0] + 0.05 * r.n(), a0[1] + 0.05 * r.n()], s2 = sim(s, a);
        tr.a.push(a); tr.tgt.push(tg); tr.s.push(s2);
        const err = Math.abs(s2[0] - tg[0]) + Math.abs(s2[1] - tg[1]); rsum += Math.exp(-err / 1); cnt++;
        bad = err > 1.5 ? bad + 1 : Math.max(0, bad - 1); s = s2; t++; i++;
        if (i >= D.N - 2 || (t % 24 === 0)) i = r.int(D.N - 2);
        if (bad >= 4 && t >= 12) break;  /* like env_min_length in the released code: without it, short episodes starve the window sampler */
      }
      buf.push(tr);
    }
    while (buf.length > 40) buf.shift();
    stats.rew = rsum / cnt;
  }
  function pick(buf, r, T) { for (let k = 0; k < 40; k++) { const tr = buf[r.int(buf.length)]; if (tr.a.length >= T) { const o = r.int(tr.a.length - T + 1); return { tr, o }; } } return null; }

  function trainW(A, buf, r, Tw, bs, lr) {
    let tot = 0, c = 0;
    for (let b = 0; b < bs; b++) {
      const w = pick(buf, r, Tw); if (!w) continue;
      let s = w.tr.s[w.o]; const caches = [];
      for (let t = 0; t < Tw; t++) { const a = w.tr.a[w.o + t], C = A.W.f([s[0], s[1], a[0], a[1]]); const ns = [s[0] + C.y[0], s[1] + C.y[1]], g = w.tr.s[w.o + t + 1]; const e0 = ns[0] - g[0], e1 = ns[1] - g[1]; tot += Math.abs(e0) + Math.abs(e1); c++; caches.push({ C, s0: Math.sign(e0), s1: Math.sign(e1) }); s = ns; }
      let c0 = 0, c1 = 0;
      for (let t = Tw - 1; t >= 0; t--) { c0 += caches[t].s0; c1 += caches[t].s1; const ci = A.W.vjp(caches[t].C, [c0, c1], true); c0 += ci[0]; c1 += ci[1]; }
    }
    const k = 1 / (bs * Tw); for (let i = 0; i < A.W.g.length; i++) A.W.g[i] *= k;
    A.W.adam(lr); return c ? tot / c : 0;
  }
  const GAM = 0.95, WA1 = 0.002, WA2 = 0.001;
  /* one rollout of the VAE loop through the (frozen here) world model. Returns the per-step story; learn=true accumulates gradients */
  function vaeRollout(A, s0, tgts, eps, beta, learn, gam = GAM) {
    const T = tgts.length, sig = A.sig, tape = []; let s = s0, Lr = 0, Lk = 0, La = 0; const path = [s0];
    for (let t = 0; t < T; t++) {
      const Cp = A.nc ? null : A.P.f(s), mp = Cp ? Cp.y : [0, 0], Cq = A.Q.f([s[0], s[1], tgts[t][0], tgts[t][1]]), mq = Cq.y;
      const z = [mp[0] + mq[0] + sig * eps[t][0], mp[1] + mq[1] + sig * eps[t][1]];
      const Cpi = A.Pi.f([s[0], s[1], z[0], z[1]]), a = [Cpi.y[0] + 0.05 * eps[t][2], Cpi.y[1] + 0.05 * eps[t][3]];
      const Cw = A.W.f([s[0], s[1], a[0], a[1]]), ns = [s[0] + Cw.y[0], s[1] + Cw.y[1]], g = Math.pow(gam, t);
      const e0 = tgts[t][0] - ns[0], e1 = tgts[t][1] - ns[1], kl = (mq[0] * mq[0] + mq[1] * mq[1]) / (2 * sig * sig), al = WA1 * (Math.abs(a[0]) + Math.abs(a[1])) + WA2 * (a[0] * a[0] + a[1] * a[1]);
      Lr += g * (Math.abs(e0) + Math.abs(e1)); Lk += g * kl; La += g * al;
      tape.push({ Cp, Cq, Cpi, Cw, s, ns, a, z, mp, mq, g, e0, e1, kl }); s = ns; path.push(ns);
    }
    let c0 = 0, c1 = 0; const gz = new Array(T), gs = new Array(T);
    for (let t = T - 1; t >= 0; t--) {
      const q = tape[t], g = q.g;
      c0 += -g * Math.sign(q.e0); c1 += -g * Math.sign(q.e1);
      const ci = A.W.vjp(q.Cw, [c0, c1], false);
      const ca = [ci[2] + g * (WA1 * Math.sign(q.a[0]) + 2 * WA2 * q.a[0]), ci[3] + g * (WA1 * Math.sign(q.a[1]) + 2 * WA2 * q.a[1])];
      const cp = A.Pi.vjp(q.Cpi, ca, learn), cz = [cp[2], cp[3]];
      gz[t] = Math.hypot(cz[0], cz[1]);
      const kk = g * beta / (sig * sig), cq = A.Q.vjp(q.Cq, [cz[0] + kk * q.mq[0], cz[1] + kk * q.mq[1]], learn);
      let d0 = c0 + ci[0] + cp[0] + cq[0], d1 = c1 + ci[1] + cp[1] + cq[1];
      if (q.Cp) { const cprior = A.P.vjp(q.Cp, cz, learn); d0 += cprior[0]; d1 += cprior[1]; }
      c0 = d0; c1 = d1; gs[t] = Math.hypot(c0, c1);
    }
    return { Lr, Lk, La, tape, path, gz, gs };
  }
  function trainV(A, buf, r, T, bs, beta, lr) {
    let Lr = 0, Lk = 0, La = 0, c = 0;
    for (let b = 0; b < bs; b++) {
      const w = pick(buf, r, T); if (!w) continue; const tg = w.tr.tgt.slice(w.o, w.o + T), eps = tg.map(() => [r.n(), r.n(), r.n(), r.n()]);
      const R = vaeRollout(A, w.tr.s[w.o], tg, eps, beta, true); Lr += R.Lr / T; Lk += R.Lk / T; La += R.La / T; c++;
    }
    const k = 1 / (bs * T); for (const N of [A.P, A.Q, A.Pi]) { for (let i = 0; i < N.g.length; i++) N.g[i] *= k; N.adam(lr); }
    return { Lr: Lr / c, Lk: Lk / c, La: La / c };
  }
  const clone = A => ({ P: A.P.p.slice(), Q: A.Q.p.slice(), Pi: A.Pi.p.slice(), W: A.W.p.slice() });
  function restore(A, snap) { const B = Object.assign({}, A); for (const k of ['P', 'Q', 'Pi', 'W']) { B[k] = Object.create(MLP.prototype); Object.assign(B[k], A[k]); B[k].p = snap[k]; } return B; }

  /* Algorithm 1 on the toy */
  function trainAll({ seed = 7, nc = false, sig = null, epochs = 120 } = {}) {
    const D = makeD(11), A = makeAgent(seed, nc, sig), r = RNG(seed * 31 + 5), buf = [], log = [], snaps = []; const st = {};
    for (let e = 0; e < epochs; e++) {
      collect(A, D, r, 96, 0.4, buf, st);
      let Lw = 0; for (let i = 0; i < 8; i++) Lw += trainW(A, buf, r, 8, 6, 3e-3); Lw /= 8;
      const beta = 0.01 + 0.09 * Math.min(1, Math.floor(e / 8) / 9); let V = null, Lr = 0, Lk = 0, La = 0;
      for (let i = 0; i < 8; i++) { V = trainV(A, buf, r, 10, 6, beta, 3e-3); Lr += V.Lr; Lk += V.Lk; La += V.La; }
      log.push({ e, Lw, Lr: Lr / 8, Lk: Lk / 8, La: La / 8, beta, rew: st.rew });
      if (e % 6 === 0 || e === epochs - 1) snaps.push({ e, s: clone(A) });
    }
    return { A, D, buf, log, snaps };
  }
  /* --- section 4: task control on top of the frozen skill space --- */
  /* heading loss, Eq. 25 with the paper's weights (2.0, 1.0). delta = theta* - theta */
  const taskLoss = (s2, d2, vs) => 2 * Math.abs(wrap(d2)) + Math.abs(vs - s2[0]) / Math.max(vs, 1);
  const gIn = (s, d, vs) => [s[0], s[1], Math.sin(d), Math.cos(d), vs];
  function taskRollout(A, G, s0, d0, vs, T, wz, r, learn) {
    let s = s0, d = d0, L = 0, Lz = 0; const tape = [];
    for (let t = 0; t < T; t++) {
      const Cp = A.nc ? null : A.P.f(s), mp = Cp ? Cp.y : [0, 0], Cg = G.f(gIn(s, d, vs)), mg = Cg.y;
      const z = [mp[0] + mg[0] + A.sig * r.n(), mp[1] + mg[1] + A.sig * r.n()], Cpi = A.Pi.f([s[0], s[1], z[0], z[1]]);
      const a = [Cpi.y[0] + 0.05 * r.n(), Cpi.y[1] + 0.05 * r.n()], Cw = A.W.f([s[0], s[1], a[0], a[1]]), ns = [s[0] + Cw.y[0], s[1] + Cw.y[1]], nd = d - ns[1] * DT;
      L += taskLoss(ns, nd, vs); Lz += mg[0] * mg[0] + mg[1] * mg[1]; tape.push({ Cp, Cg, Cpi, Cw, s, d, ns, nd, mg }); s = ns; d = nd;
    }
    let c0 = 0, c1 = 0, cd = 0;
    for (let t = T - 1; t >= 0; t--) {
      const q = tape[t];
      cd += 2 * Math.sign(wrap(q.nd)); c0 += -Math.sign(vs - q.ns[0]) / Math.max(vs, 1); c1 += -DT * cd;
      const ci = A.W.vjp(q.Cw, [c0, c1], false), cp = A.Pi.vjp(q.Cpi, [ci[2], ci[3]], false), cz = [cp[2], cp[3]];
      let d0x = c0 + ci[0] + cp[0], d1x = c1 + ci[1] + cp[1];
      if (q.Cp) { const u = A.P.vjp(q.Cp, cz, false); d0x += u[0]; d1x += u[1]; }
      const cg = G.vjp(q.Cg, [cz[0] + 2 * wz * q.mg[0], cz[1] + 2 * wz * q.mg[1]], learn);
      c0 = d0x + cg[0]; c1 = d1x + cg[1]; cd += Math.cos(q.d) * cg[2] - Math.sin(q.d) * cg[3];
    }
    return { L: L / T, Lz: Lz / T };
  }
  function trainTask(A, { seed = 3, wz = 2, iters = 500 } = {}) {
    const r = RNG(seed * 97 + 1), G = new MLP(5, 16, 2, r, 0.3), log = [], D = makeD(11);
    for (let it = 0; it < iters; it++) {
      let L = 0, Lz = 0; const B = 6, T = 16;
      for (let b = 0; b < B; b++) {
        const s0 = D.S[r.int(D.N - 2)].slice(), d0 = (r.u() * 2 - 1) * Math.PI, vs = r.u() * 2.5;
        const R = taskRollout(A, G, s0, d0, vs, T, wz, r, true); L += R.L; Lz += R.Lz;
      }
      const k = 1 / (B * T); for (let i = 0; i < G.g.length; i++) G.g[i] *= k;
      G.adam(0.003 * Math.max(Math.pow(0.99, it / 4), 0.1)); log.push({ L: L / B, Lz: Lz / B });
    }
    return { G, log, wz };
  }
  /* run a controller in the true toy simulator. ctrl(s, d, vs, r) -> z */
  function runTask(A, ctrl, { th = 1.5, vs = 1.5, T = 60, seed = 5, s0 = [0, 0], switchAt = null, th2 = 0, vs2 = 0 } = {}) {
    const r = RNG(seed); let s = s0.slice(), P = [0, 0, 0], E = 0, Eh = 0; const out = [{ s, P, z: null, th, vs }];
    for (let t = 0; t < T; t++) {
      if (switchAt != null && t === switchAt) { th = th2; vs = vs2; }
      const d = wrap(th - P[2]), z = ctrl(s, d, vs, r), a0 = act(A, s, z), a = [a0[0] + 0.05 * r.n(), a0[1] + 0.05 * r.n()], s2 = sim(s, a); P = pose(P, s2); s = s2;
      const dn = wrap(th - P[2]); E += Math.abs(vs - s[0]); Eh += Math.abs(dn); out.push({ s, P, z, a, th, vs, mp: pm(A, out[out.length - 1].s) });
    }
    return { out, eV: E / T, eH: Eh / T };
  }
  const policyCtrl = (A, G) => (s, d, vs, r) => { const m = pm(A, s), g = G.f(gIn(s, d, vs)).y; return [m[0] + g[0] + A.sig * r.n(), m[1] + g[1] + A.sig * r.n()]; };
  const priorCtrl = A => (s, d, vs, r) => { const m = pm(A, s); return [m[0] + A.sig * r.n(), m[1] + A.sig * r.n()]; };
  /* section 4.1: sampling MPC with the paper's N=128, T=4. Returns the best first latent and the imagined fan */
  function mpcPlan(A, s, d, vs, r, N = 128, T = 4) {
    let best = Infinity, bz = null; const fan = [];
    for (let i = 0; i < N; i++) {
      let q = s, dd = d, L = 0, z0 = null; const P = [[0, 0, 0]];
      for (let t = 0; t < T; t++) { const m = pm(A, q), z = [m[0] + A.sig * r.n(), m[1] + A.sig * r.n()]; if (!t) z0 = z; const n = wm(A, q, act(A, q, z)); dd -= n[1] * DT; L += taskLoss(n, dd, vs); P.push(pose(P[P.length - 1], n)); q = n; }
      fan.push({ L, P, z0 }); if (L < best) { best = L; bz = z0; }
    }
    return { z: bz, best, fan };
  }
  /* compare world models fitted with Tw = 1 and Tw = 8 on the same buffer: open-loop error versus horizon */
  function compareTw(A, buf, { seed = 21, iters = 400 } = {}) {
    const res = {};
    for (const Tw of [1, 8]) {
      const r = RNG(seed), B = Object.assign({}, A); B.W = new MLP(4, 24, 2, r, 1);
      for (let i = 0; i < iters; i++) trainW(B, buf, r, Tw, Math.round(48 / Tw), 3e-3);
      const rr = RNG(seed + 1), H = 24, sum = new Float64Array(H), cnt = new Float64Array(H);
      for (let n = 0; n < 200; n++) { const w = pick(buf, rr, 8); if (!w) continue; let s = w.tr.s[w.o]; const m = w.tr.a.length - w.o; for (let t = 0; t < Math.min(H, m); t++) { s = wm(B, s, w.tr.a[w.o + t]); const g = w.tr.s[w.o + t + 1]; sum[t] += Math.abs(s[0] - g[0]) + Math.abs(s[1] - g[1]); cnt[t]++; } }
      res[Tw] = { W: B, err: Array.from(sum, (v, i) => cnt[i] ? v / cnt[i] : null) };
    }
    return res;
  }
  return { RNG, MLP, DT, sim, SKILLS, pose, wrap, makeD, makeAgent, pm, qm, act, wm, collect, trainW, trainV, vaeRollout, trainAll, restore, clone, GAM, WA1, WA2, taskLoss, gIn, trainTask, runTask, policyCtrl, priorCtrl, mpcPlan, compareTw, pick };
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
  const COL = { prior: 0x3aa8e0, post: 0xf0963c, pi: 0x38d1ff, wm: 0x4fc98a, sim: 0x8e9bb8, data: 0xd45fa0, buf: 0x9d8cff, grad: 0xff7a59, task: 0xf2c14e, white: 0xe6ecf7 };
  const SK = [0x3987e5, 0xd95926, 0x199e70, 0xc98500, 0x9d8cff];
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyB = t => `<p class="guess toy"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const LIVE = '<div id="live" class="live"></div><div id="miniBox" class="minibox" hidden><canvas id="mini" height="150"></canvas><p id="miniLeg" class="minileg"></p></div>';

  /* ---------- the models (trained here, once per variant, deterministically) ---------- */
  const VAR = [['条件先验 N(μp(s), 0.3²I)', false, 0.3], ['N(0, I)（论文 VAE-NC 的写法）', true, 1], ['N(0, 0.3²I)（只去掉条件）', true, 0.3]];
  const U = { v: clamp(parseInt(qs.get('v'), 10) || 0, 0, 2), sk: 1, tgt: 3, beta: 0.1, gam: 0.95, wz: 2, pPrior: 0.4, Tw: 8, seed: 1, z: null, field: 0, th: 1, N: 128 };
  const cache = {};
  function M(v = U.v) { if (!cache[v]) cache[v] = Toy.trainAll({ nc: VAR[v][1], sig: VAR[v][2] }); return cache[v]; }
  function task(v, wz) { const k = v + '|' + wz; if (!cache[k]) cache[k] = Toy.trainTask(M(v).A, { wz }); return cache[k]; }
  function tw() { if (!cache.tw) cache.tw = Toy.compareTw(M(0).A, M(0).buf); return cache.tw; }

  const SCENES = [
    { n: 1, part: '总览', title: '三个循环步骤和四个网络', sub: '收集 → 训世界模型 → 穿过世界模型训 VAE', dur: 15, cam: [0, 0.95, 37, [0, 2, 0]],
      html: dl([['收集', '当前策略在真仿真器里跟踪参考片段，写入缓存 B'], ['世界模型', 'ω：从 B 取 8 帧窗口，每轮更新 8 次'], ['VAE', 'p、q、π：穿过 ω 滚 24 帧，每轮更新 8 次']]) +
        '<p>这张图对应原文图 2。ω 只负责把仿真器换成可导的东西，仿真器本身从不被求导。原文图 2 用绿色虚线标生成路径（部署时走的路），实线标训练路径；这里把循环拆成三段动画。</p><p>点方块可以跳到讲它的那一幕。</p>' +
        src('§3 · 图 2 · 算法 1 · §3.3.3') },
    { n: 2, part: '§3.1 生成', title: '先验跟着状态走', sub: '拖隐空间的点，切换先验，看下一步', dur: 16, cam: [0, 0.8, 27.5, [0, 1.5, 0.4]],
      html: LIVE + '<p>左边是隐空间。曲面高度就是先验密度 \\(p(z|s)=\\mathcal N(\\mu_p(s),\\sigma_p^2 I)\\)，均值 \\(\\mu_p\\) 是网络输出，每一帧按当前状态现算。右边是状态平面，粉色点是数据集，彩点是每个 z 样本经 π 和真仿真器后到的下一状态。</p><p>论文的理由：标准正态先验下角色频繁换技能、动作发抖，同一个技能在不同状态被编到隐空间的不同位置。把先验改成随状态变，才有这样的结构。</p>' +
        toyB('二维状态、二维隐变量，隐网络现场训练。论文是 64 维隐空间、σ = 0.3。切换先验后第一次要训约 0.5 秒。') + src('式 3 · 式 4 · §3.1 · §3.4.1') },
    { n: 3, part: '§3.2 推断', title: '后验只学一个残差', sub: 'KL 只剩一个二次型，拖动后验看它变', dur: 16, cam: [0, 0.8, 27.5, [0, 1.5, 0.4]],
      html: LIVE + '<p>后验均值写成 \\(\\hat\\mu_q=\\mu_p+\\mu_q\\)，两个分布共用 σ，所以 KL 就是残差的二次型：\\(\\mathrm{KL}=\\mu_q^\\top\\mu_q/2\\sigma_p^2\\)（式 9）。面板里的 KL 按这个公式算，旁边是一个 4000 样本的蒙特卡洛估计，用来核对。</p><p>从这里能直接看出一件事：\\(\\partial\\mathrm{KL}/\\partial\\mu_p=0\\)。先验网络拿不到 KL 的梯度，它只靠重建损失通过 z 传回来的梯度学习（读者注 2）。</p><p>拖动隐空间的点相当于手动放后验均值。切到“损失地形”看 \\(\\mathcal L_{rec}+\\beta\\mathcal L_{kl}\\) 对 z 的形状，编码器给的橙点应该落在高处附近。</p>' +
        toyB('一步损失，ω 和 π 都是现场训练好的。高度 = exp(−损失)。') + src('式 7 · 式 8 · 式 9 · §3.2') },
    { n: 4, part: '§3.3.3 收集', title: '仿真器里跑，40% 的步从先验采', sub: '切换比例，看蓝橙两种步和参考的距离', dur: 16, cam: [0, 0.8, 27.5, [0, 1.5, 0.4]],
      html: LIVE + '<p>每轮开始，从数据集选一段参考，当前策略在<b>真仿真器</b>里跟它。每一步的 z 以 0.4 的概率从先验采（蓝），否则从后验采（橙）。参考片段中途会随机换一段，逼策略学过渡，也因此经常摔倒，再自己爬起来。</p>' +
        dl([['每轮新增', '\\(N_{B\'}=2048\\) 状态'], ['缓存', '\\(N_B=5\\times10^4\\)'], ['最长', '512 帧'], ['提前终止', '头部误差 > 0.5 m 超过 1 秒'], ['换参考', '代码每 96 帧，论文没写']]) +
        '<p>数据平衡（式 18 至 20）让学得差的状态更常被选为起点。</p>' + toyB('玩具里每轮 96 步、最长 64 步、每 24 步换参考。没有做数据平衡。路径是真的跑出来的。') + src('§3.3.3 · §3.4.3 · §3.4.4 · 算法 1') },
    { n: 5, part: '§3.3.2 世界模型', title: 'ω 吃自己的预测，滚 8 帧', sub: '切换 Tw = 1 / 8，看开环误差', dur: 14, cam: [0, 0.8, 27.5, [0, 1.5, 0.4]],
      html: LIVE + '<p>从缓存记录的状态出发，重放记录的动作，把 ω 的预测接回 ω，每一帧都和记录比（式 14）。ω 输出速度和角速度的增量，新状态用前向欧拉积分得到（§3.4.2）。滚动时直接用均值，不采样。</p><p>论文图 13(c)：\\(T_w=1\\) 时训练不稳定，很早就崩。</p>' +
        toyB('这个玩具<b>没有复现</b>那个崩溃：动力学是光滑的一阶伺服，没有接触，Tw = 1 反而误差略小。曲线是在同一个缓存上分别训练两个 ω 算出来的。所以这一幕只教结构，不能拿来佐证图 13(c)。') + src('式 14 · 式 17 · §3.3.3 · 图 13(c)') },
    { n: 6, part: '§3.3.1 VAE 回路', title: '梯度穿过 ω，回到每一步的 z', sub: '改 β 和 γ，柱子是现算的梯度', dur: 17, cam: [0, 0.98, 33, [0, 2.2, 0]],
      html: LIVE + '<p>从缓存状态出发，每步 \\(z_t\\sim q(z|s_t,\\tilde s_{t+1})\\)，\\(a_t\\sim\\pi\\)，\\(s_{t+1}=\\mu_w(s_t,a_t)\\)。损失是 \\(\\mathcal L_{rec}+\\beta\\mathcal L_{kl}+\\mathcal L_{act}\\)，都乘 \\(\\gamma^t\\)。这一步 ω 的参数不更新，但 ω 的雅可比参与反传。</p><p>蓝柱是每一步的重建误差，红柱是 \\(\\|\\partial\\mathcal L/\\partial z_t\\|\\)。平均来说靠前的 z 梯度更大，因为它影响后面所有步：玩具上 400 个窗口的均值，t = 0 是 1.04，t = 7 是 0.47。单条滚动不一定单调。</p>' +
        toyB('T = 8，一条真实的滚动和一次真实的反向传播，不是假曲线。论文 T = 24、批量 512。') + src('式 10 至 13 · 式 16 · 算法 1') },
    { n: 7, part: '算法 1', title: '一轮接一轮：隐空间怎样长出来', sub: '拖进度条看第几轮，对比三种先验', dur: 16, cam: [0, 0.8, 27.5, [0, 1.5, 0.4]],
      html: LIVE + '<p>进度条是训练轮数。左边每个点是一个状态转移的后验均值，按技能上色，这是原文图 8 的玩具版。右边箭头是 \\(s\\to\\text{sim}(s,\\pi(s,\\mu_p(s)))\\)，看不加噪声时先验能否保持当前技能。</p>' +
        toyB('120 轮，三种先验都在打开这一幕时现算。分离度 = 类间距离 / 类内距离，是我定义的，论文没有这个数。论文图 8 没写投影方法。') + src('算法 1 · 图 4 · 图 8') },
    { n: 8, part: '§5.3 采样', title: '从隐空间采，真仿真器里走', sub: '拖一个 z，或者重抽；对照原文图 5', dur: 15, cam: [0, 0.8, 27.5, [0, 1.5, 0.4]],
      html: LIVE + '<p>每个控制步都从 \\(p(z|s)\\) 抽一个 z，走 40 步，共 12 条（原文图 5 是 200 步，约 10 秒）。拖左边的点，白线是“每步都用这同一个 z 相对先验均值的偏移”走出来的路径，面板是这个 z 的先验概率和一步结果。</p>' +
        toyB('走的是玩具仿真器，小车不是角色模型。玩具里“多样”的含义只是速度和转向不同。') + src('§5.3 · 图 5') },
    { n: 9, part: '§4.1 MPC', title: '采 128 条，走最好那条的第一步', sub: '改 N 和目标方向，每步现算', dur: 16, cam: [0, 0.8, 27.5, [0, 1.5, 0.4]],
      html: LIVE + '<p>每个控制步在 ω 里想象 \\(N_{MPC}=128\\) 条、每条 \\(T_{MPC}=4\\) 步的轨迹，z 从状态条件先验采。用任务损失打分，把最好那条的第一个动作放到仿真器里。这里不用训练任何新网络。中途目标会变一次。</p><p>论文说它做不到平滑准确，主要用来试损失函数是否合适。官方代码里没有这部分。</p>' +
        toyB('N、T 和论文相同，损失是式 25 的航向项，权重 (2, 1)。') + src('§4.1 · §5.4') },
    { n: 10, part: '§4.2 任务策略', title: '冻结技能空间，只训 μg', sub: '改 w_z 和先验，轨迹都在真仿真器里', dur: 17, cam: [0, 0.8, 27.5, [0, 1.5, 0.4]],
      html: LIVE + '<p>任务策略输出先验均值上的残差：\\(\\hat\\mu_g=\\mu_p+\\mu_g\\)（式 21）。p、π、ω 全部冻结，梯度只穿过它们回到 \\(\\mu_g\\)。损失里 \\(w_z\\|\\mu_g\\|^2\\) 把策略拉向先验，论文说这一项对训练稳定很关键。</p><p>切换 w_z 看取舍：大了守着先验做不动，小了可以走出先验覆盖的地方。灰线是只从先验采、不看目标的基线。</p>' +
        toyB('w_z 的数值不能和论文的 20 直接比，隐空间维度和损失尺度都不同。三种先验的 6 种子结果写在精读页的玩具节：差距主要来自 σ，不来自条件（玩具的结论，不是论文的）。') + src('式 21 至 25 · §4.2 · §5.5') },
    { n: 11, part: '§4.3 技能控制', title: '判别器和分类器定技能', sub: '无法从技能标签直接查 z，只好对抗', dur: 15, cam: [0, 0.96, 28, [0, 2.2, 0]],
      html: dl([['真样本', '后验跟踪参考片段得到的 \\(\\tau^c\\)'], ['假样本', '任务策略生成的 \\(\\tau^g\\)'], ['D', '最小二乘 GAN，梯度惩罚 \\(w_g=20\\)；2×256，lr 1e-4'], ['C', '分类技能；2×256，lr 0.01'], ['权重', '\\((w_D,w_C,w_r)=(5,0.5,10)\\)'], ['技能数', '5：走、跑、单脚跳、跳、小跳步']]) +
        '<p>\\(\\mathcal L_{reg}\\) 把“跟踪结果”当成完美策略的输出，让任务策略克隆它。论文说这一项对训练稳定很关键。全部经 ω 反传，这和 AMP 把判别器当奖励不同。</p>' +
        guess('这一幕只是结构图，没有现算。官方代码没有判别器和分类器，这里的连线来自算法 2。') + src('式 27 至 32 · 算法 2') },
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
    $('infoTag').textContent = `第 ${s.n} 幕 · ${s.part}`;
    $('infoTitle').textContent = s.title;
    $('infoBody').innerHTML = s.html;
    $('stepNo').textContent = `${s.n} / ${SCENES.length}`;
    stepsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(+b.dataset.i === i)));
    btns.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
    if (window.MathJax?.typesetPromise) MathJax.typesetPromise([$('infoBody')]).catch(() => {});
  }
  let lastCap = null, lastLive = null;
  const cap = h => { if (h !== lastCap) { lastCap = h; $('cap').innerHTML = h; } };
  const live = rows => { const el = $('live'); if (!el) return; const h = dl(rows); if (h !== lastLive) { lastLive = h; el.innerHTML = '<p class="lt">现算（玩具）</p>' + h; } };

  /* ---------- small chart in the panel: one log or linear y axis, 2px lines, legend, hover read-out ---------- */
  const PAL = () => matchMedia('(prefers-color-scheme: light)').matches ? ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'] : ['#3987e5', '#d95926', '#199e70', '#c98500'];
  let chartState = null;
  function drawChart(hx) {
    const c = chartState, cv = $('mini'); if (!c || !cv) return;
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const W = cv.clientWidth || 260, H = 150, dpr = Math.min(2, devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
    const m = { l: 38, r: 8, t: 8, b: 26 }, pw = W - m.l - m.r, ph = H - m.t - m.b, n = c.series[0].data.length;
    const all = c.series.flatMap(s => s.data).filter(v => v != null && isFinite(v) && (!c.log || v > 0));
    let y0 = Math.min(...all), y1 = Math.max(...all); const tf = v => c.log ? Math.log10(v) : v;
    if (c.log) { y0 = Math.pow(10, Math.floor(Math.log10(y0))); y1 = Math.pow(10, Math.ceil(Math.log10(y1))); } else { y0 = 0; y1 *= 1.1; }
    const X = i => m.l + pw * i / Math.max(1, n - 1), Y = v => m.t + ph * (1 - (tf(v) - tf(y0)) / (tf(y1) - tf(y0)));
    g.font = '11px ' + (css('--font-mono') || 'monospace'); g.fillStyle = css('--muted'); g.strokeStyle = css('--line'); g.lineWidth = 1; g.textBaseline = 'middle'; g.textAlign = 'right';
    const ticks = []; if (c.log) for (let e = Math.log10(y0); e <= Math.log10(y1) + 1e-6; e++) ticks.push(Math.pow(10, e)); else for (let k = 0; k <= 3; k++) ticks.push(y1 * k / 3);
    ticks.forEach(t => { const y = Y(t); g.globalAlpha = 0.6; g.beginPath(); g.moveTo(m.l, y); g.lineTo(W - m.r, y); g.stroke(); g.globalAlpha = 1; g.fillText(c.log ? String(+t.toPrecision(1)) : t.toFixed(t < 1 ? 2 : 1), m.l - 4, y); });
    g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(c.xlabel, m.l + pw / 2, H - 13);
    const col = PAL();
    c.series.forEach((s, k) => { g.strokeStyle = col[k]; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath(); let on = false; s.data.forEach((v, i) => { if (v == null || !isFinite(v) || (c.log && v <= 0)) return; on ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)); on = true; }); g.stroke(); });
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
  let LABS = [], refDist = 33, PICKS = [], dragFn = null, dragPlane = null, api = null;
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.0125) * refDist / 22, size: LSZ(o.size || 26, o.scale || 0.0125), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.17) {
    const balls = []; for (let i = 0; i < n; i++) { const b = L.sphere(1, color, { emissive: color, seg: 10 }); b.material.emissiveIntensity = 0.55; G.add(b); balls.push(b); }
    return (pts, ph, on) => balls.forEach((b, i) => { b.visible = on > 0; if (on) { b.position.set(...along(pts, (ph + i / n) % 1)); b.scale.setScalar(r * on); } });
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.55, dashed: o.dashed }); G.add(l); return l; };
  /* polyline whose vertices can be replaced */
  function poly(G, n, color, op = 1, y = 0.05) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })); l.frustumCulled = false; G.add(l);
    l.userData.set = pts => { const A = g.attributes.position.array, m = Math.min(n, pts.length); for (let i = 0; i < m; i++) { A[3 * i] = pts[i][0]; A[3 * i + 1] = pts[i][1] ?? y; A[3 * i + 2] = pts[i][2]; } g.setDrawRange(0, m); g.attributes.position.needsUpdate = true; };
    return l;
  }
  function segs(G, n, color, op = 0.5) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })); l.frustumCulled = false; G.add(l);
    l.userData.set = pairs => { const A = g.attributes.position.array, m = Math.min(n, pairs.length); for (let i = 0; i < m; i++) A.set([...pairs[i][0], ...pairs[i][1]], i * 6); g.setDrawRange(0, m * 2); g.attributes.position.needsUpdate = true; };
    return l;
  }
  function dots(G, n, size, color) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const c0 = hex3(color ?? 0xffffff), Ca = g.attributes.color.array; for (let i = 0; i < n; i++) Ca.set(c0, 3 * i);
    const m = new THREE.Points(g, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false })); m.frustumCulled = false; G.add(m);
    m.userData.set = (pts, cols) => { const A = g.attributes.position.array, q = Math.min(n, pts.length); for (let i = 0; i < q; i++) { A.set(pts[i], 3 * i); if (cols) Ca.set(hex3(cols[i]), 3 * i); } g.setDrawRange(0, q); g.attributes.position.needsUpdate = true; if (cols) g.attributes.color.needsUpdate = true; };
    return m;
  }

  /* ---------- left panel: latent plane ---------- */
  const HALF = 5, ZR = 3, LX = -6.3, RX = 6.3;
  const zw = (z, y = 0.06) => [LX + z[0] / ZR * HALF, y, -z[1] / ZR * HALF];
  const wz_ = pt => [(pt.x - LX) / HALF * ZR, -pt.z / HALF * ZR];
  function latent(G, title = '隐空间（玩具 2 维）') {
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF, 2 * HALF), new THREE.MeshBasicMaterial({ color: 0x223044, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    hit.rotation.x = -Math.PI / 2; hit.position.set(LX, 0, 0); G.add(hit); dragPlane = hit;
    const gr = L.grid(2 * HALF, 6); gr.position.set(LX, 0.01, 0); G.add(gr);
    G.add(lab(title, [LX, 0.1, HALF + 1.1], { size: 24 }), lab('z₁', [LX + HALF + 0.5, 0.1, 0], { size: 20 }), lab('z₂', [LX, 0.1, -HALF - 0.55], { size: 20 }));
    function field(color, cap = 3.6) {
      const geo = new THREE.PlaneGeometry(2 * HALF, 2 * HALF, 40, 40); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { col: { value: new THREE.Color(color) } },
        vertexShader: 'varying float h; varying vec3 n; void main(){ h = position.y; n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 col; varying float h; varying vec3 n; void main(){ float l = 0.62 + 0.38 * abs(n.y + n.z * 0.4); gl_FragColor = vec4(col * l, 0.82 * smoothstep(0.015, 0.16, h)); }' })); m.position.set(LX, 0.02, 0); G.add(m);
      const P = geo.attributes.position;
      m.userData.fn = fn => { for (let i = 0; i < P.count; i++) P.setY(i, Math.min(cap, fn([P.getX(i) / HALF * ZR, -P.getZ(i) / HALF * ZR]))); P.needsUpdate = true; geo.computeVertexNormals(); };
      m.userData.gauss = (mu, sig) => m.userData.fn(z => { const r2 = (z[0] - mu[0]) ** 2 + (z[1] - mu[1]) ** 2; return 1.9 * Math.exp(-r2 / (2 * sig * sig)) / (2 * Math.PI * sig * sig); });
      return m;
    }
    return { field };
  }
  const gH = (z, mu, sig) => 1.9 * Math.exp(-((z[0] - mu[0]) ** 2 + (z[1] - mu[1]) ** 2) / (2 * sig * sig)) / (2 * Math.PI * sig * sig);
  /* right panel: state plane (u, w) */
  const spw = (s, y = 0.06) => [RX + (s[0] - 1.2) / 2.5 * HALF, y, -s[1] / 2 * HALF];
  function statePlane(G) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF, 2 * HALF), new THREE.MeshBasicMaterial({ color: 0x223044, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })); pl.rotation.x = -Math.PI / 2; pl.position.set(RX, 0, 0); G.add(pl);
    const gr = L.grid(2 * HALF, 6); gr.position.set(RX, 0.01, 0); G.add(gr);
    G.add(lab('状态平面（玩具）', [RX, 0.1, HALF + 1.1], { size: 24 }), lab('速度 u', [RX + HALF + 0.5, 0.1, 0.9], { size: 20 }), lab('转向 w', [RX, 0.1, -HALF - 0.55], { size: 20 }));
    const D = M(U.v).D, d = dots(G, 450, 0.26, COL.data); d.material.opacity = 0.4; d.userData.set(Array.from({ length: 450 }, (_, i) => spw(D.S[i * 2])));
  }
  /* right panel: ground; world = toy position scaled to fit */
  function groundMap(all) {
    let a = 1e9, b = -1e9, c = 1e9, e = -1e9; for (const P of all) { a = Math.min(a, P[0]); b = Math.max(b, P[0]); c = Math.min(c, P[1]); e = Math.max(e, P[1]); }
    const k = (2 * HALF - 1.2) / Math.max(1.5, b - a, e - c), mx = (a + b) / 2, my = (c + e) / 2;
    return { k, w: (P, y = 0.06) => [RX + (P[0] - mx) * k, y, -(P[1] - my) * k] };
  }
  function ground(G) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF, 2 * HALF), new THREE.MeshBasicMaterial({ color: 0x223044, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })); pl.rotation.x = -Math.PI / 2; pl.position.set(RX, 0, 0); G.add(pl);
    const gr = L.grid(2 * HALF, 10); gr.position.set(RX, 0.01, 0); G.add(gr);
    G.add(lab('地面俯视（玩具仿真器，小车）', [RX, 0.1, HALF + 1.1], { size: 24 }));
  }
  function agent(G, color) {
    const g = new THREE.Group(), b = L.cyl(0.26, 0.26, 0.5, color, { seg: 16 }); b.position.y = 0.25; g.add(b);
    const c = L.cyl(0, 0.2, 0.55, 0xffffff, { seg: 12 }); c.rotation.z = -Math.PI / 2; c.position.set(0.45, 0.28, 0); g.add(c); G.add(g);
    g.userData.at = (w, th) => { g.position.set(w[0], 0, w[2]); g.rotation.y = th; };
    return g;
  }
  function marker(G, color, r = 0.2) { const m = L.sphere(r, color, { emissive: color, seg: 14 }); m.material.emissiveIntensity = 0.5; G.add(m); return m; }
  const skillCtl = { label: '状态 s', items: Toy.SKILLS.map(s => s[0]), get: () => U.sk, set: i => { U.sk = i; U.z = null; } };
  const varCtl = { label: '先验', items: ['条件', 'N(0,I)', 'N(0,0.3²I)'], get: () => U.v, set: i => { U.v = i; U.z = null; } };
  const sOf = k => [Toy.SKILLS[k][1], Toy.SKILLS[k][2]];
  const logN = (z, mu, sig) => -((z[0] - mu[0]) ** 2 + (z[1] - mu[1]) ** 2) / (2 * sig * sig) - Math.log(2 * Math.PI * sig * sig);

  /* ---------- scenes ---------- */
  function diagramArrow(G, a, b, color) { return wire(G, [a, b], color, { opacity: 0.6 }); }
  function s1(G) {
    const go = (m, i) => { m.userData.go = i; PICKS.push(m); return m; };
    const D = go(block(3, 1.5, 2, COL.data, [-9, 5.2, -3]), 3), Sim = go(block(3, 1.5, 2, COL.sim, [-2, 5.2, -3]), 3), B = go(block(3, 1.5, 2, COL.buf, [6, 5.2, -3]), 4);
    const Q = go(block(2.6, 1.4, 1.8, COL.post, [-9.5, 2, 2]), 2), P = go(block(2.6, 1.4, 1.8, COL.prior, [-9.5, -0.3, 2]), 1), Pi = go(block(3, 1.8, 2, COL.pi, [-3, 1, 2]), 1), W = go(block(3.4, 2, 2.2, COL.wm, [4.5, 1, 2]), 4);
    const Sn = block(1.4, 1, 1.4, COL.white, [10.5, 1, 2]);
    G.add(D, Sim, B, Q, P, Pi, W, Sn);
    [[D, '数据集 D', 1.1], [Sim, '仿真器（黑箱）', 1.1], [B, '缓存 B', 1.1], [Q, '后验 q', 1.05], [P, '先验 p', -1.05], [Pi, '策略 π', 1.25], [W, '世界模型 ω', 1.4], [Sn, 's(t+1)', 0.85]].forEach(([m, t, dy]) => G.add(lab(t, [m.position.x, m.position.y + dy, m.position.z], { size: 24 })));
    const pa = m => m.position.toArray();
    const wires = [[D, Sim], [Sim, B], [D, Q], [Q, Pi], [P, Pi], [Pi, W], [W, Sn], [B, W]]; wires.forEach(([a, b]) => diagramArrow(G, pa(a), pa(b), 0x8ea2c4));
    const sReturn = [[10.5, 1, 2], [10.5, -2.3, 2], [-9.5, -2.3, 2], pa(P)]; wire(G, sReturn, 0x8ea2c4, { opacity: 0.45 });
    const a = stream(G, 6, COL.wm), b = stream(G, 6, COL.buf), c = stream(G, 6, COL.grad), d = stream(G, 6, COL.post);
    return { update(p) {
      const ph = p < 1 / 3 ? 0 : p < 2 / 3 ? 1 : 2, q = (p * 18) % 1;
      [D, Sim, B, Q, P, Pi, W].forEach(m => glow(m, 0));
      if (ph === 0) { glow(D, .7); glow(Sim, .8); glow(Q, .5); glow(Pi, .6); glow(B, .5); a([pa(D), pa(Sim), pa(B)], q, 1); b([], 0, 0); c([], 0, 0); d([pa(D), pa(Q), pa(Pi)], q, 1); cap('<b>① 收集：</b>策略在真仿真器里跟踪数据集片段，转移写入缓存 B'); }
      if (ph === 1) { glow(B, .7); glow(W, 1); a([], 0, 0); b([pa(B), pa(W)], q, 1); c([pa(Sn), pa(W)], 1 - q, 1); d([], 0, 0); cap('<b>② 世界模型：</b>从 B 取窗口，开环滚 8 帧。每轮更新 8 次，只改 ω'); }
      if (ph === 2) { glow(Q, 1); glow(P, 1); glow(Pi, 1); glow(W, .25); a([pa(Pi), pa(W), pa(Sn)], q, 1); b([], 0, 0); c([pa(Sn), pa(W), pa(Pi), pa(Q)], 1 - q, 1); d([pa(Pi), pa(P)], 1 - q, 1); cap('<b>③ VAE：</b>ω 的参数不动但雅可比传梯度，回到 π、q、p。滚 24 帧，每轮更新 8 次'); }
    } };
  }

  function s2(G) {
    const pn = latent(G), F = pn.field(COL.prior), Z = marker(G, COL.white, 0.22), Cn = marker(G, COL.prior, 0.16); statePlane(G);
    const N = 90, Zd = dots(G, N, 0.3, COL.task), Nd = dots(G, N, 0.3, COL.task), Cur = marker(G, COL.white, 0.2), Nx = marker(G, COL.white, 0.14);
    const r = Toy.RNG(44), eps = Array.from({ length: N }, () => [r.n(), r.n()]);
    let lastKey = '';
    dragFn = z => { U.z = z; };
    return { ctl: [varCtl, { label: '状态', items: ['沿数据走', ...Toy.SKILLS.map(s => s[0])], get: () => U.autoS ? 0 : U.sk + 1, set: i => { U.autoS = i === 0; if (i) U.sk = i - 1; U.z = null; } }],
      update(p) {
        const R = M(U.v), A = R.A, s = U.autoS ? R.D.S[120 + Math.floor(p * 300)] : sOf(U.sk), mu = Toy.pm(A, s), sig = A.sig;
        const key = s.join() + U.v; if (key !== lastKey) { F.userData.gauss(mu, sig); lastKey = key; }
        Cn.position.set(...zw(mu, 0.1)); Cur.position.set(...spw(s, 0.25));
        const pts = eps.map(e => [mu[0] + sig * e[0], mu[1] + sig * e[1]]), nexts = pts.map(z => Toy.sim(s, Toy.act(A, s, z)));
        Zd.userData.set(pts.map(z => zw(z, 0.12))); Nd.userData.set(nexts.map(n => spw(n, 0.12)));
        const z = U.z || mu, a = Toy.act(A, s, z), n = Toy.sim(s, a), w = Toy.wm(A, s, a);
        Z.position.set(...zw(z, 0.3 + Math.min(3.6, gH(z, mu, sig)))); Nx.position.set(...spw(n, 0.3));
        const mn = nexts.reduce((q, x) => [q[0] + x[0] / N, q[1] + x[1] / N], [0, 0]);
        live([['s', vv(s)], ['μp(s)', vv(mu)], ['σ', fx(sig)], ['z', vv(z)], ['log p(z|s)', fx(logN(z, mu, sig))], ['a = π(s,z)', vv(a)], ['sim 下一步', vv(n)], ['ω 预测', vv(w)], ['90 样本下一步均值', vv(mn)]]);
        cap(U.z ? '你放的 z：白球。右边白点是它经 π 和真仿真器到的下一状态' : VAR[U.v][1] ? '这个先验不随状态变：曲面不动，z 的含义全交给 π' : '<b>曲面的中心随状态移动。</b>点左边平面可以放一个 z');
      } };
  }

  function s3(G) {
    const pn = latent(G), Fp = pn.field(COL.prior), Fq = pn.field(COL.post), Fl = pn.field(COL.task); statePlane(G);
    const Cp = marker(G, COL.prior, 0.16), Cq = marker(G, COL.post, 0.22), Sc = marker(G, COL.white, 0.2), St = marker(G, COL.post, 0.22), Sh = marker(G, COL.pi, 0.17);
    const arrowL = poly(G, 2, COL.white), stL = poly(G, 3, COL.white, 0.7);
    dragFn = z => { U.z = z; };
    let k0 = '', k1 = '';
    const mc = (mu, sig, mp, n = 4000) => { const r = Toy.RNG(99); let t = 0; for (let i = 0; i < n; i++) { const z = [mu[0] + sig * r.n(), mu[1] + sig * r.n()]; t += logN(z, mu, sig) - logN(z, mp, sig); } return t / n; };
    return { ctl: [varCtl, skillCtl, { label: '目标 s̃', items: Toy.SKILLS.map(s => s[0]), get: () => U.tgt, set: i => { U.tgt = i; U.z = null; } }, { label: '曲面', items: ['密度', '损失地形'], get: () => U.field, set: i => { U.field = i; } }],
      update(p) {
        const A = M(U.v).A, s = sOf(U.sk), sT = sOf(U.tgt), f = seg(p, 0.08, 0.6), tg = [L.lerp(s[0], sT[0], f), L.lerp(s[1], sT[1], f)];
        const mp = Toy.pm(A, s), mq0 = Toy.qm(A, s, tg), sig = A.sig, enc = [mp[0] + mq0[0], mp[1] + mq0[1]], mh = U.z || enc, mq = [mh[0] - mp[0], mh[1] - mp[1]];
        const kl = (mq[0] * mq[0] + mq[1] * mq[1]) / (2 * sig * sig), a = Toy.act(A, s, mh), n = Toy.wm(A, s, a), lr = Math.abs(tg[0] - n[0]) + Math.abs(tg[1] - n[1]);
        Fp.visible = Fq.visible = U.field === 0; Fl.visible = U.field === 1;
        const key = [mp, mh, sig, U.field].join();
        if (key !== k0) { k0 = key; if (U.field === 0) { Fp.userData.gauss(mp, sig); Fq.userData.gauss(mh, sig); } }
        const key1 = [s, tg, U.beta, U.v, U.field].join();
        if (U.field === 1 && key1 !== k1) { k1 = key1; Fl.userData.fn(z => { const q = Toy.wm(A, s, Toy.act(A, s, z)), rr = (z[0] - mp[0]) ** 2 + (z[1] - mp[1]) ** 2; return 3 * Math.exp(-(Math.abs(tg[0] - q[0]) + Math.abs(tg[1] - q[1]) + U.beta * rr / (2 * sig * sig))); }); }
        Cp.position.set(...zw(mp, 0.2)); Cq.position.set(...zw(mh, 0.3)); arrowL.userData.set([zw(mp, 0.2), zw(mh, 0.2)]);
        Sc.position.set(...spw(s, 0.25)); St.position.set(...spw(tg, 0.25)); Sh.position.set(...spw(n, 0.25)); stL.userData.set([spw(s, 0.1), spw(tg, 0.1), spw(n, 0.1)]);
        live([['μp(s)', vv(mp)], ['μq(s,s̃) 编码器', vv(mq0)], ['后验均值 μ̂q', vv(mh) + (U.z ? '（手动）' : '')], ['KL 式 9', fx(kl, 3)], ['KL 蒙特卡洛', fx(mc(mh, sig, mp), 3)], ['∂KL/∂μq', vv([mq[0] / (sig * sig), mq[1] / (sig * sig)])], ['∂KL/∂μp', '(0, 0)'], ['目标 s̃', vv(tg)], ['ω 预测 ŝ', vv(n)], ['|s̃−ŝ|₁', fx(lr, 3)], ['L_rec+βKL (β=' + U.beta + ')', fx(lr + U.beta * kl, 3)]]);
        cap(U.field ? '高度 = exp(−损失)。橙球是后验均值。' : U.z ? '手动放的后验：离蓝峰越远 KL 越大，代价按平方长' : '<b>蓝 = 先验，橙 = 后验。</b>目标变了，后验就从先验挪开一个残差。点平面可手动放');
      } };
  }

  function s4(G) {
    const pn = latent(G), F = pn.field(COL.prior); ground(G);
    const Tr = 64, pD = poly(G, Tr + 1, COL.post), pP = dots(G, Tr + 1, 0.34, COL.post), pR = poly(G, Tr + 1, COL.data, 0.7), Ag = agent(G, COL.pi), Zd = dots(G, 40, 0.34, COL.post), Bar = block(0.7, 1, 0.7, COL.buf, [RX + HALF + 1.2, 0.5, -3]);
    G.add(Bar, lab('缓存', [RX + HALF + 1.2, 0.1, -1.8], { size: 20 }));
    let run = null, key = '';
    function rec() {
      const k = U.pPrior + '|' + U.v; if (k === key) return; key = k;
      const R = M(U.v), A = R.A, D = R.D, r = Toy.RNG(404); let i = 233, s = D.S[i].slice(), P = [0, 0, 0], Pr = [0, 0, 0]; const o = [{ P, Pr, s, tg: D.S[i], mp: Toy.pm(A, s), z: null, pr: false, sw: false }];
      for (let t = 0; t < Tr; t++) {
        const tg = D.S[i + 1], mp = Toy.pm(A, s), pr = r.u() < U.pPrior, mq = pr ? [0, 0] : Toy.qm(A, s, tg), z = [mp[0] + mq[0] + A.sig * r.n(), mp[1] + mq[1] + A.sig * r.n()];
        const a0 = Toy.act(A, s, z), s2 = Toy.sim(s, [a0[0] + 0.05 * r.n(), a0[1] + 0.05 * r.n()]); P = Toy.pose(P, s2); Pr = Toy.pose(Pr, tg); s = s2; i++;
        const sw = (t + 1) % 24 === 0; if (sw) i = r.int(D.N - 40);
        o.push({ P, Pr, s, tg, mp, z, pr, sw });
      }
      run = { o, gm: groundMap(o.flatMap(x => [x.P, x.Pr])), err: o.slice(1).reduce((q, x) => q + Math.abs(x.s[0] - x.tg[0]) + Math.abs(x.s[1] - x.tg[1]), 0) / Tr, nP: o.filter(x => x.pr).length };
      pR.userData.set(o.map(x => run.gm.w(x.Pr)));
    }
    return { ctl: [varCtl, { label: 'P(从先验采)', items: ['0', '0.4（论文）', '1'], get: () => [0, 0.4, 1].indexOf(U.pPrior), set: i => { U.pPrior = [0, 0.4, 1][i]; } }],
      update(p) {
        rec(); const n = Math.floor(p * Tr), q = run.o[n], o = run.o.slice(0, n + 1);
        pD.userData.set(o.map(x => run.gm.w(x.P))); pP.userData.set(o.map(x => run.gm.w(x.P, 0.09)), o.map(x => x.pr ? COL.prior : COL.post)); Ag.userData.at(run.gm.w(q.P), q.P[2]);
        F.userData.gauss(q.mp, M(U.v).A.sig);
        const tail = run.o.slice(Math.max(1, n - 39), n + 1); Zd.userData.set(tail.map(x => zw(x.z, 0.1)), tail.map(x => x.pr ? COL.prior : COL.post));
        Bar.scale.y = Math.max(0.05, n / Tr * 3.5); Bar.position.y = Bar.scale.y / 2;
        live([['t', n + ' / ' + Tr], ['这一步的 z', n ? (q.pr ? '来自先验' : '来自后验') : '–'], ['实际先验步数', run.nP + ' / ' + Tr], ['s', vv(q.s)], ['参考 s̃', vv(q.tg)], ['这一步误差 L1', n ? fx(Math.abs(q.s[0] - q.tg[0]) + Math.abs(q.s[1] - q.tg[1])) : '–'], ['全程平均误差', fx(run.err)]]);
        cap((q.sw ? '<b>参考刚被换了一段</b>：角色得自己过渡。' : '') + '粉线 = 参考，点 = 实际路径。<b>蓝点</b>这步的 z 从先验采，<b>橙点</b>从后验采');
      } };
  }

  function s5(G) {
    const Tw = 8, blocks = [], bars = [], X = i => -11.4 + i * 1.5;
    for (let i = 0; i < Tw; i++) { const b = block(1.15, 1.1, 1.15, COL.wm, [X(i), 0.6, 2.8]); G.add(b); blocks.push(b); const bar = block(0.7, 1, 0.7, COL.grad, [X(i), 1.6, 1]); G.add(bar); bars.push(bar); }
    G.add(lab('ω × 8（同一个网络）', [X(3.5), 0.1, 4.8], { size: 24 }), lab('红柱 = 这一帧的预测误差 L1', [X(3.5), 4.8, 1], { size: 22 }));
    statePlane(G);
    const rec = poly(G, 25, COL.white, 1), pred = poly(G, 25, COL.grad, 1), Pd = dots(G, 25, 0.34, COL.grad), Rd = dots(G, 25, 0.3, 0x667799), pulse = stream(G, 3, COL.wm, 0.2);
    let win = null;
    function pickWin() { const R = M(0), r = Toy.RNG(8); for (let k = 0; k < 200; k++) { const tr = R.buf[r.int(R.buf.length)]; if (tr.a.length >= 26) { const o = r.int(tr.a.length - 25); return { tr, o }; } } return null; }
    win = pickWin();
    return { ctl: [{ label: '世界模型的训练窗口', items: ['Tw = 8（论文）', 'Tw = 1'], get: () => U.Tw === 8 ? 0 : 1, set: i => { U.Tw = i ? 1 : 8; } }],
      onShow() { const c = tw(); chart({ log: false, xlabel: '开环步数 →', xname: '步', x: i => i + 1, series: [{ name: 'Tw=8', data: c[8].err }, { name: 'Tw=1', data: c[1].err }] }); },
      update(p) {
        const c = tw(), B = c[U.Tw].W, A = M(0).A; const H = 24, n = Math.floor(p * H);
        if (!win) return;
        let s = win.tr.s[win.o]; const pr = [s], rc = [s], errs = [];
        for (let t = 0; t < H; t++) { s = Toy.wm(B, s, win.tr.a[win.o + t]); const g = win.tr.s[win.o + t + 1]; pr.push(s); rc.push(g); errs.push(Math.abs(s[0] - g[0]) + Math.abs(s[1] - g[1])); }
        rec.userData.set(rc.map(q => spw(q, 0.12))); Rd.userData.set(rc.map(q => spw(q, 0.14))); pred.userData.set(pr.slice(0, n + 1).map(q => spw(q, 0.18))); Pd.userData.set(pr.slice(0, n + 1).map(q => spw(q, 0.2)));
        const m8 = Math.min(Tw, n); blocks.forEach((b, i) => glow(b, i === m8 - 1 ? 1 : i < m8 ? 0.35 : 0));
        bars.forEach((b, i) => { const e = i < m8 ? errs[i] : 0; b.visible = i < m8; b.scale.y = Math.max(0.02, e * 40); b.position.y = 1.3 + b.scale.y / 2; });
        pulse(p < 0.33 ? [[X(0), 1.3, 2.8], [X(7), 1.3, 2.8]] : [], p * 8 % 1, p < 0.33 ? 1 : 0);
        chartMark(Math.max(0, n - 1));
        live([['步', n + ' / ' + H], ['这个窗口的误差', n ? fx(errs[n - 1], 3) : '–'], ['前 8 步均误差（L1）', fx(errs.slice(0, 8).reduce((x, y) => x + y) / 8, 3)], ['24 步均误差', fx(errs.reduce((x, y) => x + y) / H, 3)]]);
        cap(`白 = 缓存里记录的状态，红 = ω (Tw=${U.Tw}) 重放同一串动作、吃自己的预测走出来的。`);
      } };
  }

  function s6(G) {
    const T = 8, X = i => -11.2 + i * 3.2, cols = [];
    for (let i = 0; i < T; i++) {
      const q = block(1.5, 0.75, 1.1, COL.post, [X(i), 3.5, 0]), pi = block(1.5, 0.75, 1.1, COL.pi, [X(i), 2.2, 0]), w = block(1.9, 0.9, 1.3, COL.wm, [X(i), 0.8, 0]);
      const bar = block(0.42, 1, 0.42, COL.grad, [X(i) + 0.3, 4.5, 0]), rb = block(0.42, 1, 0.42, COL.prior, [X(i) - 0.3, 4.5, 0]);
      G.add(q, pi, w, bar, rb); cols.push({ q, pi, w, bar, rb });
      if (i < T - 1) wire(G, [[X(i) + 0.95, 0.8, 0], [X(i + 1) - 1.6, 0.8, 0], [X(i + 1) - 1.6, 3.5, 0], [X(i + 1) - 0.75, 3.5, 0]], 0x8ea2c4, { opacity: 0.4 });
      wire(G, [[X(i), 3.1, 0], [X(i), 2.6, 0]], 0x8ea2c4, { opacity: 0.6 }); wire(G, [[X(i), 1.8, 0], [X(i), 1.3, 0]], 0x8ea2c4, { opacity: 0.6 });
    }
    G.add(lab('后验 q', [X(0) - 1.4, 3.5, 1.2], { size: 21 }), lab('策略 π', [X(0) - 1.4, 2.2, 1.2], { size: 21 }), lab('世界模型 ω（参数不动）', [X(1), -0.15, 1.2], { size: 21 }));
    const fwd = stream(G, 1, COL.wm, 0.3), back = stream(G, 1, COL.grad, 0.3); let run = null, key = '';
    function rec() {
      const k = [U.beta, U.gam, U.v].join(); if (k === key) return; key = k;
      const R = M(U.v), r = Toy.RNG(66); let w = null; for (let i = 0; i < 80 && !w; i++) { const tr = R.buf[r.int(R.buf.length)]; if (tr.a.length >= T + 4) { const o = r.int(tr.a.length - T); const e = tr.tgt.slice(o, o + T); if (Math.abs(e[0][1]) > 0.2 || i > 70) w = { tr, o, e }; } }
      const eps = w.e.map(() => [r.n(), r.n(), r.n(), r.n()]); run = Toy.vaeRollout(R.A, w.tr.s[w.o], w.e, eps, U.beta, false, U.gam);
    }
    return { ctl: [varCtl, { label: 'β', items: ['0', '0.01', '0.1', '1'], get: () => [0, 0.01, 0.1, 1].indexOf(U.beta), set: i => { U.beta = [0, 0.01, 0.1, 1][i]; } }, { label: 'γ', items: ['0.95（论文）', '1'], get: () => U.gam === 1 ? 1 : 0, set: i => { U.gam = i ? 1 : 0.95; } }],
      update(p) {
        rec(); const t0 = run.tape, sc = 1.6 / Math.max(...run.gz), fw = p < 0.5, x = fw ? clamp(p / 0.48, 0, 1) * (T - 1) : (1 - clamp((p - 0.52) / 0.46, 0, 1)) * (T - 1), i = Math.round(x);
        cols.forEach((c, k) => {
          const done = fw ? k <= x : k >= x; glow(c.q, done ? 0.6 : 0); glow(c.pi, done ? 0.6 : 0); glow(c.w, done ? 0.35 : 0);
          const e = Math.abs(t0[k].e0) + Math.abs(t0[k].e1); c.rb.visible = fw ? k <= x : true; c.rb.scale.y = Math.max(0.03, e * 3); c.rb.position.y = 4.1 + c.rb.scale.y / 2;
          c.bar.visible = !fw && k >= x; c.bar.scale.y = Math.max(0.03, run.gz[k] * sc); c.bar.position.y = 4.1 + c.bar.scale.y / 2;
        });
        fwd([[X(0), 2.2, 0.9], [X(T - 1), 2.2, 0.9]], x / (T - 1), fw ? 1 : 0); back([[X(0), 1.5, 0.9], [X(T - 1), 1.5, 0.9]], x / (T - 1), fw ? 0 : 1);
        const q = t0[i], sg = M(U.v).A.sig, kk = q.g * U.beta / (sg * sg);
        live([['当前步', i], ['L_rec（γ 加权和）', fx(run.Lr, 3)], ['L_kl', fx(run.Lk, 3)], ['β·L_kl', fx(U.beta * run.Lk, 3)], ['L_act', fx(run.La, 4)], ['‖∂L/∂z_t‖（重建+动作）', fx(run.gz[i], 3)], ['KL 对 μq 的梯度', vv([kk * q.mq[0], kk * q.mq[1]])], ['KL 对 μp 的梯度', '(0, 0)'], ['这一步 γᵗ', fx(q.g, 3)]]);
        cap(fw ? '<b>前向：</b>蓝柱是这一帧的重建误差' : '<b>反向：</b>红柱是 ‖∂L/∂z_t‖，取最大值归一，真实地从 ω 的雅可比算出来');
      } };
  }

  const snapCache = {};
  function latentMap(v) {
    if (snapCache[v]) return snapCache[v];
    const R = M(v), D = R.D, r = Toy.RNG(1234), pairs = [];
    for (let i = 0; i < 260; i++) { const k = 20 + r.int(D.N - 40); if (D.lab[k] === D.lab[k - 6] && D.lab[k] === D.lab[k + 1]) pairs.push(k); }
    const out = R.snaps.map(sn => {
      const B = Toy.restore(R.A, sn.s), pts = pairs.map(k => { const s = D.S[k], m = Toy.pm(B, s), q = Toy.qm(B, s, D.S[k + 1]); return [m[0] + q[0], m[1] + q[1]]; });
      const cen = Toy.SKILLS.map((_, c) => { const g = pts.filter((_, j) => D.lab[pairs[j]] === c), n = Math.max(1, g.length); return [g.reduce((a, x) => a + x[0], 0) / n, g.reduce((a, x) => a + x[1], 0) / n]; });
      let wi = 0; pts.forEach((x, j) => { const c = cen[D.lab[pairs[j]]]; wi += Math.hypot(x[0] - c[0], x[1] - c[1]); }); wi /= pts.length;
      let bt = 0, nb = 0; for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) { bt += Math.hypot(cen[a][0] - cen[b][0], cen[a][1] - cen[b][1]); nb++; } bt /= nb;
      const arrows = Toy.SKILLS.map((_, c) => { const s = sOf(c), z = Toy.pm(B, s), a = Toy.act(B, s, z), n = Toy.sim(s, a); return [s, n]; });
      return { e: sn.e, pts, cen, sep: bt / Math.max(1e-6, wi), arrows };
    });
    return snapCache[v] = { pairs, out };
  }
  function s7(G) {
    latent(G, '后验均值的分布（对照原文图 8）'); statePlane(G); const Pt = dots(G, 260, 0.3, COL.white), Ar = segs(G, 5, COL.white, 1), Heads = Toy.SKILLS.map((_, c) => marker(G, SK[c], 0.16));
    const labs = Toy.SKILLS.map((s, c) => { const o = lab(s[0], [0, 0.1, 0], { size: 20 }); G.add(o); return o; });
    return { ctl: [varCtl], onShow() { const lg = M(U.v).log; chart({ log: true, xlabel: '训练轮 →', xname: '轮', series: [{ name: 'L_w', data: lg.map(l => l.Lw) }, { name: 'L_rec', data: lg.map(l => l.Lr) }, { name: 'L_kl', data: lg.map(l => l.Lk) }] }); },
      update(p) {
        const mp = latentMap(U.v), Sn = mp.out, f = Math.round(p * (Sn.length - 1)), q = Sn[f], D = M(U.v).D, lg = M(U.v).log[q.e];
        const mx = Math.max(1e-3, ...q.pts.map(z => Math.max(Math.abs(z[0]), Math.abs(z[1])))), zm = ZR * 0.92 / mx, zz = z => [z[0] * zm, z[1] * zm];
        Pt.userData.set(q.pts.map(z => zw(zz(z), 0.12)), mp.pairs.map(k => SK[D.lab[k]]));
        const gc = q.cen.reduce((a, c) => [a[0] + c[0] / 5, a[1] + c[1] / 5], [0, 0]);
        q.cen.forEach((c, i) => { const w = zz(c), dx = c[0] - gc[0], dy = c[1] - gc[1], d = Math.hypot(dx, dy) || 1, r = 0.9; labs[i].position.set(...zw([clamp(w[0] + dx / d * r, -ZR, ZR), clamp(w[1] + dy / d * r, -ZR, ZR)], 0.6)); });
        Ar.userData.set(q.arrows.map(([s, n]) => [spw(s, 0.2), spw(n, 0.2)])); Heads.forEach((h, i) => h.position.set(...spw(q.arrows[i][1], 0.2)));
        chartMark(q.e);
        live([['先验', VAR[U.v][0]], ['显示缩放（自动）', '×' + fx(zm, 1)], ['训练轮', q.e + ' / ' + (M(U.v).log.length - 1)], ['分离度（类间/类内）', fx(q.sep)], ['L_w', fx(lg.Lw, 3)], ['L_rec', fx(lg.Lr, 3)], ['L_kl', fx(lg.Lk, 3)], ['β', fx(lg.beta, 3)], ['回报 exp(−误差)', fx(lg.rew, 3)]]);
        cap(`第 ${q.e} 轮。左边每个点是一个转移的后验均值，颜色和字是技能。右边：不加噪声走一步，箭头短 = 保持当前技能`);
      } };
  }

  function s8(G) {
    const pn = latent(G), F = pn.field(COL.prior), Z = marker(G, COL.white, 0.22); ground(G);
    const Nr = 12, Tt = 40, Ps = Array.from({ length: Nr }, (_, i) => poly(G, Tt + 1, [0x3987e5, 0xd95926, 0x199e70, 0xc98500][i % 4], 0.85)), Zd = dots(G, Nr * 2, 0.34, COL.task), W = poly(G, Tt + 1, COL.white, 1), Ag = agent(G, COL.white);
    let run = null, key = '';
    dragFn = z => { U.z = z; };
    function rec() {
      const k = [U.v, U.sk, U.seed, U.z].join(); if (k === key) return; key = k;
      const A = M(U.v).A, s0 = sOf(U.sk), r = Toy.RNG(1000 + U.seed), rolls = [];
      for (let j = 0; j < Nr; j++) { let s = s0, P = [0, 0, 0]; const pth = [P]; let u = 0; const z0 = []; for (let t = 0; t < Tt; t++) { const m = Toy.pm(A, s), z = [m[0] + A.sig * r.n(), m[1] + A.sig * r.n()]; if (!t) z0.push(z); s = Toy.sim(s, Toy.act(A, s, z)); P = Toy.pose(P, s); pth.push(P); u += s[0] / Tt; } rolls.push({ pth, z0: z0[0], u }); }
      const m0 = Toy.pm(A, s0), z = U.z || m0, off = [z[0] - m0[0], z[1] - m0[1]]; let s = s0, P = [0, 0, 0]; const wp = [P]; for (let t = 0; t < Tt; t++) { const m = Toy.pm(A, s); s = Toy.sim(s, Toy.act(A, s, [m[0] + off[0], m[1] + off[1]])); P = Toy.pose(P, s); wp.push(P); }
      const gm = groundMap(rolls.flatMap(x => x.pth).concat(wp)); const us = rolls.map(x => x.u), mean = us.reduce((a, b) => a + b) / Nr;
      const ends = rolls.map(x => x.pth[Tt]); const spread = Math.sqrt(ends.reduce((a, e) => a + (e[0] - ends.reduce((q, y) => q + y[0], 0) / Nr) ** 2 + (e[1] - ends.reduce((q, y) => q + y[1], 0) / Nr) ** 2, 0) / Nr);
      run = { rolls, wp, gm, mean, spread, m0, z, sEnd: s }; F.userData.gauss(m0, A.sig); Zd.userData.set(rolls.map(x => zw(x.z0, 0.14)));
    }
    return { ctl: [varCtl, skillCtl, { label: '', items: ['重抽一批'], get: () => -1, set: () => { U.seed++; } }, { label: '', items: ['清除 z'], get: () => -1, set: () => { U.z = null; } }],
      update(p) {
        rec(); const n = Math.floor(p * Tt), A = M(U.v).A, s0 = sOf(U.sk);
        run.rolls.forEach((x, j) => Ps[j].userData.set(x.pth.slice(0, n + 1).map(q => run.gm.w(q, 0.06 + j * 0.002))));
        W.userData.set(run.wp.slice(0, n + 1).map(q => run.gm.w(q, 0.1))); const Q = run.wp[n]; Ag.userData.at(run.gm.w(Q), Q[2]); Ag.visible = !!U.z; W.visible = !!U.z;
        Z.position.set(...zw(run.z, 0.3 + Math.min(3.6, gH(run.z, run.m0, A.sig))));
        const a = Toy.act(A, s0, run.z), n1 = Toy.sim(s0, a), off = [run.z[0] - run.m0[0], run.z[1] - run.m0[1]], kl = (off[0] ** 2 + off[1] ** 2) / (2 * A.sig * A.sig);
        live([['起点 s', vv(s0)], ['μp(s)', vv(run.m0)], ['z', vv(run.z)], ['log p(z|s)', fx(logN(run.z, run.m0, A.sig))], ['以 z 为后验均值的 KL', fx(kl, 3)], ['π(s,z)', vv(a)], ['sim 下一步', vv(n1)], ['12 条平均速度', fx(run.mean)], ['终点散布（RMS）', fx(run.spread)]]);
        cap('12 条路径都在玩具仿真器里走，每一步从先验重新采 z。点左边平面可放一个 z，白线是它的结果');
      } };
  }

  function s9(G) {
    const pn = latent(G), F = pn.field(COL.prior), Zd = dots(G, 128, 0.26, COL.task), Zb = marker(G, COL.white, 0.2); ground(G);
    const Tt = 56, fan = segs(G, 128 * 4, COL.task, 0.28), best = poly(G, 5, COL.white, 1), path = poly(G, Tt + 1, COL.pi, 1), Ag = agent(G, COL.pi), Tg = poly(G, 2, COL.grad, 1); const Tgh = marker(G, COL.grad, 0.2); G.add(lab('以小车为中心，放大 1.7 倍', [RX, 0.1, -HALF - 0.55], { size: 20 }));
    let run = null, key = '', ths = [1, -1.5];
    function rec() {
      const k = [U.v, U.N, U.th].join(); if (k === key) return; key = k; ths = [U.th, U.th - 2.2];
      const A = M(U.v).A, r = Toy.RNG(55); let s = [0, 0], P = [0, 0, 0], eH = 0, eV = 0; const vs = 1.5, o = [];
      for (let t = 0; t < Tt; t++) {
        const th = t < Tt / 2 ? ths[0] : ths[1], d = Toy.wrap(th - P[2]), M2 = Toy.mpcPlan(A, s, d, vs, r, U.N, 4), mp = Toy.pm(A, s);
        o.push({ P, s, th, fan: M2.fan, z: M2.z, mp, bestL: M2.best });
        s = Toy.sim(s, Toy.act(A, s, M2.z)); P = Toy.pose(P, s); eH += Math.abs(Toy.wrap(th - P[2])) / Tt; eV += Math.abs(vs - s[0]) / Tt;
      }
      o.push({ P, s, th: ths[1], fan: o[o.length - 1].fan, z: o[o.length - 1].z, mp: Toy.pm(A, s), bestL: 0 });
      run = { o, eH, eV, Ncost: U.N * 4 * Tt };
    }
    return { ctl: [varCtl, { label: 'N', items: ['8', '32', '128（论文）'], get: () => [8, 32, 128].indexOf(U.N), set: i => { U.N = [8, 32, 128][i]; } }, { label: '目标方向', items: ['+1 rad', '−1 rad', '+2.5 rad'], get: () => [1, -1, 2.5].indexOf(U.th), set: i => { U.th = [1, -1, 2.5][i]; } }],
      update(p) {
        rec(); const n = Math.min(Tt, Math.floor(p * Tt)), q = run.o[n], A = M(U.v).A, K = 1.7, gm = { w: (P, y = 0.06) => [RX + (P[0] - q.P[0]) * K, y, -(P[1] - q.P[1]) * K] }, c = Math.cos(q.P[2]), sn = Math.sin(q.P[2]);
        const rel = R => [q.P[0] + R[0] * c - R[1] * sn, q.P[1] + R[0] * sn + R[1] * c];
        const pairs = []; let bi = null, bL = 1e9; for (const f of q.fan) { if (f.L < bL) { bL = f.L; bi = f; } for (let k = 0; k < 4; k++) pairs.push([gm.w(rel(f.P[k]), 0.08), gm.w(rel(f.P[k + 1]), 0.08)]); }
        fan.userData.set(pairs); best.userData.set(bi.P.map(R => gm.w(rel(R), 0.12))); { const tr = []; for (let i = n; i >= 0; i--) { const w = gm.w(run.o[i].P, 0.1); if (Math.abs(w[0] - RX) > HALF || Math.abs(w[2]) > HALF) break; tr.unshift(w); } path.userData.set(tr); } Ag.userData.at(gm.w(q.P), q.P[2]);
        const w0 = gm.w(q.P, 0.35), w1 = [w0[0] + 2 * Math.cos(q.th), 0.35, w0[2] - 2 * Math.sin(q.th)]; Tg.userData.set([w0, w1]); Tgh.position.set(...w1);
        F.userData.gauss(q.mp, A.sig); Zd.userData.set(q.fan.map(f => zw(f.z0, 0.14))); Zb.position.set(...zw(q.z, 0.4));
        live([['t', n + ' / ' + Tt], ['目标方向 / 速度', fx(q.th) + ' rad / 1.5'], ['最好一条的损失', fx(q.bestL)], ['全程 |航向误差| 均值', fx(run.eH)], ['全程 |速度误差| 均值', fx(run.eV)], ['ω 前向总次数', String(run.Ncost)], ['N×T（论文）', '128 × 4 = 512 / 控制步']]);
        cap(n < Tt / 2 ? `黄 = ${U.N} 条想象轨迹（在 ω 里），白 = 最好那条。红箭头是目标方向` : '<b>目标变了。</b>黄线还是 ω 里想象的，蓝线才是真仿真器走过的');
      } };
  }

  function s10(G) {
    const pn = latent(G), F = pn.field(COL.prior), Fg = marker(G, COL.task, 0.22), Fp = marker(G, COL.prior, 0.16), Ar = poly(G, 2, COL.task, 1); ground(G);
    const Tt = 60, base = poly(G, Tt + 1, COL.sim, 0.7), path = poly(G, Tt + 1, COL.task, 1), Ag = agent(G, COL.task), Tg = poly(G, 2, COL.grad, 1), Tgh = marker(G, COL.grad, 0.2);
    let run = null, key = '';
    function rec() {
      const k = [U.v, U.wz, U.th].join(); if (k === key) return; key = k;
      const A = M(U.v).A, Tk = task(U.v, U.wz), opt = { th: U.th, vs: 1.5, T: Tt, seed: 5, switchAt: 30, th2: U.th - 2.2, vs2: 0.6 };
      const a = Toy.runTask(A, Toy.policyCtrl(A, Tk.G), opt), b = Toy.runTask(A, Toy.priorCtrl(A), opt);
      const gm = groundMap(a.out.concat(b.out).map(x => x.P)); base.userData.set(b.out.map(x => gm.w(x.P, 0.05)));
      let ol = a.out[0].s, Pw = [0, 0, 0]; for (let t = 1; t <= 16; t++) { ol = Toy.wm(A, ol, a.out[t].a); Pw = Toy.pose(Pw, ol); } const dW = Math.hypot(Pw[0] - a.out[16].P[0], Pw[1] - a.out[16].P[1]);
      run = { a, b, gm, dW }; chart({ log: true, xlabel: '任务策略更新次数 →', xname: '次', series: [{ name: '任务损失', data: Tk.log.map(l => l.L) }, { name: '‖μg‖²', data: Tk.log.map(l => l.Lz) }] });
    }
    return { ctl: [varCtl, { label: 'w_z', items: ['0', '2', '20'], get: () => [0, 2, 20].indexOf(U.wz), set: i => { U.wz = [0, 2, 20][i]; } }, { label: '目标方向', items: ['+1 rad', '−1 rad', '+2.5 rad'], get: () => [1, -1, 2.5].indexOf(U.th), set: i => { U.th = [1, -1, 2.5][i]; } }],
      onShow() { key = ''; rec(); },
      update(p) {
        rec(); const n = Math.min(Tt, Math.floor(p * Tt)), q = run.a.out[n], A = M(U.v).A, gm = run.gm, o = run.a.out;
        path.userData.set(o.slice(0, n + 1).map(x => gm.w(x.P, 0.09))); Ag.userData.at(gm.w(q.P), q.P[2]);
        const w0 = gm.w(q.P, 0.35), w1 = [w0[0] + 2 * Math.cos(q.th), 0.35, w0[2] - 2 * Math.sin(q.th)]; Tg.userData.set([w0, w1]); Tgh.position.set(...w1);
        const nx = run.a.out[Math.max(1, n)], mp = nx.mp, z = nx.z; F.userData.gauss(mp, A.sig); Fp.position.set(...zw(mp, 0.15)); Fg.position.set(...zw(z, 0.3)); Ar.userData.set([zw(mp, 0.15), zw(z, 0.15)]);
        const ng = Toy.gIn(q.s, Toy.wrap(q.th - q.P[2]), q.vs), g = task(U.v, U.wz).G.f(ng).y;
        live([['先验', VAR[U.v][0]], ['t', n + ' / ' + Tt], ['目标 θ* / v*', fx(q.th) + ' / ' + fx(q.vs, 1)], ['当前速度', fx(q.s[0])], ['μg（残差）', vv([g[0], g[1]])], ['|航向误差| 全程', fx(run.a.eH)], ['只采先验的基线', fx(run.b.eH)], ['|速度误差| 全程', fx(run.a.eV)], ['基线', fx(run.b.eV)], ['ω 开环 16 步位置偏差', fx(run.dW)]]);
        cap((n >= 30 ? '<b>目标变了</b>（方向 −2.2 rad，速度 0.6）。' : '') + '黄 = 任务策略，灰 = 只从先验采。左：蓝球是先验均值，黄球是实际的 z');
      } };
  }

  function s11(G) {
    const Tp = block(3, 1.4, 2, COL.task, [-9, 3.2, 0]), Fz = block(4.4, 1.4, 2, COL.wm, [-3, 3.2, 0]), Tg = block(2.6, 1.2, 1.6, COL.task, [3.2, 3.2, 0]), Rt = block(3, 1.4, 2, COL.post, [-9, 0, 0]), Tc = block(2.6, 1.2, 1.6, COL.post, [3.2, 0, 0]);
    const Dd = block(2.6, 1.5, 2, COL.grad, [8.8, 3.4, 0]), Cc = block(2.6, 1.5, 2, COL.buf, [8.8, 0, 0]);
    G.add(Tp, Fz, Tg, Rt, Tc, Dd, Cc);
    [[Tp, '任务策略 π(z|s,g)', 1.05], [Fz, '冻结的 π(a|s,z) + ω', 1.05], [Tg, 'τᵍ（假）', 0.95], [Rt, '后验 q，跟踪技能片段', -1.05], [Tc, 'τᶜ（真）', -0.95], [Dd, '判别器 D(s,s′;c)', 1.1], [Cc, '分类器 C(s,s′)', -1.1]].forEach(([m, t, dy]) => G.add(lab(t, [m.position.x, m.position.y + dy, 0.2], { size: 22 })));
    const pa = m => m.position.toArray();
    [[Tp, Fz], [Fz, Tg], [Tg, Dd], [Tg, Cc], [Rt, Tc], [Tc, Dd], [Tc, Cc]].forEach(([a, b]) => wire(G, [pa(a), pa(b)], 0x8ea2c4));
    wire(G, [pa(Rt), [-3, 0, 0], pa(Fz)], 0x8ea2c4, { opacity: 0.35 }); wire(G, [pa(Rt), pa(Tc)], 0x8ea2c4, { opacity: 0.5 });
    const a = stream(G, 5, COL.task), b = stream(G, 5, COL.post), c = stream(G, 5, COL.grad);
    return { update(p) {
      const ph = p < 0.4 ? 0 : p < 0.7 ? 1 : 2, q = (p * 16) % 1;
      [Tp, Fz, Tg, Rt, Tc, Dd, Cc].forEach(m => glow(m, 0));
      if (ph === 0) { glow(Tp, 1); glow(Fz, .4); glow(Tg, .8); glow(Rt, .8); glow(Tc, .8); a([pa(Tp), pa(Fz), pa(Tg)], q, 1); b([pa(Rt), pa(Tc)], q, 1); c([], 0, 0); cap('<b>生成两组滚动：</b>任务策略一条，后验跟踪技能片段一条'); }
      if (ph === 1) { glow(Dd, 1); glow(Cc, 1); a([pa(Tg), pa(Dd)], q, 1); b([pa(Tc), pa(Dd)], q, 1); c([], 0, 0); cap('<b>更新 D 和 C：</b>D 分真假（式 27），C 只在真样本上学分类（式 29）'); }
      if (ph === 2) { glow(Tp, 1); glow(Dd, .3); glow(Cc, .3); a([], 0, 0); b([], 0, 0); c([pa(Dd), pa(Tg), pa(Fz), pa(Tp)], 1 - q, 1); cap('<b>更新任务策略：</b>L_D、L_C、L_reg 穿过冻结的 π 和 ω 反传'); }
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
    cur = (i + SCENES.length) % SCENES.length; U.z = null; lastLive = null; chartState = null; dragFn = null; dragPlane = null; showInfo(cur);
    if (!S) return;
    L.clear(root); LABS = []; PICKS = []; lastCap = null;
    const sc = SCENES[cur]; if (document.body.classList.contains('embed') && !sc.emb) { sc.emb = 1; sc.cam = [sc.cam[0], sc.cam[1], sc.cam[2] * 1.06, [sc.cam[3][0], sc.cam[3][1] + 1.1, sc.cam[3][2]]]; } fly(...sc.cam); refDist = sc.cam[2] * aspectFix();
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
    S.onClick(() => PICKS, hit => { const g = hit?.object?.userData?.go; if (g != null) go(g); });
    S.onHover(() => PICKS, hit => { if (!dragFn) $('stage').style.cursor = hit ? 'pointer' : ''; });
    /* dragging a point in the latent plane: capture before the orbit handler sees it */
    const host = $('stage'); let dragging = false;
    const dragAt = e => { S.scene.updateMatrixWorld(); S.cam.updateMatrixWorld(); const h = S.pick(e, [dragPlane]); if (h && dragFn) { const z = wz_(h.point); dragFn([clamp(z[0], -ZR, ZR), clamp(z[1], -ZR, ZR)]); setPlay(false); api.update(pNow); return true; } return false; };
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
  go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0));
})();
