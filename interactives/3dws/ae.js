'use strict';
/* The particle-voxel autoencoder of arXiv 2611.04492, taken apart into nine animated scenes.
   Structure and numbers follow the official code (github.com/jwang771/3d-world-simulator, plug task).
   Every scene builds into its own group and exposes update(p), a pure function of the timeline p in [0,1],
   so pausing, scrubbing and looping are all the same call. The scene is a hand-made toy with cells 8x larger
   than the real ones; nothing here runs the model. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const lerp3 = (a, b, t) => [L.lerp(a[0], b[0], t), L.lerp(a[1], b[1], t), L.lerp(a[2], b[2], t)];
  const COL = { pts: 0x38d1ff, enc: 0x9d8cff, lat: 0x3aa8e0, dec: 0x4fc98a, gau: 0xf2c14e, loss: 0xff7a59, grey: 0x6b7794, red: 0xe05d5d };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

  /* ---------- text for each scene ---------- */
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const SCENES = [
    { n: 1, part: '编码器', title: '体素化', sub: '点落进格子，同格取平均', dur: 11, cam: [0.65, 1.08, 15, [0, 0, 0]],
      html: dl([['网络', '无参数（<code>SpconvEncoder.voxelize</code>）'], ['每个点', '6 个数：xyz（标准化后）+ RGB'], ['网格', '512 × 128 × 512，每格 1.1 × 1.7 × 0.7 mm'], ['输出', '非空格子清单：编号 + 6 维平均特征']]) +
        '<p>每个点用 ⌊(坐标 − 盒子起点) / 格宽⌋ 算出自己在哪一格。同一格里的点，6 个数分别求平均。平均出来的 xyz 是这几个点的重心，“点偏在格子哪个角”这个信息没有丢；平均 RGB 是这块表面的颜色。</p>' +
        '<p>没有点的格子什么都不存。工作空间里大部分是空气，有点的只是物体表面薄薄的一层“壳”，后面的稀疏卷积也只在这层壳上算。</p>' +
        guess('一格放大成了一个大方块，点也只画了一百个左右。') + src('§3.2 · 代码 <code>occupancy_vae.py</code> <code>voxelize()</code>') },
    { n: 2, part: '编码器', title: '子流形稀疏卷积', sub: '只在有东西的格子上算，形状不变', dur: 13, cam: [0.5, 1.0, 16, [0, -0.2, 0]],
      html: dl([['网络', '稀疏残差块：GN → SiLU → 3³ SubMConv → GN → SiLU → 3³ SubMConv，加残差'], ['每一级', '2 个这样的块，再接一次下采样（第 3 幕）'], ['卷积核', '3 × 3 × 3，每格看 27 个邻居']]) +
        '<p>卷积核以每个非空格子为中心，只看周围 27 格里同样非空的那些，加权求和后写回中心这一格。空邻居直接跳过，空格子上也不会产生新的输出。所以叫“子流形”：输出的非空格子和输入完全一样，表面这层壳的形状不变。</p>' +
        '<p>普通卷积不一样：只要 27 个邻居里有一个非空，中心格就会有输出。壳每过一层就向外胖一圈，几层以后就糊成一大块，既浪费计算，也把“表面在哪里”弄模糊了。动画后半段的红色方块就是普通卷积会多出来的格子。</p>' +
        '<p>这一步让每个格子的特征混进邻居的信息，比如“我是平面的一部分”还是“我在一条棱上”。</p>' +
        src('spconv <code>SubMConv3d</code>（Graham et al., 2018）· 代码 <code>SparseResBlock</code>') },
    { n: 3, part: '编码器', title: '步长 2 下采样', sub: '每级三个方向各减半，通道加宽', dur: 15, cam: [0.62, 0.95, 27, [1.8, 0.8, 0]],
      html: dl([['网络', '3³ 稀疏卷积，步长 2，padding 1（<code>SparseConv3d</code>）'], ['空间', '512×128×512 → 256×64×256 → 128×32×128 → 64×16×64'], ['通道', '16 → 16 → 32 → 64'], ['每格 X 宽', '1.1 → 2.3 → 4.5 → 9.1 mm']]) +
        '<p>每过一级，2 × 2 × 2 = 8 个小格合成 1 个大格，格子总数变成 1/8。三级之后，每个潜变量格子管着 8 × 8 × 8 = 512 个原始小格。</p>' +
        '<p>空间变小，通道变宽：一个大格要描述一整块区域里“有什么、什么形状”，需要更多数字。图像里的 ResNet、U-Net 编码器也是这样。</p>' +
        '<p>核是 3 而步长是 2，所以每个大格实际看的是 3 × 3 × 3 个小格，和相邻大格有一圈重叠，下采样后的非空格子会比“8 合 1”稍多。动画里的格子就是按这个规则算的。</p>' +
        guess('示意场景是 96 × 24 × 96 → 48 × 12 × 48 → 24 × 6 × 24 → 12 × 3 × 12，比真实网格小 8 倍。右边的小图只画了 8 合 1。') + src('§3.2 · 代码 <code>SparseResStage</code>') },
    { n: 4, part: '编码器', title: '潜变量 z', sub: '变稠密，压成 8 个数，再归一化', dur: 14, cam: [0.55, 1.22, 17, [-1.2, 4.2, 0.6]],
      html: dl([['输入', '64 × 16 × 64 · 64 通道（稀疏）'], ['跳连', '每格再拼 6 个数：落进这个大格的点直接求平均'], ['几何头', '三层 1×1 卷积 70 → 64 → 64 → 8，用前 4 个'], ['颜色头', '只看 RGB 的另一条稀疏编码器，输出 4 个'], ['输出', '64 × 16 × 64 × 8 = 524,288 个数']]) +
        '<p>先用 <code>.dense()</code> 变回普通的稠密张量，空格子的特征是 0。之后都是 1×1 卷积，每格单独算，不再和邻居混。</p>' +
        '<p>8 个通道分两组：4 个描述几何，4 个描述颜色。颜色分支初始化时就让前 3 个通道等于平均 RGB，所以训练一开始颜色就有个合理的起点。</p>' +
        '<p>最后两组各自除以自己的长度，变成长度为 1 的向量。我的理解是：这样潜变量的大小固定，动力学模型一步步往前推时，数值不会越滚越大。</p>' +
        '<p>编码器其实输出了均值和 log 方差两份（VAE 的写法），但训练只用均值，再加一点噪声，论文表 3 也写着 KL 正则“关闭”。所以它实际是普通自编码器，不是 VAE。</p>' +
        guess('4 维向量画不出来，图里用箭头和圆环表示“长度变成 1”。') + src('§3.2 · 表 3 · 代码 <code>SpconvEncoder.forward</code>、<code>build.py</code> <code>normalize_latent</code>') },
    { n: 5, part: '为什么', title: '为什么是自编码器', sub: '没有标签，目标就是输入自己', dur: 15, cam: [0, 1.28, 36, [0, -0.4, 0]],
      html: dl([['训练目标', '输出要和输入对得上'], ['瓶颈（论文）', '≤ 300,000 点 × 6 ≈ 180 万个数 → 32×16×32×8 = 131,072'], ['瓶颈（代码）', '≤ 673,000 点 × 6 ≈ 404 万个数 → 64×16×64×8 = 524,288'], ['一致性', '两份子采样 → 潜变量差的平方 × 100']]) +
        '<p>叫“编码器”和“解码器”，不是因为网络长什么样，而是因为怎么训练。数据只有点云和相机照片，没有任何人工标签。解码器只拿得到 z，却要重建出和输入一样的点、一样的照片。只有 z 记住了足够的场景信息，这个损失才能变小。训练完，前半段就是“压缩器”，后半段就是“解压器”。</p>' +
        '<p>瓶颈比输入小很多，网络就不能原样抄一遍，只能学“这个场景的结构”。z 还是一个 3D 网格，每格只描述自己那一小块空间，所以“插头往左移了 1 cm”在 z 里也只是局部几格在变。这正是第二个网络（动力学模型）需要的。</p>' +
        '<p>一致性损失管另一件事：同一个场景，抽一半点和抽全部点，得到的 z 应该一样。否则 z 会记住“这次碰巧抽到了哪些点”这种噪声，动力学模型就得去预测噪声。</p>' +
        src('§3.2 式 (7) · 表 3 · 代码 <code>train_vae.py</code> <code>step()</code>') },
    { n: 6, part: '解码器', title: '体素解码器', sub: '粗到细：先猜哪里有东西', dur: 14, cam: [0.62, 0.95, 27, [1.8, 0.8, 0]],
      html: dl([['前置', '三层 3³ 卷积 8 → 64 → 64 → 128'], ['第 0 级', '64 × 16 × 64，预测 3 张占据图：场景 / 机器人 / 物体'], ['第 1 级', '×2 上采样到 128 × 32 × 128，再预测一次'], ['颜色', '最细一级每格 RGB'], ['损失', '每级 BCE（正样本加权，最多 20 倍）+ 颜色 ℓ1；物体和夹爪区域再加权']]) +
        '<p>解码器先回答最容易的问题：哪些格子有东西。先在粗网格上猜，再放大 2 倍细化。每一级都用真实点云算出的占据（这格里有没有点）做二分类监督。这就是“粗到细”。</p>' +
        '<p>最细一级每格 4.5 × 6.7 × 3.0 mm。把占据格的中心当成点，已经是一份能用的点云了，但它是“台阶状”的：所有点都钉在格子中心，比真实表面粗糙，也没法拿去渲染照片。所以后面还需要粒子头。</p>' +
        '<p>3 张占据图分别是场景、机器人和物体（布、绳等）。粒子头的种子就按这个分类，物体区域的损失权重更高。</p>' +
        guess('代码里第 1 级是对整张网格稠密计算的，不只在第 0 级的占据格里算。图里只画占据格的子格，是为了看清“粗到细”。概率是我摆的。') + src('§3.2 · 附录 B.1 式 (2) · 代码 <code>LocalHierarchicalOccupancyDecoder</code>、<code>losses.py</code>') },
    { n: 7, part: '解码器', title: '粒子头', sub: '每个占据格放 16 个 3D 高斯', dur: 15, cam: [0.14, 1.12, 17, [3.3, 0.2, 0]],
      html: dl([['种子', '最细一级判为占据的格子，每帧最多 10 万个'], ['输入', '种子周围 3 × 3 × 3 格的 64 通道特征，拉平成 1728 个数'], ['网络', 'LayerNorm + 4 层 MLP：1728 → 1024 → 1024 → 1024 → 224'], ['输出', '16 个孩子 × 14 个数'], ['每个孩子', '位移 3 + 尺度 3 + 旋转 4 + 不透明度 1 + 颜色 3']]) +
        '<p>粒子头补的是体素的两个缺点。<b>第一，位置不连续。</b>每个孩子在格子里有一个学出来的固定起点（<code>child_init</code>，±0.4 格），MLP 再预测最多 ±0.5 格的位移，所以孩子可以落在格子里任何地方，甚至稍微伸出格子，贴到真实表面上。</p>' +
        '<p><b>第二，不能渲染。</b>每个孩子不只是一个点，而是一个 3D 高斯：有尺度（初始 1.5 mm，最大 2 cm，三个方向可以不同，所以能压成扁片贴在表面上）、旋转、不透明度和颜色。这就是 3D Gaussian Splatting 用的表示，能从任意相机位置渲染成照片。</p>' +
        '<p>为什么看 3 × 3 × 3 邻域，而不是只看自己？表面朝哪个方向、是不是边缘，只有看了邻居才知道。MLP 最后一层初始化为 0，所以刚开始训练时，16 个孩子都待在各自的起点。</p>' +
        '<p>一帧 10 万个种子 × 16 = 160 万个高斯。动力学模型不碰这些高斯，只在潜变量上工作。高斯只在需要输出点云和照片时才算。</p>' +
        guess('孩子的最终位置和形状是我摆的。') + src('§3.2 · 表 3 · 代码 <code>big_head.py</code> <code>BigHead</code>、<code>_children</code>') },
    { n: 8, part: '训练', title: '粒子怎么学：Chamfer', sub: '粒子和真实点互相找最近', dur: 14, cam: [0.5, 1.05, 12, [0, 0, 0]],
      html: dl([['范围', '每个种子只和自己邻域里的真实点比'], ['正向', '每个预测粒子 → 最近的真实点，距离平方取平均'], ['反向', '每个真实点 → 最近的预测粒子，距离平方取平均'], ['颜色', '真实点分给最近的粒子，平均颜色当这个粒子的目标（ℓ1）']]) +
        '<p>16 个预测粒子和格子里的真实点数量不一样，也没有一一对应关系，没法逐个相减。Chamfer 距离两个方向都找最近的：</p>' +
        '<ul><li><b>正向（金线）</b>：每个粒子都要贴近某个真实点，不能飘在空中。</li><li><b>反向（青线）</b>：每个真实点附近都要有粒子，表面不能缺一块。</li></ul>' +
        '<p>训练就是把两种线都拉短，粒子就铺满了真实表面。画面上方的数字是这一格当前的两项 Chamfer 值（以格宽² 为单位），中段粒子移动时可以看到它们变小。</p>' +
        guess('真实的邻域是 3 × 3 × 3 格，图里只画了中心格附近的点，线才看得清。') + src('附录 B.1 式 (3)(4) · 代码 <code>seed_upsample.py</code> <code>local_chamfer_loss</code>') },
    { n: 9, part: '训练', title: '粒子怎么学：渲染', sub: '从相机看过去，和真照片比', dur: 16, cam: [0.95, 0.92, 34, [-0.5, 1.6, 1.5]],
      html: dl([['渲染', '3D 高斯光栅化（gsplat），用训练相机的内外参'], ['损失（论文）', '4 × ℓ1 + 0.5 × (1 − SSIM)/2 + LPIPS，深度 ℓ1'], ['背景', '工作空间外用一组从数据初始化的静态背景高斯'], ['训练顺序', '先训体素部分 10 epoch → 冻结它训粒子头 10 epoch → 一起训']]) +
        '<p>Chamfer 只管位置，不管“看起来对不对”。高斯的大小、朝向、透明度决定了渲染出来的照片是什么样。于是把所有高斯（再加上静态背景）从每台训练相机的位置渲染一张 RGB 和一张深度，和这台相机真实拍到的图比。误差经可微渲染器传回粒子头和解码器。</p>' +
        '<p>输出是 3D 高斯，而不是某个固定视角的图片，所以训练时没见过的相机位置（比如跟着机械臂动的腕部相机）也能渲染。右上角两张小图是画面里那台小相机“看到”的结果，相机转动时，是同一组高斯换了个角度。</p>' +
        guess('小图是我用简单的圆点投影画的，不是真正的高斯光栅化。') + src('§3.2 · 附录 B.1 式 (5)(6) · 代码 <code>gsplat_render_loss.py</code>、<code>background_bank.py</code>') }
  ];

  /* ---------- list, buttons, panel (work without WebGL) ---------- */
  const stepsEl = $('steps'), btns = $('sceneBtns');
  SCENES.forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" data-i="${i}"><span class="k">${s.n} · ${s.part}</span>${s.title}<small>${s.sub}</small></button>`;
    stepsEl.appendChild(li);
    const b = document.createElement('button'); b.type = 'button'; b.dataset.i = i; b.textContent = s.n; b.title = s.title; b.setAttribute('aria-pressed', 'false'); btns.appendChild(b);
  });
  function showInfo(i) {
    const s = SCENES[i];
    $('infoTag').textContent = `第 ${s.n} 幕 · ${s.part}`;
    $('infoTitle').textContent = s.title;
    $('infoBody').innerHTML = s.html;
    $('stepNo').textContent = `${s.n} / ${SCENES.length}`;
    stepsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(+b.dataset.i === i)));
    btns.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
    $('renders').hidden = s.n !== 9;
  }
  let lastCap = null;
  const cap = h => { if (h !== lastCap) { lastCap = h; $('cap').innerHTML = h; } };

  /* ---------- 3D ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.6, phi: 1.0, dist: 20, maxDist: 120, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);

  /* labels keep a near-constant size on screen: base size follows the scene's camera distance, then the zoom */
  let LABS = [], refDist = 20;
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: o.size || 26, pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 14, 10);
  function inst(geo, n, o = {}) {
    const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65, emissive: o.emissive });
    if (o.fade) { m.transparent = true; m.depthWrite = false; }
    const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im;
  }
  function setI(im, n, p, s, q) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, q || _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function gridLines(n, s, o, color, op) {
    const v = [], [nx, ny, nz] = n;
    for (let j = 0; j <= ny; j++) for (let k = 0; k <= nz; k++) v.push(o[0], o[1] + j * s, o[2] + k * s, o[0] + nx * s, o[1] + j * s, o[2] + k * s);
    for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) v.push(o[0] + i * s, o[1], o[2] + k * s, o[0] + i * s, o[1] + ny * s, o[2] + k * s);
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) v.push(o[0] + i * s, o[1] + j * s, o[2], o[0] + i * s, o[1] + j * s, o[2] + nz * s);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op }));
  }
  function wireBox(w, h, d, color, opacity = 0.6, dashed = false) {
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
    const m = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const l = new THREE.LineSegments(geo, m); if (dashed) l.computeLineDistances(); return l;
  }
  function segLines(n, color, op = 0.8) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, vertexColors: false })); l.frustumCulled = false; return l;
  }
  function setSeg(l, k, a, b) { const A = l.geometry.attributes.position.array; A.set(a, k * 6); A.set(b, k * 6 + 3); }
  function points(list, size, o = {}) {
    const pos = new Float32Array(list.length * 3), col = new Float32Array(list.length * 3);
    list.forEach((q, n) => { pos.set(q.p, n * 3); col.set(q.c, n * 3); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity: o.opacity ?? 1, sizeAttenuation: true, depthWrite: o.depthWrite ?? true }));
  }

  /* ---------- the toy scene: table, blue socket, orange plug held by a grey gripper ---------- */
  let TOY = null;
  function toy() {
    if (TOY) return TOY;
    const r = L.rng(7), g = () => L.gauss(r), P = [];
    const B = { x0: -6, y0: 0, z0: -6 };
    const add = (x, y, z, c) => { if (x > -6 && x < 6 && y > 0 && y < 3 && z > -6 && z < 6) P.push({ p: [x, y, z], c: c.map(v => clamp(v + 0.035 * g(), 0, 1)) }); };
    for (let i = 0; i < 26000; i++) { const x = -6 + r() * 12, z = -6 + r() * 12, w = 0.5 + 0.06 * Math.sin(x * 2.1) + 0.04 * Math.sin(z * 5.3); add(x, 0.06 + 0.01 * g(), z, [w + 0.1, w - 0.02, w - 0.14]); }
    function boxS(c, s, n, col, skipBottom = true, hole = 0) {
      const A = [s[1] * s[2], s[1] * s[2], s[0] * s[2], s[0] * s[2], s[0] * s[1], s[0] * s[1]]; if (skipBottom) A[2] = 0;
      const tot = A.reduce((a, b) => a + b);
      for (let i = 0; i < n; i++) {
        let u = r() * tot, f = 0; while (u > A[f]) { u -= A[f]; f++; }
        const a = r() - 0.5, b = r() - 0.5; let x, y, z;
        if (f < 2) { x = (f ? 0.5 : -0.5) * s[0]; y = a * s[1]; z = b * s[2]; } else if (f < 4) { y = (f === 3 ? 0.5 : -0.5) * s[1]; x = a * s[0]; z = b * s[2]; } else { z = (f === 5 ? 0.5 : -0.5) * s[2]; x = a * s[0]; y = b * s[1]; }
        if (hole && f === 3 && Math.hypot(x, z) < hole) continue;
        add(c[0] + x, c[1] + y, c[2] + z, col);
      }
    }
    boxS([1.9, 0.8, -1.3], [3.0, 1.6, 2.4], 15000, [0.24, 0.45, 0.88], true, 0.62);
    for (let i = 0; i < 2600; i++) { const th = r() * 6.283; add(1.9 + 0.62 * Math.cos(th), 1.6 - r() * 0.7, -1.3 + 0.62 * Math.sin(th), [0.12, 0.22, 0.45]); }
    for (let i = 0; i < 8000; i++) { const th = r() * 6.283, cap = r() < 0.22; const rad = cap ? 0.5 * Math.sqrt(r()) : 0.5; const y = cap ? (r() < 0.5 ? 1.0 : 2.3) : 1.0 + r() * 1.3; add(-1.6 + rad * Math.cos(th), y, 1.5 + rad * Math.sin(th), [0.96, 0.62, 0.18]); }
    boxS([-2.24, 2.2, 1.5], [0.24, 1.2, 0.8], 2400, [0.55, 0.58, 0.66], false);
    boxS([-0.96, 2.2, 1.5], [0.24, 1.2, 0.8], 2400, [0.55, 0.58, 0.66], false);
    boxS([-1.6, 2.86, 1.5], [1.7, 0.24, 0.9], 3000, [0.42, 0.45, 0.52], false);
    const key = (i, j, k) => i + ',' + j + ',' + k;
    function bin(s) {
      const m = new Map();
      for (const q of P) {
        const i = Math.floor((q.p[0] - B.x0) / s), j = Math.floor((q.p[1] - B.y0) / s), k = Math.floor((q.p[2] - B.z0) / s), kk = key(i, j, k);
        let c = m.get(kk); if (!c) { c = { i, j, k, n: 0, col: [0, 0, 0] }; m.set(kk, c); }
        c.n++; c.col[0] += q.c[0]; c.col[1] += q.c[1]; c.col[2] += q.c[2];
      }
      for (const c of m.values()) { c.col = c.col.map(v => v / c.n); c.ctr = [B.x0 + (c.i + 0.5) * s, B.y0 + (c.j + 0.5) * s, B.z0 + (c.k + 0.5) * s]; }
      return m;
    }
    /* encoder levels: 3³ stride-2 sparse conv activates parent j whenever any child in 2j-1..2j+1 is active */
    const lv = [{ s: 0.125, dims: [96, 24, 96], cells: bin(0.125) }];
    const par = v => (v % 2 === 0 ? [v / 2] : [(v - 1) / 2, (v + 1) / 2]);
    for (let l = 1; l < 4; l++) {
      const pv = lv[l - 1], s = pv.s * 2, dims = pv.dims.map(v => v / 2), m = new Map();
      for (const c of pv.cells.values()) {
        c.par = [Math.floor(c.i / 2), Math.floor(c.j / 2), Math.floor(c.k / 2)];
        for (const a of par(c.i)) for (const b of par(c.j)) for (const d of par(c.k)) {
          if (a >= dims[0] || b >= dims[1] || d >= dims[2]) continue;
          const kk = key(a, b, d); let e = m.get(kk); if (!e) { e = { i: a, j: b, k: d, n: 0, col: [0, 0, 0] }; m.set(kk, e); }
          e.n++; for (let t = 0; t < 3; t++) e.col[t] += c.col[t];
        }
      }
      for (const e of m.values()) { e.col = e.col.map(v => v / e.n); e.ctr = [B.x0 + (e.i + 0.5) * s, B.y0 + (e.j + 0.5) * s, B.z0 + (e.k + 0.5) * s]; }
      lv.push({ s, dims, cells: m });
    }
    lv.forEach(x => { x.list = [...x.cells.values()]; });
    TOY = { P, B, lv, key, D0: bin(1.0), D1: bin(0.5) };
    return TOY;
  }
  const ctrAt = (s, ijk) => [-6 + (ijk[0] + 0.5) * s, (ijk[1] + 0.5) * s, -6 + (ijk[2] + 0.5) * s];

  /* ---------- scene 1: voxelization ---------- */
  function s1(G) {
    const n = [4, 3, 4], s = 1.5, o = [-n[0] * s / 2, -n[1] * s / 2, -n[2] * s / 2];
    const r = L.rng(3), g = () => L.gauss(r);
    const f = (x, z) => 0.22 * x - 0.12 * z + 0.5 * Math.sin(0.8 * x + 0.3) - 0.15;
    const pts = [];
    for (let t = 0; t < 130 && pts.length < 110; t++) {
      const x = o[0] + 0.05 + r() * (n[0] * s - 0.1), z = o[2] + 0.05 + r() * (n[2] * s - 0.1), y = f(x, z) + 0.05 * g();
      if (y <= o[1] + 0.02 || y >= -o[1] - 0.02) continue;
      const w = clamp((x - o[0]) / (n[0] * s), 0, 1);
      pts.push({ p: [x, y, z], c: [clamp(0.96 - 0.12 * w + 0.04 * g(), 0, 1), clamp(0.62 - 0.36 * w + 0.04 * g(), 0, 1), clamp(0.2 + 0.05 * g(), 0, 1)] });
    }
    const cells = new Map();
    pts.forEach(q => {
      const i = Math.floor((q.p[0] - o[0]) / s), j = Math.floor((q.p[1] - o[1]) / s), k = Math.floor((q.p[2] - o[2]) / s), kk = i + ',' + j + ',' + k;
      let c = cells.get(kk); if (!c) { c = { i, j, k, n: 0, sum: [0, 0, 0], col: [0, 0, 0] }; cells.set(kk, c); }
      c.n++; for (let a = 0; a < 3; a++) { c.sum[a] += q.p[a]; c.col[a] += q.c[a]; } q.cell = c;
    });
    const CL = [...cells.values()];
    CL.forEach(c => { c.cen = c.sum.map(v => v / c.n); c.mc = c.col.map(v => v / c.n); c.ctr = [o[0] + (c.i + 0.5) * s, o[1] + (c.j + 0.5) * s, o[2] + (c.k + 0.5) * s]; });
    const grid = gridLines(n, s, o, 0x8e9bb8, 0); G.add(grid);
    const fill = inst(BOX, CL.length, { fade: true, opacity: 0.2 }); CL.forEach((c, m) => { setI(fill, m, c.ctr, s * 0.97); colI(fill, m, c.mc); }); done(fill); G.add(fill);
    const P = inst(BALL, pts.length); pts.forEach((q, m) => colI(P, m, q.c)); G.add(P);
    const Cn = inst(BALL, CL.length); CL.forEach((c, m) => colI(Cn, m, c.mc)); G.add(Cn);
    const best = CL.reduce((a, b) => (b.n > a.n ? b : a));
    const hl = wireBox(s, s, s, COL.gau, 0.95); hl.position.set(...best.ctr); G.add(hl);
    let emp = null;
    for (let i = n[0] - 1; i >= 0 && !emp; i--) for (let k = 0; k < n[2] && !emp; k++) if (!cells.has(i + ',2,' + k)) emp = [o[0] + (i + 0.5) * s, o[1] + 2.5 * s, o[2] + (k + 0.5) * s];
    const ehl = wireBox(s, s, s, 0x8e9bb8, 0.7, true); if (emp) { ehl.position.set(...emp); G.add(ehl); }
    const fr = best.cen.map((v, a) => (v - (o[a] + [best.i, best.j, best.k][a] * s)) / s);
    const rgb = best.mc.map(v => Math.round(clamp(v, 0, 1) * 255));
    const top = [best.ctr[0], best.ctr[1] + s * 1.35, best.ctr[2]];
    const lb1 = lab(`这一格有 ${best.n} 个点 → 只留 1 个 6 维特征\n重心在格内 (${fr.map(v => v.toFixed(2)).join(', ')}) 处\n平均颜色 RGB(${rgb.join(', ')})`, top, { border: 'rgba(242,193,78,.7)' }); G.add(lb1);
    const lb3 = lab(`这一格的编号 (i, j, k) = (${best.i}, ${best.j}, ${best.k})`, top, { border: 'rgba(242,193,78,.7)' }); G.add(lb3);
    const lb2 = lab('空格子：什么都不存', emp ? [emp[0], emp[1] + s * 0.9, emp[2]] : [0, 3, 0], { color: '#b9c4da', size: 24 }); G.add(lb2);
    return { update(p) {
      const a = seg(p, 0, 0.14), b = seg(p, 0.15, 0.27), c = seg(p, 0.3, 0.42), q = seg(p, 0.5, 0.7), e = seg(p, 0.64, 0.76);
      grid.material.opacity = 0.42 * b;
      fill.visible = c > 0; fill.material.opacity = 0.22 * c;
      pts.forEach((pt, m) => {
        const drop = (1 - a) * (1.6 + 1.4 * ((m * 37) % 10) / 10), cen = pt.cell.cen;
        setI(P, m, [L.lerp(pt.p[0], cen[0], q), L.lerp(pt.p[1] + drop, cen[1], q), L.lerp(pt.p[2], cen[2], q)], 0.075 * clamp(a * 1.6, 0, 1) * (1 - 0.75 * q));
        colI(P, m, lerp3(pt.c, pt.cell.mc, q));
      }); done(P);
      CL.forEach((c, m) => setI(Cn, m, c.cen, 0.16 * e)); done(Cn);
      hl.visible = p > 0.3; hl.material.opacity = 0.95 * c;
      ehl.visible = p > 0.82;
      lb3.visible = p > 0.32 && p < 0.5; lb1.visible = p > 0.74; lb2.visible = p > 0.82;
      cap(p < 0.15 ? '① 相机得到的点云：每个点带 xyz 和 RGB 共 6 个数'
        : p < 0.3 ? '② 把工作空间切成格子（真实网格 512 × 128 × 512）'
        : p < 0.5 ? '③ 每个点算出自己落在哪一格：<b>⌊(坐标 − 起点) / 格宽⌋</b>'
        : p < 0.74 ? '④ 同一格里的点，6 个数分别<b>求平均</b>'
        : '⑤ 每个非空格子只剩 1 个 6 维特征；空格子不存');
    } };
  }

  /* ---------- scene 2: submanifold sparse conv vs ordinary conv ---------- */
  function s2(G) {
    const n = [9, 5, 9], s = 0.8, o = [-n[0] * s / 2, -n[1] * s / 2, -n[2] * s / 2];
    const key = (i, j, k) => i + ',' + j + ',' + k, ctr = (i, j, k) => [o[0] + (i + 0.5) * s, o[1] + (j + 0.5) * s, o[2] + (k + 0.5) * s];
    const hgt = (i, k) => Math.round(2 + 1.4 * Math.sin(0.75 * i) * Math.cos(0.42 * k));
    const O = new Map();
    for (let i = 0; i < n[0]; i++) for (let k = 0; k < n[2]; k++) {
      const h = hgt(i, k); let lo = h, hi = h;
      for (const [a, b] of [[i + 1, k], [i, k + 1]]) if (a < n[0] && b < n[2]) { const h2 = hgt(a, b); if (h2 > h + 1) hi = Math.max(hi, h2 - 1); if (h2 < h - 1) lo = Math.min(lo, h2 + 1); }
      for (let j = lo; j <= hi; j++) O.set(key(i, j, k), [i, j, k]);
    }
    const OL = [...O.values()];
    const occ = inst(BOX, OL.length); OL.forEach((c, m) => { setI(occ, m, ctr(...c), s * 0.9); const t = c[1] / 4; colI(occ, m, [0.5 + 0.15 * t, 0.46 + 0.1 * t, 0.9]); }); done(occ); G.add(occ);
    const Dl = new Map();
    for (const [i, j, k] of OL) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) {
      const x = i + a, y = j + b, z = k + d; if (x < 0 || y < 0 || z < 0 || x >= n[0] || y >= n[1] || z >= n[2]) continue;
      const kk = key(x, y, z); if (!O.has(kk)) Dl.set(kk, [x, y, z]);
    }
    const DL = [...Dl.values()];
    const ghost = inst(BOX, DL.length, { fade: true, opacity: 0.38 }); DL.forEach((c, m) => colI(ghost, m, hex3(COL.red))); G.add(ghost);
    const stops = []; for (let i = 1; i <= 7; i++) stops.push([i, hgt(i, 4), 4]);
    const kern = wireBox(3 * s, 3 * s, 3 * s, COL.gau, 0.9); G.add(kern);
    const hi = inst(BOX, 27, { emissive: 0x2a1f66 }); for (let m = 0; m < 27; m++) colI(hi, m, [0.75, 0.68, 1]); G.add(hi);
    const ln = segLines(27, COL.gau, 0.9); G.add(ln);
    const out = new THREE.Mesh(BOX, L.mat(COL.gau, { emissive: 0x4a3200 })); G.add(out);
    const visited = inst(BOX, stops.length); stops.forEach((c, m) => colI(visited, m, hex3(COL.gau))); G.add(visited);
    const edots = inst(BALL, 27); for (let m = 0; m < 27; m++) colI(edots, m, [0.55, 0.6, 0.7]); G.add(edots);
    const lbK = lab('3 × 3 × 3 的核：只把非空邻居加起来', [0, 2.9, 0], { border: 'rgba(242,193,78,.7)' }); G.add(lbK);
    const lbD = lab(`普通卷积：非空格子 ${OL.length} → ${OL.length + DL.length}\n子流形卷积：还是 ${OL.length}`, [0, 3.0, 0], { border: 'rgba(224,93,93,.8)' }); G.add(lbD);
    return { update(p) {
      const N = stops.length, kp = clamp((p - 0.04) / 0.58, 0, 1) * (N - 1), idx = Math.min(N - 2, Math.floor(kp)), fr = kp - idx;
      const mv = clamp((fr - 0.55) / 0.45, 0, 1), atEnd = kp >= N - 1;
      const cur = atEnd ? stops[N - 1] : stops[idx], nxt = stops[Math.min(N - 1, idx + 1)];
      const kpos = atEnd ? ctr(...cur) : lerp3(ctr(...cur), ctr(...nxt), L.ease(mv));
      const dwell = p < 0.64 && (atEnd || mv === 0);
      const inK = p < 0.64;
      kern.visible = inK; kern.position.set(...kpos);
      let h = 0, e = 0;
      if (dwell) {
        const [ci, cj, ck] = cur, c0 = ctr(ci, cj, ck);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) {
          const kk = key(ci + a, cj + b, ck + d), pc = ctr(ci + a, cj + b, ck + d);
          if (O.has(kk)) { if (a || b || d) { setI(hi, h, pc, s * 0.93); setSeg(ln, h, pc, c0); h++; } }
          else { setI(edots, e, pc, 0.06); e++; }
        }
        const pulse = 1 + 0.06 * Math.sin(p * 200);
        out.visible = true; out.position.set(...c0); out.scale.setScalar(s * 0.96 * pulse);
      } else out.visible = false;
      for (let m = h; m < 27; m++) { setI(hi, m, [0, -99, 0], 0.001); setSeg(ln, m, [0, -99, 0], [0, -99, 0]); }
      for (let m = e; m < 27; m++) setI(edots, m, [0, -99, 0], 0.001);
      done(hi); done(edots); ln.geometry.attributes.position.needsUpdate = true; ln.visible = dwell;
      const vis = atEnd ? N : idx + (mv > 0 ? 1 : 0);
      stops.forEach((c, m) => setI(visited, m, ctr(...c), m < vis && inK ? s * 0.5 : 0.001)); done(visited);
      const d = seg(p, 0.66, 0.8);
      ghost.visible = d > 0; DL.forEach((c, m) => setI(ghost, m, ctr(...c), s * 0.88 * d)); done(ghost);
      lbK.visible = p > 0.06 && p < 0.62; lbD.visible = p > 0.8;
      cap(p < 0.64 ? '子流形卷积：核以<b>每个非空格子</b>为中心，只看 27 个邻居里非空的那些（金色是已经算完的格子）'
        : p < 0.8 ? '对比：<b>普通</b>稀疏卷积会让每个非空格子的 27 个邻居全都变成有输出'
        : '红色是普通卷积多出来的格子：每层胖一圈。子流形卷积的输出格子和输入<b>完全一样</b>');
    } };
  }

  /* ---------- scene 3: stride-2 downsampling of the toy scene ---------- */
  const REAL = ['512 × 128 × 512', '256 × 64 × 256', '128 × 32 × 128', '64 × 16 × 64'], CH = [16, 16, 32, 64];
  function s3(G) {
    const T = toy();
    const ms = T.lv.map(lv => { const im = inst(BOX, lv.list.length); lv.list.forEach((c, n) => colI(im, n, c.col)); im.visible = false; G.add(im); return { im, list: lv.list, s: lv.s }; });
    const PH = [[0.13, 'h', 0], [0.27, 'm', 0], [0.38, 'h', 1], [0.52, 'm', 1], [0.63, 'h', 2], [0.77, 'm', 2], [1.01, 'h', 3]];
    const inset = new THREE.Group(); inset.position.set(9.8, 1.4, -0.5); G.add(inset);
    const kids = inst(BOX, 8); let m = 0;
    for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) { kids.userData[m] = [a * 0.5, b * 0.5, c * 0.5]; colI(kids, m, [0.62, 0.55, 0.95]); m++; }
    inset.add(kids);
    const parent = new THREE.Mesh(BOX, L.mat(0x6f5fd6, { emissive: 0x1a1240 })); inset.add(parent);
    const rf = wireBox(3, 3, 3, COL.gau, 0.7, true); inset.add(rf);
    const lbI1 = lab('8 个小格', [0, 1.7, 0], { size: 24 }); inset.add(lbI1);
    const lbI2 = lab('→ 1 个大格，通道更多\n虚线：3³ 核实际看到的范围', [0, 2.2, 0], { size: 24 }); inset.add(lbI2);
    let lastKey = '';
    return { update(p) {
      let k = 0; while (p >= PH[k][0]) k++;
      const ph = PH[k], start = k ? PH[k - 1][0] : 0, isM = ph[1] === 'm', q = isM ? seg(p, start, ph[0]) : 0, l = ph[2];
      const kk = ph[1] + l + (isM ? q.toFixed(3) : '');
      if (kk !== lastKey) {
        lastKey = kk;
        ms.forEach((mm, i) => { mm.im.visible = (!isM && i === l) || (isM && (i === l || i === l + 1)); });
        if (!isM) { const mm = ms[l]; mm.list.forEach((c, n) => setI(mm.im, n, c.ctr, mm.s * 0.88)); done(mm.im); }
        else {
          const a = ms[l], b = ms[l + 1];
          a.list.forEach((c, n) => setI(a.im, n, lerp3(c.ctr, ctrAt(b.s, c.par), q), a.s * 0.88 * (1 - q))); done(a.im);
          b.list.forEach((c, n) => setI(b.im, n, c.ctr, b.s * 0.88 * q)); done(b.im);
        }
      }
      const qi = isM ? q : (l === 3 ? 1 : 0);
      for (let i = 0; i < 8; i++) setI(kids, i, kids.userData[i].map(v => v * (1 - qi)), 0.92 * (1 - qi) + 0.001); done(kids);
      parent.scale.setScalar(1.95 * qi + 0.001); rf.visible = isM; lbI1.visible = qi < 0.5; lbI2.visible = qi >= 0.5;
      if (isM) cap(`2 个子流形残差块 → <b>3³ 步长 2 卷积</b>：每 2 × 2 × 2 个小格合成 1 个大格（${REAL[l]} → ${REAL[l + 1]}）`);
      else {
        const lv = T.lv[l], tot = lv.dims[0] * lv.dims[1] * lv.dims[2];
        cap(`${l === 0 ? '输入（stem 之后）' : l === 3 ? '编码器最后一级' : `第 ${l} 级之后`}：<b>${REAL[l]}</b> · ${CH[l]} 通道　｜　示意场景 ${lv.dims.join(' × ')}，非空 ${lv.list.length.toLocaleString('en-US')} 格（${(100 * lv.list.length / tot).toFixed(1)}%）`);
      }
    } };
  }

  /* ---------- scene 4: dense latent, 8 channels, unit norm ---------- */
  function s4(G) {
    const T = toy(), L3 = T.lv[3], dims = L3.dims;
    const occ = inst(BOX, L3.list.length); L3.list.forEach((c, n) => { setI(occ, n, c.ctr, 0.88); colI(occ, n, c.col); }); done(occ); G.add(occ);
    const grid = gridLines(dims, 1, [-6, 0, -6], 0x8e9bb8, 0); G.add(grid);
    const all = []; for (let i = 0; i < dims[0]; i++) for (let j = 0; j < dims[1]; j++) for (let k = 0; k < dims[2]; k++) all.push({ i, j, k, ctr: ctrAt(1, [i, j, k]), occ: L3.cells.has(T.key(i, j, k)) });
    const emp = all.filter(c => !c.occ);
    const empM = inst(BOX, emp.length, { fade: true, opacity: 0.1 }); emp.forEach((c, n) => { setI(empM, n, c.ctr, 0.86); colI(empM, n, [0.55, 0.6, 0.72]); }); done(empM); G.add(empM);
    const latM = inst(BOX, all.length); all.forEach((c, n) => {
      const h = c.occ ? 0.56 + 0.1 * Math.sin(c.i * 0.9 + c.k * 0.5) + 0.05 * c.j : 0.6; _C.setHSL(h, c.occ ? 0.62 : 0.25, c.occ ? 0.52 : 0.4); latM.setColorAt(n, _C);
    }); G.add(latM);
    const pick = L3.list.reduce((a, b) => { const d = c => Math.hypot(c.ctr[0] + 1.6, c.ctr[1] - 2.5, c.ctr[2] - 1.5); return d(b) < d(a) ? b : a; });
    const hl = wireBox(1, 1, 1, COL.gau, 0.95); hl.position.set(...pick.ctr); G.add(hl);
    const base = [pick.ctr[0], 4.6, pick.ctr[2]];
    const stem = L.line([[pick.ctr[0], pick.ctr[1] + 0.5, pick.ctr[2]], [base[0], base[1] - 0.3, base[2]]], COL.gau, { dashed: true, dash: 0.2, gap: 0.14 }); G.add(stem);
    const tok = inst(BOX, 70), slot = (n) => n < 64 ? [base[0] + ((n % 8) - 3.5) * 0.3, base[1], base[2] + (Math.floor(n / 8) - 3.5) * 0.3] : [base[0] + 1.8, base[1], base[2] + (n - 64 - 2.5) * 0.34];
    for (let n = 0; n < 70; n++) colI(tok, n, n < 64 ? hex3(COL.enc) : hex3(COL.pts)); G.add(tok);
    const outY = base[1] + 1.6, outP = m => [base[0] + (m - 3.5) * 0.46, outY, base[2]];
    const outT = inst(BOX, 8); for (let m = 0; m < 8; m++) colI(outT, m, m < 4 ? hex3(COL.lat) : hex3(COL.gau)); G.add(outT);
    const c2 = [base[0], outY + 1.3, base[2]];
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 8, 64), L.mat(0xe6ecf7)); ring.rotation.x = Math.PI / 2; ring.position.set(...c2); G.add(ring);
    const dG = new THREE.Vector3(1, 0, 0.35).normalize(), dC = new THREE.Vector3(-0.45, 0, 1).normalize();
    const aG = new THREE.ArrowHelper(dG, new THREE.Vector3(...c2), 1.7, COL.lat, 0.3, 0.18), aC = new THREE.ArrowHelper(dC, new THREE.Vector3(...c2), 0.55, COL.gau, 0.22, 0.14); G.add(aG, aC);
    const lbA = lab('64 通道：三级稀疏卷积的结果', [base[0] - 2.6, base[1] + 0.2, base[2]], { size: 24 }); G.add(lbA);
    const lbB = lab('+ 6：落进这一格的点\n直接求平均（xyz + RGB）', [base[0] + 3.6, base[1] + 0.2, base[2]], { size: 24, border: 'rgba(56,209,255,.6)' }); G.add(lbB);
    const lbC = lab('1×1 卷积 → 4 个几何（蓝）＋ 4 个颜色（金）', [base[0] + 3.4, outY, base[2]], { size: 24 }); G.add(lbC);
    const lbD = lab('每组 4 个数除以自己的长度 → 长度都变成 1', [c2[0], c2[1] + 0.9, c2[2]], { size: 24, border: 'rgba(230,236,247,.5)' }); G.add(lbD);
    const lbE = lab('zₜ：每格 8 个数，空格子也有值\n真实 64 × 16 × 64 × 8，示意 12 × 3 × 12 × 8', [0, 4.9, -6.4], { border: 'rgba(58,168,224,.7)' }); G.add(lbE);
    return { update(p) {
      const b = seg(p, 0.1, 0.24), c = seg(p, 0.3, 0.44), d = seg(p, 0.5, 0.64), e = seg(p, 0.68, 0.82), f = seg(p, 0.86, 0.97);
      grid.material.opacity = 0.3 * b * (1 - 0.6 * f); empM.visible = b > 0 && f < 1; empM.material.opacity = 0.12 * b * (1 - f);
      occ.visible = f < 1; latM.visible = f > 0; all.forEach((x, n) => setI(latM, n, x.ctr, 0.88 * f)); done(latM);
      hl.visible = p > 0.26 && f < 1; stem.visible = c > 0.3 && f < 0.5;
      for (let n = 0; n < 70; n++) {
        const st = slot(n), from = pick.ctr, tgt = n < 64 ? outP(n % 4) : outP(n - 64 < 3 ? (n - 64) % 4 : 4 + (n - 67));
        const pos = d > 0 ? lerp3(st, tgt, d) : lerp3(from, st, c);
        setI(tok, n, pos, (n < 64 ? 0.24 : 0.28) * clamp(c * 1.4, 0, 1) * (1 - d) + 0.001);
      } done(tok);
      const og = clamp((d - 0.6) / 0.4, 0, 1) * (1 - f); for (let m = 0; m < 8; m++) setI(outT, m, outP(m), 0.38 * og + 0.001); done(outT);
      const showN = e > 0 && f < 1; ring.visible = aG.visible = aC.visible = showN; ring.material.opacity = 1;
      aG.setLength(L.lerp(1.7, 1, e) * 1, 0.3, 0.18); aC.setLength(L.lerp(0.55, 1, e), 0.22, 0.14);
      lbA.visible = lbB.visible = c > 0.6 && d < 0.3; lbC.visible = d > 0.7 && f < 0.5; lbD.visible = e > 0.1 && f < 0.5; lbE.visible = f > 0.5;
      cap(p < 0.1 ? '编码器最后一级：只有非空格子有 64 通道特征'
        : p < 0.28 ? '<b>.dense()</b>：变回普通的稠密网格，空格子补 0'
        : p < 0.48 ? '取一格看：64 个卷积特征，再拼上 6 个直接平均出来的原始特征'
        : p < 0.66 ? '<b>1×1 卷积</b>（每格单独算）压成 8 个数：4 个几何 + 4 个颜色'
        : p < 0.85 ? '<b>单位归一化</b>：两组各自除以自己的长度'
        : '这就是潜变量 <b>zₜ</b>：动力学模型只在这上面工作');
    } };
  }

  /* ---------- scene 5: why this is an autoencoder ---------- */
  function s5(G) {
    const T = toy(), r = L.rng(5), K = 0.5;
    const sub = T.P.filter((_, i) => i % 3 === 0).map(q => ({ p: [q.p[0] * K, (q.p[1] - 1.5) * K, q.p[2] * K], c: q.c }));
    const inA = points(sub.filter((_, i) => i % 2 === 0), 0.08), inB = points(sub.filter((_, i) => i % 2 === 1), 0.08);
    const inG = new THREE.Group(); inG.position.set(-12.5, 0, 0); inG.add(inA, inB); G.add(inG);
    const outL = []; for (const c of T.D1.values()) for (let t = 0; t < 3; t++) outL.push({ p: [(c.ctr[0] + (r() - 0.5) * 0.45) * K, (c.ctr[1] - 1.5 + (r() - 0.5) * 0.3) * K, (c.ctr[2] + (r() - 0.5) * 0.45) * K], c: c.col });
    const outG = new THREE.Group(); outG.position.set(12.5, 0, 0); outG.add(points(outL, 0.14, { opacity: 0.95 })); G.add(outG);
    const KL = 0.28, latList = T.lv[3].list;
    const mkLat = () => { const im = inst(BOX, latList.length); latList.forEach((c, n) => { setI(im, n, [c.ctr[0] * KL, (c.ctr[1] - 1.5) * KL, c.ctr[2] * KL], 0.88 * KL); _C.setHSL(0.56 + 0.1 * Math.sin(c.i * 0.9 + c.k * 0.5), 0.62, 0.52); im.setColorAt(n, _C); }); done(im); return im; };
    const latG = new THREE.Group(), latA = mkLat(), latB = mkLat(); latG.add(latA, latB); G.add(latG);
    const funnel = (r1, r2, x, col) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, 4.4, 4, 1, true), L.mat(col, { opacity: 0.32, side: THREE.DoubleSide, depthWrite: false })); m.rotation.z = -Math.PI / 2; m.position.x = x; return m; };
    const enc = funnel(1.0, 2.7, -6.4, COL.enc), dec = funnel(2.7, 1.0, 6.4, COL.dec); G.add(enc, dec);
    const flowN = 36, flow = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(flowN * 3), 3)), new THREE.PointsMaterial({ size: 0.22, color: 0xe6ecf7, transparent: true, opacity: 0.9 }));
    flow.frustumCulled = false; G.add(flow);
    const arc = new THREE.CatmullRomCurve3([[12.5, -1.7, 0], [6, -3.9, 0], [-6, -3.9, 0], [-12.5, -1.7, 0]].map(v => new THREE.Vector3(...v)));
    const loss = L.line(arc.getPoints(60), COL.loss, { dashed: true, dash: 0.45, gap: 0.3 }); G.add(loss);
    const lossHead = L.arrow([-11.4, -2.6, 0], [-12.4, -1.8, 0], COL.loss, { head: 0.5, headW: 0.35 }); G.add(lossHead);
    const lb = [
      lab('输入点云\n论文：最多 30 万点 × 6 ≈ 180 万个数', [-12.5, 2.6, 0]),
      lab('编码器 E_θ', [-6.2, 2.9, 0], { color: '#c9bfff', size: 24 }),
      lab('潜变量 z\n论文 32×16×32×8 = 13.1 万\n代码 64×16×64×8 = 52.4 万', [0, 2.6, 0], { border: 'rgba(58,168,224,.7)' }),
      lab('解码器 D_ψ', [6.2, 2.9, 0], { color: '#9fe6bf', size: 24 }),
      lab('输出：粒子 + 3D 高斯', [12.5, 2.6, 0]),
      lab('损失 = 输出和输入（点云、照片）比\n没有任何人工标签', [0, -4.9, 0], { border: 'rgba(255,122,89,.8)' }),
      lab('解码器只拿得到 z', [0, -1.7, 0], { border: 'rgba(242,193,78,.8)' }),
      lab('两份不同的子采样 → 应该得到同一个 z\n（差的平方 × 100）', [0, 4.6, 0], { border: 'rgba(56,209,255,.7)' })
    ]; lb.forEach(x => G.add(x));
    return { update(p) {
      const a = seg(p, 0, 0.1), b = seg(p, 0.1, 0.26), c = seg(p, 0.26, 0.42), d = seg(p, 0.44, 0.58), e = seg(p, 0.6, 0.74), sp = seg(p, 0.78, 0.86), mg = seg(p, 0.9, 0.98);
      inA.material.opacity = inB.material.opacity = a; inG.visible = a > 0;
      enc.visible = latG.visible = b > 0; enc.material.opacity = 0.32 * b; latG.scale.setScalar(Math.max(0.001, b) * (1 + (e > 0 && e < 1 ? 0.12 * Math.sin(e * Math.PI) : 0)));
      dec.visible = outG.visible = c > 0; dec.material.opacity = 0.32 * c; outG.scale.setScalar(Math.max(0.001, c));
      loss.visible = lossHead.visible = d > 0; loss.material.opacity = d;
      const fl = flow.geometry.attributes.position.array, tt = performance.now() / 4000;
      for (let i = 0; i < flowN; i++) { const u = (tt + i / flowN) % 1, x = -10 + 20 * u; const lim = c > 0 ? 10 : b > 0 ? 0 : -10; fl[i * 3] = Math.min(x, lim); fl[i * 3 + 1] = 0.25 * Math.sin(u * 18 + i); fl[i * 3 + 2] = 0.25 * Math.cos(u * 14 + i); }
      flow.geometry.attributes.position.needsUpdate = true; flow.visible = b > 0 && sp === 0;
      inA.position.y = 1.7 * sp; inB.position.y = -1.7 * sp;
      inA.material.color.setRGB(1, 1 - 0.3 * sp, 1); inB.material.color.setRGB(1 - 0.3 * sp, 1, 1);
      const off = 1.4 * (sp - mg); latA.position.y = off; latB.position.y = -off; latB.visible = sp > 0;
      lb[0].visible = a > 0.5 && sp === 0; lb[1].visible = lb[2].visible = b > 0.5 && sp === 0; lb[3].visible = lb[4].visible = c > 0.5 && sp === 0;
      lb[5].visible = d > 0.5; lb[6].visible = e > 0.05 && e < 1 || (p > 0.6 && p < 0.77); lb[7].visible = sp > 0.5;
      cap(p < 0.26 ? '编码器把几十万个点压进一个小小的 3D 网格 z'
        : p < 0.44 ? '解码器从 z 出发，重建出粒子和 3D 高斯'
        : p < 0.6 ? '训练目标：重建结果要和<b>输入自己</b>对得上，不需要任何标签'
        : p < 0.77 ? '瓶颈：z 比输入小得多，解码器又<b>只拿得到 z</b>，于是 z 必须记住场景的结构'
        : '一致性：同一场景抽两份不同的点，z 要一样，这样 z 只描述场景，不记抽样噪声');
    } };
  }

  /* ---------- scene 6: coarse-to-fine voxel decoder ---------- */
  function s6(G) {
    const T = toy(), dims = [12, 3, 12], cells = [];
    for (let i = 0; i < 12; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 12; k++) {
      const gt = T.D0.has(T.key(i, j, k)); let nb = false;
      if (!gt) for (let a = -1; a <= 1 && !nb; a++) for (let b = -1; b <= 1 && !nb; b++) for (let d = -1; d <= 1 && !nb; d++) if (T.D0.has(T.key(i + a, j + b, k + d))) nb = true;
      const h = Math.sin(i * 12.9898 + j * 78.233 + k * 37.719) * 43758.5453, jit = h - Math.floor(h);
      cells.push({ ijk: [i, j, k], ctr: ctrAt(1, [i, j, k]), gt, prob: gt ? 0.82 + 0.16 * jit : nb ? 0.12 + 0.3 * jit : 0.02 + 0.04 * jit });
    }
    const cm = inst(BOX, cells.length); G.add(cm);
    const kids = [];
    cells.filter(c => c.gt).forEach(c => { for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let d = 0; d < 2; d++) {
      const ijk = [c.ijk[0] * 2 + a, c.ijk[1] * 2 + b, c.ijk[2] * 2 + d], kc = T.D1.get(T.key(...ijk));
      kids.push({ from: c.ctr, ctr: ctrAt(0.5, ijk), gt: !!kc, col: kc ? kc.col : [0.3, 0.8, 0.55] });
    } });
    const km = inst(BOX, kids.length); G.add(km);
    const grid = gridLines(dims, 1, [-6, 0, -6], 0x8e9bb8, 0.18); G.add(grid);
    const blue = [0.23, 0.55, 0.85], green = [0.31, 0.79, 0.54], dark = [0.25, 0.3, 0.4];
    const lbP = lab('越亮 = 越可能有东西', [0, 4.2, -6.4], { size: 24 }); G.add(lbP);
    const nk = kids.filter(k => k.gt).length;
    const lbS = lab(`${nk} 个最细格 = 粒子头的种子`, [0, 4.2, -6.4], { border: 'rgba(242,193,78,.8)' }); G.add(lbS);
    return { update(p) {
      const a = seg(p, 0, 0.12), b = seg(p, 0.14, 0.32), c = seg(p, 0.36, 0.46), d = seg(p, 0.5, 0.66), e = seg(p, 0.7, 0.84);
      cells.forEach((x, n) => {
        const pr = x.prob; let sc = 0.9 * (0.28 * a + (0.15 + 0.75 * pr - 0.28) * b * a);
        if (pr < 0.5) sc *= 1 - c; if (x.gt) sc *= 1 - d;
        setI(cm, n, x.ctr, Math.max(0.001, sc));
        colI(cm, n, b > 0 ? lerp3(blue, lerp3(dark, green, pr), b) : blue);
      }); done(cm);
      kids.forEach((x, n) => {
        let sc = 0.5 * 0.9 * d; if (!x.gt) sc *= 1 - e;
        setI(km, n, lerp3(x.from, x.ctr, d), Math.max(0.001, sc)); colI(km, n, x.gt ? lerp3(green, x.col, e) : green);
      }); done(km); km.visible = d > 0;
      lbP.visible = p > 0.18 && p < 0.48; lbS.visible = p > 0.86;
      cap(p < 0.14 ? 'z 先过三层 3³ 卷积：8 → 64 → 64 → <b>128</b> 通道'
        : p < 0.36 ? '第 0 级（64 × 16 × 64）：每格预测一个<b>占据概率</b>，用真实占据做 BCE 监督'
        : p < 0.5 ? '概率 > 0.5 的格子算“有东西”'
        : p < 0.7 ? '<b>×2 上采样</b> + 卷积：每格分成 2 × 2 × 2 个子格（128 × 32 × 128，64 通道）'
        : p < 0.86 ? '第 1 级再预测一次占据，空的子格去掉；颜色头给剩下的格子上色'
        : '结果：每格 4.5 × 6.7 × 3.0 mm 的“台阶状”点云，还不能渲染');
    } };
  }

  /* ---------- shared local surface for scenes 7 and 8 ---------- */
  const surf = (x, z) => 0.16 * x - 0.1 * z + 0.22 * Math.sin(0.9 * x + 0.4) - 0.08;
  const surfN = (x, z) => { const e = 0.01, dx = (surf(x + e, z) - surf(x - e, z)) / (2 * e), dz = (surf(x, z + e) - surf(x, z - e)) / (2 * e); return new THREE.Vector3(-dx, 1, -dz).normalize(); };
  const surfCol = (x, z) => [clamp(0.95 - 0.06 * x, 0, 1), clamp(0.6 - 0.08 * x + 0.04 * z, 0, 1), 0.2];
  function gaussQuat(x, z, ang) { const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), surfN(x, z)); return q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang)); }

  /* ---------- scene 7: the particle head ---------- */
  function s7(G) {
    const s = 1.6, r = L.rng(17), g = () => L.gauss(r);
    const nb = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) {
      const c = [a * s, b * s, d * s]; let hit = false;
      for (let u = 0; u < 7 && !hit; u++) for (let v = 0; v < 7 && !hit; v++) { const x = c[0] + (u / 6 - 0.5) * s, z = c[2] + (v / 6 - 0.5) * s, y = surf(x, z); if (y > c[1] - s / 2 && y < c[1] + s / 2) hit = true; }
      nb.push({ c, hit, centre: !a && !b && !d });
    }
    G.add(gridLines([3, 3, 3], s, [-1.5 * s, -1.5 * s, -1.5 * s], 0x8e9bb8, 0.3));
    const occ = nb.filter(x => x.hit && !x.centre);
    const om = inst(BOX, occ.length, { fade: true, opacity: 0.13 }); occ.forEach((x, n) => { setI(om, n, x.c, s * 0.96); colI(om, n, hex3(COL.dec)); }); done(om); G.add(om);
    const cw = wireBox(s, s, s, COL.gau, 0.95); G.add(cw);
    const gt = []; for (let t = 0; t < 520; t++) { const x = (r() - 0.5) * 3 * s, z = (r() - 0.5) * 3 * s, y = surf(x, z) + 0.015 * g(); if (Math.abs(y) < 1.5 * s) gt.push({ p: [x, y, z], c: [0.22, 0.82, 1] }); }
    const gtP = points(gt, 0.06, { opacity: 0.7 }); G.add(gtP);
    const bx = 4.2, barY = n => (n - 13) * 0.24;
    const tok = inst(BOX, 27); nb.forEach((x, n) => colI(tok, n, x.hit ? hex3(COL.dec) : [0.32, 0.36, 0.46])); G.add(tok);
    const blocks = [5.4, 6.5, 7.6].map(x => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.4, 1.2), L.mat(COL.dec, { opacity: 0.4, emissive: 0x000000, depthWrite: false })); m.position.set(x, 0, 0); G.add(m); return m; });
    const outX = 8.9, outY = m => (m - 7.5) * 0.32;
    const outT = inst(BOX, 16); for (let m = 0; m < 16; m++) colI(outT, m, hex3(COL.gau)); G.add(outT);
    const init = [], fin = [], ang = [], sc = [];
    for (let m = 0; m < 16; m++) init.push([(r() * 2 - 1) * 0.4 * s, (r() * 2 - 1) * 0.4 * s, (r() * 2 - 1) * 0.4 * s]);
    for (let m = 0; m < 16; m++) { const u = m % 4, v = Math.floor(m / 4), x = ((u + 0.5) / 4 - 0.5) * 0.92 * s + 0.07 * s * g(), z = ((v + 0.5) / 4 - 0.5) * 0.92 * s + 0.07 * s * g(); fin.push([x, surf(x, z), z]); ang.push(r() * Math.PI); sc.push([0.1 + 0.03 * r(), 0.022, 0.075 + 0.03 * r()]); }
    init.sort((a, b) => a[0] - b[0] || a[2] - b[2]); const fi = fin.map((f, m) => m).sort((a, b) => fin[a][0] - fin[b][0] || fin[a][2] - fin[b][2]);
    const kid = inst(BALL, 16, { opacity: 0.92 }); for (let m = 0; m < 16; m++) colI(kid, m, [0.95, 0.9, 0.7]); G.add(kid);
    const trail = segLines(16, 0xe6ecf7, 0.5); G.add(trail);
    const lb = [
      lab('中心格 = 种子', [0, 0.5 * s + 0.6, -1.5 * s], { size: 24, border: 'rgba(242,193,78,.8)' }),
      lab('27 格 × 64 通道 = 1728 个数\n（绿色：有东西的邻居）', [bx, 3.9, 0], { size: 24 }),
      lab('MLP：1728 → 1024 → 1024 → 1024 → 224', [6.5, 2.9, 0], { size: 24, border: 'rgba(79,201,138,.7)' }),
      lab('16 个孩子 × 14 个数', [outX + 0.3, 3.2, 0], { size: 24, border: 'rgba(242,193,78,.8)' }),
      lab('起点 child_init：每个孩子固定、可学习', [0, 1.5 * s + 0.6, 0], { size: 24 }),
      lab('+ 位移（最多 ±0.5 格）→ 贴到表面上', [0, 1.5 * s + 0.6, 0], { size: 24 }),
      lab('每个孩子 = 一个 3D 高斯\n位移 3 · 尺度 3 · 旋转 4 · 不透明度 1 · 颜色 3', [0, 1.5 * s + 0.75, 0], { border: 'rgba(242,193,78,.8)' })
    ]; lb.forEach(x => G.add(x));
    const q0 = new THREE.Quaternion();
    return { update(p) {
      const a = seg(p, 0, 0.1), b = seg(p, 0.12, 0.28), c = seg(p, 0.3, 0.44), d = seg(p, 0.46, 0.58), e = seg(p, 0.62, 0.76), f = seg(p, 0.8, 0.92);
      gtP.material.opacity = 0.7 * a;
      nb.forEach((x, n) => { const tgt = [bx, barY(n), 0]; setI(tok, n, lerp3(x.c, tgt, b), (b > 0 ? 0.2 : 0.001) * (1 - c) + 0.001); }); done(tok); tok.visible = b > 0 && c < 1;
      blocks.forEach((m, i) => { const on = clamp(c * 3 - i, 0, 1); m.visible = b > 0.5 || c > 0; m.material.emissive.setRGB(0.08 * on, 0.3 * on, 0.18 * on); });
      for (let m = 0; m < 16; m++) setI(outT, m, [outX, outY(m), 0], (c > 0.85 ? 0.24 : 0.001) * (1 - d) + 0.001); done(outT);
      for (let m = 0; m < 16; m++) {
        const ini = init[m], fn = fin[fi[m]], from = [outX, outY(m), 0];
        let pos = d < 1 ? lerp3(from, ini, d) : lerp3(ini, fn, e); if (d < 1) pos[1] += Math.sin(d * Math.PI) * 1.6;
        const sv = f > 0 ? [L.lerp(0.07, sc[fi[m]][0] * s, f), L.lerp(0.07, sc[fi[m]][1] * s, f), L.lerp(0.07, sc[fi[m]][2] * s, f)] : (d > 0 ? 0.07 : 0.001);
        setI(kid, m, pos, sv, f > 0 ? q0.copy(_Q0).slerp(gaussQuat(fn[0], fn[2], ang[fi[m]]), f) : null);
        colI(kid, m, lerp3([0.95, 0.9, 0.7], surfCol(fn[0], fn[2]), f));
        setSeg(trail, m, ini, pos);
      } done(kid); kid.visible = d > 0;
      trail.geometry.attributes.position.needsUpdate = true; trail.visible = e > 0 && f < 1;
      lb[0].visible = a > 0.5 && p < 0.46; lb[1].visible = b > 0.5 && c < 0.5; lb[2].visible = c > 0.2 && d < 0.5; lb[3].visible = c > 0.85 && d < 0.5;
      lb[4].visible = d > 0.6 && e < 0.1; lb[5].visible = e >= 0.1 && f < 0.1; lb[6].visible = f >= 0.1;
      cap(p < 0.12 ? '取一个种子格，以及它周围 3 × 3 × 3 个格子（青色点是真实表面）'
        : p < 0.3 ? '把 27 格的 64 通道特征拉平：<b>1728</b> 个数'
        : p < 0.46 ? 'LayerNorm + 4 层 MLP，输出 16 × 14 = <b>224</b> 个数'
        : p < 0.62 ? '16 个孩子先出现在各自的<b>起点</b>（学出来的，±0.4 格）'
        : p < 0.8 ? '再加上 MLP 预测的<b>位移</b>：位置不再钉在格子中心，而是贴到真实表面'
        : '每个孩子展开成一个<b>扁的 3D 高斯</b>：有尺度、朝向、不透明度和颜色，可以渲染');
    } };
  }

  /* ---------- scene 8: local Chamfer loss ---------- */
  function s8(G) {
    const s = 4, r = L.rng(23), g = () => L.gauss(r), h = s / 2;
    G.add(wireBox(s, s, s, COL.gau, 0.9));
    const gt = []; for (let t = 0; t < 400 && gt.length < 44; t++) { const x = (r() - 0.5) * s * 1.1, z = (r() - 0.5) * s * 1.1; gt.push([x, surf(x, z) + 0.01 * g(), z]); }
    const gtC = gt.map(p => surfCol(p[0], p[2]));
    const gtM = inst(BALL, gt.length); gt.forEach((p, n) => { setI(gtM, n, p, 0.07); colI(gtM, n, [0.22, 0.82, 1]); }); done(gtM); G.add(gtM);
    const fin = [], bad = [], ang = [], sc = [];
    for (let m = 0; m < 16; m++) {
      const u = m % 4, v = Math.floor(m / 4), x = ((u + 0.5) / 4 - 0.5) * 0.9 * s + 0.05 * s * g(), z = ((v + 0.5) / 4 - 0.5) * 0.9 * s + 0.05 * s * g();
      fin.push([x, surf(x, z), z]); ang.push(r() * Math.PI); sc.push([0.09 + 0.03 * r(), 0.016, 0.07 + 0.03 * r()]);
      bad.push([x * 0.55 + 0.25 * h * g(), surf(x, z) + (0.25 + 0.35 * r()) * h * (m % 3 ? 1 : -0.6), z * 0.55 + 0.25 * h * g()]);
    }
    const kid = inst(BALL, 16, { opacity: 0.95 }); G.add(kid);
    const fw = segLines(16, COL.gau, 0.95), bw = segLines(gt.length, 0x38d1ff, 0.85); G.add(fw, bw);
    const lbF = lab('正向：每个粒子 → 最近的真实点', [0, h + 0.7, 0], { border: 'rgba(242,193,78,.8)' }), lbB = lab('反向：每个真实点 → 最近的粒子', [0, h + 0.7, 0], { border: 'rgba(56,209,255,.8)' });
    const lbC = lab('颜色：分给这个粒子的真实点\n的平均颜色，就是它的目标', [0, h + 0.8, 0]); G.add(lbF, lbB, lbC);
    const near = (p, set) => { let bi = 0, bd = 1e9; set.forEach((q, i) => { const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (d < bd) { bd = d; bi = i; } }); return [bi, bd]; };
    const q0 = new THREE.Quaternion();
    return { update(p) {
      const a = seg(p, 0, 0.1), b = seg(p, 0.12, 0.28), c = seg(p, 0.32, 0.48), d = seg(p, 0.54, 0.76), e = seg(p, 0.8, 0.94);
      const cur = bad.map((bp, m) => lerp3(bp, fin[m], d));
      let fsum = 0, bsum = 0;
      const own = gt.map(gp => near(gp, cur)); const acc = cur.map(() => [0, 0, 0, 0]);
      own.forEach(([i], n) => { acc[i][0] += gtC[n][0]; acc[i][1] += gtC[n][1]; acc[i][2] += gtC[n][2]; acc[i][3]++; });
      cur.forEach((cp, m) => {
        const [i, dd] = near(cp, gt); fsum += dd; setSeg(fw, m, cp, gt[i]);
        const tgt = acc[m][3] ? acc[m].slice(0, 3).map(v => v / acc[m][3]) : [0.6, 0.6, 0.6];
        const ell = [L.lerp(0.13, sc[m][0] * s, d), L.lerp(0.13, sc[m][1] * s, d), L.lerp(0.13, sc[m][2] * s, d)];
        setI(kid, m, cp, a > 0 ? ell.map(v => v * clamp(a * 1.5, 0, 1)) : 0.001, q0.copy(_Q0).slerp(gaussQuat(fin[m][0], fin[m][2], ang[m]), d));
        colI(kid, m, lerp3([0.78, 0.8, 0.86], tgt, e));
      }); done(kid);
      own.forEach(([i, dd], n) => { bsum += dd; setSeg(bw, n, gt[n], cur[i]); });
      fw.geometry.attributes.position.needsUpdate = bw.geometry.attributes.position.needsUpdate = true;
      fw.visible = b > 0; fw.material.opacity = 0.95 * b * (1 - 0.6 * e); bw.visible = c > 0; bw.material.opacity = 0.85 * c;
      const F = fsum / 16 / (s * s), Bk = bsum / gt.length / (s * s);
      lbF.visible = b > 0.3 && c < 0.3; lbB.visible = c >= 0.3 && d < 0.1; lbC.visible = e > 0.3;
      const val = `正向 <b>${F.toFixed(4)}</b> + 反向 <b>${Bk.toFixed(4)}</b>（格宽² 为单位）`;
      cap(p < 0.12 ? '一个种子格：白色是预测的 16 个粒子（训练早期），青色是真实点'
        : p < 0.32 ? `<b>正向</b>：每个粒子连到最近的真实点　${val}`
        : p < 0.54 ? `<b>反向</b>：每个真实点连到最近的粒子　${val}`
        : p < 0.8 ? `训练把两种线都拉短，粒子铺到表面上　${val}`
        : '颜色：每个真实点分给最近的粒子，粒子的颜色向这些点的平均色靠拢（ℓ1）');
    } };
  }

  /* ---------- scene 9: render the Gaussians from a moving camera ---------- */
  function s9(G) {
    const T = toy(), r = L.rng(29), gs = [];
    for (const c of T.D1.values()) for (let t = 0; t < 3; t++) {
      const p = [c.ctr[0] + (r() - 0.5) * 0.4, c.ctr[1] + (r() - 0.5) * 0.3, c.ctr[2] + (r() - 0.5) * 0.4];
      const flat = c.j === 0; gs.push({ p, c: c.col.map(v => clamp(v + 0.03 * L.gauss(r), 0, 1)), s: flat ? [0.2, 0.035, 0.2] : [0.15, 0.15, 0.15] });
    }
    const gm = inst(BALL, gs.length, { opacity: 0.96 }); gs.forEach((x, n) => { setI(gm, n, x.p, x.s); colI(gm, n, x.c); }); done(gm); G.add(gm);
    gs.forEach(x => { x.css = `rgb(${x.c.map(v => Math.round(v * 255)).join(',')})`; x.rad = Math.max(x.s[0], x.s[2]) * 1.1; });
    const vc = new THREE.PerspectiveCamera(46, 4 / 3, 0.5, 80);
    const camG = new THREE.Group(); G.add(camG);
    camG.add(L.box(0.9, 0.62, 0.62, 0x3b4660));
    const lens = L.cyl(0.22, 0.22, 0.4, 0x9aa6bf); lens.rotation.x = Math.PI / 2; lens.position.z = -0.45; camG.add(lens);
    const fz = 2.4, fy = fz * Math.tan(23 * Math.PI / 180), fx = fy * 4 / 3, cs = [[-fx, -fy], [fx, -fy], [fx, fy], [-fx, fy]].map(([x, y]) => new THREE.Vector3(x, y, -fz));
    const fr = []; cs.forEach((c, i) => { fr.push(new THREE.Vector3(), c, c, cs[(i + 1) % 4]); });
    camG.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(fr), new THREE.LineBasicMaterial({ color: COL.gau, transparent: true, opacity: 0.9 })));
    const rayIdx = []; for (let i = 0; i < 16; i++) rayIdx.push(Math.floor(r() * gs.length));
    const rays = segLines(16, COL.gau, 0.45); G.add(rays);
    const lbC = lab('训练相机', [0, 1.1, 0], { size: 24 }); camG.add(lbC);
    const cvA = $('cvRGB'), cvB = $('cvD'), ga = cvA.getContext('2d'), gb = cvB.getContext('2d'), W = cvA.width, H = cvA.height;
    const v = new THREE.Vector3(), order = gs.map((_, i) => i), dep = new Float32Array(gs.length);
    const foc = H / 2 / Math.tan(23 * Math.PI / 180);
    function render(frac, depthFrac) {
      vc.updateMatrixWorld(); vc.matrixWorldInverse.copy(vc.matrixWorld).invert();
      for (let i = 0; i < gs.length; i++) { v.set(...gs[i].p).applyMatrix4(vc.matrixWorldInverse); dep[i] = -v.z; }
      order.sort((a, b) => dep[b] - dep[a]);
      ga.fillStyle = '#0b1020'; ga.fillRect(0, 0, W, H); gb.fillStyle = '#000'; gb.fillRect(0, 0, W, H);
      const nA = Math.floor(order.length * frac), nB = Math.floor(order.length * depthFrac);
      let dmin = 1e9, dmax = 0; for (let i = 0; i < gs.length; i++) if (dep[i] > 0.5) { dmin = Math.min(dmin, dep[i]); dmax = Math.max(dmax, dep[i]); }
      for (let k = 0; k < order.length; k++) {
        const i = order[k]; if (dep[i] < 0.5) continue; if (k >= nA && k >= nB) continue;
        v.set(...gs[i].p).project(vc); const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H; if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
        const rad = Math.max(0.8, gs[i].rad * foc / dep[i]);
        if (k < nA) { ga.globalAlpha = 0.9; ga.fillStyle = gs[i].css; ga.beginPath(); ga.arc(x, y, rad, 0, 6.283); ga.fill(); }
        if (k < nB) { const t = Math.round(255 * (1 - (dep[i] - dmin) / Math.max(1e-3, dmax - dmin)) * 0.85 + 30); gb.globalAlpha = 1; gb.fillStyle = `rgb(${t},${t},${t})`; gb.beginPath(); gb.arc(x, y, rad, 0, 6.283); gb.fill(); }
      }
      ga.globalAlpha = 1;
    }
    let lastR = '';
    return { update(p) {
      const a = seg(p, 0, 0.1), b = seg(p, 0.12, 0.4), c = seg(p, 0.42, 0.56), d = seg(p, 0.6, 1);
      const ang = -0.95 + 1.9 * d, R = 11, hgt = 6.2;
      vc.position.set(R * Math.sin(ang), hgt, R * Math.cos(ang)); vc.lookAt(0, 0.9, 0);
      camG.position.copy(vc.position); camG.quaternion.copy(vc.quaternion); camG.scale.setScalar(Math.max(0.001, a));
      rayIdx.forEach((i, k) => setSeg(rays, k, vc.position.toArray(), gs[i].p)); rays.geometry.attributes.position.needsUpdate = true;
      rays.visible = b > 0 && b < 1; rays.material.opacity = 0.5 * Math.sin(Math.PI * b);
      const key = [b.toFixed(3), c.toFixed(3), d.toFixed(4)].join('|'); if (key !== lastR) { lastR = key; render(b, c); }
      cap(p < 0.12 ? '所有高斯（这里只画了前景）和一台训练相机'
        : p < 0.42 ? '从这台相机的位置把高斯<b>投影到图像上</b>，由远到近叠起来 → 渲染出的 RGB'
        : p < 0.6 ? '同样的方法得到<b>深度图</b>（越近越亮）；两张图都和这台相机真实拍到的比'
        : '换一个视角，<b>同一组高斯</b>直接再渲染一次：训练时没出现过的相机也行');
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9];

  /* ---------- player ---------- */
  let cur = 0, api = null, playing = !L.reduced(), t0 = 0, pNow = 0, tw = null;
  const HOLD = 1.8;
  function fly(th, ph, d, tg) {
    let dth = th - S.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth));
    const el = $('stage'), asp = (el.clientWidth || 1) / (el.clientHeight || 1); d *= Math.min(2.2, Math.max(1, 1.45 / asp));
    tw = { t0: performance.now(), k: L.reduced() ? 0.999 : 0, from: [S.theta, S.phi, S.dist, S.target.clone()], to: [S.theta + dth, ph, d, new THREE.Vector3(...tg)] };
    refDist = d;
  }
  function setPlay(on) { playing = on; $('play').textContent = on ? '❚❚ 暂停' : '▶ 播放'; $('play').setAttribute('aria-label', on ? '暂停' : '播放'); }
  function go(i, p0 = 0) {
    cur = (i + SCENES.length) % SCENES.length; showInfo(cur);
    if (!S) return;
    L.clear(root); LABS = []; lastCap = null;
    const sc = SCENES[cur]; fly(...sc.cam); refDist = sc.cam[2] * Math.min(2.2, Math.max(1, 1.45 / (($('stage').clientWidth || 1) / ($('stage').clientHeight || 1))));
    const G = new THREE.Group(); root.add(G); api = BUILD[cur](G);
    pNow = p0; t0 = performance.now() - p0 * sc.dur * 1000; api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
  }
  if (S) S.onTick(() => {
    if (playing && api) {
      const sc = SCENES[cur], el = (performance.now() - t0) / 1000;
      if (el > sc.dur + HOLD) { t0 = performance.now(); pNow = 0; } else pNow = Math.min(1, el / sc.dur);
      api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
    } else if (api && SCENES[cur].n === 5) api.update(pNow); // keeps the flow dots moving while paused
    if (tw) { tw.k = L.reduced() ? 1 : Math.min(1, (performance.now() - tw.t0) / 900); const e = L.ease(tw.k), [a, b] = [tw.from, tw.to]; S.setView(L.lerp(a[0], b[0], e), L.lerp(a[1], b[1], e), L.lerp(a[2], b[2], e), a[3].clone().lerp(b[3], e).toArray()); if (tw.k >= 1) tw = null; }
    const f = clamp(S.dist / refDist, 0.6, 1.6); for (const sp of LABS) sp.scale.copy(sp.userData.s0).multiplyScalar(f);
  });
  $('play').onclick = () => { if (!playing) t0 = performance.now() - pNow * SCENES[cur].dur * 1000; setPlay(!playing); };
  $('scrub').oninput = e => { setPlay(false); pNow = e.target.value / 1000; if (api) api.update(pNow); };
  $('prev').onclick = () => go(cur - 1); $('next').onclick = () => go(cur + 1);
  btns.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); });
  stepsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; go(+b.dataset.i); if (!document.body.classList.contains('embed')) $('stage').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' && e.key !== ' ') return; if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1); else if (e.key === ' ') { e.preventDefault(); $('play').click(); } });
  const s0 = clamp((parseInt(qs.get('scene'), 10) || 1) - 1, 0, SCENES.length - 1), pq = qs.get('p');
  setPlay(playing && pq == null);
  go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0));
})();
