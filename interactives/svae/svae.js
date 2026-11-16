'use strict';
/* S-VAE / PS-VAE (arXiv 2512.17909) taken apart into eleven animated scenes. Shapes and numbers come from the paper (v1);
   scene 11 comes from the OpenWAM code at commit 1dcaeea. Each scene's update(p) is a pure function of the timeline p plus
   the current toggles. Scenes 2, 3 and 6 compute toys live; they are labelled as toys. No PS-VAE network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { enc: 0x38d1ff, frozen: 0x5f7fb0, sem: 0x4fc98a, lat: 0xf2c14e, dec: 0x9d8cff, pix: 0xf0963c, loss: 0xe05d5d, kl: 0xd45fa0,
    text: 0xb48cff, noise: 0x8e9bb8, ok: 0x4fc98a, bad: 0xe05d5d, dim: 0x46506a, white: 0xeef2fa, data: 0x7cb8ff, gen: 0xf0963c, dit: 0x38d1ff };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  const SCENES = [
    { n: 1, part: '总览', title: '从图像到 96 维隐空间，再到生成', sub: '图 5 的 3D 版，加上下游的生成模型', dur: 14, cam: [0.08, 1.15, 36, [-1.6, 3.8, 0]],
      html: dl([['编码器', 'DINOv2-B，16 × 16 × 768'], ['语义 VAE', 'Eₛ / Dₛ，各 3 个 Transformer 块'], ['隐变量', '16 × 16 × 96，KL 正则'], ['像素解码', 'LDM 结构，输出 256 × 256'], ['生成', 'Transfusion 块 + 宽 DDT 头']]) +
        '<p>上排是自编码器：表示编码器出 768 维特征，语义编码器压到 96 维，语义解码器还原 768 维，像素解码器从 96 维隐变量直接出图。</p>' +
        '<p>下排是生成：文生图和编辑模型在 96 维隐空间里做流匹配，生成的隐变量交给像素解码器。</p>' +
        '<p>点画面里的方块可以跳到对应那一幕。</p>' + src('§3.3 图 5 · §3.4 · §4.1') },
    { n: 2, part: '问题一', title: '离流形：多出来的维度让样本离开平面', sub: '切换“只在平面里训练”和“在三维里训练”', dur: 13, cam: [0.3, 1.2, 20, [0, 3.4, 0]],
      html: dl([['论文的玩具', '二维“PS”字形嵌入八维'], ['模型', '同样的 256 通道 MLP 扩散'], ['结果', '八维收敛慢，最远 5% 样本离流形更远'], ['DINOv2-B', '768 维，信息量远小于维度']]) +
        '<p>表示编码器的特征维度高，但真正的信息只在一个低维子集上。扩散模型在高维空间里训练，得自己找到这个子集；找不准时，生成的隐变量就落在解码器没见过的地方，画出的物体结构扭曲。</p>' +
        '<p>论文把二维“PS”字形用列正交矩阵嵌进八维，同一个 MLP 在两种坐标下训练，八维的样本明显更散（原文图 3）。</p>' +
        guess('这里用三维代替八维，好画。点云是我采样的，橙色“生成样本”的漂移量是我设的，随进度条减小，只说明机制；读数（最远 5% 样本到最近数据点的平均距离）按这些点当场算。') + src('§3.2 · 图 3') },
    { n: 3, part: '问题一 · 式 (1)', title: '式 (1)：高维速度 = 平面内的速度 + 一项纯噪声', sub: '沿 ODE 走一条轨迹，两边当场算，看差值', dur: 16, cam: [0.45, 1.18, 22, [0, 3.6, 0]],
      html: dl([['式 (1)', 'v_x(x_t) = Q v_z(Qᵀx_t) + (I − QQᵀ) x_t / t'], ['前向', 'x_t = (1 − t) x₀ + t ε'], ['第一项', '沿流形的流，网络得自己学出 Q'], ['第二项', '正交方向的纯噪声，像恒等映射']]) +
        '<p>蓝色箭头是平面内的分量 Q v_z，橙色是垂直平面的分量 (I − QQᵀ)x_t / t。离数据越远（t 越大），橙色越长；网络在高维空间里必须把它也学准，这部分不带任何语义。</p>' +
        '<p>两边的值是按有限数据集的精确后验当场算的：高维一侧直接在三维里算，低维一侧在二维里算再嵌回去。读数是两者的最大差，应在 1e-15 左右。</p>' +
        toyb('数据是第 2 幕的 400 个点，l = 2，h = 3；轨迹用精确速度做 60 步 Euler，从 t = 1 走到 0，所以最后会落到某个训练点上（有限数据集的最优解就是记住数据）。表格里的“噪声占比”按 (h − l)/(h + l) 估算，假设每个内在维度方差为 1，只是量级。') + src('§3.2 式 (1) · 精读页读者注 1') },
    { n: 4, part: '问题二', title: '像素细节弱：DINOv2 不为重建训练', sub: '切换指标；柱子是表 2、表 4、表 6 的数', dur: 12, cam: [0.0, 1.2, 30, [0, 4.4, 0]],
      html: dl([['RAE', 'PSNR 19.20，SSIM 0.436'], ['MAR-VAE', 'PSNR 26.18，SSIM 0.715'], ['S-VAE', 'PSNR 17.78（压缩后更差）'], ['PS-VAE', 'PSNR 28.79，SSIM 0.817'], ['RAE-HD', 'PSNR 33.10，但 GenEval 60.2']]) +
        '<p>DINOv2 为判别训练，本来就丢掉对理解没用的高频细节。从它的特征解码图像，人脸、文字处都有伪影（原文图 2a）。生成模型从这样的空间学不到准确的纹理和几何，编辑时也保不住原图细节。</p>' +
        '<p>注意 S-VAE 的重建比 RAE 还差，但生成更好；RAE-HD 重建最好（甚至超过 Flux-VAE），生成却最差。重建和生成不是一回事，这正是论文的主线。</p>' + src('表 2 · 表 4 · 表 6') },
    { n: 5, part: '§3.3 S-VAE', title: 'S-VAE：768 维 → 96 维 → 768 维', sub: '语义编码器和解码器各 3 个 Transformer 块', dur: 14, cam: [0.1, 1.12, 35, [0, 2.0, 0]],
      html: dl([['输入 f_h′', '16 × 16 × 768（冻结 DINOv2-B）'], ['Eₛ', '3 个 Transformer 块 + MLP 投影'], ['隐变量 f_l', '16 × 16 × 96，μ 和 log σ²'], ['Dₛ', 'MLP 投影 + 3 个 Transformer 块'], ['输出 f_h″', '16 × 16 × 768']]) +
        '<p>每个位置（256 个 token）的 768 维特征被压到 96 维，空间网格不变。论文说三个块“继承自表示编码器”，没说清是只沿用结构还是拿 DINOv2 某几层的权重初始化（补充材料缺失）。</p>' +
        '<p>压缩比 768 / 96 = 8。每张图的数从 196,608 降到 24,576。</p>' +
        guess('柱高按通道数的对数画，块里的层数是论文的数，块的大小不代表参数量。') + src('§3.3 · 图 5') },
    { n: 6, part: '§3.3 目标', title: '语义重建 + KL；像素解码器被截断梯度', sub: '红色粒子是梯度，看它在哪里停下', dur: 14, cam: [0.2, 1.12, 27, [0, 3.4, 0]],
      html: dl([['𝓛ₛ', '特征 ℓ₂ + 余弦，在 f_h″ 和 f_h′ 之间'], ['𝓛_KL', '后验 q(f_l) 对 N(0, I)'], ['像素 𝓛_P', '只训练像素解码器'], ['detach', 'f_l.detach()，梯度不回传'], ['编码器', 'DINOv2-B 冻结']]) +
        '<p>S-VAE 的隐空间完全由特征重建决定。为了评估它（算 rFID、PSNR），另训一个像素解码器，但它的输入是截断梯度的 f_l，所以像素损失不影响隐空间。</p>' +
        '<p>这就是为什么表 4 里 S-VAE 的 PSNR 只有 17.78：隐空间里没有为像素保留什么，解码器只能尽力而为。</p>' +
        toyb('左下两组 8 根柱子是一对玩具向量 f_h′ 和 f_h″，f_h″ 随进度条向 f_h′ 靠拢；ℓ₂、1 − cos、KL 读数当场算（KL 对一个均值、方差随进度变化的玩具高斯算）。论文没给 ℓ₂ 和余弦的相对权重，这里按 1 : 1 相加。') + src('§3.3 · 图 5 图注 · §4.1') },
    { n: 7, part: '§3.3 PS-VAE', title: '解冻编码器，让像素梯度回传', sub: '切换阶段 1（S-VAE）和阶段 2（PS-VAE）', dur: 14, cam: [0.2, 1.12, 28, [0, 3.2, 0]],
      html: dl([['阶段 1', '编码器冻结；像素解码器在 detach 的隐变量上训'], ['阶段 2', '全部解冻；去掉 detach'], ['语义约束', '𝓛ₛ 对照冻结原编码器的输出'], ['权重', '𝓛ₛ : 𝓛_P = 1 : 0.1（§4.1）'], ['SigLIP2', '§4.4 写 0.1:1 → 0.05:1，和 §4.1 相反']]) +
        '<p>阶段 2 让像素损失的梯度穿过像素解码器、语义编码器，一直到表示编码器，编码器学会在算语义特征的同时保留细节。为了不让语义跑偏，下面多了一条冻结的原编码器，给 𝓛ₛ 当目标。</p>' +
        '<p>结果（表 4）：PSNR 17.78 → 28.79，线性探测 81.1 → 79.5，只掉一点；GenEval 73.7 → 76.6，编辑 0.12 → 0.22。</p>' +
        '<p>权重比的两处说法互相矛盾，见精读页读者注 10。</p>' + src('§3.3 · 图 5 · §4.1 · §4.4 · 表 4') },
    { n: 8, part: '隐空间', title: '压缩后的隐空间有多大', sub: '切换“通道消融”和“每张图的数”', dur: 12, cam: [0.0, 1.22, 31, [0, 4.6, 0]],
      html: dl([['32c', 'PSNR 24.53，DPG 最高 84.25'], ['96c', 'PSNR 28.79，选定值'], ['112c', 'PSNR 30.51，DPG 掉到 83.03'], ['256c', 'PSNR 30.30，不再变好'], ['RAE', '16 × 16 × 768 = 196,608，和像素一样多']]) +
        '<p>通道越多重建越好，到 112 饱和；生成从 32 到 96 差不多，112 时 DPG-Bench 掉约 0.6。作者据此认为在这个设置下“内在维度”约 96。</p>' +
        '<p>换个角度看：RAE 的隐变量和 256 × 256 × 3 的像素一样多，根本没压缩；PS-VAE 96c 是像素的 1/8，但仍比常见 VAE 多（MAR-VAE 4,096）。</p>' + src('§5.2 图 11 · 精读页读者注 3') },
    { n: 9, part: '§3.4 / §4.1 生成', title: '在隐空间上训练文生图和编辑', sub: '切换任务看序列和注意力掩码；切换空间看 shift', dur: 15, cam: [0.0, 1.2, 30, [0, 4.4, 0]],
      html: dl([['块', 'Transfusion 式共享块，Qwen2.5-0.5B 初始化'], ['头', '宽 DDT 头，共 653M'], ['文生图', '[文本（因果）| 带噪隐变量（全注意力）]'], ['编辑', '[干净隐变量 | 指令（因果）| 带噪隐变量]'], ['shift', 's = √(C·P² / 16)，推理统一用 3']]) +
        '<p>文本 token 用因果掩码，图像隐变量 token 之间全注意力。编辑时输入图的干净隐变量放在最前面，和带噪隐变量都用全注意力。</p>' +
        '<p>不同空间的通道数和 patch 大小不同，信噪比会变，所以训练时把 logit-normal 采样的 t 按 s 平移。右边的曲线和读数当场按公式算。</p>' +
        guess('掩码矩阵里“图像 token 能不能看到后面的文本”“干净隐变量能不能看到带噪隐变量”，论文没写到这个粒度，这里按“文本因果、隐变量全注意力”画，细节是我的推断。token 数也缩小了（256 个隐变量画成 12 个）。') + src('§3.4 · §4.1 · 表 1') },
    { n: 10, part: '§4.2 / §5.1 对比', title: '和其他隐空间比', sub: '切换指标；柱子都是原文数字', dur: 12, cam: [0.0, 1.22, 31, [0, 4.8, 0]],
      html: dl([['GenEval', 'PS-VAE 96c 76.56 最高'], ['DPG-Bench', 'PS-VAE 32c 84.25 最高'], ['编辑', 'PS-VAE 32c 0.274 最高'], ['去掉语义（P-VAE）', '编辑 0.04'], ['只压缩（S-VAE）', 'GenEval 73.7']]) +
        '<p>只为像素训练的空间（Flux-VAE、MAR-VAE、P-VAE）编辑分数低；只有语义的 RAE 生成差；两者都有的 PS-VAE 和 VA-VAE 最好。</p>' +
        '<p>S-VAE、P-VAE 两行来自表 4（一位小数），其余来自表 2。表 2 的文生图列是第 200k 步的值，图 7 图例里的最高点可能更高（精读页读者注 8）。</p>' + src('表 2 · 表 4') },
    { n: 11, part: 'OpenWAM', title: 'OpenWAM 的简化版：只要 S-VAE，压到 48 维', sub: '切换编码器；柱子是 OpenWAM 图 7 的 RoboTwin 成功率', dur: 15, cam: [0.0, 1.2, 38, [0, 5.0, 0]],
      html: dl([['输入', '冻结 DINOv3（768）或 V-JEPA 2.1（1408）'], ['形状', '(B, D, 3, 24, 20)，每帧 480 个 token'], ['S-VAE', '3 块 @ D → μ 48 维，只取 μ'], ['损失', 'MSE + (1 − cos) + 1e-4·KL'], ['数据', 'WAM 自己的训练集（RoboTwin）'], ['接 DiT', 'LayerNorm → Conv3d(48, 3072, 1×2×2)']]) +
        '<p>OpenWAM 只借了 S-VAE 这一步：编码器冻结、只重建特征、KL 正则，没有像素解码器，也不微调编码器。压到 48 维是为了和 Wan2.2-VAE 对齐，DiT 的输入输出形状不用改。</p>' +
        '<p>和原论文比：通道 48 对 96；压缩比 16 或 29.3 对 8；块是随机初始化的 pre-LN 块（FFN 2048）；训练数据是机器人视频，不是 ImageNet。</p>' +
        '<p>加 S-VAE 后两个表示式编码器都超过了 FLUX.2-VAE，DINOv3 加 S-VAE 几乎追平 Wan2.2-VAE。</p>' + src('OpenWAM §4.1.2 图 7 · svae/model.py · train.yaml · 精读页“在 OpenWAM 里怎么用”') }
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

  /* ---------- 3D helpers (same pattern as interactives/phc/phc.js) ---------- */
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
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  const tint = (m, h) => { m.material.color.setHex(h); m.userData.c = hex3(h); };
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
  /* a 16x16 (or nx x ny) grid of token columns, height = channel count on a log scale */
  const hC = c => 0.35 * Math.log2(c / 8 + 1);
  function grid(G, nx, ny, chans, color, at, o = {}) {
    const im = inst(BOX, nx * ny); G.add(im); const sp = o.sp ?? 0.16, c = hex3(color);
    im.userData.set = (k, ch) => { const h = hC(ch ?? chans) * k; let n = 0; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { setI(im, n, [at[0] + (i - (nx - 1) / 2) * sp, at[1] + h / 2, at[2] + (j - (ny - 1) / 2) * sp], [sp * 0.82, Math.max(0.001, h), sp * 0.82]); colI(im, n, c); n++; } done(im); };
    im.userData.set(1); return im;
  }
  function buildCtl() {
    const box = $('ctl'); box.innerHTML = ''; box.hidden = true; if (!api) return;
    (api.ctls || []).forEach((c, gi) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-g="${gi}" data-k="${k}" aria-pressed="${c.get() === k}">${t}</button>`).join('');
      box.appendChild(row); box.hidden = false;
    });
  }
  function syncCtl() { (api?.ctls || []).forEach((c, gi) => { $('ctl').querySelectorAll(`button[data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(c.get() === +b.dataset.k))); }); }

  /* ---------- the toy "PS" data set used by scenes 2 and 3 (seeded, so every reload is the same) ---------- */
  const PS = (function () {
    const r = L.rng(5), strokes = [];
    const arc = (cx, cy, rx, ry, a0, a1, n) => { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } return o; };
    strokes.push([[-0.95, -0.85], [-0.95, 0.85]]);
    strokes.push(arc(-0.95, 0.42, 0.55, 0.43, Math.PI / 2, -Math.PI / 2, 24));
    strokes.push(arc(0.45, 0.42, 0.45, 0.42, 0.35, 1.5 * Math.PI, 30));
    strokes.push(arc(0.45, -0.42, 0.45, 0.42, Math.PI / 2, -Math.PI * 1.15, 30));
    const segs = []; let tot = 0; strokes.forEach(s => { for (let i = 0; i < s.length - 1; i++) { const l = Math.hypot(s[i + 1][0] - s[i][0], s[i + 1][1] - s[i][1]); segs.push([s[i], s[i + 1], l]); tot += l; } });
    const pts = [];
    for (let k = 0; k < 400; k++) { let u = r() * tot, j = 0; while (u > segs[j][2] && j < segs.length - 1) { u -= segs[j][2]; j++; } const [a, b, l] = segs[j], f = u / l; pts.push([a[0] + (b[0] - a[0]) * f + 0.035 * L.gauss(r), a[1] + (b[1] - a[1]) * f + 0.035 * L.gauss(r)]); }
    return pts;
  })();
  /* Q: 3x2 column-orthonormal (the plane is tilted about the x axis) */
  const TILT = 0.42, Q = [[1, 0], [0, Math.cos(TILT)], [0, Math.sin(TILT)]];
  const emb = z => [Q[0][0] * z[0] + Q[0][1] * z[1], Q[1][0] * z[0] + Q[1][1] * z[1], Q[2][0] * z[0] + Q[2][1] * z[1]];
  const proj = x => [Q[0][0] * x[0] + Q[1][0] * x[1] + Q[2][0] * x[2], Q[0][1] * x[0] + Q[1][1] * x[1] + Q[2][1] * x[2]];
  const X3 = PS.map(emb);
  /* exact posterior velocity E[eps - x0 | x_t] for a finite data set D: (x_t - sum_k w_k x_k) / t */
  function vel(xt, t, D) {
    let mn = Infinity; const d2 = D.map(x => { let s = 0; for (let i = 0; i < xt.length; i++) s += (xt[i] - (1 - t) * x[i]) ** 2; mn = Math.min(mn, s); return s; });
    let ws = 0; const m = new Array(xt.length).fill(0);
    d2.forEach((s, k) => { const w = Math.exp(-(s - mn) / (2 * t * t)); ws += w; for (let i = 0; i < xt.length; i++) m[i] += w * D[k][i]; });
    return xt.map((v, i) => (v - m[i] / ws) / t);
  }
  const W3 = (x, s = 3.2, y0 = 3.2) => [x[0] * s, y0 + x[1] * s, x[2] * s];

  /* ---------- scene 1: overview, clickable ---------- */
  function s1(G) {
    const Y1 = 7.2, Y2 = 1.2, XD = 3.6;
    const top = [['图像\n224 × 224', -16.2, COL.noise, 2], ['DINOv2-B\n表示编码器', -10.8, COL.frozen, 3], ['f_h′\n16×16×768', -5.4, COL.enc, 4], ['Eₛ\n3 块 + MLP', -0.9, COL.sem, 5], ['f_l\n16×16×96', XD, COL.lat, 8], ['Dₛ\nMLP + 3 块', 8.1, COL.dec, 5], ['f_h″\n768', 12.6, COL.enc, 6]];
    const B = top.map(([t, x, c, go]) => { const b = block(2.5, 1.5, 1.4, c, [x, Y1, 0]); b.userData.go = go - 1; PICKS.push(b); G.add(b, lab(t, [x, Y1 + 1.5, 0], { size: 20 })); return b; });
    const px = block(2.5, 1.4, 1.4, COL.pix, [XD, Y1 - 3.4, 0]); px.userData.go = 6; PICKS.push(px); B.push(px); G.add(px, lab('像素解码器\n→ 256 × 256', [XD + 3.7, Y1 - 3.4, 0], { size: 19 }));
    const gen = [['文本提示\n或指令 + 原图', -10.8, COL.text], ['Transfusion 块\nQwen2.5-0.5B', -5.4, COL.dit], ['宽 DDT 头', -0.9, COL.dit], ['生成的 f_l', XD, COL.lat]];
    const Bg = gen.map(([t, x, c]) => { const b = block(2.6, 1.2, 1.2, c, [x, Y2 - 0.6, 3.2]); b.userData.go = 8; PICKS.push(b); G.add(b, lab(t, [x, Y2 - 2.0, 3.2], { size: 19 })); return b; });
    const f1 = stream(G, 16, COL.enc, 0.12), f2 = stream(G, 10, COL.pix, 0.12), f3 = stream(G, 12, COL.dit, 0.12);
    const pA = [[-16.2, Y1, 0.9], [12.6, Y1, 0.9]], pB = [[XD, Y1, 0.9], [XD, Y1 - 3.4, 0.9]], pC = [[-10.8, Y2 - 0.6, 4.1], [XD, Y2 - 0.6, 4.1], [XD, Y1 - 3.4, 1.5]];
    wire(G, pA, COL.white, { opacity: 0.25 }); wire(G, pB, COL.white, { opacity: 0.25 }); wire(G, pC, COL.white, { opacity: 0.25, dashed: true });
    G.add(lab('自编码器（重建训练）', [-2, Y1 + 3.3, 0], { size: 22, border: 'rgba(56,209,255,.6)' }), lab('生成模型在 f_l 空间里训练', [-3.6, Y2 - 4.5, 3.2], { size: 20, border: 'rgba(240,150,60,.6)' }));
    return { update(p) {
      const k = (p * 3) % 1; f1(pA, k, 1); f2(pB, k, p > 0.3 ? 1 : 0); f3(pC, (p * 2) % 1, p > 0.55 ? 1 : 0);
      B.forEach((b, i) => glow(b, i < 7 ? (Math.abs(i - k * 7) < 0.7 ? 0.5 : 0.05) : (p > 0.3 ? 0.35 : 0.05))); Bg.forEach((b, i) => glow(b, p > 0.55 && Math.abs(i - ((p * 2) % 1) * 4) < 0.7 ? 0.5 : 0.05));
      cap(p < 0.3 ? '表示编码器出 <b>768</b> 维特征，语义 VAE 压到 <b>96</b> 维再还原' : p < 0.55 ? '像素解码器从 <b>96</b> 维隐变量直接出 256 × 256 的图' : '文生图和编辑模型在 <b>16 × 16 × 96</b> 的隐空间里生成，再交给像素解码器');
    } };
  }

  /* ---------- scene 2: off-manifold, toy ---------- */
  function s2(G) {
    let mode = +(OPT[0] ?? 1);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 7.2), new THREE.MeshBasicMaterial({ color: 0x38d1ff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
    plane.position.set(0, 3.2, 0); plane.rotation.x = TILT; G.add(plane);
    const n = PS.length, dI = inst(BALL, n), gI = inst(BALL, n); G.add(dI, gI);
    X3.forEach((x, i) => { setI(dI, i, W3(x), 0.05); colI(dI, i, hex3(COL.data)); }); done(dI);
    const r = L.rng(17), eIn = PS.map(() => [L.gauss(r), L.gauss(r)]), eOut = PS.map(() => L.gauss(r)), pick = PS.map(() => Math.floor(r() * n));
    const nrm = [0, -Math.sin(TILT), Math.cos(TILT)];
    G.add(lab('蓝：数据（二维流形）  橙：生成样本', [0, 7.6, 0], { size: 20 }), lab('平面 = 流形所在的子空间', [3.6, 0.7, 2.2], { size: 18 }));
    const ctls = [{ label: '训练在', items: ['二维坐标', '三维坐标'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const sIn = 0.16 * (1 - p) + 0.03, sOut = mode ? 0.55 * (1 - p) + 0.12 : 0; const G3 = [];
      for (let i = 0; i < n; i++) { const z = PS[pick[i]], zz = [z[0] + sIn * eIn[i][0], z[1] + sIn * eIn[i][1]], x = emb(zz), o = sOut * eOut[i]; const q = [x[0] + o * nrm[0], x[1] + o * nrm[1], x[2] + o * nrm[2]]; G3.push(q); setI(gI, i, W3(q), 0.055); colI(gI, i, hex3(COL.gen)); }
      done(gI);
      const dist = G3.map(q => { let m = Infinity; for (const x of X3) m = Math.min(m, (q[0] - x[0]) ** 2 + (q[1] - x[1]) ** 2 + (q[2] - x[2]) ** 2); return Math.sqrt(m); }).sort((a, b) => b - a);
      const k = Math.max(1, Math.round(n * 0.05)), top = dist.slice(0, k).reduce((a, b) => a + b, 0) / k;
      cap(`${mode ? '三维' : '二维'}坐标里训练 · 最远 5% 样本到最近数据点的平均距离 <b>${top.toFixed(3)}</b>（玩具，单位是字形坐标）`);
    } };
  }

  /* ---------- scene 3: Eq. (1) computed live along an exact-velocity ODE path ---------- */
  function s3(G) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 7.2), new THREE.MeshBasicMaterial({ color: 0x38d1ff, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }));
    plane.position.set(0, 3.2, 0); plane.rotation.x = TILT; G.add(plane);
    const n = PS.length, dI = inst(BALL, n); G.add(dI); X3.forEach((x, i) => { setI(dI, i, W3(x), 0.045); colI(dI, i, hex3(COL.data)); }); done(dI);
    /* one trajectory: start from seeded noise at t = 1, 60 Euler steps with the exact 3D velocity */
    const r = L.rng(29), N = 60, path = []; let x = [L.gauss(r) * 0.9, L.gauss(r) * 0.9, L.gauss(r) * 0.9];
    for (let i = 0; i <= N; i++) { const t = 1 - i / N; path.push({ x: x.slice(), t }); if (i < N) { const v = vel(x, t, X3); x = x.map((a, j) => a - v[j] / N); } }
    const tr = ribbon(G, N + 1, COL.gen, 0.05, { order: 3 }); const dot = L.sphere(0.16, COL.gen); G.add(dot);
    const aIn = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, COL.enc, 0.35, 0.22), aOut = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, COL.pix, 0.35, 0.22); G.add(aIn, aOut);
    const nrm = [0, -Math.sin(TILT), Math.cos(TILT)];
    G.add(lab('蓝箭头：−Q v_z（沿平面）', [0, 8.6, 0], { size: 19, color: css(COL.enc) }), lab('橙箭头：−(I − QQᵀ)x_t / t（垂直平面）', [0, 7.7, 0], { size: 19, color: css(COL.pix) }));
    const share = [[8, 2], [768, 96], [1408, 48]].map(([h, l]) => `h=${h}, l=${l}: ${((h - l) / (h + l) * 100).toFixed(0)}%`).join('  ');
    G.add(lab('正交噪声占速度目标的量级（示意）\n' + share, [0, -0.6, 2.5], { size: 17 }));
    return { update(p) {
      const i = Math.min(N - 1, Math.round(p * (N - 1))), st = path[i], xt = st.x, t = st.t;
      tr.userData.set(path.slice(0, i + 1).map(q => W3(q.x))); dot.position.set(...W3(xt));
      const vx = vel(xt, t, X3), zt = proj(xt), vz = vel(zt, t, PS), qv = emb(vz), dotn = xt[0] * nrm[0] + xt[1] * nrm[1] + xt[2] * nrm[2], orth = nrm.map(a => a * dotn / t);
      const rhs = qv.map((a, j) => a + orth[j]); const diff = Math.max(...vx.map((a, j) => Math.abs(a - rhs[j])));
      const sc = 1.0, o = new THREE.Vector3(...W3(xt));
      const setA = (A, v) => { const d = new THREE.Vector3(-v[0], -v[1], -v[2]).multiplyScalar(3.2 * sc); const len = Math.max(0.05, d.length()); A.position.copy(o); A.setDirection(d.normalize()); A.setLength(len, Math.min(0.4, len * 0.35), Math.min(0.25, len * 0.2)); };
      setA(aIn, qv); setA(aOut, orth);
      const nIn = Math.hypot(...qv), nOut = Math.hypot(...orth);
      cap(`t = <b>${t.toFixed(2)}</b> · |沿平面| ${nIn.toFixed(2)} · |垂直| ${nOut.toFixed(2)} · 式 (1) 两边最大差 <b>${diff.toExponential(1)}</b>`);
    } };
  }

  /* ---------- scene 4: reconstruction bars ---------- */
  function s4(G) {
    let m = +(OPT[0] ?? 0);
    const rows = [['Flux-VAE', COL.pix, 32.86, 0.912, 0.175], ['RAE-HD', COL.bad, 33.10, 0.916, 0.193], ['P-VAE', COL.noise, 29.81, 0.850, 0.398], ['PS-VAE 96c', COL.lat, 28.79, 0.817, 0.203], ['VAVAE', COL.dec, 27.71, 0.779, 0.279], ['MAR-VAE', COL.frozen, 26.18, 0.715, 0.534], ['PS-VAE 32c', COL.lat, 24.53, 0.662, 0.584], ['RAE', COL.enc, 19.20, 0.436, 0.619], ['S-VAE', COL.sem, 17.78, 0.390, 1.407]];
    G.add(L.grid(34, 34));
    const bars = rows.map(([nm, c], i) => { const x = (i - (rows.length - 1) / 2) * 3.1, b = bar(G, x, 0, 1.6, c); G.add(lab(nm, [x, -0.5, 2.0], { size: 18 })); return { b, x }; });
    const vl = bars.map(() => null);
    const MET = [['PSNR（dB）↑', 2, v => v / 35 * 7.5, v => v.toFixed(2)], ['SSIM ↑', 3, v => v * 7.5, v => v.toFixed(3)], ['rFID ↓', 4, v => v / 1.5 * 7.5, v => v.toFixed(3)]];
    const ttl = { s: null, k: -1 };
    const ctls = [{ label: '指标', items: ['PSNR', 'SSIM', 'rFID'], get: () => m, set: k => { m = k; } }];
    return { ctls, update(p) {
      const g = seg(p, 0, 0.5), M = MET[m];
      if (ttl.k !== m) { if (ttl.s) { G.remove(ttl.s); LABS = LABS.filter(x => x !== ttl.s); } ttl.s = lab('重建 · ' + M[0], [0, 9.2, 0], { size: 23, border: 'rgba(56,209,255,.7)' }); G.add(ttl.s); ttl.k = m;
        bars.forEach((B, i) => { if (vl[i]) { G.remove(vl[i]); LABS = LABS.filter(x => x !== vl[i]); } vl[i] = lab(M[3](rows[i][M[1]]), [B.x, 1, 0], { size: 17 }); G.add(vl[i]); }); }
      bars.forEach((B, i) => { const h = M[2](rows[i][M[1]]) * g; B.b.userData.set(h); vl[i].position.y = h + 0.45; });
      cap(m === 2 ? 'rFID 越低越好：S-VAE <b>1.407</b> 最差，RAE 0.619 和 MAR-VAE 0.534 相近（但 PSNR 差 7 dB）' : 'RAE 的 PSNR <b>19.20</b>，比 MAR-VAE 低 7 dB；压缩成 S-VAE 后更低（17.78），补上像素损失的 PS-VAE 到 <b>28.79</b>');
    } };
  }

  /* ---------- scene 5: S-VAE structure ---------- */
  function s5(G) {
    const gin = grid(G, 16, 16, 768, COL.enc, [-12.4, 0, 0], { sp: 0.17 }), gmu = grid(G, 16, 16, 96, COL.lat, [0, 0, 0], { sp: 0.17 }), gout = grid(G, 16, 16, 768, COL.enc, [12.4, 0, 0], { sp: 0.17 });
    const Es = [], Ds = [];
    for (let i = 0; i < 3; i++) { const b = block(2.0, 0.5, 2.4, COL.sem, [-8.0, 0.5 + i * 0.7, 0]); Es.push(b); G.add(b); const d = block(2.0, 0.5, 2.4, COL.dec, [8.0, 0.5 + (2 - i) * 0.7 + 0.0, 0]); Ds.push(d); G.add(d); }
    const pe = block(0.7, 1.6, 2.4, COL.sem, [-4.4, 0.8, 0], { opacity: 0.85 }), pd = block(0.7, 1.6, 2.4, COL.dec, [4.4, 0.8, 0], { opacity: 0.85 }); G.add(pe, pd);
    G.add(lab('f_h′  16 × 16 × 768\n冻结 DINOv2-B 输出', [-12.4, 5.2, 0], { size: 19 }), lab('Eₛ：3 个\nTransformer 块', [-8.0, 3.6, 0], { size: 18 }), lab('MLP\n768 → 2×96', [-4.4, -1.2, 1.6], { size: 17 }),
      lab('f_l  16 × 16 × 96\nμ、log σ²，采样 + KL', [0, 3.4, 0], { size: 19, border: 'rgba(242,193,78,.7)' }), lab('MLP\n96 → 768', [4.4, -1.2, 1.6], { size: 17 }), lab('Dₛ：3 个\nTransformer 块', [8.0, 3.6, 0], { size: 18 }), lab('f_h″  16 × 16 × 768\n重建的特征', [12.4, 5.2, 0], { size: 19 }));
    const fl = stream(G, 20, COL.lat, 0.1), path = [[-12.4, 1.2, 1.8], [-8.0, 1.2, 1.8], [-4.4, 1.0, 1.8], [0, 0.6, 1.8], [4.4, 1.0, 1.8], [8.0, 1.2, 1.8], [12.4, 1.2, 1.8]];
    return { update(p) {
      const g = seg(p, 0, 0.25); gin.userData.set(g); gmu.userData.set(seg(p, 0.3, 0.5)); gout.userData.set(seg(p, 0.6, 0.8));
      fl(path, (p * 2) % 1, p > 0.2 ? 1 : 0); const q = (p * 2) % 1;
      Es.forEach(b => glow(b, q < 0.3 ? 0.4 : 0.05)); Ds.forEach(b => glow(b, q > 0.55 && q < 0.85 ? 0.4 : 0.05));
      cap(p < 0.3 ? '每个位置 <b>768</b> 维，共 256 个 token：信息远比维度少' : p < 0.6 ? '压到 <b>96</b> 维，空间网格不变；768 / 96 = <b>8</b> 倍' : '解码器还原 768 维，和输入比 ℓ₂ 和余弦（下一幕）');
    } };
  }

  /* ---------- scene 6: semantic recon objective, detach (toy vectors computed live) ---------- */
  function s6(G) {
    const enc = block(2.4, 1.4, 1.4, COL.frozen, [-11, 6, 0]), es = block(2.2, 1.4, 1.4, COL.sem, [-6.6, 6, 0]), fl = block(1.6, 1.4, 1.4, COL.lat, [-3, 6, 0]), ds = block(2.2, 1.4, 1.4, COL.dec, [0.8, 6, 0]), ls = block(2.2, 1.2, 1.2, COL.loss, [5.0, 6, 0]);
    const pix = block(2.4, 1.4, 1.4, COL.pix, [-3, 2.4, 0]), lp = block(2.2, 1.2, 1.2, COL.loss, [1.8, 2.4, 0]);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide })); wall.position.set(-3, 4.25, 0.75); G.add(wall);
    G.add(enc, es, fl, ds, ls, pix, lp, lab('DINOv2-B ❄ 冻结', [-11, 7.4, 0], { size: 18 }), lab('Eₛ', [-6.6, 7.4, 0], { size: 19 }), lab('f_l（96）', [-3, 7.4, 0], { size: 18 }), lab('Dₛ', [0.8, 7.4, 0], { size: 19 }),
      lab('𝓛ₛ = ℓ₂ + (1 − cos)\n+ 𝓛_KL', [5.0, 7.7, 0], { size: 18 }), lab('像素解码器', [-3, 1.1, 0], { size: 18 }), lab('𝓛_P', [1.8, 1.1, 0], { size: 19 }), lab('detach', [-1.2, 4.25, 0.9], { size: 17, border: 'rgba(255,255,255,.7)' }));
    const back1 = stream(G, 12, COL.loss, 0.12), back2 = stream(G, 8, COL.loss, 0.12);
    const pA = [[5.0, 6, 0.9], [-6.6, 6, 0.9], [-9.6, 6, 0.9]], pB = [[1.8, 2.4, 0.9], [-3, 2.4, 0.9], [-3, 4.0, 0.9]];
    const r = L.rng(3), tgt = Array.from({ length: 8 }, () => L.gauss(r)), noise = Array.from({ length: 8 }, () => L.gauss(r));
    const XP = 6.5, b1 = [], b2 = [];
    for (let i = 0; i < 8; i++) { b1.push(bar(G, XP + i * 0.5, 0, 0.2, COL.enc, { d: 0.2 })); b2.push(bar(G, XP + i * 0.5 + 0.2, 0, 0.2, COL.dec, { d: 0.2 })); }
    G.add(lab('蓝 f_h′  紫 f_h″（玩具 8 维）', [XP + 1.9, -0.6, 1.2], { size: 17 }));
    return { update(p) {
      const k = Math.pow(1 - p, 1.6) * 1.4, rec = tgt.map((v, i) => v + k * noise[i]);
      for (let i = 0; i < 8; i++) { b1[i].userData.set(Math.abs(tgt[i]) * 1.4); b2[i].userData.set(Math.abs(rec[i]) * 1.4); }
      const l2 = tgt.reduce((s, v, i) => s + (v - rec[i]) ** 2, 0) / 8, dot = tgt.reduce((s, v, i) => s + v * rec[i], 0), cs = dot / Math.hypot(...tgt) / Math.hypot(...rec);
      const mu = 1.2 * (1 - p) + 0.3, lv = -1.5 * (1 - p) - 0.2, kl = -0.5 * (1 + lv - mu * mu - Math.exp(lv));
      const q = (p * 2.5) % 1; back1(pA, q, 1); back2(pB, q, 1);
      glow(es, 0.3 + 0.2 * Math.sin(p * 20)); glow(ds, 0.3); glow(pix, 0.3); glow(enc, 0);
      cap(`ℓ₂ <b>${l2.toFixed(3)}</b> · 1 − cos <b>${(1 - cs).toFixed(3)}</b> · KL（玩具高斯）<b>${kl.toFixed(2)}</b> · 像素梯度停在 detach，语义梯度停在冻结的编码器`);
    } };
  }

  /* ---------- scene 7: PS-VAE, stage toggle ---------- */
  function s7(G) {
    let st = +(OPT[0] ?? 1);
    const enc = block(2.4, 1.4, 1.4, COL.frozen, [-11, 6, 0]), es = block(2.2, 1.4, 1.4, COL.sem, [-6.6, 6, 0]), fl = block(1.6, 1.4, 1.4, COL.lat, [-3, 6, 0]), ds = block(2.2, 1.4, 1.4, COL.dec, [0.8, 6, 0]), ls = block(2.4, 1.2, 1.2, COL.loss, [5.4, 6, 0]);
    const pix = block(2.4, 1.4, 1.4, COL.pix, [-3, 2.4, 0]), lp = block(2.2, 1.2, 1.2, COL.loss, [1.8, 2.4, 0]), copy = block(2.4, 1.4, 1.4, COL.frozen, [-11, 0.6, 2.6]);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide })); wall.position.set(-3, 4.25, 0.75); G.add(wall);
    G.add(enc, es, fl, ds, ls, pix, lp, copy, lab('Eₛ', [-6.6, 7.4, 0], { size: 19 }), lab('f_l', [-3, 7.4, 0], { size: 18 }), lab('Dₛ', [0.8, 7.4, 0], { size: 19 }), lab('𝓛ₛ × 1', [5.4, 7.4, 0], { size: 19 }), lab('像素解码器', [-3, 1.1, 0], { size: 18 }), lab('𝓛_P × 0.1', [1.8, 1.1, 0], { size: 19 }));
    const encL = { s: null, k: -1 }, tgtW = wire(G, [[-11, 0.6, 3.4], [5.4, 0.6, 3.4], [5.4, 5.4, 0.6]], COL.white, { opacity: 0.4, dashed: true });
    const tl = lab('冻结原编码器 ❄ → 𝓛ₛ 的目标 f_h', [-4.5, 0.2, 3.4], { size: 18 }); G.add(tl);
    const back1 = stream(G, 14, COL.loss, 0.12), back2 = stream(G, 12, COL.loss, 0.12);
    const ctls = [{ label: '阶段', items: ['1：S-VAE', '2：PS-VAE'], get: () => st, set: k => { st = k; } }];
    return { ctls, update(p) {
      if (encL.k !== st) { if (encL.s) { G.remove(encL.s); LABS = LABS.filter(x => x !== encL.s); } encL.s = lab(st ? 'DINOv2-B 🔥 解冻' : 'DINOv2-B ❄ 冻结', [-11, 7.4, 0], { size: 18 }); G.add(encL.s); encL.k = st; tint(enc, st ? COL.enc : COL.frozen); }
      wall.visible = !st; copy.visible = !!st; tl.visible = !!st; tgtW.visible = !!st;
      const q = (p * 2.5) % 1;
      back1([[5.4, 6, 0.9], [-6.6, 6, 0.9], st ? [-11, 6, 0.9] : [-9.6, 6, 0.9]], q, 1);
      back2(st ? [[1.8, 2.4, 0.9], [-3, 2.4, 0.9], [-3, 6, 0.9], [-11, 6, 0.9]] : [[1.8, 2.4, 0.9], [-3, 2.4, 0.9], [-3, 4.0, 0.9]], q, 1);
      glow(enc, st ? 0.35 : 0); glow(es, 0.3);
      cap(st ? '阶段 2：像素梯度穿过 Eₛ 回到编码器；𝓛ₛ 对照<b>冻结的原编码器</b>，表 4：PSNR 17.78 → <b>28.79</b>，线性探测 81.1 → 79.5' : '阶段 1：编码器冻结，像素解码器在 <b>detach</b> 的 f_l 上训练，只用来评估');
    } };
  }

  /* ---------- scene 8: channel ablation and size per image ---------- */
  function s8(G) {
    let v = +(OPT[0] ?? 0); G.add(L.grid(34, 34)); const sub = new THREE.Group(); G.add(sub); let bars = [], last = -1;
    const CH = [[32, 24.53, 84.25], [48, 25.43, 83.92], [64, 26.65, 83.78], [80, 27.38, 83.84], [96, 28.79, 83.62], [112, 30.51, 83.03], [256, 30.30, null]];
    const SZ = [['像素 256²×3', 196608, COL.noise], ['RAE 16²×768', 196608, COL.enc], ['PS-VAE 96c', 24576, COL.lat], ['Flux-VAE 32²×16', 16384, COL.pix], ['PS-VAE 32c', 8192, COL.lat], ['MAR-VAE 16²×16', 4096, COL.frozen]];
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = v;
      if (v === 0) { CH.forEach(([c, ps, dpg], i) => { const x = (i - 3) * 3.4, b = block(1.5, 1, 1.5, c === 96 ? COL.lat : COL.sem, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(ps.toFixed(2), [x, 0, 0], { size: 18 }); sub.add(l, lab(c + 'c', [x, -0.5, 2.0], { size: 19 })); if (dpg) sub.add(lab('DPG ' + dpg.toFixed(2), [x, -1.5, 2.8], { size: 15 })); bars.push({ b, l, h: (ps - 20) / 11 * 7.2 }); });
        sub.add(lab('PS-VAE 通道消融 · 柱高 = PSNR（从 20 dB 起）', [0, 9.3, 0], { size: 22, border: 'rgba(56,209,255,.7)' })); }
      else { SZ.forEach(([nm, n, c], i) => { const x = (i - 2.5) * 4.2, b = block(2.0, 1, 2.0, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(n.toLocaleString('en-US'), [x, 0, 0], { size: 18 }); sub.add(l, lab(nm, [x, -0.5, 2.2], { size: 17 })); bars.push({ b, l, h: Math.log2(n / 2048) / Math.log2(196608 / 2048) * 7.2 }); });
        sub.add(lab('每张图的隐变量里有多少个数（对数高度）', [0, 9.3, 0], { size: 22, border: 'rgba(56,209,255,.7)' })); }
    }
    rebuild();
    const ctls = [{ label: '视图', items: ['通道消融', '每张图的数'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      if (last !== v) rebuild(); const g = seg(p, 0, 0.5);
      bars.forEach(({ b, l, h }) => { const hh = Math.max(0.02, h * g); b.scale.y = hh; b.position.y = hh / 2; l.position.y = hh + 0.45; });
      cap(v === 0 ? '重建到 <b>112c</b> 饱和（256c 不再变好）；DPG-Bench 在 112c 掉到 83.03，作者选 <b>96c</b>' : 'RAE 的隐变量和像素一样多（<b>196,608</b>）；PS-VAE 96c 是 1/8，仍是 MAR-VAE 的 6 倍');
    } };
  }

  /* ---------- scene 9: sequences, masks, and the shift rule ---------- */
  function s9(G) {
    let task = +(OPT[0] ?? 0), sp = +(OPT[1] ?? 3); const sub = new THREE.Group(); G.add(sub); let last = -1;
    const SP = [['Flux-VAE', 16, 2], ['MAR-VAE', 16, 1], ['32c / VAVAE', 32, 1], ['PS-VAE 96c', 96, 1], ['RAE 768', 768, 1]];
    const XP = 3.8, WP = 7.0, YP = 1.0, HP = 6.0; panel(G, XP - 0.3, YP - 0.3, -0.3, WP + 0.6, HP + 0.6);
    G.add(lab('t → t′ = s·t / (1 + (s − 1)·t)', [XP + WP / 2, YP + HP + 0.7, 0], { size: 18 }));
    const N = 64, rc = ribbon(G, N, COL.lat, 0.08, { order: 3 }), rd = ribbon(G, N, COL.white, 0.03, { order: 2, opacity: 0.6 }), mk = L.sphere(0.16, COL.pix); G.add(mk);
    rd.userData.set(Array.from({ length: N }, (_, i) => [XP + WP * i / (N - 1), YP + HP * i / (N - 1), 0.02]));
    let cells = null;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); last = task * 10 + 0;
      const seq = task === 0 ? [['T', 5], ['N', 8]] : [['C', 6], ['T', 4], ['N', 6]]; const types = []; seq.forEach(([k, n]) => { for (let i = 0; i < n; i++) types.push(k); });
      const n = types.length, cs = 0.42, x0 = -10.0, y0 = 1.0, colr = { T: COL.text, N: COL.noise, C: COL.lat };
      types.forEach((k, i) => { const b = block(0.34, 0.34, 0.34, colr[k], [x0 + i * cs, y0 + n * cs + 0.6, 0]); sub.add(b); });
      cells = inst(BOX, n * n); sub.add(cells);
      const vis = (i, j) => { const a = types[i], b = types[j]; if (a === 'T') return b === 'T' ? j <= i : (task === 1 && b === 'C'); return true; };
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { setI(cells, i * n + j, [x0 + j * cs, y0 + (n - 1 - i) * cs, 0], [cs * 0.88, cs * 0.88, 0.08]); colI(cells, i * n + j, vis(i, j) ? hex3(colr[types[i]]) : [0.12, 0.14, 0.2]); }
      done(cells);
      const leg = task === 0 ? '紫 文本（因果）  灰 带噪隐变量（全注意力）' : '黄 原图干净隐变量  紫 指令（因果）  灰 带噪隐变量';
      sub.add(lab(leg, [x0 + n * cs / 2, y0 + n * cs + 1.6, 0], { size: 17 }), lab('注意力掩码（行看列）', [x0 + n * cs / 2, y0 - 0.7, 0], { size: 17 }));
    }
    rebuild();
    const ctls = [{ label: '任务', items: ['文生图', '编辑'], get: () => task, set: k => { task = k; } }, { label: '空间', items: SP.map(s => s[0]), get: () => sp, set: k => { sp = k; } }];
    return { ctls, update(p) {
      if (last !== task * 10) rebuild();
      const [nm, C, P] = SP[sp], s = Math.sqrt(C * P * P / 16), f = t => s * t / (1 + (s - 1) * t);
      rc.userData.set(Array.from({ length: N }, (_, i) => { const t = i / (N - 1); return [XP + WP * t, YP + HP * f(t), 0.05]; }));
      const t = clamp(p, 0, 1); mk.position.set(XP + WP * t, YP + HP * f(t), 0.1);
      cap(`${nm}：C = ${C}，P = ${P} → s = <b>${s.toFixed(3)}</b> · t = ${t.toFixed(2)} → t′ = <b>${f(t).toFixed(2)}</b>（推理统一用 shift 3）`);
    } };
  }

  /* ---------- scene 10: comparison bars ---------- */
  function s10(G) {
    let m = +(OPT[0] ?? 0); G.add(L.grid(36, 36)); const sub = new THREE.Group(); G.add(sub); let bars = [], last = -1;
    const R = [['Flux-VAE', COL.pix, 68.04, 78.98, -0.271], ['MAR-VAE', COL.frozen, 75.75, 83.19, 0.056], ['VAVAE', COL.dec, 76.16, 82.45, 0.227], ['RAE', COL.enc, 71.27, 81.72, 0.059], ['S-VAE*', COL.sem, 73.7, 83.6, 0.12], ['P-VAE*', COL.noise, 75.2, 82.1, 0.04], ['PS-VAE 32c', COL.lat, 76.22, 84.25, 0.274], ['PS-VAE 96c', COL.lat, 76.56, 83.62, 0.222]];
    const MT = [['GenEval', 2, v => (v - 60) / 20 * 7, v => v.toFixed(2)], ['DPG-Bench', 3, v => (v - 76) / 10 * 7, v => v.toFixed(2)], ['Editing Reward', 4, v => (v + 0.35) / 0.7 * 7, v => v.toFixed(3)]];
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = m; const M = MT[m];
      R.forEach((r, i) => { const x = (i - 3.5) * 3.4, b = block(1.6, 1, 1.6, r[1], [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(M[3](r[M[1]]), [x, 0, 0], { size: 18 }); sub.add(l, lab(r[0], [x, -0.5, 2.1], { size: 17 })); bars.push({ b, l, h: Math.max(0.05, M[2](r[M[1]])) }); });
      sub.add(lab(M[0] + '（柱高从 ' + ['60', '76', '−0.35'][m] + ' 起）· * 来自表 4', [0, 9.2, 0], { size: 22, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const ctls = [{ label: '指标', items: ['GenEval', 'DPG-Bench', '编辑'], get: () => m, set: k => { m = k; } }];
    const MSG = ['只有语义的 RAE <b>71.27</b>；只压缩的 S-VAE 73.7；加像素细节的 PS-VAE 96c <b>76.56</b>', '有语义结构的空间 DPG 高：S-VAE 83.6，PS-VAE 32c <b>84.25</b>', '只为像素训练的空间编辑分数低：Flux-VAE <b>−0.271</b>，P-VAE 0.04；PS-VAE 32c <b>0.274</b>'];
    return { ctls, update(p) {
      if (last !== m) rebuild(); const g = seg(p, 0, 0.5);
      bars.forEach(({ b, l, h }) => { const hh = Math.max(0.02, h * g); b.scale.y = hh; b.position.y = hh / 2; l.position.y = hh + 0.45; });
      cap(MSG[m]);
    } };
  }

  /* ---------- scene 11: the OpenWAM variant ---------- */
  function s11(G) {
    let e = +(OPT[0] ?? 1);
    const ENC = [['DINOv3 ViT-B/16', 768, '33.2M', '16'], ['V-JEPA 2.1 ViT-g', 1408, '82.5M', '29.3']];
    const Y = 8.8, X = [-15, -10, -5, 0, 5, 10, 15], up = i => (i % 2 ? -1.5 : 1.5), nodes = [['视频 9 帧\n384 × 320', COL.noise], ['', COL.frozen], ['', COL.enc], ['S-VAE 编码\n3 块 → μ（冻结）', COL.sem], ['48 × 3 × 24 × 20', COL.lat], ['LayerNorm\n→ Conv3d 1×2×2', COL.dit], ['DiT（宽 3072）\n每 token 192 维', COL.dit]];
    const B = nodes.map(([t, c], i) => { const b = block(2.4, 1.1, 1.2, c, [X[i], Y, 0]); G.add(b); if (t) G.add(lab(t, [X[i], Y + up(i), 0], { size: 18 })); return b; });
    const dyn = { s: [], k: -1 }, fl = stream(G, 16, COL.lat, 0.11), path = [[-15, Y, 0.8], [15, Y, 0.8]];
    G.add(lab('没有像素解码器；S-VAE 解码器只在训练 S-VAE 时用', [0, Y + 3.0, 0], { size: 17, border: 'rgba(240,150,60,.6)' }));
    const SC = [['DINOv3', 76.42, COL.enc], ['V-JEPA 2.1', 80.91, COL.enc], ['FLUX.2-VAE', 84.26, COL.pix], ['V-JEPA 2.1\n+ S-VAE', 88.46, COL.lat], ['DINOv3\n+ S-VAE', 90.18, COL.lat], ['Wan2.2-VAE', 90.30, COL.pix]];
    const bars = SC.map(([nm, v, c], i) => { const x = (i - 2.5) * 4.6, b = bar(G, x, 2.4, 1.5, c), l = lab(v.toFixed(2), [x, 1, 2.4], { size: 17 }); G.add(l, lab(nm, [x, -0.5, 4.3], { size: 16 })); return { b, l, v }; });
    G.add(lab('OpenWAM 图 7 · RoboTwin 平均成功率（%，柱高从 70 起）', [0, 5.4, 2.4], { size: 18 }));
    const ctls = [{ label: '编码器', items: ['DINOv3', 'V-JEPA 2.1'], get: () => e, set: k => { e = k; } }];
    return { ctls, update(p) {
      if (dyn.k !== e) { dyn.s.forEach(s => { G.remove(s); LABS = LABS.filter(x => x !== s); }); const [nm, D] = ENC[e]; dyn.s = [lab(nm + '\n冻结', [-10, Y - 1.5, 0], { size: 18 }), lab(D + ' × 3 × 24 × 20\n每帧 480 token', [-5, Y + 1.5, 0], { size: 18 })]; dyn.s.forEach(s => G.add(s)); dyn.k = e; }
      const q = (p * 3) % 1; fl(path, q, 1); B.forEach((b, i) => glow(b, Math.abs(i - q * 7) < 0.7 ? 0.45 : 0.05));
      const g = seg(p, 0.1, 0.6); bars.forEach(({ b, l, v }) => { const h = Math.max(0.02, (v - 70) / 22 * 3.4 * g); b.userData.set(h); l.position.y = h + 0.45; });
      const [nm, D, par, cr] = ENC[e]; cap(`${nm}：${D} → <b>48</b> 维，压缩 ${cr} 倍（原论文 768 → 96 是 8 倍）· S-VAE 约 <b>${par}</b> 参数（按代码算）`);
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player (same as interactives/phc) ---------- */
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
  window.__svaeDebug = { vel, PS, X3, get cap() { return $('cap').textContent; } };
})();
