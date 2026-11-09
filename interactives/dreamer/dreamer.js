'use strict';
/* Dreamer (arXiv 1912.01603) taken apart into ten scenes. Sizes come from the paper's Appendix A and from the official
   code (github.com/danijar/dreamer 56d4d444, github.com/google-research/dreamer d517542f). Numbers on the result bars are
   the paper's Appendix G table and values read from the vector data of its Figure 4. Everything marked toy is computed
   on this page by the functions below, it is not Dreamer's network. update(p) is a pure function of the timeline p. */
const Toy = (function () {
  /* A complete, tiny agent. State x on a line, true dynamics x' = x + 0.25 a, reward with a small bump at the start and
     a large one at x = 3.5. Dynamics model: x' = A x + B a + C. Reward, value: linear in K radial features. Action:
     a = tanh(th . phi(x) + sig eps). The world is 1-D and the state is observed: no images, no latent, no RSSM. */
  const K = 17, X0 = -4, X1 = 6, c = Array.from({ length: K }, (_, i) => X0 + (X1 - X0) * i / (K - 1)), w = (X1 - X0) / (K - 1) * 0.9;
  const phi = x => c.map(ci => Math.exp(-(x - ci) * (x - ci) / (2 * w * w)));
  const dphi = x => c.map(ci => Math.exp(-(x - ci) * (x - ci) / (2 * w * w)) * (-(x - ci) / (w * w)));
  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const rTrue = x => 0.15 * Math.exp(-x * x / (2 * 0.6 * 0.6)) + 1.0 * Math.exp(-(x - 3.5) * (x - 3.5) / (2 * 0.45 * 0.45));
  const stepTrue = (x, a) => Math.max(X0, Math.min(X1, x + 0.25 * a));
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const gauss = r => { const u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  function adam(n, lr) { const m = new Float64Array(n), v = new Float64Array(n); let t = 0; return (p, g) => { t++; for (let i = 0; i < n; i++) { m[i] = 0.9 * m[i] + 0.1 * g[i]; v[i] = 0.999 * v[i] + 0.001 * g[i] * g[i]; p[i] += lr * (m[i] / (1 - 0.9 ** t)) / (Math.sqrt(v[i] / (1 - 0.999 ** t)) + 1e-8); } }; }
  /* forward pass; o.frozen, if given, feeds these states to the actor instead of s (used only for the finite-difference check) */
  function rollout(s0, eps, P, o) {
    const H = o.H, g = o.gamma, l = o.useValue ? o.lambda : 1, s = [s0], a = [], u = [];
    for (let t = 0; t < H; t++) { const m = dot(P.th, phi(o.frozen ? o.frozen[t] : s[t])) + P.sig * eps[t]; u.push(m); a.push(Math.tanh(m)); s.push(P.A * s[t] + P.B * a[t] + P.C); }
    const r = s.map(x => dot(P.rho, phi(x))), v = s.map(x => (o.useValue ? dot(P.w, phi(x)) : 0)), R = new Array(H + 1);
    R[H] = v[H]; for (let t = H - 1; t >= 0; t--) R[t] = r[t] + g * ((1 - l) * v[t + 1] + l * R[t + 1]);
    return { s, a, u, r, v, R };
  }
  /* reverse pass for J = sum_tau V_lambda(s_tau). stopGrad cuts the actor's input, as both official code bases do. */
  function adjoint(ro, P, o) {
    const H = o.H, g = o.gamma, l = o.useValue ? o.lambda : 1, A = new Array(H + 1); A[0] = 1; for (let n = 1; n <= H; n++) A[n] = 1 + g * l * A[n - 1];
    const gth = new Array(K).fill(0), da = new Array(H).fill(0), G = new Array(H + 1).fill(0); let gs = 0;
    for (let n = H; n >= 0; n--) {
      const dp = dphi(ro.s[n]); let cv = n > 0 ? g * (1 - l) * A[n - 1] : 0; if (n === H) cv += A[H];
      const e = (o.useValue ? cv * dot(P.w, dp) : 0) + (n < H ? A[n] * dot(P.rho, dp) : 0);
      if (n === H) { gs = e; G[n] = gs; continue; }
      const sech2 = 1 - ro.a[n] * ro.a[n], f = phi(ro.s[n]); da[n] = gs * P.B;
      for (let i = 0; i < K; i++) gth[i] += da[n] * sech2 * f[i];
      gs = e + gs * (P.A + P.B * (o.stopGrad ? 0 : sech2 * dot(P.th, dp))); G[n] = gs;
    }
    return { G, gth, da };
  }
  function run(o) {
    const r = rng(o.seed || 7), P = { th: new Float64Array(K), w: new Float64Array(K), rho: new Float64Array(K), A: 0.8, B: 0.05, C: 0, sig: 0.5 }, D = [], hist = [];
    const act = noise => { let x = 0, ret = 0, sticky = 0; const xs = [0]; for (let t = 0; t < o.T; t++) { let a; if (noise === 'seed') { if (t % 8 === 0) sticky = 2 * r() - 1; a = sticky; } else { a = Math.tanh(dot(P.th, phi(x)) + (noise ? 0.5 * gauss(r) : 0)); if (noise) a = Math.max(-1, Math.min(1, a + 0.3 * gauss(r))); } const x2 = stepTrue(x, a), rw = rTrue(x); if (noise !== false) D.push([x, a, rw, x2]); ret += rw; x = x2; xs.push(x); } return { ret, xs }; };
    for (let i = 0; i < o.seedEps; i++) act('seed');
    const optA = adam(K, 0.02), optV = adam(K, 0.05), optR = adam(K, 0.05);
    const snap = (i, e) => hist.push({ i, ret: e.ret, xs: e.xs, A: P.A, B: P.B, C: P.C, th: [...P.th], w: [...P.w], rho: [...P.rho], sig: P.sig, n: D.length });
    snap(0, act(false));
    for (let it = 1; it <= o.iters; it++) {
      for (let k = 0; k < o.fit; k++) { /* dynamics learning */
        let gA = 0, gB = 0, gC = 0; const gR = new Float64Array(K), n = Math.min(64, D.length);
        for (let j = 0; j < n; j++) { const d = D[Math.floor(r() * D.length)], f = phi(d[0]), e = P.A * d[0] + P.B * d[1] + P.C - d[3]; gA += e * d[0]; gB += e * d[1]; gC += e; const er = d[2] - dot(P.rho, f); for (let q = 0; q < K; q++) gR[q] += er * f[q] / n; }
        P.A -= 0.02 * gA / n; P.B -= 0.2 * gB / n; P.C -= 0.05 * gC / n; optR(P.rho, gR);
      }
      for (let k = 0; k < o.beh; k++) { /* behavior learning */
        const gT = new Float64Array(K), gV = new Float64Array(K);
        for (let b = 0; b < o.batch; b++) {
          const s0 = D[Math.floor(r() * D.length)][0], eps = Array.from({ length: o.H }, () => gauss(r)), ro = rollout(s0, eps, P, o), ad = adjoint(ro, P, o);
          for (let q = 0; q < K; q++) gT[q] += ad.gth[q] / o.batch / (o.H + 1);
          if (o.useValue) for (let t = 0; t <= o.H; t++) { const f = phi(ro.s[t]), e = ro.R[t] - ro.v[t]; for (let q = 0; q < K; q++) gV[q] += e * f[q] / o.batch / (o.H + 1); }
        }
        optA(P.th, gT); if (o.useValue) optV(P.w, gV);
      }
      act(true); /* environment interaction: adds one noisy episode to D */
      snap(it, act(false));
    }
    return hist;
  }
  const defaults = { gamma: 0.97, T: 40, iters: 30, fit: 30, beh: 15, batch: 16, seedEps: 10, stopGrad: true };
  return { K, phi, dphi, dot, rTrue, rollout, adjoint, run, rng, gauss, defaults };
})();
/* equations (4)-(6) on plain arrays r[0..H], v[0..H] */
const Ret = {
  rec(r, v, g, l, H) { const R = new Array(H + 1); R[H] = v[H]; for (let t = H - 1; t >= 0; t--) R[t] = r[t] + g * ((1 - l) * v[t + 1] + l * R[t + 1]); return R; },
  vn(r, v, g, H, tau, k) { const h = Math.min(tau + k, H); let s = 0; for (let n = tau; n < h; n++) s += g ** (n - tau) * r[n]; return s + g ** (h - tau) * v[h]; },
  eq6(r, v, g, l, H, tau) { let s = 0; for (let n = 1; n <= H - 1; n++) s += (1 - l) * l ** (n - 1) * Ret.vn(r, v, g, H, tau, n); return s + l ** (H - 1) * Ret.vn(r, v, g, H, tau, H); },
  w(l, H, k) { return k < H ? (1 - l) * l ** (k - 1) : l ** (H - 1); }
};
if (typeof module !== 'undefined' && typeof window === 'undefined') { module.exports = { Toy, Ret }; } else (function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { env: 0x8e9bb8, data: 0x3aa8e0, det: 0x7cb8ff, sto: 0xf0963c, enc: 0x4fc98a, wm: 0x4fc98a, pi: 0x38d1ff, val: 0x9d8cff, rew: 0xf2c14e, grad: 0xff7a59, img: 0xd45fa0, sm: 0x38d1ff };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyBox = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const LIVE = '<div id="live" class="live" aria-live="off"></div>';
  /* shared control state, also settable from the URL so a frame can be frozen for a screenshot */
  const qn = (k, d) => (qs.get(k) != null && !isNaN(+qs.get(k)) ? +qs.get(k) : d);
  const ST = { lam: qn('lam', 0.95), H: qn('H', 15), gam: qn('gam', 0.99), val: qn('val', 1), sg: qn('sg', 1), seed: qn('seed', 1), path: qn('path', 0), inf: qn('inf', 0), coder: qn('coder', 0), H5: qn('H5', 15), view: qn('view', 0), obj: qn('obj', 0), fn: qn('fn', 1), who: qn('who', 2) };

  const SCENES = [
    { n: 1, part: '总览', title: '三个部件，轮流转', sub: '学世界模型 → 在想象里学行为 → 到环境里收集', dur: 16, cam: [0.25, 0.92, 38, [0, 1.2, 0.5]],
      html: dl([['种子数据', 'S = 5 条随机动作的回合'], ['每轮', '100 次更新，再收集 1 条回合'], ['回合', '1000 环境步；动作重复 R = 2，即 500 次决策'], ['批量', '50 条序列 × 每条 50 步']]) +
        '<p>Dreamer 由三段组成。论文说它们可以交错，也可以并行，算法 1 写的是交错：先做 C 次更新，每次更新同时学世界模型和学行为，再跑一条回合把数据加进去。</p>' +
        '<p>所有学习都从数据集出发。环境本身不参与求导，梯度只穿过学到的网络。</p>' +
        '<p>点画面里三个站可以跳到对应的一幕。</p>' + LIVE + src('§2 · 图 3 · 算法 1 · 附录 A') },
    { n: 2, part: '世界模型', title: '图像怎样进出模型', sub: '卷积编码器和反卷积解码器，每层形状可切换查看', dur: 13, cam: [0.8, 1.15, 29, [-0.5, 2.6, 0]],
      html: dl([['输入', '64 × 64 × 3，缩放到 [−0.5, 0.5]'], ['编码器', '4 层卷积，核 4，步长 2，ReLU'], ['解码器', '全连接 1024，再 4 层反卷积，核 5, 5, 6, 6'], ['输出', '每个像素一个方差为 1 的高斯的均值']]) +
        '<p>编码器把一帧图压成 1024 维向量。这个向量还不是状态，要和循环网络的输出拼起来才算出状态（第 3 幕）。</p>' +
        '<p>解码器只在训练时提供学习信号。想象时完全不用它，这是想象能快的原因：Dreamer 不需要生成图像就能往前预测。</p>' +
        '<p>形状是我按代码里的核与步长算出来的。论文只说结构来自 Ha 和 Schmidhuber (2018)。</p>' +
        guess('画面里的小人是页面自己画的，不是 DeepMind Control 的渲染。') + src('附录 A · 代码 models.py：ConvEncoder、ConvDecoder') },
    { n: 3, part: '世界模型', title: 'RSSM：确定和随机两条路', sub: '切换路径看记忆和多种未来；切换后验和先验', dur: 15, cam: [0.1, 1.2, 31, [1.0, 3.6, 0]],
      html: dl([['确定路径 h', 'GRU，200 维：hₜ = f(hₜ₋₁, sₜ₋₁, aₜ₋₁)'], ['随机路径 s', '30 维对角高斯'], ['先验', 'q(sₜ | hₜ)：不看图，想象时用'], ['后验', 'p(sₜ | hₜ, eₜ)：看图，训练和执行时用'], ['特征', 's 和 h 拼接，230 维'], ['标准差', 'softplus + 0.1']]) +
        '<p>论文公式 (1) 把这两部分合写成一个 s。拆开写才看得出它们各管什么。</p><ul>' +
        '<li><b>只有 h：</b>从同一个历史只能走出一条未来，模型表达不了“接下来可能这样也可能那样”。</li>' +
        '<li><b>只有 s：</b>每一步都要穿过噪声，信息很难记过多步。</li>' +
        '<li><b>两条都有：</b>h 负责记，s 负责表达不确定。</li></ul>' +
        '<p>这个划分和上面的论断都出自 PlaNet，Dreamer 直接沿用，正文没有展开。200 这个数只在代码里。</p>' +
        guess('状态云是我用一个线性高斯过程撒的点，用来表现记忆和分叉，不是网络输出。真实的 s 有 30 维，这里画 2 维。') + src('PlaNet 图 2、式 (4) · 附录 A · 代码 models.py：RSSM') },
    { n: 4, part: '世界模型', title: '损失：重建、奖励、KL', sub: '三项当场算；切换表征目标；开关 free nats', dur: 15, cam: [0.1, 1.12, 29, [0, 2.2, 0.5]],
      html: dl([['J_O', 'ln q(oₜ | sₜ)：图像重建'], ['J_R', 'ln q(rₜ | sₜ)：奖励预测'], ['J_D', '−β KL(后验 ‖ 先验)'], ['β', '连续任务 1，离散任务 0.1'], ['free nats', '3：KL 低于 3 不再压']]) + LIVE +
        '<p>KL 这一项是转移模型唯一的训练信号：先验（不看图）要去猜后验（看了图）。这里的先验是从上一步的后验走一步得到的，所以 Dreamer 的模型只在一步上被直接约束，虽然后面要连着想象 15 步。</p>' +
        '<p>画面左上可以切换第 4 节比较的三种表征目标：重建最好；对比目标大约解决一半任务；只预测奖励不够。</p>' +
        toyBox('两张 64 × 64 小图和两个高斯是页面造的，但 KL 用 30 维对角高斯的闭式公式当场算，重建项用真实的像素差按方差 1 的高斯算，代码里的算法相同。') + src('§4 式 (9)(10)(12) · 附录 A · 图 8 · 代码 dreamer.py _train') },
    { n: 5, part: '行为学习', title: '在隐空间里想象', sub: '从 2500 个状态同时出发；切换 H', dur: 13, cam: [0.55, 1.08, 31, [-1.2, 2.2, 0]],
      html: dl([['起点', '批里每个后验状态，50 × 50 = 2500 个'], ['每步', 'a = 动作模型(特征)，再走一步先验'], ['默认', 'H = 15，离散任务 H = 10'], ['世界模型', '这一步不更新']]) + LIVE +
        '<p>地上每个点是一个真实序列里的后验状态，每根线是从它长出的一条想象轨迹。这里真的画了 2500 根。</p>' +
        '<p>想象时只用先验和动作模型，不解码图像，也不看观测。这正是论文说的“占内存少，可以同时想象几千条”。</p>' +
        '<p>γ = 0.99 时，奖励恒定下 γ¹⁵ = 0.86，就是说 86% 的折扣回报落在 15 步以外。Dreamer 必须有价值模型，下一幕讲。</p>' +
        guess('线的抖动是我撒的随机数，只表示每步都在采样；线的高度代表步数，不代表任何状态量。') + src('§3 · 算法 1 · 代码 dreamer.py _imagine_ahead') },
    { n: 6, part: '行为学习', title: 'V_λ：当场算', sub: '拖 λ、H、γ，看递推和式 (6) 的数字', dur: 16, cam: [0, 0.78, 38, [-1.5, 2.0, -1.0]],
      html: LIVE + '<p>金色是每步奖励，紫色是价值模型的预测，青色是当场倒着算出来的 V<sub>λ</sub>：</p><div class="eq-mini">V(τ) = r(τ) + γ[(1−λ) v(τ+1) + λ V(τ+1)]</div>' +
        '<p>论文写的是另一种等价形式，式 (6)：把向前看 1、2、…、H 步的估计按权重平均。上方读数同时给两种算法的结果，它们应该相等。</p><ul>' +
        '<li><b>λ = 0：</b>只看一步，几乎全信价值模型。偏差大。</li>' +
        '<li><b>λ = 1：</b>全信想象的奖励，只在 H 处用一次价值。</li>' +
        '<li><b>λ = 0.95，H = 15：</b>最长那项 k = 15 占 48.8%，平均往前看 10.7 步。</li></ul>' +
        toyBox('r 和 v 是我写的两列数，不来自任何网络。算法是真的：式 (4) 到 (6) 和代码 tools.lambda_return。') + src('§3 式 (4)(5)(6)') },
    { n: 7, part: '行为学习', title: '价值穿过动力学反传', sub: '解析梯度当场算，并用有限差分核对', dur: 15, cam: [0, 0.8, 35, [-1.8, 1.5, -0.2]],
      html: LIVE + '<p>前向：动作 → 状态 → 奖励和价值。反向：∂J/∂a 从 τ = H 一路传回 τ = 0。这就是“价值穿过动力学”的意思：世界模型不更新，只作为求导的通道。</p>' +
        '<p>动作用重参数化：a = tanh(μ + σε)，ε 是外部噪声，所以采样这一步可以求导。Reinforce 类方法（A3C、PPO）只用价值当基线；DDPG、SAC 反传价值，但不穿过转移。</p>' +
        '<p><b>代码和论文的差别：</b>论文说梯度依次经过价值、状态、动作。两份官方代码都在动作模型的输入上加了 stop_gradient，所以 ∂a/∂s 这条路是断的。画面左上的开关可以换，读数同步变化。</p>' +
        toyBox('一维线性动力学、径向基的奖励和价值，参数取自第 8 幕同一个玩具智能体训练 12 轮的结果。反向传播是手写的伴随计算，有限差分独立算一遍，两边应该相等。') + src('§3 式 (3)(7) · 代码 dreamer.py _imagine_ahead · training/utility.py imagine_forward') },
    { n: 8, part: '行为学习', title: '一个能跑的玩具 Dreamer', sub: '三段真的轮流运行；改 H、λ、有无价值', dur: 24, cam: [0, 0.78, 40, [-2.2, 1.5, 1.0]],
      html: LIVE + '<p>这幕在你的浏览器里跑一个完整循环 30 轮：每轮拟合模型 30 步，想象和更新 15 步，再收集一条回合。画面按轮回放。</p>' +
        '<p>奖励设计成“起点有一点甜头，远处有大奖，中间什么都没有”。只看窗口内奖励的智能体离不开起点；有价值模型的能学会穿过去。</p>' +
        '<h3>20 个种子的统计</h3><p class="src">到达大奖（回报 &gt; 15）的种子数，用这个文件的同一份代码在 Node 里跑的。</p>' +
        '<div id="sweep"></div>' +
        toyBox('这是我造的一维问题，状态直接可见，没有图像、隐变量和 RSSM。它只演示“窗口外的奖励靠价值模型传回来”，比例不能外推到论文的任务，也不是图 4 的复现。成功率也不高：很多种子在 30 轮内没学会。') + src('算法 1 · 图 4 的问题设定') },
    { n: 9, part: '结果', title: '图 4 和附录 G 的真实数字', sub: '切换任务，柱子来自矢量图读数和附录表', dur: 12, cam: [0.12, 1.3, 38, [-2.5, 5.0, 0]],
      html: LIVE + '<p>前四个视图是图 4：不同想象长度下的最终回报，蓝是 Dreamer，绿是无价值模型，橙是 PlaNet。短 H 时三者差距最大，这是论文的主要论点。</p>' +
        '<p>两处要留意：Walker Walk 的 H = 40，Dreamer（528.5）低于无价值模型（743.0）；Cheetah Run 的 H = 15 读出 793.7，附录 G 是 894.56。见精读页读者注。</p>' +
        '<p>最后一个视图是附录 G 的 20 个任务。D4PG 和 A3C 没有两个四足任务，所以那两处没有柱子。</p>' + src('图 4（从 PDF 矢量数据读出）· 附录 G') },
    { n: 10, part: '对照', title: '隐空间模型和 SuperMimic 的显式模型', sub: '切换看两条流水线，差别一条条对', dur: 18, cam: [0.06, 1.2, 40, [-1.6, 4.2, 0]],
      html: LIVE + '<p>共同点是都在模型里想象，并且都把回报穿过冻结的模型反传。其余差别都来自一件事：Dreamer 不知道状态，要从图像里学一个；SuperMimic 有仿真器给的状态。</p>' +
        '<p>SuperMimic 的相关工作只用一句话提到 Dreamer：学习隐空间动力学，做基于想象的演员-评论家。它的评论家目标来自 GAE，短窗口加评论家的目标归功于 SHAC。它没有说从 Dreamer 继承了什么，下面的对比是我逐项对两篇原文做的。</p>' +
        src('本文 §3、§4、附录 A · <a href="../../papers/supermimic.html#s3" target="_top">SuperMimic §3</a>、表 A.4、A.5') }
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
    lastLive = null;
    const sw = $('sweep'); if (sw) sw.innerHTML = SWEEP_HTML;
  }
  let lastCap = null, lastLive = null;
  const cap = h => { if (h !== lastCap) { lastCap = h; $('cap').innerHTML = h; } };
  const live = h => { if (h !== lastLive) { lastLive = h; const e = $('live'); if (e) e.innerHTML = h; } };
  /* numbers below come from running this file's Toy.run under Node, see papers/dreamer.html */
  const SWEEP_HTML = '<div class="tablewrap"><table class="mini"><thead><tr><th></th><th>H=1</th><th>3</th><th>5</th><th>10</th><th>15</th><th>30</th></tr></thead><tbody><tr><td>有价值 λ=0.95</td><td class="n">3</td><td class="n">7</td><td class="n">7</td><td class="n">9</td><td class="n">9</td><td class="n">5</td></tr><tr><td>有价值 λ=0.5</td><td class="n">3</td><td class="n">5</td><td class="n">6</td><td class="n">4</td><td class="n">3</td><td class="n">3</td></tr><tr><td>有价值 λ=0</td><td class="n">3</td><td class="n">4</td><td class="n">3</td><td class="n">2</td><td class="n">3</td><td class="n">3</td></tr><tr><td>有价值 λ=1</td><td class="n">3</td><td class="n">8</td><td class="n">7</td><td class="n">7</td><td class="n">7</td><td class="n">3</td></tr><tr><td>无价值</td><td class="n">0</td><td class="n">0</td><td class="n">0</td><td class="n">0</td><td class="n">0</td><td class="n">1</td></tr><tr><td>有价值 λ=0.95，不切断</td><td class="n">3</td><td class="n">11</td><td class="n">12</td><td class="n">12</td><td class="n">10</td><td class="n">9</td></tr></tbody></table></div>';

  /* ---------- 3D helpers ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.3, phi: 1.0, dist: 30, maxDist: 160, minDist: 3 }); } catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);
  let LABS = [], refDist = 30, PICKS = [];
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 26, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.14) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const arc = (a, b, h, n = 14) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n; o.push([L.lerp(a[0], b[0], t), L.lerp(a[1], b[1], t) + h * Math.sin(Math.PI * t), L.lerp(a[2], b[2], t)]); } return o; };
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.55, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  /* a little walker raster, 64 x 64 x 3 in [-0.5, 0.5], the same range the code feeds the encoder */
  function walker(ph) {
    const N = 64, a = new Float32Array(N * N * 3);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const k = (y * N + x) * 3, fl = y < 12; a[k] = fl ? -0.25 : -0.42; a[k + 1] = fl ? -0.15 : -0.35; a[k + 2] = fl ? -0.1 : -0.2; }
    const seg2 = (x0, y0, x1, y1, r, c) => { const n = 30; for (let i = 0; i <= n; i++) { const t = i / n, cx = L.lerp(x0, x1, t), cy = L.lerp(y0, y1, t); for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { if (x < 0 || y < 0 || x >= N || y >= N || (x - cx) ** 2 + (y - cy) ** 2 > r * r) continue; const k = (y * N + x) * 3; a[k] = c[0]; a[k + 1] = c[1]; a[k + 2] = c[2]; } } };
    const hx = 32, hy = 30 + 1.5 * Math.sin(2 * ph), s = Math.sin(ph) * 10, c = [0.45, 0.35, 0.15];
    seg2(hx, hy, hx + s, 12, 2, c); seg2(hx, hy, hx - s, 12, 2, c); seg2(hx, hy, hx + 1, hy + 18, 3, [0.3, 0.42, 0.48]); seg2(hx + 1, hy + 18, hx + 1, hy + 20, 4, [0.48, 0.42, 0.3]);
    return a;
  }
  /* imgTex: DataTexture for a raster; upload(arr) copies arr into it */
  function imgTile(size, pos) {
    const d = new Uint8Array(64 * 64 * 4), t = new THREE.DataTexture(d, 64, 64, THREE.RGBAFormat); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })); m.position.set(...pos);
    m.userData.upload = a => { for (let i = 0; i < 4096; i++) { d[i * 4] = clamp((a[i * 3] + 0.5) * 255, 0, 255); d[i * 4 + 1] = clamp((a[i * 3 + 1] + 0.5) * 255, 0, 255); d[i * 4 + 2] = clamp((a[i * 3 + 2] + 0.5) * 255, 0, 255); d[i * 4 + 3] = 255; } t.needsUpdate = true; };
    return m;
  }
  const fmt = (x, d = 2) => (Math.abs(x) >= 1000 ? x.toFixed(0) : x.toFixed(d));

  /* ---------- scene 1 ---------- */
  function s1(G) {
    G.add(L.grid(36, 36));
    const D = block(3.6, 2.2, 3.6, COL.data, [0, 1.1, 0]), A = block(4.4, 2.4, 3, COL.wm, [-9, 1.2, -3.5]), B = block(4.4, 2.4, 3, COL.pi, [9, 1.2, -3.5]), C = block(4.4, 2.4, 3, COL.env, [0, 1.2, 8]);
    G.add(D, A, B, C, lab('数据集 D', [0, 3.0, 0], { size: 24 }), lab('学世界模型 θ\n(a) 动力学学习', [-9, 3.5, -3.5], { size: 24 }), lab('想象里学行为 φ, ψ\n(b) 行为学习', [9, 3.5, -3.5], { size: 24 }), lab('环境 + 动作模型\n(c) 环境交互', [0, 3.5, 8], { size: 24 }));
    A.userData.go = 3; B.userData.go = 4; C.userData.go = 7; D.userData.go = 1; PICKS.push(A, B, C, D);
    const dA = arc([0, 2, -1], [-7, 2, -3.5], 2), Ab = arc([-6.8, 2.2, -3.5], [6.8, 2.2, -3.5], 3.6), bC = arc([8, 2, -1.5], [2, 2, 7], 1.2), Cd = arc([0, 2.2, 6.3], [0, 2.2, 2], 1.4);
    wire(G, dA, COL.data); wire(G, Ab, COL.wm); wire(G, bC, COL.pi); wire(G, Cd, COL.env);
    G.add(lab('序列批 50 × 50', [-4.6, 0.4, 1.4], { size: 21 }), lab('冻结的模型 + 后验状态', [0, 6.6, -3.5], { size: 21 }), lab('动作模型', [6.6, 3.6, 3], { size: 21 }), lab('新回合', [2.6, 4.2, 5], { size: 21 }));
    const f1 = stream(G, 5, COL.data), f2 = stream(G, 5, COL.wm), f3 = stream(G, 4, COL.pi), f4 = stream(G, 4, COL.env);
    return { update(p) {
      /* two rounds of: 100 updates (0..0.7) then one episode (0.7..1) */
      const q = (p * 2) % 1, up = p >= 1 ? 100 : Math.min(100, Math.round(q / 0.7 * 100)), ep = clamp((q - 0.7) / 0.3, 0, 1), train = q < 0.7 && p < 1, round = Math.min(2, Math.floor(p * 2) + 1), ph = (p * 18) % 1;
      f1(dA, ph, train ? 1 : 0); f2(Ab, ph, train ? 1 : 0); f3(bC, ph, train ? 0 : 1); f4(Cd, ph, train ? 0 : 1);
      glow(A, train ? 0.7 : 0); glow(B, train ? 0.7 : 0); glow(C, train ? 0 : 0.7); glow(D, 0.15);
      cap(train ? `第 ${round} 轮 · 更新 <b>${up}</b> / 100：每次更新都同时做 (a) 和 (b)` : `第 ${round} 轮 · 收集回合：第 <b>${Math.round(ep * 500)}</b> / 500 次决策（1000 环境步）`);
      live(`<p class="mono">每次更新想象 2500 × 15 = <b>37,500</b> 个状态<br>每轮 100 次 = 375 万个状态，换 500 次真实决策，比值 7500（我的计算）</p>`);
    } };
  }

  /* ---------- scene 2 ---------- */
  const ENC = [['图像', 64, 3], ['卷积 1', 31, 32], ['卷积 2', 14, 64], ['卷积 3', 6, 128], ['卷积 4', 2, 256]], DEC = [['全连接', 1, 1024], ['反卷积 1', 5, 128], ['反卷积 2', 13, 64], ['反卷积 3', 30, 32], ['图像均值', 64, 3]];
  function s2(G) {
    const dec = ST.coder === 1, L0 = dec ? DEC : ENC, X = i => -9 + i * 4.5, sz = n => Math.max(0.5, 5.6 * Math.pow(n / 64, 0.55)), th = c => 0.14 + 0.16 * Math.log2(Math.max(2, c)) / 2;
    const tile = imgTile(sz(64) * 0.92, [(dec ? X(4) : X(0)) + th(3) / 2 + 0.03, 3.2, 0]); tile.rotation.y = Math.PI / 2; G.add(tile);
    const blocks = L0.map((l, i) => { const s = sz(l[1]), t = th(l[2]), m = block(t, s, s, i === (dec ? 4 : 0) ? COL.img : dec ? COL.sto : COL.enc, [X(i), 3.2, 0]); G.add(m); G.add(lab(`${l[0]}\n${l[1]}×${l[1]}×${l[2]}`, [X(i), -0.6, 0], { size: 22 })); return m; });
    if (!dec) { const v = block(0.5, 5, 0.5, COL.det, [X(5) - 2, 3.2, 0]); blocks.push(v); G.add(v, lab('向量 eₜ\n1024', [X(5) - 2, -0.6, 0], { size: 22 })); } else { G.add(lab('特征 230 → 1024', [X(0), 6.6, 0], { size: 22 })); }
    for (let i = 0; i < blocks.length - 1; i++) wire(G, [blocks[i].position.toArray(), blocks[i + 1].position.toArray()], COL.env, { opacity: 0.4 });
    const f = stream(G, 3, dec ? COL.sto : COL.enc, 0.16), pts = blocks.map(b => b.position.toArray());
    return { ctl: [{ key: 'coder', label: '看', items: [[0, '编码器'], [1, '解码器']] }], update(p) {
      const k = clamp(p * 1.1, 0, 1) * (blocks.length - 1), i = Math.min(blocks.length - 1, Math.round(k));
      blocks.forEach((b, j) => glow(b, j === i ? 0.9 : j < i ? 0.25 : 0)); f(pts, (p * 6) % 1, p < 0.92 ? 1 : 0);
      tile.userData.upload(walker(p * 12));
      const l = L0[Math.min(L0.length - 1, i)];
      cap(i < L0.length ? `${l[0]}：<b>${l[1]} × ${l[1]} × ${l[2]}</b>${dec ? (i === 4 ? '，均值，方差固定为 1' : '') : (i === 0 ? '，每步一帧' : '')}` : '展平：2 × 2 × 256 = <b>1024</b> 维，和 hₜ 一起算后验');
    } };
  }

  /* ---------- scene 3: both paths, clouds drawn from a small linear Gaussian process ---------- */
  function s3(G) {
    const T = 5, X = t => -9 + t * 5, det = ST.path !== 2, sto = ST.path !== 1, post = ST.inf === 0, yH = 6.6, yS = 3, yO = -0.3, n = 70, r = L.rng(11);
    const hs = [], ss = [];
    const clouds = inst(BALL, n * T); clouds.material.color.setHex(0xffffff); G.add(clouds);
    /* sample paths: two latent 'future modes' split after t = 1 when the stochastic path is on */
    const noiseZ = Array.from({ length: n }, () => Array.from({ length: T }, () => L.gauss(r))), noiseX = Array.from({ length: n }, () => Array.from({ length: T }, () => L.gauss(r))), mode = Array.from({ length: n }, () => (r() < 0.5 ? -1 : 1));
    for (let t = 0; t < T; t++) {
      if (det) { const h = block(1.4, 1.4, 1.4, COL.det, [X(t), yH, 0]); hs.push(h); G.add(h); } else hs.push(null);
      const anchor = block(0.1, 0.1, 0.1, COL.sto, [X(t), yS, 0]); ss.push(anchor); G.add(anchor);
      G.add(lab(`t = ${t + 1}`, [X(t), -1.7, 1.6], { size: 22 }));
      if (t > 0) {
        if (det) { wire(G, [[X(t - 1) + 0.7, yH, 0], [X(t) - 0.7, yH, 0]], COL.det, { opacity: 0.95 }); if (sto) wire(G, [[X(t - 1) + 0.3, yS + 0.5, 0], [X(t) - 0.7, yH - 0.4, 0]], COL.sto, { opacity: 0.6 }); }
        else wire(G, [[X(t - 1) + 0.7, yS, 0], [X(t) - 0.9, yS, 0]], COL.sto, { opacity: 0.8 });
        G.add(lab('a', [X(t) - 2.5, det ? yH + 1.5 : yS + 1.6, 0], { size: 20, color: '#38d1ff' }));
        wire(G, [[X(t) - 2.5, det ? yH + 1.2 : yS + 1.3, 0], [X(t) - (det ? 0.7 : 1), det ? yH + 0.3 : yS + 0.2, 0]], COL.pi, { opacity: 0.8 });
      }
      if (det) wire(G, [[X(t), yH - 0.7, 0], [X(t), yS + 0.9, 0]], COL.det, { opacity: 0.65 });
      const o = imgTile(1.5, [X(t), yO, 0.4]); o.userData.upload(walker(t * 0.9)); o.material.opacity = post ? 1 : 0.18; o.material.transparent = true; G.add(o);
      if (post) wire(G, [[X(t), yO + 0.8, 0.3], [X(t), yS - 0.9, 0]], COL.enc, { opacity: 0.85 });
    }
    if (det) G.add(lab('h：确定路径 GRU 200 维', [X(3), yH + 3.0, 0], { size: 24 }));
    G.add(lab(sto ? 's：随机路径\n30 维高斯' : '（去掉噪声的 s）', [X(4) + 2.9, yS + 0.3, 0], { size: 21 }));
    G.add(lab(post ? '图像 oₜ 进入后验' : '先验：不看图', [X(0) - 3.2, yO + 1.1, 0.4], { size: 21 }));
    const cue = block(0.1, 0.1, 0.1, COL.rew, [0, 0, 0]); G.add(cue);
    const keep = t => (det ? 1 : Math.pow(0.55, t));  /* how much of the t = 1 cue survives */
    const stdOf = t => (sto ? (post ? 0.22 : 0.22 + 0.13 * t) : 0.02);
    return { ctl: [{ key: 'path', label: '路径', items: [[0, '两条都开'], [1, '只有 h'], [2, '只有 s']] }, { key: 'inf', label: '模式', items: [[0, '后验'], [1, '先验']] }], update(p) {
      const reveal = clamp(p * 1.15, 0, 1) * T, active = Math.min(T - 1, Math.floor(reveal));
      hs.forEach((h, t) => { if (h) glow(h, t === active ? 0.9 : t < active ? 0.2 : 0); });
      let c = 0;
      for (let i = 0; i < n; i++) for (let t = 0; t < T; t++) {
        const std = stdOf(t), split = sto && !post && t > 0 ? mode[i] * Math.min(1.5, 0.45 * t) : 0, drift = keep(t) * (det ? 0.4 : 0.8);
        const pos = [X(t) + noiseX[i][t] * std * 1.2, yS + drift + split + noiseZ[i][t] * std, noiseZ[i][(t + 2) % T] * std * 1.6];
        const on = t <= active ? 1 : 0;
        setI(clouds, c, on ? pos : [0, -60, 0], 0.075); const col = t === 0 ? hex3(COL.rew) : hex3(COL.sto); colI(clouds, c, col); c++;
      }
      done(clouds);
      const memo = keep(active), txt = !det ? `只有 s：t = 1 的信息每步打折，到第 ${active + 1} 步还剩 ${(memo * 100).toFixed(0)}%（示意系数 0.55）` : !sto ? '只有 h：同一个历史只给出一条确定的未来' : post ? '后验：hₜ 给出预测，图像把它校正，云收得很紧' : '先验：不看图时云变宽，并能分叉成多种未来';
      cap(txt);
    } };
  }

  /* ---------- scene 4: toy loss, computed ---------- */
  function s4(G) {
    const yS = 3, O = imgTile(4, [-9, yS, 0]), R = imgTile(4, [8.4, yS, 0]), rows = ST.obj;
    G.add(O, R, lab('oₜ', [-9, yS - 2.7, 0], { size: 26 }), lab(rows === 0 ? 'ôₜ：解码器' : rows === 1 ? '解码器被状态模型 q(s|o) 替代' : '不解码', [8.4, yS + 2.7, 0], { size: 23 }));
    const E = block(2.1, 1.3, 1.5, COL.enc, [-4.8, yS, 0]), St = block(2, 2, 2, COL.det, [0, yS, 0]), Dc = block(2.1, 1.3, 1.5, COL.sto, [4.4, yS, 0]), Rw = block(1.5, 1, 1.2, COL.rew, [4.4, yS - 2.3, 0]);
    G.add(E, St, Dc, Rw, lab('编码器', [-4.8, yS + 1.3, 0], { size: 22 }), lab('s, h', [0, yS + 1.6, 0], { size: 22 }), lab(rows === 0 ? '解码器' : rows === 1 ? '对比' : '关闭', [4.4, yS + 1.3, 0], { size: 22 }), lab('奖励头', [6.6, yS - 2.3, 0], { size: 22 }));
    wire(G, [[-7, yS, 0], [-5.9, yS, 0]], COL.enc); wire(G, [[-3.7, yS, 0], [-1, yS, 0]], COL.enc); wire(G, [[1, yS, 0], [3.3, yS, 0]], COL.sto, { opacity: rows === 2 ? 0.1 : 0.6 }); wire(G, [[5.5, yS, 0], [6.4, yS, 0]], COL.sto, { opacity: rows === 2 ? 0.1 : 0.6 }); wire(G, [[1, yS - 0.6, 0], [3.6, yS - 2.3, 0]], COL.rew);
    /* the two Gaussians, one dimension of the 30 */
    const curve = (col, n = 60) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((n + 1) * 3), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: col })); l.frustumCulled = false; G.add(l); return l; };
    const cP = curve(COL.grad), cQ = curve(COL.det), yC = yS + 3.4;
    const plot = (l, mu, s) => { const A = l.geometry.attributes.position.array, n = A.length / 3 - 1; for (let i = 0; i <= n; i++) { const x = -4 + 8 * i / n, gv = Math.exp(-((x / 1.3 - mu) ** 2) / (2 * s * s)) / s * 0.9; A[i * 3] = x; A[i * 3 + 1] = yC + gv; A[i * 3 + 2] = 0; } l.geometry.attributes.position.needsUpdate = true; };
    G.add(lab('后验', [-4.8, yC + 1.2, 0], { size: 21, border: 'rgba(255,122,89,.9)' }), lab('先验', [4.8, yC + 1.2, 0], { size: 21, border: 'rgba(124,184,255,.9)' }));
    const bars = [0, 1, 2].map(i => block(1.3, 1, 1.3, [COL.img, COL.rew, COL.grad][i], [-3 + i * 3, 0.5, 6.5])), lbs = [];
    bars.forEach(b => G.add(b));
    const base = walker(1.1);
    return { ctl: [{ key: 'obj', label: '目标', items: [[0, '重建'], [1, '对比'], [2, '只有奖励']] }, { key: 'fn', label: 'free nats', items: [[1, '开 3'], [0, '关']] }], update(p) {
      const t = L.ease(clamp(p / 0.9, 0, 1)), k = 1 - t * 0.97, a = base, b = new Float32Array(a.length); let sse = 0;
      for (let i = 0; i < a.length; i++) { const blur = (i % 3 === 0 ? 0.05 : i % 3 === 1 ? -0.05 : 0); b[i] = a[i] * (1 - k) + blur * k; sse += (a[i] - b[i]) ** 2; }
      O.userData.upload(a); if (rows === 0) R.userData.upload(b); else { const g = new Float32Array(a.length).fill(-0.4); R.userData.upload(g); }
      const dMu = L.lerp(1.6, 0.25, t), qs0 = L.lerp(1.2, 0.75, t), ps0 = 0.5;
      /* 30-D diagonal Gaussians, first 8 dims carry the difference, closed-form KL(post || prior) */
      let kl = 0; for (let d = 0; d < 30; d++) { const m = d < 8 ? dMu : 0.02, ps = d < 8 ? ps0 : 0.95, qs = d < 8 ? qs0 : 1; kl += Math.log(qs / ps) + (ps * ps + m * m) / (2 * qs * qs) - 0.5; }
      plot(cP, dMu * 0.5, ps0 * 0.8); plot(cQ, -dMu * 0.5, qs0 * 0.8);
      const rec = 0.5 * sse, klUsed = ST.fn ? Math.max(kl, 3) : kl, rewE = 0.5 * (0.6 * (1 - t) + 0.02) ** 2;
      const hR = v => 0.2 + Math.log10(1 + v) * 0.85;
      bars[0].visible = rows === 0; bars[0].scale.y = hR(rec); bars[0].position.y = bars[0].scale.y / 2; bars[1].scale.y = hR(rewE * 1000) * 0.5; bars[1].position.y = bars[1].scale.y / 2; bars[2].scale.y = hR(klUsed); bars[2].position.y = bars[2].scale.y / 2;
      [E, St, Dc, Rw].forEach(m => glow(m, 0.12 + 0.2 * (1 - t)));
      const clip = ST.fn && kl < 3;
      cap(clip ? `KL = ${kl.toFixed(2)} 已低于 3 nats，这一项不再有梯度` : `KL = <b>${kl.toFixed(2)}</b> nats · 重建 ½Σ(o−ô)² = <b>${rows === 0 ? rec.toFixed(1) : '—'}</b>`);
      live(`<table class="mini"><tbody><tr><td>重建 ½Σ(o−ô)²，共 12288 维</td><td class="n">${rows === 0 ? rec.toFixed(1) : '—'}</td></tr><tr><td>奖励 ½(r−r̂)²</td><td class="n">${rewE.toFixed(4)}</td></tr><tr><td>KL（30 维闭式）</td><td class="n">${kl.toFixed(3)}</td></tr><tr><td>代入损失的 KL</td><td class="n">${klUsed.toFixed(3)}</td></tr></tbody></table>`);
      if (!lbs.length) { ['重建', '奖励（×1000）', 'KL'].forEach((s, i) => { const l = lab(s, [-3 + i * 3, -0.7, 8], { size: 21 }); lbs.push(l); G.add(l); }); G.add(lab('柱高是对数刻度', [6.4, 0.2, 6.5], { size: 19 })); }
      lbs[0].visible = rows === 0;
    } };
  }

  /* ---------- scene 5: 2500 real hairs ---------- */
  function s5(G) {
    const H = ST.H5, N = 50, sp = 0.3, r = L.rng(5), maxS = H, pos = new Float32Array(N * N * maxS * 6), col = new Float32Array(N * N * maxS * 6), dy = 6.5 / Math.max(H, 15);
    const dots = inst(BALL, N * N); G.add(dots); let k = 0;
    const cA = hex3(COL.pi), cB = hex3(COL.val);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      let x = (i - N / 2 + 0.5) * sp, z = (j - N / 2 + 0.5) * sp, y = 0.08; setI(dots, i * N + j, [x, y, z], 0.045); colI(dots, i * N + j, hex3(j === 25 ? COL.rew : COL.data));
      for (let t = 0; t < H; t++) {
        const f = t / H, x2 = x + 0.07 * L.gauss(r), z2 = z + 0.07 * L.gauss(r), y2 = y + dy, off = k * 6;
        pos.set([x, y, z, x2, y2, z2], off); const c1 = [L.lerp(cA[0], cB[0], f), L.lerp(cA[1], cB[1], f), L.lerp(cA[2], cB[2], f)]; col.set([...c1, ...c1], off); x = x2; y = y2; z = z2; k++;
      }
    }
    done(dots);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    /* hair segments are stored per start, so a grown fraction needs its own index order: step 0 of all, then step 1 of all */
    const idx = new Uint32Array(N * N * H * 2); let q = 0; for (let t = 0; t < H; t++) for (let s = 0; s < N * N; s++) { const seg = s * H + t; idx[q++] = seg * 2; idx[q++] = seg * 2 + 1; }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false })); lines.frustumCulled = false; G.add(lines);
    G.add(lab('一条序列 50 步（金色一排）', [0, -0.5, 9.2], { size: 23 }), lab('一批 50 条序列', [9.4, -0.5, 0], { size: 23 }));
    G.add(lab('向上是 τ', [9.2, 5.6, -7.5], { size: 22 }));
    const tot = 2500 * H;
    return { ctl: [{ key: 'H5', label: '想象长度 H', items: [[5, '5'], [10, '10'], [15, '15'], [30, '30']] }], update(p) {
      const steps = clamp(Math.ceil(p * 1.2 * H), 0, H); g.setDrawRange(0, steps * N * N * 2);
      cap(`想象到第 <b>${steps}</b> / ${H} 步，已生成 <b>${(2500 * steps).toLocaleString('en-US')}</b> 个状态`);
      live(`<p class="mono">2500 × ${H} = <b>${tot.toLocaleString('en-US')}</b> 个想象状态 / 次更新<br>γ^H = ${(0.99 ** H).toFixed(3)}：窗口外占折扣回报的份额（奖励恒定时）<br>H × 2 = ${H * 2} 环境步，一回合 1000 步</p>`);
    } };
  }

  /* ---------- scene 6: lambda returns, computed ---------- */
  const R0 = Array.from({ length: 31 }, (_, t) => 0.25 + 0.85 * Math.exp(-((t - 9) ** 2) / 10) + 0.1 * Math.sin(t * 1.3));
  const V0 = Array.from({ length: 31 }, (_, t) => 4.4 + 2.2 * Math.sin(t * 0.45 + 0.6) + 0.25 * Math.cos(t * 1.7));
  function s6(G) {
    const H = Math.round(ST.H), l = ST.lam, g = ST.gam, x0 = -7, dx = 19 / Math.max(H, 1), X = t => x0 + t * dx, w = clamp(dx * 0.28, 0.1, 0.5), yS = 0.6;
    const r = R0.slice(0, H + 1), v = V0.slice(0, H + 1), R = Ret.rec(r, v, g, l, H);
    const barsR = inst(BOX, H + 1), barsV = inst(BOX, H + 1), barsL = inst(BOX, H + 1), barsK = inst(BOX, H), barsW = inst(BOX, H); [barsR, barsV, barsL, barsK, barsW].forEach(b => { G.add(b); });
    barsR.material.color.setHex(COL.rew); barsV.material.color.setHex(COL.val); barsL.material.color.setHex(COL.pi); barsK.material.color.setHex(COL.sto); barsW.material.color.setHex(COL.grad);
    const zR = 6.5, zV = 3.4, zL = 0.3, zK = -4, zW = -8;
    G.add(L.line([[x0 - 0.6, 0, zR + 0.8], [X(H) + 0.6, 0, zR + 0.8]], COL.env, { opacity: 0.5 }));
    const stepN = Math.max(1, Math.round(H / 5));
    for (let t = 0; t <= H; t += stepN) G.add(lab(`τ=${t}`, [X(t), -0.75, zR + 1.6], { size: 20 }));
    G.add(lab('奖励 r', [x0 - 2.6, 0.6, zR], { size: 22 }), lab('价值 v', [x0 - 2.6, 0.6, zV], { size: 22 }), lab('V_λ', [x0 - 2.6, 0.6, zL], { size: 22 }), lab('V_N^k（τ=0，横轴 k）', [x0 - 3.9, 0.3, zK + 0.6], { size: 19 }), lab('权重 ×10', [x0 - 2.6, 0.5, zW], { size: 21 }));
    const pt = block(w * 2.2, 0.14, 8.5, COL.grad, [X(H), 0.07, zV]); G.add(pt);
    const sc = 0.5, k6 = r.length > 1 ? Ret.eq6(r, v, g, l, H, 0) : R[0];
    let maxErr = 0; for (let t = 0; t <= H; t++) maxErr = Math.max(maxErr, Math.abs(Ret.eq6(r, v, g, l, H, t) - R[t]));
    const weights = Array.from({ length: H }, (_, i) => Ret.w(l, H, i + 1)), vnk = weights.map((_, i) => Ret.vn(r, v, g, H, 0, i + 1));
    const meanK = weights.reduce((a, b, i) => a + b * (i + 1), 0);
    return { ctl: [{ key: 'lam', label: 'λ', type: 'range', min: 0, max: 1, step: 0.01, fmt: x => x.toFixed(2) }, { key: 'H', label: 'H', type: 'range', min: 1, max: 30, step: 1, fmt: x => String(x) }, { key: 'gam', label: 'γ', type: 'range', min: 0.8, max: 1, step: 0.01, fmt: x => x.toFixed(2) }], update(p) {
      const a = seg(p, 0, 0.14), sweep = clamp((p - 0.14) / 0.62, 0, 1), cur = H - Math.floor(sweep * (H + 0.999)), showK = seg(p, 0.78, 0.95);
      for (let t = 0; t <= H; t++) {
        const hr = Math.max(0.02, r[t] * sc * a), hv = Math.max(0.02, v[t] * sc * a), hl = t >= cur && sweep > 0 ? Math.max(0.02, R[t] * sc) : 0.001;
        setI(barsR, t, [X(t), hr / 2, zR], [w, hr, w * 1.6]); setI(barsV, t, [X(t), hv / 2, zV], [w, hv, w * 1.6]); setI(barsL, t, [X(t), hl / 2, zL], [w, hl, w * 1.6]);
      }
      for (let i = 0; i < H; i++) { const x = X(i + 1), hk = Math.max(0.001, vnk[i] * sc * 0.6 * showK), hw = Math.max(0.001, weights[i] * 10 * showK); setI(barsK, i, [x, hk / 2, zK], [w, hk, w * 1.6]); setI(barsW, i, [x, hw / 2, zW], [w, hw, w * 1.6]); }
      [barsR, barsV, barsL, barsK, barsW].forEach(done);
      pt.position.x = X(clamp(cur, 0, H)); pt.visible = sweep > 0 && sweep < 1;
      const c = clamp(cur, 0, H);
      cap(sweep <= 0 ? `先有 ${H + 1} 个状态上的奖励和价值` : c === H ? `起点：V(${H}) = v(${H}) = <b>${v[H].toFixed(3)}</b>` : `V(${c}) = ${r[c].toFixed(2)} + ${g.toFixed(2)}·[${(1 - l).toFixed(2)}·${v[c + 1].toFixed(2)} + ${l.toFixed(2)}·${R[c + 1].toFixed(2)}] = <b>${R[c].toFixed(3)}</b>`);
      const show = H <= 7 ? weights.map((_, i) => i) : [0, 1, 2, 3, H - 2, H - 1];
      live(`<table class="mini"><tbody><tr><td>V<sub>λ</sub>(s₀) 递推</td><td class="n"><b>${R[0].toFixed(5)}</b></td></tr><tr><td>V<sub>λ</sub>(s₀) 式 (6)</td><td class="n"><b>${k6.toFixed(5)}</b></td></tr><tr><td>全部 τ 上最大差</td><td class="n">${maxErr.toExponential(1)}</td></tr><tr><td>λ<sup>H−1</sup>：最长一项的权重</td><td class="n">${(H > 0 ? l ** (H - 1) : 1).toFixed(3)}</td></tr><tr><td>平均向前看</td><td class="n">${meanK.toFixed(2)} 步</td></tr></tbody></table>` +
        `<table class="mini"><thead><tr><th>k</th><th class="n">V_N^k(s₀)</th><th class="n">权重</th></tr></thead><tbody>${show.map(i => `<tr><td>${i + 1}</td><td class="n">${vnk[i].toFixed(3)}</td><td class="n">${weights[i].toFixed(3)}</td></tr>`).join('')}</tbody></table>`);
    } };
  }

  /* ---------- scene 7: analytic gradient, checked against finite differences ---------- */
  let snapCache = null;
  function trained() { if (!snapCache) snapCache = Toy.run({ ...Toy.defaults, H: 15, lambda: 0.95, useValue: true, seed: 1 })[12]; return snapCache; }
  function s7(G) {
    const P = trained(), H = Math.round(ST.H), o = { H, gamma: 0.97, lambda: ST.lam, useValue: true, stopGrad: !!ST.sg }, r = Toy.rng(9), eps = Array.from({ length: H }, () => Toy.gauss(r)), x0 = 1.0;
    const ro = Toy.rollout(x0, eps, P, o), ad = Toy.adjoint(ro, P, o);
    const J = th => Toy.rollout(x0, eps, { ...P, th }, { ...o, frozen: o.stopGrad ? ro.s : null }).R.reduce((a, b) => a + b, 0);
    const rd = Toy.rng(21), dir = P.th.map(() => Toy.gauss(rd)), nd = Math.hypot(...dir), d = dir.map(x => x / nd), h = 1e-5, fd = (J(P.th.map((x, i) => x + h * d[i])) - J(P.th.map((x, i) => x - h * d[i]))) / (2 * h), an = Toy.dot(ad.gth, d);
    const gN = Math.hypot(...ad.gth), mx = Math.max(1e-9, ...ad.da.map(Math.abs));
    const x00 = -8, dx = 21 / Math.max(H, 1), X = t => x00 + t * dx, Y = x => 1.2 + (x - 0.5) * 1.5, sn = clamp(dx * 0.26, 0.09, 0.32);
    const nodes = inst(BALL, H + 1), acts = inst(BOX, H), grads = inst(BOX, H), rew = inst(BOX, H + 1), val = inst(BOX, H + 1); nodes.material.color.setHex(COL.det); acts.material.color.setHex(COL.pi); grads.material.color.setHex(COL.grad); rew.material.color.setHex(COL.rew); val.material.color.setHex(COL.val); G.add(nodes, acts, grads, rew, val);
    grads.material.emissive.setHex(COL.grad); grads.material.emissiveIntensity = 0.45;
    const line = wire(G, ro.s.map((x, t) => [X(t), Y(x), 0]), COL.det, { opacity: 0.6 });
    const zA = 5.2, zG = -4.6;
    const stepN = Math.max(1, Math.round(H / 5)); for (let t = 0; t <= H; t += stepN) G.add(lab(`τ=${t}`, [X(t), -0.7, 7], { size: 20 }));
    G.add(lab('状态 x', [x00 - 2.4, Y(ro.s[0]), 0], { size: 22 }), lab('动作 a', [x00 - 2.2, 0.5, zA], { size: 22 }), lab('|∂J/∂a|（归一化）', [x00 - 2.0, 0.5, zG], { size: 21 }));
    const f = stream(G, 3, COL.pi, 0.13), b = stream(G, 3, COL.grad, 0.15), pts = ro.s.map((x, t) => [X(t), Y(x), 0]), rev = pts.slice().reverse();
    return { ctl: [{ key: 'H', label: 'H', type: 'range', min: 2, max: 30, step: 1, fmt: x => String(x) }, { key: 'lam', label: 'λ', type: 'range', min: 0, max: 1, step: 0.01, fmt: x => x.toFixed(2) }, { key: 'sg', label: '动作输入', items: [[1, 'stop_gradient（代码）'], [0, '不切断']] }], update(p) {
      const fw = clamp(p / 0.42, 0, 1), bw = clamp((p - 0.46) / 0.5, 0, 1), nS = Math.ceil(fw * H), reachB = H - Math.ceil(bw * H);
      for (let t = 0; t <= H; t++) { setI(nodes, t, t <= nS ? [X(t), Y(ro.s[t]), 0] : [0, -40, 0], sn); }
      for (let t = 0; t < H; t++) { const ha = Math.abs(ro.a[t]) * 1.6 + 0.02, on = t < nS; setI(acts, t, on ? [X(t), ha / 2, zA] : [0, -40, 0], [sn * 1.8, ha, sn * 1.8]); colI(acts, t, ro.a[t] >= 0 ? hex3(COL.pi) : hex3(COL.sto)); const gh = Math.abs(ad.da[t]) / mx * 3.2 + 0.02, go = bw > 0 && t >= reachB; setI(grads, t, go ? [X(t), gh / 2, zG] : [0, -40, 0], [sn * 1.8, gh, sn * 1.8]); }
      [nodes, acts, grads].forEach(done);
      f(pts, (p * 6) % 1, fw < 1 ? 1 : 0); b(rev, (p * 6) % 1, bw > 0 && bw < 1 ? 1 : 0);
      cap(fw < 1 ? `前向：第 <b>${nS}</b> / ${H} 步，动作 a = tanh(μ + σε)` : bw <= 0 ? `J = Σ V_λ = <b>${ro.R.reduce((a, c) => a + c, 0).toFixed(3)}</b>` : `反向：梯度到达 τ = <b>${reachB}</b>，大小 ${Math.abs(ad.da[Math.min(H - 1, reachB)]).toFixed(3)}`);
      live(`<table class="mini"><tbody><tr><td>‖∂J/∂θ‖</td><td class="n"><b>${gN.toFixed(4)}</b></td></tr><tr><td>方向导数 反向传播</td><td class="n">${an.toFixed(6)}</td></tr><tr><td>方向导数 有限差分</td><td class="n">${fd.toFixed(6)}</td></tr><tr><td>相对差</td><td class="n">${(Math.abs(an - fd) / Math.max(1e-12, Math.abs(fd))).toExponential(1)}</td></tr></tbody></table><p class="src">切断时，有限差分把动作的输入状态固定在前向值上算。</p>`);
    } };
  }

  /* ---------- scene 8: toy Dreamer ---------- */
  const runCache = new Map();
  function toyRun() { const H = Math.round(ST.H), key = [H, ST.lam, ST.val, ST.seed].join(); if (!runCache.has(key)) runCache.set(key, Toy.run({ ...Toy.defaults, H, lambda: ST.lam, useValue: !!ST.val, seed: ST.seed })); return runCache.get(key); }
  function s8(G) {
    const hist = toyRun(), XW = x => (x - 1) * 2.1, N = 51, gx = Array.from({ length: N }, (_, i) => -4 + 10 * i / (N - 1)), bw = 0.3, zT = 6.6, zL = 5.4, zV = 1.4, zP = -2.6, zRet = -7;
    const bT = inst(BOX, N), bL = inst(BOX, N), bV = inst(BOX, N), bP = inst(BOX, N), bRet = inst(BOX, 31); [bT, bL, bV, bP, bRet].forEach(b => G.add(b));
    bT.material.color.setHex(COL.rew); bL.material.color.setHex(0xffe6a1); bV.material.color.setHex(COL.val); bRet.material.color.setHex(COL.pi);
    const agent = L.sphere(0.34, COL.grad); agent.material.emissive.setHex(COL.grad); agent.material.emissiveIntensity = 0.5; G.add(agent);
    const lT = wire(G, [[XW(-4), 0, zT + 1.3], [XW(6), 0, zT + 1.3]], COL.env);
    [-4, -2, 0, 2, 3.5, 6].forEach(x => G.add(lab(`x=${x}`, [XW(x), -0.7, zT + 2.1], { size: 20 })));
    G.add(lab('奖励：真实深，学到浅', [XW(-4) - 3.2, 0.5, zT - 0.5], { size: 20 }), lab('价值 v(x)', [XW(-4) - 2.2, 0.5, zV], { size: 20 }), lab('动作：青右，橙左', [XW(-4) - 2.8, 0.5, zP], { size: 20 }), lab('每轮真实回报', [11.8, 0.5, zRet], { size: 20 }));
    const chips = ['拟合世界模型', '想象 + 学行为', '收集一回合'].map((t, i) => { const m = block(5.2, 0.5, 1.3, [COL.wm, COL.pi, COL.env][i], [-6.5 + i * 6.5, 0.25, 11.2]); G.add(m, lab(t, [-6.5 + i * 6.5, 1.0, 11.2], { size: 22 })); return m; });
    const rv = hist.flatMap(h => h.w.length ? gx.map(x => Math.abs(Toy.dot(h.w, Toy.phi(x)))) : [0]), vmax = Math.max(1, ...rv);
    return { ctl: [{ key: 'H', label: 'H', type: 'range', lazy: 1, min: 1, max: 30, step: 1, fmt: x => String(x) }, { key: 'lam', label: 'λ', type: 'range', lazy: 1, min: 0, max: 1, step: 0.05, fmt: x => x.toFixed(2) }, { key: 'val', label: '价值模型', items: [[1, '有'], [0, '无']] }, { key: 'seed', label: '种子', items: [[1, '1'], [2, '2'], [3, '3'], [5, '5']] }], update(p) {
      const f = clamp(p, 0, 0.9999) * 30, it = Math.floor(f) + 1, ph = f - Math.floor(f), h = hist[it], stage = ph < 0.3 ? 0 : ph < 0.6 ? 1 : 2, shown = stage === 0 ? hist[it - 1] : h;
      gx.forEach((x, i) => { const X = XW(x), ht = Toy.rTrue(x) * 2.2 + 0.01, hl = Math.max(0.01, Toy.dot(shown.rho, Toy.phi(x)) * 2.2), vv = ST.val ? Toy.dot(shown.w, Toy.phi(x)) / vmax * 3.2 : 0, hv = Math.max(0.01, Math.abs(vv)), a = Math.tanh(Toy.dot(shown.th, Toy.phi(x)));
        setI(bT, i, [X, ht / 2, zT], [bw, ht, 0.5]); setI(bL, i, [X, hl / 2, zL], [bw, hl, 0.5]); setI(bV, i, [X, hv / 2, zV], [bw, hv, 0.8]); const ah = Math.abs(a) * 1.4 + 0.01; setI(bP, i, [X, ah / 2, zP], [bw, ah, 0.8]); colI(bP, i, a >= 0 ? hex3(COL.pi) : hex3(COL.sto)); });
      for (let i = 0; i <= 30; i++) { const he = i <= it - (stage === 2 ? 0 : 1) ? Math.max(0.03, hist[i].ret / 30 * 3.4) : 0.001; setI(bRet, i, [-9 + i * 0.6, he / 2, zRet], [0.42, he, 0.6]); } 
      [bT, bL, bV, bP, bRet].forEach(done);
      const tr = stage === 2 ? h.xs : hist[it - 1].xs, xNow = tr[Math.min(tr.length - 1, Math.floor((stage === 2 ? (ph - 0.6) / 0.4 : 1) * (tr.length - 1)))]; agent.position.set(XW(xNow), 0.34, zT + 1.3);
      chips.forEach((m, i) => glow(m, i === stage ? 0.9 : 0));
      cap(`第 <b>${it}</b> / 30 轮 · ${['拟合模型 A, B, C 和奖励头', '从数据集状态出发想象，更新动作和价值', '到真实环境跑一回合，加入数据集'][stage]}`);
      live(`<table class="mini"><tbody><tr><td>H / λ / γ</td><td class="n">${Math.round(ST.H)} / ${ST.val ? ST.lam.toFixed(2) : '无价值'} / 0.97</td></tr><tr><td>学到 x' = A x + B a + C</td><td class="n">${shown.A.toFixed(3)}, ${shown.B.toFixed(3)}, ${shown.C.toFixed(3)}</td></tr><tr><td>真实系数</td><td class="n">1, 0.25, 0</td></tr><tr><td>这轮回报（无噪声）</td><td class="n"><b>${h.ret.toFixed(1)}</b></td></tr><tr><td>终点 x</td><td class="n">${h.xs[h.xs.length - 1].toFixed(2)}</td></tr><tr><td>数据量</td><td class="n">${h.n}</td></tr></tbody></table>`);
    } };
  }

  /* ---------- scene 9: real numbers ---------- */
  const FIG4H = [3, 5, 10, 15, 20, 25, 30, 40];
  const FIG4 = { 'Cartpole Swingup': { D: [552.2, 745.9, 838.7, 819.1, 813.0, 763.2, 803.9, 862.3], N: [93.6, 176.5, 270.4, 261.5, 303.5, 310.5, 348.3, 347.0], P: [124.5, 256.3, 316.1, 411.6, 439.8, 382.9, 394.8, 497.2] }, 'Cheetah Run': { D: [688.3, 798.4, 855.0, 793.7, 822.0, 813.7, 809.9, 834.7], N: [139.7, 165.9, 215.5, 407.9, 502.5, 662.2, 558.1, 836.2], P: [233.9, 281.9, 352.6, 558.6, 573.1, 516.3, 420.7, 384.4] }, 'Quadruped Walk': { D: [576.8, 462.8, 920.9, 929.0, 931.0, 888.2, 926.0, 876.1], N: [82.1, 138.2, 248.1, 864.7, 764.5, 711.4, 932.2, 909.7], P: [49.1, 80.9, 118.6, 146.4, 186.2, 116.8, 166.8, 132.7] }, 'Walker Walk': { D: [957.2, 965.2, 959.1, 961.1, 963.7, 967.0, 937.4, 528.5], N: [96.7, 275.7, 885.6, 966.8, 966.4, 967.1, 915.1, 743.0], P: [125.0, 229.5, 930.2, 924.8, 885.3, 706.9, 783.6, 585.3] } };
  const TG = [['Acrobot Swingup', 41.90, 91.70, 3.21, 365.26], ['Cartpole Balance', 951.60, 992.80, 452.56, 979.56], ['Cartpole Bal. Sparse', 857.40, 1000.00, 164.74, 941.84], ['Cartpole Swingup', 558.40, 862.00, 312.56, 833.66], ['Cartpole Swi. Sparse', 179.80, 482.00, 0.64, 812.22], ['Cheetah Run', 213.90, 523.80, 496.12, 894.56], ['Cup Catch', 104.70, 980.50, 455.98, 962.48], ['Finger Spin', 129.40, 985.70, 495.25, 498.88], ['Finger Turn Easy', 167.30, 971.40, 451.22, 825.86], ['Finger Turn Hard', 88.70, 966.00, 312.55, 891.38], ['Hopper Hop', 0.50, 242.00, 0.37, 368.97], ['Hopper Stand', 27.90, 929.90, 5.96, 923.72], ['Pendulum Swingup', 48.60, 680.90, 3.27, 833.00], ['Quadruped Run', null, null, 280.45, 888.39], ['Quadruped Walk', null, null, 238.90, 931.61], ['Reacher Easy', 95.60, 967.40, 468.50, 935.08], ['Reacher Hard', 39.70, 957.10, 187.02, 817.05], ['Walker Run', 191.80, 567.20, 626.25, 824.67], ['Walker Stand', 378.40, 985.20, 759.19, 977.99], ['Walker Walk', 311.00, 968.30, 944.70, 961.67]];
  function s9(G) {
    const names = Object.keys(FIG4), v = ST.view, ctl = [{ key: 'view', label: '视图', items: [...names.map((n, i) => [i, n.split(' ')[0]]), [4, '附录 G']] }];
    if (v < 4) {
      const d = FIG4[names[v]], ser = [['D', 0x3987e5, 'Dreamer'], ['N', 0x199e70, '无价值模型'], ['P', 0xd95926, 'PlaNet']], X = i => -11 + i * 3.2, sc = 0.0085;
      const bars = ser.map(s => { const im = inst(BOX, 8); im.material.color.setHex(s[1]); G.add(im); return im; });
      FIG4H.forEach((h, i) => G.add(lab(`H=${h}`, [X(i) + 0.8, -0.8, 1.6], { size: 22 })));
      [0, 500, 1000].forEach(y => { wire(G, [[-12.5, y * sc, -1], [13, y * sc, -1]], COL.env, { opacity: 0.3 }); G.add(lab(String(y), [-13.6, y * sc, -1], { size: 20 })); });
      ser.forEach((s, j) => G.add(lab(s[2], [-1 + j * 6, 10.2, -1], { size: 22, border: '#' + s[1].toString(16).padStart(6, '0') })));
      return { ctl, update(p) { const a = seg(p, 0, 0.6); ser.forEach((s, j) => { d[s[0]].forEach((y, i) => { const h = Math.max(0.01, y * sc * a); setI(bars[j], i, [X(i) + j * 0.85, h / 2, 0], [0.75, h, 1]); }); done(bars[j]); });
        cap(`${names[v]}，H = 3：Dreamer <b>${d.D[0]}</b>，无价值 <b>${d.N[0]}</b>，PlaNet <b>${d.P[0]}</b>`);
        live(`<table class="mini"><thead><tr><th>H</th><th class="n">Dreamer</th><th class="n">无价值</th><th class="n">PlaNet</th></tr></thead><tbody>${FIG4H.map((h, i) => `<tr><td>${h}</td><td class="n">${d.D[i]}</td><td class="n">${d.N[i]}</td><td class="n">${d.P[i]}</td></tr>`).join('')}</tbody></table><p class="src">从 PDF 矢量路径读出，按刻度标定，精度约 ±1。</p>`); } };
    }
    const ser = [[4, 0x3987e5, 'Dreamer 5×10⁶ 步'], [3, 0xd95926, 'PlaNet 5×10⁶ 步'], [2, 0xc98500, 'D4PG 10⁸ 步'], [1, 0x8e9bb8, 'A3C 10⁸ 步，本体']], X = i => -14.6 + i * 1.5, sc = 0.0085;
    const bars = ser.map(() => inst(BOX, 20)); bars.forEach((im, j) => { im.material.color.setHex(ser[j][1]); G.add(im); });
    TG.forEach((t, i) => { const s = L.label(t[0].replace(' ', '\n'), { scale: 0.0095 * refDist / 22, size: LSZ(19, 0.0095), pos: [X(i) + 0.45, i % 2 ? -2.1 : -0.8, 2.6] }); s.userData.s0 = s.scale.clone(); LABS.push(s); G.add(s); });
    [0, 500, 1000].forEach(y => { wire(G, [[-15.4, y * sc, -2], [15.2, y * sc, -2]], COL.env, { opacity: 0.3 }); G.add(lab(String(y), [-16.4, y * sc, -2], { size: 20 })); });
    ser.forEach((s, j) => G.add(lab(s[2], [-6.4 + j * 5.8, 10.4, -2], { size: 20, border: '#' + s[1].toString(16).padStart(6, '0') })));
    return { ctl, update(p) { const a = seg(p, 0, 0.6); ser.forEach((s, j) => { TG.forEach((t, i) => { const y = t[s[0]], h = y == null ? 0.001 : Math.max(0.01, y * sc * a); setI(bars[j], i, y == null ? [0, -40, 0] : [X(i) + j * 0.3, h / 2, 0], [0.28, h, 0.9]); }); done(bars[j]); });
      cap('平均：Dreamer <b>823.39</b>，PlaNet <b>332.97</b>（20 个任务）；D4PG <b>786.32</b>，A3C <b>243.70</b>（18 个任务）');
      live('<table class="mini"><tbody><tr><td>同 18 任务上 Dreamer 平均（我的计算）</td><td class="n">813.77</td></tr><tr><td>18 任务里 D4PG 更高的</td><td class="n">12 个</td></tr><tr><td>20 任务里 PlaNet 更高的</td><td class="n">0 个</td></tr></tbody></table>'); } };
  }

  /* ---------- scene 10: Dreamer vs SuperMimic ---------- */
  const VS = [['输入', '图像 64×64×3', '仿真器状态 ŝ 和上下文 ξ'], ['状态', '学到的 h (200) + s (30)，没有物理含义', '仿真器状态，每维有含义，可直接监督'], ['随机性', '30 维高斯，每步采样', '确定性 MLP (2048×3)；随机来源写进 ξ 或模型外'], ['拟合', '重建 + 奖励 + KL；先验只被约束一步', 'k = 8 步自回归 MSE + BCE'], ['想象', 'H = 15，2500 条，起点是后验', 'H = 32，4096 条，起点是回放状态'], ['策略', '随机 tanh 高斯，输入隐特征', '确定性，输入带噪观测 + 目标'], ['回报目标', 'Σ V_λ(s_τ)，每个 τ 一项', 'H 步奖励和 + γ^H V，只有一项'], ['部署', '要带编码器和 RSSM 算状态', '只带策略，模型和 ξ 都不要']];
  function s10(G) {
    const who = ST.who, yA = 8, yB = 0, r = L.rng(3), showA = who !== 1, showB = who !== 0, Dr = new THREE.Group(), Sm = new THREE.Group(); G.add(Dr, Sm); Dr.visible = showA; Sm.visible = showB;
    /* Dreamer row */
    const im = imgTile(2.4, [-12, yA, 0]); im.userData.upload(walker(0.8)); const enc = block(1.8, 1.2, 1.4, COL.enc, [-8.2, yA, 0]), rs = block(2.4, 1.8, 1.8, COL.det, [-4.4, yA, 0]), act = block(1.6, 1.1, 1.3, COL.pi, [-0.6, yA + 1.8, 0]), dec = block(1.6, 1.1, 1.3, COL.sto, [-0.6, yA - 1.9, 0]);
    Dr.add(im, enc, rs, act, dec);
    [[-10.8, -9.1], [-7.3, -5.6]].forEach(a => wire(Dr, [[a[0], yA, 0], [a[1], yA, 0]], COL.enc)); wire(Dr, [[-3.2, yA + 0.4, 0], [-1.4, yA + 1.6, 0]], COL.pi); wire(Dr, [[-3.2, yA - 0.4, 0], [-1.4, yA - 1.7, 0]], COL.sto);
    const nA = 26, lA = 15, dxA = 0.5, lineA = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COL.sto, transparent: true, opacity: 0.55 })), pA = new Float32Array(nA * lA * 6); for (let i = 0; i < nA; i++) { let y = yA, z = 0; for (let t = 0; t < lA; t++) { const y2 = y + 0.2 * L.gauss(r), z2 = z + 0.2 * L.gauss(r); pA.set([2 + t * dxA, y, z, 2 + (t + 1) * dxA, y2, z2], (i * lA + t) * 6); y = y2; z = z2; } }
    lineA.geometry.setAttribute('position', new THREE.BufferAttribute(pA, 3)); lineA.frustumCulled = false; Dr.add(lineA);
    Dr.add(lab('Dreamer', [-12, yA + 2.2, 0], { size: 26, border: 'rgba(240,150,60,.9)' }), lab('CNN', [-8.2, yA + 1.1, 0], { size: 21 }), lab('RSSM\nh + s', [-4.4, yA + 1.7, 0], { size: 21 }), lab('动作', [-0.6, yA + 2.9, 0], { size: 21 }), lab('解码（只训练用）', [-0.6, yA - 3.0, 0], { size: 20 }), lab('15 步，每步采样，一片云', [5.8, yA + 3.0, 0], { size: 21 }));
    /* SuperMimic row */
    const st = block(2.2, 1.3, 1.4, COL.env, [-12, yB, 0]), xi = block(1.2, 0.8, 1.2, COL.rew, [-12, yB + 1.6, 0]), f = block(2.6, 1.8, 1.8, COL.wm, [-7, yB, 0]), pi = block(1.6, 1.1, 1.3, COL.pi, [-2.4, yB + 1.3, 0]); Sm.add(st, xi, f, pi);
    wire(Sm, [[-10.9, yB, 0], [-8.3, yB, 0]], COL.env); wire(Sm, [[-11.4, yB + 1.5, 0], [-8.3, yB + 0.4, 0]], COL.rew); wire(Sm, [[-5.7, yB + 0.4, 0], [-3.2, yB + 1.2, 0]], COL.pi);
    const nB = 6, lB = 32, dxB = 12 / 32, lineB = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COL.wm, transparent: true, opacity: 0.9 })), pB = new Float32Array(nB * lB * 6); for (let i = 0; i < nB; i++) { const off = (i - 2.5) * 0.45; for (let t = 0; t < lB; t++) { const fy = q => yB + off + 0.5 * Math.sin(q * 0.28 + i); pB.set([0.2 + t * dxB, fy(t), 0, 0.2 + (t + 1) * dxB, fy(t + 1), 0], (i * lB + t) * 6); } }
    lineB.geometry.setAttribute('position', new THREE.BufferAttribute(pB, 3)); lineB.frustumCulled = false; Sm.add(lineB);
    Sm.add(lab('SuperMimic', [-12, yB + 3.0, 0], { size: 26, border: 'rgba(56,209,255,.9)' }), lab('状态 ŝ', [-12, yB - 1.4, 0], { size: 21 }), lab('ξ', [-9.9, yB + 1.3, 0], { size: 21 }), lab('MLP f\n确定性', [-7, yB - 1.6, 0], { size: 21 }), lab('策略', [-2.4, yB + 2.4, 0], { size: 21 }), lab('32 步，确定性，每条一根线', [6.2, yB + 2.4, 0], { size: 21 }));
    return { ctl: [{ key: 'who', label: '看', items: [[2, '两个都看'], [0, 'Dreamer'], [1, 'SuperMimic']] }], update(p) {
      const g1 = seg(p, 0, 0.5); lineA.geometry.setDrawRange(0, Math.floor(g1 * lA) * 2 * nA); lineB.geometry.setDrawRange(0, Math.floor(g1 * lB) * 2 * nB);
      /* the fan is stored rollout by rollout; draw whole rollouts as they complete */
      lineA.geometry.setDrawRange(0, Math.floor(g1 * nA) * lA * 2); lineB.geometry.setDrawRange(0, Math.floor(g1 * nB) * lB * 2);
      const i = Math.min(VS.length - 1, Math.floor(clamp(p, 0, 0.9999) * VS.length)), v = VS[i];
      cap(`<b>${v[0]}</b>：Dreamer ${v[1]} ｜ SuperMimic ${v[2]}`);
      live(`<table class="mini"><thead><tr><th></th><th>Dreamer</th><th>SuperMimic</th></tr></thead><tbody>${VS.map((x, k) => `<tr${k === i ? ' class="on"' : ''}><td class="nw">${x[0]}</td><td>${x[1]}</td><td>${x[2]}</td></tr>`).join('')}</tbody></table>`);
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10];

  /* ---------- player ---------- */
  let cur = 0, api = null, playing = !L.reduced(), t0 = 0, pNow = 0, tw = null;
  const HOLD = 1.8;
  const aspectFix = () => { const el = $('stage'), asp = (el.clientWidth || 1) / (el.clientHeight || 1); return Math.min(2.2, Math.max(1, 1.45 / asp)); };
  function fly(th, ph, d, tg) { let dth = th - S.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth)); d *= aspectFix(); tw = { t0: performance.now(), from: [S.theta, S.phi, S.dist, S.target.clone()], to: [S.theta + dth, ph, d, new THREE.Vector3(...tg)] }; refDist = d; }
  function setPlay(on) { playing = on; $('play').textContent = on ? '❚❚ 暂停' : '▶ 播放'; $('play').setAttribute('aria-label', on ? '暂停' : '播放'); }
  function buildG() { L.clear(root); LABS = []; PICKS = []; lastCap = null; const G = new THREE.Group(); root.add(G); api = BUILD[cur](G); }
  function refresh() { buildG(); syncCtl(); api.update(pNow); }
  function syncCtl() {
    $('ctl').querySelectorAll('[data-key]').forEach(e => {
      const k = e.dataset.key;
      if (e.tagName === 'BUTTON') e.setAttribute('aria-pressed', String(+e.dataset.v === ST[k]));
      else { if (document.activeElement !== e) e.value = ST[k]; const c = (api.ctl || []).find(x => x.key === k); const o = e.parentElement.querySelector('output'); if (o && c) o.textContent = c.fmt(+ST[k]); }
    });
  }
  function makeCtl() {
    const box = $('ctl'), c = api.ctl;
    if (!c) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = c.map(x => x.type === 'range'
      ? `<label class="rng"><span>${x.label}</span><input type="range" data-key="${x.key}" data-lazy="${x.lazy ? 1 : 0}" min="${x.min}" max="${x.max}" step="${x.step}" value="${ST[x.key]}" aria-label="${x.label}"><output>${x.fmt(+ST[x.key])}</output></label>`
      : `<div class="row"><span>${x.label}</span>${x.items.map(i => `<button type="button" data-key="${x.key}" data-v="${i[0]}" aria-pressed="${i[0] === ST[x.key]}">${i[1]}</button>`).join('')}</div>`).join('');
  }
  function go(i, p0 = 0) {
    cur = (i + SCENES.length) % SCENES.length; showInfo(cur);
    if (!S) return;
    const sc = SCENES[cur]; fly(...sc.cam); refDist = sc.cam[2] * aspectFix();
    buildG(); makeCtl();
    pNow = p0; t0 = performance.now() - p0 * sc.dur * 1000; api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
  }
  if (S) {
    S.onTick(() => {
      if (playing && api) {
        const sc = SCENES[cur], el = (performance.now() - t0) / 1000;
        if (el > sc.dur + HOLD) { t0 = performance.now(); pNow = 0; } else pNow = Math.min(1, el / sc.dur);
        api.update(pNow); $('scrub').value = Math.round(pNow * 1000);
      }
      if (tw) { const k = L.reduced() ? 1 : Math.min(1, (performance.now() - tw.t0) / 900), e = L.ease(k), a = tw.from, b = tw.to; S.setView(L.lerp(a[0], b[0], e), L.lerp(a[1], b[1], e), L.lerp(a[2], b[2], e), a[3].clone().lerp(b[3], e).toArray()); if (k >= 1) tw = null; }
      const f = clamp(S.dist / refDist, 0.6, 1.6); for (const sp of LABS) sp.scale.copy(sp.userData.s0).multiplyScalar(f);
    });
    S.onClick(() => PICKS, hit => { const g = hit?.object?.userData?.go ?? hit?.object?.parent?.userData?.go; if (g != null) go(g); });
    S.onHover(() => PICKS, hit => { $('stage').style.cursor = hit ? 'pointer' : ''; });
  }
  $('ctl').addEventListener('click', e => { const b = e.target.closest('button[data-key]'); if (!b) return; ST[b.dataset.key] = +b.dataset.v; refresh(); });
  $('ctl').addEventListener('input', e => { const r = e.target; if (r.tagName !== 'INPUT') return; const c = (api.ctl || []).find(x => x.key === r.dataset.key), o = r.parentElement.querySelector('output'); if (o && c) o.textContent = c.fmt(+r.value); if (r.dataset.lazy === '1') return; ST[r.dataset.key] = +r.value; refresh(); });
  $('ctl').addEventListener('change', e => { const r = e.target; if (r.tagName !== 'INPUT' || r.dataset.lazy !== '1') return; ST[r.dataset.key] = +r.value; refresh(); });
  $('ctl').addEventListener('pointerdown', e => e.stopPropagation());
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
