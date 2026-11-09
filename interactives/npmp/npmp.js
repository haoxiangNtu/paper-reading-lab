'use strict';
/* NPMP (Merel et al., arXiv 1811.11711, ICLR 2019) taken apart into eleven animated scenes. Sizes and hyperparameters come from
   the paper (§2, appendix B). There is no official training code; nothing here runs an NPMP network. Each scene's update(p) is a
   pure function of the timeline p plus the current toggles. The humanoid is the hand-made one from interactives/pulse.
   Scenes 3, 4, 6 compute their numbers live on toy problems (labelled 玩具). Scenes 8, 9, 11 draw numbers read from the
   paper's vector figures 3, 4 and 6 (pdftocairo -svg, calibrated on the gridlines). */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { exp: 0xf2a0a0, enc: 0xf2c14e, dec: 0x3aa8e0, z: 0xf2c14e, hl: 0xb48cff, frozen: 0x5f7fb0, data: 0x7cb8ff, nom: 0xeef2fa, noise: 0x8e9bb8, fb: 0x4fc98a, bad: 0xe05d5d, ok: 0x4fc98a, robot: 0xc9d4ea, gold: 0xf2c14e, dim: 0x46506a, white: 0xeef2fa,
    s1: 0x3987e5, s2: 0xd95926, s3: 0x199e70, s4: 0xc98500 };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  /* numbers read from the paper's vector figures (see papers/npmp.html, notes 9, 11, 13, 14) */
  const F3M = ['专家', '开环', '线性反馈', 'LFPC', 'BC 100', 'BC 200', 'BC 500', 'BC 1000'];
  const F3 = {"run_dodge":[[32.81,[28.09,29.56],[23.2,24.49]],[32.81,[8.14,17.93],[4.19,13.29]],[32.81,[26.85,29.16],[21.96,25.57]],[32.26,[28.05,29.07],[22.15,24.51]],[26.65,[10.41,25.2],[6.76,12.83]],[25.87,[16.36,26.71],[10.55,19.3]],[32.36,[26.74,28.59],[19.88,23.75]],[33.06,[28.04,29.24],[22.61,24.56]]],"cartwheel":[[27.35,[22.71,24.87],[18.5,20.86]],[27.35,[12.29,19.8],[9.11,16.88]],[27.35,[23.54,24.75],[16.49,20.75]],[27.32,[22.88,24.43],[16.62,20.41]],[23.17,[19.91,22.94],[14.51,17.84]],[26.13,[22.24,24.66],[15.21,20.51]],[26.34,[21.87,24.27],[17.69,20.94]],[26.11,[22.91,24.8],[16.97,20.23]]],"backflip":[[17.66,[15.18,22.37],[14.73,19.32]],[17.66,[14.1,17.63],[9.61,14.35]],[17.66,[15.68,16.96],[13.04,15.21]],[17.44,[14.9,17.65],[12.05,16.91]],[12.03,[9.63,18.88],[4.52,13.19]],[17.16,[15.39,20.26],[10.3,17.1]],[17.86,[15.83,22.55],[15.25,19.5]],[17.75,[15.59,18.07],[12.67,18.57]]],"twist":[[154.2,[134.11,146.18],[64.3,113.83]],[154.2,[12.04,40.72],[7.6,12.83]],[154.2,[134.9,141.73],[31.47,123.53]],[154.41,[128.96,143.01],[25.21,108.88]],[150.21,[128.68,143.55],[76.61,123.29]],[152.54,[136.32,142.76],[78.23,116.18]],[151.87,[133.37,143.02],[76.25,121.35]],[149.06,[127.48,142.31],[68.73,119.73]]]};
  const F3K = [['run_dodge', 'Run and dodge', 35], ['cartwheel', 'Cartwheel', 30], ['backflip', 'Backflip', 25], ['twist', 'Twist', 200]];
  const F4V = ['β=0', 'β=0.001', 'β=0.1', 'β=1.0', 'α=0', 'dim=20', 'LFPC'];
  const F4 = {"train":[[[0.544,0.41,0.669],[0.461,0.366,0.595],[0.342,0.285,0.479]],[[0.633,0.448,0.888],[0.569,0.407,0.757],[0.429,0.327,0.567]],[[0.739,0.546,0.887],[0.672,0.505,0.797],[0.457,0.384,0.662]],[[0.527,0.342,0.662],[0.504,0.342,0.607],[0.372,0.261,0.474]],[[0.547,0.434,0.711],[0.487,0.369,0.632],[0.392,0.269,0.508]],[[0.649,0.431,0.785],[0.574,0.391,0.695],[0.391,0.294,0.624]],[[0.543,0.413,0.728],[0.484,0.363,0.654],[0.348,0.212,0.527]]],
    "test":[[[0.498,0.396,0.582],[0.466,0.342,0.55],[0.35,0.233,0.433]],[[0.538,0.384,0.791],[0.47,0.361,0.766],[0.386,0.339,0.546]],[[0.707,0.584,0.892],[0.693,0.549,0.809],[0.472,0.359,0.636]],[[0.453,0.241,0.615],[0.428,0.239,0.588],[0.371,0.279,0.516]],[[0.48,0.422,0.589],[0.472,0.436,0.523],[0.371,0.319,0.421]],[[0.502,0.416,0.73],[0.495,0.438,0.704],[0.397,0.352,0.538]],[[0.567,0.4,0.8],[0.516,0.396,0.687],[0.432,0.296,0.556]]]};
  const F6 = {"0.001":[0.0,0.2,0.4,0.4,0.8,1.7,2.3,5.6,10.2,21.0,30.6,42.3,50.6,57.3,63.7,68.8,78.0,84.7,87.4,86.2,90.2,94.1,98.2,102.4,104.8,106.9,108.4,110.4,111.6,113.4,113.9,114.7,116.4,116.4,116.4,116.2,116.2,116.2,116.2,115.4,115.0],"0.1":[0.0,0.8,0.8,2.3,2.3,6.9,18.3,33.0,43.6,54.5,71.0,84.4,97.1,106.9,113.2,115.4,121.4,127.9,130.9,131.0,130.3,128.3,125.2,124.3,123.5,124.2,127.5,131.2,135.6,140.9,144.7,148.2,149.8,152.2,154.0,155.9,157.0,157.9,160.2,161.4,162.5],"0.46":[0.0,0.8,1.3,1.3,2.8,6.0,12.9,19.8,31.6,47.2,65.5,80.3,95.5,103.9,106.6,115.5,126.2,128.4,129.2,135.4,138.4,142.0,148.3,155.3,160.6,164.4,166.5,165.5,162.0,161.5,164.1,168.7,171.5,173.5,172.3,172.7,173.4,176.1,179.0,181.6,182.5],"1.0":[0.0,2.2,2.2,1.9,2.9,5.3,12.7,23.0,33.1,40.4,49.3,55.1,64.7,76.6,83.7,91.3,98.5,101.0,103.4,109.3,115.5,122.6,124.0,125.4,124.7,122.8,122.5,123.5,124.4,126.7,129.6,132.3,136.2,139.3,141.8,144.9,147.0,150.1,151.2,152.0,152.2]};
  /* figure 6b target speeds: 15 segments of about 333 steps, three episodes of five segments */
  const F6B = [2.008, 0.995, 1.052, 0.372, 2.05, 0.754, 1.23, 1.226, 2.932, 0.807, 4.306, 3.768, 1.389, 2.166, 3.542];

  const SCENES = [
    { n: 1, part: '总览', title: '三段：专家、压缩、复用', sub: '图 2 的 3D 版。点方块跳到对应那一幕', dur: 15, cam: [0.1, 1.12, 38, [0, 4.0, 0]],
      html: dl([['第 1 段', '每个动捕片段训一个专家，共 2707 个；SVG(0)＋Retrace，奖励是 SAMCON 能量'], ['第 2 段', '离线把专家压进一个编码器-解码器：行为克隆（带噪声回放）或 LFPC'], ['第 3 段', '解码器当“运动基元模块”，新的高层策略输出 60 维 z，SVG(0)＋Retrace 训练'], ['潜码', 'z ∈ ℝ⁶⁰，每个时间步一个，AR(1) 先验'], ['仿真', 'MuJoCo 里的人形']]) +
        '<p>NPMP 不从头学一个多技能策略。它先有一堆只会一段动作的专家，再把它们的“状态 → 动作”映射离线复制进一个带潜变量瓶颈的逆模型。训练时编码器看一小段未来参考状态，给出 z；解码器只看当前状态和 z 出动作。训完以后解码器单独拿出来，z 就成了新的动作空间。</p>' +
        '<p>三段之间是串行的：专家训完才采数据；压缩是纯监督学习，不在环境里跑学生；下游只训高层策略。论文没写下游时解码器是否冻结，从“把解码器当模块复用”的说法看应是不更新（我的推断）。</p>' +
        src('§1 · §2 · 图 2 · §3.3 · 附录 A') },
    { n: 2, part: '§2.1 专家', title: '2707 个只会一段的专家', sub: 'CMU 动捕切成 2 到 6 秒的片段，每段训一个专家', dur: 14, cam: [0.15, 1.15, 28, [0, 3.2, 0]],
      html: dl([['数据', 'CMU Mocap：100 多位受试者，2000 多个片段'], ['切分', '长于 6 秒的切开，得到约 3000 个 2 到 6 秒的片段'], ['训练集', '2707 个专家，一个片段一个'], ['内容', '一半多是走跑跳转；其余多是站着做手部动作'], ['算法', 'SVG(0)＋Retrace（离策略）'], ['奖励', 'SAMCON 的能量函数，逐步跟踪'], ['技巧', '从参考的任意帧开始（RSI）；摔倒提前终止'], ['用作专家', '随机策略的均值动作']]) +
        '<p>专家是带时间下标的策略：同一个状态在片段的不同时刻会给不同动作。它只对“自己那条参考附近”负责，对中等大小的动作噪声稳健。</p>' +
        '<p>论文说训练专家的办法“大体沿用 Peng 等 2018（DeepMimic）”，指的是逐片段跟踪、RSI 和提前终止这一套设定；算法和奖励不同：DeepMimic 用 PPO 和自己的姿态/速度/末端/质心奖励，这里用 SVG(0)＋Retrace 和 SAMCON 的能量函数（附录 A）。</p>' +
        '<p>开关“镜像”：按左右对称把专家镜像一份，论文说“大约让专家数据翻倍”，结果略好，图 4 的所有模型都用了镜像（脚注 4）。</p>' +
        guess('左边的片段条长度是随机抽的 2 到 6 秒，只示意切分；格子里只画了 280 个方块代表 2707 个专家。小人的动作是手写的。') +
        src('§2.1 · 图 1 · 附录 A · §3.2 脚注 4') },
    { n: 3, part: '§2.3 带噪声回放', title: '行为克隆：带噪声跑专家，记下它想做的动作', sub: '玩具：专家周围的“管子”。切换回放条数和噪声', dur: 15, cam: [0, 1.2, 24, [0, 3.6, 0]],
      html: dl([['做法', '让专家带动作噪声 η 执行，记录访问到的状态 s 和专家的<b>均值</b>动作 μ_E(s)'], ['损失', '式 (4)：min E‖μ_E(s) − μ_θ(s)‖²'], ['对应', '一种版本等价于 DART（Laskey 等 2017）'], ['规模', '图 4 里每个专家 100 条'], ['代价', '要跑很多条回放']]) +
        '<p>只在专家的名义轨迹上回归，学生一偏离就没见过这个状态。让专家带噪声跑，状态会散成一根“管子”，学生在整根管子上都学到专家的纠正动作。执行的是带噪声的动作，记录的是不带噪声的均值动作，这一点很关键。</p>' +
        '<p>它和 DAgger 的区别：数据仍然来自专家自己跑，不需要在训练时执行学生。所以可以离线、按专家一个个采，扩到几千个专家。</p>' +
        toyb('一维状态随时间走一条参考曲线，专家是 a = a*(t) − 3 (s − s*(t))，动作噪声 σ = η。画出的每条线是一次带噪声回放，点是记下的 (s, μ_E(s))。当场计算，数字和论文无关。') +
        src('§2.3 式 (4) · 附录 B') },
    { n: 4, part: '§2.3 LFPC', title: '线性反馈策略克隆：一条轨迹加雅可比', sub: '玩具：扰动状态处的目标动作。切换 LFPC 和式 (11)', dur: 15, cam: [0, 1.22, 24, [-0.8, 3.6, 0]],
      html: dl([['记录', '名义轨迹上的 s*_t、a*_t 和雅可比 J*_t = ∂μ_E/∂s'], ['反馈策略', '式 (6)：μ_FB(s_t) = a*_t + J*_t (s_t − s*_t)'], ['训练', '式 (8)：在 s* + δs 上回归 a* + J* δs'], ['扰动 Δ', '对所有片段用同一个固定的边缘分布'], ['批', '32 段长 30 的子序列，每段 5 份扰动'], ['数据', '每个专家只跑 1 条']]) +
        '<p>专家在名义轨迹附近近似线性：μ_E(s + δs) = μ_E(s) + J δs + O(‖δs‖²)（式 5）。于是不必再跑专家，只要把名义状态随机扰动，用一阶展开当目标动作，就能离线造出任意多的训练对。论文把它看作一种数据增强，也是同时匹配均值动作和雅可比。</p>' +
        '<p>附录 C 指出另一种做法（式 11）是错的：在扰动输入上仍然要求输出原来的动作 μ_E(s)。对图像分类这是合理的去噪，对控制就等于把反馈增益设成 0，学生会变成开环。开关可以切换两种目标，看箭头的差别就是 J δs。</p>' +
        toyb('专家是 μ_E(s) = a* − 1.5 tanh(2 (s − s*))，名义点的 J = −3。右边当场算一阶近似的误差 |μ_E − μ_FB|，随 |δs| 增大而变大（这个专家是奇函数，误差是三阶的）。') +
        src('§2.3 式 (5)-(8) · 附录 B · 附录 C 式 (11)') },
    { n: 5, part: '§2.2 结构', title: '编码器、潜码、解码器', sub: '图 2 的部件和尺寸。切换编码器看的未来帧', dur: 14, cam: [0.05, 1.18, 30, [0, 4.0, 0]],
      html: dl([['编码器 q(z_t | z_{t−1}, x_t)', 'MLP，2 层 × 1024；输出对角高斯，方差可学'], ['x_t', '[s_t, …, s_{t+K}]，K = 5，共 6 个状态'], ['潜码 z_t', '60 维（消融用 20 维）'], ['解码器 π(a_t | s_t, z_t)', 'MLP，3 层 × 1024；高斯，标准差固定 0.1'], ['动作', '归一化到 [−1, 1]'], ['编码器不看动作', '为了一次性模仿时只需要状态']]) +
        '<p>这是一个“逆模型”：给当前状态和想去的地方（一小段未来参考），输出动作。中间的 z 是瓶颈：解码器看不到未来，只能从 z 里知道该做什么，所以 z 必须是对短期运动的压缩表示。编码器还看上一步的 z，所以它是一个自回归的后验。</p>' +
        '<p>脚注 2：试过看更远的未来，x_t = [s_t, s_{t+1}, s_{t+3}, s_{t+6}, s_{t+10}, s_{t+15}]，结果差不多。两种都是 6 个状态，输入维度相同，只是跨度从 5 步变成 15 步。</p>' +
        '<p>解码器的标准差固定为 0.1，作者说这样明显更不容易过拟合。论文没有给状态的维度和激活函数，所以下面的参数量只能算隐藏层部分：解码器两层 1024 × 1024 之间是 2,097,152 个权重，编码器的 1024 × 1024 一层是 1,048,576 个。</p>' +
        src('§2.2 式 (1) · 脚注 2 · 附录 B') },
    { n: 6, part: '§2.2 先验', title: 'AR(1) 先验：相邻时刻的 z 要挨着', sub: '当场采样。切换 α，看轨迹和自相关', dur: 14, cam: [0, 1.25, 26, [0, 4.2, 0]],
      html: dl([['式 (2)', 'z_t = α z_{t−1} + σ ε，ε ~ N(0, I)'], ['σ', '√(1 − α²)，保证边缘分布始终是 N(0, I)'], ['α', '0.95（消融 α = 0）'], ['α = 0.95 时', 'σ = 0.312；k 步自相关 0.95^k，半衰 13.5 步'], ['图 4', 'α = 0 时测试集无噪声中位数 0.480，α = 0.95 时 0.707']]) +
        '<p>作者希望同一段动作里相邻时刻的片段在潜空间里也相邻，于是给 z 一个一阶自回归的弱先验。它进入证据下界的 log p_z(z_t | z_{t−1}) 一项：后验 q 被拉向“上一步的 z 乘 0.95”附近。α = 0 时先验变成每步独立的 N(0, I)，相邻 z 之间没有约束。</p>' +
        '<p>作者在结尾说以后可以试别的 α 和可学习的先验。后来的 PULSE 用的就是只看本体感觉的可学习先验，同时另加一个系数 0.99 的相邻帧惩罚（本站 PULSE 页）。</p>' +
        toyb('左边从先验采两维的 z（用同一组随机数，只换 α），每步一个点。右边柱子是理论自相关 α^k，k = 0 到 30；读数是从这条样本当场估计的 lag-1 相关。') +
        src('§2.2 式 (2) · §3.2 · 图 4') },
    { n: 7, part: '§2.2 目标', title: '证据下界和 β', sub: '式 (3) 的三项。切换 β，看等效的动作标准差', dur: 14, cam: [0, 1.25, 25, [0, 4.0, 0]],
      html: dl([['式 (3)', 'E_q Σ_t [ log π(a_t | s_t, z_t) + β ( log p_z(z_t | z_{t−1}) − log q(z_t | z_{t−1}, x_t) ) ]'], ['β = 1', '标准的 log p(a | s) 下界'], ['等价', 'σ 固定时，改 β 等于改输出方差：σ_eff = 0.1 √β'], ['图 4 最好', 'β = 0.1，σ_eff = 0.032'], ['优化', '重参数化，Adam，学习率 10⁻⁴，批 512 段 × 30 步']]) +
        '<p>第一项让解码器在 z 下给出专家动作；β 乘的两项合起来是 −β KL(q ‖ p_z)，让后验靠近 AR(1) 先验。作者把它解释成条件信息瓶颈（Alemi 等 2017）：在已知 z_{t−1} 的条件下，限制 z_t 从未来 x_t 拿多少信息。</p>' +
        '<p>附录 B 说固定解码器方差时，调 β 等同于调输出方差（差一个常数）。把整个目标除以 β 就看得出来：重建项的系数变成 1/(2σ²β)，等于把 σ 换成 σ√β。所以 β = 0.1 相当于用 σ = 0.032 的高斯去拟合动作。</p>' +
        '<p>右边柱子是图 4 测试集、无噪声时的中位相对表现，按 β 排开：0.498、0.538、0.707、0.453。太小和太大都不好。</p>' +
        src('§2.2 式 (3) · 附录 B · 图 4（矢量读数）') },
    { n: 8, part: '§3.1 单技能', title: '一个专家复制给另一个网络', sub: '图 3 的读数。切换四个片段', dur: 13, cam: [0, 1.22, 29, [0, 4.4, 0]],
      html: dl([['片段', 'Run and dodge、Cartwheel、Backflip、Twist（图 1）'], ['对照', '专家、开环动作序列、线性反馈策略、LFPC（1 条）、BC 100/200/500/1000 条'], ['噪声', '无、0.05、0.1（每个执行器独立高斯，动作范围 [−1, 1]）'], ['纵轴', '回合回报，越高越像参考']]) +
        '<p>柱高是无噪声（名义）回合的回报；两根竖条是噪声 0.05 和 0.1 时的最小到最大值（原图是小提琴图，只画了极值，没有中位数）。</p>' +
        '<p>能看到的几件事：开环和线性反馈在无噪声时与专家完全相同，这是应该的（确定性仿真里复现同一条轨迹）；一加噪声，开环在 run and dodge 上掉到 8 到 18，twist 上掉到 12 到 41。LFPC 用 1 条轨迹，在多数格子里和几百条的 BC 接近；BC 100 条在 run and dodge 和 backflip 上无噪声时反而偏低（26.65、12.03）。Twist 高噪声下 LFPC 最差的一次只有 25，BC 都在 69 以上。</p>' +
        src('§3.1 · 图 3（矢量读数，见精读页读者注 9）') },
    { n: 9, part: '§3.2 压缩', title: '2707 个专家压进一个模型', sub: '图 4 的中位数和四分位。切换训练集和测试集', dur: 14, cam: [0, 1.2, 31, [-0.3, 4.4, 0]],
      html: dl([['评测', '把专家轨迹编码成 z 序列，再在环境里按这串 z 执行解码器'], ['开环 / 闭环', '对 z 是开环，对状态是闭环'], ['指标', '跟踪奖励，除以专家的回报'], ['最好', 'BC 100 条、β = 0.1：训练集中位 0.739，测试集 0.707'], ['LFPC', '训练 0.543，测试 0.567']]) +
        '<p>这里不看动作重建误差，而是让模型真的去跑：一串固定的 z 喂给解码器，如果解码器不会稳住身体，按开环的 z 执行很快就会摔。能跑起来本身就说明解码器学会了反馈。</p>' +
        '<p>论文的结论：BC 100 条加中等正则（β = 0.1）最好；LFPC 较差但定性接近；正则和大潜空间都重要；α = 0 变差。读数也说明压缩是有损的：最好的配置下，仍有一半片段的回报不到专家的 74%（训练集）或 71%（测试集）。测试集上 LFPC 的中位数 0.567 排在第二。</p>' +
        src('§3.2 · 图 4（矢量读数，见精读页读者注 11）· 脚注 4') },
    { n: 10, part: '§3.3 分析', title: '一次性模仿，和直接优化 z', sub: '编码器失败还是解码器失败？', dur: 15, cam: [0.2, 1.15, 25, [-1.5, 3.6, 0]],
      html: dl([['一次性模仿', '看一段从没见过的参考轨迹，编码，执行'], ['式 (10)', 'min_{z_1…z_T} Σ ‖μ_θ(s_t, z_t) − a*_t‖²'], ['结果', '一次性模仿低于 50% 的一批片段，优化后中位数 43% → 78%'], ['图 5', '前三个主成分里的潜空间点云，和三段动作的原始 / 优化后 z 轨迹'], ['拼接', '把几段 z 序列接起来，有时能平滑过渡（如连续转弯）']]) +
        '<p>一次性模仿失败时，可能是编码器没编对，也可能是解码器根本做不出这个动作。式 (10) 绕过编码器，直接对 z 序列做梯度下降，让解码器均值贴近专家动作。如果优化后能跑好，说明解码器表达得了，问题在编码器。</p>' +
        '<p>图 5 的三例：跑步一次性就能做好，优化前后几乎不变；倒着走和跳在一次性模仿时失败，优化后明显改善但仍不完美。作者的解释是错主要在编码器，但解码器对这些少见动作也可能训练不足。</p>' +
        guess('点云和两条 z 轨迹是我生成的，只示意“优化后的轨迹离开原来的位置”。43% 和 78% 是论文的数。') +
        src('§3.3 式 (10) · 图 5') },
    { n: 11, part: '§3.3 复用', title: '解码器当动作空间，训练高层策略', sub: '切换任务；右边是图 6a 的读数', dur: 16, cam: [0.2, 1.15, 30, [2.0, 3.8, 0]],
      html: dl([['高层策略', '每步输出 z_t，动作由 p(a_t | s_t, z_t) 给出'], ['算法', 'SVG(0)，Q 函数用 Retrace 做离策略修正'], ['任务', '追目标点（稀疏奖励）、看不见的颠簸地形、变化的目标速度、带视觉的跨沟'], ['图 6a', '追目标，10 个种子的中位回报；β = 0.001 最差'], ['图 6b', '目标速度，奖励是以目标为中心的高斯']]) +
        '<p>把潜空间当成新的连续动作空间，高层策略只决定“做哪种短期运动”。追目标任务里目标点在人形靠近几步后跳到附近别处，需要急转和变速。只给稀疏奖励，高层也能学会，而且动作像人。</p>' +
        '<p>正则强的模块接上未训练的高层时更不容易摔。图 6a 有四条线，β = 0.46 只在这张图出现，它的最终中位回报最高（182.5），然后是 β = 0.1（162.5）、1.0（152.2）、0.001（115.0）。所以“正则越强越好”只对比 0.001 成立，不是单调的。</p>' +
        '<p>图 6b 的阴影宽度对所有目标都是 ±0.707，说明奖励的高斯标准差约 0.707（如果阴影就是这个标准差）；横轴 5000 步是三个回合拼起来的。</p>' +
        guess('小人、目标点、沟和速度表是手写的示意；右边曲线是图 6a 按 0.15×10⁹ 步重采样的读数。') +
        src('§3.3 · 图 6（矢量读数，见精读页读者注 13、14）') }
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
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: o.size || 24, pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65, emissive: o.emissive }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c || hex3(m.material.color.getHex()); m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  const tint = (m, h) => { m.material.color.setHex(h); m.userData.c = hex3(h); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.14) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.5, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  /* a thick polyline as a flat ribbon facing +z, so that curves stay readable (GL lines are one pixel wide) */
  function ribbon(G, n, color, w = 0.06, o = {}) {
    const pos = new Float32Array(n * 6), idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: o.opacity ?? 1 })); m.frustumCulled = false; m.renderOrder = o.order ?? 2; G.add(m);
    m.userData.set = pts => { const k = Math.min(n, pts.length); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)], z = q[2] ?? 0; pos[i * 6] = q[0]; pos[i * 6 + 1] = q[1] - w / 2; pos[i * 6 + 2] = z; pos[i * 6 + 3] = q[0]; pos[i * 6 + 4] = q[1] + w / 2; pos[i * 6 + 5] = z; } g.attributes.position.needsUpdate = true; };
    return m;
  }
  function panel(G, x, y, z, w, h) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x0c1220, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }
  /* a growing bar on the floor; set(v) sets its height */
  function bar(G, x, z, w, color, o = {}) { const m = block(w, 1, o.d ?? w, color, [x, 0.5, z], { edges: false }); G.add(m); m.userData.set = h => { const v = Math.max(0.001, h); m.scale.y = v; m.position.y = (o.y0 ?? 0) + v / 2; }; return m; }

  /* ---------- the hand-made humanoid: copied from interactives/supermimic/sm.js ---------- */
  function robot(color, o = {}) {
    const m = L.mat(color, { opacity: o.opacity, roughness: 0.5, depthWrite: o.opacity == null || o.opacity > 0.6 });
    const G = new THREE.Group(), mesh = g => new THREE.Mesh(g, m);
    const limb = (len, r) => { const g = new THREE.Group(), c = mesh(new THREE.CylinderGeometry(r, r * 0.82, len, 8)); c.position.y = -len / 2; g.add(c); const j = mesh(new THREE.SphereGeometry(r, 8, 6)); g.add(j); return g; };
    const pelvis = new THREE.Group(); G.add(pelvis);
    const hip = mesh(new THREE.BoxGeometry(0.26, 0.1, 0.14)); pelvis.add(hip);
    const tor = mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.36, 10)); tor.position.y = 0.2; pelvis.add(tor);
    const head = mesh(new THREE.SphereGeometry(0.085, 12, 9)); head.position.y = 0.48; pelvis.add(head);
    const legs = [-1, 1].map(s => { const th = limb(0.3, 0.05); th.position.set(s * 0.09, -0.04, 0); const sh = limb(0.3, 0.042); sh.position.y = -0.3; th.add(sh); const ft = mesh(new THREE.BoxGeometry(0.08, 0.035, 0.18)); ft.position.set(0, -0.31, 0.04); sh.add(ft); pelvis.add(th); return { th, sh }; });
    const arms = [-1, 1].map(s => { const up = limb(0.2, 0.034); up.position.set(s * 0.18, 0.34, 0); const lo = limb(0.2, 0.028); lo.position.y = -0.2; up.add(lo); pelvis.add(up); return { up, lo, s }; });
    G.userData.set = q => {
      G.position.set(...q.p); pelvis.rotation.set(q.pitch || 0, q.yaw || 0, q.roll || 0, 'YXZ');
      legs[0].th.rotation.x = -q.hL; legs[1].th.rotation.x = -q.hR; legs[0].sh.rotation.x = q.kL; legs[1].sh.rotation.x = q.kR;
      arms[0].up.rotation.x = -q.sL; arms[1].up.rotation.x = -q.sR; arms[0].lo.rotation.x = -q.eL; arms[1].lo.rotation.x = -q.eR;
      arms.forEach((a, i) => { a.up.rotation.z = a.s * (q.spread || 0.12); });
    };
    return G;
  }
  const STAND = 0.65;
  /* poses are written by hand; t in seconds. Facing +z unless yaw is set. */
  function clip(name, t) {
    const pi = Math.PI;
    if (name === 'walk') {
      const ph = 2 * pi * t / 0.9, s = Math.sin(ph);
      return { p: [0, STAND - 0.015 + 0.015 * Math.cos(2 * ph), 0], pitch: 0.04, hL: 0.48 * s, hR: -0.48 * s, kL: 0.2 + 0.55 * Math.max(0, -Math.cos(ph + 0.6)), kR: 0.2 + 0.55 * Math.max(0, Math.cos(ph + 0.6)), sL: -0.4 * s, sR: 0.4 * s, eL: 0.45, eR: 0.45 };
    }
    if (name === 'skip') {
      const u = (t % 0.9) / 0.9, air = Math.sin(pi * u), s = Math.sin(2 * pi * t / 1.8);
      return { p: [0, STAND + 0.26 * air, 0], pitch: 0.05, hL: 0.15 + 0.75 * Math.max(0, s), hR: 0.15 + 0.75 * Math.max(0, -s), kL: 0.2 + 1.1 * Math.max(0, s), kR: 0.2 + 1.1 * Math.max(0, -s), sL: -0.9 * s, sR: 0.9 * s, eL: 0.7, eR: 0.7 };
    }
    if (name === 'roll') {
      const u = (t % 2.2) / 2.2, a = seg(u, 0.14, 0.82), d = Math.sin(pi * clamp(u / 0.96, 0, 1));
      return { p: [L.lerp(-0.45, 0.45, a), STAND - 0.46 * Math.min(1, d * 1.6), 0], roll: 2 * pi * a, pitch: 0.2 * d, hL: 0.9 * d, hR: 0.9 * d, kL: 1.5 * d, kR: 1.5 * d, sL: 1.1 * d, sR: 1.1 * d, eL: 1.0 * d, eR: 1.0 * d };
    }
    if (name === 'flip' || name === 'flip90') {
      const T = 1.9, u = (t % T) / T, cr = seg(u, 0, 0.22) * (1 - seg(u, 0.22, 0.3)), s = clamp((u - 0.28) / 0.42, 0, 1), land = seg(u, 0.7, 0.78) * (1 - seg(u, 0.8, 1));
      const air = u > 0.28 && u < 0.7, tuck = air ? Math.sin(pi * s) : 0, tot = name === 'flip' ? -2 * pi : -pi / 2;
      const pitch = tot * L.ease(s) * (name === 'flip' ? 1 : (1 - seg(u, 0.7, 0.95)));
      return { p: [0, STAND - 0.2 * cr - 0.2 * land + 0.95 * (air ? 4 * s * (1 - s) : 0), 0], pitch, hL: 0.8 * cr + 1.5 * tuck + 0.7 * land, hR: 0.8 * cr + 1.5 * tuck + 0.7 * land, kL: 1.3 * cr + 2.0 * tuck + 1.2 * land, kR: 1.3 * cr + 2.0 * tuck + 1.2 * land, sL: -0.8 * cr + 2.2 * (air ? 1 - tuck : 0) * 0.6 + 0.7 * tuck, sR: -0.8 * cr + 2.2 * (air ? 1 - tuck : 0) * 0.6 + 0.7 * tuck, eL: 0.8 * tuck + 0.3, eR: 0.8 * tuck + 0.3 };
    }
    return clip('walk', t);
  }
  /* a pose with a prediction error of size e added, always in the same direction so the eye can follow it */
  function drift(q, e) {
    const o = { ...q, p: [q.p[0] + e * 0.5, q.p[1] - Math.abs(e) * 0.5, q.p[2] + e * 1.0] };
    o.pitch = (q.pitch || 0) + e * 1.6; o.roll = (q.roll || 0) + e * 0.7; o.hL = q.hL + e * 1.4; o.hR = q.hR - e * 1.2; o.sL = q.sL + e * 2; o.sR = q.sR - e * 2;
    return o;
  }
  function pose(r, q, at, sc, yaw) { const c = { ...q, yaw: yaw ?? q.yaw, p: [0, 0, 0] }; r.userData.set(c); r.position.set(at[0] + q.p[0] * sc, at[1] + q.p[1] * sc, at[2] + q.p[2] * sc); r.scale.setScalar(sc); }

  /* a lying-down pose: pelvis horizontal, on the back. k = 0 lying, k = 1 standing */
  function getup(k, t) {
    const lie = 1 - k, b = seg(k, 0.15, 0.7), bend = Math.sin(Math.PI * clamp(k, 0, 1));
    return { p: [0, L.lerp(0.09, STAND, b), 0], pitch: -1.5 * (1 - seg(k, 0.1, 0.8)), hL: 1.2 * bend, hR: 0.6 * bend, kL: 0.1 * lie + 1.6 * bend, kR: 0.1 * lie + 1.2 * bend, sL: 0.8 * bend, sR: 0.4 * bend, eL: 0.3 + 0.4 * bend, eR: 0.3 + 0.4 * bend };
  }
  const still = () => ({ p: [0, STAND, 0], pitch: 0, hL: 0.02, hR: 0.02, kL: 0.04, kR: 0.04, sL: 0, sR: 0, eL: 0.15, eR: 0.15 });
  const qmix = (a, b, k) => { const o = {}; for (const f of ['pitch', 'hL', 'hR', 'kL', 'kR', 'sL', 'sR', 'eL', 'eR']) o[f] = L.lerp(a[f] || 0, b[f] || 0, k); o.p = [0, L.lerp(a.p[1], b.p[1], k), 0]; return o; };

  /* controls: api.ctls = [{label, items, get, set}], plus optional api.ctlExtra(box) */
  function buildCtl() {
    const box = $('ctl'); box.innerHTML = ''; box.hidden = true; if (!api) return;
    (api.ctls || []).forEach((c, gi) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-g="${gi}" data-k="${k}" aria-pressed="${c.get() === k}">${t}</button>`).join('');
      box.appendChild(row); box.hidden = false;
    });
    if (api.ctlExtra) { api.ctlExtra(box); box.hidden = false; }
  }
  function syncCtl() { (api?.ctls || []).forEach((c, gi) => { $('ctl').querySelectorAll(`button[data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(c.get() === +b.dataset.k))); }); }


  const rng = L.rng;
  /* a few extra helpers on top of the PHC ones */
  function dots(G, n, color, r = 0.06) { const im = inst(BALL, n); im.material.color.setHex(color); G.add(im); return im; }
  function ring(G, color, opacity = 0.9) { const m = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity })); G.add(m); return m; }
  function dropLab(G, s) { if (s) { G.remove(s); L.dispose(s); LABS = LABS.filter(x => x !== s); } }
  /* a label whose text can change; re-created only when the text changes */
  function liveLab(G, pos, o = {}) { const st = { s: null, t: null }; return t => { if (t === st.t) return; dropLab(G, st.s); st.t = t; st.s = lab(t, pos, o); G.add(st.s); }; }
  /* stacked slabs standing for an MLP; widths list sets the slab sizes */
  function mlpStack(G, x, y, z, widths, color, o = {}) {
    const g = new THREE.Group(); const k = o.k ?? 1 / 1400, gap = o.gap ?? 0.42; const ms = [];
    widths.forEach((w, i) => { const h = 0.5 + w * k * (o.hk ?? 1.4); const m = block(0.24, h, o.d ?? 1.0, color, [x + i * gap, y, z]); g.add(m); ms.push(m); });
    G.add(g); g.userData.ms = ms; return g;
  }


  /* a small 2-D plot frame in the x-y plane: returns a mapper from data to world */
  function frame(G, x0, y0, w, h, xr, yr, o = {}) {
    const m = (x, y) => [x0 + (x - xr[0]) / (xr[1] - xr[0]) * w, y0 + (y - yr[0]) / (yr[1] - yr[0]) * h, o.z ?? 0];
    panel(G, x0 - 0.4, y0 - 0.4, (o.z ?? 0) - 0.05, w + 0.8, h + 0.8);
    wire(G, [[x0, y0, o.z ?? 0], [x0 + w, y0, o.z ?? 0]], COL.noise, { opacity: 0.7 }); wire(G, [[x0, y0, o.z ?? 0], [x0, y0 + h, o.z ?? 0]], COL.noise, { opacity: 0.7 });
    (o.yt || []).forEach(v => { const p = m(xr[0], v); wire(G, [p, [x0 + w, p[1], p[2]]], COL.dim, { opacity: 0.45 }); G.add(lab(String(v), [x0 - 0.75, p[1], p[2]], { size: 15 })); });
    if (o.xl) G.add(lab(o.xl, [x0 + w / 2, y0 - 0.95, o.z ?? 0], { size: 16 }));
    if (o.yl) G.add(lab(o.yl, [x0 + 0.2, y0 + h + 0.7, o.z ?? 0], { size: 16 }));
    return m;
  }
  /* toy reference trajectory for scenes 3 and 4 */
  const sStar = t => 1.2 * Math.sin(2.1 * t) + 0.5 * Math.sin(5.3 * t + 0.4);
  const dsStar = t => 1.2 * 2.1 * Math.cos(2.1 * t) + 0.5 * 5.3 * Math.cos(5.3 * t + 0.4);

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    const st = [[-12.5, '1 · 2707 个专家', '#f2a0a0'], [0, '2 · 离线压缩', '#f2c14e'], [12.5, '3 · 复用解码器', '#b48cff']];
    st.forEach(([x, t, c]) => { G.add(block(10.8, 0.25, 6, COL.dim, [x, -0.15, 0], { opacity: 0.55 }), lab(t, [x, 9.2, 0], { size: 23, color: c })); });
    const ex = inst(BOX, 120); ex.material.color.setHex(COL.exp); G.add(ex);
    for (let i = 0; i < 120; i++) setI(ex, i, [-16.4 + (i % 12) * 0.62, 1.4 + Math.floor(i / 12) * 0.5, -1.6], [0.48, 0.38, 0.48]); done(ex);
    const mocap = block(2.4, 1.0, 1.4, COL.data, [-12.5, 0.6, 2.0]); G.add(mocap, lab('CMU 动捕 → 约 3000 段', [-12.5, 1.6, 2.6], { size: 16 }), lab('每段一个专家（SVG(0)＋Retrace）', [-12.5, 7.0, -1.6], { size: 17 }));
    const enc = block(1.8, 2.2, 1.4, COL.enc, [-3.0, 3.6, 0]), zb = L.sphere(0.5, COL.z, { emissive: 0x332200 }), dec = block(1.8, 2.6, 1.4, COL.dec, [3.0, 3.6, 0]);
    zb.position.set(0, 3.6, 0); G.add(enc, zb, dec);
    G.add(lab('编码器 q', [-3.0, 5.3, 0], { size: 19 }), lab('z ∈ ℝ⁶⁰', [0, 4.6, 0], { size: 18 }), lab('解码器 π', [3.0, 5.5, 0], { size: 19 }), lab('未来 6 帧 x_t', [-5.6, 2.0, 0], { size: 16 }), lab('当前 s_t', [3.0, 1.4, 0.9], { size: 16 }), lab('专家动作（监督）', [0, 7.4, 0], { size: 17 }));
    const hl = block(1.8, 2.2, 1.4, COL.hl, [9.4, 3.6, 0]), dec2 = block(1.8, 2.6, 1.4, COL.frozen, [13.2, 3.6, 0]), z2 = L.sphere(0.42, COL.z, { emissive: 0x332200 }); z2.position.set(11.3, 3.6, 0);
    G.add(hl, dec2, z2, lab('高层策略', [9.4, 5.3, 0], { size: 19 }), lab('解码器（复用）', [13.2, 5.5, 0], { size: 17 }), lab('SVG(0)＋Retrace，任务奖励', [11.3, 1.0, 2.0], { size: 16 }));
    const flag = L.cyl(0.05, 0.05, 1.6, COL.gold); G.add(flag); const ball = L.sphere(0.25, COL.gold); G.add(ball);
    const rob = robot(COL.robot), rob2 = robot(COL.dec); G.add(rob, rob2);
    [[mocap, 1], [enc, 4], [zb, 5], [dec, 4], [hl, 10], [dec2, 10]].forEach(([m, g]) => { m.userData.go = g; PICKS.push(m); }); ex.userData.go = 1; PICKS.push(ex);
    const f = { a: stream(G, 5, COL.exp), b: stream(G, 5, COL.data), c: stream(G, 5, COL.enc), d: stream(G, 5, COL.dec), e: stream(G, 6, COL.hl) };
    return { update(p) {
      const q = (p * 20) % 1, a = seg(p, 0, 0.08) * (1 - seg(p, 0.33, 0.38)), b = seg(p, 0.33, 0.4) * (1 - seg(p, 0.66, 0.71)), c = seg(p, 0.66, 0.73);
      f.a([[-12.5, 1.1, 2.0], [-12.5, 2.6, -1.6]], q, a);
      f.b([[-9.6, 3.0, -1.6], [-6.5, 3.6, 0], [-3.0, 3.6, 0]], q, b); f.c([[-3.0, 3.6, 0], [0, 3.6, 0]], q, b); f.d([[0, 3.6, 0], [3.0, 3.6, 0], [5.0, 3.6, 0]], q, b);
      f.e([[8.0, 3.6, 0], [9.4, 3.6, 0], [11.3, 3.6, 0], [13.2, 3.6, 0], [15.0, 3.6, 0]], q, c);
      glow(enc, 0.5 * b); glow(dec, 0.5 * b); glow(hl, 0.5 * c); glow(mocap, 0.5 * a);
      pose(rob, clip(p < 0.33 ? 'flip' : 'walk', p * 14), [-8.0, 0, 2.0], 2.3, Math.PI / 2); rob.visible = p < 0.66;
      const tgx = 15.6 + 1.2 * Math.sin(p * 9), tgz = 2.0 + 1.2 * Math.cos(p * 7); flag.position.set(tgx, 0.8, tgz); ball.position.set(tgx, 1.7, tgz); flag.visible = ball.visible = rob2.visible = p >= 0.66;
      pose(rob2, clip('walk', p * 14), [15.6, 0, 3.4], 2.2, Math.PI);
      cap(p < 0.33 ? '第 1 段：每个动捕片段单独训一个<b>时间下标的专家</b>，共 2707 个' : p < 0.66 ? '第 2 段：离线监督学习，编码器看<b>未来 6 帧</b>给 z，解码器只看 s_t 和 z 出专家的动作' : '第 3 段：解码器拿出来复用，<b>高层策略输出 z</b>，用任务奖励训练');
    } };
  }

  /* ---------- scene 2: experts from mocap ---------- */
  function s2(G) {
    G.add(L.grid(30, 30));
    const r = rng(7), clips = []; let x = -13;
    for (let i = 0; i < 14; i++) { const len = 2 + 4 * r(); clips.push(len); }
    const bars = clips.map((len, i) => { const m = block(len * 0.5, 0.32, 0.5, COL.data, [-11 + len * 0.25, 0.4 + i * 0.45, -3], { edges: false }); G.add(m); return m; });
    G.add(lab('片段 2 到 6 秒（长的切开）', [-9.4, 7.3, -3], { size: 17 }));
    const N = 280, ex = inst(BOX, N); ex.material.color.setHex(COL.exp); G.add(ex);
    const mir = inst(BOX, N); mir.material.color.setHex(COL.frozen); G.add(mir);
    let m = +(OPT[0] ?? 0);
    const cnt = liveLab(G, [3.8, 7.9, -2], { size: 20 });
    G.add(lab('SVG(0)＋Retrace · SAMCON 能量奖励 · RSI · 摔倒终止', [3.8, 7.0, -2], { size: 16 }));
    const rob = robot(COL.robot); G.add(rob); const ghost = robot(COL.noise, { opacity: 0.35 }); G.add(ghost);
    G.add(lab('参考（动捕）', [-6.0, 3.2, 3.0], { size: 15 }), lab('专家（仿真）', [-2.6, 3.2, 3.0], { size: 15 }));
    return { ctls: [{ label: '镜像', items: ['关', '开'], get: () => m, set: k => { m = k; } }], update(p) {
      const k = Math.floor(seg(p, 0.05, 0.75) * N);
      for (let i = 0; i < N; i++) { const on = i < k ? 1 : 0.0001; setI(ex, i, [-0.5 + (i % 20) * 0.42, 0.25 + Math.floor(i / 20) * 0.42, -2], 0.32 * on); setI(mir, i, [-0.5 + (i % 20) * 0.42, 0.25 + Math.floor(i / 20) * 0.42, -1.4], 0.32 * (m && i < k ? 1 : 0.0001)); }
      done(ex); done(mir);
      bars.forEach((b, i) => glow(b, i === Math.floor(p * 14) % 14 ? 0.8 : 0));
      const n = Math.round(seg(p, 0.05, 0.75) * 2707); cnt(m ? `专家 ${n}　镜像后约 ${2 * n}` : `专家 ${n} / 2707`);
      const nm = ['walk', 'flip', 'roll', 'skip'][Math.floor(p * 4) % 4], t = p * 16;
      pose(ghost, clip(nm, t), [-6.0, 0, 1.5], 2.3, Math.PI / 2); pose(rob, clip(nm, t - 0.08), [-2.6, 0, 1.5], 2.3, Math.PI / 2);
      cap(`一个片段 → 一个专家。专家只会这一段，<b>对中等动作噪声稳健</b>；部署时用它的均值动作${m ? '。镜像：左右对称再得一份' : ''}`);
    } };
  }

  /* ---------- toy rollouts shared by scenes 3 and 4 ---------- */
  function rollout(eta, seed, T = 60, dt = 0.05) {
    const r = rng(seed); let s = sStar(0) + 0.05 * L.gauss(r); const out = [];
    for (let i = 0; i < T; i++) { const t = i * dt, aS = dsStar(t), mu = aS - 3 * (s - sStar(t)); out.push([t, s, mu]); s += dt * (mu + eta * 25 * L.gauss(r)); }
    return out;
  }

  /* ---------- scene 3: BC from noisy rollouts ---------- */
  function s3(G) {
    let nr = +(OPT[0] ?? 1), ne = +(OPT[1] ?? 1); const NR = [1, 10, 100], NE = [0.05, 0.1];
    const mp = frame(G, -9, 1, 18, 6, [0, 3], [-2.6, 2.6], { yt: [-2, 0, 2], xl: '时间', yl: '状态 s' });
    const nom = ribbon(G, 61, COL.nom, 0.08); nom.userData.set(Array.from({ length: 61 }, (_, i) => mp(i * 0.05, sStar(i * 0.05)).map((v, j) => j === 2 ? 0.05 : v)));
    const lines = Array.from({ length: 100 }, () => ribbon(G, 60, COL.noise, 0.03, { opacity: 0.45 }));
    const pts = inst(BALL, 600); pts.material.color.setHex(COL.fb); G.add(pts);
    const info = liveLab(G, [0, 8.6, 0], { size: 19 });
    G.add(lab('名义轨迹', [9.8, mp(3, sStar(3))[1], 0], { size: 15 }));
    return { ctls: [{ label: '回放条数', items: NR.map(String), get: () => nr, set: k => { nr = k; } }, { label: '噪声 η', items: NE.map(String), get: () => ne, set: k => { ne = k; } }], update(p) {
      const n = NR[nr], eta = NE[ne], show = Math.max(1, Math.round(seg(p, 0, 0.7) * n));
      let k = 0; const spread = [];
      for (let j = 0; j < 100; j++) {
        const on = j < show; lines[j].visible = on; if (!on) continue;
        const ro = rollout(eta, 100 + j); lines[j].userData.set(ro.map(([t, s]) => mp(t, s)));
        ro.forEach(([t, s], i) => { spread.push(s - sStar(t)); if (i % 10 === 5 && k < 600) { setI(pts, k++, mp(t, s), 0.07); } });
      }
      for (; k < 600; k++) setI(pts, k, [0, -50, 0], 0.0001); done(pts);
      const sd = Math.sqrt(spread.reduce((a, b) => a + b * b, 0) / spread.length);
      info(`${show} 条 × 60 步 = ${show * 60} 个 (s, μ_E(s)) 对　偏离名义的均方根 ${sd.toFixed(3)}`);
      cap('执行<b>带噪声</b>的动作，记录专家<b>不带噪声</b>的均值动作。噪声越大、条数越多，学生见过的状态管子越粗');
    } };
  }

  /* ---------- scene 4: LFPC ---------- */
  function s4(G) {
    let mode = +(OPT[0] ?? 0);
    const mp = frame(G, -11.5, 1, 12, 6, [0, 3], [-2.6, 2.6], { yt: [-2, 0, 2], xl: '时间', yl: '状态 s' });
    const nom = ribbon(G, 61, COL.nom, 0.08); nom.userData.set(Array.from({ length: 61 }, (_, i) => mp(i * 0.05, sStar(i * 0.05)).map((v, j) => j === 2 ? 0.05 : v)));
    const tk = [0.4, 0.9, 1.4, 1.9, 2.4], NP = 5, r = rng(3), DS = tk.map(() => Array.from({ length: NP }, () => 0.9 * L.gauss(r)));
    const pts = inst(BALL, tk.length * NP); pts.material.color.setHex(COL.fb); G.add(pts);
    const arrows = tk.map(() => Array.from({ length: NP }, () => { const a = block(0.07, 1, 0.07, COL.fb, [0, 0, 0], { edges: false }); G.add(a); return a; }));
    const ms = frame(G, 3.2, 1, 6.5, 6, [-1.5, 1.5], [0, 2.5], { yt: [0, 1, 2], xl: 'δs', yl: '|μ_E − μ_FB|' });
    const curve = ribbon(G, 61, COL.s2, 0.06); curve.userData.set(Array.from({ length: 61 }, (_, i) => { const d = -1.5 + i * 0.05; return mp2(d); }));
    function mp2(d) { const muE = -1.5 * Math.tanh(2 * d), fb = -3 * d; return ms(d, Math.min(2.5, Math.abs(muE - fb))); }
    const mk = L.sphere(0.13, COL.gold); G.add(mk);
    const info = liveLab(G, [-4.5, 8.6, 0], { size: 18 }), info2 = liveLab(G, [6.5, 8.6, 0], { size: 17 });
    return { ctls: [{ label: '目标动作', items: ['LFPC：a* + J δs', '式 (11)：a*（反馈为 0）'], get: () => mode, set: k => { mode = k; } }], update(p) {
      let k = 0; const show = Math.floor(seg(p, 0, 0.6) * tk.length * NP);
      tk.forEach((t, a) => DS[a].forEach((d, b) => {
        const on = k < show, s = sStar(t) + d * 0.9, target = mode ? 0 : -3 * d * 0.9;
        setI(pts, k, on ? mp(t, s) : [0, -50, 0], on ? 0.1 : 0.0001);
        const A = arrows[a][b], p0 = mp(t, s), h = target * 0.35; A.visible = on && Math.abs(h) > 0.01; A.scale.y = Math.max(0.001, Math.abs(h)); A.position.set(p0[0], p0[1] + h / 2, 0.02);
        k++;
      }));
      done(pts);
      const d = 1.4 * Math.sin(p * Math.PI * 2), muE = -1.5 * Math.tanh(2 * d), fb = -3 * d; mk.position.set(...mp2(d));
      info(mode ? '式 (11)：扰动后仍要求原动作，学生学成<b>开环</b>' : `每个名义点撒 ${NP} 份扰动，目标 = a* + J δs（箭头）`);
      info2(`δs = ${d.toFixed(2)}　μ_E − a* = ${muE.toFixed(3)}　J δs = ${fb.toFixed(3)}`);
      cap(mode ? '附录 C：要求在扰动输入上输出原来的动作，相当于<b>把反馈增益设成 0</b>' : 'LFPC：只跑 1 条名义轨迹，记下 a* 和雅可比 J；训练时<b>扰动状态、用一阶展开当目标</b>。右图：离名义越远，一阶近似越差');
    } };
  }

  /* ---------- scene 5: architecture ---------- */
  function s5(G) {
    G.add(L.grid(30, 30));
    let off = +(OPT[0] ?? 0); const OFF = [[0, 1, 2, 3, 4, 5], [0, 1, 3, 6, 10, 15]];
    const tl = Array.from({ length: 16 }, (_, i) => { const m = block(0.36, 1.2, 0.9, COL.data, [-13 + i * 0.42, 1.0, 0], { opacity: 0.85 }); G.add(m); return m; });
    G.add(lab('参考轨迹 s_t … s_{t+15}', [-9.8, 2.4, 0], { size: 16 }));
    const enc = mlpStack(G, -5.2, 3.6, 0, [1024, 1024], COL.enc, { k: 1 / 600, d: 1.4, gap: 0.9 });
    G.add(lab('编码器 2 × 1024', [-4.75, 5.9, 0], { size: 18 }));
    const zc = inst(BOX, 60); zc.material.color.setHex(COL.z); G.add(zc);
    for (let i = 0; i < 60; i++) setI(zc, i, [-1.2 + (i % 6) * 0.3, 2.0 + Math.floor(i / 6) * 0.3, 0], 0.22); done(zc);
    G.add(lab('z_t（60 维，对角高斯）', [-0.45, 5.6, 0], { size: 17 }));
    const loop = L.torus(0.7, 0.06, COL.z); loop.position.set(-2.8, 1.2, 0); G.add(loop, lab('z_{t−1}', [-2.8, 0.2, 0], { size: 15 }));
    const dec = mlpStack(G, 2.6, 3.6, 0, [1024, 1024, 1024], COL.dec, { k: 1 / 600, d: 1.4, gap: 0.9 });
    G.add(lab('解码器 3 × 1024', [3.5, 5.9, 0], { size: 18 }));
    const sN = block(0.9, 0.9, 0.9, COL.data, [3.5, 0.8, 1.6]); G.add(sN, lab('s_t', [3.5, 0.0, 1.6], { size: 16 }));
    const act = block(0.5, 1.6, 1.0, COL.exp, [6.8, 3.6, 0]); G.add(act, lab('a_t ~ N(μ, 0.1²)', [7.2, 5.0, 0], { size: 17 }));
    const f = { a: stream(G, 5, COL.data, 0.12), b: stream(G, 4, COL.enc, 0.12), c: stream(G, 4, COL.dec, 0.12), d: stream(G, 3, COL.data, 0.1) };
    return { ctls: [{ label: 'x_t 的时刻', items: ['t … t+5', 't, t+1, t+3, t+6, t+10, t+15'], get: () => off, set: k => { off = k; } }], update(p) {
      tl.forEach((m, i) => { const on = OFF[off].includes(i); glow(m, on ? 0.8 : 0); m.material.opacity = on ? 1 : 0.25; });
      const q = (p * 12) % 1;
      f.a([[-10, 2.2, 0], [-6.5, 3.6, 0], [-5.2, 3.6, 0]], q, 1); f.b([[-4.3, 3.6, 0], [-1.2, 3.4, 0]], q, 1); f.c([[0.6, 3.4, 0], [2.6, 3.6, 0], [6.5, 3.6, 0]], q, 1); f.d([[3.5, 1.3, 1.6], [2.6, 3.6, 0]], q, 1);
      loop.rotation.z = p * 6;
      cap(`编码器看 z_{t−1} 和 6 个参考状态（${off ? '跨 15 步，脚注 2' : 'K = 5'}）；<b>解码器看不到未来</b>，只能从 z 里知道该做什么`);
    } };
  }

  /* ---------- scene 6: AR(1) prior ---------- */
  function s6(G) {
    let ai = +(OPT[0] ?? 0); const AL = [0.95, 0];
    const T = 200, r = rng(11), E = Array.from({ length: T }, () => [L.gauss(r), L.gauss(r)]);
    const mp = frame(G, -10.5, 1, 8, 6.6, [-3, 3], [-3, 3], { xl: 'z 第 1 维', yl: 'z 第 2 维' });
    const trail = inst(BALL, T); trail.material.color.setHex(COL.z); G.add(trail); const dot = L.sphere(0.18, COL.gold); G.add(dot);
    const ms = frame(G, 0.5, 1, 10, 6.6, [0, 31], [0, 1], { yt: [0, 0.5, 1], xl: '滞后 k（步）', yl: '自相关 α^k' });
    const bars = Array.from({ length: 31 }, (_, k) => { const b = block(0.26, 1, 0.3, COL.s1, [0, 0, 0], { edges: false }); G.add(b); return b; });
    const info = liveLab(G, [4.5, 8.9, 0], { size: 18 });
    return { ctls: [{ label: 'α', items: ['0.95（论文）', '0（消融）'], get: () => ai, set: k => { ai = k; } }], update(p) {
      const a = AL[ai], sg = Math.sqrt(1 - a * a), n = Math.max(2, Math.floor(seg(p, 0, 0.85) * T));
      const z = [[0, 0]]; for (let t = 1; t < T; t++) z.push([a * z[t - 1][0] + sg * E[t][0], a * z[t - 1][1] + sg * E[t][1]]);
      const sh = z.slice(0, n).map(v => mp(clamp(v[0], -3, 3), clamp(v[1], -3, 3)));
      for (let i = 0; i < T; i++) setI(trail, i, i < sh.length ? sh[i] : [0, -50, 0], i < sh.length ? 0.06 : 0.0001); done(trail); dot.position.set(...sh[sh.length - 1]);
      bars.forEach((b, k) => { const v = Math.pow(a, k) * (a === 0 && k === 0 ? 1 : 1), h = Math.max(0.001, (k === 0 ? 1 : v) * 6.6), pp = mp; const x = 0.5 + (k + 0.5) / 31 * 10; b.scale.y = h; b.position.set(x, 1 + h / 2, 0); });
      let num = 0, den = 0; for (let t = 1; t < T; t++) { num += z[t][0] * z[t - 1][0]; den += z[t - 1][0] * z[t - 1][0]; }
      info(`σ = √(1 − α²) = ${sg.toFixed(3)}　样本 lag-1 相关 ${(num / den).toFixed(2)}${a ? '　半衰 13.5 步' : ''}`);
      cap(a ? 'α = 0.95：每步只加一点新噪声，<b>z 慢慢漂</b>，边缘分布仍是 N(0, I)' : 'α = 0：每步独立抽，<b>相邻的 z 没有关系</b>。图 4 里这样做测试集变差');
    } };
  }

  /* ---------- scene 7: ELBO and beta ---------- */
  function s7(G) {
    let bi = +(OPT[0] ?? 2); const B = [0, 0.001, 0.1, 1.0], TEST = [0.498, 0.538, 0.707, 0.453];
    const terms = [['log π', COL.dec, -10], ['β log p_z', COL.z, -6.5], ['−β log q', COL.enc, -3]];
    const tb = terms.map(([t, c, x]) => { const b = bar(G, x, 0, 1.6, c); G.add(lab(t, [x, -0.6, 1.4], { size: 15 })); return b; });
    const gx = frame(G, -11, 4.8, 9, 2.6, [-0.4, 0.4], [0, 1], { xl: '动作误差 a − μ' });
    const gauss = ribbon(G, 81, COL.dec, 0.06), g0 = ribbon(G, 81, COL.noise, 0.04, { opacity: 0.6 });
    const ms = frame(G, 2.5, 1, 9, 6, [0, 4], [0, 1], { yt: [0, 0.5, 1], yl: '图 4 测试集无噪声中位数' });
    const bars = B.map((b, i) => { const m = block(1.3, 1, 0.6, COL.s1, [0, 0, 0], { edges: false }); G.add(m, lab('β=' + b, [2.5 + (i + 0.5) * 2.25, 0.4, 0.4], { size: 15 })); return m; });
    const info = liveLab(G, [-6.5, 8.4, 0], { size: 17 });
    return { ctls: [{ label: 'β', items: B.map(String), get: () => bi, set: k => { bi = k; } }], update(p) {
      const b = B[bi], se = 0.1 * Math.sqrt(b), w = seg(p, 0, 0.4);
      tb[0].userData.set(3.2 * w); tb[1].userData.set(Math.max(0.001, 2.4 * Math.sqrt(b) * w)); tb[2].userData.set(Math.max(0.001, 2.0 * Math.sqrt(b) * w));
      const curve = s => Array.from({ length: 81 }, (_, i) => { const x = -0.4 + i * 0.01; return gx(x, Math.exp(-x * x / (2 * s * s))); });
      g0.userData.set(curve(0.1)); gauss.userData.set(b ? curve(Math.max(se, 0.004)) : curve(0.004));
      bars.forEach((m, i) => { const h = Math.max(0.001, TEST[i] * 6 * seg(p, 0.3, 0.7)); m.scale.y = h; m.position.set(2.5 + (i + 0.5) * 2.25, 1 + h / 2, 0); glow(m, i === bi ? 0.8 : 0); });
      info(b ? `等效动作标准差 σ√β = 0.1 × √${b} = ${se.toFixed(4)}` : 'β = 0：没有先验约束，z 可以携带任意多的未来信息');
      cap('左：三项的示意高度（不是论文的数值）。中：灰线是 σ = 0.1 的高斯，蓝线是<b>除以 β 后的等效高斯</b>。右：图 4 的读数');
    } };
  }

  /* ---------- scene 8: figure 3 ---------- */
  function s8(G) {
    let ci = +(OPT[0] ?? 0);
    const sub = new THREE.Group(); G.add(sub); let built = -1, parts = [];
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); built = ci; parts = [];
      const [key, name, top] = F3K[ci], d = F3[key];
      const mp = frame(sub, -11, 1, 22, 6.5, [0, 8], [0, top], { yt: [0, top / 2, top], yl: name + ' · 回合回报' });
      d.forEach((row, i) => {
        const x = mp(i + 0.5, 0)[0];
        const b = block(1.0, 1, 0.5, i === 3 ? COL.s3 : i === 0 ? COL.exp : COL.s1, [x, 0, 0], { edges: false }); sub.add(b);
        const r1 = block(0.14, 1, 0.14, COL.s4, [x + 0.75, 0, 0.3], { edges: false }), r2 = block(0.14, 1, 0.14, COL.s2, [x + 1.0, 0, 0.3], { edges: false }); sub.add(r1, r2);
        sub.add(lab(F3M[i], [x + 0.3, 0.3, 0.6], { size: 14 }));
        parts.push({ b, r1, r2, row, mp });
      });
      sub.add(lab('柱：无噪声　橙竖条：噪声 0.05 的范围　红竖条：噪声 0.1 的范围', [0, 8.9, 0], { size: 15 }));
    }
    return { ctls: [{ label: '片段', items: F3K.map(k => k[1]), get: () => ci, set: k => { ci = k; } }], update(p) {
      if (built !== ci) rebuild();
      const g = seg(p, 0, 0.5), g2 = seg(p, 0.4, 0.8);
      parts.forEach(({ b, r1, r2, row, mp }) => {
        const y0 = mp(0, 0)[1], hn = Math.max(0.001, (mp(0, row[0])[1] - y0) * g); b.scale.y = hn; b.position.y = y0 + hn / 2;
        [[r1, row[1]], [r2, row[2]]].forEach(([r, [lo, hi]]) => { const a = mp(0, lo)[1], c = mp(0, hi)[1], h = Math.max(0.001, (c - a) * g2); r.scale.y = h; r.position.y = a + h / 2; r.visible = g2 > 0.01; });
      });
      const d = F3[F3K[ci][0]];
      cap(`${F3K[ci][1]}：专家 ${d[0][0]}，LFPC（1 条）${d[3][0]}，BC 100 条 ${d[4][0]}，BC 1000 条 ${d[7][0]}（无噪声）。开环一加噪声就掉到 ${d[1][1][0]} 到 ${d[1][1][1]}`);
    } };
  }

  /* ---------- scene 9: figure 4 ---------- */
  function s9(G) {
    let si = +(OPT[0] ?? 1); const SET = ['train', 'test'], NZ = ['无噪声', '0.05', '0.1'], NC = [COL.s1, COL.s4, COL.s2];
    const mp = frame(G, -12, 1, 24, 6.6, [0, 7], [0, 1], { yt: [0, 0.5, 1], yl: '相对专家（中位数，白线为四分位距）' });
    const parts = [];
    F4V.forEach((v, i) => {
      G.add(lab(v, [mp(i + 0.5, 0)[0], 0.35, 0.6], { size: 15 }));
      for (let j = 0; j < 3; j++) { const x = mp(i + 0.25 + j * 0.25, 0)[0]; const b = block(0.7, 1, 0.5, NC[j], [x, 0, 0], { edges: false }), q = block(0.1, 1, 0.1, COL.white, [x, 0, 0.32], { edges: false }); G.add(b, q); parts.push({ b, q, i, j }); }
    });
    wire(G, [mp(0, 1), mp(7, 1)], COL.white, { dashed: true, opacity: 0.6 }); G.add(lab('专家 = 1', [mp(7, 1)[0] + 1.0, mp(7, 1)[1], 0], { size: 14 }));
    G.add(lab('蓝：无噪声　黄：0.05　橙：0.1（噪声值按 §3.1 推断）', [0, 8.9, 0], { size: 15 }));
    return { ctls: [{ label: '数据', items: ['训练集', '测试集'], get: () => si, set: k => { si = k; } }], update(p) {
      const d = F4[SET[si]], g = seg(p, 0, 0.5), g2 = seg(p, 0.45, 0.8), y0 = mp(0, 0)[1];
      parts.forEach(({ b, q, i, j }) => { const [m, lo, hi] = d[i][j]; const h = Math.max(0.001, (mp(0, m)[1] - y0) * g); b.scale.y = h; b.position.y = y0 + h / 2; const a = mp(0, lo)[1], c = mp(0, hi)[1], hq = Math.max(0.001, (c - a) * g2); q.scale.y = hq; q.position.y = a + hq / 2; q.visible = g2 > 0.01; });
      cap(si ? '测试集（没见过的片段）：最好 β = 0.1 的 0.707；<b>LFPC 0.567 排第二</b>；α = 0 是 0.480' : '训练集：最好 β = 0.1 的 0.739；LFPC 0.543；20 维潜空间 0.649；不加正则 β = 0 是 0.544');
    } };
  }

  /* ---------- scene 10: one-shot imitation and latent optimization ---------- */
  function s10(G) {
    const r = rng(21), N = 700, cl = inst(BALL, N); cl.material.color.setHex(COL.s1); cl.material.opacity = 0.5; cl.material.transparent = true; G.add(cl);
    for (let i = 0; i < N; i++) setI(cl, i, [-6 + 2.6 * L.gauss(r), 4 + 1.1 * L.gauss(r), 1.4 * L.gauss(r)], 0.06); done(cl);
    const T = 40, orig = [], opt = [];
    for (let t = 0; t < T; t++) { const u = t / (T - 1) * Math.PI * 2; orig.push([-6 + 1.2 * Math.cos(u) - 0.8, 4 + 0.5 * Math.sin(2 * u), 0.6 * Math.sin(u)]); opt.push([-6 + 2.3 * Math.cos(u) + 0.6, 4 + 1.2 * Math.sin(2 * u) + 0.4, 1.1 * Math.sin(u)]); }
    const lo = L.tube(orig, COL.noise, 0.05), lp = L.tube(opt, COL.bad, 0.07); G.add(lo, lp); G.add(lab('一次性编码的 z', [-8.6, 2.0, 0], { size: 15 }), lab('按式 (10) 优化后的 z', [-3.2, 6.6, 0], { size: 15 }), lab('潜空间前 3 个主成分（示意）', [-6, 8.0, 0], { size: 17 }));
    const b1 = bar(G, 1.6, 0, 1.4, COL.noise), b2 = bar(G, 3.7, 0, 1.4, COL.bad); G.add(lab('优化前 43%', [1.6, -0.6, 1.2], { size: 15 }), lab('优化后 78%', [3.7, -0.6, 1.2], { size: 15 }), lab('相对专家表现的中位数', [2.7, 6.0, 0], { size: 15 }));
    const rob = robot(COL.robot), ghost = robot(COL.noise, { opacity: 0.3 }); G.add(rob, ghost);
    const mk = L.sphere(0.18, COL.gold); G.add(mk);
    return { update(p) {
      const k = seg(p, 0.35, 0.65); lp.visible = k > 0.01; lp.scale.setScalar(1); lp.material.opacity = k; lp.material.transparent = true;
      b1.userData.set(0.43 * 6 * seg(p, 0.1, 0.3)); b2.userData.set(0.78 * 6 * seg(p, 0.55, 0.8));
      const u = (p * 3) % 1, pt = (p < 0.5 ? orig : opt)[Math.floor(u * (T - 1))]; mk.position.set(...pt);
      const t = p * 14, q = clip('walk', t);
      pose(ghost, q, [7.4, 0, -0.6], 2.3, Math.PI); const bad = p < 0.5 ? drift(q, 0.25 * Math.sin(t)) : drift(q, 0.06 * Math.sin(t)); pose(rob, bad, [7.4, 0, 1.4], 2.3, Math.PI);
      cap(p < 0.5 ? '一次性模仿：编码器给出的 z 序列让解码器<b>跟不上</b>参考（倒着走、跳）' : '直接对 z 做梯度下降（式 10）：同一个解码器<b>能做得更好</b>，所以错主要在编码器');
    } };
  }

  /* ---------- scene 11: reuse ---------- */
  function s11(G) {
    G.add(L.grid(30, 30));
    let ti = +(OPT[0] ?? 0); const TK = ['追目标点', '目标速度', '跨沟（视觉）'];
    const hl = block(1.6, 1.8, 1.2, COL.hl, [-12.5, 3.4, 0]), zb = L.sphere(0.4, COL.z, { emissive: 0x332200 }), dec = block(1.6, 2.2, 1.2, COL.frozen, [-8.3, 3.4, 0]); zb.position.set(-10.4, 3.4, 0);
    G.add(hl, zb, dec, lab('高层策略', [-12.5, 4.9, 0], { size: 17 }), lab('z_t', [-10.4, 4.3, 0], { size: 16 }), lab('解码器', [-8.3, 5.1, 0], { size: 17 }), lab('SVG(0)＋Retrace', [-12.5, 1.6, 1.0], { size: 15 }));
    const f = stream(G, 6, COL.hl, 0.12);
    const rob = robot(COL.robot); G.add(rob);
    const flag = L.cyl(0.05, 0.05, 1.4, COL.gold), ball = L.sphere(0.22, COL.gold); G.add(flag, ball);
    const gaps = [0, 1, 2].map(i => { const m = block(1.2, 0.1, 4, 0x0b1020, [-3 + i * 3.2, 0.02, 0], { edges: false }); G.add(m); return m; });
    const sp = liveLab(G, [-3, 7.4, 0], { size: 18 });
    const mp = frame(G, 4.8, 1, 8.4, 6.6, [0, 6], [0, 200], { yt: [0, 100, 200], xl: '步数（×10⁹）', yl: '图 6a · 追目标 · 中位回报', z: -1 });
    const keys = [['0.001', COL.s2], ['0.1', COL.s4], ['0.46', COL.s3], ['1.0', COL.s1]];
    const curves = keys.map(([k, c]) => { const rb = ribbon(G, 41, c, 0.07); return [k, rb]; });
    const ys = { '0.46': 182.5, '0.1': 166, '1.0': 146, '0.001': 115 };
    const ends = keys.map(([k, c]) => { const l = lab('β=' + k + ' ' + F6[k][40], [mp(6, 0)[0] + 1.5, mp(6, ys[k])[1], -1], { size: 14 }); G.add(l); return l; });
    return { ctls: [{ label: '任务', items: TK, get: () => ti, set: k => { ti = k; } }], update(p) {
      f([[-14, 3.4, 0], [-12.5, 3.4, 0], [-10.4, 3.4, 0], [-8.3, 3.4, 0], [-6.5, 3.4, 0]], (p * 18) % 1, 1);
      const n = Math.max(2, Math.floor(seg(p, 0, 0.85) * 41));
      curves.forEach(([k, rb]) => rb.userData.set(F6[k].slice(0, n).map((v, i) => mp(i * 0.15, v))));
      ends.forEach(l => { l.visible = n >= 41; });
      gaps.forEach(g => { g.visible = ti === 2; }); flag.visible = ball.visible = ti === 0;
      const t = p * 16;
      if (ti === 0) {
        const tg = [[-1, 2.5], [1.5, -1.5], [-2.5, -1], [0.5, 2]][Math.floor(p * 4) % 4], u = (p * 4) % 1;
        const prev = [[0.5, 2], [-1, 2.5], [1.5, -1.5], [-2.5, -1]][Math.floor(p * 4) % 4], x = L.lerp(prev[0], tg[0], seg(u, 0, 0.7)), z = L.lerp(prev[1], tg[1], seg(u, 0, 0.7));
        flag.position.set(tg[0], 0.7, tg[1]); ball.position.set(tg[0], 1.5, tg[1]);
        pose(rob, u < 0.7 ? clip('walk', t) : still(), [x, 0, z], 2.0, Math.atan2(tg[0] - prev[0], tg[1] - prev[1])); sp('目标点被走近后跳到附近别处；只有稀疏奖励');
      } else if (ti === 1) {
        const si = Math.floor(p * 15) % 15, v = F6B[si];
        pose(rob, clip(v > 2.5 ? 'skip' : 'walk', t * (0.5 + v / 2)), [-2, 0, ((t * v * 0.3) % 6) - 3], 2.0, 0); sp(`目标速度 ${v.toFixed(2)}（图 6b 第 ${si + 1} 段）　奖励 ∝ exp(−(v − v*)² / 2σ²)，σ ≈ 0.707`);
      } else {
        const x = -6 + ((p * 10) % 1) * 10, jump = gaps.some(g => Math.abs(g.position.x - x) < 0.9);
        pose(rob, clip(jump ? 'skip' : 'walk', t), [x, 0, 0], 2.0, Math.PI / 2); sp('跨沟：高层用自我中心视觉输入（论文只有视频）');
      }
      cap('<b>z 就是新的动作空间</b>。β = 0.46 最终最高；β = 0.001 最低，接上未训练的高层时也更容易摔');
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
    const sc = SCENES[cur]; fly(...sc.cam); refDist = sc.cam[2] * aspectFix();
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
  window.__npmpDebug = { get cap() { return $('cap').textContent; } };
})();
