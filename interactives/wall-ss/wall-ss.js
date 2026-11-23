'use strict';
/* WALL-SS (arXiv 2608.26239 v1) taken apart into eleven animated scenes. No code has been released, so everything here
   follows the paper text. The paper gives almost no sizes (scale table, memory schedule, lambdas, K), so every concrete
   number that is not quoted from the paper is a toy value and is marked as such in the panel. Scenes 8, 10 and 11 plot
   Figures 9, 12(a) and 14 as read from the paper's vector paths. Each scene's update(p) is a pure function of the
   timeline p plus the current toggles. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { txt: 0x9d8cff, obs: 0x3aa8e0, act: 0xf0963c, gen: 0xa78bfa, mem: 0x4fc98a, anc: 0x7cb8ff, gt: 0xf2c14e, bad: 0xe05d5d, ok: 0x4fc98a, dim: 0x46506a, sg: 0xd45fa0, pol: 0x4fc98a, real: 0x9aa6bf };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  /* Figure 9 (PDF page 18, vector read, one point every 2.5 s from 0 to 60 s; the four points the plotting tool merged as collinear are linearly interpolated) */
  const F9 = {
    a: { Ours: [0.084,0.09,0.097,0.094,0.106,0.114,0.111,0.123,0.131,0.129,0.14,0.147,0.144,0.154,0.161,0.158,0.167,0.172,0.169,0.178,0.182,0.179,0.186,0.189,0.187], full: [0.081,0.084,0.088,0.085,0.091,0.095,0.093,0.099,0.103,0.101,0.108,0.112,0.109,0.116,0.119,0.117,0.123,0.126,0.124,0.13,0.132,0.129,0.135,0.138,0.136], wodf: [0.085,0.095,0.109,0.128,0.152,0.185,0.226,0.262,0.292,0.324,0.349,0.37,0.385,0.4,0.398,0.412,0.421,0.433,0.439,0.448,0.456,0.463,0.471,0.479,0.486], recent: [0.089,0.109,0.146,0.195,0.253,0.331,0.406,0.467,0.527,0.576,0.616,0.647,0.676,0.698,0.69,0.717,0.736,0.749,0.761,0.773,0.782,0.791,0.799,0.809,0.816] },
    b: { Ours: [0.053,0.058,0.063,0.065,0.071,0.072,0.078,0.079,0.086,0.087,0.092,0.093,0.099,0.1,0.104,0.106,0.11,0.111,0.115,0.116,0.12,0.121,0.125,0.126,0.126], full: [0.051,0.054,0.058,0.059,0.062,0.063,0.068,0.068,0.072,0.073,0.078,0.078,0.082,0.083,0.087,0.088,0.092,0.092,0.096,0.097,0.101,0.101,0.104,0.105,0.106], wodf: [0.054,0.062,0.073,0.081,0.092,0.107,0.123,0.145,0.17,0.191,0.219,0.248,0.276,0.306,0.34,0.388,0.408,0.426,0.439,0.454,0.468,0.474,0.498,0.504,0.51], recent: [0.059,0.072,0.092,0.103,0.124,0.155,0.183,0.22,0.258,0.295,0.335,0.372,0.409,0.444,0.481,0.518,0.548,0.553,0.579,0.582,0.606,0.608,0.631,0.634,0.638] },
    c: { Ours: [0.934,0.929,0.921,0.925,0.913,0.901,0.905,0.891,0.881,0.886,0.87,0.861,0.865,0.852,0.84,0.846,0.835,0.828,0.833,0.821,0.815,0.82,0.808,0.803,0.81], full: [0.934,0.935,0.929,0.923,0.92,0.911,0.905,0.907,0.898,0.893,0.897,0.885,0.881,0.876,0.87,0.872,0.862,0.858,0.861,0.851,0.848,0.852,0.842,0.839,0.844], wodf: [0.934,0.924,0.913,0.9,0.885,0.858,0.831,0.802,0.773,0.742,0.713,0.686,0.665,0.64,0.622,0.609,0.595,0.58,0.57,0.555,0.541,0.53,0.518,0.505,0.495], recent: [0.934,0.919,0.895,0.868,0.831,0.786,0.73,0.68,0.628,0.579,0.54,0.505,0.48,0.455,0.44,0.425,0.411,0.395,0.383,0.371,0.359,0.345,0.333,0.32,0.309] }
  };
  /* Figure 12(a)/(b): per task five checkpoints, real and generated success rates (PDF page 20, vector read) */
  const F12 = [['T1', [.5, .7, .8, .6, .85], [.5, .7, .75, .65, .7]], ['T2', [.2, .35, .55, .75, .65], [.2, .55, .65, .7, .65]], ['T3', [.2, .35, .45, .7, .5], [.4, .35, .45, .8, .5]],
    ['T4', [0, .1, .4, .5, .4], [0, .1, .4, .4, .6]], ['T5', [0, .25, .35, .65, .7], [0, .4, .35, .65, .75]], ['T6', [.1, .35, .25, .45, .75], [.2, .35, .4, .5, .6]]];
  /* Figure 14 (PDF page 22, vector read): Task Progress [pi0.5, LingBot-VA, DreamZero, WALL-SS] */
  const F14 = [['摆杯三角', 47, 20, 25, 53], ['勺入碗', 32, 24, 54, 58], ['套环', 74, 24, 27, 61], ['拣入篮', 67.5, 76, 97.8, 98.5], ['分耳机', 41, 56, 66, 70], ['按形状分类', 55, 30, 36, 80], ['按序按钮', 31, 8, 3, 63], ['平均', 49.7, 34, 44.1, 69.1]];

  const SCENES = [
    { n: 1, part: '总览', title: '一条因果序列：任务、初始画面，然后动作块和画面片段交错', sub: '每个片段只看它左边的一切；右边的未来被屏蔽', dur: 14, cam: [0.0, 1.25, 17.5, [-1.6, 1.6, 0]],
      html: dl([['序列', '𝒯<sub>g</sub>（任务文本）→ O<sub>0</sub>（初始多视角，身份锚点）→ A<sub>1</sub> → V<sub>1</sub> → A<sub>2</sub> → V<sub>2</sub> → …'], ['V<sub>c</sub>', '一个片段的头部 + 两个腕部画面，经冻结视频 VAE 变成离散 token，由粗到细逐尺度生成'], ['A<sub>c</sub>', '这一段的动作块，被渲染成“动作视频”，再按尺度取用'], ['四个好处', '统一表示、长度可变、可流式续写、有 token 对数概率可做 RL']]) +
        '<p>和片段级扩散的区别：扩散一次去噪出“一段”未来，动作只是这段的条件；这里每个片段都是序列里的一步，前面的状态（KV）可以直接复用，往后接多少段都行。</p>' +
        '<p>代价也写在引言里：生成的每个片段都会成为后面的上下文，小错误会累积，还会搞混物体身份和“是哪个动作造成的”。第 6 到 8 幕的记忆和 dream forcing 就是为这个。</p>' + src('§1 · 图 1、图 2(c) · §3.1') },
    { n: 2, part: '§3.2 逐尺度', title: '一个片段怎么生成：先出最粗的 token 图，再一级级补残差', sub: '左边是各级残差，右边是累加到当前级的重建；切换显示', dur: 14, cam: [0.0, 1.2, 16, [-0.4, 2.0, 0]],
      html: dl([['第 ℓ 级', '在前面各级累加重建的基础上，预测这一级的残差码 Z<sub>c,ℓ</sub>'], ['一级内', '所有位置并行预测（VAR 的做法），所以总步数等于级数，不等于 token 数'], ['残差重复 r', '式 (1) 的下标。InfinityStar 把前 12 个“语义尺度”重复 3 次；WALL-SS 没写自己的设置'], ['目标', '式 (1)：平衡的负对数似然，片段、尺度、重复三者均匀平均'], ['多视角', '三路相机同时生成；残差跨视角适配器只交换同步的因果状态']]) +
        '<p>粗尺度决定布局和大物体的位置，细尺度补纹理和边缘。后面两件事都借用这一点：动作只在部分尺度上提供（第 4 幕），老的记忆只留粗尺度（第 6 幕）。</p>' +
        toyb('16 × 16 的“画面”是一个手写函数，尺度表 1、2、4、8、16 是我选的；每一级的残差 = 该级平均池化后的重建减去上一级重建。论文没给尺度表。') + src('§2.2 · §3.2 · 式 (1) · InfinityStar §3') },
    { n: 3, part: '§4.3 动作视频', title: '动作先变成和画面对齐的“动作视频”，再连续编码、按片段切开', sub: '左：末端轨迹经相机投影（式 11）；下：连续特征流按片段区间 J<sub>c</sub> 切片', dur: 15, cam: [0.0, 1.2, 16.5, [-0.4, 1.0, 0]],
      html: dl([['表示', '左右腕位置和朝向写成齐次变换，夹爪开度归一化'], ['投影', 'ũ = K<sub>h</sub> T<sub>h←e</sub> x̃<sub>e</sub>，u = (ũ/w̃, ṽ/w̃)；在相机后方的点屏蔽'], ['渲染', '每帧画末端中心和局部坐标轴；颜色分左右手、编码夹爪；标记大小表示深度'], ['编码', '共享的因果编码器连续处理整条流，再按 RGB 的片段区间 J<sub>c</sub> 切开'], ['尺度', '每个片段的特征在保留的动作尺度 S<sub>A</sub> 上投影，得到 X<sup>A</sup><sub>c,j</sub>']]) +
        '<p>好处：低维控制变成和 RGB 同时间戳、同空间变换、同张量布局的条件。没有有效的标定链就不构造动作视频，样本降级到纯视频池（第 5 幕）。</p>' +
        '<p>渲染器只用给定的控制和标定，从不用实际执行的遥测或目标视频，所以闭环时外部策略给的动作和训练时的动作走同一条路。</p>' +
        toyb('两条末端轨迹、相机内外参都是手写的；投影是页面当场按式 (11) 算的。动作尺度画成 3 行只是示意，S<sub>A</sub> 论文没给。') + src('§3.2 动作-视频对齐 · §4.3 式 (11)') },
    { n: 4, part: '§3.2 掩码', title: '尺度对齐的因果条件：第 ℓ 级只读同片段、同视角的第 κ(ℓ) 级动作', sub: '行是视觉查询 (c, ℓ)，列是文本和动作 token；亮格表示可见', dur: 14, cam: [0.0, 1.25, 14.5, [0.4, 1.9, 0]],
      html: dl([['κ(ℓ)', '不超过 ℓ 的最细保留动作尺度'], ['可见', '文本 + (c, κ(ℓ), v) 这一格动作'], ['屏蔽', '别的视角、相邻片段、未来的控制'], ['不做的事', '不在时间上池化动作，不跨片段混合控制'], ['锚点', '只代表 O<sub>0</sub>，不带任何动作']]) +
        '<p>块对角的意思：把动作 token 按片段排开，每个片段的视觉查询只落在自己那一块上。粗尺度读粗动作，细尺度读细动作，所以动作在由粗到细的每一级都起作用，而不是开头给一次全局提示。</p>' +
        '<p>论文第 6.2 节说视觉对动作的注意力集中在夹爪、被操作物体和交互区附近，并随操作推进移动；没有给图或数字。</p>' +
        guess('图里视觉 5 级、保留动作尺度 S<sub>A</sub> = {1, 3, 5}、3 个片段、1 个视角，都是为了画得下而选的。视觉 token 之间的因果注意力（看历史画面）没有画在这张表里。') + src('§3.2 尺度对齐的因果条件') },
    { n: 5, part: '§4 数据', title: '数据：有可靠标定的进动作条件池，其余只做视频生成', sub: '粒子是样本；介入数据另画一条回滚分支', dur: 14, cam: [0.0, 1.22, 18, [-0.9, 1.0, 0]],
      html: dl([['公开', 'AgiBotWorld-Beta 全量：1,003,672 条轨迹 → 987,508 个带描述的片段（来自 165,560 个源视频）；另加 ManipArena'], ['自采', 'X2-Robot 双臂、手持 UMI（数量未给）'], ['介入', '即时接管；回滚重放：同一情境下一条错误分支、一条人工纠正分支'], ['检查', '视频完整性 → 时间对齐 → 标定与运动学 → 结果感知过滤'], ['统一', '语义子任务切片，10 FPS'], ['路由', '式 (10)：m<sup>cal</sup> = 1 进 D<sub>ac</sub>，否则进 D<sub>vid</sub>']]) +
        '<p>过滤只针对采集错误，不针对任务失败：没抓到、掉落、碰撞、重试都保留。作者的理由是，如果训练集里每次合夹爪后都成功抬起，模型会学会“磁铁式”的抓取。</p>' +
        guess('粒子的比例是随手设的，论文只给了 AgiBot 一部分的数量。') + src('§4.1–4.3 · 图 4 · 式 (10)') },
    { n: 6, part: '§3.3 记忆', title: '时间-尺度记忆：越近留越细，越远留越粗，总量有上限', sub: '切换三种记忆；右上的数是当场算的 token 数', dur: 16, cam: [0.0, 1.2, 17, [0.3, 1.7, 0]],
      html: dl([['记录', 'B<sub>u,s</sub> = (H<sup>pre</sup><sub>u,s</sub>, A<sub>u</sub>)：片段 u 在第 s 个预测前边界的因果状态，配同一区间的动作'], ['调度', '式 (2)：年龄 δ 越大，s(δ) 越小（越粗）；δ ≤ W<sub>M</sub>'], ['锚点', 'H<sup>anc</sup> 只来自 O<sub>0</sub>，一直保留'], ['逐出', '每条记录在最后一次计划读取后丢掉；式 (3)：总量 ≤ B<sub>KV</sub>'], ['变老', '只是改读另一个预先存好的边界，不在线转换 KV']]) +
        '<p>不需要单独的记忆编码器：粗尺度的状态在生成这个片段时本来就算过了，顺手存下即可。</p>' +
        '<p>三种设置对应图 9 的三条线：完整历史 KV（质量参照，随时长增长）、只留最近片段、本文的按尺度压缩。</p>' +
        toyb('每级 token 数 1、4、16、64（累积前缀 1、5、21、85），调度 δ = 1 留 4 级、δ = 2 留 3 级、δ = 3–4 留 2 级、δ = 5–8 留 1 级、δ &gt; 8 逐出，都是我选的。论文没给 S<sub>M</sub>、s(δ)、W<sub>M</sub>、B<sub>KV</sub>。') + src('§3.3 · 式 (2)、(3) · 图 3') },
    { n: 7, part: '§3.3 dream forcing', title: 'Dream forcing：在干净的、被破坏的、自己生成的历史上，都预测干净的下一段', sub: '三行是三个损失；第三行的历史由滞后模型生成并截断梯度', dur: 15, cam: [0.0, 1.22, 16.5, [-0.6, 1.6, 0]],
      html: dl([['L<sub>AR</sub>', '干净历史（教师强制）'], ['L<sub>cor</sub>', '按年龄破坏的记忆 M̃<sub>c</sub> ∼ 𝒞<sub>age</sub>(M<sub>c</sub>)'], ['L<sub>self</sub>', '式 (4)：滞后模型 p<sub>θ̄</sub> 先生成 d 段 Ẑ，经同样的流式转移，sg[·] 后当历史，监督第 c + d 段真值'], ['合起来', '式 (5)：L<sub>long</sub> = L<sub>AR</sub> + λ<sub>cor</sub>L<sub>cor</sub> + λ<sub>self</sub>L<sub>self</sub>'], ['性质', '监督学习，不是奖励优化；目标永远是干净的未来']]) +
        '<p>为什么要：教师强制只见过干净历史，推理时却要吃自己的输出，这是暴露偏差。图 9 里去掉 dream forcing，60 秒时轨迹误差从 0.187 升到 0.486。</p>' +
        '<p>和 RWM、SuperMimic 的自回归训练比：那里梯度穿过整条自生成链；这里自生成的部分截断梯度，只训练“在这种历史下预测下一段”。</p>' +
        guess('破坏的样子（变暗、错位）、d = 2、三行等权，都是画法。论文没写 𝒞<sub>age</sub> 的形式、d、λ 和滞后多少。') + src('§3.3 · 式 (4)、(5) · §5.1') },
    { n: 8, part: '§6.3 图 9', title: '60 秒滚动：dream forcing 和长程记忆缺一不可，完整历史略好但不封顶', sub: '图 9 的矢量读数；切换 (a) 轨迹误差 / (b) 边界误差 / (c) 状态一致性', dur: 14, cam: [0.0, 1.3, 15, [0.0, 1.8, 0]],
      html: dl([['60 s 轨迹误差', '本文 0.187 · 完整历史 0.136 · 无 DF 0.486 · 只留最近 0.816'], ['60 s 边界误差', '0.126 · 0.106 · 0.510 · 0.638'], ['60 s 状态一致性', '0.810 · 0.844 · 0.495 · 0.309'], ['协议', '同一初始观测、同一控制序列；初始化后不回喂真值']]) +
        '<p>完整历史 KV 三项都略好，论文称它是“偏重质量的参照”，记忆和注意力成本随时长增长。论文没有给两者的成本对比，所以有界记忆省了多少，目前没有数。</p>' +
        '<p>第 6.4 节说对齐让边界误差从 0.118 降到 0.104；这两个数和图 9 的曲线不是同一汇总（精读页读者注 14）。</p>' + src('图 9（PDF 第 18 页矢量读数）· §6.3') },
    { n: 9, part: '§3.5 对齐', title: '在策略对齐：动作固定，同一条件采 K 条，组内比较，PPO 更新视觉生成器', sub: '当场算组内优势；切换看 PPO 裁剪', dur: 15, cam: [0.0, 1.22, 17.5, [-0.5, 1.6, 0]],
      html: dl([['策略', 'π<sup>V</sup><sub>θ</sub>(·|ξ<sub>n</sub>) = 𝒮<sub>η</sub>[p<sub>θ</sub>]：每个视觉 token 的选择是一个动作'], ['奖励', '式 (7)：λ<sub>act</sub>R<sub>act</sub> + λ<sub>long</sub>R<sub>long</sub>；不含任务进度和成功'], ['优势', 'G<sub>i,c</sub> = Σ γ<sup>u−c</sup> r<sub>i,u</sub>，在 K 条之间标准化，没有评论家'], ['更新', '式 (8)：PPO 裁剪比值；式 (9)：+ β·KL(π<sub>θ</sub>‖π<sub>ref</sub>) + λ<sub>AR</sub>·真实轨迹回放'], ['结果', '动作跟随 0.264 → 0.290，轨迹精度 0.512 → 0.539，边界误差 0.118 → 0.104']]) +
        '<p>“在策略”只指视觉生成：所有样本用同样的给定控制，机器人控制器不参与。打分器先训好再冻结：动作打分器用平移、倒放、跨轨迹的动作做负例；长时打分器用拼接、漂移、视角不同步的序列做负例。</p>' +
        toyb('K = 4、5 个片段、γ = 0.9、奖励由固定种子生成，组内优势是页面当场按式 (7) 后的公式算的。论文没给 K、γ、ε、β、λ。') + src('§3.5 · 式 (7)–(9) · §5.2 · §6.4') },
    { n: 10, part: '§5.3 / §6.5', title: '流式闭环：同一个外部策略在 WALL-SS 里和真机上各跑一遍', sub: '切换闭环 / 反事实分叉 / 图 12(a) 的 30 个格子', dur: 15, cam: [0.0, 1.22, 17, [0.0, 1.6, 0]],
      html: dl([['闭环', '策略读最新生成的三视角画面和指令 → 动作桥重采样到训练时的控制频率和末端表示 → WALL-SS 生成并提交下一段 → 交回策略'], ['不回喂', '初始化后不注入任何真值；生成器和策略都冻结'], ['分叉', '从同一个已提交状态给不同动作或种子，得到独立的反事实未来（图 7）'], ['评估', '5 个 WALL-WM 检查点 × 6 任务 × 20 初始配置 = 600 对'], ['结果', 'MAE 0.062，r 0.93，两两准确率 0.89，ρ̄ 0.88，平衡准确率 0.88，FPR 0.136']]) +
        '<p>图 12(a) 的 30 个点是矢量读数，从它们直接算出 MAE 0.0617、偏差 +0.0283、斜率 0.844、r 0.926，和论文一致。主要的风险方向是乐观：332 次真机失败里 45 次在模型里成功了，集中在接触和插入阶段。</p>' +
        guess('两个闭环的方块和粒子是示意；分叉的三条路径是手画的。') + src('§5.3 · §6.5 · 图 7、图 12 · 表 3') },
    { n: 11, part: '§3.4 / §6.6', title: '下游：联合训练的动作专家读已提交的状态，直接控制真机', sub: '切换流匹配去噪 / 图 14 真机结果', dur: 14, cam: [0.0, 1.25, 17, [-0.7, 1.6, 0]],
      html: dl([['输入', 'H<sup>A</sup><sub>c</sub> = F<sup>A</sup><sub>ω</sub>(Read<sub>V</sub>(M<sub>c</sub>), E<sub>s</sub>(s<sub>c</sub>), 𝒯<sub>g</sub>)：只读已提交的视觉状态、本体状态和任务'], ['输出', '流匹配：带噪动作槽交叉注意上下文，去噪成下一动作块 A<sub>c</sub>（沿用 WALL-OSS / WALL-OSS-0.5 的动作专家）'], ['训练', '式 (6)：L<sub>long</sub> + λ<sub>A</sub>L<sub>act</sub>，只在成对样本上加动作损失'], ['真机', '7 个任务平均 Task Progress 69.1；π0.5 49.6、DreamZero 44.1、LingBot-VA 34.0'], ['对齐的间接作用', '同样训练动作专家，生成器换成对齐后的版本：64.6 → 69.1']]) +
        '<p>Put Ring onto Rod 一项 π0.5（74）高于 WALL-SS（61）；正文“各任务第一”只对平均成立。严格成功率论文说报告了，但没有给数。</p>' +
        '<p>同一个模型因此有两种用法：动作当输入，它是模拟器；交替“预测动作 → 生成画面 → 提交记忆”，它是会想象的策略。</p>' +
        toyb('去噪轨迹是线性插值的玩具（噪声 → 目标），不是 WALL-SS 的动作专家。柱子是图 14 的矢量读数。') + src('§3.4 · 式 (6) · §6.4 · §6.6 · 图 14') }
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

  /* ---------- toy computations (pure functions of fixed inputs) ---------- */
  /* scene 2: 16x16 image, scales 1,2,4,8,16; residual r_k = up(pool_k f) - up(pool_{k-1} f) */
  const IMG = Array.from({ length: 256 }, (_, i) => { const x = (i % 16) / 15, y = Math.floor(i / 16) / 15; return 0.55 * Math.exp(-((x - 0.3) ** 2 + (y - 0.65) ** 2) / 0.03) + 0.45 * Math.exp(-((x - 0.72) ** 2 + (y - 0.3) ** 2) / 0.012) + 0.25 * Math.sin(9 * x) * Math.sin(7 * y) + 0.2 * y; });
  const SCL = [1, 2, 4, 8, 16];
  function pool(s) { const k = 16 / s, out = []; for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { let a = 0; for (let v = 0; v < k; v++) for (let u = 0; u < k; u++) a += IMG[(j * k + v) * 16 + i * k + u]; out.push(a / (k * k)); } return out; }
  const POOLS = SCL.map(pool);
  const up = (arr, s, i) => { const k = 16 / s, x = Math.floor((i % 16) / k), y = Math.floor(Math.floor(i / 16) / k); return arr[y * s + x]; };
  const RECON = SCL.map((s, k) => Array.from({ length: 256 }, (_, i) => up(POOLS[k], s, i)));
  const RESID = SCL.map((s, k) => POOLS[k].map((v, i) => { if (!k) return v; const ps = SCL[k - 1], x = Math.floor((i % s) / (s / ps)), y = Math.floor(Math.floor(i / s) / (s / ps)); return v - POOLS[k - 1][y * ps + x]; }));
  /* scene 6: token counts per scale and the toy age schedule */
  const PREF = [0, 1, 5, 21, 85];
  const sched = (mode, d) => mode === 1 ? 4 : mode === 2 ? (d === 1 ? 4 : 0) : (d === 1 ? 4 : d === 2 ? 3 : d <= 4 ? 2 : d <= 8 ? 1 : 0);
  const memTok = (mode, c) => { let m = 85; for (let d = 1; d <= c - 1; d++) m += PREF[sched(mode, d)]; return m; };
  /* scene 9: group-relative advantages, K = 4 rollouts, C = 5 clips, gamma = 0.9 */
  const KR = 4, CR = 5, GAM = 0.9;
  const REW = (function () { const r = L.rng(31), q = [0.15, -0.05, 0.05, -0.2]; return Array.from({ length: KR }, (_, i) => Array.from({ length: CR }, (_, c) => clamp(0.6 + q[i] + 0.12 * L.gauss(r) - 0.03 * c * (i === 3 ? 2 : 1), 0, 1))); })();
  const RET = REW.map(rw => rw.map((_, c) => rw.slice(c).reduce((a, v, u) => a + Math.pow(GAM, u) * v, 0)));
  const ADV = (function () { const A = REW.map(() => new Array(CR).fill(0)); for (let c = 0; c < CR; c++) { const g = RET.map(r => r[c]), mu = g.reduce((a, b) => a + b, 0) / KR, sd = Math.sqrt(g.reduce((a, b) => a + (b - mu) ** 2, 0) / KR); for (let i = 0; i < KR; i++) A[i][c] = (g[i] - mu) / (sd + 1e-6); } return A; })();
  /* scene 10: calibration statistics recomputed from the 30 read points */
  const PTS = F12.flatMap(([t, R, G], k) => R.map((r, i) => [r, G[i], k]));
  const STAT = (function () { const n = PTS.length, mx = PTS.reduce((a, p) => a + p[0], 0) / n, my = PTS.reduce((a, p) => a + p[1], 0) / n; let sxy = 0, sxx = 0, syy = 0, mae = 0; PTS.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; mae += Math.abs(y - x); }); const b = sxy / sxx; return { mae: mae / n, bias: my - mx, slope: b, icpt: my - b * mx, r: sxy / Math.sqrt(sxx * syy) }; })();

  /* ---------- 3D helpers (same pattern as interactives/latent, interactives/diffmimic) ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.3, phi: 1.0, dist: 12, maxDist: 120, minDist: 1.5 }); }
  catch (e) { $('nogl').hidden = false; }
  if (!S) { showInfo(0); return; }
  const root = new THREE.Group(); S.scene.add(root);
  let LABS = [], refDist = 12, PICKS = [];
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  function dynLab(G, pos, o = {}) {
    const st = { s: null, t: null };
    return t => { if (t === st.t) return; if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; st.s = lab(t, pos, o); G.add(st.s); };
  }
  function movLab(G, o = {}) {
    const st = { s: null, t: null };
    return (t, pos) => { if (t !== st.t) { if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; st.s = lab(t, pos, o); G.add(st.s); } st.s.position.set(...pos); };
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BALL = new THREE.SphereGeometry(1, 12, 9), CUBE = new THREE.BoxGeometry(1, 1, 1);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: 0.6 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  function ball(color, r, pos, o = {}) { const m = new THREE.Mesh(BALL, L.mat(color, { opacity: o.opacity, emissive: o.emissive })); m.scale.setScalar(r); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.08) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.6, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  function ribbon(G, n, color, w = 0.06, o = {}) {
    const pos = new Float32Array(n * 6), idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: o.opacity ?? 1 })); m.frustumCulled = false; m.renderOrder = o.order ?? 2; G.add(m);
    m.userData.set = pts => { const k = Math.min(n, pts.length); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)], z = q[2] ?? 0; pos[i * 6] = q[0]; pos[i * 6 + 1] = q[1] - w / 2; pos[i * 6 + 2] = z; pos[i * 6 + 3] = q[0]; pos[i * 6 + 4] = q[1] + w / 2; pos[i * 6 + 5] = z; } g.attributes.position.needsUpdate = true; };
    return m;
  }
  function panel(G, x, y, z, w, h, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: o.color ?? 0x0c1220, transparent: true, opacity: o.opacity ?? 0.55, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }
  function bar(G, color, x, w, base = 0, z = 0, o = {}) { const b = block(w, 1, w, color, [x, base + 0.5, z], o); G.add(b); return h => { const hh = Math.max(0.02, h); b.scale.y = hh; b.position.y = base + hh / 2; }; }
  /* sequential and diverging colours for token grids */
  const seqC = v => _C.setHSL(0.72 - 0.55 * clamp(v, 0, 1), 0.65, 0.35 + 0.3 * clamp(v, 0, 1));
  const divC = v => { const a = clamp(Math.abs(v) * 3.2, 0, 1); return v >= 0 ? _C.setRGB(0.25 + 0.7 * a, 0.3 + 0.25 * a, 0.35 - 0.1 * a) : _C.setRGB(0.25 - 0.05 * a, 0.35 + 0.25 * a, 0.4 + 0.55 * a); };

  function buildCtl() {
    const box = $('ctl'); box.innerHTML = ''; box.hidden = true; if (!api) return;
    (api.ctls || []).forEach((c, gi) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-g="${gi}" data-k="${k}" aria-pressed="${c.get() === k}">${t}</button>`).join('');
      box.appendChild(row); box.hidden = false;
    });
  }
  function syncCtl() { (api?.ctls || []).forEach((c, gi) => { $('ctl').querySelectorAll(`button[data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(c.get() === +b.dataset.k))); }); }

  /* a small coarse-to-fine stack used as a "clip" token: three plates, bottom coarse */
  function clipStack(G, x, y, color, o = {}) {
    const g = new THREE.Group(); g.position.set(x, y, 0); G.add(g);
    const pl = [0.42, 0.66, 0.9].map((s, i) => { const b = block(s, 0.12, s, color, [0, i * 0.24, 0], { opacity: o.opacity }); g.add(b); return b; });
    g.userData.pl = pl; return g;
  }

  /* ---------- scene 1: the interleaved causal sequence ---------- */
  function s1(G) {
    const NC = 4, X = c => -3.6 + 2.6 * (c - 1), Y = 1.0;
    const g = block(0.7, 0.7, 0.7, COL.txt, [-8.4, Y + 0.25, 0]); G.add(g);
    const o0 = clipStack(G, -6.6, Y, COL.anc);
    G.add(lab('任务 𝒯_g', [-8.4, Y + 1.15, 0], { size: 15, color: css(COL.txt) }), lab('O₀ 锚点\n（只出现一次）', [-6.6, Y + 1.45, 0], { size: 14, color: css(COL.anc) }));
    const acts = [], vids = [];
    for (let c = 1; c <= NC; c++) {
      const a = block(0.5, 0.5, 0.5, COL.act, [X(c) - 0.95, Y + 0.25, 0]); G.add(a); acts.push(a);
      const v = clipStack(G, X(c), Y, COL.gen); vids.push(v);
      G.add(lab(`A${'₁₂₃₄'[c - 1]}`, [X(c) - 0.95, Y - 0.45, 0], { size: 15, color: css(COL.act) }), lab(`V${'₁₂₃₄'[c - 1]}`, [X(c), Y - 0.45, 0], { size: 15, color: css(COL.gen) }));
    }
    wire(G, [[-9.0, Y - 0.85, 0], [X(NC) + 1.0, Y - 0.85, 0]], 0x9aa6bf, { opacity: 0.6 });
    G.add(lab('时间 →', [X(NC) + 1.2, Y - 1.2, 0], { size: 13 }));
    const mask = panel(G, 0, Y - 0.7, -0.4, 1, 2.2, { color: 0x05070d, opacity: 0.62 });
    const ctx = stream(G, 14, COL.obs, 0.06), cur = dynLab(G, [0.4, 4.1, 0], { size: 15, border: 'rgba(167,139,250,.7)' });
    const futL = lab('未来：被屏蔽', [0, Y + 1.75, 0], { size: 13 }); G.add(futL);
    return { update(p) {
      const k = clamp(p * 1.15, 0, 0.999) * NC, c = Math.floor(k) + 1, f = k - Math.floor(k), sc = Math.min(2, Math.floor(f * 3.2));
      acts.forEach((a, i) => { a.visible = i + 1 <= c; glow(a, i + 1 === c ? 0.5 : 0.08); });
      vids.forEach((v, i) => { v.visible = true; v.userData.pl.forEach((b, j) => { const on = i + 1 < c || (i + 1 === c && j <= sc); b.visible = on; glow(b, i + 1 === c && j === sc ? 0.7 : 0.06); }); });
      const xl = X(c) + 0.6, xr = X(NC) + 1.0; mask.visible = futL.visible = c < NC; mask.scale.x = Math.max(0.01, xr - xl); mask.position.x = xl + (xr - xl) / 2; futL.position.x = xl + (xr - xl) / 2;
      ctx([[-8.4, Y + 0.6, 0.3], [X(c) - 2, Y + 2.0, 0.3], [X(c), Y + 0.6, 0.3]], (p * 5) % 1, 1);
      cur(`正在生成 V${'₁₂₃₄'[c - 1]} 的第 ${sc + 1} 级（${['粗', '中', '细'][sc]}）`);
      cap(`V${'₁₂₃₄'[c - 1]} 的每一级都以“𝒯_g、O₀、A₁…A${'₁₂₃₄'[c - 1]}、V₁…V${'₁₂₃₄'[Math.max(0, c - 2)]}”${c === 1 ? '（还没有画面历史）' : ''}和本片段已生成的更粗级为条件；右边的未来不可见`);
    } };
  }

  /* ---------- scene 2: coarse-to-fine residual pyramid ---------- */
  function s2(G) {
    let v = +(OPT[0] ?? 0);
    const PX = -2.8, CW = 0.16, PYR = [], ims = [];
    let total = 0; SCL.forEach(s => total += s * s);
    const imP = inst(CUBE, total); imP.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3); G.add(imP);
    const imR = inst(CUBE, 256); imR.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(256 * 3), 3); G.add(imR);
    const RX = 1.8, RY = 0.6, RC = 0.24;
    G.add(lab('各级残差 Z_{c,ℓ}（第 1 级在下）', [PX, 4.75, 0], { size: 14 }), lab('累加到当前级的重建', [RX + 1.9, 4.75, 0], { size: 14 }));
    SCL.forEach((s, k) => G.add(lab(`ℓ=${k + 1}  ${s}×${s}`, [PX - 2.15, 0.35 + k * 0.95, 0], { size: 12 })));
    const ttl = dynLab(G, [RX + 1.9, 0.05, 0], { size: 14 });
    const ctls = [{ label: '左侧显示', items: ['残差', '该级累加重建'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      const kk = clamp(Math.floor(seg(p, 0.02, 0.85) * 5.0), 0, 4);
      let n = 0;
      SCL.forEach((s, k) => {
        const size = 2.6 / s, y = 0.35 + k * 0.95;
        for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
          const on = k <= kk, val = v === 0 ? RESID[k][j * s + i] : POOLS[k][j * s + i];
          setI(imP, n, [PX - 1.3 + (i + 0.5) * size, y, -1.3 + (j + 0.5) * size], on ? [size * 0.92, 0.08 + (v === 0 ? Math.abs(val) * 0.5 : 0), size * 0.92] : 0.0001);
          imP.setColorAt(n, v === 0 && k > 0 ? divC(val) : seqC(val)); n++;
        }
      });
      done(imP);
      for (let i = 0; i < 256; i++) { const x = i % 16, y = Math.floor(i / 16); setI(imR, i, [RX + x * RC, RY + (15 - y) * RC, 0], [RC * 0.95, RC * 0.95, 0.08]); imR.setColorAt(i, seqC(RECON[kk][i])); }
      done(imR);
      const err = Math.sqrt(IMG.reduce((a, x, i) => a + (x - RECON[kk][i]) ** 2, 0) / 256);
      ttl(`第 ${kk + 1} 级后，和原图的 RMS 误差 ${err.toFixed(3)}`);
      cap(kk < 2 ? '前几级只有几个 token，定下整体布局和大物体的位置（InfinityStar 把这些“语义尺度”重复几次）' : kk < 4 ? '中间几级补出物体轮廓；每一级的 token 在级内并行预测' : '最细一级补纹理和边缘。整个片段的“步数”是级数，不是 token 数');
    } };
  }

  /* ---------- scene 3: action video and clip slicing ---------- */
  function s3(G) {
    const CAM = new THREE.Vector3(-5.2, 3.6, 3.2), LOOK = new THREE.Vector3(-3.0, 0.9, 0);
    const cz = LOOK.clone().sub(CAM).normalize(), cx = new THREE.Vector3().crossVectors(cz, new THREE.Vector3(0, 1, 0)).normalize(), cy = new THREE.Vector3().crossVectors(cx, cz);
    const F = 1.6;
    const traj = (h, t) => [-3.0 + 1.4 * Math.sin(2 * Math.PI * t * 0.8 + h) * 0.8 + h * 0.6, 0.7 + 0.5 * Math.sin(2 * Math.PI * t * 1.3 + h * 2) * 0.6 + 0.3 * t, -0.6 + 1.2 * t + h * 0.3];
    const N = 60, P = [0, 1].map(h => Array.from({ length: N }, (_, i) => traj(h * 1.8 - 0.9, i / (N - 1))));
    const proj = q => { const d = new THREE.Vector3(...q).sub(CAM), z = d.dot(cz); return { u: F * d.dot(cx) / z, v: F * d.dot(cy) / z, z }; };
    /* robot-space curves and camera */
    const cl = [0xff7a59, 0x59c3ff];
    const rC = P.map((pts, h) => ribbon(G, N, cl[h], 0.05));
    const tips = P.map((_, h) => ball(cl[h], 0.12, [0, 0, 0])); tips.forEach(t => G.add(t));
    const camB = block(0.5, 0.35, 0.35, 0xdfe6f3, [CAM.x, CAM.y, CAM.z]); camB.lookAt(LOOK); G.add(camB);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => wire(G, [[CAM.x, CAM.y, CAM.z], CAM.clone().add(cz.clone().multiplyScalar(2.2)).add(cx.clone().multiplyScalar(a * 1.4)).add(cy.clone().multiplyScalar(b * 1.0)).toArray()], 0xdfe6f3, { opacity: 0.35 }));
    G.add(lab('头部相机 K_h, T_{h←e}', [CAM.x + 1.9, CAM.y + 0.55, CAM.z], { size: 13 }), lab('左右末端轨迹（机器人空间）', [-2.6, 2.75, 0], { size: 13 }));
    /* image plane */
    const IX = 1.6, IY = 1.3, IW = 3.6, IH = 2.6;
    panel(G, IX, IY, -0.05, IW, IH, { color: 0x0a0f1a, opacity: 0.8 });
    G.add(lab('动作视频（主视角像素平面）', [IX + IW / 2, IY + IH + 0.35, 0], { size: 13 }));
    const all = P.flat().map(proj), us = all.map(a => a.u), vs = all.map(a => a.v);
    const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
    const ip = a => [IX + 0.25 + (IW - 0.5) * (a.u - u0) / (u1 - u0), IY + 0.25 + (IH - 0.5) * (a.v - v0) / (v1 - v0), 0.02];
    const iC = P.map((_, h) => ribbon(G, N, cl[h], 0.035, { opacity: 0.7 }));
    const mk = P.map((_, h) => ball(cl[h], 0.1, [0, 0, 0])); mk.forEach(m => G.add(m));
    /* timeline of action features, sliced by clip intervals, three action scales */
    const TX = -6.4, TW = 12.4, TY = -2.0, NCL = 5;
    const rows = [0, 1, 2].map(j => ribbon(G, 120, [0x9a5a2c, 0xc77a3a, 0xf0963c][j], 0.12 + 0.06 * j, { opacity: 0.9 }));
    for (let c = 0; c <= NCL; c++) wire(G, [[TX + TW * c / NCL, TY - 1.15, 0.05], [TX + TW * c / NCL, TY + 0.35, 0.05]], 0xdfe6f3, { opacity: 0.55, dashed: true, dash: 0.12, gap: 0.08 });
    for (let c = 0; c < NCL; c++) G.add(lab(`J${'₁₂₃₄₅'[c]}`, [TX + TW * (c + 0.5) / NCL, TY + 0.65, 0], { size: 13 }));
    ['粗', '中', '细'].forEach((t, j) => G.add(lab(t, [TX - 0.55, TY - j * 0.42, 0], { size: 12 })));
    const hi = panel(G, 0, TY - 1.2, -0.1, TW / NCL, 1.6, { color: 0xf0963c, opacity: 0.12 });
    const eq = dynLab(G, [IX + IW / 2, IY - 0.45, 0], { size: 13 });
    return { update(p) {
      const n = Math.max(2, Math.round(seg(p, 0.02, 0.7) * N));
      P.forEach((pts, h) => { rC[h].userData.set(pts.slice(0, n)); tips[h].position.set(...pts[n - 1]); const pr = pts.slice(0, n).map(proj); iC[h].userData.set(pr.map(ip)); mk[h].position.set(...ip(pr[n - 1])); mk[h].scale.setScalar(0.06 + 0.5 / pr[n - 1].z); });
      const last = proj(P[0][n - 1]); eq(`ũ = K_h T x̃：u = ${last.u.toFixed(3)}, v = ${last.v.toFixed(3)}, 深度 ${last.z.toFixed(2)}`);
      const m = Math.max(2, Math.round(seg(p, 0.1, 0.95) * 120));
      rows.forEach((r, j) => { const pts = []; for (let i = 0; i < m; i++) { const t = i / 119, k = j === 0 ? 1.5 : j === 1 ? 4 : 9; pts.push([TX + TW * t, TY - j * 0.42 + 0.13 * Math.sin(k * 2 * Math.PI * t + j), 0]); } r.userData.set(pts); });
      const cc = Math.min(NCL - 1, Math.floor(seg(p, 0.1, 0.95) * NCL * 0.999)); hi.position.x = TX + TW * (cc + 0.5) / NCL;
      cap(p < 0.7 ? '末端位置按式 (11) 投影到头部相机平面，画成动作视频；标记大小随深度变（近大远小），颜色分左右手' : `动作特征是一条连续的流，按 RGB 的片段区间切开：片段 ${cc + 1} 只拿 J${'₁₂₃₄₅'[cc]} 这一段，不跨片段、不在时间上池化`);
    } };
  }

  /* ---------- scene 4: scale-aligned block-diagonal mask ---------- */
  function s4(G) {
    const NCL = 3, NL = 5, SA = [1, 3, 5], kap = l => SA.filter(j => j <= l).pop();
    const CW = 0.5, X0 = -2.4, Y0 = 0.2, cols = 1 + NCL * SA.length, rowsN = NCL * NL;
    const cell = (r, c) => [X0 + c * CW, Y0 + (rowsN - 1 - r) * CW * 0.62, 0];
    const im = inst(CUBE, rowsN * cols); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(rowsN * cols * 3), 3); G.add(im);
    G.add(lab('𝒯_g', [X0, Y0 + rowsN * CW * 0.62 + 0.15, 0], { size: 13, color: css(COL.txt) }));
    for (let c = 0; c < NCL; c++) { G.add(lab(`片段 ${c + 1} 的动作\nj = 1 · 3 · 5`, [X0 + (1 + c * 3 + 1) * CW, Y0 + rowsN * CW * 0.62 + 0.3, 0], { size: 12, color: css(COL.act) })); }
    for (let c = 0; c < NCL; c++) G.add(lab(`片段 ${c + 1}\nℓ = 1…5`, [X0 - 1.3, Y0 + (rowsN - 1 - (c * NL + 2)) * CW * 0.62, 0], { size: 12, color: css(COL.gen) }));
    const cursor = block(cols * CW + 0.2, CW * 0.62, 0.06, 0xa78bfa, [0, 0, -0.08], { opacity: 0.35 }); G.add(cursor);
    const info = dynLab(G, [5.6, 2.9, 0], { size: 14, border: 'rgba(167,139,250,.7)' });
    G.add(lab('κ(ℓ)：ℓ=1,2 → 1\nℓ=3,4 → 3；ℓ=5 → 5', [5.6, 1.3, 0], { size: 13 }));
    return { update(p) {
      const r = Math.min(rowsN - 1, Math.floor(seg(p, 0.02, 0.92) * rowsN)), qc = Math.floor(r / NL), ql = r % NL + 1;
      let n = 0;
      for (let i = 0; i < rowsN; i++) for (let c = 0; c < cols; c++) {
        const rc = Math.floor(i / NL), rl = i % NL + 1;
        let ok = c === 0; if (c > 0) { const cc = Math.floor((c - 1) / 3), j = SA[(c - 1) % 3]; ok = cc === rc && j === kap(rl); }
        const isCur = i === r;
        setI(im, n, cell(i, c), [CW * 0.86, CW * 0.55, ok ? (isCur ? 0.4 : 0.18) : 0.06]);
        im.setColorAt(n, ok ? (c === 0 ? _C.setHex(COL.txt) : (isCur ? _C.setHex(0xffc27a) : _C.setHex(COL.act))) : _C.setHex(isCur ? 0x3a3550 : 0x1c2233)); n++;
      }
      done(im);
      const [cx0, cy0] = cell(r, (cols - 1) / 2); cursor.position.set(cx0, cy0, -0.08);
      info(`查询 (c=${qc + 1}, ℓ=${ql})\n可见：𝒯_g + 片段 ${qc + 1} 的 j=${kap(ql)}`);
      cap(`块对角：片段 ${qc + 1} 第 ${ql} 级只读本片段的第 κ(${ql}) = ${kap(ql)} 级动作；别的片段（包括未来的）和别的视角一律屏蔽`);
    } };
  }

  /* ---------- scene 5: data sources and routing ---------- */
  function s5(G) {
    const SRC = [['AgiBotWorld-Beta\n987,508 片段', 0x7cb8ff], ['ManipArena', 0x7cb8ff], ['X2-Robot 自采', 0x4fc98a], ['UMI 手持', 0x4fc98a], ['介入 / 回滚', 0xe0607a]];
    const sx = -6.2, ys = i => 3.6 - i * 1.0;
    SRC.forEach(([t, c], i) => { G.add(block(0.5, 0.5, 0.5, c, [sx, ys(i), 0])); G.add(lab(t, [sx - 1.7, ys(i), 0], { size: 12 })); });
    const CH = ['完整性', '时间对齐', '标定与运动学', '结果感知过滤'], cxs = i => -3.0 + i * 1.35;
    const gates = CH.map((t, i) => { const b = block(0.35, 1.8, 0.6, 0x9aa6bf, [cxs(i), 1.6, 0], { opacity: 0.75 }); G.add(b); G.add(lab(t, [cxs(i), 2.95 + (i % 2) * 0.4, 0], { size: 12 })); return b; });
    const ac = block(1.4, 1.0, 1.0, COL.act, [3.9, 2.7, 0]), vid = block(1.4, 1.0, 1.0, COL.obs, [3.9, 0.3, 0]); G.add(ac, vid);
    G.add(lab('D_ac：视频 + 动作 + 语言\n未来预测 · 视频生成 · 价值估计', [3.9, 3.95, 0], { size: 12, color: css(COL.act) }), lab('D_vid：视频 + 语言\n只做视频生成', [3.9, -0.85, 0], { size: 12, color: css(COL.obs) }));
    G.add(lab('10 FPS 语义片段', [1.6, 1.75, 0], { size: 12 }));
    const st = SRC.map((_, i) => stream(G, 5, SRC[i][1], 0.07));
    const toAc = stream(G, 8, COL.act, 0.08), toVid = stream(G, 5, COL.obs, 0.08), drop = stream(G, 3, COL.bad, 0.07);
    G.add(lab('采集错误：剔除', [-1.2, -0.55, 0], { size: 12, color: css(COL.bad) }));
    /* rollback inset */
    const BX = -5.6, BY = -2.4;
    wire(G, [[BX, BY, 0], [BX + 2.0, BY, 0]], 0xdfe6f3, { opacity: 0.8 });
    const bad = ribbon(G, 30, COL.bad, 0.06), good = ribbon(G, 30, COL.ok, 0.06);
    G.add(lab('回滚点', [BX + 2.0, BY - 0.4, 0], { size: 12 }), lab('策略的错误分支', [BX + 4.5, BY - 0.95, 0], { size: 12, color: css(COL.bad) }), lab('人工纠正分支', [BX + 4.5, BY + 0.95, 0], { size: 12, color: css(COL.ok) }));
    return { update(p) {
      const ph = (p * 3) % 1;
      st.forEach((f, i) => f([[sx + 0.3, ys(i), 0], [cxs(0) - 0.4, 1.6, 0]], ph, 1));
      toAc([[cxs(3) + 0.3, 1.6, 0], [3.1, 2.7, 0]], ph, 1); toVid([[cxs(2) + 0.3, 1.2, 0], [3.1, 0.3, 0]], ph, 1); drop([[cxs(1), 0.7, 0], [cxs(1) + 0.4, -0.3, 0]], ph, 1);
      gates.forEach((g, i) => glow(g, Math.floor(p * 8) % 4 === i ? 0.5 : 0.05));
      const m = Math.max(2, Math.round(seg(p, 0.1, 0.8) * 30));
      bad.userData.set(Array.from({ length: m }, (_, i) => { const t = i / 29; return [BX + 2.0 + 2.2 * t, BY - 0.7 * t * t, 0]; }));
      good.userData.set(Array.from({ length: m }, (_, i) => { const t = i / 29; return [BX + 2.0 + 2.2 * t, BY + 0.7 * Math.sin(Math.PI / 2 * t), 0]; }));
      cap(p < 0.5 ? '缺标定的样本不丢：只要视频有效就进 D_vid，贡献视觉动力学和语言对齐，但不带可能错位的动作条件' : '回滚重放：同一情境、两种控制、两种结果。模型没法只靠场景和任务先验解释两条分支，必须读动作');
    } };
  }

  /* ---------- scene 6: time-scale memory ---------- */
  function s6(G) {
    let mode = +(OPT[0] ?? 0);
    const NC = 14, X = u => -6.4 + 0.88 * u, Y = 0.3, LH = 0.34;
    const cols = [];
    for (let u = 0; u <= NC; u++) {
      const vis = [0, 1, 2, 3].map(s => { const b = block(0.62 - 0.08 * (3 - s) * 0, 0.26, 0.5, u === 0 ? COL.anc : COL.gen, [X(u), Y + s * LH, 0]); G.add(b); return b; });
      const a = u === 0 ? null : block(0.36, 0.18, 0.36, COL.act, [X(u), Y - 0.42, 0]); if (a) G.add(a);
      cols.push({ vis, a });
    }
    G.add(lab('锚点 O₀', [X(0), Y + 1.75, 0], { size: 13, color: css(COL.anc) }), lab('视觉 KV：下 → 上 = 粗 → 细', [X(5), Y + 2.35, 0], { size: 13 }), lab('动作 KV', [X(0) - 0.2, Y - 0.42, 0], { size: 12, color: css(COL.act) }));
    const now = dynLab(G, [0, Y - 1.1, 0], { size: 13, border: 'rgba(167,139,250,.7)' });
    const meter = dynLab(G, [-3.0, 3.7, 0], { size: 14, border: 'rgba(79,201,138,.7)' });
    /* memory-vs-clip mini chart */
    const MX = 1.2, MY = 2.3, MW = 4.4, MH = 1.7, mx = c => MX + MW * (c - 1) / (NC - 1), my = v => MY + MH * v / memTok(1, NC);
    panel(G, MX - 0.25, MY - 0.3, -0.05, MW + 0.5, MH + 0.55);
    const lines = [0, 1, 2].map(k => ribbon(G, NC, [COL.mem, 0x9aa6bf, COL.bad][k], 0.04));
    G.add(lab('记忆 token 数 vs 片段数（玩具）', [MX + MW / 2, MY + MH + 0.45, 0], { size: 12 }), lab('完整历史', [MX + MW + 0.75, my(memTok(1, NC)), 0], { size: 11 }), lab('压缩 / 只留最近', [MX + MW + 1.0, my(memTok(0, NC)) + 0.05, 0], { size: 11, color: css(COL.mem) }));
    const ctls = [{ label: '记忆', items: ['按尺度压缩（本文）', '完整历史 KV', '只留最近片段'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const c = Math.max(2, Math.min(NC, 2 + Math.floor(seg(p, 0.02, 0.9) * (NC - 1))));
      cols.forEach((col, u) => {
        if (u === 0) { col.vis.forEach(b => { b.visible = true; glow(b, 0.15); }); return; }
        const d = c - u, keep = u < c ? sched(mode, d) : (u === c ? 4 : 0);
        col.vis.forEach((b, s) => { b.visible = s < keep; glow(b, u === c ? 0.6 : 0.05); b.material.opacity = 1; });
        if (col.a) { col.a.visible = keep > 0; glow(col.a, u === c ? 0.5 : 0.05); }
      });
      now(`正在生成片段 ${c}`);
      meter(`记忆 ${memTok(mode, c)} token（玩具）\n完整历史会是 ${memTok(1, c)}`);
      [0, 1, 2].forEach(k => lines[k].userData.set(Array.from({ length: c - 1 }, (_, i) => [mx(i + 2), my(memTok(k, i + 2)), 0.02])));
      cap(mode === 0 ? '上一片段留 4 级，再早留 3、2、1 级，超过 8 段就逐出；记忆很快封顶，而锚点一直保留身份和布局' : mode === 1 ? '完整历史：每段都留全部 4 级，记忆和注意力随时长线性增长（图 9 里它略好，但不封顶）' : '只留最近片段：记忆最小，可远处的状态全丢了；图 9 里 60 秒时轨迹误差 0.816');
    } };
  }

  /* ---------- scene 7: dream forcing ---------- */
  function s7(G) {
    const R = [['L_AR · 干净历史', 0], ['L_cor · 按年龄破坏', 1], ['L_self · 自生成后缀', 2]], Y = r => 3.4 - r * 1.7, X = i => -4.3 + i * 1.3;
    const tgt = [], hist = [];
    R.forEach(([t, r]) => {
      G.add(lab(t, [-6.6, Y(r) + 0.05, 0], { size: 13 }));
      const row = [];
      for (let i = 0; i < 4; i++) {
        const self = r === 2 && i >= 2, b = block(0.8, 0.55, 0.55, self ? COL.sg : COL.obs, [X(i), Y(r), 0]); G.add(b); row.push(b);
      }
      hist.push(row);
      const m = block(0.9, 0.7, 0.7, 0x2c3550, [X(4) + 0.4, Y(r), 0]); G.add(m); G.add(lab('p_θ', [X(4) + 0.4, Y(r) + 0.6, 0], { size: 12 }));
      const tg = block(0.8, 0.55, 0.55, COL.gt, [X(5) + 0.6, Y(r), 0]); G.add(tg); tgt.push(tg);
      wire(G, [[X(3) + 0.45, Y(r), 0], [X(4) - 0.05, Y(r), 0]], 0xdfe6f3, { opacity: 0.7 }); wire(G, [[X(4) + 0.85, Y(r), 0], [X(5) + 0.15, Y(r), 0]], 0xdfe6f3, { opacity: 0.7 });
    });
    G.add(lab('干净的真值\nZ^gt_{c+d}', [X(5) + 0.6, Y(0) + 0.95, 0], { size: 12, color: css(COL.gt) }));
    const lag = block(0.9, 0.6, 0.6, COL.sg, [X(2.5), Y(2) - 1.25, 0], { opacity: 0.85 }); G.add(lag);
    G.add(lab('滞后模型 p_θ̄（不更新）', [X(2.5) + 2.3, Y(2) - 1.25, 0], { size: 12, color: css(COL.sg) }));
    const cut = block(0.08, 0.95, 0.4, COL.bad, [X(3) + 0.68, Y(2), 0]); G.add(cut); G.add(lab('sg', [X(3) + 0.68, Y(2) + 0.7, 0], { size: 12, color: css(COL.bad) }));
    const gen = stream(G, 6, COL.sg, 0.07), back = [0, 1, 2].map(() => stream(G, 7, 0xf0963c, 0.07));
    const tot = dynLab(G, [X(2), 4.6, 0], { size: 14, border: 'rgba(242,193,78,.7)' });
    return { update(p) {
      const r = L.rng(3);
      hist[1].forEach((b, i) => { const age = 3 - i, j = (Math.sin(p * 40 + i * 2) * 0.5 + 0.5) * age * 0.05; b.position.set(X(i) + j, Y(1) + j * 0.6, 0); b.material.opacity = 1; glow(b, 0); b.material.color.setHex(age >= 2 ? 0x2f5f80 : COL.obs); b.rotation.z = age * 0.08 * Math.sin(p * 9 + i); });
      const gshow = seg(p, 0.05, 0.4);
      hist[2].forEach((b, i) => { if (i >= 2) { b.visible = gshow > (i - 2) * 0.5; glow(b, 0.3); } });
      gen([[X(2.5), Y(2) - 0.95, 0], [X(2), Y(2) - 0.3, 0], [X(3), Y(2) - 0.3, 0]], (p * 4) % 1, p < 0.45 ? 1 : 0);
      back.forEach((f, k) => f(k === 2 ? [[X(5) + 0.2, Y(k) - 0.35, 0], [X(4) + 0.4, Y(k) - 0.35, 0], [X(3) + 0.9, Y(k) - 0.35, 0]] : [[X(5) + 0.2, Y(k) - 0.35, 0], [X(4) + 0.4, Y(k) - 0.35, 0], [X(0), Y(k) - 0.35, 0]], (1 - (p * 3) % 1), p > 0.45 ? 1 : 0));
      tgt.forEach(t => glow(t, p > 0.45 ? 0.5 : 0.1));
      tot('L_long = L_AR + λ_cor L_cor + λ_self L_self');
      cap(p < 0.45 ? '第三行：滞后模型先用和推理相同的流式转移生成 d 段，当作历史；它们来自模型自己，带着推理时会出现的那种误差' : '三行都预测同一段干净真值。橙色是梯度：前两行能回到历史编码，第三行在 sg 处停下，只训练“在这种历史下怎么接”');
    } };
  }

  /* ---------- scene 8: Figure 9 ---------- */
  function s8(G) {
    let v = +(OPT[0] ?? 0);
    const X0 = -5.6, XW = 9.5, Y0 = 0.0, YH = 3.8;
    panel(G, X0 - 0.6, Y0 - 0.75, -0.05, XW + 1.2, YH + 1.5);
    const SER = [['Ours', '本文（时间-尺度）', 0xa78bfa, 0.07], ['full', '完整历史 KV', 0xdfe6f3, 0.04], ['wodf', '不做 dream forcing', 0xf0963c, 0.04], ['recent', '只留最近片段', 0xe05d5d, 0.04]];
    const rb = SER.map(([k, , c, w]) => ribbon(G, 25, c, w));
    const tags = SER.map(([k, n, c]) => movLab(G, { size: 12, color: css(c) }));
    const yl = [0, 1, 2, 3, 4].map(i => dynLab(G, [X0 - 0.35, Y0 + YH * i / 4, 0], { size: 11 }));
    [0, 15, 30, 45, 60].forEach(t => G.add(lab(`${t}s`, [X0 + XW * t / 60, Y0 - 0.35, 0], { size: 11 })));
    for (let i = 0; i <= 4; i++) wire(G, [[X0, Y0 + YH * i / 4, 0], [X0 + XW, Y0 + YH * i / 4, 0]], 0x5a6680, { opacity: 0.35 });
    const ttl = dynLab(G, [X0 + XW / 2, Y0 + YH + 0.45, 0], { size: 14 });
    const R = { a: [0, 1.0], b: [0, 0.8], c: [0.2, 1.0] }, T = { a: '(a) 末端轨迹误差 ↓', b: '(b) 跨片段边界误差 ↓', c: '(c) 持久状态一致性 ↑' };
    const ctls = [{ label: '小图', items: ['(a) 轨迹', '(b) 边界', '(c) 状态'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      const k = 'abc'[v], [lo, hi] = R[k], sy = y => Y0 + YH * (y - lo) / (hi - lo), m = Math.max(2, Math.round(seg(p, 0.03, 0.8) * 25));
      SER.forEach(([s], i) => { const d = F9[k][s]; rb[i].userData.set(d.slice(0, m).map((y, j) => [X0 + XW * j / 24, sy(y), 0.02 + 0.01 * i])); });
      const ends = SER.map(([s]) => F9[k][s][m - 1]), order = ends.map((e, i) => [e, i]).sort((a, b) => b[0] - a[0]);
      let last = 99; order.forEach(([e, i]) => { const y = Math.min(sy(e), last - 0.42); last = y; tags[i](`${SER[i][1]} ${e.toFixed(3)}`, [X0 + XW + 1.7, y, 0]); });
      yl.forEach((f, i) => f((lo + (hi - lo) * i / 4).toFixed(2)));
      ttl(T[k] + '（图 9 矢量读数）');
      cap(v === 0 ? '60 秒时：本文 0.187，完整历史 0.136，不做 dream forcing 0.486，只留最近 0.816' : v === 1 ? '边界误差衡量提交下一片段时的跳变：0.126 / 0.106 / 0.510 / 0.638' : '状态一致性：0.810 / 0.844 / 0.495 / 0.309。四条线都从同一点 0.934 出发');
    } };
  }

  /* ---------- scene 9: on-policy alignment ---------- */
  function s9(G) {
    let v = +(OPT[0] ?? 0);
    const A = new THREE.Group(), B = new THREE.Group(); G.add(A, B);
    const cond = block(1.0, 1.0, 0.6, COL.anc, [-7.2, 1.8, 0]); A.add(cond); A.add(lab('固定条件\nO₀, g, A₁:C', [-7.2, 2.95, 0], { size: 12 }));
    const beh = block(1.0, 0.8, 0.6, COL.gen, [-5.5, 1.8, 0]); A.add(beh); A.add(lab('π_θold\n（刚冻结）', [-5.5, 2.85, 0], { size: 12 }));
    const RX = c => -3.6 + c * 0.75, RY = i => 3.2 - i * 0.95;
    const cubes = [];
    for (let i = 0; i < KR; i++) { A.add(lab(`第 ${i + 1} 条`, [RX(0) - 0.85, RY(i), 0], { size: 11 })); for (let c = 0; c < CR; c++) { const hue = REW[i][c]; const b = block(0.55, 0.55, 0.3, COL.obs, [RX(c), RY(i), 0]); A.add(b); cubes.push([b, i, c]); } }
    const scr = block(0.9, 2.6, 0.6, 0x9aa6bf, [0.8, 1.8, 0]); A.add(scr); A.add(lab('冻结打分器\nR_act + R_long', [0.8, 3.55, 0], { size: 12 }));
    const AX = c => 2.4 + c * 0.6;
    const adv = []; for (let i = 0; i < KR; i++) for (let c = 0; c < CR; c++) { const b = block(0.36, 1, 0.3, COL.ok, [AX(c), RY(i), 0]); A.add(b); adv.push([b, i, c]); }
    A.add(lab('组内标准化的优势 Â_{i,c}', [AX(2), 4.05, 0], { size: 12 }));
    const reg = dynLab(A, [AX(2), -0.85, 0], { size: 12 });
    const fl = stream(A, 10, 0xdfe6f3, 0.06);
    A.add(lab('+ β·KL(π_θ ‖ π_ref) + λ_AR·L_AR^real', [-3.0, -0.85, 0], { size: 12 }));
    /* B: PPO clip curves */
    const PX = -4.2, PW = 7.5, PY = 0.2, PH = 3.6, rx = r => PX + PW * (r - 0.4) / 1.2, ry = y => PY + PH * (y + 1.6) / 3.2;
    panel(B, PX - 0.4, PY - 0.6, -0.05, PW + 0.8, PH + 1.2);
    wire(B, [[PX, ry(0), 0], [PX + PW, ry(0), 0]], 0x9aa6bf, { opacity: 0.6 }); [0.8, 1.0, 1.2].forEach(r => { wire(B, [[rx(r), PY, 0], [rx(r), PY + PH, 0]], 0x5a6680, { opacity: 0.4, dashed: r !== 1 }); B.add(lab(`ρ=${r}`, [rx(r), PY - 0.3, 0], { size: 11 })); });
    const cp = ribbon(B, 60, COL.ok, 0.06), cn = ribbon(B, 60, COL.bad, 0.06);
    B.add(lab('Â = +1：ρ 超过 1+ε 后不再加分', [rx(1.45), ry(1.5), 0], { size: 12, color: css(COL.ok) }), lab('Â = −1：ρ 低于 1−ε 后不再加分', [rx(0.75), ry(-1.35), 0], { size: 12, color: css(COL.bad) }));
    B.add(lab('min(ρÂ, clip(ρ, 1−ε, 1+ε)Â)，ε = 0.2（玩具）', [PX + PW / 2, PY + PH + 0.35, 0], { size: 13 }));
    const ctls = [{ label: '看', items: ['K 条滚动和优势', 'PPO 裁剪'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      A.visible = v === 0; B.visible = v === 1;
      if (v === 0) {
        const sh = seg(p, 0.05, 0.4), sc = seg(p, 0.45, 0.85);
        cubes.forEach(([b, i, c]) => { b.visible = sh * CR > c; const q = REW[i][c]; b.material.color.setHSL(0.55 - 0.25 * (1 - q), 0.6, 0.35 + 0.25 * q); glow(b, 0); });
        adv.forEach(([b, i, c]) => { const a = ADV[i][c], h = Math.abs(a) * 0.42 * sc; b.scale.y = Math.max(0.02, h); b.position.y = RY(i) + (a >= 0 ? h / 2 : -h / 2); b.material.color.setHex(a >= 0 ? COL.ok : COL.bad); b.visible = sc > 0.01; });
        glow(scr, sh > 0.95 && sc < 0.05 ? 0.4 : 0.05);
        fl([[-6.9, 1.8, 0.4], [-5.5, 1.8, 0.4], [RX(0), 1.8, 0.4], [0.8, 1.8, 0.4], [AX(2), 1.8, 0.4]], (p * 3) % 1, 1);
        const best = ADV.map((r, i) => [r[0], i]).sort((a, b) => b[0] - a[0])[0][1];
        reg(`片段 1：第 ${best + 1} 条优势最高（${ADV[best][0].toFixed(2)}），每列和为 0`);
        cap(sc < 0.05 ? '同一个已提交状态、同一串动作，采 K 条视觉未来；冻结打分器只看“动作跟上没有”和“长时一致不一致”' : '回报在 K 条之间标准化，高于组平均的 token 概率被推高，低于的被压低；不需要评论家');
      } else {
        const m = Math.max(2, Math.round(seg(p, 0.05, 0.8) * 60)), e = 0.2;
        const f = (r, a) => Math.min(r * a, clamp(r, 1 - e, 1 + e) * a);
        cp.userData.set(Array.from({ length: m }, (_, i) => { const r = 0.4 + 1.2 * i / 59; return [rx(r), ry(f(r, 1)), 0.02]; }));
        cn.userData.set(Array.from({ length: m }, (_, i) => { const r = 0.4 + 1.2 * i / 59; return [rx(r), ry(f(r, -1)), 0.02]; }));
        cap('式 (8) 的裁剪让一次更新不会把某个 token 的概率比推得太远；式 (9) 再加参考模型 KL 和真实轨迹回放，作者说外观指标因此不变');
      }
    } };
  }

  /* ---------- scene 10: closed loop, counterfactual fork, calibration ---------- */
  function s10(G) {
    let v = +(OPT[0] ?? 0);
    const A = new THREE.Group(), B = new THREE.Group(), C = new THREE.Group(); G.add(A, B, C);
    /* A: two loops */
    const loop = (ox, title, nodes, cols) => {
      A.add(lab(title, [ox, 4.4, 0], { size: 14 }));
      const P = [[ox - 1.8, 3.0], [ox + 1.8, 3.0], [ox + 1.8, 0.4], [ox - 1.8, 0.4]];
      const bx = nodes.map((t, i) => { const b = block(1.5, 0.8, 0.6, cols[i], [P[i][0], P[i][1], 0]); A.add(b); A.add(lab(t, [P[i][0], P[i][1] + (i < 2 ? 0.75 : -0.75), 0], { size: 12 })); return b; });
      const s = stream(A, 12, 0xdfe6f3, 0.06);
      return { bx, run: ph => s([...P.map(q => [q[0], q[1], 0.4]), [P[0][0], P[0][1], 0.4]], ph, 1) };
    };
    const L1 = loop(-4.2, 'WALL-SS 里', ['外部策略（冻结）', '动作桥', 'WALL-SS 生成并提交', '三视角画面 Ô'], [COL.pol, COL.act, COL.gen, COL.obs]);
    const L2 = loop(4.2, '真机上', ['同一个策略', '控制器', '真实机器人', '相机画面 O'], [COL.pol, COL.act, 0x9aa6bf, COL.obs]);
    A.add(lab('比较：成功率校准 · 检查点排序 · 回合一致性', [0, -1.35, 0], { size: 13 }));
    /* B: counterfactual fork */
    const root = block(0.9, 0.9, 0.9, COL.gen, [-5.5, 1.8, 0]); B.add(root); B.add(lab('同一个已提交状态', [-5.5, 2.85, 0], { size: 13 }));
    const fk = [0, 1, 2].map(k => ribbon(B, 40, [0x59c3ff, 0xf0963c, 0x4fc98a][k], 0.07));
    const fl = [0, 1, 2].map(k => B.add(lab(`动作条件 ${k + 1}`, [5.6, 3.4 - k * 1.6, 0], { size: 12, color: css([0x59c3ff, 0xf0963c, 0x4fc98a][k]) })));
    /* C: Figure 12(a) */
    const X0 = -3.2, W = 5.6, Y0 = -0.3, H = 4.6, sx = x => X0 + W * x, sy = y => Y0 + H * y;
    panel(C, X0 - 0.5, Y0 - 0.6, -0.05, W + 1.0, H + 1.0);
    [0, 0.5, 1].forEach(t => { C.add(lab(t.toFixed(1), [sx(t), Y0 - 0.32, 0], { size: 11 })); C.add(lab(t.toFixed(1), [X0 - 0.3, sy(t), 0], { size: 11 })); wire(C, [[sx(t), Y0, 0], [sx(t), Y0 + H, 0]], 0x5a6680, { opacity: 0.3 }); wire(C, [[X0, sy(t), 0], [X0 + W, sy(t), 0]], 0x5a6680, { opacity: 0.3 }); });
    wire(C, [[sx(0), sy(0), 0.01], [sx(1), sy(1), 0.01]], 0x9aa6bf, { dashed: true, opacity: 0.8 });
    wire(C, [[sx(0), sy(STAT.icpt), 0.01], [sx(1), sy(STAT.icpt + STAT.slope), 0.01]], 0xa78bfa, { opacity: 1 });
    C.add(lab('真机成功率 →', [sx(0.5), Y0 - 0.65, 0], { size: 12 }), lab('生成成功率 ↑', [X0 - 0.4, sy(1) + 0.45, 0], { size: 12 }));
    const TC = [0x59c3ff, 0xf0963c, 0x4fc98a, 0xe05d9a, 0xf2c14e, 0xa78bfa];
    const dots = PTS.map(([x, y, k], i) => { const dup = PTS.slice(0, i).filter(q => q[0] === x && q[1] === y).length; const b = ball(TC[k], 0.09, [sx(x) + dup * 0.13, sy(y), 0.05]); C.add(b); return b; });
    TC.forEach((c, k) => C.add(lab(`T${k + 1}`, [X0 + W + 0.9, Y0 + H - k * 0.42, 0], { size: 11, color: css(c) })));
    const st = dynLab(C, [X0 + W + 2.7, Y0 + 1.0, 0], { size: 12, border: 'rgba(167,139,250,.7)' });
    const ctls = [{ label: '看', items: ['闭环', '反事实分叉', '图 12(a)'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      A.visible = v === 0; B.visible = v === 1; C.visible = v === 2;
      if (v === 0) {
        L1.run((p * 2) % 1); L2.run((p * 2) % 1);
        const k = Math.floor((p * 8) % 4); L1.bx.forEach((b, i) => glow(b, i === k ? 0.5 : 0.05)); L2.bx.forEach((b, i) => glow(b, i === k ? 0.5 : 0.05));
        cap('初始化后两边都不再看真值：WALL-SS 一侧，策略看到的是模型自己生成的画面。600 对里 527 对结果一致');
      } else if (v === 1) {
        const m = Math.max(2, Math.round(seg(p, 0.05, 0.85) * 40));
        fk.forEach((r, k) => r.userData.set(Array.from({ length: m }, (_, i) => { const t = i / 39; return [-5.0 + 10.2 * t, 1.8 + (1.6 - 1.6 * k) * Math.sin(Math.PI / 2 * Math.min(1, t * 1.6)) + 0.2 * Math.sin(6 * t + k), 0]; })));
        cap('从同一个已提交状态分叉，只换动作（或种子）。图 7 用这种方式展示：生成的末端轨迹（橙）跟着各自给定的轨迹（蓝）走');
      } else {
        const m = Math.round(seg(p, 0.05, 0.7) * 30); dots.forEach((d, i) => { d.visible = i < m; });
        st(`30 个点当场算：\nMAE ${STAT.mae.toFixed(4)}\n偏差 +${STAT.bias.toFixed(4)}\n斜率 ${STAT.slope.toFixed(3)}，截距 ${STAT.icpt.toFixed(3)}\nr ${STAT.r.toFixed(3)}`);
        cap('图 12(a) 的 30 个点（矢量读数，都是 0.05 的倍数）。紫线是拟合，虚线是 y = x；弱检查点被高估，斜率 0.84 &lt; 1');
      }
    } };
  }

  /* ---------- scene 11: action expert and real robot ---------- */
  function s11(G) {
    let v = +(OPT[0] ?? 0);
    const A = new THREE.Group(), B = new THREE.Group(); G.add(A, B);
    const mem = [0, 1, 2, 3].map(i => { const b = block(0.5, 0.3 + 0.18 * i, 0.5, COL.gen, [-7.2 + i * 0.6, 1.2 + (0.3 + 0.18 * i) / 2, 0]); A.add(b); return b; });
    A.add(lab('已提交的记忆 Read_V(M_c)\n+ 本体 s_c + 任务', [-6.3, 2.8, 0], { size: 12 }));
    const ex = block(1.3, 1.1, 0.7, COL.pol, [-3.2, 1.6, 0]); A.add(ex); A.add(lab('动作专家\n（流匹配）', [-3.2, 2.75, 0], { size: 12, color: css(COL.pol) }));
    const N = 16, tgt = Array.from({ length: N }, (_, i) => { const t = i / (N - 1); return [-1.2 + 4.6 * t, 1.4 + 1.1 * Math.sin(Math.PI * t) - 0.4 * t, 0]; });
    const noise = (function () { const r = L.rng(9); return tgt.map(q => [q[0] + 0.5 * L.gauss(r), q[1] + 0.7 * L.gauss(r), 0]); })();
    const dots = tgt.map(() => { const b = ball(COL.act, 0.09, [0, 0, 0]); A.add(b); return b; });
    const rib = ribbon(A, N, COL.act, 0.04, { opacity: 0.6 });
    const tl = dynLab(A, [1.1, 3.4, 0], { size: 13 });
    const arm = L.arm(0x9aa6bf); arm.scale.setScalar(0.5); arm.position.set(5.6, -0.2, 0); A.add(arm);
    A.add(lab('真机执行 A_c', [5.6, 3.3, 0], { size: 12 }));
    const fl = stream(A, 8, 0xdfe6f3, 0.06);
    /* B: Figure 14 bars */
    const NM = ['π0.5', 'LingBot-VA', 'DreamZero', 'WALL-SS'], CC = [0x9aa6bf, 0x59c3ff, 0xf0963c, 0xa78bfa];
    B.add(lab('图 14：Task Progress（矢量读数）', [0, 4.6, 0], { size: 14 }));
    const bars = F14.map(([t, ...vals], k) => { const x = -6.6 + k * 1.75; B.add(lab(t, [x + 0.4, -0.35 - (k % 2) * 0.35, 0], { size: 11 })); return vals.map((val, j) => [bar(B, CC[j], x + j * 0.27, 0.24), val]); });
    NM.forEach((n, j) => B.add(lab(n, [-5.6 + j * 2.4, 4.05, 0], { size: 12, color: css(CC[j]) })));
    const ctls = [{ label: '看', items: ['动作专家', '图 14 真机'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      A.visible = v === 0; B.visible = v === 1;
      if (v === 0) {
        const t = seg(p, 0.1, 0.75), pts = tgt.map((q, i) => [L.lerp(noise[i][0], q[0], t), L.lerp(noise[i][1], q[1], t), 0]);
        dots.forEach((d, i) => d.position.set(...pts[i])); rib.userData.set(pts);
        tl(`去噪进度 τ = ${t.toFixed(2)}`);
        fl([[-5.4, 1.6, 0.4], [-3.2, 1.6, 0.4], [-1.2, 1.6, 0.4]], (p * 3) % 1, 1);
        mem.forEach((b, i) => glow(b, 0.1 + 0.3 * ((p * 4 + i) % 1 > 0.5 ? 1 : 0)));
        const e = along(tgt, seg(p, 0.75, 1)); arm.userData.reach([5.6 + (e[0] - 1.1) * 0.45, 0.8 + (e[1] - 1.4) * 0.4, 0.6]);
        cap(p < 0.75 ? '带噪的动作槽交叉注意已提交的视觉状态，逐步去噪成下一动作块；掩码挡住当前视觉目标、当前动作条件和所有未来记录' : '执行后用测得的本体状态更新 s_c，下一块再读新的记忆。想象模式下则交替“预测动作 → 生成画面 → 提交记忆”');
      } else {
        const g = seg(p, 0.05, 0.6); bars.forEach(row => row.forEach(([f, val]) => f(val / 100 * 3.6 * g)));
        cap('平均 69.1，第一；但“套环”一项 π0.5 74 &gt; 61，“拣入篮”只比 DreamZero 高 0.7。对齐前的生成器配同样的动作专家是 64.6');
      }
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player (same as interactives/latent, interactives/diffmimic) ---------- */
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
    L.clear(root); LABS = []; PICKS = []; lastCap = null;
    const sc = SCENES[cur]; fly(...sc.cam); refDist = sc.cam[2] * aspectFix();
    const G = new THREE.Group(); root.add(G); pNow = p0; api = BUILD[cur](G); OPT = [];
    buildCtl();
    t0 = performance.now() - p0 * sc.dur * 1000; api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
  }
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
  window.__wsDebug = { STAT, ADV, mem: [0, 1, 2].map(m => memTok(m, 14)), get cap() { return $('cap').textContent; } };
})();
