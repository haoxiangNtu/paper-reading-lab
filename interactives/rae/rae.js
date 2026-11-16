'use strict';
/* RAE (arXiv 2510.11690) taken apart into eleven animated scenes. Numbers come from the paper (v1) and the official code
   bytetriper/RAE at commit a4d18c4 (read, not run). Each scene's update(p) is a pure function of the timeline p plus the
   current toggles. Scenes 4, 5, 6, 7, 8 and 11 compute their numbers live from the formulas; the 2-D point clouds in
   scenes 6 and 8 are fixed-seed toys. No RAE network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { vae: 0xf08a7a, rae: 0x5b8cf0, frozen: 0x6b7794, train: 0x4fc98a, head: 0x9fd89a, noise: 0x8e9bb8, ok: 0x4fc98a, bad: 0xe05d5d, gold: 0xf2c14e, data: 0x7cb8ff, dim: 0x46506a, white: 0xeef2fa, act: 0xf0963c, vid: 0x3aa8e0, purple: 0xb48cff };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const hexs = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const live = t => `<p class="guess"><b>现算 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const fmt = n => n.toLocaleString('en-US');
  /* §4.2 shift: t_m = a t / (1 + (a-1) t), a = sqrt(m / 4096) */
  const shiftF = (t, a) => a * t / (1 + (a - 1) * t);
  const alphaOf = m => Math.sqrt(m / 4096);
  /* parameter count following stage2/models/DDT.py (SwiGLU 2/3·4h, adaLN 6h, RMSNorm, Fourier time embed 512) */
  const lin = (i, o) => i * o + o;
  const blk = h => { const hid = Math.floor(2 / 3 * Math.floor(4 * h)); return lin(h, 3 * h) + lin(h, h) + lin(h, 2 * hid) + lin(hid, h) + lin(h, 6 * h) + 2 * h; };
  const ditdh = (C, he, de, hd, dd) => lin(C, hd) + lin(C, he) + (he !== hd ? lin(he, hd) : 0) + lin(512, he) + lin(he, he) + 1001 * he + de * blk(he) + dd * blk(hd) + lin(hd, 2 * hd) + lin(hd, C) + hd;

  const SCENES = [
    { n: 1, part: '§1 / §3 隐空间', title: 'VAE 的 4 维 vs 表示编码器的 768 维', sub: 'token 数一样，每个 token 的维度差 48 倍', dur: 12, cam: [0.0, 0.92, 34, [0, 2.6, 0]],
      html: dl([['SD-VAE', '256² → 32 × 32 × 4；DiT 用 patch 2 → 256 个 token × 16 维'], ['RAE（DINOv2-B）', '224² 输入，patch 14 → 16 × 16 = 256 个 token × 768 维；DiT 用 patch 1'], ['总维度', '4,096 对 196,608（48 倍）'], ['线性探测', 'SD-VAE 约 8%，DINOv2-B 84.5%（表 1d）']]) +
        '<p>左右两块是同一张 256 × 256 图的隐变量，每根柱子是一个 DiT token，柱高是这个 token 的维度。两边 token 数都是 256，所以 DiT 的序列长度和注意力计算一样；不同的只是第一层把多少维投影到 DiT 宽度。</p>' +
        '<p>作者认为 VAE 隐空间维度低、只靠重建训练，语义结构弱；表示编码器的特征维度高、语义好，但大家担心两件事：重建不了、扩散训不好。后面几幕依次回答。</p>' +
        src('§1 · §3 · 表 1 · 附录 C.1 · 附录 D “Compute”') },
    { n: 2, part: '§3 RAE 结构', title: '冻结编码器 + 训练的 ViT 解码器', sub: '编码器一个参数不动；解码器训练时给隐变量加噪声', dur: 15, cam: [0.0, 1.12, 38, [0, 1.8, 0]],
      html: dl([['编码器', '冻结；丢 [CLS] 和 register；去掉最后 LayerNorm 的仿射 → 每 token 零均值单位方差'], ['解码器', 'ViT-XL：28 层 × 1152，FFN 4096；前置可学 [CLS]；p_d = 16'], ['损失', 'L1 + LPIPS + 0.75·λ·GAN，λ 自适应'], ['判别器', '冻结 DINO-S/8 + 可训练头；第 6 个 epoch 开始，第 8 个 epoch 起对抗损失'], ['噪声增强', '训练解码器时 z + σε，代码 σ = 0.8·U(0,1)']]) +
        '<p>数据从左往右：图像先缩到 224，进冻结的 DINOv2-B，得到 16 × 16 个 768 维 token，再做无仿射的 LayerNorm。这就是扩散模型要生成的隐变量。解码器把它还原成 256 × 256 的图。</p>' +
        '<p>只有解码器（绿色）和判别器头参与训练。切换编码器可以看三种预训练范式的 patch 大小和 rFID。</p>' +
        src('§3 · 附录 C.1 · C.2 表 12 · stage1/rae.py · encoders/dinov2.py · configs/stage1/training/DINOv2-B_decXL.yaml') },
    { n: 3, part: '§3 重建', title: '重建比 SD-VAE 好，还更省', sub: '柱子是表 1 的原文数字；切换四张子表', dur: 11, cam: [0.0, 1.3, 34, [0, 3.8, 0]],
      html: dl([['(a) 编码器', 'MAE-B 0.16 最好，DINOv2-B 0.49，SD-VAE 0.62'], ['(b) 解码器', 'ViT-B 已胜 SD-VAE，计算 1/14；ViT-XL 0.49，计算约 1/3'], ['(c) 编码器大小', 'DINOv2-S/B/L 都在 0.5 左右'], ['(d) 线性探测', 'RAE 继承编码器：84.5 / 79.1 / 68.0；SD-VAE 8.0']]) +
        '<p>“语义编码器丢了细节，重建不好”这个假设在表 1 里不成立：三个冻结编码器的 rFID 都低于 SD-VAE。但重建最好的 MAE 生成最差（附录 G.1：gFID 16.14），所以后面默认用 DINOv2-B。</p>' +
        '<p>表 1b 的 GFLOPs 按乘加次数计（精读页读者注 2）。</p>' + src('表 1 · 图 2 · 附录 G.1 表 15a') },
    { n: 4, part: '§4.1 宽度', title: '宽度 d 小于维度 n：连一张图都拟合不了', sub: '改 n、d、深度；右边是下界 (n − d)/n 和原文观测', dur: 13, cam: [0.0, 1.32, 36, [0.6, 3.0, 0]], camE: [0.0, 1.38, 40, [0.6, 6.2, 0]],
      html: dl([['式 (1)', 'g(x_t, t) = B f(A x_t, t)，A ∈ ℝ^{d×n}，B ∈ ℝ^{n×d}'], ['式 (2)', '∫ E‖g − (ε − x)‖² dt ≥ Σ_{i>d} λ_i'], ['单张图', 'λ_i = 1 → 平均下界 (n − d)/n'], ['表 3', 'S+B 0.52、S+L 0.65、B+L 0.27（下界 0.50、0.625、0.25）'], ['加深', 'd = 384、n = 768：深度 4 到 24 都约 0.52']]) +
        '<p>左边一列是一个 token 的 n 维输入（每格代表 32 维）。输入投影 A 把它压到 d 维，经过 DiT 块，再由输出投影 B 放回 n 维。不管中间多深，输出只能落在 B 的 d 维像空间里：绿色格是能表示的方向，红色格是学不到的方向。</p>' +
        '<p>目标 ε − x 里的噪声在每个方向上方差都是 1，所以红色格的那部分误差去不掉。右边的红线是这个下界，绿点是原文观测（图 3 和表 3）。金点是一次单图过拟合的损失，随进度下降，最后停在下界上。</p>' +
        live('下界 max(0, (n − d)/n) 当场算；切换深度不改变下界。') + guess('损失下降的曲线形状（指数衰减到下界）是我画的，原文只给了收敛后的值。') +
        src('§4.1 式 (1)(2) · 图 3 · 表 3 · 附录 B.1 · 附录 F') },
    { n: 5, part: '§4.2 shift', title: '噪声调度按有效维度 shift', sub: 'α = √(m / 4096)；看训练时间步和 50 个采样步被推到哪里', dur: 13, cam: [0.0, 1.35, 30, [0.5, 4.4, 0]],
      html: dl([['公式', 't_m = α t_n / (1 + (α − 1) t_n)，t = 1 是噪声'], ['有效维度 m', 'token 数 × token 维度'], ['SD-VAE 256', 'm = 32·32·4 = 4,096 → α = 1'], ['RAE 256', 'm = 256·768 = 196,608 → α = 6.93'], ['RAE 512', 'm = 1024·768 = 786,432 → α = 13.86'], ['表 4', '不 shift 23.08 → shift 4.81']]) +
        '<p>左图是 shift 曲线：横轴是均匀的 t_n，纵轴是 shift 后的 t_m。α 越大，曲线越往上鼓，同样的进度对应更高的噪声。维度越高，同一噪声水平下信息破坏越少，所以要在高噪声段多花时间。</p>' +
        '<p>右边上面是 50 步 Euler 采样的时间点（代码 integrators.py：1 − linspace 再 shift），下面是训练时间步的直方图：代码先从 logit-normal(0, 1) 抽，再 shift（论文没写 logit-normal）。</p>' +
        live('直方图用固定种子抽 4,000 个样本；“t > 0.5 的比例”和 α 当场算。') + src('§4.2 表 4 · train.py 第 137–139 行 · transport.py 第 160–181 行 · integrators.py 第 99–101 行') },
    { n: 6, part: '§4.3 解码器', title: '噪声增强解码：让解码器认识“附近”的隐变量', sub: '蓝点是训练隐变量，橙点是扩散模型的输出；改 τ', dur: 13, cam: [0.0, 1.35, 30, [1.5, 4.0, 0]],
      html: dl([['问题', '解码器只见过离散的 p(z) = Σ δ(z − z_i)；扩散输出会略偏'], ['做法', '训练解码器时用 z + n，n ~ N(0, σ²I)'], ['σ 的分布', '论文 |N(0, τ²)|；代码 τ·U(0, 1)'], ['表 15c', 'τ = 0 / 0.5 / 0.8 / 1.0：gFID 4.81 / 4.39 / 4.28 / 4.20，rFID 0.49 / 0.54 / 0.57 / 0.60']]) +
        '<p>平面上每个蓝点代表一个训练图像的隐变量，圆圈是解码器在噪声增强训练中见过的邻域（半径取 σ 的均值）。橙点是扩散模型生成的隐变量：落在圈里的（变绿）解码器见过类似输入，落在外面的（红）是分布外输入。</p>' +
        '<p>τ 越大圈越大，生成更稳（gFID 降），但解码器被迫把邻域内的点解码成相似的图，细节变少（rFID 升）。</p>' +
        guess('二维点云是玩具：40 个训练点、偏移 0.45 的生成点都是我设的，只为说明机制。柱子是表 15c 的原文数字。') + live('圈半径 = σ 均值：论文 τ√(2/π)，代码 τ/2；落在圈内的比例当场数。') +
        src('§4.3 表 5 · 附录 G.2 表 15 · stage1/rae.py 第 73–76 行') },
    { n: 7, part: '§5 DiT^DH', title: '宽而浅的 DDT 头', sub: '骨干 28 × 1152，头 2 × w，头自己再读一次 x_t', dur: 14, cam: [0.35, 1.08, 38, [0, 2.6, 0]],
      html: dl([['式', 'z_t = M(x_t | t, y)，v_t = H(x_t | z_t, t)'], ['骨干', 'DiT-XL：28 层，宽 1152，16 头'], ['头', '2 层，宽 2048；x_t 经自己的嵌入层进入；骨干输出 silu(t + s) 投影到 2048，逐 token 做 adaLN 条件'], ['参数', 'DiT^DH-XL 839M（代码算 838.4M），DiT-XL 676M'], ['表 17', '头宽 768 / 1536 / 2048 / 2688']]) +
        '<p>DiT^DH 的主路径是 x_t → 头的嵌入 → 2 个宽块 → v_t，最窄处是头宽 w；骨干只提供逐 token 的条件。所以只要 w ≥ n 就满足 §4.1 的条件，而骨干可以保持 1152 宽，计算不按 w² 涨。</p>' +
        '<p>切换头宽和编码器看表 17：DINOv2-L（1024 维）配 768 宽的头不满足条件，原文标 N/A；编码器越大，最优头越宽。</p>' +
        live('参数量按 DDT.py 的层定义当场算（SwiGLU、adaLN、RMSNorm、Fourier 时间嵌入）。') + src('§5 图 5 · 表 6 · 附录 D 表 13 · 附录 G.3 表 16、17 · stage2/models/DDT.py') },
    { n: 8, part: '训练和采样', title: '流匹配训练，50 步 Euler，AutoGuidance', sub: '左边是一次训练样本，右边是一次采样和引导', dur: 15, cam: [0.0, 1.35, 32, [0.5, 4.2, 0]],
      html: dl([['插值', 'x_t = (1 − t) x + t ε，t = 1 是噪声'], ['目标', '速度 v = ε − x，MSE'], ['训练', 'batch 1024，lr 2e-4 → 2e-5 线性，warmup 40 epoch，EMA 0.9995，裁剪 1.0'], ['采样', 'Euler 50 步，从 t = 1 到 0，时间点按 α = 6.93 shift'], ['AutoGuidance', 'v = v_S + w (v_XL − v_S)，w = 1.42，引导模型 DiT^DH-S 第 14 epoch'], ['解码', '噪声增强训练过的 ViT-XL 解码器，推理时 τ = 0']]) +
        '<p>左：一个训练样本。数据点 x 和噪声 ε 之间连一条直线，t 决定 x_t 在线上的位置，网络要预测从数据指向噪声的速度 ε − x（灰箭头）。</p>' +
        '<p>右：采样从纯噪声出发，按 shift 后的 50 个时间点往数据走；前面几步时间间隔小、噪声大。每一步把强模型 XL 和弱模型 S 的速度按 1.42 外推（橙箭头）。最后的隐变量交给解码器出图。</p>' +
        guess('二维轨迹是玩具：目标点、弱模型的偏差方向都是我设的；速度场取直线流，所以 Euler 每步都精确。') + live('50 个时间点按 integrators.py 的式子算。') +
        src('§4 · 附录 D · 附录 I · 附录 J · transport/ · DiTDHXL-DINOv2-B_AG.yaml') },
    { n: 9, part: '§5.1 结果', title: '结果', sub: '切换表格；每根柱子是原文数字（越低越好）', dur: 12, cam: [0.0, 1.3, 34, [0, 4.0, 0]],
      html: dl([['配方演进', '23.08 → 4.81 → 4.28 → 2.16 → 1.51 → 1.13'], ['256，不加引导', 'DiT^DH-XL 1.51，REPA-E 1.70，VA-VAE 2.17'], ['256，加引导', 'DiT^DH-XL 1.13，REPA-E 1.15，xAR 1.24'], ['512，加引导', 'DiT^DH-XL 1.13，EDM2 1.25，DDT 1.28'], ['收敛', '80 epoch 2.16；对 SiT 47 倍、对 REPA 16 倍']]) +
        '<p>第一张是本文配方一步步加上去的效果（表 2 → 表 4 → 表 5 → 表 6 → 表 8）。后面三张是和其他方法的比较。</p>' +
        '<p>表 8 里基线有的用均衡采样重测过，有的没有（SiT 行用的是官方数），差别在 0.1 左右，见精读页读者注 14。</p>' + src('表 2、4、5、6、7、8 · 图 4') },
    { n: 10, part: '§6 讨论', title: '高分辨率、没有 RAE 的 DiT^DH、像素', sub: '切换 §6.1 / §6.2 / §6.3', dur: 12, cam: [0.0, 1.25, 34, [0, 3.8, 0]],
      html: dl([['§6.1', '256 个 token + p_d = 2p_e 的解码器直接出 512：gFID 1.61（直接 1024 token：1.13），便宜 4 倍'], ['§6.2', 'SD-VAE 上 DiT^DH-XL 11.70，比 DiT-XL 7.13 还差'], ['§6.3', '像素 patch 16（也是 768 维）：51.09 / 30.56，远差于 DINOv2-B 的 4.28 / 2.16']]) +
        '<p>三个对照说明：宽头只在高维隐空间里有用；而高维本身不够，要的是结构化的表示。§6.1 则说明解码器和扩散模型是解耦的，换一个上采样解码器就能出更高分辨率。</p>' +
        src('§6 表 9、10、11') },
    { n: 11, part: 'OpenWAM', title: '在 OpenWAM 里：4C 对 3072', sub: '切换编码器；看 token 维度、学不到的方向和 shift', dur: 13, cam: [0.0, 1.3, 30, [0, 4.6, 0]],
      html: dl([['DiT', 'Wan2.2-TI2V-5B 结构，随机初始化，宽 3072，patch (1, 2, 2)'], ['token 维度', '4C：Wan 192，FLUX.2 512，DINOv3 3072，V-JEPA 2.1 5632（ViT-L 4096），S-VAE 192'], ['RAE 条件', '4C ≤ 3072 才没有硬下界；V-JEPA 违反，DINOv3 正好相等'], ['shift', 'Wan 配置 5；代码对原始 DINOv3 / V-JEPA 建议 12；RAE 规则 α = √(m / 4096)']]) +
        '<p>OpenWAM 没有用 RAE 的检查点，只借了它的论据和“冻结编码器 + 无仿射 LayerNorm”的接法。蓝柱是 DiT 宽度 3072，旁边的柱子是一个 token 的输入维度 4C，超出的部分（红）是每个 token 至少学不到的噪声方向数。</p>' +
        '<p>右边三根小柱是 shift：OpenWAM 配置里的值、代码注释建议的值、按 RAE 公式算的值（只算 2 个带噪隐帧）。</p>' +
        live('4C、4C − 3072、α = √(2·24·20·C / 4096) 当场算。') + guess('RAE 公式的 α 是我把 RAE 的规则套到 OpenWAM 形状上的推算；图 7 实际用的 shift 未核实。') +
        src('OpenWAM §4.1.2 图 7 · 本站 openwam.html#qa-enc · OpenWAM 代码 1dcaeea：encoder/dinov3.yaml、vjepa21.yaml、wan22_ti2v_5b.yaml') }
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
        const x = x0 + (j - (Ns - 1) / 2) * (w + 0.08), b = block(w, 1, w, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(String(val), [x, 0, 0], { size: 15 }); sub.add(l); bars.push({ b, l, v: val, best: o.best && o.best(i, j) }); }); });
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

  /* ---------- scene 1: two latent spaces ---------- */
  function s1(G) {
    let enc = opt(0, 1, 3); const ENC = [['DINOv2-S', 384], ['DINOv2-B', 768], ['DINOv2-L', 1024]];
    G.add(L.grid(40, 20));
    const K = 0.0072, cell = 0.5, N = 16;
    const imV = inst(BOX, 256), imR = inst(BOX, 256); G.add(imV, imR);
    const pos = (cx, i, j) => [cx + (i - 7.5) * cell, 0, (j - 7.5) * cell];
    G.add(lab('SD-VAE：32 × 32 × 4 → patch 2', [-8, 1.6, 5.2], { size: 19, border: hexs(COL.vae) }));
    let lk = '', lrh = null, lt = null;
    G.add(lab('256 个 token × 16 维 = 4,096', [-8, 1.0, 6.4], { size: 17 }));
    G.add(lab('线性探测 ≈ 8%', [-8, 2.6, -4.6], { size: 16 }));
    const ctls = [{ label: 'RAE 编码器', items: ENC.map(e => e[0]), get: () => enc, set: k => { enc = k; } }];
    return { ctls, update(p) {
      const [nm, C] = ENC[enc], g = seg(p, 0.05, 0.45), hi = seg(p, 0.55, 0.8);
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const k = i * N + j, focus = (i === 15 && j === 15) ? hi : 0;
        const hv = 16 * K * g + 0.04, hr = C * K * g + 0.04;
        const pv = pos(-8, i, j), pr = pos(8, i, j);
        setI(imV, k, [pv[0], hv / 2, pv[2]], [cell * 0.82, hv, cell * 0.82]); colI(imV, k, hex3(focus ? COL.gold : COL.vae));
        setI(imR, k, [pr[0], hr / 2, pr[2]], [cell * 0.82, hr, cell * 0.82]); colI(imR, k, hex3(focus ? COL.gold : COL.rae));
      }
      done(imV); done(imR);
      const key = enc + '';
      if (lk !== key) { lk = key; dropLab(G, lrh); dropLab(G, lt);
        lrh = lab(`RAE（${nm}）：16 × 16 → patch 1`, [8, C * K + 1.6, -4.6], { size: 19, border: hexs(COL.rae) }); lt = lab(`256 个 token × ${C} 维 = ${fmt(256 * C)}`, [8, 1.0, 6.4], { size: 17 }); G.add(lrh, lt); }
      lrh.position.y = Math.max(1.6, C * K * g + 1.2);
      const ratio = (256 * C / 4096).toFixed(0);
      cap(p < 0.5 ? `两边都是 <b>256</b> 个 token：DiT 序列长度和注意力计算相同；每个 token 的维度 <b>16</b> 对 <b>${C}</b>` :
        `总维度 4,096 对 <b>${fmt(256 * C)}</b>（${ratio} 倍）· 金色柱是一个 token：进入 DiT 时先被线性投影到 DiT 宽度 · DINOv2-B 线性探测 84.5%`);
    } };
  }

  /* ---------- scene 2: RAE structure ---------- */
  function s2(G) {
    let enc = opt(0, 0, 3);
    const ENC = [['DINOv2-B', 14, 224, 0.49, '自蒸馏'], ['SigLIP2-B', 16, 256, 0.53, '语言监督'], ['MAE-B', 16, 256, 0.16, '掩码自编码']];
    const y = 2.2;
    const img = block(0.3, 3.2, 3.2, 0xd9a35b, [-15, y, 0]); G.add(img); G.add(lab('图像\n256 × 256', [-15, y + 2.5, 0], { size: 17 }));
    const encB = []; for (let i = 0; i < 12; i++) { const b = block(0.32, 3.0, 3.0, COL.frozen, [-11.6 + i * 0.5, y, 0]); G.add(b); encB.push(b); }
    let encL = null;
    G.add(lab('冻结', [-8.9, y + 2.4, 0], { size: 16, border: '#8e9bb8' }));
    const tok = inst(BOX, 64); G.add(tok);
    G.add(lab('256 × 768\n无仿射 LayerNorm', [-3.2, y + 2.7, 0], { size: 16 }));
    const nz = lab('＋ σ·ε（只在训练解码器时）', [-2.6, y - 3.6, 0], { size: 15, border: hexs(COL.gold) }); G.add(nz);
    const decB = []; for (let i = 0; i < 28; i++) { const b = block(0.2, 3.4, 3.4, COL.train, [-0.2 + i * 0.32, y, 0]); G.add(b); decB.push(b); }
    G.add(lab('ViT-XL 解码器（训练）\n28 层 × 1152 · p_d = 16', [4.2, y + 2.9, 0], { size: 17 }));
    const out = block(0.3, 3.2, 3.2, 0xd9a35b, [11.6, y, 0]); G.add(out); G.add(lab('重建\n256 × 256', [11.6, y + 2.5, 0], { size: 17 }));
    const disc = block(2.6, 1.0, 1.4, COL.frozen, [11.6, -1.6, 0]); G.add(disc); G.add(lab('判别器 DINO-S/8（冻结）+ 头', [11.6, -2.7, 0], { size: 15 }));
    G.add(lab('L1 + LPIPS + 0.75·λ·GAN', [5.4, -1.0, 0], { size: 17, border: hexs(COL.train) }));
    wire(G, [[11.6, y - 1.7, 0], [11.6, -1.0, 0]], COL.noise, { dashed: true });
    const flow = stream(G, 14, COL.gold, 0.12);
    let lk = '';
    const ctls = [{ label: '编码器', items: ENC.map(e => e[0]), get: () => enc, set: k => { enc = k; } }];
    return { ctls, update(p) {
      const [nm, pe, inp, rfid, kind] = ENC[enc], tokN = inp / pe;
      if (lk !== enc + '') { lk = enc + ''; dropLab(G, encL); encL = lab(`${nm}（${kind}）\npatch ${pe} · 输入 ${inp}`, [-9.4, y - 2.6, 0], { size: 17 }); G.add(encL); }
      const e = seg(p, 0.05, 0.35), n = seg(p, 0.38, 0.5), d = seg(p, 0.52, 0.85);
      encB.forEach((b, i) => glow(b, e > i / 12 && e < 1 ? 0.7 : 0.05));
      decB.forEach((b, i) => glow(b, d > i / 28 && d < 1 ? 0.7 : 0.05));
      const jit = n * (1 - d) * 0.25, r = L.rng(Math.floor(p * 30) + 1);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const k = i * 8 + j, s = e >= 1 ? 0.3 : 0.0001; setI(tok, k, [-4.6 + i * 0.4 + (r() - 0.5) * jit, y - 1.4 + j * 0.4 + (r() - 0.5) * jit, 0], s); colI(tok, k, hex3(n > 0 && d < 1 ? COL.gold : COL.rae)); }
      done(tok); nz.visible = n > 0;
      flow([[-15, y, 0.4], [-8.9, y, 0.4], [-3.2, y, 0.4], [4.2, y, 0.4], [11.6, y, 0.4]], (p * 2) % 1, 1);
      glow(out, d >= 1 ? 0.5 : 0.05);
      cap(p < 0.36 ? `${nm}：输入缩到 ${inp} × ${inp}，patch ${pe} → ${tokN} × ${tokN} = <b>${tokN * tokN}</b> 个 token，每个 768 维；编码器不训练` :
        p < 0.52 ? '训练解码器时给 token 加噪声 σ·ε（代码 σ = 0.8·U(0, 1)，推理时不加）' :
        `ViT-XL 解码器把 256 个 token 还原成 256 × 256 图 · ${nm} 的 rFID <b>${rfid}</b>（SD-VAE 0.62）`);
    } };
  }

  /* ---------- scene 3: reconstruction tables ---------- */
  function s3(G) {
    let view = opt(0, 0, 4); const sub = new THREE.Group(); G.add(sub); G.add(L.grid(34, 34));
    const T = [
      { t: '表 1a · rFID（越低越好）', g: ['DINOv2-B', 'SigLIP2-B', 'MAE-B', 'SD-VAE'], s: [['rFID', COL.rae, [0.49, 0.53, 0.16, 0.62]]], hi: 0.7 },
      { t: '表 1b · 解码器：rFID 和 GFLOPs（÷ 100）', g: ['ViT-B', 'ViT-L', 'ViT-XL', 'SD-VAE'], s: [['rFID', COL.rae, [0.58, 0.50, 0.49, 0.62]], ['GFLOPs ÷ 100', COL.gold, [0.222, 0.781, 1.067, 3.104]]], hi: 3.2 },
      { t: '表 1c · 编码器大小的 rFID', g: ['DINOv2-S', 'DINOv2-B', 'DINOv2-L'], s: [['rFID', COL.rae, [0.52, 0.49, 0.52]]], hi: 0.7 },
      { t: '表 1d · 线性探测 Top-1（%）', g: ['DINOv2-B', 'SigLIP2-B', 'MAE-B', 'SD-VAE'], s: [['%', COL.train, [84.5, 79.1, 68.0, 8.0]]], hi: 90 }
    ];
    let draw = null, last = -1;
    const rebuild = () => { clearSub(sub); last = view; draw = chart(sub, T[view], {}); };
    rebuild();
    const MSG = ['三个冻结编码器的 rFID 都低于 SD-VAE；MAE-B 0.16 最低', 'ViT-B 解码器已胜 SD-VAE，计算 22.2 对 310.4（约 1/14）；ViT-XL 约 1/3', '编码器从 S 到 L，rFID 基本不变：小编码器也保留了低层细节', 'RAE 直接继承编码器的表示；SD-VAE 只有约 8%'];
    const ctls = [{ label: '子表', items: ['(a) 编码器', '(b) 解码器', '(c) 大小', '(d) 表示'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) { if (last !== view) rebuild(); draw(seg(p, 0, 0.5)); cap(MSG[view]); } };
  }

  /* ---------- scene 4: width vs token dimension (interactive) ---------- */
  function s4(G) {
    const NS = [[384, 'DINOv2-S'], [768, 'DINOv2-B'], [1024, 'DINOv2-L']], DS = [384, 512, 640, 768, 896, 1152, 2048], DP = [12, 24];
    let ni = opt(0, 1, 3), di = opt(1, 0, DS.length), dpi = opt(2, 0, 2);
    const OBS = { 768: { 384: 0.52, 512: 0.35, 640: 0.18, 768: 0.02, 896: 0.0 }, 1024: { 384: 0.65, 768: 0.27, 1024: 0.022 }, 384: { 384: 0.036, 768: 0.001, 1024: 0.00097 } };
    const SRC = { 768: '图 3（目测）+ 表 3', 1024: '表 3', 384: '表 3' };
    const U = 32, cs = 0.25, CAP = 40;   /* one cube = 32 dims; the middle column shows at most 40 cubes */
    const inCol = inst(BOX, 40), midCol = inst(BOX, CAP), outCol = inst(BOX, 40); G.add(inCol, midCol, outCol);
    const blocks = new THREE.Group(); G.add(blocks);
    const wires = new THREE.Group(); G.add(wires);
    G.add(lab('一个 token：n 维输入', [-13.2, -0.9, 0], { size: 15 }), lab('n 维输出', [3.6, -0.9, 0], { size: 15 }));
    /* right: loss-floor chart, d from 256 to 2176 */
    const CX = 6.8, CW = 8.4, CY = 0.2, CH = 6.4, dx = d => CX + CW * (d - 256) / 1920, ly = v => CY + CH * Math.min(v, 0.75) / 0.75;
    panel(G, CX - 0.5, CY - 1.4, -0.2, CW + 1.0, CH + 2.6);
    wire(G, [[CX, CY, 0], [CX + CW, CY, 0]], 0x8e9bb8, { opacity: 0.8 }); wire(G, [[CX, CY, 0], [CX, CY + CH, 0]], 0x8e9bb8, { opacity: 0.8 });
    [384, 1152, 2048].forEach(d => G.add(lab(String(d), [dx(d), CY - 0.45, 0], { size: 13 })));
    [0.25, 0.5].forEach(v => G.add(lab(v.toFixed(2), [CX - 0.75, ly(v), 0], { size: 13 })));
    G.add(lab('宽度 d →', [dx(1600), CY - 1.05, 0], { size: 14 }));
    const floorR = ribbon(G, 120, COL.bad, 0.07, { order: 3 });
    const obs = inst(BALL, 8); obs.material.emissive.setHex(COL.ok); obs.material.emissiveIntensity = 0.4; G.add(obs);
    const cur = L.sphere(0.22, COL.gold); cur.material.emissive.setHex(COL.gold); cur.material.emissiveIntensity = 0.4; G.add(cur);
    const flow = stream(G, 10, COL.gold, 0.1);
    let key = '', tl = null, ol = null, lA = null, lB = null, hm = 1, hn = 1;
    const ctls = [
      { label: 'token 维度 n', items: NS.map(([n, m]) => `${n}（${m}）`), get: () => ni, set: k => { ni = k; } },
      { label: 'DiT 宽度 d', items: DS.map(String), get: () => di, set: k => { di = k; } },
      { label: '深度', items: DP.map(String), get: () => dpi, set: k => { dpi = k; } }
    ];
    function rebuild() {
      const n = NS[ni][0], d = DS[di], dep = DP[dpi], cn = n / U, cd = d / U, cdv = Math.min(cd, CAP);
      hm = cdv * cs; hn = cn * cs;
      clearSub(blocks); clearSub(wires); dropLab(G, lA); dropLab(G, lB);
      const wd = 0.9 + 1.6 * d / 2048, bx0 = -7.0, bstep = 6.6 / dep;
      for (let i = 0; i < dep; i++) blocks.add(block(bstep * 0.6, hm + 0.3, wd, d >= n ? COL.train : COL.rae, [bx0 + (i + 0.5) * bstep, hm / 2, 0], { opacity: 0.9 }));
      blocks.add(lab(`${dep} 个 DiT 块 · 宽 ${d}` + (cd > CAP ? `（中间列只画 ${CAP * U} 维）` : ''), [bx0 + 3.3, hm + 1.0, 0], { size: 16 }));
      const stepW = Math.max(1, Math.floor(cn / 8));
      for (let i = 0; i <= cn; i += stepW) { wires.add(L.line([[-12.7, i * cs, 0], [-8.0, i / cn * hm, 0]], 0x8e9bb8, { opacity: 0.35 })); wires.add(L.line([[0.0, i / cn * hm, 0], [3.1, i * cs, 0]], 0x8e9bb8, { opacity: 0.35 })); }
      lA = lab('A：n → d', [-10.3, Math.max(hn, hm) + 0.6, 0], { size: 15 }); lB = lab('B：d → n', [1.5, Math.max(hn, hm) + 0.6, 0], { size: 15 }); G.add(lA, lB);
      const pts = []; for (let i = 0; i < 120; i++) { const dd = 256 + 1920 * i / 119; pts.push([dx(dd), ly(Math.max(0, (n - dd) / n)), 0.05]); } floorR.userData.set(pts);
      const o = OBS[n], ks = Object.keys(o);
      for (let i = 0; i < 8; i++) { if (i < ks.length) { setI(obs, i, [dx(+ks[i]), ly(o[ks[i]]), 0.1], 0.16); colI(obs, i, hex3(COL.ok)); } else setI(obs, i, [0, -99, 0], 0.0001); }
      done(obs);
      dropLab(G, tl); dropLab(G, ol);
      tl = lab(`红线：下界 max(0, (n − d)/n)，n = ${n}`, [CX + CW / 2, CY + CH + 1.25, 0], { size: 15, color: '#ff8a7a' }); ol = lab(`绿点：原文（${SRC[n]}）· 金点：本次`, [CX + CW / 2, CY + CH + 0.05, 0], { size: 14, color: '#7fe0a8' }); G.add(tl, ol);
    }
    return { ctls, update(p) {
      const k = `${ni},${di},${dpi}`; if (k !== key) { key = k; rebuild(); }
      const n = NS[ni][0], d = DS[di], cn = n / U, cd = d / U, cdv = Math.min(cd, CAP), reach = Math.min(cn, cd), floor = Math.max(0, (n - d) / n);
      for (let i = 0; i < 40; i++) {
        if (i < cn) { setI(inCol, i, [-13.2, i * cs + cs / 2, 0], [0.9, cs * 0.8, 0.9]); colI(inCol, i, hex3(COL.rae)); } else setI(inCol, i, [0, -99, 0], 0.0001);
        if (i < cn) { setI(outCol, i, [3.6, i * cs + cs / 2, 0], [0.9, cs * 0.8, 0.9]); colI(outCol, i, hex3(i < reach ? COL.ok : COL.bad)); } else setI(outCol, i, [0, -99, 0], 0.0001);
      }
      for (let i = 0; i < CAP; i++) { if (i < cdv) { setI(midCol, i, [-7.6, i * cs + cs / 2, 0], [0.55, cs * 0.8, 0.55]); colI(midCol, i, hex3(COL.gold)); } else setI(midCol, i, [0, -99, 0], 0.0001); }
      done(inCol); done(outCol); done(midCol);
      const loss = floor + (1 - floor) * Math.exp(-6 * seg(p, 0.05, 0.9));
      cur.position.set(dx(d), ly(loss), 0.2);
      flow([[-13.2, hn / 2, 0.6], [-7.6, hm / 2, 0.6], [0.0, hm / 2, 0.6], [3.6, hn / 2, 0.6]], (p * 2) % 1, 1);
      const o = OBS[n][d];
      cap(`n = <b>${n}</b>，d = <b>${d}</b>，深度 ${DP[dpi]} · 学不到的方向 ${Math.max(0, n - d)} 个 · 下界 (n − d)/n = <b>${floor.toFixed(3)}</b>` +
        (o != null ? ` · 原文观测 <b>${o}</b>` : '') + ` · 本次损失（示意）${loss.toFixed(3)}` + (d >= n ? ' · d ≥ n：能拟合' : ' · d &lt; n：拟合不了'));
    } };
  }

  /* ---------- scene 5: dimension-dependent shift ---------- */
  function s5(G) {
    const MS = [['SD-VAE 256', 4096], ['RAE 256（DINOv2-B）', 196608], ['RAE 512', 786432], ['DINOv2-L 256', 262144]];
    let mi = opt(0, 1, MS.length);
    const PX = -12, PW = 9.5, PY = 0, PH = 9.5, px = t => PX + PW * t, py = t => PY + PH * t;
    panel(G, PX - 0.5, PY - 0.5, -0.2, PW + 1, PH + 1);
    wire(G, [[px(0), py(0), 0], [px(1), py(0), 0]], 0x8e9bb8, { opacity: 0.8 }); wire(G, [[px(0), py(0), 0], [px(0), py(1), 0]], 0x8e9bb8, { opacity: 0.8 });
    wire(G, [[px(0), py(0), 0], [px(1), py(1), 0]], 0x8e9bb8, { dashed: true, opacity: 0.6 });
    G.add(lab('t_n（均匀）', [px(0.5), py(0) - 0.6, 0], { size: 14 }), lab('t_m', [px(0) - 0.8, py(1), 0], { size: 14 }), lab('α = 1', [px(0.85), py(0.72), 0], { size: 13 }));
    const curve = ribbon(G, 160, COL.gold, 0.1, { order: 3 });
    const dot = L.sphere(0.22, COL.act); G.add(dot);
    /* sampling steps */
    const SX = 1.2, SW = 12, SY = 7.6;
    wire(G, [[SX, SY, 0], [SX + SW, SY, 0]], 0x8e9bb8, { opacity: 0.8 });
    G.add(lab('采样 50 步（t：1 → 0）', [SX + SW / 2, SY + 1.4, 0], { size: 16 }), lab('数据 0', [SX, SY - 0.6, 0], { size: 13 }), lab('1 噪声', [SX + SW, SY - 0.6, 0], { size: 13 }));
    const st = inst(BALL, 50); st.material.emissive.setHex(COL.rae); st.material.emissiveIntensity = 0.5; G.add(st);
    /* histogram */
    const HX = 1.2, HW = 12, HY = 0.2, HH = 4.6, NB = 20;
    wire(G, [[HX, HY, 0], [HX + HW, HY, 0]], 0x8e9bb8, { opacity: 0.8 });
    G.add(lab('训练时间步直方图（logit-normal → shift）', [HX + HW / 2, HY + HH + 0.9, 0], { size: 15 }), lab('0', [HX, HY - 0.5, 0], { size: 13 }), lab('1', [HX + HW, HY - 0.5, 0], { size: 13 }));
    const hb = inst(BOX, NB); G.add(hb);
    const r = L.rng(11), U0 = []; for (let i = 0; i < 4000; i++) { const z = L.gauss(r), t = 1 / (1 + Math.exp(-z)); U0.push(t); }
    const ctls = [{ label: '有效维度 m', items: MS.map(([nm, m]) => `${nm}`), get: () => mi, set: k => { mi = k; } }];
    return { ctls, update(p) {
      const [nm, m] = MS[mi], a = alphaOf(m), g = seg(p, 0, 0.4);
      const pts = []; for (let i = 0; i < 160; i++) { const t = i / 159; pts.push([px(t), py(L.lerp(t, shiftF(t, a), g)), 0.05]); } curve.userData.set(pts);
      const tt = (p * 1.25) % 1; dot.position.set(px(tt), py(L.lerp(tt, shiftF(tt, a), g)), 0.12);
      const ns = Math.round(seg(p, 0.3, 0.9) * 50);
      for (let i = 0; i < 50; i++) { const t = shiftF(1 - i / 49, L.lerp(1, a, g)); setI(st, i, [SX + SW * t, SY, 0], i < ns ? 0.13 : 0.0001); colI(st, i, hex3(COL.rae)); }
      done(st);
      const cnt = new Array(NB).fill(0); let hiN = 0; for (const u of U0) { const t = shiftF(u, a); cnt[Math.min(NB - 1, Math.floor(t * NB))]++; if (t > 0.5) hiN++; }
      const mx = Math.max(...cnt);
      for (let i = 0; i < NB; i++) { const h = Math.max(0.02, HH * cnt[i] / mx * g); setI(hb, i, [HX + HW * (i + 0.5) / NB, HY + h / 2, 0], [HW / NB * 0.85, h, 0.4]); colI(hb, i, hex3(COL.gold)); }
      done(hb);
      const mid = shiftF(0.5, a);
      cap(`${nm}：m = <b>${fmt(m)}</b>，α = √(m / 4096) = <b>${a.toFixed(2)}</b> · 均匀进度 0.5 对应 t = ${mid.toFixed(3)} · 训练样本里 t > 0.5（偏噪声）占 <b>${(100 * hiN / 4000).toFixed(1)}%</b>` + (mi === 1 ? ' · 表 4：23.08 → 4.81' : ''));
    } };
  }

  /* ---------- scene 6: noise-augmented decoding (toy) ---------- */
  function s6(G) {
    const TAU = [0, 0.5, 0.8, 1.0], GF = [4.81, 4.39, 4.28, 4.20], RF = [0.49, 0.54, 0.57, 0.60];
    let ti = opt(0, 2, 4), di = opt(1, 0, 2);
    const r = L.rng(5), TR = [], GEN = [];
    for (let i = 0; i < 40; i++) TR.push([-11 + r() * 12, 0.6 + r() * 7.6]);
    for (let i = 0; i < 40; i++) { const b = TR[Math.floor(r() * 40)], a = r() * Math.PI * 2, d = 0.45 * (0.3 + 1.4 * r()); GEN.push([b[0] + Math.cos(a) * d, b[1] + Math.sin(a) * d]); }
    panel(G, -12, 0, -0.3, 14, 9);
    const tr = inst(BALL, 40); tr.material.emissive.setHex(COL.rae); tr.material.emissiveIntensity = 0.4; G.add(tr);
    const disc = inst(DISC, 40, { opacity: 0.22, depthWrite: false }); G.add(disc);
    const gen = inst(BALL, 40); G.add(gen);
    const jit = inst(BALL, 120); jit.material.emissive.setHex(COL.gold); jit.material.emissiveIntensity = 0.3; G.add(jit);
    G.add(lab('蓝：训练隐变量 · 圈：解码器见过的邻域 · 橙：生成的隐变量（→ 绿 / 红）', [-5, -0.9, 0], { size: 15 }));
    const bG = bar(G, 5.5, 0, 1.2, COL.rae), bR = bar(G, 8.5, 0, 1.2, COL.gold);
    G.add(lab('gFID', [5.5, -0.5, 0.8], { size: 15 }), lab('rFID × 8', [8.5, -0.5, 0.8], { size: 15 }));
    let lg = null, lr = null, lk = '';
    const ctls = [{ label: 'τ', items: TAU.map(String), get: () => ti, set: k => { ti = k; } }, { label: 'σ 分布', items: ['论文 |N(0, τ²)|', '代码 τ·U(0, 1)'], get: () => di, set: k => { di = k; } }];
    return { ctls, update(p) {
      const tau = TAU[ti], ms = di === 0 ? tau * Math.sqrt(2 / Math.PI) : tau / 2, R = ms * 1.0, g = seg(p, 0, 0.3);
      for (let i = 0; i < 40; i++) { setI(tr, i, [TR[i][0], TR[i][1], 0], 0.14); colI(tr, i, hex3(COL.rae));
        setI(disc, i, [TR[i][0], TR[i][1], -0.1], Math.max(0.0001, R * g)); colI(disc, i, hex3(COL.rae)); }
      done(tr); done(disc);
      /* training phase: noisy copies flicker (seeded by frame index so update stays a function of p) */
      const tr2 = p < 0.45, rr = L.rng(1 + Math.floor(p * 40));
      for (let i = 0; i < 120; i++) { const b = TR[i % 40], s = di === 0 ? Math.abs(L.gauss(rr)) * tau : rr() * tau, a = rr() * Math.PI * 2;
        setI(jit, i, [b[0] + Math.cos(a) * s * 0.9, b[1] + Math.sin(a) * s * 0.9, 0.05], tr2 && tau > 0 ? 0.06 : 0.0001); }
      done(jit);
      const ng = Math.round(seg(p, 0.45, 0.9) * 40); let inside = 0;
      for (let i = 0; i < 40; i++) { const q = GEN[i]; let dmin = 1e9; for (const t of TR) dmin = Math.min(dmin, Math.hypot(t[0] - q[0], t[1] - q[1])); const ok = dmin <= R; if (ok) inside++;
        setI(gen, i, [q[0], q[1], 0.1], i < ng ? 0.13 : 0.0001); colI(gen, i, hex3(p < 0.92 ? COL.act : ok ? COL.ok : COL.bad)); }
      done(gen);
      bG.userData.set(GF[ti] / 5 * 6 * g); bR.userData.set(RF[ti] * 8 / 5 * 6 * g);
      if (lk !== ti + '') { lk = ti + ''; dropLab(G, lg); dropLab(G, lr); lg = lab(String(GF[ti]), [5.5, 1, 0.8], { size: 16 }); lr = lab(String(RF[ti]), [8.5, 1, 0.8], { size: 16 }); G.add(lg, lr); }
      lg.position.y = GF[ti] / 5 * 6 * g + 0.5; lr.position.y = RF[ti] * 8 / 5 * 6 * g + 0.5;
      cap(p < 0.45 ? `训练解码器：每个隐变量加 σ·ε（${di === 0 ? '论文 σ ~ |N(0, τ²)|' : '代码 σ = τ·U(0, 1)'}），τ = ${tau}，σ 均值 <b>${ms.toFixed(2)}</b>` :
        `生成的 40 个隐变量里 <b>${inside}</b> 个落在解码器见过的邻域内（玩具）· 表 15c：τ = ${tau} 时 gFID ${GF[ti]}、rFID ${RF[ti]}`);
    } };
  }

  /* ---------- scene 7: DiT^DH ---------- */
  function s7(G) {
    const HW = [768, 1536, 2048, 2688], EN = [['DINOv2-S', 384], ['DINOv2-B', 768], ['DINOv2-L', 1024]];
    const T17 = [[2.66, 2.47, 2.42, 2.43], [2.49, 2.24, 2.16, 2.22], [null, 2.95, 2.73, 2.64]];
    let hi = opt(0, 2, 4), ei = opt(1, 1, 3);
    const y = 1.4, wsc = w => 0.6 + 3.4 * w / 2688;
    const xin = block(1.0, 2.4, 1.0, COL.rae, [-15, y, 0]); G.add(xin);
    const bb = []; for (let i = 0; i < 28; i++) { const b = block(0.26, 2.6, wsc(1152), COL.vid, [-12.8 + i * 0.36, y, 0], { opacity: 0.92 }); G.add(b); bb.push(b); }
    G.add(lab('骨干 DiT-XL：28 层 × 1152', [-7.8, y + 2.6, 0], { size: 17 }));
    const proj = block(0.5, 1.2, 1.2, COL.gold, [-1.6, y + 3.6, 0]); G.add(proj);
    const hg = new THREE.Group(); G.add(hg);
    const vout = block(1.0, 2.4, 1.0, COL.rae, [7.2, y, 0]); G.add(vout); G.add(lab('v_t\n256 × n', [7.2, y + 2.4, 0], { size: 16 }));
    wire(G, [[-15, y - 1.5, 0], [-15, y - 3.2, 0], [1.4, y - 3.2, 0], [1.4, y - 1.4, 0]], COL.rae, { opacity: 0.8 });
    wire(G, [[-2.5, y, 0], [-1.6, y + 3.0, 0]], COL.gold, { opacity: 0.8 }); wire(G, [[-1.3, y + 3.6, 0], [2.2, y + 2.0, 0]], COL.gold, { opacity: 0.8 });
    G.add(lab('x_t 直接进头（自己的嵌入层）', [-6.8, y - 3.8, 0], { size: 15 }));
    G.add(lab('silu(t + s) → 线性 1152 → w\n逐 token adaLN 条件', [-1.6, y + 5.2, 0], { size: 14 }));
    const fA = stream(G, 10, COL.vid, 0.1), fB = stream(G, 10, COL.rae, 0.1), fC = stream(G, 6, COL.gold, 0.1);
    let key = '', xl = null, hl = null;
    const ctls = [{ label: '头宽 w', items: HW.map(String), get: () => hi, set: k => { hi = k; } }, { label: '编码器', items: EN.map(e => `${e[0]}（${e[1]}）`), get: () => ei, set: k => { ei = k; } }];
    return { ctls, update(p) {
      const w = HW[hi], [enm, n] = EN[ei], k = hi + ',' + ei;
      if (k !== key) { key = k; clearSub(hg); for (let i = 0; i < 2; i++) hg.add(block(0.7, 2.8, wsc(w), w >= n ? COL.head : COL.bad, [2.4 + i * 1.3, y, 0], { opacity: 0.92 }));
        hg.add(lab(`DDT 头：2 层 × ${w}`, [3.05, y + 2.9, 0], { size: 17, border: hexs(COL.head) }));
        dropLab(G, xl); xl = lab(`x_t\n256 × ${n}`, [-15, y + 2.4, 0], { size: 16 }); G.add(xl); }
      const a = seg(p, 0.05, 0.6), b2 = seg(p, 0.6, 0.95);
      bb.forEach((b, i) => glow(b, a > i / 28 && a < 1 ? 0.7 : 0.05));
      hg.children.forEach(c => { if (c.userData.c) glow(c, b2 > 0 && b2 < 1 ? 0.7 : 0.05); });
      fA([[-15, y + 0.2, 0.6], [-2.5, y + 0.2, 0.6]], (p * 2) % 1, a < 1 ? 1 : 0);
      fB([[-15, y - 1.5, 0.3], [-15, y - 3.2, 0.3], [1.4, y - 3.2, 0.3], [1.4, y - 1.4, 0.3], [7.2, y, 0.3]], (p * 1.5) % 1, 1);
      fC([[-2.5, y, 0.4], [-1.6, y + 3.0, 0.4], [2.2, y + 2.0, 0.4]], (p * 2) % 1, a >= 0.5 ? 1 : 0);
      const P = ditdh(n, 1152, 28, w, 2);
      const fid = T17[ei][hi];
      cap(`${enm}（n = ${n}）+ 头宽 ${w}：主路径最窄处 <b>${w}</b> ${w >= n ? '≥' : '<'} n · 参数 <b>${(P / 1e6).toFixed(1)}M</b>（比同骨干的 DiT 多 ${((P - ditdh(n, 1152, 28, 1152, 0)) / 1e6).toFixed(0)}M）· 表 17 gFID <b>${fid == null ? 'N/A（不满足宽度条件）' : fid}</b>` + (hi === 2 && ei === 1 ? ' · 默认配置，表 8 写 839M' : ''));
    } };
  }

  /* ---------- scene 8: training and sampling (toy 2-D) ---------- */
  function s8(G) {
    const a = alphaOf(196608);
    /* left: one training sample */
    const LX = -8, X = [-12, 1.2], E = [-4.5, 7.8];
    panel(G, -14, -0.6, -0.3, 11.5, 10.2);
    const px = L.sphere(0.3, COL.rae), pe = L.sphere(0.3, COL.noise), pt = L.sphere(0.26, COL.gold); G.add(px, pe, pt);
    wire(G, [[X[0], X[1], 0], [E[0], E[1], 0]], 0x8e9bb8, { dashed: true, opacity: 0.7 });
    G.add(lab('数据 x', [X[0] - 0.4, X[1] - 0.8, 0], { size: 15 }), lab('噪声 ε', [E[0] + 0.3, E[1] + 0.7, 0], { size: 15 }));
    const vArr = arrowTo(G, [0, 0, 0], [1, 1, 0], 0xb8c4da);
    /* right: sampling */
    const T0 = [10.5, 8.2], D1 = [4.6, 1.4], D2 = [6.6, 2.6];
    panel(G, 1.6, -0.6, -0.3, 13, 10.2);
    const tgt = L.sphere(0.3, COL.ok), tgtS = L.sphere(0.22, COL.purple); G.add(tgt, tgtS);
    tgt.position.set(D1[0], D1[1], 0); tgtS.position.set(D2[0], D2[1], 0);
    G.add(lab('XL 的目标', [D1[0] - 0.6, D1[1] - 0.8, 0], { size: 14 }), lab('弱模型 S', [D2[0] + 1.6, D2[1] + 0.2, 0], { size: 14 }));
    const steps = inst(BALL, 51); steps.material.emissive.setHex(COL.act); steps.material.emissiveIntensity = 0.5; G.add(steps);
    const aXL = arrowTo(G, [0, 0, 0], [1, 0, 0], COL.ok), aS = arrowTo(G, [0, 0, 0], [1, 0, 0], COL.purple), aG = arrowTo(G, [0, 0, 0], [1, 0, 0], COL.act);
    const dec = block(1.6, 1.6, 1.6, COL.train, [13.6, 4.2, 0]); G.add(dec); G.add(lab('解码器\n→ 图像', [13.6, 6.0, 0], { size: 14 }));
    const ts = []; for (let i = 0; i <= 50; i++) ts.push(shiftF(1 - i / 50, a));
    const w = 1.42, Dg = [D2[0] + w * (D1[0] - D2[0]), D2[1] + w * (D1[1] - D2[1])];
    /* guided target: straight flow toward the extrapolated point; v = eps - x so x_t = (1-t) D + t eps */
    const posAt = t => [L.lerp(Dg[0], T0[0], t), L.lerp(Dg[1], T0[1], t)];
    return { update(p) {
      /* left */
      const r = L.rng(3 + Math.floor(p * 6)), u = 1 / (1 + Math.exp(-L.gauss(r))), t = shiftF(u, a);
      px.position.set(X[0], X[1], 0); pe.position.set(E[0], E[1], 0);
      const xt = [L.lerp(X[0], E[0], t), L.lerp(X[1], E[1], t)]; pt.position.set(xt[0], xt[1], 0.1);
      setArrow(vArr, [xt[0], xt[1] - 1.3, 0.1], [xt[0] + (E[0] - X[0]) * 0.35, xt[1] - 1.3 + (E[1] - X[1]) * 0.35, 0.1]);
      /* right */
      const k = Math.round(seg(p, 0.05, 0.85) * 50);
      for (let i = 0; i <= 50; i++) { const q = posAt(ts[i]); setI(steps, i, [q[0], q[1], 0], i <= k ? 0.11 : 0.0001); colI(steps, i, hex3(COL.act)); }
      done(steps);
      const q = posAt(ts[Math.min(50, k)]), tn = ts[Math.min(50, k)];
      const vX = [D1[0] - q[0], D1[1] - q[1]], vS = [D2[0] - q[0], D2[1] - q[1]], sc = 0.35;
      setArrow(aXL, [q[0], q[1], 0.2], [q[0] + vX[0] * sc, q[1] + vX[1] * sc, 0.2]); setArrow(aS, [q[0], q[1], 0.2], [q[0] + vS[0] * sc, q[1] + vS[1] * sc, 0.2]);
      setArrow(aG, [q[0], q[1], 0.25], [q[0] + (vS[0] + w * (vX[0] - vS[0])) * sc, q[1] + (vS[1] + w * (vX[1] - vS[1])) * sc, 0.25]);
      [aXL, aS, aG].forEach(x => { x.visible = k < 50; });
      glow(dec, k >= 50 ? 0.7 : 0.05);
      cap(`左：训练样本 t = <b>${t.toFixed(3)}</b>（logit-normal 后 shift，α = 6.93），x_t = (1 − t)x + tε，目标 ε − x · 右：第 <b>${k}</b> / 50 步，t = ${tn.toFixed(3)}；绿 = XL，紫 = 弱模型 S，橙 = S + 1.42(XL − S)`);
    } };
  }

  /* ---------- scene 9: results ---------- */
  function s9(G) {
    let view = opt(0, 0, 4); G.add(L.grid(34, 34)); const sub = new THREE.Group(); G.add(sub);
    const T = [
      { t: '配方演进（256，不加引导，gFID）', g: ['标准 DiT-XL', '+ shift', '+ 噪声解码', 'DiT^DH-XL 80ep', '800ep', '+ AutoGuidance'], s: [['', COL.rae, [23.08, 4.81, 4.28, 2.16, 1.51, 1.13]]], hi: 24 },
      { t: '表 8 · 256 不加引导（gFID）', g: ['SiT 1400ep', 'DDT 400ep', 'REPA 800ep', 'VA-VAE 800ep', 'REPA-E 800ep', 'DiT-XL(S) 800ep', 'DiT^DH-XL 800ep'], s: [['', COL.vid, [8.61, 6.27, 5.78, 2.17, 1.70, 1.87, 1.51]]], hi: 9 },
      { t: '表 8 · 256 加引导（gFID）', g: ['SiT', 'MAR', 'REPA', 'xAR', 'DDT', 'REPA-E', 'DiT^DH-XL'], s: [['', COL.act, [2.06, 1.55, 1.29, 1.24, 1.26, 1.15, 1.13]]], hi: 2.2 },
      { t: '表 7 · 512 加引导（gFID）', g: ['DiT', 'SiT', 'REPA', 'XAR', 'SiD2', 'DDT', 'EDM2', 'DiT^DH-XL'], s: [['', COL.purple, [3.04, 2.62, 2.08, 1.70, 1.50, 1.28, 1.25, 1.13]]], hi: 3.2 }
    ];
    let draw = null, last = -1;
    const rebuild = () => { clearSub(sub); last = view; const v = T[view]; draw = chart(sub, v, { best: i => i === v.g.length - 1 }); };
    rebuild();
    const MSG = ['三处修正把 23.08 降到 4.28；宽头再到 2.16；长训练 1.51；AutoGuidance 1.13', '不加引导 1.51，好于 REPA-E 的 1.70；基线有的经均衡采样重测', '加引导 1.13，和 REPA-E 1.15 很接近', '512：400 个 epoch 1.13，好于 EDM2 1.25'];
    const ctls = [{ label: '表', items: ['配方演进', '256 无引导', '256 有引导', '512'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) { if (last !== view) rebuild(); draw(seg(p, 0, 0.5)); cap(MSG[view]); } };
  }

  /* ---------- scene 10: §6 discussions ---------- */
  function s10(G) {
    let view = opt(0, 0, 3); G.add(L.grid(34, 34)); const sub = new THREE.Group(); G.add(sub);
    let draw = null, last = -1, toks = null;
    function rebuild() {
      clearSub(sub); last = view; toks = null;
      if (view === 0) {
        const im1 = inst(BOX, 1024), im2 = inst(BOX, 256); sub.add(im1, im2);
        for (let i = 0; i < 32; i++) for (let j = 0; j < 32; j++) { setI(im1, i * 32 + j, [-12 + i * 0.25, 0.1, -4 + j * 0.25], 0.2); colI(im1, i * 32 + j, hex3(COL.rae)); }
        for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { setI(im2, i * 16 + j, [2 + i * 0.5, 0.1, -4 + j * 0.5], 0.4); colI(im2, i * 16 + j, hex3(COL.gold)); }
        done(im1); done(im2);
        sub.add(lab('直接 512：1,024 个 token\ngFID 1.13 · rFID 0.53', [-8.1, 2.6, -0.1], { size: 17 }), lab('解码器上采样：256 个 token，p_d = 2p_e\ngFID 1.61 · rFID 0.97 · 便宜 4 倍', [5.9, 2.6, -0.1], { size: 17 }), lab('表 9 · 512 × 512，都训 400 epoch', [-1, 5.4, 0], { size: 20, border: 'rgba(56,209,255,.7)' }));
        toks = [im1, im2]; draw = () => {};
      } else if (view === 1) draw = chart(sub, { t: '表 10 · SD-VAE 上的 DiT^DH（gFID，80 epoch）', g: ['SD-VAE', 'DINOv2-B'], s: [['DiT-XL', COL.vid, [7.13, 4.28]], ['DiT^DH-XL', COL.head, [11.70, 2.16]]], hi: 12 }, { span: 14 });
      else draw = chart(sub, { t: '表 11 · 像素（patch 16，768 维）对 RAE（gFID）', g: ['像素', 'DINOv2-B'], s: [['DiT-XL', COL.vid, [51.09, 4.28]], ['DiT^DH-XL', COL.head, [30.56, 2.16]]], hi: 52 }, { span: 14 });
    }
    rebuild();
    const MSG = ['解码器和扩散模型解耦：256 token 的扩散模型配一个上采样解码器就能出 512 图', '低维 VAE 隐空间里，宽头帮不上忙，反而更差', '同样 768 维的像素 patch 远差于 DINOv2-B：要的是结构化表示，不只是高维'];
    const ctls = [{ label: '小节', items: ['§6.1 高分辨率', '§6.2 没有 RAE', '§6.3 像素'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) { if (last !== view) rebuild(); draw(seg(p, 0, 0.5)); if (toks) toks.forEach(t => { t.position.y = 0; t.scale.y = Math.max(0.01, seg(p, 0, 0.4)); }); cap(MSG[view]); } };
  }

  /* ---------- scene 11: OpenWAM ---------- */
  function s11(G) {
    const V = [['Wan2.2-VAE', 48, 5, 5, 90.30], ['FLUX.2-VAE', 128, 5, 5, 84.26], ['DINOv3', 768, 5, 12, 76.42], ['DINOv3 + S-VAE', 48, 5, 5, 90.18], ['V-JEPA 2.1（ViT-g）', 1408, 5, 12, 80.91], ['V-JEPA 2.1（ViT-L）', 1024, 5, 12, 80.91], ['V-JEPA 2.1 + S-VAE', 48, 5, 5, 88.46]];
    let vi = opt(0, 4, V.length);
    G.add(L.grid(34, 34));
    const K = 1 / 900;
    const wBar = bar(G, -9.4, 0, 2.2, COL.vid, { opacity: 0.85 }), cBar = bar(G, -4.6, 0, 2.2, COL.rae), oBar = bar(G, -4.6, 0, 2.25, COL.bad, { y0: 0 });
    G.add(lab('DiT 宽度', [-9.4, -0.5, 1.6], { size: 15 }), lab('token 维度 4C', [-4.6, -0.5, 1.6], { size: 15 }));
    wBar.userData.set(3072 * K);
    const lw = lab('3072', [-9.4, 3072 * K + 0.5, 0], { size: 16 }); G.add(lw);
    const sb = [0, 1, 2].map(i => bar(G, 2.6 + i * 3.6, 0, 1.6, [COL.gold, COL.act, COL.purple][i]));
    G.add(lab('配置', [2.6, -0.5, 1.4], { size: 14 }), lab('代码建议', [6.2, -0.5, 1.4], { size: 14 }), lab('RAE 公式', [9.8, -0.5, 1.4], { size: 14 }));
    G.add(lab('shift（柱高 × 0.3）', [6.2, 8.6, 0], { size: 17, border: 'rgba(242,193,78,.7)' }));
    let key = '', L1 = [];
    const ctls = [{ label: '编码器', items: V.map(v => v[0]), get: () => vi, set: k => { vi = k; } }];
    return { ctls, update(p) {
      const [nm, C, sCfg, sCode, sc] = V[vi], n = 4 * C, over = Math.max(0, n - 3072), aR = alphaOf(2 * 24 * 20 * C), g = seg(p, 0, 0.5);
      cBar.userData.set(Math.min(n, 3072) * K * g); oBar.userData.set(over * K * g + 0.0001); oBar.position.y = Math.min(n, 3072) * K * g + (over * K * g) / 2;
      const hs = [sCfg, sCode, aR]; sb.forEach((b, i) => b.userData.set(hs[i] * 0.3 * g));
      if (key !== vi + '') { key = vi + ''; L1.forEach(l => dropLab(G, l)); L1 = [lab(fmt(n), [-4.6, 1, 0], { size: 16 }), lab(`${hs[0]}`, [2.6, 1, 0], { size: 15 }), lab(`${hs[1]}`, [6.2, 1, 0], { size: 15 }), lab(aR.toFixed(2), [9.8, 1, 0], { size: 15 }), lab(`${nm} · 图 7：${sc}%`, [-7.0, 8.6, 0], { size: 18, border: hexs(COL.rae) })]; L1.forEach(l => G.add(l)); }
      L1[0].position.y = n * K * g + 0.5; [0, 1, 2].forEach(i => { L1[i + 1].position.y = hs[i] * 0.3 * g + 0.45; });
      cap(`${nm}：C = ${C}，4C = <b>${fmt(n)}</b> ${n > 3072 ? '&gt;' : n === 3072 ? '=' : '&lt;'} 3072 · ${over > 0 ? `每个 token 至少 <b>${fmt(over)}</b> 个噪声方向学不到（RAE 定理 1）` : n === 3072 ? '正好相等：没有硬下界，但没有余量' : '满足 RAE 条件'} · shift：配置 ${sCfg}，代码建议 ${sCode}，RAE 公式 ${aR.toFixed(2)}`);
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
  window.__raeDebug = { get cap() { return $('cap').textContent; } };
})();
