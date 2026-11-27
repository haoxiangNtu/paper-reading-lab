// 扩散与流匹配专题页的四个动画。
// 数据分布都取高斯混合，最优去噪器 E[x1 | x_t] 有解析式，动画直接用它代替训练好的网络。
// 所以动画里的差别只来自采样方法和步数，不来自网络误差。
(function () {
  'use strict';
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 工具 ----------
  function $(id) { return document.getElementById(id); }
  function pal(elm) {
    var cs = getComputedStyle(elm);
    var g = function (n) { return cs.getPropertyValue(n).trim(); };
    return { fg: g('--fg'), muted: g('--muted'), line: g('--line'), bg: g('--viz-surface'), accent: g('--accent'), bad: g('--bad'),
      p: [g('--p1'), g('--p2'), g('--p3'), g('--p4'), g('--p5'), g('--p6')] };
  }
  function rgba(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function mkCanvas(id, W, H) {
    var cv = $(id); if (!cv) return null;
    cv.width = W * DPR; cv.height = H * DPR;
    var ctx = cv.getContext('2d');
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { cv: cv, ctx: ctx, W: W, H: H };
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) {
    var u = r(), v = r();
    if (u < 1e-12) u = 1e-12;
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function seg(id, cb) {
    var s = $(id); if (!s) return;
    s.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      s.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      cb(b.getAttribute('data-v'));
    });
  }
  function txt(ctx, s, x, y, color, size, align, font) {
    ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = (size || 13) + 'px ' + (font || '"Noto Sans SC",system-ui,sans-serif');
    ctx.fillText(s, x, y);
  }
  var MONO = '"JetBrains Mono",ui-monospace,monospace';

  // 播放器：p ∈ [0,1] 是时间轴，draw(p) 是 p 的纯函数。播放、暂停、拖动都走 draw。
  function Player(o) {
    var self = this;
    this.p = o.p0 || 0; this.holdT = 0; this.playing = false; this.dur = o.dur; this.draw = o.draw; this.loop = o.loop !== false;
    this.btn = $(o.btn); this.rng = $(o.range);
    var last = 0, visible = true;
    function frame(now) {
      if (!self.playing) return;
      var dt = last ? now - last : 0; last = now;
      if (visible) {
        if (self.p >= 1) {
          // 播完停 1.4 秒再从头开始
          self.p = 1; self.holdT += dt;
          if (self.holdT > 1400) { self.holdT = 0; if (self.loop) self.p = 0; else self.pause(); }
        } else self.p = Math.min(1, self.p + dt / self.dur);
        self.render();
      }
      requestAnimationFrame(frame);
    }
    this.play = function () { if (self.playing) return; if (self.p >= 1) self.p = 0; self.playing = true; last = 0; if (self.btn) self.btn.textContent = '❚❚ 暂停'; requestAnimationFrame(frame); };
    this.pause = function () { self.playing = false; if (self.btn) self.btn.textContent = '▶ 播放'; };
    this.render = function () { if (self.rng) self.rng.value = Math.round(self.p * 1000); self.draw(self.p); };
    if (this.btn) this.btn.addEventListener('click', function () { if (self.playing) self.pause(); else self.play(); });
    if (this.rng) this.rng.addEventListener('input', function () { self.pause(); self.p = +self.rng.value / 1000; self.holdT = 0; self.draw(self.p); });
    if ('IntersectionObserver' in window && o.watch) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe($(o.watch));
    }
    this.restart = function () { self.p = 0; self.holdT = 0; self.render(); if (!REDUCED) self.play(); };
  }

  // ---------- 高斯混合与解析去噪器 ----------
  // 数据 x1 ~ Σ w_k N(μ_k, s2_k I)，带噪 x = a·x1 + b·ε。
  function GMM(mu, s2, w) {
    var sw = w.reduce(function (s, v) { return s + v; }, 0);
    return { mu: mu, s2: s2, w: w.map(function (v) { return v / sw; }), K: mu.length, d: mu[0].length };
  }
  // 返回各分量的后验概率 r；m 写入 E[x1 | x]
  function post(G, x, a, b, m) {
    var K = G.K, d = G.d, ll = new Array(K), mx = -Infinity, k, i;
    for (k = 0; k < K; k++) {
      var S = a * a * G.s2[k] + b * b, q = 0, mu = G.mu[k];
      for (i = 0; i < d; i++) { var di = x[i] - a * mu[i]; q += di * di; }
      ll[k] = Math.log(G.w[k]) - 0.5 * d * Math.log(S) - 0.5 * q / S;
      if (ll[k] > mx) mx = ll[k];
    }
    var sum = 0;
    for (k = 0; k < K; k++) { ll[k] = Math.exp(ll[k] - mx); sum += ll[k]; }
    for (i = 0; i < d; i++) m[i] = 0;
    for (k = 0; k < K; k++) {
      var r = ll[k] / sum; ll[k] = r;
      if (r < 1e-12) continue;
      var S2 = a * a * G.s2[k] + b * b, g = a * G.s2[k] / S2, mu2 = G.mu[k];
      for (i = 0; i < d; i++) m[i] += r * (mu2[i] + g * (x[i] - a * mu2[i]));
    }
    return ll;
  }
  // 噪声水平 t：0 = 数据，1 = 纯噪声。扩散用余弦调度，流匹配用直线。
  function coef(sched, t) {
    if (sched === 'lin') return [1 - t, t];
    var f = function (u) { var c = Math.cos((u + 0.008) / 1.008 * Math.PI / 2); return c * c; };
    var ab = Math.max(0, Math.min(1, f(t) / f(0)));
    return [Math.sqrt(ab), Math.sqrt(1 - ab)];
  }
  // 从纯噪声 x 出发走 K 步，返回每一步的位置和后验
  function sample(G, method, K, noise, r) {
    var sched = method === 'flow' ? 'lin' : 'cos', d = G.d;
    var x = noise.slice(), m = new Array(d), traj = [x.slice()], resp = [];
    for (var i = K; i >= 1; i--) {
      var t = i / K, t2 = (i - 1) / K, c = coef(sched, t), c2 = coef(sched, t2), a = c[0], b = c[1], a2 = c2[0], b2 = c2[1];
      resp.push(post(G, x, a, b, m).slice());
      for (var j = 0; j < d; j++) {
        var eps = (x[j] - a * m[j]) / b;
        if (method === 'flow') {
          // 速度 v = x̂1 − ε̂，沿数据方向走 Δt
          x[j] += (t - t2) * (m[j] - eps);
        } else if (method === 'ddim') {
          x[j] = a2 * m[j] + b2 * eps;
        } else {
          var ab = a * a, ab2 = a2 * a2, al = ab / ab2, be = 1 - al, den = 1 - ab;
          var c0 = a2 * be / den, ct = Math.sqrt(al) * (1 - ab2) / den, sd = Math.sqrt(Math.max(0, be * (1 - ab2) / den));
          x[j] = c0 * m[j] + ct * x[j] + sd * gauss(r);
        }
      }
      traj.push(x.slice());
    }
    resp.push(post(G, x, 1, 1e-3, m).slice());
    return { traj: traj, resp: resp };
  }

  // ======================================================================
  // 动画 1：二维“双月牙”数据的加噪与去噪
  // ======================================================================
  (function () {
    var C = mkCanvas('a1-cv', 680, 420); if (!C) return;
    var ctx = C.ctx, W = C.W, H = C.H;
    var mus = [], moon = [];
    for (var i = 0; i < 9; i++) {
      var th = Math.PI * i / 8;
      mus.push([Math.cos(th) - 0.5, Math.sin(th) - 0.25]); moon.push(0);
      mus.push([1 - Math.cos(th) - 0.5, 0.5 - Math.sin(th) - 0.25]); moon.push(1);
    }
    mus = mus.map(function (p) { return [p[0] * 1.15, p[1] * 1.15]; });
    var SIG = 0.075, G = GMM(mus, mus.map(function () { return SIG * SIG; }), mus.map(function () { return 1; }));
    var N = 600, TR = 50;
    var st = { method: 'ddim', K: 20, seed: 7 };
    var X0, Cls, E, REV, FIN, onData;
    var sx = 100, ox = W / 2, oy = H / 2;
    function P(x, y) { return [ox + x * sx, oy - y * sx]; }
    function build() {
      var r = rng(st.seed);
      X0 = []; Cls = []; E = []; REV = []; FIN = [];
      for (var n = 0; n < N; n++) {
        var k = Math.floor(r() * G.K);
        X0.push([G.mu[k][0] + SIG * gauss(r), G.mu[k][1] + SIG * gauss(r)]); Cls.push(moon[k]);
        E.push([gauss(r), gauss(r)]);
      }
      var r2 = rng(st.seed * 31 + 5); onData = 0;
      for (n = 0; n < N; n++) {
        var s = sample(G, st.method, st.K, E[n], r2), xf = s.traj[st.K];
        REV.push(s.traj);
        var best = 1e9, bk = 0;
        for (var k2 = 0; k2 < G.K; k2++) { var dx = xf[0] - G.mu[k2][0], dy = xf[1] - G.mu[k2][1], dd = dx * dx + dy * dy; if (dd < best) { best = dd; bk = k2; } }
        FIN.push(moon[bk]); if (Math.sqrt(best) < 3 * SIG) onData++;
      }
    }
    function fwdPos(n, t) { var c = coef(st.method === 'flow' ? 'lin' : 'cos', t); return [c[0] * X0[n][0] + c[1] * E[n][0], c[0] * X0[n][1] + c[1] * E[n][1]]; }
    function revPos(n, c) { var i = Math.min(Math.floor(c), st.K - 1), f = c - i, A = REV[n][i], B = REV[n][i + 1]; return [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f]; }
    function ease(u) { return u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u); }
    function draw(p) {
      var c = pal(C.cv);
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
      // 网格
      ctx.strokeStyle = rgba(c.line, 0.8); ctx.lineWidth = 1;
      for (var g = -3; g <= 3; g++) { var a = P(g, 0), b = P(0, g); ctx.beginPath(); ctx.moveTo(a[0], 0); ctx.lineTo(a[0], H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, b[1]); ctx.lineTo(W, b[1]); ctx.stroke(); }
      // 数据分布的位置（淡）
      ctx.fillStyle = rgba(c.muted, 0.13);
      for (var k = 0; k < G.K; k++) { var q = P(G.mu[k][0], G.mu[k][1]); ctx.beginPath(); ctx.arc(q[0], q[1], 2.2 * SIG * sx, 0, 7); ctx.fill(); }
      var phase, t, label, cc;
      if (p < 0.06) { phase = 'data'; t = 0; }
      else if (p < 0.42) { phase = 'fwd'; t = ease((p - 0.06) / 0.36); }
      else if (p < 0.5) { phase = 'fwd'; t = 1; }
      else if (p < 0.92) { phase = 'rev'; cc = st.K * Math.min(1, (p - 0.5) / 0.42); t = 1 - cc / st.K; }
      else { phase = 'rev'; cc = st.K; t = 0; }
      var col = [c.p[0], c.p[1]];
      // 轨迹
      ctx.lineWidth = 1;
      for (var n = 0; n < TR; n++) {
        ctx.strokeStyle = rgba(phase === 'rev' ? col[FIN[n]] : col[Cls[n]], phase === 'rev' ? 0.45 : 0.25);
        ctx.beginPath();
        if (phase === 'fwd' || phase === 'data') {
          for (var s = 0; s <= 24; s++) { var pp = P.apply(null, fwdPos(n, t * s / 24)); if (s) ctx.lineTo(pp[0], pp[1]); else ctx.moveTo(pp[0], pp[1]); }
        } else {
          var i0 = Math.floor(cc);
          for (s = 0; s <= Math.min(i0, st.K); s++) { var q2 = P(REV[n][s][0], REV[n][s][1]); if (s) ctx.lineTo(q2[0], q2[1]); else ctx.moveTo(q2[0], q2[1]); }
          var qe = P.apply(null, revPos(n, cc)); ctx.lineTo(qe[0], qe[1]);
        }
        ctx.stroke();
      }
      // 粒子
      for (n = 0; n < N; n++) {
        var xy = phase === 'rev' ? revPos(n, cc) : fwdPos(n, t), pq = P(xy[0], xy[1]);
        ctx.fillStyle = phase === 'rev' ? col[FIN[n]] : col[Cls[n]];
        ctx.beginPath(); ctx.arc(pq[0], pq[1], 2.1, 0, 7); ctx.fill();
      }
      // 标签
      var sch = st.method === 'flow' ? 'lin' : 'cos', ab = coef(sch, t);
      var mname = { ddpm: '扩散 · DDPM 采样', ddim: '扩散 · DDIM 采样', flow: '流匹配 · Euler 积分' }[st.method];
      if (phase === 'data') label = '数据：双月牙（颜色 = 来自哪一块）';
      else if (phase === 'fwd') label = '正向加噪  x_t = a·x₀ + b·ε   （a = ' + ab[0].toFixed(2) + '，b = ' + ab[1].toFixed(2) + '）';
      else label = '反向去噪 · ' + mname + ' · 第 ' + Math.min(st.K, Math.floor(cc)) + ' / ' + st.K + ' 步（颜色 = 最后落到哪一块）';
      txt(ctx, label, 12, 22, c.fg, 13.5);
      txt(ctx, '噪声水平 t = ' + t.toFixed(2), 12, 42, c.muted, 12.5, 'left', MONO);
      // 噪声水平条
      ctx.fillStyle = rgba(c.line, 1); ctx.fillRect(12, 50, 160, 5);
      ctx.fillStyle = c.accent; ctx.fillRect(12, 50, 160 * t, 5);
      if (phase === 'rev' && cc >= st.K) {
        txt(ctx, '落在数据附近（3σ 内）的点：' + Math.round(100 * onData / N) + '%', W - 12, H - 14, onData / N > 0.8 ? c.fg : c.bad, 13, 'right');
      }
    }
    var pl = new Player({ dur: 11000, draw: draw, btn: 'a1-play', range: 'a1-p', watch: 'a1-cv', p0: 0.3 });
    function rebuild() { build(); var o = $('a1-out'); if (o) o.textContent = '每个点各自走 ' + st.K + ' 步；网络调用次数 = 步数 = ' + st.K + '。' + (st.K <= 2 ? '步数太少时所有点都被拉向数据的平均位置（两块月牙中间），这就是回归会犯的错。' : ''); pl.render(); }
    seg('a1-m', function (v) { st.method = v; rebuild(); });
    var ks = $('a1-k'), ko = $('a1-k-o');
    if (ks) ks.addEventListener('input', function () { st.K = +ks.value; ko.textContent = st.K; rebuild(); });
    var rs = $('a1-re'); if (rs) rs.addEventListener('click', function () { st.seed++; rebuild(); pl.restart(); });
    var j = $('a1-jump'); if (j) j.addEventListener('click', function () { pl.pause(); pl.p = 0.5; pl.render(); pl.play(); });
    rebuild();
    if (!REDUCED) pl.play();
  })();

  // ======================================================================
  // 动画 2：一维数据，横轴 τ（0 噪声 → 1 数据）。条件直线路径和边际路径
  // ======================================================================
  (function () {
    var C = mkCanvas('a2-cv', 680, 380); if (!C) return;
    var ctx = C.ctx, W = C.W, H = C.H, L = 44, R = 18, T = 30, B = 44;
    var G = GMM([[-1.5], [1.2]], [0.18 * 0.18, 0.18 * 0.18], [0.35, 0.65]);
    var M = 36, NS = 400, st = { mode: 'cond', seed: 3 };
    var EPS, X1, COND, MARG, cross, mean1 = G.w[0] * G.mu[0][0] + G.w[1] * G.mu[1][0];
    function X(tau) { return L + (W - L - R) * tau; }
    function Y(x) { return T + (H - T - B) * (1 - (x + 3) / 6); }
    var heat = document.createElement('canvas');
    function vel(x, tau) { var m = [0]; post(G, [x], tau, 1 - tau, m); return (m[0] - x) / (1 - tau); }
    function build() {
      var r = rng(st.seed); EPS = []; X1 = []; MARG = [];
      for (var i = 0; i < M; i++) {
        EPS.push(gauss(r));
        var k = r() < G.w[0] ? 0 : 1; X1.push(G.mu[k][0] + 0.18 * gauss(r));
      }
      cross = 0;
      for (i = 0; i < M; i++) for (var j = i + 1; j < M; j++) if ((EPS[i] - EPS[j]) * (X1[i] - X1[j]) < 0) cross++;
      for (i = 0; i < M; i++) {
        var x = EPS[i], path = [x], m = [0];
        for (var s = 0; s < NS; s++) {
          var tau = s / NS, tau2 = (s + 1) / NS;
          post(G, [x], tau, 1 - tau, m);
          var eps = (x - tau * m[0]) / (1 - tau);
          x = tau2 * m[0] + (1 - tau2) * eps; // 线性调度下的 Euler = DDIM 一步
          path.push(x);
        }
        MARG.push(path);
      }
      // 密度底图 p_τ(x)，每列归一化
      var cw = 136, ch = 90; heat.width = cw; heat.height = ch;
      var hc = heat.getContext('2d'), img = hc.createImageData(cw, ch), c = pal(C.cv);
      var ac = parseInt(c.accent.replace('#', ''), 16), ar = (ac >> 16) & 255, ag = (ac >> 8) & 255, abl = ac & 255;
      for (var cx = 0; cx < cw; cx++) {
        var ta = Math.min(0.995, cx / (cw - 1)), col = [], mx = 0;
        for (var cy = 0; cy < ch; cy++) {
          var xv = 3 - 6 * cy / (ch - 1), pd = 0;
          for (var k2 = 0; k2 < 2; k2++) { var S = ta * ta * G.s2[k2] + (1 - ta) * (1 - ta), dd = xv - ta * G.mu[k2][0]; pd += G.w[k2] * Math.exp(-0.5 * dd * dd / S) / Math.sqrt(S); }
          col.push(pd); if (pd > mx) mx = pd;
        }
        for (cy = 0; cy < ch; cy++) { var o = 4 * (cy * cw + cx); img.data[o] = ar; img.data[o + 1] = ag; img.data[o + 2] = abl; img.data[o + 3] = Math.round(110 * Math.pow(col[cy] / mx, 0.8)); }
      }
      hc.putImageData(img, 0, 0);
    }
    function draw(p) {
      var c = pal(C.cv), tau = Math.min(1, p / 0.9);
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(heat, X(0), Y(3), X(1) - X(0), Y(-3) - Y(3));
      ctx.strokeStyle = rgba(c.line, 0.9); ctx.lineWidth = 1;
      [-2, -1, 0, 1, 2].forEach(function (v) { ctx.beginPath(); ctx.moveTo(X(0), Y(v)); ctx.lineTo(X(1), Y(v)); ctx.stroke(); txt(ctx, String(v), L - 8, Y(v) + 4, c.muted, 11.5, 'right', MONO); });
      [0, 0.25, 0.5, 0.75, 1].forEach(function (v) { txt(ctx, v.toFixed(2), X(v), H - B + 16, c.muted, 11.5, 'center', MONO); });
      txt(ctx, 'τ = 0：纯噪声 N(0,1)', X(0), H - 5, c.muted, 12, 'left');
      txt(ctx, 'τ = 1：数据（两个峰，权重 0.35 / 0.65）', X(1), H - 5, c.muted, 12, 'right');
      // 当前 τ 竖线
      ctx.strokeStyle = c.accent; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(tau), T); ctx.lineTo(X(tau), H - B); ctx.stroke(); ctx.setLineDash([]);
      var showC = st.mode === 'cond' || st.mode === 'both', showM = st.mode === 'marg' || st.mode === 'both';
      if (st.mode === 'marg') {
        // 速度场箭头
        ctx.strokeStyle = rgba(c.fg, 0.35); ctx.lineWidth = 1.2;
        for (var gi = 0; gi < 12; gi++) for (var gj = 0; gj < 13; gj++) {
          var ta = 0.02 + gi / 12, xv = -2.7 + gj * 0.45; if (ta > 0.94) continue;
          var v = vel(xv, ta), dx = 1, dy = v, nn = Math.sqrt(dx * dx + dy * dy), lp = 16;
          var x0 = X(ta), y0 = Y(xv), ux = (X(ta + 0.1) - X(ta)) / 0.1, uy = (Y(xv + 1) - Y(xv));
          var ex = x0 + lp * (dx * ux) / Math.hypot(dx * ux, dy * uy), ey = y0 + lp * (dy * uy) / Math.hypot(dx * ux, dy * uy);
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(ex, ey); ctx.stroke();
          var an = Math.atan2(ey - y0, ex - x0); ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - 5 * Math.cos(an - 0.5), ey - 5 * Math.sin(an - 0.5)); ctx.moveTo(ex, ey); ctx.lineTo(ex - 5 * Math.cos(an + 0.5), ey - 5 * Math.sin(an + 0.5)); ctx.stroke();
        }
      }
      for (var i = 0; i < M; i++) {
        var colr = X1[i] < 0 ? c.p[1] : c.p[0];
        if (showC) {
          ctx.strokeStyle = rgba(colr, st.mode === 'both' ? 0.35 : 0.7); ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(X(0), Y(EPS[i])); var xc = (1 - tau) * EPS[i] + tau * X1[i]; ctx.lineTo(X(tau), Y(xc)); ctx.stroke();
          if (st.mode === 'cond') { ctx.fillStyle = colr; ctx.beginPath(); ctx.arc(X(tau), Y(xc), 3, 0, 7); ctx.fill(); }
        }
        if (showM) {
          var path = MARG[i], lim = Math.round(tau * NS), xm = path[lim];
          var mc = xm < mean1 ? c.p[1] : c.p[0]; mc = path[NS] < mean1 ? c.p[1] : c.p[0];
          ctx.strokeStyle = rgba(mc, 0.85); ctx.lineWidth = 1.6; ctx.beginPath();
          for (var s = 0; s <= lim; s += 4) { if (s) ctx.lineTo(X(s / NS), Y(path[s])); else ctx.moveTo(X(0), Y(path[0])); }
          ctx.lineTo(X(lim / NS), Y(xm)); ctx.stroke();
          ctx.fillStyle = mc; ctx.beginPath(); ctx.arc(X(lim / NS), Y(xm), 3, 0, 7); ctx.fill();
        }
        if (st.mode === 'one') {
          // 一步 Euler：x1 = ε + v(ε, 0)，v(ε,0) = E[x1] − ε
          ctx.strokeStyle = rgba(c.bad, 0.55); ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]);
          ctx.beginPath(); ctx.moveTo(X(0), Y(EPS[i])); ctx.lineTo(X(tau), Y((1 - tau) * EPS[i] + tau * mean1)); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      if (st.mode === 'one') {
        ctx.fillStyle = c.bad; ctx.beginPath(); ctx.arc(X(1), Y(mean1), 5, 0, 7); ctx.fill();
        txt(ctx, '全部落到均值 ' + mean1.toFixed(2) + '（两峰之间，没有数据）', X(1) - 8, Y(mean1) - 10, c.bad, 12.5, 'right');
      }
      var head = { cond: '训练时看到的：每对（噪声, 数据）连一条直线，速度 = x₁ − x₀ 是常数', marg: '推理时走的：网络学到的是这些直线在每个点上的平均速度（箭头），沿它积分', both: '两者叠在一起：直线互相穿过，积分路径不相交', one: '只积分一步：v(x, 0) 等于“数据均值 − x”，一步就走到均值' }[st.mode];
      txt(ctx, head, L, 18, c.fg, 13);
    }
    var pl = new Player({ dur: 7000, draw: draw, btn: 'a2-play', range: 'a2-p', watch: 'a2-cv', p0: 0.6 });
    function out() { var o = $('a2-out'); if (o) o.textContent = M + ' 对样本的条件直线两两相交 ' + cross + ' 次；边际路径（常微分方程的解）相交 0 次。数据均值 = ' + mean1.toFixed(2) + '。'; }
    seg('a2-m', function (v) { st.mode = v; pl.render(); });
    var rs = $('a2-re'); if (rs) rs.addEventListener('click', function () { st.seed++; build(); out(); pl.restart(); });
    build(); out(); pl.render();
    if (!REDUCED) pl.play();
    var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)');
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { build(); pl.render(); });
  })();

  // ======================================================================
  // 动画 3：从噪声生成一整段动作（16 步 × 2 维 = 32 维）
  // ======================================================================
  var CHUNK = (function () {
    var Hc = 16, S0 = [0, -0.85], GOAL = [0, 0.85], OB = [0, 0], OR = 0.28;
    var tmpl = [], names = ['左绕·贴近', '左绕·宽', '右绕·贴近', '右绕·宽'], amp = [-0.5, -0.74, 0.5, 0.74], wts = [0.3, 0.2, 0.3, 0.2];
    amp.forEach(function (A) {
      var v = [];
      for (var j = 0; j < Hc; j++) { var s = (j + 1) / Hc; v.push(A * Math.sin(Math.PI * Math.pow(s, 0.9)), S0[1] + (GOAL[1] - S0[1]) * s); }
      tmpl.push(v);
    });
    var SIG = 0.03, G = GMM(tmpl, tmpl.map(function () { return SIG * SIG; }), wts);
    var mean = new Array(2 * Hc).fill(0);
    tmpl.forEach(function (v, k) { for (var i = 0; i < 2 * Hc; i++) mean[i] += G.w[k] * v[i]; });
    return { Hc: Hc, S0: S0, GOAL: GOAL, OB: OB, OR: OR, G: G, names: names, mean: mean, SIG: SIG };
  })();
  (function () {
    var C = mkCanvas('a3-cv', 680, 420); if (!C) return;
    var ctx = C.ctx, W = C.W, H = C.H, D = CHUNK, NSMP = 4;
    var st = { method: 'flow', K: 10, seed: 11, reg: false };
    var SMP;
    var SC = 190, OX = 215, OY = 210; // 场景区：左侧 430×420
    function P(x, y) { return [OX + x * SC, OY - y * SC]; }
    function collide(v) {
      var pts = [D.S0].concat(chunkPts(v));
      for (var j = 0; j < pts.length - 1; j++) for (var u = 0; u <= 4; u++) {
        var x = pts[j][0] + (pts[j + 1][0] - pts[j][0]) * u / 4, y = pts[j][1] + (pts[j + 1][1] - pts[j][1]) * u / 4;
        if (Math.hypot(x - D.OB[0], y - D.OB[1]) < D.OR) return true;
      }
      return false;
    }
    function chunkPts(v) { var a = []; for (var j = 0; j < D.Hc; j++) a.push([v[2 * j], v[2 * j + 1]]); return a; }
    function build() {
      var r = rng(st.seed), r2 = rng(st.seed * 17 + 1); SMP = [];
      for (var n = 0; n < NSMP; n++) {
        var e = []; for (var i = 0; i < 2 * D.Hc; i++) e.push(gauss(r));
        SMP.push(sample(D.G, st.method, st.K, e, r2));
      }
      var o = $('a3-out'); if (!o) return;
      var res = SMP.map(function (s, n) { var v = s.traj[st.K], side = v[2 * 7] < 0 ? '左' : '右'; return '样本 ' + (n + 1) + '：' + side + '绕' + (collide(v) ? '，撞上障碍' : ''); });
      o.textContent = res.join('；') + '。每个样本 ' + st.K + ' 次网络调用，一次出全部 16 步。' + (collide(D.mean) ? '回归（取平均）的轨迹撞上障碍。' : '');
    }
    function lerpV(A, B, f) { var o = new Array(A.length); for (var i = 0; i < A.length; i++) o[i] = A[i] + (B[i] - A[i]) * f; return o; }
    function draw(p) {
      var c = pal(C.cv), cc, i0;
      if (p < 0.1) cc = 0; else if (p < 0.88) cc = st.K * (p - 0.1) / 0.78; else cc = st.K;
      i0 = Math.min(Math.floor(cc), st.K - 1);
      var f = cc - i0, tnow = 1 - cc / st.K;
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
      // 场景框
      ctx.save(); ctx.beginPath(); ctx.rect(8, 8, 414, 404); ctx.clip();
      ctx.strokeStyle = rgba(c.line, 0.8); ctx.lineWidth = 1;
      for (var g = -1; g <= 1; g += 0.5) { var a = P(g, 0), b = P(0, g); ctx.beginPath(); ctx.moveTo(a[0], 8); ctx.lineTo(a[0], 412); ctx.stroke(); ctx.beginPath(); ctx.moveTo(8, b[1]); ctx.lineTo(422, b[1]); ctx.stroke(); }
      // 示范的四种做法（淡）
      D.G.mu.forEach(function (v) {
        ctx.strokeStyle = rgba(c.muted, 0.28); ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath();
        var s0 = P(D.S0[0], D.S0[1]); ctx.moveTo(s0[0], s0[1]);
        chunkPts(v).forEach(function (q) { var pq = P(q[0], q[1]); ctx.lineTo(pq[0], pq[1]); }); ctx.stroke();
      });
      // 障碍、起点、目标
      var ob = P(D.OB[0], D.OB[1]);
      ctx.fillStyle = rgba(c.muted, 0.35); ctx.strokeStyle = c.muted; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ob[0], ob[1], D.OR * SC, 0, 7); ctx.fill(); ctx.stroke();
      txt(ctx, '障碍', ob[0], ob[1] + 5, c.fg, 13, 'center');
      var s0p = P(D.S0[0], D.S0[1]), gp = P(D.GOAL[0], D.GOAL[1]);
      ctx.fillStyle = c.fg; ctx.fillRect(s0p[0] - 7, s0p[1] - 7, 14, 14); txt(ctx, '机械臂末端', s0p[0] + 12, s0p[1] + 5, c.muted, 12);
      ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(gp[0], gp[1], 9, 0, 7); ctx.stroke(); txt(ctx, '目标', gp[0] + 14, gp[1] + 5, c.muted, 12);
      if (st.reg) {
        ctx.strokeStyle = c.bad; ctx.lineWidth = 2.4; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(s0p[0], s0p[1]);
        chunkPts(D.mean).forEach(function (q) { var pq = P(q[0], q[1]); ctx.lineTo(pq[0], pq[1]); }); ctx.stroke(); ctx.setLineDash([]);
        txt(ctx, '回归 = 四种做法取平均', P(0.05, 0.5)[0], P(0.05, 0.5)[1], c.bad, 12.5);
      }
      // 样本
      var sc = [c.p[0], c.p[1], c.p[3], c.p[5]];
      SMP.forEach(function (s, n) {
        var v = lerpV(s.traj[i0], s.traj[Math.min(i0 + 1, st.K)], f), pts = chunkPts(v);
        ctx.strokeStyle = rgba(sc[n], 0.25 + 0.6 * (1 - tnow)); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(s0p[0], s0p[1]);
        pts.forEach(function (q) { var pq = P(q[0], q[1]); ctx.lineTo(pq[0], pq[1]); }); ctx.stroke();
        pts.forEach(function (q, j) { var pq = P(q[0], q[1]); ctx.fillStyle = sc[n]; ctx.beginPath(); ctx.arc(pq[0], pq[1], 2 + 2.2 * (j + 1) / D.Hc, 0, 7); ctx.fill(); });
      });
      ctx.restore();
      ctx.strokeStyle = c.line; ctx.strokeRect(8, 8, 414, 404);
      // 右侧：每个样本对四种做法的后验
      var px = 440, pw = 228;
      txt(ctx, (cc >= st.K ? '完成' : '第 ' + Math.floor(cc) + ' / ' + st.K + ' 步') + ' · 噪声水平 t = ' + Math.max(0, tnow).toFixed(2), px, 28, c.fg, 13);
      ctx.fillStyle = rgba(c.line, 1); ctx.fillRect(px, 36, pw, 5); ctx.fillStyle = c.accent; ctx.fillRect(px, 36, pw * Math.max(0, tnow), 5);
      txt(ctx, '这一段动作像哪种示范（后验概率）', px, 66, c.muted, 12);
      var cls = [c.p[2], rgba(c.p[2], 0.45), c.p[4], rgba(c.p[4], 0.45)];
      SMP.forEach(function (s, n) {
        var rr = s.resp[Math.min(Math.round(cc), st.K)], y = 82 + n * 46, x = px;
        txt(ctx, '样本 ' + (n + 1), px, y + 12, sc[n], 12.5);
        for (var k = 0; k < 4; k++) { var w = pw * rr[k]; ctx.fillStyle = cls[k]; ctx.fillRect(x, y + 18, w, 14); x += w; }
        ctx.strokeStyle = c.line; ctx.strokeRect(px, y + 18, pw, 14);
      });
      var ly = 82 + NSMP * 46 + 8;
      D.names.forEach(function (nm, k) { var yy = ly + Math.floor(k / 2) * 20, xx = px + (k % 2) * 116; ctx.fillStyle = cls[k]; ctx.fillRect(xx, yy - 9, 14, 10); txt(ctx, nm, xx + 19, yy, c.muted, 12); });
      txt(ctx, '一个点 = 动作块里的一步（越大越靠后）', px, ly + 54, c.muted, 12);
      txt(ctx, '16 步同时去噪，不是一步一步往前走', px, ly + 72, c.muted, 12);
    }
    var pl = new Player({ dur: 8000, draw: draw, btn: 'a3-play', range: 'a3-p', watch: 'a3-cv', p0: 0.5 });
    seg('a3-m', function (v) { st.method = v; build(); pl.render(); });
    var ks = $('a3-k'), ko = $('a3-k-o');
    if (ks) ks.addEventListener('input', function () { st.K = +ks.value; ko.textContent = st.K; build(); pl.render(); });
    var rs = $('a3-re'); if (rs) rs.addEventListener('click', function () { st.seed++; build(); pl.restart(); });
    var rg = $('a3-reg'); if (rg) rg.addEventListener('click', function () { st.reg = !st.reg; rg.setAttribute('aria-pressed', st.reg ? 'true' : 'false'); pl.render(); });
    build(); pl.render();
    if (!REDUCED) pl.play();
  })();

  // ======================================================================
  // 动画 4：动作块怎么执行（滚动时域）
  // ======================================================================
  (function () {
    var C = mkCanvas('a4-cv', 680, 250); if (!C) return;
    var ctx = C.ctx, W = C.W, H = C.H, L = 124, R = 14;
    var PRE = {
      dp: { H: 16, Ta: 8, K: 10, Hz: 10, note: 'Diffusion Policy 真机：To = 2、Tp = 16、Ta = 8，10 Hz（表 7、§6.1）；推理步数正文写 10，表 7 写 16（读者注 1）' },
      pi20: { H: 50, Ta: 16, K: 10, Hz: 20, note: 'π0，UR5e / Franka 20 Hz：每块 50 步，执行 16 步后重新推理（附录 D）' },
      pi50: { H: 50, Ta: 25, K: 10, Hz: 50, note: 'π0，其他机器人 50 Hz：每块 50 步，执行 25 步后重新推理（附录 D）' },
      octo: { H: 64, Ta: 12, K: 20, Hz: 50, note: 'Octo 在 ALOHA 上微调：训练预测 64 步，测试执行 12 步（附录）；控制频率论文没写，这里的 50 Hz 是自设' }
    };
    var st = { H: 16, Ta: 8, K: 10, Hz: 10 };
    function steps() { return Math.max(3 * st.Ta + st.H, 40); }
    function draw(p) {
      var c = pal(C.cv), N = steps(), cur = p * (3 * st.Ta + st.Ta * 0.999), px = (W - L - R) / N;
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
      var X = function (s) { return L + s * px; };
      // 时间轴
      ctx.strokeStyle = c.line; ctx.lineWidth = 1;
      for (var s = 0; s <= N; s++) { if (s % st.Ta === 0 || s === N) { ctx.beginPath(); ctx.moveTo(X(s), 26); ctx.lineTo(X(s), H - 28); ctx.stroke(); } }
      txt(ctx, '控制步 →', 10, H - 12, c.muted, 12);
      for (s = 0; s <= N; s += st.Ta) txt(ctx, String(s), X(s), H - 12, c.muted, 11, 'center', MONO);
      txt(ctx, '执行', 10, 44, c.fg, 12.5);
      // 已执行
      ctx.fillStyle = c.accent; ctx.fillRect(X(0), 34, X(cur) - X(0), 14);
      ctx.strokeStyle = c.line; ctx.strokeRect(X(0), 34, X(4 * st.Ta) - X(0), 14);
      var nInf = Math.floor(cur / st.Ta) + 1, rowH = Math.min(36, (H - 96) / 4);
      for (var j = 0; j < 4; j++) {
        var y = 64 + j * rowH, t0 = j * st.Ta;
        txt(ctx, '推理 ' + (j + 1), 10, y + rowH * 0.6, j < nInf ? c.fg : rgba(c.muted, 0.5), 12.5);
        if (j >= nInf) continue;
        // 整块预测
        ctx.fillStyle = rgba(c.p[j % 2 ? 1 : 0], 0.22); ctx.fillRect(X(t0), y, X(t0 + st.H) - X(t0), rowH - 8);
        // 执行掉的部分
        var exEnd = Math.min(cur, t0 + st.Ta);
        ctx.fillStyle = c.p[j % 2 ? 1 : 0]; ctx.fillRect(X(t0), y, Math.max(0, X(exEnd) - X(t0)), rowH - 8);
        // 被丢弃的部分
        if (cur >= t0 + st.Ta) { ctx.strokeStyle = rgba(c.muted, 0.8); ctx.setLineDash([3, 3]); ctx.strokeRect(X(t0 + st.Ta), y, X(t0 + st.H) - X(t0 + st.Ta), rowH - 8); ctx.setLineDash([]); if (j === 0) { var msg = '这 ' + (st.H - st.Ta) + ' 步被下一次推理替换'; ctx.font = '12px sans-serif'; var tw = ctx.measureText(msg).width, tx = X(t0 + st.H) + 6; if (tx + tw > W - 4) tx = W - 4 - tw; txt(ctx, msg, tx, y + rowH * 0.55, c.muted, 12); } }
        // K 次去噪的小格
        for (var k = 0; k < Math.min(st.K, 20); k++) { ctx.fillStyle = rgba(c.fg, cur - t0 < 0.6 && k / st.K > (cur - t0) / 0.6 ? 0.12 : 0.55); ctx.fillRect(X(t0) - 4 - (Math.min(st.K, 20) - k) * 2.5, y + 2, 1.6, rowH - 12); }
      }
      // 光标
      ctx.strokeStyle = c.fg; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(cur), 28); ctx.lineTo(X(cur), H - 28); ctx.stroke();
    }
    var pl = new Player({ dur: 9000, draw: draw, btn: 'a4-play', range: 'a4-p', watch: 'a4-cv', p0: 0.4 });
    function out() {
      var o = $('a4-out'); if (!o) return;
      var inf = st.Hz / st.Ta, fw = inf * st.K;
      o.textContent = '每 ' + st.Ta + ' 步推理一次 → ' + st.Hz + ' Hz 下每秒 ' + inf.toFixed(2) + ' 次推理 × ' + st.K + ' 次去噪 = 每秒 ' + fw.toFixed(1) + ' 次去噪网络前向；每次推理要在 ' + (1000 * st.Ta / st.Hz).toFixed(0) + ' ms 内算完。每块 ' + st.H + ' 步里执行 ' + st.Ta + ' 步（' + Math.round(100 * st.Ta / st.H) + '%）。';
    }
    function sync() {
      ['H', 'Ta', 'K', 'Hz'].forEach(function (k) { var e = $('a4-' + k), oo = $('a4-' + k + '-o'); if (e) { e.value = st[k]; oo.textContent = st[k]; } });
      out(); pl.render();
    }
    ['H', 'Ta', 'K', 'Hz'].forEach(function (k) {
      var e = $('a4-' + k); if (!e) return;
      e.addEventListener('input', function () { st[k] = +e.value; if (st.Ta > st.H) { st.Ta = st.H; } sync(); var n = $('a4-note'); if (n) n.textContent = '自设参数'; });
    });
    seg('a4-pre', function (v) { var q = PRE[v]; st.H = q.H; st.Ta = q.Ta; st.K = q.K; st.Hz = q.Hz; var n = $('a4-note'); if (n) n.textContent = q.note; sync(); pl.restart(); });
    var n0 = $('a4-note'); if (n0) n0.textContent = PRE.dp.note;
    sync();
    if (!REDUCED) pl.play();
  })();
})();
