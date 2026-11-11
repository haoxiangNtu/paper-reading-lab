'use strict';
/* RGBench (arXiv 2511.06434) taken apart into eleven animated scenes.
   Table 3, Table 1, Tables 4/5 and the Figure 4 readings are the paper's numbers (Fig. 4 read from the vector drawing).
   Scenes 4–9 run a toy cloth simulator written for this page: Baraff–Witkin style triangle stretch/shear, isometric quadratic
   bending, implicit Euler as an energy minimisation (Eq. 5 with the velocity term), two inexact Newton steps with block-Jacobi PCG,
   penalty-potential ground and vertex–vertex self-contact. It is a toy and is labelled so; GarmentDynamics itself is not public.
   Every scene's update(p) is a pure function of the timeline p plus the current toggles (simulations are precomputed per toggle). */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const PI = Math.PI;
  const COL = { data: 0x38d1ff, sim: 0x5b8bd6, real: 0xeef2fa, ours: 0x3987e5, pyb: 0xc98500, isaac: 0x199e70, mujoco: 0xd95926, warn: 0xff7a59, ok: 0x4fc98a, bad: 0xe05d5d,
    table: 0x262b36, plate: 0xd8dde8, dim: 0x46506a, white: 0xeef2fa, gold: 0xf2c14e, purple: 0x9d8cff, silk: 0xd8a8d8, cotton: 0x4fa37a, leather: 0x8a5a3a, seamA: 0xff6b9a, seamB: 0x38d1ff, seamC: 0x9d8cff, seamD: 0x4fc98a, hem: 0xf2c14e };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  // ---8<--- CLOTH
  const CLOTH = (function () {
    const n = 11, size = 0.5, a = size / (n - 1), N = n * n, id = (i, j) => j * n + i;
    const rest = []; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) rest.push([i * a - size / 2, j * a - size / 2]);
    const tris = [];
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const v00 = id(i, j), v10 = id(i + 1, j), v01 = id(i, j + 1), v11 = id(i + 1, j + 1);
      if ((i + j) % 2 === 0) { tris.push([v00, v10, v11], [v00, v11, v01]); } else { tris.push([v00, v10, v01], [v10, v11, v01]); }
    }
    /* Baraff–Witkin style shape functions: w_u = sum du_i x_i, w_v = sum dv_i x_i */
    const T = tris.map(t => {
      const [p0, p1, p2] = t.map(k => rest[k]);
      const d1u = p1[0] - p0[0], d2u = p2[0] - p0[0], d1v = p1[1] - p0[1], d2v = p2[1] - p0[1];
      const det = d1u * d2v - d2u * d1v, m00 = d2v / det, m01 = -d2u / det, m10 = -d1v / det, m11 = d1u / det;
      return { v: t, A: Math.abs(det) / 2, du: [-(m00 + m10), m00, m10], dv: [-(m01 + m11), m01, m11] };
    });
    const mass = new Float64Array(N); T.forEach(t => t.v.forEach(k => { mass[k] += t.A / 3; }));
    /* isometric quadratic bending (Bergou et al. 2006): E = 1/2 kb sum 3/(A0+A1) |sum K_i x_i|^2 */
    const em = new Map(); T.forEach((t, ti) => { for (let e = 0; e < 3; e++) { const p = t.v[e], q = t.v[(e + 1) % 3], o = t.v[(e + 2) % 3], key = Math.min(p, q) + ',' + Math.max(p, q); if (!em.has(key)) em.set(key, []); em.get(key).push({ p, q, o, ti }); } });
    const r3 = k => [rest[k][0], 0, rest[k][1]];
    const sub = (x, y) => [x[0] - y[0], x[1] - y[1], x[2] - y[2]], dot = (x, y) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
    const crs = (x, y) => [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
    const cot = (x, y) => dot(x, y) / Math.hypot(...crs(x, y));
    const B = [];
    em.forEach(L => { if (L.length !== 2) return; const x0 = r3(L[0].p), x1 = r3(L[0].q), x2 = r3(L[0].o), x3 = r3(L[1].o);
      const e0 = sub(x1, x0), e1 = sub(x2, x0), e2 = sub(x3, x0), e3 = sub(x2, x1), e4 = sub(x3, x1);
      const c01 = cot(e0, e1), c02 = cot(e0, e2), c03 = cot([-e0[0], -e0[1], -e0[2]], e3), c04 = cot([-e0[0], -e0[1], -e0[2]], e4);
      B.push({ v: [L[0].p, L[0].q, L[0].o, L[1].o], K: [c03 + c04, c01 + c02, -c01 - c03, -c02 - c04], w: 3 / (T[L[0].ti].A + T[L[1].ti].A) }); });
    const restDist = (i, j) => Math.hypot(rest[i][0] - rest[j][0], rest[i][1] - rest[j][1]);
    const PIN = [id(0, 0), id(n - 1, 0)];
    /* material table 3 (stretch g/s^2 -> N/m; bending scaled, see page; areal density g/m^2 -> kg/m^2) */
    const MAT = { silk: { k: 30, kb: 150 * 6e-7, rho: 0.060 }, cotton: { k: 1000, kb: 2800 * 6e-7, rho: 0.170 }, leather: { k: 1000, kb: 20000 * 6e-7, rho: 0.500 } };
    const sm = (t, a0, b0) => { const x = Math.max(0, Math.min(1, (t - a0) / (b0 - a0))); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
    /* scripted gripper paths (offsets from the rest corner, metres) and release time */
    function action(kind, t) {
      if (kind === 'grasp') { const s = sm(t, 0.3, 1.5); return { d: [0, 0.42 * s, 0.04 * s], on: true }; }
      if (kind === 'fling') { const s1 = sm(t, 0.1, 0.9), s2 = sm(t, 1.0, 1.45), s3 = sm(t, 1.45, 2.1); return { d: [0, 0.42 * s1 + 0.05 * s2 - 0.36 * s3, -0.08 * s1 + 0.38 * s2 - 0.12 * s3], on: t < 2.25 }; }
      const s1 = sm(t, 0.2, 0.5), s2 = sm(t, 0.5, 2.0), s3 = sm(t, 2.0, 2.3);
      return { d: [0, 0.05 * s1 + 0.08 * Math.sin(Math.PI * s2) - 0.04 * s3, (size - 0.03) * s2], on: true };
    }
    function simulate(o) {
      const M = MAT[o.mat], k = M.k, ks = 0.1 * k, kb = M.kb, fps = 30, sub = o.sub || 4, h = 1 / (fps * sub), Tend = o.T || 3, ncg = o.ncg || 30;
      const fr = o.fric ?? 0.05, m = Float64Array.from(mass, x => x * M.rho), g = -9.8, dh = 0.004, kc = 3000, rr = 0.014, kp = 400, katt = o.attach === 'spring' ? 10 : 0;
      const x = new Float64Array(3 * N), v = new Float64Array(3 * N);
      for (let i = 0; i < N; i++) { x[3 * i] = rest[i][0]; x[3 * i + 1] = 0.006; x[3 * i + 2] = rest[i][1]; }
      const base = PIN.map(p => [x[3 * p], x[3 * p + 1], x[3 * p + 2]]);
      const frames = [Float32Array.from(x)], res = [0], tgt = [base.map(b => b.slice())];
      const xt = new Float64Array(3 * N), gr = new Float64Array(3 * N), r = new Float64Array(3 * N), z = new Float64Array(3 * N), pd = new Float64Array(3 * N), Ap = new Float64Array(3 * N), dx = new Float64Array(3 * N);
      const Dinv = new Float64Array(9 * N), fixed = new Uint8Array(N);
      let exploded = -1, pairs = [], lastRes = 0, capt = null;
      const nF = Math.round(Tend * fps);
      /* per-linearisation caches */
      const tc = T.map(() => ({ wu: [0, 0, 0], wv: [0, 0, 0], nu: [0, 0, 0], nv: [0, 0, 0], lu: 1, lv: 1 }));
      function linearise(X) {
        T.forEach((t, ti) => { const c = tc[ti]; for (let d = 0; d < 3; d++) { let su = 0, sv = 0; for (let q = 0; q < 3; q++) { su += t.du[q] * X[3 * t.v[q] + d]; sv += t.dv[q] * X[3 * t.v[q] + d]; } c.wu[d] = su; c.wv[d] = sv; }
          c.lu = Math.hypot(...c.wu) || 1e-9; c.lv = Math.hypot(...c.wv) || 1e-9; for (let d = 0; d < 3; d++) { c.nu[d] = c.wu[d] / c.lu; c.nv[d] = c.wv[d] / c.lv; } });
      }
      function grad(X, out, tg, on) {
        out.fill(0);
        T.forEach((t, ti) => { const c = tc[ti], A = t.A, fu = k * A * (c.lu - 1), fv = k * A * (c.lv - 1), sh = ks * A * dot(c.wu, c.wv);
          for (let q = 0; q < 3; q++) { const b = 3 * t.v[q]; for (let d = 0; d < 3; d++) out[b + d] += fu * t.du[q] * c.nu[d] + fv * t.dv[q] * c.nv[d] + sh * (t.du[q] * c.wv[d] + t.dv[q] * c.wu[d]); } });
        B.forEach(e => { const s = [0, 0, 0]; for (let q = 0; q < 4; q++) for (let d = 0; d < 3; d++) s[d] += e.K[q] * X[3 * e.v[q] + d]; const w = kb * e.w; for (let q = 0; q < 4; q++) for (let d = 0; d < 3; d++) out[3 * e.v[q] + d] += w * e.K[q] * s[d]; });
        for (let i = 0; i < N; i++) { const y = X[3 * i + 1]; if (y < dh) out[3 * i + 1] -= kc * (dh - y); }
        pairs.forEach(P => { const [i, j] = P, dv3 = [X[3 * i] - X[3 * j], X[3 * i + 1] - X[3 * j + 1], X[3 * i + 2] - X[3 * j + 2]], dd = Math.hypot(...dv3); if (dd >= rr || dd < 1e-9) { P[2] = null; return; } const nn = dv3.map(q => q / dd); P[2] = nn; for (let d = 0; d < 3; d++) { out[3 * i + d] -= kp * (rr - dd) * nn[d]; out[3 * j + d] += kp * (rr - dd) * nn[d]; } });
        if (katt && on) PIN.forEach((p, a0) => { for (let d = 0; d < 3; d++) out[3 * p + d] += katt * (X[3 * p + d] - tg[a0][d]); });
      }
      function hv(X, p, out, on) {
        out.fill(0);
        T.forEach((t, ti) => { const c = tc[ti], A = t.A; let su = 0, sv = 0, ss = 0;
          for (let q = 0; q < 3; q++) { const b = 3 * t.v[q]; for (let d = 0; d < 3; d++) { su += t.du[q] * c.nu[d] * p[b + d]; sv += t.dv[q] * c.nv[d] * p[b + d]; ss += (t.du[q] * c.wv[d] + t.dv[q] * c.wu[d]) * p[b + d]; } }
          for (let q = 0; q < 3; q++) { const b = 3 * t.v[q]; for (let d = 0; d < 3; d++) out[b + d] += k * A * (su * t.du[q] * c.nu[d] + sv * t.dv[q] * c.nv[d]) + ks * A * ss * (t.du[q] * c.wv[d] + t.dv[q] * c.wu[d]); } });
        B.forEach(e => { const s = [0, 0, 0]; for (let q = 0; q < 4; q++) for (let d = 0; d < 3; d++) s[d] += e.K[q] * p[3 * e.v[q] + d]; const w = kb * e.w; for (let q = 0; q < 4; q++) for (let d = 0; d < 3; d++) out[3 * e.v[q] + d] += w * e.K[q] * s[d]; });
        for (let i = 0; i < N; i++) { if (X[3 * i + 1] < dh) out[3 * i + 1] += kc * p[3 * i + 1]; for (let d = 0; d < 3; d++) out[3 * i + d] += m[i] / (h * h) * p[3 * i + d]; }
        pairs.forEach(P => { if (!P[2]) return; const [i, j, nn] = P; let s = 0; for (let d = 0; d < 3; d++) s += nn[d] * (p[3 * i + d] - p[3 * j + d]); for (let d = 0; d < 3; d++) { out[3 * i + d] += kp * s * nn[d]; out[3 * j + d] -= kp * s * nn[d]; } });
        if (katt && on) PIN.forEach(q => { for (let d = 0; d < 3; d++) out[3 * q + d] += katt * p[3 * q + d]; });
      }
      function precond(X, on) {
        const D = new Float64Array(9 * N);
        for (let i = 0; i < N; i++) { const md = m[i] / (h * h); D[9 * i] += md; D[9 * i + 4] += md; D[9 * i + 8] += md; if (X[3 * i + 1] < dh) D[9 * i + 4] += kc; }
        T.forEach((t, ti) => { const c = tc[ti], A = t.A; for (let q = 0; q < 3; q++) { const b = 9 * t.v[q]; for (let r0 = 0; r0 < 3; r0++) for (let c0 = 0; c0 < 3; c0++) { const gs = t.du[q] * c.wv[r0] + t.dv[q] * c.wu[r0], gs2 = t.du[q] * c.wv[c0] + t.dv[q] * c.wu[c0]; D[b + 3 * r0 + c0] += k * A * (t.du[q] * t.du[q] * c.nu[r0] * c.nu[c0] + t.dv[q] * t.dv[q] * c.nv[r0] * c.nv[c0]) + ks * A * gs * gs2; } } });
        B.forEach(e => { const w = kb * e.w; for (let q = 0; q < 4; q++) { const b = 9 * e.v[q], kk = w * e.K[q] * e.K[q]; D[b] += kk; D[b + 4] += kk; D[b + 8] += kk; } });
        pairs.forEach(P => { if (!P[2]) return; const [i, j, nn] = P; for (const q of [i, j]) for (let r0 = 0; r0 < 3; r0++) for (let c0 = 0; c0 < 3; c0++) D[9 * q + 3 * r0 + c0] += kp * nn[r0] * nn[c0]; });
        if (katt && on) PIN.forEach(q => { D[9 * q] += katt; D[9 * q + 4] += katt; D[9 * q + 8] += katt; });
        for (let i = 0; i < N; i++) { const s = D.subarray(9 * i, 9 * i + 9), [a0, b0, c0, d0, e0, f0, g0, h0, i0] = s, det = a0 * (e0 * i0 - f0 * h0) - b0 * (d0 * i0 - f0 * g0) + c0 * (d0 * h0 - e0 * g0);
          const inv = [e0 * i0 - f0 * h0, c0 * h0 - b0 * i0, b0 * f0 - c0 * e0, f0 * g0 - d0 * i0, a0 * i0 - c0 * g0, c0 * d0 - a0 * f0, d0 * h0 - e0 * g0, b0 * g0 - a0 * h0, a0 * e0 - b0 * d0].map(q => q / det); Dinv.set(inv, 9 * i); }
      }
      const applyP = (src, dst) => { for (let i = 0; i < N; i++) { if (fixed[i]) { dst[3 * i] = dst[3 * i + 1] = dst[3 * i + 2] = 0; continue; } const D = Dinv.subarray(9 * i, 9 * i + 9), s0 = src[3 * i], s1 = src[3 * i + 1], s2 = src[3 * i + 2]; dst[3 * i] = D[0] * s0 + D[1] * s1 + D[2] * s2; dst[3 * i + 1] = D[3] * s0 + D[4] * s1 + D[5] * s2; dst[3 * i + 2] = D[6] * s0 + D[7] * s1 + D[8] * s2; } };
      const dotv = (p, q) => { let s = 0; for (let i = 0; i < p.length; i++) s += p[i] * q[i]; return s; };
      let step = 0;
      for (let f = 1; f <= nF; f++) {
        let tg = null, on = true;
        for (let s = 0; s < sub; s++) {
          const t = (step + 1) * h; step++;
          const ac = action(o.action, t); on = ac.on; tg = base.map(b => [b[0] + ac.d[0], b[1] + ac.d[1], b[2] + ac.d[2]]);
          const hard = on && !katt; fixed.fill(0); if (hard) PIN.forEach(p => { fixed[p] = 1; });
          if (exploded >= 0) continue;
          /* self-contact candidate pairs (vertex–vertex, toy) */
          pairs = [];
          for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { if (restDist(i, j) < 0.12) continue; const dx0 = x[3 * i] - x[3 * j], dy0 = x[3 * i + 1] - x[3 * j + 1], dz0 = x[3 * i + 2] - x[3 * j + 2]; if (dx0 * dx0 + dy0 * dy0 + dz0 * dz0 < 4 * rr * rr) pairs.push([i, j, null]); }
          if (o.integ === 'exp') {
            linearise(x); grad(x, gr, tg, on);
            for (let i = 0; i < N; i++) for (let d = 0; d < 3; d++) { const q = 3 * i + d; v[q] += h * (-gr[q] / m[i] + (d === 1 ? g : 0)); }
            for (let i = 0; i < N; i++) { if (fixed[i]) { const a0 = PIN.indexOf(i); for (let d = 0; d < 3; d++) { v[3 * i + d] = (tg[a0][d] - x[3 * i + d]) / h; } } for (let d = 0; d < 3; d++) x[3 * i + d] += h * v[3 * i + d]; }
          } else {
            for (let i = 0; i < N; i++) for (let d = 0; d < 3; d++) { const q = 3 * i + d; xt[q] = x[q] + h * v[q] + (d === 1 ? h * h * g : 0); }
            const x0 = Float64Array.from(x);
            for (let i = 0; i < N; i++) { if (fixed[i]) { const a0 = PIN.indexOf(i); for (let d = 0; d < 3; d++) x[3 * i + d] = tg[a0][d]; } else for (let d = 0; d < 3; d++) x[3 * i + d] = xt[3 * i + d]; }
            for (let nt = 0; nt < (o.newton || 2); nt++) {
              linearise(x); grad(x, gr, tg, on);
              for (let i = 0; i < N; i++) for (let d = 0; d < 3; d++) { const q = 3 * i + d; r[q] = fixed[i] ? 0 : -(gr[q] + m[i] / (h * h) * (x[q] - xt[q])); }
              if (o.capture === f && s === 0 && nt === 0 && !capt) { const n3 = 3 * N, A = new Float64Array(n3 * n3), e = new Float64Array(n3), col = new Float64Array(n3);
                for (let c0 = 0; c0 < n3; c0++) { e.fill(0); e[c0] = 1; hv(x, e, col, on); for (let r1 = 0; r1 < n3; r1++) A[r1 * n3 + c0] = col[r1]; }
                for (let i = 0; i < N; i++) if (fixed[i]) for (let d = 0; d < 3; d++) { const q = 3 * i + d; for (let c0 = 0; c0 < n3; c0++) { A[q * n3 + c0] = 0; A[c0 * n3 + q] = 0; } A[q * n3 + q] = 1; }
                capt = { A, r: Float64Array.from(r), m: Float64Array.from(m), h, fixed: Uint8Array.from(fixed) }; }
              precond(x, on); dx.fill(0); applyP(r, z); pd.set(z); let rz = dotv(r, z); const r0n = Math.sqrt(dotv(r, r)) || 1;
              for (let it = 0; it < ncg; it++) { hv(x, pd, Ap, on); for (let i = 0; i < N; i++) if (fixed[i]) Ap[3 * i] = Ap[3 * i + 1] = Ap[3 * i + 2] = 0; const al = rz / (dotv(pd, Ap) || 1e-30);
                for (let q = 0; q < 3 * N; q++) { dx[q] += al * pd[q]; r[q] -= al * Ap[q]; } applyP(r, z); const rz2 = dotv(r, z); const be = rz2 / (rz || 1e-30); rz = rz2; for (let q = 0; q < 3 * N; q++) pd[q] = z[q] + be * pd[q]; }
              lastRes = Math.sqrt(dotv(r, r)) / r0n;
              for (let q = 0; q < 3 * N; q++) x[q] += dx[q];
            }
            for (let q = 0; q < 3 * N; q++) v[q] = (x[q] - x0[q]) / h;
          }
          for (let i = 0; i < N; i++) if (x[3 * i + 1] < dh * 1.5) { v[3 * i] *= fr; v[3 * i + 2] *= fr; }
          let bad = false; for (let q = 0; q < 3 * N; q++) if (!(Math.abs(x[q]) < 4)) { bad = true; break; }
          if (bad) { exploded = f; x.set(frames[frames.length - 1]); }
        }
        frames.push(Float32Array.from(x)); res.push(lastRes); tgt.push(tg.map(q => q.slice()));
      }
      return { frames, res, tgt, exploded, h, fps, sub, ncg, capt, on: f => action(o.action, f / fps).on };
    }
    /* max edge strain of a frame (for labels) */
    function strain(X) { let mx = 0; T.forEach(t => { for (let e = 0; e < 3; e++) { const p = t.v[e], q = t.v[(e + 1) % 3]; const L0 = restDist(p, q), L1 = Math.hypot(X[3 * p] - X[3 * q], X[3 * p + 1] - X[3 * q + 1], X[3 * p + 2] - X[3 * q + 2]); mx = Math.max(mx, L1 / L0 - 1); } }); return mx; }
    return { n, N, size, a, rest, tris, T, B, mass, PIN, MAT, simulate, strain, id };
  })();

  // ---8<--- PCG
  /* dense PCG with three preconditioners on a captured Newton system (scene 6) */
  const PCGLAB = (function () {
    function gaussJordanInv(M, n) { const A = Float64Array.from(M), I = new Float64Array(n * n); for (let i = 0; i < n; i++) I[i * n + i] = 1;
      for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r * n + c]) > Math.abs(A[p * n + c])) p = r;
        if (p !== c) for (let k = 0; k < n; k++) { let t = A[c * n + k]; A[c * n + k] = A[p * n + k]; A[p * n + k] = t; t = I[c * n + k]; I[c * n + k] = I[p * n + k]; I[p * n + k] = t; }
        const d = A[c * n + c]; for (let k = 0; k < n; k++) { A[c * n + k] /= d; I[c * n + k] /= d; }
        for (let r = 0; r < n; r++) if (r !== c) { const f = A[r * n + c]; if (!f) continue; for (let k = 0; k < n; k++) { A[r * n + k] -= f * A[c * n + k]; I[r * n + k] -= f * I[c * n + k]; } } }
      return I; }
    /* A for another step size: H + M/h'^2 (pinned rows stay identity) */
    function withStep(c, h2) { const n = c.r.length, A = Float64Array.from(c.A); for (let i = 0; i < n / 3; i++) { if (c.fixed[i]) continue; const dm = c.m[i] / (h2 * h2) - c.m[i] / (c.h * c.h); for (let d = 0; d < 3; d++) A[(3 * i + d) * n + 3 * i + d] += dm; } return A; }
    function makePre(kind, A, n, grid) {
      if (kind === 0) return r => Float64Array.from(r);
      if (kind === 1) { const inv = []; for (let i = 0; i < n / 3; i++) { const b = new Float64Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) b[3 * r + c] = A[(3 * i + r) * n + 3 * i + c]; inv.push(gaussJordanInv(b, 3)); }
        return r => { const z = new Float64Array(n); inv.forEach((B, i) => { for (let a = 0; a < 3; a++) { let s = 0; for (let c = 0; c < 3; c++) s += B[3 * a + c] * r[3 * i + c]; z[3 * i + a] = s; } }); return z; }; }
      /* two-level additive Schwarz: non-overlapping 4x4-vertex subdomains (exact block inverses, Gauss–Jordan) + one coarse level (one 3-DOF supernode per subdomain) */
      const g = grid, nb = Math.ceil(g / 4), blocks = [];
      for (let bj = 0; bj < nb; bj++) for (let bi = 0; bi < nb; bi++) { const v = []; for (let j = bj * 4; j < Math.min(g, bj * 4 + 4); j++) for (let i = bi * 4; i < Math.min(g, bi * 4 + 4); i++) v.push(j * g + i); blocks.push(v); }
      const binv = blocks.map(v => { const m = 3 * v.length, S = new Float64Array(m * m); for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) S[a * m + b] = A[(3 * v[Math.floor(a / 3)] + a % 3) * n + 3 * v[Math.floor(b / 3)] + b % 3]; return gaussJordanInv(S, m); });
      const nc = 3 * blocks.length, of = new Int32Array(n / 3); blocks.forEach((v, b) => v.forEach(q => { of[q] = b; }));
      const Ac = new Float64Array(nc * nc); for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const a = A[r * n + c]; if (!a) continue; const R = 3 * of[Math.floor(r / 3)] + r % 3, C = 3 * of[Math.floor(c / 3)] + c % 3; Ac[R * nc + C] += a; }
      const Acinv = gaussJordanInv(Ac, nc);
      return r => { const z = new Float64Array(n);
        blocks.forEach((v, b) => { const m = 3 * v.length, Bi = binv[b]; for (let a = 0; a < m; a++) { let s = 0; for (let c = 0; c < m; c++) s += Bi[a * m + c] * r[3 * v[Math.floor(c / 3)] + c % 3]; z[3 * v[Math.floor(a / 3)] + a % 3] += s; } });
        const rc = new Float64Array(nc); for (let q = 0; q < n; q++) rc[3 * of[Math.floor(q / 3)] + q % 3] += r[q];
        for (let a = 0; a < nc; a++) { let s = 0; for (let c = 0; c < nc; c++) s += Acinv[a * nc + c] * rc[c]; for (let q = 0; q < n / 3; q++) if (of[q] === Math.floor(a / 3)) z[3 * q + a % 3] += s; }
        return z; };
    }
    function run(A, b, pre, iters) {
      const n = b.length, x = new Float64Array(n), r = Float64Array.from(b), Ap = new Float64Array(n), dot = (p, q) => { let s = 0; for (let i = 0; i < n; i++) s += p[i] * q[i]; return s; };
      let z = pre(r), p = Float64Array.from(z), rz = dot(r, z); const r0 = Math.sqrt(dot(r, r)), hist = [1];
      for (let it = 0; it < iters; it++) { for (let i = 0; i < n; i++) { let s = 0; const o = i * n; for (let j = 0; j < n; j++) s += A[o + j] * p[j]; Ap[i] = s; }
        const al = rz / dot(p, Ap); for (let i = 0; i < n; i++) { x[i] += al * p[i]; r[i] -= al * Ap[i]; } hist.push(Math.max(1e-16, Math.sqrt(dot(r, r)) / r0)); z = pre(r); const rz2 = dot(r, z), be = rz2 / rz; rz = rz2; for (let i = 0; i < n; i++) p[i] = z[i] + be * p[i]; }
      return hist;
    }
    return { withStep, makePre, run, gaussJordanInv };
  })();


  const SCENES = [
    { n: 1, part: '总览', title: '三样东西：衣物网格库、模拟器、用真实点云打分的协议', sub: '图 2 的 3D 版；点方块跳到对应那一幕', dur: 12, cam: [0.2, 1.0, 30, [0, 1.6, 0]],
      html: dl([['数据集', '6k+ 衣物网格：4k+ 工业资产（带测得参数）+ 2k+ ClothesNet'], ['模拟器', 'GarmentDynamics：三角 FEM + 隐式欧拉 + 不精确牛顿 + MAS 预条件 PCG + 势能接触'], ['真实采集', '两台 Piper 机械臂 + 一台 RealSense，9 件衣物'], ['动作', 'grasp、fling、fold，回放录下的轨迹'], ['指标', 'CD、HD，sim→real 和 real→sim 两个方向，L1']]) +
        '<p>RGBench 评测的是<b>布料模拟器</b>：同一段机器人动作，真实世界拍成点云，仿真里回放一遍，比两者的几何距离。论文里没有训练或评测任何操作策略。</p>' +
        '<p>GarmentDynamics 没有公开；公开的是评测代码（MIT）、真实采集数据（CC BY 4.0）和一部分资产（非商业许可）。</p>' + src('图 2 · 引言贡献列表 · 代码 README') },
    { n: 2, part: '数据集', title: '衣物网格库：10 种面料，111 个子类型，参数照表 3', sub: '切换柱子代表的量；拉伸和弯曲刚度用对数高度', dur: 11, cam: [0.35, 1.08, 26, [0.5, 2.2, 0]],
      html: dl([['工业资产', '4k+，版片 DXF 1:1 建模，有缝线、弹性边、折边，带测得参数'], ['ClothesNet', '2k+，11 个类别（含帽子、口罩、手套、袜子）'], ['测量', '拉伸仪 SST1000、弯曲仪 SBE1000，ASTM D1388 / D3107'], ['真实衣物', '9 件采点云；表 4、5 只有 7 件（两件网格非流形）'], ['公开', 'HF garment_assets 研究子集，约 509 件 OBJ，非商业许可']]) +
        '<p>柱子是论文表 3 的数字。棉和皮革的拉伸刚度相同（10⁶ g/s²），弯曲刚度差 7 倍；毛皮的拉伸刚度最高。</p>' +
        '<p>弯曲刚度的单位写成 g·m²/s²/rad，按字面棉是 2.8 N·m，比常见面料大五六个数量级，更像 g·mm²（精读页读者注 13，我的推断）。</p>' + src('§RGBench Dataset · 附录 A.1、A.2 · 表 3 · 图 3') },
    { n: 3, part: '数据集', title: '工业资产的版片：同色边缝在一起，黄色是折边', sub: '版片从平面立起来，配对的缝线靠拢', dur: 12, cam: [0.35, 1.0, 13, [0, 1.4, 0]],
      html: dl([['版片', '生产用 DXF 导入，1:1 尺寸'], ['缝线', '同色一对，缝合后限制该处拉伸'], ['黄色边', '弹性边（弹性长度比）或折边（折角，降低该处弯曲刚度）'], ['网格', '后处理成水密网格'], ['例外', '公开代码说两件真实衣物网格非流形，三个基线都加载不了']]) +
        '<p>这是附录 A.3 和图 8 讲的“可生产特征”。版片和缝线决定衣服怎么连起来，也决定仿真里哪里能拉、哪里好折。</p>' +
        guess('版片形状、颜色配对和“立起来”的动作都是我画的，只为说明配对缝线的意思；不是论文图 8 的版片，也不是缝制模拟。') + src('附录 A.3 · 图 8 · 图 9') },
    { n: 4, part: 'GarmentDynamics', title: '当场模拟一块布：隐式欧拉，每步解一次能量最小化', sub: '这一幕是核心。切换动作、材料、积分方式', dur: 12, cam: [0.55, 1.05, 13.5, [0, 1.3, 0]],
      html: dl([['单元', '线性三角形；拉伸 ½kA(|w_u|−1)²、½kA(|w_v|−1)²，剪切 ½k_sA(w_u·w_v)²（Baraff–Witkin 式）'], ['弯曲', '对曲率二次的等距弯曲能 ½k_b·3/(A₀+A₁)·|ΣKᵢxᵢ|²'], ['每一步', 'min ½h⁻²‖x−x̃‖²_M + E(x)，x̃ = xₜ + h vₜ + h²g'], ['求解', '不精确牛顿 2 次，每次块 Jacobi PCG 30 步（论文：MAS 预条件，约 50 步）'], ['接触', '地面罚势能 + 顶点间势能（自碰撞的简化）']]) +
        '<p>粉色球是夹爪抓住的两个“肩部”顶点，按回放的轨迹移动（玩具里对折到最后不松手，因为网格太粗，松手后折痕会弹开）。切到“显式”：同样的步长 1/120 s，棉布第一帧就数值爆炸，这就是论文说要用隐式积分的原因。</p>' +
        '<p>材料切换用表 3 的比例：丝的拉伸刚度只有棉的 3%，所以甩起来会明显拉长；皮革弯曲刚度高，褶皱又大又圆。</p>' +
        toyb('11×11 个顶点、0.5 m 见方；拉伸刚度取表 3（g/s² 换成 N/m），剪切取它的 10%，弯曲取表 3 数值 × 6×10⁻⁷ N·m（绝对值是我设的）；面密度取表 3。自碰撞只有顶点对顶点。我的预条件器太弱，一次牛顿会发散，所以用两次。这些都不是 GarmentDynamics 的实现。') + src('§GarmentDynamics Design · 式 (5) · 附录 E.4 式 (6)(7) · 精读页读者注 5') },
    { n: 5, part: 'GarmentDynamics', title: '碰撞：BVH 宽相，势能接触，解缠兜底', sub: '切换“宽相”和“接触势能”', dur: 12, cam: [0.4, 1.0, 12, [0, 0.8, 0]],
      html: dl([['宽相', '三角形包围盒建 BVH，每个粒子或单元发一条“射线”，RTX 核做遍历和盒测试'], ['速度', '作者说每秒数百万次宽相测试'], ['响应', '势能接触力：距离进入阈值 d̂ 才有能量，越近越大'], ['兜底', '碰撞解缠（Volino 2006）：极少触发，出现穿透时把它解开'], ['对比', 'PhysX 布料用逐粒子碰撞球，可能漏掉边-边接触']]) +
        '<p>左：一块已对折的布（第 4 幕的模拟结果）的三角形 BVH，逐层展开；层数越深，盒子越贴合。之后每个顶点沿法向发一条短探针，这是 RTX 宽相的意思。</p>' +
        '<p>右：两种势能随距离 d 的形状。罚势能在 d = 0 处仍是有限值，能被压穿；IPC 型的对数障碍在 d → 0 时趋于无穷，所以只要每步不跨过去，就不会穿透。论文没给他们用的具体势能形式。</p>' +
        guess('BVH 用中位数切分，盒子和探针都是示意；GarmentDynamics 的 BVH 结构、势能形式和 d̂ 论文都没给。势能曲线是两种常见形式的形状，单位任意。') + src('§Collision Detection · §Physical Properties and Interactions · 附录 E.4') },
    { n: 6, part: 'GarmentDynamics', title: 'PCG 的预条件器：为什么要多层', sub: '同一个牛顿方程组，三种预条件器的残差当场算；切换步长', dur: 12, cam: [0.0, 1.25, 17, [1.2, 2.0, 0]],
      html: dl([['方程组', '(M/h² + H)Δx = −∇L，式 (7)'], ['无预条件', 'CG 直接解'], ['块 Jacobi', '每个顶点 3×3 对角块求逆'], ['两层加性 Schwarz', '4×4 顶点的子域块精确求逆（Gauss–Jordan）+ 每个子域一个超节点的粗层'], ['MAS', '论文用的多层加性 Schwarz：多分辨率、不重叠子域、逐块无冲突，每块一个 GPU 线程']]) +
        '<p>方程组取自第 4 幕棉布甩动第 40 帧的状态（363 个未知数），三条线是相对残差随迭代数下降。两层加性 Schwarz 是 MAS 的最简版本：子域内精确，粗层负责把信息一次传遍整块布。</p>' +
        '<p>把步长从 1/120 s 改成 1/30 s，质量项 M/h² 变小，刚度占主导，方程组更难解，块 Jacobi 落得更远。这就是大步长隐式积分需要好预条件器的原因。</p>' +
        toyb('只有两层，子域 4×4 顶点，没有 GPU；这是 MAS 的思路，不是 Wu 等人（2022）的实现。残差是页面当场算的。') + src('§Multilevel Preconditioning · 附录 E.4 · Wu、Wang、Wang 2022') },
    { n: 7, part: '真实测量', title: '真实那一边：两台机械臂、一台相机、模板和时延', sub: '切换时延补偿，看 CD 怎样变', dur: 13, cam: [0.75, 1.0, 22, [0, 1.6, -1]],
      html: dl([['世界系', '原点在两机械臂基座中点，基座在 ±0.25 m'], ['初始位姿', '模板摆放：[0.1, 0, 0.01, 1, 0, 0, 0]'], ['相机', 'RealSense（论文 L515，代码文档 D455），约 2 m'], ['标定', '手眼标定 AX = XB，再用 ICP 细化'], ['分割', 'Grounded-SAM'], ['时延', '每个样本一个固定值，多为 0.06 s（约一帧）']]) +
        '<p>白点是相机拍到的点云：只有朝相机那一面，还带噪声。相机流比真实时间晚一点，直接拿来和同一时刻的仿真比，甩动时就会多出一截误差；把流往前挪一个固定时延，误差就回到噪声水平。</p>' +
        '<p>右边两条线是逐帧的 CD<sub>r2s</sub>：红色不补偿，蓝色补偿。</p>' +
        toyb('“真实”就是第 4 幕同一块棉布的甩动加 3 mm 噪声，延迟 2 帧（0.067 s）；单视角用 48×48 的深度格近似。只为说明时延补偿的作用，不是论文数据。') + src('附录 B.1–B.4 · 图 10–12 · 代码 experiment_library.yaml 的 camera_delay') },
    { n: 8, part: '指标', title: 'CD 和 HD，两个方向：为什么作者更看 real→sim', sub: '切换仿真状态和真实点云的来源；四个数当场算', dur: 12, cam: [0.5, 1.05, 12.5, [0, 1.6, 0]],
      html: dl([['CD_s2r', '每个仿真顶点到最近真实点的 L1 距离，求平均，式 (1)'], ['CD_r2s', '每个真实点到最近仿真顶点，求平均，式 (2)'], ['HD', '把平均换成最大，式 (3)(4)'], ['范数', '论文全用 L1；代码的 HD 用欧氏'], ['汇总', '评测窗内逐帧平均，再对 3 次采集平均']]) +
        '<p>红线连着 HD<sub>s2r</sub> 的最坏一对，蓝线连着 HD<sub>r2s</sub> 的最坏一对。</p>' +
        '<p>切到“膨胀”：仿真顶点乱飞，s2r 两个指标暴涨，r2s 涨得少，因为真实点总还能在附近找到某个仿真点。这就是作者说粒子类模拟器失稳会“污染” s2r 的意思。</p>' +
        '<p>切换“全表面”看另一面：单视角时，仿真里被挡住的那一面没有对应的真实点，s2r 天然偏大；论文没提这一点（精读页读者注 3）。</p>' +
        toyb('“真实”是第 4 幕的棉布抓起；“材料不对”用丝；“膨胀”是给每个顶点加最多 4 cm 的固定随机偏移。数值单位是米，量级和表 4 相近但不可比。') + src('§Eval Metrics 式 (1)–(4) · 代码 run_benchmark.py compute_cost') },
    { n: 9, part: '动作', title: '三个动作、两种模式；动作是回放的，不是策略', sub: '切换动作和模式，看夹爪和被抓的顶点', dur: 12, cam: [0.7, 1.0, 21, [0, 2.0, -1.2]],
      html: dl([['grasp', '平铺 → 抓肩部两点 → 竖直提起：考接触、摩擦、重力形变'], ['fling', '提在空中 → 快速前推再后拉：考惯性、空气阻力、大形变'], ['fold', '抓肩部 → 略提 → 平移到下摆：考自接触、层间摩擦、静置'], ['伪交互', '抓取时刻选离末端最近的顶点，直接拖着走（代码里是写死的 shoulder_index）'], ['机器人', 'URDF + 关节角，夹爪和布料靠接触；会打滑、穿透'], ['策略', '没有：轨迹是真机上录下来的']]) +
        '<p>伪交互模式等于假设夹爪永不打滑，只看布料本身；机器人模式里打滑、夹不紧都会算进误差，所以表 5 的数字普遍比表 4 大，PyBullet 和 Isaac Sim 尤其明显。</p>' +
        '<p>论文没有 fling 的机器人模式结果；代码说明是双臂释放不可靠，那几格没跑。</p>' +
        toyb('“机器人模式”在玩具里用一根软弹簧（10 N/m）把顶点连到夹爪上，代表不完美的夹持；不是接触模拟。机械臂是两段式示意臂，只跟着夹爪位置走。') + src('§Eval Tasks · §Garment Manipulation Mode · 附录 G') },
    { n: 10, part: '结果', title: '速度：图 4 的读数和表 1', sub: '切换每步时间、初始化时间、表 1（BCM 方格布）', dur: 11, cam: [0.3, 1.1, 25, [0, 2.6, 0]],
      html: dl([['每步时间', '5k / 10k / 20k / 40k 顶点，100 步平均；本文 2.7 → 9.0 ms'], ['倍数', 'Isaac ÷ 本文 = 6.85、4.35、3.67、2.96'], ['MuJoCo', '20k 时 421.6 ms，40k 失败'], ['初始化', '本文 10.3 s，Isaac 157.7，MuJoCo 170.7，PyBullet 141.5'], ['表 1', 'MuJoCo 和 FLEX 两列抄自 BCM 原文']]) +
        '<p>柱高是对数刻度。5k 顶点时 PyBullet（7.4 ms）比 Isaac Sim（18.3 ms）快，“Isaac 最强”只在大网格成立。论文没给硬件。</p>' +
        '<p>表 1 的准静态结果优势明显（CD 低 46%），动态结果的优势在一个标准差内。</p>' + src('图 4（矢量读数）· 表 1 · BCM 表 III · 精读页读者注 6–8') },
    { n: 11, part: '结果', title: '表 4 和表 5：每件衣物、每个动作、三个模拟器', sub: '切换模式和指标；均值和降幅当场算', dur: 12, cam: [0.45, 1.08, 26, [0, 2.4, 0]],
      html: dl([['表 4', '伪交互，7 件 × 3 动作'], ['表 5', '机器人模式，7 件 × 2 动作（没有 fling）'], ['和代码', '420 个数和 paper_baselines.csv 逐格一致'], ['不是最低', '表 4 有 9/84 组，全是 s2r 或 HD'], ['附录文字', 'fold 段把 CD_s2r 均值当成了 CD_r2s；按衣物分组的区间和表不符']]) +
        '<p>柱高就是表里的数（米）。下面的标签是当场算的三个模拟器均值和本文的降幅，可以和原文附录 C 的文字对照。</p>' + src('附录 C · 表 4 · 表 5 · 精读页读者注 9、12、16–18') }
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
    const f = t => { const P = f.pos || pos; if (t === st.t) { if (st.s) st.s.position.set(P[0], P[1], P[2]); return; } if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; st.s = lab(t, P, o); G.add(st.s); };
    return f;
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BALL = new THREE.SphereGeometry(1, 12, 9), CUBE = new THREE.BoxGeometry(1, 1, 1);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: 0.6 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s, q) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, q || _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
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
    l.userData.set = (i, a, b, c) => { pos.set(a, i * 6); pos.set(b, i * 6 + 3); col.set(c, i * 6); col.set(c, i * 6 + 3); };
    l.userData.hide = i => { pos.fill(0, i * 6, i * 6 + 6); };
    l.userData.done = () => { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; };
    return l;
  }
  function floorRect(G, cx, cz, lx, lz, color, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(lx, lz), new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: o.opacity != null, opacity: o.opacity ?? 1, depthWrite: o.opacity == null })); m.rotation.x = -PI / 2; m.position.set(cx, o.y ?? 0, cz); G.add(m); return m; }
  function points(G, n, color, size = 0.06) {
    const pos = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setDrawRange(0, 0);
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color, size, sizeAttenuation: true })); p.frustumCulled = false; G.add(p);
    p.userData.set = arr => { const k = Math.min(n, arr.length); for (let i = 0; i < k; i++) { pos[3 * i] = arr[i][0]; pos[3 * i + 1] = arr[i][1]; pos[3 * i + 2] = arr[i][2]; } g.setDrawRange(0, k); g.attributes.position.needsUpdate = true; };
    return p;
  }

  /* ---------- cloth helpers ---------- */
  const SC = 8; /* scene units per metre */
  const SIMC = {};
  function sim(key, o) { if (!SIMC[key]) SIMC[key] = CLOTH.simulate(o); return SIMC[key]; }
  const MATN = ['silk', 'cotton', 'leather'], MATL = ['丝', '棉', '皮革'], ACTN = ['grasp', 'fling', 'fold'], ACTL = ['抓起 grasp', '甩动 fling', '对折 fold'];
  function clothMesh(G, color, o = {}) {
    const N = CLOTH.N, pos = new Float32Array(N * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(CLOTH.tris.flat());
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide, transparent: o.opacity != null, opacity: o.opacity ?? 1, flatShading: false }));
    m.frustumCulled = false; G.add(m);
    const wg = new THREE.WireframeGeometry(g); const wl = o.wire === false ? null : new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x0b1020, transparent: true, opacity: 0.25 }));
    const eidx = []; CLOTH.tris.forEach(t => { eidx.push(t[0], t[1], t[1], t[2], t[2], t[0]); }); wg.dispose();
    if (wl) { wl.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); wl.geometry.setIndex(eidx); wl.frustumCulled = false; G.add(wl); }
    m.userData.set = (F, off = [0, 0, 0]) => { for (let i = 0; i < N; i++) { pos[3 * i] = F[3 * i] * SC + off[0]; pos[3 * i + 1] = F[3 * i + 1] * SC + off[1]; pos[3 * i + 2] = F[3 * i + 2] * SC + off[2]; } g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere(); if (wl) wl.geometry.attributes.position.needsUpdate = true; };
    m.userData.wire = wl; return m;
  }
  const frameAt = (R, p) => R.frames[Math.min(R.frames.length - 1, Math.round(p * (R.frames.length - 1)))];
  const fIdx = (R, p) => Math.min(R.frames.length - 1, Math.round(p * (R.frames.length - 1)));
  /* point samples on the cloth surface (fixed barycentrics) */
  const SAMP = (() => { const r = L.rng(7), out = []; CLOTH.tris.forEach((t, ti) => { for (let k = 0; k < 4; k++) { let a = r(), b = r(); if (a + b > 1) { a = 1 - a; b = 1 - b; } out.push([ti, a, b]); } }); return out; })();
  function surfacePts(F, noise, seed) {
    const r = L.rng(seed || 3); return SAMP.map(([ti, a, b]) => { const [i, j, k] = CLOTH.tris[ti], c = 1 - a - b; return [0, 1, 2].map(d => c * F[3 * i + d] + a * F[3 * j + d] + b * F[3 * k + d] + noise * L.gauss(r)); });
  }
  /* single-view visibility: keep points nearest to the camera in each of 48x48 image bins (+1 cm) */
  function visible(P, cam) {
    const tgt = [0, 0.1, 0], f = [tgt[0] - cam[0], tgt[1] - cam[1], tgt[2] - cam[2]], fl = Math.hypot(...f); f.forEach((v, i) => { f[i] = v / fl; });
    const rgt = [f[2], 0, -f[0]], rl = Math.hypot(...rgt); rgt.forEach((v, i) => { rgt[i] = v / rl; }); const up = [rgt[1] * f[2] - rgt[2] * f[1], rgt[2] * f[0] - rgt[0] * f[2], rgt[0] * f[1] - rgt[1] * f[0]];
    const B = 48, zb = new Float64Array(B * B).fill(1e9), key = P.map(p => { const d = [p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]], z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2], u = (d[0] * rgt[0] + d[1] * rgt[1] + d[2] * rgt[2]) / z, v = (d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / z;
      const bi = clamp(Math.floor((u + 0.3) / 0.6 * B), 0, B - 1), bj = clamp(Math.floor((v + 0.3) / 0.6 * B), 0, B - 1), q = bj * B + bi; if (z < zb[q]) zb[q] = z; return [q, z]; });
    return P.filter((p, i) => key[i][1] < zb[key[i][0]] + 0.01);
  }
  const l1 = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  function oneSided(A, Bp) { let s = 0, mx = -1, wi = 0, wj = 0; for (let i = 0; i < A.length; i++) { let m = 1e9, mj = 0; for (let j = 0; j < Bp.length; j++) { const d = l1(A[i], Bp[j]); if (d < m) { m = d; mj = j; } } s += m; if (m > mx) { mx = m; wi = i; wj = mj; } } return { cd: s / A.length, hd: mx, wi, wj }; }
  const verts = F => { const o = []; for (let i = 0; i < CLOTH.N; i++) o.push([F[3 * i], F[3 * i + 1], F[3 * i + 2]]); return o; };
  const S3 = p => [p[0] * SC, p[1] * SC, p[2] * SC];
  function grippers(G) { const im = inst(BALL, 2); im.material.color.setHex(0xff5f9e); im.material.emissive.setHex(0xff5f9e); im.material.emissiveIntensity = 0.4; G.add(im); return (R, f, on) => { im.visible = on; if (!on) return; R.tgt[f].forEach((t, i) => setI(im, i, S3(t), 0.16)); done(im); }; }
  function arms(G) {
    const A = [-1, 1].map(sx => { const a = L.arm(0xc9d4ea); a.scale.setScalar(1.3); a.position.set(sx * 0.25 * SC, 0, -0.62 * SC); G.add(a); return a; });
    return (pts) => { A.forEach((a, i) => { a.userData.reach(pts[i]); }); };
  }

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    const P = [['衣物网格库\n6k+ 件', [-7, 1.4, 0], COL.data, 2, [3.4, 1.6, 2.2]], ['GarmentDynamics\nFEM · 隐式 · PCG', [0, 1.4, 0], COL.sim, 4, [3.8, 1.6, 2.2]], ['真实采集\n双臂 + RealSense', [7, 1.4, 0], COL.white, 7, [3.6, 1.6, 2.2]],
      ['三个动作\ngrasp fling fold', [-3.6, 1.0, 5.2], COL.gold, 9, [3.4, 1.2, 1.8]], ['指标\nCD / HD 双向', [3.6, 1.0, 5.2], COL.purple, 8, [3.0, 1.2, 1.8]], ['结果\n表 4 · 表 5 · 图 4', [0, 1.0, 9.4], COL.ok, 11, [3.4, 1.2, 1.8]]];
    const B = P.map(([t, pos, c, go, sz]) => { const b = block(sz[0], sz[1], sz[2], c, pos, { opacity: 0.85 }); b.userData.go = go - 1; PICKS.push(b); G.add(b, lab(t, [pos[0], pos[1] + 1.5, pos[2]], { size: 20 })); return b; });
    wire(G, [[-5.2, 1.4, 0], [-1.9, 1.4, 0]], COL.data, { opacity: 0.8 }); wire(G, [[5.2, 1.4, 0], [1.9, 1.4, 0]], COL.white, { opacity: 0.8 });
    wire(G, [[0, 0.6, 1.1], [3.0, 0.6, 4.3]], COL.sim, { opacity: 0.8 }); wire(G, [[7, 0.6, 1.1], [4.2, 0.6, 4.3]], COL.white, { opacity: 0.8 }); wire(G, [[-3.6, 0.6, 4.3], [-0.6, 0.6, 1.1]], COL.gold, { opacity: 0.8 }); wire(G, [[-3.6, 0.6, 4.3], [6.4, 0.6, 1.1]], COL.gold, { opacity: 0.5, dashed: true }); wire(G, [[3.6, 0.6, 6.1], [0.8, 0.6, 8.5]], COL.purple, { opacity: 0.8 });
    G.add(lab('仿真网格顶点 V_t', [1.1, 2.2, 3.0], { size: 15, color: css(COL.sim) }), lab('真实点云 P_t', [6.4, 2.2, 3.0], { size: 15 }), lab('同一段录下的轨迹，两边都回放', [-1.2, -0.4, 3.4], { size: 15, color: css(COL.gold) }));
    const cm = clothMesh(G, COL.cotton, { opacity: 0.9 }); const R0 = new Float32Array(CLOTH.N * 3); for (let i = 0; i < CLOTH.N; i++) { R0[3 * i] = CLOTH.rest[i][0] * 0.55; R0[3 * i + 1] = 0.0; R0[3 * i + 2] = CLOTH.rest[i][1] * 0.55; }
    return { update(p) {
      const k = Math.floor(p * 6 * 0.999); B.forEach((b, i) => glow(b, i === k ? 0.85 : 0.08));
      const F = Float32Array.from(R0); const w = 0.12 * Math.sin(p * 2 * PI); for (let i = 0; i < CLOTH.N; i++) F[3 * i + 1] = 0.36 + w * Math.sin(CLOTH.rest[i][0] * 12 + p * 9) * (CLOTH.rest[i][1] + 0.25);
      cm.userData.set(F, [0, -0.2, 0]);
      cap(['数据集：4k+ 工业资产（带测得参数）+ 2k+ ClothesNet', '模拟器：GarmentDynamics（未公开）', '真实采集：9 件衣物，98 次采集，点云 + 关节轨迹', '三个动作：录下的轨迹，在真机和仿真里各跑一次', '指标：仿真顶点和真实点云的 CD、HD，两个方向', '结果：速度（图 4）和误差（表 1、4、5）'][k] + '<br>点方块跳到对应那一幕');
    } };
  }

  /* ---------- scene 2: Table 3 ---------- */
  const T3 = [['棉', 22, 1000000, 2800, 170, 0.26], ['麻', 10, 130000, 500, 71, 0.19], ['羊毛', 11, 380000, 650, 220, 0.38], ['涤纶', 17, 100000, 1700, 109, 0.21], ['尼龙', 5, 65000, 100, 135, 0.32],
    ['丝', 10, 30000, 150, 60, 0.19], ['针织', 20, 25000, 200, 190, 0.5], ['天鹅绒', 5, 70000, 600, 210, 0.53], ['皮革', 4, 1000000, 20000, 500, 1.74], ['毛皮', 7, 1700000, 2000, 230.3, 0.67]];
  function s2(G) {
    let mi = +(OPT[0] ?? 0);
    const MET = [['子类型数', v => v / 22 * 5, v => String(v)], ['拉伸刚度 g/s²', v => (Math.log10(v) - 4) / 2.3 * 5, v => v.toExponential(1).replace('e+', '×10^')], ['弯曲刚度（表 3 单位）', v => (Math.log10(v) - 1.8) / 2.6 * 5, v => String(v)], ['面密度 g/m²', v => v / 500 * 5, v => String(v)], ['厚度 mm', v => v / 1.74 * 5, v => String(v)]];
    const bars = T3.map((r, i) => { const b = block(0.9, 1, 0.9, [0xd8d0c0, 0xc8b88a, 0xb07d5a, 0x7fb8ff, 0x9d8cff, 0xd8a8d8, 0xe6a86a, 0x8a3a5a, 0x8a5a3a, 0xb8a080][i], [-4.5 + i * 1.3, 0.5, 0], { opacity: 0.92 }); G.add(b, lab(r[0], [-4.5 + i * 1.3, -0.5, 1.0], { size: 14 })); return b; });
    const vl = T3.map((r, i) => dynLab(G, [-4.5 + i * 1.3, 1, 0], { size: 14 }));
    floorRect(G, 1.4, 0, 14.5, 3.2, COL.table, { y: -0.01 });
    const ind = block(1.6, 4.0, 1.6, COL.data, [-9.0, 2.0, 0], { opacity: 0.85 }), cn = block(1.6, 2.0, 1.6, COL.purple, [-9.0, 5.0, 0], { opacity: 0.85 });
    G.add(ind, cn, lab('4k+ 工业资产\n（Style3D，带参数）', [-9.0, 2.0, 1.2], { size: 14 }), lab('2k+ ClothesNet', [-9.0, 5.0, 1.2], { size: 14 }), lab('9 件真实衣物\n表 4、5 用 7 件', [-9.0, 8.2, 0], { size: 14, color: css(COL.gold) }));
    const title = dynLab(G, [1.4, 6.8, 0], { size: 17, border: 'rgba(56,209,255,.7)' });
    const ctls = [{ label: '柱子', items: MET.map(m => m[0]), get: () => mi, set: k => { mi = k; } }];
    return { ctls, update(p) {
      const M = MET[mi], g = seg(p, 0.05, 0.6);
      bars.forEach((b, i) => { const h = Math.max(0.05, M[1](T3[i][mi + 1]) * g); b.scale.y = h; b.position.y = h / 2; vl[i].pos = [-4.5 + i * 1.3, h + 0.45, 0]; vl[i](M[2](T3[i][mi + 1])); });
      title(`表 3 · ${M[0]}${mi === 1 || mi === 2 ? '（对数高度）' : ''}`);
      cap(mi === 0 ? '子类型合计 111，图 3 写“100+ 子类型、10+ 材料”，对得上' : mi === 1 ? '棉和皮革都是 10⁶ g/s²（= 1000 N/m），毛皮 1.7×10⁶ 最高，针织 2.5×10⁴ 最低' : mi === 2 ? '皮革 20000 最高，尼龙 100 最低；按字面单位棉是 2.8 N·m，比常见面料大五六个数量级' : mi === 3 ? '面密度：丝 60 g/m² 最轻，皮革 500 最重' : '厚度：皮革 1.74 mm，其余 0.19 到 0.67 mm');
    } };
  }

  /* ---------- scene 3: pattern pieces and seams ---------- */
  function s3(G) {
    const flat = (pts, color, op = 0.55) => { const sh = new THREE.Shape(); pts.forEach((q, i) => (i ? sh.lineTo(q[0], q[1]) : sh.moveTo(q[0], q[1]))); const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: op, roughness: 0.9 })); return m; };
    const body = [[-1.4, 0], [1.4, 0], [1.4, 2.8], [0.5, 3.1], [0, 2.85], [-0.5, 3.1], [-1.4, 2.8]];
    const sleeve = [[-0.9, 0], [0.9, 0], [0.6, 1.4], [-0.6, 1.4]];
    const mk = (pts, c, name) => { const g = new THREE.Group(), m = flat(pts, c); g.add(m); const loop = pts.concat([pts[0]]).map(q => [q[0], q[1], 0.01]); g.add(L.line(loop, 0x8e9bb8, { opacity: 0.7 })); g.userData.name = name; G.add(g); return g; };
    const front = mk(body, 0x6aa0c8, '前片'), back = mk(body, 0x5a88b0, '后片'), sl = mk(sleeve, 0x7ab0d8, '左袖'), sr = mk(sleeve, 0x7ab0d8, '右袖');
    const edges = [[front, [[-1.4, 0], [-1.4, 2.8]], COL.seamA], [back, [[1.4, 0], [1.4, 2.8]], COL.seamA], [front, [[1.4, 0], [1.4, 2.8]], COL.seamB], [back, [[-1.4, 0], [-1.4, 2.8]], COL.seamB],
      [front, [[0.5, 3.1], [1.4, 2.8]], COL.seamC], [back, [[-0.5, 3.1], [-1.4, 2.8]], COL.seamC], [front, [[-0.5, 3.1], [-1.4, 2.8]], COL.seamD], [back, [[0.5, 3.1], [1.4, 2.8]], COL.seamD],
      [front, [[-1.4, 0.04], [1.4, 0.04]], COL.hem], [back, [[-1.4, 0.04], [1.4, 0.04]], COL.hem], [sl, [[-0.9, 0.04], [0.9, 0.04]], COL.hem], [sr, [[-0.9, 0.04], [0.9, 0.04]], COL.hem]];
    edges.forEach(([g, e, c]) => { const t = L.tube([[e[0][0], e[0][1], 0.02], [e[1][0], e[1][1], 0.02]], c, 0.05); g.add(t); });
    const conn = segs(G, 4, { opacity: 0.8 });
    const pairs = [[0, 1], [2, 3], [4, 5], [6, 7]];
    const nm = [front, back, sl, sr].map(g => { const s = lab(g.userData.name, [0, 0, 0], { size: 15 }); G.add(s); return s; });
    const flatPose = [[-1.7, 0, 0.6, 0], [1.7, 0, 0.6, 0], [-4.4, 0, 0.6, 0], [4.4, 0, 0.6, 0]];
    return { update(p) {
      const u = seg(p, 0.35, 0.85);
      [front, back, sl, sr].forEach((g, i) => {
        const f = flatPose[i];
        if (i < 2) { g.rotation.set(-PI / 2 * (1 - u), i === 1 ? PI * u : 0, 0); g.position.set(L.lerp(f[0], 0, u), 0.05 + 0.2 * u, L.lerp(0.6, i === 0 ? 0.35 : -0.35, u)); }
        else { const sx = i === 2 ? -1 : 1; g.rotation.set(-PI / 2 * (1 - u), 0, sx * (PI / 2) * u); g.position.set(L.lerp(f[0], sx * 1.45, u), 0.05 + 2.2 * u, L.lerp(0.6, 0, u)); }
        g.updateMatrixWorld(true); nm[i].position.copy(new THREE.Vector3(0, 1.3, 0.1).applyMatrix4(g.matrixWorld)).add(new THREE.Vector3(0, 0, 0));
      });
      const show = seg(p, 0.08, 0.3);
      pairs.forEach(([a, b], k) => { const ea = edges[a], eb = edges[b]; const mid = e => new THREE.Vector3((e[1][0][0] + e[1][1][0]) / 2, (e[1][0][1] + e[1][1][1]) / 2, 0.02).applyMatrix4(e[0].matrixWorld);
        const A = mid(ea), Bv = mid(eb); if (show > 0.02) conn.userData.set(k, [A.x, A.y, A.z], [L.lerp(A.x, Bv.x, show), L.lerp(A.y, Bv.y, show), L.lerp(A.z, Bv.z, show)], hex3(ea[2])); else conn.userData.hide(k); });
      conn.userData.done();
      cap(p < 0.35 ? '平铺的版片：每对同色边将来缝在一起（侧缝、肩缝），黄色是下摆和袖口的折边' : p < 0.85 ? '版片立起来，配对的边互相靠拢；缝合后该处的拉伸受限，折边处弯曲刚度变低' : '缝好之后得到一件衣服的网格；论文说所有网格都做成水密的（代码说明有两件例外）');
    } };
  }

  /* ---------- scene 4: live cloth ---------- */
  function s4(G) {
    let ai = +(OPT[0] ?? 1), mi = +(OPT[1] ?? 1), ii = +(OPT[2] ?? 0);
    floorRect(G, 0, 0.6, 8, 9, COL.table, { y: -0.02 });
    const cm = clothMesh(G, COL.cotton); const gr = grippers(G);
    const ctls = [{ label: '动作', items: ACTL, get: () => ai, set: k => { ai = k; } }, { label: '材料', items: MATL, get: () => mi, set: k => { mi = k; } }, { label: '积分', items: ['隐式欧拉（本文式）', '显式（同步长）'], get: () => ii, set: k => { ii = k; } }];
    return { ctls, update(p) {
      const R = sim(`${ACTN[ai]}|${MATN[mi]}|${ii ? 'exp' : 'imp'}|pin`, { action: ACTN[ai], mat: MATN[mi], integ: ii ? 'exp' : 'imp' });
      cm.material.color.setHex([COL.silk, COL.cotton, COL.leather][mi]);
      const f = fIdx(R, p), F = R.frames[f]; cm.userData.set(F); gr(R, f, R.on(f));
      const st = CLOTH.strain(F);
      if (R.exploded >= 0 && f >= R.exploded) { cap(`<b>显式积分在第 ${R.exploded} 帧数值爆炸</b>，画面停在爆炸前<br>同样 h = 1/120 s：棉布太硬，显式要么用极小步长，要么改用隐式`); return; }
      cap(['抓起：肩部两点被提起，布在重力下垂出褶皱', '甩动：提起，快速前推后拉，松开落回桌面', '对折：抓住肩部，略提起，向前平移到下摆'][ai] + ` · ${MATL[mi]} · t = ${(f / 30).toFixed(2)} s<br>${ii ? '显式' : `牛顿 2 次 × PCG ${R.ncg} 步，相对残差 ${R.res[f] ? R.res[f].toExponential(1) : '—'}`} · 最大边应变 ${(st * 100).toFixed(1)}%`);
    } };
  }

  /* ---------- scene 5: BVH and contact potentials ---------- */
  function s5(G) {
    let vi = +(OPT[0] ?? 0);
    const R = sim('fold|cotton|imp|pin', { action: 'fold', mat: 'cotton', integ: 'imp' }), F = R.frames[R.frames.length - 1];
    floorRect(G, -2.5, 0, 7, 6, COL.table, { y: -0.02 });
    const cm = clothMesh(G, COL.cotton, { opacity: 0.8 });
    const V = verts(F).map(q => [q[0] * SC - 2.5, q[1] * SC * 2 + 0.02, q[2] * SC]);
    cm.userData.set(Float32Array.from(V.flatMap(q => [(q[0] + 2.5) / SC, q[1] / SC, q[2] / SC])), [-2.5, 0, 0]);
    /* median-split BVH over triangle boxes */
    const boxes = CLOTH.tris.map(t => { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; t.forEach(k => { for (let d = 0; d < 3; d++) { lo[d] = Math.min(lo[d], V[k][d]); hi[d] = Math.max(hi[d], V[k][d]); } }); return { lo, hi, c: lo.map((v, d) => (v + hi[d]) / 2) }; });
    const levels = [];
    (function build(ids, depth) { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; ids.forEach(i => { for (let d = 0; d < 3; d++) { lo[d] = Math.min(lo[d], boxes[i].lo[d]); hi[d] = Math.max(hi[d], boxes[i].hi[d]); } }); (levels[depth] = levels[depth] || []).push([lo, hi]);
      if (ids.length <= 2 || depth >= 6) return; const ext = [0, 1, 2].map(d => hi[d] - lo[d]), ax = ext.indexOf(Math.max(...ext)); ids.sort((a, b) => boxes[a].c[ax] - boxes[b].c[ax]); const h = ids.length >> 1; build(ids.slice(0, h), depth + 1); build(ids.slice(h), depth + 1); })(CLOTH.tris.map((t, i) => i), 0);
    const maxBox = 64, bl = segs(G, maxBox * 12, { opacity: 0.75 });
    const probes = segs(G, CLOTH.N, { opacity: 0.8 });
    /* potentials plot */
    const PX = 3.6, PY = 0.4, PW = 4.6, PH = 4.2, dh = 1.0;
    const axes = [wire(G, [[PX, PY, 0], [PX + PW, PY, 0]], 0x8e9bb8, { opacity: 0.8 }), wire(G, [[PX, PY, 0], [PX, PY + PH, 0]], 0x8e9bb8, { opacity: 0.8 })];
    const pen = d => (d < dh ? 0.5 * (dh - d) ** 2 * 3 : 0), ipc = d => (d < dh ? -((d - dh) ** 2) * Math.log(d / dh) * 1.5 : 0);
    const curve = (fn, c) => { const pts = []; for (let i = 0; i <= 80; i++) { const d = 0.02 + i / 80 * 1.5; pts.push([PX + d / 1.52 * PW, PY + Math.min(PH, fn(d) * 1.2), 0]); } return wire(G, pts, c, { opacity: 0.95 }); };
    const cv = [curve(pen, COL.pyb), curve(ipc, COL.ours)];
    const plotLabs = [lab('距离 d →', [PX + PW - 0.4, PY - 0.45, 0], { size: 14 }), lab('能量 ↑', [PX - 0.2, PY + PH + 0.35, 0], { size: 14 }), lab('罚势能 ½κ(d̂−d)²', [PX + 2.2, PY + 2.3, 0], { size: 14, color: css(COL.pyb) }), lab('对数障碍（IPC 型）', [PX + 1.0, PY + 3.9, 0], { size: 14, color: css(COL.ours) }), lab('d̂', [PX + dh / 1.52 * PW, PY - 0.4, 0], { size: 14 })];
    G.add(...plotLabs); wire(G, [[PX + dh / 1.52 * PW, PY, 0], [PX + dh / 1.52 * PW, PY + PH, 0]], 0x8e9bb8, { dashed: true, opacity: 0.6 });
    const mk = inst(BALL, 2); G.add(mk);
    const ctls = [{ label: '看', items: ['BVH 宽相', '接触势能'], get: () => vi, set: k => { vi = k; } }];
    const edgesOf = (lo, hi) => { const c = [[lo[0], lo[1], lo[2]], [hi[0], lo[1], lo[2]], [hi[0], hi[1], lo[2]], [lo[0], hi[1], lo[2]], [lo[0], lo[1], hi[2]], [hi[0], lo[1], hi[2]], [hi[0], hi[1], hi[2]], [lo[0], hi[1], hi[2]]]; return [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].map(([a, b]) => [c[a], c[b]]); };
    return { ctls, update(p) {
      const showPlot = vi === 1; axes.forEach(a => { a.visible = showPlot; }); cv.forEach(c => { c.visible = showPlot; }); plotLabs.forEach(s => { s.visible = showPlot; }); mk.visible = showPlot;
      const lv = Math.min(levels.length - 1, Math.floor(seg(p, 0.0, 0.6) * levels.length)), cols = [hex3(COL.gold), hex3(COL.data), hex3(COL.purple), hex3(COL.ok), hex3(COL.seamA), hex3(COL.white), hex3(COL.sim)];
      for (let i = 0; i < maxBox; i++) { const bx = levels[lv][i]; for (let e = 0; e < 12; e++) { if (!bx || vi === 1) { bl.userData.hide(i * 12 + e); continue; } const E = edgesOf(bx[0], bx[1])[e]; bl.userData.set(i * 12 + e, E[0], E[1], cols[lv % cols.length]); } } bl.userData.done();
      const pr = vi === 0 && p > 0.62, n0 = cm.geometry.attributes.normal;
      for (let i = 0; i < CLOTH.N; i++) { if (!pr) { probes.userData.hide(i); continue; } const q = V[i], nx = n0.getX(i), ny = n0.getY(i), nz = n0.getZ(i), len = 0.5 * seg(p, 0.62, 0.8); probes.userData.set(i, q, [q[0] + nx * len, q[1] + ny * len, q[2] + nz * len], hex3(COL.ours)); } probes.userData.done();
      if (showPlot) { const d = L.lerp(1.45, 0.06, seg(p, 0.1, 0.9)); setI(mk, 0, [PX + d / 1.52 * PW, PY + Math.min(PH, pen(d) * 1.2), 0], 0.1); setI(mk, 1, [PX + d / 1.52 * PW, PY + Math.min(PH, ipc(d) * 1.2), 0], 0.1); colI(mk, 0, hex3(COL.pyb)); colI(mk, 1, hex3(COL.ours)); done(mk);
        cap(`两个点正在靠近：d = ${d.toFixed(2)} d̂ · 罚势能 ${pen(d).toFixed(2)} · 对数障碍 ${ipc(d) > 99 ? '→ ∞' : ipc(d).toFixed(2)} · 论文用“势能接触力 + 解缠兜底”，没给具体形式`); return; }
      cap(p < 0.62 ? `BVH 第 ${lv} 层：${levels[lv].length} 个盒子（对折后的布，纵向放大 2 倍）` : '每个顶点沿法向发一条短探针，RT 核在硬件里遍历 BVH 并做射线-盒测试（示意）');
    } };
  }

  /* ---------- scene 6: PCG with three preconditioners ---------- */
  function s6(G) {
    let hi = +(OPT[0] ?? 0);
    const R = sim('fling|cotton|imp|pin|cap40', { action: 'fling', mat: 'cotton', integ: 'imp', capture: 40 }), c = R.capt, n = c.r.length;
    const HIST = {}; const hist = k => { if (!HIST[k]) { const A = PCGLAB.withStep(c, k ? 1 / 30 : 1 / 120); HIST[k] = [0, 1, 2].map(q => PCGLAB.run(A, c.r, PCGLAB.makePre(q, A, n, CLOTH.n), 60)); } return HIST[k]; };
    const X0 = -5, Y0 = 0, W = 10, H = 6, px = it => X0 + it / 60 * W, py = r => Y0 + (Math.log10(r) + 8) / 8 * H;
    wire(G, [[X0, Y0, 0], [X0 + W, Y0, 0]], 0x8e9bb8, { opacity: 0.8 }); wire(G, [[X0, Y0, 0], [X0, Y0 + H, 0]], 0x8e9bb8, { opacity: 0.8 });
    [0, -2, -4, -6, -8].forEach(e => { wire(G, [[X0, py(10 ** e), 0], [X0 + W, py(10 ** e), 0]], 0x4a5878, { opacity: 0.3 }); G.add(lab(`1e${e}`, [X0 - 0.7, py(10 ** e), 0], { size: 13 })); });
    [0, 20, 40, 60].forEach(t => G.add(lab(String(t), [px(t), Y0 - 0.45, 0], { size: 13 })));
    G.add(lab('PCG 迭代 →', [X0 + W - 0.8, Y0 - 1.0, 0], { size: 14 }), lab('相对残差（对数）', [X0 + 0.6, Y0 + H + 0.5, 0], { size: 14 }));
    wire(G, [[X0, py(1e-3), 0.01], [X0 + W, py(1e-3), 0.01]], COL.gold, { dashed: true, opacity: 0.7 });
    const LC = [0x8e9bb8, COL.pyb, COL.ours], LN = ['无预条件', '块 Jacobi', '两层加性 Schwarz'];
    const lines = LC.map(cc => pline(G, 61, cc));
    const names = LN.map((t, i) => { const s = lab(t, [0, 0, 0], { size: 14, color: css(LC[i]) }); G.add(s); return s; });
    const ctls = [{ label: '步长 h', items: ['1/120 s（第 4 幕）', '1/30 s'], get: () => hi, set: k => { hi = k; } }];
    return { ctls, update(p) {
      const Hh = hist(hi), m = Math.max(1, Math.round(seg(p, 0.02, 0.8) * 60));
      Hh.forEach((h0, i) => { lines[i].userData.set(h0.slice(0, m + 1).map((r, it) => [px(it), py(Math.max(1e-8, r)), 0.02 * i])); names[i].position.set(px(m) + 1.3, py(Math.max(1e-8, h0[m])) + 0.3 * (i - 1), 0); });
      const to = Hh.map(h0 => { const k = h0.findIndex(v => v < 1e-3); return k < 0 ? '>60' : String(k); });
      cap(`h = ${hi ? '1/30' : '1/120'} s · ${n} 个未知数 · 降到 1e-3（黄虚线）需要：<br>${LN.map((t, i) => `${t} <b>${to[i]}</b> 步`).join(' · ')}`);
    } };
  }

  /* ---------- scene 7: the real side ---------- */
  const CAM = [0.9, 1.3, 1.6];
  function s7(G) {
    let ci = +(OPT[0] ?? 0);
    const R = sim('fling|cotton|imp|pin', { action: 'fling', mat: 'cotton', integ: 'imp' }), nF = R.frames.length, LAT = 2;
    floorRect(G, 0, 0, 9, 9, COL.table, { y: -0.03 }); floorRect(G, 0, 0, 0.56 * SC, 0.56 * SC, COL.plate, { y: -0.02, opacity: 0.5 });
    const cm = clothMesh(G, COL.sim, { opacity: 0.55 }), pc = points(G, 1200, COL.white, 0.07), reach = arms(G);
    const CV = S3(CAM).map(v => v * 0.5); const camG = new THREE.Group(); const cb = block(0.5, 0.35, 0.35, 0x3b4660, [0, 0, 0]); camG.add(cb); camG.position.set(...CV); camG.lookAt(0, 0.8, 0); G.add(camG);
    [[-2.2, 0, -2.2], [2.2, 0, -2.2], [-2.2, 0, 2.2], [2.2, 0, 2.2]].forEach(q => wire(G, [CV, q], COL.white, { opacity: 0.25 }));
    G.add(lab('相机方向（实际约 2 m 远）', [CV[0], CV[1] + 0.7, CV[2]], { size: 14 }), lab('O_w：两基座中点', [0, 0.3, -0.62 * SC], { size: 14, color: css(COL.gold) }), lab('±0.25 m', [2.0, 0.3, -0.62 * SC - 0.8], { size: 13 }));
    /* precompute real streams and CD per frame (both cases) */
    const RP = R.frames.map((F, i) => visible(surfacePts(F, 0.003, 11 + i), CAM));
    const cd = [[], []]; for (let f = 0; f < nF; f++) { const V = verts(R.frames[f]); cd[0].push(oneSided(RP[Math.max(0, f - LAT)], V).cd); cd[1].push(oneSided(RP[f], V).cd); }
    const PX = 4.6, PY = 3.2, PW = 4, PH = 2.2, mx = Math.max(...cd[0]) * 1.1, ppx = f => PX + f / (nF - 1) * PW, ppy = v => PY + v / mx * PH;
    wire(G, [[PX, PY, 0], [PX + PW, PY, 0]], 0x8e9bb8, { opacity: 0.8 }); wire(G, [[PX, PY, 0], [PX, PY + PH, 0]], 0x8e9bb8, { opacity: 0.8 });
    const ln = [pline(G, nF, COL.bad), pline(G, nF, COL.ours)];
    G.add(lab('逐帧 CD_r2s', [PX + 1.0, PY + PH + 0.4, 0], { size: 13, scale: 0.009 }), lab(`${(mx * 1000).toFixed(0)} mm`, [PX - 0.9, PY + PH - 0.5, 0], { size: 12, scale: 0.009 }), lab('t →', [PX + PW + 0.3, PY, 0], { size: 12, scale: 0.009 }));
    const ctls = [{ label: '时延补偿', items: ['关（相机流晚 2 帧）', '开（往前挪 0.067 s）'], get: () => ci, set: k => { ci = k; } }];
    return { ctls, update(p) {
      const f = fIdx(R, p); cm.userData.set(R.frames[f]);
      const shown = RP[ci ? f : Math.max(0, f - LAT)]; pc.userData.set(shown.map(S3));
      const on = R.on(f), tg = R.tgt[f]; reach(tg.map(t => on ? S3(t) : [t[0] * SC, 1.2, t[2] * SC - 0.8]));
      ln.forEach((l, k) => l.userData.set(cd[k === 0 ? 0 : 1].slice(0, f + 1).map((v, i) => [ppx(i), ppy(v), 0.01 * k])));
      cap(`CD<sub>r2s</sub>：不补偿（红）${(cd[0][f] * 1000).toFixed(1)} mm · 补偿（蓝）${(cd[1][f] * 1000).toFixed(1)} mm · 全程平均 ${(cd[0].reduce((a, b) => a + b) / nF * 1000).toFixed(1)} 对 ${(cd[1].reduce((a, b) => a + b) / nF * 1000).toFixed(1)}<br>白点：单视角点云 ${shown.length} 点 · 蓝网格：仿真`);
    } };
  }

  /* ---------- scene 8: metrics ---------- */
  function s8(G) {
    let si = +(OPT[0] ?? 0), ri = +(OPT[1] ?? 0);
    const Rr = sim('grasp|cotton|imp|pin', { action: 'grasp', mat: 'cotton', integ: 'imp' }), Rs = sim('grasp|silk|imp|pin', { action: 'grasp', mat: 'silk', integ: 'imp' });
    floorRect(G, 0, 0, 8, 6, COL.table, { y: -0.03 });
    const cm = clothMesh(G, COL.sim, { opacity: 0.45 }), pc = points(G, 1200, COL.white, 0.06), sv = inst(BALL, CLOTH.N); sv.material.color.setHex(COL.sim); G.add(sv);
    const hl = segs(G, 2, { opacity: 1 });
    const r = L.rng(5), jit = Array.from({ length: CLOTH.N }, () => [L.gauss(r), L.gauss(r), L.gauss(r)].map(v => clamp(v, -2, 2) * 0.02));
    const ctls = [{ label: '仿真', items: ['接近（棉）', '材料不对（丝）', '膨胀（失稳）'], get: () => si, set: k => { si = k; } }, { label: '真实点云', items: ['单视角', '全表面（假想）'], get: () => ri, set: k => { ri = k; } }];
    return { ctls, update(p) {
      const f = Math.round(L.lerp(30, Rr.frames.length - 1, p)), Fr = Rr.frames[f];
      let Fs = si === 1 ? Rs.frames[f] : Float32Array.from(Fr);
      if (si === 0) { Fs = Float32Array.from(Rr.frames[Math.max(0, f - 1)]); for (let i = 0; i < CLOTH.N; i++) Fs[3 * i + 2] += 0.006; }
      if (si === 2) { for (let i = 0; i < CLOTH.N; i++) for (let d = 0; d < 3; d++) Fs[3 * i + d] += jit[i][d] * seg(p, 0, 0.4); }
      let P = surfacePts(Fr, 0.003, 21 + f); if (ri === 0) P = visible(P, CAM);
      const V = verts(Fs); cm.userData.set(Fs); V.forEach((q, i) => setI(sv, i, S3(q), 0.05)); done(sv); pc.userData.set(P.map(S3));
      const a = oneSided(V, P), b = oneSided(P, V);
      hl.userData.set(0, S3(V[a.wi]), S3(P[a.wj]), hex3(COL.bad)); hl.userData.set(1, S3(P[b.wi]), S3(V[b.wj]), hex3(COL.ours)); hl.userData.done();
      cap(`CD<sub>s2r</sub> ${a.cd.toFixed(4)} · CD<sub>r2s</sub> ${b.cd.toFixed(4)} · HD<sub>s2r</sub> ${a.hd.toFixed(4)} · HD<sub>r2s</sub> ${b.hd.toFixed(4)}（m）<br>` + (si === 2 ? '膨胀：s2r 被乱飞的顶点拉大，r2s 涨得少' : ri === 0 ? '单视角：背面没有真实点，s2r 天然偏大' : '全表面：两个方向接近（真实采集拿不到）'));
    } };
  }

  /* ---------- scene 9: tasks and modes ---------- */
  function s9(G) {
    let ai = +(OPT[0] ?? 0), mo = +(OPT[1] ?? 0);
    floorRect(G, 0, 0, 9, 10, COL.table, { y: -0.03 }); floorRect(G, 0, 0, 0.56 * SC, 0.56 * SC, COL.plate, { y: -0.02, opacity: 0.4 });
    const cm = clothMesh(G, COL.cotton), gr = grippers(G), reach = arms(G), gap = segs(G, 2, { opacity: 1 });
    const ctls = [{ label: '动作', items: ACTL, get: () => ai, set: k => { ai = k; } }, { label: '模式', items: ['伪交互（钉住顶点）', '机器人（软夹持，玩具）'], get: () => mo, set: k => { mo = k; } }];
    return { ctls, update(p) {
      const R = sim(`${ACTN[ai]}|cotton|imp|${mo ? 'spring' : 'pin'}`, { action: ACTN[ai], mat: 'cotton', integ: 'imp', attach: mo ? 'spring' : 'pin' });
      const f = fIdx(R, p), F = R.frames[f], on = R.on(f), tg = R.tgt[f]; cm.userData.set(F); gr(R, f, on);
      reach(tg.map(t => on ? S3(t) : [t[0] * SC, t[1] * SC + 1.0, t[2] * SC - 0.6]));
      let g0 = 0; CLOTH.PIN.forEach((q, i) => { const v = [F[3 * q], F[3 * q + 1], F[3 * q + 2]]; const d = Math.hypot(v[0] - tg[i][0], v[1] - tg[i][1], v[2] - tg[i][2]); g0 = Math.max(g0, d); if (mo && on) gap.userData.set(i, S3(v), S3(tg[i]), hex3(COL.warn)); else gap.userData.hide(i); }); gap.userData.done();
      cap(`${ACTL[ai]} · ${mo ? '机器人模式（玩具）' : '伪交互模式'} · t = ${(f / 30).toFixed(2)} s · 轨迹是回放的，没有策略<br>` + (mo ? `被抓顶点离夹爪最远 ${(g0 * 100).toFixed(1)} cm：夹持不完美，快速动作时会被拖开` : '被抓顶点直接跟着末端走，只看布料本身'));
    } };
  }

  /* ---------- scene 10: speed (Fig. 4) and Table 1 ---------- */
  const F4 = { sims: ['本文', 'Isaac Sim', 'MuJoCo', 'PyBullet'], col: [COL.ours, COL.isaac, COL.mujoco, COL.pyb], nv: ['5k', '10k', '20k', '40k'],
    step: [[2.7, 4.4, 6.5, 9.0], [18.3, 19.1, 23.9, 26.6], [35.3, 119.2, 421.6, null], [7.4, 23.3, 58.7, 143.1]], init: [10.3, 157.7, 170.7, 141.5] };
  const T1 = [['动态 CD', 0.067, 0.164, 0.062], ['动态 HD', 0.154, 0.280, 0.150], ['准静态 CD', 0.076, 0.072, 0.0389], ['准静态 HD', 0.186, 0.171, 0.094]];
  function s10(G) {
    let vi = +(OPT[0] ?? 0);
    floorRect(G, 0, 0, 13, 9, COL.table, { y: -0.02 });
    const bars = [], vls = [];
    for (let s = 0; s < 4; s++) for (let k = 0; k < 4; k++) { const b = block(0.9, 1, 0.9, F4.col[s], [-4.2 + k * 2.8, 0.5, -3 + s * 2], { opacity: 0.92 }); G.add(b); bars.push(b); vls.push(dynLab(G, [0, 0, 0], { size: 13 })); }
    const rowL = [0, 1, 2, 3].map(s => dynLab(G, [-7.4, 0.2, -3 + s * 2], { size: 15 }));
    const colL = [0, 1, 2, 3].map(k => dynLab(G, [-4.2 + k * 2.8, 0.2, 5.0], { size: 14 }));
    const ctls = [{ label: '看', items: ['每步时间（图 4 右）', '初始化时间（图 4 左）', '表 1（BCM 方格布）'], get: () => vi, set: k => { vi = k; } }];
    const T1C = [COL.mujoco, COL.purple, COL.ours], T1N = ['MuJoCo', 'FLEX', '本文'];
    return { ctls, update(p) {
      const g = seg(p, 0.05, 0.55); let i = 0;
      for (let s = 0; s < 4; s++) for (let k = 0; k < 4; k++, i++) {
        const b = bars[i]; let show = true, h = 0, txt = ' ', col = F4.col[s];
        if (vi === 0) { const v = F4.step[s][k]; h = v == null ? 0 : (Math.log10(v) + 0.2) * 2.4; txt = v == null ? '失败' : String(v); }
        else if (vi === 1) { show = k === 0; if (show) { h = F4.init[s] / 180 * 6; txt = `${F4.init[s]} s`; } }
        else { show = s < 3; if (show) { const v = T1[k][s + 1]; h = v / 0.3 * 6; txt = String(v); col = T1C[s]; } }
        b.visible = show; b.material.color.setHex(col); b.userData.c = hex3(col);
        const hh = Math.max(0.04, h * g); b.scale.y = hh; b.position.set(-4.2 + k * 2.8, hh / 2, -3 + s * 2);
        vls[i].pos = [b.position.x, hh + 0.45, b.position.z]; vls[i](show ? txt : ' ');
      }
      rowL.forEach((r, s) => r(vi === 2 ? (s < 3 ? T1N[s] : ' ') : F4.sims[s]));
      const CL = [['5k', '10k', '20k', '40k 顶点'], ['初始化', ' ', ' ', ' '], ['动态 CD', '动态 HD', '准静态 CD', '准静态 HD']][vi]; colL.forEach((c, k) => c(CL[k]));
      if (vi === 0) cap('每步时间 ms（对数高度）· Isaac ÷ 本文 = 6.85、4.35、3.67、2.96<br>20k 时 MuJoCo 慢 65 倍，40k 时 PyBullet 慢 16 倍、MuJoCo 失败');
      else if (vi === 1) cap('初始化时间 s · 比 PyBullet 少 92.7%，比 Isaac 少 93.5%，比 MuJoCo 少 94.0%<br>MuJoCo、PyBullet 的误差线比柱子本身还大（精读页读者注 8）');
      else cap('表 1 · MuJoCo、FLEX 两行是 BCM 原文的数<br>准静态 CD 低 46%、HD 低 45%；动态只低 7.5%、2.6%，在一个标准差内');
    } };
  }

  /* ---------- scene 11: Tables 4 and 5 ---------- */
  const GARM = ['Hoodie', 'Dress', 'Coat', 'T-shirt', 'Pleat Skirt', 'Cakeskirt', 'L-Sleeves'];
  /* [garment][action] -> 12 numbers: CDs2r(pyb,isaac,ours), CDr2s(...), HDs2r(...), HDr2s(...) */
  const T4 = { Hoodie: [[0.0523, 0.0617, 0.0425, 0.0310, 0.0352, 0.0256, 0.1736, 0.1906, 0.1409, 0.1307, 0.1493, 0.1254], [0.0381, 0.0457, 0.0355, 0.0240, 0.0302, 0.0225, 0.1720, 0.1635, 0.1726, 0.0952, 0.0966, 0.1493], [0.0561, 0.0639, 0.0404, 0.0275, 0.0308, 0.0217, 0.2004, 0.2531, 0.1763, 0.0947, 0.1008, 0.0882]],
    Dress: [[0.1197, 0.1286, 0.0954, 0.0889, 0.0928, 0.0687, 0.2643, 0.2786, 0.2204, 0.2007, 0.2228, 0.1765], [0.0382, 0.0464, 0.0241, 0.0331, 0.0459, 0.0187, 0.1361, 0.1422, 0.0977, 0.1229, 0.1338, 0.0800], [0.0559, 0.0562, 0.0282, 0.0433, 0.0490, 0.0221, 0.1539, 0.1490, 0.0944, 0.1468, 0.1563, 0.0953]],
    Coat: [[0.1372, 0.0729, 0.0540, 0.1071, 0.0815, 0.0379, 0.5176, 0.2485, 0.1654, 0.2737, 0.2406, 0.1239], [0.0494, 0.0431, 0.0443, 0.0309, 0.0346, 0.0279, 0.2094, 0.1450, 0.1707, 0.1251, 0.1182, 0.1083], [0.1069, 0.0700, 0.0681, 0.0573, 0.0605, 0.0320, 0.3612, 0.2235, 0.2312, 0.1817, 0.1395, 0.1053]],
    'T-shirt': [[0.0675, 0.0721, 0.0546, 0.0532, 0.0567, 0.0419, 0.2113, 0.1986, 0.1644, 0.1522, 0.1710, 0.1197], [0.0309, 0.0370, 0.0209, 0.0227, 0.0314, 0.0132, 0.1217, 0.1275, 0.0980, 0.0778, 0.0966, 0.0512], [0.0476, 0.0426, 0.0349, 0.0348, 0.0341, 0.0226, 0.1676, 0.1489, 0.1420, 0.1109, 0.1058, 0.0798]],
    'Pleat Skirt': [[0.0654, 0.0613, 0.0572, 0.0540, 0.0388, 0.0326, 0.1473, 0.1511, 0.1446, 0.1236, 0.1089, 0.0736], [0.0210, 0.0250, 0.0171, 0.0256, 0.0255, 0.0126, 0.0737, 0.0856, 0.0582, 0.1383, 0.1199, 0.0857], [0.0300, 0.0237, 0.0287, 0.0241, 0.0201, 0.0159, 0.0892, 0.0788, 0.0991, 0.0878, 0.0908, 0.0707]],
    Cakeskirt: [[0.0852, 0.1021, 0.0579, 0.0588, 0.0598, 0.0406, 0.2056, 0.2319, 0.1744, 0.1767, 0.1872, 0.1725], [0.0410, 0.0519, 0.0304, 0.0266, 0.0308, 0.0179, 0.1497, 0.1642, 0.1327, 0.1082, 0.1082, 0.0962], [0.0778, 0.0822, 0.0439, 0.0487, 0.0517, 0.0269, 0.2120, 0.2036, 0.1485, 0.1573, 0.1719, 0.1222]],
    'L-Sleeves': [[0.0697, 0.0778, 0.0564, 0.0518, 0.0600, 0.0422, 0.2104, 0.2255, 0.1912, 0.1770, 0.2058, 0.1547], [0.0443, 0.0547, 0.0428, 0.0280, 0.0308, 0.0243, 0.1746, 0.1895, 0.1775, 0.1252, 0.1171, 0.0982], [0.0524, 0.0477, 0.0471, 0.0347, 0.0312, 0.0280, 0.1734, 0.1692, 0.1757, 0.1394, 0.1123, 0.1106]] };
  const T5 = { Hoodie: [null, [0.0858, 0.0875, 0.0469, 0.0489, 0.0451, 0.0312, 0.2857, 0.2933, 0.1998, 0.1865, 0.1804, 0.1642], [0.2941, 0.2868, 0.0502, 0.2422, 0.2313, 0.0537, 0.4789, 0.4748, 0.2032, 0.4409, 0.4098, 0.1789]],
    Dress: [null, [0.0646, 0.0489, 0.0235, 0.0575, 0.0395, 0.0199, 0.2145, 0.1548, 0.0955, 0.2367, 0.1530, 0.0901], [0.1705, 0.1613, 0.0312, 0.1646, 0.1287, 0.0299, 0.3609, 0.3258, 0.1108, 0.3912, 0.2917, 0.1413]],
    Coat: [null, [0.0860, 0.0786, 0.0387, 0.0698, 0.0607, 0.0220, 0.2576, 0.2347, 0.1563, 0.2629, 0.2167, 0.0871], [0.1482, 0.1141, 0.0650, 0.1551, 0.1018, 0.0268, 0.4149, 0.3477, 0.2050, 0.4125, 0.2714, 0.0883]],
    'T-shirt': [null, [0.0637, 0.0527, 0.0212, 0.0460, 0.0527, 0.0113, 0.1958, 0.1549, 0.0959, 0.1824, 0.1685, 0.0528], [0.2275, 0.0806, 0.0341, 0.2390, 0.0732, 0.0234, 0.4021, 0.2111, 0.1399, 0.4360, 0.1926, 0.0960]],
    'Pleat Skirt': [null, [0.0318, 0.0365, 0.0205, 0.0386, 0.0265, 0.0113, 0.1104, 0.1198, 0.0747, 0.1602, 0.1275, 0.0673], [0.1049, 0.0873, 0.0406, 0.1449, 0.0997, 0.0345, 0.1625, 0.1496, 0.1379, 0.2854, 0.1979, 0.1070]],
    Cakeskirt: [null, [0.0639, 0.0553, 0.0284, 0.0538, 0.0344, 0.0168, 0.2534, 0.1848, 0.1135, 0.2408, 0.1842, 0.0891], [0.2452, 0.2186, 0.0428, 0.2223, 0.1486, 0.0342, 0.4663, 0.3959, 0.1487, 0.4882, 0.3270, 0.1472]],
    'L-Sleeves': [null, [0.1125, 0.0773, 0.0425, 0.0799, 0.0386, 0.0247, 0.2833, 0.2377, 0.1726, 0.2708, 0.1619, 0.1062], [0.2046, 0.1452, 0.0577, 0.2276, 0.1525, 0.0844, 0.4118, 0.3477, 0.1763, 0.4761, 0.3646, 0.2757]] };
  function s11(G) {
    let mo = +(OPT[0] ?? 0), me = +(OPT[1] ?? 1);
    const MN = ['CD_s2r', 'CD_r2s', 'HD_s2r', 'HD_r2s'], SC3 = [COL.pyb, COL.isaac, COL.ours];
    floorRect(G, 0, 0, 22, 10, COL.table, { y: -0.02 });
    const bars = [], vls = [];
    GARM.forEach((gname, gi) => { G.add(lab(gname, [-9 + gi * 3, 0.2, 4.6], { size: 14 })); for (let a = 0; a < 3; a++) for (let s = 0; s < 3; s++) { const b = block(0.42, 1, 0.42, SC3[s], [-9 + gi * 3 - 0.5 + s * 0.5, 0.5, -2.6 + a * 2.2], { opacity: 0.95 }); G.add(b); bars.push([b, gi, a, s]); } });
    ['fling', 'fold', 'grasp'].forEach((t, a) => G.add(lab(t, [-11.6, 0.2, -2.6 + a * 2.2], { size: 14 })));
    G.add(lab('PyBullet', [-6, 0.2, -5.2], { size: 14, color: css(COL.pyb) }), lab('Isaac Sim', [-2.5, 0.2, -5.2], { size: 14, color: css(COL.isaac) }), lab('本文', [0.5, 0.2, -5.2], { size: 14, color: css(COL.ours) }));
    const ctls = [{ label: '模式', items: ['伪交互（表 4）', '机器人（表 5）'], get: () => mo, set: k => { mo = k; } }, { label: '指标', items: MN, get: () => me, set: k => { me = k; } }];
    const CLAIM = { '0|1': 'C.1 原文 fold 写 0.037/0.043/0.020，那其实是 CD_s2r 的均值；fling、grasp 对得上', '0|0': 'C.1 原文 fold 写 0.043/0.034/0.031，grasp 两家对调成 0.055/0.062', '1|1': 'C.2 原文 fold 0.056/0.042/0.020、grasp 0.199/0.134/0.041，都对得上', '1|0': 'C.2 原文 grasp 写降 70%/71%，对 PyBullet 应是 77%' };
    return { ctls, update(p) {
      const Tb = mo ? T5 : T4, g = seg(p, 0.05, 0.6), scale = mo ? 14 : 30;
      bars.forEach(([b, gi, a, s]) => { const row = Tb[GARM[gi]][a]; if (!row) { b.visible = false; return; } b.visible = true; const v = row[me * 3 + s], h = Math.max(0.03, v * scale * g); b.scale.y = h; b.position.y = h / 2; });
      const acts = mo ? [1, 2] : [0, 1, 2], means = acts.map(a => [0, 1, 2].map(s => GARM.reduce((t, gn) => t + Tb[gn][a][me * 3 + s], 0) / 7));
      const txt = acts.map((a, k) => { const m = means[k]; return `${['fling', 'fold', 'grasp'][a]} ${m.map(v => v.toFixed(3)).join('/')}`; }).join(' · '), red = acts.map((a, k) => { const m = means[k]; return `${['fling', 'fold', 'grasp'][a]} ${(100 * (1 - m[2] / m[0])).toFixed(0)}%/${(100 * (1 - m[2] / m[1])).toFixed(0)}%`; }).join(' · ');
      cap(`${mo ? '表 5' : '表 4'} ${MN[me]} 各动作均值，本文降幅（对 PyB/Isaac）：${red}<br>` + (CLAIM[`${mo}|${me}`] || `均值 PyB/Isaac/本文：${txt}`));
    } };
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
  function go(i, p0 = 0) {
    cur = (i + SCENES.length) % SCENES.length; showInfo(cur);
    if (api?.dispose) api.dispose();
    L.clear(root); LABS = []; PICKS = []; lastCap = null;
    const sc = SCENES[cur]; fly(...sc.cam); refDist = sc.cam[2] * aspectFix();
    const G = new THREE.Group(); root.add(G); pNow = p0; api = BUILD[cur](G); OPT = [];
    buildCtl();
    t0 = performance.now() - p0 * sc.dur * 1000; api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
  }
  S.onTick(() => {
    if (playing && api) {
      const sc = SCENES[cur], el = (performance.now() - t0) / 1000;
      if (el > sc.dur + HOLD) { t0 = performance.now(); pNow = 0; } else pNow = Math.min(1, el / sc.dur);
      api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
    }
    if (tw) { const k = L.reduced() ? 1 : Math.min(1, (performance.now() - tw.t0) / 900), e = L.ease(k), a = tw.from, b = tw.to; S.setView(L.lerp(a[0], b[0], e), L.lerp(a[1], b[1], e), L.lerp(a[2], b[2], e), [L.lerp(a[3].x, b[3].x, e), L.lerp(a[3].y, b[3].y, e), L.lerp(a[3].z, b[3].z, e)]); if (k >= 1) tw = null; }
    const f = clamp(S.dist / refDist, 0.6, 1.6); for (const sp of LABS) sp.scale.copy(sp.userData.s0).multiplyScalar(f);
  });
  S.onClick(() => PICKS, hit => { const g = hit?.object?.userData?.go ?? hit?.object?.parent?.userData?.go; if (g != null) go(g); });
  S.onHover(() => PICKS, hit => { $('stage').style.cursor = hit ? 'pointer' : ''; });
  $('ctl').addEventListener('click', e => { const b = e.target.closest('button[data-g]'); if (!b || !api?.ctls) return; const c = api.ctls[+b.dataset.g]; c.set(+b.dataset.k); api.update(pNow); $('scrub').value = Math.round(pNow * 1000); syncCtl(); });
  $('play').onclick = () => { if (!playing) t0 = performance.now() - pNow * SCENES[cur].dur * 1000; setPlay(!playing); };
  $('scrub').oninput = e => { setPlay(false); pNow = e.target.value / 1000; if (api) api.update(pNow); syncCtl(); };
  $('prev').onclick = () => go(cur - 1); $('next').onclick = () => go(cur + 1);
  btns.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); });
  stepsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; go(+b.dataset.i); if (!document.body.classList.contains('embed')) $('stage').scrollIntoView({ behavior: L.reduced() ? 'auto' : 'smooth', block: 'center' }); });
  document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' && e.key !== ' ') return; if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1); else if (e.key === ' ') { e.preventDefault(); $('play').click(); } });
  const s0 = clamp((parseInt(qs.get('scene'), 10) || 1) - 1, 0, SCENES.length - 1), pq = qs.get('p'); OPT = (qs.get('opt') || '').split(',').filter(x => x !== '');
  setPlay(playing && pq == null);
  go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0));
  window.__rgbDebug = { CLOTH, PCGLAB, SIMC, get cap() { return $('cap').textContent; } };
})();
