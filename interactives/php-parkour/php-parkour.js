'use strict';
/* PHP (arXiv 2602.15827v2) taken apart into eleven animated scenes. Numbers come from the paper (Tables I-VI, Eqs. 1-5)
   and from the official code at commit c7c9ce3 with holosoma 4a0bf04 (read, not run). Each scene's update(p) is a pure
   function of the timeline p plus the current toggles. The humanoid is hand-made. Scenes 3, 4, 5, 6, 7 and 8 compute
   their numbers live (nearest-neighbour search on a toy feature space, Eq. 5 spring, box variants, height scan, a
   58x87 ray-cast depth image, the loss schedule); toys are labelled. No PHP network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { mm: 0xf2c14e, teach: 0x9fb07a, stud: 0x4fc98a, real: 0xff7a59, loco: 0x7cb8ff, skill: 0xf0963c, entry: 0xff5fa2, ref: 0xe05d5d, robot: 0xc9d4ea,
    box: 0x8a6a4a, boxT: 0xb08a5e, dim: 0x46506a, white: 0xeef2fa, ok: 0x4fc98a, bad: 0xe05d5d, cam: 0x38d1ff, purple: 0x9d8cff, gold: 0xf2c14e, human: 0xffa86b };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;

  const SCENES = [
    { n: 1, part: '总览', title: '三段训练，一次零样本上真机', sub: '图 2 的 3D 版：技能组合 → 教师 → 学生 → 真机', dur: 14, cam: [0.1, 1.05, 26, [0, 1.6, 0]],
      html: dl([['(a) 技能组合', 'motion matching 把走跑和原子技能拼成长参考 + 配对地形'], ['(b) 教师', '每个技能一个 PPO 跟踪专家，特权观测 + 高度扫描'], ['(c) 学生', 'DAgger + PPO 蒸馏，只看本体、深度图、速度命令'], ['(d) 真机', 'Unitree G1，D435i 深度，零样本']]) +
        '<p>三段依次进行：(a) 的长参考是 (b) 的跟踪目标；(b) 训好的多个教师在 (c) 里冻结，只当 DAgger 的标签源；(c) 导出两个 ONNX（深度骨干和学生）上 (d)。</p>' +
        '<p>点画面里的方块可以跳到对应那一幕。</p>' + src('§III-A · 图 2 · 代码 README') },
    { n: 2, part: '§III-B · 附录 B1', title: '原子技能库：几秒长的人体片段', sub: '柱子是表 III 的时长；切换看代码里注册的技能', dur: 12, cam: [0.0, 1.1, 21, [0.4, 2.2, 0]],
      html: dl([['走跑', '495.5 s，覆盖 0.8–3.5 m/s'], ['跑酷片段', '12 项，合计 66.2 s（我的加总）'], ['重定向', 'OmniRetarget → 29 自由度 G1'], ['镜像', '所有片段镜像扩充（附录 A1）']]) +
        '<p>每个跑酷技能只有一两段动捕，每段几秒。最长的 Climb 58 cm @1 m/s 也只有 12.1 s。左边的人形（橙）到右边的 G1（灰）就是重定向；虚线框里是镜像副本。</p>' +
        '<p>代码的技能注册表比表 III 多：翻滚（78、90、136 cm）、跳下 92 cm、跨栏、跳 35 cm，攀爬最高的叫 climb_134（箱顶 1.34 m），而表 III 写 125 cm。</p>' +
        guess('人形是手工的。柱高按时长线性画，走跑那根截断并标注真实值。') + src('附录 B1 表 III · skill_registry.py') },
    { n: 3, part: '§III-B1 式 (1)', title: '最近邻检索：在搜索窗口里找最像的一帧', sub: '这一幕是核心。切换搜索窗口 𝒞_t，最近邻当场算', dur: 16, cam: [0.0, 1.12, 10, [1.6, 0, 0.4]],
      html: dl([['式 (1)', 'i* = argmin_{i∈𝒞_t} ‖x̂_t − x_i‖²'], ['x_i', '27 维：未来轨迹 12 + 脚 12 + 根速度 3'], ['𝒞_t', '走跑时 = 𝒟_loco；要进技能 k 时 = 𝓔_k'], ['式 (2)', '𝓔_k = [s_k − H_k, s_k]'], ['检索周期', '代码 0.1 s（60 FPS 下 6 帧）']]) +
        '<p>蓝色点是走跑库里的帧，在特征空间里沿几个步态环分布（不同速度一圈）。橙色是一个技能片段，粉色那段是它的进入窗口 𝓔_k：起跳前最后几步，看起来仍像跑步。</p>' +
        '<p>白点是查询 x̂_t：当前脚状态、根速度，加上由速度命令推出的未来轨迹。每隔一个检索周期找一次最近邻，播放头跳过去接着放。切到“进入窗口”，搜索只在粉色段里进行，于是从不同的步态相位都能找到一个最接近的入口帧，这就是“过渡密度”。</p>' +
        '<p>代码里距离是加权、按类标准化的：脚位置 0.75、脚速度 1.0、髋速度 1.0、轨迹位置 1.0、轨迹朝向 1.5。</p>' +
        toyb('27 维压成 2 维画。点的位置、环的半径、技能片段的形状和查询的路径都是我设的（固定种子）；最近邻是在这些 2 维点上当场算的。') +
        src('§III-B1-2 式 (1)(2) · features.py:360-366 · run.py:269') },
    { n: 4, part: '附录 A2 式 (4)(5)', title: '速度命令怎样变成未来轨迹：临界阻尼弹簧', sub: '按式 (5) 当场算 0.33 / 0.67 / 1.0 s 后的位置；切换速度档和半衰期', dur: 16, cam: [0.0, 0.78, 9.5, [0, 0, 0.8]],
      html: dl([['式 (4)', 's(τ) = e^{−yτ}(j₀ + τ j₁) + s_goal'], ['式 (5)', '把速度弹簧积分得到 p(τ)'], ['y', '= 2 ln2 / 半衰期；代码半衰期 0.27 s → y ≈ 5.13 s⁻¹'], ['未来时刻', 'τ = 0.33, 0.67, 1.0 s'], ['底部时间轴', '站立 → 走跑 → 𝓔_k → 技能回放 → 走跑 2 s → 站立']]) +
        '<p>查询特征里的“未来轨迹”不是从数据库里取的，而是由命令现算的：把当前速度当弹簧的位置，目标是命令速度，按式 (4) 衰减；积分一次就是式 (5) 的位置。朝向同理，直接用式 (4)。</p>' +
        '<p>三个黄点就是 p(0.33)、p(0.67)、p(1.0)，白色细线是从当前时刻起逐步积出来的完整预测。命令一变，预测立刻转向，但真实速度要过约一个半衰期才跟上。</p>' +
        '<p>底部时间轴是一条训练轨迹的结构：进入技能后关掉匹配，只推进播放下标；技能结束后回到走跑，再走 2 s 停下。</p>' +
        guess('命令序列（直行、左 45°、右 90°、直行）和时间点是我设的。弹簧公式和 y 按代码当场算。') +
        src('附录 A2 式 (4)(5) · animation_state.py:487-514 · run.py:289') },
    { n: 5, part: '§III-B2 地形', title: '地形配对和随机化', sub: '每段技能配一个箱子；入口距离决定领先腿；切换论文 ±45° 和代码 ±180° 偏航', dur: 14, cam: [0.3, 0.98, 11.5, [1.4, 0.3, -0.4]],
      html: dl([['放箱子', '把入口帧处“地形相对根”的偏移套到当前根位姿'], ['宽度', '最小值到 1.5 m（代码每侧 ≤ 0.75 m，10 个变体）'], ['其他尺寸', '±5 cm（代码另加逐点 ±2 cm）'], ['偏航', '论文 ±45°；代码建网格时 U(−π, π)'], ['干扰物', '代码：每隔一条走跑配置放 5–15 个箱子']]) +
        '<p>图 3(a)：同一个翻越技能，从 4.8 m 起跑和从 3.9 m 起跑，motion matching 选出的步幅序列不同，入口时一个右腿领先、一个左腿领先。下面两条轨迹的脚印按固定步长当场数出来，领先腿随之切换。</p>' +
        '<p>右边的箱子每隔一段换一个变体。切到“代码 ±180°”可以看到，按代码的偏航范围，箱子可能横过来。它是否作用在主障碍上我没跑代码，未核实。</p>' +
        toyb('步长 0.9 m、起跳前 0.5 m 是我设的，只为说明奇偶性；箱子的原始尺寸取 climb_76 的量级。变体按固定种子抽样。') +
        src('§III-B2 · 图 3 · data_utils.py:200-252 · obstacle_helpers.py:233, 256-279, 312 · builtin.py:103-116') },
    { n: 6, part: '§III-C1 教师', title: '教师：跟踪参考，看得到全局位置和地形', sub: '红色半透明是参考；切换高度扫描：论文 0.7 m 和代码 1.6 m', dur: 14, cam: [0.75, 1.02, 7.5, [0.6, 0.6, 0]],
      html: dl([['观测', '参考关节 + 锚点误差 + 速度 + 关节 + 上一动作 + 高度扫描'], ['特权', '全局位置、速度（让专家能纠漂）'], ['高度扫描', '论文 0.7 × 0.7 m；代码 1.6 × 1.6 m、0.1 m 间距、289 点'], ['奖励', '表 IV：6 个跟踪项 + 3 个正则（同 BeyondMimic）'], ['终止', '锚点误差 > 0.5 m；朝向 > 0.8；踝腕 > 0.5 m（代码）'], ['动作', 'PD 目标，缩放 1']]) +
        '<p>参考动作和地形绑在一起，漂一点就可能撞箱子，所以专家要知道自己在全局的哪里。真机上没有这些量，学生只能从深度图里推。</p>' +
        '<p>高度扫描点的颜色是当场按箱子几何算的高度。论文的 0.7 m 方块几乎只看脚下；代码的 1.6 m 能看到前方约 0.8 m。</p>' +
        '<p>锚点在论文里是骨盆，代码默认是躯干（torso_link）。圆圈是 0.5 m 的终止半径。</p>' +
        guess('攀爬动作是手写的；论文没给 0.7 m 方块的间距，我按代码的 0.1 m 画成 8 × 8。') +
        src('§III-C1 · 表 IV · terrain.py:115-158, 289-337 · holosoma isaacsim.py:469') },
    { n: 7, part: '§III-C2 学生', title: '学生看到的深度图，和处理它的网络', sub: '58 × 87 深度图当场光线投射；切换干净 / 加噪声', dur: 15, cam: [0.22, 1.1, 13.5, [3.6, 1.5, -0.6]],
      html: dl([['相机', 'D435i，装在 torso_link 上，俯仰 27°，水平视场 89.5°，0.3–3 m'], ['深度骨干', 'Conv 16/32/64（步长 2）+ GAP + Linear → 32'], ['本体', '重力 3 + 角速度 3 + 关节 29 + 29 + 上一动作 29 + 命令 15 = 108'], ['学生 MLP', '140 → 2048 → 1024 → 512 → 256 → 128 → 29'], ['参数', '骨干 25,632；MLP 3,079,709（发布的 ONNX）'], ['延迟', '3–4 帧 = 60–80 ms']]) +
        '<p>左边机器人边走边接近一个 76 cm 的箱子，右边面板是它此刻的深度图，越近越亮。图是用相机配置当场逐像素求光线和箱子、地面的交点算出来的。</p>' +
        '<p>“加噪声”按代码：每像素 3 cm 高斯、每个环境一个 3 cm 标准差的整体偏置、Perlin 打洞（这里用随机方块代替）。论文特意不加高斯模糊，因为高速时会把障碍糊掉。</p>' +
        guess('相机高度按 torso_link 约 0.8 m 加偏移 0.44 m 估成 1.24 m；视场按 58 × 87 直接投射，没有模拟裁边和缩放。打洞形状是示意。') +
        src('§III-C2 · 附录 B3 · 表 VI · d435i_depth_config.py · depth.py · depth_backbone.py:50-80 · student.onnx') },
    { n: 8, part: '§III-C2 式 (3) 课程', title: 'DAgger + PPO：权重怎样随迭代转移', sub: '曲线当场画；切换论文和代码', dur: 15, cam: [0.0, 1.38, 18, [-0.4, 2.7, 0]],
      html: dl([['式 (3)', 'L = λ_PPO L_PPO + λ_D L_D，λ_PPO + λ_D = 1'], ['λ_D(k)', 'max(0.1, 1 − k / (K/2))'], ['终止阈值', '0.5 m → 1.0 m，同一线性日程'], ['自适应 lr / KL', '只在 λ_PPO > 0.1 时开（k > 1000）'], ['代码', 'K = 30,000；门控 g ∈ [0.5, 1]；值损失全程；DAgger × 10']]) +
        '<p>为什么要 PPO：左下的小图里，两种动作让根部比参考高或低同样多，对 DAgger 的均方损失完全一样，但只有高的那条翻得过去。PPO 看结果，所以偏向高的那条。</p>' +
        '<p>为什么放宽终止：很多技能可以镜像着做（换领先腿），参考只给了一种，学生用另一种完成时跟踪误差很大，会被错误终止，给 PPO 一个假的失败信号。</p>' +
        '<p>切到“代码”：曲线拉长到 30,000 次，终止放宽从第 1000 次才开始；灰色带是逐样本门控 g·λ_PPO 的范围（g 在 0.5 到 1 之间）。</p>' +
        toyb('左下小图的箱高、偏差和轨迹形状是我设的；均方损失当场算。') +
        src('§III-C2 · 表 VI · distillation_ppo.py:369-391, 636-638, 690-695 · depth_distillation.py:163-177, 216-260') },
    { n: 9, part: '§IV-A2 多技能', title: '一个策略，看到什么障碍就做什么', sub: '训练时只有单障碍；切换“挪动障碍 0.5 m”', dur: 18, cam: [0.42, 1.02, 10.5, [1.5, 0.6, 0]],
      html: dl([['命令', '只有离散速度方向（15 维 one-hot，用 12 个）'], ['选技能', '学生自己根据深度图决定'], ['训练数据', '只有单障碍穿越的“走跑 → 技能 → 走跑”'], ['图 5(c)', '48 s 路线，中途把障碍挪约 0.5 m'], ['路由', '训练时每个环境属于一个专家；DAgger 标签来自它']]) +
        '<p>多障碍路线不在训练数据里，能连起来是因为每条训练轨迹都经过共享的走跑段，学生在走跑时就看得到下一个障碍。</p>' +
        '<p>顶部的标签是“此刻在训练里对应哪个专家”。部署时没有这个标签，学生只看深度图和命令。</p>' +
        guess('路线、障碍高度和机器人的动作是我编排的，只为说明流程；不是图 5 的真实路线。') +
        src('§IV-A2 · 图 5(c) · motion_command.py:672-750') },
    { n: 10, part: 'DEPLOY.md', title: '部署管线：深度图到关节目标', sub: '切换 MuJoCo sim2sim 和真机（真机部分 PHP 仓库没写，标示意）', dur: 13, cam: [0.0, 0.98, 20, [0, 1.2, 1.4]],
      html: dl([['相机', 'D435i，机载 30 Hz'], ['共享内存', 'depth_img_shm，(1,1,58,87) float32 = 20,184 字节'], ['ONNX', 'depth_backbone.onnx → 32；student.onnx（140 → 29）'], ['命令', 'w/s 前后，a/d 45°，q/e 90°，= 切换快慢'], ['仿真', 'MuJoCo 500 Hz，G1 半球手模型']]) +
        '<p>sim2sim 时两个进程：run_php_sim.sh 跑 MuJoCo 并把深度图写进共享内存；run_php_inference.sh 读它，跑两个 ONNX，把 29 个关节目标发回仿真。键盘命令只在推理终端里给。</p>' +
        '<p>真机部分论文只说零样本迁移，PHP 仓库没有真机部署文档；这里画的真机路径是我按 sim2sim 的结构推的。</p>' +
        guess('真机那一路的方块和连线是示意。延迟条按论文 60–80 ms 画。') + src('wbt_training/DEPLOY.md · run_php_sim.sh · run_php_inference.sh · 附录 B3') },
    { n: 11, part: '§IV-B 结果', title: '表里的数', sub: '切换表 I 和表 II 的两半，柱子都是原文数字', dur: 12, cam: [0, 1.25, 28, [0, 4.4, 0]],
      html: dl([['表 I', '速度跟踪只过 36 cm；端到端深度 58 cm 以上 ≤ 0.19'], ['表 II 上', '只做 DAgger 掉到 0.03–0.63；存活奖励就能拿回大部分'], ['表 II 下', '1/4 环境数在 1.0 m/s 76 cm 上 0.00'], ['评测', '每任务 100 个实例 × 5 次 = 500 次']]) +
        '<p>表 I 和表 II 的 Ours 在 2.0 m/s 58、76 cm 上不一致（0.99 / 0.95 对 0.98 / 0.90），表 I 两个速度的 Ours 三格完全相同，见精读页读者注 16。</p>' +
        '<p>表 II 的 1.0 m/s 列是 58、76、94 cm，94 cm 常比 76 cm 好：两个是不同的技能片段。</p>' + src('§IV-B 表 I · 表 II') }
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
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.3, phi: 1.0, dist: 24, maxDist: 160, minDist: 2 }); }
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
    f.move = p => { if (st.s) st.s.position.set(...p); pos = p; };
    return f;
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BALL = new THREE.SphereGeometry(1, 12, 9), CUBE = new THREE.BoxGeometry(1, 1, 1);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: 0.6 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.12) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.6, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  function pline(G, n, color, o = {}) {
    const pos = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: o.opacity ?? 1 })); l.frustumCulled = false; l.renderOrder = o.order ?? 3; G.add(l);
    l.userData.set = pts => { const k = Math.max(1, Math.min(n, pts.length)); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)] || [0, -50, 0]; pos[i * 3] = q[0]; pos[i * 3 + 1] = q[1]; pos[i * 3 + 2] = q[2]; } g.attributes.position.needsUpdate = true; };
    return l;
  }
  function floorRect(G, cx, cz, lx, lz, color, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(lx, lz), new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: o.opacity != null, opacity: o.opacity ?? 1, depthWrite: o.opacity == null })); m.rotation.x = -Math.PI / 2; m.position.set(cx, o.y ?? 0, cz); G.add(m); return m; }
  function panel(G, x, y, z, w, h, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: o.color ?? 0x0c1220, transparent: true, opacity: o.opacity ?? 0.55, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }

  /* ---------- the hand-made humanoid (1 unit = 1 m, about 1.25 m tall) ---------- */
  function robot(color, o = {}) {
    const m = L.mat(color, { opacity: o.opacity, roughness: 0.5, depthWrite: o.opacity == null || o.opacity > 0.6 });
    const G = new THREE.Group(), mesh = g => new THREE.Mesh(g, m);
    const limb = (len, r) => { const g = new THREE.Group(), c = mesh(new THREE.CylinderGeometry(r, r * 0.82, len, 8)); c.position.y = -len / 2; g.add(c); g.add(mesh(new THREE.SphereGeometry(r, 8, 6))); return g; };
    const pelvis = new THREE.Group(); G.add(pelvis);
    pelvis.add(mesh(new THREE.BoxGeometry(0.26, 0.1, 0.14)));
    const upper = new THREE.Group(); pelvis.add(upper);
    const tor = mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.36, 10)); tor.position.y = 0.2; upper.add(tor);
    const head = mesh(new THREE.SphereGeometry(0.085, 12, 9)); head.position.y = 0.48; upper.add(head);
    const camG = new THREE.Group(); camG.position.set(0, 0.42, 0.09); upper.add(camG);
    const legs = [-1, 1].map(s => { const th = limb(0.3, 0.05); th.position.set(s * 0.09, -0.04, 0); const sh = limb(0.3, 0.042); sh.position.y = -0.3; th.add(sh); const ft = mesh(new THREE.BoxGeometry(0.08, 0.035, 0.18)); ft.position.set(0, -0.31, 0.04); sh.add(ft); pelvis.add(th); return { th, sh }; });
    const arms = [-1, 1].map(s => { const up = limb(0.22, 0.034); up.rotation.order = 'YZX'; up.position.set(s * 0.18, 0.34, 0); const lo = limb(0.22, 0.028); lo.position.y = -0.22; up.add(lo); upper.add(up); return { up, lo, s }; });
    G.userData.cam = camG;
    G.userData.set = q => {
      pelvis.rotation.set(q.pitch || 0, q.yaw || 0, q.roll || 0, 'YXZ'); upper.rotation.x = q.bend || 0;
      legs[0].th.rotation.x = -q.hL; legs[1].th.rotation.x = -q.hR; legs[0].sh.rotation.x = q.kL; legs[1].sh.rotation.x = q.kR;
      legs[0].th.rotation.z = q.abL || 0; legs[1].th.rotation.z = -(q.abR || 0);
      arms[1].up.rotation.x = -q.sL; arms[0].up.rotation.x = -q.sR; arms[1].lo.rotation.x = -q.eL; arms[0].lo.rotation.x = -q.eR;
      arms[0].up.rotation.z = -(q.aR ?? 0.12); arms[1].up.rotation.z = (q.aL ?? 0.12);
    };
    return G;
  }
  const STAND = 0.65, PI = Math.PI;
  /* hand-written poses; returns pose + pelvis offset (dx forward, dy up) in metres */
  function clip(name, t, u = 0, h = 0.76) {
    if (name === 'stand') return { dx: 0, dy: STAND, hL: 0.05, hR: 0.05, kL: 0.1, kR: 0.1, sL: 0.1, sR: 0.1, eL: 0.3, eR: 0.3 };
    if (name === 'run') { const ph = 2 * PI * t / 0.62, s = Math.sin(ph); return { dx: 0, dy: STAND - 0.03 + 0.03 * Math.cos(2 * ph), pitch: 0.18, hL: 0.7 * s, hR: -0.7 * s, kL: 0.3 + 0.8 * Math.max(0, -Math.cos(ph + 0.6)), kR: 0.3 + 0.8 * Math.max(0, Math.cos(ph + 0.6)), sL: -0.6 * s, sR: 0.6 * s, eL: 1.1, eR: 1.1 }; }
    if (name === 'climb') {
      /* u in [0,1]: reach (0-.25), pull (.25-.5), knee up (.5-.75), stand on top (.75-1); h = box height */
      const a = seg(u, 0, 0.25), b = seg(u, 0.25, 0.5), c = seg(u, 0.5, 0.75), d = seg(u, 0.75, 1);
      const dy = STAND + (h + 0.05) * (0.45 * b + 0.55 * c) + (h * 0.0) * d - 0.12 * c * (1 - d);
      return { dx: 0.18 * a + 0.22 * b + 0.25 * c + 0.1 * d, dy: STAND + (dy - STAND) * (1 - d) + h * d, pitch: 0.15 + 0.5 * b * (1 - d), bend: 0.2 * a * (1 - d),
        hL: 0.3 * a + 1.3 * c * (1 - d), hR: 0.3 * a + 0.4 * c * (1 - d), kL: 0.4 * a + 1.6 * c * (1 - d), kR: 0.5 * a + 0.6 * c * (1 - d),
        sL: 2.6 * a * (1 - 0.6 * c) * (1 - d) + 0.1 * d, sR: 2.6 * a * (1 - 0.6 * c) * (1 - d) + 0.1 * d, eL: 0.3 + 1.0 * b * (1 - d), eR: 0.3 + 1.0 * b * (1 - d) };
    }
    if (name === 'vault') {
      const a = Math.sin(PI * u), b = seg(u, 0.2, 0.7);
      return { dx: 0, dy: STAND + (h + 0.15) * a, pitch: 0.5 * a, hL: 1.2 * a, hR: 0.9 * a, kL: 1.5 * a, kR: 1.2 * a, sL: 1.6 * b * (1 - b) * 4 * 0.6, sR: 1.6 * b * (1 - b) * 4 * 0.6, eL: 0.4, eR: 0.4, aL: 0.12, aR: 0.12 };
    }
    if (name === 'step') { const a = Math.sin(PI * u); return { dx: 0, dy: STAND + h * seg(u, 0.3, 0.7) + 0.1 * a, pitch: 0.15, hL: 1.0 * a, hR: 0.2 * a, kL: 1.2 * a, kR: 0.3 * a, sL: 0.4 * a, sR: -0.4 * a, eL: 0.8, eR: 0.8 }; }
    return clip('stand', t);
  }
  /* place robot r with pose q at ground point at (x, z), facing +x (yaw -PI/2 turns the model's +z to +x) */
  function pose(r, q, at, yaw = PI / 2, sc = 1) { r.userData.set({ ...q, yaw: 0 }); r.rotation.y = yaw; r.position.set(at[0] + (q.dx || 0) * Math.sin(yaw) * sc, at[1] + q.dy * sc, at[2] + (q.dx || 0) * Math.cos(yaw) * sc); r.scale.setScalar(sc); }
  function obstacle(G, x, z, w, h, d, color = COL.box, o = {}) { const b = block(d, h, w, color, [x + d / 2, h / 2, z], { opacity: o.opacity ?? 0.95, ...o }); G.add(b); return b; }

  /* ---------- live computations ---------- */
  /* scene 3: a toy 2-D feature space; locomotion gait loops + one skill clip whose first frames are the entry window */
  const MM = (function () {
    const r = L.rng(17), loco = [];
    const speeds = [[-2.2, 0.55], [0.0, 0.7], [2.2, 0.85]];
    speeds.forEach(([cx, rad], si) => { for (let i = 0; i < 60; i++) { const ph = 2 * PI * i / 60; loco.push({ p: [cx + rad * Math.cos(ph) + 0.05 * L.gauss(r), 0, 0.9 * rad * Math.sin(ph) + 0.05 * L.gauss(r)], loop: si, ph: i }); } });
    /* skill clip: starts near the fast loop (the approach looks like running), then leaves to its own region */
    const skill = [];
    for (let i = 0; i < 44; i++) { const u = i / 43; const ph = PI * 0.25 + u * 2.6 * PI * Math.min(1, u * 3); const near = Math.max(0, 1 - u * 3.2);
      const p = [2.2 + 0.85 * Math.cos(ph) * near + (1 - near) * (2.6 + 1.0 * u) , 0, (0.75 * Math.sin(ph)) * near + (1 - near) * (-2.2 + 3.6 * u * u)];
      skill.push({ p, i }); }
    const NE = 12; /* entry window = first 12 frames of the clip (s_k - H_k .. s_k) */
    /* query path: walks around the middle loop then speeds up toward the fast loop */
    const query = t => { const ph = 2 * PI * t * 2.2, sp = clamp((t - 0.25) / 0.45, 0, 1), cx = L.lerp(0.0, 2.2, L.ease(sp)), rad = L.lerp(0.7, 0.85, sp); return [cx + rad * Math.cos(ph) + 0.12 * Math.sin(5 * ph), 0, 0.9 * rad * Math.sin(ph) + 0.1 * Math.cos(3 * ph)]; };
    const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2;
    function nn(q, mode) { const set = mode === 0 ? loco.map((x, i) => ({ x, i, k: 'loco' })) : skill.slice(0, NE).map((x, i) => ({ x, i, k: 'skill' })); let best = null, bc = 1e9; for (const s of set) { const c = d2(q, s.x.p); if (c < bc) { bc = c; best = s; } } return { best, cost: bc }; }
    return { loco, skill, NE, query, nn };
  })();
  /* scene 4: Eq. 5 closed form with y = 2 ln2 / halflife */
  const yOf = hl => 2 * Math.LN2 / hl;
  function springPos(p0, v0, a0, u, y, tau) { const j0 = v0 - u, j1 = a0 + j0 * y, e = Math.exp(-y * tau); return p0 - j1 / (y * y) * e + (-j0 - tau * j1) / y * e + j1 / (y * y) + j0 / y + u * tau; }
  function springVel(v0, a0, u, y, tau) { const j0 = v0 - u, j1 = a0 + j0 * y, e = Math.exp(-y * tau); return { v: e * (j0 + j1 * tau) + u, a: e * (a0 - j1 * y * tau) }; }
  /* scene 7: ray-cast a 58 x 87 depth image of ground + one box in front of a pitched camera */
  function depthImage(camPos, pitchDeg, box, o = {}) {
    const W = 87, H = 58, hf = 89.5 * PI / 180, vf = 2 * Math.atan(Math.tan(hf / 2) * H / W), pt = pitchDeg * PI / 180, out = new Float32Array(W * H), r = L.rng(o.seed || 5);
    const off = o.noise ? 0.03 * L.gauss(L.rng(77)) : 0;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const ax = Math.tan(hf / 2) * ((i + 0.5) / W * 2 - 1), ay = Math.tan(vf / 2) * (1 - (j + 0.5) / H * 2);
      /* camera frame: forward +x, up +y, right +z; pitch down by pt */
      let dx = 1, dy = ay, dz = ax; const c = Math.cos(-pt), s = Math.sin(-pt); const fx = dx * c - dy * s, fy = dx * s + dy * c; dx = fx; dy = fy;
      let tmin = 1e9;
      if (dy < -1e-6) tmin = Math.min(tmin, -camPos[1] / dy);
      /* slab test against the axis-aligned box */
      let t0 = 0, t1 = 1e9; const lo = box.lo, hi = box.hi, oo = camPos, dd = [dx, dy, dz]; let hit = true;
      for (let k = 0; k < 3; k++) { if (Math.abs(dd[k]) < 1e-9) { if (oo[k] < lo[k] || oo[k] > hi[k]) { hit = false; break; } continue; } let ta = (lo[k] - oo[k]) / dd[k], tb = (hi[k] - oo[k]) / dd[k]; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) { hit = false; break; } }
      if (hit && t0 > 0) tmin = Math.min(tmin, t0);
      /* depth along the optical axis, clipped to 0.3-3 m like the D435i config */
      let z = tmin * (dx * Math.cos(-pt) + dy * Math.sin(-pt)); z = clamp(z, 0.3, 3.0);
      if (o.noise) z = clamp(z + 0.03 * L.gauss(r) + off, 0.3, 3.0);
      out[j * W + i] = z;
    }
    if (o.noise) { const rh = L.rng(31); for (let k = 0; k < 9; k++) { const ci = Math.floor(rh() * W), cj = Math.floor(rh() * H), wi = 2 + Math.floor(rh() * 5), hj = 2 + Math.floor(rh() * 4); for (let j = cj; j < Math.min(H, cj + hj); j++) for (let i = ci; i < Math.min(W, ci + wi); i++) out[j * W + i] = 3.0; } }
    return { W, H, data: out };
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

  /* ---------- scene 1: the four panels of Fig. 2 ---------- */
  function s1(G) {
    const P = [['(a) 技能组合', -9.6, COL.mm, 2], ['(b) 教师训练', -3.2, COL.teach, 5], ['(c) 学生训练', 3.2, COL.stud, 7], ['(d) 零样本上真机', 9.6, COL.real, 9]];
    const B = P.map(([t, x, c, go]) => { const b = block(5.6, 0.3, 4.6, c, [x, 0.15, 0], { opacity: 0.85 }); b.userData.go = go; PICKS.push(b); G.add(b, lab(t, [x, 5.2, -1.8], { size: 22, color: css(c) })); return b; });
    /* (a) loco + skill clips + MM */
    const locoB = block(1.6, 0.6, 1.0, COL.loco, [-10.6, 0.6, -1.2]), skB = block(1.6, 0.6, 1.0, COL.skill, [-8.6, 0.6, -1.2]), mmB = block(2.4, 0.8, 1.2, COL.mm, [-9.6, 0.7, 0.9]);
    G.add(locoB, skB, mmB, lab('走跑', [-10.6, 1.35, -1.2], { size: 16 }), lab('原子技能', [-8.6, 1.35, -1.2], { size: 16 }), lab('motion matching', [-9.6, 1.55, 0.9], { size: 16 }));
    [[locoB, 2], [skB, 2], [mmB, 3]].forEach(([m, g]) => { m.userData.go = g; PICKS.push(m); });
    /* (b) teachers */
    const T = [0, 1, 2].map(i => { const b = block(0.9, 0.9, 0.9, COL.teach, [-4.3 + i * 1.1, 0.75, -0.6]); b.userData.go = 6; PICKS.push(b); G.add(b, lab('π' + ['₀', '₁', '₂'][i], [-4.3 + i * 1.1, 1.55, -0.6], { size: 16 })); return b; });
    const hs = block(2.6, 0.2, 1.0, 0x6f8a5a, [-3.2, 0.42, 1.3]); hs.userData.go = 6; PICKS.push(hs); G.add(hs, lab('高度扫描 + 全局位姿', [-3.2, 0.95, 1.6], { size: 15 }));
    /* (c) student */
    const dag = block(2.6, 0.7, 1.0, COL.stud, [3.2, 0.65, -0.9]), stu = block(1.4, 1.1, 1.1, 0x3fae78, [3.2, 0.85, 1.0]), dcam = block(0.9, 0.5, 0.5, COL.cam, [1.6, 0.55, 1.0]);
    G.add(dag, stu, dcam, lab('DAgger + PPO', [3.2, 1.4, -0.9], { size: 16 }), lab('学生', [3.2, 1.75, 1.0], { size: 16 }), lab('深度', [1.6, 1.15, 1.0], { size: 15 }));
    [[dag, 8], [stu, 7], [dcam, 7]].forEach(([m, g]) => { m.userData.go = g; PICKS.push(m); });
    /* (d) real robot over a box */
    const rob = robot(COL.robot); G.add(rob); obstacle(G, 9.2, 0.3, 1.2, 0.76, 0.9);
    const f = { a: stream(G, 6, COL.mm), b: stream(G, 6, COL.teach), c: stream(G, 6, COL.stud), d: stream(G, 5, COL.real) };
    return { update(p) {
      const q = (p * 18) % 1, st = Math.min(3, Math.floor(p * 4));
      B.forEach((b, i) => glow(b, i === st ? 0.7 : 0.05));
      f.a([[-10.6, 1.0, -1.2], [-9.6, 1.0, 0.9], [-8.6, 1.0, -1.2]], q, 1); f.b([[-9.6, 1.0, 0.9], [-4.3, 1.4, -0.6], [-2.1, 1.4, -0.6]], q, st >= 1 ? 1 : 0);
      f.c([[-2.1, 1.4, -0.6], [3.2, 1.2, -0.9], [3.2, 1.2, 1.0]], q, st >= 2 ? 1 : 0); f.d([[3.2, 1.2, 1.0], [8.3, 1.2, 0.3]], q, st >= 3 ? 1 : 0);
      const u = (p * 3) % 1, x = L.lerp(7.6, 11.4, u);
      if (u < 0.35 || u > 0.75) pose(rob, clip('run', p * 14), [x, 0, 0.3]); else pose(rob, clip('vault', 0, (u - 0.35) / 0.4, 0.76), [x, 0, 0.3]);
      cap(['(a) 人体动捕重定向成原子技能，<b>motion matching</b> 和走跑拼成长参考，每条配一个箱子地形', '(b) 每个技能一个 PPO <b>跟踪专家</b>，额外看得到全局位姿和高度扫描', '(c) 多个专家冻结，用 <b>DAgger + PPO</b> 蒸馏成一个只看深度图的学生', '(d) 导出两个 ONNX，<b>零样本</b>部署到 G1：只给离散速度命令，技能自己选'][st]);
    } };
  }

  /* ---------- scene 2: the skill library (Table III) ---------- */
  function s2(G) {
    let view = +(OPT[0] ?? 0); G.add(L.grid(30, 30));
    const T3 = [['S36', 2.2, 1], ['C58', 12.1, 1], ['C76', 8.8, 1], ['C94', 10.3, 1], ['S36', 1.6, 2], ['C58', 6.1, 2], ['C76', 4.4, 2], ['C94', 5.2, 2], ['C125', 5.9, 2], ['Dash', 5.0, 2], ['Speed', 3.1, 2], ['Cat', 1.5, 3]];
    const CODE = [['step', 1], ['step_high_speed', 1], ['climb_58', 1], ['climb_76', 1], ['climb_76_high_speed', 1], ['climb_94', 1], ['climb_134', 2], ['roll_78', 0], ['roll_90', 0], ['roll_136', 0], ['drop_92', 0], ['hurdle', 0], ['jump_35', 0], ['dash_vault', 1], ['speed_vault', 1], ['cat_vault', 1]];
    const sub = new THREE.Group(); G.add(sub); let last = -1, bars = [];
    const SC = { 1: 0x7cb8ff, 2: COL.skill, 3: COL.entry };
    const RX = [5.0, 7.0, 8.8];
    const human = robot(COL.human), g1 = robot(COL.robot), mir = robot(COL.robot, { opacity: 0.35 }); G.add(human, g1, mir);
    G.add(lab('人体动捕', [RX[0], 2.3, 0], { size: 15, color: css(COL.human) }), lab('G1', [RX[1], 2.3, 0], { size: 15 }), lab('镜像', [RX[2], 2.3, 0], { size: 15 }));
    G.add(L.arrow([RX[0] + 0.5, 0.9, 0], [RX[1] - 0.5, 0.9, 0], 0xffffff)); G.add(lab('OmniRetarget', [6.0, 3.0, 0], { size: 14 }));
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = view;
      if (view === 0) {
        const XB = i => -7.6 + i * 0.95;
        T3.forEach(([nm, d, v], i) => { const x = XB(i), h = d / 12.1 * 5.6, b = block(0.7, 1, 0.7, SC[v], [x, 0.5, 0]); sub.add(b); bars.push({ b, h }); sub.add(lab(nm, [x, -0.3, 0.9], { size: 13 })); sub.add(lab(d.toFixed(1), [x, h + 0.4, 0], { size: 13 })); });
        sub.add(lab('1.0 m/s', [(XB(0) + XB(3)) / 2, -0.3, 2.2], { size: 15, color: css(SC[1]) }), lab('2.0 m/s', [(XB(4) + XB(10)) / 2, -0.3, 2.2], { size: 15, color: css(SC[2]) }), lab('3.0', [XB(11), -0.3, 2.2], { size: 15, color: css(SC[3]) }));
        const lb = block(11.2, 0.4, 0.7, 0x5b6b8a, [-2.4, 0.2, -2.2]); sub.add(lb); sub.add(lab('走跑 495.5 s（按同一比例要 230 m 高，这里截断）', [-2.4, 0.9, -2.2], { size: 14 }));
      } else {
        CODE.forEach(([nm, k], i) => { const x = -7.2 + (i % 4) * 2.9, z = -1.8 + Math.floor(i / 4) * 1.3, c = k === 0 ? COL.bad : k === 2 ? COL.gold : COL.ok, b = block(1.6, 0.4, 0.9, c, [x, 0.2, z]); sub.add(b); sub.add(lab(nm, [x, 0.85, z], { size: 13 })); });
        sub.add(lab('绿 = 表 III 有　红 = 表 III 没有\n黄 = 对不上（1.34 m 对 125 cm）', [-2.8, 3.0, -1.0], { size: 15 }));
      }
    }
    rebuild();
    const ctls = [{ label: '清单', items: ['表 III', '代码注册表'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const g = seg(p, 0.05, 0.5); bars.forEach(({ b, h }) => { const hh = Math.max(0.02, h * g); b.scale.y = hh; b.position.y = hh / 2; });
      const u = (p * 2) % 1, q = u < 0.5 ? clip('climb', 0, u * 2, 0.5) : clip('stand', 0);
      pose(human, q, [RX[0], 0, 0], PI / 2, 1.15); pose(g1, q, [RX[1], 0, 0], PI / 2, 1.0); pose(mir, { ...q, hL: q.hR, hR: q.hL, kL: q.kR, kR: q.kL }, [RX[2], 0, 0], -PI / 2, 1.0);
      cap(view === 0 ? '表 III：12 项跑酷片段合计 <b>66.2 s</b>，平均 5.5 s；走跑 495.5 s。最少的猫跳只有 <b>1.5 s</b>' : '代码 <code>skill_registry.py</code> 多出翻滚、跳下、跨栏、跳；最高攀爬叫 <b>climb_134</b>（箱顶 1.34 m）');
    } };
  }

  /* ---------- scene 3: nearest-neighbour search (Eq. 1) ---------- */
  function s3(G) {
    let mode = +(OPT[0] ?? 0);
    floorRect(G, 1.2, 0, 13, 8, 0x10172a, { y: -0.02, opacity: 0.9 });
    const lp = inst(BALL, MM.loco.length); lp.material.color.setHex(COL.loco); MM.loco.forEach((x, i) => setI(lp, i, x.p, 0.06)); done(lp); G.add(lp);
    const sp = inst(BALL, MM.skill.length); MM.skill.forEach((x, i) => { setI(sp, i, x.p, i < MM.NE ? 0.085 : 0.065); colI(sp, i, hex3(i < MM.NE ? COL.entry : COL.skill)); }); done(sp); G.add(sp);
    wire(G, MM.skill.map(x => [x.p[0], 0.01, x.p[2]]), COL.skill, { opacity: 0.5 });
    G.add(lab('走跑库 𝒟_loco（三个速度的步态环）', [0.4, 0.9, 2.6], { size: 15, color: css(COL.loco) }));
    G.add(lab('技能片段 𝒟_k', [4.6, 0.9, 1.4], { size: 16, color: css(COL.skill) }), lab('进入窗口 𝓔_k', [3.4, 0.9, -1.4], { size: 16, color: css(COL.entry) }));
    const qd = new THREE.Mesh(BALL, L.mat(0xffffff, { emissive: 0x666666 })); qd.scale.setScalar(0.13); G.add(qd);
    const md = new THREE.Mesh(BALL, L.mat(COL.gold, { emissive: 0x665500 })); md.scale.setScalar(0.15); G.add(md);
    const ph = new THREE.Mesh(BALL, L.mat(0x4fc98a, { emissive: 0x225533 })); ph.scale.setScalar(0.1); G.add(ph);
    const link = pline(G, 2, COL.gold), trail = pline(G, 60, 0xffffff, { opacity: 0.45 });
    const ql = dynLab(G, [0, 1, 0], { size: 15 }), cl = dynLab(G, [1.4, 0.15, 3.7], { size: 15, border: 'rgba(242,193,78,.8)' });
    const NS = 24; /* number of searches over the scene (toy: one per 1/24 of the timeline) */
    const ctls = [{ label: '搜索窗口 𝒞_t', items: ['走跑库 𝒟_loco', '进入窗口 𝓔_k'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const k = Math.floor(p * NS), tk = k / NS, q = MM.query(tk), r = MM.nn(q, mode), best = r.best;
      const qn = MM.query(p); qd.position.set(qn[0], 0.12, qn[2]);
      trail.userData.set(Array.from({ length: 60 }, (_, i) => { const a = MM.query(Math.max(0, p - 0.12 * (1 - i / 59))); return [a[0], 0.05, a[2]]; }));
      md.position.set(best.x.p[0], 0.15, best.x.p[2]); link.userData.set([[q[0], 0.12, q[2]], [best.x.p[0], 0.15, best.x.p[2]]]);
      /* playhead: plays forward from the match until the next search */
      const adv = (p - tk) * NS; let pp;
      if (mode === 0) { const L0 = MM.loco[best.i], base = L0.loop * 60, idx = base + (L0.ph + Math.floor(adv * 4)) % 60; pp = MM.loco[idx].p; }
      else { const idx = Math.min(MM.skill.length - 1, best.i + Math.floor(adv * 4)); pp = MM.skill[idx].p; }
      ph.position.set(pp[0], 0.12, pp[2]);
      ql('查询 x̂_t', ); ql.move([qn[0], 0.75, qn[2]]);
      cl(`第 ${k + 1} 次检索 · i* = ${mode === 0 ? '走跑帧 ' + best.i : '入口帧 ' + best.i + ' / ' + MM.NE} · ‖x̂ − x_i*‖² = ${r.cost.toFixed(3)}`);
      cap(mode === 0 ? '走跑模式：每个检索周期在<b>整个走跑库</b>里找最近邻，跳过去接着放（绿点是播放头）' : '要进技能 k：搜索只在<b>进入窗口 𝓔_k</b>（粉）里做。查询在步态环的不同相位，匹配到的<b>入口帧也不同</b>');
    } };
  }

  /* ---------- scene 4: spring-predicted future trajectory (Eqs. 4-5) ---------- */
  function s4(G) {
    let spd = +(OPT[0] ?? 0), hlI = +(OPT[1] ?? 0); const HL = [0.27, 0.1, 0.6], SPD = [0.8, 2.2];
    G.add(L.grid(12, 24));
    const rob = robot(COL.robot); G.add(rob);
    const fut = inst(BALL, 3); fut.material.color.setHex(COL.gold); fut.material.emissive.setHex(0x553f00); G.add(fut);
    const pred = pline(G, 40, 0xffffff, { opacity: 0.8 }), past = pline(G, 120, COL.loco, { opacity: 0.8 }), cmdA = pline(G, 2, COL.entry);
    const lbs = [0, 1, 2].map(() => dynLab(G, [0, 0, 0], { size: 14 }));
    const info = dynLab(G, [0, 0.2, 2.25], { size: 14, border: 'rgba(242,193,78,.8)' });
    /* timeline bar under the scene */
    const TL = [['站立', 0.06, 0x5b6b8a], ['走跑（匹配）', 0.34, COL.loco], ['𝓔_k', 0.08, COL.entry], ['技能回放（关匹配）', 0.22, COL.skill], ['走跑 2 s', 0.2, COL.loco], ['站立', 0.1, 0x5b6b8a]];
    let x0 = -4.5; TL.forEach(([t, w, c], i) => { const W = w * 9; G.add(block(W - 0.05, 0.1, 0.35, c, [x0 + W / 2, 0.05, 3.2], { opacity: 0.9 })); G.add(lab(t, [x0 + W / 2, 0.35 + (i % 2) * 0.32, 3.25], { size: 12 })); x0 += W; });
    const cur = block(0.06, 0.4, 0.5, 0x222a3a, [-4.5, 0.2, 3.2]); G.add(cur);
    /* command schedule (deg) over the scene; skill phase forces 0 deg */
    const cmdAt = t => (t < 0.06 ? null : t < 0.2 ? 0 : t < 0.32 ? 45 : t < 0.4 ? -90 : 0);
    const ctls = [{ label: '速度档', items: ['走 0.8 m/s', '跑 2.2 m/s'], get: () => spd, set: k => { spd = k; } }, { label: '半衰期', items: ['0.27 s（代码）', '0.1 s', '0.6 s'], get: () => hlI, set: k => { hlI = k; } }];
    return { ctls, update(p) {
      const y = yOf(HL[hlI]), dur = 16, dt = 1 / 60, n = Math.floor(p * dur / dt), sp = SPD[spd];
      /* integrate the simulated root with the same closed form, one frame at a time (pure in p) */
      let px = -3.5, pz = 0, vx = 0, vz = 0, ax = 0, az = 0, hd = 0; const path = [];
      const cmdV = t => { const c = cmdAt(t); if (c == null) return [0, 0]; const h = c * PI / 180; return [sp * Math.cos(h), -sp * Math.sin(h)]; };
      for (let i = 0; i < n; i++) { const t = i * dt / dur, u = cmdV(t), sx = springVel(vx, ax, u[0], y, dt), sz = springVel(vz, az, u[1], y, dt); px = springPos(px, vx, ax, u[0], y, dt); pz = springPos(pz, vz, az, u[1], y, dt); vx = sx.v; ax = sx.a; vz = sz.v; az = sz.a; if (i % 8 === 0) path.push([px, 0.03, pz]); }
      /* wrap the root back into view when it runs off */
      const wrap = v => ((v + 3.5) % 7 + 7) % 7 - 3.5; const ox = wrap(px) - px, oz = wrap(pz) - pz;
      past.userData.set(path.slice(-120).map(q => [q[0] + ox, q[1], q[2] + oz]));
      const u = cmdV(p), taus = [0.33, 0.67, 1.0];
      const F = taus.map(tau => [springPos(px, vx, ax, u[0], y, tau) + ox, 0.08, springPos(pz, vz, az, u[1], y, tau) + oz]);
      F.forEach((q, i) => { setI(fut, i, q, 0.09); lbs[i](`${taus[i]} s`); lbs[i].move([q[0], 0.35 + i * 0.3, q[2]]); }); done(fut);
      pred.userData.set(Array.from({ length: 40 }, (_, i) => { const tau = i / 39; return [springPos(px, vx, ax, u[0], y, tau) + ox, 0.06, springPos(pz, vz, az, u[1], y, tau) + oz]; }));
      cmdA.userData.set([[px + ox, 0.1, pz + oz], [px + ox + u[0] * 0.8, 0.1, pz + oz + u[1] * 0.8]]);
      const vmag = Math.hypot(vx, vz); hd = vmag > 0.05 ? Math.atan2(vx, vz) : PI / 2;
      const inSkill = p > 0.48 && p < 0.7;
      pose(rob, vmag > 0.1 ? clip('run', p * dur) : clip('stand', 0), [px + ox, 0, pz + oz], hd, 0.7);
      cur.position.x = -4.5 + p * 9;
      info(`y = 2 ln2 / ${HL[hlI]} = ${y.toFixed(2)} s⁻¹ · |v| = ${vmag.toFixed(2)} m/s · 命令 ${cmdAt(p) == null ? '站立' : cmdAt(p) + '°'}`);
      cap(inSkill ? '技能回放段：<b>关掉 motion matching</b>，命令固定直行、速度档不变，只推进播放下标' : '黄点是按<b>式 (5)</b> 当场算的 p(0.33)、p(0.67)、p(1.0)；粉线是命令速度，蓝线是走过的路');
    } };
  }

  /* ---------- scene 5: terrain pairing and randomisation ---------- */
  function s5(G) {
    let yawM = +(OPT[0] ?? 0);
    G.add(L.grid(24, 24));
    const stride = 0.9, take = 0.5, D = [4.8, 3.9];
    /* two approach lanes (Fig. 3a) */
    const lanes = D.map((d, li) => {
      const z = li === 0 ? -2.2 : -0.9, bx = 1.0; obstacle(G, bx, z, 0.8, 0.4, 0.5, COL.box, { opacity: 0.8 });
      const n = Math.floor((d - take) / stride), feet = [];
      for (let k = 0; k <= n; k++) { const x = bx - take - (n - k) * stride, side = (k % 2 === 0) ? 1 : -1; const f = block(0.18, 0.02, 0.09, side > 0 ? COL.ok : COL.entry, [x, 0.01, z + side * 0.12]); G.add(f); feet.push({ f, x }); }
      const lead = n % 2 === 0 ? '左腿' : '右腿';
      G.add(lab(`${d} m 起跑 → ${n + 1} 步\n→ ${lead}领先`, [bx - d - 1.1, 0.25, z], { size: 13 }));
      wire(G, [[bx - d, 0.02, z], [bx, 0.02, z]], 0xffffff, { dashed: true, opacity: 0.6 });
      return { feet, z, bx, d };
    });
    G.add(lab('绿 = 左脚　粉 = 右脚', [-1.5, 0.2, -3.2], { size: 13 }));
    /* variants of the paired box (right side) + distractors */
    const vb = new THREE.Mesh(CUBE, L.mat(COL.boxT, { opacity: 0.9 })); G.add(vb); const ve = new THREE.LineSegments(new THREE.EdgesGeometry(CUBE), new THREE.LineBasicMaterial({ color: 0x0b1020 })); vb.add(ve);
    const ref = block(0.9, 0.76, 0.6, 0xffffff, [5.0, 0.38, 1.2], { opacity: 0.18 }); G.add(ref);
    const path = wire(G, [[1.5, 0.02, 1.2], [8.5, 0.02, 1.2]], COL.gold, { opacity: 0.8 });
    const dis = inst(CUBE, 15, { opacity: 0.6 }); dis.material.color.setHex(0x7a8299); G.add(dis);
    const vl = dynLab(G, [3.4, 2.4, 1.2], { size: 13, border: 'rgba(242,193,78,.8)' });
    const ctls = [{ label: '偏航范围', items: ['论文 ±45°', '代码 ±180°'], get: () => yawM, set: k => { yawM = k; } }];
    return { ctls, update(p) {
      const vi = Math.floor(p * 10) % 10, r = L.rng(100 + vi);
      const half = 0.3, wl = half + r() * (0.75 - half), wr = half + r() * (0.75 - half), w = wl + wr, off = (wr - wl) / 2;
      const dd = 0.6 + (r() * 2 - 1) * 0.05, hh = 0.76 + (r() * 2 - 1) * 0.05, yw = (r() * 2 - 1) * (yawM === 0 ? PI / 4 : PI);
      vb.scale.set(dd, hh, w); vb.position.set(5.0 + off * Math.sin(yw), hh / 2, 1.2 + off * Math.cos(yw)); vb.rotation.y = yw;
      const rd = L.rng(500 + vi), nd = 5 + Math.floor(rd() * 11);
      for (let i = 0; i < 15; i++) { if (i >= nd) { setI(dis, i, [0, -50, 0], 0.001); continue; } const side = rd() < 0.5 ? -1 : 1, x = 2 + rd() * 6, z = 1.2 + side * (0.6 + rd() * 1.4), s = 0.2 + rd() * 0.5; setI(dis, i, [x, s / 2, z], [s, s, s]); } done(dis);
      vl(`变体 ${vi + 1} / 10\n宽 ${w.toFixed(2)} m · 高 ${hh.toFixed(2)} m\n偏航 ${(yw * 180 / PI).toFixed(0)}° · 干扰物 ${nd} 个`);
      lanes.forEach(({ feet }) => feet.forEach(({ f, x }, k) => { f.visible = seg(p, 0, 0.6) * feet.length > k; }));
      cap(yawM === 0 ? '论文：宽度到 1.5 m、其余 ±5 cm、偏航 <b>±45°</b>；白色半透明是参考箱子' : '代码 <code>obstacle_helpers.py:312</code> 建网格时给每个箱子加 <b>U(−π, π)</b> 偏航；对主障碍的影响<b>未核实</b>');
    } };
  }

  /* ---------- scene 6: teacher with privileged observations ---------- */
  function s6(G) {
    let hsM = +(OPT[0] ?? 0);
    G.add(L.grid(12, 24));
    const H = 0.76, BX = 1.2; obstacle(G, BX, 0, 1.6, H, 1.0);
    const rob = robot(COL.robot), refR = robot(COL.ref, { opacity: 0.35 }); G.add(rob, refR);
    const N = 17, dots = inst(BALL, N * N); G.add(dots);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.52, 48), new THREE.MeshBasicMaterial({ color: COL.bad, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })); ring.rotation.x = -PI / 2; G.add(ring);
    const errL = dynLab(G, [0, 2.2, -1.2], { size: 15, border: 'rgba(224,93,93,.8)' }), gl = dynLab(G, [0, 0, 0], { size: 14 });
    const terrainH = (x, z) => (x >= BX && x <= BX + 1.0 && Math.abs(z) <= 0.8 ? H : 0);
    const ctls = [{ label: '高度扫描', items: ['论文 0.7 m', '代码 1.6 m（289 点）'], get: () => hsM, set: k => { hsM = k; } }];
    return { ctls, update(p) {
      /* robot: run to the box (0-.35), climb (.35-.8), stand (.8-1) */
      let x, q, y0 = 0; const u = clamp((p - 0.35) / 0.45, 0, 1);
      if (p < 0.35) { x = L.lerp(-1.8, BX - 0.35, p / 0.35); q = clip('run', p * 14); }
      else if (p < 0.8) { x = BX - 0.35; q = clip('climb', 0, u, H); }
      else { x = BX - 0.35 + 0.6; q = clip('stand', 0); y0 = H; q = { ...q, dy: STAND + H }; }
      const lag = 0.12 * Math.sin(PI * clamp((p - 0.3) / 0.6, 0, 1));
      pose(rob, q, [x - lag, 0, 0.0]); pose(refR, q, [x, 0, 0.0]);
      const ax = rob.position.x, az = 0;
      ring.position.set(x + (q.dx || 0), (q.dy || 0) + 0.02, 0);
      const n = hsM === 0 ? 8 : 17, sp = 0.1, half = (n - 1) * sp / 2;
      for (let i = 0; i < N * N; i++) { const a = i % N, b = Math.floor(i / N); if (a >= n || b >= n) { setI(dots, i, [0, -50, 0], 0.001); continue; } const gx = ax - half + a * sp, gz = az - half + b * sp, h = terrainH(gx, gz); setI(dots, i, [gx, h + 0.03, gz], 0.025); colI(dots, i, h > 0 ? hex3(COL.gold) : hex3(COL.cam)); } done(dots);
      gl(hsM === 0 ? '0.7 × 0.7 m（论文）' : '1.6 × 1.6 m · 17 × 17 = 289（代码）'); gl.move([ax, 0.35, half + 0.45]);
      errL(`红 = 参考 · 锚点误差 ${(lag).toFixed(2)} m（终止 0.5 m）`); errL.move([ax - 0.6, 1.7, -1.4]);
      cap(p < 0.35 ? '接近：高度扫描（黄 = 箱顶）告诉专家前面有多高；<b>全局位置</b>让它知道离参考多远' : p < 0.8 ? '攀爬：参考和地形绑定，漂一点就撞箱子，专家必须<b>按全局位姿纠偏</b>；红圈是 0.5 m 终止半径' : '站上箱顶。真机没有这些特权量，学生要从<b>深度图</b>里推');
    } };
  }

  /* ---------- scene 7: depth image and the student network ---------- */
  function s7(G) {
    let nz = +(OPT[0] ?? 0);
    G.add(L.grid(10, 20));
    const H = 0.76, BX = 2.2, RZ = 1.2; obstacle(G, BX, RZ, 1.4, H, 0.9);
    const rob = robot(COL.robot); G.add(rob);
    const fr = pline(G, 10, COL.cam, { opacity: 0.8 });
    /* depth texture panel */
    const cv = document.createElement('canvas'); cv.width = 87; cv.height = 58; const cx = cv.getContext('2d'), img = cx.createImageData(87, 58);
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.8), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); pm.position.set(0.9, 2.5, -1.6); G.add(pm);
    G.add(lab('深度图 1×58×87（亮 = 近）', [0.9, 3.65, -1.6], { size: 13 }));
    /* network blocks */
    const NB = [['Conv16\n29×44', 1.4, 0x38d1ff], ['Conv32\n15×22', 1.1, 0x38d1ff], ['Conv64\n8×11', 0.8, 0x38d1ff], ['GAP\n64', 0.5, 0x6fb8d0], ['Linear\n32', 0.4, 0x6fb8d0]];
    const nbl = NB.map(([t, s, c], i) => { const b = block(0.3, s, s, c, [2.9 + i * 0.6, 2.5, -1.6], { opacity: 0.9 }); G.add(b, lab(t, [2.9 + i * 0.6, i % 2 ? 1.45 : 3.55, -1.6], { size: 11 })); return b; });
    const pro = block(0.4, 0.9, 0.4, COL.loco, [6.0, 1.0, -1.6]); G.add(pro, lab('本体 108', [6.0, 0.3, -1.6], { size: 12 }));
    const ML = [2048, 1024, 512, 256, 128, 29];
    const mlb = ML.map((w, i) => { const h = 0.3 + Math.log2(w) * 0.17; const b = block(0.26, h, 0.42, i === 5 ? COL.real : COL.stud, [6.6 + i * 0.45, 2.1, -1.6]); G.add(b, lab(String(w), [6.6 + i * 0.45, i % 2 ? 0.75 : 3.45, -1.6], { size: 11 })); return b; });
    G.add(lab('学生 MLP（140 →）', [7.7, 4.0, -1.6], { size: 12 }), lab('→ 29 个 PD 目标', [8.6, 0.25, -1.6], { size: 12 }));
    const flow = stream(G, 8, COL.cam, 0.07), flow2 = stream(G, 6, COL.stud, 0.07);
    const dlb = dynLab(G, [0.9, 1.35, -1.6], { size: 12 });
    let lastKey = null;
    const ctls = [{ label: '深度', items: ['干净', '加噪声（代码）'], get: () => nz, set: k => { nz = k; } }];
    return { ctls, update(p) {
      const x = L.lerp(-1.6, BX - 0.45, seg(p, 0, 0.85)); pose(rob, clip('run', p * 12), [x, 0, RZ]);
      const camP = [x + 0.12, 1.24, RZ], key = Math.round(x * 40) + ':' + nz;
      if (key !== lastKey) {
        lastKey = key; const D = depthImage(camP, 27, { lo: [BX, 0, RZ - 0.7], hi: [BX + 0.9, H, RZ + 0.7] }, { noise: nz === 1, seed: 3 + Math.round(x * 40) });
        for (let i = 0; i < D.W * D.H; i++) { const v = Math.round(255 * (1 - (D.data[i] - 0.3) / 2.7)); img.data[i * 4] = v * 0.55; img.data[i * 4 + 1] = v * 0.85; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
        cx.putImageData(img, 0, 0); tex.needsUpdate = true;
        let mn = 9; for (let i = 0; i < D.data.length; i++) mn = Math.min(mn, D.data[i]); dlb(`最近 ${mn.toFixed(2)} m · 箱子前沿距相机 ${(BX - camP[0]).toFixed(2)} m`);
      }
      /* frustum lines from the camera */
      const hf = 89.5 * PI / 360, vf = Math.atan(Math.tan(hf) * 58 / 87), pt = 27 * PI / 180, R = 1.6, C = [];
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => { const ay = Math.tan(vf) * sy, az = Math.tan(hf) * sx; let dx = 1, dy = ay; const c = Math.cos(-pt), s = Math.sin(-pt); const fx = dx * c - dy * s, fy = dx * s + dy * c; const nrm = Math.hypot(fx, fy, az); C.push([camP[0] + fx / nrm * R, camP[1] + fy / nrm * R, camP[2] + az / nrm * R]); });
      fr.userData.set([camP, C[0], C[1], camP, C[2], C[3], camP, C[0], C[3], C[2]]);
      const q = (p * 10) % 1; flow([[2.25, 2.5, -1.6], [2.9, 2.5, -1.6], [5.3, 2.5, -1.6], [6.6, 2.1, -1.6]], q, 1); flow2([[6.0, 1.0, -1.6], [6.6, 2.1, -1.6], [8.9, 2.1, -1.6]], q, 1);
      nbl.forEach((b, i) => glow(b, Math.floor(p * 12) % 6 === i ? 0.6 : 0.05)); mlb.forEach((b, i) => glow(b, Math.floor(p * 12) % 6 === i ? 0.6 : 0.05));
      cap(nz === 0 ? '相机俯仰 27°、水平视场 89.5°、量程 0.3–3 m。深度图<b>当场光线投射</b>：越走近，箱子在图里越大越亮' : '代码的噪声：每像素 <b>3 cm 高斯</b> + 每环境一个 3 cm 偏置 + Perlin 打洞（这里用方块示意）；<b>不加模糊</b>');
    } };
  }

  /* ---------- scene 8: the DAgger + PPO schedule ---------- */
  function s8(G) {
    let md = +(OPT[0] ?? 0);
    const X0 = -7.6, X1 = 2.8, Y0 = 0.5, Y1 = 6.0; panel(G, X0 - 0.4, Y0 - 0.6, -0.05, X1 - X0 + 0.8, Y1 - Y0 + 1.2);
    wire(G, [[X0, Y0, 0], [X1, Y0, 0]], 0xffffff, { opacity: 0.6 }); wire(G, [[X0, Y0, 0], [X0, Y1, 0]], 0xffffff, { opacity: 0.6 });
    const lp = pline(G, 200, COL.real), ld = pline(G, 200, COL.stud), lt = pline(G, 200, COL.cam), band = pline(G, 200, 0x9aa6bf, { opacity: 0.6 }), cur = pline(G, 2, 0xffffff);
    const ticks = []; const tickG = new THREE.Group(); G.add(tickG); let lastMd = -1;
    G.add(lab('λ_PPO', [X1 + 0.8, 5.6, 0], { size: 15, color: css(COL.real) }), lab('λ_D', [X1 + 0.8, 4.9, 0], { size: 15, color: css(COL.stud) }), lab('终止阈值\n0.5 → 1.0 m', [X1 + 0.9, 4.0, 0], { size: 13, color: css(COL.cam) }));
    G.add(lab('1.0', [X0 - 0.6, Y1, 0], { size: 13 }), lab('0', [X0 - 0.6, Y0, 0], { size: 13 }));
    const vl = dynLab(G, [-2.5, -0.9, 0], { size: 14, border: 'rgba(242,193,78,.8)' });
    /* toy: two symmetric root offsets around the reference, same MSE, only the higher clears the box */
    const tg = new THREE.Group(); tg.position.set(5.6, 0.6, 0); G.add(tg);
    tg.add(block(0.8, 0.9, 0.6, COL.box, [1.2, 0.45, 0], { opacity: 0.9 }));
    const tr = [0.0, 0.16, -0.16].map((d, i) => { const l = pline(tg, 40, [0xffffff, COL.ok, COL.bad][i], { opacity: 0.9 }); l.userData.d = d; return l; });
    tg.add(lab('高 δ', [-0.5, 2.6, 0], { size: 12, color: css(COL.ok) }), lab('参考', [-0.5, 2.05, 0], { size: 12 }), lab('低 δ', [-0.5, 1.5, 0], { size: 12, color: css(COL.bad) }));
    const tl = dynLab(tg, [1.0, 3.3, 0], { size: 12 });
    const hump = (x, d) => { const u = clamp(x / 2.4, 0, 1); return 0.65 + (0.95 + d) * Math.sin(PI * u) ** 1.5; };
    tr.forEach(l => l.userData.set(Array.from({ length: 40 }, (_, i) => { const x = i / 39 * 2.4; return [x, hump(x, l.userData.d), 0]; })));
    function rebuild() {
      L.clear(tickG); LABS = LABS.filter(s => s.parent !== tickG); lastMd = md; const K = md === 0 ? 20000 : 30000;
      [0, 1000, 10000, 20000, 30000].filter(k => k <= K).forEach(k => { const x = X0 + (X1 - X0) * k / K; tickG.add(lab(k >= 1000 ? (k / 1000) + 'k' : '0', [x, Y0 - 0.45, 0], { size: 13 })); wire(tickG, [[x, Y0, 0], [x, Y1, 0]], 0x46506a, { opacity: 0.4 }); });
    }
    const ctls = [{ label: '版本', items: ['论文（K = 20k）', '代码（K = 30k）'], get: () => md, set: k => { md = k; } }];
    return { ctls, update(p) {
      if (lastMd !== md) rebuild();
      const K = md === 0 ? 20000 : 30000, X = k => X0 + (X1 - X0) * k / K, Y = v => Y0 + (Y1 - Y0) * v;
      const lamP = k => Math.min(k / 10000, 0.9), thr = k => md === 0 ? 0.5 + 0.5 * Math.min(k / 10000, 1) : 0.5 + 0.5 * clamp((k - 1000) / 9000, 0, 1);
      const ks = Array.from({ length: 200 }, (_, i) => i / 199 * K);
      lp.userData.set(ks.map(k => [X(k), Y(lamP(k)), 0.02])); ld.userData.set(ks.map(k => [X(k), Y(1 - lamP(k)), 0.02])); lt.userData.set(ks.map(k => [X(k), Y((thr(k) - 0.5) / 0.5), 0.03]));
      band.visible = md === 1; band.userData.set(ks.map(k => [X(k), Y(0.5 * lamP(k)), 0.01]));
      const k = p * K; cur.userData.set([[X(k), Y0, 0.05], [X(k), Y1, 0.05]]);
      vl(`k = ${Math.round(k)} · λ_PPO = ${lamP(k).toFixed(2)} · λ_D = ${(1 - lamP(k)).toFixed(2)} · 阈值 ${thr(k).toFixed(2)} m · 自适应 lr ${lamP(k) > 0.1 ? '开' : '关'}`);
      /* toy MSE: both offset curves differ from the reference by the same |delta| at every sample */
      const mse = d => { let s = 0; for (let i = 0; i < 40; i++) { const x = i / 39 * 2.4; s += (hump(x, d) - hump(x, 0)) ** 2; } return s / 40; };
      tl(`DAgger 均方\n高 ${mse(0.16).toFixed(4)} · 低 ${mse(-0.16).toFixed(4)}`);
      cap(md === 0 ? '论文：λ_D 在前半程从 1 线性降到 <b>0.1</b>；λ_PPO 在 k = 1000 越过 0.1，此后才开自适应 lr 和 KL 控制' : '代码：K = 30,000，爬升终点仍是 10,000；终止放宽从 <b>第 1000 次</b>才开始；灰线是门控下限 0.5·λ_PPO');
    } };
  }

  /* ---------- scene 9: one policy, many skills ---------- */
  function s9(G) {
    let mv = +(OPT[0] ?? 0);
    const W = new THREE.Group(); G.add(W); W.add(L.grid(40, 40)); const G0 = G; G = W;
    const OB = [[2.5, 0.36, 'step', 'π_step（36 cm）'], [6.5, 0.58, 'climb', 'π_climb58'], [10.5, 0.76, 'climb', 'π_climb76'], [14.5, 0.4, 'vault', 'π_vault']];
    const boxes = OB.map(([x, h], i) => obstacle(G, x, 0, 1.4, h, i === 3 ? 0.5 : 0.9, COL.box));
    const rob = robot(COL.robot); G.add(rob);
    const sk = dynLab(G, [8, 2.8, 0], { size: 14, border: 'rgba(79,201,138,.8)' }), cmdL = dynLab(G, [8, 3.6, 0], { size: 13 });
    const hand = robot(0xffd36b, { opacity: 0.6 }); G.add(hand);
    const ctls = [{ label: '障碍', items: ['固定', '中途挪 0.5 m'], get: () => mv, set: k => { mv = k; } }];
    return { ctls, update(p) {
      const shift = mv === 1 ? 0.5 * seg(p, 0.4, 0.5) : 0;
      const XO = OB.map(([x], i) => x + (i === 2 ? shift : 0)); boxes[2].position.x = XO[2] + 0.45;
      hand.visible = mv === 1 && p > 0.36 && p < 0.55; if (hand.visible) pose(hand, clip('stand', 0), [XO[2] + 0.45, 0, 1.4], -PI / 2);
      /* path: run between obstacles; each obstacle occupies a fixed share of the timeline */
      const T = p * 5, i = Math.min(3, Math.floor(T * 0.999)), u = T - i, [ox, h, kind, name] = OB[i], x0 = (i === 0 ? -2.0 : XO[i - 1] + 1.2), x1 = XO[i] - 0.5;
      let x, q, base = 0;
      if (u < 0.55) { x = L.lerp(x0, x1, u / 0.55); q = clip('run', p * 18); }
      else { const v = (u - 0.55) / 0.45; x = L.lerp(x1, XO[i] + (kind === 'vault' ? 1.1 : 0.5), v); q = kind === 'climb' ? clip('climb', 0, v, h) : clip(kind, 0, v, h); if (kind === 'climb' && v > 0.95) base = 0; }
      if (T >= 4) { x = L.lerp(XO[3] + 1.1, XO[3] + 3.5, T - 4); q = clip('run', p * 18); }
      pose(rob, q, [x, base, 0]); W.position.x = -x + 1.0;
      sk(T >= 4 ? '走跑（π_loco）' : u < 0.55 ? `接近：深度图里看到 ${Math.round(h * 100)} cm` : `执行技能 · 训练时对应 ${name}`); sk.move([x, 2.3, 0]);
      cmdL('速度命令：run_forward（one-hot 第 6 位）'); cmdL.move([x, 2.85, 0]);
      cap(mv === 1 && p > 0.38 && p < 0.6 ? '第三个箱子被挪了 0.5 m：学生<b>按深度图调整接近距离和起跳时机</b>（图 5(c) 的闭环适应）' : '命令只有“向前跑”，<b>跨、爬、翻</b>都是学生看着障碍自己选的');
    } };
  }

  /* ---------- scene 10: deployment pipeline ---------- */
  function s10(G) {
    let rl = +(OPT[0] ?? 0);
    const sub = new THREE.Group(); G.add(sub); let last = -1, F = [];
    const latL = dynLab(G, [0, -0.6, 2.6], { size: 15 });
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); last = rl; F = [];
      const N = rl === 0 ? [['MuJoCo 500 Hz\nG1 半球手', -7.5, 0x5b6b8a, 10], ['D435i 仿真深度', -4.5, COL.cam, 7], ['/dev/shm\ndepth_img_shm\n20,184 B', -1.5, 0x7a8299, 10], ['depth_backbone\n.onnx → 32', 1.5, 0x38d1ff, 7], ['student.onnx\n140 → 29', 4.5, COL.stud, 7], ['29 个关节目标\n→ 仿真桥', 7.5, COL.real, 10]]
        : [['G1 真机', -7.5, 0x5b6b8a, 9], ['D435i 30 Hz', -4.5, COL.cam, 7], ['深度预处理\n裁剪 / 缩放', -1.5, 0x7a8299, 7], ['depth_backbone\n.onnx', 1.5, 0x38d1ff, 7], ['student.onnx', 4.5, COL.stud, 7], ['PD 目标 → 电机', 7.5, COL.real, 9]];
      N.forEach(([t, x, c, go], i) => { const b = block(2.2, 1.0, 1.2, c, [x, 0.5, 0], { opacity: 0.9 }); b.userData.go = go - 1; PICKS.push(b); sub.add(b); sub.add(lab(t, [x, 1.75 + (i % 2) * 0.0, 0], { size: 13 })); });
      const keys = block(2.2, 0.3, 0.9, COL.purple, [4.5, 0.15, 3.0]); sub.add(keys, lab('键盘 w/s a/d q/e =\n→ 15 维 one-hot', [4.5, 0.2, 4.2], { size: 12 }));
      const prop = block(2.2, 0.3, 0.9, COL.loco, [1.5, 0.15, 3.0]); sub.add(prop, lab('本体 93 维\n重力 角速度 关节 动作', [1.5, 0.2, 4.2], { size: 12 }));
      F = [stream(sub, 6, COL.cam, 0.1), stream(sub, 5, COL.purple, 0.09), stream(sub, 5, COL.loco, 0.09)];
      if (rl === 1) sub.add(lab('示意：PHP 仓库没有真机部署文档', [0, 2.6, -1.5], { size: 14, color: '#ff9f80', border: 'rgba(255,122,89,.8)' }));
    }
    rebuild();
    const ctls = [{ label: '目标', items: ['MuJoCo sim2sim', '真机（示意）'], get: () => rl, set: k => { rl = k; } }];
    const bar = block(1, 0.18, 0.3, COL.gold, [-4.5, 0.09, 3.6]); G.add(bar); G.add(block(6, 0.06, 0.3, 0x46506a, [-4.5, 0.03, 3.6]));
    return { ctls, update(p) {
      if (last !== rl) rebuild();
      const q = (p * 8) % 1; F[0]([[-7.5, 0.9, 0], [-4.5, 0.9, 0], [-1.5, 0.9, 0], [1.5, 0.9, 0], [4.5, 0.9, 0], [7.5, 0.9, 0], [7.5, 0.9, -1.5], [-7.5, 0.9, -1.5], [-7.5, 0.9, 0]], q, 1);
      F[1]([[4.5, 0.4, 3.0], [4.5, 0.6, 0.6]], q, 1); F[2]([[1.5, 0.4, 3.0], [4.0, 0.6, 0.6]], q, 1);
      const lat = 60 + 20 * (0.5 + 0.5 * Math.sin(2 * PI * p * 2)); bar.scale.x = lat / 80 * 6; bar.position.x = -7.5 + lat / 80 * 3;
      latL(`观测延迟 ${lat.toFixed(0)} ms（训练时在 60–80 ms 随机）`); latL.move([-4.5, 0.2, 4.6]);
      cap(rl === 0 ? '两个进程：<code>run_php_sim.sh</code> 写深度到共享内存，<code>run_php_inference.sh</code> 读它跑两个 ONNX 并回发关节目标' : '真机路径是按 sim2sim 结构<b>推的示意</b>：论文只说零样本迁移，PHP 仓库没写真机部署步骤');
    } };
  }

  /* ---------- scene 11: results; every bar is a number from the paper ---------- */
  function s11(G) {
    let view = +(OPT[0] ?? 0); G.add(L.grid(34, 34)); const sub = new THREE.Group(); G.add(sub);
    const C1 = ['1.0 · 36', '1.0 · 58', '1.0 · 76', '2.0 · 36', '2.0 · 58', '2.0 · 76'], C2 = ['1.0 · 58', '1.0 · 76', '1.0 · 94', '2.0 · 36', '2.0 · 58', '2.0 · 76'];
    const T = [
      { t: '表 I · 基线', g: C1, s: [['Velocity Tracking', 0x8e9bb8, [1.00, 0.00, 0.00, 1.00, 0.00, 0.00]], ['Uncomposed Data', 0x9d8cff, [0.06, 0.02, 0.00, 0.37, 0.27, 0.07]], ['End-to-end Depth', 0x7cb8ff, [0.95, 0.07, 0.08, 0.78, 0.19, 0.14]], ['Ours', COL.gold, [1.00, 0.99, 0.95, 1.00, 0.99, 0.95]]] },
      { t: '表 II · 数据密度和蒸馏里的 RL', g: C2, s: [['Extreme Dist.', 0x8e9bb8, [0.99, 0.62, 0.64, 0.98, 0.60, 0.58]], ['Half Density', 0x9d8cff, [0.95, 0.32, 0.57, 0.99, 0.85, 0.81]], ['DAgger Only', COL.bad, [0.16, 0.03, 0.12, 0.63, 0.09, 0.10]], ['+ Alive', 0x7cb8ff, [1.00, 0.90, 0.96, 0.94, 0.91, 0.84]], ['+ Root', 0x4fc9c9, [1.00, 0.79, 0.75, 1.00, 0.92, 0.87]], ['Ours', COL.gold, [0.99, 0.95, 1.00, 1.00, 0.98, 0.90]]] },
      { t: '表 II · 规模', g: C2, s: [['1/4 Envs', COL.bad, [0.97, 0.00, 0.59, 0.94, 0.65, 0.58]], ['1/2 Envs', 0xff9f80, [0.94, 0.60, 0.68, 0.97, 0.79, 0.75]], ['3-layer', 0x9d8cff, [0.99, 0.02, 0.00, 0.98, 0.89, 0.81]], ['4-layer', 0x7cb8ff, [1.00, 0.94, 0.08, 1.00, 0.94, 0.88]], ['Ours', COL.gold, [0.99, 0.95, 1.00, 1.00, 0.98, 0.90]]] }
    ];
    let bars = [], last = -1;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = view; const v = T[view], Ng = v.g.length, Ns = v.s.length, gw = Math.min(4.0, 24 / Ng), w = Math.min(0.85, (gw - 0.4) / Ns);
      v.g.forEach((nm, i) => { const x0 = (i - (Ng - 1) / 2) * gw; sub.add(lab(nm + ' cm', [x0, -0.25, 2.4], { size: 16 }));
        v.s.forEach(([sn, c, vals], j) => { const x = x0 + (j - (Ns - 1) / 2) * (w + 0.06), b = block(w, 1, w, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(vals[i].toFixed(2), [x, 0, 0], { size: 11 }); sub.add(l); bars.push({ b, l, v: vals[i], o: (j % 2) * 0.55 }); }); });
      v.s.forEach(([sn, c], j) => { sub.add(lab(sn, [-10 + j * (20 / Math.max(1, Ns - 1)), 9.4, 0], { size: 14, color: css(c) })); });
      sub.add(lab(v.t, [0, 10.5, 0], { size: 18, border: 'rgba(242,193,78,.7)' }));
    }
    rebuild();
    const ctls = [{ label: '表', items: ['表 I', '表 II 上半', '表 II 下半'], get: () => view, set: k => { view = k; } }];
    const MSG = ['速度跟踪只会用脚跨，<b>58 cm 起全是 0</b>；端到端深度 RL 探索不到攀爬；Ours 六格 ≥ 0.95', '只做 DAgger 掉到 <b>0.03–0.63</b>；只给存活奖励的 RL 就拿回 0.84–1.00', '1/4 环境数在 1.0 m/s 76 cm 上是 <b>0.00</b>；4 层 MLP 在 94 cm 上只有 0.08'];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const g = seg(p, 0, 0.5); bars.forEach(({ b, l, v, o }) => { const h = Math.max(0.02, v * 7.0 * g); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.35 + o; });
      cap(MSG[view]);
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
  window.__phpDebug = { MM, depthImage, springPos, get cap() { return $('cap').textContent; } };
})();
