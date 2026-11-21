'use strict';
/* DiffMimic (arXiv 2304.03274) taken apart into eleven animated scenes. Numbers come from the paper and the official code
   (jiawei-ren/diffmimic d0db48a, S-Lab License 1.0, only file names and keys are quoted). Each scene's update(p) is a pure
   function of the timeline p plus the current toggles. Scenes 2, 3, 4, 7, 8 and 10 compute small toy problems live; scene 9
   plots Figures 7 and 8 as read from the paper's vector paths. The humanoid is hand-made. No DiffMimic policy runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { ref: 0xe0607a, lrn: 0x3aa8e0, grad: 0xf0963c, sim: 0x4fc98a, pol: 0x9d8cff, replay: 0xf2c14e, dim: 0x46506a, robot: 0xc9d4ea, ok: 0x4fc98a, bad: 0xe05d5d, rl: 0xd95926, dm: 0x3987e5, amp: 0x199e70 };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  /* Figure 8 (54 frames) and Figure 7 backflip panels (50 points, 0 to 15.876M samples), read from PDF page 9 vector paths */
  const F8 = { full: [0.0,0.001,0.002,0.002,0.002,0.003,0.005,0.005,0.003,0.002,0.002,0.006,0.012,0.018,0.025,0.029,0.039,0.053,0.067,0.062,0.057,0.061,0.053,0.033,0.024,0.052,0.127,0.221,0.283,0.311,0.324,0.349,0.357,0.318,0.24,0.155,0.069,0.014,0.005,0.007,0.008,0.009,0.007,0.004,0.003,0.003,0.002,0.001,0.001,0.001,0.003,0.001,0.001,0.001],
    thr: [0.0,0.001,0.001,0.002,0.003,0.005,0.007,0.008,0.008,0.007,0.005,0.005,0.009,0.012,0.009,0.011,0.017,0.023,0.026,0.025,0.038,0.075,0.101,0.112,0.111,0.098,0.078,0.053,0.031,0.014,0.006,0.007,0.01,0.01,0.013,0.018,0.027,0.031,0.033,0.033,0.035,0.035,0.024,0.015,0.006,0.004,0.001,0.001,0.001,0.002,0.002,0.002,0.003,0.005],
    rnd: [0.0,0.001,0.001,0.001,0.001,0.003,0.005,0.005,0.003,0.003,0.004,0.005,0.007,0.007,0.005,0.008,0.016,0.024,0.033,0.044,0.047,0.059,0.067,0.059,0.044,0.033,0.063,0.133,0.195,0.195,0.144,0.078,0.037,0.019,0.009,0.005,0.011,0.022,0.029,0.027,0.023,0.023,0.022,0.012,0.006,0.004,0.001,0.001,0.001,0.002,0.003,0.004,0.004,0.007] };
  const SCENES = [
    { n: 1, part: '总览', title: '可微仿真里滚一段，和参考逐步比，梯度沿时间传回策略', sub: '图 2 的 3D 版。方块可以点', dur: 14, cam: [0.0, 1.22, 15.5, [-0.4, 2.1, 0]],
      html: dl([['参考 ŝ<sub>t</sub>', '动捕片段，30 Hz，每个刚体的位置、旋转、速度、角速度'], ['学习者 s<sub>t</sub>', '策略 π<sub>θ</sub> 出 PD 目标角，Brax 往前走一步'], ['损失', '式 (3.2)：每一步 ‖s<sub>t</sub> − ŝ<sub>t</sub>‖² 求和'], ['梯度', '式 (3.3)：穿过 Brax 的雅可比，一步步往回传（BPTT）'], ['示范回放', '式 (3.5)：偏离超过阈值，下一步从参考状态 ŝ 接着滚']]) +
        '<p>和 RL 的区别：没有奖励设计，也不靠采样估计梯度。损失对每个动作的导数是解析算出来的。</p>' +
        '<p>第 3 步被替换后，没有橙色箭头从 ŝ<sub>3</sub> 指回 s<sub>2</sub>：代码里替换写成 s·(1 − r) + ŝ·r，r = 1 时梯度为零。示范回放因此也是一种按误差决定位置的截断。</p>' + src('§3.2 · 图 2 · 算法 1 · 代码 humanoid_mimic_train.py') },
    { n: 2, part: '§3.1 环境', title: '13 个刚体、28 个关节转轴、PD 控制：30 Hz 出目标角，480 Hz 积分', sub: '左边是一个关节的 PD 响应，当场积分。切换关节', dur: 13, cam: [0.0, 1.3, 13, [-0.6, 1.6, 0]],
      html: dl([['刚体', '13 个（骨盆、躯干、头、两上臂、两前臂、两大腿、两小腿、两脚）'], ['自由度', '28 个转轴 + 根 6 = 34'], ['观测', '相对根位置 36 + 6D 旋转 78 + 速度 39 + 角速度 39 + 相位 1 = 193'], ['动作', '28 维，tanh 到 (−1, 1)，目标角 = 动作 × 1.2π'], ['PD', 'τ = k<sub>p</sub>(q̃ − q) − k<sub>d</sub> q̇，k<sub>d</sub> = k<sub>p</sub> / 10'], ['频率', 'dt 0.0333 s，16 个子步 → 480 Hz']]) +
        '<p>k<sub>p</sub> 取配置的 strength：脊柱 1000、颈 100、肩 400、肘 300、髋 500、膝 500、踝 400，和 DeepMimic 一致。论文说体重 45 kg（DeepMimic 的数）；代码角色的质量合计 48.89 kg。</p>' +
        toyb('左边的曲线把一个关节当成转动惯量 0.25 的单摆，不考虑重力和接触；每 1/30 s 换一次目标角，按代码的 k<sub>p</sub>、k<sub>d</sub> 用 480 Hz 半隐式欧拉积分。') + src('§3.1 · 式 (3.1) · 附录 D · 代码 HUMANOID.py、pd_controller.py') },
    { n: 3, part: '§3.2 损失', title: '状态匹配损失：13 个刚体的位置、旋转、速度、角速度', sub: '红色半透明是参考，蓝色是学习者；四根柱子当场算', dur: 14, cam: [0.2, 1.3, 10.5, [1.6, 1.2, 0]],
      html: dl([['位置', 'Σ<sub>xyz</sub>(p − p̂)²，对 13 个刚体平均，权重 1'], ['旋转', '6D（旋转矩阵前两行）的平方差，权重 0.5'], ['速度', '线速度平方差，权重 0.01'], ['角速度', '权重 0.01'], ['缩放', '整体 × 0.02（reward_scaling）'], ['对时间', '代码取平均，论文写求和']]) +
        '<p>论文只说四个权重“粗调到量级相当”，具体数在代码配置里：rot_weight 0.5、vel_weight 0.01、ang_weight 0.01。位置和旋转都是世界坐标。</p>' +
        '<p>评估用的指标是另一个：式 (4.1)，相对根的位置差取欧氏距离（不平方），单位米。表 1 的数字是这个，再加 DTW。</p>' +
        toyb('两个小人的动作是手写的下蹲起跳；学习者在躯干前倾、手臂和膝盖上加了随时间变化的偏差。柱子是对这两个手工姿态按代码公式当场算的。') + src('式 (3.2) · 代码 humanoid_mimic.py 第 40–44 行、losses.py') },
    { n: 4, part: '式 (3.3)', title: '梯度沿时间反传：每一步都要乘一次动力学的雅可比', sub: '一维玩具当场算 ∂L/∂u<sub>t</sub>；切换雅可比 a', dur: 13, cam: [0.0, 1.32, 15, [0, 1.9, 0]],
      html: dl([['递推', 'λ<sub>t</sub> = ∂L/∂s<sub>t</sub> = 2(s<sub>t</sub> − ŝ<sub>t</sub>) + a·λ<sub>t+1</sub>'], ['对动作', '∂L/∂u<sub>t</sub> = λ<sub>t+1</sub>'], ['a &lt; 1', '远处的误差传回来时被一路衰减：梯度消失'], ['a &gt; 1', '一路放大：前面几步的梯度爆炸'], ['代码', 'jax.lax.scan 59 步 + 一次 jax.grad']]) +
        '<p>真实人形的雅可比是 Brax 给的高维矩阵，接触时还会突变（第 2 节引的 Suh 2022、Zhong 2022）。这就是论文第 3.3 节说的第一个难题。</p>' +
        '<p>代码把梯度按全局范数裁到 0.4（论文写 0.3），可以挡住爆炸，挡不住消失。</p>' +
        toyb('s<sub>t+1</sub> = a·s<sub>t</sub> + u<sub>t</sub>，参考 ŝ<sub>t</sub> = sin(0.25t)，动作全为 0，T = 40。柱高是 log<sub>10</sub>|∂L/∂u<sub>t</sub>|，当场算。') + src('式 (3.3) · §3.3 · 代码 agent_diffmimic.py 第 121–158 行') },
    { n: 5, part: '§3.3 局部极小', title: '只用全程梯度：后空翻学成了“弯腰用手撑地”', sub: '一维代价面上的梯度下降；切换有无示范回放', dur: 13, cam: [0.0, 1.3, 14.5, [-0.4, 1.7, 0]],
      html: dl([['图 6(b)', '全程梯度：向后弯腰，双手撑地，不起跳'], ['图 6(c)', '随机回放：翻过去了，有几帧姿态别扭'], ['图 6(d)', '阈值回放：翻过去了，和参考接近'], ['原因', '梯度只看局部；起跳失败时后半段误差巨大，代价面上“先不跳”反而是局部更低的点']]) +
        '<p>论文的解释：模仿任务高度非凸，解析梯度只看局部，容易卡在次优点。示范回放把跑偏的状态拉回参考，后半段的损失不再因为前半段失败而累积，等于把代价面上的“坎”削低。</p>' +
        guess('代价面是手画的两个谷，不是从 DiffMimic 算出来的；“有回放”那条曲线只为说明思路。') + src('§3.3 · 图 6 · §4.4') },
    { n: 6, part: '§4.3 截断', title: '每 10 步切断一次梯度：结果更差', sub: '切换全程 / 截断 10 步，看橙色梯度流在哪里停下', dur: 13, cam: [0.0, 1.22, 16, [0, 1.6, 0]],
      html: dl([['做法', '每 10 步对状态做一次 stop_gradient（代码键 truncation_length）'], ['来源', 'SHAC 的短窗口思路，但这里没有评论家'], ['后空翻', '最后 10 点平均：截断 0.189，全程 0.147'], ['侧手翻', '截断 0.245，全程 0.152'], ['作者解释', '起跳和空翻相互依赖，硬切让前后脱节']]) +
        '<p>SHAC 切窗口后在窗口末端接一个评论家，把窗口外的回报补回来。DiffMimic 的截断实验没有评论家，所以每段只为自己这 10 步负责，起跳那一段看不到空翻阶段的误差。</p>' +
        '<p>柱子是图 7(a)(b) 的矢量读数（最后 10 个点的平均）。</p>' + src('§4.3 · 图 7(a)(b) · 代码 agent_diffmimic.py 第 127–130 行') },
    { n: 7, part: '式 (3.4)', title: '随机回放：按固定概率把某一步换成参考（teacher forcing）', sub: '玩具当场模拟；切换比例 γ。黄色是被替换的帧，橙色管是连着的梯度链', dur: 14, cam: [0.0, 1.25, 15, [0.2, 1.9, 0]],
      html: dl([['规则', '每步抽 b ∼ Bernoulli(γ)，b = 1 就从 ŝ<sub>t</sub> 接着滚'], ['代码', "demo_replay_mode: random，replay_rate 默认 0.05"], ['图 7(c)', '后空翻 γ = 0.05 最好（末段 0.088），0.01 和 0.1 都差'], ['问题', '替换和当前误差无关：该换的时候不一定换']]) +
        '<p>平均误差能降下来，但个别帧的误差可能很大（图 8 的随机回放在第 28 帧附近有一个约 0.2 的峰）。附录 K 的表 7 用“最差 1% 帧”量这个问题。</p>' +
        toyb('误差动力学 e<sub>t+1</sub> = 1.07·e<sub>t</sub> + d<sub>t</sub>，d<sub>t</sub> 在第 18 到 36 帧（腾空段）更大；54 帧，固定种子。蓝点 = 参考 + 误差。') + src('式 (3.4) · 图 7(c)(d) · 代码 humanoid_mimic_train.py 第 50–53 行') },
    { n: 8, part: '式 (3.5)', title: '阈值回放：偏离超过 ε 才换成参考，并在那里断开梯度', sub: '同一个玩具；切换 ε。下面小人对应图 3', dur: 15, cam: [0.0, 1.22, 16, [0.2, 1.7, 0]],
      html: dl([['规则', '‖s<sub>t</sub> − ŝ<sub>t</sub>‖ ≥ ε 就从 ŝ<sub>t</sub> 接着滚'], ['代码判据', '13 个刚体世界位置的平均欧氏距离（米），&gt; threshold 就换'], ['阈值', '代码 0.2（爬、跑、走、僵尸）或 0.4（其余）'], ['梯度', 's ← s·(1 − r) + ŝ·r：被换的那一步之后，梯度传不回之前'], ['效果', '最大逐帧误差被 ε 压住；替换频率随策略变好自动下降']]) +
        '<p>论文强调的是“按当前表现决定换不换”。代码还多了一层：替换点就是截断点，每段梯度链从一个正确的状态开始。这一点论文正文没写，图 2 是这样画的。</p>' +
        toyb('同第 7 幕的误差动力学和种子；ε 是玩具单位。小人的姿态是手写的后翻，学习者的偏差按 e<sub>t</sub> 加在躯干俯仰上。') + src('式 (3.5) · 算法 1 · 图 2、图 3 · 代码 humanoid_mimic_train.py 第 44–59 行') },
    { n: 9, part: '§4.4 结果', title: '图 7、图 8 的矢量读数：平均差不多，最差帧差很多', sub: '切换图 8 / 图 7(c) / 图 7(e)', dur: 14, cam: [0.0, 1.32, 15, [-0.3, 1.75, 0]],
      html: dl([['图 8 峰值', '全程 0.357，随机 γ = 0.05 0.195，阈值 ε = 0.4 0.112'], ['表 7', 'L2@0.01 / 0.05 / 0.1 = 最差 1 / 3 / 6 帧的平均（54 帧）'], ['图 7(c)', '后空翻：随机回放 γ = 0.05 比全程好'], ['图 7(e)', '后空翻：阈值 ε = 0.4 和随机 γ = 0.05 末段相近']]) +
        '<p>图 8 那三条线的“最差 1、3、6 帧平均”和表 7 的三行几乎一模一样，所以表 7 来自这一次 54 帧的滚动。注意表 7 里 γ 表示阈值、λ 表示比例，和正文相反。</p>' +
        src('图 7、图 8（PDF 第 9 页矢量读数）· 表 7') },
    { n: 10, part: '对比 RL', title: '解析梯度一次就准；RL 要靠大量采样平均', sub: '一维玩具当场算 200 次梯度估计；切换每次的样本数 N', dur: 13, cam: [0.0, 1.3, 15.5, [0.0, 1.8, 0]],
      html: dl([['DiffMimic', '∂L/∂θ 解析算出，一条轨迹就有每一维的方向和大小'], ['RL（DeepMimic、AMP）', '采样动作，用回报的差估计梯度，方差随 1/√N 下降'], ['表 2', '滚 20 秒不摔所需样本：DiffMimic 比 DeepMimic 少 32.6% 到 79.4%'], ['附录 H', '加 RSI 后少 84.5% 到 93.5%']]) +
        '<p>代价是每步要多做一次反传，显存随滚动长度增长。墙钟上只和 AMP 比了一个持剑动作（图 5）：DiffMimic 1.93 小时低于 0.06，AMP 4.65 小时。</p>' +
        toyb('J(θ) = −(θ − 1)²，在 θ = 0 处估计梯度（真值 2）。RL 用 N 个 θ + 0.3ε 的扰动和均值基线做似然比估计。重复 200 次，画估计值的直方图，当场算。') + src('§4.2 · 表 2 · 表 3') },
    { n: 11, part: '代码', title: '发布代码的训练循环：RSI 起步、300 个环境、59 步、1000 次', sub: '切换论文设定 / 代码设定 / 表 1', dur: 14, cam: [0.0, 1.25, 17, [0, 1.6, 0]],
      html: dl([['起点', '论文：参考第一帧；代码：随机帧（RSI，附录 H 的版本）'], ['滚动', '论文 4 s（120 步），200 环境；代码 59 步，300 环境'], ['迭代', '论文循环动作 5000；代码 1000'], ['裁剪', '论文 0.3；代码 0.4'], ['评估', '每次迭代 32 环境 × 599 步，只存误差最低的检查点'], ['指标', '代码没有 DTW']]) +
        '<p>表 2 的样本数都是 24,000（200 × 120）的整数倍，对应论文设定；按发布配置跑，口径不同。相位周期比参考文件多一帧（精读页读者注 9）。</p>' +
        guess('流程方块是示意；数字来自论文附录 C 和代码配置。表 1 的柱子是原文数字。') + src('附录 C、H · 代码 mimic.py、configs/AMP/*_20s.yaml、agent_diffmimic.py') }
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
  /* scene 2: one PD joint, I = 0.25, 480 Hz semi-implicit Euler, new target every 1/30 s */
  function pdTrace(kp, I = 0.25) {
    const r = L.rng(7), steps = 15, sub = 16, h = 1 / 480, out = [], tgt = [];
    let q = 0, w = 0, qt = 0;
    for (let k = 0; k < steps; k++) {
      qt = k < 3 ? 0.9 : (k < 9 ? -0.5 + 0.2 * r() : 0.4 + 0.2 * r());
      for (let j = 0; j < sub; j++) { const tau = kp * (qt - q) - (kp / 10) * w; w += h * tau / I; q += h * w; out.push(q); tgt.push(qt); }
    }
    return { q: out, t: tgt };
  }
  const PD = [pdTrace(500), pdTrace(100)];
  /* scene 4: dL/du_t for s_{t+1} = a s_t + u_t, u = 0, ref = sin(0.25 t), L = sum (s_t - ref_t)^2 */
  function bpttToy(a, T = 40) {
    const s = [0.5]; for (let t = 0; t < T; t++) s.push(a * s[t]);
    const ref = t => Math.sin(0.25 * t), lam = new Array(T + 1).fill(0);
    lam[T] = 2 * (s[T] - ref(T)); for (let t = T - 1; t >= 1; t--) lam[t] = 2 * (s[t] - ref(t)) + a * lam[t + 1];
    return Array.from({ length: T }, (_, t) => Math.abs(lam[t + 1]));
  }
  const BP = [0.9, 1.0, 1.1].map(a => bpttToy(a));
  /* scenes 7 and 8: toy error dynamics with replacement */
  const NF = 54, RHO = 1.07;
  const DRIFT = (function () { const r = L.rng(11); return Array.from({ length: NF }, (_, t) => (t >= 18 && t <= 36 ? 0.03 : 0.006) * (0.4 + 1.2 * r()) * (r() < 0.5 ? 1 : 0.6)); })();
  function replayToy(mode, par) {
    /* seen[t]: the error the loss sees at frame t; rep[t]: frame t was replaced, so frame t+1 starts from the reference */
    const r = L.rng(23), seen = [0], rep = [false];
    let start = 0;
    for (let t = 0; t < NF - 1; t++) {
      const e = RHO * start + DRIFT[t];
      const swap = mode === 'thr' ? e >= par : r() < par;
      seen.push(e); rep.push(swap); start = swap ? 0 : e;
    }
    return { seen, rep, n: rep.filter(Boolean).length, max: Math.max(...seen), mean: seen.reduce((a, b) => a + b, 0) / NF };
  }
  /* scene 10: REINFORCE vs analytic gradient of J = -(theta-1)^2 at theta = 0 */
  function rlEstimates(N, reps = 200, sig = 0.3) {
    const r = L.rng(5 + N), out = [];
    for (let k = 0; k < reps; k++) {
      const eps = [], J = [];
      for (let i = 0; i < N; i++) { const e = L.gauss(r); eps.push(e); J.push(-Math.pow(sig * e - 1, 2)); }
      const b = J.reduce((a, x) => a + x, 0) / N; let g = 0; for (let i = 0; i < N; i++) g += (J[i] - b) * eps[i] / sig; out.push(g / N);
    }
    return out;
  }
  const RL = [8, 64, 512].map(N => rlEstimates(N));
  const stdv = a => { const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length); };

  /* ---------- 3D helpers (same pattern as interactives/latent and interactives/rpl) ---------- */
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
  function dynLab(G, pos, o = {}) {
    const st = { s: null, t: null };
    return t => { if (t === st.t) return; if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; st.s = lab(t, pos, o); G.add(st.s); };
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BALL = new THREE.SphereGeometry(1, 12, 9);
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
    m.userData.set = pts => { const k = Math.min(n, pts.length); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)], z = q[2] ?? 0; pos[i * 6] = q[0]; pos[i * 6 + 1] = q[1] - w / 2; pos[i * 6 + 2] = z; pos[i * 6 + 3] = q[0]; pos[i * 6 + 4] = q[1] + w / 2; pos[i * 6 + 5] = z; } g.attributes.position.needsUpdate = true; };
    return m;
  }
  function panel(G, x, y, z, w, h, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: o.color ?? 0x0c1220, transparent: true, opacity: o.opacity ?? 0.55, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }
  function bar(G, color, x, w, base = 0, z = 0, o = {}) { const b = block(w, 1, w, color, [x, base + 0.5, z], o); G.add(b); return h => { const hh = Math.max(0.02, h); b.scale.y = hh; b.position.y = base + hh / 2; }; }

  /* ---------- hand-made humanoid with 13 body markers (faces +z) ---------- */
  function robot(color, o = {}) {
    const m = L.mat(color, { opacity: o.opacity, roughness: 0.5, depthWrite: o.opacity == null || o.opacity > 0.6 });
    const G = new THREE.Group(), mesh = g => new THREE.Mesh(g, m), parts = [];
    const mark = (par, y) => { const k = new THREE.Object3D(); k.position.y = y; par.add(k); parts.push(k); return k; };
    const limb = (len, r) => { const g = new THREE.Group(), c = mesh(new THREE.CylinderGeometry(r, r * 0.82, len, 8)); c.position.y = -len / 2; g.add(c); g.add(mesh(new THREE.SphereGeometry(r, 8, 6))); return g; };
    const body = new THREE.Group(); G.add(body);
    const pelvis = new THREE.Group(); body.add(pelvis);
    pelvis.add(mesh(new THREE.BoxGeometry(0.26, 0.1, 0.14))); mark(pelvis, 0);
    const upper = new THREE.Group(); pelvis.add(upper);
    const tor = mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.36, 10)); tor.position.y = 0.2; upper.add(tor); mark(upper, 0.2);
    const head = mesh(new THREE.SphereGeometry(0.085, 12, 9)); head.position.y = 0.48; upper.add(head); mark(upper, 0.48);
    const arms = [-1, 1].map(s => { const up = limb(0.2, 0.034); up.position.set(s * 0.18, 0.34, 0); mark(up, -0.1); const lo = limb(0.2, 0.028); lo.position.y = -0.2; up.add(lo); mark(lo, -0.1); upper.add(up); return { up, lo, s }; });
    const legs = [-1, 1].map(s => { const th = limb(0.3, 0.05); th.position.set(s * 0.09, -0.04, 0); mark(th, -0.15); const sh = limb(0.3, 0.042); sh.position.y = -0.3; th.add(sh); mark(sh, -0.15); const ft = mesh(new THREE.BoxGeometry(0.08, 0.035, 0.21)); ft.position.set(0, -0.31, 0.04); sh.add(ft); const fk = new THREE.Object3D(); fk.position.set(0, -0.31, 0.04); sh.add(fk); parts.push(fk); pelvis.add(th); return { th, sh }; });
    G.userData.parts = parts;
    G.userData.set = q => {
      body.position.y = q.y ?? 0.62; body.rotation.set(q.pitch || 0, 0, 0); upper.rotation.x = q.lean || 0;
      legs[0].th.rotation.x = -(q.hL ?? 0.1); legs[1].th.rotation.x = -(q.hR ?? 0.1); legs[0].sh.rotation.x = q.kL ?? 0.15; legs[1].sh.rotation.x = q.kR ?? 0.15;
      arms.forEach((a, i) => { a.up.rotation.x = -(q.sh ?? 0.2) + (i ? -1 : 1) * (q.swing || 0); a.up.rotation.z = a.s * (q.abd ?? 0.12); a.lo.rotation.x = -(q.el ?? 0.3); });
    };
    return G;
  }
  function place(r, q, at, yaw = 0, sc = 1) { r.userData.set(q); r.position.set(...at); r.rotation.y = yaw; r.scale.setScalar(sc); }
  /* hand-made reference clips */
  function squatJump(t) { /* t in [0,1): crouch, jump, land */
    const c = Math.sin(Math.PI * clamp(t / 0.35, 0, 1)), air = t > 0.35 && t < 0.7 ? Math.sin(Math.PI * (t - 0.35) / 0.35) : 0, land = t >= 0.7 ? Math.sin(Math.PI * clamp((t - 0.7) / 0.3, 0, 1)) : 0;
    const k = 1.1 * c + 0.7 * land;
    return { y: 0.62 - 0.22 * c - 0.15 * land + 0.45 * air, hL: 0.1 + 0.8 * k, hR: 0.1 + 0.8 * k, kL: 0.15 + 1.3 * k, kR: 0.15 + 1.3 * k, lean: 0.35 * k, sh: 0.2 + 2.4 * air - 0.6 * c, el: 0.3 + 0.3 * c, pitch: 0 };
  }
  function backflip(t) { /* crouch, jump, rotate backwards 2pi, land */
    const c = Math.sin(Math.PI * clamp(t / 0.3, 0, 1)), ph = clamp((t - 0.25) / 0.5, 0, 1), air = Math.sin(Math.PI * ph), tuck = Math.sin(Math.PI * clamp((t - 0.32) / 0.36, 0, 1));
    return { y: 0.62 - 0.2 * c + 0.75 * air, pitch: -2 * Math.PI * L.ease(ph), hL: 0.1 + 0.9 * c + 1.5 * tuck, hR: 0.1 + 0.9 * c + 1.5 * tuck, kL: 0.15 + 1.2 * c + 1.8 * tuck, kR: 0.15 + 1.2 * c + 1.8 * tuck, lean: 0.3 * c, sh: 0.2 + 2.6 * Math.sin(Math.PI * clamp((t - 0.18) / 0.3, 0, 1)) - 0.5 * c, el: 0.3 };
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

  /* ---------- scene 1: overview (Figure 2 in 3D) ---------- */
  function s1(G) {
    const N = 6, X = i => -5.8 + 2.3 * i, YR = 3.3, YL = 1.2, RP = 3;
    const refs = [], lrn = [];
    for (let i = 0; i < N; i++) {
      const r = ball(COL.ref, 0.26, [X(i), YR, 0], { opacity: 0.85 }); G.add(r); refs.push(r);
      const l = ball(i === RP ? COL.ref : COL.lrn, 0.26, [X(i), YL, 0]); G.add(l); lrn.push(l);
      if (i < N - 1) wire(G, [[X(i) + 0.3, YR, 0], [X(i + 1) - 0.3, YR, 0]], 0x9aa6bf, { dashed: true, opacity: 0.7 });
      const lw = wire(G, [[X(i), YR - 0.3, 0], [X(i), YL + 0.3, 0]], COL.grad, { dashed: true, dash: 0.15, gap: 0.12, opacity: 0.55 }); if (i !== RP) { lw.userData.go = 2; }
    }
    const sims = [];
    for (let i = 0; i < N - 1; i++) {
      if (i === RP - 1) continue;
      const b = block(0.5, 0.42, 0.42, COL.sim, [(X(i) + X(i + 1)) / 2, YL, 0]); b.userData.go = 1; PICKS.push(b); G.add(b); sims.push(b);
      wire(G, [[X(i) + 0.28, YL, 0], [X(i + 1) - 0.28, YL, 0]], 0xdfe6f3, { opacity: 0.8 });
      const a = block(0.34, 0.34, 0.34, COL.pol, [(X(i) + X(i + 1)) / 2 - 0.25, YL - 1.05, 0]); G.add(a);
      wire(G, [[(X(i) + X(i + 1)) / 2 - 0.25, YL - 0.85, 0], [(X(i) + X(i + 1)) / 2 - 0.1, YL - 0.2, 0]], COL.pol, { opacity: 0.8 });
    }
    /* the step into the replaced state: the simulated s3' is discarded */
    const ghost = ball(COL.lrn, 0.22, [X(RP), YL - 1.0, 0], { opacity: 0.3 }); G.add(ghost);
    wire(G, [[X(RP - 1) + 0.28, YL - 0.1, 0], [X(RP) - 0.24, YL - 0.95, 0]], COL.lrn, { opacity: 0.3 });
    wire(G, [[X(RP), YR - 0.3, 0], [X(RP), YL + 0.3, 0]], 0x9aa6bf, { dashed: true, opacity: 0.9 });
    const band = panel(G, X(RP) - 0.95, 0.0, -0.3, 1.9, 4.2, { color: COL.replay, opacity: 0.16 }); band.userData.go = 7; PICKS.push(band);
    G.add(lab('示范回放\ns₃ ← ŝ₃', [X(RP), 4.55, 0], { size: 16, color: css(COL.replay) }), lab('被丢弃', [X(RP) + 0.6, YL - 1.35, 0], { size: 13 }));
    G.add(lab('参考 ŝₜ（动捕）', [X(0), YR + 0.62, 0], { size: 15, color: css(COL.ref) }), lab('学习者 sₜ（Brax 滚动）', [X(0) + 0.2, YL + 0.62, 0], { size: 15, color: css(COL.lrn) }),
      lab('Brax 一步 𝒯（可微）', [(X(3) + X(4)) / 2, YL + 0.62, 0], { size: 14, color: css(COL.sim) }), lab('aₜ ∼ π_θ(·|sₜ)', [(X(0) + X(1)) / 2 - 0.25, YL - 1.55, 0], { size: 14, color: css(COL.pol) }),
      lab('‖sₜ − ŝₜ‖²', [X(1) + 0.6, (YR + YL) / 2 + 0.25, 0], { size: 14, color: css(COL.grad) }));
    const fwd = [stream(G, 5, 0xdfe6f3, 0.07), stream(G, 5, 0xdfe6f3, 0.07)];
    const back = [stream(G, 7, COL.grad, 0.08), stream(G, 7, COL.grad, 0.08)];
    const lossF = refs.map((r, i) => stream(G, 3, COL.grad, 0.06));
    const tot = dynLab(G, [X(1), 5.0, 0], { size: 16, border: 'rgba(240,150,60,.7)' });
    return { update(p) {
      const f = seg(p, 0.0, 0.42), b = seg(p, 0.5, 0.95);
      const k = Math.floor(f * (N - 1) + 1e-6);
      lrn.forEach((m, i) => { m.visible = i <= Math.max(0, Math.ceil(f * (N - 1))); });
      ghost.visible = f * (N - 1) >= RP - 0.5;
      fwd[0]([[X(0), YL, 0], [X(RP - 1), YL, 0], [X(RP) - 0.2, YL - 0.95, 0]], (p * 6) % 1, p < 0.45 ? 1 : 0);
      fwd[1]([[X(RP), YL, 0], [X(N - 1), YL, 0]], (p * 6) % 1, p < 0.45 && f > 0.6 ? 1 : 0);
      back[0]([[X(N - 1), YL - 0.12, 0], [X(RP) + 0.1, YL - 0.12, 0]], (1 - (p * 5) % 1), p > 0.5 ? 1 : 0);
      back[1]([[X(RP - 1), YL - 0.12, 0], [X(0), YL - 0.12, 0]], (1 - (p * 5) % 1), p > 0.5 ? 1 : 0);
      lossF.forEach((fn, i) => fn([[X(i), YR - 0.3, 0], [X(i), YL + 0.3, 0]], (p * 4) % 1, p > 0.45 && i !== RP && i > 0 ? 1 : 0));
      sims.forEach((m, i) => glow(m, p < 0.45 ? 0.35 : 0.08));
      tot(p < 0.45 ? '前向：从 ŝ₀ 起步，Brax 一步步往前滚' : 'L = Σ‖sₜ − ŝₜ‖²，梯度沿时间往回传');
      cap(p < 0.45 ? '前向：策略出动作，可微仿真器 Brax 往前走一步。第 3 步偏得太远，<b>换成参考状态 ŝ₃</b> 接着滚' : '反向：每一步的损失都对之前的动作有导数。第 3 步被替换，梯度<b>传不回</b> s₂ 之前的那一段');
    } };
  }

  /* ---------- scene 2: environment and PD ---------- */
  function s2(G) {
    let jn = +(OPT[0] ?? 0);
    const rob = robot(COL.robot); G.add(rob); place(rob, { y: 0.62 }, [3.9, 0, 0], -0.5, 2.2);
    G.add(lab('13 个刚体 · 28 个转轴 + 根 6', [3.6, 3.5, 0], { size: 15 }), lab('k_p：脊柱 1000 · 颈 100 · 肩 400\n肘 300 · 髋 500 · 膝 500 · 踝 400', [4.0, -0.45, 0.6], { size: 14 }));
    /* observation stack */
    const OB = [['相对根位置', 36, 0x7cb8ff], ['6D 旋转', 78, 0x9d8cff], ['线速度', 39, 0x4fc98a], ['角速度', 39, 0xf2c14e], ['相位 φ', 1, 0xe0607a]];
    let y0 = 0; const sc = 3.2 / 193;
    OB.forEach(([t, n, c], i) => { const h = Math.max(0.05, n * sc); G.add(block(0.5, h, 0.5, c, [0.3, y0 + h / 2, 0])); G.add(lab(`${t} ${n}`, [1.35, y0 + h / 2 + (i === 4 ? 0.38 : 0), 0], { size: 13 })); y0 += h; });
    G.add(lab('观测 193', [0.3, -0.35, 0], { size: 15 }));
    /* PD trace panel */
    const X0 = -6.0, XW = 5.0, Y0 = 0.3, YH = 2.4, sx = i => X0 + XW * i / 240, sy = v => Y0 + YH * (v + 1) / 2;
    panel(G, X0 - 0.35, Y0 - 0.55, -0.05, XW + 0.6, YH + 1.25);
    [-1, 0, 1].forEach(v => { wire(G, [[X0, sy(v), 0], [X0 + XW, sy(v), 0]], 0x5a6680, { opacity: 0.4 }); G.add(lab(String(v), [X0 - 0.2, sy(v), 0], { size: 12 })); });
    for (let k = 0; k <= 15; k++) wire(G, [[sx(k * 16), Y0 - 0.12, 0], [sx(k * 16), Y0, 0]], 0x9aa6bf, { opacity: 0.6 });
    G.add(lab('0.5 s：15 个控制步 × 16 个子步', [X0 + XW / 2, Y0 - 0.35, 0], { size: 13 }));
    const rq = ribbon(G, 240, COL.lrn, 0.05), rt = ribbon(G, 240, COL.ref, 0.035, { opacity: 0.8 });
    const ttl = dynLab(G, [X0 + XW / 2, Y0 + YH + 0.35, 0], { size: 15 });
    const ctls = [{ label: '关节', items: ['膝 k_p 500', '颈 k_p 100'], get: () => jn, set: k => { jn = k; } }];
    return { ctls, update(p) {
      const tr = PD[jn], n = Math.max(2, Math.round(seg(p, 0.05, 0.85) * 240));
      rq.userData.set(tr.q.slice(0, n).map((v, i) => [sx(i), sy(v), 0.02])); rt.userData.set(tr.t.slice(0, n).map((v, i) => [sx(i), sy(v), 0.01]));
      ttl(`目标角 q̃（红）与关节角 q（蓝），k_d = k_p / 10`);
      const t = (p * 2) % 1; place(rob, { y: 0.62, sh: 0.2 + 0.5 * Math.sin(2 * Math.PI * t), kL: 0.15 + 0.4 * Math.max(0, Math.sin(2 * Math.PI * t)), hL: 0.1 + 0.3 * Math.max(0, Math.sin(2 * Math.PI * t)) }, [3.9, 0, 0], -0.5, 2.2);
      cap(jn === 0 ? '膝：k_p = 500、k_d = 50，这个玩具关节过阻尼，像时间常数约 k_d / k_p = 0.1 s 的一阶滞后：约 3 个控制步才跟上' : '颈：k_p = 100、k_d = 10，接近临界阻尼，同样追不上每 1/30 s 一换的目标');
    } };
  }

  /* ---------- scene 3: state-matching loss on 13 bodies ---------- */
  function s3(G) {
    const ref = robot(COL.ref, { opacity: 0.38 }), lr = robot(COL.lrn); G.add(ref, lr);
    const SC = 2.2, AT = [-0.6, 0, 0];
    const err = Array.from({ length: 13 }, () => { const l = L.line([[0, 0, 0], [0, 0, 0]], COL.grad, { opacity: 0.95 }); G.add(l); return l; });
    const names = ['位置 × 1', '旋转 × 0.5', '速度 × 0.01', '角速度 × 0.01'], cols = [0x7cb8ff, 0x9d8cff, 0x4fc98a, 0xf2c14e];
    const bars = names.map((t, i) => { G.add(lab(t, [2.0 + i * 1.05, i % 2 ? -0.75 : -0.35, 0], { size: 13 })); return bar(G, cols[i], 2.0 + i * 1.05, 0.42); });
    const val = names.map((t, i) => dynLab(G, [2.0 + i * 1.05, 2.65, 0], { size: 12 }));
    const tot = dynLab(G, [3.6, 3.1, 0], { size: 14, border: 'rgba(240,150,60,.7)' });
    const qerr = (q, t) => { const w = Math.sin(2 * Math.PI * t); return { ...q, lean: (q.lean || 0) + 0.45 * w, sh: q.sh + 0.9 * Math.sin(2 * Math.PI * t + 1), kL: q.kL + 0.5 * w, y: q.y - 0.06 * Math.abs(w) }; };
    const tmp = new THREE.Vector3(), tq = new THREE.Quaternion(), mx = new THREE.Matrix4();
    function measure(rb, q) { place(rb, q, AT, 0.5, SC); rb.updateMatrixWorld(true); return rb.userData.parts.map(k => { k.getWorldPosition(tmp); k.getWorldQuaternion(tq); mx.makeRotationFromQuaternion(tq); const e = mx.elements; return { p: [tmp.x / SC, tmp.y / SC, tmp.z / SC], r: [e[0], e[4], e[8], e[1], e[5], e[9]] }; }); }
    return { update(p) {
      const dt = 1 / 30, D = 3.0, t = p, t2 = Math.min(1, p + dt / D);
      const A = measure(ref, squatJump(t2)), B = measure(lr, qerr(squatJump(t2), t2));
      const A0 = measure(ref, squatJump(t)), B0 = measure(lr, qerr(squatJump(t), t));
      const A1 = measure(ref, squatJump(t)), B1 = measure(lr, qerr(squatJump(t), t));
      let sp = 0, sr = 0, sv = 0, sa = 0;
      for (let j = 0; j < 13; j++) {
        for (let k = 0; k < 3; k++) sp += Math.pow(B1[j].p[k] - A1[j].p[k], 2);
        for (let k = 0; k < 6; k++) sr += Math.pow(B1[j].r[k] - A1[j].r[k], 2);
        for (let k = 0; k < 3; k++) { const vb = (B[j].p[k] - B0[j].p[k]) / dt, va = (A[j].p[k] - A0[j].p[k]) / dt; sv += Math.pow(vb - va, 2); }
        for (let k = 0; k < 6; k++) { const wb = (B[j].r[k] - B0[j].r[k]) / dt, wa = (A[j].r[k] - A0[j].r[k]) / dt; sa += Math.pow(wb - wa, 2) / 2; }
      }
      const terms = [sp / 13, 0.5 * sr / 13, 0.01 * sv / 13, 0.01 * sa / 13];
      terms.forEach((v, i) => { bars[i](Math.min(2.4, 2.4 * Math.sqrt(v / 0.06))); val[i](v.toFixed(4)); });
      tot(`本步损失 0.02 × ${terms.reduce((a, b) => a + b, 0).toFixed(4)} = ${(0.02 * terms.reduce((a, b) => a + b, 0)).toFixed(5)}`);
      ref.updateMatrixWorld(true); lr.updateMatrixWorld(true);
      err.forEach((l, j) => { const a = new THREE.Vector3(), b = new THREE.Vector3(); ref.userData.parts[j].getWorldPosition(a); lr.userData.parts[j].getWorldPosition(b); const pa = l.geometry.attributes.position; pa.setXYZ(0, a.x, a.y, a.z); pa.setXYZ(1, b.x, b.y, b.z); pa.needsUpdate = true; });
      cap('橙色短线是 13 个刚体的位置差。柱高按加权后数值的平方根画（角速度用 6D 旋转的差分近似）。速度项系数小，但在起跳、落地时会冒出来');
    } };
  }

  /* ---------- scene 4: BPTT toy ---------- */
  function s4(G) {
    let ai = +(OPT[0] ?? 2);
    const T = 40, X0 = -5.8, XW = 11.6, dx = XW / T, Y0 = 0.2, sy = v => Y0 + 0.55 * (v + 2);
    panel(G, X0 - 0.6, Y0 - 0.7, -0.4, XW + 1.0, 5.0);
    [-2, 0, 2, 4].forEach(v => { wire(G, [[X0, sy(v), -0.3], [X0 + XW, sy(v), -0.3]], 0x5a6680, { opacity: 0.4 }); G.add(lab(v === 0 ? '1' : `10^${v}`, [X0 - 0.35, sy(v), 0], { size: 12 })); });
    const bars = Array.from({ length: T }, (_, t) => bar(G, COL.grad, X0 + dx * (t + 0.5), dx * 0.7, Y0, 0));
    [0, 10, 20, 30, 39].forEach(t => G.add(lab(`t=${t}`, [X0 + dx * (t + 0.5), Y0 - 0.35, 0], { size: 12 })));
    const head = ball(COL.grad, 0.16, [0, 0, 0.3], { emissive: 0x553311 }); G.add(head);
    const ttl = dynLab(G, [0, sy(4) + 0.55, 0], { size: 16 });
    const ctls = [{ label: '雅可比 a', items: ['0.9（消失）', '1.0', '1.1（爆炸）'], get: () => ai, set: k => { ai = k; } }];
    return { ctls, update(p) {
      const g = BP[ai], q = seg(p, 0.05, 0.8), k = Math.floor((1 - q) * T);
      for (let t = 0; t < T; t++) bars[t](t >= k ? Math.max(0.03, 0.55 * (Math.log10(g[t] + 1e-12) + 2)) : 0.02);
      head.position.set(X0 + dx * (clamp(k, 0, T - 1) + 0.5), sy(Math.log10(g[clamp(k, 0, T - 1)])) + 0.25, 0.3);
      const r = g[0] / g[T - 1];
      ttl(`a = ${[0.9, 1.0, 1.1][ai]}：|∂L/∂u₀| / |∂L/∂u₃₉| = ${r < 0.01 || r > 100 ? r.toExponential(1) : r.toFixed(2)}`);
      cap(ai === 0 ? '反向一步乘一次 a = 0.9：远处的误差传到开头已经很小，前面的动作几乎学不到后面的事' : ai === 2 ? '反向一步乘一次 a = 1.1：开头几步的梯度被放大上百倍，靠梯度裁剪（代码 0.4）才稳住' : 'a = 1：每一步的误差原样累加，开头的梯度最大');
    } };
  }

  /* ---------- scene 5: local minimum ---------- */
  function s5(G) {
    let rep = +(OPT[0] ?? 0);
    const X0 = -6, XW = 9.0, sx = th => X0 + XW * th / 2.2, sy = v => 0.4 + 2.6 * v;
    const f0 = th => 0.55 - 0.32 * Math.exp(-Math.pow((th - 0.35) / 0.22, 2)) + 0.28 * Math.exp(-Math.pow((th - 0.95) / 0.25, 2)) - 0.5 * Math.exp(-Math.pow((th - 1.7) / 0.3, 2));
    const f1 = th => 0.55 - 0.32 * Math.exp(-Math.pow((th - 0.35) / 0.22, 2)) + 0.06 * Math.exp(-Math.pow((th - 0.95) / 0.25, 2)) - 0.5 * Math.exp(-Math.pow((th - 1.7) / 0.3, 2)) - 0.12 * th;
    const N = 160, pts = f => Array.from({ length: N }, (_, i) => { const th = 2.2 * i / (N - 1); return [sx(th), sy(f(th)), 0]; });
    const r0 = ribbon(G, N, 0x9aa6bf, 0.06); r0.userData.set(pts(f0)); const r1 = ribbon(G, N, COL.replay, 0.06); r1.userData.set(pts(f1));
    wire(G, [[X0, 0.3, 0], [X0 + XW, 0.3, 0]], 0x5a6680, { opacity: 0.6 });
    G.add(lab('起跳力度（示意的一维参数）', [X0 + XW / 2, -0.05, 0], { size: 14 }), lab('代价', [X0 - 0.4, 3.4, 0], { size: 14 }));
    G.add(lab('局部极小：手撑地', [sx(0.35), sy(f0(0.35)) - 0.45, 0], { size: 14, color: '#e05d5d' }), lab('全局：起跳后翻', [sx(1.7), sy(f0(1.7)) - 0.45, 0], { size: 14, color: '#4fc98a' }));
    const b = ball(COL.lrn, 0.17, [0, 0, 0.1], { emissive: 0x113355 }); G.add(b);
    const R2 = robot(COL.robot); G.add(R2);
    const ctls = [{ label: '代价面', items: ['只用全程梯度', '加示范回放（示意）'], get: () => rep, set: k => { rep = k; } }];
    return { ctls, update(p) {
      const f = rep ? f1 : f0; r1.visible = rep === 1; r0.material.opacity = rep ? 0.35 : 1; r0.material.transparent = true;
      let th = 0.02; const n = Math.round(seg(p, 0.05, 0.8) * 120); const d = 1e-3;
      for (let i = 0; i < n; i++) { const g = (f(th + d) - f(th - d)) / (2 * d); th = clamp(th - 0.05 * g, 0, 2.2); }
      b.position.set(sx(th), sy(f(th)) + 0.17, 0.1);
      const flip = backflip((p * 1.3) % 1); place(R2, flip, [4.6, 0.1, -0.5], 1.4, 1.2); R2.visible = th > 1.2;
      cap(th < 1.2 ? '梯度下降从“不跳”出发，<b>停在手撑地的谷里</b>：只要不起跳，后半段就不会摔得更远，局部看这是更低的点' : '削低中间的坎（示意）后，同样的梯度下降能<b>翻过去</b>，学会起跳');
    } };
  }

  /* ---------- scene 6: truncation ---------- */
  function s6(G) {
    let tr = +(OPT[0] ?? 1);
    const N = 30, X0 = -6.6, dx = 13.2 / (N - 1), Y = 2.4, X = i => X0 + dx * i;
    const st = Array.from({ length: N }, (_, i) => { const m = ball(COL.lrn, 0.13, [X(i), Y, 0]); G.add(m); return m; });
    wire(G, [[X(0), Y, 0], [X(N - 1), Y, 0]], 0xdfe6f3, { opacity: 0.6 });
    const cuts = [10, 20].map(i => { const m = block(0.08, 1.0, 0.5, COL.bad, [(X(i - 1) + X(i)) / 2, Y, 0]); G.add(m); return m; });
    const cutL = [10, 20].map(i => { const s = lab('stop_gradient', [(X(i - 1) + X(i)) / 2, Y + 0.8, 0], { size: 12, color: '#e05d5d' }); G.add(s); return s; });
    const fl = [stream(G, 8, COL.grad, 0.08), stream(G, 8, COL.grad, 0.08), stream(G, 8, COL.grad, 0.08), stream(G, 20, COL.grad, 0.08)];
    G.add(lab('起跳', [X(5), Y - 0.55, 0], { size: 13 }), lab('空中后翻', [X(15), Y - 0.55, 0], { size: 13 }), lab('落地', [X(25), Y - 0.55, 0], { size: 13 }));
    const D = [['后空翻', 0.189, 0.147], ['侧手翻', 0.245, 0.152]];
    G.add(lab('图 7(a)(b) 最后 10 点平均姿态误差', [-1.0, 0.95, 0], { size: 14 }));
    const bs = D.flatMap(([t, a, b], i) => { const x = -2.4 + i * 3.2; G.add(lab(t, [x + 0.45, -1.95, 0], { size: 13 }), lab(a.toFixed(3), [x - 0.1, -1.6 + a * 6 + 0.3, 0], { size: 12 }), lab(b.toFixed(3), [x + 1.0, -1.6 + b * 6 + 0.3, 0], { size: 12 })); return [[bar(G, COL.bad, x, 0.5, -1.6), a], [bar(G, COL.ok, x + 0.9, 0.5, -1.6), b]]; });
    G.add(lab('截断 10 步', [-4.6, -0.5, 0], { size: 13, color: '#e05d5d' }), lab('全程', [-4.6, -1.1, 0], { size: 13, color: '#4fc98a' }));
    const ctls = [{ label: '梯度', items: ['全程', '每 10 步截断'], get: () => tr, set: k => { tr = k; } }];
    return { ctls, update(p) {
      cuts.forEach(c => { c.visible = tr === 1; }); cutL.forEach(c => { c.visible = tr === 1; });
      const ph = 1 - (p * 3) % 1;
      if (tr === 1) { fl[0]([[X(9), Y + 0.25, 0], [X(0), Y + 0.25, 0]], ph, 1); fl[1]([[X(19), Y + 0.25, 0], [X(10), Y + 0.25, 0]], ph, 1); fl[2]([[X(29), Y + 0.25, 0], [X(20), Y + 0.25, 0]], ph, 1); fl[3]([[0, 0, 0], [0, 0, 0]], 0, 0); }
      else { fl[0]([[0, 0, 0], [0, 0, 0]], 0, 0); fl[1]([[0, 0, 0], [0, 0, 0]], 0, 0); fl[2]([[0, 0, 0], [0, 0, 0]], 0, 0); fl[3]([[X(29), Y + 0.25, 0], [X(0), Y + 0.25, 0]], ph, 1); }
      const g = seg(p, 0.1, 0.6); bs.forEach(([f, v]) => f(v * 6 * g));
      cap(tr === 1 ? '截断后，起跳那一段的梯度<b>只看得到前 10 步</b>的误差，看不到空中翻没翻过去' : '全程反传：起跳的动作能收到空翻和落地阶段的误差，但链条长，梯度容易爆炸或消失');
    } };
  }

  /* ---------- scenes 7 and 8: replacement on a toy trajectory ---------- */
  function replayScene(G, mode) {
    let k = +(OPT[0] ?? (mode === 'thr' ? 0 : 1));
    const PAR = mode === 'thr' ? [0.1, 0.2, 0.4] : [0.05, 0.1, 0.15];
    const runs = PAR.map(v => replayToy(mode, v));
    const X0 = -6.6, XW = 13.2, X = t => X0 + XW * t / (NF - 1), REFY = t => 2.5 + 0.9 * Math.sin(Math.PI * clamp((t - 14) / 26, 0, 1)), SCL = 2.4, OFF = e => SCL * Math.min(e, 0.75);
    const refR = ribbon(G, NF, COL.ref, 0.05, { opacity: 0.9 }); refR.userData.set(Array.from({ length: NF }, (_, t) => [X(t), REFY(t), 0]));
    const pts = inst(BALL, NF); G.add(pts); pts.material.color.setHex(0xffffff);
    for (let t = 0; t < NF; t++) pts.setColorAt(t, _C.setHex(COL.lrn));
    const tubes = []; for (let i = 0; i < 14; i++) { const r = ribbon(G, NF, COL.grad, 0.2, { opacity: 0.7, order: 1 }); tubes.push(r); }
    const ins = Array.from({ length: 14 }, () => { const l = L.line([[0, 0, 0], [0, 1, 0]], 0x9aa6bf, { opacity: 0.95 }); G.add(l); return l; });
    G.add(lab('橙色：一段连着的梯度链', [X0 + 2.2, 4.15, 0], { size: 13, color: css(COL.grad) }), lab('黄点：被替换，下一步从 ŝ 起步', [X0 + 2.6, 3.65, 0], { size: 13, color: css(COL.replay) }));
    /* error-per-frame strip */
    const EY = 0.0, EH = 1.3, ey = v => EY + EH * Math.min(1, v / 0.5);
    panel(G, X0 - 0.3, EY - 0.35, -0.1, XW + 0.6, EH + 0.6);
    const er = ribbon(G, NF, COL.lrn, 0.04); const thrL = wire(G, [[X0, 0, 0.02], [X0 + XW, 0, 0.02]], COL.replay, { dashed: true, opacity: 0.9 });
    G.add(lab('每帧误差（损失看到的）', [X0 + 1.6, EY + EH + 0.15, 0], { size: 13 }), lab('参考 ŝ', [X0 + XW + 0.5, REFY(NF - 1), 0], { size: 14, color: css(COL.ref) }));
    G.add(lab('腾空段 18–36', [X(27), EY + EH + 0.15, 0.05], { size: 12 }));
    const info = dynLab(G, [3.4, 4.15, 0], { size: 14, border: 'rgba(242,193,78,.7)' });
    const thrLab = mode === 'thr' ? PAR.map(v => { const s = lab(`ε = ${v}`, [X0 + XW + 0.15, ey(v), 0.05], { size: 12, color: css(COL.replay) }); G.add(s); return s; }) : [];
    /* Figure 3 style figures */
    const figs = mode === 'thr' ? [8, 18, 26, 34, 46].map(t => { const a = robot(COL.ref, { opacity: 0.3 }), b = robot(COL.lrn); G.add(a, b); return { t, a, b }; }) : [];
    const ctls = [{ label: mode === 'thr' ? '阈值 ε' : '比例 γ', items: PAR.map(String), get: () => k, set: v => { k = v; } }];
    return { ctls, update(p) {
      const R = runs[k], n = Math.max(1, Math.round(seg(p, 0.03, 0.85) * NF)), repIdx = R.rep.map((x, i) => (x ? i : -1)).filter(i => i >= 0);
      for (let t = 0; t < NF; t++) {
        const on = t < n, y = REFY(t) - OFF(R.seen[t]);
        setI(pts, t, [X(t), y, 0.05], on ? (R.rep[t] ? 0.13 : 0.08) : 0.0001);
        pts.setColorAt(t, _C.setHex(R.rep[t] ? COL.replay : COL.lrn));
      }
      done(pts);
      /* gradient chains: maximal runs without replacement inside; a replaced frame starts a new chain */
      const chains = []; let s0 = 0; for (let t = 1; t < n; t++) if (R.rep[t]) { chains.push([s0, t]); s0 = t; } chains.push([s0, n - 1]);
      tubes.forEach((tb, i) => { const c = chains[i]; tb.visible = !!c && p > 0.15; if (!c) return; const a = c[0], b = Math.max(c[0] + 1, c[1]); tb.userData.set(Array.from({ length: b - a + 1 }, (_, j) => [X(a + j), REFY(a + j) - (j === 0 && R.rep[a] ? 0 : OFF(R.seen[a + j])), -0.02])); });
      ins.forEach((l, i) => { const t = repIdx[i]; l.visible = t != null && t < n; if (!l.visible) return; const pa = l.geometry.attributes.position; pa.setXYZ(0, X(t), REFY(t) - OFF(R.seen[t]), 0.03); pa.setXYZ(1, X(t), REFY(t), 0.03); pa.needsUpdate = true; });
      er.userData.set(R.seen.slice(0, n).map((v, t) => [X(t), ey(v), 0.02]));
      thrL.visible = mode === 'thr'; if (mode === 'thr') thrL.position.y = ey(PAR[k]); thrLab.forEach((s, i) => { s.visible = i === k; });
      info(`${mode === 'thr' ? 'ε' : 'γ'} = ${PAR[k]}：替换 ${R.n} 次，最大误差 ${R.max.toFixed(3)}，平均 ${R.mean.toFixed(3)}`);
      figs.forEach(({ t, a, b }) => { const q = backflip(t / NF), at = [X(t), -1.75, 0.3]; place(a, q, at, 1.5708, 0.9); const sw = R.rep[t] && t < n; place(b, { ...q, pitch: q.pitch + (sw ? 0 : 3 * Math.min(R.seen[t], 0.6)) }, at, 1.5708, 0.9); b.visible = t < n; });
      cap(mode === 'thr' ? `超过 ε 的那一帧<b>照样计入损失</b>，下一步从参考起步；黄点处梯度链断开。ε 越小，链越短` : `替换和误差无关：γ = ${PAR[k]} 时替换 ${R.n} 次，但第 18 到 36 帧（腾空段）没换到的地方误差照样冲高`);
    } };
  }
  const s7 = G => replayScene(G, 'rnd'), s8 = G => replayScene(G, 'thr');

  /* ---------- scene 9: Figures 7 and 8 ---------- */
  function s9(G) {
    let v = +(OPT[0] ?? 0);
    const X0 = -6.2, XW = 9.0, Y0 = 0.2, YH = 3.4, A = new THREE.Group(), B = new THREE.Group(); G.add(A, B);
    panel(G, X0 - 0.5, Y0 - 0.6, -0.05, XW + 0.9, YH + 1.3);
    const sx8 = i => X0 + XW * i / 53, sy8 = y => Y0 + YH * y / 0.36;
    [0, 0.1, 0.2, 0.3].forEach(y => { wire(A, [[X0, sy8(y), 0], [X0 + XW, sy8(y), 0]], 0x5a6680, { opacity: 0.4 }); A.add(lab(y.toFixed(1), [X0 - 0.3, sy8(y), 0], { size: 12 })); });
    [0, 10, 20, 30, 40, 50].forEach(i => A.add(lab(String(i), [sx8(i), Y0 - 0.28, 0], { size: 12 })));
    A.add(lab('帧号（后空翻一个周期 54 帧）', [X0 + XW / 2, Y0 - 0.6, 0], { size: 13 }));
    const S8 = [['full', '全程', 0xd95926], ['rnd', '随机 γ=0.05', 0x199e70], ['thr', '阈值 ε=0.4', 0xa067d8]];
    const r8 = S8.map(([k, t, c]) => ribbon(A, 54, c, 0.05));
    S8.forEach(([k, t, c], i) => A.add(lab(t, [X0 + XW - 1.2, sy8(0.33 - i * 0.04), 0], { size: 13, color: css(c) })));
    /* Table 7 bars computed from the curves */
    const worst = (a, kk) => [...a].sort((x, y) => y - x).slice(0, kk).reduce((s, x) => s + x, 0) / kk;
    const tb = S8.map(([k, t, c], i) => [1, 3, 6].map((kk, j) => { const x = 4.0 + i * 0.95 + j * 0.27; return { f: bar(A, c, x, 0.22, Y0), v: worst(F8[k], kk) }; }));
    A.add(lab('最差 1 / 3 / 6 帧平均\n（= 表 7）', [4.95, Y0 + YH + 0.3, 0], { size: 13 }));
    S8.forEach(([k, t, c], i) => A.add(lab(worst(F8[k], 1).toFixed(3), [4.27 + i * 0.95, Y0 - 0.28, 0], { size: 11 })));
    /* Figure 7 backflip curves (c) and (e) */
    const sx7 = i => X0 + XW * i / 49, sy7 = y => Y0 + YH * y / 0.6;
    [0, 0.2, 0.4, 0.6].forEach(y => { wire(B, [[X0, sy7(y), 0], [X0 + XW, sy7(y), 0]], 0x5a6680, { opacity: 0.4 }); B.add(lab(y.toFixed(1), [X0 - 0.3, sy7(y), 0], { size: 12 })); });
    [0, 4, 8, 12, 16].forEach(m => B.add(lab(`${m}M`, [X0 + XW * m / 15.876, Y0 - 0.28, 0], { size: 12 })));
    wire(B, [[X0 + XW * 1.621 / 15.876, Y0, 0.01], [X0 + XW * 1.621 / 15.876, Y0 + YH, 0.01]], 0x9aa6bf, { dashed: true, opacity: 0.8 });
    B.add(lab('10 分钟', [X0 + XW * 1.621 / 15.876 + 0.55, Y0 + YH - 0.2, 0], { size: 12 }));
    const r7 = [0, 1, 2, 3].map(i => ribbon(B, 50, [0xd95926, 0x3987e5, 0x199e70, 0xc98500][i], 0.04));
    const l7 = [0, 1, 2, 3].map(i => dynLab(B, [X0 + XW + 1.6, sy7(0.55 - i * 0.07), 0], { size: 12, color: css([0xd95926, 0x3987e5, 0x199e70, 0xc98500][i]) }));
    const ttl = dynLab(G, [X0 + XW / 2, Y0 + YH + 0.35, 0], { size: 15 });
    const ctls = [{ label: '看', items: ['图 8 逐帧', '图 7(c) 随机', '图 7(e) 阈值'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      A.visible = v === 0; B.visible = v !== 0;
      const n = Math.max(2, Math.round(seg(p, 0.03, 0.8) * 54)), g = seg(p, 0.5, 0.9);
      if (v === 0) {
        S8.forEach(([k], i) => r8[i].userData.set(F8[k].slice(0, n).map((y, t) => [sx8(t), sy8(y), 0.02 + 0.01 * i])));
        tb.forEach(row => row.forEach(({ f, v: val }) => f(YH * val / 0.36 * g)));
        ttl('图 8：最终策略的逐帧 L2 误差（矢量读数）');
        cap('三条线的<b>平均</b>只差 0.04（0.064 / 0.029 / 0.023），<b>峰值</b>差三倍：0.357 / 0.195 / 0.112');
      } else {
        const C = v === 1 ? FIG7C : FIG7E, NM = v === 1 ? ['全程', 'γ=0.01', 'γ=0.05', 'γ=0.1'] : ['γ=0.05（随机）', 'ε=0.1', 'ε=0.2', 'ε=0.4'];
        const m = Math.max(2, Math.round(seg(p, 0.03, 0.8) * 50));
        C.forEach((s, i) => { r7[i].userData.set(s.slice(0, m).map((y, t) => [sx7(t), sy7(y), 0.02 + 0.01 * i])); l7[i](`${NM[i]} ${(s.slice(-10).reduce((a, b) => a + b, 0) / 10).toFixed(3)}`); });
        ttl(v === 1 ? '图 7(c) 后空翻：随机回放对全程（右侧是最后 10 点平均）' : '图 7(e) 后空翻：阈值回放对随机 γ = 0.05');
        cap(v === 1 ? '随机比例只有 0.05 明显好；0.01 几乎等于全程，0.1 又变差' : 'ε = 0.4 和随机 γ = 0.05 末段相近（0.091 对 0.088）；ε = 0.1 后段抖得厉害');
      }
    } };
  }
  /* Figure 7 backflip (c) and (e), 50 points each, vector read */
  const FIG7C = [[0.449,0.388,0.357,0.311,0.267,0.203,0.197,0.192,0.185,0.194,0.17,0.191,0.174,0.179,0.168,0.193,0.18,0.173,0.169,0.158,0.169,0.159,0.152,0.178,0.16,0.159,0.152,0.156,0.157,0.171,0.182,0.166,0.147,0.158,0.152,0.154,0.148,0.187,0.157,0.152,0.155,0.146,0.147,0.149,0.144,0.143,0.15,0.143,0.147,0.142],[0.449,0.396,0.362,0.326,0.242,0.201,0.19,0.177,0.173,0.17,0.168,0.169,0.164,0.168,0.159,0.162,0.164,0.158,0.169,0.157,0.157,0.178,0.179,0.161,0.156,0.154,0.15,0.151,0.163,0.159,0.154,0.188,0.166,0.156,0.162,0.147,0.147,0.147,0.145,0.14,0.149,0.152,0.138,0.158,0.137,0.142,0.14,0.136,0.136,0.143],[0.449,0.396,0.299,0.25,0.188,0.142,0.124,0.13,0.111,0.117,0.113,0.11,0.106,0.107,0.107,0.106,0.1,0.11,0.103,0.101,0.126,0.129,0.106,0.101,0.103,0.105,0.101,0.1,0.101,0.11,0.099,0.092,0.101,0.096,0.088,0.087,0.093,0.09,0.091,0.087,0.098,0.089,0.089,0.096,0.086,0.087,0.084,0.084,0.087,0.082],[0.449,0.385,0.333,0.281,0.257,0.24,0.226,0.224,0.22,0.21,0.203,0.198,0.196,0.195,0.171,0.179,0.171,0.171,0.146,0.137,0.129,0.135,0.141,0.122,0.121,0.128,0.114,0.112,0.117,0.113,0.108,0.114,0.109,0.116,0.114,0.118,0.111,0.114,0.118,0.112,0.118,0.109,0.114,0.108,0.107,0.107,0.109,0.114,0.106,0.11]];
  const FIG7E = [[0.449,0.396,0.299,0.25,0.188,0.142,0.124,0.13,0.111,0.117,0.113,0.11,0.106,0.107,0.107,0.106,0.1,0.11,0.103,0.101,0.126,0.129,0.106,0.101,0.103,0.105,0.101,0.1,0.101,0.11,0.099,0.092,0.101,0.096,0.088,0.087,0.093,0.09,0.091,0.087,0.098,0.089,0.089,0.096,0.086,0.087,0.084,0.084,0.087,0.082],[0.449,0.403,0.391,0.352,0.276,0.295,0.282,0.293,0.269,0.204,0.267,0.28,0.265,0.256,0.251,0.298,0.24,0.2,0.239,0.232,0.29,0.263,0.232,0.154,0.275,0.299,0.288,0.166,0.164,0.199,0.172,0.216,0.199,0.145,0.319,0.206,0.151,0.203,0.24,0.143,0.127,0.159,0.225,0.17,0.133,0.136,0.151,0.102,0.112,0.188],[0.449,0.406,0.365,0.29,0.172,0.153,0.293,0.152,0.258,0.253,0.28,0.253,0.128,0.142,0.19,0.162,0.136,0.194,0.307,0.157,0.141,0.282,0.2,0.169,0.141,0.136,0.126,0.157,0.135,0.17,0.151,0.242,0.282,0.272,0.263,0.31,0.274,0.167,0.289,0.175,0.163,0.124,0.121,0.172,0.135,0.118,0.1,0.098,0.101,0.089],[0.449,0.399,0.371,0.272,0.249,0.244,0.133,0.134,0.128,0.12,0.12,0.126,0.139,0.149,0.111,0.103,0.102,0.102,0.11,0.113,0.153,0.111,0.098,0.098,0.092,0.092,0.091,0.108,0.101,0.119,0.126,0.117,0.144,0.104,0.107,0.098,0.097,0.09,0.089,0.095,0.101,0.095,0.089,0.09,0.098,0.089,0.087,0.089,0.087,0.083]];

  /* ---------- scene 10: analytic gradient vs RL estimate ---------- */
  function s10(G) {
    let ni = +(OPT[0] ?? 0);
    const X0 = -6.6, XW = 7.0, Y0 = 0.2, sx = g => X0 + XW * (g + 4) / 12, NB = 40;
    panel(G, X0 - 0.4, Y0 - 0.7, -0.05, XW + 0.8, 4.6);
    [-4, -1, 2, 5, 8].forEach(g => G.add(lab(String(g), [sx(g), Y0 - 0.3, 0], { size: 12 })));
    G.add(lab('梯度估计值（真值 2）', [X0 + XW / 2, Y0 - 0.62, 0], { size: 13 }));
    wire(G, [[sx(2), Y0, 0.03], [sx(2), Y0 + 3.6, 0.03]], COL.dm, { opacity: 1 });
    G.add(lab('解析梯度 = 2.000（一次就准）', [sx(2) + 1.6, Y0 + 3.15, 0], { size: 13, color: css(COL.dm) }));
    const hb = Array.from({ length: NB }, (_, i) => bar(G, COL.rl, X0 + XW * (i + 0.5) / NB, XW / NB * 0.85, Y0));
    const sd = dynLab(G, [sx(2) + 1.6, Y0 + 2.6, 0], { size: 13, color: css(COL.rl) });
    /* Table 2 bars */
    const T2 = [['后空翻', 31.18, 14.88], ['侧手翻', 30.45, 13.92], ['走', 23.80, 7.92], ['跑', 19.31, 8.16], ['跳', 25.65, 5.28], ['舞', 24.59, 16.56]];
    G.add(lab('表 2：滚 20 秒不摔所需样本（百万）', [4.25, 4.1, 0], { size: 14 }));
    const tb = T2.map(([t, a, b], i) => { const x = 1.6 + i * 0.95; G.add(lab(t, [x + 0.15, -0.15, 0], { size: 12 })); return [[bar(G, COL.rl, x, 0.3), a], [bar(G, COL.dm, x + 0.32, 0.3), b]]; });
    G.add(lab('DeepMimic', [2.4, 3.55, 0], { size: 12, color: css(COL.rl) }), lab('DiffMimic', [4.1, 3.55, 0], { size: 12, color: css(COL.dm) }));
    const ctls = [{ label: 'RL 每次样本数 N', items: ['8', '64', '512'], get: () => ni, set: k => { ni = k; } }];
    return { ctls, update(p) {
      const est = RL[ni], m = Math.max(1, Math.round(seg(p, 0.03, 0.7) * est.length)), H = new Array(NB).fill(0);
      for (let i = 0; i < m; i++) { const b = Math.floor((est[i] + 4) / 12 * NB); if (b >= 0 && b < NB) H[b]++; }
      H.forEach((h, i) => hb[i](h * 0.06));
      sd(`RL：${m} 次估计，标准差 ${stdv(est.slice(0, m)).toFixed(2)}`);
      const g = seg(p, 0.4, 0.9); tb.forEach(row => row.forEach(([f, v]) => f(v * 0.1 * g)));
      cap(`似然比估计要 N 个样本平均，N = ${[8, 64, 512][ni]} 时标准差 ${stdv(est).toFixed(2)}（约按 1/√N 下降）；解析梯度没有这个方差`);
    } };
  }

  /* ---------- scene 11: training loop in the released code ---------- */
  function s11(G) {
    let v = +(OPT[0] ?? 1);
    const A = new THREE.Group(), B = new THREE.Group(); G.add(A, B);
    const P = [[-6.4, 2.6], [-3.2, 2.6], [0, 2.6], [3.2, 2.6], [6.4, 2.6], [6.4, 0.0], [3.2, 0.0]];
    const cols = [0xe0607a, COL.sim, COL.grad, 0xf2c14e, COL.pol, 0x7cb8ff, 0x4fc98a];
    const bx = P.map((q, i) => { const b = block(2.1, 0.9, 0.7, cols[i], [q[0], q[1], 0]); A.add(b); return b; });
    const TXT = [
      ['起点：参考第一帧', '滚动：200 环境 × 120 步（4 s）', '损失：Σ‖s − ŝ‖²', '裁剪：全局范数 0.3', 'Adam 3e-4 线性下降', '循环动作 5000 次迭代', '评估：20 s，DTW'],
      ['起点：RSI 随机帧\n[0, 600 − 60]', '滚动：300 环境 × 59 步\njax.lax.scan', '损失：mean(…) × 0.02\njax.grad', '裁剪：全局范数 0.4', 'Adam 3e-4 → 1e-5', '1000 次迭代', '评估：32 × 599 步\n无 DTW，存最好']];
    const labs = P.map((q, i) => dynLab(A, [q[0], q[1] + 1.0, 0], { size: 12 }));
    const fl = stream(A, 10, 0xffffff, 0.07);
    const T1 = [['后空翻', 0.076, 0.150, 0.097], ['侧手翻', 0.039, 0.067, 0.040], ['爬', 0.044, 0.049, 0.037], ['舞', 0.038, 0.055, 0.070], ['慢跑', 0.029, 0.056, 0.031], ['跳', 0.033, 0.083, 0.025], ['翻滚', 0.072, 0.088, 0.061], ['跑', 0.028, 0.075, 0.039], ['侧空翻', 0.191, 0.124, 0.069], ['旋风踢', 0.042, 0.058, 0.056], ['走', 0.018, 0.030, 0.017], ['僵尸', 0.049, 0.058, 0.037]];
    B.add(lab('表 1：姿态误差（米，20 s，32 回合）', [0, 4.2, 0], { size: 15 }));
    const tb = T1.map(([t, a, b, c], i) => { const x = -6.2 + i * 1.12; B.add(lab(t, [x + 0.24, -0.25, 0], { size: 12 })); return [[bar(B, COL.rl, x, 0.22), a], [bar(B, COL.amp, x + 0.24, 0.22), b], [bar(B, COL.dm, x + 0.48, 0.22), c]]; });
    B.add(lab('DeepMimic', [-3.0, 3.55, 0], { size: 12, color: css(COL.rl) }), lab('AMP', [-1.2, 3.55, 0], { size: 12, color: css(COL.amp) }), lab('DiffMimic', [0.6, 3.55, 0], { size: 12, color: css(COL.dm) }));
    const ctls = [{ label: '看', items: ['论文设定', '代码设定', '表 1'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      A.visible = v !== 2; B.visible = v === 2;
      if (v !== 2) {
        TXT[v].forEach((t, i) => labs[i](t));
        const k = Math.floor((p * 7) % 7); bx.forEach((b, i) => glow(b, i === k ? 0.6 : 0.05));
        fl(P.map(q => [q[0], q[1], 0.45]), (p * 2) % 1, 1);
        cap(v === 0 ? '论文（算法 1、附录 C）：从第一帧起步，4 秒滚动，200 环境，5000 次；表 2 的样本数是 200 × 120 的整数倍' : '代码（configs/AMP/*_20s.yaml）：<b>RSI</b> 起步、59 步、300 环境、1000 次、裁剪 0.4；每次迭代都做一次 20 秒评估');
      } else {
        const g = seg(p, 0.05, 0.6); tb.forEach(row => row.forEach(([f, val]) => f(val * 16 * g)));
        cap('DiffMimic 对 DeepMimic 6 比 6；对 AMP 只有“舞”一项落后。侧空翻上 DeepMimic 的 0.191 是离群值');
      }
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player (same as interactives/latent and interactives/rpl) ---------- */
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
  window.__dmDebug = { BP, PD, runs: { rnd: [0.05, 0.1, 0.15].map(v => replayToy('rnd', v)), thr: [0.1, 0.2, 0.4].map(v => replayToy('thr', v)) }, get cap() { return $('cap').textContent; } };
})();
