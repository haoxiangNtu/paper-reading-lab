'use strict';
/* Wan (arXiv 2503.20314, the Wan2.1 report) plus Wan2.2 taken apart into eleven animated scenes. Dimensions come from
   the report, the official code (Wan2.1 9737cba, Wan2.2 1ea34ff) and the Hugging Face configs. Each scene's update(p) is
   a pure function of the timeline p plus the current toggles. Scenes 3, 5, 6, 8, 9, 10 compute their numbers live from
   the formulas; scene 7 samples a fixed-seed toy set. No Wan network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { video: 0x3aa8e0, vae: 0x4fc98a, dit: 0x7c8cff, text: 0x9d8cff, time: 0xf2c14e, attn: 0xd45fa0, ffn: 0x38d1ff, norm: 0x6b7794, noise: 0x8e9bb8, cache: 0xf0963c, zero: 0x46506a, ok: 0x4fc98a, bad: 0xe05d5d, gold: 0xf2c14e, hi: 0xf0963c, lo: 0x3aa8e0, img: 0xf2a0a0, dim: 0x46506a, white: 0xeef2fa };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const hexs = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const live = t => `<p class="guess"><b>现算 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const fmt = n => n.toLocaleString('en-US');
  /* time shift used by the flow-matching samplers: s' = s·σ / (1 + (s − 1)σ) */
  const shiftF = (sg, s) => s * sg / (1 + (s - 1) * sg);
  /* UniPC set_timesteps: σ from 0.999 down to 0 in steps+1 points, drop the last, then shift */
  const ladder = (steps, s) => { const out = []; for (let i = 0; i < steps; i++) out.push(shiftF(0.999 * (1 - i / steps), s)); return out; };
  /* WanModel parameter count, term by term from wan/modules/model.py */
  function wanParams(d, f, Lr, inD = 16, outD = 16, nonshared = false) {
    const lin = (a, b) => a * b + b;
    let blk = 2 * (4 * lin(d, d) + 2 * d) + 2 * d + lin(d, f) + lin(f, d) + 6 * d;
    if (nonshared) blk += lin(d, 6 * d);
    const tot = Lr * blk + inD * d * 4 + d + lin(4096, d) + lin(d, d) + lin(256, d) + lin(d, d) + lin(d, 6 * d) + lin(d, outD * 4) + 2 * d;
    return { tot, blk };
  }

  const SCENES = [
    { n: 1, part: '总览', title: '三件套：Wan-VAE、DiT、umT5', sub: '点方块跳到对应那一幕', dur: 12, cam: [0.0, 1.12, 36, [0, 1.6, 0]],
      html: dl([['Wan-VAE', '因果 3D VAE，视频 → 隐变量，4 × 8 × 8，16 通道'], ['DiT', 'patch (1, 2, 2) → N 个块 → 反 patch；1.3B 30 层，14B 40 层'], ['umT5', '文本 512 个 token，交叉注意力注入'], ['训练', '流匹配，预测速度 x₁ − x₀'], ['推理', '50 步 UniPC，CFG 5，shift 5']]) +
        '<p>视频经 Wan-VAE 压到隐空间，patch 化成 token 序列；DiT 每一块里做全时空自注意力、对文本的交叉注意力和 FFN，时间步通过共享的调制 MLP 进入每一块；输出反 patch 后由 VAE 解码回像素。</p>' +
        '<p>开关切到 Wan2.2-TI2V-5B：VAE 换成 4 × 16 × 16、48 通道的 Wan2.2-VAE，DiT 变成 30 层、宽 3072，起始图直接替换第 1 个隐帧（第 10 幕）。</p>' + src('§4.1 · §4.2 · 图 9 · 图 10 · Wan2.1 / Wan2.2 configs') },
    { n: 2, part: '§3 数据', title: '四步清洗，再写稠密描述', sub: '左边是清洗漏斗，右边是训练阶段', dur: 13, cam: [0.0, 1.1, 46, [1.5, 3.2, 0]],
      html: dl([['基础维度', 'OCR、美学、NSFW、水印、黑边、过曝、合成图、模糊、时长 > 4 s；去掉约 50%'], ['视觉质量', '聚 100 类，每类抽样人工打 1–5 分，训练打分模型'], ['运动质量', '六档：最优、中等、静态、镜头运动、低质量、抖动'], ['视觉文字', '白底渲染汉字数亿张 + 真实图 OCR 后让 Qwen2-VL 写描述'], ['描述', '内部 LLaVA 式描述模型，每段视频一个稠密描述']]) +
        '<p>右边是预训练到后训练的分辨率课程：先 256 px 文生图，再图像和视频联合，视频从 192 px 升到 480 px、720 px，都是 5 秒；后训练在 480 / 720 px 上用精选数据。</p>' +
        guess('漏斗宽度只有“基础过滤去掉约 50%”是原文的数，其余宽度是示意；原文没给各阶段的数据量。') + src('§3.1 · §3.2 · §3.3 · §4.2.2 · 图 3') },
    { n: 3, part: '§4.1 Wan-VAE', title: '首帧单独，之后每 4 帧一个隐帧', sub: '切换帧数，看分块和形状', dur: 13, cam: [0.0, 1.1, 34, [0, 0.6, 0]],
      html: dl([['输入', 'V ∈ ℝ^((1+T)×H×W×3)'], ['输出', '[1 + T/4, H/8, W/8]，C = 16'], ['分块', '第 0 块 1 帧，之后每块 4 帧；每块对应 1 个隐帧'], ['首帧', '只做空间压缩（MagViT-v2），所以单张图也能编码'], ['显存', '每次只处理一块，和视频长度无关']]) +
        '<p>上排是帧，下排是隐帧。块按顺序编码：编码第 k 块时只看到第 k 块和缓存里前一块的尾帧（第 4 幕），所以是因果的。解码也一样，每次只解一个隐帧。</p>' +
        live('形状和压缩比按 1 + (F − 1)/4、H/8、W/8 当场算。像素数 / 隐变量数在 81 帧时是 46.3，比 3 × 4 × 8 × 8 / 16 = 48 小一点，因为首帧只压了空间。') +
        guess('17 帧是玩具长度，便于数块。') + src('§4.1.1 · §4.1.3 · 图 5 · vae.py encode()') },
    { n: 4, part: '§4.1.3 特征缓存', title: '块之间怎样保持因果连续', sub: '窗口滑过输出帧；切换普通卷积和 2 倍下采样', dur: 14, cam: [0.0, 1.12, 32, [-2.6, 1.2, 0]],
      html: dl([['(a) 普通因果卷积', '时间核 3，帧数不变；缓存前一块的最后 2 帧；第 0 块前补 2 帧零'], ['(b) 时间 2 倍下采样', '核 3、步长 2；第 0 块不做时间卷积，只存下来；之后每块前面接 1 帧缓存'], ['结果', '9 帧 → (a) 9 帧，(b) 1 + 8/2 = 5 帧'], ['代码', 'CACHE_T = 2；CausalConv3d 把时间填充全放在前面']]) +
        '<p>上排是这一层的输入帧，下排是输出帧。橙色框是当前输出用到的 3 个输入；其中属于前一块的帧来自缓存（橙色），第 0 块之前是零填充（深灰）。缓存让分块计算的结果和一次算完整段视频完全相同。</p>' +
        guess('画的是单层；真实网络里每一层因果卷积都各自缓存。') + src('§4.1.3 · 图 6 · vae.py CausalConv3d、Resample(downsample3d)') },
    { n: 5, part: '§4.2.1 patch 化', title: '隐变量切成 token：(1, 2, 2)', sub: '切换模型，看 token 数', dur: 13, cam: [0.25, 1.05, 34, [0, 1.0, 0]],
      html: dl([['patch', '3D 卷积，核 = 步长 = (1, 2, 2)'], ['序列长', 'L = (1 + T/4) × H/16 × W/16'], ['1.3B 480p', '21 × 30 × 52 = 32,760 个 token，宽 1536'], ['14B 720p', '21 × 45 × 80 = 75,600 个 token，宽 5120'], ['TI2V-5B 720p', '31 × 22 × 40 = 27,280 个 token，宽 3072']]) +
        '<p>左边是一个隐帧的网格（缩小画），每 2 × 2 个格子合成一个 token；多个隐帧叠在一起。右边三根条的长度按 token 数比例画。TI2V-5B 的视频更长（121 帧）、分辨率相同，token 反而最少，因为 Wan2.2-VAE 空间多压了 2 倍。</p>' +
        live('token 数 = (1 + (F − 1)/4) × H/(8·2) × W/(8·2)，TI2V 用 16 倍 VAE：× H/(16·2) × W/(16·2)。') + src('§4.2.1 · configs · generate.py SIZE_CONFIGS') },
    { n: 6, part: '§4.2.1 DiT 块', title: '一个块，和所有块共享的调制 MLP', sub: '切换共享 / 不共享，当场算参数量', dur: 14, cam: [0.18, 1.32, 36, [0, 5.0, 0]],
      html: dl([['自注意力', 'LN → (1 + scale₁)·x + shift₁ → 注意力（q/k RMSNorm，3D RoPE）→ × gate₁'], ['交叉注意力', '带仿射的 LN → 读 umT5 的 512 个 token；不受时间步调制'], ['FFN', 'LN → (1 + scale₂)·x + shift₂ → GELU → × gate₂'], ['调制', '时间嵌入 → 共享 MLP → 6 × dim；每块再加自己的 (6, dim) 偏置']]) +
        '<p>左边一列是 N 个块（画成 10 层），中间是展开的一个块，右边是共享的时间 MLP。共享时只有一个 dim → 6 dim 的线性层；不共享时每块各有一个，参数多出 6d² × N。</p>' +
        '<p>4.7.2 的消融：同样 1.5B，把参数花在加深（35 层全共享）上，比花在 adaLN 上（前 15 层不共享）损失更低。</p>' +
        live('参数量按 model.py 的层定义逐项算，和 HF 文件头的总数一致：1.3B = 1,418,996,800，14B = 14,288,491,584。') + guess('块数画成 10 层。') + src('§4.2.1 · §4.7.2 · 图 10 · 图 16 · model.py WanAttentionBlock') },
    { n: 7, part: '§4.2.2 流匹配', title: '直线插值，预测速度', sub: '点沿直线从噪声走到数据；下方是 t 的分布', dur: 13, cam: [0.0, 1.15, 30, [0, 1.6, 0]],
      html: dl([['式 (1)', 'x_t = t·x₁ + (1 − t)·x₀'], ['式 (2)', 'v_t = x₁ − x₀，沿直线不变'], ['式 (3)', 'L = E‖u(x_t, c_txt, t; θ) − v_t‖²'], ['t', 'logit-normal 采样'], ['方向', '论文 t = 1 是数据；代码 t = 1000 是噪声']]) +
        '<p>左边灰点是噪声 x₀，右边彩色环是“数据” x₁，每对用直线连起来；亮点是当前 t 下的 x_t，箭头是它们的速度，处处等于 x₁ − x₀。网络只需学会在任意 x_t 处给出这个速度。</p>' +
        '<p>下方直方图是 t 的训练分布：logit-normal 让中间的 t 被抽得最多，两端很少。</p>' +
        guess('“数据”是玩具点集；logit-normal 的参数原文没给，这里取均值 0、标准差 1，2,000 个样本用固定种子现抽。') + src('§4.2.2 式 (1)–(3)') },
    { n: 8, part: '§4.4 推理', title: '50 步，shift 5，每步两次前向做 CFG', sub: '切换 shift；柱子是每一步的噪声比例 σ', dur: 14, cam: [0.0, 1.25, 36, [-1.5, 3.6, 0]],
      html: dl([['采样器', 'UniPC（流匹配版），T2V 50 步、I2V 40 步'], ['shift', 'σ′ = sσ / (1 + (s − 1)σ)，默认 s = 5'], ['CFG', 'v = v_uncond + 5·(v_cond − v_uncond)，负提示是一段固定的中文'], ['加速（论文）', '扩散缓存 1.62×、FP8 GEMM 1.13×、8 位注意力 1.27×']]) +
        '<p>每根柱子是一步的噪声比例 σ′，从约 1 降到 0。shift 越大，越多的步停留在高噪声段（先定布局，再补细节）。每一步都要算一次有条件、一次无条件，再按 CFG 公式组合，所以计算量是两倍；扩散缓存就是利用后期两者很像，隔几步才算一次无条件。</p>' +
        live('σ′ 网格按 fm_solvers_unipc.py 的 set_timesteps 现算（σ 从 0.999 均匀降到 0，取前 N 个，再做偏移）。') + guess('两个速度箭头是手设的二维向量，只演示 CFG 的组合。') + src('§4.4 · generate.py · text2video.py · fm_solvers_unipc.py') },
    { n: 9, part: 'Wan2.2 MoE', title: '高噪声专家定布局，低噪声专家补细节', sub: '切换 T2V-A14B / I2V-A14B', dur: 13, cam: [0.0, 1.2, 40, [0, 4.6, 0]],
      html: dl([['专家', '两个 14,288,491,584 参数的 DiT（结构同 Wan2.1-14B）'], ['切换', 't ≥ boundary × 1000 用高噪声专家'], ['T2V-A14B', 'boundary 0.875，shift 12，40 步，CFG 低 3.0 / 高 4.0'], ['I2V-A14B', 'boundary 0.900，shift 5，40 步，CFG 3.5 / 3.5'], ['VAE', '两者都用 Wan2.1-VAE']]) +
        '<p>柱子是 40 步的噪声比例，红线是 boundary。线上方的步由左边的高噪声专家算，下方的步由右边的低噪声专家算。每步只激活一个专家，所以计算和显存与 14B 相同，总参数翻倍。</p>' +
        '<p>README 说切换点是 SNR 降到 SNR_min 一半处；按线性流的 SNR 定义复算是 σ ≈ 0.969，和配置的 0.875 / 0.9 对不上（精读页读者注 19）。</p>' +
        live('每一步用哪个专家、两个专家各走几步，按配置的 shift 和 boundary 现算。') + src('Wan2.2 README · wan_t2v_A14B.py · wan_i2v_A14B.py · text2video.py _prepare_model_for_timestep') },
    { n: 10, part: 'TI2V-5B', title: '一个模型同时做文生和图生视频', sub: '切换 T2V / I2V；看第 1 个隐帧', dur: 14, cam: [0.0, 1.12, 36, [1.0, 3.0, 1.5]],
      html: dl([['结构', '30 层，宽 3072，24 头，FFN 14336，in = out = 48'], ['VAE', 'Wan2.2-VAE 4 × 16 × 16 + patch 2 × 2 → 4 × 32 × 32'], ['I2V', '首个隐帧 = VAE(图)，该帧 token 的 t = 0，每步覆盖回去'], ['T2V', '全部隐帧从噪声开始，同一个 t'], ['时间步', '每个 token 一个 t：调制形状 [B, L, 6, C]']]) +
        '<p>一排方块是隐帧（真实 121 帧是 31 个，这里画 6 个）。I2V 模式下第 1 个方块来自输入图片，一直是干净的，标 t = 0；其余从噪声逐步变干净。T2V 模式下所有方块一起去噪。两种模式用同一套权重、同样 48 个输入通道。</p>' +
        '<p>下面两个方格比较一个 token 覆盖的像素：Wan2.1 是 4 帧 × 16 × 16，TI2V-5B 是 4 帧 × 32 × 32，所以同样 5 秒 720p 只要 27,280 个 token。OpenWAM 的“首帧是干净锚点”就是这个机制。</p>' +
        guess('噪声到干净的颜色过渡是示意；进度按 shift 5 的 σ′ 网格走。') + src('Wan2.2 README · wan_ti2v_5B.py · textimage2video.py · utils.py masks_like') },
    { n: 11, part: '结果', title: '结果', sub: '切换表格；每根柱子是原文数字', dur: 12, cam: [0.0, 1.08, 34, [0, 3.8, 0]],
      html: dl([['VBench', 'Wan 14B 86.22%，1.3B 83.96%，Sora 84.28%'], ['Wan-Bench', '加权 Wan 14B 0.724 第一；不加权 Sora 0.717 略高'], ['人工比较', '表 3 是“胜率 − 负率”'], ['OpenWAM 骨干', 'TI2V-5B 92.39，I2V-14B 93.79，差 1.40']]) +
        '<p>VBench 总分 = 0.8 × 质量 + 0.2 × 语义，每一行都能复算。Wan-Bench 的总分依赖人工偏好权重，等权平均时排名会变。最后一张是 OpenWAM §4.1.1 的结果，说明它为什么选 5B。</p>' + src('表 2 · 表 4 · 图 1 · OpenWAM 图 6') }
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
  function clearSub(sub) { LABS = LABS.filter(s => { let o = s; while (o) { if (o === sub) return false; o = o.parent; } return true; }); L.clear(sub); }
  const mix = (a, b, k) => [L.lerp(a[0], b[0], k), L.lerp(a[1], b[1], k), L.lerp(a[2], b[2], k)];

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
    let v = +(OPT[0] ?? 0); G.add(L.grid(44, 22));
    const sub = new THREE.Group(); G.add(sub); let last = -1, B = [];
    const flow = stream(G, 18, COL.video, 0.13), flowT = stream(G, 6, COL.text, 0.12), flowS = stream(G, 5, COL.time, 0.12);
    function rebuild() {
      clearSub(sub); B = []; PICKS = []; last = v;
      const w22 = v === 1;
      const parts = [
        { x: -14, w: 2.6, h: 2.6, c: COL.video, t: '视频', s: w22 ? '121 帧 704 × 1280' : '81 帧 720 × 1280', go: 2 },
        { x: -8.8, w: 2.4, h: 3.0, c: COL.vae, t: w22 ? 'Wan2.2-VAE' : 'Wan-VAE 编码', s: w22 ? '4×16×16，C 48' : '4×8×8，C 16', go: 2 },
        { x: -3.8, w: 2.0, h: 2.2, c: COL.ffn, t: 'patch (1,2,2)', s: w22 ? '27,280 token' : '75,600 token', go: 4 },
        { x: 1.6, w: 3.4, h: 5.2, c: COL.dit, t: w22 ? 'DiT × 30' : 'DiT × 40', s: w22 ? '宽 3072，5.00B' : '宽 5120，14.29B', go: 5 },
        { x: 7.0, w: 2.0, h: 2.2, c: COL.ffn, t: '反 patch', s: '→ 隐变量', go: 4 },
        { x: 11.4, w: 2.4, h: 3.0, c: COL.vae, t: 'VAE 解码', s: '每次 1 个隐帧', go: 2 },
        { x: 15.6, w: 2.4, h: 2.4, c: COL.video, t: '视频', s: '像素', go: 7 }
      ];
      parts.forEach(q => { const b = block(q.w, q.h, 2.0, q.c, [q.x, q.h / 2, 0], { opacity: 0.92 }); b.userData.go = q.go; sub.add(b); PICKS.push(b); B.push(b);
        sub.add(lab(q.t, [q.x, -0.9, 1.4], { size: 20 })); sub.add(lab(q.s, [q.x, -2.1 - (parts.indexOf(q) % 2) * 1.2, 1.4], { size: 16, color: '#b8c4da' })); });
      const tx = block(3.6, 1.2, 1.6, COL.text, [-3.6, 7.2, 0], { opacity: 0.92 }); tx.userData.go = 5; sub.add(tx); PICKS.push(tx); B.push(tx);
      sub.add(lab('umT5：512 个 token × 4096', [-3.6, 8.7, 0], { size: 18 }));
      const tm = block(2.8, 1.2, 1.6, COL.time, [6.6, 7.2, 0], { opacity: 0.92 }); tm.userData.go = 6; sub.add(tm); PICKS.push(tm); B.push(tm);
      sub.add(lab(w22 ? '时间步 t：每个 token 一个' : '时间步 t → 共享 MLP', [6.6, 8.7, 0], { size: 18 }));
      if (w22) sub.add(lab('起始图 → 第 1 个隐帧（t = 0）', [-11.4, 5.4, 0], { size: 17, border: hexs(COL.img) }));
    }
    rebuild();
    const ctls = [{ label: '模型', items: ['Wan2.1-14B', 'Wan2.2-TI2V-5B'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      if (last !== v) rebuild();
      const q = (p * 2) % 1;
      flow([[-14, 1.3, 1.2], [-8.8, 1.5, 1.2], [-3.8, 1.1, 1.2], [1.6, 2.6, 1.2], [7, 1.1, 1.2], [11.4, 1.5, 1.2], [15.6, 1.2, 1.2]], q, 1);
      flowT([[-3.6, 6.6, 0.9], [0.4, 4.6, 1.2]], q, 1); flowS([[6.6, 6.6, 0.9], [2.8, 4.6, 1.2]], q, 1);
      B.forEach((b, i) => glow(b, Math.max(0.05, 0.55 - Math.abs(i / 8 - p) * 3)));
      cap(p < 0.34 ? '<b>编码</b>：视频 → Wan-VAE → 隐变量 → patch 成 token' : p < 0.67 ? '<b>DiT</b>：每块读 umT5 文本（交叉注意力），时间步经共享 MLP 调制每一块' : '<b>解码</b>：反 patch，VAE 每次解一个隐帧还原像素；点任意方块跳到对应一幕');
    } };
  }

  /* ---------- scene 2: data pipeline ---------- */
  function s2(G) {
    G.add(L.grid(44, 22));
    const steps = [
      ['候选池（内部 + 公开，去重）', 16, COL.noise, '数十亿图像和视频'],
      ['基础维度过滤', 11.3, COL.video, '去掉约 50%'],
      ['视觉质量：100 类 + 1–5 分', 9.0, COL.vae, '聚类防长尾丢失'],
      ['运动质量：6 档', 7.2, COL.time, '静态、镜头运动降采样'],
      ['视觉文字：合成 + OCR', 6.0, COL.attn, '数亿张渲染汉字'],
      ['稠密描述', 5.2, COL.text, 'LLaVA 式描述模型']
    ];
    const S2 = steps.map(([t, w, c, s], i) => { const y = 8.4 - i * 1.6, b = block(w, 1.0, 2.2, c, [-9, y, 0], { opacity: 0.88 }); G.add(b);
      G.add(lab(t, [-9, y, 1.4], { size: 17 })); G.add(lab(s, [3.2, y, 0], { size: 15, color: '#b8c4da' })); return b; });
    const stages = [['文生图 256 px', 2], ['图 256 + 视频 192', 3], ['480 px', 4.2], ['720 px', 5.4], ['后训练', 4.6]];
    const T = stages.map(([t, h], i) => { const x = 9 + i * 3.3, b = block(1.8, 1, 1.6, i === 4 ? COL.gold : COL.dit, [x, 0.5, 0]); G.add(b);
      G.add(lab(t, [x, -0.8 - (i % 2) * 1.3, 1.2], { size: 15 })); return { b, h }; });
    G.add(lab('分辨率课程', [15.6, 7.4, 0], { size: 18, border: 'rgba(124,140,255,.7)' }));
    const pts = stream(G, 14, COL.data ?? 0x7cb8ff, 0.12);
    return { update(p) {
      S2.forEach((b, i) => glow(b, Math.max(0.05, 0.6 - Math.abs(i / 6 - p * 1.1) * 3)));
      T.forEach(({ b, h }, i) => { const k = seg(p, 0.35 + i * 0.1, 0.5 + i * 0.1), H = Math.max(0.02, h * k); b.scale.y = H; b.position.y = H / 2; });
      pts([[-9, 9.4, 1.4], [-9, 0.0, 1.4]], (p * 1.5) % 1, 1);
      cap(p < 0.4 ? '<b>清洗</b>：四步过滤，基础维度一步就去掉约一半' : p < 0.8 ? '<b>课程</b>：先低分辨率文生图，再逐步升到 720 px 的图像-视频联合训练' : '<b>后训练</b>：同结构同优化器，用精选的高质量图像和视频');
    } };
  }

  /* ---------- scene 3: VAE chunks ---------- */
  function s3(G) {
    let v = +(OPT[0] ?? 0); G.add(L.grid(44, 22)); const sub = new THREE.Group(); G.add(sub);
    const SET = [{ F: 17, H: 128, W: 128, nm: '17 帧（玩具）' }, { F: 81, H: 720, W: 1280, nm: '81 帧 720p' }, { F: 121, H: 704, W: 1280, nm: '121 帧（TI2V，16 倍 VAE）', s: 16, C: 48 }];
    let fr, lt, last = -1, nC = 0, F = 0;
    function rebuild() {
      clearSub(sub); last = v; const c = SET[v]; F = c.F; nC = 1 + (F - 1) / 4;
      fr = inst(BOX, F); lt = inst(BOX, nC); sub.add(fr, lt);
      const span = 28, dx = span / F, w = Math.min(1.1, dx * 0.85);
      for (let i = 0; i < F; i++) { const ch = i === 0 ? 0 : Math.ceil(i / 4); setI(fr, i, [-14 + (i + 0.5) * dx, 4.2, 0], [w, 2.2, 0.3]); colI(fr, i, hex3(ch % 2 ? COL.video : 0x7fc4ec)); }
      done(fr);
      sub.add(lab('输入帧 1 + T = ' + F, [-10, 6.4, 0], { size: 18 })); sub.add(lab('隐帧 1 + T/4 = ' + nC, [-10, -2.9, 0], { size: 18 }));
      sub.userData = { dx, w };
    }
    rebuild();
    const ctls = [{ label: '长度', items: SET.map(s => s.nm), get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      if (last !== v) rebuild();
      const c = SET[v], s = c.s || 8, C = c.C || 16, { dx } = sub.userData, k = Math.floor(seg(p, 0.05, 0.85) * nC + 1e-6);
      for (let j = 0; j < nC; j++) {
        const a = j === 0 ? 0 : 1 + 4 * (j - 1), b = j === 0 ? 1 : 1 + 4 * j, cx = -14 + ((a + b) / 2) * dx, sz = Math.min(1.3, 26 / nC * 0.8);
        setI(lt, j, [cx, -0.6, 0], j < k ? sz : 0.0001); colI(lt, j, hex3(j === 0 ? COL.gold : COL.vae));
      }
      done(lt);
      const lf = 1 + (c.F - 1) / 4, h = c.H / s, w = c.W / s, pix = c.F * c.H * c.W * 3, lat = lf * h * w * C;
      cap(`${c.F} × ${c.H} × ${c.W} × 3 → <b>${lf} × ${h} × ${w} × ${C}</b> · 像素 / 隐变量 = ${(pix / lat).toFixed(1)} · 已编码 ${Math.min(k, nC)} / ${nC} 块（首块 1 帧，之后每块 4 帧）`);
    } };
  }

  /* ---------- scene 4: feature cache ---------- */
  function s4(G) {
    let v = +(OPT[0] ?? 0); G.add(L.grid(40, 20)); const sub = new THREE.Group(); G.add(sub);
    const N = 9, X = i => -11 + (i + 2) * 2.1; /* inputs 0..8 at X(i); zero pads at X(-2), X(-1) */
    const chunkOf = i => (i <= 0 ? 0 : Math.ceil(i / 4));
    let last = -1, inp = [], outB = [], win, outs = [];
    function rebuild() {
      clearSub(sub); last = v; inp = []; outB = [];
      for (let i = -2; i < N; i++) { const z = i < 0; const b = block(1.5, 1.5, 0.6, z ? COL.zero : (chunkOf(i) % 2 ? COL.video : 0x7fc4ec), [X(i), 3.4, 0], { opacity: z && v === 1 ? 0.15 : 0.95 }); sub.add(b); inp.push({ i, b });
        sub.add(lab(z ? '0' : String(i), [X(i), 3.4, 0.5], { size: 15 })); }
      outs = v === 0 ? Array.from({ length: N }, (_, j) => ({ j, win: [j - 2, j - 1, j], x: X(j) })) :
        [{ j: 0, win: [0], x: X(0) }, { j: 1, win: [0, 1, 2], x: X(1.5) }, { j: 2, win: [2, 3, 4], x: X(3.5) }, { j: 3, win: [4, 5, 6], x: X(5.5) }, { j: 4, win: [6, 7, 8], x: X(7.5) }];
      outs.forEach(o => { const b = block(1.5, 1.5, 0.6, COL.vae, [o.x, -1.6, 0]); sub.add(b); const l = lab(String(o.j), [o.x, -1.6, 0.5], { size: 15 }); sub.add(l); b.userData.l = l; outB.push(b); });
      [0.5, 4.5].forEach(t => sub.add(L.line([[X(t), 5.0, 0], [X(t), -3.2, 0]], 0x8e9bb8, { dashed: true, opacity: 0.6 })));
      sub.add(lab('块 0', [X(0), 5.6, 0], { size: 16 })); sub.add(lab('块 1', [X(2.5), 5.6, 0], { size: 16 })); sub.add(lab('块 2', [X(6.5), 5.6, 0], { size: 16 }));
      sub.add(lab('输入帧', [X(-3.4), 3.4, 0], { size: 16 })); sub.add(lab(v === 0 ? '输出（帧数不变）' : '输出（2 倍下采样）', [X(-3.6), -1.6, 0], { size: 16 }));
      win = block(1, 1.9, 0.8, COL.cache, [0, 3.4, 0], { opacity: 0.25 }); sub.add(win);
    }
    rebuild();
    const ctls = [{ label: '层', items: ['(a) 普通因果卷积', '(b) 时间 2 倍下采样'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      if (last !== v) rebuild();
      const k = clamp(Math.floor(p * outs.length * 1.08), 0, outs.length - 1), o = outs[k], ch = chunkOf(o.win[o.win.length - 1]);
      const lo = Math.min(...o.win), hi = Math.max(...o.win);
      win.scale.x = (hi - lo) * 2.1 + 1.8; win.position.x = (X(lo) + X(hi)) / 2;
      inp.forEach(({ i, b }) => { const inW = o.win.includes(i), cached = inW && (i < 0 ? false : chunkOf(i) < ch), pad = inW && i < 0;
        b.material.emissive.setRGB(0, 0, 0); if (cached) b.material.emissive.setHex(COL.cache); else if (pad) b.material.emissive.setHex(0x555555); else if (inW) glow(b, 0.6); b.material.emissiveIntensity = cached ? 0.9 : 1; });
      outB.forEach((b, j) => { b.visible = j <= k; b.userData.l.visible = j <= k; glow(b, j === k ? 0.7 : 0.05); });
      const nCache = o.win.filter(i => i >= 0 && chunkOf(i) < ch).length, nPad = o.win.filter(i => i < 0).length;
      cap(`输出 ${o.j} ← 输入 {${o.win.map(i => (i < 0 ? '0' : i)).join(', ')}} · 块 ${ch} · ` + (nPad ? `<b>零填充 ${nPad} 帧</b>` : nCache ? `<b>其中 ${nCache} 帧来自缓存</b>` : '全部在本块内') + (v === 1 && o.j === 0 ? ' · 首块不做时间卷积，只存下来' : ''));
    } };
  }

  /* ---------- scene 5: patchify and tokens ---------- */
  function s5(G) {
    let v = +(OPT[0] ?? 1); G.add(L.grid(44, 22));
    const M = [{ nm: '1.3B 480p', F: 81, H: 480, W: 832, s: 8, d: 1536 }, { nm: '14B 720p', F: 81, H: 720, W: 1280, s: 8, d: 5120 }, { nm: 'TI2V-5B 720p', F: 121, H: 704, W: 1280, s: 16, d: 3072 }];
    const tok = m => (1 + (m.F - 1) / 4) * (m.H / m.s / 2) * (m.W / m.s / 2);
    const GH = 6, GW = 10, LAY = 4, cells = inst(BOX, GH * GW * LAY); G.add(cells);
    const pg = inst(BOX, (GH / 2) * (GW / 2)); G.add(pg);
    const bars = M.map((m, i) => { const b = block(1, 0.9, 0.9, i === 2 ? COL.gold : COL.dit, [0, 1.2 + i * 2.6, 0], { edges: false }); G.add(b); return b; });
    const mx = Math.max(...M.map(tok));
    M.forEach((m, i) => G.add(lab(`${m.nm}：${fmt(tok(m))}`, [8.6, 2.3 + i * 2.6, 0], { size: 16 })));
    G.add(lab('隐帧网格（缩小画），橙框 = 一个 token', [-8.5, -0.6, 1.0], { size: 16 })); G.add(lab('token 数（条长按比例）', [6.0, 9.4, 0], { size: 17 }));
    return { ctls: [{ label: '模型', items: M.map(m => m.nm), get: () => v, set: k => { v = k; } }], update(p) {
      const m = M[v], g = seg(p, 0.05, 0.45), sp = 0.62;
      let n = 0;
      for (let l = 0; l < LAY; l++) for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) {
        const gap = 0.12 * g * ((c % 2 === 0 ? 0 : 1) + (r % 2 === 0 ? 0 : 1));
        setI(cells, n, [-11.5 + c * sp + (c >> 1) * 0.18 * g, 1.2 + r * sp + (r >> 1) * 0.18 * g, -l * 1.1], [sp * 0.9, sp * 0.9, 0.25]);
        colI(cells, n, hex3(l === 0 ? (v === 2 ? COL.gold : COL.vae) : COL.noise)); n++;
      }
      done(cells);
      let q = 0; const hl = Math.floor(seg(p, 0.2, 0.6) * (GH / 2) * (GW / 2));
      for (let r = 0; r < GH / 2; r++) for (let c = 0; c < GW / 2; c++) { setI(pg, q, [-11.5 + (2 * c + 0.5) * sp + c * 0.18 * g, 1.2 + (2 * r + 0.5) * sp + r * 0.18 * g, 0.2], q < hl ? [sp * 1.9, sp * 1.9, 0.05] : 0.0001); colI(pg, q, hex3(COL.cache)); q++; }
      done(pg);
      const gb = seg(p, 0.5, 0.9);
      bars.forEach((b, i) => { const len = Math.max(0.02, 14 * tok(M[i]) / mx * gb); b.scale.x = len; b.position.x = 0 + len / 2; glow(b, i === v ? 0.6 : 0.05); });
      const lf = 1 + (m.F - 1) / 4, h = m.H / m.s, w = m.W / m.s;
      cap(`${m.nm}：隐变量 ${lf} × ${h} × ${w} → patch 2 × 2 → <b>${lf} × ${h / 2} × ${w / 2} = ${fmt(tok(m))} 个 token</b>，每个宽 ${m.d}`);
    } };
  }

  /* ---------- scene 6: DiT block and shared modulation ---------- */
  function s6(G) {
    let share = +(OPT[0] ?? 0), mdl = +(OPT[1] ?? 0); G.add(L.grid(40, 20)); const sub = new THREE.Group(); G.add(sub);
    const MD = [{ nm: '1.3B', d: 1536, f: 8960, L: 30 }, { nm: '14B', d: 5120, f: 13824, L: 40 }];
    const NB = 10, slabs = [];
    for (let i = 0; i < NB; i++) { const b = block(3.0, 0.45, 2.0, COL.dit, [-9, 0.6 + i * 0.68, 0], { opacity: 0.9 }); G.add(b); slabs.push(b); }
    G.add(lab('N 个块（画 10 层）', [-9, -0.6, 1.2], { size: 16 }));
    const parts = [['LN + 调制 (shift₁, scale₁)', COL.norm, 1], ['自注意力（全时空，3D RoPE）', COL.attn, 0], ['× gate₁，残差', COL.norm, 1], ['LN（仿射）', COL.norm, 0], ['交叉注意力（读 umT5）', COL.text, 0], ['LN + 调制 (shift₂, scale₂)', COL.norm, 1], ['FFN（GELU）', COL.ffn, 0], ['× gate₂，残差', COL.norm, 1]];
    const P = parts.map(([t, c, mod], i) => { const y = 0.7 + i * 1.32, b = block(5.6, 0.9, 1.6, c, [0, y, 0], { opacity: 0.92 }); G.add(b); G.add(lab(t, [0, y, 1.2], { size: 14 })); return { b, mod, y }; });
    G.add(L.line([[-7.4, 3.6, 0], [-2.9, 0.2, 0]], 0x8e9bb8, { dashed: true, opacity: 0.5 })); G.add(L.line([[-7.4, 3.6, 0], [-2.9, 10.4, 0]], 0x8e9bb8, { dashed: true, opacity: 0.5 }));
    const umt = block(3.0, 1.0, 1.4, COL.text, [6.6, 5.98, 0], { opacity: 0.9 }); G.add(umt); G.add(lab('umT5：512 × dim', [6.6, 7.1, 0], { size: 15 }));
    G.add(L.line([[5.1, 5.98, 0], [2.8, 5.98, 0]], COL.text, { opacity: 0.8 }));
    const tm = block(3.2, 1.0, 1.4, COL.time, [9.6, 11.2, 0], { opacity: 0.9 }); G.add(tm); G.add(lab('时间 t → MLP → 6 × dim', [9.6, 12.3, 0], { size: 15 }));
    const pulse = stream(G, 1, COL.gold, 0.28), mods = stream(G, 6, COL.time, 0.12);
    let extra = [], last = '';
    function rebuild() {
      clearSub(sub); extra = []; last = share + '' + mdl;
      if (share === 1) slabs.forEach((s, i) => { const b = block(0.9, 0.38, 0.9, COL.time, [-6.9, s.position.y, 0], { opacity: 0.9 }); sub.add(b); extra.push(b); });
      else slabs.forEach((s, i) => { const b = block(0.32, 0.32, 0.32, 0xffd98a, [-7.4, s.position.y, 0]); sub.add(b); extra.push(b); });
      sub.add(lab(share === 1 ? '每块自己的 MLP（橙方块）' : '每块只学 (6, dim) 偏置（小方块）', [-9, 8.2, 0], { size: 15, border: hexs(COL.time) }));
    }
    rebuild();
    const ctls = [{ label: '调制', items: ['共享（论文）', '不共享（消融 iv）'], get: () => share, set: k => { share = k; } }, { label: '尺寸', items: ['1.3B', '14B'], get: () => mdl, set: k => { mdl = k; } }];
    return { ctls, update(p) {
      if (last !== share + '' + mdl) rebuild();
      const k = Math.floor(seg(p, 0.05, 0.9) * parts.length);
      P.forEach(({ b }, i) => glow(b, i === k ? 0.7 : 0.05));
      pulse([[0, 0.2, 1.0], [0, 10.4, 1.0]], seg(p, 0.05, 0.9) * 0.999, 1);
      const tgt = share === 0 ? [[9.6, 10.6, 0], [-7.4, 6.6, 0], [-7.4, 0.8, 0]] : [[9.6, 10.6, 0], [3.0, 10.6, 0], [2.9, P[k].y, 0]];
      mods(tgt, (p * 2) % 1, 1);
      slabs.forEach((s, i) => glow(s, Math.max(0.05, 0.6 - Math.abs(i / NB - p) * 4)));
      const m = MD[mdl], a = wanParams(m.d, m.f, m.L), b = wanParams(m.d, m.f, m.L, 16, 16, true), ex = b.tot - a.tot;
      cap(`${m.nm}（d = ${m.d}，${m.L} 层）· 共享 <b>${fmt(a.tot)}</b> · 不共享 ${fmt(b.tot)} · 多出 6d² + 6d = ${fmt(ex / m.L)} × ${m.L} = ${fmt(ex)}（占不共享的 <b>${(ex / b.tot * 100).toFixed(1)}%</b>）`);
    } };
  }

  /* ---------- scene 7: flow matching ---------- */
  function s7(G) {
    G.add(L.grid(40, 20));
    const r = L.rng(7), N = 60, X0 = [], X1 = [];
    for (let i = 0; i < N; i++) { X0.push([-8 + L.gauss(r) * 1.4, 4.2 + L.gauss(r) * 1.4, L.gauss(r) * 1.2]); const a = (i / N) * Math.PI * 2; X1.push([8 + Math.cos(a) * 2.2, 4.2 + Math.sin(a) * 2.2, Math.sin(3 * a) * 0.6]); }
    const p0 = inst(BALL, N), p1 = inst(BALL, N), pt = inst(BALL, N); G.add(p0, p1, pt);
    for (let i = 0; i < N; i++) { setI(p0, i, X0[i], 0.12); colI(p0, i, hex3(COL.noise)); setI(p1, i, X1[i], 0.12); colI(p1, i, hex3(COL.vae)); }
    done(p0); done(p1);
    for (let i = 0; i < N; i += 3) G.add(L.line([X0[i], X1[i]], 0x8e9bb8, { opacity: 0.18 }));
    G.add(lab('x₀ ~ N(0, I)（噪声）', [-8, 7.6, 0], { size: 17 })); G.add(lab('x₁（数据，玩具环）', [8, 7.6, 0], { size: 17 }));
    const arrows = []; for (let i = 0; i < N; i += 10) { const a = L.arrow([0, 0, 0], [1, 0, 0], COL.gold, { head: 0.5, headW: 0.3 }); G.add(a); arrows.push({ a, i }); }
    /* logit-normal t histogram, 2,000 samples, fixed seed */
    const rr = L.rng(11), BINS = 20, H = new Array(BINS).fill(0);
    for (let k = 0; k < 2000; k++) { const t = 1 / (1 + Math.exp(-L.gauss(rr))); H[Math.min(BINS - 1, Math.floor(t * BINS))]++; }
    const hm = Math.max(...H), hb = H.map((h, i) => { const b = block(0.6, 1, 0.6, COL.time, [-6 + i * 0.64, 0, 0], { edges: false }); b.userData.h = h / hm * 2.6; G.add(b); return b; });
    G.add(lab('t 的分布：logit-normal（示意参数）', [0, -1.2, 0.6], { size: 16 })); G.add(lab('t = 0', [-6.2, -0.4, 0.8], { size: 14 })); G.add(lab('t = 1', [6.2, -0.4, 0.8], { size: 14 }));
    const tick = block(0.12, 3.0, 0.7, COL.bad, [0, 1.5, 0], { edges: false }); G.add(tick);
    return { update(p) {
      const t = seg(p, 0.05, 0.85);
      for (let i = 0; i < N; i++) setI(pt, i, mix(X0[i], X1[i], t), 0.2), colI(pt, i, hex3(COL.gold));
      done(pt);
      arrows.forEach(({ a, i }) => { const P0 = mix(X0[i], X1[i], t), d = new THREE.Vector3(X1[i][0] - X0[i][0], X1[i][1] - X0[i][1], X1[i][2] - X0[i][2]); a.position.set(...P0); a.setDirection(d.clone().normalize()); a.setLength(2.2, 0.5, 0.3); });
      hb.forEach(b => { const h = Math.max(0.02, b.userData.h * seg(p, 0, 0.3)); b.scale.y = h; b.position.y = h / 2; });
      tick.position.x = -6 + t * BINS * 0.64 - 0.32;
      cap(`t = <b>${t.toFixed(2)}</b> · x_t = t·x₁ + (1 − t)·x₀ · 箭头 = v = x₁ − x₀（不随 t 变）· 损失 ‖u(x_t, c, t) − v‖² · 代码里的时间步约为 ${Math.round((1 - t) * 1000)}（方向相反）`);
    } };
  }

  /* ---------- scene 8: sampling and CFG ---------- */
  function s8(G) {
    let si = +(OPT[0] ?? 2), sti = +(OPT[1] ?? 0); G.add(L.grid(44, 22)); const sub = new THREE.Group(); G.add(sub);
    const SH = [1, 3, 5, 12], ST = [50, 40];
    let bars = [], lad = [], last = '';
    function rebuild() {
      clearSub(sub); bars = []; last = si + '' + sti; lad = ladder(ST[sti], SH[si]); const n = lad.length, w = 20 / n;
      lad.forEach((sg, i) => { const b = block(w * 0.8, 1, 0.8, COL.dit, [-14 + (i + 0.5) * w, 0, 0], { edges: false }); b.userData.h = sg * 7; sub.add(b); bars.push(b); });
      sub.add(lab('σ′ ≈ 1', [-13.6, 7.9, 0], { size: 14 })); sub.add(lab(`第 1 步 … 第 ${n} 步`, [-4, -0.8, 0.8], { size: 15 }));
    }
    rebuild();
    const O = [8.6, 2.4, 0], vu = [1.0, 2.0, 0], vc = [1.6, 1.8, 0], s = 5;
    const aU = L.arrow(O, [O[0] + vu[0], O[1] + vu[1], 0], COL.noise), aC = L.arrow(O, [O[0] + vc[0], O[1] + vc[1], 0], COL.text), aG = L.arrow(O, [0, 0, 0], COL.gold); G.add(aU, aC, aG);
    G.add(lab('v_uncond（负提示）', [O[0] - 0.6, O[1] + 3.3, 0], { size: 15 })); G.add(lab('v_cond', [O[0] + 3.0, O[1] + 2.6, 0], { size: 15 }));
    G.add(lab('v = v_u + 5 (v_c − v_u)', [O[0] + 2.6, O[1] - 1.4, 0], { size: 16, border: hexs(COL.gold) }));
    const ctls = [{ label: 'shift', items: SH.map(String), get: () => si, set: k => { si = k; } }, { label: '步数', items: ST.map(String), get: () => sti, set: k => { sti = k; } }];
    return { ctls, update(p) {
      if (last !== si + '' + sti) rebuild();
      const n = lad.length, k = clamp(Math.floor(seg(p, 0.02, 0.95) * n), 0, n - 1);
      bars.forEach((b, i) => { const h = Math.max(0.02, b.userData.h * seg(p, 0, 0.15)); b.scale.y = h; b.position.y = h / 2; glow(b, i === k ? 0.9 : i < k ? 0.18 : 0.02); });
      const g = seg(p, 0.2, 0.6), V = [vu[0] + s * (vc[0] - vu[0]) * g, vu[1] + s * (vc[1] - vu[1]) * g, 0], len = Math.hypot(V[0], V[1]);
      aG.position.set(...O); aG.setDirection(new THREE.Vector3(V[0], V[1], 0).normalize()); aG.setLength(Math.max(0.3, len), 0.5, 0.3);
      const hiN = lad.filter(x => x >= 0.8).length;
      cap(`shift ${SH[si]}，${n} 步 · 第 ${k + 1} 步 σ′ = <b>${lad[k].toFixed(3)}</b>（时间步 ${Math.round(lad[k] * 1000)}）· σ′ ≥ 0.8 的步数 <b>${hiN} / ${n}</b> · 每步 2 次前向（有条件 + 无条件）`);
    } };
  }

  /* ---------- scene 9: Wan2.2 MoE ---------- */
  function s9(G) {
    let v = +(OPT[0] ?? 0); G.add(L.grid(44, 22)); const sub = new THREE.Group(); G.add(sub);
    const CF = [{ nm: 'T2V-A14B', b: 0.875, s: 12, cfg: [3.0, 4.0] }, { nm: 'I2V-A14B', b: 0.9, s: 5, cfg: [3.5, 3.5] }];
    const EH = block(3.4, 2.0, 1.8, COL.hi, [-12.4, 10.0, 0], { opacity: 0.92 }), EL = block(3.4, 2.0, 1.8, COL.lo, [12.4, 10.0, 0], { opacity: 0.92 }); G.add(EH, EL);
    G.add(lab('高噪声专家 14.29B', [-12.4, 12.0, 0], { size: 17 })); G.add(lab('低噪声专家 14.29B', [12.4, 12.0, 0], { size: 17 }));
    let bars = [], lad = [], line, last = -1, eh, el;
    function rebuild() {
      clearSub(sub); bars = []; last = v; const c = CF[v]; lad = ladder(40, c.s); const w = 20 / 40;
      lad.forEach((sg, i) => { const b = block(w * 0.8, 1, 0.8, sg >= c.b ? COL.hi : COL.lo, [-10 + (i + 0.5) * w, 0, 0], { edges: false }); b.userData.h = sg * 7; sub.add(b); bars.push(b); });
      line = L.line([[-10.6, c.b * 7, 0.6], [10.6, c.b * 7, 0.6]], COL.bad, { opacity: 0.9 }); sub.add(line);
      sub.add(lab(`boundary ${c.b}`, [12.8, c.b * 7, 0.6], { size: 15, color: '#ff8a8a' }));
      const nh = lad.filter(x => x >= c.b).length;
      eh = lab(`${nh} 步 · CFG ${c.cfg[1]}`, [-12.4, 10.0, 1.4], { size: 15 }); el = lab(`${40 - nh} 步 · CFG ${c.cfg[0]}`, [12.4, 10.0, 1.4], { size: 15 }); sub.add(eh, el);
    }
    rebuild();
    return { ctls: [{ label: '模型', items: CF.map(c => c.nm), get: () => v, set: k => { v = k; } }], update(p) {
      if (last !== v) rebuild();
      const c = CF[v], k = clamp(Math.floor(seg(p, 0.02, 0.95) * 40), 0, 39), hiNow = lad[k] >= c.b;
      bars.forEach((b, i) => { const h = Math.max(0.02, b.userData.h * seg(p, 0, 0.15)); b.scale.y = h; b.position.y = h / 2; b.material.emissive.setRGB(0, 0, 0); if (i === k) glow(b, 0.9); });
      glow(EH, hiNow ? 0.8 : 0.02); glow(EL, hiNow ? 0.02 : 0.8);
      const nh = lad.filter(x => x >= c.b).length;
      cap(`${c.nm}：shift ${c.s} · 第 ${k + 1} / 40 步 σ′ = ${lad[k].toFixed(3)} → <b>${hiNow ? '高噪声专家' : '低噪声专家'}</b> · 高噪声 ${nh} 步、低噪声 ${40 - nh} 步 · 每步只激活 14.29B`);
    } };
  }

  /* ---------- scene 10: TI2V-5B ---------- */
  function s10(G) {
    let v = +(OPT[0] ?? 1); G.add(L.grid(44, 22)); const sub = new THREE.Group(); G.add(sub);
    const NL = 6, X = i => -7.5 + i * 3.6, cubes = [], tl = [];
    for (let i = 0; i < NL; i++) { const b = block(2.4, 2.4, 2.4, COL.noise, [X(i), 4.0, 0]); G.add(b); cubes.push(b); }
    G.add(lab('隐帧（真实 31 个，画 6 个），每个 48 通道', [X(2.5), 6.8, 0], { size: 16 }));
    const lad = ladder(50, 5);
    let last = -1, imgB;
    function rebuild() {
      clearSub(sub); last = v; tl.length = 0;
      for (let i = 0; i < NL; i++) { const l = lab('t', [X(i), 1.8, 1.4], { size: 15 }); sub.add(l); tl.push(l); }
      if (v === 1) { imgB = block(2.4, 1.8, 0.2, COL.img, [X(0), 9.0, 0]); sub.add(imgB); sub.add(lab('起始图 → VAE 编码 → z', [X(0) + 5.0, 9.0, 0], { size: 15 })); sub.add(L.arrow([X(0), 8.0, 0], [X(0), 5.4, 0], COL.img)); }
      /* token footprint comparison */
      const a = block(1.6, 0.1, 1.6, COL.vae, [-5, 0.05, 6], { opacity: 0.85 }), b = block(3.2, 0.1, 3.2, COL.gold, [7, 0.05, 6], { opacity: 0.85 }); sub.add(a, b);
      sub.add(lab('Wan2.1：每 token 4 帧 × 16²', [-5, 0.4, 8.2], { size: 14 })); sub.add(lab('TI2V-5B：每 token 4 帧 × 32²', [7, 0.4, 8.2], { size: 14 }));
    }
    rebuild();
    const texL = new Map();
    const setText = (i, s) => { if (texL.get(i) === s) return; texL.set(i, s); const old = tl[i]; const nl = lab(s, old.position.toArray(), { size: 15 }); sub.remove(old); LABS = LABS.filter(q => q !== old); L.dispose(old); sub.add(nl); tl[i] = nl; };
    return { ctls: [{ label: '模式', items: ['T2V（无起始图）', 'I2V（有起始图）'], get: () => v, set: k => { v = k; } }], update(p) {
      if (last !== v) { rebuild(); texL.clear(); }
      const k = clamp(Math.floor(seg(p, 0.05, 0.9) * 50), 0, 49), sg = p >= 0.9 ? 0 : lad[k], ts = Math.round(sg * 1000);
      cubes.forEach((b, i) => { const clean = v === 1 && i === 0, c = clean ? hex3(COL.img) : mix(hex3(COL.noise), hex3(COL.video), 1 - sg);
        b.material.color.setRGB(c[0], c[1], c[2]); b.material.emissive.setRGB(0, 0, 0); if (clean && (k % 5 === 0)) b.material.emissive.setRGB(0.25, 0.1, 0.1);
        setText(i, clean ? 't = 0（干净）' : `t = ${ts}`); });
      cap(v === 1 ? `I2V：首个隐帧 = VAE(图)，t = 0；其余 30 个隐帧 t = <b>${ts}</b> · 第 ${Math.min(k + 1, 50)} / 50 步 · 121 帧 1280 × 704 → 31 × 22 × 40 = <b>27,280</b> 个 token` : `T2V：全部 31 个隐帧从噪声开始，t = <b>${ts}</b> · 同一套权重、同样 48 个输入通道 · 5 秒 720p：TI2V 27,280 个 token，Wan2.1-14B 75,600 个`);
    } };
  }

  /* ---------- scene 11: results ---------- */
  function s11(G) {
    let view = +(OPT[0] ?? 0); G.add(L.grid(34, 34)); const sub = new THREE.Group(); G.add(sub);
    const T = [
      { t: '表 4 · VBench 总分（%）', g: ['MiniMax', 'Hunyuan', 'Gen-3', 'CogVideoX1.5', '可灵', 'Sora', 'Wan 1.3B', 'Wan 14B'], s: [['', COL.video, [83.41, 83.24, 82.32, 82.17, 81.85, 84.28, 83.96, 86.22]]], lo: 80, hi: 88 },
      { t: '表 2 · Wan-Bench（加权 / 14 项等权平均）', g: ['CNTopB', 'Hunyuan', 'Mochi', 'CNTopA', 'Sora', 'Wan 1.3B', 'Wan 14B'], s: [['加权', COL.dit, [0.690, 0.673, 0.639, 0.693, 0.700, 0.689, 0.724]], ['等权（我算的）', COL.time, [0.7125, 0.6846, 0.6556, 0.6881, 0.7171, 0.6996, 0.7154]]], lo: 0.6, hi: 0.75 },
      { t: '表 3 · Wan 14B 对各模型（胜率 − 负率，%）', g: ['CN-TopA', 'CN-TopB', 'CN-TopC', 'Runway'], s: [['画面', COL.video, [30.6, 15.9, 27.8, 48.1]], ['运动', COL.vae, [16.1, 9.7, 14.9, 40.3]], ['匹配', COL.text, [46.0, 57.9, 56.7, 69.1]], ['综合', COL.gold, [44.0, 44.0, 48.9, 67.6]]], lo: 0, hi: 75 },
      { t: 'OpenWAM 图 6 · 视频骨干（RoboTwin2.0-Full，%）', g: ['Wan2.1-VACE 1.3B', 'Cosmos 2B', 'Wan2.2-TI2V 5B', 'Wan2.1-I2V 14B'], s: [['', COL.gold, [90.14, 91.64, 92.39, 93.79]]], lo: 88, hi: 95 }
    ];
    let bars = [], last = -1;
    function rebuild() {
      clearSub(sub); bars = []; last = view; const v = T[view], Ng = v.g.length, Ns = v.s.length, gw = Math.min(4.6, 28 / Ng), w = Math.min(1.4, (gw - 0.6) / Ns);
      v.g.forEach((nm, i) => { const x0 = (i - (Ng - 1) / 2) * gw; sub.add(lab(nm, [x0, -0.2 - (Ng > 6 ? (i % 2) * 1.0 : 0), 2.6], { size: 16 }));
        v.s.forEach(([sn, c, vals], j) => { const x = x0 + (j - (Ns - 1) / 2) * (w + 0.08), b = block(w, 1, w, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(String(vals[i]), [x, 0, 0], { size: 14 }); sub.add(l); bars.push({ b, l, v: vals[i] }); }); });
      if (Ns > 1) v.s.forEach(([sn, c], j) => { sub.add(lab(sn, [-12 + j * 4.6, 10.4, 0], { size: 17, color: hexs(c) })); });
      sub.add(lab(v.t + `（纵轴 ${v.lo} 到 ${v.hi}）`, [0, 9.2, 0], { size: 19, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const ctls = [{ label: '表', items: ['VBench', 'Wan-Bench', '人工比较', 'OpenWAM 骨干'], get: () => view, set: k => { view = k; } }];
    const MSG = ['VBench 总分 = 0.8 × 质量 + 0.2 × 语义：Wan 14B 0.8 × 86.67 + 0.2 × 84.44 = 86.224', '加权时 Wan 14B 第一（0.724）；14 项等权平均时 Sora 0.7171 略高于 Wan 14B 0.7154', '这些数等于图 1 的“胜 − 负”：对 Runway 0.82 − 0.15 = 0.67', 'TI2V-5B 比 I2V-14B 低 93.79 − 92.39 = 1.40 点，参数只有 31%'];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const { lo, hi } = T[view], g = seg(p, 0, 0.5);
      bars.forEach(({ b, l, v }) => { const h = Math.max(0.02, (v - lo) / (hi - lo) * 7 * g); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.4; });
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
  window.__wanDebug = { get cap() { return $('cap').textContent; } };
})();
