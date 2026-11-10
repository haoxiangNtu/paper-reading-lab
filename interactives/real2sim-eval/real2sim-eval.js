'use strict';
/* Real-to-Sim policy evaluation (arXiv 2511.04665) taken apart into eleven animated scenes.
   Scatter data in scene 10 were read from the vector drawings of Figs. 3, 9 and 10 (exact to k/N).
   Colour matrices in scene 4 are copied from cfg/gs/*.yaml of kywind/real2sim-eval at 8bd7091.
   Scenes 3, 5, 6, 7, 8 and 10 compute their numbers live; the physics in 5–7 are toys and labelled so.
   Each scene's update(p) is a pure function of the timeline p plus the current toggles. No GS renderer or policy runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const PI = Math.PI;
  const COL = { gs: 0x38d1ff, phys: 0x4fc98a, align: 0xf2c14e, real: 0xf0963c, sim: 0x5b8bd6, robot: 0xc9d4ea, toy: 0xd9c4a0, rope: 0xe6c49a, tblock: 0xeef2fa,
    wood: 0x8a6a4a, table: 0x262b36, wall: 0x3a4152, warn: 0xff7a59, ok: 0x4fc98a, bad: 0xe05d5d, dim: 0x46506a, white: 0xeef2fa, purple: 0x9d8cff,
    ACT: 0x2ca02c, DP: 0xff7f0e, Pi0: 0x1f77b4, Smol: 0x9467bd, ours: 0x4c72b0, isaac: 0xdd8452, ctrl: 0xff5f7e };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  const SCENES = [
    { n: 1, part: '总览', title: '真机训练，仿真评测，看两边成绩是否同步', sub: '图 2 的 3D 版：左边真实世界，右边高斯泼溅仿真', dur: 14, cam: [0.1, 1.02, 34, [0, 2.2, 0]],
      html: dl([['外观', '手机扫描 → 3DGS → 位置对齐 + 颜色对齐'], ['动力学', 'PhysTwin 弹簧-质点孪生（人手交互视频辨识）'], ['接口', 'Gym：env.step() / env.render()'], ['策略', 'ACT、DP、π0、SmolVLA，只用真机数据训练'], ['指标', 'Pearson r 和 MMRV（沿用 SIMPLER）']]) +
        '<p>策略在真机上采示范、训练，然后同一批检查点分别在真机和仿真里、从同一组初始摆放跑一遍。如果仿真成功率和真机成功率强相关，就可以用仿真来挑检查点、比较策略。</p>' +
        '<p>点画面里的方块可以跳到对应那一幕。</p>' + src('§III · 图 2') },
    { n: 2, part: '§III-C-1 扫描', title: '手机扫一圈，得到一堆高斯，再切成三类', sub: '切换“原色”和“分割上色”：机器人、物体、背景', dur: 13, cam: [0.55, 1.0, 21, [0, 1.4, 0]],
      html: dl([['工具', 'iPhone 应用 Scaniverse，自动生成 GS'], ['顺序', '先扫整个工作区（机器人 + 桌 + 背景），再逐个扫物体'], ['分割', 'SuperSplat 里手动切成机器人 / 物体 / 背景'], ['频率', '每个任务做一次']]) +
        '<p>3DGS 用成千上万个带颜色、带不透明度的三维椭球表示场景，可以从任意视角实时渲染。正是“任意视角”这一点让腕部相机也能渲染出来。</p>' +
        '<p>扫描出来的是一个整体，所以要手动切开：机器人的高斯之后要跟着连杆动，物体的高斯要跟着物理粒子动，背景不动。</p>' +
        guess('椭球数量（约 1300 个）、颜色和手机路径都是我设的，真实扫描有几十万个高斯。椭球用固定种子采样在简单几何体表面。') + src('§III-C-1 · 表 II') },
    { n: 3, part: '§III-C-2 对齐', title: 'ICP 把扫描出的机器人对到 URDF 上，再给每个高斯分连杆', sub: '当场跑 ICP；切换初始错位看局部极小', dur: 15, cam: [0.45, 1.05, 15, [0.6, 1.9, 0]],
      html: dl([['目标点云', 'URDF 网格表面采样，每个连杆 2000 点'], ['源点云', '机器人高斯的中心'], ['配准', 'RANSAC 全局 + ICP 精修（代码 60 + 40 次）'], ['连杆分配', '每个高斯找最近的 URDF 点，继承其连杆编号'], ['背景', '和机器人在同一扫描里，套用同一个变换']]) +
        '<p>扫描的坐标系是随意的，要先对到机器人基座系。ICP 每轮做两件事：给每个源点找最近的目标点，再用这些配对解一个最优刚体变换（这里用 Horn 的四元数法）。</p>' +
        '<p>ICP 只能找到局部最优。初始错位大时会卡住，所以代码先用 RANSAC 做全局粗配准，附录还说先在 SuperSplat 里手动粗对齐。</p>' +
        '<p>对齐以后，每个高斯按最近邻分到一个连杆（颜色）。之后机械臂怎么动，每个高斯就跟着它的连杆做刚体变换，夹爪开合也一样。</p>' +
        toyb('每个连杆 70 个点（论文 2000），高斯中心 = 真值点加少量噪声，再整体旋转平移。ICP 是点到点、暴力最近邻，迭代和误差都是当场算的。') + src('§III-C-2 · 附录 I-B-2 · 代码 construct_scene_gripper.py、icp_utils.py') },
    { n: 4, part: '§III-C-3 颜色', title: '把 iPhone 的颜色变到 RealSense 的颜色', sub: '用代码里的真实矩阵变换 RGB 立方体里的颜色；切换场景矩阵和物体矩阵', dur: 13, cam: [-0.6, 1.18, 13.5, [0.4, 1.0, 0.6]],
      html: dl([['式 (1)', 'f* = argmin Σ‖f(pᵢ) − qᵢ‖² / N'], ['论文式 (3)', '逐通道二次多项式，9 个参数'], ['代码', 'f(p) = A·[p²; p] + b，A 是 3×6，共 21 个参数'], ['求解', '鲁棒 IRLS，Tukey 双权重，50 次，5 张 848×480']]) +
        '<p>GS 继承了手机视频的色彩，策略却是在 RealSense 的色彩里训练的。颜色不对，策略的行为就会变（表 I：w/o 颜色对齐的 r 在推 T 上从 0.915 掉到 0.529）。</p>' +
        '<p>这里的点是一组典型颜色（暗桌面、木桌、白机器人、米色毛绒……），用代码配置里的 A、b 变换。“逐通道拟合”一栏把代码的变换当作真值，用论文式 (3) 的逐通道形式去拟合它，看剩下多少误差：说明代码的变换混合了通道，式 (3) 表达不了。</p>' +
        toyb('输入颜色是我挑的；变换矩阵是代码 cfg/gs/sloth.yaml 的 color_A / color_b（场景和物体各一套）。逐通道拟合的残差是当场算的。') + src('§III-C-3 式 (1)(2)(3) · 附录 I-B-3 · 代码 color_alignment.py') },
    { n: 5, part: '§III-B PhysTwin', title: '弹簧-质点绳子：当场模拟', sub: '这一幕是核心。切换控制点的轨迹和刚度，绳子按代码的力公式当场积分', dur: 12, cam: [0.25, 1.08, 11.5, [0, 1.0, 0]],
      html: dl([['弹簧', '距离 ≤ 阈值 d 的节点两两相连'], ['力（代码）', 'F = Y·(|d|/l − 1)·d̂ + c·((vⱼ−vᵢ)·d̂)·d̂'], ['积分', 'v += Δt(F/m + g)，v *= e^(−3Δt)，x += Δt·v'], ['子步', '代码 dt = 5e-5，每个 30 Hz 步 667 子步'], ['控制点', '人手关键点，用弹簧连到附近节点']]) +
        '<p>PhysTwin 把物体看成一群质点，距离在阈值内的点之间连弹簧。这里每个节点连到前后各两个邻居，第二近的那根弹簧提供了抗弯能力。</p>' +
        '<p>粉色球是控制点：PhysTwin 训练时它是视频里跟踪到的手指，评测时换成夹爪的碰撞。弹簧颜色表示应变：红色拉长，蓝色压缩。</p>' +
        '<p>切换刚度可以看到同一个动作下绳子的形态差别很大，这就是第 6 幕要从视频里辨识刚度的原因。</p>' +
        toyb('24 个节点、间距 0.2、质量 0.02、阻尼 c = 2 都是我设的单位；Δt = 1/720，每帧 24 子步（代码是 5e-5 和 667）。力的形式、拖曳衰减和半隐式欧拉照代码。地面碰撞简化成截断加摩擦。') + src('§III-B · PhysTwin §3 · 代码 spring_mass_warp.py eval_springs、update_vel_from_force') },
    { n: 6, part: '§III-B 辨识', title: '从“视频”里把每段刚度找出来', sub: '先零阶搜一个全局刚度，再逐段细调；损失是跟踪点的距离，当场算', dur: 16, cam: [0.2, 1.05, 12.5, [0, 1.4, 0]],
      html: dl([['数据', '三台 D455 拍人手摆弄物体（图 8）'], ['损失', 'Chamfer 距离 + CoTracker3 跟踪点误差'], ['第一段', 'CMA-ES：拓扑、全局刚度、碰撞参数'], ['第二段', '可微模拟器梯度下降：每根弹簧的刚度'], ['w/o 物理优化', '停在第一段，用全局刚度']]) +
        '<p>橙色半透明的绳子是“观测”：用一组隐藏的逐段刚度（两端硬、中间软）模拟出来，代替真实视频。蓝色是当前参数下的模拟。下面的柱子是每次评估的损失，右边是四段刚度的真值（橙）和估计（蓝）。</p>' +
        '<p>第一段只能找一个全局刚度，中间软的那段和两端硬的那段被迫取同一个值，损失降不到底。第二段逐段调整以后，损失明显再降。这对应表 I 的消融：w/o 物理优化就是只用第一段的全局刚度。</p>' +
        toyb('观测是我用隐藏参数模拟的，不是真实视频；损失只用节点跟踪误差，没有 Chamfer 项。第一段在 8 个对数等距的刚度里挑（代替 CMA-ES），第二段每段乘或除 1.6 试探两轮（代替梯度下降）。所有评估都是页面当场模拟的。') + src('§III-B · §IV-E · PhysTwin §4.2.1') },
    { n: 7, part: '§III-C-4 抓取', title: '不把节点焊在夹爪上：摩擦接触，力够了就停', sub: '切换力阈值和抓取方式，看提起时会不会滑', dur: 12, cam: [0.0, 1.0, 8.5, [0, 1.25, 0]],
      html: dl([['论文', '只靠手指和物体间的摩擦；合拢到碰撞力总和达到阈值就停'], ['代码', '左右手指各取 3 个面片的力，两指都 > 3e4 才锁住开度'], ['常见做法', '把接触到的节点固定到夹爪上（论文认为不真实）'], ['末端摩擦', 'collide_eef_fric = 1.0，弹性 0']]) +
        '<p>夹爪从两边合拢。每个与手指接触的质点受一个法向的罚力，摩擦力最多是法向力的 μ 倍。两根手指的法向力都超过阈值就停止合拢，然后往上提。</p>' +
        '<p>阈值太低：夹得太松，摩擦撑不住重量，物体滑掉。阈值合适：能提起来。切到“焊住”模式，不管阈值多少都能提起，这正是论文说它不真实的原因：真机上夹不紧的时候也会滑。</p>' +
        toyb('二维截面，5×5 个质点，质量、刚度、罚力系数、μ = 0.9 和三个阈值都是我设的单位，和代码的 3e4 不可比。摩擦用库仑冲量近似。都是当场模拟的。') + src('§III-C-4 · 代码 phystwin.py step（约第 380–410 行）、cfg/physics/default.yaml') },
    { n: 8, part: '§III-C-4 LBS', title: '高斯跟着粒子动：线性混合蒙皮', sub: '切换三种更新方式，看椭球的朝向', dur: 12, cam: [0.35, 1.0, 8.2, [0, 1.1, 0]],
      html: dl([['节点旋转', 'Rₖ = argmin Σ‖R(μⱼ − μₖ) − (μⱼ′ − μₖ′)‖²（邻居）'], ['高斯中心', 'μ′ = Σ wₖ (Rₖ(μ − μₖ) + μₖ′)'], ['权重', 'wₖ ∝ 1/‖μ − μₖ‖，取 K 个最近节点'], ['高斯朝向', 'PhysTwin 式 (7)：q′ = (Σ wₖ rₖ) ⊗ q'], ['代码', 'quat=None：只移中心，不转朝向']]) +
        '<p>物理只算节点，渲染要的是高斯。每个高斯取最近的几个节点，按距离倒数加权；每个节点用邻居的位移拟合一个局部旋转。这样弯曲时，高斯不仅平移，还会绕着弯。</p>' +
        '<p>代码只更新中心，椭球朝向保持扫描时的样子。弯得厉害时，切到“代码”可以看到椭球的长轴不再顺着表面。底部的数字是椭球长轴和局部切线的平均夹角，当场算。</p>' +
        toyb('3×12 个节点的布条做规定的弯曲，不是模拟；160 个椭球、K = 4、邻居 8 个都是我设的（代码 K = 16、邻居 8）。节点旋转用 Horn 四元数法当场解。') + src('§III-C-4 · PhysTwin 补充材料式 (5)–(8) · 代码 transform_utils.py interpolate_motions、gs_renderer.py update_rendervar') },
    { n: 9, part: '§III-D 闭环', title: '策略在仿真里闭环跑：两路相机的画面是渲染出来的', sub: '右下角是腕部相机和固定相机的实时小窗', dur: 14, cam: [0.75, 1.0, 19, [1.2, 1.2, 1.2]],
      html: dl([['观测', '腕部 D405 + 固定 D455 两路图像，末端状态 8 维（推 T 2 维）'], ['策略', '动作块 50 步（DP 预测 64 执行 50）'], ['env.step', '30 Hz；关节速度控制同真机；默认 667 子步物理'], ['渲染更新', '连杆刚体变换 + 物体 LBS'], ['速度', '单 GPU 5–30 FPS，多 GPU 并行']]) +
        '<p>仿真器被包装成 Gym 环境：策略拿到两张渲染图和末端状态，输出一段动作；env.step 把动作按真机同样的关节速度控制执行，在物理里跑若干子步；再把粒子和连杆的新状态传给高斯，env.render 从两个相机视角渲染下一帧观测。</p>' +
        '<p>初始摆放来自评测网格（装玩具 20、穿绳 27、推 T 16），真机上用叠加工具照着仿真的初始帧摆物体。成功由仿真状态自动判定。</p>' +
        guess('机械臂、玩具和动作轨迹是手工的，渲染是普通 WebGL，不是高斯泼溅。小窗只为说明两路相机各看到什么。') + src('§III-D · §IV-A · 算法 1 · 代码 env.py、eval_policy.py') },
    { n: 10, part: '§IV-C 相关性', title: '按图中读数，当场算 r 和两种 MMRV', sub: '切换来源和任务；连线是每个点最严重的一次错排', dur: 13, cam: [0.0, 1.32, 21, [0.6, 4.2, 0]],
      html: dl([['数据', '图 3、9、10 的矢量读数，精确到 k/N'], ['r', '和论文完全一致'], ['MMRV（SIMPLER）', 'max |Rᵢ−Rⱼ| 的平均，Rᵢ 是真机成绩'], ['MMRV（本文 v2）', '同样的判断，但用仿真成绩差加权'], ['误差棒', 'Clopper–Pearson 95%，当场算']]) +
        '<p>每个点是一个检查点：横轴真机成功率，纵轴仿真成功率，颜色是策略。r 和本文实现的 MMRV 与论文表 I、图 9、图 10 逐位一致；按 SIMPLER 原定义算出的 MMRV 都不一样（精读页读者注 7）。</p>' +
        '<p>切到“IsaacLab”：仿真成功率几乎全是 0，按 SIMPLER 定义 MMRV 在穿绳上是 0.480（本文仿真器同一格 0.154）；论文的实现给出 0.270。</p>' +
        '<p>切换“错排连线”可以看两种定义各自认为谁错得最严重。</p>' + src('图 3 · 图 9 · 图 10 · 表 I · SimplerEnv metrics.py') },
    { n: 11, part: '对照 SIMPLER', title: '绿幕和高斯泼溅：腕部相机一动就分出来了', sub: '上小窗是绿幕合成，下小窗是完整 3D 渲染，同一个腕部相机', dur: 13, cam: [0.9, 1.0, 18, [1.8, 1.6, 0]],
      html: dl([['SIMPLER', '固定相机拍一张真实背景，仿真物体叠在上面 + 纹理匹配'], ['局限（SIMPLER §VII）', '只适用于固定相机；只做刚体'], ['本文', '整个场景是 3D 高斯，任意视角都能渲染'], ['指标', '都用 Pearson r 和 MMRV（本文 MMRV 加权不同）'], ['代价', '每个场景实地扫描，每个软体物体拍交互视频训练孪生']]) +
        '<p>绿幕的背景是一张从固定相机拍的照片。在固定相机里，这张照片和仿真物体对得上；可是腕部相机一动，背景还是那张照片，桌子边、墙和物体之间的关系就全错了。</p>' +
        '<p>3DGS 把背景也重建成三维的，所以腕部相机看到的背景随视角正确变化（下小窗）。这就是引言里说“腕部相机让绿幕不够用”的意思。</p>' +
        guess('背景“照片”是在页面里从固定相机渲染出来的图，不是真实照片；上小窗把它当成静态背景，再从腕部相机渲染前景，模拟绿幕合成。') + src('§I · §II-A · SIMPLER §IV-B、§VII') }
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

  /* ---------- 3D helpers (same pattern as interactives/latent) ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.3, phi: 1.0, dist: 24, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  if (!S) { showInfo(0); return; }
  const root = new THREE.Group(); S.scene.add(root);
  S.scene.children.forEach(o => { if (o.isLight) { o.layers.enable(1); o.layers.enable(2); } });
  let LABS = [], refDist = 24, PICKS = [];
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
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: 0.6 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s, q) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, q || _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.14) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.6, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  function pline(G, n, color, o = {}) {
    const pos = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: o.opacity ?? 1 })); l.frustumCulled = false; l.renderOrder = o.order ?? 3; G.add(l);
    l.userData.set = pts => { const k = Math.max(1, Math.min(n, pts.length)); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)]; pos[i * 3] = q[0]; pos[i * 3 + 1] = q[1]; pos[i * 3 + 2] = q[2]; } g.attributes.position.needsUpdate = true; };
    return l;
  }
  /* many independent segments with per-vertex colours (springs) */
  function segs(G, n, o = {}) {
    const pos = new Float32Array(n * 6), col = new Float32Array(n * 6), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: o.opacity ?? 0.9 })); l.frustumCulled = false; G.add(l);
    l.userData.set = (i, a, b, c) => { pos.set(a, i * 6); pos.set(b, i * 6 + 3); col.set(c, i * 6); col.set(c, i * 6 + 3); };
    l.userData.done = () => { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; };
    return l;
  }
  function floorRect(G, cx, cz, lx, lz, color, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(lx, lz), new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: o.opacity != null, opacity: o.opacity ?? 1, depthWrite: o.opacity == null })); m.rotation.x = -PI / 2; m.position.set(cx, o.y ?? 0, cz); G.add(m); return m; }
  function frustum(G, color, s = 0.6, o = {}) {
    const g = new THREE.Group(), w = s * 0.8, h = s * 0.55, d = s;
    const c = [0, 0, 0], a = [-w, -h, -d], b = [w, -h, -d], e = [w, h, -d], f = [-w, h, -d];
    wire(g, [c, a], color, { opacity: 0.9 }); wire(g, [c, b], color, { opacity: 0.9 }); wire(g, [c, e], color, { opacity: 0.9 }); wire(g, [c, f], color, { opacity: 0.9 }); wire(g, [a, b, e, f, a], color, { opacity: 0.9 });
    g.add(block(0.22 * s / 0.6, 0.16 * s / 0.6, 0.2 * s / 0.6, color, [0, 0, 0.1 * s / 0.6], { edges: false }));
    G.add(g); return g;
  }
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  function rngArr(seed) { return L.rng(seed); }

  /* ---------- small linear algebra: Horn's quaternion method (best rotation P -> Q) ---------- */
  function jacobi4(A) {
    const a = A.map(r => r.slice()), V = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
    for (let sweep = 0; sweep < 30; sweep++) {
      let off = 0; for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) off += a[i][j] * a[i][j];
      if (off < 1e-18) break;
      for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < 4; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < 4; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < 4; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    let bi = 0; for (let i = 1; i < 4; i++) if (a[i][i] > a[bi][bi]) bi = i;
    return [V[0][bi], V[1][bi], V[2][bi], V[3][bi]];
  }
  /* P, Q: arrays of [x,y,z] already centred (or relative vectors). Returns THREE.Quaternion R with R·P ≈ Q */
  function hornRot(P, Q, w) {
    let Sxx = 0, Sxy = 0, Sxz = 0, Syx = 0, Syy = 0, Syz = 0, Szx = 0, Szy = 0, Szz = 0;
    for (let i = 0; i < P.length; i++) { const p = P[i], q = Q[i], k = w ? w[i] : 1; Sxx += k * p[0] * q[0]; Sxy += k * p[0] * q[1]; Sxz += k * p[0] * q[2]; Syx += k * p[1] * q[0]; Syy += k * p[1] * q[1]; Syz += k * p[1] * q[2]; Szx += k * p[2] * q[0]; Szy += k * p[2] * q[1]; Szz += k * p[2] * q[2]; }
    const N = [[Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx], [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz], [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy], [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz]];
    const e = jacobi4(N); return new THREE.Quaternion(e[1], e[2], e[3], e[0]).normalize();
  }
  const centroid = P => { const c = [0, 0, 0]; P.forEach(p => { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }); return c.map(x => x / P.length); };
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const len3 = a => Math.hypot(a[0], a[1], a[2]);
  const rotP = (q, p) => { const v = new THREE.Vector3(p[0], p[1], p[2]).applyQuaternion(q); return [v.x, v.y, v.z]; };

  /* ---------- statistics (scene 10) ---------- */
  function pearson(x, y) { const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sxx * syy); }
  /* SimplerEnv mean_maximum_rank_violation(perf_sim, perf_real); returns {v, worst[i] = j} */
  function mmrvSimpler(ps, pr) { const n = ps.length, worst = []; let tot = 0; for (let i = 0; i < n; i++) { let m = 0, wj = -1; for (let j = 0; j < n; j++) if ((ps[i] > ps[j]) !== (pr[i] > pr[j])) { const d = Math.abs(pr[i] - pr[j]); if (d > m) { m = d; wj = j; } } tot += m; worst.push(wj); } return { v: tot / n, worst }; }
  function binomCdf(k, n, p) { let s = 0, c = 1; for (let i = 0; i <= k; i++) { if (i > 0) c = c * (n - i + 1) / i; s += c * Math.pow(p, i) * Math.pow(1 - p, n - i); } return s; }
  function cpInt(k, n) { const bis = f => { let lo = 0, hi = 1; for (let it = 0; it < 50; it++) { const m = (lo + hi) / 2; if (f(m)) hi = m; else lo = m; } return (lo + hi) / 2; };
    const lo = k === 0 ? 0 : bis(p => 1 - binomCdf(k - 1, n, p) >= 0.025), hi = k === n ? 1 : bis(p => binomCdf(k, n, p) <= 0.025); return [lo, hi]; }

  /* ---------- data read from the vector drawings (real / sim as counts out of N, Fig. 9 sim as fraction) ---------- */
  const D = {
    f3: [[['ACT', 10, 11], ['ACT', 12, 12], ['ACT', 13, 14], ['ACT', 16, 13], ['ACT', 17, 14], ['DP', 0, 2], ['DP', 7, 7], ['DP', 8, 7], ['DP', 10, 9], ['DP', 14, 15], ['Pi0', 10, 10], ['Pi0', 16, 13], ['Pi0', 16, 15], ['Smol', 1, 1], ['Smol', 6, 5], ['Smol', 7, 3], ['Smol', 7, 6]],
      [['ACT', 10, 5], ['ACT', 12, 10], ['ACT', 15, 15], ['ACT', 21, 19], ['ACT', 26, 20], ['ACT', 26, 22], ['DP', 0, 0], ['DP', 0, 0], ['DP', 6, 5], ['DP', 12, 18], ['DP', 22, 26], ['DP', 23, 20], ['Pi0', 15, 15], ['Pi0', 20, 23], ['Pi0', 23, 26], ['Smol', 0, 0], ['Smol', 20, 12], ['Smol', 22, 19], ['Smol', 24, 15], ['Smol', 24, 20]],
      [['ACT', 4, 6], ['ACT', 5, 4], ['ACT', 7, 4], ['ACT', 7, 7], ['DP', 5, 5], ['DP', 12, 12], ['DP', 13, 12], ['DP', 15, 14], ['Pi0', 7, 9], ['Pi0', 11, 12], ['Pi0', 13, 15], ['Smol', 1, 1], ['Smol', 4, 2], ['Smol', 7, 5], ['Smol', 9, 5]]],
    f9: [[['ACT', 10, 0.38], ['ACT', 12, 0.74], ['ACT', 13, 0.745], ['ACT', 16, 0.795], ['ACT', 17, 0.665], ['DP', 0, 0.125], ['DP', 7, 0.38], ['DP', 8, 0.33], ['DP', 10, 0.425], ['DP', 14, 0.655], ['Pi0', 10, 0.615], ['Pi0', 16, 0.67], ['Pi0', 16, 0.68], ['Smol', 1, 0.06], ['Smol', 6, 0.205], ['Smol', 7, 0.09], ['Smol', 7, 0.23]],
      [['ACT', 10, 0.18], ['ACT', 12, 0.29], ['ACT', 15, 0.575], ['ACT', 21, 0.6], ['ACT', 26, 0.75], ['ACT', 26, 0.77], ['DP', 0, 0], ['DP', 0, 0], ['DP', 6, 0.145], ['DP', 12, 0.545], ['DP', 22, 0.93], ['DP', 23, 0.725], ['Pi0', 15, 0.58], ['Pi0', 20, 0.915], ['Pi0', 23, 0.88], ['Smol', 0, 0], ['Smol', 20, 0.47], ['Smol', 22, 0.79], ['Smol', 24, 0.645], ['Smol', 24, 0.695]],
      [['ACT', 4, 0.365], ['ACT', 5, 0.185], ['ACT', 7, 0.355], ['ACT', 7, 0.4], ['DP', 5, 0.26], ['DP', 12, 0.75], ['DP', 13, 0.8], ['DP', 15, 0.885], ['Pi0', 7, 0.565], ['Pi0', 11, 0.745], ['Pi0', 13, 0.885], ['Smol', 1, 0.11], ['Smol', 4, 0.205], ['Smol', 7, 0.335], ['Smol', 9, 0.435]]],
    f10: [[['ACT', 10, 9], ['ACT', 12, 14], ['ACT', 13, 13], ['DP', 0, 4], ['DP', 8, 9], ['DP', 8, 13], ['DP', 9, 9], ['DP', 13, 11], ['Pi0', 10, 13], ['Pi0', 16, 13], ['Pi0', 16, 17], ['Smol', 0, 0], ['Smol', 2, 5], ['Smol', 6, 3], ['Smol', 8, 10]],
      [['ACT', 15, 13], ['ACT', 21, 20], ['ACT', 26, 23], ['ACT', 26, 26], ['DP', 6, 4], ['DP', 12, 16], ['DP', 22, 25], ['DP', 23, 25], ['Pi0', 15, 18], ['Pi0', 20, 20], ['Pi0', 23, 23], ['Smol', 21, 15], ['Smol', 22, 26], ['Smol', 24, 23], ['Smol', 24, 27]],
      [['ACT', 4, 2], ['ACT', 5, 5], ['ACT', 7, 5], ['ACT', 7, 7], ['DP', 5, 2], ['DP', 13, 11], ['Pi0', 7, 5], ['Pi0', 11, 10], ['Smol', 1, 1], ['Smol', 4, 4], ['Smol', 7, 5], ['Smol', 9, 7]]],
    isaac: [null,
      [[0, 0], [0, 0], [0, 0], [6, 3], [10, 0], [12, 0], [12, 8], [15, 0], [15, 2], [20, 0], [20, 3], [21, 0], [22, 1], [22, 9], [23, 4], [23, 15], [24, 0], [24, 0], [26, 1], [26, 1]],
      [[1, 1], [4, 2], [4, 2], [5, 1], [5, 3], [7, 2], [7, 4], [7, 4], [7, 5], [9, 3], [11, 11], [12, 6], [13, 3], [13, 8], [15, 5]]]
  };
  const NEP = [20, 27, 16], TASK = ['装玩具', '穿绳', '推 T'];
  /* paper values for the caption check */
  const PAPER = { f3: [[0.944, 0.076], [0.901, 0.174], [0.915, 0.108]], f9: [[0.897, 0.105], [0.918, 0.154], [0.950, 0.070]], f10: [[0.880, 0.127], [0.887, 0.123], [0.944, 0.047]], isaac: [null, [0.237, 0.270], [0.649, 0.196]] };

  /* ---------- toy physics: strain-based springs as in the code (scenes 5, 6) ---------- */
  const ROPE = { n: 24, L0: 0.2, m: 0.02, c: 2.0, drag: 3, fps: 30, sub: 24, r: 0.06 };
  function ropeSprings(nseg) {
    const sp = []; for (let i = 0; i < ROPE.n; i++) for (let j = i + 1; j <= Math.min(ROPE.n - 1, i + 2); j++) sp.push([i, j, (j - i) * ROPE.L0, Math.min(nseg - 1, Math.floor(((i + j) / 2) / (ROPE.n - 1) * nseg))]);
    return sp;
  }
  const CTRL = {
    end: t => { const x0 = -2.3; if (t < 1) return [x0, 0.25, 0]; if (t < 4) { const u = L.ease((t - 1) / 3); return [L.lerp(x0, -1.0, u), L.lerp(0.25, 2.5, u), 0]; } if (t < 8) { const u = L.ease((t - 4) / 4); return [L.lerp(-1.0, 0.6, u), 2.5, L.lerp(0, 1.4, u)]; } if (t < 11) { const u = L.ease((t - 8) / 3); return [0.6, L.lerp(2.5, 0.6, u), 1.4]; } return [0.6, 0.6, 1.4]; },
    mid: t => { if (t < 0.8) return [0, 0.25, 0]; if (t < 3.5) { const u = L.ease((t - 0.8) / 2.7); return [0, L.lerp(0.25, 1.9, u), 0]; } if (t < 7) { const u = L.ease((t - 3.5) / 3.5); return [L.lerp(0, 1.0, u), 1.9, L.lerp(0, -0.8, u)]; } if (t < 10) { const u = L.ease((t - 7) / 3); return [L.lerp(1.0, -0.6, u), L.lerp(1.9, 1.2, u), L.lerp(-0.8, 0.6, u)]; } return [-0.6, 1.2, 0.6]; },
    circle: t => { const x0 = -2.3; if (t < 1) return [x0, 0.25, 0]; if (t < 3.5) { const u = L.ease((t - 1) / 2.5); return [L.lerp(x0, -0.6, u), L.lerp(0.25, 2.6, u), 0]; } const a = (t - 3.5) * 0.9; return [-0.6 + 1.1 * Math.sin(a), 2.6, 1.1 - 1.1 * Math.cos(a)]; }
  };
  function simRope(Yseg, ctrl, dur) {
    const n = ROPE.n, nseg = Yseg.length, sp = ropeSprings(nseg), dt = 1 / (ROPE.fps * ROPE.sub), frames = Math.round(dur * ROPE.fps) + 1;
    const x = new Float64Array(n * 3), v = new Float64Array(n * 3), f = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) { x[i * 3] = -2.3 + i * ROPE.L0; x[i * 3 + 1] = ROPE.r; x[i * 3 + 2] = 0; }
    const c0 = ctrl(0), cs = []; for (let i = 0; i < n; i++) { const d = Math.hypot(x[i * 3] - c0[0], x[i * 3 + 1] - c0[1], x[i * 3 + 2] - c0[2]); if (d < 0.3) cs.push([i, d]); }
    const out = new Float32Array(frames * n * 3), strain = new Float32Array(frames * sp.length), drag = Math.exp(-dt * ROPE.drag), fr = Math.exp(-dt * 12);
    const rec = k => { for (let i = 0; i < n * 3; i++) out[k * n * 3 + i] = x[i]; for (let s = 0; s < sp.length; s++) { const [a, b, l] = sp[s]; strain[k * sp.length + s] = Math.hypot(x[b * 3] - x[a * 3], x[b * 3 + 1] - x[a * 3 + 1], x[b * 3 + 2] - x[a * 3 + 2]) / l - 1; } };
    rec(0);
    const spring = (ax, ay, az, bx, by, bz, avx, avy, avz, bvx, bvy, bvz, Y, l) => { let dx = bx - ax, dy = by - ay, dz = bz - az; const dl = Math.max(1e-6, Math.hypot(dx, dy, dz)); dx /= dl; dy /= dl; dz /= dl; const s = Y * (dl / l - 1) + ROPE.c * ((bvx - avx) * dx + (bvy - avy) * dy + (bvz - avz) * dz); return [s * dx, s * dy, s * dz]; };
    for (let k = 1; k < frames; k++) {
      for (let st = 0; st < ROPE.sub; st++) {
        const t = ((k - 1) * ROPE.sub + st + 1) * dt, cp = ctrl(t), cpp = ctrl(t - dt), cv = [(cp[0] - cpp[0]) / dt, (cp[1] - cpp[1]) / dt, (cp[2] - cpp[2]) / dt];
        f.fill(0);
        for (const [a, b, l, sg] of sp) { const F = spring(x[a * 3], x[a * 3 + 1], x[a * 3 + 2], x[b * 3], x[b * 3 + 1], x[b * 3 + 2], v[a * 3], v[a * 3 + 1], v[a * 3 + 2], v[b * 3], v[b * 3 + 1], v[b * 3 + 2], Yseg[sg], l); f[a * 3] += F[0]; f[a * 3 + 1] += F[1]; f[a * 3 + 2] += F[2]; f[b * 3] -= F[0]; f[b * 3 + 1] -= F[1]; f[b * 3 + 2] -= F[2]; }
        for (const [i, l] of cs) { const F = spring(cp[0], cp[1], cp[2], x[i * 3], x[i * 3 + 1], x[i * 3 + 2], cv[0], cv[1], cv[2], v[i * 3], v[i * 3 + 1], v[i * 3 + 2], 300, Math.max(0.05, l)); f[i * 3] -= F[0]; f[i * 3 + 1] -= F[1]; f[i * 3 + 2] -= F[2]; }
        for (let i = 0; i < n; i++) {
          v[i * 3] = (v[i * 3] + dt * f[i * 3] / ROPE.m) * drag; v[i * 3 + 1] = (v[i * 3 + 1] + dt * (f[i * 3 + 1] / ROPE.m - 9.8)) * drag; v[i * 3 + 2] = (v[i * 3 + 2] + dt * f[i * 3 + 2] / ROPE.m) * drag;
          if (x[i * 3 + 1] <= ROPE.r + 1e-4) { if (v[i * 3 + 1] < 0) v[i * 3 + 1] *= -0.2; v[i * 3] *= fr; v[i * 3 + 2] *= fr; }
          x[i * 3] += dt * v[i * 3]; x[i * 3 + 1] = Math.max(ROPE.r, x[i * 3 + 1] + dt * v[i * 3 + 1]); x[i * 3 + 2] += dt * v[i * 3 + 2];
        }
      }
      rec(k);
    }
    return { x: out, strain, frames, sp, cs: cs.map(c => c[0]) };
  }
  const ROPE_CACHE = {};
  function ropeRun(Yseg, ctrlKey, dur) { const key = Yseg.join(',') + '|' + ctrlKey + '|' + dur; return ROPE_CACHE[key] || (ROPE_CACHE[key] = simRope(Yseg, CTRL[ctrlKey], dur)); }

  /* system identification on the toy rope (scene 6), computed once */
  let SYSID = null;
  function sysid() {
    if (SYSID) return SYSID;
    const TRUE = [500, 120, 120, 500], DUR = 6, obs = ropeRun(TRUE, 'mid', DUR), n = ROPE.n;
    const loss = r => { let s = 0; for (let k = 0; k < r.frames; k++) for (let i = 0; i < n; i++) { const o = (k * n + i) * 3; s += Math.hypot(r.x[o] - obs.x[o], r.x[o + 1] - obs.x[o + 1], r.x[o + 2] - obs.x[o + 2]); } return s / (r.frames * n); };
    const evals = [];
    const G = [40, 66, 110, 180, 300, 500, 830, 1380];
    let best = null; for (const y of G) { const Ys = [y, y, y, y], r = ropeRun(Ys, 'mid', DUR), l = loss(r); evals.push({ stage: 1, Y: Ys, l, r }); if (!best || l < best.l) best = { Y: Ys, l }; }
    let cur = best.Y.slice(), curL = best.l;
    for (let round = 0; round < 2; round++) for (let sgi = 0; sgi < 4; sgi++) for (const k of [1.6, 1 / 1.6]) {
      const Ys = cur.slice(); Ys[sgi] = Math.round(Ys[sgi] * k); const r = ropeRun(Ys, 'mid', DUR), l = loss(r); evals.push({ stage: 2, Y: Ys, l, r, acc: l < curL }); if (l < curL) { cur = Ys; curL = l; }
      evals[evals.length - 1].best = cur.slice(); evals[evals.length - 1].bestL = curL;
    }
    let run = { Y: null, l: Infinity }; evals.forEach(e => { if (e.stage === 1) { if (e.l < run.l) run = { Y: e.Y, l: e.l }; e.best = run.Y.slice(); e.bestL = run.l; } });
    return (SYSID = { TRUE, obs, evals, DUR, stage1: best });
  }

  /* ---------- toy grasp (scene 7): 2-D soft block between two fingers ---------- */
  const GRASP_CACHE = {};
  function simGrasp(th, attach) {
    const key = th + '|' + attach; if (GRASP_CACHE[key]) return GRASP_CACHE[key];
    const nx = 5, ny = 5, s = 0.24, m = 0.015, Y = 10, c = 0.25, kc = 400, cn = 2, mu = 0.9, r = 0.06, fps = 30, sub = 40, dt = 1 / (fps * sub), dur = 12, frames = dur * fps + 1;
    const N = nx * ny, x = new Float64Array(N * 2), v = new Float64Array(N * 2), f = new Float64Array(N * 2);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; x[k * 2] = (i - (nx - 1) / 2) * s; x[k * 2 + 1] = r + j * s; }
    const sp = []; for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) { const d = Math.hypot(x[b * 2] - x[a * 2], x[b * 2 + 1] - x[a * 2 + 1]); if (d < 1.5 * s) sp.push([a, b, d]); }
    let xf = 0.9, fy = 0.03, locked = -1, glued = null, gl = null;
    const out = { x: new Float32Array(frames * N * 2), xf: new Float32Array(frames), fy: new Float32Array(frames), F: new Float32Array(frames * 2), locked: -1, N, sp, frames, th, attach };
    const H = 1.3;
    const rec = (k, FL, FR) => { for (let i = 0; i < N * 2; i++) out.x[k * N * 2 + i] = x[i]; out.xf[k] = xf; out.fy[k] = fy; out.F[k * 2] = FL; out.F[k * 2 + 1] = FR; };
    rec(0, 0, 0);
    for (let k = 1; k < frames; k++) {
      let FL = 0, FR = 0;
      for (let st = 0; st < sub; st++) {
        const t = ((k - 1) * sub + st + 1) * dt;
        let vx = 0, vy = 0;
        if (locked < 0) { vx = -0.15; } else if (t > locked + 0.6 && fy < 2.2) { vy = 0.4; }
        if (locked < 0 && xf <= 0.2) locked = t;
        xf += vx * dt; fy += vy * dt;
        f.fill(0);
        for (const [a, b, l] of sp) { let dx = x[b * 2] - x[a * 2], dy = x[b * 2 + 1] - x[a * 2 + 1]; const d = Math.max(1e-6, Math.hypot(dx, dy)); dx /= d; dy /= d; const S = Y * (d / l - 1) + c * ((v[b * 2] - v[a * 2]) * dx + (v[b * 2 + 1] - v[a * 2 + 1]) * dy); f[a * 2] += S * dx; f[a * 2 + 1] += S * dy; f[b * 2] -= S * dx; f[b * 2 + 1] -= S * dy; }
        let fl = 0, frr = 0; const fn = new Float64Array(N);
        for (let i = 0; i < N; i++) {
          const px = x[i * 2], py = x[i * 2 + 1]; if (py < fy - r || py > fy + H + r) continue;
          const pr = px + r - xf, pl = -xf - (px - r);
          if (pr > 0 && px > 0) { const F = Math.max(0, kc * pr + cn * (v[i * 2] - vx)); f[i * 2] -= F; frr += F; fn[i] = F; }
          if (pl > 0 && px < 0) { const F = Math.max(0, kc * pl + cn * (-vx - v[i * 2])); f[i * 2] += F; fl += F; fn[i] = F; }
        }
        FL = fl; FR = frr;
        if (locked < 0 && fl > th && frr > th) { locked = t; if (attach) { glued = []; gl = []; for (let i = 0; i < N; i++) if (fn[i] > 0) { glued.push(i); gl.push([x[i * 2], x[i * 2 + 1] - fy]); } } }
        for (let i = 0; i < N; i++) {
          v[i * 2] += dt * f[i * 2] / m; v[i * 2 + 1] += dt * (f[i * 2 + 1] / m - 9.8);
          if (fn[i] > 0 && !glued) { const vt = v[i * 2 + 1] - vy, dv = mu * fn[i] * dt / m; v[i * 2 + 1] -= Math.sign(vt) * Math.min(Math.abs(vt), dv); }
          x[i * 2] += dt * v[i * 2]; x[i * 2 + 1] += dt * v[i * 2 + 1];
          if (x[i * 2 + 1] < r) { x[i * 2 + 1] = r; if (v[i * 2 + 1] < 0) v[i * 2 + 1] = 0; v[i * 2] *= 0.98; }
        }
        if (glued) glued.forEach((i, q) => { x[i * 2] = gl[q][0]; x[i * 2 + 1] = gl[q][1] + fy; v[i * 2] = 0; v[i * 2 + 1] = vy; });
      }
      rec(k, FL, FR);
    }
    out.locked = locked;
    let ymin = 1e9; for (let i = 0; i < N; i++) ymin = Math.min(ymin, x[i * 2 + 1]); out.lift = ymin - r; out.finalFy = fy;
    return (GRASP_CACHE[key] = out);
  }

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    G.add(L.grid(40, 40));
    const P = [
      ['示范（GELLO）', [-11, 0.6, -3.5], COL.real, 9, [2.6, 1.2, 1.6]], ['手机扫描', [-11, 0.6, 2.2], COL.gs, 2, [2.6, 1.2, 1.6]],
      ['策略训练', [-6, 0.6, -3.5], COL.purple, 9, [2.6, 1.2, 1.6]], ['真机评测', [-6, 0.6, 2.2], COL.real, 10, [2.6, 1.2, 1.6]],
      ['3DGS + 对齐', [2, 0.6, -3.8], COL.gs, 3, [2.8, 1.2, 1.6]], ['颜色对齐', [2, 0.6, -1.2], COL.align, 4, [2.8, 1.2, 1.4]],
      ['PhysTwin', [6.4, 0.6, -3.8], COL.phys, 5, [2.8, 1.2, 1.6]], ['从视频辨识', [6.4, 0.6, -1.2], COL.phys, 6, [2.8, 1.2, 1.4]],
      ['env.step / render', [4.2, 0.6, 2.2], COL.white, 9, [4.6, 1.2, 1.6]], ['相关性 r、MMRV', [-1, 0.6, 6.2], COL.align, 10, [4.2, 1.2, 1.6]]
    ];
    const B = P.map(([t, pos, c, go, sz]) => { const b = block(sz[0], sz[1], sz[2], c, pos, { opacity: 0.88 }); b.userData.go = go - 1; PICKS.push(b); G.add(b, lab(t, [pos[0], pos[1] + 1.25, pos[2]], { size: 21, color: css(c) })); return b; });
    G.add(lab('真实世界', [-8.5, 2.6, -6.6], { size: 26, border: 'rgba(240,150,60,.7)' }), lab('仿真', [4.2, 2.6, -6.6], { size: 26, border: 'rgba(56,209,255,.7)' }));
    const pol = ['ACT', 'DP', 'π0', 'SmolVLA'], pc = [COL.ACT, COL.DP, COL.Pi0, COL.Smol];
    pol.forEach((t, i) => { const b = block(0.5, 0.5, 0.5, pc[i], [-7.0 + i * 0.65, 1.55, -3.5]); G.add(b); });
    const f = { a: stream(G, 5, COL.real), b: stream(G, 5, COL.gs), c: stream(G, 6, COL.phys), d: stream(G, 6, COL.purple), e: stream(G, 6, COL.align) };
    const st = ['示范 → 策略训练（只用真机数据，不混仿真数据）', '扫描 → 3DGS，切成机器人 / 物体 / 背景，位置和颜色对齐', 'PhysTwin：从人手交互视频辨识弹簧-质点孪生', '同一批检查点：真机跑一遍，仿真里从同一组初始摆放再跑一遍', '比较两边成功率：图 3 的 r 是 0.944、0.901、0.915'];
    return { update(p) {
      const q = (p * 16) % 1, k = Math.min(4, Math.floor(p * 5));
      B.forEach((b, i) => glow(b, ([[0, 2], [1, 4, 5], [6, 7], [3, 8], [9]][k].includes(i)) ? 0.7 : 0.05));
      f.a([[-11, 1.4, -3.5], [-6, 1.4, -3.5]], q, k >= 0 ? 1 : 0); f.b([[-11, 1.4, 2.2], [-4, 2.2, 0], [2, 1.4, -3.8], [2, 1.4, -1.2]], q, k >= 1 ? 1 : 0);
      f.c([[6.4, 1.4, -1.2], [6.4, 1.4, -3.8], [4.2, 1.4, 2.2]], q, k >= 2 ? 1 : 0); f.d([[-6, 1.4, -3.5], [-6, 1.4, 2.2], [4.2, 1.4, 2.2]], q, k >= 3 ? 1 : 0);
      f.e([[-6, 1.4, 2.2], [-1, 1.4, 6.2], [4.2, 1.4, 2.2]], q, k >= 4 ? 1 : 0);
      cap(st[k]);
    } };
  }

  /* ---------- shared: a sampled "scan" made of instanced ellipsoids ---------- */
  function samplePts(mesh, n, r, out, tag) {
    const g = mesh.geometry, pa = g.parameters || {};
    for (let i = 0; i < n; i++) {
      let p;
      if (g.type === 'BoxGeometry') { const f = Math.floor(r() * 6), a = r() - 0.5, b = r() - 0.5, w = pa.width, h = pa.height, d = pa.depth;
        p = [[w / 2, a * h, b * d], [-w / 2, a * h, b * d], [a * w, h / 2, b * d], [a * w, -h / 2, b * d], [a * w, b * h, d / 2], [a * w, b * h, -d / 2]][f]; }
      else if (g.type === 'CylinderGeometry') { const t = r() * 2 * PI, y = (r() - 0.5) * pa.height, rr = L.lerp(pa.radiusBottom, pa.radiusTop, y / pa.height + 0.5); p = [rr * Math.cos(t), y, rr * Math.sin(t)]; }
      else { const u = r() * 2 - 1, t = r() * 2 * PI, rr = pa.radius || 1, sq = Math.sqrt(1 - u * u); p = [rr * sq * Math.cos(t), rr * u, rr * sq * Math.sin(t)]; }
      out.push({ mesh, local: p, tag });
    }
  }
  function worldOf(pt) { const v = new THREE.Vector3(...pt.local).applyMatrix4(pt.mesh.matrixWorld); return [v.x, v.y, v.z]; }
  const GSCALE = [0.11, 0.05, 0.08];
  function gsCloud(G, pts, colors, r, o = {}) {
    const im = inst(BALL, pts.length, { opacity: o.opacity ?? 0.92 }); G.add(im); const qq = pts.map(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * PI, r() * PI, r() * PI)));
    const sc = pts.map(() => [GSCALE[0] * (0.7 + 0.6 * r()), GSCALE[1] * (0.7 + 0.6 * r()), GSCALE[2] * (0.7 + 0.6 * r())]);
    im.userData.draw = (P, C, vis) => { for (let i = 0; i < pts.length; i++) { const k = vis ? vis(i) : 1; setI(im, i, P[i], [sc[i][0] * k, sc[i][1] * k, sc[i][2] * k], qq[i]); colI(im, i, C[i]); } done(im); };
    return im;
  }
  function tableScene(G) {
    const top = block(9, 0.3, 5.5, COL.wood, [1.0, -0.15, 0], { edges: false }); G.add(top);
    const mat = block(6, 0.04, 4.2, COL.table, [1.6, 0.02, 0.2], { edges: false }); G.add(mat);
    const wall = block(9, 3.2, 0.2, COL.wall, [1.0, 1.6, -2.9], { edges: false }); G.add(wall);
    return { top, mat, wall };
  }

  /* ---------- scene 2: scanning ---------- */
  function s2(G) {
    let mode = +(OPT[0] ?? 0);
    const scn = new THREE.Group(); G.add(scn); scn.visible = false;
    const T = tableScene(scn); const arm = L.arm(COL.robot); arm.scale.setScalar(0.62); arm.position.set(-1.6, 0.04, 0); scn.add(arm); arm.userData.reach([0.6, 0.5, 0.6]);
    const toy = new THREE.Group(); scn.add(toy); const tb = L.sphere(0.45, COL.toy); tb.position.set(1.6, 0.45, 0.9); toy.add(tb); const th = L.sphere(0.3, COL.toy); th.position.set(1.6, 1.05, 0.9); toy.add(th);
    const box = block(1.3, 0.6, 1.0, 0xeaeef4, [3.3, 0.32, -0.6], { edges: false }); scn.add(box);
    scn.updateMatrixWorld(true);
    const r = L.rng(7), pts = [];
    samplePts(T.top, 260, r, pts, 'bg'); samplePts(T.mat, 180, r, pts, 'bg'); samplePts(T.wall, 220, r, pts, 'bg');
    arm.traverse(o => { if (o.isMesh && o.geometry.parameters) samplePts(o, o.geometry.type === 'BoxGeometry' ? 70 : 40, r, pts, 'robot'); });
    samplePts(tb, 120, r, pts, 'obj'); samplePts(th, 70, r, pts, 'obj'); samplePts(box, 110, r, pts, 'obj');
    const P = pts.map(worldOf);
    const base = pts.map(pt => { const c = pt.mesh.material.color; const j = 0.85 + 0.3 * r(); return [c.r * j, c.g * j, c.b * j]; });
    const segc = pts.map(pt => hex3(pt.tag === 'robot' ? COL.gs : pt.tag === 'obj' ? COL.phys : 0x7a8296));
    const phase = pts.map((pt, i) => Math.atan2(P[i][2], P[i][0] - 1));
    const cloud = gsCloud(G, pts, base, r);
    const phone = frustum(G, COL.align, 0.55);
    const tags = { robot: lab('机器人 · 跟着连杆动', [-2.2, 3.6, 0], { size: 19, color: css(COL.gs) }), obj: lab('物体 · 跟着粒子动', [2.6, 2.4, 1.2], { size: 19, color: css(COL.phys) }), bg: lab('背景 · 不动', [1.0, 3.6, -2.9], { size: 19, color: '#aab3c5' }) };
    Object.values(tags).forEach(s => G.add(s));
    const ctls = [{ label: '颜色', items: ['扫描原色', '分割上色'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const a = -PI + seg(p, 0, 0.45) * 2 * PI, cam = [1 + 6.2 * Math.cos(a), 2.6, 6.2 * Math.sin(a)];
      phone.position.set(...cam); phone.lookAt(1, 0.8, 0); phone.rotateY(PI); phone.visible = p < 0.5;
      const cov = (i) => { const d = ((a - phase[i]) % (2 * PI) + 2 * PI) % (2 * PI); return p >= 0.45 ? 1 : (d < seg(p, 0, 0.45) * 2 * PI + 0.2 ? 1 : 0); };
      const sm = mode === 1 ? 1 : seg(p, 0.55, 0.7);
      const C = base.map((c, i) => [L.lerp(c[0], segc[i][0], sm), L.lerp(c[1], segc[i][1], sm), L.lerp(c[2], segc[i][2], sm)]);
      const sp = seg(p, 0.75, 0.95), off = { robot: [-0.6, 0.5, 0], obj: [0.8, 0.9, 1.0], bg: [0, 0, -0.4] };
      const PP = P.map((q, i) => { const o = off[pts[i].tag]; return [q[0] + o[0] * sp, q[1] + o[1] * sp, q[2] + o[2] * sp]; });
      cloud.userData.draw(PP, C, cov);
      Object.values(tags).forEach(s => { s.visible = p > 0.6; });
      const n = pts.filter((pt, i) => cov(i)).length;
      cap(p < 0.45 ? `手机绕工作区一圈 · 已覆盖 <b>${n}</b> / ${pts.length} 个高斯（示意）` : p < 0.75 ? '在 SuperSplat 里手动切成三类：<b>机器人</b>、<b>物体</b>、<b>背景</b>' : '物体单独再扫一次，各自对齐到 PhysTwin 粒子或网格（表 II：每行一次扫描）');
    } };
  }

  /* ---------- scene 3: ICP + link assignment ---------- */
  function s3(G) {
    let big = +(OPT[0] ?? 0);
    const arm = L.arm(COL.robot, {}); arm.scale.setScalar(0.85); arm.position.set(0, 0, 0); arm.userData.reach([2.6, 0.9, 0.4]); arm.visible = false; G.add(arm); G.updateMatrixWorld(true);
    const LINKS = []; arm.traverse(o => { if (o.isMesh && o.geometry.parameters && o.geometry.type === 'BoxGeometry') LINKS.push(o); });
    const LC = [0x38d1ff, 0x4fc98a, 0xf2c14e, 0xff7a59, 0x9d8cff, 0xd45fa0, 0xe6ecf7];
    const r = L.rng(3), tgt = [], tl = [];
    LINKS.forEach((m, li) => { const pts = []; samplePts(m, 70, r, pts, li); pts.forEach(pt => { tgt.push(worldOf(pt)); tl.push(li); }); });
    const noisy = tgt.map(p => [p[0] + 0.03 * L.gauss(r), p[1] + 0.03 * L.gauss(r), p[2] + 0.03 * L.gauss(r)]);
    const runs = [0, 1].map(bg => {
      const ang = bg ? 1.9 : 0.42, ax = new THREE.Vector3(0.3, 1, 0.2).normalize(), q0 = new THREE.Quaternion().setFromAxisAngle(ax, ang), t0 = bg ? [1.6, 0.9, -1.2] : [0.7, 0.4, -0.5];
      const cc = centroid(noisy); let cur = noisy.map(p => add3(add3(rotP(q0, sub3(p, cc)), cc), t0));
      const it = [cur.map(p => p.slice())], err = [];
      const rms = A => Math.sqrt(A.reduce((s, p, i) => s + len3(sub3(p, noisy[i])) ** 2, 0) / A.length);
      for (let k = 0; k < 14; k++) {
        const nn = cur.map(p => { let b = 0, bd = 1e9; for (let j = 0; j < tgt.length; j++) { const d = (p[0] - tgt[j][0]) ** 2 + (p[1] - tgt[j][1]) ** 2 + (p[2] - tgt[j][2]) ** 2; if (d < bd) { bd = d; b = j; } } return b; });
        const Q = nn.map(j => tgt[j]), cp = centroid(cur), cq = centroid(Q);
        const R = hornRot(cur.map(p => sub3(p, cp)), Q.map(p => sub3(p, cq)));
        err.push(rms(cur)); cur = cur.map(p => add3(rotP(R, sub3(p, cp)), cq)); it.push(cur.map(p => p.slice()));
      }
      err.push(rms(cur));
      const assign = cur.map(p => { let b = 0, bd = 1e9; for (let j = 0; j < tgt.length; j++) { const d = (p[0] - tgt[j][0]) ** 2 + (p[1] - tgt[j][1]) ** 2 + (p[2] - tgt[j][2]) ** 2; if (d < bd) { bd = d; b = j; } } return tl[b]; });
      const correct = assign.filter((a, i) => a === tl[i]).length;
      return { it, err, assign, correct };
    });
    const tIm = inst(BALL, tgt.length); tIm.material.color.setHex(0xffffff); G.add(tIm); tgt.forEach((p, i) => setI(tIm, i, p, 0.028)); done(tIm);
    const sIm = inst(BALL, tgt.length); G.add(sIm);
    const bars = []; for (let k = 0; k < 15; k++) { const b = block(0.22, 1, 0.22, COL.gs, [-5.6 + k * 0.32, 0.5, 0.6], { edges: false }); G.add(b); bars.push(b); }
    G.add(lab('每轮残差 RMS', [-3.4, 3.2, 0.6], { size: 18 }));
    G.add(lab('白点：URDF 采样', [3.6, 4.4, 0], { size: 18 }), lab('彩色：扫描出的机器人高斯中心', [3.6, 3.8, 0], { size: 18, color: css(COL.gs) }));
    const ctls = [{ label: '初始错位', items: ['小（手动粗对齐后）', '大（约 109°）'], get: () => big, set: k => { big = k; } }];
    return { ctls, update(p) {
      const R = runs[big], u = seg(p, 0.05, 0.65) * 14, k = Math.min(13, Math.floor(u)), f = u - k, A = R.it[k], B = R.it[Math.min(14, k + 1)];
      const asg = p > 0.72;
      for (let i = 0; i < A.length; i++) { setI(sIm, i, [L.lerp(A[i][0], B[i][0], f), L.lerp(A[i][1], B[i][1], f), L.lerp(A[i][2], B[i][2], f)], 0.045); colI(sIm, i, hex3(asg ? LC[R.assign[i] % LC.length] : COL.gs)); } done(sIm);
      const mx = Math.max(...R.err); bars.forEach((b, i) => { const on = i <= Math.ceil(u); const h = Math.max(0.03, 2.4 * R.err[i] / mx) * (on ? 1 : 0.02); b.scale.y = h; b.position.y = h / 2; });
      const e = R.err[Math.min(14, Math.round(u))];
      cap(asg ? `按最近邻继承连杆编号：<b>${R.correct}</b> / ${tl.length} 个点分对${big ? '（没对齐，分配也跟着错）' : '（分错的多在连杆交界处）'}` : `ICP 第 <b>${Math.round(u)}</b> 轮 · 残差 RMS <b>${e.toFixed(3)}</b>${big ? '（错位太大，可能卡在局部极小：代码先用 RANSAC）' : ''}`);
    } };
  }

  /* ---------- scene 4: colour alignment with the matrices from the code ---------- */
  function s4(G) {
    let which = +(OPT[0] ?? 0), view = +(OPT[1] ?? 0);
    const MAT = [
      { A: [[-0.218, 1.491, 0.410, 1.006, -1.334, -0.439], [-0.396, 1.112, 0.665, 0.876, -0.996, -0.422], [-0.174, 0.438, 0.985, 0.452, -0.302, -0.579]], b: [0.162, 0.123, 0.070], name: '场景（机器人-桌面扫描）' },
      { A: [[0.601, -1.051, 1.045, -0.397, 2.049, -1.201], [0.252, -0.515, 0.650, -0.412, 1.572, -0.783], [0.394, -0.895, 0.707, -0.590, 1.731, -0.617]], b: [-0.116, -0.070, -0.156], name: '物体（树懒、盒子）' }];
    const BASE = [[0.10, 0.10, 0.12], [0.16, 0.15, 0.17], [0.55, 0.40, 0.26], [0.66, 0.50, 0.33], [0.88, 0.89, 0.92], [0.78, 0.80, 0.84], [0.80, 0.72, 0.60], [0.70, 0.62, 0.50], [0.85, 0.80, 0.72], [0.35, 0.37, 0.42], [0.60, 0.62, 0.66], [0.95, 0.95, 0.96]];
    const r = L.rng(5), P = []; BASE.forEach(c => { for (let k = 0; k < 14; k++) P.push(c.map(x => clamp(x + 0.05 * L.gauss(r), 0, 1))); });
    const tf = (M, p) => { const a = [p[0] * p[0], p[1] * p[1], p[2] * p[2], p[0], p[1], p[2]]; return M.A.map((row, o) => clamp(row.reduce((s, w, j) => s + w * a[j], 0) + M.b[o], 0, 1)); };
    const fits = MAT.map(M => { const Q = P.map(p => tf(M, p)); const coef = [0, 1, 2].map(ch => { let S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], y = [0, 0, 0]; P.forEach((p, i) => { const z = [1, p[ch], p[ch] * p[ch]]; for (let a = 0; a < 3; a++) { y[a] += z[a] * Q[i][ch]; for (let b = 0; b < 3; b++) S[a][b] += z[a] * z[b]; } });
        const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
        const D0 = det(S); return [0, 1, 2].map(c => det(S.map((row, i) => row.map((v, j) => j === c ? y[i] : v))) / D0); });
      const Fp = P.map(p => [0, 1, 2].map(ch => clamp(coef[ch][0] + coef[ch][1] * p[ch] + coef[ch][2] * p[ch] * p[ch], 0, 1)));
      const rmse = Math.sqrt(P.reduce((s, p, i) => s + [0, 1, 2].reduce((t, ch) => t + (Fp[i][ch] - Q[i][ch]) ** 2, 0), 0) / (P.length * 3));
      const shift = Math.sqrt(P.reduce((s, p, i) => s + [0, 1, 2].reduce((t, ch) => t + (p[ch] - Q[i][ch]) ** 2, 0), 0) / (P.length * 3));
      return { Q, Fp, rmse, shift }; });
    const SZ = 3.2, O = [-1.2, 0.2, -1.6], at = c => [O[0] + c[0] * SZ, O[1] + c[1] * SZ, O[2] + c[2] * SZ];
    const cube = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]].map(at); wire(G, cube, 0x8e9bb8, { opacity: 0.5 });
    [[[1, 0, 0], [1, 0, 1]], [[1, 1, 0], [1, 1, 1]], [[0, 1, 0], [0, 1, 1]]].forEach(([a, b]) => wire(G, [at(a), at(b)], 0x8e9bb8, { opacity: 0.5 }));
    G.add(lab('R', at([1.12, 0, 0]), { size: 20, color: '#ff7a7a' }), lab('G', at([0, 1.1, 0]), { size: 20, color: '#7aff9a' }), lab('B', at([0, 0, 1.15]), { size: 20, color: '#7ab0ff' }));
    const im = inst(BALL, P.length); G.add(im);
    const sw = [0, 1].map(k => { const g = new THREE.PlaneGeometry(4.2, 0.5, BASE.length, 1), m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3)); m.position.set(0.9, -0.5 - k * 0.75, 3.2); m.rotation.y = -0.6; G.add(m); return m; });
    G.add(lab('变换前', [-1.9, -0.5, 1.6], { size: 16 }), lab('变换后', [-1.9, -1.25, 1.6], { size: 16 }));
    const ctls = [{ label: '矩阵', items: ['场景', '物体'], get: () => which, set: k => { which = k; } }, { label: '显示', items: ['代码的变换', '论文式 (3) 逐通道拟合'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      const F = fits[which], u = seg(p, 0.15, 0.6), T = view ? F.Fp : F.Q;
      for (let i = 0; i < P.length; i++) { const c = [L.lerp(P[i][0], T[i][0], u), L.lerp(P[i][1], T[i][1], u), L.lerp(P[i][2], T[i][2], u)]; setI(im, i, at(c), 0.07); colI(im, i, c); } done(im);
      sw.forEach((m, k) => { const col = m.geometry.attributes.color, n = col.count, cols = BASE.length + 1; for (let v = 0; v < n; v++) { const ci = Math.min(BASE.length - 1, v % cols), c = k === 0 ? BASE[ci] : (view ? F.Fp[ci * 14] : F.Q[ci * 14]); col.setXYZ(v, c[0], c[1], c[2]); } col.needsUpdate = true; });
      cap(view ? `${MAT[which].name} · 用式 (3) 的逐通道二次多项式去拟合代码的变换：残差 RMS <b>${F.rmse.toFixed(3)}</b>（变换本身平均移动 ${F.shift.toFixed(3)}）。<b>逐通道表达不了通道混合</b>` : `${MAT[which].name} · 代码 color_A 是 3×6：输出的 R 同时取决于输入的 R、G、B 及其平方 · 颜色平均移动 RMS <b>${F.shift.toFixed(3)}</b>（0–1 刻度）`);
    } };
  }

  /* ---------- scene 5: the rope toy ---------- */
  function strainCol(e) { const k = clamp(e / 0.06, -1, 1); return k >= 0 ? [0.55 + 0.45 * k, 0.6 - 0.35 * k, 0.65 - 0.45 * k] : [0.55 + 0.1 * k, 0.6 - 0.05 * k, 0.65 - 0.35 * k]; }
  function s5(G) {
    let traj = +(OPT[0] ?? 0), stiff = +(OPT[1] ?? 1);
    floorRect(G, 0, 0, 9, 6, COL.table, { y: 0 }); G.add(L.grid(9, 18));
    const n = ROPE.n, nodes = inst(BALL, n); nodes.material.color.setHex(COL.rope); G.add(nodes);
    const sp = ropeSprings(1), lines = segs(G, sp.length);
    const ctrl = new THREE.Mesh(BALL, L.mat(COL.ctrl, { emissive: 0x551122 })); ctrl.scale.setScalar(0.12); G.add(ctrl);
    const cl = segs(G, 6, { opacity: 0.6 });
    const KEYS = ['end', 'mid', 'circle'], YS = [60, 250, 1000];
    const info = dynLab(G, [3.2, 3.4, -1.5], { size: 18 });
    const ctls = [{ label: '控制点', items: ['提起一端', '按住中间挑起', '画圈'], get: () => traj, set: k => { traj = k; } }, { label: '刚度 Y', items: ['软 60', '中 250', '硬 1000'], get: () => stiff, set: k => { stiff = k; } }];
    return { ctls, update(p) {
      const R = ropeRun([YS[stiff]], KEYS[traj], 12), k = Math.min(R.frames - 1, Math.round(p * (R.frames - 1))), o = k * n * 3;
      for (let i = 0; i < n; i++) setI(nodes, i, [R.x[o + i * 3], R.x[o + i * 3 + 1], R.x[o + i * 3 + 2]], 0.075); done(nodes);
      let mx = 0; R.sp.forEach(([a, b], s) => { const e = R.strain[k * R.sp.length + s]; mx = Math.max(mx, Math.abs(e)); lines.userData.set(s, [R.x[o + a * 3], R.x[o + a * 3 + 1], R.x[o + a * 3 + 2]], [R.x[o + b * 3], R.x[o + b * 3 + 1], R.x[o + b * 3 + 2]], strainCol(e)); }); lines.userData.done();
      const cp = CTRL[KEYS[traj]](k / ROPE.fps); ctrl.position.set(...cp);
      for (let q = 0; q < 6; q++) { const i = R.cs[q]; if (i == null) { cl.userData.set(q, cp, cp, [0, 0, 0]); continue; } cl.userData.set(q, cp, [R.x[o + i * 3], R.x[o + i * 3 + 1], R.x[o + i * 3 + 2]], hex3(COL.ctrl)); } cl.userData.done();
      info(`${n} 个节点 · ${R.sp.length} 根弹簧\n每帧 ${ROPE.sub} 子步 · t = ${(k / ROPE.fps).toFixed(1)} s`);
      cap(`Y = <b>${YS[stiff]}</b> · 最大应变 <b>${(mx * 100).toFixed(1)}%</b> · 控制点用 ${R.cs.length} 根弹簧接到绳上（PhysTwin 的做法）`);
    } };
  }

  /* ---------- scene 6: system identification ---------- */
  function s6(G) {
    floorRect(G, 0, 0, 9, 6, COL.table, { y: 0 });
    const SI = sysid(), n = ROPE.n, E = SI.evals;
    const obs = inst(BALL, n, { opacity: 0.45 }); obs.material.color.setHex(COL.real); G.add(obs);
    const sim = inst(BALL, n); sim.material.color.setHex(COL.sim); G.add(sim);
    const mxL = Math.max(...E.map(e => e.l));
    const bars = E.map((e, i) => { const b = block(0.16, 1, 0.16, e.stage === 1 ? COL.phys : COL.gs, [-2.6 + i * 0.22, 0.5, -2.6], { edges: false }); G.add(b); return b; });
    const lmin = Math.min(...E.map(e => e.l)), lh = l => 0.25 + 2.0 * Math.log(l / lmin) / Math.log(mxL / lmin);
    G.add(lab('每次评估的损失，对数高度（绿：第一段，蓝：第二段）', [0.0, 3.0, -2.6], { size: 17 }));
    const sb = [0, 1, 2, 3].map(s => [block(0.3, 1, 0.3, COL.real, [-4.8 + s * 0.8, 0.5, 1.9], { opacity: 0.6, edges: false }), block(0.3, 1, 0.3, COL.sim, [-4.45 + s * 0.8, 0.5, 1.9], { edges: false })]);
    sb.forEach(([a, b], s) => { G.add(a, b); G.add(lab(`段 ${s + 1}`, [-4.62 + s * 0.8, -0.35, 2.5], { size: 15 })); });
    G.add(lab('刚度：真值（橙）/ 估计（蓝）', [-3.6, 3.0, 1.9], { size: 17 }));
    const yh = y => 2.4 * Math.log(y / 20) / Math.log(1500 / 20);
    SI.TRUE.forEach((y, s) => { const h = yh(y); sb[s][0].scale.y = h; sb[s][0].position.y = h / 2; });
    return { update(p) {
      const u = seg(p, 0.0, 0.85) * (E.length - 1), ei = Math.round(u), e = E[ei];
      const fk = 45 + Math.floor((p * SCENES[5].dur * ROPE.fps) % (SI.obs.frames - 46));
      const o = fk * n * 3;
      for (let i = 0; i < n; i++) { setI(obs, i, [SI.obs.x[o + i * 3], SI.obs.x[o + i * 3 + 1], SI.obs.x[o + i * 3 + 2]], 0.085); setI(sim, i, [e.r.x[o + i * 3], e.r.x[o + i * 3 + 1], e.r.x[o + i * 3 + 2]], 0.07); } done(obs); done(sim);
      bars.forEach((b, i) => { const h = lh(E[i].l) * (i <= ei ? 1 : 0.02); b.scale.y = h; b.position.y = h / 2; glow(b, i === ei ? 0.8 : 0); });
      e.best.forEach((y, s) => { const h = yh(y); sb[s][1].scale.y = h; sb[s][1].position.y = h / 2; });
      const fin = E[E.length - 1];
      cap(e.stage === 1 ? `第一段（零阶）：试全局 Y = <b>${e.Y[0]}</b> · 损失 <b>${(e.l * 100).toFixed(1)}</b> cm · 目前最好 Y = ${e.best[0]}，${(e.bestL * 100).toFixed(1)} cm`
        : `第二段：逐段试探 [${e.Y.join(', ')}] · 损失 ${(e.l * 100).toFixed(1)} cm${e.acc ? ' ✓ 接受' : ''} · 当前 <b>[${e.best.join(', ')}]</b> ${(e.bestL * 100).toFixed(1)} cm（全局最好 ${(SI.stage1.l * 100).toFixed(1)} → 最终 ${(fin.bestL * 100).toFixed(1)}）`);
    } };
  }

  /* ---------- scene 7: grasp with a force threshold ---------- */
  function s7(G) {
    let ti = +(OPT[0] ?? 1), att = +(OPT[1] ?? 0);
    const TH = [1, 4, 10];
    floorRect(G, 0, 0, 6, 3, COL.table, { y: 0 });
    const N = 25, nodes = inst(BALL, N); nodes.material.color.setHex(COL.toy); G.add(nodes);
    const lines = segs(G, 72);
    const fL = block(0.16, 1.3, 0.8, COL.robot, [0, 0, 0]), fR = block(0.16, 1.3, 0.8, COL.robot, [0, 0, 0]); G.add(fL, fR);
    const bar = [0, 1].map(k => { const b = block(0.3, 1, 0.3, k ? COL.gs : COL.align, [2.8 + k * 0.5, 0.5, -0.5], { edges: false }); G.add(b); return b; });
    const thl = block(1.1, 0.03, 0.4, COL.bad, [3.05, 0, -0.5], { edges: false }); G.add(thl);
    G.add(lab('左 / 右手指法向力', [3.05, 3.3, -0.5], { size: 16 }));
    const st = dynLab(G, [-2.8, 3.0, -0.5], { size: 18 });
    const ctls = [{ label: '力阈值', items: ['低 1', '中 4', '高 10'], get: () => ti, set: k => { ti = k; } }, { label: '抓取', items: ['摩擦接触（本文）', '焊住节点（常见做法）'], get: () => att, set: k => { att = k; } }];
    const FS = 2.6 / 12;
    return { ctls, update(p) {
      const R = simGrasp(TH[ti], att === 1), k = Math.min(R.frames - 1, Math.round(p * (R.frames - 1))), o = k * N * 2;
      for (let i = 0; i < N; i++) setI(nodes, i, [R.x[o + i * 2], R.x[o + i * 2 + 1], 0], 0.07); done(nodes);
      R.sp.forEach(([a, b, l], s) => { if (s >= 72) return; const A = [R.x[o + a * 2], R.x[o + a * 2 + 1], 0], B = [R.x[o + b * 2], R.x[o + b * 2 + 1], 0]; lines.userData.set(s, A, B, strainCol(len3(sub3(B, A)) / l - 1)); }); lines.userData.done();
      const xf = R.xf[k], fy = R.fy[k]; fL.position.set(-xf - 0.08, fy + 0.65, 0); fR.position.set(xf + 0.08, fy + 0.65, 0);
      [R.F[k * 2], R.F[k * 2 + 1]].forEach((F, j) => { const h = Math.max(0.02, Math.min(3, F * FS)); bar[j].scale.y = h; bar[j].position.y = h / 2; });
      thl.position.y = TH[ti] * FS;
      const t = k / 30, lockT = R.locked; let ymin = 1e9; for (let i = 0; i < N; i++) ymin = Math.min(ymin, R.x[o + i * 2 + 1]);
      st(t < lockT || lockT < 0 ? '合拢中' : t < lockT + 0.6 ? '两指都过阈值 → 停止合拢' : '提起');
      const lifted = ymin - 0.06, slip = t > lockT + 1.5 && lifted < 0.3 * (fy - 0.03);
      cap(lockT < 0 ? '合拢中……' : `t = ${lockT.toFixed(2)} s 时两指力都超过 <b>${TH[ti]}</b> · 手指上升 ${(fy - 0.03).toFixed(2)} · 物体离地 <b>${Math.max(0, lifted).toFixed(2)}</b>${slip ? ' · <b>滑脱</b>：摩擦撑不住重量' : (t > lockT + 1.5 ? ' · 抓住了' : '')}${att ? '（焊住模式下总能提起）' : ''}`);
    } };
  }

  /* ---------- scene 8: LBS ---------- */
  function s8(G) {
    let mode = +(OPT[0] ?? 0);
    const nx = 12, nz = 3, dx = 0.32, dz = 0.3, y0 = 0.9, Lx = (nx - 1) * dx;
    const rest = []; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) rest.push([-Lx / 2 + i * dx, y0, (j - 1) * dz]);
    const nb = rest.map((p, a) => rest.map((q, b) => [b, len3(sub3(p, q))]).filter(([b, d]) => b !== a && d < 1.5 * dx).map(([b]) => b));
    const deform = (amt) => { const phi = 2.6 * amt, tw = 0.9 * amt; return rest.map(([x, y, z]) => { const s = x + Lx / 2, a = phi * (s / Lx) - phi / 2, Rb = phi > 1e-4 ? Lx / phi : 1e9;
        const px = phi > 1e-4 ? Rb * Math.sin(a) : x, py = phi > 1e-4 ? y0 + Rb * (1 - Math.cos(a)) - Rb * (1 - Math.cos(phi / 2)) : y0;
        const ta = tw * (s / Lx - 0.5), cz = z * Math.cos(ta), cy = z * Math.sin(ta); return [px, py + cy + 0.9 * amt, cz]; }); };
    const r = L.rng(21), NG = 160, gp = [], gq = [], gs = [];
    for (let i = 0; i < NG; i++) { gp.push([(r() - 0.5) * Lx, y0 + (r() - 0.5) * 0.06, (r() - 0.5) * 0.75]); gq.push(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (r() - 0.5) * 0.5, 0))); gs.push([0.17, 0.03, 0.07]); }
    const K = 4, W = gp.map(p => { const d = rest.map((q, k) => [k, len3(sub3(p, q))]).sort((a, b) => a[1] - b[1]).slice(0, K); const w = d.map(([k, dd]) => 1 / (dd + 1e-6)), s = w.reduce((a, b) => a + b, 0); return d.map(([k], i) => [k, w[i] / s]); });
    const nodes = inst(BALL, rest.length); nodes.material.color.setHex(COL.phys); G.add(nodes);
    const gim = inst(BALL, NG, { opacity: 0.9 }); G.add(gim);
    const ax = segs(G, NG, { opacity: 0.8 });
    const title = dynLab(G, [0, -0.4, 0.8], { size: 20, border: 'rgba(79,201,138,.7)' });
    const NAMES = ['LBS，只移中心（代码）', 'LBS + 转朝向（PhysTwin 式 7）', '只按权重平移（不求旋转）'];
    const ctls = [{ label: '更新方式', items: ['代码', 'PhysTwin 式 7', '只平移'], get: () => mode, set: k => { mode = k; } }];
    const cache = {};
    function solve(amt) {
      const key = amt.toFixed(3); if (cache[key]) return cache[key];
      const def = deform(amt), Rk = rest.map((p, a) => hornRot(nb[a].map(b => sub3(rest[b], p)), nb[a].map(b => sub3(def[b], def[a]))));
      const out = gp.map((mu, g) => { let c = [0, 0, 0], qa = [0, 0, 0, 0]; const ref = Rk[W[g][0][0]];
        W[g].forEach(([k, w]) => { const t = mode === 2 ? add3(mu, sub3(def[k], rest[k])) : add3(rotP(Rk[k], sub3(mu, rest[k])), def[k]); c = add3(c, t.map(x => x * w)); const q = Rk[k], sg = (q.x * ref.x + q.y * ref.y + q.z * ref.z + q.w * ref.w) < 0 ? -1 : 1; qa[0] += w * sg * q.x; qa[1] += w * sg * q.y; qa[2] += w * sg * q.z; qa[3] += w * sg * q.w; });
        const qb = new THREE.Quaternion(qa[0], qa[1], qa[2], qa[3]).normalize(); const qf = mode === 1 ? qb.multiply(gq[g].clone()) : gq[g].clone(); return { c, q: qf }; });
      let ang = 0; out.forEach((o, g) => { const k0 = W[g][0][0], i0 = k0 % nx, j0 = Math.floor(k0 / nx), a = j0 * nx + Math.max(0, i0 - 1), b = j0 * nx + Math.min(nx - 1, i0 + 1); const tg = sub3(def[b], def[a]), tl = len3(tg), axv = new THREE.Vector3(1, 0, 0).applyQuaternion(o.q);
        ang += Math.acos(clamp(Math.abs((axv.x * tg[0] + axv.y * tg[1] + axv.z * tg[2]) / tl), 0, 1)); });
      const rr = { def, out, ang: ang / NG * 180 / PI }; if (Object.keys(cache).length > 400) for (const k in cache) delete cache[k]; return (cache[key] = rr);
    }
    let lastMode = mode;
    return { ctls, update(p) {
      if (lastMode !== mode) { for (const k in cache) delete cache[k]; lastMode = mode; }
      const amt = Math.round(seg(p, 0.05, 0.6) * 200) / 200, Sx = solve(amt);
      Sx.def.forEach((q, i) => setI(nodes, i, q, 0.06)); done(nodes);
      Sx.out.forEach((o, g) => { setI(gim, g, o.c, gs[g], o.q); colI(gim, g, hex3(COL.toy)); const a = new THREE.Vector3(0.22, 0, 0).applyQuaternion(o.q); ax.userData.set(g, sub3(o.c, [a.x, a.y, a.z]), add3(o.c, [a.x, a.y, a.z]), hex3(COL.gs)); }); done(gim); ax.userData.done();
      title(NAMES[mode]);
      const s0 = solve(0);
      cap(`弯曲 ${(amt * 149).toFixed(0)}° · 椭球长轴和局部切线的平均夹角 <b>${Sx.ang.toFixed(1)}°</b>（未变形时 ${s0.ang.toFixed(1)}°）${mode === 0 && amt > 0.5 ? ' · 椭球没跟着转' : ''}`);
    } };
  }

  /* ---------- inset renderers (scenes 9, 11) ---------- */
  let INS = null;
  function insets() {
    if (INS) return INS;
    const mk = id => { const c = $(id); const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: false }); r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setSize(c.clientWidth || 180, c.clientHeight || 135, false); r.setClearColor(0x0b1020); return r; };
    try { INS = [mk('ins0'), mk('ins1')]; } catch (e) { INS = []; }
    return INS;
  }
  let HELP = [];
  function insetRender(r, cam) { const hid = LABS.concat(HELP), v = hid.map(s => s.visible); hid.forEach(s => { s.visible = false; }); r.render(S.scene, cam); hid.forEach((s, i) => { s.visible = v[i]; }); }
  function showInsets(on, t0, t1) { $('renders').hidden = !on; if (on) { $('insc0').textContent = t0; $('insc1').textContent = t1; } }

  function sceneRig(G, o = {}) {
    const T = tableScene(G);
    const arm = L.arm(COL.robot); arm.scale.setScalar(0.62); arm.position.set(-1.6, 0.04, 0); G.add(arm);
    const toy = new THREE.Group(); const tb = L.sphere(0.32, COL.toy), th = L.sphere(0.22, COL.toy); th.position.y = 0.42; toy.add(tb, th);
    [[-0.32, 0.05, 0.12], [0.32, 0.05, 0.12], [-0.22, -0.22, 0.2], [0.22, -0.22, 0.2]].forEach(q => { const l = L.sphere(0.12, COL.toy); l.position.set(...q); toy.add(l); });
    toy.position.set(1.2, 0.32, 1.1); G.add(toy);
    const box = block(1.1, 0.55, 0.9, 0xeaeef4, [2.9, 0.3, -1.0], { edges: false }); G.add(box);
    const deco = []; const r = L.rng(17); for (let i = 0; i < 26; i++) { const b = block(0.3 + r() * 0.6, 0.2 + r() * 1.4, 0.12, [0x5a6378, 0x6b5a48, 0x445066, 0x8a7a66][i % 4], [-3 + r() * 8, 1.2 + r() * 1.3, -2.75], { edges: false }); G.add(b); deco.push(b); }
    const pole = block(0.08, 2.8, 0.08, 0x9aa6bf, [5.0, 1.4, 2.4], { edges: false }); G.add(pole);
    const fixedCam = new THREE.PerspectiveCamera(48, 4 / 3, 0.05, 60); fixedCam.position.set(4.9, 3.0, 2.6); fixedCam.lookAt(1.0, 0.4, 0); G.add(fixedCam);
    const fixedF = frustum(G, COL.align, 0.5); fixedF.position.copy(fixedCam.position); fixedF.quaternion.copy(fixedCam.quaternion); HELP.push(fixedF, pole);
    const wristCam = new THREE.PerspectiveCamera(70, 4 / 3, 0.03, 60); arm.userData.wrist.add(wristCam); wristCam.position.set(0.6, -0.5, 0); wristCam.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(0.6, -0.5, 0), new THREE.Vector3(-1.4, 1.2, 0), new THREE.Vector3(0, -1, 0)));
    const wristF = frustum(arm.userData.wrist, COL.gs, 0.35); wristF.position.copy(wristCam.position); wristF.quaternion.copy(wristCam.quaternion); HELP.push(wristF);
    [T.top, T.mat, T.wall, pole, ...deco].forEach(m => m.traverse(x => x.layers.enable(1)));
    [arm, toy, box].forEach(m => m.traverse(x => x.layers.enable(2)));
    return { T, arm, toy, box, fixedCam, wristCam };
  }
  function pickPlace(R, p) {
    const A = [1.2, 0.95, 1.1], A0 = [1.2, 0.75, 1.1], Bp = [2.9, 1.5, -1.0], B0 = [2.9, 1.0, -1.0], H = [0.4, 1.6, 0.4];
    const ph = [[0, 0.18, H, A], [0.18, 0.27, A, A0], [0.27, 0.34, A0, A0], [0.34, 0.6, A0, Bp], [0.6, 0.7, Bp, B0], [0.7, 0.78, B0, B0], [0.78, 1.0, B0, H]];
    let tgt = H, grip = 0; for (const [a, b, s, e] of ph) if (p >= a && p <= b) { const u = L.ease((p - a) / (b - a)); tgt = [L.lerp(s[0], e[0], u), L.lerp(s[1], e[1], u), L.lerp(s[2], e[2], u)]; }
    grip = p < 0.27 ? 0 : p < 0.34 ? (p - 0.27) / 0.07 : p < 0.7 ? 1 : p < 0.78 ? 1 - (p - 0.7) / 0.08 : 0;
    R.arm.userData.reach(tgt); const w = R.arm.userData; w.f1.position.x = -0.22 + 0.1 * grip; w.f2.position.x = 0.22 - 0.1 * grip;
    const held = p >= 0.34 && p < 0.74; if (held) { R.toy.position.set(tgt[0], tgt[1] - 0.95, tgt[2]); R.toy.children[0].position.y = -0.08 * Math.sin(p * 40) * 0.3; } else if (p >= 0.74) R.toy.position.set(2.9, 0.62, -1.0); else R.toy.position.set(1.2, 0.32, 1.1);
    return { tgt, grip, held };
  }

  /* ---------- scene 9: closed loop ---------- */
  function s9(G) {
    const R = sceneRig(G);
    const steps = ['两路图像 + 末端状态', '策略：动作块 50 步', 'env.step：关节速度控制\n667 子步物理', '连杆刚体变换 + LBS', 'env.render：两路相机'];
    const B = steps.map((t, i) => { const b = block(2.1, 0.5, 0.9, [COL.gs, COL.purple, COL.phys, COL.toy, COL.align][i], [-4.2 + i * 2.5, -0.6, 4.4], { opacity: 0.9 }); G.add(b, lab(t, [-4.2 + i * 2.5, 0.35, 4.4], { size: 15 })); return b; });
    const fl = stream(G, 8, COL.white, 0.08);
    return { update(p) {
      pickPlace(R, p); G.updateMatrixWorld(true);
      const k = Math.floor((p * 14 * 2) % 5); B.forEach((b, i) => glow(b, i === k ? 0.8 : 0.05));
      fl([[-4.2, -0.3, 5.0], [5.8, -0.3, 5.0]], (p * 6) % 1, 1);
      const I = insets(); if (I.length) { showInsets(true, '腕部 D405（渲染）', '固定 D455（渲染）'); insetRender(I[0], R.wristCam); insetRender(I[1], R.fixedCam); }
      cap(['观测：两路渲染图像 + 末端状态', '策略输出一段动作（ACT / SmolVLA / π0 执行 50 步）', 'env.step：动作按真机同样的关节速度控制执行，物理跑子步', '把粒子和连杆的新状态传给高斯', 'env.render：从腕部和固定相机渲染下一帧'][k] + ` · ${p < 0.34 ? '接近玩具' : p < 0.74 ? '提起，移向盒子' : '放下，撤回'}`);
    } };
  }

  /* ---------- scene 10: correlation, computed from the read-out points ---------- */
  function s10(G) {
    let srcI = +(OPT[0] ?? 0), task = +(OPT[1] ?? 0), hl = +(OPT[2] ?? 0);
    const W = 8, X0 = -4, Y0 = 0.4, px = x => X0 + x * W, py = y => Y0 + y * W;
    const frame = [[px(0), py(0), 0], [px(1), py(0), 0], [px(1), py(1), 0], [px(0), py(1), 0], [px(0), py(0), 0]]; wire(G, frame, 0x8e9bb8, { opacity: 0.7 });
    for (let t = 0.25; t < 1; t += 0.25) { wire(G, [[px(t), py(0), 0], [px(t), py(1), 0]], 0x4a5878, { opacity: 0.35 }); wire(G, [[px(0), py(t), 0], [px(1), py(t), 0]], 0x4a5878, { opacity: 0.35 }); }
    [0, 0.5, 1].forEach(t => { G.add(lab(t.toFixed(1), [px(t), py(0) - 0.55, 0], { size: 15 }), lab(t.toFixed(1), [px(0) - 0.6, py(t), 0], { size: 15 })); });
    G.add(lab('真机成功率 →', [px(0.5), py(0) - 1.25, 0], { size: 17 }), lab('仿真成功率 ↑', [px(1) - 1.2, py(1) + 0.5, 0], { size: 17 }));
    wire(G, [[px(0), py(0), 0], [px(1), py(1), 0]], 0xaab3c5, { dashed: true, opacity: 0.7, dash: 0.25, gap: 0.18 });
    const pts = inst(BALL, 20); G.add(pts); const eb = segs(G, 40, { opacity: 0.55 }); const vl = segs(G, 20, { opacity: 0.95 });
    const title = () => {};
    const stat = dynLab(G, [px(0.5), py(0) - 2.5, 0], { size: 16, border: 'rgba(56,209,255,.7)' });
    const legend = [['ACT', COL.ACT], ['DP', COL.DP], ['π0', COL.Pi0], ['SmolVLA', COL.Smol]].map(([t, c], i) => { const s = lab(t, [px(1) + 1.4 + (i % 2) * 2.0, py(0.15) - Math.floor(i / 2) * 0.7, 0], { size: 16, color: css(c) }); G.add(s); return s; });
    const SRC = ['图 3（正文）', '图 9（扩大到 200 次）', '图 10（回放）', 'IsaacLab（图 3 右）'];
    const ctls = [{ label: '来源', items: SRC, get: () => srcI, set: k => { srcI = k; } }, { label: '任务', items: TASK, get: () => task, set: k => { task = k; } }, { label: '错排连线', items: ['SIMPLER 定义', '本文实现'], get: () => hl, set: k => { hl = k; } }];
    return { ctls, update(p) {
      const n = NEP[task]; let rows, colr;
      if (srcI === 3) { rows = D.isaac[task] ? D.isaac[task].map(([a, b]) => ['I', a / n, b / n, a, b, n]) : null; }
      else { const key = ['f3', 'f9', 'f10'][srcI]; rows = D[key][task].map(([pol, a, b]) => [pol, a / n, srcI === 1 ? b : b / n, a, srcI === 1 ? Math.round(b * 200) : b, srcI === 1 ? 200 : n]); }
      legend.forEach(s => { s.visible = srcI !== 3; });
      if (!rows) { pts.visible = false; eb.visible = false; vl.visible = false; title(`IsaacLab · ${TASK[task]}`); stat('—'); cap('装玩具在 IsaacLab 里抓取和形变不能稳定模拟，任务做不出来，论文没有这一格'); return; }
      pts.visible = eb.visible = vl.visible = true;
      const R = rows.map(r => r[1]), Sv = rows.map(r => r[2]), show = seg(p, 0, 0.5) * rows.length;
      const rr = pearson(R, Sv), mS = mmrvSimpler(Sv, R), mO = mmrvSimpler(R, Sv);
      for (let i = 0; i < 20; i++) {
        if (i >= rows.length || i >= show) { setI(pts, i, [0, -50, 0], 0.001); eb.userData.set(i * 2, [0, -50, 0], [0, -50, 0], [0, 0, 0]); eb.userData.set(i * 2 + 1, [0, -50, 0], [0, -50, 0], [0, 0, 0]); continue; }
        const [pol, x, y, kx, ky, ny] = rows[i], c = hex3(srcI === 3 ? COL.isaac : COL[pol]); setI(pts, i, [px(x), py(y), 0.05 * (i % 3)], 0.16); colI(pts, i, c);
        const cx = cpInt(kx, n), cy = cpInt(ky, ny); eb.userData.set(i * 2, [px(cx[0]), py(y), 0], [px(cx[1]), py(y), 0], [0.6, 0.65, 0.75]); eb.userData.set(i * 2 + 1, [px(x), py(cy[0]), 0], [px(x), py(cy[1]), 0], [0.6, 0.65, 0.75]);
      }
      done(pts); eb.userData.done();
      const M = hl ? mO : mS, on = p > 0.55;
      for (let i = 0; i < 20; i++) { const j = i < rows.length ? M.worst[i] : -1; if (!on || j < 0) { vl.userData.set(i, [0, -50, 0], [0, -50, 0], [0, 0, 0]); continue; } vl.userData.set(i, [px(R[i]), py(Sv[i]), 0.1], [px(R[j]), py(Sv[j]), 0.1], hex3(hl ? COL.align : COL.bad)); } vl.userData.done();
      title(`${SRC[srcI]} · ${TASK[task]} · ${rows.length} 个检查点`);
      const pv = srcI === 3 ? PAPER.isaac[task] : PAPER[['f3', 'f9', 'f10'][srcI]][task];
      stat(`${SRC[srcI]} · ${TASK[task]} · ${rows.length} 个点\nr = ${rr.toFixed(3)}（论文 ${pv[0].toFixed(3)}）  MMRV 本文 = ${mO.v.toFixed(3)}（论文 ${pv[1].toFixed(3)}）  MMRV SIMPLER = ${mS.v.toFixed(3)}`);
      cap(on ? `${hl ? '本文实现' : 'SIMPLER 定义'}：每个点连到它最严重的错排对象 · ${hl ? '按仿真成绩差' : '按真机成绩差'}加权 · MMRV = <b>${M.v.toFixed(3)}</b>` : `r = <b>${rr.toFixed(3)}</b>，和论文一致 · 误差棒是 Clopper–Pearson 95% 区间（每点 ${n} 次${srcI === 1 ? '，仿真 200 次' : ''}）`);
    } };
  }

  /* ---------- scene 11: green screen vs GS ---------- */
  function s11(G) {
    const R = sceneRig(G); let bgTex = null, rt = null;
    G.add(lab('固定相机：绿幕背景照片从这里拍', [5.2, 3.9, 2.6], { size: 16, color: css(COL.align) }));
    const path = t => [L.lerp(0.2, 2.6, 0.5 + 0.5 * Math.sin(t * 2 * PI)), 1.4 + 0.25 * Math.sin(t * 4 * PI), L.lerp(1.4, -0.2, 0.5 + 0.5 * Math.cos(t * 2 * PI))];
    return { update(p) {
      const tg = path(p); R.arm.userData.reach(tg); R.toy.position.set(1.2, 0.32, 1.1); G.updateMatrixWorld(true);
      const I = insets();
      if (I.length) {
        showInsets(true, '绿幕：固定照片 + 仿真前景', '3DGS：整个场景从腕部渲染');
        if (!rt) { rt = new THREE.WebGLRenderTarget(360, 270); const keep = R.fixedCam.layers.mask; R.fixedCam.layers.set(1); I[0].setRenderTarget(rt); I[0].render(S.scene, R.fixedCam); I[0].setRenderTarget(null); R.fixedCam.layers.mask = keep; bgTex = rt.texture; }
        const old = S.scene.background, keepW = R.wristCam.layers.mask; S.scene.background = bgTex; R.wristCam.layers.set(2); I[0].render(S.scene, R.wristCam); S.scene.background = old; R.wristCam.layers.mask = keepW;
        insetRender(I[1], R.wristCam);
      }
      cap('腕部相机在动：上小窗的背景永远是固定相机那张照片，桌子和墙不随视角变；下小窗整个场景是三维的，背景跟着视角正确变化');
    }, dispose() { if (rt) rt.dispose(); } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player (same as interactives/phc and latent) ---------- */
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
    L.clear(root); LABS = []; PICKS = []; HELP = []; lastCap = null; showInsets(false);
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
  window.__r2sDebug = { D, pearson, mmrvSimpler, cpInt, sysid, simGrasp, ropeRun, get cap() { return $('cap').textContent; } };
})();
