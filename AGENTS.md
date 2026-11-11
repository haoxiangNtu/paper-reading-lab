# Paper Reading Lab：接手说明（给 Codex / 其他代理）

最后更新：2026-11-11（含 real2sim-eval、phystwin、rgbench、mundo）。写给接手维护这个仓库的代理。先读完这一页再动手。

## 1. 这是什么

用户（GitHub `haoxiangNtu`）的论文精读站：每读一篇论文，就做一个**中文逐节精读页**，再配一个**分步 3D 框架动画**。纯静态网页，没有构建步骤，GitHub Pages 从 `main` 分支根目录发布。

- 线上：https://haoxiangntu.github.io/paper-reading-lab/
- 仓库：https://github.com/haoxiangNtu/paper-reading-lab （公开）
- 姊妹站：World Model Lab、LLM Inference Lab（同一套样式和写法）

用户把这些页面当作查阅用的学习记录，不只是读物。他会对照原文看，所以页面里的数字必须对得上。

## 2. 目录结构

```
index.html                 首页：每篇一张卡片（新的在前）+ 架构专题 + 外站链接
README.md                  论文总表（每篇一行）+ 每篇“读后要点” + 文件说明
AGENTS.md                  本文件
assets/site.css            全站样式和颜色变量（深色优先，880px 正文列，figure.pfig 等）
assets/lab3d.js            所有 3D 动画共用的 three.js 工具（相机、标签、线、方块）
assets/grasp-lab.css/js    抓取类架构专题页用的样式和交互
papers/<slug>.html         精读页，引用 ../assets/site.css，页面专用的表格宽度写在页内 <style>
papers/<slug>/             该页的裁切原图（.webp）或重画图表的 charts.js
interactives/<slug>/       该篇的 3D 动画：index.html + <slug>.js（多数复用 ../3dws/style.css）
interactives/3dws/         最早的 3D 架构图和自编码器动画；style.css 被其他动画共用，别改坏
interactives/graspgen/     GraspGen 动画（index.html）+ 网络结构拆解（arch.html）+ Hilbert 曲线说明（hilbert.html）
```

### 已有的论文页

| 类别 | slug |
|---|---|
| 最早几篇 | `gauge` `simpler` `3dws` |
| 仿真评测与世界模型 | `real2sim-eval`（Real-to-Sim + 3DGS + PhysTwin，和 `simpler` 对照）`phystwin` `rgbench`（布料模拟器基准）`mundo`（无论文，只读项目页和博客） |
| SuperMimic 及其引用论文 | `supermimic`，以及它相关工作和表 1 引到的全部论文：`shac` `dreamer` `supertrack` `rwm` `deepmimic` `rwm-u` `dreamerv3` `td-mpc` `daydreamer` `controlvae` `sonic` `phc` `moconvq` `superdyno` `beyondmimic` `pulse` `latent` `npmp` `physicsvae` `maskedmimic` |
| 抓取 / 位姿架构专题 | `graspgen`（已升级为逐节精读）`foundationpose` `wapr` `tro-grasp` `tro-grasp-plus-plus`。这批大多由用户的另一个账号推送 |

## 3. Git 规则（重要）

- **两个账号都会推送**：`haoxiangNtu` 和 `LiHaoxiang-rbs`。推送前必须先 `git fetch`，再 `git rebase origin/main`；遇到冲突时两边的内容都保留，尤其是 README 和 index。
- 提交身份用仓库本地配置（已设好，是 `haoxiangNtu`）。不要改成全局身份。
- 提交信息用中文，一行概括，下面列要点。
- **只在用户要求或明确同意时推送。** 以往的做法是：每批论文做完、核对完，推送一次。
- 永远不提交 PDF、模型权重、下载的代码仓库。这些只放在仓库外的临时目录。
- 有后台任务还在改工作区时，不要 rebase（rebase 需要干净的工作区）。可以先 `git fetch`，确认远端没有新提交再直接推。

## 4. 许可规则（最重要的一条）

动手前先看论文在 arXiv 摘要页上登记的许可，同时看 PDF 页脚有没有和它矛盾的版权声明。

| 许可 | 原图怎么处理 | 文字怎么写 |
|---|---|---|
| CC BY / CC BY-SA / CC BY-NC-SA | 从 PDF 裁切原图（只裁切、缩放，转 webp，约 1600 px 宽），放进 `papers/<slug>/`。每张图注写：作者、许可、“只做了裁切”、“看原图 ↗”链接 | 带 SA 的许可要在页面上声明：本页文字和裁切图按同一许可提供 |
| arXiv 非独占分发（nonexclusive-distrib）、ACM / 出版商版权、没有标明许可 | **不放任何原图，本地也不存**。每张图用自己的话描述，“看原图”链接到 `arxiv.org/html/<id>#<锚点>` 或 PDF 的 `#page=N` | 不逐字翻译 |

