'use strict';
/* DreamerV3 (arXiv 2301.04104v2, Nature 2025) taken apart into ten scenes. Network sizes come from the paper's Table 3 and
   Table 4 and from the official code (github.com/danijar/dreamerv3 e01491f). Result bars are the paper's tables and values
   read from the vector data of Figures 1 and 6. Everything marked toy is computed live by toy.js. update(p) is a pure
   function of the timeline p. */
(function () {
  const L = window.Lab3D, $ = id => document.getElementById(id), qs = new URLSearchParams(location.search);
  if (qs.get('embed') === '1') document.body.classList.add('embed');
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  const fmt = (x, d = 3) => { if (x === null || x === undefined || Number.isNaN(x)) return '—'; if (!isFinite(x)) return x > 0 ? '∞' : '−∞'; const a = Math.abs(x); if (a !== 0 && (a >= 1e5 || a < 1e-3)) return x.toExponential(2).replace('e+', 'e'); return x.toFixed(d).replace(/\.?0+$/, m => (m.includes('.') ? '' : m)) || '0'; };
  const COL = { wm: 0x3aa8e0, det: 0x9d8cff, sto: 0x4fc98a, enc: 0x38d1ff, dec: 0xd45fa0, rew: 0xf2c14e, val: 0x3987e5, pi: 0xf0963c, grad: 0xff7a59, env: 0x8e9bb8, ghost: 0x55617c, tgt: 0xf0963c, mark: 0xe0457b, neutral: 0x8a94a8 };
  const hex = c => '#' + c.toString(16).padStart(6, '0');

  const ST = { size: 5, conc: 30, unimix: 1, ylog: 3, ysign: 1, lr: 1, hy: 3, hs: 1, m: 4, free: 1, beta: 0, wp: 1, H: 15, lam: 0.95, rec: 2, scale: 0, out: 0, scen: 0, ver: 2, atype: 0, aH: 15, chaos: 0.15, N: 64, src: 0, res: 0, gen: 2 };
  for (const k of Object.keys(ST)) if (qs.has(k)) ST[k] = parseFloat(qs.get(k));

  /* ---------- scene descriptions ---------- */
  const SCENES = [
    { t: '总览：一个世界模型，一对演员和评论家', s: '点任何部件跳到对应的一幕', dur: 16, cam: [0.08, 1.12, 35, [-0.9, 4.4, 0]],
      b: '<p>三个神经网络一起训练：<b>世界模型</b>从回放数据学会预测，<b>评论家</b>估计每个想象状态的回报分布，<b>演员</b>选动作。演员和评论家只看世界模型产生的隐状态 \\(s_t=\\{h_t,z_t\\}\\)。</p><p>这一篇和 <a href="../../papers/dreamer.html">V1</a> 的骨架相同，新东西全部是让同一套超参数跨领域能用的“稳健技巧”。第 2 到 8 幕一幕讲一个。</p><p class="src">出处：式 (1)(4)，图 3，表 4。</p>' },
    { t: '离散隐变量：32 个分类，每个 d/16 类', s: '换模型大小，调尖锐度，开关 1% 均匀混合', dur: 14, cam: [0.3, 0.95, 37, [2.2, 0.2, 1.5]],
      b: '<p>\\(z_t\\) 是一组分类分布的采样（one-hot），不是 V1 的高斯。反传时用直通梯度（straight-through：前向用采样，反向当作软概率）。每个分类混入 1% 均匀分布，于是概率永远不为 0，KL 有上界。</p><p><b>序列模型</b>是分块 GRU：8 块，每块 d 维，总共 8d 维。权重只在块内全连接，参数量比同维全连接少 8 倍。</p><p class="src">出处：式 (1)，表 3，“Networks”“Distributions”段。32 这个数 v2 正文没写，v1 表 W.1 和代码 <code>rssm.stoch</code> 写了。</p>' },
    { t: 'symlog：把大目标压回能回归的范围', s: '拖目标大小，看三种损失当场训练（玩具）', dur: 12, cam: [0.62, 1.2, 37, [1, 2.8, -2]],
      b: '<p>式 (8)(9)：网络预测 \\(\\mathrm{symlog}(y)\\)，读数时用 \\(\\mathrm{symexp}\\) 变回去。原点附近接近恒等，大数被压缩，正负号保留。用在向量观测的输入和重建目标上。</p><p><b>玩具：</b>两层标量网络 \\(f=w_1w_2\\)，初值 1.2 和 0.8，学习率可调，当场跑梯度下降，比较平方误差、Huber 和 symlog 平方误差。这个玩具说明的是梯度的尺度问题，不是 Dreamer 的训练曲线。</p><p class="src">出处：式 (8)(9)，代码 <code>nets.symlog</code>。</p>' },
    { t: 'two-hot：把回归变成分类', s: '拖目标，看 255 个桶里哪两个被点亮', dur: 12, cam: [0.1, 0.92, 34, [0, 0.5, 3.5]],
      b: '<p>奖励头和评论家输出 255 个桶上的 softmax，桶位置是 \\(\\mathrm{symexp}([-20,\\dots,+20])\\)。目标落在哪两个桶之间，就把权重按距离线性分给这两个桶（式 12），再用交叉熵训练（式 11）。</p><p>交叉熵的梯度只和概率有关，和桶代表的数值大小无关，所以目标是 1 还是 100 万，梯度大小差不多。这是下面读数要看的东西。</p><p class="src">出处：式 (10)(11)(12)，代码 <code>heads.symexp_twohot</code>、<code>outs.TwoHot</code>。255 这个数 v2 没写，v1 第 6 页和代码写了。</p>' },
    { t: 'KL 平衡和 free bits', s: '换 β、free nats、重建权重，当场训练（玩具）', dur: 14, cam: [0.26, 0.8, 36, [1.2, 1.6, 0]],
      b: '<p>式 (3) 把 KL 拆成两半：\\(L_\\mathrm{dyn}\\) 只训练先验去追编码器（β = 1），\\(L_\\mathrm{rep}\\) 只训练编码器靠近先验（β = 0.1）。KL 小于 1 nat 时两项都被 max 截住，梯度为 0。</p><p><b>玩具：</b>m 个等概率输入，8 类分类隐变量，一个共享先验，1% 均匀混合。解码器固定，重建项就是 \\(-\\ln q(z=x\\mid x)\\)。式 (3) 的梯度是手写的。</p><p class="src">出处：式 (2)(3)。代码 <code>rssm.py loss</code> 先把 32 个分类的 KL 求和，再和 1 取 max，所以 1 nat 是整个 \\(z\\) 的额度，不是每个分类的。</p>' },
    { t: '想象和 λ 回报', s: '拖 H 和 λ，切换三种递推写法', dur: 12, cam: [0.22, 1.14, 34, [0, 1.6, 0]],
      b: '<p>从回放里的每个隐状态出发，用先验和演员往前走 H = 15 步。代码里 16 × 64 = 1024 个起点（<code>imag_last: 0</code> 表示全部用上），每条保留 16 个状态，这就是正文“T = 16”和表 4“H = 15”的关系。</p><p>然后从末端往回算式 (5) 的 \\(R^\\lambda_t\\)。这一步在 v1、v2 的写法和代码之间不一样，切换按钮可以比较，见精读页的读者注。</p><p class="src">出处：式 (5)，表 4，代码 <code>agent.py lambda_return</code>。奖励和价值是我写的一列数。</p>' },
    { t: '回报归一化：固定 η 的前提', s: '拖奖励尺度，加离群值，比三种归一化（玩具）', dur: 12, cam: [0.14, 1.08, 39, [1.8, 2.6, 0]],
      b: '<p>\\(S\\) 是回报第 95 和第 5 百分位之差的指数滑动平均（式 7），除数是 \\(\\max(1,S)\\)（式 6）。大回报被压到约 [0, 1]，小于 1 的回报不放大。于是熵系数 η = 3×10⁻⁴ 可以不改。</p><p><b>玩具：</b>上半是 1024 个造出来的回报，看百分位和最大最小值怎样受离群值影响。下半是三臂赌博机的 softmax 策略，按式 (6) 做梯度上升，比较最终的熵。熵接近 ln 3 = 1.099 表示还在探索，接近 0 表示收敛到一个动作。</p><p class="src">出处：式 (6)(7)，代码 <code>Normalize(impl=perc)</code>。</p>' },
    { t: '演员：Reinforce 和穿过动力学反传', s: '切版本和动作类型，当场估梯度（玩具）', dur: 12, cam: [0.2, 1.1, 38, [1, 1.6, 0]],
      b: '<p>v1 写的是：连续动作穿过动力学反传，离散动作用 Reinforce。到 v2、Nature 和代码，<b>两种动作都只用 Reinforce</b>（式 6）。代码里 <code>logpi * sg(adv)</code>，<code>ac_grads: False</code>，想象状态全部 stop_gradient。</p><p><b>玩具：</b>动力学 \\(x\'=x+0.3a+c\\sin 2x\\)，末端奖励 \\(-(x_H-1.5)^2\\)，一个标量参数。当场采样估梯度，64 条一批，重复 200 批，看均值和标准差。离散动作的参考值是枚举全部动作序列算出的精确梯度。</p><p class="src">出处：式 (6)；v1 式 (11) 后一段；DreamerV2 式 (6)。代码 <code>imag_loss</code>，<code>rssm.imagine</code>。</p>' },
    { t: '结果：表和图里读到的数', s: '切基准和消融，切 arXiv 和 Nature', dur: 8, cam: [0.1, 1.2, 40, [0, 3.0, 0]],
      b: '<p>基准视图把每个基准按 Dreamer 归一到同一高度，柱顶标原值。arXiv v2 和 Nature 的控制基准是两次不同的实验，切换可以看到。</p><p>消融视图的数是我从 v2 图 6a、6b 的矢量路径读出的终点值（Dreamer 终点 = 100）。</p><p class="src">出处：v2 表 5 到 13 和图 1、图 6；Nature 扩展数据表 1。</p>' },
    { t: 'V1、V2、V3 和 SuperMimic', s: '点柱子或切按钮，逐行对比', dur: 16, cam: [0.1, 1.2, 37, [0, 2.8, 0]],
      b: '<p>四列是四个系统，一行一项。V1 的细节在<a href="../../papers/dreamer.html">姐妹页</a>。SuperMimic 只在相关工作里和 Dreamer、DreamerV3 一起被提到一句；下面的比较是我逐项对两篇原文得出的。</p><p class="src">出处：V1 arXiv 1912.01603；V2 arXiv 2010.02193；V3 arXiv 2301.04104v2；<a href="../../papers/supermimic.html">SuperMimic</a> arXiv 2610.28480。</p>' },
  ];

  /* ---------- player shell ---------- */
  const btns = $('sceneBtns'), stepsEl = $('steps');
  btns.innerHTML = SCENES.map((s, i) => `<button type="button" data-i="${i}" aria-label="第 ${i + 1} 幕">${i + 1}</button>`).join('');
  stepsEl.innerHTML = SCENES.map((s, i) => `<li><button type="button" data-i="${i}"><span class="k">${String(i + 1).padStart(2, '0')}</span>${s.t}<small>${s.s}</small></button></li>`).join('');
  let lastCap = null, lastLive = null;
  const cap = h => { if (h !== lastCap) { $('cap').innerHTML = h; lastCap = h; } };
  const live = h => { if (h !== lastLive) { const e = $('live'); if (e) e.innerHTML = h; lastLive = h; } };
  function showInfo(i) {
    const s = SCENES[i]; $('infoTag').textContent = `第 ${i + 1} / ${SCENES.length} 幕`; $('infoTitle').textContent = s.t;
    $('infoBody').innerHTML = s.b + '<div id="live" class="live"></div>'; lastLive = null;
    btns.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    stepsEl.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
    $('stepNo').textContent = `${i + 1}/${SCENES.length}`;
    if (window.MathJax?.typesetPromise) window.MathJax.typesetPromise([$('infoBody')]).catch(() => {});
  }

  let S = null, root = null;
  try { if (L && window.THREE) { S = L.makeScene($('stage'), { fov: 38, theta: SCENES[0].cam[0], phi: SCENES[0].cam[1], dist: SCENES[0].cam[2], target: SCENES[0].cam[3], minDist: 8, maxDist: 120 }); root = new THREE.Group(); S.scene.add(root); } }
  catch (e) { S = null; }
  if (!S) $('nogl').hidden = false;

  /* ---------- 3D helpers ---------- */
  let LABS = [], PICKS = [], refDist = 38;
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(t, pos, o = {}) { const sp = L.label(t, { size: LSZ(o.size || 22, (o.scale || 0.0165) * 22 / 26), pos, color: o.color, border: o.border, bg: o.bg, scale: (o.scale || 0.0165) * refDist / 26 }); sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp; }
  /* a label whose text can change frame to frame; the sprite is rebuilt only when the text changes */
  function dyn(G, pos, o = {}) { let cur = null, txt = null; return { set(t, p) { if (t === txt) { if (p && cur) cur.position.set(...p); return; } txt = t; if (cur) { G.remove(cur); LABS = LABS.filter(x => x !== cur); L.dispose(cur); cur = null; } if (t) { cur = lab(t, p || pos, o); G.add(cur); } }, hide() { this.set(null); } }; }
  function block(w, h, d, c, pos, o = {}) { const m = L.box(w, h, d, c, { opacity: o.opacity, edgeOpacity: 0.3 }); m.position.set(...pos); return m; }
  const BOX = () => new THREE.BoxGeometry(1, 1, 1);
  function inst(n, color = 0xffffff, o = {}) { const im = new THREE.InstancedMesh(BOX(), new THREE.MeshStandardMaterial({ color, roughness: 0.6, transparent: o.opacity != null, opacity: o.opacity ?? 1 }), n); im.frustumCulled = false; return im; }
  const _o = new THREE.Object3D(), _c = new THREE.Color();
  function setI(im, i, p, s) { _o.position.set(...p); _o.scale.set(...s); _o.updateMatrix(); im.setMatrixAt(i, _o.matrix); }
  function colI(im, i, c) { _c.setHex(c); im.setColorAt(i, _c); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function wire(G, pts, c, o = {}) { const l = L.line(pts, c, o); G.add(l); return l; }
  function glow(m, k, c) { if (!m.material) return; m.material.emissive = m.material.emissive || new THREE.Color(); m.material.emissive.setHex(c ?? m.material.color.getHex()); m.material.emissiveIntensity = k; }
  function pick(m, go) { m.userData.go = go; PICKS.push(m); return m; }
  function polyline(G, n, c, o) { const g = new THREE.BufferGeometry(), a = new Float32Array(n * 3); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o?.opacity ?? 1 })); l.frustumCulled = false; G.add(l); return { set(i, x, y, z) { a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z; }, commit(k) { g.attributes.position.needsUpdate = true; g.setDrawRange(0, k ?? n); } }; }
  function dot(G, r, c) { const m = L.sphere(r, c); m.material.emissive.setHex(c); m.material.emissiveIntensity = 0.7; G.add(m); return m; }

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    const xs = [-13.2, -9.2, -5.2], ys = { x: 0.3, enc: 2.2, z: 4.3, h: 6.7, dec: 9.0 }, parts = [];
    const lines = (a, b, c) => wire(G, [a, b], c, { opacity: 0.8 });
    xs.forEach((x, i) => {
      const o = pick(block(2.2, 0.5, 2.2, COL.env, [x, ys.x, 0]), 2), e = pick(block(1.8, 0.9, 1.6, COL.enc, [x, ys.enc, 0]), 1), z = pick(block(1.5, 1.0, 1.5, COL.sto, [x, ys.z, 0]), 1), h = pick(block(2.0, 1.2, 1.5, COL.det, [x, ys.h, 0]), 1), d = pick(block(1.8, 0.9, 1.6, COL.dec, [x, ys.dec, 0]), 2);
      G.add(o, e, z, h, d); parts.push({ o, e, z, h, d });
      lines([x, ys.x + 0.3, 0], [x, ys.enc - 0.5, 0], COL.enc); lines([x, ys.enc + 0.5, 0], [x, ys.z - 0.55, 0], COL.enc); lines([x, ys.z + 0.55, 0], [x, ys.h - 0.65, 0], COL.sto); lines([x, ys.h + 0.65, 0], [x, ys.dec - 0.5, 0], COL.dec);
      if (i < 2) { lines([x + 1.0, ys.h, 0], [xs[i + 1] - 1.0, ys.h, 0], COL.det); lines([x + 0.8, ys.z + 0.2, 0], [xs[i + 1] - 1.0, ys.h - 0.4, 0], COL.sto); }
    });
    G.add(lab('输入 x', [-16.1, ys.x, 0]), lab('编码器 q', [-16.4, ys.enc, 0]), lab('离散 z', [-16.1, ys.z, 0]), lab('循环 h', [-16.1, ys.h, 0]), lab('解码 x̂', [-16.1, ys.dec, 0]));
    G.add(lab('世界模型：在回放序列上训练', [-9.2, 11.1, 0], { border: hex(COL.wm) }), lab('演员和评论家：只在想象里训练', [7.8, 11.1, 0], { border: hex(COL.pi) }));
    const klA = L.arrow([-7.9, 5.9, 1.3], [-8.3, 4.6, 1.3], COL.grad); G.add(klA); const klL = lab('KL 平衡', [-7.1, 3.1, 1.6], { border: hex(COL.grad) }); G.add(klL); pick(block(1.8, 1.4, 0.4, COL.grad, [-8.1, 5.2, 1.3], { opacity: 0.01 }), 4); G.add(PICKS[PICKS.length - 1]);
    const ix = [0.6, 4.2, 7.8, 11.4, 15.0], nodes = [], acts = [], vals = [], rews = [];
    ix.forEach((x, i) => {
      const n = pick(block(1.7, 1.5, 1.5, COL.det, [x, 3.8, 0]), 5); G.add(n); nodes.push(n); n.material.transparent = true;
      const a = pick(block(1.2, 0.8, 1.2, COL.pi, [x + 1.8, 6.4, 0]), 7), v = pick(block(1.2, 0.8, 1.2, COL.val, [x, 8.0, 0]), 3), r = pick(block(1.2, 0.8, 1.2, COL.rew, [x, 1.2, 0]), 3);
      if (i < ix.length - 1) { G.add(a); acts.push(a); wire(G, [[x + 0.9, 4.4, 0], [x + 1.6, 6.0, 0]], COL.pi, { opacity: 0.7 }); wire(G, [[x + 2.0, 6.0, 0], [ix[i + 1] - 0.5, 4.6, 0]], COL.pi, { opacity: 0.7 }); wire(G, [[x + 0.9, 3.8, 0], [ix[i + 1] - 0.9, 3.8, 0]], COL.det); }
      G.add(v, r); vals.push(v); rews.push(r); wire(G, [[x, 4.6, 0], [x, 7.6, 0]], COL.val, { opacity: 0.6 }); wire(G, [[x, 3.0, 0], [x, 1.6, 0]], COL.rew, { opacity: 0.6 });
    });
    wire(G, [[-5.2, 6.0, 0], [-0.4, 4.2, 0]], COL.env, { dashed: true });
    G.add(lab('s = {h, z}', [0.6, 5.2, 1.2]), lab('演员 π', [2.4, 7.6, 1.2]), lab('评论家 v（two-hot）', [4.9, 9.4, 1.2]), lab('奖励 r 和继续 c（two-hot 和二值）', [6.8, -0.1, 1.2]));
    const cost = lab('回报归一化', [12.6, 6.9, 1.5], { border: hex(COL.grad) }); G.add(cost); const rn = pick(block(2.4, 0.8, 0.5, COL.grad, [12.6, 6.9, 1.2], { opacity: 0.01 }), 6); G.add(rn);
    const tok = dot(G, 0.32, COL.mark);
    return { update(p) {
      const a = seg(p, 0, 0.42), b = seg(p, 0.42, 0.8), c = seg(p, 0.8, 1);
      parts.forEach((q, i) => { const on = a * 3 > i && a * 3 <= i + 1.0001; [q.e, q.z, q.h, q.d].forEach(m => glow(m, on ? 0.55 : 0)); });
      nodes.forEach((n, i) => { const on = b > 0 && b * 5 > i && b * 5 <= i + 1.0001; glow(n, on ? 0.7 : 0); if (acts[i]) glow(acts[i], on ? 0.7 : 0); glow(vals[i], c > 0 ? 0.6 : 0); });
      acts.forEach(m => { if (c > 0) glow(m, 0.6); });
      klA.visible = a > 0 && b === 0;
      if (a > 0 && b === 0) { const f = a * 3, i = Math.min(2, Math.floor(f)), k = f - i; tok.position.set(xs[i], L.lerp(ys.x, ys.dec, k), 1.0); }
      else if (b > 0 && c === 0) { const f = b * 4, i = Math.min(3, Math.floor(f)), k = f - i; tok.position.set(L.lerp(ix[i], ix[i + 1], k), 3.8, 1.0); }
      else { const k = c; tok.position.set(L.lerp(15, 0.6, k), 8.0, 1.0); }
      cap(b === 0 ? '第一步 · <b>世界模型</b>：编码、预测下一个 z、重建，最小化式 (2)' : c === 0 ? '第二步 · <b>想象</b>：从回放状态出发，先验加演员走 15 步，世界模型不再更新' : '第三步 · <b>评论家和演员</b>：用 λ 回报更新，式 (5) 和式 (6)');
      live('<table class="mini"><tbody><tr><td>γ</td><td class="n">0.997（1/(1−γ) = 333）</td></tr><tr><td>λ</td><td class="n">0.95</td></tr><tr><td>H</td><td class="n">15</td></tr><tr><td>批量 B × T</td><td class="n">16 × 64</td></tr><tr><td>β 预测 / 动力学 / 表征</td><td class="n">1 / 1 / 0.1</td></tr><tr><td>η</td><td class="n">3×10⁻⁴</td></tr><tr><td>学习率</td><td class="n">4×10⁻⁵</td></tr></tbody></table><p class="src">数字出自 v2 表 4。点 3D 里的部件跳到对应一幕。</p>');
    } };
  }

  /* ---------- scene 2: discrete latents ---------- */
  function s2(G) {
    const [name, d] = Toy.SIZES[ST.size], C = d / 16, R = 32, W = 20, cw = W / Math.max(C, 1), rw = 0.42, X0 = -6.4;
    const bars = inst(R * C), r = Toy.rng(17); G.add(bars);
    const logits = Array.from({ length: R }, () => { const peak = Math.floor(r() * C), peak2 = Math.floor(r() * C); return { base: Array.from({ length: C }, () => Toy.gauss(r) * 0.6), peak, peak2 }; }), us = logits.map(() => r());
    const blocks = []; for (let i = 0; i < 8; i++) { const b = block(1.5, 1.0, 1.4, COL.det, [-6.0 + i * 1.75 + 0.2, 0.5, 9.0]); G.add(b); blocks.push(b); }
    G.add(lab(`h：8 块，每块 ${d}，共 ${8 * d} 维`, [0.2, -0.9, 10.2], { border: hex(COL.det) }));
    G.add(lab(`z：32 × ${C}（模型 ${name}）`, [12.6, 1.6, -3.5], { border: hex(COL.sto) }));
    for (let i = 0; i < 8; i++) wire(G, [[-5.8 + i * 1.75, 0.6, 8.3], [-5.8 + i * 1.75, 0.1, 6.9]], COL.det, { opacity: 0.5 });
    const pctl = dyn(G, [X0 + W + 2.0, 6.2, 0], { border: hex(COL.rew) });
    return { ctl: [{ key: 'size', label: '模型', items: Toy.SIZES.map((x, i) => [i, x[0]]) }, { key: 'unimix', label: '1% 混合', items: [[1, '开'], [0, '关']] }, { key: 'conc', label: '尖锐度', type: 'range', min: 0, max: 40, step: 1, fmt: x => String(x) }], update(p) {
      const n = Math.floor(seg(p, 0, 0.85) * R + 1e-9); let ent = 0;
      for (let i = 0; i < R; i++) {
        const l = logits[i]; const s = l.base.map((x, j) => x + (j === l.peak ? ST.conc * 0.25 : 0)); let q = Toy.softmax(s); if (ST.unimix) q = q.map(x => 0.99 * x + 0.01 / C);
        ent += Toy.entropy(q); let acc = 0, pick_ = C - 1; for (let j = 0; j < C; j++) { acc += q[j]; if (us[i] <= acc) { pick_ = j; break; } }
        for (let j = 0; j < C; j++) {
          const on = i < n && j === pick_, h = 0.03 + q[j] * 6; setI(bars, i * C + j, [X0 + (j + 0.5) * cw, h / 2, -6.4 + i * rw], [cw * 0.86, h, rw * 0.8]);
          colI(bars, i * C + j, on ? COL.tgt : i < n ? COL.sto : 0x35705a);
        }
      }
      done(bars);
      const a = Toy.peaked(C, ST.conc, !!ST.unimix, 0), b = Toy.peaked(C, ST.conc, !!ST.unimix, 1), kl = Toy.klCat(a, b), bound = Math.log(C / 0.01), mn = Math.min(...a);
      pctl.set(`一个分类的 KL\n${fmt(kl)} nat`);
      cap(`已采样 <b>${n}</b> / 32。平均熵 <b>${fmt(ent / R)}</b> nat，上限 ln ${C} = ${fmt(Math.log(C))}`);
      const all = Toy.SIZES.map((x, i) => `<tr${i === ST.size ? ' class="on"' : ''}><td>${x[0]}</td><td class="n">${x[1]}</td><td class="n">${8 * x[1]}</td><td class="n">${x[1] / 16}</td><td class="n">${fmt(32 * Math.log2(x[1] / 16), 0)}</td></tr>`).join('');
      live(`<table class="mini"><thead><tr><th>模型</th><th class="n">d</th><th class="n">h = 8d</th><th class="n">类数</th><th class="n">z 的比特</th></tr></thead><tbody>${all}</tbody></table>
<table class="mini"><tbody><tr><td>两个完全错开的分类的 KL（当场算）</td><td class="n">${fmt(kl)}</td></tr><tr><td>混合时的上界 ln(${C}/0.01)</td><td class="n">${fmt(bound)}</td></tr><tr><td>最小概率</td><td class="n">${fmt(mn)}</td></tr><tr><td>全连接 / 分块的循环权重数</td><td class="n">${(8 * d * 8 * d).toLocaleString('en')} / ${(8 * d * d).toLocaleString('en')}</td></tr></tbody></table>
<p class="src">logits 是随机数，不是网络输出。d 和 8d 是 Nature 扩展数据表 4 和代码；v2 表 3 的 12M 写成 1024，见读者注。比特数 = 32·log₂(类数)，是我算的。</p>`);
    } };
  }

  /* ---------- scene 3: symlog ---------- */
  function s3(G) {
    const y = ST.ysign * Math.pow(10, ST.ylog), lr = [0.001, 0.01, 0.05][ST.lr], steps = 600, kinds = [['mse', '平方误差', COL.grad], ['hub', 'Huber', COL.rew], ['sym', 'symlog 平方', COL.sto]], runs = kinds.map(k => Toy.trainScalar(k[0], y, lr, steps));
    const SY = 0.62, Y = v => Toy.symlog(v) * SY, base = 5, X0 = -14.5, W = 9;
    const ax = wire(G, [[X0, base, 0], [X0 + W, base, 0]], COL.env, { opacity: 0.5 }), ay = wire(G, [[X0 + W / 2, 0, 0], [X0 + W / 2, 10, 0]], COL.env, { opacity: 0.5 });
    const c = polyline(G, 81, COL.sto), id = polyline(G, 81, COL.env, { opacity: 0.45 }), XM = 40;
    for (let i = 0; i <= 80; i++) { const v = -XM + 2 * XM * i / 80, X = X0 + W * i / 80; c.set(i, X, base + Toy.symlog(v) * 1.15, 0); id.set(i, X, clamp(base + v * 1.15, -1, 11), 0); }
    c.commit(); id.commit();
    G.add(lab('symlog(x)', [X0 + 1.4, 8.6, 0], { border: hex(COL.sto) }), lab('恒等线', [X0 + 2.0, 1.4, 0]), lab('−40', [X0, 4.1, 0], { size: 18 }), lab('+40', [X0 + W, 4.1, 0], { size: 18 }));
    const yl = -1.2, X = [0.5, 5.5, 10.5], ZR = i => -i * 13 / steps;
    const bars = kinds.map((k, i) => { const b = block(1.4, 1, 1.4, k[2], [X[i], 0, 0]); G.add(b); return b; }), hist = kinds.map((k, i) => polyline(G, steps + 1, k[2]));
    kinds.forEach((k, i) => { runs[i].hist.forEach((h, s) => { const v = Number.isFinite(h.read) ? clamp(Y(h.read), -9.5, 9.5) : 9.5; hist[i].set(s, X[i], 5 - 0 + (v - 0) * 0.5 - 0, ZR(s)); }); G.add(lab(k[1], [X[i], -0.6, 1.6], { border: hex(k[2]) })); });
    const tg = block(14.6, 0.08, 15, COL.neutral, [5.5, 5 + Y(y) * 0.5, -6.5], { opacity: 0.25 }); G.add(tg); G.add(lab(`目标 y = ${fmt(y)}`, [14.6, 5 + Y(y) * 0.5, 0.4], { border: '#8a94a8' }));
    const zero = wire(G, [[-1, 5, 0], [12.2, 5, 0]], COL.env, { opacity: 0.4 }); G.add(lab('0', [-1.6, 5, 0], { size: 18 }));
    const vals = kinds.map((k, i) => dyn(G, [X[i], 10.8, 0.8], { size: 20 })), mk = dot(G, 0.28, COL.mark);
    return { ctl: [{ key: 'ylog', label: 'log₁₀|y|', type: 'range', lazy: 1, min: -2, max: 6, step: 0.5, fmt: x => x.toFixed(1) }, { key: 'ysign', label: '符号', items: [[1, '+'], [-1, '−']] }, { key: 'lr', label: '学习率', items: [[0, '0.001'], [1, '0.01'], [2, '0.05']] }], update(p) {
      const s = Math.floor(seg(p, 0, 0.92) * steps);
      kinds.forEach((k, i) => { const h = runs[i].hist[s], v = Number.isFinite(h.read) ? clamp(Y(h.read), -9.5, 9.5) : null, he = v == null ? 4.75 : Math.max(0.02, Math.abs(v) * 0.5), up = v == null || v >= 0; bars[i].scale.y = he; bars[i].position.y = 5 + (up ? he / 2 : -he / 2); bars[i].material.color.setHex(v == null ? 0xff3b3b : k[2]); hist[i].commit(s + 1); vals[i].set(v == null ? '发散' : fmt(h.read)); });
      const mx = clamp(y, -XM, XM); mk.position.set(X0 + W * (mx + XM) / (2 * XM), base + Toy.symlog(mx) * 1.15, 0.2);
      const hit = r => (r.div >= 0 ? `第 ${r.div} 步发散` : r.hit >= 0 ? `${r.hit} 步` : `${steps} 步内未到`);
      cap(`第 <b>${s}</b> / ${steps} 步。柱高是 symlog 刻度，线往里走是读数历史`);
      live(`<table class="mini"><thead><tr><th>损失</th><th class="n">第 0 步梯度范数</th><th class="n">读数进入 ±10%</th><th class="n">当前读数</th></tr></thead><tbody>${kinds.map((k, i) => `<tr><td>${k[1]}</td><td class="n">${fmt(runs[i].hist[0].g)}</td><td class="n">${hit(runs[i])}</td><td class="n">${Number.isFinite(runs[i].hist[s].read) ? fmt(runs[i].hist[s].read) : '发散'}</td></tr>`).join('')}</tbody></table>
<table class="mini"><tbody><tr><td>symlog(y)</td><td class="n">${fmt(Toy.symlog(y))}</td></tr><tr><td>symexp(symlog(y))</td><td class="n">${fmt(Toy.symexp(Toy.symlog(y)))}</td></tr><tr><td>原点导数 / y 处导数</td><td class="n">1 / ${fmt(1 / (1 + Math.abs(y)))}</td></tr></tbody></table><p class="src">玩具，当场计算。试试 log₁₀|y| = 3：平方误差几步就发散，Huber 走得慢，symlog 42 步到。</p>`);
    } };
  }

  /* ---------- scene 4: two-hot ---------- */
  function s4(G) {
    const y = ST.hs * (ST.hy <= -2 ? 0 : Math.pow(10, ST.hy)), steps = 200, run = Toy.trainHot(y, 5, steps), tg = Toy.target(y), h2 = Toy.twohot(y), N = Toy.N, W = 30, X = i => -W / 2 + W * (i + 0.5) / N, bw = W / N * 0.8;
    const pb = inst(N, COL.val), tb = inst(N, COL.tgt, { opacity: 0.7 }); G.add(pb, tb);
    for (let i = 0; i < N; i++) { const t = tg[i] * 3.6; setI(tb, i, [X(i), t / 2 + 0.001, -1.0], [bw, Math.max(0.002, t), 0.5]); } done(tb);
    wire(G, [[-W / 2, 0, 0.8], [W / 2, 0, 0.8]], COL.env, { opacity: 0.5 });
    [[-20, '−4.9e8'], [-10, '−2.2e4'], [-3, '−19'], [0, '0'], [3, '19'], [10, '2.2e4'], [20, '4.9e8']].forEach(([s, t]) => G.add(lab(t, [W * s / 40, -0.9, 1.0], { size: 18 })));
    G.add(lab('全部 255 桶：横轴按 symlog 均匀，标注是桶的原值', [0, 4.8, -1.6], { size: 20 }));
    /* zoom row around the two target bins */
    const Kz = 15, c0 = clamp(h2.k - 7, 0, N - Kz), zb = inst(Kz, COL.val), zt = inst(Kz, COL.tgt, { opacity: 0.6 }), Zz = 8.5, XZ = j => -10.5 + j * 1.5; G.add(zb, zt);
    for (let j = 0; j < Kz; j++) { const t = tg[c0 + j] * 5; setI(zt, j, [XZ(j), t / 2 + 0.001, Zz - 0.6], [1.1, Math.max(0.002, t), 0.4]); } done(zt);
    G.add(lab('放大：目标附近 15 桶', [-7.5, 2.2, Zz], { size: 20 }));
    [h2.k, h2.k1].forEach((b, i) => { if (i === 1 && h2.k === h2.k1) return; const j = b - c0; G.add(lab(`桶 ${b}\n${fmt(Toy.BINS[b])}\n权重 ${fmt(i ? h2.wk1 : h2.wk, 3)}`, [XZ(j) + (i ? 2.4 : -2.4), -1.9, Zz + 1.0], { size: 19, border: '#f0963c' })); });
    return { ctl: [{ key: 'hy', label: 'log₁₀|y|', type: 'range', lazy: 1, min: -2, max: 8, step: 0.25, fmt: x => (x <= -2 ? 'y = 0' : x.toFixed(2)) }, { key: 'hs', label: '符号', items: [[1, '+'], [-1, '−']] }], update(p) {
      const s = Math.floor(seg(p, 0, 0.9) * steps), e = run[s];
      for (let i = 0; i < N; i++) { const h = Math.max(0.002, e.p[i] * 3.6); setI(pb, i, [X(i), h / 2, 0], [bw, h, 0.6]); } done(pb);
      for (let j = 0; j < Kz; j++) { const h = Math.max(0.01, e.p[c0 + j] * 5); setI(zb, j, [XZ(j), h / 2, Zz], [1.1, h, 0.6]); } done(zb);
      cap(`第 <b>${s}</b> 步。蓝是 softmax，橙是目标。读回 <b>${fmt(e.v)}</b>，目标 ${fmt(y)}`);
      const uni = new Array(N).fill(1 / N), row = v => { const r = Toy.trainHot(v, 5, 0)[0]; return `<tr><td class="n">${fmt(v)}</td><td class="n">${fmt(Math.abs(v))}</td><td class="n">${fmt(Math.abs(Toy.symlog(v)))}</td><td class="n">${fmt(r.gn)}</td></tr>`; };
      live(`<table class="mini"><tbody><tr><td>桶 k, k+1</td><td class="n">${h2.k}, ${h2.k1}</td></tr><tr><td>权重（按原值线性）</td><td class="n">${fmt(h2.wk, 4)}, ${fmt(h2.wk1, 4)}</td></tr><tr><td>两桶加权 = y？</td><td class="n">${fmt(h2.wk * Toy.BINS[h2.k] + h2.wk1 * Toy.BINS[h2.k1])}</td></tr><tr><td>交叉熵（初值 ln 255 = 5.541）</td><td class="n">${fmt(e.ce)}</td></tr><tr><td>对 logits 的梯度范数</td><td class="n">${fmt(e.gn)}</td></tr></tbody></table>
<table class="mini"><thead><tr><th class="n">目标</th><th class="n">平方误差梯度</th><th class="n">symlog 梯度</th><th class="n">two-hot 梯度</th></tr></thead><tbody>${[1, 1e3, 1e6].map(row).join('')}</tbody></table>
<table class="mini"><tbody><tr><td>均匀分布的读数，float32 从左到右加</td><td class="n">${fmt(Toy.readNaive(uni))}</td></tr><tr><td>同上，代码的对称加法</td><td class="n">${fmt(Toy.readSym(uni))}</td></tr></tbody></table>
<p class="src">logits 直接当参数做梯度下降（步长 5），初值 0 同代码 <code>outscale: 0</code>。“梯度”列是初值处的。没有网络，是玩具。最后两行是当场用 Math.fround 算的，说明正文那句“求和顺序要紧”。</p>`);
    } };
  }

  /* ---------- scene 5: KL balance and free bits ---------- */
  const BETAS = [[1, 0.1, 'V3：1 / 0.1'], [0.5, 0.1, 'arXiv v1：0.5 / 0.1'], [0.5, 0.5, '不平衡：0.5 / 0.5']];
  const KLCACHE = {};
  function klHist(o) { const k = JSON.stringify(o); return KLCACHE[k] || (KLCACHE[k] = Toy.klRun(o)); }
  function s5(G) {
    const K = 8, m = ST.m, [bd, br] = BETAS[ST.beta], steps = 600, wp = ST.wp ? 0.05 : 1, cfg = { steps, lr: 0.5, wPred: wp, bdyn: bd, brep: br, free: ST.free, m }, hist = klHist(cfg);
    const qb = inst(m * K), pb = inst(K, COL.det), X = c => -8 + c * 1.9, Z = x => -1.6 - x * 1.9; G.add(qb, pb);
    for (let x = 0; x < m; x++) G.add(lab(`q(z | x=${x})`, [-11.8, 0.6, Z(x)], { size: 18, border: hex(COL.sto) }));
    G.add(lab('先验 p(z)', [-11.6, 0.6, 2.6], { size: 20, border: hex(COL.det) }));
    /* traces */
    const TX = i => 6.8 + 8.2 * i / steps, TY = v => 0.4 + v * 2.2, klL = polyline(G, steps + 1, COL.grad), miL = polyline(G, steps + 1, COL.sto); hist.forEach((h, i) => { klL.set(i, TX(i), TY(h.kl), -2); miL.set(i, TX(i), TY(h.mi), -2); });
    wire(G, [[6.8, 0.4, -2], [15, 0.4, -2]], COL.env, { opacity: 0.6 }); wire(G, [[6.8, 0.4, -2], [6.8, 8.2, -2]], COL.env, { opacity: 0.6 }); if (ST.free > 0) wire(G, [[6.8, TY(ST.free), -2], [15, TY(ST.free), -2]], COL.neutral, { dashed: true });
    [0, 1, 2, 3].forEach(v => G.add(lab(String(v), [6.2, TY(v), -2], { size: 17 })));
    G.add(lab('KL', [15.6, TY(hist[steps].kl) + 0.9, -2], { size: 19, border: hex(COL.grad) }), lab('互信息', [12.6, TY(hist[steps].mi) - 1.0, -2], { size: 19, border: hex(COL.sto) }), lab('nat，横轴 600 步', [11, 9.0, -2], { size: 18 }));
    if (ST.free > 0) G.add(lab(`free ${ST.free} nat`, [8.4, TY(ST.free) + 0.7, -2], { size: 18 }));
    /* forces as arrows: thickness proportional to beta */
    const A1 = block(Math.max(0.1, bd * 6), 0.55, 0.8, COL.grad, [-8.6 + bd * 3, 9.4, 0]), A2 = block(Math.max(0.1, br * 6), 0.55, 0.8, COL.sto, [-8.6 + br * 3, 8.2, 0]); A1.material.transparent = true; A2.material.transparent = true; G.add(A1, A2);
    G.add(lab(`L_dyn：p 追 q，β = ${bd}`, [-1.9 + 1.2, 9.4, 0], { size: 20, border: hex(COL.grad) }), lab(`L_rep：q 靠 p，β = ${br}`, [-1.9 + 1.2, 8.2, 0], { size: 20, border: hex(COL.sto) }));
    const act = dyn(G, [-1, -1.2, 3.4], { size: 22, border: '#8a94a8' }), mk = dot(G, 0.16, COL.mark), mk2 = dot(G, 0.16, COL.mark);
    return { ctl: [{ key: 'beta', label: 'β', items: BETAS.map((b, i) => [i, b[2]]) }, { key: 'free', label: 'free', items: [[0, '0'], [1, '1 nat'], [3, '3 nat']] }, { key: 'm', label: '输入数', items: [[2, '2'], [4, '4'], [8, '8']] }, { key: 'wp', label: '重建权重', items: [[1, '弱 0.05'], [0, '强 1']] }], update(p) {
      const s = Math.floor(seg(p, 0, 0.95) * steps), h = hist[s];
      for (let x = 0; x < m; x++) for (let c = 0; c < K; c++) { const v = Math.max(0.02, h.q[x][c] * 5.5); setI(qb, x * K + c, [X(c), v / 2, Z(x)], [1.25, v, 1.1]); colI(qb, x * K + c, c === x ? COL.sto : 0x2f6f58); } done(qb);
      for (let c = 0; c < K; c++) { const v = Math.max(0.02, h.p[c] * 5.5); setI(pb, c, [X(c), v / 2, 2.6], [1.25, v, 1.1]); } done(pb);
      klL.commit(s + 1); miL.commit(s + 1); mk.position.set(TX(s), TY(h.kl), -2); mk2.position.set(TX(s), TY(h.mi), -2);
      const off = 1 - h.act; A1.material.opacity = 0.2 + 0.8 * h.act; A2.material.opacity = 0.2 + 0.8 * h.act;
      act.set(off >= 0.999 ? '所有输入的 KL 都低于额度：两项梯度为 0' : off > 0 ? `${Math.round(off * m)} / ${m} 个输入的 KL 低于额度` : '');
      cap(`第 <b>${s}</b> 步。KL <b>${fmt(h.kl)}</b>，互信息 <b>${fmt(h.mi)}</b> nat（满分 ln ${m} = ${fmt(Math.log(m))}）`);
      const e = hist[steps];
      const cmp = [[1, 0.1, 1], [1, 0.1, 0], [0.5, 0.5, 1], [0.5, 0.5, 0]].map(c => { const r = klHist({ ...cfg, bdyn: c[0], brep: c[1], free: c[2] }), z = r[steps]; return `<tr><td>${c[0]} / ${c[1]}</td><td class="n">${c[2]}</td><td class="n">${fmt(z.mi)}</td><td class="n">${fmt(z.pred)}</td></tr>`; }).join('');
      live(`<table class="mini"><tbody><tr><td>当前 KL / 互信息</td><td class="n">${fmt(h.kl)} / ${fmt(h.mi)}</td></tr><tr><td>重建损失</td><td class="n">${fmt(h.pred)}</td></tr><tr><td>KL 项有梯度的输入占比</td><td class="n">${fmt(h.act)}</td></tr><tr><td>第 600 步 KL / 互信息</td><td class="n">${fmt(e.kl)} / ${fmt(e.mi)}</td></tr></tbody></table>
<table class="mini"><thead><tr><th>β 动 / 表</th><th class="n">free</th><th class="n">终点互信息</th><th class="n">终点重建</th></tr></thead><tbody>${cmp}</tbody></table>
<p class="src">玩具，学习率 0.5。默认“弱重建”时最明显：没有 free bits，KL 把信息压没；有 free bits，KL 降到约 1 nat 就停。重建权重强时，表征项权重小的那一行信息保得住。</p>`);
    } };
  }

  /* ---------- scene 6: imagination and return ---------- */
  const RECS = [['v1', 'arXiv v1 式(7)'], ['v2', 'v2/Nature 式(5) 字面'], ['code', '代码']];
  function s6(G) {
    const H = Math.round(ST.H), lam = ST.lam, g = 0.997, mode = RECS[ST.rec][0], r = Array.from({ length: H + 1 }, (_, i) => (i % 7 === 4 ? 1 : 0.08)), v = Array.from({ length: H + 1 }, (_, i) => 3.0 + 1.4 * Math.sin(i * 0.5)), R = Toy.lamReturn(mode, r, v, g, lam), dx = 28 / (H + 1), X = i => -14 + (i + 0.5) * dx, bw = Math.min(0.5, dx * 0.24), YS = 1.15;
    const nodes = []; for (let i = 0; i <= H; i++) { const n = block(Math.min(1.1, dx * 0.7), 0.8, 1, i === 0 ? COL.sto : COL.det, [X(i), 0.4, 3.4]); G.add(n); nodes.push(n); if (i < H) wire(G, [[X(i) + 0.3, 0.4, 3.4], [X(i + 1) - 0.3, 0.4, 3.4]], COL.det, { opacity: 0.7 }); }
    const br = inst(H + 1, COL.rew), bv = inst(H + 1, COL.val), bR = inst(H + 1, 0x4fc98a); G.add(br, bv, bR);
    for (let i = 0; i <= H; i++) { setI(br, i, [X(i) - bw * 1.1, r[i] * YS / 2 + 0.01, 0], [bw, Math.max(0.01, r[i] * YS), 1]); setI(bv, i, [X(i) + bw * 0.05, v[i] * YS / 2, 0], [bw, v[i] * YS, 1]); } done(br); done(bv);
    G.add(lab('s₀：回放状态', [X(0) + 1.2, -0.9, 3.8], { size: 19, border: hex(COL.sto) }), lab(`末端 R = v，第 ${H} 步`, [X(H) - 1.4, -0.9, 3.8], { size: 19 }), lab('奖励 r', [-13, 9.8, 0], { size: 20, border: hex(COL.rew) }), lab('价值 v', [-9.8, 9.8, 0], { size: 20, border: hex(COL.val) }), lab('λ 回报 R', [-6.2, 9.8, 0], { size: 20, border: '#4fc98a' }));
    const n = 40, a = 20, truth = Toy.chainTrue(mode, g, n, a), fix = Toy.chainValues(mode, g, 0.95, n, a), ia = mode === 'code' ? a - 1 : a;
    const mk = dot(G, 0.2, COL.mark), val = dyn(G, [0, 8.4, 0], { size: 20 });
    return { ctl: [{ key: 'H', label: 'H', type: 'range', lazy: 1, min: 3, max: 30, step: 1, fmt: x => String(x) }, { key: 'lam', label: 'λ', type: 'range', lazy: 1, min: 0, max: 1, step: 0.05, fmt: x => x.toFixed(2) }, { key: 'rec', label: '递推', items: RECS.map((x, i) => [i, x[1]]) }], update(p) {
      const q = seg(p, 0, 0.88), f = H - q * H, t = Math.ceil(f);
      for (let i = 0; i <= H; i++) { const on = i >= t, h = on ? Math.max(0.01, Math.max(R[i], 0) * YS) : 0.001; setI(bR, i, [X(i) + bw * 1.2, h / 2, 0], [bw, h, 1]); glow(nodes[i], i === t ? 0.8 : 0); } done(bR);
      mk.position.set(X(t), Math.max(R[t], 0) * YS + 0.5, 0); val.set(`R${t} = ${fmt(R[t])}`, [X(t), Math.max(R[t], 0) * YS + 1.3, 0.6]);
      cap(`从末端往回：正在算第 <b>${t}</b> 步，R = <b>${fmt(R[t])}</b>`);
      const row = m => { const tr = Toy.chainTrue(m, g, n, a), fx = Toy.chainValues(m, g, 0.95, n, a), i = m === 'code' ? a - 1 : a; return `<tr${m === mode ? ' class="on"' : ''}><td>${m === 'v1' ? 'v1 式(7)' : m === 'v2' ? 'v2 式(5) 字面' : '代码'}</td><td class="n">${fmt(fx[i])}</td><td class="n">${fmt(tr[i])}</td><td class="n">${fmt(fx[10])}</td><td class="n">${fmt(tr[10])}</td></tr>`; };
      const w = Math.pow(lam, H - 1);
      live(`<table class="mini"><tbody><tr><td>状态数 H+1</td><td class="n">${H + 1}</td></tr><tr><td>γ^H（γ=0.997）</td><td class="n">${fmt(Math.pow(g, H))}</td></tr><tr><td>λ^(H−1)：最长一项的权重</td><td class="n">${fmt(w)}</td></tr><tr><td>平均前看 (1−λ^H)/(1−λ) 步</td><td class="n">${lam === 1 ? H : fmt((1 - Math.pow(lam, H)) / (1 - lam), 2)}</td></tr><tr><td>起点回报 R₀</td><td class="n">${fmt(R[0])}</td></tr></tbody></table>
<table class="mini"><thead><tr><th>评论家不动点</th><th class="n">奖励前</th><th class="n">真值</th><th class="n">第 10 态</th><th class="n">真值</th></tr></thead><tbody>${['v1', 'v2', 'code'].map(row).join('')}</tbody></table>
<p class="src">上表的 r 和 v 是我写的一列数。下表：40 个状态排成一条线，第 20 个状态奖励 1，γ = 0.997，λ = 0.95，H = 15，表格型评论家迭代到收敛。字面读式 (5)，所有奖励之前的价值抬高约 5.2%，1/(1−γ(1−λ)) = 1.052。</p>`);
    } };
  }

  /* ---------- scene 7: return normalization ---------- */
  const CACHE7 = {};
  function s7(G) {
    const scale = Math.pow(10, ST.scale), batch = Toy.returnBatch(scale, !!ST.out), lo = batch[0], hi = batch[1023], p5 = Toy.percentile(batch, 5), p95 = Toy.percentile(batch, 95), range = p95 - p5, NB = 44, cnt = new Array(NB).fill(0), W = 22, X = v => -11 + W * (v - lo) / (hi - lo || 1);
    batch.forEach(v => { cnt[Math.min(NB - 1, Math.floor((v - lo) / (hi - lo || 1) * NB))]++; }); const mx = Math.max(...cnt), bars = inst(NB, COL.val); G.add(bars);
    const z0 = -3;
    for (let i = 0; i < NB; i++) { const h = 0.02 + cnt[i] / mx * 5.2; setI(bars, i, [-11 + W * (i + 0.5) / NB, h / 2, z0], [W / NB * 0.86, h, 1.2]); colI(bars, i, COL.val); } done(bars);
    const mark = (v, c, t, y) => { const m = block(0.09, 6.4, 0.09, c, [X(v), 3.2, z0 + 0.8]); G.add(m, lab(t, [X(v), y, z0 + 0.8], { size: 18, border: hex(c) })); };
    mark(p5, COL.sto, `第 5 百分位 ${fmt(p5)}`, 6.9); mark(p95, COL.sto, `第 95 百分位 ${fmt(p95)}`, 7.9); mark(lo, COL.grad, `最小 ${fmt(lo)}`, 6.9); mark(hi, COL.grad, `最大 ${fmt(hi)}`, 7.9);
    /* EMA gauge */
    const gaugeX = 15, gauge = block(1.2, 1, 1.2, COL.grad, [gaugeX, 0, z0]), lim = block(1.9, 0.08, 1.9, COL.mark, [gaugeX, Toy.symlog(1) * 1.2, z0]); G.add(gauge, lim, lab('下限 1', [gaugeX + 2.2, Toy.symlog(1) * 1.2, z0], { size: 17 }), lab('S 的滑动平均（symlog 刻度）', [gaugeX - 1.6, 10.2, z0], { size: 17, border: hex(COL.grad) }));
    const gv = dyn(G, [gaugeX + 0.6, 3.6, z0], { size: 17 });
    /* bandit bars */
    const key = scale + '|' + ST.scen, sc = ST.scen ? 'noise' : 'dense', scales = [1e-3, 1e-2, 1, 1e2, 1e3], meth = [['ret', 'max(1, S)', COL.sto], ['adv', '优势 std', COL.grad], ['none', '不归一', COL.env]];
    const grid = CACHE7[sc] || (CACHE7[sc] = meth.map(m => scales.map(s => Toy.bandit(m[0], s, sc))));
    const here = meth.map(m => Toy.bandit(m[0], scale, sc)), bb = meth.map((m, i) => { const b = block(2.4, 1, 1.4, m[2], [-6 + i * 6, 0, 5]); G.add(b, lab(m[1], [-6 + i * 6, -1.0, 6.2], { size: 20, border: hex(m[2]) })); return b; }), vl = meth.map((m, i) => dyn(G, [-6 + i * 6, 0, 6.2], { size: 19 }));
    wire(G, [[-8.4, Math.log(3) * 2.4, 5], [8.4, Math.log(3) * 2.4, 5]], COL.neutral, { dashed: true }); G.add(lab('ln 3', [9.4, Math.log(3) * 2.4, 5], { size: 18 }), lab('赌博机：最终策略的熵', [-11.6, 1.5, 5], { size: 19 }));
    return { ctl: [{ key: 'scale', label: '奖励尺度', type: 'range', lazy: 1, min: -3, max: 3, step: 0.5, fmt: x => '10^' + x }, { key: 'out', label: '离群值', items: [[0, '无'], [1, '2% 大回报']] }, { key: 'scen', label: '赌博机', items: [[0, '有奖励差'], [1, '只有噪声']] }], update(p) {
      const t = Math.floor(seg(p, 0, 0.9) * 600), S_ = Toy.emaS(range, t), D = Math.max(1, S_), h = Toy.symlog(S_) * 1.2;
      gauge.scale.y = Math.max(0.02, h); gauge.position.y = Math.max(0.02, h) / 2; gv.set(`${t} 次更新，S = ${fmt(S_)}\n除数 ${fmt(D)}`);
      const g = seg(p, 0.25, 1); here.forEach((r, i) => { const v = Math.max(0.03, r.ent * 2.4 * g); bb[i].scale.y = v; bb[i].position.y = v / 2; vl[i].set(`熵 ${fmt(r.ent)}`, [-6 + i * 6, v + 0.7, 6.2]); });
      cap(`百分位范围 <b>${fmt(range)}</b>，最大减最小 <b>${fmt(hi - lo)}</b>，除数 <b>${fmt(D)}</b>`);
      live(`<table class="mini"><thead><tr><th class="n">尺度</th>${meth.map(m => `<th class="n">${m[1]}</th>`).join('')}</tr></thead><tbody>${scales.map((s, j) => `<tr><td class="n">${fmt(s)}</td>${meth.map((m, i) => `<td class="n">${fmt(grid[i][j].ent)}</td>`).join('')}</tr>`).join('')}</tbody></table>
<table class="mini"><tbody><tr><td>S 收敛需要的更新数（1−0.99^t = 95%）</td><td class="n">${fmt(Math.log(0.05) / Math.log(0.99), 0)}</td></tr></tbody></table>
<p class="src">表里是赌博机最终策略的熵（6000 步，学习率 0.05，η = 3×10⁻⁴）。上半部分的回报和赌博机都是玩具，不是图 6 的复现。S 从 0 开始是代码的 <code>debias: False</code>。这里的 S 用当前批次固定的范围算滑动平均。</p>`);
    } };
  }

  /* ---------- scene 8: actor gradient ---------- */
  const VERS = [['V2'], ['V3 arXiv v1'], ['V3 v2、Nature、代码']];
  const verUse = (v, t) => (v === 2 ? 're' : v === 1 ? (t === 0 ? 'bp' : 're') : (t === 0 ? 'bp' : 're'));
  const GC = {};
  function s8(G) {
    const t = ST.atype, type = t === 0 ? 'cont' : 'disc', H = Math.round(t === 0 ? ST.aH : Math.min(ST.aH, 14)), c = ST.chaos, key = [type, H, c, ST.N].join(), r = GC[key] || (GC[key] = Toy.grads({ type, th: 0.2, sig: 0.5, c, H, N: ST.N, M: 200 })), use = verUse(ST.ver, t);
    const dx = Math.min(1.9, 22 / H), X = i => -13 + i * dx, nodes = [], pis = [], base = 2.2, ytop = 6.0;
    for (let i = 0; i <= H; i++) { const n = block(Math.min(1.2, dx * 0.7), 0.9, 1, i === H ? COL.rew : COL.det, [X(i), base, 0]); G.add(n); nodes.push(n); if (i < H) { wire(G, [[X(i) + 0.3, base, 0], [X(i + 1) - 0.3, base, 0]], COL.det, { opacity: 0.8 }); const a = block(Math.min(1.0, dx * 0.6), 0.7, 1, COL.pi, [X(i) + dx / 2, ytop, 0]); G.add(a); pis.push(a); wire(G, [[X(i) + dx / 2, ytop - 0.4, 0], [X(i) + dx / 2, base + 0.1, 0]], COL.pi, { opacity: 0.6 }); } }
    G.add(lab('动作 aₜ ~ π', [-13, 7.8, 0], { size: 20, border: hex(COL.pi) }), lab('隐状态（玩具里是一维 x）', [-9.6, 0.4, 0], { size: 20, border: hex(COL.det) }), lab('回报', [X(H), 0.4, 0], { size: 20, border: hex(COL.rew) }));
    /* estimator bars */
    const BX = [12.5, 15.5], m = Math.max(Math.abs(r.truth), Math.abs(r.re.m) + r.re.s, Math.abs(r.bp.m) + r.bp.s, 1e-6), SC = 7.5 / m, kinds = [[r.re, COL.pi, 'Reinforce'], [r.bp, COL.grad, t === 0 ? '穿过动力学' : '直通梯度']];
    kinds.forEach((k, i) => { const v = Math.abs(k[0].m) * SC, b = block(1.5, Math.max(0.02, v), 1.2, k[1], [BX[i], Math.max(0.02, v) / 2, 0]); G.add(b); const lo = (Math.abs(k[0].m) - k[0].s) * SC, hi = (Math.abs(k[0].m) + k[0].s) * SC, e = block(0.14, Math.max(0.02, hi - Math.max(lo, 0)), 0.14, COL.neutral, [BX[i], (hi + Math.max(lo, 0)) / 2, 0.8]); G.add(e, lab(`${k[2]}\n${fmt(k[0].m)} ± ${fmt(k[0].s)}`, [BX[i] - 0.4, -1.3 - i * 1.7, 1], { size: 19, border: hex(k[1]) })); });
    const tv = Math.abs(r.truth) * SC; G.add(block(5, 0.09, 1.8, COL.mark, [14, tv, 0])); G.add(lab(`参考 ${fmt(r.truth)}`, [14, tv + 0.6, 1], { size: 18, border: '#e0457b' }));
    const dots = Array.from({ length: Math.min(H, 16) }, () => dot(G, 0.17, COL.grad)), badge = dyn(G, [-4, 10, 0], { size: 24, border: hex(use === 're' ? COL.pi : COL.grad) });
    return { ctl: [{ key: 'ver', label: '论文', items: VERS.map((x, i) => [i, x[0]]) }, { key: 'atype', label: '动作', items: [[0, '连续'], [1, '离散']] }, { key: 'aH', label: 'H', type: 'range', lazy: 1, min: 1, max: 32, step: 1, fmt: x => String(x) }, { key: 'chaos', label: '混沌 c', type: 'range', lazy: 1, min: 0, max: 0.4, step: 0.05, fmt: x => x.toFixed(2) }, { key: 'N', label: '批量', items: [[16, '16'], [64, '64'], [256, '256']] }], update(p) {
      const k = seg(p, 0, 0.9), n = dots.length; badge.set(`${VERS[ST.ver][0]} · ${t === 0 ? '连续' : '离散'}动作：${use === 're' ? 'Reinforce' : t === 0 ? '穿过动力学反传' : '直通梯度'}`);
      dots.forEach((d, i) => {
        const j = Math.floor((i + 0.5) / n * H);
        if (use === 're') { const q = clamp(k * 1.3 - i * 0.02, 0, 1); d.material.color.setHex(COL.pi); d.material.emissive.setHex(COL.pi); d.position.set(L.lerp(X(H), X(j) + dx / 2, q), L.lerp(base, ytop, q) + Math.sin(q * Math.PI) * 2.6, 0.7); }
        else { const end = X(j) + dx / 2, q = clamp(k * 1.3 - i * 0.02, 0, 1), xx = L.lerp(X(H), X(j), Math.min(1, q * 1.4)), up = clamp(q * 1.4 - 1, 0, 1); d.material.color.setHex(COL.grad); d.material.emissive.setHex(COL.grad); d.position.set(xx + (end - X(j)) * up, L.lerp(base, ytop, up), 0.7); }
      });
      cap(use === 're' ? '<b>Reinforce</b>：回报加权 log π，直接落到每个动作，不穿过动力学，状态都 stop_gradient' : t === 0 ? '<b>穿过动力学</b>：梯度沿状态链一步步往回，每步乘雅可比' : '<b>直通梯度</b>：把采样当软概率往回传。低方差，有偏');
      const snr = e => (e.s > 0 ? fmt(Math.abs(e.m) / e.s, 2) : '—');
      live(`<table class="mini"><thead><tr><th>估计</th><th class="n">均值</th><th class="n">标准差</th><th class="n">|均值|/标准差</th></tr></thead><tbody><tr><td>Reinforce（减批均值）</td><td class="n">${fmt(r.re.m)}</td><td class="n">${fmt(r.re.s)}</td><td class="n">${snr(r.re)}</td></tr><tr><td>${t === 0 ? '穿过动力学' : '直通梯度'}</td><td class="n">${fmt(r.bp.m)}</td><td class="n">${fmt(r.bp.s)}</td><td class="n">${snr(r.bp)}</td></tr><tr><td>参考值</td><td class="n">${fmt(r.truth)}</td><td></td><td></td></tr>${r.refRe != null ? `<tr><td>参考（似然比 4 万条）</td><td class="n">${fmt(r.refRe)}</td><td></td><td></td></tr>` : ''}</tbody></table>
<table class="mini"><thead><tr><th>版本</th><th>连续</th><th>离散</th></tr></thead><tbody><tr${ST.ver === 0 ? ' class="on"' : ''}><td>V2</td><td>ρ = 0，穿过动力学</td><td>ρ = 1，Reinforce</td></tr><tr${ST.ver === 1 ? ' class="on"' : ''}><td>V3 arXiv v1</td><td>穿过动力学</td><td>Reinforce</td></tr><tr${ST.ver === 2 ? ' class="on"' : ''}><td>V3 v2、Nature、代码</td><td>Reinforce</td><td>Reinforce</td></tr></tbody></table>
<p class="src">玩具：θ = 0.2，连续动作 σ = 0.5，${t === 1 ? '离散 H 上限 14（枚举），' : '连续参考值是 4 万条路径梯度的平均，混沌大、H 长时两个 4 万条的参考值也对不上，那时没有可信的真值，'}每行是 200 批的统计。两种估计都是当场算的，上面的版本按钮只决定动画走哪条路。</p>`);
    } };
  }

  /* ---------- scene 9: numbers ---------- */
  const RES = {
    arxiv: [['Minecraft', '回报', 9.1, 5.1, ['IMPALA', 7.1], ['Rainbow', 6.3]], ['DMLab', '人类封顶均值 %', 71.4, 35.9, ['IMPALA 10×', 66.3], ['R2D2+ 10×', 65.0]], ['ProcGen', '归一化均值', 66.01, 42.80, ['PPG', 64.89], ['Rainbow', 55]], ['Atari', '玩家中位 %', 830, 180, ['MuZero', 693], ['Rainbow', 223]], ['Atari100k', '玩家均值 %', 125, 11, ['IRIS', 105], ['TWM', 96]], ['BSuite', '任务均值 %', 66, 49, ['Boot DQN', 60], ['DQN', 54]], ['Visual', '实为中位数', 861, 94, ['DrQ-v2', 770], ['CURL', 479]], ['Proprio', '实为中位数', 871, 94, ['DMPO', 801], ['D4PG', 792]]],
    nature: [['Minecraft', '回报', 9.1, 5.1, ['IMPALA', 7.1], ['Rainbow', 6.3]], ['DMLab', '封顶均值', 71, 36, ['IMPALA 10×', 66], ['R2D2+ 10×', 65]], ['ProcGen', '归一化均值', 72, 43, ['PPG', 65], ['Rainbow', 55]], ['Atari', '玩家中位', 830, 180, ['MuZero', 693], ['Rainbow', 223]], ['Atari100K', '玩家均值', 125, 11, ['IRIS', 105], ['TWM', 96]], ['BSuite', '任务均值', 66, 49, ['Boot DQN', 60], ['DQN', 54]], ['DMC Vision', '任务均值', 802, 206, ['DrQ-v2', 705], ['TD-MPC2', 634]], ['DMC Proprio', '任务均值', 843, 205, ['DMPO', 834], ['TD-MPC2', 825]]],
  };
  const ABL = [['Dreamer', 100.0, COL.val], ['无观测 symlog', 93.0, 0x65cbf3], ['无回报归一（用优势归一）', 87.0, 0xa261ff], ['无 two-hot（Huber）', 84.6, 0xf95269], ['无 KL 平衡和 free bits', 75.4, 0xff7d46], ['全部去掉', 54.4, 0x33e0c8]];
  const ABL2 = [['Dreamer', 100.0, COL.val], ['不传奖励和价值梯度', 93.6, 0x65cbf3], ['不传重建梯度', 26.2, 0xa261ff]];
  function s9(G) {
    if (ST.res === 1) {
      const all = ABL.concat(ABL2), X = i => -13 + i * 3.1 + (i >= ABL.length ? 0.8 : 0), h = all.map(() => null), sc = 0.085;
      all.forEach((a, i) => { h[i] = block(2.0, 1, 2.0, a[2], [X(i), 0, 0]); G.add(h[i], lab(a[0].replace('（', '\n（').replace('和', '\n和'), [X(i), -1.6 - (i % 2) * 1.5, 1.5], { size: 18 })); });
      G.add(lab('图 6a · 稳健技巧（14 个任务平均）', [-5.5, 10.4, 0], { border: hex(COL.val) }), lab('图 6b · 学习信号', [10.5, 10.4, 0], { border: hex(COL.val) }));
      const tops = all.map((a, i) => dyn(G, [X(i), 0, 0.8], { size: 20 }));
      return { ctl: [{ key: 'res', label: '视图', items: [[0, '基准'], [1, '消融']] }], update(p) { const k = L.ease(seg(p, 0, 0.5)); all.forEach((a, i) => { const y = Math.max(0.02, a[1] * sc * k); h[i].scale.y = y; h[i].position.y = y / 2; tops[i].set(fmt(a[1], 1), [X(i), y + 0.6, 0.8]); });
        cap('去掉重建梯度终点 <b>26.2</b>，去掉奖励和价值梯度 <b>93.6</b>');
        live(`<table class="mini"><thead><tr><th>条件</th><th class="n">终点</th><th class="n">曲线下面积</th></tr></thead><tbody>${[['Dreamer', 100.0, 68.8], ['无观测 symlog', 93.0, 64.2], ['无回报归一', 87.0, 58.2], ['无 two-hot', 84.6, 57.0], ['无 KL 平衡和 free bits', 75.4, 48.0], ['全部去掉', 54.4, 33.8]].map(r => `<tr><td>${r[0]}</td><td class="n">${fmt(r[1], 1)}</td><td class="n">${fmt(r[2], 1)}</td></tr>`).join('')}</tbody></table><p class="src">我从 v2 第 9 页矢量路径读的（pdftocairo -svg，按刻度标定）。每条曲线 40 个点，“终点”是最后一个点，“面积”是全程平均。</p>`);
      } };
    }
    const src = ST.src ? RES.nature : RES.arxiv, X = i => -13.3 + i * 3.8, W = 0.72, sc = 8.5, ser = [[2, COL.val, 'Dreamer'], [3, 0x4fc98a, 'PPO'], ['e1', 0x8e9bb8, '专家 1'], ['e2', 0x5d6a87, '专家 2']], val = (r, s) => (s === 2 || s === 3 ? r[s] : s === 'e1' ? r[4][1] : r[5][1]), bars = [], tops = [];
    src.forEach((r, i) => { G.add(lab(`${r[0]}\n${r[1]}`, [X(i) + 1.1, -1.4 - (i % 2) * 1.5, 1.5], { size: 18 })); ser.forEach((s, j) => { const b = block(W, 1, 1.2, s[1], [X(i) + j * (W + 0.03), 0, 0]); G.add(b); bars.push([b, val(r, s[0]) / r[2], X(i) + j * (W + 0.03)]); }); tops.push(dyn(G, [X(i) + 0.5, 0, 0.8], { size: 19 })); });
    ser.forEach((s, j) => { if (j < 2) G.add(lab(s[2], [-10 + j * 4.2, 10.6, 0], { size: 20, border: hex(s[1]) })); }); G.add(lab('灰：两个专家方法，名字见右表', [5.4, 10.6, 0], { size: 20 }));
    return { ctl: [{ key: 'src', label: '版本', items: [[0, 'arXiv v2'], [1, 'Nature']] }, { key: 'res', label: '视图', items: [[0, '基准'], [1, '消融']] }], update(p) { const k = L.ease(seg(p, 0, 0.5)); bars.forEach(([b, v]) => { const y = Math.max(0.02, Math.min(v, 1.2) * sc * k); b.scale.y = y; b.position.y = y / 2; }); src.forEach((r, i) => tops[i].set(String(r[2]), [X(i) + 0.4, sc * k + 0.6, 0.8]));
      cap(ST.src ? 'Nature 扩展数据表 1。控制基准是 20 任务 1M 步，对手有 TD-MPC2' : 'arXiv v2 表 5 到 13。表 11、12 的“均值”其实是中位数，见读者注');
      live(`<table class="mini"><thead><tr><th>基准</th><th class="n">Dreamer</th><th class="n">PPO</th><th>专家</th></tr></thead><tbody>${src.map(r => `<tr><td class="nw">${r[0]}</td><td class="n">${r[2]}</td><td class="n">${r[3]}</td><td>${r[4][0]} ${r[4][1]}；${r[5][0]} ${r[5][1]}</td></tr>`).join('')}</tbody></table><p class="src">柱高按该基准的 Dreamer 归一，Dreamer 都是同一高度。各基准指标不同，不能横向比。</p>`);
    } };
  }

  /* ---------- scene 10: generations ---------- */
  const GEN = ['Dreamer V1', 'DreamerV2', 'DreamerV3', 'SuperMimic'], GCOL = [COL.env, COL.det, COL.val, COL.pi];
  const ROWS = [
    ['状态', '30 维高斯 + 200 维 GRU', '32 个分类 × 32 类 + 600 维 GRU', '32 个分类 × d/16 类 + 8d 维分块 GRU', '仿真器状态本身，确定性 MLP'],
    ['模型损失', '重建 + 奖励 + KL，β=1，free nats 3', '加 KL 平衡 α=0.8；β=0.1 或 1', 'β 动 1，β 表 0.1，各自 free 1 nat', '8 步自回归：状态、奖励、观测平方误差和终止 BCE'],
    ['尺度处理', '奖励不变换，离散任务 tanh', 'Atari 奖励 tanh', 'symlog + two-hot，回报归一化', 'SuperMimic 原文没有提到这些'],
    ['评论家', '回归 V_λ，平方误差', '回归 V_λ，有目标网络', 'two-hot 分布，EMA 正则，回放损失 0.3', '回归 GAE 目标，平方误差，无 EMA'],
    ['策略梯度', '穿过动力学', '连续穿过动力学，离散 Reinforce', '全部 Reinforce', '穿过模型 BPTT，确定性策略'],
    ['γ, H', '0.99, 15', '0.995（Atari，表 D.1）, 15', '0.997, 15', '0.99, 32'],
    ['超参数', '连续任务一套', 'Atari 和连续两套', '所有基准一套', '人形跟踪一个任务族'],
  ];
  function s10(G) {
    const X = i => -11.4 + i * 7.6, nr = ROWS.length, H = 1.2, cols = GEN.map((g, i) => { const arr = []; for (let r = 0; r < nr; r++) { const b = pick(block(5.8, H * 0.86, 2.6, GCOL[i], [X(i), 0.8 + r * H, 0]), -1 - i); G.add(b); arr.push(b); } G.add(lab(g, [X(i), 0.8 + nr * H + 0.9, 0], { size: 24, border: hex(GCOL[i]) })); return arr; });
    ROWS.forEach((r, k) => G.add(lab(r[0], [-16.2, 0.8 + k * H, 0], { size: 19 })));
    const cards = GEN.map((_, i) => dyn(G, [X(i), 0, 3], { size: 19 }));
    const wrap = t => { const out = []; let s = t; while (s.length > 11) { out.push(s.slice(0, 11)); s = s.slice(11); } out.push(s); return out.join('\n'); };
    return { ctl: [{ key: 'gen', label: '看', items: GEN.map((g, i) => [i, g.replace('Dreamer ', '').replace('Dreamer', '')]) }], update(p) {
      const r = Math.min(nr - 1, Math.floor(clamp(p, 0, 0.9999) * nr));
      cols.forEach((arr, i) => arr.forEach((b, k) => { const on = k === r; glow(b, on ? 0.75 : i === ST.gen ? 0.25 : 0); b.material.transparent = true; b.material.opacity = on || i === ST.gen ? 1 : 0.34; }));
      cards.forEach((c, i) => c.set(wrap(ROWS[r][i + 1]), [X(i), 0.8 + r * H, 2.2]));
      cap(`<b>${ROWS[r][0]}</b>：DreamerV3 ${ROWS[r][3]}，SuperMimic ${ROWS[r][4]}`);
      live(`<table class="mini"><thead><tr><th></th><th>${GEN[ST.gen]}</th></tr></thead><tbody>${ROWS.map((x, k) => `<tr${k === r ? ' class="on"' : ''}><td class="nw">${x[0]}</td><td>${x[ST.gen + 1]}</td></tr>`).join('')}</tbody></table><p class="src">V1 见姐妹页附录 A。V2 的 600 维、目标网络、γ 取值见 arXiv 2010.02193 第 2 节和表 D.1。SuperMimic 见其第 3 节和附录。</p>`);
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10];

  /* ---------- player ---------- */
  let cur = 0, api = null, playing = !L.reduced(), t0 = 0, pNow = 0, tw = null;
  const HOLD = 1.8;
  const aspectFix = () => { const el = $('stage'), asp = (el.clientWidth || 1) / (el.clientHeight || 1); return Math.min(2.2, Math.max(1, 1.45 / asp)); };
  function fly(th, ph, d, tg) { let dth = th - S.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth)); d *= aspectFix(); tw = { t0: performance.now(), from: [S.theta, S.phi, S.dist, S.target.clone()], to: [S.theta + dth, ph, d, new THREE.Vector3(...tg)] }; }
  function setPlay(on) { playing = on; $('play').textContent = on ? '❚❚ 暂停' : '▶ 播放'; $('play').setAttribute('aria-label', on ? '暂停' : '播放'); }
  function buildG() { L.clear(root); LABS = []; PICKS = []; lastCap = null; const G = new THREE.Group(); root.add(G); api = BUILD[cur](G); }
  function refresh() { buildG(); syncCtl(); api.update(pNow); }
  function syncCtl() {
    $('ctl').querySelectorAll('[data-key]').forEach(e => {
      const k = e.dataset.key;
      if (e.tagName === 'BUTTON') e.setAttribute('aria-pressed', String(+e.dataset.v === ST[k]));
      else { if (document.activeElement !== e) e.value = ST[k]; const c = (api.ctl || []).find(x => x.key === k); const o = e.parentElement.querySelector('output'); if (o && c) o.textContent = c.fmt(+ST[k]); }
    });
  }
  function makeCtl() {
    const box = $('ctl'), c = api.ctl;
    if (!c) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = c.map(x => x.type === 'range'
      ? `<label class="rng"><span>${x.label}</span><input type="range" data-key="${x.key}" data-lazy="${x.lazy ? 1 : 0}" min="${x.min}" max="${x.max}" step="${x.step}" value="${ST[x.key]}" aria-label="${x.label}"><output>${x.fmt(+ST[x.key])}</output></label>`
      : `<div class="row"><span>${x.label}</span>${x.items.map(i => `<button type="button" data-key="${x.key}" data-v="${i[0]}" aria-pressed="${i[0] === ST[x.key]}">${i[1]}</button>`).join('')}</div>`).join('');
  }
  function go(i, p0 = 0) {
    cur = (i + SCENES.length) % SCENES.length; showInfo(cur);
    if (!S) return;
    const sc = SCENES[cur]; fly(...sc.cam); refDist = sc.cam[2] * aspectFix();
    buildG(); makeCtl();
    pNow = p0; t0 = performance.now() - p0 * sc.dur * 1000; api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
  }
  if (S) {
    S.onTick(() => {
      if (playing && api) {
        const sc = SCENES[cur], el = (performance.now() - t0) / 1000;
        if (el > sc.dur + HOLD) { t0 = performance.now(); pNow = 0; } else pNow = Math.min(1, el / sc.dur);
        api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
      }
      if (tw) { const k = L.reduced() ? 1 : Math.min(1, (performance.now() - tw.t0) / 900), e = L.ease(k), a = tw.from, b = tw.to; S.setView(L.lerp(a[0], b[0], e), L.lerp(a[1], b[1], e), L.lerp(a[2], b[2], e), a[3].clone().lerp(b[3], e).toArray()); if (k >= 1) tw = null; }
      const f = clamp(S.dist / refDist, 0.6, 1.6); for (const sp of LABS) sp.scale.copy(sp.userData.s0).multiplyScalar(f);
    });
    S.onClick(() => PICKS, hit => { const g = hit?.object?.userData?.go ?? hit?.object?.parent?.userData?.go; if (g == null) return; if (g < 0) { ST.gen = -1 - g; refresh(); } else go(g); });
    S.onHover(() => PICKS, hit => { $('stage').style.cursor = hit ? 'pointer' : ''; });
  }
  $('ctl').addEventListener('click', e => { const b = e.target.closest('button[data-key]'); if (!b) return; ST[b.dataset.key] = +b.dataset.v; refresh(); });
  $('ctl').addEventListener('input', e => { const r = e.target; if (r.tagName !== 'INPUT') return; const c = (api.ctl || []).find(x => x.key === r.dataset.key), o = r.parentElement.querySelector('output'); if (o && c) o.textContent = c.fmt(+r.value); if (r.dataset.lazy !== '1') { ST[r.dataset.key] = +r.value; refresh(); } });
  $('ctl').addEventListener('change', e => { const r = e.target; if (r.tagName !== 'INPUT' || r.dataset.lazy !== '1') return; ST[r.dataset.key] = +r.value; refresh(); });
  $('ctl').addEventListener('pointerdown', e => e.stopPropagation());
  $('play').onclick = () => { if (!playing) t0 = performance.now() - pNow * SCENES[cur].dur * 1000; setPlay(!playing); };
  $('scrub').oninput = e => { setPlay(false); pNow = e.target.value / 1000; if (api) api.update(pNow); };
  $('prev').onclick = () => go(cur - 1); $('next').onclick = () => go(cur + 1);
  btns.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); });
  stepsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; go(+b.dataset.i); if (!document.body.classList.contains('embed')) $('stage').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' && e.key !== ' ') return; if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1); else if (e.key === ' ') { e.preventDefault(); $('play').click(); } });
  const s0 = clamp((parseInt(qs.get('scene'), 10) || 1) - 1, 0, SCENES.length - 1), pq = qs.get('p');
  setPlay(playing && pq == null);
  go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0));
})();
