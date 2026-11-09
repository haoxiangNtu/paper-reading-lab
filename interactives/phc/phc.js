'use strict';
/* PHC (arXiv 2305.06456) taken apart into eleven animated scenes. Dimensions and hyperparameters come from the paper and
   from the official code at commit 846988d. Each scene's update(p) is a pure function of the timeline p plus the current
   toggles. The humanoid is hand-made. Scenes 2, 3, 4, 5, 6, 8, 9 and 10 compute their numbers live on toy problems; those are
   toys and are labelled so. No PHC network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { prim: 0x38d1ff, frozen: 0x5f7fb0, comp: 0xf2a0a0, gate: 0xf0963c, fail: 0xb48cff, disc: 0xd45fa0, rew: 0xf2c14e, ok: 0x4fc98a, bad: 0xe05d5d, sim: 0x8e9bb8, data: 0x7cb8ff, ref: 0xe05d5d, robot: 0xc9d4ea, ppo: 0x9d8cff, gold: 0xf2c14e, dim: 0x46506a, white: 0xeef2fa };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  const SCENES = [
    { n: 1, part: '总览', title: '推理一条线，训练一条线', sub: '图 3 的 3D 版：策略、物理仿真、判别器、PPO', dur: 14, cam: [0.12, 1.08, 28, [-1.2, 3.8, 0]],
      html: dl([['策略', 'π_PHC：K 个模仿 primitive、P⁽ᶠ⁾、composer'], ['动作', 'PD 目标，23×3 = 69 维'], ['仿真', 'Isaac Gym，60 Hz；策略 30 Hz'], ['奖励', '0.5 r^g + 0.5 r^amp + r^energy'], ['学习', 'PPO（γ = 0.99，ε = 0.2）']]) +
        '<p>上半层是部署时留下的东西：参考动作和仿真状态合成状态 s，composer 给权重，门控把 primitive 的输出合成一个动作，交给 PD 和物理仿真。</p>' +
        '<p>下半层只在训练时存在：判别器看最近 10 帧本体状态，给风格奖励；任务奖励由模仿或恢复任务决定；PPO 更新。图 3 画的是最终产品，每个 primitive 和 composer 都走这同一套流程。</p>' +
        '<p>点画面里的方块可以跳到对应那一幕。</p>' + src('§3.1 · 图 3 · 算法 1') },
    { n: 2, part: '§3.1 输入输出', title: '状态怎么拼，动作为什么不用残差', sub: '切换旋转版和关键点版；切换绝对动作和残差动作', dur: 13, cam: [0.06, 1.28, 25, [0.8, 5.3, 0]], camE: [0.06, 1.28, 25, [0.8, 6.8, 0]],
      html: dl([['本体 s^p', '1 + 24×15 − 3 = 358 维（代码）'], ['旋转版 s^g', '24 体 × 24 = 576 维'], ['关键点版 s^g', '24 体 × 9 = 216 维'], ['动作', 'a ∈ ℝ^(23×3)，τ = kᵖ(a−q) − kᵈq̇']]) +
        '<p>目标状态是“下一帧参考减当前仿真”再加上参考本身，都换到人形当前朝向和根部的局部坐标里。关键点版只要 3D 位置，不要关节旋转，所以视频关键点估计器可以直接接上。</p>' +
        '<p>动作是 PD 目标本身。不少动作模仿方法（RFC、UHC 等）用残差写法 q^d = q̂ + a，训练快，但参考带噪声时噪声直接进了 PD 目标。PHC 要吃带噪输入，所以去掉了这个依赖。</p>' +
        toyb('下面两条曲线是页面当场积分的单关节 PD，kᵖ = 100、kᵈ = 15（我设的），控制 30 Hz。参考带噪声。绝对动作那条假设策略输出了平滑目标；残差那条假设策略输出为 0，噪声全部进入目标，这是最坏情形。功率读数按 |τ·q̇| 算。') +
        src('§3 · §3.1 Action · 代码 humanoid.py:665、humanoid_im.py:489-510') },
    { n: 3, part: '§3.1 奖励', title: '模仿奖励：论文的式子和代码差很多', sub: '进度条是位置误差 d，看四项奖励怎么掉', dur: 13, cam: [0.04, 1.26, 24, [0, 3.8, 0]],
      html: dl([['式 (1)', 'r = 0.5 r^g + 0.5 r^amp + r^energy'], ['式 (2) 权重', 'w = 0.5, 0.3, 0.1, 0.1'], ['指数系数', '100, 10, 0.1, 0.1'], ['能耗', '−0.0005·Σ|μⱼωⱼ|²（论文）']]) +
        '<p>论文写的是 e^(−100‖p̂−p‖)，指数里是范数本身。代码 <code>compute_imitation_reward</code> 写的是 e^(−100·mean(差²))，指数里是平方后按轴、按身体取平均。切换开关可以看差别：5 cm 的误差，论文写法的位置项约 0.0067，代码写法约 0.92。</p>' +
        '<p>系数和权重两边一致，差的只是范数和平方。能耗项也有差别：论文写平方，代码是一次方（<code>torch.abs(τ·q̇).sum</code>），而且它加进 rew_buf 后再乘 task_reward_w = 0.5。</p>' +
        toyb('曲线按当前开关现算。为了画一条线，我设旋转、速度、角速度误差随 d 成比例（3d rad、10d m/s、20d rad/s），这个比例是我定的。论文的范数怎样在身体之间聚合没写，这里取每个身体距离的平均。') +
        src('§3.1 式 (1)(2) · 表 5 · humanoid_im.py:1524-1553, 939-946 · amp_agent.py:851') },
    { n: 4, part: '§3.1 AMP', title: '风格奖励从判别器来', sub: '这里的判别器是页面当场训练的玩具', dur: 14, cam: [0.42, 0.92, 21, [1.2, 2.4, 0]],
      html: dl([['判别器', 'D(s^p_{t−10:t})，MLP [1024, 512]'], ['真样本', '动捕数据的状态窗口'], ['代码损失', 'BCE ＋ 梯度惩罚 5'], ['代码奖励', '−log(1−D)，再 ×2']]) +
        '<p>判别器分辨“这 10 帧本体状态来自动捕还是来自策略”。策略骗过它就拿奖励。它不告诉策略该跟谁，只约束动作看起来像人。对 PHC 这很关键：恢复阶段参考动作不提供信息，风格只能靠它约束。</p>' +
        '<p>这也解释了为什么 P⁽ᶠ⁾ 只用走路和跑步的子集 Q^loco：让判别器偏向简单步态，起身后自然走回去，不会爬或者滑过去。</p>' +
        '<p>论文说判别器的观测、损失和梯度惩罚都同 AMP。我对照了 AMP 原文：它用最小二乘损失、奖励 max(0, 1−0.25(D−1)²)、输入 (s_t, s_{t+1}) 两帧。PHC 代码用 BCE、奖励 −log(1−D)、输入 10 帧。代码更接近 ASE 的写法（ASE 这一点我没有打开核对）。</p>' +
        toyb('两个特征（我叫它步频和抖动，只是名字）。真样本固定，假样本每步沿 ∇log D 移动，判别器是二次特征上的逻辑回归，交替更新 240 步。曲面高度就是当前的 D，读数是真算的。这说明对抗机制，不代表 PHC 的判别器长这样。') +
        src('§3.1 Reward · Control Policy and Discriminator · §3.2 · amp_agent.py:791-798, 864-876') },
    { n: 5, part: '§3.2 PMCP', title: '一步一步长出 primitive', sub: '这一幕是核心。点按钮单步走：训练、挖掘、冻结、再长一个', dur: 26, cam: [0.2, 0.98, 25, [0.8, 3.0, 0]],
      html: dl([['算法 1', '第 17-21 行循环，第 22 行 P⁽ᶠ⁾，第 24 行 composer'], ['挖掘', 'Q̂⁽ᵏ⁺¹⁾ = P⁽ᵏ⁾ 在 Q̂⁽ᵏ⁾ 上失败的序列'], ['嵌套', 'Q̂⁽ᵏ⁺¹⁾ ⊆ Q̂⁽ᵏ⁾'], ['判收敛', 'Q̂⁽ᵏ⁾ 上的成功率不再升'], ['主实验', '共 4 个 primitive，含 P⁽ᶠ⁾']]) +
        '<p><b>循环：</b>P⁽¹⁾ 在全数据集上训到收敛；评估整个数据集，失败的序列组成更难的子集；冻结 P⁽¹⁾；新建 P⁽²⁾，只用这个子集训练。如此重复。新 primitive 的初始权重从上一个复制（weight sharing），主实验都用这种。</p>' +
        '<p>每个 primitive 都被冻结，所以后面的训练碰不到它学会的东西，这就是“不遗忘”的来源。代价是模型变大、要分阶段训练。论文报告全程约 7 天。</p>' +
        '<p>代码里这一步靠手动：<code>scripts/pmcp/forward_pmcp.py</code> 取最近 6 次评估（当前 epoch 向前 12500，每 2500 一次）失败序列的并集，并把第 k 个 primitive 的权重复制给第 k+1 个。</p>' +
        toyb('这里 600 个点是 600 条“序列”，横纵坐标是序列的特征，要拟合的目标 y(x) 有 5 个窄峰。每个 primitive 是只有 14 个 RBF 的回归（容量有限），成功 = 误差 < 0.15。点的高度是误差。所有数字是页面算的：P⁽¹⁾ 64.0%，加到 3 个后 93.0%。它只演示机制，和论文的成功率无关。P⁽ᶠ⁾ 在玩具里不参与算分。') +
        src('§3.2 · 算法 1 · 图 2 · 附录 B.3 · README 训练说明 · forward_pmcp.py') },
    { n: 6, part: '§3.2 遗忘', title: '同一个网络一直挖，会一直忘', sub: '原文图 7 的重读，和玩具的两种训法对照', dur: 13, cam: [0, 1.52, 31, [-0.6, 5.0, 0]],
      html: dl([['图 7', '8 次评估 × 529 条序列'], ['我的读法', '白 = 失败，黑 = 成功'], ['每次白格', '112 到 164 条'], ['相邻重叠', '23.5% 到 36.2%'], ['一直白', '18 条（序号 511-528）']]) +
        '<p>图 7 是作者观察到的现象：策略学会一批，就忘掉另一批，阶梯就是这样形成的。这正是 PMCP 的动机。</p>' +
        '<p><b>颜色。</b>图注说白 = 成功、黑 = 失败。按图注读，每次评估失败 365 到 417 条，和“98.9% 成功”对不上；按相反读法，每次失败 112 到 164 条，相当于 98.55% 到 99.01%，和全文一致，右端还正好有一条一直白的带子。所以我认为图注的颜色写反了，详见精读页读者注。</p>' +
        '<p>切换到玩具：同一容量的网络每轮只训上一轮的失败序列，成功率一直在 50% 到 66% 之间晃，重叠只有 16% 到 46%，阶梯也出来了。换成 PMCP，每行失败都在减少。</p>' +
        guess('“图 7 重读”是从原文位图取样的（每格约 4.7 像素），单格可能有一两条的误差。这不是原图，原图在精读页附录 C.1。') +
        src('附录 C.1 图 7 · 我的读数见精读页') },
    { n: 7, part: '§3.2 PNN', title: '权重共享 vs. 侧向连接', sub: '切换两种接法，看多多少参数', dur: 12, cam: [0.06, 1.18, 25, [0, 4.0, 0]],
      html: dl([['式 (7)', 'hᵢ⁽ᵏ⁾ = f(Wᵢ⁽ᵏ⁾hᵢ₋₁⁽ᵏ⁾ + Σⱼ Uᵢ⁽ʲ:ᵏ⁾hᵢ₋₁⁽ʲ⁾)'], ['侧向', '表 6 R1：87.5%，55.7，36.2'], ['共享', '表 6 R7：88.7%，55.4，34.7']]) +
        '<p>原版 PNN 为完全不同的任务设计（比如不同 Atari 游戏），新列用侧向连接决定复用多少旧经验。PHC 的“任务”都是人体动作，高度相关，所以试了更简单的办法：新 primitive 直接复制上一个的权重当初值，之后两者互不相连。</p>' +
        '<p>论文结论是两者效果接近，共享训练快得多，主实验用共享。</p>' +
        '<p><b>代码里的侧向连接</b>只在第二层有效，输出层的那部分被注释掉了（pnn.py，“disable action space transfer”）。按它算，每对列多一个 1024×512 的矩阵；4 列 6 对，多 3,145,728 个参数，约 12 MiB。这个数是我算的，论文没给。</p>' +
        '<p>表 6 的 R1 在 MOE 和 MCP 两列都打了 ✗，没说这一行怎样组合 4 个 primitive。</p>' + src('§3.2 · 附录 B.3 式 (7) 图 6 · 表 6 · pnn.py') },
    { n: 8, part: '§3.2 恢复', title: '摔倒、起身、走回去', sub: '选场景。距离 d 决定目标是“走过去”还是“跟动作”', dur: 16, cam: [0.06, 1.28, 27, [1.2, 4.6, 0]],
      html: dl([['三种失败', '倒地；离参考 > 0.5 m；两者同时'], ['式 (3)', 'd ≤ 0.5 → 完整目标，否则 s^g-Fail'], ['远距离', '> 5 m 时把目标钳到 5 m（代码默认 3 m）'], ['式 (4)', '0.5 r^point + 0.5 r^amp + 0.1 r^energy'], ['r^point', 'd_{t−1} − d_t']]) +
        '<p>P⁽ᶠ⁾ 放在 primitive 栈最后，输入输出和其他 primitive 相同。关键操作是<b>改目标状态</b>：d 大于阈值时，把非根关节的目标换成仿真自己的值，差分就是 0。目标于是退化成“根部要到那里”，这叫 point-goal。走近后切回完整模仿。</p>' +
        '<p>训练时随机把人形扔到地上（方法同 ASE），或者放到离参考 2 到 5 m 处。数据只用 Q^loco。</p>' +
        '<p>评测（表 4）：只用一段站立参考，1000 次随机试验；倒地是先施加 150 步随机力矩；远离是 3 m。右边柱子是表 4 的数，顺序是 5 秒内和 10 秒内成功。</p>' +
        '<p><b>代码和论文的差别：</b>切换距离代码默认 0.25（demo 里 0.5）；r^point 在代码里是 clamp(d_{t−1}−d_t, max=1/3)×9。可以切换阈值看切换时刻。</p>' +
        guess('小人的起身和走路是手写的，轨迹也是我设的，不是策略输出。但 d、r^point 和切换时刻是按这条轨迹和式 (3) 算的，24 个小方块的亮灭表示目标是否被屏蔽。d 是 3D 根部距离，所以倒地时的高度差（我设 0.72 m）也算在内。') +
        src('§3.2 Fail-state Recovery 式 (3)(4) · §4.2 表 4 · humanoid.py:328-329 · humanoid_im.py:783-796, 890-898') },
    { n: 9, part: '§3.2 组合', title: '组合器：把高斯相乘', sub: '拖权重，式 (6) 当场算，再用数值积分核对', dur: 18, cam: [0, 0.98, 17, [0.2, 3.0, 0]],
      html: dl([['式 (5)', 'π = (1/Z) Π P⁽ⁱ⁾(a|s)^{Cᵢ(s)}，Cᵢ ≥ 0'], ['式 (6)', 'μ = Σ(Cᵢ/σᵢ)μᵢ / Σ(Cᵢ/σᵢ)，σ = (ΣCᵢ/σᵢ)⁻¹'], ['composer', 'MLP [1024, 512]，输入和 primitive 相同'], ['训练', '混入恢复任务，全部 primitive 冻结']]) +
        '<p>每个 primitive 是独立高斯。带权连乘后还是高斯，方差里的 σ 读作方差时，式 (6) 正是精确解（下面的数值积分在核对这件事）。和 top-1 MOE 比，这里所有 primitive 同时起作用，所以 composer 能搜的动作空间更大。</p>' +
        '<p><b>同方差时：</b>PHC 的 σ 是固定且相同的，式 (6) 退化成均值的加权平均，方差变成 σ/ΣC。</p>' +
        '<p><b>代码不一样。</b><code>humanoid_im_mcp.py</code> 把 composer 的动作空间设成 num_prim 维，PPO 的高斯噪声加在<b>权重</b>上，env 再算 Σwᵢμᵢ，不除以 Σw，配置注释写着 “No softmax”。切到“代码”模式：权重之和不等于 1 时，均值被整体放大或缩小。README 里 iccv 模型的命令用这份配置，w 由 ReLU 输出，可以大于 1。</p>' +
        toyb('一维动作，四个 primitive 的 μ、σ 是我设的（同方差时 σ² = 0.05，取自表 5 的数）。权重默认随进度条变，拖滑块后就用你的值。代码模式的方差按 σ_w = e^(−2.9) 对 Σ(wᵢ+εᵢ)μᵢ 算。') +
        src('§3.2 Multiplicative Control 式 (5)(6) · humanoid_im_mcp.py step() · im_mcp.yaml · amp_network_mcp_builder.py') },
    { n: 10, part: '§3.3 实时', title: '从摄像头到仿真人形', sub: '切换来源和滤波。深度噪声和滤波是页面算的', dur: 16, cam: [0, 1.3, 33, [-1.2, 6.2, 0]],
      html: dl([['检测', 'YOLOv8（多人加 OC-SORT）'], ['姿态', 'MeTRAbs 关键点；HybrIK 旋转＋根'], ['滤波', '高斯，t−120 到 t，mirror'], ['策略', '30 Hz；仿真 60 Hz'], ['整体', '~32 FPS 带渲染，~50 FPS 不带']]) +
        '<p>PHC 只要下一帧的参考位姿或关键点，所以估计器可以换。实时用 MeTRAbs 配关键点版控制器；HybrIK 配旋转版；MDM 生成语言驱动的动作，片段之间不用混合，直接靠恢复能力走过去。</p>' +
        '<p>论文列出的难点：单目深度噪声（尤其在深度方向）、帧率波动（PHC 假定 30 FPS）、多人的身份切换。摄像头被假定水平，高度手动设置。</p>' +
        '<p><b>代码差别：</b><code>humanoid_im_mcp_demo.py</code> 的缓存是 30 帧（deque maxlen=30），不是 120。σ 按维度分：10（代码注释说 “more filtering”，脚本里的第三维）、5、关节 2。论文没写 σ。可以切换窗口和 σ 看效果。</p>' +
        toyb('曲线是合成的：一条 0.5 Hz 的真实深度，加白噪声 σ = 6 cm。滤波按 scipy gaussian_filter1d 的 mirror 模式实现，只取窗口最后一个值。读数是当场算的 RMS。真实估计器的噪声谱我没有测。') +
        src('§3.3 · 附录 B.2 · 附录 D · 表 6 · humanoid_im_mcp_demo.py:59, 278-284 · video_to_pose_server.py') },
    { n: 11, part: '§4 结果', title: '表里的数', sub: '切换五张表，柱子都是原文数字', dur: 12, cam: [0, 1.28, 31, [0, 5.2, 0]],
      html: dl([['AMASS-Train*', '11313 条，98.9%（UHC 带 RFC 97.0%）'], ['H36M-Test-Video*', '160 条，91.9%（UHC 18.1% 无 RFC）'], ['消融', '51.2 → 59.4 → 66.2 → 86.9 → 88.7'], ['恢复', '10 秒内 93.2% 到 99.5%']]) +
        '<p>RFC 是残差力控制，在根部加非物理外力帮平衡。UHC 带它是 97.0%，不带掉到 84.5%，PHC 不带外力 98.9%。</p>' +
        '<p>消融里最大的一跳是从 MCP 到 PMCP（66.2 → 86.9），证明渐进训练是主要贡献，这一点论文讲得对。5 个 primitive 反而比 4 个低一点（87.5 vs. 88.7）。</p>' +
        '<p>表 6 的 # Prim 含 P⁽ᶠ⁾，所以“4”相当于 3 个模仿 primitive。代码 README 还列了后来的 PHC-Prim（单 primitive 99.9%），也说 MCP 不是必需的，但那样就没有恢复能力。</p>' + src('§4.1 表 1、2、3 · §4.2 表 4 · 附录 C.2 表 6 · README') }
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
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65, emissive: o.emissive }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
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

  /* ---------- toy used by scenes 5 and 6: a capacity-limited regressor trained progressively. Computed on load. ---------- */
  const rng = L.rng;
