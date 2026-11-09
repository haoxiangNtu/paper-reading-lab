'use strict';
/* MaskedMimic (arXiv 2409.14393, ACM TOG 43(6), SIGGRAPH Asia 2024) taken apart into eleven animated scenes. Network sizes and
   hyperparameters come from the paper and from the official code (NVlabs/ProtoMotions; the paper-time "V1 - Public release"
   commit bacad32, read through a fork made on 2024-09-26, and current main b43fc6f; read only, never run). Each scene's update(p)
   is a pure function of the timeline p plus the current toggles. The humanoid is hand-made (same as interactives/phc and pulse).
   Scenes 3, 4, 5, 6, 7 and 9 compute their numbers live; the toys are labelled as toys. No MaskedMimic network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { fc: 0xf2a0a0, enc: 0xf2c14e, prior: 0x4fc98a, dec: 0x3aa8e0, mask: 0xb48cff, text: 0x9d8cff, obj: 0x5fd0c0, terr: 0x8a6a4a, pos: 0x38d1ff, rot: 0xf0963c, hid: 0x39415a, ok: 0x4fc98a, bad: 0xe05d5d, sim: 0x8e9bb8, data: 0x7cb8ff, ref: 0xe05d5d, robot: 0xc9d4ea, ppo: 0x9d8cff, gold: 0xf2c14e, dim: 0x46506a, white: 0xeef2fa, frozen: 0x5f7fb0 };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  const SCENES = [
    { n: 1, part: '总览', title: '两段训练，一段推理', sub: '图 3 的 3D 版。点方块跳到对应那一幕', dur: 15, cam: [0.1, 1.12, 38, [0.6, 4.0, 0]],
      html: dl([['第 1 段', '全身跟踪器 π^FC：看完整的未来目标姿态，强化学习训练（附录 B.1 写 A2C）'], ['第 2 段', 'MaskedMimic π^PC：看被遮挡的目标，学生自己跑，π^FC 给每一步标动作（DAgger）'], ['推理', '编码器丢掉，只用先验 ρ 和解码器 D；用户给部分约束'], ['潜码', 'z ∈ ℝ⁶⁴，30 Hz'], ['动作', '69 维 PD 目标（指数映射）']]) +
        '<p>论文把物理角色控制看成“动作补全”（inpainting）：只给一部分约束，比如头的位置、一句话、一把椅子，让模型补出整个身体怎么动。做法是先训一个什么都看得见的跟踪器，再把它蒸馏到一个只看得见部分信息的学生里。</p>' +
        '<p>学生是条件 VAE：编码器看完整目标，先验只看遮挡后的目标，两者在潜空间里对齐（第 7 幕）。训完后不再训练任何任务，靠“目标工程”（goal-engineering）——用一个小状态机在不同时刻喂不同的约束——完成新任务（第 10 幕）。</p>' +
        src('§4 · 图 3 · §6.2') },
    { n: 2, part: '§5.1 · 附录 A', title: '跟踪器看什么、输出什么', sub: '本体 358 维、未来目标姿态、16×16 高度图、69 维动作', dur: 13, cam: [0.55, 1.08, 20, [1.6, 2.0, 0]],
      html: dl([['本体 s_t', '358 维：根高、根旋转、各关节局部旋转（切向和法向两个 3D 向量）和速度、手脚位置（附录 A）'], ['目标', '式 (4)：每个关节相对当前关节、相对根的旋转差和位置差，再加到达时间 τ'], ['高度图', '16×16 个点，间距 10 cm，随角色朝向旋转'], ['动作', 'PD 目标，球关节用 3D 指数映射，共 69 维'], ['方差', '固定对角，σ = exp(−2.9) ≈ 0.055']]) +
        '<p>论文说 π^FC 看“接下来 K 个目标姿态”，但没有给 FC 的 K；附录 B.2 的 K = 11 是 MaskedMimic 的。V1 代码里 FC 看 15 个未来帧（每关节 18 个数加 1 个时间），MaskedMimic 看 10 个近期帧加 1 个远期帧。</p>' +
        '<p>代码的仿真是 60 fps × 2 子步 = 120 Hz，控制隔 2 帧一次 = 30 Hz，和 §7 一致。</p>' +
        guess('右边的鬼影小人是手写的动作，只为看出“未来几帧”。高度图的地形是正弦起伏，不是论文的地形生成器。') +
        src('§5.1 式 (3)(4) · 附录 A · V1 opt/mimic/transformer/target_pose_with_time_obs.yaml · terrain/flat.yaml · env/humanoid.yaml') },
    { n: 3, part: '§5.3 · 附录 B.1', title: '跟踪奖励：五项加一个能耗', sub: '切换误差大小，当场算每一项', dur: 12, cam: [0.15, 1.18, 22, [1.5, 3.2, 0]],
      html: dl([['式 (5)', 'r = w_gp r^gp + w_gr r^gr + w_rh r^rh + w_jv r^jv + w_jav r^jav + w_eg r^eg'], ['权重 (10)', 'gr 0.3，gt 0.5，jv 0.1，jav 0.1，rh 0.2，能耗 0.0005'], ['系数 (11)', 'gr 2，gt 100，jv 0.5，jav 0.1，rh 100'], ['代码', 'V1 global_tracking.yaml 的权重和系数与 (10)(11) 完全一致']]) +
        '<p>论文正文只列了各项的名字，具体形式放在“补充材料”里，附录只给了系数。V1 代码的形式是 w·exp(−c·误差)：位置、速度项是平方误差先对 xyz 平均再对关节平均；全局旋转项是四元数角度差（不平方）的关节平均；根高是平方差；能耗是 −Σ|τ·q̇|，再乘 0.0005。</p>' +
        '<p>五项满分加起来是 0.3 + 0.5 + 0.1 + 0.1 + 0.2 = 1.2。式 (5) 写 gp，式 (10)(11) 写 gt，指同一项（全局位置）。</p>' +
        toyb('误差的组合是我设的：每个关节沿一个轴偏 e，根高也偏 e，旋转偏 3e 弧度/米，速度误差 10e/秒。每一项按 V1 代码的公式当场算。') +
        src('§5.3 式 (5) · 附录 B.1 式 (10)(11) · V1 envs/mimic/mimic_utils.py exp_tracking_reward · opt/mimic/global_tracking.yaml') },
    { n: 4, part: '§5.4–5.5', title: '训练场、早停、按失败率采样', sub: '平地 0.25 m、起伏地形 0.5 m；失败越多越常被抽到', dur: 15, cam: [0.3, 1.05, 46, [5.6, 2.6, 0]],
      html: dl([['三块区域', '平地（还原原始动作）、起伏地形（台阶、碎石、坡）、物体区（椅子、桌子、沙发）'], ['早停', '平地任一关节偏 > 0.25 m；起伏地形 > 0.5 m'], ['优先采样', '概率 ∝ 该动作的失败概率，下限 3×10⁻³；只统计平地上的失败'], ['代码', 'early_termination_tracking_err.yaml：0.5 / 0.25，取最大关节误差']]) +
        '<p>不涉及物体的动作可以在平地或起伏地形的任意位置出生；涉及物体的只在物体区出生。地形上的动作仍然来自平地动捕，所以在台阶上做后空翻本来就可能做不到——这就是为什么优先采样只统计平地上的失败。</p>' +
        '<p>V1 代码的优先采样按“早停桶”统计，最小权重取 max(1/桶数, min_bucket_weight)，默认 min_bucket_weight = 0，和论文写的 3×10⁻³ 不是同一个参数。我没有找到 3×10⁻³。</p>' +
        toyb('右边 8 个动作的失败率是我设的。份额按论文的规则（∝ 失败率，下限 3×10⁻³）当场归一化。') +
        src('§5.4 · §5.5 · 图 4 · V1 opt/mimic/early_termination_tracking_err.yaml · envs/mimic/common.py:205-220') },
    { n: 5, part: '附录 B.1', title: 'A2C 还是 PPO', sub: '一轮数据怎么用：一步梯度，还是 48 步裁剪更新。当场算的玩具', dur: 16, cam: [0, 1.2, 28, [0.2, 3.6, 0]],
      html: dl([['论文正文', '“用强化学习优化 [Mnih 2016; Peng 2018]”'], ['附录 B.1', '“用 A2C 训练……A2C 更稳定……为了保证在策略，在整轮数据上做梯度累积”'], ['V1 代码默认', 'PPO：e_clip 0.2，num_mini_epochs 6，batch 16384，gradient_accumulation_steps 1'], ['一轮数据', '每卡 4096 环境 × 32 步 = 131,072 个样本 = 8 个小批']]) +
        '<p>这一幕是给 <a href="../../papers/supermimic.html">SuperMimic</a> 表 1 的“模仿：A2C”做核对。论文附录确实写的是 A2C。实现上 A2C 可以看成 PPO 的特例：一轮数据只走<b>一步</b>梯度（8 个小批的梯度累加），这时新旧策略相同，比值恒为 1，裁剪永远不触发，PPO 的目标就退化成带 GAE 优势的策略梯度。</p>' +
        '<p>V1 代码的默认值是普通 PPO：一轮数据走 6 × 8 = 48 步。把 num_mini_epochs 设 1、gradient_accumulation_steps 设 ≤ 0 就得到论文说的 A2C。仓库里的 full_body_tracker 实验没有改这两个值，所以“发布的默认配置”和“论文写的训练方式”不一样。</p>' +
        toyb('一维高斯策略 a ~ N(μ, 0.055)，奖励 −(a − 0.3)²，4096 个样本分 8 个小批，优势归一化，SGD 学习率 0.001。两种更新都当场算：读数是一轮后 μ 移动了几个 σ，以及 PPO 最后一步有多少样本被裁剪。学习率和奖励是我设的。') +
        src('§5.1 · 附录 B.1 · V1 config/algo/ppo.yaml · agents/ppo.py:352-380, 679-690') },
    { n: 6, part: '§6.3 · 附录 B.2', title: '结构化遮挡：哪些关节、哪些帧看得见', sub: '核心。6 个可条件关节 × 位置/旋转 × 5 秒。切换采样规则，看统计', dur: 18, cam: [0, 1.2, 26, [1.2, 3.2, 0]],
      html: dl([['可条件关节', '左踝、右踝、骨盆、头、左手、右手（§7）'], ['重复', '每步 98% 沿用上一步的遮挡，2% 重新抽'], ['重新抽', '90% 情况上限 6 个关节、10% 上限 3 个；个数 = round(U·(上限−1)+1)；每个关节三选一：只位置、位置和旋转、只旋转'], ['时间空档', '1% 概率开始一段 1–9 步全遮的空档；有文本/物体/远期目标时空档 ×4'], ['文本、物体', '文本 80% 遮掉；物体 20% 遮掉；远期目标姿态 20% 给出']]) +
        '<p>论文发现：如果每一步都重新随机遮挡，不同帧露出不同关节，拼起来几乎等于看到了全身，训练时的歧义太小，模型泛化变差。所以遮挡要在时间上“粘”住：同一组关节连续很多帧可见，其余一直不可见。表 6 里去掉结构化遮挡，坐椅子任务成功率从 96.9% 掉到 0%。</p>' +
        '<p>V1 代码的配置和附录 B.2 的数字有几处不同：时间空档概率 0.1（论文 1%），空档长度 1–11（论文 1–9），文本可见 0.5（论文 0.2），远期目标姿态可见 0（论文 0.2）；代码还额外有 10% 概率强制 6 个关节全可见。物体可见 0.8 和论文一致。</p>' +
        toyb('格子是按附录 B.2 的规则（或 V1 代码的参数）当场用固定种子抽的 150 步。读数是遮挡模式平均持续多少步、全遮空档占多少比例、平均可见几个关节。和论文没有可比的数字，只看规则的效果。') +
        src('§6.3 · 附录 B.2 · 清单 1 · 表 6 · V1 env/masked_mimic.yaml · envs/masked_mimic/common.py:204-360') },
    { n: 7, part: '§6.2 · 式 (6)–(9)', title: '残差先验：编码器只给一个偏移', sub: '两维切片上当场算 KL；切换残差和非残差、回合内固定噪声', dur: 14, cam: [0, 1.22, 26, [1.4, 2.6, 0]],
      html: dl([['先验 ρ', 'N(μ_ρ(s, g^partial), σ_ρ)，只看部分目标'], ['编码器 E', 'N(μ_ρ + μ_E(s, g^full), σ_E)，看完整目标，只训练时用'], ['解码器 D', 'D(a | s, z)，输出确定性动作'], ['KL', 'Σ log(σ_ρ/σ_E) + (σ_E² + μ_E²)/(2σ_ρ²) − 1/2'], ['表 6', '去掉残差先验：成功 21.1%，误差 57.4 cm']]) +
        '<p>编码器写成先验的残差（借自 ControlVAE）。把式 (6)(7) 代进高斯 KL，μ_ρ 正好消掉，KL 只惩罚偏移 μ_E 的大小和两个方差的差别。V1 代码 kl_loss 就是这样写的（residual_encoder: True 分支）。</p>' +
        '<p>一个推论：KL 项对 μ_ρ 没有梯度，先验均值只能通过解码器的动作损失学习（z = μ_ρ + μ_E + σ_E ε）。推理时 ε = 0、μ_E 不存在，z = μ_ρ，所以先验均值本身就得是一个“能用的”潜码。这是我从公式推的，论文只说残差的归纳偏置让先验“正确地控制潜空间”。</p>' +
        '<p>回合内固定噪声：ε 在一个回合开始时抽一次，整个回合不变（附录 B 式 (9)）。</p>' +
        toyb('只画 64 维中的两维。μ_ρ、σ_ρ、μ_E、σ_E 的轨迹是我设的；KL 按上式当场算，只算这两维。') +
        src('§6.2 式 (6)(7)(8) · 附录 B 式 (9) · 表 6 · V1 agents/models/actor.py:147-265') },
    { n: 8, part: '§6.4–6.5 · 附录 B', title: '先验是一个 Transformer：一种输入一种 token', sub: '切换任务，看哪些 token 被遮掉', dur: 13, cam: [0, 1.15, 28, [0.5, 3.2, 0]],
      html: dl([['token', '当前姿态 1、高度图 1、历史姿态 5、文本 1、物体 1、目标姿态 11'], ['编码器', '每种输入一个 MLP [256, 256]，同种输入共享'], ['Transformer', '宽 512，前馈 1024，4 层，4 头，无 dropout'], ['输出', '取第一个输出 → 两个头 256 → 128 → 64，得 μ 和 log σ'], ['被遮的 token', '用注意力掩码排除，不参与']]) +
        '<p>关键帧 token：每个约束 12 维（相对当前坐标系 6 维、相对对应身体部位 6 维；位置从 3 维补零到 6 维，旋转本来就是 6 维），再拼上遮挡标记和到达时间。物体：包围盒 8 个角各 3 维、朝向 6 维、类别 1 维；文本：XCLIP 512 维。</p>' +
        '<p>V1 代码的数字：历史存 120 帧、取 15 个（论文写存 40 帧、取 5 个，都是每 8 帧取 1 个）；物体 37 维 = 24 + 6 + 7 维类别独热（论文写 1 维索引）；目标姿态 token 184 维 = 7 × 24 + 7 × 2 + 2（6 个关节外加 1 个条目，代码注释说放速度和朝向）。</p>' +
        '<p>图 10 只画了目标姿态、文本、物体、地形、当前姿态五种编码器，没有历史姿态；图 5b 和正文都有历史。</p>' +
        src('§6.4 · §6.5 · 附录 B · 图 5b · 图 10 · V1 opt/masked_mimic/transformer.yaml、historical_pose_obs.yaml、samp_scenes.yaml') },
    { n: 9, part: '§6.2–6.3 · 附录 B.1', title: '蒸馏：学生跑，老师标注，KL 慢慢加', sub: '下面的曲线是 KL 系数随 epoch 变化；切换论文、V1 发布版、两天后的修正', dur: 16, cam: [0, 1.2, 28, [0.8, 3.4, 0]],
      html: dl([['数据', '学生 π^PC 用确定性动作在仿真里跑，遇到早停就重置'], ['标签', '冻结的 π^FC 看完整目标，给出均值动作'], ['损失', '式 (8)：动作对数似然 − α·KL；V1 代码是动作的均方误差（相当于固定方差的高斯）'], ['KL 系数', '从 10⁻⁴ 线性升到 10⁻²，从第 3000 个 epoch 开始，用 6000 个 epoch'], ['规模', '16,384 环境，4 张 A100，约 10¹⁰ 步']]) +
        '<p>这就是 DAgger：状态分布来自学生自己，标签来自老师。V1 配置 collect_data_with_expert: False，数据全由学生采；only_bc: True，没有任何强化学习项。所以 SuperMimic 表 1 把潜变量和下游合在一起、标“DAgger”是对的。</p>' +
        '<p>按 10¹⁰ 步、每个 epoch 16384 × 32 = 524,288 步算，一共约 19,073 个 epoch；KL 系数在第 9000 个 epoch 到顶，约是训练的 47%。V1 代码默认 training_max_steps 正好是 10¹⁰，max_epochs 公式给出同一个数。</p>' +
        '<p><b>V1 发布版的一个错：</b>mimic_vae.py 用 <code>self.config.get("vae_kld_schedule")</code> 找 KL 日程，但配置放在 <code>vae.vae_kld_schedule</code> 下，按字面这个条件永远不成立，KL 项不会被加进损失。两天后的提交 6ac71e1（2024-09-27，“Fixing incorrect config fields”）改成了 <code>self.config.vae.vae_kld_schedule</code>。我没有运行代码，这是按源码读的。论文结果显然不是用发布版这一行训出来的。</p>' +
        src('§6.2 式 (8) · §6.3 · §7 · 附录 B.1 · V1 agents/mimic_vae.py:111-130 · mimic_vae_dagger.py · algo/mimic_vae.yaml · 提交 6ac71e1') },
    { n: 10, part: '§8.2–8.3', title: '目标工程：用状态机换约束', sub: '切换任务：坐椅子、路径跟随、转向、伸手', dur: 18, cam: [0.4, 1.05, 24, [0, 2.0, 0]],
      html: dl([['坐椅子', '离椅子 > 2 m：朝向椅子 1 m/s 的方向目标 + 文本“the person walks normally”；≤ 2 m：撤掉两者，只给椅子包围盒'], ['路径跟随', '头部的位置和朝向：未来 5 步 + 0.8 s 后一个；偏离 > 0.4 m 时只给 0.8 s 那个'], ['转向', '先给骨盆朝向和剩余时间，再给 1 s 后的骨盆位置（高 0.9 m）和朝向'], ['伸手', '右手目标位置，剩余时间最多给到 1/6 s（原文）']]) +
        '<p>每个任务都没有专门训练，只是把用户意图翻译成 MaskedMimic 训练时见过的约束类型。论文观察到一个取舍：约束给得越松（比如只给远处的目标），成功率越高、误差越小，但用户能控制的就越少。</p>' +
        '<p>伸手任务原文写“剩余时间最多 1/6 秒”，但同时说给更远的目标让模型更灵活。V1 代码 reach 任务用的是 max(到达剩余步数 − 10, 3) 步，不是固定的 1/6 s。</p>' +
        guess('场景、路线和小人动作是手写的；状态机的切换条件（2 m、0.4 m、0.8 s、1 s、0.9 m）按论文。') +
        src('§8.2 · §8.3 · 图 7 · 图 8 · V1 envs/masked_mimic/tasks/*') },
    { n: 11, part: '§8 结果', title: '结果表，以及测试集到底是哪一个', sub: '柱子是原文数字。切换表格', dur: 14, cam: [0, 1.15, 34, [0, 4.2, 0]],
      html: dl([['表 1', 'FC 测试 99.9%，MaskedMimic 99.2%；PHC+ 99.2%，PULSE 97.1%'], ['表 2', 'VR 测试：MaskedMimic 98.1%，PULSE 93.4%'], ['表 3', '只看脚最难：91.8%'], ['表 5', '路径 96.3%，转向 97.8%，伸手 88.7%（平地）'], ['表 6', '去掉结构化遮挡 0%，去掉残差先验 21.1%']]) +
        '<p>表 1、表 2 里 PHC+、PULSE、ASE、CALM 的数字和 <a href="../../papers/pulse.html">PULSE</a> 论文表 1、表 2 一字不差，是照搬的，测试集是 PULSE 的 138 条。但 MaskedMimic 自己的测试成功率（99.9、99.2、99.1、98.4、98.1、97.9、93.4、91.8……）没有一个能写成 k/138；它们全部能写成 k/1776。V1 代码 data/yaml_files/amass_test.yaml 正好是 1776 条（HumanML3D 的测试划分），训练集 8327 条、镜像后 16654 条。所以我推测两边的测试集不同，表 1、表 2 的横向比较要打折扣。论文没说测试集有多少条，这一点未核实。</p>' +
        src('§8.1 表 1–4 · §8.2 表 5 · §8.3 表 6 · PULSE 表 1、表 2 · V1 data/yaml_files') }
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
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: Math.round((o.size || 24) * 1.2), pos, color: o.color, border: o.border, bg: o.bg });
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


  /* joint markers on a standing robot (local coordinates of the hand-made humanoid, facing +z) */
  const JLOC = { lAnk: [0.09, -0.6, 0.02], rAnk: [-0.09, -0.6, 0.02], pelvis: [0, 0, 0], head: [0, 0.48, 0], lHand: [0.2, -0.05, 0.02], rHand: [-0.2, -0.05, 0.02] };
  const JNAMES = [['lAnk', '左踝'], ['rAnk', '右踝'], ['pelvis', '骨盆'], ['head', '头'], ['lHand', '左手'], ['rHand', '右手']];
  const jpos = (k, at, sc) => [at[0] + JLOC[k][0] * sc, at[1] + (STAND + JLOC[k][1]) * sc, at[2] + JLOC[k][2] * sc];
  /* a straight polyline drawn as a ribbon; xs, ys in world units */
  function curve(G, n, color, w, o) { return ribbon(G, n, color, w, o); }

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    const st = [[-12.5, '1 · 全身跟踪器 π^FC（RL）', '#f2a0a0'], [0.5, '2 · MaskedMimic π^PC（DAgger 蒸馏）', '#b48cff'], [13.5, '3 · 推理（不再训练）', '#4fc98a']];
    st.forEach(([x, t, c]) => { G.add(block(11.6, 0.25, 6, COL.dim, [x, -0.15, 0], { opacity: 0.55 }), lab(t, [x, 9.3, 0], { size: 22, color: c })); });
    const data = block(2.4, 1.2, 1.6, COL.data, [-16.4, 1.0, 0]); G.add(data, lab('AMASS（镜像）\nHumanML3D 文本\nSAMP 物体', [-16.4, 2.6, 0], { size: 15 }));
    const fc = block(2.2, 2.4, 1.4, COL.fc, [-12.5, 3.4, 0]); G.add(fc, lab('π^FC\nTransformer', [-12.5, 5.4, 0], { size: 17 }));
    const env1 = block(2.0, 1.4, 1.4, COL.sim, [-8.6, 1.0, 0]); G.add(env1, lab('仿真 + 奖励', [-8.6, 2.2, 0], { size: 16 }));
    const teach = block(1.8, 1.8, 1.2, COL.frozen, [-3.6, 6.2, 0]); G.add(teach, lab('π^FC（冻结）', [-3.6, 7.6, 0], { size: 16 }));
    const mk = block(1.1, 1.1, 1.1, COL.mask, [-3.8, 2.2, 0]); mk.rotation.z = Math.PI / 4; G.add(mk, lab('遮挡 M', [-3.8, 0.9, 1.2], { size: 16 }));
    const enc = block(1.6, 1.6, 1.3, COL.enc, [-0.6, 4.6, 0]), pri = block(1.6, 1.6, 1.3, COL.prior, [-0.6, 1.8, 0]), dec = block(1.6, 1.8, 1.3, COL.dec, [3.6, 3.2, 0]);
    const zb = L.sphere(0.4, COL.gold, { emissive: 0x332200 }); zb.position.set(1.6, 3.2, 0); G.add(enc, pri, dec, zb);
    G.add(lab('编码器 E', [-0.6, 5.85, 0], { size: 16 }), lab('先验 ρ', [-0.6, 0.6, 0.9], { size: 16 }), lab('解码器 D', [3.6, 4.55, 0], { size: 16 }), lab('z ∈ ℝ⁶⁴', [1.6, 3.95, 0], { size: 15 }), lab('标注 a^FC', [1.6, 7.0, 0], { size: 15 }));
    const user = block(2.2, 1.2, 1.4, COL.text, [9.4, 3.2, 0]); G.add(user, lab('用户约束\n头的路径 / 一句话 / 椅子', [9.4, 5.0, 0], { size: 15 }));
    const pri2 = block(1.6, 1.6, 1.3, COL.prior, [12.4, 3.2, 0]), dec2 = block(1.6, 1.8, 1.3, COL.dec, [15.0, 3.2, 0]);
    G.add(pri2, dec2, lab('ρ', [12.4, 4.4, 0], { size: 17 }), lab('D', [15.0, 4.5, 0], { size: 17 }), lab('z = μ_ρ', [13.7, 2.0, 0.9], { size: 15 }));
    const r1 = robot(COL.robot); G.add(r1); const r2 = robot(COL.mask); G.add(r2); const r3 = robot(COL.prior); G.add(r3);
    [[data, 1], [fc, 1], [env1, 2], [teach, 8], [mk, 5], [enc, 6], [pri, 6], [dec, 6], [user, 9], [pri2, 7], [dec2, 9]].forEach(([m, g]) => { m.userData.go = g; PICKS.push(m); });
    const f = { a: stream(G, 5, COL.data), b: stream(G, 5, COL.fc), c: stream(G, 5, COL.mask), d: stream(G, 5, COL.enc), e: stream(G, 5, COL.prior), g: stream(G, 5, COL.text), h: stream(G, 4, COL.frozen) };
    wire(G, [[-3.6, 7.1, 0], [1.6, 6.8, 0], [3.6, 4.2, 0]], COL.frozen, { dashed: true, opacity: 0.55 });
    return { update(p) {
      const q = (p * 20) % 1, a = seg(p, 0, 0.06) * (1 - seg(p, 0.32, 0.37)), b = seg(p, 0.33, 0.4) * (1 - seg(p, 0.66, 0.71)), c = seg(p, 0.66, 0.73);
      f.a([[-16.4, 1.6, 0], [-14.2, 3.0, 0], [-12.5, 3.4, 0]], q, a); f.b([[-12.5, 3.4, 0], [-10.5, 1.6, 0], [-8.6, 1.0, 0], [-12.5, 2.0, 0]], q, a);
      f.c([[-6.4, 1.6, 0], [-3.8, 2.2, 0], [-0.6, 1.8, 0]], q, b); f.d([[-3.6, 5.2, 0], [-0.6, 4.6, 0], [1.6, 3.2, 0]], q, b); f.e([[-0.6, 1.8, 0], [1.6, 3.2, 0], [3.6, 3.2, 0]], q, b); f.h([[-3.6, 7.1, 0], [1.6, 6.8, 0], [3.6, 4.2, 0]], q, b);
      f.g([[9.4, 3.2, 0], [12.4, 3.2, 0], [15.0, 3.2, 0], [16.8, 3.2, 0]], q, c);
      [fc, env1].forEach(m => glow(m, 0.6 * a)); [teach, mk, enc, pri, dec].forEach(m => glow(m, 0.6 * b)); [user, pri2, dec2].forEach(m => glow(m, 0.6 * c));
      pose(r1, clip('skip', p * 14), [-8.6, 1.7, 1.9], 1.6, Math.PI / 2); pose(r2, clip('walk', p * 14), [6.4, 0, 1.6], 2.2, Math.PI / 2); pose(r3, clip('walk', p * 14), [16.2, 0, 2.2], 2.2, Math.PI / 2);
      r1.visible = p < 0.33; r2.visible = p >= 0.33 && p < 0.66; r3.visible = p >= 0.66;
      cap(p < 0.33 ? '第 1 段：π^FC 看到<b>完整</b>的未来目标姿态，强化学习训练跟踪奖励' : p < 0.66 ? '第 2 段：学生只看<b>遮挡后</b>的目标；学生自己跑，冻结的 π^FC 给每一步标动作' : '推理：<b>编码器丢掉</b>，用户给部分约束，先验均值 μ_ρ 当潜码，解码出动作');
    } };
  }

  /* ---------- scene 2: inputs and outputs ---------- */
  function s2(G) {
    let k = +(OPT[0] ?? 0);
    const rob = robot(COL.robot); G.add(rob); const ghosts = []; for (let i = 0; i < 15; i++) { const g = robot(COL.ref, { opacity: 0.22 }); G.add(g); ghosts.push(g); }
    const N = 16, hm = dots(G, N * N, COL.terr, 0.05); const H = (x, z) => 0.18 * Math.sin(1.3 * x) * Math.cos(0.9 * z);
    const tb = liveLab(G, [6.6, 6.0, 0], { size: 17, border: 'rgba(242,160,160,.7)' });
    G.add(lab('s_t：358 维（附录 A）', [6.6, 4.8, 0], { size: 17 }), lab('h_t：16 × 16 = 256 个高度，间距 10 cm', [6.6, 3.9, 0], { size: 17, color: '#c8a27a' }), lab('a_t：69 维 PD 目标，σ = e^−2.9', [6.6, 3.0, 0], { size: 17, color: '#f0963c' }), lab('式 (4)：每关节 4 项差 + 到达时间 τ', [6.6, 2.1, 0], { size: 17 }));
    const ctls = [{ label: '看几帧', items: ['π^FC（V1 代码：15 帧）', 'π^PC（10 帧 + 1 个远期）'], get: () => k, set: j => { k = j; } }];
    return { ctls, update(p) {
      const t = p * 10, x0 = -2.6 + 2.2 * p; pose(rob, clip('walk', t), [x0, 0, 0], 2.2, Math.PI / 2);
      const n = k === 0 ? 15 : 11;
      ghosts.forEach((g, i) => { g.visible = i < n; if (!g.visible) return; const far = k === 1 && i === 10, dt = far ? 1.6 : (i + 1) / 30; const tt = t + dt * 1.1; pose(g, clip('walk', tt), [x0 + (far ? 4.2 : 0.24 * (i + 1)), 0, 0], 2.2, Math.PI / 2); g.traverse(o => { if (o.material) o.material.opacity = far ? 0.45 : 0.28 - i * 0.012; }); });
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const dx = (i - 7.5) * 0.1 * 2.2, dz = (j - 7.5) * 0.1 * 2.2, xx = x0 + dx; setI(hm, i * N + j, [xx, H(xx, dz) + 0.05, dz], 0.05); } done(hm);
      tb(k === 0 ? 'π^FC：未来 15 帧 × (24 关节 × 18 + 1) 维（V1）' : 'π^PC：近 10 帧 + 1 个远期帧，每帧 184 维（V1）');
      cap(k === 0 ? '跟踪器：当前状态 + <b>未来 15 帧完整姿态</b> + 高度图 → 69 维 PD 目标' : 'MaskedMimic 的目标：<b>近 10 帧 + 1 个远期帧</b>，但每帧只露出部分关节（第 6 幕）');
    } };
  }

  /* ---------- scene 3: tracking reward, computed with the V1 formula ---------- */
  function s3(G) {
    let k = +(OPT[0] ?? 1); const E = [0.02, 0.05, 0.1, 0.2];
    const W = { gt: 0.5, gr: 0.3, rh: 0.2, gv: 0.1, gav: 0.1 }, C = { gt: 100, gr: 2, rh: 100, gv: 0.5, gav: 0.1 };
    const terms = e => ({ gt: Math.exp(-C.gt * e * e / 3), gr: Math.exp(-C.gr * 3 * e), rh: Math.exp(-C.rh * e * e), gv: Math.exp(-C.gv * (10 * e) ** 2 / 3), gav: Math.exp(-C.gav * (10 * e) ** 2 / 3) });
    const rob = robot(COL.robot), ref = robot(COL.ref, { opacity: 0.35 }); G.add(rob, ref);
    const names = [['gt', '全局位置 gt'], ['gr', '全局旋转 gr'], ['rh', '根高 rh'], ['gv', '线速度 jv'], ['gav', '角速度 jav']];
    const bars = names.map(([key, nm], i) => { const b = bar(G, 3.0 + i * 1.6, 0, 1.0, [COL.pos, COL.rot, COL.gold, COL.prior, COL.text][i]); const v = liveLab(G, [3.0 + i * 1.6, W[key] * 6 + 0.6, 0], { size: 15 }); G.add(lab(`${nm}\nw = ${W[key]}`, [3.0 + i * 1.6, -0.9, 1.2], { size: 14 })); const cap0 = block(1.04, 0.04, 1.04, COL.white, [3.0 + i * 1.6, W[key] * 6, 0], { opacity: 0.5, edges: false }); G.add(cap0); return { key, b, v }; });
    const tot = liveLab(G, [6.2, 8.0, 0], { size: 20, border: 'rgba(56,209,255,.7)' });
    G.add(lab('白线：每项满分 w；柱高：w·exp(−c·误差)', [6.2, 7.0, 0], { size: 15 }));
    const ctls = [{ label: '误差 e', items: E.map(e => `${e * 100} cm`), get: () => k, set: j => { k = j; } }];
    return { ctls, update(p) {
      const e = E[k] * seg(p, 0.05, 0.5), q = clip('walk', p * 8); pose(ref, q, [-3, 0, 0], 2.4, Math.PI / 2); pose(rob, drift(q, e * 0.6), [-3 + e * 2.4, 0, 0], 2.4, Math.PI / 2);
      const T = terms(e); let s = 0; bars.forEach(({ key, b, v }) => { const r = W[key] * T[key]; s += r; b.userData.set(Math.max(0.02, r * 6)); v(r.toFixed(3)); });
      tot(`r = ${s.toFixed(3)} / 1.2（再减能耗项）`);
      cap(`每个关节偏 <b>${(e * 100).toFixed(1)} cm</b>：位置项 exp(−100·e²/3) = <b>${T.gt.toFixed(3)}</b>，根高 exp(−100·e²) = <b>${T.rh.toFixed(3)}</b>（V1 代码的形式，论文正文没给）`);
    } };
  }

  /* ---------- scene 4: playground, early termination, prioritized sampling ---------- */
  function s4(G) {
    const regions = [[-11, '平地', COL.sim], [-3, '起伏地形', COL.terr], [5, '物体区', COL.obj]];
    regions.forEach(([x, t, c]) => { G.add(block(7.2, 0.1, 6, c, [x, -0.05, 0], { opacity: 0.35 }), lab(t, [x, 6.4, -2.6], { size: 20 })); });
    for (let i = 0; i < 5; i++) G.add(block(1.2, 0.25 * (i + 1), 3, COL.terr, [-5.4 + i * 1.2, 0.125 * (i + 1), -1.2], { opacity: 0.8 }));
    const chair = new THREE.Group(); chair.add(block(1.2, 0.5, 1.2, COL.obj, [0, 0.25, 0]), block(1.2, 1.2, 0.2, COL.obj, [0, 0.85, -0.5])); chair.position.set(6.0, 0, 0.6); G.add(chair);
    const rob = robot(COL.robot); G.add(rob); const rg = ring(G, COL.bad, 0.9); rg.rotation.x = -Math.PI / 2;
    const thr = liveLab(G, [-3, 5.4, -2.6], { size: 17, border: 'rgba(224,93,93,.7)' });
    const FAIL = [0, 0.0005, 0.004, 0.02, 0.08, 0.2, 0.45, 0.9], w = FAIL.map(f => Math.max(f, 3e-3)), Z = w.reduce((a, b) => a + b, 0), share = w.map(x => x / Z);
    G.add(lab('8 个动作的抽样份额（玩具）', [13.0, 7.4, 0], { size: 17, border: 'rgba(240,150,60,.7)' }));
    const bs = FAIL.map((f, i) => { const b = bar(G, 9.2 + i * 1.1, 0, 0.8, i > 5 ? COL.bad : COL.ppo); G.add(lab(`f=${f}`, [9.2 + i * 1.1, -0.6, 1.0], { size: 12 })); const v = lab(`${(share[i] * 100).toFixed(1)}%`, [9.2 + i * 1.1, 0, 0], { size: 13 }); G.add(v); return { b, v, s: share[i] }; });
    return { update(p) {
      const x = -13.5 + 22 * p, t = p * 16, reg = x < -7 ? 0 : x < 1 ? 1 : 2;
      let q, y = 0; if (reg === 2 && x > 5.4) { const u = seg(x, 5.4, 7); q = qmix(clip('walk', t), { p: [0, 0.42, 0], pitch: 0, hL: 1.5, hR: 1.5, kL: 1.5, kR: 1.5, sL: 0.2, sR: 0.2, eL: 0.4, eR: 0.4 }, u); } else q = clip('walk', t);
      if (reg === 1) { const i = clamp(Math.floor((x + 6) / 1.2), -1, 4); y = i >= 0 ? 0.25 * (i + 1) * 0 : 0; }
      const xx = Math.min(x, 6.0); pose(rob, q, [xx, y, 0.6], 2.4, Math.PI / 2);
      const r = reg === 1 ? 0.5 : 0.25; rg.scale.setScalar(r * 2.4 * 2); rg.position.set(xx, 0.03, 0.6);
      thr(reg === 1 ? '早停阈值 0.5 m' : '早停阈值 0.25 m');
      const g = seg(p, 0.05, 0.4); bs.forEach(({ b, v, s }) => { const h = Math.max(0.02, s * 14 * g); b.userData.set(h); v.position.y = h + 0.4; });
      cap(reg === 0 ? '平地：任一关节偏离 > <b>0.25 m</b> 就结束回合；失败率只在这里统计' : reg === 1 ? '起伏地形：放宽到 <b>0.5 m</b>，允许改动原动作去适应台阶和坡' : '物体区：只有带物体交互的动作在这里出生');
    } };
  }

  /* ---------- scene 5: A2C vs PPO on a 1-D Gaussian policy toy, computed on load ---------- */
  function buildA2C() {
    const r = rng(7), N = 4096, MB = 8, sig = Math.exp(-2.9), lr = 0.001, eps = 0.2, mu0 = 0;
    const a = Array.from({ length: N }, () => mu0 + sig * L.gauss(r)), R = a.map(x => -((x - 0.3) ** 2));
    const m = R.reduce((s, x) => s + x, 0) / N, sd = Math.sqrt(R.reduce((s, x) => s + (x - m) ** 2, 0) / N), A = R.map(x => (x - m) / sd);
    const logp = (x, mu) => -((x - mu) ** 2) / (2 * sig * sig);
    const idx = Array.from({ length: N }, (_, i) => i);
    // A2C: one step on the full batch (gradient accumulated over 8 minibatches)
    let g = 0; for (let i = 0; i < N; i++) g += A[i] * (a[i] - mu0) / (sig * sig); g /= N; const muA2C = mu0 + lr * g;
    // PPO: 6 mini-epochs x 8 minibatches of clipped surrogate
    let mu = mu0; const traj = [mu0]; let clipFrac = 0; const rs = rng(11);
    for (let ep = 0; ep < 6; ep++) {
      for (let i = N - 1; i > 0; i--) { const j = Math.floor(rs() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      for (let b = 0; b < MB; b++) {
        let gg = 0, nc = 0;
        for (let t = b * N / MB; t < (b + 1) * N / MB; t++) { const i = idx[t], ratio = Math.exp(logp(a[i], mu) - logp(a[i], mu0)); const clipped = (A[i] > 0 && ratio > 1 + eps) || (A[i] < 0 && ratio < 1 - eps); if (clipped) nc++; else gg += A[i] * ratio * (a[i] - mu) / (sig * sig); }
        mu += lr * gg / (N / MB); traj.push(mu); clipFrac = nc / (N / MB);
      }
    }
    return { sig, muA2C, muPPO: mu, traj, clipFrac };
  }
  let A2C = null; const a2c = () => (A2C ||= buildA2C());
  function s5(G) {
    let k = +(OPT[0] ?? 0); const T = a2c();
    const cells = []; for (let gpu = 0; gpu < 4; gpu++) for (let b = 0; b < 8; b++) { const m = block(0.9, 0.6, 0.6, COL.data, [-11 + b * 1.0, 6.6 - gpu * 0.9, 0], { edges: false }); G.add(m); cells.push({ m, gpu, b }); }
    G.add(lab('4 张卡 × 8 个小批（每批 16384 个样本）', [-7.5, 8.0, 0], { size: 16 }));
    const steps = []; for (let i = 0; i < 48; i++) { const m = block(0.22, 0.9, 0.5, COL.ppo, [-11.2 + (i % 24) * 0.38, i < 24 ? 2.2 : 0.9, 0], { edges: false }); G.add(m); steps.push(m); }
    const stepLab = liveLab(G, [-6.8, 3.5, 0], { size: 17 });
    const CX = 1.4, CY = 0.6, SX = 9 / 0.3, SY = 5.4;
    panel(G, CX - 0.6, CY - 0.4, -0.3, 11.4, 7.0); wire(G, [[CX, CY, 0], [CX + 10, CY, 0]], COL.white, { opacity: 0.4 });
    const gauss = (mu, x) => Math.exp(-((x - mu) ** 2) / (2 * T.sig * T.sig));
    const old = ribbon(G, 120, COL.sim, 0.05), now = ribbon(G, 120, COL.ppo, 0.07); const tgt = block(0.05, 6, 0.05, COL.ok, [CX + 0.3 * SX, CY + 3, 0], { edges: false }); G.add(tgt);
    G.add(lab('最优 a = 0.3', [CX + 0.3 * SX, CY + 6.4, 0], { size: 15, color: '#4fc98a' }), lab('灰：采样时的策略  紫：更新后', [CX + 5, CY - 1.1, 0], { size: 15 }));
    const rd = liveLab(G, [CX + 5, CY + 7.4, 0], { size: 17, border: 'rgba(157,140,255,.8)' });
    const ctls = [{ label: '一轮数据怎么用', items: ['A2C（论文附录 B.1）', 'PPO（V1 代码默认）'], get: () => k, set: j => { k = j; } }];
    const curveAt = mu => { const pts = []; for (let i = 0; i < 120; i++) { const x = -0.12 + 0.45 * i / 119; pts.push([CX + x * SX + 3.6, CY + gauss(mu, x) * SY, 0]); } return pts; };
    old.userData.set(curveAt(0));
    return { ctls, update(p) {
      const u = seg(p, 0.1, 0.85), nSteps = k === 0 ? (u > 0.5 ? 1 : 0) : Math.round(u * 48);
      cells.forEach(({ m, b }) => glow(m, k === 0 ? 0.6 * seg(p, 0.1, 0.5) : (Math.floor(u * 48) % 8 === b ? 0.9 : 0.1)));
      steps.forEach((m, i) => { m.visible = k === 1 ? i < nSteps : i === 0 && nSteps > 0; });
      const mu = k === 0 ? (nSteps ? T.muA2C : 0) : T.traj[nSteps]; now.userData.set(curveAt(mu));
      stepLab(k === 0 ? `梯度步数：${nSteps} / 1（8 个小批累加成一步）` : `梯度步数：${nSteps} / 48（6 遍 × 8 个小批）`);
      rd(k === 0 ? `μ 移动 ${(T.muA2C / T.sig).toFixed(2)} σ；比值恒为 1，不裁剪` : `μ 移动 ${(T.traj[nSteps] / T.sig).toFixed(2)} σ；最后一步裁剪 ${(T.clipFrac * 100).toFixed(0)}%`);
      cap(k === 0 ? 'A2C：整轮数据只走<b>一步</b>，新旧策略相同，PPO 的裁剪永远不起作用' : 'PPO：同一轮数据反复用 <b>48 步</b>，比值离开 [0.8, 1.2] 的样本被裁掉');
    } };
  }

  /* ---------- scene 6: structured masking, sampled live ---------- */
  function genMask(mode, T, seed) {
    const r = rng(seed), nb = 6, out = []; let prev = null, gap = 0;
    const P = [{ rep: 0.98, gapP: 0.01, gmax: 9, force: 0 }, { rep: 0.98, gapP: 0.1, gmax: 11, force: 0.1 }, { rep: 0, gapP: 0, gmax: 0, force: 0 }][mode];
    for (let t = 0; t < T; t++) {
      let m;
      if (gap > 0) { gap--; m = Array.from({ length: nb }, () => [0, 0]); m.gap = true; }
      else if (t > 0 && r() < P.gapP) { gap = 1 + Math.floor(r() * P.gmax) - 1; m = Array.from({ length: nb }, () => [0, 0]); m.gap = true; }
      else if (prev && !prev.gap && r() < P.rep) m = prev.map(x => x.slice());
      else {
        const maxB = r() >= 0.1 ? 6 : 3; let num = Math.round(r() * (maxB - 1) + 1); if (r() < P.force) num = 6;
        const ids = [0, 1, 2, 3, 4, 5]; for (let i = 5; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
        m = Array.from({ length: nb }, () => [0, 0]); ids.slice(0, num).forEach(b => { const c = Math.floor(r() * 3); m[b] = [c <= 1 ? 1 : 0, c >= 1 ? 1 : 0]; }); m.fresh = true;
      }
      out.push(m); if (!m.gap) prev = m;
    }
    return out;
  }
  function maskStats(M) {
    const T = M.length; let gaps = 0, act = 0, nvis = 0, runs = 0, cur = 0, runLens = [];
    for (let t = 0; t < T; t++) { const m = M[t]; if (m.gap) { gaps++; continue; } nvis++; act += m.filter(x => x[0] || x[1]).length; }
    let last = null; for (let t = 0; t < T; t++) { const key = M[t].gap ? 'gap' : JSON.stringify(M[t]); if (key === last) cur++; else { if (cur) runLens.push(cur); cur = 1; last = key; } } runLens.push(cur);
    return { gapFrac: gaps / T, meanAct: act / Math.max(1, nvis), meanRun: runLens.reduce((a, b) => a + b, 0) / runLens.length };
  }
  const MASKS = {}; const getMask = m => (MASKS[m] ||= (() => { const M = genMask(m, 150, 21); const big = []; for (let s = 0; s < 40; s++) big.push(...genMask(m, 300, 100 + s)); return { M, st: maskStats(big) }; })());
  function s6(G) {
    let k = +(OPT[0] ?? 0); const T = 150, X0 = -8.5, DX = 0.1, Y0 = 0.8, DY = 0.42;
    const grid = inst(BOX, T * 12); G.add(grid);
    JNAMES.forEach(([, nm], b) => { G.add(lab(nm, [X0 - 1.1, Y0 + (b * 2 + 0.5) * DY, 0], { size: 15 })); });
    G.add(lab('蓝：位置可见  橙：旋转可见  暗：遮掉  横轴：150 步 = 5 秒', [X0 + 7.5, Y0 + 12 * DY + 0.7, 0], { size: 15 }));
    const head = block(0.04, 12 * DY + 0.3, 0.3, COL.white, [X0, Y0 + 6 * DY, 0.1], { edges: false, opacity: 0.8 }); G.add(head);
    const rob = robot(COL.robot, { opacity: 0.9 }); G.add(rob); const RB = [10.5, 0, 0], SC = 3.0;
    const mk = JNAMES.map(([key]) => { const s = L.sphere(0.16, COL.pos); s.position.set(...jpos(key, RB, SC)); G.add(s); return s; });
    const rd = liveLab(G, [0.5, -0.9, 0], { size: 16, border: 'rgba(180,140,255,.8)' });
    const ctls = [{ label: '采样规则', items: ['结构化（附录 B.2）', 'V1 代码参数', '每步重新抽'], get: () => k, set: j => { k = j; } }];
    let built = -1;
    function paint() { const { M } = getMask(k); built = k; for (let t = 0; t < T; t++) for (let b = 0; b < 6; b++) for (let c = 0; c < 2; c++) { const i = t * 12 + b * 2 + c; setI(grid, i, [X0 + t * DX, Y0 + (b * 2 + c) * DY, 0], [DX * 0.92, DY * 0.86, 0.12]); colI(grid, i, hex3(M[t][b][c] ? (c ? COL.rot : COL.pos) : COL.hid)); } done(grid); }
    return { ctls, update(p) {
      if (built !== k) paint(); const { M, st } = getMask(k); const n = Math.min(T - 1, Math.floor(p * T));
      for (let t = 0; t < T; t++) { const vis = t <= n; for (let b = 0; b < 12; b++) { const i = t * 12 + b; setI(grid, i, [X0 + t * DX, Y0 + b * DY, 0], vis ? [DX * 0.92, DY * 0.86, 0.12] : [0, 0, 0]); } } done(grid);
      head.position.x = X0 + n * DX;
      pose(rob, still(), RB, SC, 0);
      const m = M[n]; mk.forEach((s, b) => { const [ps, rt] = m[b]; s.visible = !!(ps || rt); if (s.visible) s.material.color.setHex(ps && rt ? COL.white : ps ? COL.pos : COL.rot); });
      rd(`平均持续 ${st.meanRun.toFixed(1)} 步 · 全遮 ${(st.gapFrac * 100).toFixed(1)}% · 平均可见 ${st.meanAct.toFixed(2)} 个关节（12000 步统计）`);
      cap(m.gap ? `第 ${n} 步：<b>时间空档</b>，这一帧一个关节都不给（练插帧）` : `第 ${n} 步：可见 <b>${m.filter(x => x[0] || x[1]).length}</b> 个关节${m.fresh ? '（刚重新抽过）' : ''}；白球 = 位置和旋转都给`);
    } };
  }

  /* ---------- scene 7: residual prior, KL on a 2-D slice ---------- */
  function s7(G) {
    let res = +(OPT[0] ?? 0), epi = +(OPT[1] ?? 0);
    const CX = -2.5, CY = 3.6, S = 2.4; panel(G, CX - 4.2, CY - 3.4, -0.2, 8.6, 7.0);
    wire(G, [[CX - 4.2, CY, 0], [CX + 4.4, CY, 0]], COL.white, { opacity: 0.2 }); wire(G, [[CX, CY - 3.4, 0], [CX, CY + 3.6, 0]], COL.white, { opacity: 0.2 });
    const rp = ring(G, COL.prior), rp2 = ring(G, COL.prior, 0.4), re = ring(G, COL.enc), mp = L.sphere(0.14, COL.prior), me = L.sphere(0.14, COL.enc); G.add(mp, me);
    const zdot = L.sphere(0.12, COL.gold); G.add(zdot); const tr = ribbon(G, 160, COL.gold, 0.035, { opacity: 0.8 });
    const arrowL = ribbon(G, 2, COL.enc, 0.05);
    const kl = liveLab(G, [CX, CY - 4.2, 0], { size: 18, border: 'rgba(242,193,78,.8)' });
    G.add(lab('绿：先验 ρ（1σ、2σ）  黄：编码器 E（1σ）  金：采到的 z', [CX, CY - 5.1, 0], { size: 15 }));
    const B = [['完整', 96.9, COL.prior], ['无残差先验', 21.1, COL.bad], ['无 VAE', 93.2, COL.enc], ['无历史', 94.9, COL.text], ['无结构化遮挡', 0, COL.mask]];
    B.forEach(([n, v, c], i) => { const b = bar(G, 5.0 + i * 1.6, 0, 1.0, c); b.userData.set(Math.max(0.03, v / 100 * 6)); G.add(lab(n, [5.0 + i * 1.6, -0.6, 1.0], { size: 13 }), lab(`${v}%`, [5.0 + i * 1.6, v / 100 * 6 + 0.45, 0], { size: 14 })); });
    G.add(lab('表 6 · 坐椅子成功率', [8.2, 7.2, 0], { size: 17, border: 'rgba(56,209,255,.7)' }));
    const rE = rng(4), E1 = L.gauss(rE), E2 = L.gauss(rE), steps = Array.from({ length: 160 }, () => [L.gauss(rE), L.gauss(rE)]);
    const ctls = [{ label: '编码器', items: ['残差 μ_ρ + μ_E', '独立 μ_E'], get: () => res, set: j => { res = j; } }, { label: '噪声 ε', items: ['回合内固定', '每步重抽'], get: () => epi, set: j => { epi = j; } }];
    const state = t => { const mr = [0.9 * Math.cos(2 * Math.PI * t), 0.6 * Math.sin(2 * Math.PI * t)], sr = 0.55, mE = [0.35 * Math.cos(6 * t + 1), 0.3 * Math.sin(5 * t)], sE = 0.22; const muEnc = res === 0 ? [mr[0] + mE[0], mr[1] + mE[1]] : [-0.4 + 0.5 * Math.sin(3 * t), 0.8 * Math.cos(2 * t)]; return { mr, sr, muEnc, sE }; };
    return { ctls, update(p) {
      const { mr, sr, muEnc, sE } = state(p);
      const P = v => [CX + v[0] * S, CY + v[1] * S, 0.02];
      rp.position.set(...P(mr)); rp.scale.setScalar(sr * S); rp2.position.set(...P(mr)); rp2.scale.setScalar(2 * sr * S); mp.position.set(...P(mr));
      re.position.set(...P(muEnc)); re.scale.setScalar(sE * S); me.position.set(...P(muEnc)); arrowL.userData.set([P(mr), P(muEnc)]);
      const d2 = (muEnc[0] - mr[0]) ** 2 + (muEnc[1] - mr[1]) ** 2, KL = 2 * Math.log(sr / sE) + (2 * sE * sE + d2) / (2 * sr * sr) - 1;
      const eAt = i => epi === 0 ? [E1, E2] : steps[i]; const n = Math.max(2, Math.floor(p * 160)); const pts = [];
      for (let i = 0; i < n; i++) { const s = state(i / 159), e = eAt(i); pts.push(P([s.muEnc[0] + s.sE * e[0], s.muEnc[1] + s.sE * e[1]])); }
      tr.userData.set(pts); zdot.position.set(...pts[pts.length - 1]);
      let L1 = 0; for (let i = 1; i < 160; i++) { const a = state((i - 1) / 159), b = state(i / 159), ea = eAt(i - 1), eb = eAt(i); L1 += Math.hypot(b.muEnc[0] + b.sE * eb[0] - a.muEnc[0] - a.sE * ea[0], b.muEnc[1] + b.sE * eb[1] - a.muEnc[1] - a.sE * ea[1]); }
      kl(`KL（两维）= ${KL.toFixed(2)} · 偏移 ‖μ_E‖ = ${Math.sqrt(d2).toFixed(2)} · z 每步平均移动 ${(L1 / 159).toFixed(3)}`);
      cap(res === 0 ? '残差：编码器只给<b>偏移</b>，KL 只罚偏移和方差差，μ_ρ 从 KL 里消掉' : '非残差：编码器自己选位置，KL 要把两者拉到一起；表 6 里这样只有 <b>21.1%</b>');
    } };
  }

  /* ---------- scene 8: prior transformer tokens ---------- */
  function s8(G) {
    let k = +(OPT[0] ?? 0), hv = +(OPT[1] ?? 0);
    const PRE = [{ n: '全身跟踪', on: { cur: 1, hm: 1, hist: 1, text: 0, obj: 0, tgt: 11 } }, { n: 'VR 三点', on: { cur: 1, hm: 1, hist: 1, text: 0, obj: 0, tgt: 11 } }, { n: '只给文本', on: { cur: 1, hm: 1, hist: 1, text: 1, obj: 0, tgt: 0 } }, { n: '坐椅子（近处）', on: { cur: 1, hm: 1, hist: 1, text: 0, obj: 1, tgt: 0 } }, { n: '路径 + 文本', on: { cur: 1, hm: 1, hist: 1, text: 1, obj: 0, tgt: 6 } }];
    const groups = [['cur', '当前姿态', COL.robot, 1], ['hm', '高度图', COL.terr, 1], ['hist', '历史姿态', COL.data, 15], ['text', '文本 XCLIP', COL.text, 1], ['obj', '物体包围盒', COL.obj, 1], ['tgt', '目标姿态', COL.pos, 11]];
    const sub = new THREE.Group(); G.add(sub); let built = '';
    const tf = block(16, 1.4, 2.0, COL.prior, [0, 5.4, 0], { opacity: 0.55 }); G.add(tf, lab('Transformer：宽 512 · 前馈 1024 · 4 层 · 4 头', [0, 6.6, 0], { size: 18 }));
    const head = block(1.6, 1.0, 1.0, COL.gold, [0, 8.0, 0]); G.add(head, lab('第一个输出 → 256 → 128 → μ, log σ ∈ ℝ⁶⁴', [0, 9.0, 0], { size: 16 }));
    const cnt = liveLab(G, [0, -1.6, 1.2], { size: 17, border: 'rgba(79,201,138,.8)' });
    let cubes = [];
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); cubes = []; built = k + ':' + hv;
      const on = PRE[k].on; let x = -11.2;
      groups.forEach(([key, nm, c, n0]) => { const n = key === 'hist' ? (hv ? 15 : 5) : n0, x0 = x; for (let i = 0; i < n; i++) { const active = key === 'tgt' ? i < on.tgt : !!on[key]; const m = block(0.5, 0.5, 0.5, active ? c : COL.hid, [x, 2.2, 0], { opacity: active ? 1 : 0.35 }); sub.add(m); cubes.push({ m, active, x }); x += 0.62; } sub.add(lab(`${nm}\n×${n}`, [(x0 + x - 0.62) / 2, 0.8, 0.6], { size: 13 })); x += 1.3; });
    }
    const ctls = [{ label: '任务', items: PRE.map(p => p.n), get: () => k, set: j => { k = j; } }, { label: '历史', items: ['论文：5 个', 'V1 代码：15 个'], get: () => hv, set: j => { hv = j; } }];
    return { ctls, update(p) {
      if (built !== k + ':' + hv) rebuild(); const q = (p * 3) % 1;
      cubes.forEach(({ m, active }, i) => { m.position.y = 2.2 + (active ? 1.2 * seg(p, 0.15 + 0.01 * i, 0.4 + 0.01 * i) : 0); glow(m, active ? 0.4 : 0); });
      glow(tf, 0.5 * seg(p, 0.45, 0.6)); glow(head, 0.7 * seg(p, 0.65, 0.8));
      const na = cubes.filter(c => c.active).length; cnt(`参与注意力的 token：${na} / ${cubes.length}（暗的被注意力掩码排除）`);
      cap(k === 1 ? 'VR：11 个目标姿态 token 都在，但每个里只露出<b>头和双手</b>（token 内部的遮挡）' : k === 2 ? '只给文本：所有目标姿态 token 都被<b>排除</b>，靠历史和文本补全' : k === 3 ? '坐椅子（2 m 内）：只给<b>物体包围盒</b>' : k === 4 ? '路径 + 文本：头的 5 个近期目标 + 0.8 s 远期目标，外加一句话定风格' : '全身跟踪：11 个目标姿态 token 全部可见');
    } };
  }

  /* ---------- scene 9: DAgger loop and the KL schedule ---------- */
  function s9(G) {
    let k = +(OPT[0] ?? 0); const EP = 19073;
    const stu = robot(COL.mask), tea = robot(COL.frozen, { opacity: 0.5 }); G.add(stu, tea);
    const tb = block(2.2, 1.6, 1.2, COL.frozen, [-9.5, 6.2, 0]); G.add(tb, lab('π^FC 看完整目标\n给均值动作 a^FC', [-9.5, 7.8, 0], { size: 15 }));
    const sb = block(2.2, 1.6, 1.2, COL.mask, [-4.5, 6.2, 0]); G.add(sb, lab('π^PC 看遮挡目标\n确定性动作 a', [-4.5, 7.8, 0], { size: 15 }));
    G.add(lab('损失：‖a − a^FC‖² + α(epoch)·KL', [-7, 4.6, 0], { size: 16, border: 'rgba(242,160,160,.7)' }));
    const fl = stream(G, 5, COL.mask); const fl2 = stream(G, 5, COL.frozen);
    const CX = 1.5, CY = 0.6, W = 11, H = 6; panel(G, CX - 0.5, CY - 0.6, -0.3, W + 1.2, H + 1.6);
    wire(G, [[CX, CY, 0], [CX + W, CY, 0]], COL.white, { opacity: 0.4 }); wire(G, [[CX, CY, 0], [CX, CY + H, 0]], COL.white, { opacity: 0.4 });
    [0, 3000, 9000, EP].forEach(e => G.add(lab(String(e), [CX + W * e / EP, CY - 0.45, 0.1], { size: 12 })));
    G.add(lab('0.01', [CX - 0.5, CY + H, 0.1], { size: 12 }), lab('KL 系数 α 随 epoch（共约 19,073 个）', [CX + W / 2, CY + H + 0.6, 0], { size: 15 }));
    const coef = (e, m) => m === 1 ? 0 : 1e-4 + Math.min(Math.max(0, e - 3000) / 6000, 1) * (1e-2 - 1e-4);
    const ln = ribbon(G, 200, COL.gold, 0.07), dotp = L.sphere(0.16, COL.white); G.add(dotp);
    const rd = liveLab(G, [CX + W / 2, CY + H + 2.0, 0], { size: 17, border: 'rgba(242,193,78,.8)' });
    const ctls = [{ label: '版本', items: ['论文 / 6ac71e1 之后', 'V1 发布版（按字面）'], get: () => k, set: j => { k = j; } }];
    return { ctls, update(p) {
      const q = clip('walk', p * 12); pose(stu, drift(q, 0.05 * Math.sin(9 * p)), [-7, 0, 0], 2.4, Math.PI / 2); pose(tea, q, [-7, 0, -0.6], 2.4, Math.PI / 2);
      const ph = (p * 18) % 1; fl([[-4.5, 5.4, 0], [-6.5, 3.6, 0], [-7, 2.6, 0]], ph, 1); fl2([[-7, 2.6, 0], [-9, 4.0, 0], [-9.5, 5.4, 0]], ph, 1);
      const pts = []; for (let i = 0; i < 200; i++) { const e = EP * i / 199; pts.push([CX + W * e / EP, CY + H * coef(e, k) / 0.01, 0.05]); } ln.userData.set(pts);
      const e = EP * p, c = coef(e, k); dotp.position.set(CX + W * e / EP, CY + H * c / 0.01, 0.1);
      rd(`epoch ${Math.round(e)}：α = ${c.toExponential(2)}`);
      cap(k === 1 ? 'V1 发布版：<code>config.get("vae_kld_schedule")</code> 找不到，KL <b>一直没加</b>（按源码读，未运行）' : 'α 从 10⁻⁴ 线性升到 10⁻²：第 3000 到 9000 个 epoch；代码里 end_epoch 其实是“持续多少 epoch”');
    } };
  }

  /* ---------- scene 10: goal engineering ---------- */
  function s10(G) {
    let k = +(OPT[0] ?? 0); G.add(L.grid(26, 26));
    const rob = robot(COL.prior); G.add(rob); const sub = new THREE.Group(); G.add(sub); let built = -1, obj = {};
    const st = liveLab(G, [0, 5.6, -4], { size: 18, border: 'rgba(180,140,255,.8)' });
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); built = k; obj = {};
      if (k === 0) { const ch = new THREE.Group(); ch.add(block(1.4, 0.55, 1.4, COL.obj, [0, 0.28, 0]), block(1.4, 1.4, 0.25, COL.obj, [0, 0.95, -0.6])); ch.position.set(5, 0, 0); ch.rotation.y = -Math.PI / 2; sub.add(ch); const bb = L.box(1.6, 1.7, 1.6, COL.obj, { opacity: 0.08 }); bb.position.set(5, 0.85, 0); sub.add(bb); obj.bb = bb; const r2 = ring(sub, COL.gold, 0.6); r2.rotation.x = -Math.PI / 2; r2.position.set(5, 0.02, 0); r2.scale.setScalar(2 * 2.2); }
      if (k === 1) { obj.d = []; for (let i = 0; i < 6; i++) { const s = L.sphere(i === 5 ? 0.18 : 0.12, i === 5 ? COL.gold : COL.ok); sub.add(s); obj.d.push(s); } obj.path = ribbon(sub, 100, COL.ok, 0.05, { opacity: 0.6 }); const pts = []; for (let i = 0; i < 100; i++) { const x = -8 + 16 * i / 99; pts.push([x, 0.04, 1.6 * Math.sin(x * 0.5)]); } obj.path.userData.set(pts); obj.path.rotation.x = 0; }
      if (k === 2) { obj.a1 = block(2.2, 0.08, 0.08, COL.rot, [0, 0.1, 0]); obj.a2 = block(2.2, 0.08, 0.08, COL.pos, [0, 0.1, 0]); sub.add(obj.a1, obj.a2, lab('橙：朝向  蓝：移动方向和速度', [0, 6.4, 0], { size: 15 })); }
      if (k === 3) { obj.ball = L.sphere(0.2, COL.ref); sub.add(obj.ball); }
    }
    const ctls = [{ label: '任务', items: ['坐椅子', '路径跟随', '转向', '伸手'], get: () => k, set: j => { k = j; } }];
    return { ctls, update(p) {
      if (built !== k) rebuild(); const t = p * 14;
      if (k === 0) { const x = Math.min(-7 + 13 * p, 3.6), d = 5 - x, near = d <= 2.2, u = seg(p, 0.86, 0.98); const q = u > 0 ? qmix(clip('walk', t), { p: [0, 0.4, 0], pitch: 0, hL: 1.5, hR: 1.5, kL: 1.5, kR: 1.5, sL: 0.2, sR: 0.2, eL: 0.4, eR: 0.4 }, u) : clip('walk', t); pose(rob, q, [x + 1.2 * u, 0, 0], 2.2, u > 0.5 ? -Math.PI / 2 : Math.PI / 2); obj.bb.material.opacity = near ? 0.28 : 0.06; st(near ? '状态 2：只给椅子包围盒（8 角 + 朝向 + 类别）' : `状态 1：方向 → 椅子，1 m/s + “the person walks normally”（还有 ${((d - 2.2) / 2.2).toFixed(1)} m）`); cap('离椅子 2 m（图中按比例 2.2 个单位）以内<b>撤掉</b>方向和文本，只给物体；SAMP 的动作就是“走过去坐下”'); }
      if (k === 1) { const x = -8 + 16 * p, z = 1.6 * Math.sin(x * 0.5), off = Math.abs(Math.sin(p * 9)) > 0.93 ? 1 : 0; pose(rob, clip('walk', t), [x, 0, z + off * 0.9], 2.2, Math.PI / 2 - Math.atan(0.8 * Math.cos(x * 0.5))); obj.d.forEach((s, i) => { const xx = i < 5 ? x + 0.12 * (i + 1) * 1.1 : x + 0.8 * 1.1 * 2.2; s.position.set(xx, 2.4 * 2.2 * 0.45 + 0.05, 1.6 * Math.sin(xx * 0.5)); s.visible = off ? i === 5 : true; }); st(off ? '偏离 > 0.4 m：只给 0.8 s 后的头部目标' : '头部目标：未来 5 步 + 0.8 s 后一个'); cap('约束越松，成功率越高、误差越小，但用户能控制的越少（§8.2）'); }
      if (k === 2) { const ph = Math.floor(p * 3), hd = [0, 1.2, -0.8][ph], mv = [0.3, -0.6, 1.4][ph], sp = [1.0, 1.6, 0.6][ph]; const x = -4 + 8 * p; pose(rob, clip('walk', t * sp), [x, 0, 0], 2.2, Math.PI / 2 + hd); obj.a1.position.set(x, 0.12, 0); obj.a1.rotation.y = -hd; obj.a2.position.set(x, 0.2, 0); obj.a2.rotation.y = -mv; obj.a2.scale.x = sp; st('先给骨盆朝向 θ̂ 和剩余时间，再给 1 s 后的骨盆位置（高 0.9 m）'); cap('转向：朝向和移动方向分开给；两个向量一变，2 秒后才开始计分；朝向偏 > 45° 算失败'); }
      if (k === 3) { const ph = Math.floor(p * 4), r = rng(30 + ph), c = [-0.6 + 1.2 * r(), 1.0 + 1.1 * r(), 0.7]; obj.ball.position.set(...c); const u = seg((p * 4) % 1, 0, 0.5); const q = still(); q.sR = 0.2 + 1.4 * u; q.sL = 0.1; pose(rob, q, [0, 0, 0], 2.2, 0); st('只给右手目标位置 + 剩余时间'); cap('伸手：目标每变一次，有 2 秒到达；到点时手偏 > 0.5 m 算失败'); }
    } };
  }

  /* ---------- scene 11: results ---------- */
  function s11(G) {
    let view = +(OPT[0] ?? 0); G.add(L.grid(34, 34)); const sub = new THREE.Group(); G.add(sub);
    const T = [
      { t: '表 1 · 全身跟踪成功率（%）', g: ['FC', 'PHC+*', 'MaskedMimic', 'PULSE*'], s: [['训练', COL.data, [99.96, 100, 99.4, 99.8]], ['测试', COL.prior, [99.9, 99.2, 99.2, 97.1]]], lo: 95 },
      { t: '表 1 · MPJPE（mm，全局）', g: ['FC', 'PHC+*', 'MaskedMimic', 'PULSE*'], s: [['训练', COL.data, [30.4, 26.6, 32.9, 39.2]], ['测试', COL.prior, [31.3, 36.1, 35.1, 54.1]]], lo: 0, hi: 60 },
      { t: '表 2 · VR 跟踪成功率（%）', g: ['MaskedMimic', 'PULSE*', 'ASE*', 'CALM*'], s: [['训练', COL.data, [98.6, 99.5, 79.8, 16.6]], ['测试', COL.prior, [98.1, 93.4, 37.6, 10.1]]], lo: 0 },
      { t: '表 3 · 只给部分关节，测试成功率（%）', g: ['全身', '骨盆', 'VR', '头', '双手', '双脚'], s: [['', COL.prior, [99.1, 98.4, 98.1, 97.9, 93.4, 91.8]]], lo: 85 },
      { t: '表 4 · 起伏地形，测试成功率（%）', g: ['FC 全身', 'MM 全身', 'MM VR'], s: [['', COL.terr, [98.2, 95.4, 93.6]]], lo: 85 },
      { t: '表 5 · 任务成功率（%）', g: ['路径 平地', '路径 地形', '转向 平地', '转向 地形', '伸手 平地', '伸手 地形'], s: [['', COL.text, [96.3, 96.3, 97.8, 93.8, 88.7, 87.3]]], lo: 80 },
      { t: '表 6 · 坐椅子与消融（%）', g: ['完整', '无历史', '无 VAE', '无残差先验', '无结构化遮挡'], s: [['', COL.obj, [96.9, 94.9, 93.2, 21.1, 0]]], lo: 0 }
    ];
    let bars = [], last = -1;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = view; const v = T[view], Ng = v.g.length, Ns = v.s.length, gw = Math.min(6.4, 28 / Ng), w = Math.min(1.6, (gw - 0.6) / Ns);
      v.g.forEach((nm, i) => { const x0 = (i - (Ng - 1) / 2) * gw; sub.add(lab(nm, [x0, -0.2, 2.6], { size: 17 }));
        v.s.forEach(([sn, c, vals], j) => { const x = x0 + (j - (Ns - 1) / 2) * (w + 0.08), b = block(w, 1, w, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(String(vals[i]), [x, 0, 0], { size: 15 }); sub.add(l); bars.push({ b, l, v: vals[i] }); }); });
      if (Ns > 1) v.s.forEach(([sn, c], j) => { sub.add(lab(sn, [-12 + j * 3.2, 8.4, 0], { size: 19, color: css(c) })); });
      sub.add(lab(v.t + (v.lo ? `（纵轴从 ${v.lo} 起）` : ''), [Ns > 1 ? 5 : 0, 8.4, 0], { size: 20, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const ctls = [{ label: '数据', items: ['表 1 成功率', '表 1 误差', '表 2', '表 3', '表 4', '表 5', '表 6'], get: () => view, set: k => { view = k; } }];
    const MSG = ['* 照搬 PULSE 论文（138 条测试）；MaskedMimic 的 99.9 / 99.2 只能写成 k/1776，不能写成 k/138', '正文说 FC 把测试失败率降低 62.5%；按表 1：(0.8 − 0.1)/0.8 = <b>87.5%</b>', '* 照搬 PULSE 表 2；MaskedMimic 没有专门训练 VR，测试集仍可能不同', '只看脚最难（91.8%）；只看骨盆比看头和双手还容易（98.4% 对 98.1%）。全身一行 99.1% 和表 1 的 99.2% 差 1 条（按 1776 条）', 'FC 在 VR 一栏没有数字（它需要全身目标）；测试集比训练集还高一点', '每项 5000 个随机回合；转向在两种地形上速度误差都是 8.4 cm/s', '无结构化遮挡 0%，误差 274.4 cm——不是“变差”，是完全不会坐'];
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
  window.__mmDebug = { a2c, getMask, get cap() { return $('cap').textContent; } };
})();
