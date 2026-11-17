'use strict';
/* LingBot-Touch (arXiv 2611.12806) taken apart into eleven animated scenes. Network sizes come from the official code
   (robbyant/lingbot-touch dec8025) and the two config.json files on Hugging Face. Each scene's update(p) is a pure
   function of the timeline p plus the current toggles. Fingertip layouts and signals are hand-made; bars are numbers
   from the paper. No LingBot-Touch network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { mag: 0xf0963c, piezo: 0xb48cff, vis: 0x5b8cff, hat: 0x38d1ff, pred: 0xd45fa0, tgt: 0x8e9bb8, ema: 0x6b7794, loss: 0xf2c14e, ok: 0x4fc98a, bad: 0xe05d5d, dim: 0x46506a, white: 0xeef2fa, tok: 0x7cb8ff, read: 0x4fc98a, pol: 0x9d8cff, ftp: 0x9aa3b5, gold: 0xf2c14e };
  const AX = [0x38d1ff, 0xf2c14e, 0x4fc98a, 0xd45fa0, 0xf0963c];
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  /* config.json on Hugging Face (2026-11-09) */
  const CFG = { tiny: { d: 192, heads: 3, tau: 2, C: 768 }, small: { d: 384, heads: 6, tau: 4, C: 1536 } };
  const ROPE = { time: 10000, finger: 10000, spatial: 100, scale: Math.PI / 2 };

  const SCENES = [
    { n: 1, part: '总览', title: '一条训练回路，一条下游通路', sub: '图 3 的 3D 版：三类数据、分模态 tokenizer、共享 HaT、预测器和 EMA 目标', dur: 14, cam: [0.1, 1.1, 30, [0, 3.6, 0]],
      html: dl([['数据', '压阻 2,197 h · 磁 1,136 h · 视触觉 1,650 h'], ['tokenizer', '每类一个两层 MLP'], ['HaT', '12 层，宽 192（Tiny）/ 384（Small）'], ['训练', 'Tactile-JEPA：隐空间预测 + EMA 目标'], ['下游', '冻结 EMA 目标端，四层特征拼接']]) +
        '<p>上半是预训练：数据先放进标准指尖空间，按传感原理选 tokenizer，进入共享的 Haptic Transformer；预测器把上下文编码器的输出和掩码 token 一起映射到目标编码器的输出。目标编码器是上下文编码器的 EMA。</p>' +
        '<p>下半是公开的部分：只留 EMA 目标端的 tokenizer 和 HaT，冻结，输出每个触点、每个时间窗一个 token，再由探针或策略用注意力读出。</p>' +
        '<p>点画面里的方块可以跳到对应那一幕。</p>' + src('§3 · 图 3 · 代码 model.py') },
    { n: 2, part: '§3.1 数据', title: '三种传感原理，4,983 小时', sub: '柱子是表 4 的数；切换小时、回合和平均回合时长', dur: 12, cam: [0.25, 1.05, 30, [0, 3.4, 0]],
      html: dl([['压阻手套', 'Juqiao 9 点 · Xspark 16 点 · TACHIN 124/61 点'], ['磁手套', 'PaXini 116/96 点，41.7–83.3 Hz'], ['视触觉', 'Sharpa Wave 指尖 240×240，30 Hz'], ['合计', '4,983 h · 464,431 回合 · ~1.33B 帧']]) +
        '<p>手套占三分之二：不需要机器人，一个人一天能录几个小时日常操作。遥操作的 Sharpa Wave 占三分之一，也是后面部署用的手。三种来源按 24 个任务类别对齐，不按硬件对齐。</p>' +
        '<p>除了任务类别没有任何标签：没有力、接触位置、接触时间。预训练时三种来源等概率采样。</p>' +
        '<p>回合长度差别很大：磁手套平均约 14 秒，压阻约 91 秒，视触觉约 72 秒（我算的）。</p>' +
        guess('指尖上的点只表示每指触点数量，不是真实布局。') + src('§3.1 · 图 2 · 表 4') },
    { n: 3, part: '§3.2 几何', title: '标准指尖空间：坐标而不是下标', sub: '选一种传感器，看它的触点怎样被转到单位半径的参考指尖上', dur: 13, cam: [0.5, 1.12, 22, [0, 3.0, 0]],
      html: dl([['式 (1)', 'p = α p̃ + b，α = 1/r，b = −o/r'], ['代码', 'p = (p_sensor Rᵀ − o)/r + offset'], ['原点', 'o = (uₓ, c_y, u_z)：锚点的 x、z，包围球心的 y'], ['offset', 'Sharpa 对齐 PaXini 参考球的深度平移']]) +
        '<p>同一下标在不同传感器上不是同一个物理位置，所以模型看的是“手指上的位置”。每个“传感器-手指”模板离线定一组旋转、原点、半径、偏移，对所有时间窗复用。</p>' +
        '<p>这组参数来自完整几何和参考模板，不来自当前信号；它也不是把每个点径向投到单位球上。小的织物阵列（3×3、4×4）只覆盖指腹的一块。</p>' +
        guess('三种原始布局的位姿、半径、原点是我设的；变换是 geometry.py 的公式，当场算。') + src('§3.2 式 (1) · geometry.py · DATA_INTERFACE_GUIDE §3') },
    { n: 4, part: '§3.2 地址', title: '5D 地址只走 RoPE', sub: 'head 维度 64 被切成五段；表盘是每对维度的旋转角，按 config 当场算', dur: 15, cam: [0.03, 1.2, 29, [0.6, 4.4, 0]],
      html: dl([['式 (2)', 'aᵢ = (tᵢ, fᵢ, pᵢ) ∈ ℝ⁵'], ['每轴', '2·⌊(64/2)/5⌋ = 12 维，6 对'], ['不旋转', '64 − 60 = 4 维'], ['θ', '时间、手指 10000；空间 100'], ['空间缩放', '坐标 × π/2']]) +
        '<p>地址不加到 token 上，只用来旋转注意力里的 q 和 k。五个轴各占一段：时间窗下标、手指编号、标准坐标 x、y、z。不需要固定 token 数，也不需要传感器专用的位置表，所以布局不同的传感器能共用一个骨干。</p>' +
        '<p>表盘上的指针是 角度 = 位置 × 缩放 × θ^(−2j/12)，j = 0…5。同一个触点在不同时间窗里只有时间那一行变。</p>' +
        '<p>论文没提剩下的 4 维；代码里它们原样通过。</p>' + src('§3.2 式 (2) · rope.py · config.json') },
    { n: 5, part: '§3.2 tokenizer', title: '一个触点、τ 帧、一个 token', sub: '切换 Tiny / Small 和传感器类型；token 数当场算', dur: 12, cam: [0.04, 1.15, 29, [0, 3.4, 0]],
      html: dl([['Tiny', 'τ = 2：6 个数 → 192 维'], ['Small', 'τ = 4：12 个数 → 384 维'], ['token 数', 'N = (T/τ) × 有效触点数'], ['磁', '每点 [x, y, z]'], ['视触觉 / 压阻', '每点 [0, 0, z]']]) +
        '<p>每个有效触点单独成 token，所以 tokenization 保留了传感器原有的空间粒度。tokenizer 是 Linear(3τ → d)、GELU、Linear(d → d)，三类传感器各一个，只有这一层分模态。</p>' +
        '<p><b>和论文的差别：</b>正文写的是两帧、六个数、L = NT/2。Small 的 config 是 τ = 4，参数量 21.76M 也只在 τ = 4 时对得上。</p>' +
        guess('16 帧的读数是合成的。') + src('§3.2 · tokenizer.py · config.json') },
    { n: 6, part: '§3.2 掩码', title: '掩码 warm-up：别把接触全藏掉', sub: '这一幕当场算：k 个接触触点被全部掩码的概率', dur: 16, cam: [0.0, 1.1, 27, [0.2, 3.6, 0]],
      html: dl([['掩码单位', '触点，贯穿整个片段'], ['warm-up', '前 300 步 40% → 80%，之后固定'], ['总步数', '200,000（warm-up 占 0.15%）'], ['近似', 'P(全藏) ≈ 0.8ᵏ'], ['精确', 'Πⱼ (m−j)/(N−j)，j = 0…k−1']]) +
        '<p>触觉稀疏，一次按压常常只碰到几个触点。如果这几个都被掩码，上下文里就没有接触，目标里却有，预测器只能瞎猜。论文观察到这种情况下梯度爆炸，所以开头先用较低的比例。</p>' +
        '<p>掩码在时间上贯穿整段：被掩码的触点在任何时刻都看不到，预测器只能从周围触点和它们的时间变化推断。表 1 里这比只掩一部分时刻好（五项赢四项）。</p>' +
        '<p>表 1 还说 80% 是五项最好，90% 明显变差。</p>' +
        guess('96 个触点、接触位置和每一步的随机掩码是玩具；概率是不放回抽样的精确值，和右上角的模拟次数一起当场算。') + src('§3.2 Masking and mask warm-up · 图 4 · 表 1') },
    { n: 7, part: '§3.2 训练', title: 'Tactile-JEPA：在隐空间里预测', sub: '上路是上下文编码器和预测器，下路是 EMA 目标编码器；切换 EMA 调度', dur: 18, cam: [0.04, 1.12, 32, [-0.6, 3.4, 0]], camE: [0.08, 1.12, 32, [0, 3.0, 0]],
      html: dl([['式 (3)', 'ẑ = P(E(X_C; A_C), Δ_M; A)，z̄ = Ē(X; A)'], ['式 (4)', 'L1(被掩码) + 0.5 · L1(可见)'], ['目标', '四层特征各自 LayerNorm 后拼接'], ['输出层', '第 3、6、9、12 层 → 4 × 192 = 768'], ['EMA', '表 1：0.999 → 1.0 最好']]) +
        '<p>上下文编码器只看可见 token；预测器拿到它的输出，再在被掩码的地址放上可学习的掩码 token，对每个位置都输出预测。目标编码器看完整片段，它的输出加停止梯度当目标。</p>' +
        '<p>两边都不重建信号，所以不会被大量接近零的背景主导。§4.4 里 VAE 和 MAE 都输给它，VAE 数据越多越差。</p>' +
        '<p>EMA 的速度很敏感：表 1 里从 0.998 起步会塌缩，力误差超过 7 N、检索约 1%。</p>' +
        guess('token 个数和掩码位置是示意；层数、输出层、λ 按论文和 config。预测器的层数论文没给。') + src('§3.2 式 (3)(4) · 表 1 · model.py') },
    { n: 8, part: '§3.3 增广', title: '不让模型记住三组点', sub: '切换采样密度和位置扰动；扰动上界 0.5 dᵢ 当场算', dur: 14, cam: [0.3, 1.05, 27, [0, 3.0, 0]],
      html: dl([['磁视图', '24, 32, 48, 64, 76, 96 点/指'], ['视触觉视图', '32, 96, 200 点/指'], ['压阻', '保留原生布局'], ['式 (5)', 'p′ = p + δ，‖δ‖ ≤ 0.5 dᵢ']]) +
        '<p>预训练只有三种布局，RoPE 又把精确坐标交给骨干，模型完全可以记住三组点。于是两种随机化：每个片段随机选一个分辨率（用局部高斯权重重采样）；每个触点加一个不超过到最近邻一半距离的偏移。</p>' +
        '<p>偏移每个片段重抽，同一触点在所有时间窗、上下文和目标两路里共用，所以两路看到同样的几何；信号本身不动。</p>' +
        '<p>表 1：数值加位置增广把检索从 25.6% 提到 37.1%。</p>' +
        guess('重采样的带宽是我设的（目标点间距的一半）；圆圈是按当前布局算出的 0.5 dᵢ。') + src('§3.3 式 (5) · 表 1 · sampling.py') },
    { n: 9, part: '§4 探针', title: '冻结编码器 + 注意力探针', sub: '切换两只手；柱子是图 6 的数', dur: 12, cam: [0.06, 1.15, 32, [-0.5, 3.8, 0]],
      html: dl([['探针', '1 层交叉注意力池化 + 线性头'], ['宽度', '192，3 头，MLP 768'], ['训练', 'AdamW 1e−4，100 轮'], ['FTP-1', '冻结骨干 + 每个传感器单独训适配器']]) +
        '<p>编码器不接收任何任务监督，所以探针的分数衡量的是表征。XHand1 的磁式传感器不在预训练里，也不更新任何参数，直接走磁式 tokenizer。</p>' +
        '<p>FTP-1 是为异构传感器设计的触觉策略，作者冻结它的共享骨干，为每只手、每个探针单独训一个输入适配器。</p>' +
        '<p>柱高按每个任务里两者的较大值归一，数字是原值。</p>' + src('§4.1 · §4.2 · 图 6 · 表 6') },
    { n: 10, part: '§5 策略', title: '接到策略上：每只手 40 个 token', sub: '切换任务范围；柱子是表 2 的平均成功率', dur: 14, cam: [0.04, 1.12, 34, [0, 3.6, 0]],
      html: dl([['窗口', '16 帧，30 Hz'], ['编码器', 'Tiny，冻结，5.46M'], ['token', '8 时间窗 × 5 指 × 96 点 = 3,840 个 × 768 维'], ['读出', '可训练交叉注意力 → 每手 40 个'], ['占比', 'T-Rex 0.16% · π0.5 0.15% · LingBot-VLA 0.13%']]) +
        '<p>触觉 token 作为视觉和本体之外的额外条件输入，策略和训练的其他部分不变。三种配置看同样的示教：每任务 200 条，双手任务 500 条，每任务测 20 次。</p>' +
        '<p>原始信号是对照组：它最多带来约一半的收益，104 对里 22 对变差。在没见过的 XHand1 上原始信号几乎没用。</p>' +
        '<p>注意表 2 用的是 4K 小时的编码器，不是公开的 5K 版。</p>' + src('§5.1 · §5.2 · 表 2 · 图 11') },
    { n: 11, part: '结果', title: '表里的数', sub: '切换四组；柱子都是原文数字', dur: 12, cam: [0, 1.25, 31, [0, 4.6, 0]],
      html: dl([['规模', 'Small 每多一千小时都变好；Tiny 5K 检索下降'], ['目标', '隐空间预测 > MAE、VAE'], ['仿真 RL', '69.0% vs CNN 45.6% vs 无触觉 21.4%'], ['小时 → 策略', '55.9 → 69.8 … 82.2']]) +
        '<p>同一个故事从四个方向讲：探针分数随数据变好，换成重建目标就不行；仿真 RL 里预训练表征好于任务内训练的 CNN；真机策略的成功率也随预训练小时数上升，曲线形状和探针一样。</p>' + src('图 7 · 图 9 · 表 3 · 图 13') }
  ];

  const stepsEl = $('steps'), btns = $('sceneBtns');
  SCENES.forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" data-i="${i}"><span class="k">${s.n} · ${s.part}</span>${s.title}<small>${s.sub}</small></button>`;
    stepsEl.appendChild(li);
    const b = document.createElement('button'); b.type = 'button'; b.dataset.i = i; b.textContent = s.n; b.title = s.title; b.setAttribute('aria-pressed', 'false'); btns.appendChild(b);
  });
  function showInfo(i) {
    const s = SCENES[i];
    $('infoTag').textContent = `第 ${s.n} 幕 · ${s.part}`; $('infoTitle').textContent = s.title; $('infoBody').innerHTML = s.html;
    $('stepNo').textContent = `${s.n} / ${SCENES.length}`;
    stepsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(+b.dataset.i === i)));
    btns.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
  }
  let lastCap = null;
  const cap = h => { if (h !== lastCap) { lastCap = h; $('cap').innerHTML = h; } };

  /* ---------- 3D helpers (same as interactives/phc) ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.3, phi: 1.0, dist: 24, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);
  let LABS = [], refDist = 24, PICKS = [];
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  /* a label whose text changes: rebuilt only when the text differs */
  function dynLab(G, pos, o = {}) {
    const st = { s: null, t: null };
    return t => { if (t === st.t) return; if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; st.s = lab(t, pos, o); G.add(st.s); };
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function colI(im, n, c) { if (typeof c === 'number') c = hex3(c); _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.14) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.5, dashed: o.dashed }); G.add(l); return l; };
  function ribbon(G, n, color, w = 0.06, o = {}) {
    const pos = new Float32Array(n * 6), idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: o.opacity ?? 1 })); m.frustumCulled = false; m.renderOrder = o.order ?? 2; G.add(m);
    m.userData.set = pts => { const k = Math.min(n, pts.length); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)], z = q[2] ?? 0; pos[i * 6] = q[0]; pos[i * 6 + 1] = q[1] - w / 2; pos[i * 6 + 2] = z; pos[i * 6 + 3] = q[0]; pos[i * 6 + 4] = q[1] + w / 2; pos[i * 6 + 5] = z; } g.attributes.position.needsUpdate = true; };
    return m;
  }
  function panel(G, x, y, z, w, h) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x0c1220, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }
  function ring(G, r, color, pos, o = {}) { const pts = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; pts.push([pos[0] + r * Math.cos(a), pos[1] + r * Math.sin(a), pos[2]]); } return wire(G, pts, color, o); }

  /* fingertip taxels: Fibonacci points on the pad-facing hemisphere (z >= 0) of a unit sphere. A layout sketch only. */
  function tip(n) { const out = [], ga = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const z = 1 - (i + 0.5) / n, r = Math.sqrt(1 - z * z), a = i * ga; out.push([r * Math.cos(a), r * Math.sin(a), z]); } return out; }
  const gridPts = (k, s) => { const o = []; for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) o.push([((i + 0.5) / k - 0.5) * s, ((j + 0.5) / k - 0.5) * s, 0.95]); return o; };
  function dots(G, pts, color, at, sc, r) { const im = inst(BALL, pts.length); pts.forEach((q, i) => { setI(im, i, [at[0] + q[0] * sc, at[1] + q[1] * sc, at[2] + q[2] * sc], r); colI(im, i, color); }); done(im); G.add(im); return im; }
  function shell(G, at, sc, color, op = 0.12) { const m = new THREE.Mesh(new THREE.SphereGeometry(sc, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = Math.PI / 2; m.position.set(...at); G.add(m); return m; }

  /* controls: api.ctls = [{label, items, get, set}] */
  function buildCtl() {
    const box = $('ctl'); box.innerHTML = ''; box.hidden = true; if (!api) return;
    (api.ctls || []).forEach((c, gi) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-g="${gi}" data-k="${k}" aria-pressed="${c.get() === k}">${t}</button>`).join('');
      box.appendChild(row); box.hidden = false;
    });
  }
  function syncCtl() { (api?.ctls || []).forEach((c, gi) => { $('ctl').querySelectorAll(`button[data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(c.get() === +b.dataset.k))); }); }

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    const srcs = [['压阻', COL.piezo, 4.2], ['磁', COL.mag, 2.4], ['视触觉', COL.vis, 0.6]];
    const D = srcs.map(([t, c, y]) => { const b = block(2.2, 1.2, 1.2, c, [-13, y + 3.5, 0]); G.add(b, lab(t, [-13, y + 4.4, 0], { size: 20 })); return b; });
    const canon = block(2.0, 3.6, 1.4, COL.white, [-9.4, 5.9, 0], { opacity: 0.6 }); G.add(canon, lab('标准指尖空间', [-9.4, 3.4, 0], { size: 19 }));
    const toks = srcs.map(([t, c, y]) => { const b = block(1.6, 1.0, 1.0, c, [-6.2, y + 3.5, 0]); return b; }); G.add(...toks, lab('tokenizer ×3', [-6.2, 8.4, 0], { size: 19 }));
    const ctx = block(3.2, 1.6, 1.6, COL.hat, [-1.6, 7.0, 0]), pred = block(2.6, 1.6, 1.6, COL.pred, [3.4, 7.0, 0]);
    const tgt = block(3.2, 1.6, 1.6, COL.tgt, [-1.6, 3.6, 0]), loss = block(2.0, 1.2, 1.2, COL.loss, [7.6, 5.3, 0]);
    G.add(ctx, pred, tgt, loss, lab('上下文编码器 HaT', [-1.6, 8.3, 0], { size: 19 }), lab('预测器', [3.4, 8.3, 0], { size: 19 }), lab('目标编码器（EMA）', [-1.6, 2.3, 0], { size: 19 }), lab('损失 (4)', [7.6, 6.4, 0], { size: 19 }));
    const fro = block(3.2, 1.4, 1.4, COL.tgt, [-1.6, -0.8, 0]), rd = block(2.2, 1.2, 1.2, COL.read, [3.4, -0.8, 0]), pol = block(3.0, 1.4, 1.4, COL.pol, [8.0, -0.8, 0]);
    G.add(fro, rd, pol, lab('冻结编码器（公开）', [-1.6, -2.1, 0], { size: 19 }), lab('注意力读出', [3.4, -2.1, 0], { size: 19 }), lab('探针 / 策略', [8.0, -2.1, 0], { size: 19 }));
    const sep = new THREE.Mesh(new THREE.PlaneGeometry(32, 10), new THREE.MeshBasicMaterial({ color: 0x38d1ff, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false })); sep.rotation.x = Math.PI / 2; sep.position.y = 1.1; G.add(sep);
    G.add(lab('预训练', [-9.4, 10.2, 0], { size: 22, color: '#ff9a7a' }), lab('下游（公开的部分）', [-11, 0.2, 0], { size: 22, color: '#38d1ff' }));
    [[D[0], 1], [D[1], 1], [D[2], 1], [canon, 2], [toks[0], 4], [toks[1], 4], [toks[2], 4], [ctx, 6], [pred, 6], [tgt, 6], [loss, 6], [fro, 8], [rd, 9], [pol, 9]].forEach(([m, g]) => { m.userData.go = g; PICKS.push(m); });
    const f = { a: stream(G, 6, COL.white), b: stream(G, 5, COL.hat), c: stream(G, 5, COL.tgt), d: stream(G, 4, COL.pred), e: stream(G, 5, COL.read) };
    wire(G, [[-1.6, 6.1, 0], [-1.6, 4.5, 0]], COL.ema, { dashed: true, opacity: 0.6 }); G.add(lab('EMA', [-0.6, 5.3, 0], { size: 17 }));
    return { update(p) {
      const q = (p * 18) % 1, tr = seg(p, 0.5, 0.6);
      f.a([[-13, 5.9, 0], [-9.4, 5.9, 0], [-6.2, 5.9, 0]], q, 1 - tr);
      f.b([[-6.2, 7.0, 0], [-1.6, 7.0, 0], [3.4, 7.0, 0], [7.6, 5.6, 0]], q, 1 - tr);
      f.c([[-6.2, 4.0, 0], [-1.6, 3.6, 0], [7.6, 5.0, 0]], q, 1 - tr);
      f.d([[-6.2, 5.9, 0], [-1.6, -0.8, 0]], q, tr);
      f.e([[-1.6, -0.8, 0], [3.4, -0.8, 0], [8.0, -0.8, 0]], q, tr);
      [ctx, pred, tgt, loss].forEach(m => glow(m, 0.5 * (1 - tr))); [fro, rd, pol].forEach(m => glow(m, 0.5 * tr));
      cap(p < 0.55 ? '预训练：可见触点 → <b>上下文编码器</b> → <b>预测器</b>；完整片段 → <b>EMA 目标编码器</b>；在隐空间比较' : '下游：只留 <b>EMA 目标端</b>，冻结；每个触点、每个时间窗一个 token，由<b>注意力读出</b>交给探针或策略');
    } };
  }

  /* ---------- scene 2: the corpus; bars are Table 4 ---------- */
  function s2(G) {
    let view = +(OPT[0] ?? 0);
    G.add(L.grid(34, 34));
    const R = [['压阻手套', COL.piezo, 2197, 86906, -9], ['磁手套', COL.mag, 1136, 294871, 0.5], ['视触觉（遥操作）', COL.vis, 1650, 82654, 9]];
    const layouts = [[[9, 'Juqiao 9', 'g3'], [16, 'Xspark 16', 'g4'], [61, 'TACHIN 61', 't']], [[96, 'PaXini 96', 't']], [[200, '240×240 → 200', 't']]];
    R.forEach(([t, c, h, e, x], i) => {
      layouts[i].forEach(([n, nm, kind], j) => { const at = [x + (j - (layouts[i].length - 1) / 2) * 3.0, 8.2, 0], pts = kind === 'g3' ? gridPts(3, 1.2) : kind === 'g4' ? gridPts(4, 1.3) : tip(n); shell(G, at, 1.0, c, 0.1); dots(G, pts, c, at, 1.0, n > 100 ? 0.035 : 0.06); G.add(lab(nm, [at[0], 6.7, 0], { size: 15 })); });
      G.add(lab(t, [x, -0.2, 2.6], { size: 20 }));
    });
    const V = [R.map(r => r[2]), R.map(r => r[3]), R.map(r => r[2] * 3600 / r[3])], MX = [2400, 320000, 100];
    const sub = new THREE.Group(); G.add(sub); let bars = [], last = -1;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = view;
      R.forEach(([t, c, h, e, x], i) => { const b = block(2.6, 1, 2.6, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(view === 2 ? V[2][i].toFixed(1) + ' s' : V[view][i].toLocaleString('en-US'), [x, 0, 0], { size: 18 }); sub.add(l); bars.push({ b, l, h: V[view][i] / MX[view] }); });
    }
    rebuild();
    const ctls = [{ label: '柱子', items: ['小时', '回合', '平均回合时长'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const g = seg(p, 0.05, 0.5);
      bars.forEach(({ b, l, h }) => { const y = Math.max(0.02, h * 5.2 * g); b.scale.y = y; b.position.y = y / 2; l.position.y = y + 0.5; });
      cap(['合计 <b>4,983 小时</b>：压阻 44.1%、磁 22.8%、视触觉 33.1%；手套占三分之二', '合计 <b>464,431</b> 个回合；磁手套回合最多，但每个很短', '平均回合长度（我算的）：压阻约 <b>91 s</b>，磁约 <b>14 s</b>，视触觉约 <b>72 s</b>'][view]);
    } };
  }

  /* ---------- scene 3: canonical fingertip space; transform p = (p R^T - o)/r + offset, computed ---------- */
  function s3(G) {
    let which = +(OPT[0] ?? 0);
    const rot = (a, b) => { const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b); return [[cb, 0, sb], [sa * sb, ca, -sa * cb], [-ca * sb, sa, ca * cb]]; };
    const mul = (R, v) => [R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2], R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2], R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]];
    const tr = R => [[R[0][0], R[1][0], R[2][0]], [R[0][1], R[1][1], R[2][1]], [R[0][2], R[1][2], R[2][2]]];
    /* toy sensors: raw = R0 * (r * unit + c) ; calibration recovers R = R0^T, o = c, r */
    const SEN = [
      { nm: 'PaXini（磁）', c: COL.mag, pts: tip(96), r: 9.0, ctr: [3, -2, 1], R0: rot(0.5, 0.8), off: [0, 0, 0] },
      { nm: 'Sharpa Wave（视触觉）', c: COL.vis, pts: tip(200), r: 11.0, ctr: [-4, 1, 2], R0: rot(-0.6, -0.4), off: [0, 0, -0.08] },
      { nm: 'Juqiao 3×3（压阻）', c: COL.piezo, pts: gridPts(3, 0.9), r: 9.0, ctr: [1, 3, -2], R0: rot(1.0, 0.2), off: [0, 0, 0] }];
    const SC = 0.32, CAN = 3.2, A = [-7, 4.2, 0], B = [5, 3.2, 0];
    shell(G, B, CAN, COL.white, 0.08); ring(G, CAN, COL.white, B, { opacity: 0.35 }); G.add(lab('标准空间：单位半径参考指尖', [B[0], B[1] + CAN + 1.2, 0], { size: 19 }), lab('传感器原始坐标（毫米）', [A[0], 0.2, 0], { size: 19 }));
    const im = inst(BALL, 200); G.add(im); const info = dynLab(G, [0, -0.6, 2], { size: 18 });
    const ctls = [{ label: '传感器', items: SEN.map(s => s.nm.split('（')[0]), get: () => which, set: k => { which = k; } }];
    return { ctls, update(p) {
      const s = SEN[which], k = seg(p, 0.25, 0.75), Rt = tr(s.R0);
      for (let i = 0; i < 200; i++) {
        if (i >= s.pts.length) { setI(im, i, [0, -50, 0], 0.001); continue; }
        const u = s.pts[i], raw = mul(s.R0, [s.r * u[0] + s.ctr[0], s.r * u[1] + s.ctr[1], s.r * u[2] + s.ctr[2]]);
        const rr = mul(Rt, raw), can = [(rr[0] - s.ctr[0]) / s.r + s.off[0], (rr[1] - s.ctr[1]) / s.r + s.off[1], (rr[2] - s.ctr[2]) / s.r + s.off[2]];
        const P0 = [A[0] + raw[0] * SC, A[1] + raw[1] * SC, A[2] + raw[2] * SC], P1 = [B[0] + can[0] * CAN, B[1] + can[1] * CAN, B[2] + can[2] * CAN];
        setI(im, i, [L.lerp(P0[0], P1[0], k), L.lerp(P0[1], P1[1], k), L.lerp(P0[2], P1[2], k)], s.pts.length > 100 ? 0.07 : 0.11); colI(im, i, s.c);
      }
      done(im);
      info(`${s.nm}：r = ${s.r} mm，o = (${s.ctr.join(', ')})，offset = (${s.off.join(', ')})`);
      cap(k < 0.02 ? '原始坐标：每种传感器的朝向、尺度、原点都不同' : k < 0.98 ? 'p = (p<sub>sensor</sub> Rᵀ − o) / r + offset' : '到了标准空间：<b>同一个位置</b>在任何传感器上坐标相同；3×3 阵列只占指腹一小块');
    } };
  }

  /* ---------- scene 4: 5D address and axial RoPE; phases computed from config.json ---------- */
  function s4(G) {
    const HD = 64, AXD = 2 * Math.floor((HD / 2) / 5), NAMES = ['时间 t', '手指 f', 'x', 'y', 'z'], TH = [ROPE.time, ROPE.finger, ROPE.spatial, ROPE.spatial, ROPE.spatial], SCL = [1, 1, ROPE.scale, ROPE.scale, ROPE.scale];
    const strip = inst(BOX, HD); G.add(strip);
    for (let i = 0; i < HD; i++) { const a = Math.floor(i / AXD); setI(strip, i, [-10.5 + i * 0.3, 0.6, 0], [0.25, 0.5, 0.5]); colI(strip, i, a < 5 ? AX[a] : COL.dim); } done(strip);
    G.add(lab('head 维度 64：5 × 12 = 60 维旋转，最后 4 维不动', [-1, -0.6, 1], { size: 18 }));
    const DX = 2.3, X0 = -8.2, Y0 = 8.6, DY = 1.75, needles = [];
    for (let a = 0; a < 5; a++) {
      G.add(lab(NAMES[a], [X0 - 2.1, Y0 - a * DY, 0], { size: 18, color: css(AX[a]) }));
      for (let j = 0; j < AXD / 2; j++) {
        const c = [X0 + j * DX, Y0 - a * DY, 0]; ring(G, 0.7, AX[a], c, { opacity: 0.45 });
        const nd = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: AX[a] })); nd.geometry.translate(0.33, 0, 0); nd.position.set(...c); G.add(nd); needles.push({ nd, a, j });
      }
    }
    for (let j = 0; j < AXD / 2; j++) G.add(lab('j=' + j, [X0 + j * DX, Y0 + 1.15, 0], { size: 15 }));
    const tp = tip(96), at = [10.6, 6.0, 0], TS = 2.3; shell(G, at, TS, COL.vis, 0.08); const dd = dots(G, tp, COL.dim, at, TS, 0.06);
    const hi = new THREE.Mesh(BALL, new THREE.MeshBasicMaterial({ color: COL.gold })); hi.scale.setScalar(0.17); G.add(hi);
    const addr = dynLab(G, [10.6, 2.6, 1], { size: 17 });
    return { update(p) {
      const T = 8, step = Math.floor(p * 40) % 40, t = step % T, f = Math.floor(step / T) % 5, ti = (f * 37 + Math.floor(step / 3) * 11) % 96, q = tp[ti];
      const pos = [t, f, q[0], q[1], q[2]];
      needles.forEach(({ nd, a, j }) => { const inv = Math.pow(TH[a], -2 * j / AXD); nd.rotation.z = pos[a] * SCL[a] * inv; });
      hi.position.set(at[0] + q[0] * TS, at[1] + q[1] * TS, at[2] + q[2] * TS);
      const hl = Math.floor(p * 5 * 4) % 5; for (let i = 0; i < HD; i++) { const a = Math.floor(i / AXD); setI(strip, i, [-10.5 + i * 0.3, 0.6 + (a === hl ? 0.25 : 0), 0], [0.25, a === hl ? 0.9 : 0.5, 0.5]); } done(strip);
      addr(`t = ${t}，f = ${f}，p = (${q.map(v => v.toFixed(2)).join(', ')})`);
      const ph = (pos[2] * ROPE.scale).toFixed(2);
      cap(`当前 token：时间窗 <b>${t}</b>、手指 <b>${f}</b>；x 轴最高频那对转了 x·π/2 = <b>${ph}</b> rad，最低频那对只转 ${(pos[2] * ROPE.scale * Math.pow(100, -10 / 12)).toFixed(3)} rad`);
    } };
  }

  /* ---------- scene 5: tokenizer; counts computed ---------- */
  function s5(G) {
    let size = +(OPT[0] ?? 0), mod = +(OPT[1] ?? 0);
    const T = 16, r = L.rng(5), sig = []; for (let t = 0; t < T; t++) { const z = Math.max(0, Math.sin((t - 3) / 9 * Math.PI)) * 0.85 + 0.03 * r(); sig.push([0.35 * Math.sin(t / 3), -0.25 * Math.cos(t / 4), z]); }
    const cells = inst(BOX, T * 3); G.add(cells); const X0 = -12, DXc = 0.95;
    G.add(lab('一个触点的 16 帧 × 3 通道', [-4.9, 7.2, 0], { size: 19 }), lab('x', [-12.9, 5.6, 0], { size: 16 }), lab('y', [-12.9, 4.6, 0], { size: 16 }), lab('z', [-12.9, 3.6, 0], { size: 16 }));
    const frames = []; for (let i = 0; i < 8; i++) { const b = block(1, 3.2, 1.1, COL.white, [0, 4.6, 0], { opacity: 0.12 }); G.add(b); frames.push(b); }
    const mlp = block(2.2, 2.2, 1.6, COL.tok, [-1.0, 0.6, 0]); G.add(mlp, lab('Linear(3τ→d) · GELU · Linear(d→d)', [-1.0, -1.0, 1], { size: 17 }));
    const toks = []; for (let i = 0; i < 8; i++) { const b = block(0.8, 1, 0.8, COL.hat, [0, 0, 0]); G.add(b); toks.push(b); }
    const info = dynLab(G, [5.5, 8.6, 0], { size: 18 }), cnt = dynLab(G, [5.5, -2.2, 1], { size: 17 });
    const flow = stream(G, 6, COL.tok, 0.12);
    const ctls = [{ label: '模型', items: ['Tiny', 'Small'], get: () => size, set: k => { size = k; } }, { label: '传感器', items: ['磁 [x,y,z]', '视触觉 [0,0,z]'], get: () => mod, set: k => { mod = k; } }];
    return { ctls, update(p) {
      const c = size ? CFG.small : CFG.tiny, tau = c.tau, nt = T / tau, tk = Math.min(nt, Math.floor(seg(p, 0.15, 0.85) * nt + 0.001));
      for (let t = 0; t < T; t++) for (let ch = 0; ch < 3; ch++) { const v = (mod === 1 && ch < 2) ? 0 : sig[t][ch], h = Math.max(0.04, Math.abs(v) * 0.9); setI(cells, t * 3 + ch, [X0 + t * DXc, 5.6 - ch + (v >= 0 ? h / 2 : -h / 2) - 0.0, 0], [0.8, h, 0.6]); colI(cells, t * 3 + ch, v >= 0 ? AX[ch + 2] : COL.bad); }
      done(cells);
      frames.forEach((b, i) => { b.visible = i < nt; if (i < nt) { b.scale.x = tau * DXc - 0.1; b.position.x = X0 + (i * tau + (tau - 1) / 2) * DXc; glow(b, i === tk - 1 ? 0.9 : 0); b.material.opacity = i < tk ? 0.22 : 0.08; } });
      toks.forEach((b, i) => { b.visible = i < nt; if (i < nt) { b.position.set(4.0 + i * 1.15, 0.6, 0); b.scale.y = i < tk ? (size ? 2.4 : 1.6) : 0.05; b.position.y = b.scale.y / 2 - 0.2; } });
      const q = (p * 12) % 1, last = Math.max(0, tk - 1); flow([[X0 + (last * tau + (tau - 1) / 2) * DXc, 3.0, 0], [-1.0, 1.8, 0], [4.0 + last * 1.15, 1.2, 0]], q, tk > 0 ? 1 : 0);
      const tokP = (3 * tau * c.d + c.d) + (c.d * c.d + c.d);
      info(`${size ? 'Small' : 'Tiny'}：τ = ${tau}，每个 token 输入 ${3 * tau} 个数 → ${c.d} 维`);
      cnt(`Sharpa 样例 16 帧×5×200：N = ${16 / tau}×1000 = ${16 / tau * 1000}；XHand 5×96：N = ${16 / tau * 480}`);
      cap(`一个 tokenizer 有 <b>${tokP.toLocaleString('en-US')}</b> 个参数（三个共 ${(3 * tokP).toLocaleString('en-US')}）；输出 C = 4 层 × ${c.d} = <b>${c.C}</b>${mod === 1 ? '；视触觉只有 z，x、y 置零' : ''}`);
    } };
  }

  /* ---------- scene 6: mask warm-up; probabilities computed ---------- */
  function s6(G) {
    let kk = +(OPT[0] ?? 1);
    const KS = [2, 3, 5], N = 96, tp = tip(N), at = [-7.2, 4.6, 0], TS = 3.2, STEPS = 400;
    shell(G, at, TS, COL.vis, 0.08); const im = inst(BALL, N); G.add(im);
    const ratio = s => 0.4 + 0.4 * Math.min(s, 300) / 300;
    const pAll = (m, k) => { let q = 1; for (let j = 0; j < k; j++) q *= Math.max(0, m - j) / (N - j); return q; };
    /* contact = the k taxels nearest to a fixed point on the pad */
    const cpt = [0.25, -0.2, 0.94], order = tp.map((q, i) => [(q[0] - cpt[0]) ** 2 + (q[1] - cpt[1]) ** 2 + (q[2] - cpt[2]) ** 2, i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    function maskAt(s, m) { const r = L.rng(1000 + s), idx = [...Array(N).keys()]; for (let i = 0; i < m; i++) { const j = i + Math.floor(r() * (N - i)); [idx[i], idx[j]] = [idx[j], idx[i]]; } const set = new Uint8Array(N); for (let i = 0; i < m; i++) set[idx[i]] = 1; return set; }
    /* curve panel */
    const XP = 1.5, WP = 11, YP = 1.0, HP = 6.2; panel(G, XP - 0.4, YP - 0.4, -0.3, WP + 0.8, HP + 0.9);
    const px = s => XP + WP * s / STEPS, py = v => YP + HP * v;
    const cw = ribbon(G, STEPS + 1, COL.hat, 0.08), cc = ribbon(G, STEPS + 1, COL.bad, 0.05, { opacity: 0.7 }), rr = ribbon(G, STEPS + 1, COL.white, 0.04, { opacity: 0.55 });
    G.add(lab('P(k 个接触触点全被掩码)', [XP + 3.2, YP + HP + 0.9, 0], { size: 18 }), lab('蓝：warm-up  红：一开始就 80%  白：掩码比例', [XP + WP / 2, YP - 1.6, 0], { size: 16 }), lab('第 300 步', [px(300), YP - 0.5, 0.2], { size: 15 }));
    wire(G, [[px(300), YP, 0], [px(300), YP + HP, 0]], COL.white, { opacity: 0.3, dashed: true });
    const cur = new THREE.Mesh(BALL, new THREE.MeshBasicMaterial({ color: COL.gold })); cur.scale.setScalar(0.16); G.add(cur);
    const tl = dynLab(G, [at[0], 0.0, 1], { size: 18 }), lastK = { k: -1 };
    const ctls = [{ label: '接触触点数 k', items: KS.map(String), get: () => kk, set: k => { kk = k; } }];
    return { ctls, update(p) {
      const k = KS[kk];
      if (lastK.k !== k) { lastK.k = k; const W = [], C = [], Rr = []; for (let s = 0; s <= STEPS; s++) { W.push([px(s), py(pAll(Math.round(ratio(s) * N), k)), 0.05]); C.push([px(s), py(pAll(Math.round(0.8 * N), k)), 0.03]); Rr.push([px(s), py(ratio(s)), 0.02]); } cw.userData.set(W); cc.userData.set(C); rr.userData.set(Rr); }
      const s = Math.round(p * STEPS), m = Math.round(ratio(s) * N), set = maskAt(s, m), con = new Set(order.slice(0, k));
      let vis = 0; con.forEach(i => { if (!set[i]) vis++; });
      tp.forEach((q, i) => { setI(im, i, [at[0] + q[0] * TS, at[1] + q[1] * TS, at[2] + q[2] * TS], con.has(i) ? 0.17 : 0.1); colI(im, i, con.has(i) ? (set[i] ? 0x8a2a2a : COL.gold) : (set[i] ? COL.bad : COL.ok)); }); done(im);
      const pr = pAll(m, k); cur.position.set(px(s), py(pr), 0.1);
      /* empirical check over 400 seeded masks at this ratio */
      let hit = 0; for (let t = 0; t < 400; t++) { const st = maskAt(5000 + t, m); let all = true; con.forEach(i => { if (!st[i]) all = false; }); if (all) hit++; }
      tl(`第 ${s} 步：掩码 ${m}/96 = ${(m / 96 * 100).toFixed(0)}%；这一次接触可见 ${vis}/${k}`);
      cap(`k = ${k}：精确概率 <b>${(pr * 100).toFixed(1)}%</b>（近似 ${(ratio(s) ** k * 100).toFixed(1)}%，400 次模拟 ${(hit / 4).toFixed(1)}%）；一开始就用 80% 是 ${(pAll(77, k) * 100).toFixed(1)}%`);
    } };
  }

  /* ---------- scene 7: Tactile-JEPA training loop ---------- */
  function s7(G) {
    let ema = +(OPT[0] ?? 0);
    const NT = 12, r = L.rng(3), masked = Array.from({ length: NT }, (_, i) => [1, 3, 4, 6, 8, 9, 10, 11].includes(i));
    const tin = []; for (let i = 0; i < NT; i++) { const b = block(0.55, 0.55, 0.55, COL.tok, [-13 + (i % 4) * 0.7, 6.0 - Math.floor(i / 4) * 0.7, 0]); G.add(b); tin.push(b); }
    G.add(lab('触点 token（红 = 掩码）', [-11.4, 7.6, 0], { size: 17 }));
    const ctxL = [], tgtL = [];
    for (let l = 0; l < 12; l++) { const a = block(0.32, 1.6, 1.4, COL.hat, [-8.4 + l * 0.42, 6.8, 0], { opacity: 0.85 }); const b = block(0.32, 1.6, 1.4, COL.tgt, [-8.4 + l * 0.42, 1.6, 0], { opacity: 0.85 }); G.add(a, b); ctxL.push(a); tgtL.push(b); }
    G.add(lab('上下文编码器（12 层）', [-6.1, 8.3, 0], { size: 18 }), lab('目标编码器（EMA，停止梯度）', [-6.1, 0.1, 0], { size: 18 }));
    const taps = [2, 5, 8, 11].map((l, i) => { const b = block(0.6, 0.6, 0.6, COL.loss, [-0.4 + i * 0.75, 1.6, 0]); G.add(b); wire(G, [[-8.4 + l * 0.42, 2.45, 0], [-0.4 + i * 0.75, 2.0, 0]], COL.loss, { opacity: 0.4 }); return b; });
    G.add(lab('第 3、6、9、12 层 · 各自 LayerNorm · 拼接 = 4 × 192 = 768', [1.0, 3.0, 0], { size: 16 }));
    const mtok = []; for (let i = 0; i < NT; i++) { const b = block(0.5, 0.5, 0.5, masked[i] ? COL.bad : COL.hat, [-0.6 + (i % 4) * 0.65, 7.3 - Math.floor(i / 4) * 0.65, 0]); G.add(b); mtok.push(b); }
    G.add(lab('可见表征 + 掩码 token Δ', [0.4, 8.6, 0], { size: 17 }));
    const pred = block(2.4, 1.8, 1.4, COL.pred, [4.6, 6.6, 0]); G.add(pred, lab('预测器 P', [4.6, 7.9, 0], { size: 18 }));
    const loss = block(2.6, 1.4, 1.4, COL.loss, [9.8, 4.2, 0]); G.add(loss, lab('L1(掩码) + 0.5·L1(可见)', [9.8, 5.5, 0], { size: 17 }));
    wire(G, [[-6.1, 5.9, 0], [-6.1, 2.5, 0]], COL.ema, { dashed: true, opacity: 0.6 });
    const f = { a: stream(G, 5, COL.hat), b: stream(G, 5, COL.tgt), c: stream(G, 4, COL.pred), d: stream(G, 4, COL.loss) };
    /* EMA momentum panel */
    const XP = 5.2, YP = -2.6, WP = 8, HP = 2.2; panel(G, XP - 0.3, YP - 0.3, -0.3, WP + 0.6, HP + 0.7); const er = ribbon(G, 101, COL.hat, 0.1, { order: 3 }), ecur = new THREE.Mesh(BALL, new THREE.MeshBasicMaterial({ color: COL.gold })); ecur.scale.setScalar(0.13); G.add(ecur);
    const eL = dynLab(G, [XP + WP / 2, YP + HP + 0.6, 0], { size: 16 }), mu = (k, x) => k === 0 ? 0.999 + 0.001 * x : k === 1 ? 0.99925 : 0.998 + 0.002 * x;
    const lastE = { k: -1 };
    const ctls = [{ label: 'EMA', items: ['0.999→1.0', '0.99925 恒定', '0.998→1.0'], get: () => ema, set: k => { ema = k; } }];
    const T1 = [[34.625, 0.271], [14.375, 2.324], [1.375, 3.401]];
    return { ctls, update(p) {
      const q = (p * 16) % 1, ph = p < 0.5 ? 0 : 1;
      tin.forEach((b, i) => { b.material.color.setHex(masked[i] && p > 0.08 ? COL.bad : COL.tok); b.userData.c = hex3(masked[i] && p > 0.08 ? COL.bad : COL.tok); });
      const lv = Math.floor(seg(p, 0.1, 0.45) * 12); ctxL.forEach((b, l) => glow(b, l === lv ? 0.9 : 0.05)); tgtL.forEach((b, l) => glow(b, l === lv ? 0.9 : 0.05));
      taps.forEach(b => glow(b, seg(p, 0.4, 0.5) * 0.6)); mtok.forEach(b => { b.visible = p > 0.45; }); glow(pred, seg(p, 0.5, 0.6) * 0.6); glow(loss, seg(p, 0.65, 0.75) * 0.8);
      f.a([[-11.9, 6.5, 0], [-8.4, 6.8, 0], [-3.8, 6.8, 0], [0.4, 6.7, 0]], q, p < 0.5 ? 1 : 0);
      f.b([[-11.9, 5.0, 0], [-8.4, 1.6, 0], [-3.8, 1.6, 0], [0.7, 1.6, 0]], q, p < 0.5 ? 1 : 0);
      f.c([[0.4, 6.7, 0], [4.6, 6.6, 0], [9.8, 4.6, 0]], q, ph);
      f.d([[0.7, 1.6, 0], [6, 2.4, 0], [9.8, 3.8, 0]], q, ph);
      if (lastE.k !== ema) { lastE.k = ema; const P = []; for (let i = 0; i <= 100; i++) P.push([XP + WP * i / 100, YP + HP * (mu(ema, i / 100) - 0.998) / 0.002, 0.02]); er.userData.set(P); }
      ecur.position.set(XP + WP * p, YP + HP * (mu(ema, p) - 0.998) / 0.002, 0.08);
      eL(`EMA 动量 ${mu(ema, p).toFixed(5)}（纵轴 0.998 到 1.0）`);
      cap(`${p < 0.5 ? '上路只看<b>可见</b>触点；下路看<b>完整片段</b>，取四层特征当目标' : '预测器在<b>每个位置</b>输出 ẑ，和 sg(z̄) 比 L1；掩码位置权重 1，可见位置 λ = 0.5'} · 表 1 这种 EMA：检索 ${T1[ema][0]}%，中心 ${T1[ema][1]} mm`);
    } };
  }

  /* ---------- scene 8: layout augmentation; nearest-neighbour bounds computed ---------- */
  function s8(G) {
    let dens = +(OPT[0] ?? 0), jit = +(OPT[1] ?? 1);
    const DENS = [96, 64, 48, 32, 24], at = [0, 3.0, 0], TS = 5.0, src = tip(96);
    shell(G, at, TS, COL.mag, 0.07);
    const srcIm = dots(G, src, COL.dim, at, TS, 0.05);
    const im = inst(BALL, 96), rings = inst(new THREE.TorusGeometry(1, 0.06, 4, 24), 96); G.add(im, rings);
    const nn = pts => pts.map((a, i) => { let d = 1e9; pts.forEach((b, j) => { if (i !== j) d = Math.min(d, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); }); return d; });
    const cache = {}; const get = n => cache[n] || (cache[n] = { pts: tip(n), d: nn(tip(n)) });
    const ctls = [{ label: '每指触点', items: DENS.map(String), get: () => dens, set: k => { dens = k; } }, { label: '位置扰动', items: ['关', '开'], get: () => jit, set: k => { jit = k; } }];
    return { ctls, update(p) {
      const n = DENS[dens], g = get(n), clip = Math.floor(p * 6), r = L.rng(77 + clip);
      let mx = 0;
      for (let i = 0; i < 96; i++) {
        if (i >= n) { setI(im, i, [0, -50, 0], 0.001); setI(rings, i, [0, -50, 0], 0.001); continue; }
        const q = g.pts[i], bound = 0.5 * g.d[i];
        /* random offset inside the ball of radius bound, then pulled back onto the tip surface direction */
        let dx = 0, dy = 0, dz = 0; if (jit) { const u = r() * 2 - 1, v = r() * 2 - 1, w = r() * 2 - 1, nr = Math.hypot(u, v, w) || 1, s = bound * Math.cbrt(r()); dx = u / nr * s; dy = v / nr * s; dz = w / nr * s; mx = Math.max(mx, s / g.d[i]); }
        setI(im, i, [at[0] + (q[0] + dx) * TS, at[1] + (q[1] + dy) * TS, at[2] + (q[2] + dz) * TS], 0.1); colI(im, i, COL.mag);
        _P.set(at[0] + q[0] * TS, at[1] + q[1] * TS, at[2] + q[2] * TS); const nq = new THREE.Vector3(q[0], q[1], q[2]).normalize(); const qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nq); _Sv.setScalar(bound * TS); rings.setMatrixAt(i, _M.compose(_P, qq, _Sv)); colI(rings, i, COL.white);
      }
      done(im); done(rings); rings.visible = !!jit;
      const md = g.d.reduce((a, b) => a + b, 0) / n;
      cap(`第 ${clip + 1} 个片段 · ${n} 点/指：平均最近邻距离 dᵢ = <b>${md.toFixed(3)}</b>（单位半径）${jit ? `；圆圈半径 0.5 dᵢ，本片段最大偏移 = ${mx.toFixed(2)} dᵢ` : '；不扰动'} · 灰点是原生 96 点`);
    } };
  }

  /* ---------- scene 9: frozen encoder + probe; bars are Fig. 6 ---------- */
  function s9(G) {
    let hand = +(OPT[0] ?? 0);
    const enc = block(3.4, 2.2, 1.8, COL.tgt, [-13, 6.4, 0]), q = block(1.0, 1.0, 1.0, COL.gold, [-8.6, 8.2, 0]), xa = block(2.2, 1.6, 1.4, COL.read, [-8.6, 6.4, 0]), head = block(1.6, 1.2, 1.2, COL.white, [-5.2, 6.4, 0]);
    G.add(enc, q, xa, head, lab('冻结 EMA 编码器', [-13, 8.0, 0], { size: 18 }), lab('query', [-7.4, 8.9, 0], { size: 16 }), lab('交叉注意力池化', [-8.6, 4.9, 0], { size: 17 }), lab('线性头', [-5.2, 4.9, 0], { size: 17 }));
    const fl = stream(G, 6, COL.read, 0.12);
    const TASK = ['力 N↓', '中心 mm↓', '覆盖 pp↓', '未来力 N↓', 'R@5 %↑'];
    const V = [[[2.31, 0.81], [2.19, 0.12], [2.90, 0.66], [1.67, 1.04], [16.50, 72.63]], [[3.72, 1.32], [5.89, 0.16], [4.39, 0.43], [2.00, 1.45], [6.00, 47.13]]];
    const sub = new THREE.Group(); G.add(sub); let bars = [], last = -1;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = hand;
      TASK.forEach((t, i) => { const x0 = -1.5 + i * 3.0; sub.add(lab(t, [x0, -0.6, 1.6], { size: 16 }));
        V[hand][i].forEach((v, j) => { const x = x0 + (j - 0.5) * 1.1, c = j ? (hand ? COL.mag : COL.vis) : COL.ftp, b = block(0.9, 1, 0.9, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(v.toFixed(2), [x, 0, 0], { size: 15 }); sub.add(l); bars.push({ b, l, h: v / Math.max(...V[hand][i]) }); }); });
      sub.add(lab(hand ? 'XHand1（没见过，不更新参数）' : 'Sharpa Wave（见过）', [4.5, 9.6, 0], { size: 20, border: 'rgba(56,209,255,.7)' }), lab('灰 FTP-1（带专用适配器）  彩 LingBot-Touch Small 5K', [4.5, -2.2, 1.6], { size: 15 }));
    }
    rebuild();
    const ctls = [{ label: '手', items: ['Sharpa Wave', 'XHand1'], get: () => hand, set: k => { hand = k; } }];
    return { ctls, update(p) {
      if (last !== hand) rebuild();
      const g = seg(p, 0.1, 0.55); bars.forEach(({ b, l, h }) => { const y = Math.max(0.02, h * 6 * g); b.scale.y = y; b.position.y = y / 2; l.position.y = y + 0.45; });
      fl([[-13, 6.4, 0], [-8.6, 6.4, 0], [-5.2, 6.4, 0], [-1.5, 4.0, 0]], (p * 12) % 1, 1);
      cap(hand ? '没见过的磁式手：中心误差 <b>0.16 mm</b>，比 FTP-1 在<b>见过</b>的手上（2.19 mm）还低 13.7 倍' : '见过的手：检索 top-5 从 <b>16.5%</b> 到 <b>72.6%</b>，差距最大');
    } };
  }

  /* ---------- scene 10: plugging into a policy; bars are Table 2 means ---------- */
  function s10(G) {
    let scope = +(OPT[0] ?? 0);
    const nodes = [['16 帧触觉', -13, COL.mag], ['冻结 Tiny', -9.2, COL.tgt], ['3,840 token × 768', -5.0, COL.hat], ['读出 → 40 token', -0.8, COL.read], ['线性投影', 2.8, COL.white], ['策略', 6.6, COL.pol]];
    const B = nodes.map(([t, x, c], i) => { const b = block(2.6, 1.3, 1.4, c, [x, 8.0, 0]); G.add(b, lab(t, [x, i % 2 ? 6.6 : 9.3, 0], { size: 17 })); return b; });
    G.add(lab('视觉 + 本体', [10.4, 9.3, 0], { size: 17 })); G.add(block(2.0, 1.1, 1.2, COL.dim, [10.4, 8.0, 0]));
    const fl = stream(G, 10, COL.hat, 0.12);
    const P = ['Diffusion Policy', 'π0.5', 'LingBot-VLA', 'T-Rex'];
    const M = [[[21.63, 28.66, 35.55], [48.06, 54.69, 69.87], [48.28, 56.50, 73.09], [45.42, 56.59, 68.61]], [[22.31, 30.06, 35.51], [47.56, 56.70, 68.58], [45.60, 56.29, 72.51], [44.06, 57.99, 70.05]], [[19.38, 24.00, 35.67], [49.71, 48.00, 74.17], [57.21, 57.21, 75.04], [49.96, 51.92, 63.79]]];
    const SC = [0xc8cde0, 0x9fb4ff, 0x5b5cf0];
    const sub = new THREE.Group(); G.add(sub); let bars = [], last = -1;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = scope;
      P.forEach((nm, i) => { const x0 = -10 + i * 6.6; sub.add(lab(nm, [x0, -0.6, 1.6], { size: 17 }));
        M[scope][i].forEach((v, j) => { const x = x0 + (j - 1) * 1.7, b = block(1.3, 1, 1.3, SC[j], [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(v.toFixed(1), [x, 0, 0], { size: 14 }); sub.add(l); bars.push({ b, l, v, j }); }); });
      sub.add(lab('三根柱：原策略 · +原始触觉 · +LingBot-Touch', [0, -2.1, 1.6], { size: 15 }));
    }
    rebuild();
    const ctls = [{ label: '任务', items: ['26 个（我算的加权）', 'Sharpa 20', 'XHand1 6'], get: () => scope, set: k => { scope = k; } }];
    return { ctls, update(p) {
      if (last !== scope) rebuild();
      const g = seg(p, 0.15, 0.6); bars.forEach(({ b, l, v, j }) => { const h = Math.max(0.02, v / 100 * 6 * g); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.4 + (j === 1 ? 0.55 : 0); });
      fl([[-13, 8, 0], [-9.2, 8, 0], [-5, 8, 0], [-0.8, 8, 0], [2.8, 8, 0], [6.6, 8, 0]], (p * 10) % 1, 1); B.forEach((b, i) => glow(b, Math.abs(i - ((p * 10) % 1) * 6) < 0.7 ? 0.5 : 0.05));
      const gain = M[scope].map(r => (r[2] - r[0]).toFixed(1)).join('、'), raw = M[scope].map(r => (r[1] - r[0] >= 0 ? '+' : '') + (r[1] - r[0]).toFixed(1)).join('、');
      cap(`5 × 96 × (16/2) = <b>3,840</b> 个 token → 每手 <b>40</b> 个 · 收益 ${gain} 点；原始信号 ${raw} 点`);
    } };
  }

  /* ---------- scene 11: results; every bar is a number from the paper ---------- */
  function s11(G) {
    let view = +(OPT[0] ?? 0); G.add(L.grid(34, 34)); const sub = new THREE.Group(); G.add(sub);
    const T = [
      { t: '图 7 · Sharpa 检索 R@5（%）', mx: 100, g: ['1K', '2K', '3K', '4K', '5K'], s: [['Tiny', 0x9fb4ff, [41.38, 54.25, 55.5, 63.75, 52.25]], ['Small', 0x5b5cf0, [42.50, 54.88, 64.88, 69.75, 72.63]]] },
      { t: '图 9 · 4K 小时，检索 R@5（%）/ 中心误差（mm ×10）', mx: 100, g: ['检索', '中心 ×10'], s: [['MAE', 0x2ea58a, [8.69, 25.7]], ['VAE', 0xf0a0c0, [3.06, 40.8]], ['Ours', 0x5b5cf0, [49.32, 3.2]]] },
      { t: '表 3 · 仿真 RL 12 个任务平均成功率（%）', mx: 100, g: ['无触觉', '二值', '原始', 'CNN', 'Ours'], s: [['', 0x5b5cf0, [21.4, 30.3, 38.5, 45.6, 69.0]]] },
      { t: '图 13a · LingBot-VLA 五个任务平均（%）', mx: 100, g: ['无', '1K', '2K', '3K', '4K', '5K'], s: [['', 0x5b5cf0, [55.9, 69.8, 74.3, 77.4, 81.4, 82.2]]] }];
    let bars = [], last = -1;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = view; const v = T[view], Ng = v.g.length, Ns = v.s.length, gw = Math.min(5.4, 26 / Ng), w = Math.min(1.4, (gw - 0.6) / Ns);
      v.g.forEach((nm, i) => { const x0 = (i - (Ng - 1) / 2) * gw; sub.add(lab(nm, [x0, -0.2, 2.6], { size: 19 }));
        v.s.forEach(([sn, c, vals], j) => { const x = x0 + (j - (Ns - 1) / 2) * (w + 0.08), b = block(w, 1, w, c, [x, 0.5, 0], { edges: false }); sub.add(b); const raw = view === 1 && i === 1 ? (vals[i] / 10).toFixed(2) : vals[i].toFixed(view <= 1 ? 2 : 1); const l = lab(raw, [x, 0, 0], { size: 15 }); sub.add(l); bars.push({ b, l, v: vals[i] / v.mx, j }); }); });
      if (Ns > 1) v.s.forEach(([sn, c], j) => { sub.add(lab(sn, [-12 + j * 3.4, 8.6, 0], { size: 19, color: css(c) })); });
      sub.add(lab(v.t, [Ns > 1 ? 5 : 0, 8.6, 0], { size: 21, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const ctls = [{ label: '看', items: ['图 7', '图 9', '表 3', '图 13'], get: () => view, set: k => { view = k; } }];
    const MSG = ['Small 一路涨到 <b>72.63</b>；Tiny 4K 后反而掉到 52.25：容量要跟着数据涨', '同样数据、同样 5.46M：重建目标的检索都低于 9%，中心误差 2.57 和 4.08 mm；本文 <b>49.32%</b>、<b>0.32 mm</b>', '预训练表征 <b>69.0%</b> > 任务内训练的 CNN 45.6% > 原始 38.5%', '每多一千小时触觉数据，策略都变好；4K 的 81.4 就是表 2 里这五个任务的平均'];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const g = seg(p, 0, 0.5); bars.forEach(({ b, l, v, j }) => { const h = Math.max(0.02, v * 7 * g); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.4 + (j % 2 ? 0.6 : 0); });
      cap(MSG[view]);
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player ---------- */
  let cur = 0, api = null, playing = !L.reduced(), t0 = 0, pNow = 0, tw = null, OPT = [];
  const HOLD = 1.8;
  const aspectFix = () => { const el = $('stage'), asp = (el.clientWidth || 1) / (el.clientHeight || 1); return Math.min(2.2, Math.max(1, 1.45 / asp)); };
  function fly(th, ph, d, tg) {
    let dth = th - S.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth)); d *= aspectFix();
    tw = { t0: performance.now(), from: [S.theta, S.phi, S.dist, S.target.clone()], to: [S.theta + dth, ph, d, new THREE.Vector3(...tg)] };
    refDist = d;
  }
  function setPlay(on) { playing = on; $('play').textContent = on ? '❚❚ 暂停' : '▶ 播放'; $('play').setAttribute('aria-label', on ? '暂停' : '播放'); }
  function go(i, p0 = 0) {
    cur = (i + SCENES.length) % SCENES.length; showInfo(cur);
    if (!S) return;
    L.clear(root); LABS = []; PICKS = []; lastCap = null;
    const sc = SCENES[cur], cam = document.body.classList.contains('embed') && sc.camE ? sc.camE : sc.cam; fly(...cam); refDist = cam[2] * aspectFix();
    const G = new THREE.Group(); root.add(G); pNow = p0; api = BUILD[cur](G); OPT = [];
    buildCtl();
    t0 = performance.now() - p0 * sc.dur * 1000; api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
  }
  if (S) {
    S.onTick(() => {
      if (playing && api) {
        const sc = SCENES[cur], el = (performance.now() - t0) / 1000;
        if (el > sc.dur + HOLD) { t0 = performance.now(); pNow = 0; } else pNow = Math.min(1, el / sc.dur);
        api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
      }
      if (tw) { const k = L.reduced() ? 1 : Math.min(1, (performance.now() - tw.t0) / 900), e = L.ease(k), a = tw.from, b = tw.to; S.setView(L.lerp(a[0], b[0], e), L.lerp(a[1], b[1], e), L.lerp(a[2], b[2], e), [L.lerp(a[3].x, b[3].x, e), L.lerp(a[3].y, b[3].y, e), L.lerp(a[3].z, b[3].z, e)]); if (k >= 1) tw = null; }
      const f = clamp(S.dist / refDist, 0.6, 1.6); for (const sp of LABS) sp.scale.copy(sp.userData.s0).multiplyScalar(f);
    });
    S.onClick(() => PICKS, hit => { const g = hit?.object?.userData?.go ?? hit?.object?.parent?.userData?.go; if (g != null) go(g); });
    S.onHover(() => PICKS, hit => { $('stage').style.cursor = hit ? 'pointer' : ''; });
  }
  $('ctl').addEventListener('click', e => { const b = e.target.closest('button[data-g]'); if (!b || !api?.ctls) return; const c = api.ctls[+b.dataset.g]; c.set(+b.dataset.k); api.update(pNow); $('scrub').value = Math.round(pNow * 1000); syncCtl(); });
  $('play').onclick = () => { if (!playing) t0 = performance.now() - pNow * SCENES[cur].dur * 1000; setPlay(!playing); };
  $('scrub').oninput = e => { setPlay(false); pNow = e.target.value / 1000; if (api) api.update(pNow); syncCtl(); };
  $('prev').onclick = () => go(cur - 1); $('next').onclick = () => go(cur + 1);
  btns.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); });
  stepsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; go(+b.dataset.i); if (!document.body.classList.contains('embed')) $('stage').scrollIntoView({ behavior: L.reduced() ? 'auto' : 'smooth', block: 'center' }); });
  document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' && e.key !== ' ') return; if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1); else if (e.key === ' ') { e.preventDefault(); $('play').click(); } });
  const s0 = clamp((parseInt(qs.get('scene'), 10) || 1) - 1, 0, SCENES.length - 1), pq = qs.get('p'); OPT = (qs.get('opt') || '').split(',').filter(x => x !== '');
  setPlay(playing && pq == null);
  go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0));
  window.__ltDebug = { get cap() { return $('cap').textContent; } };
})();
