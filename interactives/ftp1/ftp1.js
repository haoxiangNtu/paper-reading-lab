'use strict';
/* FTP-1 (arXiv 2606.13102) taken apart into eleven animated scenes. Result numbers are copied from the paper
   (Tables 1-4, 8, 10, 11 and Fig. 7); network sizes come from the official code at commit 89fa681 (Apache-2.0) and
   from the safetensors header of the public checkpoint ftp1_v0426_50kstep. Each scene's update(p) is a pure function
   of the timeline p plus the current toggles. Tactile signals, the hand geometry and the denoising curve are toys. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const PI = Math.PI;
  const COL = { vl: 0x9d8cff, tac: 0xf0963c, act: 0x3aa8e0, img: 0xe05d8a, arr: 0x4fc98a, st: 0xf2c14e, emb: 0xd45fa0, t3: 0x38d1ff,
    dim: 0x46506a, white: 0xeef2fa, ok: 0x4fc98a, bad: 0xe05d5d, warn: 0xff7a59, gold: 0xf2c14e, skin: 0xd9b89a, hum: 0xe05d5d, dex: 0xf0b45c, grip: 0x5a8fc8, pi: 0x9d8cff, newc: 0x8e9bb8 };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  /* ---------- data copied from the paper and read from the checkpoint ---------- */
  const T8 = [ // name, domain, sensor type, sample-scale, final %, ckpt share %, unique frames (ckpt, one copy)
    ['EgoTac-Open', 'H', 'A', 0.89, 8.2, 8.30, 21781600], ['EgoTac-Kitchen', 'H', 'A', 1.63, 5.5, 5.55, 7949324], ['EgoTac-Hotel', 'H', 'A', 2.82, 3.8, 3.86, 3207497],
    ['OpenTouch', 'H', 'A', 11.09, 1.5, 1.55, 325962], ['OmniSharingDB', 'H', 'S', 21.65, 1.0, 0.67, 71680],
    ['Sharpa North', 'D', 'I', 3.29, 9.0, 11.13, 7895872], ['HumanoidEveryday', 'D', 'S', 13.97, 6.0, 5.09, 852487], ['OpenLETDex', 'D', 'A', 14.14, 6.0, 5.03, 830297],
    ['MotionTrans', 'D', 'S', 26.39, 3.6, 3.61, 319483], ['DexumiInspire', 'D', 'S', 35.62, 3.0, 3.06, 200553], ['DexumiXHand', 'D', 'S', 56.02, 2.4, 2.36, 98466],
    ['VTouch-D-WHEEL', 'G', 'I', 2.77, 5.7, 5.75, 4865209], ['FreeTacMan', 'G', 'I', 7.75, 4.4, 4.46, 1343875], ['TouchInTheWild', 'G', 'A', 10.79, 4.0, 4.10, 886514],
    ['VTouch-QINGLONG', 'G', 'I', 12.73, 3.9, 3.87, 710053], ['exUMI', 'G', 'I', 13.73, 3.8, 3.86, 655508], ['RH20T-Cfg6', 'G', 'S', 13.88, 3.8, 3.82, 646062],
    ['ViTaMIn', 'G', 'I', 22.19, 3.4, 3.40, 358003], ['RH20T-Cfg7', 'G', 'A', 22.89, 3.4, 3.37, 344732], ['RH20T-Cfg5', 'G', 'S', 24.42, 3.3, 3.30, 316225],
    ['REASSEMBLE', 'G', 'S', 27.77, 3.2, 3.24, 272132], ['Unit-Bimanual', 'G', 'I', 63.93, 2.6, 2.57, 93981], ['RDP', 'G', 'I', 89.76, 2.4, 2.28, 59356],
    ['Unit', 'G', 'I', 132.83, 2.2, 2.09, 36747], ['VLA-Touch', 'G', 'I', 170.36, 2.0, 2.01, 27609], ['RDP-Bimanual', 'G', 'I', 199.20, 1.9, 1.67, 19597]];
  const RES = {
    t1: { t: '表 1 · UniVTAC 平均（%）', m: [['VITaL*', 36.33, 34.5], ['UniVTAC-ACT*', 43.0, 39.5], ['π0.5', 49.16, 31.5], ['Tactile-VLA', 41.83, 34.75], ['FTP-π0.5', 45.16, 42], ['FTP-1', 66.66, 59.5]], k: ['Avg.', 'w/o Lift'] },
    t2: { t: '表 2 · 见过传感器的真机（%）', m: [['π0.5', 45.3, null], ['Tactile-VLA', 35.8, null], ['FTP-π0.5', 41.6, null], ['FTP-1', 62.5, null]], k: ['平均', ''] },
    t3: { t: '表 3 · 没见过的传感器（%）', m: [['π0.5', 15.0, null], ['Tactile-VLA', 8.3, null], ['FTP-π0.5', 15.0, null], ['FTP-1', 46.6, null]], k: ['平均', ''] },
    f7: { t: '图 7 · 预训练消融（%）', m: [['FTP-π0.5', 41.8, 7.5], ['NTP-1', 50.0, 5.0], ['FTP-1', 66.6, 42.5]], k: ['UniVTAC', 'FlexivXense'] },
    t11: { t: '表 4 / 表 11 · 预训练的量（%）', m: [['0%（FTP-π0.5）', 45.2, 42.0], ['50%', 59.0, 46.0], ['π0.5 匹配预训练', 57.0, 44.0], ['100%（FTP-1）', 66.7, 59.5]], k: ['Avg.', 'w/o Lift'] } };

  const SCENES = [
    { n: 1, part: '总览', title: '三路 token，三个专家，一个动作块', sub: '点方块跳到对应那一幕；橙色是 FTP-1 新加的触觉部分', dur: 14, cam: [0.0, 1.12, 36, [0.5, 3.6, 0]],
      html: dl([['输入', '语言 ℓ、多视角 RGB、本体感觉 s、触觉 X'], ['触觉', '三类编码器 → MTTS 的功能区 token → 触觉专家'], ['视觉语言', 'SigLIP + PaliGemma（π0.5 的 VL 专家）'], ['动作', '流匹配动作专家，adaRMS 注入本体感觉，输出 32 × 120 的动作块']]) +
        '<p>FTP-1 = π0.5 + 第三个专家。触觉不再像以往的触觉 VLA 那样塞进视觉语言模型，而是有自己的 Transformer 和自己的 token 流。三路在每一层拼起来做一次带掩码的注意力，只有动作 token 能同时看到另外两路。</p>' +
        '<p>新加的是橙色部分：异构触觉编码器、功能区嵌入、触觉专家；绿色的 T3 主干用别人的预训练权重。</p>' + src('§2 · 图 2') },
    { n: 2, part: '§2.2 信号', title: '三类触觉信号：一张图、一块阵列、几个数', sub: '依次高亮；下面是权重里真实出现过的形状', dur: 13, cam: [0.0, 1.05, 30, [0, 2.2, 0]],
      html: dl([['图像型（7 种）', 'Sharpa DTC、ViTai-GF、FreeTacMan、exUMI、ViTaMIn、GelSight-Mini、MCTac；统一缩放到 224 × 224 × 3'], ['阵列型（5 种）', 'AetherGlove 5×15、4×3；OpenTouch 7×11 等；LinkerHandL6Touch 6×12；3DViTac 12×32；uSkin 4×4×3'], ['状态型（9 种）', '力 / 力矩 6 维（ATI、Franka、REASSEMBLE）；PaxiniGlove 48；Inspire 1、2；UnitreeDex3 3、12']]) +
        '<p>同一次“捏住”在三种传感器上的样子完全不同：视触觉相机拍到凝胶上的点阵变形；手套的压阻阵列只给一个低分辨率的压力图；力传感器只给几维数。FTP-1 的第一步是让这三种东西都变成同样大小（512 维）的 token。</p>' +
        toyb('三个信号都是页面当场算的：点阵 24 × 24，接触斑沿一条弧移动；阵列 5 × 15，压力随斑点距离衰减；6 维力是相位不同的正弦。') + src('附录 C · 权重 hpt_tokenizer/ 文件名') },
    { n: 3, part: '附录 B.2 图像型', title: '图像型：传感器专用 3 层，共享 9 层', sub: '切换传感器：只有前 3 层换颜色，T3 主干不变', dur: 14, cam: [0.25, 1.08, 34, [1.0, 2.4, 0]],
      html: dl([['切块', '224 × 224 → 14 × 14 个 16 × 16 小块 + 1 个 CLS'], ['专用 ViT', '3 层，宽 768，12 头（每种传感器一份）'], ['共享 T3', '9 层，宽 768，12 头，所有图像传感器共用，用 T3 权重初始化（63.8M）'], ['输出', '取 CLS（768）→ image_proj 线性层 → 512']]) +
        '<p>和 T3 的结构一样：传感器专用的浅层吸收“这台相机的光照、凝胶颜色、点阵间距”，深层共享。微调到没见过的 Xense 时，只新建前 3 层，后面 9 层复用。</p>' +
        '<p>论文 B.2 没写最后那个 768 → 512 的投影；附录 F.3 说 “512 维的 image projection”，权重形状 [512, 768]。512 是触觉专家的宽度。</p>' + src('附录 B.2 · t3_tactile_encoder.py:36-51 · ftp1_blocks.py:329-345') },
    { n: 4, part: '附录 B.2 阵列 / 状态', title: '阵列型和状态型：先 Fourier，再 CNN 或 MLP', sub: '切换类型；中间的四条曲线是四个周期的 sin / cos', dur: 14, cam: [0.1, 1.12, 28, [0, 2.6, 0]],
      html: dl([['Fourier', '每个标量 → 4 个 sin + 4 个 cos，周期 1e-3 到 1 对数等距；再和原值拼接（×9）'], ['阵列型', '(H, W, D) → (H, W, 9D) → 3 层 3×3 卷积（GELU）→ 展平 → Linear → ReLU → Linear → 512'], ['状态型', '(D,) → 9D → Linear → GELU → Linear → GELU → Linear → 512'], ['论文', '状态型写 ReLU，代码是 GELU']]) +
        '<p>力是“小数也重要”的信号：0.1 N 和 0.2 N 差别很大。Fourier 编码把一个数拆成多种频率的振荡，让 MLP 能分辨细小差别。最短周期 1e-3 对归一化后的值来说已经很细。</p>' +
        guess('层的薄板和箭头只表示顺序；阵列例子用 AetherGlove 的 5 × 15。') + src('附录 B.2 · ftp1_blocks.py:27-295 · ftp1_model_config.py:52-57') },
    { n: 5, part: '§2.1 MTTS', title: '每只手 24 个槽位：按“哪块手”对齐', sub: '切换设备，看它占哪些槽位；下排是这只手的 24 个 token 位置', dur: 14, cam: [0.0, 0.98, 30, [0, 3.6, 0]],
      html: dl([['0–14', '手上触觉：0 拇指尖，1/7/11 食指，2/8/12 中指，3/9/13 无名指，4/10/14 小指，5 掌心，6 拇指根'], ['15–20', '力 / 力矩：15 腕部，16–20 五指关节'], ['21–23', '预留'], ['夹爪', '两侧传感器 → 0 和 1（“两指抓取”）'], ['左右手', '左手的槽位号 +24，共 48 个位置']]) +
        '<p>MTTS 不在乎传感器多大、多少触点，只问“这块信号来自手的哪个部位”。同一部位的信号压成一个 token。所以一只手最多 24 个 token，比按触点切 token 的方法（例如 LingBot-Touch）少得多，代价是部位内部的空间细节要靠编码器压进 512 维里。</p>' +
        guess('手是我用方块搭的，槽位位置照原文图 3。Sharpa DTC 占哪些槽位代码里没有（Sharpa 解析器没发布），这里按五个指尖 0–4 画。手套 0–5、Inspire 力矩 16–20、夹爪 0/1 来自代码。') +
        src('§2.1 · 图 3 · parse_data_aether.py:291,321 · parse_data_motiontrans.py:282,286 · parse_data_univtac.py:191') },
    { n: 6, part: '附录 B.2 嵌入', title: '加上功能区嵌入，再投影到触觉专家', sub: '切换配置；灰色空槽是零 token，padding 掩码为假', dur: 13, cam: [0.0, 1.05, 34, [0, 2.6, 0]],
      html: dl([['嵌入表', 'nn.Embedding(48, 512)：右手 0–23，左手 24–47，所有传感器共享'], ['顺序（代码）', 'token + 嵌入 → LayerNorm → Linear → GELU → Linear（都是 512）'], ['顺序（论文）', '先 LayerNorm，再加嵌入，再 2 层 GELU MLP'], ['空槽', '全零 token，掩码为假，不参与注意力']]) +
        '<p>同一个“食指尖”的嵌入，不管来自 GelSight、手套还是 Sharpa DTC，都是同一行。这是 FTP-1 让不同传感器“说同一种语言”的关键：模型学到的是“食指尖在发生什么”，而不是“这台 GelSight 在发生什么”。</p>' +
        src('§2.1 · 附录 B.2 · ftp1_blocks.py:552-553, 646-651, 681-682, 800-801 · dataset_zarr.py:1525-1528') },
    { n: 7, part: '附录 B.4 注意力', title: '三个专家，一个分块掩码', sub: '高亮的 query 行能看哪些 key；切换成“触觉进 VLM”做对比', dur: 15, cam: [0.0, 1.1, 40, [1.5, 5.0, 0]],
      html: dl([['掩码', '行 = query，列 = key，顺序 VL、触觉、动作：[[1,0,0],[0,1,0],[1,1,1]]'], ['每层', '三个专家各自算 Q、K、V，拼起来做一次注意力，再各自过输出投影和 FFN'], ['宽度', 'VL 2048；触觉 512（代码）/ 1024（论文）；动作 1024；都是 18 层'], ['推理', 'VL 和触觉的 KV 各算一次缓存，去噪 10 步只重算动作那一路']]) +
        '<p>触觉和视觉语言互相看不见：作者说这样不会扰动 PaliGemma 里的预训练知识，触觉专家也能原样搬到新传感器上。Tactile-VLA 式的做法（第二个开关）把触觉 token 直接拼进 VLM 的序列，表 2 里它反而比不用触觉的 π0.5 差。</p>' +
        guess('每路只画了 6 到 8 个 token；三座塔的粗细按宽度比例。') + src('§2.3 · 附录 B.4 · ftp1_attention_masks.py:49-100 · gemma.py:69-104') },
    { n: 8, part: '附录 B.1/B.3 出动作', title: 'adaRMS 注入本体感觉，10 步去噪出 32 × 120', sub: '切换本体，看 120 维里哪些槽位有效；动作块从噪声走向轨迹', dur: 15, cam: [0.0, 1.05, 38, [3.6, 4.4, 0]],
      html: dl([['本体感觉', '120 维 → Fourier ×9 = 1080 → 2048 → 2048 → 1024（GELU）→ LayerNorm'], ['时间', 'sin 编码 → 2 层 SiLU MLP → 1024 → LayerNorm'], ['条件', '拼成 2048，调制动作专家每层 RMSNorm（scale、shift、gate）'], ['UAS', '右臂 48 = 腕平移 3 + 6D 旋转 6 + 臂关节 7 + 手 32；左臂 48；头 9；预留 15'], ['损失', '流匹配 MSE，只算有效槽位（掩码 M）']]) +
        '<p>不同机器人的动作长短不一，FTP-1 让它们都写进同一张 120 列的表，空着的列在损失里不算。Sharpa Wave 的 22 个关节按表 7 填进 32 个手槽位；夹爪只用第 28 号槽位（开合距离）。</p>' +
        toyb('去噪是线性插值的玩具：x_t = t·ε + (1−t)·a，t 从 1 到 0 走 10 步；目标轨迹 a 是我设的正弦。各本体的臂 / 腕槽位取舍是示意，手槽位按表 7 和代码。') +
        src('附录 B.1、B.3 · ftp1_pytorch.py:282-306, 472, 652-674 · ftp1_model_config.py:14-27') },
    { n: 9, part: '§2.4 / 附录 C 数据', title: '26 个来源，重采样成 20 / 30 / 50', sub: '切换柱高：最终占比、重采样倍率、去重帧数（权重）', dur: 13, cam: [0.0, 0.3, 50, [0, 0, -0.6]],
      html: dl([['人手（红）', '5 个：EgoTac 三个（AetherGlove）、OpenTouch、OmniSharingDB'], ['灵巧手（黄）', '6 个：Sharpa North-FTP-1、HumanoidEveryday、OpenLETDex、MotionTrans、两个 DexUMI'], ['夹爪 / UMI（蓝）', '15 个：RH20T 三个配置、UniT、RDP、VLA-Touch、FreeTacMan、ViTaMIn 等'], ['倍率', '就是复制次数：权重里 Unit 有 132 个完整副本加一个部分副本']]) +
        '<p>原始规模差两个数量级：EgoTac-Open 一份约 2,180 万帧，RDP-Bimanual 不到 2 万帧。按倍率重采样后，小数据集被复制上百次，最后人手、灵巧手、夹爪大约 20%、30%、50%。切到“去重帧数”可以看到原始数据以手套为主（读者注 5）。</p>' +
        src('表 8 · 权重 normalization/dataset_stats.json') },
    { n: 10, part: '§3 / §4 迁移', title: '换传感器、换机器人：哪些模块复用', sub: '切换设置；橙色来自 FTP-1，紫色来自 π0.5，绿色来自 T3，灰色从头训', dur: 14, cam: [0.0, 1.1, 34, [0, 3.0, 0]],
      html: dl([['见过的传感器', 'UniVTAC（GelSight-Mini）、Sharpa North、Sharpa&Dexmate（Sharpa DTC）：tokenizer 和触觉专家都从 FTP-1 加载'], ['没见过的传感器', 'FlexivXense（Xense）、TactileUMI（Contactile）：新建传感器编码器，其余从 FTP-1 加载'], ['FTP-π0.5', '同结构，部分用 π0.5 初始化，没有 FTP-1 预训练'], ['NTP-1', '同数据无触觉预训练，微调时再加触觉结构']]) +
        '<p>FTP-1 的“通用”体现在这里：新硬件只需要一个小编码器（图像型 3 层 ViT、阵列型 CNN、状态型 MLP），把它的信号送进已经学会“看触觉”的触觉专家。新传感器的编码器是在下游示教上和整个模型一起训的，不是零样本。</p>' +
        guess('FTP-π0.5 和 NTP-1 的 T3 主干、功能区嵌入从哪来，论文没写，这里画成“从 T3 / 从头”。') + src('§3.2 · §4 · §4.2 · 附录 D') },
    { n: 11, part: '§3 / §4 结果', title: '表里的数', sub: '切换表；柱子都是原文数字', dur: 12, cam: [0.0, 1.2, 34, [0, 4.6, 0]],
      html: dl([['表 1', 'UniVTAC：FTP-1 66.66 / 59.5，比第二名高 17.5'], ['表 2', '真机：62.5 对 π0.5 的 45.3（按原数应为 45.83）'], ['表 3', '没见过的传感器：46.6 对 15.0，60 次试验'], ['图 7', 'UniVTAC 的 FTP-π0.5 画成 41.8，表里是 45.16'], ['表 4 / 11', '匹配预训练 57.0；一半数据和步数 59.0']]) +
        '<p>摘要的 +17.2% 和 +31% 都是百分点差，分别来自表 2 和表 3（读者注 1、2）。真机每个任务只有 20 次，单任务的差距不要过度解读；合起来看，表 2 的差距 p ≈ 0.01，表 3 p ≈ 0.0002（读者注 12）。</p>' + src('表 1–4 · 图 7 · 表 10、11') }
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

  /* ---------- 3D helpers (same pattern as interactives/daxbench) ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.3, phi: 1.0, dist: 24, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  if (!S) { showInfo(0); return; }
  const root = new THREE.Group(); S.scene.add(root);
  let LABS = [], refDist = 24, PICKS = [];
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  function dynLab(G, pos, o = {}) {
    const st = { s: null, t: null };
    const f = t => { if (t === st.t) return; if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; st.s = lab(t, pos, o); G.add(st.s); };
    f.vis = v => { if (st.s) st.s.visible = v; }; return f;
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BALL = new THREE.SphereGeometry(1, 10, 8), CUBE = new THREE.BoxGeometry(1, 1, 1);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: 0.6 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  const recolor = (m, color) => { m.material.color.setHex(color); m.userData.c = hex3(color); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.14) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.6, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  function segs(G, n, color, o = {}) {
    const pos = new Float32Array(n * 6), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: o.opacity ?? 0.6 })); l.frustumCulled = false; G.add(l);
    l.userData.pos = pos; l.userData.up = () => { g.attributes.position.needsUpdate = true; g.setDrawRange(0, n * 2); }; return l;
  }
  function floorRect(G, cx, cz, lx, lz, color, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(lx, lz), new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: o.opacity != null, opacity: o.opacity ?? 1, depthWrite: o.opacity == null })); m.rotation.x = -PI / 2; m.position.set(cx, o.y ?? 0, cz); G.add(m); return m; }
  function arrowObj(G, from, to, color) { const a = L.arrow(from, to, color); G.add(a); return a; }
  /* a stack of thin slabs = transformer layers */
  function slabs(G, n, w, d, color, x, y0, gap, o = {}) { const arr = []; for (let i = 0; i < n; i++) { const b = block(w, 0.16, d, color, [x, y0 + i * gap, o.z ?? 0], { opacity: o.opacity ?? 0.92 }); G.add(b); arr.push(b); } return arr; }

  function buildCtl() {
    const box = $('ctl'); box.innerHTML = ''; box.hidden = true; if (!api) return;
    (api.ctls || []).forEach((c, gi) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-g="${gi}" data-k="${k}" aria-pressed="${c.get() === k}">${t}</button>`).join('');
      box.appendChild(row); box.hidden = false;
    });
  }
  function syncCtl() { (api?.ctls || []).forEach((c, gi) => { $('ctl').querySelectorAll(`button[data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(c.get() === +b.dataset.k))); }); }

  /* ---------- toy tactile signals (pure functions of p) ---------- */
  const contact = p => [0.5 + 0.28 * Math.cos(2 * PI * p), 0.5 + 0.22 * Math.sin(4 * PI * p), 0.55 + 0.45 * Math.sin(PI * clamp(p * 1.1, 0, 1))];

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    floorRect(G, 0.5, 0, 34, 14, 0x1b2438, { y: -0.6, opacity: 0.6 });
    const tower = (x, w, color, name, sub, go) => { const b = block(w, 5.2, 2.2, color, [x, 4.4, 0], { opacity: 0.88 }); b.userData.go = go; G.add(b, lab(name, [x, 7.6, 0], { size: 20 }), lab(sub, [x, 1.25, 1.4], { size: 14 })); PICKS.push(b); return b; };
    const tE = tower(-3.2, 3.0, COL.tac, '触觉专家', '18 层 · 宽 512（代码）', 6), vE = tower(3.4, 4.2, COL.vl, 'VL 专家', 'PaliGemma 2B', 6), aE = tower(10.0, 3.6, COL.act, '动作专家', 'gemma_300m · adaRMS', 7);
    const tok = (x, n, color, y = 0.3) => { const arr = []; for (let i = 0; i < n; i++) { const b = block(0.45, 0.45, 0.45, color, [x + (i - (n - 1) / 2) * 0.6, y, 0]); G.add(b); arr.push(b); } return arr; };
    const tT = tok(-3.2, 5, COL.tac), vT = tok(2.4, 4, COL.vl), lT = tok(4.9, 3, COL.white), nT = tok(10.0, 5, 0x8e9bb8);
    G.add(lab('功能区 token', [-3.2, -0.55, 1.2], { size: 14 }), lab('图像 + 语言 token', [3.6, -0.55, 1.2], { size: 14 }), lab('噪声动作', [10.0, -0.55, 1.2], { size: 14 }));
    const enc = [['图像型', COL.img, 3], ['阵列型', COL.arr, 4], ['状态型', COL.st, 4]].map(([n, c, go], i) => { const b = block(2.4, 1.0, 1.4, c, [-12.4, 1.0 + i * 2.0, 0]); b.userData.go = go - 1; PICKS.push(b); G.add(b, lab(n, [-12.4, 1.0 + i * 2.0, 1.1], { size: 15 })); return b; });
    const mtts = block(1.6, 4.6, 1.6, COL.emb, [-8.2, 3.0, 0], { opacity: 0.85 }); mtts.userData.go = 4; PICKS.push(mtts); G.add(mtts, lab('MTTS\n+ 功能区嵌入', [-8.2, 6.1, 0], { size: 15 }));
    const out = block(4.4, 0.6, 1.4, COL.act, [10.0, 8.6, 0], { opacity: 0.9 }); G.add(out, lab('动作块 32 × 120', [10.0, 9.6, 0], { size: 16 }));
    const st = block(1.8, 0.8, 1.2, COL.gold, [13.6, 2.2, 0]); G.add(st, lab('本体感觉', [13.6, 3.2, 0], { size: 14 })); st.userData.go = 7; PICKS.push(st);
    const f1 = stream(G, 9, COL.tac, 0.13), f2 = stream(G, 9, COL.vl, 0.13), f3 = stream(G, 9, COL.act, 0.13), f4 = stream(G, 6, COL.gold, 0.11);
    return { update(p) {
      const ph = (p * 4) % 1;
      f1([[-12.4, 3.0, 0], [-8.2, 3.0, 0], [-3.2, 0.3, 0], [-3.2, 4.4, 0], [10.0, 4.4, 0]], ph, seg(p, 0.05, 0.2));
      f2([[3.4, 0.3, 0], [3.4, 4.4, 0], [10.0, 4.4, 0.4]], ph, seg(p, 0.15, 0.3));
      f3([[10.0, 0.3, 0], [10.0, 8.6, 0]], ph, seg(p, 0.3, 0.45));
      f4([[13.6, 2.2, 0], [11.8, 4.4, 0]], ph, seg(p, 0.35, 0.5));
      const k = 0.25 + 0.25 * Math.sin(p * 30); [tE, mtts, ...enc].forEach(b => glow(b, k)); glow(aE, seg(p, 0.4, 0.6) * 0.4); glow(out, seg(p, 0.6, 0.8) * 0.6);
      cap(p < 0.3 ? '触觉：三类编码器 → MTTS 功能区 token（每手最多 24 个）→ 触觉专家' : p < 0.6 ? '三路在每层拼起来做一次注意力；只有动作 token 能看到触觉和视觉语言' : '动作专家用流匹配把噪声变成 32 步 × 120 维的动作块 · 点方块跳到对应那一幕');
    } };
  }

  /* ---------- scene 2: three signal types ---------- */
  function s2(G) {
    const N = 24, dots = inst(CUBE, N * N); G.add(dots);
    const plate = block(6.6, 0.15, 6.6, 0x2a3350, [-8.5, 0.0, 0]); G.add(plate);
    G.add(lab('图像型：视触觉相机拍凝胶\n224 × 224 × 3', [-8.5, 5.4, 0], { size: 16 }));
    const AR = [5, 15], bars = inst(CUBE, AR[0] * AR[1]); G.add(bars);
    G.add(block(6.4, 0.15, 2.6, 0x2a3350, [0.5, 0.0, 0]), lab('阵列型：手套压阻条\n例 AetherGlove 5 × 15', [0.5, 5.4, 0], { size: 16 }));
    const ft = []; const FN = ['Fx', 'Fy', 'Fz', 'Tx', 'Ty', 'Tz'];
    FN.forEach((n, i) => { const b = block(0.6, 1, 0.6, COL.st, [7.0 + i * 0.95, 0.5, 0]); G.add(b, lab(n, [7.0 + i * 0.95, -0.55, 0.6], { size: 13 })); ft.push(b); });
    G.add(lab('状态型：力 / 力矩\n例 ATI Axia80 6 维', [9.4, 5.4, 0], { size: 16 }));
    const panels = [[-8.5, 3.2], [0.5, 3.2], [9.4, 3.2]].map(([x]) => { const f = block(7.6, 0.06, 7.6, 0x38d1ff, [x, -0.2, 0], { opacity: 0.12, edges: false }); G.add(f); return f; });
    const fr = dynLab(G, [0.5, -2.2, 3.2], { size: 15 });
    return { update(p) {
      const [cx, cz, pr] = contact(p);
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const u = i / (N - 1), v = j / (N - 1), dx = u - cx, dz = v - cz, r2 = dx * dx + dz * dz, a = pr * Math.exp(-r2 / 0.02);
        const k = i * N + j; setI(dots, k, [-8.5 + (u - 0.5) * 6 + dx * a * 0.6, 0.12 + a * 0.5, (v - 0.5) * 6 + dz * a * 0.6], [0.12, 0.08 + a * 0.3, 0.12]);
        colI(dots, k, [0.25 + 0.7 * a, 0.35 + 0.2 * (1 - a), 0.75 - 0.4 * a]); }
      done(dots);
      for (let i = 0; i < AR[0]; i++) for (let j = 0; j < AR[1]; j++) { const u = j / (AR[1] - 1), v = i / (AR[0] - 1), d = (u - cx) ** 2 + ((v - cz) * 0.5) ** 2, a = pr * Math.exp(-d / 0.03); const k = i * AR[1] + j;
        setI(bars, k, [0.5 + (u - 0.5) * 5.8, 0.1 + a * 1.6, (v - 0.5) * 2.0], [0.32, 0.05 + a * 3.2, 0.32]); colI(bars, k, [0.2 + 0.3 * a, 0.5 + 0.45 * a, 0.35]); }
      done(bars);
      ft.forEach((b, i) => { const h = 0.2 + 2.4 * pr * Math.abs(Math.sin(2 * PI * p * (1 + i * 0.3) + i)); b.scale.y = h; b.position.y = h / 2; });
      const hi = Math.floor(clamp(p, 0, 0.999) * 3); panels.forEach((f, i) => { f.material.opacity = i === hi ? 0.28 : 0.07; });
      fr(['图像型 7 种：一张 224² 图 → 一个 token（每个功能区）', '阵列型 5 种：H × W × D 的网格 → 一个 token', '状态型 9 种：D 个数 → 一个 token'][hi]);
      cap(`同一次“按下去”，三种传感器给出的数据形状完全不同 · 接触强度 ${pr.toFixed(2)}（玩具）`);
    } };
  }

  /* ---------- scene 3: image-type encoder ---------- */
  function s3(G) {
    let sensor = 0; const SN = ['GelSightMini', 'SharpaWave', 'ViTaMIn', 'Xense（新）'], SC = [0xe05d8a, 0xf0963c, 0x7cb8ff, 0x8e9bb8];
    const img = inst(CUBE, 14 * 14); G.add(img);
    G.add(lab('触觉图 224×224\n→ 14×14 小块 + CLS', [-11.5, 5.2, 0], { size: 15 }));
    const toks = inst(CUBE, 15); G.add(toks);
    const own = slabs(G, 3, 4.4, 3.0, SC[0], -3.2, 0.8, 0.55);
    G.add(lab('传感器专用 ViT\n3 层 · 768 · 12 头', [-3.2, 4.4, 0], { size: 15 }));
    const shared = slabs(G, 9, 4.4, 3.0, COL.t3, 3.6, 0.6, 0.5);
    G.add(lab('共享 T3 主干\n9 层 · 768 · 12 头 · 63.8M', [3.6, 6.4, 0], { size: 15 }));
    const cls = block(0.5, 2.4, 0.5, COL.t3, [9.0, 3.0, 0]); const proj = block(0.5, 1.6, 0.5, COL.tac, [11.4, 3.0, 0]);
    G.add(cls, proj, lab('CLS\n768', [9.0, 5.2, 0], { size: 14 }), lab('image_proj\n→ 512', [11.6, 5.0, 0], { size: 14 }));
    const fl = stream(G, 10, 0xeef2fa, 0.12);
    const name = dynLab(G, [-3.2, -0.6, 2.2], { size: 15 });
    const ctls = [{ label: '传感器', items: SN, get: () => sensor, set: k => { sensor = k; } }];
    return { ctls, update(p) {
      own.forEach(b => recolor(b, SC[sensor])); name(`${SN[sensor]} 的专用 3 层${sensor === 3 ? '（微调时新建）' : '（预训练时学好）'}`);
      const [cx, cz, pr] = contact(p * 0.7);
      for (let i = 0; i < 14; i++) for (let j = 0; j < 14; j++) { const u = i / 13, v = j / 13, a = pr * Math.exp(-((u - cx) ** 2 + (v - cz) ** 2) / 0.03), k = i * 14 + j, sp = seg(p, 0.05, 0.25) * 0.12;
        setI(img, k, [-11.5 + (u - 0.5) * (4.2 + sp * 10), 1.0 + (v - 0.5) * 4.2 * (1 - seg(p, 0.05, 0.25)) + seg(p, 0.05, 0.25) * 0.2, (v - 0.5) * 4.2 * seg(p, 0.05, 0.25)], [0.26, 0.26, 0.26]);
        const c = hex3(SC[sensor]); colI(img, k, [c[0] * (0.4 + 0.6 * a), c[1] * (0.4 + 0.6 * a), c[2] * (0.4 + 0.6 * a)]); }
      done(img);
      for (let i = 0; i < 15; i++) { setI(toks, i, [-7.2, 0.3 + i * 0.3, 0], i === 14 ? [0.5, 0.22, 0.5] : [0.35, 0.18, 0.35]); colI(toks, i, i === 14 ? hex3(COL.gold) : hex3(SC[sensor])); }
      done(toks); toks.visible = p > 0.2;
      own.forEach((b, i) => glow(b, seg(p, 0.25 + i * 0.05, 0.3 + i * 0.05) * (1 - seg(p, 0.55, 0.6)) * 0.7));
      shared.forEach((b, i) => glow(b, seg(p, 0.4 + i * 0.025, 0.45 + i * 0.025) * (1 - seg(p, 0.8, 0.85)) * 0.6));
      glow(cls, seg(p, 0.65, 0.75) * 0.8); glow(proj, seg(p, 0.75, 0.85) * 0.8);
      fl([[-11.5, 1.0, 0], [-7.2, 2.0, 0], [-3.2, 1.6, 0], [3.6, 2.6, 0], [9.0, 3.0, 0], [11.4, 3.0, 0]], (p * 3) % 1, seg(p, 0.2, 0.3));
      cap(p < 0.25 ? '切成 14 × 14 个小块，加一个 CLS token' : p < 0.45 ? `前 3 层是 ${SN[sensor]} 专用的` : p < 0.75 ? '后 9 层所有图像传感器共用（T3 权重初始化）' : '只取 CLS，再线性投影到 512 维 = 这个功能区的一个 token');
    } };
  }

  /* ---------- scene 4: array / state encoders with Fourier features ---------- */
  function s4(G) {
    let mode = 0;
    const sub = new THREE.Group(); G.add(sub);
    /* Fourier curves: 4 periods log-spaced 1e-3..1, drawn on a normalised axis so they can be seen */
    const curves = [0, 1, 2, 3].map(k => { const pts = []; for (let i = 0; i <= 120; i++) { const x = i / 120; pts.push([-2.4 + x * 4.8, 5.6 + 0.35 * Math.sin(2 * PI * x * Math.pow(2.2, k) * 1.3) + (k - 1.5) * 0.85, -1.6]); } const l = L.line(pts, [COL.st, COL.arr, COL.t3, COL.emb][k], { opacity: 0.9 }); G.add(l); return l; });
    G.add(lab('Fourier：4 个周期 × (sin, cos)，1e-3 … 1（对数等距）', [0, 7.9, -1.6], { size: 14 }));
    const marker = block(0.08, 3.6, 0.08, COL.white, [0, 5.6, -1.6]); G.add(marker);
    const fl = stream(G, 10, 0xeef2fa, 0.12); let last = -1, parts = [];
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); last = mode; parts = [];
      if (mode === 0) {
        const grid = []; for (let i = 0; i < 5; i++) for (let j = 0; j < 15; j++) { const b = block(0.26, 0.26, 0.26, COL.arr, [-11.5 + (j - 7) * 0.34, 1.2, (i - 2) * 0.34]); sub.add(b); grid.push(b); }
        sub.add(lab('阵列 5 × 15 × D', [-11.5, 2.8, 0], { size: 15 }));
        const fe = block(5.2, 0.9, 1.8, COL.arr, [-5.6, 1.2, 0], { opacity: 0.6 }); sub.add(fe, lab('× 9 通道（原值 + 8 维 Fourier）', [-5.6, -0.4, 1.4], { size: 14 }));
        const conv = [[3.6, 1.6], [2.8, 1.3], [2.0, 1.0]].map(([w, d], i) => { const b = block(w, 0.5, d, COL.arr, [-1.0 + i * 2.2, 1.2, 0], { opacity: 0.85 }); sub.add(b); return b; });
        sub.add(lab('3 层 3×3 卷积（GELU）', [1.2, -0.4, 1.4], { size: 14 }));
        const mlp = [block(0.5, 2.2, 0.5, 0x9aa6bf, [6.0, 1.2, 0]), block(0.5, 1.6, 0.5, 0x9aa6bf, [7.2, 1.2, 0])]; mlp.forEach(b => sub.add(b)); sub.add(lab('Linear → ReLU\n→ Linear', [6.6, 3.4, 0], { size: 14 }));
        parts = [grid, fe, ...conv, ...mlp];
      } else {
        const vec = [0, 1, 2, 3, 4, 5].map(i => { const b = block(0.5, 0.5, 0.5, COL.st, [-11.5, 0.4 + i * 0.6, 0]); sub.add(b); return b; });
        sub.add(lab('状态 D = 6\n（力 / 力矩）', [-11.5, 4.6, 0], { size: 15 }));
        const fe = block(0.5, 0.5 * 9, 0.5, COL.st, [-7.0, 2.4, 0], { opacity: 0.6 }); sub.add(fe, lab('6 × 9 = 54', [-7.0, 5.2, 0], { size: 14 }));
        const mlp = [[2.4, 108], [2.4, 1024], [1.6, 512]].map(([h], i) => { const b = block(0.6, h + (i === 1 ? 0.6 : 0), 0.6, 0x9aa6bf, [-2.8 + i * 2.6, 2.0, 0]); sub.add(b); return b; });
        sub.add(lab('3 层 MLP（代码 GELU，论文 ReLU）\n宽 2×512 → 2×512 → 512', [-0.2, 4.6, 0], { size: 14 }));
        parts = [vec, fe, ...mlp];
      }
      const out = block(0.5, 1.6, 0.5, COL.tac, [10.4, 1.2, 0]); sub.add(out, lab('token 512', [10.6, -0.4, 1.0], { size: 15 })); parts.push(out);
    }
    rebuild();
    const ctls = [{ label: '类型', items: ['阵列型（matrix）', '状态型（state）'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      if (last !== mode) rebuild();
      marker.position.x = -2.4 + 4.8 * ((p * 2) % 1);
      const n = parts.length; parts.forEach((b, i) => { const k = seg(p, i / n, (i + 0.7) / n) * (1 - seg(p, (i + 1.2) / n, (i + 1.6) / n)); (Array.isArray(b) ? b : [b]).forEach(x => glow(x, 0.15 + 0.6 * k)); });
      if (mode === 0) parts[0].forEach((b, i) => { const [cx, , pr] = contact(p); const u = (i % 15) / 14; const h = 0.26 + pr * 1.4 * Math.exp(-((u - cx) ** 2) / 0.02); b.scale.y = h / 0.26; b.position.y = 1.2 + h / 2; });
      fl([[-11.5, 1.4, 0], [-5.6, 1.4, 0], [mode === 0 ? 3.4 : 2.4, 1.4, 0], [10.4, 1.4, 0]], (p * 3) % 1, 1);
      cap(mode === 0 ? '阵列：每个触点的 D 维信号先扩成 9D，卷积抓空间结构，最后压成一个 512 维 token' : '状态：几个数先扩成 9 倍，MLP 直接映射成一个 512 维 token；同一传感器同形状的功能区共用这个 MLP');
    } };
  }

  /* ---------- hand model shared by scenes 5 and 6 ---------- */
  /* slot positions in hand-local coordinates, laid out like Fig. 3 (palm facing the camera) */
  const FING = [ // right hand seen from the palm side as in Fig. 3: thumb on the right, little finger on the left
    { th: 1, x: 2.0, ang: -0.75, len: 2.6, s: [0, 6], tq: 16 }, { x: 1.15, ang: -0.08, len: 3.6, s: [1, 7, 11], tq: 17 }, { x: 0.0, ang: 0, len: 3.9, s: [2, 8, 12], tq: 18 },
    { x: -1.15, ang: 0.06, len: 3.6, s: [3, 9, 13], tq: 19 }, { x: -2.2, ang: 0.16, len: 2.9, s: [4, 10, 14], tq: 20 }];
  const fbase = f => [f.x, f.th ? 0.6 : 3.2];
  function slotPos() {
    const P = {}; P[5] = [-0.4, 1.0, 0.4]; P[15] = [0, -1.3, 0.4];
    FING.forEach(f => { const [bx, by] = fbase(f), dx = -Math.sin(f.ang), dy = Math.cos(f.ang), n = f.s.length;
      f.s.forEach((id, i) => { const t = (n - i - 0.45) / n; P[id] = [bx + dx * f.len * t, by + dy * f.len * t, 0.4]; });
      P[f.tq] = f.th ? [bx - 0.9, by + 0.2, 0.4] : [bx, by - 0.75, 0.4]; });
    return P;
  }
  const SP = slotPos();
  function handMesh(G, ox, oy, sc = 1) {
    const H = new THREE.Group(); H.position.set(ox, oy, 0); H.scale.setScalar(sc); G.add(H);
    H.add(block(5.4, 3.6, 0.7, COL.skin, [0, 1.4, 0], { opacity: 0.55 }));
    FING.forEach(f => { const [bx, by] = fbase(f); const g = new THREE.Group(); g.position.set(bx, by, 0); g.rotation.z = f.ang; H.add(g);
      g.add(block(0.85, f.len, 0.6, COL.skin, [0, f.len / 2, 0], { opacity: 0.55 })); });
    return H;
  }

  /* ---------- scene 5: MTTS slots ---------- */
  function s5(G) {
    let dev = 0;
    const DEV = [
      { n: '手套（AetherGlove）', on: [0, 1, 2, 3, 4, 5], c: COL.arr, src: '代码：parse_data_aether.py 五指 0–4、掌心 5' },
      { n: '灵巧手（Sharpa DTC）', on: [0, 1, 2, 3, 4], c: COL.img, src: '示意：Sharpa 解析器没发布，按指尖画' },
      { n: '力矩（Inspire + 腕部）', on: [15, 16, 17, 18, 19, 20], c: COL.st, src: '代码：Inspire 力矩 16–20；腕部 15 按图 3' },
      { n: '平行夹爪（GelSight ×2）', on: [0, 1], c: COL.img, src: '代码：parse_data_univtac.py:191 → [0, 1]' }];
    const H = handMesh(G, -4.5, 0.6, 1.0);
    const balls = {}; for (let id = 0; id < 21; id++) { const p = SP[id]; const m = L.sphere(0.32, id >= 15 ? COL.bad : 0x2b3650); m.position.set(p[0] - 4.5, p[1] + 0.6, p[2] + 0.3); G.add(m); balls[id] = m; G.add(lab(String(id), [p[0] - 4.5, p[1] + 0.6, p[2] + 0.9], { size: 13, color: id >= 15 ? '#ff9a9a' : '#e6ecf7' })); }
    G.add(lab('21–23 预留', [-9.6, 8.6, 0], { size: 14, color: '#bba8ff' }));
    const jaw = [block(0.6, 2.6, 1.4, 0x9aa6bf, [-7.4, 5.0, 2.2]), block(0.6, 2.6, 1.4, 0x9aa6bf, [-5.0, 5.0, 2.2])]; jaw.forEach(b => G.add(b));
    const row = []; for (let i = 0; i < 24; i++) { const b = block(0.42, 0.42, 0.42, 0x2b3650, [3.2 + (i % 12) * 0.62, i < 12 ? 6.2 : 5.2, 0]); G.add(b); row.push(b); if (i % 6 === 0 || i === 23) G.add(lab(String(i), [3.2 + (i % 12) * 0.62, i < 12 ? 6.9 : 4.5, 0], { size: 12 })); }
    G.add(lab('这只手的 24 个 token 位置', [6.6, 8.1, 0], { size: 15 }));
    const nm = dynLab(G, [6.6, 2.6, 0], { size: 16 }), sr = dynLab(G, [6.6, 1.4, 0], { size: 13 });
    const lines = segs(G, 6, COL.white, { opacity: 0.5 });
    const ctls = [{ label: '设备', items: DEV.map(d => d.n), get: () => dev, set: k => { dev = k; } }];
    return { ctls, update(p) {
      const d = DEV[dev], on = new Set(d.on), k = seg(p, 0.1, 0.4);
      for (let id = 0; id < 21; id++) { const b = balls[id], a = on.has(id); b.material.color.setHex(a ? d.c : (id >= 15 ? 0x7a3a3a : 0x2b3650)); b.material.emissive.setHex(a ? d.c : 0); b.material.emissiveIntensity = a ? 0.3 + 0.4 * k : 0; b.scale.setScalar(a ? 1 + 0.3 * k : 0.8); }
      row.forEach((b, i) => { const a = on.has(i); recolor(b, a ? d.c : 0x2b3650); glow(b, a ? seg(p, 0.4, 0.6) * 0.8 : 0); });
      jaw.forEach(j => { j.visible = dev === 3; }); H.traverse(c => { if (c.isMesh) c.material.opacity = dev === 3 ? 0.2 : 0.55; });
      const pos = lines.userData.pos; let c = 0; const g = seg(p, 0.45, 0.7);
      d.on.forEach(id => { if (c >= 6) return; const a = balls[id].position, b = row[id].position; pos.set([a.x, a.y, a.z, L.lerp(a.x, b.x, g), L.lerp(a.y, b.y, g), L.lerp(a.z, b.z, g)], c * 6); c++; });
      for (let i = c; i < 6; i++) pos.fill(0, i * 6, i * 6 + 6); lines.userData.up();
      if (dev === 3) jaw.forEach((j, i) => { j.position.x = (i ? -5.0 : -7.4) + (i ? -1 : 1) * 0.5 * Math.sin(PI * clamp(p * 1.5, 0, 1)); });
      nm(d.n + ` · 占 ${d.on.length} 个槽位`); sr(d.src);
      cap(dev === 3 ? '夹爪没有“手”，两侧的传感器借用拇指尖 0 和食指尖 1 两个槽位：都是“两指捏”的功能' : '信号按“来自手的哪个部位”放进槽位；没有信号的槽位留空（零 token，掩码为假）');
    } };
  }

  /* ---------- scene 6: functional-area embedding + unified projection ---------- */
  function s6(G) {
    let cfg = 0;
    const CFG = [{ n: '单手手套', on: [0, 1, 2, 3, 4, 5], c: COL.arr }, { n: '双手 Sharpa', on: [0, 1, 2, 3, 4, 24, 25, 26, 27, 28], c: COL.img }, { n: '夹爪', on: [0, 1], c: COL.img }];
    const slots = [], embs = [];
    for (let i = 0; i < 48; i++) { const x = -11.0 + (i % 24) * 0.78, y = i < 24 ? 1.2 : 0.2; const b = block(0.5, 0.5, 0.5, 0x2b3650, [x, y, 2.0]); G.add(b); slots.push(b);
      const e = block(0.5, 0.18, 1.6, COL.emb, [x, y + 5.6, -1.2], { opacity: 0.55 }); G.add(e); embs.push(e); }
    G.add(lab('右手 0–23', [-13.2, 1.2, 2.0], { size: 13 }), lab('左手 24–47', [-13.4, 0.2, 2.0], { size: 13 }));
    G.add(lab('功能区嵌入表 [48, 512]（所有传感器共享）', [-2.0, 8.0, -1.2], { size: 15 }));
    const proj = [['LayerNorm', 0x9aa6bf], ['Linear 512', 0x9aa6bf], ['GELU', 0x6b7794], ['Linear 512', 0x9aa6bf]].map(([n, c], i) => { const b = block(2.2, 0.5, 1.2, c, [11.6, 1.2 + i * 0.9, 0.6]); G.add(b, lab(n, [8.9, 1.2 + i * 0.9, 1.4], { size: 13 })); return b; });
    const out = block(1.6, 0.6, 1.2, COL.tac, [11.6, 5.0, 0.6]); G.add(out, lab('→ 触觉专家\n（48 个位置）', [11.6, 6.4, 0.6], { size: 14 }));
    const plus = lab('⊕', [-2.0, 3.4, 0.6], { size: 26 }); G.add(plus);
    const fall = inst(CUBE, 10); G.add(fall);
    const nm = dynLab(G, [-2.0, -1.4, 2.0], { size: 15 });
    const ctls = [{ label: '配置', items: CFG.map(c => c.n), get: () => cfg, set: k => { cfg = k; } }];
    return { ctls, update(p) {
      const c = CFG[cfg], on = new Set(c.on), drop = seg(p, 0.05, 0.3), add = seg(p, 0.35, 0.55), pr = seg(p, 0.6, 0.9);
      slots.forEach((b, i) => { const a = on.has(i); recolor(b, a ? (add > 0.5 ? COL.tac : c.c) : 0x2b3650); b.material.opacity = a ? 1 : 0.35; b.material.transparent = !a; glow(b, a ? 0.2 + 0.5 * add : 0); });
      embs.forEach((e, i) => { const a = on.has(i); glow(e, a ? add * 0.9 : 0); e.material.opacity = a ? 0.9 : 0.35; e.position.y = (i < 24 ? 1.2 : 0.2) + 5.6 - (a ? add * 3.4 : 0); });
      let k = 0; c.on.forEach(i => { if (k >= 10) return; const x = -11.0 + (i % 24) * 0.78, y = (i < 24 ? 1.2 : 0.2); setI(fall, k, [x, y + 4 * (1 - drop), 2.0], drop < 1 ? 0.42 : 0.001); colI(fall, k, hex3(c.c)); k++; });
      for (; k < 10; k++) setI(fall, k, [0, -50, 0], 0.001); done(fall);
      proj.forEach((b, i) => glow(b, seg(pr, i * 0.2, i * 0.2 + 0.3) * 0.8)); glow(out, seg(pr, 0.8, 1) * 0.8);
      nm(`${c.n}：${c.on.length} 个有效 token，${48 - c.on.length} 个空位`);
      cap(p < 0.33 ? '编码器给出的 token 落进各自的槽位' : p < 0.6 ? '每个有效槽位加上它那一行功能区嵌入（同一部位、不同传感器用同一行）' : '再过 LayerNorm → Linear → GELU → Linear（代码的顺序；论文写的是先 LayerNorm 再加嵌入）');
    } };
  }

  /* ---------- scene 7: three experts + block attention mask ---------- */
  function s7(G) {
    let mode = 0, width = 0; const NT = [8, 6, 7], X0 = [-9.5, -1.0, 6.5], CC = [COL.vl, COL.tac, COL.act], NM = ['视觉语言', '触觉', '动作'];
    const toks = []; NT.forEach((n, s) => { for (let i = 0; i < n; i++) { const b = block(0.6, 0.6, 0.6, CC[s], [X0[s] + i * 0.85, 0.3, 3.0]); G.add(b); toks.push({ b, s, i }); } });
    NM.forEach((n, s) => G.add(lab(n + ' token', [X0[s] + (NT[s] - 1) * 0.425, -0.8, 3.0], { size: 15 })));
    const towers = [0, 1, 2].map(s => { const b = block(2.2, 4.0, 1.6, CC[s], [X0[s] + (NT[s] - 1) * 0.425, 3.6, -1.6], { opacity: 0.5 }); G.add(b); return b; });
    const tw = [dynLab(G, [X0[0] + 3, 6.2, -1.6], { size: 14 }), dynLab(G, [X0[1] + 2.1, 6.2, -1.6], { size: 14 }), dynLab(G, [X0[2] + 2.5, 6.2, -1.6], { size: 14 })];
    [['VL 专家（PaliGemma）', 0], ['触觉专家', 1], ['动作专家（gemma_300m）', 2]].forEach(([n, s]) => G.add(lab(n, [X0[s] + (NT[s] - 1) * 0.425, 1.3, -1.6], { size: 13 })));
    /* 3x3 mask */
    const cells = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const b = block(1.3, 1.3, 0.2, 0x2b3650, [9.6 + c * 1.45, 11.4 - r * 1.45, -1.6]); G.add(b); cells.push({ b, r, c }); }
    G.add(lab('key →', [11.05, 13.0, -1.6], { size: 14 }), lab('query ↓', [7.4, 13.0, -1.6], { size: 14 }));
    ['VL', '触觉', '动作'].forEach((n, r) => G.add(lab(n, [7.9, 11.4 - r * 1.45, -1.6], { size: 13 })));
    const lines = segs(G, 64, COL.white, { opacity: 0.5 });
    const ctls = [{ label: '结构', items: ['FTP-1：独立触觉专家', 'Tactile-VLA 式：触觉进 VLM'], get: () => mode, set: k => { mode = k; } },
      { label: '触觉专家宽度', items: ['代码 512（99M）', '论文 1024（300M）'], get: () => width, set: k => { width = k; } }];
    const allow = (qs, ks) => mode === 0 ? (qs === 2 || qs === ks) : ((qs === 2) || (qs !== 2 && ks !== 2));
    return { ctls, update(p) {
      const q = Math.min(2, Math.floor(p * 3)), u = (p * 3) % 1;
      cells.forEach(({ b, r, c }) => { const a = allow(r, c); recolor(b, a ? CC[r] : 0x2b3650); glow(b, a && r === q ? 0.8 : 0.1); b.scale.z = a ? 1.6 : 1; });
      towers[1].visible = mode === 0; towers[1].scale.x = width ? 2.0 : 1.0;
      tw[0]('宽 2048'); tw[1](mode === 0 ? (width ? '宽 1024（论文）' : '宽 512（代码）') : '（无）'); tw[2]('宽 1024');
      if (mode === 1) toks.filter(t => t.s === 1).forEach(t => { t.b.position.x = X0[0] - 6.2 + t.i * 0.85; }); else toks.filter(t => t.s === 1).forEach(t => { t.b.position.x = X0[1] + t.i * 0.85; });
      const pos = lines.userData.pos; let c = 0; const qt = toks.filter(t => t.s === q); const qi = qt[Math.floor(u * qt.length) % qt.length];
      toks.forEach(t => glow(t.b, t === qi ? 0.9 : 0.05));
      toks.forEach(t => { if (c >= 64 || !allow(q, t.s) || t === qi) return; const a = qi.b.position, b = t.b.position; const h = 1.2 + 0.25 * Math.abs(t.s - q);
        pos.set([a.x, a.y + 0.3, a.z, b.x, b.y + 0.3 + h * 0, b.z], c * 6); c++; });
      for (let i = c; i < 64; i++) pos.fill(0, i * 6, i * 6 + 6); lines.userData.up();
      cap(`第 ${q + 1} 行：${NM[q]} token 作 query，能看 ${['VL', '触觉', '动作'].filter((_, k) => allow(q, k)).join('、')}${mode === 0 && q < 2 ? ' · 两路感知互相看不见' : ''}${mode === 1 && q === 0 ? ' · 触觉 token 混进了 VLM 的序列' : ''}`);
    } };
  }

  /* ---------- scene 8: adaRMS + flow matching into the 120-d UAS ---------- */
  function s8(G) {
    let emb = 0;
    const SHW = [3, 9, 16, 48, 51, 57, 64, 96, 105, 120]; // group boundaries: R wrist pos(3) rot(6) arm(7) hand(32) | L ... | head 9 | reserved 15
    const sharpaHand = [1, 2, 3, 26, 4, 7, 6, 8, 9, 12, 11, 13, 14, 17, 16, 18, 19, 25, 22, 21, 23, 24];
    const EMB = [
      { n: '双臂 Sharpa Wave', on: i => (i < 16 || (i >= 48 && i < 64)) || (i >= 16 && i < 48 && sharpaHand.includes(i - 16)) || (i >= 64 && i < 96 && sharpaHand.includes(i - 64)) },
      { n: 'Franka 夹爪（单臂）', on: i => i < 16 || i === 16 + 28 },
      { n: '人手（手套 + 头）', on: i => (i < 9) || (i >= 16 && i < 48 && i - 16 < 28) || (i >= 48 && i < 57) || (i >= 64 && i < 92) || (i >= 96 && i < 105) }];
    const H = 32, D = 120, cells = inst(CUBE, H * D); G.add(cells);
    const cx = j => -6.0 + j * 0.115 + (j >= 48 ? 0.25 : 0) + (j >= 96 ? 0.25 : 0) + (j >= 105 ? 0.25 : 0), cy = i => 0.6 + i * 0.16;
    [['右臂 48', 24, -0.5], ['左臂 48', 72, -0.5], ['头 9', 100, -0.5], ['预留 15', 114, -1.2]].forEach(([n, j, y]) => G.add(lab(n, [cx(j), y, 0.4], { size: 13 })));
    G.add(lab('动作块 32 步 × 120 维', [cx(60), 6.4, 0], { size: 15 }));
    const sE = [block(0.6, 2.2, 0.6, COL.gold, [11.2, 2.0, 0]), block(0.6, 1.8, 0.6, 0x9aa6bf, [12.4, 2.0, 0]), block(0.6, 1.4, 0.6, 0x9aa6bf, [13.6, 2.0, 0])];
    sE.forEach(b => G.add(b)); G.add(lab('状态 120 → ×9 → 1024', [12.4, 0.0, 0.6], { size: 13 }));
    const tE = block(0.6, 1.4, 0.6, COL.white, [12.4, 5.2, 0]); G.add(tE, lab('时间 t → 1024', [12.4, 4.0, 0.6], { size: 13 }));
    const ada = block(1.2, 0.8, 1.0, COL.act, [12.4, 8.6, 0]); G.add(ada, lab('拼成 2048\n→ scale / shift / gate', [12.6, 10.2, 0], { size: 13 }));
    const expert = slabs(G, 18, 13.8, 1.0, COL.act, cx(60), 7.4, 0.2, { z: -1.8, opacity: 0.5 });
    G.add(lab('动作专家 18 层（每层的 RMSNorm 被调制）', [cx(60), 11.4, -1.8], { size: 14 }));
    const rnd = L.rng(7), noise = Array.from({ length: H * D }, () => L.gauss(rnd));
    const nm = dynLab(G, [cx(48), -2.2, 0.4], { size: 15 });
    const ctls = [{ label: '本体', items: EMB.map(e => e.n), get: () => emb, set: k => { emb = k; } }];
    return { ctls, update(p) {
      const e = EMB[emb], step = Math.min(10, Math.floor(seg(p, 0.15, 0.85) * 10 + 1e-9)), t = 1 - step / 10;
      let nOn = 0;
      for (let i = 0; i < H; i++) for (let j = 0; j < D; j++) { const k = i * D + j, on = e.on(j); if (on && i === 0) nOn++;
        const a = 0.6 * Math.sin(i / 6 + j * 0.37), v = on ? t * noise[k] * 0.5 + (1 - t) * a : 0;
        setI(cells, k, [cx(j), cy(i), v * 0.6], [0.1, 0.13, on ? 0.12 + Math.abs(v) * 0.3 : 0.05]);
        const c = on ? [0.25 + 0.5 * (v + 1) / 2, 0.45 + 0.3 * (1 - t), 0.85 - 0.3 * (v + 1) / 2] : [0.18, 0.2, 0.26]; colI(cells, k, c); }
      done(cells);
      sE.forEach((b, i) => glow(b, seg(p, 0.02 + i * 0.03, 0.08 + i * 0.03) * 0.7)); glow(tE, 0.3 + 0.3 * Math.sin(p * 40)); glow(ada, seg(p, 0.1, 0.18) * 0.8);
      expert.forEach((b, i) => glow(b, (step > 0 && step < 10) ? 0.15 + 0.4 * ((i + step * 3) % 18 < 3 ? 1 : 0) : 0.05));
      nm(`${e.n}：120 维里有效 ${nOn} 维，其余在损失里被掩掉`);
      cap(step === 0 ? '从纯噪声开始（t = 1）' : step < 10 ? `第 ${step} / 10 步 Euler：x ← x − 0.1·v(x, t)，t = ${t.toFixed(1)}` : '去噪完成：执行前若干步，再用新观测重新推理（UniVTAC 脚本执行前 20 步）');
    } };
  }

  /* ---------- scene 9: 26 sources, radial bars ---------- */
  function s9(G) {
    let view = 0; const VC = { H: COL.hum, D: COL.dex, G: COL.grip };
    const bars = [], labs = [];
    T8.forEach((r, i) => { const a = 2 * PI * i / T8.length - PI / 2, R = 6.6; const b = block(0.7, 1, 0.7, VC[r[1]], [R * Math.cos(a), 0.5, R * Math.sin(a)]); G.add(b); bars.push(b);
      const Rl = [10.8, 12.4, 14.0][i % 3]; const nl = lab(r[0], [Rl * 1.12 * Math.cos(a), 0.2, Rl * Math.sin(a)], { size: 11 }); G.add(nl); });
    floorRect(G, 0, 0, 26, 26, 0x1b2438, { y: -0.02, opacity: 0.5 });
    [['人手 20%', COL.hum], ['灵巧手 30%', COL.dex], ['夹爪 / UMI 50%', COL.grip]].forEach(([n, c], i) => G.add(lab(n, [0, 0.3, -1.3 + i * 1.3], { size: 13, color: css(c) })));
    const vals = bars.map(b => { const st = { s: null, t: null }; return (t, y) => { if (t !== st.t) { if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; st.s = lab(t, [b.position.x, 0, b.position.z], { size: 10 }); G.add(st.s); } st.s.position.y = y; }; });
    const ctls = [{ label: '柱高', items: ['最终占比（表 8）', '重采样倍率', '去重帧数（权重）', '权重里的占比'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      const g = seg(p, 0, 0.5);
      bars.forEach((b, i) => { const r = T8[i]; const v = [r[4], r[3], r[6], r[5]][view]; const h = Math.max(0.05, [v * 0.75, Math.sqrt(v) * 0.6, Math.sqrt(v / 1e6) * 1.6, v * 0.75][view] * g);
        b.scale.y = h; b.position.y = h / 2; });
      bars.forEach((b, i) => { const r = T8[i], v = [r[4], r[3], r[6], r[5]][view]; const t = view === 2 ? (v / 1e6).toFixed(2) + 'M' : view === 1 ? '×' + v : v + '%';
        vals[i](t, b.scale.y + 0.5); });
      cap(['重采样后的占比（表 8）：三组合计 20 / 30 / 50', '重采样倍率 = 复制次数（开方刻度）', '一份副本的帧数（开方刻度）：EgoTac-Open 2,178 万，RDP-Bimanual 2 万', '权重 dataset_stats 的实际占比：Sharpa 11.1%（表 8 写 9.0%）'][view] + ' · ' + ['小来源被复制上百次，大来源（EgoTac-Open ×0.89）反而被降采样', '倍率和表 8 逐行相差不超过 0.15：权重和论文用的是同一套倍率', '去重后约 5,420 万帧，三个 EgoTac 手套来源占大半（读者注 5）', '和表 8 差得最多的是 Sharpa、HumanoidEveryday、OpenLETDex（读者注 6）'][view]);
    } };
  }

  /* ---------- scene 10: which modules are reused ---------- */
  function s10(G) {
    let su = 0;
    const MODS = [['VL 专家 + SigLIP', 'vl', [-9.0, 6.4]], ['动作专家', 'act', [-3.0, 6.4]], ['本体 / adaRMS / 动作投影', 'ada', [3.0, 6.4]], ['触觉专家', 'tex', [9.0, 6.4]],
      ['功能区嵌入 + 统一投影', 'emb', [9.0, 3.2]], ['T3 共享主干', 't3', [3.0, 0.0]], ['传感器编码器', 'enc', [9.0, 0.0]]];
    const F = COL.tac, P = COL.pi, T = COL.arr, N = COL.newc;
    const SU = [
      { n: 'UniVTAC', s: '见过：GelSight-Mini', c: { vl: F, act: F, ada: F, tex: F, emb: F, t3: F, enc: F }, enc: 'GelSightMini（预训练里有）' },
      { n: 'Sharpa North', s: '见过：Sharpa DTC', c: { vl: F, act: F, ada: F, tex: F, emb: F, t3: F, enc: F }, enc: 'SharpaWave（预训练里有）' },
      { n: 'Sharpa&Dexmate', s: '见过传感器，新机器人 Dexmate', c: { vl: F, act: F, ada: F, tex: F, emb: F, t3: F, enc: F }, enc: 'SharpaWave（预训练里有）' },
      { n: 'FlexivXense', s: '没见过：Xense（图像型）', c: { vl: F, act: F, ada: F, tex: F, emb: F, t3: F, enc: N }, enc: 'Xense：新建 3 层 ViT' },
      { n: 'TactileUMI', s: '没见过：Contactile（阵列型）', c: { vl: F, act: F, ada: F, tex: F, emb: F, t3: F, enc: N }, enc: 'Contactile：新建 CNN（不经过 T3）' },
      { n: 'FTP-π0.5', s: '基线：无 FTP-1 预训练', c: { vl: P, act: P, ada: N, tex: N, emb: N, t3: T, enc: N }, enc: '从头（T3 主干来源是示意）' },
      { n: 'NTP-1', s: '基线：同数据无触觉预训练', c: { vl: 0xc8a050, act: 0xc8a050, ada: 0xc8a050, tex: N, emb: N, t3: T, enc: N }, enc: '从头（T3 主干来源是示意）' }];
    const boxes = {}; MODS.forEach(([n, k, [x, y]]) => { const b = block(4.4, 1.4, 1.6, N, [x, y, 0]); G.add(b, lab(n, [x, y + 1.3, 0.9], { size: 14 })); boxes[k] = b; });
    [['来自 FTP-1', F], ['来自 π0.5', P], ['来自 T3', T], ['来自 NTP', 0xc8a050], ['从头训', N]].forEach(([n, c], i) => G.add(lab(n, [-10 + i * 3.6, -2.6, 1.0], { size: 13, color: css(c) })));
    const nm = dynLab(G, [0, 9.4, 0], { size: 17, border: 'rgba(240,150,60,.7)' }), en = dynLab(G, [9.0, -1.3, 1.2], { size: 13 });
    const ctls = [{ label: '设置', items: SU.map(s => s.n), get: () => su, set: k => { su = k; } }];
    return { ctls, update(p) {
      const s = SU[su], g = seg(p, 0.1, 0.5);
      Object.entries(boxes).forEach(([k, b], i) => { recolor(b, s.c[k]); glow(b, s.c[k] === N ? 0 : 0.2 + 0.4 * seg(p, 0.1 + i * 0.05, 0.2 + i * 0.05)); b.position.z = s.c[k] === N ? -0.6 * g : 0; });
      nm(`${s.n} · ${s.s}`); en(s.enc);
      cap(su <= 2 ? '传感器在预训练里出现过：连传感器专用编码器也直接加载' : su <= 4 ? '新传感器：只新建它的编码器，在 100 / 50 条示教上和整个模型一起微调' : su === 5 ? 'FTP-π0.5：和 FTP-1 同结构，VL 和动作专家来自 π0.5，触觉部分没有预训练' : 'NTP-1：用同样数据预训练但不看触觉；微调时才加触觉结构 → 在 Xense 上只有 5.0%');
    } };
  }

  /* ---------- scene 11: results ---------- */
  function s11(G) {
    let view = 0; const KEYS = ['t1', 't2', 't3', 'f7', 't11'];
    const sub = new THREE.Group(); G.add(sub); let last = -1, bars = [];
    const MC = { 'FTP-1': COL.tac, '100%（FTP-1）': COL.tac, 'FTP-π0.5': 0xb08cff, '0%（FTP-π0.5）': 0xb08cff, 'π0.5': COL.vl, 'Tactile-VLA': 0x7cb8ff, 'NTP-1': COL.arr, 'VITaL*': 0x8e9bb8, 'UniVTAC-ACT*': 0x8e9bb8, '50%': 0xf2c14e, 'π0.5 匹配预训练': 0x6b7794 };
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = view; const R = RES[KEYS[view]], n = R.m.length, gw = 4.0, key = KEYS[view];
      R.m.forEach(([nm, a, b], i) => { const x = (i - (n - 1) / 2) * gw; sub.add(lab(nm, [x, -0.6, 1.6], { size: 15 }));
        [a, b].forEach((v, j) => { if (v == null) return; const bx = x + (b == null ? 0 : (j - 0.5) * 1.45); const c = MC[nm] ?? 0x8e9bb8; const m = block(1.1, 1, 1.1, j ? 0x46506a : c, [bx, 0.5, 0], { edges: false }); sub.add(m); const l = lab(key === 't1' && j === 0 ? v.toFixed(2) : key === 't1' ? String(v) : v.toFixed(1), [bx, 0, 0.7], { size: 14 }); sub.add(l); bars.push({ m, l, v, j }); }); });
      sub.add(lab(R.t + (R.k[1] ? `   亮 = ${R.k[0]}，暗 = ${R.k[1]}` : ''), [0, 10.6, 0], { size: 17, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const MSG = ['UniVTAC：FTP-1 66.66（去 Lift 59.5），两种口径都比第二名高 17.5', '真机 6 列平均：62.5 对 45.3；按原表 π0.5 应为 275 / 6 = 45.83（读者注 1）', '没见过的传感器：46.6 − 15.0 = 31.6 个百分点，相对 3.1 倍；共 60 次试验', '图 7 的 FTP-π0.5（UniVTAC）画成 41.8，表 1 / 表 10 是 45.16（读者注 4）', '一半数据 + 一半步数 59.0；只多看机器人轨迹（匹配预训练）57.0'];
    const ctls = [{ label: '图表', items: ['表 1', '表 2', '表 3', '图 7', '表 4 / 11'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const g = seg(p, 0, 0.5); bars.forEach(({ m, l, v, j }) => { const h = Math.max(0.02, v * 0.13 * g); m.scale.y = h; m.position.y = h / 2; l.position.y = h + 0.5 + j * 0.5; });
      cap(MSG[view]);
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player (same as interactives/daxbench) ---------- */
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
    L.clear(root); LABS = []; PICKS = []; lastCap = null;
    const sc = SCENES[cur]; fly(...sc.cam); refDist = sc.cam[2] * aspectFix();
    const G = new THREE.Group(); root.add(G); pNow = p0; api = BUILD[cur](G); OPT = [];
    buildCtl();
    t0 = performance.now() - p0 * sc.dur * 1000; api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
  }
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
  window.__ftp1Debug = { get cap() { return $('cap').textContent; } };
})();
