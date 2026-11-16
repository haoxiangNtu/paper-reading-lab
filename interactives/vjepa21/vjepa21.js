'use strict';
/* V-JEPA 2.1 (arXiv 2603.14482) taken apart into eleven animated scenes. Shapes and hyperparameters come from the paper and
   from the official code facebookresearch/vjepa2 at commit 204698b. Each scene's update(p) is a pure function of the timeline p
   plus the current toggles. The "video" is a synthetic colour field. Scenes 3 and 5 sample masks with the code's rule and compute
   the context-loss weights live; those are labelled as toys. No V-JEPA network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { vid: 0x3aa8e0, img: 0x4fc98a, enc: 0x38d1ff, pred: 0xf2a0a0, tgt: 0x9d8cff, mask: 0xe05d5d, loss: 0xf2c14e, ema: 0x8e9bb8, dim: 0x46506a, gold: 0xf2c14e, ok: 0x4fc98a, orange: 0xf0963c, white: 0xeef2fa, dino: 0xd45fa0, mlp: 0xb48cff };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  const SCENES = [
    { n: 1, part: '总览', title: '一条学生路，一条老师路', sub: '图 4 的 3D 版：tokenizer、x 编码器、预测器、EMA 的 y 编码器、两种损失', dur: 14, cam: [0.1, 1.12, 33, [0, 5.6, 0]],
      html: dl([['谱系', 'JEPA 2022 → V-JEPA 2024 → V-JEPA 2 2025 → 2.1 2026'], ['学生', 'x 编码器 E_θ 只看可见 token'], ['预测器', 'P_φ，24 层、宽 384'], ['老师', 'y 编码器 E_θ̄ = EMA(θ)，0.99925，看全部 token'], ['损失', '被遮 token 的 L1 ＋ 可见 token 的加权 L1']]) +
        '<p>上面一层是学生：视频或图像切成 token，去掉被遮的，x 编码器处理剩下的；预测器拿到编码结果和带位置的 mask token，对每个位置输出一个预测。</p>' +
        '<p>下面一层是老师：同一个输入不遮挡，过 y 编码器得到目标。y 编码器不靠梯度更新，而是 x 编码器权重的指数滑动平均；目标一侧 stop-gradient。两者一起防止“输出常数”的塌缩。</p>' +
        '<p>2.1 和 V-JEPA 2 的区别在这条流水线的三个地方：损失也算可见 token（第 5 幕），编码器 4 层都受监督（第 6 幕），图像走自己的 tokenizer（第 7 幕）。点画面里的方块可以跳到对应那一幕。</p>' + src('§2.1 · 图 4 · 附录 A') },
    { n: 2, part: '§2.3.4 tokenizer', title: '视频怎样切成 token', sub: '每 2 帧 × 16 × 16 像素切一块 tubelet；切换第一阶段、冷却阶段和图像', dur: 12, cam: [0.62, 1.12, 25, [0, 4.6, -3]],
      html: dl([['视频', '16 帧 × 256² → 8 × 16 × 16 = 2,048 个 token'], ['冷却', '64 帧 × 384² → 32 × 24 × 24 = 18,432 个'], ['图像（2.1）', '256² → 16 × 16 = 256 个；冷却 512² → 1,024 个'], ['每个 token', 'ViT-G 1,664 维，ViT-g 1,408 维']]) +
        '<p>视频的 patch 嵌入是核为 2 × 16 × 16、步长相同的 3D 卷积：时间上每 2 帧、空间上每 16 × 16 像素压成一个向量，这就是 tubelet。所以时间分辨率减半，空间每边除以 16。</p>' +
        '<p>冷却阶段帧数变成 4 倍、边长变成 1.5 倍，token 数变成 4 × 2.25 = 9 倍，注意力的计算量约是 81 倍。这就是冷却只跑 12,000 步的原因（论文说“在可控的算力下提高分辨率”）。</p>' +
        guess('画面里的“视频”是合成色块：渐变背景加一个从左往右移动的橙色圆斑，只为看出时空位置。') + src('§2.3.4 · 附录 A 表 12 · patch_embed.py · vision_transformer.py') },
    { n: 3, part: '§2.1 遮挡', title: '遮掉一大半：短程和长程两种块', sub: '按代码规则当场采样；切换短程、长程和图像遮挡', dur: 13, cam: [0.62, 1.12, 25, [0, 4.6, -3]],
      html: dl([['短程', '8 个块，每块面积 15%'], ['长程', '2 个块，每块面积 70%'], ['图像', '10 个块，每块 15%'], ['时间', '每块贯穿所有时间'], ['宽高比', '[0.75, 1.5] 随机']]) +
        '<p>代码 <code>multiseq_multiblock3d.py</code> 的规则：每个样本先采一个块大小（面积取 int(16 × 16 × 比例)，宽高比随机，h、w 四舍五入），再随机放若干个这样大的块，取并集。时间比例 [1.0, 1.0]，所以块是贯穿全部帧的“管子”：同一空间位置要么所有时刻都被遮，要么都可见。这防止模型从相邻帧直接抄答案。</p>' +
        '<p>每个视频样本两种遮挡都做，编码器对每种各跑一次。表 12 写的“空间比例 [0.15, 0.7]”其实是这两个生成器，不是一个区间。</p>' +
        toyb('块的位置用页面的随机种子当场采样，所以和真实训练的具体位置不同。下方读数里的“平均”是同一规则采 400 次的平均，是当场算的。') + src('附录 A 表 12 · configs/train_2_1/vitG16/pretrain-256px-16f.yaml · src/masks/multiseq_multiblock3d.py') },
    { n: 4, part: '§2.1 编码器和预测器', title: '可见 token 进编码器，mask token 进预测器', sub: '切换 V-JEPA 2 和 2.1：预测器深度、输出哪些 token', dur: 13, cam: [0.06, 1.18, 34, [0, 5.4, 0]],
      html: dl([['x 编码器', '只处理可见 token（约 38%）'], ['mask token', '可学向量 + 被遮位置的 RoPE 坐标'], ['预测器', 'V-JEPA 2：12 层；2.1：24 层，宽 384'], ['y 编码器', 'EMA，处理全部 2,048 个'], ['输出', 'V-JEPA 2 只用被遮位置；2.1 两种都用']]) +
        '<p>编码器只看可见 token，所以它的计算量随遮挡比例下降。预测器的序列长度是全部 token 数：上下文 token 和 mask token 拼起来，按原位置排好，用 3D RoPE 告诉它每个 token 在哪。</p>' +
        '<p>V-JEPA 2 只把预测器在被遮位置的输出拿去算损失，上下文位置的输出被丢掉。2.1 两种都用，而且代码里上下文 token 有自己的输出头 <code>predictor_proj_context</code>，图 4 没画这一点。</p>' +
        toyb('可见和被遮的 token 数按第 3 幕同一个短程遮挡样本算。') + src('§2.1 式 (1) · 图 4 · predictor.py · train.py forward_context') },
    { n: 5, part: '§2.3.1 稠密损失', title: '可见 token 也要算损失，离被遮区越近越重', sub: '这一幕是核心。柱子高度就是每个 token 的损失权重，当场按 λ/√d 算', dur: 16, cam: [0.0, 0.98, 28, [0.4, 3.0, 0]],
      html: dl([['式 (1)', 'L_predict：被遮 token 的 L1 平均'], ['式 (2)', 'L_ctx：可见 token 的 L1，乘 λ_i 后平均'], ['式 (3)', 'λ_i = λ / √d_min(i, M)'], ['λ', '视频 0.5；图像论文 0.7，配置 0.5'], ['预热', '第 15k 到 30k 步线性升（代码）']]) +
        '<p>V-JEPA 2 只监督被遮 token（红）。论文的假设是：可见 token 不受监督，就没有理由保存自己位置的内容，会变成聚合全局信息的“寄存器”，于是 patch 特征一片噪点（图 1、3）。</p>' +
        '<p>2.1 让可见 token（蓝柱）也去对齐老师的特征。直接加、λ 又大时，模型可能学会“抄上下文”，整体任务掉得厉害（表 2：λ = 1 时 SSv2 51.1）。所以权重按到最近被遮 token 的距离衰减：紧挨被遮区的 token 权重 λ，远处的小。切换开关看三种写法；进度条同时走训练步数，λ 在 15k 到 30k 步之间从 0 升上来。</p>' +
        '<p>遮挡贯穿全部时间，最近的被遮 token 总在同一时刻，所以 d 只是空间距离，最小是 1。这一点是我从代码推出来的，论文没写。</p>' +
        toyb('遮挡样本按代码规则当场采样，λ/√d 和读数都是当场算的。冷却阶段的配置关掉了距离权重和预热，这里画的是第一阶段。') + src('§2.3.1 式 (2)(3) · 表 2 · masks_dist.py compute_mask_distance · modules.py Lambda_LinearWarmupHold') },
    { n: 6, part: '§2.3.2 深监督', title: '4 层一起受监督', sub: '编码器的 4 个中间层拼起来进预测器，预测器同时预测 4 层', dur: 13, cam: [0.18, 1.16, 31, [0.4, 6.0, 0]],
      html: dl([['ViT-G 代码', '第 12、24、38、48 层（从 1 数）'], ['表 12', '12、24、36、48'], ['ViT-g', '10、20、30、40'], ['拼接', '4 × 1664 = 6,656 维'], ['融合 MLP', '6656 → 1664 → 384']]) +
        '<p>每个引出层先过自己的 LayerNorm，沿通道拼成 6,656 维，MLP 降到预测器的 384 维。预测器每个位置输出 6,656 维，切成 4 段，分别对齐老师 4 层的输出（老师那边每层再做一次无参 LayerNorm）。被遮和可见两种损失都在 4 层上算。</p>' +
        '<p>效果（表 1）：只加上下文损失时 SSv2 从 72.8 掉到 62.5；加深监督回到 72.1，ADE20K 还从 33.8 涨到 38.6。表 13：有深监督后，只用最后一层做探针就够了。</p>' +
        '<p>代码的 ViT-G 第三个引出层是第 38 层，不是表 12 写的 36，也不等间距。切换开关比较。</p>' + src('§2.3.2 · 表 1、12、13 · vision_transformer.py hierarchical_layers · predictor.py predictor_embed') },
    { n: 7, part: '§2.3.4 多模态', title: '图像不再复制成 16 帧', sub: '切换 V-JEPA 2 和 2.1 处理一张图的方式', dur: 12, cam: [0.42, 1.12, 27, [0, 5.4, -2]],
      html: dl([['V-JEPA 2', '图像复制成 16 帧，3D 卷积 → 2,048 个 token'], ['V-JEPA 2.1', 'Conv3d(1×16×16) → 256 个 token'], ['模态', 'img_mod_embed / video_mod_embed，加到每个 token'], ['表 1', 'ADE20K 40.8 → 41.4，其余不变']]) +
        '<p>V-JEPA 2 只有一个 3D 卷积，图像只好复制成静止的 16 帧视频。这既浪费算力，也教模型“图像是不动的视频”。2.1 给图像单独一条路：核在时间上为 1，等价于 2D 卷积，一张 256² 的图只有 256 个 token。</p>' +
        '<p>两条路共享同一个编码器，所以要告诉它输入是哪种：代码里是两个可学的向量，加到每个 token 上（不是额外拼一个 token）。预测器也有一对。</p>' +
        '<p>算一下：token 少 8 倍，自注意力的两两配对少 64 倍。</p>' + src('§2.3.4 · vision_transformer.py patch_embed_img / img_mod_embed · predictor.py') },
    { n: 8, part: '§2.3.3/5 数据和规模', title: '更多图像、更杂的视频、更大的模型', sub: '切换表 3 的采样权重和表 1 的逐项消融；右边是四个尺寸', dur: 12, cam: [0.04, 1.2, 33, [0, 5.6, 0]],
      html: dl([['图像', 'ImageNet 1M → LVD-142M'], ['视频', 'YT-1B 权重 0.188 → 0.720，SSv2 0.056 → 0.170'], ['混合', '图像和视频分到不同 GPU，梯度汇总'], ['模型', 'ViT-L 3 亿 → ViT-G 18.5 亿（我按代码算）'], ['蒸馏', 'ViT-G → ViT-L、ViT-B']]) +
        '<p>左边：表 3 两列采样权重。V-JEPA 2 把 ImageNet 当作一个视频源按 0.25 的权重混进去；2.1 把图像交给单独的进程，视频的权重里不再有图像。Kinetics 几乎被拿掉（0.188 → 0.010）。</p>' +
        '<p>切到“表 1”：从 V-JEPA 2 起逐项加组件，ADE20K 和 SSv2 两条柱子。注意第二步的 SSv2 大跌和第三步的回升。</p>' +
        '<p>右边的方块体积按我算的编码器参数量缩放：ViT-B 86.8M、ViT-L 304.7M、ViT-g 1,013M、ViT-G 1,845M。</p>' + src('§2.3.3 表 3 · §2.3.5 · 表 1 · vision_transformer.py 的尺寸定义') },
    { n: 9, part: '§2.3.5/6 冷却和蒸馏', title: '最后 12k 步加分辨率，再教小模型', sub: '切换论文和代码的学习率；右边是蒸馏', dur: 15, cam: [0.04, 1.18, 32, [0, 5.6, 0]],
      html: dl([['第一阶段', '135k 步，16 帧 256²，图像 256²'], ['冷却', '12k 步，64 帧 384²，图像 512²'], ['学习率（论文）', '1e-4 → 5.25e-4 恒定；冷却 6e-4 → 1e-6'], ['学习率（代码）', '恒定 6e-4；冷却末值约 1.2e-4'], ['蒸馏', '冻结 ViT-G 当老师，学生的 EMA 发布']]) +
        '<p>冷却阶段学习率下降，同时输入变大。深度受益最多：NYUv2 0.365 → 0.307（表 1）。</p>' +
        '<p>代码和论文有两处不同：恒定段是 6e-4 不是 5.25e-4；冷却用线性衰减，总长按 1.25 × 40 × 300 = 15,000 步设定，但只跑 12,000 步，所以停在约 1.2e-4。这是我按调度器公式推的，没有运行。</p>' +
        '<p>蒸馏：老师冻结，不用 EMA；学生配一个新的 12 层预测器，只对齐老师最后一层（1,664 维）；学生另存一份 EMA 作为发布模型。两阶段：先用冷却前的老师、低分辨率，再用冷却后的老师、高分辨率。</p>' + src('§2.3.5 · §2.3.6 · 附录 A、B · 表 11 · configs/train_2_1 · src/utils/schedulers.py · hub/backbones.py') },
    { n: 10, part: '§3 结果', title: '下游：稠密任务大涨，整体任务持平', sub: '切换五组任务；每组柱子按组内最大值缩放，数字是原文的', dur: 12, cam: [0, 1.22, 34, [0, 5.4, 0]],
      html: dl([['NYUv2 深度', '0.642 → 0.307 RMSE'], ['ADE20K', '24.4 → 47.9 mIoU'], ['SSv2', '77.3 → 77.7'], ['Ego4D STA', '6.02 → 7.71 mAP'], ['真机抓取', '60% → 70%（同设置）/ 80%']]) +
        '<p>稠密：线性探针深度和分割都翻倍级提升，深度追平 7B 的 DINOv3，分割仍落后。整体：同为 1B 的 ViT-g 略低于 V-JEPA 2，2B 的 ViT-G 略高。</p>' +
        '<p>机器人：同样的规划设置抓取高 10 点（每项 10 个任务，即 1 个任务）；换成 8 步视野、300 个样本后高 20 点，但每步慢 4.7 倍。导航：规划快 9.7 倍，精度几乎不变。</p>' + src('表 4、5、6、7、8、9') },
    { n: 11, part: 'OpenWAM', title: '在 OpenWAM 里当视觉编码器', sub: '9 帧怎样变成 3 个隐帧、360 个 DiT token；切换加不加 S-VAE', dur: 16, cam: [0.06, 1.16, 37, [0, 5.4, 0]],
      html: dl([['检查点', 'vjepa2_1_vitg_384.pt，ViT-g，1,408 维，冻结'], ['条件帧', '[f0, f0] 走视频分支 → 1 个隐帧'], ['目标帧', '[f0, f0, f1…f8] → 5 个，丢第 1 个，相邻两两平均 → 2 个'], ['网格', '384 × 320 → 24 × 20'], ['DiT', 'Conv3d(C, 3072, (1,2,2)) → 360 个 token']]) +
        '<p>OpenWAM 要让任何编码器都产生和 Wan2.2-VAE 一样多的隐帧：首帧单独一个，之后每 4 帧一个。V-JEPA 的 tubelet 已经把时间压了 2 倍，代码再把相邻两个隐帧求平均，凑够 4 倍。</p>' +
        '<p>不加 S-VAE 时每个位置 1,408 维，DiT 的 2 × 2 patch 让每个 token 输入 5,632 维，超过 DiT 宽度 3,072；加 S-VAE 压到 48 维，每个 token 192 维，和 Wan2.2-VAE 一样。OpenWAM 图 7：80.91% 对 88.46%。</p>' +
        '<p>论文 OpenWAM 写 V-JEPA 2.1 是 1,024 维，代码下载的是 1,408 维的 ViT-g，详见精读页读者注 26 和 OpenWAM 页读者注 20。</p>' + src('OpenWAM vjepa21.py _batch_encode_pooled_raw · download_visual_encoder.py · OpenWAM §4.1.2 图 7') }
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
  let LABS = [], refDist = 24, PICKS = [];
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65, emissive: o.emissive }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
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

  /* controls: api.ctls = [{label, items, get, set}], plus api.readout() for a live line */
  function buildCtl() {
    const box = $('ctl'); box.innerHTML = ''; box.hidden = true; if (!api) return;
    (api.ctls || []).forEach((c, gi) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-g="${gi}" data-k="${k}" aria-pressed="${c.get() === k}">${t}</button>`).join('');
      box.appendChild(row); box.hidden = false;
    });
    if (api.readout) { const r = document.createElement('div'); r.className = 'rd'; r.id = 'rd'; box.appendChild(r); box.hidden = false; }
  }
  function syncCtl() { (api?.ctls || []).forEach((c, gi) => { $('ctl').querySelectorAll(`button[data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(c.get() === +b.dataset.k))); }); }
  let lastRd = null; const rd = h => { const el = $('rd'); if (el && h !== lastRd) { lastRd = h; el.innerHTML = h; } };

  /* ---------- shared computations ---------- */
  /* the mask rule of src/masks/multiseq_multiblock3d.py: one block size per sample, nb blocks at random positions, union */
  function sampleMask(r, G, scale, nb) {
    const ar = 0.75 + r() * 0.75, keep = Math.floor(G * G * scale);
    const h = Math.min(G, Math.round(Math.sqrt(keep * ar))), w = Math.min(G, Math.round(Math.sqrt(keep / ar)));
    const m = new Uint8Array(G * G), blocks = [];
    for (let b = 0; b < nb; b++) { const top = Math.floor(r() * (G - h + 1)), left = Math.floor(r() * (G - w + 1)); blocks.push([top, left, h, w]); }
    return { m, blocks, h, w };
  }
  function unionUpTo(mk, G, k) { const m = new Uint8Array(G * G); for (let b = 0; b < Math.min(k, mk.blocks.length); b++) { const [t, l, h, w] = mk.blocks[b]; for (let i = t; i < t + h; i++) for (let j = l; j < l + w; j++) m[i * G + j] = 1; } return m; }
  const MCFG = [{ name: '短程', scale: 0.15, nb: 8 }, { name: '长程', scale: 0.7, nb: 2 }, { name: '图像', scale: 0.15, nb: 10 }];
  const MS = {};
  function maskStats(ci) {
    if (MS[ci]) return MS[ci];
    const c = MCFG[ci], r = L.rng(101 + ci * 7), sample = sampleMask(r, 16, c.scale, c.nb), full = unionUpTo(sample, 16, 99);
    const rr = L.rng(900 + ci); let tot = 0; for (let k = 0; k < 400; k++) { const s = sampleMask(rr, 16, c.scale, c.nb), u = unionUpTo(s, 16, 99); tot += u.reduce((a, v) => a + v, 0) / 256; }
    const frac = full.reduce((a, v) => a + v, 0) / 256;
    /* d_min per context cell: Euclidean distance on the token grid, as compute_mask_distance does (time drops out: masks span all time) */
    const d = new Float32Array(256).fill(0);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { if (full[i * 16 + j]) continue; let best = 1e9; for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) if (full[a * 16 + b]) best = Math.min(best, Math.hypot(a - i, b - j)); d[i * 16 + j] = best; }
    return (MS[ci] = { sample, full, frac, avg: tot / 400, d });
  }
  /* a synthetic colour field: sky/ground gradient plus an orange blob moving left to right over time */
  function pix(t, T, u, v) {
    let c = v < 0.45 ? [0.32 + 0.25 * u, 0.52 + 0.25 * v, 0.86] : [0.40 + 0.25 * u, 0.36 + 0.2 * (1 - v), 0.24 + 0.1 * u];
    const cx = 0.2 + 0.6 * (T > 1 ? t / (T - 1) : 0.5), dd = (u - cx) ** 2 + (v - 0.58) ** 2; if (dd < 0.025) c = [0.96, 0.56, 0.22];
    return c;
  }
  /* a token grid facing +z: column -> x, row -> y, time -> -z */
  function tokGrid(G, T, H, W, o) {
    const im = inst(BOX, T * H * W); G.add(im);
    const P = (t, i, j) => [o.x0 + (j - (W - 1) / 2) * o.pitch, o.y0 + ((H - 1) / 2 - i) * o.pitch, o.z0 - t * o.tz];
    for (let t = 0; t < T; t++) for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) colI(im, (t * H + i) * W + j, pix(t, T, j / (W - 1), i / (H - 1)));
    return { im, P, T, H, W, n: T * H * W };
  }
  const lamSched = (it, lam) => it < 15000 ? 0 : it >= 30000 ? lam : lam * (it - 15000) / 15000;
  /* encoder parameter count from vision_transformer.py definitions */
  function encParams(d, Lr, mlp) { const h = Math.floor(d * mlp), blk = 3 * d * d + 3 * d + d * d + d + 2 * d * h + h + d + 4 * d; return Lr * blk + (3 * 2 * 256 * d + d) + (3 * 256 * d + d) + 8 * d + 2 * d; }
  const SIZES = [['ViT-B', 768, 12, 4], ['ViT-L', 1024, 24, 4], ['ViT-g', 1408, 40, 48 / 11], ['ViT-G', 1664, 48, 64 / 13]].map(([n, d, l, m]) => ({ n, d, l, P: encParams(d, l, m) }));

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    G.add(L.grid(34, 34));
    const yT = 6.6, yB = 1.6;
    const frames = [0, 1, 2, 3].map(k => block(0.12, 2.4, 2.4, COL.vid, [-13 + k * 0.35, yT, 0], { opacity: 0.85 }));
    const tok = block(1.4, 1.4, 1.6, COL.vid, [-9.6, yT, 0]), maskB = block(1.0, 1.4, 1.6, COL.mask, [-7.4, yT, 0]);
    const xenc = block(2.2, 3.4, 2.2, COL.enc, [-4.4, yT, 0]), mlp = block(1.1, 1.6, 1.6, COL.mlp, [-1.4, yT, 0]), pred = block(2.4, 2.8, 2.2, COL.pred, [2.2, yT, 0]);
    const outB = block(1.2, 2.4, 1.8, COL.pred, [5.8, yT, 0], { opacity: 0.8 });
    const tokB = block(1.4, 1.4, 1.6, COL.vid, [-9.6, yB, 0]), yenc = block(2.2, 3.0, 2.2, COL.tgt, [-4.4, yB, 0]), tgtB = block(1.2, 2.4, 1.8, COL.tgt, [5.8, yB, 0], { opacity: 0.8 });
    const loss = block(1.8, 1.2, 1.6, COL.loss, [9.2, (yT + yB) / 2, 0]);
    G.add(...frames, tok, maskB, xenc, mlp, pred, outB, tokB, yenc, tgtB, loss);
    [[frames[0], 1], [frames[3], 1], [tok, 6], [maskB, 2], [xenc, 3], [mlp, 5], [pred, 3], [outB, 4], [yenc, 3], [tgtB, 5], [loss, 4], [tokB, 6]].forEach(([m, g]) => { m.userData.go = g; PICKS.push(m); });
    G.add(lab('视频 / 图像', [-12.5, yT + 1.9, 0], { size: 20 }), lab('tokenizer', [-9.6, yT + 1.3, 0], { size: 19 }), lab('遮挡', [-7.4, yT + 1.3, 0], { size: 19 }), lab('x 编码器 E_θ', [-4.4, yT + 2.3, 0], { size: 20 }), lab('MLP', [-1.4, yT + 1.4, 0], { size: 19 }), lab('预测器 P_φ', [2.2, yT + 2.0, 0], { size: 20 }), lab('预测', [5.8, yT + 1.8, 0], { size: 19 }));
    G.add(lab('y 编码器 E_θ̄（EMA）', [-4.4, yB - 2.1, 0], { size: 20 }), lab('目标（stop-grad）', [5.8, yB - 1.7, 0], { size: 19 }), lab('L1 损失', [9.2, (yT + yB) / 2 + 1.2, 0], { size: 20 }));
    G.add(lab('JEPA 2022 → V-JEPA 2024 → V-JEPA 2 2025 → V-JEPA 2.1 2026', [-2, 10.6, 0], { size: 21, border: 'rgba(56,209,255,.6)' }));
    const ema = wire(G, [[-4.4, yT - 1.8, 0.4], [-4.4, yB + 1.6, 0.4]], COL.ema, { dashed: true, opacity: 0.8 });
    G.add(lab('EMA 0.99925', [-6.9, (yT + yB) / 2, 0.6], { size: 18 }));
    const mtok = block(0.5, 0.5, 0.5, COL.mask, [0.3, yT - 2.2, 0]); G.add(mtok); G.add(lab('mask token', [0.3, yT - 3.0, 0], { size: 18 }));
    const f = { a: stream(G, 6, COL.vid), b: stream(G, 5, COL.enc), c: stream(G, 5, COL.pred), d: stream(G, 6, COL.vid), e: stream(G, 5, COL.tgt), g: stream(G, 4, COL.loss), h: stream(G, 4, COL.loss) };
    return { update(p) {
      const q = (p * 18) % 1, k2 = seg(p, 0.45, 0.55);
      f.a([[-12.6, yT, 0], [-9.6, yT, 0], [-7.4, yT, 0], [-5.5, yT, 0]], q, 1);
      f.b([[-3.3, yT, 0], [-1.4, yT, 0], [1.0, yT, 0]], q, 1);
      f.c([[3.4, yT, 0], [5.8, yT, 0]], q, 1);
      f.d([[-12.6, yT - 1.2, 0], [-9.6, yB, 0], [-5.5, yB, 0]], q, k2);
      f.e([[-3.3, yB, 0], [5.8, yB, 0]], q, k2);
      f.g([[6.4, yT, 0], [9.2, (yT + yB) / 2, 0]], q, k2); f.h([[6.4, yB, 0], [9.2, (yT + yB) / 2, 0]], q, k2);
      [tok, xenc, mlp, pred, outB].forEach(m => glow(m, 0.5 * (1 - k2))); [tokB, yenc, tgtB, loss].forEach(m => glow(m, 0.6 * k2));
      ema.material.opacity = 0.3 + 0.6 * k2;
      cap(p < 0.5 ? '学生：切 token → <b>去掉被遮的</b> → x 编码器 → 拼上 mask token → 预测器给每个位置一个预测' : '老师：同一输入<b>不遮挡</b>过 EMA 编码器得到目标；被遮和可见位置的预测都和目标算 L1');
    } };
  }

  /* ---------- scene 2: tubelets ---------- */
  function s2(G) {
    let mode = +(OPT[0] ?? 0);
    const MODES = [{ F: 16, R: 256, tub: 2, name: '视频 16 帧 256²' }, { F: 64, R: 384, tub: 2, name: '冷却 64 帧 384²' }, { F: 1, R: 256, tub: 1, name: '图像 256²' }];
    const subs = MODES.map(md => {
      const g = new THREE.Group(); G.add(g);
      const T = md.F / md.tub, H = md.R / 16, pitch = 6.0 / H, tz = md.F > 16 ? 0.32 : 0.75, cell = pitch * 0.82;
      const grid = tokGrid(g, T, H, H, { x0: 0, y0: 3.6, z0: 0, pitch, tz });
      const fr = inst(BOX, md.F); g.add(fr); for (let k = 0; k < md.F; k++) colI(fr, k, pix(k, md.F, 0.5, 0.3));
      g.add(lab(`${md.F} 帧 × ${md.R}² 像素`, [-4.4, -0.2, 1.5], { size: 20 }));
      const nT = lab(`${T} × ${H} × ${H} = ${(T * H * H).toLocaleString('en-US')} 个 token`, [4.2, 7.4, -1], { size: 21, border: 'rgba(56,209,255,.8)' }); nT.position.set(4.6, 7.6, 0); g.add(nT);
      return { g, md, T, H, grid, fr, cell, tz };
    });
    const ctls = [{ label: '输入', items: MODES.map(m => m.name), get: () => mode, set: k => { mode = k; } }];
    return { ctls, readout: true, update(p) {
      subs.forEach((s, k) => { s.g.visible = k === mode; });
      const s = subs[mode], { md, T, H, grid, fr, cell } = s;
      const a = seg(p, 0.05, 0.3), b = seg(p, 0.32, 0.55), c = seg(p, 0.55, 0.85);
      for (let f = 0; f < md.F; f++) {
        const t = Math.floor(f / md.tub), sub = f % md.tub, zSpread = -(f * s.tz / md.tub) - 0.4, zTub = -t * s.tz + (sub - 0.5) * 0.08 * (md.tub > 1 ? 1 : 0);
        const z = L.lerp(zSpread * 1.0, zTub, b), sc = (1 - c) * a;
        setI(fr, f, [0, 3.6, z + 0.3], [6.2 * sc + 0.001, 6.2 * sc + 0.001, 0.04]);
      }
      done(fr);
      for (let t = 0; t < T; t++) for (let i = 0; i < H; i++) for (let j = 0; j < H; j++) setI(grid.im, (t * H + i) * H + j, grid.P(t, i, j), cell * c + 0.0001);
      done(grid.im);
      const N = T * H * H;
      cap(p < 0.32 ? `${md.F} 帧原始画面` : p < 0.55 ? (md.tub > 1 ? '每 <b>2 帧</b>并成一个 tubelet（3D 卷积核 2×16×16）' : '图像走 2D 分支：核 1×16×16，<b>不复制帧</b>') : `每 16×16 像素一个 token：<b>${N.toLocaleString('en-US')}</b> 个，每个 1,664 维（ViT-G）`);
      rd(`token 数 = (${md.F}/${md.tub}) × (${md.R}/16)² = ${N.toLocaleString('en-US')}　自注意力配对 ${(N * N / 1e6).toFixed(1)}M`);
    } };
  }

  /* ---------- scene 3: masking ---------- */
  function s3(G) {
    let mi = +(OPT[0] ?? 0);
    const subs = [0, 1, 2].map(ci => {
      const g = new THREE.Group(); G.add(g);
      const T = ci === 2 ? 1 : 8, grid = tokGrid(g, T, 16, 16, { x0: 0, y0: 3.6, z0: 0, pitch: 0.38, tz: 0.6 });
      return { g, T, grid, st: maskStats(ci) };
    });
    G.add(lab('16 × 16 空间网格，时间向里', [0, -0.4, 1.5], { size: 19 }));
    const ctls = [{ label: '遮挡', items: ['短程 8 × 15%', '长程 2 × 70%', '图像 10 × 15%'], get: () => mi, set: k => { mi = k; } }];
    return { ctls, readout: true, update(p) {
      subs.forEach((s, k) => { s.g.visible = k === mi; });
      const s = subs[mi], st = s.st, nb = st.sample.blocks.length, k = Math.floor(seg(p, 0.08, 0.75) * nb + 1e-6), m = unionUpTo(st.sample, 16, k);
      const shrink = seg(p, 0.78, 0.95);
      for (let t = 0; t < s.T; t++) for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
        const id = (t * 16 + i) * 16 + j, on = m[i * 16 + j];
        colI(s.grid.im, id, on ? [0.88, 0.36, 0.36] : pix(t, s.T, j / 15, i / 15));
        setI(s.grid.im, id, s.grid.P(t, i, j), on ? 0.31 * (1 - 0.8 * shrink) + 0.001 : 0.31);
      }
      done(s.grid.im);
      const fr = m.reduce((a, v) => a + v, 0) / 256;
      cap(p < 0.78 ? `放第 <b>${Math.min(k, nb)}</b> / ${nb} 个块（每块 ${st.sample.h} × ${st.sample.w}，贯穿所有时间）` : `被遮的 token 拿掉，编码器只看剩下的 <b>${(100 * (1 - st.frac)).toFixed(0)}%</b>`);
      rd(`这个样本遮掉 ${(100 * fr).toFixed(1)}%　同规则 400 次平均 ${(100 * st.avg).toFixed(1)}%　token：${s.T * 256} → 可见 ${Math.round(s.T * 256 * (1 - st.frac))}`);
    } };
  }

  /* ---------- scene 4: encoder, predictor, target ---------- */
  function s4(G) {
    let v = +(OPT[0] ?? 1);
    G.add(L.grid(30, 30));
    const st = maskStats(0), N = 2048, Nm = Math.round(N * st.frac), Nc = N - Nm;
    const yT = 6.4, yB = 1.6;
    const colVis = block(0.8, 3.0, 0.8, COL.vid, [-11, yT, 0]), colAll = block(0.8, 3.0, 0.8, COL.vid, [-11, yB, 0]);
    const xenc = block(2.2, 3.4, 2.2, COL.enc, [-7.2, yT, 0]), yenc = block(2.2, 3.0, 2.2, COL.tgt, [-7.2, yB, 0]);
    const mlp = block(0.9, 1.6, 1.6, COL.mlp, [-4.2, yT, 0]);
    const mt = block(0.8, 3.0, 0.8, COL.mask, [-2.0, yT + 0.0, 1.4]);
    const predG = new THREE.Group(); G.add(predG);
    const slabs = []; for (let k = 0; k < 24; k++) { const b = block(2.6, 0.1, 2.2, COL.pred, [1.8, yT - 1.5 + k * 0.13, 0], { edges: false }); predG.add(b); slabs.push(b); }
    const outM = block(0.8, 2.6, 0.8, COL.mask, [5.6, yT + 0.6, 0]), outC = block(0.8, 1.2, 0.8, COL.enc, [5.6, yT - 1.6, 0]);
    const tgt = block(0.8, 3.0, 0.8, COL.tgt, [5.6, yB, 0]), loss = block(1.6, 1.0, 1.4, COL.loss, [9.0, (yT + yB) / 2, 0]);
    G.add(colVis, colAll, xenc, yenc, mlp, mt, outM, outC, tgt, loss);
    G.add(lab(`可见 ${Nc}`, [-11, yT + 2.0, 0], { size: 19 }), lab(`全部 ${N}`, [-11, yB - 2.0, 0], { size: 19 }), lab('x 编码器', [-7.2, yT + 2.2, 0], { size: 20 }), lab('y 编码器（EMA）', [-7.2, yB - 2.7, 0], { size: 20 }));
    G.add(lab(`mask token × ${Nm}`, [-2.0, yT - 2.2, 1.6], { size: 19 }), lab('被遮位置的预测', [5.6, yT + 2.4, 0], { size: 18 }), lab('目标', [5.6, yB - 2.0, 0], { size: 19 }), lab('L1', [9.0, (yT + yB) / 2 + 1.0, 0], { size: 20 }));
    const lc = lab('上下文位置的预测', [5.6, yT - 2.6, 0], { size: 18 }); G.add(lc);
    const lp12 = lab('预测器 12 层', [1.8, yT + 2.2, 0], { size: 20 }), lp24 = lab('预测器 24 层', [1.8, yT + 2.6, 0], { size: 20 }); G.add(lp12, lp24);
    wire(G, [[-7.2, yT - 1.8, 0.5], [-7.2, yB + 1.6, 0.5]], COL.ema, { dashed: true, opacity: 0.8 });
    const f = { a: stream(G, 5, COL.vid), b: stream(G, 5, COL.enc), c: stream(G, 4, COL.mask), d: stream(G, 4, COL.pred), e: stream(G, 4, COL.enc), g: stream(G, 5, COL.tgt), h: stream(G, 4, COL.loss) };
    const ctls = [{ label: '版本', items: ['V-JEPA 2', 'V-JEPA 2.1'], get: () => v, set: k => { v = k; } }];
    return { ctls, readout: true, update(p) {
      const q = (p * 16) % 1, depth = v ? 24 : 12;
      slabs.forEach((b, k) => { b.visible = k < depth; b.position.y = yT - (depth * 0.13) / 2 + k * 0.13; });
      const t = v ? '预测器 24 层' : '预测器 12 层'; lp12.visible = !v; lp24.visible = !!v;
      outC.visible = !!v; lc.visible = !!v; mlp.visible = !!v;
      f.a([[-11, yT, 0], [-8.3, yT, 0]], q, 1); f.b([[-6.1, yT, 0], [-4.2, yT, 0], [0.4, yT, 0]], q, 1); f.c([[-2.0, yT, 1.4], [0.4, yT, 0.6]], q, seg(p, 0.15, 0.25));
      f.d([[3.2, yT, 0], [5.6, yT + 0.6, 0]], q, seg(p, 0.3, 0.4)); f.e([[3.2, yT, 0], [5.6, yT - 1.6, 0]], q, v ? seg(p, 0.3, 0.4) : 0);
      f.g([[-11, yB, 0], [-6.1, yB, 0], [5.6, yB, 0]], q, seg(p, 0.45, 0.55)); f.h([[6.1, (yT + yB) / 2, 0], [8.2, (yT + yB) / 2, 0]], q, seg(p, 0.6, 0.7));
      glow(loss, 0.6 * seg(p, 0.6, 0.7)); glow(outC, v ? 0.5 : 0);
      cap(v ? `2.1：预测器 <b>24</b> 层；被遮 <b>${Nm}</b> 个和上下文 <b>${Nc}</b> 个位置的输出都对齐老师` : `V-JEPA 2：预测器 <b>12</b> 层；只有被遮的 <b>${Nm}</b> 个位置算损失，上下文位置的输出丢掉`);
      rd(`${t}　编码器序列 ${Nc}（${(100 * Nc / N).toFixed(0)}%）　预测器序列 ${N}　按第 3 幕的短程样本`);
    } };
  }

  /* ---------- scene 5: the dense loss, weights computed live ---------- */
  function s5(G) {
    let mode = +(OPT[0] ?? 2), mi = +(OPT[1] ?? 0);
    const pitch = 0.6, X0 = -10.6, Z0 = -4.5, LAM = 0.5;
    const im = inst(BOX, 256); G.add(im);
    const P = (i, j) => [X0 + j * pitch, 0, Z0 + i * pitch];
    G.add(lab('红：被遮 token，权重 1（式 1）', [-6.1, -0.5, 6.0], { size: 18, color: '#ff8a8a' }), lab('蓝柱：可见 token 的权重 λ_i（式 3）', [-6.1, -1.5, 6.0], { size: 18, color: '#7cc8ff' }));
    /* lambda warm-up chart behind the grid */
    const CX = 1.8, CW = 10, CY = 0.8, CH = 4.0, CZ = 0, n = 120; panel(G, CX - 0.6, CY - 0.9, CZ - 0.05, CW + 1.2, CH + 2.4);
    const rr = ribbon(G, n, COL.loss, 0.07); const pts = []; for (let k = 0; k < n; k++) { const it = 135000 * k / (n - 1); pts.push([CX + CW * k / (n - 1), CY + CH * lamSched(it, LAM) / 0.5, CZ]); } rr.userData.set(pts);
    const mk = block(0.22, 0.22, 0.22, COL.white, [0, 0, CZ], { edges: false }); G.add(mk);
    G.add(lab('λ(step)：第 15k 到 30k 步从 0 升到 0.5（代码）', [CX + CW / 2, CY - 1.5, CZ], { size: 18 }), lab('0', [CX - 0.3, CY - 0.5, CZ], { size: 16 }), lab('0.5', [CX - 0.3, CY + CH, CZ], { size: 16 }), lab('30k', [CX + CW * 30 / 135, CY - 0.5, CZ], { size: 16 }), lab('135k 步', [CX + CW - 0.4, CY - 0.5, CZ], { size: 16 }));
    const ctls = [{ label: '损失', items: ['V-JEPA 2：只算被遮', '2.1：常数 λ', '2.1：λ/√d'], get: () => mode, set: k => { mode = k; } }, { label: '遮挡', items: ['短程', '长程'], get: () => mi, set: k => { mi = k; } }];
    return { ctls, readout: true, update(p) {
      const st = maskStats(mi), it = 135000 * p, lam = lamSched(it, LAM), grow = seg(p, 0.02, 0.12);
      let sumW = 0, nc = 0, nd1 = 0;
      for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
        const id = i * 16 + j, pos = P(i, j);
        if (st.full[id]) { colI(im, id, [0.88, 0.36, 0.36]); setI(im, id, [pos[0], 0.5 * 2 * grow, pos[2]], [0.52, 2 * grow + 0.01, 0.52]); continue; }
        const d = st.d[id], w = mode === 0 ? 0 : mode === 1 ? lam : lam / Math.sqrt(d); nc++; sumW += w; if (d <= 1.0001) nd1++;
        const h = 4 * w * grow + 0.04; const k = Math.min(1, w / 0.5);
        colI(im, id, [0.2 + 0.1 * (1 - k), 0.45 + 0.35 * k, 0.6 + 0.4 * k]); setI(im, id, [pos[0], h / 2, pos[2]], [0.52, h, 0.52]);
      }
      done(im);
      mk.position.set(CX + CW * p, CY + CH * lam / 0.5, CZ + 0.1);
      const mw = nc ? sumW / nc : 0;
      cap(mode === 0 ? 'V-JEPA 2：可见 token 权重为 0，它们<b>没有理由保留自己位置的信息</b>' : it < 15000 ? `第 ${Math.round(it / 1000)}k 步：λ 还没开始预热，上下文损失为 0` : mode === 1 ? `常数 λ = ${lam.toFixed(2)}：所有可见 token 一样重，模型容易学会抄上下文（表 2：SSv2 掉到 53.8）` : `λ/√d：紧挨被遮区的 ${nd1} 个 token 权重 ${lam.toFixed(2)}，越远越轻`);
      rd(`step ${Math.round(it / 1000)}k　λ = ${lam.toFixed(3)}　可见 ${nc} 个　平均 λ_i = ${mw.toFixed(3)}　损失 = L_pred + L_ctx，后者系数均值 ${mw.toFixed(3)}`);
    } };
  }

  /* ---------- scene 6: deep self-supervision ---------- */
  function s6(G) {
    let v = +(OPT[0] ?? 0);
    const V = [{ name: 'ViT-G 代码', L: 48, lay: [11, 23, 37, 47], D: 1664 }, { name: 'ViT-G 表 12', L: 48, lay: [11, 23, 35, 47], D: 1664 }, { name: 'ViT-g', L: 40, lay: [9, 19, 29, 39], D: 1408 }, { name: '不用深监督', L: 48, lay: [47], D: 1664 }];
    const slabs = []; for (let k = 0; k < 48; k++) { const b = block(3.0, 0.12, 2.4, COL.enc, [-6.5, 0, 0], { edges: false }); G.add(b); slabs.push(b); }
    const taps = [0, 1, 2, 3].map(k => { const b = block(3.4, 0.16, 2.6, COL.gold, [-6.5, 0, 0], { edges: false }); G.add(b); return b; });
    const VG = V.map(c => { const g = new THREE.Group(), th = 8.4 / c.L, nL = c.lay.length; G.add(g);
      c.lay.forEach(ly => g.add(lab(`第 ${ly + 1} 层`, [-9.6, 0.6 + (ly + 0.5) * th, 0], { size: 18 })));
      g.add(lab(`拼接 ${nL} × ${c.D} = ${nL * c.D}`, [-1.6, 9.0, 0], { size: 19 }), lab(nL > 1 ? `${nL * c.D} → ${c.D} → 384` : `${c.D} → 384`, [0.9, 2.9, 0], { size: 18 }), lab(`输出 ${nL} × ${c.D}`, [6.6, 8.2, 0], { size: 19 }));
      return g; });
    const segs = [0, 1, 2, 3].map(k => { const b = block(0.7, 1.0, 1.0, [0x38d1ff, 0x4fc98a, 0xf0963c, 0xd45fa0][k], [-1.6, 0, 0]); G.add(b); return b; });
    const mlp = block(1.0, 1.8, 1.6, COL.mlp, [0.9, 4.6, 0]), pred = block(2.2, 3.2, 2.0, COL.pred, [3.8, 4.6, 0]);
    const outs = [0, 1, 2, 3].map(k => { const b = block(0.7, 1.0, 1.0, [0x38d1ff, 0x4fc98a, 0xf0963c, 0xd45fa0][k], [6.6, 0, 0], { opacity: 0.85 }); G.add(b); return b; });
    G.add(mlp, pred, lab('融合 MLP', [0.9, 6.0, 0], { size: 19 }), lab('预测器 24 层', [3.8, 6.7, 0], { size: 19 }), lab('编码器（每片一层）', [-6.5, -0.3, 2.0], { size: 19 }));
    const f = { a: stream(G, 5, COL.gold), b: stream(G, 4, COL.mlp), c: stream(G, 4, COL.pred) };
    const ctls = [{ label: '设置', items: V.map(x => x.name), get: () => v, set: k => { v = k; } }];
    return { ctls, readout: true, update(p) {
      VG.forEach((g, k) => { g.visible = k === v; });
      const c = V[v], H = 8.4, th = H / c.L, q = (p * 14) % 1, nL = c.lay.length;
      slabs.forEach((b, k) => { b.visible = k < c.L; b.position.y = 0.6 + (k + 0.5) * th; b.scale.y = th / 0.12 * 0.8; });
      const lit = seg(p, 0.05, 0.4) * nL;
      taps.forEach((b, k) => { b.visible = k < nL; if (k < nL) { b.position.y = 0.6 + (c.lay[k] + 0.5) * th; glow(b, clamp(lit - k, 0, 1)); } });
      const segH = 1.6;
      segs.forEach((b, k) => { b.visible = k < nL; b.position.y = 4.6 - (nL - 1) * segH / 2 + k * segH; b.scale.y = 1.4; });
      outs.forEach((b, k) => { b.visible = k < nL; b.position.y = 4.6 - (nL - 1) * segH / 2 + k * segH; b.scale.y = 1.4 * seg(p, 0.6, 0.8) + 0.01; });
      f.a([[-4.8, 4.6, 0], [-1.6, 4.6, 0], [0.9, 4.6, 0]], q, seg(p, 0.35, 0.45)); f.b([[0.9, 4.6, 0], [3.8, 4.6, 0]], q, seg(p, 0.45, 0.55)); f.c([[4.9, 4.6, 0], [6.6, 4.6, 0]], q, seg(p, 0.6, 0.7));
      cap(v === 3 ? '不用深监督：只接最后一层。表 13：ADE20k 只用最后一层 34.9，用 4 层 39.1' : v === 1 ? '表 12 写 [12, 24, 36, 48]；代码是 [12, 24, <b>38</b>, 48]（从 1 数）' : `从第 ${c.lay.map(x => x + 1).join('、')} 层引出，拼起来进预测器；<b>4 层都对齐老师的同一层</b>`);
      rd(`${c.name}：${c.L} 层，宽 ${c.D}　引出 ${c.lay.map(x => x + 1).join(', ')}　拼接 ${nL * c.D} 维`);
    } };
  }

  /* ---------- scene 7: multi-modal tokenizer ---------- */
  function s7(G) {
    let v = +(OPT[0] ?? 2);
    const top = new THREE.Group(), bot = new THREE.Group(); G.add(top, bot);
    const img = (g, x, y) => { const b = block(0.1, 3.2, 3.2, COL.img, [x, y, 0]); g.add(b); return b; };
    img(top, -9.6, 6.4); img(bot, -9.6, 1.6);
    const dup = inst(BOX, 16); top.add(dup); for (let k = 0; k < 16; k++) colI(dup, k, pix(0, 1, 0.5, 0.3));
    const gA = tokGrid(top, 8, 16, 16, { x0: 3.2, y0: 6.4, z0: 0, pitch: 0.2, tz: 0.36 });
    const gB = tokGrid(bot, 1, 16, 16, { x0: 3.2, y0: 1.6, z0: 0, pitch: 0.2, tz: 0.36 });
    top.add(lab('V-JEPA 2：复制成 16 帧 → 3D 卷积', [-4.0, 4.7, 1.5], { size: 20 }), lab('8 × 16 × 16 = 2,048 个 token', [6.6, 8.8, 0], { size: 19 }));
    bot.add(lab('V-JEPA 2.1：Conv3d(1×16×16)，等价 2D 卷积', [-4.0, -0.4, 1.5], { size: 20 }), lab('16 × 16 = 256 个 token', [6.6, 4.0, 0], { size: 19 }));
    const mod = block(0.5, 0.5, 0.5, COL.img, [0.6, 1.6, 0]); bot.add(mod); bot.add(lab('+ img_mod_embed', [0.6, 2.7, 0], { size: 17 }));
    const ctls = [{ label: '看', items: ['V-JEPA 2', 'V-JEPA 2.1', '两者对比'], get: () => v, set: k => { v = k; } }];
    return { ctls, readout: true, update(p) {
      top.visible = v !== 1; bot.visible = v !== 0;
      const a = seg(p, 0.05, 0.35), b = seg(p, 0.4, 0.8);
      for (let k = 0; k < 16; k++) setI(dup, k, [L.lerp(-9.6, -6.2, a), 6.4, -k * 0.36 * a], [0.06, 3.2 * (1 - 0.6 * b) + 0.01, 3.2 * (1 - 0.6 * b) + 0.01]);
      done(dup);
      for (let n = 0; n < gA.n; n++) { const t = Math.floor(n / 256), r = n % 256; setI(gA.im, n, gA.P(t, Math.floor(r / 16), r % 16), 0.17 * b + 0.0001); } done(gA.im);
      for (let n = 0; n < 256; n++) setI(gB.im, n, gB.P(0, Math.floor(n / 16), n % 16), 0.17 * b + 0.0001); done(gB.im);
      glow(mod, 0.6 * seg(p, 0.75, 0.9));
      cap(v === 0 ? '一张图被当成 16 帧的静止视频：token 多 8 倍，还教模型“图像是不动的视频”' : v === 1 ? '图像走自己的卷积，加上图像模态向量，和视频共享同一个编码器' : '同一张 256² 的图：<b>2,048 对 256</b> 个 token，注意力配对 <b>64 倍</b>');
      rd(`2,048² / 256² = ${(2048 * 2048 / (256 * 256)).toFixed(0)}　表 1：ADE20K 40.8 → 41.4`);
    } };
  }

  /* ---------- scene 8: data and scale ---------- */
  function s8(G) {
    let v = +(OPT[0] ?? 0);
    G.add(L.grid(34, 34));
    const sub = new THREE.Group(); G.add(sub);
    const W3 = [['SSv2', 0.056, 0.170], ['Kinetics', 0.188, 0.010], ['HowTo100M', 0.318, 0.100], ['ImageNet', 0.250, 0], ['YT-1B', 0.188, 0.720]];
    const T1 = [['V-JEPA 2', 22.2, 72.8], ['+上下文', 33.8, 62.5], ['+深监督', 38.6, 72.1], ['+VisionMix', 40.8, 72.6], ['+多模态', 41.4, 72.6], ['+ViT-G', 47.1, 76.1], ['+冷却', 47.9, 77.7]];
    let bars = [], last = -1;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = v;
      const rows = v ? T1 : W3, ng = rows.length, gw = v ? 2.3 : 3.2, x0 = -15.2 + gw / 2, sA = v ? 7 / 80 : 7 / 0.75;
      rows.forEach(([nm, a, b], i) => {
        const x = x0 + i * gw; sub.add(lab(nm, [x, -0.3 - (i % 2) * 0.9, 2.2], { size: 16 }));
        [[a, v ? COL.enc : COL.dim], [b, v ? COL.loss : COL.vid]].forEach(([val, c], j) => { const bb = block(0.7, 1, 0.7, c, [x + (j - 0.5) * 0.8, 0.5, 0], { edges: false }); sub.add(bb); const l = lab(v ? val.toFixed(1) : val.toFixed(3), [x + (j - 0.5) * 0.8, 0, 0], { size: 15 }); sub.add(l); bars.push({ bb, l, h: val * sA }); });
      });
      sub.add(lab(v ? '表 1 · ADE20K mIoU（蓝）和 SSv2（黄）' : '表 3 · 视频采样权重：V-JEPA 2（灰）和 2.1（蓝）', [-6.5, 8.6, 0], { size: 20, border: 'rgba(56,209,255,.6)' }));
    }
    rebuild();
    const cubes = SIZES.map((s, k) => { const e = Math.cbrt(s.P / 1845e6) * 2.4, b = block(e, e, e, COL.tgt, [6.4 + k * 2.4, e / 2, 0]); G.add(b); G.add(lab(`${s.n}\n${(s.P / 1e6).toFixed(0)}M`, [6.4 + k * 2.4, e + 0.9, 0], { size: 17 })); return b; });
    G.add(lab('编码器参数（按代码算）', [10.0, 5.6, 0], { size: 19 }));
    const ctls = [{ label: '左图', items: ['表 3 数据权重', '表 1 逐项'], get: () => v, set: k => { v = k; } }];
    return { ctls, readout: true, update(p) {
      if (last !== v) rebuild();
      const g = seg(p, 0, 0.5); bars.forEach(({ bb, l, h }) => { const hh = Math.max(0.02, h * g); bb.scale.y = hh; bb.position.y = hh / 2; l.position.y = hh + 0.4; });
      cubes.forEach((b, k) => glow(b, 0.5 * clamp(seg(p, 0.5, 0.95) * 4 - k, 0, 1)));
      cap(v ? '加上下文损失 SSv2 <b>掉 10.3</b>，深监督拉回；之后每一步两项都涨' : '图像交给单独的进程（LVD-142M），视频权重转向 <b>YT-1B</b>，Kinetics 几乎拿掉');
      rd(v ? '表 1 前五行 ViT-L，后两行 ViT-G' : '每列权重之和都是 1.000；VisionMix 163M = 0.168 + 0.733 + 1.1 + 19 + 142');
    } };
  }

  /* ---------- scene 9: cool-down and distillation ---------- */
  function s9(G) {
    let v = +(OPT[0] ?? 0);
    const CX = -13, CW = 14, CY = 3.2, CH = 4.2, n = 200, TOT = 147000;
    panel(G, CX - 0.4, CY - 0.8, -0.1, CW + 0.8, CH + 2.0);
    const lrP = it => it < 12000 ? 1e-4 + (5.25e-4 - 1e-4) * it / 12000 : it < 135000 ? 5.25e-4 : 6e-4 + (1e-6 - 6e-4) * (it - 135000) / 12000;
    const lrC = it => it < 12000 ? 1e-4 + (6e-4 - 1e-4) * it / 12000 : it < 135000 ? 6e-4 : 6e-4 + (1e-6 - 6e-4) * (it - 135000) / 15000;
    const rP = ribbon(G, n, COL.enc, 0.07), rC = ribbon(G, n, COL.orange, 0.07);
    const mkPts = f => { const a = []; for (let k = 0; k < n; k++) { const it = TOT * k / (n - 1); a.push([CX + CW * it / TOT, CY + CH * f(it) / 6.5e-4, 0]); } return a; };
    rP.userData.set(mkPts(lrP)); rC.userData.set(mkPts(lrC));
    const xc = CX + CW * 135000 / TOT; wire(G, [[xc, CY - 0.5, 0], [xc, CY + CH + 0.6, 0]], COL.dim, { dashed: true, opacity: 0.7 });
    G.add(lab('学习率', [CX + 1.0, CY + CH + 0.9, 0], { size: 19 }), lab('冷却', [xc + 0.9, CY + CH + 0.9, 0], { size: 18 }), lab('135k', [xc, CY - 0.9, 0], { size: 16 }));
    const mk = block(0.25, 0.25, 0.25, COL.white, [0, 0, 0.1], { edges: false }); G.add(mk);
    const lL = lab('', [CX + 7, CY - 1.6, 0], { size: 18 }); G.add(lL);
    /* distillation on the right */
    const teach = block(2.6, 2.6, 2.6, COL.dim, [6.0, 6.4, 0]), stuL = block(1.6, 1.6, 1.6, COL.tgt, [10.4, 6.4, 0]), emaB = block(1.6, 1.6, 1.6, COL.ok, [10.4, 2.4, 0]), predS = block(1.0, 1.4, 1.2, COL.pred, [8.2, 4.0, 0]);
    G.add(teach, stuL, emaB, predS, lab('老师 ViT-G（冻结）', [6.0, 8.5, 0], { size: 19 }), lab('学生 ViT-L / B', [11.4, 8.6, 0], { size: 19 }), lab('学生的 EMA → 发布', [10.4, 0.9, 0], { size: 19 }), lab('12 层预测器\n只对齐最后一层 1,664 维', [7.6, 2.0, 0], { size: 16 }));
    const f = { a: stream(G, 4, COL.dim), b: stream(G, 4, COL.ok) };
    const ctls = [{ label: '学习率', items: ['论文表 12', '公开配置'], get: () => v, set: k => { v = k; } }];
    return { ctls, readout: true, update(p) {
      rP.visible = v === 0; rC.visible = v === 1;
      const it = TOT * seg(p, 0, 0.6), f0 = v ? lrC : lrP, lr = f0(it), cool = it >= 135000;
      mk.position.set(CX + CW * it / TOT, CY + CH * lr / 6.5e-4, 0.1);
      const q = (p * 14) % 1, d = seg(p, 0.62, 0.72);
      f.a([[7.3, 6.4, 0], [9.6, 6.4, 0]], q, d); f.b([[10.4, 5.6, 0], [10.4, 3.2, 0]], q, d);
      glow(stuL, 0.5 * d); glow(emaB, 0.5 * d);
      cap(p > 0.62 ? '蒸馏：老师冻结；学生的 <b>EMA</b> 不进损失，作为最终模型发布' : cool ? `冷却：视频 <b>64 帧 384²</b>（18,432 个 token），图像 512²（1,024 个）` : `第一阶段：视频 16 帧 256²（2,048 个 token），图像 256²（256 个）`);
      rd(`step ${(it / 1000).toFixed(1)}k　lr = ${lr.toExponential(2)}　${v ? '冷却末值 ' + lrC(147000).toExponential(2) + '（按代码推）' : '冷却末值 1.00e-6（论文）'}`);
    } };
  }

  /* ---------- scene 10: downstream results; every bar is a number from the paper ---------- */
  function s10(G) {
    let view = +(OPT[0] ?? 0); G.add(L.grid(34, 34)); const sub = new THREE.Group(); G.add(sub);
    const T = [
      { t: '表 8 · 稠密任务（线性探针）', g: ['NYUv2 RMSE ↓', 'KITTI RMSE ↓', 'ADE20k', 'Cityscapes', 'VOC', 'DAVIS'], s: [['V-JEPA 2 g', COL.dim, [0.642, 4.650, 24.4, 45.9, 63.9, 52.5]], ['2.1 g', COL.enc, [0.350, 2.601, 47.8, 71.8, 84.7, 68.1]], ['2.1 G', COL.vid, [0.307, 2.461, 47.9, 73.5, 85.0, 69.0]], ['DINOv3 7B', COL.dino, [0.309, 2.346, 55.9, 81.1, 86.6, 71.1]]] },
      { t: '表 9 · 整体任务（注意力探针）', g: ['SSv2', 'Diving-48', 'K400', 'IN1K'], s: [['V-JEPA 2 g', COL.dim, [77.3, 90.2, 87.3, 85.1]], ['2.1 g', COL.enc, [76.9, 89.0, 87.0, 84.8]], ['2.1 G', COL.vid, [77.7, 89.2, 87.7, 85.5]]] },
      { t: '表 4、5 · 预测', g: ['Ego4D mAP All', 'EK-100 动作 R@5'], s: [['此前最好', COL.dino, [5.67, 27.6]], ['V-JEPA 2 g', COL.dim, [6.02, 39.7]], ['2.1 g', COL.enc, [6.75, 38.4]], ['2.1 G', COL.vid, [7.71, 40.8]]] },
      { t: '表 6 · 真机抓杯子（每项 10 个任务）', g: ['到达', '抓取', '放置'], s: [['V-JEPA 2', COL.dim, [100, 60, 80]], ['2.1 同设置', COL.enc, [100, 70, 80]], ['2.1 视野 8', COL.vid, [100, 80, 80]]] },
      { t: '表 7 · 导航（越低越好）', g: ['平均 ATE', '平均 RTE', '规划时间 s'], s: [['NWM', COL.dim, [3.032, 0.696, 103.2]], ['2.1 g', COL.enc, [2.975, 0.690, 10.6]], ['2.1 G', COL.vid, [2.990, 0.688, 10.6]]] }
    ];
    let bars = [], last = -1;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = view; const v = T[view], Ng = v.g.length, Ns = v.s.length, gw = Math.min(6.5, 31 / Ng), w = Math.min(1.2, (gw - 0.7) / Ns);
      v.g.forEach((nm, i) => { const x0 = (i - (Ng - 1) / 2) * gw, mx = Math.max(...v.s.map(s => s[2][i])); sub.add(lab(nm, [x0, -0.3, 2.4], { size: 18 }));
        v.s.forEach(([sn, c, vals], j) => { const x = x0 + (j - (Ns - 1) / 2) * (w + 0.08), b = block(w, 1, w, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(String(vals[i]), [x, 0, 0], { size: 15 }); sub.add(l); bars.push({ b, l, h: vals[i] / mx * 6.5, dy: (j % 2) * 0.75 }); }); });
      v.s.forEach(([sn, c], j) => sub.add(lab(sn, [-((Ns - 1) * 3.8) / 2 + j * 3.8, -2.0, 3.2], { size: 18, color: c === COL.dim ? '#aab4c8' : css(c) })));
      sub.add(lab(v.t, [0, 8.6, -1], { size: 21, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const ctls = [{ label: '表', items: ['稠密', '整体', '预测', '机器人', '导航'], get: () => view, set: k => { view = k; } }];
    const MSG = ['深度追平 7B 的 DINOv3（0.307 对 0.309）；分割比 V-JEPA 2 高一倍，但仍低于 DINOv3', '同为 1B 时 2.1 四项都<b>略低</b>于 V-JEPA 2；2B 的 ViT-G 才略高', 'Ego4D 比 STAformer 高 36%、比 V-JEPA 2 高 28%；EK-100 只高 1.1 点', '同设置抓取 <b>+10 点</b>（1 个任务）；+20 点要换规划设置，每步 14 秒', '规划快 <b>9.7 倍</b>；平均 ATE 只低 1.4%，G 比 g 还略差'];
    return { ctls, readout: true, update(p) {
      if (last !== view) rebuild();
      const g = seg(p, 0, 0.5); bars.forEach(({ b, l, h, dy }) => { const hh = Math.max(0.02, h * g); b.scale.y = hh; b.position.y = hh / 2; l.position.y = hh + 0.4 + dy; });
      cap(MSG[view]); rd('每组柱子按组内最大值缩放；数字照录原文');
    } };
  }

  /* ---------- scene 11: how OpenWAM plugs it in ---------- */
  function s11(G) {
    let sv = +(OPT[0] ?? 0);
    G.add(L.grid(38, 38));
    /* frame instances: 0..1 = cond [f0, f0]; 2..11 = target [f0, f0, f1..f8] */
    const fr = inst(BOX, 12); G.add(fr);
    for (let k = 0; k < 12; k++) colI(fr, k, pix(k < 4 ? 0 : k - 3, 9, 0.5, 0.3));
    const lat = inst(BOX, 6); G.add(lat);
    const grid = tokGrid(G, 3, 6, 5, { x0: 4.0, y0: 4.8, z0: 1.2, pitch: 0.36, tz: 1.2 });
    const enc = block(2.4, 3.0, 2.2, COL.tgt, [-7.6, 4.8, 0]), svae = block(1.2, 1.6, 1.4, COL.mlp, [8.4, 4.8, 0]), ln = block(0.6, 1.4, 1.2, COL.dim, [10.0, 4.8, 0]), dit = block(2.2, 3.6, 2.4, COL.orange, [13.4, 4.8, 0]);
    G.add(enc, svae, ln, dit);
    G.add(lab('9 帧 384×320', [-13.6, 8.8, 0], { size: 19 }), lab('V-JEPA 2.1 ViT-g\n（冻结）', [-7.6, 7.4, 0], { size: 18 }), lab('3 个隐帧 × 24 × 20（画成 6 × 5）', [4.0, 7.4, 0], { size: 17 }), lab('LayerNorm', [10.0, 3.3, 0], { size: 16 }), lab('DiT（随机初始化）\npatch (1,2,2) → 360 个 token', [13.4, 7.8, 0], { size: 17 }));
    const ls = lab('S-VAE 1408 → 48', [8.4, 6.5, 0], { size: 17 }); G.add(ls);
    G.add(lab('条件：[f0, f0] → 1 个', [-7.6, 1.6, 2.4], { size: 17 }), lab('目标：[f0, f0, f1…f8] → 5 个，丢第 1 个，两两平均 → 2 个', [-3.6, 0.5, 2.4], { size: 17 }));
    const ctls = [{ label: 'S-VAE', items: ['不加（1,408 维）', '加（48 维）'], get: () => sv, set: k => { sv = k; } }];
    return { ctls, readout: true, update(p) {
      const b = seg(p, 0.08, 0.32), c = seg(p, 0.4, 0.58), d = seg(p, 0.62, 0.78);
      for (let k = 0; k < 12; k++) { const cond = k < 2, x0 = -15 + (cond ? k * 0.35 : 1.4 + (k - 2) * 0.35), y0 = cond ? 6.6 : 3.0, xa = L.lerp(x0, -8.2 + (k % 2) * 0.2, b), sc = 1.8 * (1 - b * 0.9) + 0.01; setI(fr, k, [xa, L.lerp(y0, 4.8, b), 0], [0.08, sc, sc]); }
      done(fr);
      /* latents: 1 cond + 5 target; the first target latent is dropped, the other four are averaged in pairs */
      for (let k = 0; k < 6; k++) {
        let pos, s;
        if (k === 0) { pos = [-4.2, 6.6, 0]; s = b; }
        else { const drop = k === 1, x = -4.2 + (k - 1) * 0.6, pair = Math.floor((k - 2) / 2), xm = -1.0 + pair * 0.9; pos = drop ? [x, 3.0 - 1.6 * c, 0] : [L.lerp(x, xm, c), 3.0, 0]; s = b * (drop ? 1 - c : 1); }
        setI(lat, k, pos, [0.45 * s + 0.0001, 1.2 * s + 0.0001, 1.2 * s + 0.0001]); colI(lat, k, k === 1 ? [0.88, 0.36, 0.36] : [0.62, 0.55, 0.95]);
      }
      done(lat);
      for (let n = 0; n < grid.n; n++) { const t = Math.floor(n / 30), r = n % 30; setI(grid.im, n, grid.P(t, Math.floor(r / 5), r % 5), 0.3 * d + 0.0001); } done(grid.im);
      svae.visible = !!sv; ls.visible = !!sv; glow(dit, 0.5 * seg(p, 0.8, 0.9)); glow(enc, 0.5 * b * (1 - c));
      const C = sv ? 48 : 1408, tokIn = 4 * C;
      cap(p < 0.36 ? '条件帧和目标帧<b>分开</b>过编码器，目标那遍前面也拼上 [f0, f0]' : p < 0.6 ? 'tubelet 2：条件 2 帧 → 1 个；目标 10 帧 → 5 个；丢掉 [f0, f0] 那个，剩下 4 个<b>两两求平均</b> → 2 个' : p < 0.8 ? '1 + 2 = 3 个隐帧，每个 24 × 20 × ' + C + '，和 Wan2.2-VAE 的分组对齐' : `每个 DiT token 输入 4 × ${C} = <b>${tokIn.toLocaleString('en-US')}</b> 维，DiT 宽 3,072；OpenWAM 图 7：<b>${sv ? '88.46' : '80.91'}%</b>`);
      rd(`C = ${C}　4C = ${tokIn}　4C / 3072 = ${(tokIn / 3072).toFixed(2)}　token 3 × 12 × 10 = 360`);
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
    L.clear(root); LABS = []; PICKS = []; lastCap = null; lastRd = null;
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
  window.__vjDebug = { maskStats, SIZES, get cap() { return $('cap').textContent; } };
})();
