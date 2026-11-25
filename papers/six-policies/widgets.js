// 六个策略对照页的三个交互图。数据在页面的 #six-data（由同一份数据生成总对照表）。
(function () {
  'use strict';
  var D = JSON.parse(document.getElementById('six-data').textContent);
  var NS = 'http://www.w3.org/2000/svg';
  var SLOT = {}; D.slots.forEach(function (s) { SLOT[s[0]] = s[1]; });
  var NUM = { in: '①', bb: '②', cp: '③', ar: '④', rs: '⑤', tr: '⑥', da: '⑦', inf: '⑧' };
  var BY = {}; D.policies.forEach(function (p) { BY[p.id] = p; });
  function nm(p) { return p.short || p.name; }
  function el(tag, a, parent, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in a) e.setAttribute(k, a[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function clear(s) { while (s.firstChild) s.removeChild(s.firstChild); }
  function diffSlots(a, b) { return D.slots.map(function (s) { return s[0]; }).filter(function (k) { return a.s[k][0] !== b.s[k][0]; }); }
  function segInit(box, cb) {
    box.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      box.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      cb(b.getAttribute('data-v'));
    });
  }

  // ---------- 交互 1：谱系 + 两两对比 ----------
  function initCmp() {
    var svg = document.getElementById('lin-svg'), sa = document.getElementById('cmp-a'), sb = document.getElementById('cmp-b');
    D.policies.forEach(function (p) {
      [sa, sb].forEach(function (s) { var o = document.createElement('option'); o.value = p.id; o.textContent = nm(p); s.appendChild(o); });
    });
    var POS = { act: [20, 52], dp: [20, 172], pi05: [245, 92], gr00t: [245, 192], fastwam: [470, 52], lingbot: [470, 172] };
    var W = 150, H = 44;
    [['从零训练的模仿学习', 95], ['VLA', 320], ['世界动作模型（WAM）', 545]].forEach(function (h) {
      el('text', { x: h[1], y: 24, 'text-anchor': 'middle', class: 'm' }, svg, h[0]);
    });
    var edgeEls = [];
    function anchor(id, side) {
      var p = POS[id];
      return side === 'r' ? [p[0] + W, p[1] + H / 2] : side === 'l' ? [p[0], p[1] + H / 2] : side === 'b' ? [p[0] + W / 2, p[1] + H] : [p[0] + W / 2, p[1]];
    }
    D.edges.forEach(function (e) {
      var pa = POS[e.a], pb = POS[e.b], s, t;
      if (Math.abs(pa[0] - pb[0]) < 10) { s = anchor(e.a, 'b'); t = anchor(e.b, 't'); }
      else { s = anchor(e.a, 'r'); t = anchor(e.b, 'l'); }
      var d = 'M' + s[0] + ' ' + s[1] + ' C' + (s[0] + t[0]) / 2 + ' ' + s[1] + ' ' + (s[0] + t[0]) / 2 + ' ' + t[1] + ' ' + t[0] + ' ' + t[1];
      if (Math.abs(pa[0] - pb[0]) < 10) d = 'M' + s[0] + ' ' + s[1] + ' L' + t[0] + ' ' + t[1];
      var g = el('g', { style: 'cursor:pointer', tabindex: 0, role: 'button', 'aria-label': nm(BY[e.a]) + ' 到 ' + nm(BY[e.b]) }, svg);
      el('path', { d: d, stroke: 'transparent', 'stroke-width': 16, fill: 'none' }, g);
      var vis = el('path', { d: d, stroke: 'var(--muted)', 'stroke-width': 2, fill: 'none', 'marker-end': 'url(#arr)' }, g);
      var ds = diffSlots(BY[e.a], BY[e.b]).map(function (k) { return NUM[k]; }).join('');
      var mx = (s[0] + t[0]) / 2, my = (s[1] + t[1]) / 2;
      if (Math.abs(pa[0] - pb[0]) < 10) { mx += 8; }
      el('text', { x: mx, y: my - 5, 'text-anchor': Math.abs(pa[0] - pb[0]) < 10 ? 'start' : 'middle', class: 'm', style: 'fill:var(--accent)' }, g, ds);
      g.addEventListener('click', function () { sa.value = e.a; sb.value = e.b; render(); });
      g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); sa.value = e.a; sb.value = e.b; render(); } });
      edgeEls.push({ e: e, vis: vis });
    });
    var defs = el('defs', {}, svg);
    var mk = el('marker', { id: 'arr', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 11, markerHeight: 11, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'var(--muted)' }, mk);
    var nodeEls = {};
    D.policies.forEach(function (p) {
      var q = POS[p.id];
      var g = el('g', { style: 'cursor:pointer' }, svg);
      nodeEls[p.id] = el('rect', { x: q[0], y: q[1], width: W, height: H, rx: 9, fill: 'var(--panel)', stroke: p.color, 'stroke-width': 2 }, g);
      el('text', { x: q[0] + W / 2, y: q[1] + 19, 'text-anchor': 'middle', style: 'font-weight:700' }, g, nm(p));
      el('text', { x: q[0] + W / 2, y: q[1] + 36, 'text-anchor': 'middle', class: 'm' }, g, p.year + ' · ' + p.meta.params.replace(/（.*）/, ''));
      g.addEventListener('click', function () { if (sa.value === p.id) return; sb.value = p.id; render(); });
    });
    el('text', { x: 320, y: 266, 'text-anchor': 'middle', class: 'm' }, svg, '箭头上的数字 = 两端分属不同类别的部件；点箭头看这次改动，点方框把它设为“到”');
    function render() {
      var a = BY[sa.value], b = BY[sb.value], ds = diffSlots(a, b);
      edgeEls.forEach(function (x) {
        var on = x.e.a === a.id && x.e.b === b.id;
        x.vis.setAttribute('stroke', on ? 'var(--accent)' : 'var(--muted)'); x.vis.setAttribute('stroke-width', on ? 3.5 : 2);
      });
      for (var id in nodeEls) nodeEls[id].setAttribute('stroke-width', id === a.id || id === b.id ? 4 : 2);
      document.getElementById('cmp-count').textContent = a === b ? '' : '8 个部件里有 ' + ds.length + ' 个换了类别';
      var edge = D.edges.filter(function (e) { return e.a === a.id && e.b === b.id; })[0];
      document.getElementById('cmp-sum').innerHTML = a === b ? '<p>选两个不同的方法。</p>' :
        '<p><b>' + nm(a) + ' → ' + nm(b) + '：</b>' + (edge ? edge.txt : '这两个不是谱系上相邻的一对，下表逐格列出差别。') + '</p>' +
        '<p style="color:var(--muted);font-size:13.5px">换了类别的部件：' + (ds.length ? ds.map(function (k) { return SLOT[k]; }).join('、') : '无') + '</p>';
      var t = document.getElementById('cmp-tab'), h = '<tr><th></th><th>' + nm(a) + '</th><th>' + nm(b) + '</th></tr>';
      D.slots.forEach(function (s) {
        var k = s[0], df = ds.indexOf(k) >= 0;
        h += '<tr class="' + (df ? 'df' : 'sm') + '"><th>' + s[1] + '<span class="tag">' + (df ? '不同' : '同类') + '</span></th><td>' +
          (a.s[k][2] ? '<b>' + a.s[k][1] + '</b>' : a.s[k][1]) + '</td><td>' + (b.s[k][2] ? '<b>' + b.s[k][1] + '</b>' : b.s[k][1]) + '</td></tr>';
      });
      t.innerHTML = h;
    }
    sa.value = 'act'; sb.value = 'dp';
    sa.addEventListener('change', render); sb.addEventListener('change', render);
    render();
  }

  // ---------- 交互 2：结构图 ----------
  // 方框：[id, x, y, w, h, 部件, 文字（\n 换行）, 只在哪个模式出现]
  var ARCH = {
    act: { box: [
      ['cam', 10, 30, 115, 46, 'in', '4 路相机'], ['q', 10, 120, 115, 46, 'in', '14 维关节位置'], ['nol', 10, 210, 115, 40, 'in', '（不用语言）'],
      ['res', 150, 30, 190, 50, 'bb', 'ResNet18 × 每路相机\n1200 个 512 维特征'],
      ['enc', 150, 112, 190, 56, 'bb', 'Transformer 编码器\n4 层'],
      ['cvae', 150, 210, 190, 56, 'tr', 'CVAE 编码器\n动作块 + 关节 → 风格 z', 'train'],
      ['z0', 150, 210, 190, 40, 'tr', 'z = 0（先验均值）', 'inf'],
      ['dec', 370, 112, 150, 56, 'cp', 'Transformer 解码器\n7 层 · k 个位置查询'],
      ['out', 545, 100, 88, 80, 'ar', '100 步\n关节位置\nL1 回归'],
      ['ens', 545, 210, 88, 60, 'inf', '时间集成\n重叠块加权', 'inf'],
      ['loss', 370, 210, 150, 56, 'tr', 'L1 + β·KL\n（β = 10）', 'train']],
      arr: [['cam', 'res'], ['res', 'enc'], ['q', 'enc'], ['cvae', 'enc', 'z'], ['z0', 'enc', 'z'], ['enc', 'dec'], ['dec', 'out'], ['out', 'ens'], ['out', 'loss']],
      note: '推理时 CVAE 编码器直接丢掉，z 取 0，所以输出是确定的；每个控制步都推理一次，同一时刻被多块覆盖，按指数权重平均。' },
    dp: { box: [
      ['cam', 10, 30, 115, 50, 'in', '相机\n最近 2 帧'], ['st', 10, 130, 115, 50, 'in', '本体状态\n最近 2 帧'],
      ['res', 150, 30, 190, 60, 'bb', 'ResNet-18（不预训练）\n空间 softmax · GroupNorm'],
      ['film', 150, 130, 190, 50, 'cp', '观测特征 → FiLM\n调制每一层'],
      ['noise', 370, 30, 150, 50, 'ar', '纯噪声', 'inf'], ['gtn', 370, 30, 150, 50, 'ar', '真实动作 + 噪声', 'train'],
      ['unet', 370, 120, 150, 70, 'ar', '1D 时序 U-Net\n去噪网络'],
      ['out', 545, 120, 88, 70, 'ar', '16 步动作\n执行前 8 步'],
      ['inf', 370, 225, 263, 50, 'inf', 'DDIM 去噪 10–16 步；执行 8 步后重新预测', 'inf'],
      ['loss', 370, 225, 263, 50, 'tr', '预测噪声的 MSE（100 个噪声级）', 'train']],
      arr: [['cam', 'res'], ['res', 'film'], ['st', 'film'], ['film', 'unet'], ['noise', 'unet'], ['gtn', 'unet'], ['unet', 'out']],
      note: '去噪网络本身不变，变的是输入：训练时是加了噪的真实动作，推理时从纯噪声开始迭代。' },
    pi05: { box: [
      ['cam', 10, 20, 115, 42, 'in', '多相机'], ['lang', 10, 80, 115, 42, 'in', '语言指令'], ['st', 10, 140, 115, 50, 'in', '本体状态\n→ 离散文本 token'],
      ['vlm', 150, 20, 190, 170, 'bb', 'PaliGemma\nSigLIP + Gemma 2B\n\n前缀：图像 + 语言 + 状态'],
      ['sub', 150, 210, 190, 48, 'rs', '子任务文本（先预测）'],
      ['exp', 370, 20, 160, 110, 'cp', '动作专家（约 3 亿）\n每层联合注意力（MoT）\nadaRMSNorm 注入时间步'],
      ['fast', 370, 150, 160, 48, 'ar', 'FAST 离散动作 token\n（预训练阶段）', 'train'],
      ['out', 550, 30, 83, 90, 'ar', '50 步\n连续动作块\n流匹配'],
      ['kv', 550, 150, 83, 60, 'inf', '前缀 KV 缓存\n去噪 10 步', 'inf'],
      ['co', 370, 222, 263, 52, 'da', '异构数据共训\n机器人 + 网页图文 + 子任务标注', 'train']],
      arr: [['cam', 'vlm'], ['lang', 'vlm'], ['st', 'vlm'], ['vlm', 'sub'], ['vlm', 'exp'], ['exp', 'out'], ['vlm', 'fast'], ['out', 'kv']],
      note: '推理时前缀（图像、语言、状态）只算一次 KV 缓存，流匹配的 10 步只反复跑动作专家。子任务文本在单任务微调（如 FabricBench）里用不上。' },
    gr00t: { box: [
      ['cam', 10, 30, 115, 42, 'in', '相机'], ['lang', 10, 92, 115, 42, 'in', '语言指令'],
      ['vlm', 150, 20, 190, 100, 'bb', 'Eagle-2 VLM\nSigLIP-2 + SmolLM2\n截到第 12 层 · 语言冻结'],
      ['feat', 150, 144, 190, 44, 'cp', '第 12 层输出的一组 token'],
      ['dit', 370, 20, 160, 100, 'cp', 'DiT 动作头 16 层\n交叉注意力读特征\n自注意力看状态 + 动作'],
      ['st', 370, 144, 160, 44, 'in', '本体状态 → 具身专属 MLP'],
      ['out', 550, 20, 83, 100, 'ar', '16 步动作块\n流匹配\n具身专属\nMLP 解码'],
      ['k4', 550, 144, 83, 44, 'inf', '去噪 4 步', 'inf'],
      ['pyr', 150, 222, 483, 48, 'da', '数据金字塔：人类视频（LAPA 潜在动作、IDM 伪标签）+ 仿真 / 神经轨迹 + 真机', 'train']],
      arr: [['cam', 'vlm'], ['lang', 'vlm'], ['vlm', 'feat'], ['feat', 'dit'], ['st', 'dit'], ['dit', 'out']],
      note: '和 π0.5 对比：动作模块只读主干一个中间层的输出，而不是每层都和主干联合注意力。状态和动作的编码、解码 MLP 每种机器人各一套。VLM 叫 System 2、DiT 叫 System 1，但中间没有文字计划。' },
    lingbot: { box: [
      ['cam', 10, 20, 120, 52, 'in', '多相机拼一帧\n→ 因果视频 VAE'], ['lang', 10, 92, 120, 46, 'in', '语言 → T5\n交叉注意力'],
      ['hist', 10, 158, 120, 60, 'in', '全部历史帧\n+ 历史动作\n（KV 缓存）'],
      ['vid', 155, 20, 190, 84, 'bb', '视频流\nWan2.2-5B DiT\n30 层 · 宽 3072'],
      ['act', 155, 142, 190, 84, 'cp', '动作流 30 层 · 宽 768\n各自 QKV\n每层联合自注意力'],
      ['fut', 375, 20, 160, 72, 'rs', '下一段视频潜变量\n推理：3 步到 s = 0.6'],
      ['out', 375, 132, 160, 72, 'ar', '动作块\n每个潜帧 4 个动作\n流匹配 10 步'],
      ['as', 555, 132, 78, 86, 'inf', '异步执行\n前向动力学\n对齐真实\n观测', 'inf'],
      ['loss', 155, 244, 380, 50, 'tr', '视频动力学损失 + 逆动力学损失\nteacher forcing · 随机给历史加噪', 'train']],
      arr: [['cam', 'vid'], ['lang', 'vid'], ['hist', 'vid'], ['vid', 'act', '联合注意力'], ['vid', 'fut'], ['fut', 'out', '看着想象出动作'], ['act', 'out'], ['out', 'as']],
      note: '推理时视频只去噪到一半就交给动作分支（训练时给历史加噪，让动作分支学会读半成品）；新观测到达后写进 KV 缓存，所以它记得之前发生过什么。' },
    fastwam: { box: [
      ['cam', 10, 20, 120, 60, 'in', '多相机拼一张图\n→ Wan VAE\n只用当前帧'], ['lang', 10, 100, 120, 46, 'in', '语言 → T5\n交叉注意力'],
      ['vid', 155, 20, 190, 84, 'bb', '视频 DiT\nWan2.2-5B'],
      ['act', 155, 142, 190, 84, 'cp', '动作专家 DiT\n宽 1024（约 10 亿）\n共享注意力'],
      ['fut', 375, 20, 160, 72, 'rs', '未来视频潜变量\n（加噪后预测）', 'train'],
      ['out', 375, 132, 160, 72, 'ar', '32 步动作块\n流匹配'],
      ['one', 555, 20, 78, 92, 'inf', '视频分支\n只前向\n一次', 'inf'],
      ['steps', 555, 132, 78, 72, 'inf', '动作去噪\n10 步', 'inf'],
      ['loss', 155, 244, 380, 50, 'tr', 'L = L_act + λ·L_vid\n掩码：动作 token 看不到未来帧', 'train']],
      arr: [['cam', 'vid'], ['lang', 'vid'], ['vid', 'act', '当前帧 K/V'], ['vid', 'fut'], ['act', 'out']],
      note: '训练时视频分支要预测未来帧，这个损失塑造了它的表示；推理时未来帧这组 token 根本不建，视频 DiT 只当编码器用一次。' }
  };
  function initArch() {
    var svg = document.getElementById('ar-svg'), segP = document.getElementById('ar-pol'), segM = document.getElementById('ar-mode');
    D.policies.forEach(function (p, i) {
      var b = document.createElement('button'); b.setAttribute('data-v', p.id); b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      b.textContent = nm(p); segP.appendChild(b);
    });
    var leg = document.getElementById('ar-leg');
    D.slots.forEach(function (s) { leg.insertAdjacentHTML('beforeend', '<span><i style="border-color:var(--c-' + s[0] + ');background:color-mix(in srgb,var(--c-' + s[0] + ') 18%,transparent)"></i>' + s[1] + '</span>'); });
    var cur = D.policies[0].id, mode = 'inf';
    function draw() {
      clear(svg);
      var A = ARCH[cur], P = BY[cur], pos = {};
      var defs = el('defs', {}, svg), mk = el('marker', { id: 'ah', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, defs);
      el('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'var(--muted)' }, mk);
      var live = {};
      A.box.forEach(function (b) {
        var only = b[7], on = !only || only === mode;
        if (only && !on) return; // 另一模式专属且与本模式框重叠时不画
        live[b[0]] = true; pos[b[0]] = b;
      });
      // 不运行的模块：画成虚线（只对另一模式专属、且不和本模式框重叠的）
      A.box.forEach(function (b) {
        if (!b[7] || b[7] === mode) return;
        var overlap = A.box.some(function (o) { return o !== b && o[7] === mode && o[1] === b[1] && o[2] === b[2]; });
        if (overlap) return;
        pos[b[0]] = b;
      });
      A.arr.forEach(function (a) {
        var s = pos[a[0]], t = pos[a[1]]; if (!s || !t) return;
        var dead = !live[a[0]] || !live[a[1]];
        var p1, p2;
        if (t[1] >= s[1] + s[3] - 2) { p1 = [s[1] + s[3], s[2] + s[4] / 2]; p2 = [t[1], t[2] + t[4] / 2]; }
        else if (t[2] >= s[2] + s[4] - 2) { var cx = Math.max(s[1], t[1]) + Math.min(s[3], t[3]) / 2; p1 = [cx, s[2] + s[4]]; p2 = [cx, t[2]]; }
        else if (s[2] >= t[2] + t[4] - 2) { var cx2 = Math.max(s[1], t[1]) + Math.min(s[3], t[3]) / 2; p1 = [cx2, s[2]]; p2 = [cx2, t[2] + t[4]]; }
        else { p1 = [s[1] + s[3], s[2] + s[4] / 2]; p2 = [t[1], t[2] + t[4] / 2]; }
        var d = 'M' + p1[0] + ' ' + p1[1] + ' C' + (p1[0] + p2[0]) / 2 + ' ' + p1[1] + ' ' + (p1[0] + p2[0]) / 2 + ' ' + p2[1] + ' ' + p2[0] + ' ' + p2[1];
        if (p1[0] === p2[0]) d = 'M' + p1[0] + ' ' + p1[1] + ' L' + p2[0] + ' ' + p2[1];
        el('path', { d: d, stroke: 'var(--muted)', 'stroke-width': 1.6, fill: 'none', 'marker-end': 'url(#ah)', 'stroke-dasharray': dead ? '4 4' : '', opacity: dead ? .45 : 1 }, svg);
        if (a[2]) el('text', { x: (p1[0] + p2[0]) / 2 + (p1[0] === p2[0] ? 6 : 0), y: (p1[1] + p2[1]) / 2 + (p1[0] === p2[0] ? 4 : -5), 'text-anchor': p1[0] === p2[0] ? 'start' : 'middle', class: 'm', style: 'fill:var(--accent)' }, svg, a[2]);
      });
      Object.keys(pos).forEach(function (id) {
        var b = pos[id], on = live[id], c = 'var(--c-' + b[5] + ')';
        el('rect', { x: b[1], y: b[2], width: b[3], height: b[4], rx: 8, fill: on ? 'color-mix(in srgb,' + c + ' 16%,var(--bg))' : 'none', stroke: c, 'stroke-width': on ? 1.8 : 1.2, 'stroke-dasharray': on ? '' : '5 4', opacity: on ? 1 : .55 }, svg);
        var lines = b[6].split('\n'), y0 = b[2] + b[4] / 2 - (lines.length - 1) * 8 + 4;
        lines.forEach(function (ln, i) {
          el('text', { x: b[1] + b[3] / 2, y: y0 + i * 16, 'text-anchor': 'middle', class: i === 0 ? '' : 'm', opacity: on ? 1 : .55, style: i === 0 ? 'font-weight:600' : '' }, svg, ln);
        });
        if (!on) el('text', { x: b[1] + 4, y: b[2] - 4, 'text-anchor': 'start', class: 'm' }, svg, mode === 'inf' ? '仅训练' : '仅推理');
      });
      el('text', { x: 632, y: 322, 'text-anchor': 'end', class: 'm' }, svg, '示意，按原文描述重画');
      document.getElementById('ar-card').innerHTML = '<p><b>' + nm(P) + '</b>（' + P.famName + '）· 参数 ' + P.meta.params + ' · 动作块 ' + P.meta.chunk + ' · 推理 ' + P.meta.steps + ' · 预训练：' + P.meta.pre + '</p><p>' + A.note + '</p>' +
        '<p style="color:var(--muted);font-size:13.5px">主要改动：' + D.slots.filter(function (s) { return P.s[s[0]][2]; }).map(function (s) { return s[1]; }).join('、') + ' · <a href="#p-' + P.id + '">逐个看 ↓</a></p>';
    }
    segInit(segP, function (v) { cur = v; draw(); });
    segInit(segM, function (v) { mode = v; draw(); });
    draw();
  }

  // ---------- FabricBench 点图 ----------
  function initFb() {
    var svg = document.getElementById('fb-svg'); if (!svg) return;
    var L = 150, R = 24, W = 640, x = function (v) { return L + v / 80 * (W - L - R); };
    var rows = [['tapp', '外观降幅', 80], ['tc2', 'C0→C2 降幅', 205]];
    for (var g = 0; g <= 80; g += 20) {
      el('line', { x1: x(g), x2: x(g), y1: 36, y2: 252, stroke: 'var(--line)' }, svg);
      el('text', { x: x(g), y: 270, 'text-anchor': 'middle', class: 'm' }, svg, g);
    }
    el('text', { x: (L + W - R) / 2, y: 290, 'text-anchor': 'middle', class: 'm' }, svg, '展平 T 恤成功率下降（百分点），FabricBench 表 4');
    rows.forEach(function (r) {
      el('text', { x: 10, y: r[2] + 5 }, svg, r[1]);
      el('line', { x1: L, x2: W - R, y1: r[2], y2: r[2], stroke: 'var(--line)', 'stroke-dasharray': '2 3' }, svg);
      var pts = D.policies.map(function (p) { return { p: p, v: D.fb[p.id][r[0]], pre: D.fb[p.id].robotpre }; }).sort(function (a, b) { return a.v - b.v; });
      var tiers = [[-13, -1e9], [23, -1e9], [-29, -1e9], [39, -1e9]];
      pts.forEach(function (o) {
        var c = o.p.color, cx = x(o.v), lab = nm(o.p) + ' ' + o.v, w = lab.length * 7.2;
        el('circle', { cx: cx, cy: r[2], r: 7, fill: o.pre ? c : 'var(--bg)', stroke: c, 'stroke-width': 2.5 }, svg);
        var tier = tiers.filter(function (q) { return cx - w / 2 > q[1] + 6; })[0] || tiers[3];
        tier[1] = cx + w / 2;
        if (Math.abs(tier[0]) > 25) el('line', { x1: cx, x2: cx, y1: r[2] + (tier[0] < 0 ? -8 : 8), y2: r[2] + tier[0] + (tier[0] < 0 ? 4 : -12), stroke: c, 'stroke-width': 1 }, svg);
        el('text', { x: cx, y: r[2] + tier[0], 'text-anchor': 'middle', class: 'm', style: 'fill:' + c }, svg, lab);
      });
    });
    el('text', { x: 10, y: 20, class: 'm' }, svg, '实心 = 机器人数据预训练过（π0.5、GR00T、LingBot-VA）；空心 = 没有');
  }

  function init() { initCmp(); initArch(); initFb(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
