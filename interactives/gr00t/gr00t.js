'use strict';
/* GR00T N1 (arXiv 2503.14734) taken apart into eleven animated scenes. Numbers come from the paper (v2), the official code
   NVIDIA/Isaac-GR00T (tags n1-release 755876a, n1.5/n1.6/n1.7-release, main 3b49067; read, not run) and the safetensors
   headers of the released checkpoints. Each scene's update(p) is a pure function of the timeline p plus the current toggles.
   Curves in scenes 3, 5, 9 and 10 are fixed toys; parameter counts, token counts and Beta densities are computed live.
   No GR00T network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { vlm: 0x5b8cf0, frozen: 0x6b7794, train: 0x4fc98a, dit: 0xf0963c, emb: 0x9fd89a, noise: 0x8e9bb8, ok: 0x4fc98a, bad: 0xe05d5d, gold: 0xf2c14e, data: 0x7cb8ff, dim: 0x46506a, white: 0xeef2fa, act: 0xf0963c, img: 0x3aa8e0, txt: 0xb48cff, state: 0xe05d5d, human: 0xd9a35b, sim: 0x4fc98a, neural: 0xb48cff, real: 0xf0963c, web: 0x7cb8ff };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const hexs = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const live = t => `<p class="guess"><b>现算 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const fmt = n => n.toLocaleString('en-US');
  /* per-embodiment projector sizes, following flow_matching_action_head.py (n1-release) and the GR00T-N1-2B config */
  const W = 1536, HID = 1024, SDIM = 64, ADIM = 32, NEMB = 32;
  const lin = (i, o) => i * o + o;
  const perSlot = { act: lin(ADIM, W) + lin(2 * W, W) + lin(W, W), st: lin(SDIM, HID) + lin(HID, W), dec: lin(HID, HID) + lin(HID, ADIM) };
  /* Beta(1.5, 1) on x, tau = (s - x) / s; density of tau */
  const S_ = 0.999, betaPdf = x => (x <= 0 || x >= 1) ? 0 : 1.5 * Math.sqrt(x);
  const tauPdf = t => betaPdf((S_ - t) / S_) / S_;

  const SCENES = [
    { n: 1, part: '§2 总览', title: '双系统：VLM 看懂，DiT 出动作', sub: 'System 2 = Eagle-2 VLM（取第 12 层）；System 1 = 流匹配 DiT；切换版本看哪些部件变了', dur: 14, cam: [0.0, 1.15, 40, [-1.0, 1.6, 0]],
      html: dl([['System 2', 'Eagle-2 VLM：SigLIP-2 视觉 + SmolLM2 语言；取第 12 层特征；语言冻结，视觉训练'], ['System 1', 'DiT 16 块，宽 1536；交叉注意力读 VL token，自注意力处理 1 个状态 + 16 个动作 token'], ['输出', '16 步动作块；4 步 Euler 去噪；L40 bf16 采样 63.9 ms'], ['参数', '2,190,019,826（VLM 1,335,279,856）']]) +
        '<p>从左往右：头部相机图像和语言指令进 VLM，算到第 12 层就停，输出的 token 投影到 1536 维，作为 DiT 交叉注意力的键值。机器人的本体状态经具身专用 MLP 变成 1 个 token，和 16 个带噪动作 token 一起在 DiT 里去噪，最后由具身专用解码器还原成 16 步电机动作。</p>' +
        '<p>两半在同一个模型里一次前向算完，一起训练；论文说的 10 Hz / 120 Hz 两种频率在公开代码里没有对应（精读页读者注 6）。切换版本按钮看 N1.5 到 N1.7 改了哪些部件。</p>' +
        src('§2 图 2、3 · GR00T-N1-2B config.json 和文件头 · 各版本 config.json · README') },
    { n: 2, part: '§2.2 / §3 数据', title: '数据金字塔：每一层多少小时、用什么动作标签', sub: '柱宽按表 7 的时长或帧数；色块是每层能用的动作标签', dur: 13, cam: [0.0, 1.12, 40, [0, 5.0, 0]],
      html: dl([['塔底 人类视频', '7 个数据集 2,517.0 小时，只有 LAPA 潜在动作'], ['中层 仿真', 'GR-1 仿真 1,742.6 小时（54 万条），真实动作 + LAPA'], ['中层 神经视频', '827.3 小时（约 30 万条，8 FPS），LAPA + IDM 伪动作'], ['塔顶 真机', '3,288.8 小时，其中 GR-1 遥操作 88.4 小时，真实动作 + LAPA'], ['合计', '592.9M 帧，8,375.7 小时']]) +
        '<p>论文把数据按“越往上越少、越贴近目标机器人”画成金字塔（图 1）。但按表 7 的时长，真机反而最多：AgiBot-Alpha 一家就有 1,979.4 小时。金字塔说的是“和 GR-1 的相关性”，不是严格的数量排序。</p>' +
        '<p>没有动作的视频也能进同一个流匹配损失：潜在动作和 IDM 动作各当成一种“具身”，有自己的编解码槽位。</p>' +
        live('合计和占比按表 7 逐行加总。') + src('§2.2 · §2.3 · §3 · 表 1 · 表 7') },
    { n: 3, part: '§2.2 潜在动作', title: 'LAPA：用 VQ-VAE 从两帧里学“动作”', sub: '编码器读 x_t 和 x_{t+H}，解码器用 z 和 x_t 重建 x_{t+H}；训练后取量化前的 z 当标签', dur: 15, cam: [0.0, 1.18, 38, [-1.2, 2.2, 0]],
      html: dl([['编码器', '输入当前帧 x_t 和 H 步后的帧 x_{t+H}，输出潜在动作 z_t'], ['量化', 'z_t 映射到码本里最近的条目（VQ-VAE 目标）'], ['解码器', '输入量化后的 z 和 x_t，重建 x_{t+H}'], ['用法', '训练后只留编码器，取量化前的连续 z 当动作标签，归为“LAPA 具身”'], ['范围', '人类视频、神经视频，以及真机数据（与真实动作并用）']]) +
        '<p>左边两块是同一段视频相隔 H 步的两帧，橙点是手的位置。编码器把“从 x_t 到 x_{t+H} 发生了什么”压成一个短向量 z；中间一圈小球是码本，最近的那个亮起来。解码器只看 x_t 和 z，要画出 x_{t+H}，所以 z 只能装“变化”，也就是动作。</p>' +
        '<p>因为所有具身（含人）共用一个码本，图 4 里不同机器人和人手的“右臂往左移”会落到同一个潜在动作上。</p>' +
        guess('两帧图、点的位置、z 的维度（8 格）和码本大小（12 个）都是我画的；论文没给 H、码本大小和 z 的维度。') + src('§2.2 “Latent Actions” · 图 4 · LAPA（Ye 等，2025）') },
    { n: 4, part: '§2.2 神经轨迹', title: '视频模型“做梦”：88 小时变 827 小时，再用 IDM 标动作', sub: 'WAN2.1-I2V-14B + LoRA → 多模态大模型过滤 → IDM 伪动作', dur: 15, cam: [0.0, 1.15, 40, [0, 2.6, 0]],
      html: dl([['微调', 'WAN2.1-I2V-14B，LoRA，3,000 条真机样本，480P、81 帧，100 个 epoch'], ['生成', '已有初始帧 + 新提示（大模型列出“把 {物体} 从 A 拿到 B”）→ 827 小时'], ['过滤', '每段取 8 帧给大模型判断是否按指令做；不合格的重写描述（16 帧、256P）'], ['IDM', 'DiT（System 1 结构）+ SigLIP-2 嵌入；输入两帧，输出两帧之间的动作块；每具身 3 万或 6 万步'], ['算力', '2 分钟生成 1 秒；约 10.5 万 L40 GPU 小时，3,600 张卡约 1.5 天']]) +
        '<p>左边是 88 小时遥操作数据，中间的视频模型把每个初始帧配上很多新指令，生成的视频经过裁判过滤；右边 IDM 读每对相邻帧，给出伪动作。计数器跟着进度涨到 827 小时。</p>' +
        '<p>后训练时同样做法：视频模型只在 10% 的真机数据（或仿真的人类示范）上微调，神经轨迹和真实轨迹 1 : 1 采样。图 9：RoboCasa 30 / 100 / 300 条时分别 +4.2、+8.8、+6.8，真机 8 个任务 +5.8。</p>' +
        live('GPU 小时 = 时长 × 3600 × 120 ÷ 3600；每条长度 = 81 帧 ÷ 8 FPS。') + src('§2.2 · §2.3 · §3.2 · 附录 F · 图 5、9、13 · 表 7') },
    { n: 5, part: '§2.2 仿真轨迹', title: 'DexMimicGen：把几十条示范变成 54 万条', sub: '按物体切段 → 跟着物体新位置变换 → 段间插值 → 执行并检查成功', dur: 14, cam: [0.0, 0.95, 34, [0, 1.2, 0]],
      html: dl([['源示范', 'Leap Motion 遥操作几十条，重定向后交给基于 mink 的全身 IK'], ['变换', '每段保持末端相对物体的位姿，随物体新位置平移旋转'], ['插值', '当前状态到变换后段起点之间插一段'], ['筛选', '只留成功的'], ['规模', '54 种容器组合 × 1 万条 = 54 万条（预训练）；预训练加后训练共 78 万条 ≈ 6,500 小时，11 小时生成']]) +
        '<p>桌上灰色曲线是一条源示范：手从起点去抓物体（蓝块），再放到目标（黄块）。物体换了位置后，抓取那一段（绿）跟着物体整体平移旋转，放置那一段跟着目标容器变换，橙色虚线是插值补上的过渡。最后检查是否成功，失败的丢掉。</p>' +
        guess('桌面、物体位置、曲线形状都是玩具；只为说明“按物体切段 + 相对位姿变换 + 插值”的流程。') + live('54 × 10,000 和 6,500 小时 ÷ 78 万条 = 30 秒每条当场算。') + src('§2.2 “Simulation Trajectories” · §3.2 · DexMimicGen') },
    { n: 6, part: '§2.1 System 2', title: '一帧图变 64 个 token，LLM 只算 12 层', sub: '224² → 16 × 16 个 patch → 2 × 2 pixel shuffle → 64 个；切换相机路数', dur: 14, cam: [0.0, 1.12, 38, [0, 2.8, 0]],
      html: dl([['视觉', 'SigLIP-2，patch 14：224 / 14 = 16，256 个 patch，每个 1152 维'], ['pixel shuffle', '2 × 2 合并：64 个 token，每个 4 × 1152 = 4608 维 → mlp1 → 2048'], ['语言模型', 'SmolLM2（24 层，宽 2048）；GR00T 只保留前 12 层，删掉其余层和 lm_head'], ['输出', '第 12 层特征 2048 维 → 线性层 → 1536 维，给 DiT 交叉注意力'], ['冻结', '语言模型冻结；视觉编码器和 mlp1 训练']]) +
        '<p>左边一帧图被切成 16 × 16 = 256 个小块，每 2 × 2 个合成一个，剩 64 个图像 token（蓝），和文本 token（紫）一起进 LLM。LLM 原本 24 层，后 12 层被删掉（虚影），只算前 12 层。这就是论文说“用中间层更快、效果也更好”在代码里的实现。</p>' +
        '<p>切换相机路数：多路图像的 token 依次拼接，序列变长，交叉注意力的键值随之变多。</p>' +
        live('token 数 = 64 × 路数 + 文本（这里按 16 个文本 token 示意）。') + src('§2.1 “Vision-Language Module” · eagle_backbone.py · GR00T-N1-2B config.json（select_layer 12，num_image_token 64）· 文件头') },
    { n: 7, part: '§2.1 编解码器', title: '32 个具身槽位：每个具身一套 MLP', sub: '状态补零到 64，动作补零到 32；切换具身看用哪个槽位', dur: 13, cam: [0.0, 1.1, 40, [0, 2.6, 0]],
      html: dl([['状态编码器', '2 层：64 → 1024 → 1536'], ['动作编码器', '3 层：32 → 1536；拼正弦时间编码 → 3072 → 1536；→ 1536'], ['动作解码器', '2 层：DiT 输出 1024 → 1024 → 32'], ['槽位', '32 个（max_num_embodiments）；GR1 = 24 号，新具身 = 31 号'], ['GR-1 双臂双手', '状态 26 个关节角 → sin/cos 52 维 → 补零 64；动作 26 → 补零 32']]) +
        '<p>前排 32 根柱子是 32 个槽位，每个槽位三块：状态编码器、动作编码器、解码器。一次前向只用一个槽位（按 embodiment_id 取权重），其余槽位的参数不参与计算。</p>' +
        '<p>后排是一个 GR-1 样本：26 维关节状态经 sin/cos 变成 52 维再补零到 64；26 维动作补零到 32，补的那几维在损失里由 action_mask 屏蔽。LAPA 和 IDM 伪动作也各占一个槽位（编号论文没给）。</p>' +
        live('每个槽位和 32 个槽位的参数量按层定义当场算，和文件头一致。') + guess('LAPA、IDM、其他预训练具身占哪几个槽位没有公开，图里只标出 24 和 31。') +
        src('flow_matching_action_head.py · transforms.py（_EMBODIMENT_TAG_MAPPING）· data_config.py（Gr1ArmsOnlyDataConfig）· 文件头') },
    { n: 8, part: '§2.1 System 1', title: 'DiT：交叉注意力和自注意力一层一层交替', sub: '偶数块看 VL token，奇数块只在 17 个状态 / 动作 token 之间；切换 N1 和 N1.6 以后', dur: 15, cam: [0.0, 1.05, 40, [0, 2.4, 0]],
      html: dl([['序列', '1 个状态 token + 16 个动作 token（加可学位置编码）'], ['块', 'N1：16 块，宽 1536（32 头 × 48），FFN 6144'], ['交替', 'interleave_self_attention：0、2、4… 交叉注意力；1、3、5… 自注意力'], ['时间步', 'τ × 1000 取整 → 正弦编码 → MLP；每块 adaLN（scale, shift）'], ['N1.6 / N1.7', '32 块；AlternateVLDiT：交叉块轮流只看文本或只看图像 token']]) +
        '<p>上面一排是 VL token（蓝为图像，紫为文本），下面一排是 17 个状态和动作 token。亮起的块是当前在算的块：交叉注意力块里，每个动作 token 去读上面一排；自注意力块里，17 个 token 互相读。</p>' +
        '<p>N1 的交叉注意力没有传填充掩码，同一 batch 里补齐的 VL token 也会被读到（精读页读者注 19）。</p>' +
        src('§2.1 图 3 · cross_attention_dit.py · main 的 modules/dit.py（AlternateVLDiT，attend_text_every_n_blocks 2）· 各版本 config.json') },
    { n: 9, part: '§2.1 训练', title: '流匹配训练：τ 从 Beta 抽，网络学速度', sub: '一维玩具动作块；切换“论文写法”和“代码写法”看速度方向', dur: 14, cam: [0.0, 1.25, 34, [0, 3.8, 0]],
      html: dl([['插值', 'A^τ = τ A + (1 − τ) ε；τ = 0 是噪声，τ = 1 是数据'], ['τ 的分布', 'x ~ Beta(1.5, 1)，τ = (0.999 − x) / 0.999；偏向噪声端，E[τ] = 0.399'], ['论文式 (1)', '目标 ε − A'], ['代码', 'velocity = actions − noise'], ['损失', 'MSE × action_mask，补零的维不计']]) +
        '<p>左边：灰线是噪声 ε，绿线是真实的 16 步动作（一维玩具），橙线是当前 τ 下的 A^τ，随进度从噪声滑到数据。箭头是网络要学的速度：代码写法指向数据，论文写法指向噪声，用论文写法配“+ V/K”的 Euler 更新会越走越远（精读页读者注 4）。</p>' +
        '<p>右边：τ 的密度 p(τ)，按 Beta(1.5, 1) 变换当场算，噪声端（τ 小）更密。</p>' +
        guess('动作曲线和噪声是固定种子的玩具，不是真实数据。') + live('τ 的密度和均值当场算。') + src('§2.1 式 (1) · flow_matching_action_head.py（sample_time、forward）') },
    { n: 10, part: '§2.1 推理', title: 'K 步 Euler：从噪声走到动作块', sub: '切换 K = 4（脚本默认）和 K = 16（权重 config）', dur: 13, cam: [0.55, 1.18, 34, [-2, 3.4, 0]],
      html: dl([['起点', 'A^0 ~ N(0, I)，形状 16 × 32'], ['更新', 'A ← A + (1/K)·V，τ = 0, 1/K, …'], ['K = 4', 'τ = 0、0.25、0.5、0.75（桶 0、250、500、750）'], ['config', 'num_inference_timesteps 16；inference_service.py 默认 --denoising_steps 4'], ['耗时', 'L40、bf16、16 步动作块：63.9 ms（整个模型）']]) +
        '<p>每一步：同一组 VL token 和状态 token 不变，只有动作 token 更新，DiT 跑一遍给出速度，沿速度走 1/K。小方块是每一步的中间结果；最后的绿线交给动作解码器还原成真实单位，再反归一化。</p>' +
        '<p>VLM 只在每次调用开头算一次，K 步去噪复用同一组 VL 特征，所以 K 只影响 DiT 的耗时。</p>' +
        guess('速度场取理想的直线流（模型完全学会），所以 K = 4 和 K = 16 终点相同；真实模型的误差论文没给。') + src('§2.1 · 读者注 5 · inference_service.py · get_action') },
    { n: 11, part: '§4 结果 / 版本', title: '结果，以及 N1 之后的版本', sub: '切换：表 2 仿真、表 3 真机、图 9 神经轨迹、RoboCasa-GR1 各版本', dur: 12, cam: [0.0, 1.3, 36, [0, 4.0, 0]],
      html: dl([['表 2（100 条）', 'GR00T 平均 45.0，DP 33.4，BC 26.4（DexMG 列和表 4 不一致）'], ['表 3（真机）', '全数据 76.8 对 DP 46.4；10% 数据 42.6 对 10.2'], ['图 9', 'RoboCasa 加神经轨迹 +4.2 / +8.8 / +6.8；真机 +5.8'], ['RoboCasa-GR1', 'N1 50.0（100 条）、N1.5 48.2、N1.6 47.6、N1.7 44.5、OpenWAM-α 60.5（协议各不相同）']]) +
        '<p>前三张是论文的数。最后一张把 RoboCasa-GR1（就是本文的 GR-1 桌面 24 任务）上能找到的各版本分数放在一起：N1 来自本文表 4，N1.5 / N1.6 / N1.7 来自 Isaac-GR00T 各版本 README，OpenWAM-α 来自 OpenWAM 表 20。训练数据量、动作空间和试验次数都不同，只能看量级。</p>' +
        src('表 2、3、4 · 图 9 · Isaac-GR00T README（n1.5、n1.6、main）· OpenWAM 表 20') }
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
  function dropLab(G, l) { if (!l) return; G.remove(l); LABS = LABS.filter(s => s !== l); L.dispose(l); }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9), DISC = new THREE.CircleGeometry(1, 32);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65, depthWrite: o.depthWrite }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; for (let i = 0; i < n; i++) im.setColorAt(i, _C.setRGB(1, 1, 1)); return im; }
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
  function bar(G, x, z, w, color, o = {}) { const m = block(w, 1, o.d ?? w, color, [x, 0.5, z], { edges: false, opacity: o.opacity }); G.add(m); m.userData.set = h => { const v = Math.max(0.001, h); m.scale.y = v; m.position.y = (o.y0 ?? 0) + v / 2; }; return m; }
  function arrowTo(G, from, to, color) { const a = L.arrow(from, to, color, { head: 0.45, headW: 0.3 }); G.add(a); return a; }
  function setArrow(a, from, to) { const f = L.V(from), t = L.V(to), d = t.clone().sub(f), len = Math.max(0.02, d.length()); a.position.copy(f); a.setDirection(d.normalize()); a.setLength(len, Math.min(0.45, len * 0.4), Math.min(0.3, len * 0.25)); }
  /* remove labels belonging to a sub-group before rebuilding it */
  function clearSub(sub) { LABS = LABS.filter(s => { let o = s; while (o) { if (o === sub) return false; o = o.parent; } return true; }); L.clear(sub); }
  /* grouped bar chart; values drawn from lo to hi over height H */
  function chart(sub, v, o = {}) {
    const Ng = v.g.length, Ns = v.s.length, span = o.span ?? 28, gw = Math.min(4.6, span / Ng), w = Math.min(1.4, (gw - 0.6) / Ns), H = o.H ?? 7, x0c = o.x ?? 0;
    const bars = [];
    v.g.forEach((nm, i) => { const x0 = x0c + (i - (Ng - 1) / 2) * gw; sub.add(lab(nm, [x0, -0.25, 2.4], { size: o.ls ?? 16 }));
      v.s.forEach(([sn, c, vals], j) => { const val = vals[i]; if (val == null) { sub.add(lab('N/A', [x0 + (j - (Ns - 1) / 2) * (w + 0.08), 0.6, 0], { size: 14 })); return; }
        const x = x0 + (j - (Ns - 1) / 2) * (w + 0.08), b = block(w, 1, w, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(Number.isInteger(val) ? val.toFixed(1) : String(val), [x, 0, 0], { size: 15 }); sub.add(l); bars.push({ b, l, v: val, best: o.best && o.best(i, j) }); }); });
    if (Ns > 1) v.s.forEach(([sn, c], j) => sub.add(lab(sn, [x0c - span / 2 + 2.5 + j * 5.2, H + 2.0, 0], { size: 17, color: hexs(c) })));
    sub.add(lab(v.t, [x0c, H + 3.2, 0], { size: 20, border: 'rgba(56,209,255,.7)' }));
    return g => bars.forEach(({ b, l, v: val, best }) => { const h = Math.max(0.02, (val - (v.lo ?? 0)) / ((v.hi ?? 1) - (v.lo ?? 0)) * H * g); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.45; if (best) glow(b, 0.6); });
  }

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
  const opt = (k, d, n) => clamp(+(OPT[k] ?? d) || 0, 0, n - 1);

  /* replace a label held in ref.l */
  function swap(G, ref, text, pos, o) { if (ref.l) dropLab(G, ref.l); ref.l = lab(text, pos, o); G.add(ref.l); return ref.l; }
  /* ---------- shared toy data ---------- */
  const R0 = L.rng(7);
  const TRUE_A = Array.from({ length: 16 }, (_, i) => 1.6 * Math.sin(i / 15 * Math.PI * 1.2) + 0.5 * Math.cos(i / 15 * Math.PI * 3));
  const NOISE = Array.from({ length: 16 }, () => L.gauss(R0) * 1.1);
  const VER = [
    { k: 'N1', vlm: 'Eagle-2（SmolLM2 + SigLIP-2）', sel: '第 12 层（共 24）', frz: '语言冻结 · 视觉训练', ada: '线性 2048 → 1536', dit: 16, H: 16, adim: 32, n: '2.19B' },
    { k: 'N1.5', vlm: 'Eagle 2.5（Qwen3-1.7B + SigLIP-2）', sel: '第 12 层', frz: '整个 VLM 冻结', ada: 'LayerNorm + 4 层自注意力适配器', dit: 16, H: 16, adim: 32, n: '2.72B' },
    { k: 'N1.6', vlm: 'Eagle-Block2A-2B-v2（文档称 Cosmos-Reason-2B 变体）', sel: '第 16 层', frz: '预训练解冻最上 4 层', ada: '去掉适配器', dit: 32, H: 50, adim: 128, n: '3.29B' },
    { k: 'N1.7', vlm: 'Cosmos-Reason2-2B（Qwen3-VL）', sel: '第 16 层（检查点）', frz: '默认冻结', ada: '4 层自注意力适配器', dit: 32, H: 40, adim: 132, n: '3.14B' }
  ];

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    let v = opt(0, 0, 4);
    G.add(L.grid(44, 22));
    const y = 2.4;
    const img = block(0.3, 2.6, 2.6, COL.img, [-17, y + 1.4, 0]); G.add(img);
    G.add(lab('头部相机图像', [-17, y + 3.3, 0], { size: 16 }));
    const txt = []; for (let i = 0; i < 5; i++) { const b = block(0.5, 0.5, 0.5, COL.txt, [-18.2 + i * 0.6, y - 1.2, 0]); G.add(b); txt.push(b); }
    G.add(lab('“把苹果放到底层架子”', [-16.8, y - 2.4, 0], { size: 15 }));
    const vlmL = []; for (let i = 0; i < 24; i++) { const b = block(0.22, 4.2, 3.2, i < 12 ? COL.vlm : COL.dim, [-12.6 + i * 0.3, y, 0], { opacity: i < 12 ? 1 : 0.18 }); G.add(b); vlmL.push(b); }
    const LA = {}, LB = {}, LC = {}, LD = {};
    G.add(lab('System 2', [-9.2, y - 3.1, 0], { size: 18, color: hexs(COL.vlm) }));
    const vl = inst(BOX, 12); G.add(vl);
    const proj = block(0.6, 2.4, 2.4, COL.train, [-2.6, y, 0]); G.add(proj);
    let ditB = [];
    G.add(lab('System 1', [5.2, y - 3.1, 0], { size: 18, color: hexs(COL.dit) }));
    const sub = new THREE.Group(); G.add(sub);
    const st = block(0.5, 0.5, 0.5, COL.state, [5.2, -0.6, 2.2]); G.add(st);
    G.add(lab('状态 q_t', [3.4, -0.6, 2.6], { size: 14 }));
    const acts = inst(BOX, 50); G.add(acts);
    const robot = L.arm(0x9aa6bf); robot.position.set(15.5, 0, 0); robot.scale.set(0.8, 0.8, 0.8); G.add(robot);
    const sVL = stream(G, 10, COL.vlm, 0.12), sIn = stream(G, 8, COL.img, 0.12), sOut = stream(G, 8, COL.act, 0.12);
    const ctls = [{ label: '版本', items: VER.map(x => x.k), get: () => v, set: k => { v = k; } }];
    let key = '';
    return { ctls, update(p) {
      const V = VER[v];
      if (key !== v + '') { key = v + '';
        clearSub(sub); ditB = [];
        const n = V.dit; for (let i = 0; i < n; i++) { const b = block(0.11 * 16 / n * 1.6, 4.6, 3.4, i % 2 ? COL.dit : 0xffb070, [1.6 + i * 7.2 / n, y, 0]); sub.add(b); ditB.push(b); }
        swap(G, LA, `${V.vlm}\n取${V.sel}\n${V.frz}`, [-9.2, y + 4.0, 0], { size: 15, border: hexs(COL.vlm) });
        swap(G, LB, `DiT ${V.dit} 块 · 交叉 / 自注意力交替`, [5.2, y + 3.5, 0], { size: 16, border: hexs(COL.dit) });
        swap(G, LC, V.ada, [-2.6, y - 2.3, 0], { size: 14 });
        swap(G, LD, `动作块 ${V.H} 步 × ${V.adim} 维\n总参数 ${V.n}`, [13.4, y + 5.4, 0], { size: 15 });
        const keep = V.k === 'N1' || V.k === 'N1.5' ? 12 : 16, tot = V.k === 'N1' ? 24 : 28, kb = Math.round(24 * keep / tot);
        vlmL.forEach((m, i) => { m.material.transparent = true; m.material.opacity = i < kb ? 1 : 0.18; });
      }
      const g = seg(p, 0.02, 0.25);
      for (let i = 0; i < 12; i++) { setI(vl, i, [-4.6, y - 1.8 + i * 0.32, 0], 0.22 * g); colI(vl, i, hex3(i < 8 ? COL.img : COL.txt)); } done(vl);
      sIn([[-16.6, y + 1.4, 0], [-12.8, y, 0]], p * 3 % 1, 1);
      sVL([[-5, y, 0], [-2.6, y, 0], [1.4, y + 1.2, 0]], p * 3 % 1, seg(p, 0.1, 0.25));
      const k = seg(p, 0.35, 0.9), H = Math.min(V.H, 50);
      for (let i = 0; i < 50; i++) { const on = i < H; const xx = 9.0 + (i % 25) * 0.24, yy = y - 1.4 + Math.floor(i / 25) * 0.4; const nz = Math.sin(i * 12.9898) * (1 - k) * 0.9; setI(acts, i, [xx, yy + nz + TRUE_A[i % 16] * 0.25 * k, 0], on ? 0.18 : 0.0001); colI(acts, i, hex3(k > 0.98 ? COL.ok : COL.noise)); } done(acts);
      sOut([[8.6, y - 1.2, 0], [12.4, y - 1.2, 0], [14.6, 1.2, 0]], p * 2 % 1, seg(p, 0.85, 1));
      ditB.forEach((b, i) => glow(b, Math.abs(((p * 4) % 1) * ditB.length - i) < 1.2 ? 0.8 : 0));
      robot.userData.reach([15.5 + 3 + Math.sin(p * Math.PI * 2) * 0.8, 1.0, 1.2 * Math.cos(p * Math.PI * 2)]);
      cap(p < 0.35 ? `<b>System 2</b>：图像和指令进 VLM，算到${V.sel}就停 · ${V.frz}` :
        p < 0.85 ? `<b>System 1</b>：${V.dit} 块 DiT 交叉注意力读 VL token，对 1 个状态 + ${V.H} 个动作 token 去噪（4 步）` :
        `具身解码器输出 ${V.H} 步动作（每步最多 ${V.adim} 维）· ${V.k} 总参数 ${V.n}`);
    } };
  }

  /* ---------- scene 2: data pyramid ---------- */
  function s2(G) {
    let m = opt(0, 0, 2);
    const LAY = [
      { nm: '人类视频', h: 2517.0, f: 181.3, c: COL.human, tags: ['LAPA'] },
      { nm: '仿真（DexMimicGen）', h: 1742.6, f: 125.5, c: COL.sim, tags: ['真实动作', 'LAPA'] },
      { nm: '神经生成视频', h: 827.3, f: 23.8, c: COL.neural, tags: ['LAPA', 'IDM'] },
      { nm: '真机（含 AgiBot、OXE）', h: 3288.8, f: 262.3, c: COL.real, tags: ['真实动作', 'LAPA'] }
    ];
    const tot = { h: LAY.reduce((a, b) => a + b.h, 0), f: LAY.reduce((a, b) => a + b.f, 0) };
    const slabs = LAY.map((l, i) => { const b = block(1, 1.4, 4, l.c, [0, 0.7 + i * 2.6, 0]); G.add(b); return b; });
    const labs = LAY.map(() => ({}));
    const TAGC = { 'LAPA': COL.txt, 'IDM': COL.gold, '真实动作': COL.ok };
    LAY.forEach((l, i) => l.tags.forEach((t, j) => G.add(lab(t, [-15.5 + j * 3.6, 0.7 + i * 2.6, 2.2], { size: 14, border: hexs(TAGC[t]) }))));
    G.add(lab('能用的动作标签', [-13.7, 10.8, 2.2], { size: 15 }));
    const gr1 = block(0.3, 1.5, 4.2, COL.gold, [0, 0.7 + 3 * 2.6, 0.1]); G.add(gr1);
    G.add(lab('GR-1 遥操作 88.4 h', [0, 9.6, 2.6], { size: 15, border: hexs(COL.gold) }));
    const LT = {};
    const ctls = [{ label: '柱宽', items: ['按小时', '按帧数'], get: () => m, set: k => { m = k; } }];
    let lk = '';
    return { ctls, update(p) {
      const key = m === 0 ? 'h' : 'f', K = m === 0 ? 22 / 3300 : 22 / 263, g = seg(p, 0.05, 0.6);
      LAY.forEach((l, i) => { const w = Math.max(0.05, l[key] * K * g); slabs[i].scale.x = w; });
      gr1.scale.x = Math.max(0.05, (m === 0 ? 88.4 : 6.4) * K * g); gr1.position.x = 0;
      if (lk !== m + '') { lk = m + '';
        LAY.forEach((l, i) => swap(G, labs[i], `${l.nm}\n${m === 0 ? fmt(l.h) + ' h' : l.f + 'M 帧'} · ${(100 * l[key] / tot[key]).toFixed(0)}%`, [0, 0, 0], { size: 15, border: hexs(l.c) }));
        swap(G, LT, m === 0 ? `合计 ${fmt(Math.round(tot.h * 10) / 10)} 小时（表 7：8,375.7）` : `合计 ${tot.f.toFixed(1)}M 帧（表 7：592.9M）`, [0, 12.2, 0], { size: 18, border: 'rgba(56,209,255,.7)' }); }
      LAY.forEach((l, i) => { labs[i].l.position.set(Math.max(0.05, l[key] * K * g) / 2 + 4.6, 0.7 + i * 2.6, 0); });
      cap(p < 0.65 ? `按${m === 0 ? '时长' : '帧数'}：真机 <b>${(100 * LAY[3][key] / tot[key]).toFixed(0)}%</b>、人类 ${(100 * LAY[0][key] / tot[key]).toFixed(0)}%、仿真 ${(100 * LAY[1][key] / tot[key]).toFixed(0)}%、神经 ${(100 * LAY[2][key] / tot[key]).toFixed(0)}%` :
        `金色窄条是 GR-1 自己的遥操作：88.4 小时，只占总时长的 <b>${(100 * 88.4 / tot.h).toFixed(1)}%</b>；神经视频把它扩到 827 小时`);
    } };
  }

  /* ---------- scene 3: latent actions ---------- */
  function s3(G) {
    const y = 2.4;
    const fA = block(3.2, 3.2, 0.2, 0x2b3650, [-15, y + 2.0, 0]), fB = block(3.2, 3.2, 0.2, 0x2b3650, [-15, y - 2.0, 0]); G.add(fA, fB);
    const dA = L.sphere(0.25, COL.act), dB = L.sphere(0.25, COL.act); G.add(dA, dB);
    G.add(lab('x_t', [-15, y + 4.2, 0], { size: 17 }), lab('x_{t+H}', [-15, y - 4.2, 0], { size: 17 }));
    const enc = block(2.2, 4.2, 2.6, COL.train, [-9.5, y, 0]); G.add(enc); G.add(lab('编码器', [-9.5, y + 2.9, 0], { size: 16 }));
    const z = inst(BOX, 8); G.add(z); G.add(lab('z_t（量化前）', [-4.6, y + 2.6, 0], { size: 15 }));
    const cb = inst(BALL, 12); G.add(cb); G.add(lab('码本', [0.6, y + 3.6, 0], { size: 16 }));
    const dec = block(2.2, 4.2, 2.6, COL.vlm, [6.2, y, 0]); G.add(dec); G.add(lab('解码器', [6.2, y + 2.9, 0], { size: 16 }));
    const fC = block(3.2, 3.2, 0.2, 0x2b3650, [12.0, y, 0]); G.add(fC); const dC = L.sphere(0.25, COL.act); G.add(dC);
    G.add(lab('重建 x̂_{t+H}', [12.0, y + 2.3, 0], { size: 15 }));
    const lbl = lab('训练后：只留编码器，z 当动作标签 → “LAPA 具身”', [-6.4, y - 4.6, 0], { size: 16, border: hexs(COL.txt) }); G.add(lbl);
    const s1_ = stream(G, 6, COL.img, 0.1), s2_ = stream(G, 6, COL.txt, 0.1), s3_ = stream(G, 6, COL.img, 0.1);
    const zr = L.rng(3), ZV = Array.from({ length: 8 }, () => 0.3 + zr() * 1.6), CB = Array.from({ length: 12 }, (_, i) => [0.6 + 2.2 * Math.cos(i / 12 * 6.283), y + 2.2 * Math.sin(i / 12 * 6.283)]);
    const near = 4;
    return { update(p) {
      const mv = seg(p, 0, 0.15);
      dA.position.set(-15.9, y + 1.6, 0.3); dB.position.set(-15.9 + 1.8 * mv, y - 2.4, 0.3);
      s1_([[-14.8, y + 2, 0], [-10.6, y, 0]], p * 3 % 1, 1); s2_([[-14.8, y - 2, 0], [-10.6, y, 0]], p * 3 % 1, 1);
      const gz = seg(p, 0.15, 0.35);
      for (let i = 0; i < 8; i++) { const h = ZV[i] * gz + 0.02; setI(z, i, [-5.8 + i * 0.36, y - 1 + h / 2, 0], [0.28, h, 0.28]); colI(z, i, hex3(COL.txt)); } done(z);
      const q = seg(p, 0.35, 0.55);
      CB.forEach((c, i) => { setI(cb, i, [c[0], c[1], 0], i === near ? 0.32 + 0.18 * q : 0.25); colI(cb, i, hex3(i === near && q > 0.2 ? COL.gold : COL.dim)); }); done(cb);
      s3_([[2.8, y, 0], [5, y, 0], [7.4, y, 0], [11.8, y, 0]], p * 3 % 1, seg(p, 0.55, 0.65));
      const r = seg(p, 0.6, 0.85); dC.position.set(11.1 + 1.8 * r, y - 0.4, 0.3);
      lbl.visible = p > 0.82; dec.material.opacity = p > 0.82 ? 0.3 : 1; dec.material.transparent = true;
      cap(p < 0.35 ? '编码器读一对帧 (x_t, x_{t+H})，输出潜在动作 z_t：只编码两帧之间的<b>变化</b>' :
        p < 0.6 ? 'z_t 映射到<b>最近的码本条目</b>（金球）；所有具身共享这一个码本' :
        p < 0.85 ? '解码器只看 x_t 和 z，要画出 x_{t+H}：z 被迫装下“手往哪动”' :
        '训练完：编码器当逆动力学模型，取<b>量化前</b>的连续 z 当标签，和真实动作一样用流匹配损失，当成单独的 LAPA 具身');
    } };
  }

  /* ---------- scene 4: neural trajectories + IDM ---------- */
  function s4(G) {
    const y = 2.2;
    const tele = block(2.4, 2.4, 2.4, COL.real, [-15, y, 0]); G.add(tele);
    const lTele = lab('遥操作 88 h', [-15, y + 2.2, 0], { size: 16 }); G.add(lTele);
    const wan = block(3.2, 4.2, 3.2, COL.neural, [-8.4, y, 0]); G.add(wan);
    G.add(lab('WAN2.1-I2V-14B\n+ LoRA', [-8.4, y + 3.4, 0], { size: 15, border: hexs(COL.neural) }));
    G.add(lab('新提示：把 {物体} 从 A 拿到 B', [-8.4, y - 3.2, 0], { size: 14 }));
    const vids = inst(BOX, 40); G.add(vids);
    const judge = block(1.6, 2.2, 1.6, COL.gold, [2.0, y, 0]); G.add(judge);
    G.add(lab('多模态大模型\n读 8 帧判断', [2.0, y + 2.4, 0], { size: 14, border: hexs(COL.gold) }));
    const idm = block(2.6, 3.4, 2.6, COL.dit, [8.2, y, 0]); G.add(idm);
    G.add(lab('IDM：DiT + SigLIP-2\n两帧 → 动作块', [8.2, y + 3.0, 0], { size: 14, border: hexs(COL.dit) }));
    const out = inst(BOX, 16); G.add(out);
    G.add(lab('伪动作 → 当作单独具身', [14.0, y - 1.8, 0], { size: 14 }));
    const CN = {};
    const sA = stream(G, 6, COL.real, 0.1), sB = stream(G, 10, COL.neural, 0.1), sC = stream(G, 6, COL.act, 0.1);
    let lastH = -1;
    return { update(p) {
      sA([[-13.8, y, 0], [-10.0, y, 0]], p * 3 % 1, seg(p, 0, 0.1));
      const g = seg(p, 0.1, 0.55);
      const r = L.rng(11);
      for (let i = 0; i < 40; i++) { const on = i / 40 < g; const bad = r() < 0.15; const x = -5.2 + (i % 10) * 0.55, yy = y - 1.6 + Math.floor(i / 10) * 0.8; const filt = seg(p, 0.55, 0.7); setI(vids, i, [x, yy, 0], on ? (bad && filt > 0.5 ? 0.0001 : 0.4) : 0.0001); colI(vids, i, hex3(bad && filt > 0.2 ? COL.bad : COL.neural)); } done(vids);
      sB([[0, y, 0], [2, y, 0], [6.8, y, 0]], p * 3 % 1, seg(p, 0.6, 0.7));
      const a = seg(p, 0.72, 0.95);
      for (let i = 0; i < 16; i++) { setI(out, i, [11.6 + i * 0.3, y - 0.5 + TRUE_A[i] * 0.4 * a, 0], a > 0 ? 0.2 : 0.0001); colI(out, i, hex3(COL.act)); } done(out);
      sC([[9.6, y, 0], [11.4, y, 0]], p * 3 % 1, a);
      const hrs = Math.round(88 + (827.3 - 88) * g);
      if (hrs !== lastH) { lastH = hrs; swap(G, CN, `生成 ${hrs} h · L40 GPU 小时 ≈ ${fmt(Math.round(hrs * 120))}`, [-2.6, y + 5.6, 0], { size: 17, border: 'rgba(56,209,255,.7)' }); }
      cap(p < 0.55 ? '在 88 小时遥操作上 LoRA 微调视频模型，给已有初始帧配新指令生成视频：<b>827.3 h</b>（×9.4），每段 81 帧 ÷ 8 FPS ≈ 10 秒' :
        p < 0.72 ? '大模型裁判读每段的 8 帧，<span style="color:#e05d5d">没按指令做的</span>去掉（或重写描述）' :
        'IDM 读相邻两帧给出动作块，当伪标签；真机后训练只用 IDM，RoboCasa 也试了 LAPA（图 9）');
    } };
  }

  /* ---------- scene 5: DexMimicGen ---------- */
  function s5(G) {
    const table = L.box(26, 0.3, 12, 0x2b3650, { edgeOpacity: 0.2 }); table.position.set(0, -0.15, 0); G.add(table);
    const obj0 = [-3, 0.4, -2], tgt = [7, 0.4, 2.5], obj1 = [-1, 0.4, 3.2], start = [-11, 2.5, 0];
    const o0 = block(0.8, 0.8, 0.8, COL.img, obj0, { opacity: 0.35 }), o1 = block(0.8, 0.8, 0.8, COL.img, obj0); G.add(o0, o1);
    const tg = block(2.0, 0.4, 2.0, COL.gold, tgt); G.add(tg);
    G.add(lab('目标容器', [tgt[0], 1.6, tgt[2]], { size: 14 }));
    const P = (a, b, h) => Array.from({ length: 12 }, (_, i) => { const t = i / 11; return [L.lerp(a[0], b[0], t), L.lerp(a[1], b[1], t) + h * Math.sin(t * Math.PI), L.lerp(a[2], b[2], t)]; });
    const grasp0 = P([obj0[0] - 2.5, 2.2, obj0[2] - 1.5], [obj0[0], 1.0, obj0[2]], 0.4), place0 = P([obj0[0], 1.0, obj0[2]], [tgt[0], 1.4, tgt[2]], 2.0);
    const src0 = [start].concat(grasp0, place0);
    G.add(L.tube(src0, 0x8e9bb8, 0.07, { opacity: 0.55 }));
    G.add(lab('源示范（几十条之一）', [-11, 4.0, 0], { size: 15 }));
    const dx = obj1[0] - obj0[0], dz = obj1[2] - obj0[2];
    const grasp1 = grasp0.map(q => [q[0] + dx, q[1], q[2] + dz]);
    const place1 = P(grasp1[grasp1.length - 1], [tgt[0], 1.4, tgt[2]], 2.0);
    const interp = P(start, grasp1[0], 0.6);
    const tG = L.tube(grasp1, COL.ok, 0.1), tP = L.tube(place1, COL.ok, 0.1), tI = L.tube(interp, COL.act, 0.08); G.add(tG, tP, tI);
    const hand = L.sphere(0.35, COL.white); G.add(hand);
    const ok = lab('✓ 成功，保留', [tgt[0], 3.2, tgt[2]], { size: 16, border: hexs(COL.ok) }); G.add(ok);
    G.add(lab('54 种组合 × 10,000 = 540,000 条（预训练）', [0, 7.2, 0], { size: 16, border: 'rgba(56,209,255,.7)' }));
    G.add(lab(`78 万条 ≈ 6,500 h → 平均 ${(6500 * 3600 / 780000).toFixed(0)} 秒 / 条，11 小时生成`, [0, 6.0, 0], { size: 14 }));
    return { update(p) {
      const m = seg(p, 0.05, 0.25);
      o1.position.set(L.lerp(obj0[0], obj1[0], m), 0.4, L.lerp(obj0[2], obj1[2], m));
      const sg = seg(p, 0.25, 0.45); tG.visible = sg > 0; tG.scale.setScalar(1); tG.material.opacity = sg; tG.material.transparent = true;
      tI.visible = p > 0.45; tP.visible = p > 0.5;
      const run = seg(p, 0.55, 0.92), path = interp.concat(grasp1, place1);
      const hp = along(path, run); hand.position.set(...hp);
      if (run > 0.53) o1.position.set(hp[0], hp[1] - 0.6, hp[2]);
      ok.visible = p > 0.93;
      cap(p < 0.25 ? '物体（蓝）换了位置：源示范的抓取段不能直接重放' :
        p < 0.45 ? '抓取段（绿）<b>保持末端相对物体的位姿</b>，跟着物体整体变换' :
        p < 0.55 ? '起点到变换后段起点之间用<b>插值</b>补一段（橙）' : p < 0.93 ? '逐步执行完整轨迹……' : '检查成功才保留；失败的丢掉');
    } };
  }

  /* ---------- scene 6: System 2 tokens ---------- */
  function s6(G) {
    let nv = opt(0, 0, 3);
    const y = 2.6;
    const patches = inst(BOX, 256 * 3); G.add(patches);
    const toks = inst(BOX, 64 * 3 + 16); G.add(toks);
    const llm = []; for (let i = 0; i < 24; i++) { const b = block(0.26, 5.2, 3.4, i < 12 ? COL.frozen : COL.dim, [3.0 + i * 0.36, y, 0], { opacity: i < 12 ? 1 : 0.15 }); G.add(b); llm.push(b); }
    G.add(lab('SmolLM2：24 层，只算前 12 层（冻结）', [7.2, y + 3.6, 0], { size: 15, border: '#8e9bb8' }));
    G.add(lab('删掉的 12 层', [9.4, y - 3.4, 0], { size: 14 }));
    const outB = block(0.5, 2.6, 2.6, COL.train, [14.6, y, 0]); G.add(outB);
    G.add(lab('2048 → 1536\n给 DiT', [14.6, y + 2.3, 0], { size: 14 }));
    G.add(lab('SigLIP-2（训练）\n224² · patch 14', [-15.2, y + 4.4, 0], { size: 15, border: hexs(COL.train) }));
    G.add(lab('pixel shuffle 2 × 2 → mlp1', [-5.8, y + 4.4, 0], { size: 15 }));
    const CN = {};
    const ctls = [{ label: '相机路数', items: ['1 路', '2 路', '3 路'], get: () => nv, set: k => { nv = k; } }];
    let lk = '';
    return { ctls, update(p) {
      const V = nv + 1, mg = seg(p, 0.25, 0.5), fl = seg(p, 0.5, 0.75);
      for (let v = 0; v < 3; v++) for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
        const k = v * 256 + i * 16 + j, on = v < V;
        const x0 = -17 + j * 0.24 + (j >> 1) * 0.0, yy = y + 1.8 - i * 0.24 - v * 4.2 * 0.0 - v * 0.0;
        const off = v * 1.2;
        setI(patches, k, [x0 + off, yy - off * 0.0 - v * 0, -v * 1.6], on ? [0.2 * (1 - mg * 0.6), 0.2 * (1 - mg * 0.6), 0.2] : 0.0001); colI(patches, k, hex3(COL.img));
      } done(patches);
      const nT = 64 * V + 16;
      for (let i = 0; i < 64 * 3 + 16; i++) {
        const isTxt = i >= 64 * 3, idx = isTxt ? 64 * V + (i - 64 * 3) : i, on = isTxt || i < 64 * V;
        const grid = [-7.6 + (i % 8) * 0.42, y + 1.6 - Math.floor((i % 64) / 8) * 0.42, -Math.floor(i / 64) * 1.6];
        const seq = [-1.6 + 0.0, y - 2.4 + (idx / Math.max(1, nT)) * 5.0, 0];
        const ps = isTxt ? [L.lerp(-7.6 + (i - 192) * 0.42, seq[0], fl), L.lerp(y - 2.6, seq[1], fl), 0] : [L.lerp(grid[0], seq[0], fl), L.lerp(grid[1], seq[1], fl), L.lerp(grid[2], 0, fl)];
        setI(toks, i, ps, on ? (isTxt ? 0.24 : 0.3 * mg + 0.0001) : 0.0001); colI(toks, i, hex3(isTxt ? COL.txt : COL.img));
      } done(toks);
      const cur = Math.floor(seg(p, 0.75, 0.95) * 12);
      llm.forEach((b, i) => glow(b, i === cur && p > 0.75 ? 0.8 : 0));
      if (lk !== nv + '') { lk = nv + ''; swap(G, CN, `${V} 路 × 64 + 文本 ≈ ${nT} 个 token 进 LLM（文本 16 个为示意）`, [-1.5, y - 4.6, 0], { size: 16, border: 'rgba(56,209,255,.7)' }); }
      cap(p < 0.25 ? `每路图像 224 × 224，patch 14 → <b>16 × 16 = 256</b> 个 patch（每个 1152 维）` :
        p < 0.5 ? '相邻 2 × 2 个 patch 拼成一个：<b>64</b> 个 token，每个 4 × 1152 = 4608 维，经 mlp1 变 2048 维' :
        p < 0.75 ? `图像 token 和文本 token 按对话格式排成一串：共约 <b>${nT}</b> 个` :
        `LLM 只跑前 <b>12</b> 层（第 ${Math.max(1, cur + 1)} 层），输出 2048 维 → 线性层 → 1536 维`);
    } };
  }

  /* ---------- scene 7: embodiment slots ---------- */
  function s7(G) {
    let e = opt(0, 0, 3);
    const EM = [['GR1', 24, 'GR-1 双臂双手：状态 26 → sin/cos 52 → 补零 64；动作 26 → 补零 32'], ['新具身', 31, '微调新机器人用最后一个槽位（31 号），从预训练权重里的这个槽位继续训'], ['LAPA / IDM', -1, '潜在动作和 IDM 伪动作也各占一个槽位，编号未公开']];
    const slots = [];
    for (let i = 0; i < NEMB; i++) { const x = -15.5 + i * 1.0; const g = [block(0.7, 0.9, 0.7, COL.emb, [x, 0.45, 0]), block(0.7, 2.2, 0.7, COL.train, [x, 2.0, 0]), block(0.7, 0.6, 0.7, COL.dit, [x, 3.5, 0])]; g.forEach(b => G.add(b)); slots.push(g); }
    G.add(lab('状态编码器', [-18.6, 0.45, 0], { size: 13 }), lab('动作编码器', [-18.6, 2.0, 0], { size: 13 }), lab('解码器', [-18.2, 3.5, 0], { size: 13 }));
    G.add(lab('0', [-15.5, -0.6, 0.6], { size: 13 }), lab('24', [-15.5 + 24, -0.6, 0.6], { size: 13 }), lab('31', [15.5, -0.6, 0.6], { size: 13 }));
    const per = perSlot.act + perSlot.st + perSlot.dec;
    G.add(lab(`每个槽位 ${fmt(per)}（动作编码 ${fmt(perSlot.act)} + 状态编码 ${fmt(perSlot.st)} + 解码 ${fmt(perSlot.dec)}）`, [0, 6.6, 0], { size: 15, border: 'rgba(56,209,255,.7)' }));
    G.add(lab(`32 个槽位共 ${fmt(per * NEMB)}，占 2,190,019,826 的 ${(100 * per * NEMB / 2190019826).toFixed(1)}%`, [0, 5.5, 0], { size: 14 }));
    const cells = inst(BOX, 64 + 32); G.add(cells);
    G.add(lab('状态 64 维', [-16.5, -2.6, 3.4], { size: 13 }), lab('动作 32 维 × 16 步', [-16.8, -3.6, 3.4], { size: 13 }));
    const IN = {};
    const ctls = [{ label: '具身', items: EM.map(x => x[0]), get: () => e, set: k => { e = k; } }];
    let lk = '';
    return { ctls, update(p) {
      const [nm, id, txt] = EM[e], g = seg(p, 0.1, 0.4);
      slots.forEach((s, i) => s.forEach(b => { b.material.opacity = id < 0 ? 0.6 : (i === id ? 1 : 0.25 + 0.75 * (1 - g)); b.material.transparent = true; glow(b, i === id && g > 0.5 ? 0.6 : 0); }));
      const f = seg(p, 0.45, 0.85);
      for (let i = 0; i < 64; i++) { const real = id === 24 ? i < 52 * f : i < 30 * f; setI(cells, i, [-13.4 + i * 0.36, -2.6, 3.4], 0.28); colI(cells, i, hex3(real ? (id === 24 ? (i % 2 ? COL.state : 0xf08a7a) : COL.state) : COL.dim)); }
      for (let i = 0; i < 32; i++) { const real = id === 24 ? i < 26 * f : i < 14 * f; setI(cells, 64 + i, [-13.4 + i * 0.36, -3.6, 3.4], 0.28); colI(cells, 64 + i, hex3(real ? COL.act : COL.dim)); }
      done(cells);
      if (lk !== e + '') { lk = e + ''; swap(G, IN, txt, [0, 8.0, 0], { size: 15, border: hexs(COL.gold) }); }
      cap(id >= 0 ? `${nm} 用第 <b>${id}</b> 号槽位；其余 31 个槽位的约 ${(per * 31 / 1e6).toFixed(0)}M 参数这次前向不参与` : `${nm}：编号没有公开；所有槽位共享同一个 DiT`);
    } };
  }

  /* ---------- scene 8: DiT ---------- */
  function s8(G) {
    let v = opt(0, 0, 2);
    const sub = new THREE.Group(); G.add(sub);
    const vlT = inst(BOX, 40), saT = inst(BOX, 17); G.add(vlT, saT);
    const links = new THREE.Group(); G.add(links);
    G.add(lab('VL token（图像 / 文本）', [-14.4, 7.3, 0], { size: 15 }), lab('1 个状态 + 16 个动作 token', [-14.6, -1.6, 0], { size: 15 }));
    const tl = lab('时间步 τ → adaLN', [14.5, 7.0, 0], { size: 14, border: hexs(COL.gold) }); G.add(tl);
    let blocks = [], lk = '', lv = null;
    const ctls = [{ label: '版本', items: ['N1：16 块', 'N1.6 / N1.7：32 块交替看文本 / 图像'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      const n = v ? 32 : 16;
      if (lk !== v + '') { lk = v + ''; clearSub(sub); blocks = [];
        for (let i = 0; i < n; i++) { const cross = i % 2 === 0; const b = block(0.9 * 16 / n, 3.2, 2.6, cross ? COL.dit : 0xffc890, [-11 + i * 22 / n + 11 / n, 3.0, 0]); sub.add(b); blocks.push(b); }
        sub.add(lab('交叉注意力（深）/ 自注意力（浅）交替', [0, 5.2, 0], { size: 15 }));
        if (lv) dropLab(G, lv); lv = lab(v ? 'AlternateVLDiT：0、4、8… 只看文本；2、6、10… 只看图像' : '每个交叉块都看全部 VL token', [0, 9.0, 0], { size: 15, border: hexs(COL.vlm) }); G.add(lv); }
      for (let i = 0; i < 40; i++) { setI(vlT, i, [-11 + i * 0.56, 7.0, 0], 0.32); colI(vlT, i, hex3(i < 32 ? COL.img : COL.txt)); } done(vlT);
      for (let i = 0; i < 17; i++) { setI(saT, i, [-5.5 + i * 0.68, -0.6, 0], 0.4); colI(saT, i, hex3(i === 0 ? COL.state : COL.act)); } done(saT);
      const cur = Math.min(n - 1, Math.floor(seg(p, 0.05, 0.95) * n));
      blocks.forEach((b, i) => glow(b, i === cur ? 0.9 : 0));
      L.clear(links);
      const cross = cur % 2 === 0, bx = -11 + cur * 22 / n + 11 / n;
      if (cross) {
        const textOnly = v && cur % 4 === 0, imgOnly = v && cur % 4 === 2;
        for (let j = 0; j < 17; j += 2) for (let i = 0; i < 40; i += 3) { if (textOnly && i < 32) continue; if (imgOnly && i >= 32) continue; links.add(L.line([[-5.5 + j * 0.68, -0.4, 0], [bx, 3, 0.2], [-11 + i * 0.56, 6.8, 0]], i < 32 ? COL.img : COL.txt, { opacity: 0.22 })); }
      } else {
        for (let a = 0; a < 17; a += 2) for (let b = a + 2; b < 17; b += 3) links.add(L.line([[-5.5 + a * 0.68, -0.3, 0], [(-11 + a * 1.36 + bx) / 2, 1.2, 0.3], [-5.5 + b * 0.68, -0.3, 0]], COL.act, { opacity: 0.35 }));
      }
      cap(`第 <b>${cur}</b> 块 · ${cross ? (v ? (cur % 4 === 0 ? '交叉注意力，只读<b>文本</b> token' : '交叉注意力，只读<b>图像</b> token') : '交叉注意力：17 个 token 读全部 VL token') : '自注意力：17 个状态 / 动作 token 互相读'} · 每块用 τ 的 adaLN 调制`);
    } };
  }

  /* ---------- scene 9: flow-matching training ---------- */
  function s9(G) {
    let w = opt(0, 0, 2);
    const X = i => -14 + i * 0.9, Y0 = 3.2, K = 1.1;
    const tN = L.tube(NOISE.map((v, i) => [X(i), Y0 + v * K, 0]), COL.noise, 0.05, { opacity: 0.7 }), tA = L.tube(TRUE_A.map((v, i) => [X(i), Y0 + v * K, 0]), COL.ok, 0.07); G.add(tN, tA);
    G.add(lab('噪声 ε', [X(0), Y0 + NOISE[0] * K + 1.2, 0], { size: 14 }), lab('真实动作 A（玩具）', [X(15) + 1.4, Y0 + TRUE_A[15] * K + 0.6, 0], { size: 14 }));
    const pts = inst(BALL, 16); G.add(pts);
    const arrows = Array.from({ length: 16 }, () => arrowTo(G, [0, 0, 0], [0, 1, 0], COL.gold));
    const hist = Array.from({ length: 20 }, (_, i) => { const b = block(0.42, 1, 0.42, COL.txt, [5.5 + i * 0.5, 0.5, 0], { edges: false }); G.add(b); return b; });
    G.add(lab('p(τ)：Beta(1.5, 1) 变换', [10.3, 7.2, 0], { size: 15 }), lab('τ = 0 噪声', [5.6, -0.7, 0.8], { size: 13 }), lab('τ = 1 数据', [15.0, -0.7, 0.8], { size: 13 }));
    const mk = block(0.12, 6.4, 0.5, COL.act, [5.5, 3.2, 0.3]); G.add(mk);
    const integ = Array.from({ length: 20 }, (_, i) => { const a = i / 20, b = (i + 1) / 20; let s = 0; for (let k = 0; k < 40; k++) s += tauPdf(a + (b - a) * (k + 0.5) / 40) * (b - a) / 40; return s; });
    const mean = (S_ - 1.5 / 2.5) / S_;
    G.add(lab(`E[τ] = ${mean.toFixed(3)}`, [10.3, 6.1, 0], { size: 14 }));
    const ctls = [{ label: '速度目标', items: ['代码：A − ε', '论文式 (1)：ε − A'], get: () => w, set: k => { w = k; } }];
    return { ctls, update(p) {
      const tau = 0.05 + 0.9 * seg(p, 0.05, 0.9);
      for (let i = 0; i < 16; i++) {
        const y = tau * TRUE_A[i] + (1 - tau) * NOISE[i]; setI(pts, i, [X(i), Y0 + y * K, 0], 0.18); colI(pts, i, hex3(COL.act));
        const vel = w === 0 ? TRUE_A[i] - NOISE[i] : NOISE[i] - TRUE_A[i];
        setArrow(arrows[i], [X(i), Y0 + y * K, 0], [X(i), Y0 + (y + 0.35 * vel) * K, 0]); arrows[i].setColor(new THREE.Color(w === 0 ? COL.gold : COL.bad));
      } done(pts);
      const mx = Math.max(...integ); hist.forEach((b, i) => { const h = integ[i] / mx * 6; b.scale.y = Math.max(0.02, h); b.position.y = h / 2; });
      mk.position.x = 5.5 + tau * 9.5;
      cap(`τ = <b>${tau.toFixed(2)}</b>：A^τ = τ·A + (1 − τ)·ε（橙点）· 箭头是要学的速度 · ${w === 0 ? '代码 <b>A − ε</b>：沿 τ 增大指向数据，Euler “+V/K” 正确' : '论文 <b>ε − A</b>：指向噪声，配“+V/K” 会走反（读者注 4）'}`);
    } };
  }

  /* ---------- scene 10: K-step inference ---------- */
  function s10(G) {
    let kk = opt(0, 0, 2);
    const X = i => -12 + i * 1.0, Y0 = 3.4, K = 1.1;
    G.add(L.tube(TRUE_A.map((v, i) => [X(i), Y0 + v * K, -0.4]), COL.ok, 0.05, { opacity: 0.4 }));
    const pts = inst(BALL, 16 * 17); G.add(pts);
    const bar = block(1, 0.5, 0.6, COL.dit, [0, -1.6, 0]); G.add(bar);
    G.add(lab('VL 特征只算一次，K 步复用', [-8.5, 8.6, 0], { size: 15 }));
    const TL = {};
    const ctls = [{ label: '去噪步数', items: ['K = 4（脚本默认）', 'K = 16（权重 config）'], get: () => kk, set: k => { kk = k; } }];
    let lk = '';
    return { ctls, update(p) {
      const Kst = kk ? 16 : 4, done_ = seg(p, 0.05, 0.9) * Kst;
      for (let s = 0; s <= 16; s++) for (let i = 0; i < 16; i++) {
        const k = s * 16 + i, on = s <= Kst && s <= done_ + 1e-6;
        const tau = s / Kst, y = tau * TRUE_A[i] + (1 - tau) * NOISE[i];
        setI(pts, k, [X(i), Y0 + y * K, s * 0.35 * 4 / Kst], on ? (s === Math.floor(done_) ? 0.2 : 0.11) : 0.0001);
        colI(pts, k, hex3(s === Kst ? COL.ok : s === 0 ? COL.noise : COL.act));
      } done(pts);
      bar.scale.x = Math.max(0.05, 14 * Math.min(1, done_ / Kst)); bar.position.x = -12 + bar.scale.x / 2;
      if (lk !== kk + '') { lk = kk + ''; swap(G, TL, `τ = ${Array.from({ length: Math.min(Kst, 6) }, (_, i) => (i / Kst).toFixed(Kst > 4 ? 3 : 2)).join('、')}${Kst > 6 ? '…' : ''}\n桶号 × 1000 取整`, [8, 8.6, 0], { size: 14, border: hexs(COL.gold) }); }
      const st = Math.min(Kst, Math.floor(done_) + 1);
      cap(`第 <b>${Math.min(st, Kst)}</b> / ${Kst} 步：A ← A + V/${Kst} · DiT 跑 ${Kst} 遍，VLM 1 遍 · 论文：K = 4 时整段 16 步动作 <b>63.9 ms</b>（L40，bf16）`);
    } };
  }

  /* ---------- scene 11: results ---------- */
  function s11(G) {
    let t = opt(0, 0, 4);
    const sub = new THREE.Group(); G.add(sub);
    const TB = [
      { t: '表 2 · 仿真（每任务 100 条）', g: ['RoboCasa', 'DexMG', 'GR-1', '平均'], s: [['BC-T', 0x8e9bb8, [26.3, 53.9, 16.1, 26.4]], ['DP', 0x6b7794, [25.6, 56.1, 32.7, 33.4]], ['GR00T', COL.ok, [32.1, 66.5, 50.0, 45.0]]], hi: 80, c: 'DexMG 一列表 2 写 56.1 / 66.5，表 4 和图 10 是 46.9 / 58.5（读者注 11）' },
      { t: '表 3 · 真机 GR-1', g: ['抓放', '铰接', '工业', '协作', '平均'], s: [['DP 10%', 0x8e9bb8, [3.0, 14.3, 6.7, 27.5, 10.2]], ['DP 全部', 0x6b7794, [36.0, 38.6, 61.0, 62.5, 46.4]], ['GR00T 10%', 0x9fd89a, [35.0, 62.0, 31.0, 50.0, 42.6]], ['GR00T 全部', COL.ok, [82.0, 70.9, 70.0, 82.5, 76.8]]], hi: 100, c: '“平均”是 13 个任务的平均（抓放 5 个各取见过 / 没见过的平均），读者注 12' },
      { t: '图 9 · 神经轨迹（RoboCasa 每任务示范数）', g: ['30', '100', '300'], s: [['DP', 0x6b7794, [14.7, 25.6, 43.2]], ['GR00T', 0x8e9bb8, [17.4, 32.1, 49.6]], ['+LAPA', COL.ok, [21.6, 39.5, 52.9]], ['+IDM', COL.vlm, [21.2, 40.9, 56.4]]], hi: 70, c: '+4.2 / +8.8 / +6.8 取的是 LAPA 和 IDM 里较好的那个（读者注 14）' },
      { t: 'RoboCasa-GR1（24 任务）· 各版本自报', g: ['N1（100 条）', 'N1.5', 'N1.6', 'N1.7', 'OpenWAM-α'], s: [['成功率 %', COL.ok, [50.0, 48.2, 47.6, 44.5, 60.5]]], hi: 70, c: '来源和协议各不相同：本文表 4 · n1.5 README（微调，50 次）· n1.6 README（base）· main README（微调，20 次）· OpenWAM 表 20' }
    ];
    const ctls = [{ label: '图表', items: ['表 2', '表 3', '图 9', 'RoboCasa-GR1'], get: () => t, set: k => { t = k; } }];
    let lk = '', draw = null;
    return { ctls, update(p) {
      if (lk !== t + '') { lk = t + ''; clearSub(sub); const T = TB[t]; draw = chart(sub, { t: T.t, g: T.g, s: T.s, lo: 0, hi: T.hi }, { span: 30, H: 7 }); }
      draw(seg(p, 0.05, 0.6));
      cap(TB[t].c);
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
  /* OPT must survive into BUILD on first load: go() resets it after building */
  go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0));
  window.__gr00tDebug = { get cap() { return $('cap').textContent; } };
})();
