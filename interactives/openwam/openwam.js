'use strict';
/* OpenWAM (arXiv 2609.07398) taken apart into eleven animated scenes. Dimensions and settings come from the paper, the
   official code at commit 1dcaeea and the Hugging Face checkpoint configs (OpenWAM-Alpha-Pretrain-Foundation-Model,
   OpenWAM-Alpha-Sim-LIBERO). Each scene's update(p) is a pure function of the timeline p plus the current toggles.
   Scenes 3, 5, 6, 7, 9 and 10 compute their numbers live from the formulas; scene 6 samples a fixed-seed toy set.
   No OpenWAM network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { video: 0x3aa8e0, action: 0xf0963c, vlm: 0xb48cff, attn: 0xd45fa0, text: 0x9d8cff, frozen: 0x6b7794, ok: 0x4fc98a, bad: 0xe05d5d, gold: 0xf2c14e, data: 0x7cb8ff, dim: 0x46506a, white: 0xeef2fa, sim: 0x8e9bb8, ego: 0x4fc98a, robot: 0x38d1ff, syn: 0xf2a0a0, hand: 0xd45fa0, res: 0x8e9bb8 };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const live = t => `<p class="guess"><b>现算 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const fmt = n => n.toLocaleString('en-US');
  /* eq. (3) / §5.1.2 warp */
  const fw = (s, a) => a * s / (1 + (a - 1) * s);

  const SCENES = [
    { n: 1, part: '总览', title: '三块：Infra、Study、α', sub: '点方块跳到对应那一幕', dur: 12, cam: [0.0, 1.05, 38, [0, 3.6, 0]],
      html: dl([['Infra', '模块化：编码器 × 4、视频骨干 × 5、掩码 × 4、结构 × 6；一个训练器、一个策略服务器、8 个仿真基准'], ['Study', '在 RoboTwin2.0 上受控比较：继承什么、怎样协同、能否跨域'], ['α', 'Wan2.2-TI2V-5B + 1B ActionDiT，联合自注意力，Mutual，同步去噪；518.5M 帧预训练']]) +
        '<p>左边是基础设施：任何结构都由“视觉编码器 + 流骨干 + 注意力掩码”组合出来，训练器和服务器不知道跑的是哪种结构。中间是用它做的三组实验，每组选出一个默认值。右边是把默认值拼起来、放大规模训练出的 OpenWAM-α。</p>' +
        '<p>后面 10 幕沿着 α 的数据流走一遍：数据 → token → 网络 → 训练 → 推理 → 部署 → 预训练 → LIBERO 微调和评测 → 结果。</p>' + src('§1 · §3 · 图 1 · 图 2 · 表 3') },
    { n: 2, part: '§3.4 动作空间', title: '80 维统一动作空间和有效掩码', sub: '换数据集，看哪些格子有监督', dur: 12, cam: [0.0, 0.86, 34, [0, 0.0, 0.6]],
      html: dl([['布局', '左臂 34 = 位置 3 + rot6d 6 + 夹爪 1 + 灵巧手 24；右臂 34；保留 12'], ['式 (4)', 'u = Scatter_π(Norm(a))，a = Norm⁻¹(Gather_π(u))'], ['掩码 m', '只有被映射的槽参与式 (2) 的动作损失'], ['LIBERO', 'unify_action_map ["0-9"]：10 维进左臂']]) +
        '<p>格子阵列是一个训练样本的动作张量：32 行是 32 个时间步，80 列是统一空间的槽。亮的格子有监督，暗的格子没有梯度，推理时停在噪声路径上，服务器最后只取映射过的槽。</p>' +
        '<p>第一视角人类视频没有动作，整个张量都被掩掉，只监督世界流。这就是“一个动作头服务所有形态”的做法：槽的含义固定，相同的结构落在相同的坐标。</p>' +
        guess('灵巧手（Wuji + Tianji）的槽位映射论文没给，只说是 9 维末端位姿 + 21 个手指自由度；这里放在左臂的 0-8 和 10-30 槽，是我的猜测。') +
        src('§3.4 式 (4) · §5.1.2 · configs/dataloader/libero.yaml · HF 基座 config.yaml（robocoin、oxe_droid、interndata_a1 的 unify_action_map）') },
    { n: 3, part: '§5.1.1 分词', title: '33 帧窗口怎样变成 392 个 token', sub: '动作 32 步；视频每 4 帧取 1，再 4 帧压成 1 个隐帧', dur: 15, cam: [0.0, 1.12, 32, [-1.2, 4.6, 0]],
      html: dl([['窗口', 'num_frames 33（LIBERO 10 fps，3.3 s）'], ['动作块', '33 − 1 = 32 步，每步一个 token，宽 1024'], ['视频', 'stride 4 → 第 0, 4, …, 32 帧，共 9 帧'], ['Wan2.2-VAE', '首帧单独、之后每 4 帧一组：1 + 8/4 = 3 个隐帧'], ['token', '384 × 320 ÷ 16 = 24 × 20，再 2 × 2 patch = 120 / 隐帧']]) +
        '<p>动作块长度来自 num_frames，video_stride 只对视频抽帧。两者合起来，9 个视频帧正好是 VAE 的“1 + 4 + 4”分组，3 个隐帧里第一个是当前观测的干净锚点，后两个是要去噪的未来。</p>' +
        '<p>于是一次前向里有 120 个干净视频 token、240 个带噪视频 token、32 个带噪动作 token。只有后两种参与损失。</p>' +
        live('开关里 stride 2 和 8 是假设，α 固定为 4。帧数 = 32/stride + 1，隐帧数 = 1 + (帧数 − 1)/4，token 数 = 隐帧 × 120。') +
        src('§5.1.1 · 表 9 · libero.yaml 注释 · lerobot_v3_reader.py 第 335 行 · vae.py WanVideoVAE38（upsampling_factor 16）') },
    { n: 4, part: '§3.1 / §4.2.1 结构', title: '30 层双流，每层共享一次注意力', sub: '换结构，看连法和表 1 的成绩', dur: 14, cam: [0.25, 1.15, 36, [0, 6.6, 0]],
      html: dl([['世界流', 'Wan2.2-TI2V-5B DiT：30 层，dim 3072，24 头'], ['动作流', 'ActionDiT：30 层，dim 1024，ffn 4096'], ['桥接', '每层把两流的 Q/K/V 投影到 24 × 128 的共享空间，一起做注意力，再回各自的残差流'], ['条件', '两流各自用交叉注意力读 umT5 文本 + 本体 token']]) +
        '<p>双系统联合自注意力里，动作流有自己的全部参数（容量），但每一层都和视频流在同一个注意力里交换信息。表 1 里它是双系统最好的（92.36），三系统再加一个只读的 VLM 理解流，92.60。</p>' +
        '<p>单系统把动作 token 塞进视频序列，没有专用容量（Vanilla）或只有专用 FFN（MoE），都低 7 点左右。交叉注意力让动作单向读视频特征；梯度如果回传进视频流反而更差（88.25 对截断后的 91.85）。IDM 先生成视频再推动作，87.95。</p>' +
        live('ActionDiT 参数按代码的层定义当场算：每块 2 个注意力（各 4 个投影 + q/k RMSNorm）+ FFN + 调制，30 块，再加嵌入和输出头。') +
        guess('非“双系统联合自注意力”的几种只画连接关系，粗细不按比例。') +
        src('§3.1 · §4.2.1 表 1 · §5.1.1 · separate_action_dit.py · HF config.yaml') },
    { n: 5, part: '§4.2.2 掩码', title: '谁能看谁：四种可见性', sub: '扫描线是查询行；换模式看表 2', dur: 12, cam: [0.0, 0.95, 27, [0, 4.6, 0]],
      html: dl([['式 (1)', 'M = [[M_V←V, M_V←A], [M_A←V, M_A←A]]'], ['固定的', 'V←V 首帧因果；A←A 双向'], ['Isolated', '87.41'], ['Video Sees Action', '87.63'], ['Action Sees Video', '92.39'], ['Mutual', '92.15（从头训练）；预训练后最好']]) +
        '<p>行是查询（Q），列是键（K）。首帧那 120 个干净 token 只看自己，免得条件被噪声污染。带噪视频 token 互相看、也看首帧。动作 token 互相看。四种模式只差右上（视频看动作）和左下（动作看视频）两块。</p>' +
        '<p>结论按“动作能否看到世界”干净地分成两组，差约 5 点。反方向的那块从头训练时几乎没影响，预训练后 Mutual 略好，α 用 Mutual。</p>' +
        live('可见比例按真实 token 数 120 / 240 / 32 算，矩阵是缩小画的。') + src('§3.1 式 (1) · §4.2.2 图 8 表 2 · §4.3.3 图 11') },
    { n: 6, part: '§3.2 / §5.1.2 训练', title: '两流各抽各的噪声，覆盖整个平面', sub: '点是训练样本 (t_v, t_a)；切换 ρ', dur: 14, cam: [0.0, 1.32, 27, [0, 6.0, 0]],
      html: dl([['插值', 'z^tv = t_v z + (1 − t_v) ε，t = 0 纯噪声'], ['目标', '速度 z − ε；动作同理，乘掩码 m'], ['抽样', 't = 1 − f_ρ(u)，u ~ U[0, 1]，ρ = 5，两流独立'], ['权重', 'w(t) 钟形，峰在中间噪声；λv = λa = 1']]) +
        '<p>因为 t_v 和 t_a 独立抽，训练覆盖了整个噪声平面。推理时无论两流同步走对角线，还是一流领先，都在训练见过的区域里。这是第 7 幕能自由试调度的前提。</p>' +
        '<p>ρ = 5 把样本推向高噪声一侧（图里左下）：t &lt; 0.5 的概率从 50% 变成 5/6 ≈ 83.3%。</p>' +
        live('600 个点用固定种子现抽；直方图和比例也是现算。f_ρ(u) = ρu / (1 + (ρ − 1)u)。') + src('§3.2 式 (2) · §5.1.2 · 图 12(c) · action_backbone/scheduler.py 第 63 行') },
    { n: 7, part: '§4.2.3 推理', title: '推理时沿哪条路去噪', sub: '同步对角线最好；异步曲线按式 (3) 画', dur: 13, cam: [0.0, 1.32, 27, [0, 6.0, 0]],
      html: dl([['同步', '(t_v, t_a) 沿对角线；93.0'], ['方差平移', '领先流 f_α(s)，α ∈ {4, 8, 16, 32}'], ['线性偏移', '落后流 h_o(s) = max{(s − o)/(1 − o), 0}'], ['α 的部署', 'N = 10，t_i = 1 − f₅(1 − i/10)']]) +
        '<p>坐标是“干净程度”（0 = 噪声），和图 9 一样。曲线在对角线上方表示动作先变干净（动作领先），下方表示视频领先。每条曲线上的数字是图 9 的成功率，没有一条超过同步的 93.0。</p>' +
        '<p>作者的解读：训练时需要世界到动作的信息流，但推理时靠调度去“先想象再行动”没有好处。</p>' +
        '<p>球是 10 个去噪步：同步时第 i 步的干净程度是 i/10，再经过训练用的扭曲 1 − f₅(1 − s) 变成实际时间步 0、0.022、0.048、…、0.643、1，一半的步花在高噪声段。</p>' +
        live('曲线按代码 denoise_schedule.py 的定义画：领先流取 f_α(s)，落后流取 s 或 h_o(s)。右下读数是当前进度的两个时间步。') + src('§3.3 式 (3) · §4.2.3 图 9 · §5.1.3 · denoise_schedule.py') },
    { n: 8, part: '§3.3 / §3.4 部署', title: '一个观测进，一个动作出', sub: '缓冲区空了才推理；切换同步和异步', dur: 16, cam: [0.0, 1.05, 30, [0, 3.4, 0]],
      html: dl([['客户端', '只发图像、指令、状态；不导入模型代码'], ['服务器', '拼画布、映射状态、推理、反归一化、填缓冲区'], ['同步', '缓冲区空了才推理，执行暂停一个推理延迟'], ['异步', '剩 d 个时预取；新块 = 跳过 d + 执行 n + 丢弃 max(H − d − n, 0)'], ['α', '同步，整块 32 步执行；RTX 5090 约 170 ms/块']]) +
        '<p>上面是一个回合的时间线：蓝色是执行动作，橙色是推理。同步模式下每 32 步停一次；异步模式下推理和执行重叠，但新块开头的 d 个动作作废（推理期间旧缓冲已经执行了）。</p>' +
        '<p>LIBERO 是仿真，同步推理时仿真也等着，所以推理延迟不影响成功率，只影响评测耗时。真机上才需要考虑异步。</p>' +
        guess('异步示例取 n = 16、d = 8（d 默认 n/2），这组数是我选的；α 的评测全部用同步。时间按 10 Hz 和 170 ms 画。') +
        src('§3.3 图 3 图 4 · §3.4 图 5 · §5.1.3 · configs/deploy.yaml · openwam/deploy/') },
    { n: 9, part: '§5.2 / 附录 B.1 预训练', title: '5 个来源、155,862 步、公布第 154,000 步', sub: '柱子是表 4；下方是学习率曲线', dur: 14, cam: [0.0, 1.12, 30, [0, 4.4, 0]],
      html: dl([['数据', '518.5M 帧，6,369 小时；第一视角 30%、合成 30%、真机 40%'], ['算力', '128 × H200，约 7 天'], ['batch', '3,072（每卡 24）'], ['步数', '155,862（1 epoch）'], ['公布权重', 'checkpoint_step_154000']]) +
        '<p>柱高是各来源使用的帧数（可切换成原始帧数）。第一视角数据没有动作，只训世界流；三个真机来源给动作打底；InternData-A1 是仿真合成。</p>' +
        '<p>下方曲线是按代码的调度器（线性 warmup 5% 后余弦退火到 1%）算的学习率。公布的基座停在第 154,000 步，这是每 2,000 步保存一次的最后一个点；那时学习率已经降到最低值附近。</p>' +
        '<p>步数 × batch = 478.8M，比 518.5M 帧少 7.7%，原因论文没说（精读页读者注 14）。</p>' +
        live('学习率 lr(k) = 1e-6 + 0.99e-4 · (1 + cos(π(k − 7793)/148069))/2，按 training_utils.py 的 build_cosine_scheduler。') + src('§5.2 表 4 · 附录 B.1 表 9 · HF 基座文件列表和 config.yaml · training_utils.py 第 59-85 行') },
    { n: 10, part: 'LIBERO 复现', title: 'LIBERO：10,690 步微调，2,000 个评测回合', sub: '左边是步数怎么来，右边是评测网格', dur: 16, cam: [0.0, 1.1, 38, [0, 5.0, 0]],
      html: dl([['数据', 'OpenWAM/LIBERO：1,693 条，273,465 帧，10 fps；每帧起一个窗口'], ['微调', 'batch 256，10 epochs，lr 1e-4 cosine，不增强'], ['步数', '⌈273,465 / 256⌉ × 10 = 10,690'], ['评测', '4 套件 × 10 任务 × 50 次；种子 42；开局 30 步；最长 600 / 700 步'], ['分数', '99.6 / 99.6 / 99.8 / 98.2，平均 99.3']]) +
        '<p>左边：步数公式是 ⌈⌈帧数 / 每卡 batch⌉ / 进程数⌉ × 轮数。官方检查点配置每卡 4，即 64 个进程。用 8 卡复现要把每卡 batch 调到 32（或梯度累积 8），才和官方一样；直接用 train.yaml 默认（每卡 16、5 轮）步数几乎一样，但只看了一半样本。</p>' +
        '<p>右边：每个小方块是一个评测回合。按代码的协议每个套件 500 回合，99.3% 相当于 2,000 个里失败 14 个：Spatial 2、Object 2、Goal 1、Long 9。</p>' +
        '<p>步数上限可以和 OpenVLA 的常用设定对比：OpenWAM 给得宽得多。</p>' +
        live('步数按 openwam_trainer.py 第 224-230 行的公式现算。') + guess('失败方块放在哪个任务是我随便放的；论文只给套件成功率。') +
        src('附录 B.2 表 10 · 附录 D 表 13 · HF OpenWAM-Alpha-Sim-LIBERO · OpenWAM/LIBERO meta/info.json · benchmarks/libero/ · OpenVLA run_libero_eval.py') },
    { n: 11, part: '结果', title: '结果', sub: '切换表格；每根柱子是原文数字', dur: 12, cam: [0.0, 1.08, 34, [0, 3.8, 0]],
      html: dl([['LIBERO', '99.3，第二（ABot-M0.5 99.4）'], ['LIBERO-Plus', '69.2；Camera 33.8、Noise 39.8 是短板'], ['RoboTwin2.0-Full', '93.60'], ['EBench', 'SR 49.4，第一'], ['预训练', 'OOD 14.50 → 26.62']]) +
        '<p>域内（LIBERO、RoboTwin-Full、C2R 的 Clean）α 都在前列；域外（LIBERO-Plus、C2R 的 Randomized、RoboDojo 的 Open）落后于最好的 VLA。作者把它归为两点：单臂预训练数据少；像素级视频隐变量对相机和噪声扰动敏感。</p>' +
        '<p>Study 部分有些差距在 1 点以内，而同一设定在不同图表里出现过 92.15 到 93.0 的数，精读页读者注 4 有讨论。</p>' + src('表 1 · 表 5 · 表 13 · 图 10 · 图 13') }
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
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.0, phi: 1.0, dist: 26, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);
  let LABS = [], refDist = 26, PICKS = [];
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; for (let i = 0; i < n; i++) im.setColorAt(i, _C.setRGB(1, 1, 1)); return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
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
  function panel(G, x, y, z, w, h) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x0c1220, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }
  function bar(G, x, z, w, color, o = {}) { const m = block(w, 1, o.d ?? w, color, [x, 0.5, z], { edges: false }); G.add(m); m.userData.set = h => { const v = Math.max(0.001, h); m.scale.y = v; m.position.y = (o.y0 ?? 0) + v / 2; }; return m; }
  /* remove labels belonging to a sub-group before rebuilding it */
  function clearSub(sub) { LABS = LABS.filter(s => { let o = s; while (o) { if (o === sub) return false; o = o.parent; } return true; }); L.clear(sub); }

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
    G.add(L.grid(40, 20));
    const cols = [
      { x: -9.8, t: 'OpenWAM-Infra', c: COL.robot, items: [['统一动作空间', 1, COL.action], ['33 帧 → token', 2, COL.video], ['6 种结构', 3, COL.attn], ['4 种掩码', 4, COL.attn], ['训练器', 5, COL.text], ['策略服务器', 7, COL.ok]] },
      { x: 0, t: 'OpenWAM-Study', c: COL.gold, items: [['Q1 骨干 / Q3 表示', 10, COL.video], ['Q2 结构', 3, COL.attn], ['Q4 掩码', 4, COL.attn], ['Q6 去噪', 6, COL.text], ['Q5 预训练数据', 10, COL.ego]] },
      { x: 9.8, t: 'OpenWAM-α', c: COL.action, items: [['预训练 518.5M 帧', 8, COL.ego], ['5B DiT + 1B ActionDiT', 3, COL.video], ['同步 10 步去噪', 6, COL.text], ['LIBERO 微调 / 评测', 9, COL.action], ['8 个仿真基准 + 真机', 10, COL.gold]] }
    ];
    const B = [];
    cols.forEach(({ x, t, c, items }) => {
      G.add(lab(t, [x, 8.6, 0], { size: 26, border: '#' + c.toString(16).padStart(6, '0') }));
      items.forEach(([nm, go, cc], j) => { const b = block(6.6, 0.95, 1.6, cc, [x, 7.0 - j * 1.35, 0], { opacity: 0.9 }); b.userData.go = go; G.add(b); PICKS.push(b); G.add(lab(nm, [x, 7.0 - j * 1.35, 0.95], { size: 19 })); B.push({ b, k: (x + 9.8) / 19.6 + j * 0.03 }); });
    });
    const flow = stream(G, 16, COL.gold, 0.12);
    G.add(lab('一个训练器 · 一个策略服务器 · 一套 WebSocket 评测', [0, -0.2, 2.2], { size: 18 }));
    return { update(p) {
      const q = (p * 2) % 1; flow([[-9.8, 1.0, 1.2], [0, 1.0, 1.2], [9.8, 1.0, 1.2]], q, 1);
      B.forEach(({ b, k }) => glow(b, Math.max(0.05, 0.55 - Math.abs(k - (p * 1.2 - 0.1)) * 3)));
      cap(p < 0.34 ? '<b>Infra</b>：任何结构 = 编码器 + 流骨干 + 掩码，训练器和服务器都不关心是哪种' : p < 0.67 ? '<b>Study</b>：在 RoboTwin2.0 上一次只改一个变量，得出三条结论（表 3）' : '<b>α</b>：把结论拼起来放大训练；点任何方块跳过去');
    } };
  }

  /* ---------- scene 2: the 80-D action tensor with its validity mask ---------- */
  function s2(G) {
    let emb = +(OPT[0] ?? 0);
    const T = 32, D = 80, dx = 0.3, dz = 0.3, x0 = -(D - 1) * dx / 2, z0 = -(T - 1) * dz / 2;
    const grp = d => { const a = d % 34; if (d >= 68) return COL.res; if (a < 3) return COL.video; if (a < 9) return COL.text; if (a < 10) return COL.gold; return COL.hand; };
    const MAPS = [
      { nm: 'LIBERO', s: [[0, 9]], note: 'Δxyz、rot6d、夹爪 → 槽 0-9' },
      { nm: '双臂末端（RoboCOIN 等）', s: [[0, 9], [34, 43]], note: '槽 0-9 和 34-43' },
      { nm: '第一视角视频', s: [], note: '没有动作：全部掩掉，只训世界流' },
      { nm: '灵巧手（示意）', s: [[0, 8], [10, 30]], note: '9 维末端 + 21 个手指（槽位是我猜的）' }
    ];
    const im = inst(BOX, T * D); G.add(im);
    for (let t = 0; t < T; t++) for (let d = 0; d < D; d++) setI(im, t * D + d, [x0 + d * dx, 0.12, z0 + t * dz], [0.24, 0.24, 0.24]);
    done(im);
    [['左臂 34', -(D - 1) * dx / 2 + 16.5 * dx], ['右臂 34', x0 + 50.5 * dx], ['保留 12', x0 + 73.5 * dx]].forEach(([t, x]) => G.add(lab(t, [x, 0.6, z0 - 1.3], { size: 20 })));
    G.add(lab('每臂：位置 3（蓝）· rot6d 6（紫）· 夹爪 1（黄）· 灵巧手 24（粉）', [0, 0.5, z0 - 2.8], { size: 17 }));
    G.add(lab('↓ 32 个时间步', [-(D - 1) * dx / 2 + 3, 0.5, -z0 + 1.2], { size: 17 }));
    const valid = d => MAPS[emb].s.some(([a, b]) => d >= a && d <= b);
    const ctls = [{ label: '数据', items: MAPS.map(m => m.nm), get: () => emb, set: k => { emb = k; } }];
    return { ctls, update(p) {
      const row = Math.floor(p * 1.25 * T);
      for (let t = 0; t < T; t++) for (let d = 0; d < D; d++) {
        const v = valid(d), c = hex3(grp(d)), on = t <= row;
        const k = v ? (on ? 1 : 0.45) : 0.12;
        colI(im, t * D + d, [c[0] * k + (v ? 0 : 0.06), c[1] * k + (v ? 0 : 0.07), c[2] * k + (v ? 0 : 0.1)]);
        setI(im, t * D + d, [x0 + d * dx, v && on ? 0.12 + 0.18 * (1 - seg(p, 0, 0.8)) * ((t + d) % 3) / 2 : 0.12, z0 + t * dz], [0.24, v ? 0.24 : 0.08, 0.24]);
      }
      done(im);
      const nv = MAPS[emb].s.reduce((a, [x, y]) => a + y - x + 1, 0);
      cap(`<b>${MAPS[emb].nm}</b>：${MAPS[emb].note} · 有效维 <b>${nv}</b> / 80 · 动作损失只算 <b>${fmt(nv * T)}</b> / ${fmt(T * D)} 个数`);
    } };
  }

  /* ---------- scene 3: window -> frames -> latents -> tokens ---------- */
  function s3(G) {
    let si = +(OPT[0] ?? 1); const STR = [2, 4, 8];
    const sub = new THREE.Group(); G.add(sub); let last = -1, parts = null;
    const X = i => -12 + i * 0.75;
    function rebuild() {
      clearSub(sub); last = si; const st = STR[si];
      const nf = 32 / st + 1, nl = 1 + (nf - 1) / 4, idx = Array.from({ length: nf }, (_, k) => k * st);
      const acts = [], frames = [], lats = [];
      for (let i = 1; i <= 32; i++) { const b = block(0.5, 0.35, 0.5, COL.action, [X(i), 0.4, 1.4], { edges: false }); sub.add(b); acts.push(b); }
      for (let i = 0; i <= 32; i++) { const on = idx.includes(i), b = block(0.6, 0.5, 0.08, on ? COL.video : COL.dim, [X(i), 1.9, 0], { opacity: on ? 1 : 0.35 }); sub.add(b); frames.push({ b, on }); }
      // VAE groups: [0], then groups of 4 sampled frames
      const groups = [[idx[0]]]; for (let g = 1; g < nl; g++) groups.push(idx.slice(1 + (g - 1) * 4, 1 + g * 4));
      groups.forEach((gr, g) => {
        const cx = gr.reduce((a, i) => a + X(i), 0) / gr.length, w = Math.max(1.2, X(gr[gr.length - 1]) - X(gr[0]) + 0.9);
        const tile = block(w, 0.25, 1.6, g === 0 ? COL.ok : COL.video, [cx, 4.1, 0], { opacity: 0.85 }); sub.add(tile);
        const toks = inst(BOX, 120); for (let r = 0; r < 10; r++) for (let c = 0; c < 12; c++) setI(toks, r * 12 + c, [cx - 1.1 + c * 0.2, 5.4 + r * 0.2, 0], 0.16);
        const cc = hex3(g === 0 ? COL.ok : COL.video); for (let k = 0; k < 120; k++) colI(toks, k, cc); done(toks); sub.add(toks);
        lats.push({ tile, toks, cx, gr });
        sub.add(lab(g === 0 ? '首帧（干净）' : `隐帧 ${g + 1}`, [cx, 8.1, 0], { size: 17 }));
      });
      sub.add(lab(`动作 32 步（每步 1 token）`, [X(16.5), -0.4, 1.4], { size: 18 }));
      sub.add(lab(`视频：stride ${st}\n→ ${nf} 帧`, [X(-2.6), 1.9, 0.4], { size: 16 }));
      sub.add(lab(`Wan2.2-VAE：1 + (${nf} − 1)/4 = ${nl} 个隐帧，每个 24×20×48`, [X(16.5), 3.0, 0.9], { size: 17 }));
      parts = { acts, frames, lats, nf, nl, st };
    }
    rebuild();
    const ctls = [{ label: 'video_stride', items: ['2（假设）', '4（α）', '8（假设）'], get: () => si, set: k => { si = k; } }];
    return { ctls, update(p) {
      if (last !== si) rebuild();
      const { acts, frames, lats, nf, nl, st } = parts;
      const a = seg(p, 0, 0.25), b = seg(p, 0.2, 0.45), c = seg(p, 0.45, 0.7), d = seg(p, 0.65, 0.9);
      acts.forEach((m, i) => { m.scale.setScalar(Math.max(0.01, clamp(a * 33 - i, 0, 1))); });
      frames.forEach(({ b: m, on }, i) => { m.scale.y = Math.max(0.01, clamp(a * 34 - i, 0, 1)); glow(m, on ? 0.6 * b : 0); });
      lats.forEach(({ tile, toks }, g) => { const k = clamp(c * nl - g, 0, 1); tile.scale.set(1, Math.max(0.01, k), 1); toks.visible = d > 0; toks.scale.setScalar(Math.max(0.01, clamp(d * nl - g, 0, 1))); });
      const tv = nl * 120;
      cap(`stride <b>${st}</b>：${nf} 帧 → <b>${nl}</b> 个隐帧 → 视频 token <b>${tv}</b>（干净 120 + 带噪 ${tv - 120}）+ 动作 token <b>32</b> = <b>${tv + 32}</b>`);
    } };
  }

  /* ---------- scene 4: architecture families ---------- */
  function s4(G) {
    let v = +(OPT[0] ?? 2);
    const VAR = [['单 · Vanilla', 85.50], ['单 · MoE', 84.63], ['双 · 联合自注意力', 92.36], ['双 · 交叉注意力', 88.25], ['双 · 截断交叉', 91.85], ['双 · IDM', 87.95], ['三 · 联合自注意力', 92.60]];
    /* ActionDiT parameter count, separate_action_dit.py */
    const lin = (i, o) => i * o + o, d = 1024, A = 3072, f = 4096, Ld = 30;
    const att = 3 * lin(d, A) + lin(A, d) + 2 * A, blk = 2 * att + 2 * d + lin(d, f) + lin(f, d) + 6 * d;
    const extra = lin(80, d) + lin(4096, d) + lin(d, d) + lin(256, d) + lin(d, d) + lin(d, 6 * d) + lin(d, 80), PAR = blk * Ld + extra;
    const sub = new THREE.Group(); G.add(sub); let last = -1, P = null;
    G.add(L.grid(30, 15));
    function tower(x, w, color, n = 30) { const ls = []; for (let i = 0; i < n; i++) { const m = block(w, 0.2, 1.8, color, [x, 0.6 + i * 0.36, 0], { opacity: 0.85, edgeOpacity: 0.15 }); sub.add(m); ls.push(m); } return ls; }
    function rebuild() {
      clearSub(sub); last = v; P = { vt: [], at: [], ut: [], br: [], kind: v };
      if (v <= 1) {
        P.vt = tower(0, 3.072, COL.video);
        if (v === 1) P.at = tower(2.3, 0.9, COL.action);
        sub.add(lab(v === 0 ? '一个 DiT，视频 + 动作 + 状态 token 共用所有参数' : '共享注意力；动作 token 硬路由到专用 FFN（橙）', [0, 12.2, 0], { size: 19 }));
      } else {
        P.vt = tower(-3, 3.072, COL.video); P.at = tower(3, 1.024, COL.action);
        sub.add(lab('视频 DiT · dim 3072', [-5.2, 12.0, 0], { size: 19 })); sub.add(lab('ActionDiT · dim 1024', [5.2, 12.0, 0], { size: 19 }));
        if (v === 6) { P.ut = tower(-8, 1.6, COL.vlm); sub.add(lab('VLM 理解流（冻结 VLM 喂入）', [-8, 12.0, 0], { size: 18 })); }
        for (let i = 0; i < 30; i++) {
          const y = 0.6 + i * 0.36;
          if (v === 2 || v === 6) { const m = block(4.4, 0.06, 1.2, COL.attn, [0, y, 0], { opacity: 0.5, edges: false }); sub.add(m); P.br.push(m); }
          else if (v === 3 || v === 4) { const a = L.arrow([-1.4, y, 0], [2.4, y, 0], v === 4 ? COL.frozen : COL.attn); sub.add(a); P.br.push(a); }
        }
        if (v === 5) { const a = L.arrow([-1.4, 11.2, 0], [2.3, 0.7, 0], COL.attn); sub.add(a); P.br.push(a); sub.add(lab('① 先生成视频  ② 再从视频推动作', [0, -0.5, 1.6], { size: 18 })); }
        if (v === 4) sub.add(lab('视频特征处截断梯度', [0, -0.5, 1.6], { size: 18 }));
        if (v === 2 || v === 6) sub.add(lab('每层共享注意力：24 头 × 128', [0, -0.5, 1.6], { size: 18 }));
      }
      sub.add(lab(`表 1 · ${VAR[v][0]} · ${VAR[v][1].toFixed(2)}%`, [0, 13.4, 0], { size: 23, border: 'rgba(212,95,160,.8)' }));
    }
    rebuild();
    const ctls = [{ label: '结构', items: VAR.map(x => x[0]), get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      if (last !== v) rebuild();
      const lay = v === 5 ? null : Math.floor(p * 30.99);
      P.vt.forEach((m, i) => glow(m, v === 5 ? (p < 0.5 && i <= p * 62 ? 0.5 : 0.05) : (i === lay ? 0.7 : 0.05)));
      P.at.forEach((m, i) => glow(m, v === 5 ? (p >= 0.5 && i <= (p - 0.5) * 62 ? 0.5 : 0.05) : (i === lay ? 0.7 : 0.05)));
      P.ut.forEach((m, i) => glow(m, i === lay ? 0.6 : 0.05));
      P.br.forEach((m, i) => { if (m.material) glow(m, i === lay ? 1 : 0.1); });
      cap(`ActionDiT 参数（按代码现算）：每块 <b>${fmt(blk)}</b> × 30 + 嵌入 ${fmt(extra)} = <b>${fmt(PAR)}</b> ≈ ${(PAR / 1e9).toFixed(2)}B · 当前：<b>${VAR[v][0]}</b>`);
    } };
  }

  /* ---------- scene 5: the four visibility masks ---------- */
  function s5(G) {
    let mode = +(OPT[0] ?? 3);
    const MODES = [['Isolated', 87.41, 0, 0], ['Video Sees Action', 87.63, 1, 0], ['Action Sees Video', 92.39, 0, 1], ['Mutual', 92.15, 1, 1]];
    const g = [['V_obs', 5, COL.ok, 120], ['V_future', 10, COL.video, 240], ['A_future', 2, COL.action, 32]], N = 17, cs = 0.42;
    const typ = i => (i < 5 ? 0 : i < 15 ? 1 : 2);
    const im = inst(BOX, N * N); G.add(im);
    const X0 = -(N - 1) * cs / 2, Y0 = 0.8 + (N - 1) * cs;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) setI(im, r * N + c, [X0 + c * cs, Y0 - r * cs, 0], [cs * 0.9, cs * 0.9, 0.12]);
    done(im);
    let o = 0; g.forEach(([nm, k]) => { G.add(lab(nm, [X0 + (o + (k - 1) / 2) * cs, Y0 + 0.9, 0], { size: 17 })); G.add(lab(nm, [X0 - 1.6, Y0 - (o + (k - 1) / 2) * cs, 0], { size: 17 })); o += k; });
    G.add(lab('K（被看）→', [X0 + 3, Y0 + 1.8, 0], { size: 18 })); G.add(lab('Q ↓', [X0 - 2.8, Y0 + 0.9, 0], { size: 18 }));
    const scan = block(N * cs + 0.4, cs, 0.05, COL.gold, [0, Y0, 0.15], { opacity: 0.35, edges: false }); G.add(scan);
    const vis = (q, k) => { const a = typ(q), b = typ(k); const [, , vsa, asv] = MODES[mode];
      if (a === 0) return b === 0; if (a === 1) return b < 2 || (b === 2 && vsa); return b === 2 || (b < 2 && asv); };
    const ctls = [{ label: '模式', items: MODES.map(m => m[0]), get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const row = Math.min(N - 1, Math.floor(p * N));
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const ok = vis(r, c), col = hex3(typ(c) === 2 ? COL.action : typ(c) === 0 ? COL.ok : COL.video), k = ok ? (r === row ? 1.25 : 0.85) : 0.16;
        colI(im, r * N + c, ok ? col.map(x => Math.min(1, x * k)) : [0.18, 0.2, 0.26]);
      }
      done(im); scan.position.y = Y0 - row * cs;
      const [nm, sc, vsa, asv] = MODES[mode], tot = 392 * 392;
      const n = 120 * 120 + 240 * (360 + (vsa ? 32 : 0)) + 32 * (32 + (asv ? 360 : 0));
      cap(`<b>${nm}</b>：可见 ${fmt(n)} / ${fmt(tot)} = <b>${(100 * n / tot).toFixed(1)}%</b>（按 120/240/32 个 token 现算）· 表 2：<b>${sc.toFixed(2)}%</b>`);
    } };
  }

  /* ---------- shared: the joint noise plane ---------- */
  const PX = -5, PY = 0.4, PW = 10;
  const toP = (tv, ta, z = 0.05) => [PX + tv * PW, PY + ta * PW, z];
  function plane(G, xl, yl) {
    panel(G, PX - 0.2, PY - 0.2, -0.05, PW + 0.4, PW + 0.4);
    for (let k = 0; k <= 4; k++) { const v = k / 4; wire(G, [toP(v, 0, 0), toP(v, 1, 0)], COL.dim, { opacity: 0.35 }); wire(G, [toP(0, v, 0), toP(1, v, 0)], COL.dim, { opacity: 0.35 }); }
    G.add(lab(xl + ' →', [PX + PW / 2, PY - 3.4, 0], { size: 18 })); G.add(lab('↑ ' + yl, [PX + 1.2, PY + PW + 0.8, 0], { size: 18 }));
    G.add(lab('0', [PX - 0.4, PY - 0.5, 0], { size: 15 })); G.add(lab('1', [PX + PW, PY - 0.5, 0], { size: 15 })); G.add(lab('1', [PX - 0.5, PY + PW, 0], { size: 15 }));
  }

  /* ---------- scene 6: training samples on the noise plane ---------- */
  function s6(G) {
    let ri = +(OPT[0] ?? 1); const RH = [1, 5];
    plane(G, 't_v（0 = 噪声）', 't_a');
    const NS = 600, r = L.rng(7), U = Array.from({ length: NS }, () => [r(), r()]);
    const im = inst(BALL, NS); G.add(im);
    const hb = [], ha = [];
    for (let k = 0; k < 10; k++) { const b1 = block(0.85, 1, 0.3, COL.video, [PX + (k + 0.5), PY - 2.4, 0], { edges: false }); G.add(b1); hb.push(b1); const b2 = block(1, 0.85, 0.3, COL.action, [PX - 3.2, PY + k + 0.5, 0], { edges: false }); G.add(b2); ha.push(b2); }
    const ctls = [{ label: 'ρ', items: ['1（均匀）', '5（α）'], get: () => ri, set: k => { ri = k; } }];
    return { ctls, update(p) {
      const rho = RH[ri], m = Math.round(seg(p, 0, 0.75) * NS), cv = new Array(10).fill(0), ca = new Array(10).fill(0); let lo = 0;
      for (let i = 0; i < NS; i++) {
        const tv = 1 - fw(U[i][0], rho), ta = 1 - fw(U[i][1], rho);
        setI(im, i, toP(tv, ta, 0.1), i < m ? 0.09 : 0.0001); colI(im, i, hex3(COL.gold));
        if (i < m) { cv[Math.min(9, Math.floor(tv * 10))]++; ca[Math.min(9, Math.floor(ta * 10))]++; if (tv < 0.5) lo++; }
      }
      done(im);
      const mx = Math.max(1, ...cv, ...ca);
      hb.forEach((b, k) => { const h = Math.max(0.02, 2.0 * cv[k] / mx); b.scale.y = h; b.position.y = PY - 2.6 + h / 2; });
      ha.forEach((b, k) => { const w = Math.max(0.02, 2.4 * ca[k] / mx); b.scale.x = w; b.position.x = PX - 1.0 - w / 2; });
      const theo = 1 - 0.5 / (rho - (rho - 1) * 0.5);
      cap(`ρ = <b>${rho}</b> · 已抽 ${m} 个 · t_v &lt; 0.5 的比例：样本 <b>${m ? (100 * lo / m).toFixed(1) : '–'}%</b>，理论 <b>${(100 * theo).toFixed(1)}%</b> · 下方和左侧是 t_v、t_a 的直方图`);
    } };
  }

  /* ---------- scene 7: inference schedules (eq. 3, fig. 9) ---------- */
  function s7(G) {
    let fam = +(OPT[0] ?? 0), lead = +(OPT[1] ?? 1), pi = +(OPT[2] ?? 0);
    const AL = [4, 8, 16, 32], OF = [0.2, 0.4, 0.6, 0.8];
    const SC = { vs: [{ 4: 91.0, 8: 90.7, 16: 89.7, 32: 88.5 }, { 4: 91.8, 8: 91.1, 16: 91.9, 32: 91.5 }], lo: [{ 0.2: 92.2, 0.4: 92.0, 0.6: 92.3, 0.8: 92.3 }, { 0.2: 91.7, 0.4: 91.1, 0.6: 91.5, 0.8: 91.2 }] };
    plane(G, '视频干净程度（0 = 噪声）', '动作干净程度');
    wire(G, [toP(0, 0, 0.02), toP(1, 1, 0.02)], COL.text, { opacity: 0.4, dashed: true });
    const NR = 101, rib = ribbon(G, NR, COL.attn, 0.12, { order: 3 }), dot = L.sphere(0.28, COL.gold); G.add(dot);
    const steps = inst(BALL, 11); G.add(steps); for (let i = 0; i < 11; i++) colI(steps, i, hex3(COL.white));
    const path = s => { if (fam === 0) return [s, s]; const l = fam === 1 ? fw(s, AL[pi]) : s, g = fam === 1 ? s : Math.max((s - OF[pi]) / (1 - OF[pi]), 0); return lead === 0 ? [g, l] : [l, g]; };
    const ctls = [{ label: '调度', items: ['同步', '方差平移', '线性偏移'], get: () => fam, set: k => { fam = k; } },
      { label: '领先', items: ['动作领先', '视频领先'], get: () => lead, set: k => { lead = k; } },
      { label: '参数', items: ['α 4 / o 0.2', 'α 8 / o 0.4', 'α 16 / o 0.6', 'α 32 / o 0.8'], get: () => pi, set: k => { pi = k; } }];
    return { ctls, update(p) {
      const pts = []; for (let i = 0; i < NR; i++) { const [cv, ca] = path(i / (NR - 1)); pts.push(toP(cv, ca, 0.08)); } rib.userData.set(pts);
      for (let i = 0; i <= 10; i++) { const [cv, ca] = path(i / 10); setI(steps, i, toP(cv, ca, 0.12), i / 10 <= p + 1e-9 ? 0.16 : 0.08); } done(steps);
      const [cv, ca] = path(p); dot.position.set(...toP(cv, ca, 0.2));
      const tv = 1 - fw(1 - cv, 5), ta = 1 - fw(1 - ca, 5);
      const score = fam === 0 ? 93.0 : (fam === 1 ? SC.vs : SC.lo)[lead][fam === 1 ? AL[pi] : OF[pi]];
      const nm = fam === 0 ? '同步' : `${fam === 1 ? '方差平移 α = ' + AL[pi] : '线性偏移 o = ' + OF[pi]}，${lead === 0 ? '动作' : '视频'}领先`;
      cap(`<b>${nm}</b> · 图 9：<b>${score.toFixed(1)}%</b> · 进度 s = ${p.toFixed(2)} → 干净程度 (${cv.toFixed(2)}, ${ca.toFixed(2)}) → 实际时间步 (t_v, t_a) = (${tv.toFixed(3)}, ${ta.toFixed(3)})`);
    } };
  }

  /* ---------- scene 8: policy server, buffer, sync vs async ---------- */
  function s8(G) {
    let md = +(OPT[0] ?? 0);
    const cli = block(4.2, 2.6, 2.4, COL.sim, [-10, 6.4, 0], { opacity: 0.9 }); G.add(cli, lab('LIBERO 客户端', [-10, 8.2, 0], { size: 20 }));
    const srv = block(5.6, 2.6, 2.4, COL.ok, [9.5, 6.4, 0], { opacity: 0.9 }); G.add(srv, lab('策略服务器（α）', [9.5, 8.2, 0], { size: 20 }));
    wire(G, [[-7.9, 6.9, 0], [6.7, 6.9, 0]], COL.data, { opacity: 0.7 }); wire(G, [[-7.9, 5.9, 0], [6.7, 5.9, 0]], COL.action, { opacity: 0.7 });
    G.add(lab('观测：2 路相机 + 指令 + 10 维状态 →', [-0.6, 7.5, 0], { size: 17 })); G.add(lab('← 1 个 7 维 OSC 动作', [-0.6, 5.3, 0], { size: 17 }));
    const fwd = stream(G, 6, COL.data, 0.12), back = stream(G, 6, COL.action, 0.12);
    const buf = inst(BOX, 32); G.add(buf); for (let i = 0; i < 32; i++) setI(buf, i, [5.4 + (i % 16) * 0.5, 3.6 - Math.floor(i / 16) * 0.55, 0], 0.4); done(buf);
    G.add(lab('动作缓冲区（32）', [9.2, 2.2, 0], { size: 17 }));
    /* timeline: 3 chunks of 32 steps at 10 Hz; inference 0.17 s */
    const TL = inst(BOX, 200); G.add(TL);
    const X0 = -13, SPAN = 26;
    const ctls = [{ label: '推理模式', items: ['同步（α 的评测）', '异步（示意 n=16, d=8）'], get: () => md, set: k => { md = k; } }];
    function plan() {
      const ev = []; const dt = 0.1, inf = 0.17; let t = 0;
      if (md === 0) { for (let c = 0; c < 3; c++) { ev.push({ k: 'i', a: t, b: t + inf }); t += inf; for (let j = 0; j < 32; j++) { ev.push({ k: 'e', a: t, b: t + dt }); t += dt; } } }
      else { ev.push({ k: 'i', a: 0, b: inf }); t = inf; const n = 16, d = 8; let rem = 32; for (let s = 0; s < 64; s++) { ev.push({ k: 'e', a: t, b: t + dt }); rem--; if (rem === d) ev.push({ k: 'i', a: t + dt, b: t + dt + inf, y: 1 }); if (rem === 0) rem = n; t += dt; } }
      return ev;
    }
    return { ctls, update(p) {
      const ev = plan(), T = ev[ev.length - 1].b, now = p * T, sx = SPAN / T;
      let execd = 0, infer = false;
      for (let i = 0; i < 200; i++) {
        const e = ev[i];
        if (!e) { setI(TL, i, [0, -50, 0], 0.0001); continue; }
        const on = e.a <= now, w = Math.max(0.02, (Math.min(now, e.b) - e.a) * sx);
        setI(TL, i, [X0 + e.a * sx + w / 2, e.k === 'i' ? (e.y ? 0.4 : 1.0) : 0.4, 0], on ? [w * 0.95, e.k === 'i' ? 0.45 : 0.35, 0.3] : 0.0001);
        colI(TL, i, hex3(e.k === 'i' ? COL.action : COL.video));
        if (e.k === 'e' && e.b <= now) execd++; if (e.k === 'i' && e.a <= now && now < e.b) infer = true;
      }
      done(TL);
      const left = infer && execd === 0 ? 0 : md === 0 ? (infer ? 0 : (execd % 32 === 0 && execd > 0 ? 0 : 32 - execd % 32)) : (execd < 32 ? 32 - execd : 16 - ((execd - 32) % 16));
      for (let i = 0; i < 32; i++) colI(buf, i, i < left ? hex3(COL.action) : [0.2, 0.22, 0.28]);
      done(buf);
      glow(srv, infer ? 0.8 : 0.05); fwd([[-7.9, 6.9, 0], [6.7, 6.9, 0]], (p * 20) % 1, infer ? 0 : 1); back([[6.7, 5.9, 0], [-7.9, 5.9, 0]], (p * 20) % 1, infer ? 0 : 1);
      cap(`${md === 0 ? '<b>同步</b>：缓冲区空了才推理（橙），仿真等着；每块 32 步 = 3.2 s，推理约 170 ms' : '<b>异步</b>：剩 d = 8 个时后台预取（下排橙），新块跳过前 8 个、执行 16 个、丢弃后 8 个'} · 已执行 <b>${execd}</b> 步${infer ? ' · <b>推理中</b>' : ''}`);
    } };
  }

  /* ---------- scene 9: pretraining mixture and the LR curve ---------- */
  function s9(G) {
    let raw = +(OPT[0] ?? 0);
    const D = [['第一视角', 155.7, 744.9, COL.ego, 1442], ['AgiBotWorld-Beta', 96.9, 124.5, COL.robot, 1794], ['RoboCOIN', 74.1, 104.5, COL.robot, 686], ['DROID', 36.3, 46.3, COL.robot, 1007], ['InternData-A1', 155.5, 313.7, COL.syn, 1440]];
    const bars = D.map(([nm, u, r, c], i) => { const x = -9 + i * 4.5, b = bar(G, x, -2, 2.2, c, { y0: 0 }); b.position.z = -2; const l = lab('', [x, 0, -2], { size: 17 }); G.add(l, lab(nm, [x, -0.4, -0.6], { size: 17 })); return { b, l, x, u, r, nm }; });
    const SN = 155862, W = Math.floor(SN * 0.05), C = SN - W, lr = k => k < W ? 1e-4 * (k + 1) / W : 1e-6 + 0.99e-4 * (1 + Math.cos(Math.PI * (k - W) / C)) / 2;
    const XL = -10, WL = 20, YL = -5.6, HL = 3.2; panel(G, XL - 0.3, YL - 0.3, 0.6, WL + 0.6, HL + 0.8);
    const NR = 200, rib = ribbon(G, NR, COL.gold, 0.08, { order: 3 }); rib.position.z = 0.7;
    const mk = L.sphere(0.22, COL.bad); G.add(mk); const mkx = XL + WL * 154000 / SN; mk.position.set(mkx, YL + HL * lr(154000) / 1e-4, 0.75);
    G.add(lab('学习率（现算，峰值 1e-4）', [XL + 4, YL + HL + 0.3, 0.7], { size: 16 })); G.add(lab('154,000', [mkx - 1.2, YL + 1.0, 0.7], { size: 15 }));
    const ctls = [{ label: '帧数', items: ['使用的（表 4）', '原始的'], get: () => raw, set: k => { raw = k; } }];
    let lbl = '';
    return { ctls, update(p) {
      const g = seg(p, 0, 0.35), mxv = raw ? 744.9 : 155.7;
      bars.forEach(({ b, l, u, r }) => { const v = raw ? r : u, h = Math.max(0.02, 6.5 * v / mxv * g); b.userData.set(h); b.position.z = -2; l.position.y = h + 0.5; });
      const key = raw + '';
      if (lbl !== key) { lbl = key; bars.forEach(o => { G.remove(o.l); LABS = LABS.filter(s => s !== o.l); L.dispose(o.l); o.l = lab(`${(raw ? o.r : o.u).toFixed(1)}M`, [o.x, 1, -2], { size: 17 }); G.add(o.l); }); }
      const k = Math.round(seg(p, 0.3, 1) * SN), pts = [];
      for (let i = 0; i < NR; i++) { const s = Math.min(k, Math.round(i / (NR - 1) * SN)); pts.push([XL + WL * s / SN, YL + HL * lr(s) / 1e-4, 0.7]); }
      rib.userData.set(pts); mk.visible = k >= 154000;
      const tot = raw ? 1333.9 : 518.5;
      cap(`${raw ? '原始' : '使用'}帧 <b>${tot}M</b> · 第 <b>${fmt(k)}</b> 步 lr <b>${lr(k).toExponential(2)}</b> · 155,862 × 3,072 = <b>478.8M</b> 样本 · 第 154,000 步 lr ${lr(154000).toExponential(2)}`);
    } };
  }

  /* ---------- scene 10: LIBERO fine-tuning arithmetic and the evaluation grid ---------- */
  function s10(G) {
    let cf = +(OPT[0] ?? 0), lim = +(OPT[1] ?? 0);
    const CF = [['官方：64 进程 × 4', 64, 4, 10], ['8 卡 × 32', 8, 32, 10], ['8 卡 × 16，5 轮（train.yaml 默认）', 8, 16, 5]];
    const FR = 273465;
    const SU = [['Spatial', 2, 99.6], ['Object', 2, 99.6], ['Goal', 1, 99.8], ['Long', 9, 98.2]];
    const im = inst(BOX, 2000); G.add(im);
    const r = L.rng(3), fail = SU.map(([, k]) => { const s = new Set(); while (s.size < k) s.add(Math.floor(r() * 500)); return s; });
    const cell = 0.16, gx = 0.6;
    const pos = (s, t, j) => [gx + j * cell, 8.6 - s * 2.15 - t * cell, 0];
    for (let s = 0; s < 4; s++) { G.add(lab(`${SU[s][0]}\n${500 - SU[s][1]}/500 = ${SU[s][2]}%`, [gx + 50 * cell + 2.9, 8.6 - s * 2.15 - 0.75, 0], { size: 15 })); }
    G.add(lab('4 套件 × 10 任务 × 50 次（每行一个任务）', [gx + 25 * cell, 9.4, 0], { size: 17 }));
    // left: training arithmetic bars
    const LX = -13;
    const bE = bar(G, LX + 1.5, 0, 1.6, COL.video), bT = bar(G, LX + 5.5, 0, 1.6, COL.action);
    let la = null, lc = null;
    G.add(lab('每轮步数', [LX + 1.2, -0.6, 1], { size: 15 }), lab('总步数', [LX + 5.2, -0.6, 1], { size: 15 }));
    // step limits
    const LIM = [[600, 600, 600, 700, 30], [220, 280, 300, 520, 10]];
    const lb = [0, 1].map(k => SU.map((_, s) => { const b = bar(G, LX + 9.0 + s * 0.9 + k * 0.4, 0, 0.36, k ? COL.sim : COL.ok); return b; }));
    G.add(lab('步数上限\n绿 OpenWAM · 灰 OpenVLA', [LX + 10.6, -1.0, 1], { size: 14 }));
    ['S', 'O', 'G', 'L'].forEach((t, s) => G.add(lab(t, [LX + 9.2 + s * 0.9, 5.6, 0], { size: 14 })));
    let ls = '';
    const ctls = [{ label: '训练配置', items: CF.map(c => c[0]), get: () => cf, set: k => { cf = k; } }];
    return { ctls, update(p) {
      const [nm, n, b, ep] = CF[cf], per = Math.ceil(Math.ceil(FR / b) / n), tot = per * ep, g = seg(p, 0, 0.3);
      bE.userData.set(Math.max(0.02, 3 * per / 2200 * g)); bT.userData.set(Math.max(0.02, 6 * tot / 11000 * g));
      if (ls !== cf + '') { ls = cf + ''; [la, lc].forEach(x => { if (x) { G.remove(x); LABS = LABS.filter(q => q !== x); L.dispose(x); } });
        la = lab(fmt(per), [LX + 1.5, 3 * per / 2200 + 0.5, 0], { size: 16 }); lc = lab(fmt(tot), [LX + 5.5, 6 * tot / 11000 + 0.5, 0], { size: 16 }); G.add(la, lc); }
      la.position.y = 3 * per / 2200 * g + 0.5; lc.position.y = 6 * tot / 11000 * g + 0.5;
      lb.forEach((row, k) => row.forEach((b, s) => b.userData.set(Math.max(0.02, 5 * LIM[k][s] / 700 * g))));
      const m = Math.round(seg(p, 0.25, 0.95) * 2000);
      for (let s = 0; s < 4; s++) for (let t = 0; t < 10; t++) for (let j = 0; j < 50; j++) {
        const i = s * 500 + t * 50 + j, ok = !fail[s].has(t * 50 + j), shown = i < m;
        setI(im, i, pos(s, t, j), shown ? cell * 0.8 : 0.0001); colI(im, i, hex3(ok ? COL.ok : COL.bad));
      }
      done(im);
      cap(`⌈⌈273,465 / ${b}⌉ / ${n}⌉ = <b>${fmt(per)}</b> 步/轮 × ${ep} = <b>${fmt(tot)}</b> 步（全局 ${n * b}）· 回合 ${fmt(m)} / 2,000 · 平均 <b>99.3%</b>`);
    } };
  }

  /* ---------- scene 11: results ---------- */
  function s11(G) {
    let view = +(OPT[0] ?? 0); G.add(L.grid(34, 34)); const sub = new THREE.Group(); G.add(sub);
    const T = [
      { t: '表 13 · LIBERO 平均（%）', g: ['OpenVLA', 'π0', 'π0.5', 'OFT', 'Fast-WAM', 'Qwen-RM', 'ABot', 'OpenWAM-α'], s: [['', COL.video, [76.5, 94.4, 96.9, 97.1, 97.6, 99.2, 99.4, 99.3]]], lo: 70 },
      { t: '表 13 · OpenWAM-α 各套件（%）', g: ['Spatial', 'Object', 'Goal', 'Long', 'Avg'], s: [['', COL.action, [99.6, 99.6, 99.8, 98.2, 99.3]]], lo: 95 },
      { t: '表 5 · LIBERO-Plus（%）', g: ['Camera', 'Robot', 'Language', 'Light', 'Background', 'Noise', 'Layout'], s: [['OpenWAM-α', COL.action, [33.8, 76.1, 88.0, 97.0, 87.1, 39.8, 77.5]], ['Qwen-RM', COL.video, [87.2, 75.5, 85.6, 96.6, 97.7, 97.7, 87.3]]], lo: 0 },
      { t: '图 10 · 具身预训练（RoboTwin C2R，%）', g: ['从头', '只机器人', '先人类后机器人', '联合'], s: [['ID', COL.video, [87.0, 88.5, 87.1, 87.68]], ['OOD', COL.action, [14.5, 23.8, 26.5, 26.62]]], lo: 0 },
      { t: '表 1 · 结构（RoboTwin2.0-Full，%）', g: ['Vanilla', 'MoE', '联合自注意力', '交叉', '截断交叉', 'IDM', '三系统'], s: [['', COL.attn, [85.5, 84.63, 92.36, 88.25, 91.85, 87.95, 92.6]]], lo: 80 }
    ];
    let bars = [], last = -1;
    function rebuild() {
      clearSub(sub); bars = []; last = view; const v = T[view], Ng = v.g.length, Ns = v.s.length, gw = Math.min(4.6, 28 / Ng), w = Math.min(1.4, (gw - 0.6) / Ns);
      v.g.forEach((nm, i) => { const x0 = (i - (Ng - 1) / 2) * gw; sub.add(lab(nm, [x0, -0.2, 2.6], { size: 17 }));
        v.s.forEach(([sn, c, vals], j) => { const x = x0 + (j - (Ns - 1) / 2) * (w + 0.08), b = block(w, 1, w, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(String(vals[i]), [x, 0, 0], { size: 16 }); sub.add(l); bars.push({ b, l, v: vals[i] }); }); });
      if (Ns > 1) v.s.forEach(([sn, c], j) => { sub.add(lab(sn, [-12 + j * 4.2, 9.2, 0], { size: 19, color: '#' + c.toString(16).padStart(6, '0') })); });
      sub.add(lab(v.t + (v.lo ? `（纵轴从 ${v.lo} 起）` : ''), [Ns > 1 ? 5 : 0, 9.2, 0], { size: 22, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const ctls = [{ label: '表', items: ['LIBERO', 'α 各套件', 'LIBERO-Plus', '预训练', '结构'], get: () => view, set: k => { view = k; } }];
    const MSG = ['LIBERO 前几名相差 0.1 到 0.2 点，相当于 2,000 回合里 2 到 4 个', 'Long 最低：98.2% = 500 回合失败 9 个', 'Camera 33.8、Noise 39.8：像素级隐变量对相机和噪声敏感', '预训练主要提升 OOD：14.50 → 26.62', '动作要有专用容量并能看到视频；单系统低约 7 点'];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const lo = T[view].lo, g = seg(p, 0, 0.5);
      bars.forEach(({ b, l, v }) => { const h = Math.max(0.02, (v - lo) / (100 - lo) * 7 * g); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.4; });
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
  window.__owDebug = { get cap() { return $('cap').textContent; } };
})();
