'use strict';
/* Cosmos-Transfer1 (arXiv 2503.14492) taken apart into eleven animated scenes. Sizes and hyperparameters come from the paper
   and from the official code at commit 5005e82. Each scene's update(p) is a pure function of the timeline p plus the current
   toggles. Scenes 2, 4, 5 and 7 use toy images / toy activations (labelled); weights, normalisation, token counts, the sigma
   schedule and every bar are computed or copied from the paper. No Cosmos network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { vis: 0xf2c14e, edge: 0x38d1ff, depth: 0x9d8cff, seg: 0x4fc98a, base: 0x6b7794, zero: 0xd45fa0, out: 0x7cb8ff, text: 0xb48cff, noise: 0x8e9bb8, gold: 0xf2c14e, ok: 0x4fc98a, bad: 0xe05d5d, warn: 0xf0963c, white: 0xeef2fa, dim: 0x46506a, hd: 0x3aa8e0, lidar: 0xd45fa0 };
  const MOD = [['Vis', COL.vis], ['Edge', COL.edge], ['Depth', COL.depth], ['Seg', COL.seg]];
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const fmt = n => n.toLocaleString('en-US');

  const SCENES = [
    { n: 1, part: '总览', title: '控制视频进分支，分支加回底座', sub: '图 2 的 3D 版：四个控制分支、权重、冻结的 28 层 DiT', dur: 14, cam: [0.08, 1.22, 32, [-0.4, 4.8, 0]],
      html: dl([['输入', '1 到 N 段控制视频 + 文字（+ 可选的输入 RGB）'], ['分支', '每模态一个，3 个 block'], ['底座', 'Cosmos-Predict1-7B-Video2World，28 层，冻结'], ['融合', '底座第 j 块后加 Σᵢ wᵢ·hᵢʲ，j = 1..3'], ['输出', '5 秒，1280×704，24 fps']]) +
        '<p>每种模态（模糊、边缘、深度、分割）有自己的控制分支。分支是底座前 3 个 block 的副本，输出经零初始化的 linear，再乘以这个模态在每个位置的权重，加回底座前 3 个 block。</p>' +
        '<p>文字提示经交叉注意力进底座（也进分支，因为分支是底座 block 的副本）。底座之后的 25 个 block 只看底座自己的激活。</p>' + src('§2 图 1 · §3 图 2 · §4') },
    { n: 2, part: '§4 数据', title: '四种控制视频从输入视频算出来', sub: '切换边缘阈值看边缘数量怎么变', dur: 13, cam: [0, 1.32, 27, [0, 5.2, 0]], camE: [0, 1.32, 27, [0, 6.0, 0]],
      html: dl([['Vis', '双边滤波模糊（训练时随机参数）'], ['Edge', '逐帧 Canny（训练时随机阈值）'], ['Depth', 'DepthAnything2，归一化到 [0, 1]'], ['Seg', 'GroundingDINO 首帧检测 + SAM2 跟踪；颜色随机']]) +
        '<p>四种模态都可以从一段普通 RGB 视频自动算出来，所以训练数据不需要人工标注；仿真器里更简单，深度和分割直接就有。</p>' +
        '<p>它们约束的强弱不同：Vis 保留颜色和构图，最“紧”；Edge 只保轮廓；Depth 只保几何；Seg 只保布局，颜色随机后连类别信息都没有，最“松”。这决定了第 7 幕前景、背景怎样分配。</p>' +
        '<p>代码的边缘阈值：训练时下阈值 20 到 99、上阈值再加 50 到 149；推理默认 medium = 100 / 200。</p>' +
        toyb('一个 32×18 的手画画面（机械臂、杯子、桌子）。模糊用 3×3 盒式滤波、边缘用亮度梯度阈值、深度和分割按物体编号给值，都是页面当场算的简化版，不是双边滤波和 Canny。三档阈值只是对应 low / medium / high 的意思，数值不同。') +
        src('§4 模态列表 · 图 3 · control_input.py:558-575 · blurs.py') },
    { n: 3, part: '§4 token', title: '5 秒视频 = 56,320 个 token', sub: '切换帧数看 token 数', dur: 12, cam: [0.3, 1.16, 33, [0.6, 4.2, 0]],
      html: dl([['像素', '121 帧 × 704 × 1280 × 3'], ['tokenizer', 'CV8x8x8：时、高、宽各压 8 倍，首帧单独'], ['latent', '16 通道 × 16 × 88 × 160'], ['patchify', '2×2 → 16 × 44 × 80'], ['token', '56,320']]) +
        '<p>原文脚注 2：1280 ÷ 8 ÷ 2 = 80，704 ÷ 8 ÷ 2 = 44，(121 − 1) ÷ 8 + 1 = 16，相乘得 56,320。控制视频也走同一个 tokenizer，所以条件 token 和视频 token 一一对应。</p>' +
        '<p>这也是第 7 幕权重图的实际粒度：一个 token 管 16×16 像素、8 帧。</p>' +
        '<p>切换到 57 帧（代码里多视角模型用的长度）：(57 − 1) ÷ 8 + 1 = 8 个隐帧，28,160 个 token。</p>' + src('§4 脚注 2 · ctrl_7b_tp_121frames.py latent_shape') },
    { n: 4, part: '§2 ControlNet', title: '一个分支：复制 3 块，零初始化接回去', sub: '进度条是训练进度；切换条件加入的位置', dur: 14, cam: [0.32, 1.12, 26, [2.2, 4.6, 0]],
      html: dl([['底座', '28 个 block，冻结'], ['分支', '复制底座前 3 个 block 作初始化'], ['零 linear', '4096 → 4096，权重和偏置初始为 0'], ['式 (2)', 'n = D(x_σ, σ, c)']]) +
        '<p>零初始化保证训练第 0 步时分支对底座毫无影响，模型从“原样的底座”出发，慢慢学会用条件。只训练分支，底座不动。</p>' +
        '<p><b>论文图 1</b>：条件 token 经 linear 加到噪声 token 上，再进分支第 1 块。<b>代码</b>：分支先让噪声 token 走第 1 块，之后才加条件嵌入；条件嵌入本身经一个 7 层 MLP，末层也是零初始化。可以切换看两种位置。</p>' +
        toyb('三条残差的大小随训练增长的曲线是我设的（1 − e^(−6p) 乘不同系数），只为说明“从零开始”。') +
        src('§2 图 1 式 (1)(2) · general_dit_ctrl_enc.py:56-69, 295-327 · general_dit.py:548') },
    { n: 5, part: '§3 融合', title: '多分支：每个乘自己的权重再相加', sub: '这一幕是核心。切换预设，看底座前 3 块收到的残差', dur: 15, cam: [0.32, 1.1, 30, [3.6, 4.4, 0]], camE: [0.2, 1.12, 32, [4.2, 4.6, 0]],
      html: dl([['融合', '底座第 j 块后加 Σᵢ wᵢ·hᵢʲ'], ['训练', '每个分支单独训练'], ['推理', '任意组合，加或删分支不用重训'], ['归一化', 'w ← w / max(Σw, 1)（第 6 幕）']]) +
        '<p>四个分支看同一份噪声视频 token，各自加上自己的条件，各自算出 3 个残差 hᵢ¹、hᵢ²、hᵢ³。在底座第 j 块之后，所有分支的第 j 个残差乘权重相加。</p>' +
        '<p>左边三根堆叠柱是底座三个注入点收到的总量，每段颜色是一个模态的贡献。预设里的权重都先按第 6 幕的规则归一化。</p>' +
        '<p>分开训练的好处（§3）：一次只需把一个分支放进显存；不同模态可以用不同数据；训练完可以随时加减模态。代码训练时直接 assert 只能有一个分支。</p>' +
        toyb('每个分支每块的残差大小是我设的玩具数（例如 Vis 的残差比 Seg 大），权重和归一化是按论文和代码当场算的。') +
        src('§3 图 2 · general_dit_ctrl_enc.py:241-327 · inference_utils.py:1050-1115') },
    { n: 6, part: '§3 归一化', title: '某处权重和大于 1 才除', sub: '按按钮给四个模态设权重，当场归一化', dur: 11, cam: [0, 1.2, 23, [0.6, 3.0, 0]],
      html: dl([['规则', 'Σw ≤ 1 不动；Σw > 1 时除以 Σw'], ['代码', 'w / max(Σw, 1)，负值先截为 0'], ['默认', '没写权重的模态 0.5'], ['例子', '四个都给 1 → 各 0.25（表 1 等权）']]) +
        '<p>半透明柱是你给的权重，实心柱是归一化后真正乘上去的权重。右边是总和。</p>' +
        '<p>几个常见情况：四模态各 1 或各 0.5 都变成各 0.25；表 3 的 Setting 1 前景 Edge、Vis 各 1，实际各 0.5；图 9 深度、分割各 0.5，不变；图 10 HDMap 0.3、LiDAR 0.7，不变。</p>' +
        '<p>和小于 1 时不放大：只给 Depth 0.5，就只注入一半的深度残差，其余“空着”，底座更自由。</p>' +
        src('§3 · inference_utils.py:1094-1105 · 1258-1262') },
    { n: 7, part: '§5.2 权重图', title: '前景用紧的模态，背景用松的', sub: '切换预设和像素/token 视图；进度条是时间', dur: 16, cam: [0.18, 1.16, 30, [1.0, 4.4, 0]],
      html: dl([['图 6', '前景 Vis、Edge 各 0.5；背景 Depth、Seg 各 0.5'], ['表 2 行 2', '反过来'], ['Setting 1', '前景 Edge 1、Vis 1，背景 Seg 1'], ['Setting 2', '前景 Edge 1，背景 Seg 1'], ['粒度（代码）', '16 × 44 × 80 个 token']]) +
        '<p>论文 §5.2 用 VLM 把 GroundingDINO + SAM2 的掩码分成前景、背景，得到随时间变化的掩码。前景用 Vis、Edge 保住细节，背景用 Depth、Seg 换花样。</p>' +
        '<p>效果（表 2）：前景 Blur SSIM 0.81，背景 0.71；多样性前景 0.01，背景 0.33。反过来放，背景 SSIM 升到 0.93、前景多样性升到 0.12。</p>' +
        '<p>右边四张是四个模态归一化后的权重图（亮 = 权重高）。切到“token”：代码把权重图插值到 token 网格，每格 16×16 像素、8 帧，所以边缘变软。</p>' +
        toyb('人形掩码是手画的，随时间平移。像素图按 320×176 画（每像素代表原视频 4×4 像素），token 图按 4×4 平均成 80×44。') +
        src('§5.2 图 6 表 2 · §5.3 · world_generation_pipeline.py:601 · resize_control_weight_map') },
    { n: 8, part: '§4 训练', title: '每个分支单独训：1024 张 H100，2 到 4 周', sub: '切换周数看 GPU 小时', dur: 14, cam: [0.16, 1.1, 30, [0.8, 4.4, 0]],
      html: dl([['算力', '每分支 1024 × H100，2 到 4 周'], ['数据', 'Cosmos 平台的高质量微调集'], ['优化器（代码）', 'AdamW，lr = 2^−14.3 ≈ 4.96e-5，wd 0.1'], ['并行（代码）', 'TP 8 + 序列并行；EMA'], ['底座', '冻结，finetune_base_model=False']]) +
        '<p>每个分支训练时只有它自己和冻结的底座在显存里，这是“分开训练”省显存的原因。训练数据的控制视频按第 2 幕的方法即时生成，并加随机增强（模糊参数、Canny 阈值）。</p>' +
        '<p>GPU 小时（我的计算）：1024 × 24 × 14 = 344,064（2 周）到 688,128（4 周）。7B 的四个模态合计约 138 万到 275 万 H100 小时，不含 Sample-AV 和 4K 放大器。</p>' +
        guess('论文只说“2 到 4 周，视模态而定”，没说哪个模态多久，也没说是否同时训练。“混合”档里条的长度是我排的。') +
        src('§4 · ctrl_7b_tp_121frames.py:86-160 · optim.py') },
    { n: 9, part: '推理', title: '采样 35 步，再放大到 4K', sub: '切换起点 σ；进度条是采样步', dur: 15, cam: [0.12, 1.18, 32, [0.2, 4.8, 0]],
      html: dl([['步数（代码）', '35，2AB 多步求解器'], ['σ 序列', 'Karras，ρ = 7，到 0.002'], ['起点（代码）', 'σ = 70，从加噪的输入视频开始；EDM 上限 80'], ['引导', '正提示 / 负提示两路，guidance 5'], ['扩写器', 'Pixtral-12B（附录 A）']]) +
        '<p>每一步底座和所有分支各算两次：一次正提示，一次负提示（代码默认的负提示描述“老旧游戏、粗糙 CG”）。正负两路互相独立，第 11 幕就是把它们分到两组 GPU 上。</p>' +
        '<p>代码默认 <code>sigma_max = 70</code>：先给输入视频加 σ = 70 的噪声再去噪。σ = 70 时信噪比 0.5 / 70 ≈ 0.007，接近纯噪声，但保留一点低频。论文没提这一点。</p>' +
        '<p><b>4K 放大器</b>是另一个 ControlNet：把 720p 输入放大，切成 3×3 个 1280×704 的重叠块，每步在 latent 上合并重叠区。代码的画布是 3584×1968（重叠 128 / 72 像素），最后插值到 3840×2112。</p>' +
        guess('中间的“视频”方块是噪点和玩具画面按 σ 混合，只为看出噪声在降。σ 序列按代码公式当场算。') +
        src('§4 4KUpscaler 图 5 · 附录 A · transfer.py · res_sampler.py:115-150 · inference_utils.py:350-362') },
    { n: 10, part: '§5 结果', title: '表里的数', sub: '切换表，柱子都是原文数字', dur: 12, cam: [0, 1.28, 31, [0, 5.0, 0]],
      html: dl([['表 1', 'TransferBench，600 段（AgiBot World、OpenDV、Ego-Exo4D 各 200）'], ['表 3', '机器人仿真，20 场景 × 6 提示 = 120 段'], ['表 4', 'Sample-AV，HDMap / LiDAR / 两者'], ['质量分', 'DOVER-technical']]) +
        '<p>表 1：任何多模态组合的质量分（7.49 到 8.54）都高于任何单模态（5.48 到 6.51）。多样性正好反过来：稀疏模态高。</p>' +
        '<p>正文说等权模型“深度重建最好”，但表中去掉 Seg 的那一行 si-RMSE 0.43 比它的 0.47 更低（精读页读者注 8）。</p>' +
        '<p>表 3：两种机器人设置的质量分 9.57、10.42，前景 mIoU 0.61、0.63，都是前两名。表 4：融合后车道 mIoU 51.55 最高，mAP 44.66 介于两个单模态之间。</p>' + src('§5.1 表 1 · §5.3 表 3 · §5.4 表 4') },
    { n: 11, part: '§6 实时', title: '64 张 B200：32 个头 × 正负两路', sub: '进度条走过 1 到 64 卡；柱子是表 5', dur: 15, cam: [0.3, 1.1, 32, [2.6, 4.2, 0]],
      html: dl([['机柜', 'GB200 NVL72：36 Grace + 72 Blackwell'], ['非注意力层', '数据并行，每卡 56,320 / 32 = 1,760 个 token'], ['注意力', '按头并行，all-to-all，每卡一个头看完整 56K'], ['CFG', '正负提示分两组 GPU'], ['表 5', '1 卡 141.0 s → 64 卡 3.5 s（扩散）']]) +
        '<p>7B 模型一张 B200（192 GB）放得下，所以不切模型，只切序列。唯一的通信在注意力：all-to-all 把“每卡一段序列、全部头”换成“每卡一个头、完整序列”，算完再换回来。</p>' +
        '<p>32 个头决定每组最多 32 张卡，正负两路两组，共 64 张，这也是表 5 停在 64 的原因（我的推断）。</p>' +
        '<p>扩散加速 141.0 / 3.5 = 40.3 倍，效率 63%；端到端每列都多 0.7 秒的固定开销，64 卡时 4.2 秒，比视频本身的 5.04 秒短。开源代码里没有这个 all-to-all 方案，用的是 Transformer Engine 的上下文并行。</p>' +
        guess('GPU 方块的排列是示意。表 5 的时间是原文。') + src('§6 表 5 · transfer.py:222-228 · general_dit.py:583') }
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

  /* ---------- 3D helpers ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.3, phi: 1.0, dist: 24, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);
  let LABS = [], refDist = 24;
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  /* a label whose text can change; rebuilt only when the text changes */
  function dynLab(G, pos, o = {}) {
    const st = { s: null, t: null };
    return t => { if (t === st.t) return; if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; st.s = null; if (t === '') return; st.s = lab(t, pos, o); G.add(st.s); };
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: 0.65 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.13) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.5, dashed: o.dashed }); G.add(l); return l; };
  function panel(G, x, y, z, w, h) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x0c1220, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }
  /* a plane carrying a small canvas; draw(ctx) is called by the scene, then tex.needsUpdate */
  function canvasPlane(G, cw, ch, w, h, pos) {
    const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearFilter;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
    m.position.set(...pos); G.add(m); return { m, g, c, tex, put(img) { g.putImageData(img, 0, 0); tex.needsUpdate = true; } };
  }
  const normW = w => { const v = w.map(x => Math.max(0, x)), s = v.reduce((a, b) => a + b, 0); return v.map(x => x / Math.max(s, 1)); };

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
  const opt = (i, d) => { const v = OPT[i]; return v == null || v === '' ? d : +v; };

  /* ---------- toy frame shared by scenes 2 and 9: 32x18 cells, object ids 0 bg, 1 table, 2 arm, 3 cup ---------- */
  const FW = 32, FH = 18;
  const TOY = (() => {
    const id = new Uint8Array(FW * FH), rgb = [], dep = new Float32Array(FW * FH);
    const segd = (px, py, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy), 0, 1); return Math.hypot(px - ax - t * vx, py - ay - t * vy); };
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      const i = y * FW + x; let k = 0, c, d;
      if (y >= 12) { k = 1; }
      const arm = Math.min(segd(x, y, 7, 12, 11, 5), segd(x, y, 11, 5, 18, 7.5), segd(x, y, 18, 7.5, 19.5, 9.5));
      if (arm < 1.05) k = 2;
      if (x >= 19 && x <= 22 && y >= 9 && y <= 11.5) k = 3;
      if (k === 0) { c = [0.42 + 0.01 * x, 0.5 + 0.004 * x, 0.62 - 0.006 * y]; d = 1.0 - 0.012 * y; }
      else if (k === 1) { c = [0.55, 0.38, 0.24]; d = 0.62 - 0.035 * (y - 12); }
      else if (k === 2) { c = [0.16, 0.17, 0.2]; d = 0.36; }
      else { c = [0.82, 0.18, 0.2]; d = 0.3; }
      if (x > 25 && y < 12 && y > 2 && k === 0) { c = [0.75, 0.72, 0.6]; d = 0.85; k = 4; } // a cabinet on the wall
      id[i] = k; rgb.push(c); dep[i] = d;
    }
    return { id, rgb, dep };
  })();
  const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const SEGC = [[0.15, 0.2, 0.75], [0.85, 0.75, 0.1], [0.9, 0.2, 0.75], [0.2, 0.85, 0.35], [0.95, 0.5, 0.1]];
  function toyMaps(th) {
    const blur = [], edge = new Uint8Array(FW * FH); let ne = 0;
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
      let s = [0, 0, 0], n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = clamp(x + dx, 0, FW - 1), yy = clamp(y + dy, 0, FH - 1), c = TOY.rgb[yy * FW + xx]; s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; n++; }
      blur.push(s.map(v => v / n));
      const l = (xx, yy) => lum(TOY.rgb[clamp(yy, 0, FH - 1) * FW + clamp(xx, 0, FW - 1)]);
      const g = Math.hypot(l(x + 1, y) - l(x - 1, y), l(x, y + 1) - l(x, y - 1));
      if (g > th) { edge[y * FW + x] = 1; ne++; }
    }
    return { blur, edge, ne };
  }
  function imgOf(fn) { const im = new ImageData(FW, FH); for (let i = 0; i < FW * FH; i++) { const c = fn(i); im.data[4 * i] = c[0] * 255; im.data[4 * i + 1] = c[1] * 255; im.data[4 * i + 2] = c[2] * 255; im.data[4 * i + 3] = 255; } return im; }

  /* a column of DiT blocks drawn as thin slabs; returns the meshes, top block first */
  function column(G, n, x, yTop, dy, w, color, o = {}) { const out = []; for (let i = 0; i < n; i++) { const b = block(w, dy * 0.66, 1.4, color, [x, yTop - i * dy, 0], o); G.add(b); out.push(b); } return out; }

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    const base = column(G, 10, 6, 7.6, 0.85, 3.2, COL.base);
    G.add(lab('底座 DiT（冻结）\n28 个 block，画了 10 个', [6, 9.1, 0], { size: 19 }));
    G.add(lab('…', [6, 0.9, 0], { size: 22, bg: false }));
    const br = [], ins = [], bx = [];
    MOD.forEach(([nm, c], i) => {
      const x = -5.4 + i * 2.25;
      const col = []; for (let j = 0; j < 3; j++) { const b = block(1.8, 0.56, 0.9, c, [x, 7.6 - j * 0.85, 0], { opacity: 0.92 }); G.add(b); col.push(b); }
      br.push(col); bx.push(x);
      const v = block(2.4, 1.3, 0.12, c, [-11.6, 9.0 - i * 1.7, 0]); G.add(v, lab(nm + ' 视频', [-11.6, 9.0 - i * 1.7, 0.2], { size: 17 })); ins.push(v);
    });
    G.add(lab('4 个控制分支，每个 3 个 block', [-2.0, 9.0, 0], { size: 18 }));
    const outV = block(2.6, 1.5, 0.15, COL.out, [10.8, 2.4, 0]); G.add(outV, lab('输出视频\n5 s · 1280×704 · 24 fps', [10.8, 4.0, 0], { size: 18 }));
    const txt = block(2.4, 0.8, 0.5, COL.text, [11.2, 6.4, 0]); G.add(txt, lab('文字提示 → T5', [11.2, 7.4, 0], { size: 18 }));
    const noisy = block(2.6, 0.6, 0.5, COL.noise, [6, 10.6, 0]); G.add(noisy, lab('噪声视频 token', [9.4, 10.6, 0], { size: 18 }));
    const fl = MOD.map(([, c]) => stream(G, 6, c)), fb = stream(G, 10, COL.out), ft = stream(G, 5, COL.text, 0.1);
    MOD.forEach((m, i) => wire(G, [[-10.4, 9.0 - i * 1.7, 0], [bx[i], 8.0, 0]], m[1], { opacity: 0.35 }));
    for (let j = 0; j < 3; j++) wire(G, [[-6.3, 7.6 - j * 0.85, 0.5], [4.4, 7.6 - j * 0.85, 0.5]], COL.zero, { opacity: 0.6 });
    G.add(lab('× w，加回底座第 1–3 块', [-1.0, 4.9, 0], { size: 17, color: '#f0a0d0' }));
    return { update(p) {
      const a = seg(p, 0, 0.25), b = seg(p, 0.2, 0.5), c = seg(p, 0.45, 0.7), d = seg(p, 0.65, 1);
      ins.forEach((v, i) => glow(v, a * (0.5 + 0.5 * Math.sin(p * 20 + i))));
      br.forEach(col => col.forEach((m, j) => glow(m, b * (Math.abs(((p * 3) % 1) * 3 - j) < 0.8 ? 0.7 : 0.15))));
      base.forEach((m, j) => glow(m, j < 3 ? c * 0.6 : d * (Math.abs(((p - 0.65) / 0.35) * 10 - j) < 1 ? 0.7 : 0.05)));
      glow(outV, d * d); glow(txt, 0.3); glow(noisy, 0.3);
      MOD.forEach((m, i) => fl[i]([[-10.4, 9.0 - i * 1.7, 0], [bx[i], 8.0, 0], [bx[i], 5.9, 0.5], [4.4, 5.9, 0.5]], (p * 4) % 1, a > 0.05 ? 1 : 0));
      fb([[6, 10.3, 0], [6, 0.6, 0], [10.8, 2.4, 0]], (p * 2) % 1, d > 0.02 ? 1 : 0);
      ft([[11.2, 6.4, 0], [7.6, 5.0, 0]], (p * 3) % 1, 1);
      const st = p < 0.25 ? '四段控制视频（可以只给一段）' : p < 0.5 ? '每个分支：3 个 block，看噪声 token + 自己的条件' : p < 0.7 ? '分支输出 × 权重，加到底座第 1–3 块之后' : '底座跑完 28 块，35 步采样后解码成视频';
      cap(`<b>${st}</b>`);
    } };
  }

  /* ---------- scene 2: control modalities computed from a toy frame ---------- */
  function s2(G) {
    let th = opt(0, 1); const TH = [0.06, 0.14, 0.3], THN = ['低', '中', '高'];
    const W = 5.6, H = W * FH / FW;
    const inp = canvasPlane(G, FW, FH, W, H, [0, 8.0, 0]); inp.put(imgOf(i => TOY.rgb[i])); G.add(lab('输入视频（玩具帧）', [0, 8.0 + H / 2 + 0.6, 0], { size: 19 }));
    const pos = [[-9.3, 2.8], [-3.1, 2.8], [3.1, 2.8], [9.3, 2.8]];
    const P = MOD.map(([nm, c], k) => { const cp = canvasPlane(G, FW, FH, W, H, [pos[k][0], pos[k][1], 0]); G.add(lab(nm, [pos[k][0], pos[k][1] + H / 2 + 0.55, 0], { size: 19, color: css(c) })); return cp; });
    const arrows = pos.map(([x, y]) => wire(G, [[0, 8.0 - H / 2, 0], [x, y + H / 2, 0]], COL.white, { opacity: 0.25 }));
    const depth = imgOf(i => { const d = 1 - TOY.dep[i]; return [d, d, d]; });
    const segi = imgOf(i => SEGC[TOY.id[i]]);
    const capT = dynLab(G, [0, -0.6, 0], { size: 18 });
    let last = -1, M = null;
    const ctls = [{ label: '边缘阈值', items: THN, get: () => th, set: k => { th = k; } }];
    return { ctls, update(p) {
      if (last !== th) { M = toyMaps(TH[th]); P[0].put(imgOf(i => M.blur[i])); P[1].put(imgOf(i => M.edge[i] ? [1, 1, 1] : [0, 0, 0])); P[2].put(depth); P[3].put(segi); last = th; }
      P.forEach((cp, k) => { const a = seg(p, 0.08 + k * 0.18, 0.24 + k * 0.18); cp.m.material.opacity = 0.08 + 0.92 * a; arrows[k].material.opacity = 0.1 + 0.4 * a; });
      capT(`边缘像素 ${M.ne} / ${FW * FH}（阈值 ${THN[th]}）`);
      const k = Math.min(3, Math.floor(p * 4.6));
      cap(['<b>Vis</b>：模糊后保颜色和构图（最紧）', '<b>Edge</b>：只留轮廓；阈值越高边越少，约束越松', '<b>Depth</b>：近亮远暗，只保几何', '<b>Seg</b>：每个物体一个随机颜色，只保布局（最松）'][k]);
    } };
  }

  /* ---------- scene 3: token count ---------- */
  function s3(G) {
    let fr = opt(0, 0); const FR = [121, 57];
    const sub = new THREE.Group(); G.add(sub); let last = -1, parts = null;
    const lt = dynLab(G, [-9.6, 7.4, 0], { size: 18 }), ll = dynLab(G, [0.6, 7.4, 0], { size: 18 }), lk = dynLab(G, [10.4, 7.4, 0], { size: 18, border: 'rgba(56,209,255,.7)' });
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); last = fr;
      const T = FR[fr], tl = (T - 1) / 8 + 1;
      const vid = block(6.4, 3.52, T / 20, COL.out, [-9.6, 4.2, 0], { opacity: 0.55 }); sub.add(vid);
      const lat = block(6.4, 3.52, tl / 3.2, COL.depth, [0.6, 4.2, 0], { opacity: 0.55 }); sub.add(lat);
      const im = inst(BOX, 80 * 44); let n = 0; for (let y = 0; y < 44; y++) for (let x = 0; x < 80; x++) { setI(im, n, [10.4 - 3.2 + (x + 0.5) * 0.08, 4.2 - 1.76 + (y + 0.5) * 0.08, 0], [0.066, 0.066, 0.066]); const k = ((x >> 3) + (y >> 3)) % 2; colI(im, n, k ? [0.22, 0.82, 1] : [0.15, 0.55, 0.75]); n++; } done(im); sub.add(im);
      const layers = []; for (let t = 1; t < tl; t++) { const s = block(6.4, 3.52, 0.02, COL.edge, [10.4, 4.2, -t * 0.32], { opacity: 0.12, edges: false }); sub.add(s); layers.push(s); }
      parts = { vid, lat, im, layers, T, tl };
    }
    rebuild();
    const ctls = [{ label: '帧数', items: ['121（论文）', '57（多视角）'], get: () => fr, set: k => { fr = k; } }];
    G.add(lab('tokenizer\nCV8x8x8', [-4.5, 1.2, 0], { size: 17 }), lab('patchify\n2×2', [5.5, 1.2, 0], { size: 17 }));
    const f1 = stream(G, 8, COL.out), f2 = stream(G, 8, COL.edge);
    return { ctls, update(p) {
      if (last !== fr) rebuild();
      const { T, tl } = parts, a = seg(p, 0, 0.3), b = seg(p, 0.3, 0.6), c = seg(p, 0.6, 0.9);
      parts.vid.scale.set(1, 1, 1); glow(parts.vid, a * 0.4); glow(parts.lat, b * 0.4);
      parts.lat.material.opacity = 0.15 + 0.5 * b; parts.im.visible = c > 0.02; parts.im.material.opacity = c; parts.im.material.transparent = true;
      parts.layers.forEach((s, i) => { s.visible = c > i / tl; });
      f1([[-6.2, 4.2, 0], [-2.8, 4.2, 0]], (p * 3) % 1, a > 0.05 ? 1 : 0); f2([[4.0, 4.2, 0], [7.0, 4.2, 0]], (p * 3) % 1, c > 0.05 ? 1 : 0);
      lt(`像素：${T} × 704 × 1280 × 3`); ll(`latent：16 通道 × ${tl} × 88 × 160`);
      const tok = Math.round(80 * 44 * tl * c); lk(`token：80 × 44 × ${tl} = ${fmt(tok)}`);
      cap(`(${T} − 1) ÷ 8 + 1 = <b>${tl}</b> 个隐帧；1280 ÷ 16 = 80，704 ÷ 16 = 44；共 <b>${fmt(80 * 44 * tl)}</b> 个 token`);
    } };
  }

  /* ---------- scene 4: one ControlNet branch; residual magnitude grows from zero (toy) ---------- */
  function s4(G) {
    let where = opt(0, 1);
    const base = column(G, 12, -1.5, 8.2, 0.62, 3.0, COL.base);
    G.add(lab('底座 28 块（冻结，画 12 块）', [-1.5, 9.4, 0], { size: 18 }), lab('…', [-1.5, 0.6, 0], { size: 20, bg: false }));
    const br = column(G, 3, 6.5, 8.2, 0.62, 3.0, COL.edge, { opacity: 0.95 });
    G.add(lab('分支：复制前 3 块', [6.5, 9.4, 0], { size: 18, color: css(COL.edge) }));
    const zl = [0, 1, 2].map(j => { const z = block(1.0, 0.36, 0.8, COL.zero, [2.9, 8.2 - j * 0.62, 0]); G.add(z); return z; });
    G.add(lab('零 linear', [2.9, 6.25, 0], { size: 17, color: '#f0a0d0' }));
    const cond = block(2.6, 0.6, 0.6, COL.depth, [11.2, 8.2, 0]); G.add(cond, lab('条件 latent\n→ 7 层 MLP（末层零）', [11.2, 9.55, 0], { size: 17 }));
    const plus = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.06, 8, 24), L.mat(COL.warn)); G.add(plus);
    const wl = wire(G, [[11.2, 7.9, 0], [8.2, 8.2, 0]], COL.depth, { opacity: 0.6 });
    const bars = [0, 1, 2].map(j => { const b = block(0.3, 1, 0.3, COL.zero, [1.3, 0, 0.9], { edges: false }); G.add(b); return b; });
    const rd = dynLab(G, [7.0, 4.9, 0], { size: 18 });
    const fl = stream(G, 6, COL.depth, 0.11);
    const ctls = [{ label: '条件加在', items: ['第 1 块之前（图 1）', '第 1 块之后（代码）'], get: () => where, set: k => { where = k; } }];
    return { ctls, update(p) {
      const g = 1 - Math.exp(-6 * p), amp = [0.9, 0.6, 0.4];
      base.forEach(m => glow(m, 0.04)); br.forEach((m, j) => glow(m, 0.25 + 0.3 * g));
      zl.forEach((z, j) => { glow(z, g); const h = Math.max(0.01, amp[j] * g * 1.4); bars[j].scale.y = h; bars[j].position.set(1.3 + j * 0.0, 8.2 - j * 0.62, 0.9); bars[j].scale.x = 0.3 + 2.4 * amp[j] * g; bars[j].position.x = 0.2 + bars[j].scale.x / 2; bars[j].scale.y = 0.26; });
      const y = where === 0 ? 8.2 + 0.45 : 8.2 - 0.31; plus.position.set(6.5 - 1.75, y, 0);
      fl([[11.2, 7.9, 0], [6.5 - 1.75, y, 0]], (p * 3) % 1, 1);
      rd(`训练进度 ${(p * 100).toFixed(0)}% · 零 linear 输出 ${(g).toFixed(2)}（玩具）`);
      cap(p < 0.04 ? '第 0 步：零 linear 输出全是 0，<b>模型 = 原样的底座</b>' : `分支学会用条件，残差从 0 长出来；条件加在第 1 块<b>${where ? '之后（代码）' : '之前（图 1）'}</b>`);
    } };
  }

  /* ---------- scene 5: four branches, weighted sum into base blocks 1-3 ---------- */
  function s5(G) {
    let pre = opt(0, 0);
    const PRE = [['等权 1,1,1,1', [1, 1, 1, 1]], ['只 Depth 1', [0, 0, 1, 0]], ['表 2 前景 .5,.5,0,0', [0.5, 0.5, 0, 0]], ['表 2 背景 0,0,.5,.5', [0, 0, 0.5, 0.5]], ['Setting 1 前景 1,1,0,0', [1, 1, 0, 0]]];
    const H = [[1.0, 0.8, 0.6], [0.85, 0.7, 0.55], [0.6, 0.5, 0.45], [0.5, 0.42, 0.35]]; // toy residual sizes per modality per block
    const base = column(G, 8, 0, 8.2, 0.8, 2.8, COL.base);
    G.add(lab('底座（冻结）', [0, 9.5, 0], { size: 18 }), lab('…', [0, 1.4, 0], { size: 20, bg: false }));
    const brs = MOD.map(([nm, c], i) => { const x = 4.6 + i * 3.3; const col = column(G, 3, x, 8.2, 0.8, 2.4, c, { opacity: 0.95 }); G.add(lab(nm, [x, 9.5, 0], { size: 18, color: css(c) })); return col; });
    const mult = MOD.map(([, c], i) => [0, 1, 2].map(j => { const s = L.sphere(0.2, COL.zero); s.position.set(4.6 + i * 3.3 - 1.55, 8.2 - j * 0.8 - 0.32, 0.5); G.add(s); return s; }));
    for (let j = 0; j < 3; j++) wire(G, [[16.5, 8.2 - j * 0.8 - 0.32, 0.5], [1.4, 8.2 - j * 0.8 - 0.32, 0.5]], COL.zero, { opacity: 0.35 });
    const stack = []; for (let j = 0; j < 3; j++) { const row = MOD.map(([, c]) => { const b = block(1, 0.42, 0.42, c, [0, 0, 0], { edges: false }); G.add(b); return b; }); stack.push(row); }
    G.add(lab('收到的残差', [-5.6, 9.5, 0], { size: 18 }));
    const wl = MOD.map((m, i) => dynLab(G, [4.6 + i * 3.3, 5.1, 0], { size: 17 }));
    const fl = MOD.map(([, c]) => stream(G, 5, c, 0.1));
    const ctls = [{ label: '权重', items: PRE.map(x => x[0]), get: () => pre, set: k => { pre = k; } }];
    return { ctls, update(p) {
      const w = normW(PRE[pre][1]), a = seg(p, 0.1, 0.6);
      MOD.forEach((m, i) => { brs[i].forEach(b => { glow(b, w[i] > 0 ? 0.25 + 0.3 * w[i] : 0); b.material.opacity = w[i] > 0 ? 0.95 : 0.25; b.material.transparent = true; }); mult[i].forEach(s => s.scale.setScalar(0.4 + 1.6 * w[i])); wl[i](w[i].toFixed(2)); });
      for (let j = 0; j < 3; j++) { let x = -2.2; stack[j].forEach((b, i) => { const len = Math.max(0.001, H[i][j] * w[i] * 5.5 * a); b.scale.x = len; x -= len; b.position.set(x + len / 2, 8.2 - j * 0.8, 0); b.visible = len > 0.01; }); }
      base.forEach((b, j) => glow(b, j < 3 ? 0.5 * a : 0.04));
      MOD.forEach((m, i) => fl[i]([[4.6 + i * 3.3 - 1.55, 8.2 - 0.32, 0.5], [1.4, 8.2 - 0.32, 0.5]], (p * 3 + i * 0.2) % 1, w[i] > 0 ? 1 : 0));
      const tot = [0, 1, 2].map(j => w.reduce((s, wi, i) => s + wi * H[i][j], 0));
      cap(`归一化后 w = [${w.map(x => x.toFixed(2)).join(', ')}] · 第 1 块收到 Σwh = <b>${tot[0].toFixed(2)}</b>（玩具单位）`);
    } };
  }

  /* ---------- scene 6: normalisation computed live ---------- */
  function s6(G) {
    const VALS = [0, 0.25, 0.5, 1];
    let W = [opt(0, 3), opt(1, 3), opt(2, 3), opt(3, 3)];
    const raw = [], nrm = [], lv = [];
    MOD.forEach(([nm, c], i) => {
      const x = -6 + i * 3.4;
      const r = block(1.0, 1, 1.0, c, [x - 0.55, 0, 0], { opacity: 0.3 }); const n = block(1.0, 1, 1.0, c, [x + 0.55, 0, 0]);
      G.add(r, n, lab(nm, [x, -0.6, 1.0], { size: 19, color: css(c) })); raw.push(r); nrm.push(n); lv.push(dynLab(G, [x, -1.7, 1.0], { size: 16 }));
    });
    const sumB = block(1.2, 1, 1.2, COL.white, [8.4, 0, 0], { opacity: 0.4 }); G.add(sumB, lab('Σw', [8.4, -0.6, 1.0], { size: 19 }));
    const sl = dynLab(G, [8.4, -1.7, 1.0], { size: 16 });
    const one = block(15.5, 0.03, 2.4, COL.warn, [1.2, 5.0, 0], { edges: false, opacity: 0.6 }); G.add(one, lab('= 1', [9.9, 5.0, 0], { size: 17, color: '#f0963c' }));
    G.add(L.grid(24, 24));
    const ctls = MOD.map(([nm], i) => ({ label: nm, items: VALS.map(String), get: () => W[i], set: k => { W[i] = k; } }));
    return { ctls, update(p) {
      const w = W.map(k => VALS[k]), s = w.reduce((a, b) => a + b, 0), n = normW(w), a = seg(p, 0, 0.35), b = seg(p, 0.4, 0.75), H = 5;
      w.forEach((v, i) => { const hr = Math.max(0.01, v * H * a); raw[i].scale.y = hr; raw[i].position.y = hr / 2; const hn = Math.max(0.01, L.lerp(v, n[i], b) * H * a); nrm[i].scale.y = hn; nrm[i].position.y = hn / 2; lv[i](`${v} → ${n[i].toFixed(3)}`); });
      const hs = Math.max(0.01, L.lerp(s, Math.min(s, 1), b) * H * a); sumB.scale.y = hs; sumB.position.y = hs / 2; sl(`${s.toFixed(2)} → ${n.reduce((x, y) => x + y, 0).toFixed(2)}`);
      cap(s > 1 ? `Σw = ${s.toFixed(2)} &gt; 1，每个除以 ${s.toFixed(2)} → <b>[${n.map(x => x.toFixed(3)).join(', ')}]</b>` : `Σw = ${s.toFixed(2)} ≤ 1，<b>不变</b>；空着的 ${(1 - s).toFixed(2)} 不会被补上`);
    } };
  }

  /* ---------- scene 7: FG/BG spatiotemporal weight maps, pixel vs token grid ---------- */
  function s7(G) {
    let pre = opt(0, 0), view = opt(1, 1);
    const PRE = [['图 6', [0.5, 0.5, 0, 0], [0, 0, 0.5, 0.5]], ['表 2 行 2', [0, 0, 0.5, 0.5], [0.5, 0.5, 0, 0]], ['Setting 1', [1, 1, 0, 0], [0, 0, 0, 1]], ['Setting 2', [0, 1, 0, 0], [0, 0, 0, 1]]];
    const PW = 320, PH = 176, TW = 80, TH = 44;
    const mask = canvasPlane(G, PW, PH, 9.6, 5.28, [-7.6, 4.4, 0]); G.add(lab('前景掩码', [-7.6, 7.65, 0], { size: 19 }));
    const pos = [[1.9, 7.2], [9.7, 7.2], [1.9, 1.3], [9.7, 1.3]];
    const P = MOD.map(([nm, c], k) => { const cp = canvasPlane(G, PW, PH, 6.2, 3.41, [pos[k][0], pos[k][1], 0]); G.add(lab(nm, [pos[k][0], pos[k][1] + 2.15, 0], { size: 18, color: css(c) })); return cp; });
    const wl = MOD.map((m, k) => dynLab(G, [pos[k][0], pos[k][1] - 2.15, 0], { size: 16 }));
    const fgAt = (x, y, t) => { const cx = 120 + t * 7, hx = (x - cx) / 16, hy = (y - 38) / 16; if (hx * hx + hy * hy < 1) return 1; if (Math.abs(x - cx) < 24 && y > 52 && y < 150) return 1; if (Math.abs(x - cx - 8 + (y - 150) * 0.2) < 7 && y >= 150 && y < 172) return 1; const wx = (x - cx + 36) / 26, wy = (y - 92) / 26; return wx * wx + wy * wy < 1 ? 1 : 0; };
    const ctls = [{ label: '预设', items: PRE.map(x => x[0]), get: () => pre, set: k => { pre = k; } }, { label: '视图', items: ['像素', 'token（代码）'], get: () => view, set: k => { view = k; } }];
    let key = '', fgShare = 0;
    return { ctls, update(p) {
      const t = Math.min(15, Math.floor(p * 16)), k2 = pre + '_' + view + '_' + t;
      const [, wf, wb] = PRE[pre]; const nf = normW(wf), nb = normW(wb);
      MOD.forEach((m, i) => wl[i](`${nf[i].toFixed(2)} / ${nb[i].toFixed(2)}`));
      if (k2 !== key) {
        key = k2;
        const fg = new Float32Array(PW * PH); let nfg = 0; for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) { const v = fgAt(x, y, t); fg[y * PW + x] = v; nfg += v; }
        let F = fg; if (view === 1) { F = new Float32Array(PW * PH); for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) { let s = 0; for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) s += fg[(ty * 4 + dy) * PW + tx * 4 + dx]; s /= 16; for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) F[(ty * 4 + dy) * PW + tx * 4 + dx] = s; } }
        const im = new ImageData(PW, PH); for (let i = 0; i < PW * PH; i++) { const v = F[i] * 255; im.data[4 * i] = v; im.data[4 * i + 1] = v; im.data[4 * i + 2] = v; im.data[4 * i + 3] = 255; } mask.put(im);
        MOD.forEach(([, c], m) => { const col = hex3(c), im2 = new ImageData(PW, PH); for (let i = 0; i < PW * PH; i++) { const f = F[i], raw = wf.map((a, j) => f * a + (1 - f) * wb[j]); const w = normW(raw)[m]; im2.data[4 * i] = 20 + w * 235 * col[0]; im2.data[4 * i + 1] = 24 + w * 231 * col[1]; im2.data[4 * i + 2] = 36 + w * 219 * col[2]; im2.data[4 * i + 3] = 255; } P[m].put(im2); });
        fgShare = nfg / (PW * PH);
      }
      cap(`权重标签是 前景 / 背景 · 隐帧 <b>${t + 1}</b> / 16 · 前景占 ${(fgShare * 100).toFixed(1)}% · ${view ? 'token 网格：每格 16×16 像素、8 帧，边缘变软' : '像素掩码（插值前）'}`);
    } };
  }

  /* ---------- scene 8: separate training of each branch; GPU-hours computed ---------- */
  function s8(G) {
    let wk = opt(0, 1); const WK = [[2, 2, 2, 2], [3, 2, 4, 3], [4, 4, 4, 4]], WKN = ['都 2 周', '混合（示意）', '都 4 周'];
    const im = inst(BOX, 1024); let n = 0; for (let z = 0; z < 8; z++) for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) { setI(im, n, [-12 + x * 0.42, 1 + y * 0.42, -z * 0.42], 0.3); colI(im, n, [0.3, 0.35, 0.45]); n++; } done(im); G.add(im);
    G.add(lab('1024 张 H100（一个分支）', [-8.9, 5.2, 0], { size: 18 }));
    const baseB = block(3.2, 1.2, 1.2, COL.base, [-8.9, -0.6, 0]); G.add(baseB, lab('底座 7B · 冻结', [-8.9, -1.7, 0.6], { size: 17 }));
    const rows = MOD.map(([nm, c], i) => { const b = block(1, 0.6, 0.6, c, [0, 0, 0]); G.add(b, lab(nm, [-1.3, 7.2 - i * 1.3, 0], { size: 18, color: css(c) })); return b; });
    for (let w = 0; w <= 16; w += 4) G.add(lab(w + ' 周', [w * 0.7, 2.1, 0], { size: 15 }));
    const cur = block(0.05, 6.2, 0.05, COL.warn, [0, 5.0, 0.4], { edges: false }); G.add(cur);
    const hl = dynLab(G, [5.0, 9.6, 0], { size: 18, border: 'rgba(56,209,255,.7)' });
    const ctls = [{ label: '周数', items: WKN, get: () => wk, set: k => { wk = k; } }];
    return { ctls, update(p) {
      const w = WK[wk], start = [0]; for (let i = 1; i < 4; i++) start.push(start[i - 1] + w[i - 1]); const tot = start[3] + w[3], now = p * tot;
      rows.forEach((b, i) => { const len = Math.max(0.01, clamp(now - start[i], 0, w[i]) * 0.7); b.scale.x = len; b.position.set(start[i] * 0.7 + len / 2, 7.2 - i * 1.3, 0); glow(b, now > start[i] && now < start[i] + w[i] ? 0.6 : 0.1); });
      cur.position.x = now * 0.7;
      const act = rows.findIndex((b, i) => now >= start[i] && now < start[i] + w[i]); const c = act >= 0 ? hex3(MOD[act][1]) : [0.3, 0.35, 0.45];
      for (let i = 0; i < 1024; i++) colI(im, i, act >= 0 && ((i * 7 + Math.floor(p * 60)) % 11) ? c : [0.3, 0.35, 0.45]); done(im);
      const hrs = w.map(x => 1024 * 24 * 7 * x), done4 = w.reduce((s, x, i) => s + 1024 * 24 * 7 * clamp(now - start[i], 0, x), 0);
      hl(`已用 ${fmt(Math.round(done4))} H100 小时 / 共 ${fmt(hrs.reduce((a, b) => a + b, 0))}`);
      cap(`每个分支 1024 × 24 × 7 × 周数：2 周 <b>344,064</b>，4 周 <b>688,128</b> H100 小时${act >= 0 ? ` · 正在训 <b>${MOD[act][0]}</b>` : ''}`);
    } };
  }

  /* ---------- scene 9: sampling (sigma schedule from the code) and the 4K upscaler tiling ---------- */
  function s9(G) {
    let sm = opt(0, 1); const SM = [80, 70], N = 35, RHO = 7, SMIN = 0.002;
    const sig = smax => { const a = Math.pow(smax, 1 / RHO), b = Math.pow(SMIN, 1 / RHO); return Array.from({ length: N + 1 }, (_, i) => Math.pow(a + i / N * (b - a), RHO)); };
    const XP = -15, WP = 9, YP = 1.2, HP = 6.4; panel(G, XP - 0.3, YP - 0.3, -0.3, WP + 0.6, HP + 0.6);
    const im = inst(BOX, N + 1); G.add(im);
    G.add(lab('σ（对数轴），35 步', [XP + WP / 2, YP + HP + 0.7, 0], { size: 18 }));
    const vid = canvasPlane(G, FW, FH, 6.4, 3.6, [-0.6, 5.6, 0]); G.add(lab('当前 x̂₀（示意）', [-0.6, 8.0, 0], { size: 18 }));
    const pos = block(2.6, 0.6, 0.6, COL.ok, [-2.0, 2.6, 0]), neg = block(2.6, 0.6, 0.6, COL.bad, [0.9, 2.6, 0]); G.add(pos, neg, lab('正提示', [-2.0, 1.7, 0], { size: 16 }), lab('负提示', [0.9, 1.7, 0], { size: 16 }));
    const tw = 1280 / 400, th = 704 / 400, ow = 128 / 400, oh = 72 / 400;
    const tiles = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const b = block(tw, th, 0.08, [COL.edge, COL.depth, COL.seg][(r + c) % 3], [5.0 + c * (tw - ow) + tw / 2, 7.4 - r * (th - oh) - th / 2, r * 0.03 + c * 0.03], { opacity: 0.45 }); G.add(b); tiles.push(b); }
    G.add(lab('4K 放大：3×3 块，每块 1280×704\n画布 3584×1968\n→ 插值到 3840×2112', [5.0 + 4.48, 9.0, 0], { size: 16 }));
    const rd = dynLab(G, [-0.6, 0.5, 0], { size: 18 });
    const ctls = [{ label: '起点', items: ['σ = 80（EDM 上限）', 'σ = 70（代码默认）'], get: () => sm, set: k => { sm = k; } }];
    const r = L.rng(5), NZ = Array.from({ length: FW * FH }, () => [r(), r(), r()]);
    return { ctls, update(p) {
      const S0 = sig(SM[sm]), k = Math.min(N, Math.floor(p * 0.8 * (N + 1))), lo = Math.log10(SMIN), hi = Math.log10(80);
      for (let i = 0; i <= N; i++) { const y = YP + (Math.log10(S0[i]) - lo) / (hi - lo) * HP; setI(im, i, [XP + i / N * WP, y, 0], i === k ? 0.32 : 0.16); colI(im, i, i <= k ? [0.22, 0.82, 1] : [0.35, 0.4, 0.5]); } done(im);
      const s = S0[k], a = 0.5 / Math.sqrt(s * s + 0.25);
      vid.put(imgOf(i => TOY.rgb[i].map((v, c) => clamp(a * v + (1 - a) * NZ[i][c], 0, 1))));
      glow(pos, (p * 70) % 2 < 1 ? 0.7 : 0.1); glow(neg, (p * 70) % 2 < 1 ? 0.1 : 0.7);
      const u = seg(p, 0.82, 1); tiles.forEach((b, i) => { b.material.opacity = 0.15 + 0.5 * (u * 9 > i ? 1 : 0); });
      rd(`第 ${k} / ${N} 步 · σ = ${s < 1 ? s.toFixed(3) : s.toFixed(1)} · 信噪比 ${(0.5 / s).toFixed(3)}`);
      cap(p < 0.82 ? `每步：底座 + 分支跑两遍（正、负提示），guidance 5 · 起点 σ = <b>${SM[sm]}</b>${sm ? '（输入视频加噪）' : ''}` : '<b>4K 放大器</b>：另一个 ControlNet，3×3 块重叠，每个去噪步在 latent 上合并重叠区');
    } };
  }

  /* ---------- scene 10: results; every bar is a number from the paper ---------- */
  function s10(G) {
    let view = opt(0, 0); G.add(L.grid(34, 34)); const sub = new THREE.Group(); G.add(sub);
    const T = [
      { t: '表 1 · 质量分（DOVER）', mx: 10, g: ['Vis', 'Edge', 'Depth', 'Seg', '无 Vis', '无 Edge', '无 Depth', '无 Seg', '等权'], v: [5.94, 5.48, 6.51, 6.30, 8.02, 7.68, 7.49, 7.83, 8.54], hi: 8, msg: '任何多模态组合都高于任何单模态；等权 <b>8.54</b> 最高' },
      { t: '表 1 · Depth si-RMSE（越低越好）', mx: 1, g: ['Vis', 'Edge', 'Depth', 'Seg', '无 Vis', '无 Edge', '无 Depth', '无 Seg', '等权'], v: [0.49, 0.53, 0.49, 0.75, 0.57, 0.53, 0.52, 0.43, 0.47], hi: 7, msg: '正文说等权“深度重建最好”，但<b>无 Seg 的 0.43</b> 更低' },
      { t: '表 1 · 多样性 LPIPS', mx: 0.5, g: ['Vis', 'Edge', 'Depth', 'Seg', '无 Vis', '无 Edge', '无 Depth', '无 Seg', '等权'], v: [0.19, 0.28, 0.39, 0.42, 0.37, 0.31, 0.25, 0.23, 0.22], hi: 3, msg: '稀疏模态（Depth、Seg）多样性高，稠密的低' },
      { t: '表 3 · 机器人，质量分', mx: 11, g: ['Vis', 'Edge', 'Depth', 'Seg', 'Setting1', 'Setting2'], v: [9.11, 7.70, 9.17, 9.29, 9.57, 10.42], hi: 5, msg: '两种前景/背景设置排前两名' },
      { t: '表 3 · 机器人，前景 Mask mIoU', mx: 0.8, g: ['Vis', 'Edge', 'Depth', 'Seg', 'Setting1', 'Setting2'], v: [0.56, 0.57, 0.57, 0.54, 0.61, 0.63], hi: 5, msg: '机器人本身保得更好：0.54–0.57 → <b>0.61、0.63</b>' },
      { t: '表 4 · 自动驾驶，车道 mIoU', mx: 60, g: ['HDMap', 'LiDAR', '两者'], v: [50.37, 48.19, 51.55], hi: 2, msg: '融合后车道最好；3D 框 mAP 44.66 介于 41.89 和 46.50 之间' }
    ];
    let bars = [], last = -1;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = view; const v = T[view], Ng = v.g.length, gw = Math.min(4.2, 28 / Ng), w = Math.min(1.6, gw - 0.7);
      v.g.forEach((nm, i) => { const x = (i - (Ng - 1) / 2) * gw; sub.add(lab(nm, [x, -0.2, 2.4], { size: 18 }));
        const c = i === v.hi ? COL.gold : i < 4 && Ng > 3 ? COL.edge : COL.ok; const b = block(w, 1, w, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(v.v[i].toFixed(2), [x, 0, 0], { size: 17 }); sub.add(l); bars.push({ b, l, val: v.v[i] }); });
      sub.add(lab(v.t, [0, 8.6, 0], { size: 22, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const ctls = [{ label: '表', items: ['1 质量', '1 深度', '1 多样性', '3 质量', '3 前景', '4 车道'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const g = seg(p, 0, 0.5), mx = T[view].mx; bars.forEach(({ b, l, val }) => { const h = Math.max(0.02, val / mx * 7 * g); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.45; });
      cap(T[view].msg);
    } };
  }

  /* ---------- scene 11: 64 GPUs, head parallel + CFG split; Table 5 ---------- */
  function s11(G) {
    const NG = [1, 4, 8, 16, 32, 64], DIF = [141.0, 39.3, 20.1, 10.3, 5.4, 3.5], E2E = [141.7, 40.0, 20.8, 11.0, 6.1, 4.2];
    const gp = []; for (let g = 0; g < 64; g++) { const grp = g >> 5, k = g & 31, x = -13 + (k % 8) * 0.95 + grp * 8.4, y = 2 + Math.floor(k / 8) * 0.95; const b = block(0.8, 0.8, 0.8, grp ? COL.bad : COL.ok, [x, y, 0], { opacity: 0.95 }); G.add(b); gp.push(b); }
    G.add(lab('正提示：32 卡 = 32 个头', [-9.7, 6.4, 0], { size: 17 }), lab('负提示：32 卡 = 32 个头', [-1.3, 6.4, 0], { size: 17 }));
    const XB = 7.2; const bD = [], bE = [];
    NG.forEach((n, i) => { const x = XB + i * 1.6; const d = block(0.6, 1, 0.6, COL.edge, [x - 0.33, 0, 0], { edges: false }), e = block(0.6, 1, 0.6, COL.gold, [x + 0.33, 0, 0], { edges: false, opacity: 0.8 }); G.add(d, e, lab(n + ' 卡', [x, -0.5, 1.0], { size: 16 })); bD.push(d); bE.push(e); });
    G.add(lab('表 5：蓝 = 扩散，黄 = 端到端（秒，对数高）', [XB + 4, 9.2, 0], { size: 17 }));
    const vl = NG.map((n, i) => dynLab(G, [XB + i * 1.6, 7.9, 0], { size: 15 }));
    const a2a = stream(G, 16, COL.white, 0.09);
    return { update(p) {
      const k = Math.min(5, Math.floor(p * 6.4)), n = NG[k];
      gp.forEach((b, g) => { const on = n === 1 ? g === 0 : n < 64 ? ((g & 31) < n / 2 && (g >> 5) === 0) || ((g & 31) < n / 2 && (g >> 5) === 1) : true; b.material.opacity = on ? 0.95 : 0.15; b.material.transparent = true; glow(b, on ? 0.35 : 0); });
      NG.forEach((m, i) => { const hd = Math.log10(DIF[i] * 10) * 2.2, he = Math.log10(E2E[i] * 10) * 2.2; bD[i].scale.y = hd; bD[i].position.y = hd / 2; bE[i].scale.y = he; bE[i].position.y = he / 2; glow(bD[i], i === k ? 0.6 : 0.05); glow(bE[i], i === k ? 0.6 : 0.05); vl[i](i === k ? `${DIF[i]} / ${E2E[i]}` : ''); });
      a2a([[-13, 4.9, 0.6], [-6.4, 2.0, 0.6], [-4.6, 4.9, 0.6], [2.0, 2.0, 0.6]], (p * 5) % 1, n >= 32 ? 1 : 0);
      const sp = DIF[0] / DIF[k], ef = sp / n;
      cap(`<b>${n}</b> 卡：扩散 ${DIF[k]} s，端到端 ${E2E[k]} s · 加速 ${sp.toFixed(2)}×，效率 ${(ef * 100).toFixed(1)}% · 端到端 − 扩散 = <b>${(E2E[k] - DIF[k]).toFixed(1)} s</b>`);
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
  function go(i, p0 = 0, keepOpt = false) {
    cur = (i + SCENES.length) % SCENES.length; showInfo(cur);
    if (!S) return;
    L.clear(root); LABS = []; lastCap = null; if (!keepOpt) OPT = [];
    const sc = SCENES[cur], cam = document.body.classList.contains('embed') && sc.camE ? sc.camE : sc.cam; fly(...cam); refDist = cam[2] * aspectFix();
    const G = new THREE.Group(); root.add(G); pNow = p0; api = BUILD[cur](G);
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
  }
  $('ctl').addEventListener('click', e => { const b = e.target.closest('button[data-g]'); if (!b || !api?.ctls) return; const c = api.ctls[+b.dataset.g]; c.set(+b.dataset.k); api.update(pNow); $('scrub').value = Math.round(pNow * 1000); syncCtl(); });
  $('play').onclick = () => { if (!playing) t0 = performance.now() - pNow * SCENES[cur].dur * 1000; setPlay(!playing); };
  $('scrub').oninput = e => { setPlay(false); pNow = e.target.value / 1000; if (api) api.update(pNow); syncCtl(); };
  $('prev').onclick = () => go(cur - 1); $('next').onclick = () => go(cur + 1);
  btns.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); });
  stepsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; go(+b.dataset.i); if (!document.body.classList.contains('embed')) $('stage').scrollIntoView({ behavior: L.reduced() ? 'auto' : 'smooth', block: 'center' }); });
  document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' && e.key !== ' ') return; if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1); else if (e.key === ' ') { e.preventDefault(); $('play').click(); } });
  const s0 = clamp((parseInt(qs.get('scene'), 10) || 1) - 1, 0, SCENES.length - 1), pq = qs.get('p'); OPT = (qs.get('opt') || '').split(',');
  setPlay(playing && pq == null);
  go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0), true);
  window.__ct1Debug = { normW, get cap() { return $('cap').textContent; } };
})();
