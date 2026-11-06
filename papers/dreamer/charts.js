'use strict';
/* Figure 4 of Dreamer redrawn as four small panels. Every point was read from the paper's vector data (page 4 of the PDF,
   pdftocairo -svg, y axis calibrated on the 0 to 1000 tick marks, x on the 10 to 40 ticks). This is not the paper's figure.
   Palette: validated with the dataviz check on the site's dark surface and shared with the SuperMimic page. */
(function () {
  const H = [3, 5, 10, 15, 20, 25, 30, 40];
  const P = [
    { t: 'Cartpole Swingup', D: [552.2, 745.9, 838.7, 819.1, 813.0, 763.2, 803.9, 862.3], N: [93.6, 176.5, 270.4, 261.5, 303.5, 310.5, 348.3, 347.0], L: [124.5, 256.3, 316.1, 411.6, 439.8, 382.9, 394.8, 497.2] },
    { t: 'Cheetah Run', D: [688.3, 798.4, 855.0, 793.7, 822.0, 813.7, 809.9, 834.7], N: [139.7, 165.9, 215.5, 407.9, 502.5, 662.2, 558.1, 836.2], L: [233.9, 281.9, 352.6, 558.6, 573.1, 516.3, 420.7, 384.4] },
    { t: 'Quadruped Walk', D: [576.8, 462.8, 920.9, 929.0, 931.0, 888.2, 926.0, 876.1], N: [82.1, 138.2, 248.1, 864.7, 764.5, 711.4, 932.2, 909.7], L: [49.1, 80.9, 118.6, 146.4, 186.2, 116.8, 166.8, 132.7] },
    { t: 'Walker Walk', D: [957.2, 965.2, 959.1, 961.1, 963.7, 967.0, 937.4, 528.5], N: [96.7, 275.7, 885.6, 966.8, 966.4, 967.1, 915.1, 743.0], L: [125.0, 229.5, 930.2, 924.8, 885.3, 706.9, 783.6, 585.3] }];
  const SER = [['D', 'Dreamer', 1], ['N', '无价值模型', 3], ['L', 'PlaNet', 2]];
  const host = document.getElementById('c-fig4'); if (!host) return;
  const NS = 'http://www.w3.org/2000/svg', W = 820, PH = 210, PW = 390, M = { l: 46, r: 62, t: 26, b: 36 };
  const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const legend = document.createElement('div'); legend.className = 'viz-legend';
  legend.innerHTML = SER.map(s => `<span><i style="background:var(--series-${s[2]})"></i>${s[1]}</span>`).join('');
  host.appendChild(legend);
  const box = document.createElement('div'); box.className = 'viz-box'; host.appendChild(box);
  const svg = el('svg', { viewBox: `0 0 ${W} ${PH * 2 + 8}`, role: 'img', 'aria-label': '四个任务上最终回报对想象长度 H' }, box);
  const tip = document.createElement('div'); tip.className = 'viz-tip'; tip.hidden = true; box.appendChild(tip);
  P.forEach((p, k) => {
    const ox = (k % 2) * (PW + 40), oy = (k >> 1) * (PH + 8), g = el('g', { transform: `translate(${ox},${oy})` }, svg);
    const sx = h => M.l + (PW - M.l - M.r) * (h - 3) / 37, sy = v => PH - M.b - (PH - M.t - M.b) * v / 1000;
    el('text', { x: M.l, y: 15, class: 'viz-lab' }, g).textContent = p.t;
    [0, 500, 1000].forEach(v => { el('line', { x1: M.l, x2: PW - M.r, y1: sy(v), y2: sy(v), class: 'viz-grid' }, g); el('text', { x: M.l - 6, y: sy(v) + 4, 'text-anchor': 'end', class: 'viz-tick' }, g).textContent = v; });
    [10, 20, 30, 40].concat([3]).forEach(h => { el('text', { x: sx(h), y: PH - M.b + 16, 'text-anchor': 'middle', class: 'viz-tick' }, g).textContent = h; });
    el('text', { x: (M.l + PW - M.r) / 2, y: PH - 4, 'text-anchor': 'middle', class: 'viz-tick' }, g).textContent = '想象长度 H';
    SER.forEach(s => {
      const c = `var(--series-${s[2]})`;
      el('polyline', { points: p[s[0]].map((v, i) => `${sx(H[i])},${sy(v)}`).join(' '), fill: 'none', stroke: c, 'stroke-width': 2 }, g);
      p[s[0]].forEach((v, i) => el('circle', { cx: sx(H[i]), cy: sy(v), r: 4, fill: c, stroke: 'var(--viz-surface)', 'stroke-width': 2 }, g));
    });
    if (k === 0) SER.forEach(s => { el('text', { x: PW - M.r + 6, y: sy(p[s[0]][7]) + 4, class: 'viz-tick' }, g).textContent = s[1].replace('无价值模型', '无价值'); });
    const cross = el('line', { y1: M.t, y2: PH - M.b, class: 'viz-cross', visibility: 'hidden' }, g);
    const hit = el('rect', { x: M.l - 8, y: M.t - 6, width: PW - M.l - M.r + 16, height: PH - M.t - M.b + 12, fill: 'transparent' }, g);
    const move = e => {
      const r = svg.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width - ox;
      let bi = 0; H.forEach((h, i) => { if (Math.abs(sx(h) - mx) < Math.abs(sx(H[bi]) - mx)) bi = i; });
      cross.setAttribute('x1', sx(H[bi])); cross.setAttribute('x2', sx(H[bi])); cross.setAttribute('visibility', 'visible');
      tip.hidden = false; tip.innerHTML = `<b>${p.t}，H = ${H[bi]}</b><br>` + SER.map(s => `<i style="background:var(--series-${s[2]})"></i>${s[1]} ${p[s[0]][bi]}`).join('<br>');
      const bx = box.getBoundingClientRect(), tx = e.clientX - bx.left + 12; tip.style.left = Math.min(tx, bx.width - 170) + 'px'; tip.style.top = (e.clientY - bx.top + 10) + 'px';
    };
    hit.addEventListener('pointermove', move); hit.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
  });
  const t = document.createElement('details'); t.className = 'viz-table';
  t.innerHTML = '<summary>看数据表</summary><div class="tablewrap"><table><thead><tr><th>任务</th><th>方法</th>' + H.map(h => `<th class="n">H=${h}</th>`).join('') + '</tr></thead><tbody>' + P.flatMap(p => SER.map(s => `<tr><td>${p.t}</td><td>${s[1]}</td>${p[s[0]].map(v => `<td class="n">${v}</td>`).join('')}</tr>`)).join('') + '</tbody></table></div>';
  host.appendChild(t);
})();
