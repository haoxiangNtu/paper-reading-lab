'use strict';
/* SHAC (arXiv 2204.07137) taken apart into eleven animated scenes. Hyperparameters come from the paper's Tables 1, 4, 5
   and the released code NVlabs/DiffRL@a4c0dd1; bars in scene 10 are values read from the paper's vector figures.
   Scenes 2, 4, 5, 6, 7, 8, 9 compute on a toy: a driven damped pendulum whose gradients are real adjoints, not drawn.
   Every scene exposes update(p), a pure function of the timeline p in [0,1], so pause, scrub and loop are one call. */
/* ---------- the toy: a driven damped pendulum, its controller and critic, everything differentiated by hand ---------- */
const Toy = (function () {
  const P = { dt: 0.25, b: 0.5, A: 2, wd: 2 / 3, U: 1, gamma: 0.99, lam: 0.95, wLim: 2.6, sig: 0.25, cw: 0.02 };
  const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(6.283185307 * r());
  const X = 5;                                             /* input: sin phi, cos phi, w/3, sin psi, cos psi */
  function net(H, rnd, scale, S) {                            /* one hidden tanh layer; parameter vector: W1 (H*X), b1 (H), W2 (H), b2 */
    const n = H * X + H + H + 1, th = new Float64Array(n);
    for (let i = 0; i < n; i++) th[i] = (rnd ? gauss(rnd) : 0) * (scale ?? 0.5);
    return { H, n, th, s: S || 1 };
  }
  /* y(x), dy/dphi, dy/dw; optional accumulation of k * dy/dtheta into g */
  const hs = new Float64Array(64), sc = new Float64Array(64);
  function evalNet(N, phi, w, psi, out, g, k) {
    const { H, th } = N, s = Math.sin(phi), c = Math.cos(phi), x0 = s, x1 = c, x2 = w / 3, x3 = Math.sin(psi), x4 = Math.cos(psi);
    let y = th[N.n - 1], dp = 0, dw = 0; const o1 = H * X, o2 = o1 + H;
    for (let j = 0; j < H; j++) {
      const q = j * X, a = th[q] * x0 + th[q + 1] * x1 + th[q + 2] * x2 + th[q + 3] * x3 + th[q + 4] * x4 + th[o1 + j], h = Math.tanh(a), sech = 1 - h * h, v = th[o2 + j];
      y += v * h; const f = v * sech; dp += f * (th[q] * c - th[q + 1] * s); dw += f * th[q + 2] / 3;
      if (g) { const m = k * f * (N.s || 1); g[q] += m * x0; g[q + 1] += m * x1; g[q + 2] += m * x2; g[q + 3] += m * x3; g[q + 4] += m * x4; g[o1 + j] += m; g[o2 + j] += k * h * (N.s || 1); }
    }
    if (g) g[N.n - 1] += k * (N.s || 1);
    const S = N.s || 1;
    out.y = y * S; out.dp = dp * S; out.dw = dw * S; return y * S;
  }
  const O = { y: 0, dp: 0, dw: 0 };
  const MODE = { none: 0, hard: 1, soft: 2 };
  const softD = w => { const z = (Math.abs(w) - P.wLim) / 0.12; return 1 / (1 + Math.exp(-z)); };
  /* One window of Eq. (5), forward and then the adjoint recursion of Eqs. (9)-(12). start = [phi, w, psi].
     V = critic or null. Returns the loss, the gradient in g, and traces when asked. eps: fixed reparameterisation noise. */
  const BUF = { phi: new Float64Array(8200), w: new Float64Array(8200), psi: new Float64Array(8200), a: new Float64Array(8200), z: new Float64Array(8200), c: new Float64Array(8200), done: new Uint8Array(8200) };
  function rollout(pi, V, start, h, o = {}) {
    const rnd = o.rnd, mode = MODE[o.term || 'none'], g = o.g, trace = o.trace, sig = o.sig ?? 0, B = BUF;
    let phi = start[0], w = start[1], psi = start[2], disc = 1, surv = 1, ret = 0;
    B.phi[0] = phi; B.w[0] = w; B.psi[0] = psi; B.c[0] = 1;
    let t = 0, ended = false;
    for (; t < h; t++) {
      evalNet(pi, phi, w, psi, O);
      const e = sig > 0 ? sig * gauss(rnd) : 0, a = Math.tanh(O.y + e);
      B.z[t] = e; B.a[t] = a;
      const w1 = w + P.dt * (-Math.sin(phi) - P.b * w + P.A * Math.cos(psi) + P.U * a), p1 = phi + P.dt * w1;
      phi = p1; w = w1; psi += P.dt * P.wd;
      B.phi[t + 1] = phi; B.w[t + 1] = w; B.psi[t + 1] = psi;
      if (mode === 2) { surv *= 1 - softD(w); }
      B.c[t + 1] = surv;
      ret += disc * surv * (-Math.cos(phi) - P.cw * w * w - 0.01 * a * a);
      disc *= P.gamma;
      if (mode === 1 && Math.abs(w) > P.wLim) { t++; ended = true; break; }
    }
    const T = t; let vT = 0;
    if (V && !ended) vT = evalNet(V, phi, w, psi, O);
    const J = ret + disc * surv * vT, L = -J / (o.norm ?? h);
    if (!g && !trace) return { L, T, ended };
    /* adjoint: gp, gw hold dJ/ds_{t+1}. Sign flipped at the end. */
    let gp = 0, gw = 0;
    if (V && !ended) { evalNet(V, phi, w, psi, O); gp = disc * surv * O.dp; gw = disc * surv * O.dw; }
    /* fut: discounted return from step t+1 on, per unit of survival weight c_{t+1}; needed because c depends on w */
    let fut = (V && !ended) ? disc * vT : 0; /* computed backward */
    const k = -1 / (o.norm ?? h);
    const adj = trace ? new Float64Array(T + 1) : null;
    if (adj) adj[T] = Math.hypot(gp, gw);
    let d = disc;
    for (let i = T - 1; i >= 0; i--) {
      d /= P.gamma;
      const p1 = B.phi[i + 1], w1 = B.w[i + 1], p0 = B.phi[i], w0 = B.w[i], psi0 = B.psi[i], a = B.a[i], c1 = mode === 2 ? B.c[i + 1] : 1;
      const r = -Math.cos(p1) - P.cw * w1 * w1 - 0.01 * a * a;
      gp += d * c1 * Math.sin(p1); gw += d * c1 * (-2 * P.cw * w1);
      if (mode === 2) {
        /* c_{i+1} = c_i (1 - dhat(w_{i+1})), so everything from i+1 on depends on w_{i+1} through dhat */
        fut = fut + d * r;                                        /* in units of c: fut = sum d_k (c_k/c_{i+1}) r_k */
        const dh = softD(w1), ddh = dh * (1 - dh) / 0.12 * Math.sign(w1);
        gw += -B.c[i] * ddh * fut;
        fut = fut * (1 - dh);                                     /* now in units of c_i */
      }
      const dJda0 = d * c1 * (-0.02 * a);
      const dJda = dJda0 + (gw + gp * P.dt) * P.dt * P.U;
      evalNet(pi, p0, w0, psi0, O);
      const y = O.y + B.z[i], h2 = Math.tanh(y), sech = 1 - h2 * h2, da = dJda * sech;
      if (g) evalNet(pi, p0, w0, psi0, O, g, k * da);
      const ngw = (gw + gp * P.dt) * (1 - P.dt * P.b) + da * O.dw;
      const ngp = gp + (gw + gp * P.dt) * (-P.dt * Math.cos(p0)) + da * O.dp;
      gp = ngp; gw = ngw;
      if (adj) adj[i] = Math.hypot(gp, gw);
    }
    return { L, T, ended, adj, gp, gw };
  }
  function norm(g) { let s = 0; for (let i = 0; i < g.length; i++) s += g[i] * g[i]; return Math.sqrt(s); }
  /* Adam, same betas as Table 4 */
  function adam(th, lr, b1 = 0.7, b2 = 0.95) {
    const m = new Float64Array(th.length), v = new Float64Array(th.length); let t = 0;
    return g => { t++; for (let i = 0; i < th.length; i++) { m[i] = b1 * m[i] + (1 - b1) * g[i]; v[i] = b2 * v[i] + (1 - b2) * g[i] * g[i]; th[i] -= lr * (m[i] / (1 - Math.pow(b1, t))) / (Math.sqrt(v[i] / (1 - Math.pow(b2, t))) + 1e-8); } };
  }
  /* Algorithm 1 on the toy. cfg: h, N, useCritic, episodes, term ('none'|'hard') */
  function train(cfg) {
    const rnd = mulberry(cfg.seed ?? 7), pi = net(16, rnd, 0.4), V = net(cfg.vh ?? 16, rnd, 0.4, 20), Vt = net(cfg.vh ?? 16, null, 0, 20); Vt.th.set(V.th);
    const { h, N, episodes } = cfg, useCritic = cfg.useCritic, g = new Float64Array(pi.n), gv = new Float64Array(V.n), lrP = cfg.lrP ?? 0.01, lrV = cfg.lrV ?? 0.003, alpha = cfg.alpha ?? 0.2;
    if (cfg.init) pi.th.set(cfg.init);
    const optP = adam(pi.th, lrP), optV = adam(V.th, lrV);
    const st = []; for (let i = 0; i < N; i++) st.push(randStart(rnd));
    const log = [], snaps = [], obs = [], targ = [];
    const tick = cfg.every ?? 10;
        for (let ep = 0; ep <= episodes; ep++) {
      if (ep % tick === 0) { log.push({ ep, ret: evaluate(pi, 8, 400), steps: ep * N * h }); snaps.push(pi.th.slice()); }
      if (ep === episodes) break;
      g.fill(0); let gn = 0; obs.length = 0; targ.length = 0;
      for (let i = 0; i < N; i++) {
        const r = rollout(pi, useCritic ? Vt : null, st[i], h, { g, rnd, sig: P.sig, term: cfg.term, norm: h * N });
        const T = r.T, B = BUF;
        if (useCritic) { /* Eq. (7), TD-lambda over this window */
          const nextV = new Float64Array(T + 1);
          for (let t = 1; t <= T; t++) nextV[t] = (t === T && r.ended) ? 0 : evalNet(Vt, B.phi[t], B.w[t], B.psi[t], O);
          let G = nextV[T];
          for (let t = T - 1; t >= 0; t--) {
            const rr = -Math.cos(B.phi[t + 1]) - P.cw * B.w[t + 1] * B.w[t + 1] - 0.01 * B.a[t] * B.a[t];
            G = rr + P.gamma * (t === T - 1 ? nextV[T] : (1 - P.lam) * nextV[t + 1] + P.lam * G);
            obs.push(B.phi[t], B.w[t], B.psi[t]); targ.push(G);
          }
        }
        st[i] = r.ended ? randStart(rnd) : [BUF.phi[T], BUF.w[T], BUF.psi[T]];
      }
      gn = norm(g);
      if (gn > 1) for (let i = 0; i < g.length; i++) g[i] /= gn;      /* code: clip_grad_norm_(..., 1.0); paper does not mention it */
      if (isFinite(gn)) optP(g);
      if (useCritic) {
        const M = targ.length, bs = Math.ceil(M / 4);
        for (let it = 0; it < (cfg.citer ?? 16); it++) for (let b = 0; b < M; b += bs) {
          gv.fill(0); const e = Math.min(M, b + bs);
          for (let j = b; j < e; j++) { const y = evalNet(V, obs[3 * j], obs[3 * j + 1], obs[3 * j + 2], O), res = y - targ[j]; evalNet(V, obs[3 * j], obs[3 * j + 1], obs[3 * j + 2], O, gv, 2 * res / (e - b)); }
          optV(gv);
        }
        for (let i = 0; i < V.n; i++) Vt.th[i] = alpha * Vt.th[i] + (1 - alpha) * V.th[i];
      }
      log[log.length - 1].gn = Math.max(log[log.length - 1].gn || 0, gn);
    }
    return { pi, V: Vt, log, snaps };
  }
  function randStart(r) { return [(r() - 0.5) * 2 * 3.14159, (r() - 0.5) * 2, r() * 2 * 3.14159]; }
  /* mean per-step reward over fixed starts with no noise */
  function evaluate(pi, n, T) {
    const r = mulberry(1234); let s = 0;
    for (let i = 0; i < n; i++) { const st = randStart(r), o = rollout(pi, null, st, T, { sig: 0, norm: T }); s += -o.L; }
    return s / n;
  }
  /* value of Eq. (5) for a whole task of length H, restarting after a hard termination the way the released code does */
  function taskLoss(pi, V, H, term, starts) {
    let s = 0;
    for (const st0 of starts) {
      let left = H, st = st0, tot = 0, guard = 0, rs = mulberry(4242 + Math.round(st0[2] * 1000));
      while (left > 0 && guard++ < 64) {
        const r = rollout(pi, V, st, left, { term, norm: 1 });
        tot += r.L; left -= r.T; if (!r.ended) break;
        st = randStart(rs);
      }
      s += tot / H;
    }
    return s / starts.length;
  }
  /* largest Lyapunov exponent per step of the closed loop (tangent vector, analytic Jacobian) */
  function lyap(pi, start, T) {
    let phi = start[0], w = start[1], psi = start[2], u = 1, v = 0.3, s = 0, n0 = Math.hypot(u, v); u /= n0; v /= n0;
    for (let t = 0; t < T; t++) {
      evalNet(pi, phi, w, psi, O); const a = Math.tanh(O.y), se = (1 - a * a), dap = se * O.dp, daw = se * O.dw;
      const dw1 = v + P.dt * (-Math.cos(phi) * u - P.b * v + P.U * (dap * u + daw * v)), dp1 = u + P.dt * dw1;
      const w1 = w + P.dt * (-Math.sin(phi) - P.b * w + P.A * Math.cos(psi) + P.U * a); phi = phi + P.dt * w1; w = w1; psi += P.dt * P.wd;
      const n = Math.hypot(dp1, dw1) + 1e-300; if (t > 100) s += Math.log(n); u = dp1 / n; v = dw1 / n;
    }
    return s / (T - 101);
  }
  return { taskLoss, lyap, P, net, evalNet, rollout, train, evaluate, randStart, mulberry, gauss, norm, adam, BUF };
})();
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { sim: 0x8e9bb8, pi: 0x38d1ff, crit: 0x9d8cff, rew: 0xf2c14e, grad: 0xff7a59, cut: 0xe05d5d, wm: 0x4fc98a, soft: 0x4fc98a, hard: 0xe05d5d, none: 0x7cb8ff, robot: 0xc9d4ea };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyNote = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const fmtE = x => { if (!isFinite(x)) return '∞'; if (x === 0) return '0'; const e = Math.floor(Math.log10(Math.abs(x))); return Math.abs(e) < 3 ? x.toFixed(Math.max(0, 2 - e)) : (x / Math.pow(10, e)).toFixed(1) + '×10' + String(e).replace(/-/g, '⁻').replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]); };

  const SCENES = [
    { n: 1, part: '总览', title: '同一条轨迹，两种反传法', sub: 'BPTT 反传全程；SHAC 切成短窗口，窗口末端接评论家', dur: 12, cam: [0.08, 1.0, 45, [0, 0.8, 0.8]],
      html: dl([['BPTT', '反传穿过任务全程 H（Ant、Humanoid 都是 1000 步）'], ['SHAC', '每轮 N 条长 h 的轨迹，默认 N = 64，h = 32'], ['窗口之间', '状态接着走，梯度切断'], ['窗口末端', '加一项 γʰ V(s)，评论家估计窗口之后的回报']]) +
        '<p>两边用的是同一个可微仿真器。差别只在“梯度走多远”。</p><p>BPTT 的梯度要穿过上千个雅可比连乘，所以会炸（第 4 幕），损失曲面也崩成锯齿（第 5 幕）。SHAC 每 32 步切一刀，再用一个光滑的评论家代表切掉的未来。</p>' +
        '<p>红球是反向传播的梯度，大小表示量级的趋势。可以点上面那一排跳到第 4 幕，点下面任一窗口跳到第 7 幕。</p>' +
        guess('每个方块代表多个仿真步，画得比真实少。红球的放大是示意；真实的增长在第 4 幕当场算。') + src('§3.3 · 图 3') },
    { n: 2, part: '§3.1 仿真器', title: '把仿真器当一层网络', sub: '前向算状态，反向用式 (1) 传伴随；这一幕是真算的', dur: 13, cam: [0.12, 1.2, 28, [0, 3.0, 0.4]],
      html: dl([['前向', 's_{t+1} = F(s_t, a_t)'], ['反向', '∂L/∂s_t = ∂L/∂s_{t+1} · ∂F/∂s_t'], ['动作', '∂L/∂a_t = ∂L/∂s_{t+1} · ∂F/∂a_t'], ['积分器', '半隐式欧拉，论文和玩具都是']]) +
        '<p>“伴随”就是损失对中间量的导数 ∂L/∂s。反向传播每过一步，就左乘一个雅可比，这就是式 (1)。把这些连起来就穿过了整条轨迹。</p>' +
        '<p>这里的小摆是个玩具：受周期驱动、有阻尼的单摆，策略是 16 个隐藏单元的小网络。反向用手写的伴随递推算，和论文附录 A.1 的式 (9) 到 (12) 同一结构，下面数字里的差分值是另外用中心差分算的，用来对账。</p>' +
        '<p>真实的 dFlex 用复合刚体算法（CRBA）算质量矩阵，Cholesky 分解缓存给反向用，反向时间约为前向的 1.5 到 2.2 倍（表 12）。</p>' +
        toyNote('摆长、驱动幅值都是我设的，只有结构和论文相同。点按钮换起点，所有数都重算。') + src('§3.1 式 (1)(2) · 附录 A.1') },
    { n: 3, part: '§3.1 仿真器', title: '接触和限位：把力做成连续的', sub: '式 (3)(4)；按钮切换代码里各任务的真实系数', dur: 12, cam: [0.1, 1.2, 42, [1.0, 4.2, 0]],
      html: dl([['法向', 'f_c = (−k_n + k_d ḋ) min(d, 0) n'], ['切向', 'f_t = −(v_t/‖v_t‖) min(k_t‖v_t‖, μ‖f_c‖)'], ['限位', 'k_limit(q_lower − q) 或 k_limit(q_upper − q)'], ['d', '穿透深度，负值表示已穿透']]) +
        '<p>刚性接触在碰到的一瞬间速度就跳变，没法求导。这里允许物体轻微穿进地面，穿得越深推力越大，力对状态是连续的。代价是刚度大时雅可比很大，而且 d = 0 处仍有拐点，是连续但不光滑。</p>' +
        '<p><b>左</b>：小球按式 (3) 积分落地，穿透放大 100 倍显示。<b>中</b>：法向力随穿透深度，绿线是 ḋ = 0，黄线是当前下落速度。<b>右</b>：摩擦力随切向速度，到库仑上限后变平。</p>' +
        '<p>代码和式 (3) 有一处不同：dFlex 的阻尼项只在物体靠近时生效（<code>min(vn, 0)</code>），摩擦上限也只用弹性力。见精读页读者注。</p>' +
        guess('小球质量 1 kg 和下落高度是我设的。k_n、k_d、k_t、μ 来自 envs/*.py，这个按式 (3) 的小积分不是 dFlex。') + src('§3.1 式 (3)(4) · envs/ant.py 等') },
    { n: 4, part: '§3.2 为什么炸', title: '拖动 h，当场算梯度', sub: '混沌系统上的真实反传；自己把视野拉长', dur: 14, cam: [0.12, 1.08, 47, [0, 4.0, -2]],
      html: dl([['滑块', '窗口长度 h，1 到 2000 步'], ['前排', '每一步的 ‖∂L/∂s_t‖（对数高度）'], ['后排', '不同 h 下的 ‖∂L/∂θ‖（对数），8 个起点几何平均'], ['虚线', '10⁶，论文 §3.2 报的人形 1000 步梯度范数下限']]) +
        '<p><b>为什么会炸。</b>反传是雅可比连乘，混沌系统里一个小扰动平均每步放大 e^Λ 倍，Λ 叫李雅普诺夫指数。连乘 h 步就是 e^{Λh}。折扣 γᵗ 只能抵掉 ln γ = −0.01 每步。所以净增长率是 Λ + ln γ，大于 0 就指数爆炸。</p>' +
        '<p><b>看点。</b>前半段两个只差 10⁻⁶ rad 的摆从重合到分开，后半段红色波从窗口末端往回走。把 h 拖到 1000，再按“非混沌策略”，爆炸消失。这说明爆炸取决于闭环系统，不是长度本身。把 γ 切到 1，爆炸更快。</p>' +
        '<p>“训练后”也不炸，因为玩具学到了稳定的周期轨道。这一点和论文不同：论文说训练好的人形策略在 1000 步上梯度仍超过 10⁶。玩具的数字不能往人形外推。</p>' +
        toyNote('驱动单摆，dt = 0.25，页面用 JavaScript 现算，没有预存。这个系统比人形简单得多，只用来看机制。') + src('§3.2 · 附录 A.5 图 12 · PIPPS（Parmas 等 2018）的 curse of chaos') },
    { n: 5, part: '§3.2 地形', title: '损失地形：短视野为什么光滑', sub: '沿两个随机方向扫策略参数，学图 13 的做法当场扫', dur: 14, cam: [0.55, 0.92, 40, [0, 1.4, 0.6]],
      html: dl([['做法', 'θ + k₁d₁ + k₂d₂，k ∈ [−1, 1]，同一随机种子'], ['曲面', '29×29 个点，每点跑一遍损失'], ['颜色', '蓝低红高，每张图按自己的范围归一化'], ['小球', '12 个起点做梯度下降，看多少掉进坑']]) +
        '<p>论文图 2 和图 13 就是这种图：拿一个策略，只动参数，画损失。H = 1000 时表面布满尖刺，h = 32 加评论家时几乎只剩一个碗。</p>' +
        '<p>按钮换 h 和评论家。数字给出中线切片上的“转折次数”和“总变差/极差”，可以和我从图 2 矢量数据读出的值比：BPTT 18.6、1109 个转折；SHAC 1.42、2 个转折。</p>' +
        '<p>两个提醒。第一，光滑不等于正确：短视野不带评论家同样光滑，但极小点可能在别处。第二，归一化把 H = 1000 的幅度放大了，看数字里的“极差”。</p>' +
        toyNote('玩具的未训练混沌策略。评论家先在这个策略上拟合（策略学习率设 0）。切到“训练后”可以看到曲面变光滑，这是玩具学到稳定轨道的结果。') + src('§3.2 · 图 2 · 附录 A.5 图 13') },
    { n: 6, part: '§3.2 终止', title: '提前终止：SHAC 硬切，SuperMimic 软化', sub: '同一个损失，三种处理终止的方法；SuperMimic 改的就是这里', dur: 14, cam: [0.18, 0.98, 46, [-0.5, 1.6, -0.5]],
      html: dl([['无终止', '一直跑到底'], ['硬终止（SHAC）', '一触发就重置；V 记 0；折扣重新从 1 开始'], ['软权重（SuperMimic）', 'c_{t+1} = c_t (1 − d̂_{t+1})，d̂ ∈ [0,1] 可导']]) +
        '<p><b>硬终止的问题</b>是：参数改一点点，某条轨迹就可能早一步或晚一步摔倒，损失跳变，而且跳变的方向梯度完全看不到，因为判定条件的导数是 0。这是论文 §1 列的第三个困难。</p>' +
        '<p><b>SHAC 代码怎么做</b>（algorithms/shac.py）：<code>done</code> 触发时，如果是提前终止，<code>next_values</code> 置 0，超时才用评论家估计；累计回报和折扣清零，这个环境从新状态接着跑，梯度在这里断开。失败的信息靠两条路进策略：评论家学到失败附近价值低，以及高度奖励项。</p>' +
        '<p><b>SuperMimic 怎么改</b>：不重置，让学到的终止概率 d̂ 连乘进权重 ĉ，于是“别摔倒”本身有梯度。如果 d̂ 只取 0 或 1，公式退回到硬终止去掉重置的情形。这就是它说的“replaces hard episode termination”。</p>' +
        toyNote('摆的角速度超过 2.6 算“摔倒”。软权重 d̂ = σ((|ω|−2.6)/0.12)，这个形状是我设的；SuperMimic 的 d̂ 是用 BCE 学出来的。') + src('§1 · §3.2 · shac.py compute_actor_loss · SuperMimic §3.1、§3.3') },
    { n: 7, part: '§3.3 方法', title: '一个短窗口：式 (5)', sub: '窗口内的奖励 + 窗口末端的评论家，是真算的', dur: 14, cam: [0.06, 1.15, 45, [0, 3.2, 0]],
      html: dl([['损失', '−1/(Nh) Σᵢ [Σ γ^{t−t₀} R + γʰ V(s_{t₀+h})]'], ['h', '默认 32 步'], ['γ', '0.99；γ³² = 0.725'], ['起点', '接上一窗口的末态，不重置'], ['更新', '每窗口 1 步 Adam']]) +
        '<p>柱子是每步的 γᵏ r，紫块是窗口末端的 γʰ V。红色竖线处切断梯度，状态继续往前走。</p>' +
        '<p>按钮换 h，看评论家那一项占多少。γ = 0.99 时，如果奖励恒定，窗口外的回报占比是 γʰ：h = 32 时约 72.5%，h = 8 时约 92%。所以窗口越短，策略越依赖评论家，也越依赖它的梯度 ∂V/∂s。</p>' +
        '<p>代码里策略损失用的是目标网络 V_φ′；反传到动作要穿过 <code>torch.tanh(actions)</code>，并把梯度范数裁到 1.0。论文正文没提这两点。</p>' +
        toyNote('玩具用训练后的策略和评论家，h 和柱子都是当场算的。') + src('§3.3 式 (5) · 算法 1 · shac.py') },
    { n: 8, part: '§3.3 方法', title: '评论家怎么来：TD-λ', sub: '式 (6)(7)：把不同步数的回报按指数平均', dur: 14, cam: [0.42, 1.0, 40, [0, 1.6, 1.0]],
      html: dl([['损失', 'E‖V_φ(s) − Ṽ(s)‖²'], ['目标', 'Ṽ(s_t) = (1−λ) Σ λ^{k−1} G_t^k + λ^{h−t−1} G_t^{h−t}'], ['G_t^k', 'k 步奖励 + γᵏ V(s_{t+k})'], ['λ', '0.95'], ['训练', '每轮 16 遍，每遍 4 个小批'], ['目标网络', 'V′ ← αV′ + (1−α)V']]) +
        '<p>G 的步数 k 小，偏差大方差小（靠 V）；k 大，偏差小方差大（靠实测奖励）。TD-λ 用几何权重把它们混起来。前排柱子就是权重，最后一根吸收了剩余的全部权重，所以比前一根高。</p>' +
        '<p>曲面是玩具评论家当前学到的 V(φ, ω)，驱动相位 ψ 随时间扫动。点是最后一个窗口的状态：青点是目标 Ṽ，紫线是它和 V 之间的残差。</p>' +
        '<p>目标网络 α 的差别很大：表 4 里 CartPole、Ant 是 0.2，半衰期 0.43 轮，几乎等于没有；Humanoid、MTU 是 0.995，半衰期 138 轮。SuperMimic 干脆不要目标网络，相当于 α = 0。</p>' +
        '<p>我把代码里的 A、B 递推和式 (7) 用随机数对比过，差在 10⁻¹⁵ 量级，是同一个公式。</p>' +
        toyNote('玩具评论家是 16 个隐藏单元的单层网络，每轮 6 遍而不是 16 遍，为了在浏览器里快。') + src('§3.3 式 (6)(7) · 表 4 · shac.py compute_target_values') },
    { n: 9, part: '§3.3 算法 1', title: '整个循环：真的训练一遍', sub: '选 h 和是否带评论家，页面当场跑算法 1', dur: 16, cam: [0.06, 1.12, 46, [0, 4.6, 0]],
      html: dl([['循环', '采样 → 式 (5) 求梯度 → Adam 一步 → 算 Ṽ → 拟合 V → 更新 V′'], ['预算', '每种配置同样 76,800 个仿真步，和论文图 6 一样固定 N·h'], ['Adam', 'β = (0.7, 0.95)，来自表 4'], ['裁剪', '梯度范数 1.0，来自代码']]) +
        '<p>曲线是确定性策略的平均每步奖励（8 个起点，每条 400 步）。左边的摆是当前进度下策略的真实表现。</p>' +
        '<p>下表是同一段代码离线跑的 8 个种子平均（最差到最好），页面上的单次运行会在这些范围内波动。</p>' +
        '<table class="mini"><tr><th>h</th><th>带评论家</th><th>不带</th></tr><tr><td>8</td><td>0.123 (0.021–0.200)</td><td>0.032 (−0.032–0.077)</td></tr><tr><td>16</td><td>0.104 (0.023–0.192)</td><td>0.109 (0.076–0.140)</td></tr><tr><td>32</td><td>0.060 (0.010–0.116)</td><td>0.096 (0.006–0.197)</td></tr><tr><td>128</td><td>−0.005 (−0.026–0.053)</td><td>−0.006 (−0.043–0.069)</td></tr><tr><td>1000</td><td>−0.034 (−0.070–0.001)</td><td>−0.020 (−0.050–0.007)</td></tr></table>' +
        '<p>和论文对得上的：视野太长学不到东西，h = 8 不带评论家明显差。对不上的：玩具里 h = 16、32 不带评论家不比带差。这个任务太简单，32 步基本看够了。论文的 HalfCheetah 也有类似情况（读者注）。</p>' +
        toyNote('不要把玩具的奖励和论文对比。8 个种子只够看趋势。') + src('算法 1 · 表 4 · 图 6 的 N·h 设定') },
    { n: 10, part: '§4 结果', title: '论文里的数字', sub: '柱子全部来自原文矢量图和表格', dur: 12, cam: [0.03, 1.15, 46, [0, 4.4, 0]],
      html: dl([['图 6', 'Ant，h = 4 到 128，N·h = 2048，2000 轮'], ['图 7', '六个任务的学习曲线，五个种子平均'], ['表 12', '单轮时间：前向、反向、评论家']]) +
        '<p><b>h 的研究：</b>h = 16、32 最好（柱子高度相同，都约 7555）。h = 128 跌到约 1078。训练时间随 h 线性增长，我的拟合是 14.3 + 0.79h 分钟，尽管总样本数不变。</p>' +
        '<p><b>曲线终值：</b>SHAC 全部最好。注意 HalfCheetah 上不带评论家（No Critic）到了约 8286，高过 PPO、SAC，这和正文“不带评论家学不到合理策略”的笼统说法有出入。</p>' +
        '<p><b>规模：</b>Humanoid MTU 上 PPO 最高约 3271，用了 10.7 小时、6.5 亿步。SHAC 到这个奖励约 37 分钟、198 万步（我的读数）。论文写的是约 35 分钟、170 万步，>17 倍。</p>' +
        '<p><b>时间分解：</b>“评论家训练占比小”只在两个人形任务成立（10%、12%）。CartPole 和 Ant 上占 47%、34%。</p>' +
        src('图 6 · 图 7 · 表 12（数值从矢量路径读出，见精读页）') },
    { n: 11, part: '和 SuperMimic', title: 'SuperMimic 拿走了什么，改了什么', sub: '点按钮一项一项比', dur: 12, cam: [0.05, 0.98, 41, [-1, 1.2, 0.6]],
      html: dl([['拿走', '短窗口 + 评论家自举的目标函数结构；h = H = 32；γ = 0.99；λ = 0.95'], ['改掉（它自己说的）', '硬终止 → 生存权重 ĉ；去掉 EMA 目标网络'], ['改掉（我对比出的）', '可微仿真器 → 学到的世界模型；还有起点、策略形式等']]) +
        '<p>SuperMimic §3.3 原话的意思：策略和评论家的更新合起来，是“精神上类似 SHAC”的短视野演员-评论家。SHAC 穿过可微仿真器反传；SuperMimic 把硬的回合终止换成生存权重 ĉₜ，评论家也没有 EMA 目标网络。</p>' +
        '<p>它在相关工作里说的是 SHAC“启发”了它带评论家自举的目标函数。两边没有共享代码的说法，SuperMimic 也没公开代码。</p>' +
        '<p>最大的差别其实它一句带过：SHAC 需要仿真器本身可微，而且为此改造接触模型（第 3 幕）；SuperMimic 学一个可微替身，仿真器只产数据，接触可以不光滑。</p>' +
        src('SuperMimic §2、§3.1、§3.3、表 A.5 · 本文 §3.3 · <a href="../../papers/supermimic.html">SuperMimic 精读</a>') }
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
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  function relab(G, old, text, pos, o) { if (old) { G.remove(old); L.dispose(old); LABS = LABS.filter(s => s !== old); } const n = lab(text, pos, o); G.add(n); return n; }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Q = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color(), _Z = new THREE.Vector3(0, 0, 1);
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 14, 10);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65, emissive: o.emissive }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s, q) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, q || _Q0, _Sv)); }
  function hide(im, n) { setI(im, n, [0, -500, 0], 0.0001); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function bar(im, n, x, y0, y1, z, w, d, c) { const h = Math.abs(y1 - y0); if (h < 1e-4) { hide(im, n); } else setI(im, n, [x, (y0 + y1) / 2, z], [w, h, d]); if (c) colI(im, n, c); }
  /* a vertical curtain under a curve: readable from any angle */
  function curtain(n, color, opacity = 0.55) {
    const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 6), idx = [];
    for (let i = 0; i < n - 1; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false })); m.frustumCulled = false;
    const lg = new THREE.BufferGeometry(), lp = new Float32Array(n * 3); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    const top = new THREE.Line(lg, new THREE.LineBasicMaterial({ color })); top.frustumCulled = false; m.add(top);
    m.userData.set = (i, x, y, z, b) => { pos.set([x, b, z, x, y, z], i * 6); lp.set([x, y, z], i * 3); };
    m.userData.draw = k => { g.attributes.position.needsUpdate = true; lg.attributes.position.needsUpdate = true; g.setDrawRange(0, Math.max(0, (k - 1)) * 6); lg.setDrawRange(0, k); };
    return m;
  }
  /* a shaded surface with vertex colours */
  function surface(nx, nz, w, d) {
    const g = new THREE.BufferGeometry(), pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), idx = [];
    for (let i = 0; i < nz; i++) for (let j = 0; j < nx; j++) { const k = i * nx + j; pos[3 * k] = (j / (nx - 1) - 0.5) * w; pos[3 * k + 2] = (i / (nz - 1) - 0.5) * d; if (i < nz - 1 && j < nx - 1) idx.push(k, k + nx, k + 1, k + 1, k + nx, k + nx + 1); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.75, metalness: 0.02, flatShading: true })); m.frustumCulled = false;
    m.userData.set = (hArr, H, c) => { for (let k = 0; k < nx * nz; k++) { pos[3 * k + 1] = hArr[k] * H; const q = c(hArr[k]); col[3 * k] = q[0]; col[3 * k + 1] = q[1]; col[3 * k + 2] = q[2]; } g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.computeVertexNormals(); };
    return m;
  }
  const ramp = t => { t = clamp(t, 0, 1); return [0.16 + 0.8 * t, 0.42 + 0.14 * Math.sin(t * 3.14) - 0.1 * t, 0.86 - 0.62 * t]; };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  /* pendulums as instanced rods + bobs */
  function pendulums(G, n, o = {}) {
    const rods = inst(new THREE.CylinderGeometry(1, 1, 1, 8), n), bobs = inst(BALL, n), piv = inst(BALL, n); G.add(rods, bobs, piv);
    const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(); const Ln = o.len || 1.6, c = hex3(o.color || COL.pi);
    for (let i = 0; i < n; i++) { colI(rods, i, hex3(COL.robot)); colI(bobs, i, c); colI(piv, i, hex3(COL.sim)); }
    return {
      set(i, x, y, z, phi, col) {
        const ex = x + Ln * Math.sin(phi), ey = y - Ln * Math.cos(phi);
        dir.set(Math.sin(phi), -Math.cos(phi), 0); _Q.setFromUnitVectors(up, dir);
        setI(rods, i, [(x + ex) / 2, (y + ey) / 2, z], [0.05 * (o.t || 1), Ln, 0.05 * (o.t || 1)], _Q); setI(bobs, i, [ex, ey, z], 0.2 * (o.t || 1)); setI(piv, i, [x, y, z], 0.09 * (o.t || 1));
        if (col) colI(bobs, i, col);
      },
      off(i) { hide(rods, i); hide(bobs, i); hide(piv, i); },
      done() { done(rods); done(bobs); done(piv); }
    };
  }
  const textBtns = (label, items, cur, key) => `<span>${label}</span>` + items.map((t, k) => `<button type="button" data-g="${key}" data-k="${k}" aria-pressed="${k === cur}">${t}</button>`).join('');

  /* ---------- toy state shared across scenes, built once on demand ---------- */
  const TOY = {
    _pa: null, _pb: null, _tr: null, _c: {},
    get A() { if (!this._pa) { this._pa = Toy.net(16, Toy.mulberry(3), 0.4); } return this._pa; },   /* chaotic closed loop */
    get B() { if (!this._pb) { const r = Toy.mulberry(7); this._pb = Toy.net(16, r, 0.4); } return this._pb; },   /* not chaotic */
    get trained() { if (!this._tr) this._tr = Toy.train({ h: 32, N: 8, useCritic: true, episodes: 300, citer: 6, seed: 101, vh: 16 }); return this._tr; },
    get V0() { if (!this._v0) this._v0 = Toy.train({ h: 32, N: 8, useCritic: true, episodes: 150, citer: 6, seed: 103, lrP: 0, init: this.A.th }).V; return this._v0; },
    starts(n, seed = 77) { const r = Toy.mulberry(seed), s = []; for (let i = 0; i < n; i++) s.push(Toy.randStart(r)); return s; },
    dir(pi, seed) { const r = Toy.mulberry(seed), d = new Float64Array(pi.n); for (let i = 0; i < pi.n; i++) d[i] = Toy.gauss(r); const n = Toy.norm(d); for (let i = 0; i < pi.n; i++) d[i] /= n; return d; }
  };
  const metrics = o => { let tv = 0, turns = 0, mn = 1e9, mx = -1e9; for (let i = 0; i < o.length; i++) { if (o[i] < mn) mn = o[i]; if (o[i] > mx) mx = o[i]; if (i) tv += Math.abs(o[i] - o[i - 1]); if (i > 1 && Math.sign(o[i] - o[i - 1]) !== Math.sign(o[i - 1] - o[i - 2])) turns++; } return { tv: tv / (mx - mn || 1), turns, mn, mx, range: mx - mn }; };

  /* ---------- scene 1: BPTT vs SHAC graph ---------- */
  function s1(G) {
    const n = 44, X0 = -17, X1 = 17, zB = -4.5, zS = 3.5;
    const rowB = new THREE.Group(), rowS = new THREE.Group(); G.add(rowB, rowS);
    const bB = inst(BOX, n); rowB.add(bB);
    for (let i = 0; i < n; i++) { setI(bB, i, [L.lerp(X0, X1, i / (n - 1)), 0.45, zB], [0.56, 0.8, 1.1]); colI(bB, i, hex3(COL.sim)); } done(bB);
    rowB.add(L.line([[X0, 0.45, zB], [X1, 0.45, zB]], COL.sim, { opacity: 0.5 }));
    const hitB = L.box(X1 - X0 + 2, 1.2, 1.8, COL.sim, { opacity: 0.02, edges: false }); hitB.material.depthWrite = false; hitB.position.set(0, 0.5, zB); hitB.userData.go = 3; rowB.add(hitB); PICKS.push(hitB);
    rowB.add(lab('BPTT：反传穿过全部 H = 1000 步（点这里到第 4 幕）', [-4, 3.4, zB - 1.2], { border: 'rgba(255,122,89,.8)' }));
    const W = 5, perW = 8, gap = 1.1, ww = (X1 - X0 - gap * (W - 1) - 1.4 * W) / W; const wins = [];
    const rows = 5;
    const bS = inst(BOX, W * perW * rows); rowS.add(bS); let c = 0;
    for (let k = 0; k < W; k++) {
      const x0 = X0 + k * (ww + gap + 1.4);
      for (let r = 0; r < rows; r++) for (let i = 0; i < perW; i++) { const op = r === 0 ? 1 : 0.5 - 0.07 * r; setI(bS, c, [x0 + (i + 0.5) * ww / perW, 0.45, zS - r * 1.25], [ww / perW * 0.76, 0.8, 0.95]); colI(bS, c, hex3(COL.sim).map(v => v * (r === 0 ? 1 : 0.62))); c++; }
      const v = L.box(1.0, 1.5, 1.0, COL.crit, { edgeOpacity: 0.3 }); v.position.set(x0 + ww + 0.55, 0.75, zS); rowS.add(v);
      const hit = L.box(ww + 1.4, 1.6, 1.6, COL.crit, { opacity: 0.02, edges: false }); hit.material.depthWrite = false; hit.position.set(x0 + ww / 2 + 0.3, 0.6, zS); hit.userData.go = 6; rowS.add(hit); PICKS.push(hit);
      if (k < W - 1) rowS.add(L.line([[x0 + ww + 1.5, 0, zS + 1], [x0 + ww + 1.5, 2.3, zS + 1]], COL.cut, { opacity: 0.95 }));
      wins.push({ x0, x1: x0 + ww });
    }
    done(bS);
    rowS.add(lab('SHAC：每窗口 32 步，末端接评论家 V（点窗口到第 7 幕）', [-6, 0.4, zS + 4.2], { border: 'rgba(157,140,255,.8)' }));
    rowS.add(lab('红线处切断梯度，状态继续走', [4.5, 0.4, zS + 6.6], { size: 18 }));
    rowS.add(lab('并行 N 条，默认 64', [13.5, 0.4, zS + 6.6], { size: 18 }));
    const ball = inst(BALL, 1 + W), balls = ball; G.add(ball); colI(ball, 0, hex3(COL.grad)); for (let k = 0; k < W; k++) colI(ball, k + 1, hex3(COL.grad)); done(ball);
    let show = 2;
    return { ctl: { html: textBtns('显示', ['BPTT', 'SHAC', '都看'], 2, 'm'), on(g, k) { show = k; } },
      update(p) {
        rowB.visible = show !== 1; rowS.visible = show !== 0;
        const q = (p * 2.2) % 1;
        if (show !== 1) { const x = L.lerp(X1, X0, q); setI(balls, 0, [x, 1.3 + q * 0.8, zB], 0.12 + 0.9 * Math.pow(q, 3)); } else hide(balls, 0);
        wins.forEach((w, k) => { if (show !== 0) { setI(balls, k + 1, [L.lerp(w.x1 + 0.5, w.x0, q), 1.3, zS], 0.2); } else hide(balls, k + 1); });
        done(balls);
        cap(show === 0 ? 'BPTT：一条路径上<b>上千个雅可比连乘</b>，梯度越往前越大（红球放大是示意）' : show === 1 ? 'SHAC：每次只穿过 <b>32 步</b>，窗口之外交给评论家' : '上：反传全程。下：<b>短窗口 + 评论家</b>，红线处切断梯度');
      } };
  }

  /* ---------- scene 2: forward and backward through the simulator (computed) ---------- */
  function s2(G) {
    const h = 9, Pd = pendulums(G, h + 1, { len: 1.5 }), bars = inst(BOX, h + 1), abar = inst(BOX, h); G.add(bars, abar);
    G.add(L.grid(30, 30));
    const Xs = i => -12 + 24 * i / h, Y = 5.2;
    for (let i = 0; i < h; i++) G.add(L.line([[Xs(i) + 0.5, Y + 1.1, 0], [Xs(i + 1) - 0.5, Y + 1.1, 0]], COL.pi, { opacity: 0.6 }));
    G.add(lab('前向 F：状态 → 下一状态', [-8, Y + 2.1, 0], { size: 22 }), lab('反向：‖∂L/∂s_t‖（柱高按真实值）', [8.5, 2.9, 3.6], { size: 22, border: 'rgba(255,122,89,.8)' }));
    const pi = TOY.A, g = new Float64Array(pi.n); let seed = 11, tr, fd, ad, phi = [], adj = [], acts = [], maxA = 1;
    function run() {
      const st = TOY.starts(1, seed)[0]; g.fill(0);
      const r = Toy.rollout(pi, null, st, h, { g, trace: true, norm: h }); adj = Array.from(r.adj); phi = Array.from(Toy.BUF.phi.slice(0, h + 1)); acts = Array.from(Toy.BUF.a.slice(0, h));
      maxA = Math.max(...adj.filter(isFinite), 1e-9);
      const d = TOY.dir(pi, 5), e = 1e-6, t0 = pi.th.slice(); for (let i = 0; i < pi.n; i++) pi.th[i] = t0[i] + e * d[i]; const lp = Toy.rollout(pi, null, st, h, { norm: h }).L; for (let i = 0; i < pi.n; i++) pi.th[i] = t0[i] - e * d[i]; const lm = Toy.rollout(pi, null, st, h, { norm: h }).L; pi.th.set(t0);
      fd = (lp - lm) / (2 * e); ad = 0; for (let i = 0; i < pi.n; i++) ad += g[i] * d[i]; tr = r;
    }
    run();
    return { ctl: { html: `<span>起点</span><button type="button" data-g="s" data-k="0" aria-pressed="false">换一个起点</button>`, on() { seed += 13; run(); } },
      update(p) {
        const f = seg(p, 0, 0.45) * (h + 0.5), b = seg(p, 0.52, 0.95) * (h + 1.5);
        for (let i = 0; i <= h; i++) {
          if (i <= f) Pd.set(i, Xs(i), Y, 0, phi[i]); else Pd.off(i);
          const on = h - i < b; const H = on ? 3.0 * adj[i] / maxA : 0; bar(bars, i, Xs(i), 0, Math.max(0.001, H), 3.2, 1.3, 0.8, hex3(COL.grad));
          if (i < h) { if (i < f) bar(abar, i, Xs(i) + 0.9, Y - 1.8, Y - 1.8 + acts[i] * 0.8 + 0.001, 0, 0.32, 0.32, hex3(COL.rew)); else hide(abar, i); }
        }
        Pd.done(); done(bars); done(abar);
        cap(p < 0.5 ? `前向：策略给动作（黄），仿真器积分。第 ${Math.min(h, Math.floor(f))} 步，φ = <b>${(phi[Math.min(h, Math.floor(f))]).toFixed(2)}</b> rad`
          : `反向：沿一个随机方向，伴随算的导数 <b>${ad.toExponential(4)}</b>，中心差分 <b>${fd.toExponential(4)}</b>。两者一致才说明反传是对的`);
      } };
  }

  /* ---------- scene 3: contact and joint-limit forces, Eq. (3) ---------- */
  function s3(G) {
    const SET = [['Ant', 4e4, 1e4, 3e3, 0.75], ['Humanoid', 2e4, 5e3, 1e3, 0.75], ['Cheetah', 2e4, 1e3, 1e3, 1.0], ['MTU', 5e3, 2e3, 1e3, 0.5]];
    let cur = 0, tr = null;
    G.add(L.grid(40, 40));
    const X0 = -9.5, ground = L.box(7, 0.1, 5, COL.sim, { opacity: 0.5 }); ground.position.set(X0, 0.5, 0); G.add(ground);
    const ball = L.sphere(0.8, COL.rew); G.add(ball);
    const fcA = curtain(80, COL.wm, 0.4), fcB = curtain(80, COL.rew, 0.35), ftC = curtain(80, COL.pi, 0.45); G.add(fcA, fcB, ftC);
    const mark1 = L.sphere(0.2, COL.grad), mark2 = L.sphere(0.2, COL.grad); G.add(mark1, mark2);
    const ax = (a, b, c) => G.add(L.line(a, c || COL.sim, { opacity: 0.8 }));
    const x1 = -3.5, wf = 9, x2 = 7.5, wt = 8, Hf = 9, dmax = 0.02;
    ax([[x1, 0, 0], [x1 + wf, 0, 0]]); ax([[x1, 0, 0], [x1, Hf + 0.5, 0]]); ax([[x2, 0, 0], [x2 + wt, 0, 0]]); ax([[x2, 0, 0], [x2, Hf + 0.5, 0]]);
    G.add(lab('法向力 f_c 随穿透深度', [x1 + wf / 2, Hf + 1.5, 0], { size: 22 }), lab('摩擦力 f_t 随切向速度', [x2 + wt / 2, Hf + 1.5, 0], { size: 22 }), lab('小球（穿透放大 100 倍，接触阶段慢放）', [X0, 8.2, 0], { size: 20 }));
    const tL = [lab('穿透 2 cm', [x1 + wf, -0.8, 0], { size: 18 }), lab('0', [x1, -0.8, 0], { size: 18 }), lab('0.3 m/s', [x2 + wt, -0.8, 0], { size: 18 })]; tL.forEach(l => G.add(l));
    let lP = null, fmax = 1;
    function sim() {
      const [, kn, kd, kt, mu] = SET[cur], dt = 1 / 60 / 16, m = 1, g = 9.81; let d = 0.2, v = 0, T = []; let dmin = 0, fpk = 0;
      let i0 = -1, i1 = -1; for (let i = 0; i < 800; i++) { const fc = (-kn + kd * v) * Math.min(d, 0), f = fc - m * g; v += dt * f / m; d += dt * v; if (d < dmin) dmin = d; if (fc > fpk) fpk = fc; if (d < 0 && i0 < 0) i0 = i; if (d >= 0 && i0 >= 0 && i1 < 0) i1 = i; T.push([d, v, fc]); }
      if (i1 < 0) i1 = T.length - 1;
      tr = { T, dmin, fpk, i0, i1, vImp: Math.sqrt(2 * g * 0.2) };
      /* curves: f_c(d) at ddot 0 and at impact speed */
      fmax = Math.max(kn * dmax, (kn + kd * tr.vImp) * dmax);
      for (let i = 0; i < 80; i++) { const dd = dmax * i / 79, x = x1 + wf * i / 79; fcA.userData.set(i, x, Hf * kn * dd / fmax, 0.0, 0); fcB.userData.set(i, x, Hf * (kn + kd * tr.vImp) * dd / fmax, -0.5, 0); const vt = 0.3 * i / 79, cl = Math.min(kt * vt, mu * tr.fpk); ftC.userData.set(i, x2 + wt * i / 79, Hf * cl / (mu * tr.fpk * 1.1 + 1e-9), 0, 0); }
      fcA.userData.draw(80); fcB.userData.draw(80); ftC.userData.draw(80);
      lP = relab(G, lP, `k_n ${SET[cur][1]}  k_d ${SET[cur][2]}  k_t ${SET[cur][3]}  μ ${SET[cur][4]}`, [-9.5, 12.0, 0], { size: 20, border: 'rgba(242,193,78,.8)' });
    }
    sim();
    return { ctl: { html: textBtns('系数', SET.map(s => s[0]), 0, 'c'), on(g, k) { cur = k; sim(); } },
      update(p) {
        const ia = tr.i0, ib = tr.i1, i = Math.min(tr.T.length - 1, Math.round(p < 0.35 ? p / 0.35 * ia : p < 0.8 ? ia + (p - 0.35) / 0.45 * (ib - ia) : ib + (p - 0.8) / 0.2 * Math.min(tr.T.length - 1 - ib, ia))), [d, v, fc] = tr.T[i];
        const yb = 0.55 + 0.8 + (d >= 0 ? d * 30 : d * 100 * 0.9); ball.position.set(X0, yb, 0);
        const pen = Math.max(0, -d); mark1.position.set(x1 + wf * Math.min(1, pen / dmax), Hf * fc / fmax, 0.1); mark2.visible = false;
        cap(`穿透 <b>${(pen * 1000).toFixed(2)} mm</b>，法向力 <b>${fc.toFixed(0)} N</b>。这次落地最深 ${(-tr.dmin * 1000).toFixed(2)} mm，峰值 ${tr.fpk.toFixed(0)} N。力随状态连续，所以能求导`);
      } };
  }

  /* ---------- scene 4: gradient explosion on a chaotic toy; the horizon is yours ---------- */
  function s4(G) {
    G.add(L.grid(44, 44));
    const NB = 120, sky = inst(BOX, NB), HS = [1, 4, 8, 16, 32, 64, 128, 256, 512, 1000, 2000], sw = inst(BOX, HS.length), tw = pendulums(G, 2, { len: 1.8, t: 1.4 }); G.add(sky, sw);
    let H = 32, pol = 0, gam = 0.99, res = {}, adj = null, gLog = [], ly = 0, trajA = [], trajB = [], lastSel = null, labs = [], gL = null;
    const XL = -20, XR = 20, zF = 3.5, zB = -9, kY = 0.46;
    const swX = i => -16 + 32 * i / (HS.length - 1);
    const ref = L.line([[-19, 0, zB - 1.4], [19, 0, zB - 1.4]], COL.rew, { opacity: 0.95 }); G.add(ref);
    const lRef = lab('10⁶（论文 §3.2 的人形读数）', [14, 0, zB - 1.4], { size: 20, border: 'rgba(242,193,78,.8)' }); G.add(lRef);
    G.add(lab('前排：这一次反传中每一步的 ‖∂L/∂s_t‖，对数高度', [-6, -0.2, zF + 3.6], { size: 22 }));
    HS.forEach((h, i) => { const t = lab(String(h), [swX(i), -0.75, zB + 1.2], { size: 18 }); G.add(t); });
    const curPolicy = () => pol === 0 ? TOY.A : pol === 1 ? TOY.B : TOY.trained.pi;
    const ySw = v => Math.max(0.03, (v + 3) * kY);
    function sweep() {
      const pi = curPolicy(), st = TOY.starts(8, 5), g = new Float64Array(pi.n), gs = Toy.P.gamma; Toy.P.gamma = gam;
      gLog = HS.map(h => { let s = 0; for (const a of st) { g.fill(0); Toy.rollout(pi, null, a, h, { g }); s += Math.log10(Toy.norm(g) + 1e-30); } return s / st.length; });
      Toy.P.gamma = gs;
      ly = 0; { const r = Toy.mulberry(8); for (let i = 0; i < 4; i++) ly += Toy.lyap(pi, Toy.randStart(r), 3000) / 4; }
      ref.position.y = ySw(6); lRef.position.y = ySw(6) + 0.5;
      gL = relab(G, gL, '后排：不同 h 的 log₁₀‖∂L/∂θ‖', [-10, ySw(6) + 0.5, zB - 1.4], { size: 22 });
    }
    function one() {
      const pi = curPolicy(), st = TOY.starts(1, 21)[0], g = new Float64Array(pi.n), gs = Toy.P.gamma; Toy.P.gamma = gam;
      const r = Toy.rollout(pi, null, st, H, { g, trace: true }); adj = r.adj; res.gn = Toy.norm(g); res.T = r.T;
      const a = Toy.BUF; trajA = Array.from(a.phi.slice(0, H + 1));
      Toy.rollout(pi, null, [st[0] + 1e-6, st[1], st[2]], H, {}); trajB = Array.from(a.phi.slice(0, H + 1));
      Toy.P.gamma = gs;
    }
    sweep(); one();
    return { ctl: { html: `<label class="hz">窗口 h = <b id="hv">32</b> <input id="hr" type="range" min="0" max="1000" value="456" aria-label="窗口长度 h"></label>` + textBtns('策略', ['混沌', '非混沌', '训练后'], 0, 'p') + textBtns('γ', ['0.99', '1'], 0, 'g'),
        bind(box) { box.querySelector('#hr').oninput = e => { H = Math.max(1, Math.round(Math.pow(10, e.target.value / 1000 * Math.log10(2000)))); box.querySelector('#hv').textContent = H; one(); this.owner.update(pNow); }; },
        on(g, k) { if (g === 'p') pol = k; else gam = k ? 1 : 0.99; sweep(); one(); } },
      setH(v) { H = v; one(); },
      update(p) {
        const f = seg(p, 0, 0.42), wave = seg(p, 0.48, 0.96), nb = Math.min(NB, H + 1);
        for (let b = 0; b < NB; b++) {
          if (b >= nb) { hide(sky, b); continue; }
          const t = Math.round(b / Math.max(1, nb - 1) * H), v = adj[t], lg = Math.log10((isFinite(v) ? v : 1e300) + 1e-30), on = t >= H * (1 - wave) - 1e-9 && wave > 0;
          const x = L.lerp(XL, XR, nb === 1 ? 0.5 : b / (nb - 1)), w = Math.max(0.12, (XR - XL) / nb * 0.8);
          if (on) { const hgt = Math.max(0.03, (lg + 6) * 0.34); bar(sky, b, x, 0, hgt, zF, w, 1.4, ramp((lg + 4) / 10)); } else hide(sky, b);
        }
        done(sky);
        HS.forEach((h, i) => { bar(sw, i, swX(i), 0, ySw(gLog[i]), zB, 1.8, 1.8, (Math.abs(Math.log(h / H)) < 0.34) ? hex3(COL.grad) : hex3(COL.sim)); }); done(sw);
        const t = Math.round(f * H), a = trajA[t], b = trajB[t];
        tw.set(0, -16, 12, zF, a, hex3(COL.pi)); tw.set(1, -16, 12, zF, b, hex3(COL.rew)); tw.done();
        const net = ly + Math.log(gam), dphi = Math.abs(a - b);
        cap(p < 0.46 ? `第 ${t} 步：两个摆起点差 10⁻⁶ rad，现在差 <b>${fmtE(dphi)}</b> rad。平均每步放大 e^Λ，Λ = ${ly.toFixed(3)}，加上折扣净 ${net.toFixed(3)}`
          : `h = <b>${H}</b>：这个起点的 ‖∂L/∂θ‖ = <b>${fmtE(res.gn)}</b>。${H < 256 ? '把 h 拖到 1000 再试试' : '再按“非混沌”比一比'}`);
      } };
  }

  /* ---------- scene 5: landscape over two random directions ---------- */
  function s5(G) {
    const n = 29, W = 22, surf = surface(n, n, W, W), HT = 6; G.add(surf); surf.position.y = 0.05;
    const NB = 12, balls = inst(BALL, NB); G.add(balls); for (let i = 0; i < NB; i++) colI(balls, i, [1, 0.95, 0.75]); done(balls);
    const fr = L.grid(W, 10); G.add(fr);
    const HO = [8, 32, 128, 512, 1000]; let hI = 4, crit = 0, pol = 0, D = null, paths = null, m = null, got = 0;
    let tagL = null;
    const cache = TOY._c;
    function compute() {
      const key = `s5:${HO[hI]}:${crit}:${pol}`;
      if (!cache[key]) {
        const pi = pol ? TOY.trained.pi : TOY.A, V = crit ? (pol ? TOY.trained.V : TOY.V0) : null, d1 = TOY.dir(pi, 31), d2 = TOY.dir(pi, 47), st = TOY.starts(2), th = pi.th.slice(), h = HO[hI], A = new Float64Array(n * n);
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = -1 + 2 * j / (n - 1), b = -1 + 2 * i / (n - 1); for (let q = 0; q < pi.n; q++) pi.th[q] = th[q] + a * d1[q] + b * d2[q]; let s = 0; for (const x of st) s += Toy.rollout(pi, V, x, h, { norm: h }).L; A[i * n + j] = s / st.length; }
        /* a finer centre slice for the roughness numbers */
        const S1 = new Float64Array(201), st4 = TOY.starts(4); for (let k = 0; k < 201; k++) { const a = -1 + 2 * k / 200; for (let q = 0; q < pi.n; q++) pi.th[q] = th[q] + a * d1[q]; let s = 0; for (const x of st4) s += Toy.rollout(pi, V, x, h, { norm: h }).L; S1[k] = s / 4; }
        pi.th.set(th);
        cache[key] = { A, met: metrics(S1) };
      }
      const { A, met } = cache[key]; m = met;
      let mn = Infinity, mx = -Infinity; for (const v of A) { if (v < mn) mn = v; if (v > mx) mx = v; }
      D = new Float64Array(n * n); for (let k = 0; k < n * n; k++) D[k] = (A[k] - mn) / (mx - mn || 1);
      surf.userData.set(D, HT, ramp);
      /* gradient descent on the grid, starting from 12 fixed cells */
      const r = Toy.mulberry(9); paths = []; got = 0; const gmin = D.indexOf(Math.min(...D));
      for (let b = 0; b < NB; b++) {
        let i = 2 + Math.floor(r() * (n - 4)), j = 2 + Math.floor(r() * (n - 4)); const pth = [[i, j]];
        for (let st = 0; st < 40; st++) { let bi = i, bj = j, bv = D[i * n + j]; for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue; if (D[ii * n + jj] < bv) { bv = D[ii * n + jj]; bi = ii; bj = jj; } } if (bi === i && bj === j) break; i = bi; j = bj; pth.push([i, j]); }
        paths.push(pth); if (Math.hypot(i - Math.floor(gmin / n), j - gmin % n) <= 2) got++;
      }
      tagL = relab(G, tagL, `${crit ? 'h' : (HO[hI] >= 128 ? 'H' : 'h')} = ${HO[hI]}${crit ? ' + 评论家' : ''}，${pol ? '训练后' : '未训练混沌'}策略`, [0, -0.4, W / 2 + 2.2], { size: 22, border: 'rgba(157,140,255,.8)' });
    }
    compute();
    return { ctl: { html: textBtns('h', HO.map(String), hI, 'h') + textBtns('评论家', ['关', '开'], 0, 'c') + textBtns('策略', ['未训练', '训练后'], 0, 'p'),
        on(g, k) { if (g === 'h') hI = k; if (g === 'c') crit = k; if (g === 'p') pol = k; compute(); } },
      update(p) {
        const q = seg(p, 0.1, 0.92);
        paths.forEach((pth, b) => { const f = q * (pth.length - 1), i0 = Math.floor(f), a = pth[i0], c = pth[Math.min(pth.length - 1, i0 + 1)], t = f - i0, x = L.lerp(a[1], c[1], t), z = L.lerp(a[0], c[0], t), h = D[a[0] * n + a[1]] * (1 - t) + D[c[0] * n + c[1]] * t; setI(balls, b, [(x / (n - 1) - 0.5) * W, h * HT + 0.42, (z / (n - 1) - 0.5) * W], 0.3); }); done(balls);
        cap(`中线切片：<b>${m.turns}</b> 个转折，总变差/极差 <b>${m.tv.toFixed(1)}</b>，极差 ${m.range.toFixed(3)}。12 个小球中 <b>${got}</b> 个到达全局最低点附近`);
      } };
  }

  /* ---------- scene 6: early termination, three ways ---------- */
  function s6(G) {
    G.add(L.grid(46, 46));
    const K = 121, zs = [-7, -1, 5], cols = [COL.none, COL.hard, COL.soft], names = ['无终止', '硬终止 + 重置（SHAC）', '软生存权重（SuperMimic 式）'], cur = cols.map((c, i) => { const m = curtain(K, c, 0.42); G.add(m); return m; });
    const x0 = -21, wid = 26, HT = 6; const Hopt = [[32, true], [256, false], [1000, false]]; let hI = 0, res = null;
    const nameL = names.map((t, i) => { const l = lab(t, [x0 + wid + 0.2, 0.7, zs[i] + 1.2], { size: 20, border: i === 1 ? 'rgba(224,93,93,.85)' : i === 2 ? 'rgba(79,201,138,.85)' : 'rgba(124,184,255,.85)' }); G.add(l); return l; });
    /* survival strips */
    const strip = inst(BOX, 2 * 64); G.add(strip);
    const xs = 9, ws = 11; const tA = lab('一条轨迹上的权重 c_t：红是硬，绿是软', [xs + ws / 2 - 3.5, 7.4, -6], { size: 19 }); G.add(tA);
    let stats = [], tags = [], tH = [], tS = [];
    const cache = TOY._c;
    function compute() {
      const [h, useV] = Hopt[hI], key = 's6:' + h;
      if (!cache[key]) {
        const pi = TOY.A, V = useV ? TOY.V0 : null, d = TOY.dir(pi, 31), st = TOY.starts(4), th = pi.th.slice();
        const out = ['none', 'hard', 'soft'].map(term => { const o = new Float64Array(K); for (let k = 0; k < K; k++) { const a = -1 + 2 * k / (K - 1); for (let q = 0; q < pi.n; q++) pi.th[q] = th[q] + a * d[q]; o[k] = term === 'hard' ? Toy.taskLoss(pi, V, h, 'hard', st) : (() => { let s = 0; for (const x of st) s += Toy.rollout(pi, V, x, h, { term, norm: h }).L; return s / st.length; })(); } return o; });
        pi.th.set(th); cache[key] = out;
      }
      res = cache[key]; stats = res.map(metrics);
      res.forEach((o, i) => { const mn = stats[i].mn, rg = stats[i].range || 1; for (let k = 0; k < K; k++) cur[i].userData.set(k, x0 + wid * k / (K - 1), 0.1 + HT * (o[k] - mn) / rg, zs[i], 0); });
      /* traces */
      const s0 = TOY.starts(1, 5)[0], pi = TOY.A; let r = Toy.rollout(pi, null, s0, 64, { term: 'soft' }); tS = Array.from(Toy.BUF.c.slice(0, 64));
      r = Toy.rollout(pi, null, s0, 64, { term: 'hard' }); tH = []; for (let t = 0; t < 64; t++) tH.push(t < r.T ? 1 : 0);
    }
    compute();
    return { ctl: { html: textBtns('损失', ['h = 32 + V', 'H = 256', 'H = 1000'], 0, 'h'), on(g, k) { hI = k; compute(); } },
      update(p) {
        const k = Math.max(2, Math.round(seg(p, 0, 0.7) * K)); cur.forEach(m => m.userData.draw(k));
        const q = seg(p, 0.35, 0.95) * 64;
        for (let t = 0; t < 64; t++) { const x = xs + ws * t / 63; if (t < q) { bar(strip, t, x, 0.02, 0.02 + 3.6 * tH[t], -7.2, 0.15, 0.6, hex3(COL.hard)); bar(strip, 64 + t, x, 0.02, 0.02 + 3.6 * tS[t], -4.8, 0.15, 0.6, hex3(COL.soft)); } else { hide(strip, t); hide(strip, 64 + t); } } done(strip);
        cap(`一维切片的转折数：无终止 <b>${stats[0].turns}</b>，硬终止 <b>${stats[1].turns}</b>，软权重 <b>${stats[2].turns}</b>。每条按自己的范围归一化`);
      } };
  }

  /* ---------- scene 7: one window, Eq. (5) ---------- */
  function s7(G) {
    G.add(L.grid(44, 30));
    const HO = [8, 16, 32, 64]; let hI = 2, W = 3, bars = inst(BOX, 3 * 64 + 3), cuts = []; G.add(bars);
    const Pd = pendulums(G, 1, { len: 1.7, t: 1.5 }); const X0 = -19, X1 = 19; const lV = lab('紫块：窗口末端的 γʰ V', [12, 9.2, 0], { size: 20, border: 'rgba(157,140,255,.8)' }), lR = lab('柱子：每步的 γᵏ r', [-12, 9.2, 0], { size: 20 }); G.add(lV, lR);
    const cutG = new THREE.Group(); G.add(cutG);
    let tr = [];
    const KV = 0.09, KR = 2.2, Y0 = 2.8; G.add(L.line([[X0, Y0, 0.9], [X1, Y0, 0.9]], COL.sim, { opacity: 0.5 }));
    function compute() {
      const h = HO[hI], { pi, V } = TOY.trained; let s = TOY.starts(1, 15)[0]; tr = [];
      const B = Toy.BUF, O2 = {};
      for (let w = 0; w < W; w++) {
        const r = Toy.rollout(pi, V, s, h, { norm: h, sig: 0 }); const arr = []; let d = 1, sum = 0;
        for (let t = 0; t < h; t++) { const rr = -Math.cos(B.phi[t + 1]) - Toy.P.cw * B.w[t + 1] * B.w[t + 1] - 0.01 * B.a[t] * B.a[t]; arr.push({ v: d * rr, phi: B.phi[t] }); sum += d * rr; d *= Toy.P.gamma; }
        const end = [B.phi[h], B.w[h], B.psi[h]], v = Toy.evalNet(V, end[0], end[1], end[2], O2);
        tr.push({ arr, sum, dV: d * v, end: end[0] }); s = end;
      }
      while (cutG.children.length) { const c = cutG.children.pop(); L.dispose(c); }
      const gap = 0.9, ww = (X1 - X0 - gap * (W - 1) - 1.2 * W) / W; tr.forEach((w, k) => { w.x0 = X0 + k * (ww + gap + 1.2); w.ww = ww; if (k < W - 1) cutG.add(L.line([[w.x0 + ww + 1.3, 0, 1.4], [w.x0 + ww + 1.3, 7, 1.4]], COL.cut, { opacity: 0.95 })); });
    }
    compute();
    return { ctl: { html: textBtns('h', HO.map(String), hI, 'h'), on(g, k) { hI = k; compute(); } },
      update(p) {
        const h = HO[hI], tot = W * h, cnt = seg(p, 0, 0.85) * tot, bw = Math.max(0.08, tr[0].ww / h * 0.76); let c = 0, phi = tr[0].arr[0].phi, cw = 0;
        tr.forEach((w, k) => {
          w.arr.forEach((a, t) => { const idx = k * h + t, on = idx < cnt, x = w.x0 + (t + 0.5) * w.ww / h; if (on) { bar(bars, c, x, Y0, Y0 + a.v * KR, 0, bw, 0.9, hex3(COL.rew)); phi = a.phi; cw = k; } else hide(bars, c); c++; });
          if (cnt >= (k + 1) * h) bar(bars, c, w.x0 + w.ww + 0.55, Y0, Y0 + w.dV * KV, 0, 0.95, 0.95, hex3(COL.crit)); else hide(bars, c); c++;
        });
        for (; c < bars.count; c++) hide(bars, c); done(bars);
        Pd.set(0, 0, 10.2, 0, phi); Pd.done();
        const w = tr[cw], f = Math.abs(w.dV) / (Math.abs(w.dV) + Math.abs(w.sum) + 1e-9);
        cap(`窗口 ${cw + 1}：奖励和 Σγᵏr = <b>${w.sum.toFixed(2)}</b>，γ^${h}·V = <b>${w.dV.toFixed(2)}</b>，后者占绝对值的 <b>${(f * 100).toFixed(0)}%</b>。γ^${h} = ${Math.pow(0.99, h).toFixed(3)}`);
      } };
  }

  /* ---------- scene 8: TD-lambda ---------- */
  function s8(G) {
    const n = 41, Wx = 18, Wz = 12, surf = surface(n, n, Wx, Wz); G.add(surf); surf.position.set(0, 0, -2.2);
    const wb = inst(BOX, 32), dots = inst(BALL, 32), res = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(32 * 6), 3)), new THREE.LineBasicMaterial({ color: COL.crit })); res.frustumCulled = false; G.add(wb, dots, res);
    for (let i = 0; i < 32; i++) colI(dots, i, hex3(COL.pi)); done(dots);
    const O2 = {}, { pi, V } = TOY.trained; const h = 32, lam = Toy.P.lam, gam = Toy.P.gamma; let tI = 0; const TS = [0, 16, 28];
    const st = TOY.starts(1, 15)[0]; Toy.rollout(pi, V, st, h, { norm: h }); const B = Toy.BUF, ph = Array.from(B.phi.slice(0, h + 1)), om = Array.from(B.w.slice(0, h + 1)), ps = Array.from(B.psi.slice(0, h + 1)), aa = Array.from(B.a.slice(0, h));
    const rr = aa.map((a, t) => -Math.cos(ph[t + 1]) - Toy.P.cw * om[t + 1] * om[t + 1] - 0.01 * a * a), vs = ph.map((_, t) => Toy.evalNet(V, ph[t], om[t], ps[t], O2));
    const targ = new Array(h); { let G0 = vs[h]; for (let t = h - 1; t >= 0; t--) { G0 = rr[t] + gam * (t === h - 1 ? vs[h] : (1 - lam) * vs[t + 1] + lam * G0); targ[t] = G0; } }
    const vm = vs.reduce((a, b) => a + b) / vs.length, SY = 0.16, Y0 = 3.0, wrap = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
    const X = phi => wrap(phi) / Math.PI * Wx / 2, Zz = w => clamp(w, -3, 3) / 3 * Wz / 2 - 2.2, Yy = v => Y0 + (v - vm) * SY;
    G.add(lab('曲面：V(φ, ω)，相位 ψ 在扫', [-13, 6.2, -4], { size: 20, border: 'rgba(157,140,255,.8)' }));
    const tW = lab('权重：(1−λ)λ^{k−1}，末项 λ^{h−t−1}', [0, -0.6, 10.2], { size: 21 }); G.add(tW);
    let wL = null, Gk = [], vTarget = 0;
    function weights() {
      const t = TS[tI], K = h - t; const ws = []; for (let k = 1; k <= K; k++) ws.push(k < K ? (1 - lam) * Math.pow(lam, k - 1) : Math.pow(lam, K - 1));
      Gk = []; for (let k = 1; k <= K; k++) { let s = 0; for (let l = 0; l < k; l++) s += Math.pow(gam, l) * rr[t + l]; Gk.push(s + Math.pow(gam, k) * vs[t + k]); }
      vTarget = ws.reduce((s, w, i) => s + w * Gk[i], 0); return ws;
    }
    let ws = weights();
    const H0 = new Float64Array(n * n);
    return { ctl: { html: textBtns('看哪一步 t', TS.map(String), 0, 't'), on(g, k) { tI = k; ws = weights(); } },
      update(p) {
        const psi = p * 2 * Math.PI, Am = 20; let c = 0;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const f = -Math.PI + 2 * Math.PI * j / (n - 1), w = -3 + 6 * i / (n - 1); H0[c++] = Toy.evalNet(V, f, w, psi, O2); }
        const S0 = H0.map(v => Yy(v)); surf.userData.set(S0, 1, y => ramp((y - Y0 + 3) / 6));
        const m = Math.floor(seg(p, 0.1, 0.8) * h + 1e-6), A = res.geometry.attributes.position.array;
        for (let t = 0; t < h; t++) { const x = X(ph[t]), z = Zz(om[t]); if (t < m) { setI(dots, t, [x, Yy(targ[t]), z], 0.18); A.set([x, Yy(targ[t]), z, x, Yy(vs[t]), z], t * 6); } else { hide(dots, t); A.fill(0, t * 6, t * 6 + 6); } } done(dots); res.geometry.attributes.position.needsUpdate = true;
        for (let k = 0; k < 32; k++) { if (k < ws.length) { const on = k / ws.length <= seg(p, 0, 0.5); const v = ws[k]; bar(wb, k, -8.5 + 17 * k / 31, 0, on ? 0.02 + v * 12 : 0.001, 7.6, 0.42, 0.42, hex3(k === ws.length - 1 ? COL.crit : COL.pi)); } else hide(wb, k); } done(wb);
        const t = TS[tI], first = Gk[0], last = Gk[Gk.length - 1];
        cap(`t = ${t}：1 步回报 G¹ = <b>${first.toFixed(2)}</b>，${Gk.length} 步回报 = <b>${last.toFixed(2)}</b>，加权后 Ṽ = <b>${vTarget.toFixed(2)}</b>；当前 V = ${vs[t].toFixed(2)}`);
      } };
  }

  /* ---------- scene 9: Algorithm 1, live ---------- */
  function s9(G) {
    G.add(L.grid(44, 30));
    const HO = [8, 16, 32, 128, 1000], NP = 16, Pd = pendulums(G, NP, { len: 1.25, t: 1.0 }), PL = [];
    for (let i = 0; i < NP; i++) PL.push([-19.5 + 3.3 * (i % 4), 10 - 3.1 * Math.floor(i / 4)]);
    const curve = curtain(21, COL.grad, 0.32), ref = curtain(2, COL.sim, 0.0); G.add(curve, ref);
    const X0 = -5, Wd = 24, Y0 = 0.4, Ymax = 11, Rmin = -0.08, Rmax = 0.22, yy = r => Y0 + (r - Rmin) / (Rmax - Rmin) * (Ymax - Y0);
    G.add(L.line([[X0, Y0, 0], [X0 + Wd, Y0, 0]], COL.sim, { opacity: 0.9 }), L.line([[X0, Y0, 0], [X0, Ymax, 0]], COL.sim, { opacity: 0.9 }));
    [-0.05, 0, 0.1, 0.2].forEach(v => { G.add(L.line([[X0, yy(v), -0.1], [X0 + Wd, yy(v), -0.1]], COL.sim, { opacity: 0.22 }), lab(v.toFixed(2), [X0 - 1.2, yy(v), 0], { size: 18 })); });
    G.add(lab('仿真步 →', [X0 + Wd - 2, -0.8, 0], { size: 18 }), lab('当前策略的表现', [-14.5, 12.4, 0], { size: 20 }), lab('平均每步奖励', [X0 + 3.4, Ymax + 0.8, 0], { size: 20 }));
    const dotM = L.sphere(0.28, COL.grad); G.add(dotM);
    let hI = 2, crit = 1, R = null, traj = [], ms = 0;
    const cache = TOY._c;
    function compute() {
      const key = `s9:${HO[hI]}:${crit}`;
      if (!cache[key]) {
        const h = HO[hI], N = Math.max(1, Math.round(256 / h)), episodes = Math.max(1, Math.round(256 * 300 / (h * N))), t0 = performance.now();
        const r = Toy.train({ h, N, useCritic: !!crit, episodes, citer: 6, every: Math.max(1, Math.round(episodes / 20)), seed: 200 });
        /* play each snapshot on 16 pendulums */
        const pi = Toy.net(16), T = 90, tr = [], st = TOY.starts(NP, 61);
        r.snaps.forEach(sn => { pi.th.set(sn); const a = []; st.forEach(s => { Toy.rollout(pi, null, s, T, { sig: 0, norm: T }); a.push(Float32Array.from(Toy.BUF.phi.subarray(0, T + 1))); }); tr.push(a); });
        cache[key] = { r, tr, N, episodes, ms: performance.now() - t0 };
      }
      R = cache[key]; traj = R.tr; ms = R.ms;
      const lg = R.r.log, M = 21; for (let i = 0; i < M; i++) { const k = Math.min(lg.length - 1, Math.round(i / (M - 1) * (lg.length - 1))); curve.userData.set(i, X0 + Wd * i / (M - 1), yy(lg[k].ret), 0, Y0); }
    }
    compute();
    return { ctl: { html: textBtns('h', HO.map(String), hI, 'h') + textBtns('评论家', ['关', '开'], crit, 'c'), on(g, k) { if (g === 'h') hI = k; else crit = k; compute(); } },
      update(p) {
        const q = seg(p, 0.02, 0.98), M = 21, k = Math.max(2, Math.ceil(q * (M - 1)) + 1); curve.userData.draw(k);
        const lg = R.r.log, sn = Math.min(traj.length - 1, Math.round(q * (traj.length - 1))), cur = lg[Math.min(lg.length - 1, sn)];
        dotM.position.set(X0 + Wd * sn / Math.max(1, traj.length - 1), yy(cur.ret), 0.1);
        const f = ((p * 60) % 1), T = traj[sn][0].length - 1, u = f * T;
        for (let i = 0; i < NP; i++) { const a = traj[sn][i], i0 = Math.min(T - 1, Math.floor(u)); Pd.set(i, PL[i][0], PL[i][1], 0, L.lerp(a[i0], a[i0 + 1], u - i0)); } Pd.done();
        const last = lg[lg.length - 1].ret;
        cap(`h = <b>${HO[hI]}</b>，N = ${R.N}，${crit ? '带' : '不带'}评论家。第 ${cur.ep} / ${R.episodes} 轮，奖励 <b>${cur.ret.toFixed(3)}</b>，最终 <b>${last.toFixed(3)}</b>（页面现跑 ${ms.toFixed(0)} ms）`);
      } };
  }

  /* ---------- scene 10: the paper's numbers ---------- */
  function s10(G) {
    G.add(L.grid(44, 30));
    const bars = inst(BOX, 48), lg = new THREE.Group(); G.add(bars, lg);
    let mode = 0, items = [];
    const F6 = { h: [4, 8, 16, 32, 64, 128], r: [4283, 6043, 7555, 7555, 5862, 1078], t: [16.8, 20.4, 27.6, 40.2, 64.8, 115.6] };
    const F7 = [['Ant', { SHAC: 7533, PPO: 5913, SAC: 5964, BPTT: 566, 'No Critic': 187 }], ['Humanoid', { SHAC: 7949, PPO: 6814, SAC: 7190, BPTT: 254, 'No Critic': 404 }], ['MTU', { SHAC: 6136, PPO: 3271, SAC: 3253, BPTT: 249, 'No Critic': 152 }], ['HalfCheetah', { SHAC: 8925, PPO: 6846, SAC: 7111, BPTT: 658, 'No Critic': 8286 }], ['Hopper', { SHAC: 5384, PPO: 4397, SAC: 4578, BPTT: 3554, 'No Critic': 630 }]];
    const T12 = [['CartPole', 0.15, 0.23, 0.34], ['Ant', 0.25, 0.37, 0.32], ['Humanoid', 0.91, 1.97, 0.32], ['SNU Humanoid', 0.82, 1.66, 0.33]];
    const CS = [COL.grad, COL.pi, COL.rew, COL.sim, COL.crit];
    function build() {
      while (lg.children.length) { const c = lg.children.pop(); L.dispose(c); LABS = LABS.filter(s => s !== c); }
      items = [];
      const tl = (t, x, y, z = 0, o = {}) => lg.add(lab(t, [x, y, z], { size: o.size || 19, border: o.border }));
      if (mode === 0) {
        F6.h.forEach((h, i) => { const xa = -20.5 + 3.3 * i, xb = 2.6 + 3.3 * i; items.push({ x: xa, y0: 0, y1: F6.r[i] / 7555 * 8, z: 0, c: COL.rew, w: 2.3 }); items.push({ x: xb, y0: 0, y1: F6.t[i] / 115.6 * 8, z: 0, c: COL.pi, w: 2.3 }); tl(`h=${h}`, xa, -1.0, 2); tl(`h=${h}`, xb, -1.0, 2); tl(String(F6.r[i]), xa, F6.r[i] / 7555 * 8 + 0.8, 0); tl(F6.t[i] + ' min', xb, F6.t[i] / 115.6 * 8 + 0.8, 0); });
        tl('最好奖励（Ant）', -12, 10.8, 0, { size: 21, border: 'rgba(242,193,78,.8)' }); tl('总训练时间：同样 2000 轮、同样样本数', 11.6, 10.8, 0, { size: 21, border: 'rgba(56,209,255,.8)' });
      } else if (mode === 1) {
        F7.forEach(([nm, o], i) => { const x0 = -18 + 7.6 * i; Object.values(o).forEach((v, j) => items.push({ x: x0 + j * 1.25, y0: 0, y1: v / 8925 * 9, z: 0, c: CS[j], w: 1.05 })); tl(nm, x0 + 2.5, -1.0, 2); });
        tl('每组从左到右：SHAC（橙红） PPO（蓝） SAC（黄） BPTT（灰） No Critic（紫）', 0, 12, 0, { size: 21 });
        tl('No Critic 8286', -18 + 7.6 * 3 + 4 * 1.25, 9.4, 0.5, { border: 'rgba(157,140,255,.8)' });
      } else {
        T12.forEach(([nm, a, b, c], i) => { const x = -13 + 8.6 * i, k = 3.2; items.push({ x, y0: 0, y1: a * k, z: 0, c: COL.pi, w: 3.6 }); items.push({ x, y0: a * k + 0.04, y1: (a + b) * k, z: 0, c: COL.grad, w: 3.6 }); items.push({ x, y0: (a + b) * k + 0.04, y1: (a + b + c) * k, z: 0, c: COL.crit, w: 3.6 }); tl(nm, x, -1.0, 2); tl(`${(a + b + c).toFixed(2)} s · 评论家 ${(100 * c / (a + b + c)).toFixed(0)}%`, x, (a + b + c) * k + 0.9, 0); });
        [['前向', COL.pi], ['反向（含策略更新）', COL.grad], ['评论家训练', COL.crit]].forEach(([n, c], j) => tl(n, -11 + 10 * j, 12.5, 0, { border: '#' + c.toString(16).padStart(6, '0') }));
      }
    }
    build();
    return { ctl: { html: textBtns('看', ['图 6：h 的研究', '图 7：最好奖励', '表 12：时间'], 0, 'm'), on(g, k) { mode = k; build(); } },
      update(p) {
        const q = seg(p, 0, 0.55);
        for (let i = 0; i < bars.count; i++) { if (i < items.length) { const b = items[i], y1 = b.y0 + (b.y1 - b.y0) * q; bar(bars, i, b.x, b.y0, Math.max(b.y0 + 0.001, y1), b.z, b.w, b.w * 0.8, hex3(b.c)); } else hide(bars, i); } done(bars);
        cap(mode === 0 ? 'N·h 固定为 2048，样本数不变，时间仍随 h <b>线性</b>增长。h = 16 和 32 的柱子矢量坐标完全一样' : mode === 1 ? '五个种子平均曲线的最大值，我从矢量路径读的。<b>HalfCheetah 上 No Critic 只比 SHAC 低 7%</b>' : '表 12 原数。反向 / 前向：1.53、1.48、2.16、2.02。<b>“约 2 倍”只对后两个成立</b>');
      } };
  }

  /* ---------- scene 11: what SuperMimic changes ---------- */
  function s11(G) {
    G.add(L.grid(44, 30));
    const zA = -6, zB = 5; const mk = (t, x, z, c, w = 4.2) => { const b = L.box(w, 1.4, 2, c, { edgeOpacity: 0.3 }); b.position.set(x, 0.75, z); b.userData.c = hex3(c); G.add(b); return b; };
    const R = [{ x: -16, n: 'π', w: 2.2 }, { x: -7, n: '动力学', w: 6 }, { x: 3.5, n: '终止', w: 6 }, { x: 13.5, n: 'V', w: 5 }];
    const A = [mk('', R[0].x, zA, COL.pi, 2.6), mk('', R[1].x, zA, COL.sim, 6), mk('', R[2].x, zA, COL.hard, 6), mk('', R[3].x, zA, COL.crit, 5)];
    const B = [mk('', R[0].x, zB, COL.pi, 2.6), mk('', R[1].x, zB, COL.wm, 6), mk('', R[2].x, zB, COL.soft, 6), mk('', R[3].x, zB, COL.crit, 5)];
    const set = [
      ['策略', '随机，a ~ N(μ, σ)，重参数化', '确定性，a = π(o, g)'],
      ['动力学', 'dFlex，仿真器本身可微', '学到的 f_ω，仿真器只产数据'],
      ['终止', '硬终止，重置，V 记 0', '软权重 ĉ，来自 d̂'],
      ['评论家', '目标网络 α = 0.2 或 0.995', '没有目标网络，α = 0 相当'],
      ['起点', '接上一窗口末态', '从回放缓存取'],
      ['评论家数据', '真实仿真的短轨迹', '只用想象轨迹'] ];
    const IDX = [0, 1, 2, 3, 0, 3];
    let sel = 2, tA = null, tB = null;
    G.add(lab('SHAC', [-16, 4.2, zA], { size: 24, border: 'rgba(255,122,89,.8)' }), lab('SuperMimic', [-16, 4.2, zB], { size: 24, border: 'rgba(79,201,138,.8)' }));
    R.forEach((r, i) => { G.add(lab(['π', '可微仿真器 F', '硬终止', 'V + 目标网络'][i], [r.x, 2.3, zA], { size: 20 }), lab(['π', '世界模型 f_ω', '软权重 ĉ', 'V'][i], [r.x, 2.3, zB], { size: 20 })); });
    [[R[0].x, R[1].x], [R[1].x, R[2].x], [R[2].x, R[3].x]].forEach(([a, b]) => { G.add(L.line([[a, 0.75, zA], [b, 0.75, zA]], COL.sim, { opacity: 0.7 }), L.line([[a, 0.75, zB], [b, 0.75, zB]], COL.sim, { opacity: 0.7 })); });
    function pick() {
      const [nm, a, b] = set[sel];
      tA = relab(G, tA, a, [clamp(R[IDX[sel]].x, -10, 12), -0.1, zA + 2.6], { size: 22, border: 'rgba(255,122,89,.8)' }); tB = relab(G, tB, b, [clamp(R[IDX[sel]].x, -10, 12), -0.1, zB + 2.6], { size: 22, border: 'rgba(79,201,138,.8)' });
    }
    pick();
    const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.8 * k, c[1] * 0.8 * k, c[2] * 0.8 * k); };
    return { ctl: { html: textBtns('比', set.map(s => s[0]), sel, 's'), on(g, k) { sel = k; pick(); } },
      update(p) {
        const k = 0.35 + 0.65 * Math.abs(Math.sin(p * Math.PI * 4));
        [A, B].forEach(row => row.forEach((m, i) => glow(m, i === IDX[sel] ? k : 0.04)));
        cap(sel === 2 ? '<b>它自己说的改动之一。</b>d̂ 只取 0 或 1 时，软权重退回硬终止（少了重置）' : sel === 3 ? '<b>它自己说的改动之二。</b>SHAC 的 α 从 0.2 到 0.995 差很多，SuperMimic 直接不要' : sel === 1 ? '<b>最大的差别，但它只一句带过。</b>梯度从不经过仿真器，所以接触可以不光滑' : '这一条是<b>我对比两篇论文得出的</b>，SuperMimic 没有把它列成和 SHAC 的差别');
      } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player ---------- */
  let cur = 0, api = null, playing = !L.reduced(), t0 = 0, pNow = 0, tw = null;
  const HOLD = 1.8;
  const aspectFix = () => { const el = $('stage'), asp = (el.clientWidth || 1) / (el.clientHeight || 1); return Math.min(2.2, Math.max(1, 1.45 / asp)); };
  function fly(th, ph, d, tg) { let dth = th - S.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth)); d *= aspectFix(); tw = { t0: performance.now(), from: [S.theta, S.phi, S.dist, S.target.clone()], to: [S.theta + dth, ph, d, new THREE.Vector3(...tg)] }; refDist = d; }
  function setPlay(on) { playing = on; $('play').textContent = on ? '❚❚ 暂停' : '▶ 播放'; $('play').setAttribute('aria-label', on ? '暂停' : '播放'); }
  function go(i, p0 = 0) {
    cur = (i + SCENES.length) % SCENES.length; showInfo(cur);
    if (!S) return;
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
    S.onClick(() => PICKS, hit => { const g = hit?.object?.userData?.go ?? hit?.object?.parent?.userData?.go; if (g != null) go(g); });
    S.onHover(() => PICKS, hit => { $('stage').style.cursor = hit ? 'pointer' : ''; });
  }
  $('ctl').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !api?.ctl) return; const g = b.dataset.g, k = +b.dataset.k; $('ctl').querySelectorAll(`button[data-g="${g}"]`).forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.k === k && g !== 's'))); api.ctl.on(g, k); api.update(pNow); });
  $('play').onclick = () => { if (!playing) t0 = performance.now() - pNow * SCENES[cur].dur * 1000; setPlay(!playing); };
  $('scrub').oninput = e => { setPlay(false); pNow = e.target.value / 1000; if (api) api.update(pNow); };
  $('prev').onclick = () => go(cur - 1); $('next').onclick = () => go(cur + 1);
  btns.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); });
  stepsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; go(+b.dataset.i); if (!document.body.classList.contains('embed')) $('stage').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' && e.key !== ' ') return; if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1); else if (e.key === ' ') { e.preventDefault(); $('play').click(); } });
  const s0 = clamp((parseInt(qs.get('scene'), 10) || 1) - 1, 0, SCENES.length - 1), pq = qs.get('p');
  setPlay(playing && pq == null);
  go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0));
  /* test hook: ?h=1000 sets scene 4's horizon, for screenshots and checks */
  if (qs.get('h') && api?.setH) { api.setH(parseInt(qs.get('h'), 10)); const hv = document.getElementById('hv'); if (hv) { hv.textContent = qs.get('h'); document.getElementById('hr').value = Math.round(Math.log10(+qs.get('h')) / Math.log10(2000) * 1000); } api.update(pNow); }
})();
