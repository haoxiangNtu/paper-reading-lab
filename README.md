# Paper Reading Lab

论文阅读与理解的记录。包含逐节精读与架构专题；架构专题附交互图解，明确标注阅读范围。逐节精读：按原文顺序逐节整理，公式照原文编号排版，主要结果表照录数字。开放许可的论文直接放原图，版权保留的论文用文字描述那张图，并链接到原文。读的时候核算出的问题单独标成“读者注”，和论文内容分开。

**站点：https://haoxiangntu.github.io/paper-reading-lab/**

## 已读论文

| 论文 | 精读页 | 主题 | 读者注 |
|---|---|---|---|
| Real2Worlds2Real: Scaling Self-Improving Agentic Real2Sim2Real for Robot Manipulation（[arXiv 2611.31098](https://arxiv.org/abs/2611.31098)，2026-11） | [real2worlds2real 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/real2worlds2real.html) | 编码代理（GPT-6 Astra）调度工具建数字孪生和表亲、按视频标定物理，再调度策略开发，技能跨任务复用。真机每格 30 次，和真机训练分不开；真机对比只用了孪生；表 3 比的是有无仿真闭环。非独占许可，经站点作者决定放原图 1–5，图 4、图 5 另按矢量路径读数重画。代码未发布。 | 13 条 |
| FabricBench: A Standardized Policy Benchmark for Bimanual Fabric Manipulation with a Contact-Driven Deformable Simulator（[arXiv 2611.31577](https://arxiv.org/abs/2611.31577)，2026-11） | [fabricbench 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/fabricbench.html) | 双臂布料策略基准，接触驱动的抓放和双向负载传递；6 任务 × 6 策略，构型比外观难。真机只证明任务难度排序；RGBench 对比漏了同团队 GarmentDynamics；π0.5 训练样本是 openpi 默认的四分之一。非独占许可，经站点作者决定放原图 1–6；没有 3D 动画，页内有摩擦交互图和两张重画图。代码未发布。 | 21 条 |
| ∇Mimic: Ultra-Efficient Humanoid Control with Differentiable Simulation（[arXiv 2610.41654](https://arxiv.org/abs/2610.41654)，2026-10） | [nablamimic 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/nablamimic.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/nablamimic/index.html) | 给 MuJoCo Warp 反向打补丁，一阶梯度训练人形跟踪。“20 分钟对 1.2 小时”GPU 不同口径，同为 H100 约 2.9 倍；默认配置不是论文配方。非独占许可，图用文字描述。 | 20 条 |
| Igniting VLMs toward the Embodied Space（WALL-OSS，[arXiv 2509.11766](https://arxiv.org/abs/2509.11766)，2025-09，CC BY 4.0） | [wall-oss 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/wall-oss.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/wall-oss/index.html) | VLA，不是世界模型。图 7 和正文数字对不上；参数量可精确拆分；代码冻结范围比论文说的大。另有“提法与对比的公平性审视”一节（#audit），含 π0 与 WALL-OSS 单层结构对比图（#fig-attn）。 | 19 条 |
| Wall-OSS-0.5 Technical Report（[arXiv 2605.30877](https://arxiv.org/abs/2605.30877)，2026-06，CC BY 4.0） | [wall-oss-05 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/wall-oss-05.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/wall-oss-05/index.html) | 零样本可执行的 4B VLA。“高 17.5%”是百分点；图 1、图 7 和附录表对不上；公开代码没有 RVQ 分词器。含 WALL-OSS 1.0 模型卡小节和 RoboDojo 榜单分析（#w10-rd）。 | 21 条 |
| WALL-SS: Scaling Long-horizon World Models via Next-Scale Autoregression（[arXiv 2608.26239](https://arxiv.org/abs/2608.26239)，2026-08） | [wall-ss 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/wall-ss.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/wall-ss/index.html) | 按尺度自回归的动作可控世界模型。闭环评估数字能复算；“排第一”只对平均成立；代码未发布。非独占许可，仓库图 MIT。 | 20 条 |
| Sharpa CraftNet（无论文；[公告](https://www.sharpa.com/blogs/news/sharpa-announces-craftnet-a-hierarchical-vtla-model-for-fine-manipulation) + DQ 部署报道，© 保留） | [craftnet 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/craftnet.html) · [10 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/craftnet/index.html) | System 2/1/0 = 1/10/100 Hz；公告说 CraftNet 只是 System 0+1。DQ 案例页不提 CraftNet，没有公开介入率。 | 16 条 |
| WM-Craftnet: World Synesthesia Model for Dexterous In-Hand Manipulation（[arXiv 2609.07002](https://arxiv.org/abs/2609.07002)，2026-09，CC BY 4.0） | [wm-craftnet 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/wm-craftnet.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/wm-craftnet/index.html) | 世界模型潜变量作策略条件。论文没提 System 0/1/2；代码奖励预测权重为 0；多处配置和表 7 不同。 | 24 条 |
| FTP-1: A Generalist Foundation Tactile Policy Across Tactile Sensors（[arXiv 2606.13102](https://arxiv.org/abs/2606.13102)，v4，CoRL 2026，CC BY-SA 4.0） | [ftp1 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/ftp1.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/ftp1/index.html) | 跨 21 种传感器的触觉策略。+17.2% 是百分点且基线平均算错；公开触觉专家约 99M 不是 300M；没提 CraftNet。 | 14 条 |
| DiffMimic: Efficient Motion Mimicking with Differentiable Physics（[arXiv 2304.03274](https://arxiv.org/abs/2304.03274)，ICLR 2023） | [diffmimic 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/diffmimic.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/diffmimic/index.html) | Brax 可微仿真里整段 BPTT 做动作模仿 + Demonstration Replay。替换参考状态同时截断梯度；发布配置和论文不同；表 2 两个百分比算错。非独占许可，图用文字描述。 | 20 条 |
| DaXBench: Benchmarking Deformable Object Manipulation with Differentiable Physics（[arXiv 2210.13066](https://arxiv.org/abs/2210.13066)，ICLR 2023 oral） | [daxbench 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/daxbench.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/daxbench/index.html) | JAX 可微仿真（MPM + 质点-弹簧），9 个可变形物体任务。表 4 不是图 3 的终值；发布的 SHAC 实际没有短窗口；倒汤目标路径缺失。 | 21 条 |
| Learning Sim-to-Real Humanoid Locomotion in 15 Minutes（[arXiv 2512.01996](https://arxiv.org/abs/2512.01996)，2025-12） | [holosoma-15min 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/holosoma-15min.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/holosoma-15min/index.html) | FastSAC / FastTD3 一张 4090 约 15 分钟训出 G1 / T1 行走。对照 holosoma 78aeb23：目标 Q 各用各的、演员 8 次只更新 2 次、AdamW；FastTD3 不在 holosoma 里。含复现要点。 | 20 条 |
| RPL: Learning Robust Humanoid Perceptive Locomotion on Challenging Terrains（[arXiv 2602.03002](https://arxiv.org/abs/2602.03002)，v3 2026-10，CoRL 2026） | [rpl 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/rpl.html) · [10 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/rpl/index.html) | 分地形特权专家 → 多路深度学生蒸馏，Warp 光线投射渲染。“5 倍”只在 4 路相机时成立（1 路 2.7 倍）；对照 RPL 1ca0250：DFSV 阈值符号相反，混合 DAgger+RL 没有发布。非独占许可，经决定放原图。 | 21 条 |
| Perceptive Humanoid Parkour: Chaining Dynamic Human Skills via Motion Matching（[arXiv 2602.15827](https://arxiv.org/abs/2602.15827)，v2 2026-05，RSS 2026） | [php-parkour 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/php-parkour.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/php-parkour/index.html) | motion matching 拼技能 → 特权专家跟踪 → DAgger+RL 蒸馏成深度学生。对照 php_parkour c7c9ce3：高度扫描 1.6 m（论文 0.7 m）、学生 30K 次、实际 32,768 环境（issue #5）。 | 22 条 |
| GR00T 2: Scaling Robot Foundation Models for Generalization, Dexterity, and Adaptation（[NVIDIA 白皮书](https://research.nvidia.com/labs/gear/gr00t-2/assets/gr00t2_whitepaper.pdf)，2026-11，无 arXiv） | [gr00t2 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/gr00t2.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/gr00t2/index.html) | 从 Cosmos-Predict2.5-2B 出发、同时预测未来画面和动作的世界-动作模型；N1.x → 2 对照。40/71/95 口径核对（跨具身、任务经筛选）；“2B”不含文本编码器；LIBERO-PRO 引导实验与标准 LIBERO 不可比。正式代码 12 月发布，开发分支（评测许可）只引文件名和键名。 | 26 条 |
| WeVisOne-VL: Unified Visual Perception from Objects to Pixels（[arXiv 2610.31329](https://arxiv.org/abs/2610.31329)，2026-10） | [wevisone-vl 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/wevisone-vl.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/wevisone-vl/index.html) | WeVisOne-VL：Qwen3-VL 加坐标 token 和 <OBJ> 像素解码器，统一目标级和像素级感知。对照代码 9a6bcd8：解码器 4B 9,609,764 参数（2B 卡片写错）；精修是 256→512→1024 且分割也走；README 表 216 个数全对。 | 13 条 |
| Learning Heterogeneous Tactile Representation for General Dexterous Manipulation（[arXiv 2611.12806](https://arxiv.org/abs/2611.12806)，2026-11） | [lingbot-touch 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/lingbot-touch.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/lingbot-touch/index.html) | LingBot-Touch：跨压阻 / 磁 / 视触觉三类传感器的 JEPA 触觉编码器，4,983 小时预训练，冻结后接 VLA 和 RL。对照推理代码 dec8025：只公开冻结编码器；Small 的 tubelet 是 4（正文写 2）；表 2 用 4K 小时编码器，公开的是 5K。 | 18 条 |
| Cosmos World Foundation Model Platform for Physical AI（[arXiv 2501.03575](https://arxiv.org/abs/2501.03575)，2025-01） | [cosmos 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/cosmos.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/cosmos/index.html) | 视频整理管线、因果 Tokenizer（连续 / 离散）、扩散与自回归世界基础模型、相机 / 机器人 / 驾驶后训练和护栏。代码对照 cosmos-predict1：自回归模型其实用了 GQA、z-loss 写法和系数不同；4B 到 14B 物理指标不随规模变好。 | 30 条 |
| Cosmos-Transfer1: Conditional World Generation with Adaptive Multimodal Control（[arXiv 2503.14492](https://arxiv.org/abs/2503.14492)，2025-03） | [cosmos-transfer1 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/cosmos-transfer1.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/cosmos-transfer1/index.html) | 每种控制（模糊、边缘、深度、分割、高精地图、LiDAR）一个 3 块 ControlNet 分支，分开训练、推理时按 w / max(Σw, 1) 融合；用于 Sim2Real 和驾驶数据增强。64 卡实时方案不在开源代码里。 | 16 条 |
| Cosmos-Reason1: From Physical Common Sense To Embodied Reasoning（[arXiv 2503.15558](https://arxiv.org/abs/2503.15558)，2025-03） | [cosmos-reason1 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/cosmos-reason1.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/cosmos-reason1/index.html) | 物理常识与具身推理的本体，R1 蒸馏 SFT 加多选题 GRPO。v3 把 7B 骨干从自建混合结构换成 Qwen2.5-VL；正文几处没跟上表格；56B 未发布，现有权重不是论文检查点。Cosmos-Predict2.5 的文本编码器就是它。 | 24 条 |
| World Simulation with Video Foundation Models for Physical AI（[arXiv 2511.00062](https://arxiv.org/abs/2511.00062)，2025-10） | [cosmos-predict25 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/cosmos-predict25.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/cosmos-predict25/index.html) | Wan2.1 VAE + Cosmos-Reason1 文本编码 + DiT，流匹配，再 SFT、模型合并、RL、蒸馏。2B 实为 28 层（表 3 写 32）。和 OpenWAM：§4.1.1 得 91.64；OpenWAM 接它时可能漏设 timestep_scale（差 1000 倍，只读代码）。 | 22 条 |
| Cosmos Policy: Fine-Tuning Video Models for Visuomotor Control and Planning（[arXiv 2601.16163](https://arxiv.org/abs/2601.16163)，2026-01） | [cosmos-policy 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/cosmos-policy.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/cosmos-policy/index.html) | 动作、本体、价值都写进 Cosmos-Predict2 的隐帧，三种掩码联合训练，再 best-of-N 规划；LIBERO 98.5、RoboCasa 67.1。附 LIBERO 设置：自生成 1,700 条数据、只上下翻转、OpenVLA 步数上限，和 OpenWAM 的 99.3 不同协议。 | 18 条 |
| Cosmos 3: Omnimodal World Models for Physical AI（[arXiv 2606.02800](https://arxiv.org/abs/2606.02800)，2026-06） | [cosmos3 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/cosmos3.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/cosmos3/index.html) | 理解塔和生成塔两套参数、只在注意力里相遇；同一网络当 VLM、视频生成器、正逆动力学模型和策略。附官方 LIBERO-10 配方；OpenWAM 支持 Cosmos3-Edge 作骨干但论文没有它的实验。 | 25 条 |
| Interactive World Simulation with Cosmos for Physical AI（[arXiv 2611.06627](https://arxiv.org/abs/2611.06627)，2026-11） | [cosmos-interactive 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/cosmos-interactive.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/cosmos-interactive/index.html) | Cosmos 3 经四阶段后训练（双向适配 → TF → TF-dCM 4 步 → SF-DMD）变成块因果、流式模拟器。实时只对部分场景成立，控制到画面延迟没有实测；闭环策略评测只有 32 个起点、统计上分不开。 | 23 条 |
| GR00T N1: An Open Foundation Model for Generalist Humanoid Robots（[arXiv 2503.14734](https://arxiv.org/abs/2503.14734)，2025-03） | [gr00t 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/gr00t.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/gr00t/index.html) | Eagle-2 VLM 取第 12 层 + 流匹配 DiT 动作头；数据金字塔（真机、仿真、生成视频、人类视频的 LAPA/IDM 伪动作）。式 (1) 速度符号写反（代码对）；N1.7 README 结构和发布权重不符。OpenWAM 表里 N1.6 的 49.9 找不到出处。 | 26 条 |
| DINOv3（[arXiv 2508.10104](https://arxiv.org/abs/2508.10104)，2025-08，非独占许可，经决定放原图） | [dinov3 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/dinov3.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/dinov3/index.html) | 自监督 ViT-7B + Gram anchoring + 蒸馏；代码对照 6876159（DINOv3 License）；OpenWAM 表示式编码器的上游。 | 23 条 |
| Diffusion Transformers with Representation Autoencoders（RAE，[arXiv 2510.11690](https://arxiv.org/abs/2510.11690)，2025-10，CC BY 4.0） | [rae 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/rae.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/rae/index.html) | 冻结表示编码器 + ViT 解码器当自编码器；DiT 宽度 ≥ token 维度、按维度调 shift、解码器噪声增强、DiT^DH；代码对照 a4d18c4。 | 22 条 |
| V-JEPA 2.1: Unlocking Dense Features in Video Self-Supervised Learning（[arXiv 2603.14482](https://arxiv.org/abs/2603.14482)，2026-03，CC BY-NC-ND 4.0，经决定放原图） | [vjepa21 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/vjepa21.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/vjepa21/index.html) | 稠密预测损失 + 深监督的视频自监督编码器；代码对照 vjepa2 204698b；OpenWAM 表示式编码器的上游。 | 27 条 |
| Wan: Open and Advanced Large-Scale Video Generative Models（[arXiv 2503.20314](https://arxiv.org/abs/2503.20314)，2025-03，非独占许可，经决定放原图） | [wan 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/wan.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/wan/index.html) | Wan2.1 技术报告 + Wan2.2 MoE / Wan2.2-VAE / TI2V-5B 补充、FLUX.2-VAE 附节；OpenWAM 视频骨干的上游。 | 21 条 |
| Both Semantics and Reconstruction Matter（S-VAE / PS-VAE，[arXiv 2512.17909](https://arxiv.org/abs/2512.17909)，2025-12，非独占许可，经决定放原图） | [svae 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/svae.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/svae/index.html) | 表示编码器特征压成 KL 正则隐空间；OpenWAM S-VAE 的出处，附与 OpenWAM 实现的逐项对照。 | 16 条 |
| LIBERO: Benchmarking Knowledge Transfer for Lifelong Robot Learning（[arXiv 2306.03310](https://arxiv.org/abs/2306.03310)，NeurIPS 2023 D&B，CC BY 4.0） | [libero 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/libero.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/libero/index.html) | 130 个程序化生成任务的终身学习基准；3 种网络 × 5 种算法的 FWT/NBT/AUC，代码对照 8f1084e；附 VLA 用法和复现要点。 | 21 条 |
| OpenWAM: An Open, Modular Exploration Towards Systematic World-Action Model Pretraining（[arXiv 2609.07398](https://arxiv.org/abs/2609.07398)，2026-09，CC BY 4.0） | [openwam 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/openwam.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/openwam/index.html) | 世界-动作模型的模块化研究栈 + OpenWAM-α（Wan2.2-5B + 1B ActionDiT）；RoboTwin 受控消融，LIBERO 99.3%，附 LIBERO 复现要点。 | 19 条 |
| MolmoAct2: Action Reasoning Models for Real-world Deployment（[arXiv 2605.02881](https://arxiv.org/abs/2605.02881)，v2 2026-05，非独占分发） | [molmoact2 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/molmoact2.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/molmoact2/index.html) | 离散动作 token VLM + 逐层 KV 流匹配专家 + 自适应深度推理；LIBERO 97.2 / 98.1 核实，表 8 一格不可能，附 LIBERO 复现要点。 | 27 条 |
| Mundo: Customized World Model（无论文；[项目页](https://mundo-world-model.github.io/) + [HF 博客](https://huggingface.co/blog/Luo-Yihang/mundo-world-model)，2026-10-23，© 保留） | [mundo 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/mundo.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/mundo/index.html) | 显式 3D 代理 + 场景程序 + MuJoCo 算物理，视频扩散按 proxy 帧和照片渲染外观；无定量评测，用页面数据核对了弹跳、时间线和框修正。 | 14 条 |
| Real Garment Benchmark (RGBench)（[arXiv 2511.06434](https://arxiv.org/abs/2511.06434)，v2，AAAI 2026） | [rgbench 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/rgbench.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/rgbench/index.html) | 衣物网格库 + 闭源 GarmentDynamics 模拟器 + 真实点云 CD/HD 评测；表 4、5 和公开 CSV 逐格一致，附录 C 多处文字和表不符。 | 22 条 |
| PhysTwin: Physics-Informed Reconstruction and Simulation of Deformable Objects from Videos（[arXiv 2503.17973](https://arxiv.org/abs/2503.17973)，ICCV 2025） | [phystwin 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/phystwin.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/phystwin/index.html) | 弹簧-质点 + CMA-ES 与可微模拟两段辨识 + 高斯 LBS；对照官方代码核了积分、弹簧力、子步和优化细节。 | 17 条 |
| Real-to-Sim Robot Policy Evaluation with Gaussian Splatting Simulation of Soft-Body Interactions（[arXiv 2511.04665](https://arxiv.org/abs/2511.04665)，v2 2025-11，CC BY 4.0） | [real2sim-eval 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/real2sim-eval.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/real2sim-eval/index.html) | 3DGS 外观 + PhysTwin 软体孪生做仿真评测，仿真与真机成功率 r 0.90–0.94；复算全部 r，MMRV 只有对调 SIMPLER 函数参数才算得出。 | 20 条 |
| Scalable Humanoid Whole-Body Control via Differentiable Neural Network Dynamics（SuperDyno，[OpenReview](https://openreview.net/pdf/b3031990328dd52267a571b265c15328bf6d6120.pdf)，ICLR 2025 Workshop，无开放许可，SuperMimic 引用） | [superdyno 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/superdyno.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/superdyno/index.html) | SuperTrack 式可微神经动力学搬到 Isaac Gym：预测速度再积分，策略穿过模型反传 32 步，无评论家，跟踪 AMASS 11313 段。 | 25 条 |
| MaskedMimic: Unified Physics-Based Character Control Through Masked Motion Inpainting（[arXiv 2409.14393](https://arxiv.org/abs/2409.14393)，SIGGRAPH Asia 2024，CC BY-NC-SA 4.0，SuperMimic 引用） | [maskedmimic 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/maskedmimic.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/maskedmimic/index.html) | 全身跟踪器蒸馏进只看遮挡目标的条件 VAE，任务靠推理时的“目标工程”完成；含 V1 代码核对。 | 21 条 |
| Physics-based Character Controllers Using Conditional VAEs（PhysicsVAE，[doi:10.1145/3528223.3530067](https://doi.org/10.1145/3528223.3530067)，SIGGRAPH 2022，无 arXiv，SuperMimic 引用） | [physicsvae 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/physicsvae.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/physicsvae/index.html) | 条件 VAE 加冻结的一步可导仿真层蒸馏模仿控制器，下游 PPO 训任务编码器和有界帮手分支。 | 21 条 |
| Neural Probabilistic Motor Primitives for Humanoid Control（NPMP，[arXiv 1811.11711](https://arxiv.org/abs/1811.11711)，ICLR 2019，SuperMimic 引用） | [npmp 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/npmp.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/npmp/index.html) | 2707 个单片段专家离线压进 60 维潜变量逆模型，解码器当动作空间训高层；图 3、4、6 从矢量读数。 | 19 条 |
| BeyondMimic: From Motion Tracking to Versatile Humanoid Control via Guided Diffusion（[arXiv 2508.08241](https://arxiv.org/abs/2508.08241)，Science Robotics 2026，SuperMimic 引用） | [beyondmimic 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/beyondmimic.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/beyondmimic/index.html) | 同一套跟踪 MDP 上真机做空翻冲刺，再用 DAgger 蒸馏的 VAE 加状态-潜变量扩散，推理时代价引导零样本完成摇杆、路点、避障和关键帧补全；含和 SuperMimic 附录 A 的逐项对照。 | 23 条 |
| Universal Humanoid Motion Representations for Physics-Based Control（[arXiv 2310.04582](https://arxiv.org/abs/2310.04582)，ICLR 2024，CC BY-NC-SA 4.0，SuperMimic 引用） | [pulse 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/pulse.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/pulse/index.html) | 先训能模仿全部 AMASS 的老师 PHC+，在线蒸馏成 32 维带可学习先验的潜空间，下游任务只学残差潜码。 | 25 条 |
| Learning Athletic Humanoid Tennis Skills from Imperfect Human Motion Data（LATENT，[arXiv 2603.12686](https://arxiv.org/abs/2603.12686)，SuperMimic 引作 IROS 2026，未核实，CC BY 4.0，SuperMimic 引用） | [latent 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/latent.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/latent/index.html) | 不完美的网球动作片段 → 跟踪器 → DAgger 潜空间 → 潜动作屏障约束的高层 PPO 加手腕直控，Unitree G1 和人对打。 | 20 条 |
| A Diffusion-based Framework for 6-DOF Grasping with On-Generator Training（[arXiv 2507.13097](https://arxiv.org/abs/2507.13097)，ICRA 2026，CC BY-SA 4.0） | [GraspGen 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/graspgen.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/graspgen/index.html) | 扩散生成抓取，再用见过生成器错误的判别器打分；含代码核对和它为什么不是 GAN | 23 条 |
| SONIC: Supersizing Motion Tracking for Natural Humanoid Whole-Body Control（[arXiv 2511.07820](https://arxiv.org/abs/2511.07820)，Science Robotics 2026，SuperMimic 引用） | [sonic 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/sonic.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/sonic/index.html) | 把动作跟踪放大到 128 卡、1 亿帧、42M 参数，并用 FSQ 通用 token 接上规划器、遥操作和 VLA。 | 18 条 |
| Perpetual Humanoid Control for Real-time Simulated Avatars（[arXiv 2305.06456](https://arxiv.org/abs/2305.06456)，ICCV 2023，SuperMimic 引用） | [phc 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/phc.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/phc/index.html) | 不加外力模仿 AMASS 98.9%：动作越练越难就新建 primitive 并冻结旧的，再用 composer 组合，摔倒能自己爬起走回去。 | 25 条 |
| MoConVQ: Unified Physics-Based Motion Control via Scalable Discrete Representations（[arXiv 2310.10198](https://arxiv.org/abs/2310.10198)，SIGGRAPH 2024，SuperMimic 引用） | [moconvq 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/moconvq.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/moconvq/index.html) | 把几十小时动作压成离散索引、再用物理解码回来，穿过世界模型训练，并接上 GPT 和大语言模型。 | 18 条 |
| Uncertainty-Aware Robotic World Model Makes Offline Model-Based Reinforcement Learning Work on Real Robots（[arXiv 2504.16680](https://arxiv.org/abs/2504.16680)，arXiv 2025，SuperMimic 引用） | [rwm-u 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/rwm-u.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/rwm-u/index.html) | 给 RWM 加集成不确定性，只用日志离线训练策略并部署到真机。 | 18 条 |
| Mastering Diverse Domains through World Models（[arXiv 2301.04104](https://arxiv.org/abs/2301.04104)，Nature 2025，SuperMimic 引用） | [dreamerv3 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/dreamerv3.html) · [10 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/dreamerv3/index.html) | 同一套超参数跨 8 个领域的世界模型智能体：symlog、two-hot、KL 平衡、回报归一化，演员全部改用 Reinforce。 | 17 条 |
| Temporal Difference Learning for Model Predictive Control（[arXiv 2203.04955](https://arxiv.org/abs/2203.04955)，ICML 2022，SuperMimic 引用） | [td-mpc 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/td-mpc.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/td-mpc/index.html) | 每个决策步用学到的潜空间模型采样规划，H 步之外交给终值函数；模型不重建观测，只学奖励、价值和潜一致性。 | 15 条 |
| DayDreamer: World Models for Physical Robot Learning（[arXiv 2206.14176](https://arxiv.org/abs/2206.14176)，CoRL 2022，SuperMimic 引用） | [daydreamer 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/daydreamer.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/daydreamer/index.html) | 把 Dreamer 直接放到四台真实机器人上在线学习：actor 和 learner 解耦，从零学走路和视觉拣放，并用官方分数文件核对图上的数字。 | 14 条 |
| ControlVAE: Model-Based Learning of Generative Controllers for Physics-Based Characters（[arXiv 2210.06063](https://arxiv.org/abs/2210.06063)，SIGGRAPH Asia 2022，SuperMimic 引用） | [controlvae 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/controlvae.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/controlvae/index.html) | 用可微世界模型训练状态条件 VAE 控制器，再冻结技能空间做下游任务。 | 17 条 |
| Accelerated Policy Learning with Parallel Differentiable Simulation（[arXiv 2204.07137](https://arxiv.org/abs/2204.07137)，ICLR 2022，SuperMimic 引用，非独占许可，经决定放原图） | [shac 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/shac.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/shac/index.html) | 把任务切成 32 步短窗口，末端接评论家，让可微仿真在接触任务上真正快过 PPO，并拆解 SuperMimic 从它拿走和改掉了什么。 | 15 条 |
| Dream to Control: Learning Behaviors by Latent Imagination（[arXiv 1912.01603](https://arxiv.org/abs/1912.01603)，ICLR 2020，SuperMimic 引用） | [dreamer 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/dreamer.html) · [10 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/dreamer/index.html) | 把价值梯度穿过学到的隐空间动力学反传，只靠想象学长视野视觉控制；动画当场计算 V_λ，并有可运行的玩具循环。 | 16 条 |
| SuperTrack: Motion Tracking for Physically Simulated Characters using Supervised Learning（[doi:10.1145/3478513.3480527](https://doi.org/10.1145/3478513.3480527)，ACM TOG 2021，SuperMimic 引用） | [supertrack 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/supertrack.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/supertrack/index.html) | 把仿真器换成可导的世界模型，动作跟踪变成监督学习；动画在玩具两连杆上现场训练并算梯度。 | 17 条 |
| Robotic World Model: A Neural Network Simulator for Robust Policy Optimization in Robotics（[arXiv 2501.10100](https://arxiv.org/abs/2501.10100)，arXiv 2025，SuperMimic 引用） | [rwm 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/rwm.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/rwm/index.html) | 用自回归训练的 GRU 世界模型在想象轨迹上跑 PPO，策略零次迁移到 ANYmal D 和 Unitree G1。 | 17 条 |
| DeepMimic: Example-Guided Deep Reinforcement Learning of Physics-Based Character Skills（[arXiv 1804.02717](https://arxiv.org/abs/1804.02717)，SIGGRAPH 2018，SuperMimic 引用） | [deepmimic 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/deepmimic.html) · [11 幕 3D 动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/deepmimic/index.html) | 一段参考动作加模仿奖励、RSI 和 ET，让物理角色用 PPO 学会空翻；奖励可在真实骨架上当场算。 | 18 条 |
| SuperMimic: Scaling Humanoid Whole-Body Control with One Differentiable World Model（[arXiv 2610.28480](https://arxiv.org/abs/2610.28480)，2026-10，CoRL 2026） | [SuperMimic 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/supermimic.html) | 一个可微世界模型加短视野 BPTT，把人形全身跟踪的训练算力降到单 GPU，含 [11 幕 3D 框架动画](https://haoxiangntu.github.io/paper-reading-lab/interactives/supermimic/) | 20 条 |
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

概念专题（不是单篇论文）：

| 专题 | 页面 | 交互 | 要点 |
|---|---|---|---|
| 六个操作策略对照（2026-11-25） | [six-policies](https://haoxiangntu.github.io/paper-reading-lab/papers/six-policies.html) | 改动谱系 + 任选两个对比、六张结构图（训练 / 推理切换）、FabricBench 点图 | FabricBench 评测的 ACT、DP、π0.5、GR00T N1、LingBot-VA、Fast-WAM 按 8 个部件逐格对照；外观泛化按“有没有机器人预训练”分两组，构型泛化六个都差。表和交互共用页内 `#six-data`。 |
| VLA 设计空间（2026-11-24） | [vla-design-space](https://haoxiangntu.github.io/paper-reading-lab/papers/vla-design-space.html) | 部件图（按改动 / 按模型 / 按部件高亮）、6 种接法示意图 | VLA 拆成 8 个部件；15 类常见改动各改哪块；22 个模型总对照表（读表驱动交互）；从 Wall-OSS-0.5 §6 展开；非本站精读的模型只按摘要整理 |
| 强化学习算法谱系（2026-11-24） | [rl-families](https://haoxiangntu.github.io/paper-reading-lab/papers/rl-families.html) | 页内四个小图：谱系图、PPO 裁剪、Q 高估、三种梯度 | REINFORCE→A2C→TRPO→PPO 和 DQN→DDPG→TD3→SAC→PQL→FastTD3→FastSAC 是同一类可互换的算法；分界在数据复用、策略更新方式、价值学法；PQL、FastTD3 对照原文核对 |

## Real2Worlds2Real 读后要点

- 框架是“代理 + 工具 + 分层技能”：核心原则、任务工作流、专项技能是内置的，代理自己写的个人技能单独存，下个任务可读。建世界和练策略两段都靠渲染比对和仿真回放来修正。
- 真机表 1(a) 只建了数字孪生，标题里的“一族世界”和视频物理标定都没在真机实验出场；表亲的作用只在 Stack Cups 的扩展曲线上出现，且没写是仿真还是真机评测。
- 每格 30 次：和“真机训练”逐任务 Fisher 检验都不显著（合计 137 对 127/150，p ≈ 0.11）；和 ASPIRE 只有 Cup 显著，Nut 22 对 19 分不开。
- 表 3 的 4.2% 来自带仿真的闭环辨识，Claude Opus 5.5、Qwen3-VL 是单次看视频猜，且各方法覆盖的任务不同。
- 技能复用：切柠檬 token 28.1M → 21.6M → 17.9M → 13.9M（中间两档读图），单次运行；LIBERO-Pro Long 52.9% → 82.2%，不挑程序的平均 44.1% → 69.1% 更公平；和 π0.5 ≤ 8% 比的是写程序的代理对端到端 VLA。

## FabricBench 读后要点

- 核心贡献是接触模型：三角形级 SDF 检测管释放和不穿透，双向耦合管负载传递，锚定库仑摩擦让持握不用夸大摩擦系数。表 2b：附着–分离让同一个 DP 检查点从 19/50 降到 9/50。
- 泛化实验一次只改一个因素：构型（C0–C2）比外观伤害大得多，展平 T 恤 C2 只剩 6–14%；但丝巾 C2 是“丢下来”、T 恤 C2 是“深折”，两者不可横比。
- 真机只部署了 π0.5，ρ = 0.94 说明任务难度排序一致，不说明策略排序一致；真机每格 20 次，中间四个任务分不开。
- 附录 H 的基线数字和 RGBench 表 5 逐个一致，但没列同团队闭源的 GarmentDynamics（平均 0.030，本文 0.054）。
- “官方配置”不官方：π0.5 批量 8 × 3 万步，样本是 openpi 默认的四分之一；各策略样本数最多差 2.7 倍。1 万件资产评测只用了 3 件模板。

## VLA、世界模型与触觉（自变量 WALL 三篇 + Sharpa 三篇 + ∇Mimic，2026-11-23）读后要点

- **WALL-OSS 不是世界模型**：原版和 0.5 都是 VLA，1.0 目前只有模型卡（Qwen3.5 底座的 VLA）。同公司的世界模型是 WALL-SS，两条线只有引用关系。
- **WALL-SS**：观测与动作交错、按尺度由粗到细生成、远处历史按尺度压缩；评估数字能复算，但代码和超参都没公开。
- **CraftNet 没有论文**：公告原话 CraftNet = System 0 + System 1，System 2 是外接开源 VLM。WM-Craftnet 和 FTP-1 是 Sharpa 相关的正式论文，但都没提 System 0/1/2。
- **几篇摘要的百分比都是百分点**（Wall-OSS-0.5 的 17.5、FTP-1 的 17.2 和 31），读数字时注意。
- **∇Mimic** 回答“仿真器可微时还要不要世界模型”：直接穿过打了补丁的 MuJoCo Warp 求梯度；效率倍数要看 GPU 和口径。

## 可微物理两篇（Siwei Chen 等，2026-11-21）读后要点

- 两篇都是 ICLR 2023，都用 JAX：DiffMimic 用 Brax 刚体仿真，DaXBench 自己写了 MPM（水、绳）和质点-弹簧（布料）。都不是有限元，也不是高斯。
- **DiffMimic**：动作模仿变成状态匹配，梯度穿过整段可微仿真；Demonstration Replay 在偏离超过阈值时换回参考状态，代码里这一步同时截断了梯度。发布代码是附录 H 的随机起点变体，配置和论文正文不同。
- **DaXBench**：基准的价值在统一的可微环境；数字要小心：表 4 和学习曲线终点对不上，可微 RL 的优势只在少数任务上成立；发布的 SHAC 和 SHAC 原文不一样。
- 和 SHAC、SuperMimic 连起来看：DiffMimic 是“整段 BPTT + 截断重置”，SHAC 是“短窗口 + 评论家”，SuperMimic 是“不要可微仿真器，学世界模型再做短窗口 BPTT”。

## 人形行走三篇（2026-11-20）读后要点

- 三篇都来自 Amazon FAR，都基于 holosoma，代码都是 Apache-2.0，是目前“能自己从头训”的人形行走工作里最完整的一组。
- **15 分钟（FastSAC）**：门槛最低，一张消费级卡就能复现行走；但论文和代码有多处出入（目标 Q、演员更新频率、优化器、更新次数），FastTD3 的实现不在 holosoma 里。
- **RPL**：分地形专家 + 多路深度蒸馏；“5×”渲染加速要看相机数；混合 DAgger+RL 的第 4.5 节用发布的代码复现不了；训练后端仍是 IsaacGym。
- **PHP**：motion matching 生成参考轨迹是关键；论文的环境数、高度扫描范围、学生迭代数都和代码默认不同，复现时以作者在 issue 里的说明为准。
- 三篇的训练时间都不能直接和 SuperMimic 的 GPU 小时相比：任务、硬件和成功判据都不一样。

## Mundo 读后要点

- 分工清楚：代理和代码管“发生了什么”，视频扩散管“看起来像什么”，所以能改一个数重算，也能输出接触力和轨迹。
- 所有能力都只有演示，没有新视角指标、对比实验或机器人策略结果。
- 页面公开的数据自洽：弹跳高度比等于 e²，苹果时间线和伪代码一致，初始框到最终代理体现了博客说的漏检和标签修正。
- 物理目前局限在刚体框加脚本；布料那段是录像；物理参数的来源只有一句话。
- 渲染慢：8 张 A800 约 1.5 帧/秒；底座是 33B 的 MiniMax-H3 Ref2VA。

## RGBench 读后要点

- 这是评测布料模拟器的基准，不是评测策略的基准：grasp、fling、fold 都是回放录下的轨迹。
- 表 4、表 5 和公开 CSV 逐格一致，可以放心引用；附录 C 的文字不可信（fold 一段把 CDs2r 均值当成了 CDr2s 基线）。
- “快 3 倍”是对 Isaac Sim 在最有利于它的 40k 顶点处的倍数，论文没给硬件。
- 表 1 只有“本文”一列是新跑的，两个基线照抄 BCM；动态任务的优势在一个标准差内。
- GarmentDynamics 闭源，“本文”一列无法复现；公开基线代码把测得的刚度原样填进参数。

## PhysTwin 读后要点

- 物体是弹簧-质点系统，按半径和最大近邻数连弹簧；外观是 3D 高斯，跟着质点做 LBS。
- 参数分两段辨识：先用 CMA-ES 调十几个全局参数（含阻尼），再穿过可微模拟器逐根调弹簧刚度。
- 代码的积分是半隐式欧拉，弹簧力和应变成正比，子步 667；这些细节 Real-to-Sim 评测原样继承。
- “未来预测”是同一段视频的后 30% 帧，不是新的交互。
- “实时”和数据效率都没有给出具体数字。

## Real-to-Sim 评测 读后要点

- 外观靠 3DGS 加 ICP 对齐和颜色对齐，动力学靠 PhysTwin 弹簧-质点孪生，抓取只靠摩擦和力阈值。
- 三个任务、四种策略、多个检查点：r = 0.944 / 0.901 / 0.915；IsaacLab 只有 0.237 / 0.649，玩具任务做不了。
- 图 3、9、10 能从矢量图精确读点：r 全部对上；MMRV 只有把 SIMPLER 官方函数的仿真、真机参数对调才对上，按 SIMPLER 原定义 IsaacLab 绳子一格是 0.480，不是“低”。
- 每个检查点只有 16–27 次试验，单点误差约 ±0.2，结论靠的是整体相关性。
- 代码开源（MIT），但颜色对齐、LBS、抓取判据的细节和论文文字不完全一样。

## MaskedMimic 读后要点

- 遮挡要跨帧保持；不保持时坐椅子成功率掉到 0%。
- 残差先验让先验均值在 KL 项里抵消，先验均值只能从动作损失学。
- “A2C”是原文说法，公开代码默认是 PPO。
- 和 PULSE 的对比很可能不是同一测试集：成功率都是 k/1776，不是 k/138。
- 公开的 V1 代码没有加上 KL 项，两天后的提交修好了。

## PhysicsVAE 读后要点

- SuperMimic 说的“一步一致性项”就是式 (1) 的 α 项：梯度穿过一个用专家数据预训后冻结的仿真层，只展开一步。
- PhysicsVAE 也有世界模型，但离线学、冻结、不参与下游训练，这是它和 ControlVAE、SuperMimic 的区别。
- α 在表 1、图 9、代码三处不一致；复现从 1e-3 起。
- “倒地前坚持时间约长三倍”，按图 9 读只有 1.5–2.4 倍。
- 帮手分支把每个关节的改动限在 σ 弧度以内，σ 决定自然和适应之间的取舍。

## NPMP 读后要点

- 三段串行：SVG(0)+Retrace 训专家 → 离线监督压缩 → SVG(0)+Retrace 训高层；SuperMimic 表 1 概括准确。
- 压缩有损：最好配置的中位相对表现训练 0.739、测试 0.707。
- LFPC 只用 1 条轨迹加雅可比，单技能上接近几百条 BC。
- AR(1) 先验和适中的 β 都重要；β 过大过小都变差。
- 复用时 β = 0.46 最好、0.001 最差，正则不是越强越好。

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

- 摘要说“几万段”，实际是 AMASS 的 11313 段，引言自己写“一万段”；SuperMimic 照抄了摘要。
- 配方几乎就是 SuperTrack 的：窗口 8 和 32、约 15 万样本的缓存、损失权重的调法都相同；新增的是速度积分、CSET、困难样本挖掘和 1024 个并行环境。
- 没有评论家，也没有 PPO；“结合监督学习和强化学习”指在 RL 式环境里采数据、用可导损失训策略。
- 样本效率的证据是图 4：到 90% 成功率至少差 3 倍，而且是下界。
- 表 1 的测试列混了 140 段和 138 段两个测试集；几张消融图之间也有对不上的地方。

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
papers/{shac,dreamer,supertrack,rwm,deepmimic,rwm-u,dreamerv3,td-mpc,daydreamer,controlvae,sonic,phc,moconvq,superdyno,beyondmimic,pulse,latent,npmp,physicsvae,maskedmimic}.html  SuperMimic 引用论文的精读（图表数据和开放许可论文的原图在同名目录）
interactives/{shac,dreamer,supertrack,rwm,deepmimic,rwm-u,dreamerv3,td-mpc,daydreamer,controlvae,sonic,phc,moconvq,superdyno,beyondmimic,pulse,latent,npmp,physicsvae,maskedmimic}/  对应的 3D 框架动画
interactives/supermimic/     SuperMimic 的 11 幕 3D 框架动画（精读页内嵌）
papers/3dws.html   3D World Simulator 精读
papers/3dws/       3D World Simulator 的原文插图，按 CC BY 4.0 使用，只做了裁切
interactives/3dws/ 3D World Simulator 的 3D 可交互架构图 index.html 和自编码器 9 幕分步动画 ae.html（都在精读页内嵌）
assets/lab3d.js    3D 交互图共用的 three.js 工具
papers/simpler.html SIMPLER 精读
papers/simpler/     SIMPLER 的原文插图，按 CC BY 4.0 使用，只做了裁切
papers/real2sim-eval.html  Real-to-Sim 评测精读（裁切原图在 papers/real2sim-eval/，11 幕动画在 interactives/real2sim-eval/）
papers/phystwin.html       PhysTwin 精读（无原图；11 幕动画在 interactives/phystwin/）
papers/six-policies.html   六个操作策略对照（概念专题；交互在 papers/six-policies/widgets.js，数据在页内 #six-data）
papers/fabricbench.html    FabricBench 精读（原图 1–6 和 widgets.js 在 papers/fabricbench/；没有 3D 动画）
papers/real2worlds2real.html  Real2Worlds2Real 精读（原图 1–5 和重画图 widgets.js 在 papers/real2worlds2real/；没有 3D 动画）
papers/rgbench.html        RGBench 精读（无原图，重画图在 papers/rgbench/；11 幕动画在 interactives/rgbench/）
papers/mundo.html          Mundo 精读（无论文、无原图；11 幕动画在 interactives/mundo/）
papers/gr00t2.html         gr00t2 精读（原图在 papers/gr00t2/，11 幕动画在 interactives/gr00t2/）
papers/wevisone-vl.html    wevisone-vl 精读（原图在 papers/wevisone-vl/，11 幕动画在 interactives/wevisone-vl/）
papers/nablamimic.html     ∇Mimic 精读（无 PDF 原图，仓库图和重画图在 papers/nablamimic/；11 幕动画在 interactives/nablamimic/）
papers/vla-design-space.html 概念专题：VLA 设计空间（交互脚本在 papers/vla-design-space/widgets.js）
papers/rl-families.html    概念专题：强化学习算法谱系（交互脚本在 papers/rl-families/widgets.js）
papers/wall-oss.html       WALL-OSS 精读（原图在 papers/wall-oss/，11 幕动画在 interactives/wall-oss/；#audit 为公平性审视）
papers/wall-oss-05.html    Wall-OSS-0.5 精读（原图在 papers/wall-oss-05/，11 幕动画在 interactives/wall-oss-05/）
papers/wall-ss.html        WALL-SS 精读（无 PDF 原图，仓库图和重画图在 papers/wall-ss/；11 幕动画在 interactives/wall-ss/）
papers/craftnet.html       CraftNet 精读（无论文、无原图；10 幕动画在 interactives/craftnet/）
papers/wm-craftnet.html    WM-Craftnet 精读（原图在 papers/wm-craftnet/，11 幕动画在 interactives/wm-craftnet/）
papers/ftp1.html           FTP-1 精读（原图在 papers/ftp1/，11 幕动画在 interactives/ftp1/）
papers/diffmimic.html      DiffMimic 精读（无原图，重画图在 papers/diffmimic/；11 幕动画在 interactives/diffmimic/）
papers/daxbench.html       DaXBench 精读（原图在 papers/daxbench/，11 幕动画在 interactives/daxbench/）
papers/holosoma-15min.html 15 分钟人形行走精读（原图在 papers/holosoma-15min/，11 幕动画在 interactives/holosoma-15min/）
papers/rpl.html            RPL 精读（原图和重画图在 papers/rpl/；10 幕动画在 interactives/rpl/）
papers/php-parkour.html    PHP 跑酷精读（原图在 papers/php-parkour/，11 幕动画在 interactives/php-parkour/）
papers/lingbot-touch.html  lingbot-touch 精读（原图在 papers/lingbot-touch/，11 幕动画在 interactives/lingbot-touch/）
papers/cosmos.html         cosmos 精读（原图在 papers/cosmos/，11 幕动画在 interactives/cosmos/）
papers/cosmos-transfer1.htmlcosmos-transfer1 精读（原图在 papers/cosmos-transfer1/，11 幕动画在 interactives/cosmos-transfer1/）
papers/cosmos-reason1.html cosmos-reason1 精读（原图在 papers/cosmos-reason1/，11 幕动画在 interactives/cosmos-reason1/）
papers/cosmos-predict25.htmlcosmos-predict25 精读（原图在 papers/cosmos-predict25/，11 幕动画在 interactives/cosmos-predict25/）
papers/cosmos-policy.html  cosmos-policy 精读（原图在 papers/cosmos-policy/，11 幕动画在 interactives/cosmos-policy/）
papers/cosmos3.html        cosmos3 精读（原图在 papers/cosmos3/，11 幕动画在 interactives/cosmos3/）
papers/cosmos-interactive.htmlcosmos-interactive 精读（原图在 papers/cosmos-interactive/，11 幕动画在 interactives/cosmos-interactive/）
papers/gr00t.html          gr00t 精读（原图在 papers/gr00t/，11 幕动画在 interactives/gr00t/）
papers/dinov3.html         DINOv3 精读（原图在 papers/dinov3/，11 幕动画在 interactives/dinov3/）
papers/rae.html            RAE 精读（原图在 papers/rae/，11 幕动画在 interactives/rae/）
papers/vjepa21.html        V-JEPA 2.1 精读（原图在 papers/vjepa21/，11 幕动画在 interactives/vjepa21/）
papers/wan.html            Wan 精读（原图在 papers/wan/，11 幕动画在 interactives/wan/）
papers/svae.html           S-VAE 精读（原图在 papers/svae/，11 幕动画在 interactives/svae/）
papers/libero.html         LIBERO 精读（裁切原图在 papers/libero/，11 幕动画在 interactives/libero/）
papers/openwam.html        OpenWAM 精读（裁切原图在 papers/openwam/，11 幕动画在 interactives/openwam/）
papers/molmoact2.html      MolmoAct2 精读（无原图；11 幕动画在 interactives/molmoact2/）
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
