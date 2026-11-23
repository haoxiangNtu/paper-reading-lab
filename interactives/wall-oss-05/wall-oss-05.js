'use strict';
/* "Wall-OSS-0.5 Technical Report" (arXiv 2605.30877) taken apart into eleven scenes.
   Model sizes, noise schedule and action layout come from X-Square-Robot/wall-x at commit ce2a1ae and the HF
   x-square-robot/wall-oss-0.5 config. Bars in scenes 6, 10 and 11 are the paper's Fig. 10 and Tables 4-9; scene 7's
   right chart is a pixel reading of Fig. 11. Each scene's update(p) is a pure function of the timeline p plus the
   current toggles. Scenes 5, 8 and 9 compute toy numbers on load; they are labelled as toys. No network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { vl: 0x9d8cff, act: 0xf0963c, mm: 0x4fc98a, ar: 0xd45fa0, self: 0x3a8ee8, open: 0xe86a9a, warn: 0xf2c14e, bad: 0xe05d5d, dim: 0x46506a, white: 0xeef2fa, seen: 0x3aa8e0, unseen: 0xe8607d, pi: 0x4fc98a, dz: 0xc9a14e, qwen: 0x9aa6bf, img: 0x38d1ff, txt: 0xc9d4ea, prop: 0x7cb8ff, pad: 0x3a4258, sys: 0x6b7794 };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const fmt = (x, d = 1) => x.toFixed(d);

  /* ---------- real data (paper tables) ---------- */
  const CK = ['50k', '100k', '200k', '300k', '350k', '400k'];
  /* Table 5 / 6: [name, category, seen, values at the six checkpoints] */
  const ZS = [['方块分拣', 'Sem', 1, [46, 85, 87.5, 51.5, 96, 100]], ['水果分拣', 'Sem', 1, [41, 19, 81, 61, 61, 96]], ['数字排序', 'Sem', 1, [45, 65, 32, 60, 56, 54]], ['按开关', 'Sem', 1, [7, 18, 46, 30, 38, 55]],
    ['套圈', 'Rigid', 1, [18, 18, 51, 73, 100, 86]], ['放杯子', 'Rigid', 1, [48, 70, 63, 58, 56, 64]], ['叠毛巾', 'Def', 1, [9, 8, 11.5, 10, 10, 10]], ['摆餐桌', 'Def', 1, [6, 15, 8, 10, 10, 9]],
    ['碎纸', 'Def', 1, [28, 10, 23, 12, 18, 18]], ['插充电器', 'Fine', 1, [5, 2, 2, 6, 6, 9]], ['插花', 'Long', 1, [30, 34.5, 37.5, 54.5, 57, 51]], ['包裹分拣', 'Long', 1, [29.75, 36.25, 39.25, 58.5, 68.75, 48.5]],
    ['玩具进篮', 'Sem', 0, [45, 71, 66, 60, 72, 58]], ['拉紧绳子', 'Def', 0, [26, 30, 54, 60, 62, 82]], ['倒豆子', 'Def', 0, [12, 50, 19, 13, 50, 60]], ['擦桌子', 'Rigid', 0, [38, 36, 32, 26, 28, 38]], ['盖锅盖', 'Rigid', 0, [0, 18, 23, 15, 26, 30]]];
  const CAT = { Sem: ['语义', 0x3aa8e0], Rigid: ['刚体', 0x4fc98a], Def: ['柔性', 0xf0963c], Fine: ['精细', 0xe05d5d], Long: ['长程', 0x9d8cff] };
  /* Table 8: [name, manip?, Wall, pi0.5, DreamZero] */
  const FT = [['颜色方块', 1, 96, 42, 27], ['套圈', 1, 91, 60, 27], ['勺子进碗', 1, 80, 43, 54], ['物体进篮', 1, 74.8, 37, 97.8], ['眼镜架', 1, 66, 87, 37], ['杯子三角', 1, 58, 18, 25], ['整理抽屉', 1, 52, 7, 7], ['电源线', 1, 50, 21, 24], ['倒水', 1, 25, 19, 12], ['笔袋', 1, 18.5, 16, 26],
    ['水果篮', 0, 86, 94, 45], ['耳机', 0, 82, 73, 66], ['物体配对', 0, 44.5, 51.5, 13.5], ['形状', 0, 68, 63, 36], ['按钮顺序', 0, 16, 13, 3]];
  /* Table 7 */
  const MM = [['RealWorldQA', 59.2, 44.2], ['ERQA', 38.3, 32.8], ['EO-Bench', 20.8, 24.7], ['具身定位*', 9.0, 30.8], ['Where2Place', 4.0, 15.0]];
  /* Fig. 10 */
  const F10A = [['只用流', 36.68], ['梯度截断', 31.93], ['截断→联合', 49.58], ['联合训练', 57.00]];
  const F10B = [['1 任务 只用流', 63.00], ['1 任务 联合', 82.00], ['5 任务 只用流', 62.16], ['5 任务 联合', 73.96]];
  /* Fig. 11, pixel reading (labelled points copied): steps 10k..35k */
  const F11 = { act: [67.8, 89.5, 95.7, 96.3, 96.1, 95.9], vel: [73.2, 88.0, 81.7, 88.0, 88.0, 90.3] };
  /* Fig. 4 open-source subsets */
  const OS = [['AgiBotWorld Beta', 24.6], ['RoboMIND v2.0', 21.7], ['Fractal', 12.3], ['RealOmin', 10.9], ['DROID', 10.7], ['RoboCOIN', 7.3], ['RoboMIND v1', 3.8], ['RoboChallenge', 3.6], ['BRIDGE v2', 2.7], ['Galaxea', 2.4]];
  /* 26-d action layout from HF config.yml dof_config */
  const DOF = [['左臂位置', 3, 0x3aa8e0], ['左臂 6D 旋转', 6, 0x7cb8ff], ['左夹爪', 1, 0x38d1ff], ['右臂位置', 3, 0xf0963c], ['右臂 6D 旋转', 6, 0xf2b26b], ['右夹爪', 1, 0xf2c14e], ['底盘速度', 3, 0x4fc98a], ['升降', 1, 0x9d8cff], ['头部', 2, 0xd45fa0]];
  const EMB = [
    { n: '双臂移动（预训练布局）', use: [['左臂位置', 3, 0x3aa8e0], ['左臂 6D 旋转', 6, 0x7cb8ff], ['左夹爪', 1, 0x38d1ff], ['右臂位置', 3, 0xf0963c], ['右臂 6D 旋转', 6, 0xf2b26b], ['右夹爪', 1, 0xf2c14e], ['底盘速度', 3, 0x4fc98a], ['升降', 1, 0x9d8cff], ['头部', 2, 0xd45fa0]], src: 'HF config.yml dof_config' },
    { n: '双臂桌面（ManipArena 示例）', use: [['左臂位置', 3, 0x3aa8e0], ['左臂 6D 旋转', 6, 0x7cb8ff], ['左夹爪', 1, 0x38d1ff], ['右臂位置', 3, 0xf0963c], ['右臂 6D 旋转', 6, 0xf2b26b], ['右夹爪', 1, 0xf2c14e], ['填充', 6, 0]], src: 'workspace/example/maniparena_example.yml:33-40' },
    { n: 'LIBERO 单臂（示例）', use: [['右臂位置', 3, 0xf0963c], ['右臂欧拉 ZYX', 3, 0xe05d5d], ['右夹爪', 1, 0xf2c14e], ['填充', 19, 0]], src: 'workspace/example/libero.yml:32-37' }];

  const SCENES = [
    { n: 1, part: '总览', title: '预训练一次，检查点直接上真机', sub: '三种数据 → 一个 MoT 模型 → 三个损失；部署只走连续通路', dur: 15, cam: [0.0, 1.36, 28, [0, 6.4, 0]],
      html: dl([['模型', 'Qwen2.5-VL-3B 起步，加动作专家，共约 4.16B 参数'], ['数据', '自采约 60%、开源 10 个子集约 40%；多模态 9000 万（含 1200 万具身桥接）'], ['损失', 'L_flow + 0.01·L_act-CE + 0.01·L_mm-CE，单阶段'], ['部署', '离散通路不解码；动作专家 10 步去噪出 32 帧动作块']]) +
        '<p>论文的问题是：预训练出来的检查点，不微调能不能直接当策略用。答案是部分能：17 个真机任务 400k 步平均任务进度 51.1，6 个任务 ≥ 60。微调后 15 个任务平均 60.5，π0.5 是 43.0。</p>' +
        '<p>点画面里的方块跳到对应那一幕。</p>' + guess('方块大小不按参数量画；小球的流动只是示意。') + src('§1、§2、图 1、图 2') },
    { n: 2, part: '§2.2.3 动作空间', title: '26 维统一动作空间，不够的维度补零', sub: '切换具身，看每一维放的是什么', dur: 12, cam: [0.0, 1.38, 26, [0, 6.6, 0]],
      html: dl([['每只手臂', '相对末端位置 3 + 相对 6D 旋转 6 + 夹爪 1'], ['两臂', '20 维'], ['移动部分', '底盘速度 3 + 升降 1 + 头部 2'], ['合计', '(3 + 6 + 1) × 2 + 3 + 1 + 2 = 26'], ['时域', '1 秒；HF 配置 32 帧']]) +
        '<p>6D 旋转避开欧拉角和四元数的不连续和歧义。所有数据源先统一到 x 前、y 左、z 上，零旋转是夹爪朝前、开口水平，夹爪值越大开得越大。</p>' +
        '<p>微调时不足 26 维的具身用 <code>action_padding</code> 补零，填充维靠 dof_mask 不进损失。按示例注释，补零是“右侧填充”：LIBERO 的 7 维占的是向量的<b>前 7 个位置</b>，而预训练布局里这几位是左臂位置和左臂旋转的一部分（我的推断）。</p>' +
        src('§2.2.3、§3.1.3 · HF config.yml · workspace/example/libero.yml、maniparena_example.yml') },
    { n: 3, part: '§2.2.3 输入', title: '对话式输入序列和注意力掩码', sub: '离散动作 token 和连续动作 token 互相看不见', dur: 14, cam: [0.0, 1.38, 26, [0, 7.4, 0]],
      html: dl([['格式', '[System] [User] Observation: 相机 ⟨图像⟩ … Instruction: 任务 Proprioception: ⟨本体⟩ [Assistant] ⟨AR⟩ ⟨flow⟩ × N'], ['图像', '每路 448² → 256 个视觉 token'], ['本体', '离散成 512 个桶的文本数字'], ['flow token', '32 个（HF 配置）']]) +
        '<p>掩码规则（mask.py）：整体因果；连续动作行对离散动作预测位置置零；离散动作也看不到后面的连续动作。HF 配置 <code>causal_action_attention_mask: true</code>，所以连续动作 token 之间也是因果的。</p>' +
        '<p>推理时没有离散 token：前缀（图像、指令、本体）只前向一次并缓存 KV，之后 10 步去噪只跑 32 个动作 token。</p>' +
        guess('视觉 token 画成每路 8 块；离散动作 token 的个数论文没给，画 8 个；本体每维占几个文本 token 未核实。掩码是分块示意。') +
        src('§2.1.1、§2.2.3 · data/backends/lerobot/utils.py:356-404 · model/core/attention/mask.py:53-155') },
    { n: 4, part: '§2.1.1 MoT', title: '每一层都分 VL 专家和动作专家，注意力共享', sub: '路由分解，不是梯度隔离；切换“梯度截断”看区别', dur: 14, cam: [0.55, 1.2, 27, [0, 6.8, 0]],
      html: dl([['层数', '36'], ['VL 专家', 'hidden 2048，FFN 11008（原 Qwen2.5-VL）'], ['动作专家', 'hidden 1024，FFN 2048'], ['路由', '按 token 类型：token_types % 2（moe.py:9-26）'], ['注意力', '两个专家的 Q、K、V 拼在同一个序列上算']]) +
        '<p>动作专家生成连续动作时能看到视觉和语言 token，所以流匹配的梯度会经过注意力流回 VL 专家。本文保留这条梯度；π0.5 的“知识隔离”把它截断（代码里也有这个变体 <code>flash_mask_ki</code>，默认不用）。</p>' +
        guess('只画 6 层；FFN 宽度按 11008 : 2048 的比例。箭头只表示方向。') + src('§2.1.1、§5.1、图 2 · HF config.json · model/core/attention/joint.py:788-925') },
    { n: 5, part: '§2.1.2 RVQ', title: '残差向量量化：前几级抓轮廓，后几级补细节', sub: '玩具：切换用几级码本，看重建误差', dur: 13, cam: [0.0, 1.4, 28, [0, 6.0, 0]],
      html: dl([['结构', '编码器 – RVQ – 解码器，在增量动作空间'], ['额外目标', '视觉-动作对齐（对比学习）、下一帧预测、DCT 域重建'], ['用途', '离散 token 只在训练时给 CE；推理不解码'], ['公开代码', '没有这个分词器']]) +
        '<p>RVQ：第一级码本量化原信号，第二级量化第一级剩下的残差，以此类推。每个时间位置得到一串 token q₀…q_k。前面的级数决定大致运动，后面的级数修细节。</p>' +
        '<p>论文没给码本大小、级数和压缩比。同公司的 X-Tokenizer 模型卡写 2048 码 × 4 级、32 帧压成 8 个潜在步，可能就是这个分词器（我的推断）。</p>' +
        toyb('一维曲线、8 个潜在步、每级均匀网格码本（步长逐级减半）都是我设的；误差当场算。') + src('§2.1.2、图 3 · 精读页读者注 12') },
    { n: 6, part: '§2.2.1 / §5.1 配方', title: '三个损失各管一件事；四种训练策略', sub: '切换策略：看哪条梯度被关掉，以及图 10 的结果', dur: 15, cam: [0.0, 1.4, 28, [0, 6.2, 0]],
      html: dl([['动作 token CE', '“梯度桥”：VLM 原生的强信号，把主干推向控制'], ['多模态 CE', '“锚”：保住视觉-语言能力'], ['流匹配', '训练动作专家；作者说早期之后只占主干更新约 5%'], ['权重', 'λ_act = λ_mm = 0.01；动作 : 多模态 = 9 : 1']]) +
        '<p>图 10a（70k 步从 VLM 开训，5 个真机任务）：联合训练 57.00，先截断再联合 49.58，只用流 36.68，梯度截断 31.93。图 10b（微调）：单任务 82.00 对 63.00，5 任务 73.96 对 62.16。</p>' +
        '<p>“约 5%”“方向正相关”“大体正交”在论文里没有图表支持（精读页读者注 7）。</p>' +
        guess('箭头粗细只是示意，不代表梯度大小。') + src('§2.2.1、§5.1、图 10') },
    { n: 7, part: '§2.2.2 动作空间监督', title: '损失放在动作上：等于给高噪声步加权', sub: '左：时间步分布 × 权重；右：图 11 的 LIBERO 曲线', dur: 14, cam: [0.0, 1.4, 28, [0, 5.6, 0]],
      html: dl([['路径', 'A^τ = τA + (1 − τ)ε，τ = 0 是纯噪声'], ['采样', 'u ~ Beta(1.5, 1)，τ = 0.999 (1 − u)'], ['恢复', 'Â = A^τ + (1 − τ) f_θ'], ['等价', '速度损失乘 (1 − τ)²']]) +
        '<p>Beta(1.5, 1) 让约 65% 的样本落在 τ &lt; 0.5（高噪声一半）；再乘 (1 − τ)²，高噪声段被强调两次。作者的理由是机器人动作平滑，整体形状在高噪声段决定。</p>' +
        '<p>图 11：动作损失 20k 步 95.7，速度损失 35k 步 90.3；10k 时速度损失略好（73.2 对 67.8）。</p>' +
        guess('右图是位图读数，标了数的点照抄原图，其余约 ±0.2。') + src('§2.2.2、式 (2)–(6)、§5.2、图 11 · processor.py:288-302 · loader.py:664-692') },
    { n: 8, part: '§3 数据', title: '数据配方：自采 60%、开源 40%、多模态 9 : 1', sub: '切换采样方式：按比例 vs 平方根', dur: 14, cam: [0.0, 1.4, 28, [0, 5.6, 0]],
      html: dl([['每 epoch', '超过一百万条轨迹，约 60% 自采、40% 开源'], ['开源', '10 个子集（图 4）'], ['多模态', '7800 万开源 + 1200 万具身桥接'], ['批构成', '动作 : 多模态 = 9 : 1'], ['采样', '组内 w_i = n_i^p，p = 0.5，另有每组上限']]) +
        '<p>平方根采样把小组的频率抬上来：按比例采样时最大的组占绝大部分预算，p = 0.5 时差距被压缩，但大组仍然最多。</p>' +
        toyb('右边五个组的大小（20000、4000、800、150、30 条）是我设的；份额当场算，没有做“每组上限”。') + src('§3.1.3、§3.2、图 4、表 1') },
    { n: 9, part: '§2.3 推理', title: '前缀算一次，10 步欧拉去噪出一个动作块', sub: '单张 RTX 5090，三路图像：224 约 21 Hz，448 约 15 Hz', dur: 14, cam: [0.0, 1.4, 27, [0, 5.3, 0]],
      html: dl([['步数', 'T = 10，时间点 linspace(0, 1, 11) × 0.999'], ['每步', '只跑 32 个动作 token，前缀 KV 复用'], ['加速', '整个去噪步捕获成 CUDA Graph；RoPE、RMSNorm 等融合成自定义核'], ['结果', '比 PyTorch eager 快 4 倍']]) +
        '<p>去噪步是访存受限的：GPU 核比 CPU 发射还快，GPU 在核之间空等。CUDA Graph 把 CPU 调度移出关键路径。</p>' +
        '<p>公开代码里 CUDA Graph 包装器没有被调用，RMSNorm 也没有对应的 CUDA 核（精读页读者注 14）。</p>' +
        toyb('二维轨迹和噪声是我设的，用“完美速度”积分；eager 的赫兹数按“快 4 倍”反推。') + src('§2.3 · modeling_qwen2_5_vl_act.py:2064-2160 · processor.py:98-116') },
    { n: 10, part: '§4.1 零样本', title: '17 个真机任务，不微调，随预训练变化', sub: '拖进度条走过 6 个检查点；切换着色', dur: 16, cam: [0.0, 1.4, 28, [0, 5.8, 0]],
      html: dl([['任务', '12 个见过 + 5 个没见过（留出的配置）'], ['评分', '任务进度，满分 100，每任务 10 条轨迹'], ['400k', '见过 50.0，没见过 53.6，总体 51.1'], ['≥ 60', '方块 100、水果 96、套圈 86、绳子 82、杯子 64、倒豆 60']]) +
        '<p>没见过的任务和见过的一起上升，作者认为学到的是可复用的操作能力。“没见过”是相对的：开源数据里可能有语义相关的经验。</p>' +
        '<p>柔性和精细任务（叠毛巾、摆餐桌、插充电器）一直在 10 左右。</p>' + src('§4.1、表 2、表 5、表 6、图 6') },
    { n: 11, part: '§4.2 / §4.3 微调与多模态', title: '微调后对比 π0.5 和 DreamZero；多模态得失', sub: '切换：表 8 逐任务 / 表 7 多模态 / 图 7 多任务扩展', dur: 15, cam: [0.0, 1.4, 28, [0, 5.3, 0]],
      html: dl([['微调', '15 个真机任务，每任务约 500 条示范，三家都从官方权重出发'], ['总体', '60.5 / 43.0 / 33.4（差 17.5 和 27.1 个百分点）'], ['多模态', '具身定位 +21.8、Where2Place +11.0、EO-Bench +3.9；RealWorldQA −15.0、ERQA −5.5'], ['多任务', '5 个共享任务 73.96 → 74.75 → 83.75']]) +
        '<p>推理子集 59.3 对 58.9 只差 0.4。图 7 的“9 个分布外任务 65.59”用表 9 重算是 66.50（精读页读者注 5）。</p>' + src('§4.2、§4.3、表 4、表 7、表 8、表 9、图 7、图 8') }
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


  /* ---------- small chart helpers ---------- */
  function hbarRow(G, n, color) { return bars(G, n, 0.5, 0.5, color); }
  function chip(G, text, color, pos, w = 3.2, h = 0.8) { const m = block(w, h, 0.5, color, pos, { opacity: 0.9 }); G.add(m); G.add(lab(text, [pos[0], pos[1] + h / 2 + 0.45, pos[2]], { size: 16, color: css(color) })); return m; }

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    const dS = block(3.6, 1.1, 1.2, COL.self, [-11, 5.0, 0]), dO = block(3.6, 1.1, 1.2, COL.open, [-11, 3.0, 0]), dM = block(3.6, 1.1, 1.2, COL.mm, [-11, 1.0, 0]);
    G.add(dS, dO, dM);
    G.add(lab('自采操作 ≈ 60%', [-11, 5.95, 0], { size: 16, color: css(COL.self) }), lab('开源 10 个子集 ≈ 40%', [-11, 3.95, 0], { size: 16, color: css(COL.open) }), lab('多模态 9000 万', [-11, 1.95, 0], { size: 16, color: css(COL.mm) }));
    [dS, dO, dM].forEach(m => { m.userData.go = 7; PICKS.push(m); });
    const vl = block(3.4, 4.6, 1.6, COL.vl, [-3.4, 3.0, 0], { opacity: 0.85 }), ae = block(1.6, 4.6, 1.6, COL.act, [0.6, 3.0, 0], { opacity: 0.85 });
    const ja = block(6.8, 0.18, 2.0, 0xd0c8ff, [-1.6, 3.0, 0], { opacity: 0.55 });
    G.add(vl, ae, ja); [vl, ae, ja].forEach(m => { m.userData.go = 3; PICKS.push(m); });
    G.add(lab('VL 专家（原 3B）', [-3.6, 0.1, 0.9], { size: 15, color: css(COL.vl) }), lab('动作专家', [1.3, 0.1, 0.9], { size: 15, color: css(COL.act) }), lab('联合注意力', [-1.6, 3.6, 1.1], { size: 14 }));
    const cMM = block(2.0, 0.7, 0.6, COL.mm, [-6.2, 7.2, 0]), cAR = block(2.0, 0.7, 0.6, COL.ar, [-2.4, 7.2, 0]), cFM = block(2.0, 0.7, 0.6, COL.act, [1.6, 7.2, 0]);
    G.add(cMM, cAR, cFM); [cMM, cAR, cFM].forEach(m => { m.userData.go = 5; PICKS.push(m); });
    G.add(lab('多模态 CE\n锚', [-6.2, 8.4, 0], { size: 14, color: css(COL.mm) }), lab('动作 token CE\n梯度桥', [-2.4, 8.4, 0], { size: 14, color: css(COL.ar) }), lab('流匹配\n执行接口', [1.6, 8.4, 0], { size: 14, color: css(COL.act) }));
    const arm = L.arm(0xc9d4ea); arm.position.set(8.2, 0, 0); arm.scale.setScalar(1.0); G.add(arm);
    const table = block(6.5, 0.2, 3.5, 0x2b3650, [9.5, -0.1, 0]); G.add(table);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.7, 18), L.mat(0x7fb8ff)); G.add(cup);
    const armPick = block(3, 0.1, 3, 0x2b3650, [9.5, 0.05, 0], { opacity: 0.01 }); armPick.userData.go = 8; PICKS.push(armPick); G.add(armPick);
    G.add(lab('部署：只走连续通路\n10 步去噪 → 32 帧动作块', [9.6, 6.4, 0], { size: 15 }));
    const pIn = [[[-9.2, 5.0, 0], [-5.1, 4.2, 0]], [[-9.2, 3.0, 0], [-5.1, 3.0, 0]], [[-9.2, 1.0, 0], [-5.1, 1.8, 0]]];
    pIn.forEach(q => wire(G, q, 0x9aa6bf, { opacity: 0.4 }));
    const sIn = [stream(G, 6, COL.self, 0.12), stream(G, 6, COL.open, 0.12), stream(G, 6, COL.mm, 0.12)];
    const gr = [[[-6.0, 6.8, 0], [-4.4, 5.35, 0]], [[-2.4, 6.8, 0], [-2.8, 5.35, 0]], [[1.6, 6.8, 0], [0.8, 5.35, 0]]];
    const gArr = gr.map((q, i) => { const a = L.arrow(q[0], q[1], [COL.mm, COL.ar, COL.act][i]); G.add(a); return a; });
    const pOut = [[1.4, 3.0, 0], [4.8, 3.0, 0], [7.3, 2.6, 0]]; wire(G, pOut, COL.act, { opacity: 0.4 });
    const sOut = stream(G, 10, COL.act, 0.12);
    return { update(p) {
      const ph = p * 6 % 1, st = p < 0.33 ? 0 : p < 0.62 ? 1 : 2;
      sIn.forEach((f, i) => f(pIn[i], ph, st === 0 ? 1 : 0.25));
      gArr.forEach((a, i) => { a.visible = st === 1; a.setLength(1.3, i === 2 ? 0.2 : 0.4, i === 2 ? 0.12 : 0.28); });
      [cMM, cAR, cFM].forEach((m, i) => glow(m, st === 1 ? (i === 2 ? 0.35 : 0.9) : 0.1));
      glow(vl, st === 0 ? 0.4 : st === 1 ? 0.7 : 0.1); glow(ae, st === 2 ? 0.8 : 0.2);
      cAR.material.opacity = st === 2 ? 0.25 : 0.9; cMM.material.opacity = st === 2 ? 0.25 : 0.9;
      sOut(pOut, ph, st === 2 ? 1 : 0);
      const k = seg(p, 0.65, 0.95), tgt = [L.lerp(8.6, 11.4, k), 0.75 + 1.4 * Math.sin(Math.PI * k), L.lerp(-0.8, 0.6, k)];
      arm.userData.reach(st === 2 ? tgt : [8.6, 0.75, -0.8]); cup.position.set(st === 2 ? tgt[0] : 8.6, st === 2 ? tgt[1] - 0.3 + 0.35 : 0.35, st === 2 ? tgt[2] : -0.8);
      cap(['① 三种数据一起进同一个模型（单阶段）：机器人轨迹给动作，多模态样本给语言', '② 三个损失同时回传：两个交叉熵主导主干更新，流匹配训练动作专家（不截断梯度）', '③ 部署：离散通路不用，动作专家 10 步去噪输出连续动作块。<b>不微调</b>就能在 17 个任务上平均 51.1'][st]);
    } };
  }

  /* ---------- scene 2: 26-d action space ---------- */
  function s2(G) {
    let ei = +(OPT[0] ?? 0);
    const W = 0.78, X0 = -10.1;
    const top = inst(CUBE, 26), bot = inst(CUBE, 26); G.add(top, bot);
    let k = 0; DOF.forEach(([nm, d, c], di) => { const x0 = X0 + k * W; G.add(lab(nm, [x0 + (d - 1) * W / 2, di % 2 ? 7.25 : 7.95, 0], { size: 13, color: css(c), bg: false })); for (let j = 0; j < d; j++, k++) { setI(top, k, [X0 + k * W, 6.2, 0], [W * 0.82, 0.7, 0.7]); colI(top, k, hex3(c)); } });
    done(top);
    G.add(lab('预训练\n布局', [X0 - 2.0, 6.2, 0], { size: 15 }), lab('当前\n具身', [X0 - 2.0, 2.4, 0], { size: 15 }));
    for (let i = 0; i < 26; i++) if (i % 5 === 0 || i === 25) G.add(lab(String(i), [X0 + i * W, 5.45, 0], { size: 12, bg: false, color: '#9aa6bf' }));
    const title = dynLab(G, [X0 - 0.2 + 13 * W, 4.1, 0], { size: 15 });
    const segG = EMB.map(E => { const g = new THREE.Group(); let q = 0; E.use.forEach(([nm, d, c], si) => { g.add(lab(c ? `${nm} ${d}` : `填充 ${d}（dof_mask = 0）`, [X0 + (q + (d - 1) / 2) * W, si % 2 ? 0.75 : 1.4, 0], { size: 13, bg: false, color: c ? css(c) : '#9aa6bf' })); q += d; }); G.add(g); return g; });
    const lines = []; for (let i = 0; i < 26; i++) { const l = L.line([[X0 + i * W, 5.75, 0], [X0 + i * W, 3.2, 0]], 0x4a5878, { opacity: 0.18 }); G.add(l); lines.push(l); }
    const srcL = dynLab(G, [X0 - 0.2 + 13 * W, -0.2, 0], { size: 13, color: '#9aa6bf', bg: false });
    const ctls = [{ label: '具身', items: EMB.map(e => e.n), get: () => ei, set: v => { ei = v; } }];
    const pos = {}; { let q = 0; DOF.forEach(([nm, d]) => { pos[nm] = q; q += d; }); }
    return { ctls, update(p) {
      const E = EMB[ei], g = seg(p, 0.1, 0.6);
      let q = 0, si = 0;
      E.use.forEach(([nm, d, c]) => {
        const x0 = X0 + q * W, isPad = !c;
        for (let j = 0; j < d; j++, q++) { const lift = isPad ? 0.08 : 0.7; setI(bot, q, [X0 + q * W, 2.4, 0], [W * 0.82, Math.max(0.05, lift * g), 0.7]); colI(bot, q, hex3(isPad ? COL.pad : c)); }
        si++;
      });
      segG.forEach((g_, i) => { g_.visible = i === ei; });
      done(bot);
      title(`${E.n} · 真实维数 ${E.use.filter(u => u[2]).reduce((a, u) => a + u[1], 0)} / 26`);
      srcL('出处：' + E.src);
      cap(ei === 0 ? '预训练布局：两臂各 10 维（位置 3 + 6D 旋转 6 + 夹爪 1），底盘 3、升降 1、头 2，合计 26' : ei === 1 ? '双臂桌面：前 20 维和预训练布局逐位相同，后 6 维补零，不进损失' : 'LIBERO：7 维（3 位置 + 3 欧拉 + 1 夹爪）放在<b>前 7 位</b>，后 19 维补零。前 7 位在预训练里是左臂位置和左臂旋转（我的推断）');
    } };
  }

  /* ---------- scene 3: sequence and attention mask ---------- */
  function s3(G) {
    let mode = +(OPT[0] ?? 0);
    const SEG = [['系统', 2, COL.sys], ['图像 ×3', 24, COL.img], ['指令', 5, COL.txt], ['本体 26 维', 13, COL.prop], ['离散动作 AR', 8, COL.ar], ['连续动作 ×32', 16, COL.act]];
    const N = SEG.reduce((a, s) => a + s[1], 0), W = 0.34, X0 = -11.4;
    const strip = inst(CUBE, N); G.add(strip);
    const segX = []; { let k = 0; SEG.forEach(([nm, n, c], si) => { segX.push([k, k + n]); for (let j = 0; j < n; j++, k++) { setI(strip, k, [X0 + k * W, 7.6, 0], [W * 0.8, 0.5, 0.5]); colI(strip, k, hex3(c)); } G.add(lab(nm, [X0 + (k - n / 2 - 0.5) * W, si % 2 ? 8.35 : 8.95, 0], { size: 13, color: css(c), bg: false })); }); }
    done(strip);
    /* block mask: rows/cols are segments 0..5; cell value: 0 none, 1 causal block (lower triangle), 2 full */
    const M0 = 5.4, CS = 0.82, MX = -2.0;
    const cells = inst(CUBE, 36); G.add(cells);
    G.add(lab('注意力掩码（行 = 查询，列 = 键；分块示意）', [MX + 2.5 * CS, M0 + 0.55, 0], { size: 15 }));
    SEG.forEach(([nm, , c], i) => { G.add(lab(nm, [MX - 2.4, M0 - i * CS - 0.3, 0], { size: 13, color: css(c), bg: false })); });
    const legend = dynLab(G, [8.0, 1.8, 0], { size: 14 });
    const kv = dynLab(G, [8.0, 4.0, 0], { size: 15 });
    const ctls = [{ label: '阶段', items: ['训练（两条通路都在）', '推理（无离散 token）'], get: () => mode, set: v => { mode = v; } }];
    function val(r, c) {
      if (mode === 1 && (r === 4 || c === 4)) return -1;
      if (c > r) return 0;
      if (r === 5 && c === 4) return 0; /* flow rows cannot see AR predict tokens */
      if (r === c) return 1; return 2;
    }
    return { ctls, update(p) {
      const g = seg(p, 0.15, 0.6);
      for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
        const v = val(r, c), i = r * 6 + c, x = MX + c * CS, y = M0 - r * CS - 0.3;
        const h = v <= 0 ? 0.04 : (v === 1 ? 0.18 : 0.3) * g + 0.04;
        setI(cells, i, [x, y, h / 2], [CS * 0.9, CS * 0.9, h]);
        colI(cells, i, hex3(v === -1 ? 0x1c2233 : v === 0 ? 0x2b3346 : v === 1 ? 0x8fa0c8 : 0x4fc98a));
      }
      done(cells);
      for (let k = 0; k < N; k++) { const inAR = k >= segX[4][0] && k < segX[4][1]; setI(strip, k, [X0 + k * W, 7.6, 0], [W * 0.8, mode === 1 && inAR ? 0.05 : 0.5, 0.5]); }
      done(strip);
      legend('绿：整块可见　浅蓝：块内因果　灰：不可见');
      kv(mode === 0 ? '训练：一次前向，三种损失' : '推理：前缀算 1 次并缓存 KV\n之后 10 步只跑 32 个动作 token');
      const hl = Math.floor(p * 3) % 3;
      cap(mode === 1 ? '推理时不放离散动作 token；连续动作 token 读前缀的缓存，10 步去噪' : ['离散动作行看不到后面的连续动作（右上是灰的，整体因果）', '连续动作行对离散动作那一列<b>置零</b>（mask.py:100-110）：两条通路互不可见', '但连续动作能看到图像、指令、本体，所以流匹配的梯度能经注意力流回 VL 专家'][hl]);
    } };
  }

  /* ---------- scene 4: MoT ---------- */
  function s4(G) {
    let ki = +(OPT[0] ?? 0);
    const NL = 6, DY = 1.55, Y0 = 0.4, xV = -3.0, xA = 3.2, wV = 5.0, wA = 5.0 * 2048 / 11008;
    const lay = [];
    for (let l = 0; l < NL; l++) {
      const y = Y0 + l * DY;
      const fv = block(wV, 0.42, 1.6, COL.vl, [xV, y, 0], { opacity: 0.8 }), fa = block(wA, 0.42, 1.6, COL.act, [xA, y, 0], { opacity: 0.8 });
      const at = block(xA - xV + 2.6, 0.08, 2.0, 0xd0c8ff, [(xV + xA) / 2, y + 0.55, 0], { opacity: 0.35 });
      G.add(fv, fa, at); lay.push([fv, fa, at]);
    }
    G.add(lab('VL 专家 FFN 2048 → 11008', [xV, Y0 + NL * DY + 0.2, 0], { size: 15, color: css(COL.vl) }), lab('动作专家 FFN\n1024 → 2048', [xA + 0.6, Y0 + NL * DY + 0.45, 0], { size: 15, color: css(COL.act) }));
    G.add(lab('共享注意力', [xA + 2.6, Y0 + 2 * DY + 0.55, 0], { size: 13 }), lab('36 层（画 6 层）', [-8.6, Y0 + 2.5 * DY, 0], { size: 15 }));
    const tv = inst(BALL, 8), ta = inst(BALL, 4); tv.material.emissive.setHex(COL.vl); ta.material.emissive.setHex(COL.act); G.add(tv, ta);
    for (let i = 0; i < 8; i++) colI(tv, i, hex3(COL.vl)); for (let i = 0; i < 4; i++) colI(ta, i, hex3(COL.act));
    const links = []; for (let i = 0; i < 4; i++) { const l = L.line([[0, 0, 0], [1, 0, 0]], COL.act, { opacity: 0.5 }); G.add(l); links.push(l); }
    const gArr = L.arrow([xA - 0.8, 7, 0.9], [xV + 2.4, 7, 0.9], COL.warn); G.add(gArr);
    const bar = block(0.25, 2.2, 0.25, COL.bad, [(xV + xA) / 2 + 0.2, 7, 0.9]); G.add(bar);
    const gl = dynLab(G, [(xV + xA) / 2, 12.2, 0.9], { size: 14 });
    G.add(lab('视觉 / 语言 / 本体 / 离散动作', [xV, -0.7, 0], { size: 14, color: css(COL.vl) }), lab('带噪连续动作', [xA, -0.7, 0], { size: 14, color: css(COL.act) }));
    const ctls = [{ label: '梯度', items: ['联合训练（不截断）', '梯度截断（知识隔离）'], get: () => ki, set: v => { ki = v; } }];
    return { ctls, update(p) {
      const up = p < 0.6, t = up ? p / 0.6 : 1;
      const y = Y0 - 0.3 + t * (NL * DY);
      for (let i = 0; i < 8; i++) setI(tv, i, [xV - 2.0 + i * 0.57, y, 0.95], 0.16); done(tv);
      for (let i = 0; i < 4; i++) setI(ta, i, [xA - 0.45 + i * 0.3, y, 0.95], 0.16); done(ta);
      const lv = Math.floor(clamp((y - Y0) / DY, 0, NL - 1));
      lay.forEach(([fv, fa, at], l) => { const on = up && l === lv; glow(fv, on ? 0.7 : 0.05); glow(fa, on ? 0.7 : 0.05); at.material.opacity = on ? 0.75 : 0.3; });
      links.forEach((l, i) => { const a = new THREE.Vector3(xA - 0.45 + i * 0.3, y, 0.95), b = new THREE.Vector3(xV - 2.0 + (i * 2 + 1) * 0.57, y, 0.95); l.geometry.setFromPoints([a, b]); l.visible = up; });
      const back = !up; gArr.visible = back; bar.visible = back && ki === 1;
      gl(back ? (ki ? '流匹配梯度在注意力处被截断：主干只由两个 CE 更新' : '流匹配梯度经共享注意力回到 VL 专家') : '');
      cap(up ? `第 ${Math.round(1 + lv * 7)} 层附近：两类 token 各走自己的 FFN，在同一个注意力里互相看见（连续动作 → 视觉语言）` : ki ? '知识隔离（π0.5 的做法，代码 flash_mask_ki）：保住 VLM，但图 10a 里只有 31.93' : '本文：不截断。图 10a 里联合训练 57.00，是四种策略里最高的');
    } };
  }

  /* ---------- scene 5: RVQ toy ---------- */
  const RVQ = (function () {
    const T = 32, sig = []; for (let t = 0; t < T; t++) sig.push(0.9 * Math.sin(t / T * Math.PI * 1.6) + 0.25 * Math.sin(t / T * Math.PI * 7 + 0.4) + 0.1 * t / T);
    const lat = []; for (let i = 0; i < 8; i++) lat.push((sig[i * 4] + sig[i * 4 + 1] + sig[i * 4 + 2] + sig[i * 4 + 3]) / 4);
    const lv = []; let res = lat.slice(); const codes = [];
    for (let k = 0; k < 4; k++) { const step = 0.5 / Math.pow(2, k); const q = res.map(v => Math.round(v / step) * step); codes.push(q.map(v => Math.round(v / step))); res = res.map((v, i) => v - q[i]); lv.push(q); }
    const rec = k => lat.map((_, i) => { let s = 0; for (let j = 0; j < k; j++) s += lv[j][i]; return s; });
    const up = r => { const o = []; for (let t = 0; t < T; t++) { const x = (t - 1.5) / 4, i = clamp(Math.floor(x), 0, 6), f = clamp(x - i, 0, 1); o.push(r[i] + (r[i + 1] - r[i]) * f); } return o; };
    const err = k => { const r = up(rec(k)); return Math.sqrt(sig.reduce((a, v, t) => a + (v - r[t]) ** 2, 0) / T); };
    return { T, sig, lat, lv, codes, rec, up, err, err0: Math.sqrt(sig.reduce((a, v, t) => a + (v - up(lat)[t]) ** 2, 0) / T) };
  })();
  function s5(G) {
    let K = +(OPT[0] ?? 1);
    const X0 = -12.5, W = 13, Y0 = 3.6, H = 2.2;
    panel(G, X0 - 0.4, Y0 - H - 0.6, -0.05, W + 0.8, 2 * H + 1.3);
    wire(G, [[X0, Y0, 0], [X0 + W, Y0, 0]], 0x4a5878, { opacity: 0.4 });
    const r0 = ribbon(G, RVQ.T, COL.white, 0.07), r1 = ribbon(G, RVQ.T, COL.act, 0.1, { order: 4 });
    r0.userData.set(RVQ.sig.map((v, t) => [X0 + t / (RVQ.T - 1) * W, Y0 + v * H, 0.02]));
    G.add(lab('动作块（32 帧，玩具）', [X0 + W / 2, Y0 + H + 1.1, 0], { size: 15 }));
    const kl = dynLab(G, [X0 + W / 2, Y0 - H - 1.2, 0], { size: 15 });
    /* code grid on the right: 8 latent steps x 4 levels */
    const GX = 3.6, GY = 6.6, CW = 1.05, CH = 0.9;
    const cells = inst(CUBE, 32); G.add(cells);
    G.add(lab('每个潜在步 × 每级一个码', [GX + 3.5 * CW, GY + 1.0, 0], { size: 15 }));
    for (let k = 0; k < 4; k++) G.add(lab(`q${'₀₁₂₃'[k]}`, [GX - 1.0, GY - k * CH, 0], { size: 15, color: css([COL.vl, COL.ar, COL.act, COL.warn][k]), bg: false }));
    const codeL = []; for (let i = 0; i < 32; i++) codeL.push(dynLab(G, [GX + (i % 8) * CW, GY - Math.floor(i / 8) * CH, 0.5], { size: 12, bg: false }));
    const errBars = bars(G, 5, 0.7, 0.4, COL.act); G.add(lab('重建误差（RMS）', [GX + 3.5 * CW, 1.85, 0], { size: 14 }));
    const eL = []; for (let k = 0; k <= 4; k++) { eL.push(dynLab(G, [GX + 0.4 + k * 1.6, -0.75, 0], { size: 12, bg: false })); }
    const ctls = [{ label: '用几级码本', items: ['1 级', '2 级', '3 级', '4 级'], get: () => K - 1, set: v => { K = v + 1; } }];
    return { ctls, update(p) {
      const kk = Math.min(K, 1 + Math.floor(seg(p, 0.05, 0.75) * K));
      const r = RVQ.up(RVQ.rec(kk));
      r1.userData.set(r.map((v, t) => [X0 + t / (RVQ.T - 1) * W, Y0 + v * H, 0.04]));
      for (let i = 0; i < 32; i++) { const k = Math.floor(i / 8), on = k < kk; setI(cells, i, [GX + (i % 8) * CW, GY - k * CH, 0], [CW * 0.85, CH * 0.8, on ? 0.4 : 0.05]); colI(cells, i, hex3(on ? [COL.vl, COL.ar, COL.act, COL.warn][k] : COL.dim)); codeL[i](on ? String(RVQ.codes[k][i % 8]) : ''); }
      done(cells);
      const es = [RVQ.err0].concat([1, 2, 3, 4].map(RVQ.err)), mx = RVQ.err(1);
      for (let k = 1; k <= 4; k++) { const h = 1.6 * es[k] / mx; setBar(errBars, k - 1, GX + 0.4 + (k - 1) * 1.6, 0.0, k <= kk ? h : 0.02, 0, 0.7, 0.4, hex3(k <= kk ? COL.act : COL.dim)); eL[k - 1](`${k} 级\n${fmt(es[k], 3)}`); }
      setBar(errBars, 4, GX + 0.4 + 4 * 1.6, 0, 1.6 * es[0] / mx, 0, 0.7, 0.4, hex3(COL.qwen)); eL[4](`下限\n${fmt(es[0], 3)}`);
      done(errBars);
      kl(`橙色：用前 ${kk} 级码重建（再从 8 个潜在步插值回 32 帧）`);
      cap(kk === 1 ? '第 1 级（步长 0.5）只抓住大致形状：先上后下' : kk === 2 ? '第 2 级量化第 1 级剩下的残差，细节开始出现' : `第 ${kk} 级：误差接近“8 个潜在步本身”的下限 ${fmt(es[0], 3)}；剩下的误差来自时间压缩，不是量化`);
    } };
  }

  /* ---------- scene 6: losses and strategies ---------- */
  function s6(G) {
    let si = +(OPT[0] ?? 3), ph = +(OPT[1] ?? 0);
    const bb = block(4.2, 3.0, 1.5, COL.vl, [-8.5, 2.2, 0], { opacity: 0.85 }), ae = block(2.0, 3.0, 1.5, COL.act, [-4.6, 2.2, 0], { opacity: 0.85 });
    G.add(bb, ae, lab('VLM 主干（VL 专家）', [-8.5, 0.25, 0.9], { size: 14, color: css(COL.vl) }), lab('动作专家', [-4.6, 0.25, 0.9], { size: 14, color: css(COL.act) }));
    const cMM = block(2.0, 0.7, 0.6, COL.mm, [-11.4, 6.8, 0]), cAR = block(2.0, 0.7, 0.6, COL.ar, [-7.9, 6.8, 0]), cFM = block(2.0, 0.7, 0.6, COL.act, [-4.2, 6.8, 0]);
    G.add(cMM, cAR, cFM, lab('多模态 CE', [-11.4, 7.65, 0], { size: 14, color: css(COL.mm) }), lab('动作 CE', [-7.9, 7.65, 0], { size: 14, color: css(COL.ar) }), lab('流匹配', [-4.2, 7.65, 0], { size: 14, color: css(COL.act) }));
    const aMM = L.arrow([-11.2, 6.4, 0.3], [-9.8, 3.8, 0.3], COL.mm), aAR = L.arrow([-7.9, 6.4, 0.3], [-8.0, 3.8, 0.3], COL.ar), aFA = L.arrow([-4.4, 6.4, 0.3], [-4.6, 3.8, 0.3], COL.act), aFB = L.arrow([-4.9, 2.2, 0.9], [-6.5, 2.2, 0.9], COL.act);
    G.add(aMM, aAR, aFA, aFB);
    const xBar = block(0.2, 1.4, 0.2, COL.bad, [-5.9, 2.2, 1.0]); G.add(xBar);
    G.add(lab('流匹配 → 主干\n（作者：约 5%）', [-5.8, 4.4, 1.0], { size: 12, color: '#f2c14e' }));
    const X0 = 1.5, W = 11.5, Y0 = 0.5, H = 6.2;
    const yt = ph ? [[0, '50'], [0.25, '60'], [0.5, '70'], [0.75, '80'], [1, '90']] : [[0, '20'], [0.25, '30'], [0.5, '40'], [0.75, '50'], [1, '60']];
    axes(G, X0, Y0, W, H, 0, { yt });
    const bs = bars(G, 4, 1.8, 0.6, COL.qwen);
    const bl = [0, 1, 2, 3].map(i => dynLab(G, [X0 + 1.45 + i * 2.85, Y0 - 0.6, 0], { size: 13, bg: false }));
    const vlab = [F10A, F10B].map((D, k) => D.map(([, v], i) => { const lo = k ? 50 : 20, hi = k ? 90 : 60, sp = lab(fmt(v, 2), [X0 + 1.45 + i * 2.85, Y0 + (v - lo) / (hi - lo) * H + 0.45, 0.4], { size: 14 }); G.add(sp); return sp; }));
    const title = dynLab(G, [X0 + W / 2, Y0 + H + 0.75, 0], { size: 16 });
    const ctls = [{ label: '策略', items: F10A.map(f => f[0]), get: () => si, set: v => { si = v; } }, { label: '阶段', items: ['图 10a 从头训', '图 10b 微调'], get: () => ph, set: v => { ph = v; } }];
    return { ctls, update(p) {
      const D = ph ? F10B : F10A, lo = ph ? 50 : 20, hi = ph ? 90 : 60, g = seg(p, 0.15, 0.6);
      const sel = ph ? (si === 3 ? [1, 3] : si === 0 ? [0, 2] : []) : [si];
      D.forEach(([nm, v], i) => { const h = (v - lo) / (hi - lo) * H * g; setBar(bs, i, X0 + 1.45 + i * 2.85, Y0, h, 0, 1.8, 0.6, hex3(sel.includes(i) ? COL.warn : (ph ? (i % 2 ? COL.ar : COL.qwen) : COL.qwen))); bl[i](nm); });
      done(bs);
      vlab.forEach((arr, k) => arr.forEach(sp => { sp.visible = k === ph && g > 0.97; }));
      title(ph ? '图 10b · 微调（纵轴从 50 起）' : '图 10a · 从头训 70k 步（纵轴从 20 起）');
      const stage2 = si === 2 && p > 0.5;
      const flowToBackbone = si === 0 || si === 3 || stage2, arOn = si !== 0;
      aAR.visible = arOn; cAR.material.opacity = arOn ? 0.9 : 0.15;
      aFB.visible = true; xBar.visible = !flowToBackbone;
      aMM.visible = true; aFA.visible = true;
      glow(bb, 0.2 + 0.4 * Math.sin(p * 30) ** 2); glow(ae, 0.2);
      const txt = ['只用流：去掉动作 token CE，主干只收到弱的流匹配信号和多模态 CE', '梯度截断（知识隔离）：流匹配梯度挡在主干外；VQA 略高，但动作最差，流损失收敛更慢', si === 2 && p <= 0.5 ? '先截断再联合：前一段截断……' : '……后一段去掉截断，切到联合训练；比一直联合低 7.42', '联合训练：三条梯度都回到主干。比其他三种高 7.4–25.1 个百分点'][si];
      cap(ph ? (si === 3 ? '微调也用联合训练：单任务 82.00 对只用流 63.00；5 任务 73.96 对 62.16' : si === 0 ? '只用流微调：63.00（单任务）和 62.16（5 任务）' : '图 10b 只比较“只用流”和“联合训练”两种') : txt);
    } };
  }

  /* ---------- scene 7: action-space supervision ---------- */
  function s7(G) {
    let lt = +(OPT[0] ?? 1);
    const X0 = -12.2, W = 10.6, Y0 = 0.6, H = 6.0;
    axes(G, X0, Y0, W, H, 0, { xt: [[0, 'τ = 0 噪声'], [0.5, '0.5'], [1, '1 干净']], yt: [[0, '0'], [0.5, null], [1, null]] });
    const N = 100, s = 0.999;
    const dens = t => (t >= s ? 0 : 1.5 * Math.sqrt(1 - t / s) / s);
    const wgt = t => lt ? (1 - t) ** 2 : 1;
    const rD = ribbon(G, N, COL.seen, 0.07), rW = ribbon(G, N, COL.warn, 0.07), rE = ribbon(G, N, COL.act, 0.12, { order: 5 });
    const legend = [lab('蓝：时间步分布 p(τ)', [X0 + 2.6, Y0 + H + 1.5, 0], { size: 13, color: css(COL.seen) }), lab('黄：损失权重', [X0 + 8.6, Y0 + H + 1.5, 0], { size: 13, color: css(COL.warn) })];
    legend.forEach(x => G.add(x));
    const eLab = dynLab(G, [X0 + W / 2, Y0 + H + 0.75, 0], { size: 14, color: css(COL.act) });
    const share = dynLab(G, [X0 + W / 2, Y0 - 1.3, 0], { size: 14 });
    /* right: Fig. 11 */
    const X1 = 2.6, W1 = 10.5;
    axes(G, X1, Y0, W1, H, 0, { xt: [[0, '10k'], [0.2, '15k'], [0.4, '20k'], [0.6, '25k'], [0.8, '30k'], [1, '35k']], yt: [[0, '60'], [0.25, '70'], [0.5, '80'], [0.75, '90'], [1, '100']] });
    const fA = ribbon(G, 60, COL.vl, 0.1), fV = ribbon(G, 60, COL.seen, 0.1);
    G.add(lab('图 11 · LIBERO 平均成功率（读图）', [X1 + W1 / 2, Y0 + H + 0.8, 0], { size: 15 }));
    const vA = dynLab(G, [X1 + W1 - 2.4, Y0 + 1.5, 0.2], { size: 13, color: css(COL.vl) }), vV = dynLab(G, [X1 + W1 - 2.4, Y0 + 0.7, 0.2], { size: 13, color: css(COL.seen) });
    const ip = (A, x) => { const i = Math.min(4, Math.floor(x * 5)), f = x * 5 - i; return A[i] + (A[i + 1] - A[i]) * f; };
    const ctls = [{ label: '损失', items: ['速度损失（权重 1）', '动作空间损失（权重 (1−τ)²）'], get: () => lt, set: v => { lt = v; } }];
    return { ctls, update(p) {
      const pts = k => { const o = []; let mx = 0; for (let i = 0; i < N; i++) { const t = i / (N - 1); mx = Math.max(mx, k(t)); } for (let i = 0; i < N; i++) { const t = i / (N - 1); o.push([X0 + t * W, Y0 + k(t) / mx * H * 0.95, 0.02]); } return o; };
      rD.userData.set(pts(dens)); rW.userData.set(pts(t => wgt(t) * 1.0));
      const g = seg(p, 0.05, 0.45);
      rE.userData.set(pts(t => dens(t) * wgt(t)).map(q => [q[0], Y0 + (q[1] - Y0) * g, 0.04]));
      eLab(lt ? '橙：有效权重 p(τ)·(1−τ)²' : '橙：有效权重 = p(τ)');
      let a = 0, b = 0; for (let i = 0; i < 2000; i++) { const t = (i + 0.5) / 2000, e = dens(t) * wgt(t); a += e; if (t < 0.5) b += e; }
      share(`τ < 0.5（高噪声一半）占有效权重 ${fmt(100 * b / a, 1)}%`);
      const x = seg(p, 0.4, 0.95);
      const mk = A => { const o = []; for (let i = 0; i < 60; i++) { const xx = x * i / 59; o.push([X1 + xx * W1, Y0 + (ip(A, xx) - 60) / 40 * H, 0.03]); } return o; };
      fA.userData.set(mk(F11.act)); fV.userData.set(mk(F11.vel));
      vA(`动作损失 ${fmt(ip(F11.act, x), 1)}`); vV(`速度损失 ${fmt(ip(F11.vel, x), 1)}`);
      cap(p < 0.4 ? (lt ? '动作空间损失 = 速度损失 × (1 − τ)²：本来就偏向高噪声的采样，再被加权一次' : '速度损失：每个时间步权重相同，只靠 Beta 采样偏向高噪声') : x < 0.42 ? '10k 步时速度损失略好（73.2 对 67.8）：低噪声段的信号在动作损失里很弱' : '20k 后动作损失稳定在约 96，速度损失在 20k 掉到 81.7，35k 才 90.3');
    } };
  }

  /* ---------- scene 8: data recipe ---------- */
  function s8(G) {
    let pm = +(OPT[0] ?? 1);
    /* left: action data split and open-source subsets */
    const X0 = -12.2, Y0 = 0.5;
    const self = block(1.4, 6.0 * 0.6, 1.0, COL.self, [X0, Y0 + 1.8, 0]), open = block(1.4, 6.0 * 0.4, 1.0, COL.open, [X0, Y0 + 3.6 + 1.2, 0]);
    G.add(self, open, lab('自采 ≈ 60%', [X0, Y0 - 0.5, 0], { size: 14, color: css(COL.self) }), lab('开源 ≈ 40%', [X0, Y0 + 6.5, 0], { size: 14, color: css(COL.open) }));
    const ob = bars(G, 10, 0.5, 0.5, COL.open);
    const ol = OS.map(([nm, v], i) => lab(`${nm} ${v}%`, [X0 + 7.0, Y0 + 5.9 - i * 0.62, 0], { size: 12, bg: false, color: '#c0567e' }));
    ol.forEach(x => G.add(x));
    G.add(lab('图 4 外圈：开源 10 个子集', [X0 + 5.4, Y0 + 7.3, 0], { size: 14 }));
    /* middle: 9:1 batch */
    const BX = -0.9, BY = 2.0;
    const bc = inst(CUBE, 10); G.add(bc);
    G.add(lab('一个批次：9 : 1', [BX + 1.2, BY + 3.6, 0], { size: 15 }));
    const bl = dynLab(G, [BX + 1.2, BY - 1.4, 0], { size: 13 });
    /* right: sampling toy */
    const NS = [20000, 4000, 800, 150, 30], RX = 5.0, RW = 8.0, RY = 0.6, RH = 5.6;
    axes(G, RX, RY, RW, RH, 0, { yt: [[0, '0'], [0.5, '40%'], [1, '80%']] });
    const sb = bars(G, 5, 1.0, 0.5, COL.warn);
    const sl = NS.map((n, i) => lab(String(n), [RX + 0.9 + i * 1.55, RY - 0.45 - (i % 2) * 0.5, 0], { size: 12, bg: false, color: '#7d8aa6' })); sl.forEach(x => G.add(x));
    const shares = [1, 0.5].map(pw => { const w = NS.map(n => Math.pow(n, pw)), sw = w.reduce((a, b) => a + b, 0); return w.map(x => x / sw); });
    const sv = shares.map(sh => sh.map((v, i) => { const sp = lab(`${fmt(100 * v, 1)}%`, [RX + 0.9 + i * 1.55, RY + v / 0.8 * RH + 0.35, 0.3], { size: 12 }); G.add(sp); return sp; }));
    G.add(lab('玩具：五个采样组的份额', [RX + RW / 2, RY + RH + 0.9, 0], { size: 14, color: css(COL.warn) }));
    const ctls = [{ label: '采样', items: ['按比例 p = 1', '平方根 p = 0.5'], get: () => pm, set: v => { pm = v; } }];
    return { ctls, update(p) {
      const g = seg(p, 0.05, 0.4);
      for (let i = 0; i < 10; i++) { const w = Math.max(0.05, OS[i][1] / 24.6 * 3.0 * g); setI(ob, i, [X0 + 1.2 + w / 2, Y0 + 5.9 - i * 0.62, 0], [w, 0.42, 0.4]); }
      done(ob);
      const k = Math.floor(p * 40) % 10;
      for (let i = 0; i < 10; i++) { setI(bc, i, [BX + (i % 5) * 0.62, BY + (i < 5 ? 1.2 : 0.4), 0], [0.5, 0.5, 0.5]); colI(bc, i, hex3(i === 9 ? COL.mm : (i === k ? COL.white : COL.self))); }
      done(bc);
      bl('9 份机器人轨迹（动作 CE + 流匹配）\n1 份多模态（只有文本 CE）');
      const pw = pm ? 0.5 : 1, w = NS.map(n => Math.pow(n, pw)), sw = w.reduce((a, b) => a + b, 0), sh = w.map(x => x / sw);
      const g2 = seg(p, 0.35, 0.75);
      sh.forEach((v, i) => { setBar(sb, i, RX + 0.9 + i * 1.55, RY, Math.max(0.02, v / 0.8 * RH * g2), 0, 1.0, 0.5, hex3(COL.warn)); });
      sv.forEach((arr, k) => arr.forEach(sp => { sp.visible = k === pm && g2 > 0.97; }));
      done(sb);
      cap(pm ? `平方根采样：最大组 ${fmt(100 * sh[0], 1)}%，最小组 ${fmt(100 * sh[4], 2)}%（按比例时只有 ${fmt(100 * 30 / 24980, 2)}%）` : `按比例：最大组占 ${fmt(100 * sh[0], 1)}%，长尾几乎采不到`);
    } };
  }

  /* ---------- scene 9: inference ---------- */
  const INF = (function () {
    const r = L.rng(7), T = 32, A = [], E = [];
    for (let t = 0; t < T; t++) { const u = t / (T - 1); A.push([-12 + u * 10, 1.0 + 3.6 * Math.sin(u * Math.PI) * (0.6 + 0.4 * u)]); E.push([L.gauss(r) * 1.6, L.gauss(r) * 1.6]); }
    const times = []; for (let k = 0; k <= 10; k++) times.push(k / 10 * 0.999);
    return { T, A, E, times };
  })();
  function s9(G) {
    let res = +(OPT[0] ?? 1);
    const pts = inst(BALL, INF.T); G.add(pts);
    for (let i = 0; i < INF.T; i++) colI(pts, i, hex3(COL.act)); done(pts);
    const tgt = ribbon(G, INF.T, COL.white, 0.04, { opacity: 0.35 }); tgt.userData.set(INF.A.map(a => [a[0], a[1], -0.1]));
    G.add(lab('一个动作块：32 帧（玩具二维轨迹）', [-7, 6.8, 0], { size: 15 }));
    const stepL = dynLab(G, [-7, -0.8, 0], { size: 15 });
    /* timeline: prefix + 10 steps */
    const TX = 1.8, TY = 5.6;
    const pre = block(2.6, 0.6, 0.5, COL.vl, [TX + 1.3, TY, 0]); G.add(pre, lab('前缀 1 次', [TX + 1.3, TY + 0.9, 0], { size: 12 }));
    const st = []; for (let k = 0; k < 10; k++) { const m = block(0.6, 0.6, 0.5, COL.act, [TX + 3.1 + k * 0.72, TY, 0]); G.add(m); st.push(m); }
    G.add(lab('10 步：只跑 32 个动作 token', [TX + 6.4, TY + 0.9, 0], { size: 12 }));
    /* Hz bars */
    const HX = 2.6, HY = 0.4, HH = 3.6;
    axes(G, HX, HY, 9.6, HH, 0, { yt: [[0, '0'], [0.5, '12'], [1, '24 Hz']] });
    const hb = bars(G, 4, 1.4, 0.5, COL.act);
    const NM = ['224\neager*', '224\n优化', '448\neager*', '448\n优化'], HZ = [21 / 4, 21, 15 / 4, 15];
    const hl = NM.map((n, i) => lab(n, [HX + 1.3 + i * 2.3, HY - 0.75, 0], { size: 12, bg: false, color: '#9aa6bf' })); hl.forEach(x => G.add(x));
    const hv = NM.map((n, i) => dynLab(G, [HX + 1.3 + i * 2.3, HY + HZ[i] / 24 * HH + 0.4, 0], { size: 12, bg: false }));
    const ctls = [{ label: '分辨率', items: ['224 × 224', '448 × 448'], get: () => res, set: v => { res = v; } }];
    return { ctls, update(p) {
      const kf = clamp((p - 0.15) / 0.65, 0, 1) * 10, k = Math.floor(kf), t = kf >= 10 ? INF.times[10] : INF.times[k] + (INF.times[Math.min(10, k + 1)] - INF.times[k]) * (kf - k);
      for (let i = 0; i < INF.T; i++) { const a = INF.A[i], e = INF.E[i]; setI(pts, i, [a[0] * t + (a[0] + e[0]) * (1 - t), a[1] * t + (a[1] + e[1]) * (1 - t), 0.1], 0.17); }
      done(pts);
      glow(pre, p < 0.15 ? 1 : 0.1); st.forEach((m, j) => glow(m, p >= 0.15 && j === Math.min(9, k) && kf < 10 ? 1 : j < k ? 0.35 : 0.05));
      stepL(p < 0.15 ? '先算前缀，缓存 KV' : kf < 10 ? `第 ${k + 1} / 10 步　τ = ${fmt(t, 3)}` : '完成：τ = 0.999，输出动作块');
      for (let i = 0; i < 4; i++) { const on = (i < 2) === (res === 0); setBar(hb, i, HX + 1.3 + i * 2.3, HY, HZ[i] / 24 * HH, 0, 1.4, 0.5, hex3(on ? (i % 2 ? COL.act : COL.qwen) : COL.dim)); hv[i](i % 2 ? `${HZ[i]} Hz` : `≈ ${fmt(HZ[i], 2)}`); }
      done(hb);
      cap(`${res ? '448' : '224'} 分辨率、三路图像、RTX 5090：优化后约 ${res ? 15 : 21} Hz。* eager 是按“快 4 倍”反推的，不是论文给的数`);
    } };
  }

  /* ---------- scene 10: zero-shot over checkpoints ---------- */
  function s10(G) {
    let cm = +(OPT[0] ?? 0);
    const N = ZS.length, DX = 1.5, X0 = -12.0, Y0 = 0.6, H = 7.0;
    axes(G, X0 - 0.9, Y0, N * DX + 0.6, H, 0, { yt: [[0, '0'], [0.25, '25'], [0.5, '50'], [0.75, '75'], [1, '100']] });
    const bs = bars(G, N, 1.0, 0.6, COL.seen);
    ZS.forEach(([nm], i) => G.add(lab(nm, [X0 + i * DX, Y0 - 0.45 - (i % 2) * 0.6, 0], { size: 12, bg: false, color: '#7d8aa6' })));
    const sep = L.line([[X0 + 11.5 * DX, Y0, 0.1], [X0 + 11.5 * DX, Y0 + H, 0.1]], 0x9aa6bf, { opacity: 0.6, dashed: true }); G.add(sep);
    G.add(lab('见过 12 个', [X0 + 5.5 * DX, Y0 + H + 0.45, 0], { size: 14, color: css(COL.seen) }), lab('没见过 5 个', [X0 + 14 * DX, Y0 + H + 0.45, 0], { size: 14, color: css(COL.unseen) }));
    const ckL = dynLab(G, [X0 + 8 * DX, Y0 + H + 1.35, 0], { size: 18 });
    const av = dynLab(G, [X0 + 8 * DX, -1.7, 0], { size: 14 });
    const thr = L.line([[X0 - 0.9, Y0 + 0.6 * H, 0.05], [X0 + N * DX - 0.3, Y0 + 0.6 * H, 0.05]], COL.warn, { opacity: 0.6, dashed: true }); G.add(thr); G.add(lab('60', [X0 + N * DX + 0.2, Y0 + 0.6 * H, 0], { size: 12, bg: false, color: css(COL.warn) }));
    const ctls = [{ label: '着色', items: ['见过 / 没见过', '五个类别'], get: () => cm, set: v => { cm = v; } }];
    return { ctls, update(p) {
      const x = clamp(p / 0.9, 0, 1) * 5, i0 = Math.floor(Math.min(4.999, x)), f = L.ease(x - i0), ci = x >= 5 ? 5 : (f > 0.5 ? i0 + 1 : i0);
      let s = 0, u = 0;
      ZS.forEach(([, c, seen, v], i) => { const val = x >= 5 ? v[5] : v[i0] + (v[i0 + 1] - v[i0]) * f; setBar(bs, i, X0 + i * DX, Y0, Math.max(0.02, val / 100 * H), 0, 1.0, 0.6, hex3(cm ? CAT[c][1] : (seen ? COL.seen : COL.unseen))); if (seen) s += v[ci]; else u += v[ci]; });
      done(bs);
      ckL(`检查点 ${CK[ci]}`);
      av(`见过平均 ${fmt(s / 12, 1)}　没见过平均 ${fmt(u / 5, 1)}　总体 ${fmt((s + u) / 17, 1)}`);
      const capT = { 0: '50k：大多数任务还在 50 以下', 1: '100k：没见过的任务平均（41.0）反而高于见过的（31.7）', 2: '200k：方块 87.5、水果 81；300k 方块回落到 51.5', 3: '300k：总体 38.7，比 200k 低，是一次回落', 4: '350k：套圈 100，包裹 68.75，方块 96', 5: '400k：方块 100、水果 96、套圈 86、绳子 82；叠毛巾、摆餐桌、充电器仍在 10 左右' };
      cap(cm ? '按类别：语义（蓝）最高，精细（红，只有充电器）最低' : capT[ci]);
    } };
  }

  /* ---------- scene 11: fine-tuning and multimodal ---------- */
  function s11(G) {
    let vi = +(OPT[0] ?? 0);
    const sub = [new THREE.Group(), new THREE.Group(), new THREE.Group()]; sub.forEach(s => G.add(s));
    /* view 0: Table 8 */
    const N = FT.length, DX = 1.62, X0 = -12.0, Y0 = 0.6, H = 6.6;
    axes(sub[0], X0 - 0.9, Y0, N * DX + 0.4, H, 0, { yt: [[0, '0'], [0.5, '50'], [1, '100']] });
    const b0 = bars(sub[0], N * 3, 0.42, 0.4, COL.act);
    FT.forEach(([nm], i) => sub[0].add(lab(nm, [X0 + i * DX, Y0 - 0.45 - (i % 2) * 0.55, 0], { size: 12, bg: false, color: '#7d8aa6' })));
    sub[0].add(L.line([[X0 + 9.5 * DX, Y0, 0.1], [X0 + 9.5 * DX, Y0 + H, 0.1]], 0x9aa6bf, { opacity: 0.6, dashed: true }));
    sub[0].add(lab('Wall-OSS-0.5', [X0 + 2 * DX, Y0 + H + 0.5, 0], { size: 14, color: css(COL.act) }), lab('π0.5', [X0 + 5.5 * DX, Y0 + H + 0.5, 0], { size: 14, color: css(COL.pi) }), lab('DreamZero', [X0 + 8.5 * DX, Y0 + H + 0.5, 0], { size: 14, color: css(COL.dz) }), lab('操作 10 | 推理 5', [X0 + 12.5 * DX, Y0 + H + 0.5, 0], { size: 13, color: '#9aa6bf' }));
    const avg0 = dynLab(sub[0], [X0 + 7 * DX, -1.7, 0], { size: 14 });
    /* view 1: Table 7 dumbbells */
    const MX = -6, MW = 14, MY = 1.0;
    axes(sub[1], MX, MY, MW, 6.0, 0, { xt: [[0, '0'], [0.25, '17.5'], [0.5, '35'], [0.75, '52.5'], [1, '70']] });
    const q = inst(BALL, 5), w = inst(BALL, 5); sub[1].add(q, w);
    for (let i = 0; i < 5; i++) { colI(q, i, hex3(COL.qwen)); colI(w, i, hex3(COL.vl)); }
    const bars1 = MM.map(() => { const r = ribbon(sub[1], 2, COL.vl, 0.12); return r; });
    MM.forEach(([nm], i) => sub[1].add(lab(nm, [MX - 1.9, MY + 5.4 - i * 1.2, 0], { size: 13, bg: false, color: i < 2 ? '#3a8ee8' : '#9d6ad8' })));
    const mv = MM.map(([, a, b], i) => { const d = b - a, sp = lab(`${fmt(a, 1)} → ${fmt(b, 1)}（${d > 0 ? '+' : '−'}${fmt(Math.abs(d), 1)}）`, [MX + Math.max(a, b) / 70 * MW + 2.4, MY + 5.4 - i * 1.2, 0.2], { size: 12, color: d > 0 ? css(COL.vl) : '#7cb8ff' }); sub[1].add(sp); return sp; });
    sub[1].add(lab('灰：Qwen2.5-VL-3B　紫：Wall-OSS-0.5', [MX + MW / 2, MY + 6.8, 0], { size: 14 }));
    /* view 2: Fig. 7 */
    const FX = -7, FY = 0.6, FH = 6.4;
    axes(sub[2], FX, FY, 13, FH, 0, { yt: [[0, '50'], [0.5, '70'], [1, '90']] });
    const F7 = [[73.96, null, null], [74.75, 59.98, null], [83.75, 64.78, 65.59]];
    const b2 = bars(sub[2], 9, 1.1, 0.6, COL.vl);
    ['5 任务', '10 任务', '19 任务'].forEach((t, i) => sub[2].add(lab(t, [FX + 2.2 + i * 4.3, FY - 0.5, 0], { size: 14, bg: false, color: '#7d8aa6' })));
    sub[2].add(lab('紫：5 个简单共享　蓝：10 个共享　红：9 个新增（论文 65.59，重算 66.50）', [FX + 6.5, FY + FH + 0.7, 0], { size: 13 }));
    const v2 = []; F7.forEach((r, i) => r.forEach((v, j) => { if (v == null) return; const sp = lab(fmt(v, 2), [FX + 1.0 + i * 4.3 + j * 1.2, FY + (v - 50) / 40 * FH + 0.4, 0.3], { size: 12 }); sub[2].add(sp); v2.push(sp); }));
    const ctls = [{ label: '视图', items: ['表 8 微调对比', '表 7 多模态', '图 7 多任务扩展'], get: () => vi, set: v => { vi = v; } }];
    return { ctls, update(p) {
      sub.forEach((s, i) => { s.visible = i === vi; });
      const g = seg(p, 0.1, 0.6);
      if (vi === 0) {
        FT.forEach(([, , a, b, c], i) => [a, b, c].forEach((v, j) => setBar(b0, i * 3 + j, X0 + i * DX + (j - 1) * 0.45, Y0, Math.max(0.02, v / 100 * H * g), 0, 0.42, 0.4, hex3([COL.act, COL.pi, COL.dz][j]))));
        done(b0);
        avg0('总体 60.5 / 43.0 / 33.4　操作 61.1 / 35.0 / 33.7　推理 59.3 / 58.9 / 32.7');
        cap('Wall-OSS-0.5 在 15 个任务里 10 个最高；π0.5 在眼镜架、水果篮、物体配对领先，DreamZero 在物体进篮、笔袋领先');
      } else if (vi === 1) {
        MM.forEach(([, a, b], i) => { const y = MY + 5.4 - i * 1.2, xa = MX + a / 70 * MW, xb = MX + (a + (b - a) * g) / 70 * MW; setI(q, i, [xa, y, 0.1], 0.2); setI(w, i, [xb, y, 0.12], 0.26); bars1[i].userData.set([[xa, y, 0.05], [xb, y, 0.05]]); mv[i].visible = g > 0.97; });
        done(q); done(w);
        cap(g < 1 ? '从主干出发……' : '通用 VQA 下降（RealWorldQA −15.0、ERQA −5.5），具身三项上升（+3.9、+21.8、+11.0）。* 具身定位是内部基准');
      } else {
        const cols = [COL.vl, COL.seen, COL.unseen];
        F7.forEach((r, i) => r.forEach((v, j) => { const k = i * 3 + j, x = FX + 1.0 + i * 4.3 + j * 1.2; setBar(b2, k, x, FY, v == null ? 0.001 : Math.max(0.02, (v - 50) / 40 * FH * g), 0, 1.1, 0.6, hex3(cols[j])); }));
        done(b2); v2.forEach(sp => { sp.visible = g > 0.97; });
        cap('扩任务帮了共享任务：5 个简单任务 73.96 → 74.75 → 83.75（+9.79 个百分点），10 个共享任务 59.98 → 64.78');
      }
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
  window.__w05Debug = { RVQ, INF, get cap() { return $('cap').textContent; } };
})();

