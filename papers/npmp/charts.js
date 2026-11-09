'use strict';
/* Figures 4 and 6a of NPMP (arXiv 1811.11711) redrawn. Every number was read from the paper's vector data
   (pdftocairo -svg of PDF pages 8 and 9; y calibrated on the gridlines 0 to 1 and 0 to 200, x on 0 to 6).
   Figure 4 is a box plot in the paper; here only the median and the box edges (quartiles) are kept, whiskers are dropped.
   Figure 6a curves are resampled every 0.15 x 10^9 steps. These are not the paper's figures.
   Palette: the site's validated chart palette (same as the Dreamer and SuperMimic pages). */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  function place(tip, box, e, w) { const bx = box.getBoundingClientRect(), tx = e.clientX - bx.left + 12; tip.style.left = Math.max(0, Math.min(tx, bx.width - w)) + 'px'; tip.style.top = (e.clientY - bx.top + 10) + 'px'; }

  /* ---------- figure 4 ---------- */
  (function () {
    const host = document.getElementById('c-fig4'); if (!host) return;
    const V = ['BC β=0', 'BC β=0.001', 'BC β=0.1', 'BC β=1.0', 'BC α=0', 'BC dim=20', 'LFPC β=0.1'];
    const D = {
      '训练集': [[[0.544, 0.41, 0.669], [0.461, 0.366, 0.595], [0.342, 0.285, 0.479]], [[0.633, 0.448, 0.888], [0.569, 0.407, 0.757], [0.429, 0.327, 0.567]], [[0.739, 0.546, 0.887], [0.672, 0.505, 0.797], [0.457, 0.384, 0.662]], [[0.527, 0.342, 0.662], [0.504, 0.342, 0.607], [0.372, 0.261, 0.474]], [[0.547, 0.434, 0.711], [0.487, 0.369, 0.632], [0.392, 0.269, 0.508]], [[0.649, 0.431, 0.785], [0.574, 0.391, 0.695], [0.391, 0.294, 0.624]], [[0.543, 0.413, 0.728], [0.484, 0.363, 0.654], [0.348, 0.212, 0.527]]],
      '测试集': [[[0.498, 0.396, 0.582], [0.466, 0.342, 0.55], [0.35, 0.233, 0.433]], [[0.538, 0.384, 0.791], [0.47, 0.361, 0.766], [0.386, 0.339, 0.546]], [[0.707, 0.584, 0.892], [0.693, 0.549, 0.809], [0.472, 0.359, 0.636]], [[0.453, 0.241, 0.615], [0.428, 0.239, 0.588], [0.371, 0.279, 0.516]], [[0.48, 0.422, 0.589], [0.472, 0.436, 0.523], [0.371, 0.319, 0.421]], [[0.502, 0.416, 0.73], [0.495, 0.438, 0.704], [0.397, 0.352, 0.538]], [[0.567, 0.4, 0.8], [0.516, 0.396, 0.687], [0.432, 0.296, 0.556]]] };
    const SER = [['nom（无噪声）', 1], ['med（中等噪声）', 4], ['high（较大噪声）', 2]];
    const legend = document.createElement('div'); legend.className = 'viz-legend';
    legend.innerHTML = SER.map(s => `<span><i style="background:var(--series-${s[1]})"></i>${s[0]}</span>`).join('') + '<span>竖线：四分位距（箱体上下沿）</span>';
    host.appendChild(legend);
    const box = document.createElement('div'); box.className = 'viz-box'; host.appendChild(box);
    const W = 820, PH = 230, M = { l: 46, r: 12, t: 24, b: 40 };
    const svg = el('svg', { viewBox: `0 0 ${W} ${PH * 2 + 6}`, role: 'img', 'aria-label': '图 4 重画：七种配置在训练集和测试集上相对专家表现的中位数和四分位' }, box);
    const tip = document.createElement('div'); tip.className = 'viz-tip'; tip.hidden = true; box.appendChild(tip);
    Object.keys(D).forEach((set, k) => {
      const oy = k * (PH + 6), g = el('g', { transform: `translate(0,${oy})` }, svg), gw = (W - M.l - M.r) / V.length;
      const sy = v => PH - M.b - (PH - M.t - M.b) * v;
      el('text', { x: M.l, y: 15, class: 'viz-lab' }, g).textContent = set;
      [0, 0.5, 1].forEach(v => { el('line', { x1: M.l, x2: W - M.r, y1: sy(v), y2: sy(v), class: 'viz-grid', 'stroke-dasharray': v === 1 ? '4 4' : null }, g); el('text', { x: M.l - 6, y: sy(v) + 4, 'text-anchor': 'end', class: 'viz-tick' }, g).textContent = v; });
      el('text', { x: W - M.r, y: sy(1) - 5, 'text-anchor': 'end', class: 'viz-tick' }, g).textContent = '专家 = 1';
      V.forEach((name, i) => {
        const cx = M.l + gw * (i + 0.5);
        el('text', { x: cx, y: PH - M.b + 18, 'text-anchor': 'middle', class: 'viz-tick' }, g).textContent = name;
        D[set][i].forEach(([m, lo, hi], j) => {
          const x = cx + (j - 1) * 18, c = `var(--series-${SER[j][1]})`;
          el('line', { x1: x, x2: x, y1: sy(lo), y2: sy(hi), stroke: c, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.55 }, g);
          el('circle', { cx: x, cy: sy(m), r: 5, fill: c, stroke: 'var(--viz-surface)', 'stroke-width': 2 }, g);
        });
        const hit = el('rect', { x: cx - gw / 2, y: M.t, width: gw, height: PH - M.t - M.b, fill: 'transparent' }, g);
        hit.addEventListener('pointermove', e => { tip.hidden = false; tip.innerHTML = `<b>${set} · ${name}</b><br>` + D[set][i].map(([m, lo, hi], j) => `<i style="background:var(--series-${SER[j][1]})"></i>${SER[j][0]} 中位 ${m}，四分位 ${lo} 到 ${hi}`).join('<br>'); place(tip, box, e, 300); });
        hit.addEventListener('pointerleave', () => { tip.hidden = true; });
      });
    });
    const t = document.createElement('details'); t.className = 'viz-table';
    t.innerHTML = '<summary>看数据表</summary><div class="tablewrap"><table><thead><tr><th>数据</th><th>配置</th>' + SER.map(s => `<th class="n">${s[0]} 中位</th><th class="n">四分位</th>`).join('') + '</tr></thead><tbody>' +
      Object.keys(D).flatMap(set => V.map((name, i) => `<tr><td>${set}</td><td>${name}</td>${D[set][i].map(([m, lo, hi]) => `<td class="n">${m}</td><td class="n">${lo}–${hi}</td>`).join('')}</tr>`)).join('') + '</tbody></table></div>';
    host.appendChild(t);
  })();

  /* ---------- figure 6a ---------- */
  (function () {
    const host = document.getElementById('c-fig6a'); if (!host) return;
    const F = {"0.001":[0.0,0.2,0.4,0.4,0.8,1.7,2.3,5.6,10.2,21.0,30.6,42.3,50.6,57.3,63.7,68.8,78.0,84.7,87.4,86.2,90.2,94.1,98.2,102.4,104.8,106.9,108.4,110.4,111.6,113.4,113.9,114.7,116.4,116.4,116.4,116.2,116.2,116.2,116.2,115.4,115.0],"0.1":[0.0,0.8,0.8,2.3,2.3,6.9,18.3,33.0,43.6,54.5,71.0,84.4,97.1,106.9,113.2,115.4,121.4,127.9,130.9,131.0,130.3,128.3,125.2,124.3,123.5,124.2,127.5,131.2,135.6,140.9,144.7,148.2,149.8,152.2,154.0,155.9,157.0,157.9,160.2,161.4,162.5],"0.46":[0.0,0.8,1.3,1.3,2.8,6.0,12.9,19.8,31.6,47.2,65.5,80.3,95.5,103.9,106.6,115.5,126.2,128.4,129.2,135.4,138.4,142.0,148.3,155.3,160.6,164.4,166.5,165.5,162.0,161.5,164.1,168.7,171.5,173.5,172.3,172.7,173.4,176.1,179.0,181.6,182.5],"1.0":[0.0,2.2,2.2,1.9,2.9,5.3,12.7,23.0,33.1,40.4,49.3,55.1,64.7,76.6,83.7,91.3,98.5,101.0,103.4,109.3,115.5,122.6,124.0,125.4,124.7,122.8,122.5,123.5,124.4,126.7,129.6,132.3,136.2,139.3,141.8,144.9,147.0,150.1,151.2,152.0,152.2]};
    const SER = [['0.001', 2], ['0.1', 4], ['0.46', 3], ['1.0', 1]], X = F['0.1'].map((_, i) => +(i * 0.15).toFixed(2));
    const legend = document.createElement('div'); legend.className = 'viz-legend';
    legend.innerHTML = SER.map(s => `<span><i style="background:var(--series-${s[1]})"></i>β = ${s[0]}</span>`).join('');
    host.appendChild(legend);
    const box = document.createElement('div'); box.className = 'viz-box'; host.appendChild(box);
    const W = 820, H = 300, M = { l: 46, r: 110, t: 14, b: 40 };
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': '图 6a 重画：追目标任务的中位回报对训练步数，四个 β' }, box);
    const tip = document.createElement('div'); tip.className = 'viz-tip'; tip.hidden = true; box.appendChild(tip);
    const sx = x => M.l + (W - M.l - M.r) * x / 6, sy = v => H - M.b - (H - M.t - M.b) * v / 200;
    [0, 50, 100, 150, 200].forEach(v => { el('line', { x1: M.l, x2: W - M.r, y1: sy(v), y2: sy(v), class: 'viz-grid' }, svg); el('text', { x: M.l - 6, y: sy(v) + 4, 'text-anchor': 'end', class: 'viz-tick' }, svg).textContent = v; });
    [0, 1, 2, 3, 4, 5, 6].forEach(x => { el('text', { x: sx(x), y: H - M.b + 16, 'text-anchor': 'middle', class: 'viz-tick' }, svg).textContent = x; });
    el('text', { x: (M.l + W - M.r) / 2, y: H - 6, 'text-anchor': 'middle', class: 'viz-tick' }, svg).textContent = '步数（×10⁹，原图横轴标 Steps，图注称 learner steps）';
    const endY = { '0.46': 182.5, '0.1': 166, '1.0': 148, '0.001': 115 };
    SER.forEach(s => {
      const c = `var(--series-${s[1]})`;
      el('polyline', { points: F[s[0]].map((v, i) => `${sx(X[i])},${sy(v)}`).join(' '), fill: 'none', stroke: c, 'stroke-width': 2 }, svg);
      el('text', { x: sx(6) + 8, y: sy(endY[s[0]]) + 4, class: 'viz-tick' }, svg).textContent = `β=${s[0]}  ${F[s[0]][40]}`;
    });
    const cross = el('line', { y1: M.t, y2: H - M.b, class: 'viz-cross', visibility: 'hidden' }, svg);
    const hit = el('rect', { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b, fill: 'transparent' }, svg);
    hit.addEventListener('pointermove', e => {
      const r = svg.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width; const i = Math.max(0, Math.min(40, Math.round((mx - M.l) / (W - M.l - M.r) * 40)));
      cross.setAttribute('x1', sx(X[i])); cross.setAttribute('x2', sx(X[i])); cross.setAttribute('visibility', 'visible');
      tip.hidden = false; tip.innerHTML = `<b>${X[i]} ×10⁹ 步</b><br>` + SER.map(s => `<i style="background:var(--series-${s[1]})"></i>β = ${s[0]}：${F[s[0]][i]}`).join('<br>'); place(tip, box, e, 170);
    });
    hit.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
    const t = document.createElement('details'); t.className = 'viz-table';
    t.innerHTML = '<summary>看数据表（每 0.75×10⁹ 步一列）</summary><div class="tablewrap"><table><thead><tr><th>β</th>' + X.filter((_, i) => i % 5 === 0).map(x => `<th class="n">${x}</th>`).join('') + '</tr></thead><tbody>' + SER.map(s => `<tr><td>${s[0]}</td>${F[s[0]].filter((_, i) => i % 5 === 0).map(v => `<td class="n">${v}</td>`).join('')}</tr>`).join('') + '</tbody></table></div>';
    host.appendChild(t);
  })();
})();
