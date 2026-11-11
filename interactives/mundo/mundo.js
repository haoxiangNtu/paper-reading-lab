'use strict';
/* Mundo: Customized World Model — taken apart into eleven animated scenes.
   There is no paper. Sources: the project page (mundo-world-model.github.io) and the Hugging Face blog
   (huggingface.co/blog/Luo-Yihang/mundo-world-model), both read on 2026-11-11. Code and weights are not released.
   Everything in the room is a hand-made toy: no data, image, video or geometry from the project page is used here.
   Scenes 2, 4, 6, 9 and 10 compute their numbers live (visibility, 2D IoU and box fitting, a 960 Hz rigid-body
   integrator, A*). The renderer, the VLM agent and the video model are not run; those parts are marked 示意.
   Each scene's update(p) is a pure function of the timeline p plus the current toggles. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const PI = Math.PI;
  const COL = { ctx: 0x38d1ff, geo: 0x7fb8ff, det: 0xf2c14e, agent: 0x9d8cff, prog: 0x4fc98a, sim: 0x4fc98a, proxy: 0xf0963c, diff: 0xd45fa0,
    warn: 0xff7a59, ok: 0x4fc98a, bad: 0xe05d5d, dim: 0x46506a, white: 0xeef2fa, robot: 0xc9d4ea, learned: 0x9d8cff, explicit: 0x4fc98a, look: 0x38d1ff, grey: 0x8e9bb8 };
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const PP = 'https://mundo-world-model.github.io/', BL = 'https://huggingface.co/blog/Luo-Yihang/mundo-world-model';
  const pp = (a, t) => `<a href="${PP}#${a}">项目页 ${t}</a>`, bl = (a, t) => `<a href="${BL}#${a}">博客 ${t}</a>`;

  /* ---------- toy hotel room (metres, y up). Every number here is mine. ---------- */
  const ROOM = { x0: -3, x1: 3, z0: -2, z1: 2, h: 2.6 };
  /* real: colour used for the "photo" renders; flat: category colour used for proxy frames (my choice) */
  const OBJ = [
    { id: 'bed', name: '床', c: [-1.6, 0.3, -0.9], s: [2.0, 0.6, 1.8], real: 0xe9e4da, flat: 0x9d8cff },
    { id: 'night', name: '床头柜', c: [-2.7, 0.28, -1.65], s: [0.5, 0.56, 0.45], real: 0x8a6a4a, flat: 0x4fc98a },
    { id: 'desk', name: '书桌桌面', c: [1.9, 0.74, -1.6], s: [1.4, 0.06, 0.7], real: 0x9a7650, flat: 0xf0963c },
    { id: 'chair', name: '椅子', c: [1.9, 0.45, -0.95], s: [0.5, 0.9, 0.5], real: 0x343b4a, flat: 0xf2c14e },
    { id: 'cab', name: '柜子', c: [2.4, 0.45, 1.5], s: [0.9, 0.9, 0.5], real: 0xc8b89a, flat: 0x38d1ff },
    { id: 'bag', name: '包', c: [2.4, 1.05, 1.5], s: [0.42, 0.3, 0.22], real: 0x7a3b2e, flat: 0xe05d5d },
    { id: 'arm', name: '扶手椅', c: [-2.3, 0.45, 1.3], s: [0.9, 0.9, 0.9], real: 0x5c6f8a, flat: 0xd45fa0 },
    { id: 'pic', name: '画', c: [-2.97, 1.6, 1.3], s: [0.04, 0.6, 0.9], real: 0xd9c4a0, flat: 0x7fb8ff },
    { id: 'tv', name: '电视', c: [0.4, 1.4, -1.97], s: [1.1, 0.65, 0.05], real: 0x15181f, flat: 0x6b7794 },
    { id: 'bin', name: '垃圾桶', c: [1.0, 0.2, -1.7], s: [0.3, 0.4, 0.3], real: 0x6b7794, flat: 0x8a6a4a }
  ];
  const OI = Object.fromEntries(OBJ.map((o, i) => [o.id, i]));
  const FLOOR = { real: 0x9a8a74, flat: 0x5a5a5a }, WALL = { real: 0xd8d2c4, flat: 0x8090a8 };

  const SCENES = [
    { n: 1, part: '总览', title: '照片 → 可编辑的 3D 代理 → 代码里的世界 → 视频', sub: '上排只做一次（建世界），下排每次运行都走一遍（模拟和渲染）', dur: 13, cam: [0.0, 0.72, 19.5, [-0.6, 0.2, 0.4]],
      html: dl([['输入', '一个地方的几张到几十张照片，或一段视频'], ['3D 代理', '每个物体一个 3D 框，加墙、地面、天花板'], ['场景程序', '代码里记录物体、位姿、质量摩擦等属性和更新规则'], ['模拟器', '多数情况下用 MuJoCo'], ['渲染', '代理按类别纯色渲染成 proxy 帧，再由视频扩散模型以照片为参照画成真实视频']]) +
        '<p>Mundo 的思路是把“世界状态”从视频模型里拿出来，放进一份显式的、可以读写的代码。物理由模拟器算，视频模型只负责把算好的结果画得像那个地方。</p>' +
        '<p>点画面里的方块可以跳到对应那一幕。</p>' + guess('方块的排法是我按博客“How Mundo works”的顺序画的；论文没有，项目页的流程图只有五格。') + src(`${pp('details', 'Technical details')} · ${bl('how-mundo-works', 'How Mundo works')}`) },
    { n: 2, part: '1.1–1.3 上下文图像', title: '照片越多，需要“编”的地方越少', sub: '切换 1、3、9 张上下文图像：表面上的点按“至少被一张照片看到”上色，当场算', dur: 13, cam: [0.62, 0.9, 13, [0, 0.6, 0]],
      html: dl([['真实场景', '1 到 12 张上下文图像'], ['生成图或画', '只有 1 张'], ['大场景', '几十张，按分块挑选（第 8 幕）'], ['§1.3 的对比', '同一条相机路径，用 1、3、9 张视图']]) +
        '<p>项目页 §1.3 用 1、3、9 张视图渲染同一条路径，说明上下文越多，模型要推断的区域越少，但没被任何视图拍到的地方仍然是推断出来的。</p>' +
        '<p>这里在一个玩具房间里做同样的事：在所有表面上撒点，每个点检查是否落在某个相机的视锥里、朝向相机、且中间没有别的物体挡着。青色是被看到的，橙色是只能推断的。右上的小窗是当前相机“拍到”的样子。</p>' +
        toyb('房间、家具、9 个相机的位置都是我设的；可见性用视锥 + 光线和轴对齐盒求交，当场算。项目页没有给覆盖率数字。') + src(`${pp('real-places', '§1.1')} · ${pp('context-views', '§1.3')} · ${bl('what-the-world-supports', 'What the world supports')}`) },
    { n: 3, part: '博客 §1 几何 + 检测', title: '先恢复相机和稠密几何，再用 3D 检测器给每个主要物体一个初始框', sub: '点云 → Boxer 式初始框；橙色标签是初始框的典型问题', dur: 13, cam: [0.62, 0.92, 12.5, [0, 0.6, 0]],
      html: dl([['几何', '3D 基础模型恢复相机位姿和稠密几何（博客列 4RC、π³、VGGT、Depth Anything 3、STream3R）'], ['初始框', '3D 检测器 Boxer'], ['问题（博客）', '漏检、标签错、框的位置不够准；户外和密集场景还要先定义“一个框该包什么”']]) +
        '<p>博客没说具体用哪个几何模型，只说“一个 3D 基础模型可以恢复相机位姿和稠密几何”，后面列了五篇。检测器明确是 Boxer。</p>' +
        '<p>画面里的初始框故意带了几种错：床框太高、书桌框从地面一直包到桌面、椅子和包漏检、画被标成“镜子”、多了一个不存在的“衣架”。这些错误类型来自我对项目页公开数据的对照：首页酒店房间的 Boxer 初始框和最终代理之间正好有这几类差别（精读页读者注 5）。</p>' +
        guess('点云是从玩具房间表面采样再加噪声得到的，不是任何几何模型的输出；初始框是我手写的。') + src(`${bl('1-building-the-proxy-world', '§1')} · ${bl('why-an-agent', 'Why an agent')}`) },
    { n: 4, part: '博客 §1 分析-合成', title: 'VLM 智能体改代码、渲染、和照片比，循环到审阅者接受', sub: '第 1 轮 VLM 补漏改错；第 2 轮数值拟合框的位置、尺寸、朝向；第 3 轮审阅所有视图。IoU 当场算', dur: 16, cam: [0.62, 0.92, 12.5, [0, 0.6, 0]],
      html: dl([['编辑智能体', '在渲染引擎里改场景程序，从输入相机渲染代理，和原图比，决定下一步'], ['分工', 'VLM 判断缺了什么、标签对不对、门朝哪开；优化器把框的位置、尺寸、yaw 拟合到智能体在几张视图里标的边'], ['留一视图', '拟合结果要在没参与拟合的视图里也对得上才保留'], ['审阅智能体', '只看不改，检查所有输入视图'], ['停止', '审阅接受、几何不再改善、或到编辑/时间上限']]) +
        '<p>这一幕的数字都是当场算的：把每个框的 8 个角投到每个上下文相机里取 2D 外接框，和真值框的 2D 外接框算 IoU，再对能看到该物体的视图取平均。</p>' +
        '<p>第 2 轮的拟合是坐标下降：参数是中心、长宽高和 yaw，损失是“标出的边点”到框的 12 条棱的平方距离。右上两个小窗：上面是“输入照片”，下面是当前代理从同一相机渲染的样子，这正是分析-合成里被比较的两张图。</p>' +
        toyb('“智能体”的决定是我写死的；“边点”是在真值框的棱上采样再加 1 cm 噪声；接受阈值 IoU ≥ 0.8 是我设的。博客没有给任何 IoU 或轮数。') + src(`${bl('why-an-agent', 'Why an agent')} · AgentSTAR（arXiv 2609.24487）`) },
    { n: 5, part: '博客 §2 场景程序', title: '世界就是一段代码：物体、位姿、物理属性和规则', sub: '左下是可切换的伪代码；当前执行的行高亮，对应的物体在场景里发光', dur: 14, cam: [0.62, 0.92, 12.5, [0, 0.6, 0]],
      html: dl([['场景程序', '一个“代码世界模型”：显式记录物体、位姿、物理属性，并定义状态随时间更新的规则'], ['编辑', '加物体、改属性、移相机、把相机装到机器人上，都改同一段程序'], ['资产', '需要精细接触的物体可让智能体粗建模或用 TRELLIS 生成；新加的机器人从资产库取（博客举 R1）'], ['项目页的说明', '“为参考而简化，实际程序复杂得多”']]) +
        '<p>伪代码是我仿照项目页 Technical details 和 §2.1 的两段示例改写的，接口名沿用它们的写法（World、add、at、grasp、carry、place、simulate、render），时间和数值是我的。</p>' +
        '<p>切换到第二段程序，可以看到推一个物体、放一个球也是同样的写法。下面一行小字是此刻的世界状态 Sₜ 的一部分。</p>' +
        guess('接口是对项目页伪代码的改写，真正的程序没有公开；人形机器人是方块拼的。') + src(`${pp('pipeline', 'Technical details')} · ${pp('code-world', '§2.1')} · ${bl('2-a-world-that-runs-on-code', '§2')}`) },
    { n: 6, part: '博客 §2 模拟器', title: '模拟器算运动和碰撞：这一幕当场积分', sub: '960 Hz 显式积分；切换“推垃圾桶”和“三个球”，以及推力、摩擦', dur: 12, cam: [0.45, 1.08, 9.5, [0.4, 0.5, 1.2]],
      html: dl([['引擎', '多数模拟用 MuJoCo；也可以换其他引擎或自定义脚本'], ['参数', '智能体读场景，推出质量、摩擦、外力，写进场景程序'], ['输出', '轨迹、接触位置、碰撞力；交给视频模型去“画”'], ['示例频率', '项目页伪代码 simulate(engine="mujoco", hz=960)']]) +
        '<p>“推垃圾桶”：一个 1 kg 的桶受 0.4 s 恒力，地面库仑摩擦，碰到柜子时按恢复系数 0.3 反弹。切换推力和摩擦看它停在哪里、会不会撞柜子。</p>' +
        '<p>“三个球”：从 0.98 m 高放下三个球，恢复系数取项目页 §2.2 第一个例子标出的 0.9、0.76、0.24。每次弹起的高度比应该接近 e²，下方标签当场算出比值。项目页公开的轨迹数据也满足这个关系（精读页读者注 2）。</p>' +
        toyb('不是 MuJoCo：自己写的一维、无转动的积分器，dt = 1/960 s。桶和柜子的尺寸、质量、推力都是我设的。三个球的高度和恢复系数取自项目页 §2.2 的参数标注。') + src(`${bl('2-a-world-that-runs-on-code', '§2')} · ${pp('interaction-demo', '§2.2')}`) },
    { n: 7, part: '博客 §3 proxy 帧', title: '从所选相机渲染 proxy 帧：每类物体一种纯色', sub: '右上小窗是 proxy 帧；画面里的射线是相机的 Plücker 射线，下方标签当场算一条', dur: 12, cam: [0.62, 0.95, 12.5, [0, 0.6, 0]],
      html: dl([['proxy 帧', '模拟后的世界从目标相机渲染，物体按类别涂纯色'], ['作用', '把 3D 里算好的运动、碰撞的时刻和位置、视角，变成 2D 视频模型能跟随的帧'], ['坐标系', '上下文视图和目标轨迹都对齐到第一张上下文视图的相机坐标系'], ['相机编码', '每个 proxy 帧和上下文视图的相机参数变成 Plücker 射线，加到对应 latent 上']]) +
        '<p>Plücker 射线把像素对应的光线写成 6 维：方向 d 和矩 m = o × d（o 是相机中心）。同一条射线上任取两点得到的 (d, m) 相同，所以它只描述“哪条线”，适合当逐像素的相机编码。</p>' +
        '<p>博客说，用 proxy 视频做条件比只用相机编码的相机控制更准、对场景更忠实，但没给数字。</p>' +
        '<p>本页的类别配色：' + OBJ.concat([{ name: '地面', flat: FLOOR.flat }, { name: '墙', flat: WALL.flat }]).map(o => `<span style="display:inline-block;width:.8em;height:.8em;border-radius:2px;vertical-align:-.05em;background:${css(o.flat)}"></span> ${o.name}`).join('　') + '</p>' +
        guess('类别配色是我选的；Mundo 实际用什么颜色、是否带深度或实例编号都没有公开。') + src(`${bl('3-proxy-frames-and-the-renderer', '§3')} · ${bl('why-a-proxy-video', 'Why a proxy video')}`) },
    { n: 8, part: '博客 §3 渲染器', title: '视频扩散模型以上下文视图为参照，把 proxy 帧画成真实画面', sub: '切换“条件怎么进去”和“长视频分块”；分块的账当场算', dur: 14, cam: [0.0, 0.78, 15, [0.4, 0.3, 0.2]],
      html: dl([['底座', '微调 MiniMax-H3 的 Ref2VA'], ['编码', 'proxy 视频和上下文视图都过视频 VAE，latent 接在目标视频 latent 序列后面'], ['相机', 'Plücker 相机编码在第一个 Transformer 块之前加到 latent 上；没有相机的参考图（如新加的机器人）用一个学到的编码'], ['分块', '每块 N = 124 帧，上一块最后 M = 34 帧重新编码作固定前缀'], ['大场景', '每块单独挑上下文视图'], ['速度', '8 张 A800、20 步推理约 1.5 帧/秒']]) +
        '<p>博客把整条渲染写成两行：世界状态由代码世界推进 Sₜ₊₁ = f(Sₜ, aₜ)；视频 x₁:T 从 p_θ 采样，条件是 proxy 渲染 π(S₁:T, c₁:T)、K 张上下文视图和它们的相机 {(I_k, c_k)}、文本 y。</p>' +
        '<p>“长视频分块”：每块新增 124 − 34 = 90 帧，所以 F 帧需要 1 + ⌈(F − 124)/90⌉ 块。项目页 4D 那几段 124、304、484 帧正好是 1、3、5 块。</p>' +
        guess('Token 方块、去噪的颜色过渡和右上第二个小窗都是示意：小窗是普通光照渲染，不是扩散模型的输出。H3 的内部结构见它的仓库，这里没有画。') + src(`${bl('3-proxy-frames-and-the-renderer', '§3')} · ${bl('long-videos-in-chunks', 'Long videos in chunks')} · ${bl('4-training', '§4')} · ${bl('limitations', 'Limitations')}`) },
    { n: 9, part: '§2 编辑世界', title: '改代码里的一个数，世界跟着变', sub: '切换重力、质量、摩擦：包从柜子上被推下，轨迹当场重算', dur: 12, cam: [0.5, 1.02, 9.5, [0.9, 0.6, 1.2]],
      html: dl([['项目页 §2.2', '同一张图里的场景，换材料、换重力（月球 1.62 m/s²、失重）'], ['可改的东西', '质量、摩擦、外力、重力、相机'], ['渲染', '改完重新模拟，再按同样的上下文视图渲染']]) +
        '<p>包放在柜子顶上，0.3 s 时受 6 N 的推力，持续 0.3 s。三个开关各对应程序里的一行，改动的行在左下标黄。</p>' +
        '<p>几个可以自己算的现象：质量 5 kg、摩擦 0.2 时，静摩擦 μmg = 9.8 N 大于 6 N，根本推不动；月球上同样的推力推得更远、落得更慢；失重时没有正压力，也就没有摩擦，包会一直漂到墙边。</p>' +
        toyb('不是 MuJoCo：二维、无转动，落地完全非弹性；包离开柜边就开始自由落体，忽略翻转。数值是我设的，只有重力 1.62 m/s² 取自项目页的月球例子。') + src(`${pp('interaction-demo', '§2.2')} · ${bl('2-a-world-that-runs-on-code', '§2')}`) },
    { n: 10, part: '§3–4 机器人', title: '代理记录了“哪里有什么”：机器人用它规划，再在同一个世界里执行', sub: '占据栅格由代理框生成，A* 当场算；小窗是机器人头部相机的“渲染”和 proxy 帧', dur: 15, cam: [0.55, 1.05, 13, [0, 0.4, 0]],
      html: dl([['导航（§3.1）', '代理给出布局和语义，A* 之类的规划器找路；渲染第一人称和第三人称'], ['操作（§3.2）', '5 种机器人做 3 个任务；外部视角 + 头部/腕部相机；附带轨迹和交互状态'], ['§4', '一层酒店楼面：从大堂到房间的导航；洗衣房里探索和开洗衣机门'], ['System 2', '项目页说智能体借这个全局 3D 视图扮演“System 2”规划任务']]) +
        '<p>代理框里落地的物体按机器人半径 0.25 m 膨胀后标成障碍，0.1 m 的栅格上跑 8 邻接 A*。机器人先走到柜子前取包，再走到床边把包放到床上，和项目页 Technical details 的例子是同一个任务。</p>' +
        '<p>项目页说这些观测连同轨迹和交互状态可以用于 Real-to-Sim 的测试和训练，但没有展示任何策略的成功率或训练结果。</p>' +
        toyb('机器人是方块拼的，走路是沿路径匀速插值，抓取是直接把包挂到手上。头部相机小窗是普通光照渲染，不是视频模型的输出。') + src(`${pp('navigation', '§3.1')} · ${pp('manipulation', '§3.2')} · ${pp('robotics', '§4')}`) },
    { n: 11, part: '对照', title: '物理放在哪里、外观放在哪里：四条路线并排', sub: '切换高亮“物理”“外观”“可编辑”；颜色：绿色显式、紫色学到的', dur: 12, cam: [0.0, 1.32, 19, [0, 2.3, 0]],
      html: dl([['纯视频世界模型', 'Wan2.1 I2V、VPP2：物理和外观都隐含在扩散模型里'], ['Mundo', '物理在显式代理 + 代码 + MuJoCo；外观交给视频扩散'], ['Real2Sim-Eval', '外观是 3DGS，物理是从视频辨识的 PhysTwin 弹簧-质点；直接光栅化'], ['3D World Simulator', '粒子-体素潜变量 + 学到的 3D 动力学，解码成可渲染的高斯']]) +
        '<p>Mundo 把“会动的部分”交给显式模拟，所以可以改一个数重算，也能拿到接触力这类视频里看不到的量；代价是物理只有代理那么细（博客承认小物体会漂浮），外观仍然由扩散模型生成，可能和模拟出的状态不一致。</p>' +
        '<p>和 3DGS 路线比，Mundo 不需要密集扫描，几张照片甚至一张画就能起步；但渲染要跑一个大视频模型，慢得多（约 1.5 帧/秒对 5–30 FPS）。</p>' +
        guess('四列的方块划分是我的概括；各路线的细节见本站对应精读页。') + src('本站 real2sim-eval、3dws、gauge 精读页 · World Model Lab 的 Wan2.1 / VPP2 页') }
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

  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.6, phi: 0.95, dist: 13, maxDist: 80, minDist: 2 }); }
  catch (e) { $('nogl').hidden = false; }
  if (!S) { showInfo(0); return; }
  const root = new THREE.Group(); S.scene.add(root);
  let LABS = [], refDist = 13, PICKS = [], HELP = [];
  /* label font floor (same rule as interactives/latent): small sizes grow most; shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  function dynLab(G, pos, o = {}) {
    const st = { s: null, t: null };
    const f = t => { if (t === st.t) return; if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; st.s = lab(t, pos, o); st.s.visible = st.vis ?? true; G.add(st.s); };
    f.show = v => { st.vis = v; if (st.s) st.s.visible = v; };
    return f;
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.6, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  function pline(G, n, color, o = {}) {
    const pos = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: o.opacity ?? 1 })); l.frustumCulled = false; l.renderOrder = o.order ?? 3; G.add(l);
    l.userData.set = pts => { const k = Math.max(1, Math.min(n, pts.length)); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)]; pos[i * 3] = q[0]; pos[i * 3 + 1] = q[1]; pos[i * 3 + 2] = q[2]; } g.attributes.position.needsUpdate = true; };
    return l;
  }
  function segs(G, n, o = {}) {
    const pos = new Float32Array(n * 6), col = new Float32Array(n * 6), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: o.opacity ?? 0.9 })); l.frustumCulled = false; G.add(l);
    l.userData.set = (i, a, b, c) => { pos.set(a, i * 6); pos.set(b, i * 6 + 3); col.set(c, i * 6); col.set(c, i * 6 + 3); };
    l.userData.hideFrom = i => { for (let k = i; k < n; k++) { pos.fill(0, k * 6, k * 6 + 6); } };
    l.userData.done = () => { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; };
    return l;
  }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; if (!c) return; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  const BALL = new THREE.SphereGeometry(1, 14, 10);
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3();
  function stream(G, n, color, r = 0.07) {
    const im = new THREE.InstancedMesh(BALL, L.mat(color, { emissive: color }), n); im.frustumCulled = false; G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) { const q = along(pts, (phase + i / n) % 1); _P.set(q[0], q[1], q[2]); _Sv.setScalar(r * on); im.setMatrixAt(i, _M.compose(_P, _Q0, _Sv)); } im.instanceMatrix.needsUpdate = true; };
  }

  /* builds the room; returns { meshes: {id: mesh}, shell: [floor, walls], all: [...] } */
  function room(G, o = {}) {
    const R = { meshes: {}, shell: [], all: [] };
    const mk = (w, h, d, real, flat, pos, op) => { const m = L.box(w, h, d, real, { edges: false, opacity: op }); m.position.set(...pos); m.userData.flat = flat; m.userData.real = real; G.add(m); R.all.push(m); return m; };
    R.shell.push(mk(6, 0.04, 4, FLOOR.real, FLOOR.flat, [0, -0.02, 0], o.op));
    R.shell.push(mk(6, ROOM.h, 0.06, WALL.real, WALL.flat, [0, ROOM.h / 2, -2.03], o.op));
    R.shell.push(mk(0.06, ROOM.h, 4, WALL.real, WALL.flat, [-3.03, ROOM.h / 2, 0], o.op));
    OBJ.forEach(ob => { if (o.skip && o.skip.includes(ob.id)) return; const m = mk(ob.s[0], ob.s[1], ob.s[2], ob.real, ob.flat, ob.c, o.op); m.userData.id = ob.id; R.meshes[ob.id] = m; });
    if (!o.noLegs) { /* desk legs: visual only, not part of the proxy box (the "what should a box contain" question) */
      const d = OBJ[OI.desk]; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const m = mk(0.05, 0.71, 0.05, 0x5a4630, 0xf0963c, [d.c[0] + sx * 0.62, 0.355, d.c[2] + sz * 0.29], o.op); m.userData.leg = true; });
    }
    return R;
  }
  /* context cameras: inside the room, around 1.5 m high */
  const CAMS = [
    { p: [2.6, 1.5, 1.9], t: [-1.5, 0.6, -1.0] }, { p: [0.0, 1.6, 1.9], t: [-1.5, 0.5, -1.2] }, { p: [-1.0, 1.5, 1.8], t: [-2.2, 0.6, -0.5] },
    { p: [2.7, 1.5, 0.0], t: [0.0, 0.6, -1.6] }, { p: [0.5, 1.6, 0.3], t: [2.2, 0.6, -1.6] }, { p: [0.3, 1.5, -0.4], t: [2.4, 0.6, 1.5] },
    { p: [-0.2, 1.6, 0.6], t: [-2.6, 0.8, 1.3] }, { p: [1.2, 1.5, 1.6], t: [2.0, 0.5, -1.0] }, { p: [-1.8, 1.6, 0.9], t: [-1.0, 0.3, -1.5] }
  ];
  const VIEWSETS = [[0], [0, 3, 6], [0, 1, 2, 3, 4, 5, 6, 7, 8]];
  const CAMOBJ = CAMS.map(c => { const k = new THREE.PerspectiveCamera(60, 4 / 3, 0.05, 40); k.position.set(...c.p); k.lookAt(...c.t); k.updateMatrixWorld(true); return k; });
  function frustum(G, color, s = 0.35, o = {}) {
    const g = new THREE.Group(), h = s * Math.tan(PI / 6), w = h * 4 / 3, d = s;
    const c = [0, 0, 0], a = [-w, -h, -d], b = [w, -h, -d], e = [w, h, -d], f = [-w, h, -d];
    [[c, a], [c, b], [c, e], [c, f]].forEach(pq => wire(g, pq, color, { opacity: o.opacity ?? 0.9 })); wire(g, [a, b, e, f, a], color, { opacity: o.opacity ?? 0.9 });
    if (o.plane) { const pm = new THREE.Mesh(new THREE.PlaneGeometry(2 * w, 2 * h), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide })); pm.position.z = -d; g.add(pm); }
    G.add(g); return g;
  }
  function camFrusta(G, color, o = {}) { return CAMOBJ.map((k, i) => { const f = frustum(G, color, 0.35, o); f.position.copy(k.position); f.quaternion.copy(k.quaternion); HELP.push(f); return f; }); }

  /* ---------- geometry: ray vs axis-aligned boxes, visibility, projection, IoU ---------- */
  function rayHitsBox(o, d, tmax, c, s) {
    let t0 = 1e-4, t1 = tmax;
    for (let k = 0; k < 3; k++) {
      const lo = c[k] - s[k] / 2, hi = c[k] + s[k] / 2;
      if (Math.abs(d[k]) < 1e-12) { if (o[k] < lo || o[k] > hi) return false; continue; }
      let a = (lo - o[k]) / d[k], b = (hi - o[k]) / d[k]; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return false;
    }
    return true;
  }
  const _v = new THREE.Vector3();
  function seenBy(pt, n, ci, skip) {
    const k = CAMOBJ[ci], cp = CAMS[ci].p; const dx = cp[0] - pt[0], dy = cp[1] - pt[1], dz = cp[2] - pt[2]; const dist = Math.hypot(dx, dy, dz);
    if (n[0] * dx + n[1] * dy + n[2] * dz <= 0) return false;
    _v.set(pt[0], pt[1], pt[2]).project(k); if (_v.z > 1 || _v.z < -1 || Math.abs(_v.x) > 1 || Math.abs(_v.y) > 1) return false;
    const o = [pt[0] + n[0] * 0.01, pt[1] + n[1] * 0.01, pt[2] + n[2] * 0.01], d = [dx / dist, dy / dist, dz / dist];
    for (let i = 0; i < OBJ.length; i++) { if (i === skip) continue; if (rayHitsBox(o, d, dist, OBJ[i].c, OBJ[i].s)) return false; }
    return true;
  }
  /* surface samples: floor, two walls, and the faces of every object (outward normals) */
  const SURF = (() => {
    const P = [], r = L.rng(7);
    const add = (p, n, real, obj) => P.push({ p, n, real, obj });
    for (let x = -2.9; x < 3; x += 0.2) for (let z = -1.9; z < 2; z += 0.2) add([x, 0.001, z], [0, 1, 0], FLOOR.real, -1);
    for (let x = -2.9; x < 3; x += 0.25) for (let y = 0.1; y < ROOM.h; y += 0.25) add([x, y, -2.0], [0, 0, 1], WALL.real, -1);
    for (let z = -1.9; z < 2; z += 0.25) for (let y = 0.1; y < ROOM.h; y += 0.25) add([-3.0, y, z], [1, 0, 0], WALL.real, -1);
    OBJ.forEach((ob, oi) => {
      const [cx, cy, cz] = ob.c, [w, h, d] = ob.s, st = 0.12;
      const face = (ax, sg) => { const u = (ax + 1) % 3, v = (ax + 2) % 3, su = ob.s[u], sv = ob.s[v];
        const nu = Math.max(1, Math.round(su / st)), nv = Math.max(1, Math.round(sv / st));
        for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const p = [cx, cy, cz]; p[ax] += sg * ob.s[ax] / 2; p[u] += ((i + 0.5) / nu - 0.5) * su; p[v] += ((j + 0.5) / nv - 0.5) * sv; const n = [0, 0, 0]; n[ax] = sg; if (p[1] < 0.005 && sg < 0 && ax === 1) continue; add(p, n, ob.real, oi); } };
      for (let ax = 0; ax < 3; ax++) { face(ax, 1); face(ax, -1); }
      void w; void h; void d; void r;
    });
    return P;
  })();
  const VIS = SURF.map(s => CAMS.map((_, ci) => seenBy(s.p, s.n, ci, s.obj)));
  const coverage = set => { let k = 0; VIS.forEach(v => { if (set.some(ci => v[ci])) k++; }); return k / VIS.length; };
  function corners(b) { const [cx, cy, cz] = b.c, [w, h, d] = b.s, cy_ = Math.cos(b.yaw || 0), sy = Math.sin(b.yaw || 0), out = [];
    for (const a of [-1, 1]) for (const bb of [-1, 1]) for (const cc of [-1, 1]) { const lx = a * w / 2, ly = bb * h / 2, lz = cc * d / 2; out.push([cx + lx * cy_ + lz * sy, cy + ly, cz - lx * sy + lz * cy_]); } return out; }
  function bbox2(b, ci) { const k = CAMOBJ[ci]; let x0 = 9, y0 = 9, x1 = -9, y1 = -9, front = 0;
    for (const q of corners(b)) { _v.set(q[0], q[1], q[2]); const vz = _v.clone().applyMatrix4(k.matrixWorldInverse).z; if (vz < -0.05) front++; _v.project(k); x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y); }
    if (front < 8) return null; x0 = clamp(x0, -1, 1); x1 = clamp(x1, -1, 1); y0 = clamp(y0, -1, 1); y1 = clamp(y1, -1, 1); if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3) return null; return [x0, y0, x1, y1]; }
  function iou2(a, b) { if (!a || !b) return 0; const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])), iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1])), I = ix * iy, U = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - I; return U > 0 ? I / U : 0; }
  /* mean 2D IoU of a proxy box against the true box over the views that see the true box */
  function meanIoU(box, oi) { const tb = { c: OBJ[oi].c, s: OBJ[oi].s, yaw: 0 }; let s = 0, n = 0; for (let ci = 0; ci < CAMS.length; ci++) { const t = bbox2(tb, ci); if (!t) continue; n++; if (box) s += iou2(bbox2(box, ci), t); } return n ? s / n : 0; }

  /* ---------- initial "detector" boxes (hand-written errors) and the refinement ---------- */
  const T = id => ({ c: OBJ[OI[id]].c.slice(), s: OBJ[OI[id]].s.slice(), yaw: 0 });
  const INIT = {
    bed: { c: [-1.62, 0.45, -0.88], s: [2.0, 0.9, 1.8], yaw: 0.0, note: '太高' },
    night: { c: [-2.68, 0.29, -1.62], s: [0.52, 0.58, 0.46], yaw: 0.04 },
    desk: { c: [1.86, 0.385, -1.56], s: [1.36, 0.77, 0.74], yaw: 0.17, note: '从地面包到桌面？' },
    cab: { c: [2.33, 0.47, 1.44], s: [0.98, 0.94, 0.6], yaw: 0.14 },
    arm: { c: [-2.28, 0.45, 1.22], s: [0.9, 0.9, 1.12], yaw: 0.0 },
    pic: { c: [-2.96, 1.58, 1.32], s: [0.05, 0.64, 0.88], yaw: 0.0, label: '镜子', note: '标签错' },
    tv: { c: [0.41, 1.4, -1.96], s: [1.08, 0.66, 0.06], yaw: 0.0 },
    bin: { c: [1.0, 0.2, -1.7], s: [0.31, 0.41, 0.3], yaw: 0.0 },
    hanger: { c: [0.6, 1.9, 1.85], s: [0.45, 0.3, 0.25], yaw: 0.0, label: '衣架', note: '不存在' }
  };
  const MISSING = ['chair', 'bag'];
  /* point-to-box-edge distance (box with yaw about y) */
  function edgeDist(p, b) {
    const cy_ = Math.cos(b.yaw), sy = Math.sin(b.yaw), dx = p[0] - b.c[0], dy = p[1] - b.c[1], dz = p[2] - b.c[2];
    const q = [dx * cy_ - dz * sy, dy, dx * sy + dz * cy_], hh = [b.s[0] / 2, b.s[1] / 2, b.s[2] / 2]; let best = 1e9;
    for (let ax = 0; ax < 3; ax++) { const u = (ax + 1) % 3, v = (ax + 2) % 3, e = Math.max(Math.abs(q[ax]) - hh[ax], 0);
      for (const su of [-1, 1]) for (const sv of [-1, 1]) { const d2 = e * e + (q[u] - su * hh[u]) ** 2 + (q[v] - sv * hh[v]) ** 2; if (d2 < best) best = d2; } }
    return best;
  }
  function edgeMarks(id, seed) { const r = L.rng(seed), b = T(id), cs = corners(b), P = [];
    /* corners index: a(x) b(y) c(z) bits -> 4*a+2*b+c ; edges = pairs differing in one bit */
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) { const x = i ^ j; if (x !== 1 && x !== 2 && x !== 4) continue; for (let k = 1; k <= 5; k++) { const t = k / 6, p = [0, 1, 2].map(m => L.lerp(cs[i][m], cs[j][m], t) + (r() - 0.5) * 0.02); P.push(p); } }
    return P; }
  function fitBox(init, marks) { /* parameters: per-axis lower and upper faces in the box frame, plus yaw; coordinate descent with step halving */
    let x = [init.c[0] - init.s[0] / 2, init.c[0] + init.s[0] / 2, init.c[1] - init.s[1] / 2, init.c[1] + init.s[1] / 2, init.c[2] - init.s[2] / 2, init.c[2] + init.s[2] / 2, init.yaw];
    const step = [0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.06];
    const B = v => ({ c: [(v[0] + v[1]) / 2, (v[2] + v[3]) / 2, (v[4] + v[5]) / 2], s: [Math.max(0.02, v[1] - v[0]), Math.max(0.02, v[3] - v[2]), Math.max(0.02, v[5] - v[4])], yaw: v[6] });
    const loss = v => { const b = B(v); let s = 0; for (const p of marks) s += edgeDist(p, b); return s / marks.length; };
    let f = loss(x); const hist = [{ b: B(x), f }];
    for (let it = 0; it < 70; it++) {
      let imp = false;
      for (let k = 0; k < 7; k++) for (const sg of [1, -1]) { const y = x.slice(); y[k] += sg * step[k]; const fy = loss(y); if (fy < f - 1e-12) { x = y; f = fy; imp = true; } }
      if (!imp) for (let k = 0; k < 7; k++) step[k] *= 0.5;
      hist.push({ b: B(x), f });
    }
    return hist;
  }
  const FIT_IDS = ['desk', 'bed', 'cab', 'arm', 'pic'];
  const HELD = 4; /* the view kept out of fitting (view 5) */
  function stage(r) { /* r: 0 initial, 1 after VLM edits, 2 after fitting (frac f), returns {id: box} */
    const out = {};
    Object.entries(INIT).forEach(([id, b]) => { if (id === 'hanger' && r >= 1) return; out[id] = { c: b.c, s: b.s, yaw: b.yaw, label: r >= 1 ? null : b.label, note: r >= 1 ? null : b.note }; });
    if (r >= 1) { out.desk = { c: [1.86, 0.72, -1.56], s: [1.36, 0.14, 0.74], yaw: 0.17 }; out.chair = { c: [1.93, 0.46, -0.98], s: [0.54, 0.92, 0.55], yaw: 0.05 }; out.bag = { c: [2.42, 1.06, 1.49], s: [0.44, 0.31, 0.24], yaw: 0.0 }; }
    return out;
  }
  const FITS = Object.fromEntries(FIT_IDS.map((id, i) => [id, fitBox(stage(1)[id], edgeMarks(id, 11 + i))]));
  const IOU_INIT = {}, IOU_R1 = {}, IOU_FIT = {}, IOU_HELD = {};
  (() => { const s0 = stage(0), s1 = stage(1);
    OBJ.forEach((ob, oi) => { const id = ob.id; IOU_INIT[id] = meanIoU(s0[id] || null, oi); IOU_R1[id] = meanIoU(s1[id] || null, oi);
      const fb = FITS[id] ? FITS[id][FITS[id].length - 1].b : s1[id]; IOU_FIT[id] = meanIoU(fb, oi);
      const tb = { c: ob.c, s: ob.s, yaw: 0 }, t = bbox2(tb, HELD); IOU_HELD[id] = t ? [iou2(bbox2(s1[id] || { c: [0, -9, 0], s: [0.01, 0.01, 0.01] }, HELD), t), iou2(bbox2(fb, HELD), t)] : null; }); })();
  const avg = o => { const v = Object.values(o); return v.reduce((a, b) => a + b, 0) / v.length; };

  /* ---------- simple physics (scenes 6 and 9): explicit integration at 960 Hz ---------- */
  const HZ = 960;
  function simPush(F, mu) { /* bin of 1 kg on the floor, pushed +x for 0.4 s from t = 0.3 s, hits the cabinet face at x = 1.95 */
    const m = 1, g = 9.81, dt = 1 / HZ, half = 0.15, wall = 1.95 - half, e = 0.3; let x = 0.2, v = 0; const tr = [], hits = []; let tStop = null, vmax = 0;
    for (let i = 0; i <= 3.2 * HZ; i++) { const t = i * dt; if (i % 8 === 0) tr.push([t, x, v]);
      const f = t >= 0.3 && t < 0.7 ? F : 0, fr = mu * m * g;
      if (Math.abs(v) < 1e-6) { if (f > fr) v += (f - fr) / m * dt; else v = 0; }
      else { const a = (f - Math.sign(v) * fr) / m; const nv = v + a * dt; v = (Math.sign(nv) !== Math.sign(v) && f === 0) ? 0 : nv; }
      x += v * dt; vmax = Math.max(vmax, Math.abs(v));
      if (x > wall && v > 0) { hits.push([t, v]); x = wall; v = -e * v; }
      if (tStop == null && t > 0.7 && v === 0) tStop = t; }
    return { tr, hits, tStop, xEnd: x, vmax, T: 3.2 };
  }
  const BALLS = [{ name: '橡胶球', e: 0.9, m: 0.35, r: 0.11, col: 0xe05d5d }, { name: '篮球', e: 0.76, m: 0.6, r: 0.12, col: 0xf0963c }, { name: '保龄球', e: 0.24, m: 6.5, r: 0.109, col: 0x343b4a }];
  function simBalls() { const dt = 1 / HZ, g = 9.81; return BALLS.map(b => { let y = 0.98, v = 0; const tr = [], apex = [0.98]; let prevV = 0;
    for (let i = 0; i <= 4 * HZ; i++) { const t = i * dt; if (i % 8 === 0) tr.push([t, y]); v -= g * dt; y += v * dt; if (y < 0 && v < 0) { y = 0; v = -b.e * v; if (v < 0.05) v = 0; } if (prevV > 0 && v <= 0 && y > 0.002) apex.push(y); prevV = v; }
    return { tr, apex }; }); }
  function simBag(g, m, mu) { /* bag on the cabinet top (y top 0.9, x from 1.95 to 2.85); push -x 6 N for 0.3 s from t = 0.3 s */
    const dt = 1 / HZ, F = 6, hy = 0.15, edge = 1.95, wallX = -3 + 0.21; let x = 2.4, y = 0.9 + hy, vx = 0, vy = 0, mode = 'top'; const tr = []; let tOff = null, tLand = null, stuck = false;
    for (let i = 0; i <= 4 * HZ; i++) { const t = i * dt; if (i % 8 === 0) tr.push([t, x, y]);
      const f = t >= 0.3 && t < 0.6 ? -F : 0;
      if (mode === 'top' || mode === 'floor') { const fr = mu * m * g;
        if (Math.abs(vx) < 1e-6) { if (Math.abs(f) > fr) vx += (f + fr) / m * dt; else { vx = 0; if (f !== 0) stuck = true; } }
        else { const nv = vx + (f - Math.sign(vx) * fr) / m * dt; vx = (Math.sign(nv) !== Math.sign(vx) && f === 0) ? 0 : nv; }
        x += vx * dt; if (mode === 'top' && x < edge) { mode = 'air'; tOff = t; } }
      else { vx += f / m * dt; vy -= g * dt; x += vx * dt; y += vy * dt; if (y <= hy) { y = hy; vy = 0; mode = 'floor'; tLand = t; } }
      if (x < wallX) { x = wallX; vx = 0; } }
    return { tr, tOff, tLand, xEnd: x, yEnd: y, stuck: stuck && tOff == null && Math.abs(x - 2.4) < 1e-6 };
  }
  const sample = (tr, t) => { const T0 = tr[tr.length - 1][0]; const u = clamp(t, 0, T0) / T0 * (tr.length - 1), i = Math.min(tr.length - 2, Math.floor(u)), f = u - i; return tr[i].map((v, k) => L.lerp(v, tr[i + 1][k], f)); };

  /* ---------- A* on a 0.1 m occupancy grid built from the proxy boxes ---------- */
  function astar(start, goal, rad = 0.25) {
    const h = 0.1, NX = 60, NZ = 40, occ = new Uint8Array(NX * NZ);
    const cell = (x, z) => [Math.floor((x - ROOM.x0) / h), Math.floor((z - ROOM.z0) / h)];
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) { const x = ROOM.x0 + (i + 0.5) * h, z = ROOM.z0 + (j + 0.5) * h;
      let o = x < ROOM.x0 + rad || x > ROOM.x1 - rad || z < ROOM.z0 + rad || z > ROOM.z1 - rad;
      for (const ob of OBJ) { if (ob.c[1] - ob.s[1] / 2 > 1.0 || ob.id === 'bag') continue; if (Math.abs(x - ob.c[0]) < ob.s[0] / 2 + rad && Math.abs(z - ob.c[2]) < ob.s[2] / 2 + rad) o = true; }
      occ[i + j * NX] = o ? 1 : 0; }
    const [si, sj] = cell(...start), [gi, gj] = cell(...goal), K = (i, j) => i + j * NX;
    const gS = new Float64Array(NX * NZ).fill(Infinity), from = new Int32Array(NX * NZ).fill(-1), closed = new Uint8Array(NX * NZ);
    const H = (i, j) => { const dx = Math.abs(i - gi), dz = Math.abs(j - gj); return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz); };
    const open = [[H(si, sj), si, sj]]; gS[K(si, sj)] = 0; let expanded = 0;
    while (open.length) { let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k; const [, i, j] = open.splice(bi, 1)[0]; const k0 = K(i, j); if (closed[k0]) continue; closed[k0] = 1; expanded++;
      if (i === gi && j === gj) break;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { if (!di && !dj) continue; const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= NX || b >= NZ) continue; const k1 = K(a, b); if (occ[k1] || closed[k1]) continue;
        if (di && dj && (occ[K(i + di, j)] || occ[K(i, j + dj)])) continue;
        const ng = gS[k0] + (di && dj ? Math.SQRT2 : 1); if (ng < gS[k1]) { gS[k1] = ng; from[k1] = k0; open.push([ng + H(a, b), a, b]); } } }
    const path = []; let k = K(gi, gj); if (from[k] < 0 && k !== K(si, sj)) return { path: [start, goal], len: 0, expanded, occ, NX, NZ, h, ok: false };
    while (k >= 0) { path.push([ROOM.x0 + (k % NX + 0.5) * h, ROOM.z0 + (Math.floor(k / NX) + 0.5) * h]); k = from[k]; }
    path.reverse(); let len = 0; for (let i = 1; i < path.length; i++) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    return { path, len, expanded, occ, NX, NZ, h, ok: true };
  }
  function polyAt(path, t) { /* point at arc-length fraction t along a 2D polyline */
    let tot = 0; const cum = [0]; for (let i = 1; i < path.length; i++) { tot += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); cum.push(tot); }
    const s = clamp(t, 0, 1) * tot; let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const f = cum[i] > cum[i - 1] ? (s - cum[i - 1]) / (cum[i] - cum[i - 1]) : 0;
    const a = path[i - 1], b = path[i]; return { x: L.lerp(a[0], b[0], f), z: L.lerp(a[1], b[1], f), yaw: Math.atan2(b[0] - a[0], b[1] - a[1]), s };
  }
  function humanoid(G) {
    const g = new THREE.Group(), c = COL.robot;
    const torso = block(0.36, 0.5, 0.2, c, [0, 1.05, 0], { edgeOpacity: 0.2 }); const head = L.sphere(0.12, c); head.position.set(0, 1.45, 0);
    const limb = (x, y, len, w, col) => { const p = new THREE.Group(); p.position.set(x, y, 0); p.add(block(w, len, w, col, [0, -len / 2, 0], { edgeOpacity: 0.2 })); g.add(p); return p; };
    const legL = limb(-0.1, 0.8, 0.8, 0.12, 0x9aa6bf), legR = limb(0.1, 0.8, 0.8, 0.12, 0x9aa6bf), armL = limb(-0.25, 1.27, 0.55, 0.09, c), armR = limb(0.25, 1.27, 0.55, 0.09, c);
    const eye = new THREE.Object3D(); eye.position.set(0, 1.45, 0.1); g.add(torso, head, eye);
    g.userData = { legL, legR, armL, armR, eye, torso, head }; G.add(g); g.traverse(o => { if (o.isMesh) { o.userData.flat = 0xeef2fa; } }); return g;
  }
  function poseWalk(R, s, carrying) { const sw = Math.sin(s * 9) * 0.45; R.userData.legL.rotation.x = sw; R.userData.legR.rotation.x = -sw;
    R.userData.armL.rotation.x = carrying ? -1.25 : -sw * 0.6; R.userData.armR.rotation.x = carrying ? -1.25 : sw * 0.6; }

  /* ---------- insets: render the scene from a camera as a "photo" (lit) or as a proxy frame (flat colours) ---------- */
  let INS = null;
  function insets() {
    if (INS) return INS;
    const mk = id => { const c = $(id); const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: false }); r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(c.clientWidth || 180, c.clientHeight || 135, false); r.setClearColor(0x0b1020); return r; };
    try { INS = [mk('ins0'), mk('ins1')]; } catch (e) { INS = []; }
    return INS;
  }
  const FLATM = {};
  const flatMat = c => FLATM[c] || (FLATM[c] = new THREE.MeshBasicMaterial({ color: c }));
  function insetRender(r, cam, o = {}) {
    const hid = LABS.concat(HELP, o.hide || []), v = hid.map(s => s.visible); hid.forEach(s => { s.visible = false; });
    const shown = (o.show || []).map(s => [s, s.visible]); shown.forEach(([s]) => { s.visible = true; });
    const op = (o.opaque || []).map(m => [m, m.material.opacity, m.material.transparent, m.material.depthWrite]); op.forEach(([m]) => { m.material.opacity = 1; m.material.transparent = false; m.material.depthWrite = true; });
    const swapped = [], lines = [];
    if (o.mode === 'flat') { root.traverse(m => { if (m.isMesh && m.userData.flat != null && m.visible) { swapped.push([m, m.material]); m.material = flatMat(m.userData.flat); } if (m.isLineSegments && m.visible) { lines.push(m); m.visible = false; } }); r.setClearColor(0x1a1d24); }
    else r.setClearColor(0x2a2620);
    r.render(S.scene, cam);
    swapped.forEach(([m, mt]) => { m.material = mt; }); lines.forEach(m => { m.visible = true; });
    hid.forEach((s, i) => { s.visible = v[i]; }); shown.forEach(([s, vv]) => { s.visible = vv; });
    op.forEach(([m, a, t, d]) => { m.material.opacity = a; m.material.transparent = t; m.material.depthWrite = d; });
  }
  function showInsets(on, t0, t1) { $('renders').hidden = !on; if (on) { $('insc0').textContent = t0; $('insc1').textContent = t1 || ''; $('ins1').parentElement.hidden = !t1; } }
  /* code panel */
  function showCode(lines) { const el = $('code'); if (!lines) { el.hidden = true; return; } el.hidden = false; el.innerHTML = lines.map((l, i) => `<span data-l="${i}">${l}</span>`).join('\n'); }
  function codeOn(i, edited = []) { $('code').querySelectorAll('span[data-l]').forEach(s => { const k = +s.dataset.l; s.className = (k === i ? 'on' : '') + (edited.includes(k) ? ' ed' : ''); }); }
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const cmt = s => esc(s).replace(/(#.*)$/, '<i>$1</i>');

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    const Z1 = -2.2, Z2 = 2.0;
    const P = [
      ['上下文图像', [-5.4, 0, Z1], COL.ctx, 2], ['几何 + 位姿', [-2.7, 0, Z1], COL.geo, 3], ['3D 检测\n初始框', [0, 0, Z1], COL.det, 3], ['VLM 智能体\n分析-合成', [2.7, 0, Z1], COL.agent, 4], ['3D 代理', [5.4, 0, Z1], COL.proxy, 4],
      ['场景程序\n（代码）', [-5.4, 0, Z2], COL.prog, 5], ['模拟器\nMuJoCo', [-2.7, 0, Z2], COL.sim, 6], ['proxy 帧\n类别纯色', [0, 0, Z2], COL.proxy, 7], ['视频扩散\n渲染', [2.7, 0, Z2], COL.diff, 8], ['视频 / 机器人', [5.4, 0, Z2], COL.ctx, 10]
    ];
    const B = P.map(([t, pos, c, go]) => { const b = block(1.9, 0.5, 1.2, c, pos, { opacity: 0.9 }); b.userData.go = go - 1; PICKS.push(b); G.add(b, lab(t, [pos[0], 0.95, pos[2]], { size: 19, color: css(c) })); return b; });
    G.add(lab('建世界\n每个场景一次', [-7.7, 0.3, Z1], { size: 15, color: '#aab3c5' }), lab('运行\n每段视频一遍', [-7.7, 0.3, Z2], { size: 15, color: '#aab3c5' }));
    G.add(lab('编辑：改程序里的物体、属性、相机（第 9 幕）', [-3.4, 0.3, Z2 + 1.25], { size: 15, color: css(COL.prog), border: 'rgba(79,201,138,.6)' }));
    const path1 = [[-5.4, 0.3, Z1], [5.4, 0.3, Z1]], path2 = [[5.4, 0.3, Z1], [5.4, 0.3, -0.1], [-5.4, 0.3, -0.1], [-5.4, 0.3, Z2]], path3 = [[-5.4, 0.3, Z2], [5.4, 0.3, Z2]];
    [path1, path2, path3].forEach(pp => wire(G, pp, 0x8e9bb8, { opacity: 0.45 }));
    const f1 = stream(G, 10, COL.ctx), f2 = stream(G, 8, COL.proxy), f3 = stream(G, 10, COL.diff);
    const ref = wire(G, [[-5.4, 0.3, Z1], [-6.8, 0.3, Z1], [-6.8, 0.3, Z2 + 2.3], [2.7, 0.3, Z2 + 2.3], [2.7, 0.3, Z2]], COL.ctx, { dashed: true, dash: 0.25, gap: 0.18, opacity: 0.7 });
    G.add(lab('上下文图像也直接进入渲染器（外观参照）', [1.0, 0.3, Z2 + 2.3], { size: 15, color: css(COL.ctx) }));
    return { update(p) {
      const k = Math.floor(p * 10) % 10; B.forEach((b, i) => glow(b, i === k ? 0.8 : 0.08));
      f1(path1, (p * 3) % 1, p < 0.5 ? 1 : 0.4); f2(path2, (p * 3) % 1, 1); f3(path3, (p * 3) % 1, p >= 0.4 ? 1 : 0.4); ref.visible = true;
      cap(['上下文图像：几张照片或一段视频', '3D 基础模型恢复相机位姿和稠密几何', '3D 检测器（Boxer）给每个主要物体一个初始框', 'VLM 智能体用分析-合成循环修正代理', '得到 3D 代理：物体框 + 墙、地面、天花板', '场景程序：物体、位姿、物理属性和规则写成代码', '模拟器（多数用 MuJoCo）算运动、接触和碰撞', '从所选相机渲染 proxy 帧，每类物体一种纯色', '视频扩散模型以上下文视图为参照，把 proxy 帧画成真实视频', '输出视频，以及轨迹和交互状态（给机器人用）'][k]);
    } };
  }

  /* ---------- scene 2: context views and coverage ---------- */
  function s2(G) {
    let vs = +(OPT[0] ?? 2);
    const R = room(G); const fr = camFrusta(G, COL.ctx, { plane: true });
    const pos = new Float32Array(SURF.length * 3), col = new Float32Array(SURF.length * 3); SURF.forEach((s, i) => pos.set([s.p[0] + s.n[0] * 0.02, s.p[1] + s.n[1] * 0.02, s.p[2] + s.n[2] * 0.02], i * 3));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.055, vertexColors: true })); G.add(pts); HELP.push(pts);
    R.all.forEach(m => { m.material.transparent = true; m.material.opacity = 0.35; m.material.depthWrite = false; });
    const stat = dynLab(G, [0, 3.2, 0], { size: 18, border: 'rgba(56,209,255,.7)' });
    const nums = fr.map((f, i) => { const s = lab(String(i + 1), [CAMS[i].p[0], CAMS[i].p[1] + 0.3, CAMS[i].p[2]], { size: 15, color: css(COL.ctx) }); G.add(s); return s; });
    const cov = VIEWSETS.map(coverage);
    const ctls = [{ label: '上下文图像', items: ['1 张', '3 张', '9 张'], get: () => vs, set: k => { vs = k; } }];
    return { ctls, update(p) {
      const set = VIEWSETS[vs], shown = Math.max(1, Math.ceil(seg(p, 0, 0.35) * set.length));
      const act = set.slice(0, shown);
      fr.forEach((f, i) => { f.visible = act.includes(i); nums[i].visible = f.visible; });
      const C1 = hex3(COL.ctx), C2 = hex3(COL.warn); let k = 0;
      VIS.forEach((v, i) => { const s = act.some(ci => v[ci]); if (s) k++; col.set(s ? C1 : C2, i * 3); }); g.attributes.color.needsUpdate = true;
      stat(`${act.length} 张视图：${(100 * k / VIS.length).toFixed(1)}% 的表面点被看到\n（1 张 ${(100 * cov[0]).toFixed(1)}% · 3 张 ${(100 * cov[1]).toFixed(1)}% · 9 张 ${(100 * cov[2]).toFixed(1)}%）`);
      const I = insets(), cur = act[Math.floor(p * 3 * act.length) % act.length];
      if (I.length) { showInsets(true, `上下文图像 ${cur + 1}（玩具渲染）`, null); insetRender(I[0], CAMOBJ[cur], { mode: 'real', hide: [pts], opaque: R.all }); }
      cap(`青色：至少被一张上下文图像看到 · <b>橙色</b>：没有任何视图拍到，只能由模型推断 · 当前 ${act.length} 张，覆盖 <b>${(100 * k / VIS.length).toFixed(1)}%</b>`);
    } };
  }

  /* ---------- wireframe proxy boxes ---------- */
  function boxWire(G, color, o = {}) {
    const ls = segs(G, 12, { opacity: o.opacity ?? 0.95 }); const c3 = hex3(color);
    ls.userData.setBox = (b, c = c3) => { if (!b) { ls.visible = false; return; } ls.visible = true; const cs = corners(b); let e = 0;
      for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) { const x = i ^ j; if (x !== 1 && x !== 2 && x !== 4) continue; ls.userData.set(e++, cs[i], cs[j], c); } ls.userData.done(); };
    return ls;
  }

  /* ---------- scene 3: geometry + initial boxes ---------- */
  function s3(G) {
    const r = L.rng(3), vis = SURF.filter((s, i) => VIS[i].some(Boolean));
    const pos = new Float32Array(vis.length * 3), col = new Float32Array(vis.length * 3);
    vis.forEach((s, i) => { pos.set([s.p[0] + (r() - 0.5) * 0.05, s.p[1] + (r() - 0.5) * 0.05, s.p[2] + (r() - 0.5) * 0.05], i * 3); col.set(hex3(s.real), i * 3); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.06, vertexColors: true })); G.add(pts);
    const fr = camFrusta(G, COL.geo);
    const st = stage(0), W = {}, LB = {};
    Object.entries(st).forEach(([id, b]) => { const bad = !!b.note; W[id] = boxWire(G, bad ? COL.warn : COL.det); W[id].userData.setBox(b);
      const name = b.label || (OBJ[OI[id]] ? OBJ[OI[id]].name : id); const off = { desk: [0.3, 0.55, 0.2], night: [-0.35, 0.1, 0], bin: [0, -0.1, 0.35], bed: [0.2, 0, 0.3] }[id] || [0, 0, 0];
      LB[id] = lab(b.note ? `${name}：${b.note}` : name, [b.c[0] + off[0], b.c[1] + b.s[1] / 2 + 0.22 + off[1], b.c[2] + off[2]], { size: 15, color: bad ? css(COL.warn) : css(COL.det) }); G.add(LB[id]); });
    const miss = MISSING.map(id => { const ob = OBJ[OI[id]]; const s = lab(`漏检：${ob.name}`, [ob.c[0], ob.c[1] + ob.s[1] / 2 + 0.25, ob.c[2]], { size: 15, color: css(COL.warn), border: 'rgba(255,122,89,.7)' }); G.add(s); return s; });
    return { update(p) {
      const a = seg(p, 0, 0.35), n = Math.floor(a * vis.length); g.setDrawRange(0, n);
      fr.forEach(f => { f.visible = p < 0.5; });
      const ids = Object.keys(W), k = seg(p, 0.4, 0.75) * ids.length;
      ids.forEach((id, i) => { W[id].visible = i < k; LB[id].visible = i < k; }); miss.forEach(s => { s.visible = p > 0.8; });
      cap(p < 0.4 ? `3D 基础模型：从上下文图像恢复相机位姿和稠密几何（示意点云，${n} 点）` : p < 0.8 ? '3D 检测器给每个主要物体一个初始框（黄色）· 橙色是有问题的框' : '还有两个物体根本没被检测到。这些问题交给下一幕的 VLM 智能体');
    } };
  }

  /* ---------- scene 4: analysis-by-synthesis ---------- */
  function s4(G) {
    const R = room(G, { op: 0.22 }); R.all.forEach(m => { m.material.depthWrite = false; });
    const solid = new THREE.Group(); G.add(solid); const SB = {};
    const ids = Array.from(new Set(Object.keys(INIT).concat(['chair', 'bag'])));
    ids.forEach(id => { const ob = OBJ[OI[id]]; const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), L.mat(0xffffff)); m.userData.flat = ob ? ob.flat : 0xaaaaaa; solid.add(m); SB[id] = m; });
    solid.visible = false;
    const W = Object.fromEntries(ids.map(id => [id, boxWire(G, COL.det)]));
    const marks = FIT_IDS.map((id, i) => { const P = edgeMarks(id, 11 + i), pos = new Float32Array(P.length * 3); P.forEach((q, j) => pos.set(q, j * 3)); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const m = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.07, color: COL.agent })); G.add(m); HELP.push(m); return m; });
    const held = frustum(G, COL.ok, 0.45, { plane: true }); held.position.copy(CAMOBJ[HELD].position); held.quaternion.copy(CAMOBJ[HELD].quaternion); HELP.push(held);
    const heldLab = lab('留出的视图 5：只用来检查', [CAMS[HELD].p[0], CAMS[HELD].p[1] + 0.4, CAMS[HELD].p[2]], { size: 15, color: css(COL.ok) }); G.add(heldLab);
    const stat = dynLab(G, [-1.2, 2.9, 0], { size: 15, border: 'rgba(157,140,255,.7)' });
    const s1b = stage(1);
    const boxAt = (id, p) => {
      if (p < 0.18) return stage(0)[id] || null;
      if (p < 0.4) return s1b[id] || null;
      if (FITS[id]) { const H = FITS[id], k = Math.min(H.length - 1, Math.floor(seg(p, 0.4, 0.72) * (H.length - 1))); return H[k].b; }
      return s1b[id] || null;
    };
    const fitLoss = p => FIT_IDS.map(id => { const H = FITS[id], k = Math.min(H.length - 1, Math.floor(seg(p, 0.4, 0.72) * (H.length - 1))); return Math.sqrt(H[k].f) * 100; });
    return { update(p) {
      const bxs = {}; let sum = 0;
      ids.forEach(id => { const b = boxAt(id, p); bxs[id] = b; const bad = p < 0.18 && b && INIT[id] && INIT[id].note; W[id].userData.setBox(b, hex3(bad ? COL.warn : p >= 0.4 && FITS[id] ? COL.agent : COL.det));
        if (b) { SB[id].visible = true; SB[id].position.set(...b.c); SB[id].scale.set(...b.s); SB[id].rotation.y = b.yaw || 0; } else SB[id].visible = false; });
      OBJ.forEach((ob, oi) => { sum += meanIoU(bxs[ob.id] || null, oi); }); const mi = sum / OBJ.length;
      marks.forEach(m => { m.visible = p >= 0.36 && p < 0.76; }); held.visible = heldLab.visible = p >= 0.6;
      const round = p < 0.18 ? '第 0 轮 · 初始框' : p < 0.4 ? '第 1 轮 · VLM：补上椅子和包，删掉“衣架”，“镜子”改成“画”，书桌框只包桌面' : p < 0.76 ? '第 2 轮 · 优化器：把框拟合到标出的边（紫色点）' : '第 3 轮 · 审阅智能体：检查全部 9 张视图';
      let line2 = '';
      if (p >= 0.4 && p < 0.76) { const fl = fitLoss(p); line2 = '\n边点到框棱 RMS（cm）：' + FIT_IDS.map((id, i) => `${OBJ[OI[id]].name.slice(0, 2)} ${fl[i].toFixed(1)}`).join(' · '); }
      if (p >= 0.6) { const d = IOU_HELD.desk; line2 += d ? `\n留出视图 5：书桌 IoU ${d[0].toFixed(2)} → ${d[1].toFixed(2)}，保留` : ''; }
      if (p >= 0.76) { const lo = OBJ.map(o => IOU_FIT[o.id]).reduce((a, b) => Math.min(a, b), 1); line2 += `\n最低物体 IoU ${lo.toFixed(2)} ${lo >= 0.8 ? '≥ 0.8：接受，停止' : '< 0.8：再来一轮'}`; }
      stat(`${round.split(' · ')[0]}\n10 个物体、9 视图平均 2D IoU：${mi.toFixed(3)}${line2}`);
      const I = insets(); if (I.length) { showInsets(true, '“输入照片”· 视图 5（玩具）', '当前代理从同一相机渲染');
        insetRender(I[0], CAMOBJ[HELD], { mode: 'real', hide: [solid], opaque: R.all });
        insetRender(I[1], CAMOBJ[HELD], { mode: 'flat', show: [solid], hide: R.all.filter(m => !R.shell.includes(m)), opaque: R.shell }); }
      cap(`${round} · 平均 IoU <b>${mi.toFixed(3)}</b>（初始 ${avg(IOU_INIT).toFixed(3)} → 第 1 轮 ${avg(IOU_R1).toFixed(3)} → 拟合后 ${avg(IOU_FIT).toFixed(3)}）`);
    } };
  }

  /* ---------- scene 5: scene program ---------- */
  const PROG = [
    { lines: ['hotel = mundo.World("hotel_toy")   # 9 张上下文图', 'robot = hotel.add("humanoid")      # 从资产库取', 'bag   = hotel.cabinet.bag          # 1.2 kg（玩具）', 'robot.at(0.4).grasp(bag)', 'robot.at(3.1).carry(bag, to=hotel.bed)', 'robot.at(9.4).place(bag, on=hotel.bed)', 'sim   = hotel.simulate(engine="mujoco")', 'video = mundo.render(sim, hotel.camera("orbit"))'],
      at: [[0, 0.06, null], [0.06, 0.12, 'robot'], [0.12, 0.2, 'bag'], [0.2, 0.42, 'bag'], [0.42, 0.78, 'bed'], [0.78, 0.9, 'bed'], [0.9, 0.95, null], [0.95, 1.01, null]] },
    { lines: ['hotel = mundo.World("hotel_toy")', 'bin   = hotel.bin                  # 1.0 kg', 'bin.friction = 0.3', 'ball  = hotel.add("ball", h=0.98, restitution=0.76)', 't = hotel.timeline()', 't.at(0.0).run(ball.release())', 't.at(0.3).run(bin.shove(dir="+x", force=12, dur=0.4))', 'sim   = hotel.simulate(engine="mujoco", hz=960)'],
      at: [[0, 0.06, null], [0.06, 0.12, 'bin'], [0.12, 0.18, 'bin'], [0.18, 0.26, 'ball'], [0.26, 0.3, null], [0.3, 0.45, 'ball'], [0.45, 0.92, 'bin'], [0.92, 1.01, null]] }
  ];
  function s5(G) {
    let pr = +(OPT[0] ?? 0);
    const R = room(G, { skip: ['bin'] }); const robot = humanoid(G);
    const binM = block(0.3, 0.4, 0.3, OBJ[OI.bin].real, [0, 0.2, 0], { edges: false }); binM.userData.flat = OBJ[OI.bin].flat; G.add(binM);
    const ball = L.sphere(0.12, 0xf0963c); ball.userData.flat = 0xf0963c; G.add(ball);
    const bag = R.meshes.bag; const stat = dynLab(G, [0, 3.0, 0], { size: 16, border: 'rgba(79,201,138,.7)' });
    const pick = [2.4, 0.85], drop = [-0.3, -0.7];
    const P1 = astar([0.0, 1.2], pick).path, P2 = astar(pick, drop).path;
    const push = simPush(12, 0.3), balls = simBalls();
    const ctls = [{ label: '程序', items: ['机器人搬包', '推桶和放球'], get: () => pr, set: k => { pr = k; showCode(PROG[pr].lines.map(cmt)); } }];
    showCode(PROG[pr].lines.map(cmt));
    const ex = { bed: R.meshes.bed, bag, robot: robot.userData.torso, bin: binM, ball };
    Object.values(ex).forEach(m => { if (!m.userData.c) m.userData.c = hex3(0xffffff); });
    return { ctls, update(p) {
      const A = PROG[pr].at; let li = A.findIndex(a => p >= a[0] && p < a[1]); if (li < 0) li = A.length - 1; codeOn(li);
      Object.entries(ex).forEach(([k, m]) => { m.material.emissive.setRGB(0, 0, 0); if (k === A[li][2]) m.material.emissive.setRGB(0.25, 0.55, 0.35); });
      robot.visible = pr === 0; bag.visible = true; binM.visible = pr === 1; ball.visible = pr === 1;
      if (pr === 0) {
        let x, z, yaw, carrying = false, s = 0;
        if (p < 0.2) { const q = polyAt(P1, seg(p, 0.0, 0.2)); x = q.x; z = q.z; yaw = q.yaw; s = q.s; }
        else if (p < 0.42) { x = pick[0]; z = pick[1]; yaw = 0; }
        else if (p < 0.78) { const q = polyAt(P2, seg(p, 0.42, 0.78)); x = q.x; z = q.z; yaw = q.yaw; s = q.s + 5; carrying = true; }
        else { x = drop[0]; z = drop[1]; yaw = -PI / 2; carrying = p < 0.9; }
        robot.position.set(x, 0, z); robot.rotation.y = yaw; poseWalk(robot, s, carrying || (p >= 0.3 && p < 0.42));
        robot.updateMatrixWorld(true);
        if (p < 0.3) bag.position.set(...OBJ[OI.bag].c);
        else if (p < 0.9) { const h = new THREE.Vector3(0, 1.0, 0.42).applyMatrix4(robot.matrixWorld); if (p < 0.42) { const k = seg(p, 0.3, 0.42); bag.position.set(L.lerp(2.4, h.x, k), L.lerp(1.05, h.y, k), L.lerp(1.5, h.z, k)); } else bag.position.copy(h); }
        if (p >= 0.9) bag.position.set(-1.0, 0.75, -0.7);
        stat(`S_t（部分）· t = ${(p * 12).toFixed(1)} s\nbag.pos = (${bag.position.x.toFixed(2)}, ${bag.position.y.toFixed(2)}, ${bag.position.z.toFixed(2)})  bag.held_by = ${p >= 0.3 && p < 0.9 ? 'robot.hand' : 'None'}`);
        cap(['定义世界：从 9 张照片建出的代理', '从资产库加一个人形机器人', '在程序里拿到柜子上的包', 'grasp：机器人走到柜子前（A* 路径）并抓起包', 'carry：搬着包走到床边', 'place：把包放到床上', 'simulate：交给模拟器跑', 'render：按相机轨迹渲染成视频'][li]);
      } else {
        bag.position.set(...OBJ[OI.bag].c);
        const t = p * 3.2, q = sample(push.tr, t); binM.position.set(q[1], 0.2, 1.5);
        const qb = sample(balls[1].tr, t * 1.2); ball.position.set(0.0, qb[1] + 0.12, 0.6);
        stat(`S_t（部分）· t = ${t.toFixed(2)} s\nbin.x = ${q[1].toFixed(3)} m  bin.v = ${q[2].toFixed(2)} m/s  ball.y = ${(qb[1]).toFixed(3)} m`);
        cap(['定义世界', '拿到垃圾桶（质量写在程序里）', '设定它和地面的摩擦系数', '加一个球，给出初始高度和恢复系数', '建一条时间线', '0 s 放开球', '0.3 s 起推桶 0.4 s，桶撞上柜子后反弹', '960 Hz 模拟（第 6 幕当场算）'][li]);
      }
    }, dispose() { showCode(null); } };
  }

  /* ---------- scene 6: simulator, computed live ---------- */
  function s6(G) {
    let mode = +(OPT[0] ?? 0), fI = +(OPT[1] ?? 1), muI = +(OPT[2] ?? 0);
    const FS = [6, 12], MUS = [0.3, 0.1];
    const R = room(G, { skip: ['bin'] }); R.all.forEach(m => { if (m !== R.meshes.cab) { m.material.transparent = true; m.material.opacity = 0.35; } });
    const binM = block(0.3, 0.4, 0.3, OBJ[OI.bin].real, [0.2, 0.2, 1.5], { edges: false }); G.add(binM);
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0.2, 1.5), 0.6, COL.warn, 0.18, 0.12); G.add(arrow); HELP.push(arrow);
    const balls = BALLS.map((b, i) => { const m = L.sphere(b.r, b.col); m.position.set(-1.2 + i * 1.2, 1, 0.6); G.add(m); return m; });
    const ballLabs = BALLS.map((b, i) => { const s = lab(`${b.name} e=${b.e}`, [-1.2 + i * 1.2, 1.4, 0.6], { size: 14, color: css(b.col === 0x343b4a ? 0xaab3c5 : b.col) }); G.add(s); return s; });
    const stat = dynLab(G, [0.4, 0.05, 2.9], { size: 16, border: 'rgba(79,201,138,.7)' });
    let sim = null, bs = null; const rerun = () => { sim = simPush(FS[fI], MUS[muI]); bs = simBalls(); }; rerun();
    const ctls = [{ label: '场景', items: ['推垃圾桶', '三个球'], get: () => mode, set: k => { mode = k; } },
      { label: '推力', items: ['6 N', '12 N'], get: () => fI, set: k => { fI = k; rerun(); } }, { label: '摩擦 μ', items: ['0.3', '0.1'], get: () => muI, set: k => { muI = k; rerun(); } }];
    return { ctls, update(p) {
      binM.visible = mode === 0; arrow.visible = false; balls.forEach(b => { b.visible = mode === 1; }); ballLabs.forEach(b => { b.visible = mode === 1; });
      if (mode === 0) { const t = p * sim.T, q = sample(sim.tr, t); binM.position.set(q[1], 0.2, 1.5);
        if (t >= 0.3 && t < 0.7) { arrow.visible = true; arrow.position.set(q[1] - 0.75, 0.2, 1.5); arrow.setLength(0.55 * FS[fI] / 12 + 0.15, 0.16, 0.1); }
        const hit = sim.hits.length ? `撞柜子：t = ${sim.hits[0][0].toFixed(3)} s，撞击速度 ${sim.hits[0][1].toFixed(2)} m/s，反弹 ${(0.3 * sim.hits[0][1]).toFixed(2)} m/s` : '没有碰到柜子';
        stat(`t = ${t.toFixed(2)} s · x = ${q[1].toFixed(3)} m · v = ${q[2].toFixed(2)} m/s\n推力 ${FS[fI]} N（0.3–0.7 s），μ = ${MUS[muI]}，m = 1 kg，摩擦力 ${(MUS[muI] * 9.81).toFixed(2)} N\n${hit}\n停下：${sim.tStop != null ? sim.tStop.toFixed(2) + ' s，x = ' + sim.xEnd.toFixed(3) + ' m' : '还在动'}`);
        cap(`当场积分（dt = 1/960 s）：推力 ${FS[fI]} N 减去摩擦 ${(MUS[muI] * 9.81).toFixed(2)} N · ${sim.hits.length ? '<b>撞上柜子</b>，按恢复系数 0.3 反弹' : '摩擦先让它停下'}`);
      } else { const t = p * 4;
        balls.forEach((m, i) => { const q = sample(bs[i].tr, t); m.position.y = q[1] + BALLS[i].r; });
        const rows = BALLS.map((b, i) => { const a = bs[i].apex; const r1 = a.length > 1 ? a[1] / a[0] : 0, r2 = a.length > 2 ? a[2] / a[1] : NaN; return `${b.name}：h₁/h₀ = ${r1.toFixed(3)}${isNaN(r2) ? '' : '，h₂/h₁ = ' + r2.toFixed(3)}，e² = ${(b.e * b.e).toFixed(3)}`; });
        stat(`t = ${t.toFixed(2)} s · 从 0.98 m 放下\n${rows.join('\n')}`);
        cap('每次弹起的高度比 ≈ e²：恢复系数 e 是反弹速度和撞地速度之比，高度和速度平方成正比 · 质量不影响这个比值');
      }
    } };
  }

  /* ---------- scene 7: proxy frames + Plücker rays ---------- */
  function s7(G) {
    const R = room(G); const k = new THREE.PerspectiveCamera(60, 4 / 3, 0.05, 40); const f = frustum(G, COL.proxy, 0.5, { plane: true }); HELP.push(f);
    const rays = segs(G, 20, { opacity: 0.75 }); HELP.push(rays);
    const stat = dynLab(G, [-0.4, 0.05, 2.75], { size: 14, border: 'rgba(240,150,60,.7)' });
    const bag = R.meshes.bag;
    return { update(p) {
      const a = p * 2 * PI; const pos = [2.0 * Math.cos(a * 0.5) + 0.2, 1.5, 1.6 - 0.2 * Math.sin(a)]; k.position.set(...pos); k.lookAt(-0.6, 0.6, -0.6); k.updateMatrixWorld(true);
      f.position.copy(k.position); f.quaternion.copy(k.quaternion);
      bag.position.set(2.4, 1.05 + 0.25 * Math.max(0, Math.sin(p * 4 * PI)), 1.5);
      let e = 0; const o = k.position.toArray();
      for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) { const v = new THREE.Vector3(-1 + (i + 0.5) * 0.4, -1 + (j + 0.5) * 0.5, 0.5).unproject(k).sub(k.position).normalize(); const end = k.position.clone().addScaledVector(v, 4.2).toArray(); const c = [0.5 + 0.5 * v.x, 0.5 + 0.5 * v.y, 0.5 + 0.5 * v.z]; rays.userData.set(e++, o, end, c); }
      rays.userData.done();
      const d = new THREE.Vector3(0, 0, -1).applyQuaternion(k.quaternion).normalize(), m = new THREE.Vector3().crossVectors(k.position, d);
      stat(`中心像素的 Plücker 射线\nd = (${d.x.toFixed(3)}, ${d.y.toFixed(3)}, ${d.z.toFixed(3)})\nm = o × d = (${m.x.toFixed(3)}, ${m.y.toFixed(3)}, ${m.z.toFixed(3)})\nd·m = ${(d.dot(m)).toFixed(6)}（恒为 0）`);
      const I = insets(); if (I.length) { showInsets(true, 'proxy 帧：类别纯色（示意配色）', '同一相机：普通光照渲染（对照）'); insetRender(I[0], k, { mode: 'flat' }); insetRender(I[1], k, { mode: 'real' }); }
      cap('相机沿轨迹移动，每一帧都从模拟后的世界渲染一张 <b>proxy 帧</b>：不要纹理和光照，只要“哪类物体在哪里”');
    } };
  }

  /* ---------- scene 8: diffusion conditioning (示意) and chunked long videos (computed) ---------- */
  function s8(G) {
    let mode = +(OPT[0] ?? 0), lenI = +(OPT[1] ?? 1); const LENS = [304, 484, 1440];
    const A = new THREE.Group(), B = new THREE.Group(); G.add(A, B);
    /* mode A: token rows */
    const rows = [['上下文视图 I₁..I_K + 相机 c_k', COL.ctx, 3, -2.2], ['proxy 视频 latent + Plücker', COL.proxy, 6, -0.6], ['目标视频 latent（去噪中）', COL.grey, 6, 1.0]];
    const tok = [];
    rows.forEach(([t, c, n, z], ri) => { A.add(lab(t, [-3.4, 0.1, z - 0.62], { size: 14, color: css(c) })); for (let i = 0; i < n; i++) { const b = block(0.7, 0.3, 0.7, c, [-4.6 + i * 0.85, 0.15, z], { opacity: 0.92 }); A.add(b); tok.push([ri, i, b]); } });
    const refb = block(0.7, 0.3, 0.7, COL.robot, [-4.6 + 3 * 0.85, 0.15, -2.2], { opacity: 0.92 }); A.add(refb, lab('无相机参考图\n（学到的编码）', [-0.6, 0.15, -2.2], { size: 13, color: css(COL.robot) }));
    const dit = block(1.2, 2.0, 4.4, COL.diff, [1.9, 1.0, -0.6], { opacity: 0.55 }); A.add(dit, lab('视频扩散 Transformer\nMiniMax-H3 Ref2VA 微调', [1.9, 2.5, -0.6], { size: 15, color: css(COL.diff) }));
    A.add(lab('三组 latent 拼成一条序列 · Plücker 相机编码在第一个块前相加', [-1.6, 0.05, 2.3], { size: 14, color: '#aab3c5' }));
    const fl = stream(A, 12, COL.white, 0.06);
    /* mode B: chunk bars */
    const bars = new THREE.Group(); B.add(bars); const blab = dynLab(B, [0.0, 0.05, 3.75], { size: 15, border: 'rgba(212,95,160,.7)' });
    const R = room(B, { op: 0.5 }); const fr = camFrusta(B, COL.ctx); const pathL = pline(B, 80, COL.diff, { opacity: 0.9 });
    const camPath = t => [L.lerp(2.4, -1.8, t), 1.4, 1.2 * Math.cos(t * PI * 1.3) * 0.9];
    const cp = Array.from({ length: 80 }, (_, i) => camPath(i / 79)); pathL.userData.set(cp);
    const cur = L.sphere(0.12, COL.diff); B.add(cur);
    let barMs = [];
    const buildBars = () => { L.clear(bars); barMs = []; const F = LENS[lenI], n = 1 + Math.max(0, Math.ceil((F - 124) / 90)), W = 9 / Math.max(F, 1);
      for (let i = 0; i < n; i++) { const a = i * 90, b = a + 124, x0 = -4.5 + a * W;
        const m = block(124 * W, 0.12, 0.22, COL.diff, [x0 + 62 * W, 0.08, 2.55 + (i % 2) * 0.3], { opacity: 0.8, edgeOpacity: 0.5 }); bars.add(m);
        let pf = null; if (i > 0) { pf = block(34 * W, 0.14, 0.24, COL.warn, [x0 + 17 * W, 0.09, 2.55 + (i % 2) * 0.3], { opacity: 0.9 }); bars.add(pf); }
        barMs.push({ m, pf, a, b }); }
      bars.userData = { n, F, W }; };
    buildBars();
    const ctls = [{ label: '看', items: ['条件怎么进去', '长视频分块'], get: () => mode, set: k => { mode = k; } }, { label: '长度', items: ['304 帧', '484 帧', '1440 帧'], get: () => lenI, set: k => { lenI = k; buildBars(); } }];
    const ctxSel = t => { const c = camPath(t), score = CAMS.map((cc, i) => [Math.hypot(cc.p[0] - c[0], cc.p[2] - c[2]), i]).sort((a, b) => a[0] - b[0]); return score.slice(0, 3).map(s => s[1]); };
    return { ctls, update(p) {
      A.visible = mode === 0; B.visible = mode === 1;
      const I = insets();
      if (mode === 0) {
        const k = seg(p, 0.15, 0.9), noise = hex3(COL.grey), clean = hex3(0xd9c4a0);
        tok.forEach(([ri, i, b]) => { if (ri === 2) { const r = L.lerp(noise[0], clean[0], k), g = L.lerp(noise[1], clean[1], k), bb = L.lerp(noise[2], clean[2], k); b.material.color.setRGB(r, g, bb); b.position.y = 0.2 + 0.08 * Math.sin(p * 30 + i) * (1 - k); } });
        fl([[-4.6, 0.4, -2.2], [1.2, 0.5, -0.6], [1.9, 0.6, -0.6]], (p * 3) % 1, 1);
        if (I.length) { showInsets(true, '条件：proxy 帧', '输出（示意：普通光照渲染）'); const kk = new THREE.PerspectiveCamera(60, 4 / 3, 0.05, 40); kk.position.set(1.8, 1.5, 1.7); kk.lookAt(-1, 0.5, -1); kk.updateMatrixWorld(true);
          const vA = A.visible, vB = B.visible; A.visible = false; B.visible = true; fr.forEach(f => { f.visible = false; }); pathL.visible = false; cur.visible = false; bars.visible = false; blab.show(false);
          insetRender(I[0], kk, { mode: 'flat', opaque: R.all }); insetRender(I[1], kk, { mode: 'real', opaque: R.all });
          A.visible = vA; B.visible = vB; pathL.visible = true; cur.visible = true; bars.visible = true; blab.show(true); }
        cap(`去噪进度 ${(k * 100).toFixed(0)}%（示意）· 条件 = proxy 视频 π(S₁:T, c₁:T) + 上下文视图 {(I_k, c_k)} + 文本 y`);
      } else {
        showInsets(false);
        const { n, F, W } = bars.userData, f = p * F; const ci = Math.min(n - 1, Math.max(0, Math.floor(Math.max(0, f - 34) / 90)));
        barMs.forEach((b, i) => { glow(b.m, i === ci ? 0.9 : 0.05); });
        const t = clamp(f / F, 0, 1); cur.position.set(...camPath(t)); const sel = ctxSel(t); fr.forEach((fm, i) => { fm.visible = sel.includes(i); });
        const secs = F / 24, rt = F / 1.5;
        blab(`${F} 帧（24 fps 下 ${secs.toFixed(1)} s）：${n} 块，每块 124 帧，后一块用前一块最后 34 帧作前缀\n总生成长度 ${124 + (n - 1) * 90} 帧 · 按 1.5 帧/秒约 ${(rt / 60).toFixed(1)} 分钟（8 × A800）\n当前第 ${ci + 1} 块 · 这一块挑的上下文视图：${sel.map(i => i + 1).join('、')}`);
        cap(`长视频分块：橙色是固定前缀（34 帧）· 每块按相机路径挑最相关的上下文视图（这里按距离挑 3 张，<b>示意</b>）`);
      }
    } };
  }

  /* ---------- scene 9: edit the world ---------- */
  const PROG9 = g => ['room = mundo.World("hotel_toy")', `room.gravity = ${g[0]}`, 'bag = room.cabinet.bag', `bag.mass = ${g[1]}`, `bag.friction = ${g[2]}`, 't = room.timeline()', 't.at(0.3).run(bag.push(dir="-x", force=6.0, dur=0.3))', 'sim = room.simulate(engine="mujoco", hz=960)'];
  function s9(G) {
    let gI = +(OPT[0] ?? 0), mI = +(OPT[1] ?? 0), uI = +(OPT[2] ?? 0); const GS = [9.81, 1.62, 0], MS = [0.5, 5.0], US = [0.2, 0.6];
    const R = room(G); const bag = R.meshes.bag; const trail = pline(G, 120, COL.warn, { opacity: 0.85 }); HELP.push(trail);
    let sim; const rerun = () => { sim = simBag(GS[gI], MS[mI], US[uI]); showCode(PROG9([GS[gI], MS[mI], US[uI]]).map(cmt)); }; rerun();
    const ctls = [{ label: '重力', items: ['地球 9.81', '月球 1.62', '失重 0'], get: () => gI, set: k => { gI = k; rerun(); } },
      { label: '质量', items: ['0.5 kg', '5 kg'], get: () => mI, set: k => { mI = k; rerun(); } }, { label: '摩擦', items: ['0.2', '0.6'], get: () => uI, set: k => { uI = k; rerun(); } }];
    return { ctls, update(p) {
      codeOn(-1, [1, 3, 4]);
      const t = p * 4, q = sample(sim.tr, t); bag.position.set(q[1], q[2], 1.5);
      const tr = sim.tr.filter(r => r[0] <= t).map(r => [r[1], r[2], 1.5]); trail.userData.set(tr.length ? tr : [[2.4, 1.05, 1.5]]);
      const g = GS[gI], m = MS[mI], mu = US[uI], fr = mu * m * g;
      const res = sim.stuck ? `推不动：6 N ≤ μmg = ${fr.toFixed(2)} N` : `${sim.tOff != null ? '离开柜边 ' + sim.tOff.toFixed(2) + ' s' : '没离开柜子'}${sim.tLand != null ? '，落地 ' + sim.tLand.toFixed(2) + ' s' : g === 0 && sim.tOff != null ? '，没有重力，不会落下' : ''}，最后 x = ${sim.xEnd.toFixed(2)} m`;
      cap(`g = ${g} · m = ${m} kg · μ = ${mu} · 摩擦上限 μmg = <b>${fr.toFixed(2)} N</b>（推力 6 N）<br>${res}`);
    }, dispose() { showCode(null); } };
  }

  /* ---------- scene 10: robot task with A* on the proxy ---------- */
  function s10(G) {
    const R = room(G); const robot = humanoid(G); const bag = R.meshes.bag;
    const start = [0.0, 1.6], pick = [2.4, 0.85], drop = [-0.3, -0.7];
    const a1 = astar(start, pick), a2 = astar(pick, drop);
    const occ = a1.occ, NX = a1.NX, NZ = a1.NZ, h = a1.h; let nOcc = 0; for (let i = 0; i < occ.length; i++) nOcc += occ[i];
    const cells = new THREE.InstancedMesh(new THREE.BoxGeometry(h * 0.92, 0.01, h * 0.92), new THREE.MeshBasicMaterial({ color: COL.warn, transparent: true, opacity: 0.32 }), Math.max(1, nOcc)); let k = 0;
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) if (occ[i + j * NX]) { _P.set(ROOM.x0 + (i + 0.5) * h, 0.012, ROOM.z0 + (j + 0.5) * h); _Sv.setScalar(1); cells.setMatrixAt(k++, _M.compose(_P, _Q0, _Sv)); }
    cells.instanceMatrix.needsUpdate = true; G.add(cells); HELP.push(cells);
    const l1 = pline(G, a1.path.length, COL.ctx), l2 = pline(G, a2.path.length, COL.ok); l1.userData.set(a1.path.map(q => [q[0], 0.03, q[1]])); l2.userData.set(a2.path.map(q => [q[0], 0.03, q[1]])); HELP.push(l1, l2);
    const head = new THREE.PerspectiveCamera(70, 4 / 3, 0.05, 40);
    G.add(lab('起点', [start[0], 0.4, start[1]], { size: 15 }), lab('取包', [pick[0], 0.25, pick[1] - 0.25], { size: 15, color: css(COL.ctx) }), lab('放到床上', [drop[0] - 0.6, 0.95, drop[1]], { size: 15, color: css(COL.ok) }));
    const stat = dynLab(G, [0, 3.0, 0], { size: 16, border: 'rgba(56,209,255,.7)' });
    return { update(p) {
      let x, z, yaw, carrying = false, s = 0, ph;
      if (p < 0.35) { const q = polyAt(a1.path, seg(p, 0, 0.35)); x = q.x; z = q.z; yaw = q.yaw; s = q.s; ph = '走向柜子'; }
      else if (p < 0.45) { x = pick[0]; z = pick[1]; yaw = 0; ph = '抓起包'; }
      else if (p < 0.82) { const q = polyAt(a2.path, seg(p, 0.45, 0.82)); x = q.x; z = q.z; yaw = q.yaw; s = q.s + 3; carrying = true; ph = '搬到床边'; }
      else { x = drop[0]; z = drop[1]; yaw = -PI / 2; carrying = p < 0.9; ph = p < 0.9 ? '放下' : '完成'; }
      robot.position.set(x, 0, z); robot.rotation.y = yaw; poseWalk(robot, s, carrying || (p >= 0.38 && p < 0.45)); robot.updateMatrixWorld(true);
      if (p < 0.38) bag.position.set(...OBJ[OI.bag].c);
      else if (p < 0.9) { const hh = new THREE.Vector3(0, 1.0, 0.42).applyMatrix4(robot.matrixWorld); if (p < 0.45) { const kk = seg(p, 0.38, 0.45); bag.position.set(L.lerp(2.4, hh.x, kk), L.lerp(1.05, hh.y, kk), L.lerp(1.5, hh.z, kk)); } else bag.position.copy(hh); }
      else bag.position.set(-1.0, 0.75, -0.7);
      const e = new THREE.Vector3(); robot.userData.eye.getWorldPosition(e); head.position.copy(e); const fwd = new THREE.Vector3(Math.sin(yaw), -0.35, Math.cos(yaw)); head.lookAt(e.clone().add(fwd)); head.updateMatrixWorld(true);
      stat(`占据栅格 0.1 m，障碍按半径 0.25 m 膨胀，${nOcc} 个格子\nA* 去柜子：${a1.len.toFixed(2)} m，展开 ${a1.expanded} 个节点\nA* 去床边：${a2.len.toFixed(2)} m，展开 ${a2.expanded} 个节点`);
      const I = insets(); if (I.length) { showInsets(true, '头部相机：“渲染”（示意）', '头部相机：proxy 帧'); const vr = robot.visible; robot.visible = false; insetRender(I[0], head, { mode: 'real' }); insetRender(I[1], head, { mode: 'flat' }); robot.visible = vr; }
      cap(`${ph} · 路径由代理生成的占据栅格上的 A* 当场算出 · 小窗是机器人头部相机看到的两种画面`);
    } };
  }

  /* ---------- scene 11: four routes side by side ---------- */
  function s11(G) {
    let hl = +(OPT[0] ?? 0);
    const E = COL.explicit, Lr = COL.learned, Dt = COL.ctx;
    const cols = [
      ['纯视频世界模型\nWan2.1 I2V / VPP2', [['图像 + 文本/动作', Dt, ''], ['视频扩散（学到的）\n动力学 + 外观都在里面', Lr, 'pa'], ['像素', Dt, '']], 'phys:隐式 外观:学到 编辑:改提示词'],
      ['Mundo', [['照片', Dt, ''], ['3D 代理 + 场景程序\n（显式，可改）', E, 'pe'], ['MuJoCo（显式物理）', E, 'p'], ['proxy 帧', COL.proxy, ''], ['视频扩散（外观）', Lr, 'a'], ['像素', Dt, '']], 'phys:显式 外观:学到 编辑:改代码'],
      ['Real2Sim-Eval\n3DGS + PhysTwin', [['手机扫描 + 交互视频', Dt, ''], ['PhysTwin 弹簧-质点\n（显式，参数从视频辨识）', E, 'pe'], ['3DGS（显式外观）\nLBS 跟随', E, 'ae'], ['光栅化像素', Dt, '']], 'phys:显式 外观:显式 编辑:改参数'],
      ['3D World Simulator\n粒子-体素', [['点云 / 多视图', Dt, ''], ['粒子-体素潜变量', Lr, ''], ['学到的 3D 动力学', Lr, 'p'], ['高斯解码 + 渲染', Lr, 'a'], ['像素 / 触觉', Dt, '']], 'phys:学到 外观:学到 编辑:换动作']
    ];
    const all = [];
    cols.forEach(([title, steps], ci) => { const x = -5.4 + ci * 3.6; G.add(lab(title, [x, 4.6, 0], { size: 17, color: ci === 1 ? css(COL.proxy) : '#e6ecf7', border: ci === 1 ? 'rgba(240,150,60,.8)' : null }));
      steps.forEach(([t, c, tag], si) => { const y = 3.6 - si * (4.4 / Math.max(steps.length, 4)); const b = block(3.0, 0.42, 0.5, c, [x, y, 0], { opacity: 0.9 }); G.add(b, lab(t, [x, y + 0.02, 0.4], { size: 14 })); all.push({ b, tag, ci, si, n: steps.length, x, y }); }); });
    G.add(lab('绿色 = 显式（能直接读写）   紫色 = 学到的网络   蓝色 = 数据', [0, -0.9, 0], { size: 15, color: '#aab3c5' }));
    const ctls = [{ label: '高亮', items: ['物理在哪', '外观在哪', '能编辑什么'], get: () => hl, set: k => { hl = k; } }];
    const pk = stream(G, 4, COL.white, 0.08);
    return { ctls, update(p) {
      const want = ['p', 'a', 'e'][hl];
      all.forEach(({ b, tag }) => { const on = tag.includes(want); glow(b, on ? 0.25 + 0.15 * Math.sin(p * 12) : 0); b.material.opacity = on ? 0.95 : 0.22; b.material.transparent = true; });
      const xs = cols.map((_, ci) => -5.4 + ci * 3.6); pk(xs.map(x => [x, 3.6, 0.5]).concat(xs.slice().reverse().map(x => [x, -0.4, 0.5])), (p * 2) % 1, 0);
      cap(['<b>物理</b>：视频模型把它藏在权重里；Mundo 和 Real2Sim 把它放在显式模拟器；3DWS 学一个 3D 动力学网络', '<b>外观</b>：Mundo 和视频模型都靠扩散生成；Real2Sim 用扫描出的高斯直接渲染；3DWS 解码出高斯', '<b>编辑</b>：Mundo 改一行代码；Real2Sim 改模拟参数；视频模型只能改提示词或条件图'][hl]);
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player (same as interactives/phc, latent, real2sim-eval) ---------- */
  let cur = 0, api = null, playing = !L.reduced(), t0 = 0, pNow = 0, tw = null, OPT = [];
  const HOLD = 1.8;
  const aspectFix = () => { const el = $('stage'), asp = (el.clientWidth || 1) / (el.clientHeight || 1); return Math.min(2.2, Math.max(1, 1.45 / asp)); };
  function fly(th, ph, d, tg) {
    let dth = th - S.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth)); d *= aspectFix();
    tw = { t0: performance.now(), from: [S.theta, S.phi, S.dist, S.target.clone()], to: [S.theta + dth, ph, d, new THREE.Vector3(...tg)] };
    refDist = d;
  }
  function setPlay(on) { playing = on; $('play').textContent = on ? '❚❚ 暂停' : '▶ 播放'; $('play').setAttribute('aria-label', on ? '暂停' : '播放'); }
  function buildCtl() {
    const box = $('ctl'); box.innerHTML = ''; box.hidden = true; if (!api) return;
    (api.ctls || []).forEach((c, gi) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-g="${gi}" data-k="${k}" aria-pressed="${c.get() === k}">${t}</button>`).join('');
      box.appendChild(row); box.hidden = false;
    });
  }
  function syncCtl() { (api?.ctls || []).forEach((c, gi) => { $('ctl').querySelectorAll(`button[data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(c.get() === +b.dataset.k))); }); }
  function go(i, p0 = 0) {
    cur = (i + SCENES.length) % SCENES.length; showInfo(cur);
    if (api?.dispose) api.dispose();
    L.clear(root); LABS = []; PICKS = []; HELP = []; lastCap = null; showInsets(false); showCode(null);
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
  if (qs.get('debug')) console.log('MUNDODBG ' + JSON.stringify({ cov: VIEWSETS.map(coverage), IOU_INIT, IOU_R1, IOU_FIT, IOU_HELD, fits: Object.fromEntries(FIT_IDS.map(id => [id, [FITS[id][0].f, FITS[id][FITS[id].length - 1].f, FITS[id][FITS[id].length - 1].b]])), views: OBJ.map((o, oi) => [o.id, CAMS.map((_, ci) => { const t = bbox2({ c: o.c, s: o.s, yaw: 0 }, ci); return t ? 1 : 0; }).join('')]) }));
  window.__mundoDebug = { coverage: VIEWSETS.map(coverage), IOU_INIT, IOU_R1, IOU_FIT, IOU_HELD, FITS, simPush, simBalls, simBag, astar, get cap() { return $('cap').textContent; } };
})();
