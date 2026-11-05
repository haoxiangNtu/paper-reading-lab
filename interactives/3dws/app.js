'use strict';
/* 3D architecture of arXiv 2611.04492 (3D World Simulator), as I read §3 and Appendix B.
   Upper row (z<0): particle-voxel autoencoder. Lower row (z>0): 3D U-Net latent dynamics.
   Geometry follows ALOHA (Table 3/4); the dataset switch changes the numbers in the text.
   Nothing here runs the model: the point cloud is a hand-made sketch of the part-assembly scene. */
(function () {
  if (new URLSearchParams(location.search).get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D;
  const $ = id => document.getElementById(id);
  const COL = { pts: 0x38d1ff, lat: 0x3aa8e0, enc: 0x9d8cff, dec: 0x4fc98a, gau: 0xf2c14e, attn: 0xd45fa0, act: 0xf0963c, grey: 0x6b7794, mask: 0xe05d5d, loss: 0xff7a59 };

  /* ---------- numbers from Tables 3 and 4 ---------- */
  const DS = {
    aloha: { name: 'ALOHA', grid: [32, 16, 32], ws: '0.52 × 0.32 × 0.28', pts: '300,000', enc: '8, 16, 32, 64', dec: '256, 128, 64', vox: '16.25 × 20 × 8.75 mm', tactile: true },
    d360: { name: 'Deform360', grid: [32, 32, 32], ws: '0.515 × 0.525 × 0.38', pts: '50,000', enc: '8, 16, 32, 64', dec: '320, 160, 80', vox: '16.1 × 16.4 × 11.9 mm', tactile: false }
  };
  const fmt = n => n.toLocaleString('en-US');
  const gs = (g, f = 1) => g.map(v => v / f).join(' × ');
  function derived(d) {
    const tokens = (d.grid[0] / 4) * (d.grid[1] / 4) * (d.grid[2] / 4);
    const t6 = 6 * tokens;
    return { tokens, t6, numel: d.grid[0] * d.grid[1] * d.grid[2] * 8, full: t6 * t6, split: 6 * tokens * tokens + tokens * 36 };
  }
  let ds = DS.aloha;

  /* ---------- text for every part (shown in the side panel and the list) ---------- */
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const PARTS = [
    { id: 'A1', title: '输入点云 Pₜ', sub: '7 × n：坐标、颜色、触觉', html: d => dl([['网络', '无（预处理）'], ['形状', `7 × n，n ≤ ${d.pts}`], ['每个点', 'xyz 3 + RGB 3 + 触觉 1'], ['工作空间', `${d.ws} m`]]) +
      '<p>ALOHA 用三台静态 RealSense D455 和两台腕部 D405。双目图像先用 FoundationStereo 估深度，再反投影到世界坐标系，最后用手工设定的包围盒裁剪。触觉点的位置用关节角做正运动学算出。Deform360 只有物体点云，没有触觉。</p>' +
      guess('场景是我按零件装配任务生成的示意点云，不是数据。橙色点是夹爪上的触觉点。') + src('§3.1 · 附录 C.1 · 表 3') },
    { id: 'A2', title: '稀疏体素化', sub: '同一格里的点取平均', html: () => dl([['网络', '无参数'], ['规则', '落在同一体素的点，特征取平均'], ['存储', '稀疏：只存被占据的体素']]) +
      '<p>体素化之后，后面的稀疏卷积只在被占据的格子上计算，不在空的空间上浪费计算。这样编码器才能吃下几十万个点。</p>' +
      guess('论文没给输入网格的分辨率。图里画成潜变量的 2 倍，即 64 × 32 × 64 格。') + src('§3.2') },
    { id: 'A3', title: '稀疏体素编码器 E_θ', sub: '带步长的稀疏 3D 卷积', html: d => dl([['网络', '带步长的稀疏 3D 卷积'], ['宽度', d.enc.replace(/, /g, ' → ')], ['输出', '8 通道潜变量，逐体素单位归一化']]) +
      '<p>每一级用步长卷积把空间缩小、通道加宽，最后得到 8 通道的潜变量网格。训练时对同一观测抽两份子采样，用同一个编码器分别编码，要求两份潜变量接近。这一项是一致性损失，系数 100（式 7）。</p>' +
      guess('4 个宽度对应几次下采样，最后怎样从 64 通道变成 8 通道，论文都没写。图里的方块只表示“空间变小、通道变多”，不按比例。') + src('§3.2 · 附录 B.1 · 表 3 · 式 (7)') },
    { id: 'A4', title: '3D 潜变量 zₜ', sub: '两个网络唯一共享的东西', html: d => dl([['形状', `${gs(d.grid)} × 8`], ['数量', `${fmt(derived(d).numel)} 个数`], ['每格', d.vox], ['归一化', '每格的 8 维向量长度为 1'], ['训练噪声', 'σ = 0.1']]) +
      '<p>自编码器把它解码成粒子，动力学模型在它上面往前推。图里格子按真实比例画：ALOHA 竖直方向 32 格只对应 0.28 m，所以每一格都是扁的。</p>' +
      guess('稠密网格里没被占据的格子填的是什么，论文没写。图里只画被占据的格子。') + src('附录 B.1 · 表 3 · 精读页读者注 10') },
    { id: 'A5', title: '体素解码器（D_ψ 第一段）', sub: '转置 3D 卷积，逐级预测占据', html: d => dl([['网络', '转置 3D 卷积，逐级上采样'], ['宽度', d.dec.replace(/, /g, ' → ')], ['每级输出', '占据概率，用 BCE 监督'], ['最细一级', '再预测颜色，用 ℓ1 监督']]) +
      '<p>解码器先恢复“哪里有东西”。每一级都预测一次占据，各级损失相加（式 2）。有触觉时还预测触觉占据和触觉值。最细一级被判为占据的体素作为种子，交给粒子头。</p>' +
      guess('三级的分辨率论文没写。图里画成潜变量的 1、2、4 倍。') + src('§3.2 · 附录 B.1 · 式 (2)') },
    { id: 'A6', title: '粒子头 MLP', sub: '每个种子体素 → 带高斯的粒子', html: () => dl([['网络', '轻量 MLP，隐藏宽度 64'], ['阶段', '2 个连续的粒子细化阶段'], ['每个粒子', '连续 3D 位置 + 一个 3D 高斯'], ['高斯参数', '1 阶球谐颜色、各向异性尺度、旋转、不透明度']]) +
      '<p>体素是离散的，粒子头把它变回连续的点。监督用种子邻域内的双向 Chamfer 距离（式 3）。颜色先把每个真实点分给最近的粒子，再用 ℓ1 监督（式 4）。两个阶段都算这两项。</p>' +
      guess('每个体素出几个粒子论文没写。图里画成第一阶段 8 个、第二阶段 32 个。') + src('§3.2 · 附录 B.1 · 表 3 · 式 (3)(4)') },
    { id: 'A7', title: '输出：3D 高斯、点云、触觉', sub: '任意视角渲染 RGB-D', html: () => dl([['渲染', '3D 高斯光栅化，任意相机视角'], ['渲染损失', 'RGB：ℓ1 + SSIM + LPIPS；深度：ℓ1'], ['权重', 'λ_RGB = 4，λ_SSIM = 0.5'], ['训练顺序', '体素部分 10 epoch → 冻结它训粒子/渲染头 10 epoch → 联合']]) +
      '<p>同一个解码结果既是点云，也是一组 3D 高斯，所以能从训练时没有的相机视角渲染图像。视频世界模型只能输出固定视角的画面，做不到这一点。触觉粒子单独输出，只在 ALOHA 上有。腕部相机的画面另外微调了一个预测头。</p>' +
      '<p>图里右上角两张小图是从这个相机渲染出的 RGB 和深度（示意）。</p>' + src('§3.2 · §3.5 · 附录 B.1 · 式 (5)(6)') },
    { id: 'B1', title: '历史队列：5 帧 + 1 个查询槽', sub: '每个历史帧都加噪声', html: d => dl([['输入', 'H = 5 帧潜变量 + 1 个未来查询槽'], ['形状', `6 × ${gs(d.grid)} × 8`], ['历史噪声', '每帧 σ ~ U(0, 0.4)，σ 也作为条件输入']]) +
      '<p>动力学模型看最近 5 帧潜变量，在第 6 个槽里预测下一帧。训练时给每个历史帧加强度不同的高斯噪声（式 10），让模型习惯不干净的历史。开环推理时，历史里本来就是它自己的预测，这一步是为此准备的。</p>' +
      '<p>点“自回归展开一步”可以看到：连续展开 5 步以后，队列里全是模型自己的预测，图中用金色框标出。</p>' +
      guess('噪声最大时向量长度约 1.13，比长度为 1 的信号还长（精读页读者注 11）。') + src('§3.3 · 附录 B.2 · 表 4 · 式 (10)') },
    { id: 'B2', title: '动作条件 MLP', sub: '动作、时间戳、σ → 512 维', html: () => dl([['网络', 'MLP 嵌入，512 维'], ['嵌入内容', '动作 + 相对时间戳 + 历史噪声水平 σ'], ['可选', '每帧 4 个空间动作通道']]) +
      '<p>每个历史帧配它当时的机器人状态或动作，查询槽配要预测那一步的动作。ALOHA 的动作描述由机器人运动学和夹爪状态得到。Deform360 的是每个夹爪的 3D 位置、6D 旋转、开合度和是否存在的标志。</p>' +
      '<p>空间动作通道是每个夹爪一张位置热图、一张按开合度调制的热图，拼在潜变量旁边。不存在的夹爪用全零通道。</p>' +
      guess('“注入各个特征块”具体是相加还是调制（例如 FiLM），论文没写。图里用橙色虚线表示。') + src('附录 B.2 · 表 4') },
    { id: 'B3', title: '逐帧 3D 卷积编码器', sub: '6 个槽共享权重，各自下采样', html: d => dl([['网络', '3D 卷积，核 3³，6 个槽共享权重'], ['宽度', '128 → 256 → 512'], ['空间', `${gs(d.grid)} → ${gs(d.grid, 2)} → ${gs(d.grid, 4)}`]]) +
      '<p>每一帧单独过同一个编码器，时间维保持不动，所以这里帧和帧之间还没有交流。两次下采样后，每个粗格对应 4 × 4 × 4 个潜变量体素，ALOHA 上约 6.5 × 8 × 3.5 cm。</p>' +
      guess('3 个宽度和 3 个分辨率一一对应，是我的理解。表 4 只是分别列出了它们。') + src('附录 B.2 · 表 4') },
    { id: 'B4', title: '分解时空注意力 × 4 对', sub: '空间注意力 ↔ 因果时间注意力', html: d => { const x = derived(d); return dl([['每帧 token', `${fmt(x.tokens)}（${gs(d.grid, 4)}）`], ['一次前向', `6 × ${x.tokens} = ${fmt(x.t6)}`], ['宽度', '8 头 × 64 = 512，FFN 扩展 ×2'], ['结构', 'Pre-LN + 残差，4 对块']]) +
      '<p><b>空间注意力</b>（式 8）：同一帧里所有粗格互相看，学这一帧里东西之间的关系。<b>因果时间注意力</b>（式 9）：同一个粗格位置跨 6 个槽看，只能看自己和更早的槽，学这块地方随时间怎样变。两种交替做 4 对。</p>' +
      '<p>用下方按钮切换，看两种注意力各连到哪些 token。红色是被因果掩码挡掉的更晚的槽。</p>' +
      `<p>这样拆开计算量小很多。如果做完整的时空注意力，每层是 ${fmt(x.t6)}² ≈ ${(x.full / 1e6).toFixed(2)} M 对；拆开后是 6 × ${x.tokens}² + ${x.tokens} × 6² ≈ ${(x.split / 1e6).toFixed(2)} M 对，约为前者的 1/${(x.full / x.split).toFixed(1)}。</p>` + src('附录 B.2 · 表 4 · 式 (8)(9)'); } },
    { id: 'B5', title: '3D 解码器 + 跳连', sub: '放大回潜变量分辨率', html: d => dl([['网络', '共享的 3D 上采样解码器'], ['空间', `${gs(d.grid, 4)} → ${gs(d.grid, 2)} → ${gs(d.grid)}`], ['跳连来源', '最近一个历史帧的编码器特征']]) +
      '<p>解码器把查询槽经过注意力的粗特征放大回潜变量分辨率。查询槽自己没有编码器特征，跳连就借最近一帧的。开环推理时，这一帧可能本身就是之前的预测，所以误差也会沿跳连传下去。任何一步都用不到未来的真实潜变量。</p>' + src('附录 B.2') },
    { id: 'B6', title: '输出 ẑₜ₊₁ 与训练', sub: '接回队尾，或交给 D_ψ 解码', html: d => dl([['形状', `${gs(d.grid)} × 8`], ['每步', '1 次前向'], ['损失', 'K 步折扣 MSE，γ = 0.95（式 1）'], ['优化', 'AdamW，权重衰减 10⁻⁴，梯度裁剪 10'], ['训练', '一张 RTX 5090，约 16 小时']]) +
      '<p>网络直接输出下一帧潜变量。训练时把预测接到历史末尾、丢掉最老的一帧，连续预测 K 步，第 k 步的损失乘 γ^(k−1)，并用课程逐渐加大 K。推理时也这样循环。每一步的 ẑ 都可以送进上排的解码器 D_ψ，得到点云、高斯渲染和触觉。</p>' +
      guess('最终的 K 论文没给。按 γ = 0.95，第 10 步的权重是 0.63，第 50 步只剩 0.08（精读页读者注 1）。') + src('§3.3 · §3.5 · 附录 B.2 · 表 4 · 式 (1)') }
  ];
  const byId = Object.fromEntries(PARTS.map(p => [p.id, p]));

  /* ---------- list and shape table (work without WebGL) ---------- */
  const stepsEl = $('steps');
  PARTS.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" data-id="${p.id}"><span class="k">${p.id}</span>${p.title}<small>${p.sub}</small></button>`;
    stepsEl.appendChild(li);
  });
  function shapeRows(d) {
    const x = derived(d);
    const rows = [
      ['自编码器输入', '点云 Pₜ', `7 × n，n ≤ ${d.pts}`, '§3.1 · 表 3'],
      ['稀疏编码器', '各级宽度', d.enc, '表 3'],
      ['潜变量', 'zₜ', `${gs(d.grid)} × 8 = ${fmt(x.numel)}`, '表 3'],
      ['体素解码器', '各级宽度', d.dec, '表 3'],
      ['粒子头', 'MLP', '隐藏 64，2 个细化阶段', '表 3'],
      ['动力学输入', '5 历史 + 1 查询', `6 × ${gs(d.grid)} × 8`, '表 4'],
      ['动力学编码器', '3 级', `${gs(d.grid)}·128 → ${gs(d.grid, 2)}·256 → ${gs(d.grid, 4)}·512`, '表 4（宽度对应哪级是我的理解）'],
      ['注意力', 'token', `每帧 ${fmt(x.tokens)}，一次前向 ${fmt(x.t6)}`, '表 4'],
      ['注意力', '宽度', '8 头 × 64 = 512，FFN ×2，4 对', '表 4'],
      ['动作嵌入', '向量', '512', '表 4'],
      ['动力学输出', 'ẑₜ₊₁', `${gs(d.grid)} × 8`, '附录 B.2']
    ];
    $('shapeRows').innerHTML = rows.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('');
    $('dsName').textContent = d.name;
  }
  shapeRows(ds);

  let current = -1;
  function showInfo(i) {
    const p = PARTS[i]; current = i;
    $('infoTag').textContent = `${p.id} · ${p.id[0] === 'A' ? '自编码器' : '动力学模型'} · ${ds.name}`;
    $('infoTitle').textContent = p.title;
    $('infoBody').innerHTML = p.html(ds);
    $('stepNo').textContent = `${i + 1} / ${PARTS.length}`;
    stepsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(b.dataset.id === p.id)));
  }

  /* ---------- 3D ---------- */
  let S;
  const asp0 = ($('stage').clientWidth || 1) / ($('stage').clientHeight || 1);
  try { S = L.makeScene($('stage'), { fov: 36, theta: 0, phi: 0.9, dist: 80 * Math.min(2.2, Math.max(1, 1.45 / asp0)), maxDist: 180, target: [0.5, 0, 0.5], minDist: 6 }); }
  catch (e) { $('nogl').hidden = false; }

  const W = 5.2, H = 2.8, D = 3.2; // workspace in scene units: X 0.52 m, Z(up) 0.28 m, Y(depth) 0.32 m, ×10
  const ZA = -6, ZB = 6;            // the two rows
  const r = L.rng(11), g = () => L.gauss(r);

  /* hand-made part-assembly scene: table, two arms with grippers, blue socket, yellow plug, tactile pads */
  function makeCloud() {
    const P = [];
    const add = (x, y, z, c, t = 0) => { if (Math.abs(x) <= W / 2 && Math.abs(y) <= H / 2 && Math.abs(z) <= D / 2) P.push({ p: [x, y, z], c, t }); };
    const jit = (c, a = 0.06) => c.map(v => Math.max(0, Math.min(1, v + a * g())));
    for (let i = 0; i < 2600; i++) add((r() - 0.5) * W, -H / 2 + 0.03 + 0.01 * g(), (r() - 0.5) * D, jit([0.55, 0.47, 0.39]));
    function boxS(cx, cy, cz, sx, sy, sz, n, col, t = 0) {
      for (let i = 0; i < n; i++) {
        const f = Math.floor(r() * 6), u = r() - 0.5, v = r() - 0.5; let x, y, z;
        if (f < 2) { x = (f ? 0.5 : -0.5) * sx; y = u * sy; z = v * sz; } else if (f < 4) { y = (f === 3 ? 0.5 : -0.5) * sy; x = u * sx; z = v * sz; } else { z = (f === 5 ? 0.5 : -0.5) * sz; x = u * sx; y = v * sy; }
        add(cx + x, cy + y, cz + z, jit(col, 0.04), t);
      }
    }
    function capsule(a, b, rad, n, col) {
      for (let i = 0; i < n; i++) {
        const s = r(), th = r() * Math.PI * 2;
        const x = a[0] + (b[0] - a[0]) * s, y = a[1] + (b[1] - a[1]) * s, z = a[2] + (b[2] - a[2]) * s;
        add(x + rad * Math.cos(th), y + rad * Math.sin(th) * 0.4, z + rad * Math.sin(th), jit(col, 0.05));
      }
    }
    const arm = [0.62, 0.64, 0.68];
    capsule([-2.6, 1.3, -0.4], [-1.25, 0.15, 0], 0.13, 700, arm);
    capsule([2.6, 1.3, 0.5], [1.25, 0.25, 0.1], 0.13, 700, arm);
    for (const [gx, gy, gz] of [[-1.2, -0.15, 0], [1.2, -0.05, 0.1]]) {
      boxS(gx, gy + 0.25, gz, 0.34, 0.16, 0.3, 160, [0.3, 0.32, 0.36]);
      for (const s of [-1, 1]) {
        boxS(gx, gy - 0.05, gz + s * 0.17, 0.12, 0.42, 0.05, 90, [0.35, 0.37, 0.4]);
        boxS(gx, gy - 0.08, gz + s * 0.13, 0.1, 0.3, 0.015, 70, [1.0, 0.55, 0.15], 1); // tactile pad on the inner face
      }
    }
    boxS(-1.2, -0.55, 0, 0.42, 0.38, 0.22, 650, [0.18, 0.42, 0.92]);
    for (let i = 0; i < 380; i++) { const th = r() * Math.PI * 2, s = r(); add(0.65 + s * 0.5, -0.38 + 0.08 * Math.cos(th), 0.1 + 0.08 * Math.sin(th), jit([0.96, 0.8, 0.24], 0.04)); }
    return P;
  }
  const CLOUD = makeCloud();

  function occupy(nx, ny, nz) {
    const m = new Map();
    for (const q of CLOUD) {
      const i = Math.min(nx - 1, Math.floor((q.p[0] / W + 0.5) * nx)), j = Math.min(ny - 1, Math.floor((q.p[1] / H + 0.5) * ny)), k = Math.min(nz - 1, Math.floor((q.p[2] / D + 0.5) * nz));
      const key = (i * 512 + j) * 512 + k; let e = m.get(key);
      if (!e) { e = { i, j, k, c: [0, 0, 0], n: 0, t: 0 }; m.set(key, e); }
      e.c[0] += q.c[0]; e.c[1] += q.c[1]; e.c[2] += q.c[2]; e.n++; e.t += q.t;
    }
    return [...m.values()].map(e => ({ i: e.i, j: e.j, k: e.k, c: e.c.map(v => v / e.n), t: e.t > 0 }));
  }
  /* a feature colour for latent cells: blue, with a pseudo-random shade standing in for the 8 channels */
  const latentRGB = c => { const h = ((c.i * 73856093) ^ (c.j * 19349663) ^ (c.k * 83492791)) >>> 0; const s = 0.55 + 0.45 * ((h % 1000) / 1000); return [0.13 * s + 0.05, 0.5 * s + 0.12, 0.85 * s + 0.12]; };
  function voxMesh(cells, nx, ny, nz, colorFn, o = {}) {
    const sx = W / nx, sy = H / ny, sz = D / nz, f = o.fill ?? 0.84;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(sx * f, sy * f, sz * f), L.mat(0xffffff, { roughness: 0.7, opacity: o.opacity }), cells.length);
    const M = new THREE.Matrix4(), col = new THREE.Color();
    cells.forEach((c, n) => { M.makeTranslation((c.i + 0.5) * sx - W / 2, (c.j + 0.5) * sy - H / 2, (c.k + 0.5) * sz - D / 2); im.setMatrixAt(n, M); col.setRGB(...colorFn(c)); im.setColorAt(n, col); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    return im;
  }
  function wireBox(w, h, d, color, opacity = 0.5, dashed = false) {
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
    const m = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const l = new THREE.LineSegments(geo, m); if (dashed) l.computeLineDistances(); return l;
  }
  /* labels keep a near-constant size on screen: their world scale follows the camera distance (see onTick) */
  let LABELS = [];
  const lab = (text, pos, o = {}) => { const sp = L.label(text, { scale: o.scale || 0.019, size: o.size || 28, pos, color: o.color, border: o.border, bg: o.bg }); sp.userData.s0 = sp.scale.clone(); sp.userData.big = (o.scale || 0.019) >= 0.018; LABELS.push(sp); return sp; };

  const comps = {};
  function comp(id, x, z, y = 0) {
    const grp = new THREE.Group(); grp.position.set(x, y, z); grp.userData.comp = id; S.scene.add(grp);
    comps[id] = { grp, center: new THREE.Vector3(x, y, z) }; return grp;
  }
  function title(grp, id, sub, y = 2.5) {
    grp.add(lab(`${id}  ${byId[id].title}`, [0, y + 0.25, 0], { scale: 0.026, border: 'rgba(56,209,255,.55)' }));
    if (sub) grp.add(lab(sub, [0, y - 0.6, 0], { scale: 0.018, size: 24, color: '#b9c4da' }));
  }
  function slices(grp, x, w, h, d, n, color, gap) { // channel slices: more slices = more channels
    for (let s = 0; s < n; s++) { const b = L.box(0.05, h, d, color, { opacity: 0.32 + 0.5 * (s / n), edgeOpacity: 0.5 }); b.position.set(x + (s - (n - 1) / 2) * gap, 0, 0); grp.add(b); }
    const fr = wireBox(w, h, d, color, 0.7); fr.position.x = x; grp.add(fr);
  }

  if (S) build();

  function build() {
    const lat = occupy(32, 32, 16); // ALOHA latent: X 32, Z(up) 32, Y(depth) 16
    const floor = L.grid(76, 38); floor.material.opacity = 0.16; floor.position.y = -2.2; S.scene.add(floor);
    S.scene.add(lab('上排 · 自编码器：点云 ⇄ 3D 潜变量（先训练，之后冻结）', [0, 6.2, ZA - 1.5], { scale: 0.03, size: 30, color: '#38d1ff', bg: 'rgba(12,18,32,.55)' }));
    S.scene.add(lab('下排 · 动力学模型：在潜空间里按动作往前推一步', [0, -3.4, ZB + 5.2], { scale: 0.03, size: 30, color: '#d45fa0', bg: 'rgba(12,18,32,.55)' }));

    /* A1 input point cloud */
    let G = comp('A1', -26, ZA);
    const pos = new Float32Array(CLOUD.length * 3), cols = new Float32Array(CLOUD.length * 3);
    CLOUD.forEach((q, i) => { pos.set(q.p, i * 3); cols.set(q.t ? [1, 0.55, 0.15] : q.c, i * 3); });
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.055, vertexColors: true, transparent: true, opacity: 1 }));
    G.add(pts, wireBox(W, H, D, COL.pts, 0.45));
    G.add(new THREE.Mesh(new THREE.BoxGeometry(W, H, D), new THREE.MeshBasicMaterial({ visible: false }))); // pick target
    title(G, 'A1', '7 × n · xyz + RGB + 触觉');

    /* A2 voxelisation (input grid drawn at 2× latent resolution) */
    G = comp('A2', -18, ZA);
    G.add(voxMesh(occupy(64, 64, 32), 64, 64, 32, c => (c.t ? [1, 0.55, 0.15] : c.c)), wireBox(W, H, D, COL.pts, 0.35));
    title(G, 'A2', '稀疏网格 · 只存占据格 · 分辨率示意');

    /* A3 sparse encoder: four stages, each smaller in space and wider in channels */
    G = comp('A3', -9.5, ZA);
    [[8, 1.0, 2], [16, 0.8, 3], [32, 0.62, 4], [64, 0.48, 5]].forEach(([w, s, n], i) => slices(G, -2.6 + i * 1.75, 0.35 + n * 0.11, H * s, D * s, n, COL.enc, 0.11));
    ['8', '16', '32', '64'].forEach((w, i) => G.add(lab(`宽 ${w}`, [-2.6 + i * 1.75, -1.85, 0], { scale: 0.013, size: 24 })));
    G.add(L.arrow([3.4, 0, 0], [4.4, 0, 0], COL.lat));
    G.add(lab('→ 8 通道\n‖z‖ = 1', [3.9, 0.8, 0], { scale: 0.013, size: 22 }));
    title(G, 'A3', '带步长稀疏 3D 卷积 · 级数示意');

    /* A4 latent z_t, true anisotropic cell sizes */
    G = comp('A4', 0, ZA);
    G.add(voxMesh(lat, 32, 32, 16, latentRGB), wireBox(W, H, D, COL.lat, 0.6));
    for (let c = 0; c < 8; c++) { const b = L.box(0.26, 0.26, 0.26, new THREE.Color().setHSL(0.56 + c * 0.012, 0.75, 0.32 + c * 0.05).getHex()); b.position.set(-0.91 + c * 0.26, 1.85, 0); G.add(b); }
    title(G, 'A4', '32 × 16 × 32 × 8 · 每格 8 维', 2.95);

    /* A5 voxel decoder: three occupancy levels */
    G = comp('A5', 9.6, ZA);
    [[32, 32, 16, c => [0.25, 0.7, 0.45]], [64, 64, 32, c => [0.3, 0.78, 0.52]], [128, 128, 64, c => c.c]].forEach(([nx, ny, nz, fn], i) => {
      const sub = new THREE.Group(); sub.scale.setScalar(0.56); sub.position.x = -3.2 + i * 3.2;
      sub.add(voxMesh(occupy(nx, ny, nz), nx, ny, nz, fn), wireBox(W, H, D, COL.dec, 0.6)); G.add(sub);
      G.add(lab(['占据 ×1', '占据 ×2', '占据 ×4 + 颜色'][i], [-3.2 + i * 3.2, -1.3, 0], { scale: 0.013, size: 24 }));
      if (i < 2) G.add(L.arrow([-1.75 + i * 3.2, 0, 0], [-1.3 + i * 3.2, 0, 0], COL.dec, { head: 0.2, headW: 0.14 }));
    });
    title(G, 'A5', '转置 3D 卷积 · 宽 256 → 128 → 64');

    /* A6 particle head: seed voxel → stage 1 → stage 2, plus a small MLP icon */
    G = comp('A6', 18.6, ZA);
    const cube = 1.25;
    [0, 1, 2].forEach(i => {
      const x = -2.4 + i * 2.4; const wb = wireBox(cube, cube * 0.6, cube * 0.8, COL.gau, 0.7); wb.position.set(x, -0.4, 0); G.add(wb);
      const n = [1, 8, 32][i];
      for (let k = 0; k < n; k++) {
        const sp = L.sphere(i ? (i === 1 ? 0.09 : 0.065) : 0.16, i ? COL.gau : COL.dec, { seg: 10 });
        if (i) { sp.scale.set(1 + 0.8 * r(), 0.5 + 0.5 * r(), 1 + 0.6 * r()); sp.rotation.set(r() * 3, r() * 3, r() * 3); sp.position.set(x + (r() - 0.5) * cube * 0.85, -0.4 + (r() - 0.5) * cube * 0.5, (r() - 0.5) * cube * 0.7); }
        else sp.position.set(x, -0.4, 0);
        G.add(sp);
      }
      G.add(lab(['种子体素', '细化 1', '细化 2'][i], [x, -1.35, 0], { scale: 0.013, size: 24 }));
    });
    const layers = [3, 5, 5, 3], nodes = [];
    layers.forEach((n, li) => { for (let k = 0; k < n; k++) { const s = L.sphere(0.07, COL.dec, { seg: 8 }); s.position.set(-0.9 + li * 0.6, 0.85 + (k - (n - 1) / 2) * 0.22, 0); G.add(s); nodes.push([li, s.position.clone()]); } });
    for (const [la, pa] of nodes) for (const [lb, pb] of nodes) if (lb === la + 1) G.add(L.line([pa, pb], COL.dec, { opacity: 0.35 }));
    G.add(lab('MLP · 隐藏 64', [1.4, 0.95, 0], { scale: 0.013, size: 24 }));
    title(G, 'A6', '每粒子：位置 + 3D 高斯', 2.25);

    /* A7 outputs: Gaussians, camera, rendered RGB / depth tiles */
    G = comp('A7', 28, ZA);
    const sub = CLOUD.filter((_, i) => i % 6 === 0);
    const eg = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), L.mat(0xffffff, { roughness: 0.5 }), sub.length);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), col = new THREE.Color();
    sub.forEach((p, i) => { e.set(r() * 3, r() * 3, r() * 3); q.setFromEuler(e); sc.set(0.05 + 0.06 * r(), 0.03 + 0.03 * r(), 0.05 + 0.05 * r()); M.compose(new THREE.Vector3(...p.p), q, sc); eg.setMatrixAt(i, M); col.setRGB(...(p.t ? [1, 0.55, 0.15] : p.c)); eg.setColorAt(i, col); });
    eg.instanceMatrix.needsUpdate = true; if (eg.instanceColor) eg.instanceColor.needsUpdate = true;
    G.add(eg, wireBox(W, H, D, COL.gau, 0.35));
    const camP = new THREE.Vector3(3.6, 2.2, 3.4);
    const camBody = L.box(0.5, 0.36, 0.36, 0x9aa6bf); camBody.position.copy(camP); camBody.lookAt(0, 0, 0); G.add(camBody);
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) G.add(L.line([camP, new THREE.Vector3(u * 1.6, v * 1.0 - 0.2, 0.4)], COL.gau, { opacity: 0.45, dashed: true }));
    function tile(kind) {
      const cv = document.createElement('canvas'); cv.width = 192; cv.height = 112; const x = cv.getContext('2d');
      x.fillStyle = kind === 'rgb' ? '#20283a' : '#000'; x.fillRect(0, 0, 192, 112);
      const proj = [...CLOUD].sort((a, b) => a.p[2] - b.p[2]); // back to front
      for (const p of proj) {
        const u = (p.p[0] / W + 0.5) * 192, v = (0.5 - p.p[1] / H) * 112 * 0.92 + 4 + p.p[2] * 6;
        if (kind === 'rgb') { const c = p.t ? [1, 0.55, 0.15] : p.c; x.fillStyle = `rgb(${c.map(k => Math.round(k * 255)).join(',')})`; }
        else { const dd = Math.round(255 * (0.25 + 0.6 * (p.p[2] / D + 0.5))); x.fillStyle = `rgb(${dd},${dd},${dd})`; }
        x.fillRect(u, v, 2, 2);
      }
      const t = new THREE.CanvasTexture(cv);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.92, 1.12), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }));
      return m;
    }
    const t1 = tile('rgb'), t2 = tile('depth'); t1.position.set(1.4, 3.15, 1.2); t2.position.set(3.5, 3.15, 1.2); G.add(t1, t2);
    G.add(lab('渲染 RGB', [1.4, 2.35, 1.2], { scale: 0.012, size: 22 }), lab('渲染深度', [3.5, 2.35, 1.2], { scale: 0.012, size: 22 }));
    title(G, 'A7', '点云 · 3D 高斯 · 触觉粒子', 4.6);

    /* ---------- dynamics row ---------- */
    const slotX = k => -30 + k * 2.5;
    G = comp('B1', -23.75, ZB);
    const slabs = [];
    function latentSlab() {
      const s = new THREE.Group(); s.scale.setScalar(0.42);
      s.add(voxMesh(lat, 32, 32, 16, latentRGB), wireBox(W, H, D, COL.lat, 0.6));
      const gold = wireBox(W * 1.06, H * 1.1, D * 1.06, COL.gau, 1); gold.visible = false; s.add(gold); s.userData.gold = gold;
      return s;
    }
    for (let k = 0; k < 5; k++) { const s = latentSlab(); s.position.x = slotX(k) + 23.75; G.add(s); slabs.push(s); }
    const qslot = wireBox(W * 0.42, H * 0.42, D * 0.42, COL.lat, 0.9, true); qslot.position.x = slotX(5) + 23.75; G.add(qslot);
    ['z(t−4)', 'z(t−3)', 'z(t−2)', 'z(t−1)', 'z(t)', '查询槽'].forEach((t, k) => G.add(lab(t, [slotX(k) + 23.75, -1.05, 0], { scale: 0.012, size: 24 })));
    G.add(lab('每帧加噪 σ ~ U(0, 0.4)', [-2.5, -1.75, 0], { scale: 0.012, size: 22, color: '#b9c4da' }));
    title(G, 'B1', '6 槽 × 32 × 16 × 32 × 8', 1.75);
    const rollLabel = lab('已展开 0 步', [3.75, -1.75, 0], { scale: 0.012, size: 22, color: '#f2c14e' }); G.add(rollLabel);

    /* B2 action MLP above the queue */
    G = comp('B2', -23.75, ZB, 4.3);
    for (let k = 0; k < 6; k++) for (let j = 0; j < 4; j++) { const b = L.box(0.16, 0.16, 0.16, COL.act, { opacity: 0.55 + 0.1 * j }); b.position.set(slotX(k) + 23.75, -1.5 + j * 0.2, 0); G.add(b); }
    const mlp = L.box(3.2, 0.7, 0.8, COL.act, { opacity: 0.85 }); mlp.position.set(0, 0.35, 0); G.add(mlp);
    G.add(lab('MLP：动作 + 时间戳 + σ → 512', [0, 1.15, 0], { scale: 0.014, size: 24 }));
    G.add(lab('B2  动作条件', [0, 1.9, 0], { scale: 0.026, border: 'rgba(240,150,60,.7)' }));

    /* B3 per-frame encoder pyramid */
    G = comp('B3', -10.8, ZB);
    [[-2.0, 2.4, 3, 128], [0.2, 1.2, 5, 256], [1.75, 0.6, 7, 512]].forEach(([x, s, n, w]) => {
      slices(G, x, 0.2 + n * 0.09, s, s / 2 * 1.0, n, COL.enc, 0.09);
      G.add(lab(`${w}`, [x, -1.5, 0], { scale: 0.012, size: 22 }));
    });
    G.add(lab('32×16×32 → 16×8×16 → 8×4×8', [0, -2.0, 0], { scale: 0.012, size: 22, color: '#b9c4da' }));
    title(G, 'B3', '3D 卷积 · 6 槽共享权重', 2.0);

    /* B4 factorised attention over 6 slots × 8×4×8 tokens */
    G = comp('B4', 2.25, ZB);
    const TX = 8, TY = 8, TZ = 4, NT = TX * TY * TZ, sp = 0.25, slotW = 2.3;
    const tokPos = [];
    for (let s = 0; s < 6; s++) for (let i = 0; i < TX; i++) for (let j = 0; j < TY; j++) for (let k = 0; k < TZ; k++)
      tokPos.push(new THREE.Vector3(-5.75 + s * slotW + (i - 3.5) * sp, (j - 3.5) * sp * 0.6, (k - 1.5) * sp * 1.6));
    const tok = new THREE.InstancedMesh(new THREE.SphereGeometry(0.065, 8, 6), L.mat(0xffffff, { roughness: 0.5 }), tokPos.length);
    tokPos.forEach((p, n) => { M.makeTranslation(p.x, p.y, p.z); tok.setMatrixAt(n, M); });
    tok.instanceMatrix.needsUpdate = true;
    G.add(tok);
    for (let s = 0; s < 6; s++) { const f = wireBox(TX * sp + 0.1, TY * sp * 0.6 + 0.1, TZ * sp * 1.6 + 0.1, s === 5 ? COL.gau : COL.attn, 0.4, s === 5); f.position.x = -5.75 + s * slotW; G.add(f); G.add(lab(s === 5 ? '查询' : `t−${4 - s}`.replace('t−0', 't'), [-5.75 + s * slotW, -1.35, 0], { scale: 0.012, size: 22 })); }
    const attnLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COL.attn, transparent: true, opacity: 0.35 }));
    attnLines.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NT * 6 * 2 * 3), 3));
    G.add(attnLines);
    title(G, 'B4', '4 对 × [空间 → 因果时间] · 8 头 × 64', 2.0);
    let attnCap = null; const GB4 = G;
    const tid = (s, v) => s * NT + v;
    let attnMode = 'spatial';
    function drawAttn() {
      const s = attnMode === 'spatial' ? Math.floor(r() * 6) : [5, 5, 4, 3][Math.floor(r() * 4)], v = Math.floor(r() * NT);
      const c = new THREE.Color(), arr = attnLines.geometry.attributes.position.array; let n = 0;
      const push = (a, b) => { arr.set([a.x, a.y, a.z, b.x, b.y, b.z], n * 6); n++; };
      for (let t = 0; t < 6; t++) for (let u = 0; u < NT; u++) {
        let hex = 0x3b4660;
        if (attnMode === 'spatial') { if (t === s) { hex = COL.attn; if (u !== v) push(tokPos[tid(s, v)], tokPos[tid(t, u)]); } }
        else if (u === v) { if (t <= s) { hex = COL.attn; if (t !== s) push(tokPos[tid(s, v)], tokPos[tid(t, u)]); } else hex = COL.mask; }
        if (t === s && u === v) hex = 0xffffff;
        tok.setColorAt(tid(t, u), c.setHex(hex));
        const big = hex !== 0x3b4660 && !(attnMode === 'spatial' && hex === COL.attn), p = tokPos[tid(t, u)];
        M.makeScale(big ? 1.9 : 1, big ? 1.9 : 1, big ? 1.9 : 1).setPosition(p.x, p.y, p.z); tok.setMatrixAt(tid(t, u), M);
      }
      attnLines.geometry.setDrawRange(0, n * 2); attnLines.geometry.attributes.position.needsUpdate = true;
      attnLines.material.opacity = (attnMode === 'spatial' ? 0.12 : 0.9) * (attnLines.material.userData.k ?? 1);
      tok.instanceColor.needsUpdate = true; tok.instanceMatrix.needsUpdate = true;
      if (attnCap) { GB4.remove(attnCap); L.dispose(attnCap); }
      attnCap = lab(attnMode === 'spatial' ? `空间：槽 ${s === 5 ? '查询' : 't−' + (4 - s)} 内 ${NT} 个 token 互相看` : `因果时间：${s === 5 ? '查询槽' : '槽 t−' + (4 - s)} 的这个位置只看自己和更早的槽（红 = 被遮挡）`, [0, -1.9, 0], { scale: 0.012, size: 22, color: '#f5b8dc' });
      GB4.add(attnCap);
    }
    drawAttn();

    /* B5 decoder pyramid with skip connections */
    G = comp('B5', 14.2, ZB);
    [[-1.75, 0.6, 7], [-0.2, 1.2, 5], [2.0, 2.4, 3]].forEach(([x, s, n]) => slices(G, x, 0.2 + n * 0.09, s, s / 2, n, COL.dec, 0.09));
    title(G, 'B5', '上采样回 32 × 16 × 32 · 跳连', 2.0);
    [[-12.8, 1.2], [-10.6, 0.6], [-9.05, 0.3]].forEach(([x0, h], i) => {
      const x1 = [16.2, 14.0, 12.45][i];
      S.scene.add(L.line([[x0, h + 0.1, ZB - 0.9], [x0 + 3, 3.4 + i * 0.35, ZB - 1.6], [x1 - 3, 3.4 + i * 0.35, ZB - 1.6], [x1, h + 0.1, ZB - 0.9]].map(p => new THREE.Vector3(...p)), COL.enc, { dashed: true, opacity: 0.6 }));
    });
    S.scene.add(lab('跳连：用最近一个历史帧的特征', [2.25, 4.35, ZB - 1.6], { scale: 0.013, size: 22, color: '#c9c0ff' }));

    /* B6 output latent */
    G = comp('B6', 21.6, ZB);
    const outSlab = latentSlab(); G.add(outSlab);
    title(G, 'B6', '1 次前向 = 1 步', 1.75);
    G.add(lab('ẑ(t+1)', [0, -1.05, 0], { scale: 0.012, size: 24 }));

    /* conditioning lines from the action MLP into every block */
    for (const x of [-10.8, 2.25, 14.2]) S.scene.add(L.line([new THREE.Vector3(-23.75, 4.3, ZB), new THREE.Vector3(x, 3.0, ZB + 0.9), new THREE.Vector3(x, 1.3, ZB + 0.9)], COL.act, { dashed: true, opacity: 0.75 }));

    /* data-flow rails, drawn as tubes with moving dots */
    const flows = [];
    function flow(points, color, o = {}) {
      const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, o.r || 0.035, 6, false), L.mat(color, { opacity: 0.35 })); S.scene.add(m);
      const n = o.n || 14, pg2 = new THREE.BufferGeometry(); pg2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const dots = new THREE.Points(pg2, new THREE.PointsMaterial({ color, size: 0.28, transparent: true, opacity: 0.95 })); S.scene.add(dots);
      flows.push({ curve, dots, n, speed: o.speed || 0.0016 });
      if (o.text) S.scene.add(lab(o.text, o.textPos, { scale: 0.013, size: 22, color: o.textColor || '#e6ecf7' }));
    }
    const yr = -1.75;
    flow([[-28.6, yr, ZA], [-15, yr, ZA], [0, yr, ZA], [15, yr, ZA], [25.4, yr, ZA]], COL.pts, { n: 26 });
    flow([[-17.4, yr, ZB], [-10, yr, ZB], [2, yr, ZB], [14, yr, ZB], [20.4, yr, ZB]], COL.attn, { n: 22 });
    flow([[0, -1.45, ZA + 1.6], [-4, -2.0, -1], [-14, -2.0, 3.5], [-19.75, -1.3, ZB - 0.7]], COL.lat, { n: 10, text: '编码得到的 zₜ 进队列', textPos: [-9, -1.45, 0.4] });
    flow([[21.6, -1.3, ZB + 0.8], [12, -2.0, ZB + 4], [-10, -2.0, ZB + 4], [-17.5, -1.3, ZB + 0.8]], COL.gau, { n: 18, speed: 0.0011, text: '自回归：ẑ 接到队尾，丢掉最老一帧', textPos: [2, -1.45, ZB + 4.2], textColor: '#f2c14e' });
    flow([[21.6, -1.3, ZB - 0.8], [17, -2.0, 1], [11, -1.45, ZA + 1.6]], COL.dec, { n: 10, text: '任一步都可用 D_ψ 解码', textPos: [19, -1.45, 0.2] });

    /* training losses (toggle) */
    const losses = new THREE.Group(); losses.visible = false; S.scene.add(losses);
    [['L_cons：两份子采样编码 → ℓ2（式 7）', [-5, 3.5, ZA]], ['L_voxel：各级占据 BCE（式 2）', [9.6, 3.5, ZA]], ['L_particle：局部 Chamfer + 颜色 ℓ1（式 3、4）', [18.6, 3.5, ZA]],
     ['L_render：ℓ1 + SSIM + LPIPS，深度 ℓ1（式 5、6）', [28, 5.6, ZA]], ['L_dyn：Σ γ^(k−1)‖ẑ − z‖²，γ = 0.95（式 1）', [21.6, 3.1, ZB]]]
      .forEach(([t, p]) => losses.add(lab(t, p, { scale: 0.014, size: 24, color: '#ffd3c4', border: 'rgba(255,122,89,.85)', bg: 'rgba(40,14,10,.82)' })));
    $('loss').addEventListener('change', e => { losses.visible = e.target.checked; });

    /* ---------- focus, picking, camera ---------- */
    const pickables = Object.values(comps).map(c => c.grp);
    function eachMat(obj, f) { obj.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => f(m, o)); }); }
    pickables.forEach(gp => eachMat(gp, m => { if (m.userData.base == null) { m.userData.base = m.opacity; m.userData.tr = m.transparent; } }));
    function focus(id) {
      for (const [k, c] of Object.entries(comps)) eachMat(c.grp, (m, o) => {
        if (m.userData.base == null) { m.userData.base = m.opacity; m.userData.tr = m.transparent; }
        const dim = id && k !== id && !(id === 'B1' && k === 'B2') ? (o.isSprite ? 0.35 : 0.14) : 1;
        m.opacity = m.userData.base * dim; m.transparent = dim < 1 || m.userData.tr; m.depthWrite = dim === 1;
        if (m === attnLines.material) m.userData.k = dim;
      });
      attnLines.material.opacity = (attnMode === 'spatial' ? 0.12 : 0.9) * (attnLines.material.userData.k ?? 1);
    }
    let tw = null;
    function fly(th, ph, d, tg) {
      let dth = th - S.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth));
      const el = $('stage'), asp = (el.clientWidth || 1) / (el.clientHeight || 1); d *= Math.min(2.2, Math.max(1, 1.45 / asp)); // narrow screens: step back so the part fits across
      tw = { k: 0, from: [S.theta, S.phi, S.dist, S.target.clone()], to: [S.theta + dth, ph, d, new THREE.Vector3(...tg)] };
      if (L.reduced()) tw.k = 0.999;
    }
    const VIEWS = { all: [0, 0.9, 80, [0.5, 0, 0.5]], ae: [0, 1.0, 46, [1, 0.5, ZA]], dyn: [0, 1.0, 46, [-2, 0.5, ZB]] };
    function select(id) {
      const i = PARTS.findIndex(p => p.id === id); if (i < 0) return;
      showInfo(i); focus(id);
      const c = comps[id].center, d = { A7: 15, B4: 17, B1: 16, A5: 15, B3: 12, B5: 12 }[id] || 12;
      fly(0.32, 1.02, d, [c.x, c.y + 0.6, c.z]);
      document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    }
    S.onClick(pickables, hit => {
      let o = hit && hit.object; while (o && !o.userData.comp) o = o.parent;
      if (o) select(o.userData.comp); else { focus(null); }
    });
    const tip = $('hover');
    S.onHover(pickables, (hit, e) => {
      let o = hit && hit.object; while (o && !o.userData.comp) o = o.parent;
      $('stage').style.cursor = o ? 'pointer' : '';
      if (!o) { tip.hidden = true; return; }
      const rc = $('stage').getBoundingClientRect();
      tip.textContent = `${o.userData.comp} · ${byId[o.userData.comp].title}`; tip.hidden = false;
      tip.style.left = (e.clientX - rc.left) + 'px'; tip.style.top = (e.clientY - rc.top) + 'px';
    });
    $('stage').addEventListener('pointerleave', () => { tip.hidden = true; });

    document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      current = -1; focus(null); fly(...VIEWS[b.dataset.view]);
    }));
    document.querySelectorAll('[data-attn]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('[data-attn]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      attnMode = b.dataset.attn; attnT = 0; drawAttn(); focus(current >= 0 ? PARTS[current].id : null);
    }));
    $('prev').addEventListener('click', () => select(PARTS[(current - 1 + PARTS.length) % PARTS.length].id));
    $('next').addEventListener('click', () => select(PARTS[(current + 1) % PARTS.length].id));
    stepsEl.addEventListener('click', e => {
      const b = e.target.closest('button[data-id]'); if (!b) return; select(b.dataset.id);
      if (!document.body.classList.contains('embed')) $('stage').scrollIntoView({ behavior: L.reduced() ? 'auto' : 'smooth', block: 'center' });
    });

    /* autoregressive roll: every slab moves one slot left, the oldest drops out, ẑ becomes the newest history frame */
    let rolled = 0, roll = null;
    $('roll').addEventListener('click', () => { if (!roll) roll = { k: 0 }; });
    function setRollLabel() {
      const gB = comps.B1.grp; gB.remove(rollLabelRef.v); L.dispose(rollLabelRef.v);
      rollLabelRef.v = lab(`已展开 ${rolled} 步${rolled >= 5 ? ' · 历史全是预测' : ''}`, [3.75, -1.75, 0], { scale: 0.012, size: 22, color: '#f2c14e' }); gB.add(rollLabelRef.v);
    }
    const rollLabelRef = { v: rollLabel };
    const outWorld = new THREE.Vector3(21.6, 0, ZB), b1 = comps.B1.center;
    const ghost = latentSlab(); ghost.visible = false; S.scene.add(ghost);

    let attnT = 0;
    let lastD = -1;
    S.onTick(t => {
      if (Math.abs(S.dist - lastD) > 0.05 || t % 240 === 0) { lastD = S.dist; const fb = Math.max(0.32, Math.min(1.15, S.dist / 62)), fs = Math.max(0.85, Math.min(1.25, S.dist / 24)); LABELS = LABELS.filter(sp => sp.parent); for (const sp of LABELS) sp.scale.copy(sp.userData.s0).multiplyScalar(sp.userData.big ? fb : fs); }
      for (const f of flows) { const a = f.dots.geometry.attributes.position.array; for (let i = 0; i < f.n; i++) { const p = f.curve.getPointAt(((t * f.speed) + i / f.n) % 1); a[i * 3] = p.x; a[i * 3 + 1] = p.y; a[i * 3 + 2] = p.z; } f.dots.geometry.attributes.position.needsUpdate = true; }
      if (++attnT > 110 && !L.reduced()) { attnT = 0; drawAttn(); }
      if (tw) { tw.k = Math.min(1, tw.k + 0.03); const e2 = L.ease(tw.k), [a, b] = [tw.from, tw.to];
        S.setView(L.lerp(a[0], b[0], e2), L.lerp(a[1], b[1], e2), L.lerp(a[2], b[2], e2), a[3].clone().lerp(b[3], e2).toArray()); if (tw.k >= 1) tw = null; }
      if (roll) {
        roll.k = Math.min(1, roll.k + (L.reduced() ? 1 : 0.02)); const e3 = L.ease(roll.k);
        slabs.forEach((s, k) => { s.position.x = slotX(k) + 23.75 - 2.5 * e3; if (k === 0) s.scale.setScalar(0.42 * (1 - e3)); });
        ghost.visible = true;
        ghost.position.set(L.lerp(outWorld.x, slotX(4), e3), Math.sin(Math.PI * e3) * 3, L.lerp(outWorld.z, b1.z, e3));
        if (roll.k >= 1) {
          roll = null; rolled++; ghost.visible = false;
          slabs.forEach((s, k) => { s.position.x = slotX(k) + 23.75; s.scale.setScalar(0.42); s.userData.gold.visible = k >= 5 - Math.min(5, rolled); });
          setRollLabel();
        }
      }
    });

    /* dataset switch changes the text only; geometry stays ALOHA */
    document.querySelectorAll('[data-ds]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('[data-ds]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      ds = DS[b.dataset.ds]; shapeRows(ds); if (current >= 0) showInfo(current);
    }));
    window.__lab = { select, comps, focus };
    const want = new URLSearchParams(location.search).get('part');
    if (want && byId[want]) { select(want); if (tw) tw.k = 0.999; }
    const wantAttn = new URLSearchParams(location.search).get('attn'); if (wantAttn) document.querySelector(`[data-attn="${wantAttn}"]`)?.click();
  }

  /* without WebGL the list still fills the panel */
  if (!S) {
    stepsEl.addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (b) showInfo(PARTS.findIndex(p => p.id === b.dataset.id)); });
    $('prev').addEventListener('click', () => showInfo((current - 1 + PARTS.length) % PARTS.length));
    $('next').addEventListener('click', () => showInfo((current + 1) % PARTS.length));
    document.querySelectorAll('[data-ds]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('[data-ds]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      ds = DS[b.dataset.ds]; shapeRows(ds); if (current >= 0) showInfo(current);
    }));
  }
})();
