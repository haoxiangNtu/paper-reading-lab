'use strict';
/* GraspGen (arXiv 2507.13097): the two networks taken apart in eleven scenes. Six scenes on PTv3 (voxel grid,
   space-filling-curve serialization, patch attention, one block, pooling, global mean), two on the noise head and the
   denoising loop, one on the discriminator, one on training. Structure and shapes are read from the official code at commit
   2dd8852 (ptv3.py, serialization/default.py, model_utils.py, generator.py, discriminator.py). Serialization codes, patches
   and stage sizes are computed in this page for a toy mug with the same rules as the code. Every scene exposes update(p),
   a pure function of the timeline p in [0,1]. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { obj: 0x7cb8ff, enc: 0x38d1ff, gen: 0x4fc98a, dis: 0xf0963c, sim: 0x8e9bb8, noise: 0xd45fa0, grad: 0xff7a59, ok: 0x4fc98a, col: 0xff5d5d, far: 0xf2c14e, ang: 0x9d8cff, plan: 0x9d8cff, time: 0xf2c14e, frz: 0x9fd8ff };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toy = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const mine = t => `<p class="guess"><b>我的推断 · </b>${t}</p>`;
  const calc = t => `<p class="guess"><b>当场算 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const fmt = n => n.toLocaleString('en-US');
  const wan = n => (n / 1e4).toFixed(n >= 1e6 ? 0 : 1) + ' 万';

  /* ---------- the toy object and the serialization rules, computed with the same steps as the code ---------- */
  const KAP = 3.27, NPTS = 2000, ORD = ['z', 'z-trans', 'hilbert', 'hilbert-trans'];
  const Ch = [32, 64, 128, 256, 512], De = [2, 2, 2, 6, 2], He = [2, 4, 8, 16, 32];
  /* a mug in metres: wall radius 4 cm, height 10 cm, bottom, a torus handle on +x; centred on the point mean, then times kappa */
  function mugMetres(N, seed) {
    const r = L.rng(seed), o = [];
    for (let i = 0; i < N; i++) {
      const u = r();
      if (u < 0.68) { const a = r() * 2 * Math.PI; o.push([0.04 * Math.cos(a), r() * 0.1, 0.04 * Math.sin(a)]); }
      else if (u < 0.78) { const ra = 0.04 * Math.sqrt(r()), a = r() * 2 * Math.PI; o.push([ra * Math.cos(a), 0, ra * Math.sin(a)]); }
      else { const a = (r() - 0.5) * 1.15 * Math.PI, b = r() * 2 * Math.PI, q = 0.025 + 0.008 * Math.cos(b); o.push([0.04 + q * Math.cos(a), 0.05 + q * Math.sin(a), 0.008 * Math.sin(b)]); }
    }
    const m = [0, 1, 2].map(j => o.reduce((s, p) => s + p[j], 0) / N);
    return { o, m };
  }
  const bitLen = n => (n > 0 ? n.toString(2).length : 0);
  /* Morton key with x in the top bit of every 3-bit group, as serialization/z_order.py xyz2key */
  function morton(x, y, z, d) { let c = 0; for (let i = d - 1; i >= 0; i--) c = c * 8 + ((x >> i & 1) * 4 + (y >> i & 1) * 2 + (z >> i & 1)); return c; }
  /* Hilbert key: Skilling's method on bit arrays, the same steps as serialization/hilbert.py encode (re-written, not copied) */
  function hilbert(l, nb) {
    const g = [0, 1, 2].map(d => Array.from({ length: nb }, (_, b) => (l[d] >> (nb - 1 - b)) & 1));
    for (let bit = 0; bit < nb; bit++) for (let dim = 0; dim < 3; dim++) {
      const m = g[dim][bit];
      for (let j = bit + 1; j < nb; j++) g[0][j] ^= m;
      for (let j = bit + 1; j < nb; j++) if (!m && (g[0][j] ^ g[dim][j])) { g[dim][j] ^= 1; g[0][j] ^= 1; }
    }
    let acc = 0, c = 0; for (let b = 0; b < nb; b++) for (let d = 0; d < 3; d++) { acc ^= g[d][b]; c = c * 2 + acc; }
    return c;
  }
  /* default.py encode: "-trans" swaps x and y before encoding */
  const enc = (q, o, d) => { const v = (o & 1) ? [q[1], q[0], q[2]] : q; return o < 2 ? morton(v[0], v[1], v[2], d) : hilbert(v, d); };
  function analyse(P, g) {
    const mn = [0, 1, 2].map(k => Math.min(...P.map(p => p[k])));
    const G = P.map(p => p.map((v, k) => Math.floor((v - mn[k]) / g)));
    let mx = 0; G.forEach(q => q.forEach(v => { if (v > mx) mx = v; }));
    const depth = bitLen(mx), codes = ORD.map((_, o) => G.map(q => enc(q, o, depth)));
    const order = codes.map(c => Array.from(c.keys()).sort((a, b) => c[a] - c[b] || a - b));
    const rank = order.map(od => { const r = new Int32Array(od.length); od.forEach((id, k) => { r[id] = k; }); return r; });
    const vmap = new Map(), vox = [], vOf = new Int32Array(P.length);
    G.forEach((q, i) => { const k = q.join(','); let v = vmap.get(k); if (v == null) { v = vox.length; vmap.set(k, v); vox.push({ g: q, pts: [], c: ORD.map((_, o) => codes[o][i]) }); } vox[v].pts.push(i); vOf[i] = v; });
    const vorder = ORD.map((_, o) => vox.map((_, i) => i).sort((a, b) => vox[a].c[o] - vox[b].c[o]));
    return { P, g, mn, G, mx, depth, codes, order, rank, vox, vorder, vOf, vmap };
  }
  /* SerializedPooling: parent = code >> 3 (same grouping for every order), coord = mean of children, depth - 1 */
  function pyramid(A) {
    let cur = A.P.map((p, i) => ({ x: p, g: A.G[i], c: ORD.map((_, o) => A.codes[o][i]) }));
    const st = [cur];
    for (let s = 1; s < 5; s++) {
      const m = new Map(), nx = [];
      cur.forEach((e, i) => {
        const k = Math.floor(e.c[0] / 8); let q = m.get(k);
        if (!q) { q = { sum: [0, 0, 0], n: 0, g: e.g.map(v => v >> 1), c: e.c.map(v => Math.floor(v / 8)), kids: [], idx: nx.length }; m.set(k, q); nx.push(q); }
        q.sum[0] += e.x[0]; q.sum[1] += e.x[1]; q.sum[2] += e.x[2]; q.n++; q.kids.push(i); e.parent = q.idx;
      });
      nx.forEach(q => { q.x = q.sum.map(v => v / q.n); });
      st.push(nx); cur = nx;
    }
    return st;
  }
  /* SerializedAttention padding: last patch is filled with the tail of the previous patch, i.e. it is the last K of the sequence */
  const patchInfo = (n, K) => { const np = Math.ceil(n / K), rem = n % K, pad = n > K && rem ? K - rem : 0; return { np, rem, pad, padded: n > K ? np * K : n }; };
  const members = (rk, n, K) => { if (n <= K) return [0, n]; const p = Math.floor(rk / K), np = Math.ceil(n / K); return p === np - 1 && n % K ? [n - K, n] : [p * K, p * K + K]; };
  const patchOf = (rk, n, K) => (n <= K ? 0 : Math.floor(rk / K));
  const STORE = {};
  function mug(sc = 1, g = 0.01) {
    const k = sc + '_' + g; if (STORE[k]) return STORE[k];
    if (!STORE.m) STORE.m = mugMetres(NPTS, 7);
    const { o, m } = STORE.m, P = o.map(p => p.map((v, j) => (v - m[j]) * KAP * sc)), A = analyse(P, g);
    return (STORE[k] = A);
  }
  function pyr(sc) { const k = 'pyr' + sc; return STORE[k] || (STORE[k] = pyramid(mug(sc))); }
  /* a small 3 cm box in the same batch: K is the minimum point count over the batch */
  function smallBox() {
    if (STORE.box) return STORE.box;
    const r = L.rng(31), o = []; for (let i = 0; i < 400; i++) { const f = Math.floor(r() * 6), a = r() * 0.03, b = r() * 0.03, s = f % 2 ? 0.03 : 0; const ax = Math.floor(f / 2); const p = [0, 0, 0]; p[ax] = s; p[(ax + 1) % 3] = a; p[(ax + 2) % 3] = b; o.push(p.map(v => v * KAP)); }
    return (STORE.box = pyramid(analyse(o, 0.01)).map(s => s.length));
  }
  /* parameter counts from the layer shapes (my arithmetic; no weights loaded) */
  const blockP = C => ({ cpe: 27 * C * C + C + C * C + C + 2 * C, attn: 3 * C * C + 3 * C + C * C + C, ln: 4 * C, mlp: C * 4 * C + 4 * C + 4 * C * C + C });
  const blockT = C => { const b = blockP(C); return b.cpe + b.attn + b.ln + b.mlp; };
  const PTV3P = (() => { let t = 125 * 3 * 32 + 64; Ch.forEach((c, i) => { t += De[i] * blockT(c); if (i) t += Ch[i - 1] * c + c + 2 * c; }); return t; })();
  const HEADP = { smp: 6 * 512 + 512 + 512 * 512 + 512, time: 512 * 2048 + 2048 + 2048 * 512 + 512, blk: 4 * 1536 * 1536 + 4 * 1536 + 2 * 1536 + 1536 * 512 + 512 + 512 * 1536 + 1536 + 2 * 1536, out: 1536 * 768 + 768 + 768 * 384 + 384 + 384 * 6 + 6, pos: 1536 };
  HEADP.all = HEADP.smp + HEADP.time + 3 * HEADP.blk + HEADP.out + HEADP.pos;
  const DISP = { smp: HEADP.smp, head: 1024 * 512 + 512 + 512 * 256 + 256 + 256 + 1 };
  const DROP = Array.from({ length: 14 }, (_, i) => 0.3 * i / 13);
  /* diffusers 0.11.1 schedules for T = 10 */
  const T10 = 10;
  const SCH = (() => {
    const lin = Array.from({ length: T10 }, (_, i) => { const a = Math.sqrt(1e-4), b = Math.sqrt(0.02); return Math.pow(a + (b - a) * i / (T10 - 1), 2); });
    const f = t => Math.cos((t + 0.008) / 1.008 * Math.PI / 2) ** 2, cos = Array.from({ length: T10 }, (_, i) => Math.min(1 - f((i + 1) / T10) / f(i / T10), 0.999));
    const mk = b => { const ab = []; let c = 1; b.forEach(x => { c *= 1 - x; ab.push(c); }); return { b, ab }; };
    return { pos: mk(lin), rot: mk(cos) };
  })();

  /* ---------- scene list (text is shown in the panel and in the list below the stage) ---------- */
  const A0 = mug(1), PY0 = pyr(1), NS = PY0.map(s => s.length), VX = A0.vox.length;
  const SCENES = [
    { n: 1, part: '总览', title: '从一团点到一个打过分的抓取', sub: '点方块跳到对应的一幕', dur: 13, cam: [0.02, 0.92, 36, [0, 1.6, 0]],
      html: dl([['输入', '物体点云 [1, N, 3]，部署 N = 2048'], ['编码', 'PTv3 → [1, 512]'], ['生成', '噪声头调用 10 次 → B 个 6 维抓取'], ['打分', '判别器 → [B, 1]'], ['下游', '排序、过滤 → 运动规划器']]) +
        '<p>前排是部署时数据走的路。后排把前排的“PTv3”放大：它内部又分 6 步，第 2 到 7 幕一步一幕。</p>' +
        '<p>第 8、9 幕讲噪声头和 10 步去噪，第 10 幕讲判别器。第 11 幕讲训练：哪部分被梯度更新，哪部分冻结，判别器的梯度会不会回到生成器（不会）。</p>' +
        '<p><b>方块可以点。</b></p>' + src('§3 · 图 2 · generator.py · discriminator.py') },
    { n: 2, part: 'PTv3 · 1', title: '体素化：给每个点记一个整数格号', sub: '可切换网格大小，读数当场算', dur: 13, cam: [0.55, 1.08, 31, [3.0, -0.6, 0]],
      html: dl([['输入', 'coord = feat = κ·xyz，[N, 3]'], ['网格', 'grid_size = 0.01（κ 尺度，Franka 约合 3.06 mm）'], ['格坐标', 'grid_coord = ⌊(coord − 整批最小值) / 0.01⌋'], ['depth', '最大格坐标的二进制位数'], ['玩具', `2000 点，占 ${VX} 格，depth ${A0.depth}`]]) +
        '<p><b>大白话：</b>在空间里铺一层 3 mm 的方格纸，每个点记下自己落在第几格，得到三个整数 (i, j, k)。</p>' +
        '<p>这一步<b>不删点，也不合并点</b>。同一格里的几个点格号相同，各自保留。真正的合并在第 6 幕的池化里。</p>' +
        '<p>为什么要整数格号：后面两件事靠它。一是空间填充曲线只能给整数编码（下一幕）；二是稀疏卷积（第一层 embedding 和每个 Block 的 xCPE）按格号找邻居。</p>' +
        '<p>输入特征就是坐标本身：<code>feat</code> 和 <code>coord</code> 是同一个 κ·xyz（3 维），所以 <code>in_channels=3</code>。</p>' +
        mine('同一格里有多个点时，spconv 的稀疏卷积怎么处理重复格号，我没有核实。') +
        toy('杯子是我造的：半径 4 cm、高 10 cm、带把手，2000 个点撒在表面上，减均值后乘 κ = 3.27。真实输入是相机看到的部分点云，Franka 生成器训练用 3500 点，判别器和发布配置推理用 2048 点。') +
        src('model_utils.py:51–62 convert_to_ptv3_pc_format · ptv3.py:101–108 · generator.py:294–298 · runs/train_graspgen_franka_panda_*.sh（grid_size 0.01，κ 3.27）') },
    { n: 3, part: 'PTv3 · 2', title: '序列化：按空间填充曲线排成一条线', sub: '可切换 4 种序；点一个体素看它的码怎么算', dur: 15, cam: [0.5, 1.05, 31, [3.2, -0.6, 0]],
      html: dl([['码', '每个点一个整数，3 × depth 位'], ['z', 'x、y、z 的二进制位交错（Morton 码）'], ['z-trans', '先交换 x、y，再交错'], ['hilbert', 'Hilbert 曲线上的编号'], ['多物体', 'code = batch << 3·depth | code'], ['排列', '4 种码各 argsort 一次']]) +
        '<p><b>“PTv3 先把点序列化成结构化格式”说的就是这一步：</b>给每个点算一个整数码，再按码排序。排完以后，三维点云变成了一条一维序列，像一句话里的一串词。</p>' +
        '<p>这条曲线一格一格走遍整个立方体。曲线上挨着的两格，大多在空间里也挨着（右上角的比例当场算）。所以“序列里挨着”约等于“空间里挨着”。之后切块就能像切文本一样按位置切，不用对每个点做 kNN 或球查询。</p>' +
        '<p><b>怎么读 Z 码：</b>把 x、y、z 写成二进制，从最高位开始，每层取 x、y、z 各一位拼起来。最高 3 位决定在 8 个大子块里的哪一个，再 3 位决定子块的子块，依此类推。所以码的前缀就是八叉树上的路径。第 6 幕的池化用的就是这一点。</p>' +
        '<p><b>Hilbert</b> 也是 3 × depth 位，但每一层会按所在子块旋转、翻转，所以相邻编号一定是面相邻的格子，不跳。Z 曲线在大子块之间会跳。</p>' +
        '<p>不同物体码前面拼上物体序号，排序后物体之间不会混在一起。</p>' +
        calc('码和排序用代码的规则对玩具杯子算。只画了被占用的格子；曲线定义在整个 2^depth 立方体上，空格被跳过，所以连线有时会跨过空洞。') +
        src('ptv3.py:89–144 Point.serialization · default.py:9–25 encode · serialization/z_order.py（x 在每组最高位）· serialization/hilbert.py（Skilling 算法；我重写成 JS 并检查了 1 到 4 位时相邻编号都面相邻）') },
    { n: 4, part: 'PTv3 · 3', title: '切块：每 K 个点一组，组内做注意力', sub: '可切换序、K 和对照；点一个点当查询', dur: 15, cam: [0.5, 1.05, 31, [3.0, -0.6, 0]],
      html: dl([['K', 'min(批内最少点数, 1024)'], ['切块', '按当前序排好，每 K 个一块'], ['补齐', '最后一块不满时，用前一块末尾的点补满，等于取序列最后 K 个'], ['块内', '多头自注意力 softmax(QKᵀ/√16)，不加相对位置编码'], ['放回', '按逆排列回到原来的顺序']]) +
        '<p><b>大白话：</b>排好队以后，每 K 个人分成一组，组内互相看（注意力），组外的人这一层看不到。</p>' +
        '<p><b>和 PointNet++ 对比：</b>球查询要先选中心点，再为每个中心找半径内的邻居，是邻域搜索。这里分组只要一次排序和 reshape，组的大小固定，在 GPU 上很规整。代价是组的形状由曲线决定，不是一个规整的球。</p>' +
        '<p><b>为什么每个 Block 换一种序：</b>同一个点在不同的序里落进不同的组（右上角给出换下一种序后，原来的组员还剩多少）。连着几层换序，信息就能跨过组的边界。</p>' +
        '<p><b>切到 K = 1024</b> 看代码的真实情况：这个 2000 点的杯子在第 1 阶段只分 2 块；从第 2 阶段起点数不到 1024，整个物体一块，组内注意力就是全局注意力。</p>' +
        mine('没有 RPE 时，注意力只看特征，不看组内谁先谁后。所以随机打乱序（shuffle_orders）只在物体被切成多块时才改变结果。这是我从代码推的，没有运行。') +
        mine('训练时一批有多个物体，K 取点数最少的那个物体。批里有一个小物体，大物体也按小 K 切，块会变多（第 6 幕的表里算了一个例子）。') +
        toy('K = 128 只是为了看清分块。补齐的副本算出来的结果会被丢掉，只用来凑满一块。') +
        src('ptv3.py:327–497 SerializedAttention（K 449–452，补齐 391–446，qkv 464，块内注意力 466–481，逆排列 492）· model_utils.py:124–126（PointNet++ 第 1 层半径 0.02、最多 64 邻居）') },
    { n: 5, part: 'PTv3 · 4', title: '一个 Block 的内部', sub: '可切换阶段；点方块看形状和出处', dur: 14, cam: [0, 0.82, 33, [0.5, 4.2, -1.5]],
      html: dl([['形状', '[N, C] 进，[N, C] 出'], ['xCPE', 'SubMConv3d(C→C, 3³) → Linear → LayerNorm，加回残差'], ['注意力', 'LayerNorm → 切块注意力 → 残差'], ['MLP', 'LayerNorm → C → 4C → GELU → C → 残差'], ['每头', '所有阶段都是 C / H = 16 维'], ['drop_path', '0 到 0.3 线性分给 14 个 Block']]) +
        '<p><b>xCPE</b> 是一层 3×3×3 稀疏卷积：按格号找周围 26 格里的邻居，把局部形状写进特征。它在注意力之前。</p>' +
        '<p><b>注意力</b>让同组里离得远一些的点交换信息。<b>MLP</b> 对每个点单独做非线性变换。三处都是先 LayerNorm 再算，最后加回输入（pre-norm 残差）。</p>' +
        '<p>第 i 个 Block 用第 i % 4 种序。这 4 种序在每次前向开头随机打乱一次（shuffle_orders），每次池化后又打乱一次。下面一排小方块是某一次打乱的例子。</p>' +
        mine('GraspGen 没开 RPE（enable_rpe=False），注意力本身不知道点在哪。位置信息只能从输入特征（就是 xyz）和 xCPE 进来，所以 xCPE 在这里承担了位置编码的角色。') +
        calc(`每个 Block 的参数 = 40C² + 17C（xCPE 28C² + 4C，注意力 4C² + 4C，两个 LayerNorm 4C，MLP 8C² + 5C）。整个编码器（含 embedding 和 4 次池化）约 <b>${wan(PTV3P)}</b>（${fmt(PTV3P)}），其中第 4、5 阶段占 95%。我按层算的，没有加载权重。`) +
        src('ptv3.py:527–614 Block · 500–524 MLP · 878–880 drop_path · 913 order_index = i % len(order) · 136–140 shuffle_orders') },
    { n: 6, part: 'PTv3 · 5', title: '池化：码右移 3 位，8 个子格合成 1 个', sub: '可切换物体大小；每阶段点数和块数当场算', dur: 16, cam: [0.55, 1.08, 32, [3.2, -0.6, 0]],
      html: dl([['合并', 'code >> 3：同一个 2×2×2 父格里的点合成一个'], ['特征', '先 Linear(C_in → C_out)，再取 max'], ['坐标', '取均值'], ['之后', 'BatchNorm + GELU；depth 减 1，格子边长翻倍'], ['五阶段', `点数 ${NS.join(' → ')}（玩具）`]]) +
        '<p><b>大白话：</b>每过一个阶段，把方格纸的格子放大一倍，同一个大格里的点合成一个代表点。通道数同时翻倍，所以点少了，每个点带的信息多了。</p>' +
        '<p>因为码的前缀就是八叉树路径，找父格只是把码右移 3 位，不用搜邻居。动画在第 1 → 2 阶段时把一个父格的子点标成金色。</p>' +
        `<p>这个杯子每阶段点数大约变成 1/2 到 1/4（${NS.slice(1).map((v, i) => (v / NS[i]).toFixed(2)).join('、')}），不是 1/8，因为点只分布在表面上。</p>` +
        '<p>注意第 1 阶段的数是<b>点数</b>，不是格数，同格的点到第一次池化才合并。</p>' +
        mine('越往深层点越少：这个杯子从第 2 阶段起整个物体只有一块，后面的注意力都是全局的。真实物体大小不同，数也不同。') +
        calc('右上角的表对玩具杯子按代码规则算。块数假设一批只有这一个物体；表下面另算了同批再放一个 3 cm 小方块时 K 怎么变。') +
        src('ptv3.py:617–717 SerializedPooling（660 右移，691–697 max 与均值，702 depth − 1）· 882–916 阶段循环') },
    { n: 7, part: 'PTv3 · 6', title: '全局平均：整个物体变成一个 512 维向量', sub: '同一个向量给 B 个候选共用', dur: 12, cam: [0.2, 1.08, 34, [0.5, 2.2, 0]],
      html: dl([['cls_mode', 'True：没有解码器'], ['输出', '最后阶段的点特征按物体求均值 → [#obj, 512]'], ['复制', '按 mask_batch 复制成 [B, 512]'], ['推理', 'PTv3 在去噪循环外只算一次']]) +
        `<p>最后一个阶段这个杯子还剩 ${NS[4]} 个点，每个点 512 维。按物体取平均，得到一个 512 维向量。物体的形状信息全压在这一个向量里，逐点的特征不再往下传。</p>` +
        '<p>B 个候选抓取共用这一个向量，10 步去噪也共用（generator.py:470–476 在循环外）。判别器有自己的 PTv3 实例，部署时同一团点会被再编码一次。</p>' +
        '<p>所以噪声头里没有“抓取看物体哪一块”的注意力，空间上的取舍都在 PTv3 里做完了（读者注 4）。</p>' +
        guess('柱子里的颜色是随机数，不是激活值；中间那根是对这些随机数真算的平均。') +
        src('ptv3.py:989–996 · generator.py:470–476 · discriminator.py:269–277') },
    { n: 8, part: '生成器', title: '噪声头：三个 512 拼成 1536，过 3 个块，输出 6', sub: '点方块看形状、参数和出处', dur: 15, cam: [0, 0.6, 40, [-0.5, 0, 0.8]],
      html: dl([['抓取', '[B, 6] → Linear 512 → ReLU → Linear 512'], ['时间', 't（整数 0–9）→ 正弦 512 → Linear 2048 → Mish → Linear 512'], ['物体', 'PTv3 [1, 512] → 复制成 [B, 512]'], ['拼接', '[抓取, 时间, 物体] → [B, 1536] → unsqueeze → [1, B, 1536]'], ['3 个块', '8 头注意力（每头 192）+ LayerNorm；FFN 1536 → 512 → GELU → 1536 + LayerNorm'], ['输出', '1536 → 768 → 384 → 6（ReLU）'], ['拆分', '前 3 维 → 平移调度器，后 3 维 → 旋转调度器']]) +
        '<p>带噪抓取是 6 个数：平移 3 个（乘过 κ）、轴角 3 个（除过 π）。三路各编码成 512 维，沿特征维拼起来。</p>' +
        '<p><b>序列长是 1：</b>unsqueeze(0) 以后，第 0 维（序列）长 1，B 个候选在第 1 维（批）。softmax 只有一个元素，注意力权重恒为 1（右上角当场算）。所以这三层实际做的是：线性投影、残差、LayerNorm 和 FFN。真正的空间注意力在 PTv3 里。</p>' +
        '<p>右上角另画了时间编码：t = 0 到 9 各变成一个 512 维的正弦向量，高亮的是当前这一步。</p>' +
        calc(`参数：抓取编码 ${wan(HEADP.smp)}，时间编码 ${wan(HEADP.time)}，每个块 ${wan(HEADP.blk)}（三块 ${wan(3 * HEADP.blk)}），输出 MLP ${wan(HEADP.out)}，合计约 <b>${wan(HEADP.all)}</b>，不含 PTv3。我按层算的。`) +
        src('generator.py:657–888 DiffusionNoisePredictionNet（688–693 时间，695–700 抓取，708–714 输出，849–877 cat_attn）· model_utils.py:71–89 SinusoidalPosEmb，198–222 AttentionLayer / FFNLayer') },
    { n: 9, part: '生成器', title: '去噪循环：10 次调用，两个调度器各管 3 维', sub: '调度公式是真的；“噪声头”是知道答案的替身', dur: 16, cam: [0.4, 0.95, 40, [4.5, 0.5, 0]],
      html: dl([['起点', 'B 个 6 维向量，全部 ~ N(0, I)'], ['每一步', '噪声头算 ε̂ [B, 6]；平移调度器更新前 3 维，旋转调度器更新后 3 维'], ['平移', 'scaled_linear，β 1e-4 → 0.02（diffusers 默认）'], ['旋转', 'squaredcos_cap_v2'], ['步数', 't = 9, 8, …, 0，共 10 步'], ['还原', '平移 ÷ κ；轴角 × π 再变成旋转矩阵；grasp_server 再加回点云均值']]) +
        '<p>每一步：DDPM 先由 ε̂ 估出干净的 x̂₀，裁到 [−1, 1]，再按 x_{t−1} = c₀·x̂₀ + cₜ·x_t + σ·z 往前走一步。两个调度器的 c₀、cₜ、σ 不同（右上角当场算）。</p>' +
        '<p><b>看出来的差别：</b>平移的 ᾱ 在 t = 9 还有 0.927，cₜ ≈ 0.73，每步只往目标挪一点；旋转的 ᾱ 在 t = 9 只有 2.4×10⁻⁵，前几步 σ ≈ 1，基本每步重新抽一个随机旋转，到最后两三步才定下来。这就是读者注 5 的表。</p>' +
        '<p>训练时则反过来：随机取 t ∈ {0…9}，把真抓取加噪成 g̃ = √ᾱ·g + √(1−ᾱ)·ε，让噪声头猜 ε。</p>' +
        toy('16 个目标抓取是我放在杯子周围的（杯口向下、侧面、把手）。这里的“噪声头”直接由目标反推 ε̂，相当于一个完美的网络，所以最后一定准确落到目标上。真实网络会有误差，这正是判别器要处理的。') +
        src('generator.py:456 torch.randn · 486–537 循环和两个 step · 162–175 两个调度器 · diffusers 0.11.1 scheduling_ddpm.py · math_utils.py matrix_to_rt / rt_to_matrix') },
    { n: 10, part: '判别器', title: '判别器：物体 512 + 抓取 512 → 一个分数', sub: '点方块看结构；可切换过滤方式', dur: 15, cam: [0, 0.62, 41, [-1.2, 0, 3.4]],
      html: dl([['物体', '同结构的 PTv3 → [1, 512] → [B, 512]；论文配方：加载生成器的编码器并冻结'], ['抓取', '[B, 6] → Linear 512 → ReLU → Linear 512'], ['拼接', '[抓取, 物体] → [B, 1024]'], ['头', '1024 → 512 → ReLU → 256 → ReLU → 1（logit）'], ['分数', 'sigmoid(logit)，[#obj, B, 1]'], ['训练', 'BCE，标签 = 仿真里这个抓取成没成功；每批只对损失最大的 75% 求平均']]) +
        '<p>判别器回答的是“在这个位姿抓下去会不会成功”，不是“这个样本是真的还是生成的”。生成器采出来的成功抓取就是正例。</p>' +
        '<p><b>雪花 = 冻结：</b>只有在配置了 <code>checkpoint_object_encoder_pretrained</code> 时，才会加载权重并把编码器的 requires_grad 关掉。Franka 发布的 yml 指向生成器权重；runs 脚本没传，默认 null（读者注 6）。冻结时，从头训练的只有抓取编码和输出头，约 ' + wan(DISP.smp + DISP.head) + ' 参数。</p>' +
        '<p><b>部署：</b>给 B 个候选打分，排序，取 top-k 或过阈值，再交给运动规划器检查可达和碰撞。grasp_server 默认采 200 个，取前 100。</p>' +
        '<p><b>75% 难样本：</b>右上角下半部分对这 24 个候选算了每个的 BCE，只保留最大的 18 个求平均。这个 75% 是训练时的损失选择，不是部署时留下 75% 的抓取。</p>' +
        guess('候选是第 9 幕的 16 个目标加 8 个我造的坏抓取（碰撞、太远、歪了）。分数是规则造的，不是训练出来的；BCE 和 top-75% 的算法和代码一样。') +
        src('discriminator.py:93–98 PTv3 · 107–112 抓取编码 · 148–154 输出头 · 156–168 冻结 · 277 拼接 · 285 sigmoid · 291–297 top-k BCE · grasp_server.py') },
    { n: 11, part: '训练', title: '训练时谁被更新：G 和 D 分开训，梯度不跨', sub: '切换看哪一条线', dur: 14, cam: [0, 0.66, 38, [-0.5, 0, 0.8]],
      html: dl([['训练 G', '加噪 → PTv3 + 噪声头 → ε̂；损失比较 ε̂ 和 ε；梯度更新 PTv3 和噪声头'], ['训练 D', '用 G 采样 → 仿真标签 → D 打分 → BCE（top 75%）；梯度只更新 D 的 MLP'], ['冻结', 'D 的 PTv3 复制自 G 并冻结（需显式配置）'], ['部署', '没有梯度：G 生成，D 打分，规划器筛选']]) +
        '<p>两个网络不同时训练。G 先训完；然后用 G 在训练物体上采样，放进仿真贴标签，再训练 D（论文算法 1）。</p>' +
        '<p>中间连接 G 和 D 的是“采样、仿真”这条数据流，它不可微。所以 D 的梯度从来不会流回 G，这是它和 GAN 的根本区别。</p>' +
        '<p><b>损失的细节：</b>论文写的是平方 L2。Franka 脚本实际是平移、旋转各算一个未平方的 L2 范数，均值后相加（结构表 D3）。</p>' +
        guess('橙色小球表示梯度往哪个模块流，蓝色表示前向数据。方块位置是示意。') +
        src('算法 1 · §3.1 · §3.2 · generator.py:268–405 forward_train · discriminator.py:156–168、291–297 · 结构表 D3、H1') }
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
    $('infoTag').textContent = `第 ${s.n} 幕 · ${s.part}`; $('infoTitle').textContent = s.title; $('infoBody').innerHTML = s.html; $('stepNo').textContent = `${s.n} / ${SCENES.length}`;
    stepsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(+b.dataset.i === i)));
    btns.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
  }
  let lastCap = null;
  const cap = h => { if (h !== lastCap) { lastCap = h; $('cap').innerHTML = h; } };

  /* ---------- 3D helpers ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.6, phi: 1.0, dist: 26, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);
  let LABS = [], refDist = 26, PICKS = [];
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  /* a label whose text can change; returns set(text) */
  function dynLab(G, pos, o = {}) {
    const st = { s: null, t: null };
    const f = t => { if (t === st.t) return; if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; st.s = lab(t, f.pos || pos, o); G.add(st.s); };
    f.vis = v => { if (st.s) st.s.visible = v; }; return f;
  }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 10, 8);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: 0.6, depthWrite: o.depthWrite }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; for (let i = 0; i < n; i++) im.setColorAt(i, _C.setRGB(1, 1, 1)); return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im, n) { if (n != null) im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.14) { const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im); return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); }; }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.5, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  function clouds(n, size = 0.09) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); const m = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity: 0.95, sizeAttenuation: true, depthWrite: false }); const o = new THREE.Points(g, m); o.frustumCulled = false; return o; }
  function setPt(o, i, p, c) { o.geometry.attributes.position.array.set(p, i * 3); if (c) o.geometry.attributes.color.array.set(c, i * 3); }
  function ptDone(o, n) { o.geometry.attributes.position.needsUpdate = true; o.geometry.attributes.color.needsUpdate = true; if (n != null) o.geometry.setDrawRange(0, n); }
  function segs(G, n, o = {}) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 6), 3)); const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: o.opacity ?? 0.9 })); m.frustumCulled = false; G.add(m); const P = g.attributes.position.array, C = g.attributes.color.array; return { m, set(i, a, b, c) { P.set(a, i * 6); P.set(b, i * 6 + 3); C.set(c, i * 6); C.set(c, i * 6 + 3); }, done(k) { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.setDrawRange(0, k * 2); } }; }
  /* thick line segments as instanced cylinders (WebGL lines are always 1 px) */
  const ROD = new THREE.CylinderGeometry(1, 1, 1, 6), _Y = new THREE.Vector3(0, 1, 0), _D = new THREE.Vector3(), _Q = new THREE.Quaternion();
  function rods(G, n, r = 0.07) { const im = inst(ROD, n); G.add(im); return { set(i, a, b, c) { _D.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const l = _D.length() || 1e-4; _Q.setFromUnitVectors(_Y, _D.normalize()); _P.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); _Sv.set(r, l, r); im.setMatrixAt(i, _M.compose(_P, _Q, _Sv)); colI(im, i, c); }, done(k) { done(im, k); } }; }
  const hsl = (h, s, l) => { _C.setHSL(((h % 1) + 1) % 1, s, l); return [_C.r, _C.g, _C.b]; };
  const rankCol = t => hsl(0.68 - 0.68 * t, 0.8, 0.56);
  const patchCol = i => hsl(i * 0.618034 + 0.07, 0.7, 0.58);
  const DIM = [0.32, 0.37, 0.48];
  const SC = 24, W = p => [p[0] * SC, p[1] * SC, p[2] * SC];

  /* HUD: a small 2D panel over the stage */
  const hudEl = $('hud'), hudG = hudEl.getContext('2d');
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function hud(w, h, draw) {
    const small = document.body.classList.contains('embed') || $('stage').clientWidth < 640, k = small ? 0.74 : 1, dpr = Math.min(2, devicePixelRatio || 1);
    hudEl.hidden = false; hudEl.style.width = w * k + 'px'; hudEl.style.height = h * k + 'px'; hudEl.width = w * k * dpr; hudEl.height = h * k * dpr;
    hudG.setTransform(dpr * k, 0, 0, dpr * k, 0, 0); hudG.clearRect(0, 0, w, h); hudG.font = '12.5px "Noto Sans SC",system-ui,sans-serif'; hudG.textBaseline = 'alphabetic'; draw(hudG, css('--fg') || '#e6ecf7', css('--muted') || '#8e9bb8');
  }
  const hexs = c => '#' + c.toString(16).padStart(6, '0');
  const rgbs = c => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
  const MONO = '12.5px "JetBrains Mono",ui-monospace,monospace', BODY = '12.5px "Noto Sans SC",system-ui,sans-serif';
  const BITC = ['#e0473f', '#1f9d55', '#2f7fd8'];
  function floor(G, y = -5.6, s = 30) { const g = L.grid(s, s); g.position.y = y; G.add(g); }
  /* points of the mug as a faint cloud */
  function mugCloud(G, A, op = 0.5, size = 0.11, tr = W) { const c = clouds(A.P.length, size); c.material.opacity = op; A.P.forEach((p, i) => setPt(c, i, tr(p), [0.55, 0.7, 0.95])); ptDone(c, A.P.length); G.add(c); return c; }
  /* control groups kept across scene changes */
  const STATE = { g2: 1, o3: 0, o4: 0, k4: 0, m4: 0, st5: 0, sz6: 0, f10: 0, v11: 3 };
  (qs.get('ctl') || '').split(',').forEach(kv => { const [k, v] = kv.split(':'); if (k in STATE && v != null) STATE[k] = +v; });

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    floor(G, 0, 44);
    const zF = 4.2, zB = -4.6;
    const row = [['点云\n[1, N, 3]', COL.obj, 2], ['PTv3\n编码器', COL.enc, 3], ['物体向量\n[1, 512]', COL.enc, 7], ['噪声头\n× 10 步', COL.gen, 8], ['B 个抓取\n[B, 6]', COL.noise, 9], ['判别器\n[B, 1]', COL.dis, 10], ['排序\n过滤', COL.dis, 10], ['运动\n规划器', COL.plan, 11]];
    const Xs = row.map((_, i) => -12.6 + i * 3.6);
    const F = row.map((r, i) => { const h = i === 1 ? 2.2 : 1.3, b = block(2.5, h, 1.8, r[1], [Xs[i], h / 2, zF]); b.userData.go = r[2] - 1; PICKS.push(b); G.add(b, lab(r[0], [Xs[i], h + 1.0, zF], { size: 21 })); return b; });
    F[7].userData.go = 10;
    const sub = [['体素化', 2], ['曲线排序', 3], ['切块注意力', 4], ['Block 内部', 5], ['池化', 6], ['全局平均', 7]], Xb = sub.map((_, i) => -13.8 + i * 4.6);
    const B = sub.map((r, i) => { const b = block(2.6, 0.8, 1.5, COL.enc, [Xb[i], 0.4, zB], { opacity: 0.9 }); b.userData.go = r[1] - 1; PICKS.push(b); G.add(b, lab(`${r[1]} · ${r[0]}`, [Xb[i], 1.45, zB], { size: 20 })); return b; });
    const T = block(2.6, 0.8, 1.5, COL.grad, [13.8, 0.4, zB]); T.userData.go = 10; PICKS.push(T); G.add(T, lab('11 · 训练', [13.8, 1.45, zB], { size: 20 }));
    for (let i = 0; i < 7; i++) wire(G, [[Xs[i] + 1.25, 0.5, zF], [Xs[i + 1] - 1.25, 0.5, zF]], COL.sim, { opacity: 0.6 });
    for (let i = 0; i < 5; i++) wire(G, [[Xb[i] + 1.3, 0.4, zB], [Xb[i + 1] - 1.3, 0.4, zB]], COL.sim, { opacity: 0.6 });
    wire(G, [[Xs[1] - 0.8, 0.05, zF - 0.9], [Xb[0], 0.05, zB + 0.75]], COL.enc, { opacity: 0.6, dashed: true }); wire(G, [[Xs[1] + 0.8, 0.05, zF - 0.9], [Xb[5], 0.05, zB + 0.75]], COL.enc, { opacity: 0.6, dashed: true });
    G.add(lab('PTv3 内部（第 2–7 幕）', [-2.3, 3.1, zB], { size: 19 }));
    const f = stream(G, 6, COL.enc), fb = stream(G, 5, COL.enc);
    return { update(p) {
      const q = (p * 16) % 1, i = Math.min(7, Math.floor(seg(p, 0, 0.55) * 8)), k = Math.min(5, Math.floor(clamp((p - 0.55) / 0.42, 0, 0.999) * 6));
      F.forEach((b, n) => glow(b, n === i && p < 0.55 ? 0.8 : 0)); B.forEach((b, n) => glow(b, n === k && p >= 0.55 ? 0.8 : 0));
      f([[Xs[0], 0.6, zF], [Xs[7], 0.6, zF]], (q + p) % 1, p < 0.55 ? 1 : 0); fb([[Xb[0], 0.5, zB], [Xb[5], 0.5, zB]], (q + p) % 1, p >= 0.55 ? 1 : 0);
      cap(p < 0.55 ? '<b>部署：</b>一团点进去，B 个打过分的抓取出来，再交给规划器' : '<b>PTv3 内部：</b>记格号 → 排成一条线 → 切块做注意力 → 池化 → 平均成一个向量');
    } };
  }

  /* ---------- scene 2: voxel grid ---------- */
  const G2S = [0.005, 0.01, 0.02];
  function s2(G) {
    const g = G2S[STATE.g2], A = mug(1, g), n = A.P.length, nv = A.vox.length;
    floor(G, A.mn[1] * SC - 0.4, 32);
    const pc = clouds(n, 0.13); A.P.forEach((p, i) => setPt(pc, i, W(p), [0.55, 0.75, 1])); ptDone(pc, n); G.add(pc);
    const vim = inst(BOX, nv, { opacity: 0.42, depthWrite: false }); G.add(vim);
    const cen = v => [0, 1, 2].map(k => A.mn[k] + (v.g[k] + 0.5) * g);
    let ymin = 1e9, ymax = -1e9; A.vox.forEach(v => { ymin = Math.min(ymin, v.g[1]); ymax = Math.max(ymax, v.g[1]); });
    A.vox.forEach((v, i) => colI(vim, i, hsl(0.55 - 0.4 * (v.g[1] - ymin) / Math.max(1, ymax - ymin), 0.7, 0.55)));
    /* origin of the grid: the batch-wide minimum, and the axes */
    const o = W(A.mn), len = 4.2;
    const ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], axn = ['x → i', 'y → j', 'z → k'], axc = [0xff7b7b, 0x5fd68f, 0x6fb2ff];
    ax.forEach((d, k) => { G.add(L.arrow(o, [o[0] + d[0] * len, o[1] + d[1] * len, o[2] + d[2] * len], axc[k])); G.add(lab(axn[k], [o[0] + d[0] * (len + 1.0), o[1] + d[1] * (len + 0.7), o[2] + d[2] * (len + 1.0)], { size: 19 })); });
    const om = new THREE.Mesh(BALL, L.mat(COL.far)); om.scale.setScalar(0.22); om.position.set(...o); G.add(om);
    G.add(lab('整批最小值 = 格 (0, 0, 0)', [o[0] - 1.2, o[1] - 1.1, o[2] + 0.6], { size: 19 }));
    /* the example point: the highest point on the handle side */
    let ex = 0; A.P.forEach((p, i) => { if (p[2] - p[0] + p[1] * 0.5 > A.P[ex][2] - A.P[ex][0] + A.P[ex][1] * 0.5) ex = i; });
    const ep = A.P[ex], eg = A.G[ex], ev = A.vox[A.vOf[ex]];
    const eb = new THREE.Mesh(BALL, L.mat(0xffffff, { emissive: 0xf2c14e })); eb.scale.setScalar(0.24); eb.position.set(...W(ep)); G.add(eb);
    const ebox = block(g * SC, g * SC, g * SC, COL.far, W(cen(ev)), { opacity: 0.85 }); G.add(ebox);
    const lp = [A.mn[0] * SC - 4.2, W(ep)[1] - 1.0, W(ep)[2]], exl = dynLab(G, lp, { size: 19, border: 'rgba(242,193,78,.9)' }), lead = wire(G, [[lp[0] + 2.2, lp[1], lp[2]], W(ep)], COL.far, { opacity: 0.9 });
    const realmm = (g / KAP * 1000).toFixed(2), per = (n / nv).toFixed(2);
    hud(266, 168, (h, fg, mu) => {
      h.fillStyle = fg; h.font = BODY; h.fillText(`grid_size ${g}（κ 尺度）≈ 实际 ${realmm} mm`, 10, 18);
      const rows = [['点数 N', String(n)], ['被占用的格', String(nv)], ['平均每格点数', per], ['最大格坐标', String(A.mx)], ['depth（位数）', `${A.depth}  （${A.mx} = ${A.mx.toString(2)}₂）`], ['每个码的位数', `3 × ${A.depth} = ${3 * A.depth}`]];
      rows.forEach((r, i) => { h.fillStyle = mu; h.font = BODY; h.fillText(r[0], 10, 42 + i * 20); h.fillStyle = fg; h.font = MONO; h.fillText(r[1], 112, 42 + i * 20); });
    });
    const fmt3 = v => v.map(x => x.toFixed(3)).join(', ');
    return { ctl: { groups: [{ label: '网格', key: 'g2', items: ['0.005', '0.01（代码）', '0.02'] }] }, update(p) {
      const a = seg(p, 0.18, 0.62);
      A.vox.forEach((v, i) => { const t = (v.g[1] - ymin) / Math.max(1, ymax - ymin), on = t <= a * 1.0001 && a > 0; setI(vim, i, W(cen(v)), on ? g * SC * 0.94 : 0.0001); }); done(vim);
      pc.material.opacity = L.lerp(0.95, 0.55, a);
      const b = seg(p, 0.66, 0.8); ebox.visible = p > 0.66; ebox.scale.setScalar(0.3 + 0.7 * b); eb.visible = p > 0.6;
      exl(p < 0.73 ? `κ·xyz =\n(${fmt3(ep)})` : `⌊(xyz − 最小值) / ${g}⌋\n= 格 (${eg.join(', ')})`); exl.vis(p > 0.6); lead.visible = p > 0.6;
      cap(p < 0.18 ? `玩具杯子 <b>${n}</b> 个点，已减均值、乘 κ。黄色小球是整批的最小角，格号从这里数起` : p < 0.62 ? `铺 ${g} 的方格（实际约 ${realmm} mm）：<b>${nv}</b> 个格子里有点，平均每格 ${per} 个点` : `每个点记下自己的整数格号。最大格号 ${A.mx}，要 <b>${A.depth}</b> 位二进制，下一幕的码就是 3 × ${A.depth} = ${3 * A.depth} 位`);
    } };
  }

  /* ---------- scene 3: space-filling curves ---------- */
  function morton2(x, y, d) { let c = 0; for (let i = d - 1; i >= 0; i--) c = c * 4 + ((x >> i & 1) * 2 + (y >> i & 1)); return c; }
  function hilbert2(x, y, n) { let d = 0; for (let s = n / 2; s >= 1; s /= 2) { const rx = (x & s) > 0 ? 1 : 0, ry = (y & s) > 0 ? 1 : 0; d += s * s * ((3 * rx) ^ ry); if (ry === 0) { if (rx === 1) { x = s - 1 - x; y = s - 1 - y; } const t = x; x = y; y = t; } } return d; }
  function locality(A) {
    const r = L.rng(5), perm = A.vox.map((_, i) => i); for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    const f = od => { let ok = 0; for (let i = 1; i < od.length; i++) { const a = A.vox[od[i - 1]].g, b = A.vox[od[i]].g; if (Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])) <= 1) ok++; } return ok / (od.length - 1); };
    return { o: A.vorder.map(f), rnd: f(perm) };
  }
  function s3(G) {
    const A = mug(1), o = STATE.o3, od = A.vorder[o], nv = od.length, gs = 0.01 * SC, loc = STORE.loc || (STORE.loc = locality(A));
    floor(G, A.mn[1] * SC - 0.4, 32);
    const cen = v => W([0, 1, 2].map(k => A.mn[k] + (v.g[k] + 0.5) * 0.01));
    const vim = inst(BOX, nv); G.add(vim); PICKS.push(vim);
    const rk = new Int32Array(nv); od.forEach((vi, k) => { rk[vi] = k; });
    A.vox.forEach((v, i) => setI(vim, i, cen(v), gs * 0.8)); done(vim);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3)); od.forEach((vi, k) => lg.attributes.position.array.set(cen(A.vox[vi]), k * 3));
    const curve = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: L.isDark() ? 0xe6ecf7 : 0x2b3650, transparent: true, opacity: 0.75 })); curve.frustumCulled = false; G.add(curve);
    const sel = block(gs * 1.6, gs * 1.6, gs * 1.6, 0xffffff, [0, 0, 0], { opacity: 0.6, edgeOpacity: 1, emissive: 0xf2c14e }); G.add(sel);
    let ex = 0; A.vox.forEach((v, i) => { const a = v.g, b = A.vox[ex].g; if (a[0] + a[1] > b[0] + b[1]) ex = i; });
    const st = { pick: STORE.pick3 ?? ex };
    const d = A.depth, bin = (v, n = d) => v.toString(2).padStart(n, '0');
    function draw() {
      const v = A.vox[st.pick], q = v.g, c = v.c[o], sw = (o & 1) ? [q[1], q[0], q[2]] : q;
      hud(366, 262, (h, fg, mu) => {
        h.font = BODY; h.fillStyle = fg; h.fillText(`选中的格 (i, j, k) = (${q.join(', ')})，序 ${ORD[o]}`, 10, 18);
        if (o & 1) { h.fillStyle = mu; h.fillText(`trans：先交换 x、y → (${sw.join(', ')})`, 10, 36); }
        const y0 = (o & 1) ? 56 : 40;
        ['x', 'y', 'z'].forEach((nm, k) => { h.font = BODY; h.fillStyle = BITC[k]; h.fillText(nm, 10, y0 + k * 17); h.font = MONO; h.fillText(`${bin(sw[k])}  (${sw[k]})`, 26, y0 + k * 17); });
        const yc = y0 + 58; h.font = BODY; h.fillStyle = mu;
        if (o < 2) {
          h.fillText('Z 码：从高位起，每层取 x、y、z 各一位', 10, yc);
          h.font = MONO; let x = 10; for (let i = d - 1; i >= 0; i--) { for (let k = 0; k < 3; k++) { h.fillStyle = BITC[k]; h.fillText(String(sw[k] >> i & 1), x, yc + 18); x += 8.6; } x += 5; }
        } else {
          h.fillText('Hilbert 码：每层 3 位，先按子块旋转翻转', 10, yc);
          h.font = MONO; h.fillStyle = fg; h.fillText(bin(c, 3 * d).replace(/(...)/g, '$1 ').trim(), 10, yc + 18);
        }
        h.font = BODY; h.fillStyle = fg; h.fillText(`= ${fmt(c)}，排第 ${rk[st.pick] + 1} / ${nv}（共 ${nv} 格）`, 10, yc + 38);
        h.fillStyle = mu; h.fillText('序列里相邻的两格，在空间里也相邻（26 邻域）的比例：', 10, yc + 62);
        ORD.forEach((nm, k) => { h.fillStyle = k === o ? fg : mu; h.font = k === o ? '600 12.5px "Noto Sans SC",sans-serif' : BODY; h.fillText(`${nm} ${(loc.o[k] * 100).toFixed(1)}%`, 10 + (k % 2) * 150, yc + 80 + Math.floor(k / 2) * 17); });
        h.font = BODY; h.fillStyle = mu; h.fillText(`对照：随机顺序 ${(loc.rnd * 100).toFixed(1)}%（只数有点的格，空格被跳过）`, 10, yc + 115);
        /* a 2D 8 x 8 inset of the same family of curve */
        const X0 = 282, Y0 = 8, cs = 9.5, N2 = 8, pts = [];
        for (let x = 0; x < N2; x++) for (let y = 0; y < N2; y++) pts.push([o < 2 ? morton2(x, y, 3) : hilbert2(x, y, N2), x, y]);
        pts.sort((a, b) => a[0] - b[0]); h.strokeStyle = mu; h.strokeRect(X0, Y0, cs * N2, cs * N2);
        h.lineWidth = 1.4; h.beginPath(); pts.forEach((pp, i) => { const px = X0 + (pp[1] + 0.5) * cs, py = Y0 + (N2 - pp[2] - 0.5) * cs; h.strokeStyle = rgbs(rankCol(i / 63)); if (i) { h.lineTo(px, py); h.stroke(); h.beginPath(); } h.moveTo(px, py); }); h.lineWidth = 1;
        h.fillStyle = mu; h.font = BODY; h.fillText(o < 2 ? '二维 Z 曲线' : '二维 Hilbert', X0 + 2, Y0 + cs * N2 + 15);
      });
    }
    draw();
    return { onPick(hit) { if (hit.object === vim && hit.instanceId != null) { st.pick = hit.instanceId; STORE.pick3 = st.pick; draw(); } },
      ctl: { groups: [{ label: '序', key: 'o3', items: ORD }] }, update(p) {
        const a = seg(p, 0.04, 0.8), m = Math.floor(a * nv);
        od.forEach((vi, k) => colI(vim, vi, k <= m ? rankCol(k / nv) : DIM)); done(vim);
        curve.geometry.setDrawRange(0, Math.max(0, m + 1));
        sel.position.set(...cen(A.vox[st.pick]));
        cap(p < 0.8 ? `按 <b>${ORD[o]}</b> 码从小到大连起来：已走 ${m + 1} / ${nv} 格。颜色从蓝到红是在序列里的位置` : `排好了：三维的点变成一条一维序列。<b>点一个格子</b>，右上角显示它的码是怎么算的`);
      } };
  }

  /* ---------- scene 4: patches and attention inside a patch ---------- */
  const K4 = [128, 1024];
  function s4(G) {
    const A = mug(1), n = A.P.length, o = STATE.o4, K = K4[STATE.k4], ball = STATE.m4 === 1, rk = A.rank[o], od = A.order[o];
    floor(G, A.mn[1] * SC - 0.4, 32);
    const pim = inst(BALL, n); G.add(pim);
    A.P.forEach((p, i) => setI(pim, i, W(p), 0.13)); done(pim);
    /* an invisible, fatter copy of the points makes them easier to click */
    const prox = inst(BALL, n); prox.material.visible = false; A.P.forEach((p, i) => setI(prox, i, W(p), 0.3)); done(prox); G.add(prox); PICKS.push(prox);
    const sg = segs(G, 1100, { opacity: 0.35 });
    let ex = 0; A.P.forEach((p, i) => { if (p[1] - Math.abs(p[2]) * 0.5 > A.P[ex][1] - Math.abs(A.P[ex][2]) * 0.5) ex = i; });
    const st = { q: STORE.q4 ?? ex };
    const qb = new THREE.Mesh(BALL, L.mat(0xffffff, { emissive: 0xffffff })); qb.scale.setScalar(0.3); G.add(qb);
    const R = 0.02 * SC, sph = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), L.mat(COL.far, { opacity: 0.3, depthWrite: false })); sph.scale.setScalar(R); G.add(sph);
    const info = patchInfo(n, K);
    function stats() {
      const q = st.q, [a, b] = members(rk[q], n, K), mem = od.slice(a, b), set = new Set(mem);
      const nx = (o + 1) % 4, [a2, b2] = members(A.rank[nx][q], n, K), keep = A.order[nx].slice(a2, b2).filter(i => set.has(i)).length;
      const ext = [0, 1, 2].map(k => { let lo = 1e9, hi = -1e9; mem.forEach(i => { lo = Math.min(lo, A.P[i][k]); hi = Math.max(hi, A.P[i][k]); }); return (hi - lo) / KAP * 100; });
      const inBall = A.P.filter(p => Math.hypot(p[0] - A.P[q][0], p[1] - A.P[q][1], p[2] - A.P[q][2]) < 0.02).length;
      return { a, b, mem, set, keep, ext, inBall, pid: patchOf(rk[q], n, K), nx };
    }
    let S4 = stats();
    function draw() {
      hud(336, 214, (h, fg, mu) => {
        h.font = BODY; h.fillStyle = fg; h.fillText(`N = ${n}，K = ${K}，序 ${ORD[o]}`, 10, 18);
        h.fillStyle = mu; h.fillText(`切成 ${info.np} 块${info.pad ? `，补到 ${info.padded}` : '，正好整除'}`, 10, 37);
        if (info.pad) h.fillText(`最后一块：末尾 ${info.rem} 个 + 前一块复制来的 ${info.pad} 个`, 10, 55);
        const y = info.pad ? 78 : 60;
        h.fillStyle = fg; h.fillText(`查询点在第 ${S4.pid + 1} 块，和 ${S4.b - S4.a - 1} 个点做注意力`, 10, y);
        h.fillStyle = mu; h.fillText(`这一块的范围（实际尺寸）：${S4.ext.map(v => v.toFixed(1)).join(' × ')} cm`, 10, y + 19);
        h.fillText(`换成下一种序（${ORD[S4.nx]}）后，组员还剩 ${(S4.keep / (S4.b - S4.a) * 100).toFixed(0)}%`, 10, y + 38);
        h.fillStyle = ball ? fg : mu; h.fillText(`对照：PointNet++ 第 1 层球查询（半径 0.02）`, 10, y + 62);
        h.fillText(`内有 ${S4.inBall} 个点（上限 64）`, 10, y + 80);
        h.fillStyle = mu; h.fillText(`代码里 Franka 训练 N = 3500：${patchInfo(3500, 1024).np} 块，补 ${patchInfo(3500, 1024).pad} 个`, 10, y + 104);
      });
    }
    draw();
    return { onPick(hit) { if (hit.object === prox && hit.instanceId != null) { st.q = hit.instanceId; STORE.q4 = st.q; S4 = stats(); draw(); } },
      ctl: { groups: [{ label: '序', key: 'o4', items: ORD }, { label: 'K', key: 'k4', items: ['128（示意）', '1024（代码）'] }, { label: '看', key: 'm4', items: ['PTv3 的块', 'PointNet++ 球查询'] }] },
      update(p) {
        const a = seg(p, 0.02, 0.3), b = seg(p, 0.32, 0.48), c = seg(p, 0.52, 0.85), q = st.q, qp = W(A.P[q]);
        for (let i = 0; i < n; i++) {
          const r = rk[i], t = r / n, seq = r <= a * n ? rankCol(t) : DIM, pc = patchCol(patchOf(r, n, K));
          let col = [L.lerp(seq[0], pc[0], b), L.lerp(seq[1], pc[1], b), L.lerp(seq[2], pc[2], b)];
          if (c > 0) { const inb = ball ? Math.hypot(A.P[i][0] - A.P[q][0], A.P[i][1] - A.P[q][1], A.P[i][2] - A.P[q][2]) < 0.02 : S4.set.has(i); if (!inb) col = col.map(v => L.lerp(v, 0.6, c * 0.85)); else if (ball) col = hex3(COL.far); }
          colI(pim, i, col);
        }
        done(pim);
        qb.position.set(...qp); qb.visible = c > 0; sph.position.set(...qp); sph.visible = ball && c > 0;
        if (!ball && c > 0) { const m = Math.min(1100, Math.floor(c * S4.mem.length)); const qc = patchCol(S4.pid); for (let k = 0; k < m; k++) sg.set(k, qp, W(A.P[S4.mem[k]]), qc); sg.done(m); } else sg.done(0);
        cap(p < 0.3 ? `先按 <b>${ORD[o]}</b> 排序（颜色 = 在序列里的位置）` : p < 0.5 ? `每 <b>${K}</b> 个一块，换颜色：一共 <b>${info.np}</b> 块` : ball ? `PointNet++：以查询点为中心找半径 0.02 内的点，这里只有 <b>${S4.inBall}</b> 个。每个中心都要搜一次` : `白色查询点只和同一块的 <b>${S4.b - S4.a - 1}</b> 个点做注意力。<b>点任意一个点</b>换查询`);
      } };
  }

  /* ---------- scene 5: inside one block ---------- */
  function s5(G) {
    floor(G, 0, 44);
    const s = STATE.st5, C = Ch[s], H = He[s], n = NS[s], K = Math.min(n, 1024), pi = patchInfo(n, K), bp = blockP(C);
    const sh = `[${n}, ${C}]`;
    const parts = [
      { n: `输入\n${sh}`, c: COL.obj, x: -12.8, w: 1.5, h: 1.3, d: `进入第 ${s + 1} 阶段的点特征：${n} 个点（玩具），每个 ${C} 维` },
      { n: 'xCPE\n稀疏卷积 3³', c: COL.enc, x: -9.4, w: 2.2, h: 2.0, d: `xCPE：3×3×3 稀疏卷积 → Linear → LayerNorm，按格号取 26 邻格。参数 ${fmt(bp.cpe)}（ptv3.py:553–563）` },
      { n: '⊕', c: COL.sim, x: -6.9, w: 0.7, h: 0.7, d: '残差：xCPE 的输出加回输入（ptv3.py:595–597）' },
      { n: 'LN', c: COL.sim, x: -5.3, w: 0.8, h: 1.3, d: `LayerNorm(${C})：先归一化再进注意力（pre-norm）` },
      { n: '切块注意力', c: COL.gen, x: -2.2, w: 3.0, h: 2.4, d: `qkv → 按第 i%4 种序重排、切成 ${pi.np} 块 → 块内 softmax(QKᵀ/√16)·V → 逆排列 → 投影。参数 ${fmt(bp.attn)}（ptv3.py:448–497）` },
      { n: '⊕', c: COL.sim, x: 0.9, w: 0.7, h: 0.7, d: '残差：注意力输出加回；训练时 drop_path 会随机丢掉整条分支' },
      { n: 'LN', c: COL.sim, x: 2.5, w: 0.8, h: 1.3, d: `LayerNorm(${C})` },
      { n: `MLP\n${C}→${4 * C}→${C}`, c: COL.dis, x: 5.5, w: 2.6, h: 2.0, d: `MLP：Linear(${C}, ${4 * C}) → GELU → Linear(${4 * C}, ${C})，逐点计算。参数 ${fmt(bp.mlp)}（ptv3.py:501–524）` },
      { n: '⊕', c: COL.sim, x: 8.5, w: 0.7, h: 0.7, d: '残差（ptv3.py:609–612）' },
      { n: `输出\n${sh}`, c: COL.obj, x: 11.6, w: 1.5, h: 1.3, d: '形状不变，交给下一个 Block；本阶段最后一个 Block 之后接池化（第 6 幕）' }
    ];
    const ms = parts.map(q => { const m = block(q.w, q.h, 2.0, q.c, [q.x, q.h / 2, 0]); m.userData.part = q; PICKS.push(m); G.add(m, lab(q.n, [q.x, q.h + 0.85, 0], { size: q.n.length > 4 ? 19 : 21 })); return m; });
    for (let i = 0; i + 1 < parts.length; i++) wire(G, [[parts[i].x + parts[i].w / 2, 0.4, 0], [parts[i + 1].x - parts[i + 1].w / 2, 0.4, 0]], COL.sim, { opacity: 0.7 });
    const arc = (x0, x1) => { const pts = []; for (let k = 0; k <= 24; k++) { const u = k / 24; pts.push([L.lerp(x0, x1, u), 0.15, 1.2 + Math.sin(u * Math.PI) * 1.8]); } wire(G, pts, COL.far, { opacity: 0.85 }); };
    arc(-12.8, -6.9); arc(-6.6, 0.9); arc(1.2, 8.5);
    G.add(lab('残差（跳过连接）', [-3.0, 0.2, 3.7], { size: 18 }));
    /* the blocks of this stage, with the order each uses in one example shuffle */
    const r = L.rng(17 + s), perm = [0, 1, 2, 3]; for (let i = 3; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    const first = De.slice(0, s).reduce((a, b) => a + b, 0), nb = De[s], w0 = 3.4;
    const slots = [];
    hud(300, nb > 3 ? 224 : 206, (h, fg, mu) => {
      h.font = BODY; h.fillStyle = fg; h.fillText(`第 ${s + 1} 阶段：C = ${C}，${H} 头 × 16 维`, 10, 18);
      h.fillStyle = mu; h.fillText(`玩具 N = ${n}，K = ${K}：${pi.np} 块${pi.np === 1 ? '（整个物体）' : ''}`, 10, 36);
      h.font = MONO; h.fillStyle = fg;
      [`qkv    [${n}, ${3 * C}]`, `分块   (${pi.np}, ${H}, ${K}, 16)`, `注意力 (${pi.np}, ${H}, ${K}, ${K})`, `放回   [${n}, ${C}]`].forEach((t, i) => h.fillText(t, 10, 58 + i * 17));
      h.font = BODY; h.fillStyle = mu; h.fillText(`一个 Block 参数 ${fmt(blockT(C))}`, 10, 138);
      h.fillStyle = fg; h.fillText(`本阶段 ${nb} 个 Block 依次用的序（一次打乱的例子）：`, 10, 162);
      const names = Array.from({ length: nb }, (_, i) => ORD[perm[i % 4]]); h.fillStyle = mu; h.fillText(names.slice(0, 3).join(' → ') + (nb > 3 ? ' →' : ''), 10, 180); if (nb > 3) h.fillText(names.slice(3).join(' → '), 10, 197);
      h.fillText(`drop_path ${DROP[first].toFixed(3)} … ${DROP[first + nb - 1].toFixed(3)}`, 10, nb > 3 ? 214 : 197);
    });
    let picked = null;
    const f = stream(G, 6, COL.enc);
    return { onPick(hit) { const q = hit.object.userData.part ?? hit.object.parent?.userData?.part; if (q) picked = q; },
      ctl: { groups: [{ label: '阶段', key: 'st5', items: ['1', '2', '3', '4', '5'] }] }, update(p) {
        const i = Math.min(ms.length - 1, Math.floor(p * ms.length)); ms.forEach((m, k) => glow(m, m.userData.part === picked ? 0.9 : (k === i && !picked ? 0.7 : 0)));
        const sl = Math.min(nb - 1, Math.floor(p * nb)); slots.forEach((b, k) => glow(b, k === sl ? 0.8 : 0));
        f([[-12.8, 0.5, 0], [11.6, 0.5, 0]], (p * 10) % 1, 1);
        cap(picked ? picked.d : parts[i].d);
      } };
  }

  /* ---------- scene 6: pooling and the five stages ---------- */
  function s6(G) {
    const sc = STATE.sz6 ? 2 : 1, A = mug(sc), PY = pyr(sc), Ns = PY.map(s => s.length), Ks = Ns.map(v => Math.min(v, 1024)), Np = Ns.map((v, i) => Math.ceil(v / Ks[i]));
    const bx = smallBox(), Kb = Ns.map((v, i) => Math.min(v, bx[i], 1024)), Npb = Ns.map((v, i) => Math.ceil(v / Kb[i]));
    const sw = SC / sc;
    floor(G, A.mn[1] * sw - 0.4, 32);
    const tr = p => [p[0] * sw, p[1] * sw, p[2] * sw];
    const im = inst(BOX, Ns[0], { opacity: 0.85 }); G.add(im);
    /* family to highlight: the stage-2 cell with most children */
    let fam = 0; const fv = c => (c.kids.length >= 6 ? 100 : 0) + c.x[0] * 0.52 + c.x[2] * 0.85 + c.x[1] * 0.3; PY[1].forEach((c, i) => { if (fv(c) > fv(PY[1][fam])) fam = i; });
    const famSet = new Set(PY[1][fam].kids);
    const order0 = PY.map(st => st.map((_, i) => i).sort((a, b) => st[a].c[0] - st[b].c[0]));
    const rk = order0.map(od => { const r = new Int32Array(od.length); od.forEach((id, k) => { r[id] = k; }); return r; });
    const cs = s => 0.01 * Math.pow(2, s) * sw;
    const lbl = dynLab(G, [0, A.mn[1] * sw - 1.4, 7.5], { size: 20 });
    const draw = cur => hud(352, 238, (h, fg, mu) => {
      h.font = BODY; h.fillStyle = mu; const cols = [10, 46, 134, 184, 226, 270, 306], hd = ['阶段', '格边长', '点数', '块数', '通道', '头', 'Block'];
      hd.forEach((t, k) => h.fillText(t, cols[k], 18));
      for (let s = 0; s < 5; s++) { const y = 40 + s * 20; h.fillStyle = s === cur ? fg : mu; h.font = s === cur ? '600 12.5px "Noto Sans SC",sans-serif' : BODY; [String(s + 1), `${(0.01 * 2 ** s / KAP * 1000).toFixed(1)} mm${s === 0 ? '*' : ''}`, String(Ns[s]), String(Np[s]), String(Ch[s]), String(He[s]), String(De[s])].forEach((t, k) => h.fillText(t, cols[k], y)); }
      h.font = BODY; h.fillStyle = mu; h.fillText('* 第 1 阶段是点数，同格的点还没合并', 10, 146);
      h.fillText(`同批再放一个 3 cm 小方块（${bx.join('/')} 点）：`, 10, 168);
      h.fillStyle = fg; h.fillText(`K = ${Kb.join(', ')} → 杯子分 ${Npb.join(', ')} 块`, 10, 186);
      if (cur === 0) { const c0 = PY[0][[...famSet][0]].c[0], b = c0.toString(2).padStart(3 * A.depth, '0'); h.fillStyle = '#c98a00'; h.font = MONO; h.fillText(`金色某点 z 码 ${b.slice(0, -3)}|${b.slice(-3)}`, 10, 208); h.fillText(`右移 3 位 = 父码 ${b.slice(0, -3)}`, 10, 226); h.font = BODY; }
      else { h.fillStyle = mu; h.fillText(`池化 ${cur} 次后 depth = ${A.depth} − ${cur} = ${A.depth - cur}`, 10, 208); }
    });
    let last = -1;
    return { ctl: { groups: [{ label: '物体', key: 'sz6', items: ['杯子（玩具）', '放大 2 倍'] }] }, update(p) {
      const u = clamp(p / 0.96, 0, 0.9999) * 5, s = Math.floor(u), w = u - s, mv = s < 4 ? seg(w, 0.6, 0.95) : 0;
      const st = PY[s], nxt = PY[s + 1];
      for (let i = 0; i < st.length; i++) {
        const e = st[i], par = nxt ? nxt[e.parent] : null, pos = par ? e.x.map((v, k) => L.lerp(v, par.x[k], mv)) : e.x, size = L.lerp(cs(s), par ? cs(s + 1) : cs(s), mv) * (s === 0 ? 0.55 : 0.82);
        const fs = s === 0 && famSet.has(i) && w > 0.15 ? 2.6 : 1; setI(im, i, tr(pos), size * fs);
        const pid = Np[s] > 1 ? Math.floor(rk[s][i] / Ks[s]) : 0;
        let c = patchCol(pid); if (s === 0 && w > 0.15) c = famSet.has(i) ? hex3(COL.far) : c.map(v => L.lerp(v, 0.62, 0.6)); else if (s === 1 && i === fam && w < 0.4) c = hex3(COL.far);
        colI(im, i, c);
      }
      done(im, st.length);
      if (s !== last) { last = s; draw(s); }
      lbl(`第 ${s + 1} 阶段：${Ns[s]} 个点 · ${Ch[s]} 通道 · ${Np[s]} 块`);
      cap(s === 0 && w > 0.15 ? `金色：同一个 2×2×2 父格里的 <b>${famSet.size}</b> 个点，码右移 3 位后相同，合成一个` : mv > 0 ? `合并：坐标取均值，特征 Linear(${Ch[s]}→${Ch[s + 1]}) 后取 max，格子边长翻倍` : `第 ${s + 1} 阶段：<b>${Ns[s]}</b> 个点，${Np[s] === 1 ? '整个物体一块（全局注意力）' : `${Np[s]} 块`}，${De[s]} 个 Block，${Ch[s]} 通道`);
    } };
  }

  /* ---------- scene 7: global mean ---------- */
  function s7(G) {
    const A = mug(1), P5 = PY0[4], n5 = P5.length, NB = 16, B = 6;
    floor(G, A.mn[1] * SC - 0.4, 40);
    const ox = -7, W7 = q => [q[0] * SC + ox, q[1] * SC, q[2] * SC];
    const mc = mugCloud(G, A, 0.8, 0.12, W7); A.P.forEach((q, i) => setPt(mc, i, W7(q), [0.36, 0.56, 0.92])); ptDone(mc);
    const r = L.rng(71), F = P5.map(() => Array.from({ length: NB }, () => r())), M = Array.from({ length: NB }, (_, k) => F.reduce((s, f) => s + f[k], 0) / n5);
    const cellH = 0.32, colOf = v => hsl(0.62 - 0.55 * v, 0.75, 0.56);
    const im = inst(BOX, n5 * NB + NB + B * NB); G.add(im);
    const mx = 4, my = -1;
    const inL = lab(`${n5} 个点 × 512 维`, [ox + 5.5, A.mn[1] * SC - 0.2, 5.5], { size: 20 }); G.add(inL, lab('按物体平均\n[1, 512]', [mx, 6.0, 0], { size: 20 }));
    const outL = lab('复制 B 份\n[B, 512]', [mx + 6.5, 6.0, -1], { size: 20 }); G.add(outL);
    const toG = lab('→ 噪声头（第 8 幕）', [mx + 7, -2.6, 2.5], { size: 19 }); G.add(toG);
    return { update(p) {
      const a = seg(p, 0.02, 0.25), b = seg(p, 0.3, 0.6), c = seg(p, 0.66, 0.92);
      let k = 0;
      P5.forEach((e, i) => {
        const base = W7(e.x);
        for (let j = 0; j < NB; j++) {
          const yy = base[1] + 0.5 + j * cellH * a, pos = [L.lerp(base[0], mx, b), L.lerp(yy, my + j * cellH, b), L.lerp(base[2], 0, b)];
          setI(im, k, pos, [0.3, cellH * 0.9 * Math.max(0.05, a), 0.3]); colI(im, k, colOf(F[i][j])); k++;
        }
      });
      for (let j = 0; j < NB; j++) { setI(im, k, [mx, my + j * cellH, 0], b > 0.98 ? [0.5, cellH * 0.92, 0.5] : [0.001, 0.001, 0.001]); colI(im, k, colOf(M[j])); k++; }
      for (let q = 0; q < B; q++) { const tz = -1 - q * 0.5, tx = mx + 5 + q * 0.75; for (let j = 0; j < NB; j++) { const pos = [L.lerp(mx, tx, c), my + j * cellH, L.lerp(0, tz, c)]; setI(im, k, pos, c > 0.01 ? [0.36, cellH * 0.9, 0.36] : [0.001, 0.001, 0.001]); colI(im, k, colOf(M[j])); k++; } }
      done(im, k);
      outL.visible = c > 0.3; toG.visible = c > 0.6; inL.visible = b < 0.5;
      cap(p < 0.3 ? `最后一阶段还剩 <b>${n5}</b> 个点，每个点一根 512 维特征（柱子画成 16 格）` : p < 0.64 ? '对同一个物体的所有点逐维求平均：<b>[1, 512]</b>，逐点的位置不再往下传' : '同一个向量复制 B 份，B 个候选和 10 步去噪都用它；PTv3 只算一次');
    } };
  }

  /* ---------- scene 8: the noise head ---------- */
  function sinEmb(t, dim = 512) { const half = dim / 2, e = Math.log(10000) / (half - 1), out = new Float32Array(dim); for (let i = 0; i < half; i++) { const v = t * Math.exp(-e * i); out[i] = Math.sin(v); out[half + i] = Math.cos(v); } return out; }
  function s8(G) {
    floor(G, 0, 48);
    const zS = -6.2, zT = -1.8, zO = 3.0;
    const parts = [
      { n: '带噪抓取 g̃ₜ\n[B, 6]', c: COL.noise, p: [-17, zS], s: [2.2, 0.9], d: '带噪抓取 [B, 6]：平移 3（乘过 κ）＋ 轴角 3（除过 π）。第一步是 N(0, I)。' },
      { n: '抓取 MLP\n6→512→512', c: COL.noise, p: [-11.4, zS], s: [2.6, 1.3], d: `抓取编码：Linear(6, 512) → ReLU → Linear(512, 512)，${fmt(HEADP.smp)} 参数（generator.py:695–700）` },
      { n: '时间步 t\n0 … 9', c: COL.time, p: [-17, zT], s: [2.2, 0.9], d: '时间步 t：整数，推理时 9, 8, …, 0。每个候选用同一个 t。' },
      { n: '时间编码\n512→2048→512', c: COL.time, p: [-11.4, zT], s: [2.6, 1.3], d: `时间编码：正弦 512 → Linear 2048 → Mish → Linear 512，${fmt(HEADP.time)} 参数（generator.py:688–693）` },
      { n: 'PTv3 物体向量\n[1, 512] → [B, 512]', c: COL.enc, p: [-12.4, zO], s: [3.4, 1.3], d: '物体嵌入：PTv3 的输出，按 mask_batch 复制给 B 个候选。整个去噪循环只算一次。generator.py:470–476' },
      { n: '拼接\n[1, B, 1536]', c: COL.sim, p: [-6.0, 0.4], s: [1.6, 2.4], d: '拼成 [B, 1536]，unsqueeze(0) → [1, B, 1536]：第 0 维是序列，长 1（generator.py:849–858）' },
      { n: '块 1', c: COL.gen, p: [-2.6, 4.6], s: [2.2, 2.2], d: `块 = 8 头注意力（每头 192）＋ 残差 LN ＋ FFN 1536→512→1536 ＋ 残差 LN。每块 ${fmt(HEADP.blk)} 参数（model_utils.py:198–222）` },
      { n: '块 2', c: COL.gen, p: [0.8, 4.6], s: [2.2, 2.2], d: '同块 1，权重不共享。序列长 1：softmax 只有一项，权重恒为 1' },
      { n: '块 3', c: COL.gen, p: [4.2, 4.6], s: [2.2, 2.2], d: '同块 1。三块合计 ' + fmt(3 * HEADP.blk) + ' 参数，是噪声头的主体。' },
      { n: '输出 MLP\n1536→768→384→6', c: COL.dis, p: [8.4, 4.6], s: [3.2, 1.6], d: `squeeze 回 [B, 1536] → 768 → ReLU → 384 → ReLU → 6，${fmt(HEADP.out)} 参数（generator.py:708–714）` },
      { n: 'ε̂ 平移 3 维\n→ 平移调度器', c: COL.far, p: [13.2, 2.4], s: [2.8, 1.0], d: '前 3 维交给 noise_scheduler_pos（scaled_linear）更新平移。generator.py:528–532' },
      { n: 'ε̂ 旋转 3 维\n→ 旋转调度器', c: COL.ang, p: [13.2, 7.0], s: [2.8, 1.0], d: '后 3 维交给 noise_scheduler_rot（squaredcos_cap_v2）更新轴角。generator.py:533–537' }
    ];
    const ms = parts.map(q => { const m = block(q.s[0], q.s[1], 1.8, q.c, [q.p[0], q.s[1] / 2, q.p[1]]); m.userData.part = q; PICKS.push(m); G.add(m, lab(q.n, [q.p[0], q.s[1] + 0.95, q.p[1]], { size: 19 })); return m; });
    const P = i => parts[i].p, E = (i, sgn) => [P(i)[0] + sgn * parts[i].s[0] / 2, 0.4, P(i)[1]];
    [[0, 1], [2, 3]].forEach(([a, b]) => wire(G, [E(a, 1), E(b, -1)], COL.sim, { opacity: 0.7 }));
    [1, 3, 4].forEach(a => wire(G, [E(a, 1), [P(5)[0] - 0.8, 0.4, P(5)[1] + (P(a)[1] - P(5)[1]) * 0.2]], COL.sim, { opacity: 0.7 }));
    for (let i = 5; i < 9; i++) wire(G, [E(i, 1), E(i + 1, -1)], COL.sim, { opacity: 0.7 });
    wire(G, [E(9, 1), E(10, -1)], COL.sim, { opacity: 0.7 }); wire(G, [E(9, 1), E(11, -1)], COL.sim, { opacity: 0.7 });
    G.add(lab('序列长 1 · 通道 1536', [0.8, 0.2, 7.6], { size: 19, border: 'rgba(79,201,138,.8)' }));
    const EM = Array.from({ length: 10 }, (_, t) => sinEmb(t));
    /* attention with one token: softmax of one score is 1, whatever the vectors are */
    const r = L.rng(81), sc3 = [0, 1, 2].map(() => { let s = 0; for (let i = 0; i < 192; i++) s += L.gauss(r) * L.gauss(r) * 0.3; return s / Math.sqrt(192); });
    const draw = t => hud(300, 196, (h, fg, mu) => {
      h.font = BODY; h.fillStyle = fg; h.fillText(`时间编码：t = 0…9 各一个 512 维向量（当前 t = ${t}）`, 10, 18);
      const X0 = 10, Y0 = 26, cw = 280 / 256, rh = 7;
      for (let tt = 0; tt < 10; tt++) for (let i = 0; i < 256; i++) { const v = EM[tt][i * 2]; h.fillStyle = rgbs(hsl(v > 0 ? 0.08 : 0.58, 0.7, 0.2 + 0.45 * Math.abs(v))); h.fillRect(X0 + i * cw, Y0 + tt * rh, cw + 0.3, rh - 0.6); }
      h.strokeStyle = fg; h.lineWidth = 1.4; h.strokeRect(X0 - 1, Y0 + t * rh - 1, 282, rh + 1); h.lineWidth = 1;
      h.fillStyle = mu; h.fillText('左半 sin，右半 cos；频率从左到右变低', 10, Y0 + 10 * rh + 16);
      h.fillStyle = fg; h.fillText('序列长 1 时每块的注意力：', 10, Y0 + 10 * rh + 40);
      h.font = MONO; sc3.forEach((s, k) => h.fillText(`块${k + 1}: softmax([${s.toFixed(2)}]) = [1.000]`, 10, Y0 + 10 * rh + 58 + k * 16));
    });
    let picked = null, lastT = -1;
    const f = stream(G, 7, COL.enc);
    return { onPick(hit) { const q = hit.object.userData.part ?? hit.object.parent?.userData?.part; if (q) picked = q; }, update(p) {
      const t = 9 - Math.min(9, Math.floor(p * 10)); if (t !== lastT) { lastT = t; draw(t); }
      const i = Math.min(ms.length - 1, Math.floor(((p * 10) % 1) * ms.length)); ms.forEach((m, k) => glow(m, m.userData.part === picked ? 0.9 : (k === i && !picked ? 0.7 : 0)));
      f([[-17, 0.6, zS], [-11.4, 0.6, zS], [-6, 0.6, 0.4], [-2.6, 0.6, 4.6], [8.4, 0.6, 4.6], [13.2, 0.6, 2.4]], (p * 10) % 1, 1);
      cap(picked ? picked.d : `第 ${10 - t} / 10 次调用（t = ${t}）：三路各变成 512 维，拼成 1536，过 3 块，出 6 个数。<b>点方块</b>看细节`);
    } };
  }

  /* ---------- grasps on the mug for scenes 9 and 10 (metres, mug base at y = 0) ---------- */
  const S9 = 12;
  function rotAA(v) { const th = Math.hypot(v[0], v[1], v[2]); if (th < 1e-9) return [1, 0, 0, 0, 1, 0, 0, 0, 1]; const k = v.map(x => x / th), c = Math.cos(th), s = Math.sin(th), C1 = 1 - c, [x, y, z] = k; return [c + x * x * C1, x * y * C1 - z * s, x * z * C1 + y * s, y * x * C1 + z * s, c + y * y * C1, y * z * C1 - x * s, z * x * C1 - y * s, z * y * C1 + x * s, c + z * z * C1]; }
  function logR(R) { const tr = R[0] + R[4] + R[8], th = Math.acos(clamp((tr - 1) / 2, -1, 1)); if (th < 1e-6) return [0, 0, 0]; if (Math.PI - th < 1e-4) { const x = Math.sqrt(Math.max(0, (R[0] + 1) / 2)), y = Math.sqrt(Math.max(0, (R[4] + 1) / 2)) * Math.sign(R[1] || 1), z = Math.sqrt(Math.max(0, (R[8] + 1) / 2)) * Math.sign(R[2] || 1); return [x * th, y * th, z * th]; } const k = th / (2 * Math.sin(th)); return [(R[7] - R[5]) * k, (R[2] - R[6]) * k, (R[3] - R[1]) * k]; }
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
  const frame = (x, z) => { const y = cross(z, x); return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]; };
  function graspSet() {
    if (STORE.gr) return STORE.gr;
    const out = [], D = 0.105;
    [0.9, 1.7, 2.6, 3.5, 4.4, 5.3].forEach(a => { const rad = [Math.cos(a), 0, Math.sin(a)]; out.push({ t: [0.04 * rad[0], 0.1 + D, 0.04 * rad[2]], R: frame(rad, [0, -1, 0]), kind: '杯口' }); });
    [1.9, 2.5, 3.1, 3.7, 4.3, 4.9].forEach(a => { const rad = [Math.cos(a), 0, Math.sin(a)], tg = [-Math.sin(a), 0, Math.cos(a)]; out.push({ t: [D * rad[0], 0.055, D * rad[2]], R: frame(tg, rad.map(v => -v)), kind: '侧面' }); });
    [0.035, 0.05, 0.065, 0.045].forEach((y, i) => { const z = i === 3 ? nrm([-1, -0.5, 0]) : [-1, 0, 0]; out.push({ t: [0.073 + 0.09, y + (i === 3 ? 0.04 : 0), 0], R: frame([0, 0, 1], z), kind: '把手' }); });
    const m = STORE.m.m;
    out.forEach(g => { g.x = [...g.t.map((v, j) => (v - m[j]) * KAP), ...logR(g.R).map(v => v / Math.PI)]; });
    return (STORE.gr = out);
  }
  /* gripper glyph in the grasp frame (metres): stem, palm bar, two fingers */
  const GLY = [[[0, 0, 0], [0, 0, 0.066]], [[-0.042, 0, 0.066], [0.042, 0, 0.066]], [[-0.042, 0, 0.066], [-0.042, 0, 0.112]], [[0.042, 0, 0.066], [0.042, 0, 0.112]]];
  const mv3 = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
  function putGripper(sg, i, x, col, at = [0, 0, 0], clip = 2.6, S9 = 12) {
    const R = rotAA([x[3] * Math.PI, x[4] * Math.PI, x[5] * Math.PI]), t = [clamp(x[0], -clip, clip), clamp(x[1], -clip, clip), clamp(x[2], -clip, clip)];
    GLY.forEach((sgm, k) => { const a = mv3(R, sgm[0]), b = mv3(R, sgm[1]); sg.set(i * 4 + k, [at[0] + S9 * (t[0] + KAP * a[0]), at[1] + S9 * (t[1] + KAP * a[1]), at[2] + S9 * (t[2] + KAP * a[2])], [at[0] + S9 * (t[0] + KAP * b[0]), at[1] + S9 * (t[1] + KAP * b[1]), at[2] + S9 * (t[2] + KAP * b[2])], col); });
  }
  /* DDPM reverse process with diffusers' step formula; eps-hat comes from the known target (a perfect stand-in for the network) */
  function denoise(seed) {
    const gr = graspSet(), r = L.rng(seed), B = gr.length, cur = gr.map(() => Array.from({ length: 6 }, () => L.gauss(r))), traj = [cur.map(c => c.slice())];
    const coef = { pos: [], rot: [] };
    for (let t = T10 - 1; t >= 0; t--) {
      for (const key of ['pos', 'rot']) { const s = SCH[key], a = s.ab[t], ap = t > 0 ? s.ab[t - 1] : 1, b = s.b[t]; coef[key][t] = { c0: Math.sqrt(ap) * b / (1 - a), ct: Math.sqrt(1 - b) * (1 - ap) / (1 - a), sg: t > 0 ? Math.sqrt(Math.max(1e-20, (1 - ap) / (1 - a) * b)) : 0, a }; }
      for (let i = 0; i < B; i++) for (let d = 0; d < 6; d++) {
        const key = d < 3 ? 'pos' : 'rot', s = SCH[key], a = s.ab[t], c = coef[key][t], x0t = gr[i].x[d], xt = cur[i][d];
        const eps = (xt - Math.sqrt(a) * x0t) / Math.sqrt(1 - a); let x0 = (xt - Math.sqrt(1 - a) * eps) / Math.sqrt(a); x0 = clamp(x0, -1, 1);
        cur[i][d] = c.c0 * x0 + c.ct * xt + (t > 0 ? c.sg * L.gauss(r) : 0);
      }
      traj.push(cur.map(c => c.slice()));
    }
    return { traj, coef };
  }
  function mugAt(G, at, op = 0.6, S9 = 12) { const A = mug(1); const c = clouds(A.P.length, 0.08); c.material.opacity = op; A.P.forEach((p, i) => setPt(c, i, [at[0] + p[0] * S9, at[1] + p[1] * S9, at[2] + p[2] * S9], [0.55, 0.7, 0.95])); ptDone(c, A.P.length); G.add(c); return c; }
  function s9(G) {
    floor(G, mug(1).mn[1] * S9 - 0.3, 40);
    mugAt(G, [0, 0, 0], 0.75);
    const gr = graspSet(), B = gr.length, D = STORE.dn || (STORE.dn = denoise(9)), sg = rods(G, B * 4, 0.09);
    const drawH = k => hud(330, 226, (h, fg, mu) => {
      const t = T10 - 1 - Math.min(9, k);
      h.font = BODY; h.fillStyle = fg; h.fillText(k >= 10 ? '10 次调用全部完成，t = 0 之后就是结果' : `第 ${k + 1} / 10 次调用噪声头，t = ${t}`, 10, 18);
      h.fillStyle = mu; h.fillText('ᾱₜ（t = 0 … 9）', 10, 40);
      const rows = [['平移', SCH.pos.ab, COL.far], ['旋转', SCH.rot.ab, COL.ang]];
      rows.forEach((rw, j) => { const y = 52 + j * 46; h.fillStyle = hexs(rw[2]); h.fillText(rw[0], 10, y + 14); for (let tt = 0; tt < 10; tt++) { const v = rw[1][tt], x = 46 + tt * 27, bh = 30 * v; h.fillStyle = tt === t && k < 10 ? fg : hexs(rw[2]); h.globalAlpha = tt === t && k < 10 ? 1 : 0.55; h.fillRect(x, y + 30 - bh, 20, Math.max(1, bh)); h.globalAlpha = 1; } });
      if (k < 10) { const cp = D.coef.pos[t], cr = D.coef.rot[t]; h.font = MONO; h.fillStyle = fg; h.fillText(`平移 ᾱ=${cp.a.toFixed(4)} c₀=${cp.c0.toFixed(3)} cₜ=${cp.ct.toFixed(3)} σ=${cp.sg.toFixed(3)}`, 10, 166); h.fillText(`旋转 ᾱ=${cr.a < 1e-3 ? cr.a.toExponential(1) : cr.a.toFixed(4)} c₀=${cr.c0.toFixed(3)} cₜ=${cr.ct.toFixed(3)} σ=${cr.sg.toFixed(3)}`, 10, 184); }
      h.font = BODY; h.fillStyle = mu; h.fillText('x_{t−1} = c₀·x̂₀ + cₜ·x_t + σ·z', 10, 208);
    });
    let lastK = -1;
    return { update(p) {
      const u = clamp((p - 0.04) / 0.82, 0, 1) * 10, k = Math.min(10, Math.floor(u)), f = k < 10 ? seg(u - k, 0.1, 0.9) : 0, A1 = D.traj[k], B1 = D.traj[Math.min(10, k + 1)];
      for (let i = 0; i < B; i++) { const x = A1[i].map((v, d) => L.lerp(v, B1[i][d], f)), prog = (k + f) / 10, col = hsl(0.9 + 0.5 * prog, 0.75, 0.52); putGripper(sg, i, x, col, [0, 0, 0], 1.15); }
      sg.done(B * 4);
      if (k !== lastK) { lastK = k; drawH(k); }
      cap(p < 0.04 ? `${B} 个候选从 N(0, I) 出发：平移 ±1（κ 尺度，约 ±30 cm），旋转随机` : k < 10 ? `第 <b>${k + 1}</b> / 10 步：平移每步只挪一点；旋转前几步几乎每步重抽（σ 接近 1）` : '结束：平移 ÷ κ、轴角 × π 还原成 4×4 位姿。这个替身噪声头是完美的，真网络会有误差');
    } };
  }

  /* ---------- scene 10: the discriminator ---------- */
  function candidates() {
    if (STORE.cand) return STORE.cand;
    const gr = graspSet(), r = L.rng(23), m = STORE.m.m, out = [];
    const toX = (t, R) => [...t.map((v, j) => (v - m[j]) * KAP), ...logR(R).map(v => v / Math.PI)];
    gr.forEach(g => out.push({ x: g.x, ok: 1, why: '成功' }));
    [2.2, 3.3, 4.6].forEach(a => { const rad = [Math.cos(a), 0, Math.sin(a)], tg = [-Math.sin(a), 0, Math.cos(a)]; out.push({ x: toX([0.07 * rad[0], 0.055, 0.07 * rad[2]], frame(tg, rad.map(v => -v))), ok: 0, why: '碰撞' }); });
    [2.8, 4.0, 5.0].forEach(a => { const rad = [Math.cos(a), 0, Math.sin(a)], tg = [-Math.sin(a), 0, Math.cos(a)]; out.push({ x: toX([0.2 * rad[0], 0.04, 0.2 * rad[2]], frame(tg, rad.map(v => -v))), ok: 0, why: '太远' }); });
    [1.2, 3.9].forEach(a => { const rad = [Math.cos(a), 0, Math.sin(a)], z = nrm([0.9 * rad[0], -1, 0.9 * rad[2]]); out.push({ x: toX([0.11 * rad[0], 0.19, 0.11 * rad[2]], frame(nrm(cross([0, 1, 0], z)), z)), ok: 0, why: '歪了' }); });
    /* made-up logits: good ones high, bad ones low, with overlap so the ranking is not perfect */
    out.forEach(c => { c.logit = c.ok ? 2.0 + 1.1 * L.gauss(r) : -1.4 + 1.2 * L.gauss(r); c.s = 1 / (1 + Math.exp(-c.logit)); c.bce = c.ok ? Math.log1p(Math.exp(-c.logit)) : Math.log1p(Math.exp(c.logit)); });
    return (STORE.cand = out);
  }
  function s10(G) {
    floor(G, 0, 50);
    const S10 = 8, at = [7.6, -mug(1).mn[1] * S10 + 0.1, 8.6];
    mugAt(G, at, 0.85, S10);
    const parts = [
      { n: '点云\n[1, N, 3]', c: COL.obj, p: [-16, -4.6], s: [2.0, 0.9], d: '同一团点：乘 κ，N = 2048（Franka 判别器训练和发布配置）。' },
      { n: 'PTv3（冻结）\n→ [B, 512]', c: COL.frz, p: [-11.2, -4.6], s: [3.0, 1.6], d: '同结构的 PTv3，cls_mode=True → [1, 512]，复制成 [B, 512]。配置了 checkpoint_object_encoder_pretrained 时加载生成器的编码器权重并冻结（requires_grad = False）。discriminator.py:93–98、156–168' },
      { n: '候选抓取\n[B, 6]', c: COL.noise, p: [-16, 0.6], s: [2.0, 0.9], d: '生成器给出的 B 个候选，同样是平移 3（乘 κ）＋ 轴角 3（除 π）。' },
      { n: '抓取 MLP\n6→512→512', c: COL.noise, p: [-11.2, 0.6], s: [3.0, 1.3], d: `sample_encoder：Linear(6, 512) → ReLU → Linear(512, 512)。参数 ${fmt(DISP.smp)}。discriminator.py:107–112` },
      { n: '拼接\n[B, 1024]', c: COL.sim, p: [-7.6, -2.0], s: [1.5, 2.4], d: '[抓取, 物体] 沿特征维拼接 → [B, 1024]。discriminator.py:277' },
      { n: '1024→512\nReLU', c: COL.dis, p: [-4.0, -2.0], s: [1.5, 2.0], d: 'prediction_head 第 1 层：Linear(1024, 512) → ReLU。discriminator.py:148–154' },
      { n: '512→256\nReLU', c: COL.dis, p: [-0.4, -2.0], s: [1.4, 1.6], d: 'Linear(512, 256) → ReLU。' },
      { n: '256→1\nlogit', c: COL.dis, p: [3.2, -2.0], s: [1.3, 1.1], d: `Linear(256, 1)，输出 logit。抓取编码＋这个头合计 ${fmt(DISP.smp + DISP.head)} 参数。` },
      { n: 'sigmoid\n分数', c: COL.ok, p: [3.2, 3.2], s: [1.4, 0.9], d: 'sigmoid(logit) → 成功概率 [#obj, B, 1]。训练时用 BCE with logits，取损失最大的 75%。discriminator.py:285、291–297' }
    ];
    const ms = parts.map(q => { const m = block(q.s[0], q.s[1], 1.8, q.c, [q.p[0], q.s[1] / 2, q.p[1]]); m.userData.part = q; PICKS.push(m); G.add(m, lab(q.n, [q.p[0], q.s[1] + 0.95, q.p[1]], { size: 19 })); return m; });
    G.add(lab('❄', [-9.2, 2.2, -4.6], { size: 28, bg: false, color: '#5fb8ef' }));
    const E = (i, sgn) => [parts[i].p[0] + sgn * parts[i].s[0] / 2, 0.4, parts[i].p[1]];
    wire(G, [E(0, 1), E(1, -1)], COL.sim, { opacity: 0.7 }); wire(G, [E(2, 1), E(3, -1)], COL.sim, { opacity: 0.7 });
    wire(G, [E(1, 1), [-8.4, 0.4, -2.6]], COL.sim, { opacity: 0.7 }); wire(G, [E(3, 1), [-8.4, 0.4, -1.4]], COL.sim, { opacity: 0.7 });
    for (let i = 4; i < 7; i++) wire(G, [E(i, 1), E(i + 1, -1)], COL.sim, { opacity: 0.7 });
    wire(G, [[3.2, 0.4, -1.1], [3.2, 0.4, 2.3]], COL.sim, { opacity: 0.7 }); wire(G, [[3.8, 0.4, 3.8], [5.6, 0.4, 7.0]], COL.sim, { opacity: 0.7, dashed: true });
    const C = candidates(), nC = C.length, sg = rods(G, nC * 4, 0.08);
    const sorted = C.map((c, i) => i).sort((a, b) => C[b].s - C[a].s);
    const mode = STATE.f10, thr = [0.5, 0.8][mode] ?? null, keepN = mode === 2 ? 12 : null;
    const kept = new Set(keepN ? sorted.slice(0, keepN) : sorted.filter(i => C[i].s >= thr));
    const scoreCol = v => hsl(0.0 + 0.33 * v, 0.75, 0.55);
    const bceS = C.map(c => c.bce).sort((a, b) => b - a), kTop = Math.floor(nC * 0.75), mAll = bceS.reduce((a, b) => a + b, 0) / nC, mTop = bceS.slice(0, kTop).reduce((a, b) => a + b, 0) / kTop;
    const keptOk = [...kept].filter(i => C[i].ok).length;
    hud(318, 252, (h, fg, mu) => {
      h.font = BODY; h.fillStyle = fg; h.fillText(`${nC} 个候选按分数排序（${keepN ? `取前 ${keepN}` : `阈值 ${thr}`}）`, 10, 18);
      const X0 = 10, Y0 = 26, bw = 298 / nC;
      sorted.forEach((i, k) => { const c = C[i], bh = 70 * c.s; h.fillStyle = rgbs(scoreCol(c.s)); h.globalAlpha = kept.has(i) ? 1 : 0.3; h.fillRect(X0 + k * bw, Y0 + 70 - bh, bw - 2, bh); h.globalAlpha = 1; h.fillStyle = c.ok ? '#4fc98a' : '#ff5d5d'; h.fillRect(X0 + k * bw, Y0 + 74, bw - 2, 4); });
      if (thr != null) { const y = Y0 + 70 - 70 * thr; h.strokeStyle = fg; h.setLineDash([4, 3]); h.beginPath(); h.moveTo(X0, y); h.lineTo(X0 + 298, y); h.stroke(); h.setLineDash([]); }
      h.fillStyle = mu; h.fillText('下方色条：仿真标签（绿 成功，红 失败）', 10, Y0 + 96);
      h.fillStyle = fg; h.fillText(`留下 ${kept.size} 个，其中成功 ${keptOk} 个`, 10, Y0 + 116);
      h.fillStyle = mu; h.fillText('训练损失：每个候选一个 BCE，从大到小', 10, Y0 + 142);
      const Y1 = Y0 + 150, mx = bceS[0];
      bceS.forEach((v, k) => { h.fillStyle = k < kTop ? '#f0963c' : 'rgba(142,155,184,.5)'; const bh = 34 * v / mx; h.fillRect(X0 + k * bw, Y1 + 34 - bh, bw - 2, Math.max(1, bh)); });
      h.fillStyle = fg; h.fillText(`前 ${kTop} 个（75%）求平均 ${mTop.toFixed(3)}；全部平均 ${mAll.toFixed(3)}`, 10, Y1 + 52);
    });
    let picked = null;
    const f1 = stream(G, 5, COL.enc), f2 = stream(G, 5, COL.noise);
    return { onPick(hit) { const q = hit.object.userData.part ?? hit.object.parent?.userData?.part; if (q) picked = q; },
      ctl: { groups: [{ label: '过滤', key: 'f10', items: ['阈值 0.5', '阈值 0.8', '前 12 个'] }] }, update(p) {
        const a = seg(p, 0.35, 0.6), b = seg(p, 0.68, 0.86), q = (p * 12) % 1;
        C.forEach((c, i) => { const base = [0.62, 0.66, 0.76], sc = scoreCol(c.s), col = [L.lerp(base[0], sc[0], a), L.lerp(base[1], sc[1], a), L.lerp(base[2], sc[2], a)], fade = kept.has(i) ? 1 : 1 - 0.75 * b; putGripper(sg, i, c.x, col.map(v => v * fade), at, 2.6, S10); });
        sg.done(nC * 4);
        const i = Math.min(ms.length - 1, Math.floor(seg(p, 0, 0.34) * ms.length)); ms.forEach((m, k) => glow(m, m.userData.part === picked ? 0.9 : (k === i && p < 0.34 && !picked ? 0.7 : 0)));
        f1([[-16, 0.6, -4.6], [-11.2, 0.6, -4.6], [-7.6, 0.6, -2], [3.2, 0.6, -2], [3.2, 0.6, 3.2]], q, p < 0.34 ? 1 : 0); f2([[-16, 0.6, 0.6], [-11.2, 0.6, 0.6], [-7.6, 0.6, -2], [3.2, 0.6, -2], [3.2, 0.6, 3.2]], q, p < 0.34 ? 1 : 0);
        cap(picked ? picked.d : p < 0.34 ? '物体 512 和抓取 512 拼成 1024，过三层 MLP，得到一个 logit' : p < 0.66 ? `给 ${nC} 个候选打分：颜色从红（低）到绿（高）` : `${keepN ? `取分数最高的 ${keepN} 个` : `阈值 ${thr}`}：留下 <b>${kept.size}</b> 个，其中真成功 ${keptOk} 个。剩下的交给运动规划器`);
      } };
  }

  /* ---------- scene 11: training and deployment ---------- */
  function s11(G) {
    floor(G, 0, 50);
    const v = STATE.v11, lanes = [
      { z: -5.4, name: '训练 G', boxes: [['成功抓取 g\n＋ 噪声 ε、t', COL.noise], ['加噪 g̃ₜ', COL.noise], ['PTv3（G）', COL.enc], ['噪声头', COL.gen], ['ε̂', COL.gen], ['损失\n‖ε − ε̂‖', COL.grad]], grad: [5, 2], gcol: COL.grad },
      { z: 0.6, name: '训练 D', boxes: [['G 采样', COL.gen], ['仿真贴标签', COL.sim], ['PTv3（D）❄', COL.frz], ['抓取 MLP\n＋ 输出头', COL.dis], ['分数', COL.dis], ['BCE\n（top 75%）', COL.grad]], grad: [5, 3], gcol: COL.grad },
      { z: 6.6, name: '部署', boxes: [['点云', COL.obj], ['PTv3（G）', COL.enc], ['噪声头\n× 10 步', COL.gen], ['判别器\nPTv3 + MLP', COL.dis], ['排序\n过滤', COL.dis], ['规划器', COL.plan]], grad: null }
    ];
    const X = k => -10.6 + k * 4.6;
    const allB = [];
    lanes.forEach((ln, li) => {
      const on = v === 3 || v === li, op = on ? 1 : 0.25;
      G.add(lab(ln.name, [-15.2, 0.6, ln.z], { size: 21, border: on ? 'rgba(56,209,255,.85)' : undefined }));
      ln.boxes.forEach((b, k) => { const m = block(2.8, 1.0, 1.8, b[1], [X(k), 0.5, ln.z], { opacity: on ? 0.95 : 0.3 }); G.add(m); allB.push({ m, li, k }); if (on) G.add(lab(b[0], [X(k), 2.0, ln.z], { size: 19 })); if (k < 5) wire(G, [[X(k) + 1.4, 0.5, ln.z], [X(k + 1) - 1.4, 0.5, ln.z]], COL.sim, { opacity: 0.6 * op }); });
    });
    /* data flow from G to D's training data (sampling, simulation) and the weight copy to the frozen encoder */
    if (v === 3 || v === 1) { wire(G, [[X(3), 0.3, -4.5], [X(0), 0.3, -0.3]], COL.sim, { opacity: 0.6, dashed: true }); wire(G, [[X(2), 0.2, -4.5], [X(2), 0.2, -0.3]], COL.frz, { opacity: 0.9, dashed: true }); G.add(lab('权重复制', [X(2) + 1.6, 0.4, -2.4], { size: 17 }), lab('采样', [X(1) - 0.6, 0.4, -2.4], { size: 17 })); }
    const fw = lanes.map(() => stream(G, 6, COL.enc)), bw = lanes.map(() => stream(G, 6, COL.grad, 0.18));
    return { ctl: { groups: [{ label: '看', key: 'v11', items: ['训练 G', '训练 D', '部署', '全部'] }] }, update(p) {
      const q = (p * 10) % 1;
      lanes.forEach((ln, li) => { const on = v === 3 || v === li; fw[li]([[X(0), 0.8, ln.z], [X(5), 0.8, ln.z]], q, on && p < 0.55 ? 1 : 0); if (ln.grad) bw[li]([[X(ln.grad[0]), 1.1, ln.z], [X(ln.grad[1]), 1.1, ln.z]], q, on && p >= 0.55 ? 1 : 0); else bw[li]([[0, 0, 0], [1, 0, 0]], 0, 0); });
      allB.forEach(({ m, li, k }) => { const ln = lanes[li], on = v === 3 || v === li, g = ln.grad && p >= 0.55 && k >= ln.grad[1] && k <= ln.grad[0]; glow(m, on && g ? 0.7 : 0); });
      cap(p < 0.55 ? '<b>前向：</b>蓝色是数据。G 和 D 由“采样、仿真”这条数据流连起来，它不可微' : '<b>反向：</b>训练 G 时梯度回到噪声头和 G 的 PTv3；训练 D 时只回到 D 的 MLP，停在冻结的编码器前；<b>从不回到 G</b>');
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player ---------- */
  let cur = 0, api = null, playing = !L.reduced(), t0 = 0, pNow = 0, tw = null;
  const HOLD = 1.8;
  const aspectFix = () => { const el = $('stage'), asp = (el.clientWidth || 1) / (el.clientHeight || 1); return Math.min(2.2, Math.max(1, 1.45 / asp)); };
  /* in the embedded (narrow) player the HUD covers a larger share of the stage: pan the view so the scene sits left of it */
  const HUDSC = { 2: 0.08, 3: 0.13, 4: 0.13, 6: 0.08, 8: 0.04, 9: 0.12, 10: 0.03 };
  function panFor(th, d) { const fr = HUDSC[SCENES[cur].n]; if (!document.body.classList.contains('embed') || !fr) return [0, 0, 0]; const el = $('stage'), asp = (el.clientWidth || 1) / (el.clientHeight || 1), w = 2 * d * Math.tan(19 * Math.PI / 180) * asp * fr; return [Math.cos(th) * w, 0, -Math.sin(th) * w]; }
  function fly(th, ph, d, tg) { let dth = th - S.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth)); d *= aspectFix(); const sh = panFor(th, d); tw = { t0: performance.now(), from: [S.theta, S.phi, S.dist, S.target.clone()], to: [S.theta + dth, ph, d, new THREE.Vector3(tg[0] + sh[0], tg[1] + sh[1], tg[2] + sh[2])] }; refDist = d; }
  function setPlay(on) { playing = on; $('play').textContent = on ? '❚❚ 暂停' : '▶ 播放'; $('play').setAttribute('aria-label', on ? '暂停' : '播放'); }
  function renderCtl() {
    const box = $('ctl');
    if (!api.ctl) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = api.ctl.groups.map(g => `<div class="grp"><span>${g.label}</span>` + g.items.map((t, k) => `<button type="button" data-g="${g.key}" data-k="${k}" aria-pressed="${STATE[g.key] === k}">${t}</button>`).join('') + '</div>').join('');
  }
  function build(p0, keepCam) {
    L.clear(root); LABS = []; PICKS = []; lastCap = null; hudEl.hidden = true;
    const sc = SCENES[cur]; if (!keepCam) { fly(...sc.cam); refDist = sc.cam[2] * aspectFix(); }
    const G = new THREE.Group(); root.add(G); api = BUILD[cur](G); renderCtl();
    pNow = p0; t0 = performance.now() - p0 * sc.dur * 1000; api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
  }
  function go(i, p0 = 0) { cur = (i + SCENES.length) % SCENES.length; showInfo(cur); if (!S) return; build(p0); }
  if (S) {
    S.onTick(() => {
      if (playing && api) { const sc = SCENES[cur], el = (performance.now() - t0) / 1000; if (el > sc.dur + HOLD) { t0 = performance.now(); pNow = 0; } else pNow = Math.min(1, el / sc.dur); api.update(pNow); $('scrub').value = Math.round(pNow * 1000); }
      if (tw) { const k = L.reduced() ? 1 : Math.min(1, (performance.now() - tw.t0) / 900), e = L.ease(k), [a, b] = [tw.from, tw.to]; S.setView(L.lerp(a[0], b[0], e), L.lerp(a[1], b[1], e), L.lerp(a[2], b[2], e), [L.lerp(a[3].x, b[3].x, e), L.lerp(a[3].y, b[3].y, e), L.lerp(a[3].z, b[3].z, e)]); if (k >= 1) tw = null; }
      const f = clamp(S.dist / refDist, 0.6, 1.6); for (const sp of LABS) sp.scale.copy(sp.userData.s0).multiplyScalar(f);
    });
    S.onClick(() => PICKS, hit => { if (!hit) return; const o = hit.object, g = o?.userData?.go ?? o?.parent?.userData?.go; if (g != null) go(g); else if (api?.onPick) { api.onPick(hit); api.update(pNow); } });
    S.onHover(() => PICKS, hit => { $('stage').style.cursor = hit ? 'pointer' : ''; });
  }
  $('ctl').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const key = b.dataset.g, k = +b.dataset.k; if (STATE[key] === k) return; STATE[key] = k; const box = $('ctl'); box.querySelectorAll(`[data-g="${key}"]`).forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.k === k))); $('cap').textContent = '计算中…'; setTimeout(() => build(pNow, true), 30); });
  $('play').onclick = () => { if (!playing) t0 = performance.now() - pNow * SCENES[cur].dur * 1000; setPlay(!playing); };
  $('scrub').oninput = e => { setPlay(false); pNow = e.target.value / 1000; if (api) api.update(pNow); };
  $('prev').onclick = () => go(cur - 1); $('next').onclick = () => go(cur + 1);
  btns.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); });
  stepsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; go(+b.dataset.i); if (!document.body.classList.contains('embed')) $('stage').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' && e.key !== ' ') return; if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1); else if (e.key === ' ') { e.preventDefault(); $('play').click(); } });
  const s0 = clamp((parseInt(qs.get('scene'), 10) || 1) - 1, 0, SCENES.length - 1), pq = qs.get('p');
  setPlay(playing && pq == null);
  go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0));
})();
