'use strict';
/* Interactive World Simulation with Cosmos for Physical AI (arXiv 2611.06627) taken apart into eleven animated scenes.
   Numbers come from the paper and from NVIDIA/cosmos-framework e40831f (read only). Each scene's update(p) is a pure
   function of the timeline p plus the current toggles. Scenes 3, 5, 7, 8, 10 and 11 compute their numbers live from the
   formulas in the paper; nothing here runs a Cosmos network. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { lang: 0x9d8cff, ctl: 0x4fc98a, noisy: 0xf0963c, clean: 0x3aa8e0, gen: 0x7c8cff, frozen: 0x6b7794, sink: 0xf2c14e, evict: 0x46506a, bad: 0xe05d5d, ok: 0x4fc98a, kv: 0x38d1ff, dec: 0xd45fa0, other: 0x8e9bb8, white: 0xeef2fa, lidar: 0xd45fa0 };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const hexs = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const live = t => `<p class="guess"><b>现算 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const fmt = n => n.toLocaleString('en-US');
  const f2 = x => x.toFixed(2), f3 = x => x.toFixed(3);
  /* resolution shift S_k(u) = k u / (1 + (k − 1) u), appendix B.2 */
  const shiftK = (u, k) => k * u / (1 + (k - 1) * u);
  /* exact two-sided sign test on discordant pairs */
  function signP(a, b) { const n = a + b, k = Math.min(a, b); let c = 1, s = 0; for (let i = 0; i <= k; i++) { if (i > 0) c = c * (n - i + 1) / i; s += c; } return Math.min(1, 2 * s / Math.pow(2, n)); }

  const SCENES = [
    { n: 1, part: '总览', title: '一个双向视频模型，四个阶段后变成流式模拟器', sub: '点方块跳到对应那一幕', dur: 12, cam: [0.0, 1.12, 40, [0, 2.6, 0]],
      html: dl([['骨干', 'Cosmos 3 的 Cosmos3-Nano 检查点，MoT 两塔'], ['唯一共享的结构改动', '生成塔的时间注意力改成块因果'], ['配方', 'Stage 0 双向适配 → 1 TF → 2 TF-dCM（4 步）→ 3 SF-DMD'], ['推理', 'K/V 缓存、sink + 滚动窗口、编译、CUDA Graph'], ['三个例子', 'Sim-Bimanual（动作 → 画面）、Sim-Transfer（仿真器结构 → 画面）、Sim-Auto（多相机 + LiDAR）']]) +
        '<p>上排是配方的四个阶段，下排是三个后训练例子。点任何一个方块跳过去。左边的“双向”和右边的“块因果”是这篇要解决的核心差别：双向模型整段一起去噪，做不了边收控制边出画面。</p>' + src('§1 · §3 · 图 1 · 图 4') },
    { n: 2, part: '§2.1–2.2 结构', title: 'MoT 两塔，和“控制 + 带噪视觉”组成的块', sub: '切换动作条件 / 视频迁移、块大小', dur: 13, cam: [0.0, 1.25, 38, [1.5, 4.0, 0]],
      html: dl([['推理塔', '语言，因果自注意力'], ['生成塔', '视觉、控制、去噪 token；query 可读推理塔 K/V，反过来不行'], ['块 𝒢ⱼ', '[𝒰ⱼ, Ṽⱼ]：干净控制 + 带噪视觉，只有视觉算损失'], ['动作时间坐标', '每个隐帧区间 4 个动作，时间增量是视觉的 1/4'], ['MRoPE 间隙', '自回归和扩散子序列之间隔 15,000']]) +
        '<p>右边一列列是隐帧。动作条件时每个隐帧前面挂 4 个小立方（4 个逐帧动作）；视频迁移时挂一块同时段的源隐帧。黄框是一个预测块：Bimanual 是 2 个隐帧（8 帧），Sim-Transfer 是 1 个（4 帧）。</p>' +
        live('标签上的动作时间坐标按“最后一个动作和对应隐帧同坐标、步长 1/4”现算。') + guess('token 数缩小画；推理塔里的方块数是示意。') + src('§2.1 · §2.2 · 图 2 · bimanual_profiles.py unified_3d_mrope_temporal_modality_margin') },
    { n: 3, part: '§2.3 掩码', title: '块因果：块内互看，只看更早的块', sub: '切换 Cosmos 3 / 因果化，以及块大小', dur: 13, cam: [0.0, 1.42, 38, [2.0, 1.2, 0]],
      html: dl([['行 / 列', 'query / key（语言 4 个 + 8 个隐帧各配 1 个控制和 1 个视觉 token）'], ['语言', '因果自注意力，不读生成塔'], ['Cosmos 3', '生成块之间全可见'], ['因果化', '只读本块和更早的块；块内联合去噪'], ['块大小', '小：更频繁接受新控制；大：一次建模更长、可能画质更好']]) +
        '<p>亮格是允许的读，暗格是禁止的读。切块大小时，可见对数当场重数。式 (3) 的分解 p(z) = Π p(z_Bj | z_B&lt;j, Iⱼ) 对应的就是这个下三角块结构。</p>' +
        live('允许的 (query, key) 对数按规则逐格计数。') + guess('真实序列每个隐帧有几百个空间 token，这里每个隐帧只画 1 个视觉 token 和 1 个控制 token。') + src('§2.3 · 图 3 · 式 (3)') },
    { n: 4, part: '§3.1–3.2 Stage 0/1', title: '先双向适配，再用真实历史学块因果', sub: '切换 Stage 0 / Stage 1（两遍 teacher forcing）', dur: 14, cam: [0.0, 1.25, 36, [0, 3.5, 0]],
      html: dl([['Stage 0', '双向，全时间可见；式 (4)，w = 1/(CTHW)；长片段'], ['Stage 1 · 第 1 遍', '干净参考块，因果，存每层 K/V'], ['Stage 1 · 第 2 遍', '所有带噪块并行；读语言、前缀和严格更早的干净块'], ['损失', '式 (5)，只监督视觉目标；控制、首帧不算'], ['梯度', '穿过干净缓存（代码 teacher_forcing_detach_clean_kv=False）']]) +
        '<p>Stage 1 的历史是录像里的真实帧（teacher forcing），所以训练干净、容易，但和推理时“历史是自己生成的”不一致，这个差距留给 Stage 3。</p>' +
        guess('块数画成 4 块；K/V 的高度只表示“已存”。') + src('§3.1 · §3.2 · 图 5 · 式 (4)(5)') },
    { n: 5, part: '§3.3 Stage 2', title: 'TF-dCM：教师走一步 Euler，学生两头预测同一个终点', sub: '切换分辨率偏移 κ；下方是 48 格的时间网格', dur: 14, cam: [0.0, 1.25, 38, [0, 3.0, 0]],
      html: dl([['一致性映射', 'f(x_τ) = x_τ − τ·v(x_τ)，f(x, 0) = x'], ['时间对', 'u 均匀取自 (1/48, 1)，τ = S(u)，s = S(u − 1/48)'], ['教师', '冻结的 Stage 1 因果模型，CFG（Bimanual 3、Transfer 3、Auto 1.5），一步 Euler'], ['损失', '‖f(x_τ) − sg f(x̂_s)‖²，w = 1/(CHW)'], ['推理', '4 步：τ = S(1, 3/4, 1/2, 1/4)']]) +
        '<p>曲线是一条示意的教师轨迹（从噪声 τ = 1 到数据 τ = 0）。白点 x_τ 经教师一步走到 x̂_s，学生从两点各预测终点，两者要对齐。下面的竖线是 48 格的时间网格经偏移后的位置：κ 越大，格子越挤到高噪声一端。</p>' +
        live('τ、s 和 4 步网格按 S_κ(u) = κu/(1 + (κ − 1)u) 现算；κ = 5 时 4 步网格正是 [1, 15/16, 5/6, 5/8]。') + guess('二维轨迹是手设的曲线，只说明一致性的意思。') + src('§3.3 · 附录 B.2 · 附录 C.1 · tf_dcm.py total_steps=48') },
    { n: 6, part: '§3.4 Stage 3', title: 'SF-DMD：在自己生成的历史上训练', sub: '切换退出策略 max / cycle', dur: 16, cam: [0.0, 1.25, 40, [0, 4.5, 0]],
      html: dl([['rollout', '学生一块一块生成，每块 4 次去噪，完成后进历史'], ['求导', '只对每块最后一次去噪（式 12），历史停梯度'], ['两个打分模型', '冻结的 Stage 0 双向教师 ψ，可训练的 fake score φ，都看整段 rollout'], ['更新方向', 'g = (f_φ − f_ψ) / (ρ + 10⁻⁶)，ρ = mean|ẑ − f_ψ|（式 18）'], ['交替', '1 次学生 : 5 次 φ；Bimanual 1,380 = 230 + 1,150']]) +
        '<p>下排是 rollout：每块的柱子是噪声水平，沿 1 → 15/16 → 5/6 → 5/8 → 0 下降，红色箭头标出唯一求导的最后一步。完成的块变蓝，进入历史缓存。上排两个打分模型给这段 rollout 打分，二者之差就是推学生的方向。</p>' +
        '<p>cycle 规则让不同块用不同步数，能把监督分散到不同深度；三个发布模型都用 max 4 步（附录表 B.5 里 max 4 步质量最高，但 ATE 也最大）。</p>' +
        live('右上的更新计数按 1:5 现算。') + guess('块数画成 5 块；f_φ、f_ψ 的方块只表示角色。') + src('§3.4 · 式 (10)–(19) · common_loss.py · bimanual_profiles.py student_update_freq=6') },
    { n: 7, part: '§4.1 流式缓存', title: '初始 sink + 滚动窗口：历史有界', sub: '切换三个模型的窗口', dur: 15, cam: [0.0, 1.25, 40, [0, 3.0, 0]],
      html: dl([['Bimanual', '窗口 64 个隐帧，其中 8 个 sink；每块 2 个隐帧'], ['Sim-Transfer', '窗口 30 个隐帧，3 个 sink；每块 1 个；控制和 RGB 成对'], ['Sim-Auto', '只留 2 块：初始块作 sink + 最近一块；每块 3 个隐帧 × 每相机'], ['刷新', '去噪完再跑 R 次前向得到干净 K/V（式 20），追加并淘汰（式 21）'], ['训练 ≠ 推理', 'Bimanual 训练时保留全部历史、无 sink']]) +
        '<p>每个方格是一个隐帧的 K/V。金色是 sink，永不淘汰；蓝色是滚动窗口；灰色往下掉的是被挤出去的。橙色是正在去噪的当前块。窗口满了以后形状固定，才能静态编译和 CUDA Graph 回放。</p>' +
        live('“能看见的最近历史”按（窗口 − sink − 当前）× 4 帧 ÷ 帧率现算。') + src('§4.1 · §5.5 · 附录 C.3 表 C.6 · 附录 D.5.1 · args.py') },
    { n: 8, part: '§4.2 时间预算', title: '每块时间花在哪里：去噪只是一部分', sub: '切换“毫秒”和“相对物理时长”', dur: 13, cam: [0.0, 1.3, 40, [1.0, 3.0, 0]],
      html: dl([['Bimanual，1 GB300', '去噪 89 + K/V 69 + 解码 4.4 + 其他，共 167 ms；一块 8 帧 = 267 ms'], ['Sim-Transfer，1 GB200', '有界编译：去噪 127 + 刷新 35 + 控制 K/V 34 + 解码 42（区间有重叠），块 p50 240 ms；一块 4 帧 = 133 ms'], ['Sim-Auto 1 相机，1 GB200', '控制准备 141 + 去噪 126 + K/V 79 + 其他，共 363 ms；一块 12 帧 = 400 ms'], ['Sim-Auto 7 相机，16 GB200', '134 + 284 + 154 + 其他，共 588 ms']]) +
        '<p>竖线是这一块代表的物理时长。柱子越过红线就是 RTF &gt; 1，跟不上 30 FPS。蓝色（K/V 刷新）和紫色（控制准备）加起来常常和去噪一样大，所以只减去噪步数换不来同比例的加速。</p>' +
        live('RTF = 块墙钟时间 ÷ 块物理时长，按柱长现算；Sim-Transfer 的 240 / 133 ≈ 1.80（表 C.2 用平均 FPS 算是 1.89）。') + src('图 9 · 表 3 · 表 C.3 · 图 22 · 表 14') },
    { n: 9, part: '§5 Sim-Bimanual', title: '59 维统一动作和 8 帧一块', sub: '切换数据域，看哪些字段有效', dur: 14, cam: [0.0, 1.3, 40, [0, 3.5, 0]],
      html: dl([['自身位姿', '9 = 3 平移 + 6D 旋转'], ['每只手', '24 = 9 手腕位姿 + 5 指尖 × 3；另加 1 个夹爪开度'], ['合计', '9 + 25 + 25 = 59；推理再补 5 个零 = 64（max_action_dim）'], ['归一化', '按域 asinh，再按域投影（式 26）；有效掩码 m'], ['时间', '4 个动作 / 隐帧，2 隐帧 / 块 = 8 帧；位姿锚点每 16 帧']]) +
        '<p>左边是 64 个通道：灰色是补的零。切换数据域时，亮起的是这个域通常有的字段。右边时间轴：每 4 帧对应 1 个隐帧，黄框是 8 帧一块，紫色括号是 16 帧的位姿锚点区间（跨 2 块）。图 13 的混合 rollout 就是在同一会话里切换域，不重置历史。</p>' +
        guess('各域具体有哪些字段，论文只说“按机体映射并用掩码标出”，这里的亮灭是我按字段含义推测的（相机域只有自身位姿）。') + src('§5.1 · 图 7 · docs/inference_bimanual.md · bimanual_profiles.py') },
    { n: 10, part: '§6 Sim-Transfer 闭环', title: '仿真器管物理，模型只管画面', sub: '切换表 9(b) 计数 / 表 C.9 配对', dur: 15, cam: [0.0, 1.25, 42, [0, 4.5, 0]],
      html: dl([['物理', 'Isaac Lab，动作 30 Hz、物理 240 Hz'], ['控制', '每 4 个动作采一次深度（仿真时间 7.5 Hz），0.15–0.90 m 映射成灰度'], ['渲染', 'SF-DMD 学生，4 步，窗口 30 / sink 3，每次出 4 帧 RGB'], ['策略', 'GR00T N1.7，每次看 640 × 480 RGB + 43 维关节，输出 16 个动作'], ['节奏', '16 个动作 = 0.533 s 仿真时间 = 4 次渲染，决策 1.875 Hz']]) +
        '<p>左边是闭环：动作推进仿真器，仿真器给深度，模型渲染 RGB，策略看最后一帧出下一段动作。右边柱子是六个策略检查点上两种渲染的成功数，或 15,000 步时的配对结果。</p>' +
        live('配对的精确符号检验 p 值按表 C.9 的不一致对数现算：15,000 步 2 对 7，p = 0.18。') + src('§6.5 · 表 9 · 附录 C.4 · 表 C.9') },
    { n: 11, part: '§7 Sim-Auto', title: '多相机加 LiDAR：按物理时间对齐的 0.4 秒块', sub: '切换相机数，现算注意力节省和 token 数', dur: 15, cam: [0.0, 1.3, 40, [-5, 1.5, 0]],
      html: dl([['相机', '30 FPS → 4 倍压缩 → 7.5 Hz 隐帧'], ['LiDAR', '10 Hz，不压缩，每帧 8 × 113 = 904 token'], ['一块', '0.4 s = 每相机 12 帧（3 隐帧）+ 4 帧 LiDAR'], ['跨传感器', '只看之前 0.4 s（含当前时刻），排除自己的视角'], ['推理缓存', '2 块：初始块 sink + 最近一块']]) +
        '<p>三条时间轴从上到下：相机帧、相机隐帧、LiDAR。橙色带是当前查询能看的“之前 0.4 秒”，随时间滑动。黄框是一个 0.4 秒的块。右边是按相机数现算的数。</p>' +
        live('理想节省 NvNt/(Nv + Nt)（式 28/29，Nt = 100）；按 0.4 s 窗口约 4 个时刻算 NvNt/(Nt + 4Nv)；832 × 480 时每块 token = 390 × 3 × Nv + 4 × 904。') + src('§7.1 · 图 19 · 图 20 · 式 (28)(29) · 表 14') }
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
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.0, phi: 1.0, dist: 30, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);
  let LABS = [], refDist = 30, PICKS = [];
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  /* a label whose text changes: rebuild the sprite only when the string changes */
  function dynLab(G, pos, o = {}) {
    let cur = null, sp = null;
    return t => { if (t === cur) return; cur = t; if (sp) { G.remove(sp); LABS = LABS.filter(x => x !== sp); L.dispose(sp); } sp = lab(t, pos, o); G.add(sp); };
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; for (let i = 0; i < n; i++) im.setColorAt(i, _C.setRGB(1, 1, 1)); return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  const recolor = (m, color) => { m.material.color.setHex(color); m.userData.c = hex3(color); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.14) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.5, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  function clearSub(sub) { LABS = LABS.filter(s => { let o = s; while (o) { if (o === sub) return false; o = o.parent; } return true; }); L.clear(sub); }
  const mix = (a, b, k) => [L.lerp(a[0], b[0], k), L.lerp(a[1], b[1], k), L.lerp(a[2], b[2], k)];
  /* vertical bar grown from y0 */
  function vbar(G, x, y0, w, color, o = {}) { const b = block(w, 1, o.d || w, color, [x, y0 + 0.5, o.z || 0], { edges: false, opacity: o.opacity }); G.add(b); return h => { const H = Math.max(0.02, h); b.scale.y = H; b.position.y = y0 + H / 2; }; }

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
    G.add(L.grid(48, 24));
    const B = [];
    const top = block(5.2, 1.6, 2, COL.frozen, [-13, 6.6, 0], { opacity: 0.92 }); G.add(top); B.push(top);
    G.add(lab('Cosmos 3 · Nano\n双向生成塔', [-13, 8.6, 0], { size: 18 }));
    const st = [['Stage 0\n双向适配', COL.frozen, 3], ['Stage 1\nTF 因果', COL.clean, 3], ['Stage 2\nTF-dCM 4 步', COL.sink, 4], ['Stage 3\nSF-DMD', COL.ok, 5]];
    st.forEach(([t, c, go], i) => { const x = -5.2 + i * 5.6, b = block(4.2, 1.8, 2, c, [x, 6.6, 0], { opacity: 0.92 }); b.userData.go = go; G.add(b); PICKS.push(b); B.push(b); G.add(lab(t, [x, 8.8, 0], { size: 17 })); });
    const mods = [['Sim-Bimanual', '动作 → 画面', 8, -11], ['Sim-Transfer', '仿真器结构 → 画面', 9, 0], ['Sim-Auto', '多相机 + LiDAR', 10, 11]];
    mods.forEach(([t, s, go, x]) => { const b = block(5.6, 2.2, 2.2, COL.gen, [x, 1.1, 0], { opacity: 0.92 }); b.userData.go = go; G.add(b); PICKS.push(b); B.push(b); G.add(lab(t, [x, -0.8, 1.4], { size: 19 })); G.add(lab(s, [x, -2.1, 1.4], { size: 15, color: '#b8c4da' })); });
    const strm = [-11, 0, 11].map(() => stream(G, 7, COL.gen, 0.13)), main = stream(G, 16, COL.white, 0.12);
    G.add(lab('双向：整段一起去噪', [-13, 4.6, 0], { size: 15, color: '#b8c4da' }));
    G.add(lab('块因果 · 4 步 · 流式', [11.6, 4.6, 0], { size: 15, color: '#b8c4da' }));
    return { update(p) {
      const q = (p * 1.6) % 1;
      main([[-13, 6.6, 1.2], [-5.2, 6.6, 1.2], [0.4, 6.6, 1.2], [6, 6.6, 1.2], [11.6, 6.6, 1.2]], q, 1);
      strm.forEach((f, i) => f([[11.6, 5.6, 1.2], [[-11, 0, 11][i], 2.4, 1.2]], (q * 1.3 + i * 0.2) % 1, seg(p, 0.45, 0.55)));
      B.forEach((b, i) => glow(b, Math.max(0.05, 0.6 - Math.abs(i / 8 - p) * 3)));
      cap(p < 0.45 ? '<b>配方</b>：同一个 Cosmos3-Nano 检查点，依次经过四个阶段' : p < 0.8 ? '<b>三个例子</b>：共用配方，各自有自己的控制、数据和评测' : '点任意方块跳到对应一幕');
    } };
  }

  /* ---------- scene 2: MoT towers and token layout ---------- */
  function s2(G) {
    let mode = +(OPT[0] ?? 0), csz = +(OPT[1] ?? 0) ? 1 : 2;
    G.add(L.grid(48, 24)); const sub = new THREE.Group(); G.add(sub); let last = '', lat = [], acts = [], frames = [];
    function rebuild() {
      clearSub(sub); lat = []; acts = []; frames = []; last = mode + ':' + csz;
      const tw = block(3.2, 7.2, 2.2, COL.lang, [-14, 3.6, 0], { opacity: 0.35 }); sub.add(tw);
      sub.add(lab('推理塔\n语言（因果）', [-14, 8.4, 0], { size: 17 }));
      for (let i = 0; i < 5; i++) { const t = block(0.7, 0.7, 0.7, COL.lang, [-14, 0.9 + i * 1.3, 1.3]); sub.add(t); }
      const gtw = block(24, 7.2, 2.2, COL.gen, [3.5, 3.6, -1.8], { opacity: 0.12 }); sub.add(gtw);
      sub.add(lab('生成塔：控制 + 视觉（去噪）', [3.5, 8.4, -1.8], { size: 17 }));
      const N = 6;
      for (let k = 0; k < N; k++) {
        const x = -7 + k * 4.0;
        const v = block(2.2, 2.2, 1.2, k === 0 ? COL.clean : COL.noisy, [x, 4.6, 0]); sub.add(v); lat.push(v);
        sub.add(lab(k === 0 ? '首帧隐帧\nt = 0' : `隐帧 ${k}\nt = ${k}`, [x, 6.6, 0], { size: 14 }));
        if (k === 0) { sub.add(lab('空动作', [x, 1.8, 0], { size: 13, color: '#b8c4da' })); continue; }
        if (mode === 0) {
          for (let a = 0; a < 4; a++) { const c = block(0.6, 0.6, 0.6, COL.ctl, [x - 1.35 + a * 0.9, 2.4, 0]); sub.add(c); acts.push(c); }
          if (k === 1) sub.add(lab('动作 t = 0.25, 0.5, 0.75, 1', [x + 1.0, 1.0, 0], { size: 13, color: '#9fe6bf' }));
        } else {
          const c = block(2.0, 1.0, 1.0, COL.ctl, [x, 2.4, 0]); sub.add(c); acts.push(c);
          if (k === 1) sub.add(lab('源隐帧（干净）', [x, 1.0, 0], { size: 13, color: '#9fe6bf' }));
        }
        for (let f = 0; f < 4; f++) { const fr = block(0.75, 0.5, 0.1, COL.white, [x - 1.35 + f * 0.9, -0.6, 0], { opacity: 0.5 }); sub.add(fr); frames.push(fr); }
      }
      sub.add(lab(mode === 0 ? '每个隐帧区间 4 个逐帧动作；动作时间步长 = 视觉的 1/4' : '每个隐帧配同时段的源视频或结构控制隐帧', [3.5, -2.2, 0], { size: 15, border: 'rgba(79,201,138,.7)' }));
      const nCh = Math.floor(5 / csz);
      for (let c = 0; c < nCh; c++) { const x0 = -7 + (1 + c * csz) * 4.0 - 1.6, w = csz * 4.0 - 0.4; const fr = L.line([[x0, 0.6, 1.0], [x0 + w, 0.6, 1.0], [x0 + w, 6.0, 1.0], [x0, 6.0, 1.0], [x0, 0.6, 1.0]], COL.sink, { opacity: 0.85 }); sub.add(fr); }
      sub.add(lab(csz === 2 ? '黄框 = 1 块 = 2 个隐帧 = 8 帧（Bimanual）' : '黄框 = 1 块 = 1 个隐帧 = 4 帧（Sim-Transfer）', [3.5, 10.0, 0], { size: 15, border: 'rgba(242,193,78,.8)' }));
      sub.add(lab('语言 → 生成塔：可读\n生成塔 → 语言：不可', [-14, -1.6, 0], { size: 14, color: '#c9c2ff' }));
    }
    rebuild();
    const ql = stream(G, 8, COL.lang, 0.12);
    const ctls = [{ label: '控制', items: ['动作条件', '视频迁移'], get: () => mode, set: k => { mode = k; } }, { label: '块大小', items: ['2 个隐帧', '1 个隐帧'], get: () => (csz === 2 ? 0 : 1), set: k => { csz = k ? 1 : 2; } }];
    return { ctls, update(p) {
      if (last !== mode + ':' + csz) rebuild();
      const act = Math.floor(p * 5.999) + 1;
      lat.forEach((v, k) => glow(v, k === 0 ? 0.25 : (Math.ceil(k / csz) === Math.ceil(act / csz) ? 0.7 : 0.05)));
      acts.forEach(a => glow(a, 0.25));
      ql([[-13, 6, 1.3], [-7, 5, 1.0], [3, 5, 1.0]], (p * 2) % 1, 1);
      cap(mode === 0 ? '<b>动作条件</b>：𝒢ⱼ = [𝒰ⱼ, Ṽⱼ]，控制保持干净、不算损失；只有带噪视觉被预测' : '<b>视频迁移</b>：控制组是同时段的干净源隐帧，和目标共享时间坐标');
    } };
  }

  /* ---------- scene 3: block-causal mask, counted live ---------- */
  function s3(G) {
    let mode = +(OPT[0] ?? 1), cs = [1, 2, 4][+(OPT[1] ?? 1)] || 2;
    const NL = 4, NLAT = 8, N = NL + 2 * NLAT, cell = 0.72, x0 = -N * cell / 2 - 5, y0 = 6.4;
    const im = inst(BOX, N * N); G.add(im);
    const role = i => (i < NL ? 'L' : ((i - NL) % 2 === 0 ? 'U' : 'V'));
    const lat = i => Math.floor((i - NL) / 2);
    function allowed(q, k) {
      if (role(q) === 'L') return role(k) === 'L' && k <= q;
      if (role(k) === 'L') return true;
      if (mode === 0) return true;
      return Math.floor(lat(k) / cs) <= Math.floor(lat(q) / cs);
    }
    const rowLab = [];
    for (let i = 0; i < N; i++) { if (i < NL) continue; if ((i - NL) % 2 === 1) { G.add(lab(`V${lat(i)}`, [x0 - 1.0, y0 - i * cell, 0], { size: 12, color: '#f5c08a' })); G.add(lab(`V${lat(i)}`, [x0 + i * cell, y0 + 1.0, 0], { size: 12, color: '#f5c08a' })); } }
    G.add(lab('语言', [x0 - 1.2, y0 - 1.5 * cell, 0], { size: 12, color: '#c9c2ff' }));
    G.add(lab('行 = query，列 = key', [x0 + N * cell / 2, y0 - N * cell - 1.0, 0], { size: 15 }));
    const info = dynLab(G, [11.5, 5.6, 0], { size: 16, border: 'rgba(56,209,255,.7)' });
    const info2 = dynLab(G, [11.5, 2.4, 0], { size: 15 });
    const ctls = [{ label: '模型', items: ['Cosmos 3（全可见）', '因果化'], get: () => mode, set: k => { mode = k; } }, { label: '块大小', items: ['1 隐帧', '2 隐帧', '4 隐帧'], get: () => [1, 2, 4].indexOf(cs), set: k => { cs = [1, 2, 4][k]; } }];
    return { ctls, update(p) {
      const rows = Math.ceil(seg(p, 0, 0.7) * N);
      let a = 0, g = 0, tot = 0;
      for (let q = 0; q < N; q++) for (let k = 0; k < N; k++) {
        const ok = allowed(q, k), i = q * N + k, vis = q < rows;
        if (q >= NL && k >= NL) { tot++; if (ok) g++; }
        if (ok) a++;
        const r = role(k), c = !ok ? hex3(0x2a3142) : r === 'L' ? hex3(COL.lang) : r === 'U' ? hex3(COL.ctl) : hex3(COL.noisy);
        setI(im, i, [x0 + k * cell, y0 - q * cell, ok ? 0.12 : 0], vis ? [cell * 0.9, cell * 0.9, ok ? 0.36 : 0.08] : 0.001); colI(im, i, c);
      }
      done(im);
      info(`生成塔内可见对：${g} / ${tot}（${(100 * g / tot).toFixed(1)}%）`);
      info2(mode === 0 ? '全可见：每个隐帧都能读未来的隐帧' : `块大小 ${cs}：一块 = ${cs * 4} 帧；新控制每 ${cs * 4} 帧才能生效`);
      cap(mode === 0 ? '<b>Cosmos 3</b>：生成块之间全可见，必须整段一起去噪' : `<b>因果化</b>：块下三角；块内 ${cs} 个隐帧联合去噪，看不到未来的块`);
    } };
  }

  /* ---------- scene 4: stage 0 / stage 1 replay teacher forcing ---------- */
  function s4(G) {
    let st = +(OPT[0] ?? 1); G.add(L.grid(48, 24)); const sub = new THREE.Group(); G.add(sub); let last = -1, C = [], Nz = [], K = [], links = [];
    function rebuild() {
      clearSub(sub); C = []; Nz = []; K = []; links = []; last = st;
      if (st === 0) {
        for (let k = 0; k < 5; k++) { const b = block(2.4, 2.4, 1.4, COL.noisy, [-9 + k * 4.5, 3.4, 0]); sub.add(b); Nz.push(b); }
        for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (i !== j) links.push(wire(sub, [[-9 + i * 4.5, 4.7, 0.7], [(-9 + i * 4.5 + -9 + j * 4.5) / 2, 6.6 + Math.abs(i - j) * 0.5, 0.7], [-9 + j * 4.5, 4.7, 0.7]], COL.noisy, { opacity: 0.4 }));
        sub.add(lab('Stage 0：整段片段，所有隐帧互相看（双向）', [0, 9.6, 0], { size: 17, border: 'rgba(107,119,148,.8)' }));
        sub.add(lab('式 (4)：‖v(x_τ, τ; 𝒞) − (ε − z)‖² / (C·T·H·W)，整段共用一个 τ', [0, -0.6, 0], { size: 15 }));
        sub.add(lab('产物：冻结的双向教师（Stage 3 用）+ 因果化的起点', [0, -2.0, 0], { size: 15, color: '#b8c4da' }));
        return;
      }
      for (let k = 0; k < 4; k++) {
        const x = -8 + k * 5.2;
        const c = block(2.2, 1.6, 1.2, COL.clean, [x, 6.6, 0]); sub.add(c); C.push(c);
        sub.add(lab(`𝒢${k + 1}ᶜ 干净`, [x, 8.1, 0], { size: 14 }));
        const kv = block(1.4, 1, 1.0, COL.kv, [x + 1.8, 6.1, 0], { opacity: 0.85 }); sub.add(kv); K.push(kv);
        const n = block(2.2, 1.6, 1.2, COL.noisy, [x, 1.4, 0]); sub.add(n); Nz.push(n);
        sub.add(lab(`𝒢${k + 1}ⁿ 带噪`, [x, -0.1, 0], { size: 14 }));
        const ls = [];
        for (let j = 0; j < k; j++) ls.push(wire(sub, [[-8 + j * 5.2 + 1.8, 5.4, 0.6], [x, 2.4, 0.6]], COL.kv, { opacity: 0.55 }));
        links.push(ls);
      }
      sub.add(lab('第 1 遍：干净参考，因果，逐层存 K/V', [-1, 10.2, 0], { size: 15, border: 'rgba(58,168,224,.8)' }));
      sub.add(lab('第 2 遍：带噪目标并行，只读严格更早的干净 K/V + 本块', [-1, -1.8, 0], { size: 15, border: 'rgba(240,150,60,.8)' }));
      sub.add(lab('式 (5)：逐块求和；控制和首帧不算损失', [-1, -3.6, 0], { size: 15 }));
    }
    rebuild();
    const ctls = [{ label: '阶段', items: ['Stage 0 双向', 'Stage 1 两遍 TF'], get: () => st, set: k => { st = k; } }];
    return { ctls, update(p) {
      if (last !== st) rebuild();
      if (st === 0) { const k = 0.3 + 0.4 * Math.sin(p * Math.PI * 4) ** 2; Nz.forEach(b => glow(b, k)); links.forEach(l => { l.material.opacity = 0.2 + 0.5 * seg(p, 0.1, 0.5); }); cap('<b>Stage 0</b>：双向注意力下适配领域和控制，用长片段让教师见过长历史'); return; }
      const a = seg(p, 0, 0.45), b = seg(p, 0.5, 0.9);
      K.forEach((kv, k) => { const on = clamp(a * 4 - k, 0, 1); kv.scale.y = Math.max(0.02, on * 2.2); kv.position.y = 5.4 + kv.scale.y / 2; glow(C[k], on * 0.6); });
      Nz.forEach((n, k) => glow(n, b * 0.7));
      links.forEach(ls => ls.forEach(l => { l.material.opacity = 0.1 + 0.6 * b; }));
      cap(p < 0.48 ? '<b>第 1 遍</b>：真实（参考）块按因果顺序前向，存下每层 K/V' : '<b>第 2 遍</b>：带噪块全部并行，读到本块的控制和严格更早的干净块；梯度穿过缓存');
    } };
  }

  /* ---------- scene 5: TF-dCM with live shift ---------- */
  function s5(G) {
    let ki = +(OPT[0] ?? 1); const KS = [3, 5, 10]; G.add(L.grid(48, 24));
    /* toy teacher trajectory in 2D: from noise (left) to data (right) */
    const traj = t => [-12 + 22 * (1 - t), 4.2 + 3.2 * Math.sin(Math.PI * (1 - t)) * (0.55 + 0.45 * t), 0];
    const pts = []; for (let i = 0; i <= 60; i++) pts.push(traj(1 - i / 60));
    G.add(L.tube(pts, COL.frozen, 0.06, {}));
    G.add(lab('噪声 τ = 1', [-12, 2.6, 0], { size: 15 })); G.add(lab('数据 τ = 0（终点）', [10, 2.6, 0], { size: 15 }));
    const xt = L.sphere(0.42, COL.white); G.add(xt); const xs = L.sphere(0.36, COL.noisy); G.add(xs);
    const end = L.sphere(0.5, COL.ok); end.position.set(...traj(0)); G.add(end);
    const a1 = new THREE.Group(), a2 = new THREE.Group(); G.add(a1, a2);
    const tick = inst(BOX, 49); G.add(tick); const ladder = inst(BOX, 4); G.add(ladder);
    G.add(lab('48 格时间网格（偏移后）', [-1, -1.2, 0], { size: 15 }));
    G.add(lab('推理 4 步', [-1, -4.4, 0], { size: 15, color: '#f5c08a' }));
    const tl = dynLab(G, [-1, 10.6, 0], { size: 16, border: 'rgba(56,209,255,.7)' });
    const ll = dynLab(G, [-1, -5.8, 0], { size: 14, color: '#f5c08a' });
    const X = t => -12 + 22 * (1 - t);
    const ctls = [{ label: '分辨率', items: ['256p κ=3', '480p κ=5', '720p κ=10'], get: () => ki, set: k => { ki = k; } }];
    return { ctls, update(p) {
      const k = KS[ki], u = 1 / 48 + (1 - 1 / 48) * (0.02 + 0.96 * ((p * 1.2) % 1)), tau = shiftK(u, k), s = shiftK(u - 1 / 48, k);
      xt.position.set(...traj(tau)); xs.position.set(...traj(s));
      L.clear(a1); L.clear(a2);
      const e1 = L.arrow(traj(tau), [traj(0)[0] - 0.6, traj(0)[1] + 0.3, 0], COL.white, { r: 0.05 }); a1.add(e1);
      const e2 = L.arrow(traj(s), [traj(0)[0] - 0.6, traj(0)[1] - 0.3, 0], COL.noisy, { r: 0.05 }); a2.add(e2);
      for (let i = 0; i <= 48; i++) { const t = shiftK(i / 48, k); setI(tick, i, [X(t), 0.2, 0], [0.08, 0.9, 0.08]); colI(tick, i, hex3(COL.kv)); } done(tick);
      const L4 = [1, 0.75, 0.5, 0.25].map(v => shiftK(v, k));
      L4.forEach((t, i) => { setI(ladder, i, [X(t), -3.0, 0], [0.3, 1.4, 0.3]); colI(ladder, i, hex3(COL.noisy)); }); done(ladder);
      tl(`κ = ${k}：u = ${f3(u)} → τ = ${f3(tau)}，s = S(u − 1/48) = ${f3(s)}，Δτ = ${f3(tau - s)}`);
      ll(`τ = ${L4.map(f3).join(' → ')} → 0`);
      cap('<b>TF-dCM</b>：教师从 x_τ 带 CFG 走一步 Euler 到 x̂_s；学生从两点预测的终点必须一致（目标停梯度）');
    } };
  }

  /* ---------- scene 6: SF-DMD rollout ---------- */
  function s6(G) {
    let ex = +(OPT[0] ?? 0); G.add(L.grid(52, 26)); const TL = [1, 15 / 16, 5 / 6, 5 / 8, 0];
    const NB = 5, xs = k => -12 + k * 5.4, hist = [], bars = [], gr = [];
    for (let k = 0; k < NB; k++) {
      const h = block(2.6, 1.8, 1.4, COL.noisy, [xs(k), 1.2, 0]); G.add(h); hist.push(h);
      G.add(lab(`块 ${k + 1}`, [xs(k), -0.4, 1.0], { size: 14 }));
      bars.push(vbar(G, xs(k) + 1.9, 0.2, 0.5, COL.sink));
      const g = L.arrow([xs(k) + 1.9, 5.3, 0.4], [xs(k) + 1.9, 3.3, 0.4], COL.bad, { r: 0.06 }); g.visible = false; G.add(g); gr.push(g);
    }
    G.add(lab('噪声水平（柱高）：1 → 15/16 → 5/6 → 5/8 → 0；红箭头 = 唯一求导的最后一步', [0, -2.0, 0], { size: 15 }));
    const tea = block(5.6, 1.6, 1.6, COL.frozen, [-5, 9.4, 0]), fake = block(5.6, 1.6, 1.6, COL.ok, [5, 9.4, 0]); G.add(tea, fake);
    G.add(lab('f_ψ：Stage 0 双向教师（冻结）', [-5, 11.2, 0], { size: 15 })); G.add(lab('f_φ：fake score（可训练）', [5, 11.2, 0], { size: 15 }));
    G.add(lab('g = (f_φ − f_ψ) / (ρ + 10⁻⁶)', [0, 7.4, 0], { size: 16, border: 'rgba(224,93,93,.8)' }));
    const cnt = dynLab(G, [-14.5, 9.4, 0], { size: 15, border: 'rgba(242,193,78,.8)' });
    const sc = stream(G, 10, COL.kv, 0.12);
    const ctls = [{ label: '退出策略', items: ['max（4 步）', 'cycle（1–4 轮换）'], get: () => ex, set: k => { ex = k; } }];
    return { ctls, update(p) {
      const r = seg(p, 0, 0.72) * NB;
      for (let k = 0; k < NB; k++) {
        const steps = ex === 0 ? 4 : [4, 1, 2, 3, 4][k];
        const sched = steps === 4 ? TL : [1, ...[0.75, 0.5, 0.25].slice(4 - steps).map(v => shiftK(v, 5)), 0].slice(-(steps + 1));
        const f = clamp(r - k, 0, 1), si = Math.min(steps, Math.floor(f * (steps + 0.999)));
        const lvl = f >= 1 ? 0 : sched[Math.min(si, sched.length - 1)];
        bars[k](f > 0 ? lvl * 3.0 + 0.05 : 3.05);
        recolor(hist[k], f >= 1 ? COL.clean : COL.noisy); glow(hist[k], f > 0 && f < 1 ? 0.7 : 0.15);
        gr[k].visible = f > 0 && (f >= 1 || si >= steps - 1);
      }
      const s2 = seg(p, 0.72, 1);
      glow(tea, s2 * 0.7); glow(fake, s2 * 0.7);
      sc([[xs(0), 2.4, 0.8], [0, 6, 0.8], [-5, 8.6, 0.8]], (p * 2) % 1, s2 > 0 ? 1 : 0);
      const it = Math.round(1380 * p), stu = Math.floor(it / 6);
      cnt(`更新计数（1:5）\n学生 ${stu} · fake ${it - stu}\n合计 ${it} / 1,380`);
      cap(p < 0.72 ? '<b>rollout</b>：每块按自己的历史去噪，完成后进缓存；前面的去噪步和历史都停梯度' : '<b>打分</b>：两个双向打分模型看整段 rollout，差值推学生；fake score 每轮多更新 5 次');
    } };
  }

  /* ---------- scene 7: streaming cache ---------- */
  function s7(G) {
    let m = +(OPT[0] ?? 0);
    const CFG = [
      { n: 'Bimanual', W: 64, S: 8, C: 2, fps: 30, note: '64 / sink 8，每块 2 隐帧' },
      { n: 'Sim-Transfer', W: 30, S: 3, C: 1, fps: 30, note: '30 / sink 3，每块 1 隐帧' },
      { n: 'Sim-Auto', W: 9, S: 3, C: 3, fps: 30, note: '2 块（sink 1 块 + 最近 1 块），每块 3 隐帧' }
    ];
    G.add(L.grid(52, 26));
    const MAX = 160, im = inst(BOX, MAX); G.add(im);
    const info = dynLab(G, [0, 8.6, 0], { size: 16, border: 'rgba(56,209,255,.7)' });
    const info2 = dynLab(G, [0, -3.2, 0], { size: 15 });
    G.add(lab('金 = sink · 蓝 = 窗口内历史 · 橙 = 当前块 · 灰 = 被淘汰', [0, 10.4, 0], { size: 14, color: '#b8c4da' }));
    const ctls = [{ label: '模型', items: CFG.map(c => c.n), get: () => m, set: k => { m = k; } }];
    return { ctls, update(p) {
      const c = CFG[m], total = Math.min(MAX - c.C, Math.max(c.W + 24, 3 * c.W)), gen = Math.min(total, Math.floor(seg(p, 0, 0.9) * total / c.C) * c.C + c.S);
      const cur0 = gen, cur1 = gen + c.C;
      const shown = Math.min(MAX, total + c.C), w = Math.min(0.62, 30 / shown), x0 = -shown * w / 2;
      for (let i = 0; i < MAX; i++) {
        if (i >= shown) { setI(im, i, [0, -50, 0], 0.001); continue; }
        let col = COL.evict, y = 2.4, s = [w * 0.86, 1.4, 0.8];
        if (i < c.S) col = COL.sink;
        else if (i >= cur0 && i < cur1) { col = COL.noisy; y = 3.4; }
        else if (i < cur0 && i >= cur0 - (c.W - c.S - c.C)) col = COL.clean;
        else if (i < cur0) { col = COL.evict; y = 0.4; s = [w * 0.86, 0.6, 0.5]; }
        else { s = [w * 0.86, 0.2, 0.2]; col = 0x2a3142; }
        setI(im, i, [x0 + i * w, y, 0], s); colI(im, i, hex3(col));
      }
      done(im);
      const recent = c.W - c.S - c.C, sec = recent * 4 / c.fps;
      info(`${c.n}：${c.note}`);
      info2(m === 2 ? `近期历史 = 1 块 = 0.4 s；sink 是开头 1 块；长时一致性靠 WSM 控制` : `近期历史约 ${recent} 个隐帧 ≈ ${sec.toFixed(1)} s（30 FPS）；sink 是开头 ${c.S} 个隐帧`);
      cap('<b>有界历史</b>：窗口满后 K/V 形状固定，可以静态编译和 CUDA Graph；被淘汰的帧时间戳不重编号');
    } };
  }

  /* ---------- scene 8: per-chunk time budget ---------- */
  function s8(G) {
    let view = +(OPT[0] ?? 0); G.add(L.grid(52, 26));
    const ROWS = [
      { n: 'Bimanual · 1 GB300', phys: 267, parts: [[0, COL.lang], [89, COL.noisy], [69, COL.kv], [4.4, COL.dec], [4.6, COL.other]] },
      { n: 'Sim-Transfer · 1 GB200（有界编译）', phys: 133.3, parts: [[33.6, COL.lang], [127.1, COL.noisy], [35.3, COL.kv], [42.3, COL.dec], [2.1, COL.other]] },
      { n: 'Sim-Auto 1 相机 · 1 GB200', phys: 400, parts: [[141, COL.lang], [126, COL.noisy], [79, COL.kv], [0, COL.dec], [17, COL.other]] },
      { n: 'Sim-Auto 7 相机 · 16 GB200', phys: 400, parts: [[134, COL.lang], [284, COL.noisy], [154, COL.kv], [0, COL.dec], [16, COL.other]] }
    ];
    const segs = [], marks = [], rts = [];
    ROWS.forEach((r, i) => {
      const y = 8 - i * 3.0; G.add(lab(r.n, [-6, y + 1.2, 0], { size: 14 }));
      segs.push(r.parts.map(([, c]) => { const b = block(1, 1.1, 1.0, c, [0, y, 0], { edges: false }); G.add(b); return b; }));
      const mk = block(0.22, 2.2, 1.4, COL.bad, [0, y, 0], { edges: false }); G.add(mk); marks.push(mk);
      rts.push(dynLab(G, [15.5, y, 0], { size: 14 }));
    });
    G.add(lab('紫 控制准备 · 橙 去噪 · 青 K/V 刷新 · 粉 解码 · 灰 其他 · 红线 = 一块的物理时长', [0, -4.4, 0], { size: 14, color: '#b8c4da' }));
    const ctls = [{ label: '横轴', items: ['毫秒', '÷ 物理时长（RTF）'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      const g = seg(p, 0, 0.6);
      ROWS.forEach((r, i) => {
        const y = 8 - i * 3.0, tot = r.parts.reduce((a, b) => a + b[0], 0), sc = view === 0 ? 0.04 : 14 / r.phys;
        let x = -13;
        r.parts.forEach(([v], j) => { const w = Math.max(0.001, v * sc * g); segs[i][j].scale.x = w; segs[i][j].position.set(x + w / 2, y, 0); x += w; });
        marks[i].position.x = -13 + r.phys * sc;
        rts[i](`${Math.round(tot)} ms · RTF ${f2(tot / r.phys)}`);
      });
      cap(view === 0 ? '<b>每块墙钟时间</b>：去噪之外，K/V 刷新和控制准备同样大' : '<b>相对物理时长</b>：越过红线就跟不上 30 FPS；Sim-Transfer 和 7 相机驾驶都越过了');
    } };
  }

  /* ---------- scene 9: 59-D action and timing ---------- */
  function s9(G) {
    let dom = +(OPT[0] ?? 1); G.add(L.grid(52, 26));
    const groups = [['自身位姿', 9, 0], ['右手腕', 9, 1], ['右指尖 ×5', 15, 2], ['右夹爪', 1, 3], ['左手腕', 9, 1], ['左指尖 ×5', 15, 2], ['左夹爪', 1, 3], ['补零', 5, 4]];
    const MASK = [[1, 0, 0, 0, 0], [1, 1, 0, 1, 0], [1, 1, 1, 0, 0]];
    const im = inst(BOX, 64); G.add(im); const pos = []; let c = 0;
    groups.forEach(([t, n, kind], gi) => { const y0 = 9.5 - gi * 1.45; G.add(lab(`${t}（${n}）`, [-15.5, y0, 0], { size: 13 })); for (let i = 0; i < n; i++) { pos.push([-11.5 + (i % 15) * 0.42, y0 - Math.floor(i / 15) * 0.42, 0, kind]); c++; } });
    G.add(lab('9 + (24 + 1) + (24 + 1) = 59，再补 5 个零 = 64', [-8.5, -2.6, 0], { size: 14, border: 'rgba(79,201,138,.7)' }));
    /* timeline */
    const FR = 33, tim = inst(BOX, FR), lt = inst(BOX, 9); G.add(tim, lt);
    for (let f = 0; f < FR; f++) { setI(tim, f, [-1 + f * 0.5, 6.0, 0], [0.4, 0.8, 0.2]); colI(tim, f, f === 0 ? hex3(COL.clean) : hex3(COL.white)); } done(tim);
    for (let k = 0; k < 9; k++) { const x = k === 0 ? -1 : -1 + (4 * k - 1.5) * 0.5; setI(lt, k, [x, 3.6, 0], [k === 0 ? 0.5 : 1.8, 1.0, 0.6]); colI(lt, k, k === 0 ? hex3(COL.clean) : hex3(COL.noisy)); } done(lt);
    G.add(lab('RGB 帧（30 FPS）', [6.5, 8.7, 0], { size: 14 })); G.add(lab('隐帧：首帧 1 个，之后每 4 帧 1 个', [6.5, 2.2, 0], { size: 14 }));
    for (let b = 0; b < 4; b++) { const x0 = -1 + (1 + 8 * b) * 0.5 - 0.3, x1 = x0 + 8 * 0.5 - 0.1; G.add(L.line([[x0, 2.9, 0.5], [x1, 2.9, 0.5], [x1, 4.3, 0.5], [x0, 4.3, 0.5], [x0, 2.9, 0.5]], COL.sink, { opacity: 0.85 })); }
    for (let a = 0; a < 2; a++) { const x0 = -1 + (1 + 16 * a) * 0.5 - 0.2, x1 = x0 + 16 * 0.5 - 0.1; G.add(L.line([[x0, 7.0, 0], [x0, 7.5, 0], [x1, 7.5, 0], [x1, 7.0, 0]], COL.lang, { opacity: 0.9 })); }
    G.add(lab('黄框 = 1 块 = 2 隐帧 = 8 帧；紫括号 = 16 帧位姿锚点', [7, 0.8, 0], { size: 14, color: '#f2c14e' }));
    const play = L.sphere(0.3, COL.sink); G.add(play);
    const ctls = [{ label: '数据域', items: ['相机位姿', 'AgiBot 双臂', '人手（Mecka）'], get: () => dom, set: k => { dom = k; } }];
    return { ctls, update(p) {
      pos.forEach(([x, y, z, kind], i) => { const on = MASK[dom][kind]; setI(im, i, [x, y, z], [0.36, 0.36, on ? 0.5 : 0.12]); colI(im, i, kind === 4 ? hex3(COL.evict) : on ? hex3(COL.ctl) : hex3(0x2a3142)); }); done(im);
      const f = 1 + Math.floor(p * 31.99); play.position.set(-1 + f * 0.5, 5.0, 0.4);
      const ch = Math.ceil(f / 8);
      cap(`<b>${['相机导航', '双臂操作', '人手交互'][dom]}</b>：第 ${f} 帧属于第 ${Math.ceil(f / 4)} 个隐帧、第 ${ch} 块；这一块的 8 个动作必须先到齐才能开始去噪`);
    } };
  }

  /* ---------- scene 10: Sim-Transfer closed loop ---------- */
  function s10(G) {
    let view = +(OPT[0] ?? 0); G.add(L.grid(52, 26)); const sub = new THREE.Group(); G.add(sub);
    const nodes = [['Isaac Lab 物理\n240 Hz', [-14, 8, 0], COL.frozen], ['深度控制\n每 4 个动作（7.5 Hz）', [-6, 8, 0], COL.ctl], ['Sim-Transfer\n4 帧 RGB / 次', [-6, 1.5, 0], COL.gen], ['GR00T N1.7\n16 个动作 / 次', [-14, 1.5, 0], COL.noisy]];
    const NB = nodes.map(([t, p, c]) => { const b = block(4.4, 2.0, 1.8, c, p, { opacity: 0.92 }); G.add(b); G.add(lab(t, [p[0], p[1] + 2.1, 0], { size: 14 })); return b; });
    const loop = stream(G, 16, COL.white, 0.13);
    const STEPS = ['5k', '10k', '15k', '20k', '30k', '40k'], RTX = [17, 16, 22, 24, 18, 17], TR = [20, 12, 27, 21, 18, 19];
    const C9 = [[13, 4, 7, 8], [10, 6, 2, 14], [20, 2, 7, 3], [17, 7, 4, 4], [13, 5, 5, 9], [13, 4, 6, 9]];
    let last = -1, B = [];
    function rebuild() {
      clearSub(sub); B = []; last = view;
      if (view === 0) {
        STEPS.forEach((s, i) => { const x = 2.5 + i * 2.4; B.push([vbar(sub, x - 0.45, 0, 0.8, COL.frozen), RTX[i]]); B.push([vbar(sub, x + 0.45, 0, 0.8, COL.gen), TR[i]]); sub.add(lab(s, [x, -0.9, 1], { size: 13 })); sub.add(lab(`${RTX[i]}/${TR[i]}`, [x, i % 2 ? 10.6 : 9.4, 0], { size: 12 })); });
        sub.add(lab('灰 Isaac RTX · 紫 Sim-Transfer（成功数 / 32）', [8.5, 12.2, 0], { size: 14 }));
        const pr = RTX.reduce((a, b) => a + b, 0), pt = TR.reduce((a, b) => a + b, 0), dr = C9.reduce((a, r) => a + r[1], 0), dt = C9.reduce((a, r) => a + r[2], 0);
        sub.add(lab(`合计 ${pr}/192 对 ${pt}/192；不一致 ${dr} 对 ${dt}，p = ${f2(signP(dr, dt))}`, [8.5, -3.0, 0], { size: 14, border: 'rgba(56,209,255,.7)' }));
      } else {
        const r = C9[2], names = ['两者都成功', '仅 RTX', '仅 Sim-Transfer', '两者都失败'], cols = [COL.ok, COL.frozen, COL.gen, COL.bad];
        r.forEach((v, i) => { const x = 3.5 + i * 3.2; B.push([vbar(sub, x, 0, 1.4, cols[i]), v]); sub.add(lab(names[i], [x, -0.9, 1], { size: 13 })); sub.add(lab(String(v), [x, 9.6, 0], { size: 14 })); });
        sub.add(lab(`15,000 步配对：不一致 ${r[1]} 对 ${r[2]}，精确符号检验 p = ${f2(signP(r[1], r[2]))}`, [8.5, -3.0, 0], { size: 14, border: 'rgba(56,209,255,.7)' }));
        sub.add(lab('提示词在这 32 个起点和这个策略上校准过', [8.5, 11.2, 0], { size: 14, color: '#f5c08a' }));
      }
    }
    rebuild();
    const ctls = [{ label: '结果', items: ['表 9(b) 六个检查点', '表 C.9 配对（15k）'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const g = seg(p, 0.2, 0.7); B.forEach(([f, v]) => f(v / 32 * 8 * g));
      loop([[-14, 8, 1.2], [-6, 8, 1.2], [-6, 1.5, 1.2], [-14, 1.5, 1.2], [-14, 8, 1.2]], (p * 1.5) % 1, 1);
      const ph = Math.floor((p * 1.5 % 1) * 4); NB.forEach((b, i) => glow(b, i === ph ? 0.7 : 0.1));
      const t = (p * 16 * 4) % 16;
      cap(`<b>闭环</b>：一次决策 16 个动作 = ${f3(16 / 30)} s 仿真时间 = 4 次渲染；当前第 ${Math.floor(t) + 1} 个动作，第 ${Math.floor(t / 4) + 1} 次渲染`);
    } };
  }

  /* ---------- scene 11: Sim-Auto multi-sensor timeline ---------- */
  function s11(G) {
    let vi = +(OPT[0] ?? 2); const NV = [1, 4, 7, 11], FPSM = { 1: '32.6 FPS（1 GB200）', 4: '28.9 FPS（16 GB200）', 7: '23.2 FPS（32 GB200）；加 LiDAR 16.7（16 卡）', 11: '论文没有 11 相机的运行时间' };
    G.add(L.grid(52, 26));
    const T = 1.6, X = t => -16 + t * 13.5, cam = inst(BOX, 49), lat = inst(BOX, 13), li = inst(BOX, 17); G.add(cam, lat, li);
    for (let i = 0; i <= 48; i++) { setI(cam, i, [X(i / 30), 7.5, 0], [0.1, 0.8, 0.1]); colI(cam, i, hex3(COL.white)); } done(cam);
    for (let i = 0; i <= 12; i++) { setI(lat, i, [X(i * 4 / 30), 4.5, 0], [0.5, 0.9, 0.5]); colI(lat, i, hex3(COL.clean)); } done(lat);
    for (let i = 0; i <= 16; i++) { setI(li, i, [X(i / 10), 1.5, 0], [0.4, 0.9, 0.4]); colI(li, i, hex3(COL.lidar)); } done(li);
    G.add(lab('相机帧 30 FPS', [X(0.3), 8.9, 0], { size: 13 })); G.add(lab('相机隐帧 7.5 Hz', [X(0.3), 5.8, 0], { size: 13 })); G.add(lab('LiDAR 10 Hz', [X(0.3), 2.8, 0], { size: 13 }));
    [0, 0.4, 0.8, 1.2, 1.6].forEach(t => { G.add(L.line([[X(t), 0.4, 0.3], [X(t), 8.6, 0.3]], COL.sink, { opacity: 0.6, dashed: true })); G.add(lab(`${t.toFixed(1)} s`, [X(t), -0.2, 0], { size: 12 })); });
    const band = block(1, 7.6, 0.2, COL.noisy, [0, 4.5, -0.3], { opacity: 0.25, edges: false }); G.add(band);
    const q = L.sphere(0.35, COL.noisy); G.add(q);
    const r1 = dynLab(G, [-5, -2.2, 0], { size: 14, border: 'rgba(56,209,255,.7)' }), r2 = dynLab(G, [-5, -3.9, 0], { size: 14 }), r3 = dynLab(G, [-5, -6.0, 0], { size: 14 });
    const ctls = [{ label: '相机数', items: NV.map(String), get: () => vi, set: k => { vi = k; } }];
    return { ctls, update(p) {
      const tq = 0.4 + p * 1.2, w = Math.min(0.4, tq);
      band.scale.x = w * 13.5; band.position.x = X(tq - w / 2); q.position.set(X(tq), 4.5, 0.6);
      const n = NV[vi], Nt = 100, ideal = n * Nt / (n + Nt), win = n * Nt / (Nt + 4 * n), tok = 390 * 3 * n + 4 * 904;
      r1(`Nv = ${n}：理想节省 ${n === 1 ? '—（单视角无跨视角项）' : ideal.toFixed(1) + ' 倍'}`);
      r2(n === 1 ? '0.4 s 窗口：—' : `按 0.4 s 窗口（约 4 个时刻）：${win.toFixed(1)} 倍`);
      r3(`每块 token ≈ ${fmt(tok)}（832 × 480）\n${FPSM[n]}`);
      cap(`<b>跨传感器窗口</b>：查询时刻 ${tq.toFixed(2)} s 只看 [${(tq - 0.4).toFixed(2)}, ${tq.toFixed(2)}] s 内其他传感器；一块 = 0.4 s = 3 个相机隐帧 + 4 帧 LiDAR`);
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
    const sc = SCENES[cur], cam = document.body.classList.contains('embed') && sc.camE ? sc.camE : sc.cam; fly(...cam); refDist = cam[2] * aspectFix();
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
  window.__ciDebug = { get cap() { return $('cap').textContent; } };
})();
