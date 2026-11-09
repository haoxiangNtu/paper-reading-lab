'use strict';
/* PULSE (arXiv 2310.04582, ICLR 2024) taken apart into eleven animated scenes. Network sizes and hyperparameters come from the
   paper and from the official code (github.com/ZhengyiLuo/PULSE, commit 1665985, read only). Each scene's update(p) is a pure
   function of the timeline p plus the current toggles. The humanoid is hand-made (same as interactives/phc). Scenes 4, 5, 6, 7
   and 9 compute their numbers live on toy problems; those are toys and are labelled so. No PULSE network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { prim: 0x38d1ff, frozen: 0x5f7fb0, comp: 0xf2a0a0, teach: 0xf2a0a0, enc: 0xf2c14e, dec: 0x3aa8e0, prior: 0x4fc98a, task: 0xb48cff, gate: 0xf0963c, fail: 0xb48cff, rew: 0xf2c14e, ok: 0x4fc98a, bad: 0xe05d5d, sim: 0x8e9bb8, data: 0x7cb8ff, ref: 0xe05d5d, robot: 0xc9d4ea, ppo: 0x9d8cff, gold: 0xf2c14e, dim: 0x46506a, white: 0xeef2fa };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  const SCENES = [
    { n: 1, part: '总览', title: '三段：老师、潜空间、下游', sub: '图 2 的 3D 版。点方块跳到对应那一幕', dur: 15, cam: [0.1, 1.1, 37, [1.2, 4.2, 0]],
      html: dl([['第 1 段', 'PHC+：PPO＋AMP 训练的动作模仿器，训完冻结'], ['第 2 段', '在线蒸馏：学生 E、D、R 自己跑，PHC+ 标注动作'], ['第 3 段', '冻结 D 和 R，下游策略输出 32 维潜码，用 PPO 训练'], ['潜码', 'z ∈ ℝ³²，每帧一个，30 Hz'], ['动作', 'PD 目标，69 维']]) +
        '<p>PULSE 不是从头学一个技能空间，而是先有一个能模仿 AMASS 全部动作的老师，再把老师的本事压进一个 32 维的变分瓶颈。瓶颈右边的解码器 D 和左边的先验 R 训完就冻结，下游任务只学“该往潜空间哪里走”。</p>' +
        '<p>和 PHC 的关系：第 1 段就是 PHC 换了数据、训练日程和网络尺寸（PHC+，第 2、3 幕）。第 2 段是本文的核心（第 4 到 7 幕）。第 3 段把 D 当成新的“动力学系统”，动作空间从 69 维 PD 目标换成 32 维潜码（第 8 到 10 幕）。</p>' +
        src('§4 · 图 2 · 算法 1') },
    { n: 2, part: '§4.1 PHC+', title: '老师：PHC 小改到 100%', sub: '三处改动；右边柱子是表 5 的消融', dur: 13, cam: [0.08, 1.2, 32, [-2.2, 4.0, 0]],
      html: dl([['结构', '3 个 primitive＋composer（代码 num_prim = 3）'], ['每个网络', '6 层 MLP [2048, 1536, 1024, 1024, 512, 512]，SiLU'], ['训练', 'PPO，学习率 2×10⁻⁵，σ = 0.05，约 10¹⁰ 样本'], ['结果', 'AMASS-Train* 100%，AMASS-Test* 99.2%（表 1）']]) +
        '<p>论文列了三处改动：一是再清洗一遍数据（第 3 幕）；二是在一个 primitive <b>训练的过程中</b>就不断更新难序列集合，而不是等它收敛后再开新 primitive；三是网络从 3 层加到 6 层、ReLU 换 SiLU。只用 3 个 primitive 就学会了恢复并达到 100%。</p>' +
        '<p>表 5 只消融了单个 primitive（每个 3×10⁹ 样本），AMASS-Test 138 条：不做渐进 92.0%；ReLU＋渐进 97.8%；SiLU＋渐进 98.5%。换成条数是 127、135、136 条。SiLU 带来的成功率提升其实是 1 条序列，E<sub>mpjpe</sub> 从 32.8 降到 28.1 更明显。</p>' +
        '<p>代码里老师的输出是 Σwᵢμᵢ（3 列 PNN 不带侧向连接，加 composer 权重），和 PHC 代码一样，不是 PHC 论文式 (6) 的归一化乘积。</p>' +
        src('§4.1 · 附录 B.3 表 5 · 表 4 · env_im_vae.yaml、im_pnn_big.yaml、humanoid_im_distill.py:194-198') },
    { n: 3, part: '附录 B.1', title: '为什么要再洗一遍 AMASS', sub: '图 6 的穿地和跳帧，换算成速度', dur: 13, cam: [0.3, 1.12, 22, [0.5, 2.6, 0]],
      html: dl([['问题 1', '穿地：一帧里身体陷进地面 12.5 到 75 cm'], ['问题 2', '跳帧：120 Hz 动捕里相邻两帧差 11 到 73 cm'], ['后果', 'RSI 抽到这种帧，物理引擎把人弹飞；跳帧让策略学会“预判大跳”'], ['结果', '11313 条训练、138 条测试']]) +
        '<p>动捕数据经过优化和拟合，偶尔会坏：姿态错乱、陷进地面、两帧之间突然跳一大截。PHC 训练时用参考状态初始化（RSI，随机从片段某一帧开始），如果抽到陷地的帧，仿真会施加很大的地面反力把人形弹飞；直接把高度抬上去又会造成漂浮或新的不连续。</p>' +
        '<p>图 6 标出了每个例子的数值。跳帧是在 120 Hz 下相邻帧之间的距离，所以可以直接换算速度：73 cm 一帧就是 0.73 × 120 = 87.6 m/s，最小的 11 cm 也有 13.2 m/s。人体动作里不可能出现这种速度，这是数据错误而不是“难动作”。</p>' +
        '<p>困难挖掘会把这些失败序列当成“难”的反复喂给新 primitive，所以论文说它们对 PHC 是双重妨碍。</p>' +
        guess('左边的小人和弹飞动画是手写的；弹起高度按“陷入深度 d 的弹簧以刚度 k 储能”算，k 是我设的，PhysX 实际的去穿透方式不同。右边的速度是按图 6 的数字和 120 Hz 精确换算的。') +
        src('附录 B.1 · 图 6') },
    { n: 4, part: '§4.2 在线蒸馏', title: '学生自己跑，老师来标注', sub: '和 DAgger 一样。切换训练数据，看学生成功率', dur: 16, cam: [0, 1.25, 20, [0, 3.0, 0]],
      html: dl([['采样', '学生 π_PULSE 在仿真里跑（z 按 E 采样，动作取 D 的均值）'], ['标注', '对学生到过的每个状态查询 π_PHC+'], ['损失', '式 (3) 监督学习，不用 RL'], ['规模', '3072 个人形并行，约 10⁹ 样本']]) +
        '<p>论文的关键说法是：从一个已经训好的模仿器<b>在线</b>蒸馏，是能扩到大数据集的原因。在线是指训练数据来自学生自己的状态分布，老师只负责给标签，这和 DAgger 一样（论文 §2 也这么说）。</p>' +
        '<p>论文比较过两个替代：只用 RL 从头训这个瓶颈结构（附录 C.2，跑了 10¹⁰ 样本以上，训练集 72.0%、测试集 32.6%）；RL 和监督一起用（表 3 R4，71.0%）。<b>没有比较离线行为克隆</b>（只在老师的轨迹上回归），所以“在线”本身贡献多少，论文没有直接的数据。</p>' +
        '<p>代码里蒸馏环境还会让一部分回合从倒地开始（recoveryEpisodeProb 0.3、fallInitProb 0.1），所以学生也从老师那里学到起身。正文没写这一点。</p>' +
        toyb('二维的不稳定系统，老师是一个非线性反馈律；学生是 169 个 RBF 的岭回归（容量有限，离数据远就输出 0）。“BC”只在 20 条无噪声的老师轨迹上回归；“DAgger”每轮让学生带噪声跑 20 条，由老师标注后合并重拟合。全部当场计算：BC 84.3%，DAgger 第 1 轮 99.3%。但给 BC 100 条老师轨迹也到 100%：在这个玩具里差别来自状态覆盖，不是在线本身。') +
        src('§4.2 · 算法 1 第 1-17 行 · 附录 C.1、C.2 · amp_agent.py:244-246, 775-845 · env_im_vae.yaml') },
    { n: 5, part: '§4.2 瓶颈', title: '编码器、先验、解码器', sub: '三个网络的输入和尺寸；右边是两维切片上的 KL', dur: 14, cam: [0.05, 1.18, 31, [-3.2, 3.8, 0]],
      html: dl([['E', '(s^p, s^g) 934 维 → [1536, 1024, 512] → μᵉ, log σᵉ² ∈ ℝ³²'], ['R', 's^p 358 维 → [1536, 1024, 512] → μᵖ, log σᵖ² ∈ ℝ³²'], ['D', '(s^p, z) 390 维 → [3096, 2048, 1024] → a ∈ ℝ⁶⁹'], ['参数量', 'E 3.63 M，R 2.68 M，D 9.72 M（我按代码算）'], ['评估时', 'z = μᵉ，不采样']]) +
        '<p>式 (1)：编码器和先验都是对角高斯。式 (2) 是证据下界：数据项让解码出的动作像老师，KL 项让编码器的分布靠近先验。和 VAE 的区别有两点：没有重建损失，直接在动作空间监督；先验不是 N(0, I)，而是只看本体感觉的网络 R(z|s^p)，借鉴 HuMoR。</p>' +
        '<p>为什么先验要看本体：站着不动的人和空翻到一半的人，下一步能做的动作分布完全不同。下游策略就从这个“此刻合理的动作”附近开始找（第 9 幕）。</p>' +
        '<p>论文只说三个网络都是三层 MLP。宽度、输入维度和参数量是我从代码（im_z_fit.yaml、amp_network_z_builder.py）读和算的。D 的第一层写的是 3096，大概本想写 3072。代码还把两个 log 方差夹在 [−5, 2]，论文没提。</p>' +
        toyb('右边只画 32 维里的两维。μ、σ 是我设的，随进度移动；KL 按对角高斯的公式当场算，只算这两维。') +
        src('§4.2 式 (1)(2) · §5 Implementation · im_z_fit.yaml · env_im_vae.yaml · amp_network_z_builder.py:79-120, 226-247, 469-520 · loss_functions.py') },
    { n: 6, part: '§4.2 损失', title: '式 (3) 的三项，论文和代码各写一遍', sub: '切换 L_action 和 β 退火两个视图', dur: 14, cam: [0, 1.3, 25, [0, 4.2, 0]],
      html: dl([['式 (3)', 'L = L_action + α L_regu + β L_KL'], ['论文 L_action', '‖a^PHC+ − a‖²'], ['代码', 'mean‖a^PHC+ − a‖（不平方）'], ['论文 L_regu', '‖μᵉ_t − μᵉ_{t−1}‖²'], ['代码', 'mean‖μᵉ_t − 0.99 μᵉ_{t−1}‖（AR(1)，不平方）'], ['α, β', '0.005；0.01 → 0.001（两边一致）']]) +
        '<p><b>L_action。</b>论文写平方误差，代码是误差向量的 L2 范数取平均（注释写 RMSE）。两者在误差 1 处相等；误差小时范数的梯度不衰减，误差大时增长得慢。</p>' +
        '<p><b>L_regu。</b>论文说它像 NPMP 的 AR(1) 先验。代码确实是 AR(1)：z_t − φz_{t−1}，φ = 0.99；并把跨回合、回合开头 2 步的项置 0。</p>' +
        '<p><b>β 退火。</b>附录 C.1 说 β 从 2.5×10⁹ 到 5×10⁹ 样本之间从 0.01 降到 0.001。但表 4 说 PULSE 总共约 10⁹ 样本，按这个说法退火还没开始训练就结束了。代码按 epoch 退火：2500 到 5000 epoch；每 epoch 3072 × 32 = 98,304 个样本，对应 2.46×10⁸ 到 4.92×10⁸ 样本，比论文写的小 10 倍，和总量 10⁹ 能对上。</p>' +
        src('§4.2 式 (3) · 附录 C.1 · 表 4 · amp_agent.py:775-835 · env_im_vae.yaml · im_z_fit.yaml') },
    { n: 7, part: '§4.2 L_regu', title: '相邻帧的潜码要挨着', sub: '玩具：同一段动作的潜码轨迹，切换正则强度', dur: 13, cam: [0, 1.32, 22, [0.4, 3.8, 0]],
      html: dl([['动机', '不加约束时，先验会把相近状态的潜码推得很远'], ['表 3 R1 → R2', '无先验：36.9% → 45.6%'], ['表 3 R3 → R6', '有先验：60.8% → 93.4%'], ['评测', 'VR 三点跟踪，AMASS-Test 138 条']]) +
        '<p>论文观察到：可学习的先验如果不加约束，会把本体感觉很接近的状态的潜码推得很远。下游策略在这样的空间里探索，相邻两步可能跳到完全不同的动作。L_regu 惩罚相邻帧潜码均值的差，让一段连续动作在潜空间里也是一条连续的线。</p>' +
        '<p>表 3 在 VR 跟踪任务上消融：加 L_regu 在无先验时 +8.7 个点，有先验时 +32.6 个点。换算成条数是 51 → 63、84 → 129。</p>' +
        toyb('一条二维“真实”潜码轨迹加上逐帧抖动作为编码器的原始输出，再解 min Σ‖z_t − y_t‖² + λ Σ‖z_t − 0.99 z_{t−1}‖²（高斯-赛德尔迭代 200 次，当场算）。读数是相邻帧平均步长和离真实轨迹的平均距离。λ 的数值是玩具里的，不是论文的 α。') +
        src('§4.2 · §5.4 表 3 · amp_agent.py:792-807') },
    { n: 8, part: '§5.3 随机生成', title: '只用先验和解码器，随机地动', sub: 'z_t ~ R(z|s_t)，解码，仿真，再算下一步的先验', dur: 18, cam: [0.25, 1.15, 20, [0.8, 2.8, 0]],
      html: dl([['采样', 'z_t ~ N(μᵖ(s_t), σᵖ(s_t))'], ['闭环', 'D(s_t, z_t) → PD → 仿真 → s_{t+1} → R'], ['可控', '改变输入噪声的方差，动作变平缓或变激烈'], ['失败', '会卡在躺着或站着，加大噪声能把它“震”出来']]) +
        '<p>这一幕说明先验本身就是一个生成模型：不给任何任务，只从 R 采样再交给 D，人形会走、转身、摔倒、爬起。它受物理约束，所以不会像纯运动学的 HuMoR 那样生成不可能的姿态。图 3(f) 是这样一段随机滚动，中间摔倒又站起来。</p>' +
        '<p>论文把这个当定性结果放在项目主页，没有量化指标。附录 C.3 说球面潜空间和 VQ 潜空间蒸馏后模仿得一样好（100% 和 99.8%），但随机采样不出连贯的动作，这正是要可学习先验的原因。</p>' +
        guess('小人的走、摔、起身是手写的关键帧，不是解码器的输出。左边的点云是二维切片，μᵖ 的轨迹和 σᵖ 是我设的；噪声倍数只改变点云的大小和小人的动作节奏，用来示意论文说的“方差控制激烈程度”。') +
        src('§5.3 · 图 3(f) · 附录 A · 附录 C.3 · §6 Failure Cases') },
    { n: 9, part: '§4.3 残差动作', title: '下游策略从先验均值出发', sub: '玩具：探索噪声落在先验高密度区的比例', dur: 14, cam: [0, 1.32, 25, [1.6, 3.6, 0]],
      html: dl([['式 (4)', 'a^task = D(s^p, π_task(z|s^p, s^g) + μᵖ)'], ['探索', '固定方差，论文写 0.22'], ['代码', 'σ = e^−1 = 0.368（速度、伸手、击打、地形）；e^−1.5 = 0.223（VR）'], ['表 3 R5', '有先验但不用残差：18.1%'], ['表 3 R6', '用残差：93.4%']]) +
        '<p>冻结的 D 加上仿真，就是一个新的环境，动作是 32 维潜码。下游策略不直接输出 z，而是输出相对先验均值 μᵖ 的残差。策略刚初始化时输出接近 0，于是一开始就在“此刻合理的动作”附近探索，而不是在整个潜空间里乱撒。</p>' +
        '<p>论文说探索用固定方差 0.22，而不是先验的 σᵖ，因为 σᵖ 往往很小。代码里这个数是 log 标准差的初值：VR 是 −1.5，标准差 0.223；其他任务是 −1，标准差 0.368。所以 0.22 应是 VR 的<b>标准差</b>，其他任务的探索更大。</p>' +
        toyb('二维潜空间，先验均值 μᵖ = (1.4, 0.8)、σᵖ = 0.25（我设的）。每种设置撒 4000 个点，统计落在先验 2σ 椭圆内的比例，当场算。二维和 32 维差别很大，这个比例不能和表 3 比。') +
        src('§4.3 式 (4) · §5.4 表 3 · pulse_z_task.yaml、pulse_z_vr.yaml · humanoid_z.py compute_z_actions') },
    { n: 10, part: '§5.2 下游任务', title: '五个任务，奖励怎么写', sub: '切换任务。奖励按论文和代码各列一遍', dur: 16, cam: [0.3, 1.15, 22, [0.6, 2.6, 0]],
      html: dl([['生成类', '速度、伸手、击打、地形，3 层 [2048, 1024, 512]'], ['跟踪类', 'VR 三点，6 层 [2048, 1536, 1024, 1024, 512, 512]'], ['训练', '全部 PPO，不用 AMP（代码 disc_reward_w = 0）'], ['样本', '附录 C.4：简单任务约 2×10⁹，地形约 10¹⁰'], ['图 4 横轴', '速度、击打 2.5×10⁸，伸手 1.5×10⁸，地形 10⁹']]) +
        '<p>速度、伸手、击打沿用 ASE 的定义，地形沿用 PACER，VR 沿用 QuestSim。基线是在 AMASS 上用官方代码重训的 ASE 和 CALM（各有 6 Hz 和 30 Hz 两版）以及不用潜空间、直接从头训的策略。</p>' +
        '<p>图 4 里 PULSE 在四个生成任务上的归一化回报都最高；从头训最接近，但论文说动作不自然。注意图 4 的横轴：速度和击打到 2.5×10⁸，伸手 1.5×10⁸，地形 10⁹，比附录 C.4 写的训练量小约 10 倍，和第 6 幕的 β 退火是同一个倍数。</p>' +
        guess('小人的动作和场景都是手写的，只用来区分任务。奖励公式是论文和代码的原文换写。') +
        src('§5 Tasks · §5.2 · 图 3、图 4 · 附录 C.4 · humanoid_speed.py、humanoid_reach.py、humanoid_strike.py、humanoid_pedestrian_terrain.py、env_pulse_terrain.yaml、README') },
    { n: 11, part: '§5 结果', title: '表里的数', sub: '切换六组数，柱子都是原文数字', dur: 12, cam: [0, 1.28, 31, [0, 5.2, 0]],
      html: dl([['表 1', 'PULSE 训练集 99.8%，测试集 97.1%（PHC+ 100% / 99.2%）'], ['表 2', 'VR：测试集 93.4%，和从头训一样；真实数据 14/14'], ['表 3', '去掉任何一项都掉很多，最低 18.1%'], ['表 6', '不用蒸馏只用 RL：72.0% / 32.6%']]) +
        '<p>表 1 的代价：从 PHC+ 蒸馏后，测试集成功率从 99.2% 掉到 97.1%（137 条变 134 条），全局误差从 36.1 升到 54.1 mm。论文的解释是变分瓶颈像 VAE 一样有重建误差；不加瓶颈蒸馏可以到 100%。</p>' +
        '<p>表 2 的读法：PULSE 和从头训在 AMASS-Test 上成功率相同（93.4%，都是 129/138），但误差更大；真实数据上控制器误差 68.4 对 43.3 mm，大 58%。论文说“相当”，也承认 VR 任务可能落后于专门训练的策略。优势主要在收敛速度（图 5）和动作像人。</p>' +
        '<p>全部成功率都能写成 k/138。我在精读页的读者注里逐个核算了。</p>' + src('§5.1 表 1 · §5.2 表 2 · §5.4 表 3 · 附录 B.3 表 5 · 附录 C.2 表 6 · 附录 C.3') }
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

  /* ---------- toy for scene 4: BC vs DAgger on a 2-D unstable system. Computed on load (about 0.3 s). ---------- */
  function buildDagger() {
    const dt = 0.1, T = 50, R = 2.4;
    const teacher = x => [-3.2 * x[0] + 0.9 * Math.sin(2.5 * x[1]), -3.2 * x[1] - 0.9 * Math.sin(2.5 * x[0])];
    const step = (x, a, r, sd) => [x[0] + dt * (1.0 * x[0] + a[0]) + sd * L.gauss(r), x[1] + dt * (1.0 * x[1] + a[1]) + sd * L.gauss(r)];
    const C = []; for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) C.push([-2.4 + 0.4 * i, -2.4 + 0.4 * j]);
    const W = 2 * 0.22 * 0.22, feat = x => { const f = C.map(c => Math.exp(-((x[0] - c[0]) ** 2 + (x[1] - c[1]) ** 2) / W)); f.push(1); return f; };
    function solve(A, b) { const n = b.length; for (let i = 0; i < n; i++) { let m = i; for (let j = i + 1; j < n; j++) if (Math.abs(A[j][i]) > Math.abs(A[m][i])) m = j; [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]]; for (let j = i + 1; j < n; j++) { const f = A[j][i] / A[i][i]; if (f) for (let k = i; k < n; k++) A[j][k] -= f * A[i][k]; b[j] -= f * b[i]; } } const x = Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let k = i + 1; k < n; k++) s -= A[i][k] * x[k]; x[i] = s / A[i][i]; } return x; }
    function fit(D) {
      const n = C.length + 1, A = Array.from({ length: n }, () => new Float64Array(n)), b0 = new Float64Array(n), b1 = new Float64Array(n);
      for (const [x, a] of D) { const f = feat(x); for (let i = 0; i < n; i++) { if (f[i] < 1e-9) continue; b0[i] += f[i] * a[0]; b1[i] += f[i] * a[1]; for (let j = 0; j < n; j++) A[i][j] += f[i] * f[j]; } }
      for (let i = 0; i < n; i++) A[i][i] += 0.05;
      const w0 = solve(A.map(r => Array.from(r)), Array.from(b0)), w1 = solve(A.map(r => Array.from(r)), Array.from(b1));
      return x => { const f = feat(x); let a0 = 0, a1 = 0; for (let i = 0; i < n; i++) { a0 += w0[i] * f[i]; a1 += w1[i] * f[i]; } return [a0, a1]; };
    }
    const start = r => { const a = r() * 6.283, q = 0.5 + 0.9 * r(); return [q * Math.cos(a), q * Math.sin(a)]; };
    function roll(pol, x0, r, sd) { const xs = [x0]; let x = x0; for (let t = 0; t < T; t++) { x = step(x, pol(x), r, sd); xs.push(x); if (Math.hypot(x[0], x[1]) > R) break; } return xs; }
    const ok = xs => xs.length === T + 1 && Math.hypot(...xs[T]) < 0.3;
    function evalPol(pol) { const r = rng(99); let c = 0; const paths = []; for (let i = 0; i < 300; i++) { const xs = roll(pol, start(r), r, 0.05); if (ok(xs)) c++; if (i < 20) paths.push({ xs, ok: ok(xs) }); } return { rate: c / 300, paths }; }
    const r = rng(3), bc = [], demo = []; for (let i = 0; i < 20; i++) { const xs = roll(teacher, start(r), r, 0); demo.push(xs); for (const x of xs) bc.push([x, teacher(x)]); }
    const r5 = rng(5), bc5 = []; for (let i = 0; i < 100; i++) { const xs = roll(teacher, start(r5), r5, 0); for (const x of xs) bc5.push([x, teacher(x)]); }
    let pol = fit(bc); const V = [{ name: 'BC 20 条', ev: evalPol(pol), data: bc.slice() }, { name: 'BC 100 条', ev: evalPol(fit(bc5)), data: bc5 }];
    let D = bc.slice();
    for (let k = 0; k < 4; k++) { const rr = rng(10 + k); for (let i = 0; i < 20; i++) { const xs = roll(pol, start(rr), rr, 0.05); for (const x of xs) if (Math.hypot(...x) < R) D.push([x, teacher(x)]); } pol = fit(D); if (k === 0 || k === 3) V.push({ name: `DAgger ${k + 1} 轮`, ev: evalPol(pol), data: D.slice() }); }
    return { V, teacher: evalPol(teacher).rate, demo };
  }
  let DAG = null; const dagger = () => (DAG ||= buildDagger());

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    const st = [[-12, '1 · 学模仿器 PHC+', '#f2a0a0'], [0, '2 · 蒸馏成潜空间', '#f2c14e'], [12, '3 · 下游任务', '#b48cff']];
    st.forEach(([x, t, c]) => { const pl = block(10.6, 0.25, 6, COL.dim, [x, -0.15, 0], { opacity: 0.55 }); G.add(pl, lab(t, [x, 9.3, 0], { size: 23, color: c })); });
    const data = block(2.6, 1.2, 1.6, COL.data, [-15.2, 1.0, 0]); G.add(data, lab('AMASS 11313 条', [-15.2, 2.1, 0], { size: 18 }));
    const prims = [0, 1, 2].map(i => block(0.8, 2.2, 1.2, COL.prim, [-12.4 + i * 1.05, 3.2, 0])); const comp = block(1.6, 1.0, 1.2, COL.teach, [-12.4 + 1.05, 5.4, 0]);
    G.add(...prims, comp, lab('PHC+（冻结）', [-11.35, 6.6, 0], { size: 19 }), lab('PPO＋AMP', [-8.6, 1.0, 1.5], { size: 17 }));
    const enc = block(1.8, 2.0, 1.4, COL.enc, [-2.6, 3.4, 0]), pri = block(1.8, 1.4, 1.4, COL.prior, [0, 1.0, 0]), dec = block(1.8, 2.0, 1.4, COL.dec, [2.6, 3.4, 0]);
    const zb = L.sphere(0.45, COL.gold, { emissive: 0x332200 }); zb.position.set(0, 3.4, 0); G.add(enc, pri, dec, zb);
    G.add(lab('编码器 E', [-2.6, 4.9, 0], { size: 19 }), lab('先验 R', [0, 2.2, 0], { size: 19 }), lab('解码器 D', [2.6, 4.9, 0], { size: 19 }), lab('z ∈ ℝ³²', [0, 4.35, 0], { size: 18 }), lab('老师标注 a^PHC+', [-6.0, 7.4, 0], { size: 17 }));
    const tp = block(1.8, 2.0, 1.4, COL.task, [8.6, 3.4, 0]), plus = L.torus(0.42, 0.09, COL.white); plus.position.set(10.9, 3.4, 0); const pri2 = block(1.6, 1.2, 1.4, COL.frozen, [10.9, 1.0, 0]), dec2 = block(1.6, 2.0, 1.4, COL.frozen, [13.3, 3.4, 0]);
    G.add(tp, plus, pri2, dec2, lab('任务策略', [8.6, 4.9, 0], { size: 19 }), lab('R（冻结）', [10.9, 2.1, 0.9], { size: 17 }), lab('D（冻结）', [13.3, 4.9, 0], { size: 17 }), lab('PPO', [8.6, 1.0, 1.5], { size: 17 }));
    const rob = robot(COL.robot); G.add(rob); const rob2 = robot(COL.dec); G.add(rob2);
    [[data, 1], [comp, 1], [enc, 4], [pri, 4], [dec, 4], [tp, 8], [pri2, 8], [dec2, 9]].forEach(([m, g]) => { m.userData.go = g; PICKS.push(m); }); prims.forEach(m => { m.userData.go = 1; PICKS.push(m); });
    const f = { a: stream(G, 5, COL.data), b: stream(G, 5, COL.teach), c: stream(G, 5, COL.enc), d: stream(G, 5, COL.dec), e: stream(G, 5, COL.task), g: stream(G, 4, COL.prior) };
    wire(G, [[-11.35, 6.0, 0], [-6.0, 7.0, 0], [2.6, 4.5, 0]], COL.teach, { dashed: true, opacity: 0.5 });
    return { update(p) {
      const q = (p * 20) % 1, a = seg(p, 0, 0.08) * (1 - seg(p, 0.33, 0.38)), b = seg(p, 0.33, 0.4) * (1 - seg(p, 0.66, 0.71)), c = seg(p, 0.66, 0.73);
      f.a([[-15.2, 1.6, 0], [-12.4, 3.2, 0], [-11.35, 5.4, 0]], q, a);
      f.b([[-11.35, 5.6, 0], [-6.0, 7.1, 0], [2.6, 4.4, 0]], q, b);
      f.c([[-4.5, 3.4, 0], [-2.6, 3.4, 0], [0, 3.4, 0]], q, b); f.d([[0, 3.4, 0], [2.6, 3.4, 0], [4.2, 3.4, 0]], q, b); f.g([[0, 1.0, 0], [0, 3.0, 0]], q, b);
      f.e([[7.0, 3.4, 0], [8.6, 3.4, 0], [10.9, 3.4, 0], [13.3, 3.4, 0], [15.0, 3.4, 0]], q, c);
      [...prims, comp].forEach(m => glow(m, 0.55 * a)); [enc, pri, dec].forEach(m => glow(m, 0.55 * b)); [tp, plus].forEach(m => glow(m, 0.55 * c));
      pose(rob, clip(p < 0.66 ? 'skip' : 'walk', p * 14), [4.5, 0, 1.6], 2.4, Math.PI / 2); pose(rob2, clip('walk', p * 14), [15.6, 0, 1.6], 2.4, Math.PI / 2);
      rob.visible = p >= 0.33 && p < 0.66; rob2.visible = p >= 0.66;
      cap(p < 0.33 ? '第 1 段：PPO 训练的模仿器 PHC+ 学会 AMASS 全部 11313 条，然后<b>冻结</b>' : p < 0.66 ? '第 2 段：学生（E → z → D）在仿真里跑，<b>老师给每个状态标动作</b>，监督学习' : '第 3 段：D 和 R 冻结，任务策略输出<b>相对先验均值的残差 z</b>，PPO 训练');
    } };
  }

  /* ---------- scene 2: PHC+ teacher and Table 5 ---------- */
  function s2(G) {
    G.add(L.grid(30, 30));
    const W6 = [2048, 1536, 1024, 1024, 512, 512];
    const cols = [0, 1, 2].map(i => mlpStack(G, -11.5, 2.0 + i * 0.0, -2.2 + i * 2.2, W6, COL.prim, { k: 1 / 900, d: 1.4 }));
    const comp = mlpStack(G, -11.5, 6.4, 0, W6, COL.teach, { k: 1 / 900, d: 1.4 });
    G.add(lab('3 个 primitive（权重共享初始化，无侧向连接）', [-10.4, 0.0, 3.6], { size: 18 }), lab('composer → 3 个权重', [-10.4, 8.2, 0], { size: 18 }), lab('6 层 MLP，SiLU', [-10.4, 4.5, 3.8], { size: 17 }));
    const sum = L.torus(0.5, 0.1, COL.gate); sum.position.set(-6.4, 4.2, 0); G.add(sum, lab('Σ wᵢ μᵢ（代码）', [-6.4, 5.2, 0], { size: 18 }));
    const fl = stream(G, 6, COL.prim, 0.12);
    const ROWS = [['SiLU，不渐进', [92.0, 43.0, 29.2]], ['ReLU，渐进', [97.8, 44.4, 32.8]], ['SiLU，渐进', [98.5, 39.0, 28.1]]];
    let m = +(OPT[0] ?? 0); const MET = ['Succ（%）', 'E_g-mpjpe（mm）', 'E_mpjpe（mm）'];
    const sub = new THREE.Group(); G.add(sub); let built = -1, bars = [];
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); built = m; bars = [];
      ROWS.forEach(([n, v], i) => { const x = 1.5 + i * 3.4, val = v[m], b = block(1.6, 1, 1.6, [COL.sim, COL.data, COL.prim][i], [x, 0.5, 0], { edges: false }); sub.add(b);
        const h = m === 0 ? (val - 85) / 15 * 6.5 : val / 50 * 6.5; const l = lab(m === 0 ? `${val.toFixed(1)}%（${Math.round(val / 100 * 138)}/138）` : val.toFixed(1), [x, 0, 0], { size: 17 }); sub.add(l, lab(n, [x, -0.3, 2.0], { size: 17 })); bars.push({ b, l, h }); });
      sub.add(lab('表 5 · 单个 primitive，AMASS-Test · ' + MET[m] + (m === 0 ? '（纵轴从 85 起）' : ''), [5.0, 8.6, 0], { size: 20, border: 'rgba(56,209,255,.7)' }));
    }
    const chg = [['① 再洗一遍数据', 1], ['② 训练中就更新难序列', 2], ['③ 3 层 → 6 层，ReLU → SiLU', 3]].map(([t], i) => { const s = lab(t, [-4.0, 1.4 + i * 0.9, 3.4], { size: 18 }); G.add(s); return s; });
    const ctls = [{ label: '表 5 指标', items: MET, get: () => m, set: k => { m = k; } }];
    return { ctls, update(p) {
      if (built !== m) rebuild();
      const g = seg(p, 0.15, 0.6), q = (p * 16) % 1;
      bars.forEach(({ b, l, h }) => { const y = Math.max(0.05, h * g); b.scale.y = y; b.position.y = y / 2; l.position.y = y + 0.45; });
      const k = Math.floor(p * 3.2); cols.forEach((c, i) => c.userData.ms.forEach(s => glow(s, i === k % 3 && p <= 0.7 ? 0.5 : 0.05))); comp.userData.ms.forEach(s => glow(s, p > 0.7 ? 0.5 : 0.05));
      fl([[-12.5, 2.0, 0], [-9.3, 3.2, 0], [-6.4, 4.2, 0], [-3.5, 4.2, 0]], q, 1);
      chg.forEach((s, i) => { s.material.opacity = 0.35 + 0.65 * seg(p, 0.1 + i * 0.15, 0.2 + i * 0.15); });
      cap(m === 0 ? 'ReLU 换 SiLU：97.8 → 98.5，只差 <b>1 条</b>序列；渐进挖掘：92.0 → 98.5，差 9 条' : m === 2 ? 'E_mpjpe 上 SiLU 的作用更明显：32.8 → <b>28.1</b> mm' : 'E_g-mpjpe：不渐进 43.0，ReLU 渐进 44.4，SiLU 渐进 <b>39.0</b> mm');
    } };
  }

  /* ---------- scene 3: data cleaning; Fig. 6 numbers converted to speeds ---------- */
  function s3(G) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), new THREE.MeshStandardMaterial({ color: 0x8b95ab, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); floor.rotation.x = -Math.PI / 2; floor.position.set(-4.5, 0, 0); G.add(floor);
    const PEN = [['CMU_90_90_11', 12.5], ['DanceDB Maritsa', 75], ['DanceDB Theodora', 56], ['Transitions LOB', 13]];
    const DIS = [['DanceDB Zeibekiko', 73], ['DanceDB Bachata', 55], ['DanceDB Annoyed', 53], ['ACCAD Male2Running', 28], ['BioMotionLab jumping2', 11]];
    let mode = +(OPT[0] ?? 0), pick = +(OPT[1] ?? 1);
    const rob = robot(COL.robot), ghost = robot(COL.ref, { opacity: 0.45 }); G.add(rob, ghost);
    const sub = new THREE.Group(); G.add(sub); let built = -1, bars = [];
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); built = mode; bars = [];
      const list = mode === 0 ? PEN : DIS; const vals = list.map(([, v]) => mode === 0 ? v : v / 100 * 120);
      list.forEach(([n, v], i) => { const x = 2.2 + i * 1.75, b = block(1.1, 1, 1.1, mode === 0 ? COL.bad : COL.gate, [x, 0.5, 0], { edges: false }); sub.add(b); const h = mode === 0 ? v / 12 : vals[i] / 14; bars.push([b, h]);
        sub.add(lab(n.replace(' ', '\n'), [x, -0.1, 1.6], { size: 15 })); sub.add(lab(mode === 0 ? `${v} cm` : `${v} cm/帧\n= ${vals[i].toFixed(1)} m/s`, [x, h + 0.7, 0], { size: 16 })); });
      sub.add(lab(mode === 0 ? '图 6 第一行：陷入地面的深度' : '图 6 第二行：120 Hz 相邻帧的跳变 → 速度', [5.8, 7.2, -1.0], { size: 19, border: 'rgba(240,150,60,.7)' }));
    }
    const ctls = [{ label: '问题', items: ['穿地', '跳帧'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      if (built !== mode) rebuild();
      const g = seg(p, 0.05, 0.4); bars.forEach(([b, h]) => { b.scale.y = Math.max(0.02, h * g); b.position.y = b.scale.y / 2; });
      const sc = 3.0;
      if (mode === 0) {
        const d = 0.56, kk = 4.0e4, m = 70, v = d * Math.sqrt(kk / m), hmax = v * v / 19.62; /* toy spring: k is my choice */
        const U = 1.95; /* scene units per metre at this robot scale */
        const t = clamp((p - 0.35) / 0.5, 0, 1) * (2 * v / 9.81), y = p < 0.35 ? -d : v * t - 0.5 * 9.81 * t * t;
        pose(rob, still(), [-4.5, 0, 0], sc, 0.3); rob.position.y = Math.min(6.5, y * U); ghost.visible = false;
        cap(p < 0.35 ? 'RSI 抽到一帧：人陷进地面 <b>56 cm</b>（图 6 的一个例子）' : `仿真把它推出地面：玩具弹簧 k = 4×10⁴ N/m、70 kg 时起跳 <b>${v.toFixed(1)} m/s</b>，可上升 ${hmax.toFixed(1)} m（画面截在 3.3 m；k 是我设的）`);
      } else {
        const j = 0.73, t = (p * 6) % 1, off = t < 0.5 ? 0 : j * sc / 1.7;
        pose(ghost, clip('walk', 0.2), [-5.6, 0, 0], sc, 0.3); ghost.visible = true;
        pose(rob, clip('walk', 0.2), [-5.6 + off, 0, 0], sc, 0.3);
        cap('相邻两帧（1/120 s）差 <b>73 cm</b>：相当于 <b>87.6 m/s</b>。这是数据错误，不是“难动作”');
      }
    } };
  }

  /* ---------- scene 4: online distillation (DAgger) with the toy ---------- */
  function s4(G) {
    const T = dagger(); let v = +(OPT[0] ?? 0);
    const S = 1.45, X0 = -3.4, Y0 = 3.4; const P = (x) => [X0 + x[0] * S, Y0 + x[1] * S, 0];
    panel(G, X0 - 2.6 * S, Y0 - 2.6 * S, -0.2, 5.2 * S, 5.2 * S);
    const rr = ring(G, COL.ok, 0.8); rr.scale.setScalar(0.3 * S); rr.position.set(X0, Y0, 0.01);
    const out = ring(G, COL.bad, 0.5); out.scale.setScalar(2.4 * S); out.position.set(X0, Y0, 0.01);
    const NP = 20, rib = Array.from({ length: NP }, () => ribbon(G, 51, COL.prim, 0.05, { order: 3 }));
    const dem = Array.from({ length: 20 }, () => ribbon(G, 51, COL.white, 0.035, { order: 2, opacity: 0.5 }));
    const DN = 6000, dts = dots(G, DN, COL.gold); dts.material.opacity = 0.6; dts.material.transparent = true;
    const tch = block(2.4, 1.3, 1.4, COL.teach, [6.6, 6.0, 0]), stu = block(2.4, 1.3, 1.4, COL.dec, [6.6, 2.6, 0]); G.add(tch, stu);
    G.add(lab('老师（冻结）', [6.6, 7.1, 0], { size: 19 }), lab('学生', [6.6, 3.7, 0], { size: 19 }), lab('白：老师轨迹  黄：带标签的训练状态', [X0, Y0 - 2.85 * S, 0], { size: 17 }));
    const ann = stream(G, 5, COL.teach, 0.12), go = stream(G, 5, COL.dec, 0.12);
    const resL = liveLab(G, [6.6, 0.6, 0], { size: 19, border: 'rgba(79,201,138,.7)' });
    const ctls = [{ label: '训练数据', items: T.V.map(x => x.name), get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      const V = T.V[v], g = seg(p, 0.0, 0.7), q = (p * 16) % 1;
      V.ev.paths.forEach((o, i) => { const n = Math.max(2, Math.round(g * 50)); rib[i].userData.set(o.xs.slice(0, n).map(P)); rib[i].material.color.setHex(o.ok ? COL.prim : COL.bad); rib[i].visible = true; });
      T.demo.forEach((xs, i) => { dem[i].userData.set(xs.map(P)); dem[i].visible = v === 0 || v >= 2; });
      const D = V.data, n = Math.min(DN, D.length); for (let i = 0; i < DN; i++) { if (i < n) { const x = D[Math.floor(i * D.length / n)][0]; setI(dts, i, [X0 + x[0] * S, Y0 + x[1] * S, 0.05], 0.035); } else setI(dts, i, [0, -50, 0], 0.001); } done(dts);
      ann([[6.6, 5.3, 0], [3.0, 4.5, 0], [X0 + 1.5, Y0 + 1.5, 0]], q, v >= 2 ? 1 : 0); go([[X0 + 1.5, Y0 - 1.5, 0], [3.0, 2.2, 0], [6.6, 2.0, 0]], q, 1);
      glow(tch, v >= 2 ? 0.5 : 0.2); glow(stu, 0.4);
      resL(`学生成功率 ${(V.ev.rate * 100).toFixed(1)}%（老师 ${(T.teacher * 100).toFixed(0)}%）· 训练对 ${D.length}`);
      cap(v === 0 ? 'BC：只在老师的轨迹上回归。学生一偏离，就到了<b>没见过的状态</b>' : v === 1 ? 'BC 给 5 倍数据也到 100%：这个玩具里<b>差别来自覆盖</b>' : '在线（DAgger）：<b>学生自己跑</b>，老师给它到过的状态标动作，再一起拟合');
    } };
  }

  /* ---------- scene 5: encoder, prior, decoder; KL on a 2-D slice ---------- */
  function s5(G) {
    const sp = block(1.6, 1.0, 1.2, COL.robot, [-13, 1.2, 0]), sg = block(1.6, 1.0, 1.2, COL.ref, [-13, 4.4, 0]);
    G.add(sp, sg, lab('s^p 本体 358', [-13, 2.2, 0], { size: 17 }), lab('s^g 目标 576', [-13, 5.4, 0], { size: 17 }));
    const E = mlpStack(G, -10.6, 4.4, 0, [1536, 1024, 512, 160], COL.enc, { k: 1 / 700 }), Rn = mlpStack(G, -10.6, 1.2, 0, [1536, 1024, 512], COL.prior, { k: 1 / 700 });
    const D = mlpStack(G, -3.6, 3.0, 0, [3096, 2048, 1024], COL.dec, { k: 1 / 900 });
    G.add(lab('E [1536,1024,512] → 160 → μᵉ, log σᵉ²', [-9.6, 7.1, 0], { size: 16 }), lab('R [1536,1024,512] → μᵖ, log σᵖ²', [-9.6, -0.4, 1.0], { size: 16 }), lab('D [3096,2048,1024] → 69', [-3.0, 6.6, 0], { size: 16 }));
    const zb = L.sphere(0.36, COL.gold, { emissive: 0x332200 }); zb.position.set(-5.4, 3.0, 0); G.add(zb, lab('z（32）', [-5.4, 3.75, 0], { size: 16 }));
    const act = block(1.2, 1.0, 1.0, COL.gate, [-1.0, 3.0, 0]), tgt = block(1.2, 1.0, 1.0, COL.teach, [-1.0, 5.4, 0]); G.add(act, tgt, lab('a（69）', [-1.0, 2.0, 0.8], { size: 16 }), lab('a^PHC+', [-1.0, 6.4, 0], { size: 16 }));
    const f1 = stream(G, 5, COL.enc, 0.1), f2 = stream(G, 5, COL.prior, 0.1), f3 = stream(G, 5, COL.dec, 0.1);
    /* 2-D slice */
    const CX = 6.2, CY = 3.4, SC = 1.6; panel(G, CX - 3.3, CY - 3.3, -0.2, 6.6, 6.6);
    const Re = [ring(G, COL.prior, 0.9), ring(G, COL.prior, 0.4)], Ee = [ring(G, COL.enc, 0.95), ring(G, COL.enc, 0.45)];
    const smp = dots(G, 120, COL.gold); const rs = rng(4), eps = Array.from({ length: 120 }, () => [L.gauss(rs), L.gauss(rs)]);
    G.add(lab('黄：E(z|s^p,s^g)  绿：R(z|s^p)  · 两维切片', [CX, CY + 3.75, 0], { size: 16 }));
    const klL = liveLab(G, [CX, CY - 3.9, 0], { size: 18, border: 'rgba(242,193,78,.7)' });
    const mp = [0.4, 0.2], sp2 = [0.9, 0.7];
    return { update(p) {
      const q = (p * 16) % 1, t = p * 2 * Math.PI;
      const me = [mp[0] + 1.1 * Math.cos(t), mp[1] + 0.8 * Math.sin(t)], se = [0.28 + 0.12 * Math.sin(2 * t), 0.3];
      const kl = [0, 1].reduce((s, i) => s + 0.5 * (2 * Math.log(sp2[i] / se[i]) + (se[i] ** 2 + (me[i] - mp[i]) ** 2) / sp2[i] ** 2 - 1), 0);
      Re.forEach((r, k) => { r.scale.set(sp2[0] * SC * (k + 1), sp2[1] * SC * (k + 1), 1); r.position.set(CX + mp[0] * SC, CY + mp[1] * SC, 0.02); });
      Ee.forEach((r, k) => { r.scale.set(se[0] * SC * (k + 1), se[1] * SC * (k + 1), 1); r.position.set(CX + me[0] * SC, CY + me[1] * SC, 0.03); });
      eps.forEach((e, i) => setI(smp, i, [CX + (me[0] + se[0] * e[0]) * SC, CY + (me[1] + se[1] * e[1]) * SC, 0.05], 0.05)); done(smp);
      klL(`这两维的 KL(E‖R) = ${kl.toFixed(2)} nat`);
      f1([[-12.2, 4.4, 0], [-10.6, 4.4, 0], [-9.0, 4.4, 0], [-5.4, 3.0, 0]], q, 1); f2([[-12.2, 1.2, 0], [-9.6, 1.2, 0], [-7.4, 1.2, 0]], q, 1); f3([[-5.4, 3.0, 0], [-3.6, 3.0, 0], [-1.0, 3.0, 0]], q, 1);
      cap(`训练时 z = μᵉ + σᵉ·ε；评估时 <b>z = μᵉ</b>。KL 把 E 拉向<b>只看本体的先验 R</b>`);
    } };
  }

  /* ---------- scene 6: loss terms and the beta schedule ---------- */
  function s6(G) {
    let v = +(OPT[0] ?? 0);
    const XP = -10, YP = 0.6, WP = 20, HP = 7; panel(G, XP - 0.3, YP - 0.3, -0.3, WP + 0.6, HP + 0.9);
    const ax = wire(G, [[XP, YP + HP, 0], [XP, YP, 0], [XP + WP, YP, 0]], COL.white, { opacity: 0.6 });
    const N = 160, rA = ribbon(G, N, COL.prim, 0.08, { order: 3 }), rB = ribbon(G, N, COL.gate, 0.08, { order: 3 }), mk = ribbon(G, 2, COL.white, 0.05, { order: 2, opacity: 0.6 });
    const sub = new THREE.Group(); G.add(sub); let built = -1; const dot = L.sphere(0.18, COL.gold); G.add(dot);
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); built = v;
      if (v === 0) { sub.add(lab('误差 ‖a^PHC+ − a‖（任意单位，0 到 2）', [XP + WP / 2, YP - 0.9, 0], { size: 17 }), lab('蓝：论文 ‖e‖²   橙：代码 mean‖e‖', [XP + WP / 2, YP + HP + 0.5, 0], { size: 18 }), lab('两者在 ‖e‖ = 1 相等', [XP + WP / 2, YP + HP / 4 + 0.6, 0], { size: 16 })); }
      else { sub.add(lab('样本数（0 到 6×10⁹）', [XP + WP / 2, YP - 0.9, 0], { size: 17 }), lab('β：蓝 = 论文附录 C.1   橙 = 代码 epoch × 98,304', [XP + WP / 2, YP + HP + 0.5, 0], { size: 18 }), lab('表 4：总共约 10⁹', [XP + WP / 6, YP + HP - 0.6, 0], { size: 16, border: 'rgba(224,93,93,.8)' }), lab('0.01', [XP - 0.9, YP + HP * 0.95, 0], { size: 15 }), lab('0.001', [XP - 0.9, YP + HP * 0.095, 0], { size: 15 })); }
    }
    const beta = (s, a, b) => s <= a ? 0.01 : s >= b ? 0.001 : 0.01 - 0.009 * (s - a) / (b - a);
    const ctls = [{ label: '视图', items: ['L_action', 'β 退火'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      if (built !== v) rebuild();
      const A = [], B = [];
      if (v === 0) {
        for (let i = 0; i < N; i++) { const e = 2 * i / (N - 1); A.push([XP + WP * e / 2, YP + HP * Math.min(1, e * e / 4), 0.05]); B.push([XP + WP * e / 2, YP + HP * Math.min(1, e / 4), 0.06]); }
        const e = 2 * p; dot.position.set(XP + WP * e / 2, YP + HP * e * e / 4, 0.1); mk.userData.set([[XP + WP / 2, YP, 0.04], [XP + WP / 2, YP + HP / 4, 0.04]]);
        cap(`‖e‖ = ${e.toFixed(2)}：论文 ${(e * e).toFixed(2)}，代码 ${e.toFixed(2)}；梯度 ${(2 * e).toFixed(2)} 对 1（方向不变）`);
      } else {
        const M = 6e9; for (let i = 0; i < N; i++) { const s = M * i / (N - 1); A.push([XP + WP * s / M, YP + HP * beta(s, 2.5e9, 5e9) / 0.0105, 0.05]); B.push([XP + WP * s / M, YP + HP * beta(s, 2500 * 98304, 5000 * 98304) / 0.0105, 0.06]); }
        mk.userData.set([[XP + WP / 6, YP, 0.04], [XP + WP / 6, YP + HP, 0.04]]); const s = M * p; dot.position.set(XP + WP * p, YP + HP * beta(s, 2500 * 98304, 5000 * 98304) / 0.0105, 0.1);
        cap(`代码在 <b>2.46×10⁸ → 4.92×10⁸</b> 样本退火；论文写 2.5×10⁹ → 5×10⁹，超过了表 4 的总量 10⁹`);
      }
      rA.userData.set(A); rB.userData.set(B);
    } };
  }

  /* ---------- scene 7: L_regu toy, smoothing a latent path ---------- */
  function s7(G) {
    const N = 90, r = rng(21), truth = [], y = [];
    for (let t = 0; t < N; t++) { const u = t / (N - 1); truth.push([1.6 * Math.cos(2.6 * u) - 0.4, 1.1 * Math.sin(3.4 * u)]); }
    for (let t = 0; t < N; t++) { const j = (t % 17 < 2) ? 0.9 : 0.22; y.push([truth[t][0] + j * L.gauss(r), truth[t][1] + j * L.gauss(r)]); }
    const LAM = [0, 2, 20], PHI = 0.99;
    const solveZ = lam => { const z = y.map(v => v.slice()); for (let it = 0; it < 200; it++) for (let t = 0; t < N; t++) for (let d = 0; d < 2; d++) { let num = y[t][d], den = 1; if (t > 0) { num += lam * PHI * z[t - 1][d]; den += lam; } if (t < N - 1) { num += lam * PHI * z[t + 1][d]; den += lam * PHI * PHI; } z[t][d] = num / den; } return z; };
    const Z = LAM.map(solveZ), stat = z => { let s = 0, e = 0; for (let t = 1; t < N; t++) s += Math.hypot(z[t][0] - z[t - 1][0], z[t][1] - z[t - 1][1]); for (let t = 0; t < N; t++) e += Math.hypot(z[t][0] - truth[t][0], z[t][1] - truth[t][1]); return [s / (N - 1), e / N]; };
    const ST = Z.map(stat), ST0 = stat(truth); let k = +(OPT[0] ?? 1);
    const CX = -4.2, CY = 3.6, S = 1.9; panel(G, CX - 4.3, CY - 3.3, -0.2, 8.6, 6.6);
    const rt = ribbon(G, N, COL.white, 0.04, { order: 2, opacity: 0.5 }), rz = ribbon(G, N, COL.enc, 0.07, { order: 3 }); rt.userData.set(truth.map(v => [CX + v[0] * S, CY + v[1] * S, 0.02]));
    const pts = dots(G, N, COL.enc); const head = L.sphere(0.2, COL.gold); G.add(head);
    G.add(lab('白：一段动作的“真实”潜码  黄：编码器输出', [CX, CY + 3.65, 0], { size: 16 }));
    const B = [['R1 无先验 无 L_regu', 36.9, COL.sim], ['R2 无先验 有 L_regu', 45.6, COL.data], ['R3 有先验 无 L_regu', 60.8, COL.dim], ['R6 完整', 93.4, COL.prim]];
    const bars = B.map(([n, val, c], i) => { const b = bar(G, 3.6 + i * 2.1, 0, 1.3, c); G.add(lab(n.replace(' ', '\n'), [3.6 + i * 2.1, -0.4, 1.6], { size: 15 }), lab(`${val}%`, [3.6 + i * 2.1, val / 100 * 6.4 + 0.5, 0], { size: 16 })); return [b, val]; });
    G.add(lab('表 3 · VR 跟踪成功率（AMASS-Test）', [6.8, 8.0, 0], { size: 18, border: 'rgba(56,209,255,.7)' }));
    const ctls = [{ label: 'λ（玩具）', items: ['0（无正则）', '2', '20'], get: () => k, set: j => { k = j; } }];
    return { ctls, update(p) {
      const z = Z[k], n = Math.max(2, Math.round(seg(p, 0, 0.8) * N));
      rz.userData.set(z.slice(0, n).map(v => [CX + v[0] * S, CY + v[1] * S, 0.06])); z.forEach((v, i) => setI(pts, i, i < n ? [CX + v[0] * S, CY + v[1] * S, 0.07] : [0, -50, 0], 0.07)); done(pts);
      const h = z[n - 1]; head.position.set(CX + h[0] * S, CY + h[1] * S, 0.12);
      bars.forEach(([b, v]) => b.userData.set(v / 100 * 6.4 * seg(p, 0.1, 0.5)));
      cap(`λ = ${LAM[k]}：相邻帧平均步长 <b>${ST[k][0].toFixed(3)}</b>（真实 ${ST0[0].toFixed(3)}），离真实轨迹平均 <b>${ST[k][1].toFixed(3)}</b>`);
    } };
  }

  /* ---------- scene 8: random rollout from the prior ---------- */
  function s8(G) {
    const floor = L.grid(20, 20); G.add(floor);
    let k = +(OPT[0] ?? 1); const NS = [0.5, 1, 2];
    const rob = robot(COL.gate); G.add(rob);
    const CX = -6.5, CY = 4.4, S = 1.4; panel(G, CX - 2.8, CY - 2.8, -1.0, 5.6, 5.6);
    const cloud = dots(G, 160, COL.prior), mu = L.sphere(0.16, COL.white); G.add(mu); const rs = rng(8), eps = Array.from({ length: 160 }, () => [L.gauss(rs), L.gauss(rs)]);
    const trail = ribbon(G, 120, COL.white, 0.03, { order: 2, opacity: 0.5 });
    G.add(lab('z_t ~ N(μᵖ(s_t), σᵖ(s_t))，两维切片', [CX, CY + 3.1, -1.0], { size: 16 }));
    const phases = [['走', 0, 0.35], ['绊倒', 0.35, 0.5], ['躺', 0.5, 0.6], ['起身', 0.6, 0.8], ['再走', 0.8, 1]];
    const ctls = [{ label: '噪声倍数', items: ['0.5×', '1×', '2×'], get: () => k, set: j => { k = j; } }];
    return { ctls, update(p) {
      const sp = 0.7 + 0.3 * NS[k], t = p * 12 * sp; let q, x = -1.5 + 5 * p;
      if (p < 0.35) q = clip('walk', t); else if (p < 0.5) { const u = seg(p, 0.35, 0.5); q = qmix(clip('walk', t), { p: [0, 0.12, 0], pitch: 1.4, hL: 0.4, hR: 0.3, kL: 0.3, kR: 0.2, sL: 1.2, sR: 1.0, eL: 0.3, eR: 0.3 }, u); q.pitch = 1.45 * u; }
      else if (p < 0.6) { q = { p: [0, 0.12, 0], pitch: 1.45, hL: 0.4, hR: 0.3, kL: 0.3, kR: 0.2, sL: 1.2, sR: 1.0, eL: 0.3, eR: 0.3 }; }
      else if (p < 0.8) { const u = seg(p, 0.6, 0.8); q = getup(u, t); q.pitch = 1.45 * (1 - u) + (q.pitch || 0) * 0; }
      else q = clip('walk', t);
      pose(rob, q, [x, 0, 0], 2.6, Math.PI / 2);
      const th = 2 * Math.PI * p * 1.3, m = [1.1 * Math.cos(th) * (p < 0.35 || p > 0.8 ? 1 : 0.3), 0.9 * Math.sin(th)], s = 0.32 * NS[k];
      mu.position.set(CX + m[0] * S, CY + m[1] * S, -0.9); eps.forEach((e, i) => setI(cloud, i, [CX + (m[0] + s * e[0]) * S, CY + (m[1] + s * e[1]) * S, -0.95], 0.05)); done(cloud);
      const tr = []; for (let i = 0; i < 120; i++) { const pp = p * i / 119, a = 2 * Math.PI * pp * 1.3; tr.push([CX + 1.1 * Math.cos(a) * (pp < 0.35 || pp > 0.8 ? 1 : 0.3) * S, CY + 0.9 * Math.sin(a) * S, -0.92]); } trail.userData.set(tr);
      const ph = phases.find(([, a, b]) => p >= a && p < b) || phases[4];
      cap(`没有任务、没有参考动作，只从先验采样：<b>${ph[0]}</b>${p >= 0.5 && p < 0.6 ? '（论文说有时会卡在这里，加大噪声能把它震出来）' : ''}`);
    } };
  }

  /* ---------- scene 9: residual action, exploration toy ---------- */
  function s9(G) {
    const MU = [1.4, 0.8], SP = 0.25, NN = 4000, r = rng(17), E = Array.from({ length: NN }, () => [L.gauss(r), L.gauss(r)]);
    const SIG = [0.22, 0.368, 0.223]; let res = +(OPT[0] ?? 0), si = +(OPT[1] ?? 0);
    const frac = (c, s) => E.filter(e => Math.hypot((c[0] + s * e[0] - MU[0]) / SP, (c[1] + s * e[1] - MU[1]) / SP) < 2).length / NN;
    const CX = -2.0, CY = 3.4, S = 1.8; panel(G, CX - 3.4, CY - 2.8, -0.2, 7.4, 6.0);
    wire(G, [[CX - 3.4, CY, 0], [CX + 3.8, CY, 0]], COL.white, { opacity: 0.25 }); wire(G, [[CX, CY - 2.8, 0], [CX, CY + 3.0, 0]], COL.white, { opacity: 0.25 });
    const r2 = ring(G, COL.prior, 0.95); r2.scale.setScalar(2 * SP * S); r2.position.set(CX + MU[0] * S, CY + MU[1] * S, 0.02);
    G.add(lab('μᵖ', [CX + MU[0] * S, CY + MU[1] * S + 1.35, 0], { size: 17 }), lab('0', [CX - 0.3, CY - 0.3, 0], { size: 16 }), lab('绿圈：先验的 2σ 区域（“此刻合理的动作”）', [CX + 0.6, CY - 3.3, 0], { size: 16 }));
    const SH = 900, pts = dots(G, SH, COL.task);
    const B = [['R5 不用残差', 18.1, COL.bad], ['R6 残差', 93.4, COL.prim]];
    B.forEach(([n, v, c], i) => { const b = bar(G, 7.0 + i * 2.6, -1.5, 1.4, c); b.userData.set(v / 100 * 5.6); G.add(lab(n, [7.0 + i * 2.6, -0.4, 0.2], { size: 16 }), lab(`${v}%`, [7.0 + i * 2.6, v / 100 * 5.6 + 0.5, -1.5], { size: 17 })); });
    G.add(lab('表 3 · VR 跟踪成功率', [8.3, 7.0, -1.5], { size: 18, border: 'rgba(56,209,255,.7)' }));
    const ctls = [{ label: '动作', items: ['残差 z = π + μᵖ', '直接 z = π'], get: () => res, set: k => { res = k; } }, { label: '探索 σ', items: ['0.22（论文）', '0.368（代码·生成类）', '0.223（代码·VR）'], get: () => si, set: k => { si = k; } }];
    return { ctls, update(p) {
      const s = SIG[si], c = res === 0 ? MU : [0, 0], n = Math.round(seg(p, 0, 0.6) * SH);
      for (let i = 0; i < SH; i++) setI(pts, i, i < n ? [CX + (c[0] + s * E[i][0]) * S, CY + (c[1] + s * E[i][1]) * S, 0.05] : [0, -50, 0], 0.05); done(pts);
      const f = frac(c, s);
      cap(`策略刚初始化，输出 ≈ 0：${res === 0 ? '围着 <b>μᵖ</b> 探索' : '围着 <b>原点</b> 探索'}，σ = ${s}，落在先验 2σ 区内 <b>${(f * 100).toFixed(1)}%</b>（4000 个点，玩具）`);
    } };
  }

  /* ---------- scene 10: downstream tasks ---------- */
  function s10(G) {
    let k = +(OPT[0] ?? 0); G.add(L.grid(24, 24));
    const rob = robot(COL.dec); G.add(rob); const sub = new THREE.Group(); G.add(sub); let built = -1, obj = {};
    const TK = [
      { n: '速度', paper: 'r = abs(v_t − v′_t)', code: 'exp(−0.25·(Δv² + 0.1·v⊥²))', g: '目标方向 d_t 和速度 v_t，0 到 5 m/s', note: '论文的式子按字面是误差越大奖励越大，代码是 exp 型' },
      { n: '伸手', paper: 'exp(−5‖p_hand − c‖²)', code: 'exp(−4‖p_hand − c‖²)', g: '3D 点 c：水平 ±1 m，高 0.2 到 2.0 m（README 命令）', note: '系数 5 对 4' },
      { n: '击打', paper: '1 − u_up · u_t', code: '0.6·max(0, 1 − u_up·u_t) + 0.4·速度项；倒下即 1', g: '目标的位姿和速度；只许右手碰', note: '论文目标距离 1.5 到 5 m，代码默认 0.5 到 10 m' },
      { n: '地形', paper: 'exp(−2‖p⁰ − τ‖²) − 0.0005·Σ|μq̇|²', code: 'exp(−2‖Δ‖²)，能耗项关闭（power_reward: False）', g: '32×32×3 高度图（2 m 见方）＋轨迹', note: '论文说“下 10 个时间步”，代码 10 个采样点间隔 0.5 s，共 5 s' },
      { n: 'VR 三点', paper: '全身模仿奖励（同式 5）', code: '同 PHC 的模仿奖励；只按头和双手判失败', g: '头和双手的 6 项差（同模仿目标，只取 3 个关节）', note: 'Succ 只看三点，误差报全身' }
    ];
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); built = k; obj = {};
      if (k === 0) { const m = block(0.2, 0.05, 6, COL.ref, [0, 0.03, 0]); m.rotation.y = Math.PI / 2; sub.add(m); }
      if (k === 1) { obj.ball = L.sphere(0.25, COL.ref); sub.add(obj.ball); }
      if (k === 2) { obj.pil = block(1.2, 3.6, 0.6, COL.sim, [3.0, 1.8, 0]); sub.add(obj.pil); }
      if (k === 3) { for (let i = 0; i < 6; i++) sub.add(block(1.0, 0.3 * (i + 1), 4, COL.sim, [-1 + i * 1.0, 0.15 * (i + 1), 0], { edges: true })); obj.traj = []; for (let i = 0; i < 10; i++) { const d = L.sphere(0.1, COL.data); sub.add(d); obj.traj.push(d); } }
      if (k === 4) { obj.vr = [0, 1, 2].map(() => { const s = L.sphere(0.2, COL.ref); sub.add(s); return s; }); }
      const T = TK[k];
      sub.add(lab(`${T.n} · 目标状态：${T.g}`, [0, 7.6, 0], { size: 18, border: 'rgba(180,140,255,.7)' }), lab(`论文：${T.paper}`, [0, 6.6, 0], { size: 17 }), lab(`代码：${T.code}`, [0, 5.75, 0], { size: 17, color: '#f0963c' }));
    }
    const ctls = [{ label: '任务', items: TK.map(t => t.n), get: () => k, set: j => { k = j; } }];
    return { ctls, update(p) {
      if (built !== k) rebuild(); const t = p * 12;
      if (k === 0) { const q = clip(p > 0.4 ? 'walk' : 'walk', t * (0.8 + 1.2 * seg(p, 0.2, 0.7))); pose(rob, q, [-4 + 8 * p, 0, 0], 2.4, Math.PI / 2); }
      if (k === 1) { const c = [1.0 + 0.5 * Math.sin(6 * p), 1.0 + 0.5 * Math.sin(9 * p), 0.6]; obj.ball.position.set(...c); const q = still(); q.sR = 1.0 + 1.2 * Math.max(0, Math.sin(6 * p)); q.sL = 0.2; pose(rob, q, [0, 0, 0], 2.4, Math.PI / 2); }
      if (k === 2) { const hit = seg(p, 0.45, 0.6), fall = seg(p, 0.55, 0.85); pose(rob, clip('walk', t), [-4 + 5.5 * Math.min(1, p / 0.5), 0, 0], 2.4, Math.PI / 2); obj.pil.rotation.z = -fall * Math.PI / 2; obj.pil.position.set(3.0 + 1.8 * Math.sin(fall * Math.PI / 2), 0.6 + 1.2 * Math.cos(fall * Math.PI / 2), 0); }
      if (k === 3) { const x = -2.4 + 6.4 * p, h = clamp(Math.floor((x + 1.5) / 1.0) + 1, 0, 6) * 0.3; pose(rob, clip('walk', t), [x, h, 0], 2.4, Math.PI / 2); obj.traj.forEach((d, i) => { const xx = x + 0.6 * (i + 1); d.position.set(xx, clamp(Math.floor((xx + 1.5) / 1.0) + 1, 0, 6) * 0.3 + 0.08, 0.3 * Math.sin(xx)); }); }
      if (k === 4) { const q = clip('walk', t * 0.5); q.sR = 0.6 + 0.8 * Math.sin(5 * p); pose(rob, q, [0, 0, 0], 2.4, Math.PI / 2); const hp = [[0, 2.62, 0], [0.55, 1.6 + 0.5 * Math.sin(5 * p), 0.2], [-0.55, 1.5, 0.2]]; obj.vr.forEach((s, i) => s.position.set(...hp[i])); }
      cap(TK[k].note);
    } };
  }

  /* ---------- scene 11: results; every bar is a number from the paper ---------- */
  function s11(G) {
    let view = +(OPT[0] ?? 0); G.add(L.grid(34, 34)); const sub = new THREE.Group(); G.add(sub);
    const T = [
      { t: '表 1 · 动作模仿成功率（%）', g: ['AMASS-Train*', 'AMASS-Test*'], s: [['PHC', COL.sim, [98.9, 97.1]], ['PHC+', COL.teach, [100, 99.2]], ['PULSE', COL.prim, [99.8, 97.1]]], lo: 90 },
      { t: '表 1 · E_g-mpjpe（mm）', g: ['AMASS-Train*', 'AMASS-Test*'], s: [['PHC', COL.sim, [37.5, 47.5]], ['PHC+', COL.teach, [26.6, 36.1]], ['PULSE', COL.prim, [39.2, 54.1]]], lo: 0, hi: 60 },
      { t: '表 2 · VR 跟踪成功率（%）', g: ['ASE-30Hz', 'ASE-6Hz', 'CALM-30Hz', 'CALM-6Hz', 'Scratch', 'Ours'], s: [['Train*', COL.data, [79.8, 74.2, 16.6, 14.6, 98.8, 99.5]], ['Test*', COL.prim, [37.6, 33.3, 10.1, 10.9, 93.4, 93.4]], ['真实 k/14', COL.gate, [50.0, 28.6, 14.3, 0, 100, 100]]], lo: 0 },
      { t: '表 3 · 消融，VR 跟踪 AMASS-Test 成功率（%）', g: ['R1', 'R2', 'R3', 'R4 +RL', 'R5', 'R6 完整'], s: [['', COL.prim, [36.9, 45.6, 60.8, 71.0, 18.1, 93.4]]], lo: 0 },
      { t: '表 5 · PHC+ 单 primitive，AMASS-Test（%）', g: ['SiLU 不渐进', 'ReLU 渐进', 'SiLU 渐进'], s: [['', COL.teach, [92.0, 97.8, 98.5]]], lo: 85 },
      { t: '表 6 与 C.3 · 潜空间模仿成功率（%）', g: ['只用 RL 训练集', '只用 RL 测试集', 'PULSE 训练集', 'PULSE 测试集', '球面 训练集', 'VQ 训练集'], s: [['', COL.prim, [72.0, 32.6, 99.8, 97.1, 100, 99.8]]], lo: 0 }
    ];
    let bars = [], last = -1;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = view; const v = T[view], Ng = v.g.length, Ns = v.s.length, gw = Math.min(6.4, 28 / Ng), w = Math.min(1.5, (gw - 0.6) / Ns);
      v.g.forEach((nm, i) => { const x0 = (i - (Ng - 1) / 2) * gw; sub.add(lab(nm, [x0, -0.2, 2.6], { size: 18 }));
        v.s.forEach(([sn, c, vals], j) => { const x = x0 + (j - (Ns - 1) / 2) * (w + 0.08), b = block(w, 1, w, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(view === 2 && j === 2 ? `${Math.round(vals[i] * 14 / 100)}/14` : String(vals[i]), [x, 0, 0], { size: 15 }); sub.add(l); bars.push({ b, l, v: vals[i] }); }); });
      if (Ns > 1) v.s.forEach(([sn, c], j) => { sub.add(lab(sn, [-13 + j * 3.6, 8.4, 0], { size: 19, color: css(c) })); });
      sub.add(lab(v.t + (v.lo ? `（纵轴从 ${v.lo} 起）` : ''), [Ns > 1 ? 6 : 0, 8.4, 0], { size: 21, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const ctls = [{ label: '数据', items: ['表 1 Succ', '表 1 误差', '表 2', '表 3', '表 5', '表 6 / C.3'], get: () => view, set: k => { view = k; } }];
    const MSG = ['蒸馏后测试集 99.2 → <b>97.1</b>（137 → 134 条）；PHC 一行和 PHC 原文表 1 不完全一样', 'PULSE 的全局误差比老师大 <b>47%</b>（训练集 39.2 对 26.6）', '测试集 PULSE 和从头训<b>一样是 93.4%</b>（129/138）；真实数据都是 14/14', '去掉残差动作（R5）掉到 <b>18.1%</b>；混入 RL（R4）是 71.0%', 'SiLU 对成功率只多 1 条；渐进挖掘多 9 条', '不蒸馏、只用 RL：10¹⁰ 样本后测试集 <b>32.6%</b>'];
    return { ctls, update(p) {
      if (last !== view) rebuild(); const v = T[view], lo = v.lo || 0, hi = v.hi || 100;
      const g = seg(p, 0, 0.5); bars.forEach(({ b, l, v: x }) => { const h = Math.max(0.03, (x - lo) / (hi - lo) * 7 * g); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.4; });
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
  window.__pulseDebug = { dagger, get cap() { return $('cap').textContent; } };
})();
