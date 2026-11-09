# Paper Reading Lab

论文阅读与理解的记录。包含逐节精读与架构专题；架构专题附交互图解，明确标注阅读范围。逐节精读：按原文顺序逐节整理，公式照原文编号排版，主要结果表照录数字。开放许可的论文直接放原图，版权保留的论文用文字描述那张图，并链接到原文。读的时候核算出的问题单独标成“读者注”，和论文内容分开。

**站点：https://haoxiangntu.github.io/paper-reading-lab/**

## 已读论文

| 论文 | 精读页 | 主题 | 读者注 |
|---|---|---|---|
| BeyondMimic: From Motion Tracking to Versatile Humanoid Control via Guided Diffusion（[arXiv 2508.08241](https://arxiv.org/abs/2508.08241)，Science Robotics 2026，SuperMimic 引用） | [beyondmimic 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/beyondmimic.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/beyondmimic/index.html) | 同一套跟踪 MDP 上真机做空翻冲刺，再用 DAgger 蒸馏的 VAE 加状态-潜变量扩散，推理时代价引导零样本完成摇杆、路点、避障和关键帧补全；含和 SuperMimic 附录 A 的逐项对照。 | 23 条 |
| Universal Humanoid Motion Representations for Physics-Based Control（[arXiv 2310.04582](https://arxiv.org/abs/2310.04582)，ICLR 2024，CC BY-NC-SA 4.0，SuperMimic 引用） | [pulse 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/pulse.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/pulse/index.html) | 先训能模仿全部 AMASS 的老师 PHC+，在线蒸馏成 32 维带可学习先验的潜空间，下游任务只学残差潜码。 | 24 条 |
| Learning Athletic Humanoid Tennis Skills from Imperfect Human Motion Data（LATENT，[arXiv 2603.12686](https://arxiv.org/abs/2603.12686)，SuperMimic 引作 IROS 2026，未核实，CC BY 4.0，SuperMimic 引用） | [latent 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/latent.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/latent/index.html) | 不完美的网球动作片段 → 跟踪器 → DAgger 潜空间 → 潜动作屏障约束的高层 PPO 加手腕直控，Unitree G1 和人对打。 | 20 条 |
| A Diffusion-based Framework for 6-DOF Grasping with On-Generator Training（[arXiv 2507.13097](https://arxiv.org/abs/2507.13097)，ICRA 2026，CC BY-SA 4.0） | [GraspGen 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/graspgen.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/graspgen/index.html) | 扩散生成抓取，再用见过生成器错误的判别器打分；含代码核对和它为什么不是 GAN | 23 条 |
| SONIC: Supersizing Motion Tracking for Natural Humanoid Whole-Body Control（[arXiv 2511.07820](https://arxiv.org/abs/2511.07820)，Science Robotics 2026，SuperMimic 引用） | [sonic 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/sonic.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/sonic/index.html) | 把动作跟踪放大到 128 卡、1 亿帧、42M 参数，并用 FSQ 通用 token 接上规划器、遥操作和 VLA。 | 18 条 |
| Perpetual Humanoid Control for Real-time Simulated Avatars（[arXiv 2305.06456](https://arxiv.org/abs/2305.06456)，ICCV 2023，SuperMimic 引用） | [phc 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/phc.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/phc/index.html) | 不加外力模仿 AMASS 98.9%：动作越练越难就新建 primitive 并冻结旧的，再用 composer 组合，摔倒能自己爬起走回去。 | 25 条 |
| MoConVQ: Unified Physics-Based Motion Control via Scalable Discrete Representations（[arXiv 2310.10198](https://arxiv.org/abs/2310.10198)，SIGGRAPH 2024，SuperMimic 引用） | [moconvq 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/moconvq.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/moconvq/index.html) | 把几十小时动作压成离散索引、再用物理解码回来，穿过世界模型训练，并接上 GPT 和大语言模型。 | 18 条 |
| Scalable Humanoid Whole-Body Control via Differentiable Neural Network Dynamics（[OpenReview](https://openreview.net/pdf/b3031990328dd52267a571b265c15328bf6d6120.pdf)，ICLR 2025 Workshop，SuperMimic 引用） | [superdyno 整理页，全文未读](https://haoxiangntu.github.io/paper-reading-lab/papers/superdyno.html) · [10 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/superdyno/index.html) | 全文未读到，只整理摘要和项目页存档：可微神经动力学把人形跟踪扩展到大规模动作库。不是逐节精读。 | 10 条 |
| Uncertainty-Aware Robotic World Model Makes Offline Model-Based Reinforcement Learning Work on Real Robots（[arXiv 2504.16680](https://arxiv.org/abs/2504.16680)，arXiv 2025，SuperMimic 引用） | [rwm-u 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/rwm-u.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/rwm-u/index.html) | 给 RWM 加集成不确定性，只用日志离线训练策略并部署到真机。 | 18 条 |
| Mastering Diverse Domains through World Models（[arXiv 2301.04104](https://arxiv.org/abs/2301.04104)，Nature 2025，SuperMimic 引用） | [dreamerv3 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/dreamerv3.html) · [10 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/dreamerv3/index.html) | 同一套超参数跨 8 个领域的世界模型智能体：symlog、two-hot、KL 平衡、回报归一化，演员全部改用 Reinforce。 | 17 条 |
| Temporal Difference Learning for Model Predictive Control（[arXiv 2203.04955](https://arxiv.org/abs/2203.04955)，ICML 2022，SuperMimic 引用） | [td-mpc 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/td-mpc.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/td-mpc/index.html) | 每个决策步用学到的潜空间模型采样规划，H 步之外交给终值函数；模型不重建观测，只学奖励、价值和潜一致性。 | 15 条 |
| DayDreamer: World Models for Physical Robot Learning（[arXiv 2206.14176](https://arxiv.org/abs/2206.14176)，CoRL 2022，SuperMimic 引用） | [daydreamer 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/daydreamer.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/daydreamer/index.html) | 把 Dreamer 直接放到四台真实机器人上在线学习：actor 和 learner 解耦，从零学走路和视觉拣放，并用官方分数文件核对图上的数字。 | 14 条 |
| ControlVAE: Model-Based Learning of Generative Controllers for Physics-Based Characters（[arXiv 2210.06063](https://arxiv.org/abs/2210.06063)，SIGGRAPH Asia 2022，SuperMimic 引用） | [controlvae 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/controlvae.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/controlvae/index.html) | 用可微世界模型训练状态条件 VAE 控制器，再冻结技能空间做下游任务。 | 17 条 |
| Accelerated Policy Learning with Parallel Differentiable Simulation（[arXiv 2204.07137](https://arxiv.org/abs/2204.07137)，ICLR 2022，SuperMimic 引用） | [shac 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/shac.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/shac/index.html) | 把任务切成 32 步短窗口，末端接评论家，让可微仿真在接触任务上真正快过 PPO，并拆解 SuperMimic 从它拿走和改掉了什么。 | 15 条 |
| Dream to Control: Learning Behaviors by Latent Imagination（[arXiv 1912.01603](https://arxiv.org/abs/1912.01603)，ICLR 2020，SuperMimic 引用） | [dreamer 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/dreamer.html) · [10 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/dreamer/index.html) | 把价值梯度穿过学到的隐空间动力学反传，只靠想象学长视野视觉控制；动画当场计算 V_λ，并有可运行的玩具循环。 | 16 条 |
| SuperTrack: Motion Tracking for Physically Simulated Characters using Supervised Learning（[doi:10.1145/3478513.3480527](https://doi.org/10.1145/3478513.3480527)，ACM TOG 2021，SuperMimic 引用） | [supertrack 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/supertrack.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/supertrack/index.html) | 把仿真器换成可导的世界模型，动作跟踪变成监督学习；动画在玩具两连杆上现场训练并算梯度。 | 17 条 |
| Robotic World Model: A Neural Network Simulator for Robust Policy Optimization in Robotics（[arXiv 2501.10100](https://arxiv.org/abs/2501.10100)，arXiv 2025，SuperMimic 引用） | [rwm 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/rwm.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/rwm/index.html) | 用自回归训练的 GRU 世界模型在想象轨迹上跑 PPO，策略零次迁移到 ANYmal D 和 Unitree G1。 | 17 条 |
| DeepMimic: Example-Guided Deep Reinforcement Learning of Physics-Based Character Skills（[arXiv 1804.02717](https://arxiv.org/abs/1804.02717)，SIGGRAPH 2018，SuperMimic 引用） | [deepmimic 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/deepmimic.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/deepmimic/index.html) | 一段参考动作加模仿奖励、RSI 和 ET，让物理角色用 PPO 学会空翻；奖励可在真实骨架上当场算。 | 18 条 |
| SuperMimic: Scaling Humanoid Whole-Body Control with One Differentiable World Model（[arXiv 2610.28480](https://arxiv.org/abs/2610.28480)，2026-10，CoRL 2026） | [SuperMimic 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/supermimic.html) | 一个可微世界模型加短视野 BPTT，把人形全身跟踪的训练算力降到单 GPU，含 [11 幕 3D 框架动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/supermimic/) | 18 条 |
| Hybrid Particle-Voxel Dynamics for Multimodal 3D World Simulation（[arXiv 2611.04492](https://arxiv.org/abs/2611.04492)，2026-11，CC BY 4.0） | [3D World Simulator 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/3dws.html) | 粒子-体素混合的 3D 动作条件世界模型，同时预测外观、几何和触觉，含原文插图和 [3D 架构图](https://haoxiangntu.github.io/paper-reading-lab/interactives/3dws/)、[自编码器分步动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/3dws/ae.html) | 12 条 |
| Evaluating Real-World Robot Manipulation Policies in Simulation（[arXiv 2405.05941](https://arxiv.org/abs/2405.05941)，2024-05，CC BY 4.0） | [SIMPLER 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/simpler.html) | 用仿真代替真机评测机器人操作策略，含原文插图 | 15 条 |
| GAUGE: A Measurement-Grounded Benchmark for Physical Fidelity in Simulation Engines and Video World Models（[arXiv 2608.05948](https://arxiv.org/abs/2608.05948)，2026-08） | [GAUGE 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/gauge.html) | 用真实测量评测物理引擎和视频世界模型的物理保真度 | 15 条 |

在其他站点里读过的：[VPP2 论文导读](https://haoxiangntu.github.io/world-model-lab/docs/vpp2.html)（[arXiv 2610.10270](https://arxiv.org/abs/2610.10270)），在 World Model Lab 里，另有 Wan2.1 架构、MoT 原理、后训练过程和评测数据集的拆解页。

## 架构专题与交互图解

这四篇整理原理、网络与代码核对，未宣称逐节覆盖论文全文，也未复现模型实验。两份独立自绘交互网页已迁入本站，Grasp++ 的交互图直接嵌入阅读页（GraspGen 已升级为逐节精读，见上表），均可通过 GitHub Pages 访问；原 Sites 私有链接保留在各阅读页的相关链接中。

| 论文 | 架构笔记 | 本站交互图解 | 核对重点 |
|---|---|---|---|
| [FoundationPose](https://arxiv.org/abs/2312.08344), CVPR 2024 | [架构笔记](papers/foundationpose.html) | [位姿对比图解](https://haoxiangntu.github.io/paper-reading-lab/interactives/foundationpose-wapr/) | RefineNet / ScoreNet；首次定位与跟踪 |
| [WAPR](https://arxiv.org/abs/2610.09535), ECCV 2026 | [架构笔记](papers/wapr.html) | [位姿对比图解](https://haoxiangntu.github.io/paper-reading-lab/interactives/foundationpose-wapr/) | 大角度训练；论文与仓库配方；遮挡证据边界 |
| [T(R,O) Grasp](https://arxiv.org/abs/2510.12724), ICRA 2026 | [架构笔记](papers/tro-grasp.html) | [图扩散网络图解](https://haoxiangntu.github.io/paper-reading-lab/interactives/tro-grasp/) | PointNet++ / BPS；OR / RR；DDIM / IK；代码维度差异 |
| [T(R,O) Grasp++](https://arxiv.org/abs/2610.25410), CoRL 2026 | [架构与原版对比](papers/tro-grasp-plus-plus.html) | [页内网络交互](https://haoxiangntu.github.io/paper-reading-lab/papers/tro-grasp-plus-plus.html#denoiser) | 环境 ER 分支；运动学指纹；8×768 主干；论文 / 代码差异 |

## BeyondMimic 读后要点

- 跟踪设定（奖励表、终止、域随机化、低增益 PD）被 SONIC、SuperMimic 和 mjlab 沿用最多，但论文文字、旧仓库、mjlab 三处数值不完全一样，引用时要说清是哪一处。
- 倾斜终止：论文写旋转误差 0.8 rad（约 46°），代码是重力 z 分量差 0.8（直立时约 78.5°）；SuperMimic 用的是代码版。
- SuperMimic 附录 A 声明的改动都属实，另有观测、摩擦写法、根部刚体三处不同没有注明。
- 潜空间扩散是 v4 才加的，v1–v3 是直接的状态加动作扩散。
- 任务代价只在推理时引导扩散，完全不进训练。

## PULSE 读后要点

- 三段式：PPO 老师 PHC+ → DAgger 式在线蒸馏（编码器、先验、解码器）→ 冻结解码器和先验，用 PPO 训下游。
- 消融影响最大的是“从先验均值出发的残差动作”：去掉后 VR 跟踪从 93.4% 掉到 18.1%。
- 蒸馏保住了成功率（测试集 134/138 对 137/138），但全局误差比老师大约 50%。
- 强调“在线”蒸馏，却没有和离线行为克隆比较。
- 附录的样本数（β 退火区间）和表 4、代码、图 4 都差约 10 倍。

## LATENT 读后要点

- 两个设计各补数据的一处缺陷：手腕不准就交给高层直接控制；不会组合技能就交给 RL，但用先验的 σ 圈住（潜动作屏障）。
- 潜动作屏障主要改善平滑度和力矩，成功率只多 1.6–5.1 个点。
- 仿真球场是标准场按 0.547 等比缩小的 13 m × 6 m，论文没写。
- 表 3 的两种划分在数值上互相矛盾；表 5 每格只有 4–11 次试验。
- SuperMimic 表 1 对它的概括准确，但看不出手腕直控这条路。

## GraspGen 读后要点

- D 学成功/失败，G 只回归噪声，D 的梯度不回 G，所以不是 GAN。
- On-Generator 的价值在于 D 见过生成器的碰撞错误：AUC 0.947 对离线 0.886。
- `cat_attn` 序列长为 1，注意力权重恒为 1；空间注意力在 PTv3 里。
- T=10 时平移 ᾱ 只到 0.927，训练从未覆盖推理起点 N(0,I)。
- 公开判别器脚本实际全是离线数据。

## SONIC 读后要点

- 放大的收益要看失败率：三轴分别降 3.2、5.3、3.0 倍；只做单轴实验，没有交叉。
- 通用 token 让换输入不必重训。
- 存活不等于跟上速度：命令 5 m/s，实际 2.07 m/s。
- 公布的默认模型解码器约 1018 万参数，不是 42M 结构。
- v4 正文的成功判据比 v1–v3、Data S1 和官方代码少了一项根朝向。

## PHC 读后要点

- 单网络学大动作库会边学边忘，图 7 的阶梯是直接证据。
- 消融最大一跳来自渐进训练（66.2 → 86.9）。
- 恢复靠屏蔽非根目标，退化成 point-goal。
- 代码的 composer 噪声加在权重上，Σwμ 不归一，和式 (5)(6) 不同。
- README 后来报单 primitive 99.9%（未验证）。

## MoConVQ 读后要点

- 残差量化用 4096 个码向量表示 512⁸ 种组合，离散索引因此能接 GPT 和 LLM。
- 解码器含仿真器，不可导；训练时换成世界模型，再用直通估计跨过量化。
- 相比 ControlVAE：无先验，编码器不看仿真状态，转向下游改用监督学习。
- 干净数据上连续 VAE 更准；图 17 里加噪声后带残差的 VQ 超过它。

## SuperDyno 读后要点

- 全文未读到，下面只来自摘要和项目页存档。
- 摘要只说结合监督学习和强化学习，具体组合方式没读到。
- 球墙例子：真值面有梯度为零的平台，会卡住梯度上升。
- 动力学模型用 SiLU 时五项指标全部变好，最好组合是 P(ReLU) W(SiLU)。

## RWM-U 读后要点

- λ 可用区间窄：ANYmal D 上 u 差 8%，真实评估却是 0.43 对 0.90，选 λ 用了真实评估。
- 代码的 u 是跨 45 维求和的标准差，不是式 (4) 的方差。
- 代码默认损失的最优 σ 是 0，checkpoint 里 σ≈5.5e−5，图 3 贴零线不能说明环境随机性小。
- 真机 800K+200K 得 0.91±0.03，对在线无模型 0.88±0.01，区间重叠。

## DreamerV3 读后要点

- V3 演员不穿过世界模型反传，连续动作也用 Reinforce，和 SuperMimic 相反。
- 世界模型主要靠重建：去掉重建梯度终点 26，去掉奖励和价值梯度 94（读矢量图）。
- v1、v2、Nature 的控制基准和 β 都不同，引用要说明版本。
- free bits 的 1 nat 针对 32 个分类的 KL 之和。

## TD-MPC 读后要点

- TOLD 没有解码器，奖励和价值的梯度穿过 d 回到编码器。
- 动作来自每步一次 MPPI：537×5×6 = 16,110 次 d、R 调用，约 20 ms。
- π 不是最终控制器，只服务 TD 目标和规划采样。
- SuperMimic 只引用一句，没有做规划：目标函数形式相近，但它在训练时用梯度解 θ。
- 玩具实验（自设）：一致性损失不过滤干扰，挑任务信息的是奖励和价值项。

## DayDreamer 读后要点

- 算法基本是 DreamerV2，贡献在实验和解耦的 actor/learner 基础设施。
- 式 (5) 首项应为 (ẑ·z+1)/2；门关时速度项是 5，所以 A1 曲线从 5 起步，超过 9 必在前进。
- 附录 D 的 γ=0.95 在代码里是 0.995；“开始学习 10⁴”大于 Sphero 全程 9929 步。
- H=15 加起点共 16 个状态，32×32×16=16384，即文中“16K”。
- 图轴要小心读：图 A.1 约 9 个/分钟，按墙钟约 2 个/分钟。

## ControlVAE 读后要点

- 残差后验让 KL 只含 μq，先验网络拿不到 KL 梯度。
- 世界模型流程基本沿用 SuperTrack，新东西是 VAE 结构和技能空间。
- 下游任务阶段冻结 π 和 ω，梯度只穿过它们回到 μg。
- 数据到 3.3 小时，下游任务明显退化。

## SHAC 读后要点

- 短窗口解决梯度数值问题，评论家解决短视，两者要一起成立。
- SHAC 的终止是硬的：提前终止时 V 记 0，折扣清零，梯度断开；SuperMimic 换成可导的 ĉ。
- 爆炸取决于闭环系统和 Λ+ln γ，不只是长度（玩具演示；这个解释是整理时加的，未在人形上验证）。
- 评论家不总是必需：HalfCheetah 上 No Critic 到 8286。

## Dreamer 读后要点

- 贡献主要在行为学习，世界模型沿用 PlaNet 的 RSSM；200 维确定路径只在代码里。
- V_λ 等价于短递推；λ=0.95、H=15 时最长项占 48.8%，γ¹⁵=0.86。
- SuperMimic 只一句提到 Dreamer，未说继承什么。逐项差别：隐状态对显式状态、随机对确定性、一步 KL 对 8 步自回归。
- 823 对 786 任务集不同：同 18 任务是 813.77，D4PG 12 个任务更高。

## SuperTrack 读后要点

- 世界模型只学确定性物理，预测局部加速度，积分写死。
- W 滚 8 帧、Π 穿过 W 滚 32 帧，SuperMimic 数值相同，是否沿用没有证据。
- LaFAN 上 20 小时，ST 约 0.91，PPO 约 0.40（矢量图读数）。
- 没有评论家，前瞻止于 0.53 秒；SuperMimic 补了这一段。

## RWM 读后要点

- 差距主要在训练窗口外：第 8 步 RWM 0.233、MLP 0.261，t=199 为 0.509、约 4.60。
- N 从 2 到 8 只多 2% 训练时间，e 从 1.91 降到 0.47；N 到 32 无收益。
- PPO 的梯度不含模型雅可比；RWM 只对模型自身参数 φ 穿过模型反传。
- 有仿真器时不省时间：55 对 10 分钟，真机奖励同为 0.90。

## DeepMimic 读后要点

- 模仿奖励是指数项加权和，每项对不同偏差敏感。
- RSI 解决“不会落地就不敢起跳”；ET 让摔倒后的收益归零。
- 回报区分不了真翻和小跳（0.730 对 0.791），作者靠看动作判断。
- 公开代码的奖励与论文公式差别很大。
- §11 的局限（相位、片段少、算力）是后续工作的路线图。

## SuperMimic 读后要点

SuperMimic 只学一个可微世界模型，从仿真器记录的转移拟合，和策略放在一个循环里一起训练，再穿过它做 32 步的 BPTT，梯度不经过仿真器。论文的结论：

- 1 张 H100 跑 3 小时超过 SONIC 在 128 张 L40 上训练 7 天的回报，GPU 小时少 1000 倍以上；129,514 个动作的基准上失败 25 个，SONIC 失败 179 个；2 张 GPU 跑 9.8 小时后 0 失败。
- 动作从 1 小时加到 264 小时，8 步误差保持在 0.007 到 0.011，到目标回报的算力增长很慢。
- 同一个策略不按动作调参，迁移到真实 Unitree G1，能做侧滚和空翻。

精读时核算出的问题，挑最重要的几条，全部 18 条见精读页末尾：

- **最干净的算力比值是至少 121 倍。**7168 倍的算术没错，但混着数据量和 GPU 型号的差异，也不知道 SONIC 何时第一次到 0.90。同任务的受控对比是 144 对 1.19 GPU 小时。
- **“25”在图 A.1 上读不到。**矢量图读数都是整数，3 小时附近是 27、31、30、24，整条曲线没有 25。
- **“一次迭代”的含义对不上。**点距反推每次迭代约 105 毫秒，和图 5(a) 的速度放在一起，更像每次迭代 0.4 次更新，而不是“每次迭代都更新”。
- **窗口外才是大头。**γ³² = 0.725，折扣回报约 73% 在 32 步之外，全靠评论家；但 32 步的误差数据论文一个也没给。
- **判据不同。**SONIC 按 SuperMimic 的判据评测，影响多大论文没报告。论文说 SONIC 自己的判据没有朝向项，这只对 SONIC v4 正文成立：v1–v3、Data S1 和官方代码都有朝向项，公布配置训练时还更严。

## 3D World Simulator 读后要点

3D World Simulator 把 RGB-D 点云压成 3D 体素潜变量，用 3D U-Net 加时空注意力在潜空间里按动作自回归预测，再解码成带 3D 高斯的粒子，所以同一个预测状态能渲染任意视角，也能输出触觉粒子。论文的结论：

- ALOHA 六个任务上 200 步开环预测，各项指标都好过 Cosmos、Robot4DGen、IWS 三个视频基线和 PGND、PointWorld、ParticleFormer 三个粒子基线。
- 只用模拟器数据训练的 ACT、DP、π0.5、Cosmos Policy，真机成功率接近真实数据训练的。
- 模拟器成功率和真机成功率的 Pearson r 为 0.958、0.965、0.859；在 Deform360 上预训练后能对未见物体做 MPPI 规划。

精读时核算出的问题，挑最重要的几条，全部 12 条见精读页末尾：

- **图 7 的相关性主要来自训练进度。**从矢量图读出全部 36 个点，复算 r 为 0.956、0.964、0.859。模拟器有天花板，叠布 5 个检查点模拟满分、真机 0.75 到 1.0；还有系统偏差，零件装配平均高估 0.18。
- **图 6 的“相当”要打折扣。**柱高都是 1/80 的整数倍；推 T 是 67 对 54，p ≈ 0.03。附录把差距归因于新视角更难，但两根柱子用的是同一个视角。
- **图 6 和图 7 不是同一批策略**，模拟示范的动作从哪来、模拟器里怎样判成功也没说明。
- **“50 Hz”没有计时数据**，数据帧率也没交代，200 步可能是 4 秒也可能是 20 秒；课程训练最终的 K 也没给。

## SIMPLER 读后要点

SIMPLER 在 Google Robot 和 WidowX 两个平台上搭了一组仿真评测环境，用约 1500 次真机评测检验仿真成绩能不能代替真机成绩。论文的三条结论：

- 仿真和真机的相对成绩强相关。作者为此提出 MMRV：按两个策略在真机上的差距给错排加权，再对策略取平均。
- 仿真能复现策略对分布偏移的敏感度，还提前预测出给机械臂包上礼品纸会让 Octo-Base 失效。
- 控制差距和视觉差距都要处理：控制靠系统辨识，视觉靠绿幕背景加纹理匹配，而且要覆盖场景的所有部分。物体质量、摩擦估不准，影响反而不大。

精读时核算出的问题，挑最重要的几条，全部 15 条见精读页末尾：

- **表 VI 的算法和公式不一致。**变化量用的是绝对值的平均，不是式 (6)；MMRV 多数格子取的是最大的一次错排。同一个量，图 8 写 0.016，表 VI 写 0.041。
- **图 10 不是同一批策略的对比。**Isaac Sim 只有 5 个策略，没有 RT-2-X；SAPIEN 的 MMRV 0.082 用表 IV 算不出来。Isaac Sim 的绝对成功率只有真机的一半到四分之一。
- **正文和表对不上。**视觉消融正文写 RT-1 (Begin)，表里是 RT-1 (15%)；表 I 的“抽屉”列其实是两个抽屉任务的平均。
- **茄子任务像是做了 30 次。**真机数字都是 1/30 的倍数，附录写的是 24 次。
- **样本很小。**Bridge 只有 3 个策略，每个 r 只基于 3 个点；Kruskal-Wallis 检验在几十次试验上功效有限。

## GAUGE 读后要点

GAUGE 用 22 个任务族、约 1,560 次动捕试验做真实基准，覆盖刚体、绳、布料和三维软体，用它评测 Isaac Sim、Genesis、Newton 三个物理引擎和 6 个视频世界模型。论文的三条结论：

- 没有哪个引擎处处可信。差距最大的是冲击接触、快速运动的布料和三维软体形变。
- 视频模型可以形式对、参数错。生成的轨迹符合预期的方程形式，加速度、动量传递和振荡周期却算错了。
- 提示词影响很大。同一段负向提示词，对不同模型和任务的作用方向相反，所以评测要固定模板并成对报告。

精读时核算出的问题，挑最重要的几条，全部 15 条见精读页末尾：

- **图和表对不上。**加负向提示词的那几条曲线，图 4 和图 10 图例里的数值与表 4 不一致。
- **引擎对比只看了一种材料。**表 3 每个任务只列一种材料或一个子任务。布料拉伸误差接近 1 倍基线的好成绩只在缎面上成立，因为缎面的真实基线比其他面料大一个数量级。
- **视频模型像在慢放。**把加速度和周期的误差换算成时间尺度，最接近真实的几个结果大多相当于把视频放慢 1.7 到 2.5 倍，正好对应“形式对、参数错”。
- **提示词有矛盾。**牛顿摆的提示把碰撞写成明显的非弹性，恢复系数 0.20；真实装置第一次碰撞的动量传递效率约 93%。另有几条提示写错了材质。
- **EL 的好坏方向写反。**附录说能量损失 EL 越接近 1 越好，按定义应是越接近 0 越好。

## 写法约定

- 不是逐字翻译。论文保留版权时，用自己的话按原文顺序整理，正文和附录的每一小节都会讲到，小节编号与原文一致。
- 公式按原文编号给出，用 MathJax 排版。
- 表格数字照录原文；放不下的大表整理成要点。
- 图：论文以 CC BY 这类开放许可发布时，直接放原文插图并注明出处；版权保留的论文默认用文字描述那张图，注明页码，并链接到原文里的同一张图；SuperMimic 按站长决定放了裁切的原图，版权仍归作者。仓库不收录论文 PDF。
- 读者注记录核算或对照时发现的问题，不属于论文内容，页尾有汇总。
- 文中提到的基准、数据集、引擎和模型做成蓝色链接，指向主页；页尾链接表同时给主页和论文，发布前逐个核对能打开。

## 目录

```
index.html          论文列表与写法约定
papers/supermimic.html       SuperMimic 精读
papers/supermimic/charts.js  精读页的折线图，数据从原文矢量图读出，是重画的
papers/supermimic/*.webp     从 PDF 裁切的原图 8 张（图 1-7、图 A.1），版权归作者
papers/{shac,dreamer,supertrack,rwm,deepmimic,rwm-u,dreamerv3,td-mpc,daydreamer,controlvae,sonic,phc,moconvq,superdyno,beyondmimic,pulse,latent}.html  SuperMimic 引用论文的精读（图表数据和开放许可论文的原图在同名目录）
interactives/{shac,dreamer,supertrack,rwm,deepmimic,rwm-u,dreamerv3,td-mpc,daydreamer,controlvae,sonic,phc,moconvq,superdyno,beyondmimic,pulse,latent}/  对应的 3D 框架动画
interactives/supermimic/     SuperMimic 的 11 幕 3D 框架动画（精读页内嵌）
papers/3dws.html   3D World Simulator 精读
papers/3dws/       3D World Simulator 的原文插图，按 CC BY 4.0 使用，只做了裁切
interactives/3dws/ 3D World Simulator 的 3D 可交互架构图 index.html 和自编码器 9 幕分步动画 ae.html（都在精读页内嵌）
assets/lab3d.js    3D 交互图共用的 three.js 工具
papers/simpler.html SIMPLER 精读
papers/simpler/     SIMPLER 的原文插图，按 CC BY 4.0 使用，只做了裁切
papers/gauge.html   GAUGE 精读
papers/foundationpose.html  FoundationPose 架构专题
papers/wapr.html            WAPR 架构专题
papers/tro-grasp.html       T(R,O) Grasp 架构专题
papers/tro-grasp-plus-plus.html  Grasp++ 与原版逐层对比
papers/graspgen.html        GraspGen 逐节精读（原图在 papers/graspgen/，动画在 interactives/graspgen/）
assets/grasp-lab.css        新增架构图样式
assets/grasp-lab.js         网络 / 训练切换与尺寸计算
interactives/foundationpose-wapr/  位姿估计对比交互图解
interactives/tro-grasp/            图扩散抓取网络交互图解
assets/site.css     共用样式，沿用 World Model Lab 的配色
```

本地打开 `index.html` 即可，不需要构建；公式用 MathJax，从 cdnjs 加载。新加一篇论文：仿照 `papers/simpler.html` 或 `papers/gauge.html` 的页头和骨架写成 `papers/<简称>.html`，再在 `index.html` 和上面的表里各加一条。

交互页只包含自行绘制的图与解释，不包含模型权重、论文 PDF 或运行后的模型输出。原文版权归各自作者所有，这里只放阅读笔记。姊妹站：[World Model Lab](https://haoxiangntu.github.io/world-model-lab/)、[LLM Inference Lab](https://haoxiangntu.github.io/llm-inference-lab/)。
