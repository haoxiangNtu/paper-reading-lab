'use strict';
/* BeyondMimic (arXiv 2508.08241 v4) taken apart into eleven animated scenes. Numbers come from the paper (v4, main text and
   supplement S1-S4) and from the official tracking code HybridRobotics/whole_body_tracking at commit 9db9158. Each scene's
   update(p) is a pure function of the timeline p plus the current toggles. The humanoid is hand-made. Scenes 2, 3, 5, 6, 7
   and 10 compute their numbers live; the toys are labelled so. No BeyondMimic network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { trk: 0x38d1ff, vae: 0xb48cff, diff: 0xf2a0a0, guide: 0xf0963c, rew: 0xf2c14e, ok: 0x4fc98a, bad: 0xe05d5d, sim: 0x8e9bb8, data: 0x7cb8ff, ref: 0xe05d5d, robot: 0xc9d4ea, ppo: 0x9d8cff, dim: 0x46506a, des: 0x38d1ff, amber: 0xd9a43c, white: 0xeef2fa };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const f2 = x => x.toFixed(2), f3 = x => x.toFixed(3);

  const SCENES = [
    { n: 1, part: '总览', title: '两个阶段，三种数据流', sub: '每个动作一个 PPO 策略 → DAgger 蒸馏进 VAE → 状态-潜变量扩散 → 测试时代价引导', dur: 14, cam: [0.1, 1.12, 31, [0, 3.4, 0]],
      html: dl([['第一阶段', 'PPO 跟踪，每个动作（几分钟长的参考）一个策略，同一套 MDP 和超参数'], ['第二阶段', 'DAgger 训条件 VAE（z ∈ ℝ³²），再在状态-潜变量轨迹上训扩散'], ['测试时', '可微代价 G(τ) 做分类器引导，零样本'], ['真机', 'Unitree G1；跟踪 50 Hz，扩散时 25 Hz']]) +
        '<p>左边一半是被后续工作（SONIC、SuperMimic、mjlab）沿用的跟踪设定，第 2 到 7 幕拆开讲。右边一半是本文的另一个贡献：把跟踪策略学到的技能放进一个扩散模型，推理时用代价把它拉向新任务，第 8 到 10 幕。</p>' +
        '<p>两阶段完全分开训练：扩散模型从不看参考动作，只看跟踪策略（经 VAE）跑出来的状态和潜变量。</p><p>点画面里的方块可以跳到对应那一幕。</p>' + src('Materials and Methods · Overview · 图 7') },
    { n: 2, part: '跟踪目标', title: '锚点：允许漂移，只跟相对姿态', sub: '红色是参考，青色是“期望”，白色是机器人。切换锚点相对和全局', dur: 13, cam: [0.5, 1.2, 11, [0.9, 1.0, 0.6]],
      html: dl([['锚点', '代码是 torso_link（躯干）'], ['变换 A', 'R_Δ = R_z(yaw(R_anchor R_anchor^ref⊤))'], ['位置', 'p_Δ = [p_anchor.x, p_anchor.y, p^ref_anchor.z]'], ['速度', '不变：V^des = V^ref']]) +
        '<p>训练时有推搡，真机上有建模误差，机器人迟早会偏离参考的全局位置。如果奖励按全局位置算，偏了 0.5 m 后位置项就接近 0，策略只能拼命往回拉，动作风格也就丢了。</p>' +
        '<p>本文的做法：锚点（躯干）本身仍跟全局参考，奖励里锚点项权重 0.5；其他刚体的期望位姿先“搬”到机器人脚下：保留参考的高度，偏航对齐到机器人，xy 原点放到机器人的锚点下。这样漂移只影响锚点那两项，身体各部位的位置误差只剩姿态差。</p>' +
        '<p>但期望<b>速度</b>没有跟着转（V^des = V^ref，代码也直接比较世界坐标的速度），所以偏航漂移仍会让速度项变差。读数最后一行按 1 m/s 行走算。</p>' +
        guess('漂移的距离和偏航（最多 1.2 m、0.5 rad）是我设的；姿态误差固定为 5 cm 的均方根。奖励按论文 σ_p = 0.3 当场算。') +
        src('M1 · S1 Anchor · commands.py _update_command') },
    { n: 3, part: '奖励', title: '四项高斯跟踪项，加三项正则', sub: '进度条是位置误差。切换权重：论文、旧代码、SuperMimic、mjlab', dur: 14, cam: [0.02, 1.32, 25, [0, 2.6, 0]],
      html: dl([['任务项', 'exp(−ē/σ²)，σ = 0.3, 0.4, 1.0, 3.14，各 1.0'], ['锚点', '位置、朝向各 0.5（可选，代码默认开）'], ['平滑', '‖a_t − a_{t−1}‖²，−0.1'], ['限位', '−10（SuperMimic −2）'], ['接触', '论文自接触 −0.1；旧代码任意接触 −0.1；mjlab 自碰撞 −10'], ['缩放', '每项再乘 dt = 0.02（代码）']]) +
        '<p>ē 是所有目标刚体上误差的<b>均方</b>，所以 σ 是“均方根误差的容差”：位置误差 0.3 m 时位置项降到 e⁻¹ = 0.37。四项权重相同，作者说这是有意的，好让同一套数适用所有动作。</p>' +
        '<p>正则只有三项。SuperMimic 去掉了接触项、限位从 −10 降到 −2，这一幕可以直接切过去看总奖励怎么变。</p>' +
        guess('其他误差和位置误差的比例（朝向 2×、线速度 4×、角速度 12×），以及动作变化量、限位越界量、接触个数都是我设的，为了画成一条曲线。σ 和权重是真的。') +
        src('M2 · M3 · 表 S1 · tracking_env_cfg.py RewardsCfg · SuperMimic 表 A.2 · mjlab tracking_env_cfg.py') },
    { n: 4, part: '观测', title: '策略看什么：160 维，单帧', sub: '柱高按维度。切换 BeyondMimic、SuperMimic、VAE', dur: 12, cam: [0.15, 1.2, 22, [0, 3.6, 0]],
      html: dl([['策略', 'ψ 58 + e_anchor 9 + V_imu 6 + θ−θ⁰ 29 + θ̇ 29 + a_last 29 = 160'], ['评论家', '再加 14 个刚体的位置 42 和 6D 朝向 84，共 286'], ['历史', '无。图 8A：加 4、8、25 帧历史在真机上更差'], ['旋转', 'Rot6D（旋转矩阵前两列）；四元数、轴角更差']]) +
        '<p>ψ 是参考动作当前帧的关节角和关节速度，只当“进度条”，策略不直接跟它。e_anchor 是锚点的位置误差和 Rot6D 朝向误差，是唯一的全局信息。没有可靠的状态估计时，可以去掉位置误差和线速度（代码里叫 WoStateEstimation 变体）。</p>' +
        '<p>SuperMimic 的观测不同：没有 ψ、锚点误差和线速度，多了投影重力，取 10 帧；目标另给未来 10 帧参考。它反倒和本文 VAE 解码器的本体输入几乎一样。</p>' +
        src('M4 · S1 Observation · tracking_env_cfg.py ObservationsCfg · SuperMimic 表 A.1 · M9') },
    { n: 5, part: '动作与 PD', title: '设定点不是位置目标，是力矩的中间量', sub: '单关节当场积分。切换 ω 和关节', dur: 14, cam: [0.02, 1.25, 20, [0.9, 3.4, 0]],
      html: dl([['增益', 'k_p = I_arm ω²，k_d = 2 I_arm ζ ω，ζ = 2'], ['ω', '10 Hz（图 S2 消融了 5、10、25 Hz 和 ASAP 的手调值）'], ['缩放', 'α = 0.25 τ_max / k_p'], ['膝', 'k_p = 99.1，k_d = 6.31，α = 0.351 rad'], ['腕横滚', 'k_p = 14.25，k_d = 0.907，α = 0.439 rad']]) +
        '<p>一个有意思的后果：α 和 k_p 成反比，所以动作 a = 1、关节还在零位时，PD 给出的力矩总是 k_pα = 0.25 τ_max，与 ω 无关。ω 改变的是“这个力矩多快、多硬地把关节推到设定点”，以及受外力时让开多少。</p>' +
        '<p>ζ = 2 是按电枢算的。膝关节的连杆子树惯量是电枢的 4.4 倍（表 S4），算上它，实际阻尼比只有 2 × √(0.0251/0.1366) = 0.86，实际自然频率 4.3 Hz。作者说选过阻尼正是因为“只算电枢会低估惯量”。腕横滚的电枢占 91%，几乎就是标称值。</p>' +
        guess('不含重力、摩擦和其他关节的耦合。0.05 s 时设定点从 0 跳到 α（a = 1），0.3 s 起加 20 N·m 的外部负载（膝）或 4 N·m（腕）。轴惯量用表 S4 名义位姿的值，实际随构型变。') +
        src('M5 · S1 Heuristically Designed Parameters · 表 S3、S4 · 图 S2 · robots/g1.py') },
    { n: 6, part: '终止与推搡', title: '倾斜终止：论文写 0.8 rad，代码是 0.8 的重力差', sub: '进度条是倾斜角。切换偏航误差；切到推搡时间线', dur: 14, cam: [0.12, 1.2, 15, [0.6, 1.8, 0]],
      html: dl([['高度', '锚点或任一末端 |e_z| > 0.25 m'], ['论文倾斜', '‖e_R,anchor‖ > 0.8 rad（45.8°，含偏航）'], ['代码倾斜', '|g_z^ref − g_z| > 0.8（直立时 78.5°，不含偏航）'], ['推搡', '每 1–3 s，Δv_xy ±0.5、Δv_z ±0.2 m/s，Δω ±0.52/±0.52/±0.78 rad/s'], ['回合', '10 s（代码）']]) +
        '<p>两种倾斜判据差得很远。按论文，躯干歪过 46° 就重来；按代码，要歪到 78.5°。如果偏航还有误差，论文的判据更早触发，甚至机器人站得笔直、只是转错了 46° 也会终止；代码的判据完全不看偏航。</p>' +
        '<p>SuperMimic 附录 A 写的是代码这一版。v3 的说法“只看俯仰和横滚”也和代码一致。</p>' +
        '<p>推搡是瞬时的：在当前根速度上加一个随机增量。表 S2 把 1–3 s 叫“持续时间”，其实是两次推搡的间隔。</p>' +
        guess('机器人的倾斜方向（向前）和推搡在画面里的箭头长度是示意；判据数值和推搡的采样是按论文和代码的范围当场算的（种子固定）。') +
        src('S1 Termination · 表 S2 · terminations.py · tracking_env_cfg.py EventCfg · Isaac Lab push_by_setting_velocity') },
    { n: 7, part: '自适应采样', title: '从难的地方多开始几次', sub: '切换均匀、论文的 K = 3 和代码的 K = 1；柱高是起点的采样概率', dur: 16, cam: [0.02, 1.2, 23, [0, 2.6, 0]],
      html: dl([['区间', '参考动作每 1 s 一个区间'], ['平滑', 'f̄ ← 0.999 f̄ + 0.001 f'], ['地板', 'f̄ + 0.1/S'], ['核', 'k(u) = 0.8ᵘ，u ∈ {0, 1, 2}（论文）；代码 K = 1'], ['采样', 'Multinomial(p̂₁…p̂_S)']]) +
        '<p>长参考里难段（侧手翻、旋转跳）只占一点时间。均匀采起点时，大部分回合在难段之前就因为别的原因结束了，或者在难段一摔就重来，难段练得很少。自适应采样按每个区间的失败率加权，失败多的地方多开始。</p>' +
        '<p>核的作用：失败往往是之前一两秒的动作造成的，所以把第 s+1、s+2 个区间的失败也算一部分给第 s 个，起点落在难段之前一点，可以练“进入”难段。代码在 2025-10-03 把核长度改成了 1，这个效果就没有了。</p>' +
        toyb('30 个区间，第 8–9、14、20–21 个区间难（我设的）。每次迭代 8 个回合，按期望值推演：从起点往后走最多 10 个区间，每个区间按失败率终止；访问一次技能涨一点。为了在 150 次迭代内看出差别，平滑系数用 0.1 而不是 0.001。读数是页面算的，和论文的迭代数无关。') +
        src('M 方法 Adaptive Sampling · S1 · v3 式 (3) · commands.py _adaptive_sampling · 提交 f8e20c8') },
    { n: 8, part: 'VAE 蒸馏', title: '把一批跟踪策略压进一个 32 维的潜空间', sub: '编码器只看参考，解码器看本体；DAgger 循环', dur: 15, cam: [0.2, 1.16, 27, [-0.6, 2.6, -0.6]],
      html: dl([['编码器', 'E(ψ, e_anchor)：67 → [2048, 1024, 512] → z ∈ ℝ³²'], ['解码器', 'D(z, [g, V_imu, θ, θ̇, a_last])：32 + 96 → [2048, 1024, 512] → â ∈ ℝ²⁹'], ['教师', '跟踪策略 [512, 256, 128]'], ['损失', '‖â − a‖² + 0.01 · KL'], ['训练', 'DAgger，lr 5e−4，梯度累积 15 步']]) +
        '<p>这是条件 VAE，“条件”是解码器的本体输入：编码器只拿到“要做什么动作”（参考相位和锚点误差），解码器再结合“身体现在怎样”给出动作。作者说编码参考动作比编码原始 PD 动作容易，因为后者很不规则。</p>' +
        '<p>DAgger：让学生（VAE）自己在仿真里跑，在它走到的状态上请教师（对应动作的跟踪策略）给动作标签，再回归。这样学生见过自己犯错后的状态。</p>' +
        '<p>按维度算（我的计算，假设编码器输出均值和对数方差共 64 维）：编码器约 2.80M 参数，解码器约 2.90M。</p>' +
        guess('学生在仿真里“跑”的画面是示意。教师的个数（画了 4 个）是随手画的，论文没说蒸馏了多少个策略，只说“选出的”策略。') +
        src('M9 · 表 S6 · 图 7B(i) · S4 Diffusion') },
    { n: 9, part: '状态-潜变量扩散', title: '每个 token 有自己的噪声步', sub: '历史和当前状态固定为干净的，未来被去噪。可以加关键帧', dur: 15, cam: [0.06, 1.22, 25.5, [-0.7, 3.0, 0]],
      html: dl([['序列', '历史 4 + 当前 + 视野 16 步，每步一个状态 s 和一个潜变量 z'], ['时长', '25 Hz：历史 0.16 s，视野 0.64 s'], ['噪声', '每个 token 独立的 k，训练时 k ~ U(0, K)'], ['网络', 'Transformer 编码器，6 层，8 头，512 维，约 19.8M'], ['去噪', '20 步，每次推理约 20 ms']]) +
        '<p>训练时每个 token 的噪声步独立随机，所以推理时可以把已知的部分（历史观测、当前状态、关键帧）设成 k = 0，只去噪未知的部分。这就是“补全”：同一个模型既能跟命令走，也能把稀疏的关键帧连成连贯的动作。</p>' +
        '<p>去噪结束后只用一个东西：当前的潜变量 z_t，交给 VAE 解码器，配上最新的本体观测算出动作。视野里其余的预测只用来算代价。</p>' +
        '<p>状态的表示：根部相对当前帧的角色坐标系（式 S1、S2），各刚体相对自己那一帧的根（式 S3），再乘一个强调根部维度的随机投影 P = [AB I]ᵀ，c = 6。</p>' +
        guess('每个 token 的高度是一条正弦加噪声，只表示“噪声多大”；真实的 token 是几十维的状态或 32 维的潜变量。噪声表用的余弦表，论文没说用哪种。') +
        src('M10 · S3 Diffusion State 式 (S1)–(S3) · 表 S7 · 图 7B(ii)') },
    { n: 10, part: '代价引导', title: '在去噪的每一步减去代价的梯度', sub: '六条样本从噪声收敛。切换摇杆、路点、路点 + 避障', dur: 16, cam: [0.0, 0.66, 12, [2.3, 0, -0.4]],
      html: dl([['式 M11', '∇log p(τ|τ*) = ∇log p(τ) − ∇G(τ)'], ['摇杆 (S5)', 'G = ½Σ‖V_xy,i − g_v‖²'], ['路点 (S6)', '远处拉位置，近处压速度，权重 e^(−2d)'], ['避障 (S7)(S8)', '刚体到障碍的 SDF 减半径，过松弛对数障碍'], ['组合', '代价直接相加']]) +
        '<p>扩散模型提供“像人的轨迹长什么样”（先验），代价提供“这次要去哪里”。两者在每一步去噪时相加。代价不需要写正则或风格项，因为不像人的轨迹先验本来就不给。</p>' +
        '<p>论文图 5A 画的就是这个过程：摇杆右转命令下，第 8、12、16、20 次迭代的预测轨迹逐渐收拢。</p>' +
        toyb('先验不是学到的网络，而是 54 条手写模板（6 个方向 × 3 种曲率 × 3 种速度）上的高斯混合，去噪器给出精确的后验均值；引导减在预测的干净轨迹上，按 DDIM 更新。为了看得见，视野用 16 步 × 0.25 s = 4 s（论文是 16 × 0.04 = 0.64 s）。代价按 (S5)–(S8) 写，梯度是解析的，读数当场算。') +
        src('M11 · S3 Task Costs (S5)–(S8) · 图 5A、6B') },
    { n: 11, part: '部署', title: '谁在什么频率上跑，以及 SuperMimic 拿走了什么', sub: '切换部署时序和 SuperMimic 继承', dur: 14, cam: [0.02, 1.25, 29, [0, 4.4, 0]],
      html: dl([['状态估计', '500 Hz，广义动量观测器 + 卡尔曼滤波'], ['跟踪策略', '50 Hz，ONNX Runtime，CPU，&lt; 1 ms'], ['扩散', '异步线程，RTX 4060 Mobile + TensorRT，约 20 ms'], ['VAE 解码器', 'CPU 同步，25 Hz'], ['代价梯度', 'CppAD，每次去噪迭代']]) +
        '<p>扩散太慢，不能放在控制环里同步跑，所以它在另一个线程里算出最新的 z_t；控制环每 40 ms 用最新的 z_t 和最新的观测解码出动作。这也是要用潜空间的第二个理由：轻量的解码器能用最新的观测，弥补扩散的延迟。</p>' +
        '<p>切到“SuperMimic 继承”看 SuperMimic 附录 A 和本文的逐项对照：绿色原样沿用，橙色改动并注明，红色去掉并注明，紫色是没有注明但实际不同的。</p>' +
        guess('时序图里线程的先后关系是我按论文给的频率和耗时推断的，论文没有画调度图。') +
        src('S4 · 精读页“和 SuperMimic 的关系”对照表') }
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

  /* ---------- 3D helpers (same as interactives/phc/phc.js) ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.3, phi: 1.0, dist: 24, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  if (!S || !window.THREE) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);
  let LABS = [], refDist = 24, PICKS = [];
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  const T3 = window.THREE;
  const _M = T3 ? new T3.Matrix4() : null, _P = T3 ? new T3.Vector3() : null, _Q0 = T3 ? new T3.Quaternion() : null, _Sv = T3 ? new T3.Vector3() : null, _C = T3 ? new T3.Color() : null;
  const BOX = T3 ? new T3.BoxGeometry(1, 1, 1) : null, BALL = T3 ? new T3.SphereGeometry(1, 12, 9) : null;
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
  function ribbon(G, n, color, w = 0.06, o = {}) {
    const pos = new Float32Array(n * 6), idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: o.opacity ?? 1 })); m.frustumCulled = false; m.renderOrder = o.order ?? 2; G.add(m);
    m.userData.set = pts => { const k = Math.min(n, pts.length); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, Math.max(0, k - 1))] || [0, 0, 0], z = q[2] ?? 0; pos[i * 6] = q[0]; pos[i * 6 + 1] = q[1] - w / 2; pos[i * 6 + 2] = z; pos[i * 6 + 3] = q[0]; pos[i * 6 + 4] = q[1] + w / 2; pos[i * 6 + 5] = z; } g.attributes.position.needsUpdate = true; };
    return m;
  }
  function panel(G, x, y, z, w, h) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x0c1220, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }
  function flat(G, x, z, w, d, color, op = 0.35) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.01, z); G.add(m); return m; }

  /* ---------- the hand-made humanoid (copied from interactives/phc/phc.js) ---------- */
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
      arms.forEach(a => { a.up.rotation.z = a.s * (q.spread || 0.12); });
    };
    return G;
  }
  const STAND = 0.65;
  function clip(name, t) {
    const pi = Math.PI;
    if (name === 'run') {
      const ph = 2 * pi * t / 0.62, s = Math.sin(ph), air = Math.max(0, Math.sin(2 * ph));
      return { p: [0, STAND - 0.03 + 0.06 * air, 0], pitch: 0.16, hL: 0.8 * s, hR: -0.8 * s, kL: 0.4 + 1.0 * Math.max(0, -Math.cos(ph + 0.5)), kR: 0.4 + 1.0 * Math.max(0, Math.cos(ph + 0.5)), sL: -0.8 * s, sR: 0.8 * s, eL: 1.3, eR: 1.3 };
    }
    const ph = 2 * pi * t / 0.9, s = Math.sin(ph);
    return { p: [0, STAND - 0.015 + 0.015 * Math.cos(2 * ph), 0], pitch: 0.04, hL: 0.48 * s, hR: -0.48 * s, kL: 0.2 + 0.55 * Math.max(0, -Math.cos(ph + 0.6)), kR: 0.2 + 0.55 * Math.max(0, Math.cos(ph + 0.6)), sL: -0.4 * s, sR: 0.4 * s, eL: 0.45, eR: 0.45 };
  }
  const still = () => ({ p: [0, STAND, 0], pitch: 0, hL: 0.02, hR: 0.02, kL: 0.04, kR: 0.04, sL: 0, sR: 0, eL: 0.15, eR: 0.15 });
  function perturb(q, e) { const o = { ...q }; o.hL = q.hL + e * 1.4; o.hR = q.hR - e * 1.1; o.sL = q.sL + e * 2.2; o.sR = q.sR - e * 1.8; o.pitch = (q.pitch || 0) + e * 0.6; return o; }
  /* place a hand-made robot: root at `at` (scene units), scale sc, yaw about +y */
  function pose(r, q, at, sc, yaw) { const c = { ...q, yaw: yaw ?? q.yaw, p: [0, 0, 0] }; r.userData.set(c); r.position.set(at[0] + q.p[0] * sc, at[1] + q.p[1] * sc, at[2] + q.p[2] * sc); r.scale.setScalar(sc); }

  /* controls: api.ctls = [{label, items, get, set}], plus optional api.ctlExtra(box) */
  function buildCtl() {
    const box = $('ctl'); box.innerHTML = ''; box.hidden = true; if (!api) return;
    (api.ctls || []).forEach((c, gi) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-g="${gi}" data-k="${k}" aria-pressed="${c.get() === k}">${t}</button>`).join('');
      box.appendChild(row); box.hidden = false;
    });
    if (api.readout) { const r = document.createElement('div'); r.className = 'rd'; r.id = 'rd'; box.appendChild(r); box.hidden = false; }
  }
  function syncCtl() { (api?.ctls || []).forEach((c, gi) => { $('ctl').querySelectorAll(`button[data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(c.get() === +b.dataset.k))); }); }
  let lastRd = null;
  const rd = h => { const el = $('rd'); if (el && h !== lastRd) { lastRd = h; el.innerHTML = h; } };

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    G.add(L.grid(36, 36));
    const zone = (x, w, c, t) => { flat(G, x, 0, w, 7, c, 0.07); G.add(lab(t, [x, 0.1, 4.4], { size: 20, color: css(c) })); };
    zone(-8.3, 12.2, COL.trk, '第一阶段：RL 跟踪'); zone(1.2, 6.6, COL.vae, '第二阶段：离线蒸馏'); zone(8.6, 8, COL.guide, '测试时：引导 + 真机');
    const data = block(2.2, 1.4, 1.8, COL.data, [-12.6, 0.7, 0]);
    const pis = [0, 1, 2, 3].map(i => block(1.3, 0.55, 1.3, COL.trk, [-7.4, 0.35 + i * 0.75, 0]));
    const ppo = block(1.5, 0.9, 1.3, COL.ppo, [-4.4, 0.45, 0]);
    const enc = block(1.4, 1.6, 1.4, COL.vae, [-0.6, 0.8, 0]), zc = block(0.5, 0.5, 0.5, COL.white, [0.6, 0.8, 0]), dec = block(1.4, 1.6, 1.4, COL.vae, [1.8, 0.8, 0]);
    const dif = block(2.2, 2.2, 1.8, COL.diff, [5.4, 1.1, 0]), cost = block(1.6, 1.0, 1.4, COL.guide, [5.4, 3.4, 0]);
    G.add(data, ...pis, ppo, enc, zc, dec, dif, cost);
    const rob = robot(COL.robot); G.add(rob);
    [[data, 1], [pis[0], 2], [pis[1], 3], [pis[2], 3], [pis[3], 3], [ppo, 6], [enc, 7], [dec, 7], [zc, 7], [dif, 8], [cost, 9]].forEach(([m, g]) => { m.userData.go = g; PICKS.push(m); });
    G.add(lab('参考动作 q^ref', [-12.6, 2.0, 0], { size: 20 }), lab('π₁ … π_N（每个动作一个）', [-7.4, 3.5, 0], { size: 19 }), lab('PPO · 表 S5', [-4.4, 1.5, 0], { size: 19 }));
    G.add(lab('E', [-0.6, 2.0, 0], { size: 22 }), lab('z ∈ ℝ³²', [0.6, -0.1, 1.3], { size: 18 }), lab('D', [1.8, 2.0, 0], { size: 22 }), lab('VAE · DAgger', [0.6, 3.3, 0], { size: 20, color: css(COL.vae) }));
    G.add(lab('状态-潜变量扩散\nTransformer', [5.4, 2.4, -1.4], { size: 19 }), lab('代价 G(τ)', [5.4, 4.3, 0], { size: 20 }), lab('G1 · 25 Hz', [10.8, 3.6, 0], { size: 20 }));
    const f = { a: stream(G, 5, COL.data), b: stream(G, 5, COL.trk), c: stream(G, 5, COL.vae), d: stream(G, 5, COL.diff), e: stream(G, 4, COL.guide), g: stream(G, 4, COL.robot) };
    return { update(p) {
      const q = (p * 18) % 1;
      pose(rob, clip('walk', p * 13), [10.8, 0, 0], 2.6, -Math.PI / 2);
      const a1 = seg(p, 0, 0.08), a2 = seg(p, 0.25, 0.32), a3 = seg(p, 0.5, 0.57), a4 = seg(p, 0.75, 0.82);
      f.a([[-11.5, 0.8, 0], [-8.1, 0.8, 0]], q, a1); f.b([[-6.7, 1.0, 0], [-1.3, 1.0, 0]], q, a2);
      f.c([[2.5, 0.9, 0], [4.3, 0.9, 0]], q, a3); f.e([[5.4, 2.9, 0], [5.4, 2.2, 0]], q, a4); f.g([[6.5, 1.1, 0], [10.0, 1.4, 0]], q, a4);
      f.d([[-4.4, 0.9, 0.8], [-6.6, 0.9, 0.8]], q, a1 * (1 - a2));
      pis.forEach(m => glow(m, 0.6 * a1 * (1 - a3))); glow(ppo, 0.7 * a1 * (1 - a2)); [enc, dec, zc].forEach(m => glow(m, 0.6 * a2 * (1 - a4))); glow(dif, 0.6 * a3); glow(cost, 0.8 * a4);
      cap(p < 0.25 ? '第一阶段：每条参考动作用<b>同一套 MDP 和 PPO 超参数</b>训一个跟踪策略' : p < 0.5 ? '把选出的跟踪策略用 <b>DAgger</b> 蒸馏进一个条件 VAE：编码器只看参考，解码器看本体' : p < 0.75 ? '用 VAE 跑出状态-潜变量轨迹，训练<b>扩散模型</b>。不含任何参考信息' : '测试时：<b>代价的梯度</b>在每一步去噪时引导；解码当前潜变量得到动作');
    } };
  }

  /* ---------- scene 2: anchor-relative target ---------- */
  function s2(G) {
    let mode = +(OPT[0] ?? 0);
    G.add(L.grid(20, 20));
    const ref = robot(COL.ref, { opacity: 0.42 }), des = robot(COL.des, { opacity: 0.42 }), rob = robot(COL.robot); G.add(ref, des, rob);
    const drift = wire(G, [[0, 0.03, 0], [1, 0.03, 0]], COL.amber, { opacity: 0.9 });
    const tagR = lab('参考（全局）', [0, 0, 0], { size: 18, color: css(COL.ref) }), tagD = lab('期望 A(T^ref)', [0, 0, 0], { size: 18, color: css(COL.des) }), tagB = lab('机器人', [0, 0, 0], { size: 18 }), tagV = lab('漂移', [0, 0, 0], { size: 18, color: css(COL.amber) });
    G.add(tagR, tagD, tagB, tagV);
    const ctls = [{ label: '期望位姿', items: ['锚点相对（论文）', '全局（对照）'], get: () => mode, set: k => { mode = k; } }];
    const SC = 2.2, EP = 0.05;
    return { ctls, readout: true, update(p) {
      const t = p * 11, q = clip('walk', t), k = seg(p, 0.08, 0.85);
      const xr = -1.4 + 2.8 * p, D = [-0.45 * k, 1.1 * k], psi = 0.5 * k, d = Math.hypot(D[0], D[1]);
      const yawR = Math.PI / 2;
      pose(ref, q, [xr, 0, 0], SC, yawR);
      pose(rob, perturb(q, 0.06), [xr + D[0], 0, D[1]], SC, yawR + psi);
      if (mode === 0) { des.visible = true; pose(des, q, [xr + D[0], 0, D[1]], SC, yawR + psi); } else des.visible = false;
      drift.geometry.setFromPoints([new THREE.Vector3(xr, 0.04, 0), new THREE.Vector3(xr + D[0], 0.04, D[1])]); drift.computeLineDistances?.();
      tagR.position.set(xr, 2.25, 0); tagB.position.set(xr + D[0], 2.6, D[1]); tagD.position.set(xr + D[0] + 0.2, 2.95, D[1]); tagD.visible = mode === 0;
      tagV.position.set(xr + D[0] / 2, 0.3, D[1] / 2); tagV.visible = d > 0.15;
      /* body-position error: mean squared over bodies. Global: drift plus the yaw-induced offset of limbs (~0.25 m lever) plus pose error */
      const lever = 0.25 * SC * 0.65, yawOff = 2 * lever * Math.sin(psi / 2);
      const eG = d * d + yawOff * yawOff + EP * EP, eA = EP * EP;
      const rG = Math.exp(-eG / 0.09), rA = Math.exp(-eA / 0.09), rAnchor = Math.exp(-(d * d) / 0.09);
      rd(`漂移 ${f2(d)} m，偏航 ${f2(psi)} rad<br>全局：ē_p = ${f3(eG)} m²，r_p = ${f3(rG)}<br>锚点相对：ē_p = ${f3(eA)} m²，r_p = ${f3(rA)}<br>锚点位置项（权重 0.5）= ${f3(rAnchor)}<br>速度不转：1 m/s 时 e_v ≈ ${f2(2 * Math.sin(psi / 2))} m/s，r_v = ${f3(Math.exp(-((2 * Math.sin(psi / 2)) ** 2)))}`);
      cap(mode === 0 ? `期望位姿被搬到机器人脚下：漂移 ${f2(d)} m 时身体位置项仍是 <b>${f2(rA)}</b>，只有锚点那项（权重 0.5）掉到 ${f2(rAnchor)}` : `如果按全局位置算，漂移 ${f2(d)} m 时身体位置项掉到 <b>${f3(rG)}</b>，奖励几乎只剩“往回拉”`);
    } };
  }

  /* ---------- scene 3: reward terms ---------- */
  function s3(G) {
    let ws = +(OPT[0] ?? 0);
    G.add(L.grid(26, 26));
    const W = [ // [limit, contact] per weight set
      { n: '论文 v4', lim: -10, con: -0.1 }, { n: '旧代码', lim: -10, con: -0.1 }, { n: 'SuperMimic', lim: -2, con: 0 }, { n: 'mjlab', lim: -10, con: -10 }];
    const TERMS = [['r_p', COL.trk, 1], ['r_R', COL.trk, 1], ['r_v', COL.trk, 1], ['r_ω', COL.trk, 1], ['锚点 p', COL.data, 0.5], ['锚点 R', COL.data, 0.5], ['平滑', COL.rew, -0.1], ['限位', COL.bad, 0], ['接触', COL.ppo, 0]];
    const X0 = -10.4, DX = 2.6, bars = [], Y0 = 3.2;
    G.add(block(24, 0.04, 0.6, COL.dim, [0, Y0, 0], { edges: false }));
    TERMS.forEach(([t, c], i) => { const b = block(1.2, 1, 1.2, c, [X0 + i * DX, 0.5, 0], { edges: false }); G.add(b); bars.push(b); G.add(lab(t, [X0 + i * DX, Y0 - 0.45, 1.0], { size: 19 })); });
    G.add(lab('正：任务项（×权重）', [-5.2, 7.0, 0], { size: 19, color: css(COL.trk) }), lab('负：正则（×权重），柱子向下', [7.8, 7.0, 0], { size: 19, color: css(COL.bad) }));
    const ctls = [{ label: '权重', items: W.map(w => w.n), get: () => ws, set: k => { ws = k; } }];
    return { ctls, readout: true, update(p) {
      const e = 0.5 * seg(p, 0.05, 0.92), w = W[ws];
      const eb = [e, 2 * e, 4 * e, 12 * e], sg = [0.3, 0.4, 1.0, 3.14];
      const rt = eb.map((x, i) => Math.exp(-(x * x) / (sg[i] * sg[i])));
      const ra = [Math.exp(-(e * e) / 0.09), Math.exp(-((1.5 * e) ** 2) / 0.16)];
      const da = 0.3 + 2 * e, lim = Math.max(0, e - 0.2), con = (e > 0.3 ? 1 : 0) + (e > 0.42 ? 1 : 0);
      const v = [rt[0], rt[1], rt[2], rt[3], 0.5 * ra[0], 0.5 * ra[1], -0.1 * da, w.lim * lim, w.con * con];
      v.forEach((x, i) => { const h = Math.max(0.02, Math.min(x >= 0 ? 6 : Y0 - 0.05, Math.abs(x) * 3.2)), b = bars[i]; b.scale.y = h; b.position.y = x >= 0 ? Y0 + h / 2 : Y0 - h / 2; b.visible = !(i === 8 && w.con === 0); });
      const tot = v.reduce((a, b) => a + b, 0);
      rd(`位置误差 RMS ${f2(e)} m（其他误差按 2×、4×、12× 设）<br>任务 ${f3(rt[0])} / ${f3(rt[1])} / ${f3(rt[2])} / ${f3(rt[3])}，锚点 ${f3(v[4])} + ${f3(v[5])}<br>平滑 ${f3(v[6])}，限位 ${f3(v[7])}${w.con ? `，接触 ${f3(v[8])}` : '，无接触项'}<br><b>每步 r = ${f3(tot)}，乘 dt 后 ${(tot * 0.02).toFixed(4)}</b>（上限 0.1）`);
      cap(e < 0.2 ? `误差小时任务项接近满分：最多 4 + 2 × 0.5 = <b>5</b>，乘 0.02 后每步 0.1` : (ws === 2 ? `SuperMimic：没有接触项，限位只有 −2，误差大时总奖励 <b>${f2(tot)}</b>` : ws === 3 ? `mjlab：自碰撞一次就是 −10，误差大时总奖励 <b>${f2(tot)}</b>` : `误差大时，限位 −10 很快压过任务项，总奖励 <b>${f2(tot)}</b>`));
    } };
  }

  /* ---------- scene 4: observation stacks ---------- */
  function s4(G) {
    let view = +(OPT[0] ?? 0); const sub = new THREE.Group(); G.add(sub); G.add(L.grid(26, 26));
    const V = [
      { t: 'BeyondMimic（代码，单帧）', cols: [['策略 160', [['ψ 参考 θ, θ̇', 58, COL.ref], ['e_anchor 位置', 3, COL.amber], ['e_anchor Rot6D', 6, COL.amber], ['线速度', 3, COL.sim], ['角速度', 3, COL.sim], ['θ − θ⁰', 29, COL.trk], ['θ̇', 29, COL.trk], ['a_last', 29, COL.rew]]], ['评论家 286', [['策略的 160', 160, COL.dim], ['刚体位置 14×3', 42, COL.data], ['刚体朝向 14×6', 84, COL.vae]]]] },
      { t: 'SuperMimic 策略（表 A.1，10 帧）', cols: [['本体 93 × 10 = 930', [['θ − θ⁰ ×10', 290, COL.trk], ['θ̇ ×10', 290, COL.trk], ['角速度 ×10', 30, COL.sim], ['投影重力 ×10', 30, COL.guide], ['a_{t−1} ×10', 290, COL.rew]]], ['目标', [['未来 10 帧参考（维度没写）', 0, COL.ref]]]] },
      { t: 'BeyondMimic 的 VAE（M9）', cols: [['编码器输入 67', [['ψ', 58, COL.ref], ['e_anchor', 9, COL.amber]]], ['解码器输入 128', [['z', 32, COL.white], ['g 投影重力', 3, COL.guide], ['V_imu', 6, COL.sim], ['θ', 29, COL.trk], ['θ̇', 29, COL.trk], ['a_last', 29, COL.rew]]]] }
    ];
    let segs = [], last = -1;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); segs = []; last = view; const v = V[view];
      const tot = Math.max(...v.cols.map(c => c[1].reduce((a, r) => a + r[1], 0))), H = 7.2 / tot;
      v.cols.forEach(([name, rows], ci) => {
        const x = -4.8 + ci * 8.4; let y = 0.05, ly = -1;
        rows.forEach(([t, d, c]) => { const h = d ? Math.max(0.12, d * H) : 0.6; const b = block(1.8, Math.max(0.04, h - 0.04), 1.4, c, [x, y + h / 2, 0], { opacity: d ? 1 : 0.4 }); sub.add(b); ly = Math.max(y + h / 2, ly + 0.66); const l = lab(`${t}${d ? ' · ' + d : ''}`, [x + 3.1, ly, 0], { size: 17 }); sub.add(l); if (Math.abs(ly - (y + h / 2)) > 0.05) sub.add(L.line([[x + 0.95, y + h / 2, 0], [x + 1.7, ly, 0]], 0x8e9bb8, { opacity: 0.6 })); segs.push({ b, l, y0: y, h }); y += h; });
        sub.add(lab(name, [x, Math.max(y, ly) + 0.75, 0], { size: 22, border: 'rgba(56,209,255,.7)' }));
      });
      sub.add(lab(v.t + ' · 柱高 ∝ 维度', [0, -0.7, 2.2], { size: 19 }));
    }
    rebuild();
    const ctls = [{ label: '看', items: ['BeyondMimic', 'SuperMimic', 'VAE'], get: () => view, set: k => { view = k; } }];
    const MSG = ['参考相位 ψ 占了 58 维；全局信息只有锚点的 <b>9 维</b>误差，加线速度 3 维', 'SuperMimic 的本体观测是 10 帧堆起来的 <b>930 维</b>，没有锚点误差和线速度', 'VAE 解码器的本体输入（去掉 z）是 96 维：<b>和 SuperMimic 一帧的 93 维只差线速度</b>'];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const g = seg(p, 0, 0.6); segs.forEach((s, i) => { const on = clamp(g * segs.length - i, 0, 1); s.b.visible = on > 0; s.b.scale.y = Math.max(0.02, on); s.b.position.y = s.y0 + s.h * on / 2; s.l.visible = on > 0.5; });
      cap(MSG[view]);
    } };
  }

  /* ---------- scene 5: low-gain PD on one joint, integrated live ---------- */
  function s5(G) {
    let wi = +(OPT[0] ?? 1), ji = +(OPT[1] ?? 0);
    const WS = [5, 10, 25], J = [{ n: '膝', Ia: 0.025101925, Ie: 0.1366, tm: 139, load: 20 }, { n: '腕横滚', Ia: 0.003609725, Ie: 0.003976, tm: 25, load: 4 }];
    const X0 = -3.4, Wd = 12.4, Y0 = 4.4, Hh = 2.2, Y1 = 0.8; panel(G, X0 - 0.3, Y1 - 0.5, -0.05, Wd + 0.6, 7.6);
    const N = 240, cq = ribbon(G, N, COL.trk, 0.07), csp = ribbon(G, N, COL.ref, 0.04, { opacity: 0.8 }), ct = ribbon(G, N, COL.rew, 0.07), cur = block(0.05, 7.2, 0.05, COL.white, [X0, Y1 + 3.3, 0], { edges: false }); G.add(cur);
    G.add(lab('关节角 q（蓝）和设定点 θ^sp（红）', [X0 + 9.0, Y0 + Hh + 0.55, 0], { size: 18 }), lab('PD 力矩 τ（黄）', [X0 + 10.5, Y1 + 0.2, 0], { size: 18 }), lab('0', [X0 - 0.5, Y1 - 0.15, 0], { size: 16 }), lab('0.6 s', [X0 + Wd, Y1 - 0.25, 0], { size: 16 }), lab('加负载', [X0 + Wd * 0.3 / 0.6, Y1 - 0.25, 0], { size: 16, color: css(COL.amber) }));
    wire(G, [[X0 + Wd * 0.5, Y1, 0], [X0 + Wd * 0.5, Y0 + Hh, 0]], COL.amber, { dashed: true, opacity: 0.6 });
    let sim = null, key = '';
    function run() {
      const j = J[ji], w = 2 * Math.PI * WS[wi], kp = j.Ia * w * w, kd = 2 * j.Ia * 2 * w, a = 0.25 * j.tm / kp;
      const dt = 1e-4, T = 0.6, M = Math.round(T / dt); let q = 0, v = 0; const Q = [], SP = [], TA = []; let tpk = 0, t95 = null;
      for (let i = 0; i <= M; i++) {
        const t = i * dt, sp = t >= 0.05 ? a : 0, ld = t >= 0.3 ? -j.load : 0, tau = kp * (sp - q) - kd * v;
        if (Math.abs(tau) > Math.abs(tpk)) tpk = tau;
        if (t95 == null && t > 0.05 && Math.abs(q - a) < 0.05 * a && t < 0.3) t95 = t - 0.05;
        v += (tau + ld) / j.Ie * dt; q += v * dt;
        if (i % Math.round(M / (N - 1)) === 0) { Q.push(q); SP.push(sp); TA.push(tau); }
      }
      const zEff = 2 * Math.sqrt(j.Ia / j.Ie), fEff = WS[wi] * Math.sqrt(j.Ia / j.Ie);
      sim = { Q, SP, TA, kp, kd, a, tpk, t95, defl: j.load / kp, zEff, fEff, j }; key = wi + ',' + ji;
    }
    const ctls = [{ label: 'ω', items: WS.map(x => x + ' Hz'), get: () => wi, set: k => { wi = k; } }, { label: '关节', items: J.map(j => j.n), get: () => ji, set: k => { ji = k; } }];
    return { ctls, readout: true, update(p) {
      if (key !== wi + ',' + ji) run();
      const s = sim, n = Math.max(2, Math.round(p * (s.Q.length - 1)) + 1), qmax = Math.max(s.a * 1.6, ...s.Q.map(Math.abs)), tmax = Math.max(1e-6, ...s.TA.map(Math.abs));
      const px = i => X0 + Wd * i / (s.Q.length - 1);
      cq.userData.set(s.Q.slice(0, n).map((y, i) => [px(i), Y0 + Hh * y / qmax, 0.02]));
      csp.userData.set(s.SP.slice(0, n).map((y, i) => [px(i), Y0 + Hh * y / qmax, 0.01]));
      ct.userData.set(s.TA.slice(0, n).map((y, i) => [px(i), Y1 + 1.4 + 1.3 * y / tmax, 0.02]));
      cur.position.x = px(n - 1);
      rd(`${s.j.n}：k_p = ${s.kp.toFixed(2)} N·m/rad，k_d = ${s.kd.toFixed(3)}，α = ${f3(s.a)} rad<br>a = 1 时零位力矩 k_pα = ${(s.kp * s.a).toFixed(2)} N·m（= 0.25 τ_max）<br>峰值力矩 ${s.tpk.toFixed(1)} N·m；到 95% 用时 ${s.t95 != null ? (s.t95 * 1000).toFixed(0) + ' ms' : '&gt; 250 ms'}<br>负载 ${s.j.load} N·m 下让开 ${f3(s.defl)} rad；有效阻尼比 ${f2(s.zEff)}，有效 ${s.fEff.toFixed(1)} Hz`);
      cap(wi === 1 ? `10 Hz：膝的 k_p 只有 <b>${sim.kp.toFixed(0)}</b>，受 ${sim.j.load} N·m 负载让开 ${f3(sim.defl)} rad。设定点不是要精确到达的位置` : wi === 0 ? `5 Hz：更软，负载下让开 <b>${f3(sim.defl)}</b> rad，跟踪变慢` : `25 Hz：更硬，让开只有 ${f3(sim.defl)} rad，但峰值力矩 <b>${sim.tpk.toFixed(0)}</b> N·m，图 S2 说会有啸叫和过冲`);
    } };
  }

  /* ---------- scene 6: two tilt criteria; push timeline ---------- */
  function s6(G) {
    let yawOn = +(OPT[0] ?? 0), view = +(OPT[1] ?? 0);
    G.add(L.grid(16, 16));
    const rob = robot(COL.robot), ref = robot(COL.ref, { opacity: 0.3 }), piv = new THREE.Group(); piv.add(rob); G.add(piv, ref);
    const gA = block(4, 0.3, 0.3, COL.dim, [3.6, 3.6, 0], { edges: false }), gB = block(4, 0.3, 0.3, COL.dim, [3.6, 2.6, 0], { edges: false });
    const fA = block(1, 0.32, 0.32, COL.trk, [1.6, 3.6, 0], { edges: false }), fB = block(1, 0.32, 0.32, COL.trk, [1.6, 2.6, 0], { edges: false });
    const thA = block(0.06, 0.6, 0.4, COL.bad, [1.6 + 4 * 0.8 / 1.6, 3.6, 0], { edges: false }), thB = block(0.06, 0.6, 0.4, COL.bad, [1.6 + 4 * 0.8 / 1.6, 2.6, 0], { edges: false });
    const gauge = [gA, gB, fA, fB, thA, thB]; G.add(...gauge);
    const lA = lab('论文 ‖e_R‖（rad）', [3.6, 4.15, 0], { size: 17 }), lB = lab('代码 |Δg_z|', [3.6, 3.15, 0], { size: 17 }), l08 = lab('0.8', [1.6 + 2, 2.0, 0.3], { size: 15, color: css(COL.bad) }); G.add(lA, lB, l08);
    /* push timeline: seeded intervals U(1,3) s and velocity increments within the paper's ranges */
    const r = L.rng(11), PU = []; let t = 0; while (true) { t += 1 + 2 * r(); if (t > 10) break; PU.push({ t, v: [(-0.5 + r()) * 1, (-0.5 + r()) * 1, (-0.2 + 0.4 * r())], w: [(-0.52 + 1.04 * r()), (-0.52 + 1.04 * r()), (-0.78 + 1.56 * r())] }); }
    const TL = new THREE.Group(); G.add(TL); const tlx = t => -5 + t; TL.add(block(10, 0.06, 0.06, COL.dim, [0, 0.03, 2.4], { edges: false }));
    PU.forEach(u => { TL.add(block(0.08, 0.5, 0.08, COL.guide, [tlx(u.t), 0.25, 2.4], { edges: false })); });
    TL.add(lab(`10 s 回合里 ${PU.length} 次推搡（种子固定）`, [0, 0.9, 2.6], { size: 17, color: css(COL.guide) }));
    const tcur = block(0.06, 0.8, 0.06, COL.white, [-5, 0.4, 2.4], { edges: false }); TL.add(tcur);
    const arrowG = new THREE.Group(); G.add(arrowG);
    const ctls = [{ label: '偏航误差', items: ['0°', '30°'], get: () => yawOn, set: k => { yawOn = k; } }, { label: '看', items: ['倾斜终止', '推搡时间线'], get: () => view, set: k => { view = k; } }];
    function rotAngle(phi, psi) { const tr = Math.cos(psi) + Math.cos(phi) + Math.cos(psi) * Math.cos(phi); return Math.acos(clamp((tr - 1) / 2, -1, 1)); }
    function trigger(psi) { let lo = 0, hi = Math.PI / 2; if (rotAngle(0, psi) > 0.8) return 0; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (rotAngle(m, psi) > 0.8) hi = m; else lo = m; } return hi; }
    return { ctls, readout: true, update(p) {
      const psi = yawOn ? Math.PI / 6 : 0;
      gauge.forEach(m => m.visible = view === 0); lA.visible = lB.visible = l08.visible = view === 0; TL.visible = view === 1; ref.visible = view === 0;
      L.clear(arrowG);
      if (view === 0) {
        const phi = (Math.PI / 2) * seg(p, 0.05, 0.9), q = still();
        pose(ref, q, [-3.4, 0, 0], 2.2, 0);
        rob.userData.set({ ...q, pitch: 0, yaw: psi, p: [0, 0, 0] }); rob.position.set(0, STAND * 2.2, 0); rob.scale.setScalar(2.2); piv.position.set(-0.9, 0, 0); piv.rotation.set(0, 0, phi);
        const eR = rotAngle(phi, psi), dg = 1 - Math.cos(phi);
        const sA = Math.min(1.6, eR) / 1.6 * 4, sB = Math.min(1.6, dg) / 1.6 * 4;
        fA.scale.x = Math.max(0.02, sA); fA.position.x = 1.6 + sA / 2; fB.scale.x = Math.max(0.02, sB); fB.position.x = 1.6 + sB / 2;
        tint(fA, eR > 0.8 ? COL.bad : COL.trk); tint(fB, dg > 0.8 ? COL.bad : COL.trk);
        const deg = x => (x * 180 / Math.PI).toFixed(1);
        rd(`倾斜 ${deg(phi)}°，偏航误差 ${yawOn ? 30 : 0}°<br>论文 ‖e_R‖ = ${f3(eR)} rad ${eR > 0.8 ? '→ <b>终止</b>' : ''}<br>代码 |Δg_z| = ${f3(dg)} ${dg > 0.8 ? '→ <b>终止</b>' : ''}<br>触发角：论文 ${deg(trigger(psi))}°，代码 78.5°`);
        cap(eR <= 0.8 ? `两种判据都还没触发` : dg <= 0.8 ? `<b>论文的判据已经终止</b>（${deg(trigger(psi))}° 起），代码的还要等到 78.5°` : '两种都终止了');
      } else {
        const T = p * 10, q = clip('walk', T * 1.0); let kick = 0, lastU = null; PU.forEach(u => { const dtt = T - u.t; if (dtt >= 0 && dtt < 0.5) { kick = 1 - dtt / 0.5; lastU = u; } });
        const lean = lastU ? kick * 0.35 * Math.sign(lastU.v[0] || 1) : 0;
        piv.position.set(0, 0, 0); piv.rotation.set(0, 0, 0); pose(rob, { ...q, roll: lean }, [-1.2, 0, 0], 2.2, 0);
        tcur.position.x = tlx(T);
        if (lastU) { const a = L.arrow([-1.2 - 1.6 * lastU.v[0] * kick - 0.2, 1.5, -1.6 * lastU.v[1] * kick], [-1.2, 1.5, 0], COL.guide); arrowG.add(a); }
        const u = lastU || PU.find(u => u.t > T) || PU[PU.length - 1];
        rd(`t = ${T.toFixed(2)} s；推搡时刻 ${PU.map(u => u.t.toFixed(2)).join('、')} s<br>${lastU ? '当前' : '下一次'}：Δv = (${u.v.map(f2).join(', ')}) m/s，Δω = (${u.w.map(f2).join(', ')}) rad/s<br>平均间隔 2 s，10 s 内期望约 4 到 5 次`);
        cap(lastU ? '推搡：在当前根速度上<b>瞬时</b>加一个随机增量（push_by_setting_velocity），没有持续时间' : '表 S2 叫“持续时间”的 1–3 s，其实是<b>两次推搡的间隔</b>。SuperMimic 去掉了这一项');
      }
    } };
  }

  /* ---------- scene 7: adaptive sampling toy, computed on load ---------- */
  const NB = 30, ITER = 150;
  function buildSampler() {
    const d = Array.from({ length: NB }, (_, s) => 0.05 + 2.0 * Math.exp(-((s - 8.5) ** 2) / 0.9) + 1.0 * Math.exp(-((s - 14) ** 2) / 0.5) + 1.6 * Math.exp(-((s - 20.5) ** 2) / 0.9));
    const fail = k => d.map((dd, s) => clamp(0.7 / (1 + Math.exp(-6 * (dd - k[s]) + 3)), 0, 0.95));
    function run(mode) { /* 0 uniform, 1 K = 3, 2 K = 1 */
      const k = Array(NB).fill(0), fbar = Array(NB).fill(0), hist = []; let learned = null; const B = 8, K = mode === 1 ? 3 : 1, rho = 0.8;
      for (let it = 0; it <= ITER; it++) {
        let ph;
        if (mode === 0) ph = Array(NB).fill(1 / NB);
        else { const fl = fbar.map(x => x + 0.1 / NB); ph = fl.map((_, s) => { let a = 0; for (let u = 0; u < K; u++) a += rho ** u * fl[Math.min(NB - 1, s + u)]; return a; }); const z = ph.reduce((a, b) => a + b, 0); ph = ph.map(x => x / z); }
        const f = fail(k); hist.push({ ph: ph.slice(), f: f.slice() });
        if (learned == null && Math.max(...f) < 0.05) learned = it;
        const V = Array(NB).fill(0), F = Array(NB).fill(0);
        for (let b = 0; b < NB; b++) { let surv = B * ph[b]; for (let j = b; j < Math.min(NB, b + 10); j++) { V[j] += surv; F[j] += surv * f[j]; surv *= 1 - f[j]; } }
        for (let s = 0; s < NB; s++) { k[s] += 0.01 * V[s]; fbar[s] = 0.9 * fbar[s] + 0.1 * F[s]; }
      }
      return { hist, learned };
    }
    return { d, R: [run(0), run(1), run(2)] };
  }
  let SAMP_ = null; const samp = () => SAMP_ || (SAMP_ = buildSampler());
  function s7(G) {
    let mode = +(OPT[0] ?? 1); const T = samp();
    G.add(L.grid(30, 30));
    const DX = 0.62, X0 = -(NB - 1) * DX / 2, im = inst(BOX, NB), dm = inst(BOX, NB, { opacity: 0.5 }); G.add(im, dm);
    for (let s = 0; s < NB; s++) { setI(dm, s, [X0 + s * DX, 0.02, -1.4], [0.45, 0.04, 0.45]); colI(dm, s, hex3(COL.dim)); }
    G.add(lab('难（我设的）', [X0 + 8.5 * DX, 1.9, -1.6], { size: 16, color: css(COL.amber) }), lab('难', [X0 + 20.5 * DX, 1.6, -1.6], { size: 16, color: css(COL.amber) }));
    for (let s = 0; s < NB; s++) { const h = 0.3 * T.d[s] + 0.03; setI(dm, s, [X0 + s * DX, h / 2, -1.4], [0.45, h, 0.45]); } done(dm);
    G.add(lab('0 s', [X0, -0.3, 1.0], { size: 15 }), lab('30 s', [X0 + (NB - 1) * DX, -0.3, 1.0], { size: 15 }), lab('均匀 = 1/30', [X0 - 1.6, 0.9, 0], { size: 15 }));
    wire(G, [[X0 - 0.4, 0.9, 0], [X0 + NB * DX, 0.9, 0]], COL.sim, { dashed: true, opacity: 0.5 });
    const ctls = [{ label: '采样', items: ['均匀', '自适应 K = 3（论文）', '自适应 K = 1（代码）'], get: () => mode, set: k => { mode = k; } }];
    const good = hex3(COL.ok), badc = hex3(COL.bad);
    return { ctls, readout: true, update(p) {
      const it = Math.min(ITER, Math.round(p * ITER)), h = T.R[mode].hist[it];
      for (let s = 0; s < NB; s++) { const y = Math.min(6.5, h.ph[s] * NB * 0.9), fr = clamp(h.f[s] / 0.4, 0, 1); setI(im, s, [X0 + s * DX, y / 2 + 0.01, 0], [0.5, Math.max(0.02, y), 0.5]); colI(im, s, [L.lerp(good[0], badc[0], fr), L.lerp(good[1], badc[1], fr), L.lerp(good[2], badc[2], fr)]); }
      done(im);
      const lr = T.R.map(r => r.learned == null ? '&gt;150' : r.learned), mf = Math.max(...h.f);
      rd(`第 ${it} 次迭代；最大区间失败率 ${f3(mf)}<br>所有区间失败率 &lt; 5% 的迭代：均匀 ${lr[0]}，K = 3 ${lr[1]}，K = 1 ${lr[2]}（玩具）`);
      cap(mode === 0 ? '均匀采样：难段之前的回合常在半路结束，<b>难段练得少</b>' : mode === 1 ? '论文的 K = 3：起点落在难段<b>之前一两个区间</b>，练“进入”难段' : '代码的 K = 1：起点<b>正落在</b>失败的区间');
    } };
  }

  /* ---------- scene 8: VAE distilled with DAgger ---------- */
  function s8(G) {
    G.add(L.grid(34, 34));
    const tea = [0, 1, 2, 3].map(i => block(1.2, 0.55, 1.1, COL.trk, [-12, 0.4 + i * 0.75, -2.5])); G.add(...tea);
    const w = d => 0.35 + Math.log2(d) * 0.22;
    const inE = block(0.5, w(67), 1.0, COL.ref, [-9.0, 3.5, 0]), inD = block(0.5, w(96), 1.0, COL.sim, [1.6, 0.9, 1.6]);
    const E = [2048, 1024, 512].map((d, i) => block(0.8, w(d), 1.2, COL.vae, [-7.4 + i * 1.6, 3.5, 0])), mu = block(0.6, w(64), 1.0, COL.vae, [-2.6, 3.5, 0]);
    const Z = block(0.5, w(32), 0.5, COL.white, [-0.8, 3.5, 0]);
    const D = [2048, 1024, 512].map((d, i) => block(0.8, w(d), 1.2, COL.vae, [1.2 + i * 1.6, 3.5, 0])), A = block(0.5, w(29), 1.0, COL.rew, [6.4, 3.5, 0]);
    const loss = block(2.6, 0.9, 1.2, COL.guide, [9.6, 3.5, 0]);
    G.add(inE, inD, ...E, mu, Z, ...D, A, loss);
    const rob = robot(COL.robot); G.add(rob);
    G.add(lab('ψ, e_anchor · 67', [-9.0, 5.2, 0], { size: 17 }), lab('编码器 [2048, 1024, 512]', [-5.8, 6.1, 0], { size: 18 }), lab('μ, log σ', [-2.6, 5.0, 0], { size: 16 }), lab('z · 32', [-0.8, 4.6, 0], { size: 18 }));
    G.add(lab('解码器 [2048, 1024, 512]', [2.8, 5.4, 0], { size: 18 }), lab('â · 29', [6.4, 4.8, 0], { size: 17 }), lab('g, V_imu, θ, θ̇, a_last · 96', [1.6, 2.3, 2.4], { size: 16 }), lab('‖â − a‖² + 0.01 KL', [9.6, 4.6, 0], { size: 17 }));
    G.add(lab('教师：跟踪策略 [512, 256, 128]', [-11.4, -0.4, 0.6], { size: 17, color: css(COL.trk) }), lab('学生在仿真里跑（DAgger）', [9.0, -0.3, -2.4], { size: 17 }));
    const f = { a: stream(G, 5, COL.ref), b: stream(G, 5, COL.vae), c: stream(G, 4, COL.sim), d: stream(G, 4, COL.robot), e: stream(G, 5, COL.trk), g: stream(G, 4, COL.rew) };
    return { update(p) {
      const q = (p * 16) % 1, a = seg(p, 0, 0.1), b = seg(p, 0.3, 0.38), c = seg(p, 0.6, 0.68);
      pose(rob, clip('walk', p * 12), [8.6, 0, -3.4], 2.4, 0);
      f.a([[-9.0, 3.5, 0], [-0.8, 3.5, 0]], q, a); f.c([[1.6, 0.9, 1.6], [1.2, 3.5, 0]], q, b); f.b([[-0.8, 3.5, 0], [6.4, 3.5, 0]], q, b); f.g([[6.4, 3.5, 0], [8.3, 3.5, 0]], q, b);
      f.d([[8.6, 1.8, -3.4], [-11.4, 1.8, -2.5]], q, c); f.e([[-12, 2.4, -2.5], [-12, 3.0, 0.8], [9.6, 3.0, 0.8]], q, c);
      [...E, mu].forEach(m => glow(m, 0.6 * a * (1 - b * 0.5))); glow(Z, 0.8 * a); [...D, A].forEach(m => glow(m, 0.6 * b)); glow(loss, 0.8 * b); tea.forEach(m => glow(m, 0.7 * c));
      cap(p < 0.3 ? '编码器只看“要做什么”：参考相位 ψ 和锚点误差，压成 <b>32 维</b> z' : p < 0.6 ? '解码器结合“身体现在怎样”：z 加 96 维本体，输出 29 维动作' : '<b>DAgger</b>：学生自己跑，在它走到的状态上让教师给动作，回归 ‖â − a‖²');
    } };
  }

  /* ---------- scene 9: state-latent tokens with per-token noise ---------- */
  function s9(G) {
    let kf = +(OPT[0] ?? 0);
    G.add(L.grid(30, 30));
    const NT = 21, DX = 1.0, X0 = -10, ims = inst(BOX, NT), imz = inst(BOX, NT); G.add(ims, imz);
    const tr = block(NT * DX + 0.6, 1.4, 1.4, COL.diff, [0, 6.8, 0], { opacity: 0.85 }); G.add(tr);
    G.add(lab('去噪 Transformer · 6 层 · 8 头 · 512 维', [3.2, 7.9, 0], { size: 20 }), lab('s（状态）', [X0 - 1.5, 3.0, 0], { size: 17 }), lab('z（潜变量）', [X0 - 1.5, 0.9, 0], { size: 17 }));
    G.add(lab('−0.16 s', [X0, -0.4, 1], { size: 15 }), lab('t（当前）', [X0 + 4 * DX, -0.4, 1], { size: 15, color: css(COL.ok) }), lab('+0.64 s', [X0 + 20 * DX, -0.4, 1], { size: 15 }));
    const zt = lab('z_t → VAE 解码器 → a_t', [X0 + 4 * DX, 0.0, 2.2], { size: 17, color: css(COL.rew) }); G.add(zt);
    const rr = L.rng(5), EPS = Array.from({ length: NT * 2 }, () => L.gauss(rr));
    const abar = k => { const s = 0.008, f = t => Math.cos((t + s) / (1 + s) * Math.PI / 2) ** 2; return f(k / 20) / f(0); };
    const x0 = (n, row) => row === 0 ? 0.9 + 0.55 * Math.sin(0.5 * n) : 0.7 + 0.35 * Math.cos(0.4 * n + 1);
    const ctls = [{ label: '关键帧', items: ['无（摇杆类任务）', '未来第 5、10、15 步固定'], get: () => kf, set: k => { kf = k; } }];
    const C = { obs: hex3(COL.ok), key: hex3(COL.amber), noisy: hex3(COL.diff), z: hex3(COL.white) };
    return { ctls, readout: true, update(p) {
      const it = 20 * seg(p, 0.05, 0.9), k = 20 - it;
      for (let n = 0; n < NT; n++) for (let row = 0; row < 2; row++) {
        const known = (row === 0 && n <= 4) || (row === 0 && kf && (n === 9 || n === 14 || n === 19)) || (row === 1 && n < 4);
        const kk = known ? 0 : k, a = abar(kk), v = Math.sqrt(a) * x0(n, row) + Math.sqrt(1 - a) * EPS[n * 2 + row] * 0.6;
        const h = clamp(Math.abs(v) + 0.05, 0.05, 2.4), y = row === 0 ? 2.2 : 0.2, im = row === 0 ? ims : imz;
        setI(im, n, [X0 + n * DX, y + h / 2, 0], [0.7, h, 0.7]);
        const c = known ? (row === 0 && n > 4 ? C.key : C.obs) : row === 0 ? C.noisy : C.z, mix = known ? 1 : 1 - Math.sqrt(1 - a);
        colI(im, n, [L.lerp(0.25, c[0], mix), L.lerp(0.27, c[1], mix), L.lerp(0.32, c[2], mix)]);
      }
      done(ims); done(imz); glow(tr, 0.3 + 0.4 * Math.abs(Math.sin(p * 40)) * (k > 0.1 ? 1 : 0)); zt.visible = k < 0.5;
      rd(`去噪第 ${it.toFixed(0)} / 20 步；未知 token 的 k = ${k.toFixed(1)}<br>噪声标准差 √(1−ᾱ_k) = ${f3(Math.sqrt(1 - abar(k)))}（余弦表，示意）<br>固定为干净的：历史和当前状态${kf ? '、3 个关键帧' : ''}；历史潜变量`);
      cap(k > 0.5 ? (kf ? '历史、当前状态和<b>三个关键帧</b>设为 k = 0，其余一起去噪：这就是补全' : '历史和当前状态是观测，k = 0；<b>未来的状态和潜变量</b>从噪声开始去噪') : '去噪完成，只用当前的 <b>z_t</b>，交给 VAE 解码器配上最新观测算出动作');
    } };
  }

  /* ---------- scene 10: cost-guided denoising on a hand-written prior ---------- */
  const HZ = 16, DTT = 0.25, GREP = 8, GS = 2, GCL = 1.0;
  function buildGuide() {
    const TP = [];
    for (const hd of [-50, -30, -10, 10, 30, 50]) for (const cv of [-0.35, 0, 0.35]) for (const sp of [0.4, 0.8, 1.3]) {
      let x = 0, y = 0, th = hd * Math.PI / 180; const pts = [];
      for (let i = 1; i <= HZ; i++) { th += cv * DTT; x += sp * Math.cos(th) * DTT; y += sp * Math.sin(th) * DTT; pts.push(x, y); }
      TP.push(pts);
    }
    const abar = k => { const s = 0.008, f = t => Math.cos((t + s) / (1 + s) * Math.PI / 2) ** 2; return clamp(f(k / 20) / f(0), 1e-4, 1); };
    const TASK = [
      { n: '摇杆', gv: [1.0, 0.6], w: 0.02 },
      { n: '路点', gp: [3.4, 1.8], w: 0.012 },
      { n: '路点 + 避障', gp: [4.6, 0.0], ob: [2.3, 0.05, 0.7], w: 0.012, wb: 0.05 }
    ];
    const vel = (x, i) => { const px = i ? x[2 * i - 2] : 0, py = i ? x[2 * i - 1] : 0; return [(x[2 * i] - px) / DTT, (x[2 * i + 1] - py) / DTT]; };
    function cost(x, T) {
      let g = 0; const gr = new Float64Array(2 * HZ), delta = 0.2, rb = 0.25;
      for (let i = 0; i < HZ; i++) {
        const v = vel(x, i);
        if (T.gv) { const ex = v[0] - T.gv[0], ey = v[1] - T.gv[1]; g += 0.5 * (ex * ex + ey * ey); gr[2 * i] += ex / DTT; gr[2 * i + 1] += ey / DTT; if (i) { gr[2 * i - 2] -= ex / DTT; gr[2 * i - 1] -= ey / DTT; } }
        if (T.gp) { const dx = x[2 * i] - T.gp[0], dy = x[2 * i + 1] - T.gp[1], d = Math.hypot(dx, dy), e = Math.exp(-2 * d); g += (1 - e) * (dx * dx + dy * dy) + e * (v[0] * v[0] + v[1] * v[1]); gr[2 * i] += 2 * (1 - e) * dx + 2 * e * v[0] / DTT; gr[2 * i + 1] += 2 * (1 - e) * dy + 2 * e * v[1] / DTT; if (i) { gr[2 * i - 2] -= 2 * e * v[0] / DTT; gr[2 * i - 1] -= 2 * e * v[1] / DTT; } }
        if (T.ob) { const dx = x[2 * i] - T.ob[0], dy = x[2 * i + 1] - T.ob[1], r = Math.max(1e-6, Math.hypot(dx, dy)), s = r - T.ob[2] - rb; const B = s >= delta ? -Math.log(s) : -Math.log(delta) + 0.5 * (((s - 2 * delta) / delta) ** 2 - 1), dB = s >= delta ? -1 / s : (s - 2 * delta) / (delta * delta); g += T.wb / T.w * B; gr[2 * i] += T.wb / T.w * dB * dx / r; gr[2 * i + 1] += T.wb / T.w * dB * dy / r; }
      }
      return { g, gr };
    }
    function denoise(ti, seed) {
      const T = TASK[ti], r = L.rng(seed); let x = Array.from({ length: 2 * HZ }, () => L.gauss(r) * 1.6 + 0.0);
      const steps = [x.slice()]; const x0s = [];
      for (let k = 20; k >= 1; k--) {
        const a = abar(k), a1 = abar(k - 1), sa = Math.sqrt(a), sn = Math.sqrt(1 - a);
        let lw = TP.map(tp => { let s = 0; for (let j = 0; j < 2 * HZ; j++) { const e = x[j] - sa * tp[j]; s += e * e; } return -s / (2 * (1 - a)); });
        const mx = Math.max(...lw); let wsum = 0; lw = lw.map(v => { const e = Math.exp(v - mx); wsum += e; return e; });
        const x0 = Array(2 * HZ).fill(0); TP.forEach((tp, i) => { const w = lw[i] / wsum; for (let j = 0; j < 2 * HZ; j++) x0[j] += w * tp[j]; });
        const eps = x.map((v, j) => (v - sa * x0[j]) / sn);
        for (let rep = 0; rep < GREP; rep++) {
          const { gr } = cost(x0, T), sc = T.w * GS;
          let gn = 0; for (let j = 0; j < 2 * HZ; j++) gn += gr[j] * gr[j]; gn = Math.sqrt(gn); const cl = gn * sc > GCL ? GCL / (gn * sc) : 1;
          for (let j = 0; j < 2 * HZ; j++) x0[j] -= sc * cl * gr[j];
        }
        x = x0.map((v, j) => Math.sqrt(a1) * v + Math.sqrt(1 - a1) * eps[j]);
        steps.push(x.slice()); x0s.push(x0);
      }
      return { steps, x0s, T };
    }
    return { TASK, denoise, cost, n: TP.length };
  }
  let GUI_ = null; const gui = () => GUI_ || (GUI_ = buildGuide());
  function s10(G) {
    let ti = +(OPT[0] ?? 0); const U = gui();
    G.add(L.grid(16, 16));
    const NS = 6, im = inst(BALL, NS * HZ), start = block(0.3, 0.3, 0.3, COL.ok, [0, 0.15, 0], { edges: false }); G.add(im, start);
    const goal = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 20), L.mat(COL.rew)); G.add(goal);
    const obs = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.8, 32), L.mat(COL.bad, { opacity: 0.55 })); G.add(obs);
    const jv = L.arrow([0, 0.05, 0], [1, 0.05, 0], COL.guide); G.add(jv);
    const gl = lab('目标', [0, 0.9, 0], { size: 17, color: css(COL.rew) }), jl = lab('摇杆 g_v', [0, 0.6, 0], { size: 17, color: css(COL.guide) }), ol = lab('障碍', [0, 1.2, 0], { size: 17, color: css(COL.bad) }); G.add(gl, jl, ol);
    G.add(lab('起点', [0, 0.6, -0.5], { size: 16, color: css(COL.ok) }));
    let runs = null, lastT = -1;
    const cols = [COL.trk, COL.vae, COL.diff, COL.data, COL.white, COL.amber].map(hex3);
    const ctls = [{ label: '任务', items: U.TASK.map(t => t.n), get: () => ti, set: k => { ti = k; } }];
    const W = (x, y) => [x, 0.12, -y];
    return { ctls, readout: true, update(p) {
      if (lastT !== ti) { runs = Array.from({ length: NS }, (_, s) => U.denoise(ti, 101 + s * 7)); lastT = ti; }
      const T = U.TASK[ti], st = 20 * seg(p, 0.05, 0.85), i0 = Math.floor(st), fr = st - i0;
      runs.forEach((R, s) => { const a = R.steps[Math.min(20, i0)], b = R.steps[Math.min(20, i0 + 1)]; for (let i = 0; i < HZ; i++) { const x = L.lerp(a[2 * i], b[2 * i], fr), y = L.lerp(a[2 * i + 1], b[2 * i + 1], fr); setI(im, s * HZ + i, W(x, y), 0.07 + 0.004 * i); colI(im, s * HZ + i, cols[s]); } });
      done(im);
      goal.visible = gl.visible = !!T.gp; if (T.gp) { goal.position.set(...W(T.gp[0], T.gp[1])); goal.position.y = 0.2; gl.position.set(T.gp[0], 0.9, -T.gp[1]); }
      obs.visible = ol.visible = !!T.ob; if (T.ob) { obs.position.set(T.ob[0], 0.4, -T.ob[1]); obs.scale.set(T.ob[2], 1, T.ob[2]); ol.position.set(T.ob[0], 1.2, -T.ob[1]); }
      jv.visible = jl.visible = !!T.gv; if (T.gv) { jv.setDirection?.(new THREE.Vector3(T.gv[0], 0, -T.gv[1]).normalize()); jv.setLength?.(Math.hypot(...T.gv) * 1.5, 0.3, 0.18); jl.position.set(T.gv[0] * 1.6, 0.6, -T.gv[1] * 1.6); }
      const fin = runs[0].steps[Math.min(20, Math.round(st))], c = U.cost(fin, { ...T, wb: T.wb ? T.wb : 0 });
      let clr = Infinity; if (T.ob) runs.forEach(R => { const xx = R.steps[Math.min(20, Math.round(st))]; for (let i = 0; i < HZ; i++) clr = Math.min(clr, Math.hypot(xx[2 * i] - T.ob[0], xx[2 * i + 1] - T.ob[1]) - T.ob[2] - 0.25); });
      const endp = runs.map(R => { const xx = R.steps[Math.min(20, Math.round(st))]; return [xx[2 * HZ - 2], xx[2 * HZ - 1]]; });
      const vEnd = T.gv ? runs.map(R => { const xx = R.steps[20]; return Math.hypot((xx[2 * HZ - 2] - xx[0]) / ((HZ - 1) * DTT) - T.gv[0], (xx[2 * HZ - 1] - xx[1]) / ((HZ - 1) * DTT) - T.gv[1]); }) : null;
      rd(`去噪第 ${Math.round(st)} / 20 步；先验 = ${U.n} 条模板<br>样本 1 的代价 G = ${c.g.toFixed(2)}${T.ob ? `；六条样本离障碍最近 ${f2(clr)} m` : ''}<br>${T.gp ? `终点离目标：${endp.map(e => f2(Math.hypot(e[0] - T.gp[0], e[1] - T.gp[1]))).join(' / ')} m` : `平均速度误差（第 20 步）：${vEnd.map(f2).join(' / ')} m/s`}`);
      cap(st < 6 ? '从噪声开始：六条样本互不相关' : st < 18 ? '每一步：先验把轨迹拉向<b>像走路的形状</b>，代价梯度把它推向<b>任务</b>' : (T.ob ? '先验里没有“绕障”这个技能，是<b>代价相加</b>后从弯曲的模板里组合出来的' : '收敛：六条样本落在满足代价的同一类轨迹上'));
    } };
  }

  /* ---------- scene 11: deployment timing; what SuperMimic took ---------- */
  function s11(G) {
    let view = +(OPT[0] ?? 0); const A = new THREE.Group(), B = new THREE.Group(); G.add(A, B); G.add(L.grid(34, 34));
    /* timing lanes, 0..160 ms mapped to x -10..10 */
    const tx = t => -8.4 + t / 8, lanes = [['状态估计 500 Hz', 7.0, COL.sim], ['扩散线程（GPU，异步）', 5.4, COL.diff], ['VAE 解码器 25 Hz（CPU）', 3.8, COL.vae], ['电机 PD', 2.2, COL.trk]];
    lanes.forEach(([t, y, c]) => { A.add(block(20.4, 0.06, 0.4, COL.dim, [1.6, y, 0], { edges: false })); A.add(lab(t, [-10.1, y + 0.45, 0], { size: 17, color: css(c) })); });
    for (let t = 0; t <= 160; t += 2) A.add(block(0.04, 0.3, 0.3, COL.sim, [tx(t), 7.0, 0], { edges: false }));
    const dif = [0, 40, 80, 120].map(t => { const m = block(20 / 8, 0.55, 0.5, COL.diff, [tx(t + 10), 5.4, 0], { edges: false }); A.add(m); return m; });
    const decs = [0, 40, 80, 120, 160].map(t => { const m = block(0.25, 0.55, 0.5, COL.vae, [tx(t), 3.8, 0], { edges: false }); A.add(m); return m; });
    A.add(block(20.4, 0.25, 0.4, COL.trk, [1.6, 2.2, 0], { edges: false, opacity: 0.6 }));
    [0, 40, 80, 120].forEach(t => A.add(L.arrow([tx(t + 20), 5.1, 0], [tx(t + 40), 4.1, 0], COL.rew)));
    A.add(lab('20 ms', [tx(50), 6.0, 0], { size: 15 }), lab('40 ms', [tx(60), 1.4, 0], { size: 15 }), lab('最新的 z_t', [tx(30), 4.6, 0.4], { size: 15, color: css(COL.rew) }));
    const cur = block(0.06, 6.4, 0.06, COL.white, [tx(0), 4.6, 0], { edges: false }); A.add(cur);
    /* inheritance board */
    const ROWS = [
      ['原样沿用', COL.ok, ['四项跟踪奖励 σ 和权重', '锚点（根）项 0.5', '动作平滑 −0.1', '设定点参数化、低增益', '关节零位 ±0.01', '躯干质心偏移', '高度终止 0.25 m', 'PPO 超参数（PPO-Sim）']],
      ['改动并注明', COL.amber, ['关节限位 −10 → −2', '目标：单帧 → 未来 10 帧', '倾斜终止（按代码的定义）']],
      ['去掉并注明', COL.bad, ['自碰撞惩罚', '末端高度终止', '根部速度推搡']],
      ['没注明的不同', COL.ppo, ['观测：无 ψ、锚点误差、线速度；加重力；10 帧', '摩擦 U[0.3, 1.2]（mjlab 的设定）', '根部是骨盆，本文锚点是躯干']]
    ];
    const cards = [];
    ROWS.forEach(([t, c, items], ci) => { const x = -8.4 + ci * 5.6; B.add(lab(t, [x, 8.6, 0], { size: 21, color: css(c), border: 'rgba(255,255,255,.25)' })); items.forEach((it, k) => { const m = block(5.1, 0.7, 0.4, c, [x, 7.6 - k * 0.95, 0], { edges: false, opacity: 0.75 }); B.add(m); const l = lab(it, [x, 7.6 - k * 0.95, 0.35], { size: 15 }); B.add(l); cards.push({ m, l, ci, k }); }); });
    const ctls = [{ label: '看', items: ['部署时序', 'SuperMimic 继承'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      A.visible = view === 0; B.visible = view === 1;
      if (view === 0) {
        const t = 160 * p; cur.position.x = tx(t);
        dif.forEach((m, i) => glow(m, t >= i * 40 && t < i * 40 + 20 ? 0.9 : 0.1)); decs.forEach((m, i) => glow(m, Math.abs(t - i * 40) < 3 ? 1 : 0.1));
        cap(`t = ${t.toFixed(0)} ms：扩散每次约 <b>20 ms</b>，在单独线程里算；解码器每 40 ms 用<b>最新的 z_t 和最新观测</b>出动作`);
      } else {
        const g = seg(p, 0, 0.7); cards.forEach((c, i) => { const on = clamp(g * cards.length - i, 0, 1); c.m.visible = c.l.visible = on > 0.3; c.m.scale.x = Math.max(0.05, on); });
        cap('SuperMimic 附录 A：<b>8 项沿用</b>、3 项改动并注明、3 项去掉并注明，另有 <b>3 处不同没有注明</b>');
      }
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player (same as interactives/phc/phc.js) ---------- */
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
    L.clear(root); LABS = []; PICKS = []; lastCap = null; lastRd = null;
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
  window.__bmDebug = { samp, gui, get cap() { return $('cap').textContent; }, get rd() { return $('rd')?.textContent; } };
})();