**例外和已有决定：**
- **SuperMimic** 是非独占许可，但用户明确要求放原图，这只对这一篇有效。
- **SONIC、GraspGen** 的 arXiv 许可是 CC BY-SA，但 PDF 页脚写着 “NVIDIA. All rights reserved”。用户决定保留原图，页面上已写明这个矛盾。
- **MaskedMimic** 的 arXiv 许可是 CC BY-NC-SA，PDF 上有 ACM 版权声明，处理方式同上（读者注 1 里写明）。

**代码仓库：**
- 先看 LICENSE。没有 LICENSE，或者许可是非商业的（例如 NVIDIA License），页面只引文件名、行号、配置键，不复制代码。
- 读代码只读不跑，记下 commit 哈希和日期。

**禁止事项：**
- 项目网页 demo 如果有限制性许可（例如 SuperMimic 的 demo 禁止脚本访问和推导模型），绝不抓取。
- OpenReview、ACM 等对脚本返回 403 时**不要绕过**。去找作者单位公开的副本，或者请用户提供 PDF。
  - PhysicsVAE 用的是 Meta Research 公开的 PDF。
  - SuperDyno 用的是用户提供的 PDF。

## 5. 精读页的写法

照着现有页面写，不要另起风格。参考模板：

| 情况 | 参考页面 |
|---|---|
| 开放许可、放原图、有官方代码对照 | `papers/phc.html` |
| 版权保留、只用文字描述图 | `papers/dreamer.html` |
| 有许可矛盾、代码有多个版本 | `papers/sonic.html` |
| 和另一篇逐项对照 | `papers/beyondmimic.html`（含和 SuperMimic 附录 A 的对照表） |

**页面结构：**
- 页头：eyebrow（arXiv 号 · 分类 · 版本日期 · 会议 · 中文精读）、h1 中文标题、`.orig` 原文标题、作者、`.meta` 链接组。
- 接着是“关于这份精读”框，说明许可和图的处理方式，再写代码读的是哪个版本。
- 正文按原文章节顺序逐节写，小节编号和原文一致，附录也要覆盖。
- 公式用 MathJax 3（cdnjs），按原文编号排。主要结果表照录数字。
- 引用论文的页面要有一节“和 SuperMimic 的关系”。

**读者注（核心价值）：**
- 写成 `<div class="note" id="nN"><span class="lab">读者注 N · 标题</span>…</div>`，和论文内容分开。
- 内容是我们自己核算的结果：表和表之间、正文和表之间、论文和代码之间是否一致。每条都要写出算式或出处。
- 不确定的标“未核实”或“我的推断”，绝不编。
- 页尾有读者注汇总（`#notes`）和链接表（`#links`）。

**其他要求：**
- **数据集和 benchmark 名称**第一次出现时写成蓝色链接 `<a class="ds">`，指向官方主页（论文链接放旁边）。发布前确认链接能打开（返回 200）。
- **矢量图可以精确读数**：`pdftocairo -svg` 导出那一页，解析 path 并按刻度标定，重画的图标“重画”。注意：绘图工具会丢掉共线的点，曲线上的空缺可能代表重复值。
- **语气**：平实中文，短句，不夸张，不用营销腔。
- **页尾 footer** 写：“精读是我读 arXiv xxxx 后的整理，不是作者的官方内容”，并注明原文作者和许可。

**新增一篇论文时要同步改四处：**
1. `index.html` 加一张卡片，放在最前面。
2. `README.md` 总表加一行，再加一节“读后要点”。
3. README 里的文件说明行。
4. 如果是 SuperMimic 的引用论文，把 `papers/supermimic.html` 表 1 或相关工作里的名字链到新页面。

## 6. 3D 动画的写法

参考 `interactives/phc/` 或 `interactives/latent/`。每个动画是一个 `index.html` 加一个 `<slug>.js`，依赖 three.js r128（cdnjs）和 `../../assets/lab3d.js`。

**写法约定：**
- `SCENES` 数组里每幕一个对象：`{n, part, title, sub, dur, cam: [theta, phi, dist, [tx,ty,tz]]}`。每幕的 `update(p)` 必须是时间轴 p 的纯函数，播放、暂停、拖动、循环都走同一条路径。
- 支持的 URL 参数：
  - `?scene=N&p=0.8`：冻结在某一帧，截图用。
  - `?embed=1`：隐藏外框，给精读页的 iframe 用。iframe 写法见 `.i3d` 样式。
