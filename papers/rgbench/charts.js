'use strict';
/* RGBench (arXiv 2511.06434) page charts.
   1) Figure 4 redrawn. Every value was read from the vector data of page 5 of the v2 PDF (pdftocairo -svg):
      left panel calibrated on the 0–350 s gridlines (0.2568 pt per second), right panel on the 10¹ and 10² gridlines
      (41.56 pt per decade, log scale). The bar error caps are drawn as in the paper (their meaning is not stated).
      This is not the paper's figure.
   2) A reader chart (not in the paper): per-cell CDr2s reduction of GarmentDynamics versus the better of PyBullet and
      Isaac Sim, computed from Tables 4 and 5, against the ranges the appendix text gives for each garment group.
   Palette: the site's validated four-slot categorical palette (same as the Dreamer page); shapes double-encode series. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const mk = (host, items) => { const lg = document.createElement('div'); lg.className = 'viz-legend'; lg.innerHTML = items.map(s => `<span><i style="background:var(--series-${s[1]})"></i>${s[0]}</span>`).join(''); host.appendChild(lg); };
  function shape(g, kind, x, y, r, c) {
    const a = { fill: c, stroke: 'var(--viz-surface)', 'stroke-width': 2 };
    if (kind === 'o') return el('circle', { cx: x, cy: y, r, ...a }, g);
    if (kind === 's') return el('rect', { x: x - r * 0.9, y: y - r * 0.9, width: r * 1.8, height: r * 1.8, rx: 1.5, ...a }, g);
    if (kind === 'd') return el('path', { d: `M${x},${y - r * 1.2}L${x + r * 1.2},${y}L${x},${y + r * 1.2}L${x - r * 1.2},${y}Z`, ...a }, g);
    return el('path', { d: `M${x},${y - r * 1.25}L${x + r * 1.15},${y + r * 0.85}L${x - r * 1.15},${y + r * 0.85}Z`, ...a }, g);
  }
  function tipper(box, svg, W) {
    const tip = document.createElement('div'); tip.className = 'viz-tip'; tip.hidden = true; box.appendChild(tip);
    return {
      show(e, html) { tip.hidden = false; tip.innerHTML = html; const b = box.getBoundingClientRect(); tip.style.left = Math.min(e.clientX - b.left + 12, b.width - 200) + 'px'; tip.style.top = (e.clientY - b.top + 10) + 'px'; },
      hide() { tip.hidden = true; }
    };
  }

  /* ---------- Figure 4 ---------- */
  const SIMS = [['GarmentDynamics（本文）', 1, 'o'], ['Isaac Sim', 2, 's'], ['MuJoCo', 3, 'd'], ['PyBullet', 4, 't']];
  const INIT = [[10.3, 7.0, 13.6], [157.7, 136.9, 178.5], [170.7, -27.8, 369.2], [141.5, -70.1, 353.1]]; /* bar top, lower cap, upper cap (s) */
  const NV = [5, 10, 20, 40];
  const STEP = [[2.7, 4.4, 6.5, 9.0], [18.3, 19.1, 23.9, 26.6], [35.3, 119.2, 421.6, null], [7.4, 23.3, 58.7, 143.1]]; /* ms; MuJoCo fails at 40k */
  (function fig4() {
    const host = document.getElementById('c-fig4'); if (!host) return;
    mk(host, SIMS);
    const box = document.createElement('div'); box.className = 'viz-box'; host.appendChild(box);
    const W = 820, H = 300, svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': '图 4 重画：左边平均初始化时间柱状图，右边平均每步时间对顶点数的对数折线' }, box);
    const T = tipper(box, svg, W);
    /* left: bars */
    const L = { x0: 64, x1: 330, y0: 250, y1: 30 }, ly = v => L.y0 - (L.y0 - L.y1) * Math.max(0, v) / 400;
    const gL = el('g', {}, svg);
    el('text', { x: L.x0, y: 16, class: 'viz-lab' }, gL).textContent = '平均初始化时间（s）';
    [0, 100, 200, 300, 400].forEach(v => { el('line', { x1: L.x0, x2: L.x1, y1: ly(v), y2: ly(v), class: 'viz-grid' }, gL); el('text', { x: L.x0 - 6, y: ly(v) + 4, 'text-anchor': 'end', class: 'viz-tick' }, gL).textContent = v; });
    const bw = 40, gap = (L.x1 - L.x0) / 4;
    INIT.forEach((d, i) => {
      const cx = L.x0 + gap * (i + 0.5), c = `var(--series-${SIMS[i][1]})`, top = ly(d[0]), h = L.y0 - top;
      el('path', { d: `M${cx - bw / 2},${L.y0}V${top + 4}Q${cx - bw / 2},${top} ${cx - bw / 2 + 4},${top}H${cx + bw / 2 - 4}Q${cx + bw / 2},${top} ${cx + bw / 2},${top + 4}V${L.y0}Z`, fill: c }, gL);
      const lo = ly(d[1]), hi = ly(d[2]);
      el('line', { x1: cx, x2: cx, y1: lo, y2: hi, stroke: 'var(--fg)', 'stroke-width': 1.2, opacity: 0.75 }, gL);
      [lo, hi].forEach(y => el('line', { x1: cx - 6, x2: cx + 6, y1: y, y2: y, stroke: 'var(--fg)', 'stroke-width': 1.2, opacity: 0.75 }, gL));
      el('text', { x: cx, y: L.y0 + 16, 'text-anchor': 'middle', class: 'viz-tick' }, gL).textContent = ['本文', 'Isaac', 'MuJoCo', 'PyBullet'][i];
      el('text', { x: cx + 9, y: top - 6, class: 'viz-tick' }, gL).textContent = d[0];
      const hit = el('rect', { x: cx - gap / 2, y: L.y1, width: gap, height: L.y0 - L.y1 + 20, fill: 'transparent' }, gL);
      hit.addEventListener('pointermove', e => T.show(e, `<b>${SIMS[i][0]}</b><br>柱高 ${d[0]} s<br>误差线 ${d[1]} 到 ${d[2]} s`));
      hit.addEventListener('pointerleave', T.hide);
      void h;
    });
    el('text', { x: L.x0, y: H - 8, class: 'viz-tick' }, gL).textContent = '下端越过 0 的误差线截在 0';
    /* right: lines, log y */
    const R = { x0: 430, x1: 760, y0: 250, y1: 30 }, rx = v => R.x0 + (R.x1 - R.x0) * (v - 5) / 35, ry = v => R.y0 - (R.y0 - R.y1) * (Math.log10(v) - 0) / (Math.log10(1000) - 0);
    const gR = el('g', {}, svg);
    el('text', { x: R.x0, y: 16, class: 'viz-lab' }, gR).textContent = '平均每步时间（ms，对数轴）';
    [1, 10, 100, 1000].forEach(v => { el('line', { x1: R.x0, x2: R.x1, y1: ry(v), y2: ry(v), class: 'viz-grid' }, gR); el('text', { x: R.x0 - 6, y: ry(v) + 4, 'text-anchor': 'end', class: 'viz-tick' }, gR).textContent = v; });
    NV.forEach(v => el('text', { x: rx(v), y: R.y0 + 16, 'text-anchor': 'middle', class: 'viz-tick' }, gR).textContent = v + 'k');
    el('text', { x: (R.x0 + R.x1) / 2, y: R.y0 + 34, 'text-anchor': 'middle', class: 'viz-tick' }, gR).textContent = '布料顶点数';
    STEP.forEach((s, i) => {
      const c = `var(--series-${SIMS[i][1]})`, pts = s.map((v, j) => v == null ? null : [rx(NV[j]), ry(v)]).filter(Boolean);
      el('polyline', { points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: c, 'stroke-width': 2 }, gR);
      pts.forEach(p => shape(gR, SIMS[i][2], p[0], p[1], 4.5, c));
    });
    el('text', { x: rx(40) - 4, y: ry(421.6) + 4, 'text-anchor': 'end', class: 'viz-tick' }, gR).textContent = 'MuJoCo 40k：失败';
    el('text', { x: rx(40) + 8, y: ry(143.1) + 4, class: 'viz-tick' }, gR).textContent = '143.1';
    el('text', { x: rx(40) + 8, y: ry(26.6) + 4, class: 'viz-tick' }, gR).textContent = '26.6';
    el('text', { x: rx(40) + 8, y: ry(9.0) + 4, class: 'viz-tick' }, gR).textContent = '9.0';
    const cross = el('line', { y1: R.y1, y2: R.y0, class: 'viz-cross', visibility: 'hidden' }, gR);
    const hit = el('rect', { x: R.x0 - 10, y: R.y1, width: R.x1 - R.x0 + 20, height: R.y0 - R.y1, fill: 'transparent' }, gR);
    hit.addEventListener('pointermove', e => {
      const r = svg.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width; let bi = 0; NV.forEach((v, j) => { if (Math.abs(rx(v) - mx) < Math.abs(rx(NV[bi]) - mx)) bi = j; });
      cross.setAttribute('x1', rx(NV[bi])); cross.setAttribute('x2', rx(NV[bi])); cross.setAttribute('visibility', 'visible');
      T.show(e, `<b>${NV[bi]}k 顶点</b><br>` + SIMS.map((s, i) => `<i style="background:var(--series-${s[1]})"></i>${s[0]} ${STEP[i][bi] == null ? '失败' : STEP[i][bi] + ' ms'}`).join('<br>') + `<br>Isaac ÷ 本文 = ${(STEP[1][bi] / STEP[0][bi]).toFixed(2)}×`);
    });
    hit.addEventListener('pointerleave', () => { T.hide(); cross.setAttribute('visibility', 'hidden'); });
    const t = document.createElement('details'); t.className = 'viz-table';
    t.innerHTML = '<summary>看数据表</summary><div class="tablewrap"><table><thead><tr><th>模拟器</th><th class="n">初始化 s</th><th class="n">误差线 s</th>' + NV.map(v => `<th class="n">${v}k 每步 ms</th>`).join('') + '</tr></thead><tbody>' +
      SIMS.map((s, i) => `<tr><td>${s[0]}</td><td class="n">${INIT[i][0]}</td><td class="n">${INIT[i][1]} – ${INIT[i][2]}</td>${STEP[i].map(v => `<td class="n">${v == null ? '失败' : v}</td>`).join('')}</tr>`).join('') + '</tbody></table></div>';
    host.appendChild(t);
  })();

  /* ---------- reader chart: per-cell CDr2s reduction vs the better baseline ---------- */
  /* [pybullet, isaacsim, ours] CDr2s from Table 4 (pseudo) and Table 5 (robot) */
  const G7 = ['T-shirt', 'L-Sleeves', 'Dress', 'Hoodie', 'Coat', 'Cakeskirt', 'Pleat Skirt'];
  const GRP = [0, 0, 1, 1, 1, 2, 2];
  const CLAIM = { pseudo: [[36, 46], [25, 35], [15, 25]], robot: [[65, 79], [50, 65], [40, 55]] };
  const T4 = {
    'T-shirt': { fling: [0.0532, 0.0567, 0.0419], fold: [0.0227, 0.0314, 0.0132], grasp: [0.0348, 0.0341, 0.0226] },
    'L-Sleeves': { fling: [0.0518, 0.0600, 0.0422], fold: [0.0280, 0.0308, 0.0243], grasp: [0.0347, 0.0312, 0.0280] },
    'Dress': { fling: [0.0889, 0.0928, 0.0687], fold: [0.0331, 0.0459, 0.0187], grasp: [0.0433, 0.0490, 0.0221] },
    'Hoodie': { fling: [0.0310, 0.0352, 0.0256], fold: [0.0240, 0.0302, 0.0225], grasp: [0.0275, 0.0308, 0.0217] },
    'Coat': { fling: [0.1071, 0.0815, 0.0379], fold: [0.0309, 0.0346, 0.0279], grasp: [0.0573, 0.0605, 0.0320] },
    'Cakeskirt': { fling: [0.0588, 0.0598, 0.0406], fold: [0.0266, 0.0308, 0.0179], grasp: [0.0487, 0.0517, 0.0269] },
    'Pleat Skirt': { fling: [0.0540, 0.0388, 0.0326], fold: [0.0256, 0.0255, 0.0126], grasp: [0.0241, 0.0201, 0.0159] } };
  const T5 = {
    'T-shirt': { fold: [0.0460, 0.0527, 0.0113], grasp: [0.2390, 0.0732, 0.0234] },
    'L-Sleeves': { fold: [0.0799, 0.0386, 0.0247], grasp: [0.2276, 0.1525, 0.0844] },
    'Dress': { fold: [0.0575, 0.0395, 0.0199], grasp: [0.1646, 0.1287, 0.0299] },
    'Hoodie': { fold: [0.0489, 0.0451, 0.0312], grasp: [0.2422, 0.2313, 0.0537] },
    'Coat': { fold: [0.0698, 0.0607, 0.0220], grasp: [0.1551, 0.1018, 0.0268] },
    'Cakeskirt': { fold: [0.0538, 0.0344, 0.0168], grasp: [0.2223, 0.1486, 0.0342] },
    'Pleat Skirt': { fold: [0.0386, 0.0265, 0.0113], grasp: [0.1449, 0.0997, 0.0345] } };
  const ACT = [['fling 甩', 1, 'o', 'fling'], ['fold 叠', 2, 's', 'fold'], ['grasp 抓', 3, 'd', 'grasp']];
  (function red() {
    const host = document.getElementById('c-red'); if (!host) return;
    mk(host, ACT.map(a => [a[0], a[1]]).concat([['原文附录对该组给的区间', 'band']]));
    host.querySelector('.viz-legend span:last-child i').style.cssText = 'background:var(--muted);opacity:.35;height:10px';
    const box = document.createElement('div'); box.className = 'viz-box'; host.appendChild(box);
    const W = 600, rowH = 26, top = 46, PH = top + rowH * 7 + 40, H = PH * 2, svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': '每格 CDr2s 相对较好基线的降幅，和附录文字给的区间对比' }, box);
    const T = tipper(box, svg, W);
    [['伪交互模式（表 4）', T4, 'pseudo', 0], ['机器人模式（表 5）', T5, 'robot', 1]].forEach(([title, tab, mode, k0]) => {
      const x0 = 100, pw = 470, sx = v => x0 + pw * v / 100, g = el('g', { transform: `translate(0,${k0 * PH})` }, svg);
      el('text', { x: x0, y: 16, class: 'viz-lab' }, g).textContent = title;
      [0, 25, 50, 75, 100].forEach(v => { el('line', { x1: sx(v), x2: sx(v), y1: top - 8, y2: top + rowH * 7 - 6, class: 'viz-grid' }, g); el('text', { x: sx(v), y: top + rowH * 7 + 10, 'text-anchor': 'middle', class: 'viz-tick' }, g).textContent = v + '%'; });
      G7.forEach((gn, r) => {
        const y = top + r * rowH + 4, b = CLAIM[mode][GRP[r]];
        el('rect', { x: sx(b[0]), y: y - 9, width: sx(b[1]) - sx(b[0]), height: 18, rx: 3, fill: 'var(--muted)', opacity: 0.22 }, g);
        el('text', { x: x0 - 10, y: y + 4, 'text-anchor': 'end', class: 'viz-tick' }, g).textContent = gn;
        ACT.forEach(a => {
          const v = tab[gn][a[3]]; if (!v) return;
          const best = Math.min(v[0], v[1]), red = 100 * (1 - v[2] / best), c = `var(--series-${a[1]})`;
          const s = shape(g, a[2], sx(red), y, 5, c);
          const hit = el('circle', { cx: sx(red), cy: y, r: 10, fill: 'transparent' }, g);
          const html = `<b>${gn} · ${a[3]} · ${mode === 'pseudo' ? '伪交互' : '机器人'}</b><br>CDr2s：PyBullet ${v[0]}，Isaac ${v[1]}，本文 ${v[2]}<br>相对较好基线降 ${red.toFixed(1)}%<br>相对 PyBullet ${(100 * (1 - v[2] / v[0])).toFixed(1)}%，相对 Isaac ${(100 * (1 - v[2] / v[1])).toFixed(1)}%<br>附录给该组的区间 ${b[0]}–${b[1]}%`;
          hit.addEventListener('pointermove', e => T.show(e, html)); hit.addEventListener('pointerleave', T.hide); void s;
        });
      });
      el('text', { x: x0 + pw / 2, y: PH - 8, 'text-anchor': 'middle', class: 'viz-tick' }, g).textContent = '本文 CDr2s 相对较好基线的降幅';
    });
    const t = document.createElement('details'); t.className = 'viz-table';
    const rows = [];
    [['伪交互', T4], ['机器人', T5]].forEach(([m, tab]) => G7.forEach(gn => ['fling', 'fold', 'grasp'].forEach(a => { const v = tab[gn][a]; if (!v) return; const best = Math.min(v[0], v[1]); rows.push(`<tr><td>${m}</td><td>${gn}</td><td>${a}</td><td class="n">${(100 * (1 - v[2] / v[0])).toFixed(1)}</td><td class="n">${(100 * (1 - v[2] / v[1])).toFixed(1)}</td><td class="n">${(100 * (1 - v[2] / best)).toFixed(1)}</td></tr>`); })));
    t.innerHTML = '<summary>看数据表</summary><div class="tablewrap"><table><thead><tr><th>模式</th><th>衣物</th><th>动作</th><th class="n">比 PyBullet 降 %</th><th class="n">比 Isaac 降 %</th><th class="n">比较好基线降 %</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
    host.appendChild(t);
  })();
})();
