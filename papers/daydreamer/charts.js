'use strict';
/* Figure A.1 recomputed on a real clock. Data: scores/xarm_adapt.csv in github.com/danijar/daydreamer (709016c): wall time,
   step, episode score. One object = 11 points; each bar sums the objects of the episodes ending in that half hour and
   divides by 30 minutes. The figure's vertical lines were mapped to wall time through steps / 2500. Not the paper's figure. */
(function () {
  const D = [[0.25,0.003],[0.75,0.0],[1.25,0.1],[1.75,0.1],[2.25,0.37],[2.75,0.37],[3.25,0.636],[3.75,0.806],[4.25,0.903],[4.75,0.936],[5.25,1.1],[5.75,0.736],[6.25,0.87],[6.75,1.336],[7.25,1.203],[7.75,0.503],[8.25,0.1],[8.75,0.0],[9.25,0.0],[9.75,0.2],[10.25,0.403],[10.75,0.667],[11.25,0.067],[11.75,0.473],[12.25,1.37],[12.75,0.773],[13.25,2.033],[13.75,1.87],[14.25,1.203],[14.75,1.142],[15.25,2.109],[15.75,1.703],[16.25,0.867]];
  const host = document.getElementById('c-adapt'); if (!host) return;
  const NS = 'http://www.w3.org/2000/svg', W = 820, HT = 300, M = { l: 48, r: 18, t: 22, b: 40 }, XM = 16.5, YM = 3.5;
  const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const sx = t => M.l + (W - M.l - M.r) * t / XM, sy = v => HT - M.b - (HT - M.t - M.b) * v / YM;
  const box = document.createElement('div'); box.className = 'viz-box'; host.appendChild(box);
  const svg = el('svg', { viewBox: `0 0 ${W} ${HT}`, role: 'img', 'aria-label': 'XArm 每分钟放好的物体数，按真实墙钟时间' }, box);
  [0, 1, 2, 3].forEach(v => { el('line', { x1: M.l, x2: W - M.r, y1: sy(v), y2: sy(v), class: 'viz-grid' }, svg); el('text', { x: M.l - 6, y: sy(v) + 4, 'text-anchor': 'end', class: 'viz-tick' }, svg).textContent = v; });
  [0, 4, 8, 12, 16].forEach(t => { el('text', { x: sx(t), y: HT - M.b + 16, 'text-anchor': 'middle', class: 'viz-tick' }, svg).textContent = t; });
  el('text', { x: (M.l + W - M.r) / 2, y: HT - 6, 'text-anchor': 'middle', class: 'viz-tick' }, svg).textContent = '真实墙钟时间（小时）';
  [[8.46, '日出线 8.46 h'], [12.63, '恢复线 12.63 h']].forEach(([t, s]) => { el('line', { x1: sx(t), x2: sx(t), y1: M.t, y2: HT - M.b, stroke: 'var(--muted)', 'stroke-dasharray': '4 4' }, svg); el('text', { x: sx(t) + 5, y: M.t + 10, class: 'viz-lab' }, svg).textContent = s; });
  el('line', { x1: M.l, x2: W - M.r, y1: sy(3.055), y2: sy(3.055), stroke: 'var(--muted)', 'stroke-dasharray': '2 3' }, svg);
  el('text', { x: M.l + 6, y: sy(3.055) - 5, class: 'viz-lab' }, svg).textContent = '图 6 的人类线 3.06';
  el('polyline', { points: D.map(d => `${sx(d[0])},${sy(d[1])}`).join(' '), fill: 'none', stroke: 'var(--series-1)', 'stroke-width': 2 }, svg);
  const dot = el('circle', { r: 4, fill: 'var(--series-1)', stroke: 'var(--viz-surface)', 'stroke-width': 2, visibility: 'hidden' }, svg);
  const cross = el('line', { y1: M.t, y2: HT - M.b, class: 'viz-cross', visibility: 'hidden' }, svg);
  const tip = document.createElement('div'); tip.className = 'viz-tip'; tip.hidden = true; box.appendChild(tip);
  const hit = el('rect', { x: M.l, y: M.t, width: W - M.l - M.r, height: HT - M.t - M.b, fill: 'transparent' }, svg);
  hit.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width; let b = D[0]; D.forEach(d => { if (Math.abs(sx(d[0]) - mx) < Math.abs(sx(b[0]) - mx)) b = d; });
    cross.setAttribute('x1', sx(b[0])); cross.setAttribute('x2', sx(b[0])); cross.setAttribute('visibility', 'visible'); dot.setAttribute('cx', sx(b[0])); dot.setAttribute('cy', sy(b[1])); dot.setAttribute('visibility', 'visible');
    tip.hidden = false; tip.innerHTML = `第 ${b[0]} 小时<br>${b[1].toFixed(2)} 个/分钟`; const bx = box.getBoundingClientRect(); tip.style.left = Math.min(e.clientX - bx.left + 12, bx.width - 110) + 'px'; tip.style.top = (e.clientY - bx.top + 10) + 'px';
  });
  hit.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); });
  const t = document.createElement('details'); t.className = 'viz-table';
  t.innerHTML = '<summary>看数据表</summary><div class="tablewrap"><table><thead><tr><th class="n">小时（半小时窗口中点）</th><th class="n">个/分钟</th></tr></thead><tbody>' + D.map(d => `<tr><td class="n">${d[0]}</td><td class="n">${d[1].toFixed(3)}</td></tr>`).join('') + '</tbody></table></div>';
  host.appendChild(t);
})();
