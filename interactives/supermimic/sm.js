'use strict';
/* SuperMimic (arXiv 2610.28480) taken apart into eleven animated scenes. Network sizes and hyperparameters come
   from the paper's Tables A.4 and A.5; bars in scenes 7, 9 and 10 use values read from the paper's vector figures.
   Every scene builds into its own group and exposes update(p), a pure function of the timeline p in [0,1], so
   pausing, scrubbing and looping are the same call. No model runs here and the robot is a hand-made figure. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { sim: 0x8e9bb8, buf: 0x3aa8e0, wm: 0x4fc98a, pi: 0x38d1ff, crit: 0x9d8cff, rew: 0xf2c14e, grad: 0xff7a59, frozen: 0x5f7fb0, noise: 0xd45fa0, enc: 0x7cb8ff, ref: 0xe05d5d, robot: 0xc9d4ea, pred: 0xf0963c };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  const SCENES = [
    { n: 1, part: '总览', title: '一个循环，两个学习者', sub: '收集 → 拟合世界模型 → 通过模型改进策略', dur: 15, cam: [0.2, 1.0, 34, [0, 3.4, 0.2]],
      html: dl([['收集', '策略 π 在仿真器里跑，存进回放缓存'], ['拟合', '从缓存取 8 步窗口，训练世界模型 f'], ['改进', '冻结 f，想象 32 步，把回报反传给 π']]) +
        '<p>三步在同一个循环里转，不是“先训好模型再训策略”。世界模型和策略一起变好：策略越好，收集到的数据越接近它要走的地方；模型越准，反传回来的梯度越可信。</p>' +
        '<p>关键的一点：<b>梯度从来不经过仿真器。</b>仿真器只负责产生数据，所以它可以是接触不光滑、代码也不可微的普通刚体仿真器。旧策略的数据也一直有效，因为物理规律不取决于是谁在开车。</p>' +
        '<p>下面点三个站可以跳到对应的一幕。</p>' + src('§3.1 · 图 2 · 算法 A.1') },
    { n: 2, part: '第 1 步 · 收集', title: '4096 个机器人写进回放缓存', sub: '加动作噪声；从学得差的地方多重置', dur: 15, cam: [-0.1, 0.86, 36, [0.8, 1.4, 1.6]],
      html: dl([['环境数', '每 GPU 4096'], ['控制频率', '50 Hz，每步 4 个 5 ms 子步'], ['动作噪声', 'ε ~ N(0, 0.1²)，每个动作维度'], ['缓存', '每环境 1000 步，覆盖最旧'], ['存什么', '(s, a+ε, ξ)，存的是带噪声的动作']]) +
        '<p>动作噪声不是为了探索，只是让世界模型见到更宽的动作范围。论文说它是可选的。策略本身是确定性的。</p>' +
        '<p>重置不是均匀的。动作库按 1 秒切成区间，每个区间记一个当前回报 G。重置点按三份混合来抽：50% 均匀，40% 偏向回报低的区间，10% 按过去的权重，这样学会了的难动作也不至于完全不练。</p>' +
        guess('左边真的画了 64 × 64 = 4096 个小人。回放缓存一格代表约 100 个环境 × 40 步。下方柱子的 G 是假数据，混合公式是真的。') + src('§3.1 · 附录 D.1 · 表 A.5') },
    { n: 3, part: '第 2 步 · 世界模型', title: '世界模型里有什么', sub: '三层 2048 的 MLP；为什么可以是确定性的', dur: 14, cam: [0.16, 1.14, 30, [1.2, 3.6, 0]],
      html: dl([['动力学', 'ŝₜ, aₜ, ξ → ŝₜ₊₁，MLP (2048, 2048, 2048)'], ['奖励头', 'ŝₜ, aₜ, gₜ → r̂ₜ₊₁'], ['观测头', 'ŝₜ, ξ → ō̂ₜ（不带噪声）'], ['终止头', 'ŝₜ, gₜ → d̂ₜ ∈ [0,1]']]) +
        '<p>它要替代的是仿真器，而仿真器的随机性来源都是已知的，所以模型不用学分布，只用<b>确定性</b>地预测：</p><ul>' +
        '<li><b>物理参数</b>（摩擦、关节标定偏移、躯干质心）：写进 ξ，直接喂给模型。</li>' +
        '<li><b>动作噪声 ε</b>：缓存里存的就是加噪后的动作，模型看得到。</li>' +
        '<li><b>传感器噪声 η</b>：模型只预测干净观测 ō̂，噪声在模型外面重新加上。</li></ul>' +
        '<p>论文因此去掉了 BeyondMimic 的随机推搡：状态突然跳变，确定性模型学不了。</p>' +
        guess('状态 s 里有什么、多少维，以及四个头哪些是学的、哪些是解析算的，论文都没写。第三方复现 SuperMimic-Reproduced 的选择是奖励和观测头解析算、终止头学习，那是它的决定，不是作者的。') + src('§3.2 · 表 A.3 · 表 A.4') },
    { n: 4, part: '第 2 步 · 世界模型', title: '8 步自回归拟合', sub: '模型吃自己的预测，所以学会纠正自己', dur: 15, cam: [0.03, 1.2, 24, [0, 2.2, 1.0]],
      html: dl([['窗口', 'k = 8 步 = 0.16 秒'], ['起点', 'ŝ₀ = s₀（缓存里记录的真实状态）'], ['动作', '缓存里记录的动作，不是当前策略的'], ['批量', '每次更新 10 批 × 2048 个窗口']]) +
        '<p>只训练“下一步”的模型，单步误差很小，但一旦拿自己的预测继续往下走，误差会被放大，因为它从没见过自己犯错后的状态。</p>' +
        '<p>自回归拟合把第 j 步的预测喂回去算第 j+1 步，8 步的误差全部计入损失，并且一路反传回去。模型因此见到了自己造成的偏差，也被要求把它拉回来。</p>' +
        '<div class="eq-mini">L = Σⱼ ‖ŝⱼ−sⱼ‖² + (r̂ⱼ−rⱼ)² + ‖ō̂ⱼ−ōⱼ‖² + BCE(d̂ⱼ, dⱼ)</div>' +
        guess('误差曲线是我设的，只表示趋势，步距也放慢了好让姿态看得出差别（真实 8 步只有 0.16 秒）。论文说这样训练后想象 32 步也稳，甚至“无限长”也稳，但没有给 32 步的误差数据。') + src('§3.2 式 (1) · §3.3') },
    { n: 5, part: '第 3 步 · 改进策略', title: '想象 32 步，把回报反传', sub: '世界模型冻结，梯度穿过它回到每一步的动作', dur: 17, cam: [0.03, 1.1, 31, [-0.6, 4.2, 0]],
      html: dl([['起点', '缓存里的状态 s₀ 和它的 ξ'], ['长度', 'H = 32 步 = 0.64 秒'], ['批量', '4096 条'], ['每步', 'aₜ = π(ō̂ₜ + ηₜ, gₜ)，ŝₜ₊₁ = f(ŝₜ, aₜ, ξ)']]) +
        '<p><b>前向：</b>从真实状态出发，策略和世界模型轮流算 32 步。传感器噪声每步重新加。所有的 π 是同一个网络。</p>' +
        '<p><b>反向：</b>回报对动作可导，动作对 θ 可导，状态又经世界模型的雅可比传到下一步。所以第 20 步摔倒的代价，能直接告诉第 5 步的动作该怎么改。</p>' +
        '<p>每步奖励乘 γᵗ 和存活权重 ĉₜ。ĉ 由预测的终止概率连乘而来，是软的，所以“别摔倒”也有梯度。超出 32 步的部分交给评论家。</p>' +
        '<p>按 γ = 0.99 算，γ³² = 0.725，也就是说奖励恒定时，<b>大约 73% 的折扣回报其实在窗口外面</b>（我的计算，见第 7 幕）。</p>' +
        guess('下方柱高是真实的 γᵗ，ĉ 按一条假设的存活曲线画。真实每步的 f 和 π 共用权重，图中画成 32 份只为看清时间展开。') + src('§3.3 式 (2) · 算法 A.1') },
    { n: 6, part: '为什么 · 梯度', title: '解析梯度 vs. PPO 的估计', sub: '同一个曲面，这一幕的数字是页面当场算的', dur: 15, cam: [0, 0.82, 24, [0, 0.9, -0.6]],
      html: dl([['PPO', '从采样估计：g = E[(J−b)·∇log π]'], ['BPTT', '直接求导：g = ∇ₐJ']]) +
        '<p>PPO 把动力学当黑箱：撒一把随机动作，看哪些回报高，再往那边挪。每条青线是用一小批样本估出的方向，它们的散开程度就是方差。样本越多越准，但收敛得慢，所以要堆环境、堆 GPU。</p>' +
        '<p>BPTT 能直接读出坡度，一次就是这个方向。论文认为在短视野内它的方差低得多。这不是没有代价：它必须有一个可微模型，而梯度准不准取决于这个模型准不准。</p>' +
        '<p>论文的消融实验（图 5b）把两边放到同一个世界模型上，排除了仿真速度的因素：在走、跑、冲刺这部分 LAFAN1 动作上，要达到 PPO 的最好训练回报，SuperMimic 少用约 64 倍的想象步数。我从矢量图读到的是 10<sup>8.98</sup> 对 10<sup>10.77</sup> 步，比值约 62。</p>' +
        guess('曲面是我写的二维函数，不是真实回报，比值不能外推到真实任务。') + src('§3.3 · §4.2 · 图 5(b)') },
    { n: 7, part: '为什么 · 评论家', title: '评论家让 32 步够用', sub: '切换 H，看窗口内外各占多少；柱子是原图读数', dur: 15, cam: [0.0, 1.14, 34, [0, 3.0, -1.0]],
      html: dl([['γ', '0.99，有效视野约 100 步 = 2 秒'], ['评论家', 'MLP (256, 128)，输入 ŝ, g, ξ'], ['目标', 'GAE，λ = 0.95，只用想象数据'], ['默认 H', '32 步']]) +
        '<p>H 太短，策略只看眼前。H 太长，每次更新更贵，长链上的梯度也更难用。评论家负责估计“窗口之后还能拿多少”，把短视的问题补上。</p>' +
        '<p>读图 4(b)(c) 的数：不带评论家时 H = 16 训练失败（回报 0.25）；带评论家时 H = 16 就够了（0.84），和不带评论家的 H = 32（0.84）一样好。H = 32 带评论家到回报 0.82 最快（约 0.89 小时）。H 从 64 加到 128，时间几乎变成 3 倍。</p>' +
        '<p>回报差不多时，评论家还改变行为。在静止 T 字站姿下受 0.5 到 4 m/s 的推力：带评论家的 0.5 到 2.4 秒内站稳；不带评论家的连 0.5 m/s 都一直踉跄，4 m/s 直接摔倒。因为恢复平衡的回报在窗口之外，只看窗口内的奖励和就看不到它。</p>' +
        src('§3.3 式 (3) · §4.3 · 图 4(b)(c)') },
    { n: 8, part: '策略网络', title: '一个解码器，多个编码器', sub: '不同目标接口共享解码器和世界模型', dur: 16, cam: [0.03, 1.12, 29, [0.8, 2.2, 0.2]],
      html: dl([['动作编码器', '未来 10 帧参考 → MLP (2048,1024,512,256) → z'], ['速度编码器', '(vₓ,v_y,ω_z)＋观测特征 → MLP (256,256) → z'], ['z', '32 维，tanh 限幅'], ['解码器', 'z＋10 帧观测（930 维）→ MLP (2048,1024,512,256) → a（29 维）']]) +
        '<p>解码器负责“怎么动身体”，编码器负责“翻译目标”。换一个目标形式（速度命令、末端位姿、SMPL 姿态）只加一个编码器，世界模型不用重训，因为身体的物理没变。</p>' +
        '<p><b>两种训练信号：</b>蒸馏用动作跟踪奖励，命令从参考动作读；RL 直接用这个接口自己的奖励（比如速度跟踪），穿过世界模型反传。</p>' +
        '<p><b>注意动画后半段：</b>速度任务的梯度穿过解码器到达速度编码器，但解码器的权重不更新（stop-gradient）。论文在局限里说，正因如此，同时训练等价于先训好跟踪器再训编码器。</p>' +
        '<p>按隐藏层宽度算，解码器约 473 万个参数（只算线性层，我的计算）。</p>' + src('附录 B 式 (A.1) · 表 A.4 · §6') },
    { n: 9, part: '结果 · 摊销', title: '动作多 264 倍，模型没变差多少', sub: '柱子是图 3(b)(c) 的读数', dur: 15, cam: [-0.06, 0.76, 44, [0.4, 1.0, 0.2]],
      html: dl([['数据长度', '1、7、40、264 小时'], ['到目标回报', '0.54、1.35、1.91、1.89 GPU 小时'], ['8 步误差', '6.8、7.4、11.0、9.9（×10⁻³）']]) +
        '<p>所有动作都是同一个人形身体做的。多出来的片段提供的是同一套身体和接触动力学的更多证据，不要求模型多学一门新东西。这就是“摊销”：一个模型覆盖全部动作，而不是每个动作估计一次。</p>' +
        '<p>数据多 264 倍，算力只多约 3.5 倍。如果和数据成正比，264 小时要约 142 GPU 小时（虚线框）。</p>' +
        '<p>误差“稳定”是相对的：1 到 264 小时实际涨了 46%，只是没有跟着数据涨。这个误差只算状态，按一个论文没给出定义的名义误差归一化。图 3(b) 的“目标回报”也没给具体数值。</p>' + src('§4.1 · §4.2 · 图 3(b)(c)') },
    { n: 10, part: '结果 · 算力', title: '算力对账：21,504 个方块对 3 个', sub: '一个方块 = 1 GPU 小时，按真实数量画', dur: 15, cam: [-0.2, 1.4, 66, [0.5, 11.5, 0]],
      html: dl([['SONIC', '128 × 168 = 21,504 GPU·h（L40）'], ['SuperMimic', '1 × 3 = 3 GPU·h（H100）'], ['比值', '约 7168 倍，论文写 >1000×'], ['受控对比', 'PPO-Sim 8×18 = 144 对 1.2 GPU·h']]) +
        '<p>左边的墙是 SONIC 公布的训练开销，一格一个 GPU 小时。SuperMimic 用 1 张 H100 跑 3 小时，超过 SONIC 公布检查点的归一化回报（0.90）。</p>' +
        '<p>两边并不完全同条件：SONIC 用 611 小时数据，SuperMimic 用其中公开的 264.56 小时，差 2.3 倍；GPU 型号也不同，H100 峰值浮点是 L40 的 0.74 倍，张量核心是 5.5 倍。论文的理由是，这些加起来也解释不了上千倍。</p>' +
        '<p>更干净的是右边的受控对比：同样的动作、观测、奖励、网络大小，都在 LAFAN1 上。PPO-Sim 用 8 张卡 18 小时（144 GPU·h）只到 0.72，还到不了目标；SuperMimic 用 1.2 GPU·h 到 0.82。这个比值是<b>至少 120 倍</b>（我的计算）。</p>' + src('§4.1 · 图 3(a) · 图 4(a)') },
    { n: 11, part: '部署', title: '上真机时只留下策略', sub: '世界模型、评论家、ξ 全部留在训练里', dur: 15, cam: [0.06, 1.08, 25, [-1.0, 2.6, 0]],
      html: dl([['输入', '最近 10 帧本体观测，加参考动作'], ['观测', 'q−q⁰ 29，q̇ 29，IMU 角速度 3，投影重力 3，上一动作 29'], ['输出', 'q_sp = α·a + q⁰'], ['底层', '低增益 PD，设定点相当于力矩的代理']]) +
        '<p>训练时世界模型和评论家都能看到完整状态和 ξ，但部署的策略只有带噪声的本体感觉和目标。训练时每步都把传感器噪声加回去，就是为了这一刻。</p>' +
        '<p>同一个策略、不针对动作调参，在真实 Unitree G1 上做了四种动作：跳跃跨步、侧滚（躯干和四肢都接触地面）、90° 空翻和原地 360° 空翻。</p>' +
        guess('小人和动作是示意。真机照片见原文第 9 页图 6，视频在项目主页。真实世界的数据没有参与训练，世界模型只见过仿真器。') + src('§4.4 · 附录 A · 图 6') }
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
    $('infoTag').textContent = `第 ${s.n} 幕 · ${s.part}`;
    $('infoTitle').textContent = s.title;
    $('infoBody').innerHTML = s.html;
    $('stepNo').textContent = `${s.n} / ${SCENES.length}`;
    stepsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(+b.dataset.i === i)));
    btns.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
  }
  let lastCap = null;
  const cap = h => { if (h !== lastCap) { lastCap = h; $('cap').innerHTML = h; } };

  /* ---------- 3D helpers ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.6, phi: 1.0, dist: 24, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);

  let LABS = [], refDist = 24, PICKS = [];
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: o.size || 26, pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Q = new THREE.Quaternion(), _E = new THREE.Euler(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) {
    const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65, emissive: o.emissive });
    const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im;
  }
  function setI(im, n, p, s, q) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, q || _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function segLines(n, color, op = 0.8) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })); l.frustumCulled = false; return l;
  }
  function setSeg(l, k, a, b) { const A = l.geometry.attributes.position.array; A.set(a, k * 6); A.set(b, k * 6 + 3); }
  /* a block whose glow can be driven: k = 0 dark, 1 fully lit */
  function block(w, h, d, color, pos, o = {}) {
    const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m;
  }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  /* point at fraction t along a polyline */
  function along(pts, t) {
    const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1];
    return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)];
  }
  /* a stream of little balls along a polyline */
  function stream(G, n, color, r = 0.16) {
    const im = inst(BALL, n, { emissive: 0x000000 }); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const arc = (a, b, h, n = 14) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n; o.push([L.lerp(a[0], b[0], t), L.lerp(a[1], b[1], t) + h * Math.sin(Math.PI * t), L.lerp(a[2], b[2], t)]); } return o; };
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.5, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };

  /* ---------- the hand-made humanoid: cylinders on a small joint tree ---------- */
  function robot(color, o = {}) {
    const m = L.mat(color, { opacity: o.opacity, roughness: 0.5, depthWrite: o.opacity == null || o.opacity > 0.6 });
    const G = new THREE.Group(), mesh = g => new THREE.Mesh(g, m);
    const limb = (len, r) => { const g = new THREE.Group(), c = mesh(new THREE.CylinderGeometry(r, r * 0.82, len, 8)); c.position.y = -len / 2; g.add(c); const j = mesh(new THREE.SphereGeometry(r, 8, 6)); g.add(j); return g; };
    const pelvis = new THREE.Group(); G.add(pelvis);
    const hip = mesh(new THREE.BoxGeometry(0.26, 0.1, 0.14)); pelvis.add(hip);
    const tor = mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.36, 10)); tor.position.y = 0.2; pelvis.add(tor);
    const head = mesh(new THREE.SphereGeometry(0.085, 12, 9)); head.position.y = 0.48; pelvis.add(head);
    const legs = [-1, 1].map(s => { const th = limb(0.3, 0.05); th.position.set(s * 0.09, -0.04, 0); const sh = limb(0.3, 0.042); sh.position.y = -0.3; th.add(sh); const ft = mesh(new THREE.BoxGeometry(0.08, 0.035, 0.18)); ft.position.set(0, -0.31, 0.04); sh.add(ft); pelvis.add(th); return { th, sh }; });
    const arms = [-1, 1].map(s => { const up = limb(0.2, 0.034); up.position.set(s * 0.18, 0.34, 0); const lo = limb(0.2, 0.028); lo.position.y = -0.2; up.add(lo); pelvis.add(up); return { up, lo, s }; });
    G.userData.set = q => {
      G.position.set(...q.p); pelvis.rotation.set(q.pitch || 0, q.yaw || 0, q.roll || 0, 'YXZ');
      legs[0].th.rotation.x = -q.hL; legs[1].th.rotation.x = -q.hR; legs[0].sh.rotation.x = q.kL; legs[1].sh.rotation.x = q.kR;
      arms[0].up.rotation.x = -q.sL; arms[1].up.rotation.x = -q.sR; arms[0].lo.rotation.x = -q.eL; arms[1].lo.rotation.x = -q.eR;
      arms.forEach((a, i) => { a.up.rotation.z = a.s * (q.spread || 0.12); });
    };
    return G;
  }
  const STAND = 0.65;
  /* poses are written by hand; t in seconds. Facing +z unless yaw is set. */
  function clip(name, t) {
    const pi = Math.PI;
    if (name === 'walk') {
      const ph = 2 * pi * t / 0.9, s = Math.sin(ph);
      return { p: [0, STAND - 0.015 + 0.015 * Math.cos(2 * ph), 0], pitch: 0.04, hL: 0.48 * s, hR: -0.48 * s, kL: 0.2 + 0.55 * Math.max(0, -Math.cos(ph + 0.6)), kR: 0.2 + 0.55 * Math.max(0, Math.cos(ph + 0.6)), sL: -0.4 * s, sR: 0.4 * s, eL: 0.45, eR: 0.45 };
    }
    if (name === 'skip') {
      const u = (t % 0.9) / 0.9, air = Math.sin(pi * u), s = Math.sin(2 * pi * t / 1.8);
      return { p: [0, STAND + 0.26 * air, 0], pitch: 0.05, hL: 0.15 + 0.75 * Math.max(0, s), hR: 0.15 + 0.75 * Math.max(0, -s), kL: 0.2 + 1.1 * Math.max(0, s), kR: 0.2 + 1.1 * Math.max(0, -s), sL: -0.9 * s, sR: 0.9 * s, eL: 0.7, eR: 0.7 };
    }
    if (name === 'roll') {
      const u = (t % 2.2) / 2.2, a = seg(u, 0.14, 0.82), d = Math.sin(pi * clamp(u / 0.96, 0, 1));
      return { p: [L.lerp(-0.45, 0.45, a), STAND - 0.46 * Math.min(1, d * 1.6), 0], roll: 2 * pi * a, pitch: 0.2 * d, hL: 0.9 * d, hR: 0.9 * d, kL: 1.5 * d, kR: 1.5 * d, sL: 1.1 * d, sR: 1.1 * d, eL: 1.0 * d, eR: 1.0 * d };
    }
    if (name === 'flip' || name === 'flip90') {
      const T = 1.9, u = (t % T) / T, cr = seg(u, 0, 0.22) * (1 - seg(u, 0.22, 0.3)), s = clamp((u - 0.28) / 0.42, 0, 1), land = seg(u, 0.7, 0.78) * (1 - seg(u, 0.8, 1));
      const air = u > 0.28 && u < 0.7, tuck = air ? Math.sin(pi * s) : 0, tot = name === 'flip' ? -2 * pi : -pi / 2;
      const pitch = tot * L.ease(s) * (name === 'flip' ? 1 : (1 - seg(u, 0.7, 0.95)));
      return { p: [0, STAND - 0.2 * cr - 0.2 * land + 0.95 * (air ? 4 * s * (1 - s) : 0), 0], pitch, hL: 0.8 * cr + 1.5 * tuck + 0.7 * land, hR: 0.8 * cr + 1.5 * tuck + 0.7 * land, kL: 1.3 * cr + 2.0 * tuck + 1.2 * land, kR: 1.3 * cr + 2.0 * tuck + 1.2 * land, sL: -0.8 * cr + 2.2 * (air ? 1 - tuck : 0) * 0.6 + 0.7 * tuck, sR: -0.8 * cr + 2.2 * (air ? 1 - tuck : 0) * 0.6 + 0.7 * tuck, eL: 0.8 * tuck + 0.3, eR: 0.8 * tuck + 0.3 };
    }
    return clip('walk', t);
  }
  /* a pose with a prediction error of size e added, always in the same direction so the eye can follow it */
  function drift(q, e) {
    const o = { ...q, p: [q.p[0] + e * 0.5, q.p[1] - Math.abs(e) * 0.5, q.p[2] + e * 1.0] };
    o.pitch = (q.pitch || 0) + e * 1.6; o.roll = (q.roll || 0) + e * 0.7; o.hL = q.hL + e * 1.4; o.hR = q.hR - e * 1.2; o.sL = q.sL + e * 2; o.sR = q.sR - e * 2;
    return o;
  }
  function pose(r, q, at, sc, yaw) { const c = { ...q, yaw: yaw ?? q.yaw, p: [0, 0, 0] }; r.userData.set(c); r.position.set(at[0] + q.p[0] * sc, at[1] + q.p[1] * sc, at[2] + q.p[2] * sc); r.scale.setScalar(sc); }

  /* ---------- scene 1: the loop ---------- */
  function s1(G) {
    G.add(L.grid(34, 34));
    const xA = -9, xB = 0, xC = 9, zS = -1.4;
    const plate = (x, w) => { const m = block(w, 0.14, 6, 0x2b3650, [x, 0, zS], { opacity: 0.55 }); G.add(m); return m; };
    plate(xA, 7.2); plate(xB, 7.2); plate(xC, 7.2);
    const buf = block(26, 1.0, 2.6, COL.buf, [0, 0.5, 4.6]); G.add(buf);
    G.add(lab('回放缓存 B：(s, a+ε, ξ)', [0, 1.65, 4.6]));
    const simB = block(2.6, 1.6, 2.2, COL.sim, [xA, 1.0, zS]); const piA = block(1.9, 1.1, 1.5, COL.pi, [xA, 3.7, zS]);
    const fB = block(2.8, 1.9, 2.4, COL.wm, [xB, 2.0, zS]);
    const fC = block(2.4, 1.5, 2.0, COL.wm, [xC, 1.0, zS]); const piC = block(1.9, 1.1, 1.5, COL.pi, [xC, 3.7, zS]);
    G.add(simB, piA, fB, fC, piC);
    const rob = robot(COL.robot); G.add(rob);
    G.add(lab('MuJoCo Warp', [xA, 2.25, zS + 1.2]), lab('策略 π', [xA, 4.75, zS]), lab('世界模型 f', [xB, 3.5, zS]), lab('f', [xC - 1.7, 1.4, zS + 0.8]), lab('π', [xC - 1.5, 3.7, zS + 0.5]));
    const hd = [lab('① 收集', [xA, 6.05, zS], { size: 30, border: 'rgba(56,209,255,.8)' }), lab('② 拟合世界模型', [xB, 6.05, zS], { size: 30, border: 'rgba(79,201,138,.8)' }), lab('③ 改进策略', [xC, 6.05, zS], { size: 30, border: 'rgba(255,122,89,.8)' })]; hd.forEach(x => G.add(x));
    const st = { a: lab('π 冻结', [xA + 2.2, 3.7, zS]), b: lab('f 训练中', [xB + 2.4, 2.0, zS]), c1: lab('f 冻结', [xC + 2.2, 1.0, zS]), c2: lab('π 训练中', [xC + 2.3, 3.7, zS]) }; Object.values(st).forEach(x => G.add(x));
    const P = { sim2buf: [[xA, 1, zS + 1.1], [xA, 1, 3.3]], buf2fit: [[xB, 1.0, 3.3], [xB, 1.6, zS + 1.2]], buf2imag: [[xC, 1.0, 3.3], [xC, 1.0, zS + 1.0]], back: arc([xC, 4.3, zS], [xA, 4.3, zS], 3.8, 28) };
    wire(G, P.sim2buf, COL.buf); wire(G, P.buf2fit, COL.buf); wire(G, P.buf2imag, COL.buf); wire(G, P.back, COL.pi, { dashed: true, dash: 0.4, gap: 0.3, opacity: 0.7 });
    G.add(lab('更新后的 π 回去继续收集', [0, 8.0, zS], { size: 24 }));
    const loop = [[xA - 0.4, 1.9, zS], [xA - 0.4, 3.2, zS]], loop2 = [[xA + 0.4, 3.2, zS], [xA + 0.4, 1.9, zS]], imF = [[xC - 0.4, 1.8, zS], [xC - 0.4, 3.2, zS]], imB = [[xC + 0.4, 3.2, zS], [xC + 0.4, 1.8, zS]];
    const t1 = stream(G, 6, COL.buf), t2 = stream(G, 6, COL.buf), t3 = stream(G, 6, COL.buf), t4 = stream(G, 3, COL.pi), t5 = stream(G, 3, COL.pi), t6 = stream(G, 4, COL.pi), t7 = stream(G, 4, COL.grad, 0.18), t8 = stream(G, 12, COL.pi, 0.2);
    [[simB, 3], [piA, 3], [fB, 4], [fC, 5], [piC, 5]].forEach(([m, sc]) => { m.userData.go = sc - 1; PICKS.push(m); });
    return { update(p) {
      const ph = p < 0.3 ? 0 : p < 0.56 ? 1 : p < 0.86 ? 2 : 3, q = (p * 26) % 1;
      const act = [ph === 0, ph === 1, ph === 2];
      hd.forEach((h, i) => { h.material.opacity = act[i] ? 1 : 0.45; });
      glow(simB, act[0] ? 0.7 : 0); glow(piA, act[0] ? 0.3 : 0); glow(fB, act[1] ? 0.9 * (0.65 + 0.35 * Math.sin(p * 90)) : 0); glow(piC, act[2] ? 0.9 * (0.65 + 0.35 * Math.sin(p * 90)) : 0); glow(fC, 0); glow(buf, ph === 3 ? 0 : 0.25);
      fC.material.color.setHex(act[2] ? COL.frozen : COL.wm); fB.material.color.setHex(act[1] ? COL.wm : 0x3f8f68);
      st.a.visible = act[0]; st.b.visible = act[1]; st.c1.visible = act[2]; st.c2.visible = act[2];
      t1(P.sim2buf, q, act[0] ? 1 : 0); t4(loop, q, act[0] ? 1 : 0); t5(loop2, q, act[0] ? 1 : 0);
      t2(P.buf2fit, q, act[1] ? 1 : 0); t3(P.buf2imag, q, act[2] ? 1 : 0); t6(imF, q, act[2] ? 1 : 0); t7(imB, q, act[2] ? 1 : 0);
      t8(P.back, seg(p, 0.86, 1) * 0.92, ph === 3 ? 1 : 0);
      pose(rob, clip('walk', p * 13), [xA + 2.6, 0.08, zS - 0.6], 1.6);
      cap(ph === 0 ? '<b>① 收集：</b>当前策略带噪声在仿真器里跑，转移写进回放缓存'
        : ph === 1 ? '<b>② 拟合：</b>从缓存取 8 步窗口，训练世界模型。这一步不碰策略'
        : ph === 2 ? '<b>③ 改进：</b>世界模型冻结（变蓝），想象 32 步，梯度穿过它传给策略'
        : '更新后的策略回到第 ① 步。三步一直交替，<b>梯度从不经过仿真器</b>');
    } };
  }

  /* ---------- scene 2: collect, replay buffer, reset sampling ---------- */
  function s2(G) {
    const N = 64, sp = 0.2, ox = -11.8, oz = -6.3, R = L.rng(5);
    G.add(block(N * sp + 0.5, 0.06, N * sp + 0.5, 0x2b3650, [ox + N * sp / 2, -0.04, oz + N * sp / 2], { edges: false }));
    const phs = [], bad = []; for (let i = 0; i < N * N; i++) { phs.push(R() * 6.28); bad.push(R()); }
    const parts = inst(BOX, N * N * 6); G.add(parts);
    const base = hex3(COL.robot), red = hex3(COL.ref);
    G.add(lab('4096 个并行环境（每 GPU）', [ox + N * sp / 2, 2.2, oz + N * sp / 2]));
    /* buffer: 40 columns = time, 25 rows = envs */
    const CW = 40, CH = 25, cs = 0.26, bx = 3.0, by = 0.25;
    const cells = inst(BOX, CW * CH); G.add(cells);
    for (let i = 0; i < CW; i++) for (let j = 0; j < CH; j++) setI(cells, i * CH + j, [bx + i * cs, by + j * cs, -3.2], [cs * 0.9, cs * 0.9, 0.22]);
    const head = block(0.08, CH * cs + 0.4, 0.5, COL.rew, [bx, by + CH * cs / 2, -3.2], { edges: false }); G.add(head);
    G.add(lab('回放缓存：1000 步 × 4096 环境', [bx + CW * cs / 2, by + CH * cs + 1.0, -3.2]));
    const lbNew = lab('写入点：新的覆盖最旧的', [bx, by - 0.65, -2.8], { size: 22 }); G.add(lbNew);
    const fl = stream(G, 10, COL.buf, 0.11);
    /* reset sampling, computed with the paper's formula on made-up bin returns */
    const B = 30, Gb = []; const r2 = L.rng(11); for (let i = 0; i < B; i++) Gb.push(0.88 + 0.1 * r2() - (i === 8 || i === 9 ? 0.34 : 0) - (i === 21 ? 0.42 : 0) - (i === 14 ? 0.16 : 0));
    const sm = Gb.map(g => Math.exp(-25 * g)), ss = sm.reduce((a, b) => a + b, 0), W = sm.map(v => v / ss), mix = W.map(w => 0.5 / B + 0.4 * w + 0.1 * w);
    const bars = inst(BOX, B), bx0 = -9, bw = 18 / B, bz = 9.2, hS = 3.0 / Math.max(...mix); G.add(bars);
    G.add(lab('每个 1 秒区间被抽中做重置起点的概率', [0, -1.1, bz + 1.6], { size: 24 }));
    const barsG = inst(BOX, B); G.add(barsG);
    const lbM = [lab('50% 均匀', [0, -1.1, bz + 3.1], { size: 22 }), lab('＋ 40% softmax(−25 G/Gmax) ＋ 10% 历史：偏向回报低的区间', [0, -1.1, bz + 3.1], { size: 22 })]; lbM.forEach(x => G.add(x));
    const lo = [8, 21].map(i => lab('难', [bx0 + i * bw + bw / 2, 0, bz + 0.2], { size: 20 })); lo.forEach(x => G.add(x));
    return { update(p) {
      const a = seg(p, 0, 0.1), tt = p * 15, ph = clamp((p - 0.02) / 0.5, 0, 1), w = seg(p, 0.55, 0.75);
      let k = 0;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const id = i * N + j, x = ox + (i + 0.5) * sp, z = oz + (j + 0.5) * sp, ang = tt * 7 + phs[id], s = Math.sin(ang);
        const fall = bad[id] < 0.05 && ((tt + phs[id]) % 6.28) > 4.6;
        const tilt = fall ? Math.min(1.5, ((tt + phs[id]) % 6.28 - 4.6) * 2) : 0.0; _E.set(tilt, 0, 0); _Q.setFromEuler(_E);
        const yy = fall ? 0.3 - tilt * 0.14 : 0.32, c = fall ? red : base;
        const put = (ox2, oy, sx, sy, rx) => { let qq = _Q; if (rx) { _E.set(tilt + rx, 0, 0); qq = new THREE.Quaternion().setFromEuler(_E); } setI(parts, k, [x + ox2, yy + oy, z], [sx, sy, 0.05], qq); colI(parts, k, c); k++; };
        put(0, 0.06, 0.09, 0.14); put(0, 0.17, 0.05, 0.05); put(-0.03, -0.12, 0.028, 0.19, fall ? 0 : 0.4 * s); put(0.03, -0.12, 0.028, 0.19, fall ? 0 : -0.4 * s); put(-0.065, 0.05, 0.02, 0.13, fall ? 0 : -0.4 * s); put(0.065, 0.05, 0.02, 0.13, fall ? 0 : 0.4 * s);
      }
      done(parts);
      const hc = (ph * 2 * CW) % CW, hi = Math.floor(hc);
      for (let i = 0; i < CW; i++) { const age = ((hc - i + CW) % CW) / CW; for (let j = 0; j < CH; j++) { const v = 1 - 0.75 * age; colI(cells, i * CH + j, [0.1 * v + 0.05, 0.62 * v + 0.08, 0.9 * v + 0.1]); } }
      done(cells); head.position.x = bx + hi * cs + cs / 2; lbNew.position.x = head.position.x;
      fl([[ox + N * sp, 0.8, oz + N * sp / 2], [head.position.x, by + CH * cs / 2, -3.2]], (p * 28) % 1, p < 0.55 ? 1 : 0.5);
      for (let b = 0; b < B; b++) {
        const hU = 0.5 / B * hS * a, hM = mix[b] * hS, h = L.lerp(hU, hM, w), x = bx0 + b * bw + bw / 2;
        setI(bars, b, [x, h / 2, bz], [bw * 0.82, Math.max(0.001, h), 0.5]); const hard = Gb[b] < 0.8;
        colI(bars, b, hard && w > 0.3 ? hex3(COL.grad) : hex3(COL.buf)); setI(barsG, b, [x, -0.03, bz], [bw * 0.82, 0.04, 0.5]); colI(barsG, b, [0.3, 0.36, 0.5]);
      } done(bars); done(barsG);
      lbM[0].visible = w < 0.1; lbM[1].visible = w >= 0.1; lo.forEach((l, i) => { const id = [8, 21][i]; l.visible = w > 0.6; l.position.y = mix[id] * hS + 0.35; });
      cap(p < 0.3 ? '4096 个环境同时跑。动作加了 <b>N(0, 0.1²)</b> 的噪声，让世界模型见到更宽的动作范围'
        : p < 0.55 ? '转移按时间写进缓存，每个环境存 1000 步，<b>新的覆盖最旧的</b>。旧策略的数据对拟合物理依然有效'
        : '摔倒（红色）就重置。起点不是均匀抽的：<b>回报低的区间被抽中的概率更高</b>');
    } };
  }

  /* ---------- scene 3: inside the world model ---------- */
  function s3(G) {
    G.add(L.grid(34, 34));
    const inp = [{ n: 'ŝₜ 状态', y: 4.1, c: COL.buf }, { n: 'aₜ 动作', y: 2.1, c: COL.pi }, { n: 'ξ 摩擦 · 标定偏移 · 质心', y: 0.3, c: COL.rew }];
    const iB = inp.map(i => { const m = block(1.5, 1.1, 1.5, i.c, [-10.2, i.y, 0]); G.add(m, lab(i.n, [-10.2, i.y + 1.0, 0], { size: 24 })); return m; });
    const xs = [-5.8, -2.8, 0.2], pl = xs.map(x => { const m = block(0.55, 5.4, 5.2, COL.wm, [x, 2.7, 0]); G.add(m, lab('2048', [x, 5.9, 0])); return m; });
    const out = block(1.5, 1.1, 1.5, COL.buf, [3.8, 2.7, 0]); G.add(out, lab('ŝₜ₊₁', [3.8, 3.75, 0]));
    const heads = [{ n: 'r̂ₜ₊₁ 奖励', y: 5.0, c: COL.rew }, { n: 'ō̂ₜ 干净观测', y: 2.7, c: COL.pi }, { n: 'd̂ₜ 终止概率', y: 0.4, c: COL.ref }].map(h => { const m = block(1.3, 0.9, 1.3, h.c, [7.6, h.y, 0]); G.add(m, lab(h.n, [7.6, h.y + 0.95, 0], { size: 24 })); return m; });
    const obsPt = [10.2, 2.7, 0], eta = block(0.8, 0.8, 0.8, COL.noise, [11.2, 5.0, 0]); G.add(eta); const lbE = lab('+ η 传感器噪声（模型外）', [11.6, 6.3, 0], { size: 24 }); G.add(lbE);
    const toPi = block(1.2, 0.9, 1.2, COL.pi, [12.4, 2.7, 0]); G.add(toPi, lab('π', [12.4, 3.6, 0]));
    const rob = robot(COL.robot, { opacity: 0.95 }); G.add(rob);
    const ret = arc([3.8, 3.2, -1.2], [-10.2, 4.8, -1.2], 3.0, 26);
    wire(G, ret, COL.buf, { dashed: true, dash: 0.4, gap: 0.25, opacity: 0.7 }); G.add(lab('自回归：预测当下一步的输入', [-3.2, 8.0, -1.2], { size: 24 }));
    const paths = iB.map(b => [b.position.toArray(), [-5.8, 2.7, 0]]);
    paths.forEach(q => wire(G, q, 0x8e9bb8, { opacity: 0.35 }));
    const f1 = paths.map(() => stream(G, 5, COL.wm, 0.13)), f2 = stream(G, 6, COL.wm, 0.15), f3 = [0, 1, 2].map(() => stream(G, 4, COL.buf, 0.12)), f4 = stream(G, 4, COL.noise, 0.12), f5 = stream(G, 4, COL.pi, 0.12), f6 = stream(G, 10, COL.buf, 0.14);
    const tag = lab('三个头：每个都可能学习或解析计算，论文没写哪个是哪种', [7.6, -1.25, 0], { size: 22, border: 'rgba(255,179,71,.8)' }); G.add(tag);
    return { update(p) {
      const a = p < 0.3, b = p >= 0.3 && p < 0.52, c = p >= 0.52 && p < 0.76, d = p >= 0.76, q = (p * 26) % 1;
      f1.forEach((f, i) => f(paths[i], q, a ? 1 : 0)); f2([[-5.8, 2.7, 0], [3.8, 2.7, 0]], q, a ? 1 : 0);
      pl.forEach((m, i) => glow(m, a ? 0.25 + 0.5 * Math.max(0, Math.sin(p * 44 - i)) : 0));
      f3.forEach((f, i) => f([[3.8, 2.7, 0], heads[i].position.toArray()], q, b ? 1 : 0)); heads.forEach(h => glow(h, b ? 0.6 : 0)); tag.visible = b;
      iB.forEach((m, i) => glow(m, a && i === 2 ? 0.8 : 0)); glow(eta, c ? 0.8 : 0); lbE.material.opacity = c ? 1 : 0.5;
      f4([eta.position.toArray(), obsPt], q, c ? 1 : 0); f5([heads[1].position.toArray(), toPi.position.toArray()], q, c ? 1 : 0); glow(toPi, c ? 0.5 : 0);
      f6(ret, (q + 0.2), d ? 1 : 0); glow(out, d ? 0.6 : 0); glow(iB[0], d ? 0.6 : 0);
      pose(rob, clip('walk', p * 12), [3.8, -0.0, 2.2], 1.25);
      cap(a ? '输入是当前状态、动作，加上<b>这一回合的物理参数 ξ</b>。随机性的来源直接喂给模型，所以它不用学分布'
        : b ? '从新状态读出奖励、干净观测和终止概率。<b>终止是概率</b>，所以“别摔倒”可以求导'
        : c ? '传感器噪声 η 不进模型：模型只出干净观测，噪声在外面按已知分布<b>重新加上</b>，策略才能学会抗噪'
        : '预测的状态变成下一步的输入，这样就能在模型里<b>一直往下想象</b>，不再需要仿真器');
    } };
  }

  /* ---------- scene 4: k-step autoregressive fit ---------- */
  function s4(G) {
    G.add(L.grid(34, 34));
    const K = 8, X = j => -9.4 + j * 2.35, sc = 2.5;
    const sim = [], pr = [], fb = [];
    for (let j = 0; j <= K; j++) { const a = robot(COL.buf, { opacity: 0.42 }), b = robot(COL.pred); sim.push(a); pr.push(b); G.add(a, b); }
    for (let j = 0; j < K; j++) { const m = block(0.9, 0.65, 0.9, COL.wm, [X(j) + 1.17, 4.3, 0]); fb.push(m); G.add(m); }
    G.add(lab('世界模型 f', [X(0) + 1.17, 5.05, 0], { size: 22 }));
    const bars = inst(BOX, K + 1); G.add(bars);
    const errL = segLines(K + 1, COL.grad, 1); G.add(errL);
    const lbS = lab('蓝：仿真器记录的真实状态　橙：模型预测', [1.5, 6.1, 0], { size: 24 }); G.add(lbS);
    const lbMode = [lab('只训练单步的模型', [-6.4, 0, 3.8], { border: 'rgba(255,122,89,.8)' }), lab('8 步自回归训练后', [-6.4, 0, 3.8], { border: 'rgba(79,201,138,.8)' })]; lbMode.forEach(x => { x.position.set(1.5, -0.6, 6.0); G.add(x); });
    G.add(lab('每步误差', [-11.6, 0.5, 4.8], { size: 22 }));
    const arcs = []; for (let j = 0; j < K; j++) arcs.push(arc([X(j), 3.4, 0], [X(j + 1), 3.4, 0], 0.9, 6));
    const fwd = stream(G, 1, COL.pred, 0.2), bk = stream(G, 16, COL.grad, 0.13);
    const e0 = 0.012, errOf = (j, r) => j === 0 ? 0 : e0 * (Math.pow(r, j) - 1) / (r - 1);
    return { update(p) {
      const mode = seg(p, 0.46, 0.56), r = L.lerp(1.42, 1.0, mode), front = p < 0.46 ? clamp(p / 0.34, 0, 1) * K : p < 0.56 ? K : clamp((p - 0.56) / 0.24, 0, 1) * K;
      let sum = 0;
      for (let j = 0; j <= K; j++) {
        const q = clip('walk', j * 0.11 + 0.2), e = errOf(j, r), on = j <= front + 0.001;
        pose(sim[j], q, [X(j), 0.05, 0], sc, Math.PI / 2 * 0.5); sim[j].visible = true;
        pose(pr[j], drift(q, e), [X(j), 0.05, 0], sc, Math.PI / 2 * 0.5); pr[j].visible = on;
        const h = on ? Math.min(2.3, 28 * e * e * 4 + 0.03) : 0.001; sum += on ? e * e : 0;
        setI(bars, j, [X(j), h / 2, 4.8], [0.7, h, 0.7]); colI(bars, j, hex3(COL.grad));
        setSeg(errL, j, [X(j), 1.7, 0], [X(j) + (on ? e * 0.5 * sc : 0), 1.7 + (on ? -Math.abs(e) * 0.5 * sc : 0), on ? e * sc : 0]);
      } done(bars); errL.geometry.attributes.position.needsUpdate = true;
      fb.forEach((m, j) => glow(m, j < front && j + 1 > front - 1 ? 0.8 : 0.08));
      const j0 = Math.min(K - 1, Math.floor(front)); fwd(arcs[j0], front - j0, front < K ? 1 : 0);
      const back = p > 0.82 ? 1 : 0; const route = []; for (let j = K; j >= 0; j--) route.push([X(j), 4.3, 0]); bk(route, (p * 24) % 1, back);
      if (back) fb.forEach(m => glow(m, 0.75 * (0.6 + 0.4 * Math.sin(p * 80))));
      lbMode[0].visible = mode < 0.5; lbMode[1].visible = mode >= 0.5;
      
      cap(p < 0.46 ? '只训练单步：每一步都很准，但第 2 步开始<b>吃的是自己有偏差的预测</b>，误差越滚越大'
        : p < 0.56 ? '换成<b>自回归</b>训练：损失把 8 步的误差全部算上'
        : p < 0.82 ? '模型在训练时就见过“自己犯错后的状态”，被要求把它拉回来，<b>误差不再滚大</b>'
        : '8 步的误差一起<b>反传穿过 8 个 f</b>，更新世界模型权重 ω。这时策略不动');
    } };
  }

  /* ---------- scene 5: imagine and backpropagate ---------- */
  function s5(G) {
    G.add(L.grid(40, 40));
    const H = 32, X = t => -12.2 + t * 0.72, gamma = 0.99;
    const cF = inst(BOX, H), cP = inst(BOX, H), rb = inst(BOX, H); G.add(cF, cP, rb);
    const chat = t => 1 - 0.2 * Math.pow(t / H, 2), rew = t => Math.pow(gamma, t) * chat(t);
    const theta = block(3.0, 1.2, 1.8, COL.pi, [0, 7.1, 0]); G.add(theta, lab('同一个策略 π 的权重 θ', [0, 8.25, 0]));
    const tl = segLines(H, COL.grad, 0.8); G.add(tl);
    for (let t = 0; t < H; t++) setSeg(tl, t, [X(t), 3.05, 0], [theta.position.x + (t - H / 2) * 0.05, 6.5, 0]);
    tl.geometry.attributes.position.needsUpdate = true;
    G.add(lab('π', [-13.2, 2.7, 0]), lab('f（冻结）', [-13.7, 1.2, 0], { size: 24 }));
    G.add(lab('奖励权重 γᵗ·ĉₜ', [-9.2, 3.5, -3.2], { size: 22 }));
    const crit = block(1.5, 1, 1.5, COL.crit, [12.8, 1, -3.2]); G.add(crit); const lbC = lab('γ³²·ĉ·V：窗口外的回报交给评论家', [10.0, 4.4, -3.2], { size: 24, border: 'rgba(157,140,255,.8)' }); G.add(lbC);
    const robots = [0, 8, 16, 24, 32].map(() => { const r = robot(COL.robot); G.add(r); return r; });
    const start = lab('起点：缓存里的 s₀ 和 ξ', [X(0) - 0.4, 0.25, 4.6], { size: 22 }); G.add(start);
    const fwd = stream(G, 1, COL.pred, 0.3), bk = stream(G, 1, COL.grad, 0.34);
    const cFc = hex3(COL.frozen), cPc = hex3(COL.pi), g = hex3(COL.grad), wmDark = hex3(0x3a4d70), piDark = hex3(0x1c5f78);
    const sum32 = (1 - Math.pow(gamma, H)) / (1 - gamma);
    return { update(p) {
      const fw = seg(p, 0.04, 0.42) * H, cO = seg(p, 0.42, 0.52), bw = p < 0.56 ? H : H - seg(p, 0.56, 0.9) * H, th = seg(p, 0.86, 0.96);
      for (let t = 0; t < H; t++) {
        const on = t < fw, gr = t >= bw && p >= 0.56;
        setI(cF, t, [X(t), 1.2, 0], [0.56, 0.75, 1.3]); colI(cF, t, gr ? g.map((v, i) => L.lerp(v, cFc[i], 0.35)) : on ? cFc : wmDark);
        setI(cP, t, [X(t), 2.7, 0], [0.56, 0.75, 1.3]); colI(cP, t, gr ? g : on ? cPc : piDark);
        const h = on ? 2.4 * rew(t) : 0.001; setI(rb, t, [X(t), h / 2, -3.2], [0.56, h, 0.9]); colI(rb, t, hex3(COL.rew));
      } done(cF); done(cP); done(rb);
      const hC = 0.01 + cO * 2.4 * Math.pow(gamma, H) * chat(H) * (100 / H) * 0.9; crit.scale.y = hC; crit.position.y = hC / 2; lbC.visible = cO > 0.4;
      robots.forEach((r, i) => { const t = i * 8, q = clip('walk', t * 0.03 + 0.1); pose(r, q, [X(Math.min(t, H - 1)) + (t === 32 ? 0.72 : 0), 0.04, 3.1], 1.8, Math.PI / 2); r.visible = t <= fw + 0.01; });
      fwd([[X(0), 2.0, 0.9], [X(H - 1), 2.0, 0.9]], fw / H, p < 0.42 && p > 0.04 ? 1 : 0);
      bk([[X(H - 1), 2.0, 0.9], [X(0), 2.0, 0.9]], (H - bw) / H, p >= 0.56 && p < 0.9 ? 1 : 0);
      tl.visible = p >= 0.56; tl.material.opacity = 0.75; tl.geometry.setDrawRange(Math.floor(bw) * 2, (H - Math.floor(bw)) * 2);
      glow(theta, th); start.visible = p < 0.3;
      cap(p < 0.42 ? `前向：<b>π 和 f 轮流</b>算 ${Math.max(1, Math.round(fw))} / 32 步。全程在世界模型里，一步也不用仿真器；世界模型的权重是冻结的`
        : p < 0.56 ? `窗口内的折扣权重加起来是 <b>${sum32.toFixed(1)}</b>，而窗口外是 <b>${(100 - sum32).toFixed(1)}</b>（占 ${Math.round(100 - sum32)}%）：评论家负责估这一大块`
        : p < 0.9 ? `反向：回报对动作求导，再经 f 的<b>雅可比</b>往前传。已穿过 ${H - Math.floor(bw)} / 32 步，每一步的 π 都拿到一份梯度`
        : '所有梯度加到<b>同一份 θ</b> 上更新。评论家再拟合这批想象数据的 GAE 目标，然后回到第 ① 步');
    } };
  }

  /* ---------- scene 6: BPTT vs the likelihood-ratio estimate, computed live on a toy surface ---------- */
  function s6(G) {
    const J = (x, y) => 2.1 * Math.exp(-((x - 1.1) ** 2 + (y - 0.7) ** 2) / 3.2) + 0.16 * Math.sin(1.8 * x) * Math.cos(1.4 * y);
    const dJ = (x, y) => { const e = 2.1 * Math.exp(-((x - 1.1) ** 2 + (y - 0.7) ** 2) / 3.2); return [e * (-2 * (x - 1.1) / 3.2) + 0.16 * 1.8 * Math.cos(1.8 * x) * Math.cos(1.4 * y), e * (-2 * (y - 0.7) / 3.2) - 0.16 * 1.4 * Math.sin(1.8 * x) * Math.sin(1.4 * y)]; };
    const a0 = [-0.7, -0.5], W = 1.45, sigma = 0.55;
    function surface(cx) {
      const seg0 = 56, g = new THREE.PlaneGeometry(10.4, 10.4, seg0, seg0); g.rotateX(-Math.PI / 2);
      const pa = g.attributes.position, col = new Float32Array(pa.count * 3);
      for (let i = 0; i < pa.count; i++) { const v = J(pa.getX(i) / W, pa.getZ(i) / W); pa.setY(i, v); const t = clamp((v + 0.2) / 2.4, 0, 1); col.set([0.14 + 0.2 * t, 0.22 + 0.5 * t, 0.36 + 0.42 * t], i * 3); }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.92 })); m.position.x = cx; G.add(m);
    }
    const cL = -6.2, cR = 6.2; surface(cL); surface(cR);
    const top = (c, x, y, d = 0.05) => [c + x * W, J(x, y) + d, y * W];
    const dot = c => { const m = L.sphere(0.2, 0xffffff); m.position.set(...top(c, a0[0], a0[1], 0.1)); G.add(m); };
    dot(cL); dot(cR);
    const g0 = dJ(a0[0], a0[1]), gn = Math.hypot(g0[0], g0[1]), dirT = [g0[0] / gn, g0[1] / gn];
    const r = L.rng(77), gauss = () => L.gauss(r);
    /* batches of the score-function estimate with a mean baseline */
    const NS = [8, 64, 512], K = 28, est = NS.map(N => { const out = []; for (let b = 0; b < K; b++) { const ns = [], Js = []; for (let i = 0; i < N; i++) { const n = [gauss(), gauss()]; ns.push(n); Js.push(J(a0[0] + sigma * n[0], a0[1] + sigma * n[1])); } const m = Js.reduce((u, v) => u + v, 0) / N; let gx = 0, gy = 0; for (let i = 0; i < N; i++) { gx += (Js[i] - m) * ns[i][0] / sigma / N; gy += (Js[i] - m) * ns[i][1] / sigma / N; } out.push([gx, gy]); } return out; });
    const angErr = est.map(list => { let s = 0; list.forEach(g => { const nn = Math.hypot(g[0], g[1]) || 1, c = clamp((g[0] * dirT[0] + g[1] * dirT[1]) / nn, -1, 1); s += Math.acos(c) * 180 / Math.PI; }); return s / list.length; });
    const ROD = new THREE.CylinderGeometry(1, 1, 1, 6), UP = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _qq = new THREE.Quaternion();
    const rods = inst(ROD, K); rods.material.color.setHex(0x38d1ff); rods.material.emissive.setHex(0x0b5a78); G.add(rods);
    const placeRod = (im, i, a, b, r) => { _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = _d.length() || 1e-3; _qq.setFromUnitVectors(UP, _d.normalize()); setI(im, i, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [r, len, r], _qq); };
    const thick = (from, to, color) => { const g = new THREE.Group(), m = L.mat(color, { emissive: color }); m.emissiveIntensity = 0.45; const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]), len = dir.length(); dir.normalize(); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len - 0.55, 10), m); sh.position.y = (len - 0.55) / 2; const hd = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.55, 14), m); hd.position.y = len - 0.27; g.add(sh, hd); g.position.set(...from); g.quaternion.setFromUnitVectors(UP, dir); return g; };
    const samples = inst(BALL, 64); G.add(samples);
    const r3 = L.rng(9), sampleN = []; for (let i = 0; i < 64; i++) sampleN.push([L.gauss(r3), L.gauss(r3)]);
    const o = top(cL, a0[0], a0[1], 0.2), tip = (g, scale) => { const nn = Math.hypot(g[0], g[1]) || 1, x = a0[0] + g[0] / nn * scale, y = a0[1] + g[1] / nn * scale; return top(cL, x, y, 0.28); };
    const end = (c, k) => top(c, a0[0] + dirT[0] * k, a0[1] + dirT[1] * k, 0.34);
    const arr = thick(top(cR, a0[0], a0[1], 0.2), end(cR, 1.6), COL.grad); G.add(arr);
    const arrT = thick(top(cL, a0[0], a0[1], 0.2), end(cL, 1.6), COL.grad); G.add(arrT);
    G.add(lab('PPO：撒样本，从回报估方向', [cL, 3.5, -2], { border: 'rgba(56,209,255,.8)' }), lab('BPTT：直接求导', [cR, 3.5, -2], { border: 'rgba(255,122,89,.8)' }));
    G.add(lab('横轴是动作，高度是回报（玩具函数）', [0, -0.6, 6.4], { size: 22 }));
    return { update(p) {
      const st = p < 0.36 ? 0 : p < 0.68 ? 1 : 2, a = seg(p, 0.02, 0.14), list = est[st], nS = Math.min(64, NS[st]);
      for (let i = 0; i < 64; i++) { const n = sampleN[i]; if (i < nS) { const x = a0[0] + sigma * n[0], y = a0[1] + sigma * n[1], pt = top(cL, x, y, 0.08), v = J(x, y), t = clamp((v - J(a0[0], a0[1]) + 0.5), 0, 1); setI(samples, i, pt, 0.09 * a); colI(samples, i, [0.9 * (1 - t) + 0.2 * t, 0.5 + 0.4 * t, 0.4]); } else setI(samples, i, [0, -50, 0], 0.001); } done(samples);
      const shown = Math.floor(K * seg(p, st === 0 ? 0.06 : st === 1 ? 0.38 : 0.7, st === 0 ? 0.26 : st === 1 ? 0.58 : 0.9));
      for (let k = 0; k < K; k++) { if (k < shown) placeRod(rods, k, o, tip(list[k], 1.5), 0.028); else setI(rods, k, [0, -50, 0], 0.001); } done(rods);
      arr.visible = p > 0.05; arrT.visible = shown >= K * 0.5;
      cap(`每条青线是一批 <b>${NS[st]}</b> 个样本估出的方向；和真方向（橙）平均偏 <b>${angErr[st].toFixed(0)}°</b>。解析梯度只要一次前向加一次反向：<b>0°</b>`);
    } };
  }

  /* ---------- scene 7: horizon and critic ---------- */
  const H7 = [{ H: 8, n: 0.087, c: 0.391, hn: null, hc: null }, { H: 16, n: 0.249, c: 0.842, hn: null, hc: 1.20 }, { H: 32, n: 0.839, c: 0.8651, hn: 1.38, hc: 0.89 }, { H: 64, n: 0.861, c: 0.862, hn: 1.35, hc: 1.71 }, { H: 128, n: 0.834, c: 0.822, hn: 3.81, hc: 4.63 }];
  function s7(G) {
    G.add(L.grid(36, 36));
    const T = 220, X = t => -13 + t * 26 / T, gamma = 0.99, bars = inst(BOX, T); G.add(bars);
    for (const t of [0, 50, 100, 150, 200]) G.add(lab(`${t * 0.02} 秒`, [X(t), -0.45, 2.9], { size: 20 }));
    const edge = block(0.06, 3.4, 1.6, COL.rew, [0, 1.7, 2], { edges: false }); G.add(edge);
    const lbIn = lab('', [0, 0, 0]); G.add(lbIn);
    const sc = 2.4, cA = hex3(COL.rew), cB = hex3(COL.crit);
    const gb = inst(BOX, 10); G.add(gb);
    const gX = i => -9.6 + i * 4.8, gy = 0, gz = -4.5, RH = 6;
    H7.forEach((h, i) => { G.add(lab(`H=${h.H}`, [gX(i), -0.5, gz + 1.0], { size: 22 })); });
    G.add(lab('最终回报（图 4b，矢量图读数）：浅 = 不带评论家，深 = 带评论家', [0, 6.5, gz], { size: 24 }));
    const y82 = 0.82 * RH; G.add(L.line([[-12, y82, gz], [12, y82, gz]], COL.grad, { dashed: true, dash: 0.3, gap: 0.2, opacity: 0.8 })); G.add(lab('0.82', [12.8, y82, gz], { size: 20 }));
    const vals = []; H7.forEach((h, i) => { vals.push(lab(h.n.toFixed(2), [gX(i) - 0.75, h.n * RH + 0.32, gz], { size: 20 }), lab(h.c.toFixed(2), [gX(i) + 0.75, h.c * RH + 0.32, gz], { size: 20 })); }); vals.forEach(x => G.add(x));
    let last = -1, lbObj = lbIn;
    return { update(p) {
      const idx = Math.min(4, Math.floor(p * 5)), h = H7[idx];
      for (let t = 0; t < T; t++) { const v = Math.pow(gamma, t) * sc; setI(bars, t, [X(t), v / 2, 2], [26 / T * 0.8, Math.max(0.01, v), 1.2]); colI(bars, t, t < h.H ? cA : cB); } done(bars);
      edge.position.x = X(h.H);
      if (idx !== last) {
        last = idx; G.remove(lbObj); L.dispose(lbObj); LABS = LABS.filter(s => s !== lbObj);
        const share = 100 * (1 - Math.pow(gamma, h.H));
        lbObj = lab(`窗口 ${h.H} 步 = ${(h.H * 0.02).toFixed(2)} 秒，占折扣回报 ${share.toFixed(0)}%`, [clamp(X(h.H), -7, 7), 3.9, 3.2], { size: 24, border: 'rgba(242,193,78,.8)' }); G.add(lbObj);
        document.querySelectorAll('#ctl button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === idx)));
      }
      H7.forEach((x, i) => { const on = i === idx, k = on ? 1 : 0.62, a = hex3(COL.crit); const c1 = a.map(v => (v * 0.55 + 0.4) * k), c2 = a.map(v => v * k);
        setI(gb, i * 2, [gX(i) - 0.75, x.n * RH / 2, gz], [1.3, Math.max(0.01, x.n * RH), 1.3]); colI(gb, i * 2, c1); setI(gb, i * 2 + 1, [gX(i) + 0.75, x.c * RH / 2, gz], [1.3, Math.max(0.01, x.c * RH), 1.3]); colI(gb, i * 2 + 1, c2); }); done(gb);
      const hrs = v => v == null ? '到不了 0.82' : `${v.toFixed(2)} 小时到 0.82`;
      cap(`<b>H = ${h.H}</b>　不带评论家：回报 ${h.n.toFixed(2)}，${hrs(h.hn)}　带评论家：回报 ${h.c.toFixed(2)}，${hrs(h.hc)}`);
    }, ctl: { label: '想象长度', items: H7.map(x => String(x.H)), p: i => (i + 0.5) / 5 } };
  }

  /* ---------- scene 8: policy network and goal interfaces ---------- */
  function s8(G) {
    const yT = 3.4, yB = -2.4;
    const plateH = w => 0.7 + 3.6 * w / 2048;
    const mk = (x, y, w, c) => { const m = block(0.55, plateH(w), 2.4, c, [x, y, 0]); G.add(m, lab(String(w), [x, y + plateH(w) / 2 + 0.34, 0], { size: 20 })); return m; };
    const refs = block(1.3, 1.1, 1.8, COL.ref, [-12.2, yT, 0]); G.add(refs, lab('未来 10 帧参考', [-12.2, yT + 1.0, 0], { size: 22 }));
    const cmd = block(1.3, 1.1, 1.8, COL.rew, [-9, yB, 0]); G.add(cmd, lab('(vₓ, v_y, ω_z)', [-9, yB + 1.0, 0], { size: 22 }));
    const eM = [2048, 1024, 512, 256].map((w, i) => mk(-9.8 + i * 1.5, yT, w, COL.enc));
    const eV = [256, 256].map((w, i) => mk(-6.2 + i * 1.5, yB, w, COL.enc));
    G.add(lab('动作编码器', [-7.6, yT + 2.75, 0], { size: 24 }), lab('速度编码器', [-5.4, yB - 1.05, 0], { size: 24 }));
    const z = block(0.5, 1.5, 1.6, COL.rew, [-1.6, 0.5, 0]); G.add(z, lab('z 32 维 tanh', [-1.6, 1.75, 0], { size: 22 }));
    const obs = block(1.3, 1.0, 1.4, COL.pi, [-1.6, -2.4, 2]); G.add(obs, lab('10 帧观测 930 维', [-1.6, -3.3, 2], { size: 22 }));
    const dec = [2048, 1024, 512, 256].map((w, i) => mk(1 + i * 1.5, 0.5, w, COL.wm));
    G.add(lab('共享解码器', [3.2, 3.55, 0], { size: 24 }));
    const a = block(0.9, 1.1, 1.3, COL.pi, [7.5, 0.5, 0]); G.add(a, lab('a 29 维', [7.5, 1.45, 0], { size: 22 }));
    const wm = block(2.0, 1.5, 1.8, COL.frozen, [10.2, 0.5, 0]); G.add(wm, lab('世界模型（冻结）', [10.2, 1.75, 0], { size: 22 }));
    const crM = block(1.3, 0.9, 1.3, COL.crit, [13, 2.6, 0]), crV = block(1.3, 0.9, 1.3, COL.crit, [13, -1.6, 0]); G.add(crM, crV, lab('Ĵ 跟踪 ＋ V 跟踪', [13, 3.55, 0], { size: 22 }), lab('Ĵ 速度 ＋ V 速度', [13, -2.55, 0], { size: 22 }));
    const pM = [[-12.2, yT, 0], [-5.3, yT, 0], [-1.6, 0.5, 0], [5.5, 0.5, 0], [7.5, 0.5, 0], [10.2, 0.5, 0], [13, 2.6, 0]], pV = [[-9, yB, 0], [-4.7, yB, 0], [-1.6, 0.5, 0], [5.5, 0.5, 0], [7.5, 0.5, 0], [10.2, 0.5, 0], [13, -1.6, 0]];
    wire(G, pM, 0x8e9bb8, { opacity: 0.35 }); wire(G, pV, 0x8e9bb8, { opacity: 0.35 }); wire(G, [[-1.6, -2.4, 2], [1, 0.5, 0]], COL.pi, { opacity: 0.4 });
    const align = wire(G, [[-1.2, 3.2, 0], [-1.2, 1.2, 0]], COL.noise, { dashed: true, dash: 0.2, gap: 0.14, opacity: 0.9 }); const lbA = lab('对齐损失 0.1（动作潜变量 stop-grad）', [2.2, 5.2, 0], { size: 21 }); G.add(lbA);
    const fw = stream(G, 12, COL.pi, 0.14), bk = stream(G, 14, COL.grad, 0.16), ob = stream(G, 4, COL.pi, 0.1);
    const stopM = lab('stop-gradient：解码器权重不动', [3.2, -2.2, 0], { size: 24, border: 'rgba(255,122,89,.9)' }); G.add(stopM);
    const rev = l => l.slice().reverse();
    return { update(p) {
      const q = (p * 24) % 1, A = p < 0.14, B = p >= 0.14 && p < 0.46, C = p >= 0.46 && p < 0.6, D = p >= 0.6;
      fw(A ? pM : pV, q, A || C ? 1 : 0); bk(B ? rev(pM) : rev(pV), q, B || D ? 1 : 0); ob([[-1.6, -2.4, 2], [1, 0.5, 0]], q, A || C ? 1 : 0);
      const lit = B ? 0.8 * (0.65 + 0.35 * Math.sin(p * 90)) : 0, litV = D ? 0.8 * (0.65 + 0.35 * Math.sin(p * 90)) : 0;
      eM.forEach(m => glow(m, lit)); dec.forEach(m => glow(m, lit)); eV.forEach(m => glow(m, litV));
      dec.forEach(m => { m.material.opacity = D ? 0.45 : 1; m.material.transparent = D; });
      stopM.visible = D; align.visible = D; lbA.visible = D; glow(crM, B ? 0.5 : 0); glow(crV, D ? 0.5 : 0); glow(wm, 0);
      cap(A ? '跟踪任务前向：参考动作 → 动作编码器 → z → 解码器 → 动作 → 世界模型 → 回报'
        : B ? '跟踪回报反传：梯度穿过冻结的世界模型，<b>更新解码器和动作编码器</b>（亮起的层）'
        : C ? '换成速度命令：同一个解码器，同一个世界模型，只换编码器和奖励'
        : '速度回报反传：梯度<b>穿过解码器但不更新它</b>，只更新速度编码器。解码器仍由跟踪目标训练');
    } };
  }

  /* ---------- scene 9: amortization, values read from Figure 3(b)(c) ---------- */
  const D9 = [{ h: 1, g: 0.537, e: 6.8 }, { h: 7, g: 1.349, e: 7.39 }, { h: 40, g: 1.908, e: 10.97 }, { h: 264, g: 1.892, e: 9.94 }];
  function s9(G) {
    G.add(L.grid(50, 50));
    const zR = [7.4, 8.5, 9.6, 10.7], x0 = -11, u = 0.056, X = i => -9.2 + i * 5.6, zG = 1.2, zE = -10, gs = 1.6, es = 0.3, capH = 6.4;
    const r = L.rng(4), rib = D9.map(d => { const n = Math.min(400, Math.ceil(d.h * 2)), im = inst(BOX, n), col = []; G.add(im); for (let k = 0; k < n; k++) { const t = r(); col.push(t < 0.33 ? hex3(COL.buf) : t < 0.66 ? hex3(COL.pi) : hex3(COL.enc)); } return { im, n, col }; });
    D9.forEach((d, i) => G.add(lab(`${d.h} h`, [x0 - 1.2, 0.25, zR[i]], { size: 21 })));
    G.add(lab('动作库长度（真实比例）', [-6.4, -0.6, 12.5], { size: 24 }));
    const f = block(3, 2, 2.6, COL.wm, [10.8, 1.2, 9]); G.add(f, lab('同一个世界模型', [10.8, 2.8, 9], { size: 23 }));
    const fl = stream(G, 12, COL.buf, 0.11);
    const bars = inst(BOX, 4), err = inst(BOX, 4), prop = []; G.add(bars, err);
    const pv = D9.map(d => 0.537 * d.h);
    D9.forEach((d, i) => {
      const hp = Math.min(capH, pv[i] * gs), w = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.2, hp, 1.2)), new THREE.LineBasicMaterial({ color: COL.grad, transparent: true, opacity: 0.8 })); w.position.set(X(i) + 1.0, hp / 2, zG); G.add(w); prop.push(w);
      G.add(lab(`${d.h} h`, [X(i) + 0.4, -0.7, zG + 1.4], { size: 21 }), lab(`${d.h} h`, [X(i), -0.7, zE + 1.4], { size: 21 }));
      if (i) { const t = lab(`若成正比 ${pv[i] < 10 ? pv[i].toFixed(1) : Math.round(pv[i])}${pv[i] * gs > capH ? '（截断）' : ''}`, [X(i) + 1.6, hp + 0.5, zG], { size: 19 }); G.add(t); w.userData.t = t; }
    });
    G.add(lab('到目标回报的 GPU 小时（图 3b）', [-14.5, 2.6, zG], { size: 23 }), lab('8 步预测误差 ×10⁻³（图 3c）', [-14.5, 2.2, zE], { size: 23 }));
    const gl = D9.map((d, i) => lab(d.g.toFixed(2), [X(i) - 0.4, d.g * gs + 0.42, zG], { size: 23 })); gl.forEach(x => G.add(x));
    const el = D9.map((d, i) => lab(d.e.toFixed(1), [X(i), d.e * es + 0.42, zE], { size: 23 })); el.forEach(x => G.add(x));
    return { update(p) {
      const a = seg(p, 0, 0.3), b = seg(p, 0.34, 0.6), c = seg(p, 0.62, 0.86), q = (p * 22) % 1;
      D9.forEach((d, i) => { const len = d.h * u, R = rib[i], lim = a * len, cw = len / R.n; for (let k = 0; k < R.n; k++) { const x = x0 + (k + 0.5) * cw; if (x - x0 < lim) setI(R.im, k, [x, 0.25, zR[i]], [Math.max(0.05, cw * 0.86), 0.42, 0.7]); else setI(R.im, k, [0, -50, 0], 0.001); colI(R.im, k, R.col[k]); } done(R.im); });
      fl([[4.2, 0.4, zR[3]], [9.4, 1.0, 9]], q, a > 0.9 ? 1 : 0); glow(f, a > 0.9 ? 0.5 : 0);
      D9.forEach((d, i) => { const hg = Math.max(0.001, d.g * gs * b), he = Math.max(0.001, d.e * es * c); setI(bars, i, [X(i) - 0.4, hg / 2, zG], [1.3, hg, 1.3]); colI(bars, i, hex3(COL.wm)); setI(err, i, [X(i), he / 2, zE], [1.5, he, 1.5]); colI(err, i, hex3(COL.crit)); gl[i].visible = b > 0.95; el[i].visible = c > 0.95; prop[i].visible = b > 0.4; if (prop[i].userData.t) prop[i].userData.t.visible = b > 0.4; }); done(bars); done(err);
      cap(p < 0.34 ? '动作库从 1 小时涨到 264 小时，喂给的始终是<b>同一个模型</b>：身体没变，物理没变'
        : p < 0.62 ? '数据多 <b>264 倍</b>，到目标回报的算力只多 <b>3.5 倍</b>。线框是“算力和数据成正比”时的高度'
        : '预测误差从 6.8 涨到 9.9，<b>涨了 46%，但远没有跟着数据涨</b>。40 小时那一点比 264 小时还高');
    } };
  }

  /* ---------- scene 10: compute accounting, one cube = one GPU hour ---------- */
  function s10(G) {
    const cw = 0.15, ox = -17, N = 128 * 168, wall = inst(BOX, N); G.add(wall);
    const c = hex3(COL.ref);
    for (let i = 0; i < 128; i++) for (let j = 0; j < 168; j++) colI(wall, i * 168 + j, c);
    const cube = (x, n, w, color, frac) => { const m = inst(BOX, n); G.add(m); return m; };
    const small = inst(BOX, 3); G.add(small);
    const smX = 8; for (let j = 0; j < 3; j++) { setI(small, j, [smX, cw * (j + 0.5), 0], cw * 0.9); colI(small, j, hex3(COL.pi)); } done(small);
    const ppo = inst(BOX, 144); G.add(ppo); const ppoX = 13;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 18; j++) { setI(ppo, i * 18 + j, [ppoX + i * cw, cw * (j + 0.5), 0], cw * 0.9); colI(ppo, i * 18 + j, hex3(COL.grad)); } done(ppo);
    const sm2 = block(cw * 0.9, cw * 1.19, cw * 0.9, COL.pi, [ppoX + 3.2, cw * 1.19 / 2, 0], { edges: false }); G.add(sm2);
    G.add(lab('SONIC：128 张 L40 × 168 小时\n= 21,504 GPU·h', [12.5, 23.5, 0], { size: 28, border: 'rgba(224,93,93,.8)' }));
    const l1 = lab('SuperMimic：1 张 H100 × 3 小时\n= 3 个方块', [smX - 3.2, 6.2, 0], { size: 24, border: 'rgba(56,209,255,.8)' }); G.add(l1);
    G.add(L.line([[smX, 0.5, 0], [smX - 2.6, 5.2, 0]], COL.pi, { opacity: 0.9 }));
    const lP = lab('受控对比（同一任务 LAFAN1）', [ppoX + 1.8, 12.3, 0], { size: 24 }), l2 = lab('PPO-Sim：8 卡 × 18 小时 = 144\n只到回报 0.72', [ppoX + 0.2, 9.8, 0], { size: 23, border: 'rgba(255,122,89,.8)' }), l3 = lab('SuperMimic：1.2\n回报 0.82', [ppoX + 5.0, 4.2, 0], { size: 23, border: 'rgba(56,209,255,.8)' }); G.add(lP, l2, l3);
    G.add(L.line([[ppoX + 0.5, 3.0, 0], [ppoX + 0.3, 8.5, 0]], COL.grad, { opacity: 0.7 }), L.line([[ppoX + 3.2, 0.3, 0], [ppoX + 4.6, 3.2, 0]], COL.pi, { opacity: 0.8 }));
    return { update(p) {
      const hrs = 168 * seg(p, 0.03, 0.55), r = Math.ceil(hrs);
      for (let i = 0; i < 128; i++) for (let j = 0; j < 168; j++) { if (j < r) setI(wall, i * 168 + j, [ox + (i + 0.5) * cw, cw * (j + 0.5), 0], cw * 0.92); else setI(wall, i * 168 + j, [0, -80, 0], 0.001); } done(wall);
      const sm = hrs >= 3; small.visible = true;
      const count = (128 * Math.min(168, hrs));
      const on2 = seg(p, 0.6, 0.72); [lP, l2, l3].forEach(x => { x.visible = on2 > 0.3; }); ppo.visible = on2 > 0.1; sm2.visible = on2 > 0.1;
      cap(p < 0.6 ? `第 <b>${Math.floor(hrs)}</b> 小时：SONIC 已用 <b>${Math.round(count).toLocaleString('en-US')}</b> GPU·h。SuperMimic 在第 3 小时就结束了，右边那 <b>3 个小方块</b>，比值约 7168`
        : '受控对比更干净：同样的动作、奖励、网络规模。<b>至少 120 倍</b>（144 对 1.2），而 PPO-Sim 还没到目标');
    } };
  }

  /* ---------- scene 11: deployment ---------- */
  function s11(G) {
    G.add(L.grid(24, 24));
    const pi = block(2.2, 1.4, 1.6, COL.pi, [-3.2, 2.6, 0]); G.add(pi, lab('策略 π', [-3.2, 3.75, 0]));
    const obs = block(1.6, 0.9, 1.3, COL.pi, [-7.6, 3.8, 0]), ref = block(1.6, 0.9, 1.3, COL.ref, [-7.6, 1.4, 0]); G.add(obs, ref, lab('本体观测 93 × 10 帧（带噪声）', [-7.6, 4.8, 0], { size: 22 }), lab('参考动作 10 帧', [-7.6, 0.45, 0], { size: 22 }));
    const pd = block(1.7, 1.0, 1.3, COL.sim, [1.0, 2.6, 0]); G.add(pd, lab('q_sp = α·a + q⁰\n低增益 PD → 力矩', [1.0, 3.9, 0], { size: 22 }));
    const rob = robot(COL.robot); G.add(rob);
    const nm = lab('', [0, 0, 0]); G.add(nm); let nmO = nm, lastN = -1;
    const gone = [{ n: '世界模型 f', c: COL.wm, p: [-4.2, 6.6, -3], w: 2.5 }, { n: '评论家 V', c: COL.crit, p: [-0.6, 6.6, -3], w: 1.7 }, { n: '物理参数 ξ', c: COL.rew, p: [2.7, 6.6, -3], w: 1.4 }, { n: '回放缓存', c: COL.buf, p: [-7.8, 6.6, -3], w: 2.6 }, { n: 'MuJoCo Warp', c: COL.sim, p: [6.2, 6.6, -3], w: 2 }].map(g => { const m = block(g.w, 1.1, 1.2, g.c, g.p, { opacity: 0.95 }); m.material.transparent = true; const t = lab(g.n, [g.p[0], g.p[1] + 1.0, g.p[2]], { size: 22 }); G.add(m, t); return { m, t }; });
    const f1 = stream(G, 4, COL.pi, 0.11), f2 = stream(G, 4, COL.ref, 0.11), f3 = stream(G, 4, COL.pi, 0.12), f4 = stream(G, 4, COL.sim, 0.12), f5 = stream(G, 5, COL.noise, 0.11);
    const MS = [['skip', '跳跃跨步'], ['roll', '侧滚'], ['flip90', '90° 空翻'], ['flip', '原地 360° 空翻']];
    return { update(p) {
      const fade = seg(p, 0.08, 0.24), q = (p * 22) % 1;
      gone.forEach(({ m, t }, i) => { m.material.opacity = 0.95 * (1 - fade); m.position.y = 6.6 + fade * 2.5; m.visible = fade < 1; t.visible = fade < 0.75; t.position.y = m.position.y + 1; });
      f1([obs.position.toArray(), pi.position.toArray()], q, 1); f2([ref.position.toArray(), pi.position.toArray()], q, 1); f3([pi.position.toArray(), pd.position.toArray()], q, 1); f4([pd.position.toArray(), [4.2, 1.6, 0]], q, 1);
      f5([[4.2, 0.6, -1.2], [4.2, -0.02, -1.2], [-7.6, -0.02, -1.2], obs.position.toArray()], q, fade > 0.8 ? 0.8 : 0);
      const iM = Math.min(3, Math.floor(clamp((p - 0.04) / 0.96, 0, 0.999) * 4)), u = ((p - 0.04) / 0.96 * 4) % 1, m = MS[iM], dur = m[0] === 'roll' ? 2.2 : m[0] === 'skip' ? 2.7 : 1.9;
      pose(rob, clip(m[0], Math.max(0, u) * dur), [5.0, 0.03, 0], 2.3, m[0] === 'roll' ? 0 : Math.PI / 2);
      if (iM !== lastN) { lastN = iM; G.remove(nmO); L.dispose(nmO); LABS = LABS.filter(s => s !== nmO); nmO = lab(m[1], [5.0, 5.7, 0], { size: 28, border: 'rgba(56,209,255,.8)' }); G.add(nmO); }
      cap(p < 0.24 ? '训练时用的这些，部署时<b>一个都不带</b>'
        : p < 0.6 ? '真机上只跑这一条：观测和参考 → π → 关节设定点 → 低增益 PD。<b>不需要 ξ，不需要世界模型</b>'
        : '同一个策略、<b>不按动作调参</b>，做论文里的四种动作（小人是示意，真机见原文图 6）');
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player ---------- */
  let cur = 0, api = null, playing = !L.reduced(), t0 = 0, pNow = 0, tw = null;
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
    if (!S) return;
    L.clear(root); LABS = []; PICKS = []; lastCap = null;
    const sc = SCENES[cur]; fly(...sc.cam); refDist = sc.cam[2] * aspectFix();
    const G = new THREE.Group(); root.add(G); api = BUILD[cur](G);
    const box = $('ctl');
    if (api.ctl) {
      box.hidden = false; box.innerHTML = `<span>${api.ctl.label}</span>` + api.ctl.items.map((t, k) => `<button type="button" data-k="${k}" aria-pressed="false">${t}</button>`).join('');
    } else { box.hidden = true; box.innerHTML = ''; }
    pNow = p0; t0 = performance.now() - p0 * sc.dur * 1000; api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
  }
  if (S) {
    S.onTick(() => {
      if (playing && api) {
        const sc = SCENES[cur], el = (performance.now() - t0) / 1000;
        if (el > sc.dur + HOLD) { t0 = performance.now(); pNow = 0; } else pNow = Math.min(1, el / sc.dur);
        api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
      }
      if (tw) { const k = L.reduced() ? 1 : Math.min(1, (performance.now() - tw.t0) / 900), e = L.ease(k), [a, b] = [tw.from, tw.to]; S.setView(L.lerp(a[0], b[0], e), L.lerp(a[1], b[1], e), L.lerp(a[2], b[2], e), a[3].clone().lerp(b[3], e).toArray()); if (k >= 1) tw = null; }
      const f = clamp(S.dist / refDist, 0.6, 1.6); for (const sp of LABS) sp.scale.copy(sp.userData.s0).multiplyScalar(f);
    });
    S.onClick(() => PICKS, hit => { const g = hit?.object?.userData?.go ?? hit?.object?.parent?.userData?.go; if (g != null) go(g); });
    S.onHover(() => PICKS, hit => { $('stage').style.cursor = hit ? 'pointer' : ''; });
  }
  $('ctl').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !api?.ctl) return; setPlay(false); pNow = api.ctl.p(+b.dataset.k); api.update(pNow); $('scrub').value = Math.round(pNow * 1000); });
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
