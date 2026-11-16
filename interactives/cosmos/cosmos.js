'use strict';
/* Cosmos World Foundation Model Platform (arXiv 2501.03575, NVIDIA) taken apart into eleven animated scenes.
   Numbers come from the report (v3) and the official code nvidia-cosmos/cosmos-predict1 @ 724daa1.
   Each scene's update(p) is a pure function of the timeline p plus the current toggles. Scenes 3, 4, 5, 6 compute
   their numbers live from the formulas; scenes 2, 7, 11 draw table values from the paper. No Cosmos network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { video: 0x3aa8e0, tok: 0x4fc98a, disc: 0xf2a65a, dit: 0x7c8cff, ar: 0xd45fa0, text: 0x9d8cff, time: 0xf2c14e, attn: 0xd45fa0, ffn: 0x38d1ff, norm: 0x6b7794, noise: 0x8e9bb8, gold: 0xf2c14e, ok: 0x4fc98a, bad: 0xe05d5d, cam: 0x38d1ff, act: 0xf0963c, dim: 0x46506a, white: 0xeef2fa, guard: 0xe07a5f };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const hexs = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const live = t => `<p class="guess"><b>现算 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const subN = n => String(n).split('').map(c => '₀₁₂₃₄₅₆₇₈₉'[+c]).join('');
  /* DiT parameter count (no biases / norms): self-attn 4d², cross-attn 2d² + 2·1024·d, FFN 2·d·f, three AdaLN modulations */
  function ditParams(d, Lr, f, lora) {
    const core = 4 * d * d + 2 * d * d + 2 * 1024 * d + 2 * d * f;
    const ada = lora ? 3 * (256 * d + 256 * 3 * d) : 3 * (d * 3 * d);
    return { tot: Lr * (core + ada), ada: Lr * ada };
  }

  const SCENES = [
    { n: 1, part: '总览', title: '五个部件：整理器、Tokenizer、WFM、后训练、护栏', sub: '点方块跳到对应那一幕', dur: 12, cam: [0.0, 1.12, 38, [0, 2.2, 0]],
      html: dl([['视频整理器', '2,000 万小时 → 约 1 亿段 2–60 秒片段'], ['Tokenizer', '因果；连续 CV8×8×8（16 通道）/ 离散 DV8×16×16（词表 64,000）'], ['扩散 WFM', '7B / 14B Text2World → Video2World，EDM + DiT'], ['自回归 WFM', '4B / 12B → 5B / 13B Video2World，Llama3 式 GPT'], ['后训练', '相机、机器人、自动驾驶'], ['护栏', 'pre-Guard（关键词 + Aegis）/ post-Guard（安全分类器 + 人脸打码）']]) +
        '<p>数据经整理器变成片段，tokenizer 把片段压成连续或离散 token，两类 WFM 在 token 上预训练；预训练模型再用小数据集后训练成专用世界模型。护栏包在输入和输出两头。</p>' + src('§2.2 · 图 4 · 表 10') },
    { n: 2, part: '§3 数据', title: '五步整理管线', sub: '切换：类别分布 / 转码吞吐（表 2）', dur: 13, cam: [0.0, 1.1, 46, [1.5, 3.4, 0]],
      html: dl([['切分', 'TransNetV2 找镜头边界；< 2 s 丢弃，> 60 s 再切；h264_nvenc 转码'], ['过滤', '运动（光流 + ViT）、画质（DOVER 去掉最低 15%，美学 3.5）、叠加文字、视频类型'], ['标注', 'VILA 13B，8 帧输入，平均 97 个词'], ['去重', 'InternVideo2 嵌入，k-means k = 10,000，去掉约 30%'], ['分片', 'webdataset，按分辨率、宽高比、长度']]) +
        '<p>左边是五步，右边是开关选中的那张表：九个类别的比例（原文 §3.1），或表 2 的四种转码设置的吞吐。</p>' +
        guess('漏斗的宽度是示意；原文只给了去重去掉约 30%、画质去掉最低 15% 两个比例。柱子是原文数字。') + src('§3.1–3.7 · 图 5 · 表 2') },
    { n: 3, part: '§4.1 因果分组', title: '首帧单独，之后每 4 帧一组', sub: '单步看 ξₖ 只连到 g₀…gₖ；切换帧数', dur: 13, cam: [0.0, 1.12, 34, [0, 2.4, 0]],
      html: dl([['小波', '2 级 Haar：x、y、t 各降 4 倍'], ['分组', '{x₀, x₁:₄, x₅:₈, …} → {g₀, g₁, g₂, …}'], ['因果', '{g₀, g₀:₁, g₀:₂, …} → {ξ₀, ξ₁, ξ₂, …}'], ['卷积', '1×k×k 空间 + k×1×1 时间，时间左填充 k − 1'], ['图像', '只有 x₀ 时就是图像 tokenizer']]) +
        '<p>上排是帧，中间是小波后的组，下排是编码器输出。亮线是当前 ξₖ 能看到的组：只有 g₀ 到 gₖ，没有来自未来的线。所以一张图（只有 x₀）和一段视频的第一个 token 完全相同，图像视频能共用一个隐空间。</p>' +
        live('组数 1 + T/4 和隐帧数 1 + T/8（CV8×8×8 再降 2 倍）按帧数现算。') + src('§4.1 · 图 9(a) · tokenizer/networks/configs.py patch_method "haar"') },
    { n: 4, part: '§4 压缩率', title: '压缩率和 token 数', sub: '切换 tokenizer，看形状、token 数和信息压缩', dur: 13, cam: [0.25, 1.05, 36, [0, 2.0, 0]],
      html: dl([['CV8×8×8-720p', '扩散用；121 帧 704×1280 → 16 × 88 × 160 × 16'], ['DV8×16×16-720p', '自回归用；33 帧 640×1024 → 5 × 40 × 64 个整数'], ['FSQ', '(8, 8, 8, 5, 5, 5) → 64,000 个码字，约 16 位'], ['patch', '扩散再做 (1, 2, 2) patch：16 × 44 × 80 = 56,320 个 token']]) +
        '<p>左边是一个隐帧的网格（缩小画），右边三根条分别是：时空压缩倍数（论文的“压缩率”）、按元素算的倍数、按比特算的倍数。离散版的比特压缩比连续版大一个量级以上，这就是要扩散解码器的原因。</p>' +
        live('形状、token 数、三种压缩倍数都按公式现算；比特按 8 位像素、连续隐变量 BF16（16 位）、离散 log₂64000 位计。') + guess('BF16 存储是我设的口径，论文只给时空倍数。') + src('§4.1 · §4.2 · 表 12 脚注 · 读者注 6') },
    { n: 5, part: '§5.1.2 DiT', title: 'DiT 块和 AdaLN-LoRA', sub: '切换 7B / 14B、稠密 / LoRA，当场算参数量', dur: 14, cam: [0.18, 1.3, 42, [0, 6.2, 0]],
      html: dl([['块', '自注意力（3D RoPE，QK-RMSNorm）→ 交叉注意力（T5-XXL）→ MLP（GELU）'], ['调制', '时间步 t → scale、shift、gate，三处各一组'], ['AdaLN-LoRA', '稠密 d → 3d 改成 d → 256 → 3d'], ['位置', '3D 分解 RoPE（按 FPS 缩放）+ 每块可学习的绝对位置'], ['7B / 14B', '28 层宽 4096 / 36 层宽 5120，FFN 4 倍']]) +
        '<p>左边一列是 N 个块（画 10 层），中间是展开的一个块，右边是时间步的调制网络。稠密时每块三处调制各要 d × 3d 的矩阵；LoRA 时先降到 256 维再升回 3d。</p>' +
        live('参数量按表 11 和代码逐项算（不计偏置和归一化）：7B 稠密 11.04B、LoRA 7.16B，少 35.1%；原文说 11B → 7B、少 36%。') + guess('块数画成 10 层。') + src('§5.1.2 · 图 11 · 表 11 · diffusion/config/base/net.py') },
    { n: 6, part: '§5.1 训练', title: 'EDM 训练和 Video2World 条件', sub: '切换 Text2World / Video2World 1 或 2 个条件隐帧', dur: 14, cam: [0.0, 1.12, 38, [0, 3.0, 0]],
      html: dl([['式 (5)', '‖D_θ(x₀ + n; σ) − x₀‖²'], ['式 (6)', '加权 λ(σ)/e^{u(σ)}，再加 u(σ)'], ['式 (8)', 'ln σ ~ N(P_mean, P_std²)'], ['视频批', '噪声 × √(隐帧数)：121 帧 → 16 → × 4（代码）'], ['条件帧', '和生成帧在时间维拼接；加掩码通道；增强噪声 ln σ ~ N(−3, 2²)；不算损失']]) +
        '<p>下面一排是 16 个隐帧（121 帧）。Video2World 时前几个是条件帧（金框），只加很小的增强噪声；其余按训练采样的 σ 加噪。左边直方图是 ln σ 的采样分布：视频批整体右移 ln 4 ≈ 1.39。</p>' +
        live('直方图按固定种子抽 3,000 个样本；P_mean = 0、P_std = 1 取代码 config/base/model.py 的默认值（论文没给主训练值）。') + src('§5.1.1 · §5.1.3 · model.py video_noise_multiplier · 读者注 12、15') },
    { n: 7, part: '§5.2 自回归', title: '离散 token 逐个预测，Medusa 一次猜多个', sub: '切换 Medusa 头数（表 15 的 4B 数字）', dur: 14, cam: [0.0, 1.15, 36, [0, 3.2, 0]],
      html: dl([['序列', '5 个隐帧 × 40 × 64 = 12,800 个 token（33 帧 640×1024）'], ['损失', '式 (9) 下一个 token 的负对数似然 + z-loss'], ['结构', 'Llama3 式，16 / 40 层，32 头 8 组 KV，SwiGLU，3D RoPE + 3D APE'], ['Medusa', '最后一层后加 k 个单层 FFN 头，一次前向猜多个 token，再验证'], ['选择', '9 个头：4B 吞吐 894.67 token/s，是 0 头的 2.01 倍']]) +
        '<p>格子按光栅顺序（隐帧 → 行 → 列）一个个亮起；每一步前向能接受的平均 token 数 = 生成的 token 总数 ÷ 前向次数，取自表 15。</p>' +
        guess('网格按 5 × 8 × 12 缩小画；每次接受多少个按表 15 的平均值取整，真实情况每步不同。') + src('§5.2.1–5.2.4 · 表 14、15') },
    { n: 8, part: '§5.2.5 扩散解码器', title: '把离散 token 解成高清视频', sub: '切换训练 / 推理', dur: 13, cam: [0.0, 1.1, 40, [0, 2.6, 0]],
      html: dl([['条件', 'DV8×16×16 的整数 → 16 维词表嵌入 → x、y 上采样 2 倍'], ['拼接', '和加噪的 CV8×8×8 隐变量在通道维拼接（第一层加宽）'], ['去噪器', '从 Cosmos-Predict1-7B-Text2World 微调'], ['输出', '连续隐变量 → CV8×8×8 解码器 → RGB']]) +
        '<p>下路是离散 token（粗网格），上采样后正好对齐上路连续隐变量的网格（16 / 8 = 2）。训练时上路来自真视频的 CV 编码；推理时上路从纯噪声开始，条件来自自回归模型的输出。</p>' + src('§5.2.5 · 图 15、16') },
    { n: 9, part: '§6 后训练', title: '相机、机器人动作、六路驾驶', sub: '切换三种后训练', dur: 14, cam: [0.0, 1.05, 40, [0, 3.0, 0]],
      html: dl([['相机', '每个隐变量像素一条 Plücker 射线 (d, c × d) ∈ ℝ⁶，与隐变量拼接；每 8 帧取第 4 帧'], ['机器人', '7 维动作 (Δx, Δy, Δz, Δθ_r, Δθ_p, Δθ_y, Δ夹爪) → MLP → 加到时间步嵌入（代码也加到 AdaLN-LoRA）'], ['驾驶', '6 路相机一起去噪，视角嵌入，每路的交叉注意力只读自己的描述；可选 64 点轨迹条件']]) +
        '<p>三种后训练都从 7B 扩散模型出发，只在输入端加新的条件，骨干结构不变。</p>' +
        guess('相机轨迹、动作数值和六个视角的摆放是示意。') + src('§6.1 式 (11) · §6.2.2 · §6.3.2 · general_dit_action.py') },
    { n: 10, part: '§7 护栏', title: '先拦输入，再拦输出', sub: '切换示例：正常 / 命中关键词 / 某一帧不安全', dur: 13, cam: [0.0, 1.1, 42, [0, 2.6, 0]],
      html: dl([['关键词', 'WordNet 词形还原后查词表，命中即拒绝整条提示'], ['Aegis', 'Llama-Guard 微调，defensive 版，13 类风险（开源代码换成 Llama Guard 3）'], ['安全分类器', '每帧 SigLIP 嵌入 + MLP，任一帧不安全就拦整段'], ['人脸', 'RetinaFace，> 20 × 20 像素的脸打马赛克']]) +
        '<p>提示从左往右走过两道文字关卡，通过后才生成视频；生成的每一帧再过安全分类器，最后打码输出。</p>' +
        guess('三个示例是我设的情形，不对应真实提示。') + src('§7 · 图 30 · auxiliary/guardrail/common/presets.py') },
    { n: 11, part: '评测', title: '结果', sub: '切换表格；每根柱子是原文数字', dur: 12, cam: [0.0, 1.08, 34, [0, 3.8, 0]],
      html: dl([['3D 一致性', '7B-Video2World 位姿成功率 68.4%，VideoLDM 4.4%，真实视频 56.4%'], ['物理对齐', '9 帧条件的 IoU 都在 0.48–0.60，大模型不更好'], ['相机控制', '成功率 82.0% 对 CamCo 43.0%'], ['Bridge 动作', 'FVD 7B 190，5B 434，IRASim 593'], ['驾驶', '跨视角 Sampson 误差 2.11，真实 1.71，VideoLDM 6.48']]) +
        '<p>每张表取一列最能说明问题的指标。物理对齐那张值得多看一眼：模型从 4B 到 14B，IoU 几乎不动。</p>' + src('表 19 · 表 20 · 表 22 · 表 23 · 表 24') }
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
  function clearSub(sub) { LABS = LABS.filter(s => { let o = s; while (o) { if (o === sub) return false; o = o.parent; } return true; }); L.clear(sub); }
  const mix = (a, b, k) => [L.lerp(a[0], b[0], k), L.lerp(a[1], b[1], k), L.lerp(a[2], b[2], k)];

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

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    G.add(L.grid(48, 24)); PICKS = [];
    const parts = [
      { x: -15, y: 1.6, w: 3.0, h: 3.2, c: COL.video, t: '视频整理器', s: '2,000 万小时 → 1 亿段', go: 1 },
      { x: -9.2, y: 1.6, w: 2.6, h: 3.2, c: COL.tok, t: 'Tokenizer', s: 'CV8×8×8 / DV8×16×16', go: 2 },
      { x: -2.6, y: 4.2, w: 4.2, h: 2.4, c: COL.dit, t: '扩散 WFM', s: '7B / 14B，EDM + DiT', go: 4 },
      { x: -2.6, y: 0.4, w: 4.2, h: 2.4, c: COL.ar, t: '自回归 WFM', s: '4B / 12B → 5B / 13B', go: 6 },
      { x: 5.0, y: 1.6, w: 3.4, h: 3.2, c: COL.act, t: '后训练', s: '相机 · 机器人 · 驾驶', go: 8 },
      { x: 11.4, y: 1.6, w: 2.6, h: 3.2, c: COL.guard, t: '护栏', s: '输入 + 输出', go: 9 },
      { x: 16.4, y: 1.6, w: 2.4, h: 3.2, c: COL.gold, t: '评测', s: '3D · 物理', go: 10 }
    ];
    const B = parts.map((q, i) => { const b = block(q.w, q.h, 2.0, q.c, [q.x, q.y + q.h / 2 - 1.6 + 1.6, 0], { opacity: 0.92 }); b.position.y = q.y + q.h / 2; b.userData.go = q.go; G.add(b); PICKS.push(b);
      const ly = i === 3 ? -0.7 : q.y + q.h + 0.8, sy = i === 3 ? -1.9 : i === 2 ? q.y + q.h + 2.3 : q.y - 0.9 - (i % 2 === 0 ? 1.0 : 0);
      G.add(lab(q.t, [q.x + (i === 3 ? 0 : 0), ly, i === 3 ? 1.6 : 0], { size: 19 })); G.add(lab(q.s, [q.x, sy, 1.4], { size: 14, color: '#b8c4da' })); return b; });
    G.add(lab('预训练', [-2.6, 10.6, 0], { size: 17, border: hexs(COL.dit) }));
    const f1 = stream(G, 16, COL.video, 0.13), f2 = stream(G, 8, COL.tok, 0.12), f3 = stream(G, 8, COL.disc, 0.12);
    return { update(p) {
      const q = (p * 2) % 1;
      f1([[-15, 3.2, 1.2], [-9.2, 3.2, 1.2], [-6, 3.2, 1.2]], q, 1);
      f2([[-6, 3.2, 1.2], [-2.6, 5.4, 1.2], [5.0, 3.2, 1.2], [11.4, 3.2, 1.2], [16.4, 3.2, 1.2]], q, 1);
      f3([[-6, 3.2, 1.2], [-2.6, 1.6, 1.2], [5.0, 3.2, 1.2]], q, 1);
      B.forEach((b, i) => glow(b, Math.max(0.05, 0.6 - Math.abs(i / 7 - p) * 3)));
      cap(p < 0.34 ? '<b>数据</b>：整理器切分、过滤、标注、去重；tokenizer 把片段压成连续或离散 token' : p < 0.67 ? '<b>预训练</b>：连续 token 训扩散 WFM，离散 token 训自回归 WFM' : '<b>后训练和护栏</b>：小数据集把通才变成专用世界模型；输入输出两头加护栏。点任意方块跳到对应一幕');
    } };
  }

  /* ---------- scene 2: data pipeline ---------- */
  function s2(G) {
    let v = +(OPT[0] ?? 0); G.add(L.grid(48, 24)); const sub = new THREE.Group(); G.add(sub);
    const steps = [['原始视频 约 2,000 万小时', 15, COL.noise, '720p–4K，专有 + 公开'], ['① 切分 + 转码', 13, COL.video, 'TransNetV2；2–60 s'], ['② 过滤', 10, COL.tok, '运动 · 画质 · 文字 · 类型'], ['③ 标注', 9, COL.text, 'VILA 13B，约 97 词'], ['④ 去重', 6.3, COL.time, '约 −30%'], ['⑤ 分片', 6.0, COL.dit, 'webdataset']];
    const SB = steps.map(([t, w, c, s], i) => { const y = 9.6 - i * 1.75, b = block(w, 1.05, 2.0, c, [-10, y, 0], { opacity: 0.88 }); G.add(b);
      G.add(lab(t, [-10, y, 1.3], { size: 16 })); G.add(lab(s, [-1.0, y, 0], { size: 14, color: '#b8c4da' })); return b; });
    const pts = stream(G, 14, COL.video, 0.12);
    const T = [
      { t: '§3.1 · 九个类别（%）', g: ['驾驶', '手和操作', '人体动作', '空间导航', '第一人称', '自然', '镜头运动', '合成', '其他'], v: [11, 16, 10, 16, 8, 20, 8, 4, 7], hi: 22, f: x => x + '%' },
      { t: '表 2 · 转码吞吐（视频/秒）', g: ['ffmpeg H100 libx264', 'ffmpeg L40S nvenc', 'L40S nvenc 批 16', 'pynvc L40S'], v: [0.0574, 0.0674, 0.1026, 0.3702], hi: 0.4, f: x => String(x) }
    ];
    let bars = [], last = -1;
    function rebuild() {
      clearSub(sub); bars = []; last = v; const c = T[v], n = c.g.length, gw = Math.min(2.6, 18 / n);
      c.g.forEach((nm, i) => { const x = 6 + i * gw, b = block(gw * 0.7, 1, 1.0, v ? COL.video : COL.tok, [x, 0.5, 0], { edges: false }); sub.add(b);
        const vl = lab(c.f(c.v[i]), [x, 0, 0.8], { size: 13 }); sub.add(vl); sub.add(lab(nm, [x, -0.7 - (i % 2) * 1.1, 1.0], { size: 13 })); bars.push({ b, vl, h: c.v[i] / c.hi * 8 }); });
      sub.add(lab(c.t, [6 + (n - 1) * gw / 2, 10.6, 0], { size: 17, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const ctls = [{ label: '右图', items: ['类别分布', '转码吞吐'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      if (last !== v) rebuild();
      SB.forEach((b, i) => glow(b, Math.max(0.05, 0.6 - Math.abs(i / 6 - p * 1.1) * 3)));
      pts([[-10, 10.8, 1.4], [-10, 0.2, 1.4]], (p * 1.5) % 1, 1);
      const g = seg(p, 0.2, 0.6); bars.forEach(({ b, vl, h }) => { const H = Math.max(0.02, h * g); b.scale.y = H; b.position.y = H / 2; vl.position.y = H + 0.5; });
      cap(v === 0 ? '九个类别合计 11 + 16 + 10 + 16 + 8 + 20 + 8 + 4 + 7 = <b>100%</b> · 预训练约 10⁸ 段，微调约 10⁷ 段' : '全部改进合起来 0.3702 / 0.0574 = <b>6.45 倍</b>（原文“约 6.5 倍”）· L40S 比 H100 高 0.0674 / 0.0574 − 1 = 17%');
    } };
  }

  /* ---------- scene 3: causal grouping ---------- */
  function s3(G) {
    let v = +(OPT[0] ?? 0); G.add(L.grid(44, 22)); const sub = new THREE.Group(); G.add(sub);
    const SET = [13, 17, 1];
    let F = 13, NG = 4, fr, gb = [], xb = [], lines = [], last = -1;
    function rebuild() {
      clearSub(sub); gb = []; xb = []; lines = []; last = v; F = SET[v]; NG = 1 + (F - 1) / 4;
      const span = 26, dx = F > 1 ? span / (F - 1) : 0, X = i => (F > 1 ? -13 + i * dx : 0);
      fr = inst(BOX, F); sub.add(fr);
      for (let i = 0; i < F; i++) { setI(fr, i, [X(i), 8.4, 0], [Math.min(1.3, dx * 0.75 || 1.3), 1.6, 0.25]); colI(fr, i, hex3(i === 0 ? COL.gold : (Math.ceil(i / 4) % 2 ? COL.video : 0x7fc4ec))); }
      done(fr);
      sub.add(lab(F === 1 ? '只有 x₀（一张图）' : '输入帧 x₀ … x' + subN(F - 1), [9, 10.2, 0], { size: 16 }));
      const gx = j => (j === 0 ? X(0) : (X(1 + 4 * (j - 1)) + X(4 * j)) / 2);
      for (let j = 0; j < NG; j++) {
        const g = block(1.7, 1.3, 0.5, COL.tok, [gx(j), 4.6, 0]); sub.add(g); gb.push(g); sub.add(lab('g' + '₀₁₂₃₄₅₆₇₈₉'[j], [gx(j) - 1.4, 4.6, 0.5], { size: 15 }));
        const ins = j === 0 ? [0] : [1, 2, 3, 4].map(k => 4 * (j - 1) + k);
        ins.forEach(i => sub.add(L.line([[X(i), 7.5, 0], [gx(j), 5.3, 0]], 0x8e9bb8, { opacity: 0.45 })));
        const x = block(1.7, 1.3, 0.5, COL.dit, [gx(j), 0.8, 0]); sub.add(x); xb.push(x); sub.add(lab('ξ' + '₀₁₂₃₄₅₆₇₈₉'[j], [gx(j) + 1.4, 0.8, 0.5], { size: 15 }));
      }
      for (let j = 0; j < NG; j++) for (let i = 0; i <= j; i++) { const l = L.line([[gx(i), 3.9, 0.1], [gx(j), 1.5, 0.1]], COL.gold, { opacity: 0.0 }); sub.add(l); lines.push({ l, i, j }); }
      sub.add(lab('2 级 Haar 小波：每 4 帧一组（首帧单独）', [9, 6.4, 0], { size: 15 }));
      sub.add(lab('因果卷积 + 因果注意力', [9, 2.7, 0], { size: 15 }));
      sub.userData.gx = gx;
    }
    rebuild();
    const ctls = [{ label: '帧数', items: ['13 帧（图 9）', '17 帧', '1 帧（图像）'], get: () => v, set: k => { v = k; } }];
    return { ctls, update(p) {
      if (last !== v) rebuild();
      const k = clamp(Math.floor(seg(p, 0.05, 0.9) * NG), 0, NG - 1);
      lines.forEach(({ l, i, j }) => { l.material.opacity = j === k ? 0.95 : j < k ? 0.12 : 0.0; });
      gb.forEach((g, i) => glow(g, i <= k ? 0.5 : 0.02)); xb.forEach((x, i) => { x.visible = i <= k; glow(x, i === k ? 0.8 : 0.1); });
      const lat = 1 + (F - 1) / 8;
      cap(`ξ${'₀₁₂₃₄₅₆₇₈₉'[k]} 只看 g₀ … g${'₀₁₂₃₄₅₆₇₈₉'[k]}（${k + 1} 组），没有来自未来的连线 · ${F} 帧 → 小波后 <b>${NG}</b> 组（1 + ${F - 1}/4）` + (Number.isInteger(lat) ? ` · CV8×8×8 再降 2 倍 → <b>${lat}</b> 个隐帧（1 + ${F - 1}/8）` : ` · 8 倍时间压缩要求帧数 = 8k + 1`));
    } };
  }

  /* ---------- scene 4: compression and token counts ---------- */
  function s4(G) {
    let v = +(OPT[0] ?? 1); G.add(L.grid(44, 22)); const sub = new THREE.Group(); G.add(sub);
    const M = [
      { nm: 'CV4×8×8-360p', F: 121, H: 704, W: 1280, t: 4, s: 8, C: 16, disc: false },
      { nm: 'CV8×8×8-720p', F: 121, H: 704, W: 1280, t: 8, s: 8, C: 16, disc: false },
      { nm: 'DV8×16×16-720p', F: 33, H: 640, W: 1024, t: 8, s: 16, C: 6, disc: true },
      { nm: 'DV4×8×8-360p', F: 33, H: 640, W: 1024, t: 4, s: 8, C: 6, disc: true }
    ];
    const calc = m => { const lt = 1 + (m.F - 1) / m.t, h = m.H / m.s, w = m.W / m.s, st = m.t * m.s * m.s, el = st * 3 / m.C, bits = st * 3 * 8 / (m.disc ? Math.log2(64000) : m.C * 16), tok = m.disc ? lt * h * w : lt * (h / 2) * (w / 2); return { lt, h, w, st, el, bits, tok }; };
    let cells, bars = [], last = -1;
    function rebuild() {
      clearSub(sub); bars = []; last = v; const m = M[v], c = calc(m);
      const GH = Math.min(10, Math.round(c.h / 8)), GW = Math.min(16, Math.round(c.w / 8)), LAY = Math.min(6, c.lt);
      cells = inst(BOX, GH * GW * LAY); sub.add(cells); sub.userData = { GH, GW, LAY };
      sub.add(lab(`隐变量 ${c.lt} × ${c.h} × ${c.w}${m.disc ? ' 个整数' : ' × 16'}（缩小画）`, [-9, -0.8, 1.5], { size: 16 }));
      const vals = [['时空倍数', c.st, COL.tok], ['元素倍数', c.el, COL.video], ['比特倍数', c.bits, COL.gold]];
      vals.forEach(([nm, val, col], i) => { const b = block(1.6, 1, 1.6, col, [5 + i * 3.6, 0.5, 0], { edges: false }); sub.add(b); const vl = lab(fmt(val) + ' ×', [5 + i * 3.6, 0, 1.0], { size: 15 }); sub.add(vl); sub.add(lab(nm, [5 + i * 3.6, -0.9, 1.2], { size: 15 })); bars.push({ b, vl, h: Math.log10(val) * 2.4 }); });
      sub.add(lab('高度按 log₁₀ 画', [8.6, -2.4, 1.2], { size: 14, color: '#b8c4da' }));
    }
    rebuild();
    return { ctls: [{ label: 'tokenizer', items: M.map(m => m.nm), get: () => v, set: k => { v = k; } }], update(p) {
      if (last !== v) rebuild();
      const m = M[v], c = calc(m), { GH, GW, LAY } = sub.userData, g = seg(p, 0.05, 0.45), sp = 0.55;
      let n = 0;
      for (let l = 0; l < LAY; l++) for (let r = 0; r < GH; r++) for (let q = 0; q < GW; q++) {
        setI(cells, n, [-13.5 + q * sp + l * 0.35, 1.2 + r * sp + l * 0.35, -l * 1.0 * g], [sp * 0.88, sp * 0.88, 0.3]);
        colI(cells, n, hex3(m.disc ? (((r * 7 + q * 3 + l) % 5) < 2 ? COL.disc : 0xc77f3a) : (l === 0 ? COL.tok : 0x2f9a68))); n++;
      }
      done(cells);
      const gb = seg(p, 0.45, 0.85); bars.forEach(({ b, vl, h }) => { const H = Math.max(0.02, h * gb); b.scale.y = H; b.position.y = H / 2; vl.position.y = H + 0.5; });
      cap(`${m.nm}：${m.F} 帧 → <b>${c.lt} × ${c.h} × ${c.w}</b> · ${m.disc ? '序列' : 'patch 后'} <b>${fmt(c.tok)}</b> 个 token · 时空 / 元素 / 比特 = ${fmt(c.st)} / ${fmt(c.el)} / ${fmt(c.bits)} 倍`);
    } };
  }

  /* ---------- scene 5: DiT block with AdaLN-LoRA ---------- */
  function s5(G) {
    let lora = +(OPT[0] ?? 1), mdl = +(OPT[1] ?? 0); G.add(L.grid(44, 22)); const sub = new THREE.Group(); G.add(sub);
    const MD = [{ nm: '7B', d: 4096, L: 28, f: 16384 }, { nm: '14B', d: 5120, L: 36, f: 20480 }];
    const NB = 10, slabs = [];
    for (let i = 0; i < NB; i++) { const b = block(3.0, 0.45, 2.0, COL.dit, [-10, 0.6 + i * 0.68, 0], { opacity: 0.9 }); G.add(b); slabs.push(b); }
    G.add(lab('N 个块（画 10 层）', [-10, -0.7, 1.2], { size: 16 }));
    const parts = [['+ 绝对位置（可学习）', COL.norm], ['LN · scale/shift ₁', COL.time], ['自注意力（3D RoPE，QK-RMSNorm）', COL.attn], ['× gate ₁ · 残差', COL.time], ['LN · scale/shift ₂', COL.time], ['交叉注意力（T5-XXL，512 token）', COL.text], ['× gate ₂ · 残差', COL.time], ['LN · scale/shift ₃', COL.time], ['MLP（GELU，4d）', COL.ffn], ['× gate ₃ · 残差', COL.time]];
    const P = parts.map(([t, c], i) => { const y = 0.6 + i * 1.4, b = block(6.4, 0.95, 1.6, c, [0, y, 0], { opacity: 0.92 }); G.add(b); G.add(lab(t, [0, y, 1.2], { size: 13 })); return { b, y }; });
    G.add(L.line([[-8.4, 3.6, 0], [-3.3, 0.1, 0]], 0x8e9bb8, { dashed: true, opacity: 0.5 })); G.add(L.line([[-8.4, 3.6, 0], [-3.3, 13.6, 0]], 0x8e9bb8, { dashed: true, opacity: 0.5 }));
    const tm = block(3.0, 1.0, 1.4, COL.time, [9.5, 11.0, 0], { opacity: 0.9 }); G.add(tm); G.add(lab('时间步 t → 嵌入 (d)', [9.5, 12.4, 0], { size: 15 }));
    const mods = stream(G, 6, COL.time, 0.12);
    let last = '', mid = [];
    function rebuild() {
      clearSub(sub); mid = []; last = lora + '' + mdl; const m = MD[mdl];
      if (lora) { const a = block(0.6, 2.6, 1.0, COL.ok, [9.5, 7.2, 0]); const b = block(2.4, 1.0, 1.0, COL.ok, [9.5, 4.6, 0]); sub.add(a, b); mid = [a, b]; sub.add(lab('d → 256', [11.6, 7.2, 0], { size: 15 })); sub.add(lab('256 → 3d（每处一组）', [9.5, 3.4, 0.8], { size: 15 })); }
      else { const a = block(2.8, 3.6, 1.0, COL.bad, [9.5, 6.2, 0]); sub.add(a); mid = [a]; sub.add(lab('d → 3d（每处一组）', [9.5, 3.6, 0.8], { size: 15 })); }
      sub.add(lab(`${m.nm}：${m.L} 层，宽 ${m.d}`, [-10, 8.0, 0], { size: 16, border: hexs(COL.dit) }));
    }
    rebuild();
    const ctls = [{ label: '调制', items: ['稠密 AdaLN', 'AdaLN-LoRA（论文）'], get: () => lora, set: k => { lora = k; } }, { label: '尺寸', items: ['7B', '14B'], get: () => mdl, set: k => { mdl = k; } }];
    return { ctls, update(p) {
      if (last !== lora + '' + mdl) rebuild();
      const k = Math.floor(seg(p, 0.05, 0.9) * parts.length * 0.999);
      P.forEach(({ b }, i) => glow(b, i === k ? 0.7 : 0.05));
      mods([[9.5, 10.4, 0], [9.5, 4.0, 0], [3.2, P[k].y, 0]], (p * 2) % 1, 1);
      slabs.forEach((s, i) => glow(s, Math.max(0.05, 0.6 - Math.abs(i / NB - p) * 4)));
      mid.forEach(b => glow(b, 0.3));
      const m = MD[mdl], a = ditParams(m.d, m.L, m.f, true), b = ditParams(m.d, m.L, m.f, false), cur = lora ? a : b;
      cap(`${m.nm}：总参数 <b>${(cur.tot / 1e9).toFixed(2)}B</b>，其中调制 ${(cur.ada / 1e9).toFixed(2)}B · 稠密 ${(b.tot / 1e9).toFixed(2)}B → LoRA ${(a.tot / 1e9).toFixed(2)}B，少 <b>${((b.tot - a.tot) / b.tot * 100).toFixed(1)}%</b>（原文 7B：11B → 7B，36%）`);
    } };
  }

  /* ---------- scene 6: EDM training and Video2World conditioning ---------- */
  function s6(G) {
    let v = +(OPT[0] ?? 1); G.add(L.grid(46, 23)); const sub = new THREE.Group(); G.add(sub);
    const NL = 16, X = i => -12 + i * 1.6, cubes = [];
    for (let i = 0; i < NL; i++) { const b = block(1.2, 1.2, 1.2, COL.noise, [X(i), 0.8, 4]); G.add(b); cubes.push(b); }
    G.add(lab('16 个隐帧（121 帧，CV8×8×8）', [X(7.5), -0.8, 5.2], { size: 16 }));
    /* ln σ histograms: image batch N(0,1); video batch shifted by ln 4 */
    const rr = L.rng(5), BINS = 24, lo = -4, hi = 5, Hi = new Array(BINS).fill(0), Hv = new Array(BINS).fill(0), sm = [];
    for (let k = 0; k < 3000; k++) { const z = L.gauss(rr); sm.push(z); const a = z, b = z + Math.log(4); Hi[clamp(Math.floor((a - lo) / (hi - lo) * BINS), 0, BINS - 1)]++; Hv[clamp(Math.floor((b - lo) / (hi - lo) * BINS), 0, BINS - 1)]++; }
    const mx = Math.max(...Hi, ...Hv);
    const hb = []; for (let i = 0; i < BINS; i++) { const x = -12 + i * 0.6; const a = block(0.26, 1, 0.5, COL.tok, [x - 0.14, 0, -3], { edges: false }), b = block(0.26, 1, 0.5, COL.video, [x + 0.14, 0, -3], { edges: false }); G.add(a, b); hb.push({ a, b, ha: Hi[i] / mx * 5, hv: Hv[i] / mx * 5 }); }
    G.add(lab('ln σ 从 −4 到 5：图像批（绿）· 视频批 × √16 = × 4（蓝）', [-5, 6.6, -3], { size: 15 }));
    /* lambda(σ) weight curve on the right */
    const sd = 0.5, lam = s => (s * s + sd * sd) / Math.pow(s * sd, 2);
    const curve = []; for (let i = 0; i <= 40; i++) { const ls = lo + (hi - lo) * i / 40, s = Math.exp(ls); curve.push([5 + i * 0.3, 0.2 + Math.min(7, Math.log10(lam(s)) * 1.4), -3]); }
    G.add(L.tube(curve, COL.gold, 0.07)); G.add(lab('log₁₀ λ(σ)，σ_data = 0.5', [11, 7.2, -3], { size: 14 }));
    const dot = block(0.4, 0.4, 0.4, COL.gold, [5, 1, -3]); G.add(dot);
    let last = -1, ring = [];
    function rebuild() { clearSub(sub); ring = []; last = v; const nc = [0, 1, 2][v];
      for (let i = 0; i < nc; i++) { const r = block(1.5, 1.5, 0.15, COL.gold, [X(i), 0.8, 4.7], { opacity: 0.5 }); sub.add(r); ring.push(r); }
      sub.add(lab(v === 0 ? 'Text2World：全部隐帧都去噪' : `条件 ${nc} 个隐帧（${nc === 1 ? '1 帧图像' : '9 帧视频'}）+ 掩码通道`, [X(7.5), 3.0, 5.2], { size: 15, border: v ? hexs(COL.gold) : undefined }));
    }
    rebuild();
    return { ctls: [{ label: '模式', items: ['Text2World', 'V2W：1 帧条件', 'V2W：9 帧条件'], get: () => v, set: k => { v = k; } }], update(p) {
      if (last !== v) rebuild();
      const g = seg(p, 0, 0.25); hb.forEach(({ a, b, ha, hv }) => { const A = Math.max(0.02, ha * g), B = Math.max(0.02, hv * g); a.scale.y = A; a.position.y = A / 2; b.scale.y = B; b.position.y = B / 2; });
      const idx = Math.floor(seg(p, 0.1, 0.95) * 11.999), ls = sm[idx * 37 % 3000] + Math.log(4), s = Math.exp(ls), nc = [0, 1, 2][v];
      const t = clamp((ls - lo) / (hi - lo), 0, 1); dot.position.set(5 + t * 12, 0.2 + Math.min(7, Math.log10(lam(s)) * 1.4), -3);
      const aug = Math.exp(-3 + 2 * sm[(idx * 53 + 7) % 3000]);
      const noisy = clamp(t * 1.2, 0, 1);
      cubes.forEach((b, i) => { const cond = i < nc; const c = cond ? hex3(COL.tok) : mix(hex3(COL.tok), hex3(COL.noise), noisy); b.material.color.setRGB(c[0], c[1], c[2]); b.material.emissive.setRGB(0, 0, 0); });
      cap(`视频批采样 ln σ = <b>${ls.toFixed(2)}</b>（σ = ${s.toFixed(2)}）· λ(σ) = ${lam(s).toFixed(2)} · 损失只算${nc ? ` ${NL - nc} 个生成隐帧` : '全部 16 个隐帧'}` + (nc ? ` · 条件帧增强噪声 σ = ${aug.toFixed(3)}（ln σ ~ N(−3, 2²)）` : '') + ' · 总损失再乘 e^{−u(σ)} 并加 u(σ)');
    } };
  }

  /* ---------- scene 7: autoregressive + Medusa ---------- */
  function s7(G) {
    let v = +(OPT[0] ?? 3); G.add(L.grid(44, 22));
    const NL = 5, GH = 5, GW = 8, N = NL * GH * GW, cells = inst(BOX, N); G.add(cells);
    const pos = i => { const l = Math.floor(i / (GH * GW)), r = Math.floor((i % (GH * GW)) / GW), c = i % GW; return [-13 + l * 5.6 + c * 0.6, 6.6 - r * 0.6, 0]; };
    for (let l = 0; l < NL; l++) G.add(lab(l === 0 ? '隐帧 0（条件）' : `隐帧 ${l}`, [-13 + l * 5.6 + 2.1, 7.8, 0], { size: 14 }));
    const MED = [{ h: 0, thr: 444.95, fp: 7680 }, { h: 3, thr: 663.51, fp: 2860 }, { h: 6, thr: 829.59, fp: 2073 }, { h: 9, thr: 894.67, fp: 1812 }, { h: 12, thr: 890.64, fp: 1682 }];
    const heads = []; for (let i = 0; i < 12; i++) { const b = block(0.9, 0.5, 0.9, COL.ar, [-6 + i * 1.1, 1.6, 0], { opacity: 0.9 }); G.add(b); heads.push(b); }
    const body = block(12, 1.0, 1.6, COL.dit, [0, 0.4, 0], { opacity: 0.85 }); G.add(body); G.add(lab('Transformer 主干（冻结，只解冻最后 2 层和输出层）', [0, -0.8, 1.2], { size: 14 }));
    const hl = lab('Medusa 头', [9.2, 1.6, 0], { size: 14 }); G.add(hl);
    for (let i = 0; i < N; i++) colI(cells, i, hex3(COL.dim));
    return { ctls: [{ label: 'Medusa 头数', items: MED.map(m => String(m.h)), get: () => v, set: k => { v = k; } }], update(p) {
      const m = MED[v], per = 7680 / m.fp, ncond = GH * GW, gen = N - ncond;
      const steps = Math.ceil(gen / per), k = Math.floor(seg(p, 0.05, 0.92) * steps), shown = Math.min(gen, Math.round(k * per));
      for (let i = 0; i < N; i++) { const isC = i < ncond, on = isC || i - ncond < shown, fresh = !isC && i - ncond >= Math.round((k - 1) * per) && i - ncond < shown;
        setI(cells, i, pos(i), on ? 0.5 : 0.28); colI(cells, i, hex3(isC ? COL.gold : fresh ? 0xffffff : on ? COL.disc : COL.dim)); }
      done(cells);
      heads.forEach((b, i) => { b.visible = i < m.h; glow(b, i < m.h && (k % 2 === 0) ? 0.6 : 0.1); }); hl.visible = m.h > 0;
      cap(`${m.h} 个 Medusa 头 · 4B 表 15：吞吐 <b>${m.thr}</b> token/s（${(m.thr / 444.95).toFixed(2)} 倍）· 前向 ${fmt(m.fp)} 次，平均每次 <b>${per.toFixed(2)}</b> 个 token · 第 ${Math.min(k, steps)} / ${steps} 次前向（缩小网格）`);
    } };
  }

  /* ---------- scene 8: diffusion decoder ---------- */
  function s8(G) {
    let v = +(OPT[0] ?? 0); G.add(L.grid(48, 24)); const sub = new THREE.Group(); G.add(sub);
    const dg = inst(BOX, 16), cg = inst(BOX, 64), ug = inst(BOX, 64); G.add(dg, cg, ug);
    const den = block(4.2, 3.2, 2.2, COL.dit, [4.5, 4.2, 0], { opacity: 0.92 }); G.add(den); G.add(lab('去噪器（7B-Text2World 微调）', [4.5, 6.6, 0], { size: 16 }));
    const dec = block(2.6, 2.6, 2.0, COL.tok, [11.5, 4.2, 0], { opacity: 0.92 }); G.add(dec); G.add(lab('CV8×8×8 解码', [11.5, 6.3, 0], { size: 15 }));
    const out = block(2.6, 2.0, 0.3, COL.video, [16, 4.2, 0], { opacity: 0.95 }); G.add(out); G.add(lab('RGB 视频', [16, 6.0, 0], { size: 15 }));
    G.add(lab('离散 token（16 倍下采样）', [-13, -0.4, 1.4], { size: 15 })); G.add(lab('嵌入 16 维 · 上采样 × 2', [-5, -0.4, 1.4], { size: 15 }));
    const pl = stream(G, 10, COL.gold, 0.12);
    let last = -1;
    function rebuild() { clearSub(sub); last = v; sub.add(lab(v === 0 ? '上路：真视频 → CV8×8×8 编码 + 噪声' : '上路：纯噪声开始，反复迭代', [-9, 9.2, 0], { size: 16, border: hexs(v ? COL.noise : COL.tok) }));
      sub.add(lab(v === 0 ? '下路：真视频 → DV8×16×16 编码' : '下路：自回归模型输出的离散 token', [-9, 7.9, 0], { size: 15 })); }
    rebuild();
    return { ctls: [{ label: '阶段', items: ['训练（图 15）', '推理（图 16）'], get: () => v, set: k => { v = k; } }], update(p) {
      if (last !== v) rebuild();
      const g = seg(p, 0.1, 0.45), nz = v === 0 ? 0.55 : 1 - seg(p, 0.45, 0.9);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const i = r * 4 + c; setI(dg, i, [-14.5 + c * 1.0, 0.8 + r * 1.0, 0], 0.9); colI(dg, i, hex3(((r * 3 + c) % 3) ? COL.disc : 0xc77f3a)); }
      done(dg);
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const i = r * 8 + c, src = Math.floor(r / 2) * 4 + Math.floor(c / 2);
        setI(ug, i, [L.lerp(-14.5 + Math.floor(c / 2) * 1.0, -6.8 + c * 0.5, g), L.lerp(0.8 + Math.floor(r / 2) * 1.0, 0.6 + r * 0.5, g), 0], 0.45); colI(ug, i, hex3(((Math.floor(r / 2) * 3 + Math.floor(c / 2)) % 3) ? COL.disc : 0xc77f3a));
        const base = hex3(COL.tok), cc = mix(base, hex3(COL.noise), nz); setI(cg, i, [-6.8 + c * 0.5, 4.6 + r * 0.5, 0], 0.45); colI(cg, i, cc); }
      done(ug); done(cg);
      pl([[-4.5, 2.4, 0.8], [2.4, 3.6, 0.8], [6.6, 4.2, 0.8], [11.5, 4.2, 0.8], [16, 4.2, 0.8]], (p * 1.5) % 1, 1);
      glow(den, 0.2 + 0.4 * ((p * 6) % 1 < 0.5 ? 1 : 0)); glow(out, seg(p, 0.85, 1));
      cap(v === 0 ? '训练：离散 token 嵌入成 16 维、上采样 2 倍，和<b>加噪的</b>连续 token 在通道维拼接；去噪器学会利用这个不加噪的条件' : `推理：连续隐变量从纯噪声开始（当前噪声比例 <b>${nz.toFixed(2)}</b>），条件是自回归模型的输出；DV 的 16 倍格子 × 2 = CV 的 8 倍格子`);
    } };
  }

  /* ---------- scene 9: post-training ---------- */
  function s9(G) {
    let v = +(OPT[0] ?? 0); G.add(L.grid(48, 24)); const sub = new THREE.Group(); G.add(sub);
    let last = -1, upd = () => {};
    function rebuild() {
      clearSub(sub); last = v;
      if (v === 0) {
        const pts = []; for (let i = 0; i <= 56; i++) { const t = i / 56; pts.push([-12 + t * 20, 2.5 + Math.sin(t * 3) * 1.2, -Math.sin(t * 2.2) * 4]); }
        sub.add(L.line(pts, COL.cam, { opacity: 0.7 }));
        const fr = []; for (let j = 0; j < 8; j++) { const i = j === 0 ? 0 : 4 + (j - 1) * 8; const c = L.cyl(0, 0.7, 1.0, j === 0 ? COL.gold : COL.cam, { seg: 4 }); c.position.set(...pts[Math.min(56, i)]); c.rotation.z = Math.PI / 2; sub.add(c); fr.push(c); }
        const rays = []; for (let k = 0; k < 9; k++) { const l = L.line([[0, 0, 0], [1, 0, 0]], COL.gold, { opacity: 0.7 }); sub.add(l); rays.push(l); }
        sub.add(lab('每个隐帧取第 4 帧的相机（共 8 个）', [-2, 8.4, 0], { size: 16 })); sub.add(lab('Plücker 射线 r = (d, c × d) ∈ ℝ⁶，每个隐变量像素一条', [-2, 7.0, 0], { size: 15, border: hexs(COL.gold) }));
        upd = p => { const j = Math.floor(seg(p, 0.05, 0.9) * 7.999), c = fr[j].position; fr.forEach((f, i) => { f.material.emissive.setHex(i === j ? 0x664400 : 0x000000); });
          rays.forEach((l, k) => { const a = (k % 3 - 1) * 0.35, b = (Math.floor(k / 3) - 1) * 0.35, e = [c.x + 6, c.y + a * 6, c.z + b * 6]; l.geometry.setFromPoints([new THREE.Vector3(c.x, c.y, c.z), new THREE.Vector3(...e)]); });
          cap(`隐帧 ${j}：相机中心 c 和单位方向 d → 6 维 Plücker 嵌入，和 16 通道隐变量拼接 · 57 帧 → 8 个隐帧 · 训练 704 × 1252 反射填充到 704 × 1280`); };
      } else if (v === 1) {
        const nm = ['Δx', 'Δy', 'Δz', 'Δθr', 'Δθp', 'Δθy', 'Δ夹爪'], B = nm.map((t, i) => { const b = block(0.9, 1, 0.9, COL.act, [-15 + i * 1.75, 0.5, 0], { edges: false }); sub.add(b); sub.add(lab(t, [-15 + i * 1.75, -0.8 - (i % 2) * 1.0, 0.8], { size: 13 })); return b; });
        const mlp = block(2.4, 2.0, 1.6, COL.act, [-1.5, 3.0, 0], { opacity: 0.9 }); sub.add(mlp); sub.add(lab('MLP（7 → 4d → d）', [-1.5, 4.6, 0], { size: 15 }));
        const te = block(3.0, 1.0, 1.4, COL.time, [5.5, 6.2, 0], { opacity: 0.9 }); sub.add(te); sub.add(lab('时间步嵌入 + 动作嵌入', [5.5, 7.4, 0], { size: 15 }));
        const lo = block(3.0, 1.0, 1.4, COL.ok, [5.5, 3.0, 0], { opacity: 0.9 }); sub.add(lo); sub.add(lab('AdaLN-LoRA + 动作（只在代码里）', [5.5, 1.8, 1.0], { size: 14, border: hexs(COL.ok) }));
        const dit = block(3.6, 5.0, 2.0, COL.dit, [12, 4.4, 0], { opacity: 0.9 }); sub.add(dit); sub.add(lab('7B DiT', [12, 7.5, 0], { size: 16 }));
        sub.add(lab('Bridge：当前帧 + 7 维动作 → 下一帧（5 FPS，320 × 256）', [0, 10.0, 0], { size: 16 }));
        const fl = stream(sub, 8, COL.act, 0.12);
        upd = p => { const r = L.rng(3 + Math.floor(p * 6)); B.forEach(b => { const h = 0.3 + r() * 2.2; b.scale.y = h; b.position.y = h / 2; }); fl([[-5, 1.5, 0.8], [-1.5, 3.0, 0.8], [4, 6.2, 0.8], [10.2, 5.6, 0.8]], (p * 2) % 1, 1);
          cap(`动作每一步一个 7 维向量（第 ${Math.floor(p * 6) + 1} 步，数值示意）→ MLP → 加到时间步嵌入（论文）· 代码另有一个 MLP 输出 3d 加到 AdaLN-LoRA · 一次生成 1 帧再喂回去`); };
      } else {
        const V = [['前', 0, 6], ['左', -7, 2], ['右', 7, 2], ['后', 0, -6], ['左后', -7, -3], ['右后', 7, -3]];
        const car = block(2.0, 1.2, 3.6, COL.white, [0, 0.6, 0]); sub.add(car);
        const P = V.map(([t, x, z]) => { const b = block(4.4, 2.6, 0.2, COL.video, [x, 2.6, z], { opacity: 0.85 }); b.lookAt(0, 2.6, 0); sub.add(b); sub.add(lab(t + '：' + '“相机朝' + t + '…”', [x, 4.6, z], { size: 14 })); return b; });
        sub.add(lab('6 路一起去噪（全部互相自注意力）· 视角嵌入 · 每路交叉注意力只读自己的描述', [0, 9.4, 0], { size: 15, border: hexs(COL.video) }));
        const traj = []; for (let i = 0; i < 64; i++) traj.push([Math.sin(i / 64 * 1.4) * 4, 0.15, 2 + i * 0.12]); const tl = L.line(traj, COL.gold, { opacity: 0.9 }); sub.add(tl); sub.add(lab('轨迹：64 点 × 0.1 s', [4.5, 0.6, 9.5], { size: 14 }));
        upd = p => { const k = Math.floor(seg(p, 0.05, 0.9) * 5.999); P.forEach((b, i) => glow(b, i === k ? 0.7 : 0.08));
          cap(`当前高亮：${V[k][0]}视角 · 6 路 × 57 帧 × 848 × 480 · 位置编码每路各自一份，视角差别只靠视角嵌入（代码 view_condition_dim = 6）· 可选轨迹条件 64 点 = 6.4 s`); };
      }
    }
    rebuild();
    return { ctls: [{ label: '后训练', items: ['相机控制', '机器人动作', '六路驾驶'], get: () => v, set: k => { v = k; } }], update(p) { if (last !== v) rebuild(); upd(p); } };
  }

  /* ---------- scene 10: guardrails ---------- */
  function s10(G) {
    let v = +(OPT[0] ?? 0); G.add(L.grid(50, 25));
    const st = [['关键词表', -13, COL.guard], ['Aegis', -7.5, COL.guard], ['WFM 生成', -1, COL.dit], ['逐帧安全分类', 6, COL.guard], ['人脸打码', 12.5, COL.guard]];
    const B = st.map(([t, x, c]) => { const b = block(3.6, 2.6, 2.0, c, [x, 1.3, 0], { opacity: 0.9 }); G.add(b); G.add(lab(t, [x, 3.4, 0], { size: 16 })); return b; });
    G.add(lab('pre-Guard（文字）', [-10.2, 5.2, 0], { size: 16, border: hexs(COL.guard) })); G.add(lab('post-Guard（画面）', [9.2, 5.2, 0], { size: 16, border: hexs(COL.guard) }));
    const frames = []; for (let i = 0; i < 8; i++) { const f = block(1.2, 0.9, 0.12, COL.video, [2.6 + i * 1.4, 0.6, 4.0]); G.add(f); frames.push(f); }
    G.add(lab('生成的帧', [7.5, -0.4, 4.6], { size: 14 }));
    const tok = block(1.0, 1.0, 1.0, COL.text, [-17, 1.3, 0]); G.add(tok);
    const EX = ['正常提示：一路通过', '命中关键词：第一关拒绝', '第 5 帧被判不安全：整段拦下'];
    return { ctls: [{ label: '示例', items: EX.map(e => e.split('：')[0]), get: () => v, set: k => { v = k; } }], update(p) {
      const stopAt = v === 1 ? -13 : 99, x = Math.min(stopAt, -17 + seg(p, 0.02, 0.5) * 31);
      tok.position.x = x; tok.material.color.setHex(v === 1 && x >= -13 ? COL.bad : COL.text);
      B.forEach((b, i) => glow(b, Math.abs(st[i][1] - x) < 2.4 ? 0.8 : 0.05));
      const gen = v !== 1 && p > 0.5, k = Math.floor(seg(p, 0.5, 0.95) * 8.999);
      frames.forEach((f, i) => { f.visible = gen && i < k; const bad = v === 2 && i === 4; f.material.color.setHex(bad ? COL.bad : COL.video); });
      const blocked = (v === 1 && x >= -13) || (v === 2 && k > 4);
      cap(`${EX[v]} · ` + (blocked ? '<b>拦下，不输出</b>' : p > 0.95 ? '<b>通过</b>：大于 20 × 20 像素的脸打马赛克后输出' : '检查中…') + ' · 分类器：每帧 SigLIP（1152 维）+ MLP，代码里 7 类');
    } };
  }

  /* ---------- scene 11: results ---------- */
  function s11(G) {
    let view = +(OPT[0] ?? 0); G.add(L.grid(36, 36)); const sub = new THREE.Group(); G.add(sub);
    const T = [
      { t: '表 19 · 位姿估计成功率（%）', g: ['VideoLDM', '7B-T2W', '7B-V2W', '4B', '5B-V2W', '真实视频'], v: [4.4, 62.6, 68.4, 35.6, 27.0, 56.4], lo: 0, hi: 75, c: COL.dit },
      { t: '表 20 · 物理对齐，9 帧条件的平均 IoU', g: ['7B-V2W', '14B-V2W', '4B', '5B-V2W', '12B', '13B-V2W'], v: [0.592, 0.598, 0.481, 0.481, 0.487, 0.482], lo: 0, hi: 0.7, c: COL.tok },
      { t: '表 22 · 相机控制：位姿估计成功率（%）', g: ['CamCo', 'Cosmos CameraCond'], v: [43.0, 82.0], lo: 0, hi: 90, c: COL.cam },
      { t: '表 23 · Bridge 动作条件 FVD（越低越好）', g: ['IRASim', 'Cosmos 5B', 'Cosmos 7B'], v: [593, 434, 190], lo: 0, hi: 650, c: COL.act },
      { t: '表 24 · 跨视角 Sampson 误差 CSE（越低越好）', g: ['VideoLDM-MV', 'Cosmos MV', 'MV-轨迹', '真实视频'], v: [6.48, 2.11, 2.02, 1.71], lo: 0, hi: 7, c: COL.video }
    ];
    let bars = [], last = -1;
    function rebuild() {
      clearSub(sub); bars = []; last = view; const v = T[view], n = v.g.length, gw = Math.min(4.6, 26 / n);
      v.g.forEach((nm, i) => { const x = (i - (n - 1) / 2) * gw, b = block(Math.min(2.2, gw * 0.6), 1, 1.4, nm.includes('真实') ? COL.gold : v.c, [x, 0.5, 0], { edges: false }); sub.add(b);
        const l = lab(String(v.v[i]), [x, 0, 0], { size: 15 }); sub.add(l); sub.add(lab(nm, [x, -0.6 - (n > 4 ? (i % 2) * 1.0 : 0), 2.0], { size: 15 })); bars.push({ b, l, val: v.v[i] }); });
      sub.add(lab(v.t, [0, 9.4, 0], { size: 18, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const MSG = ['扩散 7B 的成功率高过真实视频（68.4 / 62.6 对 56.4）；自回归 4B、5B 只有 35.6 和 27.0', '4B 到 14B 的 IoU 只在 0.48–0.60 之间：扩散两档 0.592 / 0.598，自回归四档 0.481–0.487，模型变大没有更好', '训练在 DL3DV-10K、测试在 RealEstate10K；旋转误差 1.646° 对 8.277°', 'FVD 593 → 434 → 190；PSNR 19.13 / 19.95 / 21.14', 'Cosmos 2.11 离真实视频 1.71 不远，VideoLDM 6.48；加轨迹条件后 2.02'];
    return { ctls: [{ label: '表', items: ['3D 一致性', '物理对齐', '相机控制', '机器人动作', '驾驶多视角'], get: () => view, set: k => { view = k; } }], update(p) {
      if (last !== view) rebuild();
      const { lo, hi } = T[view], g = seg(p, 0, 0.5);
      bars.forEach(({ b, l, val }) => { const h = Math.max(0.02, (val - lo) / (hi - lo) * 7.5 * g); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.5; });
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
  window.__cosmosDebug = { get cap() { return $('cap').textContent; } };
})();
