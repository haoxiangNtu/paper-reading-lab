'use strict';
/* Sharpa CraftNet (no paper; company announcement of 2026-01-06/07) taken apart into ten scenes.
   Layer names, frequencies and the four data-flow sentences come from the announcement; the DQ stations come from
   Sharpa's visitor guide and DQ case page; times from Yicai Global (2026-09-01). Hands, cups, tactile readings and
   all signal curves are toys. Each scene's update(p) is a pure function of the timeline p plus the current toggles.
   No model runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { s2: 0x9d8cff, s1: 0x3aa8e0, s0: 0xf0963c, up: 0xf2c14e, ok: 0x4fc98a, bad: 0xe05d5d, dim: 0x46506a, white: 0xeef2fa, table: 0x2b3650, cup: 0xe6ecf7, ice: 0xf4efe4, metal: 0x9aa6bf, hand: 0x7f8aa6, off: 0x3aa8e0, med: 0xf0963c };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const A = '公告（sharpa.com，2026-01-07；PR Newswire 01-06）';

  const SCENES = [
    { n: 1, part: '总览', title: '三层：CraftNet 是 S1 + S0，S2 在外面', sub: '向下传意图和粗动作，向上回传状态和进度', dur: 12, cam: [0.12, 1.3, 23, [0.6, 3.9, 0]],
      html: dl([['System 2 · 推理脑', '开源 VLM，约 1 Hz：理解指令、拆子任务、长程规划；人机接口'], ['System 1 · 运动脑', '约 10 Hz：粗动作、上身动作、接触前手型；应用相关训练主要在这一层'], ['System 0 · 交互脑', '约 100 Hz：接触阶段，用触觉实时修正手和手指'], ['CraftNet', '公告原话：System 0 和 System 1 的组合']]) +
        '<p>虚线框按公告原话只包住 S1 和 S0。媒体常把三层都叫 CraftNet，见精读页读者注 2。</p><p>点画面里的三个方块可以跳到对应的幕。</p>' + src(A + ' “CraftNet” 和 “The Flow” 两节') },
    { n: 2, part: '频率', title: '1 Hz、10 Hz、100 Hz 放在同一条时间轴上', sub: '切换时间窗，数每层跑了几次', dur: 12, cam: [0, 1.36, 25, [-1.4, 2.0, 0]],
      html: dl([['S2', '约 1 Hz → 周期 1 s'], ['S1', '约 10 Hz → 周期 100 ms'], ['S0', '约 100 Hz → 周期 10 ms'], ['比例', 'S1 每出一次，S0 跑 100/10 = 10 次；S2 每出一次，S1 跑 10 次、S0 跑 100 次']]) +
        '<p>每个小方块是一次推理。播放头扫过时点亮，右边的数是播放头之前已经跑了几次，当场数出来的。</p>' +
        '<p>这些是标称推理频率，不是从触觉到电机的反应延迟。公告没给延迟。</p>' + src(A + ' “Inference across the three systems occurs at distinct frequencies”') },
    { n: 3, part: '异步', title: '慢层还没想完，快层用最近一次的结果继续跑', sub: '两秒内三层输出的样子；S2 在 1 秒处换子任务', dur: 13, cam: [0, 1.38, 25, [0, 2.2, 0]],
      html: dl([['公告', '异步设计带来“时间解耦”：推理脑可以慢慢想，运动脑快速出粗轨迹，交互脑做即时控制'], ['画法', '每层的输出在两次推理之间保持不变（阶梯）'], ['S1', '每 100 ms 朝 S2 给的目标走一步'], ['S0', '每 10 ms 在 S1 的粗动作上加一个小修正']]) +
        guess('“两次推理之间保持上一次输出”是我按“异步”画的，公告没说各层之间用什么方式对齐、有没有插值或动作块。三条曲线的数值是玩具，固定种子生成。') +
        src(A + ' 频率一段') },
    { n: 4, part: '接触前', title: 'S1 带着手接近杯子', sub: '接触前是 S1 的事：粗动作和接触前手型', dur: 11, cam: [0.55, 1.15, 17, [0.5, 2.2, 0]],
      html: dl([['S1 输出', '粗动作，包括上身动作和“接触前的手部姿态”'], ['公告原话', 'ensures that the robot approaches the object in an optimal way, prior to contact'], ['频率', '约 10 Hz，画成每 100 ms 一个路标'], ['S0', '这一段画成待机']]) +
        guess('路径、路标、手和杯子都是示意。公告没说接触前 S0 是完全不工作，还是一直在跑只是不起主导作用；这里画成“待机”只是为了和下一幕对比。') +
        src(A + ' System 1 一段、The Flow 第 2 句') },
    { n: 5, part: '交接', title: '碰到杯子的那一刻：控制权从 S1 交给 S0', sub: '“最后一毫米”在这里开始', dur: 11, cam: [0.4, 1.2, 14, [0.3, 2.0, 0]],
      html: dl([['挑战 2', '“90% 的功夫在最后一毫米”：统一的 VLA 适合接触前，缺接触时的高频力和触觉回路'], ['S1 → S0', '潜在物理意图和/或粗动作，加触觉和本体信号（力、力矩）'], ['S0', '在接触的最后几毫米产生精细动作']]) +
        guess('右边两根“控制权”柱子是示意。公告只说接触前靠 S1、接触阶段靠 S0，没说交接是硬切换、加权混合，还是 S0 一直在 S1 的输出上叠加修正。') +
        src(A + ' 挑战 2、The Flow 第 2、3 句') },
    { n: 6, part: 'S0 闭环', title: '触觉看到打滑，S0 每 10 ms 加一点握力', sub: '玩具：指尖触觉阵列 + 握力曲线', dur: 13, cam: [0, 1.3, 17, [0.6, 2.4, 0]],
      html: dl([['S0', '“实时利用触觉反馈……在交互过程中持续调整手和手指的位置”'], ['输入', '触觉 + 本体（力、力矩）+ S1 给的意图'], ['Wave 指尖', '每个指尖 1,000 多个触觉像素（Sharpa CES 新闻稿）'], ['DQ 例子', '抽纸杯力大了会带出好几个；搅拌时要抗振动（第一财经、到店指南）']]) +
        toyb('触觉阵列只画 10 × 10 = 100 个点（真实 Wave 指尖 1,000 多个）。接触斑、打滑、握力曲线和“打滑就加力”的规则都是我设的，用来说明“高频闭环”这件事，不是 S0 的真实算法，公告没有公开 S0 的输入输出格式。') +
        src(A + ' System 0 一段；CES 2026-01-06 新闻稿') },
    { n: 7, part: '失败回传', title: '修不回来时，S0 把状态向量交给 S1 重来', sub: 'S0 → S1 状态向量；S1 → S2 进度向量', dur: 14, cam: [0.15, 1.22, 25, [1.5, 3.2, 0]],
      html: dl([['公告原话', 'System 0 back-propagates state vectors to System 1 … when fine-grained execution fails'], ['S1', '调整潜在物理意图或粗动作'], ['S1 → S2', '“进度向量”，持续更新任务状态'], ['注意', '“back-propagates”是推理时回传信号，不是训练时的梯度反向传播']]) +
        guess('“失败”画成杯子滑出阈值，“调整”画成退回再接近。失败怎么判定、状态向量里有什么、S1 是重规划整段还是只改子目标，公告都没说。') +
        src(A + ' The Flow 第 3、4 句') },
    { n: 8, part: '数据', title: '三类数据怎么进三层', sub: '“Midas Touch for Data”：真实遥操作、仿真、互联网', dur: 14, cam: [0.1, 1.25, 27, [0, 2.6, 0]],
      html: dl([['真实遥操作', 'CraftNet 在环里控制接触，人完成整个任务；后训练阶段 S1 和 S0 联合训练、微调'], ['仿真', '把 CraftNet 放进仿真回路，修正接触后的行为和不真实的力、柔顺'], ['互联网（文本、图像）', 'S2 的开源 VLM 已经在上面预训练'], ['互联网视频', 'CraftNet 给它“补上触觉”，让 S1 能预训练']]) +
        guess('“方法未公开”是我加的：公告没说用什么方法补、补出来是什么形式、怎么验证。综述 2611.06724 说是“映射到人类视频和手套数据”，它引的 Business Wire 稿件我读不到，未核实。') +
        src(A + ' “The Midas Touch for Data” 一节') },
    { n: 9, part: 'DQ 门店', title: '一杯奥利奥暴风雪：四个工位', sub: '只画来源写到的环节；机器人约 6 分钟，店员 2–3 分钟', dur: 16, cam: [0.25, 1.15, 25, [0, 1.8, 0]],
      html: dl([['工位 1', '取杯圈：窄把手的柜门，没为机器人改过（到店指南、案例页）'], ['工位 2', '从套叠的纸杯里分出一个，握稳，接软冰淇淋（到店指南）'], ['工位 3', '双手：扶盖、舀料；按 SOP 三勺奥利奥碎，要记住做到第几勺（案例页）'], ['工位 4', '拇指和食指压住金属圈搅拌；插红勺；倒杯不洒（案例页、到店指南）'], ['总数', '55 步（各方一致）；没有来源分站给步数'], ['用时', '约 6 分钟一杯；店员 2–3 分钟（第一财经 2026-09-01 到店观察）']]) +
        guess('工位的摆放、机器人移动路线、每个工位在 6 分钟里占多久都是我设的。Sharpa 的 DQ 页面没提 CraftNet，CraftNet 和 DQ 的连接只在 8 月 28 日的中文新闻稿里。') +
        src('sharpa.com/pages/visitor-guide；sharpa.com/pages/sharpa-dq；Yicai Global 2026-09-01') },
    { n: 10, part: '来源', title: '谁在什么时候说了什么', sub: '上排 Sharpa 自己发的，下排媒体和第三方；切换看三处对不上', dur: 14, cam: [0, 1.4, 27, [0, 0.6, 0]],
      html: dl([['一手', '公告、CES 两篇、GTC、DQ 案例页、到店指南、8 月中文新闻稿（转载）'], ['二手', 'Runtime Wire、X 博主（未核实）、第一财经、量子位、远川、KrASIA、综述'], ['对不上 1', '门店：吴江路（多数）vs 南京西路（第一财经）'], ['对不上 2', '时间：门店 24 小时 vs 机器人 10:00–22:00'], ['对不上 3', '自主：7 月预览“遥操作”（转述）vs 8 月后“全自主”']]) +
        '<p>只有第一财经的“约 6 分钟一杯”是第三方到店看到的定量数据。关于模型本身，能核对的只有公告里的三个频率。</p>' +
        src('见精读页“材料与版本”和读者注 8、9、12') },
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
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.2, phi: 1.2, dist: 24, maxDist: 160, minDist: 3 }); }
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
    f.vis = v => { if (st.s) st.s.visible = v; };
    return f;
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BALL = new THREE.SphereGeometry(1, 12, 9), CUBE = new THREE.BoxGeometry(1, 1, 1);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: 0.6 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.14) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.6, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  function panel(G, x, y, z, w, h, op = 0.55) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x0c1220, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }
  /* a polyline whose visible prefix is set by drawRange */
  function trace(G, pts, color, o = {}) { const l = wire(G, pts, color, { opacity: o.opacity ?? 0.95 }); l.userData.n = pts.length; l.userData.show = k => l.geometry.setDrawRange(0, Math.max(0, Math.min(pts.length, Math.round(k * pts.length)))); return l; }
  function packet(G, color, r = 0.28) { const m = L.sphere(r, color, { emissive: color }); m.material.emissiveIntensity = 0.6; G.add(m); return m; }

  /* three-layer stack used by scenes 1 and 7 */
  function stack(G, x, o = {}) {
    const W = o.w || 6.4, H = 1.5, ys = [7.6, 4.1, 0.6];
    const cols = [COL.s2, COL.s1, COL.s0], names = ['System 2 · 推理脑', 'System 1 · 运动脑', 'System 0 · 交互脑'], subs = ['开源 VLM · 约 1 Hz', '粗动作 · 约 10 Hz', '触觉精细动作 · 约 100 Hz'];
    const boxes = ys.map((y, i) => { const b = block(W, H, 1.2, cols[i], [x, y, 0], { opacity: 0.9 }); G.add(b); G.add(lab(names[i], [x, y + 0.3, 0.75], { size: 20 })); G.add(lab(subs[i], [x, y - 0.42, 0.75], { size: 15, color: '#dfe6f3' })); return b; });
    /* CraftNet bracket around S1 + S0 */
    const bx0 = x - W / 2 - 0.45, bx1 = x + W / 2 + 0.45, by0 = ys[2] - H / 2 - 0.4, by1 = ys[1] + H / 2 + 0.4;
    wire(G, [[bx0, by0, 0.7], [bx1, by0, 0.7], [bx1, by1, 0.7], [bx0, by1, 0.7], [bx0, by0, 0.7]], 0x38d1ff, { dashed: true, dash: 0.35, gap: 0.22, opacity: 0.9 });
    G.add(lab('CraftNet = S1 + S0', [bx0 + 1.6, by0 - 0.45, 0.7], { size: 17, color: '#38d1ff', bg: false }));
    return { boxes, ys, W };
  }
  /* a three-finger hand: palm + fingers with two segments; curl(k) bends them */
  function hand() {
    const g = new THREE.Group();
    const palm = block(0.9, 0.35, 0.9, COL.hand, [0, 0, 0]); g.add(palm);
    const fingers = [[-0.3, 0.32], [0.3, 0.32], [0, -0.38]].map(([x, z], i) => {
      const f = new THREE.Group(); f.position.set(x, -0.18, z); g.add(f);
      const a = block(0.18, 0.55, 0.18, COL.metal, [0, -0.27, 0]); f.add(a);
      const j = new THREE.Group(); j.position.y = -0.55; f.add(j);
      const b = block(0.16, 0.45, 0.16, COL.metal, [0, -0.22, 0]); j.add(b);
      const tip = L.sphere(0.1, COL.s0, { emissive: COL.s0 }); tip.position.y = -0.45; tip.material.emissiveIntensity = 0; j.add(tip);
      f.userData = { j, tip, side: i === 2 ? -1 : 1 };
      return f;
    });
    g.userData.curl = (k, open = 0.5) => { fingers.forEach(f => { const s = f.userData.side; f.rotation.x = s * (open - 0.75 * k) * 0.9; f.userData.j.rotation.x = s * (-0.2 - 0.7 * k); }); };
    g.userData.touch = k => fingers.forEach(f => { f.userData.tip.material.emissiveIntensity = k; });
    g.userData.curl(0);
    return g;
  }
  function cup(G, pos, o = {}) {
    const c = L.cyl(0.55, 0.42, 1.4, o.color || COL.cup, { opacity: 0.95 }); c.position.set(...pos); G.add(c);
    if (o.fill) { const f = L.cyl(0.5, 0.42, 1.0, COL.ice); f.position.y = -0.15; c.add(f); }
    return c;
  }

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    const st = stack(G, -3.2);
    st.boxes.forEach((b, i) => { b.userData.go = [2, 3, 5][i]; PICKS.push(b); });
    const x = -3.2, yS2 = st.ys[0], yS1 = st.ys[1], yS0 = st.ys[2];
    const tbl = block(5, 0.25, 3.2, COL.table, [6.6, -0.2, 0]); G.add(tbl);
    const c = cup(G, [6.6, 0.62, 0]);
    const h = hand(); G.add(h); h.position.set(6.6, 2.4, 0);
    const dn1 = stream(G, 5, COL.s2, 0.13), dn2 = stream(G, 7, COL.s1, 0.12), up1 = stream(G, 5, COL.up, 0.13), up2 = stream(G, 7, COL.up, 0.12), out = stream(G, 8, COL.s0, 0.11);
    G.add(lab('↓ 意图 / 指令', [x - 2.6, (yS2 + yS1) / 2, 0.9], { size: 15, bg: false, color: '#c9b8ff' }));
    G.add(lab('↑ 进度向量', [x + 2.4, (yS2 + yS1) / 2, 0.9], { size: 15, bg: false, color: '#f2c14e' }));
    G.add(lab('↓ 粗动作 + 潜在物理意图', [x - 3.4, (yS1 + yS0) / 2 + 0.25, 0.9], { size: 15, bg: false, color: '#7cc8f0' }));
    G.add(lab('↑ 状态向量（失败时）', [x + 3.1, (yS1 + yS0) / 2 + 0.25, 0.9], { size: 15, bg: false, color: '#f2c14e' }));
    G.add(lab('触觉 + 力 / 力矩 ↔', [3.4, 2.9, 0.6], { size: 15, bg: false, color: '#f0b070' }));
    G.add(lab('手指动作', [3.6, 0.0, 0.6], { size: 15, bg: false, color: '#f0b070' }));
    return { update(p) {
      const ph = (p * 4) % 1;
      dn1([[x - 0.9, yS2 - 0.8, 0.6], [x - 0.9, yS1 + 0.8, 0.6]], ph, 1);
      dn2([[x - 0.9, yS1 - 0.8, 0.6], [x - 0.9, yS0 + 0.8, 0.6]], (ph * 2) % 1, 1);
      up2([[x + 0.9, yS0 + 0.8, 0.6], [x + 0.9, yS1 - 0.8, 0.6]], ph, seg(p, 0.45, 0.55));
      up1([[x + 0.9, yS1 + 0.8, 0.6], [x + 0.9, yS2 - 0.8, 0.6]], ph, seg(p, 0.15, 0.25));
      out([[x + 3.3, yS0, 0.4], [4.6, 1.0, 0.3], [6.2, 1.9, 0]], (p * 8) % 1, 1);
      const k = seg(p, 0.1, 0.5) - seg(p, 0.85, 1);
      h.position.y = 2.4 - 0.7 * k; h.userData.curl(k); h.userData.touch(seg(p, 0.35, 0.5) * (1 - seg(p, 0.85, 1)));
      st.boxes.forEach((b, i) => glow(b, 0.25 + 0.25 * Math.max(0, Math.sin(p * Math.PI * [2, 8, 30][i]))));
      cap(p < 0.45 ? '向下：S2 给意图，S1 给粗动作；S0 在接触时出手指动作' : '向上：精细执行失败时 S0 回传状态向量；S1 持续回传进度向量');
    } };
  }

  /* ---------- scene 2: three clocks on one time axis ---------- */
  function s2(G) {
    const X0 = -9, X1 = 7, ys = [4.2, 2.2, 0.2], f = [1, 10, 100], cols = [COL.s2, COL.s1, COL.s0], nm = ['S2 · 1 Hz', 'S1 · 10 Hz', 'S0 · 100 Hz'];
    let wi = 0; const WIN = [1, 0.1];
    const ims = f.map((hz, r) => { const im = inst(CUBE, 100); G.add(im); return im; });
    ys.forEach((y, r) => { wire(G, [[X0, y - 0.45, 0], [X1, y - 0.45, 0]], 0x4a5878, { opacity: 0.6 }); G.add(lab(nm[r], [X0 - 1.6, y, 0], { size: 19, color: '#' + cols[r].toString(16).padStart(6, '0') })); });
    const head = block(0.05, 5.6, 0.05, COL.white, [X0, 2.2, 0.2]); G.add(head);
    const cnt = ys.map((y, r) => dynLab(G, [X1 + 1.7, y, 0], { size: 18 }));
    const axis = dynLab(G, [(X0 + X1) / 2, -0.9, 0], { size: 16, bg: false, color: '#9aa6bf' });
    const t0l = lab('0', [X0, -0.9, 0], { size: 15, bg: false, color: '#9aa6bf' }); G.add(t0l);
    const t1l = dynLab(G, [X1, -0.9, 0], { size: 15, bg: false, color: '#9aa6bf' });
    const ctls = [{ label: '时间窗', items: ['1 秒', '0.1 秒'], get: () => wi, set: k => { wi = k; } }];
    return { ctls, update(p) {
      const W = WIN[wi], t = p * W, xs = v => X0 + (X1 - X0) * v / W;
      f.forEach((hz, r) => {
        const im = ims[r], dt = 1 / hz, n = Math.min(100, Math.ceil(W / dt - 1e-9)), w = Math.min(0.9 * (X1 - X0) * dt / W, 1.4);
        let lit = 0;
        for (let i = 0; i < 100; i++) {
          if (i >= n) { setI(im, i, [0, -50, 0], 0.001); continue; }
          const ti = i * dt, on = ti <= t + 1e-9; if (on) lit++;
          setI(im, i, [xs(ti) + w / 2, ys[r], 0], [w, on ? 0.7 : 0.35, 0.5]);
          const c = hex3(cols[r]); colI(im, i, on ? c : c.map(v => v * 0.35 + 0.08));
        }
        done(im);
        cnt[r](`${lit} 次`);
      });
      head.position.x = xs(t);
      axis(wi === 0 ? '时间（秒）：S1 每格里有 10 个 S0' : '时间（秒）：放大到一个 S1 周期');
      t1l(wi === 0 ? '1 s' : '0.1 s');
      cap(`t = ${(t * 1000).toFixed(0)} ms · 每个方块是一次推理，周期 1 s / 100 ms / 10 ms`);
    } };
  }

  /* ---------- scene 3: asynchronous, hold-last-output ---------- */
  function s3(G) {
    const X0 = -9, X1 = 8, T = 2, ys = [4.6, 2.4, 0.2], H = 1.4, cols = [COL.s2, COL.s1, COL.s0];
    const xs = t => X0 + (X1 - X0) * t / T;
    /* toy signals: S2 target switches at t=1; S1 moves 30% of the way every 100 ms (hold); S0 adds a 10 ms correction */
    const r = L.rng(7), N = 200;
    const s2v = i => (i * 0.01 < 1 ? 0.25 : 0.85);
    const s1v = []; let v = 0.1; for (let k = 0; k <= 20; k++) { s1v.push(v); v += 0.3 * (s2v(k * 10) - v); }
    const s0v = []; for (let i = 0; i <= N; i++) s0v.push(s1v[Math.floor(i / 10)] + (L.gauss(r) * 0.04));
    const P2 = [], P1 = [], P0 = [];
    for (let i = 0; i <= N; i++) {
      const t = i * 0.01, tn = Math.min(T, t + 0.01);
      const a2 = s2v(Math.min(i, N)), a1 = s1v[Math.floor(i / 10)], a0 = s0v[i];
      P2.push([xs(t), ys[0] - H / 2 + H * a2, 0], [xs(tn), ys[0] - H / 2 + H * a2, 0]);
      P1.push([xs(t), ys[1] - H / 2 + H * a1, 0], [xs(tn), ys[1] - H / 2 + H * a1, 0]);
      P0.push([xs(t), ys[2] - H / 2 + H * a0, 0], [xs(tn), ys[2] - H / 2 + H * a0, 0]);
    }
    const tr = [P2, P1, P0].map((P, k) => trace(G, P, cols[k]));
    ys.forEach((y, k) => { panel(G, X0 - 0.2, y - H / 2 - 0.2, -0.05, X1 - X0 + 0.4, H + 0.4, 0.4); G.add(lab(['S2 意图', 'S1 粗动作', 'S0 输出'][k], [X0 - 1.5, y, 0], { size: 18, color: '#' + cols[k].toString(16).padStart(6, '0') })); });
    G.add(lab('S2 换子任务', [xs(1), ys[0] + H / 2 + 0.55, 0], { size: 16 }));
    wire(G, [[xs(1), ys[2] - H / 2 - 0.2, 0], [xs(1), ys[0] + H / 2 + 0.2, 0]], COL.up, { dashed: true, dash: 0.2, gap: 0.15, opacity: 0.7 });
    G.add(lab('0 s', [X0, -1.1, 0], { size: 15, bg: false, color: '#9aa6bf' })); G.add(lab('1 s', [xs(1), -1.1, 0], { size: 15, bg: false, color: '#9aa6bf' })); G.add(lab('2 s', [X1, -1.1, 0], { size: 15, bg: false, color: '#9aa6bf' }));
    return { update(p) {
      tr.forEach(l => l.userData.show(p));
      const t = p * T;
      cap(t < 1 ? `t = ${t.toFixed(2)} s · S2 只在 0 s 出过一次意图，S1 和 S0 一直拿着它跑（示意）` : `t = ${t.toFixed(2)} s · 新意图到了，S1 下一个 100 ms 才开始转向；S0 跟着 S1 走`);
    } };
  }

  /* ---------- scene 4: pre-contact approach ---------- */
  function s4(G) {
    G.add(block(7, 0.25, 4, COL.table, [0, -0.15, 0]));
    const c = cup(G, [0, 0.72, 0]);
    const h = hand(); G.add(h);
    const P = [[5.2, 5.2, 1.6], [4.2, 4.6, 1.2], [3.1, 3.9, 0.7], [2.0, 3.3, 0.3], [1.1, 2.9, 0.1], [0.45, 2.75, 0], [0.1, 2.7, 0], [0, 2.68, 0]];
    const way = inst(BALL, P.length); way.material.color.setHex(COL.s1); way.material.emissive.setHex(COL.s1); way.material.emissiveIntensity = 0.4; G.add(way);
    wire(G, P, COL.s1, { dashed: true, dash: 0.2, gap: 0.15, opacity: 0.5 });
    const bar = block(0.5, 2.6, 0.5, COL.s1, [-4.2, 1.3, 0]); G.add(bar);
    const bar0 = block(0.5, 0.2, 0.5, COL.s0, [-3.3, 0.1, 0], { opacity: 0.5 }); G.add(bar0);
    G.add(lab('S1', [-4.2, 3.0, 0], { size: 17 })); G.add(lab('S0 待机', [-3.3, 0.8, 0], { size: 15 }));
    G.add(lab('每 100 ms 一个粗目标', [4.6, 5.9, 1.6], { size: 16, color: '#7cc8f0' }));
    const dist = dynLab(G, [-1.6, 4.4, 0], { size: 17 });
    return { update(p) {
      const k = Math.min(P.length - 1, Math.floor(p * 1.15 * (P.length - 1)));
      for (let i = 0; i < P.length; i++) setI(way, i, P[i], i <= k ? 0.14 : 0.001); done(way);
      const pos = along(P, clamp(p * 1.15, 0, 1)); h.position.set(...pos);
      h.userData.curl(0, 0.5 * (1 - seg(p, 0.5, 0.85)) + 0.15);
      const d = Math.max(0, (pos[1] - 2.68) * 100 + Math.hypot(pos[0], pos[2]) * 60);
      dist(d > 2 ? `离接触还有约 ${d.toFixed(0)} mm（示意）` : '手型已张好，马上接触');
      cap(`S1 出了 ${k + 1} 个粗目标 ≈ ${(k + 1) * 100} ms · 接触前的路径和手型都是 S1 的事`);
    } };
  }

  /* ---------- scene 5: hand-over at contact ---------- */
  function s5(G) {
    G.add(block(6, 0.25, 4, COL.table, [0, -0.15, 0]));
    const c = cup(G, [0, 0.72, 0]);
    const h = hand(); G.add(h); h.position.set(0, 2.68, 0);
    const b1 = block(0.6, 1, 0.6, COL.s1, [4.2, 0.5, 0]), b0 = block(0.6, 1, 0.6, COL.s0, [5.2, 0.5, 0]); G.add(b1, b0);
    G.add(lab('S1', [4.2, -0.6, 0], { size: 17 })); G.add(lab('S0', [5.2, -0.6, 0], { size: 17 }));
    G.add(lab('控制权（示意）', [4.7, 4.1, 0], { size: 16 }));
    const sig = stream(G, 6, COL.s0, 0.09);
    const lt = dynLab(G, [-3.6, 4.2, 0], { size: 17 });
    return { update(p) {
      const g = seg(p, 0.15, 0.4), w0 = seg(p, 0.3, 0.55);
      h.position.y = 2.68 - 0.35 * g; h.userData.curl(0.25 + 0.75 * g, 0.15); h.userData.touch(seg(p, 0.33, 0.4));
      const H1 = 3 * (1 - 0.85 * w0) + 0.05, H0 = 3 * (0.15 + 0.85 * w0) * (p > 0.3 ? 1 : 0.07) + 0.05;
      b1.scale.y = H1; b1.position.y = H1 / 2; b0.scale.y = H0; b0.position.y = H0 / 2;
      glow(b0, w0); glow(b1, 1 - w0);
      sig([[0.6, 1.6, 0.4], [2.5, 2.2, 0.3], [5.2, H0 + 0.2, 0.3]], (p * 6) % 1, p > 0.4 ? 1 : 0);
      lt(p < 0.33 ? '还没碰到：S1 主导' : p < 0.55 ? '碰到了：触觉信号开始流向 S0' : 'S0 接管手指；S1 的粗动作和意图仍作为输入');
      cap(p < 0.33 ? '接触前' : '“最后一毫米”：公告说统一的 VLA 缺的就是这里的高频力和触觉回路');
    } };
  }

  /* ---------- scene 6: S0 tactile loop (toy) ---------- */
  function s6(G) {
    const N = 10, X0 = -6.4, Y0 = 0.6, D = 0.42;
    const px = inst(CUBE, N * N); G.add(px);
    panel(G, X0 - 0.4, Y0 - 0.4, -0.1, N * D + 0.4, N * D + 0.4, 0.5);
    G.add(lab('指尖触觉阵列（玩具 10 × 10）', [X0 + N * D / 2 - 0.2, Y0 + N * D + 0.6, 0], { size: 16 }));
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(X0 + N * D / 2, Y0 + N * D / 2, 0.6), 1, COL.bad, 0.35, 0.25); G.add(arrow);
    /* chart */
    const CX = 0.6, CY = 0.4, CW = 7.6, CH = 3.6;
    panel(G, CX - 0.3, CY - 0.3, -0.05, CW + 0.6, CH + 0.6, 0.45);
    wire(G, [[CX, CY + CH, 0], [CX, CY, 0], [CX + CW, CY, 0]], 0x9aa6bf, { opacity: 0.9 });
    const NS = 120, slip = i => { const t = i / NS; return t > 0.3 && t < 0.62 ? Math.sin(Math.PI * (t - 0.3) / 0.32) : 0; };
    const F = [], SL = []; let fv = 0.35;
    for (let i = 0; i <= NS; i++) { const s = slip(i); fv = Math.min(0.95, fv + (s > 0.15 ? 0.012 : 0) - (s < 0.05 && i / NS > 0.7 ? 0.002 : 0)); F.push(fv); SL.push(s); }
    const PF = [], PS = []; for (let i = 0; i <= NS; i++) { const x0 = CX + CW * i / (NS + 1), x1 = CX + CW * (i + 1) / (NS + 1); PF.push([x0, CY + CH * F[i], 0.02], [x1, CY + CH * F[i], 0.02]); PS.push([x0, CY + CH * 0.8 * SL[i], 0.01]); }
    const tf = trace(G, PF, COL.s0), ts = trace(G, PS, COL.bad);
    G.add(lab('握力（S0 每 10 ms 一步）', [CX + 2.6, CY + CH + 0.6, 0], { size: 15, color: '#f0b070' }));
    G.add(lab('切向滑移', [CX + CW - 1.0, CY + CH + 0.6, 0], { size: 15, color: '#ff9a8a' }));
    G.add(lab('时间 →（1.2 s 玩具）', [CX + CW / 2, CY - 0.75, 0], { size: 14, bg: false, color: '#9aa6bf' }));
    const st = dynLab(G, [X0 + N * D / 2 - 0.2, Y0 - 1.0, 0], { size: 16 });
    return { update(p) {
      const i = Math.min(NS, Math.round(p * NS)), s = SL[i], cy = 0.5 + 0.28 * s, cx = 0.5;
      for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
        const u = (a + 0.5) / N, v = (b + 0.5) / N, d2 = ((u - cx) ** 2 + (v - cy) ** 2) / (0.06 + 0.1 * F[i] * 0.4);
        const k = clamp(Math.exp(-d2 * 3) * (0.4 + F[i]), 0, 1), id = a * N + b;
        setI(px, id, [X0 + a * D, Y0 + (N - 1 - b) * D, 0.1 + 0.4 * k], [D * 0.86, D * 0.86, 0.1 + 0.8 * k]);
        colI(px, id, [0.15 + 0.85 * k, 0.2 + 0.4 * k, 0.35 - 0.2 * k]);
      }
      done(px);
      arrow.visible = s > 0.05; arrow.setLength(0.4 + 1.6 * s, 0.35, 0.25);
      tf.userData.show(p); ts.userData.show(p);
      st(s > 0.15 ? '接触斑在移动：打滑 → 加握力' : i / NS > 0.62 ? '稳住了，握力慢慢回落' : '稳定接触');
      cap(`S0 第 ${i} 步 · ${(i * 10)} ms · 握力 ${(F[i] * 20).toFixed(1)} N（玩具刻度，满格 20 N）`);
    } };
  }

  /* ---------- scene 7: failure → state vector up ---------- */
  function s7(G) {
    const st = stack(G, -5.2, { w: 5.6 });
    const x = -5.2, [yS2, yS1, yS0] = st.ys;
    G.add(block(6, 0.25, 3, COL.table, [5.2, -0.2, 0]));
    const c = cup(G, [5.2, 0.62, 0]);
    const h = hand(); G.add(h);
    const pk1 = packet(G, COL.up), pk2 = packet(G, COL.up);
    const tl = dynLab(G, [5.2, 5.6, 0], { size: 17 });
    const v1 = dynLab(G, [x + 4.0, (yS1 + yS0) / 2, 0.8], { size: 15, color: '#f2c14e' });
    const v2 = dynLab(G, [x + 4.0, (yS2 + yS1) / 2, 0.8], { size: 15, color: '#f2c14e' });
    return { update(p) {
      /* phases: 0-0.28 grip & slip; 0.28-0.42 state vector up; 0.42-0.78 retreat and re-approach; 0.78-0.95 progress up */
      const slipK = seg(p, 0.1, 0.28) * (1 - seg(p, 0.42, 0.5));
      const re = seg(p, 0.42, 0.6), ap = seg(p, 0.6, 0.78);
      c.position.x = 5.2 + 0.7 * slipK * (1 - ap); c.rotation.z = -0.35 * slipK * (1 - ap);
      const hy = 2.3 + 1.6 * re * (1 - ap), hx = 5.2 + 0.7 * slipK * (1 - re) + 0 * ap;
      h.position.set(hx, hy, 0); h.userData.curl(p < 0.42 ? 0.9 : p < 0.7 ? 0.2 : 0.2 + 0.7 * seg(p, 0.7, 0.8), 0.15); h.userData.touch(p < 0.42 ? 1 - slipK * 0.6 : seg(p, 0.75, 0.8));
      const u1 = seg(p, 0.28, 0.42), u2 = seg(p, 0.8, 0.95);
      pk1.visible = u1 > 0 && u1 < 1; pk1.position.set(x + 2.2, L.lerp(yS0 + 0.8, yS1 - 0.8, u1), 0.8);
      pk2.visible = u2 > 0 && u2 < 1; pk2.position.set(x + 2.2, L.lerp(yS1 + 0.8, yS2 - 0.8, u2), 0.8);
      v1(p > 0.26 && p < 0.6 ? '状态向量 ↑' : ''); v1.vis(p > 0.26 && p < 0.6);
      v2(p > 0.78 ? '进度向量 ↑' : ''); v2.vis(p > 0.78);
      glow(st.boxes[2], p < 0.3 ? 0.8 : 0.2); glow(st.boxes[1], p > 0.4 && p < 0.8 ? 0.8 : 0.2); glow(st.boxes[0], p > 0.9 ? 0.8 : 0.2);
      tl(p < 0.28 ? 'S0 在修，杯子还是滑出去了' : p < 0.42 ? '精细执行失败 → 回传给 S1' : p < 0.78 ? 'S1 调整粗动作：退开、重新接近（示意）' : '抓稳了；S1 把进度报给 S2');
      cap(p < 0.42 ? 'S0 → S1：“back-propagates state vectors … when fine-grained execution fails”' : 'S1 → S2：“returns the progress vector”，S2 维持全局任务状态');
    } };
  }

  /* ---------- scene 8: data routes ---------- */
  function s8(G) {
    const tx = 5.0, tg = [[tx, 6.0, COL.s2, 'S2 · 开源 VLM'], [tx, 3.2, COL.s1, 'S1 · 运动脑'], [tx, 0.6, COL.s0, 'S0 · 交互脑']];
    const T = tg.map(([x, y, c, n]) => { const b = block(4.2, 1.3, 1, c, [x, y, 0], { opacity: 0.9 }); G.add(b); G.add(lab(n, [x, y, 0.7], { size: 19 })); return b; });
    wire(G, [[tx - 2.5, -0.3, 0.6], [tx + 2.5, -0.3, 0.6], [tx + 2.5, 4.1, 0.6], [tx - 2.5, 4.1, 0.6], [tx - 2.5, -0.3, 0.6]], 0x38d1ff, { dashed: true, dash: 0.3, gap: 0.2, opacity: 0.8 });
    G.add(lab('CraftNet', [tx + 1.6, -0.75, 0.6], { size: 15, bg: false, color: '#38d1ff' }));
    const sx = -6.0, srcs = [[sx, 6.4, '互联网文本、图像'], [sx, 4.4, '互联网视频'], [sx, 2.2, '真实遥操作'], [sx, 0.0, '仿真']];
    srcs.forEach(([x, y, n]) => { G.add(block(3.6, 1.1, 1, COL.dim, [x, y, 0])); G.add(lab(n, [x, y, 0.7], { size: 17 })); });
    const routes = [
      { pts: [[sx + 1.9, 6.4, 0.3], [tx - 2.2, 6.0, 0.3]], c: COL.s2, a: 0.0, b: 0.25, t: 'VLM 已预训练' },
      { pts: [[sx + 1.9, 4.4, 0.3], [-0.6, 4.0, 0.3], [tx - 2.2, 3.4, 0.3]], c: COL.s1, a: 0.22, b: 0.5, t: '“补触觉”（方法未公开）→ S1 预训练' },
      { pts: [[sx + 1.9, 2.2, 0.3], [0, 2.0, 0.3], [tx - 2.2, 2.0, 0.3]], c: COL.ok, a: 0.47, b: 0.75, t: 'S1、S0 联合后训练' },
      { pts: [[sx + 1.9, 0.0, 0.3], [0, 0.2, 0.3], [tx - 2.2, 0.6, 0.3]], c: COL.up, a: 0.72, b: 1.0, t: 'CraftNet 在仿真回路里修正接触' },
    ];
    const ss = routes.map(r => stream(G, 6, r.c, 0.13));
    const tls = routes.map((r, i) => { const m = along(r.pts, 0.5); const l = lab(r.t, [m[0], m[1] + 0.55, 0.5], { size: 15, color: '#' + r.c.toString(16).padStart(6, '0') }); G.add(l); return l; });
    const loop = wire(G, [[tx - 2.2, 0.2, 0.3], [0.5, -0.9, 0.3], [sx + 1.9, -0.3, 0.3]], COL.up, { dashed: true, dash: 0.25, gap: 0.15, opacity: 0.6 });
    return { update(p) {
      routes.forEach((r, i) => { const on = p >= r.a ? 1 : 0; ss[i](r.pts, (p * 5) % 1, on); tls[i].visible = on > 0; });
      loop.visible = p > 0.8;
      T.forEach((b, i) => glow(b, [p < 0.25, p > 0.22 && p < 0.75, p > 0.47][i] ? 0.6 : 0.15));
      cap(p < 0.25 ? '互联网文本和图像：S2 用的开源 VLM 已经学过' : p < 0.5 ? '互联网视频：公告说 CraftNet 给它补触觉，再预训练 S1；方法没公开' : p < 0.75 ? '遥操作：CraftNet 在环控制接触，人在环完成任务；数据用来联合微调 S1 和 S0' : '仿真：CraftNet 放进仿真回路，修正接触后的行为和不真实的力');
    } };
  }

  /* ---------- scene 9: DQ Blizzard, four stations ---------- */
  function s9(G) {
    G.add(block(22, 0.3, 3.4, COL.table, [0, -0.15, 0]));
    const xs = [-8, -2.7, 2.7, 8];
    const names = ['1 取杯圈\n开柜门', '2 取纸杯\n接冰淇淋', '3 加料\n三勺奥利奥', '4 搅拌、插勺\n倒杯检查'];
    names.forEach((n, i) => G.add(lab(n, [xs[i], 4.9, 0], { size: 17 })));
    /* station props */
    const cab = block(2.2, 2.4, 1.8, 0x3b4660, [xs[0], 1.2, -0.6]); G.add(cab);
    const door = block(2.2, 2.4, 0.1, 0x55607a, [xs[0], 1.2, 0.35]); G.add(door);
    const ring = L.torus(0.45, 0.07, COL.metal); ring.rotation.x = Math.PI / 2; G.add(ring);
    const stackC = []; for (let i = 0; i < 5; i++) { const c = L.cyl(0.5, 0.4, 0.5, COL.cup); c.position.set(xs[1] - 1.0, 0.25 + i * 0.18, -0.6); G.add(c); stackC.push(c); }
    const mach = block(1.4, 2.8, 1.4, 0x6b7794, [xs[1] + 0.9, 1.4, -0.8]); G.add(mach);
    const bin = block(1.6, 0.7, 1.2, 0x2a2a2a, [xs[2] - 0.9, 0.35, -0.6]); G.add(bin);
    const scoopN = dynLab(G, [xs[2], 3.5, 0], { size: 17, color: '#f2c14e' });
    const mixer = block(0.9, 3.2, 0.9, 0x6b7794, [xs[3] + 1.0, 1.6, -0.8]); G.add(mixer);
    const c = cup(G, [xs[1], 0.7, 0.6], { fill: true });
    const h = hand(); G.add(h); h.scale.setScalar(0.85);
    /* time bars */
    const BX = -9, BW = 18, BY = -2.2;
    panel(G, BX - 0.3, BY - 1.5, 0.4, BW + 0.6, 2.3, 0.45);
    const rb = block(1, 0.35, 0.2, COL.s0, [BX, BY, 0.6]); G.add(rb);
    const hb = block(1, 0.35, 0.2, COL.ok, [BX, BY - 0.8, 0.6], { opacity: 0.85 }); G.add(hb);
    const hb2 = block(1, 0.35, 0.18, COL.ok, [BX, BY - 0.8, 0.55], { opacity: 0.35 }); G.add(hb2);
    G.add(lab('机器人 约 6 分钟', [BX + BW - 1.6, BY + 0.55, 0.6], { size: 15, color: '#f0b070' }));
    G.add(lab('店员 2–3 分钟', [BX + BW / 2 - 1.5, BY - 1.3, 0.6], { size: 15, color: '#7ee0a8' }));
    const clk = dynLab(G, [BX + 1.6, BY + 0.55, 0.6], { size: 15 });
    return { update(p) {
      const tmin = p * 6, st = Math.min(3, Math.floor(p * 4)), f = p * 4 - st;
      const rx = xs[st] + (f > 0.8 && st < 3 ? (xs[st + 1] - xs[st]) * seg(f, 0.8, 1) : 0);
      /* hand: hovers over current station, dips mid-way */
      const dip = Math.sin(Math.PI * clamp(f / 0.8, 0, 1));
      h.position.set(rx, 3.0 - 1.0 * dip, 0.6); h.userData.curl(dip, 0.3); h.userData.touch(dip > 0.6 ? 1 : 0);
      door.rotation.y = st === 0 ? -1.2 * dip : 0; door.position.x = xs[0] + (st === 0 ? 0.6 * dip : 0);
      /* ring: from cabinet onto the cup after station 1 */
      if (st === 0) ring.position.set(xs[0], 0.4 + 2.0 * seg(f, 0.4, 0.8), 0.4 + 0.2 * seg(f, 0.4, 0.8)); else ring.position.set(c.position.x, c.position.y + 0.72, c.position.z);
      ring.visible = true;
      /* cup appears at station 2 and travels with the hand */
      c.visible = st >= 1; c.scale.setScalar(1);
      c.children.forEach(ch => { ch.visible = st > 1 || (st === 1 && f > 0.45); });
      if (st >= 1) { const cx = st === 1 ? xs[1] : rx; c.position.set(cx, 0.72, 0.6); c.rotation.z = st === 3 ? Math.PI * seg(f, 0.55, 0.75) : 0; c.position.y = st === 3 ? 0.72 + 1.6 * Math.sin(Math.PI * seg(f, 0.5, 0.8)) : 0.72; }
      scoopN(st === 2 ? `第 ${Math.min(3, 1 + Math.floor(f / 0.8 * 3))} / 3 勺` : st > 2 ? '3 / 3 勺' : '');
      scoopN.vis(st >= 2);
      const rw = BW * p; rb.scale.x = Math.max(0.01, rw); rb.position.x = BX + rw / 2;
      const hw = BW * Math.min(p, 2 / 6), hw2 = BW * Math.min(p, 3 / 6);
      hb.scale.x = Math.max(0.01, hw); hb.position.x = BX + hw / 2; hb2.scale.x = Math.max(0.01, hw2); hb2.position.x = BX + hw2 / 2;
      clk(`${Math.floor(tmin)}:${String(Math.floor((tmin % 1) * 60)).padStart(2, '0')}`);
      cap(['工位 1：窄把手的柜门是行业标准件，没为机器人改过', '工位 2：从套叠的纸杯里分一个，握力大了会带出好几个', '工位 3：每一勺看起来一样，要记住做到第几勺', '工位 4：拇指食指压住金属圈抗振动；倒杯不洒'][st]);
    } };
  }

  /* ---------- scene 10: source timeline ---------- */
  function s10(G) {
    const X0 = -10, X1 = 10, mx = m => X0 + (X1 - X0) * (m - 1) / 10.7; /* month as decimal, Jan 1 = 1 */
    const d = (mo, day) => mo + (day - 1) / 31;
    wire(G, [[X0, 0, 0], [X1, 0, 0]], 0x9aa6bf, { opacity: 0.9 });
    ['1 月', '3 月', '5 月', '7 月', '9 月', '11 月'].forEach((t, i) => { const x = mx(1 + 2 * i); wire(G, [[x, -0.15, 0], [x, 0.15, 0]], 0x9aa6bf); G.add(lab(t, [x, -0.5, 0], { size: 14, bg: false, color: '#9aa6bf' })); });
    const EV = [
      [d(1, 6.5), 1, '01-06/07 公告\n1/10/100 Hz', -8.0, 3.4],
      [d(1, 19), 1, '01-19 CES 回顾\nCraftNet = S0+S1', -6.2, 1.6],
      [d(3, 18), 1, '03-18 GTC', -2.0, 1.6],
      [d(7, 18), 0, '07-18 X 博主：预览是\n遥操作（转述，未核实）', -4.6, -3.6],
      [d(7, 18), 0, '07-18 Runtime Wire\n50–60 步', -5.6, -1.7],
      [d(8, 28), 1, '08-28 中文新闻稿\n吴江路 · 10–22 点 · 55 步', 0.6, 3.4],
      [d(8, 29), 1, '08-29 上岗\n“全自主”', 3.3, 1.6],
      [d(9, 1), 0, '09-01 第一财经\n南京西路 · 24 小时店\n约 6 分钟', 1.2, -2.2],
      [d(9, 7), 1, '09-07 WM-Craftnet\n（无 S0/1/2）', 6.6, 3.4],
      [d(9, 30), 0, '09-30 远川\n“零干预” + 失败案例', 4.8, -4.2],
      [d(11, 4), 0, '11-04 综述', 6.9, -1.7],
      [d(11, 10), 0, '11-10 KrASIA\n吴江路 · 10–22 点', 9.0, -4.2],
    ];
    let hi = 0;
    const items = EV.map(([m, off, t, lx, y]) => {
      const x = mx(m), c = off ? COL.s1 : COL.med;
      const dot = L.sphere(0.2, c, { emissive: c }); dot.position.set(x, 0, 0); G.add(dot);
      const stem = wire(G, [[x, 0, 0], [lx, y * 0.8, 0]], c, { opacity: 0.5 });
      const l = lab(t, [lx, y, 0], { size: 14 }); G.add(l);
      return { m, dot, stem, l, c };
    });
    G.add(lab('Sharpa 自己发的', [X0 + 1.3, 5.6, 0], { size: 15, color: '#7cc8f0' }));
    G.add(lab('媒体与第三方', [X0 + 1.2, -5.0, 0], { size: 15, color: '#f0b070' }));
    const ctls = [{ label: '高亮', items: ['全部', '门店位置', '营业时间', '自主程度'], get: () => hi, set: k => { hi = k; } }];
    const TAGS = { 1: [5, 7, 11], 2: [5, 7, 11], 3: [3, 6, 9] };
    return { ctls, update(p) {
      const now = 1 + 10.7 * seg(p, 0.02, 0.8);
      items.forEach((it, i) => {
        const on = it.m <= now + 0.01, sel = hi === 0 || (TAGS[hi] || []).includes(i);
        it.dot.visible = on; it.stem.visible = on; it.l.visible = on;
        it.l.material.opacity = sel ? 1 : 0.25; it.dot.material.emissiveIntensity = sel && hi ? 1 : 0.3; it.stem.material.opacity = sel ? 0.7 : 0.15;
      });
      cap(hi === 1 ? '位置：吴江路（新闻稿、KrASIA 等）vs 南京西路（第一财经）——同一街区，推断是同一家店，门牌未核实'
        : hi === 2 ? '时间：门店 24 小时营业；机器人每天 10:00–22:00（新闻稿、KrASIA、到店指南）'
        : hi === 3 ? '自主：7 月预览视频据称遥操作（未核实）；8 月 29 日起官方称全自主；没有公布干预率'
        : '蓝点是 Sharpa 自己发的，橙点是媒体和第三方；切换左上角看三处对不上的地方');
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10];

  function buildCtl() {
    const box = $('ctl'); box.innerHTML = ''; box.hidden = true; if (!api) return;
    (api.ctls || []).forEach((c, gi) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-g="${gi}" data-k="${k}" aria-pressed="${c.get() === k}">${t}</button>`).join('');
      box.appendChild(row); box.hidden = false;
    });
  }
  function syncCtl() { (api?.ctls || []).forEach((c, gi) => { $('ctl').querySelectorAll(`button[data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(c.get() === +b.dataset.k))); }); }

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
    const G = new THREE.Group(); root.add(G); pNow = p0; api = BUILD[cur](G);
    if (api.ctls && OPT.length) { api.ctls.forEach((c, gi) => { const k = parseInt(OPT[gi], 10); if (!isNaN(k)) c.set(k); }); OPT = []; }
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
  window.__craftnetDebug = { get cap() { return $('cap').textContent; } };
})();
