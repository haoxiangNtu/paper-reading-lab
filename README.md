# Paper Reading Lab

论文阅读与理解的记录。每篇论文一页中文精读：按原文顺序逐节整理，公式照原文编号排版，主要结果表照录数字。开放许可的论文直接放原图，版权保留的论文用文字描述那张图，并链接到原文。读的时候核算出的问题单独标成“读者注”，和论文内容分开。

**站点：https://haoxiangntu.github.io/paper-reading-lab/**

## 已读论文

| 论文 | 精读页 | 主题 | 读者注 |
|---|---|---|---|
| Evaluating Real-World Robot Manipulation Policies in Simulation（[arXiv 2405.05941](https://arxiv.org/abs/2405.05941)，2024-05，CC BY 4.0） | [SIMPLER 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/simpler.html) | 用仿真代替真机评测机器人操作策略，含原文插图 | 15 条 |
| GAUGE: A Measurement-Grounded Benchmark for Physical Fidelity in Simulation Engines and Video World Models（[arXiv 2608.05948](https://arxiv.org/abs/2608.05948)，2026-08） | [GAUGE 精读](https://haoxiangntu.github.io/paper-reading-lab/papers/gauge.html) | 用真实测量评测物理引擎和视频世界模型的物理保真度 | 15 条 |

在其他站点里读过的：[VPP2 论文导读](https://haoxiangntu.github.io/world-model-lab/docs/vpp2.html)（[arXiv 2610.10270](https://arxiv.org/abs/2610.10270)），在 World Model Lab 里，另有 Wan2.1 架构、MoT 原理、后训练过程和评测数据集的拆解页。

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
- 图：论文以 CC BY 这类开放许可发布时，直接放原文插图并注明出处；版权保留的论文用文字描述那张图，注明页码，并链接到原文网页版里的同一张图。仓库不收录论文 PDF。
- 读者注记录核算或对照时发现的问题，不属于论文内容，页尾有汇总。
- 文中提到的基准、数据集、引擎和模型做成蓝色链接，指向主页；页尾链接表同时给主页和论文，发布前逐个核对能打开。

## 目录

```
index.html          论文列表与写法约定
papers/simpler.html SIMPLER 精读
papers/simpler/     SIMPLER 的原文插图，按 CC BY 4.0 使用，只做了裁切
papers/gauge.html   GAUGE 精读
assets/site.css     共用样式，沿用 World Model Lab 的配色
```

本地打开 `index.html` 即可，不需要构建；公式用 MathJax，从 cdnjs 加载。新加一篇论文：仿照 `papers/simpler.html` 或 `papers/gauge.html` 的页头和骨架写成 `papers/<简称>.html`，再在 `index.html` 和上面的表里各加一条。

原文版权归各自作者所有，这里只放阅读笔记。姊妹站：[World Model Lab](https://haoxiangntu.github.io/world-model-lab/)、[LLM Inference Lab](https://haoxiangntu.github.io/llm-inference-lab/)。
