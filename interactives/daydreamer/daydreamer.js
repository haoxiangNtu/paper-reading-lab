'use strict';
/* DayDreamer (arXiv 2206.14176) taken apart into eleven scenes. Sizes come from the paper's Appendix D and from the
   official code (github.com/danijar/daydreamer 709016c). Curve values are read from the vector data of Figures 4 to 7
   (pdftocairo -svg, calibrated on the tick marks); the sunrise run comes from scores/xarm_adapt.csv in the same repo.
   Everything marked toy is computed on this page and is not a network. update(p) is a pure function of the timeline p. */
const DATA = {"a1_or":[[1.51,5.176],[3.03,5.035],[4.54,5.035],[6.06,5.034],[7.58,5.037],[10.61,5.043],[12.12,5.042],[13.63,5.049],[15.15,5.915],[16.67,6.973],[18.18,7.374],[19.7,7.365],[21.22,7.042],[22.73,7.22],[24.25,7.036],[25.76,7.512],[27.28,7.534],[28.79,7.183],[30.31,7.374],[31.82,7.602],[33.34,7.698],[34.85,7.53],[36.37,7.486],[37.88,7.313],[39.4,7.607],[40.92,7.539],[42.43,6.563],[43.95,7.114],[45.46,7.718],[46.98,7.5],[48.49,7.838],[50.01,7.408],[51.52,7.62],[53.04,6.631],[54.56,7.125],[56.07,7.823],[57.59,7.638],[59.1,7.912]],"a1_blue":[[1.51,5.159],[3.03,5.06],[4.54,5.06],[6.06,5.057],[7.58,5.119],[9.09,6.186],[10.61,6.278],[12.12,5.346],[13.63,5.1],[15.15,5.585],[16.67,5.103],[18.18,5.312],[19.7,5.75],[21.22,5.928],[22.73,5.936],[24.25,7.913],[25.76,8.432],[27.28,8.193],[28.79,6.966],[30.31,5.568],[31.82,7.513],[33.34,9.411],[34.85,9.149],[36.37,9.557],[37.88,9.812],[39.4,7.484],[40.92,8.054],[42.43,6.294],[43.95,8.23],[45.46,9.15],[46.98,8.732],[48.49,10.282],[50.01,9.075],[51.52,8.262],[53.04,10.985],[54.56,11.118],[56.07,10.638],[57.59,10.193],[59.1,10.721]],"ur5_gr":[[0.23,0.067],[0.47,0.18],[0.71,0.0],[0.94,0.06],[1.18,0.006],[1.41,0.133],[1.65,0.186],[1.88,0.2],[2.12,0.06],[2.35,0.3],[2.59,0.067],[2.82,0.246],[3.06,0.067],[3.29,0.24],[3.53,0.0],[3.76,0.34],[4.0,0.12],[4.24,0.133],[4.47,0.306],[4.71,0.3],[4.94,0.067],[5.18,0.3],[5.41,0.406],[5.65,0.24],[5.88,0.3],[6.12,0.334],[6.35,0.06],[6.59,0.133],[6.82,0.3],[7.06,0.18],[7.29,0.2],[7.53,0.12],[7.76,0.0],[8.0,0.2]],"ur5_or":[[0.23,0.0],[0.47,0.011],[0.71,0.085],[0.94,0.0],[1.18,0.06],[1.41,0.0],[2.35,0.0],[2.59,0.006],[2.82,0.0],[4.24,0.0],[4.47,0.006],[4.71,0.0],[4.94,0.067],[5.18,0.067]],"ur5_blue":[[0.23,0.067],[0.47,0.126],[0.71,0.133],[0.94,0.126],[1.18,0.2],[1.41,0.06],[1.65,0.133],[1.88,0.126],[2.12,0.2],[2.35,0.0],[2.59,0.8],[2.82,0.0],[3.06,0.72],[3.29,0.66],[3.53,0.467],[3.76,0.606],[4.0,0.933],[4.24,0.246],[4.47,0.667],[4.71,0.851],[4.94,0.78],[5.18,1.0],[5.41,1.506],[5.65,1.4],[5.88,1.8],[6.12,1.206],[6.35,2.466],[6.59,1.606],[6.82,2.04],[7.06,2.534],[7.29,2.04],[7.53,2.067],[7.76,2.046],[8.0,2.479]],"xarm_or":[[0.34,0.06],[0.69,-0.0],[2.76,-0.0],[3.1,0.005],[3.45,0.005],[3.79,-0.0],[4.48,-0.0],[4.83,0.06],[5.17,0.005],[5.52,0.005],[5.86,-0.0],[7.24,-0.0],[7.59,0.005],[7.93,-0.0],[10.0,-0.0]],"xarm_blue":[[0.34,0.06],[0.69,0.125],[1.03,0.06],[1.38,-0.0],[1.72,0.054],[2.07,0.06],[2.41,-0.0],[2.76,0.18],[3.1,0.382],[3.45,0.06],[3.79,0.06],[4.14,0.185],[4.48,0.06],[4.83,-0.0],[5.17,0.06],[5.52,-0.0],[5.86,0.218],[6.21,0.54],[6.55,0.3],[6.9,0.12],[7.24,0.392],[7.59,0.665],[7.93,0.665],[8.28,2.231],[8.62,1.145],[8.97,3.12],[9.31,2.291],[9.66,1.505],[10.0,2.955]],"sphero_or":[[4.48,0.824],[8.96,0.44],[13.45,0.569],[17.93,1.054],[22.41,0.824],[26.9,0.379],[31.38,0.453],[35.86,0.369],[40.34,0.244],[44.83,0.236],[49.31,0.233],[53.8,0.313],[58.28,0.27],[62.76,0.258],[67.24,0.265],[71.72,0.219],[76.21,0.209],[80.69,0.24],[85.18,0.311],[89.66,0.375],[94.14,0.249],[98.62,0.317],[103.11,0.405],[107.59,0.353],[112.07,0.287],[116.56,0.313],[121.04,0.239],[125.53,0.145],[130.01,0.355]],"sphero_blue":[[4.48,0.557],[8.96,0.824],[13.45,0.666],[17.93,0.599],[22.41,0.602],[26.9,0.706],[31.38,0.376],[35.86,0.417],[40.34,0.549],[44.83,0.377],[49.31,0.216],[53.8,0.458],[58.28,0.544],[62.76,0.593],[67.24,0.364],[71.72,0.251],[76.21,0.238],[80.69,0.307],[85.18,0.305],[89.66,0.251],[94.14,0.33],[98.62,0.527],[103.11,0.328],[107.59,0.237],[112.07,0.507],[116.56,0.264],[121.04,0.403],[125.53,0.194],[130.01,0.211]],"a1_tail":[[43.5,7.94],[46.5,9.21],[49.5,9.28],[52.5,10.23],[55.5,10.48],[58.5,9.46],[61.5,8.96],[64.5,8.79],[67.5,8.48],[70.5,6.9],[73.5,8.5],[76.5,9.66]],"adapt_wall":[[0.25,0.003],[0.75,0.0],[1.25,0.1],[1.75,0.1],[2.25,0.37],[2.75,0.37],[3.25,0.636],[3.75,0.806],[4.25,0.903],[4.75,0.936],[5.25,1.1],[5.75,0.736],[6.25,0.87],[6.75,1.336],[7.25,1.203],[7.75,0.503],[8.25,0.1],[8.75,0.0],[9.25,0.0],[9.75,0.2],[10.25,0.403],[10.75,0.667],[11.25,0.067],[11.75,0.473],[12.25,1.37],[12.75,0.773],[13.25,2.033],[13.75,1.87],[14.25,1.203],[14.75,1.142],[15.25,2.109],[15.75,1.703],[16.25,0.867]],"adapt_plot":[[0.25,0.0],[0.75,0.01],[1.25,0.0],[1.75,0.13],[2.25,0.39],[2.75,0.52],[3.25,1.18],[3.75,1.97],[4.25,1.95],[4.75,3.66],[5.25,4.04],[5.75,2.61],[6.25,4.29],[6.75,2.87],[7.25,3.39],[7.75,5.21],[8.25,4.69],[8.75,0.78],[9.25,1.57],[9.75,0.0],[10.25,0.0],[10.75,0.0],[11.25,0.65],[11.75,0.79],[12.25,0.91],[12.75,2.6],[13.25,0.26],[13.75,0.79],[14.25,4.56],[14.75,3.53],[15.25,7.03],[15.75,8.33],[16.25,5.73],[16.75,4.59],[17.25,8.23],[17.75,7.94],[18.25,10.4]]};
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { env: 0x8e9bb8, data: 0x3aa8e0, det: 0x7cb8ff, sto: 0xf0963c, enc: 0x4fc98a, wm: 0x4fc98a, pi: 0x38d1ff, val: 0x9d8cff, rew: 0xf2c14e, grad: 0xff7a59, img: 0xd45fa0, base: 0xf0963c, human: 0xc9d2e3, ppo: 0x4fc98a };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyBox = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const LIVE = '<div id="live" class="live" aria-live="off"></div>';
  const qn = (k, d) => (qs.get(k) != null && !isNaN(+qs.get(k)) ? +qs.get(k) : d);
  const ST = { robot: qn('robot', 0), mode: qn('mode', 1), ts: qn('ts', 200), fill: qn('fill', 1), fus: qn('fus', 0), alpha: qn('alpha', 0.8), H: qn('H', 15), lam: qn('lam', 0.95), gam: qn('gam', 0.995), est: qn('est', 0), n: qn('n', 256), form: qn('form', 1), view: qn('view', 0), ad: qn('ad', 0), axis: qn('axis', 0) };
  /* rate = the control rate the paper states; steps = last step in the repo's score file; fill = train_fill in configs.yaml */
  const R = [
    { k: 'A1', hz: 20, steps: 93604, fill: 5000, tag: 'A1 四足', rssm: 256 },
    { k: 'UR5', hz: 2, steps: 39144, fill: 2000, tag: 'UR5 机械臂', rssm: 512 },
    { k: 'XArm', hz: 0.5, steps: 30805, fill: 2000, tag: 'XArm 机械臂', rssm: 512 },
    { k: 'Sphero', hz: 2, steps: 9929, fill: 1000, tag: 'Sphero 小车', rssm: 512 }];
  const robotCtl = { key: 'robot', label: '机器人', items: R.map((r, i) => [i, r.k]) };

  const SCENES = [
    { n: 1, part: '总览', dur: 12, cam: [0.25, 0.92, 37, [0, 1.2, 0]], title: '四个部件，分在两条线上', sub: '机器人和回放是 actor 这边，世界模型和演员-评论家是 learner 这边',
      html: '<p>这篇没有提出新算法，它把 Dreamer 搬到四台真实机器人上，不用仿真器、不用示教。流水线就是图 2 的循环：当前策略在机器人上收集经验，经验进回放缓存，世界模型从回放的序列上做监督学习，演员-评论家只在世界模型的隐空间里学。</p><p>实现上的改动在于：<b>收集和学习并行</b>。机器人动着的时候学习不停，算动作也不用等学习。</p><p class="note-mini">点方块可以跳到讲它的那一幕。</p>' + LIVE + src('原文图 2、第 2 节 · README 的 Method 一节') },
    { n: 2, part: 'Actor / Learner', dur: 12, cam: [0, 1.3, 31, [1.5, 3.2, 0]], title: '解耦：动作不等学习，学习不等动作', sub: '切换耦合/解耦，看哪台机器人受什么影响',
      html: '<p>耦合写法是走几步、停下来训练一次。对 20 Hz 的 A1，一次训练超过 50 ms 就错过控制周期；对慢机器人不会错过，但训练次数被环境步数卡住。解耦后 learner 不限速地循环，actor 按自己的节拍走。</p><p>两边都可调：机器人决定控制周期；一次训练的耗时论文和代码都没给，这里给成滑块，<b>只算到它会造成什么</b>。</p>' + LIVE + guess('一次训练多少毫秒是假设值。耦合模式的“每 4 步训练 1 次”取自 configs.yaml 的 train_every: 4，这个值只在 run: train 模式生效，解耦的 learning 模式不读它。') + src('原文第 2、3 节 · 代码 embodied/run/learning.py、acting.py') },
    { n: 3, part: '回放', dur: 11, cam: [0.04, 1.32, 30, [0.5, 3.6, 0]], title: '回放缓存：容量远远没用完', sub: '一格 1000 步，填充量是公开分数文件里的真实步数',
      html: '<p>回放是先进先出，容量 10<sup>6</sup> 步。学习时从里面取 32 条、每条 32 步的序列，序列可以来自很久以前的策略，所以世界模型是离策略（off-policy）训练：不要求数据由当前策略产生。</p><p>每格 1000 步，亮的格子是这台机器人整次运行的总步数。看得出在这些实验里先进先出从未开始淘汰。</p>' + LIVE + src('附录 D · 代码 configs.yaml、embodied/replay · 步数读自 scores/*.json 的最后一个 x') },
    { n: 4, part: '传感器融合', dur: 10, cam: [0, 1.1, 37, [-1.2, 3.4, 0]], title: '多模态怎样汇成一个向量', sub: '选机器人看模态组合；切到 Rainbow 看它的做法',
      html: '<p>编码器分两路：图像类用卷积，向量类用多层感知机，两路的输出拼接。代码里 RGB 和深度是<b>在通道维拼起来走同一个卷积网络</b>（早融合），本体感觉是在展平后才拼（晚融合）。论文只说“融合所有模态”，没写这个区别。</p><p>对照组 Rainbow 把本体感觉铺成和图像一样大的常数平面，再和 RGB 在通道维拼接。</p>' + LIVE + src('原文第 2、3 节 · 代码 nets.py MultiEncoder、configs.yaml、rainbow/env_crafter.py、robot_interface.py') },
    { n: 5, part: '世界模型', dur: 12, cam: [0, 0.98, 36, [0, 0.8, 0]], title: '在真实序列上训练 RSSM', sub: 'KL 平衡 α 可调，当场做梯度下降',
      html: '<p>左边是图 3(a)：编码器把 x 压成离散码 z（32 个变量，每个 32 类），GRU 状态 h 根据上一步 z 和动作前推，并由 h 单独预测 z（先验）。解码器重建输入，奖励头和终止头从 (h, z) 预测。</p><p>右边是一个 32 类变量上的 KL 平衡。先验 p 和后验 q 共用一个 KL，但两部分梯度比例不同：α 给先验（学会预测），1−α 给后验（别太随意）。</p>' + LIVE + toyBox('右边两组 32 类的分布是我造的，用下面的损失在页面上跑 400 步梯度下降，每次改 α 都重跑。后验还受一个“重建拉力”把它拉向目标类别，这个拉力代替真实的解码器损失。不是网络输出。') + src('式 (1)、图 3、附录 D · 代码 nets.py kl_loss，configs.yaml wmkl_balance: 0.8') },
    { n: 6, part: '想象', dur: 11, cam: [0.7, 0.95, 40, [0, 3, 0]], title: '一个批次展开成 16K 个隐状态', sub: '每根柱子是一条想象轨迹，改 H 看总数',
      html: '<p>回放里取的 32 × 32 = 1024 个时间步，每个的后验状态都作为一条想象的起点。在隐空间用动态网络和策略向前走 H 步，全程不解码。论文说这相当于单 GPU 上批量 16K 的并行学习。</p><p>一根柱子是一条轨迹，每个小块是一个隐状态。块数是真实的，高度代表想象到第几步。</p>' + LIVE + src('第 2 节“typical batch sizes of 16K” · 代码 agent.py imagine、Agent.train') },
    { n: 7, part: 'λ 回报', dur: 11, cam: [0, 0.98, 31, [1.5, 3.6, 0]], title: '式 (3)：从末端往回算，γ 的钟表含义', sub: '拖 λ、γ、H；换机器人看同一个 γ 看多远',
      html: '<p>式 (3) 从末端  v(s<sub>H</sub>) 开始往回递推，每一步混合“相信价值网络”和“相信后面的回报”。橙色是当场算出的 V<sup>λ</sup>。</p><p>γ 决定以步数计的有效视野 1/(1−γ)。同一个 γ，换算成时间后四台机器人差 40 倍，因为控制频率差 40 倍。附录 D 写 γ = 0.95，代码四个机器人配置都是 0.995，这里两个都能选。</p>' + LIVE + toyBox('r 和 v 是我写的两列数。递推公式是式 (3) 本身。') + src('式 (3)、附录 D · 代码 agent.py VFunction.target（gve），configs.yaml') },
    { n: 8, part: '策略梯度', dur: 11, cam: [0, 0.98, 30, [1, 2, 0]], title: '式 (4) 只写了 Reinforce，连续动作走的是重参数化', sub: '同一个玩具上当场比较两种估计器的方差',
      html: '<p>论文说连续动作（A1、Sphero）用重参数化，把回报的梯度穿过可微的动态网络；离散动作（UR5、XArm）用 Reinforce，因为采样离散动作不可导。式 (4) 只写了后一种形式。代码里 <code>backprop</code> 时损失就是 −score。</p><p>下面在一个一维问题上当场采样，两种估计器估同一个梯度。直方图的宽度就是方差。离散模式只有 Reinforce。</p>' + LIVE + toyBox('一维高斯策略 a ~ N(μ, σ²)，回报 R(a) = −(a−1.2)²，真实梯度可解析算出。样本是页面上的伪随机数。离散模式是 6 个动作的 softmax，回报是我设的。') + src('式 (4) · 代码 configs.yaml actor_grad_cont: backprop, actor_grad_disc: reinforce；agent.py ImagActorCritic.loss') },
    { n: 9, part: '四台机器人', dur: 14, cam: [0.3, 1.0, 22, [1, 1.2, 0]], title: '任务、奖励和动作空间', sub: 'A1 的五项奖励当场算；奖励公式可切论文或代码',
      html: '<p>四个任务共用一套算法，差别在观测、动作和奖励。选一台看。A1 的奖励是五项连乘门控之和：前一项不到 0.7，后一项就关掉。这解释了曲线为什么从 5 起步。</p>' + '<div id="robotInfo"></div>' + LIVE + guess('所有动作都是我写的关键帧，不是策略输出，也不是真机录像。A1 的上半身朝向和关节偏差也是按关键帧设的，奖励由这些设定值按公式算出。时间节点（5、25、60 分钟）来自第 3.1 节。') + src('第 3.1 到 3.4 节，式 (5) · 代码 motion_imitation/envs/env_wrappers/rma_task.py、robot_interface.py、sphero.py') },
    { n: 10, part: '结果', dur: 13, cam: [0, 1.1, 42, [0, 4.2, 0]], title: '真实钟表下的成绩', sub: '进度条是训练时间，柱高是图上读到的值',
      html: '<p>柱子的高度是图 4 到 7 的曲线在当前时刻的值，从 PDF 矢量路径读出，每组有自己的纵轴。人类那根是虚线的值，不随时间变。每个结果都只有一次运行：分数文件都是 seed 0，A1 的图注也说是单次运行。</p>' + LIVE + src('图 4、5、6、7 的矢量路径（pdftocairo -svg）；末值和文中数字的比较见精读页读者注') },
    { n: 11, part: '适应', dur: 12, cam: [0, 1.02, 34, [0, 3, 0]], title: '环境变了，它继续学', sub: 'XArm 日出和 A1 被推，柱子来自公开分数文件',
      html: '<p>学习不停，所以环境变了策略也会跟着变。论文报告了两次：A1 训练 1 小时后被杆子推，10 分钟内学会抗推或翻回来；XArm 被日出的强光打乱，表现掉下去，再恢复并超过原来。</p><p>XArm 的柱子可以切两种算法：按真实墙钟时间算的每分钟物体数，和图 A.1 的横纵轴。两者差很多，原因见<a href="../../papers/daydreamer.html#n11" target="_top">读者注 11</a>。</p>' + LIVE + guess('杆子和机器狗的动作是示意。柱子是真实数据。') + src('附录 A、第 3.1 节 · scores/xarm_adapt.csv（带墙钟时间）、scores/a1_dreamer.json') }
  ];

  const stepsEl = $('steps'), btns = $('sceneBtns');
  SCENES.forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" data-i="${i}"><span class="k">${s.n} · ${s.part}</span>${s.title}<small>${s.sub}</small></button>`;
    stepsEl.appendChild(li);
    const b = document.createElement('button'); b.type = 'button'; b.dataset.i = i; b.textContent = s.n; b.title = s.title; b.setAttribute('aria-pressed', 'false'); btns.appendChild(b);
  });
  let lastCap = null, lastLive = null;
  const cap = h => { if (h !== lastCap) { lastCap = h; $('cap').innerHTML = h; } };
  const live = h => { if (h !== lastLive) { lastLive = h; const e = $('live'); if (e) e.innerHTML = h; } };
  function showInfo(i) {
    const s = SCENES[i];
    $('infoTag').textContent = `第 ${s.n} 幕 · ${s.part}`; $('infoTitle').textContent = s.title; $('infoBody').innerHTML = s.html; $('stepNo').textContent = `${s.n} / ${SCENES.length}`;
    stepsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(+b.dataset.i === i)));
    btns.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
    lastLive = null;
  }

  /* ---------- 3D helpers ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.3, phi: 1.0, dist: 30, maxDist: 160, minDist: 3 }); } catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);
  let LABS = [], refDist = 30, PICKS = [];
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  /* a label whose text can change: redraws only when the string differs */
  function dyn(G, pos, o = {}) {
    let cur = null, sp = null;
    return text => { if (text === cur) return; cur = text; if (sp) { G.remove(sp); L.dispose(sp); LABS = LABS.filter(x => x !== sp); } sp = lab(text, pos, o); G.add(sp); };
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.16) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const arc = (a, b, h, n = 14) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n; o.push([L.lerp(a[0], b[0], t), L.lerp(a[1], b[1], t) + h * Math.sin(Math.PI * t), L.lerp(a[2], b[2], t)]); } return o; };
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.55, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  const interp = (arr, x) => { if (x <= arr[0][0]) return null; for (let i = 1; i < arr.length; i++) if (x <= arr[i][0]) { const a = arr[i - 1], b = arr[i], t = (x - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * t; } return arr[arr.length - 1][1]; };
  const rng = seed => L.rng(seed);

  /* a mini quadruped; set(roll, h, ph, tilt): body roll about its long axis, body height, gait phase */
  function quad(G, pos, sc = 1) {
    const g = new THREE.Group(); g.position.set(...pos); g.scale.setScalar(sc); G.add(g);
    const body = new THREE.Group(); g.add(body);
    const tr = L.box(2.6, 0.5, 0.9, 0x2d3345, { edgeOpacity: 0.3 }); body.add(tr);
    const shell = L.box(1.2, 0.18, 0.62, COL.rew, { edgeOpacity: 0.3 }); shell.position.y = 0.33; body.add(shell);
    const legs = [[1.05, 0.5, 0], [1.05, -0.5, 1], [-1.05, 0.5, 1], [-1.05, -0.5, 0]].map(([x, z, ph]) => {
      const up = new THREE.Group(); up.position.set(x, -0.1, z); const a = L.box(0.18, 0.75, 0.18, 0x59627a, { edgeOpacity: 0.2 }); a.position.y = -0.37; up.add(a);
      const lo = new THREE.Group(); lo.position.y = -0.75; const b = L.box(0.13, 0.75, 0.13, 0x8e9bb8, { edgeOpacity: 0.2 }); b.position.y = -0.37; lo.add(b); up.add(lo); body.add(up); return { up, lo, ph };
    });
    return { g, set(roll, h, gait, knee) { body.rotation.x = roll; body.position.y = h; legs.forEach(l => { const s = Math.sin(gait + l.ph * Math.PI); l.up.rotation.z = 0.5 + 0.35 * s; l.lo.rotation.z = -knee; }); } };
  }
  /* table with two bins */
  function bins(G, x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); G.add(g);
    [-1.6, 1.6].forEach(dx => { const b = block(2.8, 0.1, 2.8, 0x59627a, [dx, 0.05, 0]); g.add(b); [[0, 1.4, 2.8, 0.14], [0, -1.4, 2.8, 0.14], [1.4, 0, 0.14, 2.8], [-1.4, 0, 0.14, 2.8]].forEach(([a, c, w, d]) => g.add(block(w, 0.5, d, 0x7a84a0, [dx + a, 0.3, c]))); });
    return g;
  }
  const fmt = (x, d = 2) => (Math.abs(x) >= 1000 ? x.toFixed(0) : x.toFixed(d));
  const num = x => x.toLocaleString('en-US');

  /* ---------- 1 overview ---------- */
  function s1(G) {
    G.add(L.grid(36, 36));
    const rob = block(5, 0.3, 4, COL.env, [-8, 0.15, 6]), rep = block(4, 2.8, 4, COL.data, [8, 1.4, 6]), wm = block(4.6, 2.8, 4, COL.wm, [8, 1.4, -6]), ac = block(4.6, 2.8, 4, COL.pi, [-8, 1.4, -6]);
    const q = quad(G, [-8, 0.3, 6], 0.9); q.set(0, 1.25, 0, 1.0);
    rob.userData.go = 8; rep.userData.go = 2; wm.userData.go = 4; ac.userData.go = 7; PICKS.push(rob, rep, wm, ac);
    G.add(rob, rep, wm, ac, lab('真实机器人', [-8, 4.0, 6]), lab('回放缓存 10⁶', [8, 3.5, 6]), lab('世界模型 RSSM', [8, 3.5, -6]), lab('演员-评论家', [-8, 3.5, -6]));
    const a = arc([-5.4, 1.4, 6], [5.8, 1.4, 6], 1.2), b = arc([8, 1.8, 3.8], [8, 1.8, -3.8], 1.4), c = arc([5.5, 1.8, -6], [-5.5, 1.8, -6], 1.4), d = arc([-8, 1.8, -3.8], [-8, 1.8, 3.6], 1.4);
    [[a, COL.data], [b, COL.wm], [c, COL.pi], [d, COL.env]].forEach(([k, col]) => wire(G, k, col));
    G.add(lab('经验（走 ZeroMQ）', [0, 3.2, 6], { size: 20 }), lab('32 × 32 序列', [10.4, 3.4, 0], { size: 20 }), lab('隐空间想象', [0, 3.4, -6], { size: 20 }), lab('每 20 秒同步权重', [-10.9, 3.4, 0], { size: 20 }));
    /* the two lines of the paper's split */
    wire(G, [[-11.5, 0.02, 9.5], [11.5, 0.02, 9.5], [11.5, 0.02, 2.5], [-11.5, 0.02, 2.5], [-11.5, 0.02, 9.5]], COL.env, { dashed: 1, opacity: 0.8 });
    wire(G, [[-11.5, 0.02, -9.5], [11.5, 0.02, -9.5], [11.5, 0.02, -2.5], [-11.5, 0.02, -2.5], [-11.5, 0.02, -9.5]], COL.wm, { dashed: 1, opacity: 0.8 });
    const f = [stream(G, 5, COL.data), stream(G, 5, COL.wm), stream(G, 5, COL.pi), stream(G, 3, COL.env)];
    return { update(p) {
      const ph = (p * 14) % 1;
      f[0](a, ph, 1); f[1](b, ph, 1); f[2](c, ph, 1); f[3](d, ph, 1);
      q.set(0, 1.25 + 0.05 * Math.sin(p * 90), p * 90, 1.0);
      glow(rep, 0.2); glow(wm, 0.25 + 0.2 * Math.sin(p * 60) ** 2); glow(ac, 0.25 + 0.2 * Math.cos(p * 60) ** 2); glow(rob, 0.1);
      cap('下框 <b>actor</b>：机器人和回放。上框 <b>learner</b>：世界模型和演员-评论家。两条线同时在跑');
      live(`<p class="mono">公开分数文件的总步数<br>A1 ${num(R[0].steps)}，UR5 ${num(R[1].steps)}<br>XArm ${num(R[2].steps)}，Sphero ${num(R[3].steps)}</p>`);
    } };
  }
  /* ---------- 2 threads ---------- */
  function s2(G) {
    const r = R[ST.robot], T = 1000 / r.hz, ts = ST.ts, coupled = ST.mode === 0, W = 10 * T, X0 = -11, XW = 25, tx = t => X0 + XW * t / W;
    /* events */
    const acts = [], train = []; let late = 0;
    if (coupled) {
      /* every 4th action: the learner runs in the gap and the actor waits for it */
      let t = 0, i = 0;
      while (t < W && i < 200) { acts.push({ t, gap: false }); i++; if (i % 4 === 0) { train.push({ t: t + 0.01 * T, d: ts }); const g = Math.max(T, ts); if (ts > T) { late++; acts[acts.length - 1].gap = true; } t += g; } else t += T; }
    } else {
      for (let t = 0; t < W; t += T) acts.push({ t, gap: false });
      for (let t = 0; t < W; t += ts) train.push({ t, d: ts });
    }
    const yA = 3.2, yL = 0.2;
    G.add(lab('actor：算动作 + 发给电机', [-6.2, yA + 1.7, 0]), lab('learner：一次训练', [-6.8, yL + 1.7, 0]));
    wire(G, [[X0, yA - 0.05, 0], [X0 + XW, yA - 0.05, 0]], COL.env); wire(G, [[X0, yL - 0.05, 0], [X0 + XW, yL - 0.05, 0]], COL.wm);
    for (let i = 0; i <= 10; i += 2) { const x = tx(i * T); wire(G, [[x, yL - 0.5, 0], [x, yA + 0.9, 0]], COL.env, { opacity: 0.18 }); }
    const u = lab(`时间窗 ${W >= 1000 ? (W / 1000).toFixed(1) + ' s' : W.toFixed(0) + ' ms'}（10 个控制周期）`, [1.5, yL - 1.4, 0], { size: 21 }); G.add(u);
    const imA = inst(BOX, acts.length), imL = inst(BOX, train.length); G.add(imA, imL);
    const head = block(0.06, 6, 0.06, COL.grad, [0, 1.8, 0]); G.add(head);
    const cA = hex3(COL.pi), cBad = hex3(COL.grad), cL = hex3(COL.wm), cL2 = [cL[0] * 0.75, cL[1] * 0.75, cL[2] * 0.75];
    const upd = coupled ? (4 / (3 * T + Math.max(T, ts))) * 1000 / 4 : 1000 / ts, rate = coupled ? 4000 / (3 * T + Math.max(T, ts)) : r.hz;
    return { ctl: [robotCtl, { key: 'mode', label: '写法', items: [[0, '耦合'], [1, '解耦']] }, { key: 'ts', label: '一次训练', type: 'range', min: 50, max: 1000, step: 10, fmt: x => x + ' ms' }], update(p) {
      const now = p * W;
      acts.forEach((a, i) => { const on = a.t <= now; const w = Math.max(0.1, Math.min(XW * 0.7 * T / W, 0.9)); setI(imA, i, [tx(a.t) + w / 2, yA + 0.35, 0], on ? [w, 0.7, 1] : [0.0001, 0.0001, 0.0001]); colI(imA, i, a.gap ? cBad : cA); });
      train.forEach((b, i) => { const on = b.t <= now, frac = clamp((now - b.t) / b.d, 0, 1), w = XW * b.d / W; const full = Math.max(0.0001, Math.min(w, X0 + XW - tx(b.t)) * frac * 0.94); setI(imL, i, [tx(b.t) + full / 2, yL + 0.35, 0], on ? [full, 0.7, 1] : [0.0001, 0.0001, 0.0001]); colI(imL, i, i % 2 ? cL : cL2); });
      done(imA); done(imL); head.position.x = tx(now);
      const miss = coupled && ts > T;
      cap(`<b>${r.k}</b> ${r.hz} Hz，控制周期 ${T.toFixed(0)} ms · ${coupled ? '耦合：每 4 步停下训练 1 次' : '解耦：两边各走各的'}`);
      live(`<table class="mini"><tbody><tr><td>实际控制频率</td><td class="n">${rate.toFixed(rate < 2 ? 3 : 2)} Hz</td></tr><tr><td>每 4 步里超时</td><td class="n">${miss ? '1 步，晚 ' + (ts - T).toFixed(0) + ' ms' : '无'}</td></tr><tr class="on"><td>每秒训练次数</td><td class="n">${upd.toFixed(upd < 1 ? 3 : 2)}</td></tr><tr><td>解耦时的倍数</td><td class="n">${(1000 / ts / ((4 / (3 * T + Math.max(T, ts))) * 1000 / 4)).toFixed(1)} 倍</td></tr></tbody></table><p class="src">都是用上面三个量算的算术。真实一次训练的耗时我没有数据。</p>`);
    } };
  }
  /* ---------- 3 replay ---------- */
  function s3(G) {
    const r = R[ST.robot], NX = 50, NY = 20, cells = NX * NY, im = inst(BOX, cells); G.add(im);
    const X = i => -5 + (i % NX) * 0.37, Y = i => 8.2 - Math.floor(i / NX) * 0.37;
    const fillPaper = 10000, thr = (ST.fill ? fillPaper : r.fill);
    const off = hex3(0x2b3650), on = hex3(COL.data), rec = hex3(COL.rew);
    const pick = []; const ra = rng(5 + ST.robot); const usable = Math.max(1, Math.floor(r.steps / 1000)); for (let i = 0; i < 32; i++) pick.push(Math.floor(ra() * usable));
    const batch = inst(BOX, 32 * 32); G.add(batch);
    G.add(lab('回放：50 × 20 格，每格 1000 步，容量 10⁶', [4, 0, 0], { size: 21 }), lab('批次 32 × 32', [-11, -0.4, 0], { size: 21 }));
    const thrMark = block(0.37, 0.37, 0.42, COL.grad, [X(Math.floor(thr / 1000)) , Y(Math.floor(thr / 1000)), 0.2]); G.add(thrMark);
    const thrLab = lab(ST.fill ? '附录 D：10⁴ 步后才开始学' : `代码 train_fill：${num(r.fill)} 步后开始学`, [4, -1.3, 0], { size: 20 }); G.add(thrLab);
    return { ctl: [robotCtl, { key: 'fill', label: '开学门槛', items: [[1, '附录 D'], [0, '代码']] }], update(p) {
      const steps = p * r.steps, nCells = steps / 1000;
      for (let i = 0; i < cells; i++) { const f = clamp(nCells - i, 0, 1); setI(im, i, [X(i), Y(i), 0], [0.32, 0.32, 0.1 + 0.3 * f]); const c = pick.includes(i) && steps >= thr ? rec : (f > 0 ? on : off); colI(im, i, c); }
      done(im);
      const go = steps >= thr ? 1 : 0, k = 0.17;
      for (let a = 0; a < 32; a++) for (let b = 0; b < 32; b++) { const n = a * 32 + b; setI(batch, n, [-11 + (b - 15.5) * k, 1.9 + (a - 15.5) * k * 0.72, 0.0], go ? [k * 0.9, k * 0.65, 0.1] : [0.0001, 0.0001, 0.0001]); colI(batch, n, (a + b) % 2 ? rec : hex3(0xd8a838)); }
      done(batch);
      const hours = steps / r.hz / 3600, fillH = 1e6 / r.hz / 3600;
      cap(`<b>${r.k}</b> 已写入 <b>${num(Math.round(steps))}</b> 步 · 占容量 ${(steps / 1e4).toFixed(1)}% · ${steps >= thr ? '学习已开始' : '还在等开学门槛'}`);
      live(`<table class="mini"><tbody><tr><td>文中控制频率</td><td class="n">${r.hz} Hz</td></tr><tr><td>这个频率填满 10⁶ 步</td><td class="n">${fillH >= 48 ? (fillH / 24).toFixed(1) + ' 天' : fillH.toFixed(1) + ' 小时'}</td></tr><tr><td>整次运行总步数</td><td class="n">${num(r.steps)}</td></tr><tr><td>代码 train_fill</td><td class="n">${num(r.fill)}</td></tr><tr class="on"><td>10⁴ 步对总步数</td><td class="n">${(1e6 / r.steps).toFixed(1)}%</td></tr></tbody></table>${ST.robot === 3 ? '<p class="src">Sphero 整次运行只有 9929 步，不到附录 D 的 10⁴。</p>' : ''}`);
    } };
  }
  /* ---------- 4 fusion ---------- */
  const MOD = [
    { img: 0, depth: 0, vec: 16, vt: '马达角 12 + IMU 4', note: '只有本体感觉' },
    { img: 3, depth: 0, vec: 19, vt: '笛卡尔 6 + 关节 6 + 夹爪 1 + 独热 3+3', note: 'RGB + 本体感觉' },
    { img: 3, depth: 1, vec: 20, vt: '笛卡尔 6 + 关节 7 + 夹爪 1 + 独热 3+3', note: 'RGB-D + 本体感觉' },
    { img: 3, depth: 0, vec: 0, vt: '', note: '只有 RGB' }];
  function convShapes(c0) { const o = []; let s = 64, d = 64; o.push([64, c0]); for (const k of [4, 4, 4, 4]) { s = Math.floor((s - k) / 2) + 1; o.push([s, d]); d *= 2; } return o; }
  function s4(G) {
    const m = MOD[ST.robot], rb = ST.fus === 1, ch = m.img + m.depth, r = R[ST.robot];
    const hasRain = ST.robot === 1 || ST.robot === 2;
    const useRain = rb && hasRain;
    const shapes = convShapes(ch); const parts = [];
    const fl = []; const streams = [];
    const tile = (col, y, label) => { const b = block(2.4, 2.4, 0.2, col, [-13, y, 0]); G.add(b, lab(label, [-13, y + 1.8, 0], { size: 20 })); return b; };
    if (useRain) {
      const n = 3 + (6 + (ST.robot === 1 ? 6 : 7) + 1 + 3);
      for (let i = 0; i < n; i++) { const c = i < 3 ? [0xe05d5d, 0x4fc98a, 0x3aa8e0][i] : COL.sto; const pl = block(3.2, 3.2, 0.06, c, [-8 + i * 0.28, 3, i * -0.12], { opacity: i < 3 ? 1 : 0.7 }); G.add(pl); }
      G.add(lab(`84 × 84 × ${n}：RGB 3 层 + 本体 ${n - 3} 层常数平面`, [-3.5, 6, 0], { size: 22 }), lab('每个本体数值铺满一整层', [-3.5, -0.2, 0], { size: 20 }));
      const q = block(5, 2.4, 2.4, COL.base, [7, 3, 0]); G.add(q, lab('Rainbow 卷积 + Q 网络', [7, 5.3, 0], { size: 22 }));
      const pts = [[0, 3, 0], [4.5, 3, 0]]; wire(G, pts, COL.sto); const st = stream(G, 4, COL.sto);
      return { ctl: [robotCtl, { key: 'fus', label: '融合', items: [[0, 'Dreamer'], [1, 'Rainbow']] }], update(p) {
        st(pts, (p * 8) % 1, 1);
        cap(`<b>${r.k}</b> 的 Rainbow 对照组：把本体感觉广播成平面`);
        live(`<table class="mini"><tbody><tr><td>图像</td><td class="n">84 × 84 × 3</td></tr><tr><td>本体平面</td><td class="n">${n - 3} 层</td></tr><tr class="on"><td>深度</td><td class="n">无（代码里注释掉了）</td></tr></tbody></table><p class="src">rainbow/env_crafter.py _augment_obs。本体这里只取 cartesian、joint、gripper_pos、gripper_side，不含 grasped_side。</p>`);
      } };
    }
    let yy = 5.6;
    const hasImg = ch > 0, hasVec = m.vec > 0;
    const srcs = [];
    if (hasImg) { srcs.push(tile(0xe05d5d, yy, 'RGB 64×64×3')); parts.push('img'); yy -= 4; }
    if (m.depth) { srcs.push(tile(0x9d8cff, yy, '深度 64×64×1')); yy -= 4; }
    let vecY = yy;
    if (hasVec) { for (let i = 0; i < Math.min(m.vec, 20); i++) G.add(block(0.14, 0.6 + 0.9 * Math.abs(Math.sin(i * 1.9 + ST.robot)), 0.14, COL.sto, [-14 + i * 0.16, vecY, 0])); G.add(lab(`本体 ${m.vec} 维`, [-12.8, vecY + 1.5, 0], { size: 20 })); }
    const cnnY = hasImg ? (m.depth ? 3.6 : 5.6) : 0, mlpY = hasVec ? vecY : 0, fuseY = hasImg && hasVec ? (cnnY + mlpY) / 2 : (hasImg ? cnnY : mlpY);
    const cnnBoxes = [];
    if (hasImg) {
      shapes.slice(1).forEach(([s, d], i) => { const h = 2.8 - i * 0.55, w = 0.5 + i * 0.28; const b = block(w, h, h, COL.enc, [-7.8 + i * 1.5, cnnY, 0]); G.add(b); cnnBoxes.push(b); });
      G.add(lab(`卷积：${ch} 通道输入，核 4 步长 2`, [-4.6, cnnY + 2.5, 0], { size: 20 }));
    }
    const mlps = [];
    if (hasVec) { for (let i = 0; i < 4; i++) { const b = block(0.7, 1.6, 1.6, COL.sto, [-7.8 + i * 1.5, mlpY, 0]); G.add(b); mlps.push(b); } G.add(lab('多层感知机 4 × 512', [-5.5, mlpY + 1.6, 0], { size: 20 })); }
    const dim = (hasImg ? 2048 : 0) + (hasVec ? 512 : 0);
    const eb = block(1, 3.6, 1, COL.pi, [0.6, fuseY, 0]); G.add(eb, lab(`拼接：${dim} 维`, [0.6, fuseY + 2.6, 0], { size: 21 }));
    const h = block(1, 2.4, 1, COL.det, [4.6, fuseY + 3.3, 0]); G.add(h, lab(`h（${r.rssm} 维）`, [4.6, fuseY + 5.2, 0], { size: 20 }));
    const postB = block(1.2, 1.2, 1.2, COL.wm, [5.4, fuseY - 0.2, 0]); G.add(postB, lab('后验层', [5.4, fuseY + 1.2, 0], { size: 19 }));
    const zim = inst(BOX, 32 * 32); G.add(zim); const zr = rng(11);
    const hot = new Array(32).fill(0).map(() => Math.floor(zr() * 32));
    for (let a = 0; a < 32; a++) for (let b = 0; b < 32; b++) { const n = a * 32 + b; setI(zim, n, [8.0 + b * 0.14, fuseY + 2.2 - a * 0.14, 0], [0.12, 0.12, 0.12]); colI(zim, n, hot[a] === b ? [0.97, 0.75, 0.3] : [0.16, 0.2, 0.3]); }
    done(zim); G.add(lab('z：32 × 32 离散码', [10.2, fuseY + 3.3, 0], { size: 20 }));
    const pA = [[-11.2, cnnY, 0], [-1, cnnY, 0], [0, fuseY, 0]], pB = [[-11.2, mlpY, 0], [-1, mlpY, 0], [0, fuseY, 0]], pC = [[1.1, fuseY, 0], [4.8, fuseY, 0]], pH = [[4.6, fuseY + 2.1, 0], [5.3, fuseY + 0.6, 0]], pZ = [[6, fuseY, 0], [7.9, fuseY, 0]];
    if (hasImg) wire(G, pA, COL.enc); if (hasVec) wire(G, pB, COL.sto); wire(G, pC, COL.pi); wire(G, pH, COL.det); wire(G, pZ, COL.wm);
    const a = stream(G, 4, COL.enc), b = stream(G, 4, COL.sto), c = stream(G, 3, COL.pi), d = stream(G, 2, COL.wm);
    return { ctl: [robotCtl, { key: 'fus', label: '融合', items: [[0, 'Dreamer'], [1, 'Rainbow']] }], update(p) {
      const ph = (p * 8) % 1;
      if (hasImg) a(pA, ph, 1); else a(pA, 0, 0); if (hasVec) b(pB, ph, 1); else b(pB, 0, 0); c(pC, ph, 1); d(pZ, ph, 1);
      cap(`<b>${r.k}</b> · ${m.note}${rb && !hasRain ? ' · 这台机器人的对照组不是 Rainbow，所以还是画 Dreamer' : ''}`);
      const ss = hasImg ? shapes.map(x => `${x[0]}×${x[0]}×${x[1]}`).join(' → ') + ' → 2048' : '无图像';
      live(`<table class="mini"><tbody><tr><td class="nw">卷积</td><td>${ss}</td></tr><tr><td class="nw">向量</td><td>${hasVec ? m.vt + ' → 512' : '无'}</td></tr><tr class="on"><td class="nw">拼接后</td><td class="n">${dim} 维</td></tr></tbody></table><p class="src">形状是按 nets.py 的步长和 padding: valid 算的。</p>`);
    } };
  }
  /* ---------- 5 world model ---------- */
  function klToy(alpha, steps = 400) {
    const K = 32, tgt = 9, lr = 0.035, lq = new Float64Array(K), lp = new Float64Array(K), r = rng(3);
    for (let i = 0; i < K; i++) { lq[i] = 0.2 * (r() - 0.5); lp[i] = 0.2 * (r() - 0.5); }
    const soft = l => { const m = Math.max(...l), e = Array.from(l, x => Math.exp(x - m)), s = e.reduce((a, b) => a + b, 0); return e.map(x => x / s); };
    const out = [];
    for (let t = 0; t <= steps; t++) {
      const q = soft(lq), p = soft(lp); let kl = 0; for (let i = 0; i < K; i++) kl += q[i] * Math.log(q[i] / p[i]);
      let hq = 0; for (let i = 0; i < K; i++) hq -= q[i] * Math.log(q[i]);
      out.push({ q, p, kl, hq });
      /* gradient in logits. dKL/dlogit_p = alpha*(p-q) (q held fixed). dKL/dlogit_q = (1-alpha)*q*(log q/p - KL) (p held fixed).
         reconstruction pull: cross-entropy of q to the target class, a stand-in for the decoder loss */
      for (let i = 0; i < K; i++) {
        const gp = alpha * (p[i] - q[i]), gq = (1 - alpha) * q[i] * (Math.log(q[i] / p[i]) - kl) + (q[i] - (i === tgt ? 1 : 0)) * 0.25;
        lp[i] -= lr * gp * K * 0.25; lq[i] -= lr * gq * K * 0.25;
      }
    }
    return out;
  }
  function s5(G) {
    const xs = [-11, -7, -3];
    const ht = [], zt = [];
    xs.forEach((x, i) => {
      const obs = block(1.7, 1.7, 0.12, COL.img, [x, -2.6, 0]), enc = block(1.1, 0.8, 0.9, COL.enc, [x - 0.65, -0.8, 0]), dec = block(1.1, 0.8, 0.9, COL.sto, [x + 0.65, -0.8, 0]);
      const z = block(1, 1, 0.7, COL.wm, [x, 0.9, 0]), h = block(1, 1.4, 0.8, COL.det, [x, 3.2, 0]); ht.push(h); zt.push(z);
      const rr = block(0.8, 0.5, 0.5, COL.rew, [x + 1.15, 4.9, 0]);
      G.add(obs, enc, dec, z, h, rr);
      wire(G, [[x - 0.6, -1.8, 0], [x - 0.6, -1.2, 0]], COL.enc); wire(G, [[x - 0.6, -0.4, 0], [x - 0.15, 0.4, 0]], COL.enc); wire(G, [[x + 0.15, 0.4, 0], [x + 0.65, -0.4, 0]], COL.sto); wire(G, [[x, 1.4, 0], [x, 2.5, 0]], COL.wm); wire(G, [[x + 0.3, 3.9, 0], [x + 1, 4.6, 0]], COL.rew);
      if (i < 2) { wire(G, [[x + 0.5, 3.2, 0], [xs[i + 1] - 0.5, 3.2, 0]], COL.det); wire(G, [[x + 0.5, 1.0, 0], [xs[i + 1] - 0.5, 2.8, 0]], COL.wm, { opacity: 0.45 }); }
    });
    G.add(lab('x', [-13, -2.6, 0], { size: 19 }), lab('编 / 解', [-13.4, -0.8, 0], { size: 19 }), lab('z', [-13, 0.9, 0], { size: 19 }), lab('h', [-13, 3.2, 0], { size: 19 }), lab('奖励、终止', [-9, 5.9, 0], { size: 19 }));
    const r = stream(G, 3, COL.det);
    /* KL bars */
    const K = 32, bx = i => 2.5 + i * 0.37, qb = inst(BOX, K), pb = inst(BOX, K); G.add(qb, pb);
    const cq = hex3(COL.wm), cp = hex3(COL.det), hot = hex3(COL.rew);
    G.add(lab('后验 q（看了 x）', [10, 4.2, 0], { size: 20 }), lab('先验 p（只看 h）', [10, -1.8, 0], { size: 20 }));
    const traj = klToy(ST.alpha);
    return { ctl: [{ key: 'alpha', label: 'α', type: 'range', min: 0, max: 1, step: 0.05, fmt: x => x.toFixed(2) }], update(p) {
      const k = Math.round(p * (traj.length - 1)), f = traj[k];
      for (let i = 0; i < K; i++) { const a = Math.max(0.01, f.q[i] * 4.5), b = Math.max(0.01, f.p[i] * 4.5); setI(qb, i, [bx(i), 2 + a / 2 + 0.05, 0], [0.3, a, 0.3]); setI(pb, i, [bx(i), -4 + b / 2 + 0.05, 0], [0.3, b, 0.3]); colI(qb, i, i === 9 ? hot : cq); colI(pb, i, i === 9 ? hot : cp); }
      done(qb); done(pb); r([[-11, 3.2, 0], [-3, 3.2, 0]], (p * 6) % 1, 1);
      const ip = traj.findIndex(x => x.p[9] > 0.5);
      cap(`梯度下降第 <b>${k}</b> / 400 步 · α = ${ST.alpha.toFixed(2)} · KL(q‖p) = <b>${f.kl.toFixed(3)}</b>`);
      live(`<table class="mini"><tbody><tr><td>q 在目标类的概率</td><td class="n">${f.q[9].toFixed(3)}</td></tr><tr><td>p 在目标类的概率</td><td class="n">${f.p[9].toFixed(3)}</td></tr><tr class="on"><td>KL(q‖p)</td><td class="n">${f.kl.toFixed(3)} nats</td></tr><tr><td>q 的熵</td><td class="n">${f.hq.toFixed(3)} nats</td></tr><tr><td>p 过 0.5 的步数</td><td class="n">${ip < 0 ? '400 步内没有' : ip}</td></tr></tbody></table><div class="eq-mini">L = α·KL(sg(q)‖p) + (1−α)·KL(q‖sg(p)) + 拉力</div>`);
    } };
  }
  /* ---------- 6 imagination ---------- */
  function s6(G) {
    const H = ST.H, B = 32, T = 32, n = B * T * (H + 1), im = inst(BOX, n); G.add(im);
    const c0 = hex3(COL.wm), c1 = hex3(COL.pi);
    const sp = 0.56, base = block(B * sp + 1, 0.2, T * sp + 1, 0x2b3650, [0, -0.1, 0]); G.add(base);
    G.add(lab('T = 32 步', [B * sp / 2 + 2.2, 0.4, 0], { size: 21 }), lab('B = 32 条序列', [0, 0.4, T * sp / 2 + 1.8], { size: 21 }));
    const top = dyn(G, [0, 10.4, 0], { size: 22 });
    return { ctl: [{ key: 'H', label: '想象长度 H', items: [[1, '1'], [5, '5'], [15, '15'], [30, '30']] }, robotCtl], update(p) {
      const step = p * (H + 1), dy = Math.min(0.42, 8.5 / (H + 1));
      let i = 0; for (let a = 0; a < B; a++) for (let b = 0; b < T; b++) for (let h = 0; h <= H; h++) {
        const on = clamp(step - h, 0, 1), t = h / Math.max(1, H);
        setI(im, i, [(a - B / 2 + 0.5) * sp, 0.1 + h * dy, (b - T / 2 + 0.5) * sp], on > 0 ? [0.42, dy * 0.82 * on, 0.42] : [0.0001, 0.0001, 0.0001]);
        colI(im, i, [L.lerp(c0[0], c1[0], t), L.lerp(c0[1], c1[1], t), L.lerp(c0[2], c1[2], t)]); i++;
      }
      done(im);
      const shown = Math.floor(clamp(step, 0, H + 1)) * B * T, r = R[ST.robot], eq = n / r.hz;
      top(`${num(B * T)} 个起点 × ${H + 1} 个状态 = ${num(n)}`);
      cap(`想象到第 <b>${Math.min(H, Math.floor(step))}</b> 步 · 已展开 <b>${num(shown)}</b> 个隐状态 · 这期间没有解码任何图像`);
      live(`<table class="mini"><tbody><tr><td>起点 B × T</td><td class="n">1024</td></tr><tr class="on"><td>总状态 B × T × (H+1)</td><td class="n">${num(n)}</td></tr><tr><td>同样步数在 ${r.k} 上</td><td class="n">${eq >= 3600 ? (eq / 3600).toFixed(1) + ' 小时' : (eq / 60).toFixed(1) + ' 分钟'}</td></tr></tbody></table><p class="src">H = 15 时正好 16384，也就是论文的“16K”和正文的“H = 16”：起点算一个状态，再走 15 步。</p>`);
    } };
  }
  /* ---------- 7 lambda return ---------- */
  function s7(G) {
    const H = Math.round(ST.H), l = ST.lam, g = ST.gam;
    const rr = []; const r0 = rng(21); for (let i = 0; i <= H; i++) rr.push(0.35 + 0.5 * Math.sin(i * 0.7) ** 2 + 0.1 * r0());
    const vv = rr.map((x, i) => 2.6 + 1.2 * Math.cos(i * 0.4));
    const Vs = new Array(H + 1); Vs[H] = vv[H]; for (let t = H - 1; t >= 0; t--) Vs[t] = rr[t] + g * ((1 - l) * vv[t + 1] + l * Vs[t + 1]);
    const X = i => -11.5 + i * 25 / Math.max(H, 1), W = Math.min(0.42, 7 / Math.max(H, 1)), sc = 7 / Math.max(...Vs, ...vv, 1);
    const imR = inst(BOX, H + 1), imV = inst(BOX, H + 1), imL = inst(BOX, H + 1); G.add(imR, imV, imL);
    const cR = hex3(COL.rew), cV = hex3(COL.val), cL = hex3(COL.sto);
    G.add(lab('黄 r', [8.2, 9.5, 0], { size: 19 }), lab('紫 v', [10.0, 9.5, 0], { size: 19 }), lab('橙 Vλ', [12.0, 9.5, 0], { size: 19 }));
    const vt = dyn(G, [6, 8.2, 0], { size: 22 });
    return { ctl: [{ key: 'lam', label: 'λ', type: 'range', min: 0, max: 1, step: 0.01, fmt: x => x.toFixed(2) }, { key: 'gam', label: 'γ', items: [[0.95, '0.95 附录 D'], [0.995, '0.995 代码'], [0.998, '0.998 默认']] }, { key: 'H', label: 'H', type: 'range', min: 1, max: 30, step: 1, fmt: x => String(x) }, robotCtl], update(p) {
      const front = H - p * (H + 0.99);
      for (let i = 0; i <= H; i++) {
        const on = i >= front; const x = X(i), hr = Math.max(0.02, rr[i] * sc), hv = Math.max(0.02, vv[i] * sc), hl = on ? Math.max(0.02, Vs[i] * sc) : 0.0001;
        setI(imR, i, [x - W, hr / 2, 0], [W * 0.9, hr, 0.5]); setI(imV, i, [x, hv / 2, 0], [W * 0.9, hv, 0.5]); setI(imL, i, [x + W, hl / 2, 0], [W * 0.9, hl, 0.5]);
        colI(imR, i, cR); colI(imV, i, cV); colI(imL, i, cL);
      }
      done(imR); done(imV); done(imL);
      const k = Math.max(0, Math.ceil(front)), r = R[ST.robot], eff = 1 / (1 - g);
      vt(`τ = ${k} 时 Vλ = ${Vs[k].toFixed(3)}`);
      cap(`递推到 τ = <b>${k}</b> · V<sup>λ</sup> = r + γ[(1−λ)v(s′) + λV′]`);
      const secTxt = s => s >= 60 ? (s / 60).toFixed(1) + ' 分钟' : s.toFixed(1) + ' 秒';
      live(`<table class="mini"><tbody><tr><td>最长一项权重 λ<sup>H−1</sup></td><td class="n">${(H > 1 ? l ** (H - 1) : 1).toFixed(3)}</td></tr><tr><td>γ<sup>H</sup></td><td class="n">${(g ** H).toFixed(3)}</td></tr><tr class="on"><td>有效视野 1/(1−γ)</td><td class="n">${eff.toFixed(0)} 步</td></tr>${R.map((x, i) => `<tr${i === ST.robot ? ' class="on"' : ''}><td>${x.k} ${x.hz} Hz</td><td class="n">${secTxt(eff / x.hz)}</td></tr>`).join('')}</tbody></table>`);
    } };
  }
  /* ---------- 8 estimators ---------- */
  function estimators(N, mu, sig) {
    const r = rng(77), rp = [], rf = [], R0 = a => -(a - 1.2) * (a - 1.2);
    for (let i = 0; i < N; i++) { const e = L.gauss(r), a = mu + sig * e, Ra = R0(a); rp.push(-2 * (a - 1.2)); rf.push((Ra - R0(mu)) * (a - mu) / (sig * sig)); }
    return { rp, rf, truth: -2 * (mu - 1.2) };
  }
  const stat = a => { const m = a.reduce((x, y) => x + y, 0) / a.length, s = Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / Math.max(1, a.length - 1)); return { m, s }; };
  function s8(G) {
    const NB = 41, lo = -6, hi = 8, N = ST.n, mu = 0.2, sig = 0.5;
    if (ST.est === 1) { /* discrete: softmax over 6 actions, only Reinforce */
      const logits = [0, 0.2, -0.1, 0.1, 0.3, -0.2], Rw = [0, 0, 0, 0, 1, 0], sm = logits.map(x => Math.exp(x)), Z = sm.reduce((a, b) => a + b, 0), P = sm.map(x => x / Z);
      const names = ['x−', 'x+', 'y−', 'y+', '夹爪', 'z'], baseV = P.reduce((s, x, i) => s + x * Rw[i], 0), tr = P[4] * (Rw[4] - baseV);
      const bars = names.map((n, i) => { const b = block(1.4, 1, 1.2, i === 4 ? COL.rew : COL.pi, [-9 + i * 2.4, 1, 0]); G.add(b, lab(n, [-9 + i * 2.4, -0.7, 0], { size: 20 })); return b; });
      const r = rng(9), samples = []; for (let i = 0; i < N; i++) { const u = r(); let c = 0, a = 5; for (let j = 0; j < 6; j++) { c += P[j]; if (u < c) { a = j; break; } } samples.push(((a === 4 ? 1 : 0) - P[4]) * (Rw[a] - baseV)); }
      G.add(lab('UR5、XArm：6 个离散动作的 softmax', [0, 7.2, 0], { size: 22 }));
      return { ctl: [{ key: 'est', label: '动作', items: [[0, '连续'], [1, '离散']] }, { key: 'n', label: '样本', type: 'range', min: 16, max: 2048, step: 16, fmt: x => String(x) }], update(p) {
        const n = Math.max(2, Math.round(p * N)), a = samples.slice(0, n), s = stat(a);
        bars.forEach((b, i) => { const h = 0.1 + P[i] * 18 ; b.scale.y = h; b.position.y = h / 2; });
        cap(`已采 <b>${n}</b> 个样本 · 只有 Reinforce 可用：离散采样不可导`);
        live(`<table class="mini"><tbody><tr><td>真实 ∂J/∂logit(夹爪)</td><td class="n">${tr.toFixed(4)}</td></tr><tr class="on"><td>Reinforce 均值</td><td class="n">${s.m.toFixed(4)}</td></tr><tr><td>单样本标准差</td><td class="n">${s.s.toFixed(3)}</td></tr></tbody></table><p class="src">动作名对应 robot_interface.py 的 act_space；回报只给“夹爪”1 分，是我设的。</p>`);
      } };
    }
    const { rp, rf, truth } = estimators(N, mu, sig);
    const hA = inst(BOX, NB), hB = inst(BOX, NB); G.add(hA, hB);
    const cA = hex3(COL.pi), cB = hex3(COL.sto), X = i => -11.5 + i * 24 / (NB - 1), bin = v => clamp(Math.floor((v - lo) / (hi - lo) * NB), 0, NB - 1);
    const tx = -11.5 + ((truth - lo) / (hi - lo)) * 24;
    wire(G, [[tx, -0.2, 0.5], [tx, 8.6, 0.5]], COL.grad, { opacity: 0.95 }); G.add(lab(`真实梯度 ${truth.toFixed(2)}`, [tx, 9.2, 0.5], { size: 21 }));
    G.add(lab('蓝：重参数化 ∂R/∂a', [7, 8.2, -0.5], { size: 20 }), lab('橙：Reinforce (R−b)·∂lnπ/∂μ', [8, 6.8, 0.5], { size: 20 }));
    return { ctl: [{ key: 'est', label: '动作', items: [[0, '连续'], [1, '离散']] }, { key: 'n', label: '样本', type: 'range', min: 16, max: 2048, step: 16, fmt: x => String(x) }], update(p) {
      const n = Math.max(2, Math.round(p * N)), ca = new Array(NB).fill(0), cb = new Array(NB).fill(0);
      for (let i = 0; i < n; i++) { ca[bin(rp[i])]++; cb[bin(rf[i])]++; }
      const mx = Math.max(4, ...ca, ...cb), sc = 7.5 / mx;
      for (let i = 0; i < NB; i++) { const a = Math.max(0.01, ca[i] * sc), b = Math.max(0.01, cb[i] * sc); setI(hA, i, [X(i), a / 2, -0.5], [0.45, a, 0.5]); setI(hB, i, [X(i), b / 2, 0.5], [0.45, b, 0.5]); colI(hA, i, cA); colI(hB, i, cB); }
      done(hA); done(hB);
      const A = stat(rp.slice(0, n)), B = stat(rf.slice(0, n));
      cap(`已采 <b>${n}</b> 个样本 · 蓝：重参数化，橙：Reinforce，红线：解析真值`);
      live(`<table class="mini"><thead><tr><th></th><th class="n">均值</th><th class="n">标准差</th></tr></thead><tbody><tr><td>重参数化</td><td class="n">${A.m.toFixed(3)}</td><td class="n">${A.s.toFixed(3)}</td></tr><tr><td>Reinforce</td><td class="n">${B.m.toFixed(3)}</td><td class="n">${B.s.toFixed(3)}</td></tr><tr class="on"><td>标准差之比</td><td></td><td class="n">${(B.s / A.s).toFixed(2)}</td></tr></tbody></table>`);
    } };
  }
  /* ---------- 9 robots ---------- */
  const RINFO = [
    [['控制', '20 Hz（1000 Hz 底层重复 50 次）'], ['动作', '12 维连续 [−1, 1]，映射成目标马达角，经 PD 控制实现'], ['观测', '马达角 12 + IMU 4'], ['奖励', '式 (5)，最高 14'], ['复位', '无。走到边界时人工挪位']],
    [['控制', '文中 2 Hz'], ['动作', '离散：x、y 增量，夹爪切换，z'], ['观测', 'RGB + 本体'], ['奖励', '抓 +1，同箱放下 −1，放到对面 +10'], ['物体', '3 个球']],
    [['控制', '文中约 0.5 Hz'], ['动作', '离散，同 UR5'], ['观测', 'RGB + 深度 + 本体'], ['奖励', '同 UR5'], ['物体', '1 个软物，用绳连着夹爪']],
    [['控制', '文中 2 Hz'], ['动作', '2 维连续，两个马达力矩'], ['观测', '只有俯视 RGB'], ['奖励', '−（到目标的 L2 距离）'], ['回合', '100 步，然后随机高功率动作复位']]];
  /* key frames: minutes -> roll, up_z, deviations(hip,shoulder,knee), forward velocity, total velocity */
  const AK = [[0, 3.14, -1, 0.9, 0.9, 0.9, 0, 0.05], [5, 3.14, -1, 0.7, 0.7, 0.7, 0, 0.05], [8, 0, 1, 0.55, 0.55, 0.6, 0, 0.05], [25, 0, 1, 0.1, 0.12, 0.15, 0, 0.03], [50, 0, 1, 0.12, 0.14, 0.16, 0.12, 0.2], [60, 0, 1, 0.12, 0.14, 0.16, 0.3, 0.33]];
  const akAt = m => { for (let i = 1; i < AK.length; i++) if (m <= AK[i][0]) { const a = AK[i - 1], b = AK[i], t = (m - a[0]) / (b[0] - a[0]); return a.map((x, j) => L.lerp(x, b[j], t)); } return AK[AK.length - 1]; };
  function a1Reward(k, plus) {
    const [, , upz, dh, ds, dk, vx, vt] = k, upr = (upz + (plus ? 1 : -1)) / 2, hip = upr > 0.7 ? 1 - dh : 0, sho = hip > 0.7 ? 1 - ds : 0, kne = sho > 0.7 ? 1 - dk : 0;
    const vel = kne > 0.7 ? (Math.max(0, vx) / Math.max(vt, 1e-6)) * clamp(vx / 0.3, -1, 1) : 0;
    return { upr, hip, sho, kne, vel: 5 * (vel + 1), raw: vel };
  }
  function s9(G) {
    G.add(L.grid(22, 22));
    const rid = ST.robot, box = $('robotInfo'); if (box) box.innerHTML = dl(RINFO[rid]);
    const ctl = [robotCtl];
    if (rid === 0) {
      ctl.push({ key: 'form', label: '式 (5) 首项', items: [[1, '代码 (+1)/2'], [0, '论文 (−1)/2']] });
      const q = quad(G, [-3.5, 0, 0], 1.2);
      const names = ['r_upr', 'r_hip', 'r_sho', 'r_kne', 'r_vel'], cols = [COL.det, COL.wm, COL.sto, COL.val, COL.rew], bars = names.map((n, i) => { const b = block(0.9, 1, 0.9, cols[i], [3.2 + i * 1.3, 0.5, 0]); G.add(b, lab(n, [3.2 + i * 1.3, i % 2 ? -1.5 : -0.7, 0], { size: 18 })); return b; });
      wire(G, [[2.6, 0.7, 0.6], [6.9, 0.7, 0.6]], COL.grad, { dashed: 1, opacity: 0.95 });
      G.add(lab('门 0.7', [2.0, 1.0, 0.6], { size: 16 }));
      const tt = dyn(G, [5.8, 6.7, 0], { size: 21 });
      return { ctl, update(p) {
        const m = p * 60, k = akAt(m), rw = a1Reward(k, ST.form === 1), vals = [rw.upr, rw.hip, rw.sho, rw.kne, rw.vel];
        vals.forEach((v, i) => { const h = Math.max(0.02, Math.abs(v)); bars[i].scale.y = h; bars[i].position.y = h / 2 * Math.sign(v || 1); });
        const stand = 1 - (k[3] + k[4] + k[5]) / 3, knee = L.lerp(0.25, 1.1, clamp(stand, 0, 1));
        const walking = clamp((m - 40) / 15, 0, 1);
        q.set(k[1], 0.25 + 1.1 * stand * (k[1] < 1 ? 1 : 0) + (k[1] > 1 ? 0.6 : 0) + 0.28 * walking * Math.abs(Math.sin(p * 220)), p * 220 * walking, knee);
        q.g.position.x = -3.5 + 2.5 * walking * ((p * 3) % 1);
        const tot = vals.reduce((a, b) => a + b, 0), cv = interp(DATA.a1_blue, m);
        tt(`第 ${m.toFixed(0)} 分钟 · 奖励 ${tot.toFixed(2)}`);
        cap(`关键帧：${m < 8 ? '仰面，文中说前 5 分钟翻过来，分数文件要到约第 8 分钟' : m < 25 ? '翻过来，第 25 分钟前学会站' : '站着，第 60 分钟前后学会弹跳式前进'}`);
        live(`<table class="mini"><tbody>${names.map((n, i) => `<tr><td>${n}</td><td class="n">${vals[i].toFixed(2)}</td></tr>`).join('')}<tr class="on"><td>合计（示意姿态）</td><td class="n">${tot.toFixed(2)}</td></tr><tr><td>图 4 Dreamer 同一时刻</td><td class="n">${cv == null ? '–' : cv.toFixed(2)}</td></tr></tbody></table>${ST.form === 0 ? '<p class="src">按论文写的 −1：翻正后 r_upr 最高只有 0，永远过不了 0.7，后四项不开。</p>' : ''}`);
      } };
    }
    if (rid === 3) {
      const fl = block(10, 0.1, 10, 0x2b3650, [0, 0.05, 0]); G.add(fl);
      const goal = [0.825, 0.165], gx = -5 + goal[0] * 10, gz = -5 + goal[1] * 10;
      const ring = L.torus(0.45, 0.07, COL.rew); ring.rotation.x = Math.PI / 2; ring.position.set(gx, 0.15, gz); G.add(ring, lab('目标 (0.825, 0.165)', [gx, 1.1, gz - 0.2], { size: 19 }));
      const rob = L.cyl(0.32, 0.32, 0.55, COL.pi); rob.position.y = 0.33; G.add(rob);
      const cam = block(0.5, 0.3, 0.5, 0x59627a, [0, 5, 0]); G.add(cam, lab('俯视相机', [0, 5.8, 0], { size: 19 })); wire(G, [[0, 4.9, 0], [-5, 0.1, -5]], COL.env, { opacity: 0.2 }); wire(G, [[0, 4.9, 0], [5, 0.1, 5]], COL.env, { opacity: 0.2 });
      const pts = []; const rr = rng(4); let x = 0.15, z = 0.8; for (let i = 0; i <= 40; i++) { pts.push([x, z]); const k = i / 40; x += (goal[0] - x) * (0.05 + 0.2 * k) + 0.02 * (rr() - 0.5); z += (goal[1] - z) * (0.05 + 0.2 * k) + 0.02 * (rr() - 0.5); }
      return { ctl, update(p) {
        const i = Math.min(40, Math.floor(p * 41)), [px, pz] = pts[i]; rob.position.x = -5 + px * 10; rob.position.z = -5 + pz * 10; const d = Math.hypot(px - goal[0], pz - goal[1]);
        const cv = interp(DATA.sphero_blue, p * 130);
        cap('机器人是对称的圆柱，单张图看不出朝向，只能从历史帧推断');
        live(`<table class="mini"><tbody><tr class="on"><td>−L2（示意路径）</td><td class="n">${(-d).toFixed(3)}</td></tr><tr><td>图 7 Dreamer 第 ${(p * 130).toFixed(0)} 分钟</td><td class="n">${cv == null ? '–' : cv.toFixed(3)}</td></tr></tbody></table><p class="src">目标坐标来自 sphero.py 的 GOAL_POS，路径是我写的。</p>`);
      } };
    }
    bins(G, 2.5, 0); const arm = L.arm(rid === 1 ? COL.det : COL.human); arm.position.set(2.5, 0, -3.2); arm.scale.setScalar(rid === 1 ? 0.95 : 0.82); G.add(arm);
    const balls = (rid === 1 ? [[0.5, 0xe05d5d], [1.3, 0x4fc98a], [0.1, 0xf0963c]] : [[0.9, 0xf2c14e]]).map(([x, c], i) => { const m = L.sphere(0.26, c); m.position.set(x + 0.2 * i, 0.36, 0.7 - 0.7 * i); G.add(m); return m; });
    const held = balls[0];
    const camB = block(0.5, 0.5, 0.5, 0x59627a, [-4.5, 3.5, 4]); G.add(camB, lab(rid === 2 ? 'RealSense RGB-D' : '第三人称 RGB', [-4.5, 4.5, 4], { size: 19 }));
    if (rid === 2) { const str = L.line([[0, 0, 0], [0, 1, 0]], COL.env); G.add(str); }
    const A = [0.9, 0.34, 0.5], Bp = [4.1, 0.34, 0.3], rew = dyn(G, [-4.5, 1.2, -1], { size: 22 });
    return { ctl, update(p) {
      const q = (p * 2) % 1; let pos, hold = false, r = 0;
      const hov = (a) => [a[0], 2.2, a[2]];
      if (q < 0.25) pos = hov(A);
      else if (q < 0.38) { pos = [A[0], L.lerp(2.2, 0.55, seg(q, 0.25, 0.38)), A[2]]; }
      else if (q < 0.5) { pos = [A[0], L.lerp(0.55, 2.2, seg(q, 0.38, 0.5)), A[2]]; hold = true; r = 1; }
      else if (q < 0.72) { const t = seg(q, 0.5, 0.72); pos = [L.lerp(A[0], Bp[0], t), 2.2, L.lerp(A[2], Bp[2], t)]; hold = true; r = 1; }
      else { pos = hov(Bp); r = 11; }
      arm.userData.reach(pos);
      if (hold) { held.position.set(pos[0], pos[1] - 0.2, pos[2]); } else if (q >= 0.72) held.position.set(Bp[0], 0.36, Bp[2]); else held.position.set(A[0], 0.36, A[2]);
      arm.userData.f1.position.x = hold ? -0.13 : -0.22; arm.userData.f2.position.x = hold ? 0.13 : 0.22;
      rew(`本回合累计奖励 ${r}`);
      cap(`${R[rid].k}：稀疏奖励。抓住 +1，放到对面箱 +10，所以一个物体的完整循环是 11 分`);
      const obj = rid === 1 ? '2.5' : '3.1';
      live(`<table class="mini"><tbody><tr><td>文中拣取速率</td><td class="n">${obj} 个/分</td></tr><tr><td>人类（图中虚线）</td><td class="n">${rid === 1 ? '2.89' : '3.06'} 个/分</td></tr></tbody></table>`);
    } };
  }
  /* ---------- 10 results ---------- */
  const PANELS = [
    { k: 'A1', t: 'A1 · 平均奖励', tend: 59.1, unit: '分钟', dd: 1, ymax: 14, ser: [['Dreamer', 'a1_blue', COL.pi], ['SAC', 'a1_or', COL.base]], human: null, wall: 1, txt: '1 小时走起来' },
    { k: 'UR5', t: 'UR5 · 个/分钟', tend: 8, unit: '小时', dd: 2, ymax: 4, ser: [['Dreamer', 'ur5_blue', COL.pi], ['Rainbow', 'ur5_or', COL.base], ['PPO', 'ur5_gr', COL.ppo]], human: 2.891, wall: 8, txt: '8 小时 2.5 个/分' },
    { k: 'XArm', t: 'XArm · 个/分钟', tend: 10, unit: '小时', dd: 2, ymax: 4, ser: [['Dreamer', 'xarm_blue', COL.pi], ['Rainbow', 'xarm_or', COL.base]], human: 3.055, wall: 10, txt: '10 小时 3.1 个/分' },
    { k: 'Sphero', t: 'Sphero · 距离（低更好）', tend: 130, unit: '分钟', dd: 2, ymax: 1, ser: [['Dreamer', 'sphero_blue', COL.pi], ['DrQv2', 'sphero_or', COL.base]], human: null, wall: 2, txt: '2 小时到 0.15（文中）' }];
  function s10(G) {
    G.add(L.grid(44, 22));
    if (ST.view === 1) {
      const H = 8, mx = 10;
      const bs = PANELS.map((P, i) => { const x = -10.5 + i * 7; const b = block(3.2, 1, 3.2, COL.pi, [x, 0.5, 0]); G.add(b, lab(P.k, [x, -1.4, 3], { size: 22 }), lab(`${P.wall} 小时\n${P.txt}`, [x, H * P.wall / mx + 1.8, 0], { size: 19 })); return [b, P]; });
      return { ctl: [{ key: 'view', label: '看', items: [[0, '曲线读数'], [1, '训练时长']] }], update(p) {
        bs.forEach(([b, P]) => { const h = Math.max(0.02, H * P.wall / mx * seg(p, 0, 0.7)); b.scale.y = h; b.position.y = h / 2; });
        cap('文中给的学成时间，都是真实世界的小时数');
        live(`<table class="mini"><thead><tr><th></th><th class="n">文中</th><th class="n">总步数</th></tr></thead><tbody>${PANELS.map((P, i) => `<tr><td>${P.k}</td><td class="n">${P.wall} h</td><td class="n">${num(R[i].steps)}</td></tr>`).join('')}</tbody></table><p class="src">总步数是分数文件里的最后一个 x，其中 A1 记到 78 分钟、UR5 记到约 9.8 小时，比图上画的长。</p>`);
      } };
    }
    const bars = [];
    PANELS.forEach((P, i) => {
      const x0 = -17.5 + i * 9.2, H = 8.5, w = 1.25;
      G.add(lab(P.t, [x0 + 2.6, H + 1.7, 0], { size: 18 }));
      wire(G, [[x0 - 0.3, H, 0], [x0 + 5.9, H, 0]], COL.env, { opacity: 0.25 });
      G.add(lab(String(P.ymax), [x0 - 0.6, H, 0], { size: 15 }));
      P.ser.forEach((s, j) => { const X = x0 + 0.8 + j * (w + 0.3); const b = block(w, 1, 1.4, s[2], [X, 0.5, 0]); G.add(b, lab(s[0], [X, j % 2 ? -2.1 : -1.0, 1.2], { size: 15 })); const tag = dyn(G, [X, 1, 0.9], { size: 16 }); bars.push({ b, P, s, H, tag, X, j }); });
      if (P.human != null) { const X = x0 + 0.8 + P.ser.length * (w + 0.3); const b = block(w, P.human / P.ymax * H, 1.4, COL.human, [X, P.human / P.ymax * H / 2, 0]); G.add(b, lab('人类', [X, P.ser.length % 2 ? -2.1 : -1.0, 1.2], { size: 15 }), lab(P.human.toFixed(2), [X, P.human / P.ymax * H + 0.6, 0.9], { size: 16 })); }
     
    });
    return { ctl: [{ key: 'view', label: '看', items: [[0, '曲线读数'], [1, '训练时长']] }], update(p) {
      const rows = [];
      bars.forEach(o => {
        const t = p * o.P.tend, v = interp(DATA[o.s[1]], t), d = DATA[o.s[1]], end = d[d.length - 1][0];
        const vv = v == null ? 0 : (t > end ? d[d.length - 1][1] : v), h = Math.max(0.02, clamp(vv, 0, o.P.ymax) / o.P.ymax * o.H);
        o.b.scale.y = h; o.b.position.y = h / 2; o.tag(v == null ? '–' : vv.toFixed(o.P.dd + (o.P.k === 'Sphero' ? 0 : 0)));
        rows.push({ k: o.P.k, s: o.s[0], v: v == null ? '–' : vv.toFixed(2), t });
      });
      bars.forEach(o => { /* keep the value tag just above its bar */ const h = o.b.scale.y; G.children.forEach(c => { if (c.isSprite && Math.abs(c.position.x - o.X) < 1e-6 && Math.abs(c.position.z - 0.9) < 1e-6) c.position.y = h + 0.6 + (o.j % 2 ? 0.8 : 0); }); });
      cap(`进度 <b>${(p * 100).toFixed(0)}%</b>：A1 第 ${(p * 59.1).toFixed(0)} 分 · UR5 第 ${(p * 8).toFixed(1)} 时 · XArm 第 ${(p * 10).toFixed(1)} 时 · Sphero 第 ${(p * 130).toFixed(0)} 分`);
      live(`<table class="mini"><thead><tr><th></th><th></th><th class="n">值</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.k}</td><td>${r.s}</td><td class="n">${r.v}</td></tr>`).join('')}</tbody></table><p class="src">Sphero 的值越低越好。曲线噪声大，单点不要过度解读。</p>`);
    } };
  }
  /* ---------- 11 adaptation ---------- */
  function s11(G) {
    G.add(L.grid(44, 22));
    const ctl = [{ key: 'ad', label: '场景', items: [[0, 'XArm 日出'], [1, 'A1 被推']] }];
    if (ST.ad === 1) {
      const d = DATA.a1_tail, n = d.length, X = i => -2 + i * 14 / n, sc = 8 / 14;
      const q = quad(G, [-9, 0, 0], 1.2), pole = L.cyl(0.13, 0.13, 7, COL.human); G.add(pole);
      const im = inst(BOX, n); G.add(im); const c = hex3(COL.pi), c2 = hex3(COL.grad);
      G.add(lab('Dreamer 平均奖励，每 3 分钟一柱', [5, 9.6, 0], { size: 20 }), lab('60 分钟：开始推（文中）', [X(d.findIndex(x => x[0] >= 60)) + 2, 8.6, 0], { size: 18 }));
      const mk = X(d.findIndex(x => x[0] >= 60)); wire(G, [[mk - 0.25, 0, 0.5], [mk - 0.25, 8, 0.5]], COL.grad, { dashed: 1, opacity: 0.9 });
      wire(G, [[X(0) - 0.5, 14 * sc, 0], [X(n - 1) + 0.5, 14 * sc, 0]], COL.env, { opacity: 0.3 }); G.add(lab('14', [X(0) - 1, 14 * sc, 0], { size: 16 }));
      ctl.length = 1;
      return { ctl, update(p) {
        const t = 40 + p * 38;
        d.forEach((b, i) => { const on = b[0] <= t, h = on ? Math.max(0.02, b[1] * sc) : 0.0001; setI(im, i, [X(i), h / 2, 0], on ? [0.72, h, 0.8] : [0.0001, 0.0001, 0.0001]); colI(im, i, b[0] >= 60 ? c2 : c); }); done(im);
        const ph = (p * 8) % 1, hit = ph < 0.25 && t > 60; pole.rotation.z = 1.2 - (hit ? 0.5 * Math.sin(ph * 4 * Math.PI) : 0); pole.position.set(-7 + (hit ? -1 : 0), 2.6, 0);
        q.set(hit ? Math.sin(ph * 4 * Math.PI) * 1.2 : 0, 1.35, p * 180, 1.0);
        const cur = d.filter(b => b[0] <= t).slice(-1)[0];
        cap(`分数文件第 <b>${t.toFixed(0)}</b> 分钟 · ${t > 60 ? '红柱：60 分钟之后' : '蓝柱：60 分钟之前'}`);
        const pre = d.filter(b => b[0] >= 45 && b[0] < 60), post = d.filter(b => b[0] >= 60), avg = a => a.reduce((s, x) => s + x[1], 0) / a.length;
        live(`<table class="mini"><tbody><tr><td>这一柱</td><td class="n">${cur ? cur[1].toFixed(2) : '–'}</td></tr><tr><td>45–60 分钟平均</td><td class="n">${avg(pre).toFixed(2)}</td></tr><tr class="on"><td>60–78 分钟平均</td><td class="n">${avg(post).toFixed(2)}</td></tr></tbody></table><p class="src">scores/a1_dreamer.json 按 20 Hz 换算。文件没有标记推的时刻，60 分钟取自正文。</p>`);
      } };
    }
    ctl.push({ key: 'axis', label: '算法', items: [[0, '真实墙钟'], [1, '图 A.1 的轴']] });
    const fig = ST.axis === 1, d = fig ? DATA.adapt_plot : DATA.adapt_wall, n = d.length, tmax = fig ? 18.2 : 16.5, X = t => -14 + t * 28 / tmax, ymax = fig ? 10 : 3, sc = 8 / ymax, marks = fig ? [[9.69, '日出（图上 9.69）'], [14.89, '恢复（图上 14.89）']] : [[8.46, '日出（墙钟 8.46 h）'], [12.63, '恢复（墙钟 12.63 h）']];
    const im = inst(BOX, n); G.add(im); const c = hex3(COL.pi), c2 = hex3(COL.sto), c3 = hex3(COL.wm);
    marks.forEach(([t, s], i) => { wire(G, [[X(t), 0, 0.6], [X(t), 8.6, 0.6]], i ? COL.wm : COL.sto, { dashed: 1, opacity: 0.95 }); G.add(lab(s, [X(t) + (i ? 2.4 : -2.4), 9.4, 0.6], { size: 18 })); });
    G.add(lab(fig ? '每回合物体数 × 0.65（我的换算，接近图 A.1 的纵轴）' : '每分钟放好的物体数（物体数 ÷ 墙钟分钟）', [0, 11, 0], { size: 20 }), lab(`${ymax}`, [-14.9, 8, 0], { size: 16 }), lab('小时', [14.8, -1, 0], { size: 16 }));
    wire(G, [[-14, 8, 0], [14, 8, 0]], COL.env, { opacity: 0.25 });
    [0, 4, 8, 12, 16].forEach(t => G.add(lab(String(t), [X(t), -1, 0.6], { size: 15 })));
    const w = 28 / tmax * (d[1][0] - d[0][0]) * 0.86;
    return { ctl, update(p) {
      const t = p * tmax;
      d.forEach((b, i) => { const on = b[0] <= t, h = on ? Math.max(0.02, clamp(b[1], 0, ymax) * sc) : 0.0001; setI(im, i, [X(b[0]), h / 2, 0], on ? [w, h, 0.9] : [0.0001, 0.0001, 0.0001]); colI(im, i, b[0] < marks[0][0] ? c : (b[0] < marks[1][0] ? c2 : c3)); }); done(im);
      const avg = (a, b) => { const s = d.filter(x => x[0] >= a && x[0] < b); return s.reduce((v, x) => v + x[1], 0) / Math.max(1, s.length); };
      cap(`${fig ? '图 A.1 的轴：横轴约为步数 ÷ 2500' : '真实墙钟'} · <b>${t.toFixed(1)}</b> 小时`);
      live(`<table class="mini"><thead><tr><th>阶段</th><th class="n">平均</th></tr></thead><tbody><tr><td>日出前（后半段）</td><td class="n">${avg(marks[0][0] / 2, marks[0][0]).toFixed(2)}</td></tr><tr><td>日出到恢复</td><td class="n">${avg(marks[0][0], marks[1][0]).toFixed(2)}</td></tr><tr class="on"><td>恢复之后</td><td class="n">${avg(marks[1][0], 99).toFixed(2)}</td></tr></tbody></table><p class="src">同一份 xarm_adapt.csv，总墙钟 16.12 小时，每回合 251 步。对比第 10 幕人类 3.06 个/分钟。</p>`);
    } };
  }
  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player ---------- */
  let cur = 0, api = null, playing = !L.reduced(), t0 = 0, pNow = 0, tw = null;
  const HOLD = 1.8;
  const aspectFix = () => { const el = $('stage'), asp = (el.clientWidth || 1) / (el.clientHeight || 1); return Math.min(2.2, Math.max(1, 1.45 / asp)); };
  function fly(th, ph, d, tg) { let dth = th - S.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth)); d *= aspectFix(); tw = { t0: performance.now(), from: [S.theta, S.phi, S.dist, S.target.clone()], to: [S.theta + dth, ph, d, new THREE.Vector3(...tg)] }; refDist = d; }
  function setPlay(on) { playing = on; $('play').textContent = on ? '❚❚ 暂停' : '▶ 播放'; $('play').setAttribute('aria-label', on ? '暂停' : '播放'); }
  function buildG() { L.clear(root); LABS = []; PICKS = []; lastCap = null; const G = new THREE.Group(); root.add(G); api = BUILD[cur](G); }
  function refresh() { buildG(); makeCtl(); syncCtl(); lastLive = null; api.update(pNow); }
  function syncCtl() {
    $('ctl').querySelectorAll('[data-key]').forEach(e => {
      const k = e.dataset.key;
      if (e.tagName === 'BUTTON') e.setAttribute('aria-pressed', String(+e.dataset.v === ST[k]));
      else { if (document.activeElement !== e) e.value = ST[k]; const c = (api.ctl || []).find(x => x.key === k); const o = e.parentElement.querySelector('output'); if (o && c) o.textContent = c.fmt(+ST[k]); }
    });
  }
  function makeCtl() {
    const box = $('ctl'), c = api.ctl;
    if (!c) { box.hidden = true; box.innerHTML = ''; return; }
    if (document.activeElement && box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    box.hidden = false;
    box.innerHTML = c.map(x => x.type === 'range'
      ? `<label class="rng"><span>${x.label}</span><input type="range" data-key="${x.key}" data-lazy="${x.lazy ? 1 : 0}" min="${x.min}" max="${x.max}" step="${x.step}" value="${ST[x.key]}" aria-label="${x.label}"><output>${x.fmt(+ST[x.key])}</output></label>`
      : `<div class="row"><span>${x.label}</span>${x.items.map(i => `<button type="button" data-key="${x.key}" data-v="${i[0]}" aria-pressed="${i[0] === ST[x.key]}">${i[1]}</button>`).join('')}</div>`).join('');
  }
  function go(i, p0 = 0) {
    cur = (i + SCENES.length) % SCENES.length; showInfo(cur);
    if (!S) return;
    const sc = SCENES[cur]; fly(...sc.cam); refDist = sc.cam[2] * aspectFix();
    buildG(); makeCtl();
    pNow = p0; t0 = performance.now() - p0 * sc.dur * 1000; api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
  }
  if (S) {
    S.onTick(() => {
      if (playing && api) {
        const sc = SCENES[cur], el = (performance.now() - t0) / 1000;
        if (el > sc.dur + HOLD) { t0 = performance.now(); pNow = 0; } else pNow = Math.min(1, el / sc.dur);
        api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
      }
      if (tw) { const k = L.reduced() ? 1 : Math.min(1, (performance.now() - tw.t0) / 900), e = L.ease(k), a = tw.from, b = tw.to; S.setView(L.lerp(a[0], b[0], e), L.lerp(a[1], b[1], e), L.lerp(a[2], b[2], e), a[3].clone().lerp(b[3], e).toArray()); if (k >= 1) tw = null; }
      const f = clamp(S.dist / refDist, 0.6, 1.6); for (const sp of LABS) sp.scale.copy(sp.userData.s0).multiplyScalar(f);
    });
    S.onClick(() => PICKS, hit => { const g = hit?.object?.userData?.go ?? hit?.object?.parent?.userData?.go; if (g != null) go(g); });
    S.onHover(() => PICKS, hit => { $('stage').style.cursor = hit ? 'pointer' : ''; });
  }
  $('ctl').addEventListener('click', e => { const b = e.target.closest('button[data-key]'); if (!b) return; ST[b.dataset.key] = +b.dataset.v; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); refresh(); });
  $('ctl').addEventListener('input', e => { const r = e.target; if (r.tagName !== 'INPUT') return; const c = (api.ctl || []).find(x => x.key === r.dataset.key), o = r.parentElement.querySelector('output'); if (o && c) o.textContent = c.fmt(+r.value); ST[r.dataset.key] = +r.value; refresh(); });
  $('ctl').addEventListener('pointerdown', e => e.stopPropagation());
  $('play').onclick = () => { if (!playing) t0 = performance.now() - pNow * SCENES[cur].dur * 1000; setPlay(!playing); };
  $('scrub').oninput = e => { setPlay(false); pNow = e.target.value / 1000; if (api) api.update(pNow); };
  $('prev').onclick = () => go(cur - 1); $('next').onclick = () => go(cur + 1);
  btns.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); });
  stepsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; go(+b.dataset.i); if (!document.body.classList.contains('embed')) $('stage').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' && e.key !== ' ') return; if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1); else if (e.key === ' ') { e.preventDefault(); $('play').click(); } });
  const s0 = clamp((parseInt(qs.get('scene'), 10) || 1) - 1, 0, SCENES.length - 1), pq = qs.get('p');
  setPlay(playing && pq == null);
  go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0));
})();
