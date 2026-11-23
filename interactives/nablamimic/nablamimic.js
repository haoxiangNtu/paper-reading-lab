'use strict';
/* ∇Mimic / NablaEngine (arXiv 2610.41654) taken apart into eleven animated scenes. Numbers come from the paper (arXiv v1)
   and the official code (OamIcs/NablaMimic bfbb2a6, Apache-2.0; only file names, lines and config keys are quoted).
   Each scene's update(p) is a pure function of the timeline p plus the current toggles. Scenes 2, 3, 6 and 7 compute small
   toy problems live; scenes 5 and 10 plot Figures 2(b), 1(a) and 5(a) as read from the paper's vector paths. The humanoid
   is hand-made. No ∇Mimic policy runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { fwd: 0xdfe6f3, dim: 0x5d6884, dim2: 0x9aa6bf, sim: 0x4fc98a, clip: 0x38d1ff, grad: 0xf0963c, pol: 0x9d8cff, critic: 0x3aa8e0,
    zo: 0x6fa8ff, ok: 0x4fc98a, bad: 0xe05d5d, p999: 0x3fbf8f, ref: 0xe0607a, lrn: 0x3aa8e0, kin: 0x3aa8e0, solve: 0x9d8cff, tape: 0xf2c14e, gold: 0xf2c14e, robot: 0xc9d4ea };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  /* vector read-outs: Fig. 1(a) (PDF p.2; hours, return), Fig. 2(b) (PDF p.6; updates, log10 of value / median, 20-update bins),
     Fig. 5(a) (PDF p.12; policy updates, return) */
  const F1A = {nm:[[0.027,0.248],[0.054,0.531],[0.08,0.656],[0.133,0.702],[0.159,0.754],[0.186,0.737],[0.213,0.755],[0.239,0.784],[0.266,0.777],[0.288,0.779],[0.313,0.762],[0.315,0.762],[0.319,0.77],[0.341,0.82],[0.346,0.821],[0.367,0.804],[0.373,0.806],[0.393,0.818],[0.419,0.818],[0.426,0.815],[0.445,0.793],[0.452,0.793],[0.479,0.811],[0.505,0.827],[0.532,0.837],[0.558,0.84],[0.577,0.843],[0.584,0.843],[0.611,0.838],[0.629,0.843],[0.637,0.842],[0.656,0.837],[0.677,0.841],[0.682,0.842],[0.703,0.841],[0.716,0.841],[0.735,0.842],[0.761,0.851],[0.781,0.851],[0.796,0.847],[0.807,0.843],[0.814,0.843],[0.822,0.843],[0.833,0.846],[0.84,0.844],[0.848,0.845],[0.859,0.843],[0.875,0.849],[0.885,0.852],[0.911,0.853],[0.927,0.854],[0.953,0.856],[0.989,0.854],[0.998,0.854],[1.269,0.864],[1.375,0.869],[1.584,0.869],[1.69,0.873],[1.794,0.874],[1.899,0.875],[2.004,0.872],[2.214,0.872],[2.319,0.874],[2.424,0.871],[2.529,0.873],[2.634,0.875],[2.739,0.874],[2.844,0.873],[2.949,0.875],[3.06,0.875]],
   ppo:[[0.0,0.002],[0.033,0.007],[0.067,0.092],[0.1,0.182],[0.133,0.155],[0.167,0.193],[0.2,0.308],[0.233,0.26],[0.267,0.317],[0.3,0.388],[0.333,0.385],[0.367,0.445],[0.4,0.403],[0.433,0.471],[0.467,0.509],[0.5,0.465],[0.533,0.502],[0.567,0.488],[0.6,0.508],[0.633,0.541],[0.667,0.494],[0.7,0.525],[0.733,0.508],[0.767,0.542],[0.8,0.527],[0.833,0.541],[0.867,0.532],[0.9,0.53],[0.933,0.528],[0.967,0.524],[1.0,0.529],[1.25,0.575],[1.5,0.591],[1.75,0.649],[2.0,0.641],[2.25,0.643],[2.5,0.643],[2.75,0.647],[3.0,0.638],[3.25,0.721],[3.5,0.698],[3.75,0.662],[4.0,0.691],[4.25,0.655],[4.5,0.707],[4.75,0.711],[5.0,0.706],[5.25,0.724],[5.5,0.73],[5.75,0.751],[6.0,0.695]]};
  const F2B = {mx:[[10,2.58],[30,6.69],[50,6.91],[70,3.38],[90,2.52],[110,2.58],[130,3.66],[150,3.13],[170,3.03],[190,2.75],[210,2.31],[230,3.2],[250,2.98],[270,3.84],[290,6.93],[310,4.97],[330,5.91],[350,4.81],[370,3.17],[390,3.73],[410,2.98],[430,2.64],[450,2.65],[470,6.18],[490,2.63],[510,2.88],[530,4.94],[550,3.2],[570,3.21],[590,2.8],[610,2.48],[630,3.18],[650,2.46],[670,3.01],[690,3.32],[710,3.19],[730,3.69],[750,3.59],[770,4.3],[790,3.94],[810,4.45],[830,4.36],[850,3.59],[870,3.81],[890,3.25],[910,5.9],[930,3.48],[950,3.67],[970,4.46],[990,4.02],[1010,3.6],[1030,6.75],[1050,5.7],[1070,3.57],[1090,3.46],[1110,4.23],[1130,3.54],[1150,3.52],[1170,3.77],[1190,3.68],[1210,4.46],[1230,4.19],[1250,3.84],[1270,3.82],[1290,6.64],[1310,3.61],[1330,4.0],[1350,3.53],[1370,3.48],[1390,8.01],[1410,9.34]],
   p999:[[10,1.15],[30,1.23],[50,1.11],[70,1.12],[90,1.24],[110,1.28],[130,1.32],[150,1.31],[170,1.29],[190,1.29],[210,1.26],[230,1.22],[250,1.28],[270,1.28],[290,1.26],[310,1.26],[330,1.22],[350,1.24],[370,1.21],[390,1.29],[410,1.33],[430,1.38],[450,1.28],[470,1.3],[490,1.37],[510,1.39],[530,1.39],[550,1.4],[570,1.41],[590,1.41],[610,1.36],[630,1.41],[650,1.38],[670,1.41],[690,1.42],[710,1.48],[730,1.49],[750,1.49],[770,1.48],[790,1.5],[810,1.51],[830,1.69],[850,1.52],[870,1.53],[890,1.56],[910,1.57],[930,1.6],[950,1.63],[970,1.59],[990,1.59],[1010,1.61],[1030,1.65],[1050,1.65],[1070,1.66],[1090,1.65],[1110,1.8],[1130,1.69],[1150,1.69],[1170,1.72],[1190,1.64],[1210,1.73],[1230,1.72],[1250,1.69],[1270,1.71],[1290,1.69],[1310,1.76],[1330,1.72],[1350,1.76],[1370,1.81],[1390,1.72],[1410,1.8]]};
  const F5A = {ne:[[250,0.344],[500,0.333],[750,0.54],[1000,0.589],[1250,0.68],[1500,0.665],[1750,0.714],[2000,0.753],[2250,0.759],[2500,0.771],[2750,0.78],[3000,0.801],[3250,0.781],[3500,0.806],[3750,0.812],[4000,0.815],[4250,0.803],[4500,0.815],[4750,0.821],[5000,0.82],[5250,0.825],[5500,0.827],[5750,0.82],[6000,0.81],[6250,0.826],[6500,0.828],[6750,0.825],[7000,0.835],[7250,0.837],[7500,0.834],[7750,0.836],[7999,0.832],[8250,0.836],[8500,0.839],[8750,0.841],[9000,0.84],[9250,0.844],[9500,0.845],[10000,0.846],[11000,0.849],[12000,0.854],[13000,0.856],[13999,0.853],[14999,0.86],[16000,0.86],[16999,0.863],[17999,0.862],[18999,0.861],[19999,0.863],[21000,0.862],[21998,0.861],[22998,0.863],[23998,0.861],[25000,0.861],[25998,0.863],[27000,0.862],[28000,0.864],[28999,0.866]],
   mjw:[[250,0.28],[500,0.371],[750,0.564],[1000,0.627],[1250,0.684],[1500,0.668],[1750,0.716],[2000,0.768],[3000,0.783],[4000,0.783],[5000,0.823],[6000,0.826]]};

  const SCENES = [
    { n: 1, part: '总览', title: '∇Mimic 一次更新：收集、64 步窗口、逐样本裁剪、动作目标、8 步回归、评论家', sub: '算法 1 的 3D 版。方块可以点', dur: 14, cam: [0.0, 1.2, 17, [0.2, 2.0, 0]],
      html: dl([['收集器', '只前向：当前策略加噪声 0.1 推进 4096 个环境，状态写进回放（1000 × 4096）'], ['BPTT 窗口', '每次更新从回放抽 4096 个起点，在 NablaEngine 上滚 64 步，带磁带'], ['反向', '解析伴随逐步往回传；每一步把每个样本的动作余切裁到批中位数的 3 倍（式 4）'], ['动作目标', 'y = a + δ g / RMS(g)，δ = 0.03 rad（式 5）'], ['回归', '单独的 Adam，8 步，每步 16,384 个 (o, y) 对'], ['评论家', 'TD(λ)，为窗口末端的 γ<sup>64</sup> V(s<sub>64</sub>) 自举']]) +
        '<p>和 SHAC、SuperMimic 共用的部分：短窗口加评论家、从回放取窗口起点、按回报分箱的重置。∇Mimic 自己的部分只有两件：逐样本中位数裁剪，以及多步回归到动作目标。</p>' +
        guess('方块和箭头是示意，数字来自表 10 和 configs/base/ours_v1.args。') + src('§5 · 算法 1 · 表 10') },
    { n: 2, part: '§3 零阶 vs 一阶', title: '零阶只看 J 的数值，一阶直接拿到 ∂J/∂a', sub: '二维玩具当场算：PPO 式估计 24 次（蓝）对解析梯度（橙）；切换每次的样本数 N', dur: 13, cam: [0.3, 0.95, 11, [1.5, 1.0, -0.5]],
      html: dl([['零阶（PPO）', '把仿真器当黑箱，只拿标量回报，用似然比估计梯度；方差随 1/√N 下降'], ['一阶（本文）', '式 (1) 的路径梯度：穿过 f 反传，每个样本都给出方向和大小'], ['代价', '一阶要仿真器的导数，要算伴随；接触处导数可能无界（第 4 幕）'], ['§7.2', '同一引擎上 PPO 每次迭代 0.123 s，比 MuJoCo Warp 快 2.9 倍，6 h 仍只到 0.695']]) +
        '<p>作者的说法：便宜的样本补不上差距，梯度才行。这一幕只说明“同样的 N，两种估计差多少”，不说明哪种在墙钟上更快。</p>' +
        toyb('J(a) = −‖a − a*‖²，a* = (1, 0.5)，在 a = 0 处估计梯度（真值 (2, 1)）。零阶：N 个 σ = 0.3 的高斯扰动，均值基线，似然比估计，重复 24 次。当场算，固定种子。') + src('§1 · §3 式 (1) · §7.2') },
    { n: 3, part: '式 (1) 窗口', title: '64 步窗口：前向带磁带，余切沿时间倒着传，末端交给评论家', sub: '白色前向，橙色反向；下方柱子是“尾巴随反传步数长”的玩具。切换 H', dur: 15, cam: [0.0, 1.22, 17, [0.0, 1.6, 0]],
      html: dl([['目标', 'J = Σ<sub>t&lt;H</sub> γ<sup>t</sup> r<sub>t</sub> + γ<sup>H</sup> V(s<sub>H</sub>)，H = 64（1.28 s）'], ['反向', '每一步：余切穿过 f 的伴随，在动作处分出一支流进策略'], ['尾巴', '图 3：99.9 分位和最大值都随反传步数长，中位数不动'], ['H = 32', '表 2：回报 −0.036（相同墙钟）、−0.043（相同更新数）'], ['评论家', '作者把 H = 64 更好归因于少依赖评论家，但没有直接测评论家误差']]) +
        '<p>§4.2 的权衡：窗口越长，梯度够得越远，越少靠有偏的评论家；但尾巴越长。跟踪奖励稠密，所以这里长窗口更好；奖励稀疏的任务作者说一阶方法“可能不划算”。</p>' +
        toyb('柱子：2048 个样本，每反传一步乘一个对数正态因子（σ = 0.25），每步以 0.3% 的概率再乘 10 到 1000 倍（“接触事件”）。画累计后最大值和 99.9 分位各自除以中位数的 log₁₀。当场算，固定种子。') + src('§3 式 (1) · §4.2 · 图 3 · §5.4') },
    { n: 4, part: '§4 · 附录 B', title: '接触处的导数可以是无穷：双脚快碰上、两根胶囊快平行', sub: '左边两只脚靠近，右边是导数的增长；切换两种事件', dur: 14, cam: [0.0, 1.25, 15, [-0.2, 1.8, 0]],
      html: dl([['自接触', '法向 n = v/|v| 的导数按 1/d 增长；训练窗口上梯度最多放大 4.9 × 10<sup>21</sup> 倍，32 行非有限'], ['近平行胶囊', '最近点按 1/sin²θ 病态；一步最多放大 3.6 × 10<sup>8</sup> 倍，172 个状态里 40 个溢出'], ['NablaEngine 训练默认', '核心距离 &lt; 1 mm 冻结法向导数；夹角 &lt; 约 2° 固定线段参数'], ['冻结后', '24 个窗口只剩 1 个放大超过 10<sup>6</sup>（最多 2.2 × 10<sup>6</sup>）；交叉脚最多 109 倍，没有溢出'], ['其余事件', '接触开关、执行器饱和等只让导数跳变，不发散']]) +
        '<p>这是“精确梯度”的第一个代价。远离这两种事件时，训练梯度和精确梯度逐位相同。代码里 NablaEngine 用 normal = 3；MuJoCo Warp 后端用补丁 0001（MJW_ADJ_NORMAL=3）和 0002（MJW_ADJ_PARALLEL=1）实现同样的规则。</p>' +
        guess('曲线只画 1/d 和 1/sin²θ 的形状，纵轴没有单位；脚的几何是示意。') + src('§4 · §6 · 附录 B · patches/mujoco_warp/0001、0002') },
    { n: 5, part: '§4.1 SHAC', title: 'SHAC 的爆炸只在一个样本上：全局裁剪救不了', sub: '上：图 2(b) 读数；下：40 个样本的玩具批次。切换裁剪方式', dur: 15, cam: [0.0, 1.2, 16, [0.0, 2.2, 0]],
      html: dl([['图 2(b)', '中位数、99.9 分位一路平稳，只有最大值跳；第 1403 次更新最大值是中位数的 2.2 × 10<sup>9</sup> 倍'], ['原版守卫', '全局范数 &gt; 10<sup>6</sup> 就停机：3 个种子 0.06 h 内停下，回报 0.373'], ['全局裁剪', '一个巨大样本把整批缩放到几乎为零'], ['逐样本裁剪', '只把那一个样本压到 3 × 中位数，其余不动'], ['改过的守卫', '跳过非有限更新 + 逐元素 0.1：3 h 到 0.816，仍没到 0.82']]) +
        '<p>插桩的三次运行，停机那次的最大样本是中位数的 2.2 × 10<sup>9</sup> 到 1.8 × 10<sup>10</sup> 倍；什么时候出现是随机的（326 到 8361 次更新）。</p>' +
        toyb('下面 40 根柱子：39 个对数正态样本加 1 个 2.2 × 10⁹ 倍中位数的样本；柱高按 log₁₀（相对中位数）画，低于 10⁻³ 的画成贴地。') + src('§4.1 · 图 2 · 附录 F · 表 11') },
    { n: 6, part: '式 (4)', title: '逐样本、按中位数裁剪：阈值跟着批次走，不切断反向链', sub: '64 个样本的玩具批次当场裁；切换 κ', dur: 13, cam: [0.0, 1.25, 18, [0.3, 1.8, 0]],
      html: dl([['式 (4)', 'g<sub>i</sub> ← g<sub>i</sub> · min(1, κ · median<sub>j</sub>‖g<sub>j</sub>‖ / ‖g<sub>i</sub>‖)，κ = 3'], ['在哪裁', '反向的每一步，余切流进策略和更早状态之前；窗口动作梯度上再裁一次'], ['为什么用中位数', '爆炸挪不动它：图 2(b) 里中位数一直平稳'], ['裁到多少', '论文：每次更新碰到 9% 到 21% 的样本'], ['不裁会怎样', '绝对动作 3 个种子 1 个发散，其余 0.562（对照 0.855）；残差动作 3 个全发散']]) +
        '<p>代码：nets.py 的 clip_rows_to_median 是一个 custom_vjp 恒等函数，前向不变，反向按行裁；中位数只在“有梯度的行”上取，回合结束后被掩掉的全零行不算。</p>' +
        '<p>作者也写明：被裁的样本梯度有偏，偏差没有量化；这是拿偏差换稳定。</p>' +
        toyb('64 个样本，范数取对数正态（σ = 1.1）再放进两个 50 倍和 2000 倍的离群点，固定种子；柱高按 log₁₀ 画。比例是当场算的，和论文的 9–21% 不是同一个分布。') + src('§5.1 · 式 (4) · 表 13、表 14 · 代码 nets.py 第 114–142 行') },
    { n: 7, part: '式 (5)(6)', title: '动作目标：步长按弧度固定；裁剪保证没有样本独占这个预算', sub: '两个关节平面上的玩具批次；切换裁剪开关', dur: 15, cam: [0.0, 1.05, 16.5, [-1.0, 1.6, 0]],
      html: dl([['式 (5)', 'y<sub>t</sub> = a<sub>t</sub> + δ g<sub>t</sub> / RMS(g)：整批设定点的 RMS 变化正好是 δ'], ['式 (6) 的界', '有裁剪：每个样本逐关节 RMS 变化 ≤ √2 κ δ = 0.127 rad（δ = 0.03）'], ['不裁剪', '一个巨大样本的目标移动约 δ√N = 0.03 × √262,144 ≈ 15.4 rad，其余几乎不动'], ['回归', '单独的 Adam 在 ‖π(o) − y‖² 上走 8 步；到了 y 就不再拉'], ['实际', '一次更新后典型环境的设定点只变 0.002 到 0.01 rad，整个训练最大 0.11 rad']]) +
        '<p>只回归一步、学习率匹配时，这就退化成普通梯度步（PODS 式 10）。去掉多步回归（每个窗口一步 Adam）：绝对动作 −0.049，残差动作 −0.044（表 2）。</p>' +
        toyb('d = 2 个关节、N = 200 个样本，梯度方向随机、范数重尾，再放一个 10⁴ 倍的离群点；按式 (5) 当场算目标。箭头长度按显示比例放大。“回归”阶段每个点按 1 − 0.7<sup>m</sup> 向目标靠，只为示意。') + src('§5.2 · §5.3 · 式 (5)(6) · 表 10') },
    { n: 8, part: '§6 NablaEngine', title: '一个世界一个 warp：前向 8 个内核，伴随 1 个大内核', sub: '左：一个控制步的内核；右：表 3 的耗时。切换 GPU', dur: 14, cam: [0.0, 1.18, 18.5, [-0.2, 2.5, 0]],
      html: dl([['映射', '一个世界 = 一个 32 线程的 warp；状态在共享内存和寄存器里'], ['前向', '每子步 2 个融合内核 × 4 子步 = 8 个内核；第一个算运动学、碰撞、约束行，第二个做牛顿求解和积分'], ['磁带', '每世界每子步 1,472 个 float32 → 每控制步 23.6 kB，4096 世界 96.5 MB'], ['伴随', '一个内核：读磁带，倒着算完 4 个子步；约束求解用隐函数定理（式 7–10）'], ['精度', '对 float64 有限差分的中位相对误差：位置 3.6e-5、速度 1.0e-5、动作 1.9e-6']]) +
        '<p>伴随只比再走一步前向多 0.57 ms（1.78 对 1.21 ms）。“11.5 倍”是对 MuJoCo Warp 伴随 PR 的引擎微基准；训练里同算法换引擎是每次更新 4.4 倍。</p>' +
        guess('内核和线程方块是示意；数字来自 §6、附录 B、表 3。') + src('§6 · 附录 B · 表 3、表 6') },
    { n: 9, part: '并行与吞吐', title: '4096 个窗口同时跑：每次更新 27 万个仿真步', sub: '左：4096 个世界；右：表 15 的吞吐', dur: 13, cam: [0.0, 1.1, 19, [-0.2, 2.6, 0]],
      html: dl([['每次更新', '4096 × 64 = 262,144 个可微窗口步 + 4096 / 0.4 = 10,240 个收集器步'], ['∇Mimic', '0.374 s / 次，72.9 万步/秒，每小时 9,503 次更新'], ['SHAC', '0.196 s / 次（4096 × 32，无收集器）'], ['PPO', '0.126 s / 次迭代（4096 × 24，只前向）'], ['MuJoCo Warp 后端', '1.633 s / 次，16.7 万步/秒']]) +
        '<p>“每秒 18.8 小时机器人运动”是只算前向的引擎吞吐：4096 / 1.21 ms × 0.02 s。训练时实际约 72.9 万 × 0.02 s ≈ 每秒 4.05 小时。</p>' +
        guess('小方块只表示数量。') + src('§6 · 表 12 · 表 15') },
    { n: 10, part: '§7 结果', title: '训练曲线：20 分钟第一次过 0.82；按更新次数两个引擎重合', sub: '切换图 1(a)（墙钟）/ 图 5(a)（更新次数）', dur: 15, cam: [0.0, 1.32, 15, [0.0, 2.0, 0]],
      html: dl([['图 1(a)', '∇Mimic 0.34 h 第一次过 0.82，1.8 h 到 0.874；PPO（BeyondMimic 配置）6 h 0.695'], ['越线之后', '矢量读数：0.367 h 回落到 0.804，0.445 h 低到 0.793，约 0.5 h 起稳定在线上'], ['SuperMimic', '自报一张 H100 上 1.2 h 以内（不同 GPU，上界）'], ['图 5(a)', '绝对动作版：NablaEngine 约 4,650 次、MuJoCo Warp 约 4,918 次到 0.82'], ['图 5(b)', '按小时 NablaEngine 快 4.7 倍：引擎改变速度，不改变学习']]) +
        '<p>“20 分钟对 1.2 小时”约 3.5 倍，但跨 GPU；同为 H100 时绝对动作版 0.41 h，约 2.9 倍。精读页读者注 1、2 有完整的算式。</p>' +
        src('图 1(a)（PDF 第 2 页）、图 5(a)（第 12 页）矢量读数 · 表 4 · 表 12') },
    { n: 11, part: '评测 · §8', title: '评测：40 段在 MuJoCo Warp 上各播一次；没有真机', sub: '切换方法看摔倒片段数（表 4）', dur: 13, cam: [0.0, 1.22, 15, [0.4, 1.6, 0]],
      html: dl([['规程', '每段从第一帧起，确定性均值动作，MuJoCo Warp 前向，无随机化、无噪声'], ['分数', '整段奖励和 / 最大值，摔倒后剩下的部分记 0，40 段平均'], ['∇Mimic', '3 h 0.875 ± 0.001，0 段摔倒；1.47 h 起没有种子摔倒'], ['PPO', 'BeyondMimic 配置 6 h 8 段摔倒；SuperMimic 演员 3 段'], ['SHAC', '原版守卫 23 段；改过的守卫 2 段']]) +
        '<p>训练在 NablaEngine，评测在 MuJoCo Warp：两套独立实现的同一 MuJoCo 动力学，算一次“仿真到仿真”检验。§8 明说还没有在真机上部署，仓库里也没有部署代码。</p>' +
        guess('小人是手做的示意；40 个格子里哪几段摔倒是随便放的，只有个数来自表 4。') + src('§7 · 表 4 · 附录 G · §8') }
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

  /* ---------- toy problems (pure functions of fixed seeds) ---------- */
  /* scene 2: zeroth-order (likelihood-ratio) vs first-order gradient of J(a) = -|a - a*|^2 at a = 0 */
  const ASTAR = [1, 0.5], GTRUE = [2 * ASTAR[0], 2 * ASTAR[1]];
  function zoEstimates(N, reps = 24, sig = 0.3) {
    const r = L.rng(17 + N), out = [];
    for (let k = 0; k < reps; k++) {
      const E = [], J = [];
      for (let i = 0; i < N; i++) { const e = [L.gauss(r), L.gauss(r)]; E.push(e); J.push(-(Math.pow(sig * e[0] - ASTAR[0], 2) + Math.pow(sig * e[1] - ASTAR[1], 2))); }
      const b = J.reduce((a, x) => a + x, 0) / N; let g0 = 0, g1 = 0;
      for (let i = 0; i < N; i++) { g0 += (J[i] - b) * E[i][0] / sig; g1 += (J[i] - b) * E[i][1] / sig; }
      out.push([g0 / N, g1 / N]);
    }
    const cos = out.map(g => (g[0] * GTRUE[0] + g[1] * GTRUE[1]) / (Math.hypot(...g) * Math.hypot(...GTRUE) + 1e-12));
    const err = out.map(g => Math.hypot(g[0] - GTRUE[0], g[1] - GTRUE[1]) / Math.hypot(...GTRUE));
    return { g: out, cos: cos.reduce((a, x) => a + x, 0) / reps, minCos: Math.min(...cos), err: err.reduce((a, x) => a + x, 0) / reps };
  }
  const NS = [4, 64, 1024], ZO = NS.map(N => zoEstimates(N));
  /* scene 3: tail growth of a cotangent batch when backpropagated through t steps (toy) */
  function tailToy(H, n = 2048) {
    const r = L.rng(29), v = new Float64Array(n).fill(0), out = [];
    for (let t = 0; t < H; t++) {
      for (let i = 0; i < n; i++) { v[i] += 0.25 * L.gauss(r) / Math.LN10; if (r() < 0.003) v[i] += 1 + 2 * r(); }
      const s = Array.from(v).sort((a, b) => a - b), med = s[n >> 1];
      out.push({ max: s[n - 1] - med, p999: s[Math.floor(0.999 * (n - 1))] - med });
    }
    return out;
  }
  const TAIL = tailToy(64);
  /* scene 6: per-sample clipping of a toy batch */
  const BATCH6 = (function () { const r = L.rng(41), a = []; for (let i = 0; i < 64; i++) a.push(Math.exp(1.1 * L.gauss(r))); a[17] = 50; a[44] = 2000; return a; })();
  const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[n >> 1] : 0.5 * (s[n / 2 - 1] + s[n / 2]); };
  function clip6(kappa) { const m = median(BATCH6), thr = kappa * m; const out = BATCH6.map(x => Math.min(x, thr)); return { m, thr, out, frac: BATCH6.filter(x => x > thr).length / BATCH6.length }; }
  /* scene 7: action targets with and without clipping, d = 2, N = 200 */
  const T7 = (function () {
    const r = L.rng(53), N = 200, a = [], g = [];
    for (let i = 0; i < N; i++) { a.push([1.6 * L.gauss(r) * 0.5, 1.6 * L.gauss(r) * 0.5]); const th = 2 * Math.PI * r(), m = Math.exp(0.8 * L.gauss(r)); g.push([m * Math.cos(th), m * Math.sin(th)]); }
    g[0] = [1e4 * 0.8, 1e4 * 0.6];
    function targets(clip) {
      let G = g.map(v => v.slice());
      if (clip) { const ns = G.map(v => Math.hypot(...v)), thr = 3 * median(ns); G = G.map((v, i) => { const s = Math.min(1, thr / ns[i]); return [v[0] * s, v[1] * s]; }); }
      let ss = 0; G.forEach(v => { ss += v[0] * v[0] + v[1] * v[1]; }); const rms = Math.sqrt(ss / (N * 2));
      const step = G.map(v => [v[0] / rms, v[1] / rms]); /* in units of delta */
      const per = step.map(v => Math.hypot(...v) / Math.sqrt(2));
      return { step, maxPer: Math.max(...per), medPer: median(per), others: Math.max(...per.slice(1)) };
    }
    return { a, on: targets(true), off: targets(false), N };
  })();

  /* ---------- 3D helpers (same pattern as interactives/diffmimic and interactives/latent) ---------- */
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
  function dynLab2(G, o = {}) {
    const st = { s: null, t: null };
    return (t, pos) => { if (t !== st.t) { if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; st.s = lab(t, pos, o); G.add(st.s); } else st.s.position.set(...pos); };
  }
  function dynLab(G, pos, o = {}) {
    const st = { s: null, t: null };
    return t => { if (t === st.t) return; if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; st.s = lab(t, pos, o); G.add(st.s); };
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
    m.userData.set = pts => { const k = Math.min(n, pts.length); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, Math.max(0, k - 1))] || [0, 0, 0], z = q[2] ?? 0; pos[i * 6] = q[0]; pos[i * 6 + 1] = q[1] - w / 2; pos[i * 6 + 2] = z; pos[i * 6 + 3] = q[0]; pos[i * 6 + 4] = q[1] + w / 2; pos[i * 6 + 5] = z; } g.attributes.position.needsUpdate = true; };
    return m;
  }
  function panel(G, x, y, z, w, h, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: o.color ?? 0x0c1220, transparent: true, opacity: o.opacity ?? 0.55, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }
  function bar(G, color, x, w, base = 0, z = 0, o = {}) { const b = block(w, 1, o.d ?? w, color, [x, base + 0.5, z], o); G.add(b); return h => { const hh = Math.max(0.02, h); b.scale.y = hh; b.position.y = base + hh / 2; }; }
  /* hbar: horizontal bar growing to the right from x0 */
  function hbar(G, color, x0, y, h, z = 0) { const b = block(1, h, h, color, [x0 + 0.5, y, z]); G.add(b); return w => { const ww = Math.max(0.02, w); b.scale.x = ww; b.position.x = x0 + ww / 2; }; }
  /* 2D chart on a back panel: returns a mapper [x, y] -> [X, Y, z] */
  function chart(G, o) {
    const { x0, y0, w, h, xmin, xmax, ymin, ymax, z = 0 } = o, lx = !!o.logx;
    const fx = v => x0 + w * (lx ? (Math.log10(v) - Math.log10(xmin)) / (Math.log10(xmax) - Math.log10(xmin)) : (v - xmin) / (xmax - xmin));
    const fy = v => y0 + h * (clamp(v, ymin, ymax) - ymin) / (ymax - ymin);
    panel(G, x0 - 0.5, y0 - 0.75, z - 0.05, w + 0.9, h + 1.25);
    (o.yt || []).forEach(([v, t]) => { wire(G, [[x0, fy(v), z], [x0 + w, fy(v), z]], 0x5a6680, { opacity: 0.4 }); G.add(lab(t, [x0 - 0.3, fy(v), z], { size: 12 })); });
    (o.xt || []).forEach(([v, t]) => { wire(G, [[fx(v), y0 - 0.1, z], [fx(v), y0, z]], 0x9aa6bf, { opacity: 0.7 }); G.add(lab(t, [fx(v), y0 - 0.36, z], { size: 12 })); });
    if (o.xlab) G.add(lab(o.xlab, [x0 + w / 2, y0 - 0.78, z], { size: 13 }));
    if (o.ylab) G.add(lab(o.ylab, [x0 + Math.min(w / 2, 3.2), y0 + h + 0.32, z], { size: 13 }));
    return (x, y) => [fx(x), fy(y), z + 0.02];
  }

  /* ---------- hand-made humanoid (same as interactives/diffmimic) ---------- */
  function robot(color, o = {}) {
    const m = L.mat(color, { opacity: o.opacity, roughness: 0.5, depthWrite: o.opacity == null || o.opacity > 0.6 });
    const G = new THREE.Group(), mesh = g => new THREE.Mesh(g, m);
    const limb = (len, r) => { const g = new THREE.Group(), c = mesh(new THREE.CylinderGeometry(r, r * 0.82, len, 8)); c.position.y = -len / 2; g.add(c); g.add(mesh(new THREE.SphereGeometry(r, 8, 6))); return g; };
    const body = new THREE.Group(); G.add(body);
    const pelvis = new THREE.Group(); body.add(pelvis);
    pelvis.add(mesh(new THREE.BoxGeometry(0.26, 0.1, 0.14)));
    const upper = new THREE.Group(); pelvis.add(upper);
    const tor = mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.36, 10)); tor.position.y = 0.2; upper.add(tor);
    const head = mesh(new THREE.SphereGeometry(0.085, 12, 9)); head.position.y = 0.48; upper.add(head);
    const arms = [-1, 1].map(s => { const up = limb(0.2, 0.034); up.position.set(s * 0.18, 0.34, 0); const lo = limb(0.2, 0.028); lo.position.y = -0.2; up.add(lo); upper.add(up); return { up, lo, s }; });
    const legs = [-1, 1].map(s => { const th = limb(0.3, 0.05); th.position.set(s * 0.09, -0.04, 0); const sh = limb(0.3, 0.042); sh.position.y = -0.3; th.add(sh); const ft = mesh(new THREE.BoxGeometry(0.08, 0.035, 0.21)); ft.position.set(0, -0.31, 0.04); sh.add(ft); pelvis.add(th); return { th, sh }; });
    G.userData.set = q => {
      body.position.y = q.y ?? 0.62; body.rotation.set(q.pitch || 0, 0, 0); upper.rotation.x = q.lean || 0;
      legs[0].th.rotation.x = -(q.hL ?? 0.1); legs[1].th.rotation.x = -(q.hR ?? 0.1); legs[0].sh.rotation.x = q.kL ?? 0.15; legs[1].sh.rotation.x = q.kR ?? 0.15;
      arms.forEach((a, i) => { a.up.rotation.x = -(q.sh ?? 0.2) + (i ? -1 : 1) * (q.swing || 0); a.up.rotation.z = a.s * (q.abd ?? 0.12); a.lo.rotation.x = -(q.el ?? 0.3); });
    };
    return G;
  }
  function place(r, q, at, yaw = 0, sc = 1) { r.userData.set(q); r.position.set(...at); r.rotation.y = yaw; r.scale.setScalar(sc); }
  function dance(t) { /* hand-written step-and-swing loop */
    const w = 2 * Math.PI * t, s = Math.sin(w), c = Math.cos(w), up = Math.max(0, Math.sin(2 * w));
    return { y: 0.6 - 0.04 * up, hL: 0.15 + 0.45 * Math.max(0, s), hR: 0.15 + 0.45 * Math.max(0, -s), kL: 0.2 + 0.7 * Math.max(0, s), kR: 0.2 + 0.7 * Math.max(0, -s), lean: 0.12 * c, sh: 0.4 + 0.5 * up, swing: 0.6 * s, abd: 0.3 + 0.25 * up, el: 0.6 };
  }

  function buildCtl() {
    const box = $('ctl'); box.innerHTML = ''; box.hidden = true; if (!api) return;
    (api.ctls || []).forEach((c, gi) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-g="${gi}" data-k="${k}" aria-pressed="${c.get() === k}">${t}</button>`).join('');
      box.appendChild(row); box.hidden = false;
    });
  }
  function syncCtl() { (api?.ctls || []).forEach((c, gi) => { $('ctl').querySelectorAll(`button[data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(c.get() === +b.dataset.k))); }); }

  /* ---------- scene 1: overview (Algorithm 1) ---------- */
  function s1(G) {
    const Y1 = 3.4, Y0 = 0.6;
    const B = {
      col: block(1.7, 0.9, 0.9, COL.fwd, [-6.2, Y1, 0]), rep: block(1.5, 0.9, 0.9, COL.dim, [-3.6, Y1, 0]),
      win: block(2.6, 1.1, 1.1, COL.sim, [-0.4, Y1, 0]), clip: block(1.5, 0.9, 0.9, COL.clip, [2.8, Y1, 0]),
      tgt: block(1.5, 0.9, 0.9, COL.grad, [5.6, Y1, 0]), reg: block(1.5, 0.9, 0.9, COL.pol, [5.6, Y0, 0]),
      act: block(1.5, 0.9, 0.9, COL.pol, [-3.6, Y0, 0]), cri: block(1.5, 0.9, 0.9, COL.critic, [-0.4, Y0, 0])
    };
    Object.values(B).forEach(b => G.add(b));
    B.win.userData.go = 2; B.clip.userData.go = 5; B.tgt.userData.go = 6; B.reg.userData.go = 6; B.cri.userData.go = 2; B.col.userData.go = 8; B.rep.userData.go = 8; B.act.userData.go = 1;
    PICKS.push(...Object.values(B));
    const L1 = [['收集器\n只前向 · 噪声 0.1', B.col], ['回放\n1000 × 4096', B.rep], ['4096 个 64 步窗口\nNablaEngine · 带磁带', B.win], ['逐样本裁剪\nκ = 3 × 中位数', B.clip], ['动作目标\ny = a + δg/RMS', B.tgt], ['回归 8 步\n单独 Adam', B.reg], ['演员 π_θ\n编码器-解码器', B.act], ['评论家 V_φ\nTD(λ)', B.cri]];
    L1.forEach(([t, b], i) => G.add(lab(t, [b.position.x, b.position.y + (b.position.y > 2 ? 1.0 : -1.2), 0], { size: 13 })));
    const P = {
      a: [[-5.3, Y1, 0], [-4.35, Y1, 0]], b: [[-2.85, Y1, 0], [-1.7, Y1, 0]],
      c: [[0.9, Y1 + 0.1, 0], [2.05, Y1 + 0.1, 0]], d: [[3.55, Y1, 0], [4.85, Y1, 0]], e: [[5.6, Y1 - 0.45, 0], [5.6, Y0 + 0.45, 0]],
      f: [[4.85, Y0, 0], [-2.85, Y0, 0.0]], g: [[-3.6, Y0 + 0.45, 0], [-5.0, Y1 - 0.45, 0]], h: [[-3.0, Y0 + 0.45, 0], [-1.3, Y1 - 0.55, 0]],
      k: [[-0.4, Y1 - 0.55, 0.2], [-0.4, Y0 + 0.45, 0.2]], v: [[0.0, Y0 + 0.45, -0.2], [0.4, Y1 - 0.55, -0.2]]
    };
    Object.values(P).forEach(pts => wire(G, pts, 0x9aa6bf, { opacity: 0.35 }));
    const sF = [stream(G, 5, 0xdfe6f3, 0.07), stream(G, 5, 0xdfe6f3, 0.07)], sB = [stream(G, 5, COL.grad, 0.08), stream(G, 5, COL.grad, 0.08)];
    const sP = [stream(G, 5, COL.pol, 0.08), stream(G, 7, COL.pol, 0.07), stream(G, 4, COL.pol, 0.07), stream(G, 4, COL.pol, 0.07)], sC = [stream(G, 4, COL.critic, 0.07), stream(G, 4, COL.critic, 0.07)];
    const tl = dynLab(G, [-0.4, 5.4, 0], { size: 15, border: 'rgba(240,150,60,.7)' });
    return { update(p) {
      const ph = p < 0.25 ? 0 : p < 0.5 ? 1 : p < 0.75 ? 2 : 3, q = (p * 6) % 1;
      sF[0](P.a, q, ph === 0 ? 1 : 0); sF[1](P.b, q, ph === 0 ? 1 : 0);
      sP[2](P.g, q, ph === 0 ? 1 : 0); sP[3](P.h, q, ph === 0 || ph === 1 ? 1 : 0);
      sB[0](P.c, q, ph === 1 ? 1 : 0); sB[1](P.d, q, ph === 1 || ph === 2 ? 1 : 0);
      sP[0](P.e, q, ph === 2 ? 1 : 0); sP[1](P.f, q, ph === 2 ? 1 : 0);
      sC[0](P.k, q, ph === 3 ? 1 : 0); sC[1](P.v, q, ph === 3 ? 1 : 0);
      const on = [['col', 'rep', 'act'], ['win', 'clip'], ['tgt', 'reg', 'act'], ['cri', 'win']][ph];
      Object.entries(B).forEach(([k, b]) => glow(b, on.includes(k) ? 0.45 : 0.04));
      tl(['① 收集：只前向，状态进回放', '② 窗口：64 步前向带磁带，伴随倒着传，逐样本裁剪', '③ 目标：y = a + δ g/RMS(g)，回归 8 步', '④ 评论家：TD(λ) 拟合，为 γ⁶⁴V(s₆₄) 自举'][ph]);
      cap(['收集器用当前策略加噪声推进 4096 个环境，<b>不求导</b>；访问过的状态进回放，窗口起点从这里抽', '在 NablaEngine 上滚 64 步、存磁带；解析伴随把余切倒着传，<b>每一步</b>在动作处按中位数裁剪', '裁过的动作梯度变成步长固定（RMS 0.03 rad）的动作目标，策略用单独的 Adam 回归 8 步', '评论家在同样的窗口上用 TD(λ) 拟合，给窗口末端和超时自举。这一部分照搬 SHAC / SuperMimic'][ph]);
    } };
  }

  /* ---------- scene 2: zeroth vs first order ---------- */
  function s2(G) {
    let ni = +(OPT[0] ?? 0);
    const SC = 1.6;
    /* contours of J on the floor */
    [0.4, 0.8, 1.2, 1.6].forEach(rad => { const pts = []; for (let k = 0; k <= 48; k++) { const a = 2 * Math.PI * k / 48; pts.push([SC * (ASTAR[0] + rad * Math.cos(a)), 0.01, -SC * (ASTAR[1] + rad * Math.sin(a))]); } wire(G, pts, 0x5a6680, { opacity: 0.55 }); });
    G.add(ball(COL.ok, 0.1, [SC * ASTAR[0], 0.05, -SC * ASTAR[1]]));
    G.add(lab('a*（J 最大）', [SC * ASTAR[0] + 0.3, 0.55, -SC * ASTAR[1]], { size: 13, color: css(COL.ok) }));
    G.add(ball(0xdfe6f3, 0.08, [0, 0.05, 0]), lab('当前动作 a = 0', [-1.2, -0.1, 0.9], { size: 13 }));
    const tipE = [SC * GTRUE[0] * 0.5, 0.25, -SC * GTRUE[1] * 0.5], exact = new THREE.Group(); G.add(exact);
    exact.add(L.tube([[0, 0.25, 0], [tipE[0] * 0.86, 0.25, tipE[2] * 0.86]], COL.grad, 0.05));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 14), L.mat(COL.grad)); cone.position.set(...tipE); cone.lookAt(tipE[0] * 2, 0.25, tipE[2] * 2); cone.rotateX(Math.PI / 2); exact.add(cone);
    const arrows = Array.from({ length: 24 }, () => { const a = L.arrow([0, 0.08, 0], [1, 0.08, 0], COL.zo, { head: 0.18, headW: 0.1 }); G.add(a); return a; });
    G.add(lab('一阶：∂J/∂a（解析，一次就准）', [1.2, 1.55, 0.2], { size: 14, color: css(COL.grad) }));
    const info = dynLab(G, [4.6, 2.9, -0.8], { size: 14, border: 'rgba(80,140,230,.7)' });
    const ctls = [{ label: '零阶每次的样本数 N', items: NS.map(String), get: () => ni, set: k => { ni = k; } }];
    return { ctls, update(p) {
      const R = ZO[ni], k = Math.round(seg(p, 0.1, 0.8) * 24);
      arrows.forEach((a, i) => { a.visible = i < k; if (!a.visible) return; const g = R.g[i], len = Math.hypot(...g) * 0.5 * SC; a.setDirection(new THREE.Vector3(g[0], 0, -g[1]).normalize()); a.setLength(Math.max(0.05, Math.min(6, len)), 0.18, 0.1); });
      exact.visible = p > 0.05;
      info(`零阶，N = ${NS[ni]}：24 次估计\n平均余弦 ${R.cos.toFixed(3)}，最差 ${R.minCos.toFixed(2)}\n平均相对误差 ${(100 * R.err).toFixed(0)}%`);
      cap(ni === 0 ? '<b>N = 4</b>：蓝色箭头（PPO 式似然比估计）方向四散；粗橙色是解析梯度。零阶只用到 J 的数值' : ni === 1 ? '<b>N = 64</b>：估计收拢，但仍有偏差。误差按 1/√N 下降：样本加 16 倍，误差约降到 1/4' : '<b>N = 1024</b>：要上千个样本才接近一次解析梯度。一阶方法的代价是仿真器必须可微，且接触处导数可能无界');
    } };
  }

  /* ---------- scene 3: the 64-step window ---------- */
  function s3(G) {
    let hi = +(OPT[0] ?? 1);
    const N = 64, W = 13.2, X = t => -W / 2 + W * (t + 0.5) / N, YS = 2.4;
    const sims = [], pols = [], bars = [], bars2 = [];
    for (let t = 0; t < N; t++) {
      const b = block(0.16, 0.42, 0.42, COL.sim, [X(t), YS, 0]); G.add(b); sims.push(b);
      const q = block(0.12, 0.2, 0.2, COL.pol, [X(t), YS + 0.75, 0]); G.add(q); pols.push(q);
      bars.push(bar(G, COL.bad, X(t) - 0.04, 0.07, 0.0, 0.0)); bars2.push(bar(G, COL.p999, X(t) + 0.04, 0.07, 0.0, 0.0));
    }
    const V = block(0.6, 0.6, 0.6, COL.critic, [W / 2 + 0.7, YS, 0]); G.add(V);
    G.add(lab('V_φ(s_H)', [W / 2 + 0.7, YS + 0.65, 0], { size: 13, color: css(COL.critic) }), lab('π_θ', [-W / 2 - 0.4, YS + 0.75, 0], { size: 13, color: css(COL.pol) }), lab('f：NablaEngine 一步', [-W / 2 + 1.4, YS - 0.55, 0], { size: 13, color: css(COL.sim) }));
    G.add(lab('下：累计后 最大值 / 中位数（红）、99.9 分位 / 中位数（绿），log₁₀，玩具', [0, -0.55, 0], { size: 13 }));
    const fw = stream(G, 9, 0xdfe6f3, 0.07), bw = stream(G, 9, COL.grad, 0.085), br = stream(G, 6, COL.grad, 0.06);
    const tl = dynLab(G, [0, 4.25, 0], { size: 15, border: 'rgba(240,150,60,.7)' });
    const ctls = [{ label: '窗口长度', items: ['H = 32', 'H = 64'], get: () => hi, set: k => { hi = k; } }];
    return { ctls, update(p) {
      const H = hi ? 64 : 32, xe = X(H - 1) + 0.4;
      sims.forEach((b, t) => { b.visible = pols[t].visible = t < H; });
      V.position.x = xe + 0.5;
      const f = seg(p, 0.0, 0.4), b = seg(p, 0.48, 0.95), k = Math.floor(b * H);
      sims.forEach((m, t) => glow(m, p < 0.45 ? (t <= f * H ? 0.35 : 0.03) : (t >= H - 1 - k ? 0.25 : 0.03)));
      fw([[X(0), YS - 0.05, 0.3], [xe, YS - 0.05, 0.3]], (p * 5) % 1, p < 0.45 ? 1 : 0);
      bw([[xe + 0.5, YS + 0.05, 0.3], [X(0), YS + 0.05, 0.3]], 1 - (p * 4) % 1, p > 0.48 ? 1 : 0);
      const ti = H - 1 - Math.min(H - 1, k); br([[X(ti), YS + 0.2, 0.25], [X(ti), YS + 0.65, 0.25]], 1 - (p * 6) % 1, p > 0.48 ? 1 : 0);
      for (let t = 0; t < N; t++) {
        const back = H - 1 - t, show = t < H && p > 0.48 && back <= k;
        const d = show ? TAIL[back] : { max: 0, p999: 0 };
        bars[t](show ? 0.18 * d.max : 0); bars2[t](show ? 0.18 * d.p999 : 0);
      }
      tl(p < 0.45 ? `前向：${H} 步，每步存磁带；r_t 累加，末端 γ^${H} V(s_${H})` : `反向：已经往回传了 ${Math.min(H, k + 1)} 步；橙色竖支是流进策略的动作余切`);
      const last = TAIL[Math.min(H - 1, k)];
      cap(p < 0.45 ? '白色是前向：从回放里抽的起点出发，策略出动作，引擎走一步并写磁带' : `橙色是反向。越往前传，尾巴越长：玩具里传 ${Math.min(H, k + 1)} 步后最大值是中位数的 10^${last.max.toFixed(1)} 倍，99.9 分位 10^${last.p999.toFixed(1)} 倍；中位数不动`);
    } };
  }

  /* ---------- scene 4: unbounded contact derivatives ---------- */
  function s4(G) {
    let ev = +(OPT[0] ?? 0);
    const capsule = (color) => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.6, 14), L.mat(color)); c.rotation.z = Math.PI / 2; g.add(c); [-0.8, 0.8].forEach(x => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), L.mat(color)); s.position.x = x; g.add(s); }); return g; };
    const A = capsule(0xb8c4da), B = capsule(0x9aa6bf); G.add(A, B);
    const nrm = L.arrow([0, 0, 0], [0, 1, 0], COL.grad, { head: 0.2, headW: 0.12 }); G.add(nrm);
    const C = chart(G, { x0: 0.6, y0: 0.6, w: 5.0, h: 3.0, xmin: 0.01, xmax: 100, ymin: 0, ymax: 4, logx: true, z: 0,
      xt: [[0.01, '0.01'], [0.1, '0.1'], [1, '1'], [10, '10'], [100, '100']], yt: [[0, '1'], [2, '10²'], [4, '10⁴']], xlab: '', ylab: '导数大小（相对值，log）' });
    const xl = dynLab(G, [3.1, -0.2, 0], { size: 13 });
    const ex = ribbon(G, 80, COL.bad, 0.06), fr = ribbon(G, 80, COL.ok, 0.06);
    const shade = panel(G, 0, 0.6, 0.01, 1, 3.0, { color: COL.ok, opacity: 0.12 });
    const thrL = dynLab(G, [1.9, 0.95, 0.1], { size: 12, color: css(COL.ok) });
    const dot = ball(COL.grad, 0.09, [0, 0, 0]); G.add(dot);
    const val = dynLab(G, [-3.4, 3.7, 0], { size: 14, border: 'rgba(240,150,60,.7)' });
    const ctls = [{ label: '事件', items: ['自接触距离 d', '近平行胶囊夹角 θ'], get: () => ev, set: k => { ev = k; } }];
    return { ctls, update(p) {
      /* x axis: distance in mm (0.01..100) or angle in degrees (0.01..100, clamp 90) */
      const thr = ev ? 2 : 1, f = ev ? (x => 1 / Math.pow(Math.sin(Math.min(x, 90) * Math.PI / 180), 2)) : (x => 1 / x);
      const norm = f(100 > 90 && ev ? 90 : 100), lg = x => Math.log10(f(x) / norm);
      const xs = Array.from({ length: 80 }, (_, i) => Math.pow(10, 2 - 4 * i / 79));
      ex.userData.set(xs.map(x => C(x, lg(x))));
      fr.userData.set(xs.map(x => x >= thr ? C(x, lg(x)) : C(x, 0)).map(q => [q[0], q[1], q[2] + 0.01]));
      const x0 = C(0.01, 0)[0], xT = C(thr, 0)[0]; shade.scale.x = xT - x0; shade.position.x = (x0 + xT) / 2;
      thrL(ev ? '约 2° 以下：固定线段参数（绿）' : '1 mm 以下：法向导数冻结（绿）');
      xl(ev ? '两根胶囊轴的夹角 θ（度，log）' : '两个几何体核心距离 d（毫米，log）');
      const x = Math.pow(10, 2 - 4 * seg(p, 0.05, 0.9)), q = C(x, lg(x)); dot.position.set(q[0], q[1], 0.05);
      /* feet geometry */
      if (!ev) { const d = 0.32 + 1.4 * (Math.log10(x) + 2) / 4; A.position.set(-3.4, 1.6 + d / 2, 0); B.position.set(-3.4, 1.6 - d / 2, 0); A.rotation.set(0, 0, 0); B.rotation.set(0, 0, 0); }
      else { const th = Math.min(x, 60) * Math.PI / 180; A.position.set(-3.4, 1.95, 0); B.position.set(-3.4, 1.25, 0); A.rotation.set(0, 0, th); B.rotation.set(0, 0, 0); }
      nrm.position.set(-3.4, (A.position.y + B.position.y) / 2 - 0.25, 0.3); nrm.setLength(0.25 + 0.6 * Math.min(1, lg(x) / 4) + 0.01, 0.15, 0.09);
      const frozen = x < thr;
      val(ev ? `θ = ${x < 1 ? x.toFixed(2) : x.toFixed(1)}°：精确 ∝ 1/sin²θ = ${f(x).toExponential(1)}\n${frozen ? '训练默认：固定，不再放大' : '训练默认：= 精确'}` : `d = ${x < 1 ? x.toFixed(2) : x.toFixed(1)} mm：精确 ∝ 1/d\n${frozen ? '训练默认：法向导数取 0' : '训练默认：= 精确'}`);
      cap(ev ? '交叉脚：两根鞋底胶囊几乎平行时最近点病态，一步最多放大 <b>3.6 × 10⁸</b> 倍；固定线段参数后最多 109 倍' : '双脚快碰上：自接触法向的导数按 1/d 增长，训练窗口上梯度最多放大 <b>4.9 × 10²¹</b> 倍；1 mm 以下冻结后不再出现非有限值');
    } };
  }

  /* ---------- scene 5: SHAC explodes on one sample ---------- */
  function s5(G) {
    let mode = +(OPT[0] ?? 0);
    const C = chart(G, { x0: -6.2, y0: 2.3, w: 12.4, h: 2.6, xmin: 0, xmax: 1420, ymin: -0.5, ymax: 10, z: -0.4,
      xt: [[0, '0'], [250, '250'], [500, '500'], [750, '750'], [1000, '1000'], [1250, '1250']], yt: [[0, '1'], [3, '10³'], [6, '10⁶'], [9, '10⁹']], ylab: '相对本次中位数（图 2(b) 读数）' });
    const rm = ribbon(G, F2B.mx.length, COL.bad, 0.05), r9 = ribbon(G, F2B.p999.length, COL.p999, 0.05), r0 = ribbon(G, 2, COL.ref, 0.05);
    G.add(lab('最大值', [C(700, 4.6)[0], C(700, 4.6)[1], 0], { size: 13, color: css(COL.bad) }), lab('99.9 分位', [C(450, 2.4)[0], C(450, 2.4)[1], 0], { size: 13, color: css(COL.p999) }), lab('中位数', [C(80, 0.9)[0], C(80, 0.9)[1], 0], { size: 13, color: css(COL.ref) }));
    const halt = dynLab(G, [C(1120, 9.6)[0], C(1120, 9.6)[1] + 0.35, 0], { size: 13, color: css(COL.bad) });
    /* toy batch */
    const r = L.rng(61), vals = Array.from({ length: 40 }, () => Math.exp(1.0 * L.gauss(r))); vals[27] = 2.2e9;
    const m = median(vals), X = i => -5.6 + 11.2 * i / 39;
    const bs = vals.map((v, i) => bar(G, i === 27 ? COL.bad : COL.lrn, X(i), 0.2, -0.2, 0.6));
    const thrLine = wire(G, [[-5.9, 0, 0.6], [5.9, 0, 0.6]], COL.ok, { opacity: 0.9, dashed: true });
    const lg = v => Math.max(0, (Math.log10(v / m) + 3) * 0.17);
    const tl = dynLab(G, [0, -0.75, 0.6], { size: 14, border: 'rgba(240,150,60,.7)' });
    const ctls = [{ label: '裁剪方式', items: ['不裁', '全局范数裁剪', '逐样本 3 × 中位数'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const k = seg(p, 0.0, 0.55), xmax = 1403 * k;
      const sel = arr => arr.filter(([x]) => x <= xmax + 10);
      rm.userData.set(sel(F2B.mx).map(([x, y]) => C(x, y))); r9.userData.set(sel(F2B.p999).map(([x, y]) => C(x, y))); r0.userData.set([C(0, 0), C(Math.max(1, xmax), 0)]);
      halt(k > 0.98 ? '第 1403 次：2.2 × 10⁹ 倍 → 守卫停机' : ' ');
      const b = seg(p, 0.6, 0.85);
      const after = vals.map((v, i) => mode === 1 ? v / L.lerp(1, 2.2e9, b) : mode === 2 ? Math.min(v, L.lerp(v, 3 * m, b)) : v);
      bs.forEach((f, i) => f(lg(after[i])));
      thrLine.visible = mode === 2; thrLine.position.y = lg(3 * m) - 0.2;
      tl(mode === 0 ? '一批 40 个样本：1 个是中位数的 2.2 × 10⁹ 倍' : mode === 1 ? '全局裁剪：整批乘同一个系数 → 其余 39 个缩到 ~10⁻⁹' : '逐样本：只压那 1 个到 3 × 中位数，其余不动');
      cap(mode === 1 ? '全局范数裁剪按整批的范数缩放：那一个样本决定了系数，<b>其余样本的信号被一起缩没</b>' : mode === 2 ? '逐样本裁剪：阈值是中位数的 3 倍。中位数不受那一个样本影响，<b>其余 39 个原样保留</b>' : '图 2(b)：中位数和 99.9 分位一路平稳，只有最大值上下跳；最后一次冲到 2.2 × 10⁹ 倍，SHAC 的守卫（范数 &gt; 10⁶）停机');
    } };
  }

  /* ---------- scene 6: per-sample median clipping ---------- */
  function s6(G) {
    let ki = +(OPT[0] ?? 1);
    const KS = [2, 3, 10], X = i => -6.0 + 12.0 * i / 63, lg = v => Math.max(0.03, (Math.log10(v) + 1.5) * 0.85);
    const bs = BATCH6.map((v, i) => bar(G, COL.lrn, X(i), 0.13, 0, 0));
    const ghost = BATCH6.map((v, i) => { const b = block(0.13, 1, 0.13, COL.bad, [X(i), 0.5, 0], { opacity: 0.25 }); G.add(b); return b; });
    const thr = wire(G, [[-6.3, 0, 0], [6.3, 0, 0]], COL.ok, { opacity: 0.95 }), medL = wire(G, [[-6.3, 0, 0], [6.3, 0, 0]], 0x9aa6bf, { opacity: 0.7, dashed: true });
    const tLab = dynLab2(G, { size: 13, color: css(COL.ok) }), mLab = dynLab2(G, { size: 12 });
    const info = dynLab(G, [0, 4.6, 0], { size: 14, border: 'rgba(79,201,138,.7)' });
    [0.1, 1, 10, 100, 1000].forEach(v => G.add(lab(String(v), [-6.6, lg(v), 0], { size: 11 })));
    G.add(lab('‖g_i‖（log）', [-4.4, 3.75, 0], { size: 12 }));
    const ctls = [{ label: 'κ', items: ['2', '3（论文）', '10'], get: () => ki, set: k => { ki = k; } }];
    return { ctls, update(p) {
      const R = clip6(KS[ki]), b = seg(p, 0.35, 0.75);
      bs.forEach((f, i) => f(lg(L.lerp(BATCH6[i], R.out[i], b))));
      ghost.forEach((g, i) => { const h = lg(BATCH6[i]); g.scale.y = h; g.position.y = h / 2; g.visible = BATCH6[i] > R.thr && b > 0; });
      thr.position.y = lg(R.thr); medL.position.y = lg(R.m);
      tLab(`κ × 中位数 = ${R.thr.toFixed(2)}`, [7.2, lg(R.thr) + 0.25, 0]); mLab(`中位数 ${R.m.toFixed(2)}`, [7.0, lg(R.m) - 0.25, 0]);
      info(`κ = ${KS[ki]}：64 个样本里裁掉 ${Math.round(R.frac * 64)} 个（${(100 * R.frac).toFixed(0)}%）\n最大的那个从 2000 压到 ${R.thr.toFixed(1)}`);
      cap(ki === 0 ? 'κ = 2：阈值更紧，裁到的样本更多，偏差更大' : ki === 1 ? '<b>κ = 3</b>（论文）：红色半透明是被裁掉的部分。论文每次更新裁到 9–21% 的样本' : 'κ = 10：只碰真正的离群点，但留下的尾巴更长');
    } };
  }

  /* ---------- scene 7: action targets ---------- */
  function s7(G) {
    let on = +(OPT[0] ?? 1);
    const SC = 0.9, DISP = 0.55; /* display: arrow length = DISP * (step in units of delta) */
    panel(G, -4.6, -0.2, -0.05, 9.2, 4.6, { opacity: 0.35 });
    wire(G, [[-4.4, 2.1, 0], [4.4, 2.1, 0]], 0x5a6680, { opacity: 0.5 }); wire(G, [[0, -0.1, 0], [0, 4.3, 0]], 0x5a6680, { opacity: 0.5 });
    G.add(lab('关节 1 设定点', [3.6, 1.8, 0], { size: 12 }), lab('关节 2', [0.55, 4.15, 0], { size: 12 }));
    const P = T7.a.map(a => [SC * a[0], 2.1 + SC * a[1], 0]);
    const dots = inst(BALL, T7.N); dots.material.color.setHex(COL.lrn); G.add(dots);
    const tips = inst(BALL, T7.N); tips.material.color.setHex(COL.grad); G.add(tips);
    const lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COL.grad, transparent: true, opacity: 0.7 }));
    lines.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(T7.N * 6), 3)); lines.frustumCulled = false; G.add(lines);
    const big = dynLab(G, [3.2, 4.0, 0], { size: 13, color: css(COL.bad) });
    const info = dynLab(G, [-6.6, 3.6, 0], { size: 13, border: 'rgba(240,150,60,.7)' });
    const paper = dynLab(G, [-6.6, 0.6, 0], { size: 13, border: 'rgba(80,140,230,.7)' });
    const ctls = [{ label: '逐样本裁剪', items: ['关', '开'], get: () => on, set: k => { on = k; } }];
    return { ctls, update(p) {
      const R = on ? T7.on : T7.off, g = seg(p, 0.05, 0.4), m = Math.floor(seg(p, 0.5, 0.92) * 8), mv = 1 - Math.pow(0.7, m);
      const pos = lines.geometry.attributes.position.array;
      for (let i = 0; i < T7.N; i++) {
        let dx = DISP * R.step[i][0], dy = DISP * R.step[i][1];
        const L0 = Math.hypot(dx, dy), cl = Math.min(1, 4.2 / (L0 + 1e-9)); dx *= cl; dy *= cl; /* clamp to panel */
        const a = P[i], t = [a[0] + dx * g, a[1] + dy * g, 0.02], cur = [a[0] + dx * g * mv, a[1] + dy * g * mv, 0.03];
        setI(dots, i, cur, 0.05); setI(tips, i, t, 0.035);
        pos.set([cur[0], cur[1], 0.02, t[0], t[1], 0.02], i * 6);
      }
      done(dots); done(tips); lines.geometry.attributes.position.needsUpdate = true;
      big(on ? ' ' : `→ 被画面截断：这个样本要走 ${R.maxPer.toFixed(1)} δ`); G.children.forEach(c => { if (c.isSprite && c.position.x === 3.2 && c.position.y === 4.0) c.visible = !on; });
      info(`玩具 N = ${T7.N}，d = 2，${on ? '裁剪开' : '裁剪关'}\n最大逐关节 RMS 步：${R.maxPer.toFixed(2)} δ\n除第一个离群点外最大：${R.others.toFixed(2)} δ\n界 √2 κ = ${(Math.SQRT2 * 3).toFixed(2)} δ`);
      paper(on ? '论文 N = 262,144，δ = 0.03 rad\n每个样本 ≤ √2·3·0.03 = 0.127 rad' : '论文 N = 262,144，δ = 0.03 rad\n那一个样本 ≈ δ√N = 15.4 rad');
      cap(p < 0.45 ? (on ? '<b>裁剪开</b>：每个样本的目标都在当前动作附近，步长最多是 δ 的 √2·κ 倍' : '<b>裁剪关</b>：一个离群样本把 RMS 撑大，它自己的目标飞出去，<b>其余样本几乎不动</b>') : `回归第 ${m} / 8 步：策略向目标靠，到了 y 就不再拉（示意）`);
    } };
  }

  /* ---------- scene 8: NablaEngine kernels ---------- */
  function s8(G) {
    let gi = +(OPT[0] ?? 0);
    const GP = ['RTX PRO 6000', 'H100', 'RTX 3090', 'V100'], T3 = [[1.21, 5.84, 1.78, 20.5], [1.70, 8.65, 2.73, 25.0], [3.28, 12.5, 5.26, 43.0], [5.79, 18.4, 10.6, 63.2]];
    /* warp of 32 threads */
    const th = inst(CUBE, 32); th.material.color.setHex(COL.sim); G.add(th);
    for (let i = 0; i < 32; i++) setI(th, i, [-7.0 + 0.26 * (i % 4), 1.2 + 0.26 * Math.floor(i / 4), 0], 0.2); done(th);
    G.add(lab('一个世界 = 一个 warp\n32 个线程', [-6.6, 3.85, 0], { size: 13 }));
    const K = [];
    for (let s = 0; s < 4; s++) for (let j = 0; j < 2; j++) { const b = block(0.62, 0.62, 0.62, j ? COL.solve : COL.kin, [-4.6 + s * 1.65 + j * 0.72, 3.2, 0]); G.add(b); K.push(b); }
    for (let s = 0; s < 4; s++) G.add(lab(`子步 ${s + 1}`, [-4.25 + s * 1.65, 3.95, 0], { size: 12 }));
    G.add(lab('前向：8 个内核（运动学·碰撞·约束行 ｜ 牛顿求解·积分）', [-1.6, 4.55, 0], { size: 13 }));
    const tape = []; for (let s = 0; s < 4; s++) { const b = block(1.45, 0.16, 0.3, COL.tape, [-4.25 + s * 1.65, 2.45, 0]); G.add(b); tape.push(b); }
    G.add(lab('磁带：每子步 1,472 个 float32 → 每控制步 23.6 kB / 世界', [-1.6, 2.05, 0], { size: 12, color: css(COL.tape) }));
    const adj = block(6.4, 0.75, 0.75, COL.grad, [-1.75, 1.05, 0]); G.add(adj);
    G.add(lab('伴随：1 个大内核，倒着算完 4 个子步（隐函数定理过约束求解）', [-1.6, 0.3, 0], { size: 12, color: css(COL.grad) }));
    const back = stream(G, 8, COL.grad, 0.08);
    /* timing bars */
    const BX = 3.4, rows = [['NablaEngine 前向', COL.sim], ['MuJoCo Warp 前向', COL.dim], ['NablaEngine 前向+梯度', COL.grad], ['MuJoCo Warp + PR #1535', COL.dim]];
    const RY = i => 4.1 - i * 1.0;
    const hb = rows.map(([t, c], i) => { G.add(lab(t, [BX + 1.3, RY(i) + 0.42, 0], { size: 11 })); return hbar(G, c, BX, RY(i), 0.3); });
    const vl = rows.map((r, i) => dynLab2(G, { size: 12 }));
    const sp = dynLab(G, [BX + 2.6, -0.75, 0], { size: 13, border: 'rgba(240,150,60,.7)' });
    const ctls = [{ label: 'GPU', items: GP, get: () => gi, set: k => { gi = k; } }];
    return { ctls, update(p) {
      const f = seg(p, 0, 0.45), k = Math.floor(f * 8.999);
      K.forEach((b, i) => glow(b, p < 0.5 && i === k ? 0.7 : 0.05)); tape.forEach((b, i) => { b.visible = p >= 0.5 || i <= Math.floor(k / 2); });
      glow(adj, p > 0.5 ? 0.45 : 0.03); back([[1.3, 1.05, 0.45], [-4.8, 1.05, 0.45]], 1 - (p * 4) % 1, p > 0.5 ? 1 : 0);
      const t = T3[gi], sc = 3.2 / Math.log10(64), w = v => Math.log10(v * 1 + 1) * sc;
      const gr = seg(p, 0.1, 0.4); hb.forEach((f2, i) => f2(w(t[i]) * gr)); vl.forEach((f2, i) => f2(`${t[i]} ms`, [BX + w(t[i]) * gr + 0.75, RY(i), 0.3]));
      sp(`${GP[gi]}：前向 ${(t[1] / t[0]).toFixed(1)}×，前向+梯度 ${(t[3] / t[2]).toFixed(1)}×\n伴随只多 ${(t[2] - t[0]).toFixed(2)} ms`);
      cap(p < 0.5 ? '前向：每个子步两个融合内核，状态留在共享内存；同时写磁带' : '伴随：一个 warp 读磁带，在一个内核里倒着算完 4 个子步。离散决定（接触集、有效约束、限幅）固定');
    } };
  }

  /* ---------- scene 9: parallel worlds and throughput ---------- */
  function s9(G) {
    const n = 4096, im = inst(CUBE, n); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); G.add(im);
    for (let i = 0; i < n; i++) setI(im, i, [-7.2 + 0.075 * (i % 64), 0.2 + 0.075 * Math.floor(i / 64), 0], 0.06); done(im);
    G.add(lab('4096 个窗口（每个 64 步）', [-4.8, 5.4, 0], { size: 14 }));
    const R = [['∇Mimic', 729, COL.grad], ['SHAC', 669, COL.zo], ['PPO（BeyondMimic）', 781, COL.dim], ['PPO（SuperMimic 演员）', 358, COL.dim], ['∇Mimic on MuJoCo Warp', 167, COL.dim]];
    const BX = 0.6, hb = R.map(([t, v, c], i) => { G.add(lab(`${t}  ${v}k`, [BX + 1.6, 4.6 - i * 0.95 + 0.4, 0], { size: 11 })); return hbar(G, c, BX, 4.6 - i * 0.95, 0.3); });
    G.add(lab('仿真步 / 秒（表 15，RTX PRO 6000）', [BX + 2.6, 5.7, 0], { size: 13 }));
    const info = dynLab(G, [BX + 2.8, -0.2, 0], { size: 13, border: 'rgba(240,150,60,.7)' });
    return { update(p) {
      const w = (p * 3) % 1;
      for (let i = 0; i < n; i++) { const x = (i % 64) / 64, k = Math.max(0, 1 - Math.abs(x - w) * 8); _C.setHex(COL.sim).lerp(_C.clone().setHex(0xffffff), 0.6 * k); im.setColorAt(i, _C); }
      done(im);
      hb.forEach((f, i) => f(5.5 * R[i][1] / 800 * seg(p, 0.1, 0.5)));
      info(p < 0.55 ? '每次更新：262,144 可微步 + 10,240 收集器步\n0.374 s → 72.9 万步/秒' : '引擎只算前向：4096 / 1.21 ms × 0.02 s ≈ 每秒 18.8 h\n训练实际：72.9 万 × 0.02 s ≈ 每秒 4.05 h');
      cap(p < 0.55 ? '每个小方块是一个 BPTT 窗口。一次更新 4096 个窗口同时跑 64 步，加上收集器的 10,240 个只前向的步' : '“每秒 18.8 小时机器人运动”是引擎只做前向的吞吐；训练里还有反向、网络和回归，约每秒 4 小时');
    } };
  }

  /* ---------- scene 10: training curves ---------- */
  function s10(G) {
    let v = +(OPT[0] ?? 0);
    const G1 = new THREE.Group(), G2 = new THREE.Group(); G.add(G1, G2);
    const CW = chart(G1, { x0: -5.8, y0: 0.6, w: 11.6, h: 3.6, xmin: 0, xmax: 6, ymin: 0, ymax: 0.9, z: 0, xt: [0, 1, 2, 3, 4, 5, 6].map(x => [x, `${x} h`]), yt: [[0, '0'], [0.4, '0.4'], [0.82, '0.82']], xlab: '训练墙钟（一张 RTX PRO 6000）', ylab: '归一化回报（图 1a）' });
    const CU = chart(G2, { x0: -5.8, y0: 0.6, w: 11.6, h: 3.6, xmin: 250, xmax: 30000, ymin: 0, ymax: 0.9, z: 0, logx: true, xt: [[300, '300'], [1000, '1k'], [3000, '3k'], [10000, '10k'], [30000, '30k']], yt: [[0, '0'], [0.4, '0.4'], [0.82, '0.82']], xlab: '策略更新次数（log）', ylab: '归一化回报（图 5a，绝对动作版）' });
    const r1 = ribbon(G1, F1A.nm.length, COL.grad, 0.05), r2 = ribbon(G1, F1A.ppo.length, COL.dim2, 0.04);
    const thr1 = ribbon(G1, 2, 0x9aa6bf, 0.02); thr1.userData.set([CW(0, 0.82), CW(6, 0.82)]);
    const sm = block(0.16, 0.16, 0.16, COL.gold, CW(1.2, 0.82)); sm.rotation.z = Math.PI / 4; G1.add(sm);
    G1.add(lab('◆ SuperMimic 自报：1.2 h 以内（H100）', [CW(2.3, 0.7)[0], CW(2.3, 0.7)[1], 0], { size: 12, color: css(COL.gold) }));
    G1.add(lab('∇Mimic', [CW(3.5, 0.875)[0], CW(3.5, 0.875)[1] + 0.3, 0], { size: 13, color: css(COL.grad) }), lab('PPO（BeyondMimic 配置）', [CW(4.4, 0.62)[0], CW(4.4, 0.62)[1], 0], { size: 13, color: css(COL.dim2) }));
    const mark = ball(COL.grad, 0.09, CW(0.341, 0.82)); G1.add(mark);
    const ml = dynLab(G1, [CW(1.0, 0.5)[0], CW(1.0, 0.5)[1], 0], { size: 12, color: css(COL.grad) });
    const u1 = ribbon(G2, F5A.ne.length, COL.grad, 0.05), u2 = ribbon(G2, F5A.mjw.length, COL.dim2, 0.05);
    const thr2 = ribbon(G2, 2, 0x9aa6bf, 0.02); thr2.userData.set([CU(250, 0.82), CU(30000, 0.82)]);
    G2.add(lab('NablaEngine（3 种子）', [CU(9000, 0.84)[0], CU(9000, 0.84)[1] + 0.35, 0], { size: 13, color: css(COL.grad) }), lab('MuJoCo Warp（1 种子）', [CU(1500, 0.5)[0], CU(1500, 0.5)[1], 0], { size: 13, color: css(COL.dim2) }));
    const ctls = [{ label: '横轴', items: ['墙钟（图 1a）', '更新次数（图 5a）'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      G1.visible = v === 0; G2.visible = v === 1;
      const k = seg(p, 0.05, 0.85);
      if (v === 0) {
        const tmax = 6 * k;
        r1.userData.set(F1A.nm.filter(([x]) => x <= tmax + 1e-3).map(([x, y]) => CW(x, y)));
        r2.userData.set(F1A.ppo.filter(([x]) => x <= tmax + 1e-3).map(([x, y]) => CW(x, y)));
        mark.visible = tmax > 0.341; ml(tmax > 0.341 ? '● 0.34 h 第一次过 0.82' : ' ');
        cap(tmax < 0.6 ? '∇Mimic 0.341 h 第一次过 0.82，随后回落到 0.793，约 0.5 h 起才一直在线上（矢量读数）' : '∇Mimic 1.8 h 到 0.874 后走平；PPO 6 h 0.695（最好 0.751）。SuperMimic 的点是自报、不同 GPU');
      } else {
        const umax = Math.pow(10, Math.log10(250) + k * (Math.log10(30000) - Math.log10(250)));
        u1.userData.set(F5A.ne.filter(([x]) => x <= umax).map(([x, y]) => CU(x, y)));
        u2.userData.set(F5A.mjw.filter(([x]) => x <= umax).map(([x, y]) => CU(x, y)));
        cap('按更新次数，两个引擎的曲线几乎重合（MuJoCo Warp 只跑到约 6000 次）：引擎改变的是每次更新的耗时（0.37 对 1.63 s），不是学习');
      }
    } };
  }

  /* ---------- scene 11: evaluation, no hardware ---------- */
  function s11(G) {
    let mi = +(OPT[0] ?? 0);
    const M = [['∇Mimic', 0, 0.875], ['∇Mimic 绝对动作', 0, 0.864], ['SHAC 改过的守卫', 2, 0.816], ['PPO SuperMimic 演员', 3, 0.658], ['PPO BeyondMimic', 8, 0.638], ['SHAC 原版守卫（0.06 h 停）', 23, 0.373]];
    const ref = robot(COL.ref, { opacity: 0.35 }), rb = robot(COL.robot); G.add(ref, rb);
    G.add(lab('参考（半透明）与仿真机器人：示意', [-4.6, 3.2, 0], { size: 12 }));
    const cells = []; const order = Array.from({ length: 40 }, (_, i) => i).sort((a, b) => Math.sin(a * 12.9898) * 43758.5 % 1 - Math.sin(b * 12.9898) * 43758.5 % 1);
    for (let i = 0; i < 40; i++) { const b = block(0.42, 0.42, 0.1, COL.ok, [-1.4 + 0.5 * (i % 8), 3.4 - 0.5 * Math.floor(i / 8), 0]); G.add(b); cells.push(b); }
    G.add(lab('LAFAN1 40 段（哪几段摔倒是示意）', [0.35, 4.05, 0], { size: 12 }));
    const hb = M.map(([t, f, r], i) => { G.add(lab(`${t}  ${r.toFixed(3)}`, [4.7, 4.0 - i * 0.78 + 0.33, 0], { size: 11 })); return hbar(G, i < 2 ? COL.grad : COL.dim, 3.2, 4.0 - i * 0.78, 0.22); });
    G.add(lab('3 h 回报（表 4）', [4.7, 4.85, 0], { size: 12 }));
    const info = dynLab(G, [0.35, 0.35, 0], { size: 13, border: 'rgba(240,150,60,.7)' });
    const ctls = [{ label: '方法', items: M.map(m => m[0]), get: () => mi, set: k => { mi = k; } }];
    return { ctls, update(p) {
      const t = (p * 2) % 1, fall = M[mi][1] > 0 && t > 0.7;
      place(ref, dance(t), [-4.6, 0, 0], 0.4, 2.2);
      const q = dance(t); place(rb, fall ? { ...q, y: L.lerp(q.y, 0.25, seg(t, 0.7, 0.85)), pitch: -1.3 * seg(t, 0.7, 0.85) } : q, [-4.6, 0, 0.05], 0.4, 2.2);
      const nf = M[mi][1];
      cells.forEach((b, i) => { const bad = order.indexOf(i) < nf; b.material.color.setHex(bad ? COL.bad : COL.ok); });
      hb.forEach((f, i) => f(3.2 * M[i][2] * seg(p, 0.05, 0.4)));
      info(`${M[mi][0]}：结束时 ${nf} / 40 段有摔倒\n评测：MuJoCo Warp 前向，确定性，无随机化`);
      cap('训练在 NablaEngine、评测在 MuJoCo Warp（两套独立实现）。<b>论文没有真机实验</b>（§8），仓库也没有部署代码');
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player (same as interactives/diffmimic) ---------- */
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
  window.__nmDebug = { ZO: ZO.map(r => ({ cos: r.cos, err: r.err })), clip: [2, 3, 10].map(k => clip6(k).frac), T7: { on: T7.on.maxPer, off: T7.off.maxPer, othersOff: T7.off.others }, tail: TAIL[63], get cap() { return $('cap').textContent; } };
})();