- 相机补间按 `performance.now()` 计时，不按帧数，否则无头浏览器截图会截到动到一半的画面。
- **标签字号**：每个动画的 `lab()` 里都要有 `LSZ` 这一行，直接从 `interactives/latent/latent.js` 拷过来。规则是字号 = max(s, 0.5s + 17.5)，舞台高度不到 680 px 时再放大，最多 1.2 倍。用户嫌过标签太小，改过一轮（提交 1fccdd5）。
- 论文没给、是我们推断的部分，用橙色“示意”框标出；玩具数据标“玩具”。
- 没有 WebGL 时，步骤列表和形状表也要能读。
- 有官方代码就先读代码再画。论文和代码不一致时，两个都写出来，并说明画的是哪一个。

## 7. 检查方法

在本机用无头 Chrome 检查（没有 GPU，要用 swiftshader）：

```bash
google-chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=1320,1300 --virtual-time-budget=9000 \
  --screenshot=out.png "file://$PWD/interactives/<slug>/index.html?scene=3&p=0.8"
# 控制台：加 --enable-logging=stderr --v=0；或用 --dump-dom 检查渲染结果
node --check interactives/<slug>/<slug>.js
```

**注意事项：**
- 截图窗口用 1320×1300 左右。窗口太矮会截掉舞台，导致误判。
- 带 `#片段` 的 URL 截图会是空白：截全页再裁剪。
- 无头 Chrome 宽度到不了 485 px 以下，所以 390 px 下的“手机溢出”是假象。真要查，用 `getBoundingClientRect` 测。
- 全页截图高到几万像素时，嵌入的 iframe 会报 WebGL 错误。这是渲染器的限制，不是页面的 bug。
- 表格太宽时放进 `.tablewrap` 横向滚动，不要撑破 880 px 正文列。

## 8. 工作流程（以往证明有效的）

1. **批量精读**：一篇论文交给一个子代理，所有子代理用同一份说明（说明内容就是本文第 4 到 7 节）。子代理只写自己负责的文件，不改首页和 README，也不提交。
2. **协调者统一核对**：
   - 表格数字逐个对照 PDF 原文（`pdftotext -layout`）。
   - 抽查算术。
   - 看截图汇总。
   - 复查许可。
   
   全部通过后，再改首页和 README，一批推送一次。
3. **跨页面的结论要人工复核**：一个页面对另一个页面下的结论，先回原文核对再改那一页。以往两次复核都有收获：
   - SONIC 页的核对推翻了 SuperMimic 读者注 14 的原有说法。
   - BeyondMimic 页指出的 SONIC 页“单动作跟踪器”一句，复核后发现是 SONIC 原文自己的说法，所以没有删，只补了澄清。
4. **结论要先算再说**：曾经凭直觉说“Hilbert 局部性明显更好”，实际算出来只是小幅领先，薄壁形状上还打平。凡是比较类的结论，都先跑数字。

## 9. 当前状态和遗留事项

**已完成：** SuperMimic 相关工作和表 1 引用的全部论文都有逐节精读和动画。最后几个提交：

| 提交 | 内容 |
|---|---|
| `7a04878` | Hilbert 曲线交互说明 |
| `3578b6a` | GraspGen 网络结构拆解 |
| `1fccdd5` | 标签放大 |
| `0fbc9a9` | SuperDyno 全文精读 |

**遗留的小问题（可选）：**
- 少数动画仍有轻微的标签相碰：PhysicsVAE 第 5、6、9 幕的层宽数字，DeepMimic 第 11 幕，DayDreamer 第 10 幕。嵌入模式（舞台高约 520 px）下，个别标签只有 10 到 12 px。
- GraspGen 结构拆解页在嵌入模式下，右侧说明面板的字约 9 px，偏小。
- 未核实的信息，页面上已经标注：
  - LATENT 的会议“IROS 2026”只出现在 SuperMimic 的参考文献里。
  - NPMP 没有和 OpenReview 定稿对照（脚本访问返回 403）。
  - SuperDyno 用户提供的 PDF 没能和 OpenReview 版逐字节比对。

**可能的下一步（等用户决定）：** 继续读这些页面各自引用的论文，例如 AMP、ASE、Diffuse-CLoC、GMT、Any2Track，流程同上。

## 10. 和用户沟通

- 用中文，简短。先说做了什么、核对了什么，再说待他决定的事。
- 改其他页面、撤原图、推送这类事，没有先例可循时先问用户。
- 自己说错的地方要主动更正，例如之前回复里算错的 Z-order 例子，以及高估了的 Hilbert 优势。
