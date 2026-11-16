'use strict';
/* MolmoAct2 (arXiv 2605.02881) taken apart into eleven animated scenes. Sizes and hyperparameters come from the paper (v2),
   the official code at commit 6070080 and the released MolmoAct2-LIBERO config.json. Each scene's update(p) is a pure
   function of the timeline p plus the current toggles. Scenes 4, 7 and 9 compute their numbers live on toy problems;
   those are toys and are labelled so. No MolmoAct2 network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { vlm: 0x5f8fe0, er: 0x38d1ff, pre: 0x9d8cff, post: 0xf0963c, ft: 0x4fc98a, think: 0xd45fa0, depth: 0xe8b84a, act: 0xf2c14e, img: 0x4fc98a, txt: 0x9d8cff, st: 0x7cb8ff, dim: 0x46506a, bad: 0xe05d5d, ok: 0x4fc98a, white: 0xeef2fa, grey: 0x6b7794, yam: 0xf0963c, so: 0x38d1ff, droid: 0x9d8cff, acad: 0x8e9bb8, mm: 0x4fc98a, tulu: 0xc9d4ea, gpt: 0x8e9bb8 };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  const SCENES = [
    { n: 1, part: '总览', title: '三段训练，两条分支', sub: 'Molmo2-ER → 预训练 → 后训练 → 微调；Think 版从预训练分叉', dur: 14, cam: [0.1, 1.12, 32, [-0.4, 3.6, 0]],
      html: dl([['骨干', 'Molmo2-4B → Molmo2-ER（2 万 + 1500 步）'], ['预训练', '20 万步，只学离散动作 token，5760 GPU 小时'], ['后训练', '10 万步，挂流匹配专家，2304 GPU 小时'], ['LIBERO 微调', '5 万步，取 4 万步（Think 版取 3 万）'], ['Think', '从同一个预训练检查点另做一次深度后训练']]) +
        '<p>上面一条是标准 MolmoAct2：先把 VLM 变成“会说动作”的离散 VLA，再挂连续动作专家，最后按本体微调。下面一条是 Think 版：同一个预训练检查点出发，后训练时多学深度 token，微调时多一个深度门。</p>' +
        '<p>复现 LIBERO 只需要最后一步：从发布的 <code>allenai/MolmoAct2</code>（或 <code>allenai/MolmoAct2-Think</code>）微调。前面几步作者都发布了检查点。</p>' +
        '<p>点画面里的方块可以跳到对应那一幕。</p>' + src('§2.2 · §4 · §4.1.2 · §4.2.2 · §4.3.1 · §5.2 · 表 16') },
    { n: 2, part: '§3 数据', title: '训练混合：三个平台各占三成', sub: '切换阶段，看采样比例怎么变', dur: 12, cam: [0.18, 1.12, 31, [0.6, 3.6, 0]],
      html: dl([['预训练', '多模态 10%，机器人 90%'], ['机器人内部', 'YAM 30%，SO-100/101 30%，DROID 30%，其余 10%'], ['多模态内部', 'Molmo2-ER 46%，Molmo2 46%，Tulu-3 8%'], ['LIBERO 微调', '只用 LIBERO，1693 条回合']]) +
        '<p>三根柱子是三个阶段的采样构成，高度 100%。后训练沿用预训练的数据构造，只是机器人批和多模态批分开、序列长不同（2100 对 4200）。微调只用目标数据，不混多模态。</p>' +
        '<p>右边四个方块按数据量画（对数比例）：BimanualYAM 34.5k 条 / 720 小时，SO-100/101 38,059 条 / 184 小时，DROID 74,604 条，LIBERO 1693 条。</p>' +
        src('§3 · §3.6 · §4.1.2 · 表 1 · 表 2 · MolmoAct2-LIBERO-Dataset info.json') },
    { n: 3, part: '§2 Molmo2-ER', title: '先专精，再复习：13 个基准', sub: '柱子是表 3：Molmo2 对 Molmo2-ER，可加 GPT-5', dur: 12, cam: [0.05, 1.2, 30, [0, 4.0, 0]],
      html: dl([['阶段 1', '2 万步，ER 语料 + 8% 文本，序列 4200，批 64'], ['阶段 2', '1500 步，ER 和通用数据各半（p = 0.5），序列 16384'], ['平均', 'Molmo2 46.8 → Molmo2-ER 63.8'], ['对开放模型', '13 项中 9 项最高'], ['算上 API', '只有 5 项最高']]) +
        '<p>阶段 1 把模型推到具身数据上，指点和视频问答迅速上升；阶段 2 把通用数据混回来，防止通用能力退化。p 扫了 0.3、0.5、0.7、0.9。</p>' +
        '<p>打开 GPT-5 可以看到：ERQA、SAT、OpenEQA 这些问答类，Molmo2-ER 仍落后；指点类（Point-Bench、RoboSpatial-Point、Where2Place）大幅领先。</p>' +
        src('§2.2 · 表 3 · 我的核算见精读读者注 11') },
    { n: 4, part: '§4.1.1 分词', title: '一秒动作变成几个 token', sub: 'DCT 当场算：先变换，再量化，大部分系数变成 0', dur: 14, cam: [0.32, 1.02, 25, [0, 2.0, 0]],
      html: dl([['输入', '一秒动作块；LIBERO 是 10 步 × 7 维，补零到 32 维'], ['归一化', '1%–99% 分位数，夹爪另算'], ['变换', '每一维沿时间做 DCT'], ['量化', '乘尺度后取整'], ['压缩', 'BPE，词表 2048']]) +
        '<p>FAST 的想法：平滑的轨迹在频域里集中在少数低频系数，量化后高频几乎都是 0，再用 BPE 把常见的数串合并成一个 token。MolmoAct2-FAST 沿用这个方法，区别是训练数据混合公开（表 2）。</p>' +
        '<p>三段动画：原始动作（柱高是归一化动作）→ DCT 系数 → 量化后的整数（灰色是 0）。切换量化尺度看非零个数怎么变。</p>' +
        toyb('轨迹是我编的平滑曲线，DCT（正交 DCT-II）和取整是当场算的。量化尺度和 BPE 的合并是示意，真实 tokenizer 的输出长度要用 allenai/MolmoAct2-FAST-Tokenizer 才能算。') +
        src('§4.1.1 · 附录 B.2 · FAST（2501.09747）') },
    { n: 5, part: '§4.1.2 序列', title: '一个机器人样本长什么样，怎样打包', sub: '切换：单个样本 / 打包进 2100 / 预训练的 4200', dur: 13, cam: [0.06, 1.28, 30, [0, 4.0, 0]],
      html: dl([['顺序', '图像 → 任务 → setup → state → control → 触发 → 目标'], ['setup', '&lt;setup_start&gt;single franka robotic arm in libero&lt;setup_end&gt;'], ['control', '&lt;control_start&gt;delta end-effector pose&lt;control_end&gt;'], ['state', '8 维，每维一个 &lt;state_k&gt;，k ∈ 0…255'], ['触发', '&lt;action_output&gt;，Think 版是 &lt;depth_output&gt;&lt;action_output&gt;']]) +
        '<p>和 VLM 预训练用的完全是同一个下一个 token 接口：机器人样本只是多了状态和动作 token。所以多模态数据可以直接混进来。</p>' +
        '<p>打包：多个短样本拼成一条固定长度的序列，同一次前向，但块对角的注意力掩码让它们互不可见。打包时“批 64”是 64 条打包序列，不是 64 个样本。</p>' +
        guess('每张图约 196 个视觉 token 是我按 378/14 = 27、27×27 块、2×2 池化估的；任务文字、动作 token 的长度也是估的。论文没给 LIBERO 样本的确切长度。') +
        src('§4.1.2 · 附录 A.1 · 附录 B.1 · 式 (23) · experiments/README.md “Packing And Training Budget”') },
    { n: 6, part: '§4.2.1 逐层 KV', title: '专家的每一层都读 VLM 同一层的 K 和 V', sub: '这一幕是核心。切换三种接法，看连线和表 11 的分数', dur: 15, cam: [0.42, 1.08, 31, [0, 5.0, 0]], camE: [0.42, 1.08, 31, [0, 6.0, 0]],
      html: dl([['VLM', '36 层，8 个 KV 头 × 128 维 = 1024'], ['适配', 'P_K、P_V：1024 → 768'], ['专家', '36 块，8 头 × 96 维 = 768'], ['式 (7)', 'softmax(Q K̃ᵀ / √96) Ṽ'], ['表 11', '隐状态 94.0 · 逐头 94.8 · 逐层 KV 95.9']]) +
        '<p>常见做法是把 VLM 最后一层的隐状态投影过去，所有专家层都看这一份。MolmoAct2 让专家第 ℓ 块交叉注意到 VLM 第 ℓ 层自注意力用的 K、V，两边一样深（36 层），一一对应。</p>' +
        '<p>“逐头”变体不把 8 个头拼起来投影，而是每个 VLM KV 头只投到对应的专家头，要求头数相等（都是 8）。它比逐层 KV 低 1.1 个点。</p>' +
        '<p>表 11 的三行都从预训练检查点直接挂专家（没有后训练），所以最好也只有 95.9，低于最终的 97.2。</p>' +
        src('§4.2.1 式 (3)–(7) · 附录 A.2 · 表 11 · 表 15 · config.json') },
    { n: 7, part: '§4.2 流匹配', title: '从噪声积分出一段动作', sub: '玩具：两种走法的动作分布，速度场用解析最优解', dur: 15, cam: [0.05, 1.22, 24, [0, 3.6, 0]],
      html: dl([['式 (1)', 'x_t = (1−t)ε + t a，u* = a − ε'], ['式 (8)', '每块 K 个 (ε, t)，微调 K = 8'], ['t 的分布', '0.001 + 0.999·Beta(1, 1.5)（代码）'], ['式 (15)', '欧拉 N = 10 步，t: 0 → 1']]) +
        '<p>训练时随机取 t，把真实动作块和噪声按 t 混合，让专家预测从噪声指向数据的方向 a − ε。推理时从纯噪声出发，按预测的速度走 10 步。</p>' +
        '<p>底下的刻度是按代码的 Beta(1, 1.5) 抽的 8 个 t（同一个动作块的 K = 8 个训练点），偏向噪声多的一端。</p>' +
        toyb('目标分布是两条我设的轨迹（同一任务的两种走法），各占一半。对这种离散分布，最优速度场可以写成解析式：后验加权的 (a_k − x)/(1 − t)。这里画的是这个解析场，不是网络。切换步数看 1 步和 10 步的差别：1 步只能走到两条的平均。') +
        src('§4.2.1 式 (1)(2) · §4.2.2 式 (8) · 附录 A.2 式 (15) · molmoact2.py _sample_beta_timesteps') },
    { n: 8, part: '§4.2.2 损失', title: '两个输出口一起训，梯度往哪流', sub: '切换后训练（知识隔离）和微调（不隔离）', dur: 13, cam: [0.1, 1.2, 31, [1.6, 4.4, 0]],
      html: dl([['式 (9)', 'L = L_LM + L_flow，等权'], ['屏蔽', '离散动作 token 对专家不可见'], ['后训练', 'K、V detach：L_flow 只更新专家和 P_K、P_V'], ['微调', '不 detach：L_flow 也更新 VLM'], ['表 13', '离散共训 + 不隔离 + 全量 = 97.20']]) +
        '<p>同一个机器人样本，LLM 头预测 MolmoAct2-FAST 的离散动作 token，专家预测连续动作块。离散 token 是专家要预测的东西的另一种写法，所以从专家的条件路径里屏蔽掉，否则专家会“抄答案”。</p>' +
        '<p>后训练用知识隔离：流损失的梯度在 K、V 处截断，VLM 只被语言模型损失更新。微调去掉隔离，论文说隔离在这一阶段没有稳定收益（表 13 第二行 97.05 对 97.20）。</p>' +
        '<p>代码里隔离是 <code>--action_expert_detach_vlm</code>，默认关，README 的后训练命令也没开（见精读读者注 6）。</p>' +
        guess('流动的粒子只示意梯度方向。右边柱子是表 13 的五行平均。') +
        src('§4.2.2 式 (9) · §4.3.1 · 表 13 · trainer.py 1832–1853 行') },
    { n: 9, part: '§5 自适应深度', title: '只重算变了的格子', sub: '玩具画面当场算 32×32 块的余弦，切换阈值', dur: 16, cam: [0.12, 1.12, 25, [-1.0, 3.0, 0]],
      html: dl([['网格', '10×10，每格一个深度码（0–127）'], ['式 (10)', 'cos(x_t,i, x_t−1,i) &lt; 0.996 才更新'], ['首帧', '100 个全部解码'], ['之后', '变了的格子 argmax 解码，其余从缓存回放'], ['代码', '_DEPTH_REASONING_THRESHOLD = 0.996']]) +
        '<p>左边是当前帧的玩具画面，右边是 10×10 的深度码柱。亮色的柱子是这一步要重新解码的格子，灰色的是直接从上一步缓存回放的。读数是这一步要逐个解码的 token 数。</p>' +
        '<p>夹爪移动时只有它经过的几列变化，所以每步只需解码十几个 token，而不是 100 个。这正是 Think 版比 MolmoAct 每步都预测完整深度省时间的来源。</p>' +
        toyb('画面是合成的：渐变背景、一个移动的夹爪、一个最后被推动的方块。余弦和阈值判断当场算；深度码是把合成深度线性量化成 128 级，不是 VQ-VAE 的输出。阈值 0.996 时，背景完全不变的格子余弦正好是 1。') +
        src('§5 · §5.1 式 (10) · §5.3 · modeling_molmoact2.py 86–87 行') },
    { n: 10, part: '§5.2 深度门', title: 'Think-LIBERO 微调多出来的三件事', sub: '拖偏置看门值；注噪和混合训练', dur: 14, cam: [0.1, 1.15, 31, [0, 4.0, 0]],
      html: dl([['式 (11)', 'g_ℓ = σ(w_ℓᵀ c_ℓ + b_ℓ)，c_ℓ 是非深度上下文的 V 平均'], ['式 (12)', '只缩放深度位置的 K、V'], ['初值', 'b = −4 → σ(−4) = 0.018'], ['注噪', '10% 的深度输入码换成随机码'], ['混合', '只出动作 : 先深度再动作 = 1 : 1']]) +
        '<p>推理时专家看到的是模型自己预测的深度，不是真值，所以训练时故意往深度前缀里掺 10% 的随机码，目标不变。门从很小开始，让微调起步时接近不用深度的路径，再逐层学要用多少。</p>' +
        '<p>表 14：三样全开 98.10；去掉注噪和门 97.65（Goal 少 1.8）；再去掉混合训练 97.50。</p>' +
        '<p>复现注意：train_lerobot.py 的两个门开关默认关，README 的深度微调命令没开，要自己加 <code>--action_expert_depth_gate=true --action_expert_depth_gate_per_layer=true</code>。</p>' +
        guess('36 层各自的 wᵀc 是我设的玩具数，用来显示“每层门值不同”；只有偏置 −4 和 σ 的形式来自论文。100 个深度码里哪 10 个被替换是随机的。') +
        src('§5.2 式 (11)(12) · 表 14 · Think-LIBERO config.json · train_lerobot.py 264–278 行') },
    { n: 11, part: '§6 LIBERO', title: '部署节奏、速度和分数', sub: '切换：执行节奏 / 图 8 速度 / 表 8 分数', dur: 14, cam: [0.05, 1.22, 30, [0, 4.2, 0]],
      html: dl([['控制', '10 Hz，块长 10，10 步全执行再查询'], ['速度', '55.79 Hz（179 ms / 块）；Think 12.71 Hz（787 ms）'], ['评测', '4 套件 × 10 任务 × 50 次 = 2000，种子 1000'], ['最长步数', 'Spatial / Object 280，Goal 300，Long 520'], ['分数', 'MolmoAct2 97.2，Think 98.1']]) +
        '<p>每次查询：两张图（前视、手腕）和 8 维状态进模型，专家 10 步欧拉出一块 10 个动作，开环执行 1 秒再查下一块。所以 55.79 Hz 是按块摊薄的吞吐，块内不能对扰动反应（附录 E）。</p>' +
        '<p>分数视图里每个套件两根柱：MolmoAct2 和 Think 版。表 8 的 Think 版 Goal 写 98.5，500 次不可能，这里按表 14 画 98.4（精读读者注 13）。</p>' +
        src('§4.3.1 · §6.3 表 8 · §6.4 · §6.8 图 8 · 附录 E · lerobot molmoact2-hf-inference README、envs/libero.py') }
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
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.3, phi: 1.0, dist: 26, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);
  let LABS = [], refDist = 26, PICKS = [];
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  /* a label whose text changes: rebuild only when the text differs */
  function dynLab(G, pos, o = {}) {
    const st = { s: null, t: null };
    return t => { if (t === st.t) return; if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; st.s = lab(t, pos, o); G.add(st.s); };
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.14) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.5, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  function ribbon(G, n, color, w = 0.06, o = {}) {
    const pos = new Float32Array(n * 6), idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: o.opacity ?? 1 })); m.frustumCulled = false; m.renderOrder = o.order ?? 2; G.add(m);
    m.userData.set = pts => { const k = Math.min(n, pts.length); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)], z = q[2] ?? 0; pos[i * 6] = q[0]; pos[i * 6 + 1] = q[1] - w / 2; pos[i * 6 + 2] = z; pos[i * 6 + 3] = q[0]; pos[i * 6 + 4] = q[1] + w / 2; pos[i * 6 + 5] = z; } g.attributes.position.needsUpdate = true; };
    return m;
  }
  function panel(G, x, y, z, w, h, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: o.color ?? 0x0c1220, transparent: true, opacity: o.opacity ?? 0.55, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }
  /* a vertical bar whose height is set later */
  function bar(G, x, z, w, color, o = {}) { const m = block(w, 1, o.d ?? w, color, [x, 0.5, z], { edges: false }); G.add(m); m.userData.set = h => { const v = Math.max(0.001, h); m.scale.y = v; m.position.y = (o.y0 ?? 0) + v / 2; }; return m; }

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

  /* ---------- scene 1: the training pipeline ---------- */
  function s1(G) {
    const top = [['Molmo2-4B', -11.2, COL.vlm, '出发点', 2], ['Molmo2-ER', -6.6, COL.er, '2 万 + 1500 步', 2], ['预训练', -2.0, COL.pre, '20 万步 · 离散动作', 3], ['后训练', 2.6, COL.post, '10 万步 · +专家', 5], ['LIBERO 微调', 7.2, COL.ft, '5 万步 → 取 4 万', 10]];
    const bot = [['深度后训练', 2.6, COL.think, '10 万步 · +深度', 8], ['Think-LIBERO', 7.2, COL.think, '5 万步 → 取 3 万', 9]];
    const B = top.map(([t, x, c, s, go]) => { const b = block(3.6, 1.6, 1.8, c, [x, 6.0, 0]); G.add(b, lab(t, [x, 7.4, 0], { size: 22 }), lab(s, [x, 4.75, 0.9], { size: 17 })); b.userData.go = go; PICKS.push(b); return b; });
    const D = bot.map(([t, x, c, s, go]) => { const b = block(3.6, 1.6, 1.8, c, [x, 1.4, 0]); G.add(b, lab(t, [x, 2.8, 0], { size: 22 }), lab(s, [x, 0.15, 0.9], { size: 17 })); b.userData.go = go; PICKS.push(b); return b; });
    G.add(lab('5760 GPU 小时', [-2.0, 9.0, 0], { size: 18 }), lab('2304 GPU 小时', [2.6, 9.0, 0], { size: 18 }), lab('1152（论文写法）', [7.2, 9.0, 0], { size: 18 }));
    G.add(lab('标准 MolmoAct2', [-9.0, 10.3, 0], { size: 21, color: '#38d1ff' }), lab('Think 分支', [-4.6, 1.4, 0], { size: 21, color: '#e88fc6' }));
    wire(G, [[-2.0, 5.2, 0], [-2.0, 1.4, 0], [0.8, 1.4, 0]], COL.think, { opacity: 0.6, dashed: true });
    const f1 = stream(G, 6, COL.white, 0.16), f2 = stream(G, 4, COL.think, 0.16);
    G.add(lab('Hub 上都有：Molmo2-ER · MolmoAct2-Pretrain · MolmoAct2 · MolmoAct2-Think\nMolmoAct2-LIBERO · MolmoAct2-Think-LIBERO', [-0.4, -1.9, 1.5], { size: 16 }));
    return { update(p) {
      const k = clamp(p * 1.15, 0, 1) * 5; B.forEach((b, i) => glow(b, k > i ? 0.55 : 0.05));
      const kb = clamp((p - 0.45) / 0.45, 0, 1) * 2; D.forEach((b, i) => glow(b, kb > i ? 0.55 : 0.05));
      f1([[-11.2, 6.9, 1.0], [7.2, 6.9, 1.0]], (p * 3) % 1, 1);
      f2([[-2.0, 5.2, 0.6], [-2.0, 2.3, 0.6], [7.2, 2.3, 0.6]], (p * 3) % 1, p > 0.45 ? 1 : 0);
      cap(p < 0.45 ? '标准路线：Molmo2-ER → <b>预训练</b>（只学离散动作 token）→ <b>后训练</b>（挂流匹配专家）→ <b>按本体微调</b>' : 'Think 分支从<b>同一个预训练检查点</b>出发，后训练时多学深度 token；复现 LIBERO 只需最后一步');
    } };
  }

  /* ---------- scene 2: the data mixture ---------- */
  function s2(G) {
    let stage = 0; G.add(L.grid(30, 30));
    const MIX = [
      { t: '预训练 / 后训练', parts: [['YAM 27%', 27, COL.yam], ['SO-100/101 27%', 27, COL.so], ['DROID 27%', 27, COL.droid], ['学术 9%', 9, COL.acad], ['多模态 10%', 10, COL.mm]] },
      { t: '多模态内部（表 1）', parts: [['Molmo2-ER 46%', 46, COL.er], ['Molmo2 46%', 46, COL.vlm], ['Tulu-3 8%', 8, COL.tulu]] },
      { t: 'LIBERO 微调', parts: [['LIBERO 100%', 100, COL.ft]] }
    ];
    const H = 8, stacks = [];
    MIX.forEach((m, j) => {
      const x = -10 + j * 5.2, segs = [];
      let y = 0; m.parts.forEach(([t, v, c]) => { const b = block(2.4, 1, 2.0, c, [x, 0, 0], { edges: false }); G.add(b); segs.push({ b, v, y0: y, t }); y += v; });
      const ls = m.parts.map(([t, v], i) => { const y0 = segs[i].y0 + v / 2; const l = lab(t, [x + 2.6, y0 / 100 * H, 0.2], { size: 17 }); G.add(l); return l; });
      G.add(lab(m.t, [x, -0.9, 1.6], { size: 19 }));
      stacks.push({ segs, ls, x });
    });
    const sz = [['BimanualYAM', 34500, COL.yam, '34.5k 条 · 720 h'], ['SO-100/101', 38059, COL.so, '38,059 条 · 184 h'], ['DROID', 74604, COL.droid, '74,604 条'], ['LIBERO', 1693, COL.ft, '1693 条 · 27.3 万帧']];
    const cubes = sz.map(([t, n, c, s], i) => { const e = Math.log10(n) / Math.log10(74604) * 2.2; const b = block(e, e, e, c, [6.4 + (i % 2) * 4.8, 0, (i < 2 ? -3.2 : 3.0)]); G.add(b, lab(t + '\n' + s, [6.4 + (i % 2) * 4.8, e + 1.6, (i < 2 ? -3.2 : 3.0)], { size: 16 })); b.userData.e = e; return b; });
    const ctls = [{ label: '突出', items: ['预训练', '多模态', 'LIBERO'], get: () => stage, set: k => { stage = k; } }];
    return { ctls, update(p) {
      const g = seg(p, 0, 0.6);
      stacks.forEach((st, j) => { st.segs.forEach(s => { const h = Math.max(0.01, s.v / 100 * H * g); s.b.scale.y = h; s.b.position.y = s.y0 / 100 * H * g + h / 2; glow(s.b, j === stage ? 0.35 : 0); }); st.ls.forEach((l, i) => { l.position.y = (st.segs[i].y0 + st.segs[i].v / 2) / 100 * H * g; l.visible = g > 0.3; }); });
      cubes.forEach(c => { const e = c.userData.e * seg(p, 0.2, 0.8); c.scale.setScalar(Math.max(0.01, e / c.userData.e)); c.position.y = e / 2; });
      cap(['预训练采样：多模态 <b>10%</b>，机器人 <b>90%</b>（YAM、SO-100/101、DROID 各占机器人部分的 30%）', '多模态部分：Molmo2-ER <b>46%</b>，Molmo2 <b>46%</b>，Tulu-3 文本 <b>8%</b>（表 1 权重）', 'LIBERO 微调只用 LIBERO：<b>1693</b> 条回合、<b>273,465</b> 帧，四个套件合训一个模型'][stage]);
    } };
  }

  /* ---------- scene 3: Molmo2-ER benchmark bars ---------- */
  function s3(G) {
    let showGpt = 0; G.add(L.grid(34, 30));
    const names = ['Point', 'RefSp', 'RS-Pt', 'W2P', 'BLINK', 'CV', 'ERQA', 'EmbSp', 'Mind', 'RS-VQA', 'SAT', 'OEQA', 'VSI', '平均'];
    const M2 = [76.9, 52.5, 13.9, 18.0, 50.8, 64.4, 46.3, 67.0, 37.6, 57.9, 50.0, 46.9, 26.1, 46.8];
    const ER = [77.3, 52.5, 32.0, 54.0, 72.5, 87.8, 46.8, 78.8, 57.0, 73.4, 78.0, 44.7, 74.5, 63.8];
    const GP = [43.6, 23.5, 19.0, 37.0, 71.3, 86.1, 59.0, 81.5, 58.0, 69.3, 86.7, 64.4, 52.9, 57.9];
    const W = 2.05, Hs = 8 / 100, bars = [];
    names.forEach((nm, i) => {
      const x = (i - 6.5) * W; G.add(lab(nm, [x, -0.5, 1.8], { size: 16 }));
      const a = bar(G, x - 0.55, 0, 0.5, COL.vlm), b = bar(G, x, 0, 0.5, COL.er), c = bar(G, x + 0.55, 0, 0.5, COL.gpt);
      const la = lab(ER[i].toFixed(1), [x, 0, 0.4], { size: 15 }); G.add(la);
      bars.push({ a, b, c, la, i });
    });
    G.add(lab('■ Molmo2', [-12, 9.6, 0], { size: 19, color: css(COL.vlm) }), lab('■ Molmo2-ER', [-8.4, 9.6, 0], { size: 19, color: css(COL.er) }), lab('■ GPT-5', [-4.8, 9.6, 0], { size: 19, color: '#aab4c8' }));
    const ctls = [{ label: '对照', items: ['只看 Molmo2', '加 GPT-5'], get: () => showGpt, set: k => { showGpt = k; } }];
    return { ctls, update(p) {
      const g = seg(p, 0, 0.55);
      bars.forEach(({ a, b, c, la, i }) => { a.userData.set(M2[i] * Hs * g); b.userData.set(ER[i] * Hs * g); c.userData.set(showGpt ? GP[i] * Hs * g : 0.001); c.visible = !!showGpt; la.position.y = ER[i] * Hs * g + 0.5; });
      cap(showGpt ? '对 GPT-5：Molmo2-ER 赢 <b>8</b> 项；问答类（ERQA、SAT、OpenEQA）落后，指点类大幅领先' : '13 个基准平均 <b>46.8 → 63.8</b>（+17.0 个点）；RoboSpatial-Point、Where2Place、VSI 涨得最多');
    } };
  }

  /* ---------- scene 4: DCT tokenisation, computed ---------- */
  function s4(G) {
    let qi = 1; const QS = [4, 10, 25];
    const T = 10, D = 7;
    /* a smooth toy trajectory, normalised to [-1, 1]; the gripper (dim 6) is a step */
    const A = []; for (let t = 0; t < T; t++) { const u = t / (T - 1); A.push([0.6 * Math.sin(1.4 * u + 0.3), -0.4 + 0.8 * u * u, 0.3 * Math.cos(2.0 * u), 0.15 * u, -0.1 + 0.2 * Math.sin(3 * u), 0.05 * Math.cos(u), u < 0.55 ? -1 : 1]); }
    const dct = x => { const N = x.length, o = []; for (let k = 0; k < N; k++) { let s = 0; for (let n = 0; n < N; n++) s += x[n] * Math.cos(Math.PI / N * (n + 0.5) * k); o.push(s * Math.sqrt((k === 0 ? 1 : 2) / N)); } return o; };
    const C = []; for (let d = 0; d < D; d++) { const col = dct(A.map(r => r[d])); for (let k = 0; k < T; k++) { C[k] = C[k] || []; C[k][d] = col[k]; } }
    const N = T * D, im = inst(BOX, N); G.add(im); G.add(L.grid(20, 20));
    const X = d => (d - 3) * 1.25, Z = t => (t - 4.5) * 1.05;
    for (let d = 0; d < D; d++) G.add(lab(d < 6 ? ['x', 'y', 'z', 'rx', 'ry', 'rz'][d] : '夹爪', [X(d), -0.2, Z(T - 1) + 1.6], { size: 16 }));
    G.add(lab('时间 →（10 步 = 1 秒）', [X(0) - 3.2, 0.2, 0], { size: 17 }), lab('补零维 8–32 未画', [X(6) + 2.6, 0.3, Z(0)], { size: 15 }));
    const title = dynLab(G, [0, 6.6, 0], { size: 22, border: 'rgba(56,209,255,.7)' });
    const ctls = [{ label: '量化尺度', items: ['4', '10', '25'], get: () => qi, set: k => { qi = k; } }];
    return { ctls, update(p) {
      const q = QS[qi], st = p < 0.33 ? 0 : p < 0.66 ? 1 : 2, mix = st === 0 ? 0 : seg(p, 0.33, 0.45);
      let nz = 0;
      for (let t = 0; t < T; t++) for (let d = 0; d < D; d++) {
        const i = t * D + d, a = A[t][d], c = C[t][d], qv = Math.round(c * q);
        let v = st === 0 ? a : st === 1 ? L.lerp(a, c, mix) : qv / q; if (st === 2 && qv !== 0) nz++;
        const h = Math.max(0.03, Math.abs(v) * 2.2), y = v >= 0 ? h / 2 : -h / 2 + 0.02;
        setI(im, i, [X(d), y + 0.02, Z(t)], [0.9, h, 0.8]);
        const zero = st === 2 && qv === 0, col = zero ? [0.3, 0.33, 0.4] : v >= 0 ? hex3(COL.st) : hex3(COL.post);
        colI(im, i, col);
      }
      done(im);
      title(st === 0 ? '① 归一化动作 a（10 × 7）' : st === 1 ? '② 沿时间做 DCT：能量集中到低频（靠前几行）' : `③ ×${q} 取整：70 个系数里 ${nz} 个非零`);
      cap(st < 2 ? '每一维沿时间做离散余弦变换；平滑轨迹的高频系数很小' : `尺度 ${q}：非零 <b>${nz}</b> / 70，剩下的整数串再用 BPE 压成 token（词表 2048）。尺度越大越精确、token 越多`);
    } };
  }

  /* ---------- scene 5: sequence layout and packing ---------- */
  function s5(G) {
    let mode = 0;
    const SEG = [['前视图 ~196', 196, COL.img], ['手腕图 ~196', 196, COL.img], ['任务 ~25', 25, COL.txt], ['setup ~12', 12, COL.grey], ['state 8', 8, COL.st], ['control ~8', 8, COL.grey], ['触发 1', 1, COL.act], ['动作 token ~30', 30, COL.post]];
    const sub = new THREE.Group(); G.add(sub); let built = -1;
    const XW = 26;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); built = mode;
      const cap0 = mode === 2 ? 4200 : 2100, sample = SEG.reduce((a, s) => a + s[1], 0);
      if (mode === 0) {
        let x = -XW / 2; const k = XW / sample;
        const cx = [];
        SEG.forEach(([t, n, c]) => { const w = n * k; const b = block(Math.max(0.12, w - 0.04), 1.2, 1.2, c, [x + w / 2, 5.0, 0]); sub.add(b); cx.push(x + w / 2); x += w; });
        /* the six short segments sit at the right end; fan their labels out so they do not collide */
        const lx = cx.slice(); for (let i = lx.length - 2; i >= 2; i--) lx[i] = Math.min(lx[i], lx[i + 1] - 3.3);
        SEG.forEach(([t], i) => { const up = i < 2 ? 6.5 : (i % 2 ? 7.4 : 2.6); const yy = i < 2 ? 6.5 : up; sub.add(lab(t, [lx[i], yy, 0.2], { size: 15 })); if (i >= 2) sub.add(L.line([[cx[i], i % 2 ? 5.6 : 4.4, 0.6], [lx[i], yy + (i % 2 ? -0.4 : 0.4), 0.2]], COL.grey, { opacity: 0.7 })); });
        sub.add(lab(`一个 LIBERO 样本 ≈ ${sample} token（估算）`, [-4, 9.2, 0], { size: 20, border: 'rgba(56,209,255,.7)' }));
        sub.add(lab('训练目标只在“动作 token”上算交叉熵；专家看不到这一段', [-4, 1.2, 0], { size: 16 }));
      } else {
        const k = XW / cap0, nS = Math.floor(cap0 / sample); let x = -XW / 2;
        for (let s = 0; s < nS; s++) { const w = sample * k; const b = block(w - 0.1, 1.2, 1.2, [COL.ft, COL.er, COL.pre, COL.post, COL.think, COL.so, COL.yam, COL.droid, COL.acad, COL.depth][s % 10], [x + w / 2, 7.2, 0]); sub.add(b); sub.add(lab(`样本 ${s + 1}`, [x + w / 2, 8.4, 0], { size: 15 })); x += w; }
        const padW = XW / 2 - x; if (padW > 0.05) { const b = block(padW, 1.2, 1.2, COL.dim, [x + padW / 2, 7.2, 0], { opacity: 0.4 }); sub.add(b); }
        /* the block-diagonal attention mask, as a small grid */
        const M = 24, cell = 0.36, ox = -M * cell / 2, oy = 0.6, per = sample / cap0 * M;
        const im = inst(BOX, M * M); sub.add(im);
        for (let r = 0; r < M; r++) for (let c = 0; c < M; c++) { const sr = Math.floor(r / per), sc = Math.floor(c / per); const on = sr === sc && sr < nS && c <= r; setI(im, r * M + c, [ox + c * cell, oy + (M - 1 - r) * cell * 0.22, 0], [cell * 0.9, cell * 0.2, 0.15]); colI(im, r * M + c, on ? hex3(COL.er) : [0.16, 0.19, 0.26]); }
        done(im); sub.add(lab('注意力掩码（块对角 + 因果）', [0, 6.3 - 0.1, 2.2], { size: 16 }));
        sub.add(lab(`${cap0} token 里放下 ${nS} 个样本`, [0, 9.6, 0], { size: 20, border: 'rgba(56,209,255,.7)' }));
      }
    }
    rebuild();
    const ctls = [{ label: '视图', items: ['单个样本', '打包进 2100', '预训练 4200'], get: () => mode, set: k => { mode = k; } }];
    const fl = stream(G, 10, COL.white, 0.12);
    return { ctls, update(p) {
      if (built !== mode) rebuild();
      fl([[-XW / 2, mode ? 7.2 : 5.0, 0.9], [XW / 2, mode ? 7.2 : 5.0, 0.9]], (p * 2) % 1, 1);
      cap(mode === 0 ? '图像、任务、本体和控制描述、离散状态、触发 token，然后是目标：<b>和 VLM 预训练同一个下一个 token 接口</b>' : mode === 1 ? '微调 2100 token 一条：放几个样本取决于样本长短。<b>批 64 = 64 条打包序列</b>，不是 64 个样本' : '预训练 4200 token 一条，多模态样本也一起打包；后训练的多模态批仍是 4200');
    } };
  }

  /* ---------- scene 6: per-layer KV conditioning ---------- */
  function s6(G) {
    let mode = 0; const NL = 36, dy = 0.3;
    const vl = [], ex = [];
    for (let l = 0; l < NL; l++) { const y = 0.4 + l * dy; const a = block(4.2, 0.18, 2.2, COL.vlm, [-6, y, 0], { edges: false }); const b = block(2.6, 0.18, 1.6, COL.post, [6, y, 0], { edges: false }); G.add(a, b); vl.push(a); ex.push(b); }
    G.add(lab('VLM（Molmo2-ER LLM）36 层 · 宽 2560 · KV 8×128\n输入：图像 + 任务 + 状态', [-6, -1.2, 1.6], { size: 17 }), lab('动作专家 36 块 · 宽 768 · 8×96\n输入：带噪动作块 10×32', [6, -1.2, 1.6], { size: 17 }));
    G.add(lab('P_K, P_V：1024 → 768', [0, 11.6, 0], { size: 18, border: 'rgba(240,150,60,.8)' }));
    /* connection lines: one per layer; rebuilt by mode */
    const links = new THREE.Group(); G.add(links); let built = -1;
    function rebuild() {
      L.clear(links); built = mode;
      for (let l = 0; l < NL; l++) {
        const yE = 0.4 + l * dy, yV = mode === 2 ? 0.4 + (NL - 1) * dy : yE;
        if (mode === 1) { for (let h = 0; h < 8; h++) { const z = -0.7 + h * 0.2; links.add(L.line([[-3.9, yV, z], [4.7, yE, z]], COL.act, { opacity: 0.12 })); } }
        else links.add(L.line([[-3.9, yV, 0], [4.7, yE, 0]], mode === 2 ? COL.grey : COL.act, { opacity: 0.45 }));
      }
    }
    rebuild();
    const pk = stream(G, 8, COL.act, 0.12);
    const SC = [['逐层 KV', 95.9], ['逐头逐层 KV', 94.8], ['隐状态', 94.0]];
    const ctls = [{ label: '接法', items: ['逐层 KV（采用）', '逐头逐层 KV', '最后一层隐状态'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      if (built !== mode) rebuild();
      const l = Math.floor(p * NL * 0.999), yE = 0.4 + l * dy, yV = mode === 2 ? 0.4 + (NL - 1) * dy : yE;
      vl.forEach((m, i) => glow(m, i === l || (mode === 2 && i === NL - 1) ? 0.9 : 0.05)); ex.forEach((m, i) => glow(m, i === l ? 0.9 : i < l ? 0.25 : 0.03));
      pk([[-3.9, yV, 0.3], [4.7, yE, 0.3]], (p * 30) % 1, 1);
      cap(`专家第 <b>${l + 1}</b> 块 ← ${mode === 2 ? 'VLM <b>最后一层</b>的隐状态' : `VLM 第 <b>${l + 1}</b> 层的 K、V`}${mode === 1 ? '（每个 KV 头只投到对应的专家头）' : ''} · 表 11 平均 <b>${SC[mode][1]}</b>`);
    } };
  }

  /* ---------- scene 7: flow matching on a toy two-mode action distribution ---------- */
  function s7(G) {
    let ni = 2; const NS = [1, 2, 10];
    const H = 10, modes = [Array.from({ length: H }, (_, i) => 1.4 * Math.sin(i / (H - 1) * 2.4)), Array.from({ length: H }, (_, i) => -1.2 + 0.25 * i)];
    const r = L.rng(4), NSAMP = 6, eps = Array.from({ length: NSAMP }, () => Array.from({ length: H }, () => L.gauss(r)));
    /* exact velocity for a mixture of two point masses: posterior-weighted (a_k - x)/(1 - t) */
    function vel(x, t) { const s = Math.max(1e-3, 1 - t); const lw = modes.map(a => { let d = 0; for (let i = 0; i < H; i++) d += (x[i] - t * a[i]) ** 2; return -d / (2 * s * s); }); const m = Math.max(...lw), w = lw.map(v => Math.exp(v - m)), Z = w[0] + w[1]; return x.map((xi, i) => (w[0] * (modes[0][i] - xi) + w[1] * (modes[1][i] - xi)) / Z / s); }
    function integrate(e, N) { const path = [e.slice()]; let z = e.slice(); for (let k = 0; k < N; k++) { const t = k / N, v = vel(z, t); z = z.map((zi, i) => zi + v[i] / N); path.push(z.slice()); } return path; }
    const paths = {}; NS.forEach(N => { paths[N] = eps.map(e => integrate(e, N)); });
    const X0 = -9, W = 18, YC = 4.4, SY = 1.5, px = i => X0 + W * i / (H - 1), py = v => YC + v * SY;
    panel(G, X0 - 0.5, YC - 3.6, -0.3, W + 1, 7.2, { opacity: 0.25 });
    modes.forEach((a, k) => { const rb = ribbon(G, H, k ? COL.so : COL.yam, 0.16, { opacity: 0.55 }); rb.userData.set(a.map((v, i) => [px(i), py(v), -0.1])); });
    const rbs = eps.map((_, j) => ribbon(G, H, COL.white, 0.05, { order: 3 }));
    const dots = inst(BALL, NSAMP * H); G.add(dots);
    G.add(lab('目标的两种走法（玩具）', [X0 + 3.5, YC + 3.3, 0], { size: 17 }), lab('动作块的 10 个时间步 →', [X0 + W - 3, YC - 3.25, 0], { size: 16 }));
    /* the K = 8 training times, drawn from 0.001 + 0.999 Beta(1, 1.5) by inverse CDF: s = 1 - (1 - u)^(1/1.5) */
    const rt = L.rng(9), ts = Array.from({ length: 8 }, () => 0.001 + 0.999 * (1 - Math.pow(1 - rt(), 1 / 1.5)));
    const tb = block(W, 0.08, 0.3, COL.dim, [X0 + W / 2, 0.15, 1.2]); G.add(tb);
    ts.forEach(t => G.add(block(0.12, 0.6, 0.3, COL.depth, [X0 + W * t, 0.45, 1.2], { edges: false })));
    G.add(lab('t = 0 噪声', [X0, -0.5, 1.2], { size: 15 }), lab('t = 1 数据', [X0 + W, -0.5, 1.2], { size: 15 }), lab('K = 8 个训练 t（Beta(1, 1.5)）', [X0 + W / 2, -0.5, 1.2], { size: 15 }));
    const cur = block(0.16, 1.0, 0.4, COL.white, [X0, 0.5, 1.2], { edges: false }); G.add(cur);
    const ctls = [{ label: '欧拉步数', items: ['1', '2', '10（论文）'], get: () => ni, set: k => { ni = k; } }];
    return { ctls, update(p) {
      const N = NS[ni], u = seg(p, 0.05, 0.85) * N, k = Math.min(N - 1, Math.floor(u)), f = u - k;
      paths[N].forEach((path, j) => { const a = path[k], b = path[Math.min(N, k + 1)], z = a.map((v, i) => L.lerp(v, b[i], u >= N ? 1 : f)); rbs[j].userData.set(z.map((v, i) => [px(i), py(clamp(v, -2.3, 2.3)), 0.05])); z.forEach((v, i) => { setI(dots, j * H + i, [px(i), py(clamp(v, -2.3, 2.3)), 0.08], 0.09); }); });
      done(dots); const t = Math.min(1, u / N); cur.position.x = X0 + W * t;
      cap(`t = <b>${t.toFixed(2)}</b> · ${N} 步欧拉 · ${N === 1 ? '一步只能走到两种走法的<b>平均</b>（中间那条）' : N === 2 ? '两步开始分开，但还没贴上' : '10 步后每个样本都落到一种走法上'}`);
    } };
  }

  /* ---------- scene 8: the two losses and knowledge insulation ---------- */
  function s8(G) {
    let ki = 0;
    const vlm = block(6, 4.2, 2.4, COL.vlm, [-5, 3.4, 0]), exp = block(4, 3.2, 2, COL.post, [5.5, 2.9, 0]), head = block(6, 0.6, 1.8, COL.pre, [-5, 6.0, 0]);
    G.add(vlm, exp, head, lab('VLM（ViT + 连接器 + LLM）', [-5, 3.4, 1.8], { size: 19 }), lab('动作专家', [5.5, 2.9, 1.6], { size: 19 }), lab('LM 头 → 离散动作 token', [-5, 6.9, 0], { size: 17 }));
    const toks = []; for (let i = 0; i < 8; i++) { const b = block(0.55, 0.55, 0.55, COL.act, [-7.2 + i * 0.65, 8.0, 0]); G.add(b); toks.push(b); }
    G.add(lab('L_LM（交叉熵）', [-5, 9.1, 0], { size: 19, color: '#c9b8ff' }), lab('L_flow（式 8，K = 8）', [5.5, 5.9, 0], { size: 19, color: '#f7b77a' }));
    const kvl = lab('K、V（36 层）', [0.4, 4.6, 0.6], { size: 16 }); G.add(kvl);
    wire(G, [[-2, 3.4, 0], [3.5, 3.0, 0]], COL.act, { opacity: 0.6 });
    const cut = block(0.25, 1.6, 1.6, COL.bad, [0.8, 3.2, 0]); G.add(cut);
    const mask = lab('动作 token 段对专家屏蔽', [0.6, 1.0, 1.4], { size: 16, border: 'rgba(224,93,93,.7)' }); G.add(mask);
    const gLM = stream(G, 6, COL.pre, 0.14), gF = stream(G, 6, COL.post, 0.14), gX = stream(G, 6, COL.post, 0.14);
    const T13 = [['①', 96.95], ['②', 97.05], ['③', 96.25], ['④', 93.05], ['⑤', 97.20]];
    const bars = T13.map(([t, v], i) => { const x = 10.2 + i * 1.3; const b = bar(G, x, -2.5, 0.8, i === 4 ? COL.ft : COL.grey); G.add(lab(t, [x, -0.6, -1.5], { size: 14 })); G.add(lab(v.toFixed(2), [x, (v - 92) * 1.2 + 0.6, -2.5], { size: 13 })); b.userData.v = v; return b; });
    G.add(lab('表 13 平均（纵轴从 92 起）\n①无离散共训 ②加隔离 ③LoRA\n④只训专家 ⑤最终配方', [12.8, 8.8, -2.5], { size: 14 }));
    const ctls = [{ label: '阶段', items: ['后训练：知识隔离', '微调：不隔离'], get: () => ki, set: k => { ki = k; } }];
    return { ctls, update(p) {
      const q = (p * 3) % 1;
      gLM([[-5, 8.0, 0.8], [-5, 6.0, 0.8], [-5, 3.0, 0.8]], q, 1);
      gF([[5.5, 5.6, 0.8], [5.5, 2.9, 0.8]], q, 1);
      gX([[3.5, 3.0, 0.8], [0.9, 3.2, 0.8], [-2, 3.4, 0.8]], q, ki ? 1 : 0);
      cut.visible = !ki; glow(cut, 0.6);
      bars.forEach(b => b.userData.set((b.userData.v - 92) * 1.2 * seg(p, 0, 0.5)));
      toks.forEach((t, i) => glow(t, 0.3 + 0.3 * Math.sin(p * 12 + i)));
      cap(ki ? '微调：<b>不隔离</b>，流损失的梯度经 K、V 也更新 VLM（表 13：97.20 对隔离的 97.05）' : '后训练：K、V 进专家前 <b>detach</b>，L_flow 只更新专家和 P_K、P_V；VLM 只由 L_LM 更新');
    } };
  }

  /* ---------- scene 9: adaptive depth on a toy scene, computed ---------- */
  function s9(G) {
    let ti = 1; const THR = [0.98, 0.996, 0.9999];
    const R = 320, P = 32, NG = 10, F = 12, SUB = 8; /* each 32x32 patch is sampled on an 8x8 sub-grid for speed */
    function frame(f) { /* returns {rgb(x,y)->[r,g,b], depth(x,y)} for frame f */
      const gx = 60 + f * 18, gy = 90 + 8 * Math.sin(f * 0.6), bx = f >= 9 ? 200 + (f - 8) * 10 : 200, by = 210;
      const rgb = (x, y) => { let r = 0.35 + 0.3 * y / R, g = 0.4 + 0.2 * x / R, b = 0.5; if ((x - gx) ** 2 + (y - gy) ** 2 < 26 * 26) { r = 0.85; g = 0.85; b = 0.9; } if (Math.abs(x - bx) < 22 && Math.abs(y - by) < 22) { r = 0.9; g = 0.45; b = 0.2; } return [r, g, b]; };
      const dep = (x, y) => { let d = 0.25 + 0.6 * y / R; if ((x - gx) ** 2 + (y - gy) ** 2 < 26 * 26) d = 0.1; if (Math.abs(x - bx) < 22 && Math.abs(y - by) < 22) d = 0.55; return d; };
      return { rgb, dep, gx, gy, bx, by };
    }
    const FR = Array.from({ length: F }, (_, f) => frame(f));
    const vec = (fr, i, j) => { const v = []; for (let a = 0; a < SUB; a++) for (let b = 0; b < SUB; b++) { const c = fr.rgb(j * P + (b + 0.5) * P / SUB, i * P + (a + 0.5) * P / SUB); v.push(c[0], c[1], c[2]); } return v; };
    const cosv = (u, v) => { let d = 0, a = 0, b = 0; for (let k = 0; k < u.length; k++) { d += u[k] * v[k]; a += u[k] * u[k]; b += v[k] * v[k]; } return d / Math.sqrt(a * b); };
    const V = FR.map(fr => { const o = []; for (let i = 0; i < NG; i++) for (let j = 0; j < NG; j++) o.push(vec(fr, i, j)); return o; });
    const CODE = FR.map(fr => { const o = []; for (let i = 0; i < NG; i++) for (let j = 0; j < NG; j++) { let s = 0; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) s += fr.dep(j * P + (b + 0.5) * 8, i * P + (a + 0.5) * 8); o.push(Math.round(s / 16 * 127)); } return o; });
    const COS = V.map((v, f) => f === 0 ? null : v.map((x, k) => cosv(x, V[f - 1][k])));
    /* toy image as a coloured tile grid (left) and depth-code bars (right) */
    const IMG = 40, im = inst(BOX, IMG * IMG); G.add(im); const S0 = 0.2, ox = -10.5, oy = 0.6;
    const bars = inst(BOX, NG * NG); G.add(bars); const bx0 = 2.0, bz0 = -2.6, bs = 0.62;
    G.add(lab('玩具画面 320×320（10×10 块）', [ox + IMG * S0 / 2, oy - 0.9, 0.6], { size: 17 }), lab('10×10 深度码（柱高 = 码值）', [bx0 + 3, -0.9, bz0 + 6.8], { size: 17 }));
    const gridl = new THREE.Group(); G.add(gridl); for (let k = 0; k <= NG; k++) { gridl.add(L.line([[ox + k * IMG * S0 / NG, oy, 0.12], [ox + k * IMG * S0 / NG, oy + IMG * S0, 0.12]], COL.dim, { opacity: 0.5 })); gridl.add(L.line([[ox, oy + k * IMG * S0 / NG, 0.12], [ox + IMG * S0, oy + k * IMG * S0 / NG, 0.12]], COL.dim, { opacity: 0.5 })); }
    const ctls = [{ label: '阈值', items: ['0.98', '0.996（论文）', '0.9999'], get: () => ti, set: k => { ti = k; } }];
    /* buffer replay along frames for the current threshold */
    function run(th) { const buf = [], upd = []; for (let f = 0; f < F; f++) { if (f === 0) { buf.push(CODE[0].slice()); upd.push(CODE[0].map(() => 1)); continue; } const m = COS[f].map(c => (c < th ? 1 : 0)); upd.push(m); buf.push(buf[f - 1].map((b, k) => (m[k] ? CODE[f][k] : b))); } return { buf, upd }; }
    const RUNS = THR.map(run);
    return { ctls, update(p) {
      const f = Math.min(F - 1, Math.floor(p * F * 0.999)), fr = FR[f], run0 = RUNS[ti];
      for (let a = 0; a < IMG; a++) for (let b = 0; b < IMG; b++) { const c = fr.rgb((b + 0.5) * R / IMG, (a + 0.5) * R / IMG); const k = a * IMG + b; setI(im, k, [ox + (b + 0.5) * S0, oy + (IMG - 1 - a + 0.5) * S0, 0], [S0 * 0.98, S0 * 0.98, 0.1]); colI(im, k, c); }
      done(im);
      let n = 0;
      for (let i = 0; i < NG; i++) for (let j = 0; j < NG; j++) { const k = i * NG + j, u = run0.upd[f][k], v = run0.buf[f][k]; if (u) n++; const h = 0.15 + v / 127 * 4; setI(bars, k, [bx0 + j * bs, h / 2, bz0 + i * bs], [bs * 0.86, h, bs * 0.86]); colI(bars, k, u ? hex3(COL.depth) : [0.36, 0.4, 0.5]); }
      done(bars);
      const tot = run0.upd.reduce((a, m) => a + m.reduce((x, y) => x + y, 0), 0);
      cap(`第 <b>${f + 1}</b> / ${F} 帧 · 阈值 ${THR[ti]} · 这一步解码 <b>${n}</b> 个深度 token（其余 ${100 - n} 个回放）· ${F} 帧合计 ${tot}，全量要 ${F * 100}`);
    } };
  }

  /* ---------- scene 10: the depth gate, noise injection and mixed training ---------- */
  function s10(G) {
    let bi = 0; const BIAS = [-4, -2, 0, 2];
    const NL = 36, r = L.rng(21), wc = Array.from({ length: NL }, () => (r() - 0.5) * 3);
    const gb = []; for (let l = 0; l < NL; l++) { const b = bar(G, -11 + l * 0.42, 0, 0.32, COL.depth); gb.push(b); }
    G.add(lab('36 层的门值 g_ℓ = σ(w_ℓᵀc_ℓ + b)', [-3.6, 7.0, 0], { size: 18 }), lab('1.0', [-11.9, 5.0, 0], { size: 14 }), lab('0', [-11.9, 0.1, 0], { size: 14 }));
    wire(G, [[-11.3, 5.0, 0], [3.8, 5.0, 0]], COL.dim, { opacity: 0.4, dashed: true });
    /* 100 depth tokens; 10% replaced */
    const tk = inst(BOX, 100); G.add(tk); const rr = L.rng(4), noisy = new Set(); while (noisy.size < 10) noisy.add(Math.floor(rr() * 100));
    G.add(lab('深度输入 100 个码：10% 换成随机码（目标不变）', [8.3, 10.2, -1.0], { size: 15 }));
    const T14 = [['①', 97.50], ['②', 97.65], ['③', 98.10]];
    const bars = T14.map(([t, v], i) => { const x = 6.6 + i * 1.9; const b = bar(G, x, 0, 1.2, i === 2 ? COL.think : COL.grey); G.add(lab(t, [x, -0.7, 1.4], { size: 14 }), lab(v.toFixed(2), [x, (v - 97) * 3 + 0.6, 0], { size: 14 })); b.userData.v = v; return b; });
    G.add(lab('表 14（纵轴从 97 起）\n①只用先深度再动作 ②加混合训练\n③再加注噪和门（最终配方）', [8.5, 5.6, 0], { size: 14 }));
    const ctls = [{ label: '偏置 b', items: ['−4（论文初值）', '−2', '0', '+2'], get: () => bi, set: k => { bi = k; } }];
    const sig = x => 1 / (1 + Math.exp(-x));
    return { ctls, update(p) {
      const b = BIAS[bi], g = seg(p, 0, 0.4); let mean = 0;
      gb.forEach((m, l) => { const v = sig(wc[l] * 0.3 + b); mean += v; m.userData.set(Math.max(0.02, v * 5 * g)); });
      mean /= NL;
      for (let k = 0; k < 100; k++) { const i = Math.floor(k / 10), j = k % 10, on = noisy.has(k) && p > 0.45; setI(tk, k, [6.0 + j * 0.5, 7.4 + (9 - i) * 0.22, -1.0], [0.42, 0.18, 0.42]); colI(tk, k, on ? hex3(COL.bad) : hex3(COL.depth)); }
      done(tk);
      bars.forEach(bb => bb.userData.set((bb.userData.v - 97) * 3 * seg(p, 0.3, 0.8)));
      cap(`b = <b>${b}</b> · σ(b) = <b>${sig(b).toFixed(3)}</b> · 36 层平均门值 ${mean.toFixed(3)}（玩具 wᵀc）· 深度位置的 K、V 乘这个数`);
    } };
  }

  /* ---------- scene 11: deployment rhythm, speed and LIBERO scores ---------- */
  function s11(G) {
    let view = 0; const sub = new THREE.Group(); G.add(sub); let built = -1, upd = () => {};
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); built = view;
      if (view === 0) {
        /* timeline: 3 seconds; each chunk = 1 s of execution, preceded by inference latency */
        const X0 = -12, W = 24, sec = W / 3;
        sub.add(lab('时间（秒）→', [X0 + W - 1, 0.3, 1.6], { size: 16 }));
        for (let s = 0; s <= 3; s++) sub.add(lab(String(s), [X0 + s * sec, 0.3, 1.6], { size: 15 }));
        const rows = [['MolmoAct2：推理 179 ms', 0.179, COL.post, 6.0], ['MolmoAct2-Think：推理 787 ms', 0.787, COL.think, 3.0]];
        const movers = [];
        rows.forEach(([t, lat, c, y]) => {
          sub.add(lab(t, [X0 + 3.5, y + 1.3, 0], { size: 17 }));
          for (let k = 0; k < 3; k++) { const inf = block(lat * sec, 0.7, 0.8, c, [X0 + k * sec + lat * sec / 2, y, 0]); const ex = block(sec - 0.1, 0.35, 0.8, COL.ft, [X0 + k * sec + sec / 2, y - 0.7, 0], { opacity: 0.85 }); sub.add(inf, ex); for (let a = 0; a < 10; a++) sub.add(block(0.08, 0.5, 0.82, COL.white, [X0 + k * sec + (a + 0.5) * sec / 10, y - 0.7, 0], { edges: false })); }
          movers.push(y);
        });
        sub.add(lab('绿条：执行一块 10 个动作（10 Hz，1 秒）', [X0 + W / 2, 8.4, 0], { size: 16 }));
        sub.add(lab('示意：推理和执行画成串行，实际可以重叠', [X0 + W / 2, 0.9, 2.2], { size: 15, border: 'rgba(242,193,78,.7)' }));
        const cur = block(0.08, 7.4, 0.9, COL.white, [X0, 4.0, 0], { edges: false }); sub.add(cur);
        upd = p => { cur.position.x = X0 + p * W; };
      } else if (view === 1) {
        const V = [['原始', 23.02, 8.04], ['缓存', 27.39, 9.72], ['缓存 + CUDA Graph', 55.79, 12.71], ['离散路径', 14.17, 6.82]];
        const bs = [];
        V.forEach(([t, a, b], i) => { const x = -9 + i * 5.2; sub.add(lab(t, [x + 0.7, -0.6, 1.6], { size: 16 })); const A = bar(sub, x, 0, 1.2, COL.post), B = bar(sub, x + 1.5, 0, 1.2, COL.think); const la = lab(a.toFixed(2), [x, 0, 0], { size: 15 }), lb = lab(b.toFixed(2), [x + 1.5, 0, 0], { size: 15 }); sub.add(la, lb); bs.push([A, B, la, lb, a, b]); });
        sub.add(lab('■ MolmoAct2', [-10, 10, 0], { size: 18, color: css(COL.post) }), lab('■ MolmoAct2-Think', [-5, 10, 0], { size: 18, color: '#e88fc6' }), lab('Hz = 10 / 延迟（单张 H100，图 8）', [5, 10, 0], { size: 16 }));
        upd = p => { const g = seg(p, 0, 0.6); bs.forEach(([A, B, la, lb, a, b]) => { A.userData.set(a * 0.15 * g); B.userData.set(b * 0.15 * g); la.position.y = a * 0.15 * g + 0.5; lb.position.y = b * 0.15 * g + 0.5; }); };
      } else {
        const V = [['Spatial', 97.8, 98.8], ['Object', 100.0, 99.8], ['Goal', 97.8, 98.4], ['Long', 93.2, 95.4], ['平均', 97.2, 98.1]];
        const bs = [];
        V.forEach(([t, a, b], i) => { const x = -10 + i * 5; sub.add(lab(t, [x + 0.7, -0.6, 1.6], { size: 17 })); const A = bar(sub, x, 0, 1.2, COL.post), B = bar(sub, x + 1.5, 0, 1.2, COL.think); const la = lab(a.toFixed(1), [x, 0, 0], { size: 15 }), lb = lab(b.toFixed(1), [x + 1.5, 0, 0], { size: 15 }); sub.add(la, lb); bs.push([A, B, la, lb, a, b]); });
        sub.add(lab('表 8（纵轴从 90 起；Think 版 Goal 按表 14 画 98.4）', [0, 9.8, 0], { size: 17 }), lab('每套 500 次 → 1 次 = 0.2 个点', [0, 8.6, 0], { size: 15 }));
        upd = p => { const g = seg(p, 0, 0.6); bs.forEach(([A, B, la, lb, a, b]) => { A.userData.set((a - 90) * 0.75 * g); B.userData.set((b - 90) * 0.75 * g); la.position.y = (a - 90) * 0.75 * g + 0.5; lb.position.y = (b - 90) * 0.75 * g + 0.5; }); };
      }
    }
    rebuild();
    const ctls = [{ label: '视图', items: ['执行节奏', '速度（图 8）', '分数（表 8）'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      if (built !== view) rebuild(); upd(p);
      cap(['每块 10 个动作开环执行 1 秒；<b>179 ms</b> 推理只占 18%，Think 版 <b>787 ms</b> 占 79%', 'CUDA Graph 让 MolmoAct2 从 27.39 到 <b>55.79 Hz</b>；Think 的自回归深度解码只到 <b>12.71 Hz</b>', 'MolmoAct2 <b>1944</b> / 2000，Think <b>1962</b> / 2000；差 18 次，双比例检验 p ≈ 0.06'][view]);
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player ---------- */
  let cur = 0, api = null, playing = !L.reduced(), t0 = 0, pNow = 0, tw = null;
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
  /* ?opt=a,b sets the first toggles of the start scene (for screenshots) */
  const s0 = clamp((parseInt(qs.get('scene'), 10) || 1) - 1, 0, SCENES.length - 1), pq = qs.get('p'), OPT = (qs.get('opt') || '').split(',').filter(x => x !== '');
  setPlay(playing && pq == null);
  go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0));
  if (OPT.length && api?.ctls) { OPT.forEach((v, i) => { if (api.ctls[i]) api.ctls[i].set(+v); }); api.update(pNow); syncCtl(); }
  window.__maDebug = { get cap() { return $('cap').textContent; } };
})();
