'use strict';
/* Cosmos-Predict2.5 / Transfer2.5 (arXiv 2511.00062) taken apart into eleven animated scenes. Dimensions come from the
   paper, the official code (cosmos-predict2.5 a2c298b, cosmos-transfer2.5 2ff49d0) and the Hugging Face file sizes.
   Each scene's update(p) is a pure function of the timeline p plus the current toggles. Scenes 3, 4, 5, 6, 10 compute
   their numbers live from the formulas; scene 6 samples a fixed-seed toy set. No Cosmos network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { video: 0x3aa8e0, vae: 0x4fc98a, dit: 0x7c8cff, text: 0x9d8cff, time: 0xf2c14e, attn: 0xd45fa0, ffn: 0x38d1ff, norm: 0x6b7794, noise: 0x8e9bb8, ctrl: 0xf0963c, zero: 0x46506a, ok: 0x4fc98a, bad: 0xe05d5d, gold: 0xf2c14e, act: 0xf0963c, cam: 0x38d1ff, white: 0xeef2fa, frozen: 0x56607a };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const hexs = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const live = t => `<p class="guess"><b>现算 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const shiftF = (t, b) => b * t / (1 + (b - 1) * t);
  /* MiniTrainDIT parameter count, term by term from minimal_v4_dit.py (AdaLN-LoRA 256, context 1024, Reason1 projection) */
  function cosmosParams(d, Lr) {
    const blk = 4 * d * d + 256 + (d * d + 2 * 1024 * d + d * d + 256) + 8 * d * d + 3 * (d * 256 + 256 * 3 * d);
    const tot = Lr * blk + 18 * 4 * d + (d * d + 3 * d * d + d) + (d * 64 + d * 256 + 256 * 2 * d) + (100352 * 1024 + 1024);
    return { blk, tot };
  }
  const CKPT = { '2B': 4118575006 / 2, '14B': 28736391006 / 2 };

  const SCENES = [
    { n: 1, part: '总览', title: '三件套：Wan2.1 VAE、Reason1、DiT', sub: '点方块跳到对应那一幕', dur: 12, cam: [0.0, 1.12, 38, [0, 3.0, 0]],
      html: dl([['VAE', 'Wan2.1 VAE（直接拿来用），4 × 8 × 8，16 通道'], ['文本', 'Cosmos-Reason1-7B，28 层拼接 → 1024 维'], ['DiT', 'patch 1 × 2 × 2；2B：28 层 × 2048；14B：36 层 × 5120'], ['训练', '流匹配，预测 v = ε − x；shift 5'], ['三种模式', 'Text2World、Image2World、Video2World 同一个模型']]) +
        '<p>视频经 VAE 压到隐空间，patch 化成 token；DiT 每一块里做自注意力、对文本的交叉注意力和 FFN，三段都由时间嵌入经 AdaLN-LoRA 调制；输出反 patch 后由 VAE 解码。条件图像或视频直接替换开头的隐帧（第 7 幕）。</p>' + src('§3.2 · 图 2 · 表 3 · configs/video2world/defaults/net.py') },
    { n: 2, part: '§2 数据', title: '60 亿段里留下 2 亿段', sub: '切换：预训练漏斗 / 后训练领域 / 机器人数据', dur: 12, cam: [0.0, 1.12, 40, [0, 4.0, 0]],
      html: dl([['原始', '3,500 万小时视频（Predict1 是 2,000 万）'], ['切分', '按镜头切，丢掉 5 秒以下，得 60 多亿段 5–60 秒片段'], ['过滤', '美学 → 运动 → OCR → 感知质量 → 语义瑕疵 → VLM → 内容类型'], ['留下', '约 2 亿段（论文说约 4%，按数算 ≤ 3.3%）'], ['描述', 'Qwen2.5-VL-7B，每 5 秒一个窗口，短中长三种']]) +
        '<p>表 5 的后训练领域数据和表 2 的机器人数据可以用左上角切换。</p>' + guess('漏斗柱高按对数画；圆环只表示过滤器顺序，每一步去掉多少原文没给。') + src('§2.1 · §2.2 · 图 1 · 表 2 · 表 5') },
    { n: 3, part: '§3.2 VAE 和 patch', title: '93 帧 → 24 个隐帧 → token', sub: '切换分辨率阶段，看 token 数', dur: 13, cam: [0.0, 1.12, 40, [0, 2.6, 0]],
      html: dl([['时间', '首帧单独，之后每 4 帧一个隐帧：1 + 92/4 = 24'], ['空间', 'VAE 8 倍，patch 再 2 倍：一个 token 覆盖 16 × 16 像素'], ['通道', '16 个隐通道 + 条件掩码 1 + padding 掩码 1 = 18；× 2 × 2 = 72 → 线性层到宽度'], ['阶段', '表 4：256p（320 × 192）→ 480p（832 × 480）→ 720p（1280 × 704）']]) +
        '<p>上排是 93 个像素帧，按“1 帧 + 23 组 × 4 帧”分组；中排是 24 个隐帧；右边是一个隐帧切成的 token 网格。</p>' +
        live('token 数 = 24 × (H/16) × (W/16)：256p 5,760，480p 37,440，720p 84,480。') + guess('只画一个隐帧的网格。') + src('§3.2 · 表 4 · minimal_v1_lvg_dit.py · minimal_v4_dit.py build_patch_embed') },
    { n: 4, part: '§3.2 文本编码', title: 'Reason1 的 28 层全拼起来，再压到 1024', sub: '切换：全部 28 层（代码）/ 只取一层（对比）', dur: 13, cam: [0.0, 1.12, 40, [-1.5, 4.6, 0]],
      html: dl([['模型', 'Cosmos-Reason1(.1)-7B，Qwen2.5-VL-7B 结构，28 层，宽 3584，冻结'], ['输入', '系统提示 + 用户提示，补齐 / 截断到 512 token'], ['拼接', 'hidden_states[1:] 的 28 层，每层每 token 做 (h − μ)/σ，沿通道拼：28 × 3584 = 100,352'], ['投影', 'Linear(100,352 → 1024) + GELU，属于 DiT，随 DiT 训练'], ['使用', '1024 维 × 512 token，进每一块的交叉注意力']]) +
        '<p>左边一列是 Reason1 的 28 层；每层的输出（归一化后）依次接到右边的长条上，长条走完就是 100,352 维；再经投影压成 1024 维。</p>' +
        live('投影层参数 = 100,352 × 1024 + 1024 = 102,761,472，占 2B 总数的 5.0%。') + guess('每段画成等长；512 个 token 没有逐个画。') + src('§3.2 · 图 2 · text_encoders/text_encoder.py · minimal_v4_dit.py crossattn_proj') },
    { n: 5, part: '§3.2 DiT 块', title: '一个块，三组 AdaLN-LoRA；28 层还是 32 层', sub: '切换尺寸，当场算参数量并和权重文件对照', dur: 14, cam: [0.18, 1.3, 40, [0, 6.0, 0]],
      html: dl([['自注意力', 'LN（无仿射）→ x(1 + scale) + shift → 注意力（q/k RMSNorm，3D RoPE）→ × gate'], ['交叉注意力', '同样受调制，读 Reason1 的 1024 维 × 512'], ['FFN', 'GELU，宽 4d（2B 8192）'], ['调制', '每段一个 LoRA：d → 256 → 3d，加上共享时间 MLP 的 3d 偏置'], ['位置', '只有 3D RoPE，头维 128 = 高 42 + 宽 42 + 时间 44']]) +
        '<p>左边一列是 N 个块；中间是展开的一个块，三段各有自己的 LoRA 调制（金色）；右边是时间嵌入。表 3 写 2B 是 32 层，代码和权重文件都是 28 层：28 层的算数和文件大小只差 11 万，32 层差 2.8 亿。</p>' +
        live('每块 14d² + 5120d + 512；总数加 patch 嵌入、时间 MLP、输出层和 1.03 亿的文本投影。') + src('§3.2 · 表 3 · minimal_v4_dit.py Block · HF 文件大小') },
    { n: 6, part: '§3.1 流匹配', title: '直线插值，预测速度；shift 把 t 推向噪声', sub: '切换 β 和高噪声补丁；下方是现抽的 t 分布', dur: 13, cam: [0.0, 1.15, 36, [0, 4.0, 0]],
      html: dl([['式 (1)', 'x_t = (1 − t)x + tε（t = 0 是数据，t = 1 是噪声）'], ['式 (2)', 'v = ε − x'], ['式 (3)', 'L = E‖u(x_t, t, c) − v‖²'], ['式 (4)', 't_s = βt / (1 + (β − 1)t)；256p 时 β = 1，720p 时 β = 5'], ['补丁', '5% 的样本从噪声最高的 2% 里抽（4.1 节）']]) +
        '<p>上方：一个“数据”点沿直线走向“噪声”点，箭头是速度 ε − x，处处相同。下方：t 的训练分布。logit-normal 本来集中在中间；β = 5 后中位数从 0.5 移到 0.833，但 t_s ≥ 0.98 仍只有约 1%，所以作者额外补了 5%。</p>' +
        live('直方图是 2,000 个固定种子样本：t = sigmoid(N(0, 1))，再按 β 变换。') + guess('上方的点是二维玩具。公开代码里高噪声补丁的分支会报错，发布配置没打开（精读页读者注 3）。') + src('§3.1 式 (1)–(4) · §4.1 · schedulers/rectified_flow.py') },
    { n: 7, part: '§4.1 条件', title: '帧替换：条件帧直接放在开头', sub: '切换 Text2World / Image2World / Video2World', dur: 13, cam: [0.0, 1.12, 36, [0, 2.2, 0]],
      html: dl([['T2W', '0 个条件隐帧，概率 0.5'], ['I2W', '1 个条件隐帧 = 1 个像素帧，概率 0.25'], ['V2W', '2 个条件隐帧 = 1 + 4 = 5 个像素帧，概率 0.25'], ['掩码', '每个 token 再拼一个通道：条件 1，其余 0'], ['损失', '条件帧位置的输出换成真值速度，误差恒为 0']]) +
        '<p>一排方块是 24 个隐帧。绿色的是条件帧（干净，掩码 = 1），其余从噪声逐步去噪。条件帧上方的红叉表示这些位置不产生损失。三种模式用同一套权重。</p>' +
        guess('去噪的颜色过渡是示意。') + src('§3.2 · §4.1 · video2world_model_rectified_flow.py denoise()') },
    { n: 8, part: '§4.2 后训练', title: '分领域 SFT → 合并 → RL → 蒸馏', sub: '光点沿流程走；右边是 RL 的 8 条轨迹', dur: 15, cam: [0.0, 1.12, 46, [-2.5, 3.4, 0]],
      html: dl([['SFT', '物体恒存 10.4M、高运动 1.0M、复杂场景 1.6M、驾驶 3.1M、机器人 730K 各训一个模型；3 万步，batch 256'], ['冷却', '388K 段 4K 视频，学习率线性降到 0'], ['合并', 'model soup / TIES / DARE-Linear / DARE-TIES，扫出 20 多个候选，选 model soup'], ['RL', 'VideoAlign 奖励，每个条件 8 个样本 × 20 步，组内归一化优势；每两步算一次梯度；256 步，batch 32'], ['蒸馏', 'rCM，4 步，质量和教师相当']]) +
        '<p>表 6：RL 后 T2W 奖励和从 1.23 升到 1.74（合并模型）。发布的 post-trained 权重是合并模型做完 RL 后的 EMA；代码登记的是 GRPO 第 288 步。</p>' +
        guess('RL 轨迹是 8 条示意折线。') + src('§4.2.1–4.2.3 · 表 5 · 表 6 · 图 3–5 · checkpoints_predict2.py') },
    { n: 9, part: '§6.1 Transfer2.5', title: '每 7 块插一个控制块', sub: '切换结构；右边是图 10 的长视频曲线', dur: 14, cam: [0.0, 1.12, 48, [-1.0, 6.0, 0]],
      html: dl([['控制输入', '边缘、模糊、分割、深度；多模态时各占 0.25'], ['控制块', 'DiT 块 + 两个零初始化线性层，输出加回主干对应块'], ['位置', 'Transfer2.5：[0, 7, 14, 21]；Transfer1-7B：开头连续 4 个'], ['训练', '每种模态单独训 10 万步，有效 batch 64'], ['长视频', 'RNDS = (DOVER / DOVER_GT) 按第 1 段归一化']]) +
        '<p>左边是 28 个主干块，旁边橙色是控制分支；光点表示控制信号注入的位置。右边是图 10 的 RNDS 曲线（蓝 Transfer1-7B，绿 Transfer2.5-2B），可切换四种控制。</p>' +
        guess('“Transfer1 式”的位置按原文一句话画；曲线是从矢量图读出的数（重画）。') + src('§6.1 · §6.1.2 式 (5) · 图 10 · 表 12 · minimal_v4_lvg_dit_control_vace.py') },
    { n: 10, part: '§6.3–6.6 领域后训练', title: '驾驶 7 视角、相机控制、动作条件', sub: '切换三种扩展', dur: 14, cam: [0.0, 1.12, 42, [0, 3.0, 0]],
      html: dl([['驾驶多视角', '7 视角沿时间维拼接，每视角 29 帧 → 8 隐帧，共 56 个隐帧；通道拼 7 维视角嵌入；RoPE 按视角分别构造'], ['相机控制', '源视频和目标视频沿时间拼接；目标相机的 Plücker 射线图经投影加到视频 token；只训自注意力和投影层'], ['动作条件', '每个隐帧对应 4 个 7 维动作 = 28 维，经两个 MLP 加到时间嵌入和 AdaLN-LoRA；条件帧那一格补零']]) +
        live('驾驶：56 × 44 × 80 = 197,120 个 token；动作 MLP 参数 67,592,192，和权重文件差 67,593,460 对上。') + guess('方块排布是示意。') + src('§6.3.1 · §6.4 · §6.6 · action_conditioned_minimal_v1_lvg_dit.py') },
    { n: 11, part: '结果', title: '结果', sub: '切换表格；每根柱子是原文数字', dur: 12, cam: [0.0, 1.08, 36, [0, 3.8, 0]],
      html: dl([['PAI-Bench T2W', '2B 后训练 0.768，Wan2.2-27B-A14B 0.769'], ['PAI-Bench I2W', '2B、14B 后训练 0.810，并列最高'], ['真机', 'Transfer2.5 增强 24/30，常规增强 5/30'], ['OpenWAM 骨干', 'Cosmos-Predict2.5-2B 91.64，Wan2.2-TI2V-5B 92.39']]) +
        '<p>最后一张是 OpenWAM §4.1.1 在 RoboTwin 2.0 上比较的四个视频骨干。Cosmos 2B 比 TI2V-5B 低 0.75 点，参数是它的 41%。</p>' + src('表 10 · 表 11 · 表 13 · OpenWAM 图 6') }
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
    G.add(L.grid(44, 22));
    const parts = [
      { nm: 'Cosmos-Reason1-7B\n文本 → 28 层拼接', c: COL.text, pos: [-12, 7.2, 0], sz: [5.2, 2.2, 2], go: 3 },
      { nm: '投影 → 1024', c: COL.text, pos: [-5.2, 7.2, 0], sz: [3.0, 1.2, 1.4], go: 3 },
      { nm: 'Wan2.1 VAE 编码\n4 × 8 × 8，16 通道', c: COL.vae, pos: [-12, 1.6, 0], sz: [5.2, 2.2, 2], go: 2 },
      { nm: 'patch 1 × 2 × 2', c: COL.vae, pos: [-5.2, 1.6, 0], sz: [3.0, 1.2, 1.4], go: 2 },
      { nm: 'DiT（2B：28 × 2048）', c: COL.dit, pos: [1.8, 4.4, 0], sz: [4.0, 8.0, 3], go: 4 },
      { nm: '时间 t → AdaLN-LoRA', c: COL.time, pos: [1.8, 10.4, 0], sz: [4.0, 1.2, 1.6], go: 5 },
      { nm: 'VAE 解码', c: COL.vae, pos: [9.6, 4.4, 0], sz: [3.6, 2.2, 2], go: 2 },
      { nm: '视频', c: COL.video, pos: [15.0, 4.4, 0], sz: [3.0, 2.2, 0.4], go: 10 }
    ];
    const B = parts.map(q => { const b = block(...q.sz, q.c, q.pos, { opacity: 0.92 }); b.userData.go = q.go; G.add(b); PICKS.push(b); G.add(lab(q.nm, [q.pos[0], q.pos[1] + q.sz[1] / 2 + 0.9, 0], { size: 15 })); return b; });
    const cond = block(2.6, 1.6, 0.3, COL.ok, [-12, -2.0, 0], { opacity: 0.9 }); cond.userData.go = 6; G.add(cond); PICKS.push(cond); G.add(lab('条件图像 / 视频（帧替换）', [-12, -3.4, 0], { size: 14 }));
    const txt = stream(G, 6, COL.text), vid = stream(G, 8, COL.video), out = stream(G, 6, COL.ok), tm = stream(G, 3, COL.time);
    return { update(p) {
      txt([[-14.6, 7.2, 0], [-5.2, 7.2, 0], [1.8, 7.2, 0]], p, 1);
      vid([[-14.6, 1.6, 0], [-5.2, 1.6, 0], [1.8, 1.6, 0]], (p * 1.3) % 1, 1);
      tm([[1.8, 10.4, 0], [1.8, 8.4, 0]], p, 1);
      out([[3.8, 4.4, 0], [9.6, 4.4, 0], [15.0, 4.4, 0]], p, seg(p, 0.3, 0.5));
      B.forEach((b, i) => glow(b, Math.max(0.05, 0.7 - Math.abs(i / B.length - p) * 3)));
      cap('文本走上面一路，视频走下面一路，在 DiT 里通过交叉注意力相遇；点任一方块跳到那一幕');
    } };
  }

  /* ---------- scene 2: data funnel ---------- */
  function s2(G) {
    let view = +(OPT[0] ?? 0); G.add(L.grid(44, 22)); const sub = new THREE.Group(); G.add(sub);
    const V = [
      { t: '预训练漏斗（对数高度）', g: ['切分后片段（60 多亿）', '通过全部过滤（约 2 亿）'], v: [6000, 200], u: '百万段', log: true },
      { t: '表 5 · 后训练领域（百万段）', g: ['物体恒存', '高运动', '复杂场景', '驾驶', '机器人', '4K'], v: [10.4, 1.0, 1.6, 3.1, 0.73, 0.388], u: '百万段' },
      { t: '表 2 · 机器人数据中间视角（千段）', g: ['AgiBot', 'Bridge', 'DROID', 'GR00T', '1X', 'OpenX', 'RoboMIND'], v: [194, 36, 39, 3, 17, 0.5, 16], u: '千段' }
    ];
    let bars = [], rings = [], last = -1;
    function rebuild() {
      clearSub(sub); bars = []; rings = []; last = view; const v = V[view], n = v.g.length, gw = view === 0 ? 20 : Math.min(6, 34 / n), mx = Math.max(...v.v);
      v.g.forEach((nm, i) => { const x = (i - (n - 1) / 2) * gw; const b = block(Math.min(3.2, gw * 0.7), 1, 2, view === 0 ? (i === 1 ? COL.ok : COL.video) : COL.video, [x, 0.5, 0], { edges: false }); sub.add(b);
        const h = v.log ? Math.log10(v.v[i] / 10) / Math.log10(mx / 10) * 9 : v.v[i] / mx * 9; const l = lab(String(v.v[i]), [x, 0, 0], { size: 15 }); sub.add(l); sub.add(lab(nm, [x, -1.0, 2.0], { size: 15 })); bars.push({ b, l, h }); });
      if (view === 0) ['美学', '运动', 'OCR', '感知', '语义', 'VLM', '类型'].forEach((nm, k) => { const r = L.torus(1.3, 0.12, COL.gold, { opacity: 0.85 }); r.userData.c = hex3(COL.gold); r.rotation.y = Math.PI / 2; r.position.set(-7.2 + k * 2.4, 5.2, 0); sub.add(r); rings.push(r); sub.add(lab(nm, [r.position.x, 7.0 + (k % 2) * 1.1, 0], { size: 13 })); });
      sub.add(lab(v.t + `（单位：${v.u}）`, [0, 11.6, 0], { size: 18, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const pk = stream(G, 10, COL.video, 0.16);
    const ctls = [{ label: '数据', items: ['预训练漏斗', '后训练领域', '机器人数据'], get: () => view, set: k => { view = k; } }];
    const MSG = ['60 亿段 → 2 亿段：2 / 60 = 3.3%（论文写“约 4%”）；Predict1 的通过率是 30%', '表 5 合计 17.2M 段；每个领域各训一个 SFT 模型', '表 2 中间视角合计约 305.5k 段；动作太慢的视频加速播放'];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const g = seg(p, 0, 0.5);
      bars.forEach(({ b, l, h }) => { const hh = Math.max(0.05, h * g); b.scale.y = hh; b.position.y = hh / 2; l.position.y = hh + 0.5; });
      rings.forEach((r, k) => glow(r, Math.max(0.05, 0.8 - Math.abs(k / 7 - p) * 4)));
      if (view === 0) pk([[-10, 5.2, 0], [10, 5.2, 0]], p, 1); else pk([[0, 0, 0], [0, 0, 0]], 0, 0);
      cap(MSG[view]);
    } };
  }

  /* ---------- scene 3: VAE frames and patch tokens ---------- */
  function s3(G) {
    let st = +(OPT[0] ?? 2); G.add(L.grid(44, 22)); const sub = new THREE.Group(); G.add(sub);
    const ST = [{ nm: '256p', W: 320, H: 192 }, { nm: '480p', W: 832, H: 480 }, { nm: '720p', W: 1280, H: 704 }];
    const plates = inst(BOX, 93), lat = inst(BOX, 24); G.add(plates, lat);
    const fx = i => (i === 0 ? -18 : -18 + 0.9 + (Math.floor((i - 1) / 4)) * 0.98 + ((i - 1) % 4) * 0.19);
    const lx = k => -18 + (k === 0 ? 0 : 0.9 + (k - 1) * 0.98 + 0.29);
    G.add(lab('93 个像素帧（1 + 23 × 4）', [-7, 9.8, 0], { size: 16 }), lab('24 个隐帧，每个 16 通道', [-7, 3.6, 0], { size: 16 }));
    let cells = null, last = -1;
    function rebuild() {
      clearSub(sub); last = st; const s = ST[st], h = s.H / 16, w = s.W / 16, n = h * w, sp = Math.min(0.36, 8 / w);
      cells = inst(BOX, n); sub.add(cells); cells.userData = { h, w, sp };
      sub.add(lab(`一个隐帧：${s.H / 8} × ${s.W / 8}\n→ patch 2 × 2 → ${h} × ${w}\n= ${fmt(n)} 个 token`, [12.5, -1.6, 1.0], { size: 14, border: hexs(COL.dit) }));
    }
    rebuild();
    const ctls = [{ label: '阶段（表 4）', items: ['256p', '480p', '720p'], get: () => st, set: k => { st = k; } }];
    return { ctls, update(p) {
      if (last !== st) rebuild();
      const k = Math.floor(seg(p, 0.05, 0.55) * 24.999);
      for (let i = 0; i < 93; i++) { const g = i === 0 ? 0 : 1 + Math.floor((i - 1) / 4); setI(plates, i, [fx(i), 7.4, 0], [0.16, 2.4, 1.6]); colI(plates, i, hex3(g <= k ? (g === k ? COL.gold : COL.video) : COL.noise)); }
      done(plates);
      for (let g = 0; g < 24; g++) { setI(lat, g, [lx(g), 1.8, 0], g <= k ? [0.9, 1.2, 1.2] : 0.0001); colI(lat, g, hex3(g === k ? COL.gold : COL.vae)); }
      done(lat);
      const { h, w, sp } = cells.userData, gk = seg(p, 0.55, 0.9); let q = 0;
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) { const on = (r * w + c) / (h * w) < gk; setI(cells, q, [12.5 - w * sp / 2 + c * sp, 1.0 + r * sp, 0], on ? [sp * 0.86, sp * 0.86, 0.3] : 0.0001); colI(cells, q, hex3((r + c) % 2 ? COL.dit : 0x6a78e8)); q++; }
      done(cells);
      const s = ST[st], tok = 24 * s.H / 16 * s.W / 16;
      cap(`${s.nm}（${s.W} × ${s.H}）：93 帧 → 24 个隐帧 × ${s.H / 16} × ${s.W / 16} = <b>${fmt(tok)} 个 token</b>；输入通道 16 + 1 + 1 = 18，× 2 × 2 = 72 → 线性到 2048`);
    } };
  }

  /* ---------- scene 4: Reason1 concat ---------- */
  function s4(G) {
    let mode = +(OPT[0] ?? 0); G.add(L.grid(44, 22));
    const NL = 28, slabs = [], segs = inst(BOX, NL); G.add(segs);
    for (let i = 0; i < NL; i++) { const b = block(4.2, 0.26, 2.2, COL.text, [-13, 0.4 + i * 0.36, 0], { opacity: 0.88 }); G.add(b); slabs.push(b); }
    G.add(lab('Reason1-7B\n28 层 × 宽 3584（冻结）', [-12, 12.0, 0], { size: 15 }));
    G.add(lab('提示词 → 512 个 token', [-13, -1.0, 1.4], { size: 14 }));
    const proj = block(2.4, 2.4, 2.4, COL.dit, [10.5, 5.4, 0], { opacity: 0.92 }); G.add(proj); G.add(lab('Linear + GELU\n100,352 → 1024', [10.5, 8.0, 0], { size: 14 }));
    const outb = block(1.4, 0.6, 0.6, COL.ok, [14.6, 5.4, 0]); G.add(outb); G.add(lab('1024 维 → 交叉注意力', [14.6, 3.8, 0], { size: 14 }));
    const pulse = stream(G, 1, COL.gold, 0.25);
    const ctls = [{ label: '拼法', items: ['全部 28 层（代码）', '只取最后一层（对比）'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const k = Math.floor(seg(p, 0.05, 0.7) * (NL + 0.999)), segW = 0.62;
      for (let i = 0; i < NL; i++) {
        const used = mode === 0 || i === NL - 1, on = used && (mode === 1 ? k >= NL - 1 : i < k);
        const x = mode === 0 ? -7.2 + i * segW : -7.2;
        setI(segs, i, [x + segW / 2, 5.4, 0], on ? [segW * 0.92, 1.0, 1.0] : 0.0001); colI(segs, i, hex3(i % 2 ? COL.text : 0xbdb2ff));
        glow(slabs[i], used ? (i === k - 1 || (mode === 1 && i === NL - 1) ? 0.8 : 0.12) : 0.0);
      }
      done(segs);
      const g = seg(p, 0.72, 0.95); pulse([[-7.2 + (mode === 0 ? NL * segW : segW), 5.4, 0], [10.5, 5.4, 0], [14.6, 5.4, 0]], g * 0.999, g > 0 ? 1 : 0);
      glow(proj, g > 0.3 ? 0.6 : 0.05); glow(outb, g > 0.8 ? 0.7 : 0.05);
      const dim = mode === 0 ? Math.min(k, NL) * 3584 : (k >= NL - 1 ? 3584 : 0), full = mode === 0 ? 100352 : 3584;
      cap(mode === 0 ? `已拼 ${Math.min(k, NL)} / 28 层：${fmt(dim)} 维（满 28 × 3584 = 100,352）；投影参数 100,352 × 1024 + 1024 = <b>102,761,472</b>` : `只取一层时是 3,584 维，投影参数 3,584 × 1024 + 1024 = ${fmt(3584 * 1024 + 1024)}；Cosmos 选择拼全部 28 层（${fmt(full)}）`);
    } };
  }

  /* ---------- scene 5: DiT block and parameter count ---------- */
  function s5(G) {
    let sz = +(OPT[0] ?? 0); G.add(L.grid(44, 22)); const sub = new THREE.Group(); G.add(sub);
    const MD = [{ nm: '2B · 28 层（代码）', d: 2048, L: 28, ck: '2B' }, { nm: '2B · 32 层（表 3）', d: 2048, L: 32, ck: '2B' }, { nm: '14B · 36 层', d: 5120, L: 36, ck: '14B' }];
    const parts = [['LN → scale₁ / shift₁', COL.norm, 1], ['自注意力（q/k RMSNorm，3D RoPE）', COL.attn, 0], ['× gate₁ + 残差', COL.norm, 1], ['LN → scale₂ / shift₂', COL.norm, 1], ['交叉注意力（读 Reason1 1024）', COL.text, 0], ['× gate₂ + 残差', COL.norm, 1], ['LN → scale₃ / shift₃', COL.norm, 1], ['FFN 4d，GELU', COL.ffn, 0], ['× gate₃ + 残差', COL.norm, 1]];
    const P = parts.map(([t, c], i) => { const y = 0.7 + i * 1.3, b = block(6.0, 0.86, 1.6, c, [0, y, 0], { opacity: 0.92 }); G.add(b); G.add(lab(t, [0, y, 1.3], { size: 14 })); return { b, y }; });
    const lora = [0, 3, 6].map(i => { const b = block(1.6, 0.86, 1.2, COL.time, [5.2, P[i].y + 1.3, 0], { opacity: 0.9 }); G.add(b); return b; });
    G.add(lab('每段一个 LoRA\nd → 256 → 3d', [5.6, 12.0, 0], { size: 14, border: hexs(COL.time) }));
    const tm = block(2.8, 1.0, 1.4, COL.time, [11.6, 9.0, 0], { opacity: 0.9 }); G.add(tm); G.add(lab('时间 t（× 0.001）\n→ 共享 MLP → 3d 偏置', [12.8, 7.3, 0], { size: 14 }));
    const txt = block(2.8, 1.0, 1.4, COL.text, [11.6, 4.4, 0], { opacity: 0.9 }); G.add(txt); G.add(lab('文本 512 × 1024', [11.6, 3.2, 0], { size: 14 }));
    let slabs = [], last = -1;
    function rebuild() {
      clearSub(sub); slabs = []; last = sz; const m = MD[sz], hh = 11.6 / m.L;
      for (let i = 0; i < m.L; i++) { const b = block(2.6, hh * 0.7, 1.8, COL.dit, [-9.5, 0.3 + i * hh, 0], { opacity: 0.9, edges: false }); sub.add(b); slabs.push(b); }
      sub.add(lab(`${m.L} 个块`, [-9.5, -0.9, 1.2], { size: 15 }));
    }
    rebuild();
    const pulse = stream(G, 1, COL.gold, 0.28), mods = stream(G, 4, COL.time, 0.12);
    const ctls = [{ label: '尺寸', items: ['2B · 28 层（代码）', '2B · 32 层（表 3）', '14B · 36 层'], get: () => sz, set: k => { sz = k; } }];
    return { ctls, update(p) {
      if (last !== sz) rebuild();
      const k = Math.floor(seg(p, 0.05, 0.9) * parts.length * 0.999);
      P.forEach(({ b }, i) => glow(b, i === k ? 0.7 : 0.05));
      lora.forEach((b, j) => glow(b, Math.floor(k / 3) === j ? 0.7 : 0.08));
      pulse([[0, 0.2, 1.0], [0, 12.4, 1.0]], seg(p, 0.05, 0.9) * 0.999, 1);
      mods([[11.6, 9.0, 0], [5.2, 9.0, 0], [5.2, P[Math.floor(k / 3) * 3].y + 1.3, 0]], (p * 2) % 1, 1);
      slabs.forEach((s, i) => glow(s, Math.max(0.03, 0.6 - Math.abs(i / slabs.length - p) * 4)));
      const m = MD[sz], c = cosmosParams(m.d, m.L), f = CKPT[m.ck], diff = f - c.tot;
      cap(`${m.nm}：合计 <b>${fmt(c.tot)}</b>；权重文件 / 2 = ${fmt(f)}，差 ${diff >= 0 ? '+' : '−'}${fmt(Math.abs(diff))}${Math.abs(diff) < 1e6 ? '，<b>对上</b>' : '，<b>对不上</b>'}`);
    } };
  }

  /* ---------- scene 6: flow matching and timestep shift ---------- */
  function s6(G) {
    let bi = +(OPT[0] ?? 2), hs = +(OPT[1] ?? 0); G.add(L.grid(44, 22));
    const BETA = [1, 3, 5], NB = 25, r = L.rng(7), U = [];
    for (let i = 0; i < 2000; i++) U.push({ t: 1 / (1 + Math.exp(-L.gauss(r))), h: r(), z: r() });
    const bars = inst(BOX, NB); G.add(bars);
    G.add(lab('t_s 的训练分布（2,000 个样本，现抽）', [0, -1.4, 2.4], { size: 15 }));
    G.add(lab('0（数据）', [-12, -0.4, 1.4], { size: 13 }), lab('1（噪声）', [12, -0.4, 1.4], { size: 13 }));
    const zx = L.sphere(0.45, COL.ok), ze = L.sphere(0.45, COL.noise), pt = L.sphere(0.32, COL.gold); zx.position.set(-8, 9.4, 0); ze.position.set(8, 10.6, 0); G.add(zx, ze, pt);
    G.add(L.line([[-8, 9.4, 0], [8, 10.6, 0]], COL.noise, { dashed: true, opacity: 0.6 }));
    G.add(lab('x（数据）', [-8, 8.2, 0], { size: 14 }), lab('ε（噪声）', [8, 9.4, 0], { size: 14 }));
    let arr = null;
    const ctls = [{ label: 'β', items: ['1（256p）', '3', '5（720p）'], get: () => bi, set: k => { bi = k; } }, { label: '高噪声补丁', items: ['关', '开（5% 抽最高 2%）'], get: () => hs, set: k => { hs = k; } }];
    return { ctls, update(p) {
      const b = BETA[bi], cnt = new Array(NB).fill(0); let hi = 0; const ts = [];
      for (const u of U) { let t = shiftF(u.t, b); if (hs && u.h < 0.05) t = 0.98 + 0.02 * u.z; ts.push(t); if (t >= 0.98) hi++; cnt[Math.min(NB - 1, Math.floor(t * NB))]++; }
      ts.sort((a, c) => a - c); const med = ts[1000];
      const g = seg(p, 0, 0.4), mx = Math.max(...cnt);
      for (let i = 0; i < NB; i++) { const h = Math.max(0.02, cnt[i] / mx * 8 * g); setI(bars, i, [-12 + (i + 0.5) * 24 / NB, h / 2, 0], [24 / NB * 0.86, h, 1.2]); colI(bars, i, hex3(i === NB - 1 ? COL.bad : COL.video)); }
      done(bars);
      const tt = seg(p, 0.4, 0.95); pt.position.set(L.lerp(-8, 8, tt), L.lerp(9.4, 10.6, tt), 0);
      if (arr) { G.remove(arr); L.dispose(arr); } arr = L.arrow([pt.position.x, pt.position.y + 0.6, 0], [pt.position.x + 3.2, pt.position.y + 1.0, 0], COL.gold); G.add(arr);
      cap(`β = ${b}${hs ? '，加补丁' : ''}：中位数 <b>${med.toFixed(3)}</b>，t_s ≥ 0.98 占 <b>${(hi / 20).toFixed(1)}%</b>（红柱是最高一档 0.96–1）；x_t = (1 − t)x + tε，t = ${tt.toFixed(2)}，速度 ε − x 不变`);
    } };
  }

  /* ---------- scene 7: frame-replacement conditioning ---------- */
  function s7(G) {
    let mode = +(OPT[0] ?? 1); G.add(L.grid(44, 22));
    const N = 24, cubes = inst(BOX, N), masks = inst(BOX, N); G.add(cubes, masks);
    const X = i => -14.4 + i * 1.25;
    G.add(lab('24 个隐帧（93 帧）', [0, 4.4, 0], { size: 16 }), lab('掩码通道：条件 = 1，其余 = 0', [0, -1.6, 1.6], { size: 14 }));
    const xs = []; for (let i = 0; i < 2; i++) { const g = new THREE.Group(); const a = block(0.12, 1.0, 0.12, COL.bad, [0, 0, 0], { edges: false }), b = a.clone(); a.rotation.z = 0.7; b.rotation.z = -0.7; g.add(a, b); g.position.set(X(i), 3.0, 0); G.add(g); xs.push(g); }
    const lossL = lab('误差恒为 0', [X(0) + 1.4, 3.6, 0], { size: 13, color: '#ff9b9b' }); G.add(lossL);
    const ctls = [{ label: '模式', items: ['Text2World（0 帧）', 'Image2World（1 帧）', 'Video2World（5 帧 = 2 隐帧）'], get: () => mode, set: k => { mode = k; } }];
    const PROB = ['0.5', '0.25', '0.25'], PIX = [0, 1, 5];
    return { ctls, update(p) {
      const nc = mode, k = seg(p, 0.1, 0.95), sg = shiftF(1 - k, 5);
      for (let i = 0; i < N; i++) {
        const c = i < nc; setI(cubes, i, [X(i), 1.6, 0], [1.0, 1.6, 1.6]);
        colI(cubes, i, c ? hex3(COL.ok) : mix(hex3(COL.video), hex3(COL.noise), sg));
        setI(masks, i, [X(i), 0.2, 0], [1.0, 0.25, 1.6]); colI(masks, i, hex3(c ? COL.white : COL.zero));
      }
      done(cubes); done(masks);
      xs.forEach((g, i) => { g.visible = i < nc; }); lossL.visible = nc > 0;
      cap(`${['Text2World', 'Image2World', 'Video2World'][mode]}：${nc} 个条件隐帧 = ${PIX[mode]} 个像素帧（训练中概率 ${PROB[mode]}）；其余 ${N - nc} 个隐帧去噪，当前 σ = ${sg.toFixed(2)}`);
    } };
  }

  /* ---------- scene 8: post-training pipeline ---------- */
  function s8(G) {
    G.add(L.grid(48, 24));
    const pre = block(3.0, 2.0, 2.0, COL.dit, [-20, 4, 0]); G.add(pre); G.add(lab('预训练 2B', [-20, 1.6, 1.2], { size: 15 }));
    const DOM = [['物体恒存 10.4M', 50.9], ['高运动 1.0M', 44.0], ['复杂场景 1.6M', 42.6], ['驾驶 3.1M', 47.9], ['机器人 730K', 72.6], ['4K 冷却 388K', null]];
    const sft = DOM.map(([nm, w], i) => { const y = 9.5 - i * 1.9, b = block(1.6, 1.1, 1.1, w == null ? COL.gold : COL.vae, [-8, y, 0]); G.add(b); G.add(lab(nm + (w != null ? ` · SFT 胜 ${w}%` : ''), [-12.6, y, 0.8], { size: 12 })); return b; });
    const merge = block(3.0, 2.4, 2.4, COL.ctrl, [-1.5, 4, 0]); G.add(merge); G.add(lab('model soup 合并\n（20 多个候选里选）', [-1.5, 6.4, 0], { size: 14 }));
    const rl = block(3.0, 2.4, 2.4, COL.attn, [6.0, 4, 0]); G.add(rl); G.add(lab('RL（VideoAlign）\n256 步，batch 32', [6.0, 6.4, 0], { size: 14 }));
    const ds = block(3.0, 2.4, 2.4, COL.ffn, [13.5, 4, 0]); G.add(ds); G.add(lab('rCM 蒸馏\n35 步 → 4 步', [13.5, 6.4, 0], { size: 14 }));
    /* eight RL rollouts of 20 steps each */
    const dots = inst(BALL, 8 * 20); G.add(dots); const rr = L.rng(3), Y = [];
    for (let j = 0; j < 8; j++) { const row = []; let y = 0; for (let s = 0; s < 20; s++) { y += (rr() - 0.5) * 0.25; row.push(y); } Y.push(row); }
    G.add(lab('8 个样本 × 20 步；每两步算一次梯度（共 10 次）', [9.2, -3.4, 0], { size: 13 }));
    const pk = stream(G, 1, COL.gold, 0.32);
    const path = [[-20, 4, 0], [-8, 4, 0], [-1.5, 4, 0], [6.0, 4, 0], [13.5, 4, 0]];
    return { update(p) {
      pk(path, seg(p, 0, 0.9) * 0.999, 1);
      const st = Math.min(4, Math.floor(seg(p, 0, 0.9) * 4.999));
      glow(pre, st === 0 ? 0.7 : 0.05); sft.forEach(b => glow(b, st === 1 ? 0.6 : 0.05)); glow(merge, st === 2 ? 0.7 : 0.05); glow(rl, st === 3 ? 0.7 : 0.05); glow(ds, st === 4 ? 0.7 : 0.05);
      const rk = seg(p, 0.5, 0.8), cur = Math.floor(rk * 10) * 2; let q = 0;
      for (let j = 0; j < 8; j++) for (let s = 0; s < 20; s++) { setI(dots, q, [3.0 + s * 0.65, -2.6 + j * 0.5 + Y[j][s], 0], 0.12); colI(dots, q, hex3(rk > 0 && (s === cur || s === cur + 1) ? COL.gold : COL.attn)); q++; }
      done(dots);
      const MSG = ['预训练模型（256p → 480p → 720p，最后加 Text2World）', '每个领域单独 SFT：3 万步，batch 256；各自在本领域明显胜出（图 3）', '模型合并：model soup、TIES、DARE-TIES 差不多，DARE-Linear 差；选 model soup', `RL：组内归一化优势（GRPO 式），扩散损失做正则；当前算第 ${cur + 1}–${cur + 2} 步的梯度`, '蒸馏到 4 步：T2W 总分 0.768 → 0.764，I2W 0.810 → 0.816'];
      cap(MSG[st]);
    } };
  }

  /* ---------- scene 9: Transfer2.5 control branch + RNDS ---------- */
  function s9(G) {
    let lay = +(OPT[0] ?? 0), md = +(OPT[1] ?? 3); G.add(L.grid(52, 26)); const sub = new THREE.Group(); G.add(sub); const sub2 = new THREE.Group(); G.add(sub2);
    const NBk = 28, H = 0.42, main = [];
    for (let i = 0; i < NBk; i++) { const b = block(2.6, H * 0.8, 1.6, COL.dit, [-10, 0.4 + i * H, 0], { opacity: 0.9, edges: false }); G.add(b); main.push(b); }
    G.add(lab('主干 28 块（冻结）', [-10, -0.8, 1.4], { size: 14 }));
    ['边缘', '模糊', '分割', '深度'].forEach((nm, i) => { const b = block(1.4, 1.4, 0.2, COL.ctrl, [-20 + (i % 2) * 1.8, 4 + Math.floor(i / 2) * 1.8, 0], { opacity: 0.85 }); G.add(b); });
    G.add(lab('控制输入 × 0.25', [-19.1, 7.6, 0], { size: 13 }));
    let ctrl = [], last = '';
    const RN = {
      e: [[1, .947, .932, .946, .93, .836, .866, .871, .828, .843, .845, .837, .849, .879, .852, .834, .749, .761, .8, .778], [1, 1.006, 1.003, 1.029, 1.036, 1.014, 1.038, .977, .997, 1.018, .981, .99, .997, 1.011, .97, .989, .988, .987, .954, .972]],
      b: [[1, .958, .931, 1.028, .96, .951, .976, .989, .957, .968, .907, .899, .91, .944, .904, .827, .853, .791, .826, .766], [1, 1.002, .999, 1.027, .986, .994, .956, 1.01, .993, .981, .984, .995, 1.038, 1.072, .912, .965, .886, .917, .903]],
      d: [[1, .974, .88, .969, .864, .844, .831, .843, .798, .799, .818, .806, .827, .886, .836, .789, .697, .791, .827, .773], [1, .998, .987, 1.078, 1.133, 1.06, 1.116, 1.141, 1.066, 1.119, 1.166, 1.106, 1.147, 1.211, 1.11, 1.115, 1.121, 1.114, 1.188, 1.195]],
      s: [[1, .885, .799, .842, .716, .658, .657, .588, .57, .6, .574, .517, .463, .587, .457, .424, .401, .472, .467, .504], [1, 1.022, 1.068, 1.11, 1.097, 1.154, 1.186, 1.155, 1.13, 1.244, 1.225, 1.226, 1.265, 1.328, 1.252, 1.206, 1.209, 1.23, 1.25, 1.236]]
    };
    const KEY = ['e', 'b', 'd', 's'], NM = ['边缘', '模糊', '深度', '分割'];
    function rebuild() {
      clearSub(sub); clearSub(sub2); ctrl = []; last = lay + '' + md;
      const pos = lay === 0 ? [0, 7, 14, 21] : [0, 1, 2, 3];
      pos.forEach(i => { const b = block(2.2, H * 0.8, 1.4, COL.ctrl, [-14.2, 0.4 + i * H, 0], { opacity: 0.95 }); sub.add(b); ctrl.push({ b, i }); sub.add(L.line([[-13.1, 0.4 + i * H, 0], [-11.3, 0.4 + i * H, 0]], COL.ctrl, { opacity: 0.9 })); });
      sub.add(lab(lay === 0 ? '控制块 @ [0, 7, 14, 21]' : '控制块 @ 开头 4 个（示意）', [-14.2, 13.2, 0], { size: 14, border: hexs(COL.ctrl) }));
      /* RNDS chart: x chunk 1..20 → [0, 16]; y 0.4..1.4 → [0, 10] */
      const X0 = 2, Y0 = 0.4, xs = c => X0 + (c - 1) * 0.84, ys = v => Y0 + (v - 0.4) * 10;
      sub2.add(L.line([[X0, Y0, 0], [X0 + 16.5, Y0, 0]], 0x8e9bb8, { opacity: 0.6 }), L.line([[X0, Y0, 0], [X0, Y0 + 10, 0]], 0x8e9bb8, { opacity: 0.6 }), L.line([[X0, ys(1), 0], [X0 + 16.5, ys(1), 0]], 0x8e9bb8, { dashed: true, opacity: 0.5 }));
      [0.4, 0.8, 1.2].forEach(v => sub2.add(lab(v.toFixed(1), [X0 - 1.0, ys(v), 0], { size: 12 })));
      [1, 5, 10, 15, 20].forEach(c => sub2.add(lab(String(c), [xs(c), Y0 - 0.8, 0], { size: 12 })));
      const [a, b] = RN[KEY[md]];
      sub2.add(L.line(a.map((v, i) => [xs(i + 1), ys(v), 0]), COL.video), L.line(b.map((v, i) => [xs(i + 1), ys(v), 0]), COL.ok));
      sub2.add(lab(`图 10 · ${NM[md]}控制 · RNDS（重画）`, [X0 + 8, Y0 + 10.8, 0], { size: 14, border: 'rgba(56,209,255,.7)' }));
      sub2.add(lab('段号（每段 93 帧）', [X0 + 8, Y0 - 1.8, 0], { size: 12 }));
    }
    rebuild();
    const dot = stream(G, 2, COL.gold, 0.22);
    const ctls = [{ label: '结构', items: ['Transfer2.5（每 7 块）', 'Transfer1 式（开头）'], get: () => lay, set: k => { lay = k; } }, { label: '曲线', items: ['边缘', '模糊', '深度', '分割'], get: () => md, set: k => { md = k; } }];
    return { ctls, update(p) {
      if (last !== lay + '' + md) rebuild();
      const cur = Math.floor(seg(p, 0, 0.95) * 27.999);
      main.forEach((b, i) => glow(b, i === cur ? 0.8 : 0.03));
      ctrl.forEach(({ b, i }) => glow(b, i === cur ? 0.9 : 0.1));
      dot([[-10, 0.4, 1.0], [-10, 0.4 + 27 * H, 1.0]], seg(p, 0, 0.95) * 0.999, 1);
      const [a, b] = RN[KEY[md]];
      cap(`${NM[md]}控制：Transfer1-7B 最后一段 RNDS ${a[a.length - 1]}，Transfer2.5-2B ${b[b.length - 1]}（第 ${b.length} 段）；控制块在 28 块里的位置 ${lay === 0 ? '[0, 7, 14, 21]' : '[0, 1, 2, 3]'}`);
    } };
  }

  /* ---------- scene 10: domain post-training ---------- */
  function s10(G) {
    let md = +(OPT[0] ?? 0); G.add(L.grid(48, 24)); const sub = new THREE.Group(); G.add(sub);
    let upd = () => {}, last = -1;
    function rebuild() {
      clearSub(sub); last = md;
      if (md === 0) {
        const cubes = inst(BOX, 56); sub.add(cubes);
        const VN = ['前广角', '前长焦', '前左', '前右', '后左', '后右', '后长焦'];
        VN.forEach((nm, v) => sub.add(lab(nm, [-16 + v * 4.6 + 1.6, -1.2, 1.6], { size: 12 })));
        sub.add(lab('7 视角沿时间维拼成 56 个隐帧；每视角 8 个，RoPE 每视角从 0 重新数', [0, 8.6, 0], { size: 14, border: hexs(COL.cam) }));
        upd = p => { const k = Math.floor(seg(p, 0, 0.9) * 56.999); for (let i = 0; i < 56; i++) { const v = Math.floor(i / 8), j = i % 8; setI(cubes, i, [-16 + v * 4.6 + j * 0.46, 2.4, 0], i < k ? [0.4, 3.2, 2.0] : 0.0001); colI(cubes, i, mix(hex3(COL.video), hex3(COL.cam), v / 6)); } done(cubes);
          cap(`7 × 29 = 203 帧 → 7 × 8 = 56 个隐帧；720p 下 56 × 44 × 80 = <b>${fmt(56 * 44 * 80)}</b> 个 token；通道末尾拼 7 维视角嵌入`); };
      } else if (md === 1) {
        const cubes = inst(BOX, 24), rays = inst(BOX, 16); sub.add(cubes, rays);
        sub.add(lab('源视频', [-11, -1.2, 1.6], { size: 13 }), lab('目标视角 1', [-1.2, -1.2, 1.6], { size: 13 }), lab('目标视角 2', [8.6, -1.2, 1.6], { size: 13 }));
        sub.add(lab('Plücker 射线图（每像素 6D）→ patch → 投影，加到目标 token', [0, 8.8, 0], { size: 14, border: hexs(COL.cam) }));
        const sa = block(4.4, 1.0, 1.6, COL.attn, [0, 11.0, 0]), fz = block(4.4, 1.0, 1.6, COL.frozen, [7.0, 11.0, 0]); sub.add(sa, fz);
        sub.add(lab('只训：自注意力 + 相机投影', [0, 12.4, 0], { size: 13 }), lab('冻结：其余层', [7.0, 12.4, 0], { size: 13 }));
        upd = p => { const k = seg(p, 0.2, 0.8);
          for (let i = 0; i < 24; i++) { const v = Math.floor(i / 8), j = i % 8; setI(cubes, i, [-14 + v * 9.8 + j * 0.9, 2.4, 0], [0.8, 3.0, 2.0]); colI(cubes, i, hex3(v === 0 ? COL.ok : COL.video)); }
          for (let i = 0; i < 16; i++) { const v = 1 + Math.floor(i / 8), j = i % 8; setI(rays, i, [-14 + v * 9.8 + j * 0.9, L.lerp(7.2, 4.4, k), 0], [0.8, 0.3, 2.0]); colI(rays, i, hex3(COL.cam)); }
          done(cubes); done(rays); glow(sa, 0.6);
          cap('源和目标的隐帧沿时间拼接；相机参数每 4 帧取一次，和隐帧对齐；表 17：多视角版 Sampson 误差 19.73，单视角版 26.61'); };
      } else {
        const cubes = inst(BOX, 4), acts = inst(BOX, 12 * 7); sub.add(cubes, acts);
        const mlp = block(3.0, 1.6, 1.6, COL.act, [6.0, 8.4, 0]), te = block(3.2, 1.2, 1.6, COL.time, [12.0, 8.4, 0]); sub.add(mlp, te);
        sub.add(lab('MLP：28 → 8192 → 2048 / 6144', [6.0, 10.2, 0], { size: 13 }), lab('+ 时间嵌入 / AdaLN-LoRA', [12.0, 10.2, 0], { size: 13 }));
        sub.add(lab('Bridge：1 帧条件 + 12 帧预测 = 13 帧 → 4 个隐帧；动作 7 维（Δxyz、Δ姿态、夹爪宽）', [-2, -2.4, 1.6], { size: 13 }));
        upd = p => { const k = Math.floor(seg(p, 0.05, 0.8) * 3.999);
          for (let i = 0; i < 4; i++) { setI(cubes, i, [-12 + i * 4.4, 2.4, 0], [3.0, 3.0, 2.0]); colI(cubes, i, hex3(i === 0 ? COL.ok : (i <= k ? COL.gold : COL.video))); }
          for (let a = 0; a < 12; a++) for (let d = 0; d < 7; d++) { const lf = 1 + Math.floor(a / 4); setI(acts, a * 7 + d, [-12 + lf * 4.4 - 1.35 + (a % 4) * 0.9, 5.0 + d * 0.32, 0], [0.7, 0.24, 0.8]); colI(acts, a * 7 + d, hex3(lf === k ? COL.gold : COL.act)); }
          done(cubes); done(acts); glow(mlp, k > 0 ? 0.6 : 0.05); glow(te, k > 0 ? 0.6 : 0.05);
          cap(`第 ${k} 个隐帧：4 个动作 × 7 维 = 28 维 → 两个 MLP；新增参数 ${fmt(2 * (28 * 8192 + 8192) + 8192 * 2048 + 2048 + 8192 * 6144 + 6144)}（权重文件差 / 2 = 67,593,460）；条件帧那一格补零`); };
      }
    }
    rebuild();
    const ctls = [{ label: '扩展', items: ['驾驶 7 视角', '相机控制', '动作条件'], get: () => md, set: k => { md = k; } }];
    return { ctls, update(p) { if (last !== md) rebuild(); upd(p); } };
  }

  /* ---------- scene 11: results ---------- */
  function s11(G) {
    let view = +(OPT[0] ?? 0); G.add(L.grid(36, 36)); const sub = new THREE.Group(); G.add(sub);
    const T = [
      { t: '表 10 · PAI-Bench T2W 总分', g: ['P2.5-2B 预', 'P2.5-2B 后', 'P2.5-14B 预', 'P2.5-14B 后', 'Wan2.1-1.3B', 'Wan2.1-14B', 'Wan2.2-5B', 'Wan2.2-A14B'], v: [0.751, 0.768, 0.757, 0.768, 0.756, 0.761, 0.764, 0.769], c: [1, 1, 1, 1, 0, 0, 0, 0], lo: 0.74, hi: 0.775 },
      { t: '表 11 · PAI-Bench I2W 总分', g: ['P2.5-2B 预', 'P2.5-2B 后', 'P2.5-14B 预', 'P2.5-14B 后', 'Wan2.1-14B', 'Wan2.2-5B', 'Wan2.2-A14B'], v: [0.799, 0.810, 0.806, 0.810, 0.797, 0.804, 0.806], c: [1, 1, 1, 1, 0, 0, 0], lo: 0.79, hi: 0.815 },
      { t: '表 13 · 真机 30 次里的成功次数', g: ['只用示教', '常规增强', 'Transfer2.5 增强'], v: [1, 5, 24], c: [0, 0, 1], lo: 0, hi: 30 },
      { t: 'OpenWAM 图 6 · 视频骨干（RoboTwin2.0-Full，%）', g: ['Wan2.1-VACE 1.3B', 'Cosmos-P2.5 2B', 'Wan2.2-TI2V 5B', 'Wan2.1-I2V 14B'], v: [90.14, 91.64, 92.39, 93.79], c: [0, 1, 0, 0], lo: 88, hi: 95 }
    ];
    let bars = [], last = -1;
    function rebuild() {
      clearSub(sub); bars = []; last = view; const v = T[view], n = v.g.length, gw = Math.min(5, 30 / n);
      v.g.forEach((nm, i) => { const x = (i - (n - 1) / 2) * gw, b = block(Math.min(2.2, gw * 0.6), 1, 1.6, v.c[i] ? COL.dit : COL.video, [x, 0.5, 0], { edges: false }); sub.add(b);
        const l = lab(String(v.v[i]), [x, 0, 0], { size: 14 }); sub.add(l); sub.add(lab(nm, [x, -0.6 - (n > 5 ? (i % 2) * 1.0 : 0), 2.4], { size: 13 })); bars.push({ b, l, v: v.v[i] }); });
      sub.add(lab(v.t + `（纵轴 ${v.lo} 到 ${v.hi}）`, [0, 10.2, 0], { size: 17, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const ctls = [{ label: '表', items: ['PAI T2W', 'PAI I2W', '真机', 'OpenWAM 骨干'], get: () => view, set: k => { view = k; } }];
    const MSG = ['T2W：2B、14B 后训练都是 0.768，Wan2.2-27B-A14B 0.769；总分 = (领域 + 质量) / 2', 'I2W：2B、14B 后训练 0.810 并列最高；蒸馏 4 步版 0.816 还略高', '每个场景 3 次；24/30 的 95% 区间约 63%–90%', 'Cosmos 2B 比 TI2V-5B 低 92.39 − 91.64 = 0.75 点，参数 2.06 / 5.00 = 41%'];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const { lo, hi } = T[view], g = seg(p, 0, 0.5);
      bars.forEach(({ b, l, v }) => { const h = Math.max(0.02, (v - lo) / (hi - lo) * 7.5 * g); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.5; });
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
  window.__cpDebug = { get cap() { return $('cap').textContent; } };
})();
