'use strict';
/* Cosmos 3 (arXiv 2606.02800) taken apart into eleven animated scenes. Dimensions come from the report, the official
   code (NVIDIA/cosmos-framework e40831f) and the Hugging Face configs / safetensors headers of Cosmos3-Edge, -Nano, -Super.
   Each scene's update(p) is a pure function of the timeline p plus the current toggles. Scenes 2, 6, 7, 9 and 10 compute
   their numbers live from the formulas; scene 9 samples a fixed-seed set. No Cosmos network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { text: 0x9d8cff, vit: 0x38d1ff, video: 0x3aa8e0, audio: 0xf2c14e, action: 0xf0963c, und: 0x7c8cff, gen: 0x4fc98a,
    noise: 0x8e9bb8, special: 0xb8c4da, bad: 0xe05d5d, gold: 0xf2c14e, frozen: 0x6b7794, attn: 0xd45fa0, ctrl: 0xc08bff, zero: 0x2b3650 };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const hexs = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const live = t => `<p class="guess"><b>现算 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const fmt = n => n.toLocaleString('en-US');
  const shiftF = (t, s) => s * t / (1 + (s - 1) * t);
  /* model geometry: table 2 + HF configs; params from safetensors headers */
  const MODELS = [
    { n: 'Edge', L: 28, d: 2048, h: 16, kv: 8, f: 9216, gated: false, vocab: 131072, tot: 3858999728, tr: 3369657024, vit: 489342704, base: '自训 Nemotron 2B（ReLU²）' },
    { n: 'Nano', L: 36, d: 4096, h: 32, kv: 8, f: 12288, gated: true, vocab: 151936, tot: 15750057456, tr: 15173669120, vit: 576388336, base: 'Qwen3-VL-8B' },
    { n: 'Super', L: 64, d: 5120, h: 64, kv: 8, f: 25600, gated: true, vocab: 151936, tot: 64615003632, tr: 64019736832, vit: 595266800, base: 'Qwen3-VL-32B' }];
  const towerLayer = m => m.d * m.h * 128 * 2 + m.d * m.kv * 128 * 2 + (m.gated ? 3 : 2) * m.d * m.f;
  const B = x => (x / 1e9).toFixed(2) + 'B';

  const SCENES = [
    { n: 1, part: '总览', title: '一个网络，两座塔，五种模态', sub: '切换尺寸；点方块跳到对应那一幕', dur: 12, cam: [0.0, 1.1, 40, [0, 3.2, 0]],
      html: dl([['理解塔（Reasoner）', '读文本 + ViT 视觉，输出文本；因果注意力'], ['生成塔（Generator）', '读文本、视觉、音频、动作，输出视觉、音频、动作；流匹配去噪'], ['共享', '每层只共享注意力运算；两塔各有 LN、QKV、FFN'], ['尺寸', 'Edge 3.86B · Nano 15.75B · Super 64.62B（两塔 + ViT）']]) +
        '<p>左边五种输入，中间两座塔，右边输出。文本走理解塔，自回归地一个一个出；图像、视频、音频、动作走生成塔，从噪声去噪。生成塔的每层注意力能看到理解塔的 K、V，反过来不行。</p>' + src('§2 · 图 1 · 图 5 · 表 2 · HF safetensors 头') },
    { n: 2, part: '§2.1 编码器', title: '五种编码器，各自多少个 token', sub: '切换分辨率；条长按 token 数（对数）画', dur: 13, cam: [0.0, 1.12, 44, [0, 4.0, 0]],
      html: dl([['文本', '分词器；Edge 词表 131,072，Nano / Super 151,936'], ['理解视觉', 'ViT，patch 16，2 × 2 合并 → 每 token 32 × 32 像素；和主干一起训练'], ['生成视觉', 'Wan2.2 VAE 4 × 16 × 16，48 通道，再 patch 2 × 2 → 每 token 4 帧 × 32 × 32；冻结'], ['音频', '48 kHz 立体声，hop 1920 → 每秒 25 个 token；冻结'], ['动作', '每个采样步 1 个 token；每实体域一对线性层（32 域 × 64 维）']]) +
        '<p>右边的条是 5 秒、24 FPS 的视频加同长音频和 15 Hz 动作各产生多少个生成侧 token。视频 token 远多于音频和动作，所以打包、注意力和 VAE 编码都按视频来优化。</p>' +
        live('视频 token = (1 + (帧数 − 1)/4) × ⌈H/32⌉ × W/32；音频 = 25 × 秒数；动作 = 频率 × 秒数。') + src('§2.1 · §2.4.2 · cosmos3_vfm_network.py · 配置 latent_downsample_factor=16、patch_spatial=2') },
    { n: 3, part: '§2.1.3 动作表示', title: '所有实体都写成相对位姿 + 抓取状态', sub: '切换实体，看拼出的动作向量', dur: 13, cam: [0.0, 1.1, 34, [1, 3.6, 0]],
      html: dl([['自我位姿 9D', '相邻两帧头部相机（或车）位姿的相对变换 ΔT = T⁻¹ₜ₋₁ Tₜ：3D 平移 + 6D 旋转'], ['末端位姿 9D', '手腕 / 法兰的相对变换'], ['抓取 15D / 1D', '五个指尖在手腕系下的 3D 位置；或夹爪开合；不取差值'], ['投影', 'z = W⁽ᵏ⁾x + b⁽ᵏ⁾，每域一对，主干共享；6D 旋转输出后用 SVD 投回 SO(3)']]) +
        '<p>左边一个坐标系沿路径走，橙色箭头是相邻两帧之间的相对变换 ΔT，这就是“伪动作”：只看状态差，不管控制器。右边按选中的实体把各段拼成一个向量，下面是代码里的域编号和原生维度。</p>' +
        guess('左边路径是手画的。') + src('§2.1.3 · 图 3 · 式 (1)(2) · domain_utils.py') },
    { n: 4, part: '§2.2 token 排列', title: '自回归段在前，扩散段在后', sub: '切换生成模式；虚框是带噪 token，逐步变干净', dur: 13, cam: [0.0, 1.05, 30, [-1, 1.6, 0]],
      html: dl([['规则 1', 'AR（文本、ViT 视觉、EOS、BOG）在 DM 前'], ['规则 2', 'DM 里每种模态：干净条件在前，带噪目标在后'], ['规则 3', '条件段和目标段内都按视觉、音频、动作排'], ['式 (3)–(6)', 'T2I [S_AR, ṽ₁]；T2V+A [S_AR, ṽ₁:N, s̃]；I2V/V2V [S_AR, v₁:P, ṽP+1:N]；迁移 [S_AR, vᶜᵗʳˡ₁:N, ṽ₁:N]']]) +
        '<p>同一套参数，模式只由“序列里放什么、哪些加噪”决定。语言模式下 DM 段为空，生成塔不启用，就是一个 VLM。</p>' + guess('每段 token 个数是示意。') + src('§2.2 · 式 (3)–(6) · 图 5') },
    { n: 5, part: '§2.2.2 动作模式', title: '正向动力学、逆向动力学、策略', sub: '切换模式；aₜ 连接 vₜ₋₁ 和 vₜ', dur: 13, cam: [0.0, 1.12, 32, [0, 1.6, 0]],
      html: dl([['正向动力学 FD', '给干净动作，去噪视频：动作条件的世界模型'], ['逆向动力学 ID', '给干净视频，去噪动作：从视频反推动作'], ['策略', '视频和动作一起去噪：同时生成干预和它的视觉后果'], ['中训练', '三种模式都在动作数据流（占 25%）里训；附录 E.4 在 PushT 上联合训练对 ID 和策略更好']]) +
        '<p>上排是视频隐帧，下排是动作 token。第一帧总是干净的观测。切换模式时只改哪些 token 加噪，网络和数据都不变。</p>' + src('§2.2.2 · 图 4 · 表 31') },
    { n: 6, part: '§2.3 双塔 MoT', title: '各有各的参数，只在注意力里相遇', sub: '切换尺寸，当场算每座塔的参数；右边是注意力掩码', dur: 14, cam: [0.15, 1.15, 40, [2.0, 4.6, 0]], camE: [0.12, 1.12, 52, [1.5, 4.4, 0]],
      html: dl([['式 (7)', 'O_AR = Attn_causal(Q_AR, K_AR, V_AR)'], ['式 (8)', 'O_DM = Attn_full(Q_DM, [K_AR; K_DM], [V_AR; V_DM])'], ['初始化', '两塔都从同一个 VLM 初始化；生成塔训练时理解塔冻结'], ['实现', '两路扁平变长 SDPA，每层两次核调用（比 FlexAttention 快 22%）']]) +
        '<p>左右两列是两座塔（画成 8 层），每层自己的 LayerNorm 和 FFN，中间那条是共享的注意力运算。右边掩码：AR 行是下三角，AR 行对 DM 列全为 0；DM 行对所有列可见。亮条是当前在算的那一行查询。因为 AR 永远不看 DM，扩散采样时理解塔只需算一次（理解塔缓存）。</p>' +
        live('每塔层参数 = L × [d·128·(2h + 2kv) + (3 或 2)·d·f]，FFN 门控（SwiGLU）时是 3 个矩阵，Edge 的 ReLU² 是 2 个；和 HF 文件头逐项一致。') + guess('掩码画成 AR 6 个、DM 8 个 token。') + src('§2.3 · 式 (7)(8) · 图 5 · 表 2 · §5.2.2') },
    { n: 7, part: '§2.4 位置编码', title: '3D MRoPE：时间轴按真实秒数走', sub: '切换视频帧率；看 t 坐标', dur: 13, cam: [0.0, 1.15, 38, [1.0, 2.6, 0]],
      html: dl([['文本', 't = h = w，退化为一维 RoPE'], ['间隔', 'AR 最后一个 token 和 DM 第一个之间留 15,000，防止首帧过饱和、棋盘格'], ['视觉', 't 按隐帧走，h、w 每帧从 0 平铺；每个视觉片段从 0 重新开始'], ['式 (9)', 'δt = TPS_base / TPS，TPS_base = 24 / 4 = 6'], ['音频 / 动作', '只有时间坐标；音频 TPS 25（δt 0.24），15 Hz 动作 δt 0.4']]) +
        '<p>三行分别是视频、音频、动作 token 在时间轴上的位置，同一秒对齐到同一位置区间。左边折断的轴表示 15,000 的间隔。</p>' +
        live('视频 δt = 6 / (FPS / 4)；音频 6 / 25；动作 6 / 频率。') + src('§2.4 · 图 6 · 式 (9) · 配置 unified_3d_mrope_temporal_modality_margin=15000') },
    { n: 8, part: '§4 训练阶段', title: '先训理解塔，再冻结它训生成塔', sub: '指针沿时间线走；下方是当前阶段的数据配比', dur: 15, cam: [0.0, 1.1, 50, [0, 4.0, 0]],
      html: dl([['理解塔预训练', '2,200 万样本，2 轮，≤ 16k token，lr 5e-5（ViT 5e-6）'], ['理解塔 SFT', '220 万，8,200 步，batch 512，预训练数据 1 : 4 混入'], ['生成塔预训练', '图像、视频、音频；256/480/720p；shift 1/3/5；Nano 31.05T token'], ['中训练', '+ 动作 25%、迁移 25%、合成数据；shift 3/5/10；动作损失 × 10'], ['后训练', '文生图 2 万 + 2 千步；图生视频 1 万步；DROID 策略']]) +
        '<p>理解塔训完后复制给生成塔当初始化，此后理解塔一直冻结（灰色）。下方柱子是当前阶段的数据配比：预训练按图 10，中训练按表 6。</p>' + src('§4 · 表 6 · 图 8 · 图 10') },
    { n: 9, part: '§4.2 流匹配', title: '直线插值，预测速度；shift 偏向高噪声', sub: '切换 shift；上面是训练 σ 分布，下面是 50 步推理网格', dur: 14, cam: [0.0, 1.18, 42, [1.5, 3.4, 0]],
      html: dl([['插值', 'x_σ = σε + (1 − σ)x₀，目标速度 v* = ε − x₀'], ['训练 σ', '视频 Waver 众数采样，图像 / 音频 / 动作 logit-normal；再 σ = s·t/(1 + (s − 1)t)'], ['shift', '预训练 1/3/5，中训练 3/5/10（256/480/720p）'], ['推理', '音视频 50 步 shift 10；动力学 50 步 shift 5；策略 4 步 shift 5']]) +
        '<p>上排两个直方图是训练时抽到的 σ：左边视频（Waver，s = 1.29 的众数采样），右边动作（logit-normal）；切 shift 时一起往高噪声推。下排是推理 50 步的 σ 网格。中间的点沿直线从数据走向噪声，箭头是速度 ε − x₀，处处相同。</p>' +
        live('4,000 个样本用固定种子现抽；Waver 公式 t = 1 − u − 1.29·(cos²(πu/2) − 1 + u) 取自 rectified_flow.py。') + guess('中间的二维点是玩具。') + src('§4.2 · rectified_flow.py · 表 21') },
    { n: 10, part: '§4.2.5 策略部署', title: 'DROID：三视角画布进，32 步关节动作出', sub: '切换 DROID / LIBERO-10；机械臂按 chunk 执行', dur: 15, cam: [0.0, 1.12, 40, [0, 3.4, 0]],
      html: dl([['DROID 输入', '腕部 360 × 640 在上，两个外部 180 × 320 并排在下 → 540 × 640；本体状态'], ['DROID 输出', '32 步绝对关节位置（8 维含夹爪），15 Hz；同时出辅助视频'], ['DROID 推理', '4 步，shift 5，CFG 3，两张 RTX Pro 6000 各算一路；不解码视频'], ['LIBERO-10 配方', '两视角各 256 → 拼 256 × 512 → 192 × 320；10 维相对 rot6d；chunk 16 @ 20 Hz；30 步，guidance 1']]) +
        '<p>左边是输入画布的布局，中间是模型和两路 CFG，右边机械臂按时间轴执行这一块动作，执行完再请求下一块。</p>' +
        live('一块动作的时长 = 步数 / 频率：DROID 32 / 15 = 2.13 秒，LIBERO 16 / 20 = 0.8 秒。') + guess('机械臂轨迹是手画的。') + src('§4.2.5 · docs/action_policy_droid_posttrain.md · action_policy_libero_nano.py · closed_loop_eval.py') },
    { n: 11, part: '结果', title: '动作结果，和 OpenWAM 的接口', sub: '切换图表；每根柱子是原文或代码里的数', dur: 12, cam: [0.0, 1.08, 36, [0, 3.8, 0]],
      html: dl([['表 20', 'LIBERO-10：MT-init 500 步 24.6%，PT-init 0%；2000 步 97.4% 对 95.2%'], ['表 19', 'RoboLab 具体指令总分 39.7，π0.5 28.1，DreamZero 23.9'], ['表 18', 'DROID 正向动力学 PSNR：Super MT 26.04，Ctrl-World 22.99'], ['OpenWAM', '只接了 Cosmos3-Edge；论文图 6 的四个骨干里没有它']]) + src('表 18 · 表 19 · 表 20 · OpenWAM 图 6 和 cosmos3_edge.yaml') }
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
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; for (let i = 0; i < n; i++) im.setColorAt(i, _C.setRGB(1, 1, 1)); return im; }
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
  function clearSub(sub) { LABS = LABS.filter(s => { let o = s; while (o) { if (o === sub) return false; o = o.parent; } return true; }); L.clear(sub); }
  /* a token cube: clean = solid, noisy = translucent and jittering; k in [0,1] = how clean */
  function token(color, pos, sz = 0.9) { const m = block(sz, sz, sz, color, pos, { opacity: 0.95 }); m.userData.p0 = pos.slice(); return m; }
  function setNoisy(m, k, ph) { const r = (1 - k) * 0.22, p = m.userData.p0; m.position.set(p[0] + r * Math.sin(ph * 7.1 + p[0] * 3), p[1] + r * Math.cos(ph * 5.3 + p[0] * 2), p[2]); m.material.opacity = 0.35 + 0.6 * k; m.material.transparent = true; const c = m.userData.c, g = 0.55; m.material.color.setRGB(L.lerp(g, c[0], k), L.lerp(g, c[1], k), L.lerp(g, c[2], k)); }

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
    let v = clamp(+(OPT[0] ?? 1), 0, 2); G.add(L.grid(48, 24));
    const sub = new THREE.Group(); G.add(sub); let last = -1, TW = [];
    const fT = stream(G, 6, COL.text, 0.13), fV = stream(G, 10, COL.video, 0.13), fA = stream(G, 6, COL.audio, 0.12), fC = stream(G, 6, COL.action, 0.12), fO = stream(G, 8, COL.gen, 0.13);
    const INS = [['语言', COL.text, 0], ['图像 / 视频', COL.video, 1], ['音频', COL.audio, 1], ['动作', COL.action, 2]];
    function rebuild() {
      clearSub(sub); PICKS = []; TW = []; last = v; const m = MODELS[v];
      INS.forEach(([t, c, go], i) => { const b = block(2.6, 1.3, 1.6, c, [-15, 8 - i * 2.4, 0], { opacity: 0.92 }); b.userData.go = go; sub.add(b); PICKS.push(b); sub.add(lab(t, [-15, 8 - i * 2.4, 1.3], { size: 18 })); });
      const und = block(4.2, 9.5, 3, COL.und, [-4.2, 4.75, 0], { opacity: 0.85 }); und.userData.go = 5; sub.add(und); PICKS.push(und); TW.push(und);
      const gen = block(4.2, 9.5, 3, COL.gen, [4.2, 4.75, 0], { opacity: 0.85 }); gen.userData.go = 5; sub.add(gen); PICKS.push(gen); TW.push(gen);
      const at = block(12.8, 0.7, 3.4, COL.attn, [0, 5.2, 0], { opacity: 0.55 }); at.userData.go = 5; sub.add(at); PICKS.push(at); TW.push(at);
      sub.add(lab(`理解塔 × ${m.L} 层`, [-4.2, 11.2, 0], { size: 20 })); sub.add(lab(`生成塔 × ${m.L} 层`, [4.2, 11.2, 0], { size: 20 }));
      sub.add(lab('共享注意力', [0, 6.3, 2.2], { size: 16, color: '#f3b4d6' }));
      sub.add(lab(`Cosmos3-${m.n}：${B(m.tot)}（两塔 ${B(m.tr)} + ViT ${B(m.vit)}）`, [0, -1.4, 2], { size: 18, border: 'rgba(56,209,255,.7)' }));
      sub.add(lab(`初始化：${m.base}`, [0, -2.8, 2], { size: 16, color: '#b8c4da' }));
      [['文本（逐 token）', COL.text, 8, 3], ['图像 / 视频', COL.video, 5.6, 1], ['音频', COL.audio, 3.2, 3], ['动作', COL.action, 0.8, 4]].forEach(([t, c, y, go]) => { const b = block(2.6, 1.3, 1.6, c, [15, y, 0], { opacity: 0.92 }); b.userData.go = go; sub.add(b); PICKS.push(b); sub.add(lab(t, [15, y, 1.3], { size: 18 })); });
      if (v === 0) sub.add(lab('Edge 无音频输出头', [15, 2.0, 2.2], { size: 14, color: '#ff9b84' }));
    }
    rebuild();
    const ctls = [{ label: '尺寸', items: ['Edge', 'Nano', 'Super'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      if (last !== v) rebuild();
      const q = (p * 2) % 1;
      fT([[-15, 8, 0.9], [-4.2, 8, 1.6], [15, 8, 0.9]], q, 1);
      fV([[-15, 5.6, 0.9], [-4.2, 6, 1.6], [4.2, 6, 1.6], [15, 5.6, 0.9]], q, 1);
      fA([[-15, 3.2, 0.9], [4.2, 3.6, 1.6], [15, 3.2, 0.9]], q, v > 0 ? 1 : 0.6);
      fC([[-15, 0.8, 0.9], [4.2, 1.2, 1.6], [15, 0.8, 0.9]], q, 1);
      fO([[-4.2, 5.2, 1.8], [4.2, 5.2, 1.8]], (p * 3) % 1, 1);
      TW.forEach((b, i) => glow(b, 0.25 + 0.25 * Math.sin(p * 6.28 * 2 + i)));
      cap(`Cosmos3-${MODELS[v].n}：每层两套参数，图像、视频、音频、动作的生成 token 通过共享注意力读取理解塔的文本表示`);
    } };
  }

  /* ---------- scene 2: encoders ---------- */
  function s2(G) {
    let r = clamp(+(OPT[0] ?? 1), 0, 2); G.add(L.grid(46, 24));
    const sub = new THREE.Group(); G.add(sub); let last = -1, bars = [];
    const RES = [[320, 192, '256p'], [832, 480, '480p'], [1280, 720, '720p']];
    const flows = [COL.text, COL.vit, COL.video, COL.audio, COL.action].map(c => stream(G, 5, c, 0.11));
    function rebuild() {
      clearSub(sub); bars = []; last = r; const [W, H, nm] = RES[r];
      const sec = 5, frames = 24 * sec + 1, lat = 1 + (frames - 1) / 4, tpf = (W / 32) * Math.ceil(H / 32);
      const vitTok = Math.round((W / 32) * Math.ceil(H / 32) * 8); // 8 sampled frames for understanding (示意)
      const rows = [
        ['文本', '分词器', '≈ 200（示意）', COL.text, 200, false],
        ['图像 / 视频（理解）', 'ViT 16 + 2×2 合并', `每帧 ${tpf}`, COL.vit, tpf, false],
        ['视频（生成）', 'Wan2.2 VAE + patch 2', `${lat} 隐帧 × ${tpf} = ${fmt(lat * tpf)}`, COL.video, lat * tpf, true],
        ['音频', '音频 VAE，hop 1920', `25 × ${sec} = ${25 * sec}`, COL.audio, 25 * sec, true],
        ['动作（15 Hz）', '每域线性层', `15 × ${sec} = ${15 * sec}`, COL.action, 15 * sec, false]];
      rows.forEach(([t, e, n, c, val, fr], i) => {
        const y = 9.6 - i * 2.8;
        sub.add(block(2.2, 1.2, 1.4, c, [-17, y, 0], { opacity: 0.9 })); sub.add(lab(t, [-17, y + 1.2, 1.2], { size: 15 }));
        const enc = block(3.6, 1.4, 1.6, fr ? COL.frozen : c, [-9.5, y, 0], { opacity: 0.85 }); sub.add(enc); sub.add(lab(e + (fr ? '（冻结）' : ''), [-9.5, y - 1.2, 1.3], { size: 14 }));
        const len = Math.log10(val + 1) * 4.2, b = block(1, 1.0, 1.0, c, [-4.2, y, 0], { edges: false }); sub.add(b);
        const lb = lab(n, [0, y + 0.95, 0.8], { size: 15, color: '#e6ecf7' }); sub.add(lb); bars.push({ b, len, lb });
      });
      sub.add(lab(`${nm}（${W} × ${H}），5 秒 24 FPS 视频 + 同长音频 + 15 Hz 动作`, [1, 12.6, 0], { size: 18, border: 'rgba(56,209,255,.7)' }));
      sub.add(lab('条长 ∝ log₁₀(token 数)', [6, -3.4, 0], { size: 14, color: '#b8c4da' }));
      void vitTok;
    }
    rebuild();
    const ctls = [{ label: '分辨率', items: ['256p', '480p', '720p'], get: () => r, set: k => { r = k; } }];
    return { ctls, update(p) {
      if (last !== r) rebuild();
      const g = seg(p, 0.1, 0.55);
      bars.forEach(({ b, len }) => { const w = Math.max(0.05, len * g); b.scale.x = w; b.position.x = -2.4 + w / 2; });
      flows.forEach((f, i) => { const y = 9.6 - i * 2.8; f([[-17, y, 0.8], [-9.5, y, 0.9], [-2.4, y, 0.6]], (p * 2) % 1, 1); });
      const [W, H] = RES[r], lat = 31, tpf = (W / 32) * Math.ceil(H / 32);
      cap(`生成侧一段 5 秒视频是 ${fmt(lat * tpf)} 个 token，音频 125 个，15 Hz 动作 75 个；74,000 的打包预算里视频占绝大多数`);
    } };
  }

  /* ---------- scene 3: unified action representation ---------- */
  function s3(G) {
    let e = clamp(+(OPT[0] ?? 3), 0, 5); G.add(L.grid(44, 24));
    const E = [
      { n: '自动驾驶', parts: [['自我位姿', 9, COL.video]], dom: 'av → 1', raw: 9 },
      { n: '相机运动', parts: [['自我位姿', 9, COL.video]], dom: 'camera_pose → 2', raw: 9 },
      { n: '第一人称', parts: [['头部位姿', 9, COL.video], ['右手腕', 9, COL.action], ['右指尖 5×3', 15, COL.gold], ['左手腕', 9, COL.action], ['左指尖 5×3', 15, COL.gold]], dom: 'webhumanaction_body → 24', raw: 57 },
      { n: '单臂', parts: [['末端位姿', 9, COL.action], ['夹爪', 1, COL.gold]], dom: 'droid_lerobot → 8 · libero → 5', raw: 10 },
      { n: '双臂', parts: [['左末端', 9, COL.action], ['左夹爪', 1, COL.gold], ['右末端', 9, COL.action], ['右夹爪', 1, COL.gold]], dom: 'robomind-franka-dual → 12', raw: 20 },
      { n: '人形', parts: [['头部位姿', 9, COL.video], ['右末端', 9, COL.action], ['右夹爪', 1, COL.gold], ['左末端', 9, COL.action], ['左夹爪', 1, COL.gold]], dom: 'agibotworld → 15', raw: 29 }];
    const sub = new THREE.Group(); G.add(sub); let last = -1, segs = [];
    /* moving frame on the left */
    const fr = new THREE.Group(); G.add(fr);
    const ax = [[0xe05d5d, [1, 0, 0]], [0x4fc98a, [0, 1, 0]], [0x3aa8e0, [0, 0, 1]]].map(([c, d]) => { const a = L.arrow([0, 0, 0], d.map(x => x * 2.4), c); fr.add(a); return a; });
    void ax;
    const ghost = new THREE.Group(); G.add(ghost);
    [[0xe05d5d, [1, 0, 0]], [0x4fc98a, [0, 1, 0]], [0x3aa8e0, [0, 0, 1]]].forEach(([c, d]) => ghost.add(L.arrow([0, 0, 0], d.map(x => x * 1.2), c)));
    const path = t => [-9 + 3.2 * Math.sin(t * 2.4), 3.5 + 2.2 * Math.sin(t * 3.1 + 1), 1.5 * Math.cos(t * 2)];
    const pts = []; for (let i = 0; i <= 60; i++) pts.push(path(i / 60 * 2.5)); wire(G, pts, COL.noise, { opacity: 0.4 });
    const dA = L.arrow([0, 0, 0], [1, 0, 0], COL.action, { head: 0.35, headW: 0.25 }); G.add(dA);
    G.add(lab('前一帧（小）→ 当前帧：ΔT = T⁻¹ₜ₋₁ Tₜ', [-8, 8.6, 0], { size: 15 }));
    function rebuild() {
      clearSub(sub); segs = []; last = e; const q = E[e]; const tot = q.parts.reduce((a, b) => a + b[1], 0);
      const sc = 13 / Math.max(tot, 20); let x = 0;
      q.parts.forEach(([t, n, c], i) => { const w = n * sc; const b = block(w, 1.6, 1.6, c, [x + w / 2, 4, 0], { opacity: 0.92 }); sub.add(b); segs.push(b);
        sub.add(lab(`${t}\n${n}D`, [x + w / 2, i % 2 ? 6.4 : 1.6, 1.0], { size: 15 })); x += w + 0.08; });
      sub.add(lab(`${q.n}：共 ${tot} 维`, [5.5, 9.0, 0], { size: 21, border: 'rgba(240,150,60,.8)' }));
      sub.add(lab(`代码域编号 ${q.dom}；原生维度 ${q.raw}；补零到 64 维进 DomainAwareLinear`, [5.5, -0.8, 0], { size: 14, color: '#b8c4da' }));
    }
    rebuild();
    const ctls = [{ label: '实体', items: E.map(q => q.n), get: () => e, set: k => { e = k; } }];
    return { ctls, update(p) {
      if (last !== e) rebuild();
      const t = p * 2.5, t0 = Math.max(0, t - 0.25), a = path(t), b = path(t0);
      fr.position.set(...a); fr.rotation.set(0.6 * Math.sin(t * 2), t * 1.3, 0.3 * Math.cos(t * 1.7));
      ghost.position.set(...b); ghost.rotation.set(0.6 * Math.sin(t0 * 2), t0 * 1.3, 0.3 * Math.cos(t0 * 1.7));
      { const d = new THREE.Vector3(a[0] - b[0], a[1] - b[1], a[2] - b[2]); const len = Math.max(0.05, d.length()); dA.position.set(...b); dA.setDirection(d.normalize()); dA.setLength(len, Math.min(0.35, len * 0.4), Math.min(0.25, len * 0.3)); }
      segs.forEach((s, i) => glow(s, 0.2 + 0.5 * seg(p, i * 0.12, i * 0.12 + 0.2) * (1 - seg(p, 0.85, 1))));
      cap(`${E[e].n}：位姿用相邻两帧的相对变换（3D 平移 + 6D 旋转），抓取状态直接给当前值；预测出的 6D 旋转用 SVD 投回旋转矩阵`);
    } };
  }

  /* ---------- scene 4: token arrangement ---------- */
  function s4(G) {
    let m = clamp(+(OPT[0] ?? 3), 0, 5); G.add(L.grid(48, 20));
    const MODES = [
      { n: 'VLM', ar: ['v', 'v', 'v', 'l', 'l', 'l', 'l', 'E'], dm: [] , f: '只有 AR 段：图像经 ViT 进 AR，生成塔不启用' },
      { n: '文生图', ar: ['l', 'l', 'l', 'l', 'E', 'B'], dm: [['V', 1]], f: '式 (3)：[S_AR, ṽ₁]' },
      { n: '文生视频+音频', ar: ['l', 'l', 'l', 'l', 'E', 'B'], dm: [['V', 1], ['V', 1], ['V', 1], ['V', 1], ['S', 1], ['S', 1]], f: '式 (4)：[S_AR, ṽ₁:N, s̃]' },
      { n: '图生视频', ar: ['l', 'l', 'l', 'l', 'E', 'B'], dm: [['V', 0], ['V', 1], ['V', 1], ['V', 1]], f: '式 (5)，P = 1：[S_AR, v₁, ṽ₂:N]' },
      { n: '视频续写', ar: ['l', 'l', 'l', 'l', 'E', 'B'], dm: [['V', 0], ['V', 0], ['V', 1], ['V', 1]], f: '式 (5)，P = 2（前 5 帧像素）' },
      { n: '视频迁移', ar: ['l', 'l', 'l', 'l', 'E', 'B'], dm: [['C', 0], ['C', 0], ['C', 0], ['V', 1], ['V', 1], ['V', 1]], f: '式 (6)：[S_AR, vᶜᵗʳˡ₁:N, ṽ₁:N]，控制视频也用 VAE 编码' }];
    const CC = { v: COL.vit, l: COL.text, E: COL.special, B: COL.special, V: COL.video, S: COL.audio, C: COL.ctrl };
    const sub = new THREE.Group(); G.add(sub); let last = -1, noisy = [];
    function rebuild() {
      clearSub(sub); noisy = []; last = m; const q = MODES[m]; let x = -15;
      q.ar.forEach(k => { sub.add(token(CC[k], [x, 1, 0], 1.2)); x += 1.45; });
      const arEnd = x; sub.add(lab('AR 子序列 → 理解塔', [(-15 + arEnd) / 2 - 0.6, 3.0, 0], { size: 17, color: '#c9c2ff' }));
      x += 1.2; const dm0 = x;
      q.dm.forEach(([k, nz]) => { const t = token(CC[k], [x, 1, 0], 1.2); sub.add(t); if (nz) noisy.push(t); x += 1.45; });
      if (q.dm.length) { sub.add(lab('DM 子序列 → 生成塔', [(dm0 + x) / 2 - 0.6, 3.0, 0], { size: 17, color: '#9be7bd' })); wire(sub, [[arEnd + 0.05, -0.3, 0], [arEnd + 0.05, 2.4, 0]], COL.bad, { opacity: 0.8, dashed: true }); }
      else sub.add(lab('DM 段为空', [arEnd + 3, 1, 0], { size: 16, color: '#b8c4da' }));
      sub.add(lab(`${q.n}：${q.f}`, [0, 6.2, 0], { size: 19, border: 'rgba(56,209,255,.7)' }));
      const leg = [['语言', COL.text], ['ViT 视觉', COL.vit], ['EOS / BOG', COL.special], ['VAE 视觉', COL.video], ['音频', COL.audio], ['控制视频', COL.ctrl]];
      leg.forEach(([t, c], i) => { sub.add(block(0.6, 0.6, 0.6, c, [-13 + i * 5, -2.4, 0], { opacity: 0.9 })); sub.add(lab(t, [-11.6 + i * 5, -2.4, 0.5], { size: 14 })); });
      sub.add(lab('实心 = 干净条件，半透明抖动 = 带噪目标', [0, -4.0, 0], { size: 14, color: '#b8c4da' }));
    }
    rebuild();
    const ctls = [{ label: '模式', items: MODES.map(q => q.n), get: () => m, set: k => { m = k; } }];
    return { ctls, update(p) {
      if (last !== m) rebuild();
      const k = seg(p, 0.15, 0.85);
      noisy.forEach(t => setNoisy(t, k, p * 10));
      cap(m === 0 ? '语言模式：只有自回归段，就是一个标准 VLM' : `去噪进度 ${Math.round(k * 100)}%：只有带噪的目标 token 在变，干净条件和文本保持不动`);
    } };
  }

  /* ---------- scene 5: action modes ---------- */
  function s5(G) {
    let m = clamp(+(OPT[0] ?? 2), 0, 2); G.add(L.grid(40, 20));
    const sub = new THREE.Group(); G.add(sub); let last = -1, noisy = [];
    const NAMES = ['正向动力学 FD', '逆向动力学 ID', '策略（视频 + 动作）'];
    function rebuild() {
      clearSub(sub); noisy = []; last = m;
      for (let i = 0; i < 5; i++) {
        const x = -8 + i * 4; const v = token(COL.video, [x, 3.2, 0], 1.6); sub.add(v);
        sub.add(lab(i === 0 ? 'v_{t−1}' : `v_{t+${i - 1}}`.replace('+0', ''), [x, 5.0, 0], { size: 15 }));
        if (i > 0 && (m === 0 || m === 2)) noisy.push(v);
        if (i > 0) { const a = token(COL.action, [x - 2, 0.4, 0], 1.0); sub.add(a); sub.add(lab(`a_{t+${i - 1}}`.replace('+0', ''), [x - 2, -1.0, 0], { size: 14 }));
          if (m === 1 || m === 2) noisy.push(a);
          wire(sub, [[x - 4, 2.4, 0], [x - 2, 0.9, 0], [x, 2.4, 0]], COL.action, { opacity: 0.35 }); }
      }
      sub.add(lab(NAMES[m], [0, 7.4, 0], { size: 21, border: 'rgba(240,150,60,.8)' }));
      sub.add(lab(['给动作 → 预测未来画面', '给画面 → 反推动作', '给第一帧和指令 → 同时出动作和画面'][m], [0, -2.6, 0], { size: 16, color: '#b8c4da' }));
    }
    rebuild();
    const ctls = [{ label: '模式', items: ['FD', 'ID', '策略'], get: () => m, set: k => { m = k; } }];
    return { ctls, update(p) {
      if (last !== m) rebuild();
      const k = seg(p, 0.15, 0.85); noisy.forEach(t => setNoisy(t, k, p * 10));
      cap(`${NAMES[m]}：同一段视频-动作数据，只改哪些 token 加噪。中训练里三种模式都有，DROID 策略后训练只用策略模式`);
    } };
  }

  /* ---------- scene 6: MoT + mask ---------- */
  function s6(G) {
    let v = clamp(+(OPT[0] ?? 1), 0, 2); G.add(L.grid(48, 24));
    const sub = new THREE.Group(); G.add(sub); let last = -1, layers = [], rowsHL = [];
    const NA = 6, ND = 8, N = NA + ND;
    const cells = inst(BOX, N * N, { opacity: 0.95 }); G.add(cells);
    const cell = (i, j) => { const ar = i < NA, kar = j < NA; return ar ? (kar && j <= i ? 1 : 0) : 1; };
    const hl = block(N * 0.62 + 0.2, 0.66, 0.2, COL.gold, [0, 0, 0], { opacity: 0.35, edges: false }); G.add(hl);
    function rebuild() {
      clearSub(sub); layers = []; last = v; const m = MODELS[v];
      for (let l = 0; l < 8; l++) {
        const y = 0.6 + l * 1.15;
        const a = block(2.6, 0.5, 2, COL.und, [-11, y, 0], { opacity: 0.85 }), b = block(2.6, 0.5, 2, COL.gen, [-3, y, 0], { opacity: 0.85 });
        const at = block(10.6, 0.22, 1.2, COL.attn, [-7, y + 0.42, 0], { opacity: 0.5, edges: false });
        sub.add(a, b, at); layers.push([a, b, at]);
      }
      const per = towerLayer(m), tower = per * m.L;
      sub.add(lab('理解塔\nLN + FFN', [-11.5, 10.6, 0], { size: 15, color: '#c9c2ff' })); sub.add(lab('生成塔\nLN + FFN', [-2.5, 10.6, 0], { size: 15, color: '#9be7bd' }));
      sub.add(lab('共享注意力\n（式 7、8）', [-15.6, 4.6, 0], { size: 15, color: '#f3b4d6' }));
      sub.add(lab(`${m.n}：每层 ${(per / 1e6).toFixed(1)}M × ${m.L} 层 = 每塔 ${B(tower)}`, [2, 13.4, 0], { size: 17, border: 'rgba(56,209,255,.7)' }));
      sub.add(lab(`FFN ${m.gated ? 'SwiGLU' : 'ReLU²'}；整个 transformer ${B(m.tr)}（HF 文件头）`, [-6, -2.4, 0], { size: 14, color: '#b8c4da' }));
      sub.add(lab('注意力掩码', [8.5, 11.4, 0], { size: 16 })); sub.add(lab('行 = 查询，列 = 键', [8.5, -0.8, 0], { size: 13, color: '#b8c4da' }));
      sub.add(lab('AR', [3.2, 8.2 - 1.6, 0], { size: 14, color: '#c9c2ff' })); sub.add(lab('DM', [3.2, 8.2 - 6, 0], { size: 14, color: '#9be7bd' }));
      sub.add(lab('AR 列', [5.6, 9.4, 0], { size: 13, color: '#c9c2ff' })); sub.add(lab('DM 列', [10.6, 9.4, 0], { size: 13, color: '#9be7bd' }));
    }
    rebuild();
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const on = cell(i, j); setI(cells, i * N + j, [4.2 + j * 0.62, 8.6 - i * 0.62, 0], on ? [0.56, 0.56, 0.3] : [0.56, 0.56, 0.04]); colI(cells, i * N + j, on ? hex3(i < NA ? COL.und : COL.gen) : hex3(COL.zero)); }
    done(cells);
    const ctls = [{ label: '尺寸', items: ['Edge', 'Nano', 'Super'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      if (last !== v) rebuild();
      const row = Math.min(N - 1, Math.floor(p * N));
      hl.position.set(4.2 + (N - 1) * 0.31, 8.6 - row * 0.62, 0.25);
      const lay = Math.floor((p * 8 * 2) % 8);
      layers.forEach(([a, b, at], l) => { const k = l === lay ? 1 : 0; glow(a, 0.6 * k); glow(b, 0.6 * k); glow(at, 0.8 * k); });
      cap(row < NA ? `第 ${row + 1} 个 AR 查询：只看自己和前面的 AR token（因果），看不到任何 DM token` : `第 ${row - NA + 1} 个 DM 查询：看全部 ${NA} 个 AR 和 ${ND} 个 DM token（双向）`);
    } };
  }

  /* ---------- scene 7: MRoPE ---------- */
  function s7(G) {
    let f = clamp(+(OPT[0] ?? 1), 0, 2); G.add(L.grid(48, 20));
    const FPS = [16, 24, 30];
    const sub = new THREE.Group(); G.add(sub); let last = -1, toks = [];
    const X = t => -6 + t * 1.6; /* position on screen for diffusion-relative t */
    function rebuild() {
      clearSub(sub); toks = []; last = f; const fps = FPS[f], dv = 6 / (fps / 4);
      for (let i = 0; i < 5; i++) { sub.add(token(COL.text, [-15 + i * 1.1, 6.5, 0], 0.8)); sub.add(lab(String(i), [-15 + i * 1.1, 7.6, 0], { size: 13 })); }
      sub.add(lab('文本 t = h = w = 0…n−1', [-12.8, 9.0, 0], { size: 15, color: '#c9c2ff' }));
      wire(sub, [[-9.0, 4.2, 0], [-8.4, 5.2, 0]], COL.bad, { opacity: 0.9 }); wire(sub, [[-8.6, 4.2, 0], [-8.0, 5.2, 0]], COL.bad, { opacity: 0.9 });
      sub.add(lab('+ 15,000', [-8.5, 3.0, 0], { size: 15, color: '#ff9b84' })); sub.add(lab('DM 段的 t（相对起点 = 文本长度 + 15,000）', [X(5), 10.4, 0], { size: 13, color: '#b8c4da' }));
      const T = 9; // seconds of axis shown: latent frames span
      let i = 0; for (let t = 0; t <= 10.01; t += dv) { const b = token(COL.video, [X(t), 6.0, 0], 0.8); sub.add(b); toks.push(b); sub.add(lab(t.toFixed(1).replace('.0', ''), [X(t), 7.2, 0], { size: 12 })); i++; }
      for (let t = 0; t <= 10.01; t += 0.24 * 4) { sub.add(token(COL.audio, [X(t), 3.6, 0], 0.5)); }
      for (let t = 0; t <= 10.01; t += 0.4) { sub.add(token(COL.action, [X(t), 1.4, 0], 0.4)); }
      sub.add(lab(`视频 ${fps} FPS：TPS ${fps / 4}，δt = ${dv.toFixed(2)}`, [X(5), 9.0, 0], { size: 16, border: 'rgba(58,168,224,.8)' }));
      sub.add(lab('音频 TPS 25，δt 0.24（画成每 4 个取 1 个）', [X(5), 4.7, 0], { size: 14, color: '#f2c14e' }));
      sub.add(lab('动作 15 Hz，δt 0.4', [X(5), 0.2, 0], { size: 14, color: '#f0963c' }));
      for (let s = 0; s <= 1; s++) { const x = X(s * 6); wire(sub, [[x, -0.6, 0], [x, 8.2, 0]], COL.special, { opacity: 0.35, dashed: true }); sub.add(lab(`${s} 秒`, [x, -1.4, 0], { size: 13, color: '#b8c4da' })); }
      void T;
    }
    rebuild();
    const ctls = [{ label: '视频帧率', items: ['16 FPS', '24 FPS', '30 FPS'], get: () => f, set: k => { f = k; } }];
    return { ctls, update(p) {
      if (last !== f) rebuild();
      const k = Math.floor(p * toks.length); toks.forEach((t, i) => glow(t, i === k ? 0.9 : 0));
      cap(`同一秒在 t 轴上都占 6 个单位：${FPS[f]} FPS 视频每个隐帧前进 ${(6 / (FPS[f] / 4)).toFixed(2)}，音频 0.24，15 Hz 动作 0.4（视频上方的数是相对 DM 起点的 t）`);
    } };
  }

  /* ---------- scene 8: training stages ---------- */
  function s8(G) {
    G.add(L.grid(52, 24));
    const ST = [
      { n: '理解塔预训练', x: -16, c: COL.und, d: '22.0M 样本 · 2 轮', mix: [['OCR', 42.9], ['2D 定位', 16.5], ['视觉问答', 11.3], ['其他', 29.3]] },
      { n: '理解塔 SFT', x: -8, c: COL.und, d: '2.2M · 8,200 步', mix: [['视频推理', 22.7], ['视频问答', 21.4], ['2D 定位', 16.0], ['其他', 39.9]] },
      { n: '生成塔预训练', x: 0, c: COL.gen, d: 'Nano 31.05T token', mix: [['图像', 20], ['视频 256p', 20], ['视频 480p', 40], ['视频 720p', 20]] },
      { n: '中训练', x: 8, c: COL.gen, d: 'Nano 2.4T token', mix: [['图像', 10], ['视频', 32], ['视频+音频', 8], ['动作', 25], ['迁移', 25]] },
      { n: '后训练', x: 16, c: COL.action, d: 'T2I · I2V · DROID', mix: [['T2I 2.2 万步', 1], ['I2V 1 万步', 1], ['策略', 1]] }];
    const blocks = ST.map(s => { const b = block(6.4, 1.8, 2, s.c, [s.x, 8, 0], { opacity: 0.9 }); G.add(b); G.add(lab(s.n, [s.x, 9.6, 0], { size: 17 })); G.add(lab(s.d, [s.x, 6.4, 0.9], { size: 14, color: '#b8c4da' })); return b; });
    for (let i = 0; i < 4; i++) G.add(L.arrow([ST[i].x + 3.3, 8, 0], [ST[i + 1].x - 3.3, 8, 0], 0xb8c4da));
    G.add(lab('复制权重初始化生成塔', [-4, 11.4, 0], { size: 14, color: '#9be7bd' }));
    const fz = block(22, 0.4, 0.6, COL.frozen, [8, 4.9, 0], { opacity: 0.8, edges: false }); G.add(fz); const fzl = lab('理解塔冻结', [21.5, 4.9, 0.8], { size: 14, color: '#b8c4da' }); G.add(fzl);
    const ptr = block(0.4, 3.0, 0.4, COL.gold, [0, 8, 1.4], { edges: false }); G.add(ptr);
    const sub = new THREE.Group(); G.add(sub); let cur = -1, bars = [];
    function showMix(i) {
      clearSub(sub); bars = []; cur = i; const mx = ST[i].mix, tot = mx.reduce((a, b) => a + b[1], 0);
      mx.forEach(([t, v], j) => { const x = -10 + j * 5.2, b = block(2.4, 1, 2, ST[i].c, [x, 0.5, 0], { edges: false, opacity: 0.85 }); sub.add(b); bars.push({ b, h: v / tot * 9 });
        sub.add(lab(`${t}${i === 4 ? '' : ' ' + v + '%'}`, [x, -1.2, 1], { size: 14 })); });
      sub.add(lab(`${ST[i].n} 的数据配比${i === 4 ? '（各自独立后训练，非配比）' : ''}`, [0, 3.4, 0], { size: 16, border: 'rgba(56,209,255,.7)' }));
    }
    return { update(p) {
      const i = Math.min(4, Math.floor(p * 5)); if (i !== cur) showMix(i);
      const x = L.lerp(ST[0].x - 3, ST[4].x + 3, p); ptr.position.x = x;
      blocks.forEach((b, j) => glow(b, j === i ? 0.7 : 0));
      fz.visible = i >= 2; fzl.visible = i >= 2;
      const g = seg((p * 5) % 1, 0, 0.5); bars.forEach(({ b, h }) => { const hh = Math.max(0.05, h * g); b.scale.y = hh; b.position.y = hh / 2; });
      cap(['理解塔预训练：从 VLM（Edge 用自训 LLM）开始全部一起训，不做单独的对齐阶段', '理解塔 SFT：转向物理 AI，视频文本占一半，AI 评审阈值 5', '生成塔预训练：理解塔冻结，图像、视频、音频联合；shift 1 / 3 / 5', '中训练：加入动作（FD / ID / 策略）和可控迁移，shift 提到 3 / 5 / 10，动作损失 × 10', '后训练：各任务分开，结构不变'][i]);
    } };
  }

  /* ---------- scene 9: flow matching + shift ---------- */
  function s9(G) {
    let si = clamp(+(OPT[0] ?? 2), 0, 3); G.add(L.grid(48, 24));
    const SH = [1, 3, 5, 10];
    const r = L.rng(7), NS = 4000, U = [], Z = [];
    for (let i = 0; i < NS; i++) { U.push(r()); Z.push(L.gauss(r)); }
    const NB = 20, hv = inst(BOX, NB), ha = inst(BOX, NB), steps = inst(BOX, 50); G.add(hv, ha, steps);
    for (let i = 0; i < NB; i++) { colI(hv, i, hex3(COL.video)); colI(ha, i, hex3(COL.action)); }
    for (let i = 0; i < 50; i++) colI(steps, i, hex3(COL.gen));
    G.add(lab('训练 σ：视频（Waver 众数采样）', [-9, 4.3, 0], { size: 15, color: '#9fd3f3' })); G.add(lab('训练 σ：动作（logit-normal）', [9, 4.3, 0], { size: 15, color: '#f7c08c' }));
    G.add(lab('σ = 0', [-15, 5.4, 0], { size: 12 })); G.add(lab('1', [-3, 5.4, 0], { size: 12 })); G.add(lab('σ = 0', [3, 5.4, 0], { size: 12 })); G.add(lab('1', [15, 5.4, 0], { size: 12 }));
    G.add(lab('推理 50 步的 σ 网格（左高噪声 → 右干净）', [0, -3.6, 0], { size: 15 }));
    const pt = block(0.5, 0.5, 0.5, COL.gold, [0, 0, 0], { edges: false }); G.add(pt);
    const x0 = [-2.4, 9.6, 2], eps = [2.4, 12.4, 2]; wire(G, [x0, eps], COL.noise, { opacity: 0.6, dashed: true });
    G.add(lab('x₀（数据）', [x0[0], x0[1] - 0.9, 2], { size: 13 })); G.add(lab('ε（噪声）', [eps[0], eps[1] + 0.9, 2], { size: 13 }));
    G.add(L.arrow([0.6, 9.4, 2], [0.6 + (eps[0] - x0[0]) * 0.35, 9.4 + (eps[1] - x0[1]) * 0.35, 2], COL.gold));
    G.add(lab('v* = ε − x₀', [3.4, 9.6, 2], { size: 13, color: '#f2c14e' }));
    let last = -1, lbl = null;
    function rebuild() {
      last = si; const s = SH[si];
      const cv = new Array(NB).fill(0), ca = new Array(NB).fill(0);
      for (let i = 0; i < NS; i++) {
        const u = U[i]; const tw = 1 - u - 1.29 * (Math.cos(Math.PI / 2 * u) ** 2 - 1 + u); const sv = shiftF(clamp(tw, 0, 1), s);
        const ta = 1 / (1 + Math.exp(-Z[i])); const sa = shiftF(ta, s);
        cv[Math.min(NB - 1, Math.floor(sv * NB))]++; ca[Math.min(NB - 1, Math.floor(sa * NB))]++;
      }
      const mx = Math.max(...cv, ...ca);
      rebuild.hv = cv.map(c => c / mx * 5.5); rebuild.ha = ca.map(c => c / mx * 5.5);
      rebuild.st = []; for (let i = 0; i < 50; i++) rebuild.st.push(shiftF(1 - i / 50, s));
      if (lbl) { G.remove(lbl); LABS = LABS.filter(x => x !== lbl); }
      const mid = rebuild.st.filter(x => x > 0.5).length;
      lbl = lab(`shift ${s}：50 步里有 ${mid} 步停在 σ > 0.5`, [0, -5.0, 0], { size: 15, border: 'rgba(79,201,138,.8)' }); G.add(lbl);
    }
    rebuild();
    const ctls = [{ label: 'shift', items: SH.map(String), get: () => si, set: k => { si = k; } }];
    return { ctls, update(p) {
      if (last !== si) rebuild();
      const g = seg(p, 0, 0.4);
      for (let i = 0; i < NB; i++) { const w = 12 / NB; const h1 = Math.max(0.02, rebuild.hv[i] * g), h2 = Math.max(0.02, rebuild.ha[i] * g);
        setI(hv, i, [-15 + (i + 0.5) * w, 6 + h1 / 2, 0], [w * 0.9, h1, 0.8]); setI(ha, i, [3 + (i + 0.5) * w, 6 + h2 / 2, 0], [w * 0.9, h2, 0.8]); }
      done(hv); done(ha);
      const k = Math.floor(seg(p, 0.35, 0.95) * 50);
      for (let i = 0; i < 50; i++) { const h = Math.max(0.03, rebuild.st[i] * 3.2) * (i <= k ? 1 : 0.15); setI(steps, i, [-14.7 + i * 0.6, -2.6 + h / 2, 0], [0.45, h, 0.45]); }
      done(steps);
      const sg = rebuild.st[Math.min(49, k)]; pt.position.set(L.lerp(x0[0], eps[0], sg), L.lerp(x0[1], eps[1], sg), 2);
      cap(`第 ${Math.min(50, k + 1)} 步 σ = ${sg.toFixed(3)}：x_σ = σε + (1 − σ)x₀；shift 越大，越多的步留在高噪声段`);
    } };
  }

  /* ---------- scene 10: policy deployment ---------- */
  function s10(G) {
    let v = clamp(+(OPT[0] ?? 0), 0, 1); G.add(L.grid(52, 24));
    const sub = new THREE.Group(); G.add(sub); let last = -1, gpus = [];
    const arm = L.arm(0xb8c4da); arm.position.set(12, 0, 0); arm.scale.set(1, 1, 1); G.add(arm);
    const cube = block(0.8, 0.8, 0.8, COL.bad, [14, 0.4, 2], { edges: false }); G.add(cube);
    const ticks = inst(BOX, 32); G.add(ticks); for (let i = 0; i < 32; i++) colI(ticks, i, hex3(COL.action));
    function rebuild() {
      clearSub(sub); gpus = []; last = v;
      if (v === 0) {
        sub.add(block(6.4, 3.6, 0.3, COL.video, [-14, 7.6, 0], { opacity: 0.85 })); sub.add(lab('腕部 360 × 640', [-14, 7.6, 0.6], { size: 15 }));
        sub.add(block(3.15, 1.8, 0.3, COL.vit, [-15.6, 4.8, 0], { opacity: 0.85 })); sub.add(block(3.15, 1.8, 0.3, COL.vit, [-12.4, 4.8, 0], { opacity: 0.85 }));
        sub.add(lab('外部 180 × 320 ×2', [-14, 4.8, 0.6], { size: 13 }));
        sub.add(lab('画布 540 × 640 + 本体状态', [-14, 10.4, 0], { size: 15, border: 'rgba(58,168,224,.8)' }));
      } else {
        sub.add(block(3.2, 3.2, 0.3, COL.video, [-15.7, 7, 0], { opacity: 0.85 })); sub.add(block(3.2, 3.2, 0.3, COL.vit, [-12.3, 7, 0], { opacity: 0.85 }));
        sub.add(lab('第三人称 256 + 腕部 256', [-14, 4.6, 0.6], { size: 13 }));
        sub.add(lab('拼 256 × 512 → 画布 192 × 320', [-14, 10.4, 0], { size: 15, border: 'rgba(58,168,224,.8)' }));
      }
      const mdl = block(5, 5, 3, COL.gen, [-3, 6.5, 0], { opacity: 0.85 }); sub.add(mdl); gpus.push(mdl);
      sub.add(lab('Cosmos3-Nano 策略', [-3, 9.8, 0], { size: 16 }));
      if (v === 0) {
        const g1 = block(2, 1, 1.4, COL.attn, [-4.3, 2.4, 0], { opacity: 0.85 }), g2 = block(2, 1, 1.4, COL.attn, [-1.7, 2.4, 0], { opacity: 0.85 }); sub.add(g1, g2); gpus.push(g1, g2);
        sub.add(lab('GPU 1：有条件 · GPU 2：无条件', [-3, 1.0, 1], { size: 13 }));
        sub.add(lab('4 步 · shift 5 · CFG 3 · 不解码视频', [-4, 11.4, 0], { size: 14, color: '#9be7bd' }));
      } else sub.add(lab('30 步 · guidance 1（服务端默认）', [-4, 11.4, 0], { size: 14, color: '#9be7bd' }));
      const n = v === 0 ? 32 : 16, hz = v === 0 ? 15 : 20;
      sub.add(lab(`${n} 步 @ ${hz} Hz = ${(n / hz).toFixed(2)} 秒 / 块；${v === 0 ? '8 维绝对关节位置' : '10 维相对位姿 rot6d'}`, [8, 13.2, 0], { size: 15, border: 'rgba(240,150,60,.8)' }));
      sub.add(L.arrow([-10.4, 6.5, 0], [-5.6, 6.5, 0], 0xb8c4da)); sub.add(L.arrow([-0.4, 6.5, 0], [3.6, 6.5, 0], 0xb8c4da));
    }
    rebuild();
    const ctls = [{ label: '配方', items: ['DROID', 'LIBERO-10'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      if (last !== v) rebuild();
      const n = v === 0 ? 32 : 16, k = Math.floor(seg(p, 0.3, 1) * n);
      for (let i = 0; i < 32; i++) { const on = i < n; setI(ticks, i, [4 + i * (6.5 / n), 8.2, 0], on ? [5.2 / n, i <= k ? 1.0 : 0.3, 0.4] : [0.001, 0.001, 0.001]); }
      done(ticks);
      gpus.forEach((g, i) => glow(g, p < 0.3 ? 0.4 + 0.4 * Math.sin(p * 60 + i) : 0));
      const t = seg(p, 0.3, 1); arm.userData.reach([L.lerp(15, 13, t), 0.4 + 2.2 * Math.sin(t * Math.PI), L.lerp(3, 1, t)]);
      cube.position.set(t > 0.5 ? L.lerp(15, 13, t) : 15, t > 0.5 ? 0.4 + 2.2 * Math.sin(t * Math.PI) - 0.8 : 0.4, t > 0.5 ? L.lerp(3, 1, t) : 3);
      cap(p < 0.3 ? '请求一次：画布和本体状态进模型，去噪出一整块动作' : `执行第 ${Math.min(n, k + 1)} / ${n} 步；这一块执行完再请求下一块`);
    } };
  }

  /* ---------- scene 11: results ---------- */
  function s11(G) {
    let view = clamp(+(OPT[0] ?? 0), 0, 3); G.add(L.grid(36, 34));
    const sub = new THREE.Group(); G.add(sub);
    const T = [
      { t: '表 20 · LIBERO-10 成功率（%）', g: ['500 步', '1000 步', '1500 步', '2000 步'], s: [['MT-init', COL.gen, [24.6, 91.4, 95.8, 97.4]], ['PT-init', COL.frozen, [0.0, 73.8, 93.4, 95.2]]], lo: 0, hi: 100 },
      { t: '表 19 · RoboLab 总分 · 具体指令（%）', g: ['Cosmos3 策略', 'PT-init', 'π0.5', 'DreamZero', 'π0-FAST', 'GR00T N1.6', 'π0'], s: [['', COL.action, [39.7, 30.2, 28.1, 23.9, 14.9, 5.3, 3.5]]], lo: 0, hi: 45 },
      { t: '表 18 · DROID 正向动力学 PSNR（dB）', g: ['Super MT', 'Nano MT', 'Super PT', 'Nano PT', 'Ctrl-World'], s: [['', COL.video, [26.04, 25.52, 22.69, 23.24, 22.99]]], lo: 20, hi: 27 },
      { t: 'OpenWAM 图 6 · 视频骨干（RoboTwin2.0-Full，%）', g: ['Wan2.1-VACE 1.3B', 'Cosmos-Predict2.5 2B', 'Cosmos3-Edge 4B', 'Wan2.2-TI2V 5B', 'Wan2.1-I2V 14B'], s: [['', COL.gold, [90.14, 91.64, null, 92.39, 93.79]]], lo: 88, hi: 95 }];
    let bars = [], last = -1;
    function rebuild() {
      clearSub(sub); bars = []; last = view; const v = T[view], Ng = v.g.length, Ns = v.s.length, gw = Math.min(5.2, 30 / Ng), w = Math.min(1.6, (gw - 0.8) / Ns);
      v.g.forEach((nm, i) => { const x0 = (i - (Ng - 1) / 2) * gw; sub.add(lab(nm, [x0, -0.3 - (Ng > 5 ? (i % 2) * 1.1 : 0), 2.6], { size: 15 }));
        v.s.forEach(([sn, c, vals], j) => { const x = x0 + (j - (Ns - 1) / 2) * (w + 0.1); const val = vals[i];
          if (val == null) { sub.add(block(w, 0.3, w, COL.noise, [x, 0.15, 0], { opacity: 0.4 })); sub.add(lab('论文没报', [x, 1.4, 0], { size: 14, color: '#ff9b84' })); return; }
          const b = block(w, 1, w, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(String(val), [x, 0, 0], { size: 14 }); sub.add(l); bars.push({ b, l, v: val }); }); });
      if (Ns > 1) v.s.forEach(([sn, c], j) => sub.add(lab(sn, [-6 + j * 6, 11.2, 0], { size: 16, color: hexs(c) })));
      sub.add(lab(v.t + `（纵轴 ${v.lo} 到 ${v.hi}）`, [0, 9.8, 0], { size: 18, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const ctls = [{ label: '图表', items: ['LIBERO-10', 'RoboLab', 'DROID FD', 'OpenWAM 骨干'], get: () => view, set: k => { view = k; } }];
    const MSG = ['MT-init 第 500 步已有 24.6%，PT-init 还是 0；2000 步时差 2.2 点。官方配方 max_iter 2000、每 500 步存档', '正文写 DreamZero 25.2%，表里是 23.9%；“总”按任务数加权，我推断三档是 64 / 39 / 17 个任务', 'PT-init 的 Nano 已和 Ctrl-World 持平（23.24 对 22.99），MT-init 再高 2–3 dB', 'OpenWAM 代码支持 Cosmos3-Edge（同一个 Wan2.2 VAE，shift 5），也发布了检查点，但论文没有报它的分数'];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const { lo, hi } = T[view], g = seg(p, 0, 0.5);
      bars.forEach(({ b, l, v }) => { const h = Math.max(0.02, (v - lo) / (hi - lo) * 7.5 * g); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.45; });
      cap(MSG[view]);
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
  window.__cosmos3Debug = { get cap() { return $('cap').textContent; } };
})();
