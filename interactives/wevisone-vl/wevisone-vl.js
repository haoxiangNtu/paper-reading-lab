'use strict';
/* WeVisOne-VL (arXiv 2610.31329) taken apart into eleven animated scenes. Layer widths, depths and resolutions come
   from the official code (Tencent/WeVisOne-VL 9a6bcd8) and the config files on Hugging Face. Each scene's update(p)
   is a pure function of the timeline p plus the current toggles. Images, boxes and masks are hand-made; bars are
   numbers from the paper's tables. No WeVisOne-VL network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { vit: 0x5b8cff, llm: 0x38d1ff, tok: 0x7cb8ff, obj: 0xf2c14e, dec: 0x4fc98a, ada: 0x2ea58a, qd: 0x9d8cff, pix: 0xf0963c, ref: 0xd45fa0, data: 0xb48cff, ok: 0x4fc98a, bad: 0xe05d5d, dim: 0x46506a, white: 0xeef2fa, gt: 0x4fc98a, pred: 0xf0963c, base: 0x9aa3b5, b2: 0x9fb4ff, b4: 0x5b5cf0, gold: 0xf2c14e };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const fmt = n => n.toLocaleString('en-US');

  /* configs/wevisone_vl_v1_decoder.json + HF config.json */
  const CFG = { d: 192, mask: 64, freqs: 32, encT: 3, decL: 6, heads: 8, levels: 4, points: 4, ffn: 768, casc: 48, cnn: 1024, taps: [5, 11, 17, 23], vitW: 1024, vitDepth: 24, llm: { '2B': 2048, '4B': 2560 } };
  const PARAMS = { ada: 1794432, qb: { '2B': 480576, '4B': 578880 }, qd: 3560832, pix: 3184896, head: 49601, ref: 441123 };
  /* boxes borrowed from Fig. 3 of the paper (per-mille of the image) */
  const DOGS = [[81, 327, 394, 746], [552, 284, 902, 721]];
  /* three example photos for the resolution maths */
  const SIZES = [[640, 480], [1280, 960], [4000, 3000]];
  function smartResize(w, h) { /* Qwen2-VL smart_resize, factor 32, min 16*32*32, max 2025*32*32 (engine defaults) */
    const f = 32, mn = 16 * 1024, mx = 2025 * 1024; let hb = Math.max(f, Math.round(h / f) * f), wb = Math.max(f, Math.round(w / f) * f);
    if (hb * wb > mx) { const b = Math.sqrt(h * w / mx); hb = Math.max(f, Math.floor(h / b / f) * f); wb = Math.max(f, Math.floor(w / b / f) * f); }
    else if (hb * wb < mn) { const b = Math.sqrt(mn / (h * w)); hb = Math.ceil(h * b / f) * f; wb = Math.ceil(w * b / f) * f; }
    return { H: hb, W: wb, Hp: hb / 16, Wp: wb / 16, tok: (hb / 32) * (wb / 32) };
  }

  const SCENES = [
    { n: 1, part: '总览', title: '一条回复，两种输出', sub: '文字和坐标 token 是目标级输出；每个 <OBJ> 再交给 9.6M 的像素解码器', dur: 14, cam: [0.1, 1.12, 31, [0.6, 4.6, 0]],
      html: dl([['底座', 'Qwen3-VL 2B / 4B'], ['坐标', '<0> … <1000>，千分比'], ['像素任务', '每个框后多一个 <OBJ>'], ['解码器', '9,609,764 参数（4B）'], ['训练', '三阶段 SFT + 混合任务 GRPO']]) +
        '<p>图像进 Qwen3-VL 的 ViT，语言模型按指令生成结构化回复：<code>&lt;ref&gt;名称&lt;/ref&gt;&lt;box&gt;坐标…&lt;/box&gt;</code>。检测、指代、计数、指点、OCR 到这里就结束了。</p>' +
        '<p>分割和抠图在每个框的四个坐标后多生成一个 <code>&lt;OBJ&gt;</code>。它的隐状态、它前面的框、ViT 的四层特征一起进像素解码器，每个实例出一张整图大小的 alpha。</p>' +
        '<p>点画面里的方块可以跳到对应那一幕。</p>' + src('§3 · 图 3 · 图 4 · engine.py') },
    { n: 2, part: '§2 数据', title: '检测器广撒网，VLM 当裁判', sub: '切换检测和指代两条路线；底部是错误复核的回路', dur: 14, cam: [0.06, 1.12, 35, [0.4, 4.4, 0]],
      html: dl([['规模', '1 亿多张图，约 36 亿个框'], ['候选', 'SAM3 + 自研 DINO 式开放词表检测器'], ['裁判', 'Qwen3-VL 逐个核验'], ['掩码', 'SAM2 按框出可见区域掩码'], ['抠图', 'BiRefNet / MatAnyone2 → 标注器 → 全库重标']]) +
        '<p>检测器召回高但不认长尾，VLM 认得出但密集场景召回低，所以先让检测器出尽量全的候选，再让 VLM 判断每个候选是否符合查询。保留的实例用检测器的框，不用 VLM 的框。</p>' +
        '<p>同一个实例的框、掩码、alpha 共用同一条查询，四种监督不丢身份。</p>' +
        '<p>每轮训练后复核错误：标注没问题就加权或拿来检索相似图；标注有错才改。误报变成困难负样本，教模型拒答。</p>' + src('§2 · 图 2') },
    { n: 3, part: '§2.6 抠图', title: 'BiRefNet 的候选什么时候能用', sub: '四种情形，拖进度条看七条准则在哪一刻失效', dur: 14, cam: [0.0, 1.2, 28, [1.4, 4.2, 0]],
      html: dl([['数量', '|B| ≥ 8'], ['重叠', 'IoU(B, S) ≥ 0.5'], ['覆盖', '|B∩S| / |S| ≥ 0.5'], ['精度', '|B∩S| / |B| ≥ 0.8'], ['面积比', '|B| / |S| ∈ [0.5, 2]'], ['框', '外接框 IoU ≥ 0.7'], ['质心', '偏移 ≤ 0.15 × S 框对角线']]) +
        '<p>S 是 SAM2 给的二值掩码，B 是 BiRefNet 软前景在 0.5 处二值化。BiRefNet 只看 RGB，可能抠到别的物体或只抠一半，所以要七条全过才用它的 alpha；否则看 MatAnyone2，再不行保留 S。</p>' +
        '<p>只要 IoU ≥ 0.5，“覆盖 ≥ 0.5”和“面积比在 [0.5, 2]”就自动成立，画面里这两行永远跟着 IoU 走。真正多出来的约束是精度 0.8、框 IoU 0.7 和质心偏移。</p>' +
        guess('48×48 的玩具网格；S 和 B 的形状是我设的。七个数和阈值当场算。') + src('§2.6 Expert-assisted Annotation') },
    { n: 4, part: '§3.1 格式', title: '每个答案都是一串 token', sub: '切换任务；坐标 token 每 4 个画出一个框', dur: 14, cam: [0.04, 1.15, 30, [0.5, 3.4, 0]],
      html: dl([['坐标', '1001 个 token：<0> … <1000>'], ['框', '[x0, y0, x1, y1]，4 个 token'], ['点', '[x0, y0]，2 个 token'], ['无目标', '坐标字段写 None'], ['像素', '框后紧跟 <OBJ>，在同一个 <box> 里']]) +
        '<p>坐标是相对原图宽高的千分比，所以和输入分辨率无关。一个框只要 4 个 token，比用普通数字字符写坐标省得多。</p>' +
        '<p>计数仍然输出框，最后再写 “Total number: N.”；评测时数框，不读这句话。</p>' +
        '<p>分割和抠图的输出和检测几乎一样，只多 <code>&lt;OBJ&gt;</code>。没有 <code>&lt;OBJ&gt;</code> 就不调像素解码器。</p>' +
        guess('图是手画的；框坐标借用原文图 3 的例子；None 的确切写法论文没给。') + src('§3.1 · 图 3 · prompts.py · tokenizer.json') },
    { n: 5, part: '§3.2.1 特征', title: '从 ViT 中间截四层', sub: '切换输入图大小；网格、token 数、记忆长度当场算', dur: 13, cam: [0.22, 1.1, 31, [0, 4.4, 0]],
      html: dl([['ViT', '24 层，宽 1024，patch 16'], ['截取', '第 5、11、17、23 层（从 0 数）'], ['位置', '合并器之前，16 像素一格'], ['适配器', '1×1 卷积到 192 + GN，3 个卷积块'], ['记忆', 'M = 4 × H<sub>p</sub>W<sub>p</sub> 个 192 维 token']]) +
        '<p>Qwen3-VL 把每 2×2 个 patch 合成一个视觉 token 交给语言模型，第 5、11、17 层另有 DeepStack 合并器把特征送进 LLM 的浅层。解码器在这些合并器<b>之前</b>截取，所以拿到的是 4 倍密的网格。</p>' +
        '<p>四层是同一张网格，“多尺度”其实是四个深度。代码把 Qwen 按 2×2 块打乱的顺序还原成行优先再用。</p>' +
        '<p>缩放规则是 Qwen 的 smart-resize：边长取 32 的倍数，总像素不超过 2025 × 32 × 32。</p>' + src('§3.2.1 式 (1)(2) · feature_bridge.py · mask_decoder.py') },
    { n: 6, part: '§3.2.2 查询', title: '<OBJ> 和它的框变成一个查询', sub: '切换实例；采样点是代码里的初始位置，当场算', dur: 15, cam: [0.3, 1.08, 31, [1.6, 4.4, 0]], camE: [0.0, 1.14, 27, [2.2, 4.7, 0]],
      html: dl([['内容', 'q = LN(Linear(h))，h 是 2560 维（4B）'], ['位置', 'p = LN(MLP(φ(b)))，φ：4 × 64 = 256 维'], ['层数', '6 层，8 头，FFN 768'], ['采样', '8 头 × 4 层 × 4 点 = 128 个点 / 查询'], ['参考', 'r = (cx, cy, w, h)']]) +
        '<p>DETR 的查询是学出来的固定向量；这里每个查询直接来自语言模型：<code>&lt;OBJ&gt;</code> 的隐状态给内容，前面的框给位置。所以“要分割哪一个”在进解码器之前就定了。</p>' +
        '<p>自注意力让同一回复里的多个实例互相看（q + p 作 query 和 key，q 作 value）；可变形交叉注意力只在框附近采样记忆。初始化时 8 个头朝 8 个方向，第 k 个点在 k/4 个半框处，正好铺到框边。</p>' +
        guess('采样点是训练前的初始位置；训练后的偏移不知道。四层的点一样，因为四层是同一张网格、同一个初始化。') + src('§3.2.2 · mask_decoder.py · msda.py reset_parameters') },
    { n: 7, part: '§3.2.3 融合', title: '像素特征 P 和动态掩码头', sub: '切换输入图大小；每块的形状当场算', dur: 14, cam: [0.1, 1.12, 32, [0.5, 3.8, 0]],
      html: dl([['融合', '同尺度 FPN，自顶向下 3 步'], ['上采样', '两次 pixel shuffle，缩到 256，再 ×2 到 512'], ['RGB', '原图拉伸到 1024 → 两层 CNN → 512'], ['P', '64 × 512 × 512'], ['掩码头', '[k, β] = MLP(q̃)，65 维；M = kᵀP + β']]) +
        '<p>ViT 的网格是 16 像素一格，太粗，所以另开一条 RGB 小路找回颜色、纹理和边缘。两路在 512×512 上相加，得到所有实例共用的像素特征 P。</p>' +
        '<p>每个实例只贡献一个 64 维的核和一个偏置：粗掩码就是 P 在每个像素上和这个核做点积。实例越多，只多算几次点积。</p>' +
        '<p>解码器的 RGB 输入直接把原图拉伸成 1024×1024，不保持长宽比；最后再缩回原图。</p>' + src('§3.2.3 式 (3)(4)(5) · AdditivePixelFusion · DynamicMaskPredictor') },
    { n: 8, part: '§3.2.3 精修', title: '由粗到细：256 → 512 → 1024', sub: '切换代码和论文的写法；也可以关掉精修看粗掩码', dur: 14, cam: [0.06, 1.15, 30, [0.5, 3.4, 0]],
      html: dl([['级数', '3 级：S/4、S/2、S/1'], ['每级输入', '上一级特征、RGB、P、上一级 alpha'], ['调制', '(1 + 0.1·tanh γ)⊙U + 0.1·δ'], ['通道', '48，每级 2 个残差块'], ['参数', '441,123，占解码器 4.6%']]) +
        '<p>单次点积出来的掩码对发丝和半透明边界不够。精修每一级都把缩放后的原图拼进来，用实例查询做通道级的缩放和平移，再预测一个 logit 残差。</p>' +
        '<p><b>和论文的差别：</b>论文说从 512 开始三次上采样，那样会到 4096，和附录的 1024 输出对不上。代码的第一级先缩到 256，然后 512、1024。调制项多乘了 0.1。</p>' +
        '<p>公开的只有这一个解码器：分割也走完整三级，取 0.5 阈值。</p>' +
        guess('三张 alpha 是程序生成的玩具；分辨率和级数按代码。') + src('§3.2.3 式 (6)–(8) · 附录 B.2 · FullCanvasAlphaCascadeHead') },
    { n: 9, part: '§4.1 课程', title: '三阶段 SFT，解码器单独 warm-up 和微调', sub: '自动沿时间轴走，也可以点某一段；下排是哪些模块在训练', dur: 16, cam: [0.03, 1.15, 33, [0.4, 3.2, 0]],
      html: dl([['阶段 1', '只训 LLM，90.2M，16–512 token，≤ 50 框/类'], ['阶段 2', '全解冻，40.5M，≤ 1,960 token，≤ 500 框'], ['warm-up', '解码器 + VLM，250M 分割，只留解码器'], ['阶段 3', 'NTP : 分割 = 1 : 1，LoRA r = 128'], ['抠图', '冻结 VLM，130M，1024²'], ['RL', '只训 LLM，178K，593 步']]) +
        '<p>先学会格式，再学会看清小而密的东西，最后才接像素。warm-up 阶段 VLM 也在动，但这部分更新被丢掉，只把解码器和 <code>&lt;OBJ&gt;</code> 嵌入接回原来的阶段 2 检查点。</p>' +
        '<p>早期训练里一条回复几百个框的样本容易让模型陷入重复输出，所以阶段 1 每类最多 50 个，阶段 2 放到 500。</p>' + src('§4.1 · 表 1 · 表 11 · 附录 B.2') },
    { n: 10, part: '§4.2 RL', title: '挑拿不准的题，按整条回复给分', sub: '左边是式 (12)；右边切换情形，奖励按式 (13) 当场算', dur: 15, cam: [0.03, 1.15, 32, [0.3, 4.0, 0]],
      html: dl([['挑题', 'U = 4μ(1 − μ)σ，约 14 万条 + 补充 = 178K'], ['采样', '每题 G = 8 条回复'], ['匹配', '每类内一对一匈牙利匹配'], ['奖励', 'r = 2 Σ IoU³ / (N<sub>gt</sub> + N<sub>pred</sub>)'], ['负样本', '什么都不输出才得 1']]) +
        '<p>GRPO 只看组内相对优势：8 条全对或全错就没有信号。所以先用 SFT 模型采样，挑奖励方差大的题。</p>' +
        '<p>奖励在完整回复上算：漏检和多框都让分母变大；IoU 取三次方，让高 IoU 区的改进更值钱。分割和抠图的样本也只按框给分。</p>' +
        guess('框和 IoU 是玩具；左边曲线按“奖励只取 0 或 1”画，实际奖励是连续值。') + src('§4.2 式 (12)(13) · 附录 B.3') },
    { n: 11, part: '结果', title: '表里的数', sub: '切换四组；柱子都是原文表格的数字', dur: 12, cam: [0, 1.25, 31, [0, 4.6, 0]],
      html: dl([['检测', 'Dense200 Mean 71.3 vs 58.7'], ['拒答', 'WeRef-Bench 96.4%，Ref-ZOM 86.0%'], ['计数', 'MixCount test 40.4 vs 15.2'], ['抠图', 'WeRefMat 指代 MAD 9.8 vs 22.4']]) +
        '<p>每组三根柱：最强的非 WeVisOne 方法（检测和计数只比 VLM）、2B、4B。抠图是误差，越低越好。</p>' +
        '<p>拒答的差距最大：两个定位专用模型在 RefCOCOg-Rej 上都不到 1%，WeVisOne-VL-4B 是 67.4%。这来自数据引擎专门复核的困难负样本和 RL 的负样本奖励。</p>' + src('表 2 · 表 3 · 表 4 · 表 7 · 表 8') }
  ];

  const stepsEl = $('steps'), btns = $('sceneBtns');
  SCENES.forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" data-i="${i}"><span class="k">${s.n} · ${s.part}</span>${s.title.replace(/</g, '&lt;')}<small>${s.sub.replace(/</g, '&lt;')}</small></button>`;
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

  /* ---------- 3D helpers (same as interactives/lingbot-touch) ---------- */
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
  /* a label whose text changes: rebuilt only when the text differs */
  function dynLab(G, pos, o = {}) {
    const st = { s: null, t: null };
    const f = (t, p2) => { if (p2 && st.s) st.s.position.set(...p2); if (t === st.t) return; if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; if (t == null || t === '') { st.s = null; return; } st.s = lab(t, p2 || pos, o); G.add(st.s); };
    return f;
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function colI(im, n, c) { if (typeof c === 'number') c = hex3(c); _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.14) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.5, dashed: o.dashed }); G.add(l); return l; };
  function rect(G, x0, y0, x1, y1, z, color, o = {}) { return wire(G, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [x0, y0, z]], color, { opacity: o.opacity ?? 0.95, dashed: o.dashed }); }
  function panel(G, x, y, z, w, h, op = 0.55) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x0c1220, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }
  function ribbon(G, n, color, w = 0.06) {
    const pos = new Float32Array(n * 6), idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); m.frustumCulled = false; m.renderOrder = 2; G.add(m);
    m.userData.set = pts => { const k = Math.min(n, pts.length); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)], z = q[2] ?? 0; pos[i * 6] = q[0]; pos[i * 6 + 1] = q[1] - w / 2; pos[i * 6 + 2] = z; pos[i * 6 + 3] = q[0]; pos[i * 6 + 4] = q[1] + w / 2; pos[i * 6 + 5] = z; } g.attributes.position.needsUpdate = true; };
    return m;
  }

  /* ---------- the toy photo: two "dogs" on grass, boxes from Fig. 3 ---------- */
  function drawDogs(g, W, H, mode) {
    if (mode === 'photo') {
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#8fb8e8'); sky.addColorStop(0.45, '#cfe2f3'); sky.addColorStop(0.46, '#7fae5a'); sky.addColorStop(1, '#4f7d36');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
    } else { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
    DOGS.forEach(([x0, y0, x1, y1], i) => {
      const X = u => u / 1000 * W, Y = v => v / 1000 * H, bw = X(x1) - X(x0), bh = Y(y1) - Y(y0), cx = X(x0) + bw / 2;
      const fill = mode === 'photo' ? (i ? '#c8a06a' : '#8a5a33') : '#fff';
      g.fillStyle = fill;
      g.beginPath(); g.ellipse(cx, Y(y0) + bh * 0.62, bw * 0.46, bh * 0.3, 0, 0, Math.PI * 2); g.fill();          /* body */
      g.beginPath(); g.ellipse(cx + (i ? -1 : 1) * bw * 0.22, Y(y0) + bh * 0.28, bw * 0.2, bh * 0.2, 0, 0, Math.PI * 2); g.fill(); /* head */
      g.fillRect(X(x0) + bw * 0.12, Y(y0) + bh * 0.7, bw * 0.1, bh * 0.3); g.fillRect(X(x1) - bw * 0.22, Y(y0) + bh * 0.7, bw * 0.1, bh * 0.3); /* legs */
      if (mode === 'photo') { g.fillStyle = 'rgba(30,20,10,.55)'; g.beginPath(); g.ellipse(cx + (i ? -1 : 1) * bw * 0.3, Y(y0) + bh * 0.25, bw * 0.03, bh * 0.03, 0, 0, Math.PI * 2); g.fill(); }
    });
  }
  function canvasTex(W, H, fn) { const c = document.createElement('canvas'); c.width = W; c.height = H; fn(c.getContext('2d'), W, H); const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; return t; }
  function imgPlane(G, w, h, pos, mode = 'photo', op = 1) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: canvasTex(400, 300, (g, W, H) => drawDogs(g, W, H, mode)), transparent: op < 1, opacity: op, side: THREE.DoubleSide, depthWrite: op >= 1 }));
    m.position.set(...pos); G.add(m); return m;
  }
  /* per-mille image coords -> world, for a plane of size w x h centred at pos (image y points down) */
  const toW = (pos, w, h) => (u, v, dz = 0.02) => [pos[0] + (u / 1000 - 0.5) * w, pos[1] + (0.5 - v / 1000) * h, pos[2] + dz];
  function dogBox(G, pos, w, h, b, color, o) { const f = toW(pos, w, h), a = f(b[0], b[1]), c = f(b[2], b[3]); return rect(G, a[0], c[1], c[0], a[1], a[2], color, o); }

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
    const ip = [-12.2, 4.2, 0]; imgPlane(G, 4.8, 3.6, ip); G.add(lab('图像 + 指令', [-12.2, 1.7, 0], { size: 19 }));
    const vit = block(2.2, 4.2, 1.6, COL.vit, [-7, 4.2, 0]), llm = block(6.0, 1.8, 1.6, COL.llm, [0.2, 7.4, 0]);
    G.add(vit, llm, lab('ViT 24 层', [-7, 6.8, 0], { size: 19 }), lab('Qwen3-VL 语言模型（2B / 4B）', [0.2, 8.9, 0], { size: 19 }));
    const ada = block(2.6, 1.0, 1.2, COL.ada, [8.2, 5.6, 0]), qd = block(2.6, 1.0, 1.2, COL.qd, [8.2, 4.2, 0]), px = block(2.6, 1.0, 1.2, COL.pix, [8.2, 2.8, 0]);
    G.add(ada, qd, px, lab('像素解码器 9.6M', [8.2, 7.0, 0], { size: 19, color: '#7ee2a8' }), lab('适配器', [8.2, 5.6, 0.8], { size: 15 }), lab('查询解码器', [8.2, 4.2, 0.8], { size: 15 }), lab('稠密预测', [8.2, 2.8, 0.8], { size: 15 }));
    const mk1 = imgPlane(G, 3.0, 2.25, [13.6, 5.4, 0], 'mask'), mk2 = imgPlane(G, 3.0, 2.25, [13.6, 2.6, 0], 'mask', 0.85);
    G.add(lab('alpha × 2', [13.6, 0.9, 0], { size: 17 }));
    const wde = block(3.0, 1.0, 1.2, COL.data, [-12.2, -1.4, 0]), trn = block(3.4, 1.0, 1.2, COL.gold, [-6.4, -1.4, 0]);
    G.add(wde, trn, lab('数据引擎 WDE', [-12.2, -2.6, 0], { size: 17 }), lab('3 段 SFT + GRPO', [-6.4, -2.6, 0], { size: 17 }));
    wire(G, [[-10.7, -1.4, 0], [-8.1, -1.4, 0]], COL.data, { dashed: true });
    const tok = dynLab(G, [0.4, 4.6, 0], { size: 16, border: 'rgba(242,193,78,.7)' });
    const T = '<ref>dogs</ref><box><81><327><394><746><OBJ>,<552><284><902><721><OBJ></box>';
    const f = { a: stream(G, 5, COL.white), b: stream(G, 5, COL.vit), c: stream(G, 5, COL.obj), d: stream(G, 4, COL.dec) };
    wire(G, [[-7, 2.0, 0], [-7, 0.9, 0], [6.6, 0.9, 0], [6.9, 5.6, 0]], COL.vit, { dashed: true, opacity: 0.45 }); G.add(lab('第 5/11/17/23 层', [-1.5, 0.3, 0], { size: 15 }));
    [[vit, 5], [llm, 4], [ada, 5], [qd, 6], [px, 7], [mk1, 8], [mk2, 8], [wde, 2], [trn, 9]].forEach(([m, g]) => { m.userData.go = g - 1; PICKS.push(m); });
    return { update(p) {
      const q = (p * 16) % 1, k = Math.round(seg(p, 0.15, 0.55) * 14);
      const parts = T.match(/<[^>]+>|[^<]+/g); tok(parts.slice(0, Math.max(1, Math.round(parts.length * k / 14))).join('').replace('<OBJ>,', '<OBJ>,\n'));
      f.a([[-12.2, 4.2, 0], [-7, 4.2, 0], [-7, 7.4, 0], [-2.8, 7.4, 0]], q, 1);
      f.b([[-7, 2.0, 0], [-7, 0.9, 0], [6.6, 0.9, 0], [6.9, 5.6, 0]], q, seg(p, 0.5, 0.6));
      f.c([[2.0, 6.5, 0], [4.6, 4.2, 0], [6.9, 4.2, 0]], q, seg(p, 0.55, 0.62));
      f.d([[9.5, 2.8, 0], [12.1, 3.8, 0]], q, seg(p, 0.7, 0.78));
      glow(llm, 0.5 * (1 - seg(p, 0.55, 0.7))); [ada, qd, px].forEach((m, i) => glow(m, 0.6 * seg(p, 0.58 + i * 0.05, 0.66 + i * 0.05)));
      mk1.material.opacity = mk2.material.opacity = 0.15 + 0.85 * seg(p, 0.75, 0.88); mk1.material.transparent = mk2.material.transparent = true;
      cap(p < 0.55 ? '语言模型逐个生成 token：名称、坐标，以及每个框后的 <b>&lt;OBJ&gt;</b>' : '每个 <b>&lt;OBJ&gt;</b> 的隐状态 + 它的框 + ViT 四层特征 → 像素解码器 → 一张整图大小的 alpha');
    } };
  }

  /* ---------- scene 2: the data engine (Fig. 2) ---------- */
  function s2(G) {
    let route = +(OPT[0] ?? 0);
    const B = (t, c, x, y, w = 3.4) => { const b = block(w, 1.1, 1.0, c, [x, y, 0]); G.add(b, lab(t, [x, y + 1.15, 0], { size: 15 })); return b; };
    const ta = B('Tokenize Anything：类别', COL.data, -11.4, 8), qv = B('Qwen3-VL：指代表达', COL.data, -11.4, 5.6), kg = B('知识图谱\nWikipedia、WordNet', COL.data, -11.4, 3.2, 3.4), acq = B('定向采集', COL.data, -11.4, 0.8);
    const det = B('检测：SAM3 + 自研 OV 检测器', COL.vit, -4.2, 7.2, 4.6), refp = B('指代：SAM3 Agent + 自研 OV', COL.ref, -4.2, 4.0, 4.6);
    const judge = B('Qwen3-VL 逐个核验', COL.llm, 2.6, 5.6, 3.6);
    const boxes = B('保留检测器的框', COL.gt, 8.6, 8.0), masks = B('SAM2 可见区域掩码', COL.gt, 8.6, 5.6), mat = B('抠图引擎 → alpha', COL.obj, 8.6, 3.2), uni = B('统一监督 ×4', COL.white, 13.4, 5.6, 2.6);
    const trn = B('训练', COL.gold, 8.6, -1.2, 2.4), rev = B('错误复核', COL.bad, 2.6, -1.2, 2.6), fix = B('数据修正 · 困难样本', COL.bad, -4.2, -1.2, 4.0);
    G.add(lab('1 亿多张图 · 约 36 亿个框', [0.8, 10.6, 0], { size: 22, border: 'rgba(56,209,255,.7)' }));
    const P0 = [[-11.4, 0.8, 0], [-8, 0.8, 0], [-8, 7.2, 0], [-4.2, 7.2, 0], [2.6, 5.6, 0], [8.6, 8.0, 0], [8.6, 5.6, 0], [8.6, 3.2, 0], [13.4, 5.6, 0]];
    const P1 = [[-11.4, 0.8, 0], [-8, 0.8, 0], [-8, 4.0, 0], [-4.2, 4.0, 0], [2.6, 5.6, 0], [8.6, 8.0, 0], [8.6, 5.6, 0], [8.6, 3.2, 0], [13.4, 5.6, 0]];
    const LOOP = [[13.4, 5.6, 0], [13.4, -1.2, 0], [8.6, -1.2, 0], [2.6, -1.2, 0], [-4.2, -1.2, 0], [-11.4, -1.2, 0], [-11.4, 0.8, 0]];
    wire(G, LOOP, COL.bad, { dashed: true, opacity: 0.45 }); wire(G, P0, COL.vit, { opacity: 0.25 }); wire(G, P1, COL.ref, { opacity: 0.25 });
    wire(G, [[-11.4, 8, 0], [-11.4, 3.2, 0]], COL.data, { opacity: 0.4 });
    const f = stream(G, 7, COL.white), g2 = stream(G, 6, COL.bad);
    const ctls = [{ label: '路线', items: ['检测（类别查询）', '指代（表达查询）'], get: () => route, set: k => { route = k; } }];
    return { ctls, update(p) {
      const q = (p * 10) % 1, P = route ? P1 : P0;
      f(P, q, 1 - seg(p, 0.66, 0.72)); g2(LOOP, q, seg(p, 0.66, 0.72));
      glow(det, route ? 0.05 : 0.6); glow(refp, route ? 0.6 : 0.05); glow(judge, 0.4); [trn, rev, fix].forEach(m => glow(m, 0.6 * seg(p, 0.66, 0.75)));
      [ta, qv, kg, acq, boxes, masks, mat, uni].forEach((m, i) => glow(m, 0.12));
      cap(p < 0.66 ? (route ? '指代：SAM3 Agent 和自研检测器按<b>表达</b>出候选，Qwen3-VL 检查属性、状态、动作、关系' : '检测：SAM3 和自研 OV 检测器按<b>类别</b>出候选，合并成候选池，Qwen3-VL 逐个核验') : '每轮训练后：错误聚类 → 复核 → <b>标注错才改</b>；误报变困难负样本，漏检加采集');
    } };
  }

  /* ---------- scene 3: BiRefNet acceptance rules on a toy grid ---------- */
  function s3(G) {
    let mode = +(OPT[0] ?? 0); const N = 48, CS = 0.2, x0 = -9.6, y0 = -1.4, z = 0;
    const im = inst(BOX, N * N); G.add(im);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) setI(im, i * N + j, [x0 + (i + 0.5) * CS, y0 + (j + 0.5) * CS, z], [CS * 0.92, CS * 0.92, 0.05]);
    done(im);
    const inS = (x, y) => ((x - 0) / 0.30) ** 2 + ((y - 0.02) / 0.38) ** 2 <= 1;
    const RULES = ['|B| ≥ 8', 'IoU ≥ 0.5', '覆盖 ≥ 0.5', '精度 ≥ 0.8', '面积比 ∈ [0.5, 2]', '框 IoU ≥ 0.7', '质心偏移 ≤ 0.15·对角线'];
    const rl = RULES.map((r, k) => dynLab(G, [5.2, 8.2 - k * 1.25, 0], { size: 18 }));
    const verdict = dynLab(G, [5.2, -0.6, 0], { size: 21 });
    G.add(lab('■ 只在 S', [-8.2, -2.4, 0], { size: 16, color: '#5b8cff' }), lab('■ 只在 B', [-5.0, -2.4, 0], { size: 16, color: '#f0963c' }), lab('■ 两者都有', [-1.6, -2.4, 0], { size: 16, color: '#4fc98a' }), lab('S = SAM2 掩码　B = BiRefNet 前景（0.5 二值化）', [-4.8, -3.6, 0], { size: 16 }));
    const inB = (x, y, t) => {
      if (mode === 0) return inS(x - 0.36 * t, y);                                          /* shift */
      if (mode === 1) return inS(x, y) || (x > 0.18 && x < 0.18 + 0.3 * t && y > -0.42 && y < 0.1); /* extra region grows */
      if (mode === 2) return inS(x, y) && y > 0.42 - 0.84 * t;                             /* only part of the object */
      const s = 1 + 0.9 * t; return inS(x / s, y / s);                                      /* blow-up */
    };
    const ctls = [{ label: '情形', items: ['平移', '多抠一块', '只抠一部分', '放大'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const t = seg(p, 0.05, 0.95); let nS = 0, nB = 0, nI = 0, sx = 0, sy = 0, bx = 0, by = 0;
      const bbS = [1, 1, -1, -1], bbB = [1, 1, -1, -1];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const x = (i + 0.5) / N - 0.5, y = (j + 0.5) / N - 0.5, a = inS(x, y), b = inB(x, y, t);
        if (a) { nS++; sx += x; sy += y; bbS[0] = Math.min(bbS[0], x); bbS[1] = Math.min(bbS[1], y); bbS[2] = Math.max(bbS[2], x); bbS[3] = Math.max(bbS[3], y); }
        if (b) { nB++; bx += x; by += y; bbB[0] = Math.min(bbB[0], x); bbB[1] = Math.min(bbB[1], y); bbB[2] = Math.max(bbB[2], x); bbB[3] = Math.max(bbB[3], y); }
        if (a && b) nI++;
        colI(im, i * N + j, a && b ? COL.ok : a ? COL.vit : b ? COL.pred : 0x1a2133);
      }
      done(im);
      const iou = nI / Math.max(1, nS + nB - nI), cov = nI / Math.max(1, nS), prec = nI / Math.max(1, nB), ar = nB / Math.max(1, nS);
      const h = 1 / N, area = bb => Math.max(0, bb[2] - bb[0] + h) * Math.max(0, bb[3] - bb[1] + h);
      const ix = Math.max(0, Math.min(bbS[2], bbB[2]) - Math.max(bbS[0], bbB[0]) + h), iy = Math.max(0, Math.min(bbS[3], bbB[3]) - Math.max(bbS[1], bbB[1]) + h);
      const bIoU = nB ? ix * iy / (area(bbS) + area(bbB) - ix * iy) : 0;
      const diag = Math.hypot(bbS[2] - bbS[0] + h, bbS[3] - bbS[1] + h), off = nB ? Math.hypot(bx / nB - sx / nS, by / nB - sy / nS) / diag : 1;
      const V = [[nB >= 8, `|B| = ${nB}`], [iou >= 0.5, `IoU = ${iou.toFixed(2)}`], [cov >= 0.5, `覆盖 = ${cov.toFixed(2)}`], [prec >= 0.8, `精度 = ${prec.toFixed(2)}`], [ar >= 0.5 && ar <= 2, `面积比 = ${ar.toFixed(2)}`], [bIoU >= 0.7, `框 IoU = ${bIoU.toFixed(2)}`], [off <= 0.15, `质心偏移 = ${off.toFixed(2)}·对角线`]];
      V.forEach(([ok, s], k) => rl[k]((ok ? '✓ ' : '✗ ') + s + '　（' + RULES[k] + '）'));
      const all = V.every(v => v[0]);
      verdict(all ? '七条全过 → 用 BiRefNet 的 alpha' : '被拒 → 看 MatAnyone2（IoU ≥ 0.9）或保留 S');
      cap(`|S| = ${nS}，|B| = ${nB}，|B∩S| = ${nI} · IoU ${iou.toFixed(2)} · 精度 ${prec.toFixed(2)} → <b>${all ? '接受' : '拒绝'}</b>`);
    } };
  }

  /* ---------- scene 4: the token format ---------- */
  function s4(G) {
    let task = +(OPT[0] ?? 0); const ip = [-8.2, 4.0, 0], IW = 8.4, IH = 6.3; imgPlane(G, IW, IH, ip);
    const ctr = b => [Math.floor((b[0] + b[2]) / 2), Math.floor((b[1] + b[3]) / 2)];
    const C = b => b.map(v => `<${v}>`);
    const TASKS = [
      { q: 'Locate all the instances that match\nthe following description: dog.', t: ['<ref>', 'dog', '</ref>', '<box>', ...C(DOGS[0]), ',', ...C(DOGS[1]), '</box>'] },
      { q: 'Locate the instances that match the\nfollowing description: the dog on the right.', t: ['<ref>', 'the dog on the right', '</ref>', '<box>', ...C(DOGS[1]), '</box>'] },
      { q: 'point to: dog', t: ['<ref>', 'dog', '</ref>', '<point>', ...C(ctr(DOGS[0])), ',', ...C(ctr(DOGS[1])), '</point>'] },
      { q: 'How many dogs in the image?\nPlease count them with boxes.', t: ['<ref>', 'dogs', '</ref>', '<box>', ...C(DOGS[0]), ',', ...C(DOGS[1]), '</box>', 'Total number: 2.'] },
      { q: 'Locate the instances that match the following\ndescription and provide the alpha mattes: dogs.', t: ['<ref>', 'dogs', '</ref>', '<box>', ...C(DOGS[0]), '<OBJ>', ',', ...C(DOGS[1]), '<OBJ>', '</box>'] },
      { q: 'Locate the instances that match the\nfollowing description: a cat.', t: ['<ref>', 'a cat', '</ref>', '<box>', 'None', '</box>'] }];
    const sub = new THREE.Group(); G.add(sub); let last = -1, toks = [], marks = [], pts = [];
    const qlab = dynLab(G, [-8.2, 8.3, 0], { size: 16, border: 'rgba(56,209,255,.6)' });
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); toks = []; marks = []; pts = []; last = task;
      const T = TASKS[task].t; let x = 0.6, y = 7.6;
      T.forEach((s, i) => {
        const isC = /^<\d+>$/.test(s), isObj = s === '<OBJ>', w = Math.max(1.0, s.length * 0.2 + 0.4);
        if (x + w > 14.5) { x = 0.6; y -= 1.7; }
        const c = isObj ? COL.obj : isC ? COL.tok : /^</.test(s) ? COL.llm : COL.white;
        const b = block(w, 0.7, 0.5, c, [x + w / 2, y, 0], { opacity: 0.9 }); sub.add(b); const l = lab(s, [x + w / 2, y + 0.75, 0], { size: 15 }); sub.add(l);
        toks.push({ b, l, isC, isObj }); x += w + 0.18;
      });
      const box = task === 1 ? [DOGS[1]] : task === 5 ? [] : DOGS;
      if (task === 2) DOGS.forEach(b => { const m = new THREE.Mesh(BALL, L.mat(COL.pred)); m.scale.setScalar(0.22); m.position.set(...toW(ip, IW, IH)(...ctr(b), 0.2)); sub.add(m); pts.push(m); });
      else box.forEach(b => { marks.push(dogBox(sub, ip, IW, IH, b, task === 4 ? COL.obj : COL.pred)); });
    }
    const ctls = [{ label: '任务', items: ['检测', '指代', '指点', '计数', '抠图', '拒答'], get: () => task, set: k => { task = k; } }];
    return { ctls, update(p) {
      if (last !== task) rebuild();
      qlab('输入：' + TASKS[task].q);
      const n = toks.length, k = Math.floor(seg(p, 0.08, 0.7) * n + 1e-6); let coords = 0;
      toks.forEach((t, i) => { const on = i < k; t.b.visible = t.l.visible = on; if (on && t.isC) coords++; glow(t.b, t.isObj && on ? 0.8 : 0.1); });
      const per = task === 2 ? 2 : 4; marks.forEach((m, i) => { m.visible = coords >= per * (i + 1) || (task === 1 && coords >= 4); }); pts.forEach((m, i) => { m.visible = coords >= per * (i + 1); });
      const nObj = toks.slice(0, k).filter(t => t.isObj).length;
      cap(`${task === 5 ? '没有符合的目标：坐标字段写 <b>None</b>，不出框' : `已生成 ${Math.min(k, n)} / ${n} 个 token，其中坐标 token ${coords} 个`}${nObj ? ` · <b>${nObj}</b> 个 &lt;OBJ&gt; 会各调一次像素解码器` : ''}`);
    } };
  }

  /* ---------- scene 5: four pre-merge ViT layers ---------- */
  function s5(G) {
    let sz = +(OPT[0] ?? 1);
    const layers = []; for (let l = 0; l < 24; l++) { const tap = CFG.taps.includes(l), b = block(0.32, 3.6, 3.0, tap ? COL.obj : COL.vit, [-11 + l * 0.52, 6.2, 0], { opacity: tap ? 1 : 0.55 }); G.add(b); layers.push(b); if (tap) G.add(lab(`第 ${l} 层`, [-11 + l * 0.52, 8.6, 0], { size: 15 })); }
    G.add(lab('Qwen3-VL ViT：24 层 × 1024 维', [-1.0, 9.8, 0], { size: 19 }));
    const llm = block(3.0, 1.4, 1.4, COL.llm, [7.5, 7.0, 0]); G.add(llm, lab('2×2 合并 → LLM', [7.5, 8.3, 0], { size: 16 }));
    const sub = new THREE.Group(); G.add(sub); let last = -1, maps = [];
    const ada = block(3.2, 1.2, 1.2, COL.ada, [9.0, 1.6, 0]); G.add(ada, lab('适配器\n1024 → 192，3 块', [9.0, 3.2, 0], { size: 15 }));
    const info = dynLab(G, [-2.0, -2.4, 0], { size: 16, border: 'rgba(242,193,78,.6)' });
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); maps = []; last = sz;
      const r = smartResize(...SIZES[sz]), w = 2.6, h = w * r.Hp / r.Wp;
      CFG.taps.forEach((l, k) => {
        const x = -9.6 + k * 4.2, y = 1.6; const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x24304a, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })); pl.position.set(x, y, 0); sub.add(pl);
        const stepX = Math.max(1, Math.round(r.Wp / 24)), stepY = Math.max(1, Math.round(r.Hp / 18));
        for (let i = 0; i <= r.Wp; i += stepX) wire(sub, [[x - w / 2 + i / r.Wp * w, y - h / 2, 0.01], [x - w / 2 + i / r.Wp * w, y + h / 2, 0.01]], COL.obj, { opacity: 0.35 });
        for (let j = 0; j <= r.Hp; j += stepY) wire(sub, [[x - w / 2, y - h / 2 + j / r.Hp * h, 0.01], [x + w / 2, y - h / 2 + j / r.Hp * h, 0.01]], COL.obj, { opacity: 0.35 });
        sub.add(lab(`F${k + 1}：${r.Hp}×${r.Wp}`, [x, y - h / 2 - 0.6, 0], { size: 15 }));
        maps.push({ pl, x, y, l });
      });
    }
    const ctls = [{ label: '原图', items: SIZES.map(s => `${s[0]}×${s[1]}`), get: () => sz, set: k => { sz = k; } }];
    const f = stream(G, 4, COL.obj, 0.12);
    return { ctls, update(p) {
      if (last !== sz) rebuild();
      const r = smartResize(...SIZES[sz]), hi = Math.floor(seg(p, 0.05, 0.45) * 24);
      layers.forEach((b, l) => glow(b, l <= hi ? (CFG.taps.includes(l) ? 0.9 : 0.25) : 0.02));
      maps.forEach((m, k) => { const on = seg(p, 0.2 + k * 0.08, 0.3 + k * 0.08); m.pl.material.opacity = 0.2 + 0.7 * on; });
      f([[-11 + 23 * 0.52, 6.2, 0], [3.0, 1.6, 0], [9.0, 1.6, 0]], (p * 8) % 1, seg(p, 0.5, 0.6)); glow(ada, 0.6 * seg(p, 0.55, 0.65)); glow(llm, 0.3);
      info(`缩放后 ${r.W}×${r.H} · 合并前网格 ${r.Hp}×${r.Wp} = ${fmt(r.Hp * r.Wp)}（每格 1024 维）\nLLM 看到 ${fmt(r.tok)} 个视觉 token · 解码器记忆 4 × ${fmt(r.Hp * r.Wp)} = ${fmt(4 * r.Hp * r.Wp)} 个`);
      cap(`原图 ${SIZES[sz][0]}×${SIZES[sz][1]} → smart-resize ${r.W}×${r.H} → 每层 <b>${r.Hp}×${r.Wp}</b> 个 patch（合并前）；LLM 只看到 ${fmt(r.tok)} 个合并后的 token`);
    } };
  }

  /* ---------- scene 6: box-guided query decoder; sampling points from msda.reset_parameters ---------- */
  function s6(G) {
    let which = +(OPT[0] ?? 0), size = +(OPT[1] ?? 1); const IW = 8.4, IH = 6.3, ip = [-6.6, 3.6, 0];
    const LZ = [0, -1.1, -2.2, -3.3];
    LZ.forEach((dz, k) => { if (k) { const m = new THREE.Mesh(new THREE.PlaneGeometry(IW, IH), new THREE.MeshBasicMaterial({ color: 0x24304a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })); m.position.set(ip[0], ip[1], dz); G.add(m); } });
    imgPlane(G, IW, IH, ip); G.add(lab('记忆 M：四层，叠在原图上', [ip[0], ip[1] + IH / 2 + 0.7, 0], { size: 16 }));
    const bx = [dogBox(G, ip, IW, IH, DOGS[0], COL.pred), dogBox(G, ip, IW, IH, DOGS[1], COL.pred)];
    const NP = CFG.heads * CFG.levels * CFG.points, dots = inst(BALL, NP); dots.material.emissive.setHex(COL.obj); dots.material.emissiveIntensity = 0.5; G.add(dots);
    const hb = block(2.0, 0.8, 0.8, COL.obj, [2.4, 7.6, 0]), qb = block(1.4, 0.8, 0.8, COL.qd, [7.0, 7.6, 0]);
    const fb = block(2.0, 0.8, 0.8, COL.pred, [2.4, 4.4, 0]), pb = block(1.4, 0.8, 0.8, COL.qd, [6.4, 4.4, 0]);
    const stack = []; for (let i = 0; i < 6; i++) { const b = block(2.8, 0.42, 1.6, COL.qd, [10.6, 3.0 + i * 0.62, 0], { opacity: 0.85 }); G.add(b); stack.push(b); }
    G.add(hb, qb, fb, pb, lab('Linear', [4.4, 6.9, 0], { size: 14 }), lab('MLP', [4.4, 5.1, 0], { size: 14 }), lab('q：192', [7.0, 8.5, 0], { size: 15 }), lab('p：192', [6.4, 3.5, 0], { size: 15 }), lab('6 层：自注意力\n可变形交叉注意力、FFN', [10.6, 7.6, 0], { size: 15 }));
    const hl = dynLab(G, [1.9, 8.5, 0], { size: 15 }), fl = dynLab(G, [2.4, 3.5, 0], { size: 15 }), out = block(1.4, 0.8, 0.8, COL.qd, [10.6, 1.4, 0]); G.add(out, lab('q̃ → 稠密预测', [10.6, 0.5, 0], { size: 15 }));
    wire(G, [[7.7, 7.6, 0], [9.2, 5.6, 0]], COL.qd); wire(G, [[7.1, 4.4, 0], [9.2, 3.6, 0]], COL.qd);
    const ctls = [{ label: '实例', items: ['左边的狗', '右边的狗'], get: () => which, set: k => { which = k; } }, { label: '模型', items: ['2B', '4B'], get: () => size, set: k => { size = k; } }];
    return { ctls, update(p) {
      const b = DOGS[which], cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, w = b[2] - b[0], h = b[3] - b[1], f = toW(ip, IW, IH);
      hl(`<OBJ> h：${CFG.llm[size ? '4B' : '2B']} 维`); fl(`框 → φ：256 维`);
      const shown = seg(p, 0.35, 0.85) * NP; let n = 0;
      for (let lv = 0; lv < CFG.levels; lv++) for (let hd = 0; hd < CFG.heads; hd++) {
        const th = hd * 2 * Math.PI / CFG.heads, c = Math.cos(th), s = Math.sin(th), m = Math.max(Math.abs(c), Math.abs(s));
        for (let k = 0; k < CFG.points; k++) {
          const idx = lv * 32 + hd * 4 + k, on = idx < shown ? 1 : 0;
          const u = cx + (c / m) * (k + 1) / CFG.points * w * 0.5, v = cy + (s / m) * (k + 1) / CFG.points * h * 0.5, q = f(u, v, 0.08 + LZ[lv]);
          setI(dots, n++, q, 0.09 * on + 1e-4);
        }
      }
      done(dots);
      bx.forEach((m, i) => { m.material.opacity = i === which ? 1 : 0.25; });
      glow(hb, 0.6 * seg(p, 0, 0.15)); glow(fb, 0.6 * seg(p, 0.05, 0.2)); glow(qb, 0.6 * seg(p, 0.15, 0.3)); glow(pb, 0.6 * seg(p, 0.15, 0.3));
      const layer = Math.floor(seg(p, 0.3, 0.9) * 6 - 1e-6); stack.forEach((m, i) => glow(m, i <= layer ? 0.6 : 0.05)); glow(out, 0.6 * seg(p, 0.88, 0.95));
      cap(`参考框 r = (${(cx / 1000).toFixed(3)}, ${(cy / 1000).toFixed(3)}, ${(w / 1000).toFixed(3)}, ${(h / 1000).toFixed(3)}) · 8 头 × 4 层 × 4 点 = <b>${Math.round(shown)}</b> / 128 个采样点；第 k 个点在 k/4 个半框处`);
    } };
  }

  /* ---------- scene 7: pixel fusion and the dynamic mask head ---------- */
  function s7(G) {
    let sz = +(OPT[0] ?? 1); const sub = new THREE.Group(); G.add(sub); let last = -1, B = [];
    const S = (px) => 0.6 + Math.log2(px / 32) * 0.55; /* on-screen size grows with log2 of the resolution */
    const k = block(0.6, 2.4, 0.6, COL.obj, [11.2, 7.2, 0]); G.add(k, lab('[k, β] = MLP(q̃)：64 + 1', [11.2, 9.0, 0], { size: 15 }));
    const mk = imgPlane(G, 3.6, 3.6, [11.2, 2.0, 0], 'mask'); G.add(lab('粗掩码 M = kᵀP + β：512×512', [11.2, -0.4, 0], { size: 15 }));
    const info = dynLab(G, [0, -2.8, 0], { size: 16, border: 'rgba(242,193,78,.6)' });
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); B = []; last = sz;
      const r = smartResize(...SIZES[sz]);
      const steps = [
        ['X⁽ᵀ⁾ ×4', `${r.Hp}×${r.Wp}×192`, Math.max(r.Hp, r.Wp), COL.ada, -11.5, 6.5],
        ['同尺度 FPN', `${r.Hp}×${r.Wp}×192`, Math.max(r.Hp, r.Wp), COL.ada, -8.2, 6.5],
        ['pixel shuffle ×2 ×2', `${4 * r.Hp}×${4 * r.Wp}×64`, 4 * Math.max(r.Hp, r.Wp), COL.pix, -4.6, 6.5],
        ['缩到 S/4', '256×256×64', 256, COL.pix, -0.8, 6.5],
        ['残差 ×2', '512×512×64', 512, COL.pix, 3.2, 6.5],
        ['原图拉伸', '1024×1024×3', 1024, COL.white, -4.6, 0.4],
        ['两层 CNN', '512×512×64', 512, COL.white, -0.8, 0.4],
        ['P = 两路相加', '64×512×512', 512, COL.dec, 6.4, 3.8]];
      steps.forEach(([t, s, px, c, x, y]) => { const e = S(px); const b = block(e * 0.9, e, 0.25 + e * 0.05, c, [x, y, 0], { opacity: 0.88 }); sub.add(b, lab(t, [x, y + e / 2 + 0.95, 0], { size: 15 }), lab(s, [x, y - e / 2 - 0.5, 0], { size: 14 })); B.push(b); });
      wire(sub, [[-11.5, 6.5, 0], [3.2, 6.5, 0], [6.4, 3.8, 0]], COL.pix, { opacity: 0.35 }); wire(sub, [[-4.6, 0.4, 0], [-0.8, 0.4, 0], [6.4, 3.8, 0]], COL.white, { opacity: 0.35 });
    }
    const ctls = [{ label: '原图', items: SIZES.map(s => `${s[0]}×${s[1]}`), get: () => sz, set: k2 => { sz = k2; } }];
    const fa = stream(G, 4, COL.pix), fb = stream(G, 4, COL.white), fc = stream(G, 3, COL.obj);
    return { ctls, update(p) {
      if (last !== sz) rebuild(); const r = smartResize(...SIZES[sz]), q = (p * 9) % 1;
      B.forEach((b, i) => glow(b, 0.6 * seg(p, i * 0.07, i * 0.07 + 0.12)));
      fa([[-11.5, 6.5, 0], [3.2, 6.5, 0], [6.4, 3.8, 0]], q, seg(p, 0, 0.1)); fb([[-4.6, 0.4, 0], [6.4, 3.8, 0]], q, seg(p, 0.3, 0.4)); fc([[11.2, 7.2, 0], [11.2, 2.0, 0]], q, seg(p, 0.62, 0.7));
      glow(k, 0.7 * seg(p, 0.6, 0.7)); mk.material.transparent = true; mk.material.opacity = 0.1 + 0.9 * seg(p, 0.7, 0.85);
      info(`${r.Hp}×${r.Wp} → ×4 → ${4 * r.Hp}×${4 * r.Wp} → 缩放到 256×256（超过 256 的边先平均池化）→ 512×512\nRGB 1024 → 512；每个实例一次 64 维点积`);
      cap(p < 0.6 ? `像素特征 <b>P</b>：64 × 512 × 512，所有实例共用（ViT 网格 ${r.Hp}×${r.Wp} 先放大 4 倍）` : '每个实例只给一个 <b>64 维核 + 偏置</b>：粗掩码是 P 和核的逐像素点积');
    } };
  }

  /* ---------- scene 8: coarse-to-fine refinement (code: S/4 -> S/2 -> S/1) ---------- */
  function s8(G) {
    let view = +(OPT[0] ?? 0); const RES = [24, 48, 96], X = [-9, -1.5, 7], W = 6.0;
    const alphaAt = (x, y, sharp) => { /* toy subject: a head with strands of hair; sharp in [0,1] reveals strands */
      const r = Math.hypot(x, y + 0.08), body = 1 / (1 + Math.exp((r - 0.3) / (0.06 - 0.045 * sharp)));
      const ang = Math.atan2(y + 0.08, x), strand = Math.pow(Math.abs(Math.cos(ang * 9)), 18) * (r > 0.28 && r < 0.43 && y > -0.1 ? 1 : 0) * Math.max(0, 1 - (r - 0.28) / 0.15);
      return clamp(body + sharp * 0.85 * strand, 0, 1); };
    const ims = RES.map((n, s) => { const m = inst(BOX, n * n); m.material = new THREE.MeshBasicMaterial({ color: 0xffffff }); G.add(m); const cs = W / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) setI(m, i * n + j, [X[s] - W / 2 + (i + 0.5) * cs, 4.0 - W / 2 + (j + 0.5) * cs, 0], [cs, cs, 0.02]); done(m); return m; });
    const tl = RES.map((n, s) => dynLab(G, [X[s], 7.9, 0], { size: 17 })), bl = RES.map((n, s) => dynLab(G, [X[s], 0.1, 0], { size: 15 }));
    const ctls = [{ label: '看', items: ['代码：256 → 512 → 1024', '论文写法', '关掉精修'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      const NAMES = view === 1 ? ['512 → 1024（j = 1）', '→ 2048（j = 2）？', '→ 4096（j = 3）？'] : ['S/4：256×256', 'S/2：512×512', 'S/1：1024×1024'];
      RES.forEach((n, s) => {
        const on = view === 2 ? (s === 2 ? 1 : 0) : seg(p, s * 0.28, s * 0.28 + 0.2), sharp = view === 2 ? 0 : [0.25, 0.6, 1][s] * on;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = on ? alphaAt((i + 0.5) / n - 0.5, (j + 0.5) / n - 0.5, sharp) : 0.05; colI(ims[s], i * n + j, [a, a, a]); }
        done(ims[s]);
        tl[s](view === 2 && s === 2 ? '只用粗掩码，双线性放大到 1024' : NAMES[s]);
        bl[s](view === 2 ? (s === 2 ? '发丝丢了' : '（跳过）') : s === 0 ? '粗掩码 512 先缩到 256 + 残差' : s === 1 ? '残差加在原始粗掩码上' : '残差加在放大的 S/2 结果上');
      });
      cap(view === 1 ? '论文：“从 512 开始三次上采样”——每次 ×2 会到 <b>4096</b>，和附录 B.2 的 1024 输出对不上' : view === 2 ? '没有精修：点积出来的粗掩码在 512 上算，放大后边缘发糊，细丝出不来' : '每级：上一级特征 ‖ RGB ‖ P ‖ 上一级 alpha → 1×1 卷积 → <b>(1 + 0.1·tanh γ)⊙U + 0.1·δ</b> → 2 个残差块 → logit 残差');
    } };
  }

  /* ---------- scene 9: the curriculum ---------- */
  function s9(G) {
    let pick = +(OPT[0] ?? 0);
    const ST = [
      ['SFT 阶段 1', 90.2e6, '90.2M', '13,000 步', [0, 0, 1, 1, 0], '16–512 token · 上下文 4,096 · ≤ 50 框/类 · LR 2e-5'],
      ['SFT 阶段 2', 40.5e6, '40.5M', '8,995 步', [1, 1, 1, 1, 0], '64–1,960 token · 上下文 8,192 · ≤ 500 框 · LR 5e-6，ViT 5e-7'],
      ['解码器 warm-up', 250e6, '250M', '100K 步', [1, 1, 1, 1, 1], '式 (9)：20·focal + Dice · 512×512 · 只留解码器和 <OBJ> 嵌入'],
      ['SFT 阶段 3', 41.8e6, '41.8M', '9,062 步', [1, 1, 1, 1, 1], '式 (10)：NTP + 10·seg，1:1 交替 · LLM 用 LoRA r = 128'],
      ['抠图微调', 130e6, '130M', '100K 步', [0, 0, 0, 0, 1], '式 (11)：200·L1 + 5·grad + 50·lap + hard · 1024×1024'],
      ['RL（GRPO）', 178e3, '178K', '593 步', [0, 0, 1, 0, 0], '式 (13) · G = 8 · LR 1e-6 · 只按框给分']];
    const MOD = ['ViT', '投影', 'LLM', '<OBJ> 嵌入', '像素解码器'], MC = [COL.vit, COL.vit, COL.llm, COL.obj, COL.dec];
    const bars = ST.map((s, i) => { const h = Math.log10(s[1]) - 4.6, x = -12 + i * 4.8, b = block(3.6, h, 1.4, i === 5 ? COL.gold : i === 2 || i === 4 ? COL.dec : COL.llm, [x, h / 2 + 3.0, 0], { opacity: 0.9 });
      G.add(b, lab(s[0], [x, 2.2, 1], { size: 16 }), lab(`${s[2]} · ${s[3]}`, [x, h + 3.7, 0], { size: 15 })); b.userData.go = i; return b; });
    G.add(lab('柱高按样本数取对数', [-12, 9.6, 0], { size: 14 }));
    const mods = MOD.map((m, j) => { const b = block(3.2, 0.9, 0.9, MC[j], [-9.6 + j * 4.8, -0.6, 0]); G.add(b, lab(m, [-9.6 + j * 4.8, -1.9, 0], { size: 16 })); return b; });
    const cursor = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 16), L.mat(COL.gold)); cursor.rotation.z = Math.PI; G.add(cursor);
    const det = dynLab(G, [0, -3.4, 0], { size: 16, border: 'rgba(242,193,78,.6)' });
    const ctls = [{ label: '阶段', items: ['自动', 'S1', 'S2', 'warm-up', 'S3', '抠图', 'RL'], get: () => pick, set: k => { pick = k; } }];
    return { ctls, update(p) {
      const i = pick ? pick - 1 : Math.min(5, Math.floor(p * 6)), s = ST[i];
      bars.forEach((b, k) => glow(b, k === i ? 0.7 : 0.05)); cursor.position.set(-12 + i * 4.8, Math.log10(ST[i][1]) - 4.6 + 4.9, 0);
      mods.forEach((m, j) => { glow(m, s[4][j] ? 0.8 : 0); m.material.opacity = s[4][j] ? 1 : 0.25; m.material.transparent = true; });
      det(`${s[0]}：${s[5]}`);
      cap(`${s[0]} · ${s[2]} 样本 · ${s[3]} · 在训：<b>${MOD.filter((m, j) => s[4][j]).join('、') || '—'}</b>${i === 2 ? '（VLM 的更新事后丢掉）' : ''}`);
    } };
  }

  /* ---------- scene 10: uncertainty score and the grounding reward ---------- */
  function s10(G) {
    let sc = +(OPT[0] ?? 0);
    /* left: U(mu) for 0/1 rewards over G = 8 rollouts */
    const ox = -12.5, oy = 0.5, cw = 9, chh = 7;
    wire(G, [[ox, oy, 0], [ox + cw, oy, 0]], COL.white, { opacity: 0.6 }); wire(G, [[ox, oy, 0], [ox, oy + chh, 0]], COL.white, { opacity: 0.6 });
    const curve = ribbon(G, 101, COL.obj, 0.08); const cp = []; for (let i = 0; i <= 100; i++) { const m = i / 100, u = 4 * Math.pow(m * (1 - m), 1.5); cp.push([ox + m * cw, oy + u / 0.5 * chh * 0.9, 0.02]); } curve.userData.set(cp);
    const gb = []; for (let k = 0; k <= 8; k++) { const m = k / 8, u = 4 * Math.pow(m * (1 - m), 1.5), b = block(0.5, Math.max(0.02, u / 0.5 * chh * 0.9), 0.4, COL.llm, [ox + m * cw, oy + Math.max(0.02, u / 0.5 * chh * 0.9) / 2, -0.3], { opacity: 0.6, edges: false }); G.add(b); gb.push(b); }
    G.add(lab('U = 4μ(1 − μ)σ，奖励 0/1、8 条回复', [ox + cw / 2, oy + chh + 0.9, 0], { size: 16 }), lab('8 条里对 k 条', [ox + cw / 2, oy - 0.9, 0], { size: 15 }));
    const mark = dynLab(G, [ox + cw / 2, oy - 2.0, 0], { size: 15 });
    /* right: toy boxes */
    const bx0 = 1.5, by0 = 0.5, W = 12, H = 8; panel(G, bx0, by0, -0.05, W, H, 0.45);
    const GT = [[0.08, 0.15, 0.3, 0.7], [0.4, 0.2, 0.62, 0.75], [0.7, 0.3, 0.92, 0.85]];
    const R = b => [bx0 + b[0] * W, by0 + (1 - b[3]) * H, bx0 + b[2] * W, by0 + (1 - b[1]) * H];
    GT.forEach(b => { const r = R(b); rect(G, r[0], r[1], r[2], r[3], 0, COL.gt); });
    const sub = new THREE.Group(); G.add(sub);
    const rl = dynLab(G, [bx0 + W / 2, by0 + H + 1.0, 0], { size: 18, border: 'rgba(242,193,78,.7)' });
    const iou = (a, b) => { const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])), iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1])), I = ix * iy; return I / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - I); };
    const ctls = [{ label: '情形', items: ['逐渐对准', '多一个重复框', '漏一个', '负样本：误报', '负样本：不输出'], get: () => sc, set: k => { sc = k; } }];
    return { ctls, update(p) {
      const kk = Math.round(seg(p, 0, 1) * 8); gb.forEach((b, k) => glow(b, k === kk ? 0.9 : 0.05)); const m = kk / 8; mark(`k = ${kk}：μ = ${m.toFixed(3)}，U = ${(4 * Math.pow(m * (1 - m), 1.5)).toFixed(3)}`);
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub);
      const neg = sc >= 3; let preds = [];
      if (sc === 0) { const d = 0.12 * (1 - seg(p, 0.05, 0.9)); preds = GT.map(b => [b[0] + d, b[1] + d * 0.6, b[2] + d, b[3] + d * 0.6]); }
      if (sc === 1) preds = [...GT, [GT[1][0] + 0.02, GT[1][1] + 0.02, GT[1][2] + 0.02, GT[1][3] + 0.02]];
      if (sc === 2) preds = GT.slice(0, 2);
      if (sc === 3) preds = [[0.4, 0.2, 0.62, 0.75]];
      preds.forEach(b => { const r = R(b); rect(sub, r[0], r[1], r[2], r[3], 0.05, COL.pred); });
      sub.children.forEach(c => { c.visible = !neg || sc === 3; });
      let r;
      if (neg) r = preds.length ? 0 : 1;
      else {
        const used = new Set(); let s = 0; const ious = [];
        GT.forEach(g => { let best = -1, bi = -1; preds.forEach((q, i) => { if (used.has(i)) return; const v = iou(g, q); if (v > best) { best = v; bi = i; } }); if (bi >= 0 && best > 0) { used.add(bi); s += best ** 3; ious.push(best); } });
        r = 2 * s / (GT.length + preds.length);
        rl(`r = 2·ΣIoU³ / (${GT.length} + ${preds.length}) = ${r.toFixed(3)}\nIoU：${ious.map(v => v.toFixed(2)).join('、')}`);
      }
      if (neg) rl(sc === 3 ? '负样本：输出了一个框 → r = 0' : '负样本：什么都不输出 → r = 1');
      cap(neg ? `图里没有目标：<b>只有不输出任何物体才得 1 分</b>（r = ${r}）` : `绿框是真值，橙框是预测；IoU 取三次方：0.9 → 0.729，0.8 → 0.512 · <b>r = ${r.toFixed(3)}</b>`);
    } };
  }

  /* ---------- scene 11: results; every bar is a number from the paper ---------- */
  function s11(G) {
    let view = +(OPT[0] ?? 0); G.add(L.grid(34, 34)); const sub = new THREE.Group(); G.add(sub);
    const T = [
      { t: '表 2 · 检测 F1 Mean（%）', low: false, g: ['COCO', 'LVIS', 'Dense200', 'VisDrone'], s: [['最强 VLM 基线', COL.base, [54.7, 50.7, 58.7, 39.9]], ['2B', COL.b2, [55.2, 53.3, 61.4, 40.4]], ['4B', COL.b4, [57.1, 55.3, 71.3, 44.7]]], mx: 100 },
      { t: '表 3 / 表 7 · 无目标查询的拒答率（%）', low: false, g: ['RefCOCOg-Rej', 'WeRef-Bench', 'PR-Bench', 'Ref-ZOM'], s: [['最强基线', COL.base, [22.5, 73.0, 10.8, 41.9]], ['2B', COL.b2, [50.2, 92.9, 37.0, 62.4]], ['4B', COL.b4, [67.4, 96.4, 52.6, 86.0]]], mx: 100 },
      { t: '表 4 · 计数精确匹配（%）', low: false, g: ['CountQA', 'PixMo test', 'KubriCount B', 'MixCount test'], s: [['最强 VLM 基线', COL.base, [52.4, 82.8, 22.4, 15.2]], ['2B', COL.b2, [47.9, 88.1, 32.4, 32.2]], ['4B', COL.b4, [57.1, 89.6, 40.1, 40.4]]], mx: 100 },
      { t: '表 8 · 抠图 MAD ×10³（越低越好）', low: true, g: ['P3M-500-NP', 'AM-2K', 'PPM-100', 'WeRefMat 指代'], s: [['最强基线', COL.base, [15.4, 11.0, 9.3, 22.4]], ['2B', COL.b2, [6.6, 5.7, 5.3, 15.8]], ['4B', COL.b4, [7.3, 5.0, 6.1, 9.8]]], mx: 25 }];
    let bars = [], last = -1;
    function rebuild() {
      L.clear(sub); LABS = LABS.filter(s => s.parent !== sub); bars = []; last = view; const v = T[view], Ng = v.g.length, Ns = v.s.length, gw = Math.min(6.4, 26 / Ng), w = Math.min(1.4, (gw - 0.8) / Ns);
      v.g.forEach((nm, i) => { const x0 = (i - (Ng - 1) / 2) * gw; sub.add(lab(nm, [x0, -0.2, 2.6], { size: 18 }));
        v.s.forEach(([sn, c, vals], j) => { const x = x0 + (j - (Ns - 1) / 2) * (w + 0.1), b = block(w, 1, w, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(vals[i].toFixed(1), [x, 0, 0], { size: 14 }); sub.add(l); bars.push({ b, l, v: vals[i] / v.mx, j }); }); });
      v.s.forEach(([sn, c], j) => { sub.add(lab(sn, [-12 + j * 4.2, 9.0, 0], { size: 18, color: css(c) })); });
      sub.add(lab(v.t, [6, 9.0, 0], { size: 19, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const ctls = [{ label: '看', items: ['检测', '拒答', '计数', '抠图'], get: () => view, set: k => { view = k; } }];
    const MSG = ['Dense200 上 4B <b>71.3</b>，比最强 VLM 基线 LocateAnything 高 12.6 个点；拥挤和小目标的差距最大', '两个定位专用模型在 RefCOCOg-Rej 上都 < 1%；4B <b>67.4%</b>，Ref-ZOM 86.0%（UniPixel 0.3%）', 'MixCount test 4B <b>40.4</b> vs 15.2；CountQA 上 2B（47.9）还不如 LocateAnything（52.4）', '误差越低越好：框提示的三个集上 2B 有两个好于 4B；WeRefMat 指代 4B <b>9.8</b> vs 22.4'];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const g = seg(p, 0, 0.5); bars.forEach(({ b, l, v, j }) => { const h = Math.max(0.02, v * 7 * g); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.4 + (j === 1 ? 0.5 : 0); });
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
  window.__wvDebug = { get cap() { return $('cap').textContent; } };
})();
