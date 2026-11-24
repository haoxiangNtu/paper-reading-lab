/* rl-families 页的四个交互小图：谱系图、PPO 裁剪目标、Q 高估玩具、三种梯度估计玩具。纯 SVG，颜色取页面 CSS 变量，深浅色都能用。 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) { if (attrs[k] !== undefined) e.setAttribute(k, attrs[k]); }
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, style, anchor) {
    var t = el('text', { x: x, y: y, 'text-anchor': anchor || 'start', style: style || 'fill:var(--fg);font-size:13px' }, parent);
    t.textContent = s;
    return t;
  }
  function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }
  function fmt(v, d) { return (v >= 0 ? ' ' : '') + v.toFixed(d === undefined ? 3 : d); }

  /* 可复现的随机数：mulberry32 + Box-Muller */
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

  /* ---------- 交互 1：谱系图 ---------- */
  var NODES = [
    { id: 'reinforce', name: 'REINFORCE', x: 70, y: 70, fam: 'on' },
    { id: 'a2c', name: 'A2C / A3C', x: 250, y: 70, fam: 'on' },
    { id: 'trpo', name: 'TRPO', x: 430, y: 70, fam: 'on' },
    { id: 'ppo', name: 'PPO', x: 610, y: 70, fam: 'on' },
    { id: 'dqn', name: 'DQN', x: 70, y: 205, fam: 'off' },
    { id: 'ddpg', name: 'DDPG', x: 250, y: 205, fam: 'off' },
    { id: 'td3', name: 'TD3', x: 430, y: 205, fam: 'off' },
    { id: 'sac', name: 'SAC', x: 610, y: 205, fam: 'off' },
    { id: 'pql', name: 'PQL', x: 250, y: 340, fam: 'off' },
    { id: 'fasttd3', name: 'FastTD3', x: 430, y: 340, fam: 'off' },
    { id: 'fastsac', name: 'FastSAC', x: 610, y: 340, fam: 'off' },
    { id: 'diff', name: 'SHAC 等', x: 790, y: 140, fam: 'dif' }
  ];
  var EDGES = [
    ['reinforce', 'a2c', 's', '加评论家 V'], ['a2c', 'trpo', 's', '限制步长'], ['trpo', 'ppo', 's', '裁剪代替 KL'],
    ['dqn', 'ddpg', 's', '连续动作'], ['ddpg', 'td3', 's', '修高估'], ['td3', 'sac', 'd', '借 CDQ'],
    ['ddpg', 'pql', 's', '并行化'], ['td3', 'fasttd3', 's', ''], ['pql', 'fasttd3', 's', '沿用观察'],
    ['sac', 'fastsac', 's', ''], ['fasttd3', 'fastsac', 's', '沿用配方'],
    ['a2c', 'ddpg', 'd', '都是演员-评论家'], ['ppo', 'pql', 'd', '借万级并行', 0.2]
  ];
  var CARDS = {
    reinforce: ['REINFORCE · 1992 · 同策略', '用整局回报乘 ∇log π 估梯度，无偏但方差大；减基线可降方差。', '它是整条同策略线的起点，式 (4) 的最朴素实现。', '#reinforce'],
    a2c: ['A2C / A3C · 2016–2017 · 同策略', '加评论家 V(s)，用 n 步回报估优势，不必等整局结束；A3C 多线程异步，A2C 同步凑批。', '修：方差、要等整局。和 DDPG 是同一种“演员-评论家”结构，只是评论家学 V、演员按似然比更新。', '#a2c'],
    trpo: ['TRPO · 2015 · 同策略', '最大化 E[ρA]，约束新旧策略的 KL ≤ δ（原文 0.01），用共轭梯度和线搜索求解。', '修：步长难调，一步走坏回不来。代价：二阶优化，实现复杂。', '#trpo'],
    ppo: ['PPO · 2017 · 同策略', '把比率 ρ 裁剪到 1 ± ε（ε = 0.2），一批数据跑几轮小批量；优势用 GAE。', '修：TRPO 太复杂。至今是 legged_gym、Isaac Lab、rsl_rl 的默认算法。它“几千个并行环境凑大批”的用法被 PQL、FastTD3 借走。', '#ppo'],
    dqn: ['DQN · 2013 / 2015 · 离策略', '回归 y = r + γ max Q⁻(s′, a′)，加回放缓存和目标网络；没有策略网络，动作取 argmax。', '只能用于离散动作。max 会带来高估（交互 3），Double DQN 部分修正。', '#dqn'],
    ddpg: ['DDPG · 2015 · 离策略', '确定性演员 μ(s) 代替 argmax，演员梯度 = ∇ₐQ · ∇θμ；软更新目标网络（τ = 0.001），动作上加 OU 噪声探索。', '修：DQN 不能做连续动作。留下：演员追着 Q 的误差跑，高估越滚越大。', '#ddpg'],
    td3: ['TD3 · 2018 · 离策略', '三处修改：两个 Q 取较小值（CDQ）、演员延迟更新（d = 2）、目标动作加裁剪噪声（σ̃ = 0.2，c = 0.5）。', '修：DDPG 的高估。留下：会低估；探索仍靠手调的固定噪声。', '#td3'],
    sac: ['SAC · 2018 · 离策略', '最大熵目标 r + αH(π)；随机的 tanh 高斯策略，用重参数化对 Q 求导；α 可自动调。', '修：探索靠外加噪声。注意它和 TD3 几乎同时发表（2018 年 1 月和 2 月），CDQ 是后来版本借来的，所以图上画虚线。', '#sac'],
    pql: ['PQL · 2023 · 离策略', '基于 DDPG：Actor、V-learner、P-learner 三个进程并发，按速度比分配 GPU；双 Q、n 步回报；各环境噪声在 [0.05, 0.8] 里线性铺开（混合探索）。', '修：离策略用不好万级并行环境。附带发现：大规模并行下 DDPG 比 SAC 好。代价：三进程调度复杂。', '#scale'],
    fasttd3: ['FastTD3 · 2025-05 · 离策略', 'TD3 + 并行环境 + 批 32,768 + C51 分布式评论家 + 混合噪声（σmax = 0.4）+ 低更新比。保留 CDQ：不加层归一化时它仍然关键。', '修：PQL 太复杂。作者称这是第一次有记录的、把离策略 RL 策略部署到全尺寸人形真机（Booster T1）；holosoma 补充说那次只控制了部分关节。', '#scale'],
    fastsac: ['FastSAC · 2025-12 · 离策略', '沿用 FastTD3 的配方，重新调稳 SAC：层归一化、关节限位定动作界、Q 取平均（不用 CDQ）、γ = 0.97 / 0.99、σ 上限 1.0、α 初值 0.001。', '修：SAC 在大规模并行下不稳。G1 / T1 行走 15 分钟可上真机。详见 holosoma-15min 精读页。', 'holosoma-15min.html'],
    diff: ['可微仿真：SHAC、DiffMimic、∇Mimic', '不估计梯度，而是穿过可微仿真器（或 SuperMimic 学到的世界模型）直接反传 h 步奖励，末端接价值函数。', '方差最小，但接触多时梯度会爆炸，所以要截短窗口。这是“三种梯度”里的第三种（交互 4 里的“路径梯度”在 R 可导时就是它）。', '#grad']
  };
  function famColor(f) { return f === 'on' ? 'var(--on)' : f === 'off' ? 'var(--off)' : 'var(--dif)'; }

  function drawMap() {
    var svg = document.getElementById('map-svg');
    if (!svg) return;
    clear(svg);
    var defs = el('defs', {}, svg);
    var mk = el('marker', { id: 'arr', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0,0 L10,5 L0,10 z', style: 'fill:var(--muted)' }, mk);
    txt(svg, 22, 30, '同策略：似然比梯度，只用新数据', 'fill:var(--on);font-size:13px;font-weight:600');
    txt(svg, 22, 165, '离策略：学 Q，用回放数据', 'fill:var(--off);font-size:13px;font-weight:600');
    txt(svg, 22, 300, '离策略 + 万级并行仿真', 'fill:var(--off);font-size:13px;font-weight:600');
    txt(svg, 852, 108, '第三条路：可微仿真', 'fill:var(--dif);font-size:12.5px;font-weight:600', 'end');
    var W = 100, H = 36, byId = {};
    NODES.forEach(function (n) { byId[n.id] = n; });
    EDGES.forEach(function (e) {
      var a = byId[e[0]], b = byId[e[1]];
      var x1 = a.x, y1 = a.y, x2 = b.x, y2 = b.y;
      if (Math.abs(y1 - y2) < 1) { x1 += W / 2; x2 -= W / 2; }
      else if (Math.abs(x1 - x2) < 1) { y1 += (y2 > y1 ? 1 : -1) * H / 2; y2 -= (y2 > y1 ? 1 : -1) * H / 2; }
      else { var dy = y2 > y1 ? 1 : -1; y1 += dy * H / 2; y2 -= dy * H / 2; x1 += (x2 > x1 ? 1 : -1) * W * 0.25; x2 -= (x2 > x1 ? 1 : -1) * W * 0.25; }
      el('line', { x1: x1, y1: y1, x2: x2, y2: y2, 'marker-end': 'url(#arr)',
        style: 'stroke:var(--muted);stroke-width:1.4;' + (e[2] === 'd' ? 'stroke-dasharray:5 4' : '') }, svg);
      if (e[3]) {
        var f = e[4] || 0.5, mx = x1 + (x2 - x1) * f, my = y1 + (y2 - y1) * f;
        var horiz = Math.abs(y1 - y2) < 1;
        var t = txt(svg, mx + (horiz ? 0 : 6), my + (horiz ? -6 : 4), e[3], 'fill:var(--muted);font-size:11.5px', horiz ? 'middle' : 'start');
        t.setAttribute('paint-order', 'stroke');
        t.setAttribute('style', 'fill:var(--muted);font-size:11.5px;stroke:var(--bg2);stroke-width:4px');
      }
    });
    NODES.forEach(function (n) {
      var g = el('g', { class: 'node', tabindex: '0', role: 'button', 'aria-label': n.name }, svg);
      el('rect', { x: n.x - W / 2, y: n.y - H / 2, width: W, height: H, rx: 8,
        style: 'fill:var(--panel);stroke:' + famColor(n.fam) + ';stroke-width:1.4' }, g);
      txt(g, n.x, n.y + 5, n.name, 'fill:var(--fg);font-size:14px;font-weight:600', 'middle');
      function pick() { showCard(n.id); }
      g.addEventListener('click', pick);
      g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
    });
  }
  function showCard(id) {
    var c = CARDS[id], box = document.getElementById('map-card');
    if (!c || !box) return;
    box.innerHTML = '';
    var h = document.createElement('h4'); h.textContent = c[0]; box.appendChild(h);
    var p1 = document.createElement('p'); p1.textContent = c[1]; box.appendChild(p1);
    var p2 = document.createElement('p'); p2.textContent = c[2]; box.appendChild(p2);
    var p3 = document.createElement('p'); var a = document.createElement('a');
    a.href = c[3]; a.textContent = c[3].charAt(0) === '#' ? '跳到正文这一段 →' : '打开精读页 →'; p3.appendChild(a); box.appendChild(p3);
  }

  /* ---------- 交互 2：PPO 裁剪目标 ---------- */
  var ppoA = 1;
  function drawPPO() {
    var svg = document.getElementById('ppo-svg');
    if (!svg) return;
    var eps = parseFloat(document.getElementById('ppo-eps').value);
    document.getElementById('ppo-eps-v').textContent = eps.toFixed(2);
    clear(svg);
    var X0 = 56, X1 = 620, Y0 = 20, Y1 = 262;
    var ymin = ppoA > 0 ? -0.1 : -2, ymax = ppoA > 0 ? 2 : 0.1;
    function sx(r) { return X0 + (r / 2) * (X1 - X0); }
    function sy(v) { return Y1 - (v - ymin) / (ymax - ymin) * (Y1 - Y0); }
    var lo = 1 - eps, hi = 1 + eps;
    var z0 = ppoA > 0 ? hi : 0, z1 = ppoA > 0 ? 2 : lo;
    el('rect', { x: sx(z0), y: Y0, width: sx(z1) - sx(z0), height: Y1 - Y0, style: 'fill:var(--note);opacity:.12' }, svg);
    txt(svg, (sx(z0) + sx(z1)) / 2, Y0 + 16, '梯度为 0', 'fill:var(--note);font-size:12px', 'middle');
    [0, 0.5, 1, 1.5, 2].forEach(function (r) {
      el('line', { x1: sx(r), y1: Y0, x2: sx(r), y2: Y1, style: 'stroke:var(--line);stroke-width:1' }, svg);
      txt(svg, sx(r), Y1 + 16, r.toFixed(1), 'fill:var(--muted);font-size:11.5px', 'middle');
    });
    var ticks = ppoA > 0 ? [0, 1, 2] : [-2, -1, 0];
    ticks.forEach(function (v) {
      el('line', { x1: X0, y1: sy(v), x2: X1, y2: sy(v), style: 'stroke:var(--line);stroke-width:1' }, svg);
      txt(svg, X0 - 6, sy(v) + 4, String(v), 'fill:var(--muted);font-size:11.5px', 'end');
    });
    [lo, hi].forEach(function (r) {
      el('line', { x1: sx(r), y1: Y0, x2: sx(r), y2: Y1, style: 'stroke:var(--muted);stroke-width:1;stroke-dasharray:2 3' }, svg);
    });
    txt(svg, sx(lo), Y1 - 6, '1−ε', 'fill:var(--muted);font-size:11.5px', 'end');
    txt(svg, sx(hi) + 3, Y1 - 6, '1+ε', 'fill:var(--muted);font-size:11.5px');
    var dU = '', dC = '';
    for (var i = 0; i <= 200; i++) {
      var r = 2 * i / 200;
      var u = r * ppoA, cr = Math.min(Math.max(r, lo), hi), c = Math.min(r * ppoA, cr * ppoA);
      dU += (i ? 'L' : 'M') + sx(r).toFixed(1) + ',' + sy(u).toFixed(1);
      dC += (i ? 'L' : 'M') + sx(r).toFixed(1) + ',' + sy(c).toFixed(1);
    }
    el('path', { d: dU, style: 'fill:none;stroke:var(--muted);stroke-width:1.6;stroke-dasharray:6 5' }, svg);
    el('path', { d: dC, style: 'fill:none;stroke:var(--accent);stroke-width:2.6' }, svg);
    txt(svg, X1 - 4, ppoA > 0 ? sy(1.9) : sy(-1.85), '不裁剪 ρA', 'fill:var(--muted);font-size:12px', 'end');
    txt(svg, ppoA > 0 ? sx(1.7) : sx(0.12), ppoA > 0 ? sy(hi) - 8 : sy(-lo) + 18, 'PPO 目标', 'fill:var(--accent);font-size:12.5px;font-weight:600', ppoA > 0 ? 'middle' : 'start');
    txt(svg, (X0 + X1) / 2, 298, '概率比 ρ = π_θ(a|s) / π_old(a|s)', 'fill:var(--muted);font-size:12px', 'middle');
    var out = document.getElementById('ppo-out');
    out.textContent = ppoA > 0
      ? 'A > 0：ρ ≤ ' + hi.toFixed(2) + ' 时目标 = ρA，继续推高这个动作的概率；ρ > ' + hi.toFixed(2) + ' 后目标恒为 (1+ε)A = ' + hi.toFixed(2) + '，不再推。'
      : 'A < 0：ρ ≥ ' + lo.toFixed(2) + ' 时目标 = ρA，继续压低这个动作的概率；ρ < ' + lo.toFixed(2) + ' 后目标恒为 (1−ε)A = ' + (-lo).toFixed(2) + '，不再压。';
  }

  /* ---------- 交互 3：高估玩具 ---------- */
  function drawOver() {
    var svg = document.getElementById('ov-svg');
    if (!svg) return;
    var K = parseInt(document.getElementById('ov-k').value, 10);
    var s = parseFloat(document.getElementById('ov-s').value);
    document.getElementById('ov-k-v').textContent = String(K);
    document.getElementById('ov-s-v').textContent = s.toFixed(2);
    var r = rng(12345), M = 20000, sMax = 0, sMin = 0, sAvg = 0;
    var q1 = new Float64Array(K);
    for (var m = 0; m < M; m++) {
      var best = -Infinity, bi = 0;
      for (var k = 0; k < K; k++) { q1[k] = s * gauss(r); if (q1[k] > best) { best = q1[k]; bi = k; } }
      var q2 = s * gauss(r); /* 第二个评论家在 a* 上的独立估计 */
      sMax += best; sMin += Math.min(best, q2); sAvg += (best + q2) / 2;
    }
    var vals = [
      ['Q₁(a*)：max', sMax / M, 'var(--off)'],
      ['min(Q₁,Q₂)：CDQ', sMin / M, 'var(--on)'],
      ['(Q₁+Q₂)/2：平均', sAvg / M, 'var(--dif)']
    ];
    clear(svg);
    var X0 = 160, X1 = 620, Y0 = 18, rowH = 56;
    var lim = Math.max(0.5, Math.max.apply(null, vals.map(function (v) { return Math.abs(v[1]); })) * 1.25);
    function sx(v) { return X0 + (v + lim) / (2 * lim) * (X1 - X0); }
    [-lim, -lim / 2, 0, lim / 2, lim].forEach(function (v) {
      el('line', { x1: sx(v), y1: Y0, x2: sx(v), y2: Y0 + rowH * 3, style: 'stroke:' + (v === 0 ? 'var(--fg)' : 'var(--line)') + ';stroke-width:' + (v === 0 ? 1.4 : 1) }, svg);
      txt(svg, sx(v), Y0 + rowH * 3 + 16, v.toFixed(2), 'fill:var(--muted);font-size:11.5px', 'middle');
    });
    txt(svg, sx(0), Y0 + rowH * 3 + 32, '真实值 0；右边是高估，左边是低估', 'fill:var(--muted);font-size:12px', 'middle');
    vals.forEach(function (v, i) {
      var y = Y0 + i * rowH + 12;
      txt(svg, X0 - 10, y + 21, v[0], 'fill:var(--fg);font-size:13px', 'end');
      var a = Math.min(sx(0), sx(v[1])), b = Math.max(sx(0), sx(v[1]));
      el('rect', { x: a, y: y + 4, width: Math.max(1, b - a), height: 26, rx: 3, style: 'fill:' + v[2] + ';opacity:.85' }, svg);
      txt(svg, v[1] >= 0 ? b + 6 : a - 6, y + 22, fmt(v[1]), 'fill:var(--fg);font-size:12.5px;font-family:var(--font-mono)', v[1] >= 0 ? 'start' : 'end');
    });
    document.getElementById('ov-out').textContent =
      'K = ' + K + '，σ = ' + s.toFixed(2) + '，' + M + ' 次模拟。偏差：max ' + fmt(vals[0][1]) + '，CDQ ' + fmt(vals[1][1]) + '，平均 ' + fmt(vals[2][1]) +
      '。K = 1 时没有“挑选”，max 无偏，但 min 仍偏低约 0.564σ（两个独立正态取小的期望是 −σ/√π）。';
  }

  /* ---------- 交互 4：三种梯度估计 ---------- */
  function drawGrad() {
    var svg = document.getElementById('gr-svg');
    if (!svg) return;
    var N = parseInt(document.getElementById('gr-n').value, 10);
    var s = parseFloat(document.getElementById('gr-s').value);
    var c = parseFloat(document.getElementById('gr-c').value);
    document.getElementById('gr-n-v').textContent = String(N);
    document.getElementById('gr-s-v').textContent = s.toFixed(2);
    document.getElementById('gr-c-v').textContent = c.toFixed(1);
    var mu = 0, B = 2000, r = rng(777);
    var ER = -((mu - 1) * (mu - 1) + s * s) + c;
    var acc = [[0, 0], [0, 0], [0, 0]];
    for (var b = 0; b < B; b++) {
      var g0 = 0, g1 = 0, g2 = 0;
      for (var n = 0; n < N; n++) {
        var a = mu + s * gauss(r), R = -(a - 1) * (a - 1) + c, sc = (a - mu) / (s * s);
        g0 += sc * R; g1 += sc * (R - ER); g2 += -2 * (a - 1);
      }
      g0 /= N; g1 /= N; g2 /= N;
      acc[0][0] += g0; acc[0][1] += g0 * g0;
      acc[1][0] += g1; acc[1][1] += g1 * g1;
      acc[2][0] += g2; acc[2][1] += g2 * g2;
    }
    var rows = [['似然比，无基线', 'var(--on)'], ['似然比，减基线', 'var(--on)'], ['路径梯度', 'var(--dif)']].map(function (x, i) {
      var m = acc[i][0] / B, v = Math.max(0, acc[i][1] / B - m * m);
      return { name: x[0], col: x[1], m: m, sd: Math.sqrt(v) };
    });
    clear(svg);
    var X0 = 150, X1 = 620, Y0 = 14, rowH = 54;
    var lo = 2, hi = 2;
    rows.forEach(function (q) { lo = Math.min(lo, q.m - q.sd); hi = Math.max(hi, q.m + q.sd); });
    var pad = Math.max(0.5, (hi - lo) * 0.08); lo -= pad; hi += pad;
    function sx(v) { return X0 + (v - lo) / (hi - lo) * (X1 - X0); }
    var step = Math.pow(10, Math.floor(Math.log10((hi - lo) / 4)));
    if ((hi - lo) / step > 10) step *= 2;
    if ((hi - lo) / step > 10) step *= 2.5;
    for (var t = Math.ceil(lo / step) * step; t <= hi; t += step) {
      el('line', { x1: sx(t), y1: Y0, x2: sx(t), y2: Y0 + rowH * 3, style: 'stroke:var(--line);stroke-width:1' }, svg);
      txt(svg, sx(t), Y0 + rowH * 3 + 16, (Math.abs(t) < 1e-9 ? 0 : +t.toPrecision(4)).toString(), 'fill:var(--muted);font-size:11.5px', 'middle');
    }
    el('line', { x1: sx(2), y1: Y0 - 4, x2: sx(2), y2: Y0 + rowH * 3, style: 'stroke:var(--fg);stroke-width:1.6;stroke-dasharray:4 3' }, svg);
    txt(svg, sx(2), Y0 + rowH * 3 + 32, '真实梯度 = 2；线段是 ±1 个标准差', 'fill:var(--muted);font-size:12px', 'middle');
    rows.forEach(function (q, i) {
      var y = Y0 + i * rowH + 26;
      txt(svg, X0 - 10, y + 5, q.name, 'fill:var(--fg);font-size:13px', 'end');
      el('line', { x1: sx(q.m - q.sd), y1: y, x2: sx(q.m + q.sd), y2: y, style: 'stroke:' + q.col + ';stroke-width:6;stroke-linecap:round;opacity:.55' }, svg);
      el('circle', { cx: sx(q.m), cy: y, r: 5.5, style: 'fill:' + q.col }, svg);
    });
    document.getElementById('gr-out').textContent =
      'N = ' + N + '，s = ' + s.toFixed(2) + '，c = ' + c.toFixed(1) + '，' + B + ' 批。\n' +
      rows.map(function (q) { return q.name + '：均值 ' + fmt(q.m, 2) + '，标准差 ' + q.sd.toFixed(2); }).join('\n') +
      '\n路径梯度的标准差理论值是 2s/√N = ' + (2 * s / Math.sqrt(N)).toFixed(2) + '。';
  }

  function bind(id, fn) { var e = document.getElementById(id); if (e) e.addEventListener('input', fn); }
  function init() {
    drawMap();
    var segs = document.querySelectorAll('#w-ppo .seg button');
    Array.prototype.forEach.call(segs, function (btn) {
      btn.addEventListener('click', function () {
        ppoA = parseInt(btn.getAttribute('data-a'), 10);
        Array.prototype.forEach.call(segs, function (b2) { b2.setAttribute('aria-pressed', String(b2 === btn)); });
        drawPPO();
      });
    });
    bind('ppo-eps', drawPPO); drawPPO();
    bind('ov-k', drawOver); bind('ov-s', drawOver); drawOver();
    bind('gr-n', drawGrad); bind('gr-s', drawGrad); bind('gr-c', drawGrad); drawGrad();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
