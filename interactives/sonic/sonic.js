'use strict';
/* SONIC (arXiv 2511.07820v4) taken apart into eleven animated scenes. Network sizes and hyperparameters come from
   the paper's Tables S1 and S2 and from official repo commit 1e1ec4f; bars in scenes 2, 5 and 10 use the authors'
   Data S1 (Zenodo 10.5281/zenodo.21273312) or the paper's tables. Every scene builds into its own group and exposes
   update(p), a pure function of timeline p in [0,1] and of the scene's toggles, so pausing, scrubbing and looping are
   one call. No policy runs here. Robots are hand-made figures. The FSQ, reward, sampling, spring, latent-alignment
   and termination numbers are computed live by the formulas named beside them, on toy inputs. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { task: 0x8e9bb8, gen: 0x7cb8ff, mot: 0xc9d4ea, er: 0x4fc98a, eh: 0x38d1ff, em: 0x9d8cff, q: 0xf2c14e, z: 0xffd98a, dc: 0xff7a59, dr: 0xd45fa0, crit: 0x7d8cff, ref: 0xe05d5d, robot: 0xc9d4ea, grad: 0xff7a59, dim: 0x3a4660 };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  /* Fig. 2A-C, authors' Data S1. sr = success %, mm = MPJPE-L, per test set: content, repetition */
  const AX = [
    { key: '数据', unit: '帧', pts: [
      { x: '4M 帧', d: '20k 片段', c: [98.83, 24.37], r: [99.58, 22.71], n: 6 },
      { x: '10M 帧', d: '50k 片段', c: [99.24, 24.17], r: [99.70, 22.62], n: 6 },
      { x: '22M 帧', d: '110k 片段', c: [99.38, 23.87], r: [99.77, 22.37], n: 6 },
      { x: '100M 帧', d: '317k 片段', c: [99.63, 23.77], r: [99.77, 22.50], n: 6 }] },
    { key: '容量', unit: '参数', pts: [
      { x: '1.2M 参数', d: '结构论文没写', c: [98.03, 27.70], r: [98.65, 26.50], n: 6 },
      { x: '16M 参数', d: '结构论文没写', c: [99.15, 24.64], r: [99.63, 23.63], n: 6 },
      { x: '42M 参数', d: '表 S1 的结构', c: [99.63, 23.77], r: [99.77, 22.50], n: 6 }] },
    { key: '算力', unit: 'GPU·h', pts: [
      { x: '约 2k GPU·h', d: '16 卡 2 节点', g: 16, c: [98.90, 26.63], r: [99.48, 25.29], n: 4 },
      { x: '约 9k GPU·h', d: '32 卡 4 节点', g: 32, c: [99.09, 25.26], r: [99.68, 24.10], n: 6 },
      { x: '约 21k GPU·h', d: '128 卡 16 节点', g: 128, c: [99.63, 23.77], r: [99.77, 22.50], n: 6 }] }
  ];
  /* Table 3(B), 32 GPUs: [L levels, D dims, SR content, MPJPE content, SR rep, MPJPE rep] */
  const FSQ_T = { '16-16': [96.9, 35.7, 97.5, 32.7], '16-32': [98.3, 29.7, 98.7, 28.4], '32-16': [98.3, 30.3, 98.4, 28.9], '32-32': [98.8, 27.5, 99.3, 26.3] };

  const SCENES = [
    { n: 1, part: '总览', title: '一个策略，多种输入', sub: '任务 → 动作生成器 → 动作 → 编码器 → 通用 token → 解码器', dur: 16, cam: [0.08, 1.02, 41, [0.2, 3.0, 0.4]],
      html: dl([['编码器', '机器人 ℰr、混合 ℰm、人体 ℰh'], ['量化器', 'FSQ，2 个 token，每个 32 维 32 级'], ['解码器', '控制 𝒟c（输出 29 维动作），动作 𝒟r（重建，辅助）'], ['训练', 'PPO 加三项辅助损失，一起端到端']]) +
        '<p>这张图是原文图 6 的 3D 版。关键在中间那个瓶颈：不管上游是手柄、VR 还是视频，到这里都变成同一种 token，后面的控制解码器不用知道来源。换接口就是换编码器，不用重新训练。</p>' +
        '<p>按上方按钮切一条路线。点任何一个方块跳到讲它的那一幕。</p>' + src('§3.2 · 图 6') },
    { n: 2, part: '放大', title: '三根轴，一次动一根', sub: '切换轴和放大档位。柱子是作者 Data S1 的原始均值', dur: 15, cam: [0.1, 1.12, 40, [0.4, 3.8, 0]],
      html: dl([['数据', '4M、10M、22M、100M 帧'], ['容量', '1.2M、16M、42M 参数'], ['算力', '16、32、128 卡，都训到 5 万次迭代']]) +
        '<p>论文的主张：三根轴都放大，效果都变好，而且未见过的动作（test-content）收益最大。柱子画<b>失败率</b>而不是成功率，因为 99.6% 和 98.0% 看着差不多，失败率差了 5 倍多。</p>' +
        '<p>每根轴是从 (100M, 42M, 128 卡) 这个点单独往回减，三根轴共享终点 99.63% / 23.77 mm。论文没有做三轴的交叉实验，不能看出它们的交互。</p>' +
        '<p>每个点是 2 个种子 × 3 个检查点，不是 6 次独立训练；约 2k GPU·h 那个点只有 4 次评测（Data S1 说明页）。</p>' +
        guess('左边的方块堆只表示相对大小。1.2M 和 16M 的网络结构论文没写，这里按比例缩小宽度画，不是真实结构。') + src('§2.1 · 图 2(A–C) · Data S1') },
    { n: 3, part: '训练', title: '跟踪任务怎样用 PPO 训练', sub: '切换 GPU 数，样本量按表 S2 当场算；奖励按表 S3 当场算', dur: 15, cam: [0.06, 1.1, 37, [0, 3.6, 0]],
      html: dl([['环境', '每 GPU 4096，50 Hz'], ['一轮', '每环境 24 步，5 个 epoch，4 个小批'], ['折扣', 'γ = 0.99，GAE λ = 0.95'], ['学习率', '演员 2×10⁻⁵，评论家 1×10⁻³'], ['评论家', '看特权状态（线速度、全身位姿、无噪声）']]) +
        '<p>每帧都有一个目标姿态，奖励是当前姿态和目标的差。论文认为这就是跟踪能放大的原因：每帧的监督信号不随数据变多而变弱。判别器式的模仿（AMP、ASE）则相反，数据越杂，判别器给的信号越没用。</p>' +
        '<p><b>奖励怎么算。</b>每项是 exp(−误差² / σ²) 乘权重。右边 7 根柱按表 S3 的 σ 和权重当场算。权重和是 7.0，全部跟踪得完美时奖励的跟踪部分就是 7.0。</p>' +
        '<p>论文只写了评测的判据，没写训练时的终止条件。公布配置里训练判据更严，见第 11 幕。</p>' +
        guess('误差是我写的一条正弦，不是真实跟踪误差。小人动作手写。左边每格代表一张 GPU，不是一个环境。') + src('§3.2 · 表 S2 · 表 S3') },
    { n: 4, part: '编码器', title: '三个编码器看到什么', sub: '切换编码器：未来帧的跨度不一样', dur: 14, cam: [0.03, 1.02, 35, [-1.6, 3.2, 0]],
      html: dl([['ℰr 机器人', '未来 10 帧，间隔 0.1 s，看 1 s'], ['ℰh 人体', '未来 10 帧，间隔 0.02 s，看 0.2 s'], ['ℰm 混合', '当前帧头和双手 ＋ 未来 10 帧下身，间隔 0.1 s'], ['结构', '都是 MLP (2048, 1024, 512, 512)']]) +
        '<p>三个编码器输入不同，输出都是 2 × 32 的潜变量。人体编码器只看 0.2 s，是为了遥操作时延迟低；模型卡里的低延迟版把它再缩到 4 帧 80 ms。</p>' +
        '<p><b>训练时的取舍。</b>代码里每个环境按 1:1:1 抽一个编码器来驱动，人体环境同时算机器人编码器作配对。所以式 (2)(3) 的求和实际是在抽样的子集上算的。</p>' +
        '<p>论文说 ℰr 编码关节位置和速度，代码还加了根朝向（<code>motion_anchor_ori_b_mf</code>）；ℰh 还加了根朝向和腕关节。按 640 维输入算，ℰr 约 423 万参数（我的计算）。</p>' + src('§3.2 · 表 S1 · 代码 sonic_release.yaml') },
    { n: 5, part: '通用 token', title: 'FSQ：把连续潜变量卡到格点', sub: '切换级数和维数。量化是页面当场算的，表格数字来自表 3(B)', dur: 14, cam: [0.0, 1.22, 34, [0, 5.6, 0]],
      html: dl([['做法', '先 tanh 限幅到 ±(L−1)/2，再四舍五入到整数，再除以 ⌊L/2⌋'], ['默认', 'L = 32，D = 32，2 个 token，共 64 维'], ['容量', '每帧 2·D·log₂L = 320 比特'], ['梯度', '直通估计：反传时把取整当恒等']]) +
        '<p><b>FSQ（有限标量量化）</b>每一维只取有限个值，整个码本就是这些值的笛卡尔积，不用学。没有码本，也就没有 <b>VQ-VAE</b> 的码本塌缩（大部分码字没人用）和承诺损失。论文同容量对比：FSQ 26.6 mm，VQ-VAE 35.3 mm。</p>' +
        '<p><b>表 3(B) 自己看。</b>16-16 加维数到 16-32 多 128 比特，加级数到 32-16 只多 32 比特，两者的成功率都到 98.3%。论文说维数比级数重要，按比特算效率却是级数更高（我的读法，见精读读者注）。</p>' +
        guess('输入是种子固定的玩具向量，不是编码器的真实输出。只画第一个 token 的前若干维。') + src('§3.2 · §3.6 · 表 3 · FSQ 公式取自 vector_quantize_pytorch，repo 配置 fsq.yaml 指向它') },
    { n: 6, part: '四项损失', title: '四项损失各更新谁', sub: '切换损失看梯度路径。下方小实验当场算梯度下降', dur: 15, cam: [0.04, 1.08, 38, [1.6, 3.2, 0]],
      html: dl([['ℒppo', '更新编码器、量化器、𝒟c、评论家'], ['ℒrecon', '更新编码器和 𝒟r，重建机器人动作'], ['ℒtoken', '两两拉近 z_r, z_h, z_m'], ['ℒcycle', 'ℰr(𝒟r(z_h)) 回到 z_r']]) +
        '<div class="eq-mini">ℒ = ℒppo + ℒrecon + ℒtoken + ℒcycle</div>' +
        '<p><b>论文和代码的差别。</b>式 (1) 没有权重；代码里 g1_recon = 0.01，其余三项对齐和循环都是 1.0。式 (3)(4) 写的是量化后的 z；代码在量化前的连续潜变量（<code>no_quantization=True</code>）上算。</p>' +
        '<p>𝒟r 同时是隐式的重定向器：输入人体 token 时，它输出的是机器人动作。这也是部署时不用显式重定向的原因。</p>' +
        '<p>下面三个点是玩具：对 ‖a−b‖²＋‖a−c‖²＋‖b−c‖² 做真的梯度下降。论文的真实对比是图 S7：有一致性损失时跨编码器距离均值 0.57，没有时 4.23（只测了一段爬行动作）。</p>' +
        guess('二维点是玩具，步长是我选的。') + src('§3.2 式 (1)–(4) · 图 S7 · 代码 token_losses.py') },
    { n: 7, part: '采样', title: '按失败率多练难的片段', sub: '切换上限 β，概率按代码公式当场算', dur: 13, cam: [0.0, 1.12, 38, [0, 4.6, 0]],
      html: dl([['分桶', '动作库切成 1 s 一个桶'], ['权重', '失败率，上限 = 均值 × β，β = 200'], ['混合', '90% 按失败率 ＋ 10% 均匀（α = 0.1）']]) +
        '<div class="eq-mini">P(b) = 0.9 · min(f_b, β·f̄) / Σ ＋ 0.1 / N</div>' +
        '<p>不加上限时，几个学不会的桶（比如超出机器人能力的动作）会吃掉全部样本。不加均匀项时，已经学会的桶会被遗忘。</p>' +
        '<p>公式取自 <code>motion_lib_base.py</code> 的 <code>update_adaptive_sampling_probabilities</code>。β 和 α 与表 S2 一致，1 s 对应配置里 bin_size = 50 帧。</p>' +
        '<p>切到 β = 2 可以看到上限生效：最高的那根被压下去。</p>' +
        guess('24 个桶的失败率是假数据，真实动作库有几十万片段。β = 2 只是为了看出上限的作用，不是论文的取值。') + src('§3.2 · 表 S2 · 代码 motion_lib_base.py') },
    { n: 8, part: '规划器', title: '运动学规划器：补中间的动作', sub: '弹簧模型当场算；切换式 (8) 的印刷版和代码版', dur: 16, cam: [0.02, 1.2, 38, [0.6, 5.0, 0]],
      html: dl([['任务', '给起止关键帧，生成 0.8–2.4 s 的中间动作'], ['做法', '潜空间掩码 token 预测，每轮定下把握最大的'], ['调度', '每轮定下比例 1 − cos(π/2 · L/L_max)'], ['速度', '笔记本 &lt;5 ms，Jetson Orin 约 12 ms，最快 10 Hz']]) +
        '<p>规划器是应用层：把手柄命令变成短时间的参考动作，交给跟踪器。下身怎么走不用手写步态。</p>' +
        '<p><b>弹簧模型。</b>临界阻尼弹簧给根位置和朝向定目标关键帧。位置 c = 5 ln 2，朝向 c = 20 ln 2，速度命令转换成 1 s 后的目标位置。</p>' +
        '<p><b>切到“印刷版”看：</b>式 (8) 照原文写是 x(t) = (x_T − x₀ + (v₀ + c/2·(x_T − x₀))t) e^(−ct/2)，t = 0 时等于 x_T − x₀，t → ∞ 时归零，不是从 x₀ 走到 x_T。代码版是 (j₀ + j₁t)e^(−yt) + x_T，j₀ = x₀ − x_T，j₁ = v₀ + j₀y，y = c/2。图上的曲线都是当场算的。</p>' +
        guess('掩码轮数 L_max = 8 和 16 个 token 是我选的（论文没给 L_max），小人姿态手写，不是规划器的输出。') + src('§3.3 式 (5)–(8) · S1.3 · 代码 motionbricks/.../full_agent.py') },
    { n: 9, part: '遥操作', title: '换输入不换策略', sub: '切换来源；四个循环按真实频率比例闪（放慢）', dur: 15, cam: [0.03, 1.05, 37, [-0.4, 3.2, 0]],
      html: dl([['控制', '50 Hz，策略一次 1–2 ms'], ['写电机', '500 Hz，不阻塞策略'], ['输入', '100 Hz'], ['规划', '10 Hz，一次约 12 ms'], ['计算', '全部在 Jetson Orin 上，TensorRT']]) +
        '<p><b>全身 VR：</b>PICO 头显、两个脚踝追踪器和手柄，每帧 87 维（63 关节位置 ＋ 4 根朝向 ＋ 6 腕 ＋ 14 手），走 ℰh。</p>' +
        '<p><b>三点 VR：</b>只用头显和手柄，给头和双手的 SE(3) 位姿、腰高和导航命令，下身由规划器补，走 ℰm。</p>' +
        '<p><b>视频、文本、音乐：</b>都先由 GEM（基于扩散先验的统一人体动作模型）变成人体动作，再走 ℰh。</p>' +
        '<p><b>手柄：</b>规划器出机器人动作，走 ℰr。切换来源只是换一个指针，编码器模式跟着动作序列走。</p>' +
        guess('小人是示意，闪烁放慢了约 20 倍，比例真实。') + src('§2.3 · §2.4 · §3.5 · S1.2 · S1.4') },
    { n: 10, part: '大模型', title: 'VLA 预测 token，不预测姿态', sub: '切换对比和任务。柱子是表 1 的数字，误差棒是我算的', dur: 13, cam: [0.03, 1.12, 38, [1.0, 3.6, 0]],
      html: dl([['模型', 'GR00T N1.5，微调'], ['token 动作', '64 维 token ＋ 14 维手 = 78 维'], ['SMPL 动作', '全身姿态和手关节 = 81 维'], ['平均', 'token 68%，SMPL 27%']]) +
        '<p><b>VLA</b>（vision-language-action）模型看图像和指令输出动作。这里它的输出不是关节，而是通用 token，再由 𝒟c 变成关节目标。所以脚也归它管，能踩垃圾桶踏板。</p>' +
        '<p>难任务上差距变大：把汽水罐扔进垃圾桶，token 60%，SMPL 0%。论文的解释是 token 空间紧凑离散，好学；连续姿态的小误差会放大成跟踪失败。</p>' +
        '<p><b>要留意样本量。</b>每个任务只有 10 到 20 次，误差棒是 95% Wilson 区间（我算的）：10 次里成 6 次的区间是 31% 到 83%。表 1(B) 的 SMPL 那一列论文没写试验次数，这里按同任务的次数假设。</p>' + src('§2.5 · §3.6 · 表 1') },
    { n: 11, part: '对账', title: '和 SuperMimic 的判据差在哪', sub: '切换参考姿态和误差方向。三条判据的触发点当场算', dur: 15, cam: [0.0, 1.2, 29, [1.0, 3.8, 0]],
      html: dl([['SONIC 评测（代码）', '根高、末端高 &gt; 0.25 m，或根旋转角² &gt; 1（57.3°）'], ['SONIC 训练（公布配置）', '根高、末端高 &gt; 0.15 m，脚位置 &gt; 0.2 m，根旋转角² &gt; 0.2（25.6°）'], ['SuperMimic', '根高 &gt; 0.25 m，或倾斜 |g_ref,z − g_rob,z| &gt; 0.8']]) +
        '<p>SuperMimic 附录 F 说 SONIC 自己的判据没有朝向项。这和 SONIC v4 正文相符。但 v1 到 v3 正文、作者的 Data S1 说明页、官方评测配置 <code>tracking/eval.yaml</code> 都有 1 rad 这一项。</p>' +
        '<p><b>看动画。</b>倾斜判据只看重力方向。竖直参考时要歪约 78.5° 才触发；参考正好水平时 53°；最紧的情形是两个方向的中点水平（比如参考俯仰 66°），47.2° 就触发；绕竖直轴的偏航误差它完全不管。SONIC 那项是总旋转角，哪个方向都一样，评测 57.3°，训练 25.6°。</p>' +
        '<p><b>能确认的：</b>128 张卡、7 天、21k GPU·h、611 h 都在论文里。公布配置 world_size = 128。<b>确认不了的：</b>“L40” 论文四版都没写，只有仓库文档写 “L40 recommended”；179 和 239 这两个失败数只有 SuperMimic 自己测过。</p>' +
        guess('一个自由度的玩具几何，算的是判据公式，不是仿真。没有放高度项，高度差要看真实轨迹。') + src('SONIC §2.1 · Data S1 · eval.yaml · SuperMimic 附录 A、F') }
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
    $('infoTag').textContent = `第 ${s.n} 幕 · ${s.part}`;
    $('infoTitle').textContent = s.title;
    $('infoBody').innerHTML = s.html;
    $('stepNo').textContent = `${s.n} / ${SCENES.length}`;
    stepsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(+b.dataset.i === i)));
    btns.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
  }
  let lastCap = null;
  const cap = h => { if (h !== lastCap) { lastCap = h; $('cap').innerHTML = h; } };

  /* ---------- 3D helpers ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.1, phi: 1.1, dist: 30, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);

  let LABS = [], refDist = 24, PICKS = [];
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: o.size || 24, pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  /* a label whose text can change: rebuilt only when the text differs */
  function dynLab(G, pos, o = {}) {
    let cur = null, sp = null;
    const set = (text, vis = true) => {
      if (text !== cur) { if (sp) { G.remove(sp); L.dispose(sp); LABS = LABS.filter(s => s !== sp); } cur = text; sp = lab(text, pos, o); G.add(sp); }
      sp.visible = vis;
    };
    return set;
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) {
    const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65, emissive: o.emissive });
    const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im;
  }
  function setI(im, n, p, s, q) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, q || _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) {
    const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m;
  }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  function along(pts, t) {
    const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1];
    return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)];
  }
  function stream(G, n, color, r = 0.16) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.5, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  const clickable = (m, go) => { m.userData.go = go; PICKS.push(m); return m; };
  /* polyline updated in place */
  function polyline(G, n, color, op = 0.95) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })); l.frustumCulled = false; G.add(l);
    return (fn, upto = n) => { const A = g.attributes.position.array; for (let i = 0; i < n; i++) { const v = fn(i / (n - 1)); A[i * 3] = v[0]; A[i * 3 + 1] = v[1]; A[i * 3 + 2] = v[2]; } g.attributes.position.needsUpdate = true; g.setDrawRange(0, upto); };
  }

  /* ---------- the hand-made humanoid ---------- */
  function robot(color, o = {}) {
    const m = L.mat(color, { opacity: o.opacity, roughness: 0.5, depthWrite: o.opacity == null || o.opacity > 0.6 });
    const G = new THREE.Group(), mesh = g => new THREE.Mesh(g, m);
    const limb = (len, r) => { const g = new THREE.Group(), c = mesh(new THREE.CylinderGeometry(r, r * 0.82, len, 8)); c.position.y = -len / 2; g.add(c); g.add(mesh(new THREE.SphereGeometry(r, 8, 6))); return g; };
    const pelvis = new THREE.Group(); G.add(pelvis);
    pelvis.add(mesh(new THREE.BoxGeometry(0.26, 0.1, 0.14)));
    const tor = mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.36, 10)); tor.position.y = 0.2; pelvis.add(tor);
    const head = mesh(new THREE.SphereGeometry(0.085, 12, 9)); head.position.y = 0.48; pelvis.add(head);
    const legs = [-1, 1].map(s => { const th = limb(0.3, 0.05); th.position.set(s * 0.09, -0.04, 0); const sh = limb(0.3, 0.042); sh.position.y = -0.3; th.add(sh); const ft = mesh(new THREE.BoxGeometry(0.08, 0.035, 0.18)); ft.position.set(0, -0.31, 0.04); sh.add(ft); pelvis.add(th); return { th, sh }; });
    const arms = [-1, 1].map(s => { const up = limb(0.2, 0.034); up.position.set(s * 0.18, 0.34, 0); const lo = limb(0.2, 0.028); lo.position.y = -0.2; up.add(lo); pelvis.add(up); return { up, lo, s }; });
    G.userData.set = q => {
      pelvis.rotation.set(q.pitch || 0, q.yaw || 0, q.roll || 0, 'YXZ');
      legs[0].th.rotation.x = -(q.hL || 0); legs[1].th.rotation.x = -(q.hR || 0); legs[0].sh.rotation.x = q.kL || 0; legs[1].sh.rotation.x = q.kR || 0;
      arms[0].up.rotation.x = -(q.sL || 0); arms[1].up.rotation.x = -(q.sR || 0); arms[0].lo.rotation.x = -(q.eL || 0); arms[1].lo.rotation.x = -(q.eR || 0);
      arms.forEach(a => { a.up.rotation.z = a.s * (q.spread || 0.12); });
    };
    return G;
  }
  const STAND = 0.65;
  const walk = (t, a = 0.48) => { const ph = 2 * Math.PI * t / 0.9, s = Math.sin(ph); return { y: STAND - 0.015 + 0.015 * Math.cos(2 * ph), pitch: 0.04, hL: a * s, hR: -a * s, kL: 0.2 + 0.55 * Math.max(0, -Math.cos(ph + 0.6)), kR: 0.2 + 0.55 * Math.max(0, Math.cos(ph + 0.6)), sL: -0.8 * a * s, sR: 0.8 * a * s, eL: 0.45, eR: 0.45 }; };
  function pose(r, q, at, s, yaw = 0) { r.userData.set(q); r.position.set(at[0], at[1] + (q.y ?? STAND) * s, at[2]); r.scale.setScalar(s); r.rotation.y = yaw; }

  /* ---------- scene 1: figure 6 in 3D, one route at a time ---------- */
  const ROUTES = [
    { name: '手柄', task: 0, gen: 0, mot: 0, enc: 0, t: '手柄 → 规划器 → 机器人动作 → ℰr → token → 𝒟c' },
    { name: '三点 VR', task: 1, gen: 1, mot: 1, enc: 1, t: '头显和手柄 → PICO ＋ 规划器补下身 → 混合动作 → ℰm → token → 𝒟c' },
    { name: '全身 VR', task: 2, gen: 1, mot: 2, enc: 2, t: 'PICO 全身 → SMPL 人体动作 → ℰh → token → 𝒟c' },
    { name: '视频/文本/音乐', task: 3, gen: 2, mot: 2, enc: 2, t: '视频、文本或音乐 → GEM → 人体动作 → ℰh → token → 𝒟c' }
  ];
  function s1(G) {
    const X = { task: -15.5, gen: -10.2, mot: -5.2, enc: -0.4, q: 4.4, z: 7.6, dc: 11.2, out: 15.6 };
    const Z = [-5.4, -1.8, 1.8, 5.4], Z3 = [-4.2, 0, 4.2];
    G.add(L.grid(44, 44));
    const mk = (w, h, d, c, pos, t, go, sz = 21) => { const m = block(w, h, d, c, pos); clickable(m, go); G.add(m, lab(t, [pos[0], pos[1] + h / 2 + 0.55, pos[2]], { size: sz })); return m; };
    const tasks = ['手柄', '三点 VR', '全身 VR', '视频 文本 音乐'].map((t, i) => mk(2.5, 0.9, 1.5, COL.task, [X.task, 0.5, Z[i]], t, 8));
    const gens = ['运动学规划器', 'PICO VR', 'GEM'].map((t, i) => mk(2.8, 1.1, 1.8, COL.gen, [X.gen, 0.6, Z3[i]], t, i === 0 ? 7 : 8));
    const mots = ['机器人动作', '混合动作', '人体动作'].map((t, i) => mk(2.5, 0.8, 1.6, COL.mot, [X.mot, 0.45, Z3[i]], t, 3));
    const encC = [COL.er, COL.em, COL.eh];
    const encs = ['ℰr', 'ℰm', 'ℰh'].map((t, i) => mk(2.2, 1.6, 2, encC[i], [X.enc, 0.85, Z3[i]], t, 3, 26));
    const q = mk(1.8, 2.6, 2.6, COL.q, [X.q, 1.35, 0], '量化器 FSQ', 4);
    const z = mk(0.9, 2.0, 1.2, COL.z, [X.z, 1.05, 0], '通用 token', 4);
    const dc = mk(3, 1.6, 2, COL.dc, [X.dc, 0.85, 2.6], '控制解码器 𝒟c', 5);
    const dr = mk(3, 1.3, 1.8, COL.dr, [X.dc, 0.7, -2.6], '动作解码器 𝒟r', 5);
    const rb = robot(COL.robot); G.add(rb);
    const f = stream(G, 12, COL.z, 0.13), aux = stream(G, 5, COL.dr, 0.1);
    G.add(lab('任务', [X.task, 3.1, -7.6], { size: 22 }), lab('生成器', [X.gen, 3.1, -7.6], { size: 22 }), lab('动作', [X.mot, 3.1, -7.6], { size: 22 }), lab('编码器', [X.enc, 3.1, -7.6], { size: 22 }), lab('解码器', [X.dc, 3.1, -7.6], { size: 22 }));
    let pick = null;
    const all = [...tasks, ...gens, ...mots, ...encs, q, z, dc, dr];
    const lines = [];
    ROUTES.forEach(r => { lines.push(wire(G, [[X.task, 0.5, Z[r.task]], [X.gen, 0.6, Z3[r.gen]], [X.mot, 0.45, Z3[r.mot]], [X.enc, 0.85, Z3[r.enc]], [X.q, 1.3, 0]], COL.dim, { opacity: 0.55 })); });
    wire(G, [[X.q, 1.3, 0], [X.z, 1.05, 0], [X.dc, 0.85, 2.6]], COL.dim, { opacity: 0.6 }); wire(G, [[X.z, 1.05, 0], [X.dc, 0.7, -2.6]], COL.dim, { opacity: 0.6 });
    return { ctls: [{ label: '路线', items: ROUTES.map(r => r.name), pick(k) { pick = k; }, cur: () => pick }], update(p) {
      const k = pick ?? Math.min(3, Math.floor(p * 4)), r = ROUTES[k], ph = (p * 18) % 1;
      all.forEach(m => glow(m, 0));
      [tasks[r.task], gens[r.gen], mots[r.mot], encs[r.enc], q, z, dc].forEach(m => glow(m, 0.55));
      if (r.task === 1) glow(gens[0], 0.4);
      lines.forEach((l, i) => { l.material.opacity = i === k ? 0.95 : 0.2; l.material.color.setHex(i === k ? COL.z : COL.dim); });
      f([[X.task, 0.5, Z[r.task]], [X.gen, 0.6, Z3[r.gen]], [X.mot, 0.45, Z3[r.mot]], [X.enc, 0.85, Z3[r.enc]], [X.q, 1.3, 0], [X.z, 1.05, 0], [X.dc, 0.85, 2.6], [X.out, 0.8, 2.6]], ph, 1);
      aux([[X.z, 1.05, 0], [X.dc, 0.7, -2.6]], ph, 0.8);
      const w = walk(p * 16); pose(rb, w, [X.out, 0, 2.6], 2.1, -Math.PI / 2);
      cap(r.t + '。<b>路线变了，token 之后的部分不变</b>');
    } };
  }

  /* ---------- scene 2: three axes with a control over the scale point ---------- */
  function s2(G) {
    G.add(L.grid(44, 44));
    let ax = null, pt = null;
    const stack = inst(BOX, 512); G.add(stack);
    const xB = [3.2, 7.0, 10.8, 14.6], BW = 1.1, sY = 2.2;  /* failure % × sY */
    const bars = inst(BOX, 8); G.add(bars);
    const labs = []; for (let i = 0; i < 4; i++) labs.push({ top: dynLab(G, [xB[i], 0, 0], { size: 20 }), name: dynLab(G, [xB[i], -0.6, 3.4], { size: 20 }) });
    /* dynLab pins its position at construction, so bar value labels are rebuilt through a position table */
    const topL = [0, 1, 2, 3].map(() => ({ sp: null, cur: '' }));
    const setTop = (i, text, y, vis) => { const o = topL[i]; if (text !== o.cur) { if (o.sp) { G.remove(o.sp); L.dispose(o.sp); LABS = LABS.filter(s => s !== o.sp); } o.sp = lab(text, [xB[i], y, 0], { size: 19 }); G.add(o.sp); o.cur = text; } if (o.sp) { o.sp.position.y = y; o.sp.visible = vis; } };
    labs.forEach(l => l.top('', false));
    G.add(lab('失败率 %（橙 test-content，蓝 test-repetition）', [8.8, 7.6, 0], { size: 23 }));
    const head = dynLab(G, [-8.8, 7.6, 0], { size: 26, border: 'rgba(56,209,255,.8)' });
    const sub = dynLab(G, [-8.8, 6.6, 0], { size: 21 });
    const orange = hex3(0xe0764e), blue = hex3(0x3987e5), grey = hex3(0x5a6780);
    return { ctls: [
      { label: '轴', items: AX.map(a => a.key), pick(k) { ax = k; pt = null; }, cur: () => ax },
      { label: '档位', items: ['1', '2', '3', '4'], pick(k) { const a = AX[ax ?? 0]; pt = Math.min(k, a.pts.length - 1); if (ax == null) ax = 0; }, cur: () => pt }
    ], update(p) {
      const axis = ax ?? Math.min(2, Math.floor(p * 3)), A = AX[axis], n = A.pts.length;
      const loc = ax == null ? (p * 3) % 1 : p, idx = pt ?? Math.min(n - 1, Math.floor(clamp(loc, 0, 0.999) * n)), P = A.pts[idx];
      /* left: relative-size block stacks */
      let i = 0; const blocks = [];
      if (axis === 0) { const m = [4, 10, 22, 100][idx]; for (let k = 0; k < m * 4; k++) blocks.push([-14 + (k % 20) * 0.55, 0.3 + Math.floor(k / 20) * 0.55, (k % 3 - 1) * 0.6, hex3(COL.gen), 0.46]); }
      else if (axis === 1) { const w = [0.17, 0.62, 1][idx], L8 = [4096, 4096, 2048, 2048, 1024, 1024, 512, 512]; L8.forEach((h, li) => { const c = Math.max(1, Math.round(h / 128 * w)); for (let k = 0; k < Math.min(c, 32); k++) blocks.push([-14 + li * 1.0, 0.3 + k * 0.17, 0, hex3(COL.dc), 0.15]); }); }
      else { const g = P.g; for (let k = 0; k < g; k++) blocks.push([-14.5 + (k % 16) * 0.72, 0.25 + Math.floor(k / 16) * 0.72, 0, hex3(COL.er), 0.6]); }
      for (; i < blocks.length && i < 512; i++) { const b = blocks[i]; setI(stack, i, [b[0], b[1], b[2]], axis === 1 ? [0.82, b[4], 1.6] : b[4]); colI(stack, i, b[3]); }
      for (; i < 512; i++) setI(stack, i, [0, -60, 0], 0.001);
      done(stack);
      head(`${A.key}：${P.x}`); sub(`${P.d} · ${P.n} 次评测`);
      /* right: bars for every point on this axis, selected point lit */
      for (let k = 0; k < 4; k++) {
        const q = A.pts[k];
        if (!q) { setI(bars, k * 2, [0, -60, 0], 0.001); setI(bars, k * 2 + 1, [0, -60, 0], 0.001); labs[k].name('', false); setTop(k, '', 0, false); continue; }
        const fc = 100 - q.c[0], fr = 100 - q.r[0], hc = Math.max(0.02, fc * sY), hr = Math.max(0.02, fr * sY), lit = k === idx;
        setI(bars, k * 2, [xB[k] - 0.62, hc / 2, 0], [BW, hc, BW]); colI(bars, k * 2, lit ? orange : orange.map(v => v * 0.4));
        setI(bars, k * 2 + 1, [xB[k] + 0.62, hr / 2, 0], [BW, hr, BW]); colI(bars, k * 2 + 1, lit ? blue : blue.map(v => v * 0.4));
        labs[k].name(q.x, true); setTop(k, `${fc.toFixed(2)} / ${fr.toFixed(2)}`, Math.max(hc, hr) + 0.5, true);
      }
      done(bars);
      const fc0 = 100 - A.pts[0].c[0], fc1 = 100 - A.pts[n - 1].c[0];
      cap(`${A.key}轴：${P.x}。未见内容成功率 <b>${P.c[0].toFixed(2)}%</b>、${P.c[1].toFixed(2)} mm；重复 ${P.r[0].toFixed(2)}%、${P.r[1].toFixed(2)} mm。全轴失败率从 ${fc0.toFixed(2)}% 降到 ${fc1.toFixed(2)}%，约 <b>${(fc0 / fc1).toFixed(1)} 倍</b>`);
    } };
  }

  /* ---------- scene 3: PPO tracking training, sample count and reward computed live ---------- */
  const REW = [['根位', 0.5, 0.3, 0.12], ['根向', 0.5, 0.4, 0.15], ['部位', 1, 0.3, 0.08], ['部向', 1, 0.4, 0.2], ['线速', 1, 1.0, 0.35], ['角速', 1, 3.14, 1.2], ['末端', 2, 0.1, 0.05]];
  function s3(G) {
    G.add(L.grid(36, 36));
    let gp = 2; const GP = [16, 32, 128];
    const cards = inst(BOX, 128); G.add(cards);
    const ref = robot(COL.ref, { opacity: 0.4 }), rb = robot(COL.robot); G.add(ref, rb);
    const bars = inst(BOX, 7); G.add(bars);
    const X = i => 3.8 + i * 1.75, nl = REW.map((r, i) => { const t = lab(r[0], [X(i), -0.6, 1.6], { size: 17 }); G.add(t); return t; });
    const samp = dynLab(G, [-9.5, 7.4, 0], { size: 23, border: 'rgba(79,201,138,.8)' });
    const tot = dynLab(G, [9, 7.9, 0], { size: 24, border: 'rgba(242,193,78,.8)' });
    const vl = REW.map(() => ({ sp: null, cur: '' }));
    const setV = (i, text, y) => { const o = vl[i]; if (text !== o.cur) { if (o.sp) { G.remove(o.sp); L.dispose(o.sp); LABS = LABS.filter(s => s !== o.sp); } o.sp = lab(text, [X(i), y, 0], { size: 18 }); G.add(o.sp); o.cur = text; } o.sp.position.y = y; };
    G.add(lab('红：参考  白：机器人', [-1.4, 5.0, 0], { size: 19 }));
    const rollout = stream(G, 24, COL.q, 0.09);
    return { ctls: [{ label: 'GPU', items: GP.map(String), pick(k) { gp = k; }, cur: () => gp }], update(p) {
      const g = GP[gp], t = p * 14, err = 0.5 + 0.5 * Math.sin(2 * Math.PI * p * 2);
      for (let i = 0; i < 128; i++) { if (i < g) { setI(cards, i, [-14.5 + (i % 16) * 0.7, 0.25 + Math.floor(i / 16) * 0.55, -1], [0.58, 0.44, 0.9]); colI(cards, i, hex3(COL.er)); } else setI(cards, i, [0, -60, 0], 0.001); } done(cards);
      const envs = 4096 * g, per = envs * 24;
      samp(`${g} 卡 × 4096 = ${envs.toLocaleString('en-US')} 个环境\n× 24 步 = ${per.toLocaleString('en-US')} 样本 / 迭代\n× 5 epoch，每 epoch 4 个小批`);
      const w = walk(t); pose(ref, w, [-1.4, 0, 0], 2.6);
      const w2 = walk(t - 0.09 * err); w2.pitch = 0.04 + 0.22 * err; pose(rb, w2, [-1.4, 0, 0.08], 2.6);
      rollout([[-14, 2.4, -1], [-5, 3.2, -0.4], [-2, 2, 0]], (p * 14) % 1, 1);
      let R = 0, H = 3.2;
      REW.forEach((r, i) => { const e = r[3] * err * 2.2, v = r[1] * Math.exp(-e * e / (r[2] * r[2])); R += v; const h = Math.max(0.03, v * H); setI(bars, i, [X(i), h / 2, 0], [1.2, h, 1.2]); colI(bars, i, hex3(i === 6 ? COL.q : COL.er)); setV(i, v.toFixed(2), h + 0.45); });
      done(bars);
      tot(`跟踪奖励 ${R.toFixed(2)} / 7.0`);
      cap(`5 万次迭代 × ${per.toLocaleString('en-US')} ≈ <b>${(per * 5e4 / 1e11).toFixed(1)}×10¹¹</b> 样本，相当于 ${(per * 5e4 / 50 / 3600 / 24 / 365).toFixed(0)} 年的机器人时间（50 Hz，我的计算）。奖励柱按 exp(−e²/σ²) 当场算，误差是玩具`);
    } };
  }

  /* ---------- scene 4: what each encoder sees ---------- */
  function s4(G) {
    G.add(L.grid(36, 36));
    let k = null;
    const E = [{ n: 'ℰr 机器人', c: COL.er, dt: 0.1, cur: false, t: '未来 10 帧关节位置和速度（代码还有根朝向），间隔 0.1 s，看 <b>1 秒</b>' },
      { n: 'ℰh 人体', c: COL.eh, dt: 0.02, cur: false, t: '未来 10 帧人体关节 3D 位置，间隔 0.02 s，只看 <b>0.2 秒</b>：遥操作要响应快' },
      { n: 'ℰm 混合', c: COL.em, dt: 0.1, cur: true, t: '当前帧的头和双手，加未来 10 帧下身，间隔 0.1 s。上身实时，下身由规划器提前给' }];
    const u = 11; /* metres of stage per second of motion */
    const x0 = -14, Zr = [-3.6, 0, 3.6];
    const frames = E.map((e, i) => { const im = inst(BOX, 11); G.add(im); return im; });
    E.forEach((e, i) => { G.add(lab(e.n, [x0 - 1.0, 1.0, Zr[i]], { size: 22 })); wire(G, [[x0, 0.05, Zr[i]], [x0 + u * 1.05, 0.05, Zr[i]]], COL.dim, { opacity: 0.7 }); });
    [0, 0.2, 0.5, 1].forEach(t => G.add(lab(`${t} s`, [x0 + u * t, -0.6, 6.0], { size: 19 })));
    const W = [2048, 1024, 512, 512], layers = W.map((w, i) => { const m = block(0.7, 0.8 + w / 512 * 0.9, 2.2, COL.er, [2.4 + i * 1.5, (0.8 + w / 512 * 0.9) / 2 + 0.05, 0]); G.add(m, lab(String(w), [2.4 + i * 1.5, 0.8 + w / 512 * 0.9 + 0.55, 0], { size: 19 })); return m; });
    const tok = [0, 1].map(i => { const m = block(0.7, 2, 1, COL.z, [9.2 + i * 1.0, 1.1, 0]); G.add(m); return m; });
    G.add(lab('2 个 token\n每个 32 维', [9.7, 3.3, 0], { size: 21 }));
    const f = stream(G, 10, COL.z, 0.12);
    return { ctls: [{ label: '编码器', items: ['ℰr', 'ℰh', 'ℰm'], pick(q) { k = q; }, cur: () => k }], update(p) {
      const s = k ?? Math.min(2, Math.floor(p * 3)), loc = k == null ? (p * 3) % 1 : p;
      E.forEach((e, i) => {
        const im = frames[i], c = hex3(e.c), on = i === s, sc = on ? 1 : 0.35;
        for (let j = 0; j < 10; j++) { const t = (j + 1) * e.dt, vis = !on || j / 10 <= loc * 1.4; setI(im, j, vis ? [x0 + u * t, 0.5, Zr[i]] : [0, -60, 0], vis ? [0.2, 0.9, 1.2] : 0.001); colI(im, j, c.map(v => v * sc + 0.02)); }
        setI(im, 10, e.cur ? [x0, 0.6, Zr[i]] : [0, -60, 0], e.cur ? [0.2, 1.1, 1.6] : 0.001); colI(im, 10, hex3(COL.q).map(v => v * sc)); done(im);
      });
      layers.forEach(m => { m.material.color.setHex(E[s].c); }); layers.forEach((m, i) => { const c = hex3(E[s].c); m.userData.c = c; glow(m, 0.45 * (0.5 + 0.5 * Math.sin(p * 40 - i))); });
      f([[x0 + 6, 1, Zr[s]], [1.6, 1.3, 0], [8.6, 1.2, 0]], (p * 16) % 1, 1);
      cap(E[s].t);
    } };
  }

  /* ---------- scene 5: FSQ, computed live ---------- */
  function fsqBound(z, L_) { const eps = 1e-3, half = (L_ - 1) * (1 + eps) / 2, off = L_ % 2 === 0 ? 0.5 : 0, shift = Math.atanh(off / half); return Math.tanh(z + shift) * half - off; }
  const fsq = (z, L_) => { const b = fsqBound(z, L_), r = Math.round(b); return { b, r, q: r / Math.floor(L_ / 2) }; };
  function s5(G) {
    G.add(L.grid(32, 32));
    let lv = 1, dm = 1; const LV = [16, 32], DM = [16, 32];
    const R = L.rng(11), base = Array.from({ length: 32 }, () => L.gauss(R) * 0.9), wob = Array.from({ length: 32 }, () => R() * 6.28);
    const cont = inst(BOX, 32), quant = inst(BOX, 32); G.add(cont, quant);
    const ticks = inst(BOX, 34); G.add(ticks);
    G.add(lab('灰：tanh 限幅后的连续值  黄：取整后', [0, 8.0, 0], { size: 22 }));
    const info = dynLab(G, [-8, 9.6, 0], { size: 22, border: 'rgba(242,193,78,.8)' });
    const tbl = dynLab(G, [8, 9.6, 0], { size: 22, border: 'rgba(56,209,255,.8)' });
    const Y0 = 4.0;
    return { ctls: [
      { label: '级数 L', items: LV.map(String), pick(k) { lv = k; }, cur: () => lv },
      { label: '维数 D', items: DM.map(String), pick(k) { dm = k; }, cur: () => dm }
    ], update(p) {
      const Lv = LV[lv], D = DM[dm], W = 26, dx = W / D, H = 5.4 / (Lv - 1), halfN = Lv / 2;
      let same = 0;
      for (let i = 0; i < 32; i++) {
        if (i >= D) { setI(cont, i, [0, -60, 0], 0.001); setI(quant, i, [0, -60, 0], 0.001); continue; }
        const z = base[i] + 0.55 * Math.sin(2 * Math.PI * p * 2 + wob[i]), o = fsq(z, Lv), x = -W / 2 + (i + 0.5) * dx;
        const yb = o.b * H, yr = o.r * H, w = Math.min(0.32, dx * 0.34);
        setI(cont, i, [x - w * 0.6, Y0 + yb / 2, 0], [w, Math.max(0.01, Math.abs(yb)), 0.45]); colI(cont, i, hex3(0x8e9bb8));
        setI(quant, i, [x + w * 0.6, Y0 + yr / 2, 0], [w, Math.max(0.01, Math.abs(yr)), 0.45]); colI(quant, i, hex3(COL.q));
        if (Math.abs(o.b - o.r) < 0.05) same++;
      }
      done(cont); done(quant);
      const nT = Math.min(34, Lv + 1); for (let i = 0; i < 34; i++) { if (i < nT) { const y = Y0 + (i - (Lv - 1) / 2 - 0.5) * H + H / 2 + (Lv % 2 === 0 ? 0.5 * H : 0) - 0.5 * H; setI(ticks, i, [0, y, -0.4], [W + 0.6, 0.012, 0.012]); colI(ticks, i, [0.3, 0.36, 0.48]); } else setI(ticks, i, [0, -60, 0], 0.001); } done(ticks);
      const bits = 2 * D * Math.log2(Lv), key = `${Lv}-${D}`, T = FSQ_T[key];
      info(`FSQ-${key}：2 个 token × ${D} 维 × log₂${Lv}\n= ${bits} 比特${key === '32-32' ? '（默认）' : ''}`);
      tbl(`表 3(B)，32 卡：未见内容 ${T[0]}% · ${T[1]} mm\n重复 ${T[2]}% · ${T[3]} mm`);
      cap(`每一维被卡到 ${Lv} 个整数之一。反传时取整当恒等（直通估计），所以 PPO 的梯度能穿过去。下面画的是第一个 token 的 ${D} 维，横线是量化级`);
    } };
  }

  /* ---------- scene 6: four losses, gradient paths; toy latent alignment by real GD ---------- */
  function s6(G) {
    G.add(L.grid(36, 36));
    const nd = {
      er: block(2, 1.2, 1.4, COL.er, [-9, 0.7, -4]), em: block(2, 1.2, 1.4, COL.em, [-9, 0.7, 0]), eh: block(2, 1.2, 1.4, COL.eh, [-9, 0.7, 4]),
      q: block(1.4, 2, 2, COL.q, [-4.6, 1.1, 0]), z: block(0.7, 1.6, 1, COL.z, [-1.8, 0.9, 0]),
      dc: block(2.8, 1.4, 1.6, COL.dc, [2.2, 0.8, 3]), dr: block(2.8, 1.2, 1.5, COL.dr, [2.2, 0.7, -3]), cr: block(2.2, 1.2, 1.4, COL.crit, [6.8, 0.7, 3])
    };
    const names = { er: 'ℰr', em: 'ℰm', eh: 'ℰh', q: 'FSQ', z: 'z', dc: '𝒟c', dr: '𝒟r', cr: '评论家' };
    Object.entries(nd).forEach(([k, m]) => G.add(m, lab(names[k], [m.position.x, m.position.y + 1.3, m.position.z], { size: 22 })));
    const LOSS = [
      { n: 'ℒppo', on: ['er', 'em', 'eh', 'q', 'dc', 'cr'], t: 'PPO 的梯度穿过 𝒟c 和 FSQ（直通）回到编码器；<b>𝒟r 不受它影响</b>', path: [[6.8, 0.7, 3], [2.2, 0.8, 3], [-1.8, 0.9, 0], [-4.6, 1.1, 0], [-9, 0.7, 0]], w: '权重 1' },
      { n: 'ℒrecon', on: ['er', 'em', 'eh', 'dr'], t: '三个 token 都要能经 𝒟r 重建机器人动作。输入人体时，它就是<b>重定向损失</b>。代码权重 <b>0.01</b>', path: [[2.2, 0.7, -3], [-1.8, 0.9, 0], [-4.6, 1.1, 0], [-9, 0.7, -4]], w: '代码权重 0.01' },
      { n: 'ℒtoken', on: ['er', 'em', 'eh'], t: '同一段动作的三个 token 两两拉近。代码在<b>量化前</b>的潜变量上算 MSE，权重 1.0', path: [[-9, 0.7, -4], [-9, 0.7, 0], [-9, 0.7, 4]], w: '代码权重 1.0（三对）' },
      { n: 'ℒcycle', on: ['er', 'eh', 'dr'], t: 'z_h → 𝒟r → 再过 ℰr，要回到 z_r。代码中目标 z_r 没有 detach（这个类），权重 1.0', path: [[-9, 0.7, 4], [-1.8, 0.9, 0], [2.2, 0.7, -3], [-9, 0.7, -4]], w: '代码权重 1.0' }
    ];
    let k = null, ali = 0;
    Object.values(nd).forEach(m => {});
    const flow = stream(G, 14, COL.grad, 0.14), W = dynLab(G, [-1.8, 5.3, 0], { size: 24, border: 'rgba(255,122,89,.85)' });
    /* toy: three points, real gradient descent on the sum of pairwise squared distances */
    const pts = inst(BALL, 3); G.add(pts); const C = [COL.er, COL.em, COL.eh].map(hex3);
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(8, 6, 0.02)), new THREE.LineBasicMaterial({ color: 0x4a5878, transparent: true, opacity: 0.8 })); box.position.set(12, 4.2, -3); G.add(box);
    G.add(lab('玩具：ℒtoken 的梯度下降', [12, 7.9, -3], { size: 20 }));
    const dist = dynLab(G, [12, 0.5, -3], { size: 21 });
    const P0 = [[-2.6, 1.8], [2.8, 1.2], [-0.6, -2.2]];
    return { ctls: [
      { label: '损失', items: LOSS.map(l => l.n), pick(q) { k = q; }, cur: () => k },
      { label: 'ℒtoken', items: ['开', '关'], pick(q) { ali = q; }, cur: () => ali }
    ], update(p) {
      const s = k ?? Math.min(3, Math.floor(p * 4)), l = LOSS[s];
      Object.entries(nd).forEach(([n, m]) => glow(m, l.on.includes(n) ? 0.6 * (0.7 + 0.3 * Math.sin(p * 50)) : 0));
      flow(l.path, (p * 14) % 1, 1); W(`${l.n} · ${l.w}`);
      const P = P0.map(a => a.slice()), steps = ali ? 0 : Math.floor(p * 40), lr = 0.012;
      for (let it = 0; it < steps; it++) { const g = P.map(() => [0, 0]); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== j) { g[i][0] += 2 * (P[i][0] - P[j][0]); g[i][1] += 2 * (P[i][1] - P[j][1]); } P.forEach((q, i) => { q[0] -= lr * g[i][0]; q[1] -= lr * g[i][1]; }); }
      P.forEach((q, i) => { setI(pts, i, [12 + q[0], 4.2 + q[1], -3], 0.3); colI(pts, i, C[i]); }); done(pts);
      const d = (a, b) => Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]), md = (d(0, 1) + d(0, 2) + d(1, 2)) / 3;
      dist(`第 ${steps} 步，平均距离 ${md.toFixed(3)}`);
      cap(l.t);
    } };
  }

  /* ---------- scene 7: adaptive sampling, formula from motion_lib_base.py ---------- */
  function s7(G) {
    G.add(L.grid(34, 34));
    const N = 24, R = L.rng(5), f0 = Array.from({ length: N }, (_, i) => 0.008 + R() * 0.03);
    f0[6] = 0.55; f0[7] = 0.34; f0[17] = 0.18;  /* three hard bins */
    let bk = 0; const BETAS = [200, 2];
    const bars = inst(BOX, N), prob = inst(BOX, N); G.add(bars, prob);
    const X = i => -13.2 + i * 1.15;
    G.add(lab('失败率 f（玩具）', [8, 2.6, -3], { size: 21 }), lab('采样概率 P（当场算）', [8, 5.6, 3], { size: 21 }));
    const e = dynLab(G, [8, 8.6, 0], { size: 22, border: 'rgba(242,193,78,.85)' });
    const cl = inst(BOX, 1); G.add(cl);
    return { ctls: [{ label: 'β', items: ['200（论文）', '2（看上限）'], pick(k) { bk = k; }, cur: () => bk }], update(p) {
      const beta = BETAS[bk], learn = seg(p, 0.05, 0.95), f = f0.map((v, i) => v * (1 - 0.72 * learn * (i === 6 || i === 7 ? 0.55 : 1)));
      const mean = f.reduce((a, b) => a + b) / N, capv = mean * beta, w = f.map(v => Math.min(v, capv)), sum = w.reduce((a, b) => a + b), P = w.map(v => 0.9 * v / sum + 0.1 / N);
      f.forEach((v, i) => { const h = Math.max(0.02, v * 5); setI(bars, i, [X(i), h / 2, -3], [0.82, h, 0.9]); colI(bars, i, hex3(COL.dc)); });
      P.forEach((v, i) => { const h = Math.max(0.02, v * 12); setI(prob, i, [X(i), h / 2, 3], [0.82, h, 0.9]); colI(prob, i, hex3(COL.er)); });
      done(bars); done(prob);
      const capped = f.filter(v => v > capv).length, maxP = Math.max(...P), unif = 1 / N;
      setI(cl, 0, [0, capv * 5, -3], capv * 5 > 4.5 ? 0.001 : [28, 0.03, 1.1]); colI(cl, 0, hex3(COL.q)); done(cl);
      e(`均值 f̄ = ${mean.toFixed(3)}，上限 = ${capv.toFixed(3)}\n被压住的桶 ${capped} 个，最大 P 是均匀的 ${(maxP / unif).toFixed(1)} 倍`);
      cap(`随着难片段被学会（失败率假设地下降），采样也跟着回落。任何一桶的概率不低于 0.1/N，学会的不会被完全遗忘`);
    } };
  }

  /* ---------- scene 8: planner, spring computed live; masked token schedule ---------- */
  function s8(G) {
    G.add(L.grid(36, 36));
    let vk = 1, form = 0; const V = [1, 3, 6], c = 5 * Math.LN2, N = 16, LM = 8;
    const tok = inst(BOX, N); G.add(tok);
    G.add(lab('关键帧', [-13.6, 7.9, 0], { size: 19 }), lab('关键帧', [-0.8, 7.9, 0], { size: 19 }));
    const kf = [block(0.9, 1.2, 0.9, COL.ref, [-13.6, 6.6, 0]), block(0.9, 1.2, 0.9, COL.ref, [-0.8, 6.6, 0])]; G.add(kf[0], kf[1]);
    const X0 = 2.8, W = 13, Hp = 5;
    const line = polyline(G, 100, COL.er), targ = polyline(G, 2, COL.q, 0.7), axisX = polyline(G, 2, 0x8e9bb8, 0.6), axisY = polyline(G, 2, 0x8e9bb8, 0.6);
    axisX(t => [X0 + W * t, 0.4, 0]); axisY(t => [X0, 0.4 + (Hp + 2.2) * t, 0]);
    const dot = L.sphere(0.2, COL.er); G.add(dot);
    const rb = robot(COL.robot); G.add(rb);
    const inf = dynLab(G, [9.2, 8.6, 0], { size: 22, border: 'rgba(79,201,138,.85)' }), tkl = dynLab(G, [-7.2, 8.6, 0], { size: 22 });
    G.add(lab('t = 0', [X0, -0.2, 0], { size: 18 }), lab('2 s', [X0 + W, -0.2, 0], { size: 18 }));
    return { ctls: [
      { label: '命令速度', items: V.map(v => v + ' m/s'), pick(k) { vk = k; }, cur: () => vk },
      { label: '式 (8)', items: ['代码版', '印刷版'], pick(k) { form = k; }, cur: () => form }
    ], update(p) {
      /* masked tokens: cosine schedule, finalization proportion per iteration */
      const it = Math.min(LM, Math.floor(p * (LM + 1))), frac = 1 - Math.cos(Math.PI / 2 * it / LM), nDone = Math.round(frac * N);
      const R = L.rng(9), order = Array.from({ length: N }, (_, i) => i).map(i => [R(), i]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
      const fin = new Set(order.slice(0, nDone));
      for (let i = 0; i < N; i++) { const on = fin.has(i); setI(tok, i, [-12.4 + i * 0.72, 6.6, 0], [0.62, on ? 1.1 : 0.5, 0.8]); colI(tok, i, on ? hex3(COL.q) : [0.24, 0.28, 0.36]); } done(tok);
      tkl(`第 ${it} / ${LM} 轮：定下 ${(frac * 100).toFixed(0)}%（${nDone}/${N} 个 token）`);
      /* spring */
      const v = V[vk], x0 = 0, v0 = 0.6, xT = x0 + v * 1.0, y = c / 2, j0 = x0 - xT, j1 = v0 + j0 * y;
      const code = t => (j0 + j1 * t) * Math.exp(-y * t) + xT;
      const print = t => ((xT - x0) + (v0 + y * (xT - x0)) * t) * Math.exp(-y * t);
      const fn = form ? print : code, sY = Hp / 6.2, mk = (t, x) => [X0 + W * t / 2, 0.4 + x * sY, 0];
      line(u => mk(u * 2, fn(u * 2)));
      targ(u => [X0 + W * u, 0.4 + xT * sY, 0]);
      const t = p * 2, x = fn(t); dot.position.set(...mk(t, x));
      inf(`x_T = ${xT.toFixed(1)} m，x₀ = 0，v₀ = ${v0}（假设）\nx(0) = ${fn(0).toFixed(2)}，x(1 s) = ${fn(1).toFixed(2)}，x(2 s) = ${fn(2).toFixed(2)}`);
      const w = walk(p * 7, 0.3 + 0.06 * v); pose(rb, w, [-14.4 + clamp(x / 6.2, -0.1, 1.1) * 14, 0, 2.6], 2.2, Math.PI / 2);
      cap(form ? '<b>印刷版：</b>照原文式 (8) 算，从 x_T − x₀ 出发、衰减到 0，并不走到目标。黄线是目标' : '<b>代码版：</b>从 x₀ 出发、初速 v₀、平滑走向 x_T（黄线）。半衰期 2 ln2 / c = 0.4 s。上方是掩码 token 按余弦调度被逐轮定下');
    } };
  }

  /* ---------- scene 9: teleop & multimodal, multi-rate loops ---------- */
  function s9(G) {
    G.add(L.grid(36, 36));
    const SRC = [
      { n: '全身 VR', enc: 2, t: 'PICO 全身 → 87 维 → ℰh → 通用 token', d: '头显 ＋ 2 个踝追踪器 ＋ 手柄' },
      { n: '三点 VR', enc: 1, t: '头和双手位姿 ＋ 腰高 ＋ 导航命令 → 规划器补下身 → ℰm', d: '头显 ＋ 手柄（无踝追踪器）' },
      { n: '视频/文本/音乐', enc: 2, t: 'GEM → 人体动作（≥60 fps）→ ℰh', d: '单目 RGB、自然语言或音乐' },
      { n: '手柄', enc: 0, t: '命令 → 规划器 → 机器人动作 → ℰr', d: '速度、方向、风格' }
    ];
    let k = null;
    const sb = SRC.map((s, i) => { const m = block(3, 0.9, 1.3, COL.task, [-13, 0.55, -5.4 + i * 3.6]); G.add(m, lab(s.n, [-13, 1.5, -5.4 + i * 3.6], { size: 20 })); return m; });
    const pl = block(2.8, 1.2, 1.5, COL.gen, [-7, 0.7, -3]), gem = block(2.8, 1.2, 1.5, COL.gen, [-7, 0.7, 3]); G.add(pl, gem, lab('规划器 10 Hz', [-7, 1.9, -3], { size: 20 }), lab('GEM', [-7, 1.9, 3], { size: 20 }));
    const encC = [COL.er, COL.em, COL.eh], Ze = [-3.6, 0, 3.6], enc = ['ℰr', 'ℰm', 'ℰh'].map((t, i) => { const m = block(1.8, 1.3, 1.6, encC[i], [-1.6, 0.7, Ze[i]]); G.add(m, lab(t, [-1.6, 1.8, Ze[i]], { size: 22 })); return m; });
    const z = block(0.8, 1.8, 1.2, COL.z, [1.8, 1, 0]), dc = block(2.4, 1.4, 1.6, COL.dc, [4.8, 0.8, 0]); G.add(z, dc, lab('token', [1.8, 2.4, 0], { size: 20 }), lab('𝒟c', [4.8, 2.1, 0], { size: 22 }));
    const rb = robot(COL.robot); G.add(rb);
    const f = stream(G, 12, COL.z, 0.13);
    const loops = [['写电机 500 Hz', 500, COL.dc], ['输入 100 Hz', 100, COL.gen], ['控制 50 Hz', 50, COL.er], ['规划 10 Hz', 10, COL.q]].map((l, i) => { const m = block(0.7, 0.7, 0.7, l[2], [7.4 + i * 2.6, 6.4, 0]); G.add(m, lab(l[0], [7.4 + i * 2.6, 7.4, 0], { size: 17 })); return { m, hz: l[1] }; });
    const d = dynLab(G, [-8, 6.6, 0], { size: 22, border: 'rgba(56,209,255,.8)' });
    return { ctls: [{ label: '来源', items: SRC.map(s => s.n), pick(q) { k = q; }, cur: () => k }], update(p) {
      const s = k ?? Math.min(3, Math.floor(p * 4)), S_ = SRC[s], ph = (p * 18) % 1, zs = -5.4 + s * 3.6;
      sb.forEach((m, i) => glow(m, i === s ? 0.65 : 0)); enc.forEach((m, i) => glow(m, i === S_.enc ? 0.7 : 0));
      glow(pl, s === 1 || s === 3 ? 0.6 : 0); glow(gem, s === 2 ? 0.6 : 0); glow(z, 0.5); glow(dc, 0.5);
      const mid = s === 1 || s === 3 ? [[-7, 0.7, -3]] : s === 2 ? [[-7, 0.7, 3]] : [];
      f([[-13, 0.55, zs], ...mid, [-1.6, 0.7, Ze[S_.enc]], [1.8, 1, 0], [4.8, 0.8, 0], [8.6, 0.9, 0]], ph, 1);
      d(S_.d);
      const T = p * 15 * 0.05; /* slowed 20x */
      loops.forEach(l => { const u = (T * l.hz) % 1; glow(l.m, u < 0.5 ? 0.9 : 0.05); });
      const w = walk(p * 14, 0.36), up = s === 1 || s === 0; if (up) { w.sL = 1.1 + 0.3 * Math.sin(p * 30); w.sR = 1.2 + 0.3 * Math.cos(p * 25); } pose(rb, w, [10.5, 0, 0], 2.5, -Math.PI / 2);
      cap(S_.t + '。<b>策略和 𝒟c 一字不改</b>');
    } };
  }

  /* ---------- scene 10: VLA, real numbers with Wilson intervals ---------- */
  const wilson = (k, n, z = 1.96) => { const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)]; };
  function s10(G) {
    G.add(L.grid(38, 38));
    let m = 0;
    const TASKS = [['苹果到盘子', 'apple', 90, 20], ['捡胡萝卜', 'carrot', 75, 20], ['捡刷子', 'scrub', 95, 20], ['开垃圾桶（脚）', 'pedal', 70, 10], ['汽水罐入桶', 'soda', 60, 10], ['电钻和箱子', 'drill', 70, 10]];
    const AB = [['胡萝卜', 75, 60, 20], ['开垃圾桶（脚）', 70, 20, 10], ['汽水罐入桶', 60, 0, 10]];
    const bars = inst(BOX, 12), wh = inst(BOX, 12); G.add(bars, wh);
    const X = i => -13 + i * 2.6, sY = 0.065;
    const vl = Array.from({ length: 12 }, () => ({ sp: null, cur: '' })), nm = Array.from({ length: 6 }, () => ({ sp: null, cur: '' }));
    const put = (o, text, pos, size, vis) => { if (text !== o.cur) { if (o.sp) { G.remove(o.sp); L.dispose(o.sp); LABS = LABS.filter(s => s !== o.sp); } o.sp = lab(text, pos, { size }); G.add(o.sp); o.cur = text; } if (o.sp) { o.sp.position.set(...pos); o.sp.visible = vis; } };
    const h = dynLab(G, [8.5, 7.6, 0], { size: 24, border: 'rgba(242,193,78,.85)' });
    const vla = block(3, 1.6, 2, COL.gen, [8.5, 0.9, 0]), tk = block(1.2, 1.8, 1.2, COL.z, [12.2, 1, 0]), dc = block(2.2, 1.4, 1.6, COL.dc, [15.2, 0.8, 0]); G.add(vla, tk, dc, lab('GR00T N1.5', [8.5, 2.2, 0], { size: 20 }), lab('78 维', [12.2, 2.5, 0], { size: 20 }), lab('𝒟c', [15.2, 2.1, 0], { size: 21 }));
    const f = stream(G, 8, COL.z, 0.11);
    return { ctls: [{ label: '显示', items: ['token 对 SMPL', '全部任务'], pick(k) { m = k; }, cur: () => m }], update(p) {
      const g = seg(p, 0.02, 0.5); let n = 0;
      if (m === 0) {
        AB.forEach((a, i) => {
          [[a[1], hex3(COL.q)], [a[2], hex3(0x8e9bb8)]].forEach(([v, c], j) => {
            const x = X(i * 2 + 0.2) + j * 1.6, hh = Math.max(0.02, v * sY * g), w = wilson(v / 100 * a[3], a[3]);
            setI(bars, n, [x, hh / 2, 0], [1.4, hh, 1.4]); colI(bars, n, c);
            const lo = w[0] * 100 * sY, hi = w[1] * 100 * sY; setI(wh, n, g > 0.98 ? [x, (lo + hi) / 2, 0.9] : [0, -60, 0], g > 0.98 ? [0.09, Math.max(0.02, hi - lo), 0.09] : 0.001); colI(wh, n, [0.95, 0.95, 0.98]);
            put(vl[n], `${v}%`, [x, hi + 0.45, 0], 20, g > 0.98); n++;
          });
          put(nm[i], `${a[0]} · ${a[3]} 次`, [X(i * 2 + 0.2) + 0.8, -0.7, 2.2], 18, true);
        });
        for (let i = 3; i < 6; i++) if (nm[i].sp) nm[i].sp.visible = false;
        h('黄：token  灰：SMPL\n均值 68% 对 27%，差 +42');
      } else {
        TASKS.forEach((a, i) => {
          const x = X(i), hh = Math.max(0.02, a[2] * sY * g), w = wilson(a[2] / 100 * a[3], a[3]);
          setI(bars, n, [x, hh / 2, 0], [1.9, hh, 1.6]); colI(bars, n, hex3(i === 0 ? COL.em : COL.q));
          const lo = w[0] * 100 * sY, hi = w[1] * 100 * sY; setI(wh, n, g > 0.98 ? [x, (lo + hi) / 2, 1.0] : [0, -60, 0], g > 0.98 ? [0.09, Math.max(0.02, hi - lo), 0.09] : 0.001); colI(wh, n, [0.95, 0.95, 0.98]);
          put(vl[n], `${a[2]}%`, [x, hi + 0.45, 0], 20, g > 0.98);
          put(nm[i], `${a[0]} · ${a[3]} 次`, [x, -0.7 - (i % 2) * 0.7, 2.2], 17, true); n++;
        });
        h('紫：三点接口  黄：全身接口\n五任务平均 75%（两种捡取合并算）');
      }
      for (; n < 12; n++) { setI(bars, n, [0, -60, 0], 0.001); setI(wh, n, [0, -60, 0], 0.001); if (vl[n].sp) vl[n].sp.visible = false; } done(bars); done(wh);
      f([[8.5, 0.9, 0], [12.2, 1, 0], [15.2, 0.8, 0]], (p * 14) % 1, 1);
      cap(m === 0 ? '同样的任务，把 VLA 的动作空间从<b>显式姿态</b>换成<b>通用 token</b>。白线是 95% Wilson 区间（我的计算）' : 'token 是全身的，所以脚也能当操作手用。10 次试验的任务，白线很长，不宜细比');
    } };
  }

  /* ---------- scene 11: termination criteria, computed live ---------- */
  function s11(G) {
    G.add(L.grid(32, 32));
    let ak = 2, ek = 0; const A = [0, 45, 66.4, 90, 180], R1 = 1, R2 = Math.sqrt(0.2);
    const ref = robot(COL.ref, { opacity: 0.45 }), rb = robot(COL.robot); G.add(ref, rb);
    const lamp = [['SONIC 训练\n角² > 0.2（25.6°）', COL.em], ['SONIC 评测\n角² > 1（57.3°）', COL.er], ['SuperMimic\n倾斜 > 0.8', COL.eh]].map((a, i) => { const m = L.sphere(0.5, a[1]); m.position.set(4.6 + i * 3.5, 1.0, 0); m.userData.c = hex3(a[1]); G.add(m, lab(a[0], [4.6 + i * 3.5, 2.7, 0], { size: 18 })); return m; });
    const flag = [0, 1, 2].map(i => ({ sp: null, cur: '' }));
    const put = (i, t) => { const o = flag[i]; if (t !== o.cur) { if (o.sp) { G.remove(o.sp); L.dispose(o.sp); LABS = LABS.filter(s => s !== o.sp); } o.sp = lab(t, [4.6 + i * 3.5, -0.5, 0], { size: 18 }); G.add(o.sp); o.cur = t; } };
    const trip = dynLab(G, [8.1, 7.6, 0], { size: 22, border: 'rgba(242,193,78,.85)' }), meas = dynLab(G, [8.1, 5.2, 0], { size: 21 });
    const tiltOf = (a, e) => Math.abs(Math.cos(a) - Math.cos(a + e));
    return { ctls: [
      { label: '参考俯仰', items: A.map(a => a + '°'), pick(k) { ak = k; }, cur: () => ak },
      { label: '误差轴', items: ['俯仰', '偏航'], pick(k) { ek = k; }, cur: () => ek }
    ], update(p) {
      const a = A[ak] * Math.PI / 180, e = p * 90 * Math.PI / 180, yaw = ek === 1;
      const t = yaw ? 0 : tiltOf(a, e), trips = [e > R2, e > R1, t > 0.8];
      lamp.forEach((m, i) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * (trips[i] ? 1 : 0.05), c[1] * (trips[i] ? 1 : 0.05), c[2] * (trips[i] ? 1 : 0.05)); put(i, trips[i] ? '已触发' : '未触发'); });
      const base = { y: 0.75, hL: 0.1, hR: 0.1, kL: 0.1, kR: 0.1, sL: 0.1, sR: 0.1, eL: 0.2, eR: 0.2 };
      pose(ref, { ...base, pitch: a }, [-6.5, 1.2, 0], 3.6, Math.PI / 2); pose(rb, yaw ? { ...base, pitch: a, yaw: e } : { ...base, pitch: a + e }, [-6.5, 1.2, 0.1], 3.6, Math.PI / 2);
      /* numeric first trip of the tilt criterion for this reference */
      let first = null; if (!yaw) for (let d = 0; d <= 180; d += 0.1) if (tiltOf(a, d * Math.PI / 180) > 0.8) { first = d; break; }
      trip(`参考俯仰 ${A[ak]}°，误差${yaw ? '绕竖直轴' : '绕俯仰轴'}\n三条判据触发于：25.6° · 57.3° · ${yaw ? '永不（偏航不改变重力）' : first == null ? '永不' : first.toFixed(1) + '°'}`);
      meas(`当前误差 ${(e * 180 / Math.PI).toFixed(1)}°，倾斜量 ${t.toFixed(3)}`);
      cap(`倾斜判据随参考姿态变：竖直 78.5°，<b>最紧 47.2°</b>。这里只比判据的角度，<b>不是算失败数</b>`);
    } };
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
  function renderCtl() {
    const box = $('ctl');
    if (api?.ctls) {
      box.hidden = false;
      box.innerHTML = api.ctls.map((c, ci) => `<span class="row"><span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-c="${ci}" data-k="${k}" aria-pressed="${c.cur() === k}">${t}</button>`).join('') + '</span>').join('');
    } else { box.hidden = true; box.innerHTML = ''; }
  }
  function go(i, p0 = 0) {
    cur = (i + SCENES.length) % SCENES.length; showInfo(cur);
    if (!S) return;
    L.clear(root); LABS = []; PICKS = []; lastCap = null;
    const sc = SCENES[cur]; fly(...sc.cam); refDist = sc.cam[2] * aspectFix();
    const G = new THREE.Group(); root.add(G); api = BUILD[cur](G);
    /* deep links for toggles: ?scene=8&c0=1&c1=1 */
    if (api.ctls) api.ctls.forEach((c, ci) => { const v = qs.get('c' + ci); if (v != null && i === (parseInt(qs.get('scene'), 10) || 1) - 1) c.pick(+v); });
    renderCtl();
    pNow = p0; t0 = performance.now() - p0 * sc.dur * 1000; api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
  }
  if (S) {
    S.onTick(() => {
      if (playing && api) {
        const sc = SCENES[cur], el = (performance.now() - t0) / 1000;
        if (el > sc.dur + HOLD) { t0 = performance.now(); pNow = 0; } else pNow = Math.min(1, el / sc.dur);
        api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
      }
      if (tw) { const k = L.reduced() ? 1 : Math.min(1, (performance.now() - tw.t0) / 900), e = L.ease(k), [a, b] = [tw.from, tw.to]; S.setView(L.lerp(a[0], b[0], e), L.lerp(a[1], b[1], e), L.lerp(a[2], b[2], e), a[3].clone().lerp(b[3], e).toArray()); if (k >= 1) tw = null; }
      const f = clamp(S.dist / refDist, 0.6, 1.6); for (const sp of LABS) if (sp.userData.s0) sp.scale.copy(sp.userData.s0).multiplyScalar(f);
    });
    S.onClick(() => PICKS, hit => { const g = hit?.object?.userData?.go ?? hit?.object?.parent?.userData?.go; if (g != null) go(g); });
    S.onHover(() => PICKS, hit => { $('stage').style.cursor = hit ? 'pointer' : ''; });
  }
  $('ctl').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !api?.ctls) return; api.ctls[+b.dataset.c].pick(+b.dataset.k); renderCtl(); api.update(pNow); });
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
