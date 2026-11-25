// FabricBench 精读页的交互图和重画图。数据全部来自论文表 3、表 4、表 9 和式 (3)。
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
  function segInit(id, cb) {
    var box = document.getElementById(id); if (!box) return;
    box.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      box.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      cb(b.getAttribute('data-v'));
    });
  }
  function segVal(id) { var b = document.querySelector('#' + id + ' button[aria-pressed=true]'); return b ? b.getAttribute('data-v') : null; }

  var POL = [
    { n: 'π0.5', c: 'var(--p1)' }, { n: 'LingBot-VA', c: 'var(--p2)' }, { n: 'Fast-WAM', c: 'var(--p3)' },
    { n: 'GR00T', c: 'var(--p4)' }, { n: 'ACT', c: 'var(--p5)', d: '6 4' }, { n: 'DP', c: 'var(--p6)', d: '6 4' }
  ];

  // ---------- 表 3 底色 ----------
  function heat() {
    document.querySelectorAll('#t3 td.hm').forEach(function (td) {
      var v = +td.getAttribute('data-v');
      td.style.background = 'color-mix(in srgb, var(--accent) ' + Math.round(v * 0.32) + '%, transparent)';
    });
  }

  // ---------- 摩擦：式 (3) ----------
  function fric() {
    var svg = document.getElementById('fr-svg'); if (!svg) return;
    var rho = document.getElementById('fr-rho'), T = document.getElementById('fr-T'), th = document.getElementById('fr-th');
    var W = 640, H = 260, L = 56, R = 20, Tp = 16, B = 40, pw = W - L - R, ph = H - Tp - B;
    var X = function (r) { return L + r / 1.2 * pw; }, Y = function (v) { return Tp + ph - v * ph; };
    function draw() {
      var r = rho.value / 100, eps = +segVal('fr-eps'), t = +T.value;
      document.getElementById('fr-rho-o').textContent = r.toFixed(2);
      document.getElementById('fr-T-o').textContent = t + ' s';
      clear(svg);
      for (var i = 0; i <= 4; i++) {
        var yv = i / 4; el('line', { x1: L, x2: W - R, y1: Y(yv), y2: Y(yv), class: 'viz-grid' }, svg);
        el('text', { x: L - 8, y: Y(yv) + 4, 'text-anchor': 'end', class: 'viz-tick' }, svg, yv.toFixed(2));
      }
      [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2].forEach(function (xv) {
        el('text', { x: X(xv), y: H - B + 18, 'text-anchor': 'middle', class: 'viz-tick' }, svg, xv.toFixed(1));
      });
      el('text', { x: L + pw / 2, y: H - 4, 'text-anchor': 'middle', class: 'viz-lab' }, svg, '负载比 ρ（1 = 库仑锥边界）');
      el('text', { x: 14, y: Tp + ph / 2, 'text-anchor': 'middle', class: 'viz-lab', transform: 'rotate(-90 14 ' + (Tp + ph / 2) + ')' }, svg, '稳定滑动速度 v / ε');
      el('line', { x1: X(1), x2: X(1), y1: Tp, y2: Tp + ph, stroke: 'var(--muted)', 'stroke-dasharray': '3 3' }, svg);
      // 正则化：v/ε = 1 - sqrt(1-ρ)，ρ ≥ 1 时整段滑动（画成 1）
      var d = '';
      for (var k = 0; k <= 100; k++) { var rr = k / 100; d += (k ? 'L' : 'M') + X(rr).toFixed(1) + ' ' + Y(1 - Math.sqrt(1 - rr)).toFixed(1); }
      d += 'L' + X(1.2) + ' ' + Y(1);
      el('path', { d: d, fill: 'none', stroke: 'var(--p2)', 'stroke-width': 2.5 }, svg);
      // 锚定：ρ < 1 时 0，之后滑动
      el('path', { d: 'M' + X(0) + ' ' + Y(0) + 'L' + X(1) + ' ' + Y(0) + 'L' + X(1) + ' ' + Y(1) + 'L' + X(1.2) + ' ' + Y(1), fill: 'none', stroke: 'var(--p1)', 'stroke-width': 2.5 }, svg);
      el('text', { x: X(0.64), y: Y(0.18), class: 'viz-lab', fill: 'var(--p2)', style: 'fill:var(--p2)' }, svg, '速度正则化（已发布求解器）');
      el('text', { x: X(0.02), y: Y(0) - 8, class: 'viz-lab', style: 'fill:var(--p1)' }, svg, '锚定库仑（本文）：静摩擦区 v = 0');
      var vr = r < 1 ? 1 - Math.sqrt(1 - r) : 1;
      var va = r < 1 ? 0 : 1;
      el('line', { x1: X(Math.min(r, 1.2)), x2: X(Math.min(r, 1.2)), y1: Tp, y2: Tp + ph, stroke: 'var(--accent)', 'stroke-width': 1.5 }, svg);
      el('circle', { cx: X(Math.min(r, 1.2)), cy: Y(vr), r: 5, fill: 'var(--p2)' }, svg);
      el('circle', { cx: X(Math.min(r, 1.2)), cy: Y(va), r: 5, fill: 'var(--p1)' }, svg);
      var out = document.getElementById('fr-out');
      if (r < 1) {
        var v = eps * vr, slip = v * t;
        out.innerHTML = '正则化：v = ε(1 − √(1 − ρ)) = ' + eps + ' × ' + vr.toFixed(3) + ' = <b>' + v.toFixed(3) + ' mm/s</b>，持握 ' + t + ' s 累计滑动 <b>' + slip.toFixed(1) + ' mm</b>。<br>' +
          '锚定：ρ &lt; 1，v = 0，滑动 <b>0 mm</b>（只有 μ(h − d)/κ 量级的弹性预位移）。<br>' +
          '<span style="color:var(--muted)">要让正则化的滑动在 ' + t + ' s 内小于 1 mm，需要 ρ &lt; ' + rhoFor(1 / (eps * t)) + '。' +
          (r > rhoFor(1 / (eps * t), true) ? '同样的切向载荷下，μ 要放大到 ' + (r / rhoFor(1 / (eps * t), true)).toFixed(1) + ' 倍才能做到。' : '当前 ρ 已经低于这个值，不用放大 μ。') + '</span>';
      } else {
        out.innerHTML = 'ρ ≥ 1：两种模型都整体滑动，力被截在库仑锥上（μ f<sub>n</sub>）。夹持力不够，布会被拉出去。';
      }
      // 绞盘
      var mu = +segVal('fr-mu'), ang = +th.value, rad = ang * Math.PI / 180, f = Math.exp(mu * rad);
      document.getElementById('fr-th-o').textContent = ang + '°';
      document.getElementById('fr-cap').innerHTML = '绞盘因子 e<sup>μθ</sup> = e<sup>' + mu + ' × ' + rad.toFixed(2) + '</sup> = <b>' + f.toFixed(2) + '</b>：布绕指尖 ' + ang + '° 时，一端的张力能顶住另一端 ' + f.toFixed(2) + ' 倍的拉力。' +
        (mu >= 1.6 ? '夸大的 μ 下，松手后布自身的重量很难把缠住的部分拉下来，这就是正文说的“释放时被锁住”。' : '');
    }
    // 给定 v/ε 上限 q，求 ρ：1 - sqrt(1-ρ) = q → ρ = 1 - (1-q)^2
    function rhoFor(q, raw) { q = Math.min(q, 1); var r = 1 - Math.pow(1 - q, 2); return raw ? r : r.toFixed(3); }
    rho.addEventListener('input', draw); T.addEventListener('input', draw); th.addEventListener('input', draw);
    segInit('fr-eps', draw); segInit('fr-mu', draw);
    draw();
  }

  // ---------- 表 4 折线 ----------
  var T4 = {
    t: { sr: [[82, 44, 12, 76], [86, 62, 10, 84], [92, 34, 14, 42], [72, 34, 14, 58], [70, 16, 6, 28], [78, 32, 10, 50]],
         sc: [[82.4, 73.4, 35.7, 80.3], [83.0, 73.5, 28.2, 77.1], [81.6, 71.8, 27.9, 64.1], [76.9, 62.9, 31.1, 69.2], [79.6, 36.1, 25.8, 59.1], [78.8, 62.9, 26.5, 70.4]] },
    s: { sr: [[86, 20, 2, 64], [86, 22, 0, 86], [64, 16, 0, 0], [46, 18, 0, 38], [10, 6, 0, 4], [0, 0, 0, 0]],
         sc: [[94.5, 60.4, 42.2, 85.3], [97.0, 61.6, 40.4, 97.0], [87.2, 70.7, 43.1, 74.8], [80.4, 71.0, 44.6, 77.8], [70.3, 60.5, 43.4, 65.5], [57.3, 55.8, 41.7, 53.1]] }
  };
  var hidden = {};
  function ladder() {
    var svg = document.getElementById('ld-svg'); if (!svg) return;
    var leg = document.getElementById('ld-leg');
    POL.forEach(function (p, i) {
      var b = document.createElement('button');
      b.style.cssText = 'background:none;border:0;color:var(--fg);font:inherit;cursor:pointer;padding:0';
      b.setAttribute('aria-pressed', 'true');
      b.innerHTML = '<i style="background:' + p.c + '"></i>' + p.n;
      b.addEventListener('click', function () { hidden[i] = !hidden[i]; b.setAttribute('aria-pressed', hidden[i] ? 'false' : 'true'); b.style.opacity = hidden[i] ? .35 : 1; draw(); });
      leg.appendChild(b);
    });
    var W = 640, H = 330, L = 50, R = 120, Tp = 14, B = 40, pw = W - L - R, ph = H - Tp - B;
    var xs = [L + 20, L + pw * 0.3, L + pw * 0.58, L + pw - 10];
    var Y = function (v) { return Tp + ph - v / 100 * ph; };
    function draw() {
      var task = segVal('ld-task'), met = segVal('ld-met'), D = T4[task][met];
      clear(svg);
      for (var g = 0; g <= 100; g += 20) {
        el('line', { x1: L, x2: L + pw + 10, y1: Y(g), y2: Y(g), class: 'viz-grid' }, svg);
        el('text', { x: L - 8, y: Y(g) + 4, 'text-anchor': 'end', class: 'viz-tick' }, svg, g);
      }
      ['C0', 'C1', 'C2', 'C0 + 外观'].forEach(function (t, i) {
        el('text', { x: xs[i], y: H - B + 20, 'text-anchor': 'middle', class: 'viz-lab' }, svg, t);
      });
      el('line', { x1: (xs[2] + xs[3]) / 2, x2: (xs[2] + xs[3]) / 2, y1: Tp, y2: Tp + ph, stroke: 'var(--line)', 'stroke-dasharray': '2 4' }, svg);
      var ends = [];
      D.forEach(function (row, i) {
        if (hidden[i]) return;
        var p = POL[i];
        el('path', { d: 'M' + xs[0] + ' ' + Y(row[0]) + 'L' + xs[1] + ' ' + Y(row[1]) + 'L' + xs[2] + ' ' + Y(row[2]), fill: 'none', stroke: p.c, 'stroke-width': 2.2, 'stroke-dasharray': p.d || '' }, svg);
        el('path', { d: 'M' + xs[0] + ' ' + Y(row[0]) + 'L' + xs[3] + ' ' + Y(row[3]), fill: 'none', stroke: p.c, 'stroke-width': 1, 'stroke-dasharray': '2 4', opacity: .7 }, svg);
        for (var j = 0; j < 3; j++) {
          var c = el('circle', { cx: xs[j], cy: Y(row[j]), r: 4.5, fill: p.c }, svg);
          el('title', {}, c, p.n + ' · ' + ['C0', 'C1', 'C2'][j] + '：' + row[j]);
        }
        var h = el('circle', { cx: xs[3], cy: Y(row[3]), r: 5, fill: 'var(--viz-surface)', stroke: p.c, 'stroke-width': 2 }, svg);
        el('title', {}, h, p.n + ' · C0 + 外观：' + row[3] + '（C0 是 ' + row[0] + '）');
        ends.push({ y: Y(row[3]), n: p.n + ' ' + row[3], c: p.c });
      });
      // 右侧标签避让
      ends.sort(function (a, b) { return a.y - b.y; });
      for (var k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 15) ends[k].y = ends[k - 1].y + 15;
      ends.forEach(function (e) { el('text', { x: xs[3] + 12, y: e.y + 4, class: 'viz-tick', style: 'fill:' + e.c }, svg, e.n); });
      var note = document.getElementById('ld-note');
      var drops = D.map(function (r, i) { return POL[i].n + ' ' + (r[0] - r[2]) + ' / ' + (r[0] - r[3]); });
      note.innerHTML = '<span style="color:var(--muted);font-size:13.5px">C0→C2 降幅 / C0→外观 降幅（' + (met === 'sr' ? '百分点' : '分') + '）：' + drops.join('；') + '。' +
        (task === 's' && met === 'sc' ? ' 丝巾的分数没扣起点，C2 一列 40–45 分大概就是“丢下来的布”自己的覆盖率（读者注 8）。' : '') + '</span>';
    }
    segInit('ld-task', draw); segInit('ld-met', draw);
    draw();
  }

  // ---------- 图 4 重画 ----------
  function wilson(k, n) {
    var z = 1.959964, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [100 * (c - h), 100 * (c + h)];
  }
  function s2r() {
    var svg = document.getElementById('s2r-svg'); if (!svg) return;
    var D = [['提丝巾', 98, 70], ['展平 T 恤', 82, 55], ['展平丝巾', 86, 65], ['提袋子', 66, 50], ['装零食', 92, 85], ['叠 T 恤', 36, 35]];
    var W = 640, H = 400, L = 60, R = 24, Tp = 16, B = 46, pw = W - L - R, ph = H - Tp - B;
    var X = function (v) { return L + (v - 20) / 80 * pw; }, Y = function (v) { return Tp + ph - (v - 10) / 90 * ph; };
    for (var g = 20; g <= 100; g += 20) {
      el('line', { x1: X(g), x2: X(g), y1: Tp, y2: Tp + ph, class: 'viz-grid' }, svg);
      el('text', { x: X(g), y: H - B + 18, 'text-anchor': 'middle', class: 'viz-tick' }, svg, g);
    }
    for (g = 20; g <= 100; g += 20) {
      el('line', { x1: L, x2: W - R, y1: Y(g), y2: Y(g), class: 'viz-grid' }, svg);
      el('text', { x: L - 8, y: Y(g) + 4, 'text-anchor': 'end', class: 'viz-tick' }, svg, g);
    }
    el('line', { x1: X(20), y1: Y(20), x2: X(100), y2: Y(100), stroke: 'var(--muted)', 'stroke-dasharray': '5 4' }, svg);
    el('text', { x: X(93), y: Y(99), class: 'viz-tick' }, svg, 'y = x');
    el('text', { x: L + pw / 2, y: H - 6, 'text-anchor': 'middle', class: 'viz-lab' }, svg, '仿真成功率 %（N = 50）');
    el('text', { x: 16, y: Tp + ph / 2, 'text-anchor': 'middle', class: 'viz-lab', transform: 'rotate(-90 16 ' + (Tp + ph / 2) + ')' }, svg, '真机成功率 %（N = 20）');
    el('text', { x: X(22), y: Y(96), class: 'viz-lab' }, svg, 'ρ = 0.94，τb = 0.87（只有前两名对调）');
    var off = { '提丝巾': [8, 46, 'end'], '展平 T 恤': [-10, -10, 'end'], '展平丝巾': [-10, -10, 'end'], '提袋子': [-10, -10, 'end'], '装零食': [-10, -10, 'end'], '叠 T 恤': [10, 16] };
    D.forEach(function (d, i) {
      var sx = wilson(d[1] / 2, 50), sy = wilson(d[2] / 5, 20), c = POL[i].c;
      el('line', { x1: X(Math.max(20, sx[0])), x2: X(sx[1]), y1: Y(d[2]), y2: Y(d[2]), stroke: c, 'stroke-width': 1.4, opacity: .8 }, svg);
      el('line', { x1: X(d[1]), x2: X(d[1]), y1: Y(sy[0]), y2: Y(sy[1]), stroke: c, 'stroke-width': 1.4, opacity: .8 }, svg);
      var dot = el('circle', { cx: X(d[1]), cy: Y(d[2]), r: 6, fill: c, stroke: 'var(--viz-surface)', 'stroke-width': 1.5 }, svg);
      el('title', {}, dot, d[0] + '：仿真 ' + d[1] + '%（' + sx[0].toFixed(0) + '–' + sx[1].toFixed(0) + '），真机 ' + d[2] + '%（' + sy[0].toFixed(0) + '–' + sy[1].toFixed(0) + '）');
      var o = off[d[0]];
      el('text', { x: X(d[1]) + o[0], y: Y(d[2]) + o[1], 'text-anchor': o[2] || 'start', class: 'viz-lab' }, svg, d[0] + ' ' + d[1] + '/' + d[2]);
    });
  }

  function init() { heat(); fric(); ladder(); s2r(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
