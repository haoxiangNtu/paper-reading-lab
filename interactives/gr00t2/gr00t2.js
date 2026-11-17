'use strict';
/* GR00T 2 (NVIDIA white paper, 2026-11) taken apart into eleven animated scenes. Numbers come from the white paper;
   the public dev branch codex/n2-action-expert of NVIDIA/Isaac-GR00T (7e492ad, evaluation licence) is only cited by
   file and key names. Each scene's update(p) is a pure function of the timeline p plus the current toggles.
   Token counts, Elo win rates, GRPO baselines and sums are computed live; curves and mixture widths marked "示意" are toys.
   No GR00T network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { vid: 0x3aa8e0, fut: 0x7cd0ff, txt: 0xb48cff, state: 0xe05d5d, act: 0xf0963c, model: 0x4fc98a, frozen: 0x6b7794, ok: 0x4fc98a, bad: 0xe05d5d, gold: 0xf2c14e, dim: 0x46506a, white: 0xeef2fa, human: 0xd9a35b, umi: 0x7cb8ff, tele: 0xf0963c, agent: 0xb48cff, noise: 0x8e9bb8, turbo: 0x38d1ff };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const hexs = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const live = t => `<p class="guess"><b>现算 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const fmt = n => n.toLocaleString('en-US');

  const SCENES = [
    { n: 1, part: '§2 总览', title: '一个 Transformer，同时出未来画面和动作', sub: '输入：最多 4 路相机 × 0.8 秒、状态、指令；输出：每路相机的未来帧 + 一段动作。切换 GR00T 2 / Turbo', dur: 14, cam: [0.0, 1.15, 54, [-2.2, 2.0, 0]],
      html: dl([['骨干', 'Cosmos-Predict2.5-2B 视频扩散 Transformer 初始化，2B 参数'], ['视频', '冻结 Wan 2.1 VAE（时间 4×、空间 8×），每路相机每隐帧 280 token；Turbo 用 Wan 2.2（空间 16×），70 token'], ['语言', '冻结 Cosmos-Reason1 编码，交叉注意力读'], ['状态 / 动作', '每具身一套 MLP 编码器和解码器'], ['训练', '流匹配，视频一个损失、动作一个损失']]) +
        '<p>左边四路相机各 5 帧历史（0.8 秒、5 fps），压成隐变量 token；状态一个 token，带噪的动作块若干 token；它们排成一条序列进同一个 Transformer。右边同时出来两样东西：每路相机的未来帧（浅蓝），以及一段动作（橙线）。</p>' +
        '<p>切到 Turbo：Transformer 不变，视频 VAE 压得更狠，每路相机每隐帧的 token 从 280 降到 70，适合在 Jetson Thor 上跑。</p>' +
        live('token 数按 224 × 320 ÷ 8（或 16）÷ 2 × 2 patch 当场算。') + src('§2 图 1 · 表 27') },
    { n: 2, part: '§4.2 数据', title: '40 万小时人类视频、1 万小时 UMI、2.35 万小时遥操作', sub: '切换：三大类按小时（对数 / 线性）、遥操作按小时还是采样份额', dur: 13, cam: [0.0, 1.12, 40, [0, 4.4, 0]],
      html: dl([['人类视频', 'Human-1M 筛出 402,730 小时、约 1,375 万回合（3,000 小时实验室内对齐数据）'], ['UMI-10K', '10,184 小时、94.2 万回合、2,897 个任务'], ['遥操作', '23,508 小时、116 万回合：YAM 15,146（+ ABC-130k 3,591）、Sharpa 2,890、Wuji 1,256、G1 275、DROID 350'], ['采样', '遥操作按来源设份额：YAM 51.2%、ABC 10.4%、Sharpa 20.6%、Wuji 14.0%、G1 1.3%、DROID 2.5%'], ['未给', '三大类之间的采样比例']]) +
        '<p>按小时，人类视频占 92%，线性轴上 UMI 和遥操作几乎看不见，所以默认画对数轴。下面一排是遥操作的六个来源：按小时 YAM 最多，但采样份额里灵巧手（Sharpa + Wuji）被加重约 2 倍。</p>' +
        live('占比、合计和“加重倍数”按表 11 当场算。') + src('§4.2 · 附录 C · 表 10、11') },
    { n: 3, part: '§2 视频 token', title: '一帧 224 × 320 变成多少 token', sub: 'VAE 时间压 4 倍、空间压 8 倍（Turbo 16 倍），再按 2 × 2 切 patch；切换模型和相机路数', dur: 14, cam: [0.0, 1.1, 48, [-3.0, 2.4, 0]],
      html: dl([['像素', '每路相机 5 帧（0.8 秒 @ 5 fps），224 × 320'], ['VAE', 'Wan 2.1：时间 1 + 4k → 5 帧压成 2 个隐帧；空间 ÷ 8 → 28 × 40'], ['patch', '2 × 2 → 14 × 20 = 280 token / 隐帧 / 路'], ['Turbo', 'Wan 2.2：空间 ÷ 16 → 14 × 20 → 7 × 10 = 70 token'], ['视角嵌入', '可学的 view embedding 标明 token 来自哪路相机']]) +
        '<p>左边一叠是 5 帧像素；中间是 VAE 的隐变量网格，每个小块代表一个 2 × 2 patch，也就是一个 token。右边计数器按相机路数当场算历史 token 数。未来帧也要生成，但白皮书没给未来帧数，这里不计。</p>' +
        live('token = (H ÷ s ÷ 2) × (W ÷ s ÷ 2) × 2 个隐帧 × 路数，s = 8 或 16。') + guess('“5 帧 → 2 个隐帧”是按 Wan VAE 的 1 + 4k 结构推的（附录 F.5 的 DreamDojo 也写 5 帧编成 2 个隐帧），白皮书没直接给 GR00T 2 的历史 token 数。') + src('§2 · 附录 I.1（每路相机 5 个历史帧）· 读者注 3') },
    { n: 4, part: '§2 注意力', title: '一条序列里，谁能看谁', sub: '条件视频、去噪视频、状态、动作四组 token 的 4 × 4 掩码；文本走交叉注意力。切换四种掩码', dur: 13, cam: [0.0, 1.0, 38, [0, 2.6, 0]],
      html: dl([['白皮书', '视频 token 跨时间、跨相机互相看；动作 token 看全部视频，包括正在生成的未来帧'], ['分支缺省', '<code>disjoint_video_action</code>：动作不看去噪中的视频（configs/model/n2.py 注释）'], ['其他选项', '<code>joint_video_action</code>、<code>bidirectional_video_action_full</code>、<code>full</code>'], ['文本', '冻结 Cosmos-Reason1 编码，交叉注意力读，不在 4 × 4 表里']]) +
        '<p>右边的 4 × 4 方格是“行（查询）能不能看列（键）”：亮绿 = 能看，暗 = 不能。左边一排是 token 序列，箭头从动作 token 指向它能看到的组。切换掩码，看“动作能不能跟着想象的未来走”这一条在哪种设定下成立。</p>' +
        guess('四种掩码的 4 × 4 真值表取自开发分支 sequence_packing.py 的 AttentionMaskPattern（只用了真值，没有抄代码）。白皮书只描述了“视频互相看、动作看全部视频”，最接近 bidirectional_video_action_full；发布检查点用哪一种未核实。') + src('§2 · 分支 sequence_packing.py 的 AttentionMaskPattern（只引名字）· 读者注 22') },
    { n: 5, part: '§4.1 预训练', title: '三个阶段：先学看，再学动，最后偏向机器人', sub: '阶段 1 单视角视频；阶段 2 多视角视频 + 动作；阶段 3 加重机器人（尤其 YAM）', dur: 14, cam: [0.0, 1.12, 40, [0, 3.2, 0]],
      html: dl([['阶段 1', '单视角视频预测：以人类第一视角视频为主，辅以机器人数据；只有视频损失'], ['阶段 2', '加上具身专用的状态 / 动作模块，多视角视频 + 动作联合训练；人类的动作监督是跟踪到的手部姿态；有有效动作时才计动作损失；提高 YAM 和灵巧手份额'], ['阶段 3', '继续联合训练，更强调机器人示范（尤其 YAM），保留灵巧手、人类等来源'], ['之后', '任务后训练（全量或 LoRA）、RL 后训练'], ['未给', '每阶段步数、batch、学习率、配比']]) +
        '<p>三根柱是三个阶段的数据配比，颜色对应人类、UMI、遥操作。右侧两个灯表示视频损失和动作损失是否开启。进度条走到哪个阶段，那个阶段的柱子亮起。</p>' +
        guess('三根柱的宽度比例全是我画的：白皮书只说“人类为主 → 提高 YAM 和灵巧手 → 更强调机器人”，没给任何配比数字。') + src('§4.1 · §4.2') },
    { n: 6, part: '附录 F.1 / I.1 去噪', title: '联合步和缓存步：视频少走几步，动作多走几步', sub: '2v4a = 视频 2 步、动作 4 步；动作专用步复用最近一次视频步的 KV。切换 2v4a / 2v2a / 1v2a 和 RL 探索噪声', dur: 14, cam: [0.0, 1.12, 40, [0, 2.6, 0]],
      html: dl([['2v4a', '四个动作去噪事件：k = 0、2 是联合步（DiT 同时更新视频和动作），k = 1、3 是缓存步（只更新动作，复用 KV）'], ['部署', 'Dexter 2v2a、YAM 2v4a、G1 Turbo 1v2a（加速时从 2v4a 改过来）'], ['RL 探索', 'CPS 只给要执行的动作坐标加新噪声，视频去噪保持确定'], ['噪声表', 'σ 从 1（噪声）降到 0（数据），速度是“噪声减数据”']]) +
        '<p>上面一行是视频隐变量（四路相机的未来帧），下面一行是动作块。时间轴上每个方块是一次 DiT 前向：绿色是联合步（整条序列都算），橙色是缓存步（只算动作 token，复用视频的 KV，所以便宜得多）。打开“CPS 噪声”，动作每一步多出一点随机抖动，这是 RL 时的探索。</p>' +
        guess('动作曲线和噪声是固定种子的玩具；方块的长短只示意“缓存步更便宜”，白皮书没给每种步的耗时。') + src('附录 F.1.1 式 (10)、(11)，图 46 · 附录 I.1 · 表 27') },
    { n: 7, part: '§3.2 / 附录 B.1 X-Adapt', title: '人类示范管“做什么”，机器人 play 数据管“这个身体”', sub: '1 : 1 混合后训练，模型想象机器人自己的手完成任务。切换去掉其中一样看结果', dur: 14, cam: [0.0, 1.12, 52, [0, -1.6, 0]],
      html: dl([['人类示范', '戴相机 + 手套 + 腕部跟踪器，离线重定向到 7 自由度臂 + 22 自由度 Sharpa 手；视频不改'], ['play 数据', '目标机器人上与任务无关的遥操作，一个数据池服务所有任务'], ['混合', '人类 : play = 1 : 1，同一 62 维状态 / 动作格式'], ['结果（20 次）', 'Filter Paper 65%、Dropper 30%、Slide Dabbing 10%、Package Toss 50%'], ['对照', '无跨具身预训练：化学任务 0%、抛掷 20%；GR00T 1.7：化学 0%、抛掷 5%；去掉人类示范：全 0%']]) +
        '<p>左上是人类示范（黄），左下是机器人 play 数据（橙），汇入 GR00T 2；右边是模型想象的未来：画面里出现的是机器人的手，不是人的手（图 13）。下方柱状图随开关变化。</p>' +
        src('附录 B.1.3–B.1.5 · 图 13、27 · 读者注 6') },
    { n: 8, part: '§3.3 / 附录 F RL', title: 'GRPO 的“上下文记忆”：全成或全败时也有学习信号', sub: '一组 8 次尝试；基线 = 其他 7 次回报 + h 个历史均值伪回报。切换场景和 h', dur: 13, cam: [0.0, 1.1, 44, [1.0, 3.4, 0]],
      html: dl([['式 (12)', 'b = (h·m + Σ<sub>j≠i</sub> R<sub>j</sub>) / (h + N − 1)，A = R − b'], ['h', '首次访问 h = 0（就是 RLOO），之后 h = 2'], ['式 (14)', '历史均值 m ← 0.25·本轮均值 + 0.75·m'], ['真机结果', 'SFT → GRPO → 自模仿：管件 66 → 86 → 88，手指 58 → 72 → 98，网线 76 → 92 → 94，充电器 40 → 94 → 96']]) +
        '<p>八个球是一组尝试（绿成功、红失败），柱子是每次尝试的优势 A。h = 0 时，全成功或全失败的组优势全为 0，什么也学不到；h = 2 时，历史成功率高的上下文这次全失败会得到负优势，反之得到正优势。</p>' +
        live('基线和优势按式 (12) 当场算。') + guess('N = 8 和三种场景的历史均值是我挑的例子，白皮书没给 N。') + src('附录 F.1.1 式 (12)–(15) · 图 5 · 读者注 25') },
    { n: 9, part: '§3.4 / 附录 G 智能体', title: '智能体决定做什么，GR00T 2 决定怎么做', sub: '观察 → 推理 → 执行 → 验证；GR00T 2 和 CaP 是两种执行后端。切换：装配结果 / 视觉引导结果', dur: 14, cam: [0.0, 1.12, 52, [-1.0, -0.8, 0]],
      html: dl([['工具', 'MCP 暴露 wam_act / stop_wam、get_image、localize_object、move_to_pose、set_gripper 等'], ['装配（各 100 次，杂乱开局）', 'SFT 69 / 51 / 23 → + DAgger 84 / 71 / 78 → + 智能体 98 / 97 / 97'], ['视觉引导', '抓取点（实心圆）和释放点（十字）画在相机画面上，按手臂配色'], ['引导结果', '短时程 35.7 → 44.2（语言）→ 76.8（语言 + 视觉）；长时程 0 → 1.7 → 53.3']]) +
        '<p>左边是 S2 智能体的循环，中间是工具层，右边是两个执行后端：GR00T 2（日常操作）和 CaP 程序（定位、抓取、恢复）。小球表示一次工具调用的往返。桌面上画了视觉引导的两种标记。</p>' +
        src('§3.4 图 6、7、8 · 附录 G 表 19–23') },
    { n: 10, part: '§3.5 / 附录 H 人形', title: 'Turbo + SONIC：1 Hz 规划、50 Hz 解码、1000 Hz 跟踪', sub: 'S2 选任务 → S1 Turbo 出 1.6 秒 80 个运动 token → S0 SONIC 出关节目标 → PD 控制器', dur: 14, cam: [0.0, 1.1, 54, [-0.5, -2.4, 0]],
      html: dl([['S2', '可选：VLM 智能体、脚本任务计划或操作员'], ['S1', 'GR00T 2 Turbo，Jetson AGX Thor，约 1 Hz，每次 1.6 秒：80 个 SONIC token + 夹爪宽度'], ['S0', 'SONIC，Jetson Orin NX，50 Hz 把 token 解码成关节位置目标'], ['控制器', '关节 PD，1000 Hz'], ['结果（表 25）', '爆米花 100%、清理桌面 93.3%、地面拾取 83.3%、擦洒出物 46.7%；GR00T 1.7 83.3 / 73.3 / 50.0 / 43.3']]) +
        '<p>三层用三种节奏的脉冲表示：S1 每秒一个大包（80 个 token），S0 每 20 ms 取一个 token，控制器每 1 ms 一次。右边是一个简化的人形。</p>' +
        live('80 个 token ÷ 50 Hz = 1.6 秒；脉冲频率按比例画（1000 Hz 的那一层放慢了显示）。') + guess('人形的姿态和动作是玩具，只示意“全身一起动”。') + src('§3.5 图 9 · 附录 H.1、H.2 · 表 25') },
    { n: 11, part: '§4.3 / §4.6 部署和评测', title: '时延一步步降下来；盲测 Elo 换成胜率', sub: '切换：RTX 5090 / Jetson Thor 的时延瀑布；GearArena 的配对 Elo 差', dur: 13, cam: [0.0, 1.15, 40, [0, 3.6, 0]],
      html: dl([['G1 Turbo（RTX 5090）', '224.73 → 183.66 → 95.05 → 90.01 → 54.79 → 38.40 ms'], ['G1 Turbo（Thor 120 W）', '720.41 → 614.53 → 256.12 → 254.00 → 182.22 → 123.97 ms'], ['GearArena', 'GR00T 2 对 π0.5 +236 Elo，对 GR00T 1.7 +95；Turbo 对 GR00T 2 +14（区间跨 0）'], ['胜率', '1 / (1 + 10<sup>−ΔElo/400</sup>)']]) +
        '<p>时延瀑布：每根柱是加上一项优化后的中位预测时延（运行时优化、TensorRT、CUDA graph、FP8、减少去噪步）。Elo 一页：柱高是 Elo 差，标签里的胜率当场算。</p>' +
        live('胜率按 Elo 差当场算；柱高按原文时延和 Elo。') + src('图 19 · 表 13、27 · 附录 D') }
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
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.0, phi: 1.0, dist: 26, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);
  let LABS = [], refDist = 26, PICKS = [];
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  function dropLab(G, l) { if (!l) return; G.remove(l); LABS = LABS.filter(s => s !== l); L.dispose(l); }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9), DISC = new THREE.CircleGeometry(1, 32);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65, depthWrite: o.depthWrite }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; for (let i = 0; i < n; i++) im.setColorAt(i, _C.setRGB(1, 1, 1)); return im; }
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
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.5, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  function ribbon(G, n, color, w = 0.06, o = {}) {
    const pos = new Float32Array(n * 6), idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: o.opacity ?? 1 })); m.frustumCulled = false; m.renderOrder = o.order ?? 2; G.add(m);
    m.userData.set = pts => { const k = Math.min(n, pts.length); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)], z = q[2] ?? 0; pos[i * 6] = q[0]; pos[i * 6 + 1] = q[1] - w / 2; pos[i * 6 + 2] = z; pos[i * 6 + 3] = q[0]; pos[i * 6 + 4] = q[1] + w / 2; pos[i * 6 + 5] = z; } g.attributes.position.needsUpdate = true; };
    return m;
  }
  function panel(G, x, y, z, w, h) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x0c1220, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }
  function bar(G, x, z, w, color, o = {}) { const m = block(w, 1, o.d ?? w, color, [x, 0.5, z], { edges: false, opacity: o.opacity }); G.add(m); m.userData.set = h => { const v = Math.max(0.001, h); m.scale.y = v; m.position.y = (o.y0 ?? 0) + v / 2; }; return m; }
  function arrowTo(G, from, to, color) { const a = L.arrow(from, to, color, { head: 0.45, headW: 0.3 }); G.add(a); return a; }
  function setArrow(a, from, to) { const f = L.V(from), t = L.V(to), d = t.clone().sub(f), len = Math.max(0.02, d.length()); a.position.copy(f); a.setDirection(d.normalize()); a.setLength(len, Math.min(0.45, len * 0.4), Math.min(0.3, len * 0.25)); }
  /* remove labels belonging to a sub-group before rebuilding it */
  function clearSub(sub) { LABS = LABS.filter(s => { let o = s; while (o) { if (o === sub) return false; o = o.parent; } return true; }); L.clear(sub); }
  /* grouped bar chart; values drawn from lo to hi over height H */
  function chart(sub, v, o = {}) {
    const Ng = v.g.length, Ns = v.s.length, span = o.span ?? 28, gw = Math.min(4.6, span / Ng), w = Math.min(1.4, (gw - 0.6) / Ns), H = o.H ?? 7, x0c = o.x ?? 0;
    const bars = [];
    v.g.forEach((nm, i) => { const x0 = x0c + (i - (Ng - 1) / 2) * gw; sub.add(lab(nm, [x0, -0.25, 2.4], { size: o.ls ?? 16 }));
      v.s.forEach(([sn, c, vals], j) => { const val = vals[i]; if (val == null) { sub.add(lab('N/A', [x0 + (j - (Ns - 1) / 2) * (w + 0.08), 0.6, 0], { size: 14 })); return; }
        const x = x0 + (j - (Ns - 1) / 2) * (w + 0.08), b = block(w, 1, w, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(Number.isInteger(val) ? val.toFixed(1) : String(val), [x, 0, 0], { size: 15 }); sub.add(l); bars.push({ b, l, v: val, best: o.best && o.best(i, j) }); }); });
    if (Ns > 1) v.s.forEach(([sn, c], j) => sub.add(lab(sn, [x0c - span / 2 + 2.5 + j * 5.2, H + 2.0, 0], { size: 17, color: hexs(c) })));
    sub.add(lab(v.t, [x0c, H + 3.2, 0], { size: 20, border: 'rgba(56,209,255,.7)' }));
    return g => bars.forEach(({ b, l, v: val, best }) => { const h = Math.max(0.02, (val - (v.lo ?? 0)) / ((v.hi ?? 1) - (v.lo ?? 0)) * H * g); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.45; if (best) glow(b, 0.6); });
  }

  /* controls: api.ctls = [{label, items, get, set}] */
  function buildCtl() {
    const box = $('ctl'); box.innerHTML = ''; box.hidden = true; if (!api) return;
    (api.ctls || []).forEach((c, gi) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-g="${gi}" data-k="${k}" aria-pressed="${c.get() === k}">${t}</button>`).join('');
      box.appendChild(row); box.hidden = false;
    });
  }
  function syncCtl() { (api?.ctls || []).forEach((c, gi) => { $('ctl').querySelectorAll(`button[data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(c.get() === +b.dataset.k))); }); }
  const opt = (k, d, n) => clamp(+(OPT[k] ?? d) || 0, 0, n - 1);

  /* replace a label held in ref.l */
  function swap(G, ref, text, pos, o) { if (ref.l) dropLab(G, ref.l); ref.l = lab(text, pos, o); G.add(ref.l); return ref.l; }

  /* ---------- shared toy data ---------- */
  const R0 = L.rng(7);
  const TRUE_A = Array.from({ length: 24 }, (_, i) => 1.4 * Math.sin(i / 23 * Math.PI * 1.3) + 0.45 * Math.cos(i / 23 * Math.PI * 3.2));
  const NOISE = Array.from({ length: 24 }, () => L.gauss(R0) * 1.1);
  const CAMN = ['头部', '左腕', '右腕', '第 4 路'];
  const tokPer = (s) => (224 / s / 2) * (320 / s / 2);

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    let m = opt(0, 0, 2);
    G.add(L.grid(48, 24));
    const cams = [];
    for (let c = 0; c < 4; c++) {
      const row = [];
      for (let f = 0; f < 5; f++) { const b = block(0.12, 1.2, 1.7, COL.vid, [-19 + f * 0.32, 6.6 - c * 1.75, 0], { opacity: 0.55 + f * 0.09 }); G.add(b); row.push(b); }
      cams.push(row); G.add(lab(CAMN[c], [-21.6, 6.6 - c * 1.75, 0], { size: 14 }));
    }
    G.add(lab('最近 0.8 秒 · 5 帧 · 224 × 320', [-18.4, 8.4, 0], { size: 14 }));
    const st = block(0.7, 0.7, 0.7, COL.state, [-18.4, -1.2, 0]); G.add(st); G.add(lab('状态', [-16.4, -1.2, 0], { size: 14 }));
    G.add(lab('“Flip GR00T 1 to 2”\n→ Cosmos-Reason1（冻结）', [-18.6, -4.0, 0], { size: 14, border: hexs(COL.txt) }));
    const toks = inst(BOX, 4 * 2 * 12); G.add(toks);
    const core = block(6.2, 9.4, 4.2, COL.model, [-1.0, 2.6, 0], { opacity: 0.88 }); G.add(core);
    G.add(lab('2B Transformer\nCosmos-Predict2.5-2B 初始化', [-1.0, 8.6, 0], { size: 16, border: hexs(COL.model) }));
    const LV = {}, LT = {};
    const fut = []; for (let c = 0; c < 4; c++) for (let f = 0; f < 4; f++) { const b = block(0.12, 1.2, 1.7, COL.fut, [7.4 + f * 0.36, 6.6 - c * 1.75, 0]); G.add(b); fut.push(b); }
    G.add(lab('每路相机的未来帧', [9.6, 9.8, 0], { size: 14, border: hexs(COL.fut) }));
    const rib = ribbon(G, 24, COL.act, 0.12);
    G.add(lab('动作块（YAM / Dexter 48 步 = 1.6 秒）', [12.6, -4.2, 0], { size: 14, border: hexs(COL.act) }));
    const sIn = stream(G, 10, COL.vid, 0.12), sOut = stream(G, 8, COL.fut, 0.12), sAct = stream(G, 8, COL.act, 0.12);
    const ctls = [{ label: '模型', items: ['GR00T 2', 'Turbo'], get: () => m, set: k => { m = k; } }];
    let key = '';
    return { ctls, update(p) {
      const turbo = m === 1, per = tokPer(turbo ? 16 : 8);
      if (key !== m + '') { key = m + '';
        swap(G, LV, `VAE：${turbo ? 'Wan 2.2，空间 16×' : 'Wan 2.1，空间 8×'}\n每路每隐帧 ${per} token\n历史 2 隐帧 × 4 路 = ${fmt(per * 8)}`, [-8.2, -6.4, 0], { size: 14, border: hexs(turbo ? COL.turbo : COL.vid) });
        swap(G, LT, turbo ? 'G1 · Jetson Thor：124 ms / 次（1v2a）' : 'Dexter · RTX 5090：153 ms / 次（2v2a）', [4.6, -8.4, 0], { size: 15, border: 'rgba(56,209,255,.7)' }); }
      const g = seg(p, 0.05, 0.3), shown = turbo ? 3 : 12;
      for (let c = 0; c < 4; c++) for (let f = 0; f < 2; f++) for (let i = 0; i < 12; i++) { const k = (c * 2 + f) * 12 + i; const on = i < shown; setI(toks, k, [-11.6 + f * 1.3 + (i % 3) * 0.36, 6.2 - c * 1.75 + Math.floor(i / 3) * 0.3 - 0.5, 0], on ? 0.26 * g : 0.0001); colI(toks, k, hex3(turbo ? COL.turbo : COL.vid)); } done(toks);
      sIn([[-17.2, 3, 0], [-12.4, 3, 0], [-4.2, 3, 0]], p * 3 % 1, seg(p, 0.05, 0.3));
      glow(core, Math.abs(Math.sin(p * Math.PI * 6)) * seg(p, 0.3, 0.8));
      const a = seg(p, 0.45, 0.9);
      fut.forEach((b, i) => { b.visible = a > (i % 4) / 4; });
      const pts = TRUE_A.map((v, i) => [7.4 + i * 0.42, -1.6 + (v * a + NOISE[i] * 0.5 * (1 - a)) * 0.7, 0]); rib.userData.set(pts);
      sOut([[2.4, 4.2, 0], [7.0, 4.2, 0]], p * 3 % 1, seg(p, 0.45, 0.6)); sAct([[2.4, 0, 0], [7.0, -1.4, 0]], p * 3 % 1, seg(p, 0.45, 0.6));
      cap(p < 0.3 ? `输入：4 路相机各 5 帧 → ${turbo ? 'Wan 2.2' : 'Wan 2.1'} VAE → 每路每隐帧 <b>${per}</b> 个 token；状态 1 个 token；指令走交叉注意力` :
        p < 0.45 ? '视频、状态、带噪动作排成<b>一条序列</b>，进同一个 2B Transformer，流匹配去噪' :
        `同时输出<b>每路相机的未来帧</b>和<b>一段动作</b>；${turbo ? 'Turbo 视频 token 少 4 倍，在 Jetson Thor 上 124 ms' : 'Dexter 三路相机在 RTX 5090 上 153 ms'}`);
    } };
  }

  /* ---------- scene 2: data ---------- */
  function s2(G) {
    let ax = opt(0, 0, 2), tm = opt(1, 0, 2);
    const BIG = [['人类视频（Human-1M）', 402730, COL.human], ['UMI-10K', 10184, COL.umi], ['遥操作', 23508, COL.tele]];
    const TELE = [['YAM', 15146, 51.2], ['ABC-130k', 3591, 10.4], ['Sharpa', 2890, 20.6], ['Wuji', 1256, 14.0], ['G1', 275, 1.3], ['DROID', 350, 2.5]];
    const totB = BIG.reduce((a, b) => a + b[1], 0), totT = TELE.reduce((a, b) => a + b[1], 0);
    const bb = BIG.map((b, i) => { const m = bar(G, -12 + i * 4.2, 0, 2.4, b[2]); G.add(lab(b[0], [-12 + i * 4.2, -0.9, 2], { size: 14 })); return m; });
    const tb = TELE.map((t, i) => { const m = bar(G, 3 + i * 2.6, 0, 1.6, i < 2 ? COL.tele : i < 4 ? COL.gold : i === 4 ? COL.turbo : COL.noise); G.add(lab(t[0], [3 + i * 2.6, -0.9, 2], { size: 13 })); return m; });
    const LB = BIG.map(() => ({})), LTT = TELE.map(() => ({})), LH = {}, LH2 = {};
    const ctls = [{ label: '三大类', items: ['对数轴', '线性轴'], get: () => ax, set: k => { ax = k; } }, { label: '遥操作', items: ['按小时', '采样份额'], get: () => tm, set: k => { tm = k; } }];
    let key = '';
    return { ctls, update(p) {
      const g = seg(p, 0.05, 0.6);
      const hB = v => ax === 0 ? Math.log10(v) / Math.log10(402730) * 9 : v / 402730 * 9;
      const hT = t => tm === 0 ? t[1] / 15146 * 7 : t[2] / 51.2 * 7;
      BIG.forEach((b, i) => bb[i].userData.set(hB(b[1]) * g)); TELE.forEach((t, i) => tb[i].userData.set(hT(t) * g));
      if (key !== ax + '' + tm) { key = ax + '' + tm;
        BIG.forEach((b, i) => swap(G, LB[i], `${fmt(b[1])} h\n${(100 * b[1] / totB).toFixed(1)}%`, [-12 + i * 4.2, 0, 0], { size: 13 }));
        TELE.forEach((t, i) => swap(G, LTT[i], tm === 0 ? `${fmt(t[1])} h` : `${t[2]}%`, [3 + i * 2.6, 0, 0], { size: 12 }));
        swap(G, LH, ax === 0 ? '三大类 · 对数轴（log10 小时）' : '三大类 · 线性轴', [-7.8, 11.4, 0], { size: 16, border: 'rgba(56,209,255,.7)' });
        swap(G, LH2, tm === 0 ? `遥操作 · 小时（合计 ${fmt(totT)}）` : '遥操作 · 采样份额（合计 100%）', [9.5, 9.6, 0], { size: 16, border: 'rgba(56,209,255,.7)' }); }
      BIG.forEach((b, i) => LB[i].l.position.set(-12 + i * 4.2, hB(b[1]) * g + 0.9, 0));
      TELE.forEach((t, i) => LTT[i].l.position.set(3 + i * 2.6, hT(t) * g + 0.6, 0));
      const dexH = (2890 + 1256) / totT * 100, dexS = 20.6 + 14.0;
      cap(p < 0.6 ? `按小时：人类视频 <b>${(100 * 402730 / totB).toFixed(1)}%</b>、UMI ${(100 * 10184 / totB).toFixed(1)}%、遥操作 ${(100 * 23508 / totB).toFixed(1)}%（三大类之间的采样比例白皮书没给）` :
        `灵巧手（Sharpa + Wuji）占遥操作小时的 ${dexH.toFixed(1)}%，采样份额 ${dexS.toFixed(1)}%，被加重 <b>${(dexS / dexH).toFixed(1)} 倍</b>；YAM 不含 ABC 是 ${(100 * 15146 / totT).toFixed(1)}% 小时、51.2% 份额`);
    } };
  }

  /* ---------- scene 3: video tokens ---------- */
  function s3(G) {
    let m = opt(0, 0, 2), nc = opt(1, 0, 4);
    const fr = []; for (let f = 0; f < 5; f++) { const b = block(3.2, 2.24, 0.08, f === 4 ? 0x5fb8ef : 0x2b4a6b, [-16 + f * 0.25, 2.6 + f * 0.25, -f * 0.6]); G.add(b); fr.push(b); }
    G.add(lab('5 帧 · 224 × 320（0.8 秒 @ 5 fps）', [-15.4, -0.6, 0], { size: 14 }));
    const vae = block(2.0, 3.4, 2.4, COL.frozen, [-9.6, 2.6, 0]); G.add(vae);
    const LVAE = {};
    const toks = inst(BOX, 560); G.add(toks);
    const LC = {}, LG = {};
    const sA = stream(G, 8, COL.vid, 0.1), sB = stream(G, 8, COL.vid, 0.1);
    const ctls = [{ label: '模型', items: ['GR00T 2', 'Turbo'], get: () => m, set: k => { m = k; } }, { label: '相机路数', items: ['1', '2', '3', '4'], get: () => nc, set: k => { nc = k; } }];
    let key = '';
    return { ctls, update(p) {
      const s = m === 0 ? 8 : 16, gh = 224 / s, gw = 320 / s, th = gh / 2, tw = gw / 2, per = th * tw, n = nc + 1;
      if (key !== m + '' + nc) { key = m + '' + nc;
        swap(G, LVAE, `${m === 0 ? 'Wan 2.1' : 'Wan 2.2'} VAE（冻结）\n时间 4× · 空间 ${s}×`, [-9.6, 5.4, 0], { size: 14, border: hexs(m ? COL.turbo : COL.vid) });
        swap(G, LG, `隐网格 ${gh} × ${gw} → 2 × 2 patch → ${th} × ${tw} = ${per} token`, [2.6, 6.8, 0], { size: 15, border: 'rgba(56,209,255,.7)' });
        swap(G, LC, `历史 token = ${per} × 2 隐帧 × ${n} 路 = ${fmt(per * 2 * n)}`, [2.6, -2.6, 0], { size: 16, border: hexs(COL.gold) }); }
      const g = seg(p, 0.3, 0.8), cell = m === 0 ? 0.42 : 0.84;
      for (let k = 0; k < 560; k++) {
        const lf = Math.floor(k / 280), i = k % 280; const on = i < per;
        const r = Math.floor(i / tw), c = i % tw; const vis = on && (i / per) < g;
        setI(toks, k, [-4 + c * cell, -0.4 + (th - 1 - r) * cell + lf * 0.25, -lf * 1.2], vis ? cell * 0.8 : 0.0001); colI(toks, k, hex3(lf ? 0x2f86c4 : (m ? COL.turbo : COL.vid)));
      } done(toks);
      sA([[-14, 2.6, 0], [-10.6, 2.6, 0]], p * 3 % 1, seg(p, 0.02, 0.3)); sB([[-8.6, 2.6, 0], [-4.4, 2.6, 0]], p * 3 % 1, seg(p, 0.25, 0.5));
      cap(p < 0.3 ? `5 帧像素进冻结的 ${m === 0 ? 'Wan 2.1' : 'Wan 2.2'} VAE：时间 1 + 4k 结构把 5 帧压成 <b>2 个隐帧</b>（推断）` :
        `空间 ÷ ${s} 得 ${gh} × ${gw} 隐网格，2 × 2 一个 patch：每路每隐帧 <b>${per}</b> 个 token；${n} 路历史共 <b>${fmt(per * 2 * n)}</b> 个`);
    } };
  }

  /* ---------- scene 4: attention mask ---------- */
  function s4(G) {
    let k4 = opt(0, 0, 4);
    const T = { bf: [[1, 1, 0, 0], [1, 1, 0, 0], [0, 0, 1, 0], [1, 1, 1, 1]], joint: [[1, 0, 0, 0], [1, 1, 0, 0], [0, 0, 1, 0], [1, 1, 1, 1]], dis: [[1, 0, 0, 0], [1, 1, 0, 0], [0, 0, 1, 0], [1, 0, 1, 1]], full: [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]] };
    const KEYS = ['bf', 'joint', 'dis', 'full'], NAMES = ['bidirectional_full（最接近白皮书）', 'joint_video_action', 'disjoint（分支缺省）', 'full'];
    const GN = ['条件视频', '去噪视频', '状态', '动作'], GC = [COL.vid, COL.fut, COL.state, COL.act], GX = [-16.5, -12.0, -8.4, -5.6], GW = [3.6, 3.6, 0.8, 2.6];
    const grp = GN.map((nm, i) => { const b = block(GW[i], 1.0, 1.0, GC[i], [GX[i], 0.6, 0]); G.add(b); G.add(lab(nm, [GX[i], -0.6, 0], { size: 14 })); return b; });
    G.add(lab('文本 token（Cosmos-Reason1，交叉注意力）', [-11, 7.6, 0], { size: 14, border: hexs(COL.txt) }));
    const txt = block(9, 0.6, 0.6, COL.txt, [-11, 6.6, 0]); G.add(txt);
    const cells = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const b = block(1.5, 1.5, 0.3, COL.dim, [5 + c * 1.7, 7 - r * 1.7, 0]); G.add(b); cells.push(b); }
    const GS = ['条件', '去噪', '状态', '动作']; GS.forEach((nm, i) => { G.add(lab(nm, [3.2, 7 - i * 1.7, 0], { size: 12 })); G.add(lab(nm, [5 + i * 1.7, 8.6, 0], { size: 12 })); });
    G.add(lab('行 = 查询，列 = 键', [7.6, 0.0, 0], { size: 13 }));
    const arrs = [0, 1, 2, 3].map(() => arrowTo(G, [0, 0, 0], [0.1, 0, 0], COL.act));
    const LN = {};
    const ctls = [{ label: '掩码', items: ['白皮书≈', 'joint', '分支缺省', 'full'], get: () => k4, set: k => { k4 = k; } }];
    let key = '';
    return { ctls, update(p) {
      const t = T[KEYS[k4]];
      if (key !== k4 + '') { key = k4 + '';
        cells.forEach((b, i) => { const r = Math.floor(i / 4), c = i % 4, on = t[r][c]; b.material.color.setHex(on ? COL.ok : 0x2a3142); b.userData.c = hex3(on ? COL.ok : 0x2a3142); });
        swap(G, LN, NAMES[k4], [7.6, 10.6, 0], { size: 15, border: 'rgba(56,209,255,.7)' }); }
      const g = seg(p, 0.2, 0.6);
      arrs.forEach((a, j) => { const on = t[3][j] && j !== 3; a.visible = on && g > 0.05; if (on) setArrow(a, [GX[3], 1.4, 0], [L.lerp(GX[3], GX[j], g), 1.4 + 1.2 * Math.sin(g * Math.PI) + 0.2, 0]); });
      cells.forEach((b, i) => glow(b, Math.floor(i / 4) === 3 ? 0.4 * seg(p, 0.6, 0.8) : 0));
      const seesFut = t[3][1] === 1, vidSeesAct = t[0][3] === 1;
      cap(`动作看去噪中的未来视频：<b>${seesFut ? '能' : '不能'}</b> · 视频看动作：<b>${vidSeesAct ? '能' : '不能'}</b>（除 full 外，未来视频的预测不以动作为条件）` + (k4 === 2 ? ' · 这是分支注释里的缺省值' : ''));
    } };
  }

  /* ---------- scene 5: three-stage pretraining ---------- */
  function s5(G) {
    const ST = [{ nm: '阶段 1 · 单视角视频', mix: [0.75, 0.05, 0.2], v: 1, a: 0 }, { nm: '阶段 2 · 多视角视频 + 动作', mix: [0.5, 0.15, 0.35], v: 1, a: 1 }, { nm: '阶段 3 · 加重机器人', mix: [0.3, 0.15, 0.55], v: 1, a: 1 }];
    const MC = [COL.human, COL.umi, COL.tele], MN = ['人类视频', 'UMI', '遥操作'];
    const parts = ST.map((s, i) => { const y = 7 - i * 3.2; G.add(lab(s.nm, [-14, y, 0], { size: 15 })); let x = -8; return s.mix.map((w, j) => { const W = w * 16; const b = block(W, 1.6, 1.6, MC[j], [x + W / 2, y, 0], { opacity: 0.35 }); x += W; G.add(b); return b; }); });
    MN.forEach((n, j) => G.add(lab(n, [-6 + j * 5, 10.2, 0], { size: 13, border: hexs(MC[j]) })));
    const lamps = ST.map((s, i) => { const y = 7 - i * 3.2; const v = L.sphere(0.45, COL.vid), a = L.sphere(0.45, s.a ? COL.act : COL.dim); v.position.set(10.5, y, 0); a.position.set(12.0, y, 0); G.add(v, a); return [v, a]; });
    G.add(lab('损失', [11.25, 10.4, 0], { size: 12 }), lab('视频', [10.3, 9.1, 0], { size: 12 }), lab('动作', [12.3, 9.1, 0], { size: 12 }));
    G.add(lab('→ 任务后训练（全量或 LoRA）→ RL', [0, -3.4, 0], { size: 15, border: hexs(COL.model) }));
    return { update(p) {
      const k = Math.min(2, Math.floor(p * 3.2));
      parts.forEach((row, i) => row.forEach(b => { b.material.opacity = i === k ? 1 : 0.3; b.material.transparent = true; glow(b, i === k ? 0.25 : 0); }));
      lamps.forEach(([v, a], i) => { v.scale.setScalar(i === k ? 1.25 : 0.9); a.scale.setScalar(i === k && ST[i].a ? 1.25 : 0.9); });
      cap(k === 0 ? '<b>阶段 1</b>：单视角、只预测未来视频，先建立具身交互的视觉动态先验（以人类视频为主）' :
        k === 1 ? '<b>阶段 2</b>：加具身专用的状态 / 动作模块，多视角视频 + 动作联合训练；人类数据的动作是跟踪到的手部姿态' :
        '<b>阶段 3</b>：继续联合训练，加重机器人示范（尤其 YAM）；柱宽是示意，白皮书没给配比');
    } };
  }

  /* ---------- scene 6: joint / cached denoising ---------- */
  function s6(G) {
    let sch = opt(0, 0, 3), cps = opt(1, 0, 2);
    const SCH = [{ k: '2v4a', v: 2, a: 4 }, { k: '2v2a', v: 2, a: 2 }, { k: '1v2a', v: 1, a: 2 }];
    const vid = inst(BOX, 4 * 4); G.add(vid);
    const rib = ribbon(G, 24, COL.act, 0.12);
    G.add(lab('未来视频隐变量（4 路）', [-12, 7.4, 0], { size: 14, border: hexs(COL.fut) }), lab('动作块', [-12, -0.8, 0], { size: 14, border: hexs(COL.act) }));
    const sub = new THREE.Group(); G.add(sub);
    const LS = {};
    const ctls = [{ label: '去噪', items: SCH.map(s => s.k), get: () => sch, set: k => { sch = k; } }, { label: 'CPS 噪声', items: ['关', '开（RL）'], get: () => cps, set: k => { cps = k; } }];
    let key = '', steps = [];
    return { ctls, update(p) {
      const S = SCH[sch];
      if (key !== sch + '') { key = sch + '';
        clearSub(sub); steps = [];
        for (let i = 0; i < S.a; i++) { const joint = i < S.v ? (S.a === 4 ? i * 2 === i * 2 && (i % 2 === 0) : true) : false; steps.push(joint); }
        if (S.a === 4 && S.v === 2) steps = [true, false, true, false]; else if (S.a === 2 && S.v === 2) steps = [true, true]; else if (S.a === 2 && S.v === 1) steps = [true, false];
        steps.forEach((j, i) => { const w = j ? 2.6 : 1.0; const b = block(w, 1.0, 1.0, j ? COL.model : COL.act, [-4 + i * 3.4, 3.2, 0]); sub.add(b); sub.add(lab(j ? `k=${i} 联合步` : `k=${i} 缓存步`, [-4 + i * 3.4, 4.4, 0], { size: 12 })); });
        swap(G, LS, `${S.k}：DiT 前向 ${S.a} 次，其中联合 ${steps.filter(x => x).length} 次`, [2, 9.4, 0], { size: 16, border: 'rgba(56,209,255,.7)' }); }
      const nA = S.a, prog = clamp(p / 0.9, 0, 1), done_ = prog * nA, kA = Math.floor(done_);
      const nV = steps.filter((x, i) => x && i <= kA).length;
      const vlev = clamp(1 - Math.min(nV, S.v) / S.v * seg(p, 0, 0.9), 0, 1);
      for (let i = 0; i < 16; i++) { setI(vid, i, [-4 + (i % 4) * 2.2, 6.4 - Math.floor(i / 4) * 0.0 + (Math.floor(i / 4) - 1.5) * 0.3, -Math.floor(i / 4) * 0.6], [1.9, 1.2, 0.1]); const c = hex3(COL.fut), n = hex3(COL.noise); colI(vid, i, [L.lerp(c[0], n[0], vlev), L.lerp(c[1], n[1], vlev), L.lerp(c[2], n[2], vlev)]); } done(vid);
      const sig = 1 - Math.min(1, done_ / nA), jit = cps ? 0.35 * (sig + 0.15) : 0;
      const pts = TRUE_A.map((v, i) => [-4 + i * 0.5, -2.6 + ((1 - sig) * v + sig * NOISE[i]) * 0.8 + jit * Math.sin(i * 7.1 + Math.floor(done_) * 3.3), 0]); rib.userData.set(pts);
      sub.children.forEach(o => { if (o.isMesh) { const i = Math.round((o.position.x + 4) / 3.4); glow(o, i === Math.min(kA, nA - 1) && p < 0.92 ? 0.9 : 0); } });
      cap(`第 <b>${Math.min(kA + 1, nA)}</b> / ${nA} 个动作去噪事件 · ${steps[Math.min(kA, nA - 1)] ? '联合步：视频和动作一起更新' : '缓存步：只更新动作，复用视频和状态的 KV'}${cps ? ' · CPS：给要执行的动作坐标加新噪声（视频保持确定）' : ''}`);
    } };
  }

  /* ---------- scene 7: x-adapt ---------- */
  function s7(G) {
    let v = opt(0, 0, 3);
    const hum = block(3.2, 2.2, 0.3, COL.human, [-14, 6.0, 0]); G.add(hum); G.add(lab('人类示范：有任务、没机器人', [-14, 7.8, 0], { size: 13, border: hexs(COL.human) }));
    const play = block(3.2, 2.2, 0.3, COL.tele, [-14, 1.6, 0]); G.add(play); G.add(lab('机器人 play：有机器人、没任务', [-14, -0.2, 0], { size: 13, border: hexs(COL.tele) }));
    const core = block(4, 5, 3, COL.model, [-5, 3.8, 0]); G.add(core); G.add(lab('GR00T 2\n（跨具身预训练）', [-5, 7.4, 0], { size: 14, border: hexs(COL.model) }));
    const imag = []; for (let i = 0; i < 4; i++) { const b = block(1.6, 1.2, 0.2, COL.fut, [1.2 + i * 1.8, 5.2, 0]); G.add(b); imag.push(b); }
    G.add(lab('想象的未来：机器人自己的手', [3.9, 6.6, 0], { size: 13, border: hexs(COL.fut) }));
    const robot = L.arm(0x9aa6bf); robot.position.set(10.5, 0, 0); robot.scale.set(0.6, 0.6, 0.6); G.add(robot);
    const sH = stream(G, 6, COL.human, 0.12), sP = stream(G, 6, COL.tele, 0.12), sO = stream(G, 6, COL.act, 0.12);
    const sub = new THREE.Group(); G.add(sub);
    const TB = [
      { t: '完整：人类示范 + play + 跨具身预训练', s: [['GR00T 2', COL.ok, [65, 30, 10, 50]], ['GR00T 1.7', 0x6b7794, [0, 0, 0, 5]]] },
      { t: '没有跨具身预训练（只在目标机器人数据上预训练）', s: [['无跨具身', 0x8e9bb8, [0, 0, 0, 20]], ['GR00T 2', COL.ok, [65, 30, 10, 50]]] },
      { t: '去掉人类示范（只剩 play 数据）', s: [['同配方', COL.bad, [0, 0, 0, 0]], ['GR00T 2', COL.ok, [65, 30, 10, 50]]] }
    ];
    const ctls = [{ label: '配置', items: ['完整', '无跨具身预训练', '无人类示范'], get: () => v, set: k => { v = k; } }];
    let key = '', draw = null;
    return { ctls, update(p) {
      if (key !== v + '') { key = v + ''; clearSub(sub); const T = TB[v]; sub.position.set(0, -12.5, 0); draw = chart(sub, { t: T.t, g: ['滤纸', '滴管', '载玻片', '抛包裹'], s: T.s, lo: 0, hi: 80 }, { span: 22, H: 5.5, x: -2 }); }
      draw(seg(p, 0.5, 0.95));
      hum.material.transparent = true; hum.material.opacity = v === 2 ? 0.15 : 1;
      sH([[-12.4, 6, 0], [-7, 4.6, 0]], p * 3 % 1, v === 2 ? 0 : seg(p, 0, 0.2)); sP([[-12.4, 1.6, 0], [-7, 3.2, 0]], p * 3 % 1, seg(p, 0, 0.2));
      imag.forEach((b, i) => { b.visible = v !== 2 && seg(p, 0.2, 0.5) > i / 4; });
      sO([[-3, 3, 0], [9.6, 2.4, 0]], p * 3 % 1, seg(p, 0.35, 0.5));
      robot.userData.reach([10.5 + 2.4 + Math.sin(p * Math.PI * 2) * 0.6, 0.6, 0.8 * Math.cos(p * Math.PI * 2)]);
      cap(v === 0 ? '人类示范说明“做什么”，play 数据说明“这台机器人长什么样、怎么动”；不用任何遥操作示范，滤纸 <b>65%</b>、抛包裹 <b>50%</b>' :
        v === 1 ? '把预训练换成只用目标机器人数据（同等预算）：化学实验任务全部 0%，抛包裹 20%' : '去掉人类示范，同一配方在四个任务上都是 0%：任务信息全部来自人类示范');
    } };
  }

  /* ---------- scene 8: GRPO context memory ---------- */
  function s8(G) {
    let sc = opt(0, 0, 3), hh = opt(1, 1, 2);
    const SC = [{ nm: '历史 0.75，这轮全失败', m: 0.75, R: [0, 0, 0, 0, 0, 0, 0, 0] }, { nm: '历史 0.10，这轮全成功', m: 0.10, R: [1, 1, 1, 1, 1, 1, 1, 1] }, { nm: '历史 0.50，这轮 3 / 8', m: 0.50, R: [1, 0, 0, 1, 0, 0, 1, 0] }];
    const balls = Array.from({ length: 8 }, (_, i) => { const s = L.sphere(0.55, COL.ok); s.position.set(-10 + i * 2.8, 7.2, 0); G.add(s); return s; });
    const bars = Array.from({ length: 8 }, (_, i) => block(1.2, 1, 1.2, COL.gold, [-10 + i * 2.8, 2, 0], { edges: false }));
    bars.forEach(b => G.add(b));
    const zero = L.box(24, 0.05, 0.05, 0x8e9bb8, { edges: false }); zero.position.set(-0.2, 2, 0); G.add(zero);
    G.add(lab('A = 0', [13.4, 2, 0], { size: 13 }));
    const LA = Array.from({ length: 8 }, () => ({})), LB = {};
    const ctls = [{ label: '场景', items: ['全失败', '全成功', '混合'], get: () => sc, set: k => { sc = k; } }, { label: 'h', items: ['0（RLOO）', '2（本文）'], get: () => hh, set: k => { hh = k; } }];
    let key = '';
    return { ctls, update(p) {
      const S = SC[sc], h = hh ? 2 : 0, N = 8;
      const A = S.R.map((r, i) => { const sum = S.R.reduce((a, b, j) => a + (j === i ? 0 : b), 0); const b = (h * S.m + sum) / (h + N - 1); return r - b; });
      const g = seg(p, 0.3, 0.8);
      balls.forEach((b, i) => { b.material.color.setHex(S.R[i] ? COL.ok : COL.bad); b.position.y = 7.2 + 0.3 * Math.sin(p * 12 + i); b.visible = p > i * 0.03; });
      bars.forEach((b, i) => { const hgt = Math.max(0.02, Math.abs(A[i]) * 6 * g); b.scale.y = hgt; b.position.y = 2 + (A[i] >= 0 ? hgt / 2 : -hgt / 2); b.material.color.setHex(A[i] >= 0 ? COL.ok : COL.bad); });
      if (key !== sc + '' + hh) { key = sc + '' + hh;
        A.forEach((a, i) => swap(G, LA[i], (a >= 0 ? '+' : '') + a.toFixed(3), [-10 + i * 2.8, a >= 0 ? 2 + Math.abs(a) * 6 + 0.7 : 2 - Math.abs(a) * 6 - 0.7, 0], { size: 12 }));
        swap(G, LB, `${S.nm} · h = ${h} · N = 8 · 基线 b = (h·m + 其余 7 次之和) / (h + 7)`, [0, 9.8, 0], { size: 14, border: 'rgba(56,209,255,.7)' }); }
      LA.forEach((o, i) => { o.l.visible = g > 0.95; });
      const allSame = S.R.every(r => r === S.R[0]);
      cap(allSame && h === 0 ? '普通留一基线（RLOO）：一组全成或全败时，每次尝试的优势都是 <b>0</b>，这组数据白跑了' :
        allSame ? `加上 h = 2 个“历史均值”伪回报：${S.R[0] ? '历史很差的上下文这次全成功，得到正优势' : '历史成功 75% 的上下文这次全失败，得到 −1.5 / 9 = <b>−0.167</b> 的优势'}` :
        '混合结果时两种基线差别不大；记忆主要救的是“全成 / 全败”的组，在 RoboCasa365 上这类上下文占多数');
    } };
  }

  /* ---------- scene 9: agentic ---------- */
  function s9(G) {
    let v = opt(0, 0, 2);
    const loopN = ['观察', '推理', '执行', '验证'];
    const ring = loopN.map((n, i) => { const a = i / 4 * Math.PI * 2; const b = block(1.6, 1.0, 0.6, COL.agent, [-14 + 2.6 * Math.cos(a), 6 + 2.6 * Math.sin(a), 0]); G.add(b); G.add(lab(n, [-14 + 2.6 * Math.cos(a), 6 + 2.6 * Math.sin(a) + 0.95, 0], { size: 12 })); return b; });
    G.add(lab('S2：前沿多模态智能体', [-14, 10, 0], { size: 14, border: hexs(COL.agent) }));
    const mcp = block(3, 5.4, 1.2, 0x5b6b8c, [-6, 6, 0]); G.add(mcp); G.add(lab('MCP 工具\nwam_act / stop_wam\nget_image · localize_object\nmove_to_pose · set_gripper', [-4.8, 6.0, 1.2], { size: 12 }));
    const wam = block(3.4, 2.2, 1.6, COL.model, [1.5, 8, 0]); G.add(wam); G.add(lab('GR00T 2（默认执行者）', [1.5, 9.6, 0], { size: 13 }));
    const cap_ = block(3.4, 2.2, 1.6, COL.gold, [1.5, 4, 0]); G.add(cap_); G.add(lab('CaP 程序（SAM 3、cuRobo）', [1.5, 2.4, 0], { size: 13 }));
    const table = L.box(8, 0.2, 5, 0x2b3650, { edgeOpacity: 0.2 }); table.position.set(10, 4.6, 0); G.add(table);
    const disc = L.cyl(0.45, 0.45, 0.08, 0xff4fd8); disc.position.set(8.6, 4.8, 0.6); G.add(disc);
    const cr1 = L.box(1.2, 0.08, 0.2, 0xff4fd8, { edges: false }), cr2 = L.box(0.2, 0.08, 1.2, 0xff4fd8, { edges: false }); cr1.position.set(11.6, 4.8, -0.8); cr2.position.set(11.6, 4.8, -0.8); G.add(cr1, cr2);
    G.add(lab('抓取点（圆）· 释放点（十字）', [10, 6.4, 0], { size: 12 }));
    const tok = L.sphere(0.3, COL.white); G.add(tok);
    const sub = new THREE.Group(); G.add(sub);
    const TB = [
      { t: '杂乱开局装配（各 100 次，成功次数）', g: ['飞机', '拖拉机', 'Hot Wheels'], s: [['SFT', 0x8e9bb8, [69, 51, 23]], ['+ DAgger', COL.vid, [84, 71, 78]], ['+ 智能体', COL.ok, [98, 97, 97]]], hi: 100 },
      { t: '视觉引导（基准等权平均，%）', g: ['短时程', '长时程'], s: [['GR00T 2', 0x8e9bb8, [35.7, 0.0]], ['+ 语言', COL.vid, [44.2, 1.7]], ['+ 语言 + 视觉', COL.ok, [76.8, 53.3]]], hi: 90 }
    ];
    const ctls = [{ label: '结果', items: ['装配', '视觉引导'], get: () => v, set: k => { v = k; } }];
    let key = '', draw = null;
    return { ctls, update(p) {
      if (key !== v + '') { key = v + ''; clearSub(sub); sub.position.set(0, -11.0, 0); const T = TB[v]; draw = chart(sub, { t: T.t, g: T.g, s: T.s, lo: 0, hi: T.hi }, { span: 20, H: 5.5, x: -1 }); }
      draw(seg(p, 0.45, 0.95));
      const ph = (p * 4) % 1, k = Math.floor(p * 4) % 4;
      ring.forEach((b, i) => glow(b, i === k ? 0.8 : 0));
      const useCaP = p > 0.55 && p < 0.75;
      const path = [[-11.4, 6, 0], [-6, 6, 0], useCaP ? [1.5, 4, 0] : [1.5, 8, 0]];
      tok.position.set(...along(ph < 0.5 ? path : path.slice().reverse(), ph < 0.5 ? ph * 2 : (ph - 0.5) * 2));
      glow(wam, useCaP ? 0 : 0.5); glow(cap_, useCaP ? 0.7 : 0);
      cap(useCaP ? 'GR00T 2 卡住或掉了零件：S2 调 <b>stop_wam</b>，用 CaP 技能修复状态，再把控制交还 GR00T 2' :
        v === 0 ? '装配：DAgger 补纠正示范，智能体负责发现并修复失败；300 个回合里只失败 8 个' : '视觉引导：把抓取 / 释放点画在相机画面上，比只用语言引导高 32.6 点（短时程）');
    } };
  }

  /* ---------- scene 10: Turbo + SONIC ---------- */
  function s10(G) {
    let v = opt(0, 0, 2);
    const LY = [{ nm: 'S2 推理模型（可选）', f: '选任务 / 标目标', y: 9.4, c: COL.agent }, { nm: 'S1 GR00T 2 Turbo · Jetson Thor', f: '约 1 Hz · 1.6 秒 = 80 个运动 token', y: 6.6, c: COL.turbo }, { nm: 'S0 SONIC · Jetson Orin NX', f: '50 Hz · token → 关节位置目标', y: 3.8, c: COL.act }, { nm: '关节 PD 控制器', f: '1000 Hz', y: 1.0, c: COL.state }];
    const lay = LY.map(l => { const b = block(9, 1.6, 1.2, l.c, [-10, l.y, 0], { opacity: 0.85 }); G.add(b); G.add(lab(`${l.nm}\n${l.f}`, [-10, l.y, 0.9], { size: 13 })); return b; });
    const toks = inst(BOX, 80); G.add(toks);
    const body = new THREE.Group(); body.position.set(9, 0, 0); G.add(body);
    const torso = block(1.6, 2.4, 0.9, 0x9aa6bf, [0, 4.6, 0]), head = L.sphere(0.55, 0x9aa6bf); head.position.set(0, 6.4, 0);
    const legL = block(0.5, 3, 0.5, 0x7d889f, [-0.5, 1.6, 0]), legR = block(0.5, 3, 0.5, 0x7d889f, [0.5, 1.6, 0]), armL = block(0.4, 2.4, 0.4, 0x7d889f, [-1.2, 4.4, 0]), armR = block(0.4, 2.4, 0.4, 0x7d889f, [1.2, 4.4, 0]);
    body.add(torso, head, legL, legR, armL, armR);
    G.add(lab('Unitree G1', [9, 8.0, 0], { size: 14 }));
    const sub = new THREE.Group(); G.add(sub);
    const TB = [{ t: '表 25 · G1 真机全身任务成功率（%）', g: ['爆米花', '清理桌面', '地面拾取', '擦洒出物'], s: [['DP', 0x6b7794, [27.1, 0, 36.7, 10.0]], ['GR00T 1.7', COL.vid, [83.3, 73.3, 50.0, 43.3]], ['Turbo', COL.ok, [100, 93.3, 83.3, 46.7]]], hi: 100 },
      { t: '表 26 · 分布外桌面抓放（30 次，%）', g: ['只用真机', '真机 + 仿真'], s: [['π0.5', 0x6b7794, [0.0, 13.3]], ['GR00T 1.7', COL.vid, [6.7, 40.0]], ['Turbo', COL.ok, [6.7, 63.3]]], hi: 80 }];
    const ctls = [{ label: '结果', items: ['表 25', '表 26'], get: () => v, set: k => { v = k; } }];
    let key = '', draw = null;
    return { ctls, update(p) {
      if (key !== v + '') { key = v + ''; clearSub(sub); sub.position.set(0, -12.5, 0); const T = TB[v]; draw = chart(sub, { t: T.t, g: T.g, s: T.s, lo: 0, hi: T.hi }, { span: 22, H: 5, x: -1 }); }
      draw(seg(p, 0.4, 0.95));
      const tS = p * 1.6;
      const consumed = Math.floor((tS % 1.6) / 1.6 * 80);
      for (let i = 0; i < 80; i++) { setI(toks, i, [-4.4 + (i % 40) * 0.2, 6.3 + Math.floor(i / 40) * 0.3, 0], 0.16); colI(toks, i, hex3(i < consumed ? COL.dim : COL.turbo)); } done(toks);
      glow(lay[1], (p * 1.0) % 1 < 0.08 ? 1 : 0); glow(lay[2], (p * 50 / 10) % 1 < 0.3 ? 0.7 : 0); glow(lay[3], (p * 200 / 10) % 1 < 0.5 ? 0.5 : 0);
      const w = Math.sin(p * Math.PI * 4);
      armL.rotation.z = 0.4 * w; armR.rotation.z = -0.5 - 0.3 * w; legL.rotation.z = 0.15 * w; legR.rotation.z = -0.15 * w; body.position.x = 9 + Math.sin(p * Math.PI * 2) * 1.2; body.rotation.y = 0.3 * Math.sin(p * Math.PI * 2);
      cap(`S1 每次给 80 个 SONIC token（80 ÷ 50 Hz = <b>1.6 秒</b>），已被 S0 取走 ${consumed} 个；Turbo 在 Thor 上 124 ms 出一次预测，约每秒规划一次`);
    } };
  }

  /* ---------- scene 11: latency + Elo ---------- */
  function s11(G) {
    let v = opt(0, 0, 3);
    const sub = new THREE.Group(); G.add(sub);
    const LAT = { g: ['基线', '+运行时', '+TensorRT', '+CUDA graph', '+FP8', '+减步'], d5090: [224.73, 183.66, 95.05, 90.01, 54.79, 38.40], thor: [720.41, 614.53, 256.12, 254.00, 182.22, 123.97] };
    const ELO = [['GR00T 2 vs π0.5', 236], ['GR00T 1.7 vs π0.5', 141], ['Turbo vs GR00T 1.7', 109], ['GR00T 2 vs GR00T 1.7', 95], ['Turbo★ vs GR00T 2', 14]];
    const win = d => 1 / (1 + Math.pow(10, -d / 400));
    const ctls = [{ label: '图表', items: ['RTX 5090', 'Jetson Thor', 'Elo → 胜率'], get: () => v, set: k => { v = k; } }];
    let key = '', draw = null;
    return { ctls, update(p) {
      if (key !== v + '') { key = v + ''; clearSub(sub);
        if (v < 2) { const d = v === 0 ? LAT.d5090 : LAT.thor; draw = chart(sub, { t: `G1 · GR00T 2 Turbo · ${v === 0 ? 'RTX 5090' : 'Jetson Thor（120 W）'} · 中位预测时延 ms`, g: LAT.g, s: [['ms', v === 0 ? COL.vid : COL.turbo, d]], lo: 0, hi: d[0] * 1.05 }, { span: 30, H: 8 }); }
        else draw = chart(sub, { t: 'YAM V2 盲测 A/B · Elo 差（标签里是现算的期望胜率）', g: ELO.map(e => `${e[0]}\n胜率 ${(100 * win(e[1])).toFixed(0)}%`), s: [['ΔElo', COL.ok, ELO.map(e => e[1])]], lo: 0, hi: 260 }, { span: 30, H: 8, ls: 13 }); }
      draw(seg(p, 0.05, 0.6));
      const d = v === 0 ? LAT.d5090 : LAT.thor;
      cap(v < 2 ? `总加速 <b>${(d[0] / d[5]).toFixed(2)}×</b>：TensorRT 那一步最大（${d[1].toFixed(1)} → ${d[2].toFixed(1)} ms）；最后一步把 2v4a 改成 1v2a` :
        `胜率 = 1 / (1 + 10^(−ΔElo/400))：+236 → ${(100 * win(236)).toFixed(1)}%，+95 → ${(100 * win(95)).toFixed(1)}%；Turbo 对 GR00T 2 的 +14 区间跨 0（−28 到 +58），分不出`);
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];
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
  /* OPT must survive into BUILD on first load: go() resets it after building */
  go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0));
  window.__gr00t2Debug = { get cap() { return $('cap').textContent; } };
})();
