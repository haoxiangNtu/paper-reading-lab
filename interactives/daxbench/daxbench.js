'use strict';
/* DaXBench (arXiv 2210.13066) taken apart into eleven animated scenes. Tables are copied from the paper; Fig. 3 numbers
   are a vector read-out of the PDF; simulator details come from the official code at commit bc73c58 (Apache-2.0 root licence).
   Each scene's update(p) is a pure function of the timeline p plus the current toggles. Scenes 3, 4, 7 and 9 run small toy
   computations in the page (a 2D MLS-MPM, the cloth mass-spring with the code's constants, the reward, a 1D landscape);
   they are toys and are labelled so. No DaX code runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const PI = Math.PI;
  const COL = { sim: 0x38d1ff, mpm: 0x3aa8e0, cloth: 0xe6ecf7, rope: 0xf2e6c8, water: 0x3aa8e0, task: 0x9d8cff, nd: 0x8e9bb8, diff: 0x4fc98a, grad: 0x4fc98a, fwd: 0xeef2fa, gold: 0xf2c14e, warn: 0xff7a59, bad: 0xe05d5d, ok: 0x4fc98a, dim: 0x46506a, white: 0xeef2fa, purple: 0x9d8cff, blue: 0x7cb8ff, orange: 0xf0963c, wood: 0x6a4a32 };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  /* ---------- data copied from the paper (tables) and from the code ---------- */
  const TK = ['Fold-Cloth-1', 'Fold-Cloth-3', 'Fold-T-shirt', 'Unfold-Cloth-1', 'Unfold-Cloth-3', 'Push-Rope', 'Whip-Rope', 'Pour-Water', 'Pour-Soup'];
  const TKS = ['叠布 1', '叠布 3', '叠 T 恤', '展开 1', '展开 3', '推绳', '甩绳', '倒水', '倒汤'];
  const HP = [3, 4, 4, 10, 10, 6, 70, 100, 100], HC = [3, 4, 5, 15, 15, 6, 70, 100, 120];
  const T3 = { Transporter: [.19, .40, .46, .48, .30, .70, null, null, null], ILD: [.76, .82, .59, .64, .52, .76, .70, .32, .42], 专家: [.91, .89, .85, .87, .87, .93, 1.0, .91, .85],
    'CEM-MPC': [.74, .62, .58, .57, .57, .71, .34, .58, .56], 'Diff-MPC': [.29, .14, .29, .30, .26, .70, .37, .30, .44], 'Diff-CEM-MPC': [.80, .66, .66, .67, .58, .71, .33, .58, .55] };
  const T4 = { PPO: [.40, .21, .61, .72, .56, .75, .25, .27, .27], APG: [.36, .19, .40, .42, .39, .72, .83, .27, .27], SHAC: [.34, .22, .44, .50, .48, .75, .66, .28, .32] };
  const F3E = { PPO: [null, .16, .61, .70, .58, .75, .03, .16, .18], APG: [null, .09, .32, .30, .22, .70, .83, .15, .30], SHAC: [null, .23, .23, .16, .09, .59, .66, .09, .33] };
  const RGB = [.86, .56, .83, .76, .70, .86, null, null, null];

  const SCENES = [
    { n: 1, part: '总览', title: '一个仿真器、九个任务、八个方法', sub: '点方块跳到对应那一幕；绿色是用梯度的方法', dur: 14, cam: [0.0, 1.05, 35, [1.6, 2.4, 0.6]],
      html: dl([['仿真器', 'DaX：JAX 写的 MLS-MPM（液体、绳）+ 质点-弹簧（布）'], ['任务', '9 个：倒水、倒汤、推绳、甩绳、叠布 ×2、叠 T 恤、展开 ×2'], ['方法', '强化：PPO / APG、SHAC；模仿：Transporter / ILD；规划：CEM-MPC / diff-MPC、diff-CEM-MPC'], ['接口', 'Gym 风格；step_diff(actions, state) 可求导']]) +
        '<p>论文的核心是同一套任务上“不用梯度”和“用梯度”的方法成对比较。每一类里，灰色是不用梯度的，绿色是穿过 DaX 求梯度的。白色流是动作进仿真器，绿色流是梯度从奖励流回动作或策略。</p>' +
        '<p>代码只发布了 PPO、APG、SHAC 三个；右边灰框里虚线标出的五个没有代码。</p>' + src('§1 · 表 2 · README') },
    { n: 2, part: '§3.1 JAX', title: '批量环境一起前向，再一起反传', sub: '切换设备数；白色是前向，绿色是 jax.grad 的反传', dur: 13, cam: [0.0, 1.0, 30, [0, 1.6, 0]],
      html: dl([['jit', 'step_diff 整体编译（basic/*_env.py）'], ['vmap', '仿真器的 step 按批维向量化（mpm_simulator.py:62-63）'], ['pmap', 'APG / PPO 在多卡上复制（apg.py:272）'], ['grad', '−Σ reward 对动作求导（附录 A.2 列表 2）'], ['速度', '4 × 2080 Ti，128 条 × 80 步，前向 + 反传 3 s（A.3，未核实）']]) +
        '<p>DaX 的环境状态是一组带批维的数组。一次 <code>step_diff</code> 把整批环境向前推一个宏步，返回观测、奖励和新状态；对它套 <code>jax.grad</code> 就得到奖励对每个环境的动作的梯度。多张卡时每张卡分一部分环境，梯度在卡间取平均（<code>jax.lax.pmean</code>）。</p>' +
        '<p>附录 A.2 的例子是 32 个并行的 fold_cloth3 环境，这里也画 32 个。</p>' + guess('每个小方块代表一个环境，里面的小绳子是装饰。') + src('§3.1 · 附录 A.2、A.3 · 代码') },
    { n: 3, part: '附录 A.1 MPM', title: 'MLS-MPM 的一个子步：粒子 → 网格 → 粒子', sub: '二维玩具当场算；切换材料看压下去再抬起后的样子', dur: 16, cam: [0.0, 1.38, 30, [1.6, 5.2, 0]],
      html: dl([['P2G', '每个粒子用二次 B 样条把质量、动量和应力散到 3×3（三维 27）个网格点'], ['网格', '除质量得速度，加重力，处理夹爪和边界'], ['G2P', '插值回粒子速度和仿射矩阵 C，更新位置'], ['应力', '固定共旋：2μ(F − R)Fᵀ + λJ(J − 1)I'], ['材料（代码）', '0 液体 μ = 0；1 弹性；2 弹塑性，奇异值截到 [0.75, 1.45]']]) +
        '<p>粒子记住自己的形变梯度 F，网格只是每个子步临时用的“草稿纸”。所以 MPM 能处理液体飞溅和绳子大变形，代价是每个子步都要在网格上来回散布和收集。</p>' +
        '<p>代码里推绳用材料 2，甩绳和汤里的豆腐、蔬菜用材料 1，水用材料 0（液体 λ 被置 1）。</p>' +
        toyb('二维 MLS-MPM，32×32 网格、312 个粒子、E = 300、ν = 0.2、Δt = 2×10⁻⁴，压块按“不能向上穿过”处理。液体为了稳定把 F 重置为 √J·I（mpm99 的写法），这一点和 DaX 不同。弹塑性用 DaX 的截断区间 [0.75, 1.45]。都是页面当场算的，参数是我设的。') +
        src('附录 A.1 · mpm_simulator.py:223-330') },
    { n: 4, part: '附录 A.1 布料', title: '布：16 × 32 个质点、8 邻域弹簧、一个“吸附球”', sub: '拾放宏动作拆成 40 段；切换抓取半径看能抓住几个质点', dur: 16, cam: [0.4, 0.92, 27, [0, 0.3, 1.6]],
      html: dl([['质点', '16 × 32 = 512（N = 80 的网格里取一块），间距 0.0125'], ['弹簧', '8 邻域，力 = k(‖d‖ − l)/l · d/‖d‖，k = 900'], ['积分', '显式欧拉，Δt = 2×10⁻³，阻尼 e^{−2Δt}，速度截到 ±2'], ['夹爪', '半径 0.01 的球；“吸附”时球内质点跟着平移'], ['宏动作', '下降 3 段 + 抬 0.06 共 10 段 + 平移 20 段 + 松开 7 段，每段 50 个子步']]) +
        '<p>一次拾放 = 40 段 × 50 子步 = 2000 个仿真子步。拾取高度被代码置 0，夹爪落在布面上；质点间距 0.0125 比半径 0.01 大，所以正对质点时只能抓住 1 个，偏一点就抓空。</p>' +
        '<p>没有弯曲弹簧，没有自碰撞：叠过来的那一层可以直接穿过下面一层（读者注 14）。</p>' +
        toyb('按 cloth_simulator.py 的更新顺序和 fold_cloth1 的常数（k、阻尼、重力 0.5、摩擦 0.5、Δt、速度截断）在页面里重算一遍：抓左上角那个质点，抬起、向另一端平移 0.3、松开。0.03 半径是我为对比加的。') +
        src('附录 A.1 · cloth_simulator.py · basic/cloth_env.py:136-173') },
    { n: 5, part: '附录 A.4 省内存', title: '两个省内存的办法：活动区域和检查点', sub: '第一行选办法；活动区域可切论文 / 代码尺寸，检查点可切间隔 k', dur: 15, cam: [0.5, 1.05, 34, [0, 4.2, 0]],
      html: dl([['活动区域（论文）', '128³ 里只更新 32 × 6 × 32，约 341 倍'], ['活动区域（代码）', '推绳 64 × 6 × 64，约 85 倍；倒汤只有 2 倍'], ['做法', '把物体平移到活动网格中央，算完再移回（mpm_env.py:99-125）'], ['检查点（论文）', '只存少数状态，反传时分段重算，计算约 2 倍'], ['检查点（代码）', 'MPM 每个子步用 custom_vjp 重算；布料 mem_saving_level 2 两层']]) +
        '<p>反传要用到前向的中间值。全存，显存随步数线性涨；只存每隔 k 步的一个状态，反传到某一段时从它出发把这一段重算一遍。下面的计数是当场算的：存的状态数和重算的步数。</p>' + src('§3.1 · 附录 A.4 · 图 6 · 读者注 9、16') },
    { n: 6, part: '§3.2 任务', title: '九个任务：宏动作的短，低层控制的长', sub: '柱高是视野（开方刻度）；切换论文 / 代码的视野', dur: 12, cam: [0.0, 0.78, 34, [0, 1.0, 1.4]],
      html: dl([['宏动作', '叠布、叠 T 恤、展开、推绳：6 维起止点，3 到 10 步'], ['低层', '甩绳 3 维速度 70 步；倒水、倒汤 4 维速度 100 步'], ['代码不同的', 'T 恤 5、展开 15、倒汤 120（读者注 10）'], ['动作维数', '代码一律 6 维，倒水的 v_y 被置 0（读者注 11）']]) +
        '<p>宏动作把几十到几千个仿真子步压成一个决策，视野变短、动作维数变低；代价是太粗，甩绳这种要持续调动量的任务做不了。论文用这两类任务对比方法在“短而不光滑”和“长而光滑”两种地形上的表现。</p>' + src('§3.2 · 各 *_env.py') },
    { n: 7, part: '§4.1 奖励', title: '奖励：粒子离目标多近', sub: '当前绳子逐渐变直；切换距离的算法，看 D 和奖励', dur: 13, cam: [0.0, 0.62, 19, [0.4, 0.2, 0.4]],
      html: dl([['r_gt', 'exp(−λ D(s′, g))，代码 λ = 10'], ['D（MPM）', '按粒子编号一一对应，每坐标均方根，再对粒子平均'], ['D（布）', '双向倒角距离（同样除了 √3）'], ['r_aux', 'exp(−最近粒子距离)；训练加，评测不加'], ['布料', '奖励再乘 0.99ᵗ']]) +
        '<p>MPM 任务的粒子数和目标点数不同时，目标被有放回地随机重采样，编号对应就变成随机配对。切到“编号被打乱”可以看到，即使形状完全对上，D 也不为零。</p>' +
        toyb('12 个粒子的绳子从弯到直，目标是一条直线。D、r_gt、r_aux 都按代码的公式当场算（坐标在 [0, 1] 里）。夹爪位置是我设的。') + src('§4.1 · util.py:138-159 · mpm_env.py:93、131-157、200-204') },
    { n: 8, part: '§4 方法', title: '梯度从哪里来，流回哪里', sub: '切换方法：APG、SHAC（原文）、SHAC（发布代码）、ILD、可微 MPC', dur: 15, cam: [0.0, 1.12, 30, [-0.6, 1.8, 0]],
      html: dl([['APG', '整段回合 BPTT；代码默认展开 10 步'], ['SHAC 原文', '短窗口 h + 末端价值 V(s_h)，窗口之间切断'], ['SHAC 代码', '窗口 = 整个回合；最后一步 V 被清零（读者注 18）'], ['ILD', '每步拉近专家状态 g_t，梯度来自当前和之后所有步'], ['可微 MPC', '没有策略，直接优化动作序列；初值随机或来自 CEM']]) +
        '<p>同一条状态链，不同方法只是“损失挂在哪里、梯度切在哪里”不同。图 4 画了 SHAC、ILD、Diff CEM-MPC 三种。</p>' +
        '<p>§4.3 说“SHAC 的梯度只计当前步的奖励”。切到 SHAC 原文可以看到：每个动作的梯度来自窗口内它之后的所有奖励和末端 V（读者注 8）。</p>' + src('§4.2–4.4 · 图 4 · shac.py · apg.py') },
    { n: 9, part: '§4.2/4.4 地形', title: '没碰到布，梯度就是零', sub: '一维玩具当场算；切换 diff-MPC、CEM、diff-CEM', dur: 15, cam: [0.0, 1.32, 24, [0, 3.4, 0]],
      html: dl([['横轴', '拾取点的位置 a'], ['纵轴', '执行后的奖励 r(a)'], ['灰色区', '布外：夹爪抓空，状态不变，r 恒定，dr/da = 0'], ['diff-MPC', '随机初值 + 梯度上升'], ['diff-CEM-MPC', '先 CEM（采样 + 精英），再梯度细调']]) +
        '<p>这就是 §4.2 举的 Fold-Cloth-3 例子：初值没碰到布，梯度永远是零；碰到了，梯度也只把它带到最近的小山头。CEM 靠撒点找对区域，梯度在它的结果上细调，表 3 里 diff-CEM-MPC 在布料任务上比 CEM-MPC 高 0.01 到 0.10，就是这一步。</p>' +
        toyb('r(a) 是我设的：布外恒为 0.20；布内是两个高斯包（局部 0.45、全局 0.70）加小波纹。梯度用数值差分，步长 0.0003，40 步；CEM 每轮 24 个样本取 5 个精英，6 轮。全部固定种子当场算。') + src('§4.2 · §4.4 · 表 3') },
    { n: 10, part: '§4 结果', title: '表里的数', sub: '切换表 3、表 4、图 3 终点和表 5；柱子都是原文数字或矢量读数', dur: 12, cam: [0.0, 1.2, 37, [0, 5.0, 0]],
      html: dl([['表 3', 'ILD 全部高于粒子版 Transporter；diff-CEM-MPC 的提升只在布料上'], ['表 4', 'PPO 宏动作 6 个里严格领先 4 个；APG 只在甩绳大幅领先'], ['图 3 终点', '矢量读数；和表 4 差 ≤ 0.02 的只有 6 / 24'], ['表 5', 'Transporter-RGB 在 5 / 6 个宏动作任务上高于 ILD']]) +
        '<p>表 4 说是学习曲线的“最终表现”，但它更接近每条曲线的最高点（读者注 1）。切到“图 3 终点”可以看到 SHAC 在展开布上只剩 0.09 到 0.16。</p>' + src('表 3、4、5 · 图 3 矢量读数') },
    { n: 11, part: '§4.5 真机', title: '推绳：CEM-MPC 用 DaX 当预测模型', sub: '6 次推，绳子逐步变直；下排是 DaX 的一步预测', dur: 14, cam: [0.2, 0.95, 31, [1.5, 0.8, 2.6]],
      html: dl([['机器人', 'Kinova Gen3'], ['状态', '点云估计粒子位置'], ['规划', 'CEM-MPC 在 DaX 里试推，选最好的 (x, y, z, x′, y′, z′)'], ['执行', '逆运动学转成关节轨迹'], ['结果', '图 5：真机和仿真轨迹“相似”，没有定量误差']]) +
        '<p>图 5 下排每一格是“给定估计的当前状态和规划的动作，DaX 预测的下一状态”，是从真实状态出发的一步预测，不是仿真自己滚 6 步。</p>' +
        '<p>代码里真机客户端和对照脚本在，但 CEM-MPC 和策略服务没有发布；<code>calibrate.py</code> 只把仿真和真机的一次推画在一起。</p>' +
        guess('机械臂、相机和绳子形状都是示意；绳子从弯到直的 7 个形状是我设的，下排加了小扰动表示“预测和真机不完全一样”。') + src('§4.5 · 附录 B · 图 5 · exp/') }
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
  let LABS = [], refDist = 24, PICKS = [];
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  function dynLab(G, pos, o = {}) {
    const st = { s: null, t: null };
    const f = t => { if (t === st.t) return; if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; st.s = lab(t, pos, o); G.add(st.s); };
    f.vis = v => { if (st.s) st.s.visible = v; }; return f;
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BALL = new THREE.SphereGeometry(1, 10, 8), CUBE = new THREE.BoxGeometry(1, 1, 1);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: 0.6 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
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
  function segs(G, n, color, o = {}) {
    const pos = new Float32Array(n * 6), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: o.opacity ?? 0.6 })); l.frustumCulled = false; G.add(l);
    l.userData.pos = pos; l.userData.up = () => { g.attributes.position.needsUpdate = true; }; return l;
  }
  function ribbon(G, n, color, w = 0.06, o = {}) {
    const pos = new Float32Array(n * 6), idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: o.opacity ?? 1 })); m.frustumCulled = false; m.renderOrder = o.order ?? 2; G.add(m);
    m.userData.set = pts => { const k = Math.min(n, pts.length); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)], z = q[2] ?? 0; pos[i * 6] = q[0]; pos[i * 6 + 1] = q[1] - w / 2; pos[i * 6 + 2] = z; pos[i * 6 + 3] = q[0]; pos[i * 6 + 4] = q[1] + w / 2; pos[i * 6 + 5] = z; } g.attributes.position.needsUpdate = true; };
    return m;
  }
  function panel(G, x, y, z, w, h, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: o.color ?? 0x0c1220, transparent: true, opacity: o.opacity ?? 0.55, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }
  function floorRect(G, cx, cz, lx, lz, color, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(lx, lz), new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: o.opacity != null, opacity: o.opacity ?? 1, depthWrite: o.opacity == null })); m.rotation.x = -PI / 2; m.position.set(cx, o.y ?? 0, cz); G.add(m); return m; }
  function wireBox(G, cx, cy, cz, w, h, d, color, o = {}) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color, transparent: true, opacity: o.opacity ?? 0.8 })); e.position.set(cx, cy, cz); G.add(e); return e; }
  function arrowObj(G, from, to, color) { const a = L.arrow(from, to, color); G.add(a); return a; }
  function setArrow(a, from, to) { const f = L.V(from), t = L.V(to), d = t.clone().sub(f), len = Math.max(0.05, d.length()); a.position.copy(f); a.setDirection(d.normalize()); a.setLength(len, Math.min(0.55, len * 0.3), Math.min(0.32, len * 0.16)); }
  /* a rope drawn as a tube through control points (rebuilt only when the points change) */
  function ropeMesh(G, color, r = 0.12) { const holder = new THREE.Group(); G.add(holder); let key = ''; return pts => { const k = pts.map(q => q.map(v => v.toFixed(2)).join(',')).join(';'); if (k === key) return; key = k; L.clear(holder); holder.add(L.tube(pts, color, r)); }; }

  function buildCtl() {
    const box = $('ctl'); box.innerHTML = ''; box.hidden = true; if (!api) return;
    (api.ctls || []).forEach((c, gi) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-g="${gi}" data-k="${k}" aria-pressed="${c.get() === k}">${t}</button>`).join('');
      box.appendChild(row); box.hidden = false;
    });
  }
  function syncCtl() { (api?.ctls || []).forEach((c, gi) => { $('ctl').querySelectorAll(`button[data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(c.get() === +b.dataset.k))); }); }

  /* ---------- toy simulators (computed once, cached) ---------- */
  const CACHE = {};
  /* cloth: same update order and constants as cloth_simulator.py with the fold_cloth1 config */
  function clothSim(radius) {
    const key = 'cloth' + radius; if (CACHE[key]) return CACHE[key];
    const N = 80, cs = 1 / N, I0 = 32, I1 = 48, J0 = 32, J1 = 64, ni = I1 - I0, nj = J1 - J0, n = ni * nj;
    const k = 900, damp = 2, dt = 2e-3, g = 0.5, maxv = 2, mu = 0.5, small = 1e-8;
    const x = new Float64Array(n * 3), v = new Float64Array(n * 3), id = (a, b) => a * nj + b;
    for (let a = 0; a < ni; a++) for (let b = 0; b < nj; b++) { const p = id(a, b) * 3; x[p] = (I0 + a) * cs; x[p + 1] = 0; x[p + 2] = (N - (J0 + b)) * cs; }
    const LK = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]], nb = [];
    for (let a = 0; a < ni; a++) for (let b = 0; b < nj; b++) for (const [da, db] of LK) { const c = a + da, d = b + db; if (c >= 0 && c < ni && d >= 0 && d < nj) nb.push([id(a, b), id(c, d), cs * Math.hypot(da, db)]); }
    const pick = [I0 * cs, 0, (N - J0) * cs], place = [I0 * cs, 0, (N - J0) * cs - 0.3];
    const ps = [0.5, 0.5, 0.5], sub = [], down = [pick[0] - ps[0], pick[1] - ps[1], pick[2] - ps[2]];
    for (let i = 0; i < 3; i++) sub.push([down[0] / 3, down[1] / 3, down[2] / 3, 1]);
    for (let i = 0; i < 10; i++) sub.push([0, 0.006, 0, 0]);
    for (let i = 0; i < 20; i++) sub.push([(place[0] - pick[0]) / 20, 0, (place[2] - pick[2]) / 20, 0]);
    for (let i = 0; i < 7; i++) sub.push([0, 0, 0, 1]);
    const frames = [], gp = [], f = new Float64Array(n * 3), grab = []; let gNow = 0;
    const snap = () => { frames.push(Float32Array.from(x)); gp.push(ps.slice()); grab.push(gNow); };
    snap();
    const e = Math.exp(-damp * dt);
    for (let s = 0; s < sub.length; s++) {
      const A = sub[s], dv = [clamp(A[0], -2, 2) / 50, clamp(A[1], -2, 2) / 50, clamp(A[2], -2, 2) / 50], suc = A[3];
      for (let t = 0; t < 50; t++) {
        for (let i = 0; i < n; i++) v[i * 3 + 1] -= g * dt;
        f.fill(0);
        for (const [i, j, l0] of nb) { const dx = x[j * 3] - x[i * 3], dy = x[j * 3 + 1] - x[i * 3 + 1], dz = x[j * 3 + 2] - x[i * 3 + 2]; const l = Math.sqrt(Math.max(dx * dx + dy * dy + dz * dz, 1e-12)); const c = k * (l - l0) / l0 / l; f[i * 3] += c * dx; f[i * 3 + 1] += c * dy; f[i * 3 + 2] += c * dz; }
        let gr = 0;
        for (let i = 0; i < n; i++) {
          const p = i * 3; f[p + 1] -= g;
          if (x[p + 1] <= small) { const muF = mu * Math.max(0, -f[p + 1]), sV = Math.sqrt(v[p] ** 2 + v[p + 2] ** 2 + small);
            if (sV > small) { f[p] -= muF * v[p] / sV; f[p + 2] -= muF * v[p + 2] / sV; }
            else { const sF = Math.sqrt(f[p] ** 2 + f[p + 2] ** 2 + small); if (muF > sF) { f[p] = 0; f[p + 2] = 0; } else { const R = 1 - muF / sF; f[p] *= R; f[p + 2] *= R; } } }
          for (let c = 0; c < 3; c++) v[p + c] = (v[p + c] + f[p + c] * dt) * e;
          if (Math.hypot(x[p] - ps[0], x[p + 1] - ps[1], x[p + 2] - ps[2]) <= radius) { if (suc === 0) gr++; for (let c = 0; c < 3; c++) { v[p + c] *= suc; x[p + c] += dv[c] * (1 - suc); } }
        }
        gNow = gr;
        for (let c = 0; c < 3; c++) ps[c] = clamp(ps[c] + dv[c], 0, 1);
        for (let i = 0; i < n * 3; i++) { x[i] = clamp(x[i], 0, 1); v[i] = clamp(v[i], -maxv, maxv); x[i] += dt * v[i]; }
        if ((s * 50 + t + 1) % 25 === 0) snap();
      }
    }
    return (CACHE[key] = { frames, gp, grab, n, ni, nj });
  }
  /* 2D MLS-MPM toy (mpm88 / mpm99 style). mat 0 liquid, 1 elastic, 2 elasto-plastic with DaX's sigma clip [0.75, 1.45] */
  function mpmSim(mat) {
    const key = 'mpm' + mat; if (CACHE[key]) return CACHE[key];
    const ng = 32, dx = 1 / ng, inv = ng, dt = 2e-4, pv = (dx * 0.5) ** 2, pm = pv, E = 300, nu = 0.2, mu0 = E / (2 * (1 + nu)), la0 = E * nu / ((1 + nu) * (1 - 2 * nu));
    const X = [], V = [], C = [], F = [];
    for (let a = 0; a < 26; a++) for (let b = 0; b < 12; b++) { X.push([0.3 + (a + 0.5) * 0.4 / 26, 0.1 + (b + 0.5) * 0.18 / 12]); V.push([0, 0]); C.push([0, 0, 0, 0]); F.push([1, 0, 0, 1]); }
    const n = X.length, gv = new Float64Array(ng * ng * 2), gm = new Float64Array(ng * ng);
    const box = t => { const y = t < 0.25 ? 0.62 : t < 0.55 ? 0.62 - (t - 0.25) / 0.3 * 0.46 : t < 0.7 ? 0.16 : t < 0.95 ? 0.16 + (t - 0.7) / 0.25 * 0.46 : 0.62; const vy = t < 0.25 ? 0 : t < 0.55 ? -0.46 / 0.3 : t < 0.7 ? 0 : t < 0.95 ? 0.46 / 0.25 : 0; return { x0: 0.43, x1: 0.57, y0: y, y1: y + 0.1, vy }; };
    const W = f => [0.5 * (1.5 - f) ** 2, 0.75 - (f - 1) ** 2, 0.5 * (f - 0.5) ** 2];
    const frames = [], boxes = [], T = 1.2, steps = Math.round(T / dt), every = Math.round(steps / 120);
    for (let s = 0; s <= steps; s++) {
      const t = s * dt;
      if (s % every === 0) { frames.push(Float32Array.from(X.flat())); boxes.push(box(t)); }
      gv.fill(0); gm.fill(0);
      for (let p = 0; p < n; p++) {
        const x = X[p], bx = Math.floor(x[0] * inv - 0.5), by = Math.floor(x[1] * inv - 0.5), fx = x[0] * inv - bx, fy = x[1] * inv - by, wx = W(fx), wy = W(fy), c = C[p], f = F[p];
        let F0 = (1 + dt * c[0]) * f[0] + dt * c[1] * f[2], F1 = (1 + dt * c[0]) * f[1] + dt * c[1] * f[3], F2 = dt * c[2] * f[0] + (1 + dt * c[3]) * f[2], F3 = dt * c[2] * f[1] + (1 + dt * c[3]) * f[3];
        const th = Math.atan2(F2 - F1, F0 + F3), cr = Math.cos(th), sr = Math.sin(th);
        const S0 = cr * F0 + sr * F2, S1 = cr * F1 + sr * F3, S3 = -sr * F1 + cr * F3, ph = 0.5 * Math.atan2(2 * S1, S0 - S3), cp = Math.cos(ph), sp = Math.sin(ph);
        let s1 = cp * cp * S0 + 2 * cp * sp * S1 + sp * sp * S3, s2 = sp * sp * S0 - 2 * cp * sp * S1 + cp * cp * S3, mu = mu0, la = la0;
        if (mat === 0) { mu = 0; la = 300; }
        if (mat === 2) { s1 = clamp(s1, 0.75, 1.45); s2 = clamp(s2, 0.75, 1.45); const T0 = cp * cp * s1 + sp * sp * s2, T1 = cp * sp * (s1 - s2), T3 = sp * sp * s1 + cp * cp * s2; F0 = cr * T0 - sr * T1; F1 = cr * T1 - sr * T3; F2 = sr * T0 + cr * T1; F3 = sr * T1 + cr * T3; }
        let J = s1 * s2;
        if (mat === 0) { const sq = Math.sqrt(Math.max(J, 0.2)); F0 = sq; F1 = 0; F2 = 0; F3 = sq; J = sq * sq; }
        F[p] = [F0, F1, F2, F3];
        const A0 = F0 - cr, A1 = F1 + sr, A2 = F2 - sr, A3 = F3 - cr, pr = la * J * (J - 1);
        const st = [2 * mu * (A0 * F0 + A1 * F1) + pr, 2 * mu * (A0 * F2 + A1 * F3), 2 * mu * (A2 * F0 + A3 * F1), 2 * mu * (A2 * F2 + A3 * F3) + pr];
        const kk = -dt * pv * 4 * inv * inv, af = [kk * st[0] + pm * c[0], kk * st[1] + pm * c[1], kk * st[2] + pm * c[2], kk * st[3] + pm * c[3]];
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          if (bx + i < 0 || bx + i >= ng || by + j < 0 || by + j >= ng) continue;
          const w = wx[i] * wy[j], ddx = (i - fx) * dx, ddy = (j - fy) * dx, gi = (bx + i) * ng + (by + j);
          gv[gi * 2] += w * (pm * V[p][0] + af[0] * ddx + af[1] * ddy); gv[gi * 2 + 1] += w * (pm * V[p][1] + af[2] * ddx + af[3] * ddy); gm[gi] += w * pm;
        }
      }
      const B = box(t);
      for (let i = 0; i < ng; i++) for (let j = 0; j < ng; j++) {
        const gi = i * ng + j; if (gm[gi] <= 0) continue;
        let vx = gv[gi * 2] / gm[gi], vy = gv[gi * 2 + 1] / gm[gi] - dt * 9.8; const px = i * dx, py = j * dx;
        if (px > B.x0 - dx && px < B.x1 + dx && py > B.y0 - dx && py < B.y1 + dx) vy = Math.min(vy, B.vy);
        if (i < 3 && vx < 0) vx = 0; if (i > ng - 3 && vx > 0) vx = 0; if (j < 3 && vy < 0) { vy = 0; vx *= 0.6; } if (j > ng - 3 && vy > 0) vy = 0;
        gv[gi * 2] = vx; gv[gi * 2 + 1] = vy;
      }
      for (let p = 0; p < n; p++) {
        const x = X[p], bx = Math.floor(x[0] * inv - 0.5), by = Math.floor(x[1] * inv - 0.5), fx = x[0] * inv - bx, fy = x[1] * inv - by, wx = W(fx), wy = W(fy);
        let a0 = 0, a1 = 0, c0 = 0, c1 = 0, c2 = 0, c3 = 0;
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          if (bx + i < 0 || bx + i >= ng || by + j < 0 || by + j >= ng) continue;
          const gi = (bx + i) * ng + (by + j), w = wx[i] * wy[j], g0 = gv[gi * 2], g1 = gv[gi * 2 + 1], ddx = i - fx, ddy = j - fy;
          a0 += w * g0; a1 += w * g1; c0 += 4 * inv * w * g0 * ddx; c1 += 4 * inv * w * g0 * ddy; c2 += 4 * inv * w * g1 * ddx; c3 += 4 * inv * w * g1 * ddy;
        }
        V[p] = [a0, a1]; C[p] = [c0, c1, c2, c3]; x[0] += dt * a0; x[1] += dt * a1;
      }
    }
    return (CACHE[key] = { frames, boxes, n, ng });
  }

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    const sim = block(6.4, 0.4, 5.2, COL.sim, [-11.5, 0.2, 0], { opacity: 0.85 }); G.add(sim);
    const mpm = block(2.2, 1.6, 2.2, COL.mpm, [-13.3, 1.2, 0.6]); mpm.userData.go = 2; const cl = block(2.2, 0.4, 2.2, COL.cloth, [-9.7, 0.6, 0.6]); cl.userData.go = 3;
    const jx = block(5.6, 0.5, 1.0, 0x4a5878, [-11.5, 0.65, -1.9]); jx.userData.go = 1;
    G.add(mpm, cl, jx); PICKS.push(mpm, cl, jx);
    G.add(lab('DaX 仿真器（JAX）', [-11.5, 6.4, 0], { size: 23, color: '#38d1ff' }), lab('MLS-MPM\n液体 · 绳', [-13.3, 3.4, 0.6], { size: 17 }), lab('质点-弹簧\n布', [-9.7, 1.9, 1.9], { size: 17 }), lab('jit · vmap · pmap · grad', [-11.5, -0.2, 3.4], { size: 16 }));
    const tiles = []; TKS.forEach((t, i) => { const r = Math.floor(i / 3), c = i % 3, x = -2.4 + c * 2.4, z = -2.4 + r * 2.4; const b = block(2.0, 0.3, 2.0, i < 6 ? COL.task : 0xb48cff, [x, 0.15, z], { opacity: 0.85 }); b.userData.go = 5; PICKS.push(b); G.add(b, lab(t, [x, 0.9, z], { size: 16 })); tiles.push(b); });
    G.add(lab('9 个任务', [0, 6.4, 0], { size: 23, color: '#9d8cff' }));
    const M = [['强化学习', [['PPO', 0, 1], ['APG', 1, 1], ['SHAC', 1, 1]]], ['模仿学习', [['Transporter', 0, 0], ['ILD', 1, 0]]], ['规划', [['CEM-MPC', 0, 0], ['diff-MPC', 1, 0], ['diff-CEM-MPC', 1, 0]]]];
    const diffB = [];
    M.forEach(([gname, ms], gi) => { const x = 8.4 + gi * 3.9; G.add(lab(gname, [x, 5.0, 0], { size: 18 }));
      ms.forEach(([nm, d, rel], j) => { const y = 3.6 - j * 1.4, b = block(3.0, 0.9, 0.8, d ? COL.diff : COL.nd, [x, y, 0], { opacity: rel ? 0.95 : 0.45 }); b.userData.go = 7; PICKS.push(b); G.add(b, lab(nm, [x, y, 0.75], { size: 15 })); if (!rel) wireBox(G, x, y, 0, 3.15, 1.05, 0.95, 0xe6ecf7, { opacity: 0.5 }); if (d) diffB.push(b); }); });
    G.add(lab('8 个方法（虚框：代码未发布）', [12.3, 6.4, 0], { size: 21, color: '#4fc98a' }));
    const fw = stream(G, 14, COL.fwd, 0.13), bw = stream(G, 14, COL.grad, 0.15), tk = stream(G, 10, COL.task, 0.12);
    const pF = [[8, 0.6, 1.4], [2, 0.6, 3.2], [-8.4, 0.8, 1.8]], pB = [[-8.4, 1.6, -1.2], [1, 2.6, -3.4], [8, 2.2, -0.8]], pT = [[-3.6, 0.6, 0], [-8.2, 0.8, 0]];
    return { update(p) {
      const t = p * 14; fw(pF, (t * 0.25) % 1, 1); bw(pB, (t * 0.25) % 1, seg(p, 0.15, 0.3)); tk(pT, (t * 0.3) % 1, 1);
      diffB.forEach(b => glow(b, 0.3 + 0.3 * Math.sin(t * 2))); glow(sim, 0.25);
      cap(p < 0.5 ? '白色：动作从方法流进仿真器 · 紫色：任务给出初始状态和目标' : '<b>绿色</b>：可微方法把梯度从奖励穿过 DaX 流回动作或策略');
    } };
  }

  /* ---------- scene 2: JAX batch + grad ---------- */
  function s2(G) {
    let di = +(OPT[0] ?? 1); const DEV = [1, 2, 4], B = 32;
    const sub = new THREE.Group(); G.add(sub); let last = -1, tiles = [];
    const aB = block(2.0, 3.2, 1.0, COL.orange, [-12, 1.6, 0]), rB = block(2.0, 3.2, 1.0, COL.gold, [12, 1.6, 0]); G.add(aB, rB);
    G.add(lab('动作 actions\n32 × 6', [-12, 4.4, 0], { size: 18 }), lab('奖励 reward\n32', [12, 4.4, 0], { size: 18 }));
    const fw = stream(G, 16, COL.fwd, 0.14), bw = stream(G, 16, COL.grad, 0.16);
    const gl = dynLab(G, [0, -2.2, 3.4], { size: 19, color: '#4fc98a' });
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); tiles = []; last = di; const D = DEV[di], per = B / D, W = 18 / D;
      for (let d = 0; d < D; d++) {
        const x0 = -9 + W * d + W / 2; sub.add(block(W - 0.4, 0.15, 5.6, 0x2b3650, [x0, -0.08, 0]));
        sub.add(lab(`GPU ${d}`, [x0, -0.3, 3.3], { size: 16, color: '#7cb8ff' }));
        const cols = Math.ceil(Math.sqrt(per * (W - 0.6) / 5.2)), rows = Math.ceil(per / cols), cw = (W - 0.8) / cols, rh = 5.0 / rows;
        for (let k = 0; k < per; k++) { const c = k % cols, r = Math.floor(k / cols), x = x0 - (W - 0.8) / 2 + cw * (c + 0.5), z = -2.5 + rh * (r + 0.5);
          const b = block(cw * 0.8, 0.5, rh * 0.75, 0x3aa8e0, [x, 0.3, z], { opacity: 0.8 }); sub.add(b); tiles.push(b); }
      }
      sub.add(lab(D === 1 ? 'vmap：一张卡上 32 个环境' : `pmap × vmap：${D} 张卡，每张 ${per} 个环境`, [0, 5.0, -2.6], { size: 20 }));
    }
    rebuild();
    const ctls = [{ label: '设备数', items: ['1', '2', '4'], get: () => di, set: k => { di = k; } }];
    return { ctls, update(p) {
      if (last !== di) rebuild();
      const f = seg(p, 0.0, 0.45), b = seg(p, 0.5, 0.95);
      fw([[-11, 1.4, 0], [-9.5, 1.2, 0], [9.5, 1.2, 0], [11, 1.4, 0]], (p * 3) % 1, p < 0.47 ? 1 : 0);
      bw([[11, 2.6, -1.2], [9.5, 2.6, -2.8], [-9.5, 2.6, -2.8], [-11, 2.6, -1.2]], (p * 3) % 1, p > 0.5 ? 1 : 0);
      tiles.forEach((t, i) => glow(t, p < 0.47 ? 0.6 * Math.max(0, Math.sin(PI * clamp(f * 1.2 - (i % 8) / 40, 0, 1))) : 0));
      glow(aB, b > 0.9 ? 0.7 : 0.1); glow(rB, f > 0.9 && p < 0.5 ? 0.7 : 0.1);
      gl(p < 0.5 ? 'obs, reward, done, info = env.step_diff(actions, state)' : 'jax.grad(lambda a: −env.step_diff(a, state)[1].sum())');
      cap(p < 0.5 ? `前向：${DEV[di]} 张卡 × ${B / DEV[di]} 个环境同时推进一个宏步` : `反传：<b>∂(−Σ r)/∂a</b>，形状和动作一样（32 × 6）${DEV[di] > 1 ? '；多卡时梯度用 pmean 取平均' : ''}`);
    } };
  }

  /* ---------- scene 3: MLS-MPM toy ---------- */
  function s3(G) {
    let mi = +(OPT[0] ?? 2); const NM = ['液体（材料 0）', '弹性（材料 1）', '弹塑性（材料 2）'], MC = [COL.water, 0x4fc98a, COL.rope];
    const SC = 16, ox = -8, oy = 0; const P = (x, y) => [ox + x * SC, oy + y * SC, 0];
    ribbon(G, 2, 0x8e9bb8, 0.12).userData.set([P(0, 3 / 32), P(1, 3 / 32)]);
    const ng = 32; for (let i = 0; i <= ng; i += 2) { wire(G, [P(i / ng, 0), P(i / ng, 0.75)], COL.dim, { opacity: 0.16 }); }
    for (let j = 0; j <= 24; j += 2) wire(G, [P(0, j / ng), P(1, j / ng)], COL.dim, { opacity: 0.16 });
    const pts = inst(BALL, 312); G.add(pts);
    const boxM = block(0.14 * SC, 0.1 * SC, 1.2, 0x9aa6bf, [0, 0, 0]); G.add(boxM);
    const hl = inst(CUBE, 9); hl.material.color.setHex(COL.gold); hl.material.emissive.setHex(0x553300); G.add(hl);
    const hp = new THREE.Mesh(BALL, L.mat(COL.warn, { emissive: 0x552200 })); hp.scale.setScalar(0.22); G.add(hp);
    const stL = segs(G, 9, COL.gold, { opacity: 0.8 });
    const steps = ['P2G', '网格更新', 'G2P'], sb = steps.map((s, i) => { const b = block(2.6, 0.9, 0.6, 0x2b3650, [11.0, 8.0 - i * 1.5, 0]); G.add(b, lab(s, [11.0, 8.0 - i * 1.5, 0.5], { size: 17 })); return b; });
    G.add(lab('一个子步', [11.0, 9.5, 0], { size: 18, color: '#f2c14e' }));
    const ctls = [{ label: '材料', items: NM, get: () => mi, set: k => { mi = k; } }];
    return { ctls, update(p) {
      const s = mpmSim(mi), fi = Math.min(s.frames.length - 1, Math.round(p * (s.frames.length - 1))), X = s.frames[fi], c = hex3(MC[mi]);
      for (let i = 0; i < s.n; i++) { setI(pts, i, P(X[i * 2], X[i * 2 + 1]), 0.16); colI(pts, i, c); } done(pts);
      const B = s.boxes[fi]; boxM.position.set(...P((B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2));
      const q = 150, x = X[q * 2], y = X[q * 2 + 1], bx = Math.floor(x * ng - 0.5), by = Math.floor(y * ng - 0.5); hp.position.set(...P(x, y)); hp.position.z = 0.3;
      const ph = Math.floor((p * 60) % 3); const pos = stL.userData.pos; let k = 0;
      const pp = P(x, y); pp[2] = 0.3;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const g = P((bx + i) / ng, (by + j) / ng); g[2] = 0.3; setI(hl, k, g, 0.14); pos.set([...pp, ...g], k * 6); k++; } done(hl); stL.userData.up(); stL.visible = ph !== 1;
      sb.forEach((b, i) => glow(b, i === ph ? 0.8 : 0.05));
      let top = 0; for (let i = 0; i < s.n; i++) if (Math.abs(X[i * 2] - 0.5) < 0.04) top = Math.max(top, X[i * 2 + 1]);
      cap(`t = ${(fi * 0.01).toFixed(2)} s · ${NM[mi]} · 中间顶面 <b>${top.toFixed(3)}</b>（初始 0.280）${p > 0.85 ? (mi === 1 ? ' · 弹性：基本弹回' : mi === 2 ? ' · 弹塑性：留下压痕' : ' · 液体：摊开') : ''}`);
    } };
  }

  /* ---------- scene 4: cloth mass-spring + pick-and-place ---------- */
  function s4(G) {
    let ri = +(OPT[0] ?? 0); const RAD = [0.01, 0.03];
    const SC = 26, c0 = [0.494, 0, 0.35], P = (x, y, z) => [(x - c0[0]) * SC, y * SC, (z - c0[2]) * SC];
    floorRect(G, 0, 1, 20, 15, COL.wood, { y: -0.03 });
    const sim0 = clothSim(0.01), n = sim0.n, ni = sim0.ni, nj = sim0.nj;
    const pts = inst(BALL, n); G.add(pts);
    const nl = (ni - 1) * nj + ni * (nj - 1), ln = segs(G, nl, COL.cloth, { opacity: 0.55 });
    const grip = new THREE.Mesh(BALL, L.mat(COL.gold, { opacity: 0.55, depthWrite: false })); G.add(grip);
    const rod = L.cyl(0.08, 0.08, 3.4, 0x9aa6bf); G.add(rod);
    /* timeline of the 40 sub-actions */
    const PH = [[3, '下降', 0x7cb8ff], [10, '抬起', COL.gold], [20, '平移', COL.diff], [7, '松开', 0x9aa6bf]]; let s0 = 0; const segB = [];
    PH.forEach(([cnt, nm, col]) => { for (let i = 0; i < cnt; i++) { const b = block(0.42, 0.25, 0.3, col, [-8.4 + (s0 + i) * 0.43, 0.2, 6.6]); G.add(b); segB.push(b); } G.add(lab(nm, [-8.4 + (s0 + cnt / 2 - 0.5) * 0.43, 1.0, 6.6], { size: 15 })); s0 += cnt; });
    const mk = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 12), L.mat(COL.warn)); mk.rotation.x = PI; G.add(mk);
    G.add(lab('40 段子动作 × 50 子步 = 2000 步', [0, 0.3, 9.2], { size: 16 }));
    const ctls = [{ label: '抓取半径', items: ['0.01（代码）', '0.03（示意）'], get: () => ri, set: k => { ri = k; } }];
    return { ctls, update(p) {
      const s = clothSim(RAD[ri]), fi = Math.min(s.frames.length - 1, Math.round(p * (s.frames.length - 1))), X = s.frames[fi];
      const cc = hex3(COL.cloth), cg = hex3(COL.gold), g = s.gp[fi];
      for (let i = 0; i < n; i++) { const q = P(X[i * 3], X[i * 3 + 1], X[i * 3 + 2]); setI(pts, i, q, 0.09); const near = Math.hypot(X[i * 3] - g[0], X[i * 3 + 1] - g[1], X[i * 3 + 2] - g[2]) <= RAD[ri]; colI(pts, i, near ? cg : cc); } done(pts);
      const pos = ln.userData.pos; let k = 0; const put = (i, j) => { pos.set(P(X[i * 3], X[i * 3 + 1], X[i * 3 + 2]), k * 6); pos.set(P(X[j * 3], X[j * 3 + 1], X[j * 3 + 2]), k * 6 + 3); k++; };
      for (let a = 0; a < ni; a++) for (let b = 0; b < nj; b++) { const i = a * nj + b; if (a + 1 < ni) put(i, i + nj); if (b + 1 < nj) put(i, i + 1); } ln.userData.up();
      const gpos = P(g[0], g[1], g[2]); grip.position.set(...gpos); grip.scale.setScalar(Math.max(0.12, RAD[ri] * SC)); rod.position.set(gpos[0], gpos[1] + 1.9, gpos[2]);
      const si = Math.min(39, Math.floor(fi / 2)); segB.forEach((b, i) => glow(b, i === si ? 0.9 : i < si ? 0.25 : 0)); mk.position.set(-8.4 + si * 0.43, 0.7, 6.6);
      const ph = si < 3 ? '下降（不抓）' : si < 13 ? '抬起 0.06' : si < 33 ? '平移 0.3' : '松开';
      cap(`子动作 ${si + 1} / 40 · ${ph} · 当前抓住 <b>${s.grab[fi]}</b> 个质点${ri === 0 ? '（间距 0.0125 &gt; 半径 0.01）' : ''}`);
    } };
  }

  /* ---------- scene 5: active region + checkpointing ---------- */
  function s5(G) {
    let mode = +(OPT[0] ?? 0), ai = +(OPT[1] ?? 0), ki = +(OPT[2] ?? 1); const KS = [1, 3, 4, 0];
    const A = new THREE.Group(), Cg = new THREE.Group(); G.add(A, Cg);
    /* active region view */
    const BIG = 12, s = BIG / 128; wireBox(A, 0, BIG / 2, 0, BIG, BIG, BIG, 0x8e9bb8, { opacity: 0.45 }); floorRect(A, 0, 0, BIG, BIG, 0x141c2e, { y: 0.0 });
    A.add(lab('整个环境 128 × 128 × 128', [0, BIG + 0.8, 0], { size: 19 }));
    const act = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: COL.warn, transparent: true, opacity: 0.35, depthWrite: false })); A.add(act);
    const actE = wireBox(A, 0, 0, 0, 1, 1, 1, COL.warn, { opacity: 0.9 });
    const rp = inst(BALL, 24); rp.material.color.setHex(COL.rope); A.add(rp);
    const al = dynLab(A, [0, -1.0, BIG / 2 + 1.6], { size: 19, color: '#ff7a59' });
    /* checkpoint view */
    const H = 12, X0 = -11, DX = 2.0, bx = []; for (let i = 0; i <= H; i++) { const b = block(1.3, 1.3, 1.3, 0x3b4660, [X0 + i * DX, 0.8, 0]); Cg.add(b, lab(`s${i}`, [X0 + i * DX, 2.0, 0], { size: 15 })); bx.push(b); }
    const fw = stream(Cg, 8, COL.fwd, 0.12), bw = stream(Cg, 8, COL.grad, 0.14), rc = stream(Cg, 8, 0x7cb8ff, 0.12);
    const cl = dynLab(Cg, [0, 4.6, 0], { size: 19 });
    const ctls = [{ label: '办法', items: ['活动区域', '检查点'], get: () => mode, set: k => { mode = k; } }, { label: '活动区', items: ['论文 32×6×32', '代码 64×6×64'], get: () => ai, set: k => { ai = k; } }, { label: '间隔 k', items: ['1', '3', '4', '全存'], get: () => ki, set: k => { ki = k; } }];
    return { ctls, update(p) {
      A.visible = mode === 0; Cg.visible = mode === 1;
      if (mode === 0) {
        const w = (ai ? 64 : 32) * s, h = 6 * s * 1.5, home = [2.2, h / 2, -1.8], corner = [-BIG / 2 + w / 2, h / 2, -BIG / 2 + w / 2];
        const k = seg(p, 0.3, 0.45) * (1 - seg(p, 0.7, 0.85)), c = [L.lerp(home[0], corner[0], k), h / 2, L.lerp(home[2], corner[2], k)];
        act.scale.set(w, h, w); act.position.set(...c); actE.scale.set(w, h, w); actE.position.set(...c);
        for (let i = 0; i < 24; i++) { const t = i / 23; setI(rp, i, [c[0] - 1.2 + 2.4 * t, 0.15, c[2] + 0.5 * Math.sin(t * 5 + (p > 0.45 && p < 0.7 ? (p - 0.45) * 8 : 0))], 0.12); } done(rp);
        const r = 128 ** 3 / ((ai ? 64 : 32) * 6 * (ai ? 64 : 32));
        al(`${ai ? '64 × 6 × 64' : '32 × 6 × 32'} · 网格点少 ${r.toFixed(0)} 倍`);
        cap(p < 0.3 ? '① 找出这一步会被改变的活动区域' : p < 0.7 ? '② 平移到原点，只在这一小块网格上做 MPM 子步' : '③ 平移回原来的坐标');
      } else {
        const K = KS[ki], stored = i => K === 0 || i % K === 0 || i === H;
        const fp = seg(p, 0, 0.4), cur = Math.floor(fp * H);
        let nst = 0; for (let i = 0; i <= H; i++) if (stored(i)) nst++;
        const bp = seg(p, 0.45, 1.0), segLen = K === 0 ? 1 : K, nseg = Math.ceil(H / segLen), si = Math.min(nseg - 1, Math.floor(bp * nseg)), sEnd = H - si * segLen, sBeg = Math.max(0, sEnd - segLen), sub = (bp * nseg) % 1;
        bx.forEach((b, i) => { const done_ = i <= cur; let em = 0, col;
          if (p < 0.42) { em = i === cur ? 0.9 : 0; col = done_ ? (stored(i) ? COL.gold : 0x5a6b8c) : 0x3b4660; }
          else { col = stored(i) ? COL.gold : 0x3b4660; if (i >= sBeg && i <= sEnd) { em = 0.5; if (!stored(i) && K !== 0 && sub < 0.5 && i <= sBeg + Math.floor(sub * 2 * segLen)) col = 0x7cb8ff; } }
          b.material.color.setHex(col); b.userData.c = hex3(col); glow(b, em); });
        fw([[X0, 0.8, 1.2], [X0 + H * DX, 0.8, 1.2]], (p * 4) % 1, p < 0.42 ? 1 : 0);
        rc([[X0 + sBeg * DX, 0.8, 1.2], [X0 + sEnd * DX, 0.8, 1.2]], (p * 6) % 1, p > 0.45 && K > 1 && sub < 0.5 ? 1 : 0);
        bw([[X0 + sEnd * DX, 0.8, -1.2], [X0 + sBeg * DX, 0.8, -1.2]], (p * 6) % 1, p > 0.45 && (K <= 1 || sub >= 0.5) ? 1 : 0);
        const recompute = K === 0 ? 0 : H - (nst - 1), peak = K === 0 ? H + 1 : nst + Math.max(0, K - 1);
        cl(K === 0 ? '全存：前向的每个状态都留着' : `每 ${K} 步存一个（金色），共 ${nst} 个`);
        cap(`${H} 步 · 显存峰值约 <b>${peak}</b> 个状态 · 前向 ${H} 步 + 反传时重算 <b>${recompute}</b> 步${K === 1 ? '（每步都存，等于 MPM 代码的做法：只省子步内部的网格量）' : ''}`);
      }
    } };
  }

  /* ---------- scene 6: tasks ---------- */
  function s6(G) {
    let hi = +(OPT[0] ?? 0);
    const bars = [], hl = [];
    TK.forEach((t, i) => {
      const r = Math.floor(i / 3), c = i % 3, x = -9 + c * 9, z = -6 + r * 6, low = i >= 6;
      G.add(block(7.4, 0.2, 4.0, low ? 0x3b2f5c : 0x24304a, [x, 0.1, z]));
      if (i <= 4) { if (i === 2) { G.add(block(1.6, 0.06, 1.0, COL.cloth, [x - 1.6, 0.25, z]), block(2.6, 0.06, 0.4, COL.cloth, [x - 1.6, 0.25, z - 0.7])); } else G.add(block(2.0, 0.06 + (i === 1 || i === 4 ? 0.12 : i === 0 || i === 3 ? 0.06 : 0), 1.2, COL.cloth, [x - 1.6, 0.25, z])); }
      else if (i <= 6) G.add(L.tube([[x - 2.8, 0.3, z - 0.6], [x - 2.0, 0.3, z + 0.6], [x - 1.2, 0.3, z - 0.4], [x - 0.6, i === 6 ? 1.2 : 0.3, z + 0.3]], COL.rope, 0.12));
      else { const bowl = L.cyl(0.9, 0.6, 0.7, 0x9aa6bf, { opacity: 0.7 }); bowl.position.set(x - 1.8, 0.6, z); G.add(bowl); const w = L.cyl(0.75, 0.6, 0.4, COL.water); w.position.set(x - 1.8, 0.6, z); G.add(w); }
      const b = block(0.9, 1, 0.9, low ? COL.purple : COL.blue, [x + 1.8, 0.5, z]); G.add(b); bars.push(b);
      G.add(lab(TKS[i], [x - 1.4, 1.6, z + 1.4], { size: 17 }));
      hl.push(dynLab(G, [x + 1.6, 0.3, z + 1.6], { size: 15 }));
    });
    G.add(lab('蓝：宏动作  紫：低层控制  橙：论文和代码不同', [0, 0.3, 9.8], { size: 18 }));
    const ctls = [{ label: '视野', items: ['论文 §3.2', '代码 max_steps'], get: () => hi, set: k => { hi = k; } }];
    return { ctls, update(p) {
      const g = seg(p, 0, 0.5);
      bars.forEach((b, i) => { const H = hi ? HC[i] : HP[i], h = Math.max(0.05, 0.42 * Math.sqrt(H) * g), diff = HP[i] !== HC[i]; b.scale.y = h; b.position.y = h / 2 + 0.2;
        const col = diff && hi ? COL.warn : i >= 6 ? COL.purple : COL.blue; b.material.color.setHex(col); b.userData.c = hex3(col);
        hl[i](diff ? (hi ? `${H} 步（论文 ${HP[i]}）` : `${H} 步（代码 ${HC[i]}）`) : `${H} 步`); });
      cap(hi ? '代码：T 恤 <b>5</b>、展开 <b>15</b>、倒汤 <b>120</b>，其余和论文相同' : '论文：宏动作 3 到 10 步；甩绳 70、倒水和倒汤 100 步');
    } };
  }

  /* ---------- scene 7: reward ---------- */
  function s7(G) {
    let di = +(OPT[0] ?? 0); const NP = 12, SC = 18;
    const goal = Array.from({ length: NP }, (_, i) => [0.36 + 0.28 * i / (NP - 1), 0.5]);
    const start = Array.from({ length: NP }, (_, i) => { const t = i / (NP - 1); return [0.38 + 0.22 * t, 0.5 + 0.12 * Math.sin(t * 2 * PI)]; });
    const perm = [3, 7, 0, 10, 5, 1, 11, 8, 2, 6, 9, 4];
    const P = q => [(q[0] - 0.5) * SC, 0.2, (q[1] - 0.5) * SC];
    floorRect(G, 0, 0, 14, 10, COL.wood, { y: 0 });
    const gp = inst(BALL, NP); gp.material.color.setHex(COL.diff); gp.material.opacity = 0.6; gp.material.transparent = true; G.add(gp);
    const cp = inst(BALL, NP); cp.material.color.setHex(COL.rope); G.add(cp);
    const lines = segs(G, NP * 2, COL.warn, { opacity: 0.85 });
    const grip = new THREE.Mesh(BALL, L.mat(COL.gold)); grip.scale.setScalar(0.3); G.add(grip); const gl = segs(G, 1, COL.gold, { opacity: 0.9 });
    const rB = block(0.9, 1, 0.9, COL.diff, [5.0, 0.5, 2.0]), aB = block(0.9, 1, 0.9, COL.gold, [6.4, 0.5, 2.0]); G.add(rB, aB);
    const rl = dynLab(G, [4.6, 0.3, 3.4], { size: 16 }), alb = dynLab(G, [6.8, 0.3, 3.4], { size: 16 });
    G.add(lab('绿：目标 g  米色：当前粒子  橙线：D 里配对的两点', [0, 0.3, 5.6], { size: 17 }));
    const ctls = [{ label: '距离 D', items: ['按编号（MPM）', '编号被打乱', '倒角（布）'], get: () => di, set: k => { di = k; } }];
    return { ctls, update(p) {
      const e = seg(p, 0.05, 0.75), cur = start.map((s, i) => [L.lerp(s[0], goal[i][0], e), L.lerp(s[1], goal[i][1], e)]);
      goal.forEach((q, i) => setI(gp, i, P(q), 0.2)); cur.forEach((q, i) => setI(cp, i, P(q), 0.22)); done(gp); done(cp);
      const d3 = (a, b) => Math.sqrt(((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) / 3);
      let D = 0; const pos = lines.userData.pos; pos.fill(0); let k = 0;
      if (di < 2) { cur.forEach((q, i) => { const g = goal[di ? perm[i] : i]; D += d3(q, g) / NP; pos.set([...P(q), ...P(g)], k * 6); k++; }); }
      else { let a = 0, b = 0; cur.forEach(q => { let m = 1e9, j0 = 0; goal.forEach((g, j) => { const d = d3(q, g); if (d < m) { m = d; j0 = j; } }); a += m / NP; pos.set([...P(q), ...P(goal[j0])], k * 6); k++; });
        goal.forEach(g => { let m = 1e9, j0 = 0; cur.forEach((q, j) => { const d = d3(q, g); if (d < m) { m = d; j0 = j; } }); b += m / NP; pos.set([...P(g), ...P(cur[j0])], k * 6); k++; }); D = a + b; }
      lines.userData.up();
      const r = Math.exp(-10 * D), gpnt = [0.44 + 0.1 * Math.sin(p * 2 * PI), 0.66];
      let md = 1e9, mj = 0; cur.forEach((q, j) => { const d = Math.hypot(q[0] - gpnt[0], q[1] - gpnt[1]); if (d < md) { md = d; mj = j; } });
      grip.position.set(...P(gpnt)); grip.position.y = 0.5; gl.userData.pos.set([...P(gpnt), ...P(cur[mj])]); gl.userData.up();
      const ra = Math.exp(-md); rB.scale.y = r * 3.5; rB.position.y = r * 1.75; aB.scale.y = ra * 3.5; aB.position.y = ra * 1.75;
      rl(`r_gt ${r.toFixed(3)}`); alb(`r_aux ${ra.toFixed(3)}`);
      cap(`D = <b>${D.toFixed(4)}</b> · r_gt = exp(−10 D) = <b>${r.toFixed(3)}</b>${di === 1 && e > 0.99 ? ' · 形状已经对上，D 仍不为零' : ''} · r_aux = exp(−${md.toFixed(3)}) = ${ra.toFixed(3)}`);
    } };
  }

  /* ---------- scene 8: gradient paths ---------- */
  function s8(G) {
    let mi = +(OPT[0] ?? 1); const NM = ['APG', 'SHAC 原文', 'SHAC 代码', 'ILD', '可微 MPC'];
    const sub = new THREE.Group(); G.add(sub); let last = -1, R = null;
    const H = 6, X0 = -11, DX = 3.7, sx = i => X0 + i * DX;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); last = mi; R = { st: [], gr: [], fw: [], extra: [] };
      const pol = mi !== 4;
      for (let i = 0; i <= H; i++) { const b = block(1.4, 1.4, 1.4, 0x3aa8e0, [sx(i), 1.2, 0]); sub.add(b, lab(`s${i}`, [sx(i), 1.2, 0.95], { size: 15 })); R.st.push(b); }
      for (let i = 0; i < H; i++) {
        const a = block(1.0, 0.7, 0.7, COL.orange, [sx(i) + 1.6, -0.7, 0]); sub.add(a, lab(`a${i}`, [sx(i) + 1.6, -1.5, 0], { size: 14 }));
        R.fw.push(arrowObj(sub, [sx(i) + 0.75, 1.2, 0], [sx(i + 1) - 0.75, 1.2, 0], 0x6b7794));
        R.gr.push(arrowObj(sub, [sx(i + 1) - 0.8, 1.9, 0], [sx(i) + 1.6, 0.0, 0], COL.grad));
        if (mi === 1 && i % 3 === 2) { const c = wire(sub, [[sx(i + 1) + 0.0, -0.4, 0], [sx(i + 1) + 0.0, 3.4, 0]], COL.warn, { dashed: true, opacity: 0.9 }); R.extra.push(c); }
      }
      if (pol) { const pb = block(1.6, 0.7, 0.7, COL.purple, [-13.4, -0.7, 0]); sub.add(pb, lab('π_θ', [-13.4, -1.5, 0], { size: 16 })); }
      if (mi === 0 || mi === 2 || mi === 4) for (let i = 1; i <= H; i++) { const r = block(0.7, 0.7, 0.7, COL.gold, [sx(i), 3.0, 0]); sub.add(r, lab(`r${i}`, [sx(i) + 0.75, 3.4, 0], { size: 13 })); }
      if (mi === 1) { for (let i = 1; i <= H; i++) { const r = block(0.7, 0.7, 0.7, COL.gold, [sx(i), 3.0, 0]); sub.add(r); } [3, 6].forEach(i => { const v = block(1.2, 0.8, 0.8, COL.diff, [sx(i) + 0.9, 4.4, 0]); sub.add(v, lab('V(s)', [sx(i) + 0.9, 5.3, 0], { size: 15, color: '#4fc98a' })); }); }
      if (mi === 2) { const v = block(1.2, 0.8, 0.8, 0x5a6b8c, [sx(6) + 0.9, 4.4, 0], { opacity: 0.5 }); sub.add(v, lab('V × 0', [sx(6) + 0.9, 5.3, 0], { size: 15, color: '#ff7a59' })); }
      if (mi === 3) for (let i = 1; i <= H; i++) { const g = block(1.2, 1.2, 1.2, COL.diff, [sx(i), 4.4, 0]); sub.add(g, lab(`g${i}`, [sx(i) + 0.9, 5.0, 0], { size: 14, color: '#4fc98a' })); R.extra.push(arrowObj(sub, [sx(i), 3.7, 0], [sx(i), 2.0, 0], COL.diff)); }
      const T = ['APG：整段回合的奖励和，梯度沿整条链流回每个动作和策略（代码默认展开 10 步）', 'SHAC 原文：每 h 步一个窗口（这里 h = 3），窗口末接 V，窗口之间切断梯度（红虚线）', 'SHAC 发布代码：窗口 = 整个回合，最后一步 V 被掩码清零 → 和 APG 只差折扣 0.99', 'ILD：每步把 s_t 拉向专家状态 g_t，动作的梯度来自它之后所有步的匹配误差', '可微 MPC：没有策略，动作序列本身是参数；每步奖励的梯度直接改动作'];
      sub.add(lab(T[mi], [0, 7.2, 0], { size: 19 }));
    }
    rebuild();
    const ctls = [{ label: '方法', items: NM, get: () => mi, set: k => { mi = k; } }];
    return { ctls, update(p) {
      if (last !== mi) rebuild();
      const f = seg(p, 0, 0.35), b = seg(p, 0.42, 0.95);
      R.fw.forEach((a, i) => { a.visible = f * H > i; });
      R.gr.forEach((a, i) => { a.visible = mi === 1 ? b * 3 > 2 - (i % 3) : b * H > H - 1 - i; });
      R.st.forEach((s, i) => glow(s, p < 0.38 ? (f * H >= i ? 0.4 : 0) : 0.1));
      cap(p < 0.4 ? '前向：从 s0 依次执行动作' : mi === 1 ? '反传：每个窗口各自从末端 V 和窗口内奖励往回传，<b>不跨窗口</b>' : mi === 2 ? '反传：和 APG 一样穿过整个回合；评论家训练了，但进不了演员损失' : mi === 3 ? '反传：每个 g_t 的误差都流回它之前的所有动作' : '反传：<b>绿色</b>是梯度，从损失流回动作');
    } };
  }

  /* ---------- scene 9: why gradients get stuck (toy) ---------- */
  function s9(G) {
    let mi = +(OPT[0] ?? 2); const NM = ['diff-MPC（随机初值）', 'CEM-MPC', 'diff-CEM-MPC'];
    const r = a => (a < 0.35 || a > 0.65) ? 0.2 : 0.2 + 0.25 * Math.exp(-(((a - 0.42) / 0.03) ** 2)) + 0.5 * Math.exp(-(((a - 0.58) / 0.025) ** 2)) + 0.02 * Math.sin(90 * a);
    const dr = a => (r(a + 1e-4) - r(a - 1e-4)) / 2e-4, gd = (a0, n) => { const out = [a0]; let a = a0; for (let i = 0; i < n; i++) { a = clamp(a + 0.0003 * dr(a), 0, 1); out.push(a); } return out; };
    const rng = L.rng(7), gs = () => L.gauss(rng);
    const INIT = [0.12, 0.27, 0.44, 0.79, 0.9], GD = INIT.map(a => gd(a, 40));
    const CEM = []; let m = 0.5, sd = 0.28; for (let it = 0; it < 6; it++) { const smp = Array.from({ length: 24 }, () => clamp(m + sd * gs(), 0, 1)); const el = smp.slice().sort((a, b) => r(b) - r(a)).slice(0, 5); CEM.push({ smp, el, m }); m = el.reduce((s, v) => s + v, 0) / 5; sd = Math.max(0.01, Math.sqrt(el.reduce((s, v) => s + (v - m) ** 2, 0) / 5)); }
    const cemBest = CEM[5].el[0], REF = gd(cemBest, 40);
    const XP = -10, WP = 20, YP = 0.5, HP = 7, px = a => XP + WP * a, py = v => YP + HP * v;
    panel(G, XP - 0.4, YP - 0.4, -0.3, WP + 0.8, HP + 0.8);
    const sh = panel(G, px(0.35), YP, -0.2, WP * 0.3, HP, { color: 0x2b3650, opacity: 0.5 });
    const cur = ribbon(G, 300, COL.white, 0.06); cur.userData.set(Array.from({ length: 300 }, (_, i) => { const a = i / 299; return [px(a), py(r(a)), 0]; }));
    G.add(lab('布在这里（0.35–0.65）', [px(0.5), py(0.95), 0], { size: 17 }), lab('布外：抓空，r 恒为 0.20，梯度 0', [px(0.16), py(0.34), 0], { size: 16 }), lab('拾取位置 a', [px(0.5), YP - 1.1, 0], { size: 16 }));
    const dots = inst(BALL, 24); G.add(dots); const gdD = inst(BALL, 5); gdD.material.color.setHex(COL.warn); G.add(gdD);
    const best = new THREE.Mesh(BALL, L.mat(COL.diff, { emissive: 0x1a5a2a })); best.scale.setScalar(0.32); G.add(best);
    const ctls = [{ label: '方法', items: NM, get: () => mi, set: k => { mi = k; } }];
    return { ctls, update(p) {
      dots.visible = mi > 0; gdD.visible = mi === 0; best.visible = mi > 0;
      if (mi === 0) { const k = Math.round(seg(p, 0.05, 0.9) * 40); GD.forEach((g, i) => setI(gdD, i, [px(g[k]), py(r(g[k])), 0.3], 0.26)); done(gdD);
        cap(`梯度上升第 ${k} 步 · 5 个随机初值的最终奖励：${GD.map(g => r(g[k]).toFixed(2)).join('、')}（布外的两个不动）`); return; }
      const cemP = mi === 1 ? seg(p, 0.05, 0.9) : seg(p, 0.05, 0.55), it = Math.min(5, Math.floor(cemP * 6)), C = CEM[it], cE = hex3(COL.diff), cS = hex3(0x8e9bb8);
      C.smp.forEach((a, i) => { setI(dots, i, [px(a), py(r(a)), 0.25], 0.17); colI(dots, i, C.el.includes(a) ? cE : cS); }); done(dots);
      let a = C.el[0], msg = `CEM 第 ${it + 1} / 6 轮 · 24 个样本，绿色是 5 个精英 · 目前最好 r = ${r(a).toFixed(3)}`;
      if (mi === 2 && p > 0.58) { const k = Math.round(seg(p, 0.6, 0.92) * 40); a = REF[k]; msg = `CEM 结果 r = ${r(cemBest).toFixed(3)} → 梯度细调第 ${k} 步 → <b>${r(a).toFixed(3)}</b>`; }
      best.position.set(px(a), py(r(a)), 0.4); cap(msg);
    } };
  }

  /* ---------- scene 10: result tables ---------- */
  function s10(G) {
    let view = +(OPT[0] ?? 2); G.add(L.grid(40, 40)); const sub = new THREE.Group(); G.add(sub);
    const V = [
      { t: '表 3 · 模仿学习（20 种子均值）', s: [['Transporter', 0x8e9bb8, T3.Transporter], ['ILD', COL.diff, T3.ILD], ['专家', COL.gold, T3['专家']]] },
      { t: '表 3 · 规划', s: [['CEM-MPC', 0x8e9bb8, T3['CEM-MPC']], ['Diff-MPC', 0x2f8f6a, T3['Diff-MPC']], ['Diff-CEM-MPC', COL.diff, T3['Diff-CEM-MPC']]] },
      { t: '表 4 · 强化学习', s: [['PPO', 0xb98f75, T4.PPO], ['APG', 0x3a6dd8, T4.APG], ['SHAC', 0x2fb5b5, T4.SHAC]] },
      { t: '图 3 曲线终点（矢量读数，无 Fold-Cloth-1）', s: [['PPO', 0xb98f75, F3E.PPO], ['APG', 0x3a6dd8, F3E.APG], ['SHAC', 0x2fb5b5, F3E.SHAC]] },
      { t: '表 5 · Transporter-RGB 对 ILD', s: [['Transporter', 0x8e9bb8, T3.Transporter], ['Transporter-RGB', COL.blue, RGB], ['ILD', COL.diff, T3.ILD]] }
    ];
    let bars = [], last = -1;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = view; const v = V[view], gw = 3.9, w = 1.0;
      TKS.forEach((nm, i) => { const x0 = (i - 4) * gw; sub.add(lab(nm, [x0, -0.3, 2.4], { size: 17 }));
        v.s.forEach(([sn, c, vals], j) => { const x = x0 + (j - 1) * (w + 0.08), val = vals[i]; if (val == null) { sub.add(lab('—', [x, 0.4, 0], { size: 14 })); return; }
          const b = block(w, 1, w, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(val.toFixed(2), [x, 0, 0.6], { size: 13 }); sub.add(l); bars.push({ b, l, v: val, j }); }); });
      v.s.forEach(([sn, c], j) => sub.add(lab(sn, [-14 + j * 5.6, 11.6, 0], { size: 19, color: css(c) })));
      sub.add(lab(v.t, [8.0, 11.6, 0], { size: 20, border: 'rgba(56,209,255,.7)' }));
      sub.add(lab('宏动作 ←│→ 低层', [5.4, -1.6, 2.2], { size: 15 }));
    }
    rebuild();
    const MSG = ['ILD 6 个宏动作任务都高于粒子版 Transporter（推绳只高 0.06）；低层任务 ILD 离专家很远', 'diff-CEM-MPC 比 CEM-MPC 高 0.01–0.10，<b>全部在布料</b>；绳和液体 −0.01 到 0', 'PPO 在宏动作上多数领先；APG 只在<b>甩绳</b>大幅领先（0.83 对 0.25），倒水三者 0.27–0.28', '和表 4 比：SHAC 展开布 0.16 / 0.09（表 4 是 0.50 / 0.48），PPO 甩绳 0.03（表 4 是 0.25）', 'Transporter-RGB 在 <b>5 / 6</b> 个宏动作任务上高于 ILD，只有叠布 3 是 ILD 高'];
    const ctls = [{ label: '图表', items: ['表 3 模仿', '表 3 规划', '表 4 强化', '图 3 终点', '表 5 RGB'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const g = seg(p, 0, 0.5); bars.forEach(({ b, l, v, j }) => { const h = Math.max(0.02, v * 9 * g); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.45 + 1.15 * j; });
      cap(MSG[view]);
    } };
  }

  /* ---------- scene 11: sim-to-real push-rope ---------- */
  function s11(G) {
    floorRect(G, 0, 0, 30, 18, 0x1b2438, { y: -0.02 });
    const tbl = block(9, 0.3, 6, 0x4a4f5a, [-4, 0.15, 0]); G.add(tbl);
    const arm = L.arm(0x9aa6bf); arm.position.set(-9.6, 0.3, -2.2); G.add(arm);
    const camB = block(0.9, 0.6, 0.6, 0x2b3650, [-4, 6.2, 0]); G.add(camB, lab('深度相机 → 点云 → 粒子状态', [-8.2, 5.6, 0], { size: 16 }));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(3.4, 5.6, 4, 1, true), new THREE.MeshBasicMaterial({ color: 0x7cb8ff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false })); cone.position.set(-4, 3.2, 0); cone.rotation.y = PI / 4; G.add(cone);
    const cem = block(3.2, 1.4, 1.4, COL.diff, [5.5, 3.4, -2]), dax = block(2.6, 1.0, 1.2, COL.sim, [5.5, 1.4, -2]); G.add(cem, dax, lab('CEM-MPC', [5.5, 4.6, -2], { size: 17 }), lab('DaX 预测', [5.5, 2.4, -1.2], { size: 15 }));
    const fw = stream(G, 10, COL.fwd, 0.12);
    const A = [0.32, 0.26, 0.2, 0.13, 0.08, 0.04, 0.01];
    const shape = (k, z0, noise) => Array.from({ length: 9 }, (_, i) => { const t = i / 8; return [-1.8 + 3.6 * t, 0.35, z0 + A[k] * 6 * Math.sin(PI * t * 1.6 + 0.4) + (noise ? 0.12 * Math.sin(7 * t + k) : 0)]; });
    const rope = ropeMesh(G, COL.rope, 0.13);
    const thumbs = []; for (let r = 0; r < 2; r++) for (let k = 1; k <= 6; k++) { const x = 1.5 + (k - 1) * 2.0, z = 4.4 + r * 2.4; G.add(block(1.8, 0.1, 1.8, r ? 0x5a3e28 : 0x55585e, [x, 0.05, z])); thumbs.push({ r, k, x, z, m: ropeMesh(G, COL.rope, 0.05) }); }
    G.add(lab('真机', [-0.2, 0.5, 4.4], { size: 15 }), lab('DaX 一步预测', [-0.6, 0.5, 6.8], { size: 15 }));
    return { update(p) {
      const k = Math.min(5, Math.floor(p * 6)), u = (p * 6) % 1, a = seg(u, 0.25, 0.85);
      const S0 = shape(k, 0, false), S1 = shape(k + 1, 0, false), rp = S0.map((q, i) => [q[0] - 4, q[1] + 0.3, L.lerp(q[2], S1[i][2], a)]);
      rope(rp);
      const tgt = [L.lerp(-4.6, -3.4, a), 0.9, L.lerp(1.2, 0.0, a) * (k % 2 ? -1 : 1)]; arm.userData.reach(tgt);
      thumbs.forEach(t => { const s = shape(t.k, 0, t.r === 1).map(q => [t.x + q[0] * 0.22, 0.2, t.z + q[2] * 0.22]); t.m(t.k <= k + (a > 0.9 ? 1 : 0) ? s : s.map(q => [q[0], -2, q[2]])); });
      fw([[-4, 6, 0], [5.5, 3.4, -2], [-8, 3, -2.2]], (p * 5) % 1, 1); glow(cem, 0.3 + 0.3 * Math.sin(p * 40));
      cap(`第 ${k + 1} / 6 次推 · CEM-MPC 在 DaX 里试推、选出最好的一次，机械臂执行 · 论文只给定性对比`);
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player (same as interactives/latent) ---------- */
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
  window.__daxDebug = { clothSim, mpmSim, get cap() { return $('cap').textContent; } };
})();
