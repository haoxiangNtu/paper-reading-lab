'use strict';
/* "Igniting VLMs toward the Embodied Space" (WALL-OSS, arXiv 2509.11766) taken apart into eleven scenes.
   Layer widths, vocabulary and parameter counts come from the HF checkpoint x-square-robot/wall-oss-flow (config.json and the
   safetensors header). Routing, attention mask, freezing and flow-matching details come from X-Square-Robot/wall-x at 86f70a3
   (2025-09-11, the last commit before arXiv v1). Scene 11 redraws Fig. 7 from the PDF's vector paths and copies Table 2.
   Each scene's update(p) is a pure function of the timeline p plus the current toggles. Scenes 5, 7 and 8 compute toy numbers. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { img: 0x4fc98a, txt: 0x9d8cff, st: 0xf2c14e, act: 0xf0963c, fast: 0x38d1ff, vl: 0x3a8ee8, sa: 0x7f8fe0, frz: 0x5a6378, bad: 0xe05d5d, ok: 0x4fc98a, warn: 0xf2c14e, dim: 0x46506a, white: 0xeef2fa, pink: 0xd9a6e0, wall: 0x5b7fcc, pi0: 0xb3a9de, dp: 0xe2c0e6, noise: 0x8e9bb8 };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const fmt = (x, d = 1) => x.toFixed(d);
  const big = n => n.toLocaleString('en-US');

  /* ---------- real data ---------- */
  /* parameter counts from the safetensors header of wall-oss-flow (identical shapes in wall-oss-fast) */
  const PAR = { base: 3754622976, actFFN: 452984832, vlFFN: 2434793472, newRows: 3643392, proc: 12787712, norm: 2160, total: 4224041072 };
  /* Fig. 7, read from the PDF vector paths (percent task progress); null = no bar drawn */
  const F7 = {
    id: { names: ['place-by-color', 'block-spell', 'set-table', 'tidy-bedroom', 'collect-waste', 'pick-place-cup', '平均'],
      v: [[83.3, 75.0, 50.0], [62.7, 33.0, 10.0], [83.3, 71.6, 75.0], [40.0, 13.3, 1.0], [100.0, 100.0, 74.1], [93.0, 97.5, 17.5], [77.1, 65.1, 37.9]] },
    ood: { names: ['place-by-color', 'block-spell', 'set-table', 'collect-waste', '平均'],
      v: [[85.0, 79.9, 26.6], [75.0, 33.9, null], [66.6, 64.1, 33.3], [75.0, 71.6, null], [75.4, 62.4, 15.0]] },
    vqa: { names: ['物体定位', '场景描述', '动作规划'], v: [[91.6, 46.1], [87.6, 57.7], [69.0, 59.8]] }
  };

  const SCENES = [
    { n: 1, part: '总览', title: '一个 VLM，三种输出，没有“未来画面”', sub: '输入当前画面、指令和状态；输出文本、离散动作或连续动作', dur: 14, cam: [0.0, 1.3, 30, [0, 4.4, 0]],
      html: dl([['主干', 'Qwen2.5-VL-3B，36 层，隐藏 2048'], ['新加', '每层一个动作 FFN（中间维 2048）+ 动作投影；共 4.69 亿参数'], ['总参数', '4,224,041,072（HF 文件头逐项相加）'], ['输出', 'LM 头：CoT / 子任务 / FAST token；流头：32 步 × 20 维动作']]) +
        '<p><b>它不是世界模型。</b>三个输出都不是未来观测：没有图像解码器，损失里也没有画面重建或预测项。论文 §6.2 只把“未来帧预测”当作一个待回答的方向。</p>' +
        '<p>点画面里的方块可以跳到对应那一幕。</p>' + src('§3 · 图 3 · §6.2 · HF config.json 和 model.safetensors 文件头') },
    { n: 2, part: '§3 三种范式', title: '统一、解耦，还是“只分 FFN”', sub: '原文图 2：蓝色是继承自 VLM 的权重', dur: 13, cam: [0.0, 1.28, 31, [0, 4.0, 0]],
      html: dl([['(a) 统一', 'VL 和动作挤在同一套 SA 和 FFN 里，按下一个 token 预测（RT-2、OpenVLA）'], ['(b) 解耦', '另起一个动作分支，只从 VLM 取信息（π0）'], ['(c) 本文', '共享 SA（继承），FFN 一分为二：VL FFN 出 VQA 和 DAM，动作 FFN 出 CAM']]) +
        '<p>作者的说法：(a) 动作监督扰动原权重，先验漂移、过拟合到动作；(b) 视觉和语言只是辅助信号，指令跟随弱；(c) 共享注意力让动作 token 每一层都直接和图文 token 交互，FFN 分开避免互相干扰。</p>' +
        '<p>原图 (c) 的标题写的是“WALL-A”。</p>' + src('§3 · 图 2') },
    { n: 3, part: '§3 一层的内部', title: '共享注意力，按 token 类型分到两个 FFN', sub: '切换“状态 token 去哪”：代码 / 论文图 3', dur: 14, cam: [0.0, 1.3, 30, [0, 4.0, 0]],
      html: dl([['注意力', '所有 token 共用（q 2048、k/v 各 256）'], ['VL FFN', 'SwiGLU 2048 → 11008 → 2048，每层 6763 万参数'], ['动作 FFN', 'SwiGLU 2048 → 2048 → 2048，每层 1258 万参数'], ['路由', 'token_type = (id == &lt;|action|&gt;)，没有门控权重']]) +
        '<p>代码里只有加噪动作 token 走动作 FFN；机器人状态 token 和 FAST 离散 token 都走 VL FFN。论文图 3 里状态 token 画在两边之间，没有画它走哪个 FFN。</p>' +
        '<p>两个 FFN 的输出按原位置拼回去，进入下一层的共享注意力。所以“紧耦合”指的是：动作 token 每一层都直接看图文 token，而不是像 π0 那样只在一个单独的分支里交叉读取。</p>' +
        guess('16 个 token 是挑出来示意的，实际一个样本有数百个图像 token 和 32 个动作 token。') +
        src('§3 · 图 3 · 代码 modeling_qwen2_5_vl_act.py:85-160, 195-197；load_lerobot_dataset.py:379') },
    { n: 4, part: '§3 序列与掩码', title: '一条训练序列长什么样，谁能看谁', sub: '切换动作表示（流匹配 / FAST）和版本（86f70a3 / HEAD 模板）', dur: 14, cam: [0.0, 1.38, 30, [0.6, 4.6, 0]],
      html: dl([['序列', '系统提示 · 各路相机图像 · 指令 · 状态 &lt;|propri|&gt; · 动作'], ['流匹配', '32 个 &lt;|action|&gt;，嵌入换成加噪动作；不算交叉熵'], ['FAST', '一串 &lt;|action_token_i|&gt;，按交叉熵自回归预测'], ['86f70a3', '因果掩码，但动作 token 之间双向'], ['HEAD 模板', 'causal_action_attention_mask: true，动作 token 之间也因果']]) +
        '<p>行是查询（谁在看），列是键（被看）。亮格表示可见。底部扫过的那一行就是当前查询。</p>' +
        '<p>流匹配时 32 个动作 token 要一起去噪，所以原版让它们互相可见；FAST 时动作 token 是一个一个生成的，只能因果。</p>' +
        guess('图像画成 6 个格子、动作画成 7 个格子；真实序列长得多。') +
        src('§3 · 代码 utils.py:414-503；modeling_qwen2_5_vl_act.py:615-637；HEAD core/attention/mask.py:57-98') },
    { n: 5, part: '§3 启发阶段', title: 'FAST：把一段连续动作变成几个离散 token', sub: '切换量化缩放，看非零系数有几个', dur: 15, cam: [0.0, 1.34, 30, [0.2, 4.6, 0]],
      html: dl([['步骤', '归一化到 [−1, 1] → 沿时间做 DCT → 乘缩放后取整 → BPE 合并'], ['分词器', 'physical-intelligence/fast（scale 10，词表 2048）'], ['词表', '新增 &lt;|action_token_0|&gt; 到 &lt;|action_token_2047|&gt;，id 151667 起'], ['损失', '和文本 token 共用一个交叉熵（论文式 (1) 写了两个 λ，代码里没有）']]) +
        '<p>平滑的动作在 DCT 下能量集中在前几个低频系数上，取整后大多数系数变成 0，BPE 再把常见的整数组合并成一个 token，所以一段 32 步的动作只需要很少的 token。</p>' +
        '<p>Inspiration 阶段同时做具身 VQA（定位、进度、规划），目的是让 VLM 先有一个粗的“动作意识”，再进入流匹配。</p>' +
        toyb('那条 32 步的动作曲线是我设的；DCT 和取整当场算，BPE 只示意，没有跑真的 BPE。') +
        src('§3 式 (1) · HF tokenizer_config.json · 代码 utils.py:506-611') },
    { n: 6, part: '§3 融合阶段', title: '谁被冻结、谁在训练', sub: '切换：第 1 段（论文）/ 第 1 段（代码 freeze_vlm）/ 第 2 段', dur: 14, cam: [0.0, 1.28, 31, [0.4, 4.4, 0]],
      html: dl([['第 1 段 · 论文', '冻结 VLM，只训动作 FFN 下的流头'], ['第 1 段 · 代码', 'freeze_vlm：只训名字含 moe.experts.1. 的参数'], ['第 2 段', '全部解冻，同一个流匹配目标，式 (3)'], ['优化器', 'AdamW，权重衰减 0.1，余弦学习率']]) +
        '<p>代码的 freeze_vlm 连流头的投影层（w1 / w2 / w3 / action_proj_back / propri_proj）一起冻住了，可训练的只剩 36 个动作 FFN。论文写的是“训流头”。</p>' +
        '<p>预训练代码没有公开，作者实际怎么冻结不得而知；公开的开关更像是给微调用的。</p>' +
        src('§3 · 式 (2)(3) · 代码 qwen_vl_act_trainer.py:526-577') },
    { n: 7, part: '§3 流匹配训练', title: '在噪声和动作之间连直线，学速度', sub: '切换记号：代码（t = 1 是动作）/ 论文（ρ = 0 是动作）', dur: 15, cam: [0.0, 1.36, 29, [0.6, 4.6, 0]],
      html: dl([['代码', 'x_t = (1 − t)·ε + t·a，目标 v = a − ε'], ['论文', 'x_t = (1 − ρ)·x₀ + ρ·ε，目标 ε − x₀'], ['关系', 't = 1 − ρ，同一条直线，速度差一个负号'], ['时间', 'u ~ Beta(1.5, 1)，t = (0.999 − u)/0.999，偏向噪声端'], ['加权', '论文写 w(t)，代码是常数 1']]) +
        '<p>每一对（噪声、动作）连一条直线，网络在直线上任意一点学那条直线的方向。时间多采噪声端，是因为那里最难（和 π0 的做法一样）。</p>' +
        '<p>论文时期 t 的公式能取到 −0.001，后来改成 (1 − u)·0.999。</p>' +
        toyb('二维“动作分布”是两团高斯；直方图按代码公式用固定种子抽 4000 次。') +
        src('§3 式 (2) · 代码 action_head.py:221-271, 331-338') },
    { n: 8, part: '推理', title: '从噪声积分出一段 32 步的动作', sub: '切换采样步数：86f70a3 / 7b57b78 之后', dur: 14, cam: [0.0, 1.3, 30, [-0.4, 4.4, 0]],
      html: dl([['方法', 'Euler 积分，每一步把当前动作块喂回整个模型一次'], ['86f70a3', 'linspace(0, 1, 10)：10 个时间点只走 9 步'], ['7b57b78 之后', 'linspace(0, 1, 11)：10 步'], ['HF 配置', 'num_inference_timesteps: 5，但论文时期没有代码读它'], ['输出', '32 步 × 20 维，再按数据集的 min / delta 反归一化']]) +
        '<p>每一步都要跑一遍 36 层（图文前缀可以缓存），所以步数直接决定延迟。论文没有给推理延迟和控制频率。</p>' +
        toyb('噪声和目标动作块是我设的；假设速度场正好是直线路径的速度，只示意步数。') +
        src('代码 modeling_qwen2_5_vl_act.py:1874-1945；action_head.py:91-126；提交 7b57b78') },
    { n: 9, part: '§3 Uni-CoT', title: '指令 → 推理 → 子任务 → 动作，可以跳步', sub: '切换路径：全链 / 跳过推理 / 直接出动作 / 公开代码', dur: 15, cam: [0.0, 1.3, 31, [0, 4.2, 0]],
      html: dl([['论文', '一个模型学任意前向映射，推理时自己决定要不要写 CoT、子任务，式 (4)'], ['例子', 'block-spell：目标词 FIVE，已放 F、I，下一个 V → “把字母 V 放到木板上” → 动作'], ['监督', '只有约 1% 的帧带 CoT / 子任务标注'], ['公开代码', '没有 CoT 字段；子任务生成和“以子任务为指令出动作”是两种独立样本']]) +
        '<p>和“VLM 规划器 + 独立控制器”的区别是：子任务文本和动作出自同一个模型，同一套注意力。</p>' +
        src('§3 · 图 4 · 图 6 · §5.2.4–5.2.5 · 代码 utils.py:366-503') },
    { n: 10, part: '§4 数据', title: '三类数据，喂给两个阶段', sub: '切换阶段，看哪些数据进去', dur: 13, cam: [0.0, 1.3, 31, [0, 4.0, 0]],
      html: dl([['自采动作', '57.5%：桌面臂、移动支架、轮式双臂、轮式人形'], ['开源动作', '33.1%：表 1 的 24 个数据集，统一到 20 维末端位姿模板'], ['多模态 VQA', '9.4%：12 个开源图文集 + 自采轨迹上的具身 VQA'], ['总量', '§4：超过 1 万小时；§4.4：超过数万小时']]) +
        '<p>图 5 的三个比例加起来是 100.0%，但单位没写。Inspiration 偏重 VQA 和 FAST，Integration 偏重真实和开源轨迹上的流匹配；两个阶段都按配额混合。</p>' +
        guess('24 个小方块代表表 1 的 24 个开源数据集，不按大小。') + src('§4 · 图 5 · 表 1') },
    { n: 11, part: '§5 结果', title: '图 7 的数字，和正文对不上的地方', sub: '切换：分布内 / 分布外 / 表 2 具身 VQA', dur: 14, cam: [0.0, 1.5, 30, [0.4, 4.4, 0]],
      html: dl([['ID 平均', 'WALL-OSS 77.1，π0 65.1，DP 37.9'], ['OOD 平均', '75.4，62.4，15.0（DP 两格无柱，按 0 计入）'], ['对不上 1', 'DP collect-waste ID：图 74.1，正文“80%”'], ['对不上 2', 'OOD collect-waste：图 75.0 / 71.6，正文“都高于 80%”'], ['表 2', '物体定位 91.6 对 46.1，场景描述 87.6 对 57.7，动作规划 69.0 对 59.8']]) +
        '<p>纵轴是“任务进度”，正文却常说“成功率”。block-spell 的基线是 GPT4-Subtask 设置。正文的零样本 85% / 61% 说“如图 7”，但图 7 里没有。</p>' +
        src('图 7（矢量读数）· 表 2 · §5.2.3') }
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
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.0, phi: 1.3, dist: 30, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  if (!S) { showInfo(0); return; }
  const root = new THREE.Group(); S.scene.add(root);
  let LABS = [], refDist = 30, PICKS = [];
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  function dynLab(G, pos, o = {}) {
    const st = { s: null, t: null };
    const f = t => { if (t === st.t) return; if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; st.s = lab(t, pos, o); G.add(st.s); };
    f.vis = v => { if (st.s) st.s.visible = v; };
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
  const tint = (m, h) => { m.material.color.setHex(h); m.userData.c = hex3(h); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.14) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.6, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  function ribbon(G, n, color, w = 0.06, o = {}) {
    const pos = new Float32Array(n * 6), idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: o.opacity ?? 1 })); m.frustumCulled = false; m.renderOrder = o.order ?? 2; G.add(m);
    m.userData.set = pts => { const k = Math.max(1, Math.min(n, pts.length)); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)], z = q[2] ?? 0; pos[i * 6] = q[0]; pos[i * 6 + 1] = q[1] - w / 2; pos[i * 6 + 2] = z; pos[i * 6 + 3] = q[0]; pos[i * 6 + 4] = q[1] + w / 2; pos[i * 6 + 5] = z; } g.attributes.position.needsUpdate = true; };
    return m;
  }
  function panel(G, x, y, z, w, h, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: o.color ?? 0x0c1220, transparent: true, opacity: o.opacity ?? 0.55, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }
  function axes(G, x0, y0, w, h, z, o = {}) {
    panel(G, x0 - 0.3, y0 - 0.3, z - 0.02, w + 0.6, h + 0.6);
    wire(G, [[x0, y0 + h, z], [x0, y0, z], [x0 + w, y0, z]], 0x9aa6bf, { opacity: 0.9 });
    (o.yt || []).forEach(([v, t]) => { const y = y0 + v * h; wire(G, [[x0, y, z], [x0 + w, y, z]], 0x4a5878, { opacity: 0.35 }); if (t != null) G.add(lab(t, [x0 - 0.6, y, z], { size: 14, bg: false, color: '#9aa6bf' })); });
    (o.xt || []).forEach(([v, t]) => { const x = x0 + v * w; G.add(lab(t, [x, y0 - 0.5, z], { size: 14, bg: false, color: '#9aa6bf' })); });
  }
  function bars(G, n) { const im = inst(CUBE, n); im.material.color.setHex(0xffffff); G.add(im); return im; }
  function setBar(im, i, x, y0, h, z, w, d, c) { const hh = Math.max(0.001, Math.abs(h)); setI(im, i, [x, y0 + (h >= 0 ? hh / 2 : -hh / 2), z], [w, hh, d]); if (c) colI(im, i, c); }
  /* a tiny "image" tile: a frame with a few coloured blobs */
  function tile(G, pos, w, h, seed) {
    const g = new THREE.Group(); g.position.set(...pos); G.add(g);
    g.add(block(w, h, 0.08, 0x23304a, [0, 0, 0], { edgeOpacity: 0.5 }));
    const r = L.rng(seed); for (let i = 0; i < 4; i++) { const c = [COL.img, COL.act, COL.warn, COL.vl][i]; const s = L.sphere(0.12 + 0.08 * r(), c); s.position.set((r() - 0.5) * w * 0.7, (r() - 0.5) * h * 0.6, 0.08); g.add(s); }
    return g;
  }
  function ctlRow(label, items, get, set) { return { label, items, get, set }; }

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
    const imgs = [6.4, 5.0, 3.6].map((y, i) => tile(G, [-11.2, y, 0], 1.8, 1.1, 11 + i));
    G.add(lab('三路相机\n（第一人称、腕部）', [-11.2, 8.0, 0], { size: 17, color: css(COL.img) }));
    const ins = block(1.8, 0.7, 0.3, COL.txt, [-11.2, 2.2, 0]); G.add(ins); G.add(lab('指令', [-13.0, 2.2, 0], { size: 16, color: css(COL.txt) }));
    const st = block(0.7, 0.7, 0.3, COL.st, [-11.2, 1.0, 0]); G.add(st); G.add(lab('状态', [-13.0, 1.0, 0], { size: 16, color: css(COL.st) }));
    /* 36 layers drawn as 12 slabs, blue → pink */
    const slabs = [];
    for (let i = 0; i < 12; i++) { const k = i / 11; const c = new THREE.Color().setRGB(0.27 + 0.55 * k, 0.45 + 0.2 * k, 0.8 + 0.08 * k).getHex(); const m = block(5.4, 0.36, 3.2, c, [-1.6, 0.9 + i * 0.52, 0]); G.add(m); slabs.push(m); }
    const core = block(5.8, 6.6, 3.6, 0x7f8fe0, [-1.6, 3.75, 0], { opacity: 0.08, edgeOpacity: 0.5 }); core.userData.go = 2; PICKS.push(core); G.add(core);
    G.add(lab('WALL-OSS · 36 层\nQwen2.5-VL-3B + 动作 FFN', [-1.6, 8.0, 0], { size: 19 }));
    const outT = block(3.2, 1.0, 0.4, COL.txt, [8.4, 6.2, 0]), outF = block(3.2, 1.0, 0.4, COL.fast, [8.4, 4.0, 0]), outA = block(3.2, 1.0, 0.4, COL.act, [8.4, 1.8, 0]);
    [[outT, 8], [outF, 4], [outA, 7]].forEach(([m, g]) => { m.userData.go = g; PICKS.push(m); G.add(m); });
    G.add(lab('文本：推理 CoT / 子任务', [8.4, 7.15, 0], { size: 16, color: css(COL.txt) }), lab('离散：FAST token', [8.4, 4.95, 0], { size: 16, color: css(COL.fast) }), lab('连续：32 步 × 20 维', [8.4, 2.75, 0], { size: 16, color: css(COL.act) }));
    const rb = ribbon(G, 32, COL.act, 0.08); rb.userData.set(Array.from({ length: 32 }, (_, i) => [7.0 + i * 0.09, 1.8 + 0.35 * Math.sin(i / 5), 0.25]));
    /* the ghost output that WALL-OSS does not have */
    const ghost = block(3.2, 1.0, 0.4, COL.noise, [8.4, 8.9, 0], { opacity: 0.18 }); G.add(ghost);
    const x1 = L.line([[6.9, 8.5, 0.3], [9.9, 9.3, 0.3]], COL.bad), x2 = L.line([[6.9, 9.3, 0.3], [9.9, 8.5, 0.3]], COL.bad); G.add(x1, x2);
    G.add(lab('未来画面：不输出（不是世界模型）', [8.4, 9.95, 0], { size: 16, color: '#ff9a9a' }));
    const pIn = [[[-10.0, 5.0, 0], [-4.4, 4.6, 0]], [[-10.0, 2.2, 0], [-4.4, 3.4, 0]], [[-10.5, 1.0, 0], [-4.4, 2.4, 0]]];
    pIn.forEach(q => wire(G, q, 0x9aa6bf, { opacity: 0.4 }));
    const pOut = [[[1.3, 6.0, 0], [6.7, 6.2, 0]], [[1.3, 4.2, 0], [6.7, 4.0, 0]], [[1.3, 2.4, 0], [6.7, 1.8, 0]]];
    pOut.forEach((q, i) => wire(G, q, [COL.txt, COL.fast, COL.act][i], { opacity: 0.4 }));
    const sIn = pIn.map((_, i) => stream(G, 6, [COL.img, COL.txt, COL.st][i], 0.12));
    const sOut = pOut.map((_, i) => stream(G, 7, [COL.txt, COL.fast, COL.act][i], 0.13));
    const sub = dynLab(G, [-1.6, -1.1, 0], { size: 17 });
    return { update(p) {
      const ph = p * 6 % 1;
      sIn.forEach((f, i) => f(pIn[i], ph, p < 0.25 ? 1 : 0.35));
      const k = p < 0.25 ? -1 : p < 0.5 ? 0 : p < 0.75 ? 1 : 2;
      sOut.forEach((f, i) => f(pOut[i], ph, k === i ? 1 : 0));
      slabs.forEach((m, i) => glow(m, p < 0.25 ? (Math.floor(p * 48) % 12 === i ? 0.8 : 0) : 0.15));
      [outT, outF, outA].forEach((m, i) => glow(m, k === i ? 0.9 : 0));
      sub(['图文和状态一起进入同一个 Transformer', '同一个模型可以写推理和子任务（LM 头）', '也可以写 FAST 离散动作 token（同一个 LM 头）', '或者用流头去噪出一段连续动作'][k + 1]);
      cap(['① 输入：当前的多路相机画面、一句指令、机器人状态', '② 输出 1：文本，推理（CoT）或子任务', '③ 输出 2：FAST 离散动作 token（Inspiration 阶段、wall-oss-fast）', '④ 输出 3：32 步 × 20 维连续动作（Integration 阶段、wall-oss-flow）。<b>没有任何一路输出未来画面</b>'][k + 1]);
    } };
  }

  /* ---------- scene 2: three paradigms (Fig. 2) ---------- */
  function s2(G) {
    let sel = +(OPT[0] ?? 0);
    const X = [-9, 0, 9], grp = [new THREE.Group(), new THREE.Group(), new THREE.Group()]; grp.forEach((g, i) => { g.position.x = X[i]; G.add(g); });
    const mats = [[], [], []];
    const add = (i, m) => { grp[i].add(m); mats[i].push(m); return m; };
    /* (a) unified */
    add(0, block(5.6, 0.8, 1.6, COL.vl, [0, 2.6, 0])); add(0, block(5.6, 0.8, 1.6, COL.vl, [0, 4.0, 0]));
    grp[0].add(lab('SA', [0, 2.6, 1.0], { size: 15, bg: false }), lab('FFN', [0, 4.0, 1.0], { size: 15, bg: false }), lab('DAM 或 CAM', [0, 5.6, 0], { size: 16 }));
    /* (b) decoupled */
    add(1, block(2.6, 0.8, 1.6, COL.vl, [-1.6, 2.6, 0])); add(1, block(2.6, 0.8, 1.6, COL.vl, [-1.6, 4.0, 0]));
    add(1, block(2.2, 0.8, 1.6, COL.white, [1.7, 2.6, 0], { opacity: 0.85 })); add(1, block(2.2, 0.8, 1.6, COL.white, [1.7, 4.0, 0], { opacity: 0.85 }));
    grp[1].add(lab('VLM', [-1.6, 5.0, 0], { size: 15 }), lab('动作分支', [1.7, 5.0, 0], { size: 15 }), lab('DAM 或 CAM', [1.7, 5.9, 0], { size: 16 }));
    const dash = wire(grp[1], [[-0.25, 3.3, 0.9], [0.55, 3.3, 0.9]], 0x7fb8ff, { dashed: true, opacity: 0.9 });
    /* (c) WALL-OSS */
    add(2, block(5.6, 0.8, 1.6, COL.vl, [0, 2.6, 0])); add(2, block(3.4, 0.8, 1.6, COL.vl, [-1.1, 4.0, 0])); add(2, block(1.9, 0.8, 1.6, COL.act, [1.85, 4.0, 0]));
    grp[2].add(lab('共享 SA', [0, 2.6, 1.0], { size: 15, bg: false }), lab('VL FFN', [-1.1, 4.0, 1.0], { size: 15, bg: false }), lab('动作', [1.85, 4.0, 1.0], { size: 14, bg: false }), lab('VQA · DAM', [-1.1, 5.4, 0], { size: 16 }), lab('CAM', [1.85, 5.4, 0], { size: 16 }));
    const names = ['(a) 统一设计（RT-2、OpenVLA）', '(b) 解耦设计（π0）', '(c) 本文（图里写 WALL-A）'];
    const probs = ['动作监督扰动原权重\n→ 先验漂移', '图文只是辅助信号\n→ 松耦合、指令跟随弱', '注意力共享、FFN 分开\n→ 紧耦合'];
    names.forEach((t, i) => G.add(lab(t, [X[i], 0.0, 0], { size: 17 })));
    const pl = probs.map((t, i) => { const s = lab(t, [X[i], 7.4, 0], { size: 16, color: i === 2 ? '#9ff0bf' : '#ffb3a8' }); G.add(s); return s; });
    /* tokens rising: VL (blue) on the left half, action (orange) on the right half of each stack */
    const toks = inst(BALL, 3 * 8); G.add(toks);
    const lanes = [[-1.8, -0.6, 0.6, 1.8], [-2.2, -1.0, 1.2, 2.2], [-2.0, -0.8, 1.4, 2.3]];
    return { ctls: [ctlRow('突出', ['全部', '(a)', '(b)', '(c)'], () => sel, k => { sel = k; })], update(p) {
      for (let i = 0; i < 3; i++) {
        const on = sel === 0 || sel === i + 1; mats[i].forEach(m => { m.material.opacity = on ? (m.userData.c[0] > 0.9 && m.userData.c[1] > 0.9 ? 0.85 : 1) : 0.15; m.material.transparent = true; });
        pl[i].visible = on;
        for (let j = 0; j < 8; j++) {
          const lane = lanes[i][j % 4], isAct = j % 4 >= 2, ph = (p * 3 + j * 0.13) % 1;
          let x = lane, y = 1.0 + ph * 5.2;
          if (i === 1 && isAct && y > 2.2 && y < 4.6) x = lane; /* decoupled: action stays in its own branch */
          setI(toks, i * 8 + j, [X[i] + x, y, 0.95], on ? 0.17 : 0.001); colI(toks, i * 8 + j, hex3(isAct ? COL.act : COL.vl));
        }
      }
      done(toks); dash.visible = sel === 0 || sel === 2;
      cap(sel === 0 ? '三种把 VLM 迁到动作的方式。蓝色是继承的 VLM 权重，白色和橙色是新加的' : ['', '<b>(a)</b> 动作和图文共用全部权重，动作监督会把原来的 FFN 拉偏', '<b>(b)</b> 动作在自己的分支里，只隔着一条虚线从 VLM 取信息', '<b>(c)</b> 每一层的注意力都共享，只有 FFN 按 token 类型分开'][sel]);
    } };
  }

  /* ---------- scene 3: one layer ---------- */
  function s3(G) {
    let mode = +(OPT[0] ?? 0);
    const T = ['i', 'i', 'i', 'i', 'i', 't', 't', 't', 't', 's', 'a', 'a', 'a', 'a', 'a', 'a'];
    const tc = { i: COL.img, t: COL.txt, s: COL.st, a: COL.act };
    const N = T.length, X0 = -10.5, DX = 1.4;
    const xs = T.map((_, i) => X0 + i * DX);
    const sa = block(23, 0.9, 2.2, COL.sa, [0, 3.0, 0], { opacity: 0.55 }); G.add(sa);
    G.add(lab('共享自注意力（每个 token 都能按掩码看别人）', [0, 3.0, 1.5], { size: 17 }));
    /* FFN widths proportional to intermediate size: 11008 vs 2048 */
    const wVL = 11.0, wA = 2.05;
    const vl = block(wVL, 1.4, 2.2, COL.vl, [-3.6, 5.6, 0], { opacity: 0.8 }), af = block(wA, 1.4, 2.2, COL.act, [6.4, 5.6, 0], { opacity: 0.85 }); G.add(vl, af);
    G.add(lab('VL FFN · 中间维 11008\n每层 3×2048×11008 = 6763 万', [-3.6, 7.4, 0], { size: 16, color: '#9cc6ff' }));
    G.add(lab('动作 FFN · 中间维 2048\n每层 3×2048² = 1258 万', [6.4, 7.4, 0], { size: 16, color: css(COL.act) }));
    const toks = inst(CUBE, N); G.add(toks);
    const tl = [['图像 token', -7.7, COL.img], ['指令', -1.6, COL.txt], ['状态', 2.1, COL.st], ['加噪动作', 6.6, COL.act]];
    tl.forEach(([t, x, c]) => G.add(lab(t.replace('&lt;', '<').replace('&gt;', '>'), [x, -0.2, 0], { size: 15, color: css(c) })));
    const q = lab('?', [xs[9], 4.6, 0.6], { size: 26, color: css(COL.warn) }); G.add(q);
    const arcs = []; for (let k = 0; k < 6; k++) { const a = ribbon(G, 24, 0xd45fa0, 0.04, { opacity: 0.55 }); arcs.push(a); }
    const vlIdx = [], aIdx = []; T.forEach((t, i) => (t === 'a' ? aIdx : vlIdx).push(i));
    return { ctls: [ctlRow('状态 token', ['按代码：走 VL FFN', '按论文图 3：没画清'], () => mode, k => { mode = k; })], update(p) {
      const up = seg(p, 0.05, 0.28), sh = seg(p, 0.42, 0.6), out = seg(p, 0.6, 0.78), back = seg(p, 0.85, 1.0);
      for (let i = 0; i < N; i++) {
        const t = T[i];
        let tx = xs[i];
        if (t === 'a') tx = 6.4 + (aIdx.indexOf(i) - 2.5) * 0.32;
        else if (t === 's' && mode === 1) tx = xs[i];
        else { const j = vlIdx.indexOf(i); tx = -3.6 + (j - (vlIdx.length - 1) / 2) * 0.95; }
        const unresolved = t === 's' && mode === 1;
        let x = L.lerp(xs[i], tx, unresolved ? 0 : sh), y = 1.0 + up * 2.0 + out * 2.6;
        if (unresolved) y = 1.0 + up * 2.0 + out * 0.6;
        x = L.lerp(x, xs[i], back); y = L.lerp(y, 1.0, back);
        setI(toks, i, [x, y, 0], [0.55, 0.55, 0.55]); colI(toks, i, hex3(tc[t]));
      }
      done(toks);
      q.visible = mode === 1 && p > 0.4 && p < 0.9;
      /* attention arcs while tokens sit in the SA slab */
      const sAt = seg(p, 0.25, 0.32) * (1 - seg(p, 0.4, 0.45));
      const pairs = [[14, 2], [12, 7], [10, 9], [15, 0], [11, 5], [13, 11]];
      arcs.forEach((a, k) => { a.visible = sAt > 0.02; if (!a.visible) return; const [i, j] = pairs[k]; const xa = xs[i], xb = xs[j], h = 0.6 + Math.abs(xa - xb) * 0.08; a.userData.set(Array.from({ length: 24 }, (_, s) => { const u = s / 23; return [L.lerp(xa, xb, u), 3.5 + h * Math.sin(Math.PI * u) * sAt, 1.2]; })); });
      glow(vl, sh > 0.2 && out < 0.9 ? 0.5 : 0); glow(af, sh > 0.2 && out < 0.9 ? 0.7 : 0); glow(sa, sAt > 0.2 ? 0.5 : 0);
      cap(p < 0.4 ? '① 所有 token 进同一个自注意力，动作 token 直接看图像和指令' : p < 0.85 ? (mode === 0 ? '② 按类型分流：只有加噪动作 token 走动作 FFN；<b>状态 token 和图文一起走 VL FFN</b>（代码）' : '② 按类型分流：图 3 里状态 token 画在两边之间，论文没说它走哪个 FFN') : '③ 两个 FFN 的输出按原位置拼回，进入下一层');
    } };
  }

  /* ---------- scene 4: sequence and attention mask ---------- */
  function s4(G) {
    let rep = +(OPT[0] ?? 0), ver = +(OPT[1] ?? 0);
    /* token layout: sys 2, image 6, instruction 4, state 1, tail 7 */
    const TY = [...Array(2).fill('t'), ...Array(6).fill('i'), ...Array(4).fill('t'), 's', ...Array(7).fill('x')];
    const N = TY.length, C = 0.42, X0 = -4.0, Y0 = 8.6;
    const cells = inst(CUBE, N * N); G.add(cells);
    const kt = inst(CUBE, N), qt = inst(CUBE, N); G.add(kt, qt);
    panel(G, X0 - 1.2, Y0 - N * C - 0.2, -0.1, N * C + 1.5, N * C + 1.5);
    G.add(lab('键（被看）→', [X0 + N * C / 2, Y0 + 1.0, 0], { size: 15, color: '#9aa6bf' }));
    G.add(lab('查询\n（谁在看）', [X0 - 2.9, Y0 - N * C / 2, 0], { size: 15, color: '#9aa6bf' }));
    const legend = [['系统 / 指令', COL.txt], ['图像', COL.img], ['状态 &lt;|propri|&gt;', COL.st]];
    legend.forEach(([t, c], i) => G.add(lab(t.replace('&lt;', '<').replace('&gt;', '>'), [7.8, 8.2 - i * 0.85, 0], { size: 15, color: css(c) })));
    const tailLab = dynLab(G, [7.8, 5.2, 0], { size: 15 });
    const verLab = dynLab(G, [7.8, 3.5, 0], { size: 15 });
    const seqLab = dynLab(G, [0.0, -0.4, 0], { size: 14 });
    const sweep = block(N * C, C * 1.05, 0.06, COL.white, [X0 + N * C / 2 - C / 2, Y0, 0.25], { opacity: 0.25 }); G.add(sweep);
    return { ctls: [ctlRow('动作表示', ['流匹配（wall-oss-flow）', 'FAST（wall-oss-fast）'], () => rep, k => { rep = k; }), ctlRow('掩码', ['86f70a3（论文时期）', 'HEAD 模板'], () => ver, k => { ver = k; })], update(p) {
      const tailC = rep === 0 ? COL.act : COL.fast;
      const tc = t => t === 't' ? COL.txt : t === 'i' ? COL.img : t === 's' ? COL.st : tailC;
      const isAct = i => TY[i] === 'x' && rep === 0;
      for (let i = 0; i < N; i++) {
        setI(kt, i, [X0 + i * C, Y0 + 0.5, 0], [C * 0.85, 0.3, 0.2]); colI(kt, i, hex3(tc(TY[i])));
        setI(qt, i, [X0 - 0.6, Y0 - i * C - 0.0, 0], [0.3, C * 0.85, 0.2]); colI(qt, i, hex3(tc(TY[i])));
        for (let j = 0; j < N; j++) {
          let ok = j <= i;
          if (isAct(i) && isAct(j) && ver === 0) ok = true;
          const c = ok ? (isAct(i) && isAct(j) ? hex3(COL.act) : [0.55, 0.62, 0.8]) : [0.1, 0.12, 0.18];
          setI(cells, i * N + j, [X0 + j * C, Y0 - i * C, 0], [C * 0.9, C * 0.9, ok ? 0.18 : 0.05]); colI(cells, i * N + j, c);
        }
      }
      done(cells); done(kt); done(qt);
      const r = Math.min(N - 1, Math.floor(p * N));
      sweep.position.y = Y0 - r * C;
      tailLab(rep === 0 ? '尾部：32 个 <|action|>\n（画成 7 个，走动作 FFN）' : '尾部：FAST token\n（逐个生成，走 VL FFN）');
      verLab(rep === 1 ? 'FAST：始终因果' : ver === 0 ? '动作块内部双向\n（橙色方块）' : '动作块内部也因果\n（causal_action_attention_mask）');
      seqLab('序列：系统提示 · 相机图像 · “Instruction: …” · “Proprioception: <|propri|>” · ' + (rep === 0 ? '<|action|> × 32' : '<|action_token_i|> …'));
      const who = TY[r] === 't' ? '文本' : TY[r] === 'i' ? '图像' : TY[r] === 's' ? '状态' : (rep === 0 ? '动作' : 'FAST');
      cap(`当前查询：第 ${r + 1} 个 token（${who}）。` + (TY[r] === 'x' && rep === 0 && ver === 0 ? '它能看到前面所有 token，<b>也能看到它后面的动作 token</b>' : '它只能看到自己和前面的 token'));
    } };
  }

  /* ---------- scene 5: FAST ---------- */
  function s5(G) {
    let sc = +(OPT[0] ?? 0); const SCALES = [10, 4];
    const T = 32;
    const a = Array.from({ length: T }, (_, t) => 0.55 * Math.sin(t / 32 * Math.PI * 1.3) + 0.25 * Math.cos(t / 32 * Math.PI * 3.1) - 0.1);
    /* orthonormal DCT-II */
    const dct = Array.from({ length: T }, (_, k) => { let s = 0; for (let n = 0; n < T; n++) s += a[n] * Math.cos(Math.PI / T * (n + 0.5) * k); return s * Math.sqrt((k === 0 ? 1 : 2) / T); });
    axes(G, -12.5, 2.0, 6.0, 4.0, 0, { yt: [[0, '−1'], [0.5, '0'], [1, '1']], xt: [[0, '0'], [1, '31']] });
    G.add(lab('① 一段动作（一维，32 步）', [-9.5, 7.0, 0], { size: 16 }));
    const curve = ribbon(G, T, COL.act, 0.09);
    axes(G, -3.6, 2.0, 7.0, 4.0, 0, { yt: [[0.5, '0']], xt: [[0, 'k=0'], [1, '31']] });
    G.add(lab('② DCT 系数 → ③ 乘缩放、取整', [0.0, 7.0, 0], { size: 16 }));
    const cb = bars(G, T);
    const tokIm = inst(CUBE, 12); G.add(tokIm);
    G.add(lab('④ BPE 合并 → 少数几个 token', [9.2, 7.0, 0], { size: 16 }));
    const lm = block(4.4, 0.7, 1.4, COL.vl, [9.2, 1.8, 0], { opacity: 0.85 }); G.add(lm); G.add(lab('LM 头（和文本共用）', [9.2, 0.9, 0], { size: 15 }));
    const cnt = dynLab(G, [0.0, 0.6, 0], { size: 16 });
    const ints = dynLab(G, [9.2, 5.9, 0], { size: 14 });
    return { ctls: [ctlRow('量化缩放', ['×10（FAST 默认）', '×4（更粗）'], () => sc, k => { sc = k; })], update(p) {
      const S = SCALES[sc];
      const q = dct.map(c => Math.round(c * S));
      const nz = q.filter(v => v !== 0).length;
      const draw = seg(p, 0.0, 0.2), grow = seg(p, 0.22, 0.45), snap = seg(p, 0.5, 0.65), fly = seg(p, 0.7, 0.95);
      const k = Math.max(2, Math.round(draw * T));
      curve.userData.set(Array.from({ length: k }, (_, t) => [-12.5 + t / (T - 1) * 6.0, 4.0 + a[t] * 2.0, 0.05]));
      const yScale = 2.0 / 1.5; /* coefficient 2.2 → half height */
      for (let i = 0; i < T; i++) {
        const v = L.lerp(dct[i], q[i] / S, snap) * grow;
        const zero = snap > 0.5 && q[i] === 0;
        setBar(cb, i, -3.6 + (i + 0.5) / T * 7.0, 4.0, zero ? 0.001 : v * yScale, 0, 0.16, 0.2, hex3(zero ? COL.dim : COL.fast));
      }
      done(cb);
      const nTok = Math.max(2, Math.ceil(nz * 0.6));
      for (let i = 0; i < 12; i++) {
        const on = i < nTok && fly > 0;
        const x0 = 3.4, y0 = 4.0, x1 = 7.2 + (i % 6) * 0.75, y1 = 4.4 - Math.floor(i / 6) * 0.8;
        const u = clamp(fly * 1.6 - i * 0.05, 0, 1), x = L.lerp(x0, x1, u), y = L.lerp(y0, y1, u) - (fly > 0.92 ? (fly - 0.92) * 20 : 0) * 0;
        setI(tokIm, i, [x, y, 0], on ? [0.55, 0.55, 0.55] : 0.001); colI(tokIm, i, hex3(COL.fast));
      }
      done(tokIm);
      glow(lm, fly > 0.8 ? 0.8 : 0);
      cnt(`缩放 ×${S}：32 个系数里 ${nz} 个非零`);
      ints(snap > 0.5 ? '非零整数：' + q.filter(v => v !== 0).slice(0, 8).join(' ') + (nz > 8 ? ' …' : '') : '');
      cap(p < 0.22 ? '① 一段 32 步的动作（归一化到 [−1, 1]）' : p < 0.5 ? '② 沿时间做 DCT：平滑的动作能量集中在低频' : p < 0.7 ? `③ 乘 ${S} 后取整：大多数高频系数变成 0` : '④ BPE 把整数串合并成少数 token，和文本 token 一起用交叉熵训练');
    } };
  }

  /* ---------- scene 6: freezing in the Integration stage ---------- */
  function s6(G) {
    let mode = +(OPT[0] ?? 0);
    const parts = [];
    const P = (name, w, h, d, pos, kind, c) => { const m = block(w, h, d, c, pos); G.add(m); parts.push({ m, kind, c }); return m; };
    P('vis', 3.0, 2.2, 1.6, [-10.0, 2.0, 0], 'vlm', COL.img);
    G.add(lab('视觉塔', [-10.0, 3.6, 0], { size: 15 }));
    P('emb', 2.2, 0.6, 1.6, [-6.0, 1.2, 0], 'vlm', COL.txt); G.add(lab('词嵌入', [-6.0, 0.4, 0], { size: 14 }));
    for (let l = 0; l < 6; l++) {
      const y = 1.6 + l * 1.05;
      P('sa', 6.4, 0.35, 1.6, [-1.2, y, 0], 'vlm', COL.sa);
      P('vl', 4.6, 0.4, 1.6, [-2.1, y + 0.45, 0], 'vlm', COL.vl);
      P('af', 1.5, 0.4, 1.6, [1.6, y + 0.45, 0], 'act', COL.act);
    }
    G.add(lab('36 层（画 6 层）：共享注意力 + VL FFN + 动作 FFN', [-1.2, 8.6, 0], { size: 16 }));
    P('lm', 2.6, 0.6, 1.6, [-8.2, 7.2, 0], 'vlm', COL.vl); G.add(lab('LM 头', [-8.2, 8.0, 0], { size: 14 }));
    const proj = P('in', 2.6, 0.7, 1.6, [6.4, 1.6, 0], 'proc', COL.warn); G.add(lab('w1 / w2 / w3\n加噪动作 + 时间 → 嵌入', [9.6, 1.6, 0], { size: 14 }));
    const outp = P('out', 2.6, 0.7, 1.6, [6.4, 7.0, 0], 'proc', COL.warn); G.add(lab('action_proj_back\n2048 → 20 速度', [9.6, 7.0, 0], { size: 14 }));
    const prp = P('prop', 1.6, 0.6, 1.6, [6.4, 3.0, 0], 'proc', COL.st); G.add(lab('propri_proj', [8.9, 3.0, 0], { size: 14 }));
    const loss = block(2.4, 0.8, 0.8, COL.bad, [6.4, 9.0, 0]); G.add(loss); G.add(lab('流匹配损失', [6.4, 9.9, 0], { size: 15, color: '#ffb3a8' }));
    const lock = dynLab(G, [-10.0, 6.0, 0], { size: 16 });
    const cnt = dynLab(G, [0.0, -0.5, 0], { size: 17 });
    const grads = stream(G, 18, COL.act, 0.11);
    const TRAIN = [{ vlm: 0, act: 1, proc: 1 }, { vlm: 0, act: 1, proc: 0 }, { vlm: 1, act: 1, proc: 1 }];
    const NUM = [PAR.actFFN + PAR.proc, PAR.actFFN, PAR.total - PAR.norm];
    return { ctls: [ctlRow('阶段', ['第 1 段 · 论文', '第 1 段 · 代码 freeze_vlm', '第 2 段'], () => mode, k => { mode = k; })], update(p) {
      const tr = TRAIN[mode];
      parts.forEach(({ m, kind, c }) => { const on = !!tr[kind]; m.material.color.setHex(on ? c : COL.frz); m.userData.c = hex3(on ? c : COL.frz); m.material.transparent = true; m.material.opacity = on ? 1 : 0.55; glow(m, on ? 0.25 + 0.35 * Math.sin(p * 30) ** 2 : 0); });
      if (mode === 1) { [proj, outp, prp].forEach(m => { m.material.color.setHex(0x8a3a3a); m.userData.c = hex3(0x8a3a3a); m.material.opacity = 0.9; }); }
      const path = mode === 2 ? [[6.4, 8.6, 0], [1.6, 6.9, 0], [-1.2, 4.6, 0], [-6.0, 1.6, 0], [-10.0, 2.4, 0]] : [[6.4, 8.6, 0], [6.4, 7.4, 0], [1.6, 6.9, 0], [1.6, 2.0, 0], [6.4, 1.9, 0]];
      grads(path, p * 3 % 1, 1);
      lock(mode === 2 ? '全部解冻' : '灰色：冻结');
      cnt(`可训练参数：${big(NUM[mode])}` + (mode === 1 ? '（流头投影也被冻住，红色）' : ''));
      cap(['论文：冻结 VLM，只训动作 FFN 下的流头。可训练 = 动作 FFN + 动作投影', '代码 freeze_vlm：只有名字含 <b>moe.experts.1.</b> 的参数可训练，<b>w1/w2/w3 和读出层也被冻结</b>', '第 2 段：全部解冻，梯度同时流到 VLM 和动作分支（式 (3)）'][mode]);
    } };
  }

  /* ---------- scene 7: flow matching training ---------- */
  function s7(G) {
    let conv = +(OPT[0] ?? 0);
    const r = L.rng(7), N = 40;
    const eps = Array.from({ length: N }, () => [L.gauss(r) * 0.9, L.gauss(r) * 0.9]);
    const dat = Array.from({ length: N }, (_, i) => { const c = i % 2 ? [1.6, 1.1] : [-1.4, -1.2]; return [c[0] + L.gauss(r) * 0.25, c[1] + L.gauss(r) * 0.25]; });
    const CX = -4.5, CY = 4.6, K = 1.55;
    panel(G, CX - 5.2, CY - 4.0, -0.1, 10.4, 8.0);
    const pe = inst(BALL, N), pd = inst(BALL, N), px = inst(BALL, N); G.add(pe, pd, px);
    for (let i = 0; i < N; i++) { setI(pe, i, [CX + eps[i][0] * K, CY + eps[i][1] * K, 0], 0.09); colI(pe, i, hex3(COL.noise)); setI(pd, i, [CX + dat[i][0] * K, CY + dat[i][1] * K, 0], 0.11); colI(pd, i, hex3(COL.act)); }
    done(pe); done(pd);
    for (let i = 0; i < 12; i++) wire(G, [[CX + eps[i][0] * K, CY + eps[i][1] * K, 0], [CX + dat[i][0] * K, CY + dat[i][1] * K, 0]], 0x9aa6bf, { opacity: 0.25 });
    const arrows = []; for (let i = 0; i < 6; i++) { const a = L.arrow([0, 0, 0], [1, 0, 0], COL.warn); G.add(a); arrows.push(a); }
    const nl = dynLab(G, [CX - 3.2, CY + 3.4, 0], { size: 15 }), dlb = dynLab(G, [CX + 3.0, CY + 3.4, 0], { size: 15 });
    /* time histogram, code formula t = (s - u)/s, u ~ Beta(1.5, 1) = U^(1/1.5) */
    const rr = L.rng(77), NB = 20, H = new Array(NB).fill(0); let neg = 0;
    for (let i = 0; i < 4000; i++) { const u = Math.pow(rr(), 1 / 1.5); const t = (0.999 - u) / 0.999; if (t < 0) neg++; H[clamp(Math.floor(clamp(t, 0, 0.99999) * NB), 0, NB - 1)]++; }
    const hm = Math.max(...H);
    const HX = 3.2, HY = 1.4, HW = 8.0, HH = 3.6;
    axes(G, HX, HY, HW, HH, 0, { xt: [[0, 't=0'], [1, 't=1']] });
    G.add(lab('训练时 t 的分布（4000 次）', [HX + HW / 2, HY + HH + 0.7, 0], { size: 15 }));
    const hb = bars(G, NB);
    for (let b = 0; b < NB; b++) setBar(hb, b, HX + (b + 0.5) / NB * HW, HY, H[b] / hm * HH, 0, HW / NB * 0.8, 0.2, hex3(COL.vl));
    done(hb);
    const hl = dynLab(G, [HX + HW / 2, HY - 1.2, 0], { size: 14 });
    G.add(lab(`t < 0 的样本：${neg} / 4000（论文时期公式）`, [HX + HW / 2, HY - 2.1, 0], { size: 14, color: '#ffb3a8' }));
    const tl = dynLab(G, [CX, CY - 4.6, 0], { size: 16 });
    return { ctls: [ctlRow('记号', ['代码：t = 1 是动作', '论文：ρ = 0 是动作'], () => conv, k => { conv = k; })], update(p) {
      const t = 0.5 - 0.5 * Math.cos(p * Math.PI * 2); /* sweep 0 → 1 → 0 */
      for (let i = 0; i < N; i++) { const x = [L.lerp(eps[i][0], dat[i][0], t), L.lerp(eps[i][1], dat[i][1], t)]; setI(px, i, [CX + x[0] * K, CY + x[1] * K, 0.1], 0.12); colI(px, i, hex3(COL.white)); }
      done(px);
      arrows.forEach((a, k) => { const i = k * 3; const x = [L.lerp(eps[i][0], dat[i][0], t), L.lerp(eps[i][1], dat[i][1], t)]; let v = [dat[i][0] - eps[i][0], dat[i][1] - eps[i][1]]; if (conv === 1) v = [-v[0], -v[1]]; const f = new THREE.Vector3(CX + x[0] * K, CY + x[1] * K, 0.2); const d = new THREE.Vector3(v[0], v[1], 0); const len = Math.max(0.2, d.length() * 0.45); a.position.copy(f); a.setDirection(d.normalize()); a.setLength(len, 0.3, 0.18); });
      nl(conv === 0 ? '噪声 ε（t = 0）' : '噪声 ε（ρ = 1）'); dlb(conv === 0 ? '动作 a（t = 1）' : '动作 x₀（ρ = 0）');
      hl(conv === 0 ? '偏向 t = 0（噪声端），和 π0 一样' : '换成论文记号就是偏向 ρ = 1（噪声端）');
      tl(conv === 0 ? `x_t = (1 − t)ε + t·a，t = ${fmt(t, 2)}；黄色箭头 = 目标 a − ε` : `x_ρ = (1 − ρ)x₀ + ρε，ρ = ${fmt(1 - t, 2)}；黄色箭头 = 目标 ε − x₀`);
      cap(conv === 0 ? '每对（噪声、动作）连一条直线；网络在直线上任一点学这条线的方向。<b>代码</b>：目标指向动作' : '<b>论文</b>式 (2)：同一条直线，时间反过来，目标指向噪声；两种写法等价');
    } };
  }

  /* ---------- scene 8: sampling ---------- */
  function s8(G) {
    let ver = +(OPT[0] ?? 0);
    const r = L.rng(8), T = 32, D = 3;
    const noise = Array.from({ length: D }, () => Array.from({ length: T }, () => L.gauss(r) * 0.55));
    const tgt = [Array.from({ length: T }, (_, t) => 0.6 * Math.sin(t / 31 * Math.PI)), Array.from({ length: T }, (_, t) => -0.4 + 0.02 * t), Array.from({ length: T }, (_, t) => (t > 18 ? 0.6 : -0.5))];
    const X0 = -10.2, W = 12.0, Z = [1.6, 0, -1.6], YC = [6.6, 4.4, 2.2];
    for (let d = 0; d < D; d++) { panel(G, X0 - 0.2, YC[d] - 1.0, Z[d] - 0.05, W + 0.4, 2.0, { opacity: 0.35 }); }
    ['左末端 x', '左末端 z', '左夹爪'].forEach((t, d) => G.add(lab(t, [X0 - 1.4, YC[d], Z[d]], { size: 14, color: '#9aa6bf' })));
    const rbs = [0, 1, 2].map(d => ribbon(G, T, [COL.act, COL.warn, COL.fast][d], 0.08));
    const gh = [0, 1, 2].map(d => { const g = ribbon(G, T, 0x9aa6bf, 0.03, { opacity: 0.35 }); g.userData.set(Array.from({ length: T }, (_, t) => [X0 + t / (T - 1) * W, YC[d] + tgt[d][t], Z[d] - 0.02])); return g; });
    G.add(lab('32 步动作块（画 20 维里的 3 维；灰线 = 目标）', [X0 + W / 2, 8.6, 0], { size: 16 }));
    /* time axis with step dots */
    const TX = 4.2, TW = 7.4, TY = 0.2;
    wire(G, [[TX, TY, 0], [TX + TW, TY, 0]], 0x9aa6bf, { opacity: 0.8 });
    G.add(lab('t = 0', [TX, TY - 0.6, 0], { size: 13, color: '#9aa6bf' }), lab('t = 1', [TX + TW, TY - 0.6, 0], { size: 13, color: '#9aa6bf' }));
    const dots = inst(BALL, 12); G.add(dots);
    const model = block(2.4, 1.6, 1.4, COL.sa, [5.6 + 2.4, 4.4, 0], { opacity: 0.8 }); G.add(model);
    G.add(lab('WALL-OSS\n一次完整前向', [8.0, 6.2, 0], { size: 15 }));
    const stepL = dynLab(G, [8.0, 2.4, 0], { size: 16 });
    return { ctls: [ctlRow('版本', ['86f70a3：10 个时间点 = 9 步', '7b57b78 之后：10 步'], () => ver, k => { ver = k; })], update(p) {
      const nPts = ver === 0 ? 10 : 11, nSteps = nPts - 1;
      const times = Array.from({ length: nPts }, (_, i) => i / (nPts - 1) * (ver === 1 ? 0.999 : 1));
      const prog = seg(p, 0.05, 0.9) * nSteps, k = Math.min(nSteps, Math.floor(prog));
      const tNow = k >= nSteps ? times[nSteps] : L.lerp(times[k], times[k + 1], L.ease(prog - k));
      for (let d = 0; d < D; d++) rbs[d].userData.set(Array.from({ length: T }, (_, t) => [X0 + t / (T - 1) * W, YC[d] + L.lerp(noise[d][t], tgt[d][t], tNow), Z[d]]));
      for (let i = 0; i < 12; i++) { const on = i < nPts; setI(dots, i, [TX + (on ? times[i] : 0) * TW, TY, 0], on ? (i <= k ? 0.16 : 0.1) : 0.001); colI(dots, i, hex3(i <= k ? COL.act : COL.dim)); }
      done(dots);
      glow(model, Math.abs(Math.sin(prog * Math.PI)) * 0.8);
      stepL(`第 ${Math.min(nSteps, k + 1)} / ${nSteps} 步 · Δt = 1/${nSteps}`);
      cap(ver === 0 ? '论文时期：<b>linspace(0, 1, 10)</b> 给出 10 个时间点，Euler 只走 9 步。HF 配置里的 5 没有被读取' : '2025-11-07 的修正：时间点多加一个，走满 10 步，时间再乘 0.999');
    } };
  }

  /* ---------- scene 9: Uni-CoT ---------- */
  function s9(G) {
    let path = +(OPT[0] ?? 0);
    const X = [-10, -3.4, 3.4, 10], Y = 3.0;
    const names = ['高层指令', '推理（CoT）', '子任务', '连续动作'], cs = [COL.txt, 0xb08cff, COL.fast, COL.act];
    const bx = X.map((x, i) => { const m = block(4.2, 1.3, 1.2, cs[i], [x, Y, 0]); G.add(m); G.add(lab(names[i], [x, Y, 0.9], { size: 17, bg: false })); return m; });
    const ex = [['“用字母积木拼出\n卡片上的词”', -10], ['目标词 FIVE\n已放 F、I\n下一个 V', -3.4], ['“把字母 V\n放到木板上”', 3.4]];
    const exL = ex.map(([t, x]) => { const s = lab(t, [x, Y + 2.6, 0], { size: 15 }); G.add(s); return s; });
    const rb = ribbon(G, 30, COL.act, 0.09); rb.userData.set(Array.from({ length: 30 }, (_, i) => [8.4 + i * 0.11, Y + 2.4 + 0.5 * Math.sin(i / 4), 0]));
    /* arcs as in Fig. 4 */
    const arcDef = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
    const arcs = arcDef.map(([a, b]) => { const h = 1.2 + (b - a) * 1.0; const pts = Array.from({ length: 30 }, (_, i) => { const u = i / 29; return [L.lerp(X[a], X[b], u), Y - 0.8 - h * Math.sin(Math.PI * u), 0]; }); const m = ribbon(G, 30, 0x8e9bb8, 0.07, { opacity: 0.35 }); m.userData.set(pts); return { m, pts }; });
    const PATHS = [[[0, 1], [1, 2], [2, 3]], [[0, 2], [2, 3]], [[0, 3]], []];
    const flow = stream(G, 8, COL.warn, 0.15);
    const codeA = lab('样本 A：图 + 指令 → “Predict the next action in language” → 子任务文本', [0, 8.6, 0], { size: 15, color: css(COL.fast) });
    const codeB = lab('样本 B：图 + 子任务（当作指令）+ 状态 → 32 个 <|action|>', [0, 7.6, 0], { size: 15, color: css(COL.act) });
    const noCot = lab('公开代码没有 CoT 字段', [-3.4, Y - 1.4, 0.9], { size: 15, color: '#ffb3a8' });
    G.add(codeA, codeB, noCot);
    return { ctls: [ctlRow('路径', ['全链', '跳过推理', '直接出动作', '公开代码'], () => path, k => { path = k; })], update(p) {
      const P = PATHS[path], used = new Set(P.map(e => arcDef.findIndex(d => d[0] === e[0] && d[1] === e[1])));
      arcs.forEach(({ m }, i) => { m.material.opacity = used.has(i) ? 0.95 : 0.15; m.material.color.setHex(used.has(i) ? COL.warn : 0x8e9bb8); });
      const nodes = new Set(P.flat()); if (path === 3) [0, 2, 3].forEach(n => nodes.add(n));
      bx.forEach((m, i) => { m.material.transparent = true; m.material.opacity = nodes.has(i) ? 1 : 0.25; glow(m, 0); });
      if (P.length) { const seg_ = Math.min(P.length - 1, Math.floor(p * P.length)), u = p * P.length - seg_; const e = P[seg_]; const pts = arcs[arcDef.findIndex(d => d[0] === e[0] && d[1] === e[1])].pts.map(q => [q[0], q[1], 0.6]); flow(pts, u, 1); glow(bx[e[1]], u > 0.8 ? 0.8 : 0); } else flow([[0, 0, 0], [0, 0, 0]], 0, 0);
      exL[1].visible = nodes.has(1) && path !== 3; exL[2].visible = nodes.has(2);
      codeA.visible = codeB.visible = noCot.visible = path === 3;
      cap(['全链：先写推理，再写子任务，再出动作（block-spell 的做法）', '跳过推理：直接写子任务再出动作（set-table、tidy-bedroom 的做法）', '直接出动作：指令到动作，简单任务用', '公开代码：子任务生成和出动作是<b>两种独立的训练样本</b>，按 generate_subtask_ratio（默认 0）抽'][path]);
    } };
  }

  /* ---------- scene 10: data ---------- */
  function s10(G) {
    let st = +(OPT[0] ?? 0);
    const share = [57.5, 33.1, 9.4], names = ['自采动作', '开源动作', '多模态 VQA'], cs = [COL.act, COL.warn, COL.txt];
    const bs = share.map((v, i) => { const h = v / 100 * 7; const m = block(1.6, h, 1.6, cs[i], [-12 + i * 2.9, h / 2 + 0.6, 0]); G.add(m); G.add(lab(`${v}%`, [-12 + i * 2.9, h + 1.2, 0], { size: 17, color: css(cs[i]) })); G.add(lab(names[i].replace(' ', '\n'), [-12 + i * 2.9, -0.2, 0.9], { size: 14 })); return m; });
    G.add(lab('图 5 的占比（单位没写）', [-8.6, 9.0, 0], { size: 15 }));
    const cubes = inst(CUBE, 24); G.add(cubes);
    for (let i = 0; i < 24; i++) { setI(cubes, i, [-2.6 + (i % 6) * 0.75, 2.0 + Math.floor(i / 6) * 0.75, 0], 0.55); colI(cubes, i, hex3(COL.warn)); } done(cubes);
    G.add(lab('表 1：24 个开源动作数据集\nDROID、BC-Z、Bridge、AgiBot World、RH20T…', [-0.7, 6.0, 0], { size: 14 }));
    const vq = inst(CUBE, 12); G.add(vq); for (let i = 0; i < 12; i++) { setI(vq, i, [-2.6 + (i % 6) * 0.75, -0.3 - Math.floor(i / 6) * 0.0 + (i >= 6 ? -0.75 : 0) + 0.5, 0], 0.45); colI(vq, i, hex3(COL.txt)); } done(vq);
    const stI = block(4.2, 1.4, 1.4, COL.fast, [8.6, 6.4, 0]), stG = block(4.2, 1.4, 1.4, COL.act, [8.6, 2.6, 0]); G.add(stI, stG);
    G.add(lab('Inspiration\n具身 VQA + 指令跟随 + FAST', [8.6, 8.2, 0], { size: 15 }), lab('Integration\n真实 + 开源轨迹上的流匹配', [8.6, 0.8, 0], { size: 15 }));
    const pI = [[[-12, 4.5, 0], [6.5, 6.4, 0]], [[1.2, 3.2, 0], [6.5, 6.4, 0]], [[1.2, 0.2, 0], [6.5, 6.2, 0]]];
    const pG = [[[-12, 4.0, 0], [6.5, 2.6, 0]], [[1.2, 2.6, 0], [6.5, 2.6, 0]], [[1.2, 0.0, 0], [6.5, 2.4, 0]]];
    const sI = pI.map((_, i) => stream(G, 6, cs[i], 0.12)), sG = pG.map((_, i) => stream(G, 6, cs[i], 0.12));
    G.add(lab('总量：§4 “> 1 万小时”，§4.4 “> 数万小时”', [0, -2.6, 0], { size: 15, color: '#ffd27a' })); G.add(lab('12 个开源图文集 + 具身 VQA', [-0.7, -1.4, 0], { size: 14, color: css(COL.txt) }));
    const WI = [0.6, 0.6, 1], WG = [1, 1, 0.35];
    return { ctls: [ctlRow('阶段', ['Inspiration', 'Integration'], () => st, k => { st = k; })], update(p) {
      const ph = p * 4 % 1, w = st === 0 ? WI : WG;
      sI.forEach((f, i) => f(pI[i], ph, st === 0 ? w[i] : 0)); sG.forEach((f, i) => f(pG[i], ph, st === 1 ? w[i] : 0));
      glow(stI, st === 0 ? 0.7 : 0); glow(stG, st === 1 ? 0.7 : 0); bs.forEach((m, i) => glow(m, w[i] > 0.9 ? 0.5 : 0));
      cap(st === 0 ? 'Inspiration：VQA（通用 + 具身）为主，动作数据只用来出 FAST 离散 token' : 'Integration：自采和开源轨迹上的流匹配为主，VQA 继续按配额混入，防止遗忘');
    } };
  }

  /* ---------- scene 11: results ---------- */
  function s11(G) {
    let mode = +(OPT[0] ?? 0);
    const X0 = -11.5, Y0 = 1.0, H = 7.0, W = 21.5;
    axes(G, X0, Y0, W, H, -1.0, { yt: [[0, '0'], [0.2, '20'], [0.4, '40'], [0.6, '60'], [0.8, '80'], [1, '100']] });
    const ib = bars(G, 21);
    const line80 = wire(G, [[X0, Y0 + 0.8 * H, -0.5], [X0 + W, Y0 + 0.8 * H, -0.5]], COL.bad, { dashed: true, opacity: 0.9 });
    const l80 = lab('正文\n说的 80%', [X0 + W + 1.3, Y0 + 0.8 * H, 0], { size: 14, color: '#ffb3a8' }); G.add(l80);
    let LAB = [];
    const legend = [['WALL-OSS', COL.wall], ['π0', COL.pi0], ['DP', COL.dp]];
    const legL = legend.map(([t, c], i) => { const s = lab(t, [X0 + 1.4 + i * 2.6, Y0 + H + 0.9, 0], { size: 15, color: css(c) }); G.add(s); return s; });
    const qL = lab('Qwen2.5-VL-3B', [X0 + 4.0 + 2.6, Y0 + H + 0.9, 0], { size: 15, color: css(COL.pi0) }); G.add(qL);
    let built = -1;
    function build() {
      LAB.forEach(s => { G.remove(s); L.dispose(s); LABS = LABS.filter(x => x !== s); }); LAB = [];
      const D = mode === 0 ? F7.id : mode === 1 ? F7.ood : F7.vqa, n = D.names.length, gw = W / n;
      D.names.forEach((t, g) => { const s = lab(t.replace(/-(\w+)$/, '-\n$1'), [X0 + (g + 0.5) * gw, Y0 - 0.8, 0.5], { size: 13, color: '#c9d4ea' }); G.add(s); LAB.push(s); });
      D.v.forEach((row, g) => row.forEach((v, k) => {
        if (v == null) return;
        const flag = (mode === 0 && g === 4 && k === 2) || (mode === 1 && g === 3 && k < 2);
        if (k === 0 || flag || mode === 2) { const x = X0 + (g + 0.5) * gw + (k - (row.length - 1) / 2) * 0.95; const bump = k > 0 && row[k - 1] != null && Math.abs(row[k - 1] - v) < 12 && (k === 1 ? (flag || mode === 2) : true) ? 0.95 : 0; const s = lab(fmt(v), [x, Y0 + v / 100 * H + 0.4 + bump, 0.3], { size: 13, color: flag ? '#ffb3a8' : '#e6ecf7', border: flag ? '#e05d5d' : null }); G.add(s); LAB.push(s); }
      }));
      built = mode;
    }
    return { ctls: [ctlRow('数据', ['图 7 · 分布内', '图 7 · 分布外', '表 2 · 具身 VQA'], () => mode, k => { mode = k; })], update(p) {
      if (built !== mode) build();
      const D = mode === 0 ? F7.id : mode === 1 ? F7.ood : F7.vqa, n = D.names.length, gw = W / n, g0 = seg(p, 0.05, 0.5);
      let idx = 0;
      for (let g = 0; g < 7; g++) for (let k = 0; k < 3; k++) {
        const row = D.v[g], v = row && row[k] != null ? row[k] : null;
        if (v == null) { setI(ib, idx++, [0, -50, 0], 0.001); continue; }
        const c = mode === 2 ? (k === 0 ? COL.wall : COL.pi0) : [COL.wall, COL.pi0, COL.dp][k];
        const x = X0 + (g + 0.5) * gw + (k - (row.length - 1) / 2) * 0.95;
        setBar(ib, idx++, x, Y0, v / 100 * H * g0, 0, 0.85, 0.3, hex3(c));
      }
      done(ib);
      line80.visible = l80.visible = mode < 2 && p > 0.5;
      legL[2].visible = mode < 2; legL[1].visible = mode < 2; qL.visible = mode === 2;
      LAB.forEach(s => { s.visible = p > 0.45; });
      cap(mode === 0 ? '分布内：DP 在 collect-waste 上是 <b>74.1</b>，正文写“只到 80%”。pick-place-cup 上 π0（97.5）比 WALL-OSS（93.0）高' : mode === 1 ? '分布外：collect-waste 上 WALL-OSS <b>75.0</b>、π0 <b>71.6</b>，正文写“都保持在 80% 以上”。DP 两格无柱，平均按 0 算' : '表 2（人工评测）：预训练后物体定位从 46.1 到 91.6，动作规划只多 9.2 个点');
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
  window.__wallossDebug = { PAR, F7, get cap() { return $('cap').textContent; } };
})();
