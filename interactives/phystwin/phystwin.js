'use strict';
/* PhysTwin (arXiv 2503.17973) taken apart into eleven animated scenes.
   The physics core below re-implements, in plain JS, the parts of Jianghanxiao/PhysTwin (commit 81c7187, MIT) that the
   scenes need: the open3d-style spring topology of _init_start, eval_springs (strain-based force, damping along the spring,
   control-point velocity = 0), update_vel_from_force (drag applied after the force, unit masses) and
   integrate_ground_collision (restitution, friction factor, time of impact). Units, stiffness values and step sizes are toys.
   Scene 6 runs a real (small) CMA-ES; scene 7 backpropagates by hand through the substeps of one frame, then takes an Adam
   step, as the trainer does; the gradient was checked against finite differences. Scene 10's bars are the paper's tables.
   Each scene's update(p) is a pure function of the timeline p plus the current toggles; only the explicit "live" modes
   (dragging in scene 5, keyboard in scene 11) step a simulation in real time and leave the timeline. */
/* ---------- physics core (no DOM): spring-mass system written the way PhysTwin's Warp kernels are ----------
   eval_springs: F = clip(e^θ, Ymin, Ymax)·(|d|/L0 − 1)·d̂ + c·((v_b − v_a)·d̂)·d̂ ; control points have v = 0 (as in the code)
   update_vel_from_force: v ← (v + Δt(F/m + g))·e^(−Δt·drag)   (m = 1 for every node, as in the code)
   integrate_ground_collision: restitution e, friction factor a = max(0, 1 − μ(1+e)|v_n|/|v_t|), time of impact
   Everything is in display units (y up, ground at y = 0). */
const PT = (function () {
  const YMIN = 0, YMAX = 1e5;
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function gauss(r) { const u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  /* ---- point sets ("structure points") ---- */
  function ropePts(o = {}) {
    const n = o.n ?? 24, sp = o.sp ?? 0.16, rr = o.rr ?? 0.09, y = o.y ?? 0.12, out = [];
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3 + i * 0.6; out.push([-(n - 1) * sp / 2 + i * sp, y + rr * Math.cos(a), rr * Math.sin(a)]); }
    return out;
  }
  function chainPts(n, sp, y) { const out = []; for (let i = 0; i < n; i++) out.push([-(n - 1) * sp / 2 + i * sp, y, 0]); return out; }
  function clothPts(o = {}) { const n = o.n ?? 11, sp = o.sp ?? 0.24, y = o.y ?? 0.03, out = []; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) out.push([(i - (n - 1) / 2) * sp, y, (j - (n - 1) / 2) * sp]); return out; }
  /* a sloth-like plush: body, head and four limbs filled on a jittered 0.19 grid, then voxel de-duplicated */
  function toyPts(seed = 4) {
    const r = rng(seed), h = 0.16, out = [], seen = new Set();
    const parts = [
      p => ((p[0]) / 0.62) ** 2 + ((p[1] - 0.72) / 0.6) ** 2 + (p[2] / 0.46) ** 2 <= 1,
      p => ((p[0] - 0.05) / 0.42) ** 2 + ((p[1] - 1.55) / 0.36) ** 2 + (p[2] / 0.36) ** 2 <= 1,
      p => { for (const s of [-1, 1]) { const ax = [s * 0.55, 1.0, 0], bx = [s * 1.45, 1.05, 0.05]; if (segD(p, ax, bx) <= 0.17) return true; } return false; },
      p => { for (const s of [-1, 1]) { const ax = [s * 0.3, 0.35, 0], bx = [s * 0.85, 0.16, 0.15]; if (segD(p, ax, bx) <= 0.17) return true; } return false; }
    ];
    for (let x = -1.7; x <= 1.7; x += h) for (let y = 0.0; y <= 2.0; y += h) for (let z = -0.6; z <= 0.6; z += h) {
      const p = [x + (r() - 0.5) * 0.06, y + (r() - 0.5) * 0.06, z + (r() - 0.5) * 0.06];
      if (!parts.some(f => f(p))) continue;
      const key = [Math.floor(p[0] / h), Math.floor(p[1] / h), Math.floor(p[2] / h)].join(','); if (seen.has(key)) continue; seen.add(key);
      out.push([p[0], Math.max(0.1, p[1]), p[2]]);
    }
    return out;
  }
  function segD(p, a, b) { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]; const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2))); return Math.hypot(ap[0] - t * ab[0], ap[1] - t * ab[1], ap[2] - t * ab[2]); }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  /* ---- topology exactly as _init_start: open3d search_hybrid_vector_3d(p, radius, max_nn) returns up to max_nn
     points within radius, nearest first, the query point itself included; idx[1:] drops it; pairs de-duplicated ---- */
  function connect(P, radius, maxnn) {
    const n = P.length, springs = [], L0 = [], flag = new Set();
    for (let i = 0; i < n; i++) {
      const near = []; for (let j = 0; j < n; j++) { const d = dist(P[i], P[j]); if (d <= radius) near.push([j, d]); }
      near.sort((a, b) => a[1] - b[1]); const idx = near.slice(0, maxnn).map(q => q[0]).slice(1);
      for (const j of idx) { const d = dist(P[i], P[j]), k = i < j ? i * n + j : j * n + i; if (!flag.has(k) && d > 1e-4) { flag.add(k); springs.push([i, j]); L0.push(d); } }
    }
    return { springs, L0 };
  }
  /* controller springs: for each control point, up to max_nn object points within radius (no self to drop) */
  function connectCtrl(P, C, radius, maxnn) {
    const out = [];
    C.forEach((c, ci) => { const near = []; for (let j = 0; j < P.length; j++) { const d = dist(c, P[j]); if (d <= radius) near.push([j, d]); } near.sort((a, b) => a[1] - b[1]); near.slice(0, maxnn).forEach(([j, d]) => out.push([ci, j, Math.max(d, 1e-3)])); });
    return out;
  }
  /* farthest point sampling (control points from the hand cloud) */
  function fps(P, k, start = 0) {
    const n = P.length, sel = [start], dmin = new Float64Array(n).fill(Infinity);
    for (let s = 1; s < Math.min(k, n); s++) { const last = P[sel[sel.length - 1]]; let bi = -1, bd = -1; for (let i = 0; i < n; i++) { dmin[i] = Math.min(dmin[i], dist(P[i], last)); if (dmin[i] > bd) { bd = dmin[i]; bi = i; } } sel.push(bi); }
    return sel;
  }

  /* ---- model + simulation ----
     model: { P (rest points), S (object springs [a,b]), L0, CS (control springs [ci, node, L0]), nC }
     prm:   { th (log Y per object spring, Float64Array), thc (log Y per control spring), c, drag, e, mu, g, dt, sub, form ('code' | 'paper'), kPaper } */
  function model(P, topo, ctrlRest, cr, ck) {
    const t = topo || connect(P, 0.3, 30);
    return { P, S: t.springs, L0: t.L0, CS: ctrlRest ? connectCtrl(P, ctrlRest, cr, ck) : [], nC: ctrlRest ? ctrlRest.length : 0 };
  }
  function uniform(M, Y, extra = {}) {
    return Object.assign({ th: new Float64Array(M.S.length).fill(Math.log(Y)), thc: new Float64Array(M.CS.length).fill(Math.log(Y)), c: 4, drag: 1.5, e: 0.3, mu: 0.6, g: 9.8, dt: 1 / 600, sub: 20, form: 'code' }, extra);
  }
  function state(M) { const n = M.P.length, x = new Float64Array(n * 3), v = new Float64Array(n * 3); M.P.forEach((p, i) => { x[i * 3] = p[0]; x[i * 3 + 1] = p[1]; x[i * 3 + 2] = p[2]; }); return { x, v }; }

  /* one substep. cp: flat control positions. Returns nothing; updates x, v in place. f: scratch */
  function substep(M, prm, x, v, cp, f, rec) {
    const n = M.P.length, dt = prm.dt; f.fill(0);
    const S = M.S, L0 = M.L0, th = prm.th, c = prm.c;
    for (let s = 0; s < S.length; s++) {
      const a = S[s][0] * 3, b = S[s][1] * 3; let dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2]; const l = Math.max(Math.hypot(dx, dy, dz), 1e-6); dx /= l; dy /= l; dz /= l;
      const Y = Math.min(prm.ymax ?? YMAX, Math.max(prm.ymin ?? YMIN, Math.exp(th[s])));
      const fs = prm.form === 'paper' ? prm.kPaper * (l - L0[s]) : Y * (l / L0[s] - 1);
      const vr = (v[b] - v[a]) * dx + (v[b + 1] - v[a + 1]) * dy + (v[b + 2] - v[a + 2]) * dz, F = fs + c * vr;
      f[a] += F * dx; f[a + 1] += F * dy; f[a + 2] += F * dz; f[b] -= F * dx; f[b + 1] -= F * dy; f[b + 2] -= F * dz;
    }
    const CS = M.CS, thc = prm.thc;
    for (let s = 0; s < CS.length; s++) {
      const ci = CS[s][0] * 3, b = CS[s][1] * 3; let dx = x[b] - cp[ci], dy = x[b + 1] - cp[ci + 1], dz = x[b + 2] - cp[ci + 2]; const l = Math.max(Math.hypot(dx, dy, dz), 1e-6); dx /= l; dy /= l; dz /= l;
      const Y = Math.min(prm.ymax ?? YMAX, Math.max(prm.ymin ?? YMIN, Math.exp(thc[s])));
      const fs = prm.form === 'paper' ? prm.kPaper * (l - CS[s][2]) : Y * (l / CS[s][2] - 1);
      const vr = v[b] * dx + v[b + 1] * dy + v[b + 2] * dz, F = fs + c * vr; /* control velocity is zero in eval_springs */
      f[b] -= F * dx; f[b + 1] -= F * dy; f[b + 2] -= F * dz;
    }
    const dd = Math.exp(-dt * prm.drag), e = Math.min(1, Math.max(0, prm.e)), mu = Math.min(2, Math.max(0, prm.mu));
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      let vx = (v[o] + dt * f[o]) * dd, vy = (v[o + 1] + dt * (f[o + 1] - prm.g)) * dd, vz = (v[o + 2] + dt * f[o + 2]) * dd;
      const y = x[o + 1];
      if (y + vy * dt < 0 && vy < -1e-4) {
        const vt = Math.max(Math.hypot(vx, vz), 1e-6), A = Math.max(0, 1 - mu * (1 + e) * Math.abs(vy) / vt);
        const nx = A * vx, ny = -e * vy, nz = A * vz, toi = -y / vy;
        x[o] += vx * toi + nx * (dt - toi); x[o + 1] += vy * toi + ny * (dt - toi); x[o + 2] += vz * toi + nz * (dt - toi);
        vx = nx; vy = ny; vz = nz; if (rec) rec.hit++;
      } else { x[o] += vx * dt; x[o + 1] += vy * dt; x[o + 2] += vz * dt; }
      v[o] = vx; v[o + 1] = vy; v[o + 2] = vz;
    }
  }
  /* control targets per frame, linearly interpolated inside the frame (set_control_points) */
  function ctrlAt(ctrl, nC, t) { const q = ctrl(t), out = new Float64Array(nC * 3); for (let c = 0; c < nC; c++) { out[c * 3] = q[c][0]; out[c * 3 + 1] = q[c][1]; out[c * 3 + 2] = q[c][2]; } return out; }
  function rollout(M, prm, ctrl, frames, fps = 30, s0) {
    const n = M.P.length, st = s0 ? { x: Float64Array.from(s0.x), v: Float64Array.from(s0.v) } : state(M), f = new Float64Array(n * 3);
    const X = new Float32Array(frames * n * 3), CP = new Float32Array(frames * Math.max(1, M.nC) * 3), rec = { hit: 0 };
    const sub = prm.sub; prm = Object.assign({}, prm, { dt: 1 / (fps * sub) });
    const save = (k, cp) => { X.set(st.x, k * n * 3); if (M.nC) CP.set(cp, k * M.nC * 3); };
    let prev = M.nC ? ctrlAt(ctrl, M.nC, 0) : new Float64Array(3); save(0, prev);
    const cp = new Float64Array(Math.max(3, M.nC * 3));
    for (let k = 1; k < frames; k++) {
      const tgt = M.nC ? ctrlAt(ctrl, M.nC, k / fps) : prev;
      for (let s = 0; s < sub; s++) { const u = (s + 1) / sub; for (let q = 0; q < M.nC * 3; q++) cp[q] = prev[q] + (tgt[q] - prev[q]) * u; substep(M, prm, st.x, st.v, cp, f, rec); }
      prev = tgt; save(k, tgt);
    }
    return { X, CP, frames, n, hits: rec.hit, final: st };
  }

  /* ---- first-order stage: hand-written reverse mode through the substeps of ONE frame (the code backpropagates
     frame by frame, then takes an Adam step; the incoming state is detached). Loss = mean over nodes of 0.5|x − x_obs|². ----
     No ground contact is assumed in the scene that uses it (rope hanging between two hands). */
  function frameGrad(M, prm, x0, v0, cpPrev, cpTgt, obs) {
    const n = M.P.length, sub = prm.sub, dt = prm.dt, S = M.S, CS = M.CS, c = prm.c, dd = Math.exp(-dt * prm.drag);
    const xs = [Float64Array.from(x0)], vs = [Float64Array.from(v0)], f = new Float64Array(n * 3), cps = [];
    let x = Float64Array.from(x0), v = Float64Array.from(v0);
    const p2 = Object.assign({}, prm, { e: 0, mu: 0 });
    for (let s = 0; s < sub; s++) { const u = (s + 1) / sub, cp = new Float64Array(M.nC * 3); for (let q = 0; q < M.nC * 3; q++) cp[q] = cpPrev[q] + (cpTgt[q] - cpPrev[q]) * u; cps.push(cp); substep(M, p2, x, v, cp, f); xs.push(Float64Array.from(x)); vs.push(Float64Array.from(v)); }
    let L = 0; const ax = new Float64Array(n * 3), av = new Float64Array(n * 3);
    for (let i = 0; i < n * 3; i++) { const d = x[i] - obs[i]; L += 0.5 * d * d; ax[i] = d / n; } L /= n;
    const gth = new Float64Array(S.length), gthc = new Float64Array(CS.length), af = new Float64Array(n * 3);
    for (let s = sub - 1; s >= 0; s--) {
      const xp = xs[s], vp = vs[s], cp = cps[s];
      /* x' = x + dt v' ; v' = dd (v + dt (f + g)) */
      for (let i = 0; i < n * 3; i++) { const avt = av[i] + dt * ax[i]; af[i] = dd * dt * avt; av[i] = dd * avt; /* ax unchanged (∂x'/∂x = I) */ }
      const J = (dx, dy, dz, l, Y, L0, wx, wy, wz, gF, out) => {
        /* F = Y(l/L0 − 1) d + c (w·d) d, u = x_b − x_a. returns [gu, gw, gθ] */
        const s1 = Y * (l / L0 - 1), wd = wx * dx + wy * dy + wz * dz, gd = gF[0] * dx + gF[1] * dy + gF[2] * dz;
        const Pg = [gF[0] - gd * dx, gF[1] - gd * dy, gF[2] - gd * dz], Pw = [wx - wd * dx, wy - wd * dy, wz - wd * dz];
        /* J^T g = (Y/L0) d (d·g) + (s1/l) P g + (c/l) [ P w (d·g) + (w·d) P g ] */
        for (let k = 0; k < 3; k++) out[k] = (Y / L0) * [dx, dy, dz][k] * gd + (s1 / l) * Pg[k] + (c / l) * (Pw[k] * gd + wd * Pg[k]);
        out[3] = c * dx * gd; out[4] = c * dy * gd; out[5] = c * dz * gd; out[6] = s1 * gd;
      };
      const tmp = new Float64Array(7), gF = [0, 0, 0];
      for (let q = 0; q < S.length; q++) {
        const a = S[q][0] * 3, b = S[q][1] * 3; let dx = xp[b] - xp[a], dy = xp[b + 1] - xp[a + 1], dz = xp[b + 2] - xp[a + 2]; const l = Math.max(Math.hypot(dx, dy, dz), 1e-6); dx /= l; dy /= l; dz /= l;
        const Yr = Math.exp(prm.th[q]), Y = Math.min(prm.ymax ?? YMAX, Math.max(prm.ymin ?? YMIN, Yr));
        gF[0] = af[a] - af[b]; gF[1] = af[a + 1] - af[b + 1]; gF[2] = af[a + 2] - af[b + 2];
        J(dx, dy, dz, l, Y, M.L0[q], vp[b] - vp[a], vp[b + 1] - vp[a + 1], vp[b + 2] - vp[a + 2], gF, tmp);
        for (let k = 0; k < 3; k++) { ax[b + k] += tmp[k]; ax[a + k] -= tmp[k]; av[b + k] += tmp[3 + k]; av[a + k] -= tmp[3 + k]; }
        if (Yr > (prm.ymin ?? YMIN) && Yr < (prm.ymax ?? YMAX)) gth[q] += tmp[6];
      }
      for (let q = 0; q < CS.length; q++) {
        const ci = CS[q][0] * 3, b = CS[q][1] * 3; let dx = xp[b] - cp[ci], dy = xp[b + 1] - cp[ci + 1], dz = xp[b + 2] - cp[ci + 2]; const l = Math.max(Math.hypot(dx, dy, dz), 1e-6); dx /= l; dy /= l; dz /= l;
        const Yr = Math.exp(prm.thc[q]), Y = Math.min(prm.ymax ?? YMAX, Math.max(prm.ymin ?? YMIN, Yr));
        gF[0] = -af[b]; gF[1] = -af[b + 1]; gF[2] = -af[b + 2];
        J(dx, dy, dz, l, Y, CS[q][2], vp[b], vp[b + 1], vp[b + 2], gF, tmp);
        for (let k = 0; k < 3; k++) { ax[b + k] += tmp[k]; av[b + k] += tmp[3 + k]; }
        if (Yr > (prm.ymin ?? YMIN) && Yr < (prm.ymax ?? YMAX)) gthc[q] += tmp[6];
      }
    }
    return { L, gth, gthc, x, v };
  }
  /* loss of one frame only (for finite-difference checks) */
  function frameLoss(M, prm, x0, v0, cpPrev, cpTgt, obs) { const r = frameGrad(M, prm, x0, v0, cpPrev, cpTgt, obs); return r.L; }

  /* ---- a small (μ/μ_w, λ)-CMA-ES on [0,1]^n (Hansen's tutorial defaults; bounds by clipping the evaluated point) ---- */
  function cmaes(fun, x0, sigma0, gens, seed = 42) {
    const n = x0.length, lam = 4 + Math.floor(3 * Math.log(n)), mu = Math.floor(lam / 2), r = rng(seed);
    const wr = []; for (let i = 0; i < mu; i++) wr.push(Math.log(mu + 0.5) - Math.log(i + 1)); const ws = wr.reduce((a, b) => a + b, 0), w = wr.map(x => x / ws), mueff = 1 / w.reduce((a, b) => a + b * b, 0);
    const cc = (4 + mueff / n) / (n + 4 + 2 * mueff / n), cs = (mueff + 2) / (n + mueff + 5), c1 = 2 / ((n + 1.3) ** 2 + mueff), cmu = Math.min(1 - c1, 2 * (mueff - 2 + 1 / mueff) / ((n + 2) ** 2 + mueff)), damps = 1 + 2 * Math.max(0, Math.sqrt((mueff - 1) / (n + 1)) - 1) + cs, chiN = Math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n * n));
    let m = x0.slice(), sigma = sigma0, C = eye(n), pc = new Array(n).fill(0), ps = new Array(n).fill(0); const hist = [];
    let best = { x: m.slice(), f: fun(m.map(clip01)) }; hist.push({ gen: 0, pop: [{ x: m.map(clip01), f: best.f }], mean: m.map(clip01), sigma, C: C.map(r => r.slice()), best: { ...best } });
    for (let g = 1; g <= gens; g++) {
      const { B, D } = eig(C), pop = [];
      for (let k = 0; k < lam; k++) { const z = []; for (let i = 0; i < n; i++) z.push(gauss(r)); const y = matv(B, z.map((zi, i) => D[i] * zi)); const x = m.map((mi, i) => mi + sigma * y[i]); const xc = x.map(clip01); const fx = fun(xc) + 1e-3 * x.reduce((s, xi, i) => s + (xi - xc[i]) ** 2, 0); pop.push({ x, xc, y, f: fx }); }
      pop.sort((a, b) => a.f - b.f);
      const old = m.slice(); m = new Array(n).fill(0); for (let i = 0; i < mu; i++) for (let j = 0; j < n; j++) m[j] += w[i] * pop[i].x[j];
      const yw = m.map((mj, j) => (mj - old[j]) / sigma), Cinvh = matv(B, matTv(B, yw).map((t, i) => t / D[i]));
      ps = ps.map((p, i) => (1 - cs) * p + Math.sqrt(cs * (2 - cs) * mueff) * Cinvh[i]);
      const psn = Math.hypot(...ps), hs = psn / Math.sqrt(1 - (1 - cs) ** (2 * g)) / chiN < 1.4 + 2 / (n + 1) ? 1 : 0;
      pc = pc.map((p, i) => (1 - cc) * p + hs * Math.sqrt(cc * (2 - cc) * mueff) * yw[i]);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { let rk = 0; for (let k = 0; k < mu; k++) rk += w[k] * pop[k].y[i] * pop[k].y[j]; C[i][j] = (1 - c1 - cmu) * C[i][j] + c1 * (pc[i] * pc[j] + (1 - hs) * cc * (2 - cc) * C[i][j]) + cmu * rk; }
      sigma *= Math.exp((cs / damps) * (psn / chiN - 1));
      if (pop[0].f < best.f) best = { x: pop[0].xc.slice(), f: pop[0].f };
      hist.push({ gen: g, pop: pop.map(p => ({ x: p.xc, f: p.f })), mean: m.map(clip01), sigma, C: C.map(r => r.slice()), best: { x: best.x.slice(), f: best.f } });
    }
    return { hist, lam, mu, best };
  }
  const clip01 = x => Math.max(0, Math.min(1, x));
  const eye = n => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const matv = (A, x) => A.map(r => r.reduce((s, a, j) => s + a * x[j], 0));
  const matTv = (A, x) => A[0].map((_, j) => A.reduce((s, r, i) => s + r[j] * x[i], 0));
  function eig(Cm) { /* Jacobi for small symmetric matrices: C = B diag(D²) Bᵀ */
    const n = Cm.length, a = Cm.map(r => r.slice()), V = eye(n);
    for (let sw = 0; sw < 50; sw++) { let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] ** 2; if (off < 1e-20) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) { if (Math.abs(a[p][q]) < 1e-18) continue; const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; } } }
    return { B: V, D: a.map((r, i) => Math.sqrt(Math.max(1e-20, r[i]))) };
  }

  return { rng, gauss, ropePts, chainPts, clothPts, toyPts, connect, connectCtrl, fps, model, uniform, state, substep, rollout, ctrlAt, frameGrad, frameLoss, cmaes, eig, dist, YMIN, YMAX };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PT;

