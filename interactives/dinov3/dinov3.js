'use strict';
/* DINOv3 (arXiv 2508.10104) taken apart into eleven animated scenes. Sizes and hyperparameters come from the paper and from
   the official code (facebookresearch/dinov3 at 6876159); the OpenWAM hookup comes from OpenWAM commit 1dcaeea.
   Each scene's update(p) is a pure function of the timeline p plus the current toggles. Scenes 4, 5, 6, 8, 9, 10 compute
   their numbers live on toy data; those are toys and are labelled so. No DINOv3 network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { data: 0x7cb8ff, pool: 0x46506a, lvd: 0x38d1ff, ret: 0x4fc98a, pub: 0xf2c14e, cls: 0xf2c14e, reg: 0xb48cff, patch: 0x38d1ff,
    stu: 0x38d1ff, tea: 0xf0963c, gram: 0xd45fa0, head: 0x9d8cff, ok: 0x4fc98a, bad: 0xe05d5d, dim: 0x46506a, white: 0xeef2fa, text: 0x9d8cff, dit: 0xf2a0a0, svae: 0x4fc98a };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  const SCENES = [
    { n: 1, part: '§3.1 数据', title: '170 亿张图里挑出 LVD-1689M', sub: '层次 k-means 平衡采样 + 检索 + 公开数据；10% 的批次是纯 ImageNet', dur: 14, cam: [0.1, 1.15, 33, [-0.5, 3.8, 0]],
      html: dl([['数据池', 'Instagram 公开帖子，约 170 亿张'], ['聚类', 'DINOv2 嵌入，5 层 k-means：2 亿 / 800 万 / 80 万 / 10 万 / 2.5 万簇，平衡采样 → 16.89 亿'], ['检索', '找和种子数据集相似的图'], ['公开', 'ImageNet-1k、ImageNet-22k、Mapillary SLS'], ['采样', '10% 迭代整批来自 ImageNet-1k，其余混合']]) +
        '<p>聚类筛选保证“网上出现的概念都覆盖到、且不被热门概念淹没”；检索筛选保证“和下游任务相关的概念多一些”。表 1 显示两者各有胜负，混在一起五项全赢。</p>' +
        '<p>右边的柱子是表 1（20 万步短训练）。可以切换看五个指标。</p>' + guess('左边点云的簇数按对数缩小画，不是真实数量。') + src('§3.1 · 表 1') },
    { n: 2, part: '§3.2 网络', title: 'ViT：patch 16、4 个 register、RoPE', sub: '序列 = [CLS, 4 个 register, patch]；RoPE 只旋转 patch，训练时坐标框随机缩放', dur: 14, cam: [0.25, 1.15, 30, [0, 4.4, 0]],
      html: dl([['patch', '16 × 16 像素一个 token'], ['特殊 token', '1 个 CLS + 4 个 register（代码叫 storage token）'], ['ViT-B/16', '768 宽、12 层、12 头、MLP 3072，86M'], ['ViT-7B', '4096 宽、40 层、32 头、SwiGLU 8192，6.7B'], ['RoPE', '坐标归一到 [−1, 1]，训练时乘 s ∈ [0.5, 2]（代码对数均匀采样）']]) +
        '<p>register 是 Darcet 等提出的：给网络几个“草稿纸” token，让它不必占用背景 patch 来做全局通信，否则那些背景 patch 会变成高范数异常值（附录 A.1）。下游用 patch 特征时，CLS 和 register 一起丢掉。</p>' +
        '<p>RoPE 不加位置向量，而是按坐标旋转 q、k。代码里高和宽<b>分别</b>归一化（<code>separate</code>），所以 24 × 20 这样的非正方形网格也铺满 [−1, 1]。CLS 和 register 不旋转。</p>' + src('§3.2 · 表 2 · vision_transformer.py · hub/backbones.py · rope_position_encoding.py') },
    { n: 3, part: '§3.2 损失', title: 'DINO + iBOT 自蒸馏，教师是学生的 EMA', sub: '2 个全局裁切 + 8 个局部裁切；学生看遮住的 patch，去猜教师的输出', dur: 15, cam: [0.1, 1.12, 32, [0, 4.4, 0]],
      html: dl([['裁切', '2 × 256 px（全局）+ 8 × 112 px（局部），每图 904 个 patch'], ['DINO', '学生所有裁切的 CLS 对齐教师全局裁切的 CLS'], ['iBOT', '学生全局裁切遮住 10% 到 50% 的 patch（概率 0.5），预测教师在这些位置的输出'], ['中心化', 'Sinkhorn-Knopp'], ['Koleo', '0.1 权重，16 个 CLS 一组，让特征散开'], ['教师', '学生权重的 EMA，只看全局裁切']]) +
        '<p>式 (1)：\\(\\mathcal L_{\\rm Pre}=\\mathcal L_{\\rm DINO}+\\mathcal L_{\\rm iBOT}+0.1\\,\\mathcal L_{\\rm DKoleo}\\)。DINO 管全局（整图的意思），iBOT 管局部（每个 patch 的意思）。</p>' +
        '<p>每批 4096 张图：\\(4096\\times(2\\times256+8\\times49)=3{,}702{,}784\\)，就是论文的 370 万 token。</p>' + guess('被遮的 patch 位置是随机画的。') + src('§3.2 · 附录 C · ssl_meta_arch.py') },
    { n: 4, part: '§4.1 问题', title: '训练越久，patch 特征越像 CLS', sub: '全局分类一直涨，稠密分割在 20 万步后下降', dur: 14, cam: [0.1, 1.2, 30, [0, 4.6, 0]],
      html: '<p>图 5、图 6 的现象：20 万步时参照 patch 的相似度图干净、局部；100 万步时很多无关 patch 也亮起来，CLS 和 patch 的余弦相似度越来越高。分类精度一直在涨，VOC 分割却在约 20 万步后下降，7B 最后低于起点。</p>' +
        '<p>这不是“高范数 patch”问题：加了 register 后 patch 范数一直稳定。</p>' +
        toyb('左边热图：16 × 16 个 patch 分三块区域，每块一个原型向量加噪声。“训练进度”用系数 α 把一个公共方向（像 CLS）和噪声混进去，热图是参照 patch（白框）与所有 patch 的余弦相似度，读数当场算。') +
        guess('右边两条曲线只是仿照图 5c 的形状，不是读数。') + src('§4.1 · 图 5 · 图 6') },
    { n: 5, part: '§4.2 核心', title: 'Gram anchoring：只约束相似度结构', sub: '当场对式 (2) 做梯度下降；特征可以整体旋转，损失不变', dur: 16, cam: [0, 1.22, 31, [0, 4.6, 0]], camE: [0, 1.25, 33, [0, 6.0, 0]],
      html: '<div class="eq" style="margin:4px 0">\\(\\mathcal L_{\\rm Gram}=\\|\\mathbf X_S\\mathbf X_S^{\\top}-\\mathbf X_G\\mathbf X_G^{\\top}\\|_F^2\\)</div>' +
        dl([['X_S', '学生 P × d 的 L2 归一化 patch 特征'], ['X_G', 'Gram 教师（早期迭代的教师）的特征'], ['何时', '100 万步之后，只在全局裁切上'], ['权重', 'w_Gram = 2；代码里 1000 步内从 0 升到 2'], ['更新', '每 1 万步把 Gram 教师换成当前 EMA 教师，最多 3 次']]) +
        '<p>左右两块是 64 × 64 的 Gram 矩阵（教师、学生），下面是参照 patch 的相似度图。拖进度条就是在走梯度下降：学生的 Gram 矩阵逐渐变成教师的样子，相似度图变干净。</p>' +
        '<p><b>关键：</b>学生特征和教师特征本身的平均余弦一直在 0 附近，因为学生是从“旋转过的教师”出发的。Gram 损失只看两两相似度，旋转不改变它（开关“教师整体旋转”可以验证：损失差为 0）。这就是论文说的“局部特征可以自由移动，只要相似度结构不变”。</p>' +
        '<p>开关“损失写法”：式 (2) 是平方和，代码 <code>gram_loss.py</code> 是 MSE 平均，差 \\(P^2\\) 倍（这里 4096 倍，真实 256 px 裁切是 65,536 倍）。</p>' +
        toyb('64 个 patch、8 维、80 步梯度下降，步长 0.003，每步重新归一化。') + src('§4.2 式 (2)(3) · 附录 C · loss/gram_loss.py · ssl_meta_arch.py') },
    { n: 6, part: '§4.3', title: 'Gram 教师吃 2 倍分辨率，再下采样', sub: '512 输入 → 32 × 32 特征 → 双三次缩到 16 × 16 → 算 Gram', dur: 14, cam: [0.1, 1.2, 30, [0, 4.6, 0]],
      html: '<p>高分辨率输入给出更细的特征；再下采样相当于对邻近 patch 加权平均，压掉孤立的异常 patch。下采样后的 Gram 矩阵替换式 (2) 里的 \\(\\mathbf X_G\\mathbf X_G^\\top\\)，记作 \\(\\mathcal L_{\\rm HRef}\\)。</p>' +
        dl([['×1', 'ADE 53.6'], ['×2（200k 教师）', 'ADE 55.7，NYU 0.281'], ['×2（100k 教师）', 'ADE 55.7'], ['×2（1M 教师）', 'ADE 54.9，教师自己已经不干净'], ['基线', 'ADE 50.3']]) +
        '<p>柱子是图 9b 的 ADE20k mIoU。</p>' +
        toyb('三张热图分别是 16 × 16 原生、32 × 32 原生、32 × 32 经 2 × 2 平均下采样到 16 × 16 的玩具特征相似度图；“同区域邻居余弦”当场算。2 × 2 平均是双三次插值的近似。') + src('§4.3 · 图 9 · ssl_meta_arch.py 第 494–510 行') },
    { n: 7, part: '§5.1', title: '高分辨率适配：混合尺寸再训一小段', sub: '五组（全局, 局部, Gram 教师）裁切按概率采样；Gram 教师固定为 7B 自己', dur: 14, cam: [0.1, 1.15, 30, [0, 4.6, 0]],
      html: dl([['(512, 112, 768)', 'p = 0.3'], ['(768, 112, 1152)', 'p = 0.3'], ['(768, 168, 1152)', 'p = 0.3'], ['(768, 224, 1152)', 'p = 0.05'], ['(768, 336, 1152)', 'p = 0.05']]) +
        '<p>每次迭代抽一组，方块按像素边长画。Gram 教师是全局裁切的 1.5 倍（不是 §4.3 的 2 倍）。论文说没有 Gram 这一步，稠密任务会明显变差。</p>' +
        '<p>论文写训 1 万步；代码配置是 30 个 epoch × 1000 = 3 万步，Gram 权重 1.5 论文没写（精读页读者注 8）。适配后 4K 以上输入的特征图仍稳定（图 4）。</p>' + src('§5.1 · 附录 C · dinov3_vit7b16_high_res_adapt.yaml') },
    { n: 8, part: '§5.2', title: '一个 7B 教师，同时教四个学生', sub: '所有卡一起算教师，all-gather，再分组训练学生', dur: 15, cam: [0.1, 1.15, 31, [0, 4.4, 0]],
      html: dl([['教师', '固定的 7B（不是 EMA），不用 Gram'], ['损失', '与第一阶段相同'], ['分组', '示例配置：ViT-S 48 卡、S+ 48、B 80、L 120，共 296'], ['batch', '全局 1920'], ['流程', '100 万步 + 25 万步冷却 + 高分辨率（无 Gram）']]) +
        '<p>多学生的好处：教师推理的总量固定，被所有卡分摊。每张卡的教师代价从 \\(B/N_{S_i}\\cdot C_T\\) 降到 \\(B/N_T\\cdot C_T\\)。开关可以对比“四个学生分开蒸馏”和“一起蒸馏”的每卡代价。</p>' +
        guess('代价估算：教师每样本按图 16a 的 3550 GFLOPs（7B @256），学生训练按前向 × 3。只比较相对大小。') + src('§5.2 · 图 12 · 图 16a · dinov3_vitl16_lvd1689m_distilled.yaml') },
    { n: 9, part: '§5.3 · §7.3', title: 'dino.txt：给冻结的 DINOv3 配一个文本编码器', sub: 'CLS 和 patch 均值拼起来，与文本做对比学习', dur: 13, cam: [0.1, 1.15, 32, [-0.5, 3.8, 0]],
      html: dl([['视觉', 'ViT-L 冻结，上面加 2 个可训练 Transformer 块'], ['图像向量', 'CLS ⊕ mean(patch)'], ['文本', '从头训练的文本 Transformer'], ['损失', '图文对比（LiT 范式）']]) +
        '<p>把 patch 均值也拼进去，局部特征也被拉向文本空间，所以开放词汇分割特别好：ADE20k 24.7、Cityscapes 36.9 mIoU，明显高于 CLIP、SigLIP 2、PE（表 16）。全局零样本分类略逊于 SigLIP 2 和 PE。</p>' +
        toyb('中间的 B × B 相似度矩阵是随机生成的，只示意“对角线是配对”。') + src('§5.3 · §7.3 表 16 · eval/text/configs/dinov3_vitl_text.yaml') },
    { n: 10, part: '§6 用法', title: '冻结骨干，patch 特征拿来就用', sub: '线性探针、标签传播、PCA、轻量解码器', dur: 13, cam: [0.1, 1.15, 30, [0, 4.6, 0]],
      html: dl([['线性探针', 'patch 特征 → 线性层 → 每个 patch 一个类别 / 深度（表 3）'], ['非参数', '相似度直接用：3D 对应、TokenCut 物体发现、视频标签传播（表 4、5）'], ['可视化', 'PCA 前 3 维当 RGB（图 13）'], ['解码器', 'Plain-DETR、Mask2Former、DPT、VGGT，骨干都冻结（表 10 到 13）']]) +
        '<p>附录 A.2 的提醒：最后一层特征先过最后的 LayerNorm（压掉少数异常大的通道）；用中间层时改用 BatchNorm 或 PCA。</p>' +
        '<p>柱子是表 3 的 ADE20k 线性探针 mIoU。</p>' + toyb('左边是对第 4 幕玩具特征（未退化）当场做的 PCA 着色。') + src('§6.1 · 表 3 · 附录 A.2') },
    { n: 11, part: 'OpenWAM', title: 'OpenWAM：ViT-B/16 逐帧，拼成视频隐变量', sub: '9 帧 → 每帧 24 × 20 × 768 → 首帧单独、其余每 4 帧平均 → 无参 LN →（S-VAE 48 维）→ DiT', dur: 16, cam: [0.1, 1.15, 33, [0, 4.4, 0]],
      html: dl([['检查点', 'dinov3-vitb16-pretrain-lvd1689m，冻结'], ['输入', '9 帧 × 3 × 384 × 320，ImageNet 归一化'], ['每帧', '1 + 4 + 480 个 token，丢掉前 5 个'], ['时间', '帧 0 单独；帧 1–4、5–8 各平均 → 3 个隐帧'], ['归一化', '每个 token 一次无参 LayerNorm'], ['S-VAE', '可选，768 → 48'], ['DiT', 'Conv3d(C, 3072, 1×2×2) → 360 个 token，每个 4C 维']]) +
        '<p>开关切换是否加 S-VAE。不加时 4C = 3072，正好等于 DiT 宽度，在 RAE 说的“宽度 ≥ token 维度”的边界上；加了以后 4C = 192，和 Wan2.2-VAE 一样。成功率 76.42% 对 90.18%（OpenWAM 图 7）。</p>' +
        '<p>详细解释见 <a href="../../papers/openwam.html#qa-enc" target="_top">OpenWAM 页 问 2</a>。</p>' + src('OpenWAM commit 1dcaeea：openwam/model/video_backbone/encoder/dinov3.py；configs/model/video_backbone/encoder/dinov3.yaml') }
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
    if (window.MathJax?.typesetPromise) window.MathJax.typesetPromise([$('infoBody')]).catch(() => {});
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
  /* a label whose text changes: rebuilt only when the string changes */
  function dyn(G, pos, o = {}) {
    let t = null, sp = null;
    return (txt, at) => { if (at) pos = at; if (txt !== t) { t = txt; if (sp) { G.remove(sp); L.dispose(sp); LABS = LABS.filter(x => x !== sp); } sp = lab(txt, pos, o); G.add(sp); } else if (at && sp) sp.position.set(...at); };
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
  function bar(G, x, z, w, color, o = {}) { const m = block(w, 1, o.d ?? w, color, [x, 0.5, z], { edges: false }); G.add(m); m.userData.set = h => { const v = Math.max(0.001, h); m.scale.y = v; m.position.y = (o.y0 ?? 0) + v / 2; }; return m; }
  function ribbon(G, n, color, w = 0.08) {
    const pos = new Float32Array(n * 6), idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); m.frustumCulled = false; G.add(m);
    m.userData.set = pts => { const k = Math.min(n, pts.length); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)]; pos[i * 6] = q[0]; pos[i * 6 + 1] = q[1] - w / 2; pos[i * 6 + 2] = q[2]; pos[i * 6 + 3] = q[0]; pos[i * 6 + 4] = q[1] + w / 2; pos[i * 6 + 5] = q[2]; } g.attributes.position.needsUpdate = true; };
    return m;
  }
  /* viridis-like colour map for heatmaps */
  const VIR = [[0.267, 0.005, 0.329], [0.229, 0.322, 0.546], [0.128, 0.567, 0.551], [0.369, 0.789, 0.383], [0.993, 0.906, 0.144]];
  function vir(t) { t = clamp(t, 0, 1) * (VIR.length - 1); const i = Math.min(VIR.length - 2, Math.floor(t)), f = t - i; return [0, 1, 2].map(k => L.lerp(VIR[i][k], VIR[i + 1][k], f)); }
  /* an n×m heatmap of flat boxes in the xy plane, top-left at (x0, y0) */
  function heat(G, n, m, x0, y0, z, cell, gap = 0.08) {
    const im = inst(BOX, n * m); G.add(im);
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { setI(im, i * m + j, [x0 + (j + 0.5) * cell, y0 - (i + 0.5) * cell, z], [cell * (1 - gap), cell * (1 - gap), 0.06]); colI(im, i * m + j, [0.2, 0.2, 0.3]); }
    done(im);
    return { im, set(vals, map = vir) { for (let k = 0; k < n * m; k++) colI(im, k, map(vals[k])); done(im); } };
  }
  function frame(G, x0, y0, w, h, z, color, op = 0.7) { return wire(G, [[x0, y0, z], [x0 + w, y0, z], [x0 + w, y0 - h, z], [x0, y0 - h, z], [x0, y0, z]], color, { opacity: op }); }

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

  /* ---------- toy feature fields, computed once ---------- */
  const rng = L.rng, gauss = L.gauss;
  const nrm = v => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return v.map(x => x / s); };
  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  /* region map shared by the toys: 0 = sky (top), 1 = object (disc), 2 = ground */
  const regionOf = (u, v) => { const du = u - 0.56, dv = v - 0.48; if (du * du + dv * dv < 0.075) return 1; return u < 0.38 ? 0 : 2; };
  let FIELD_ = null;
  function field() {
    if (FIELD_) return FIELD_;
    const D = 16, r = rng(11), protos = [0, 1, 2].map(() => nrm(Array.from({ length: D }, () => gauss(r))));
    const c = nrm(Array.from({ length: D }, () => gauss(r)));
    const mk = (N, seed, sig) => { const q = rng(seed), out = []; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const k = regionOf((i + 0.5) / N, (j + 0.5) / N); out.push({ k, t: protos[k].map(x => x + 0.12 * gauss(q)), e: Array.from({ length: D }, () => gauss(q)) }); } return out; };
    const g16 = mk(16, 21), g32 = mk(32, 22);
    FIELD_ = { D, protos, c, g16, g32 };
    return FIELD_;
  }
  /* degraded features: alpha mixes in the common (CLS-like) direction and noise */
  function degrade(cells, alpha, noise) { const F = field(); return cells.map(x => nrm(x.t.map((v, i) => (1 - alpha) * v + alpha * 1.6 * F.c[i] + noise * 0.18 * x.e[i]))); }
  function simMap(X, ref) { const r = X[ref]; return X.map(x => dot(x, r)); }

  let GRAM_ = null;
  function gramToy() {
    if (GRAM_) return GRAM_;
    const N = 8, P = 64, D = 8, r = rng(7);
    const protos = [0, 1, 2].map(() => nrm(Array.from({ length: D }, () => gauss(r))));
    const T = []; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const k = regionOf((i + 0.5) / N, (j + 0.5) / N); T.push(nrm(protos[k].map(x => x + 0.18 * gauss(r)))); }
    const Q = []; for (let a = 0; a < D; a++) { let v = Array.from({ length: D }, () => gauss(r)); for (const q of Q) { const d = dot(v, q); v = v.map((x, i) => x - d * q[i]); } Q.push(nrm(v)); }
    const rot = x => Q.map(q => dot(q, x));
    const c = nrm(Array.from({ length: D }, () => gauss(r)));
    const gram = A => A.map(a => A.map(b => dot(a, b)));
    const GT = gram(T);
    const lossF = A => { const G = gram(A); let s = 0; for (let i = 0; i < P; i++) for (let j = 0; j < P; j++) s += (G[i][j] - GT[i][j]) ** 2; return s; };
    let X = T.map(t => nrm(rot(t).map((x, i) => x + 0.9 * c[i] + 0.55 * gauss(r))));
    const K = 80, eta = 0.003, snaps = [X];
    for (let it = 1; it <= K; it++) {
      const G = gram(X);
      X = X.map((x, i) => { const gr = new Array(D).fill(0); for (let j = 0; j < P; j++) { const e = G[i][j] - GT[i][j]; for (let k = 0; k < D; k++) gr[k] += 4 * e * X[j][k]; } return nrm(x.map((v, k) => v - eta * gr[k])); });
      snaps.push(X);
    }
    const info = snaps.map(A => ({ G: gram(A), L: lossF(A), fc: A.reduce((s, a, i) => s + dot(a, T[i]), 0) / P }));
    const rotT = T.map(rot);
    GRAM_ = { N, P, D, T, GT, snaps, info, K, lossRot: lossF(rotT), fcRot: rotT.reduce((s, a, i) => s + dot(a, T[i]), 0) / P };
    return GRAM_;
  }

  /* ---------- scene 1: data curation ---------- */
  function s1(G) {
    const pool = block(4.2, 4.2, 4.2, COL.pool, [-11, 2.6, 0], { opacity: 0.35 }); G.add(pool);
    G.add(lab('Instagram 公开图片\n约 170 亿张', [-11, 5.6, 0], { size: 19 }));
    const pts = inst(BALL, 600); const r = rng(3); const P0 = [];
    for (let i = 0; i < 600; i++) { const p = [-11 + (r() - 0.5) * 3.8, 2.6 + (r() - 0.5) * 3.8, (r() - 0.5) * 3.8]; P0.push(p); setI(pts, i, p, 0.07); colI(pts, i, hex3(COL.data)); }
    done(pts); G.add(pts);
    const lv = ['2 亿簇', '800 万', '80 万', '10 万', '2.5 万'], LV = [];
    for (let k = 0; k < 5; k++) { const y = 0.9 + k * 1.15, w = 4.2 - k * 0.65; const pl = block(w, 0.12, 1.6, COL.lvd, [-5.6, y, 0], { opacity: 0.55 }); G.add(pl); LV.push(pl); G.add(lab(lv[k], [-2.6, y, 0], { size: 15 })); }
    G.add(lab('层次 k-means（DINOv2 嵌入）', [-5.6, 7.4, 0], { size: 17 }));
    const lvd = block(1.8, 1.8, 1.8, COL.lvd, [3.4, 6.0, 0]), ret = block(1.5, 1.2, 1.5, COL.ret, [3.4, 3.3, 0]), pub = block(1.5, 1.0, 1.5, COL.pub, [3.4, 0.8, 0]);
    G.add(lvd, ret, pub);
    G.add(lab('LVD-1689M\n16.89 亿', [3.4, 7.7, 0], { size: 15 }), lab('检索筛选', [3.4, 4.4, 0], { size: 15 }), lab('ImageNet 等', [3.4, 1.9, 0], { size: 14 }));
    const sampler = block(1.4, 1.4, 1.4, COL.head, [7.0, 3.0, 0]); G.add(sampler); G.add(lab('采样器', [7.0, 4.2, 0], { size: 16 }));
    const batch = inst(BOX, 10); G.add(batch);
    const fA = stream(G, 6, COL.data, 0.12), fB = stream(G, 4, COL.ret, 0.1), fC = stream(G, 4, COL.pub, 0.1);
    /* Table 1 bars */
    const T1 = { cols: ['IN1k k-NN', 'IN1k 线性', 'ObjectNet', 'iNat 2021', 'Paris 检索'], rows: [['原始', [80.1, 84.8, 70.3, 70.1, 63.3]], ['聚类', [79.4, 85.4, 72.3, 81.3, 85.2]], ['检索', [84.0, 86.7, 70.7, 86.0, 82.7]], ['混合（本文）', [84.6, 87.2, 72.8, 87.0, 85.9]]] };
    const cols4 = [COL.dim, COL.lvd, COL.ret, 0xf2c14e];
    const BX = i => 10.6 + i * 1.25;
    const bars = T1.rows.map((rw, i) => bar(G, BX(i), 0, 0.8, cols4[i]));
    T1.rows.forEach((rw, i) => G.add(lab(['原始', '聚类', '检索', '混合'][i], [BX(i), -0.7 - (i % 2) * 0.7, 0.9], { size: 13 })));
    const vlab = T1.rows.map((rw, i) => dyn(G, [BX(i), 0, 0.4], { size: 13 }));
    const title = dyn(G, [12.4, 7.6, 0], { size: 15, border: 'rgba(56,209,255,.7)' });
    let metric = 4;
    const api = {
      ctls: [{ label: '表 1 指标', items: T1.cols, get: () => metric, set: k => { metric = k; } }],
      update(p) {
        const q = (p * 12) % 1;
        const vals = T1.rows.map(r => r[1][metric]), lo = Math.min(...vals) - 3;
        bars.forEach((b, i) => { const h = (vals[i] - lo) / (100 - lo) * 5.5 * seg(p, 0.05, 0.3); b.userData.set(h); vlab[i](vals[i].toFixed(1), [BX(i), h + 0.5, 0.4]); });
        title(`表 1 · ${T1.cols[metric]}`);
        const kk = seg(p, 0.0, 0.45);
        for (let i = 0; i < 600; i++) { const keep = (i % 7 === 0) || kk < 0.2; const a = P0[i]; const t = keep ? kk : 0; setI(pts, i, [L.lerp(a[0], -5.6 + (a[0] + 11) * 0.5, t), L.lerp(a[1], 0.9 + (i % 5) * 1.15, t), a[2] * (1 - 0.6 * t)], keep ? 0.08 : 0.05 * (1 - kk)); }
        done(pts);
        LV.forEach((pl, k) => glow(pl, 0.6 * seg(p, 0.08 + k * 0.06, 0.14 + k * 0.06)));
        fA([[-3.3, 3, 0], [1.8, 6.0, 0], [2.4, 6.0, 0]], q, seg(p, 0.35, 0.45));
        fB([[-8.6, 1.4, -1], [1.0, 3.3, 0], [2.5, 3.3, 0]], q, seg(p, 0.4, 0.5));
        /* batches out of the sampler: one in ten is homogeneous ImageNet-1k (gold) */
        const iter = Math.floor(p * 40), homo = (iter % 10) === 3;
        for (let k = 0; k < 10; k++) { setI(batch, k, [6.2 + (k % 5) * 0.45, 1.0 + Math.floor(k / 5) * 0.45, 0], seg(p, 0.5, 0.56) * 0.36); colI(batch, k, hex3(homo ? COL.pub : [COL.lvd, COL.ret, COL.pub, COL.lvd, COL.lvd][(k + iter) % 5])); }
        done(batch);
        fC([[4.2, 0.8, 0], [6.4, 3, 0], [7.0, 3, 0]], q, seg(p, 0.45, 0.55));
        cap(p < 0.45 ? '170 亿张 → DINOv2 嵌入 → <b>5 层层次 k-means</b> → 每个簇均衡地取 → LVD-1689M' : (homo ? '这一批是<b>纯 ImageNet-1k</b>（占全部迭代的 10%）' : '这一批是<b>混合批</b>：LVD-1689M、检索数据、公开数据按比例混合'));
      }
    };
    return api;
  }

  /* ---------- scene 2: the ViT ---------- */
  function s2(G) {
    const img = block(4.6, 4.6, 0.12, 0x3a4a68, [-11, 4.6, 0]); G.add(img);
    const grid = inst(BOX, 256); G.add(grid);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { const k = regionOf((i + 0.5) / 16, (j + 0.5) / 16); setI(grid, i * 16 + j, [-11 - 2.3 + (j + 0.5) * 0.2875, 4.6 + 2.3 - (i + 0.5) * 0.2875, 0.1], [0.25, 0.25, 0.05]); colI(grid, i * 16 + j, [[0.45, 0.65, 0.9], [0.95, 0.75, 0.3], [0.35, 0.65, 0.35]][k]); }
    done(grid);
    G.add(lab('输入图像，patch 16', [-11, 7.6, 0], { size: 18 }));
    /* token row */
    const tok = inst(BOX, 26); G.add(tok);
    const stack = new THREE.Group(); G.add(stack);
    const tokLab = dyn(G, [-1.5, 0.3, 1.2], { size: 16 });
    const modelLab = dyn(G, [4.5, 9.4, 0], { size: 18, border: 'rgba(242,193,78,.8)' });
    G.add(lab('CLS', [-6.6, 0.6, 1.0], { size: 15, color: '#f2c14e' }), lab('4 register', [-4.6, 2.6, 1.0], { size: 15, color: '#c9a8ff' }), lab('patch token', [-0.5, 2.5, 1.0], { size: 15, color: '#7fd8ff' }));
    /* RoPE box */
    const rope = inst(BALL, 64); G.add(rope);
    const ropeFrame = frame(G, 8.4, 6.9, 4.8, 4.8, 0, 0xf2c14e, 0.4);
    G.add(lab('RoPE 坐标框 [−1, 1]', [10.8, 7.6, 0], { size: 16 }));
    const sLab = dyn(G, [10.8, 1.4, 0], { size: 16 });
    let model = 0, inp = 0;
    const INP = [[256, 256, '256 × 256'], [512, 512, '512 × 512'], [384, 320, 'OpenWAM 384 × 320']];
    let builtFor = -1;
    function buildStack() {
      L.clear(stack); const n = model ? 40 : 12, h = model ? 0.11 : 0.36;
      for (let k = 0; k < n; k++) { const b = block(5.2, h * 0.8, 1.6, model ? 0xd45fa0 : 0x9d8cff, [4.5, 2.7 + k * h, 0], { edgeOpacity: 0.15 }); stack.add(b); }
      builtFor = model;
    }
    return {
      ctls: [{ label: '模型', items: ['ViT-B/16（OpenWAM 用）', 'ViT-7B 教师'], get: () => model, set: k => { model = k; } },
        { label: '输入', items: INP.map(x => x[2]), get: () => inp, set: k => { inp = k; } }],
      update(p) {
        if (builtFor !== model) buildStack();
        const [H, W] = INP[inp], nH = H / 16, nW = W / 16, N = nH * nW;
        modelLab(model ? 'ViT-7B：40 层 · 宽 4096 · 32 头 · SwiGLU 8192 · 6.7B' : 'ViT-B/16：12 层 · 宽 768 · 12 头 · MLP 3072 · 86M');
        tokLab(`序列长度 1 + 4 + ${nH} × ${nW} = ${5 + N}`);
        const k = seg(p, 0.05, 0.35);
        for (let i = 0; i < 26; i++) {
          const kind = i === 0 ? 0 : i < 5 ? 1 : 2; const x = -6.2 + i * 0.42 + (kind === 2 ? 0.5 : 0);
          setI(tok, i, [L.lerp(-11, x, k), L.lerp(4.6, 1.6, k), 0.4], kind === 2 ? 0.3 : 0.34);
          colI(tok, i, hex3([COL.cls, COL.reg, COL.patch][kind]));
        }
        done(tok);
        stack.children.forEach((b, j) => glow(b, ((p * 3) % 1) * stack.children.length > j ? 0.5 : 0));
        /* RoPE: s cycles log-uniformly in [1/2, 2] */
        const s = Math.pow(2, Math.sin(p * Math.PI * 4)), cx = 10.8, cy = 4.5;
        const gh = Math.min(8, nH), gw = Math.min(8, nW);
        for (let i = 0; i < 64; i++) { const a = Math.floor(i / 8), b = i % 8; const vis = a < gh && b < gw; const u = 2 * (a + 0.5) / gh - 1, v = 2 * (b + 0.5) / gw - 1; setI(rope, i, [cx + v * 2.4 * s * 0.5, cy - u * 2.4 * s * 0.5, 0], vis ? 0.09 : 0.0001); colI(rope, i, hex3(0xf2c14e)); }
        done(rope);
        sLab(`训练时 s = ${s.toFixed(2)}（推理 s = 1）`);
        cap(p < 0.35 ? '图像切成 16 × 16 的 patch，每个 patch 一个 token，前面加 <b>1 个 CLS</b> 和 <b>4 个 register</b>' : 'Transformer 层里 RoPE 按坐标旋转 q、k；训练时坐标框随机缩放 <b>s ∈ [0.5, 2]</b>，模型就不依赖某一种分辨率');
      }
    };
  }

  /* ---------- scene 3: multi-crop + DINO / iBOT ---------- */
  function s3(G) {
    const img = block(3.4, 3.4, 0.1, 0x3a4a68, [-12, 4.4, 0]); G.add(img); G.add(lab('一张图', [-12, 6.6, 0], { size: 17 }));
    const gl = [0, 1].map(k => block(2.0, 2.0, 0.1, COL.tea, [-8.2, 6.4 - k * 2.4, 0], { opacity: 0.85 }));
    const lo = Array.from({ length: 8 }, (_, k) => block(0.9, 0.9, 0.1, COL.stu, [-8.8 + (k % 4) * 1.05, 1.6 - Math.floor(k / 4) * 1.1, 0], { opacity: 0.85 }));
    G.add(...gl, ...lo);
    G.add(lab('2 个全局 256', [-8.2, 8.0, 0], { size: 15 }), lab('8 个局部 112', [-7.2, -0.9, 0], { size: 15 }));
    const stu = block(3.0, 2.2, 1.6, COL.stu, [-1.5, 2.2, 0]), tea = block(3.0, 2.2, 1.6, COL.tea, [-1.5, 6.8, 0]);
    G.add(stu, tea, lab('学生 ViT', [-1.5, 0.6, 0], { size: 17 }), lab('教师 ViT（EMA）', [-1.5, 8.3, 0], { size: 17 }));
    const hd = [['DINO 头', 3.6, 1.2], ['iBOT 头', 3.6, 3.2], ['DINO 头', 3.6, 6.2], ['iBOT 头', 3.6, 8.0]].map(([t, x, y]) => { const b = block(1.8, 0.8, 1.0, COL.head, [x, y, 0]); G.add(b, lab(t, [x, y + 0.75, 0], { size: 14 })); return b; });
    const sk = block(1.6, 0.8, 1.0, 0xf2c14e, [6.6, 7.1, 0]); G.add(sk, lab('Sinkhorn-Knopp', [6.6, 7.9, 0], { size: 14 }));
    const lossB = [['L_DINO', 10.4, 6.0], ['L_iBOT', 10.4, 4.0], ['0.1 L_Koleo', 10.4, 2.0]].map(([t, x, y]) => { const b = block(2.2, 0.9, 1.0, COL.bad, [x, y, 0]); G.add(b, lab(t, [x, y + 0.85, 0], { size: 15 })); return b; });
    /* masked patches on the student's global crop */
    const mk = inst(BOX, 64); G.add(mk); const r = rng(5), masked = Array.from({ length: 64 }, () => r());
    const fl = { a: stream(G, 5, COL.tea), b: stream(G, 6, COL.stu), c: stream(G, 4, COL.head), d: stream(G, 4, COL.head), e: stream(G, 4, COL.bad) };
    const ema = wire(G, [[-0.2, 3.4, 0.9], [0.6, 5.0, 0.9], [-0.2, 5.6, 0.9]], 0xf2c14e, { opacity: 0.8, dashed: true });
    G.add(lab('EMA 0.999（代码 0.994）', [-1.5, 4.5, 1.0], { size: 13 }));
    const tl = dyn(G, [1.5, -1.8, 0], { size: 15, border: 'rgba(242,193,78,.7)' });
    return {
      update(p) {
        const q = (p * 14) % 1, ratio = 0.1 + 0.4 * ((Math.sin(p * 9) + 1) / 2);
        for (let i = 0; i < 64; i++) { const a = Math.floor(i / 8), b = i % 8; const on = masked[i] < ratio && seg(p, 0.25, 0.3) > 0; setI(mk, i, [-8.2 - 0.875 + (b + 0.5) * 0.25, 6.4 + 0.875 - (a + 0.5) * 0.25, 0.08], on ? [0.22, 0.22, 0.04] : 0.0001); colI(mk, i, [0.1, 0.1, 0.12]); }
        done(mk);
        fl.a([[-8.2, 5.2, 0], [-4, 6.8, 0], [-3, 6.8, 0]], q, seg(p, 0.05, 0.12));
        fl.b([[-8, 1.0, 0], [-4, 2.2, 0], [-3, 2.2, 0]], q, seg(p, 0.05, 0.12));
        fl.c([[0, 6.8, 0], [2.7, 6.2, 0]], q, seg(p, 0.15, 0.2)); fl.d([[0, 2.2, 0], [2.7, 1.2, 0]], q, seg(p, 0.15, 0.2));
        fl.e([[4.5, 6.6, 0], [5.8, 7.1, 0], [9.3, 6.0, 0]], q, seg(p, 0.3, 0.4));
        glow(lossB[0], 0.6 * seg(p, 0.35, 0.45)); glow(lossB[1], 0.6 * seg(p, 0.5, 0.6)); glow(lossB[2], 0.6 * seg(p, 0.65, 0.75));
        hd.forEach((h, i) => glow(h, 0.4 * seg(p, 0.15 + i * 0.03, 0.25)));
        tl(`每图 2 × 256 + 8 × 49 = 904 个 patch；× 4096 张 = ${(4096 * 904).toLocaleString('en-US')} ≈ 370 万`);
        cap(p < 0.3 ? '一张图切出 <b>2 个全局 + 8 个局部</b>裁切；教师只看全局，学生全看' : p < 0.55 ? '<b>DINO</b>：学生每个裁切的 CLS 去对齐教师全局裁切的 CLS（Sinkhorn-Knopp 归一化后的原型分布）' : p < 0.75 ? `<b>iBOT</b>：学生全局裁切遮住 ${(ratio * 100).toFixed(0)}% 的 patch（黑块），去预测教师在这些位置的输出` : '<b>Koleo</b> 让一组 CLS 在空间里散开；教师权重是学生的 EMA，不靠梯度');
      }
    };
  }

  /* ---------- scene 4: dense features degrade ---------- */
  function s4(G) {
    const F = field(), ref = 8 * 16 + 9, ref2 = 2 * 16 + 3;
    const hA = heat(G, 16, 16, -13, 8.4, 0, 0.42), hB = heat(G, 16, 16, -5.6, 8.4, 0, 0.42);
    frame(G, -13 + 9 * 0.42, 8.4 - 8 * 0.42, 0.42, 0.42, 0.1, 0xffffff, 1); frame(G, -5.6 + 3 * 0.42, 8.4 - 2 * 0.42, 0.42, 0.42, 0.1, 0xffffff, 1);
    G.add(lab('参照：物体上的 patch', [-9.6, 9.3, 0], { size: 15 }), lab('参照：天空里的 patch', [-2.2, 9.3, 0], { size: 15 }));
    const itL = dyn(G, [-5.9, 0.6, 0], { size: 18, border: 'rgba(56,209,255,.8)' });
    const cosL = dyn(G, [-5.9, -0.5, 0], { size: 15 });
    /* sketch of fig 5c */
    const ax = wire(G, [[3, 8.4, 0], [3, 1.2, 0], [12.6, 1.2, 0]], 0x8e9bb8, { opacity: 0.7 });
    const cls = ribbon(G, 60, 0xd45fa0, 0.1), voc = ribbon(G, 60, 0x6f7fe0, 0.1);
    const curve = (f, upto) => { const o = []; for (let i = 0; i < 60; i++) { const t = Math.min(i / 59, upto); o.push([3 + t * 9.6, f(t), 0.05]); } return o; };
    const fC = t => 1.6 + 6.0 * (1 - Math.exp(-t * 9)) + 0.3 * t, fV = t => 1.6 + 5.6 * (1 - Math.exp(-t * 14)) - 3.6 * Math.max(0, t - 0.2) ** 1.0;
    G.add(lab('IN1k 分类', [11.5, 8.5, 0], { size: 14, color: '#f4a0d0' }), lab('VOC 分割', [11.5, 3.4, 0], { size: 14, color: '#a8b4ff' }), lab('示意：仿图 5c 的形状', [7.8, 9.6, 0], { size: 14, border: 'rgba(240,150,60,.9)' }), lab('训练步数 →', [8, 0.5, 0], { size: 13 }));
    const dot = L.sphere(0.18, 0xffffff); G.add(dot);
    return {
      update(p) {
        const t = p, alpha = 0.04 + 0.5 * Math.max(0, t - 0.15) / 0.85, noise = 0.6 + 2.8 * Math.max(0, t - 0.15) / 0.85;
        const X = degrade(F.g16, alpha, noise);
        const m1 = simMap(X, ref), m2 = simMap(X, ref2);
        hA.set(m1.map(v => (v - 0.2) / 0.8)); hB.set(m2.map(v => (v - 0.2) / 0.8));
        const mean = X.reduce((a, x) => a.map((v, i) => v + x[i]), new Array(F.D).fill(0)), clsv = nrm(mean.map((v, i) => v + 2 * F.c[i]));
        const cc = X.reduce((s, x) => s + dot3(x, clsv), 0) / X.length;
        itL(`训练进度 ≈ ${Math.round(200 + 800 * Math.max(0, (t - 0.15) / 0.85))}k 步`);
        cosL(`CLS 与 patch 的平均余弦：${cc.toFixed(2)}（玩具）`);
        cls.userData.set(curve(fC, t)); voc.userData.set(curve(fV, t));
        dot.position.set(3 + t * 9.6, fV(t), 0.1);
        cap(t < 0.3 ? '早期：参照 patch 只和<b>同一区域</b>的 patch 相似，相似度图干净' : '训练越久：patch 特征里混进越来越多的<b>公共方向</b>（像 CLS），无关 patch 也亮起来，分割下降而分类还在涨');
      }
    };
  }
  const dot3 = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

  /* ---------- scene 5: Gram anchoring, live ---------- */
  function s5(G) {
    const T = gramToy(), P = T.P, ref = 4 * 8 + 4;
    const gT = heat(G, P, P, -13.4, 9.4, 0, 0.1, 0), gS = heat(G, P, P, -5.4, 9.4, 0, 0.1, 0);
    gT.set(T.GT.flat().map(v => (v + 0.2) / 1.2));
    G.add(lab('教师 Gram 64 × 64', [-10.2, 10.1, 0], { size: 15, color: '#f0b070' }), lab('学生 Gram', [-2.2, 10.1, 0], { size: 15, color: '#7fd8ff' }));
    const mT = heat(G, 8, 8, 3.2, 9.0, 0, 0.5), mS = heat(G, 8, 8, 8.4, 9.0, 0, 0.5);
    mT.set(T.GT[ref].map(v => (v + 0.2) / 1.2));
    frame(G, 3.2 + 4 * 0.5, 9.0 - 4 * 0.5, 0.5, 0.5, 0.1, 0xffffff, 1); frame(G, 8.4 + 4 * 0.5, 9.0 - 4 * 0.5, 0.5, 0.5, 0.1, 0xffffff, 1);
    G.add(lab('教师', [5.2, 9.7, 0], { size: 14, color: '#f0b070' }), lab('学生', [10.4, 9.7, 0], { size: 14, color: '#7fd8ff' }), lab('参照 patch 的相似度', [7.8, 10.6, 0], { size: 14 }));
    const stepL = dyn(G, [8.4, 3.9, 0], { size: 17, border: 'rgba(212,95,160,.9)' });
    const lossL = dyn(G, [8.4, 2.8, 0], { size: 16 });
    const fcL = dyn(G, [8.4, 1.7, 0], { size: 16 });
    const rotL = dyn(G, [8.4, 0.6, 0], { size: 15 });
    const curve = ribbon(G, T.K + 1, 0xd45fa0, 0.08);
    wire(G, [[-13.4, 1.6, 0], [-13.4, -1.4, 0], [-1.0, -1.4, 0]], 0x8e9bb8, { opacity: 0.6 });
    G.add(lab('log 损失 vs 步数', [-4.0, 1.4, 0], { size: 13 }));
    const L0 = Math.log10(T.info[0].L), Lmin = Math.log10(T.info[T.K].L);
    let form = 0, rotOn = 0;
    return {
      ctls: [{ label: '损失写法', items: ['式 (2) 平方和', '代码 MSE 平均'], get: () => form, set: k => { form = k; } },
        { label: '教师整体旋转', items: ['关', '开'], get: () => rotOn, set: k => { rotOn = k; } }],
      update(p) {
        const k = Math.round(clamp(p / 0.9, 0, 1) * T.K), I = T.info[k];
        gS.set(I.G.flat().map(v => (v + 0.2) / 1.2)); mS.set(I.G[ref].map(v => (v + 0.2) / 1.2));
        const Lv = form ? I.L / (P * P) : I.L;
        stepL(`梯度下降第 ${k} / ${T.K} 步`);
        lossL(`L_Gram = ${form ? Lv.toExponential(2) : Lv.toFixed(2)}${form ? '（÷ P² = 4096）' : ''}`);
        fcL(`学生与教师特征逐个余弦的平均：${I.fc.toFixed(3)}`);
        rotL(rotOn ? `把教师特征整体旋转 Q 后：L_Gram = ${T.lossRot.toExponential(1)}，逐个余弦 ${T.fcRot.toFixed(3)}` : '（打开“教师整体旋转”看不变性）');
        const pts = []; for (let i = 0; i <= T.K; i++) { const j = Math.min(i, k); pts.push([-13.4 + 12.4 * j / T.K, -1.4 + 2.8 * (Math.log10(T.info[j].L) - Lmin) / (L0 - Lmin), 0.05]); } curve.userData.set(pts);
        cap(k === 0 ? '起点：学生特征是“旋转过的教师特征”再混入公共方向和噪声，Gram 矩阵一片模糊' : k < T.K * 0.5 ? '每一步只推学生的<b>两两相似度</b>向教师靠拢，Gram 损失迅速下降' : '收尾：学生的 Gram 矩阵和相似度图已接近教师，但<b>特征本身仍与教师差一个旋转</b>（逐个余弦 ≈ 0）');
      }
    };
  }

  /* ---------- scene 6: high-resolution Gram teacher ---------- */
  function s6(G) {
    const F = field();
    const h16 = heat(G, 16, 16, -13.4, 8.6, 0, 0.32), h32 = heat(G, 32, 32, -7.6, 8.6, 0, 0.16), hds = heat(G, 16, 16, -1.8, 8.6, 0, 0.32);
    G.add(lab('256 输入 → 16 × 16', [-10.8, 9.3, 0], { size: 14 }), lab('512 输入 → 32 × 32', [-5.0, 9.3, 0], { size: 14 }), lab('512 → 下采样到 16 × 16', [0.8, 9.3, 0], { size: 14 }));
    const m1 = dyn(G, [-10.8, 3, 0], { size: 14 }), m2 = dyn(G, [-5.0, 3, 0], { size: 14 }), m3 = dyn(G, [0.8, 3, 0], { size: 14 });
    const fb = stream(G, 5, COL.gram, 0.1);
    /* fig 9b bars */
    const B = [['基线', 50.3, COL.dim], ['×1 200k', 53.6, 0x9d8cff], ['×2 200k', 55.7, COL.gram], ['×2 100k', 55.7, COL.gram], ['×2 1M', 54.9, 0xf0963c]];
    const bars = B.map((b, i) => bar(G, 5.4 + i * 1.7, 0, 1.0, b[2]));
    B.forEach((b, i) => G.add(lab(b[0], [5.4 + i * 1.7, -0.7 - (i % 2) * 0.7, 0.8], { size: 12 }), lab(b[1].toFixed(1), [5.4 + i * 1.7, 1 + (b[1] - 48) * 0.9, 0.6], { size: 13 })));
    G.add(lab('图 9b · ADE20k mIoU', [8.6, 9.0, 0], { size: 15, border: 'rgba(212,95,160,.8)' }));
    /* noise drawn per-cell is fixed; 32-grid native noise is the same scale as 16-grid noise */
    const ref16 = 8 * 16 + 9, ref32 = 17 * 32 + 19;
    const consistency = (X, N) => { let s = 0, n = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N - 1; j++) { const a = i * N + j, b = a + 1; const ka = regionOf((i + 0.5) / N, (j + 0.5) / N), kb = regionOf((i + 0.5) / N, (j + 1.5) / N); if (ka === kb) { s += dot3(X[a], X[b]); n++; } } return s / n; };
    let cache = null;
    function build() {
      const X16 = degrade(F.g16, 0.05, 3.2), X32 = degrade(F.g32, 0.05, 3.2);
      const D = F.D, Xd = [];
      for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { const v = new Array(D).fill(0); for (const [di, dj] of [[0, 0], [0, 1], [1, 0], [1, 1]]) { const x = X32[(2 * i + di) * 32 + 2 * j + dj]; for (let k = 0; k < D; k++) v[k] += x[k]; } Xd.push(nrm(v)); }
      cache = { X16, X32, Xd, c16: consistency(X16, 16), c32: consistency(X32, 32), cd: consistency(Xd, 16) };
      h16.set(simMap(X16, ref16).map(v => (v - 0.2) / 0.8)); h32.set(simMap(X32, ref32).map(v => (v - 0.2) / 0.8)); hds.set(simMap(Xd, ref16).map(v => (v - 0.2) / 0.8));
    }
    return {
      update(p) {
        if (!cache) build();
        m1(`同区域邻居余弦 ${cache.c16.toFixed(2)}`); m2(`${cache.c32.toFixed(2)}`); m3(`${cache.cd.toFixed(2)}（更一致）`);
        fb([[-5.0, 5.8, 0.2], [-2.8, 6.4, 0.3], [-0.6, 5.8, 0.2]], (p * 10) % 1, seg(p, 0.2, 0.3));
        B.forEach((b, i) => bars[i].userData.set((b[1] - 48) * 0.9 * seg(p, 0.35 + i * 0.05, 0.5 + i * 0.05)));
        cap(p < 0.35 ? 'Gram 教师吃 <b>2 倍分辨率</b>的图，特征图 32 × 32，再<b>下采样</b>到学生的 16 × 16' : '下采样等于对邻近 patch 加权平均，孤立的噪声 patch 被压掉；ADE20k 从 53.6 提到 55.7（图 9b）');
      }
    };
  }

  /* ---------- scene 7: high-resolution adaptation ---------- */
  function s7(G) {
    const C = [[512, 112, 768, 0.3], [768, 112, 1152, 0.3], [768, 168, 1152, 0.3], [768, 224, 1152, 0.05], [768, 336, 1152, 0.05]];
    const sc = 1 / 160;
    const g = block(1, 1, 0.1, COL.stu, [-8, 4, 0], { opacity: 0.6 }), l = block(1, 1, 0.1, COL.ret, [-3.5, 4, 0], { opacity: 0.7 }), gt = block(1, 1, 0.1, COL.tea, [2.5, 4, -0.2], { opacity: 0.45 });
    G.add(g, l, gt);
    const gL = dyn(G, [-8, 8.9, 0], { size: 15 }), lL = dyn(G, [-3.5, 6.3, 0], { size: 15 }), tL = dyn(G, [2.5, 9.4, 0], { size: 15 });
    const bars = C.map((c, i) => bar(G, 8.6 + i * 1.1, 0, 0.8, 0x9d8cff));
    C.forEach((c, i) => G.add(lab(`组${i + 1}`, [8.6 + i * 1.1, -0.6, 0.6], { size: 11 }), lab(String(c[3]), [8.6 + i * 1.1, c[3] * 16 + 0.6, 0.5], { size: 12 })));
    G.add(lab('采样概率', [10.8, 6.6, 0], { size: 15 }), lab('Gram 教师 = 7B 自己（固定）', [2.5, 0.0, 0], { size: 14, border: 'rgba(240,150,60,.8)' }));
    const it = dyn(G, [-5.5, -1.2, 0], { size: 15, border: 'rgba(56,209,255,.7)' });
    /* deterministic sequence of draws from the five-way distribution */
    const r = rng(17), draws = Array.from({ length: 40 }, () => { const u = r(); let a = 0; for (let k = 0; k < 5; k++) { a += C[k][3]; if (u < a) return k; } return 4; });
    return {
      update(p) {
        const step = Math.floor(p * 39.999), k = draws[step], c = C[k];
        g.scale.set(c[0] * sc, c[0] * sc, 1); g.position.y = 0.3 + c[0] * sc / 2;
        l.scale.set(c[1] * sc, c[1] * sc, 1); l.position.y = 0.3 + c[1] * sc / 2;
        gt.scale.set(c[2] * sc, c[2] * sc, 1); gt.position.y = 0.3 + c[2] * sc / 2;
        gL(`全局 ${c[0]}（${c[0] / 16} × ${c[0] / 16} patch）`); lL(`局部 ${c[1]}`); tL(`Gram 教师 ${c[2]} = 1.5 × 全局`);
        bars.forEach((b, i) => { b.userData.set(C[i][3] * 16); glow(b, i === k ? 0.7 : 0); });
        it(`第 ${step + 1} 次抽样 → 第 ${k + 1} 组`);
        cap('每个 mini-batch 抽一组尺寸；学生学会在 <b>512 到 768</b> 的大裁切上保持特征一致，<b>Gram 项</b>防止稠密特征在高分辨率下变差');
      }
    };
  }

  /* ---------- scene 8: multi-student distillation ---------- */
  function s8(G) {
    const tea = block(4.4, 3.0, 2.2, COL.tea, [-10.5, 6.6, 0]); G.add(tea, lab('ViT-7B 教师（固定）', [-10.5, 8.6, 0], { size: 16 }));
    const groups = [['ViT-S', 48, 21], ['ViT-S+', 48, 29], ['ViT-B', 80, 86], ['ViT-L', 120, 300]], tot = 296;
    const gpu = inst(BOX, tot); G.add(gpu);
    const pos = []; let x = -7.0;
    groups.forEach(([n, c], gi) => { for (let i = 0; i < c; i++) pos.push([x + Math.floor(i / 10) * 0.42, 0.6 + (i % 10) * 0.42, 0, gi]); G.add(lab(`${n}\n${c} 卡`, [x + Math.floor((c - 1) / 10) * 0.21, 5.2, 0], { size: 14 })); x += Math.ceil(c / 10) * 0.42 + 0.7; });
    const stus = groups.map(([n, c, prm], gi) => { const s = Math.cbrt(prm) * 0.28; const b = block(s, s, s, COL.stu, [pos.find(q => q[3] === gi)[0] + Math.floor((c - 1) / 10) * 0.21, 7.2, 0]); G.add(b); return b; });
    const phase = dyn(G, [2.0, 9.4, 0], { size: 17, border: 'rgba(240,150,60,.9)' });
    const costL = dyn(G, [2.0, -0.6, 0], { size: 15 });
    const fl = stream(G, 8, COL.tea, 0.13);
    let mode = 1;
    const CT = 3550, CS = gi => 3 * [12, 16, 47, 163][gi], B = 1920;
    return {
      ctls: [{ label: '方式', items: ['四个学生分开蒸馏', '一起蒸馏（共享教师）'], get: () => mode, set: k => { mode = k; } }],
      update(p) {
        const ph = p < 0.3 ? 0 : p < 0.5 ? 1 : p < 0.85 ? 2 : 3;
        for (let i = 0; i < tot; i++) { const q = pos[i]; setI(gpu, i, [q[0], q[1], q[2]], 0.34); const c = ph === 0 ? (mode ? [0.94, 0.59, 0.24] : (q[3] === Math.floor(p / 0.3 * 4) % 4 ? [0.94, 0.59, 0.24] : [0.3, 0.33, 0.42])) : ph === 1 ? [0.95, 0.85, 0.4] : ph === 2 ? hex3([0x38d1ff, 0x4fc98a, 0x9d8cff, 0xd45fa0][q[3]]) : [0.6, 0.62, 0.7]; colI(gpu, i, c); }
        done(gpu);
        glow(tea, ph === 0 ? 0.6 : 0); stus.forEach(s => glow(s, ph === 2 ? 0.6 : 0));
        fl([[-8.3, 6.6, 0], [-4, 6, 0], [6, 5.6, 0]], (p * 12) % 1, ph <= 1 ? 1 : 0);
        phase(['① 所有 296 张卡一起做教师推理', '② all-gather：输入和教师输出发给所有卡', '③ 每组训练自己的学生（卡数不同，用时相近）', '④ 同步屏障，进入下一次迭代'][ph]);
        /* per-GPU cost per iteration, GFLOPs (assumed CS = 3 × forward) */
        const multi = groups.map(([n, c], gi) => B / tot * CT + B / c * CS(gi)), sep = groups.map(([n, c], gi) => B / c * CT + B / c * CS(gi));
        const show = mode ? multi : sep;
        costL(`每卡每步代价（TFLOPs，示意）：${groups.map((g, i) => g[0] + ' ' + (show[i] / 1000).toFixed(1)).join(' · ')}`);
        cap(mode ? '共享：教师推理每卡只分到 <b>B / 296</b> 个样本；多加一个学生只多它自己的训练代价' : '分开：每组都要自己跑一遍 7B 教师，每卡分到 <b>B / N<sub>Si</sub></b> 个样本的教师推理');
      }
    };
  }

  /* ---------- scene 9: dino.txt ---------- */
  function s9(G) {
    const vit = block(3.4, 3.2, 2, COL.stu, [-10, 6.4, 0], { opacity: 0.6 }); G.add(vit, lab('DINOv3 ViT-L（冻结）', [-10, 8.6, 0], { size: 15 }));
    const hb = [0, 1].map(k => block(2.6, 0.6, 1.6, 0x4fc98a, [-10, 4.1 - k * 0.8, 0])); G.add(...hb, lab('2 个可训练块', [-12.9, 3.7, 0], { size: 13 }));
    const clsB = block(0.8, 0.8, 0.8, COL.cls, [-6.4, 2.0, 0]), mp = block(0.8, 0.8, 0.8, COL.patch, [-5.4, 2.0, 0]); G.add(clsB, mp, lab('CLS ⊕ mean(patch)', [-5.9, 0.9, 0], { size: 14 }));
    const te = block(3.0, 2.4, 1.6, COL.text, [-5.6, 6.6, 0]); G.add(te, lab('文本编码器\n（从头训练）', [-5.6, 4.4, 0.9], { size: 14 }));
    const n = 8, mat = heat(G, n, n, -1.6, 8.0, 0, 0.8); G.add(lab('B × B 图文相似度（玩具）', [1.6, 8.8, 0], { size: 14 }));
    const r = rng(9), base = Array.from({ length: n * n }, () => r());
    const T = [['CLIP', 6.0, 11.5], ['EVA-02-CLIP', 10.9, 14.1], ['dino.txt', 19.2, 27.4], ['SigLIP 2', 10.8, 16.3], ['PE', 17.6, 21.4], ['DINOv3 dino.txt', 24.7, 36.9]];
    const bA = T.map((t, i) => bar(G, 7.6 + i * 1.05, -0.4, 0.42, i === 5 ? COL.gram : COL.dim)), bC = T.map((t, i) => bar(G, 7.6 + i * 1.05 + 0.42, -0.4, 0.42, i === 5 ? 0xf2c14e : 0x6b7794));
    T.forEach((t, i) => G.add(lab(['CLIP', 'EVA-02', 'dino.txt', 'SigLIP 2', 'PE', 'DINOv3'][i], [7.8 + i * 1.05, -0.9 - (i % 2) * 0.7, 0.8], { size: 11 })));
    G.add(lab('表 16 · 开放词汇分割 mIoU\n左 ADE20k，右 Cityscapes', [10.2, 6.6, 0], { size: 13 }));
    const fl = stream(G, 5, COL.cls, 0.12);
    return {
      update(p) {
        const k = seg(p, 0.3, 0.8);
        mat.set(base.map((v, i) => { const d = Math.floor(i / n) === i % n; return d ? L.lerp(v * 0.5, 0.95, k) : v * 0.5 * (1 - 0.6 * k); }));
        T.forEach((t, i) => { bA[i].userData.set(t[1] * 0.14 * seg(p, 0.1, 0.4)); bC[i].userData.set(t[2] * 0.14 * seg(p, 0.1, 0.4)); });
        hb.forEach(b => glow(b, 0.4 * ((Math.sin(p * 20) + 1) / 2)));
        fl([[-10, 2.8, 0], [-6, 2.0, 0], [-2, 4.6, 0]], (p * 10) % 1, 1);
        cap(p < 0.3 ? '视觉骨干冻结，只训上面 <b>2 个块</b>和文本编码器' : '对比学习：对角线（配对的图文）相似度拉高，其他压低；拼进 patch 均值让<b>局部特征也对齐文本</b>');
      }
    };
  }

  /* ---------- scene 10: using dense features ---------- */
  function s10(G) {
    const F = field(), X = degrade(F.g16, 0.02, 0.25);
    /* PCA by power iteration with deflation, computed once */
    const D = F.D, mean = X.reduce((a, x) => a.map((v, i) => v + x[i] / X.length), new Array(D).fill(0));
    const Z = X.map(x => x.map((v, i) => v - mean[i]));
    const C = Array.from({ length: D }, (_, a) => Array.from({ length: D }, (_, b) => Z.reduce((s, z) => s + z[a] * z[b], 0)));
    const comps = []; const r = rng(4);
    for (let c = 0; c < 3; c++) { let v = nrm(Array.from({ length: D }, () => gauss(r))); for (let it = 0; it < 60; it++) { let w = C.map(row => dot3(row, v)); for (const u of comps) { const d = dot3(w, u); w = w.map((x, i) => x - d * u[i]); } v = nrm(w); } comps.push(v); }
    const proj = Z.map(z => comps.map(u => dot3(z, u)));
    const mn = [0, 1, 2].map(k => Math.min(...proj.map(q => q[k]))), mx = [0, 1, 2].map(k => Math.max(...proj.map(q => q[k])));
    const rgb = proj.map(q => q.map((v, k) => (v - mn[k]) / (mx[k] - mn[k] || 1)));
    const h = heat(G, 16, 16, -13.4, 8.4, 0, 0.42);
    G.add(lab('PCA 前 3 维 → RGB（玩具）', [-10, 9.2, 0], { size: 15 }));
    const fz = block(2.6, 2.6, 1.6, COL.stu, [-3.8, 5.2, 0], { opacity: 0.55 }); G.add(fz, lab('冻结 DINOv3', [-3.8, 7.0, 0], { size: 15 }));
    const heads = [['线性探针 → 分割 / 深度', 7.8], ['相似度 → 跟踪 / 对应 / 物体发现', 5.4], ['轻量解码器 → 检测 / 分割', 3.0]].map(([t, y]) => { const b = block(1.0, 0.8, 0.8, COL.head, [0.6, y, 0]); G.add(b, lab(t, [0.6, y + 0.75, 0], { size: 13 })); return b; });
    const fl = [stream(G, 4, COL.patch), stream(G, 4, COL.patch), stream(G, 4, COL.patch)];
    const T3 = [['RADIO', 53.0], ['PEsp', 49.3], ['SigLIP2', 42.7], ['PEcore', 38.9], ['Franca', 46.3], ['DINOv2', 49.5], ['WebDINO', 42.7], ['DINOv3', 55.9]];
    const bs = T3.map((t, i) => bar(G, 5.0 + i * 1.0, 0, 0.7, i === 7 ? COL.gram : COL.dim));
    T3.forEach((t, i) => G.add(lab(t[0], [5.0 + i * 1.0, -0.7 - (i % 2) * 0.7, 0.6], { size: 11 }), lab(t[1].toFixed(1), [5.0 + i * 1.0, (t[1] - 35) * 0.3 + 0.5, 0.5], { size: 11 })));
    G.add(lab('表 3 · ADE20k 线性探针 mIoU', [8.5, 8.4, 0], { size: 14 }));
    return {
      update(p) {
        const k = seg(p, 0.05, 0.35);
        h.set(rgb.map((c, i) => c), c => c.map(v => v * k + 0.2 * (1 - k)));
        heads.forEach((b, i) => glow(b, 0.6 * seg(p, 0.3 + i * 0.12, 0.4 + i * 0.12)));
        fl.forEach((f, i) => f([[-2.4, 5.2, 0], [-0.6, [7.8, 5.4, 3.0][i], 0]], (p * 10) % 1, seg(p, 0.3 + i * 0.12, 0.35 + i * 0.12)));
        T3.forEach((t, i) => bs[i].userData.set((t[1] - 35) * 0.3 * seg(p, 0.6, 0.85)));
        cap(p < 0.35 ? '同一区域的 patch 特征相近，所以 PCA 前三维就能把物体、天空、地面分成三种颜色' : '用法都不碰骨干：<b>线性层</b>、<b>相似度</b>或<b>轻量解码器</b>直接接 patch 特征');
      }
    };
  }

  /* ---------- scene 11: OpenWAM hookup ---------- */
  function s11(G) {
    const frames = []; for (let t = 0; t < 9; t++) { const b = block(1.5, 1.8, 0.08, t === 0 ? 0x6f7fe0 : 0x3a4a68, [-13 + t * 0.32, 6.6 - t * 0.18, -t * 0.3]); frames.push(b); G.add(b); }
    G.add(lab('9 帧 · 384 × 320', [-11.8, 8.4, 0], { size: 15 }));
    const vit = block(2.2, 2.2, 1.6, COL.stu, [-7.4, 5.4, 0]); G.add(vit, lab('ViT-B/16\n冻结，逐帧', [-7.4, 7.3, 0], { size: 14 }));
    const drop = inst(BOX, 5); G.add(drop);
    const grid = []; for (let t = 0; t < 9; t++) { const b = block(1.0, 1.2, 0.3, COL.patch, [-4.0 + t * 0.55, 5.2, 0], { opacity: 0.85 }); grid.push(b); G.add(b); }
    G.add(lab('每帧 24 × 20 × 768', [-1.8, 6.6, 0], { size: 14 }));
    const lat = [0, 1, 2].map(k => { const b = block(1.2, 1.4, 0.4, COL.patch, [3.4 + k * 1.0, 5.2, 0]); G.add(b); return b; });
    G.add(lab('3 个隐帧', [4.4, 6.7, 0], { size: 14 }));
    const ln = block(0.8, 1.6, 1.2, 0xf2c14e, [6.8, 5.2, 0]); G.add(ln, lab('无参 LN', [6.8, 6.6, 0], { size: 13 }));
    const sv = block(1.2, 1.6, 1.2, COL.svae, [8.5, 5.2, 0]); G.add(sv); const svL = dyn(G, [8.5, 3.6, 0.8], { size: 13 });
    const dit = block(2.4, 3.2, 2.0, COL.dit, [11.6, 5.2, 0]); G.add(dit, lab('Wan2.2-TI2V-5B DiT\n宽 3072（随机初始化）', [11.6, 7.6, 0], { size: 14 }));
    const shapeL = dyn(G, [0, 1.6, 0], { size: 16, border: 'rgba(56,209,255,.8)' });
    const tokL = dyn(G, [0, 0.5, 0], { size: 15 });
    const scoreL = dyn(G, [11.6, 1.9, 0], { size: 17, border: 'rgba(242,160,160,.9)' });
    const groupsL = dyn(G, [0.4, 3.6, 0], { size: 14 });
    const fl = stream(G, 6, COL.patch, 0.12);
    let sv_ = 0;
    return {
      ctls: [{ label: 'S-VAE', items: ['不加（768 维）', '加（48 维）'], get: () => sv_, set: k => { sv_ = k; } }],
      update(p) {
        const C = sv_ ? 48 : 768;
        sv.visible = !!sv_; svL(sv_ ? 'S-VAE\n768 → 48' : '（不加 S-VAE）');
        const st = p < 0.2 ? 0 : p < 0.4 ? 1 : p < 0.62 ? 2 : p < 0.8 ? 3 : 4;
        /* dropped tokens fly away during stage 1 */
        const d = seg(p, 0.2, 0.38);
        for (let i = 0; i < 5; i++) { setI(drop, i, [-6.0 + i * 0.3, 6.6 + d * 2.4, d * 1.5], 0.25 * (1 - d) + 0.0001); colI(drop, i, hex3(i ? COL.reg : COL.cls)); }
        done(drop);
        /* causal pooling: frame 0 alone, 1-4 and 5-8 averaged */
        const k = seg(p, 0.42, 0.6);
        grid.forEach((b, t) => { const gi = t === 0 ? 0 : t <= 4 ? 1 : 2; b.position.x = L.lerp(-4.0 + t * 0.55, 3.4 + gi * 1.0, k); b.material.opacity = k > 0.98 ? 0.0 : 0.85; b.material.transparent = true; glow(b, st === 2 ? 0.4 : 0); });
        lat.forEach(b => { b.visible = k > 0.95; });
        frames.forEach((b, t) => glow(b, st === 0 ? 0.5 * (Math.floor(p * 45) % 9 === t ? 1 : 0) : 0));
        glow(vit, st <= 1 ? 0.5 : 0); glow(ln, st === 3 ? 0.6 : 0); glow(sv, st === 3 ? 0.6 : 0); glow(dit, st === 4 ? 0.6 : 0);
        groupsL(k > 0.5 ? '帧 0 单独 | 帧 1–4 平均 | 帧 5–8 平均' : '');
        fl([[8.5, 5.2, 0], [10.4, 5.2, 0]], (p * 10) % 1, seg(p, 0.8, 0.85));
        const shapes = ['(9, 3, 384, 320)', `(9, 1 + 4 + 480, 768) → 丢 5 个 → (768, 9, 24, 20)`, '(768, 3, 24, 20)', `(${C}, 3, 24, 20)`, `360 个 token × ${4 * C} 维 → 3072`][st];
        shapeL(`形状：${shapes}`);
        tokL(`DiT patch 嵌入 Conv3d(${C}, 3072, 1×2×2)：3 × 12 × 10 = 360 个 token，4C = ${4 * C}，4C ÷ 3072 = ${(4 * C / 3072).toFixed(2)}`);
        scoreL(`RoboTwin 成功率 ${sv_ ? '90.18' : '76.42'}%`);
        cap(['逐帧 ImageNet 归一化后送进<b>冻结的 ViT-B/16</b>', '每帧输出 485 个 token，丢掉 <b>CLS 和 4 个 register</b>，留 24 × 20 个 patch', '模仿 Wan2.2-VAE 的因果分组：<b>首帧单独，其余每 4 帧平均</b>，9 帧 → 3 个隐帧', sv_ ? '<b>S-VAE</b> 把每个 token 压到 48 维，再做<b>无参 LayerNorm</b>' : '每个 token 在 768 维上做一次<b>无参 LayerNorm</b>', '1 × 2 × 2 打包成 360 个 token，送进 DiT 预测未来隐帧'][st]);
      }
    };
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
    L.clear(root); LABS = []; lastCap = null;
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
  const s0 = clamp((parseInt(qs.get('scene'), 10) || 1) - 1, 0, SCENES.length - 1), pq = qs.get('p');
  setPlay(playing && pq == null);
  go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0));
  window.__dinoDebug = { gramToy, get cap() { return $('cap').textContent; } };
})();
