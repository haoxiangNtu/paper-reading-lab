// PF-FLIP 精读页的交互图和重画图。
// 相场曲线按论文式 (7)，块开销曲线按 4.1 节的式子（O(·) 常数取 1），图 17 是从 PDF 矢量路径读出的柱高。
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
  function fmt(x, d) { return x.toFixed(d); }

  // ---------- 式 (7)：φ(ρ̃) ----------
  var phiState = { a: 1, r: 3, base: 'e' };
  function phiDraw() {
    var svg = document.getElementById('phi-svg'); if (!svg) return;
    clear(svg);
    var W = 680, H = 260, L = 52, R = 16, T = 14, B = 40;
    var xmax = 1.4;
    var X = function (s) { return L + (W - L - R) * s / xmax; };
    var Y = function (p) { return T + (H - T - B) * (1 - p / 1.05); };
    var ratio = Math.pow(10, phiState.r);
    var eta = phiState.base === 'e' ? Math.log(ratio) : Math.log10(ratio);
    var smin = eta / ratio, a = phiState.a, shalf = smin + 0.25 * a, sfull = smin + a;
    [0, 0.25, 0.5, 0.75, 1].forEach(function (p) {
      el('line', { x1: L, x2: W - R, y1: Y(p), y2: Y(p), 'class': 'viz-grid' }, svg);
      el('text', { x: L - 8, y: Y(p) + 4, 'text-anchor': 'end', 'class': 'viz-tick' }, svg, fmt(p, 2));
    });
    [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4].forEach(function (s) {
      el('text', { x: X(s), y: H - B + 16, 'text-anchor': 'middle', 'class': 'viz-tick' }, svg, fmt(s, 1));
    });
    el('text', { x: (L + W - R) / 2, y: H - 6, 'text-anchor': 'middle', 'class': 'viz-lab' }, svg, '原始密度 / 满水密度  s = ρ̃ / (ρ_l ρ̃_0)');
    el('text', { x: 6, y: (T + H - B) / 2, 'class': 'viz-lab' }, svg, 'φ');
    // 满水密度参考线
    el('line', { x1: X(1), x2: X(1), y1: T, y2: H - B, stroke: 'var(--muted)', 'stroke-dasharray': '2 4' }, svg);
    el('text', { x: X(1) + 4, y: T + 12, 'class': 'viz-tick' }, svg, '满水');
    // φ = 0.5 门槛
    el('line', { x1: L, x2: W - R, y1: Y(0.5), y2: Y(0.5), stroke: 'var(--p4)', 'stroke-dasharray': '6 4' }, svg);
    // 曲线
    var d = '', n = 400;
    for (var i = 0; i <= n; i++) {
      var s = xmax * i / n;
      var p = s < smin ? 0 : Math.min(Math.sqrt(Math.max(s - smin, 0) / a), 1);
      d += (i ? 'L' : 'M') + X(s).toFixed(1) + ',' + Y(p).toFixed(1);
    }
    el('path', { d: d, fill: 'none', stroke: 'var(--p1)', 'stroke-width': 2.5 }, svg);
    // ρ̃_min
    el('line', { x1: X(smin), x2: X(smin), y1: T, y2: H - B, stroke: 'var(--p2)', 'stroke-width': 1.5 }, svg);
    el('circle', { cx: X(Math.min(shalf, xmax)), cy: Y(0.5), r: 4.5, fill: 'var(--p4)' }, svg);
    var out = document.getElementById('phi-out');
    if (out) out.textContent = 'η_φ = ' + fmt(eta, 2) + '，ρ̃_min = 满水的 ' + fmt(100 * smin, 2) + '%（空气平均密度的 ' + fmt(eta, 1) + ' 倍）；φ = 0.5 在满水的 ' +
      fmt(100 * shalf, 1) + '%；φ 达到 1 要满水的 ' + fmt(100 * sfull, 1) + '%';
  }
  function phiInit() {
    var a = document.getElementById('phi-a'), r = document.getElementById('phi-r');
    if (!a || !r) return;
    var ao = document.getElementById('phi-a-o'), ro = document.getElementById('phi-r-o');
    a.addEventListener('input', function () { phiState.a = +a.value; ao.textContent = fmt(phiState.a, 2); phiDraw(); });
    r.addEventListener('input', function () { phiState.r = +r.value; ro.textContent = Math.round(Math.pow(10, phiState.r)); phiDraw(); });
    var seg = document.getElementById('phi-log');
    if (seg) seg.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      seg.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      phiState.base = b.getAttribute('data-v'); phiDraw();
    });
    phiDraw();
  }

  // ---------- 图 8 左：块大小与开销 ----------
  function blkDraw() {
    var svg = document.getElementById('blk-svg'); if (!svg) return;
    clear(svg);
    var W = 680, H = 270, L = 52, R = 16, T = 14, B = 40;
    var lo = Math.log2(4), hi = Math.log2(64);
    var X = function (n) { return L + (W - L - R) * (Math.log2(n) - lo) / (hi - lo); };
    var Y = function (p) { return T + (H - T - B) * (1 - p / 100); };
    [0, 25, 50, 75, 100].forEach(function (p) {
      el('line', { x1: L, x2: W - R, y1: Y(p), y2: Y(p), 'class': 'viz-grid' }, svg);
      el('text', { x: L - 8, y: Y(p) + 4, 'text-anchor': 'end', 'class': 'viz-tick' }, svg, p + '%');
    });
    [4, 8, 16, 32, 64].forEach(function (n) {
      el('text', { x: X(n), y: H - B + 16, 'text-anchor': 'middle', 'class': 'viz-tick' }, svg, n + '³');
    });
    el('text', { x: (L + W - R) / 2, y: H - 6, 'text-anchor': 'middle', 'class': 'viz-lab' }, svg, '块分辨率 n（对数轴）');
    el('line', { x1: X(16), x2: X(16), y1: T, y2: H - B, stroke: 'var(--muted)', 'stroke-dasharray': '2 4' }, svg);
    el('text', { x: X(16) + 4, y: T + 12, 'class': 'viz-tick' }, svg, 'MSBG 默认 16');
    var curves = [
      ['(a) 光滑界面浪费的格子 1 − n²/n³', 'var(--p2)', function (n) { return 100 * (1 - 1 / n); }],
      ['(b) 分形界面浪费的格子 1 − n^2.5/n³', 'var(--p4)', function (n) { return 100 * (1 - Math.pow(n, -0.5)); }],
      ['(c) 块边界格子 1 − (1 − 2/n)³', 'var(--p3)', function (n) { return 100 * (1 - Math.pow(1 - 2 / n, 3)); }],
      ['(d) 稠密块索引 1/(0.01 n³)', 'var(--p1)', function (n) { return Math.min(100, 100 / (0.01 * n * n * n)); }]
    ];
    var lg = document.getElementById('blk-lg'); if (lg) lg.innerHTML = '';
    curves.forEach(function (c) {
      var d = '';
      for (var i = 0; i <= 200; i++) {
        var n = Math.pow(2, lo + (hi - lo) * i / 200);
        d += (i ? 'L' : 'M') + X(n).toFixed(1) + ',' + Y(c[2](n)).toFixed(1);
      }
      el('path', { d: d, fill: 'none', stroke: c[1], 'stroke-width': 2.2 }, svg);
      var v16 = c[2](16);
      el('circle', { cx: X(16), cy: Y(v16), r: 3.5, fill: c[1] }, svg);
      if (lg) {
        var sp = document.createElement('span');
        sp.innerHTML = '<i style="background:' + c[1] + '"></i>' + c[0] + '，n = 16 时 ' + v16.toFixed(1) + '%';
        lg.appendChild(sp);
      }
    });
  }

  // ---------- 图 17 重画 ----------
  var F17 = [
    ['不完全 Cholesky', 1501.3, 310.0],
    ['几何多重网格', 91.4, 80.7],
    ['Galerkin MG', 22.0, 19.1],
    ['自适应 MG（本文）', 7.1, 6.38]
  ];
  function f17Draw() {
    var svg = document.getElementById('f17-svg'); if (!svg) return;
    clear(svg);
    var W = 680, H = 280, L = 56, R = 16, T = 16, B = 44;
    var lmin = 0, lmax = Math.log10(3000);
    var Y = function (v) { return T + (H - T - B) * (1 - (Math.log10(v) - lmin) / (lmax - lmin)); };
    [1, 10, 100, 1000].forEach(function (v) {
      el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), 'class': 'viz-grid' }, svg);
      el('text', { x: L - 8, y: Y(v) + 4, 'text-anchor': 'end', 'class': 'viz-tick' }, svg, String(v));
    });
    var gw = (W - L - R) / F17.length, bw = Math.min(46, gw * 0.3);
    F17.forEach(function (r, i) {
      var cx = L + gw * (i + 0.5);
      [[r[1], 'var(--p1)', -1], [r[2], 'var(--p2)', 1]].forEach(function (b) {
        var x = cx + (b[2] < 0 ? -bw - 2 : 2), y = Y(b[0]);
        var rect = el('rect', { x: x, y: y, width: bw, height: Y(1) - y, fill: b[1], rx: 2 }, svg);
        el('title', {}, rect, (b[2] < 0 ? 'PCG 迭代 ≈ ' : '每步时间 ≈ ') + (b[0] >= 100 ? Math.round(b[0]) : b[0].toFixed(1)) + (b[2] < 0 ? '' : ' 秒'));
        el('text', { x: x + bw / 2, y: y - 5, 'text-anchor': 'middle', 'class': 'viz-tick' }, svg, b[0] >= 100 ? String(Math.round(b[0])) : b[0].toFixed(1));
      });
      el('text', { x: cx, y: H - B + 18, 'text-anchor': 'middle', 'class': 'viz-lab' }, svg, r[0]);
    });
    el('text', { x: 14, y: T + 4, 'class': 'viz-tick' }, svg, '对数轴');
  }

  function init() { phiInit(); blkDraw(); f17Draw(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