/* ================= browser part ================= */
if (typeof window !== 'undefined' && window.Lab3D) (function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const PI = Math.PI;
  const COL = { obs: 0xf0963c, sim: 0x5b8bd6, ctrl: 0xff5f7e, spring: 0x4fc98a, rope: 0xe6c49a, cloth: 0xc94f5a, toy: 0x9fc3d6, table: 0x262b36, gs: 0x38d1ff, align: 0xf2c14e,
    ok: 0x4fc98a, bad: 0xe05d5d, dim: 0x46506a, white: 0xeef2fa, purple: 0x9d8cff, cam: [0x38d1ff, 0xf2c14e, 0xd45fa0], sg: 0xd95926, gsd: 0x8e9bb8, pt: 0x4fc98a };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  const SCENES = [
    { n: 1, part: '总览', title: '三段视频进，一个能模拟、能渲染的孪生出', sub: '图 2 的 3D 版：先物理和几何，再外观', dur: 14, cam: [0.15, 1.02, 30, [0, 1.8, 0.5]],
      html: dl([['输入', '三台 RGB-D 相机，一段人手摆弄物体的视频'], ['几何', 'TRELLIS 补全 + 配准到第一帧'], ['物理', '弹簧-质点：拓扑、逐弹簧刚度、阻尼、碰撞'], ['优化', '零阶 CMA-ES（稀疏）→ 一阶可微模拟（稠密）'], ['外观', '第一帧的各向同性高斯，LBS 跟着质点动'], ['用途', '重新模拟、预测、新交互、实时交互、规划']]) +
        '<p>式 (2) 把所有东西写成一个优化：让模拟出的点云、跟踪点和渲染图都对上观测。实际分两段做：先只管物理和几何（式 3），再只管外观（式 4）。</p><p>点画面里的方块可以跳到对应那一幕。</p>' + src('§4 · 图 2') },
    { n: 2, part: '§5.1 输入', title: '三台 RGB-D 相机各看到一部分，手变成控制点', sub: '切换相机看各自的覆盖；手部点云当场做最远点采样', dur: 12, cam: [0.5, 1.0, 16.5, [0.4, 1.0, 0]],
      html: dl([['相机', '三台 D455，代码默认 848×480、30 FPS'], ['点云', '每帧深度反投影，得到局部点云 Xₜ'], ['跟踪', 'CoTracker3 的 2D 跟踪抬到 3D，作伪真值'], ['手', 'Grounded-SAM2 分割，跟踪后最远点采样'], ['控制点', '代码取 30 个']]) +
        '<p>每台相机只看到朝向它的那一面，所以单帧点云是残缺的；三台合起来也看不到底面和被遮住的部分。这就是第 3 幕要用生成模型补全形状的原因。</p>' +
        '<p>粉色是手的点云。最远点采样每次选离已选点最远的那个点，选出的控制点均匀铺开。这些控制点之后用弹簧连到物体上（第 4 幕），作为“动作”。</p>' +
        guess('相机位置、可见性（只看法向，不算遮挡）和手的形状是我设的；覆盖率和最远点采样是当场算的。') + src('§4.2.1 · §5.1 · 代码 camera_system.py、data_process_track.py') },
    { n: 3, part: '§4.2.1 形状先验', title: '生成一个完整的形状，再配准到第一帧', sub: '选视角 → PnP 旋转 → 沿射线定尺度 → ARAP → 体积采样', dur: 15, cam: [0.35, 1.05, 16, [0.6, 1.0, 0]],
      html: dl([['生成', '超分辨率 → TRELLIS，从一张遮罩图生成网格'], ['选视角', '球面上的虚拟相机渲染，SuperGlue 匹配数最多的'], ['旋转', 'PnP 精修'], ['尺度', 'PnP 后匹配点在同一条过相机原点的射线上，只解一个标量'], ['非刚性', 'ARAP，再做光线投射对齐'], ['质点', '表面 + 内部采样，体素去重']]) +
        '<p>橙色是三台相机看到的局部点云，灰色是生成的完整形状。生成的形状尺度、朝向和局部姿态都和观测有出入，要一步步对齐。</p>' +
        guess('生成形状的错位量、32 个虚拟视角的“匹配数”（按视角夹角给的）和 ARAP 的形变都是示意；只有步骤顺序照论文附录 A 和 align.py。') + src('§4.2.1 · 附录 A · 代码 align.py、data_process_sample.py') },
    { n: 4, part: '§4.2.1 拓扑', title: '按半径和最大近邻数连弹簧，当场数', sub: '切换半径和最大近邻数，弹簧数和平均度数当场重算', dur: 13, cam: [0.4, 1.05, 9.5, [0, 1.0, 0]],
      html: dl([['规则', '每个点找半径内最近的 max_nn 个点（含自己），去掉自己'], ['去重', '一对点只连一根弹簧'], ['控制点', '同样的规则，另一组半径和近邻数'], ['代码默认', '物体 0.02 / 30，控制点 0.04 / 50（米）'], ['为什么零阶', '弹簧数随半径跳变，近邻数是整数，梯度不存在']]) +
        '<p>动画按点的编号逐个连：白色球是当前的点，透明球是它的搜索半径，新连上的弹簧变亮。半径小，只连到最近的几个点，物体松散；半径大、近邻数也大，弹簧密，物体更“实”。</p>' +
        '<p>近邻数的上限只在半径够大时才起作用：半径小时，半径内本来就没几个点。</p>' +
        toyb('毛绒玩具 239 个点，单位是我设的；连接规则照代码 _init_start（open3d 混合搜索）。弹簧数、度数是当场算的。') + src('§4.2.1 · 代码 cma_optimize_warp.py _init_start') },
    { n: 5, part: '§3 模拟', title: '弹簧-质点模拟：当场算，可以拖', sub: '这一幕是核心。选物体和动作；按住粉色控制点拖动，模拟实时跟着走', dur: 10, cam: [0.3, 1.05, 10, [0, 1.0, 0]],
      html: dl([['力（代码）', 'F = Y·(|Δx|/l − 1)·d̂ + c·(Δv·d̂)·d̂'], ['力（论文 §3）', 'F = k·(|Δx| − l)·d̂，阻尼 −γ(vᵢ − vⱼ)'], ['积分', 'v ← (v + Δt(F/m + g))·e^(−Δt·drag)；x ← x + Δt·v'], ['地面', 'vₙ ← −e·vₙ，vₜ ← a·vₜ，a = max(0, 1 − μ(1+e)|vₙ|/|vₜ|)'], ['控制点', '每子步线性插值；阻尼里速度按 0']]) +
        '<p>粉色球是控制点（手），粉色细线是控制点弹簧。弹簧颜色表示应变：红是拉长，蓝是压缩。切到“论文式”时，用伸长量而不是应变，k 取所有弹簧 Y/l 的平均，短弹簧变软、长弹簧变硬，形态会有差别。</p>' +
        '<p><b>拖动：</b>按住粉色球拖，模拟进入实时模式（进度条停下）；拖进度条或换开关就回到脚本动作。</p>' +
        toyb('单位、刚度（绳 2500、布 1500、玩具 6000）、阻尼 c = 4、拖曳 1.5、Δt = 1/600、每帧 20 子步都是我设的；力的形式、积分顺序和地面碰撞公式照代码。没有自碰撞。') + src('§3 式 (1) · 代码 spring_mass_warp.py eval_springs、update_vel_from_force、integrate_ground_collision') },
    { n: 6, part: '§4.2.1 零阶', title: '第一段：CMA-ES 搜稀疏参数，一代一代收拢', sub: '左边是参数空间（刚度 × 连接半径 × 拖曳阻尼），右边是当前最好参数的模拟', dur: 16, cam: [0.55, 1.0, 21, [0.6, 2.6, 0]],
      html: dl([['参数（玩具）', 'log 刚度、连接半径、拖曳阻尼，各归一化到 [0, 1]'], ['参数（代码）', '12 个：全局刚度、两组半径和近邻数、四个碰撞系数、碰撞距离、两个阻尼'], ['设置', 'σ₀ = 1/6，边界 [0, 1]；代码 20 代、种群 11'], ['损失', '跟踪点距离（代码另有 Chamfer 和加速度平滑项）'], ['为什么不用梯度', '半径改变弹簧数，损失是台阶形的']]) +
        '<p>每一代按当前的均值和协方差撒一批点（彩色小球，颜色是损失），按损失排序，用最好的一半更新均值、协方差和步长。底面的色块是刚度 × 阻尼在真实半径处的损失切片，越亮越好；橙色星是隐藏的真值。</p>' +
        '<p>注意半径那一维：在一大段范围内弹簧数不变，损失是平的，CMA-ES 在那里只能靠随机游走。</p>' +
        toyb('16 个点的绳子，一端被提起再晃动；“观测”用隐藏参数模拟，不是视频。CMA-ES 是我按 Hansen 教程写的（种群 7，20 代），每次评估都当场模拟。') + src('§4.2.1 · 附录 C 表 3 · 代码 cma_optimize_warp.py') },
    { n: 7, part: '§4.2.1 一阶', title: '第二段：穿过模拟器求梯度，调每一根弹簧', sub: '中间那段绳子更软；从第一段的统一刚度出发，逐帧反传，每帧一次 Adam', dur: 16, cam: [0.15, 1.05, 16.5, [0.8, 3.0, 0]],
      html: dl([['参数', '每根弹簧的 θ = log Y（代码还有四个碰撞系数）'], ['梯度', '穿过一帧的全部子步反传，入口状态不带梯度'], ['更新', '每帧一次 Adam（代码 lr 1e-3，β = 0.9, 0.99）'], ['轮数', '代码 200 轮（布 100 轮），按训练损失留最好的'], ['阻尼和拓扑', '停在第一段的结果']]) +
        '<p>橙色半透明是“观测”，蓝色是当前参数下的模拟。上方的柱子是每根弹簧的刚度：橙色真值，蓝色估计。中间那段真值只有两端的十分之一，统一刚度做不到，所以第一段的损失降不下去。</p>' +
        '<p>右边的曲线是每轮的跟踪误差。代码和这里一样，梯度只穿过一帧（论文把“长时间跨度”列为难点，代码用逐帧截断绕开）。</p>' +
        toyb('14 个点的绳子挂在两只手之间，25 根弹簧。反向传播是手写的，已和有限差分核对；学习率 0.02、刚度上限 6000、24 轮是我设的。') + src('§4.2.1 · 代码 trainer_warp.py train、spring_mass_warp.py') },
    { n: 8, part: '§4.2.1 碰撞', title: '碰撞参数：损失曲线为什么不光滑', sub: '扫地面的弹性 e 或摩擦 μ，看损失怎么变；橙色是观测，蓝色是当前参数', dur: 13, cam: [0.25, 1.05, 16.5, [1.0, 1.3, 0]],
      html: dl([['地面（代码）', '下一子步会穿地且向下运动时触发'], ['法向', 'vₙ ← −e·vₙ，e 截断到 [0, 1]'], ['切向', 'vₜ ← max(0, 1 − μ(1+e)|vₙ|/|vₜ|)·vₜ，μ 截断到 [0, 2]'], ['两段都调', '第一段 CMA-ES，第二段 Adam'], ['点对点', '另有一组 e、μ（布和包装开自碰撞）']]) +
        '<p>同一个小方块被同样地扔出去，只改一个碰撞参数。弹性 e 决定弹多高、弹几次，弹跳次数一变，之后的整条轨迹都变，所以损失随 e 是锯齿形的，有好几个局部极小。摩擦 μ 的曲线平滑得多。</p>' +
        '<p>这是论文 4.2.1 说的“动力学里的不连续”：先用零阶方法把碰撞参数放进正确的盆地，再用梯度细调。</p>' +
        toyb('4×4×4 = 64 个点、360 根弹簧，初速度和真值 e = 0.45、μ = 0.35 都是我设的。每条曲线 41 次完整模拟，当场算。') + src('§3 · §4.2.1 · 代码 integrate_ground_collision、object_collision') },
    { n: 9, part: '§4.2.2 外观', title: '高斯跟着质点动：线性混合蒙皮', sub: '切换高斯形状和是否转朝向；布在当场模拟', dur: 12, cam: [0.45, 1.0, 8.5, [0, 1.2, 0]],
      html: dl([['节点旋转', '式 (5)：用邻居位移拟合 Rₖ'], ['高斯中心', '式 (6)：μ′ = Σ wₖ(Rₖ(μ − μ̂ₖ) + μ̂ₖ + Tₖ)'], ['朝向', '式 (7)：q′ = (Σ wₖ rₖ) ⊗ q'], ['权重', '式 (8)：距离倒数归一化，K 个最近节点'], ['论文', '高斯各向同性，只在第一帧优化']]) +
        '<p>物理只算质点，渲染要的是高斯。每个高斯取最近的几个节点，按距离倒数加权平移；每个节点用邻居的位移拟合一个局部旋转，高斯的朝向也跟着混合旋转。</p>' +
        '<p>论文把高斯限制为各向同性（球），朝向转不转都看不出来，变形时也不会出“尖刺”。切到“各向异性 + 不转”，扁椭球不再贴着布面，底部数字是椭球法向和布面法向的平均夹角，当场算。站内 Real-to-Sim 评测的代码就是“不转”（quat=None），但它的高斯来自手机扫描。</p>' +
        toyb('9×9 的布被提起一角，当场模拟；180 个椭球、K = 4、节点邻居取网格上下左右和对角都是我设的（代码 K = 16）。节点旋转用 Horn 四元数法当场解。') + src('§4.2.2 · 附录 B 式 (5)–(8) · 代码 gs_render_dynamics.py') },
    { n: 10, part: '§5.2 结果', title: '预测没见过的帧和动作，再看论文的三张表', sub: '玩具：前 70% 训练、后 30% 预测、换一个动作；表：论文原数', dur: 13, cam: [0.1, 1.08, 15, [0.5, 2.0, 0]],
      html: dl([['重建与重新模拟', '前 70% 帧（训练段）'], ['未来预测', '同一段视频的后 30% 帧'], ['新交互', '同一物体换一种手部动作，11 对 × 2 个方向'], ['指标', 'CD、跟踪误差（3D）；IoU、PSNR、SSIM、LPIPS（2D，中间相机）'], ['基线', 'Spring-Gaus（物理）、GS-Dynamics（图网络）']]) +
        '<p>“玩具”视图用第 7 幕学到的参数，在训练段、预测段和一个新动作上分别模拟，和只用第一段统一刚度的结果比。曲线是每帧的跟踪误差。</p>' +
        '<p>表视图的柱子是论文原数：表 1 两个任务、表 2 新交互、表 3 消融。“越低越好”的指标柱子朝下画。</p>' +
        toyb('玩具部分是当场模拟；三张表不是玩具，数字照录原文。') + src('§5.2 表 1、表 2 · 附录 C 表 3') },
    { n: 11, part: '§5.3 应用', title: '实时交互和基于模型的规划', sub: '键盘交互：W/S/A/D/E/Q 和 I/K/J/L/O/U；规划：用孪生挑轨迹，在“真实”里执行', dur: 12, cam: [0.25, 1.05, 11, [0, 1.2, 0]],
      html: dl([['键盘交互', '两只手各 6 个键，代码每帧移动 0.005（米）'], ['遥操作', '机械臂操作时实时模拟物体，叠加在画面上'], ['规划', '孪生当作动力学模型；官方示例 PhysTwin-MPC 用 MPPI'], ['速度', 'README：4090 上树懒约 37 FPS'], ['后续', 'Real-to-Sim 评测把孪生接上夹爪碰撞和 3DGS 场景']]) +
        '<p><b>键盘交互：</b>不按键时，两只手按脚本拉伸玩具；按下任一键就进入实时模式，用键盘控制两只手。</p>' +
        '<p><b>规划：</b>目标是把绳子的另一端拖到绿色标记处。随机采 24 条控制轨迹，用孪生（第一段的统一刚度）模拟、按终点距离打分，挑最好的一条，再用“真实”参数执行。灰线是候选轨迹在孪生里预测的末端路径。</p>' +
        toyb('规划是随机打靶，只采样一次，不是 MPPI；“真实”参数是第 7 幕的隐藏真值。键盘每帧移动 0.02（玩具单位）。') + src('§5.3 · 图 5 · 代码 interactive_playground.py · github.com/Jianghanxiao/PhysTwin-MPC') }
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
    $('infoTag').textContent = `第 ${s.n} 幕 · ${s.part}`; $('infoTitle').textContent = s.title; $('infoBody').innerHTML = s.html;
    $('stepNo').textContent = `${s.n} / ${SCENES.length}`;
    stepsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(+b.dataset.i === i)));
    btns.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
  }
  let lastCap = null;
  const cap = h => { if (h !== lastCap) { lastCap = h; $('cap').innerHTML = h; } };

  /* ---------- 3D helpers (same pattern as interactives/latent and real2sim-eval) ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.3, phi: 1.0, dist: 24, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  if (!S) { showInfo(0); return; }
  const root = new THREE.Group(); S.scene.add(root);
  let LABS = [], refDist = 24, PICKS = [];
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  function dynLab(G, pos, o = {}) {
    const st = { s: null, t: null };
    return t => { if (t === st.t) return; if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; if (t == null || t === '') { st.s = null; return; } st.s = lab(t, pos, o); G.add(st.s); };
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: 0.6 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s, q) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, q || _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function hide(im, from, to) { for (let i = from; i < to; i++) setI(im, i, [0, -80, 0], 0.0001); }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.14) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.6, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  function pline(G, n, color, o = {}) {
    const pos = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: o.opacity ?? 1 })); l.frustumCulled = false; l.renderOrder = o.order ?? 3; G.add(l);
    l.userData.set = pts => { const k = Math.max(1, Math.min(n, pts.length)); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)]; pos[i * 3] = q[0]; pos[i * 3 + 1] = q[1]; pos[i * 3 + 2] = q[2]; } g.attributes.position.needsUpdate = true; };
    return l;
  }
  function segs(G, n, o = {}) {
    const pos = new Float32Array(n * 6), col = new Float32Array(n * 6), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: o.opacity ?? 0.9 })); l.frustumCulled = false; G.add(l);
    l.userData.n = n;
    l.userData.set = (i, a, b, c) => { pos[i * 6] = a[0]; pos[i * 6 + 1] = a[1]; pos[i * 6 + 2] = a[2]; pos[i * 6 + 3] = b[0]; pos[i * 6 + 4] = b[1]; pos[i * 6 + 5] = b[2]; col[i * 6] = col[i * 6 + 3] = c[0]; col[i * 6 + 1] = col[i * 6 + 4] = c[1]; col[i * 6 + 2] = col[i * 6 + 5] = c[2]; };
    l.userData.clear = (from = 0) => { for (let i = from * 6; i < n * 6; i++) pos[i] = 0; for (let i = from * 6; i < n * 6; i++) col[i] = 0; };
    l.userData.done = () => { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; };
    return l;
  }
  function floorRect(G, cx, cz, lx, lz, color, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(lx, lz), new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: o.opacity != null, opacity: o.opacity ?? 1, depthWrite: o.opacity == null })); m.rotation.x = -PI / 2; m.position.set(cx, o.y ?? 0, cz); G.add(m); return m; }
  function frustum(G, color, s = 0.6) {
    const g = new THREE.Group(), w = s * 0.8, h = s * 0.55, d = s;
    const c = [0, 0, 0], a = [-w, -h, -d], b = [w, -h, -d], e = [w, h, -d], f = [-w, h, -d];
    wire(g, [c, a], color, { opacity: 0.9 }); wire(g, [c, b], color, { opacity: 0.9 }); wire(g, [c, e], color, { opacity: 0.9 }); wire(g, [c, f], color, { opacity: 0.9 }); wire(g, [a, b, e, f, a], color, { opacity: 0.9 });
    G.add(g); return g;
  }
  /* Horn's quaternion method: best rotation taking vectors P to Q */
  function jacobi4(A) {
    const a = A.map(r => r.slice()), V = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
    for (let sweep = 0; sweep < 30; sweep++) {
      let off = 0; for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) off += a[i][j] * a[i][j];
      if (off < 1e-18) break;
      for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < 4; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < 4; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < 4; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    let bi = 0; for (let i = 1; i < 4; i++) if (a[i][i] > a[bi][bi]) bi = i;
    return [V[0][bi], V[1][bi], V[2][bi], V[3][bi]];
  }
  function hornRot(P, Q) {
    let Sxx = 0, Sxy = 0, Sxz = 0, Syx = 0, Syy = 0, Syz = 0, Szx = 0, Szy = 0, Szz = 0;
    for (let i = 0; i < P.length; i++) { const p = P[i], q = Q[i]; Sxx += p[0] * q[0]; Sxy += p[0] * q[1]; Sxz += p[0] * q[2]; Syx += p[1] * q[0]; Syy += p[1] * q[1]; Syz += p[1] * q[2]; Szx += p[2] * q[0]; Szy += p[2] * q[1]; Szz += p[2] * q[2]; }
    const N = [[Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx], [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz], [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy], [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz]];
    const e = jacobi4(N); return new THREE.Quaternion(e[1], e[2], e[3], e[0]).normalize();
  }
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], len3 = a => Math.hypot(a[0], a[1], a[2]);
  const rotP = (q, p) => { const v = new THREE.Vector3(p[0], p[1], p[2]).applyQuaternion(q); return [v.x, v.y, v.z]; };
  const at = (X, k, n, i) => { const o = (k * n + i) * 3; return [X[o], X[o + 1], X[o + 2]]; };
  function strainCol(e) { const k = clamp(e / 0.08, -1, 1); return k >= 0 ? [0.5 + 0.5 * k, 0.62 - 0.38 * k, 0.6 - 0.42 * k] : [0.5 + 0.12 * k, 0.62 - 0.02 * k, 0.6 - 0.4 * k]; }
  const lossCol = t => { const k = clamp(t, 0, 1); return [0.25 + 0.75 * k, 0.85 - 0.55 * k, 0.55 - 0.4 * k]; };

  /* renders a spring-mass model: nodes, springs coloured by strain, control balls and control springs */
  function bodyView(G, M, o = {}) {
    const n = M.P.length, nodes = inst(BALL, n, { opacity: o.opacity }); nodes.material.color.setHex(o.color ?? COL.toy); G.add(nodes);
    const sp = o.springs === false ? null : segs(G, M.S.length, { opacity: o.sOpacity ?? 0.85 });
    const cb = inst(BALL, Math.max(1, M.nC)); cb.material.color.setHex(COL.ctrl); cb.material.emissive.setHex(0x551122); G.add(cb); PICKS_CTRL.length = 0;
    const cl = segs(G, Math.max(1, M.CS.length), { opacity: 0.55 });
    const r = o.r ?? 0.06;
    return {
      nodes, cb, draw(X, k, CP) {
        for (let i = 0; i < n; i++) setI(nodes, i, at(X, k, n, i), r); done(nodes);
        if (sp) { for (let s = 0; s < M.S.length; s++) { const a = at(X, k, n, M.S[s][0]), b = at(X, k, n, M.S[s][1]); sp.userData.set(s, a, b, strainCol(len3(sub3(b, a)) / M.L0[s] - 1)); } sp.userData.done(); }
        if (M.nC && CP) { for (let c = 0; c < M.nC; c++) setI(cb, c, at(CP, k, M.nC, c), o.cr ?? 0.11); done(cb); cb.visible = true;
          for (let s = 0; s < M.CS.length; s++) { const c = at(CP, k, M.nC, M.CS[s][0]), b = at(X, k, n, M.CS[s][1]); cl.userData.set(s, c, b, hex3(COL.ctrl)); } cl.userData.done(); cl.visible = true; }
        else { cb.visible = false; cl.visible = false; }
      }
    };
  }
  const PICKS_CTRL = [];

  /* ---------- shared toy setups ---------- */
  const CACHE = {};
  const memo = (k, f) => (CACHE[k] ?? (CACHE[k] = f()));
  const OBJ = {
    rope: { name: '绳子', pts: () => PT.ropePts(), r: 0.3, K: 12, Y: 2500, color: COL.rope, hands: [[-2.0, 0.14, 0], [2.0, 0.14, 0]], cr: 0.3, ck: 8, nr: 0.06 },
    cloth: { name: '布', pts: () => PT.clothPts(), r: 0.36, K: 9, Y: 1500, color: COL.cloth, hands: [[-1.32, 0.05, -1.32], [1.32, 0.05, -1.32]], cr: 0.22, ck: 3, nr: 0.06 },
    toy: { name: '毛绒玩具', pts: () => PT.toyPts(), r: 0.26, K: 25, Y: 6000, color: COL.toy, hands: [[1.62, 1.05, 0.05], [-1.62, 1.05, 0.05]], cr: 0.45, ck: 12, nr: 0.065 }
  };
  const ACT = ['提起', '双手拉伸', '画圈'];
  function script(obj, act) {
    const h = OBJ[obj].hands, c0 = h[0], c1 = h[1], E = x => L.ease(clamp(x, 0, 1));
    if (act === 0) return t => { const u = E((t - 0.5) / 2.2), w = E((t - 4) / 2.5); return [[c0[0] - 0.5 * u * Math.sign(c0[0]) - 0.6 * w * Math.sign(c0[0]), c0[1] + 2.0 * u - 0.6 * w, c0[2] + 0.8 * w]]; };
    if (act === 1) return t => { const u = E((t - 0.5) / 2), s = E((t - 3) / 2.2) - E((t - 6.5) / 2); return [[c0[0] + 0.5 * s * Math.sign(c0[0]), c0[1] + 1.4 * u, c0[2]], [c1[0] + 0.5 * s * Math.sign(c1[0]), c1[1] + 1.4 * u, c1[2]]]; };
    return t => { const u = E((t - 0.4) / 1.8), a = Math.max(0, t - 2.2) * 1.5, m = E((t - 2.2) / 1.2); return [[c0[0] - 0.4 * u * Math.sign(c0[0]) - 0.9 * m * Math.sign(c0[0]) * (1 - Math.cos(a)) * 0.5, c0[1] + 1.8 * u + 0.5 * m * Math.sin(a), c0[2] + 0.9 * m * Math.sin(a)]]; };
  }
  function objModel(obj, nH) {
    return memo(`M|${obj}|${nH}`, () => { const o = OBJ[obj], P = o.pts(); const topo = memo(`T|${obj}`, () => PT.connect(P, o.r, o.K)); return PT.model(P, topo, o.hands.slice(0, nH), o.cr, o.ck); });
  }
  function objRun(obj, act, form) {
    return memo(`R|${obj}|${act}|${form}`, () => {
      const nH = act === 1 ? 2 : 1, M = objModel(obj, nH), o = OBJ[obj], prm = PT.uniform(M, o.Y, { c: 4, drag: 1.5, e: 0.3, mu: 0.8, sub: 20 });
      if (form === 1) { let s = 0; M.S.forEach((q, i) => { s += o.Y / M.L0[i]; }); prm.form = 'paper'; prm.kPaper = s / M.S.length; }
      return { M, prm, R: PT.rollout(M, prm, script(obj, act), 301, 30) };
    });
  }

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    G.add(L.grid(40, 40));
    const P = [
      ['三段 RGB-D 视频', [-11, 0.6, -2.6], COL.gs, 2], ['形状先验', [-6.5, 0.6, -2.6], COL.align, 3], ['拓扑：半径 + 近邻', [-2, 0.6, -2.6], COL.spring, 4],
      ['弹簧-质点模拟', [2.5, 0.6, -2.6], COL.spring, 5], ['零阶 CMA-ES', [-2, 0.6, 1.6], COL.purple, 6], ['一阶 可微模拟', [2.5, 0.6, 1.6], COL.purple, 7],
      ['碰撞参数', [7, 0.6, 1.6], COL.purple, 8], ['高斯 + LBS', [7, 0.6, -2.6], COL.gs, 9], ['预测 / 新交互', [-6.5, 0.6, 5.8], COL.obs, 10], ['交互 / 规划', [2.5, 0.6, 5.8], COL.obs, 11]
    ];
    const B = P.map(([t, pos, c, go]) => { const b = block(3.2, 1.2, 1.7, c, pos, { opacity: 0.88 }); b.userData.go = go - 1; PICKS.push(b); G.add(b, lab(t, [pos[0], pos[1] + 1.3, pos[2]], { size: 20, color: css(c) })); return b; });
    G.add(lab('第一段：物理和几何（式 3）', [-2.5, 2.9, -0.5], { size: 22, border: 'rgba(157,140,255,.7)' }), lab('第二段：外观（式 4）', [7, 2.9, -4.6], { size: 22, border: 'rgba(56,209,255,.7)' }));
    const f = [stream(G, 6, COL.gs), stream(G, 6, COL.spring), stream(G, 6, COL.purple), stream(G, 6, COL.gs), stream(G, 6, COL.obs)];
    const st = ['三台相机拍一段人手摆弄物体的视频：深度变点云，CoTracker3 给跟踪点，手变控制点', '生成完整形状，配准到第一帧；按半径和最大近邻数连弹簧', '零阶 CMA-ES 定拓扑和全局参数，一阶梯度定每根弹簧的刚度，碰撞参数两段都调', '只在第一帧优化各向同性高斯，之后用 LBS 跟着质点动', '同一个孪生：重新模拟、预测后 30% 的帧、换一种动作、实时交互和规划'];
    return { update(p) {
      const q = (p * 14) % 1, k = Math.min(4, Math.floor(p * 5));
      B.forEach((b, i) => glow(b, ([[0], [1, 2], [4, 5, 6, 3], [7], [8, 9]][k].includes(i)) ? 0.7 : 0.05));
      f[0]([[-11, 1.4, -2.6], [-6.5, 1.4, -2.6]], q, 1); f[1]([[-6.5, 1.4, -2.6], [-2, 1.4, -2.6], [2.5, 1.4, -2.6]], q, k >= 1 ? 1 : 0);
      f[2]([[2.5, 1.4, -2.6], [-2, 1.4, 1.6], [2.5, 1.4, 1.6], [7, 1.4, 1.6]], q, k >= 2 ? 1 : 0); f[3]([[2.5, 1.4, -2.6], [7, 1.4, -2.6]], q, k >= 3 ? 1 : 0);
      f[4]([[7, 1.4, -2.6], [2.5, 1.4, 5.8], [-6.5, 1.4, 5.8]], q, k >= 4 ? 1 : 0);
      cap(st[k]);
    } };
  }

  /* ---------- scene 2: cameras, partial clouds, control points ---------- */
  function surfaceInfo(P) {
    return memo('surf', () => { const n = P.length, out = [];
      for (let i = 0; i < n; i++) { let c = [0, 0, 0], k = 0; for (let j = 0; j < n; j++) { if (PT.dist(P[i], P[j]) < 0.4) { c = add3(c, P[j]); k++; } } c = c.map(x => x / k); const d = sub3(P[i], c), l = len3(d); out.push({ surf: k < 26 && l > 0.035, nrm: l > 1e-6 ? d.map(x => x / l) : [0, 1, 0] }); }
      return out; });
  }
  const CAMS = [[4.6, 3.2, 3.4], [-5.2, 3.0, 2.6], [0.4, 3.4, -5.4]];
  function camVis(P, info, ci) { const c = CAMS[ci]; return P.map((p, i) => { if (!info[i].surf) return false; const d = sub3(c, p), l = len3(d); return (d[0] * info[i].nrm[0] + d[1] * info[i].nrm[1] + d[2] * info[i].nrm[2]) / l > 0.2; }); }
  function s2(G) {
    let cam = +(OPT[0] ?? 3);
    floorRect(G, 0, 0, 12, 9, COL.table); G.add(L.grid(12, 24));
    const { M, R } = objRun('toy', 1, 0), P = M.P, n = P.length, info = surfaceInfo(P);
    const vis = [0, 1, 2].map(ci => camVis(P, info, ci)), any = P.map((_, i) => vis.some(v => v[i])), nSurf = info.filter(x => x.surf).length;
    CAMS.forEach((c, ci) => { const f = frustum(G, COL.cam[ci], 0.55); f.position.set(...c); f.lookAt(0, 0.9, 0); f.rotateY(PI); G.add(lab(`相机 ${ci + 1}`, [c[0], c[1] + 0.75, c[2]], { size: 17, color: css(COL.cam[ci]) })); });
    const pts = inst(BALL, n); G.add(pts); const ghost = inst(BALL, n, { opacity: 0.18 }); ghost.material.color.setHex(0x8e9bb8); G.add(ghost);
    /* the hand: a small cloud around each control point, FPS'd to a few control points */
    const r = PT.rng(9), hand = []; for (let i = 0; i < 140; i++) { const a = r() * 2 * PI, b = Math.acos(2 * r() - 1), rr = 0.42 * Math.cbrt(r()); hand.push([rr * Math.sin(b) * Math.cos(a) * 0.8, rr * Math.cos(b) * 1.1, rr * Math.sin(b) * Math.sin(a) * 0.6]); }
    const sel = PT.fps(hand, 12); const hp = inst(BALL, hand.length); hp.material.color.setHex(COL.ctrl); G.add(hp); const hc = inst(BALL, sel.length); hc.material.color.setHex(0xffffff); hc.material.emissive.setHex(0xaa2244); G.add(hc);
    const trk = [12, 60, 101, 150, 190, 230].filter(i => i < n && info[i].surf).slice(0, 5); const trails = trk.map(() => pline(G, 40, COL.align, { opacity: 0.9 }));
    const st = dynLab(G, [-3.6, 3.6, -2], { size: 17 });
    const ctls = [{ label: '相机', items: ['1', '2', '3', '合并'], get: () => cam, set: k => { cam = k; } }];
    return { ctls, update(p) {
      const k = Math.round(p * 300), V = cam === 3 ? any : vis[cam], cc = cam === 3 ? null : hex3(COL.cam[cam]);
      for (let i = 0; i < n; i++) { const q = at(R.X, k, n, i); setI(ghost, i, q, 0.05); if (V[i]) { setI(pts, i, q, 0.055); colI(pts, i, cc || hex3(COL.cam[vis[0][i] ? 0 : vis[1][i] ? 1 : 2])); } else setI(pts, i, [0, -80, 0], 0.0001); }
      done(pts); done(ghost);
      const c = at(R.CP, k, M.nC, 0), showF = p > 0.25, nsel = Math.min(sel.length, Math.max(0, Math.floor(seg(p, 0.25, 0.6) * sel.length)));
      hand.forEach((h, i) => setI(hp, i, add3(c, [h[0] + 0.25, h[1], h[2]]), 0.03)); done(hp);
      sel.forEach((si, j) => setI(hc, j, j < nsel ? add3(c, [hand[si][0] + 0.25, hand[si][1], hand[si][2]]) : [0, -80, 0], j < nsel ? 0.07 : 0.0001)); done(hc);
      trk.forEach((i, j) => { const pts2 = []; for (let t = Math.max(0, k - 39); t <= k; t++) pts2.push(at(R.X, t, n, i)); trails[j].userData.set(pts2); trails[j].visible = p > 0.05; });
      const nv = V.filter(Boolean).length;
      st(`${cam === 3 ? '三台合并' : '相机 ' + (cam + 1)}：看到 ${nv} / ${nSurf} 个表面点（${(100 * nv / nSurf).toFixed(0)}%）`);
      cap(showF ? `粉色是手的点云（140 点），最远点采样已选 <b>${nsel}</b> / ${sel.length} 个控制点（代码选 30 个）；黄色线是跟踪点的轨迹` : `每台相机只看到朝向它的一面；灰色是被看不到的部分 · 覆盖率 <b>${(100 * nv / nSurf).toFixed(0)}%</b>`);
    } };
  }

  /* ---------- scene 3: shape prior and registration ---------- */
  function s3(G) {
    floorRect(G, 0, 0, 12, 9, COL.table);
    const P = PT.toyPts(), n = P.length, info = surfaceInfo(P), vis = [0, 1, 2].map(ci => camVis(P, info, ci)), obs = P.map((_, i) => vis.some(v => v[i]));
    const ctr = [0, 0.9, 0], camO = CAMS[0];
    const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, 0.9, -0.15)), sc0 = 0.72;
    const bend = P.map(p => (Math.abs(p[0]) > 0.5 ? [0, 0.35 * (Math.abs(p[0]) - 0.5), 0.25 * Math.sign(p[0]) * (Math.abs(p[0]) - 0.5)] : [0, 0, 0]));
    const po = inst(BALL, n); po.material.color.setHex(COL.obs); G.add(po); const pg = inst(BALL, n, { opacity: 0.85 }); pg.material.color.setHex(0xb8c0cc); G.add(pg);
    const views = []; for (let a = 0; a < 8; a++) for (let b = 0; b < 4; b++) { const az = a * PI / 4, el = -0.3 + b * 0.35, d = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)]; views.push(d); }
    const camDir = sub3(camO, ctr).map(x => x / len3(sub3(camO, ctr)));
    const trueDir = rotP(q0.clone().invert(), camDir);
    const score = views.map(d => Math.round(260 * Math.max(0, d[0] * trueDir[0] + d[1] * trueDir[1] + d[2] * trueDir[2]) ** 3));
    const best = score.indexOf(Math.max(...score));
    const vf = inst(BALL, views.length); G.add(vf); const rays = segs(G, 24, { opacity: 0.5 });
    const st = dynLab(G, [3.8, 3.6, -1.5], { size: 17 });
    G.add(lab('相机 1', [camO[0], camO[1] + 0.6, camO[2]], { size: 16, color: css(COL.cam[0]) })); const cf = frustum(G, COL.cam[0], 0.5); cf.position.set(...camO); cf.lookAt(...ctr); cf.rotateY(PI);
    return { update(p) {
      for (let i = 0; i < n; i++) setI(po, i, obs[i] ? P[i] : [0, -80, 0], obs[i] ? 0.05 : 0.0001); done(po);
      const uR = seg(p, 0.3, 0.45), uS = seg(p, 0.47, 0.62), uA = seg(p, 0.64, 0.78), qq = new THREE.Quaternion().slerpQuaternions(q0, new THREE.Quaternion(), uR);
      const lam = L.lerp(sc0, 1, uS);
      for (let i = 0; i < n; i++) { const b = bend[i].map(x => x * (1 - uA)); const w = add3(ctr, rotP(qq, add3(sub3(P[i], ctr), b)));
        /* depth error: every point sits on the right ray from camera 1 but at the wrong distance; one scalar fixes it */
        setI(pg, i, add3(camO, sub3(w, camO).map(t => t * lam)), 0.045); }
      done(pg);
      const showV = p > 0.12 && p < 0.32;
      views.forEach((d, j) => { const q = add3(ctr, d.map(x => x * 3.2)); setI(vf, j, showV ? q : [0, -80, 0], showV ? 0.06 + 0.12 * score[j] / 260 : 0.0001); colI(vf, j, j === best ? [1, 0.85, 0.3] : [0.5, 0.55, 0.65]); }); done(vf);
      rays.userData.clear(); if (p > 0.47 && p < 0.66) { for (let j = 0; j < 24; j++) { const i = (j * 37) % n; const w = add3(ctr, sub3(P[i], ctr)); rays.userData.set(j, camO, add3(camO, sub3(w, camO).map(t => t * 1.15)), hex3(COL.cam[0])); } } rays.userData.done();
      const step = p < 0.12 ? 0 : p < 0.3 ? 1 : p < 0.46 ? 2 : p < 0.63 ? 3 : p < 0.8 ? 4 : 5;
      st(['橙：三台相机的局部点云\n灰：TRELLIS 生成的完整形状', `32 个虚拟视角，球越大“匹配”越多\n最好的一个：${score[best]} 对`, 'PnP 精修旋转', '尺度：沿过相机 1 的射线滑动\n只解一个标量', 'ARAP：把弯掉的胳膊掰回来\n再做光线投射对齐', `体积采样 + 体素去重\n得到 ${n} 个质点`][step]);
      cap(['生成的形状和观测在朝向、尺度、局部姿态上都对不上', '在包围物体的球面上放虚拟相机渲染，用 SuperGlue 和观测匹配，选匹配最多的视角（示意）', '用 PnP 从匹配的 3D 点和 2D 像素解出精确旋转', 'PnP 之后匹配点在同一条过相机原点的射线上，所以平移和尺度合成一个标量', '剩下的非刚性差别用 ARAP 配准，最后从相机打光线检查遮挡关系', `表面和内部采样后按体素去重，这批点就是弹簧-质点模型的质点（代码：表面 1024 + 内部 10000 候选，5 mm 体素）`][step]);
    } };
  }

  /* ---------- scene 4: topology ---------- */
  function s4(G) {
    let ri = +(OPT[0] ?? 1), ki = +(OPT[1] ?? 2);
    floorRect(G, 0, 0, 8, 5, COL.table);
    const RS = [0.2, 0.26, 0.34], KS = [6, 12, 25], P = PT.toyPts(), n = P.length, o = OBJ.toy;
    const pts = inst(BALL, n); pts.material.color.setHex(COL.toy); G.add(pts); P.forEach((q, i) => setI(pts, i, q, 0.045)); done(pts);
    const maxS = PT.connect(P, 0.34, 25).springs.length, sp = segs(G, maxS + 10, { opacity: 0.85 });
    const cur = new THREE.Mesh(BALL, L.mat(0xffffff, { emissive: 0x666666 })); G.add(cur);
    const ball = new THREE.Mesh(BALL, L.mat(0x38d1ff, { opacity: 0.16, depthWrite: false })); G.add(ball);
    const cb = new THREE.Mesh(BALL, L.mat(COL.ctrl, { emissive: 0x551122 })); cb.scale.setScalar(0.1); cb.position.set(...o.hands[0]); G.add(cb);
    const csp = segs(G, 40, { opacity: 0.8 });
    const st = dynLab(G, [-2.4, 3.3, -1.2], { size: 18, border: 'rgba(79,201,138,.7)' });
    const ctls = [{ label: '半径', items: RS.map(x => String(x)), get: () => ri, set: k => { ri = k; } }, { label: '最大近邻数', items: KS.map(String), get: () => ki, set: k => { ki = k; } }];
    return { ctls, update(p) {
      const T = memo(`top|${ri}|${ki}`, () => { const t = PT.connect(P, RS[ri], KS[ki]); const order = t.springs.map(([a, b]) => Math.min(a, b)); const deg = new Array(n).fill(0); t.springs.forEach(([a, b]) => { deg[a]++; deg[b]++; }); return { t, order, deg }; });
      const upto = Math.floor(seg(p, 0.02, 0.8) * n), ci = Math.min(n - 1, upto);
      sp.userData.clear(); let shown = 0;
      T.t.springs.forEach(([a, b], s) => { if (T.order[s] <= upto) { const fresh = T.order[s] === ci && p < 0.8; sp.userData.set(s, P[a], P[b], fresh ? [1, 1, 1] : strainCol((T.t.L0[s] / RS[ri] - 0.6) * 0.15)); shown++; } }); sp.userData.done();
      cur.visible = ball.visible = p < 0.8; cur.position.set(...P[ci]); cur.scale.setScalar(0.08); ball.position.set(...P[ci]); ball.scale.setScalar(RS[ri]);
      const C = PT.connectCtrl(P, [o.hands[0]], o.cr, o.ck); csp.userData.clear(); if (p > 0.82) C.forEach(([c, j], s) => csp.userData.set(s, o.hands[0], P[j], hex3(COL.ctrl))); csp.userData.done(); cb.visible = p > 0.82;
      const mx = Math.max(...T.deg), iso = T.deg.filter(d => d === 0).length, avg = 2 * T.t.springs.length / n;
      st(`半径 ${RS[ri]} · 最大近邻 ${KS[ki]}\n${T.t.springs.length} 根弹簧 · 平均度数 ${avg.toFixed(1)}\n最大度数 ${mx} · 孤立点 ${iso}`);
      cap(p < 0.8 ? `第 <b>${ci + 1}</b> / ${n} 个点：找半径 ${RS[ri]} 内最近的至多 ${KS[ki]} 个点（含自己），去掉自己后连上没连过的 · 已有 <b>${shown}</b> 根` : `控制点（粉）用另一组参数连到物体：半径 ${o.cr}、至多 ${o.ck} 个 → <b>${C.length}</b> 根控制点弹簧 · 物体共 <b>${T.t.springs.length}</b> 根`);
    } };
  }

  /* ---------- scene 5: live spring-mass simulation ---------- */
  let LIVE = null;
  function s5(G) {
    let oi = +(OPT[0] ?? 2), ai = +(OPT[1] ?? 0), fi = +(OPT[2] ?? 0);
    const KEYS = ['rope', 'cloth', 'toy'];
    floorRect(G, 0, 0, 9, 7, COL.table); G.add(L.grid(9, 18));
    let view = null, vkey = '';
    const info = dynLab(G, [-2.6, 3.8, -1.8], { size: 17 });
    const ctls = [{ label: '物体', items: ['绳子', '布', '毛绒玩具'], get: () => oi, set: k => { oi = k; } }, { label: '动作', items: ACT, get: () => ai, set: k => { ai = k; } }, { label: '力', items: ['代码：应变', '论文：伸长量'], get: () => fi, set: k => { fi = k; } }];
    function ensure() {
      const key = `${oi}|${ai}|${fi}`; if (key === vkey) return; vkey = key; LIVE = null;
      if (view) { G.remove(view.g); L.dispose(view.g); }
      const g = new THREE.Group(); G.add(g); const run = objRun(KEYS[oi], ai, fi); const bv = bodyView(g, run.M, { color: OBJ[KEYS[oi]].color, r: OBJ[KEYS[oi]].nr });
      PICKS_CTRL.push(bv.cb); view = { g, run, bv };
    }
    const api = { ctls, drag: true, update(p) {
      ensure(); LIVE = null; const { run, bv } = view, R = run.R, k = Math.round(p * (R.frames - 1)); bv.draw(R.X, k, R.CP);
      const o = OBJ[KEYS[oi]]; let mx = 0; const n = run.M.P.length; for (let s = 0; s < run.M.S.length; s += 3) { const a = at(R.X, k, n, run.M.S[s][0]), b = at(R.X, k, n, run.M.S[s][1]); mx = Math.max(mx, Math.abs(len3(sub3(b, a)) / run.M.L0[s] - 1)); }
      info(`${o.name}：${n} 个质点 · ${run.M.S.length} 根弹簧\n${run.M.CS.length} 根控制点弹簧 · t = ${(k / 30).toFixed(1)} s`);
      cap(`${fi ? '论文式 k(|Δx| − l)，k = 平均 Y/l = ' + Math.round(run.prm.kPaper) : '代码式 Y(|Δx|/l − 1)，Y = ' + o.Y} · 最大应变约 <b>${(mx * 100).toFixed(0)}%</b> · 按住粉色球可以拖`);
    },
    startLive(k) { ensure(); const { run } = view, R = run.R, n = run.M.P.length; const x = Float64Array.from(R.X.subarray(k * n * 3, (k + 1) * n * 3)), v = new Float64Array(n * 3);
      const cp = Float64Array.from(R.CP.subarray(k * run.M.nC * 3, (k + 1) * run.M.nC * 3)); LIVE = { M: run.M, prm: Object.assign({}, run.prm, { dt: 1 / 600 }), x, v, cp, tgt: Float64Array.from(cp), f: new Float64Array(n * 3), X: new Float32Array(n * 3), CP: new Float32Array(run.M.nC * 3), view }; return LIVE; },
    tickLive() { if (!LIVE) return; const Lv = LIVE; for (let s = 0; s < 10; s++) { for (let q = 0; q < Lv.cp.length; q++) Lv.cp[q] += (Lv.tgt[q] - Lv.cp[q]) * 0.08; PT.substep(Lv.M, Lv.prm, Lv.x, Lv.v, Lv.cp, Lv.f); }
      Lv.X.set(Lv.x); Lv.CP.set(Lv.cp); Lv.view.bv.draw(Lv.X, 0, Lv.CP); cap('实时模式：拖着控制点走，模拟每帧跑 10 个子步（Δt = 1/600）· 拖进度条回到脚本动作'); } };
    return api;
  }

  /* ---------- scene 6: CMA-ES ---------- */
  const CMA_SET = { sp: 0.25, n: 16 };
  function cmaSetup() {
    return memo('cma', () => {
      const { sp, n } = CMA_SET, P = PT.chainPts(n, sp, 0.06);
      const ctrl = t => { const u = L.ease(clamp((t - 0.3) / 1.4, 0, 1)), w = Math.max(0, t - 1.7), m = Math.min(1, w); return [[P[0][0] - 0.12 + 0.8 * u + 0.5 * Math.sin(w * 2.5) * m, 0.06 + 2.6 * u, 0.4 * Math.sin(w * 2.5) * m]]; };
      const C0 = [[P[0][0] - 0.12, 0.06, 0]];
      const map = x => ({ Y: Math.exp(Math.log(100) + x[0] * Math.log(50)), r: sp * (1.05 + x[1] * 2.15), drag: 6 * x[2] });
      const sim = (p, frames = 75) => { const topo = PT.connect(P, p.r, 30), M = PT.model(P, topo, C0, 0.2, 1), prm = PT.uniform(M, p.Y, { c: 2, drag: p.drag, e: 0.2, mu: 0.6, sub: 24 }); prm.thc.fill(Math.log(p.Y)); return { M, R: PT.rollout(M, prm, ctrl, frames, 30) }; };
      const TRUE = [0.62, 0.55, 0.3], obs = sim(map(TRUE)).R;
      const loss = x => { const r = sim(map(x)).R; let s = 0; for (let i = 0; i < r.X.length; i += 3) s += Math.hypot(r.X[i] - obs.X[i], r.X[i + 1] - obs.X[i + 1], r.X[i + 2] - obs.X[i + 2]); const Lx = s / (r.X.length / 3); return isFinite(Lx) ? Math.min(Lx, 5) : 5; };
      const res = PT.cmaes(loss, [0.3, 0.2, 0.6], 1 / 6, 20, 42);
      const G = 16, grid = []; for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) grid.push(loss([i / (G - 1), TRUE[1], j / (G - 1)]));
      return { P, map, sim, TRUE, obs, res, grid, G };
    });
  }
  function s6(G) {
    const C = cmaSetup(), H = C.res.hist, SZ = 4, O = [-6.4, 0.2, -2], A = x => [O[0] + x[0] * SZ, O[1] + x[1] * SZ, O[2] + x[2] * SZ];
    const cube = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]].map(A); wire(G, cube, 0x8e9bb8, { opacity: 0.5 });
    [[[1, 0, 0], [1, 0, 1]], [[1, 1, 0], [1, 1, 1]], [[0, 1, 0], [0, 1, 1]]].forEach(([a, b]) => wire(G, [A(a), A(b)], 0x8e9bb8, { opacity: 0.5 }));
    G.add(lab('log 刚度 →', A([0.55, -0.12, 1.12]), { size: 16 }), lab('连接半径 ↑', A([-0.12, 1.08, 0]), { size: 16 }), lab('拖曳阻尼 →', A([1.15, -0.1, 0.5]), { size: 16 }));
    /* loss slice at the true radius, on the floor of the cube */
    const g = new THREE.PlaneGeometry(SZ, SZ, C.G - 1, C.G - 1), colA = new Float32Array(g.attributes.position.count * 3); const lmin = Math.min(...C.grid), lmax = Math.max(...C.grid);
    for (let v = 0; v < g.attributes.position.count; v++) { const i = v % C.G, j = Math.floor(v / C.G); const l = C.grid[i * C.G + (C.G - 1 - j)], t = Math.log(l / lmin) / Math.log(lmax / lmin), c = lossCol(1 - t); colA.set([c[0] * 0.8, c[1] * 0.8, c[2] * 0.8], v * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(colA, 3)); const pl = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })); pl.rotation.x = -PI / 2; pl.position.set(O[0] + SZ / 2, O[1] - 0.01, O[2] + SZ / 2); G.add(pl);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), L.mat(COL.obs, { emissive: 0x884400 })); star.position.set(...A(C.TRUE)); G.add(star);
    const pop = inst(BALL, 12); G.add(pop); const mean = new THREE.Mesh(BALL, L.mat(0xffffff, { emissive: 0x444444 })); mean.scale.setScalar(0.09); G.add(mean);
    const trail = pline(G, H.length, 0xffffff, { opacity: 0.7 });
    const ell = new THREE.Mesh(BALL, L.mat(COL.gs, { opacity: 0.14, depthWrite: false })); G.add(ell);
    /* rope view on the right */
    floorRect(G, 2.6, 0, 6, 4, COL.table);
    const n = C.P.length, ob = inst(BALL, n, { opacity: 0.45 }); ob.material.color.setHex(COL.obs); G.add(ob); const sm = inst(BALL, n); sm.material.color.setHex(COL.sim); G.add(sm);
    const curve = pline(G, H.length, COL.purple); const cAx = wire(G, [[0.3, 4.6, -1.6], [0.3, 3.2, -1.6], [4.8, 3.2, -1.6]], 0x8e9bb8, { opacity: 0.6 });
    G.add(lab('每代最好损失（对数）', [2.6, 5.0, -1.6], { size: 15 }));
    const st = dynLab(G, [-4.4, 5.4, -2], { size: 16, border: 'rgba(157,140,255,.7)' });
    const bestL = H.map(h => h.best.f), lb0 = Math.log(Math.min(...bestL)), lb1 = Math.log(Math.max(...bestL));
    curve.userData.set(bestL.map((l, i) => [0.3 + 4.5 * i / (H.length - 1), 3.2 + 1.4 * (Math.log(l) - lb0) / (lb1 - lb0 + 1e-9), -1.6]));
    const runs = {};
    const ropeOf = x => { const key = x.map(v => v.toFixed(4)).join(','); return runs[key] || (runs[key] = C.sim(C.map(x)).R); };
    return { update(p) {
      const gi = Math.min(H.length - 1, Math.floor(seg(p, 0, 0.9) * H.length)), h = H[gi];
      const fl = Math.max(...h.pop.map(q => q.f)), fm = Math.min(...h.pop.map(q => q.f));
      for (let i = 0; i < 12; i++) { if (i < h.pop.length) { setI(pop, i, A(h.pop[i].x), 0.09); colI(pop, i, lossCol(1 - (h.pop[i].f - fm) / (fl - fm + 1e-9))); } else setI(pop, i, [0, -80, 0], 0.0001); } done(pop);
      mean.position.set(...A(h.mean)); trail.userData.set(H.slice(0, gi + 1).map(q => A(q.mean)));
      const sd = PT.eig(h.C).D; ell.position.set(...A(h.mean)); ell.scale.set(SZ * h.sigma * sd[0], SZ * h.sigma * sd[1], SZ * h.sigma * sd[2]);
      const R = ropeOf(h.best.x), k = Math.floor((p * SCENES[5].dur * 30) % 75);
      for (let i = 0; i < n; i++) { const a = at(C.obs.X, k, n, i), b = at(R.X, k, n, i); setI(ob, i, [a[0] + 2.6, a[1], a[2]], 0.085); setI(sm, i, [b[0] + 2.6, b[1], b[2]], 0.07); } done(ob); done(sm);
      const d = C.map(h.best.x), t = C.map(C.TRUE), hops = r => Math.floor(r / CMA_SET.sp + 1e-9);
      st(`第 ${gi} 代 · 种群 ${C.res.lam} · σ = ${h.sigma.toFixed(3)}\n最好：Y ${Math.round(d.Y)}，半径 ${d.r.toFixed(2)}（连 ${hops(d.r)} 跳），阻尼 ${d.drag.toFixed(2)}\n真值：Y ${Math.round(t.Y)}，半径 ${t.r.toFixed(2)}（连 ${hops(t.r)} 跳），阻尼 ${t.drag.toFixed(2)}`);
      cap(`第 <b>${gi}</b> 代：最好损失 <b>${(h.best.f * 100).toFixed(2)}</b>（平均每点每帧的距离 ×100）· 共 ${gi * C.res.lam + 1} 次模拟 · 白球是均值，蓝色椭球是 σ·协方差`);
    } };
  }

  /* ---------- scene 7: first-order, per-spring stiffness ---------- */
  function fosSetup() {
    return memo('fos', () => {
      const N = 14, sp = 0.28, P = PT.chainPts(N, sp, 2.4), topo = PT.connect(P, sp * 2.1, 30);
      const C0 = [[P[0][0] - 0.15, 2.4, 0], [P[N - 1][0] + 0.15, 2.4, 0]], M = PT.model(P, topo, C0, 0.47, 2);
      const mk = (a1, a2) => t => [[C0[0][0] + 0.25 * Math.sin(t * a1[0]), 2.4 + 0.5 * Math.sin(t * a1[1]), 0.3 * Math.sin(t * a1[2])], [C0[1][0] - 0.25 + 0.25 * Math.cos(t * a2[0]), 2.4 + 0.35 * Math.sin(t * a2[1] + 0.7), -0.3 * Math.sin(t * a2[2])]];
      const ctrl = mk([1.1, 1.6, 0.9], [1.3, 2.3, 1.2]), ctrlNew = t => [[C0[0][0] + 0.5 * Math.sin(t * 2.2), 2.4 + 0.15 * Math.sin(t * 3.1), 0.5 * Math.sin(t * 1.7)], [C0[1][0] - 0.1, 2.4 - 0.4 * Math.sin(t * 1.4), 0.2 * Math.cos(t * 2.6)]];
      const fps = 30, F = 90, base = { c: 1.5, drag: 1.2, sub: 20, dt: 1 / 600, e: 0, mu: 0, ymax: 6000 };
      const trueY = M.S.map(([a, b]) => { const m = (a + b) / 2 / (N - 1); return m > 0.35 && m < 0.65 ? 150 : 1500; });
      const withY = Y => { const p = PT.uniform(M, 1000, base); p.th = Float64Array.from(Y.map(y => Math.log(y))); p.thc.fill(Math.log(3000)); return p; };
      const tp = withY(trueY), obs = PT.rollout(M, tp, ctrl, F, fps), n = N;
      const err = R => { const e = []; for (let k = 0; k < R.frames; k++) { let s = 0; for (let i = 0; i < n; i++) s += len3(sub3(at(R.X, k, n, i), at(obs.X, k, n, i))); e.push(s / n); } return e; };
      const ev = prm => { const r = PT.rollout(M, prm, ctrl, F, fps); return { r, e: err(r) }; };
      let g1 = null; for (const Y of [100, 200, 300, 500, 800, 1200, 2000, 3000]) { const p = PT.uniform(M, Y, base); p.thc.fill(Math.log(3000)); const r = ev(p), m = r.e.reduce((a, b) => a + b, 0) / F; if (!g1 || m < g1.m) g1 = { Y, m, p }; }
      const prm = PT.uniform(M, g1.Y, base); prm.thc.fill(Math.log(3000));
      const lr = 0.02, b1 = 0.9, b2 = 0.99, m1 = new Float64Array(M.S.length), v1 = new Float64Array(M.S.length); let t = 0; const train = Math.round(F * 0.7), iters = [];
      const first = ev(prm); iters.push({ th: Float64Array.from(prm.th), r: first.r, e: first.e, tl: null });
      let bestI = 0, bestTL = Infinity;
      for (let it = 0; it < 24; it++) {
        let st = PT.state(M), tot = 0;
        for (let k = 1; k < train; k++) { const cpP = PT.ctrlAt(ctrl, 2, (k - 1) / fps), cpT = PT.ctrlAt(ctrl, 2, k / fps), o = obs.X.subarray(k * n * 3, (k + 1) * n * 3);
          const g = PT.frameGrad(M, prm, st.x, st.v, cpP, cpT, o); tot += g.L; t++;
          for (let q = 0; q < M.S.length; q++) { m1[q] = b1 * m1[q] + (1 - b1) * g.gth[q]; v1[q] = b2 * v1[q] + (1 - b2) * g.gth[q] ** 2; prm.th[q] -= lr * (m1[q] / (1 - b1 ** t)) / (Math.sqrt(v1[q] / (1 - b2 ** t)) + 1e-8); }
          st = { x: g.x, v: g.v }; }
        const r = ev(prm), tl = tot / (train - 1); iters.push({ th: Float64Array.from(prm.th), r: r.r, e: r.e, tl }); if (tl < bestTL) { bestTL = tl; bestI = iters.length - 1; }
      }
      return { N, M, P, ctrl, ctrlNew, obs, trueY, iters, g1, train, F, fps, base, withY, err, bestI, tp };
    });
  }
  function s7(G) {
    const D = fosSetup(), M = D.M, n = D.N, I = D.iters;
    const ob = inst(BALL, n, { opacity: 0.45 }); ob.material.color.setHex(COL.obs); G.add(ob); const sm = inst(BALL, n); sm.material.color.setHex(COL.sim); G.add(sm);
    const sl = segs(G, M.S.length, { opacity: 0.85 }); const hb = inst(BALL, 2); hb.material.color.setHex(COL.ctrl); G.add(hb);
    const nS = M.S.length, bars = []; for (let s = 0; s < nS; s++) { const x = -3.6 + 7.2 * (s + 0.5) / nS; const a = block(0.11, 1, 0.11, COL.obs, [x - 0.06, 0, -1.4], { opacity: 0.7, edges: false }), b = block(0.11, 1, 0.11, COL.sim, [x + 0.06, 0, -1.4], { edges: false }); G.add(a, b); bars.push([a, b]); }
    const yh = y => 0.15 + 1.6 * Math.log(y / 80) / Math.log(7000 / 80);
    D.trueY.forEach((y, s) => { const h = yh(y); bars[s][0].scale.y = h; bars[s][0].position.y = 3.6 + h / 2; });
    G.add(lab('每根弹簧的刚度（对数高度）：橙 真值 / 蓝 估计', [0, 5.8, -1.4], { size: 16 }));
    const means = I.map(q => q.e.slice(0, D.train).reduce((a, b) => a + b, 0) / D.train), mx = Math.max(...means, D.g1.m), cv = pline(G, I.length, COL.purple);
    cv.userData.set(means.map((m, i) => [4.6 + 2.4 * i / (I.length - 1), 0.4 + 2.2 * m / mx, 0])); wire(G, [[4.6, 2.8, 0], [4.6, 0.4, 0], [7.1, 0.4, 0]], 0x8e9bb8, { opacity: 0.6 });
    wire(G, [[4.6, 0.4 + 2.2 * D.g1.m / mx, 0], [7.1, 0.4 + 2.2 * D.g1.m / mx, 0]], COL.obs, { dashed: true, opacity: 0.8, dash: 0.12, gap: 0.08 });
    G.add(lab('训练段平均跟踪误差 / 轮', [5.85, 3.2, 0], { size: 15 }));
    const mk = new THREE.Mesh(BALL, L.mat(0xffffff, { emissive: 0x666666 })); mk.scale.setScalar(0.07); G.add(mk);
    return { update(p) {
      const ii = Math.min(I.length - 1, Math.floor(seg(p, 0.02, 0.88) * I.length)), it = I[ii], k = Math.floor((p * SCENES[6].dur * 30) % D.F);
      for (let i = 0; i < n; i++) { setI(ob, i, at(D.obs.X, k, n, i), 0.085); setI(sm, i, at(it.r.X, k, n, i), 0.07); } done(ob); done(sm);
      M.S.forEach(([a, b], s) => sl.userData.set(s, at(it.r.X, k, n, a), at(it.r.X, k, n, b), strainCol(len3(sub3(at(it.r.X, k, n, b), at(it.r.X, k, n, a))) / M.L0[s] - 1))); sl.userData.done();
      for (let c = 0; c < 2; c++) setI(hb, c, at(it.r.CP, k, 2, c), 0.11); done(hb);
      for (let s = 0; s < nS; s++) { const h = yh(Math.min(6000, Math.exp(it.th[s]))); bars[s][1].scale.y = h; bars[s][1].position.y = 3.6 + h / 2; }
      mk.position.set(4.6 + 2.4 * ii / (I.length - 1), 0.4 + 2.2 * means[ii] / mx, 0);
      const midE = []; M.S.forEach(([a, b], s) => { const m = (a + b) / 2 / (n - 1); if (m > 0.35 && m < 0.65) { midE.push(Math.exp(it.th[s])); } });
      cap(`第 <b>${ii}</b> 轮${ii ? `（${D.train - 1} 帧、每帧一次 Adam）` : '：第一段的统一刚度 Y = ' + D.g1.Y} · 训练段误差 <b>${(means[ii] * 100).toFixed(2)}</b>（统一刚度 ${(D.g1.m * 100).toFixed(2)}，橙色虚线）· 中段刚度均值 <b>${Math.round(midE.reduce((a, b) => a + b, 0) / midE.length)}</b>（真值 150）`);
    } };
  }

  /* ---------- scene 8: collision parameters ---------- */
  function colSetup() {
    return memo('col', () => {
      const P = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) P.push([-2.4 + i * 0.2, 1.6 + j * 0.2, -0.3 + k * 0.2]);
      const M = PT.model(P, PT.connect(P, 0.3, 30), null), s0 = PT.state(M); for (let i = 0; i < P.length; i++) { s0.v[i * 3] = 2.2; s0.v[i * 3 + 1] = 1.0; s0.v[i * 3 + 2] = 0.3; }
      const run = (e, mu) => PT.rollout(M, PT.uniform(M, 3000, { c: 3, drag: 0.3, e, mu, sub: 20 }), null, 75, 30, s0);
      const obs = run(0.45, 0.35), loss = r => { let s = 0; for (let i = 0; i < r.X.length; i += 3) s += Math.hypot(r.X[i] - obs.X[i], r.X[i + 1] - obs.X[i + 1], r.X[i + 2] - obs.X[i + 2]); return s / (r.X.length / 3); };
      const E = [], U = []; for (let i = 0; i <= 40; i++) { const r = run(i / 40, 0.35); E.push({ v: i / 40, r, l: loss(r) }); } for (let i = 0; i <= 40; i++) { const r = run(0.45, i / 20); U.push({ v: i / 20, r, l: loss(r) }); }
      return { M, obs, E, U };
    });
  }
  function s8(G) {
    let mode = +(OPT[0] ?? 0);
    floorRect(G, 0.6, 0, 9, 5, COL.table); G.add(L.grid(9, 18));
    const D = colSetup(), n = D.M.P.length, cen = (X, k) => { let c = [0, 0, 0]; for (let i = 0; i < n; i++) c = add3(c, at(X, k, n, i)); return c.map(x => x / n); };
    const ob = inst(BALL, n, { opacity: 0.4 }); ob.material.color.setHex(COL.obs); G.add(ob); const sm = inst(BALL, n); sm.material.color.setHex(COL.sim); G.add(sm);
    const po = pline(G, 75, COL.obs, { opacity: 0.8 }), ps = pline(G, 75, COL.sim); po.userData.set(Array.from({ length: 75 }, (_, k) => cen(D.obs.X, k)));
    const X0 = 3.0, W = 3.4, Y0 = 2.6, Hh = 2.0, curve = pline(G, 41, COL.purple); wire(G, [[X0, Y0 + Hh, -1.8], [X0, Y0, -1.8], [X0 + W, Y0, -1.8]], 0x8e9bb8, { opacity: 0.6 });
    const mk = new THREE.Mesh(BALL, L.mat(0xffffff, { emissive: 0x666666 })); mk.scale.setScalar(0.07); G.add(mk); const tv = wire(G, [[0, 0, 0], [0, 1, 0]], COL.obs, { dashed: true, dash: 0.1, gap: 0.07, opacity: 0.9 });
    const ttl = dynLab(G, [X0 + W / 2, Y0 + Hh + 0.45, -1.8], { size: 15 }), ax0 = dynLab(G, [X0, Y0 - 0.35, -1.8], { size: 14 }), ax1 = dynLab(G, [X0 + W, Y0 - 0.35, -1.8], { size: 14 });
    const ctls = [{ label: '扫', items: ['地面弹性 e', '地面摩擦 μ'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const A = mode ? D.U : D.E, lm = Math.max(...A.map(a => a.l)), j = Math.min(40, Math.floor(seg(p, 0.02, 0.92) * 41)), a = A[j], k = Math.floor((p * SCENES[7].dur * 30) % 75);
      curve.userData.set(A.map((q, i) => [X0 + W * i / 40, Y0 + Hh * q.l / lm, -1.8])); mk.position.set(X0 + W * j / 40, Y0 + Hh * a.l / lm, -1.8);
      const tx = X0 + W * (mode ? 0.35 / 2 : 0.45); tv.geometry.setFromPoints([new THREE.Vector3(tx, Y0, -1.8), new THREE.Vector3(tx, Y0 + Hh, -1.8)]); tv.computeLineDistances();
      ttl(mode ? '损失 vs 摩擦 μ（e = 0.45）' : '损失 vs 弹性 e（μ = 0.35）'); ax0('0'); ax1(mode ? '2' : '1');
      for (let i = 0; i < n; i++) { setI(ob, i, at(D.obs.X, k, n, i), 0.07); setI(sm, i, at(a.r.X, k, n, i), 0.06); } done(ob); done(sm);
      ps.userData.set(Array.from({ length: 75 }, (_, q) => cen(a.r.X, q)));
      let jumps = 0; for (let i = 1; i < A.length; i++) if (Math.abs(A[i].l - A[i - 1].l) > 0.25 * lm) jumps++;
      cap(`${mode ? 'μ' : 'e'} = <b>${a.v.toFixed(mode ? 2 : 3)}</b> · 损失 <b>${(a.l * 100).toFixed(1)}</b>（真值处 0）· ${mode ? '摩擦曲线基本光滑，只在真值处有一个折角' : `弹性曲线有 ${jumps} 处大跳变：弹跳次数一变，后面整条轨迹都变`}`);
    } };
  }

  /* ---------- scene 9: Gaussians follow the particles (LBS) ---------- */
  function lbsSetup() {
    return memo('lbs', () => {
      const P = PT.clothPts({ n: 9, sp: 0.3, y: 0.03 }), M = PT.model(P, PT.connect(P, 0.45, 9), [[-1.32, 0.05, -1.32]], 0.25, 3), prm = PT.uniform(M, 1500, { c: 4, drag: 1.5, e: 0.2, mu: 0.8, sub: 20 });
      const R = PT.rollout(M, prm, t => { const u = L.ease(clamp((t - 0.4) / 2.2, 0, 1)), w = L.ease(clamp((t - 3.5) / 3, 0, 1)); return [[-1.32 + 0.9 * u + 0.6 * w, 0.05 + 2.4 * u, -1.32 + 0.4 * u + 1.2 * w]]; }, 241, 30);
      const n = P.length, nb = P.map((p, a) => P.map((q, b) => [b, PT.dist(p, q)]).filter(([b, d]) => b !== a && d < 0.45).map(([b]) => b));
      const r = PT.rng(31), NG = 180, gp = [], gq = []; for (let i = 0; i < NG; i++) { gp.push([(r() - 0.5) * 2.3, 0.05 + (r() - 0.5) * 0.02, (r() - 0.5) * 2.3]); gq.push(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * PI, 0))); }
      const K = 4, W = gp.map(p => { const d = P.map((q, k) => [k, PT.dist(p, q)]).sort((a, b) => a[1] - b[1]).slice(0, K), w = d.map(([, dd]) => 1 / (dd + 1e-6)), s = w.reduce((a, b) => a + b, 0); return d.map(([k], i) => [k, w[i] / s]); });
      /* chain the per-step update of eqs (5)-(8) frame by frame */
      const out = [{ c: gp.map(x => x.slice()), q: gq.map(x => x.clone()), qr: gq.map(x => x.clone()) }];
      for (let k = 1; k < R.frames; k++) {
        const prev = out[k - 1], Xp = i => at(R.X, k - 1, n, i), Xc = i => at(R.X, k, n, i);
        const Rk = P.map((_, a) => hornRot(nb[a].map(b => sub3(Xp(b), Xp(a))), nb[a].map(b => sub3(Xc(b), Xc(a)))));
        const c2 = [], q2 = [], qr2 = [];
        for (let g = 0; g < NG; g++) { let c = [0, 0, 0], qa = [0, 0, 0, 0]; const ref = Rk[W[g][0][0]];
          W[g].forEach(([kk, w]) => { const t = add3(rotP(Rk[kk], sub3(prev.c[g], Xp(kk))), Xc(kk)); c = add3(c, t.map(x => x * w)); const q = Rk[kk], sg = (q.x * ref.x + q.y * ref.y + q.z * ref.z + q.w * ref.w) < 0 ? -1 : 1; qa[0] += w * sg * q.x; qa[1] += w * sg * q.y; qa[2] += w * sg * q.z; qa[3] += w * sg * q.w; });
          const qb = new THREE.Quaternion(qa[0], qa[1], qa[2], qa[3]).normalize(); c2.push(c); q2.push(prev.q[g].clone()); qr2.push(qb.multiply(prev.qr[g].clone())); }
        out.push({ c: c2, q: q2, qr: qr2 });
      }
      /* local cloth normal near each gaussian (from its nearest node's neighbours) */
      const normal = (k, g) => { const a = W[g][0][0], nn = nb[a]; let N = [0, 0, 0]; const pa = at(R.X, k, n, a); for (let i = 0; i < nn.length; i++) for (let j = i + 1; j < nn.length; j++) { const u = sub3(at(R.X, k, n, nn[i]), pa), v = sub3(at(R.X, k, n, nn[j]), pa); const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const s = c[1] >= 0 ? 1 : -1; N = add3(N, c.map(x => x * s)); } const l = len3(N); return l > 1e-9 ? N.map(x => x / l) : [0, 1, 0]; };
      return { M, R, out, NG, normal };
    });
  }
  function s9(G) {
    let shp = +(OPT[0] ?? 0), rot = +(OPT[1] ?? 0);
    floorRect(G, 0, 0, 7, 6, COL.table);
    const D = lbsSetup(), bv = bodyView(G, D.M, { color: COL.spring, r: 0.04, sOpacity: 0.4 }); const gim = inst(BALL, D.NG, { opacity: 0.92 }); G.add(gim);
    const ax = segs(G, D.NG, { opacity: 0.8 }); const r = PT.rng(5), cols = Array.from({ length: D.NG }, () => { const c = hex3(COL.cloth); const j = 0.75 + 0.4 * r(); return [c[0] * j, c[1] * j, c[2] * j]; });
    const ttl = dynLab(G, [0, 3.6, -2.2], { size: 18, border: 'rgba(56,209,255,.7)' });
    const ctls = [{ label: '高斯', items: ['各向同性（论文）', '各向异性'], get: () => shp, set: k => { shp = k; } }, { label: '朝向', items: ['跟着转（式 7）', '不转（只移中心）'], get: () => rot, set: k => { rot = k; } }];
    return { ctls, update(p) {
      const k = Math.min(D.R.frames - 1, Math.round(p * (D.R.frames - 1))), o = D.out[k]; bv.draw(D.R.X, k, D.R.CP);
      let ang = 0;
      for (let g = 0; g < D.NG; g++) { const q = rot ? o.q[g] : o.qr[g]; setI(gim, g, o.c[g], shp ? [0.17, 0.025, 0.1] : 0.09, q); colI(gim, g, cols[g]);
        const nv = new THREE.Vector3(0, 1, 0).applyQuaternion(q); const N = D.normal(k, g); ang += Math.acos(clamp(Math.abs(nv.x * N[0] + nv.y * N[1] + nv.z * N[2]), 0, 1));
        ax.userData.set(g, o.c[g], add3(o.c[g], [nv.x * 0.18, nv.y * 0.18, nv.z * 0.18]), shp ? hex3(COL.gs) : [0, 0, 0]); }
      done(gim); ax.userData.done(); ax.visible = shp === 1;
      ttl(`${shp ? '各向异性' : '各向同性'} · ${rot ? '不转朝向' : '式 (7) 转朝向'}`);
      const a = ang / D.NG * 180 / PI;
      cap(shp ? `椭球法向和布面法向的平均夹角 <b>${a.toFixed(1)}°</b>${rot && a > 20 ? ' · 椭球不再贴着布面' : ''}` : `各向同性的球没有朝向可言：转不转看起来一样（论文的选择，也避免了变形时的尖刺）· t = ${(k / 30).toFixed(1)} s`);
    } };
  }

  /* ---------- scene 10: prediction toy + paper tables ---------- */
  const TAB = {
    metrics: ['CD↓', '跟踪↓', 'IoU%↑', 'PSNR↑', 'SSIM↑', 'LPIPS↓'], low: [1, 1, 0, 0, 0, 1],
    t1r: [['Spring-Gaus', [0.041, 0.050, 57.6, 23.445, 0.928, 0.102]], ['GS-Dynamics', [0.014, 0.022, 72.1, 26.260, 0.940, 0.052]], ['PhysTwin', [0.005, 0.009, 84.4, 28.214, 0.945, 0.034]]],
    t1f: [['Spring-Gaus', [0.062, 0.094, 46.4, 22.488, 0.924, 0.113]], ['GS-Dynamics', [0.041, 0.070, 49.8, 22.540, 0.924, 0.097]], ['PhysTwin', [0.012, 0.022, 72.5, 25.617, 0.941, 0.055]]],
    t2: [['GS-Dynamics', [0.029, 0.038, 63.4, 25.053, 0.934, 0.067]], ['PhysTwin', [0.013, 0.018, 72.18, 26.199, 0.938, 0.047]]],
    t3r: [['只用零阶', [0.007, 0.012, 80.2, 27.409, 0.943, 0.039]], ['只用一阶', [0.008, 0.012, 82.7, 27.913, 0.944, 0.037]], ['PhysTwin', [0.005, 0.009, 84.4, 28.214, 0.945, 0.034]]],
    t3f: [['只用零阶', [0.014, 0.025, 69.2, 25.008, 0.938, 0.061]], ['只用一阶', [0.019, 0.034, 65.7, 24.572, 0.936, 0.067]], ['PhysTwin', [0.012, 0.022, 72.5, 25.617, 0.941, 0.055]]]
  };
  function s10(G) {
    let view = +(OPT[0] ?? 0);
    const D = fosSetup(), M = D.M, n = D.N, best = D.iters[D.bestI];
    const runs = memo('pred', () => { const p2 = D.withY(Array.from(best.th, x => Math.exp(x))), p1 = PT.uniform(M, D.g1.Y, D.base); p1.thc.fill(Math.log(3000));
      const obsN = PT.rollout(M, D.tp, D.ctrlNew, D.F, D.fps); const e = (R, O) => Array.from({ length: R.frames }, (_, k) => { let s = 0; for (let i = 0; i < n; i++) s += len3(sub3(at(R.X, k, n, i), at(O.X, k, n, i))); return s / n; });
      const a = PT.rollout(M, p2, D.ctrl, D.F, D.fps), b = PT.rollout(M, p1, D.ctrl, D.F, D.fps), c = PT.rollout(M, p2, D.ctrlNew, D.F, D.fps), d = PT.rollout(M, p1, D.ctrlNew, D.F, D.fps);
      return { a, b, c, d, obsN, ea: e(a, D.obs), eb: e(b, D.obs), ec: e(c, obsN), ed: e(d, obsN) }; });
    const toy = new THREE.Group(), tab = new THREE.Group(); G.add(toy, tab);
    const ob = inst(BALL, n, { opacity: 0.45 }); ob.material.color.setHex(COL.obs); toy.add(ob); const s2 = inst(BALL, n); s2.material.color.setHex(COL.sim); toy.add(s2); const s1x = inst(BALL, n, { opacity: 0.7 }); s1x.material.color.setHex(COL.purple); toy.add(s1x);
    const X0 = -3.8, W = 8, Y0 = -0.2, Hh = 1.6, emax = Math.max(...runs.eb, ...runs.ed, ...runs.ea, ...runs.ec);
    wire(toy, [[X0, Y0 + Hh, 0], [X0, Y0, 0], [X0 + W, Y0, 0]], 0x8e9bb8, { opacity: 0.6 }); const cA = pline(toy, D.F, COL.sim), cB = pline(toy, D.F, COL.purple);
    const split = wire(toy, [[X0 + W * 0.7, Y0, 0], [X0 + W * 0.7, Y0 + Hh, 0]], COL.align, { dashed: true, dash: 0.1, gap: 0.07, opacity: 0.9 });
    toy.add(lab('训练段 70%', [X0 + W * 0.35, Y0 + Hh + 0.3, 0], { size: 14 }), lab('预测段 30%', [X0 + W * 0.85, Y0 + Hh + 0.3, 0], { size: 14 }));
    toy.add(lab('蓝：两段优化后  紫：只用统一刚度  橙：观测', [0, 4.1, 0], { size: 15 }));
    const mk = new THREE.Mesh(BALL, L.mat(0xffffff, { emissive: 0x666666 })); mk.scale.setScalar(0.06); toy.add(mk);
    /* tables as bars */
    const bars = []; for (let m = 0; m < 6; m++) for (let r = 0; r < 3; r++) { const b = block(0.36, 1, 0.36, 0xffffff, [0, 0, 0], { edges: false }); tab.add(b); bars.push(b); }
    TAB.metrics.forEach((t, m) => tab.add(lab(t, [-5.2 + m * 2.1, -0.55, 0], { size: 15 })));
    const leg = dynLab(tab, [0, 4.4, 0], { size: 16 });
    let vg = null, vkey = '';
    const MC = { 'Spring-Gaus': COL.sg, 'GS-Dynamics': COL.gsd, PhysTwin: COL.pt, '只用零阶': COL.purple, '只用一阶': COL.align };
    const ctls = [{ label: '视图', items: ['玩具：同一动作', '玩具：新动作', '表 1 重建', '表 1 预测', '表 2 新交互', '表 3 重建', '表 3 预测'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      const isToy = view < 2; toy.visible = isToy; tab.visible = !isToy;
      if (isToy) {
        const nw = view === 1, A = nw ? runs.c : runs.a, B = nw ? runs.d : runs.b, O = nw ? runs.obsN : D.obs, ea = nw ? runs.ec : runs.ea, eb = nw ? runs.ed : runs.eb, k = Math.min(D.F - 1, Math.floor(p * D.F));
        for (let i = 0; i < n; i++) { const o = at(O.X, k, n, i); setI(ob, i, [o[0], o[1] + 1.0, o[2]], 0.085); const a = at(A.X, k, n, i); setI(s2, i, [a[0], a[1] + 1.0, a[2]], 0.07); const b = at(B.X, k, n, i); setI(s1x, i, [b[0], b[1] + 1.0, b[2] + 0.02], 0.055); } done(ob); done(s2); done(s1x);
        cA.userData.set(ea.map((e, q) => [X0 + W * q / (D.F - 1), Y0 + Hh * e / emax, 0])); cB.userData.set(eb.map((e, q) => [X0 + W * q / (D.F - 1), Y0 + Hh * e / emax, 0])); split.visible = !nw;
        mk.position.set(X0 + W * k / (D.F - 1), Y0 + Hh * ea[k] / emax, 0);
        const mean = (e, a, b) => e.slice(a, b).reduce((x, y) => x + y, 0) / (b - a), tr = D.train;
        cap(nw ? `新动作（训练时没见过）：两段优化后平均误差 <b>${(mean(ea, 0, D.F) * 100).toFixed(2)}</b>，只用统一刚度 <b>${(mean(eb, 0, D.F) * 100).toFixed(2)}</b>（×100，玩具单位）`
          : `训练段误差 两段 <b>${(mean(ea, 0, tr) * 100).toFixed(2)}</b> / 统一 ${(mean(eb, 0, tr) * 100).toFixed(2)} · 预测段 两段 <b>${(mean(ea, tr, D.F) * 100).toFixed(2)}</b> / 统一 ${(mean(eb, tr, D.F) * 100).toFixed(2)}（×100）`);
      } else {
        const T = [TAB.t1r, TAB.t1f, TAB.t2, TAB.t3r, TAB.t3f][view - 2], nm = T.length, g = seg(p, 0.05, 0.4), H = [];
        for (let m = 0; m < 6; m++) { const vals = T.map(r => r[1][m]), mx = Math.max(...vals), mn = Math.min(...vals);
          for (let r = 0; r < 3; r++) { const b = bars[m * 3 + r]; if (r >= nm) { b.visible = false; continue; } b.visible = true;
            const v = T[r][1][m], base = TAB.low[m] ? v / mx : (v - mn * 0.9) / (mx - mn * 0.9 + 1e-9), hf = 0.2 + 2.8 * base, h = Math.max(0.02, hf * g);
            const x = -5.2 + m * 2.1 + (r - (nm - 1) / 2) * 0.5; b.scale.y = h; b.position.set(x, h / 2, 0); b.material.color.setHex(MC[T[r][0]]); b.userData.c = hex3(MC[T[r][0]]); glow(b, T[r][0] === 'PhysTwin' ? 0.25 : 0);
            H.push([x, hf, v, r]); } }
        const key = view + '|' + (p > 0.4);
        if (key !== vkey) { vkey = key; if (vg) { LABS = LABS.filter(x => !vg.children.includes(x)); tab.remove(vg); L.dispose(vg); } vg = new THREE.Group(); tab.add(vg);
          if (p > 0.4) H.forEach(([x, hf, v, r]) => vg.add(lab(String(v), [x, hf + 0.3 + (r % 2) * 0.32, 0], { size: 12 }))); }
        leg(T.map(r => r[0]).join('  ·  '));
        cap(['', '', '表 1 重建与重新模拟（论文原数）', '表 1 未来预测（论文原数）', '表 2 对未见交互的泛化（论文原数）', '表 3 消融：重建段（论文原数）', '表 3 消融：预测段（论文原数）'][view] + ' · 越低越好的指标按“值 / 最大值”画，越高越好的按相对差画，只看同一指标内的相对大小');
      }
    } };

  }

  /* ---------- scene 11: teleop and planning ---------- */
  let KEYS_DOWN = new Set();
  function s11(G) {
    let mode = +(OPT[0] ?? 0);
    floorRect(G, 0, 0, 10, 7, COL.table); G.add(L.grid(10, 20));
    const tele = new THREE.Group(), plan = new THREE.Group(); G.add(tele, plan);
    const run = objRun('toy', 1, 0), bv = bodyView(tele, run.M, { color: COL.toy, r: 0.065 }); /* act 1 = two hands */
    tele.add(lab('手 1：W/S/A/D/E/Q', [2.6, 3.4, 0], { size: 15, color: css(COL.ctrl) }), lab('手 2：I/K/J/L/O/U', [-2.6, 3.4, 0], { size: 15, color: css(COL.ctrl) }));
    /* MPC by random shooting on the chain rope of scene 7 (lying on the table here) */
    const MP = memo('mpc', () => {
      const N = 14, sp = 0.28, P = PT.chainPts(N, sp, 0.06), topo = PT.connect(P, sp * 2.1, 30), C0 = [[P[0][0] - 0.15, 0.06, 0]], M = PT.model(P, topo, C0, 0.3, 1);
      const D = fosSetup(), trueP = PT.uniform(M, 1000, { c: 1.5, drag: 1.2, e: 0.2, mu: 0.7, sub: 20, ymax: 6000 }), modelP = PT.uniform(M, D.g1.Y, { c: 1.5, drag: 1.2, e: 0.2, mu: 0.7, sub: 20, ymax: 6000 });
      trueP.th = Float64Array.from(M.S.map(([a, b]) => { const m = (a + b) / 2 / (N - 1); return Math.log(m > 0.35 && m < 0.65 ? 150 : 1500); })); trueP.thc.fill(Math.log(3000)); modelP.thc.fill(Math.log(3000));
      const goal = [1.2, 0.06, 1.6], r = PT.rng(77), cand = [];
      const mk = (w1, w2) => t => { const u = L.ease(clamp((t - 0.2) / 1.2, 0, 1)), v = L.ease(clamp((t - 1.4) / 1.2, 0, 1)); const a = [C0[0][0] + (w1[0] - C0[0][0]) * u, 0.06 + (w1[1] - 0.06) * u, (w1[2]) * u]; return [[a[0] + (w2[0] - w1[0]) * v, a[1] + (w2[1] - w1[1]) * v, a[2] + (w2[2] - w1[2]) * v]]; };
      for (let i = 0; i < 24; i++) { const w1 = [-2 + 2.5 * r(), 0.6 + 1.4 * r(), -1 + 2.5 * r()], w2 = [-1.5 + 2.5 * r(), 0.15 + 0.5 * r(), -0.5 + 2.2 * r()], ctrl = mk(w1, w2), R = PT.rollout(M, modelP, ctrl, 100, 30);
        const end = at(R.X, R.frames - 1, N, N - 1), cost = len3(sub3([end[0], 0, end[2]], [goal[0], 0, goal[2]])); cand.push({ w1, w2, ctrl, R, cost }); }
      cand.sort((a, b) => a.cost - b.cost); const best = cand[0], real = PT.rollout(M, trueP, best.ctrl, 100, 30), endR = at(real.X, 99, N, N - 1);
      return { N, M, cand, best, real, goal, realCost: len3(sub3([endR[0], 0, endR[2]], [goal[0], 0, goal[2]])) };
    });
    const pv = bodyView(plan, MP.M, { color: COL.rope, r: 0.07 }); const gm = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 24), L.mat(COL.ok, { emissive: 0x115533 })); gm.position.set(MP.goal[0], 0.02, MP.goal[2]); plan.add(gm);
    const paths = MP.cand.map((c, i) => { const l = pline(plan, 100, i === 0 ? COL.sim : 0x8e9bb8, { opacity: i === 0 ? 1 : 0.35 }); l.userData.set(Array.from({ length: 100 }, (_, k) => at(c.R.X, k, MP.N, MP.N - 1))); return l; });
    const ctls = [{ label: '应用', items: ['键盘交互', 'MPC 规划'], get: () => mode, set: k => { mode = k; } }];
    const api = { ctls, keys: true, update(p) {
      tele.visible = mode === 0; plan.visible = mode === 1; LIVE = null;
      if (mode === 0) { const R = run.R, k = Math.round(p * (R.frames - 1)); bv.draw(R.X, k, R.CP); cap('脚本：两只手把玩具拉开再放回 · 按 W/S/A/D/E/Q 或 I/K/J/L/O/U 进入实时键盘控制'); }
      else { const ph = seg(p, 0, 0.35), k = Math.round(seg(p, 0.35, 0.95) * 99); paths.forEach((l, i) => { l.visible = i < Math.ceil(ph * 24) || p > 0.35; });
        pv.draw(p < 0.35 ? MP.cand[Math.min(23, Math.floor(ph * 24))].R.X : MP.real.X, p < 0.35 ? 99 : k, p < 0.35 ? MP.cand[Math.min(23, Math.floor(ph * 24))].R.CP : MP.real.CP);
        cap(p < 0.35 ? `在孪生里试第 <b>${Math.min(24, Math.ceil(ph * 24))}</b> / 24 条轨迹 · 目前最好的终点误差 ${MP.cand.slice(0, Math.max(1, Math.ceil(ph * 24))).reduce((a, c) => Math.min(a, c.cost), 9).toFixed(2)}` : `在“真实”参数下执行最好的一条：孪生预测终点误差 <b>${MP.best.cost.toFixed(2)}</b>，真实执行 <b>${MP.realCost.toFixed(2)}</b>（孪生只有统一刚度，差一点）`); }
    },
    startLive() { const R = run.R, M = run.M, n = M.P.length, k = Math.round(pNow * (R.frames - 1)); const x = Float64Array.from(R.X.subarray(k * n * 3, (k + 1) * n * 3)), v = new Float64Array(n * 3);
      const cp = Float64Array.from(R.CP.subarray(k * 6, (k + 1) * 6));
      LIVE = { M, prm: Object.assign({}, run.prm, { dt: 1 / 600 }), x, v, cp, tgt: Float64Array.from(cp), f: new Float64Array(n * 3), X: new Float32Array(n * 3), CP: new Float32Array(6), view: { bv } }; return LIVE; },
    tickLive() { if (!LIVE) return; const Lv = LIVE, mv = { w: [0, 0, -1], s: [0, 0, 1], a: [-1, 0, 0], d: [1, 0, 0], e: [0, 1, 0], q: [0, -1, 0] }, mv2 = { i: [0, 0, -1], k: [0, 0, 1], j: [-1, 0, 0], l: [1, 0, 0], o: [0, 1, 0], u: [0, -1, 0] };
      KEYS_DOWN.forEach(c => { if (mv[c]) for (let q = 0; q < 3; q++) Lv.tgt[q] += 0.02 * mv[c][q]; if (mv2[c]) for (let q = 0; q < 3; q++) Lv.tgt[3 + q] += 0.02 * mv2[c][q]; });
      for (let s = 0; s < 10; s++) { for (let q = 0; q < 6; q++) Lv.cp[q] += (Lv.tgt[q] - Lv.cp[q]) * 0.08; PT.substep(Lv.M, Lv.prm, Lv.x, Lv.v, Lv.cp, Lv.f); }
      Lv.X.set(Lv.x); Lv.CP.set(Lv.cp); Lv.view.bv.draw(Lv.X, 0, Lv.CP); cap('实时键盘控制：每帧 10 个子步 · 拖进度条回到脚本'); } };
    return api;
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player (same as interactives/phc, latent, real2sim-eval) ---------- */
  let cur = 0, api = null, playing = !L.reduced(), t0 = 0, pNow = 0, tw = null, OPT = [];
  const HOLD = 1.8;
  const aspectFix = () => { const el = $('stage'), asp = (el.clientWidth || 1) / (el.clientHeight || 1); return Math.min(2.2, Math.max(1, 1.45 / asp)); };
  function fly(th, ph, d, tg) {
    let dth = th - S.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth)); d *= aspectFix();
    tw = { t0: performance.now(), from: [S.theta, S.phi, S.dist, S.target.clone()], to: [S.theta + dth, ph, d, new THREE.Vector3(...tg)] };
    refDist = d;
  }
  function setPlay(on) { playing = on; $('play').textContent = on ? '❚❚ 暂停' : '▶ 播放'; $('play').setAttribute('aria-label', on ? '暂停' : '播放'); }
  function buildCtl() {
    const box = $('ctl'); box.innerHTML = ''; box.hidden = true; if (!api) return;
    (api.ctls || []).forEach((c, gi) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-g="${gi}" data-k="${k}" aria-pressed="${c.get() === k}">${t}</button>`).join('');
      box.appendChild(row); box.hidden = false;
    });
  }
  function syncCtl() { (api?.ctls || []).forEach((c, gi) => { $('ctl').querySelectorAll(`button[data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(c.get() === +b.dataset.k))); }); }
  function upd(p) { if (!api) return; LIVE = null; api.update(p); }
  function go(i, p0 = 0) {
    cur = (i + SCENES.length) % SCENES.length; showInfo(cur); LIVE = null; KEYS_DOWN.clear();
    if (api?.dispose) api.dispose();
    L.clear(root); LABS = []; PICKS = []; PICKS_CTRL.length = 0; lastCap = null;
    const sc = SCENES[cur]; fly(...sc.cam); refDist = sc.cam[2] * aspectFix();
    const G = new THREE.Group(); root.add(G); pNow = p0; api = BUILD[cur](G); OPT = [];
    buildCtl();
    t0 = performance.now() - p0 * sc.dur * 1000; try { upd(pNow); } catch (err) { document.title = 'ERR ' + err.stack.replace(/\n/g, ' | '); } $('scrub').value = Math.round(pNow * 1000);
  }
  S.onTick(() => {
    if (LIVE && api?.tickLive) api.tickLive();
    else if (playing && api) {
      const sc = SCENES[cur], el = (performance.now() - t0) / 1000;
      if (el > sc.dur + HOLD) { t0 = performance.now(); pNow = 0; } else pNow = Math.min(1, el / sc.dur);
      upd(pNow); $('scrub').value = Math.round(pNow * 1000);
    }
    if (tw) { const k = L.reduced() ? 1 : Math.min(1, (performance.now() - tw.t0) / 900), e = L.ease(k), a = tw.from, b = tw.to; S.setView(L.lerp(a[0], b[0], e), L.lerp(a[1], b[1], e), L.lerp(a[2], b[2], e), [L.lerp(a[3].x, b[3].x, e), L.lerp(a[3].y, b[3].y, e), L.lerp(a[3].z, b[3].z, e)]); if (k >= 1) tw = null; }
    const f = clamp(S.dist / refDist, 0.6, 1.6); for (const sp of LABS) sp.scale.copy(sp.userData.s0).multiplyScalar(f);
  });
  S.onClick(() => PICKS, hit => { const g = hit?.object?.userData?.go ?? hit?.object?.parent?.userData?.go; if (g != null) go(g); });
  S.onHover(() => PICKS.concat(PICKS_CTRL), hit => { $('stage').style.cursor = hit ? (PICKS_CTRL.includes(hit.object) ? 'grab' : 'pointer') : ''; });
  /* dragging a control point (scene 5): capture on the stage's parent so the orbit handler never sees the event */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let DRAG = null;
  $('stagebox').addEventListener('pointerdown', e => {
    if (!api?.drag || !PICKS_CTRL.length || e.target !== S.renderer.domElement) return;
    const hit = S.pick(e, PICKS_CTRL); if (!hit) return;
    e.stopPropagation(); e.preventDefault();
    const k = Math.round(pNow * 300), Lv = api.startLive(k), ci = hit.instanceId ?? 0;
    setPlay(false); const c = new THREE.Vector3(Lv.cp[ci * 3], Lv.cp[ci * 3 + 1], Lv.cp[ci * 3 + 2]);
    const nrm = new THREE.Vector3(); S.cam.getWorldDirection(nrm); DRAG = { ci, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(nrm, c) };
    $('stage').style.cursor = 'grabbing';
  }, true);
  window.addEventListener('pointermove', e => {
    if (!DRAG || !LIVE) return; const r = S.renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, S.cam); const q = new THREE.Vector3(); if (ray.ray.intersectPlane(DRAG.plane, q)) { q.y = Math.max(0.05, q.y); LIVE.tgt[DRAG.ci * 3] = q.x; LIVE.tgt[DRAG.ci * 3 + 1] = q.y; LIVE.tgt[DRAG.ci * 3 + 2] = q.z; }
  });
  window.addEventListener('pointerup', () => { if (DRAG) { DRAG = null; $('stage').style.cursor = ''; } });
  $('ctl').addEventListener('click', e => { const b = e.target.closest('button[data-g]'); if (!b || !api?.ctls) return; const c = api.ctls[+b.dataset.g]; c.set(+b.dataset.k); upd(pNow); $('scrub').value = Math.round(pNow * 1000); syncCtl(); });
  $('play').onclick = () => { if (!playing) t0 = performance.now() - pNow * SCENES[cur].dur * 1000; LIVE = null; setPlay(!playing); };
  $('scrub').oninput = e => { setPlay(false); pNow = e.target.value / 1000; upd(pNow); syncCtl(); };
  $('prev').onclick = () => go(cur - 1); $('next').onclick = () => go(cur + 1);
  btns.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); });
  stepsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; go(+b.dataset.i); if (!document.body.classList.contains('embed')) $('stage').scrollIntoView({ behavior: L.reduced() ? 'auto' : 'smooth', block: 'center' }); });
  const TELE = 'wsadeqikjlou';
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' && e.key !== ' ') return;
    const c = e.key.toLowerCase();
    if (api?.keys && TELE.includes(c) && c.length === 1) { e.preventDefault(); if (!LIVE) { setPlay(false); api.startLive(); } KEYS_DOWN.add(c); return; }
    if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1); else if (e.key === ' ') { e.preventDefault(); $('play').click(); }
  });
  document.addEventListener('keyup', e => KEYS_DOWN.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => KEYS_DOWN.clear());
  const s0 = clamp((parseInt(qs.get('scene'), 10) || 1) - 1, 0, SCENES.length - 1), pq = qs.get('p'); OPT = (qs.get('opt') || '').split(',').filter(x => x !== '');
  setPlay(playing && pq == null);
  go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0));
  window.__ptDebug = { PT, cmaSetup, fosSetup, colSetup, get cap() { return $('cap').textContent; } };
})();
