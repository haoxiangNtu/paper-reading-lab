/* vla-design-space 页的两个交互：部件图（按改动 / 按模型 / 按部件高亮）和耦合方式示意图。
   纯 DOM + SVG，颜色取页面 CSS 变量，深浅色都能用。模型指纹直接读页面里的总对照表 #mx，避免两处数据不一致。 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function h(tag, attrs, html) {
    var e = document.createElement(tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  var SLOT_NAME = {
    in: '① 输入与感知', bb: '② 主干', cp: '③ 动作模块怎么接主干', ar: '④ 动作表示与生成',
    rs: '⑤ 中间推理', tr: '⑥ 训练目标与配方', da: '⑦ 数据', inf: '⑧ 推理与部署'
  };

  /* 改动策略：slots = 主要改哪几个部件；sec = 正文小节锚点 */
  var STRATS = [
    { id: 'tok', name: '动作写成词表 token', slots: ['ar', 'cp'], sec: 's-tok',
      why: '想直接复用 VLM 的“预测下一个 token”和语言接口，不加新模块。',
      ex: 'RT-2、OpenVLA' },
    { id: 'codec', name: '更好的离散分词', slots: ['ar'], sec: 's-codec',
      why: '逐维分桶的 token 太多、相邻时刻高度相关，高频精细动作学不好。换成压缩或学出来的码本。',
      ex: 'FAST（π0-FAST）、VQ-BeT、Wall-OSS-0.5 的 RVQ、MolmoAct2-FAST' },
    { id: 'cont', name: '连续生成头 + 动作块', slots: ['ar', 'inf'], sec: 's-cont',
      why: '动作是连续、多峰的。用扩散或流匹配一次生成一整段动作，精度和平滑性更好。',
      ex: 'Diffusion Policy、Octo、π0、GR00T N1' },
    { id: 'couple', name: '换动作模块的接法', slots: ['cp'], sec: 's-couple',
      why: '新加的动作参数要拿到主干的信息，又不能把主干学坏。接法决定“信息怎么流、哪些权重共用”。',
      ex: '见下面的耦合方式图：WALL-OSS、π0、MolmoAct2、GR00T N1、CogACT' },
    { id: 'hybrid', name: '离散和连续一起训', slots: ['ar', 'tr'], sec: 's-hybrid',
      why: '直接接连续动作专家时，它的梯度会扰动 VLM，训练也慢。让 VLM 先用离散动作 token 学，再由连续专家出动作。',
      ex: 'π0.5 + 知识隔离、WALL-OSS、Wall-OSS-0.5、MolmoAct2' },
    { id: 'reason', name: '先想再做：子任务 / CoT / 视觉子目标', slots: ['rs', 'tr'], sec: 's-reason',
      why: '长任务和需要判断的任务，直接从画面映射到动作容易走错。先输出中间步骤。',
      ex: 'Hi Robot、π0.5、ECoT、CoT-VLA、WALL-OSS、MolmoAct2-Think' },
    { id: 'hier', name: '分层 / 多频率系统', slots: ['cp', 'rs', 'inf'], sec: 's-hier',
      why: '大模型推理慢，控制要快。把“想”和“动”拆成两套模型，各跑各的频率。',
      ex: 'Hi Robot、GR00T 2 配智能体、CraftNet' },
    { id: 'wam', name: '主干换成视频生成模型（WAM）', slots: ['bb', 'ar', 'da'], sec: 's-wam',
      why: 'VLM 懂图文，但不懂“世界接下来怎么变”。视频模型自带动力学先验，还能用没有动作标签的视频。',
      ex: 'GR-1 / GR-2、Cosmos Policy、OpenWAM-α、GR00T 2' },
    { id: 'cotrain', name: '和网页 / 具身 VQA 数据共训', slots: ['tr', 'da'], sec: 's-cotrain',
      why: '只用机器人数据微调，VLM 的语义和泛化会退化。混入图文、问答、定位数据来保住它。',
      ex: 'RT-2、π0.5、WALL-OSS、MolmoAct2（Molmo2-ER）' },
    { id: 'xemb', name: '跨具身适配', slots: ['in', 'ar', 'da'], sec: 's-xemb',
      why: '不同机器人的相机、关节数、动作空间都不同。要么每种机器人一个小输入输出层，要么统一到一个大动作空间。',
      ex: 'HPT、RDT-1B、GR00T N1、X-VLA、WALL-OSS' },
    { id: 'video', name: '用没有动作标签的视频', slots: ['da', 'ar'], sec: 's-video',
      why: '遥操作数据贵且少，人类视频和网络视频多得多，但没有机器人动作。',
      ex: 'LAPA（潜在动作）、GR00T N1（潜在动作 + 逆动力学伪标签）、OpenWAM-α、GR00T 2' },
    { id: 'mem', name: '记忆和历史帧', slots: ['in'], sec: 's-mem',
      why: '很多任务不是“看当前一帧就够”：东西被盖住、步骤要计数、要记得做到哪一步。',
      ex: 'MemoryVLA、ContextVLA、WALL-OSS-1.0-lite 关键帧记忆' },
    { id: 'touch', name: '加触觉等新模态', slots: ['in', 'cp'], sec: 's-touch',
      why: '接触之后视觉看不清，插接、拧、捏要靠触觉和力。',
      ex: 'FTP-1（第三个专家）、LingBot-Touch（触觉编码器）、CraftNet' },
    { id: 'infer', name: '推理侧：动作块执行、实时分块、精修、加速', slots: ['inf'], sec: 's-infer',
      why: '模型出一段动作要几十到几百毫秒，块与块之间会停顿或抖动。不改训练也能改善。',
      ex: 'ACT 时间集成、RTC、WALL-OSS-1.0-lite 残差精修、MolmoAct2 缓存加 CUDA Graph' },
    { id: 'rl', name: '强化学习后训练', slots: ['tr'], sec: 's-rl',
      why: '模仿学习的上限是示范质量，失败后不会自己变好。用真机经验和奖励继续训练。',
      ex: 'π*0.6（RECAP）、GR00T 2（真机 GRPO）' }
  ];

  /* ---------- 交互 1：部件图 ---------- */
  function initAnatomy() {
    var root = $('#anat');
    if (!root) return;
    var slots = $$('.slot', root);
    var card = $('#anat-card');
    var chips = $('#anat-chips');
    var mode = 'strat';

    function clearHi() {
      slots.forEach(function (s) { s.classList.remove('hi', 'dim'); });
      $$('button', chips).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    }
    function highlight(ids) {
      slots.forEach(function (s) {
        var on = ids.indexOf(s.getAttribute('data-slot')) >= 0;
        s.classList.toggle('hi', on);
        s.classList.toggle('dim', !on);
      });
    }
    function showStrat(st, btn) {
      clearHi();
      if (btn) btn.setAttribute('aria-pressed', 'true');
      highlight(st.slots);
      card.innerHTML = '<h4>' + st.name + '</h4>' +
        '<p><b>改哪里：</b>' + st.slots.map(function (s) { return SLOT_NAME[s]; }).join('、') + '</p>' +
        '<p><b>为什么改：</b>' + st.why + '</p>' +
        '<p><b>代表：</b>' + st.ex + '</p>' +
        '<p><a href="#' + st.sec + '">看正文这一节 ↓</a></p>';
    }
    function modelRows() { return $$('#mx tbody tr[data-m]'); }
    function showModel(tr, btn) {
      clearHi();
      if (btn) btn.setAttribute('aria-pressed', 'true');
      var cells = $$('td[data-s]', tr);
      var ids = [];
      var lines = [];
      cells.forEach(function (td) {
        var s = td.getAttribute('data-s');
        var t = td.textContent.trim();
        if (t && t !== '—') {
          if (td.classList.contains('key')) ids.push(s);
          lines.push('<li><b>' + SLOT_NAME[s].slice(2) + '：</b>' + td.innerHTML + '</li>');
        }
      });
      highlight(ids);
      var name = tr.querySelector('th').innerHTML;
      card.innerHTML = '<h4>' + name + '</h4><p class="sub">高亮的是这个模型<b>主要改动</b>的部件（总对照表里加粗的格子）。</p><ul>' + lines.join('') + '</ul>';
    }
    function showSlot(slot) {
      var id = slot.getAttribute('data-slot');
      clearHi();
      highlight([id]);
      var hit = STRATS.filter(function (st) { return st.slots.indexOf(id) >= 0; });
      card.innerHTML = '<h4>' + SLOT_NAME[id] + '</h4><p>' + (slot.getAttribute('data-desc') || '') + '</p>' +
        '<p><b>改这里的常见策略：</b></p><ul>' + hit.map(function (st) {
          return '<li><a href="#' + st.sec + '">' + st.name + '</a>：' + st.ex + '</li>';
        }).join('') + '</ul>';
    }
    function buildChips() {
      chips.innerHTML = '';
      if (mode === 'strat') {
        STRATS.forEach(function (st) {
          var b = h('button', { type: 'button', 'aria-pressed': 'false' }, st.name);
          b.addEventListener('click', function () { showStrat(st, b); });
          chips.appendChild(b);
        });
      } else {
        modelRows().forEach(function (tr) {
          var b = h('button', { type: 'button', 'aria-pressed': 'false' }, tr.querySelector('th').textContent.replace(/\s*\(.*$/, ''));
          b.addEventListener('click', function () { showModel(tr, b); });
          chips.appendChild(b);
        });
      }
    }
    $$('#anat-mode button').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('#anat-mode button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        mode = b.getAttribute('data-mode');
        buildChips();
        var first = chips.querySelector('button');
        if (first) first.click();
      });
    });
    slots.forEach(function (s) {
      s.setAttribute('tabindex', '0');
      s.setAttribute('role', 'button');
      s.addEventListener('click', function () { showSlot(s); });
      s.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showSlot(s); } });
    });
    buildChips();
    var first = chips.querySelector('button');
    if (first) first.click();
  }

  /* ---------- 交互 2：耦合方式 ---------- */
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function box(svg, x, y, w, ht, cls, t1, t2) {
    el('rect', { x: x, y: y, width: w, height: ht, rx: 8, 'class': cls }, svg);
    var cy = t2 ? y + ht / 2 - 4 : y + ht / 2 + 5;
    var a = el('text', { x: x + w / 2, y: cy }, svg); a.textContent = t1;
    if (t2) { var b = el('text', { x: x + w / 2, y: cy + 18, 'class': 's' }, svg); b.textContent = t2; }
  }
  function line(svg, d, cls) { el('path', { d: d, 'class': cls || 'ar' }, svg); }
  function note(svg, x, y, s, cls) { var t = el('text', { x: x, y: y, 'class': cls || 's' }, svg); t.textContent = s; }

  /* 左列 x16 w180；右列 x224 w180；整行 x16 w388。从下往上画。 */
  var L = 16, R = 224, W = 180, F = 388;
  var COUPLE = [
    { id: 'same', name: '同一套 token',
      draw: function (s) {
        note(s, 210, 22, '一个 Transformer，动作就是词表里的 token', 'h');
        box(s, L, 380, W, 46, 'vl', '图文 token', '');
        box(s, R, 380, W, 46, 'vl', '动作 token', '词表里的离散码');
        line(s, 'M106 380V352M314 380V352');
        box(s, L, 300, F, 52, 'vl diff', '注意力：全部共用', '');
        line(s, 'M106 300V272M314 300V272');
        box(s, L, 220, F, 52, 'vl diff', 'FFN：全部共用', '');
        line(s, 'M210 220V190');
        box(s, L, 136, F, 54, 'vl', 'LM 头', '逐个预测下一个 token（含动作 token）');
        note(s, 210, 110, '↑ 解码出离散动作，再反量化成连续值');
        note(s, 210, 70, '不加任何新参数，但动作精度受码本限制');
      },
      info: '<b>动作从主干拿到什么：</b>动作 token 本身就在主干里，和文字没有区别。<br><b>哪些权重共用：</b>全部，包括输出头。<br><b>代表：</b>RT-2、OpenVLA、π0-FAST；视频模型版本是 Cosmos Policy（把动作写进隐帧，和画面一起去噪）。<br><b>好处：</b>最简单，语言接口天然保留。<br><b>代价：</b>精度受分词方式限制；自回归逐 token 解码，动作越长越慢；动作监督直接改写 VLM 的全部权重。' },
    { id: 'ffn', name: '共享注意力，分 FFN',
      draw: function (s) {
        note(s, 210, 22, '一套注意力，FFN 按 token 类型分两份', 'h');
        box(s, L, 380, W, 46, 'vl', '图文 token', '');
        box(s, R, 380, W, 46, 'ac', '加噪动作 token', '和主干同宽');
        line(s, 'M106 380V352M314 380V352');
        box(s, L, 300, F, 52, 'vl diff', 'QKV / O 投影：共用一套', '动作 token 也用图文那套');
        line(s, 'M106 300V272M314 300V272');
        box(s, L, 214, F, 58, 'jt', '联合自注意力', '动作 token 每层都读图文的 K、V');
        line(s, 'M106 214V186M314 214V186');
        box(s, L, 134, W, 52, 'vl', 'VL FFN', '继承');
        box(s, R, 134, W, 52, 'ac', '动作 FFN', '新加');
        line(s, 'M106 134V104M314 134V104');
        note(s, 106, 94, 'LM 头'); note(s, 314, 94, '流匹配头');
      },
      info: '<b>动作从主干拿到什么：</b>每一层都和图文 token 一起做注意力。<br><b>哪些权重共用：</b>归一化、QKV、O 投影共用，只有 FFN 分开。<br><b>代表：</b>WALL-OSS 原版。<br><b>好处：</b>新增参数少（WALL-OSS 只多 12.5%）。<br><b>代价：</b>动作 token 必须和主干一样宽；注意力投影同时服务语言和动作，互相干扰的可能更大。同一团队后来的 0.5 和 1.0-lite 都改成了下一种。' },
    { id: 'mot', name: '每层联合注意力，权重分开（MoT）',
      draw: function (s) {
        note(s, 210, 22, '两套权重，每层做一次联合注意力', 'h');
        box(s, L, 380, W, 46, 'vl', '图文 token', '');
        box(s, R, 380, W, 46, 'ac', '状态 + 加噪动作', '可以更窄');
        line(s, 'M106 380V352M314 380V352');
        box(s, L, 300, W, 52, 'vl', 'QKV 投影', '主干那套');
        box(s, R, 300, W, 52, 'ac diff', 'QKV 投影', '动作专家自己的');
        line(s, 'M106 300V272M314 300V272');
        box(s, L, 214, F, 58, 'jt', '联合自注意力（一次 softmax）', 'Q、K、V 沿序列拼起来一起算');
        line(s, 'M106 214V186M314 214V186');
        box(s, L, 134, W, 52, 'vl', 'O 投影 + FFN', '主干那套');
        box(s, R, 134, W, 52, 'ac diff', 'O 投影 + FFN', '动作专家自己的');
        line(s, 'M106 134V104M314 134V104');
        note(s, 106, 94, 'LM 头'); note(s, 314, 94, '流匹配头');
        note(s, 210, 60, '掩码：图文看不到动作；动作看得到全部');
      },
      info: '<b>动作从主干拿到什么：</b>和上一种一样，每一层都读图文 token 的 K、V。<br><b>哪些权重共用：</b>不共用，只共用“一次 softmax”。<br><b>代表：</b>π0、π0.5、Wall-OSS-0.5、WALL-OSS-1.0-lite；FTP-1 加了第三路触觉专家；OpenWAM-α 把左边换成视频 DiT。<br><b>好处：</b>动作专家可以更小更窄，推理时主干的 KV 可以缓存、只反复跑动作专家去噪。<br><b>代价：</b>多一整套注意力参数；动作专家从零初始化，它的梯度仍会流回主干（π0.5 用知识隔离把这条梯度切断）。' },
    { id: 'kv', name: '逐层交叉注意力读 KV',
      draw: function (s) {
        note(s, 210, 22, '动作专家是另一个网络，每层读主干同层的 K、V', 'h');
        box(s, L, 380, W, 46, 'vl', '图文 token', '');
        box(s, R, 380, W, 46, 'ac', '加噪动作 token', '');
        line(s, 'M106 380V352M314 380V352');
        box(s, L, 300, W, 52, 'vl', '主干第 l 层', '自注意力 + FFN');
        box(s, R, 300, W, 52, 'ac', '专家第 l 层：自注意力', '只在动作 token 之间');
        line(s, 'M314 300V272');
        box(s, R, 220, W, 52, 'ac diff', '交叉注意力', 'Q 来自动作，K、V 来自主干');
        line(s, 'M196 326C214 326 206 246 224 246', 'ar kv');
        
        line(s, 'M106 300V200M314 220V190');
        box(s, L, 148, W, 52, 'vl', '主干第 l+1 层', '');
        box(s, R, 138, W, 52, 'ac', '专家 FFN', '');
        note(s, 210, 90, '虚线：主干第 l 层的 K、V 送进专家第 l 层');
        note(s, 210, 66, '主干看不到动作；两边各自 softmax');
      },
      info: '<b>动作从主干拿到什么：</b>每一层都拿到主干同一层的 K、V，但通过单独的交叉注意力，不和主干共用一次 softmax。<br><b>哪些权重共用：</b>不共用。<br><b>代表：</b>MolmoAct2（36 层 DiT 专家逐层读 Molmo2-ER 的 K、V）。<br><b>和 MoT 的关系：</b>非常接近。MoT 里动作 token 在同一个 softmax 里同时看主干和自己；这里拆成“先看自己、再看主干”两步。信息来源一样，都是逐层的。<br><b>代价：</b>专家层数要和主干对齐（或者做层间映射）。' },
    { id: 'feat', name: '只读一组特征（交叉注意力）',
      draw: function (s) {
        note(s, 210, 22, '主干先算完，动作头只读它输出的一组 token', 'h');
        box(s, L, 380, W, 46, 'vl', '图文 token', '');
        box(s, R, 380, W, 46, 'ac', '加噪动作 token', '');
        line(s, 'M106 380V352M314 380V352');
        box(s, L, 270, W, 82, 'vl', '主干 N 层', '一次算完');
        line(s, 'M106 270V236');
        box(s, L, 184, W, 52, 'vl diff', '输出特征', '某一层（如第 12 层）');
        box(s, R, 300, W, 52, 'ac', '动作 DiT：自注意力', '');
        line(s, 'M314 300V272');
        box(s, R, 220, W, 52, 'ac', '交叉注意力', 'K、V = 这组特征');
        line(s, 'M196 210C214 210 206 246 224 246', 'ar kv');
        line(s, 'M314 220V190');
        box(s, R, 138, W, 52, 'ac', '重复若干块', '多步去噪只跑这一侧');
        note(s, 210, 90, '信息瓶颈：动作只看到一层的输出');
      },
      info: '<b>动作从主干拿到什么：</b>主干某一层（往往是中间层）的输出 token，作为交叉注意力的 K、V。<br><b>哪些权重共用：</b>不共用；主干甚至可以完全冻结。<br><b>代表：</b>GR00T N1（Eagle-2 截到第 12 层，DiT 交叉注意力读它）；CogACT（VLM 输出一个“认知特征”，扩散动作 Transformer 以它为条件）。<br><b>好处：</b>主干和动作头可以分开训、分开换；主干只跑一次。<br><b>代价：</b>动作只看到一层压缩后的信息。MolmoAct2 的论文就是拿这一点作为改成逐层读 KV 的理由。' },
    { id: 'hier', name: '分层：两套模型，靠语言或潜变量交接',
      draw: function (s) {
        note(s, 210, 22, '高层模型慢慢想，低层策略快快动', 'h');
        box(s, L, 330, F, 70, 'vl', '高层 VLM（System 2）', '看画面和指令，输出下一步子任务');
        line(s, 'M210 330V292');
        box(s, 120, 238, 180, 54, 'jt diff', '接口', '一句话 / 一个潜向量');
        line(s, 'M210 238V200');
        box(s, L, 130, F, 70, 'ac', '低层策略（System 1 / 0）', '本身也可以是一个完整的 VLA');
        line(s, 'M210 130V100');
        note(s, 210, 88, '→ 机器人');
        note(s, 210, 60, '高层约 1 Hz，低层几十到上百 Hz（因系统而异）');
      },
      info: '<b>动作从主干拿到什么：</b>只拿到高层给的子任务文字或一个潜向量。<br><b>哪些权重共用：</b>两套独立模型。<br><b>代表：</b>Hi Robot（高层 VLM 输出语言指令，低层是 π0 式 VLA）；GR00T 2 用前沿多模态智能体当 System 2；CraftNet 的 System 2 / 1 / 0 三层。GR00T N1 也叫 System 1 / 2，但它是上一种“读特征”的单个模型，端到端一起训。<br><b>好处：</b>高层可以直接换成更强的大模型；两层可以跑不同频率。<br><b>代价：</b>接口窄，信息损失；两层要分别准备训练数据。' }
  ];

  function initCouple() {
    var svg = $('#cp-svg');
    if (!svg) return;
    var seg = $('#cp-seg');
    var info = $('#cp-info');
    function show(c, btn) {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      c.draw(svg);
      $$('button', seg).forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      info.innerHTML = '<h4>' + c.name + '</h4><p>' + c.info + '</p>';
      $('#cp-title').textContent = c.name;
    }
    COUPLE.forEach(function (c, i) {
      var b = h('button', { type: 'button', 'aria-pressed': 'false' }, (i + 1) + ' ' + c.name);
      b.addEventListener('click', function () { show(c, b); });
      seg.appendChild(b);
    });
    var first = seg.querySelector('button');
    show(COUPLE[0], first);
  }

  function init() { initAnatomy(); initCouple(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
