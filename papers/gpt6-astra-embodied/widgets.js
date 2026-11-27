// GPT-6-Astra 具身评测报告精读页的交互图。
// 数字全部照录论文表 2、表 13；Wilson 区间和标准误是我们按论文给的回合数现算的。
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }
  function wilson(k, n) {
    var z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d;
    var h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [100 * (c - h), 100 * (c + h)];
  }
  function segInit(id, cb) {
    var seg = document.getElementById(id); if (!seg) return;
    seg.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      seg.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      cb(b.getAttribute('data-v'));
    });
  }

  // ---------- 表 2：各基准成功率 ----------
  // [名称, 已发表最好, 方法, 代理式最好, 方法, 单独 1× 运行, 10× 运行在 1× 处的截断, 10×, GPT 回合数 N（null = 论文没写）]
  var T2 = [
    ['LIBERO-Long++', 82.0, 'LiLo-VLA', null, '', 97.5, 97.5, 100.0, 120],
    ['LIBERO-PRO', 50.0, 'πRLinf', 92.6, 'RPent / GPT-6-Astra', 98.3, 98.3, 99.3, 800],
    ['LIBERO-Ultra-Long', 44.0, 'LiLo-VLA', null, '', 82.2, 82.2, 98.9, 90],
    ['RoboDojo', 29.6, 'Awomo-0.5', 31.4, 'PhysicalRSI', 54.2, 27.6, 81.9, 210],
    ['RoboLab', 42.9, 'FLUX 3 Action', null, '', 57.1, 57.1, 69.2, null],
    ['SIMPLE（Matched-8）', 92.5, 'Psi-0', null, '', 96.3, 97.5, 98.8, 80],
    ['BEHAVIOR', 14.8, 'Rondo', 5.3, 'Agent', 37.0, null, null, 100],
    ['DexJoCo', 40.3, 'π0.5', null, '', 78.2, 78.2, 87.3, 55],
    ['Bench2Dex', 25.5, 'π0.5', null, '', 25.6, 25.6, 61.5, 78],
    ['VLN-CE RxR', 76.5, 'Qwen-RobotNav', null, '', 82.0, 84.0, 90.0, 100],
    ['VLN-CE R2R', 77.4, 'Robostral Navigate', 81.3, 'GPT-6-Astra (ultra)', 80.0, 85.0, 88.0, 100],
    ['LHPR-VLN', 2.4, 'FantasyVLN', 5.3, 'Claude Code Opus-5', 21.1, 25.4, 28.9, 114]
  ];
  var t2State = { one: 'cut', ci: true };
  function t2Draw() {
    var svg = document.getElementById('t2-svg'); if (!svg) return;
    clear(svg);
    var W = 680, rowH = 40, T = 26, L = 150, R = 16, B = 30;
    var H = T + rowH * T2.length + B;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var X = function (v) { return L + (W - L - R) * v / 100; };
    [0, 25, 50, 75, 100].forEach(function (v) {
      el('line', { x1: X(v), x2: X(v), y1: T - 6, y2: H - B, 'class': 'viz-grid' }, svg);
      el('text', { x: X(v), y: H - B + 16, 'text-anchor': 'middle', 'class': 'viz-tick' }, svg, v + '%');
    });
    var bars = [
      ['sota', 'var(--p5)'], ['ag', 'var(--p4)'], ['one', 'var(--p2)'], ['ten', 'var(--p1)']
    ];
    T2.forEach(function (r, i) {
      var y0 = T + i * rowH;
      el('text', { x: L - 8, y: y0 + rowH / 2 - 2, 'text-anchor': 'end', 'class': 'viz-lab' }, svg, r[0]);
      el('text', { x: L - 8, y: y0 + rowH / 2 + 13, 'text-anchor': 'end', 'class': 'viz-tick' }, svg, r[8] == null ? 'N 未报告' : 'N = ' + r[8]);
      var vals = { sota: r[1], ag: r[3], one: t2State.one === 'cut' ? r[6] : r[5], ten: r[7] };
      var bh = 7;
      bars.forEach(function (b, j) {
        var v = vals[b[0]], y = y0 + 4 + j * (bh + 1.5);
        if (v == null) return;
        var rect = el('rect', { x: X(0), y: y, width: Math.max(X(v) - X(0), 1), height: bh, fill: b[1], rx: 1.5 }, svg);
        var who = b[0] === 'sota' ? '已发表最好 ' + r[2] : b[0] === 'ag' ? '代理式最好 ' + r[4] : b[0] === 'one' ? 'GPT-6-Astra 1×' : 'GPT-6-Astra 10×';
        el('title', {}, rect, r[0] + ' · ' + who + '：' + v.toFixed(1) + '%');
        if ((b[0] === 'one' || b[0] === 'ten') && t2State.ci && r[8]) {
          var k = Math.round(v * r[8] / 100), ci = wilson(k, r[8]);
          el('line', { x1: X(ci[0]), x2: X(ci[1]), y1: y + bh / 2, y2: y + bh / 2, stroke: 'var(--fg)', 'stroke-width': 1.3 }, svg);
          el('line', { x1: X(ci[0]), x2: X(ci[0]), y1: y + 1, y2: y + bh - 1, stroke: 'var(--fg)', 'stroke-width': 1.3 }, svg);
          el('line', { x1: X(ci[1]), x2: X(ci[1]), y1: y + 1, y2: y + bh - 1, stroke: 'var(--fg)', 'stroke-width': 1.3 }, svg);
        }
      });
    });
    if (t2State.one === 'sep') {
      el('text', { x: L, y: 14, 'class': 'viz-tick' }, svg, '橙色 = 表 2“Up to 1×”列（RoboDojo 的 54.2 带 VLA）');
    } else {
      el('text', { x: L, y: 14, 'class': 'viz-tick' }, svg, '橙色 = 10× 运行在 1× 处的截断（BEHAVIOR 没做 10×，空缺）');
    }
  }
  function t2Init() {
    segInit('t2-one', function (v) { t2State.one = v; t2Draw(); });
    segInit('t2-ci', function (v) { t2State.ci = v === 'on'; t2Draw(); });
    t2Draw();
  }

  // ---------- 表 13 / 图 7：token 与成功率 ----------
  // [名称, 组, 平均分, 平均成功率, token(M), 各类成功率 [泛化, 精度, 长程, 记忆, 开放]]
  // 标签位置手工排过：[dx, dy, 对齐]
  var OFF = {
    '基线（RoboRSI）': [8, 18, 'start'], '+ 执行子代理': [8, 32, 'start'], '+ 规划子代理': [8, 4, 'start'],
    '+ 反馈子代理': [10, 9, 'start'], 'VLA 闭环 L=4': [-8, -8, 'end'], 'VLA 闭环 L=1': [8, 4, 'start'],
    '方向式命令': [0, -12, 'middle'], '自适应块': [0, 20, 'middle'], '+ 历史压缩': [-8, 4, 'end'],
    '关节角控制': [0, 19, 'middle'], '固定块 L=4': [8, 4, 'start'], 'VLA 开环': [8, 4, 'start'],
    'ICL（表 5）': [8, 4, 'start'], 'ICL + VLA 闭环': [-8, 4, 'end']
  };
  var T13 = [
    ['基线（RoboRSI）', 'base', 22.78, 15.56, 2.56, [22.22, 0, 4.17, 22.22, 29.17]],
    ['+ 规划子代理', 'A', 26.03, 19.44, 2.96, [33.33, 4.17, 4.17, 38.89, 16.67]],
    ['+ 执行子代理', 'A', 21.56, 15.28, 2.55, [33.33, 4.17, 0, 22.22, 16.67]],
    ['+ 反馈子代理', 'A', 30.00, 24.72, 2.74, [27.78, 12.5, 8.33, 33.33, 41.67]],
    ['+ 历史压缩', 'A', 28.03, 21.11, 0.86, [33.33, 0, 4.17, 38.89, 29.17]],
    ['方向式命令', 'B', 26.61, 18.06, 1.91, [22.22, 8.33, 4.17, 22.22, 33.33]],
    ['关节角控制', 'B', 16.08, 9.72, 1.12, [5.56, 0, 0, 22.22, 20.83]],
    ['固定块 L=4', 'B', 17.97, 11.39, 0.43, [25, 0, 0, 11.11, 20.83]],
    ['自适应块', 'B', 26.36, 20.00, 1.15, [27.78, 8.33, 12.5, 22.22, 29.17]],
    ['VLA 开环', 'C', 11.21, 5.83, 0.39, [16.67, 0, 12.5, 0, 0]],
    ['VLA 闭环 L=1', 'C', 31.15, 23.61, 7.66, [30.56, 8.33, 16.67, 33.33, 29.17]],
    ['VLA 闭环 L=4', 'C', 34.64, 25.83, 2.80, [33.33, 8.33, 25, 33.33, 29.17]],
    ['ICL（表 5）', 'C', 39.24, 29.67, 9.57, [28.33, 15, 20, 70, 15]],
    ['ICL + VLA 闭环', 'C', 60.08, 54.17, 19.33, [50, 45.83, 41.67, 66.67, 66.67]]
  ];
  var NCAT = [36, 24, 24, 18, 24], NCAT_ICL = [60, 40, 40, 30, 40];
  function seAvg(cats, n) {
    var v = 0; cats.forEach(function (p, i) { p /= 100; v += p * (1 - p) / n[i]; });
    return 100 * Math.sqrt(v) / 5;
  }
  var t13State = { m: 'sr', err: true };
  var GCOL = { base: 'var(--fg)', A: 'var(--p3)', B: 'var(--p2)', C: 'var(--p1)' };
  function t13Draw() {
    var svg = document.getElementById('t13-svg'); if (!svg) return;
    clear(svg);
    var W = 680, H = 372, L = 52, R = 16, T = 26, B = 40;
    var lx0 = Math.log10(0.3), lx1 = Math.log10(30);
    var X = function (t) { return L + (W - L - R) * (Math.log10(t) - lx0) / (lx1 - lx0); };
    var ymax = 70;
    var Y = function (v) { return T + (H - T - B) * (1 - v / ymax); };
    [0, 10, 20, 30, 40, 50, 60, 70].forEach(function (v) {
      el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), 'class': 'viz-grid' }, svg);
      el('text', { x: L - 8, y: Y(v) + 4, 'text-anchor': 'end', 'class': 'viz-tick' }, svg, String(v));
    });
    [0.3, 1, 3, 10, 30].forEach(function (t) {
      el('line', { x1: X(t), x2: X(t), y1: T, y2: H - B, 'class': 'viz-grid' }, svg);
      el('text', { x: X(t), y: H - B + 16, 'text-anchor': 'middle', 'class': 'viz-tick' }, svg, t + 'M');
    });
    el('text', { x: (L + W - R) / 2, y: H - 6, 'text-anchor': 'middle', 'class': 'viz-lab' }, svg, '每回合 token（百万，对数轴；论文约定 1M ≈ 1 美元）');
    el('text', { x: L, y: 14, 'class': 'viz-tick' }, svg, t13State.m === 'sr' ? '纵轴：平均成功率 %' : '纵轴：平均得分');
    var base = T13[0];
    var by = t13State.m === 'sr' ? base[3] : base[2];
    el('line', { x1: X(base[4]), x2: X(base[4]), y1: T, y2: H - B, stroke: 'var(--muted)', 'stroke-dasharray': '4 4' }, svg);
    el('line', { x1: L, x2: W - R, y1: Y(by), y2: Y(by), stroke: 'var(--muted)', 'stroke-dasharray': '4 4' }, svg);
    T13.forEach(function (r) {
      var v = t13State.m === 'sr' ? r[3] : r[2];
      var x = X(r[4]), y = Y(v);
      if (t13State.m === 'sr' && t13State.err) {
        var s = seAvg(r[5], r[0].indexOf('ICL（') === 0 ? NCAT_ICL : NCAT) * 1.96;
        el('line', { x1: x, x2: x, y1: Y(Math.max(0, v - s)), y2: Y(Math.min(ymax, v + s)), stroke: GCOL[r[1]], 'stroke-width': 1.4, opacity: 0.6 }, svg);
      }
      var c = el('circle', { cx: x, cy: y, r: 5, fill: GCOL[r[1]] }, svg);
      el('title', {}, c, r[0] + '：平均分 ' + r[2] + '，成功率 ' + r[3] + '%，' + r[4] + 'M token');
      var o = OFF[r[0]] || [8, 4, 'start'];
      el('text', { x: x + o[0], y: y + o[1], 'text-anchor': o[2], 'class': 'viz-tick', style: 'fill:var(--fg)' }, svg, r[0]);
    });
  }
  function t13Init() {
    segInit('t13-m', function (v) { t13State.m = v; t13Draw(); });
    segInit('t13-err', function (v) { t13State.err = v === 'on'; t13Draw(); });
    t13Draw();
  }

  // ---------- 两个成功率差多少才算数 ----------
  var PRE = {
    b2d: [20, 78, 331, 1300, 'Bench2Dex 1×：GPT-6-Astra 20/78 对 π0.5 331/1300（附录 C.5）'],
    simple: [109, 120, 108, 120, 'SIMPLE Common-4：ICL 109/120 对 Psi-0 108/120（表 12）'],
    dir: [23, 126, 20, 126, '表 13：方向式命令 23/126 对基线 20/126（各类成功率 × 回合数还原）'],
    fb: [31, 126, 20, 126, '表 13：反馈子代理 31/126 对基线 20/126'],
    lhpr: [24, 114, 6, 114, 'LHPR-VLN 1×：GPT-6-Astra 24/114 对 Claude Code Opus-5 6/114（表 9）'],
    dojo: [172, 210, 58, 210, 'RoboDojo：10× 172/210 对 1× 58/210（同一批回合，配对，这里按独立样本算偏保守）']
  };
  function lgam(x) { // Lanczos
    var g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgam(1 - x);
    x -= 1; var a = c[0], t = x + g + 0.5;
    for (var i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function lchoose(n, k) { return lgam(n + 1) - lgam(k + 1) - lgam(n - k + 1); }
  function fisher(a, n1, c, n2) { // 双侧 Fisher 精确检验
    var K = a + c, N = n1 + n2, lo = Math.max(0, K - n2), hi = Math.min(K, n1);
    var lp = function (x) { return lchoose(n1, x) + lchoose(n2, K - x) - lchoose(N, K); };
    var p0 = lp(a), s = 0;
    for (var x = lo; x <= hi; x++) { var q = lp(x); if (q <= p0 + 1e-7) s += Math.exp(q); }
    return Math.min(1, s);
  }
  function sigDraw() {
    var ids = ['sg-k1', 'sg-n1', 'sg-k2', 'sg-n2'];
    var v = ids.map(function (id) { var e = document.getElementById(id); return e ? Math.max(0, Math.round(+e.value)) : 0; });
    var out = document.getElementById('sg-out'); if (!out) return;
    var k1 = v[0], n1 = v[1], k2 = v[2], n2 = v[3];
    if (n1 < 1 || n2 < 1 || k1 > n1 || k2 > n2) { out.textContent = '请输入 0 ≤ 成功数 ≤ 回合数'; return; }
    var w1 = wilson(k1, n1), w2 = wilson(k2, n2), p = fisher(k1, n1, k2, n2);
    out.innerHTML = 'A：' + (100 * k1 / n1).toFixed(1) + '%，95% 区间 ' + w1[0].toFixed(1) + '–' + w1[1].toFixed(1) +
      '<br>B：' + (100 * k2 / n2).toFixed(1) + '%，95% 区间 ' + w2[0].toFixed(1) + '–' + w2[1].toFixed(1) +
      '<br>差 ' + (100 * (k1 / n1 - k2 / n2)).toFixed(1) + ' 个百分点；Fisher 精确检验双侧 p = ' + (p < 1e-4 ? p.toExponential(1) : p.toFixed(3)) +
      (p < 0.05 ? '（p &lt; 0.05）' : '（p ≥ 0.05，这组样本分不出高下）');
    var svg = document.getElementById('sg-svg'); if (!svg) return;
    clear(svg);
    var W = 680, H = 96, L = 40, R = 16;
    var X = function (q) { return L + (W - L - R) * q / 100; };
    [0, 25, 50, 75, 100].forEach(function (q) {
      el('line', { x1: X(q), x2: X(q), y1: 8, y2: H - 22, 'class': 'viz-grid' }, svg);
      el('text', { x: X(q), y: H - 6, 'text-anchor': 'middle', 'class': 'viz-tick' }, svg, q + '%');
    });
    [[w1, k1 / n1, 'A', 'var(--p1)', 26], [w2, k2 / n2, 'B', 'var(--p2)', 56]].forEach(function (r) {
      el('rect', { x: X(r[0][0]), y: r[4] - 7, width: Math.max(1, X(r[0][1]) - X(r[0][0])), height: 14, fill: r[3], opacity: 0.35, rx: 3 }, svg);
      el('circle', { cx: X(100 * r[1]), cy: r[4], r: 5, fill: r[3] }, svg);
      el('text', { x: 14, y: r[4] + 4, 'class': 'viz-lab' }, svg, r[2]);
    });
  }
  function sigInit() {
    ['sg-k1', 'sg-n1', 'sg-k2', 'sg-n2'].forEach(function (id) {
      var e = document.getElementById(id); if (e) e.addEventListener('input', sigDraw);
    });
    var sel = document.getElementById('sg-pre');
    if (sel) sel.addEventListener('change', function () {
      var p = PRE[sel.value]; if (!p) return;
      document.getElementById('sg-k1').value = p[0]; document.getElementById('sg-n1').value = p[1];
      document.getElementById('sg-k2').value = p[2]; document.getElementById('sg-n2').value = p[3];
      var d = document.getElementById('sg-desc'); if (d) d.textContent = p[4];
      sigDraw();
    });
    sigDraw();
  }

  function init() { t2Init(); t13Init(); sigInit(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
