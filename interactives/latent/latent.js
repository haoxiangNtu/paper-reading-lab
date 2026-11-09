'use strict';
/* LATENT (arXiv 2603.12686) taken apart into eleven animated scenes. Court size comes from the vector drawing of the
   paper's Fig. 3; tables are copied from the paper; tracker details from the official code at commit a931da5.
   Each scene's update(p) is a pure function of the timeline p plus the current toggles. The humanoid and its strokes
   are hand-made. Scenes 4, 5, 6, 8 and 9 compute their numbers live on toy problems; those are toys and are labelled so.
   No LATENT network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { track: 0x38d1ff, distil: 0x4fc98a, high: 0xf2c14e, real: 0xff7a59, prior: 0x7cb8ff, post: 0x4fc98a, ball: 0xe8f060, court: 0x2f8a4a, line: 0xeef2fa, ref: 0xe05d5d, robot: 0xc9d4ea, wrist: 0xf0963c, bad: 0xe05d5d, ok: 0x4fc98a, dim: 0x46506a, white: 0xeef2fa, purple: 0x9d8cff, net: 0xdde3ee };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  const SCENES = [
    { n: 1, part: '总览', title: '四个面板，三段训练', sub: '图 2 的 3D 版：跟踪器 → 蒸馏 → 高层策略 → 上真机', dur: 14, cam: [0.1, 1.05, 31, [0, 2.4, 0]],
      html: dl([['(a)', '跟踪器 π_tracker，PPO，模仿 5 小时片段'], ['(b)', '在线蒸馏（DAgger）到 ℰ / 𝒫 / 𝒟'], ['(c)', '高层 π_planner，PPO，任务奖励'], ['(d)', '动力学随机化 + 观测噪声'], ['频率', '策略 50 Hz；仿真 2000 Hz']]) +
        '<p>三段依次训练：(a) 的跟踪器当 (b) 的老师；(b) 学出的先验和解码器在 (c) 里冻结，只训练高层。这和 SuperMimic 表 1 里 LATENT 那一行（PPO / DAgger / PPO，三格不合并）一致。</p>' +
        '<p>(c) 的高层有两路输出：一路是潜动作，经过潜动作屏障（LAB）和先验后进解码器；一路直接控右手腕。表 1 的“下游 PPO”看不出第二路。</p>' +
        '<p>点画面里的方块可以跳到对应那一幕。</p>' + src('§3 · 图 2') },
    { n: 2, part: '§3.1 尺寸', title: '采数据的场地、训练的场地、部署的场地', sub: '四个矩形都是真实尺寸，面积当场算', dur: 12, cam: [0.0, 0.9, 30, [0, 0, 0]],
      html: dl([['标准场', '23.77 × 10.97 m（ITF 双打）'], ['仿真场', '13 × 6 m（图 3 矢量读数）'], ['动捕采集', '3 × 5 m（§3.1）'], ['真机动捕', '19 × 15 m（代码 README）']]) +
        '<p>论文说采集区“比标准场小 17 倍以上”：260.8 / 15 = 17.4，用的是双打场。</p>' +
        '<p>但仿真用的场地是 13 m × 6 m，长、宽、单打线、发球线都正好是标准场的 0.547 倍，论文正文没说。真机部署的动捕区 19 m × 15 m 装不下 23.77 m 长的标准场。</p>' +
        '<p>所以“只采片段”省下的是采集场地；部署时仍然要一个大动捕场（README：50 多台相机，约 3 周，约 35 万元）。</p>' + src('§3.1 · 图 3(b) · 代码 README · ITF 规则') },
    { n: 3, part: '§3.2.1 跟踪器', title: '跟踪器不管右手腕，手腕被随机拨动', sub: '切换“代码：排除手腕”和“全身跟踪（w/o Corr.）”', dur: 14, cam: [0.2, 1.2, 15, [1.4, 1.6, 0]],
      html: dl([['输入', 's_t（角速度、重力、关节位置速度、上一帧动作）+ s̃_{t+1}'], ['输出', 'â_body，代码里 26 维（29 − 右手腕 3）'], ['手腕', '每 0.5–2.0 s 在全行程内重抽 PD 目标（代码）'], ['网络', 'MLP (512, 512, 256, 256, 128)（代码）']]) +
        '<p>人手腕的挥拍动作捕不准，重定向又放大误差，所以后面要让高层直接修正手腕。为了让跟踪器在手腕被任意拨动时仍然站得稳、跟得准，训练时把右手腕从它的动作里拿掉，并且不断给手腕一个随机目标。</p>' +
        '<p>论文只说“随机扰动”。代码里这个扰动很大：目标在整个关节行程里均匀抽，0.5 到 2 秒换一次。被排除的三个连杆也不进跟踪奖励。</p>' +
        '<p>切到“全身跟踪”就是表 4 的 w/o Corr.：手腕也由跟踪器跟着（不准的）参考走，之后高层无法修正。</p>' +
        guess('小人是手工的；红色半透明是参考动作，蓝色是机器人。手腕曲线按代码规则用固定种子生成，行程取 ±1 rad 是我设的。') +
        src('§3.2.1 · 代码 g1_env_tracking_tennis.py、g1_tracking_constants_tennis.py') },
    { n: 4, part: '§3.2.2 DAgger', title: '为什么是 DAgger 而不是行为克隆', sub: '一维玩具当场算：学生只在老师走过的地方学过', dur: 16, cam: [0.0, 1.25, 22, [0, 3.4, 0]],
      html: dl([['式 (2)', 'E_{(s,â)∼D_agg} ‖â − a‖²'], ['D_agg', '学生滚出的状态 + 老师在这些状态上的动作'], ['老师', '跟踪器，DAgger 中固定'], ['学生', 'ℰ / 𝒫 / 𝒟，不含右手腕']]) +
        '<p>行为克隆（BC）只在老师自己走过的状态上收集标签。学生一旦犯错偏离，就到了从没见过的状态，错误会越滚越大。DAgger 让<b>学生</b>自己去跑，在学生到过的状态上请老师标注，再把数据并进缓存重新拟合。</p>' +
        '<p>论文用的是这种在线蒸馏（同 PULSE）。SuperMimic 表 1 的“潜变量：DAgger”说的就是这一步。</p>' +
        toyb('状态是跟踪误差 e，e_{t+1} = e_t + 0.1(a + 0.6) + 噪声。老师 a* = −0.6 − 2 sin(1.5e)，|e| > 1 以外再加线性回拉。学生是 9 个高斯基函数的岭回归。BC 只用老师的 rollout；DAgger 每轮用学生的 rollout，共 5 轮。误差是 40 条测试 rollout 的平均 |e|，都是页面当场算的。') +
        src('§3.2.2 式 (1)(2) · DAgger（Ross 等 2011）') },
    { n: 5, part: '§3.2.2 先验', title: '条件先验：每个状态有自己的“正常动作范围”', sub: '切换固定 N(0, I) 和条件先验，KL 当场算', dur: 14, cam: [0.0, 1.0, 12.5, [0, 0, 0.4]],
      html: dl([['后验', 'ℰ(z | s, s̃) = N(μᵉ, σᵉ)'], ['先验', '𝒫(z | s) = N(μᵖ(s), σᵖ(s))'], ['式 (3)', 'L_KL = D_KL(ℰ ‖ 𝒫)'], ['每维', 'log(σᵖ/σᵉ) + (σᵉ² + (μᵉ−μᵖ)²)/(2σᵖ²) − ½']]) +
        '<p>普通 VAE 把所有后验都拉向同一个 N(0, I)。可是侧滑步时和挥拍时，“合理的下一步动作”差别很大。条件先验只看状态 s，给出这个状态下潜码的均值和每一维的宽度 σᵖ。</p>' +
        '<p>这个 σᵖ 在第 8 幕还要用：高层能离先验均值多远，就由它决定。</p>' +
        toyb('二维潜空间。两个状态的先验均值和标准差、后验的轨迹都是我设的；KL 用对角高斯的闭式当场算。论文没给潜维数。') +
        src('§3.2.2 式 (3) · 图 2(b)') },
    { n: 6, part: '§3.3.1 任务', title: '8 个球，每 2 秒一个', sub: '球按 f = −k m v‖v‖ 当场积分；切换阻力系数看落点', dur: 16, cam: [-0.5, 0.95, 18, [-1, 0.8, 0]],
      html: dl([['场地', '13 × 6 m（图 3）'], ['回合', '8 球，每 2 s 一个，≥ 16 s = 800 步'], ['输入', 's_t、g_t（根部全局位姿）、b_t（球）'], ['任务奖励', '接近球 10，击中 200，落点 30'], ['终止', '摔倒、漏球 −200；触网、出界、姿势违规 −50']]) +
        '<p>回合开始时机器人以准备姿势随机放在本方场地。球从对面底线附近发出，落在本方半场（图 3 的叉号范围大约 x = −5.3 到 −2 m），机器人要跑过去把它打回目标点。成功 = 落点离目标 2.5 m 以内。</p>' +
        '<p>表 1 一共 26 项奖励，但只有名字和权重，没有公式。</p>' +
        toyb('发球点、落点按图 3 的范围用固定种子抽，初速度按无阻力抛体反解。飞行按重力加 f = −k m v‖v‖ 积分（步长 1 ms），反弹恢复系数 0.75，不模拟切向阻尼和旋转。切换 k 可以看阻力让球落短多少。小人的移动和挥拍是示意。') +
        src('§3.3.1 · 表 1 · 表 2 · 图 3') },
    { n: 7, part: '§3.3.2 修正', title: '高层直接控右手腕', sub: '拍面偏几度，球落偏多少', dur: 13, cam: [0.3, 1.0, 16, [-0.5, 0.6, 0]],
      html: dl([['高层输出', 'a_planner = [a_latent, a_correct]'], ['a_correct', '右手腕 roll / pitch / yaw 的直接指令'], ['正则', '修正动作 −5.0，修正变化率 −1.0，手腕力矩 −4·10⁻⁵'], ['表 4 去掉后', '正手 96.52 → 82.36%，DE 1.32 → 3.41 m']]) +
        '<p>网球的落点对拍面角度极敏感，而人体数据里这部分恰恰最不准。所以手腕不走潜空间，由高层直接给目标（做法同 Vid2Player3D 的混合控制）。潜空间在第 3 幕已经被训练成对手腕的任意动作鲁棒，所以这里怎样拧手腕都不会让下肢失衡。</p>' +
        toyb('只用拍面法向决定回球方向：拍面偏 δ，回球方向偏约 δ，飞 8 m 后横向偏 8·tan δ。忽略拍速、旋转和来球角度，是最粗的近似，只为看出量级。红圈是 2.5 m 的成功半径。') +
        src('§3.3.2 · 表 1 · 表 4') },
    { n: 8, part: '§3.3.3 LAB', title: '潜动作屏障：按先验的宽度圈住探索', sub: '这一幕是核心。切换三种约束和 λ，落在技能流形里的比例当场算', dur: 16, cam: [0.0, 0.85, 8.2, [0, 0, 0.5]],
      html: dl([['式 (4)', 'z = μᵖ + λσᵖ·tanh(a_latent)'], ['残差先验', 'z = μᵖ + a（PULSE、R²S² 的做法）'], ['可达区域', '每维 |z − μᵖ| ≤ λσᵖ，是盒子'], ['马氏距离', '盒子角落是 λ√d'], ['λ', '论文没给']]) +
        '<p>没有约束时，高层会钻空子：在潜空间里找到能完成任务、但解码出来又抖又怪的动作。残差先验把起点放在先验均值，但不限制走多远。LAB 用 tanh 把每一维限制在 λ 个先验标准差以内，σᵖ 小的方向（这个状态下动作很确定）就几乎不让动。</p>' +
        '<p>注意它是逐维的盒子，不是论文说的马氏距离球（椭圆）。切换“欧氏球”可以看为什么要按 σᵖ 缩放：同样大小的圆在窄方向上会跑出流形。</p>' +
        '<p>表 4 去掉 LAB：成功率只掉 1.6 到 5.1 个点，但关节力矩高 46% 到 79%、平滑度差 14% 到 47%。</p>' +
        toyb('二维潜空间，两个状态的 σᵖ 是我设的。高层输出 a 取一团固定种子的高斯样本（均值偏向一个“好用但不自然”的方向）。“落在流形里”定义为马氏距离 ≤ 2。比例是当场数的。') +
        src('§3.3.3 式 (4) · 图 4 · 表 4') },
    { n: 9, part: '§4.2 球速', title: '四帧平均速度 = 隔三帧的差分', sub: '位置带噪声，比较三种速度估计；切换噪声幅度', dur: 13, cam: [0.0, 1.22, 22, [0, 3.2, 0]],
      html: dl([['观测噪声', '均匀噪声、丢帧、延迟'], ['球速', '位置有限差分，四帧滑窗取平均'], ['等价', '(p_t − p_{t−3}) / (3Δt)'], ['噪声', '降到单步差分的 1/3'], ['代价', '对应窗口中点，晚 1.5 帧 = 30 ms']]) +
        '<p>动捕给的是球的位置，速度要自己差分。位置噪声经差分被放大 √2/Δt 倍，在 50 Hz 时就是 70 倍。把窗口里的差分平均，中间项会两两抵消，只剩首尾两点，所以平均等于隔三帧差分，噪声降到三分之一。</p>' +
        '<p>代价是延迟。仿真和真机用同样的窗口，策略可以学着补偿。</p>' +
        toyb('一条带阻力的真实球轨迹，以 50 Hz 采样，加高斯位置噪声（幅度我设的，论文没给）。RMS 误差相对“当前时刻的真实速度”和“窗口中点的真实速度”各算一次，都是当场算的。') +
        src('§4.2 · 我的推导见精读页读者注 13') },
    { n: 10, part: '§4.3 真机', title: '动捕场里的对打', sub: '切换表 5 的三行，看每格是几次中的几次', dur: 14, cam: [0.15, 1.08, 33, [0, 0.5, -1.5]],
      html: dl([['机器人', 'Unitree G1，29 自由度，右手换成 3D 打印接头 + 网球拍'], ['状态', '机器人基座贴反光标记；球包反光胶带'], ['动捕', 'README：50+ 相机，2048²，120 Hz，19 × 15 m'], ['评测', '20 次对打；成功 = 回到对方场内']]) +
        '<p>表 5 的百分比可以还原成次数：Ours 是正手 10/11、反手 7/9、前场 8/9、后场 9/11，合计 20 次 17 次成功。两个基线按最小解是 14 次和 15 次（我的推算）。每格只有 4 到 11 次。</p>' +
        '<p>真机的成功判据（回到场内）比仿真（离目标 2.5 m 内）宽松，真机 DE 3.15 到 3.89 m，两张表的 SR 不能直接比。</p>' +
        guess('场地、相机和人的位置是示意。相机数取 52（README 说 50 多台）。柱子是表 5 的数字，柱上的分数是我的还原。') +
        src('§4.3 · §5.3 · 表 5 · 代码 README') },
    { n: 11, part: '§5 结果', title: '表里的数', sub: '切换表 3、表 4 和图 6(b)，柱子都是原文数字', dur: 12, cam: [0, 1.25, 32, [0, 5.0, 0]],
      html: dl([['表 3 正手 SR', 'AMP 41.32，ASE 63.47，PULSE 71.85，Ours 96.52'], ['PPO、MotionVAE', '不收敛（N/A）'], ['表 4', '去修正伤成功率，去 LAB 伤平滑和力矩'], ['图 6(b)', '50 局自对打，平均 7.78 拍，最多 25']]) +
        '<p>表 3 的四列（正手、反手、前场、后场）对 AMP、ASE、PULSE 不可能是同一批试验的两种划分：比如 AMP 的正反手都 ≤ 41.32，前后场都 ≥ 41.73。论文没定义这些类别，详见精读页读者注 14。</p>' +
        '<p>表 4 里，去掉手腕修正掉 10.75 到 14.16 个点；去掉 LAB 只掉 1.62 到 5.14 个点，但力矩高很多。</p>' + src('§5.1 表 3 · §5.2 表 4 · 附录 A.2 图 6') }
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

  /* ---------- 3D helpers (same pattern as interactives/phc) ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.3, phi: 1.0, dist: 24, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  if (!S) { showInfo(0); return; }
  const root = new THREE.Group(); S.scene.add(root);
  let LABS = [], refDist = 24, PICKS = [];
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: o.size || 24, pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  /* a label whose text can change; returns set(text) */
  function dynLab(G, pos, o = {}) {
    const st = { s: null, t: null };
    return t => { if (t === st.t) return; if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; st.s = lab(t, pos, o); G.add(st.s); };
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BALL = new THREE.SphereGeometry(1, 12, 9);
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
  /* a polyline whose points can be reset each frame (n fixed) */
  function pline(G, n, color, o = {}) {
    const pos = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: o.opacity ?? 1 })); l.frustumCulled = false; l.renderOrder = o.order ?? 3; G.add(l);
    l.userData.set = pts => { const k = Math.max(1, Math.min(n, pts.length)); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)]; pos[i * 3] = q[0]; pos[i * 3 + 1] = q[1]; pos[i * 3 + 2] = q[2]; } g.attributes.position.needsUpdate = true; };
    return l;
  }
  /* a path drawn as instanced dots (readable at any angle) */
  function dots(G, n, color, r = 0.05) { const im = inst(BALL, n); im.material.color.setHex(color); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.4; G.add(im); im.userData.set = pts => { for (let i = 0; i < n; i++) { if (pts.length < 2) { setI(im, i, [0, -50, 0], 0.001); continue; } setI(im, i, along(pts, i / (n - 1)), r); } done(im); }; return im; }
  /* a flat ribbon facing +z (GL lines are one pixel wide) */
  function ribbon(G, n, color, w = 0.06, o = {}) {
    const pos = new Float32Array(n * 6), idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: o.opacity ?? 1 })); m.frustumCulled = false; m.renderOrder = o.order ?? 2; G.add(m);
    m.userData.set = pts => { const k = Math.min(n, pts.length); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)], z = q[2] ?? 0; pos[i * 6] = q[0]; pos[i * 6 + 1] = q[1] - w / 2; pos[i * 6 + 2] = z; pos[i * 6 + 3] = q[0]; pos[i * 6 + 4] = q[1] + w / 2; pos[i * 6 + 5] = z; } g.attributes.position.needsUpdate = true; };
    return m;
  }
  function panel(G, x, y, z, w, h) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x0c1220, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }
  /* flat rectangle outline on the floor (x along length, z along width) */
  function rectXZ(G, cx, cz, lx, lz, color, o = {}) { const y = o.y ?? 0.02, a = lx / 2, b = lz / 2; return wire(G, [[cx - a, y, cz - b], [cx + a, y, cz - b], [cx + a, y, cz + b], [cx - a, y, cz + b], [cx - a, y, cz - b]], color, o); }
  function floorRect(G, cx, cz, lx, lz, color, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(lx, lz), new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: o.opacity != null, opacity: o.opacity ?? 1, depthWrite: o.opacity == null })); m.rotation.x = -Math.PI / 2; m.position.set(cx, o.y ?? 0, cz); G.add(m); return m; }
  /* the 13 m x 6 m court read from Fig. 3 (x along the length, net at x = 0) */
  function court(G, o = {}) {
    const k = o.k ?? 1; floorRect(G, 0, 0, 16 * k, 9 * k, 0x1d5e36, { y: -0.01 }); floorRect(G, 0, 0, 13 * k, 6 * k, COL.court, { y: 0 });
    const W = (pts) => wire(G, pts.map(([x, z]) => [x * k, 0.02, z * k]), COL.line, { opacity: 0.85 });
    W([[-6.5, -3], [6.5, -3], [6.5, 3], [-6.5, 3], [-6.5, -3]]); W([[-6.5, -2.25], [6.5, -2.25]]); W([[-6.5, 2.25], [6.5, 2.25]]);
    W([[-3.5, -2.25], [-3.5, 2.25]]); W([[3.5, -2.25], [3.5, 2.25]]); W([[-3.5, 0], [3.5, 0]]);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(6.8 * k, 0.55 * k), new THREE.MeshStandardMaterial({ color: COL.net, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    net.rotation.y = Math.PI / 2; net.position.set(0, 0.275 * k, 0); G.add(net); return net;
  }

  /* ---------- the hand-made humanoid with a racket on the right hand ---------- */
  function robot(color, o = {}) {
    const m = L.mat(color, { opacity: o.opacity, roughness: 0.5, depthWrite: o.opacity == null || o.opacity > 0.6 });
    const G = new THREE.Group(), mesh = g => new THREE.Mesh(g, m);
    const limb = (len, r) => { const g = new THREE.Group(), c = mesh(new THREE.CylinderGeometry(r, r * 0.82, len, 8)); c.position.y = -len / 2; g.add(c); g.add(mesh(new THREE.SphereGeometry(r, 8, 6))); return g; };
    const pelvis = new THREE.Group(); G.add(pelvis);
    pelvis.add(mesh(new THREE.BoxGeometry(0.26, 0.1, 0.14)));
    const upper = new THREE.Group(); pelvis.add(upper);
    const tor = mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.36, 10)); tor.position.y = 0.2; upper.add(tor);
    const head = mesh(new THREE.SphereGeometry(0.085, 12, 9)); head.position.y = 0.48; upper.add(head);
    const legs = [-1, 1].map(s => { const th = limb(0.3, 0.05); th.position.set(s * 0.09, -0.04, 0); const sh = limb(0.3, 0.042); sh.position.y = -0.3; th.add(sh); const ft = mesh(new THREE.BoxGeometry(0.08, 0.035, 0.18)); ft.position.set(0, -0.31, 0.04); sh.add(ft); pelvis.add(th); return { th, sh }; });
    const arms = [-1, 1].map(s => { const up = limb(0.2, 0.034); up.rotation.order = 'YZX'; up.position.set(s * 0.18, 0.34, 0); const lo = limb(0.2, 0.028); lo.position.y = -0.2; up.add(lo); upper.add(up); return { up, lo, s }; });
    /* index 0 is the robot's right side (x < 0 when facing +z). The racket hangs from the right wrist. */
    const wristG = new THREE.Group(); wristG.position.y = -0.2; arms[0].lo.add(wristG);
    const rm = L.mat(o.racket ?? 0xf0963c, { opacity: o.opacity, roughness: 0.4 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.26, 6), rm); handle.position.y = -0.13; wristG.add(handle);
    const head2 = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 20), rm); head2.position.y = -0.38; head2.rotation.y = Math.PI / 2; wristG.add(head2);
    const strings = new THREE.Mesh(new THREE.CircleGeometry(0.115, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })); strings.position.y = -0.38; strings.rotation.y = Math.PI / 2; wristG.add(strings);
    G.userData.wrist = wristG; G.userData.head = head2;
    G.userData.set = q => {
      G.position.set(...q.p); pelvis.rotation.set(q.pitch || 0, q.yaw || 0, q.roll || 0, 'YXZ'); upper.rotation.y = q.twist || 0;
      legs[0].th.rotation.x = -q.hL; legs[1].th.rotation.x = -q.hR; legs[0].sh.rotation.x = q.kL; legs[1].sh.rotation.x = q.kR;
      legs[0].th.rotation.z = q.abL || 0; legs[1].th.rotation.z = -(q.abR || 0);
      arms[0].up.rotation.x = -q.sR; arms[1].up.rotation.x = -q.sL; arms[0].lo.rotation.x = -q.eR; arms[1].lo.rotation.x = -q.eL;
      arms[0].up.rotation.z = -(q.aR ?? 0.12); arms[1].up.rotation.z = (q.aL ?? 0.12); arms[0].up.rotation.y = q.yR || 0;
      wristG.rotation.set(q.wp || 0, q.wy || 0, q.wr || 0);
    };
    return G;
  }
  const STAND = 0.65, PI = Math.PI;
  /* hand-written poses; t in seconds; u in [0,1] is the phase of a stroke */
  function clip(name, t) {
    if (name === 'ready') { const b = 0.01 * Math.sin(2 * PI * t * 1.6); return { p: [0, STAND - 0.06 + b, 0], pitch: 0.12, hL: 0.45, hR: 0.45, kL: 0.8, kR: 0.8, abL: 0.18, abR: 0.18, sL: 0.5, sR: 0.6, eL: 1.0, eR: 0.9, aR: 0.25, twist: 0.1 }; }
    if (name === 'shuffle') { const ph = 2 * PI * t / 0.55, s = Math.sin(ph); return { p: [0, STAND - 0.07 + 0.03 * Math.abs(s), 0], pitch: 0.12, hL: 0.45, hR: 0.45, kL: 0.8, kR: 0.8, abL: 0.2 + 0.18 * s, abR: 0.2 - 0.18 * s, sL: 0.5, sR: 0.6, eL: 1.0, eR: 0.9, aR: 0.3, twist: 0.15 }; }
    if (name === 'run') { const ph = 2 * PI * t / 0.6, s = Math.sin(ph); return { p: [0, STAND - 0.03 + 0.03 * Math.cos(2 * ph), 0], pitch: 0.2, hL: 0.7 * s, hR: -0.7 * s, kL: 0.3 + 0.8 * Math.max(0, -Math.cos(ph + 0.6)), kR: 0.3 + 0.8 * Math.max(0, Math.cos(ph + 0.6)), sL: -0.6 * s, sR: 0.6 * s, eL: 1.1, eR: 1.1, aR: 0.2 }; }
    if (name === 'fore' || name === 'back') {
      const u = ((t % 1.4) + 1.4) % 1.4 / 1.4, back = seg(u, 0.05, 0.45), swing = seg(u, 0.5, 0.72), rec = seg(u, 0.82, 1.0), f = name === 'fore' ? 1 : -1;
      const tw = f * (0.9 * back - 1.9 * swing) * (1 - rec) + 0.1 * rec;
      const ab = name === 'fore' ? 1.0 + 0.3 * back : 0.4 - 0.5 * back + 1.3 * swing;
      return { p: [0, STAND - 0.1 + 0.04 * rec, 0], pitch: 0.14, twist: tw, hL: 0.5, hR: 0.5, kL: 0.95 - 0.2 * swing, kR: 0.95, abL: 0.25, abR: 0.25, sL: 0.6, sR: name === 'fore' ? 0.3 + 0.9 * swing : 1.0 + 0.4 * back - 0.5 * swing, eL: 0.9, eR: 0.4, aR: ab * (1 - rec) + 0.25 * rec, yR: f * 0.4 * (1 - rec) };
    }
    return clip('ready', t);
  }
  function pose(r, q, at, sc, yaw) { const c = { ...q, yaw: yaw ?? q.yaw, p: [0, 0, 0] }; r.userData.set(c); r.position.set(at[0] + q.p[0] * sc, at[1] + q.p[1] * sc, at[2] + q.p[2] * sc); r.scale.setScalar(sc); }

  /* ---------- toy problems, all computed on load ---------- */
  /* scene 4: DAgger vs BC on a 1-D tracking error */
  const DAG = (function () {
    const r = L.rng(7), C = Array.from({ length: 9 }, (_, i) => -2 + i * 0.5), W = 0.35, dt = 0.1, bias = 0.6;
    const teacher = e => -bias - 2 * Math.sin(1.5 * clamp(e, -1.0, 1.0)) - 1.2 * Math.max(0, Math.abs(e) - 1.0) * Math.sign(e);
    const feat = e => C.map(c => Math.exp(-((e - c) ** 2) / (2 * W * W)));
    function fit(X, Y) { const n = C.length, A = Array.from({ length: n }, () => new Array(n).fill(0)), b = new Array(n).fill(0);
      X.forEach((e, k) => { const f = feat(e); for (let i = 0; i < n; i++) { b[i] += f[i] * Y[k]; for (let j = 0; j < n; j++) A[i][j] += f[i] * f[j]; } });
      for (let i = 0; i < n; i++) A[i][i] += 0.05;
      for (let i = 0; i < n; i++) { let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k; [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
        for (let k = i + 1; k < n; k++) { const f = A[k][i] / A[i][i]; for (let j = i; j < n; j++) A[k][j] -= f * A[i][j]; b[k] -= f * b[i]; } }
      const w = new Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let j = i + 1; j < n; j++) s -= A[i][j] * w[j]; w[i] = s / A[i][i]; } return w; }
    const pol = w => e => feat(e).reduce((s, f, i) => s + f * w[i], 0);
    function roll(pi, e0, T, rr, noise = 0.12) { const xs = []; let e = e0; for (let t = 0; t < T; t++) { xs.push(e); e = clamp(e + dt * (pi(e) + bias) + noise * L.gauss(rr), -2.2, 2.2); } return xs; }
    const starts = Array.from({ length: 40 }, () => (r() * 2 - 1) * 1.2);
    function evalPol(pi) { const rr = L.rng(99); let s = 0, n = 0; starts.forEach(e0 => roll(pi, e0, 40, rr).forEach(e => { s += Math.abs(e); n++; })); return s / n; }
    /* BC: teacher rollouts from near zero */
    const rb = L.rng(3), Xb = [], Yb = []; for (let k = 0; k < 12; k++) roll(teacher, 0.15 * L.gauss(rb), 40, rb, 0.04).forEach(e => { Xb.push(e); Yb.push(teacher(e)); });
    const wBC = fit(Xb, Yb), bc = { w: wBC, err: evalPol(pol(wBC)), X: Xb.slice() };
    const it = [{ w: wBC, err: bc.err, X: Xb.slice() }]; let X = Xb.slice(), Y = Yb.slice(), w = wBC; const rd = L.rng(5);
    for (let k = 0; k < 5; k++) { const pi = pol(w); for (let j = 0; j < 12; j++) roll(pi, (rd() * 2 - 1) * 1.2, 40, rd).forEach(e => { X.push(e); Y.push(teacher(e)); }); w = fit(X, Y); it.push({ w, err: evalPol(pol(w)), X: X.slice() }); }
    return { teacher, pol, bc, it, teachErr: evalPol(teacher), C };
  })();
  /* scene 6: ball flights, integrated with drag at 1 ms */
  function flight(p0, v0, k, e = 0.75, T = 2.2) {
    const pts = []; let p = p0.slice(), v = v0.slice(), bounced = null, dt = 0.001;
    for (let i = 0; i <= T / dt; i++) {
      if (i % 10 === 0) pts.push(p.slice());
      const sp = Math.hypot(v[0], v[1], v[2]); v[0] -= k * sp * v[0] * dt; v[1] -= (9.81 + k * sp * v[1]) * dt; v[2] -= k * sp * v[2] * dt;
      p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt;
      if (p[1] < 0.0335 && v[1] < 0) { if (!bounced) bounced = { x: p[0], z: p[2], t: i * dt }; p[1] = 0.0335; v[1] = -e * v[1]; }
    }
    return { pts, bounced };
  }
  const SERVES = (function () { const r = L.rng(21), out = []; for (let i = 0; i < 8; i++) { const s = [4.6 + r() * 2.6, 0.9 + r() * 0.6, -2.4 + r() * 4.8], l = [-5.3 + r() * 3.3, 0, -2.6 + r() * 5.2], T = 0.95 + r() * 0.25;
    const v = [(l[0] - s[0]) / T, (0.0335 - s[1] + 0.5 * 9.81 * T * T) / T, (l[2] - s[2]) / T]; out.push({ s, l, v, T }); } return out; })();
  const KS = [0, 0.02, 0.04];
  const FL = KS.map(k => SERVES.map(b => flight(b.s, b.v, k)));
  /* scene 8: latent samples */
  const LATS = (function () { const r = L.rng(42), a = []; for (let i = 0; i < 360; i++) a.push([0.9 + 1.1 * L.gauss(r), 0.7 + 1.1 * L.gauss(r)]); return a; })();
  /* scene 9: a ball track at 50 Hz with fixed noise draws */
  const BTR = (function () { const f = flight([6, 1.0, -1], [-9, 6.5, 1.0], 0.02, 0.75, 1.8); const dt = 0.02, raw = [], tb = f.bounced ? f.bounced.t : 1.8; for (let i = 0; i < f.pts.length && i * 0.01 < tb - 0.02; i += 2) raw.push(f.pts[i]); const r = L.rng(17), nz = raw.map(() => [L.gauss(r), L.gauss(r), L.gauss(r)]); return { raw, nz, dt }; })();
  /* scene 3: the code's wrist-target schedule, fixed seed */
  const WSCH = (function () { const r = L.rng(11), out = []; let t = 0; while (t < 14) { out.push({ t, g: [-1 + 2 * r(), -1 + 2 * r(), -1 + 2 * r()] }); t += 0.5 + 1.5 * r(); } return out; })();

  function buildCtl() {
    const box = $('ctl'); box.innerHTML = ''; box.hidden = true; if (!api) return;
    (api.ctls || []).forEach((c, gi) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-g="${gi}" data-k="${k}" aria-pressed="${c.get() === k}">${t}</button>`).join('');
      box.appendChild(row); box.hidden = false;
    });
  }
  function syncCtl() { (api?.ctls || []).forEach((c, gi) => { $('ctl').querySelectorAll(`button[data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(c.get() === +b.dataset.k))); }); }

  /* ---------- scene 1: the four panels of Fig. 2 ---------- */
  function s1(G) {
    const P = [['(a) 跟踪器预训练', -10.5, COL.track, 2], ['(b) 在线蒸馏', -3.5, COL.distil, 3], ['(c) 高层策略', 3.5, COL.high, 5], ['(d) 仿真到真机', 10.5, COL.real, 8]];
    const B = P.map(([t, x, c, go]) => { const b = block(5.6, 0.35, 4.2, c, [x, 0.18, 0], { opacity: 0.85 }); b.userData.go = go; PICKS.push(b); G.add(b, lab(t, [x, 6.4, -1.6], { size: 23, color: css(c) })); return b; });
    const data = block(1.6, 1.0, 1.0, 0x9aa6bf, [-14.6, 0.85, 1.4]); data.userData.go = 1; PICKS.push(data); G.add(data, lab('5 h 片段', [-14.6, 2.0, 1.4], { size: 19 }));
    const trk = block(2.2, 1.0, 1.2, COL.track, [-10.5, 0.85, 0.9]); const enc = block(1.6, 0.9, 1.0, COL.post, [-4.6, 0.8, 0.9]), pri = block(1.2, 0.9, 1.0, COL.prior, [-2.6, 0.8, -0.9]), dec = block(1.6, 0.9, 1.0, 0x6fb8a0, [-4.0, 0.8, -0.9]);
    const hl = block(2.0, 1.0, 1.2, COL.high, [2.6, 0.85, 0.9]), labB = block(1.0, 1.0, 1.0, 0xffffff, [4.6, 0.85, -0.6], { opacity: 0.6 }), dec2 = block(1.6, 0.9, 1.0, 0x6fb8a0, [3.0, 0.8, -1.2], { opacity: 0.55 });
    G.add(trk, enc, pri, dec, hl, labB, dec2);
    [[trk, 2], [enc, 3], [pri, 4], [dec, 3], [hl, 5], [labB, 7], [dec2, 7]].forEach(([m, g]) => { m.userData.go = g; PICKS.push(m); });
    G.add(lab('π_tracker', [-10.5, 1.95, 0.9], { size: 19 }), lab('ℰ', [-4.6, 1.8, 0.9], { size: 19 }), lab('𝒫', [-2.6, 1.8, -0.9], { size: 19 }), lab('𝒟', [-4.0, 1.8, -0.9], { size: 19 }));
    G.add(lab('π_planner（可学）', [2.6, 1.95, 0.9], { size: 18 }), lab('LAB', [4.6, 1.95, -0.6], { size: 18 }), lab('𝒫 + 𝒟 冻结', [3.0, 1.8, -1.9], { size: 17 }));
    const rob = robot(COL.robot); G.add(rob); const ball = new THREE.Mesh(BALL, L.mat(COL.ball, { emissive: 0x444400 })); ball.scale.setScalar(0.09); G.add(ball);
    const dr = ['质量', '摩擦', '质心', '阻力', '恢复', '噪声'].map((t, i) => { const b = block(0.9, 0.5, 0.9, COL.real, [8.9 + (i % 3) * 1.6, 0.6, -1.0 + Math.floor(i / 3) * 1.6], { opacity: 0.8 }); b.userData.go = i < 5 ? 8 : 8; PICKS.push(b); G.add(b, lab(t, [8.9 + (i % 3) * 1.6, 1.25, -1.0 + Math.floor(i / 3) * 1.6], { size: 15 })); return b; });
    const f = { a: stream(G, 6, COL.track), b: stream(G, 6, COL.distil), c: stream(G, 6, COL.high), d: stream(G, 5, COL.real) };
    return { update(p) {
      const q = (p * 18) % 1, st = Math.min(3, Math.floor(p * 4));
      B.forEach((b, i) => glow(b, i === st ? 0.7 : 0.05));
      f.a([[-14.6, 1.0, 1.4], [-10.5, 1.0, 0.9]], q, st >= 0 ? 1 : 0); f.b([[-10.5, 1.0, 0.9], [-4.6, 1.0, 0.9], [-4.0, 1.0, -0.9]], q, st >= 1 ? 1 : 0);
      f.c([[-2.6, 1.0, -0.9], [3.0, 1.0, -1.2], [2.6, 1.0, 0.9]], q, st >= 2 ? 1 : 0); f.d([[10.5, 1.0, 0], [5.8, 1.0, 0.9]], q, st >= 3 ? 1 : 0);
      const tt = p * 14; pose(rob, clip('fore', tt), [3.5, 2.9, -0.2], 2.2, Math.PI / 2);
      const u = (tt % 1.4) / 1.4, bx = u < 0.6 ? L.lerp(9, 4.3, u / 0.6) : L.lerp(4.3, 10, (u - 0.6) / 0.4); ball.position.set(bx, 4.2 + 0.8 * Math.sin(PI * u), 0.4);
      cap(['(a) 先训练跟踪器模仿 5 小时网球片段，<b>右手腕不归它管</b>', '(b) DAgger 在线蒸馏：后验 ℰ、条件先验 𝒫、解码器 𝒟', '(c) 冻结 𝒫、𝒟，PPO 训练高层：<b>潜动作过 LAB</b>，手腕直控', '(d) 机器人和球都随机化、加观测噪声，部署到 G1'][st]);
    } };
  }

  /* ---------- scene 2: sizes ---------- */
  function s2(G) {
    let hi = +(OPT[0] ?? 4);
    floorRect(G, 0, 0, 30, 20, 0x10172a, { y: -0.03 });
    const R = [['标准场 23.77 × 10.97', 23.77, 10.97, 0xeef2fa, 0], ['真机动捕 19 × 15（README）', 19, 15, 0x7cb8ff, 0], ['仿真场 13 × 6（图 3）', 13, 6, COL.court, 0], ['采集区 3 × 5', 5, 3, 0xff7a59, -4.5]];
    const fills = R.map(([t, a, b, c, x], i) => { const f = floorRect(G, x, 0, a, b, c, { opacity: 0.18, y: 0.005 * i }); rectXZ(G, x, 0, a, b, c, { opacity: 0.95, y: 0.03 + 0.005 * i }); return f; });
    const tl = R.map(([t, a, b, c, x], i) => { const s = lab(t, [x + (i === 3 ? 0 : a / 2 - 3.2), 0.6, (i === 3 ? 0 : -b / 2 - 0.8)], { size: 25, color: css(c) }); G.add(s); return s; });
    const net = wire(G, [[0, 0.04, -3], [0, 0.04, 3]], COL.white, { opacity: 0.8 });
    const area = R.map(r => r[1] * r[2]);
    const ctls = [{ label: '突出', items: ['标准场', '真机动捕', '仿真场', '采集区', '全部'], get: () => hi, set: k => { hi = k; } }];
    const MSG = [`标准双打场 ${area[0].toFixed(1)} m² = 采集区的 <b>${(area[0] / area[3]).toFixed(1)}</b> 倍（论文：“17 倍以上”）`,
      `真机动捕 ${area[1]} m²，长 19 m，<b>放不下 23.77 m 的标准场</b>；是采集区的 ${(area[1] / area[3]).toFixed(0)} 倍`,
      `仿真场 13 × 6 = ${area[2]} m²，每个尺寸都是标准场的 <b>${(13 / 23.77).toFixed(3)}</b> 倍；只是采集区的 ${(area[2] / area[3]).toFixed(1)} 倍`,
      `采集区 3 × 5 = ${area[3]} m²：只采片段，不采比赛`, '四块场地同一比例尺。白色竖线是仿真场的网'];
    return { ctls, update(p) {
      const g = seg(p, 0, 0.35);
      fills.forEach((f, i) => { const on = hi === 4 || hi === i; f.material.opacity = (on ? 0.32 : 0.06) * g + 0.02; tl[i].material.opacity = on ? 1 : 0.35; });
      cap(MSG[hi]);
    } };
  }

  /* ---------- scene 3: tracker and the wrist disturbance ---------- */
  function s3(G) {
    let mode = +(OPT[0] ?? 0);
    floorRect(G, -2.3, 0, 4.4, 4, COL.court, { y: 0 });
    const rob = robot(COL.track), ref = robot(COL.ref, { opacity: 0.35, racket: COL.ref }); G.add(rob, ref);
    const XP = 0.6, WP = 6.6, YP = 0.6, HP = 2.6, N = 140; panel(G, XP - 0.2, YP - 0.3, -1.6, WP + 0.4, HP + 0.6);
    const rb = [0xf0963c, 0x9d8cff, 0x38d1ff].map(c => ribbon(G, N, c, 0.05, { order: 3 }));
    G.add(lab('右手腕 roll / pitch / yaw 的 PD 目标', [XP + WP / 2, YP + HP + 0.55, -1.6], { size: 20 }));
    const dims = dynLab(G, [-2.3, 3.6, 0], { size: 20 });
    const ctls = [{ label: '跟踪器', items: ['代码：排除右手腕', '全身跟踪（w/o Corr.）'], get: () => mode, set: k => { mode = k; } }];
    const wAt = t => { let g = WSCH[0].g; for (const w of WSCH) if (w.t <= t) g = w.g; return g; };
    return { ctls, update(p) {
      const T = p * 14, q = clip(Math.floor(T / 2.8) % 2 ? 'back' : 'fore', T);
      const g = mode === 0 ? wAt(T) : [0.25 * Math.sin(T * 4.5), 0.2 * Math.sin(T * 4.5 + 1), 0.15 * Math.sin(T * 4.5 + 2)];
      pose(rob, { ...q, wr: g[0], wp: g[1], wy: g[2] }, [-2.2, 0, 0.3], 2.6, 0.4); pose(ref, { ...q, wr: 0.25 * Math.sin(T * 4.5), wp: 0.2 * Math.sin(T * 4.5 + 1), wy: 0.15 * Math.sin(T * 4.5 + 2) }, [-2.5, 0, 0], 2.6, 0.4);
      for (let c = 0; c < 3; c++) { const pts = []; for (let i = 0; i < N; i++) { const tt = Math.min(T, 14 * i / (N - 1)); const gg = mode === 0 ? wAt(tt)[c] : [0.25 * Math.sin(tt * 4.5), 0.2 * Math.sin(tt * 4.5 + 1), 0.15 * Math.sin(tt * 4.5 + 2)][c]; pts.push([XP + WP * Math.min(tt, T) / 14, YP + HP / 2 + gg * HP * 0.42 + (c - 1) * 0.04, -1.55]); } rb[c].userData.set(pts); }
      dims(mode === 0 ? '跟踪器动作 26 维（29 − 3）' : '跟踪器动作 29 维');
      const nxt = WSCH.find(w => w.t > T);
      cap(mode === 0 ? `手腕目标每 0.5–2 s 在全行程内重抽；下一次在 <b>${nxt ? nxt.t.toFixed(2) : '—'} s</b>。跟踪器要在这种扰动下跟住其余 26 个关节` : '全身跟踪：手腕也跟着参考走。参考里的手腕本来就不准，之后高层<b>无法修正</b>（表 4：正手 96.52 → 82.36%）');
    } };
  }

  /* ---------- scene 4: DAgger vs BC ---------- */
  function s4(G) {
    let mode = +(OPT[0] ?? 1);
    const XP = -8, WP = 16, YP = 0.6, HP = 6.2, E = 2.2, A = 3.4; panel(G, XP - 0.3, YP - 0.3, -0.2, WP + 0.6, HP + 0.6);
    const px = e => XP + WP * (e + E) / (2 * E), py = a => YP + HP / 2 + a * HP / (2 * A);
    wire(G, [[px(-E), py(0), 0], [px(E), py(0), 0]], COL.dim, { opacity: 0.6 }); wire(G, [[px(0), YP, 0], [px(0), YP + HP, 0]], COL.dim, { opacity: 0.6 });
    const NP = 120, tr = ribbon(G, NP, COL.white, 0.05, { order: 2 }), st = ribbon(G, NP, COL.distil, 0.09, { order: 3 });
    tr.userData.set(Array.from({ length: NP }, (_, i) => { const e = -E + 2 * E * i / (NP - 1); return [px(e), py(clamp(DAG.teacher(e), -A, A)), 0.03]; }));
    const pts = inst(BALL, 1400); pts.material.color.setHex(COL.wrist); pts.material.emissive.setHex(0x442200); G.add(pts);
    G.add(lab('横轴：跟踪误差 e（−2.2 到 2.2）  纵轴：动作 a', [0, YP + HP + 0.45, 0], { size: 19 }), lab('白：老师 a*(e)', [XP + 2.2, YP + HP - 0.4, 0.1], { size: 18 }), lab('绿：学生', [XP + 2.0, YP + HP - 1.2, 0.1], { size: 18, color: '#4fc98a' }), lab('橙点：缓存里的状态', [XP + 3.0, YP + HP - 2.0, 0.1], { size: 18, color: '#f0963c' }));
    const ctls = [{ label: '训练方式', items: ['BC（只看老师的状态）', 'DAgger（5 轮聚合）'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const k = mode === 0 ? 0 : Math.min(5, Math.floor(p * 6)), d = DAG.it[k], pol = DAG.pol(d.w);
      st.userData.set(Array.from({ length: NP }, (_, i) => { const e = -E + 2 * E * i / (NP - 1); return [px(e), py(clamp(pol(e), -A, A)), 0.06]; }));
      const X = d.X, n = Math.min(1400, X.length); for (let i = 0; i < 1400; i++) { if (i < n) { const j = Math.floor(i * X.length / n), e = X[j]; setI(pts, i, [px(clamp(e, -E, E)), YP + 0.15 + 0.12 * ((j * 7919) % 13), 0.08], 0.05); } else setI(pts, i, [0, -50, 0], 0.001); } done(pts);
      cap(mode === 0 ? `BC：缓存只有老师走过的 e ≈ 0 附近；学生到别处就乱猜。测试平均 |e| = <b>${d.err.toFixed(3)}</b>（老师 ${DAG.teachErr.toFixed(3)}）` : `DAgger 第 <b>${k}</b> 轮：缓存 ${X.length} 个状态，测试平均 |e| = <b>${d.err.toFixed(3)}</b>（BC ${DAG.bc.err.toFixed(3)}，老师 ${DAG.teachErr.toFixed(3)}）`);
    } };
  }

  /* ---------- scene 5: conditional prior and KL ---------- */
  function s5(G) {
    let mode = +(OPT[0] ?? 1);
    floorRect(G, 0, 0, 12, 8, 0x0f1626, { y: 0 });
    const sc = 1.6, at = (x, z) => [x * sc, 0.03, z * sc];
    for (let i = -3; i <= 3; i++) { wire(G, [at(i, -2.4), at(i, 2.4)], COL.dim, { opacity: 0.25 }); }
    for (let j = -2; j <= 2; j++) { wire(G, [at(-3.6, j), at(3.6, j)], COL.dim, { opacity: 0.25 }); }
    const ell = (color, w = 0.04) => { const n = 64, l = pline(G, n + 1, color); l.userData.ell = (mx, mz, sx, sz, k = 1) => l.userData.set(Array.from({ length: n + 1 }, (_, i) => { const a = 2 * PI * i / n; return [(mx + k * sx * Math.cos(a)) * sc, 0.06, (mz + k * sz * Math.sin(a)) * sc]; })); return l; };
    const pr1 = ell(COL.prior), pr2 = ell(COL.prior), po = ell(COL.post), pr1b = ell(COL.prior), pr2b = ell(COL.prior);
    const dot = new THREE.Mesh(BALL, L.mat(COL.post)); dot.scale.setScalar(0.12); G.add(dot);
    const ST = [{ n: '侧滑步', m: [-1.6, 0.5], s: [0.9, 0.35] }, { n: '挥拍', m: [1.5, -0.6], s: [0.35, 0.8] }];
    const l1 = lab('先验 𝒫(z | 侧滑步)', at(-1.6, 1.55), { size: 18, color: '#7cb8ff' }), l2 = lab('先验 𝒫(z | 挥拍)', at(1.5, 1.2), { size: 18, color: '#7cb8ff' }); G.add(l1, l2);
    const l0 = lab('固定先验 N(0, I)', at(0, -1.6), { size: 18, color: '#7cb8ff' }); G.add(l0);
    const kl = (m1, s1, m2, s2) => { let k = 0; for (let i = 0; i < 2; i++) k += Math.log(s2[i] / s1[i]) + (s1[i] ** 2 + (m1[i] - m2[i]) ** 2) / (2 * s2[i] ** 2) - 0.5; return k; };
    const ctls = [{ label: '先验', items: ['固定 N(0, I)', '条件先验 𝒫(z | s)'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const which = p < 0.5 ? 0 : 1, u = (p % 0.5) / 0.5, S0 = ST[which];
      const mq = [S0.m[0] + 0.4 * Math.cos(2 * PI * u), S0.m[1] + 0.3 * Math.sin(2 * PI * u)], sq = [S0.s[0] * 0.6, S0.s[1] * 0.6];
      po.userData.ell(mq[0], mq[1], sq[0], sq[1]); dot.position.set(...at(mq[0], mq[1])); dot.position.y = 0.1;
      if (mode === 1) { pr1.visible = pr2.visible = pr1b.visible = pr2b.visible = l1.visible = l2.visible = true; pr1.userData.ell(...ST[0].m, ...ST[0].s); pr1b.userData.ell(...ST[0].m, ...ST[0].s, 2); pr2.userData.ell(...ST[1].m, ...ST[1].s); pr2b.userData.ell(...ST[1].m, ...ST[1].s, 2); l0.visible = false; pr1.material.opacity = which === 0 ? 1 : 0.3; pr2.material.opacity = which === 1 ? 1 : 0.3; }
      else { pr1.visible = true; pr1.userData.ell(0, 0, 1, 1); pr1b.visible = true; pr1b.userData.ell(0, 0, 1, 1, 2); pr2.visible = pr2b.visible = l1.visible = l2.visible = false; l0.visible = true; pr1.material.opacity = 1; }
      const k = mode === 1 ? kl(mq, sq, S0.m, S0.s) : kl(mq, sq, [0, 0], [1, 1]), kAlt = mode === 1 ? kl(mq, sq, [0, 0], [1, 1]) : kl(mq, sq, S0.m, S0.s);
      cap(`状态：<b>${S0.n}</b> · 绿 = 后验 ℰ · 当前 KL = <b>${k.toFixed(2)}</b>（换成${mode === 1 ? '固定 N(0, I)' : '条件先验'}是 ${kAlt.toFixed(2)}）`);
    } };
  }

  /* ---------- scene 6: the task, with live ball flights ---------- */
  function s6(G) {
    let ki = +(OPT[0] ?? 1);
    court(G);
    const rob = robot(COL.robot); G.add(rob);
    const ball = new THREE.Mesh(BALL, L.mat(COL.ball, { emissive: 0x555500 })); ball.scale.setScalar(0.1); G.add(ball);
    const path = dots(G, 70, COL.ball, 0.04), ret = dots(G, 40, COL.ok, 0.045);
    const marks = inst(BALL, 8); marks.material.color.setHex(COL.bad); G.add(marks);
    const tgt = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.5, 48), new THREE.MeshBasicMaterial({ color: COL.ok, transparent: true, opacity: 0.5, side: THREE.DoubleSide })); tgt.rotation.x = -PI / 2; tgt.position.set(4.0, 0.03, 0.5); G.add(tgt);
    G.add(lab('目标 ± 2.5 m', [4.0, 0.4, 3.3], { size: 18, color: '#4fc98a' }), lab('13 m × 6 m', [-6.5, 0.3, -3.6], { size: 18 }));
    const ctls = [{ label: '空气阻力 k', items: ['0', '0.02（≈ 真实网球）', '0.04（上限）'], get: () => ki, set: k => { ki = k; } }];
    return { ctls, update(p) {
      const T = p * 16, bi = Math.min(7, Math.floor(T / 2)), tb = T - 2 * bi, F = FL[ki][bi], b = SERVES[bi], hit = F.bounced ? F.bounced.t + 0.32 : 1.4;
      const iA = Math.min(F.pts.length - 1, Math.floor(Math.min(tb, hit) * 100)); path.userData.set(F.pts.slice(0, iA + 1).map(q => [q[0], q[1], q[2]]));
      let bp = F.pts[iA];
      const hitP = F.pts[Math.min(F.pts.length - 1, Math.floor(hit * 100))];
      if (tb > hit) { const u = clamp((tb - hit) / 0.85, 0, 1), a = hitP, c = [4.0, 0.03, 0.5]; bp = [L.lerp(a[0], c[0], u), a[1] + (2.6 - a[1]) * Math.sin(PI * u) * (1 - u * 0.2) * (u < 1 ? 1 : 0), L.lerp(a[2], c[2], u)];
        ret.visible = true; ret.userData.set(Array.from({ length: 60 }, (_, i) => { const w = u * i / 59; return [L.lerp(a[0], c[0], w), a[1] + (2.6 - a[1]) * Math.sin(PI * w), L.lerp(a[2], c[2], w)]; })); } else ret.visible = false;
      ball.position.set(...bp);
      for (let i = 0; i < 8; i++) { const f = FL[ki][i]; setI(marks, i, f.bounced && i <= bi ? [f.bounced.x, 0.04, f.bounced.z] : [0, -50, 0], 0.09); } done(marks);
      const goal = [hitP[0] - 0.5, 0, hitP[2] + 0.6], u2 = clamp(tb / Math.max(0.4, hit - 0.25), 0, 1), prev = bi > 0 ? (() => { const h = FL[ki][bi - 1]; const hh = h.pts[Math.min(h.pts.length - 1, Math.floor((h.bounced ? h.bounced.t + 0.32 : 1.4) * 100))]; return [hh[0] - 0.5, 0, hh[2] + 0.6]; })() : [-5.2, 0, 0];
      const at = [L.lerp(prev[0], goal[0], L.ease(u2)), 0, L.lerp(prev[2], goal[2], L.ease(u2))], moving = u2 < 1 && Math.hypot(goal[0] - prev[0], goal[2] - prev[2]) > 0.3;
      const q = tb > hit - 0.55 && tb < hit + 0.5 ? clip('fore', 0.6 * 1.4 + (tb - hit) * 1.2) : clip(moving ? 'shuffle' : 'ready', T);
      pose(rob, q, at, 1.0, PI / 2);
      const d = F.bounced, d0 = FL[0][bi].bounced;
      cap(`第 <b>${bi + 1}</b> / 8 球 · 设计落点 x = ${b.l[0].toFixed(2)} m · k = ${KS[ki]} 时实际落在 x = <b>${d ? d.x.toFixed(2) : '—'}</b> m（无阻力 ${d0 ? d0.x.toFixed(2) : '—'}）`);
    } };
  }

  /* ---------- scene 7: wrist correction ---------- */
  function s7(G) {
    let di = +(OPT[0] ?? 1); const DEG = [0, 5, 10, 15];
    court(G, { k: 1 });
    const rob = robot(COL.robot); G.add(rob);
    const ret = dots(G, 50, COL.ok, 0.06), aim = pline(G, 2, COL.white, { opacity: 0.7 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.5, 48), new THREE.MeshBasicMaterial({ color: COL.bad, transparent: true, opacity: 0.6, side: THREE.DoubleSide })); ring.rotation.x = -PI / 2; ring.position.set(3.8, 0.03, 0); G.add(ring);
    G.add(lab('a_latent → LAB → 𝒟（全身）', [-4.6, 2.6, -2.2], { size: 20, color: '#f2c14e' }), lab('a_correct → 右手腕（直接）', [-4.6, 2.0, 1.8], { size: 20, color: '#f0963c' }), lab('瞄准方向', [2.0, 0.3, -0.9], { size: 18 }));
    const ctls = [{ label: '拍面偏差 δ', items: DEG.map(d => d + '°'), get: () => di, set: k => { di = k; } }];
    return { ctls, update(p) {
      const d = DEG[di] * PI / 180, hp = [-4.2, 1.0, -0.6], D = 8.0, land = [hp[0] + D * Math.cos(d), 0.03, -0.6 + D * Math.sin(d)];
      const u = seg(p, 0.35, 0.85); ret.userData.set(Array.from({ length: 60 }, (_, i) => { const w = u * i / 59; return [L.lerp(hp[0], land[0], w), hp[1] + 2.2 * Math.sin(PI * w) - 0.97 * w, L.lerp(hp[2], land[2], w)]; }));
      aim.userData.set([[hp[0], 0.06, -0.6], [hp[0] + D, 0.06, -0.6]]); ring.position.set(hp[0] + D, 0.03, -0.6);
      pose(rob, { ...clip('fore', 0.35 * 1.4 + p * 0.9), wy: -d * 2 }, [-4.6, 0, -0.1], 1.0, PI / 2);
      const miss = D * Math.tan(d);
      cap(`拍面偏 <b>${DEG[di]}°</b> → 飞 8 m 后横向偏 <b>${miss.toFixed(2)} m</b>（成功半径 2.5 m）${miss > 2.5 ? ' · <b>失败</b>' : ''}。表 4 去掉修正：正手 SR 96.52 → 82.36%，DE 1.32 → 3.41 m`);
    } };
  }

  /* ---------- scene 8: the latent action barrier ---------- */
  function s8(G) {
    let mode = +(OPT[0] ?? 2), li = +(OPT[1] ?? 1), si = +(OPT[2] ?? 0); const LAM = [1, 2, 3];
    const ST = [{ n: '侧滑步', m: [0, 0], s: [1.1, 0.3] }, { n: '挥拍', m: [0, 0], s: [0.35, 1.0] }];
    const sc = 1.15, at = (x, z, y = 0.04) => [x * sc, y, z * sc];
    floorRect(G, 0, 0, 13, 9.5, 0x0f1626, { y: 0 });
    for (let i = -5; i <= 5; i++) wire(G, [at(i, -3.8), at(i, 3.8)], COL.dim, { opacity: 0.18 });
    for (let j = -3; j <= 3; j++) wire(G, [at(-5.4, j), at(5.4, j)], COL.dim, { opacity: 0.18 });
    /* the skill manifold as stacked translucent ellipses (Mahalanobis 1, 2) */
    const man = [1, 2].map((k, i) => { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0x4fc98a, transparent: true, opacity: i ? 0.12 : 0.22, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -PI / 2; m.position.y = 0.01 + 0.005 * i; G.add(m); m.userData.k = k; return m; });
    const box = pline(G, 5, COL.high), circ = pline(G, 65, COL.white, { opacity: 0.8 });
    const pts = inst(BALL, LATS.length); G.add(pts);
    const mu = new THREE.Mesh(BALL, L.mat(COL.prior)); mu.scale.setScalar(0.12); mu.position.set(0, 0.12, 0); G.add(mu);
    G.add(lab('μᵖ', at(0.3, -0.35, 0.5), { size: 22, color: '#7cb8ff' }), lab('绿点：落在流形内（马氏距离 ≤ 2）  红点：流形外', at(0, 2.6, 0.3), { size: 22 }));
    const ctls = [{ label: '约束', items: ['无约束残差', '欧氏球 λ', 'LAB：λσᵖ·tanh'], get: () => mode, set: k => { mode = k; } }, { label: 'λ', items: ['1', '2', '3'], get: () => li, set: k => { li = k; } }, { label: '状态', items: ['侧滑步', '挥拍'], get: () => si, set: k => { si = k; } }];
    return { ctls, update(p) {
      const S0 = ST[si], lam = LAM[li], g = seg(p, 0.05, 0.6);
      man.forEach(m => { m.scale.set(S0.s[0] * m.userData.k * sc, S0.s[1] * m.userData.k * sc, 1); });
      const bx = lam * S0.s[0], bz = lam * S0.s[1];
      box.visible = mode === 2; box.userData.set([at(-bx, -bz, 0.06), at(bx, -bz, 0.06), at(bx, bz, 0.06), at(-bx, bz, 0.06), at(-bx, -bz, 0.06)]);
      circ.visible = mode === 1; circ.userData.set(Array.from({ length: 65 }, (_, i) => { const a = 2 * PI * i / 64; return at(lam * Math.cos(a), lam * Math.sin(a), 0.06); }));
      let inside = 0;
      LATS.forEach((a, i) => {
        let z; if (mode === 0) z = [a[0] * 1.6, a[1] * 1.6]; else if (mode === 1) { const r = Math.hypot(a[0], a[1]) || 1e-6, t = Math.tanh(r) * lam; z = [a[0] / r * t, a[1] / r * t]; } else z = [lam * S0.s[0] * Math.tanh(a[0]), lam * S0.s[1] * Math.tanh(a[1])];
        const md = Math.hypot(z[0] / S0.s[0], z[1] / S0.s[1]), ok = md <= 2; if (ok) inside++;
        setI(pts, i, at(z[0] * g, z[1] * g, 0.09), 0.055); colI(pts, i, ok ? hex3(COL.ok) : hex3(COL.bad));
      }); done(pts);
      const frac = 100 * inside / LATS.length;
      cap(`状态：${S0.n}（σᵖ = ${S0.s[0]}, ${S0.s[1]}）· ${['无约束残差 z = μᵖ + a', `欧氏球，半径 ${lam}`, `LAB 盒子 ±${lam}σᵖ，角落马氏距离 ${(lam * Math.SQRT2).toFixed(2)}`][mode]} · 落在流形里 <b>${frac.toFixed(0)}%</b>`);
    } };
  }

  /* ---------- scene 9: ball velocity from noisy positions ---------- */
  function s9(G) {
    let ni = +(OPT[0] ?? 1); const SIG = [0.002, 0.005, 0.01];
    const XP = -9, WP = 18, YP = 0.6, HP = 5.4; panel(G, XP - 0.3, YP - 0.3, -0.2, WP + 0.6, HP + 0.6);
    const raw = BTR.raw, dt = BTR.dt, N = raw.length;
    const tv = i => { const a = raw[Math.max(0, i - 1)], b = raw[Math.min(N - 1, i + 1)]; return (b[1] - a[1]) / ((Math.min(N - 1, i + 1) - Math.max(0, i - 1)) * dt); };
    const TV = raw.map((_, i) => tv(i)), Vmin = Math.min(...TV) - 1.5, Vmax = Math.max(...TV) + 1.5, px = i => XP + WP * i / (N - 1), py = v => YP + HP * (clamp(v, Vmin, Vmax) - Vmin) / (Vmax - Vmin);
    const rT = ribbon(G, N, COL.white, 0.05, { order: 2 }), r1 = ribbon(G, N, COL.bad, 0.04, { order: 3, opacity: 0.7 }), r3 = ribbon(G, N, COL.track, 0.08, { order: 4 });
    G.add(lab(`竖直方向球速（m/s），50 Hz，发球到落地前 ${(N * dt).toFixed(2)} s`, [0, YP + HP + 0.5, 0], { size: 19 }), lab('白：真值  红：单步差分  蓝：四帧平均', [0, YP - 0.75, 0], { size: 18 }));
    const cache = {};
    function get() { if (cache[ni]) return cache[ni]; const s = SIG[ni], P = raw.map((q, i) => q[1] + s * BTR.nz[i][1]);
      const v1 = P.map((x, i) => i ? (x - P[i - 1]) / dt : NaN), v3 = P.map((x, i) => i >= 3 ? (x - P[i - 3]) / (3 * dt) : NaN);
      let e1 = 0, e3 = 0, e3m = 0, n = 0; for (let i = 3; i < N - 1; i++) { e1 += (v1[i] - tv(i)) ** 2; e3 += (v3[i] - tv(i)) ** 2; e3m += (v3[i] - (raw[i][1] - raw[i - 3][1]) / (3 * dt)) ** 2; n++; }
      return cache[ni] = { v1, v3, e1: Math.sqrt(e1 / n), e3: Math.sqrt(e3 / n), e3m: Math.sqrt(e3m / n) }; }
    const ctls = [{ label: '位置噪声 σ', items: ['2 mm', '5 mm', '10 mm'], get: () => ni, set: k => { ni = k; } }];
    return { ctls, update(p) {
      const c = get(), m = Math.max(4, Math.round(p * (N - 1))), T = [], A = [], B = [];
      for (let i = 0; i < N; i++) { const j = Math.min(i, m); T.push([px(j), py(tv(j)), 0.02]); A.push([px(Math.max(1, j)), py(c.v1[Math.max(1, j)]), 0.04]); B.push([px(Math.max(3, j)), py(c.v3[Math.max(3, j)]), 0.06]); }
      rT.userData.set(T); r1.userData.set(A); r3.userData.set(B);
      cap(`σ = ${SIG[ni] * 1000} mm · 单步差分 RMS <b>${c.e1.toFixed(2)}</b> m/s · 四帧平均 <b>${c.e3.toFixed(2)}</b> m/s（对窗口中点的真值只有 ${c.e3m.toFixed(2)}，其余是 30 ms 的滞后）`);
    } };
  }

  /* ---------- scene 10: real-world deployment ---------- */
  function s10(G) {
    let row = +(OPT[0] ?? 2);
    floorRect(G, 0, 0, 19, 15, 0x14203a, { y: -0.02 }); rectXZ(G, 0, 0, 19, 15, 0x7cb8ff, { opacity: 0.8 }); court(G);
    const cams = inst(BALL, 52); cams.material.color.setHex(0x9aa6bf); cams.material.emissive.setHex(0x223344); G.add(cams);
    for (let i = 0; i < 52; i++) { const t = i / 52, per = 2 * (19 + 15), s = t * per; let x, z; if (s < 19) { x = -9.5 + s; z = -7.5; } else if (s < 34) { x = 9.5; z = -7.5 + (s - 19); } else if (s < 53) { x = 9.5 - (s - 34); z = 7.5; } else { x = -9.5; z = 7.5 - (s - 53); } setI(cams, i, [x, 3.6 + 0.5 * (i % 2), z], 0.14); } done(cams);
    G.add(lab('动捕区 19 m × 15 m · 52 台相机（README：50+）', [0, 0.4, 8.6], { size: 20, color: '#7cb8ff' }));
    const rob = robot(COL.robot), hum = robot(0xb48cff, { racket: 0x9d8cff }); G.add(rob, hum);
    const ball = new THREE.Mesh(BALL, L.mat(COL.ball, { emissive: 0x555500 })); ball.scale.setScalar(0.1); G.add(ball);
    const sub = new THREE.Group(); G.add(sub);
    const T5 = { 'w/o DR': [[16.67, '1/6'], [25.0, '2/8'], [28.57, '2/7'], [14.29, '1/7']], 'w/o ON': [[50.0, '5/10'], [0, '0/5'], [28.57, '2/7'], [37.5, '3/8']], 'Ours': [[90.9, '10/11'], [77.78, '7/9'], [88.89, '8/9'], [81.82, '9/11']] };
    const KEYS = Object.keys(T5), NM = ['正手', '反手', '前场', '后场'];
    const BX = i => -5.7 + i * 3.8; const bars = NM.map((nm, i) => { const b = block(1.4, 1, 0.6, COL.real, [BX(i), 0.5, -10.5]); sub.add(b); return b; });
    const vals = NM.map((nm, i) => dynLab(sub, [BX(i), -0.6, -9.4], { size: 23 }));
    const ttl = dynLab(sub, [-10.5, 2.5, -10.5], { size: 28, border: 'rgba(255,122,89,.7)' });
    const ctls = [{ label: '表 5', items: KEYS, get: () => row, set: k => { row = k; } }];
    return { ctls, update(p) {
      const t = p * 14, u = (t % 2.0) / 2.0, R = T5[KEYS[row]];
      pose(rob, clip(u > 0.45 && u < 0.85 ? 'fore' : 'ready', u > 0.45 ? (u - 0.45) * 2.0 + 0.6 * 1.4 * 0.8 : t), [-4.8, 0, 0.6], 1.0, PI / 2);
      pose(hum, clip(u < 0.25 ? 'fore' : 'ready', u < 0.25 ? 0.62 * 1.4 + u * 2 : t), [5.2, 0, -0.4], 1.05, -PI / 2);
      const a = u < 0.5 ? u / 0.5 : (u - 0.5) / 0.5, from = u < 0.5 ? [5.0, 1.1, -0.2] : [-4.6, 1.0, 0.4], to = u < 0.5 ? [-4.6, 1.0, 0.4] : [5.0, 1.1, -0.2];
      ball.position.set(L.lerp(from[0], to[0], a), L.lerp(from[1], to[1], a) + 2.2 * Math.sin(PI * a), L.lerp(from[2], to[2], a));
      const g = seg(p, 0.0, 0.4); bars.forEach((b, i) => { const h = Math.max(0.02, R[i][0] / 100 * 5 * g); b.scale.y = h; b.position.y = h / 2; vals[i](`${NM[i]} ${R[i][0].toFixed(2)}%\n= ${R[i][1]}`); });
      ttl(`表 5 · ${KEYS[row]}`);
      const tot = R[0][1].split('/').map(Number), tot2 = R[1][1].split('/').map(Number);
      cap(`${KEYS[row]}：正反手合计 <b>${tot[0] + tot2[0]} / ${tot[1] + tot2[1]}</b> 次成功${row === 2 ? '（和论文说的 20 次对打一致）' : '（我按最小解还原）'} · 成功 = 回到对方场内`);
    } };
  }

  /* ---------- scene 11: results; every bar is a number from the paper ---------- */
  function s11(G) {
    let view = +(OPT[0] ?? 0); G.add(L.grid(34, 34)); const sub = new THREE.Group(); G.add(sub);
    const C4 = ['正手', '反手', '前场', '后场'];
    const T = [
      { t: '表 3 · 成功率 SR（%）', g: C4, s: [['AMP', 0x8e9bb8, [41.32, 36.81, 49.48, 41.73]], ['ASE', 0x9d8cff, [63.47, 55.22, 71.36, 68.59]], ['PULSE', 0x7cb8ff, [71.85, 63.38, 74.52, 72.94]], ['Ours', COL.high, [96.52, 82.10, 86.35, 89.80]]], max: 100 },
      { t: '表 3 · 关节力矩 Torque（无单位）', g: C4, s: [['AMP', 0x8e9bb8, [13.79, 15.74, 18.26, 19.20]], ['ASE', 0x9d8cff, [11.84, 12.92, 14.05, 15.27]], ['PULSE', 0x7cb8ff, [9.76, 10.83, 12.01, 13.44]], ['Ours', COL.high, [7.40, 7.71, 7.47, 7.60]]], max: 20 },
      { t: '表 4 · 成功率 SR（%）', g: C4, s: [['w/o Corr.', COL.wrist, [82.36, 68.94, 74.21, 79.05]], ['w/o LAB', COL.bad, [93.12, 76.96, 84.73, 87.44]], ['Ours', COL.high, [96.52, 82.10, 86.35, 89.80]]], max: 100 },
      { t: '表 4 · 关节力矩 Torque', g: C4, s: [['w/o Corr.', COL.wrist, [8.85, 8.92, 9.64, 9.38]], ['w/o LAB', COL.bad, [12.53, 12.11, 10.94, 13.62]], ['Ours', COL.high, [7.40, 7.71, 7.47, 7.60]]], max: 14 },
      { t: '图 6(b) · 自对打连续拍数（50 局，概率）', g: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '16', '17', '18', '19', '25'], s: [['', COL.distil, [.04, .14, .08, .06, .06, .12, .08, .08, .02, .02, .06, .04, .06, .04, .02, .02, .02, .02, .02]]], max: 0.15 }
    ];
    let bars = [], last = -1;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = view; const v = T[view], Ng = v.g.length, Ns = v.s.length, gw = Math.min(6.4, 27 / Ng), w = Math.min(1.3, (gw - 0.5) / Ns);
      v.g.forEach((nm, i) => { const x0 = (i - (Ng - 1) / 2) * gw; sub.add(lab(nm, [x0, -0.2, 2.4], { size: Ng > 8 ? 16 : 20 }));
        v.s.forEach(([sn, c, vals], j) => { const x = x0 + (j - (Ns - 1) / 2) * (w + 0.08), b = block(w, 1, w, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(Ng > 8 ? vals[i].toFixed(2) : vals[i].toFixed(1), [x, 0, 0], { size: Ng > 8 ? 14 : 15 }); sub.add(l); bars.push({ b, l, v: vals[i], m: v.max }); }); });
      if (Ns > 1) v.s.forEach(([sn, c], j) => { sub.add(lab(sn, [-12 + j * 4.0, 9.2, 0], { size: 20, color: css(c) })); });
      sub.add(lab(v.t, [Ns > 1 ? 6 : 0, 9.2, 0], { size: 22, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const ctls = [{ label: '图表', items: ['表 3 SR', '表 3 力矩', '表 4 SR', '表 4 力矩', '图 6(b)'], get: () => view, set: k => { view = k; } }];
    const MSG = ['PPO 和 MotionVAE 不收敛，没有柱子。注意 AMP 的正反手都 ≤ 41.32，前后场都 ≥ 41.73：<b>不可能是同一批试验</b>', 'Ours 的力矩在四列里最低，而且四列几乎一样（7.40–7.71）', '去掉手腕修正掉 <b>10.75–14.16</b> 个点；去掉 LAB 只掉 1.62–5.14 个点', '去掉 LAB，力矩高 <b>46–79%</b>：LAB 主要换来的是动作质量', '合计 1.00 = 50 局；平均 <b>7.78</b> 拍，中位数 6.5，25 拍只有 1 局'];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const g = seg(p, 0, 0.5); bars.forEach(({ b, l, v, m }) => { const h = Math.max(0.02, v / m * 7.5 * g); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.4; });
      cap(MSG[view]);
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player (same as interactives/phc) ---------- */
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
  window.__latentDebug = { DAG, FL, SERVES, get cap() { return $('cap').textContent; } };
})();
