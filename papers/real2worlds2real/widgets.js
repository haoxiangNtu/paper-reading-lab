// Real2Worlds2Real 精读页的重画图。数字来自论文表 1，图 4、图 5 的数值是从 PDF 矢量路径按刻度标定读出的。
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
  function wilson(k, n) {
    var z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d;
    var h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [100 * (c - h), 100 * (c + h)];
  }

  // ---------- 表 1：每格 30 次，点 + Wilson 95% 区间 ----------
  var T1 = {
    a: { tasks: ['Peg', 'Cup', 'Gear', 'Wipe', 'Cap'],
      rows: [['ACT（起点）', [20, 16, 13, 14, 16], 'var(--p5)'], ['真机训练', [26, 29, 26, 18, 28], 'var(--p4)'],
             ['PolaRiS', [25, 20, 18, 15, 19], 'var(--p6)'], ['SimFoundry', [22, 25, 12, 14, 17], 'var(--p3)'],
             ['Real2Worlds2Real', [30, 30, 28, 21, 28], 'var(--p1)']] },
    b: { tasks: ['Lift', 'PickPlace', 'Nut', 'Cup'],
      rows: [['ACT（起点）', [17, 15, 12, 16], 'var(--p5)'], ['ENPIRE', [23, 25, 16, 24], 'var(--p6)'],
             ['ASPIRE', [27, 26, 19, 24], 'var(--p3)'], ['Real2Worlds2Real', [30, 27, 22, 30], 'var(--p1)']] }
  };
  function t1(which) {
    var svg = document.getElementById('t1-svg'); if (!svg) return;
    clear(svg);
    var D = T1[which], W = 680, L = 92, R = 16, Tp = 14, rowH = 22 + 13 * D.rows.length, H = Tp + rowH * D.tasks.length + 34;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var x = function (v) { return L + (W - L - R) * v / 100; };
    for (var g = 0; g <= 100; g += 20) {
      el('line', { x1: x(g), x2: x(g), y1: Tp, y2: H - 30, class: 'viz-grid' }, svg);
      el('text', { x: x(g), y: H - 14, 'text-anchor': 'middle', class: 'viz-tick' }, svg, g + '%');
    }
    D.tasks.forEach(function (t, i) {
      var y0 = Tp + i * rowH;
      el('text', { x: 6, y: y0 + rowH / 2 + 4, class: 'viz-lab', 'font-weight': 600 }, svg, t);
      if (i) el('line', { x1: 0, x2: W, y1: y0, y2: y0, stroke: 'var(--line)' }, svg);
      D.rows.forEach(function (r, j) {
        var k = r[1][i], ci = wilson(k, 30), y = y0 + 12 + j * 13;
        el('line', { x1: x(ci[0]), x2: x(ci[1]), y1: y, y2: y, stroke: r[2], 'stroke-width': 2, opacity: 0.55 }, svg);
        var c = el('circle', { cx: x(100 * k / 30), cy: y, r: 4.2, fill: r[2] }, svg);
        el('title', {}, c, r[0] + ' · ' + t + '：' + k + '/30 = ' + (100 * k / 30).toFixed(1) + '%，Wilson 95% [' + ci[0].toFixed(1) + ', ' + ci[1].toFixed(1) + ']');
      });
    });
    var lg = document.getElementById('t1-lg');
    if (lg) lg.innerHTML = D.rows.map(function (r) { return '<span><i style="background:' + r[2] + '"></i>' + r[0] + '</span>'; }).join('');
  }

  // ---------- 图 4：重画 ----------
  // (a) 横轴示范数 N；看见过 / 没见过的场景；DAgger 点横坐标读图约 2,600
  var F4a = { seen: [[100, 4], [500, 54], [1000, 66], [2000, 76], [3000, 76]],
              unseen: [[100, 3], [500, 43], [1000, 52], [2000, 49], [3000, 58]],
              dagger: { from: 2000, n: 2590, seen: 87, unseen: 73 } };
  var F4b = [[10, 17], [100, 46], [200, 57], [500, 64], [1000, 71]];
  function f4() {
    var svg = document.getElementById('f4-svg'); if (!svg) return;
    clear(svg);
    var W = 680, H = 280, Tp = 22, B = 44, ph = H - Tp - B;
    var y = function (v) { return Tp + ph * (1 - v / 100); };
    function panel(x0, w, xmax, ticks, title, xl) {
      var x = function (v) { return x0 + w * v / xmax; };
      for (var g = 0; g <= 100; g += 20) {
        el('line', { x1: x0, x2: x0 + w, y1: y(g), y2: y(g), class: 'viz-grid' }, svg);
        el('text', { x: x0 - 6, y: y(g) + 4, 'text-anchor': 'end', class: 'viz-tick' }, svg, g);
      }
      ticks.forEach(function (t) { el('text', { x: x(t), y: H - 26, 'text-anchor': 'middle', class: 'viz-tick' }, svg, t.toLocaleString('en')); });
      el('text', { x: x0 + w / 2, y: H - 8, 'text-anchor': 'middle', class: 'viz-tick' }, svg, xl);
      el('text', { x: x0, y: 12, class: 'viz-lab', 'font-weight': 600 }, svg, title);
      return x;
    }
    function line(x, pts, col, dash, shape, labs) {
      el('polyline', { points: pts.map(function (p) { return x(p[0]) + ',' + y(p[1]); }).join(' '), fill: 'none', stroke: col, 'stroke-width': 2, 'stroke-dasharray': dash || '' }, svg);
      pts.forEach(function (p, i) {
        var m = shape === 'sq' ? el('rect', { x: x(p[0]) - 4, y: y(p[1]) - 4, width: 8, height: 8, fill: col }, svg)
                               : el('circle', { cx: x(p[0]), cy: y(p[1]), r: 4.5, fill: col }, svg);
        el('title', {}, m, 'N = ' + p[0].toLocaleString('en') + '：' + p[1] + '%');
        if (labs) el('text', { x: x(p[0]) + (labs[i] && labs[i][0] || 0), y: y(p[1]) + (labs[i] ? labs[i][1] : -9), 'text-anchor': 'middle', class: 'viz-tick', fill: col }, svg, p[1]);
      });
    }
    var xa = panel(52, 270, 3000, [0, 1000, 2000, 3000], '(a) 示范数量', '训练示范数 N（世界集合固定）');
    line(xa, F4a.seen, 'var(--p1)', '', 'c', [[-12, -6], [-12, -6], [0, -9], [0, -9], [0, -9]]);
    line(xa, F4a.unseen, 'var(--p2)', '', 'sq', [[12, 14], [12, 14], [0, 16], [0, 16], [0, 16]]);
    var d = F4a.dagger;
    [['seen', 'var(--p1)', 'c', -9], ['unseen', 'var(--p2)', 'sq', 16]].forEach(function (s) {
      var v0 = s[0] === 'seen' ? 76 : 49;
      el('line', { x1: xa(d.from), y1: y(v0), x2: xa(d.n), y2: y(d[s[0]]), stroke: 'var(--p3)', 'stroke-width': 2, 'stroke-dasharray': '4 3' }, svg);
      var m = s[2] === 'sq' ? el('rect', { x: xa(d.n) - 4, y: y(d[s[0]]) - 4, width: 8, height: 8, fill: 'none', stroke: 'var(--p3)', 'stroke-width': 2 }, svg)
                            : el('circle', { cx: xa(d.n), cy: y(d[s[0]]), r: 4.5, fill: 'none', stroke: 'var(--p3)', 'stroke-width': 2 }, svg);
      el('title', {}, m, 'DAgger 之后（' + (s[0] === 'seen' ? '见过的场景' : '没见过的场景') + '）：' + d[s[0]] + '%；横坐标读图约 2,600');
      el('text', { x: xa(d.n) + 12, y: y(d[s[0]]) + 4, class: 'viz-tick', fill: 'var(--p3)' }, svg, d[s[0]]);
    });
    var xb = panel(400, 260, 1000, [0, 500, 1000], '(b) 世界数量', '训练世界数 N（示范固定 1,000 条）');
    line(xb, F4b, 'var(--p2)', '', 'sq', [[10, 14], [-12, -6], [-10, -8], [0, -9], [0, -9]]);
  }

  // ---------- 图 5：重画 ----------
  var F5b = { x: [0, 21, 39, 57, 88, 102, 122, 136],
    s: [['总体（20 个任务）', [52.9, 64.0, 66.0, 71.3, 71.1, 77.4, 82.2, 82.2], 'var(--p1)', ''],
        ['位置扰动', [46.8, 57.6, 61.2, 69.8, 71.0, 71.0, 78.8, 78.8], 'var(--p3)', ''],
        ['任务扰动', [59.0, 70.4, 70.8, 72.8, 71.2, 83.8, 85.6, 85.6], 'var(--p4)', ''],
        ['不挑程序的平均', [44.1, 43.2, 42.8, 45.8, 54.0, 64.4, 67.1, 69.1], 'var(--p5)', '5 4']] };
  var F5a = { x: [0, 1, 2, 3], tok: [28.1, 21.6, 17.9, 13.9] };
  function f5() {
    var svg = document.getElementById('f5-svg'); if (!svg) return;
    clear(svg);
    var W = 680, H = 290, Tp = 24, B = 44, ph = H - Tp - B;
    // (a) 柱
    var ax0 = 46, aw = 170, amax = 30, ya = function (v) { return Tp + ph * (1 - v / amax); };
    el('text', { x: ax0, y: 12, class: 'viz-lab', 'font-weight': 600 }, svg, '(a) 切柠檬：建世界用的 token');
    for (var g = 0; g <= 30; g += 10) {
      el('line', { x1: ax0, x2: ax0 + aw, y1: ya(g), y2: ya(g), class: 'viz-grid' }, svg);
      el('text', { x: ax0 - 6, y: ya(g) + 4, 'text-anchor': 'end', class: 'viz-tick' }, svg, g + 'M');
    }
    F5a.tok.forEach(function (v, i) {
      var bw = 26, cx = ax0 + aw * (i + 0.5) / 4;
      var r = el('rect', { x: cx - bw / 2, y: ya(v), width: bw, height: ya(0) - ya(v), fill: 'var(--p2)', rx: 2 }, svg);
      el('title', {}, r, i + ' 组技能：' + v + 'M token' + (i === 1 || i === 2 ? '（读图）' : '（图上标注）'));
      el('text', { x: cx, y: ya(v) - 5, 'text-anchor': 'middle', class: 'viz-tick' }, svg, v);
      el('text', { x: cx, y: H - 26, 'text-anchor': 'middle', class: 'viz-tick' }, svg, i);
    });
    el('text', { x: ax0 + aw / 2, y: H - 8, 'text-anchor': 'middle', class: 'viz-tick' }, svg, '技能库层级（嵌套）');
    // (b) 线
    var bx0 = 300, bw2 = 340, ymin = 30, ymax = 90;
    var xb = function (v) { return bx0 + bw2 * v / 136; }, yb = function (v) { return Tp + ph * (1 - (v - ymin) / (ymax - ymin)); };
    el('text', { x: bx0, y: 12, class: 'viz-lab', 'font-weight': 600 }, svg, '(b) LIBERO-Pro Long 成功率');
    for (var h = ymin; h <= ymax; h += 10) {
      el('line', { x1: bx0, x2: bx0 + bw2, y1: yb(h), y2: yb(h), class: 'viz-grid' }, svg);
      el('text', { x: bx0 - 6, y: yb(h) + 4, 'text-anchor': 'end', class: 'viz-tick' }, svg, h + '%');
    }
    F5b.x.forEach(function (t, i) { el('text', { x: xb(t), y: H - 26, 'text-anchor': 'middle', class: 'viz-tick' }, svg, (i === 4 || i === 6) ? '' : t); });
    el('text', { x: xb(88), y: H - 26, 'text-anchor': 'middle', class: 'viz-tick' }, svg, '88');
    el('text', { x: xb(122), y: H - 26, 'text-anchor': 'middle', class: 'viz-tick' }, svg, '122');
    el('text', { x: bx0 + bw2 / 2, y: H - 8, 'text-anchor': 'middle', class: 'viz-tick' }, svg, '技能数');
    F5b.s.forEach(function (s) {
      el('polyline', { points: F5b.x.map(function (t, i) { return xb(t) + ',' + yb(s[1][i]); }).join(' '), fill: 'none', stroke: s[2], 'stroke-width': 2, 'stroke-dasharray': s[3] }, svg);
      F5b.x.forEach(function (t, i) {
        var c = el('circle', { cx: xb(t), cy: yb(s[1][i]), r: 3.6, fill: s[2] }, svg);
        el('title', {}, c, s[0] + ' · ' + t + ' 个技能：' + s[1][i] + '%');
      });
    });
    var lg = document.getElementById('f5-lg');
    if (lg) lg.innerHTML = F5b.s.map(function (s) { return '<span><i style="background:' + s[2] + '"></i>' + s[0] + '</span>'; }).join('') + '<span><i style="background:var(--p2)"></i>token（图 a）</span>';
  }

  function init() {
    t1('a'); segInit('t1-seg', t1);
    f4(); f5();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
