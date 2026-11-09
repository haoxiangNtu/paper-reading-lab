'use strict';
/* PhysicsVAE (Won, Gopinath, Hodgins, ACM TOG 41(4) 2022) taken apart into eleven animated scenes. Dimensions come from the
   paper, from the official code at commit 3d0a3e3 and from the tensor shapes of its pretrained weights. Each scene's update(p)
   is a pure function of the timeline p plus the current toggles. The humanoid and the rollout paths are hand-made; numbers
   that are computed on the page (learning-rate schedule, loss weights, path geometry, rewards, ratios) are labelled so.
   No PhysicsVAE network runs here. Player pattern copied from interactives/phc/phc.js. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { data: 0x7cb8ff, mimic: 0x9d8cff, enc: 0xf2c14e, dec: 0x5aa0e6, sim: 0xf0963c, frozen: 0x6b7794, task: 0x4fc98a, help: 0x38d1ff, kl: 0xd45fa0, rew: 0xf2c14e, ok: 0x4fc98a, bad: 0xe05d5d, robot: 0xc9d4ea, ref: 0xe05d5d, dim: 0x46506a, gold: 0xf2c14e, white: 0xeef2fa, prim: 0x38d1ff, gate: 0xf0963c, comp: 0xf2a0a0, disc: 0xd45fa0, ppo: 0x9d8cff, fail: 0xb48cff };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  /* Fig. 9, read from the paper's bitmap by pixel (my reading, about ±0.5 s) */
  const FIG9 = { a: ['0.3', '0.01', '0.003', '0.001', '0.0003', '0'], loco: [18.3, 44.8, 52.9, 49.1, 48.2, 21.8], dance: [35.5, 41.7, 45.7, 58.8, 47.9, 38.5], box: [26.3, 32.2, 35.8, 57.5, 45.0, 31.0] };

  const SCENES = [
    { n: 1, part: '总览', title: '四段流水线：模仿、造数据、学潜空间、下游', sub: '每一段在前一段冻结后再训', dur: 15, cam: [0.1, 1.12, 28, [0.6, 2.6, 0]],
      html: dl([['① 模仿', 'DeepMimic 式控制器，DD-PPO 训'], ['② 专家数据', '每片段展开 10 次，带噪声 ε = 0.05'], ['③ 条件 VAE', '先训仿真层并冻结，再训编码器 + 运动解码器'], ['④ 下游', '任务编码器（+ 帮手），DD-PPO，解码器冻结']]) +
        '<p>这就是 SuperMimic 表 1 里那一行：Mimic = PPO、Latent = BC（带一步一致性项）、Downstream = PPO、Task signal = RL。三列不合并，意思是一段训完冻结再训下一段。</p>' +
        '<p>运行时只留下右边两块：任务编码器（或者随机采样）给 z，运动解码器给 PD 目标，交给 PyBullet。仿真层只在第 ③ 段训练时用到。</p>' +
        '<p>点画面里的方块可以跳到对应那一幕。</p>' + src('§3 · §4 · §5.1 · SuperMimic 表 1') },
    { n: 2, part: '§5.1.1 数据', title: '把动捕变成“状态-动作”对', sub: '10 段 × 60 秒 × 30 FPS × 10 次 = 180,000', dur: 13, cam: [0.5, 0.95, 24, [0, 2.2, 0]],
      html: dl([['动捕', 'PFNN + 随机摇杆跑出的走跑，共 10 分钟'], ['代码', '10 个 bvh，各 1801 帧，1/30 s'], ['每段', '模仿控制器带噪声展开 10 次'], ['总数', '600 × 30 × 10 = 180,000'], ['噪声', '论文：协方差 0.05·I；代码：标准差 0.05']]) +
        '<p>动捕本身没有动作，只有姿态。所以先用 RL 训一个模仿控制器，让它在仿真里跟着动捕跑，记录它每步的状态和给出的 PD 目标。</p>' +
        '<p>同一段跑 10 次、每次加探索噪声，轨迹会散开，数据就覆盖了参考周围的一片状态。代码还会丢掉摔倒的段，并把<b>带噪声</b>的动作当标签。</p>' +
        guess('地面上 10 条轨迹的散开程度是我按两种噪声写法放大画的，只表示“标准差 0.224 和 0.05 差 4.5 倍”，不是仿真结果。计数器的数字是算式。') +
        src('§5.1.1 · §5.1.3 · rllib_env_imitation.py · data/motion/loco/*.bvh') },
    { n: 3, part: '§3 状态', title: '361 维状态，54 维动作', sub: '切换：维度堆叠 / 各网络参数量', dur: 12, cam: [0.15, 1.15, 23, [0, 4.0, 0]],
      html: dl([['位置 p', '24 × 3 = 72'], ['朝向 q（6D）', '24 × 6 = 144'], ['线速度 v', '24 × 3 = 72'], ['角速度 w', '24 × 3 = 72'], ['根部高度', '1（论文没写）'], ['动作', '18 个球关节 × 3 = 54，限 [−3, 3] rad']]) +
        '<p>全部量表示在“朝向坐标系”里：竖轴是重力方向，前方是角色朝向，原点是根部在地面的投影。这样同一个动作在地图上哪里做、朝哪做，输入都一样。</p>' +
        '<p>参数量按预训练权重 loco_modelV1.pt 的形状算：编码器 267,328，运动解码器 754,742，仿真层 1,845,609，价值头 251,137，共 3,118,816。最大的是仿真层。</p>' +
        src('§3 · env_humanoid_base.py facing_R6_h · loco.urdf · loco_modelV1.pt') },
    { n: 4, part: '§5.1.2 仿真层', title: '先学一个一步动力学，然后冻结', sub: '切换学习率写法；曲线是当场算的', dur: 14, cam: [0.05, 1.18, 29.5, [-2.0, 3.8, 0]],
      html: dl([['输入', '(s_t, a_t)：361 + 54 = 415'], ['网络', 'MLP 1024 × 2，ReLU'], ['输出', 's_{t+1}，361 维（直接输出，不是增量）'], ['损失', '‖s_{t+1} − f(s_t, a_t)‖²，用专家动作'], ['训练', '300 轮，3 到 4 小时，只用 CPU']]) +
        '<p>论文叫它“可导物理仿真层”，代码叫 <code>_world_model</code>。它只在固定的专家数据上学，学完就冻结（雪花色），之后不再更新，也不会见到条件 VAE 自己生成的动作分布。</p>' +
        '<p>右边的曲线是学习率：论文写初值 0.01、每 50 轮乘 0.7；代码默认初值 5e−4。300 轮末论文写法是 1.18e−3。</p>' +
        src('§3 · §5.1.2 · 表 2 · train_physics_vae.py') },
    { n: 5, part: '§3 结构', title: '条件 VAE：图 2 的 3D 版', sub: '这一幕是核心：编码 → 采样 → 解码成动作 → 仿真层算后果', dur: 16, cam: [0.08, 1.12, 28.5, [-3.2, 3.2, 0]],
      html: dl([['编码器', '(s_t, s_{t+1}) 722 → 256 → 256 → (μ, log σ²) 各 32'], ['采样', 'z_t = μ + σ·ε'], ['运动解码器', '(s_t, z_t) 393 → 512 × 3 → a′_t 54'], ['仿真层', '(s_t, a′_t) → s′_{t+1}，冻结'], ['运行时', '只留运动解码器，z ~ N(0, I)']]) +
        '<p>编码器“看见”下一状态，所以它的 z 告诉解码器“要去哪里”。KL 把这些 z 压向标准正态，运行时就能用随机 z 代替编码器。</p>' +
        '<p>解码器的输出不止和专家动作比（BC），还要穿过冻结的仿真层，看导致的下一状态是否和数据一致。这就是 SuperMimic 表 1 脚注说的“一步一致性项”。</p>' +
        '<p>表 2 写编码器是 (256, 128)，代码和权重是 (256, 256)；这里按代码画。</p>' + src('§3 图 2 式 (1) · 表 2 · rllib_model_torch.py PhysicsVAE · loco_modelV1.pt') },
    { n: 6, part: '§3 式 (1)', title: '三项损失，梯度怎样走', sub: '切换 α 和求和方式，看两项的相对权重', dur: 14, cam: [0.06, 1.15, 33, [-1.2, 3.2, 0]],
      html: dl([['第一项', '‖a_t − a′_t‖²：行为克隆'], ['第二项', 'α‖s_{t+1} − s′_{t+1}‖²：一步一致性'], ['第三项', 'β·KL(N(μ, σ) ‖ N(0, I))'], ['表 1', 'α = 1e−4，β = 2.0'], ['代码', 'α = 1e−3，β = 1.0，MSE 取平均']]) +
        '<p>BC 的梯度直接到解码器。一致性项的梯度先穿过仿真层（权重不动，但对输入可导），再到解码器，最后到编码器。所以解码器会被“这个动作一步后会把身体带到哪”约束。</p>' +
        '<p>论文写的是平方和，代码用的是平均。同样的逐维误差下，平方和形式的状态项相对动作项多了 361/54 ≈ 6.7 倍。下面的读数按当前开关算。</p>' +
        src('§3 式 (1) · 表 1 · train_physics_vae.py compute_loss') },
    { n: 7, part: '§5.5.1 消融', title: 'α 扫描：图 9 的位图读数', sub: '切换数据集；柱子是我从原图量的', dur: 12, cam: [0.0, 1.2, 30, [0, 4.6, 0]],
      html: dl([['横轴', '直到摔倒的时间，上限 60 s，100 次平均'], ['α 档位', '0.3、0.01、0.003、0.001、0.0003、0'], ['正文', '带仿真层好约三倍；最好在 3e−4 到 3e−3'], ['读数', '最好 / α=0：走跑 2.43，舞蹈 1.53，拳击 1.85']]) +
        '<p>α = 0 就是不用仿真层的纯 BC + KL。加了一致性项，三个数据集都更久不摔，这个方向是对的。但“三倍”在图上量不出来。</p>' +
        '<p>表 1 写 α = 1e−4，图 9 没有这一档；舞蹈和拳击的最好档是 1e−3，代码默认也是 1e−3。α = 0.3 时走跑反而比 α = 0 还差。</p>' +
        '<p>去掉 KL（非生成模型）时，作者说角色不到 1 秒就摔，图里没有画。</p>' + src('§5.5.1 · 图 9（位图读数，约 ±0.5 s）') },
    { n: 8, part: '§5.1.3 展开', title: '每步一个随机 z，角色自己走 30 秒', sub: '切换：完整模型 / 去掉 KL', dur: 15, cam: [0.0, 0.62, 30, [0, 0, 0]],
      html: dl([['起点', '同一站立姿态，场景中央，零速'], ['每步', 'z_t ~ N(0, I) → 运动解码器 → PD → PyBullet'], ['时长', '30 秒，10 次'], ['网格', '1 m × 1 m'], ['无 KL', '不到 1 秒就摔（正文，视频）']]) +
        '<p>没有目标、没有参考动作，输入只有当前状态和随机向量。轨迹各不相同，但动作都像走跑数据：走、跑、蹲在随机顺序里切换。</p>' +
        '<p>去掉 KL 后，编码器的 z 不再被压向标准正态，运行时采到的 z 落在解码器没见过的区域，输出无意义的动作。</p>' +
        guess('10 条轨迹是我按平滑随机游走画的，形状模仿图 4 的样子（有的走远，有的打转），不是模型输出。小人的步态是手写的。') +
        src('§5.1.3 图 4 · §5.5.1') },
    { n: 9, part: '§4 帮手', title: '帮手分支：在冻结的解码器上加有界修正', sub: '切换 σ，看允许改动多少度', dur: 13, cam: [0.1, 0.92, 29, [-0.6, 2.6, 1.5]],
      html: dl([['式 (2)', 'Δa_t = σ ⊗ Tanh(H(s_t, z_t))'], ['动作', 'â_t = a_t + Δa_t'], ['σ = 0.1', '±5.73°，5.2 节四个任务、打沙袋'], ['σ = 0.5', '±28.65°，打沙袋对照'], ['σ = 1.0', '±57.3°，不平地形和人群']]) +
        '<p>任务编码器给 z，冻结的运动解码器给 a_t。帮手看同样的 (s_t, z_t)，输出经 tanh 压到 (−1, 1)，再乘 σ。所以无论帮手怎么学，每个关节最多被改 σ 弧度。</p>' +
        '<p>σ 小：动作像数据，任务可能做不好；σ 大：更能适应，比如不平地形，但动作可能走样。打沙袋上，σ = 0.5 的接触力到 500 N，σ = 0.1 约 200 N、更像原始拳击。</p>' +
        '<p>代码里 σ 是一个标量，默认 0.5；帮手 MLP (128, 128)，末层 tanh。</p>' +
        guess('右边小人举起的手臂只演示一个关节的允许范围（扇形），角度按 σ 真算，摆动是手写的。') +
        src('§4 式 (2) 图 3 · §5.5.2 · rllib_model_torch.py forward_decoder') },
    { n: 10, part: '§5.2–5.4 任务', title: '七个下游任务', sub: '切换任务；几何和奖励按原文公式当场算', dur: 16, cam: [0.0, 0.85, 34, [0, 0, 0]],
      html: dl([['点目标', 'r = d_{t−1} − d_t；< 0.5 m 算到'], ['摇杆', '方向项 × 大小项，两个 exp(−5·)'], ['∞ 路径', 'x_t = 10(sin 2t, sin 2t cos 2t)'], ['迷宫', '24 m 分 8 × 8，最大回报 64 + 30 = 94'], ['地形', '粗糙（≤1 m）和五峰（4 m，38°）'], ['人群', 'Circle 8、Carrefour 16、Corridor 8'], ['打沙袋', '式 (4)(5)，40 kg，1.2 m']]) +
        '<p>全部用 DD-PPO 训任务编码器，解码器冻结，帮手开着（σ = 0.1 或 1.0）。迷宫是直接学的，不分层：作者认为低层的平衡和步伐已经在解码器里了。</p>' +
        '<p>∞ 路径按原文参数一圈 61 m、周期 π，如果 t 是秒就要 28 m/s，所以 t 应是缩放过的时间（论文没说）。这里按一圈 40 秒的步行速度放慢画。</p>' +
        guess('下游代码没有公开。小人和它们的轨迹是手写的；路径、网格、射线、高度图的尺寸按原文。') +
        src('§5.2 · §5.3 式 (3) 图 5、6 · §5.4 式 (4)(5) 图 8') },
    { n: 11, part: '对照', title: '世界模型放在哪：PhysicsVAE、ControlVAE、SuperMimic', sub: '切换方法，看模型什么时候学、展开几步、梯度从哪来', dur: 14, cam: [0.0, 1.15, 31, [0, 3.6, 0]],
      html: dl([['PhysicsVAE', '专家数据离线学，冻结，1 步，只用于潜空间训练'], ['ControlVAE', '自己策略的数据在线学，多步，下游也穿过它'], ['SuperMimic', '自己策略的数据在线学，拟合 8 步、想象 32 步'], ['表 1', 'PPO / BC¹ / PPO / RL / ✗']]) +
        '<p>三者都有一个学到的可导动力学模型。差别不在“有没有”，而在数据从哪来、什么时候更新、梯度穿过它几步。</p>' +
        '<p>PhysicsVAE 的模型只见过专家数据，学完就冻结，所以它对解码器的约束只在专家附近可靠；作者在结论里也说仿真层和 PyBullet 有近似误差。下游任务回到真实仿真器用 PPO。</p>' +
        '<p>这一幕是我读三篇原文后的整理，不是 SuperMimic 的说法。</p>' + src('本文 §3、§6 · ControlVAE §3 · SuperMimic §2 表 1、§3') }
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

  /* ---------- 3D helpers ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.3, phi: 1.0, dist: 24, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);
  let LABS = [], refDist = 24, PICKS = [];
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65, emissive: o.emissive }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  const tint = (m, h) => { m.material.color.setHex(h); m.userData.c = hex3(h); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.14) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.5, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  /* a thick polyline as a flat ribbon facing +z, so that curves stay readable (GL lines are one pixel wide) */
  function ribbon(G, n, color, w = 0.06, o = {}) {
    const pos = new Float32Array(n * 6), idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: o.opacity ?? 1 })); m.frustumCulled = false; m.renderOrder = o.order ?? 2; G.add(m);
    m.userData.set = pts => { const k = Math.min(n, pts.length); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)], z = q[2] ?? 0; pos[i * 6] = q[0]; pos[i * 6 + 1] = q[1] - w / 2; pos[i * 6 + 2] = z; pos[i * 6 + 3] = q[0]; pos[i * 6 + 4] = q[1] + w / 2; pos[i * 6 + 5] = z; } g.attributes.position.needsUpdate = true; };
    return m;
  }
  function panel(G, x, y, z, w, h) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x0c1220, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }
  /* a growing bar on the floor; set(v) sets its height */
  function bar(G, x, z, w, color, o = {}) { const m = block(w, 1, o.d ?? w, color, [x, 0.5, z], { edges: false }); G.add(m); m.userData.set = h => { const v = Math.max(0.001, h); m.scale.y = v; m.position.y = (o.y0 ?? 0) + v / 2; }; return m; }

  /* ---------- the hand-made humanoid: copied from interactives/supermimic/sm.js ---------- */
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

  /* a lying-down pose: pelvis horizontal, on the back. k = 0 lying, k = 1 standing */
  function getup(k, t) {
    const lie = 1 - k, b = seg(k, 0.15, 0.7), bend = Math.sin(Math.PI * clamp(k, 0, 1));
    return { p: [0, L.lerp(0.09, STAND, b), 0], pitch: -1.5 * (1 - seg(k, 0.1, 0.8)), hL: 1.2 * bend, hR: 0.6 * bend, kL: 0.1 * lie + 1.6 * bend, kR: 0.1 * lie + 1.2 * bend, sL: 0.8 * bend, sR: 0.4 * bend, eL: 0.3 + 0.4 * bend, eR: 0.3 + 0.4 * bend };
  }
  const still = () => ({ p: [0, STAND, 0], pitch: 0, hL: 0.02, hR: 0.02, kL: 0.04, kR: 0.04, sL: 0, sR: 0, eL: 0.15, eR: 0.15 });
  const qmix = (a, b, k) => { const o = {}; for (const f of ['pitch', 'hL', 'hR', 'kL', 'kR', 'sL', 'sR', 'eL', 'eR']) o[f] = L.lerp(a[f] || 0, b[f] || 0, k); o.p = [0, L.lerp(a.p[1], b.p[1], k), 0]; return o; };

  /* controls: api.ctls = [{label, items, get, set}], plus optional api.ctlExtra(box) */
  function buildCtl() {
    const box = $('ctl'); box.innerHTML = ''; box.hidden = true; if (!api) return;
    (api.ctls || []).forEach((c, gi) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-g="${gi}" data-k="${k}" aria-pressed="${c.get() === k}">${t}</button>`).join('');
      box.appendChild(row); box.hidden = false;
    });
    if (api.ctlExtra) { api.ctlExtra(box); box.hidden = false; }
  }
  function syncCtl() { (api?.ctls || []).forEach((c, gi) => { $('ctl').querySelectorAll(`button[data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(c.get() === +b.dataset.k))); }); }

  /* ---------- small builders for this page ---------- */
  /* a network drawn as a row of slabs; slab height follows the layer width */
  function net(G, x0, y, z, widths, color, o = {}) {
    const gap = o.gap ?? 0.9, k = o.k ?? 0.0042, out = [];
    let ly = -99; /* width labels: bump one row up when the neighbour's label sits at about the same height */
    widths.forEach((w, i) => { const h = 0.5 + w * k; const m = block(0.36, h, o.d ?? 1.4, color, [x0 + i * gap, y + h / 2, z]); G.add(m); out.push(m); let yy = y + h + 0.45; if (Math.abs(yy - ly) < 0.6) yy = ly + 0.62; ly = yy; if (o.dims !== false) G.add(lab(String(w), [x0 + i * gap, yy, z], { size: 16 })); });
    return out;
  }
  const flake = (ms, k) => ms.forEach(m => { const c = hex3(COL.sim), f = hex3(COL.frozen); m.material.color.setRGB(L.lerp(c[0], f[0], k), L.lerp(c[1], f[1], k), L.lerp(c[2], f[2], k)); });
  function sector(G, r, color, o = {}) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40, 0, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: o.opacity ?? 0.35, side: THREE.DoubleSide, depthWrite: false }));
    G.add(m); m.userData.set = (a0, a1) => { m.geometry.dispose(); m.geometry = new THREE.CircleGeometry(r, 40, a0, Math.max(0.001, a1 - a0)); }; return m;
  }

  /* ---------- scene 1: the four stages ---------- */
  function s1(G) {
    G.add(L.grid(36, 36));
    const X = [-12, -6.5, -1.2, 4.6, 10.8];
    const mocap = block(2.4, 1.6, 2, COL.data, [X[0], 0.8, 0]), mimic = block(2.4, 1.6, 2, COL.mimic, [X[1], 0.8, 0]), demo = block(2.4, 1.6, 2, COL.data, [X[2], 0.8, 0]);
    const sim = block(1.8, 1.4, 1.8, COL.sim, [X[3] - 1.2, 0.7, 0]), vae = block(1.8, 1.4, 1.8, COL.dec, [X[3] + 1.2, 0.7, 0]);
    const task = block(1.6, 1.4, 1.8, COL.task, [X[4] - 1.2, 0.7, 0]), dec2 = block(1.6, 1.4, 1.8, COL.dec, [X[4] + 1.0, 0.7, 0]);
    G.add(mocap, mimic, demo, sim, vae, task, dec2);
    [[mocap, 1], [mimic, 1], [demo, 1], [sim, 3], [vae, 4], [task, 9], [dec2, 8]].forEach(([m, g]) => { m.userData.go = g; PICKS.push(m); });
    G.add(lab('动捕 10 分钟', [X[0], 2.3, 0], { size: 20 }), lab('① 模仿控制器\nDD-PPO', [X[1], 2.6, 0], { size: 20 }), lab('② 专家数据\n180,000 对', [X[2], 2.6, 0], { size: 20 }),
      lab('③ 仿真层 → 条件 VAE', [X[3], 2.3, 0], { size: 20 }), lab('④ 任务编码器\n+ 冻结解码器', [X[4], 2.6, 0], { size: 20 }));
    G.add(lab('Mimic = PPO', [X[1], -0.2, 2.2], { size: 18, color: '#c9b8ff' }), lab('Latent = BC¹', [X[3], -0.2, 2.2], { size: 18, color: '#8fc1f2' }), lab('Downstream = PPO\nTask = RL', [X[4], -0.4, 2.2], { size: 18, color: '#7fe0a8' }));
    const rob = robot(COL.robot); G.add(rob);
    const f = [stream(G, 5, COL.data), stream(G, 5, COL.mimic), stream(G, 5, COL.data), stream(G, 5, COL.dec)];
    const all = [mocap, mimic, demo, sim, vae, task, dec2];
    return { update(p) {
      const q = (p * 18) % 1, st = p < 0.22 ? 0 : p < 0.42 ? 1 : p < 0.72 ? 2 : 3;
      f[0]([[X[0] + 1.2, 0.9, 0], [X[1] - 1.2, 0.9, 0]], q, st === 0 ? 1 : 0.3);
      f[1]([[X[1] + 1.2, 0.9, 0], [X[2] - 1.2, 0.9, 0]], q, st === 1 ? 1 : 0.3);
      f[2]([[X[2] + 1.2, 0.9, 0], [X[3] - 2.1, 0.9, 0]], q, st === 2 ? 1 : 0.3);
      f[3]([[X[3] + 2.1, 0.9, 0], [X[4] + 1.0, 1.6, 0]], q, st === 3 ? 1 : 0.3);
      all.forEach(m => glow(m, 0));
      if (st === 0) glow(mimic, 0.7); if (st === 1) glow(demo, 0.7);
      if (st === 2) { const k = seg(p, 0.42, 0.55); glow(k < 1 ? sim : vae, 0.7); flake([sim], seg(p, 0.55, 0.6)); } else flake([sim], st > 2 ? 1 : 0);
      if (st === 3) { glow(task, 0.7); tint(mimic, COL.frozen); tint(vae, COL.dec); } else tint(mimic, COL.mimic);
      tint(dec2, st === 3 ? COL.frozen : COL.dec);
      pose(rob, clip('walk', p * 14), [X[4] + 0.2, 0, 5.4], 2.4, 0.4);
      rob.visible = st === 3;
      const C = ['<b>① 模仿</b>：DD-PPO 训 DeepMimic 式控制器，让仿真角色跟着动捕', '<b>② 造数据</b>：每段带噪声跑 10 次，记下 (s, a)：600 s × 30 × 10 = 180,000 对', '<b>③ 潜空间</b>：先训仿真层（橙）并冻结（变灰），再训编码器和运动解码器', '<b>④ 下游</b>：解码器冻结（灰），只训任务编码器（和帮手），奖励是任务自己的'];
      cap(C[st]);
    } };
  }

  /* ---------- scene 2: expert data ---------- */
  function s2(G) {
    let mode = +(OPT[0] ?? 0);
    G.add(L.grid(30, 30));
    const bars = []; for (let i = 0; i < 10; i++) { const b = bar(G, -8 + i * 0.9, -6, 0.6, COL.data, { d: 0.6 }); bars.push(b); }
    G.add(lab('10 段 bvh，每段 1801 帧 ≈ 60 s', [-4, 4.2, -6], { size: 21 }));
    const n = 140, ref = []; for (let i = 0; i < n; i++) { const t = i / (n - 1); ref.push([-9 + 18 * t, 0.05, 3 + 2.2 * Math.sin(t * 5.2)]); }
    G.add(L.line(ref, COL.ref, { opacity: 1 }));
    const lines = [], R = L.rng(7), walks = [];
    for (let k = 0; k < 10; k++) { const w = []; let a = 0, v = 0; for (let i = 0; i < n; i++) { v = 0.9 * v + L.gauss(R) * 0.25; a += v * 0.1; w.push(a); } walks.push(w); }
    for (let k = 0; k < 10; k++) { const l = L.line(ref.map(p => [p[0], 0.06, p[2]]), [COL.prim, COL.task, COL.enc, COL.help, COL.kl, COL.mimic, COL.sim, COL.ok, COL.white, COL.gate][k], { opacity: 0.85 }); G.add(l); lines.push(l); }
    const rob = robot(COL.robot); G.add(rob);
    G.add(lab('红：参考轨迹　彩色：同一段的 10 次带噪声展开', [0, 0.3, 7.6], { size: 18 }));
    const ctls = [{ label: '噪声', items: ['代码：标准差 0.05', '论文字面：方差 0.05（std 0.224）'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const g = seg(p, 0, 0.35); bars.forEach((b, i) => b.userData.set(Math.max(0.02, 3.0 * clamp(g * 10 - i, 0, 1))));
      const amp = (mode ? 0.224 : 0.05) * 9, m = Math.max(2, Math.round(seg(p, 0.3, 0.95) * (n - 1)));
      lines.forEach((l, k) => { const pos = l.geometry.attributes.position; for (let i = 0; i < n; i++) { const j = Math.min(i, m); pos.setXYZ(i, ref[j][0], 0.06, ref[j][2] + walks[k][j] * amp * (j / n)); } pos.needsUpdate = true; l.geometry.computeBoundingSphere(); });
      const j = Math.min(n - 1, m), dx = ref[Math.min(n - 1, j + 1)][0] - ref[Math.max(0, j - 1)][0], dz = ref[Math.min(n - 1, j + 1)][2] - ref[Math.max(0, j - 1)][2];
      pose(rob, clip('walk', p * 14), [ref[j][0], 0, ref[j][2]], 2.2, Math.atan2(dx, dz));
      const pairs = Math.round(180000 * seg(p, 0.3, 0.95));
      cap(`状态-动作对：<b>${pairs.toLocaleString('en-US')}</b> / 180,000（600 s × 30 FPS × 10 次）· 噪声 ${mode ? '按论文字面 std 0.224' : '按代码 std 0.05'}`);
    } };
  }

  /* ---------- scene 3: dimensions ---------- */
  function s3(G) {
    let view = +(OPT[0] ?? 0);
    G.add(L.grid(26, 26)); const sub = new THREE.Group(); G.add(sub);
    const rob = robot(COL.robot); G.add(rob);
    let items = [], last = -1;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); items = []; last = view;
      if (view === 0) {
        const S = [['位置 p 24×3', 72, COL.prim], ['朝向 q 24×6', 144, COL.enc], ['线速度 v 24×3', 72, COL.task], ['角速度 w 24×3', 72, COL.kl], ['根部高度 1', 1, COL.gold]];
        let y = 0.1; const H = 0.022;
        S.forEach(([t, d, c]) => { const h = Math.max(0.12, d * H); const b = block(1.6, h - 0.04, 1.4, c, [-1, y + h / 2, 0]); sub.add(b); sub.add(lab(`${t} = ${d}`, [2.6, y + h / 2, 0], { size: 18 })); items.push({ b, y0: y + h / 2 }); y += h; });
        sub.add(lab('状态 s_t：361 维', [-1, y + 0.7, 0], { size: 22, border: 'rgba(56,209,255,.8)' }));
        const a = block(1.6, 54 * H, 1.4, COL.sim, [6.8, 54 * H / 2 + 0.1, 0]); sub.add(a); sub.add(lab('动作 a_t：18 球关节 × 3 = 54', [6.8, 54 * H + 0.8, 0], { size: 20 })); items.push({ b: a, y0: 0 });
      } else {
        const P = [['编码器', 267328, COL.enc], ['运动解码器', 754742, COL.dec], ['仿真层', 1845609, COL.sim], ['价值头', 251137, COL.dim]];
        P.forEach(([t, v, c], i) => { const x = -2 + i * 3; const b = bar(sub, x, 0, 1.6, c, { d: 1.6 }); const l = lab(`${t}\n${v.toLocaleString('en-US')}`, [x, 0, 0], { size: 18 }); sub.add(l); items.push({ b, v, l }); });
        sub.add(lab('参数量（按 loco_modelV1.pt 的形状），共 3,118,816', [3, 8.2, 0], { size: 21, border: 'rgba(56,209,255,.8)' }));
      }
    }
    rebuild();
    const ctls = [{ label: '看', items: ['维度', '参数量'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      pose(rob, clip('walk', p * 8), [-7, 0, 0], 3.0, 0.6);
      const g = seg(p, 0, 0.5);
      if (view === 1) items.forEach(({ b, v, l }) => { const h = Math.max(0.02, v / 1845609 * 6.5 * g); b.userData.set(h); l.position.y = h + 0.9; });
      else items.forEach(({ b }) => { b.scale.x = 0.2 + 0.8 * g; });
      cap(view ? '仿真层 1,845,609 个参数，约占全部的 <b>59%</b>（我的计算）' : '24 个连杆 × 15 维 + 1 维根部高度 = <b>361</b>；编码器吃 (s_t, s_{t+1}) 共 <b>722</b> 维');
    } };
  }

  /* ---------- scene 4: pretraining the simulation layer, with the learning-rate curve computed here ---------- */
  function s4(G) {
    let mode = +(OPT[0] ?? 0);
    const L1 = net(G, -11, 0, 0, [415, 1024, 1024, 361], COL.sim, { gap: 1.1 });
    G.add(lab('仿真层 f(s_t, a_t) → s_{t+1}', [-9.3, 7.1, 0], { size: 21 }));
    const inS = block(1.2, 1.2, 1.2, COL.data, [-14, 0.6, 0]); G.add(inS); G.add(lab('专家 (s_t, a_t)', [-14, 1.8, 0], { size: 18 }));
    const outS = block(1.2, 1.2, 1.2, COL.data, [-5.4, 0.6, 0]); G.add(outS); G.add(lab('对比 s_{t+1}', [-5.4, 1.8, 0], { size: 18 }));
    const fs = stream(G, 6, COL.data);
    const X0 = -1.5, W = 12, Y0 = 0.6, H = 5.6; panel(G, X0 - 0.4, Y0 - 0.6, -0.3, W + 0.8, H + 1.4);
    const n = 200, rc = ribbon(G, n, COL.enc, 0.08), mk = block(0.25, 0.25, 0.25, COL.gold, [0, 0, 0], { edges: false }); G.add(mk);
    const lr = e => (mode ? 5e-4 : 0.01) * Math.pow(0.7, Math.floor(e / 50));
    const ty = v => Y0 + (Math.log10(v) + 5) / 3 * H, tx = e => X0 + W * e / 300;
    G.add(lab('学习率（对数，1e−5 到 1e−2）对轮数 0–300', [X0 + W / 2, Y0 + H + 0.4, 0], { size: 18 }));
    [1e-2, 1e-3, 1e-4, 1e-5].forEach(v => G.add(lab(v.toExponential(0), [X0 - 1.0, ty(v), 0], { size: 15 })));
    const ctls = [{ label: '学习率', items: ['论文：0.01', '代码默认：5e−4'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const e = 300 * seg(p, 0.05, 0.85); const pts = []; for (let i = 0; i < n; i++) { const ee = 300 * i / (n - 1); pts.push([tx(ee), ty(lr(ee)), 0]); }
      rc.userData.set(pts); mk.position.set(tx(e), ty(lr(e)), 0.1);
      fs([[-14, 0.9, 0], [-11, 0.9, 0], [-7.5, 0.9, 0], [-5.4, 0.9, 0]], (p * 16) % 1, p < 0.85 ? 1 : 0);
      const fr = seg(p, 0.85, 0.95); flake(L1, fr);
      cap(fr > 0.5 ? '训完 300 轮：<b>冻结</b>（变灰）。之后条件 VAE 训练时它不再更新' : `第 <b>${Math.round(e)}</b> 轮 · 学习率 <b>${lr(e).toExponential(2)}</b>（${mode ? '代码默认初值' : '论文初值'}，每 50 轮 × 0.7，当场算）`);
    } };
  }

  /* ---------- scene 5: the conditional VAE (Fig. 2 in 3D) ---------- */
  function vaeRig(G, o = {}) {
    const y = 0, R = {};
    R.sn = block(1.0, 1.0, 1.0, COL.data, [-14.5, 0.5, -1.8]); R.s = block(1.0, 1.0, 1.0, COL.data, [-14.5, 0.5, 1.8]); G.add(R.sn, R.s);
    G.add(lab('s_{t+1}', [-14.5, 1.5, -1.8], { size: 18 }), lab('s_t', [-14.5, 1.5, 1.8], { size: 18 }));
    R.enc = net(G, -12.4, y, 0, [722, 256, 256, 64], COL.enc, { gap: 0.8, k: 0.004 });
    R.smp = block(1.3, 1.0, 1.3, COL.kl, [-7.4, 0.5, 0]); G.add(R.smp); G.add(lab('μ + σ·ε', [-7.4, 1.6, 0], { size: 17 }));
    R.z = inst(BOX, 32); G.add(R.z);
    R.dec = net(G, -3.6, y, 0, [393, 512, 512, 512, 54], COL.dec, { gap: 0.8, k: 0.004 });
    R.a = block(1.0, 1.0, 1.0, COL.gate, [1.4, 0.5, 0]); G.add(R.a); G.add(lab("a′_t", [1.4, 1.5, 0], { size: 18 }));
    R.sim = net(G, 3.2, y, 0, [415, 1024, 1024, 361], COL.sim, { gap: 0.8, k: 0.004 }); flake(R.sim, 1);
    R.sp = block(1.0, 1.0, 1.0, COL.data, [7.6, 0.5, 0]); G.add(R.sp); G.add(lab("s′_{t+1}", [7.6, 1.5, 0], { size: 18 }));
    G.add(lab('编码器', [-11.2, 5.0, 0], { size: 19 }), lab('z_t（32）', [-5.7, 2.9, 0], { size: 17 }), lab('运动解码器', [-2.0, 4.7, 0], { size: 19 }), lab('仿真层（冻结）', [4.4, 6.9, 0], { size: 19 }));
    wire(G, [[-14.5, 0.1, 2.6], [5.6, 0.1, 2.6]], COL.data, { opacity: 0.6 }); [-11.2, -3.6, 3.2].forEach(x => wire(G, [[x, 0.1, 2.6], [x, 0.1, 0.7]], COL.data, { opacity: 0.6 }));
    G.add(lab('s_t 同时进入编码器、解码器、仿真层', [-4.5, 0, 3.6], { size: 16 }));
    R.f = [stream(G, 4, COL.enc), stream(G, 4, COL.kl), stream(G, 4, COL.dec), stream(G, 4, COL.sim)];
    R.setZ = (k, on) => { const r = L.rng(3); for (let i = 0; i < 32; i++) { const u = L.gauss(r) * 0.6; setI(R.z, i, [-5.9 + (i % 8) * 0.22, 0.2 + Math.floor(i / 8) * 0.25, -0.4 + u * 0.3 * k], on ? 0.17 : 0.001); colI(R.z, i, hex3(COL.kl)); } done(R.z); };
    return R;
  }
  function s5(G) {
    const R = vaeRig(G);
    return { update(p) {
      const q = (p * 14) % 1, ph = p < 0.25 ? 0 : p < 0.45 ? 1 : p < 0.7 ? 2 : 3;
      [...R.enc, ...R.dec].forEach(m => glow(m, 0)); glow(R.smp, 0);
      R.f[0]([[-14, 0.6, -1.8], [-12.4, 1.2, 0], [-10, 1.2, 0], [-7.8, 0.6, 0]], q, ph >= 0 ? 1 : 0);
      R.f[1]([[-7, 0.6, 0], [-5.4, 0.6, 0]], q, ph >= 1 ? 1 : 0);
      R.f[2]([[-4.8, 0.8, 0], [-3.6, 1.5, 0], [0.5, 0.8, 0], [1.4, 0.6, 0]], q, ph >= 2 ? 1 : 0);
      R.f[3]([[1.9, 0.6, 0], [3.2, 1.5, 0], [6, 1.5, 0], [7.6, 0.6, 0]], q, ph >= 3 ? 1 : 0);
      if (ph === 0) R.enc.forEach(m => glow(m, 0.6)); if (ph === 1) glow(R.smp, 0.7); if (ph === 2) R.dec.forEach(m => glow(m, 0.6));
      R.setZ(seg(p, 0.25, 0.45), ph >= 1);
      cap(['<b>编码</b>：看当前和下一状态，输出 32 维的 μ 和 log σ²', '<b>采样</b>：z = μ + σ·ε（重参数化）；KL 把它压向 N(0, I)', '<b>解码成动作</b>：运动解码器只看 (s_t, z_t)，给出 54 维 PD 目标 a′_t', '<b>算后果</b>：冻结的仿真层把 (s_t, a′_t) 变成 s′_{t+1}，和数据里的 s_{t+1} 比'][ph]);
    } };
  }

  /* ---------- scene 6: the three loss terms and where the gradient goes ---------- */
  function s6(G) {
    let ai = +(OPT[0] ?? 1), sm = +(OPT[1] ?? 0);
    const R = vaeRig(G); R.setZ(1, true);
    const pills = [lab('① ‖a_t − a′_t‖²', [0.6, 5.6, 0], { size: 19, border: 'rgba(240,150,60,.9)' }), lab("② α‖s_{t+1} − s′_{t+1}‖²", [9.2, 5.2, 0], { size: 19, border: 'rgba(56,209,255,.9)' }), lab('③ β·KL', [-7.4, 4.3, 0], { size: 19, border: 'rgba(212,95,160,.9)' })];
    pills.forEach(x => G.add(x));
    const gb = [stream(G, 5, COL.gate, 0.12), stream(G, 7, COL.help, 0.12), stream(G, 4, COL.kl, 0.12)];
    const bA = bar(G, 11.5, 0, 1.0, COL.gate, { d: 1 }), bS = bar(G, 13, 0, 1.0, COL.help, { d: 1 });
    G.add(lab('BC', [11.3, -0.4, 1.2], { size: 16 }), lab('一致性\n×1000', [13.2, -0.6, 1.2], { size: 16 }));
    const AL = [0, 1e-4, 1e-3];
    const ctls = [{ label: 'α', items: ['0', '1e−4（表 1）', '1e−3（代码、图 9 最好）'], get: () => ai, set: k => { ai = k; } }, { label: '求和', items: ['论文：平方和', '代码：MSE 平均'], get: () => sm, set: k => { sm = k; } }];
    return { ctls, update(p) {
      const q = (p * 10) % 1, a = AL[ai];
      gb[0]([[1.4, 0.6, 0], [0.5, 1.4, 0], [-3.6, 1.4, 0]], 1 - q, 1);
      gb[1]([[7.6, 0.6, 0], [6, 1.6, 0], [3.2, 1.6, 0], [1.4, 0.9, 0], [-3.6, 1.6, 0], [-7.4, 0.9, 0], [-12.4, 1.4, 0]], 1 - q, ai ? 1 : 0);
      gb[2]([[-7.4, 0.9, 0], [-10, 1.4, 0], [-12.4, 1.4, 0]], 1 - q, 1);
      const wA = sm ? 1 : 54, wS = a * (sm ? 1 : 361), r = wS / wA;
      bA.userData.set(3); bS.userData.set(Math.max(0.02, Math.min(6, 3 * r * 1000)));
      cap(`逐维误差相同时，一致性项 / BC 项 = α × ${sm ? '1' : '361/54'} = <b>${r === 0 ? '0' : r.toExponential(2)}</b>（当场算）· 虚线小球是反传的梯度：② 穿过冻结的仿真层回到解码器`);
    } };
  }

  /* ---------- scene 7: Fig. 9 as bars (bitmap reading) ---------- */
  function s7(G) {
    let ds = +(OPT[0] ?? 0); G.add(L.grid(34, 34));
    const N = ['loco', 'dance', 'box'], NM = ['走跑', '舞蹈', '拳击'], CL = [COL.ok, COL.enc, COL.prim]; const B = [];
    FIG9.a.forEach((a, i) => { const x = -12.5 + i * 5; G.add(lab('α = ' + a, [x, -0.3, 3.0], { size: 18 }));
      N.forEach((k, j) => { const xx = x + (j - 1) * 1.45, b = block(1.05, 1, 1.05, CL[j], [xx, 0.5, 0], { edges: false }); G.add(b); const l = lab(FIG9[k][i].toFixed(1), [xx, 0, 0], { size: 15 }); G.add(l); B.push({ b, l, v: FIG9[k][i], j }); }); });
    NM.forEach((t, j) => G.add(lab(t, [-12 + j * 3.4, 9.2, 0], { size: 19, color: '#' + CL[j].toString(16).padStart(6, '0') })));
    G.add(lab('直到摔倒的时间（s），上限 60 · 位图读数', [6, 9.2, 0], { size: 19, border: 'rgba(56,209,255,.7)' }));
    const cap60 = block(30, 0.03, 0.03, COL.bad, [0, 60 / 60 * 7.5, -0.6], { edges: false }); G.add(cap60); G.add(lab('60 s 上限', [12.6, 8.2, -0.6], { size: 15 }));
    const ctls = [{ label: '数据集', items: ['全部', '走跑', '舞蹈', '拳击'], get: () => ds, set: k => { ds = k; } }];
    return { ctls, update(p) {
      const g = seg(p, 0, 0.5); B.forEach(({ b, l, v, j }) => { const on = ds === 0 || ds - 1 === j, h = Math.max(0.02, v / 60 * 7.5 * g); b.scale.y = h; b.position.y = h / 2; b.material.opacity = on ? 1 : 0.18; b.material.transparent = !on; l.visible = on; l.position.y = h + 0.35; });
      const k = ds === 0 ? null : N[ds - 1];
      if (!k) cap('最好 / α=0：走跑 52.9/21.8 = <b>2.43</b>，舞蹈 58.8/38.5 = <b>1.53</b>，拳击 57.5/31.0 = <b>1.85</b>。正文说“三倍”');
      else { const v = FIG9[k], best = Math.max(...v.slice(0, 5)), bi = v.indexOf(best); cap(`${NM[ds - 1]}：最好在 α = <b>${FIG9.a[bi]}</b>，${best.toFixed(1)} s；α = 0 是 ${v[5].toFixed(1)} s；比值 <b>${(best / v[5]).toFixed(2)}</b>（当场算）`); }
    } };
  }

  /* ---------- scene 8: random rollouts (hand-made paths) ---------- */
  function s8(G) {
    let nokl = +(OPT[0] ?? 0);
    G.add(L.grid(30, 30));
    const R = L.rng(21), P = [], T = 30, n = 301;
    for (let k = 0; k < 10; k++) { const pts = [[0, 0]]; let h = R() * 6.283, w = 0, x = 0, z = 0; const sp = 0.25 + 0.35 * R();
      for (let i = 1; i < n; i++) { w = 0.92 * w + L.gauss(R) * 0.06; h += w; const v = sp * (0.6 + 0.4 * Math.sin(i / 37 + k)); x += Math.sin(h) * v * 0.1 * 3; z += Math.cos(h) * v * 0.1 * 3; pts.push([x, z]); } P.push(pts); }
    const colors = [COL.prim, COL.task, COL.enc, COL.help, COL.kl, COL.mimic, COL.sim, COL.ok, COL.white, COL.gate];
    const rib = P.map((pts, k) => { const l = L.line(pts.map(p => [p[0], 0.05, p[1]]), colors[k], { opacity: 0.9 }); G.add(l); return l; });
    const robs = P.map(() => { const r = robot(COL.robot); G.add(r); return r; });
    G.add(lab('网格 1 m · 同一起点 · 每步 z ~ N(0, I)', [0, 0.3, 7.6], { size: 18 }));
    const ctls = [{ label: '模型', items: ['完整（有 KL）', '去掉 KL'], get: () => nokl, set: k => { nokl = k; } }];
    return { ctls, update(p) {
      const t = p * T, idx = Math.min(n - 1, Math.round(p * (n - 1)));
      P.forEach((pts, k) => { const m = nokl ? Math.min(idx, 3) : idx; const pos = rib[k].geometry.attributes.position; for (let i = 0; i < n; i++) { const j = Math.min(i, m); pos.setXYZ(i, pts[j][0], 0.05, pts[j][1]); } pos.needsUpdate = true; rib[k].geometry.computeBoundingSphere();
        const a = pts[Math.max(0, m - 1)], b = pts[m], yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
        if (nokl && t > 0.8) { const q = getup(0, t); pose(robs[k], q, [b[0], 0, b[1]], 1.6, yaw); }
        else pose(robs[k], clip(k % 3 === 0 ? 'skip' : 'walk', t + k * 0.3), [b[0], 0, b[1]], 1.6, yaw); });
      cap(nokl ? `去掉 KL：运行时的随机 z 落在解码器没见过的地方，<b>不到 1 秒</b>就摔（正文 §5.5.1）· t = ${t.toFixed(1)} s` : `t = <b>${t.toFixed(1)}</b> / 30 s · 10 条展开从同一状态出发，各走各的（轨迹是示意）`);
    } };
  }

  /* ---------- scene 9: the helper branch ---------- */
  function s9(G) {
    let si = +(OPT[0] ?? 0); const SIG = [0.1, 0.5, 1.0];
    const g = block(1.0, 1.0, 1.0, COL.task, [-14, 0.5, 0]); G.add(g); G.add(lab('g_t', [-14, 1.5, 0], { size: 18 }));
    const te = net(G, -12.6, 0, 0, [256, 256, 32], COL.task, { gap: 1.0, k: 0.006 });
    const dec = net(G, -8.8, 0, 0, [393, 512, 512, 512, 54], COL.frozen, { gap: 0.95, k: 0.004 });
    const hp = net(G, -8.8, 0, 4.2, [393, 128, 128, 54], COL.help, { gap: 0.95, k: 0.006 });
    const th = block(1.1, 0.8, 1.0, COL.help, [-4.6, 0.4, 4.2]); G.add(th); G.add(lab('tanh', [-4.6, 1.3, 4.2], { size: 17 }));
    const mul = L.sphere(0.45, COL.gold); mul.position.set(-2.8, 0.5, 4.2); G.add(mul); G.add(lab('× σ', [-2.8, 1.4, 4.2], { size: 18 }));
    const add = L.sphere(0.5, COL.gold); add.position.set(-1.6, 0.5, 0); G.add(add); G.add(lab('+', [-1.6, 1.5, 0], { size: 20 }));
    G.add(lab('任务编码器（训）', [-12.4, 4.0, 0], { size: 18 }), lab('运动解码器（冻结）', [-6.8, 4.8, 0], { size: 18 }), lab('帮手 H（训）', [-7.6, -0.4, 5.6], { size: 18 }), lab('â_t = a_t + Δa_t', [-1.6, 3.0, 0], { size: 18 }));
    const fs = [stream(G, 4, COL.task), stream(G, 5, COL.frozen), stream(G, 5, COL.help)];
    const rob = robot(COL.robot); G.add(rob);
    const fan = sector(G, 3.6, COL.help, { opacity: 0.55 }), base = L.line([[0, 0, 0], [3.6, 0, 0]], COL.white, { opacity: 1 }), mid = L.line([[0, 0, 0], [3.9, 0, 0]], COL.gold, { opacity: 0.9 }); G.add(base, mid);
    const pivot = L.sphere(0.2, COL.gold); G.add(pivot); const FX = 8.6, FY = 5.6; pivot.position.set(FX, FY, 0.5); mid.position.set(FX, FY, 0.51);
    G.add(lab('一个关节：金线 = 解码器给的 a_t，扇形 = a_t ± σ', [FX - 1.6, FY + 1.4, 0.5], { size: 16 })); fan.position.set(FX, FY, 0.5); base.position.set(FX, FY, 0.52);
    const ctls = [{ label: 'σ', items: ['0.1', '0.5', '1.0'], get: () => si, set: k => { si = k; } }];
    return { ctls, update(p) {
      const q = (p * 12) % 1, s = SIG[si];
      fs[0]([[-13.5, 0.6, 0], [-12.4, 1.2, 0], [-10.8, 0.8, 0], [-8.8, 1.2, 0]], q, 1);
      fs[1]([[-8.8, 1.4, 0], [-5.8, 1.2, 0], [-1.6, 0.6, 0]], q, 1);
      fs[2]([[-10.8, 0.6, 2], [-8.8, 1.0, 4.2], [-4.6, 0.6, 4.2], [-2.8, 0.5, 4.2], [-1.6, 0.6, 0]], q, 1);
      const a0 = -Math.PI / 2 + 0.3; fan.userData.set(a0 - s, a0 + s); mid.rotation.z = a0; base.rotation.z = a0 + s * Math.sin(p * 6.283 * 2);
      pose(rob, { ...clip('walk', 0.2), sL: 0.3, sR: 0.3 }, [6.2, 0, -0.2], 3.4, 0);
      dec.forEach(m => tint(m, COL.frozen));
      cap(`σ = <b>${s}</b> rad：每个关节最多被改 ±<b>${(s * 180 / Math.PI).toFixed(2)}°</b>（当场算）· ${['5.2 节四个任务、打沙袋（像原始动作，约 200 N）', '打沙袋对照（动作更猛，可到 500 N）', '不平地形和人群（接近“放开解码器”那一端）'][si]}`);
    } };
  }

  /* ---------- scene 10: downstream tasks ---------- */
  function s10(G) {
    let task = +(OPT[0] ?? 0); const sub = new THREE.Group(); G.add(sub); let last = -1, S = {};
    const NAMES = ['点目标', '摇杆', '∞ 路径', '迷宫', '地形', '人群', '打沙袋'];
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); last = task; S = {};
      sub.add(L.grid(30, 30));
      if (task === 0) { S.goals = [[6, -5], [-5, -6], [-7, 5], [5, 6]]; S.goals.forEach(([x, z]) => { const c = L.cyl(0.12, 0.12, 2.4, COL.bad); c.position.set(x, 1.2, z); sub.add(c); }); S.rob = robot(COL.robot); sub.add(S.rob); }
      if (task === 1) { S.rob = robot(COL.robot); sub.add(S.rob); S.arr = L.arrow([0, 0.1, 0], [0, 0.1, 3], COL.bad); sub.add(S.arr); }
      if (task === 2) { const n = 200, pts = []; for (let i = 0; i <= n; i++) { const t = Math.PI * i / n; pts.push([10 * Math.sin(2 * t) * 0.6, 0.06, 10 * Math.sin(2 * t) * Math.cos(2 * t) * 0.6]); } sub.add(L.line(pts, COL.bad, { opacity: 0.95 })); S.rob = robot(COL.robot); sub.add(S.rob); S.dot = L.sphere(0.25, COL.gold); sub.add(S.dot); sub.add(lab('20 m × 10 m（画面缩到 0.6 倍）', [0, 0.3, 5.2], { size: 17 })); }
      if (task === 3) { S.cells = inst(BOX, 64); sub.add(S.cells); const W = 1.5; for (let i = 0; i < 64; i++) { setI(S.cells, i, [(i % 8 - 3.5) * W, 0.04, (Math.floor(i / 8) - 3.5) * W], [W * 0.92, 0.06, W * 0.92]); colI(S.cells, i, hex3(COL.dim)); } done(S.cells);
        const wall = (x, z, w, d) => { const m = block(w, 0.8, d, COL.frozen, [x, 0.4, z]); sub.add(m); }; wall(0, -6.2, 12.4, 0.2); wall(0, 6.2, 12.4, 0.2); wall(-6.2, 0, 0.2, 12.4); wall(6.2, 0, 0.2, 12.4); wall(-1.5, 1.5, 0.2, 6); wall(3, -2, 6, 0.2);
        S.order = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) S.order.push(r * 8 + (r % 2 ? 7 - c : c)); S.rob = robot(COL.robot); sub.add(S.rob); sub.add(lab('24 m × 24 m，8 × 8 格（每格 3 m）', [0, 0.3, 7.6], { size: 17 })); }
      if (task === 4) { const g = new THREE.PlaneGeometry(22, 22, 44, 44); g.rotateX(-Math.PI / 2); const r = L.rng(4), pos = g.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, 0.5 * Math.sin(x * 0.7) * Math.cos(z * 0.6) + 0.25 * r()); } g.computeVertexNormals(); const m = new THREE.Mesh(g, L.mat(0xd9893a, { roughness: 0.9 })); sub.add(m); S.h = (x, z) => 0.5 * Math.sin(x * 0.7) * Math.cos(z * 0.6) + 0.12;
        S.dots = inst(BALL, 64); S.dots.material.emissive.setHex(COL.ok); S.dots.material.color.setHex(COL.ok); sub.add(S.dots); S.rob = robot(COL.robot); sub.add(S.rob); const c = L.cyl(0.12, 0.12, 2.6, COL.bad); c.position.set(8, 1.6, 0); sub.add(c); }
      if (task === 5) { S.robs = []; for (let i = 0; i < 8; i++) { const r = robot([COL.prim, COL.task, COL.enc, COL.help, COL.kl, COL.mimic, COL.sim, COL.white][i]); sub.add(r); S.robs.push(r); } }
      if (task === 6) { S.bag = new THREE.Group(); S.bag.position.set(0, 5, 0); sub.add(S.bag); const b = L.cyl(0.6, 0.6, 2.6, 0x222833); b.position.y = -3.2; S.bag.add(b); S.bag.add(L.line([[0, 0, 0], [0, -1.9, 0]], COL.white, { opacity: 0.8 })); S.rob = robot(COL.robot); sub.add(S.rob); sub.add(lab('40 kg，顶端球关节', [0, 5.6, 0], { size: 17 })); }
    }
    rebuild();
    const ctls = [{ label: '任务', items: NAMES, get: () => task, set: k => { task = k; } }];
    return { ctls, update(p) {
      if (last !== task) rebuild();
      const T = p * 16;
      if (task === 0) { const k = Math.min(3, Math.floor(p * 4)), u = (p * 4) % 1, a = k ? S.goals[k - 1] : [0, 0], b = S.goals[k], x = L.lerp(a[0], b[0], seg(u, 0, 0.85)), z = L.lerp(a[1], b[1], seg(u, 0, 0.85)); pose(S.rob, clip('walk', T), [x, 0, z], 2.2, Math.atan2(b[0] - a[0], b[1] - a[1])); const d = Math.hypot(b[0] - x, b[1] - z); cap(`目标 ${k + 1} / 4 · d = <b>${d.toFixed(2)}</b>（示意单位）· r = d_{t−1} − d_t · d < 0.5 m 算到 · 目标状态 (x_rel/‖x_rel‖, ‖x_rel‖)`); }
      if (task === 1) { const ang = Math.floor(p * 3) * 2.1, lagA = ang - 0.9 * Math.exp(-((p * 3) % 1) * 5), sp = 1.2; S.arr.setDirection(new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang))); pose(S.rob, clip('walk', T), [0, 0, 0], 2.4, lagA); const dv = 2 - 2 * Math.cos(ang - lagA), rr = Math.exp(-5 * dv) * Math.exp(-5 * 0); cap(`目标方向 ${(ang * 57.3 % 360).toFixed(0)}° · 质心方向落后 ${((ang - lagA) * 57.3).toFixed(0)}° · 方向项 exp(−5‖·‖²) = <b>${rr.toFixed(3)}</b>（大小项设为 1，当场算）`); }
      if (task === 2) { const t = Math.PI * p, x = [6 * Math.sin(2 * t), 6 * Math.sin(2 * t) * Math.cos(2 * t)], v = [12 * Math.cos(2 * t), 12 * Math.cos(4 * t)]; S.dot.position.set(x[0], 0.3, x[1]); pose(S.rob, clip('walk', T), [x[0], 0, x[1]], 2.0, Math.atan2(v[0], v[1])); const sp = 20 * Math.hypot(Math.cos(2 * t), Math.cos(4 * t)); cap(`x_t = 10(sin 2t, sin 2t cos 2t) · 若 t 是秒，此刻速度要 <b>${sp.toFixed(1)}</b> m/s（当场算）· 一圈 61.0 m，周期 π`); }
      if (task === 3) { const m = Math.min(64, Math.floor(p * 70)); for (let i = 0; i < 64; i++) colI(S.cells, S.order[i], hex3(i < m ? COL.ok : COL.dim)); done(S.cells); const c = S.order[Math.min(63, Math.max(0, m - 1))]; pose(S.rob, clip('walk', T), [(c % 8 - 3.5) * 1.5, 0, (Math.floor(c / 8) - 3.5) * 1.5], 1.6, 0); const ret = m + (m >= 64 ? 30 : 0); cap(`已访问 <b>${m}</b> / 64 格 · 回报 <b>${ret}</b> / 94（走遍再加 30）· 射线 32 条、5 m、270°；访问矩阵 3 × 3`); }
      if (task === 4) { const x = -8 + 16 * p, z = 1.5 * Math.sin(p * 5); pose(S.rob, clip('walk', T), [x, S.h(x, z), z], 2.2, Math.PI / 2); for (let i = 0; i < 64; i++) { const dx = (i % 8 - 3) * 0.375 * 2.2, dz = (Math.floor(i / 8) - 3.5) * 0.375 * 2.2; setI(S.dots, i, [x + dx, S.h(x + dx, z + dz) + 0.1, z + dz], 0.09); } done(S.dots); cap('局部高度图：3 m × 3 m，8 × 8 = 64 点（每格 0.375 m），角色略靠后，前面看得多 · 五峰：4 m 高、38° 坡 → 水平 5.12 m'); }
      if (task === 5) { S.robs.forEach((r, i) => { const a0 = i / 8 * 6.283, u = seg(p, 0.05, 0.9), a = a0 + 0.35 * Math.sin(Math.PI * u), rad = 7 * (1 - 2 * u); pose(r, clip('walk', T + i * 0.2), [rad * Math.sin(a), 0, rad * Math.cos(a)], 1.8, a0 + Math.PI + 0.3 * Math.sin(Math.PI * u)); }); cap('Circle：8 人走向圆的对面 · r = r_goal + r_reached − 0.1 r_collision · 作者观察到环岛式的绕行（轨迹是示意）'); }
      if (task === 6) { const ph = (p * 6) % 1, hit = ph > 0.45 && ph < 0.6, sw = 0.25 * Math.sin(p * 6 * 6.283 - 1.2); S.bag.rotation.z = sw; const q = clip('walk', 0.1); q.sR = hit ? 1.5 : 0.6; q.eR = hit ? 0.1 : 1.4; q.sL = 0.6; q.eL = 1.4; pose(S.rob, q, [-2.6, 0, 0], 3.0, Math.PI / 2); const f = hit ? 180 : 0; cap(`h_t = ${Math.floor(p * 6) % 2 ? '(0, 1) 右拳' : '(1, 0) 左拳'} · r = 0.2 r_close + r_hit − 0.1 r_collision · r_close = exp(−5‖d − 1.2‖²) · 力 > 100 N 才算击中（式 (5) 的左右顺序见精读页）`); }
    } };
  }

  /* ---------- scene 11: where the world model sits ---------- */
  function s11(G) {
    let mi = +(OPT[0] ?? 0); const sub = new THREE.Group(); G.add(sub); let last = -1, S = {};
    const M = [
      { t: 'PhysicsVAE（本文）', data: '专家轨迹（固定）', model: '仿真层：先训 300 轮后冻结', steps: 1, grad: '下一状态误差 → 动作', down: '下游：真仿真器 + DD-PPO', live: false },
      { t: 'ControlVAE', data: '自己策略的数据（在线）', model: '世界模型：和 VAE 交替一起训', steps: 4, grad: '多步状态误差 → 策略', down: '下游：穿过世界模型反传', live: true },
      { t: 'SuperMimic', data: '自己策略的数据（在线）', model: '世界模型：和策略交替一起训', steps: 8, grad: '32 步回报 → 策略（拟合用 8 步）', down: '下游：蒸馏或经世界模型', live: true }];
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); last = mi; S = {};
      const m = M[mi]; sub.add(L.grid(30, 30));
      S.d = block(2.6, 1.4, 2, COL.data, [-9, 0.7, 0]); S.w = block(2.6, 1.6, 2, m.live ? COL.sim : COL.frozen, [-2, 0.8, 0]); S.p = block(2.6, 1.4, 2, COL.dec, [5, 0.7, 0]); sub.add(S.d, S.w, S.p);
      sub.add(lab(m.data, [-9, 2.2, 0], { size: 18 }), lab(m.model, [-2, 2.5, 0], { size: 18 }), lab(m.grad, [5, 2.2, 0], { size: 18 }), lab(m.down, [5, -0.2, 2.6], { size: 17 }), lab(m.t, [-2, 7.6, 0], { size: 24, border: 'rgba(56,209,255,.8)' }));
      S.chain = []; for (let i = 0; i < m.steps; i++) { const c = block(0.7, 0.7, 0.7, m.live ? COL.sim : COL.frozen, [-5 + i * 1.0, 4.4, 0]); sub.add(c); S.chain.push(c); }
      sub.add(lab(`穿过模型展开 ${mi === 2 ? '8（拟合）/ 32（想象）' : mi === 1 ? '多' : '1'} 步`, [-1.5, 5.6, 0], { size: 18 }));
      if (!m.live) sub.add(lab('❄ 冻结，只见过专家数据', [-2, -0.3, 2.6], { size: 17, color: '#aab6d0' }));
      else { S.loop = stream(sub, 6, COL.data); sub.add(lab('↺ 策略收集的新数据回到模型', [-2, -0.3, 2.6], { size: 17 })); }
      sub.add(lab('SuperMimic 表 1：' + ['PPO | BC¹ | PPO | RL | ✗', 'MBRL（联合）| MBRL | RL | ✗', 'MBRL（三段联合）| 蒸馏或 RL | ✓'][mi], [0, 0.3, 6.2], { size: 18 }));
      S.f = stream(sub, 5, COL.gate);
    }
    rebuild();
    const ctls = [{ label: '方法', items: ['PhysicsVAE', 'ControlVAE', 'SuperMimic'], get: () => mi, set: k => { mi = k; } }];
    return { ctls, update(p) {
      if (last !== mi) rebuild();
      const q = (p * 10) % 1; S.f([[-7.6, 0.8, 0], [-3.3, 0.8, 0], [-0.7, 0.8, 0], [3.7, 0.8, 0]], q, 1);
      if (S.loop) S.loop([[5, 0.8, -1.2], [5, 0.8, -3], [-9, 0.8, -3], [-9, 0.8, -1.2]], q, 1);
      S.chain.forEach((c, i) => glow(c, Math.max(0, 1 - Math.abs(((p * 2) % 1) * S.chain.length - i))));
      cap(['PhysicsVAE 的世界模型在专家数据上<b>离线</b>学、<b>冻结</b>、只走 <b>1</b> 步，且只在潜空间训练时用', 'ControlVAE 用自己策略的数据<b>在线</b>学世界模型，多步展开，下游任务也穿过它训练', 'SuperMimic 在线拟合（8 步），想象 32 步，回报直接反传给策略；三段联合训练'][mi]);
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];


  /* ---------- player ---------- */
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
    if (!S) return;
    L.clear(root); LABS = []; PICKS = []; lastCap = null;
    const sc = SCENES[cur]; fly(...sc.cam); refDist = sc.cam[2] * aspectFix();
    const G = new THREE.Group(); root.add(G); pNow = p0; api = BUILD[cur](G); OPT = [];
    buildCtl();
    t0 = performance.now() - p0 * sc.dur * 1000; api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
  }
  if (S) {
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
  }
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
  window.__pvaeDebug = { get cap() { return $('cap').textContent; } };
})();
