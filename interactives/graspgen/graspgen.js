'use strict';
/* GraspGen (arXiv 2507.13097) taken apart into eleven animated scenes. Tensor sizes come from the official code at commit
   2dd8852 (generator.py, discriminator.py, model_utils.py, ptv3.py, runs/*.sh). Bars with paper numbers come from Fig. 3, 4, 6,
   Table 1. Scenes 5 to 11 run a real toy in this page: a small noise net and classifier trained with hand-written backprop.
   Every scene exposes update(p), a pure function of the timeline p in [0,1]; training happens once and is cached. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { obj: 0x7cb8ff, enc: 0x38d1ff, gen: 0x4fc98a, dis: 0xf0963c, sim: 0x8e9bb8, noise: 0xd45fa0, grad: 0xff7a59, ok: 0x4fc98a, col: 0xff5d5d, far: 0xf2c14e, ang: 0x9d8cff, plan: 0x9d8cff, time: 0xf2c14e };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const WHY = { ok: COL.ok, collide: COL.col, far: COL.far, angle: COL.ang, arc: COL.ang };
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toy = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  const SCENES = [
    { n: 1, part: '总览', title: '推理一条线，训练另一条线', sub: '点击方块跳到对应的一幕', dur: 13, cam: [0.03, 0.86, 37, [0, 1.8, 0.4]],
      html: dl([['输入', '分割后的物体点云 [1, N, 3]'], ['生成', 'B 个候选，每个 6 维（3 平移 + 3 轴角）'], ['打分', '每个候选一个 sigmoid 分数 [B, 1]'], ['下游', 'top-100 交给 cuRobo 过滤与规划']]) +
        '<p>前排是部署时走的路：点云经 PTv3 变成一个 512 维向量，扩散头去噪 10 步，得到 B 个抓取，判别器打分排序，运动规划器从高分候选里找一个可达、无碰撞的。</p>' +
        '<p>后排是论文算法 1 的训练配方：算 κ，训练生成器，用生成器在训练物体上采样，把样本放进仿真贴标签，再训练判别器。这一条线里 <b>判别器的梯度不回到生成器</b>。</p>' + src('§3 · 图 2 · 算法 1 · §4.5') },
    { n: 2, part: '输入', title: '分割、部分点云、去均值、乘 κ', sub: '可切换单视角 / 完整 / 带分割误差', dur: 14, cam: [0.5, 1.0, 15, [0, 1.5, 0]],
      html: dl([['上游', '深度（真机用 FoundationStereo）＋ 实例分割（SAM2）'], ['N', '发布配置 2048；Franka 生成器训练脚本 3500'], ['归一化', 'x = κ·(p − 点云均值)'], ['κ', 'Franka 3.27，Robotiq 2.02217，吸盘 3.764']]) +
        '<p>GraspGen 只看目标物体这一团点，不看整个场景。分割和深度都是上游模块，不属于这个网络。</p>' +
        '<p><b>切换试一下：</b>单视角只看到朝向相机的一面，所以均值偏向相机；每次中心化的结果都和完整点云不同（下方读数是当场算的）。训练时 50% 单视角、50% 完整，正是为了两种都能处理（§4.1）。</p>' +
        '<p>带分割误差时，掩码膨胀把桌面和邻居的点带进来，它们成了离群点。论文 §6.9 说这会让模型以高置信度往离群点上生成抓取，所以训练时专门模拟这种误差。</p>' +
        guess('场景和物体是我造的，尺寸按杯子设定。点的可见性只做了背面剔除。') + src('§3.1 · §4.5 · §6.9 · runs/*.sh · 发布的 graspgen_*.yml') },
    { n: 3, part: '编码器', title: 'PTv3：先排成一条线，再分组做注意力', sub: '空间填充曲线是当场算的；可切换 4 种序', dur: 15, cam: [0.1, 1.08, 26, [1.5, 2.6, 0]],
      html: dl([['输入', '[ΣN, 3]：κ·xyz 同时作为坐标和特征'], ['网格', 'grid_size 0.01（已乘 κ，Franka 约 3 mm）'], ['茎', 'SubMConv3d，k=5，3 → 32'], ['通道', '32, 64, 128, 256, 512'], ['block 数', '2, 2, 2, 6, 2'], ['头数', '2, 4, 8, 16, 32'], ['patch', '每阶段上限 1024'], ['输出', '逐物体均值 [#obj, 512]']]) +
        '<p>以前的点云网络要反复做邻域搜索，这是瓶颈。PTv3 把点按空间填充曲线排序（相邻的序号大多也空间相邻），切成最多 1024 点一组，在组内做自注意力。序列号右移 3 位就得到父格子，所以每阶段池化一步到位。</p>' +
        '<p>四种序轮流给不同的 block 用，弥补任意一条曲线的断点。</p>' +
        '<p><b>代码里的一个细节：</b>走到后面点数少于 1024 时，一个物体只有一组，组内注意力已经是这个物体上的全局注意力。本幕读数给出这个例子的每阶段点数和分组数。</p>' +
        guess('左边的点数和分组是按我造的杯子算的，换物体会变。层内部的注意力没有运行，方块亮度不是激活值。') + src('§3.1 Object Tokenization · ptv3.py · model_utils.py convert_to_ptv3_pc_format') },
    { n: 4, part: '生成器', title: '噪声头：三个 512 拼成 1536', sub: '点击方块看形状；可切换序列长度，权重当场算', dur: 14, cam: [0, 0.9, 37, [0, 2.6, 0]],
      html: dl([['抓取', '[B, 6] → Linear 512 → ReLU → Linear 512'], ['时间', 't → Sinusoidal 512 → 2048 → Mish → 512'], ['物体', '[#obj, 512] 重复成 [B, 512]'], ['拼接', '[1, B, 1536]（序列长 1）'], ['块', '3 ×（8 头注意力 ＋ FFN 1536→512→1536）'], ['输出', '1536 → 768 → 384 → 6'], ['参数', '约 3690 万（噪声头，不含 PTv3，我按层算的）']]) +
        '<p>论文图 2 把噪声和抓取都标成 [B × 4 × 4]；代码进网络前先转成 6 维（<code>r3_so3</code>）。</p>' +
        '<p><b>切换序列长度看看：</b>这条 <code>cat_attn</code> 路径 unsqueeze 后序列长是 1，softmax 只有一个元素，权重恒为 1。所以这三层“注意力”实际上是投影、残差、归一化和 FFN，没有在挑选任何东西。真正的空间注意力在 PTv3 里。</p>' +
        '<p>下一幕的两个调度器读的是同一个输出的不同分量：前 3 维给平移，后 3 维给旋转。</p>' +
        guess('方块大小按维度粗略缩放，不是真实比例。“序列长 3”的情形代码没有走，那一组权重用随机向量算，只是对照。') + src('图 2 · generator.py DiffusionNoisePredictionNet · model_utils.py') },
    { n: 5, part: '生成器', title: '两个调度器：10 步里加了多少噪声', sub: '柱高是真实 ᾱ，可切换 T', dur: 14, cam: [0.02, 0.92, 32, [0, 2.6, 2]],
      html: dl([['加噪', 'x_t = √ᾱ_t · x₀ + √(1−ᾱ_t) · ε'], ['平移', 'scaled_linear，β 1e-4 → 0.02（库默认）'], ['旋转', 'squaredcos_cap_v2，上限 0.999'], ['T', '训练与推理都是 10']]) +
        '<p>论文说“两个去噪过程各用一个调度器效果更好”。代码没有传 β 范围，所以 scaled_linear 用的是 diffusers 的默认值，那是给 1000 步设计的。</p>' +
        '<p><b>当场算出来的结果：</b>T = 10 时，平移的 ᾱ 最后只到 0.927，也就是最大噪声时信号还占 96%，噪声幅度只有 0.27。旋转的 ᾱ 到 2.4×10⁻⁵，已是纯噪声。</p>' +
        '<p>推理却从 N(0, I) 出发。所以平移的训练分布从来没有覆盖过推理的起点。这不等于模型错了，见下一幕的玩具和读者注。</p>' +
        '<p>切到 T = 1000 可以看到 scaled_linear 本来的样子（ᾱ 到 0.0007）。</p>' +
        src('generator.py · diffusers 0.11.1 scheduling_ddpm.py · runs/train_graspgen_franka_panda_gen.sh · 算术是我算的') },
    { n: 6, part: '生成器', title: '去噪：从噪声到抓取（当场算）', sub: '可切换步数和调度器；每个点都来自一个真正训练过的小网络', dur: 15, cam: [0, 0.62, 21, [1.5, 0, -0.4]],
      html: dl([['玩具网络', '(x, y, r, t 特征 4 维) → 56 → 56 → 3'], ['数据', '1200 个成功抓取，三段圆弧'], ['损失', '‖ε − ε̂‖²'], ['步进', '和 diffusers 0.11.1 相同，含 x̂₀ 裁剪到 [−1, 1]']]) +
        '<p>颜色是玩具“仿真器”判的：<span class="sw" style="--c:#4fc98a"></span>成功 <span class="sw" style="--c:#ff5d5d"></span>碰撞 <span class="sw" style="--c:#f2c14e"></span>太远 <span class="sw" style="--c:#9d8cff"></span>角度或位置不对。</p>' +
        '<p>这个生成器只见过成功的抓取，却仍然产生红色和黄色：这就是论文说的 false positive，来自拟合误差，不是我手工加的。下面几幕都用它。</p>' +
        '<p><b>可以试：</b>T 从 2 加到 10，成功率明显上升，再往上变化不大。这和论文“T = 10 够用”的方向一致，但只是玩具。把调度器换成两路都用余弦，看红黄比例怎么变。</p>' +
        toy('二维平面上的一个胶囊物体，抓取是 (x, y, 朝向) 三维。切换时当场重新训练，大约 1 秒。结果不能外推到真实的 6 维抓取和 PTv3。') + src('§3.1 · 步进公式出自 diffusers 0.11.1') },
    { n: 7, part: '判别器', title: '判别器：MLP 给每个候选打分', sub: '可切换阈值和批大小，精度当场算', dur: 13, cam: [0.02, 0.86, 28, [3.0, 2.2, 0.6]],
      html: dl([['物体', '[#obj, 512]，论文配方里冻结复用生成器的编码器'], ['抓取', '[B, 6] → 512 → ReLU → 512'], ['拼接', '[B, 1024]'], ['头', '1024 → 512 → 256 → 1（logit）'], ['损失', 'BCE，取每批损失最大的 75% 求均值'], ['省内存', '约 34,053 对 1,611 MiB（图 11 柱高读数，比值 21）']]) +
        '<p>判别器回答“在这个姿态抓下去会不会成功”。之前的 6-DOF GraspNet 把抓取变成 5 个点并和物体点云拼接后过 PointNet++，显存随 N×B 增长；这里只给 6 个数，显存随 B 增长。</p>' +
        '<p><b>§6.10 的权衡：</b>阈值很低时，低质量抓取混进来；阈值很高时，留下的太少，要把批大小加大。切换阈值和批大小，看右上角的精度和保留数量。</p>' +
        toy('玩具判别器的结构是 3 → 40 → 40 → 1，没有物体编码（只有一个物体）。75% 的 top-k BCE 和代码一样。') + src('§3.2 · §6.6.2 · §6.10 · discriminator.py · 图 11 · 图 14') },
    { n: 8, part: '训练', title: 'On-Generator：用生成器自己的错误训练 D', sub: '切换训练集，看同一批候选的排序怎么变（当场训练）', dur: 16, cam: [0, 0.72, 27, [1.4, 0.6, -0.8]],
      html: dl([['算法 1', 'κ → 训练 G → 采样 Ĝ → 仿真标注 → 训练 D'], ['规模', '约 7K 物体 × 每个 2K 候选'], ['论文结果', 'AUC：On-Gen 0.947，混合 0.942，离线 0.886（图 6）']]) +
        '<p>论文解释：ACRONYM 的负样本从不碰撞物体，而扩散模型会生成轻微碰撞的抓取。离线训练的判别器从没见过碰撞的负例，只能外推。</p>' +
        '<p><b>切换三种训练集。</b>玩具里的离线负样本同样不碰撞，于是离线判别器学到“越靠近物体越好”，把碰撞候选排到最前面。On-Generator 训练集里这些错误带着标签，排序就翻过来了。</p>' +
        '<p>背景热图是判别器在“朝向正确”这个切片上的分数，右上角是同一批测试候选的精度-覆盖率曲线（和论文同一个定义）。</p>' +
        toy('换 5 个随机种子：离线 AUC 0.38 到 0.59，top-100 里碰撞 41 到 76 个；On-Gen 0.76 到 0.94，碰撞 0 到 8 个；混合 0.78 到 0.91。论文是 On-Gen 略好于混合，玩具里 5 次有 4 次混合更好，这一点不一致。') + src('§3.2 · §4.2 · 算法 1 · 图 6') },
    { n: 9, part: '训练', title: '分布偏移：用 EMD 量一下', sub: '指派问题当场解；对照组是同分布的两次采样', dur: 13, cam: [0, 0.72, 28, [0.6, 0, 0.2]],
      html: dl([['距离', 'd = ‖tᵢ − tⱼ‖ + |LogMap(Rᵢ⁻¹Rⱼ)|，式 (1)'], ['子采样', '论文每物体 500 对 500，重复 5 次'], ['玩具', '每次 120 对 120，重复 5 次'], ['解法', '线性指派（匈牙利算法）']]) +
        '<p>左边离线负样本，右边生成器的负样本。连线是最优一一配对。EMD 就是配对后的平均距离。</p>' +
        '<p>论文图 6 左：正样本 EMD 集中在 0.25 上下，负样本集中在 0.4 上下，负样本的偏移更大。玩具的方向相同，右上角直方图能看到原因：<b>离线负样本的 SDF 下界正好是碰撞边界，生成器的负样本越过了它</b>。</p>' +
        '<p>对照组是从同一分布各抽一次，用来表明这个距离本身有多大的底噪。论文的图没有画这个对照；代码里的 <code>off-off-pos</code> 等键算了它。</p>' +
        toy('玩具用平面内的距离和一维角度代替 SE(3)。') + src('§4.2 · §6.8 式 (1) · 图 6 · math_utils.py compute_pose_emd · dataset_utils.py') },
    { n: 10, part: '辨析', title: '为什么不是 GAN：看标签，看梯度', sub: '切换 GraspGen / GAN', dur: 14, cam: [0, 0.8, 29, [0.8, 2, 0.4]],
      html: dl([['GAN 的 D', '真实数据 vs 生成样本'], ['GraspGen 的 D', '仿真成功 vs 失败'], ['GAN 的 G', '通过 D 的梯度更新'], ['GraspGen 的 G', '只回归噪声；D 不参与']]) +
        '<p>两者都有生成器和判别器，所以名字容易混。要看的是两件事：标签从哪来，判别器的梯度去不去生成器。</p>' +
        '<p><b>切到 GAN：</b>所有生成样本都被标成“假”，其中的成功抓取也一样。橙色箭头是玩具判别器当场算的 ∂D/∂x，GAN 就会沿它把样本往高分推。</p>' +
        '<p><b>切回 GraspGen：</b>同一批样本按仿真结果标注，成功的就是正例。那条箭头不存在：G 训练完才有 D。训练图里两者之间只有“采样后放进仿真”这条数据流，它不可微。</p>' +
        '<p>论文原话的意思：判别器分开训练，不参与扩散模型训练（§3.1 末尾、§3.2 末尾）。</p>' +
        toy('这一幕没有真的训练一个 GAN，只对比标签和展示梯度方向。') + src('§3.1 · §3.2 · 代码 train_graspgen.py 按 model_name 分开训练') },
    { n: 11, part: '下游与结果', title: '规划器筛掉多少，以及论文的数', sub: '切换玩具筛选和论文结果', dur: 14, cam: [0.02, 0.9, 34, [0.8, 2.6, 0]],
      html: dl([['候选', '代码默认采 200，取 top-100（server 默认）'], ['论文真机', 'top-100 作为 cuRobo 的目标集'], ['过滤', '碰撞、无 IK 解'], ['真机', 'UR10 ＋ D435 ＋ Robotiq-2F-140']]) +
        '<p><b>为什么要多样：</b>§3 开头就说，杂乱场景里很多好抓取够不到。玩具里一面墙绕着物体转，过滤掉从那个方向进入的候选。多样的候选总能留下一些；只集中在一段圆弧的候选，遇到挡路就全没了。</p>' +
        '<p>注意玩具里严格的 top-100 会挤到一段圆弧上（分数最高的区域），所以这里左边用“分数过 0.7 的前 100 个”。这说明只按分数取 top-K 未必保留多样性；论文没有讨论这一点，它用 top-100 且不做 NMS。</p><p>其余按钮是论文的数字：表 1 四种场景、图 4 FetchBench、图 3 和图 9 的 AUC。“总体”是四列的算术平均（我验算的）。</p>' +
        guess('墙和“窄候选”是我设的玩具。柱子上的数是论文原数。') + src('§3 · §4.1 · §4.5 · 表 1 · 图 3 · 图 4 · 图 9 · grasp_server.py') }
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
    $('infoTag').textContent = `第 ${s.n} 幕 · ${s.part}`; $('infoTitle').textContent = s.title; $('infoBody').innerHTML = s.html; $('stepNo').textContent = `${s.n} / ${SCENES.length}`;
    stepsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(+b.dataset.i === i)));
    btns.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
  }
  let lastCap = null;
  const cap = h => { if (h !== lastCap) { lastCap = h; $('cap').innerHTML = h; } };

/*TOY-BEGIN*/
  /* ---------- the toy that is really computed in this page: data, DDPM (same step formula as diffusers 0.11.1), classifier ---------- */
  const Toy = (function () {
    const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const gauss = r => { const u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    /* object: a capsule of half length A and radius R in the plane; grasp = (x, y, th), th = approach direction */
    const A = 0.22, R = 0.2, BAND = [0.13, 0.21], TOL = 0.33;
    const sdf = (x, y) => { const px = Math.max(-A, Math.min(A, x)); return Math.hypot(x - px, y) - R; };
    const normalAng = (x, y) => { const px = Math.max(-A, Math.min(A, x)); return Math.atan2(y, x - px); };
    const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
    /* graspable stretches of the outline, by polar angle of the point on the surface: three separate modes */
    const ARCS = [[0.25, 1.05], [2.09, 2.89], [-2.2, -0.94]];
    const inArc = a => ARCS.some(([l, h]) => a >= l && a <= h);
    const polar = (x, y) => Math.atan2(y, x);
    /* the "simulator": the labeller. 'in collision' and 'too far' and 'badly aligned' are separate reasons */
    function simulate(x, y, th) {
      const d = sdf(x, y);
      if (d < BAND[0]) return { ok: false, why: 'collide', d };
      if (d > BAND[1]) return { ok: false, why: 'far', d };
      const inward = wrap(normalAng(x, y) + Math.PI);
      if (Math.abs(wrap(th - inward)) > TOL) return { ok: false, why: 'angle', d };
      if (!inArc(polar(x, y))) return { ok: false, why: 'arc', d };
      return { ok: true, why: 'ok', d };
    }
    /* offline dataset, as in the paper's section 3.2: positives from the sim; negatives never collide */
    function offlineData(n, seed) {
      const r = mulberry(seed), pos = [], neg = [];
      let guard = 0;
      while ((pos.length < n || neg.length < n) && guard++ < n * 400) {
        const rad = 0.05 + r() * 0.95, a = r() * 2 * Math.PI, x = rad * Math.cos(a), y = rad * Math.sin(a) * 0.82;
        const inward = wrap(normalAng(x, y) + Math.PI);
        const th = r() < 0.65 ? wrap(inward + gauss(r) * 0.3) : (r() * 2 - 1) * Math.PI;
        const s = simulate(x, y, th);
        if (s.ok) { if (pos.length < n) pos.push([x, y, th]); }
        else if (s.why !== 'collide' && neg.length < n) neg.push([x, y, th]);
      }
      return { pos, neg };
    }
    /* kappa from the dataset, the way calculate_dataset_kappa does: 1 / mean per-axis extent of the positive translations */
    function kappaOf(pos) { let e = 0; for (const k of [0, 1]) { const v = pos.map(p => p[k]); e += Math.max(...v) - Math.min(...v); } return 1 / (e / 2); }
    /* schedules, same as diffusers: scaled_linear with default beta 1e-4..0.02, squaredcos_cap_v2 */
    const scaledLinear = T => Array.from({ length: T }, (_, i) => { const a = Math.sqrt(1e-4), b = Math.sqrt(0.02); return Math.pow(T > 1 ? a + (b - a) * i / (T - 1) : a, 2); });
    const cosine = T => { const f = t => Math.cos((t + 0.008) / 1.008 * Math.PI / 2) ** 2; return Array.from({ length: T }, (_, i) => Math.min(1 - f((i + 1) / T) / f(i / T), 0.999)); };
    function sched(betas) { const ab = []; let c = 1; for (const b of betas) { c *= 1 - b; ab.push(c); } return { b: betas, ab }; }
    /* a small fully connected net with hand-written backprop and Adam */
    function MLP(sizes, seed) {
      const r = mulberry(seed), W = [], B = [];
      for (let l = 0; l + 1 < sizes.length; l++) {
        const a = sizes[l], b = sizes[l + 1], w = new Float64Array(a * b), bb = new Float64Array(b), s = Math.sqrt(2 / a);
        for (let i = 0; i < w.length; i++) w[i] = gauss(r) * s; W.push(w); B.push(bb);
      }
      const n = sizes.length - 1, mW = W.map(w => new Float64Array(w.length)), mB = B.map(w => new Float64Array(w.length)), vW = W.map(w => new Float64Array(w.length)), vB = B.map(w => new Float64Array(w.length)), gW = W.map(w => new Float64Array(w.length)), gB = B.map(w => new Float64Array(w.length));
      const H = sizes.map(s => new Float64Array(s)), PRE = sizes.map(s => new Float64Array(s));
      function fwd(x) {
        H[0].set(x);
        for (let l = 0; l < n; l++) {
          const a = sizes[l], b = sizes[l + 1], w = W[l], bb = B[l], I = H[l], O = H[l + 1], P = PRE[l + 1];
          for (let j = 0; j < b; j++) { let s = bb[j]; for (let i = 0, k = j * a; i < a; i++, k++) s += w[k] * I[i]; P[j] = s; O[j] = l + 1 < n ? (s > 0 ? s : 0) : s; }
        }
        return H[n];
      }
      function back(dOut) { /* dOut = dLoss/dOutput, accumulates */
        let D = dOut;
        for (let l = n - 1; l >= 0; l--) {
          const a = sizes[l], b = sizes[l + 1], w = gW[l], bb = gB[l], I = H[l], next = new Float64Array(a);
          for (let j = 0; j < b; j++) { const dj = D[j]; if (dj === 0) continue; bb[j] += dj; for (let i = 0, k = j * a; i < a; i++, k++) { w[k] += dj * I[i]; next[i] += dj * W[l][k]; } }
          if (l > 0) { const Pp = PRE[l]; for (let i = 0; i < a; i++) if (Pp[i] <= 0) next[i] = 0; }
          D = next;
        }
      }
      let step = 0;
      function adam(lr, bs) {
        step++; const b1 = 0.9, b2 = 0.999, c1 = 1 - Math.pow(b1, step), c2 = 1 - Math.pow(b2, step);
        const up = (P, G, M, V) => { for (let l = 0; l < n; l++) { const p = P[l], g = G[l], m = M[l], v = V[l]; for (let i = 0; i < p.length; i++) { const x = g[i] / bs; m[i] = b1 * m[i] + (1 - b1) * x; v[i] = b2 * v[i] + (1 - b2) * x * x; p[i] -= lr * (m[i] / c1) / (Math.sqrt(v[i] / c2) + 1e-8); g[i] = 0; } } };
        up(W, gW, mW, vW); up(B, gB, mB, vB);
      }
      return { fwd, back, adam };
    }
    /* training the noise net; x = kappa*t, r = th/pi, like matrix_to_rt. The input also carries a time embedding */
    const IN = 7;
    function timeFeat(t, T, buf, o) { const u = T > 1 ? t / (T - 1) : 0; buf[o] = Math.sin(Math.PI * u); buf[o + 1] = Math.cos(Math.PI * u); buf[o + 2] = Math.sin(2 * Math.PI * u); buf[o + 3] = Math.cos(2 * Math.PI * u); }
    function trainGen(data, T, mode, opt = {}) {
      const kap = data.kappa, sp = sched(mode === 'code' ? scaledLinear(T) : cosine(T)), sr = sched(cosine(T));
      const steps = opt.steps || 2600, bs = 48, r = mulberry(opt.seed || 11), net = MLP([IN, 56, 56, 3], (opt.seed || 11) + 1), x = new Float64Array(IN), d = new Float64Array(3);
      const P = data.pos, nP = P.length;
      for (let s = 0; s < steps; s++) {
        const lr = s < steps * 0.75 ? 3e-3 : 8e-4;
        for (let b = 0; b < bs; b++) {
          const p = P[Math.floor(r() * nP)], t = Math.floor(r() * T);
          const e0 = gauss(r), e1 = gauss(r), e2 = gauss(r), a = sp.ab[t], c = sr.ab[t];
          x[0] = Math.sqrt(a) * kap * p[0] + Math.sqrt(1 - a) * e0;
          x[1] = Math.sqrt(a) * kap * p[1] + Math.sqrt(1 - a) * e1;
          x[2] = Math.sqrt(c) * p[2] / Math.PI + Math.sqrt(1 - c) * e2;
          timeFeat(t, T, x, 3);
          const o = net.fwd(x);
          d[0] = 2 * (o[0] - e0); d[1] = 2 * (o[1] - e1); d[2] = 2 * (o[2] - e2);
          net.back(d);
        }
        net.adam(lr, bs);
      }
      return { net, T, mode, sp, sr, kap };
    }
    /* reverse process: returns every intermediate state so that the animation can be scrubbed */
    function sample(G, n, seed) {
      const r = mulberry(seed), T = G.T, cur = [], traj = [], x = new Float64Array(IN);
      for (let i = 0; i < n; i++) cur.push([gauss(r), gauss(r), gauss(r)]);
      traj.push(cur.map(c => c.slice()));
      const stepOne = (s, t, xt, eps) => {
        const a = s.ab[t], ap = t > 0 ? s.ab[t - 1] : 1, b = s.b[t];
        let x0 = (xt - Math.sqrt(1 - a) * eps) / Math.sqrt(a); x0 = Math.max(-1, Math.min(1, x0));
        const c0 = Math.sqrt(ap) * b / (1 - a), ct = Math.sqrt(1 - b) * (1 - ap) / (1 - a);
        let v = c0 * x0 + ct * xt;
        if (t > 0) v += Math.sqrt(Math.max(1e-20, (1 - ap) / (1 - a) * b)) * gauss(r);
        return v;
      };
      for (let t = T - 1; t >= 0; t--) {
        for (let i = 0; i < n; i++) {
          const c = cur[i]; x[0] = c[0]; x[1] = c[1]; x[2] = c[2]; timeFeat(t, T, x, 3);
          const o = G.net.fwd(x), e0 = o[0], e1 = o[1], e2 = o[2];
          c[0] = stepOne(G.sp, t, c[0], e0); c[1] = stepOne(G.sp, t, c[1], e1); c[2] = stepOne(G.sr, t, c[2], e2);
        }
        traj.push(cur.map(c => c.slice()));
      }
      const toPose = c => [c[0] / G.kap, c[1] / G.kap, c[2] * Math.PI];
      return { traj, toPose, poses: cur.map(toPose) };
    }
    /* grasp classifier with binary cross entropy on the worst 75% in every batch, as discriminator.py does */
    function trainDis(items, opt = {}) {
      const steps = opt.steps || 1400, bs = 96, r = mulberry(opt.seed || 21), net = MLP([3, 40, 40, 1], (opt.seed || 21) + 1), x = new Float64Array(3), d = new Float64Array(1);
      const n = items.length, batch = new Array(bs);
      for (let s = 0; s < steps; s++) {
        const lr = s < steps * 0.75 ? 3e-3 : 8e-4;
        const losses = [];
        for (let b = 0; b < bs; b++) {
          const it = items[Math.floor(r() * n)]; batch[b] = it;
          x[0] = it[0] * 1.5; x[1] = it[1] * 1.5; x[2] = it[2] / Math.PI;
          const l = net.fwd(x)[0], y = it[3];
          losses.push([y ? Math.log1p(Math.exp(-l)) : Math.log1p(Math.exp(l)), b]);
        }
        losses.sort((p, q) => q[0] - p[0]);
        const keep = Math.floor(bs * 0.75);
        for (let k = 0; k < keep; k++) {
          const it = batch[losses[k][1]];
          x[0] = it[0] * 1.5; x[1] = it[1] * 1.5; x[2] = it[2] / Math.PI;
          const l = net.fwd(x)[0], y = it[3], p = 1 / (1 + Math.exp(-l));
          d[0] = p - y; net.back(d);
        }
        net.adam(lr, keep);
      }
      const y = new Float64Array(3);
      return (px, py, th) => { y[0] = px * 1.5; y[1] = py * 1.5; y[2] = th / Math.PI; return 1 / (1 + Math.exp(-net.fwd(y)[0])); };
    }
    /* precision-coverage: the same definition as the paper's, with translation-only matching as in compute_recall */
    function precisionCoverage(scored, gtPos, radius = 0.05) {
      const s = scored.slice().sort((a, b) => b.score - a.score), seen = new Uint8Array(gtPos.length), cur = [];
      let ok = 0, covered = 0, auc = 0, lastC = 0, lastP = null;
      s.forEach((g, i) => {
        if (g.ok) ok++;
        for (let k = 0; k < gtPos.length; k++) if (!seen[k] && Math.hypot(gtPos[k][0] - g.x, gtPos[k][1] - g.y) < radius && Math.abs(wrap(gtPos[k][2] - g.th)) < 0.4) { seen[k] = 1; covered++; }
        const P = ok / (i + 1), C = covered / gtPos.length;
        if (lastP != null) auc += (C - lastC) * (P + lastP) / 2; else auc += C * P;
        lastP = P; lastC = C; cur.push([C, P]);
      });
      return { curve: cur, auc };
    }
    const tally = poses => { const c = { ok: 0, collide: 0, far: 0, angle: 0, arc: 0 }; const lab = poses.map(p => { const s = simulate(p[0], p[1], p[2]); c[s.why]++; return s; }); return { c, lab }; };
    return { mulberry, gauss, simulate, sdf, offlineData, kappaOf, scaledLinear, cosine, sched, trainGen, sample, trainDis, precisionCoverage, tally, A, R, BAND, TOL, ARCS, wrap, normalAng, polar };
  })();
/*TOY-END*/

  /* ---------- 3D helpers ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.6, phi: 1.0, dist: 24, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);
  let LABS = [], refDist = 24, PICKS = [];
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  function relabel(G, sp, text, pos, o) { if (sp) { G.remove(sp); L.dispose(sp); LABS = LABS.filter(s => s !== sp); } const n = lab(text, pos, o); G.add(n); return n; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 10, 8);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: 0.65 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.14) { const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im); return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); }; }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.5, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  function clouds(n, size = 0.09) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); const m = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity: 0.95, sizeAttenuation: true, depthWrite: false }); const o = new THREE.Points(g, m); o.frustumCulled = false; return o; }
  function setPt(o, i, p, c) { o.geometry.attributes.position.array.set(p, i * 3); if (c) o.geometry.attributes.color.array.set(c, i * 3); }
  function ptDone(o, n) { o.geometry.attributes.position.needsUpdate = true; o.geometry.attributes.color.needsUpdate = true; if (n != null) o.geometry.setDrawRange(0, n); }

  /* HUD: a small 2D chart drawn over the stage */
  const hudEl = $('hud'), hudG = hudEl.getContext('2d');
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function hud(w, h, draw) {
    const small = document.body.classList.contains('embed') || $('stage').clientWidth < 640, k = small ? 0.72 : 1, dpr = Math.min(2, devicePixelRatio || 1);
    hudEl.hidden = false; hudEl.style.width = w * k + 'px'; hudEl.style.height = h * k + 'px'; hudEl.width = w * k * dpr; hudEl.height = h * k * dpr;
    hudG.setTransform(dpr * k, 0, 0, dpr * k, 0, 0); hudG.clearRect(0, 0, w, h); hudG.font = '12px "Noto Sans SC",system-ui,sans-serif'; hudG.textBaseline = 'alphabetic'; draw(hudG, css('--fg') || '#e6ecf7', css('--muted') || '#8e9bb8');
  }
  const hexs = c => '#' + c.toString(16).padStart(6, '0');
  function hbars(g, fg, mu, x, y, w, rows, max, rh = 20) { rows.forEach((r, i) => { const yy = y + i * rh; g.fillStyle = mu; g.fillText(r[0], x, yy + 11); const bx = x + 70, bw = Math.max(1, (w - 118) * r[1] / max); g.fillStyle = hexs(r[2]); g.fillRect(bx, yy + 2, bw, 12); g.fillStyle = fg; g.fillText(r[3] ?? String(r[1]), bx + bw + 5, yy + 12); }); }

  /* the toy plane: the object, the graspable arcs and grippers drawn as glyphs */
  function ToyPlane(G, o = {}) {
    const s = o.s || 6, at = o.at || [0, 0, 0], h = at[1] + 0.02, W = (x, y, hh = 0) => [at[0] + x * s, h + hh, at[2] - y * s];
    if (o.grid !== false) { const gr = L.grid(s * 3.4, 34); gr.position.set(at[0], at[1] - 0.01, at[2]); G.add(gr); }
    const shape = new THREE.Shape(), A = Toy.A * s, R = Toy.R * s; shape.moveTo(-A, -R); shape.lineTo(A, -R); shape.absarc(A, 0, R, -Math.PI / 2, Math.PI / 2, false); shape.lineTo(-A, R); shape.absarc(-A, 0, R, Math.PI / 2, Math.PI * 1.5, false);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false, curveSegments: 24 }), L.mat(COL.obj, { opacity: 0.85 })); body.rotation.x = -Math.PI / 2; body.position.set(at[0], at[1], at[2]); G.add(body);
    /* graspable band along each arc */
    Toy.ARCS.forEach(([a, b]) => { for (const off of Toy.BAND) { const pts = []; for (let i = 0; i <= 40; i++) { const u = a + (b - a) * i / 40; let r = 0.1, step = 0.3; const dir = [Math.cos(u), Math.sin(u)]; for (let k = 0; k < 40; k++) { if (Toy.sdf(dir[0] * r, dir[1] * r) < off) r += step; else { r -= step; step /= 2; r += step; } } pts.push(W(dir[0] * r, dir[1] * r, 0.03)); } wire(G, pts, COL.ok, { opacity: 0.55 }); } });
    function glyphs(n, sz = 0.07) {
      const m = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 24), 3)).setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 24), 3)), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 })); m.frustumCulled = false; G.add(m);
      const P = m.geometry.attributes.position.array, C = m.geometry.attributes.color.array;
      return { m, set(i, x, y, th, c, hh = 0.12, op = 1) {
        const ux = Math.cos(th), uy = Math.sin(th), vx = -uy, vy = ux, f = sz * 1.3, w = sz * 0.7, bk = sz * 0.9;
        const seg = [[x - vx * w, y - vy * w, x + vx * w, y + vy * w], [x - vx * w, y - vy * w, x - vx * w + ux * f, y - vy * w + uy * f], [x + vx * w, y + vy * w, x + vx * w + ux * f, y + vy * w + uy * f], [x, y, x - ux * bk, y - uy * bk]];
        seg.forEach((q, k) => { const a = W(q[0], q[1], hh), b = W(q[2], q[3], hh); P.set(a, (i * 8 + k * 2) * 3); P.set(b, (i * 8 + k * 2 + 1) * 3); });
        for (let k = 0; k < 8; k++) { C[(i * 8 + k) * 3] = c[0] * op; C[(i * 8 + k) * 3 + 1] = c[1] * op; C[(i * 8 + k) * 3 + 2] = c[2] * op; }
      }, done(n2) { m.geometry.attributes.position.needsUpdate = true; m.geometry.attributes.color.needsUpdate = true; if (n2 != null) m.geometry.setDrawRange(0, n2 * 8); } };
    }
    return { W, glyphs, s, body };
  }
  const scoreCol = v => { const t = clamp(v, 0, 1); return t < 0.5 ? [1, 0.36 + t * 0.9, 0.36] : [1 - (t - 0.5) * 1.38, 0.81, 0.36 + (t - 0.5) * 0.4]; };

  /* ---------- toy data, generators and discriminators, cached ---------- */
  const STORE = { gens: {}, dis: {} };
  function base() { if (!STORE.of) { const of = Toy.offlineData(1200, 5); of.kappa = Toy.kappaOf(of.pos); STORE.of = of; STORE.gt = Toy.offlineData(800, 99).pos; } return STORE.of; }
  function gen(T, mode) { const k = T + mode; if (!STORE.gens[k]) { const G = Toy.trainGen(base(), T, mode), Sa = Toy.sample(G, 300, 7), big = Toy.sample(G, 1500, 77); STORE.gens[k] = { G, Sa, big, tal: Toy.tally(big.poses), talS: Toy.tally(Sa.poses) }; } return STORE.gens[k]; }
  function onItems() { const g = gen(10, 'code'); return g.big.poses.map((p, i) => [p[0], p[1], p[2], g.tal.lab[i].ok ? 1 : 0]); }
  function test() { if (!STORE.test) { const g = gen(10, 'code'), sa = Toy.sample(g.G, 1500, 1234), tl = Toy.tally(sa.poses); STORE.test = { poses: sa.poses, tl }; } return STORE.test; }
  function dis(kind) {
    if (STORE.dis[kind]) return STORE.dis[kind];
    const of = base(), off = of.pos.map(p => [...p, 1]).concat(of.neg.map(p => [...p, 0]));
    const items = kind === 'off' ? off : kind === 'on' ? onItems() : onItems().concat(off), D = Toy.trainDis(items), t = test();
    const sc = t.poses.map((p, i) => ({ x: p[0], y: p[1], th: p[2], ok: t.tl.lab[i].ok, why: t.tl.lab[i].why, score: D(p[0], p[1], p[2]) }));
    const pc = Toy.precisionCoverage(sc, STORE.gt), top = sc.slice().sort((a, b) => b.score - a.score).slice(0, 100), topc = { ok: 0, collide: 0, far: 0, angle: 0, arc: 0 }; top.forEach(g => topc[g.why]++);
    return STORE.dis[kind] = { D, sc, pc, topc, items, top };
  }

  /* control groups kept across scene changes */
  const STATE = { T6: 2, mode6: 0, T5: 2, in2: 0, ord3: 0, tok4: 0, th7: 2, b7: 2, set8: 0, gan: 0, res: 0 };
  const T6S = [2, 5, 10, 20, 50], T5S = [2, 5, 10, 20, 100, 1000], MODES = ['code', 'cos'];
  (qs.get('ctl') || '').split(',').forEach(kv => { const [k, v] = kv.split(':'); if (k in STATE && v != null) STATE[k] = +v; });

  /* ---------- scene 1 ---------- */
  function s1(G) {
    G.add(L.grid(48, 48));
    const zF = 4.6, zB = -6.2, Xs = [-12, -7.2, -2.2, 2.6, 7.2, 12];
    const row1 = [['点云\n[1, N, 3]', COL.obj, 2, 1.1], ['PTv3 编码\n→ 512', COL.enc, 3, 2], ['扩散头 ×10 步\n[B, 6]', COL.gen, 3, 3], ['B 个候选\n[B, 4, 4]', COL.noise, 2.4, 1.2], ['判别器\n[B, 1]', COL.dis, 2.6, 2], ['top-100 → 规划器', COL.plan, 2.6, 1.4]];
    const go1 = [1, 2, 3, 5, 6, 10], F = row1.map((r, i) => { const b = block(r[2], r[3], 2, r[1], [Xs[i], r[3] / 2, zF]); b.userData.go = go1[i]; PICKS.push(b); G.add(b, lab(r[0], [Xs[i], r[3] + 0.8, zF], { size: 23 })); return b; });
    const row2 = [['算 κ', 1], ['训练 G\n只用正样本', 5], ['采样 Ĝ', 5], ['仿真贴标签', 7], ['训练 D', 7]], Xb = [-9.6, -4.8, 0, 4.8, 9.6];
    const B = row2.map((r, i) => { const c = [COL.time, COL.gen, COL.noise, COL.sim, COL.dis][i], b = block(2.6, 0.9, 1.6, c, [Xb[i], 0.45, zB]); b.userData.go = r[1]; PICKS.push(b); G.add(b, lab(r[0], [Xb[i], 1.7, zB], { size: 22 })); return b; });
    for (let i = 0; i < 5; i++) wire(G, [[Xs[i], 0.6, zF], [Xs[i + 1], 0.6, zF]], COL.sim, { opacity: 0.5 });
    for (let i = 0; i < 4; i++) wire(G, [[Xb[i], 0.5, zB], [Xb[i + 1], 0.5, zB]], COL.sim, { opacity: 0.5 });
    G.add(lab('部署', [-15.6, 0.5, zF], { size: 22 }), lab('算法 1', [-14, 0.5, zB], { size: 22 }));
    const f = stream(G, 6, COL.enc), fb = stream(G, 5, COL.noise);
    return { update(p) {
      const q = (p * 18) % 1, i = Math.min(5, Math.floor(seg(p, 0, 0.56) * 6)), k = Math.min(4, Math.floor(clamp((p - 0.56) / 0.4, 0, 0.999) * 5));
      F.forEach((b, n) => glow(b, n === i && p < 0.56 ? 0.8 : 0)); B.forEach((b, n) => glow(b, n === k && p >= 0.56 ? 0.8 : 0));
      f([[Xs[0], 0.7, zF], [Xs[5], 0.7, zF]], (q + p) % 1, p < 0.56 ? 1 : 0); fb([[Xb[0], 0.6, zB], [Xb[4], 0.6, zB]], (q + p) % 1, p >= 0.56 ? 1 : 0);
      cap(p < 0.56 ? '<b>部署：</b>一团点进去，一批打过分的抓取出来，再由规划器选一个能执行的' : '<b>训练：</b>G 和 D 分开训，中间连接它们的是“采样、仿真”这条数据流，<b>不是梯度</b>');
    } };
  }

  /* ---------- scene 2 ---------- */
  function s2(G) {
    const r = Toy.mulberry(3), sc = 18, cam = [0.32, 0.42, 0.34], norm = v => { const n = Math.hypot(...v); return v.map(x => x / n); };
    /* metres. target: cup radius 4 cm, height 10 cm, with a handle */
    const tgt = [], other = [], tbl = [];
    const push = (A, p, n) => A.push({ p, n });
    for (let i = 0; i < 2048; i++) {
      const u = r();
      if (u < 0.76) { const a = r() * 2 * Math.PI, y = r() * 0.1; push(tgt, [0.04 * Math.cos(a), y, 0.04 * Math.sin(a)], [Math.cos(a), 0, Math.sin(a)]); }
      else if (u < 0.86) { const ra = 0.04 * Math.sqrt(r()), a = r() * 2 * Math.PI; push(tgt, [ra * Math.cos(a), 0.1, ra * Math.sin(a)], [0, 1, 0]); }
      else { const a = r() * 2 * Math.PI, b = r() * 2 * Math.PI, R0 = 0.025, r0 = 0.008, cx = 0.05, cy = 0.05, q = R0 + r0 * Math.cos(b); push(tgt, [cx + q * Math.cos(a), cy + q * Math.sin(a), r0 * Math.sin(b)], norm([Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a), Math.sin(b)])); }
    }
    for (let i = 0; i < 700; i++) { const a = r() * 2 * Math.PI, rr = 0.03; const b = Math.acos(2 * r() - 1); const n = [Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)]; push(other, [-0.075 + rr * n[0], 0.03 + rr * n[1], 0.03 + rr * n[2]], n); }
    for (let i = 0; i < 1100; i++) tbl.push({ p: [(r() - 0.5) * 0.46, 0, (r() - 0.5) * 0.46], n: [0, 1, 0] });
    const vis = q => { const d = norm([cam[0] - q.p[0], cam[1] - q.p[1], cam[2] - q.p[2]]); return d[0] * q.n[0] + d[1] * q.n[1] + d[2] * q.n[2] > 0.02; };
    const mode = STATE.in2, partial = tgt.filter(vis), full = tgt;
    const seen = mode === 1 ? full : partial;
    /* dilated mask: table points and neighbour points close to the target's silhouette are wrongly kept */
    const outl = mode === 2 ? tbl.filter(q => { const R = Math.hypot(q.p[0], q.p[2]); return R > 0.04 && R < 0.075; }).concat(other.filter(q => q.p[0] > -0.06)) : [];
    const kept = seen.concat(outl), sceneOthers = other.filter(vis).concat(tbl);
    const meanOf = A => { const m = [0, 0, 0]; A.forEach(q => { m[0] += q.p[0]; m[1] += q.p[1]; m[2] += q.p[2]; }); return m.map(v => v / A.length); };
    const mK = meanOf(kept), mF = meanOf(full), shift = Math.hypot(mK[0] - mF[0], mK[1] - mF[1], mK[2] - mF[2]);
    const N = kept.length + sceneOthers.length, P = clouds(N, 0.075); G.add(P); G.add(L.grid(20, 20));
    const rig = block(0.7, 0.45, 0.45, COL.sim, [cam[0] * sc, cam[1] * sc, cam[2] * sc]); const rl = lab('RGB-D 相机', [cam[0] * sc, cam[1] * sc + 0.9, cam[2] * sc], { size: 20, scale: 0.008 }); G.add(rig, rl);
    const meanB = new THREE.Mesh(BALL, L.mat(COL.far)); meanB.scale.setScalar(0.16); G.add(meanB);
    const ctext = `<span>点数 ${kept.length}</span> · <span>均值比完整点云偏 <b>${(shift * 100).toFixed(1)} cm</b></span>`;
    const K = 3.27;
    return { ctl: { groups: [{ label: '输入', key: 'in2', items: ['单视角', '完整几何', '单视角 + 分割误差'] }] }, update(p) {
      const m = seg(p, 0.22, 0.42), c = seg(p, 0.5, 0.68), kk = seg(p, 0.76, 0.95), sca = sc * L.lerp(1, K, kk) * 0.55 ** kk;
      kept.forEach((q, i) => { const isOut = i >= seen.length; const b = isOut ? [1, 0.36, 0.36] : [0.49, 0.72, 1], g0 = [0.56, 0.61, 0.72], col = [L.lerp(g0[0], b[0], m), L.lerp(g0[1], b[1], m), L.lerp(g0[2], b[2], m)]; setPt(P, i, [(q.p[0] - mK[0] * c) * sca, (q.p[1] - mK[1] * c) * sca + c * 1.4, (q.p[2] - mK[2] * c) * sca], col); });
      const off = kept.length, fade = 1 - m;
      sceneOthers.forEach((q, i) => { const a = 0.5 * fade, hide = m > 0.98; setPt(P, off + i, hide ? [0, -50, 0] : [q.p[0] * sc, q.p[1] * sc, q.p[2] * sc], [a * 1.1, a * 1.2, a * 1.4]); });
      ptDone(P, N);
      meanB.visible = p > 0.42; meanB.position.set(mK[0] * sc * (1 - c), mK[1] * sc * (1 - c) + c * 1.4, mK[2] * sc * (1 - c));
      rig.visible = p < 0.5; rl.visible = p < 0.5;
      cap(p < 0.22 ? `深度变成点云：桌子、杯子、邻居都在一起。${mode === 1 ? '（此模式下目标用完整几何）' : ''}`
        : p < 0.5 ? (mode === 2 ? `掩码膨胀，<b>桌面和邻居的点混进来</b>（红色）。${ctext}` : `实例分割只留下目标。${ctext}`)
        : p < 0.76 ? `减去点云均值（黄球移到原点）。${ctext}`
        : `乘 κ：坐标和抓取平移都乘同一个数（Franka <b>3.27</b>）。画面只放大了示意倍数`);
    } };
  }

  /* ---------- scene 3 ---------- */
  function morton(x, y, z, bits = 10) { let c = 0; for (let i = bits - 1; i >= 0; i--) c = c * 8 + ((x >> i & 1) * 4 + (y >> i & 1) * 2 + (z >> i & 1)); return c; }
  /* 3D Hilbert index by Skilling's transpose method */
  function hilbert(X, bits = 10) {
    X = X.slice(); const n = 3; let M = 1 << (bits - 1);
    for (let Q = M; Q > 1; Q >>= 1) { const P = Q - 1; for (let i = 0; i < n; i++) { if (X[i] & Q) X[0] ^= P; else { const t = (X[0] ^ X[i]) & P; X[0] ^= t; X[i] ^= t; } } }
    for (let i = 1; i < n; i++) X[i] ^= X[i - 1];
    let t = 0; for (let Q = M; Q > 1; Q >>= 1) if (X[n - 1] & Q) t ^= Q - 1;
    for (let i = 0; i < n; i++) X[i] ^= t;
    let c = 0; for (let b = bits - 1; b >= 0; b--) for (let i = 0; i < n; i++) c = c * 2 + ((X[i] >> b) & 1);
    return c;
  }
  function cup(n, seed) { const r = Toy.mulberry(seed), out = []; for (let i = 0; i < n; i++) { const u = r(); if (u < 0.8) { const a = r() * 2 * Math.PI; out.push([0.04 * Math.cos(a), r() * 0.1, 0.04 * Math.sin(a)]); } else { const a = r() * 2 * Math.PI, b = r() * 2 * Math.PI, q = 0.025 + 0.008 * Math.cos(b); out.push([0.05 + q * Math.cos(a), 0.05 + q * Math.sin(a), 0.008 * Math.sin(b)]); } } const m = [0, 0, 0]; out.forEach(p => { m[0] += p[0]; m[1] += p[1]; m[2] += p[2]; }); return out.map(p => [(p[0] - m[0] / n) * 3.27, (p[1] - m[1] / n) * 3.27, (p[2] - m[2] / n) * 3.27]); }
  function s3(G) {
    const pts = cup(2048, 9), grid = 0.01, mn = [0, 1, 2].map(k => Math.min(...pts.map(p => p[k])));
    const ij = pts.map(p => p.map((v, k) => Math.floor((v - mn[k]) / grid)));
    const ord = STATE.ord3, codeOf = q => ord === 0 ? morton(q[0], q[1], q[2]) : ord === 1 ? morton(q[1], q[2], q[0]) : ord === 2 ? hilbert(q) : hilbert([q[1], q[2], q[0]]);
    /* one point per cell, then stage-wise merging to parent cells */
    const stages = []; for (let s = 0; s < 5; s++) { const cell = 1 << s, map = new Map(); pts.forEach((p, i) => { const k = ij[i].map(v => Math.floor(v / cell)).join(','); const e = map.get(k) || { c: [0, 0, 0], n: 0 }; e.c[0] += p[0]; e.c[1] += p[1]; e.c[2] += p[2]; e.n++; map.set(k, e); }); const list = [...map.values()].map(e => e.c.map(v => v / e.n)); stages.push(list); }
    const Ns = stages.map(s => s.length), groups = Ns.map(n => Math.ceil(n / Math.min(1024, n)));
    const scale = 18, ox = -7.5, oy = 2.8, W = p => [ox + p[0] * scale, oy + p[1] * scale, p[2] * scale];
    const order = pts.map((p, i) => [codeOf(ij[i]), i]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
    const P = clouds(2048, 0.14); G.add(P);
    const hue = t => [0.3 + 0.7 * Math.abs(Math.sin(t * 3)), 0.5 + 0.5 * Math.cos(t * 4), 1 - 0.7 * t];
    const lineG = new THREE.BufferGeometry(); lineG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2048 * 3), 3)); order.forEach((id, i) => lineG.attributes.position.array.set(W(pts[id]), i * 3));
    const curve = new THREE.Line(lineG, new THREE.LineBasicMaterial({ color: COL.enc, transparent: true, opacity: 0.55 })); G.add(curve);
    const Ch = [32, 64, 128, 256, 512], De = [2, 2, 2, 6, 2], He = [2, 4, 8, 16, 32];
    const blocks = Ch.map((c, i) => { const h = 0.6 + Math.log2(c / 16) * 0.52, x = 0.6 + i * 2.5, b = block(1.5, h, 1.6, COL.enc, [x, h / 2 + 0.5, 0]); G.add(b); G.add(lab(`${c} 通道\n${De[i]} 块 ${He[i]} 头`, [x, h + 1.45, 0], { size: 19 })); G.add(lab(`N≈${Ns[i]}\n${groups[i]} 组`, [x, -0.25, 1.5], { size: 19 })); return b; });
    const vec = block(0.5, 4.4, 1.2, COL.gen, [13.6, 2.7, 0]); G.add(vec); const vl = lab('逐物体均值\n[1, 512]', [13.6, 6.0, 0], { size: 20 }); G.add(vl);
    G.add(L.grid(36, 36));
    return { ctl: { groups: [{ label: '序列化', key: 'ord3', items: ['z', 'z-trans', 'hilbert', 'hilbert-trans'] }] }, update(p) {
      const a = seg(p, 0.02, 0.36), n = Math.floor(a * 2048); curve.geometry.setDrawRange(0, n); curve.visible = p < 0.46;
      const si = p < 0.4 ? -1 : Math.min(4, Math.floor((p - 0.4) / 0.09));
      blocks.forEach((b, i) => glow(b, i === si ? 0.85 : (i < si ? 0.2 : 0)));
      glow(vec, p > 0.86 ? 0.8 : 0); vec.visible = p > 0.82; vl.visible = p > 0.82;
      if (si < 0) { order.forEach((id, i) => { const on = i <= n, t = i / 2048; setPt(P, i, W(pts[id]), on ? hue(t) : [0.35, 0.42, 0.55]); }); ptDone(P, 2048); }
      else { const list = stages[si]; list.forEach((q, i) => setPt(P, i, W(q), hue(i / list.length))); ptDone(P, list.length); P.material.size = 0.14 + si * 0.06; }
      if (si < 0) P.material.size = 0.14;
      const nm = ['z', 'z-trans', 'hilbert', 'hilbert-trans'][ord];
      cap(p < 0.4 ? `按 <b>${nm}</b> 序把 2048 个点排成一条线，线一直连着相邻的格子，偶尔跳远` : p < 0.85 ? `第 ${si + 1} 阶段：格子边长 ${(0.01 * 2 ** si).toFixed(2)}（κ 尺度），剩 <b>${Ns[si]}</b> 个点，分 <b>${groups[si]}</b> 组做注意力` : '对最后一阶段的点按物体求平均：一个 <b>512 维</b>向量，空间信息只留在这里面');
    } };
  }

  /* ---------- scene 4 ---------- */
  function s4(G) {
    G.add(L.grid(44, 44));
    const parts = [
      { n: '抓取 [B, 6]\n→ 512', c: COL.noise, p: [-13, 0, 4.4], s: [2.4, 1, 1.6], d: '抓取：[B, 6] → Linear(6, 512) → ReLU → Linear(512, 512)。平移乘过 κ，轴角除过 π。' },
      { n: '时间 t\n→ 512', c: COL.time, p: [-13, 0, 0], s: [2.4, 1, 1.6], d: '时间：Sinusoidal 512 → Linear 2048 → Mish → Linear 512。T = 10 时 t 只取 0 到 9。' },
      { n: '物体 PTv3\n→ 512', c: COL.enc, p: [-13, 0, -4.4], s: [2.4, 1, 1.6], d: '物体：PTv3 输出 [#obj, 512]，按 mask_batch 复制成 [B, 512]。整个去噪过程只算一次。' },
      { n: '拼接 1536\n[1, B, 1536]', c: COL.sim, p: [-8, 0, 0], s: [1.6, 4, 2.6], d: '沿特征维拼接：[B, 1536]，unsqueeze(0) 变成 [1, B, 1536]。MultiheadAttention 默认序列在第 0 维，所以序列长 1。' },
      { n: '注意力 1', c: COL.gen, p: [-4.2, 0, 0], s: [1.4, 3.2, 2.6], d: 'nn.MultiheadAttention(1536, 8)，每头 192 维；残差 ＋ LayerNorm；query 位置编码是可学的 1 个向量。序列长 1 时权重恒为 1。' },
      { n: 'FFN', c: COL.gen, p: [-2.4, 0, 0], s: [0.9, 2.2, 2.6], d: 'FFN：1536 → 512 → GELU → 1536，残差 ＋ LayerNorm。' },
      { n: '注意力 2', c: COL.gen, p: [-0.6, 0, 0], s: [1.4, 3.2, 2.6], d: '同第 1 块，权重不共享。' },
      { n: 'FFN', c: COL.gen, p: [1.2, 0, 0], s: [0.9, 2.2, 2.6], d: 'FFN：1536 → 512 → GELU → 1536。' },
      { n: '注意力 3', c: COL.gen, p: [3, 0, 0], s: [1.4, 3.2, 2.6], d: '同第 1 块。三块合计约 3306 万参数，是噪声头的主体（我按层算的）。' },
      { n: 'FFN', c: COL.gen, p: [4.8, 0, 0], s: [0.9, 2.2, 2.6], d: 'FFN：1536 → 512 → GELU → 1536。' },
      { n: 'MLP\n768→384→6', c: COL.dis, p: [8, 0, 0], s: [2, 2.2, 2.2], d: 'prediction_head：1536 → 768 → ReLU → 384 → ReLU → 6。' },
      { n: 'ε̂ 平移 3 维', c: COL.far, p: [12.6, 0, 2], s: [2, 1, 1.5], d: '前 3 维交给 noise_scheduler_pos（scaled_linear）。' },
      { n: 'ε̂ 旋转 3 维', c: COL.ang, p: [12.6, 0, -2], s: [2, 1, 1.5], d: '后 3 维交给 noise_scheduler_rot（squaredcos_cap_v2）。' }
    ];
    const ms = parts.map(q => { const m = block(q.s[0], q.s[1], q.s[2], q.c, [q.p[0], q.s[1] / 2, q.p[2]]); m.userData.part = q; PICKS.push(m); G.add(m, lab(q.n, [q.p[0], q.s[1] + 0.75, q.p[2]], { size: q.n.length > 6 ? 19 : 20 })); return m; });
    for (let i = 0; i < 3; i++) wire(G, [[-11.8, 0.5, parts[i].p[2]], [-8.8, 0.8, 0]], COL.sim);
    for (let i = 3; i < 10; i++) wire(G, [[parts[i].p[0], 0.5, 0], [parts[i + 1].p[0], 0.5, 0]], COL.sim);
    wire(G, [[9, 0.5, 0], [11.6, 0.5, 2]], COL.sim); wire(G, [[9, 0.5, 0], [11.6, 0.5, -2]], COL.sim);
    const f = stream(G, 7, COL.enc);
    /* attention weights, really computed: softmax of scaled dot products */
    const r = Toy.mulberry(44), d = 192, Sq = STATE.tok4 ? 3 : 1, Q = Array.from({ length: Sq }, () => Array.from({ length: d }, () => Toy.gauss(r) * Math.sqrt(0.1)));
    const dots = Q.map(k => Q[0].reduce((s, v, i) => s + v * k[i], 0) / Math.sqrt(d)), ex = dots.map(Math.exp), sum = ex.reduce((a, b) => a + b, 0), wts = ex.map(v => v / sum);
    hud(250, 96, (g, fg, mu) => { g.fillStyle = fg; g.fillText(Sq === 1 ? '第 1 个 token 的注意力权重' : '假想 3 个 token 时的权重', 8, 16); g.fillStyle = mu; g.fillText('softmax(q·k / √192)；向量是随机数', 8, 33); wts.forEach((w, i) => { g.fillStyle = hexs(COL.gen); g.fillRect(8, 42 + i * 17, 180 * w, 12); g.fillStyle = fg; g.fillText(w.toFixed(3), 192, 52 + i * 17); }); });
    let picked = null;
    return { onPick(q) { picked = q; }, ctl: { groups: [{ label: '序列长', key: 'tok4', items: ['1（代码）', '3（假想对照）'] }] }, update(p) {
      const i = Math.min(ms.length - 1, Math.floor(p * ms.length)); ms.forEach((m, k) => glow(m, m.userData.part === picked ? 0.9 : (k === i && !picked ? 0.7 : 0)));
      f([[-13, 0.7, 0], [-8, 0.7, 0], [8, 0.7, 0], [12.6, 0.7, 0]], (p * 14) % 1, 1);
      cap(picked ? picked.d : parts[i].d);
    } };
  }

  /* ---------- scene 5 ---------- */
  function s5(G) {
    const T = T5S[STATE.T5], sp = Toy.sched(Toy.scaledLinear(T)), sr = Toy.sched(Toy.cosine(T)), of = base(), kap = of.kappa;
    const Nb = Math.min(T, 50), idx = i => Math.min(T - 1, Math.round(i * (T - 1) / Math.max(1, Nb - 1))), H = 5.5, bw = 7.6 / Nb;
    const mk = (x0, sc, col, name) => { const im = inst(BOX, Nb); G.add(im); for (let i = 0; i < Nb; i++) { const a = sc.ab[idx(i)], h = Math.max(0.02, a * H); setI(im, i, [x0 + (i + 0.5) * bw, h / 2, -3.6], [bw * 0.8, h, 0.6]); colI(im, i, hex3(col)); } done(im); G.add(lab(name, [x0 + 3.8, H + 1.1, -3.6], { size: 22 })); const end = sc.ab[T - 1]; G.add(lab(`ᾱ_T = ${end < 0.001 ? end.toExponential(1) : end.toFixed(4)}`, [x0 + 6.4, Math.max(0.5, end * H) + 0.6, -3.6], { size: 21, border: 'rgba(255,179,71,.8)' })); return im; };
    mk(-10.8, sp, COL.far, '平移：scaled_linear'); mk(3.2, sr, COL.ang, '旋转：squaredcos_cap_v2');
    const marks = [block(0.08, H + 0.3, 0.8, 0xffffff, [0, (H + 0.3) / 2, -3.6]), block(0.08, H + 0.3, 0.8, 0xffffff, [0, (H + 0.3) / 2, -3.6])]; G.add(...marks);
    /* below: the same 180 grasps under the forward process, translation left, rotation right */
    const Pc = 180, r = Toy.mulberry(55), eps = Array.from({ length: Pc }, () => [Toy.gauss(r), Toy.gauss(r), Toy.gauss(r)]), base2 = of.pos.slice(0, Pc), cA = clouds(Pc, 0.2), cB = clouds(Pc, 0.2); G.add(cA, cB);
    const gr1 = L.grid(11, 11), gr2 = L.grid(11, 11); gr1.position.set(-7, 0, 3.4); gr2.position.set(7, 0, 3.4); G.add(gr1, gr2);
    G.add(lab('平移 x = √ᾱ·κt + √(1−ᾱ)·ε', [-7, 0.2, 8.9], { size: 19, scale: 0.01 }), lab('轴角 r = √ᾱ·θ/π + √(1−ᾱ)·ε（绕圆显示）', [7, 0.2, 8.9], { size: 19, scale: 0.01 }));
    const ring = []; for (let i = 0; i <= 60; i++) { const a = i / 60 * 2 * Math.PI; ring.push([7 + 3.4 * Math.cos(a), 0.05, 3.4 + 3.4 * Math.sin(a)]); } wire(G, ring, COL.sim);
    const s0 = 2.3;
    return { ctl: { groups: [{ label: '总步数 T', key: 'T5', items: T5S.map(String) }] }, update(p) {
      const u = clamp(p / 0.86, 0, 1), t = Math.min(T - 1, Math.floor(u * T)), a = sp.ab[t], c = sr.ab[t], end = p > 0.9;
      const bi = Math.round(t * (Nb - 1) / Math.max(1, T - 1)); marks[0].position.x = -10.8 + (bi + 0.5) * bw; marks[1].position.x = 3.2 + (bi + 0.5) * bw;
      for (let i = 0; i < Pc; i++) { const q = base2[i], e = eps[i], x = end ? e[0] : Math.sqrt(a) * kap * q[0] + Math.sqrt(1 - a) * e[0], y = end ? e[1] : Math.sqrt(a) * kap * q[1] + Math.sqrt(1 - a) * e[1], th = end ? e[2] : Math.sqrt(c) * q[2] / Math.PI + Math.sqrt(1 - c) * e[2]; setPt(cA, i, [-7 + clamp(x, -2.3, 2.3) * s0, 0.15, 3.4 - clamp(y, -2.3, 2.3) * s0], end ? [1, 0.4, 0.75] : hex3(COL.far)); const ang = th * Math.PI; setPt(cB, i, [7 + 3.4 * Math.cos(ang), 0.15, 3.4 + 3.4 * Math.sin(ang)], end ? [1, 0.4, 0.75] : hex3(COL.ang)); }
      ptDone(cA, Pc); ptDone(cB, Pc);
      cap(end ? `粉色是<b>推理的起点</b> N(0, I)。平移的训练分布最多到 √(1−ᾱ) = <b>${Math.sqrt(1 - sp.ab[T - 1]).toFixed(3)}</b>，旋转到 <b>${Math.sqrt(1 - sr.ab[T - 1]).toFixed(3)}</b>` : `t = ${t}：平移 ᾱ = <b>${a.toFixed(4)}</b>，旋转 ᾱ = <b>${c < 0.001 ? c.toExponential(1) : c.toFixed(4)}</b>（T = ${T}）`);
    } };
  }

  /* ---------- scene 6 ---------- */
  const OUT = 2.6;
  function s6(G) {
    const T = T6S[STATE.T6], mode = MODES[STATE.mode6], g = gen(T, mode), P = ToyPlane(G, { s: 8 }), n = 300, gl = P.glyphs(n);
    const talT = (idx) => { const c = { ok: 0, collide: 0, far: 0, angle: 0, arc: 0 }; g.Sa.traj[idx].forEach(q => { const pz = g.Sa.toPose(q); c[Toy.simulate(pz[0], pz[1], pz[2]).why]++; }); return c; };
    const memo = {}; const tally = i => memo[i] || (memo[i] = talT(i));
    let last = -1;
    return { ctl: { groups: [{ label: '步数 T', key: 'T6', items: T6S.map(String) }, { label: '平移调度', key: 'mode6', items: ['scaled_linear（代码）', '余弦（对照）'] }] }, update(p) {
      const u = clamp((p - 0.04) / 0.86, 0, 1) * T, i = Math.min(T - 1, Math.floor(u)), f = u - i, A = g.Sa.traj[i], B = g.Sa.traj[Math.min(T, i + 1)], c = tally(Math.min(T, Math.round(u)));
      for (let k = 0; k < n; k++) { const a = g.Sa.toPose(A[k]), b = g.Sa.toPose(B[k]), x = clamp(L.lerp(a[0], b[0], f), -OUT, OUT), y = clamp(L.lerp(a[1], b[1], f), -OUT, OUT), th = L.lerp(a[2], b[2], f), st = Toy.simulate(x, y, th); gl.set(k, x, y, th, hex3(WHY[st.why])); }
      gl.done(n);
      const si = Math.round(u);
      if (si !== last) { last = si; hud(250, 134, (h, fg, mu) => { h.fillStyle = fg; h.fillText(`第 ${si} / ${T} 步，300 个样本`, 8, 16); hbars(h, fg, mu, 8, 26, 240, [['成功', c.ok, COL.ok], ['碰撞', c.collide, COL.col], ['太远', c.far, COL.far], ['角度/位置', c.angle + c.arc, COL.ang]], 300); h.fillStyle = mu; h.fillText(`1500 个样本终态成功率 ${(g.tal.c.ok / 15).toFixed(1)}%`, 8, 124); }); }
      const tNow = T - si;
      cap(p < 0.04 ? `从 N(0, I) 开始，每个点是一个抓取。小网络已当场训练好（T = ${T}）` : p < 0.9 ? `去噪中：还剩 <b>${tNow}</b> 步。两个绿圈之间、三段圆弧上的才可能成功` : `结束。网络只学过成功样本，1500 个里仍有 <b>${g.tal.c.collide}</b> 个碰撞、<b>${g.tal.c.far}</b> 个太远，这就是判别器要处理的`);
    } };
  }

  /* ---------- scene 7 ---------- */
  const TH7 = [0.2, 0.5, 0.7, 0.8, 0.85], B7 = [5, 25, 100, 500, 1500];
  function s7(G) {
    const d = dis('on'), sc = d.sc, P = ToyPlane(G, { s: 5.2, at: [-5, 0, 1] }), n = 300, gl = P.glyphs(n), th = TH7[STATE.th7], B = B7[STATE.b7], picked = sc.slice(0, B), kept = picked.filter(g => g.score >= th), prec = kept.length ? kept.filter(g => g.ok).length / kept.length : NaN, raw = picked.filter(g => g.ok).length / picked.length;
    const bl = [['物体 512', COL.enc, [3.2, 0, 3.0], [1.5, 1.2, 1.4]], ['抓取 512', COL.noise, [3.2, 0, 6.0], [1.5, 1.2, 1.4]], ['拼接 1024', COL.sim, [6.0, 0, 4.5], [1.2, 2.4, 2]], ['512', COL.dis, [8.2, 0, 4.5], [1, 1.8, 2]], ['256', COL.dis, [9.9, 0, 4.5], [0.9, 1.2, 2]], ['1 → sigmoid', COL.gen, [12.4, 0, 4.5], [0.8, 0.7, 2]]];
    const ms = bl.map(q => { const m = block(q[3][0], q[3][1], q[3][2], q[1], [q[2][0], q[3][1] / 2, q[2][2]]); G.add(m, lab(q[0], [q[2][0], q[3][1] + 0.7, q[2][2]], { size: 20 })); return m; });
    wire(G, [[4, 0.5, 3], [5.4, 0.8, 4.5]], COL.sim); wire(G, [[4, 0.5, 6], [5.4, 0.8, 4.5]], COL.sim); wire(G, [[6.6, 0.6, 4.5], [11.2, 0.4, 4.5]], COL.sim);
    G.add(lab('编码器冻结（论文）', [3.2, 2.7, 2.2], { size: 18 }));
    hud(250, 170, (h, fg, mu) => { h.fillStyle = fg; h.fillText(`B = ${B}，阈值 ${th}`, 8, 16); h.fillStyle = mu; h.fillText('玩具：同一批测试候选', 8, 33); hbars(h, fg, mu, 8, 42, 240, [['不过滤', +(raw * 100).toFixed(1), COL.sim, (raw * 100).toFixed(1) + '%'], ['过滤后', isNaN(prec) ? 0 : +(prec * 100).toFixed(1), COL.gen, isNaN(prec) ? '无候选' : (prec * 100).toFixed(1) + '%'], ['保留数', kept.length / B * 100, COL.dis, `${kept.length}`]], 125); h.fillStyle = mu; h.fillText('显存（图 11 柱高读数）', 8, 118); hbars(h, fg, mu, 8, 124, 240, [['GraspNet', 34053, COL.sim, '34053'], ['GraspGen', 1611, COL.gen, '1611 MiB']], 42000); });
    return { ctl: { groups: [{ label: '阈值', key: 'th7', items: TH7.map(String) }, { label: '批大小', key: 'b7', items: B7.map(String) }] }, update(p) {
      const a = seg(p, 0.15, 0.55), b = seg(p, 0.62, 0.88), f = (p * 18) % 1;
      for (let k = 0; k < n; k++) { const g = sc[k], c = scoreCol(g.score), drop = g.score < th, op = drop ? L.lerp(1, 0.08, b) : 1, base = [0.5, 0.56, 0.7], col = [L.lerp(base[0], c[0], a), L.lerp(base[1], c[1], a), L.lerp(base[2], c[2], a)]; gl.set(k, clamp(g.x, -1.4, 1.4), clamp(g.y, -1.4, 1.4), g.th, col, 0.12, op); }
      gl.done(n); ms.forEach((m, i) => glow(m, Math.floor(f * ms.length) === i ? 0.6 : 0));
      cap(p < 0.15 ? '生成的候选一开始没有分数' : p < 0.62 ? '判别器给每个候选打分：<b>绿色高，红色低</b>' : `低于 ${th} 的淡出：留下 <b>${kept.length}</b> 个，精度 <b>${isNaN(prec) ? '—' : (prec * 100).toFixed(1) + '%'}</b>（不过滤 ${(raw * 100).toFixed(1)}%）`);
    } };
  }

  /* ---------- scene 8 ---------- */
  const SETS = ['off', 'on', 'both'], SETN = ['离线', 'On-Generator', '两者混合'], SETC = [COL.col, COL.gen, COL.obj];
  function heat(D, name) {
    const k = 'h' + name; if (STORE[k]) return STORE[k];
    const N = 150, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), im = g.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = (i / (N - 1) - 0.5) * 2.4, y = (0.5 - j / (N - 1)) * 2.4, s = D(x, y, Toy.wrap(Toy.normalAng(x, y) + Math.PI)), col = scoreCol(s), o = (j * N + i) * 4; im.data[o] = col[0] * 255; im.data[o + 1] = col[1] * 255; im.data[o + 2] = col[2] * 255; im.data[o + 3] = s > 0.5 ? 70 + 150 * (s - 0.5) * 2 : 4 + 30 * (0.5 - s) * 2; }
    g.putImageData(im, 0, 0); return STORE[k] = c;
  }
  function s8(G) {
    const kind = SETS[STATE.set8], all = SETS.map(dis), d = all[STATE.set8], P = ToyPlane(G, { s: 6.4, at: [-2.4, 0, 1.2], grid: false }), W = P.W, n = 260, gl = P.glyphs(n);
    const tx = new THREE.CanvasTexture(heat(d.D, kind)); const hm = new THREE.Mesh(new THREE.PlaneGeometry(15.36, 15.36), new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0.8, depthWrite: false })); hm.rotation.x = -Math.PI / 2; hm.position.set(-2.4, 0.005, 1.2); G.add(hm);
    const items = d.items.filter((_, i) => i % Math.ceil(d.items.length / 700) === 0).slice(0, 700), dots = clouds(items.length, 0.13); G.add(dots);
    items.forEach((it, i) => setPt(dots, i, W(it[0], it[1], 0.1), it[3] ? hex3(COL.ok) : hex3(COL.col))); ptDone(dots, items.length);
    const lab5 = ['算 κ', '训练 G', '采样 Ĝ', '仿真标注', '训练 D'], cl = [COL.time, COL.gen, COL.noise, COL.sim, COL.dis], ms = lab5.map((t, i) => { const m = block(2, 0.7, 0.9, cl[i], [-10.4 + i * 2.8, 0.4, -6.8]); G.add(m, lab(t, [-10.4 + i * 2.8, 1.35, -6.8], { size: 19 })); return m; });
    for (let i = 0; i < 4; i++) wire(G, [[-10.4 + i * 2.8, 0.4, -6.8], [-7.6 + i * 2.8, 0.4, -6.8]], COL.sim);
    const sampleSel = d.sc.slice().sort((a, b) => b.score - a.score);
    hud(258, 262, (h, fg, mu) => {
      const X = 34, Y = 12, W2 = 212, H2 = 118; h.strokeStyle = mu; h.strokeRect(X, Y, W2, H2);
      h.fillStyle = mu; h.fillText('1', 18, Y + 9); h.fillText('0', 18, Y + H2); h.fillText('覆盖率', X + 84, Y + H2 + 14); h.save(); h.translate(13, Y + 76); h.rotate(-Math.PI / 2); h.fillText('精度', 0, 0); h.restore();
      all.forEach((v, k) => { h.strokeStyle = hexs(SETC[k]); h.lineWidth = k === STATE.set8 ? 2.6 : 1.1; h.beginPath(); v.pc.curve.forEach((q, i) => { if (i % 6) return; const xx = X + q[0] * W2, yy = Y + H2 - q[1] * H2; i ? h.lineTo(xx, yy) : h.moveTo(xx, yy); }); h.stroke(); });
      h.lineWidth = 1; all.forEach((v, k) => { h.fillStyle = hexs(SETC[k]); h.fillRect(8, 155 + k * 19, 10, 10); h.fillStyle = k === STATE.set8 ? fg : mu; h.fillText(`${SETN[k]}  AUC ${v.pc.auc.toFixed(3)}  碰撞 ${v.topc.collide}`, 24, 165 + k * 19); });
      h.fillStyle = mu; h.fillText('“碰撞”：top-100 里的碰撞候选数', 8, 228); h.fillText('玩具结果，当场训练', 8, 246);
    });
    return { ctl: { groups: [{ label: '判别器的训练集', key: 'set8', items: SETN }] }, update(p) {
      const tr = seg(p, 0.02, 0.34), sc2 = seg(p, 0.42, 0.62), st = clamp(Math.floor((p / 0.38) * 5), 0, 4);
      ms.forEach((m, i) => glow(m, p < 0.38 ? (kind === 'off' && (i === 2 || i === 3) ? 0 : (i === st ? 0.85 : 0)) : 0.18));
      dots.material.opacity = 0.95 * (1 - sc2); dots.visible = sc2 < 1; hm.material.opacity = 0.75 * sc2; hm.visible = sc2 > 0;
      for (let k = 0; k < n; k++) { const g = d.sc[k], c = scoreCol(g.score); gl.set(k, clamp(g.x, -1.25, 1.25), clamp(g.y, -1.25, 1.25), g.th, c, 0.14, sc2); } gl.done(sc2 > 0 ? n : 0);
      const tc = d.topc;
      cap(p < 0.42 ? (kind === 'off' ? '<b>离线训练集：</b>跳过“采样、标注”两步。负样本（红点）全部在碰撞边界以外' : kind === 'on' ? '<b>On-Generator：</b>用生成器采样、仿真标注。红点里有贴在物体上的碰撞样本' : '<b>混合：</b>离线和 On-Generator 放在一起') : p < 0.72 ? `热图是“朝向正确”时的分数：离线判别器${kind === 'off' ? '<b>在贴近物体处仍给高分</b>' : '的那块高分区，这里被压下去了'}` : `按分数取 top-100：成功 <b>${tc.ok}</b>，碰撞 <b>${tc.collide}</b>，太远 ${tc.far}，其他 ${tc.angle + tc.arc}。AUC <b>${d.pc.auc.toFixed(3)}</b>`);
    } };
  }

  /* ---------- scene 9 ---------- */
  function hungarian(C) { /* O(n^3) assignment */
    const n = C.length, u = new Float64Array(n + 1), v = new Float64Array(n + 1), p = new Int32Array(n + 1), way = new Int32Array(n + 1);
    for (let i = 1; i <= n; i++) { p[0] = i; let j0 = 0; const minv = new Float64Array(n + 1).fill(Infinity), used = new Uint8Array(n + 1); do { used[j0] = 1; const i0 = p[j0]; let delta = Infinity, j1 = 0; for (let j = 1; j <= n; j++) if (!used[j]) { const cur = C[i0 - 1][j - 1] - u[i0] - v[j]; if (cur < minv[j]) { minv[j] = cur; way[j] = j0; } if (minv[j] < delta) { delta = minv[j]; j1 = j; } } for (let j = 0; j <= n; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; j0 = j1; } while (p[j0] !== 0); do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0); }
    const m = new Int32Array(n); for (let j = 1; j <= n; j++) m[p[j] - 1] = j - 1; return m;
  }
  const poseD = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) + Math.abs(Toy.wrap(a[2] - b[2]));
  function emd(A, B, n, seed, reps = 5) { const r = Toy.mulberry(seed); let tot = 0, lastM = null, la = null, lb = null; for (let k = 0; k < reps; k++) { const a = Array.from({ length: n }, () => A[Math.floor(r() * A.length)]), b = Array.from({ length: n }, () => B[Math.floor(r() * B.length)]), C = a.map(x => b.map(y => poseD(x, y))), m = hungarian(C); let s = 0; m.forEach((j, i) => s += C[i][j]); tot += s / n; lastM = m; la = a; lb = b; } return { v: tot / reps, m: lastM, a: la, b: lb }; }
  function emdAll() { if (STORE.emd) return STORE.emd; const of = base(), g = gen(10, 'code'), onP = g.big.poses.filter((_, i) => g.tal.lab[i].ok), onN = g.big.poses.filter((_, i) => !g.tal.lab[i].ok), mid = A => A.length >> 1; const r = { pos: emd(of.pos, onP, 120, 1), neg: emd(of.neg, onN, 120, 2), posB: emd(of.pos, of.pos, 120, 3), negB: emd(of.neg, of.neg, 120, 4), onN, onP }; return STORE.emd = r; }
  function s9(G) {
    const E = emdAll(), of = base(), PL = ToyPlane(G, { s: 3.6, at: [-7.4, 0, 0.6] }), PR = ToyPlane(G, { s: 3.6, at: [3.4, 0, 0.6] }), n = 120, gA = PL.glyphs(n, 0.1), gB = PR.glyphs(n, 0.1);
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3)), new THREE.LineBasicMaterial({ color: 0xbcc8e0, transparent: true, opacity: 0.22 })); lines.frustumCulled = false; G.add(lines);
    const a = E.neg.a, b = E.neg.b, m = E.neg.m, K = 1.45;
    G.add(lab('离线负样本（不碰撞）', [-7.4, 0.2, -5.6], { size: 21 }), lab('生成器负样本', [3.4, 0.2, -5.6], { size: 21 }));
    /* histogram of signed distance */
    const bins = 26, lo = -0.2, hi = 1.1, hist = A => { const h = new Array(bins).fill(0); A.forEach(q => { const d = Toy.sdf(q[0], q[1]), i = Math.floor((d - lo) / (hi - lo) * bins); if (i >= 0 && i < bins) h[i]++; }); const s = A.length; return h.map(v => v / s); }, hA = hist(of.neg), hB = hist(E.onN), mx = Math.max(...hA, ...hB);
    hud(258, 212, (h, fg, mu) => {
      const X = 12, Y = 10, W2 = 234, H2 = 86; h.strokeStyle = mu; h.strokeRect(X, Y, W2, H2); const xz = X + (Toy.BAND[0] - lo) / (hi - lo) * W2; h.setLineDash([3, 3]); h.beginPath(); h.moveTo(xz, Y); h.lineTo(xz, Y + H2); h.stroke(); h.setLineDash([]);
      hA.forEach((v, i) => { h.fillStyle = 'rgba(142,155,184,.75)'; h.fillRect(X + i * W2 / bins, Y + H2 - v / mx * H2, W2 / bins - 1, v / mx * H2); }); hB.forEach((v, i) => { h.fillStyle = 'rgba(255,93,93,.6)'; h.fillRect(X + i * W2 / bins, Y + H2 - v / mx * H2, W2 / bins - 1, v / mx * H2); });
      h.fillStyle = mu; h.fillText('到物体的距离；虚线是碰撞边界', 12, Y + H2 + 15); h.fillStyle = 'rgba(142,155,184,1)'; h.fillRect(12, 118, 10, 10); h.fillStyle = fg; h.fillText('离线负样本', 26, 127); h.fillStyle = '#ff5d5d'; h.fillRect(110, 118, 10, 10); h.fillStyle = fg; h.fillText('生成器负样本', 124, 127);
      hbars(h, fg, mu, 12, 138, 240, [['负 EMD', +E.neg.v.toFixed(3), COL.col], ['负 对照', +E.negB.v.toFixed(3), COL.sim], ['正 EMD', +E.pos.v.toFixed(3), COL.ok], ['正 对照', +E.posB.v.toFixed(3), COL.sim]], Math.max(E.neg.v, E.negB.v) * 1.1, 18);
    });
    return { update(p) {
      const a1 = seg(p, 0.02, 0.3), a2 = seg(p, 0.35, 0.78), A = lines.geometry.attributes.position.array;
      for (let i = 0; i < n; i++) { const q = a[i], z = b[m[i]]; gA.set(i, clamp(q[0], -K, K), clamp(q[1], -K, K), q[2], [0.6, 0.66, 0.78], 0.1, a1); const why = Toy.simulate(z[0], z[1], z[2]).why; gB.set(i, clamp(z[0], -K, K), clamp(z[1], -K, K), z[2], hex3(WHY[why]), 0.1, a1); const on = i / n < a2; const u = PL.W(clamp(q[0], -K, K), clamp(q[1], -K, K), 0.1), v = PR.W(clamp(z[0], -K, K), clamp(z[1], -K, K), 0.1); A.set(on ? u : u, i * 6); A.set(on ? v : u, i * 6 + 3); }
      gA.done(n); gB.done(n); lines.geometry.attributes.position.needsUpdate = true;
      cap(p < 0.35 ? '同一个物体的两批负样本。右边<b>红色</b>的已经碰到物体，左边一个都没有' : p < 0.8 ? '求一一配对，使总距离最小。这是线性指派问题' : `负样本 EMD <b>${E.neg.v.toFixed(3)}</b>（同分布对照 ${E.negB.v.toFixed(3)}）；正样本 <b>${E.pos.v.toFixed(3)}</b>（对照 ${E.posB.v.toFixed(3)}）`);
    } };
  }

  /* ---------- scene 10 ---------- */
  function s10(G) {
    const isGan = STATE.gan === 1, g = gen(10, 'code'), d = dis('on'), n = 300, P = ToyPlane(G, { s: 5, at: [-7, 0, 1] }), gl = P.glyphs(n, 0.08), pose = g.Sa.poses, lab0 = g.talS.lab;
    const blG = block(2.8, 1.6, 1.8, COL.gen, [4, 0.8, -2.8]), blD = block(2.8, 1.6, 1.8, COL.dis, [10.6, 0.8, -2.8]), blSim = block(2.8, 1.1, 1.6, COL.sim, [7.3, 0.55, 2.8]), blE = block(2.4, 0.9, 1.4, COL.noise, [4, 0.45, 2.8]);
    G.add(blG, blD, lab('生成器 G', [4, 2.4, -2.8], { size: 22 }), lab('判别器 D', [10.6, 2.4, -2.8], { size: 22 }));
    if (!isGan) G.add(blSim, lab('仿真（不可微）', [7.3, 1.8, 2.8], { size: 21 }), blE, lab('噪声 ε 回归\n‖ε − ε̂‖²', [3.4, 2.1, 3.0], { size: 19 }));
    const fwd = stream(G, 6, COL.enc), back = stream(G, 7, COL.grad, 0.17), dat = stream(G, 6, COL.sim), noi = stream(G, 5, COL.noise);
    if (isGan) { wire(G, [[9.2, 1.2, -2.2], [5.4, 1.2, -2.2]], COL.grad, { opacity: 0.9 }); G.add(lab('∇θ log D(G(z))：D 的梯度更新 G', [7.3, 3.5, -0.5], { size: 21, border: 'rgba(255,122,89,.9)' })); }
    else { G.add(lab('没有这条路径', [7.3, 3.0, -2.8], { size: 21, border: 'rgba(142,155,184,.8)' })); wire(G, [[9.2, 1.0, -2.8], [5.4, 1.0, -2.8]], COL.sim, { opacity: 0.25, dashed: true, dash: 0.25, gap: 0.2 }); }
    /* the gradient of the toy D with respect to the sample, by central differences */
    const arrows = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(90 * 6), 3)), new THREE.LineBasicMaterial({ color: 0xff5a00 })); arrows.frustumCulled = false; G.add(arrows);
    for (let i = 0; i < 90; i++) { const q = pose[i * 3], h = 0.01, gx = (d.D(q[0] + h, q[1], q[2]) - d.D(q[0] - h, q[1], q[2])) / (2 * h), gy = (d.D(q[0], q[1] + h, q[2]) - d.D(q[0], q[1] - h, q[2])) / (2 * h), m = Math.hypot(gx, gy) || 1, l = Math.min(0.2, 0.05 + m * 0.03); const a = P.W(clamp(q[0], -1.3, 1.3), clamp(q[1], -1.3, 1.3), 0.14), b = P.W(clamp(q[0], -1.3, 1.3) + gx / m * l, clamp(q[1], -1.3, 1.3) + gy / m * l, 0.14); arrows.geometry.attributes.position.array.set(a, i * 6); arrows.geometry.attributes.position.array.set(b, i * 6 + 3); }
    arrows.visible = isGan;
    const pos = g.tal.c.ok, tot = 1500;
    hud(250, 112, (h, fg, mu) => { h.fillStyle = fg; h.fillText(isGan ? 'GAN 的标签（1500 个生成样本）' : 'GraspGen 的标签（1500 个生成样本）', 8, 16); hbars(h, fg, mu, 8, 26, 240, isGan ? [['正例', 0, COL.ok, '0'], ['负例', tot, COL.col, String(tot)]] : [['正例', pos, COL.ok], ['负例', tot - pos, COL.col]], tot); h.fillStyle = mu; h.fillText(isGan ? `其中 ${pos} 个其实能抓起来` : '正负来自玩具仿真，来源不决定标签', 8, 86); });
    return { ctl: { groups: [{ label: '框架', key: 'gan', items: ['GraspGen', 'GAN（对照）'] }] }, update(p) {
      const a = seg(p, 0.02, 0.3), q = (p * 16) % 1;
      for (let k = 0; k < n; k++) { const z = pose[k], c = isGan ? hex3(COL.col) : hex3(WHY[lab0[k].why] === COL.ok ? COL.ok : COL.col), base2 = [0.55, 0.6, 0.72]; gl.set(k, clamp(z[0], -1.3, 1.3), clamp(z[1], -1.3, 1.3), z[2], [L.lerp(base2[0], c[0], a), L.lerp(base2[1], c[1], a), L.lerp(base2[2], c[2], a)], 0.12, isGan ? 0.4 : 1); } gl.done(n);
      fwd(isGan ? [[5.4, 0.8, -2.8], [9.2, 0.8, -2.8]] : [[4, 0.8, -1.8], [5.8, 0.7, 2.2], [7.3, 0.6, 2.8]], q, 1);
      back([[9.2, 1.2, -2.2], [5.4, 1.2, -2.2]], q, isGan ? 1 : 0); dat([[8.7, 0.6, 2.2], [10.6, 0.8, -1.8]], q, isGan ? 0 : 1); noi([[4, 0.6, 2.2], [4, 0.6, -1.8]], q, isGan ? 0 : 1);
      glow(blG, 0.2); glow(blD, 0.2);
      cap(isGan ? `GAN：每个生成样本都标成“假”。D 的梯度（橙色）穿过 D 回到 G，<b>${pos}</b> 个成功抓取也被当成负例` : `GraspGen：G 只靠噪声回归学习。G 的样本经仿真贴标签后给 D，<b>${pos}</b> 个成功样本就是正例`);
    } };
  }

  /* ---------- scene 11 ---------- */
  const RES = {
    t1: { title: '表 1：真机抓取成功率 (%)', cols: ['孤立', '桌面', '篮内', '货架', '总体'], rows: [['GraspGen', [90.5, 83.3, 80.0, 71.4, 81.3], COL.gen], ['M2T2', [81.0, 75.0, 40.0, 14.3, 52.6], COL.col], ['AnyGrasp', [85.7, 83.3, 42.9, 42.9, 63.7], COL.obj]] },
    f4: { title: '图 4：FetchBench 成功率 (%)', cols: ['任务', '抓取', '篮内', '货架', '桌面', '抽屉'], rows: [['Oracle', [49.4, 65.3, 60.7, 59.2, 72.4, 75.0], COL.sim], ['Contact-GraspNet', [26.1, 34.2, 32.8, 24.5, 46.2, 44.8], COL.ang], ['M2T2', [33.4, 43.3, 40.9, 38.0, 49.4, 51.3], COL.col], ['GraspGen 部分点云', [39.1, 51.1, 48.9, 47.6, 59.0, 51.7], COL.obj], ['GraspGen 完整点云', [41.2, 53.3, 48.1, 49.3, 63.5, 53.9], COL.gen]] },
    auc: { note: '。Robotiq 的 SE3-Diff 配的是 GraspGen 判别器，DexDiffuser 没测', title: '图 3、图 9：精度-覆盖率 AUC (×100)', cols: ['Franka', 'Robotiq'], rows: [['GraspGen', [94.668, 68.873], COL.gen], ['M2T2', [63.592, 24.265], COL.col], ['DexDiffuser', [34.356, null], COL.ang], ['SE3-Diff', [19.957, 43.19], COL.far]] }
  };
  function bars3D(G, data) {
    G.add(L.grid(40, 40));
    const nC = data.cols.length, nR = data.rows.length, gap = 26 / nC, bw = Math.min(1.1, (gap - 1.1) / nR), sc = 0.085, X0 = -13 + gap / 2;
    const items = [];
    data.cols.forEach((c, i) => G.add(lab(c, [X0 + i * gap, -0.5, 1.8], { size: 23 })));
    data.rows.forEach((r, k) => { const m = inst(BOX, nC); G.add(m); r[1].forEach((v, i) => colI(m, i, hex3(r[2]))); const lb = []; r[1].forEach((v, i) => { const x = X0 + i * gap + (k - (nR - 1) / 2) * bw; if (v != null) { const l = lab(v.toFixed(data.cols.length === 2 ? 3 : 1).replace(/^(\d+\.\d)00$/, '$1'), [x, v * sc + 0.45, 0], { size: 14, scale: 0.0105 }); G.add(l); lb.push(l); } }); items.push({ m, r, lb }); });
    hud(190, 16 + nR * 18, (h, fg) => data.rows.forEach((r, k) => { h.fillStyle = hexs(r[2]); h.fillRect(8, 8 + k * 18, 10, 10); h.fillStyle = fg; h.fillText(r[0], 24, 17 + k * 18); }));
    return p => { const a = seg(p, 0.03, 0.55); items.forEach(({ m, r }, k) => { r[1].forEach((v, i) => { const x = X0 + i * gap + (k - (nR - 1) / 2) * bw, h = Math.max(0.001, (v == null ? 0 : v) * sc * a); setI(m, i, [x, h / 2, 0], [bw * 0.84, h, 1.2]); }); done(m); }); items.forEach(it => it.lb.forEach(l => { l.visible = a > 0.95; })); cap(`<b>${data.title}</b>。论文原数，不是这一页算的${data.note || ''}`); };
  }
  function s11(G) {
    const m = STATE.res, ctl = { groups: [{ label: '看', key: 'res', items: ['规划器筛选（玩具）', '表 1 真机', '图 4 FetchBench', '图 3/9 AUC'] }] };
    if (m === 1) return { ctl, update: bars3D(G, RES.t1) };
    if (m === 2) return { ctl, update: bars3D(G, RES.f4) };
    if (m === 3) return { ctl, update: bars3D(G, RES.auc) };
    const d = dis('on'), P1 = ToyPlane(G, { s: 4, at: [-6.4, 0, 0] }), P2 = ToyPlane(G, { s: 4, at: [6.4, 0, 0] }), top = d.sc.filter(g => g.score >= 0.7).slice(0, 100), g1 = P1.glyphs(100), g2 = P2.glyphs(100);
    /* a narrow set: same number of successful grasps, all from one arc */
    const narrow = base().pos.filter(q => { const a = Toy.polar(q[0], q[1]); return a >= Toy.ARCS[0][0] && a <= Toy.ARCS[0][1]; }).slice(0, 100);
    G.add(lab('过阈值的 100 个', [-6.4, 0.2, -5.7], { size: 22 }), lab('同样 100 个，但只有一段圆弧', [6.4, 0.2, -5.7], { size: 22 }));
    const mkW = () => { const w = block(0.2, 1.0, 6.6, COL.sim, [0, 0.5, 0], { opacity: 0.45 }); G.add(w); return w; }, w1 = mkW(), w2 = mkW();
    const blocked = (q, ang) => { const px = q[0] * Math.cos(ang) + q[1] * Math.sin(ang); return px > 0.28 * 1 - 0.0 && Math.abs(-q[0] * Math.sin(ang) + q[1] * Math.cos(ang)) < 0.95; };
    /* a pure function: the fraction left, over the whole sweep, drawn in the HUD */
    const left = (S, ang) => S.filter(q => !blocked(Array.isArray(q) ? q : [q.x, q.y], ang)).length;
    const N = 72, curve1 = [], curve2 = []; for (let i = 0; i <= N; i++) { const a = i / N * 2 * Math.PI; curve1.push(left(top, a)); curve2.push(left(narrow, a)); }
    const lastI = { v: -1 };
    return { ctl, update(p) {
      const ang = p * 2 * Math.PI, i = Math.round(p * N);
      const place = (w, at) => { w.position.set(at + Math.cos(ang) * 0.5 * 4, 0.5, -Math.sin(ang) * 0.5 * 4); w.rotation.y = ang; }; place(w1, -6.4); place(w2, 6.4);
      top.forEach((g, k) => { const b = blocked([g.x, g.y], ang), c = b ? [0.3, 0.33, 0.4] : hex3(WHY[g.why]); g1.set(k, clamp(g.x, -1.3, 1.3), clamp(g.y, -1.3, 1.3), g.th, c, 0.14, b ? 0.3 : 1); }); g1.done(100);
      narrow.forEach((q, k) => { const b = blocked(q, ang), c = b ? [0.3, 0.33, 0.4] : hex3(COL.ok); g2.set(k, q[0], q[1], q[2], c, 0.14, b ? 0.3 : 1); }); g2.done(narrow.length);
      if (lastI.v !== i) { lastI.v = i; hud(250, 118, (h, fg, mu) => { const X = 10, Y = 22, W2 = 230, H2 = 70; h.fillStyle = fg; h.fillText(`墙转过 ${Math.round(p * 360)}°：剩 ${curve1[i]} 对 ${curve2[i]}`, 10, 15); h.strokeStyle = mu; h.strokeRect(X, Y, W2, H2); [[curve1, COL.gen], [curve2, COL.far]].forEach(([cv, cc]) => { h.strokeStyle = hexs(cc); h.lineWidth = 1.8; h.beginPath(); cv.forEach((v, j) => { const x = X + j / N * W2, y = Y + H2 - v / 100 * H2; j ? h.lineTo(x, y) : h.moveTo(x, y); }); h.stroke(); }); h.lineWidth = 1; h.strokeStyle = fg; const x = X + p * W2; h.beginPath(); h.moveTo(x, Y); h.lineTo(x, Y + H2); h.stroke(); h.fillStyle = mu; h.fillText('绿：多样  黄：集中', 10, 110); }); }
      cap(`一面墙绕物体转：灰色的候选被“规划器”过滤。左边最少还剩 <b>${Math.min(...curve1)}</b> 个，右边最少剩 <b>${Math.min(...curve2)}</b> 个`);
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player ---------- */
  let cur = 0, api = null, playing = !L.reduced(), t0 = 0, pNow = 0, tw = null;
  const HOLD = 1.8;
  const aspectFix = () => { const el = $('stage'), asp = (el.clientWidth || 1) / (el.clientHeight || 1); return Math.min(2.2, Math.max(1, 1.45 / asp)); };
  function fly(th, ph, d, tg) { let dth = th - S.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth)); d *= aspectFix(); tw = { t0: performance.now(), from: [S.theta, S.phi, S.dist, S.target.clone()], to: [S.theta + dth, ph, d, new THREE.Vector3(...tg)] }; refDist = d; }
  function setPlay(on) { playing = on; $('play').textContent = on ? '❚❚ 暂停' : '▶ 播放'; $('play').setAttribute('aria-label', on ? '暂停' : '播放'); }
  function renderCtl() {
    const box = $('ctl');
    if (!api.ctl) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = api.ctl.groups.map((g, gi) => `<div class="grp"><span>${g.label}</span>` + g.items.map((t, k) => `<button type="button" data-g="${g.key}" data-k="${k}" aria-pressed="${STATE[g.key] === k}">${t}</button>`).join('') + '</div>').join('');
  }
  function build(p0, keepCam) {
    L.clear(root); LABS = []; PICKS = []; lastCap = null; hudEl.hidden = true;
    const sc = SCENES[cur]; if (!keepCam) { fly(...sc.cam); refDist = sc.cam[2] * aspectFix(); }
    const G = new THREE.Group(); root.add(G); api = BUILD[cur](G); renderCtl();
    pNow = p0; t0 = performance.now() - p0 * sc.dur * 1000; api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
  }
  function go(i, p0 = 0) { cur = (i + SCENES.length) % SCENES.length; showInfo(cur); if (!S) return; build(p0); }
  if (S) {
    S.onTick(() => {
      if (playing && api) { const sc = SCENES[cur], el = (performance.now() - t0) / 1000; if (el > sc.dur + HOLD) { t0 = performance.now(); pNow = 0; } else pNow = Math.min(1, el / sc.dur); api.update(pNow); $('scrub').value = Math.round(pNow * 1000); }
      if (tw) { const k = L.reduced() ? 1 : Math.min(1, (performance.now() - tw.t0) / 900), e = L.ease(k), [a, b] = [tw.from, tw.to]; S.setView(L.lerp(a[0], b[0], e), L.lerp(a[1], b[1], e), L.lerp(a[2], b[2], e), [L.lerp(a[3].x, b[3].x, e), L.lerp(a[3].y, b[3].y, e), L.lerp(a[3].z, b[3].z, e)]); if (k >= 1) tw = null; }
      const f = clamp(S.dist / refDist, 0.6, 1.6); for (const sp of LABS) sp.scale.copy(sp.userData.s0).multiplyScalar(f);
    });
    S.onClick(() => PICKS, hit => { const o = hit?.object; const g = o?.userData?.go ?? o?.parent?.userData?.go, q = o?.userData?.part ?? o?.parent?.userData?.part; if (g != null) go(g); else if (q && api?.onPick) { api.onPick(q); api.update(pNow); } });
    S.onHover(() => PICKS, hit => { $('stage').style.cursor = hit ? 'pointer' : ''; });
  }
  $('ctl').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const key = b.dataset.g, k = +b.dataset.k; if (STATE[key] === k) return; STATE[key] = k; const box = $('ctl'); box.querySelectorAll(`[data-g="${key}"]`).forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.k === k))); $('cap').textContent = '计算中…'; setTimeout(() => build(pNow, true), 30); });
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