function buildToy(){
  const N=600,M=14,R=0.16,THR=0.15,r=rng(7);
  const bumps=[[.2,.25,.55,.055],[.78,.2,-.6,.05],[.3,.8,.65,.045],[.72,.72,-.7,.04],[.5,.5,.6,.035]];
  const g=(x,z)=>{let y=.35*Math.sin(3.2*x+.6)+.3*Math.cos(2.7*z);for(const b of bumps){const d=(x-b[0])**2+(z-b[1])**2;y+=b[2]*Math.exp(-d/(2*b[3]*b[3]));}return y;};
  const X=[];for(let i=0;i<N;i++){let x,z;if(r()<.32){const b=bumps[Math.floor(r()*bumps.length)],a=r()*6.283,q=b[3]*1.2*Math.sqrt(r());x=b[0]+q*Math.cos(a);z=b[1]+q*Math.sin(a);}else{x=r();z=r();}X.push([x,z,g(x,z)]);}
  function kmeans(pts,k,seed){const q=rng(seed),C=[];C.push(pts[Math.floor(q()*pts.length)].slice(0,2));
    while(C.length<k){let far=-1,fp=null;for(const p of pts){let d=1e9;for(const c of C)d=Math.min(d,(p[0]-c[0])**2+(p[1]-c[1])**2);if(d>far){far=d;fp=p;}}C.push(fp.slice(0,2));}
    for(let it=0;it<8;it++){const s=C.map(()=>[0,0,0]);for(const p of pts){let b=0,bd=1e9;C.forEach((c,j)=>{const d=(p[0]-c[0])**2+(p[1]-c[1])**2;if(d<bd){bd=d;b=j;}});s[b][0]+=p[0];s[b][1]+=p[1];s[b][2]++;}s.forEach((t,j)=>{if(t[2])C[j]=[t[0]/t[2],t[1]/t[2]];});}
    return C;}
  function solve(A,b){const n=b.length;for(let i=0;i<n;i++){let m=i;for(let j=i+1;j<n;j++)if(Math.abs(A[j][i])>Math.abs(A[m][i]))m=j;[A[i],A[m]]=[A[m],A[i]];[b[i],b[m]]=[b[m],b[i]];for(let j=i+1;j<n;j++){const f=A[j][i]/A[i][i];for(let k=i;k<n;k++)A[j][k]-=f*A[i][k];b[j]-=f*b[i];}}const x=Array(n).fill(0);for(let i=n-1;i>=0;i--){let s=b[i];for(let k=i+1;k<n;k++)s-=A[i][k]*x[k];x[i]=s/A[i][i];}return x;}
  function fit(pts,seed,m,rad){m=Math.min(m||M,pts.length);rad=rad||R;const C=kmeans(pts,m,seed),f=(x,z)=>{const v=C.map(c=>Math.exp(-((x-c[0])**2+(z-c[1])**2)/(2*rad*rad)));v.push(1);return v;};
    const n=C.length+1,A=Array.from({length:n},()=>Array(n).fill(0)),b=Array(n).fill(0);
    for(const p of pts){const v=f(p[0],p[1]);for(let i=0;i<n;i++){b[i]+=v[i]*p[2];for(let j=0;j<n;j++)A[i][j]+=v[i]*v[j];}}
    for(let i=0;i<n;i++)A[i][i]+=1e-3;const w=solve(A,b);return(x,z)=>f(x,z).reduce((s,v,i)=>s+v*w[i],0);}
  const evalAll=fn=>X.map(p=>Math.abs(fn(p[0],p[1])-p[2]));
  const rate=e=>e.filter(v=>v<THR).length/N;
  /* PMCP: each new primitive fits only what all... the previous one failed, then is frozen */
  const prims=[],pe=[],trainSets=[];let cur=X;
  for(let k=0;k<4;k++){trainSets.push(cur);const fn=fit(cur,11+k);prims.push(fn);const e=evalAll(fn);pe.push(e);cur=cur.filter(p=>Math.abs(fn(p[0],p[1])-p[2])>=THR);if(cur.length<12)break;}
  /* the composer: for each primitive regress its own error, gate by softmax of predicted error */
  const conf=pe.map(e=>fit(X.map((p,i)=>[p[0],p[1],e[i]<THR?0:1]),99,60,.05));
  function composite(x,z,K,tau){const w=conf.slice(0,K).map(c=>Math.exp(-Math.max(0,c(x,z))/tau)),s=w.reduce((a,b)=>a+b,0);return{w:w.map(v=>v/s),y:prims.slice(0,K).reduce((a,fn,i)=>a+w[i]/s*fn(x,z),0)};}
  const compErr=K=>X.map(p=>Math.abs(composite(p[0],p[1],K,.1).y-p[2]));
  const oracle=K=>{let c=0;X.forEach((p,i)=>{let ok=false;for(let k=0;k<K;k++)if(pe[k][i]<THR)ok=true;if(ok)c++;});return c/N;};
  /* one network, retrained on what it just failed: same capacity, so what it knew is overwritten */
  const same=[];let tr=X;for(let t=0;t<8;t++){const fn=fit(tr,11+t),e=evalAll(fn);same.push(e);const fl=X.filter((p,i)=>e[i]>=THR);tr=fl;if(tr.length<12)tr=X;}
  return{X,N,THR,prims,pe,trainSets,conf,composite,compErr,rate,oracle,same,evalAll};
}
  let TOY_ = null; const toy = () => TOY_ || (TOY_ = buildToy());

  /* ---------- scene 1: the two loops ---------- */
  function s1(G) {
    const sep = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), new THREE.MeshBasicMaterial({ color: 0xff7a59, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false })); sep.rotation.x = Math.PI / 2; sep.position.y = 3.05; G.add(sep);
    G.add(lab('推理（部署时留下）', [-11, 8.6, 0], { size: 22, color: '#38d1ff' }), lab('训练', [-12.6, 3.5, 3], { size: 22, color: '#ff9a7a' }));
    const data = block(2.6, 1.3, 1.6, COL.data, [-11, 1.0, 0]), disc = block(2.8, 1.4, 1.6, COL.disc, [-3.6, 1.0, 0]), rew = block(2.0, 1.2, 1.6, COL.rew, [2.0, 1.0, 0]), ppo = block(2.4, 1.3, 1.6, COL.ppo, [7.4, 1.0, 0]);
    const comp = block(2.0, 1.1, 1.3, COL.comp, [-8.6, 6.6, 0]), gate = block(1.5, 1.0, 1.3, COL.gate, [-2.1, 6.6, 0]), pd = block(1.5, 1.0, 1.3, COL.sim, [1.0, 6.6, 0]);
    const prs = [[-6.2, COL.prim], [-5.2, COL.prim], [-4.2, COL.prim]].map(([x, c]) => block(0.75, 1.5, 1.1, c, [x, 6.6, 0])); const pf = block(0.75, 1.5, 1.1, COL.fail, [-3.2, 6.6, 0]);
    G.add(data, disc, rew, ppo, comp, gate, pd, ...prs, pf);
    [[data, 4], [disc, 3], [rew, 2], [ppo, 0], [comp, 8], [gate, 8], [pd, 1], [prs[0], 4], [prs[1], 4], [prs[2], 4], [pf, 7]].forEach(([m, g]) => { m.userData.go = g; PICKS.push(m); });
    G.add(lab('动作数据 Q̂', [-11, 2.1, 0], { size: 21 }), lab('判别器 D', [-3.6, 2.15, 0], { size: 21 }), lab('r = 0.5 r^g + 0.5 r^amp + r^energy', [2.0, -0.05, 1.5], { size: 20 }), lab('PPO', [7.4, 2.15, 0], { size: 21 }));
    G.add(lab('composer', [-8.6, 7.6, 0], { size: 20 }), lab('P¹ P² P³ Pᶠ', [-4.7, 7.8, 0], { size: 20 }), lab('门控', [-2.1, 7.6, 0], { size: 20 }), lab('PD', [1.0, 7.6, 0], { size: 20 }));
    const plate = block(6.4, 0.2, 4, COL.dim, [6.8, 4.2, 0], { opacity: 0.8 }); G.add(plate); plate.userData.go = 1; PICKS.push(plate);
    const rob = robot(COL.robot); G.add(rob); G.add(lab('Isaac Gym 60 Hz', [6.8, 8.6, 0], { size: 21 }));
    const f = { a: stream(G, 5, COL.prim), b: stream(G, 4, COL.gate), c: stream(G, 5, COL.robot), d: stream(G, 5, COL.data), e: stream(G, 5, COL.disc), g: stream(G, 4, COL.rew), h: stream(G, 4, COL.ppo), i: stream(G, 4, COL.rew) };
    wire(G, [[-3.2, 7.4, -0.7], [-8.6, 7.4, -0.7]], COL.sim, { opacity: 0.2 });
    return { update(p) {
      const q = (p * 20) % 1, tr = seg(p, 0.46, 0.54);
      pose(rob, clip('walk', p * 14), [6.8, 4.3, 0], 3.0, Math.PI / 2);
      const stP = [6.8, 4.1, 0.5];
      f.d([[-11, 1.7, 0], [-11, 5.0, 0], [-8.6, 6.0, 0]], q, 1);
      f.a([[-8.6, 6.6, 0], [-6.2, 6.6, 0], [-2.1, 6.6, 0]], q, 1);
      f.b([[-2.1, 6.6, 0], [1.0, 6.6, 0], [4.0, 6.6, 0]], q, 1);
      f.c([[4.6, 4.6, 1.5], [-3, 4.3, 1.5], [-8.6, 4.3, 1.5], [-8.6, 6.0, 0]], q, 1);
      f.e([[-9.7, 1.0, 0], [-5.0, 1.0, 0]], q, tr); f.g([[-2.2, 1.0, 0], [1.0, 1.0, 0]], q, tr); f.h([[3.0, 1.0, 0], [6.2, 1.0, 0]], q, tr);
      f.i([[5, 4.1, 1.2], [2.0, 1.7, 0.4]], q, tr);
      [comp, gate, pd].forEach(m => glow(m, 0.5 * (1 - tr))); [disc, rew, ppo].forEach(m => glow(m, 0.6 * tr));
      cap(p < 0.48 ? '参考动作和仿真状态 → composer 选权重 → 门控合成动作 → <b>PD 目标</b> → 物理仿真' : '训练时多一条：<b>判别器</b>给风格奖励，和任务、能耗一起进 <b>PPO</b>。每个 primitive 都走这同一流程');
    } };
  }

  /* ---------- scene 2: goal-state composition and absolute vs residual action ---------- */
  function s2(G) {
    let kp = +(OPT[0] ?? 0), res = +(OPT[1] ?? 0);
    G.add(L.grid(26, 26));
    const rob = robot(COL.robot), ghost = robot(COL.ref, { opacity: 0.45 }); G.add(rob, ghost);
    /* the observation vector as a stack, height proportional to its dimension */
    const SEG = { rot: [['本体 358', 358, COL.sim], ['旋转差 144', 144, COL.ref], ['位置差 72', 72, COL.gate], ['线速度差 72', 72, COL.rew], ['角速度差 72', 72, COL.comp], ['参考旋转 144', 144, COL.disc], ['参考位置 72', 72, COL.data]], kp: [['本体 358', 358, COL.sim], ['位置差 72', 72, COL.gate], ['线速度差 72', 72, COL.rew], ['参考位置 72', 72, COL.data]] };
    const stack = new THREE.Group(); G.add(stack);
    function rebuild() {
      L.clear(stack); LABS = LABS.filter(s => s.parent !== stack);
      const rows = kp ? SEG.kp : SEG.rot; let y = 0.1; const total = rows.reduce((a, r) => a + r[1], 0), H = 0.0098;
      rows.forEach(([t, d, c], i) => { const h = d * H; const b = block(1.6, h - 0.05, 1.4, c, [-8.6, y + h / 2, 0]); stack.add(b); stack.add(lab(t, [-5.8, y + h / 2, 0], { size: 19 })); y += h; });
      stack.add(lab(`输入 ${total} 维`, [-8.6, -0.9, 1.8], { size: 24, border: 'rgba(56,209,255,.8)' }));
    }
    rebuild();
    /* a one-joint PD toy, integrated in place. Policy runs at 30 Hz, physics at 240 Hz inside. */
    const n = 240, rr = L.rng(3), noise = Array.from({ length: n }, () => L.gauss(rr) * 0.12);
    const truth = i => 0.8 * Math.sin(2 * Math.PI * i / 30 / 2.6);
    function sim(residual) { const kP = 100, kD = 15, qs = []; let q = 0, v = 0, pw = 0; for (let i = 0; i < n; i++) { const tgt = residual ? truth(i) + noise[i] : truth(i); for (let s = 0; s < 8; s++) { const tau = kP * (tgt - q) - kD * v; v += tau * (1 / 240); q += v * (1 / 240); pw += Math.abs(tau * v) / 8; } qs.push(q); } return { qs, pw: pw / n }; }
    const A = sim(false), B = sim(true);
    const X0 = 1.4, W = 9.5, Y0 = 2.6, Hh = 1.1; panel(G, X0 - 0.2, Y0 - 1.4, -0.05, W + 0.4, 2.8);
    const rRef = ribbon(G, n, COL.ref, 0.03, { opacity: 0.55 }), rQ = ribbon(G, n, COL.prim, 0.08, { order: 3 });
    const tx = i => X0 + W * i / (n - 1), ty = v => Y0 + v * Hh;
    G.add(lab('红：带噪声的参考  蓝：PD 跟到的 q', [X0 + W / 2, Y0 + 2.0, 0], { size: 20 }));
    const ctls = [{ label: '目标状态', items: ['旋转版', '关键点版'], get: () => kp, set: k => { kp = k; rebuild(); } }, { label: '动作', items: ['PHC：绝对 PD 目标', '残差：q̂ + a'], get: () => res, set: k => { res = k; } }];
    return { ctls, update(p) {
      const T = p * 2.6; const qr = clip('walk', T);
      pose(ghost, qr, [-1.9, 0, -0.45], 3.0, 0); pose(rob, clip('walk', T - 0.05), [-1.9, 0, 0], 3.0, 0);
      const m = Math.max(2, Math.round(p * (n - 1))), d = res ? B : A;
      const refP = [], qP = []; for (let i = 0; i < n; i++) { const j = Math.min(i, m); refP.push([tx(j), ty(truth(j) + noise[j]), 0.02]); qP.push([tx(j), ty(d.qs[j]), 0.04]); }
      rRef.userData.set(refP); rQ.userData.set(qP);
      cap(`${kp ? '关键点版只要 3D 位置：574 维' : '旋转版：934 维'} · 按当前动作写法算出的 |τ·q̇| 平均：绝对 <b>${A.pw.toFixed(1)}</b>，残差 <b>${B.pw.toFixed(1)}</b>（玩具单位）`);
    } };
  }

  /* ---------- scene 3: the imitation reward, paper form against code form ---------- */
  function s3(G) {
    let form = +(OPT[0] ?? 0);
    G.add(L.grid(24, 24));
    const rob = robot(COL.robot), ghost = robot(COL.ref, { opacity: 0.45 }); G.add(rob, ghost);
    const X0 = -1, W = 8.6, Y0 = 3.0, Hh = 3.2, Dmax = 0.3; panel(G, X0 - 0.3, Y0 - 0.4, -0.3, W + 0.7, Hh + 1.0);
    const n = 120, rA = ribbon(G, n, COL.prim, 0.07), rB = ribbon(G, n, COL.sim, 0.04, { opacity: 0.8 }); const mk = block(0.14, 0.14, 0.14, COL.gold, [0, 0, 0], { edges: false }); G.add(mk);
    const rp = d => form ? [Math.exp(-100 * d * d / 3), Math.exp(-10 * (3 * d) ** 2), Math.exp(-0.1 * (10 * d) ** 2 / 3), Math.exp(-0.1 * (20 * d) ** 2 / 3)] : [Math.exp(-100 * d), Math.exp(-10 * 3 * d), Math.exp(-0.1 * 10 * d), Math.exp(-0.1 * 20 * d)];
    const ctot = v => 0.5 * v[0] + 0.3 * v[1] + 0.1 * v[2] + 0.1 * v[3];
    const px = d => X0 + W * d / Dmax, py = v => Y0 + v * Hh;
    G.add(lab('横轴 d：0 到 30 cm', [X0 + W / 2, Y0 - 0.85, 0], { size: 19 }), lab('蓝：式 (2) 总和  灰：只看位置项', [X0 + W / 2, Y0 + Hh + 0.3, 0], { size: 19 }));
    const NM = ['位置 0.5', '旋转 0.3', '速度 0.1', '角速 0.1'], CL = [COL.gate, COL.ref, COL.rew, COL.comp];
    const bars = NM.map((t, i) => { const b = bar(G, X0 + 0.8 + i * 2.3, 2.2, 1.0, CL[i], { d: 1 }); G.add(lab(t, [X0 + 0.8 + i * 2.3, 0, 3.4], { size: 18 })); return b; });
    const ctls = [{ label: '式 (2) 的写法', items: ['论文：e^(−k‖·‖)', '代码：e^(−k·mean(差²))'], get: () => form, set: k => { form = k; } }];
    return { ctls, update(p) {
      const d = Dmax * p; const pts = [], pos = []; for (let i = 0; i < n; i++) { const x = Dmax * i / (n - 1), v = rp(x); pts.push([px(x), py(ctot(v)), 0]); pos.push([px(x), py(v[0]), 0]); }
      rA.userData.set(pts); rB.userData.set(pos);
      const v = rp(d), t = ctot(v); mk.position.set(px(d), py(t), 0.05);
      v.forEach((u, i) => bars[i].userData.set(0.04 + u * 2.2));
      const T = 0.9 * 0.25; pose(ghost, clip('walk', T), [-6.3, 0, 0], 3.0, 0); pose(rob, clip('walk', T), [-6.3 + d * 3.0 / 0.65 * 0.65, 0, 0], 3.0, 0);
      cap(`d = <b>${(d * 100).toFixed(1)} cm</b> · 位置项 <b>${v[0].toFixed(3)}</b> · r^imitation = <b>${t.toFixed(3)}</b>（${form ? '代码写法' : '论文写法'}，当场算）`);
    } };
  }

  /* ---------- scene 4: AMP, a logistic discriminator trained live ---------- */
  function s4(G) {
    const r = L.rng(5), NR = 90, NF = 90, F = (x, z) => [1, x, z, x * x, z * z, x * z];
    const real = Array.from({ length: NR }, () => [0.68 + L.gauss(r) * 0.06, 0.32 + L.gauss(r) * 0.06]);
    let fake = Array.from({ length: NF }, () => [0.22 + L.gauss(r) * 0.06, 0.78 + L.gauss(r) * 0.06]);
    const STEPS = 240, hist = []; let w = [0, 0, 0, 0, 0, 0]; const sig = x => 1 / (1 + Math.exp(-x)), dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
    const D = (w, x, z) => sig(dot(w, F(x, z)));
    for (let t = 0; t <= STEPS; t++) {
      hist.push({ w: w.slice(), fake: fake.map(q => q.slice()) });
      for (let e = 0; e < 6; e++) { const g = [0, 0, 0, 0, 0, 0]; for (const q of real) { const f = F(q[0], q[1]), y = dot(w, f), k = 1 - sig(y); f.forEach((v, i) => { g[i] += k * v / NR; }); } for (const q of fake) { const f = F(q[0], q[1]), y = dot(w, f), k = -sig(y); f.forEach((v, i) => { g[i] += k * v / NF; }); } w = w.map((v, i) => v + 2.2 * g[i] - 1e-3 * v); }
      fake = fake.map(q => { const y = dot(w, F(q[0], q[1])), k = 1 - sig(y), dx = w[1] + 2 * w[3] * q[0] + w[5] * q[1], dz = w[2] + 2 * w[4] * q[1] + w[5] * q[0], nm = Math.max(1, Math.hypot(dx, dz) * k / 1.0); return [clamp(q[0] + 0.006 * k * dx / nm, 0, 1), clamp(q[1] + 0.006 * k * dz / nm, 0, 1)]; });
    }
    const N = 44, SZ = 10, pos = new Float32Array((N + 1) * (N + 1) * 3), col = new Float32Array((N + 1) * (N + 1) * 3), idx = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const a = i * (N + 1) + j, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    const surf = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.72, depthWrite: false })); surf.frustumCulled = false; G.add(surf);
    const X = u => (u - 0.5) * SZ, Z = u => (u - 0.5) * SZ, H = 3.2;
    const imR = inst(BALL, NR), imF = inst(BALL, NF); imR.material.color.setHex(COL.ok); imF.material.color.setHex(COL.bad); G.add(imR, imF);
    G.add(lab('绿：动捕样本（真）', [6.6, 5.6, -2.6], { size: 20, color: '#7ee0a8' }), lab('红：策略样本（假）', [6.6, 4.8, -2.6], { size: 20, color: '#ff9a8a' }), lab('曲面高度 = D', [6.6, 4.0, -2.6], { size: 20 }), lab('步频 →', [0, -0.5, 5.8], { size: 18 }), lab('抖动 →', [-5.9, -0.5, 0], { size: 20 }));
    const bR = bar(G, 7.6, 1.8, 0.9, COL.rew); G.add(lab('r^amp', [7.6, -0.5, 3.0], { size: 20 }));
    return { update(p) {
      const k = Math.round(p * STEPS), h = hist[k];
      for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const u = i / N, v = j / N, d = D(h.w, u, v), a = i * (N + 1) + j; pos[a * 3] = X(u); pos[a * 3 + 1] = d * H; pos[a * 3 + 2] = Z(v); col[a * 3] = 0.2 + 0.2 * d; col[a * 3 + 1] = 0.3 + 0.45 * d; col[a * 3 + 2] = 0.65 - 0.35 * d; }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
      real.forEach((q, i) => setI(imR, i, [X(q[0]), D(h.w, q[0], q[1]) * H + 0.1, Z(q[1])], 0.1)); done(imR);
      let dm = 0, rm = 0; h.fake.forEach((q, i) => { const d = D(h.w, q[0], q[1]); dm += d / NF; rm += -Math.log(Math.max(1 - d, 1e-4)) * 2 / NF; setI(imF, i, [X(q[0]), d * H + 0.1, Z(q[1])], 0.1); }); done(imF);
      bR.userData.set(0.05 + rm * 1.6);
      cap(`第 <b>${k}</b> 步 · 假样本上 D 平均 <b>${dm.toFixed(3)}</b> · r^amp = −log(1−D)×2 = <b>${rm.toFixed(3)}</b>（当场算的玩具，公式取自代码）`);
    } };
  }

  /* ---------- scene 5: PMCP stepper ---------- */
  function s5(G) {
    const t = toy(), K = 3, N = t.N;
    const STG = [{ k: 0, kind: 'train', b: 'P¹ 训练' }, { k: 0, kind: 'mine', b: '挖掘' }, { k: 1, kind: 'train', b: 'P² 训练' }, { k: 1, kind: 'mine', b: '挖掘' }, { k: 2, kind: 'train', b: 'P³ 训练' }, { k: 2, kind: 'mine', b: '挖掘' }, { kind: 'pf', b: 'Pᶠ' }, { kind: 'comp', b: '组合器' }];
    const sets = t.trainSets.map(s => new Set(s)), Xw = u => -9 + 11 * u, Zw = u => -5 + 10 * u;
    const floor = block(11.8, 0.12, 10.8, COL.dim, [Xw(.5), -0.08, 0], { opacity: 0.45 }); G.add(floor);
    const im = inst(BOX, N), cmpE = t.compErr(3), W3 = t.X.map(q => t.composite(q[0], q[1], 3, 0.1).w); G.add(im);
    G.add(lab('600 条“序列”（特征平面）', [Xw(.5), 0, 6.2], { size: 21 }));
    const cols = [COL.prim, 0x6fd8a8, 0xf2c14e], xs = [5.0, 6.7, 8.4], xF = 10.1;
    const stacks = [...xs, xF].map((x, i) => { const c = i === 3 ? COL.fail : cols[i], h1 = block(1.3, 0.9, 1.3, c, [x, 0.6, 0]), h2 = block(1.3, 0.9, 1.3, c, [x, 1.65, 0]), out = block(1.3, 0.5, 1.3, c, [x, 2.5, 0]); G.add(h1, h2, out); return { blocks: [h1, h2, out], c, x }; });
    const stLab = [...xs, xF].map((x, i) => { const l = lab(['P¹', 'P²', 'P³', 'Pᶠ'][i], [x, 3.3, 0], { size: 24 }); G.add(l); return l; });
    const ice = [...xs, xF].map(x => { const l = lab('冻结', [x, -0.25, 1.1], { size: 17, color: '#9fd0ff' }); G.add(l); return l; });
    const comp = block(5.6, 0.8, 1.3, COL.comp, [7.55, 4.6, 0]); G.add(comp); const cLab = lab('composer C（训练时 primitive 全部冻结）', [7.55, 5.45, 0], { size: 20 }); G.add(cLab);
    const fly = stream(G, 10, COL.bad, 0.14), nSz = lab('', [0, 0, 0]); G.add(nSz);
    let nS = nSz, nT = '';
    const setN = (txt, x) => { if (txt !== nT) { nT = txt; G.remove(nS); L.dispose(nS); LABS = LABS.filter(s => s !== nS); nS = lab(txt, [x, 6.9, 0], { size: 22, border: 'rgba(56,209,255,.8)' }); G.add(nS); } };
    const stageAt = p => { const f = clamp(p, 0, 0.9999) * STG.length, i = Math.floor(f); return [i, f - i]; };
    const ctls = [{ label: '单步', items: STG.map(s => s.b), get: () => stageAt(pNow)[0], set: k => { setPlay(false); pNow = (k + 0.92) / STG.length; $('scrub').value = Math.round(pNow * 1000); } }];
    const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k], OK = hex3(COL.ok), BAD = hex3(COL.bad), DIM = [0.2, 0.24, 0.32], WC = cols.map(hex3);
    return { ctls, update(p) {
      const [i, u] = stageAt(p), st = STG[i], f = seg(u, 0, 0.75);
      let e, set, txt;
      for (let n = 0; n < N; n++) {
        const q = t.X[n]; let c, h = 0.05;
        if (st.kind === 'train') { set = sets[st.k]; const tr = set.has(q); e = t.pe[st.k][n]; const init = st.k ? t.pe[st.k - 1][n] : 0.9; const ev = L.lerp(init, e, f); h = tr ? ev : 0; c = tr ? (ev < t.THR ? OK : BAD) : DIM; }
        else if (st.kind === 'mine') { set = sets[st.k]; e = t.pe[st.k][n]; const tr = set.has(q), fail = tr && e >= t.THR; h = fail ? 0.3 + 0.35 * f : (tr ? 0.04 : 0.02); c = fail ? BAD : (tr ? mix(OK, DIM, f * 0.8) : DIM); }
        else if (st.kind === 'pf') { h = 0.02; c = DIM; }
        else { e = cmpE[n]; h = L.lerp(0.3, e, f); const w = W3[n]; let bi = 0; w.forEach((v, j) => { if (v > w[bi]) bi = j; }); c = e < t.THR ? mix(WC[bi], [1, 1, 1], 0.1) : BAD; }
        const hh = Math.min(3.2, h * 2.2) + 0.03;
        setI(im, n, [Xw(q[0]), hh / 2, Zw(q[1])], [0.14, hh, 0.14]); colI(im, n, c);
      }
      done(im);
      const mined = st.kind === 'mine';
      stacks.forEach((s, j) => {
        const born = j < 3 ? (st.kind === 'pf' || st.kind === 'comp' || j <= st.k) : (st.kind === 'pf' || st.kind === 'comp');
        const active = (st.kind === 'train' && st.k === j) || (st.kind === 'pf' && j === 3);
        const frozen = born && !active && !(mined && st.k === j && u < 0.5);
        s.blocks.forEach(b => { b.visible = born; tint(b, frozen ? COL.frozen : s.c); glow(b, active ? 0.45 + 0.3 * Math.sin(u * 30) : 0); });
        stLab[j].visible = born; ice[j].visible = born && frozen;
      });
      comp.visible = cLab.visible = st.kind === 'comp'; glow(comp, st.kind === 'comp' ? 0.5 : 0);
      if (mined && st.k < 2) fly([[Xw(.6), 1.0, 0], [xs[st.k], 4.0, 1.4], [xs[st.k + 1], 3.2, 0]], (u * 2) % 1, u > 0.45 ? 1 : 0); else fly([[0, 0, 0], [0, 0, 0]], 0, 0);
      const nOf = k => t.trainSets[k].length, rO = K2 => (t.oracle(K2) * 100).toFixed(1);
      if (st.kind === 'train') { cap(`<b>P${'¹²³'[st.k]} 只看 ${nOf(st.k)} 条</b>。亮的是它的训练集，高度是它的误差，绿 = 误差 &lt; ${t.THR}`); txt = `训练集 ${nOf(st.k)} 条`; }
      else if (mined) { const nf = t.trainSets[st.k].filter((q, n) => t.pe[st.k][t.X.indexOf(q)] >= t.THR).length; cap(`评估后 <b>${nf}</b> 条失败，组成 Q̂${'²³⁴'[st.k]}。P${'¹²³'[st.k]} 冻结。到这步任一 primitive 能过的占 <b>${rO(st.k + 1)}%</b>`); txt = `挖出 ${nf} 条`; }
      else if (st.kind === 'pf') { cap('<b>Pᶠ</b> 排在栈尾：同样的输入输出，但只学恢复任务，数据换成 Q^loco。详见第 8 幕'); txt = '恢复任务，玩具不算分'; }
      else { cap(`composer 给每条序列选权重（颜色 = 权重最大的 primitive）。玩具成功率 <b>${(t.rate(cmpE) * 100).toFixed(1)}%</b>，单个 P¹ 是 ${(t.rate(t.pe[0]) * 100).toFixed(1)}%`); txt = `组合后 ${(t.rate(cmpE) * 100).toFixed(1)}%`; }
      setN(txt, 7.3); syncCtl();
    } };
  }

  /* ---------- scene 6: Fig. 7 reread, and the toy's forgetting ---------- */
  const F7 = [[0,33,308,27,422,13,464,18,492,7,500,29],[33,49,311,1,325,1,332,1,334,44,422,3,427,2,435,16,467,2,470,3,479,1,482,9,492,2,497,1,499,2,502,27],[82,36,308,1,310,1,314,1,320,1,324,1,328,1,335,1,346,1,351,1,369,1,374,2,378,13,428,1,432,3,451,9,464,2,467,3,472,3,476,3,480,5,488,1,491,6,500,4,505,24],[118,50,312,1,317,1,321,1,327,1,329,1,343,3,350,1,352,1,354,3,359,1,361,2,364,1,367,1,385,1,387,1,391,13,423,1,425,3,435,12,448,1,455,2,460,1,466,1,473,3,477,2,483,10,494,6,502,3,507,22],[168,39,322,2,331,1,338,1,347,1,353,1,373,1,383,1,391,2,400,1,402,1,404,9,422,1,429,1,445,2,451,4,460,4,469,1,475,1,479,4,491,1,493,4,499,30],[207,25,309,1,313,1,315,1,326,1,330,1,336,1,365,1,371,2,376,1,379,2,389,2,393,1,397,1,399,1,406,2,413,6,424,2,430,2,442,3,447,1,449,2,452,2,457,3,461,3,466,3,470,3,476,1,486,2,489,3,497,32],[232,34,318,1,337,1,339,2,342,1,348,2,358,1,368,1,370,1,377,2,381,2,386,1,395,2,403,3,409,2,412,1,419,3,426,1,432,3,438,1,449,2,455,2,458,5,464,3,469,1,473,2,476,3,480,6,488,1,493,3,498,1,500,2,505,2,508,21],[266,42,316,1,319,1,333,1,341,1,357,1,360,1,363,1,366,1,384,1,388,1,394,1,398,1,401,1,408,1,411,1,413,9,429,3,435,3,439,3,447,2,451,1,454,1,457,1,463,3,470,2,475,1,479,1,485,3,489,2,492,1,496,4,501,1,504,4,511,18]];
  function s6(G) {
    let view = +(OPT[0] ?? 0); const CAP = 8 * 600, im = inst(BOX, CAP); G.add(im);
    panel(G, -11.2, 0.0, -0.2, 22.4, 7.0);
    const rowL = new THREE.Group(); G.add(rowL);
    const t = toy(), f = t.same.map(e => e.map(v => v >= t.THR));
    const order = Array.from({ length: t.N }, (_, i) => i).filter(i => f.some(r => r[i])).sort((a, b) => { const fa = f.findIndex(r => !r[a]), fb = f.findIndex(r => !r[b]); return fa - fb || a - b; });
    const rowsF7 = F7.map(rl => { const r = new Array(529).fill(false); for (let i = 0; i < rl.length; i += 2) for (let j = 0; j < rl[i + 1]; j++) r[rl[i] + j] = true; return r; });
    const rowsSame = f.map(r => order.map(i => r[i]));
    const pmF = [1, 2, 3].map(K => { const a = []; for (let i = 0; i < t.N; i++) { let ok = false; for (let k = 0; k < K; k++) if (t.pe[k][i] < t.THR) ok = true; a.push(!ok); } return a; }), ordP = Array.from({ length: t.N }, (_, i) => i).filter(i => t.pe[0][i] >= t.THR);
    const rowsP = pmF.map(r => ordP.map(i => r[i]));
    const VIEWS = [{ rows: rowsF7, names: ['12500', '15000', '17500', '20000', '22500', '25000', '27500', '30000'], t: 'epoch' }, { rows: rowsSame, names: rowsSame.map((_, i) => '第 ' + (i + 1) + ' 轮'), t: '同一网络' }, { rows: rowsP, names: ['只有 P¹', 'P¹ P²', 'P¹ P² P³'], t: 'PMCP' }];
    const WH = hex3(COL.white), BK = [0.05, 0.07, 0.11];
    let lastV = -1;
    function rebuild() {
      L.clear(rowL); LABS = LABS.filter(s => s.parent !== rowL); const v = VIEWS[view];
      v.names.forEach((nm, i) => rowL.add(lab(nm, [-12.9, 6.6 - (i + 0.5) * (6.6 / v.rows.length), 0], { size: 18 })));
      lastV = view;
    }
    const ctls = [{ label: '看哪个', items: ['原文图 7 重读', '玩具：同一网络一直挖', '玩具：PMCP'], get: () => view, set: k => { view = k; } }];
    rebuild();
    return { ctls, update(p) {
      if (lastV !== view) rebuild();
      const v = VIEWS[view], R = v.rows.length, C = v.rows[0].length, cw = 22 / C, rh = 6.6 / R, on = Math.min(R, Math.floor(p * R * 1.15) + 1);
      let n = 0; for (let r = 0; r < R; r++) { const vis = r < on; for (let c = 0; c < C; c++) { if (n >= CAP) break; const w = v.rows[r][c]; setI(im, n, [-11 + (c + 0.5) * cw, 6.6 - (r + 0.5) * rh + 0.2, 0], vis ? [cw * 0.98, rh * 0.96, 0.05] : 0.0001); colI(im, n, w ? WH : BK); n++; } }
      for (; n < CAP; n++) setI(im, n, [0, -50, 0], 0.0001); im.count = CAP; done(im);
      const cnt = v.rows.slice(0, on).map(r => r.filter(Boolean).length), ov = []; for (let a = 0; a + 1 < on; a++) { let o = 0; for (let c = 0; c < C; c++) if (v.rows[a][c] && v.rows[a + 1][c]) o++; ov.push(cnt[a] ? o / cnt[a] : 0); }
      const lastO = ov.length ? `，和上一行重叠 <b>${(ov[ov.length - 1] * 100).toFixed(0)}%</b>` : '';
      if (view === 0) cap(`白 = 失败（我的读法）。第 ${on} 次评估失败 <b>${cnt[on - 1]}</b> 条${lastO}。以 11313 条算成功率 <b>${(100 * (1 - cnt[on - 1] / 11313)).toFixed(2)}%</b>`);
      else if (view === 1) cap(`第 ${on} 轮只训上一轮失败的，失败 <b>${cnt[on - 1]}</b> / 600 条${lastO}。容量没变，学会新的就忘旧的（玩具）`);
      else cap(`前 ${on} 个 primitive 里任一能过就算过：还剩 <b>${cnt[on - 1]}</b> / 600 条失败。行数少是因为这里只有 3 个 primitive（玩具）`);
    } };
  }

  /* ---------- scene 7: weight sharing vs lateral connections ---------- */
  function s7(G) {
    let lat = +(OPT[0] ?? 0); G.add(L.grid(24, 24));
    const xs = [-6, -2, 2, 6], names = ['P¹', 'P²', 'P³', 'Pᶠ'], cols = [COL.prim, 0x6fd8a8, COL.rew, COL.fail];
    const C = xs.map((x, i) => { const bl = [block(2.6, 0.9, 1.3, cols[i], [x, 1.0, 0]), block(2.2, 0.9, 1.3, cols[i], [x, 2.5, 0]), block(1.8, 0.7, 1.3, cols[i], [x, 3.9, 0])]; G.add(...bl); return bl; });
    const nm = xs.map((x, i) => { const l = lab(names[i], [x, 4.95, 0], { size: 24 }); G.add(l); return l; });
    G.add(lab('h₁ 1024', [-9.1, 1.0, 0], { size: 18 }), lab('h₂ 512', [-9.0, 2.5, 0], { size: 18 }), lab('输出 69', [-8.9, 3.9, 0], { size: 18 }));
    const lats = [], copies = [];
    for (let k = 1; k < 4; k++) for (let j = 0; j < k; j++) { const m = wire(G, [[xs[j] + 1.2, 1.2, 0.7], [L.lerp(xs[j], xs[k], .6), 1.9, 0.7], [xs[k] - 1.0, 2.4, 0.7]], COL.gold, { opacity: 0.95 }); m.userData.k = k; lats.push(m); }
    for (let k = 1; k < 4; k++) { const a = L.arrow([xs[k - 1] + 1.5, 4.6, 0.7], [xs[k] - 1.0, 4.6, 0.7], COL.gate, { head: 0.35, headW: 0.2 }); a.userData.k = k; G.add(a); copies.push(a); }
    const mbA = 4 * 1517637 + 1484292, extra = 6 * 1024 * 512;
    const rA = [87.5, 88.7], bB = [bar(G, -3.2, 4.2, 1.2, COL.gold), bar(G, 1.2, 4.2, 1.2, COL.gate)];
    G.add(lab('表 6 R1 侧向：87.5%', [-3.2, -0.1, 5.6], { size: 18 }), lab('表 6 R7 共享：88.7%', [1.2, -0.1, 5.6], { size: 18 }));
    const ctls = [{ label: '接法', items: ['权重共享（主实验）', '侧向连接'], get: () => lat, set: k => { lat = k; } }];
    return { ctls, update(p) {
      const n = Math.min(4, 1 + Math.floor(p * 4.4));
      C.forEach((bl, i) => bl.forEach(b => { b.visible = i < n; tint(b, i < n - 1 ? COL.frozen : cols[i]); glow(b, i === n - 1 ? 0.35 : 0); })); nm.forEach((l, i) => { l.visible = i < n; });
      lats.forEach(m => { m.visible = !!lat && m.userData.k < n; }); copies.forEach(a => { a.visible = !lat && a.userData.k < n; });
      bB[0].userData.set(rA[0] / 100 * 2.4); bB[1].userData.set(rA[1] / 100 * 2.4);
      const mb = (mbA + (lat ? extra : 0)) * 4 / 2 ** 20;
      cap(`已有 <b>${n}</b> 列，只有最新一列在训练（亮），其余冻结。全部 + composer 按 float32 算：<b>${mb.toFixed(1)} MiB</b>${lat ? '（侧向多 12 MiB，我的计算）' : '（对上论文的 28.8 MB）'}`);
    } };
  }

  /* ---------- scene 8: fail-state recovery ---------- */
  function s8(G) {
    let sc = +(OPT[0] ?? 2), thr = +(OPT[1] ?? 0); G.add(L.grid(30, 30));
    const rob = robot(COL.fail), ghost = robot(COL.ref, { opacity: 0.45 }); G.add(rob, ghost);
    const XR = 1.8, U = 2.0; /* 1 m = 2 world units */
    G.add(lab('红：参考（站立）', [XR, 3.9, -1], { size: 19, color: '#ff9a8a' }));
    const chips = inst(BOX, 24); G.add(chips); const OK = hex3(COL.prim), OFF = [0.2, 0.22, 0.3], RT = hex3(COL.gold);
    const chipX = i => 5.8 + (i % 12) * 0.5, chipY = i => 3.3 - Math.floor(i / 12) * 0.5; G.add(lab('目标里的 24 个身体（金 = 根，暗 = 被屏蔽）', [8.5, 3.95, -2.1], { size: 18 }));
    /* d(t) from the schematic trajectory; the reward and the switch are computed from it */
    const TS = [{ d0: 0.3, lie: 0.3 }, { d0: 3.0, lie: 0 }, { d0: 3.0, lie: 0.26 }]; const TN = 300;
    const traj = cfg => { const a = []; for (let i = 0; i < TN; i++) { const t = i / (TN - 1); const walkFrom = cfg.lie ? cfg.lie + 0.14 : 0.06; const u = clamp((t - walkFrom) / (0.82 - walkFrom), 0, 1); const hor = cfg.d0 * (1 - L.ease(u)), gk = cfg.lie ? clamp((t - cfg.lie) / (walkFrom - cfg.lie), 0, 1) : 1, gap = 0.72 * (1 - L.ease(gk)); a.push({ hor, d: Math.hypot(hor, gap) }); } return a; };
    const XP = 4.8, WP = 7.6, YP = 4.7, HP = 2.6; panel(G, XP - 0.3, YP - 0.4, -2.2, WP + 0.6, HP + 0.9);
    const rd = ribbon(G, TN, COL.prim, 0.07), rth = ribbon(G, 2, COL.gold, 0.035, { opacity: 0.85 }); [rd, rth].forEach(m => { m.position.z = -2.1; }); const mk = block(0.17, 0.17, 0.17, COL.white, [0, 0, -2], { edges: false }); G.add(mk);
    G.add(lab('d(t) 和切换阈值', [XP + WP / 2, YP + HP + 0.2, -2.1], { size: 19 }));
    const T4 = { Ours: [95.0, 98.8, 83.7, 99.5, 93.4, 98.8], 'Ours-kp': [92.5, 94.6, 95.1, 96.0, 79.4, 93.2] };
    const bars = []; ['Ours', 'Ours-kp'].forEach((m, j) => { for (let k = 0; k < 2; k++) { const b = bar(G, -9.3 + j * 3.2 + k * 1.35, 3.2, 0.8, j ? COL.gate : COL.prim, { d: 0.8 }); bars.push({ b, j, k }); } });
    G.add(lab('表 4：Ours        Ours-kp\n每组左 5 秒，右 10 秒', [-7.0, 0, 5.3], { size: 18 }));
    const vLab = { s: null, t: '' };
    const ctls = [{ label: '场景', items: ['倒地', '远离 3 m', '倒地 + 远离'], get: () => sc, set: k => { sc = k; } }, { label: '切换阈值', items: ['0.5 m（论文）', '0.25 m（代码默认）'], get: () => thr, set: k => { thr = k; } }];
    return { ctls, update(p) {
      const cfg = TS[sc], tr = traj(cfg), TH = thr ? 0.25 : 0.5, i = Math.min(TN - 1, Math.round(p * (TN - 1))), d = tr[i].d, dp = tr[Math.max(0, i - 1)].d, rp = dp - d;
      let q, dr = XR - tr[i].hor * U;
      const t = p, wf = cfg.lie ? cfg.lie + 0.14 : 0.06;
      if (cfg.lie && t < cfg.lie) q = getup(0, 0);
      else if (cfg.lie && t < wf) q = getup((t - cfg.lie) / (wf - cfg.lie), 0);
      else if (t < 0.82 && cfg.d0 > 0.5) q = clip('walk', t * 8);
      else q = qmix(cfg.d0 > 0.5 ? clip('walk', t * 8) : still(), clip('walk', t * 8), 0);
      if (t >= 0.82) q = qmix(still(), clip('walk', 0.22 + (t - 0.82) * 4), Math.sin(Math.min(1, (t - 0.82) / 0.18) * Math.PI) * 0.45);
      pose(rob, q, [dr, 0, 0], 3.0, Math.PI / 2); pose(ghost, still(), [XR, 0, -1], 3.0, Math.PI / 2);
      const imit = d <= TH;
      for (let c = 0; c < 24; c++) { setI(chips, c, [chipX(c), chipY(c), -2.1], 0.42); colI(chips, c, c === 0 ? RT : imit ? OK : OFF); } done(chips);
      const dPts = tr.map((v, j) => [XP + WP * j / (TN - 1), YP + v.d / 3.2 * HP, 0]), y = YP + TH / 3.2 * HP;
      rd.userData.set(dPts); rth.userData.set([[XP, y, 0], [XP + WP, y, 0]]); mk.position.set(XP + WP * i / (TN - 1), YP + d / 3.2 * HP, -2.0);
      bars.forEach((o, n) => { const { b, j, k } = o, v = T4[j ? 'Ours-kp' : 'Ours'][sc * 2 + k], h = v / 100 * 2.6; b.userData.set(h); if (o.v !== v) { o.v = v; if (o.l) { G.remove(o.l); L.dispose(o.l); LABS = LABS.filter(x => x !== o.l); } o.l = lab(v.toFixed(1), [b.position.x, h + 0.35, 3.2], { size: 16 }); G.add(o.l); } });
      const phase = imit ? '目标切回完整模仿，全部亮起' : (cfg.lie && t < wf ? '倒地或起身中：目标只剩根部' : 'point-goal：只要走到根部目标');
      cap(`d = <b>${d.toFixed(2)} m</b> · ${phase} · 这一格 r^point = d_{t−1}−d_t = <b>${rp.toFixed(4)}</b>`);
    } };
  }

  /* ---------- scene 9: the composer. Equation (6) evaluated live, then checked by numerical integration ---------- */
  function s9(G) {
    let mode = +(OPT[0] ?? 0), diff = +(OPT[1] ?? 0), user = null;
    const MU = [-0.7, -0.1, 0.45, 1.0], VS = [[0.05, 0.05, 0.05, 0.05], [0.03, 0.12, 0.05, 0.2]], CL = [COL.prim, 0x6fd8a8, COL.rew, COL.fail], NM = ['P¹', 'P²', 'P³', 'Pᶠ'];
    const SX = 2.5, Xc = 1.4, X = a => Xc + a * SX * 1.4, n = 161, A = i => -2 + 4 * i / (n - 1), Ybase = 0.3, DS = 1.35;
    G.add(L.grid(22, 22));
    const lanes = MU.map((m, i) => { const z = -3.2 + i * 1.1, r = ribbon(G, n, CL[i], 0.05); r.position.z = z; const lb = lab(NM[i], [-5.7, 0.6, z], { size: 22 }); const wb = block(0.3, 1, 0.5, CL[i], [-4.6, 0.5, z], { edges: false }); G.add(lb, wb); return { r, wb, z }; });
    const comp = ribbon(G, n, COL.gold, 0.11, { order: 4 }); comp.position.z = 1.6; G.add(lab('组合后的 π(a|s)', [X(1.25), 3.7, 1.6], { size: 21, color: '#f2c14e' }));
    const axis = wire(G, [[X(-2), 0.28, 1.6], [X(2), 0.28, 1.6]], COL.sim, { opacity: 0.7 }); G.add(lab('动作 a', [X(1.85), -0.15, 2.2], { size: 18 }));
    const mk = block(0.06, 3.0, 0.06, COL.gold, [0, 1.8, 1.6], { edges: false, opacity: 0.6 }); G.add(mk);
    const preset = [[1, .1, .05, 0], [.25, .25, .25, .25], [.1, .9, .6, 0], [0, .1, .2, 1], [1.2, 1.2, .1, 0]];
    const wAt = p => { if (user) return user.slice(); const x = clamp(p, 0, 0.9999) * (preset.length - 1), i = Math.floor(x), f = L.ease(x - i); return preset[i].map((v, j) => L.lerp(v, preset[i + 1][j], f)); };
    let RD = null, sl = [];
    const ctls = [{ label: '组合方式', items: ['式 (6)', 'top-1 MOE', '代码：Σwμ'], get: () => mode, set: k => { mode = k; } }, { label: 'σ²', items: ['相同 0.05（PHC）', '各不相同'], get: () => diff, set: k => { diff = k; } }];
    const pdf = (a, m, v) => Math.exp(-((a - m) ** 2) / (2 * v)) / Math.sqrt(2 * Math.PI * v);
    /* numerical product on a fine grid */
    function numeric(w, V) { const N = 4001, lo = -6, hi = 6, dx = (hi - lo) / (N - 1); let s = 0, s1 = 0, s2 = 0; const ls = []; let mx = -Infinity; for (let i = 0; i < N; i++) { const a = lo + i * dx; let l = 0; for (let k = 0; k < 4; k++) l += w[k] * Math.log(pdf(a, MU[k], V[k]) + 1e-300); ls.push(l); if (l > mx) mx = l; } for (let i = 0; i < N; i++) { const a = lo + i * dx, e = Math.exp(ls[i] - mx); s += e; s1 += e * a; s2 += e * a * a; } const m = s1 / s; return [m, s2 / s - m * m]; }
    function ev(w) {
      const V = VS[diff]; const sum = w.reduce((a, b) => a + b, 0);
      if (mode === 1) { let b = 0; w.forEach((v, i) => { if (v > w[b]) b = i; }); return { m: MU[b], v: V[b], tag: `只激活 ${NM[b]}` }; }
      if (mode === 2) { const sw = Math.exp(-2.9), m = w.reduce((a, v, i) => a + v * MU[i], 0), v2 = sw * sw * MU.reduce((a, u) => a + u * u, 0); return { m, v: Math.max(v2, 1e-5), tag: `Σw = ${sum.toFixed(2)}，不归一` }; }
      const den = w.reduce((a, v, i) => a + v / V[i], 0) || 1e-9; return { m: w.reduce((a, v, i) => a + v / V[i] * MU[i], 0) / den, v: 1 / den, tag: '' };
    }
    return { ctls, ctlExtra(box) {
      const d = document.createElement('div'); d.className = 'row sl'; d.innerHTML = '<span>权重</span>' + NM.map((t, i) => `<label>${t}<input type="range" min="0" max="150" value="0" data-i="${i}" aria-label="${t} 权重"><b id="wv${i}">0</b></label>`).join('') + '<button type="button" id="wAuto">回到自动</button>'; box.appendChild(d);
      RD = document.createElement('div'); RD.className = 'row rd mono'; box.appendChild(RD);
      sl = [...d.querySelectorAll('input')];
      sl.forEach(s => { s.addEventListener('input', () => { const w0 = wAt(pNow); user = sl.map((o, i) => o === s ? +o.value / 100 : +o.value / 100); setPlay(false); api.update(pNow); }); });
      d.querySelector('#wAuto').onclick = () => { user = null; api.update(pNow); };
    }, update(p) {
      const w = wAt(p), V = VS[diff], e = ev(w);
      w.forEach((v, i) => { const l = lanes[i], pts = []; for (let k = 0; k < n; k++) { const a = A(k); pts.push([X(a), Ybase + pdf(a, MU[i], V[i]) * 0.9, 0]); } l.r.userData.set(pts); const h = Math.max(0.03, v * 1.8); l.wb.scale.y = h; l.wb.position.y = h / 2; glow(l.wb, 0.3); if (sl[i]) { sl[i].value = Math.round(v * 100); const b = $('wv' + i); if (b) b.textContent = v.toFixed(2); } });
      const pts = []; for (let k = 0; k < n; k++) { const a = A(k); pts.push([X(a), Ybase + Math.min(4.2, pdf(a, e.m, e.v) * 0.55), 0]); } comp.userData.set(pts);
      mk.position.x = X(clamp(e.m, -2, 2));
      let chk = ''; if (mode === 0) { const [nm, nv] = numeric(w, V); chk = `数值积分 μ=${nm.toFixed(4)} σ²=${nv.toFixed(4)}`; }
      if (RD) RD.innerHTML = `μ=${e.m.toFixed(4)} σ²=${e.v.toFixed(4)}${e.tag ? ' · ' + e.tag : ''}${chk ? '<br>' + chk : ''}`;
      cap(mode === 0 ? `权重 ${w.map(v => v.toFixed(2)).join(' ')} → <b>μ = ${e.m.toFixed(3)}</b>，<b>σ² = ${e.v.toFixed(4)}</b>。数值积分和式 (6) 一致` : mode === 1 ? `top-1 只取最大权重的那个：<b>${e.tag}</b>，μ = ${e.m.toFixed(3)}，权重的大小不影响其他` : `代码：<b>μ = Σwᵢμᵢ = ${e.m.toFixed(3)}</b>（${e.tag}）。同样的权重，式 (6) 给出 ${(() => { const V = VS[diff], den = w.reduce((a, v, i) => a + v / V[i], 0) || 1e-9; return (w.reduce((a, v, i) => a + v / V[i] * MU[i], 0) / den).toFixed(3); })()}`);
    } };
  }

  /* ---------- scene 10: the real-time pipeline; depth noise and the Gaussian filter are computed ---------- */
  function s10(G) {
    let src = +(OPT[0] ?? 0), fi = +(OPT[1] ?? 2), win = +(OPT[2] ?? 0);
    const SIG = [0, 2, 5, 10], WIN = [30, 120];
    const nodes = [['摄像头', -13.5, COL.sim, '30 FPS 输入'], ['YOLOv8', -9.7, COL.data, '人体框'], ['姿态估计', -5.9, COL.ok, ''], ['高斯滤波', -2.1, COL.rew, ''], ['PHC', 1.7, COL.prim, '30 Hz'], ['Isaac Gym', 5.5, COL.sim, '60 Hz'], ['渲染', 9.3, COL.dim, '~32 FPS']];
    const B = nodes.map(([t, x, c, s]) => { const b = block(2.4, 1.2, 1.5, c, [x, 7.0, 0]); G.add(b, lab(t, [x, 8.15, 0], { size: 21 })); if (s) G.add(lab(s, [x, 5.95, 0], { size: 17 })); return b; });
    const flow = stream(G, 18, COL.prim, 0.11);
    const PST = [['MeTRAbs：关键点', 'kp'], ['HybrIK：旋转+根', 'rot'], ['MDM：文本生成', 'mdm']];
    const srcL = { s: null, t: '' };
    const setSrc = () => { const t = ['MeTRAbs → p̃', 'HybrIK → θ̃, p̃⁰', 'MDM → p̃（不走摄像头）'][src]; if (srcL.t !== t) { if (srcL.s) { G.remove(srcL.s); L.dispose(srcL.s); LABS = LABS.filter(x => x !== srcL.s); } srcL.t = t; srcL.s = lab(t, [-5.9, 5.95, 0], { size: 17 }); G.add(srcL.s); } };
    const r = L.rng(11), N = 240, truth = i => 0.25 * Math.sin(2 * Math.PI * 0.5 * i / 30), raw = Array.from({ length: N }, (_, i) => truth(i) + L.gauss(r) * 0.06);
    function gauss(buf, sigma) { if (!sigma) return buf[buf.length - 1]; const R = Math.round(4 * sigma), L0 = buf.length; let s = 0, w = 0; for (let k = -R; k <= R; k++) { let j = L0 - 1 + k; while (j < 0 || j >= L0) { j = j < 0 ? -1 - j : 2 * L0 - 1 - j; } const g = Math.exp(-k * k / (2 * sigma * sigma)); s += g * buf[j]; w += g; } return s / w; }
    const filt = (sg, W) => { const o = []; for (let i = 0; i < N; i++) o.push(gauss(raw.slice(Math.max(0, i - W + 1), i + 1), sg)); return o; };
    const rms = a => { let s = 0, v = 0; for (let i = 30; i < N; i++) { s += (a[i] - truth(i)) ** 2; v += ((a[i] - a[i - 1]) * 30 - (truth(i) - truth(i - 1)) * 30) ** 2; } return [Math.sqrt(s / (N - 30)), Math.sqrt(v / (N - 30))]; };
    const cache = {}; const get = () => { const key = fi + '_' + win; if (!cache[key]) { const a = filt(SIG[fi], WIN[win]); cache[key] = { a, m: rms(a) }; } return cache[key]; };
    const XP = -12, WP = 15, YP = 0.6, HP = 3.6; panel(G, XP - 0.3, YP - 0.2, -0.3, WP + 0.6, HP + 0.6);
    const rr = ribbon(G, N, COL.bad, 0.03, { opacity: 0.55 }), rf = ribbon(G, N, COL.prim, 0.08, { order: 3 }), rt = ribbon(G, N, COL.white, 0.03, { order: 2, opacity: 0.8 });
    const py = v => YP + HP / 2 + v * 4.0, px = i => XP + WP * i / (N - 1); G.add(lab('红：原始深度  蓝：滤波后  白：真值（合成）', [XP + WP / 2, YP + HP + 0.15, 0], { size: 18 }));
    const rob = robot(COL.prim), ghost = robot(COL.ref, { opacity: 0.4 }); G.add(rob, ghost);
    const ctls = [{ label: '来源', items: ['MeTRAbs', 'HybrIK', 'MDM'], get: () => src, set: k => { src = k; } }, { label: 'σ（帧）', items: ['关', '2', '5', '10'], get: () => fi, set: k => { fi = k; } }, { label: '窗口', items: ['30（代码）', '120（论文）'], get: () => win, set: k => { win = k; } }];
    return { ctls, update(p) {
      setSrc(); const m = Math.max(2, Math.round(p * (N - 1))), g = get(), a = g.a;
      const q = (p * 14) % 1, sk = src === 2 ? 3 : 0, line = [[-13.5, 7, 0.9], [9.3, 7, 0.9]]; flow(line, q, 1);
      B.forEach((b, i) => { glow(b, Math.abs(i - q * 7) < 0.6 ? 0.45 : 0.05); b.material.opacity = 1; }); if (src === 2) { glow(B[0], 0); glow(B[1], 0); }
      const R = [], F = [], T = []; for (let i = 0; i < N; i++) { const j = Math.min(i, m); R.push([px(j), py(raw[j]), 0.02]); F.push([px(j), py(a[j]), 0.06]); T.push([px(j), py(truth(j)), 0.04]); }
      rr.userData.set(R); rf.userData.set(F); rt.userData.set(T);
      const ti = (p * N / 30); pose(rob, clip('walk', ti), [7.2 + a[m] * 6, 0, 0], 3.3, 0); pose(ghost, clip('walk', ti), [7.2 + raw[m] * 6, 0, -1.2], 3.3, 0);
      const r0 = rms(raw); cap(`σ = <b>${SIG[fi]}</b> 帧，窗口 <b>${WIN[win]}</b> · 位置 RMS <b>${(g.m[0] * 100).toFixed(1)} cm</b>（原始 ${(r0[0] * 100).toFixed(1)}）· 差分速度 RMS <b>${g.m[1].toFixed(2)} m/s</b>（原始 ${r0[1].toFixed(2)}）`);
    } };
  }

  /* ---------- scene 11: results; every bar is a number from the paper ---------- */
  function s11(G) {
    let view = +(OPT[0] ?? 0); G.add(L.grid(34, 34)); const sub = new THREE.Group(); G.add(sub);
    const T = [
      { t: '表 1 · 成功率（%）', g: ['AMASS-Train*', 'AMASS-Test*', 'H36M-Motion*'], s: [['UHC RFC', COL.sim, [97.0, 96.4, 87.0]], ['UHC', COL.bad, [84.5, 62.6, 23.6]], ['Ours', COL.prim, [98.9, 96.4, 92.9]], ['Ours-kp', COL.gate, [98.7, 97.1, 95.7]]] },
      { t: '表 2 · H36M-Test-Video* 成功率（%）', g: ['UHC RFC', 'UHC', 'Ours', 'Ours-kp', 'Ours-kp 全关键点'], s: [['', COL.prim, [58.1, 18.1, 88.7, 90.0, 91.9]]] },
      { t: '表 3 · 消融，H36M-Test-Video* 成功率（%）', g: ['R1 基础', 'R2 +RET', 'R3 +MCP', 'R4 +PNN', 'R5 +恢复', 'R6 关键点'], s: [['', COL.prim, [51.2, 59.4, 66.2, 86.9, 88.7, 90.0]]] },
      { t: '表 6 · primitive 数量（含 Pᶠ），成功率（%）', g: ['1', '2', '3', '4', '5'], s: [['', COL.prim, [59.4, 65.6, 80.9, 88.7, 87.5]]] },
      { t: '表 4 · 恢复成功率（%）', g: ['倒地 5s', '倒地 10s', '远离 5s', '远离 10s', '两者 5s', '两者 10s'], s: [['Ours', COL.prim, [95.0, 98.8, 83.7, 99.5, 93.4, 98.8]], ['Ours-kp', COL.gate, [92.5, 94.6, 95.1, 96.0, 79.4, 93.2]]] }
    ];
    let bars = [], last = -1;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = view; const v = T[view], Ng = v.g.length, Ns = v.s.length, gw = Math.min(5.4, 26 / Ng), w = Math.min(1.4, (gw - 0.6) / Ns);
      v.g.forEach((nm, i) => { const x0 = (i - (Ng - 1) / 2) * gw; sub.add(lab(nm, [x0, -0.2, 2.6], { size: 20 }));
        v.s.forEach(([sn, c, vals], j) => { const x = x0 + (j - (Ns - 1) / 2) * (w + 0.08), b = block(w, 1, w, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(vals[i].toFixed(1), [x, 0, 0], { size: 17 }); sub.add(l); bars.push({ b, l, v: vals[i] }); }); });
      if (Ns > 1) v.s.forEach(([sn, c], j) => { sub.add(lab(sn, [-13 + j * 3.6, 8.4, 0], { size: 20, color: '#' + c.toString(16).padStart(6, '0') })); });
      sub.add(lab(v.t, [Ns > 1 ? 6 : 0, 8.4, 0], { size: 23, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const ctls = [{ label: '表', items: ['表 1', '表 2', '表 3', '表 6', '表 4'], get: () => view, set: k => { view = k; } }];
    const MSG = ['UHC 去掉外力就掉很多；PHC 不用外力，训练集 <b>98.9%</b>', '带噪声的视频输入：PHC 约 <b>90%</b>，关键点版略高', 'R3 → R4 这一跳最大：同样的 MCP，加上渐进训练，<b>66.2 → 86.9</b>', '4 个最好，<b>5 个反而低一点</b>；1 → 2 只涨 6.2，因为第 2 个是 Pᶠ', '10 秒内都过 93%；但 Ours 远离 5 秒（83.7）比两者同时（93.4）还低'];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const g = seg(p, 0, 0.5); bars.forEach(({ b, l, v }) => { const h = Math.max(0.02, v / 100 * 7 * g); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.4; });
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
  window.__phcDebug = { toy, get cap() { return $('cap').textContent; } };
})();
