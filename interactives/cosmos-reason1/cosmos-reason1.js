'use strict';
/* Cosmos-Reason1 (arXiv 2503.15558v3) taken apart into eleven animated scenes. Sizes and hyperparameters come from the paper (v3),
   the official repo nvidia-cosmos/cosmos-reason1 at commit b84a3fa and the released Cosmos-Reason1-7B config.json. Each scene's
   update(p) is a pure function of the timeline p plus the current toggles. Scenes 6 and 8 compute their numbers live on toy
   problems; those are toys and are labelled so. No Cosmos-Reason1 network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { vid: 0x3aa8e0, vit: 0x5f8fe0, proj: 0x9d8cff, llm: 0x4fc98a, mamba: 0x7cb8ff, mlp: 0xe8c86a, attn: 0xe07aa8, think: 0xd45fa0, r1: 0xf0963c, rl: 0xf2c14e, sft: 0x38d1ff, dim: 0x46506a, bad: 0xe05d5d, ok: 0x4fc98a, white: 0xeef2fa, grey: 0x6b7794, space: 0xe05d5d, time: 0x4fc98a, phys: 0x3a8fe0, onto: 0x9d8cff, bench: 0x8e9bb8, gpt: 0x8e9bb8 };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  const SCENES = [
    { n: 1, part: '总览', title: '从两套本体到两段训练', sub: '本体 → 数据 → 模型 → SFT → RL → 基准；方块可以点', dur: 13, cam: [0.08, 1.15, 32, [0, 4.4, 0]],
      html: dl([['本体', '物理常识 3 类 16 子类；具身推理 4 能力 × 5 主体'], ['数据', 'SFT 约 3.75M 条；RL 30,304 道选择题'], ['模型', '7B（Qwen2.5-VL）和 56B（InternViT + Nemotron-H）'], ['训练', '物理 AI SFT → GRPO 强化学习'], ['基准', '常识 604 题 · 具身 610 题 · 直觉物理 300 题']]) +
        '<p>论文先定义“物理 AI 要会什么”（两套本体），再按本体去造数据和基准。模型本身没有新结构：7B 直接从 Qwen2.5-VL-7B 出发，56B 用现成的视觉编码器和混合骨干。新东西在数据和训练配方上。</p>' +
        '<p>v1 里还有两段：视觉预训练和通用 SFT；v3 换成现成的 VLM 后去掉了（精读页“版本差异”）。点画面里的方块可以跳到对应那一幕。</p>' + src('§1 · 图 1 · 表 4–6') },
    { n: 2, part: '§2 本体', title: '物理常识 16 个子类，具身推理 4 × 5 的格子', sub: '左：初始题数（图 8）或最终基准；右：哪些格子论文真的做了', dur: 13, cam: [0.2, 0.82, 34, [0, 2.0, 0]],
      html: dl([['空间', '关系、合理性、可供性、环境'], ['时间', '动作、顺序、因果、相机、规划'], ['基础物理', '属性、状态、物体恒存、力学、电磁、热力学、反物理'], ['具身能力', '处理感官输入、预测动作效果、遵守物理约束、从交互中学习'], ['主体', '人、动物、机械臂、人形、自动驾驶车']]) +
        '<p>左边一圈 16 根柱子是图 8 的初始题数（共 5,737 题），颜色按三大类。切到“最终基准”看 604 题怎样分到三类：空间 80、时间 298、基础物理 226；子类分布论文没给。</p>' +
        '<p>右边是表 2 的 4 × 5 格子。亮的格子是论文实际覆盖的：前三种能力 × 人、机械臂、人形、自动驾驶。“从交互中学习”留作以后，动物没有数据。</p>' + src('§2 · 图 2 · 图 8 · 表 1 · 表 2 · §6.1') },
    { n: 3, part: '§3.1 视频输入', title: '一段视频变成多少个 token', sub: '切换 7B / 56B 和片段时长，读数当场算', dur: 13, cam: [0.15, 1.1, 30, [0, 3.6, 0]], camE: [0.15, 1.1, 34, [0, 6.2, 0]],
      html: dl([['56B', '最多 32 帧、最高 2 fps，448×448；每帧 1024 patch → PixelShuffle 2×2 → 256'], ['7B', 'Qwen2.5-VL：动态分辨率，14 的 patch，2×2 合并，时间上 2 帧合 1'], ['7B 代码', 'fps 4，total_pixels 6,422,528 = 8192 × 28²'], ['投影器', '56B：4096 → 32768 → 8192；7B：5120 → 5120 → 3584']]) +
        '<p>两种模型的视频 token 上限其实都是 8192：56B 是 32 × 256，7B 是 total_pixels / 28²。区别在怎样分配：56B 固定每帧 256 个 token，最多 32 帧；7B 帧率更高，片段越长每帧分到的像素越少。</p>' +
        guess('7B 的每帧像素是按“总像素 × 2 / 帧数，单帧不超过 768 × 28²”估的，这是我对 qwen_vl_utils 的理解，没有运行；真实实现还会把边长取整到 28 的倍数。56B 的读数直接按论文 §3.1 算。') +
        src('§3.1 · 表 3 · configs/vision_config.yaml · scripts/inference_sample.py · config.json') },
    { n: 4, part: '§3.2 骨干', title: '56B 的 118 层：54 Mamba、54 MLP、10 注意力', sub: '按图 4 一层层搭；切换到 7B 的 28 个稠密块对比', dur: 15, cam: [0.0, 1.2, 30, [0, 3.4, 0]],
      html: dl([['图 4', 'MM×7 → T → [MM×9 → T] × 9 → MM×10'], ['MM×k', 'k 层，Mamba、MLP 交替，以 Mamba 开头'], ['T', 'Transformer 块 = 自注意力 + MLP'], ['合计', '7 + 2 + 9 × 11 + 10 = 118'], ['7B', '28 个块，每块自注意力 + MLP（28 头，KV 头 4）']]) +
        '<p>Mamba 层按序列长度线性扩展，长视频（8192 个 token）时比注意力省；但状态空间压缩会丢细节，所以每隔约 11 层放一个注意力块。注意力只占 118 层的 8.5%。</p>' +
        '<p>读数是边搭边数出来的，和表 3 的 118 层一致。56B 训练用 TP = 8、PP = 2；7B 用 TP = 4。</p>' +
        src('§3.2 · 图 4 · 表 3 · 精读读者注 6') },
    { n: 5, part: '§5.1 SFT 数据', title: '把视频压成文字，交给 R1 写推理', sub: '切换数据来源，看哪一步换了人', dur: 14, cam: [0.06, 1.15, 28, [0, 4.0, 0]],
      html: dl([['常识', '人工或 VLM 详细描述 → LLM 出题 → R1 推理 → 清洗改写'], ['具身', '切短片段 → VLM 结构化描述 → 按子任务出题 → R1 → 清洗'], ['拼图', 'VLM 描述 32 块 → R1 解题，只留答对的'], ['时间箭头', '直接让 VLM 写推理，提示里告诉它正放还是倒放'], ['物体恒存', '中间版 Cosmos-Reason1-7B 写推理，提示里写明谁消失；训练时去掉提示']]) +
        '<p>R1 是纯文本模型，看不到视频，所以大部分推理链是“看描述推理”。清洗改写一步要把“描述里说”“caption”之类的字眼去掉，让它读起来像是看着视频推理。</p>' +
        '<p>出题的关键：答案不能直接写在描述里，否则 R1 只是检索，思考过程没有用。</p>' +
        src('§5.1.1–5.1.3 · 图 7 · 附录 A') },
    { n: 6, part: '§5.1.3 直觉物理', title: '三种不用标注就有答案的题', sub: '玩具：拼图当场打乱、球当场正放倒放、物体当场被藏起来', dur: 15, cam: [0.1, 1.12, 28, [0, 3.4, 0]],
      html: dl([['拼图', '首帧切 2×2，加 7 张干扰图，共 32 帧；问同图的 3 帧、某方向是哪帧'], ['时间箭头', '30,000 段片段及其倒放'], ['物体恒存', 'LIBERO 仿真 10K 段，相机绕桌转，被挡住的物体可能被删掉'], ['基准', '每项 100 题；7B：56.0 / 85.4 / 82.0 → RL 后 64.5 / 94.0 / 86.0']]) +
        '<p>这三类题的答案在生成时就知道，所以能大量生成，也能直接做 RL 的可验证奖励（RL 里 24,079 题都是这类）。现有模型在时间箭头和物体恒存上接近随机。</p>' +
        toyb('图片是程序生成的色块，球用自由落体加 0.8 的反弹系数，物体恒存的遮挡板代替相机和机械臂的遮挡。打乱顺序、能量读数、谁消失都是当场算的。时间箭头里“能量自己变大”是我选的线索，论文的例子是粉末倒流回碗里。') +
        src('§5.1.3 · §7.1.3 · 表 10 · 附录 A.4–A.6') },
    { n: 7, part: '§5 数据配比', title: '各来源有多少条', sub: '对数高度；切换 SFT 理解 / SFT 推理 / RL', dur: 12, cam: [0.1, 1.15, 31, [0, 3.8, 0]],
      html: dl([['SFT 理解', '1.81M，常识选择题占 1.2M'], ['SFT 推理', '1.93M，RoboVQA 920K、常识选择题 605K'], ['RL', '30,304 题，直觉物理 24,079（79%）'], ['具身 RL', '每个来源只有 200 到 252 题']]) +
        '<p>柱高按对数画（10K 到 1.2M 差两个数量级）。SFT 时按领域均衡采样，所以数据量大的来源并不按比例出现在训练批里。</p>' +
        '<p>RL 数据量的分布和 SFT 完全不同：具身问题要人工挑干扰项，做不多；直觉物理可以无限生成。</p>' +
        src('表 4 · 表 5 · §7.1 · HF 数据卡') },
    { n: 8, part: '§4.1 GRPO', title: '一题 9 个回答，组内比高低', sub: '这一幕是核心。玩具：切换答对率，看多少组没有学习信号', dur: 15, cam: [0.05, 1.12, 30, [0, 3.8, 0]], camE: [0.05, 1.12, 31, [0, 4.6, 0]],
      html: dl([['优势', 'Aᵢ = (R(oᵢ) − mean(𝒢)) / std(𝒢)'], ['奖励', '准确率（&lt;answer&gt; 字符串匹配）+ 格式（正则）'], ['设置', '批 128 题 × 9 个回答，最长 6144 token，lr 4e-6，KL 0.005，500 步'], ['全同组', 'P = pᴳ + (1 − p)ᴳ，G = 9']]) +
        '<p>每一列是一道题的 9 个回答，绿对红错。柱子是每个回答的优势：比组内平均好的往上，差的往下。全对或全错的组优势全是 0，灰掉，这一组对梯度没有贡献。</p>' +
        '<p>读数比较模拟出来的全同组比例和公式 pᴳ + (1 − p)ᴳ。答对率越高，浪费越多：p = 0.9 时约四成的组白算。</p>' +
        toyb('每个回答按答对率 p 独立抽签（种子固定），不是模型的真实输出。奖励只算准确率 0/1，格式奖励略去；分母为 0 时按 0 处理，实际实现会加一个小常数。') +
        src('§4.1 · §7.2.1 · 精读读者注 7') },
    { n: 9, part: '§4.2 RL 框架', title: '采样和训练分开放，参数用 NCCL 送回去', sub: '切换同置同步 / 异步，看下面的时间线', dur: 14, cam: [0.08, 1.15, 31, [0, 4.0, 0]],
      html: dl([['调度器', '分发提示和指令，管理状态，有冗余'], ['采样节点', '生成回答、算奖励和优势；DP、PP、TP'], ['训练节点', 'GRPO 更新；5D 并行（图注 FSDP，图里 SP）'], ['参考模型', '提供 KL 项'], ['论文声称', '比同置框架训练效率高约 160%；节点故障不用重启']]) +
        '<p>同置（colocated）框架里同一批卡轮流做采样和训练，长回答拖住整批，训练要等。异构部署让两边各自跑，调度器把提示源源不断地送进采样节点。</p>' +
        guess('下面时间线的各段时长是我设的，只为说明空等从哪来；160% 论文没给测量条件，这里算出的利用率和它不可比。') +
        src('§4.2 · 图 5 · cosmos-rl README') },
    { n: 10, part: '§7 结果', title: '常识、具身、RL 前后、直觉物理', sub: '柱子都是原文表格数字；切换表', dur: 13, cam: [0.05, 1.2, 33, [0, 4.4, 0]],
      html: dl([['表 7', '常识平均：7B 47.4 → 54.3，56B 58.2 → 60.2，o1 59.9'], ['表 8', '具身平均：7B 50.8 → 61.8，56B 53.5 → 63.7'], ['表 9', 'RL：60.7 → 65.7；HoloAssist 63.0 → 60.0'], ['表 10', '直觉物理：42.1 → 74.5 → 81.5']]) +
        '<p>表 7 的“平均”是三类的简单平均，不按题数加权；56B 在时间类上反而比骨干低（65.5 对 68.1）。</p>' +
        '<p>表 9 里 v3 唯一下降的是 HoloAssist，而正文说的“例外”是 RoboFail，那段话沿用了 v1（精读读者注 18）。</p>' + src('表 7–10') },
    { n: 11, part: '部署', title: '一次推理：视频进来，先想再答', sub: '切换三种设置，看推理链会不会被截断', dur: 14, cam: [0.06, 1.15, 31, [0, 4.0, 0]],
      html: dl([['加载', 'transformers 的 Qwen2_5_VLForConditionalGeneration，24 GB 显存一张卡'], ['输入', '视频 fps 4，total_pixels 6,422,528；问题后加推理格式提示'], ['输出', '&lt;think&gt; … &lt;/think&gt; &lt;answer&gt; … &lt;/answer&gt;'], ['论文评测', '温度 0.6、top-p 0.95、5 次平均'], ['evaluate.yaml', '温度 0.6、单次、max_tokens 1024，空答案重试每次 +256']]) +
        '<p>推理链长，输出上限设小了就会在 &lt;think&gt; 里被截断，拿不到答案。模型卡建议至少 4096；官方评测脚本默认 1024，靠重试补救。</p>' +
        '<p>当前下载到的权重（2025-08-01 版）不是论文里的检查点，模型卡上的具身平均是 65.1。</p>' +
        toyb('推理链长度 1,400 token 是我设的。') + src('README · scripts/inference_sample.py · examples/benchmark · 模型卡') }
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


  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    const N = [['两套本体', -11, COL.onto, '§2', 1], ['SFT 数据', -6.6, COL.sft, '§5.1 · 3.75M', 4], ['模型', -2.2, COL.vit, '§3', 2], ['物理 AI SFT', 2.2, COL.llm, '§7.1', 6], ['物理 AI RL', 6.6, COL.rl, '§4 · GRPO', 7], ['基准', 11, COL.bench, '§6', 9]];
    const B = N.map(([t, x, c, s, go]) => { const b = block(3.4, 1.7, 1.8, c, [x, 6.0, 0]); G.add(b, lab(t, [x, 7.5, 0], { size: 22 }), lab(s, [x, 4.7, 0.9], { size: 17 })); b.userData.go = go; PICKS.push(b); return b; });
    const M = [['7B：Qwen2.5-VL-7B', -4.6, COL.vit, '稠密 Transformer 28 层 · 已开源', 3], ['56B：InternViT-300M + Nemotron-H', 4.6, COL.mamba, '混合 118 层 · 未开源', 3]];
    const D = M.map(([t, x, c, s, go]) => { const b = block(6.6, 1.3, 1.6, c, [x, 1.6, 0]); G.add(b, lab(t, [x, 2.95, 0], { size: 19 }), lab(s, [x, 0.25, 0.9], { size: 16 })); b.userData.go = go; PICKS.push(b); return b; });
    wire(G, [[-2.2, 5.1, 0], [-4.6, 2.3, 0]], COL.vit, { opacity: 0.5, dashed: true }); wire(G, [[-2.2, 5.1, 0], [4.6, 2.3, 0]], COL.mamba, { opacity: 0.5, dashed: true });
    const f = stream(G, 8, COL.white, 0.16);
    return { update(p) {
      const k = clamp(p * 1.25, 0, 1) * 6; B.forEach((b, i) => glow(b, k > i ? 0.55 : 0.05));
      D.forEach(b => glow(b, p > 0.55 ? 0.4 : 0.05));
      f([[-11, 7.0, 1.0], [11, 7.0, 1.0]], (p * 3) % 1, 1);
      cap(p < 0.55 ? '先定义能力（本体），按本体造 <b>SFT 数据</b>和<b>基准</b>；训练只有两段：<b>物理 AI SFT → GRPO 强化学习</b>' : '两种尺寸的骨干完全不同：<b>7B</b> 是 Qwen2.5-VL，<b>56B</b> 是 InternViT + Nemotron-H 混合骨干；只有 7B 发布了权重');
    } };
  }

  /* ---------- scene 2: the two ontologies ---------- */
  function s2(G) {
    let view = 0; G.add(L.grid(36, 36));
    const SUB = [['关系', 0, 292], ['合理性', 0, 124], ['可供性', 0, 144], ['环境', 0, 691], ['动作', 1, 1043], ['顺序', 1, 340], ['因果', 1, 82], ['相机', 1, 639], ['规划', 1, 27], ['属性', 2, 775], ['状态', 2, 277], ['恒存', 2, 294], ['力学', 2, 325], ['电磁', 2, 516], ['热力学', 2, 125], ['反物理', 2, 43]];
    const CC = [COL.space, COL.time, COL.phys], CN = ['空间', '时间', '基础物理'], FIN = [80, 298, 226];
    const cx = -7.5, R = 6.2;
    const bars = SUB.map(([t, c, n], i) => { const a = (i + 0.5) / 16 * Math.PI * 2, x = cx + R * Math.sin(a), z = R * Math.cos(a); const b = bar(G, x, z, 0.9, CC[c]); const l2 = lab(`${t} ${n}`, [x, 1, z], { size: 15, color: css(CC[c]) }); G.add(l2); return { b, l2, n, x, z }; });
    const cen = CN.map((t, i) => { const x = cx + (i - 1) * 1.8; const b = bar(G, x, 0, 1.3, CC[i]); const l = lab(`${t} ${FIN[i]}`, [x, 1, 0], { size: 16 }); G.add(l); return { b, l, v: FIN[i] }; });
    G.add(lab('物理常识：3 类 16 子类', [cx, 0.5, 9.8], { size: 21 }));
    const AG = ['人', '动物', '机械臂', '人形', '自动驾驶'], CAP = ['感官输入', '预测效果', '物理约束', '从交互学习'];
    const gx = 5.2, gz = -3.6, cells = [];
    AG.forEach((a, j) => G.add(lab(a, [gx + j * 1.9, 0.4, gz - 1.3], { size: 16 })));
    CAP.forEach((c, i) => { G.add(lab(c, [gx - 2.6, 0.4, gz + i * 1.9], { size: 16 })); AG.forEach((a, j) => { const on = i < 3 && j !== 1; const b = block(1.5, 0.5, 1.5, on ? COL.llm : COL.dim, [gx + j * 1.9, 0.25, gz + i * 1.9]); G.add(b); cells.push({ b, on, i, j }); }); });
    G.add(lab('具身推理：4 能力 × 5 主体（表 2）', [gx + 3.8, 9.6, 0], { size: 21 }));
    const ctls = [{ label: '左边', items: ['初始题数（图 8）', '最终基准 604 题'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      const g = seg(p, 0, 0.5);
      bars.forEach(o => { const h = view === 0 ? o.n / 1043 * 6.5 * g : 0.001; o.b.userData.set(h); o.l2.position.y = h + 0.45; o.l2.visible = view === 0 && g > 0.2; });
      cen.forEach(o => { const h = view === 1 ? o.v / 298 * 6.5 * g : 0.001; o.b.userData.set(h); o.l.position.y = h + 0.5; o.l.visible = view === 1 && g > 0.2; });
      const k = seg(p, 0.4, 0.9); cells.forEach(c => { c.b.scale.y = c.on ? 1 + 2.2 * k : 1; c.b.position.y = c.b.scale.y * 0.25; glow(c.b, c.on ? 0.5 * k : 0); });
      cap(view === 0 ? `初始收集 <b>5,737</b> 题：最多的是时间-动作 <b>1,043</b>，最少的是时间-规划 <b>27</b>；右边亮格是论文覆盖的 <b>12</b> 个组合（3 能力 × 4 主体）` : '最终基准 <b>604</b> 题：空间 80、时间 298、基础物理 226（336 是非 + 268 选择）；子类分布论文没给');
    } };
  }

  /* ---------- scene 3: video to tokens ---------- */
  function s3(G) {
    let model = 0, dur = 1; const T = [5, 10, 20];
    const sub = new THREE.Group(); G.add(sub); let built = '';
    const rd = dynLab(G, [3.6, 9.4, 0], { size: 18, border: 'rgba(56,209,255,.6)' });
    const llm = block(2.6, 3.4, 2.4, COL.llm, [10.2, 3.0, 0]); G.add(llm, lab('LLM', [10.2, 5.2, 0], { size: 21 }));
    const pj = block(1.6, 1.6, 1.6, COL.proj, [5.6, 3.0, 0]); G.add(pj, lab('投影器', [5.6, 4.3, 0], { size: 18 }));
    const tokBar = block(1, 0.5, 0.5, COL.vid, [0, 0.4, 2.2], { edges: false }); G.add(tokBar);
    const capBar = block(1, 0.5, 0.5, COL.grey, [0, 0.4, 2.2], { edges: false, opacity: 0.3 }); G.add(capBar, lab('上限 8192', [-1, -0.4, 2.8], { size: 16 }));
    const flow = stream(G, 10, COL.vid, 0.13);
    function calc() {
      const t = T[dur];
      if (model === 1) { const fr = Math.min(32, 2 * t); return { fr, px: 448, tpf: 256, tok: fr * 256, note: `${fr} 帧 × 256 = ${fr * 256}` }; }
      const fr = 4 * t, groups = fr / 2, perFrame = Math.min(768 * 784, 6422528 * 2 / fr), tpg = Math.floor(perFrame / 784), tok = Math.min(8192, groups * tpg);
      return { fr, px: Math.round(Math.sqrt(perFrame)), tpf: tpg / 2, tok, note: `${groups} 组（2 帧一组）× ${tpg} ≈ ${tok}` };
    }
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); built = model + '_' + dur;
      const c = calc(), n = Math.min(c.fr, 40), side = 1.2 + 1.6 * c.px / 448;
      for (let i = 0; i < n; i++) { const b = block(0.06, side, side, COL.vid, [-11 + i * (7.5 / Math.max(1, n - 1)), 3.0, 0], { opacity: 0.55, edges: true }); b.userData.i = i; sub.add(b); }
      sub.add(lab(`${c.fr} 帧 · 每帧约 ${c.px}×${c.px} 像素`, [-7.3, 5.6, 0], { size: 18 }));
      sub.add(lab(model === 1 ? 'ViT-300M · 1024 patch → PixelShuffle → 256' : 'ViT（Qwen2.5-VL）· 每 token 管 28×28×2 帧', [-7.3, 0.7, 0], { size: 16 }));
    }
    const ctls = [{ label: '模型', items: ['7B（代码设置）', '56B（论文）'], get: () => model, set: k => { model = k; } }, { label: '时长', items: ['5 秒', '10 秒', '20 秒'], get: () => dur, set: k => { dur = k; } }];
    return { ctls, update(p) {
      if (built !== model + '_' + dur) rebuild();
      const c = calc(), g = seg(p, 0.15, 0.7), w = 14 * c.tok / 8192 * g;
      tokBar.scale.x = Math.max(0.01, w); tokBar.position.x = -7 + w / 2; capBar.scale.x = 14; capBar.position.x = 0;
      sub.children.forEach(ch => { if (ch.userData.i != null) glow(ch, ((p * 4 + ch.userData.i / 40) % 1) < 0.15 ? 0.6 : 0.05); });
      flow([[-3.2, 3.0, 0.6], [5.6, 3.0, 0.6], [10.2, 3.0, 0.6]], (p * 3) % 1, 1); glow(pj, 0.2 + 0.3 * g); glow(llm, 0.3 * g);
      rd(`${model ? '56B' : '7B'} · ${T[dur]} 秒 → ${c.note} 个视频 token`);
      cap(model === 1 ? `56B：最多 32 帧、最高 2 fps → <b>${c.tok}</b> 个 token；超过 16 秒就只能均匀抽 32 帧` : `7B：fps 4，总像素固定 → <b>${c.tok}</b> 个 token；片段越长，每帧分到的像素越少（约 ${c.px}² 像素，估算）`);
    } };
  }

  /* ---------- scene 4: the 118-layer hybrid backbone ---------- */
  function s4(G) {
    let which = 0;
    const alt = k => Array.from({ length: k }, (_, i) => (i % 2 ? 'F' : 'M')), TB = ['A', 'F'];
    const SEQ56 = [...alt(7), ...TB]; for (let r = 0; r < 9; r++) SEQ56.push(...alt(9), ...TB); SEQ56.push(...alt(10));
    const SEQ7 = []; for (let r = 0; r < 28; r++) SEQ7.push('A', 'F');
    const CL = { M: COL.mamba, F: COL.mlp, A: COL.attn };
    const sub = new THREE.Group(); G.add(sub); let built = -1, slabs = [];
    const rd = dynLab(G, [0, 9.3, 0], { size: 19, border: 'rgba(56,209,255,.6)' });
    G.add(lab('■ Mamba', [-9, 8.0, 0], { size: 17, color: css(COL.mamba) }), lab('■ MLP', [-5.6, 8.0, 0], { size: 17, color: css(COL.mlp) }), lab('■ 自注意力', [-2.0, 8.0, 0], { size: 17, color: css(COL.attn) }));
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); built = which; slabs = [];
      const S = which ? SEQ7 : SEQ56, n = S.length, W = 23, dx = W / n;
      S.forEach((t, i) => { const h = t === 'A' ? 4.2 : t === 'M' ? 3.4 : 2.6; const b = block(dx * 0.82, h, 1.8, CL[t], [-W / 2 + (i + 0.5) * dx, h / 2, 0], { edges: false }); sub.add(b); slabs.push({ b, t, h }); });
      if (!which) { const xs = i => -W / 2 + i * dx; sub.add(lab('MM×7', [xs(3.5), 5.4, 0], { size: 15 }), lab('[MM×9 → T] × 9', [xs(9 + 49.5), 5.4, 0], { size: 17 }), lab('MM×10', [xs(113), 5.4, 0], { size: 15 })); }
      else sub.add(lab('28 × [自注意力 + MLP]', [0, 5.4, 0], { size: 17 }));
    }
    const ctls = [{ label: '骨干', items: ['56B 混合（图 4）', '7B 稠密'], get: () => which, set: k => { which = k; } }];
    return { ctls, update(p) {
      if (built !== which) rebuild();
      const n = slabs.length, k = Math.round(seg(p, 0.02, 0.8) * n), cnt = { M: 0, F: 0, A: 0 };
      slabs.forEach((s, i) => { const on = i < k; s.b.visible = on; if (on) cnt[s.t]++; glow(s.b, i === k - 1 ? 0.8 : 0.1); });
      rd(`已搭 ${k} / ${n} 层 · Mamba ${cnt.M} · MLP ${cnt.F} · 注意力 ${cnt.A}`);
      cap(which ? '7B（Qwen2.5-VL-7B）：<b>28</b> 个块，每块自注意力 + MLP，维度 3584，FFN 18944，28 个注意力头' : `56B：<b>118</b> 层 = 7 + 2 + 9×11 + 10；注意力只有 <b>10</b> 层（${(10 / 118 * 100).toFixed(1)}%），维度 8192，FFN 32768`);
    } };
  }

  /* ---------- scene 5: the SFT data pipeline ---------- */
  function s5(G) {
    let srcI = 0;
    const PATH = [
      ['视频片段', '9.9K 段 / 1.2M 段', '人工或 VLM 描述', 'LLM 出题（6 题）', 'DeepSeek-R1 推理', '规则清洗改写'],
      ['长演示 → 短片段', 'AgiBot 3,300 → 19.8K 段', 'VLM 结构化描述', '“下一个子任务？”', 'DeepSeek-R1 推理', '规则清洗改写'],
      ['首帧切 2×2 + 7 张干扰', '3,000 张 → 11K', 'VLM 描述 32 块', '同图 3 帧 + 某方向', 'R1 解题，只留答对', '—'],
      ['片段 + 倒放', '30,000 段', '（不经描述）', '正放还是倒放？', 'VLM 写推理（告诉它答案）', '每方向两条'],
      ['LIBERO 仿真', '10K 段', '（不经描述）', '有物体消失吗？', '中间版 7B 写推理（带提示）', '去掉提示']
    ];
    const X = [-11, -6.6, -2.2, 2.2, 6.6, 11], CL = [COL.vid, COL.vid, COL.vit, COL.onto, COL.r1, COL.sft];
    const B = X.map((x, i) => { const b = block(3.4, 1.5, 1.6, CL[i], [x, 5.4, 0]); G.add(b); return b; });
    const STEP = ['片段', '规模', '描述', '出题', '推理链', '后处理']; X.forEach((x, i) => G.add(lab(STEP[i], [x, 6.85, 0], { size: 18 }))); const L2 = X.map((x, i) => dynLab(G, [x, i % 2 ? 3.0 : 4.0, 0.9], { size: 15 }));
    const out = block(3.6, 1.2, 1.6, COL.sft, [6.6, 1.4, 0]); G.add(out, lab('SFT 样本 <片段, 问题, 答案, 推理>', [3.0, 0.1, 1.2], { size: 16 }));
    wire(G, [[11, 4.6, 0], [11, 1.4, 0], [8.4, 1.4, 0]], COL.sft, { opacity: 0.6 });
    const f = stream(G, 12, COL.white, 0.15);
    const ctls = [{ label: '来源', items: ['常识', '具身', '拼图', '时间箭头', '物体恒存'], get: () => srcI, set: k => { srcI = k; } }];
    const NOTE = ['问题必须<b>不能</b>从描述里直接读到答案，否则 R1 只是检索', '具身：R1 看不到画面，提示里放状态-动作描述、问题和总目标（附录 A.3）', '拼图：R1 读 32 块的文字描述来解题，<b>只保留答对的</b>样本', '时间箭头：R1 那套效果不好，改为<b>直接让 VLM 写</b>，提示里告诉它正放还是倒放', '物体恒存：描述流程效果不好，用<b>中间版 Cosmos-Reason1-7B</b>，生成时提示谁消失，训练数据里去掉提示'];
    return { ctls, update(p) {
      const P = PATH[srcI]; L2.forEach((fn, i) => fn(P[i]));
      const k = seg(p, 0, 0.85) * 6; B.forEach((b, i) => { glow(b, k > i ? 0.5 : 0.05); const skip = P[i].startsWith('（') || P[i] === '—'; b.material.opacity = skip ? 0.35 : 1; b.material.transparent = skip; });
      f([[-11, 5.4, 1.0], [11, 5.4, 1.0]], (p * 3) % 1, 1);
      cap(NOTE[srcI]);
    } };
  }

  /* ---------- scene 6: self-supervised intuitive physics, generated live ---------- */
  function s6(G) {
    let task = 0; const sub = new THREE.Group(); G.add(sub); let built = -1, upd = () => {};
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); built = task;
      if (task === 0) {
        /* 8 images, 2x2 tiles each; image 0 is the query. Shuffle all but frame 1 (which stays the query's top-left) */
        const r = L.rng(7), tiles = []; for (let im = 0; im < 8; im++) for (let q = 0; q < 4; q++) tiles.push({ im, q });
        const rest = tiles.slice(1); for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
        const order = [tiles[0], ...rest];
        const hue = im => (im * 0.137 + 0.05) % 1, col = (im, q) => new THREE.Color().setHSL(hue(im), 0.55, 0.35 + 0.12 * q).getHex();
        const objs = order.map((t, k) => { const b = block(1.15, 1.15, 0.15, col(t.im, t.q), [0, 0, 0], { edges: false }); sub.add(b); return { b, t, k }; });
        const lbl = objs.map(o => { const l = lab(String(o.k + 1), [0, 0, 0], { size: 13 }); sub.add(l); return l; });
        const right = objs.find(o => o.t.im === 0 && o.t.q === 1), same = objs.filter(o => o.t.im === 0 && o.k > 0).map(o => o.k + 1);
        const home = o => [-9 + (o.t.q % 2) * 1.2, 6.6 - Math.floor(o.t.q / 2) * 1.2 + (o.t.im ? 30 : 0), 0];
        const grid = o => [-4 + (o.k % 8) * 1.45, 6.4 - Math.floor(o.k / 8) * 1.45, 0];
        sub.add(lab('原图（第 1 张）', [-8.4, 8.2, 0], { size: 17 }));
        upd = p => {
          const a = seg(p, 0.1, 0.45), h = seg(p, 0.55, 0.8);
          objs.forEach((o, i) => { const g = grid(o), s = home(o), from = o.t.im === 0 ? s : [g[0], g[1] + 6, g[2]], q = [L.lerp(from[0], g[0], a), L.lerp(from[1], g[1], a), 0]; o.b.position.set(...q); o.b.visible = o.t.im === 0 || a > 0.02; const hit = o.t.im === 0 && o.k > 0; glow(o.b, h * (hit ? (o === right ? 0.9 : 0.5) : 0)); o.b.scale.z = 1 + (o === right ? 3 * h : 0); lbl[i].position.set(q[0], q[1] - 0.82, 0.2); lbl[i].visible = a > 0.9; });
          cap(p < 0.5 ? '第 1 张图切成 2×2，和 7 张干扰图的 28 块一起打乱成 <b>32 帧</b>（第 1 帧固定是原图左上块）' : `答案生成时就知道：和第 1 帧同图的是第 <b>${same.join('、')}</b> 帧，原图右上块（在第 1 帧<b>右边</b>）是第 <b>${right.k + 1}</b> 帧`);
        };
      } else if (task === 1) {
        /* bouncing ball, restitution 0.8; forward lane and reversed lane, energy computed per frame */
        const g = 9.81, e = 0.8, dt = 1 / 60, N = 240, ys = [], vs = []; let y = 2.0, v = 0;
        for (let i = 0; i < N; i++) { ys.push(y); vs.push(v); v -= g * dt; y += v * dt; if (y < 0) { y = 0; v = -v * e; } }
        const E = i => g * ys[i] + 0.5 * vs[i] * vs[i];
        const lanes = [-4.5, 4.5].map((x, k) => { const ball = new THREE.Mesh(BALL, L.mat(k ? COL.r1 : COL.sft)); ball.scale.setScalar(0.45); sub.add(ball); sub.add(block(5, 0.15, 2, COL.grey, [x, 0.0, 0])); sub.add(lab(k ? '倒放' : '正放', [x, 8.6, 0], { size: 20 })); const eb = bar(sub, x + 3.2, 0, 0.6, k ? COL.r1 : COL.sft); return { x, ball, eb, k }; });
        const rds = [dynLab(sub, [-4.5, 7.4, 0], { size: 16 }), dynLab(sub, [4.5, 7.4, 0], { size: 16 })];
        upd = p => {
          const i = Math.min(N - 1, Math.floor(p * N));
          lanes.forEach((ln, k) => { const j = k ? N - 1 - i : i; ln.ball.position.set(ln.x, 0.55 + ys[j] * 3, 0); const en = E(j); ln.eb.userData.set(en / E(0) * 5); rds[k](`机械能 ${(en / E(0) * 100).toFixed(0)}%`); });
          const rev = E(N - 1 - i) > E(Math.max(0, N - 2 - i)) + 1e-9;
          cap(`正放：每次落地能量少 <b>${(100 - e * e * 100).toFixed(0)}%</b>（反弹系数 0.8）；倒放：球自己越弹越高、能量凭空增加，这就是“反物理”的线索`);
        };
      } else {
        /* object permanence: an occluder sweeps across 4 objects; object 2 is removed while hidden */
        const OB = [[-6, COL.sft, '碗'], [-2, COL.r1, '盘'], [2, COL.llm, '杯'], [6, COL.onto, '盒']];
        sub.add(block(16, 0.2, 4, COL.grey, [0, -0.1, 0]));
        const objs = OB.map(([x, c, t]) => { const b = block(1.4, 1.4, 1.4, c, [x, 0.7, 0]); sub.add(b, lab(t, [x, 2.3, 0], { size: 17 })); return { b, x }; });
        const wall = block(3.2, 3.6, 0.3, COL.dim, [0, 1.8, 2.0], { opacity: 0.92 }); sub.add(wall);
        const rd = dynLab(sub, [0, 7.4, 0], { size: 18, border: 'rgba(56,209,255,.6)' });
        upd = p => {
          const wx = L.lerp(-11, 11, seg(p, 0.05, 0.75)); wall.position.x = wx;
          const gone = wx > -2 + 2.5; objs.forEach((o, i) => { const hidden = Math.abs(o.x - wx) < 1.6 + 0.7; o.b.visible = !(i === 1 && gone); glow(o.b, hidden ? 0 : 0.25); });
          const vis = objs.filter((o, i) => !(i === 1 && gone) && Math.abs(o.x - wx) >= 2.3).length;
          rd(`看得见 ${vis} 个 · ${gone ? '盘子被挡住时删掉了' : '盘子还在'}`);
          cap(p < 0.75 ? '遮挡板扫过桌面（代替相机绕行和机械臂的遮挡），<b>盘子被完全挡住时从场景里删掉</b>' : '遮挡结束，盘子没再出现：答案“有物体违反恒存”在生成时就确定，<b>不需要人工标注</b>');
        };
      }
    }
    const ctls = [{ label: '题型', items: ['空间拼图', '时间箭头', '物体恒存'], get: () => task, set: k => { task = k; } }];
    return { ctls, update(p) { if (built !== task) rebuild(); upd(p); } };
  }

  /* ---------- scene 7: data mixture ---------- */
  function s7(G) {
    let view = 1; G.add(L.grid(34, 34)); const sub = new THREE.Group(); G.add(sub); let built = -1, bs = [];
    const NM = ['常识自由', '常识选择', 'BridgeData', 'RoboVQA', 'AgiBot', 'HoloAssist', 'AV', '拼图', '时间箭头', '物体恒存'];
    const CL = [COL.onto, COL.onto, COL.vit, COL.vit, COL.vit, COL.vit, COL.vit, COL.rl, COL.rl, COL.rl];
    const V = [[99000, 1200000, 129200, 218500, 19400, 136300, 12400, 0, 0, 0], [59400, 605000, 129100, 920000, 19400, 136300, 12300, 11000, 30000, 10000], [0, 5133, 240, 252, 200, 200, 200, 3998, 9994, 10087]];
    const fmt = v => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e4 ? (v / 1e3).toFixed(1) + 'K' : String(v);
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); built = view; bs = [];
      NM.forEach((t, i) => { const x = -11.7 + i * 2.6, v = V[view][i]; const b = bar(sub, x, 0, 1.6, CL[i]); const l = lab(v ? fmt(v) : '—', [x, 0, 0], { size: 15 }); sub.add(l, lab(t, [x, -0.5, 1.6], { size: 15 })); bs.push({ b, l, v }); });
      sub.add(lab(['表 4 · 理解：合计 1.81M', '表 4 · 推理：合计 1.93M', '表 5 · RL：合计 30,304'][view] + '（柱高 = log₁₀）', [0, 9.6, 0], { size: 19, border: 'rgba(56,209,255,.6)' }));
    }
    const ctls = [{ label: '表', items: ['SFT 理解', 'SFT 推理', 'RL'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      if (built !== view) rebuild(); const g = seg(p, 0, 0.6);
      bs.forEach(o => { const h = o.v ? (Math.log10(o.v) - 1.5) * 1.8 * g : 0.001; o.b.userData.set(h); o.l.position.y = h + 0.45; });
      cap(['理解：常识选择题 <b>1.2M</b> 占三分之二（正文说是约 2.4M 题，见精读读者注 9）', '推理：RoboVQA <b>920K</b> 最多；直觉物理三项共 51K', 'RL：直觉物理 <b>24,079</b> 题占 79%；具身每个来源只有 200 到 252 题'][view]);
    } };
  }

  /* ---------- scene 8: GRPO group advantages, toy ---------- */
  function s8(G) {
    let pi = 1; const PS = [0.5, 0.7, 0.9], NG = 8, GS = 9; G.add(L.grid(34, 34));
    const balls = inst(BALL, NG * GS), bars = inst(BOX, NG * GS); G.add(balls, bars);
    const rd = dynLab(G, [0, 10.0, 0], { size: 18, border: 'rgba(56,209,255,.6)' });
    G.add(lab('每列 = 一道题的 9 个回答 · 柱 = 优势 Aᵢ', [0, 8.8, 0], { size: 16 }));
    const glabs = Array.from({ length: NG }, (_, g) => dynLab(G, [-10.5 + g * 3.0, -1.6, 0], { size: 15 }));
    function sample(p, ng, seed) { const r = L.rng(seed), out = []; for (let g = 0; g < ng; g++) { const rw = []; for (let i = 0; i < GS; i++) rw.push(r() < p ? 1 : 0); out.push(rw); } return out; }
    const adv = rw => { const m = rw.reduce((a, b) => a + b, 0) / GS, sd = Math.sqrt(rw.reduce((a, b) => a + (b - m) ** 2, 0) / GS); return rw.map(x => sd > 0 ? (x - m) / sd : 0); };
    const ctls = [{ label: '答对率 p', items: ['0.5', '0.7', '0.9'], get: () => pi, set: k => { pi = k; } }];
    return { ctls, update(p) {
      const P = PS[pi], data = sample(P, NG, 101 + pi), shown = Math.ceil(seg(p, 0, 0.7) * NG);
      let zero = 0;
      data.forEach((rw, g) => { const A = adv(rw), same = A.every(a => a === 0); if (g < shown && same) zero++;
        rw.forEach((x, i) => { const k = g * GS + i, on = g < shown, xg = -10.5 + g * 3.0 + (i % 3 - 1) * 0.75, zz = (Math.floor(i / 3) - 1) * 0.75;
          setI(balls, k, [xg, 6.6, zz], on ? 0.28 : 0.001); colI(balls, k, hex3(same ? COL.grey : x ? COL.ok : COL.bad));
          const h = A[i] * 1.6; setI(bars, k, [xg, 3.2 + h / 2, zz], on ? [0.5, Math.max(0.03, Math.abs(h)), 0.5] : 0.001); colI(bars, k, hex3(same ? COL.grey : A[i] > 0 ? COL.ok : COL.bad)); });
        glabs[g](g < shown ? (same ? '全同 · 无信号' : `${rw.reduce((a, b) => a + b, 0)}/9 对`) : ''); });
      done(balls); done(bars);
      const big = sample(P, 4000, 999 + pi).filter(rw => rw.every(x => x === rw[0])).length / 4000, th = P ** GS + (1 - P) ** GS;
      rd(`p = ${P} · 模拟 4000 组全同比例 ${(big * 100).toFixed(1)}% · 公式 p⁹+(1−p)⁹ = ${(th * 100).toFixed(1)}%`);
      cap(`p = <b>${P}</b>：画面里 ${shown} 组中 <b>${zero}</b> 组全对或全错，优势全为 0；理论上占 <b>${(th * 100).toFixed(1)}%</b>`);
    } };
  }

  /* ---------- scene 9: the RL framework ---------- */
  function s9(G) {
    let mode = 0;
    const disp = block(2.4, 6, 1.8, COL.llm, [-10.5, 4.6, 0]); G.add(disp, lab('调度器', [-10.5, 8.2, 0], { size: 20 }));
    const ro = [0, 1, 2].map(i => { const b = block(3.6, 1.4, 1.4, COL.rl, [-1.5 + i * 0.4, 7.6 - i * 0.25, -i * 0.6]); G.add(b); return b; }); G.add(lab('采样节点 × N（DP/PP/TP）', [-1.0, 9.3, 0], { size: 18 }));
    const rw = block(2.6, 0.9, 1.2, COL.r1, [-1.0, 5.4, 0]); G.add(rw, lab('奖励 + 优势', [-1.0, 4.5, 0.9], { size: 16 }));
    const pt = block(4.2, 1.6, 1.6, COL.vit, [-1.0, 2.0, 0]); G.add(pt, lab('策略训练（5D 并行）', [-1.0, 0.6, 0.9], { size: 17 }));
    const ref = block(2.6, 1.4, 1.4, COL.proj, [6.0, 4.6, 0]); G.add(ref, lab('参考模型 · KL', [6.0, 6.0, 0], { size: 16 }));
    const fP = stream(G, 8, COL.white, 0.13), fD = stream(G, 6, COL.r1, 0.14), fW = stream(G, 6, COL.vit, 0.14);
    G.add(lab('NCCL 送回参数', [-5.6, 4.6, 0], { size: 15 }));
    /* gantt */
    const GX = -9, GW = 22, GY = -2.2; panel(G, GX - 0.4, GY - 2.9, -0.4, GW + 0.8, 3.6, { opacity: 0.35 });
    const gant = inst(BOX, 40); G.add(gant); const grd = dynLab(G, [GX + GW / 2, GY + 1.2, 0], { size: 16 });
    G.add(lab('采样', [GX - 1.4, GY, 0], { size: 15 }), lab('训练', [GX - 1.4, GY - 1.6, 0], { size: 15 }));
    const RO = [3.0, 4.2, 2.6, 3.8, 3.2], TR = 2.0;
    function sched() { const a = [], b = []; let t = 0;
      if (mode === 1) { RO.forEach(r => { a.push([t, r]); t += r; b.push([t, TR]); t += TR; }); return { a, b, T: t }; }
      let tr = 0; RO.forEach((r, i) => { const s = i ? Math.max(a[i - 1][0] + a[i - 1][1], 0) : 0; a.push([s, r]); const ts = Math.max(s + r, tr); b.push([ts, TR]); tr = ts + TR; }); return { a, b, T: Math.max(tr, a[a.length - 1][0] + a[a.length - 1][1]) }; }
    const ctls = [{ label: '部署', items: ['异步异构（论文）', '同置同步（对照）'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const q = (p * 3) % 1;
      fP([[-9.3, 7.4, 0.6], [-3.3, 7.4, 0.6]], q, 1); fD([[-1.0, 6.9, 0.8], [-1.0, 2.8, 0.8]], q, 1); fW([[-3.1, 2.0, 0.9], [-5.6, 4.6, 0.9], [-3.3, 7.0, 0.9]], q, 1);
      ro.forEach((b, i) => glow(b, 0.2 + 0.3 * Math.abs(Math.sin((p * 6 + i) * Math.PI)))); glow(pt, 0.3);
      const S = sched(), sc = GW / 27, cut = p * 27; let k = 0;
      [[S.a, GY, COL.rl], [S.b, GY - 1.6, COL.vit]].forEach(([arr, y, c]) => arr.forEach(([s, d]) => { const e = Math.min(s + d, cut), w = Math.max(0, e - s); setI(gant, k, [GX + (s + w / 2) * sc, y, 0], w > 0 ? [w * sc - 0.04, 0.9, 0.3] : 0.001); colI(gant, k, hex3(c)); k++; }));
      for (; k < 40; k++) setI(gant, k, [0, -50, 0], 0.001); done(gant);
      const busyR = RO.reduce((a, b) => a + b, 0), busyT = TR * RO.length;
      grd(`玩具时间线：总时长 ${S.T.toFixed(1)} · 训练卡利用率 ${(busyT / S.T * 100).toFixed(0)}%`);
      cap(mode === 1 ? '同置同步：采样和训练轮流用同一批卡，最长的回答拖住整批，训练<b>空等</b>' : '异构异步：采样一直在跑，训练拿到一批就更新、再用 <b>NCCL</b> 把参数推回采样节点');
    } };
  }

  /* ---------- scene 10: results; every bar is a number from the paper ---------- */
  function s10(G) {
    let view = 1; G.add(L.grid(34, 34)); const sub = new THREE.Group(); G.add(sub);
    const T = [
      { t: '表 7 · 物理常识（%）', g: ['空间', '时间', '其他物理', '平均'], s: [['Qwen2.5-VL-7B', COL.grey, [48.8, 56.4, 37.2, 47.4]], ['CR1-7B', COL.vit, [54.2, 58.7, 50.0, 54.3]], ['Nemotron-H-56B', COL.dim, [61.3, 68.1, 45.1, 58.2]], ['CR1-56B', COL.mamba, [61.3, 65.5, 53.9, 60.2]], ['o1', COL.r1, [63.8, 58.1, 58.0, 59.9]]] },
      { t: '表 8 · 具身推理（%）', g: ['Bridge', 'RoboVQA', 'AgiBot', 'Holo', 'AV', 'RoboFail', '平均'], s: [['Qwen2.5-VL-7B', COL.grey, [38.0, 82.5, 40.4, 50.0, 36.0, 57.6, 50.8]], ['CR1-7B', COL.vit, [58.8, 83.8, 49.4, 63.0, 55.6, 60.0, 61.8]], ['CR1-56B', COL.mamba, [65.0, 80.0, 47.6, 57.8, 65.8, 66.2, 63.7]], ['o1', COL.r1, [42.0, 80.0, 44.0, 63.0, 37.0, 61.0, 54.5]]] },
      { t: '表 9 · RL 前后，7B（%）', g: ['常识', 'Bridge', 'RoboVQA', 'AgiBot', 'Holo', 'AV', 'RoboFail', '平均'], s: [['SFT', COL.vit, [54.3, 58.8, 83.8, 49.4, 63.0, 55.6, 60.0, 60.7]], ['+ RL', COL.rl, [56.2, 73.5, 86.8, 54.2, 60.0, 67.0, 62.0, 65.7]]] },
      { t: '表 10 · 直觉物理（%）', g: ['时间箭头', '空间拼图', '物体恒存', '平均'], s: [['随机', COL.dim, [50, 25, 50, 41.7]], ['Qwen2.5-VL-7B', COL.grey, [50.2, 27.2, 48.8, 42.1]], ['GPT-4o', COL.gpt, [50, 77, 48, 58.3]], ['CR1-7B', COL.vit, [56.0, 85.4, 82.0, 74.5]], ['+ RL', COL.rl, [64.5, 94.0, 86.0, 81.5]]] }
    ];
    let bars = [], last = -1;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = view; const v = T[view], Ng = v.g.length, Ns = v.s.length, gw = Math.min(6.2, 27 / Ng), w = Math.min(1.1, (gw - 0.5) / Ns);
      v.g.forEach((nm, i) => { const x0 = (i - (Ng - 1) / 2) * gw; sub.add(lab(nm, [x0, -0.2, 2.4], { size: 17 }));
        v.s.forEach(([sn, c, vals], j) => { const x = x0 + (j - (Ns - 1) / 2) * (w + 0.06), b = block(w, 1, w, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(vals[i].toFixed(1), [x, 0, 0], { size: 13 }); l.visible = Ns <= 2 || Ng <= 4 || i === Ng - 1; sub.add(l); bars.push({ b, l, v: vals[i], hl: view === 2 && i === 4 && j === 1 }); }); });
      v.s.forEach(([sn, c], j) => sub.add(lab('■ ' + sn, [-12 + j * 5.0, 9.4, 0], { size: 16, color: css(c) })));
      sub.add(lab(v.t, [0, 10.6, 0], { size: 20, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const ctls = [{ label: '表', items: ['表 7', '表 8', '表 9', '表 10'], get: () => view, set: k => { view = k; } }];
    const MSG = ['56B 平均 <b>60.2</b> 略高于 o1 的 59.9；但时间类 65.5 低于自己的骨干 68.1', '两个尺寸都比骨干高 10 个点以上；RoboVQA 和 RoboFail 是二选一，随机 50%', 'RL 平均 +5.0（精确是 4.96）；唯一下降的是 <b>HoloAssist 63.0 → 60.0</b>，不是正文说的 RoboFail', '现有模型在时间箭头和物体恒存上接近随机；7B 经 SFT + RL 到 <b>64.5 / 94.0 / 86.0</b>'];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const g = seg(p, 0, 0.5); bars.forEach(({ b, l, v, hl }) => { const h = Math.max(0.02, v / 100 * 7.5 * g); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.35; glow(b, hl ? 0.6 * seg(p, 0.5, 0.7) : 0); });
      cap(MSG[view]);
    } };
  }

  /* ---------- scene 11: one inference call ---------- */
  function s11(G) {
    let mode = 0; const M = [{ n: '论文评测', mt: 6144, runs: 5, t: 0.6 }, { n: 'evaluate.yaml', mt: 1024, runs: 1, t: 0.6, retry: true }, { n: '模型卡建议', mt: 4096, runs: 1, t: 0.6 }];
    const THINK = 1400, ANS = 12;
    for (let i = 0; i < 6; i++) G.add(block(0.08, 1.8, 2.4, COL.vid, [-11.5 + i * 0.45, 5.0, 0], { opacity: 0.6 }));
    G.add(lab('视频 · fps 4', [-10.4, 6.6, 0], { size: 17 }), lab('问题 + “按 <think><answer> 格式回答”', [-9.4, 2.5, 0.8], { size: 15 }));
    const mdl = block(3.0, 2.6, 2.4, COL.vit, [-4.6, 5.0, 0]); G.add(mdl, lab('Cosmos-Reason1-7B', [-4.6, 7.0, 0], { size: 18 }));
    const thinkB = block(1, 1.0, 1.0, COL.think, [0, 5.0, 0], { edges: false }), ansB = block(1, 1.0, 1.0, COL.rl, [0, 5.0, 0], { edges: false }), limB = block(0.08, 2.2, 1.6, COL.bad, [0, 5.0, 0]);
    G.add(thinkB, ansB, limB, lab('<think>', [-1.4, 6.2, 0], { size: 16, color: css(COL.think) }));
    const rd = dynLab(G, [3.6, 9.2, 0], { size: 17, border: 'rgba(56,209,255,.6)' }), rd2 = dynLab(G, [3.6, 1.8, 0], { size: 16 });
    const X0 = -2.6, SC = 12 / 2000;
    const ctls = [{ label: '设置', items: M.map(m => m.n), get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const m = M[mode], need = THINK + ANS, g = seg(p, 0.05, 0.75); let lim = m.mt, tries = 0;
      if (m.retry) while (lim < need && tries < 10) { tries++; lim = m.mt + 256 * tries; }
      const firstCut = m.mt < need, gen = Math.min(need, lim) * g, th = Math.min(THINK, gen), an = Math.max(0, gen - THINK);
      thinkB.scale.x = Math.max(0.01, th * SC); thinkB.position.x = X0 + th * SC / 2; ansB.scale.x = Math.max(0.01, an * SC); ansB.position.x = X0 + THINK * SC + an * SC / 2; ansB.visible = an > 0;
      limB.position.x = X0 + Math.min(m.mt, 2000) * SC; limB.visible = m.mt <= 2000; glow(mdl, 0.3);
      rd(`${m.n}：max_tokens ${m.mt} · 温度 ${m.t} · top-p 0.95 · ${m.runs} 次${m.runs > 1 ? '平均' : ''}`);
      rd2(firstCut ? `第一次在 ${m.mt} token 处截断，没有 <answer>；重试 ${tries} 次后上限 ${lim}` : '推理链完整，取 <answer> 里的字母');
      cap(firstCut ? `推理链约 ${THINK} token（玩具）超过 <b>${m.mt}</b>：第一次截断，脚本每次加 256 重试，第 <b>${tries}</b> 次才拿到答案` : `上限 ${m.mt} 足够：<b>&lt;think&gt;</b> 约 ${THINK} token，再出 <b>&lt;answer&gt;</b>，和标准答案比字母`);
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
  window.__cr1Debug = { get cap() { return $('cap').textContent; } };
})();
