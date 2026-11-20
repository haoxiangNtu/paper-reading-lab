'use strict';
/* "Learning Sim-to-Real Humanoid Locomotion in 15 Minutes" (arXiv 2512.01996) taken apart into eleven scenes.
   Hyper-parameters, joint limits, reward weights and randomization ranges come from amazon-far/holosoma at commit 78aeb23.
   Scene 10 redraws Fig. 3 from the PDF's vector paths. Each scene's update(p) is a pure function of the timeline p plus
   the current toggles. Scenes 4, 5, 7 and 8 compute toy numbers on load; they are labelled as toys. No network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { env: 0x38d1ff, buf: 0x9d8cff, critic: 0x4fc98a, actor: 0xf0963c, alpha: 0xd45fa0, target: 0x8e9bb8, sac: 0x3a8ee8, td3: 0x3aa860, ppo: 0xc9d4ea, bad: 0xe05d5d, ok: 0x4fc98a, warn: 0xf2c14e, dim: 0x46506a, white: 0xeef2fa, floor: 0x2b3650, rough: 0x6a5a44, obst: 0x9a7b4f };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const fmt = (x, d = 1) => x.toFixed(d);

  /* ---------- real data ---------- */
  /* G1 29-dof joint limits, default pose and action_scale from config_values/robot.py:123, 154, 350, 527 */
  const G1 = {
    names: ['L 髋俯仰', 'L 髋横滚', 'L 髋偏航', 'L 膝', 'L 踝俯仰', 'L 踝横滚', 'R 髋俯仰', 'R 髋横滚', 'R 髋偏航', 'R 膝', 'R 踝俯仰', 'R 踝横滚', '腰偏航', '腰横滚', '腰俯仰', 'L 肩俯仰', 'L 肩横滚', 'L 肩偏航', 'L 肘', 'L 腕横滚', 'L 腕俯仰', 'L 腕偏航', 'R 肩俯仰', 'R 肩横滚', 'R 肩偏航', 'R 肘', 'R 腕横滚', 'R 腕俯仰', 'R 腕偏航'],
    lo: [-2.5307, -0.5236, -2.7576, -0.087267, -0.87267, -0.2618, -2.5307, -2.9671, -2.7576, -0.087267, -0.87267, -0.2618, -2.618, -0.52, -0.52, -3.0892, -1.5882, -2.618, -1.0472, -1.972222054, -1.61443, -1.61443, -3.0892, -2.2515, -2.618, -1.0472, -1.972222054, -1.61443, -1.61443],
    hi: [2.8798, 2.9671, 2.7576, 2.8798, 0.5236, 0.2618, 2.8798, 0.5236, 2.7576, 2.8798, 0.5236, 0.2618, 2.618, 0.52, 0.52, 2.6704, 2.2515, 2.618, 2.0944, 1.972222054, 1.61443, 1.61443, 2.6704, 1.5882, 2.618, 2.0944, 1.972222054, 1.61443, 1.61443],
    q0: [-0.312, 0, 0, 0.669, -0.363, 0, -0.312, 0, 0, 0.669, -0.363, 0, 0, 0, 0, 0.2, 0.2, 0, 0.6, 0, 0, 0, 0.2, -0.2, 0, 0.6, 0, 0, 0],
    scale: 0.25
  };
  const BOUND = G1.lo.map((lo, j) => { const q0 = G1.q0[j], hi = G1.hi[j], m = Math.max(Math.abs(lo - q0), Math.abs(hi - q0)); return { m, k: m / G1.scale, over: Math.max(0, lo - (q0 - m)) + Math.max(0, (q0 + m) - hi) }; });
  /* Fig. 3, read from the PDF's vector paths: [t (min), lin. vel. tracking] for FastSAC / FastTD3 / PPO */
  const F3N = ['G1 平地', 'G1 崎岖', 'G1 平地+强推', 'G1 崎岖+强推', 'T1 平地', 'T1 崎岖', 'T1 平地+强推', 'T1 崎岖+强推'];
  const F3 = [{"td3":[[0,0],[2.53,1.2],[4.46,3.98],[6.35,7.55],[8.17,12.82],[9.98,20.32],[11.8,22.48],[13.62,23.93],[15,24.96]],"ppo":[[0,0],[0.33,0.45],[4.14,3.3],[7.82,6.43],[11.48,7.76],[15,10.55]],"sac":[[0,0],[2.53,1.46],[4.46,3.98],[6.35,6.54],[8.17,12.88],[9.98,23.27],[11.8,24.63],[13.62,25.15],[15,25.88]]},{"td3":[[0,0],[2.55,0.72],[4.5,2.62],[6.38,5.53],[8.25,11.68],[10.07,19.97],[11.88,21.83],[13.69,22.8],[15,23.34]],"ppo":[[0,0],[0.33,0.43],[4.14,1.38],[7.82,6.13],[11.48,7.11],[15,10.16]],"sac":[[0,0],[2.55,0.84],[4.5,3.57],[6.38,6.77],[8.25,17.0],[10.07,23.05],[11.88,22.88],[13.69,23.73],[15,24.36]]},{"td3":[[0,0],[2.53,0.73],[4.46,1.74],[6.35,3.08],[8.17,8.22],[9.98,17.0],[11.8,19.08],[13.62,19.46],[15,19.91]],"ppo":[[0,0],[0.33,0.45],[4.14,1.32],[7.82,3.11],[11.48,3.59],[15,13.82]],"sac":[[0,0],[2.53,0.92],[4.46,1.77],[6.35,3.16],[8.17,10.07],[9.98,19.65],[11.8,19.56],[13.62,19.82],[15,20.15]]},{"td3":[[0,0],[2.55,0.71],[4.5,1.64],[6.38,2.6],[8.25,5.9],[10.07,16.55],[11.88,17.69],[13.69,17.77],[15,17.75]],"ppo":[[0,0],[0.33,0.43],[4.14,0.97],[7.82,2.78],[11.48,3.31],[15,12.79]],"sac":[[0,0],[2.55,0.72],[4.5,1.55],[6.38,2.85],[8.25,10.13],[10.07,17.82],[11.88,18.2],[13.69,18.36],[15,18.37]]},{"td3":[[0,0],[2.02,1.62],[3.39,7.72],[4.69,19.0],[5.96,21.6],[7.23,23.28],[8.5,24.46],[9.76,25.27],[11.0,25.75],[12.25,26.14],[13.49,26.08],[14.73,26.81],[15,26.78]],"ppo":[[0,0],[0.29,0.46],[3.02,3.02],[5.54,7.77],[7.98,12.92],[10.38,15.67],[12.74,16.81],[15,17.49]],"sac":[[0,0],[2.02,3.3],[3.39,12.77],[4.69,20.95],[5.96,20.69],[7.23,23.4],[8.5,24.68],[9.76,25.13],[11.0,25.67],[12.25,26.32],[13.49,26.31],[14.73,26.97],[15,26.97]]},{"td3":[[0,0],[2.08,1.07],[3.49,5.76],[4.82,16.79],[6.09,19.58],[7.37,20.87],[8.64,21.84],[9.91,22.27],[11.15,22.75],[12.43,23.0],[13.7,23.36],[14.95,23.44],[15,23.43]],"ppo":[[0,0],[0.29,0.75],[3.02,3.27],[5.54,8.46],[7.98,11.72],[10.37,14.37],[12.74,15.91],[15,17.61]],"sac":[[0,0],[2.08,2.59],[3.49,8.44],[4.82,20.1],[6.09,20.98],[7.37,21.46],[8.64,22.81],[9.91,23.18],[11.15,24.14],[12.43,24.28],[13.7,24.78],[14.95,24.97],[15,24.98]]},{"td3":[[0,0],[2.02,0.98],[3.39,3.31],[4.69,13.69],[5.96,17.22],[7.23,17.76],[8.5,18.54],[9.76,19.32],[11.0,19.59],[12.25,19.51],[13.49,19.88],[14.73,20.14],[15,20.21]],"ppo":[[0,0],[0.29,0.46],[3.02,1.4],[5.54,10.69],[7.98,14.77],[10.38,16.06],[12.74,17.26],[15,18.07]],"sac":[[0,0],[2.02,1.39],[3.39,7.24],[4.69,17.23],[5.96,17.62],[7.23,19.01],[8.5,19.82],[9.76,20.34],[11.0,20.84],[12.25,20.99],[13.49,21.19],[14.73,21.52],[15,21.57]]},{"td3":[[0,0],[2.08,0.76],[3.49,3.12],[4.82,10.57],[6.09,14.8],[7.37,16.12],[8.64,17.05],[9.91,17.34],[11.15,17.5],[12.43,17.82],[13.7,17.73],[14.95,17.79],[15,17.79]],"ppo":[[0,0],[0.29,0.46],[3.02,1.16],[5.54,6.32],[7.98,13.06],[10.37,15.74],[12.74,17.06],[15,18.53]],"sac":[[0,0],[2.08,1.14],[3.49,3.87],[4.82,14.26],[6.09,17.06],[7.37,16.63],[8.64,17.87],[9.91,18.41],[11.15,18.78],[12.43,19.08],[13.7,19.27],[14.95,19.35],[15,19.35]]}];
  const interp = (P, t) => { if (t <= P[0][0]) return P[0][1]; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; if (t <= b[0]) return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]); } return P[P.length - 1][1]; };
  const firstAt = (P, v) => { for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; if (a[1] >= v) return a[0]; if (b[1] >= v) return a[0] + (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]); } return null; };
  /* reward terms of g1_29dof_loco_fast_sac (config_values/loco/g1/reward.py:99-191); c = tagged for the penalty curriculum */
  const RW = [['线速度跟踪', 2.0, 0], ['角速度跟踪', 1.5, 0], ['抬脚相位', 5.0, 0], ['存活', 10.0, 0], ['姿态', -0.5, 1], ['两脚过近', -10, 1], ['脚掌朝向', -5, 1], ['躯干倾斜', -10, 1], ['横滚俯仰角速度', -1, 1], ['动作变化率', -2, 1]];

  const SCENES = [
    { n: 1, part: '总览', title: '一次迭代：采一步、存进缓存、更新 8 次', sub: '这就是“15 分钟”里反复转的那个循环', dur: 14, cam: [0.25, 1.0, 24, [-1.5, 1.4, 0]],
      html: dl([['环境', '4096 个并行，50 Hz，每次迭代每个环境走 1 步'], ['缓存', '每个环境 1024 步的环形缓存'], ['更新', '评论家 8 次、温度 8 次、目标网络 8 次、演员 2 次'], ['迭代数', 'G1 预设 50000，T1 100000']]) +
        '<p>离策略方法和 PPO 的根本区别在中间那个缓存：PPO 用完一批数据就扔，FastSAC 把最近约一个回合的数据都留着，每一步从里面抽 65,536 条反复用。</p>' +
        '<p>论文没有给出这个循环的任何数字，上面的数都来自 holosoma 的预设。点画面里的方块可以跳到对应那一幕。</p>' + src('§2.1 · 算法 1 · 代码 config_values/algo.py:72-119') },
    { n: 2, part: '§2.1 并行与回放', title: '4096 个环境，4,194,304 条的缓存', sub: '切换每步更新次数，看每条数据被用几次', dur: 14, cam: [0.12, 0.95, 31, [0.2, 0.8, 0]],
      html: dl([['缓存', '4096 环境 × 1024 步 = 4,194,304 条（≈ 20.5 s，一个回合）'], ['每次更新', '每个环境抽 2 条，合计 8192；对称增广后 16384'], ['每步', 'num_updates = 8：一次抽 16 × 4096 = 65,536 条'], ['回放比', '65,536 / 4096 = 16']]) +
        '<p>每个环境只在自己的那一行里均匀抽样，所以 8192 的全局批是“每个环境 2 条”拼起来的。</p>' +
        '<p>图 2b：16 次更新比 8 次早到 20 分（7.7 对 9.2 分钟），终点相同；代码默认 8。4 次和 2 次 15 分钟时只有 21.2 和 17.8。</p>' +
        guess('64 × 64 个小方块代表 4096 个环境；缓存只画 16 个环境，每一格代表 16 步。抽中的格子用固定种子当场抽。') +
        src('§2.1 · 图 2b · 代码 fast_sac_agent.py:546-604, 767；fast_sac_utils.py:82-90') },
    { n: 3, part: '§2.1 动作界', title: '演员和“按关节限位定的动作界”', sub: '29 个关节的真实数据；切换“限位与可达范围”和“tanh 乘数”', dur: 14, cam: [0.0, 1.32, 31, [0, 5.4, 0]],
      html: dl([['演员', '98 → 512 → 256 → 128 → μ、log σ（各 29）'], ['层', 'Linear → LayerNorm → SiLU'], ['动作', 'q* = q⁰ + 0.25 · k · tanh(u)'], ['k', 'max(|q_lo − q⁰|, |q_hi − q⁰|) / 0.25']]) +
        '<p>论文说动作界取“关节限位和默认位置之差”。代码取两侧差里<b>较大</b>的那个，所以范围以默认姿态为中心对称，较近的一侧会越过限位，越过的部分要靠仿真器的关节限位挡住。</p>' +
        '<p>左膝：下限 −0.087、上限 2.880、默认 0.669，k = 2.211 / 0.25 = 8.84，可达 −1.542 到 2.880，下侧越限 1.455 rad。踝横滚两侧对称，正好卡在限位。</p>' +
        src('§2.1 · 脚注 1 · 代码 fast_sac_agent.py:116-153；robot.py:123, 154, 350, 527；fast_sac.py:61-99') },
    { n: 4, part: '§2.1 C51 评论家', title: '评论家输出的是 101 个原子上的分布', sub: '下一状态的分布 → r + γz → 投影回原子；切换 γ', dur: 15, cam: [0.0, 1.38, 28, [-1.8, 5.4, 0]],
      html: dl([['评论家', '(98+3) + 29 → 768 → 384 → 192 → 101'], ['原子', '101 个，均匀分布在 [−20, 20]，间隔 0.4'], ['目标', 'clip(r − γbα log π + γb z_j) 再线性投影'], ['损失', '交叉熵 −Σ target · log p']]) +
        '<p>C51 不直接回归一个 Q 值，而是学回报的分布。目标是把下一状态的分布按 r + γz 平移、压缩，再把每个原子的概率按距离分给两侧相邻的原子。</p>' +
        '<p>论文只说用了 C51、分位数回归太贵；原子数和范围在代码里。跟踪任务用 501 个原子。</p>' +
        toyb('下一状态的分布是我设的两峰高斯混合，r = 0.6 是我设的。投影、均值都是页面当场按 C51 的规则算的。') +
        src('§2.1 · 代码 algo.py:91-94；fast_sac.py:232-314') },
    { n: 5, part: '§2.1 目标值', title: '取最小、取平均，还是各用各的', sub: '这一幕是核心。切换三种写法，偏差和噪声当场算', dur: 14, cam: [0.0, 1.36, 27, [0, 5.4, 0]],
      html: dl([['CDQ（TD3 / SAC 原版）', 'y = r + γ min(Q₁ᵗ, Q₂ᵗ)'], ['论文算法 1', 'y = r + γ (Q₁ᵗ + Q₂ᵗ)/2，两个评论家同一目标'], ['代码', 'y_i = r + γ Q_iᵗ，评论家 i 学自己的目标'], ['演员', '论文和代码都用 (Q₁ + Q₂)/2']]) +
        '<p>CDQ 取最小来压住 Q 的高估，但它有系统性的低估偏差。论文发现配合层归一化时取平均更好（图 2a：15 分钟 24.3 对 20.4）。</p>' +
        '<p>代码其实没有在目标上取平均：两个 C51 评论家各自对自己的目标网络做投影。平均只发生在演员那一侧。论文写法和代码写法的期望相同，噪声不同。</p>' +
        toyb('真值 Q* = 10；两个目标网络的误差是独立的标准高斯（σ = 1），固定种子抽 400 次。图里每个点是一次的目标值，偏差和标准差当场算。') +
        src('§2.1 · 算法 1 第 10、14 行 · 图 2a · 代码 fast_sac.py:382-404；fast_sac_agent.py:436-453, 519') },
    { n: 6, part: '算法 1 更新顺序', title: '一次迭代里谁先谁后', sub: '切换“代码”和“算法 1”，以及行走 / 全身跟踪', dur: 14, cam: [0.0, 1.32, 28, [-0.8, 4.4, 0]],
      html: dl([['评论家', '每次更新：交叉熵，AdamW(β 0.9, 0.95)，wd 0.001'], ['温度', '每次更新：−α(log π(a′|o′) + 目标熵)'], ['目标网络', '每次更新：τ = 0.125（跟踪 0.05）'], ['演员', '代码：i % policy_frequency == 1']]) +
        '<p>行走：num_updates 8、policy_frequency 4，演员在第 1、5 次更新；跟踪：4 和 2，演员在第 1、3 次。算法 1 每次都更新演员。这是 TD3 式的延迟策略更新，论文没写。</p>' +
        '<p>一次性抽 8 份批，观测归一化也只做一次，然后依次喂给 8 次更新。</p>' +
        src('算法 1 · 代码 fast_sac_agent.py:413-545, 760-810') },
    { n: 7, part: '§2.1 探索', title: 'σ 上限从 e² 降到 1', sub: '三种探索的动作直方图，当场采样', dur: 13, cam: [0.0, 1.38, 27, [0, 5.2, 0]],
      html: dl([['旧（CleanRL 式）', 'log σ ≤ 2，σ ≤ e² ≈ 7.39'], ['FastSAC（本文）', 'log σ ∈ [−5, 0]，σ ≤ 1；α 初值 0.001'], ['FastTD3', '每个环境从 [0.01, 0.05] 抽噪声标准差'], ['目标熵', '行走 0；跟踪 −29/2']]) +
        '<p>tanh 之前的 σ 很大时，tanh 之后的动作几乎都挤在 ±1，也就是关节一直顶在动作界上，“探索”变成了乱打。再配一个大的 α 初值，熵奖励会继续推着 σ 变大。本文把上限降到 1，α 从 0.001 开始自动调。</p>' +
        '<p>FastTD3 是确定性策略加很小的高斯噪声，探索幅度固定，论文认为这是强随机化下 FastSAC 略好的原因（作者的猜测）。</p>' +
        toyb('μ = 0.3；σ 取各自的上限（e²、1）和 FastTD3 的 0.05；每种 4000 个固定种子样本，直方图 40 格。FastTD3 一段是示意，holosoma 没有它的代码。') +
        src('§2.1 · 代码 algo.py:97-101；fast_sac.py:83-148') },
    { n: 8, part: '§2.2 奖励与课程', title: '10 项奖励，7 项随回合变长而加重', sub: '切换 FastSAC / PPO 的课程预设，比例当场按规则算', dur: 15, cam: [0.0, 1.36, 30, [-1.4, 5.2, 0]],
      html: dl([['正项', '线速度 2、角速度 1.5、抬脚 5、存活 10（PPO 是 1）'], ['惩罚', '姿态 −0.5、两脚过近 −10、脚掌朝向 −5、躯干倾斜 −10、角速度 −1、动作变化率 −2'], ['课程', '均长 < 150 步：×(1 − d)；> 750 步：×(1 + d)'], ['FastSAC', '起点 0.5、下限 0.5、d = 0.001'], ['PPO', '起点 0.1、下限 0、d = 0.00025']]) +
        '<p>每项乘权重再乘 dt = 0.02 s。论文说“少于 10 项”，代码是 10 项；FastSAC 和 PPO 只差存活奖励。</p>' +
        '<p>课程让刚开始还站不稳的机器人不被惩罚压垮：回合够长（> 15 s）以后才慢慢把惩罚加到全权重。从 0.5 到 1.0 要约 693 次“够长”的检查。</p>' +
        toyb('平均回合长度随迭代的曲线是我设的 S 形（约第 3000 次迭代过 750 步），并假设每次迭代检查一次课程。比例按代码规则当场算。') +
        src('§2.2 · 代码 loco/g1/reward.py:99-191；loco/g1/curriculum.py；managers/curriculum/terms/locomotion.py:182-191') },
    { n: 9, part: '§3.1 随机化与地形', title: '一个 20 秒回合里会遇到什么', sub: '切换推搡频率和机器人，看随机化范围', dur: 16, cam: [0.0, 1.0, 33, [-0.5, 2.6, 0]],
      html: dl([['地形', '平地 20%、崎岖 60%、低矮障碍 20%'], ['推搡', '每 5–10 s，最大 1.0 m/s；强推 1–3 s（无预设）'], ['延迟', '0–1 个控制步'], ['PD', 'Kp、Kd ×U(0.9, 1.1)'], ['质量', '连杆 ×U(0.9, 1.2)，基座 +U(−1, 3) kg'], ['摩擦', 'G1 U(0.5, 1.25)；T1 U(0.1, 1.0)'], ['质心', 'G1 ±0.05 m；T1 关闭']]) +
        '<p>论文只列了随机化的名字，范围都在代码里。命令每 10 秒重采，20% 的概率为零（站着不动）。</p>' +
        '<p>图 3 的“强推”在代码里没有现成预设，要自己把推搡间隔改成 [1, 3] 秒。</p>' +
        guess('地形块和推搡时刻用固定种子当场抽，小人是示意。') +
        src('§3.1 · 图 3 图注 · 代码 loco/g1|t1/randomization.py；terrain.py:31-58；loco/g1/command.py') },
    { n: 10, part: '§3.1 时间对账', title: '15 分钟里发生了什么', sub: '图 3 的矢量读数；切换 8 种设置', dur: 15, cam: [0.0, 1.38, 28, [-1.0, 5.4, 0]],
      html: dl([['论文', '单张 RTX 4090，15 分钟，取曲线末端检查点'], ['PR #303 计时', 'RTX 5090、Isaac Sim：每次迭代 0.0914 s'], ['估算', '15 分钟 ≈ 9850 次迭代 ≈ 4030 万条转移 ≈ 224 小时经验'], ['预设', '50000 次迭代 ≈ 76 分钟（同一计时）']]) +
        '<p>曲线是原文图 3 的矢量读数（重画）。右侧的迭代数按 PR #303 在 RTX 5090 上的计时推算，硬件、仿真器（论文推测是 Isaac Gym）、代码版本都和论文不同，只是估算。</p>' +
        '<p>同一 PR 里 PPO 每个环境步 0.064 s，比 FastSAC 的 0.091 s 快约 1.4 倍：PPO 在同样的时间里拿到的数据反而更多，离策略赢在每条数据用 16 次。</p>' +
        src('图 3 · 精读页表 3 · 仓库 PR #303') },
    { n: 11, part: '部署', title: '从检查点到 MuJoCo，再到真机', sub: '切换 sim2sim 和 sim2real；同一个 run_policy.py', dur: 14, cam: [0.15, 1.12, 31, [0.5, 1.6, 0]],
      html: dl([['导出', '训练时存 .pt 和 ONNX；eval_agent.py --training.export_onnx=True'], ['sim2sim', 'run_sim.py robot:g1-29dof ＋ run_policy.py inference:g1-29dof-loco --task.interface lo'], ['sim2real G1', '网线直连，笔记本 192.168.123.224，遥控器 L2+R2'], ['sim2real T1', '笔记本 192.168.10.10，原厂遥控器 RT+Y 进 PREP'], ['已发布', 'G1、T1 的 FastSAC 和 PPO 行走 ONNX；G1 跳舞 ONNX']]) +
        '<p>sim2sim 时，MuJoCo 扮演机器人，通过和真机相同的 SDK 消息（DDS）和策略进程通信，所以同一条命令只换网卡就能上真机。机器人先挂在吊架上：按 8 放下、9 撤掉吊架，策略终端按 ] 启动、= 进入行走。</p>' +
        '<p>论文没有写部署流程，这一幕全部来自仓库文档。</p>' + src('代码 src/holosoma_inference/docs/workflows/sim-to-sim-locomotion.md、real-robot-locomotion.md') }
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
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.3, phi: 1.0, dist: 24, maxDist: 160, minDist: 3 }); }
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
    return t => { if (t === st.t) return; if (st.s) { G.remove(st.s); L.dispose(st.s); LABS = LABS.filter(x => x !== st.s); } st.t = t; st.s = lab(t, pos, o); G.add(st.s); };
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BALL = new THREE.SphereGeometry(1, 12, 9), CUBE = new THREE.BoxGeometry(1, 1, 1);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: 0.6 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
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
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.6, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  function ribbon(G, n, color, w = 0.06, o = {}) {
    const pos = new Float32Array(n * 6), idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: o.opacity ?? 1 })); m.frustumCulled = false; m.renderOrder = o.order ?? 2; G.add(m);
    m.userData.set = pts => { const k = Math.max(1, Math.min(n, pts.length)); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)], z = q[2] ?? 0; pos[i * 6] = q[0]; pos[i * 6 + 1] = q[1] - w / 2; pos[i * 6 + 2] = z; pos[i * 6 + 3] = q[0]; pos[i * 6 + 4] = q[1] + w / 2; pos[i * 6 + 5] = z; } g.attributes.position.needsUpdate = true; };
    return m;
  }
  function panel(G, x, y, z, w, h) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x0c1220, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }
  /* axes for a flat chart in the x-y plane */
  function axes(G, x0, y0, w, h, z, o = {}) {
    panel(G, x0 - 0.3, y0 - 0.3, z - 0.02, w + 0.6, h + 0.6);
    wire(G, [[x0, y0 + h, z], [x0, y0, z], [x0 + w, y0, z]], 0x9aa6bf, { opacity: 0.9 });
    (o.yt || []).forEach(([v, t]) => { const y = y0 + v * h; wire(G, [[x0, y, z], [x0 + w, y, z]], 0x4a5878, { opacity: 0.35 }); if (t != null) G.add(lab(t, [x0 - 0.55, y, z], { size: 15, bg: false, color: '#9aa6bf' })); });
    (o.xt || []).forEach(([v, t]) => { const x = x0 + v * w; G.add(lab(t, [x, y0 - 0.45, z], { size: 15, bg: false, color: '#9aa6bf' })); });
  }
  /* a column of bars (instanced unit cubes scaled in y) */
  function bars(G, n, w, d, color) { const im = inst(CUBE, n); im.material.color.setHex(0xffffff); G.add(im); for (let i = 0; i < n; i++) colI(im, i, hex3(color)); return im; }
  function setBar(im, i, x, y0, h, z, w, d, c) { const hh = Math.max(0.001, Math.abs(h)); setI(im, i, [x, y0 + (h >= 0 ? hh / 2 : -hh / 2), z], [w, hh, d]); if (c) colI(im, i, c); }
  /* a simple capsule humanoid */
  function bot(color) {
    const G = new THREE.Group(), m = L.mat(color, { roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.5, 10), m); body.position.y = 1.0; G.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 9), m); head.position.y = 1.38; G.add(head);
    const legs = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * 0.09, 0.75, 0); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.72, 8), m); c.position.y = -0.36; g.add(c); G.add(g); return g; });
    const arms = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * 0.22, 1.2, 0); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.45, 8), m); c.position.y = -0.22; g.add(c); G.add(g); return g; });
    G.userData.walk = ph => { legs[0].rotation.x = 0.45 * Math.sin(ph); legs[1].rotation.x = -0.45 * Math.sin(ph); arms[0].rotation.x = -0.35 * Math.sin(ph); arms[1].rotation.x = 0.35 * Math.sin(ph); };
    return G;
  }

  function buildCtl() {
    const box = $('ctl'); box.innerHTML = ''; box.hidden = true; if (!api) return;
    (api.ctls || []).forEach((c, gi) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-g="${gi}" data-k="${k}" aria-pressed="${c.get() === k}">${t}</button>`).join('');
      box.appendChild(row); box.hidden = false;
    });
  }
  function syncCtl() { (api?.ctls || []).forEach((c, gi) => { $('ctl').querySelectorAll(`button[data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(c.get() === +b.dataset.k))); }); }

  /* ---------- scene 1: overview loop ---------- */
  function s1(G) {
    const envs = inst(CUBE, 64); G.add(envs);
    for (let i = 0; i < 64; i++) { setI(envs, i, [-12 + (i % 8) * 0.62, 0.25, -2.2 + Math.floor(i / 8) * 0.62], [0.45, 0.45, 0.45]); colI(envs, i, hex3(COL.env)); } done(envs);
    const envPick = block(5.2, 0.1, 5.2, COL.env, [-9.83, 0.0, -0.03], { opacity: 0.25 }); envPick.userData.go = 1; PICKS.push(envPick); G.add(envPick);
    G.add(lab('4096 个并行环境', [-9.8, 2.0, -0.5], { size: 22, color: css(COL.env) }));
    const ring = inst(CUBE, 32); G.add(ring);
    for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; setI(ring, i, [-2.5 + 2.2 * Math.cos(a), 0.4, 2.2 * Math.sin(a)], [0.42, 0.6, 0.42]); colI(ring, i, hex3(COL.buf)); } done(ring);
    const bufPick = block(4.6, 0.1, 4.6, COL.buf, [-2.5, 0.0, 0], { opacity: 0.2 }); bufPick.userData.go = 1; PICKS.push(bufPick); G.add(bufPick);
    G.add(lab('回放缓存\n4096 × 1024 步', [-2.5, 2.3, 0], { size: 21, color: css(COL.buf) }));
    const q1 = block(2.0, 1.0, 1.3, COL.critic, [4.6, 0.6, -1.3]), q2 = block(2.0, 1.0, 1.3, COL.critic, [4.6, 0.6, 0.4]), act = block(2.0, 1.0, 1.3, COL.actor, [8.4, 0.6, -0.45]), al = block(0.8, 0.8, 0.8, COL.alpha, [8.4, 0.5, 1.6]);
    G.add(q1, q2, act, al);
    [[q1, 3], [q2, 3], [act, 2], [al, 6]].forEach(([m, g]) => { m.userData.go = g; PICKS.push(m); });
    G.add(lab('评论家 Q₁ Q₂（C51）', [4.6, 2.0, -0.45], { size: 19, color: css(COL.critic) }), lab('演员 π', [8.4, 2.0, -0.45], { size: 19, color: css(COL.actor) }), lab('α', [8.4, 1.3, 1.6], { size: 17, color: css(COL.alpha) }));
    const pA = [[-7.2, 0.6, 0], [-4.8, 0.6, 0]], pB = [[-0.2, 0.6, 0], [3.4, 0.6, -0.45]], pC = [[9.4, 1.2, -0.45], [9.4, 3.6, -0.45], [-9.8, 3.6, -0.45], [-9.8, 1.0, -0.45]];
    wire(G, pA, COL.env, { opacity: 0.5 }); wire(G, pB, COL.buf, { opacity: 0.5 }); wire(G, pC, COL.actor, { opacity: 0.4, dashed: true });
    const sA = stream(G, 8, COL.env), sB = stream(G, 10, COL.buf), sC = stream(G, 12, COL.actor, 0.12);
    G.add(lab('新转移 4096 条', [-6.0, 0.9, 1.9], { size: 17 }), lab('抽 8 份 × 8192 条', [1.6, 0.9, 1.9], { size: 17 }), lab('策略参数回到环境（同一 GPU 上）', [0, 4.2, -0.45], { size: 17, color: css(COL.actor) }));
    const ticks = dynLab(G, [3.0, -1.4, 2.6], { size: 19 });
    return { update(p) {
      const ph = p * 8 % 1;
      const st = p < 0.2 ? 0 : p < 0.35 ? 1 : p < 0.9 ? 2 : 3;
      for (let i = 0; i < 64; i++) colI(envs, i, hex3(st === 0 ? (((i * 7 + Math.floor(p * 60)) % 5) ? COL.env : COL.white) : COL.env)); done(envs);
      sA(pA, ph, st === 1 ? 1 : 0.3); sB(pB, ph, st === 2 ? 1 : 0.25); sC(pC, ph, st === 3 ? 1 : 0.2);
      const k = st === 2 ? Math.min(7, Math.floor((p - 0.35) / 0.55 * 8)) : -1;
      glow(q1, k >= 0 ? 0.6 + 0.4 * Math.sin(p * 90) ** 2 : 0); glow(q2, k >= 0 ? 0.6 + 0.4 * Math.sin(p * 90) ** 2 : 0);
      glow(act, (k === 1 || k === 5) ? 1 : st === 3 ? 0.6 : 0); glow(al, k >= 0 ? 0.5 : 0);
      ticks(st === 2 ? `第 ${k + 1} / 8 次更新${k === 1 || k === 5 ? '（演员也更新）' : ''}` : st === 0 ? '每个环境走 1 步（50 Hz 的 0.02 s）' : st === 1 ? '存进缓存' : '演员已更新，下一次迭代');
      cap(['① 4096 个环境同时走一步', '② 4096 条新转移写进环形缓存', '③ 从缓存抽 65,536 条，<b>评论家更新 8 次，演员只更新 2 次</b>', '④ 下一次迭代用更新后的演员采样'][st]);
    } };
  }

  /* ---------- scene 2: envs and replay ---------- */
  function s2(G) {
    let ui = +(OPT[0] ?? 2); const US = [2, 4, 8, 16];
    const envs = inst(CUBE, 4096); G.add(envs);
    for (let i = 0; i < 4096; i++) { setI(envs, i, [-13 + (i % 64) * 0.12, 0.05, -3.8 + Math.floor(i / 64) * 0.12], [0.09, 0.09, 0.09]); colI(envs, i, hex3(COL.env)); } done(envs);
    G.add(lab('4096 个环境', [-9.2, 1.4, -4.2], { size: 21, color: css(COL.env) }));
    const R = 16, C = 64, X0 = -2.5, Z0 = -3.6, DX = 0.22, DZ = 0.46;
    const cells = inst(CUBE, R * C); G.add(cells);
    G.add(lab('缓存：每行一个环境，共 1024 步（每格 16 步）', [X0 + C * DX / 2, 1.5, Z0 - 0.7], { size: 19, color: css(COL.buf) }));
    G.add(lab('写指针', [X0, 1.0, Z0 + R * DZ + 0.5], { size: 16 }));
    const ptr = block(0.08, 0.6, R * DZ, COL.warn, [X0, 0.3, Z0 + R * DZ / 2 - DZ / 2]); G.add(ptr);
    const info = dynLab(G, [X0 + C * DX / 2, -0.9, Z0 + R * DZ + 1.2], { size: 19 });
    const ctls = [{ label: '每步更新次数', items: US.map(u => u + ' 次'), get: () => ui, set: k => { ui = k; } }];
    return { ctls, update(p) {
      const U = US[ui], step = Math.floor(p * 1023), col = Math.floor(step / 16), full = p > 0.999 ? C : col + 1;
      ptr.position.x = X0 + col * DX;
      const r = L.rng(1000 + Math.floor(p * 120)), hits = new Set();
      for (let row = 0; row < R; row++) for (let k = 0; k < 2 * U; k++) hits.add(row * C + Math.floor(r() * full));
      for (let row = 0; row < R; row++) for (let c = 0; c < C; c++) {
        const i = row * C + c, filled = c < full, hit = hits.has(i);
        setI(cells, i, [X0 + c * DX, filled ? (hit ? 0.35 : 0.15) : 0.03, Z0 + row * DZ], [DX * 0.8, filled ? (hit ? 0.7 : 0.3) : 0.06, DZ * 0.8]);
        colI(cells, i, hex3(hit ? COL.warn : filled ? COL.buf : COL.dim));
      }
      done(cells);
      for (let i = 0; i < 4096; i++) colI(envs, i, hex3(((i * 13 + step) % 97) < 2 ? COL.white : COL.env)); done(envs);
      info(`每个环境每步抽 2 × ${U} = ${2 * U} 条 · 每步共 ${(2 * U * 4096).toLocaleString('en-US')} 条`);
      cap(`每条转移平均被采样 <b>${2 * U} 次</b>（对称增广后再 ×2）。缓存写满一圈 = 1024 步 ≈ 20.5 s，约一个回合。${U === 8 ? '代码默认。' : U === 16 ? '图 2b 最快的设置。' : ''}`);
    } };
  }

  /* ---------- scene 3: actor and joint-limit-aware bounds ---------- */
  function s3(G) {
    let view = +(OPT[0] ?? 0);
    const LAY = [['观测 98', 98, 0x9aa6bf], ['512', 512, COL.actor], ['256', 256, COL.actor], ['128', 128, COL.actor], ['μ 29', 29, 0xffc27a], ['log σ 29', 29, 0xffc27a]];
    LAY.forEach(([t, d, c], i) => { const h = 0.12 * Math.sqrt(d), x = -14 + (i < 5 ? i : 4) * 1.5, z = i === 5 ? 1.2 : i === 4 ? -0.6 : 0; G.add(block(0.5, h, 0.9, c, [x, 3.2, z], { opacity: 0.85 })); G.add(lab(t, [x, i === 5 ? 3.2 - h / 2 - 0.45 : 3.2 + h / 2 + 0.45, z], { size: 15 })); });
    G.add(lab('LayerNorm + SiLU', [-11.7, 0.9, 0], { size: 15, color: '#9aa6bf' }));
    G.add(lab('tanh × k', [-6.6, 5.4, 0], { size: 17, color: css(COL.actor) }));
    wire(G, [[-7.6, 3.2, -0.3], [-5.6, 3.2, -0.3]], COL.actor, { opacity: 0.8 });
    const X0 = -4.6, W = 18.5, Y0 = 0.6, H = 6.2, Z = 0;
    axes(G, X0, Y0, W, H, Z, {});
    const n = 29, dx = W / n;
    const limIm = bars(G, n, 0, 0, 0x3b4660), reach = bars(G, n, 0, 0, COL.ok), overIm = bars(G, 2 * n, 0, 0, COL.bad), q0m = bars(G, n, 0, 0, COL.white);
    for (let j = 0; j < n; j++) if (j % 3 === 0 || j === 3) G.add(lab(G1.names[j], [X0 + (j + 0.5) * dx, Y0 - 0.5, Z + 0.3], { size: 13, bg: false, color: '#9aa6bf' }));
    const yAx = dynLab(G, [X0 - 0.2, Y0 + H + 0.55, Z], { size: 16 });
    const ctls = [{ label: '画', items: ['限位与可达范围（rad）', 'tanh 乘数 k'], get: () => view, set: k => { view = k; } }];
    const nOver = BOUND.filter(b => b.over > 1e-6).length, mx = BOUND.reduce((a, b, j) => b.over > a.v ? { v: b.over, j } : a, { v: 0, j: 0 });
    return { ctls, update(p) {
      const g = seg(p, 0.05, 0.6);
      const ys = 0.95, yc = Y0 + H / 2 + 0.3;
      for (let j = 0; j < n; j++) {
        const x = X0 + (j + 0.5) * dx, b = BOUND[j], q0 = G1.q0[j];
        if (view === 0) {
          const lo = G1.lo[j], hi = G1.hi[j];
          setBar(limIm, j, x, yc + lo * ys, (hi - lo) * ys, Z + 0.05, dx * 0.7, 0.2);
          const a = q0 - b.m * g, c = q0 + b.m * g;
          setBar(reach, j, x, yc + Math.max(a, lo) * ys, (Math.min(c, hi) - Math.max(a, lo)) * ys, Z + 0.12, dx * 0.32, 0.25);
          setBar(overIm, 2 * j, x, yc + a * ys, Math.max(0, lo - a) * ys, Z + 0.14, dx * 0.32, 0.27);
          setBar(overIm, 2 * j + 1, x, yc + hi * ys, Math.max(0, c - hi) * ys, Z + 0.14, dx * 0.32, 0.27);
          setBar(q0m, j, x, yc + q0 * ys, 0.05, Z + 0.2, dx * 0.6, 0.3);
        } else {
          setBar(limIm, j, x, Y0, 0.001, Z, 0.001, 0.001); setBar(overIm, 2 * j, x, Y0, 0.001, Z, 0.001, 0.001); setBar(overIm, 2 * j + 1, x, Y0, 0.001, Z, 0.001, 0.001); setBar(q0m, j, x, Y0, 0.001, Z, 0.001, 0.001);
          setBar(reach, j, x, Y0, b.k / 13 * H * g, Z + 0.1, dx * 0.6, 0.25);
        }
      }
      done(limIm); done(reach); done(overIm); done(q0m);
      yAx(view === 0 ? '灰：关节限位　绿：可达且合法　红：越过限位　白：默认姿态' : 'k = max(两侧差) / 0.25（tanh 输出的乘数）');
      cap(view === 0 ? `29 个关节里 <b>${nOver}</b> 个的可达范围越过了限位；最多的是${G1.names[mx.j]}，越限 <b>${fmt(mx.v, 3)} rad</b>` : `乘数从 ${fmt(Math.min(...BOUND.map(b => b.k)), 2)}（踝横滚）到 ${fmt(Math.max(...BOUND.map(b => b.k)), 2)}（${G1.names[BOUND.reduce((a, b, j) => b.k > BOUND[a].k ? j : a, 0)]}），差 ${fmt(Math.max(...BOUND.map(b => b.k)) / Math.min(...BOUND.map(b => b.k)), 1)} 倍：同样的 tanh 输出，不同关节动的幅度很不一样`);
    } };
  }

  /* ---------- scene 4: C51 projection (toy) ---------- */
  const C51 = (function () {
    const N = 101, vmin = -20, vmax = 20, dz = (vmax - vmin) / (N - 1), z = Array.from({ length: N }, (_, j) => vmin + j * dz);
    const g = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2);
    let p = z.map(x => 0.65 * g(x, 9, 2.2) + 0.35 * g(x, 3, 1.6)); const sum = p.reduce((a, b) => a + b, 0); p = p.map(v => v / sum);
    const r = 0.6;
    function project(gamma) {
      const out = new Array(N).fill(0);
      z.forEach((zj, j) => { const tz = clamp(r + gamma * zj, vmin, vmax), b = (tz - vmin) / dz, l = Math.floor(b), u = Math.ceil(b); if (l === u) out[l] += p[j]; else { out[l] += p[j] * (u - b); out[u] += p[j] * (b - l); } });
      return out;
    }
    const mean = q => q.reduce((a, v, j) => a + v * z[j], 0);
    return { N, z, p, r, project, mean, P97: project(0.97), P99: project(0.99) };
  })();
  function s4(G) {
    let gi = +(OPT[0] ?? 0);
    const nets = [0, 1].map(k => { const y = 5.6 - k * 2.2; [['输入', 0x9aa6bf, 0.5], ['768', COL.critic, 0.9], ['384', COL.critic, 0.7], ['192', COL.critic, 0.55], ['101', 0x8fe0b0, 0.5]].forEach(([t, c, h], i) => { G.add(block(0.45, h * 1.4, 0.7, c, [-13.4 + i * 1.15, y, 0], { opacity: 0.85 })); if (k === 0) G.add(lab(t, [-13.4 + i * 1.15, y + 1.25, 0], { size: 13 })); }); G.add(lab(`Q${k ? '₂' : '₁'}`, [-14.6, y, 0], { size: 18, color: css(COL.critic) })); });
    const X0 = -7, W = 18, Y0 = 0.7, H = 5.8, Z = 0;
    axes(G, X0, Y0, W, H, Z, { xt: [[0, '−20'], [0.25, '−10'], [0.5, '0'], [0.75, '10'], [1, '20']], yt: [[0, null], [1, null]] });
    G.add(lab('回报 z（101 个原子）', [X0 + W / 2, Y0 - 1.1, Z], { size: 16, bg: false, color: '#9aa6bf' }));
    const nb = bars(G, C51.N, 0, 0, 0x7cb8ff), tb = bars(G, C51.N, 0, 0, COL.critic);
    const mx = Math.max(...C51.p, ...C51.P97, ...C51.P99), hs = H / mx * 0.9, dx = W / (C51.N - 1);
    const xOf = v => X0 + (v + 20) / 40 * W;
    const mk = dynLab(G, [X0 + W - 3.2, Y0 + H + 0.5, Z], { size: 17 });
    const ctls = [{ label: 'γ', items: ['0.97（行走）', '0.99（跟踪）'], get: () => gi, set: k => { gi = k; } }];
    return { ctls, update(p) {
      const gamma = gi ? 0.99 : 0.97, P = gi ? C51.P99 : C51.P97;
      const m1 = seg(p, 0.2, 0.55), m2 = seg(p, 0.6, 0.85);
      for (let j = 0; j < C51.N; j++) {
        const zj = C51.z[j], moved = L.lerp(zj, C51.r + gamma * zj, m1);
        setBar(nb, j, xOf(moved), Y0, C51.p[j] * hs * (1 - m2), Z + 0.05, dx * 0.6, 0.15);
        setBar(tb, j, xOf(zj), Y0, P[j] * hs * m2, Z + 0.1, dx * 0.6, 0.2);
      }
      done(nb); done(tb);
      const E = C51.mean(C51.p), Et = C51.mean(P);
      mk(`E[Z′] = ${fmt(E, 2)}　目标均值 = ${fmt(Et, 2)}`);
      cap(p < 0.2 ? `目标网络在下一状态给出的分布（蓝），均值 ${fmt(E, 2)}` : p < 0.6 ? `每个原子平移、压缩：z → r + γz（r = 0.6，γ = ${gamma}）` : `按距离分给相邻原子（绿）：均值 ${fmt(Et, 2)} = 0.6 + ${gamma} × ${fmt(E, 2)}。评论家用交叉熵去拟合它`);
    } };
  }

  /* ---------- scene 5: three ways to build the target (toy) ---------- */
  const TGT = (function () {
    const r = L.rng(17), N = 400, e1 = [], e2 = [];
    for (let i = 0; i < N; i++) { e1.push(L.gauss(r)); e2.push(L.gauss(r)); }
    const stat = a => { const m = a.reduce((s, v) => s + v - 10, 0) / a.length; return { m, s: Math.sqrt(a.reduce((s, v) => s + (v - 10 - m) ** 2, 0) / a.length) }; };
    const Q = 10;
    const cdq = e1.map((v, i) => Q + Math.min(v, e2[i])), avg = e1.map((v, i) => Q + (v + e2[i]) / 2), own1 = e1.map(v => Q + v), own2 = e2.map(v => Q + v);
    return { N, Q, cdq, avg, own1, own2, S: { cdq: stat(cdq), avg: stat(avg), own: stat(own1.concat(own2)) } };
  })();
  function s5(G) {
    let mode = +(OPT[0] ?? 2);
    const Y0 = 0.6, H = 6, yOf = v => Y0 + (v - 6.5) / 7 * H, cols = [-8, 0, 8];
    const NAMES = ['CDQ：取最小', '论文：取平均', '代码：各用各的'];
    cols.forEach((x, k) => { axes(G, x - 3, Y0, 6, H, 0, {}); G.add(lab(NAMES[k], [x, Y0 + H + 0.7, 0], { size: 19, color: k === 2 ? css(COL.critic) : k === 1 ? css(COL.sac) : '#e6ecf7' })); });
    [7, 10, 13].forEach(v => G.add(lab(String(v), [-11.6, yOf(v), 0], { size: 14, bg: false, color: '#9aa6bf' })));
    cols.forEach(x => wire(G, [[x - 3, yOf(10), 0.05], [x + 3, yOf(10), 0.05]], COL.warn, { opacity: 0.9 }));
    G.add(lab('橙线：真值 Q* = 10　红线：平均目标', [0, Y0 - 1.75, 0], { size: 15, color: css(COL.warn) }));
    const dots = inst(BALL, 3 * TGT.N + TGT.N); G.add(dots);
    const means = [0, 1, 2].map(k => { const b = block(5, 0.06, 0.3, COL.bad, [cols[k], yOf(10), 0.1]); G.add(b); return b; });
    const st = [0, 1, 2].map(k => dynLab(G, [cols[k], Y0 - 0.9, 0], { size: 16 }));
    const ctls = [{ label: '突出', items: NAMES, get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const n = Math.max(1, Math.round(TGT.N * seg(p, 0.05, 0.7))), r = L.rng(5);
      let idx = 0;
      const put = (x, v, c, on) => { setI(dots, idx, [x + (r() - 0.5) * 4.6, yOf(v), 0.15], on ? 0.07 : 0.0001); colI(dots, idx, hex3(c)); idx++; };
      for (let i = 0; i < TGT.N; i++) put(cols[0], TGT.cdq[i], 0xc9d4ea, i < n);
      for (let i = 0; i < TGT.N; i++) put(cols[1], TGT.avg[i], COL.sac, i < n);
      for (let i = 0; i < TGT.N; i++) put(cols[2] - 1.2, TGT.own1[i], COL.critic, i < n);
      for (let i = 0; i < TGT.N; i++) put(cols[2] + 1.2, TGT.own2[i], 0x8fe0b0, i < n);
      done(dots);
      const S = [TGT.S.cdq, TGT.S.avg, TGT.S.own];
      means.forEach((b, k) => { b.position.y = yOf(L.lerp(10, 10 + S[k].m, seg(p, 0.5, 0.8))); b.material.opacity = k === mode ? 1 : 0.4; });
      st.forEach((f, k) => f(`偏差 ${S[k].m >= 0 ? '+' : ''}${fmt(S[k].m, 2)}　标准差 ${fmt(S[k].s, 2)}`));
      cap(['取最小：系统性低估 <b>' + fmt(TGT.S.cdq.m, 2) + '</b>（理论值 −1/√π ≈ −0.56）', '取平均：无偏，噪声降到 <b>' + fmt(TGT.S.avg.s, 2) + '</b>（≈ 1/√2），两个评论家目标相同', '代码：每个评论家学自己的目标，无偏，噪声 <b>' + fmt(TGT.S.own.s, 2) + '</b>；两者独立，像两个 C51 的集成'][mode]);
    } };
  }

  /* ---------- scene 6: order of updates within one iteration ---------- */
  function s6(G) {
    let mode = +(OPT[0] ?? 0), task = +(OPT[1] ?? 0);
    const rowsY = { env: 5.2, critic: 4.0, alpha: 3.0, target: 2.0, actor: 1.0 };
    const NM = { env: ['环境 1 步', COL.env], critic: ['评论家', COL.critic], alpha: ['温度 α', COL.alpha], target: ['目标网络 τ', COL.target], actor: ['演员', COL.actor] };
    Object.entries(rowsY).forEach(([k, y]) => { G.add(lab(NM[k][0], [-13.2, y, 0], { size: 17, color: css(NM[k][1]) })); wire(G, [[-11.6, y, -0.1], [12.5, y, -0.1]], 0x4a5878, { opacity: 0.4 }); });
    const cells = inst(CUBE, 80); G.add(cells);
    const cursor = block(0.06, 5.4, 0.06, COL.warn, [-11, 3.1, 0.3]); G.add(cursor);
    const cnt = dynLab(G, [0.5, -0.4, 0], { size: 19 });
    const ctls = [{ label: '写法', items: ['代码', '算法 1'], get: () => mode, set: k => { mode = k; } }, { label: '任务', items: ['行走（8 次，每 4）', '全身跟踪（4 次，每 2）'], get: () => task, set: k => { task = k; } }];
    return { ctls, update(p) {
      const U = task ? 4 : 8, PF = task ? 2 : 4, x0 = -10.4, slot = 22 / (U + 1);
      let i = 0; const cx = x0 + slot * 0.5; const t = p * (U + 1);
      const put = (x, y, w, c, on) => { setI(cells, i, [x, y, 0], on ? [w, 0.6, 0.6] : [0.0001, 0.0001, 0.0001]); colI(cells, i, hex3(c)); i++; };
      put(cx, rowsY.env, slot * 0.8, COL.env, true);
      let nc = 0, na = 0;
      for (let u = 0; u < U; u++) {
        const x = x0 + slot * (u + 1.5), on = t >= u + 1, act = mode === 1 || (U > 1 && u % PF === 1);
        put(x - slot * 0.25, rowsY.critic, slot * 0.3, COL.critic, true); put(x - slot * 0.05, rowsY.alpha, slot * 0.18, COL.alpha, true);
        put(x + slot * 0.25, rowsY.target, slot * 0.18, COL.target, true); put(x + slot * 0.08, rowsY.actor, slot * 0.3, COL.actor, act);
        if (on) { nc++; if (act) na++; }
      }
      while (i < 80) put(0, -50, 0, COL.dim, false);
      done(cells);
      cursor.position.x = x0 + slot * t;
      cnt(`已做：评论家 ${nc} 次　演员 ${na} 次　每次批 ${task ? '8192' : '16384（含镜像）'} 条`);
      cap(mode === 0 ? `代码：${U} 次评论家更新里演员只在第 ${task ? '1、3' : '1、5'} 次更新（i % ${PF} == 1）` : `算法 1：每次内循环评论家、演员、温度、目标网络都更新一次，共 ${U} 次演员更新`);
    } };
  }

  /* ---------- scene 7: exploration (toy histograms) ---------- */
  const EXP = (function () {
    const r = L.rng(23), N = 4000, eps = Array.from({ length: N }, () => L.gauss(r)), mu = 0.3, B = 40;
    function hist(f) { const h = new Array(B).fill(0); let sat = 0; eps.forEach(e => { const a = clamp(f(e), -1, 1); if (Math.abs(a) > 0.99) sat++; h[Math.min(B - 1, Math.floor((a + 1) / 2 * B))]++; }); return { h: h.map(v => v / N), sat: sat / N }; }
    return { B, old: hist(e => Math.tanh(mu + Math.exp(2) * e)), sac: hist(e => Math.tanh(mu + 1.0 * e)), td3: hist(e => Math.tanh(mu) + 0.05 * e) };
  })();
  function s7(G) {
    const P = [['旧：σ ≤ e²', EXP.old, 0xc9d4ea, -8.6], ['FastSAC：σ ≤ 1', EXP.sac, COL.sac, 0], ['FastTD3：σ ∈ [0.01, 0.05]', EXP.td3, COL.td3, 8.6]];
    const Y0 = 0.8, H = 5.5, W = 7.2;
    const ims = P.map(([t, d, c, x]) => { axes(G, x - W / 2, Y0, W, H, 0, { xt: [[0, '−1'], [0.5, '0'], [1, '+1']] }); G.add(lab(t, [x, Y0 + H + 0.7, 0], { size: 18, color: css(c) })); G.add(lab(`|a| > 0.99：${fmt(d.sat * 100, 1)}%`, [x, Y0 + H - 0.3, 0.2], { size: 15 })); return bars(G, EXP.B, 0, 0, c); });
    const mx = Math.max(...P.map(q => Math.max(...q[1].h)));
    G.add(lab('tanh 之后的动作（乘动作界之前）', [0, Y0 - 1.15, 0], { size: 16, bg: false, color: '#9aa6bf' }));
    return { update(p) {
      const g = seg(p, 0.05, 0.6);
      P.forEach(([, d, , x], k) => { const dx = W / EXP.B; for (let b = 0; b < EXP.B; b++) setBar(ims[k], b, x - W / 2 + (b + 0.5) * dx, Y0, Math.min(H * 0.92, d.h[b] / mx * H * 1.6) * g, 0.05, dx * 0.8, 0.2); done(ims[k]); });
      cap(`σ = e² 时 <b>${fmt(EXP.old.sat * 100, 0)}%</b> 的动作贴在 ±1（关节顶到动作界）；σ = 1 时 ${fmt(EXP.sac.sat * 100, 1)}%；FastTD3 的噪声只在均值附近抖动`);
    } };
  }

  /* ---------- scene 8: rewards and the penalty curriculum ---------- */
  function s8(G) {
    let pre = +(OPT[0] ?? 0);
    const PRE = [{ s0: 0.5, mn: 0.5, d: 0.001, alive: 10 }, { s0: 0.1, mn: 0, d: 0.00025, alive: 1 }];
    const IT = 12000, eplen = it => 80 + 920 / (1 + Math.exp(-(it - 2600) / 500));
    function run(c) { const out = new Float32Array(IT + 1); let s = c.s0; for (let i = 0; i <= IT; i++) { out[i] = s; const L_ = eplen(i); if (L_ < 150) s *= 1 - c.d; else if (L_ > 750) s *= 1 + c.d; s = clamp(s, c.mn, 1); } return out; }
    const SC = PRE.map(run);
    const bc = -9.6, bh = 0.62, btop = 6.5, bs = 0.32;
    panel(G, -16.2, 0.4, -0.05, 10.2, 6.8);
    wire(G, [[bc, 0.6, 0.05], [bc, 7.0, 0.05]], 0x9aa6bf, { opacity: 0.9 });
    const bim = bars(G, 10, 0, 0, COL.ok);
    RW.forEach(([t], i) => G.add(lab(t, [-14.0, btop - i * bh, 0.2], { size: 14, bg: false, color: '#c9d4ea' })));
    G.add(lab('权重 × 课程比例', [-11, 7.6, 0], { size: 15, color: '#9aa6bf' }));
    const X0 = -3.6, W = 16, Y0 = 0.6, H = 6.2;
    axes(G, X0, Y0, W, H, 0, { xt: [[0, '0'], [0.25, '3000'], [0.5, '6000'], [0.75, '9000'], [1, '12000 次迭代']], yt: [[0, '0'], [0.5, '0.5'], [1, '1.0']] });
    const lenR = ribbon(G, 240, 0x7cb8ff, 0.05), scR = ribbon(G, 240, COL.warn, 0.07);
    G.add(lab('平均回合长度 / 1000（玩具）', [X0 + 4.5, Y0 + H + 0.45, 0], { size: 15, color: '#7cb8ff' }), lab('惩罚比例', [X0 + 13.5, Y0 + H + 0.45, 0], { size: 15, color: css(COL.warn) }));
    wire(G, [[X0, Y0 + 0.75 * H, 0.03], [X0 + W, Y0 + 0.75 * H, 0.03]], 0x7cb8ff, { opacity: 0.35, dashed: true });
    wire(G, [[X0, Y0 + 0.15 * H, 0.03], [X0 + W, Y0 + 0.15 * H, 0.03]], 0x7cb8ff, { opacity: 0.35, dashed: true });
    G.add(lab('750', [X0 + W + 0.6, Y0 + 0.75 * H, 0], { size: 13, bg: false, color: '#7cb8ff' }), lab('150', [X0 + W + 0.6, Y0 + 0.15 * H, 0], { size: 13, bg: false, color: '#7cb8ff' }));
    const ctls = [{ label: '课程预设', items: ['FastSAC', 'PPO'], get: () => pre, set: k => { pre = k; } }];
    return { ctls, update(p) {
      const it = Math.round(p * IT), sc = SC[pre], s = sc[it], c = PRE[pre];
      const lp = [], sp = [];
      for (let k = 0; k < 240; k++) { const i = Math.round(k / 239 * it); lp.push([X0 + i / IT * W, Y0 + eplen(i) / 1000 * H, 0.06]); sp.push([X0 + i / IT * W, Y0 + sc[i] * H, 0.08]); }
      lenR.userData.set(lp); scR.userData.set(sp);
      RW.forEach(([, w, cur], i) => { const ww = i === 3 ? c.alive : w, v = ww * (cur ? s : 1), len = Math.max(0.01, Math.abs(v) * bs); setI(bim, i, [bc + (v >= 0 ? len / 2 : -len / 2) + (v >= 0 ? 0 : 0), btop - i * bh, 0.1], [len, bh * 0.6, 0.25]); colI(bim, i, hex3(v >= 0 ? COL.ok : COL.bad)); });
      done(bim);
      const half = sc.findIndex(v => v >= 0.999);
      cap(`第 ${it} 次迭代：惩罚比例 <b>${fmt(s, 3)}</b>。${pre === 0 ? 'FastSAC 从 0.5 起步、不低于 0.5' : 'PPO 从 0.1 起步，回合短时还会继续降'}；到 1.0 ${half >= 0 ? '在第 ' + half + ' 次（玩具）' : '在 12000 次内未到（玩具）'}`);
    } };
  }

  /* ---------- scene 9: terrain and randomization ---------- */
  function s9(G) {
    let push = +(OPT[0] ?? 0), robot = +(OPT[1] ?? 0);
    const r = L.rng(31), tiles = inst(CUBE, 10 * 20), TS = 1.0;
    G.add(tiles);
    const kinds = []; for (let i = 0; i < 200; i++) { const u = r(); kinds.push(u < 0.2 ? 0 : u < 0.8 ? 1 : 2); }
    for (let i = 0; i < 200; i++) { const cx = i % 20, cz = Math.floor(i / 20), k = kinds[i], h = k === 0 ? 0.04 : k === 1 ? 0.06 + 0.12 * r() : 0.04; setI(tiles, i, [-16 + cx * TS + 0.5, h / 2 - 0.05, -5 + cz * TS + 0.5], [TS * 0.96, h, TS * 0.96]); colI(tiles, i, hex3([COL.floor, COL.rough, 0x3b4660][k])); }
    done(tiles);
    const ob = inst(CUBE, 200); G.add(ob); let no = 0;
    for (let i = 0; i < 200; i++) if (kinds[i] === 2) { const cx = i % 20, cz = Math.floor(i / 20); for (let k = 0; k < 3; k++) { setI(ob, no, [-16 + cx + 0.2 + 0.3 * k, 0.07, -5 + cz + 0.3 + 0.4 * r()], [0.22, 0.12 + 0.06 * r(), 0.22]); colI(ob, no, hex3(COL.obst)); no++; } }
    for (; no < 200; no++) setI(ob, no, [0, -50, 0], 0.0001); done(ob);
    G.add(lab('平地 20%　崎岖 60%　低矮障碍 20%（玩具抽样）', [-6, 0.6, -6.2], { size: 17 }));
    const b = bot(0xc9d4ea); G.add(b);
    const arrow = new THREE.Group(); G.add(arrow);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), L.mat(COL.bad)); shaft.rotation.z = Math.PI / 2; arrow.add(shaft);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 10), L.mat(COL.bad)); head.rotation.z = -Math.PI / 2; head.position.x = 0.75; arrow.add(head);
    const pushes = [[], []]; [[5, 10], [1, 3]].forEach(([a, c], k) => { const rr = L.rng(41 + k); let t = a + (c - a) * rr(); while (t < 20) { pushes[k].push(t); t += a + (c - a) * rr(); } });
    const tl = dynLab(G, [-6, 3.4, -4.5], { size: 18 });
    const DR = [['摩擦', [0.5, 1.25], [0.1, 1.0], 0, 2], ['连杆质量 ×', [0.9, 1.2], [0.9, 1.2], 0, 2], ['基座加质量 kg', [-1, 3], [-1, 3], -2, 4], ['质心 m', [-0.05, 0.05], null, -0.1, 0.1], ['Kp ×', [0.9, 1.1], [0.9, 1.1], 0, 2]];
    const drIm = bars(G, DR.length, 0, 0, COL.warn);
    const px0 = 9.2, pw = 5.0, pz = 0;
    panel(G, px0 - 3.6, 0.9, pz - 0.05, pw + 4.0, 4.6);
    DR.forEach(([t], i) => G.add(lab(t, [px0 - 1.9, 4.8 - i * 0.75, pz + 0.1], { size: 14, bg: false, color: '#c9d4ea' })));
    const drLab = dynLab(G, [px0 - 1.1 + pw / 2, 6.0, pz], { size: 16 });
    const ctls = [{ label: '推搡', items: ['每 5–10 s（预设）', '每 1–3 s（强推）'], get: () => push, set: k => { push = k; } }, { label: '机器人', items: ['G1', 'T1'], get: () => robot, set: k => { robot = k; } }];
    return { ctls, update(p) {
      const T = p * 20, x = -15 + T * 0.85, PS = pushes[push];
      b.position.set(x, 0.05, 0.4 + 0.25 * Math.sin(T * 0.7)); b.userData.walk(T * 7);
      const last = PS.filter(t => t <= T).pop(), since = last == null ? 9 : T - last;
      arrow.visible = since < 0.5; arrow.position.set(x - 1.4, 1.1, b.position.z); b.rotation.z = since < 0.5 ? 0.18 * (1 - since / 0.5) : 0;
      tl(`t = ${fmt(T, 1)} s / 20 s　已推 ${PS.filter(t => t <= T).length} 次（本回合共 ${PS.length} 次）`);
      DR.forEach(([, g1, t1, a, c], i) => { const rg = robot ? t1 : g1, xa = rg ? px0 + (rg[0] - a) / (c - a) * pw : px0, xb = rg ? px0 + (rg[1] - a) / (c - a) * pw : px0 + 0.001; setI(drIm, i, [(xa + xb) / 2, 4.8 - i * 0.75, pz + 0.05], [Math.max(0.02, xb - xa), 0.3, 0.1]); colI(drIm, i, hex3(rg ? COL.warn : COL.dim)); });
      done(drIm);
      drLab(robot ? 'T1：摩擦 0.1–1.0，质心关闭' : 'G1：摩擦 0.5–1.25，质心 ±0.05');
      cap(push ? '强推：每 1–3 s 推一次，20 s 里约 ' + PS.length + ' 次。图 3 里 G1 的 PPO 在这种设置下前 10 分钟几乎学不起来' : '预设：每 5–10 s 推一次（最大 1.0 m/s）。命令每 10 s 重采，20% 概率为零');
    } };
  }

  /* ---------- scene 10: the 15-minute ledger (Fig. 3 vector readings) ---------- */
  function s10(G) {
    let pi = +(OPT[0] ?? 1);
    const X0 = -14, W = 14, Y0 = 0.7, H = 6.4;
    axes(G, X0, Y0, W, H, 0, { xt: [[0, '0'], [1 / 3, '5'], [2 / 3, '10'], [1, '15 min']], yt: [[0, '0'], [0.2, '5'], [0.4, '10'], [0.6, '15'], [0.8, '20'], [1, '25']] });
    const keys = ['sac', 'td3', 'ppo'], cols = [COL.sac, COL.td3, COL.ppo], NMS = ['FastSAC', 'FastTD3', 'PPO'];
    const rib = keys.map((k, i) => ribbon(G, 120, cols[i], 0.09, { order: 3 + i }));
    const vl = keys.map((k, i) => dynLab(G, [7.0, Y0 + H - i * 0.85, 0], { size: 16, color: css(cols[i]) }));
    const cur = block(0.04, H, 0.04, COL.warn, [X0, Y0 + H / 2, 0.1]); G.add(cur);
    const title = dynLab(G, [X0 + W / 2, Y0 + H + 0.6, 0], { size: 19 });
    const L2 = [dynLab(G, [7.0, 3.1, 0], { size: 16 }), dynLab(G, [7.0, 2.3, 0], { size: 16 }), dynLab(G, [7.0, 1.5, 0], { size: 16 }), dynLab(G, [7.0, 0.7, 0], { size: 16 })];
    panel(G, 2.2, 0.1, -0.1, 9.6, 7.4);
    G.add(lab('估算（PR #303，RTX 5090，Isaac Sim）', [7.0, 3.95, 0], { size: 15, color: css(COL.warn) }));
    const ctls = [{ label: '设置', items: F3N, get: () => pi, set: k => { pi = k; } }];
    return { ctls, update(p) {
      const t = 15 * seg(p, 0.02, 0.85), D = F3[pi];
      keys.forEach((k, i) => { const P = D[k], pts = []; for (let j = 0; j < 120; j++) { const tt = t * j / 119; pts.push([X0 + tt / 15 * W, Y0 + interp(P, tt) / 25 * H, 0.05 + i * 0.01]); } rib[i].userData.set(pts); const f = firstAt(P, 15); vl[i](`${NMS[i]} ${fmt(interp(P, t), 1)}　到 15：${f != null ? fmt(f, 1) + ' min' : '未到'}`); });
      cur.position.x = X0 + t / 15 * W;
      title(`${F3N[pi]}（图 3 矢量读数，重画）`);
      const it = t * 60 / 0.0914, tr = it * 4096;
      L2[0](`t = ${fmt(t, 1)} min`); L2[1](`≈ ${Math.round(it).toLocaleString('en-US')} 次迭代`); L2[2](`≈ ${fmt(tr / 1e6, 1)} M 条转移`); L2[3](`≈ ${fmt(tr * 0.02 / 3600, 0)} 小时机器人经验`);
      const s15 = firstAt(D.sac, 15), p15 = firstAt(D.ppo, 15);
      cap(`${F3N[pi]}：FastSAC ${s15 != null ? fmt(s15, 1) + ' 分钟' : '15 分钟内未'}到 15 分，PPO ${p15 != null ? fmt(p15, 1) + ' 分钟' : '15 分钟内没到'}${s15 && p15 ? '，比值 ' + fmt(p15 / s15, 1) : ''}。右侧数字是估算，不是论文的数`);
    } };
  }

  /* ---------- scene 11: deployment ---------- */
  function s11(G) {
    let mode = +(OPT[0] ?? 0);
    const B = (t, c, x, y, z, w = 3.4) => { const m = block(w, 1.0, 1.2, c, [x, y, z], { opacity: 0.85 }); G.add(m); G.add(lab(t, [x, y + 1.15, z], { size: 16 })); return m; };
    const tr = B('train_agent.py\nIsaac Sim / MJWarp', COL.critic, -11, 1.0, 0, 3.6), pt = B('model_*.pt', 0x9aa6bf, -6.2, 1.0, 0, 2.4), ox = B('policy.onnx', COL.actor, -2.2, 1.0, 0, 2.4);
    const rp = B('run_policy.py\n50 Hz', COL.actor, 3.2, 1.0, 0, 3.0);
    const sim = B('run_sim.py\nMuJoCo + 桥接', 0x7cb8ff, 10, 1.0, -2.2, 3.4);
    const rb = bot(0xc9d4ea); rb.position.set(10, 0, 2.4); rb.scale.setScalar(1.6); G.add(rb);
    const sb = bot(0x7cb8ff); sb.position.set(13.4, 0, -2.2); sb.scale.setScalar(1.3); G.add(sb);
    const gant = new THREE.Group(); G.add(gant);
    [[-0.9, 0], [0.9, 0]].forEach(([dx]) => { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.6, 8), L.mat(0x9aa6bf)); post.position.set(10 + dx, 1.8, 2.4); gant.add(post); });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.08), L.mat(0x9aa6bf)); beam.position.set(10, 3.6, 2.4); gant.add(beam);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 6), L.mat(0xeef2fa)); gant.add(rope);
    const rl = lab('G1 / T1 真机', [10, -0.6, 2.4], { size: 16 }); G.add(rl);
    const p1 = [[-9.2, 1.0, 0], [-7.4, 1.0, 0]], p2 = [[-5.0, 1.0, 0], [-3.4, 1.0, 0]], p3 = [[-1.0, 1.0, 0], [1.7, 1.0, 0]];
    const pSim = [[4.7, 1.0, 0], [8.3, 1.0, -2.2]], pReal = [[4.7, 1.0, 0], [8.8, 1.6, 2.4]];
    [p1, p2, p3].forEach(q => wire(G, q, 0x9aa6bf, { opacity: 0.6 }));
    const wS = wire(G, pSim, 0x7cb8ff, { opacity: 0.6 }), wR = wire(G, pReal, 0xc9d4ea, { opacity: 0.6 });
    const sA = stream(G, 6, COL.critic, 0.1), sP = stream(G, 10, COL.actor, 0.1), sQ = stream(G, 10, 0x7cb8ff, 0.1);
    const ifl = dynLab(G, [4.2, -0.9, 0], { size: 15 });
    const STEPS = mode => mode === 0 ? ['MuJoCo 窗口按 8：放下吊架', '按 9：撤掉吊架', '策略终端按 ]：启动策略', '按 =：进入行走，wasd / qe 给速度'] : ['机器人挂在吊架上，进入阻尼模式', 'G1：遥控器 L2+R2 进开发模式（T1：RT+Y 进 PREP）', '按 A（或 ]）启动策略', '按 Start（或 =）进入行走'];
    const ctls = [{ label: '去向', items: ['sim2sim（MuJoCo）', 'sim2real（真机）'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const ph = p * 6 % 1;
      sA(p1.concat(p2, p3), p * 2 % 1, p < 0.3 ? 1 : 0.25);
      const live = p > 0.3;
      sP(mode ? pReal : pSim, ph, live ? 1 : 0); sQ(mode ? pReal.slice().reverse() : pSim.slice().reverse(), (ph + 0.5) % 1, live ? 0.7 : 0);
      wS.material.opacity = mode ? 0.12 : 0.7; wR.material.opacity = mode ? 0.7 : 0.12; sim.material.opacity = mode ? 0.25 : 0.85;
      const k = Math.min(3, Math.floor(clamp((p - 0.3) / 0.7, 0, 0.999) * 4));
      /* sim2real: the robot hangs from the gantry, is lowered at step 3 and walks at step 4; sim2sim: the MuJoCo robot does the same in miniature */
      const hang = 0.45 * (1 - seg(p, 0.5, 0.62));
      rb.visible = mode === 1; rl.visible = mode === 1; gant.visible = mode === 1 && p < 0.7; sb.visible = mode === 0;
      rb.position.y = hang; rope.scale.y = Math.max(0.01, 3.6 - (hang + 2.6)); rope.position.set(10, 3.6 - rope.scale.y / 2, 2.4);
      sb.position.y = 0.45 * (1 - seg(p, 0.5, 0.62));
      sb.userData.walk(k === 3 ? p * 40 : 0); rb.userData.walk(k === 3 ? p * 40 : 0);
      ifl(mode ? '--task.interface eth0（连机器人的网卡）' : '--task.interface lo（同一台机器）');
      cap(p < 0.3 ? '训练时 .pt 和 ONNX 一起存；也可以用 eval_agent.py 导出' : `${k + 1}. ${STEPS(mode)[k]}`);
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
  window.__hs15Debug = { BOUND, C51, TGT, EXP, get cap() { return $('cap').textContent; } };
})();
