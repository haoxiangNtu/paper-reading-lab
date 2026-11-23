'use strict';
/* WM-Craftnet (arXiv 2609.07002) taken apart into eleven animated scenes. Numbers come from the paper's tables and
   from the official code at commit a1e825a (Apache-2.0, Copyright 2026 Sharpa Group). Each scene's update(p) is a pure
   function of the timeline p plus the current toggles. The hand, the depth pictures and the replay counters are drawn
   for illustration; they are labelled as such. No WSM or policy network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const PI = Math.PI;
  const COL = { prop: 0x7cb8ff, tac: 0x4fc98a, depth: 0x9d8cff, act: 0xf0963c, axis: 0xf2c14e, wm: 0x38d1ff, z: 0x3aa8e0, head: 0xd45fa0,
    actor: 0xf0963c, critic: 0x8e9bb8, priv: 0xff7a59, hand: 0xd9dde6, obj: 0xd45fa0, ok: 0x4fc98a, bad: 0xe05d5d, dim: 0x46506a,
    white: 0xeef2fa, gold: 0xf2c14e, grad: 0xff7a59, base: 0x8e9bb8, ours: 0x38d1ff };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  const SCENES = [
    { n: 1, part: '总览', title: 'WSM 当条件：世界模型只给策略一个特征', sub: '点方块跳到对应那一幕；白色是前向数据流，红色是停梯度', dur: 14, cam: [0.0, 1.02, 40, [0.5, 1.6, 0]],
      html: dl([['输入', '73 维单帧向量（本体 22 + 目标 22 + 触觉 5 + 指令轴 24）、96 × 72 深度、上一步动作'], ['WSM', 'DreamerV3 式 RSSM：h 512 维，z 为 32 × 32 类别'], ['给演员', '只给 h，停梯度，投影后拼进观测'], ['演员', '4 帧堆叠 292 维 + WSM 特征 → [512, 256, 256] → 22 维'], ['评论家', '212 维特权状态，不看 WSM'], ['不做', '想象、模型里的策略优化']]) +
        '<p>论文的核心选择：RSSM 照 DreamerV3 训，但训好以后<b>只拿它的确定性状态 h 当策略的输入</b>。PPO 的数据全部来自 Isaac Gym，梯度不穿过世界模型。这和 Dreamer 在想象里训演员、SuperMimic 穿过模型做 BPTT 都不同。</p>' + src('§3 · 图 1 · world_model.py · network_builder.py') },
    { n: 2, part: '§3.1 任务', title: '手内旋转：绕指令轴一直转', sub: '切换指令轴；手指的步态是示意，进度和重置条件是代码里的数', dur: 14, cam: [0.6, 0.95, 20, [0, 1.6, 0]],
      html: dl([['指令轴', 'a ∈ {±x, ±y, ±z}；每个轴单独训策略和 WSM'], ['一步进度', 'Δθ = proj_a log(R_{t+1} R_tᵀ)，代码再乘 20'], ['旋转奖励', 'clip(20Δθ, −6.28, 2.0) × 1.0；10 Hz 下 1 rad/s 拿满'], ['重置', '掉落 ≥ 6 cm；偏轴 &gt; 72°；转速 &lt; 0.5 rad/s 连续 60 步；500 步到时'], ['物体集', 'z 9 个、y 9 个、x 4 个']]) +
        '<p>z 轴是掌心朝上、绕竖直轴转，手掌能托住物体；y 轴和 x 轴手掌支撑少，物体会撬着手指或往下掉，更难。表 4、5 里基线在 x 轴上回报都不到 45，WM-Craftnet 432.8。</p>' +
        guess('手是 5 根三节手指加手掌的简化模型，指尖变绿表示有接触；步态是我设的正弦，不是策略输出。') + src('§3.1 · 式 2 · wm_craftnet_rotation.py:2279-2364 · spin_reward_utils.py') },
    { n: 3, part: '§3.2 输入', title: '三路输入：谁看到什么', sub: '切换“演员 / WSM”看各自的输入；颜色是向量里的各段', dur: 13, cam: [0.0, 1.05, 31, [-1.5, 2.6, 0]],
      html: dl([['单帧向量', '73 维 = 关节 22 + 上一步目标 22 + 指尖触觉 5（二值）+ 指令轴 3 × 8'], ['演员', '4 帧堆叠 = 292 维，再拼 WSM 特征'], ['WSM', '单帧 73 维（同一个 MLP）+ 深度 96 × 72（CNN）+ 上一步动作'], ['深度', '只进 WSM，不直接进演员'], ['触觉', '仿真：接触力 ≥ 0.3 ± 0.05；真机：SDK 力 / 1.5 ≥ 0.05']]) +
        '<p>论文说本体和触觉各有 MLP 分支，指令轴只给演员。代码里三者在同一个 73 维向量里、过同一个 MLP，所以 WSM 也看得到指令轴，本体解码器还要把它重建出来（读者注 5）。</p>' +
        guess('深度图是我画的玩具：一只手和一个物体的高度场，24 × 18 格代表 96 × 72。') + src('§3.2 · 表 8 · wm_craftnet_rotation.py:423-425、1632-1683') },
    { n: 4, part: '§3.2 深度', title: '带噪输入，干净目标', sub: '时间相关的坏点会持续几帧；切换论文 / 代码的噪声设置', dur: 15, cam: [0.0, 1.12, 28, [0, 2.2, 0]],
      html: dl([['干净目标', '只裁剪不加噪（代码默认连裁剪也关着）'], ['时间丢点', '论文 0.02，代码 0.01；持续概率 0.95'], ['高斯噪声', '论文有，代码关着'], ['随机旋转', '±0.3°'], ['真机', '另加 RealSense SDK 空间 + 时间滤波']]) +
        '<p>WSM 的编码器吃左边的带噪图，解码器要重建中间的干净图。表 2 里把目标换成带噪深度，回报从 753.3 降到 708.0。坏点有时间相关性：上一帧坏的点下一帧有 95% 概率还坏，所以单帧滤波去不掉，要靠循环状态的记忆。</p>' +
        guess('坏点按“新坏点概率 p、保持概率 0.95”的马尔可夫链用固定种子当场抽；右边的“WSM 重建”是我把干净图加一点模糊画的，不是网络输出。') + src('§3.2 · 表 7 · WMCraftnetRotation.yaml:143-170 · 读者注 6') },
    { n: 5, part: '§3.3 RSSM', title: '动作条件的隐动力学：一步一步滚', sub: '四个时间步展开；切换“后验 / 先验”看 z 从哪来', dur: 15, cam: [0.0, 1.05, 32, [0, 2.0, 0]],
      html: dl([['序列模型', 'h_t = GRU(h_{t−1}, z_{t−1}, u_{t−1})，512 维'], ['后验', 'z_t ~ q(z | h_t, e_t)，32 个 32 类'], ['先验', 'ẑ_t ~ p(ẑ | h_t)，不看观测'], ['KL', '自由比特 1.0；dyn 0.5，rep 0.1'], ['回合开始', 'is_first = 1 时状态重置为可学的初值'], ['给演员', 'h_t（停梯度）']]) +
        '<p>每个控制步（10 Hz）做一次观测更新。h 是确定性的记忆，z 是这一步的随机“补充”。论文式 5 把它写成 z_t, h_t = f_wm(z_{t−1}, h_{t−1}, u_{t−1}, e_t, m_t)。先验只在 KL 里用，训练里从不往前“想象”。</p>' +
        guess('z 的 32 × 32 格子里亮哪一格是固定种子抽的玩具。') + src('§3.3 · 式 5、6 · wsm/networks.py · wsm/configs.yaml') },
    { n: 6, part: '§3.3 损失', title: '七个预测头：论文、代码、发布检查点', sub: '切换三种设置；灰掉的是不起作用的头', dur: 13, cam: [0.0, 1.1, 32, [0, 2.4, 0]],
      html: dl([['深度', '干净深度，MSE，1.0'], ['本体', '73 维向量（含触觉、指令轴），symlog MSE，1.0'], ['奖励', '论文：有；代码 loss_scale = <b>0.0</b>'], ['触觉', '17 个连杆的仿真接触（≥ 0.01 N），BCE，1.0'], ['位姿', '物体位置 + 6D 旋转，0.05 / 0.5'], ['价值', 'PPO 评论家的值，100'], ['形状', '64 个 BPS 基点到网格的位移，100']]) +
        '<p>论文把“多模态重建 + 奖励预测”当监督信号的核心。发布的代码里奖励头的损失乘 0，而且任务配置改不了这个键（读者注 7）。发布的 z 轴检查点只开深度和本体两个头。表 10：不加辅助头 688.1，只加价值头 737.0，全部 753.3。</p>' + src('式 7 · 表 10 · wsm/models.py:169-173、236-314 · configs.yaml:39 · example_ckpt yaml') },
    { n: 7, part: '§3.5 策略', title: 'h 怎样喂给演员', sub: '切换投影层：论文 512→64→32→16 / 配置 512→256→128→32；红线是被挡住的梯度', dur: 15, cam: [0.0, 1.12, 36, [1.0, 1.8, 0]],
      html: dl([['停梯度', 'WSM 在环境里 no_grad 前向，h 当观测'], ['投影', '论文 16 维；配置和检查点 32 维'], ['演员', '[292 ‖ ψ(h)] → [512, 256, 256] ELU → 22'], ['动作', 'ũ = 0.8u + 0.2ũ_{t−1}；q ← q + 0.2(1±5%)ũ'], ['限位', '先截 [−1, 1]，每步最多 0.2 rad'], ['评论家', '212 维特权状态 → [512, 512, 256, 256]']]) +
        '<p>PPO 的梯度到 ψ 的第一层就停了，WSM 的参数只由式 7 的损失更新。这就是“作条件”和“BPTT”的区别：模型对策略来说只是一个会记忆、会去噪的传感器。</p>' + src('式 8、9 · 表 7 · network_builder.py:197-213、578-579 · WMCraftnetRotation.yaml:185-186') },
    { n: 8, part: '附录 A.1 训练', title: 'PPO 一个 epoch，WSM 训 10 次', sub: '环形缓存 256 行；每行是 1024 个环境的同一步', dur: 16, cam: [0.0, 1.15, 30, [0, 2.0, 0]],
      html: dl([['PPO 采样', '1024 环境 × 16 步 = 16,384 条'], ['缓存', '256 行 × 1024 = 262,144 条，只留最近 16 个 epoch'], ['预热', '10,000 条（约 10 行）'], ['WSM 一次', '16 段 × 32 步 = 512 条'], ['每 epoch', '10 次 = 5,120 条，平均每条看 0.31 次'], ['脚本默认', '256 环境（内存）']]) +
        '<p>两条优化路径交替：环境每走一步，WSM 前向一次给出 h，并把这一步写进缓存；PPO 用 16 步的轨迹更新演员和评论家；之后 WSM 从缓存里抽连续片段训 10 次。每个片段的第一步强制当作回合开始。</p>' +
        guess('缓存画成一圈 64 格，每格代表 4 行；抽样位置用固定种子当场抽。') + src('附录 A.1 · 表 7 · world_model.py:151-377 · wm_continuous.py:78-126') },
    { n: 9, part: '§4.2 结果', title: 'z 轴 9 物体：表里的数', sub: '切换表；柱高是回报（Return），柱上是数字', dur: 12, cam: [0.0, 1.18, 38, [0, 5.0, 0]],
      html: dl([['表 1 主表', '基线 236.1–386.9；从头训练 414.3；完整 WSM 753.3'], ['表 1 触觉 / 模态', '触觉全零 724.9；只本体 684.5；本体 + 触觉 698.9'], ['表 2', '带噪深度 708.0；去 h_{t−1} 705.4；z_t 策略 667.6'], ['表 9', 'LSTM 621.0；GRU 497.8'], ['表 10', '无辅助头 688.1；只价值 737.0']]) +
        '<p>触觉全零只掉 3.8%，深度的贡献（+54.4）比触觉（+14.4）大得多（读者注 13）。从头训练和预训练差 339，但论文没说清预训练用的是什么数据（读者注 14）。</p>' + src('表 1、2、9、10') },
    { n: 10, part: '§4.3–4.5', title: '可复用先验和压力测试', sub: '切换：49 物体、五块体、留出物体、扰动恢复', dur: 13, cam: [0.0, 1.15, 36, [0, 4.2, 0]],
      html: dl([['49 物体', '有先验 9.37 ± 0.13 rad/回合，无先验 3.28；掉落 6% → 0.3%'], ['五块体', 'RotR 1.10 / 1.34 / 1.46（从头 / 9 物体 / 49 物体先验）'], ['留出物体', '每轴 4 个；RotR 提升 8.6% / 89.2% / 20.9%'], ['扰动恢复', '14.1% 对最强基线 6.2%；时间 2.56 s'], ['外力', '每控制步 25% 概率、规模 0.5、衰减 0.99']]) +
        '<p>右侧的手演示训练时的扰动：随机外力、初始位姿偏移、重力方向课程（1° 到 4°）。论文自己也说，严重扰动下的恢复率仍然很低（14.1%）。</p>' +
        guess('外力箭头的方向和时刻用固定种子抽；手和物体是示意。') + src('§4.3 · 表 6 · 图 5、6、8 · 表 7') },
    { n: 11, part: '§4.2 真机', title: '上 Sharpa Wave：10 Hz 闭环', sub: '切换：表 3 转角、表 3 成功次数、20 物体 200 次', dur: 14, cam: [0.0, 1.1, 38, [0, 3.6, 0]],
      html: dl([['手', 'Sharpa Wave，22 自由度，指尖触觉'], ['相机', '论文 L515；部署代码写 D405，640 × 480 → 缩到 96 × 72'], ['频率', '10 Hz；单周期超过 100 ms 记超时'], ['每步', '读关节和触觉 → 深度滤波 → WSM 观测更新 → 演员 → 平滑、累加、截断 → 发目标'], ['结果', '鸭子 16.179 rad / 20 s；20 物体 175 / 200']]) +
        '<p>表 3 里开环回放在角块和十字块上反而好于两个闭环基线（读者注 16）。把 WSM 去噪后的深度给 In-Hand Rotation，见过的物体变好，未见的双缺口块仍然 0/10。</p>' +
        guess('手、相机和电脑的样子是示意。') + src('表 3、6 · 附录 A.3 · deploy/examples/wm_craftnet_infer.py') }
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
  function panel(G, x, y, z, w, h, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: o.color ?? 0x0c1220, transparent: true, opacity: o.opacity ?? 0.55, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }
  function floorRect(G, cx, cz, lx, lz, color, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(lx, lz), new THREE.MeshStandardMaterial({ color, roughness: 0.9 })); m.rotation.x = -PI / 2; m.position.set(cx, o.y ?? 0, cz); G.add(m); return m; }
  function arrowObj(G, from, to, color) { const a = L.arrow(from, to, color); G.add(a); return a; }
  function setArrow(a, from, to) { const f = L.V(from), t = L.V(to), d = t.clone().sub(f), len = Math.max(0.05, d.length()); a.position.copy(f); a.setDirection(d.normalize()); a.setLength(len, Math.min(0.55, len * 0.3), Math.min(0.32, len * 0.16)); }
  const pick = (m, go) => { m.userData.go = go; PICKS.push(m); return m; };

  /* bar chart rebuilt on toggle: items [[name, value, color, text]] */
  function bars(G, items, o = {}) {
    const sub = new THREE.Group(); G.add(sub); const out = [];
    const gap = o.gap ?? 2.4, w = o.w ?? 1.5, x0 = o.x0 ?? -(items.length - 1) * gap / 2, hmax = o.hmax ?? 9, vmax = o.vmax ?? Math.max(...items.map(t => Math.abs(t[1])));
    items.forEach(([nm, v, c, txt], i) => {
      const x = o.xs ? o.xs[i] : x0 + i * gap, b = block(w, 1, w, c, [x, 0.5, o.z ?? 0], { edges: true }); sub.add(b);
      const l = lab(txt ?? String(v), [x, 1, (o.z ?? 0) + 0.4], { size: o.vs ?? 16, color: o.vc }); sub.add(l);
      if (nm) sub.add(lab(nm, [x, -0.7 - (i % 2) * (o.stag ?? 0), (o.z ?? 0) + 1.2], { size: o.ns ?? 14 }));
      out.push({ b, l, h: Math.max(0.04, Math.abs(v) / vmax * hmax), dy: (o.lstag ?? 0) * (i % 2) });
    });
    return { sub, set(g) { out.forEach(({ b, l, h, dy }) => { const hh = Math.max(0.03, h * g); b.scale.y = hh; b.position.y = hh / 2; l.position.y = hh + 0.55 + dy; }); } };
  }

  /* a simplified five-finger hand, palm up, palm centre at origin of the returned group */
  function makeHand(G, o = {}) {
    const H = new THREE.Group(); G.add(H); const sc = o.scale ?? 1; H.scale.setScalar(sc);
    const palm = block(3.2, 0.55, 3.4, COL.hand, [0, 0, 0.2], { edgeOpacity: 0.2 }); H.add(palm);
    const fingers = [], tips = [];
    const mk = (base, rotY, lens) => {
      const g0 = new THREE.Group(); g0.position.set(...base); g0.rotation.y = rotY; H.add(g0); const joints = []; let parent = g0;
      lens.forEach((len, k) => { const j = new THREE.Group(); parent.add(j); if (k > 0) j.position.z = -lens[k - 1]; const s = block(0.52 - k * 0.06, 0.48 - k * 0.05, len, COL.hand, [0, 0, -len / 2], { edgeOpacity: 0.2 }); j.add(s); joints.push(j); parent = j; });
      const tip = L.sphere(0.27, 0x9aa6bf); tip.position.z = -lens[lens.length - 1]; parent.add(tip); tips.push(tip);
      fingers.push(joints);
    };
    [-1.2, -0.4, 0.4, 1.2].forEach((x, i) => mk([x, 0.1, -1.5], 0, [1.15, 0.85, 0.65].map(v => v * (i === 1 ? 1.08 : i === 3 ? 0.88 : 1))));
    mk([1.7, 0.1, 0.9], -PI / 2.6, [1.0, 0.8, 0.6]);
    return {
      H, tips,
      pose(t, amp = 1, contact = null) {
        fingers.forEach((js, i) => { const ph = t * 2 * PI + i * 1.25; const c = 0.55 + 0.32 * amp * Math.sin(ph); js[0].rotation.x = c; js[1].rotation.x = 0.55 + 0.35 * amp * Math.sin(ph - 0.6); js[2].rotation.x = 0.4 + 0.25 * amp * Math.sin(ph - 1.1); });
        tips.forEach((tp, i) => { const on = contact ? contact[i] : Math.sin(t * 2 * PI + i * 1.25) > -0.1; tp.material.color.setHex(on ? COL.ok : 0x9aa6bf); tp.material.emissive.setHex(on ? 0x1f6b44 : 0x000000); });
      }
    };
  }
  function objMesh(G, kind, color) {
    let m;
    if (kind === 'cyl') { m = L.cyl(0.85, 0.85, 1.9, color); m = (() => { const g = new THREE.Group(); g.add(m); return g; })(); }
    else if (kind === 'cross') { const g = new THREE.Group(); g.add(block(2.0, 1.4, 0.7, color, [0, 0, 0])); g.add(block(0.7, 1.4, 2.0, color, [0, 0, 0])); m = g; }
    else m = block(1.6, 1.6, 1.6, color, [0, 0, 0]);
    G.add(m); return m;
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

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    const B = (w, h, d, c, pos, t, go, o = {}) => { const b = pick(block(w, h, d, c, pos), go); G.add(b, lab(t, [pos[0], pos[1] + h / 2 + 0.75, pos[2]], { size: o.size ?? 16 })); return b; };
    const inP = B(1.6, 1.2, 1.2, COL.prop, [-15, 6.6, 0], '本体 44', 2), inT = B(1.6, 0.6, 1.2, COL.tac, [-15, 3.6, 0], '触觉 5', 2), inA = B(1.6, 0.8, 1.2, COL.axis, [-15, 0.9, 0], '指令轴', 1), inD = B(1.8, 1.6, 0.3, COL.depth, [-15, -2.6, 0], '深度 96×72', 3);
    const enc = B(1.8, 3.4, 1.6, COL.wm, [-10.5, 1.8, 0], '编码器', 4), rssm = B(3.2, 2.4, 2.2, COL.wm, [-5.6, 1.8, 0], 'RSSM', 4);
    const hB = B(0.7, 2.6, 0.7, COL.wm, [-2.2, 1.8, 0], 'h 512', 6);
    const heads = B(2.6, 1.6, 1.6, COL.head, [-5.6, 6.6, 0], '7 个预测头', 5);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 5), new THREE.MeshBasicMaterial({ color: COL.grad, transparent: true, opacity: 0.85 })); wall.position.set(-0.4, 1.8, 0); wall.rotation.y = PI / 2; G.add(wall, lab('停梯度', [-0.4, 5.2, 0], { size: 15, color: '#ff7a59' }));
    const proj = B(1.0, 1.2, 1.0, COL.actor, [1.4, 1.8, 0], 'ψ 投影', 6), actor = B(2.6, 2.8, 2.0, COL.actor, [5.2, 1.8, 0], '演员 MLP', 6);
    const obs = B(1.0, 2.0, 1.0, COL.prop, [5.2, 6.4, 0], '4 帧堆叠 292', 2);
    const critic = B(2.6, 2.0, 2.0, COL.critic, [5.2, -3.4, 0], '评论家', 6), priv = B(1.4, 1.4, 1.4, COL.priv, [1.4, -3.4, 0], '特权 212', 6);
    const hand = makeHand(G, { scale: 0.75 }); hand.H.position.set(12.8, 0.4, 0); hand.H.rotation.y = -PI / 2;
    const cube = objMesh(G, 'box', COL.obj); cube.scale.setScalar(0.7); cube.position.set(12.8, 1.6, 0);
    G.add(lab('22 个关节目标', [10.0, 4.2, 0], { size: 15 }), lab('不做想象', [-5.6, -1.4, 0], { size: 14, color: '#9aa6bf' }));
    const fw = [stream(G, 6, COL.white, 0.12), stream(G, 6, COL.white, 0.12), stream(G, 6, COL.white, 0.12), stream(G, 6, COL.white, 0.12), stream(G, 8, COL.white, 0.12), stream(G, 6, COL.white, 0.12), stream(G, 6, COL.white, 0.12)];
    const grd = stream(G, 6, COL.grad, 0.13);
    return { update(p) {
      const ph = (p * 4) % 1;
      fw[0]([[-14.1, 6.6, 0], [-11.4, 2.8, 0]], ph, 1); fw[1]([[-14.1, 3.6, 0], [-11.4, 2.0, 0]], ph, 1); fw[2]([[-14.1, -2.6, 0], [-11.4, 1.0, 0]], ph, 1); fw[3]([[-9.6, 1.8, 0], [-7.2, 1.8, 0]], ph, 1);
      fw[4]([[-4, 1.8, 0], [-2.2, 1.8, 0], [1.4, 1.8, 0], [3.9, 1.8, 0], [6.5, 1.8, 0], [11, 1.2, 0]], ph, 1);
      fw[5]([[-5.6, 3, 0], [-5.6, 5.8, 0]], ph, 1); fw[6]([[5.2, 5.4, 0], [5.2, 3.2, 0]], ph, 1);
      grd([[5.2, 1.8, 0.8], [1.4, 1.8, 0.8], [-0.3, 1.8, 0.8]], (1 - ph), 1);
      hand.pose(p * 3); cube.rotation.y = p * 2 * PI;
      [enc, rssm, hB, actor].forEach((m, i) => glow(m, 0.25 + 0.25 * Math.sin(p * 20 - i)));
      cap('白色：观测 → 编码器 → RSSM → h → 演员 → 关节目标 · 红色：PPO 的梯度到 ψ 就停了，WSM 只由自己的损失训练');
    } };
  }

  /* ---------- scene 2: the task ---------- */
  function s2(G) {
    let ax = 0; const AX = [[0, 1, 0], [0, 0, 1], [1, 0, 0]], AXN = ['z（竖直）', 'y', 'x'];
    const hand = makeHand(G); const obj = new THREE.Group(); G.add(obj); obj.position.set(0, 1.9, -0.2);
    let mesh = objMesh(obj, 'cross', COL.obj);
    const axL = arrowObj(G, [0, -1, -0.2], [0, 5, -0.2], COL.axis);
    const tx = dynLab(G, [-5.2, 5.2, 0], { size: 17 }), ty = dynLab(G, [5.6, 4.6, 0], { size: 15 });
    G.add(lab('掉落：离初始位置 ≥ 6 cm', [6.0, 2.6, 0], { size: 14 }), lab('偏轴 > 72° → 重置', [6.0, 1.6, 0], { size: 14 }), lab('< 0.5 rad/s 连续 6 s → 重置', [6.0, 0.6, 0], { size: 14 }));
    const ctls = [{ label: '指令轴', items: ['z', 'y', 'x'], get: () => ax, set: k => { ax = k; obj.remove(mesh); mesh = objMesh(obj, k === 1 ? 'cyl' : k === 2 ? 'box' : 'cross', COL.obj); if (k === 1) mesh.rotation.x = PI / 2; } }];
    return { ctls, update(p) {
      const a = AX[ax]; const th = p * 2 * PI * 1.5;
      obj.quaternion.setFromAxisAngle(new THREE.Vector3(...a), th);
      setArrow(axL, [-a[0] * 3, 1.9 - a[1] * 3, -0.2 - a[2] * 3], [a[0] * 3.5, 1.9 + a[1] * 3.5, -0.2 + a[2] * 3.5]);
      hand.pose(p * 6, ax === 0 ? 0.7 : 1.1);
      const steps = Math.round(p * 140), dth = 1.5 * 2 * PI / 140, r = Math.min(2.0, 20 * dth);
      tx(`第 ${steps} 步 · 累计 ${(th).toFixed(2)} rad`); ty(`每步 Δθ = ${dth.toFixed(3)} rad\n奖励 clip(20Δθ) = ${r.toFixed(2)}`);
      cap(`指令轴 ${AXN[ax]} · 一步旋转奖励 = min(20·Δθ, 2.0)，10 Hz 下转速 1 rad/s 拿满 · 表 5：x 轴基线回报都低于 45`);
    } };
  }

  /* ---------- scene 3: inputs ---------- */
  function s3(G) {
    let who = 0; const segc = i => i < 22 ? COL.prop : i < 44 ? 0x5a8fd6 : i < 49 ? COL.tac : COL.axis;
    const V = inst(CUBE, 73 * 4); G.add(V); const r = L.rng(3);
    const vals = Array.from({ length: 73 }, (_, i) => i < 44 ? 0.3 + 0.7 * r() : i < 49 ? (r() > 0.5 ? 1 : 0.15) : ((i - 49) % 3 === 2 ? 1 : 0.15));
    for (let f = 0; f < 4; f++) for (let i = 0; i < 73; i++) { colI(V, f * 73 + i, hex3(segc(i))); }
    const D = inst(CUBE, 24 * 18); G.add(D);
    const dep = (i, j) => { const x = (i - 12) / 12, y = (j - 9) / 9; const hand = Math.exp(-((x + 0.1) ** 2 / 0.5 + (y - 0.5) ** 2 / 0.12)) * 0.7; const ob = Math.exp(-((x - 0.05) ** 2 + (y + 0.05) ** 2) / 0.09); return Math.max(hand, ob); };
    for (let i = 0; i < 24; i++) for (let j = 0; j < 18; j++) { const v = dep(i, j); colI(D, i * 18 + j, [0.25 + 0.6 * v, 0.25 + 0.5 * v, 0.45 + 0.5 * v]); }
    const wmB = block(2.6, 2.4, 2.0, COL.wm, [7.5, 1.5, 0]), acB = block(2.6, 2.4, 2.0, COL.actor, [7.5, 6.6, 0]); G.add(wmB, acB, lab('WSM（单帧 + 深度）', [7.5, 3.4, 0], { size: 15 }), lab('演员（4 帧 + ψ(h)）', [7.5, 8.5, 0], { size: 15 }));
    G.add(lab('关节 22', [-9.6, 4.2, 1.2], { size: 13, color: css(COL.prop) }), lab('目标 22', [-5.6, 4.2, 1.2], { size: 13, color: '#5a8fd6' }), lab('触觉 5', [-2.8, 4.2, 1.2], { size: 13, color: css(COL.tac) }), lab('指令轴 3×8', [0.2, 4.2, 1.2], { size: 13, color: css(COL.axis) }));
    G.add(lab('深度 96×72（画成 24×18）', [-6.2, -2.2, 0], { size: 15 }), lab('4 帧：前排 t，后排 t−1 … t−3', [-5, 10.6, -3.6], { size: 13 }));
    const f1 = stream(G, 7, COL.white, 0.12), f2 = stream(G, 7, COL.white, 0.12), f3 = stream(G, 7, COL.white, 0.12);
    const ctls = [{ label: '看谁的输入', items: ['演员', 'WSM'], get: () => who, set: k => { who = k; } }];
    return { ctls, update(p) {
      const g = seg(p, 0, 0.3);
      for (let f = 0; f < 4; f++) for (let i = 0; i < 73; i++) { const on = who === 0 || f === 0; const h = (0.2 + 1.6 * vals[(i + f * 7) % 73]) * g * (on ? 1 : 0.25); setI(V, f * 73 + i, [-11.5 + i * 0.18, 5.0 + f * 1.0 + h / 2, -f * 1.2], [0.15, Math.max(0.02, h), 0.3]); }
      done(V);
      for (let i = 0; i < 24; i++) for (let j = 0; j < 18; j++) { const v = dep(i, j), h = 0.1 + 1.4 * v * g; setI(D, i * 18 + j, [-9 + i * 0.34, h / 2 - 1.2 + (who === 1 ? 0 : 0), j * 0.34 - 3.2 + 0.0], [0.3, h * (who === 1 ? 1 : 0.35), 0.3]); }
      done(D);
      const ph = (p * 3) % 1;
      if (who === 0) { f1([[0, 5.2, 0], [6.2, 6.6, 0]], ph, 1); f2([[7.5, 2.8, 0], [7.5, 5.4, 0]], ph, 1); f3([], 0, 0); }
      else { f1([[-3, 5.0, 0], [6.2, 1.8, 0]], ph, 1); f2([[-1, 0, 0], [6.2, 1.2, 0]], ph, 1); f3([], 0, 0); }
      glow(acB, who === 0 ? 0.5 : 0.05); glow(wmB, who === 1 ? 0.5 : 0.05);
      cap(who === 0 ? '演员：4 帧 × 73 = 292 维 + WSM 投影特征（配置 32 维）；<b>深度不直接进演员</b>，只经过 h' : 'WSM：只看当前一帧的 73 维（含触觉和指令轴，同一个 MLP）+ 深度（CNN）+ 上一步动作');
    } };
  }

  /* ---------- scene 4: noisy depth in, clean depth out ---------- */
  function s4(G) {
    let mode = 1; const NI = 24, NJ = 18, N = NI * NJ, T = 80;
    const dep = (i, j) => { const x = (i - 12) / 12, y = (j - 9) / 9; const hand = Math.exp(-((x + 0.1) ** 2 / 0.5 + (y - 0.5) ** 2 / 0.12)) * 0.7; const ob = Math.exp(-((x - 0.05) ** 2 + (y + 0.05) ** 2) / 0.09); return Math.max(hand, ob); };
    const masks = {};
    const getMask = m => { if (masks[m]) return masks[m]; const r = L.rng(17 + m), pd = m === 0 ? 0.02 : 0.01, out = []; let cur = new Uint8Array(N); for (let t = 0; t < T; t++) { const nx = new Uint8Array(N); for (let k = 0; k < N; k++) nx[k] = cur[k] ? (r() < 0.95 ? 1 : 0) : (r() < pd ? 1 : 0); out.push(nx); cur = nx; } const gn = Array.from({ length: T }, () => Float32Array.from({ length: N }, () => L.gauss(r))); return (masks[m] = { out, gn }); };
    const grids = [-9.6, 0, 9.6].map(() => { const im = inst(CUBE, N); G.add(im); return im; });
    G.add(lab('带噪输入（进编码器）', [-9.6, 5.6, 0], { size: 16 }), lab('干净目标（解码器监督）', [0, 5.6, 0], { size: 16 }), lab('WSM 重建（示意）', [9.6, 5.6, 0], { size: 16 }));
    const cnt = dynLab(G, [-9.6, -4.4, 2], { size: 14 });
    const ctls = [{ label: '噪声设置', items: ['论文（0.02 + 高斯）', '代码（0.01，无高斯）'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const t = Math.min(T - 1, Math.floor(p * T)), M = getMask(mode), mk = M.out[t], rot = 0.3 * PI / 180 * Math.sin(t * 1.7) * 30; let bad = 0;
      for (let g = 0; g < 3; g++) { const im = grids[g], cx = [-9.6, 0, 9.6][g];
        for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) { const k = i * NJ + j; let v = dep(i, j);
          if (g === 0) { if (mode === 0) v = clamp(v + 0.06 * M.gn[t][k], 0, 1); if (mk[k]) { v = 0; bad++; } }
          if (g === 2) v = 0.85 * v + 0.15 * (dep(Math.max(0, i - 1), j) + dep(Math.min(NI - 1, i + 1), j)) / 2;
          const x = cx - 4 + i * 0.34, y = 1.0 + (j - 9) * 0.34; const xx = g === 0 ? x + (y - 1) * rot : x;
          setI(im, k, [xx, y, v * 0.6], [0.31, 0.31, 0.05 + v * 1.2]);
          colI(im, k, g === 0 && mk[k] ? [0.95, 0.95, 0.95] : [0.18 + 0.7 * v, 0.2 + 0.55 * v, 0.35 + 0.6 * v]); }
        done(im); }
      cnt(`第 ${t} 帧 · 坏点 ${bad} / ${N}（白）`);
      cap(mode === 0 ? '论文：时间丢点 0.02、保持 0.95，加高斯噪声，±0.3° 旋转 · 表 2：目标换成带噪深度，回报 753.3 → 708.0' : '代码（WMCraftnetRotation.yaml:152-166）：丢点 0.01、保持 0.95，<b>高斯噪声和裁剪都关着</b>，±0.3° 旋转');
    } };
  }

  /* ---------- scene 5: RSSM unrolled ---------- */
  function s5(G) {
    let mode = 0; const K = 4, xs = [-9, -3, 3, 9];
    const hs = xs.map((x, i) => { const b = block(1.0, 2.6, 1.0, COL.wm, [x, 3.6, 0]); G.add(b, lab(`h${['ₜ₋₃', 'ₜ₋₂', 'ₜ₋₁', 'ₜ'][i]}`, [x, 5.5, 0], { size: 17 })); return b; });
    const zs = xs.map(x => { const im = inst(CUBE, 64); G.add(im); return im; });
    const es = xs.map(x => { const b = block(1.4, 0.8, 1.0, COL.depth, [x + 1.4, -2.4, 0]); G.add(b); return b; });
    xs.forEach((x, i) => { G.add(lab('eₜ（观测编码）', [x + 1.4, -3.5, 0], { size: 12 })); if (i < K - 1) G.add(lab('u', [x + 3, 2.0, 0], { size: 13, color: css(COL.act) })); });
    G.add(lab('z：32 个 32 类\n（画 8×8）', [-12.4, 0.2, 0], { size: 13 }), lab('h → 演员', [12, 3.6, 0], { size: 15, color: css(COL.actor) }));
    const r = L.rng(5), cat = xs.map(() => Array.from({ length: 64 }, () => r() < 0.14));
    const f = [0, 1, 2].map(() => stream(G, 6, COL.white, 0.12)), fu = [0, 1, 2].map(() => stream(G, 4, COL.act, 0.12)), fe = xs.map(() => stream(G, 4, COL.depth, 0.11));
    const kl = dynLab(G, [3, -5.0, 0], { size: 15 });
    const ctls = [{ label: 'z 来自', items: ['后验（看观测）', '先验（只看 h）'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const ph = (p * 3) % 1, act = Math.floor(p * K * 0.999);
      xs.forEach((x, i) => { const on = i <= act; glow(hs[i], on ? 0.5 : 0.02); hs[i].material.opacity = on ? 1 : 0.35; hs[i].material.transparent = true;
        for (let k = 0; k < 64; k++) { setI(zs[i], k, [x - 1.05 + (k % 8) * 0.3, 0.4 + Math.floor(k / 8) * 0.3 - 0.6, 0], 0.24); colI(zs[i], k, on && cat[i][k] ? hex3(mode === 0 ? COL.z : 0xb0b8c8) : [0.15, 0.18, 0.26]); } done(zs[i]);
        fe[i]([[x + 1.4, -2.0, 0], [x + 0.6, 0.0, 0]], ph, on && mode === 0 ? 1 : 0); });
      for (let i = 0; i < K - 1; i++) { f[i]([[xs[i] + 0.5, 3.6, 0], [xs[i + 1] - 0.5, 3.6, 0]], ph, i < act ? 1 : 0); fu[i]([[xs[i] + 1.5, 1.6, 0], [xs[i + 1] - 0.5, 3.0, 0]], ph, i < act ? 1 : 0); }
      kl(mode === 0 ? 'KL(后验 ‖ 先验)：dyn 0.5 · rep 0.1 · 自由比特 1.0' : '先验 ẑ 只在 KL 里用，训练从不往前想象');
      cap(mode === 0 ? '后验：z_t 看 h_t 和这一步的观测编码 e_t · h_t = GRU(h_{t−1}, z_{t−1}, u_{t−1})，演员拿的是 h_t' : '先验：ẑ_t 只看 h_t · DreamerV3 用它在想象里滚轨迹；WM-Craftnet 只在 KL 里用，代码的 imagine_with_action 没有调用方');
    } };
  }

  /* ---------- scene 6: prediction heads ---------- */
  function s6(G) {
    let mode = 1; const HD = [['深度', 1, 1, 1, '1.0'], ['本体', 1, 1, 1, '1.0'], ['奖励', 1, 0, 0, '×0'], ['触觉 17 连杆', 1, 1, 0, '1.0'], ['位姿', 1, 1, 0, '0.05 / 0.5'], ['价值', 1, 1, 0, '100'], ['形状 BPS', 1, 1, 0, '100']];
    const feat = block(3.0, 2.0, 2.0, COL.wm, [0, 0.6, 0]); G.add(feat, lab('[z, h] 1536 维', [0, -1.0, 1.4], { size: 15 }));
    const heads = HD.map(([nm], i) => { const a = -PI * 0.85 + i * (PI * 0.7 / 6) + PI / 2; const x = Math.cos(a) * 0 + (i - 3) * 3.4, y = 6.2 + (i % 2) * 1.6; const b = block(2.2, 1.2, 1.2, COL.head, [x, y, 0]); G.add(b); const l = dynLab(G, [x, y + 1.3, 0], { size: 14 }); return { b, l, x, y, nm }; });
    const fl = heads.map(() => stream(G, 5, COL.white, 0.11)), gr = heads.map(() => stream(G, 5, COL.grad, 0.11));
    const ctls = [{ label: '设置', items: ['论文', '代码默认', '发布检查点'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const ph = (p * 3) % 1;
      heads.forEach((h, i) => { const on = HD[i][mode + 1]; const coef = mode === 0 ? (i === 2 ? 'λr 未给' : i < 2 ? '1' : i === 3 ? 'λc 未给' : '未给') : (mode === 2 && !on ? '关' : HD[i][4]);
        h.b.material.color.setHex(on ? COL.head : COL.dim); glow(h.b, on ? 0.3 : 0); h.l(`${h.nm} · ${coef}`);
        fl[i]([[0, 1.6, 0], [h.x, h.y - 0.6, 0]], ph, 1); gr[i]([[h.x, h.y - 0.6, 0.3], [0, 1.6, 0.3]], ph, on ? 1 : 0); });
      cap(['论文式 7：深度 + 本体 + λc 触觉 + λr 奖励 + KL + 辅助（位姿、价值、形状）；λ 的值没给', '代码默认：七个头都建了，但奖励头 loss_scale = 0（configs.yaml:39），红色梯度流不到；系数见标签', '发布的 z 轴检查点：只开深度和本体两个头，最接近表 10 的“无辅助头”（688.1）'][mode]);
    } };
  }

  /* ---------- scene 7: feeding h to the actor ---------- */
  function s7(G) {
    let v = 1; const PJ = [[64, 32, 16], [256, 128, 32]];
    const h = block(0.8, 4.2, 0.8, COL.wm, [-13, 2.4, 0]); G.add(h, lab('h 512', [-13, 5.2, 0], { size: 16 }));
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 6), new THREE.MeshBasicMaterial({ color: COL.grad, transparent: true, opacity: 0.22, side: THREE.DoubleSide })); wall.position.set(-11, 2.4, 0); wall.rotation.y = PI / 2; G.add(wall, lab('停梯度', [-11, 6.0, 0], { size: 15, color: '#ff7a59' }));
    const sub = new THREE.Group(); G.add(sub); let last = -1, pj = [];
    const obs = block(0.8, 3.6, 0.8, COL.prop, [-3.0, -2.2, 0]); G.add(obs, lab('观测 292', [-3.0, -4.8, 0], { size: 14 }));
    const acts = [512, 256, 256, 22].map((d, i) => { const hh = Math.sqrt(d) * 0.2; const b = block(0.8, hh, 0.8, COL.actor, [1.2 + i * 2.2, 2.4, 0]); G.add(b, lab(String(d), [1.2 + i * 2.2, 2.4 + hh / 2 + 0.6, 0], { size: 13 })); return b; });
    G.add(lab('演员 MLP', [4.5, 6.6, 0], { size: 15 }));
    const ema = block(1.4, 1.0, 1.0, COL.gold, [10.2, 2.4, 0]), integ = block(1.4, 1.0, 1.0, COL.gold, [14.2, 2.4, 0]); G.add(ema, integ, lab('平滑 0.8', [10.2, 3.6, 0], { size: 13 }), lab('q += 0.2ũ', [14.2, 3.6, 0], { size: 13 }));
    const critic = block(2.4, 1.6, 1.4, COL.critic, [4.5, -3.0, 0]), priv = block(1.0, 1.4, 1.0, COL.priv, [1.0, -3.0, 0]); G.add(critic, priv, lab('评论家（特权 212，不看 h）', [4.5, -4.6, 0], { size: 13 }));
    const fw = stream(G, 9, COL.white, 0.12), fo = stream(G, 5, COL.white, 0.12), gb = stream(G, 6, COL.grad, 0.13);
    const X = lab('✕', [-10.6, 2.4, 0.4], { size: 30, color: '#ff7a59' }); G.add(X);
    const qL = dynLab(G, [12.2, 0.6, 0], { size: 13 });
    function rebuild() { L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); pj = []; last = v;
      PJ[v].forEach((d, i) => { const hh = Math.sqrt(d) * 0.2, x = -9.0 + i * 1.7; const b = block(0.7, hh, 0.7, COL.actor, [x, 2.4, 0]); sub.add(b, lab(String(d), [x, 2.4 + hh / 2 + 0.55, 0], { size: 13 })); pj.push(b); });
      sub.add(lab(v === 0 ? 'ψ：论文 512→64→32→16' : 'ψ：配置 512→256→128→32', [-7.3, -0.9, 0], { size: 14 })); }
    rebuild();
    const ctls = [{ label: '投影层', items: ['论文', '配置 / 检查点'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      if (last !== v) rebuild();
      const ph = (p * 3) % 1;
      fw([[-12.6, 2.4, 0], [-9, 2.4, 0], [-5.6, 2.4, 0], [1.2, 2.4, 0], [7.8, 2.4, 0], [10.2, 2.4, 0], [14.2, 2.4, 0]], ph, 1);
      fo([[-3.0, -0.4, 0], [1.2, 1.6, 0]], ph, 1);
      gb([[7.8, 2.4, 0.6], [1.2, 2.4, 0.6], [-5.6, 2.4, 0.6], [-10.7, 2.4, 0.6]], 1 - ph, 1);
      const u = Math.sin(p * 12), ut = 0.8 * u + 0.2 * Math.sin((p - 0.04) * 12), q = 0.2 * ut;
      qL(`u ${u.toFixed(2)} → ũ ${ut.toFixed(2)} → Δq ${q.toFixed(3)} rad`);
      cap(`投影后 ${PJ[v][2]} 维拼到 292 维观测后面，共 ${292 + PJ[v][2]} 维 · 红色是 PPO 的梯度，到投影层的输入就被挡住 · 参数量：论文约 3.5 万，配置约 16.8 万`);
    } };
  }

  /* ---------- scene 8: training loop ---------- */
  function s8(G) {
    const R = 64, ring = inst(CUBE, R); G.add(ring); const rad = 6.2;
    const ppo = block(3.0, 1.6, 1.6, COL.actor, [-11, 2.2, 0]), wm = block(3.0, 1.6, 1.6, COL.wm, [11, 2.2, 0]); G.add(ppo, wm, lab('PPO 采样 16 步 × 1024 环境', [-11, 4.0, 0], { size: 14 }), lab('WSM 训练 10 次 × (16 × 32)', [11, 4.0, 0], { size: 14 }));
    G.add(lab('环形缓存 256 行\n（画 64 格）', [0, 0.6, 0], { size: 15 }));
    const chunks = inst(CUBE, 16); G.add(chunks);
    const cnt = dynLab(G, [0, -6.6, 0], { size: 15 }), ptr = arrowObj(G, [0, 2.2, 0], [0, 8.2, 0], COL.gold);
    const fw = stream(G, 8, COL.white, 0.13), fs = stream(G, 8, COL.wm, 0.13); const r = L.rng(11);
    const samp = Array.from({ length: 40 }, () => Array.from({ length: 16 }, () => r()));
    return { update(p) {
      const EP = 20, e = p * EP, ep = Math.floor(e), fr = e - ep, phase = fr < 0.6 ? 0 : 1, rows = Math.min(256, Math.floor((ep + Math.min(1, fr / 0.6)) * 16)), filled = Math.min(R, Math.ceil(rows / 4));
      const wIdx = Math.floor(((ep + Math.min(1, fr / 0.6)) * 16) / 4) % R;
      for (let k = 0; k < R; k++) { const a = k / R * 2 * PI; setI(ring, k, [Math.sin(a) * rad, 2.2 + Math.cos(a) * rad, 0], [0.5, 0.5, 0.8]); const age = (wIdx - k + R) % R; colI(ring, k, k < filled || rows >= 256 ? hex3(age < 4 ? COL.gold : COL.wm).map(c => c * (age < 4 ? 1 : 0.55 + 0.45 * (1 - age / R))) : [0.15, 0.18, 0.26]); }
      done(ring);
      const a = wIdx / R * 2 * PI; setArrow(ptr, [0, 2.2, 0], [Math.sin(a) * (rad - 0.8), 2.2 + Math.cos(a) * (rad - 0.8), 0]);
      const can = rows >= 33 && (ep + fr) * 16384 >= 10000;
      for (let c = 0; c < 16; c++) { const s = samp[ep % 40][c], kk = Math.floor(s * Math.max(1, filled - 8)); const aa = kk / R * 2 * PI; const on = phase === 1 && can; setI(chunks, c, on ? [Math.sin(aa) * (rad + 1.3), 2.2 + Math.cos(aa) * (rad + 1.3), 0] : [0, -50, 0], [0.35, 0.35, 0.35]); colI(chunks, c, hex3(COL.ok)); }
      done(chunks);
      fw([[-9.5, 2.2, 0], [-rad, 2.2, 0]], (fr / 0.6) % 1, phase === 0 ? 1 : 0); fs([[rad, 2.2, 0], [9.5, 2.2, 0]], ((fr - 0.6) / 0.4 * 3) % 1, phase === 1 && can ? 1 : 0);
      glow(ppo, phase === 0 ? 0.6 : 0.05); glow(wm, phase === 1 && can ? 0.6 : 0.05);
      const tot = Math.round((ep + Math.min(1, fr / 0.6)) * 16384);
      cnt(`第 ${ep + 1} 个 PPO epoch · 已采 ${tot.toLocaleString()} 条 · 缓存 ${Math.min(rows, 256)} / 256 行${can ? '' : ' · 预热中'}`);
      cap(phase === 0 ? 'PPO 阶段：每个环境步 WSM 前向一次给出 h，同时写一行（1024 个环境的这一步）进环形缓存' : 'WSM 阶段：从缓存里抽 16 段、每段 32 步，训 10 次 = 5,120 条；同期新采 16,384 条，平均每条只看 0.31 次');
    } };
  }

  /* ---------- scene 9: z-axis tables ---------- */
  function s9(G) {
    let view = 0; const B = COL.base, O = COL.ours, A = 0x6fa8dc;
    const V = [
      { t: '表 1 主表（Return）', s: [['开环回放', 306.3, B], ['盲 RL', 304.1, B], ['Touch Dext.', 386.9, B], ['RL 仅深度', 362.2, B], ['In-Hand Rot.', 236.1, B], ['WSM 从头', 414.3, A], ['完整 WSM', 753.3, O]] },
      { t: '表 1 触觉遮蔽 / 模态', s: [['触觉全零', 724.9, A], ['丢 75%', 735.2, A], ['丢 50%', 737.8, A], ['丢 25%', 743.4, A], ['只本体', 684.5, B], ['本体+触觉', 698.9, B], ['完整 WSM', 753.3, O]] },
      { t: '表 2 受控变体', s: [['带噪深度监督', 708.0, B], ['去 h_{t−1}', 705.4, B], ['z_t 策略', 667.6, B], ['完整 WSM', 753.3, O]] },
      { t: '表 9 循环历史', s: [['LSTM', 621.0, B], ['GRU', 497.8, B], ['完整 WSM', 753.3, O]] },
      { t: '表 10 辅助头', s: [['无辅助头', 688.1, B], ['只价值', 737.0, A], ['只位姿', 690.0, A], ['只形状', 689.2, A], ['完整 WSM', 753.3, O]] }];
    let ch = null, last = -1;
    const title = dynLab(G, [0, 12.6, 0], { size: 19, border: 'rgba(56,209,255,.7)' });
    function rebuild() { if (ch) { L.clear(ch.sub); G.remove(ch.sub); LABS = LABS.filter(s => s.parent !== ch.sub); } last = view; const v = V[view];
      ch = bars(G, v.s.map(([n, x, c]) => [n, x, c, x.toFixed(1)]), { gap: 3.6, w: 2.0, vmax: 760, hmax: 10, stag: 1.0, ns: 14 }); }
    rebuild();
    const MSG = ['基线 236.1–386.9 · 从头训练 414.3（RotR 0.742 反而最低）· 完整 WSM 753.3', '触觉从全有到全零只掉 3.8%；没有深度的“本体 + 触觉”只有 698.9', '干净深度目标 +45.3；循环 h 比每步 z_t +85.7；去 h_{t−1} 换来更低的 OffAxis 1.125', '同样的历史，不加预测损失：LSTM 621.0，GRU 497.8', '价值头单独 +48.9 最多；位姿头单独 AngVar 最低 1.231'];
    const ctls = [{ label: '表', items: ['表 1', '表 1 遮蔽', '表 2', '表 9', '表 10'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) { if (last !== view) rebuild(); ch.set(seg(p, 0, 0.45)); title(V[view].t); cap(MSG[view]); } };
  }

  /* ---------- scene 10: prior and stress tests ---------- */
  function s10(G) {
    let view = 0; const B = COL.base, O = COL.ours;
    const V = [
      { t: '49 个新物体：每回合转角（rad）', s: [['无先验', 3.28, B, '3.28'], ['9 物体先验', 9.37, O, '9.37 ± 0.13']], vmax: 10 },
      { t: '五块体诊断：RotR', s: [['从头', 1.10, B, '1.10'], ['9 物体先验', 1.34, 0x6fa8dc, '1.34'], ['49 物体先验', 1.46, O, '1.46']], vmax: 1.5 },
      { t: '表 6 留出物体：RotR', s: [['x 最强基线', 0.923, B, '0.923'], ['x 本文', 1.002, O, '1.002'], ['y 最强基线', 0.378, B, '0.378'], ['y 本文', 0.715, O, '0.715'], ['z 最强基线', 0.696, B, '0.696'], ['z 本文', 0.842, O, '0.842']], vmax: 1.1 },
      { t: '表 6 仿真扰动恢复率（%）', s: [['盲 RL', 4.7, B, '4.7'], ['Touch Dext.', 6.2, B, '6.2'], ['RL 无触觉', 5.5, B, '5.5'], ['In-Hand Rot.', 0.0, B, '0.0'], ['本文', 14.1, O, '14.1']], vmax: 15 }];
    const hold = new THREE.Group(); G.add(hold); hold.position.set(-6, 0, 0);
    let ch = null, last = -1; const title = dynLab(G, [-6, 10.8, 0], { size: 18, border: 'rgba(56,209,255,.7)' });
    function rebuild() { if (ch) { L.clear(ch.sub); hold.remove(ch.sub); LABS = LABS.filter(s => s.parent !== ch.sub); } last = view; const v = V[view]; ch = bars(hold, v.s, { gap: 2.8, w: 1.8, vmax: v.vmax, hmax: 9, stag: 1.0, ns: 13 }); }
    rebuild();
    const hand = makeHand(G, { scale: 0.85 }); hand.H.position.set(11.5, 0.5, 0); hand.H.rotation.y = -0.4;
    const obj = new THREE.Group(); G.add(obj); const cb = objMesh(obj, 'box', COL.obj); cb.scale.setScalar(0.8);
    const fA = arrowObj(G, [8, 4, 0], [10, 3, 0], COL.grad); const r = L.rng(23); const kicks = Array.from({ length: 6 }, () => [r() * 2 - 1, r() * 0.6, r() * 2 - 1]);
    G.add(lab('外力：每步 25% 概率', [11.5, 6.6, 0], { size: 14 }));
    const MSG = ['49 物体：9.37 / 3.28 = 2.86 倍；有先验的训练掉落率从 6% 降到 0.3%（无先验的终点没给）', '先验用的物体越多越好：1.10 → 1.34 → 1.46', 'RotR 提升 8.6% / 89.2% / 21.0%（论文写 20.9%）· 回报提升 35.6% / 5.4% / 76.7%', '恢复率 14.1% ± 6.0%，最强基线 6.2% ± 4.2%；两个置信区间有重叠'];
    const ctls = [{ label: '看', items: ['49 物体', '五块体', '留出物体', '扰动恢复'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      if (last !== view) rebuild(); ch.set(seg(p, 0, 0.45)); title(V[view].t);
      const k = Math.floor(p * 6) % 6, u = (p * 6) % 1, kick = kicks[k], push = Math.exp(-u * 5) * (u < 0.15 ? u / 0.15 : 1);
      obj.position.set(11.5 + kick[0] * push * 1.2, 1.9 + kick[1] * push, kick[2] * push * 1.2); obj.rotation.set(0.3 * kick[2] * push, p * 8, 0);
      setArrow(fA, [11.5 + kick[0] * 3.5, 2.4 + kick[1] * 2, kick[2] * 3.5], [obj.position.x + kick[0] * 0.9, obj.position.y, obj.position.z + kick[2] * 0.9]); fA.visible = u < 0.3;
      hand.pose(p * 5, 0.9);
      cap(MSG[view]);
    } };
  }

  /* ---------- scene 11: real robot ---------- */
  function s11(G) {
    let view = 0; const B = COL.base, A = 0x6fa8dc, O = COL.ours;
    const M = ['OlR', 'TD', 'IHR', 'IHR+WSM', '本文'], C5 = [B, B, B, A, O];
    const RR = [[2.32, 1.54, 1.83, 2.76, 16.179], [3.04, 0.34, 0.45, 1.21, 8.01], [5.19, 0.22, 0.36, 2.43, 8.48], [0.23, 0.27, 0.39, 0.80, 4.32]];
    const SR = [[6, 4, 5, 8, 10], [6, 2, 1, 8, 10], [7, 0, 1, 10, 10], [0, 0, 0, 0, 8]], OBJ = ['鸭子', '十字块', '角块', '双缺口（未见）'];
    const hold = new THREE.Group(); G.add(hold); hold.position.set(-3.5, 0, 0);
    let ch = null, last = -1; const title = dynLab(G, [-1.0, 11.2, 0], { size: 18, border: 'rgba(56,209,255,.7)' });
    function rebuild() { if (ch) { L.clear(ch.sub); hold.remove(ch.sub); LABS = LABS.filter(s => s.parent !== ch.sub); } last = view; let items;
      if (view === 2) items = [['盲 RL', 41, B, '41'], ['Touch Dext.', 33, B, '33'], ['RL 无触觉', 45, B, '45'], ['In-Hand Rot.', 53, B, '53'], ['本文', 175, O, '175']];
      else { items = []; for (let o = 0; o < 4; o++) for (let m = 0; m < 5; m++) { const v = view === 0 ? RR[o][m] : SR[o][m]; items.push([m === 2 ? OBJ[o] : '', v, C5[m], view === 0 ? String(v) : v + '/10']); } }
      const xs = view === 2 ? null : items.map((_, i) => (Math.floor(i / 5) - 1.5) * 6.6 + (i % 5 - 2) * 1.2);
      ch = bars(hold, items, { xs, gap: 2.8, w: view === 2 ? 1.8 : 0.85, vmax: view === 0 ? 16.2 : view === 1 ? 10 : 200, hmax: 9, vs: view === 2 ? 16 : 11, ns: 13, lstag: view === 2 ? 0 : 0.85 });
      if (view !== 2) { ch.sub.add(lab('柱子顺序：OlR · TD · IHR · IHR+WSM · 本文', [0, -2.6, 1.2], { size: 13 })); } }
    rebuild();
    const hand = makeHand(G, { scale: 0.7 }); hand.H.position.set(13.5, 0.4, 0); hand.H.rotation.y = -PI / 2;
    const obj = objMesh(G, 'box', 0xf2c14e); obj.scale.setScalar(0.6); obj.position.set(13.5, 1.5, 0);
    const cam = block(0.9, 0.6, 0.6, 0x2b3650, [13.5, 5.2, 1.6]); G.add(cam, lab('腕部深度相机', [13.5, 6.2, 1.6], { size: 13 }));
    const pc = block(2.2, 1.4, 1.4, COL.wm, [13.5, 9.0, 0]); G.add(pc, lab('WSM + 演员', [13.5, 10.3, 0], { size: 13 }));
    const lp = stream(G, 8, COL.white, 0.11); const clk = dynLab(G, [13.5, -1.6, 1.6], { size: 13 });
    const ctls = [{ label: '看', items: ['表 3 转角 RR', '表 3 成功 SR', '20 物体 200 次'], get: () => view, set: k => { view = k; } }];
    const MSG = ['RR：20 秒转过的弧度 · 鸭子 16.179 rad ≈ 2.6 圈 · 角块上开环回放 5.19，两个闭环基线不到 0.4', 'SR：10 次里转过半圈（π rad）的次数 · 未见的双缺口块只有本文成功（8/10）', '20 个物体（9 个训练 + 11 个未见）× 10 次：本文 175 / 200 = 87.5%，基线 33–53'];
    return { ctls, update(p) {
      if (last !== view) rebuild(); ch.set(seg(p, 0, 0.45)); title(['表 3 · RR（rad / 20 s）', '表 3 · SR（/ 10）', '表 6 · 真机成功（/ 200）'][view]);
      const step = Math.floor(p * 140); lp([[13.5, 5.2, 1.6], [13.5, 8.3, 0.4], [13.5, 8.3, -0.4], [13.5, 2.2, 0]], (p * 14) % 1, 1);
      obj.rotation.y = p * 2 * PI * 1.3; hand.pose(p * 6, 0.7);
      clk(`第 ${step} 步 · t = ${(step * 0.1).toFixed(1)} s（10 Hz）`);
      cap(MSG[view]);
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player (same as interactives/latent) ---------- */
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
    L.clear(root); LABS = []; PICKS = []; lastCap = null;
    const sc = SCENES[cur]; fly(...sc.cam); refDist = sc.cam[2] * aspectFix();
    const G = new THREE.Group(); root.add(G); pNow = p0; api = BUILD[cur](G);
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
  const s0 = clamp((parseInt(qs.get('scene'), 10) || 1) - 1, 0, SCENES.length - 1), pq = qs.get('p');
  setPlay(playing && pq == null);
  go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0));
  /* optional ?opt=k selects the first toggle of the scene (for screenshots) */
  const opt = qs.get('opt'); if (opt != null && api?.ctls?.[0]) { api.ctls[0].set(+opt); api.update(pNow); syncCtl(); }
  window.__wmcDebug = { get cap() { return $('cap').textContent; } };
})();
