'use strict';
/* Cosmos Policy (arXiv 2601.16163) taken apart into eleven animated scenes. Shapes and settings come from the paper and
   the official code NVlabs/cosmos-policy at commit 18a2acc (cosmos_policy_experiment_configs.py, policy_text2world_model.py,
   policy_video2world_model.py, hybrid_edm_sde.py, dataset_common.py, cosmos_utils.py, run_libero_eval.py).
   Each scene's update(p) is a pure function of the timeline p plus the current toggles. Scenes 2, 3, 4, 6, 8, 9 and 10
   compute their numbers live; toy action values, toy rollouts and toy value predictions use a fixed seed.
   No Cosmos network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { img: 0x3aa8e0, prop: 0x4fc98a, act: 0xf0963c, val: 0xf2c14e, blank: 0x46506a, text: 0x9d8cff, attn: 0xd45fa0, ok: 0x4fc98a, bad: 0xe05d5d, dim: 0x46506a, white: 0xeef2fa, cond: 0x4fc98a, tgt: 0xf0963c, gray: 0x8e9bb8, gold: 0xf2c14e, blue: 0x3aa8e0, purple: 0x9d8cff };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const live = t => `<p class="guess"><b>现算 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const fmt = n => n.toLocaleString('en-US');

  /* LIBERO sequence (state_t = 9) and the 11-frame RoboCasa / ALOHA sequence. kind: b blank, p proprio, i image, a action, v value; c = conditioning (current s) */
  const SEQ9 = [['空白', 'b', 1], ['本体', 'p', 1], ['腕部', 'i', 1], ['主相机', 'i', 1], ['动作块', 'a', 0], ['未来本体', 'p', 0], ['未来腕部', 'i', 0], ['未来主相机', 'i', 0], ['价值', 'v', 0]];
  const SEQ11 = [['空白', 'b', 1], ['本体', 'p', 1], ['腕部', 'i', 1], ['相机 1', 'i', 1], ['相机 2', 'i', 1], ['动作块', 'a', 0], ['未来本体', 'p', 0], ['未来腕部', 'i', 0], ['未来相机 1', 'i', 0], ['未来相机 2', 'i', 0], ['价值', 'v', 0]];
  const KC = { b: COL.blank, p: COL.prop, i: COL.img, a: COL.act, v: COL.val };
  /* role of each frame in each training mode: 1 clean condition, 0 noisy target (loss), 2 noisy but no loss (masked input) */
  const MODES = [
    { nm: '策略', f: '50% · π(a, s′, V(s′) | s)', r: n => n.map(x => x[2] ? 1 : 0) },
    { nm: '世界模型', f: '25% · p(s′, V(s′) | s, a)', r: n => n.map(x => x[2] || x[1] === 'a' && !x[2] ? 1 : 0) },
    { nm: '价值', f: '25% · p(V(s′) | s, a, s′)', r: n => n.map(x => x[1] === 'v' ? 0 : 1) },
    { nm: 'V(s′) 精调', f: '规划模型 · 掩掉 (s, a)', r: n => n.map((x, i) => x[1] === 'v' ? 0 : (x[2] && i > 0) || x[1] === 'a' ? 2 : 1) },
    { nm: 'Q(s,a) 精调', f: '无模型规划 · 掩掉 s′', r: n => n.map(x => x[1] === 'v' ? 0 : x[2] || x[1] === 'a' ? 1 : 2) }
  ];

  const SCENES = [
    { n: 1, part: '总览', title: '一个视频模型，同时当策略、世界模型和价值函数', sub: '点方块跳到对应那一幕', dur: 12, cam: [0.0, 1.05, 36, [0, 3.2, 0]],
      html: dl([['骨干', 'Cosmos-Predict2-2B-Video2World，结构不改，全参数微调'], ['输入 s', '本体 + 各相机当前画面 + T5 文本'], ['输出', '动作块 a、未来状态 s′（本体 + 图像）、价值 V(s′)'], ['做法', '新模态写成隐帧，插进视频扩散序列'], ['两种用法', '直接策略（并行解码）；best-of-N 规划（自回归，策略模型 + 规划模型）']]) +
        '<p>左边是一个时刻的观测，中间是没有改过的 Cosmos DiT，右边是三个输出。整条序列就是一段“视频”：当前观测、动作、未来观测、未来价值依次排开。</p>' +
        '<p>后 10 幕依次是：数据怎样变成隐帧、怎样注入、网络、三种训练掩码、噪声分布、推理、回放和价值、规划、LIBERO 评测、结果。</p>' + src('图 1 · §4 · 摘要') },
    { n: 2, part: '§3 / 附录 A.1 数据', title: '一个训练样本：33 张图 → 9 个隐帧', sub: '每个模态复制 4 张；切换 LIBERO / RoboCasa·ALOHA', dur: 13, cam: [0.0, 1.05, 34, [0, 2.4, 0]],
      html: dl([['VAE', 'Wan2.1：首帧单独编码，之后每 4 帧压成 1 个隐帧'], ['做法', '最前面放 1 张空白图；每个模态（相机画面或占位黑图）复制 4 张'], ['LIBERO', '1 + 8 × 4 = 33 张 → 9 个隐帧（chunk_duration 33，state_t 9）'], ['RoboCasa / ALOHA', '1 + 10 × 4 = 41 张 → 11 个隐帧'], ['分辨率', '224 × 224 → 28 × 28 × 16']]) +
        '<p>上排是送进 VAE 的图像序列：彩色是相机画面，黑色是占位图（之后被本体、动作、价值覆盖）。每 4 张一样的图对应同一个时刻，不是 4 个时刻。下排是编码后的隐帧。</p>' +
        '<p>空白首帧是因为 VAE 的首帧单独编码：把它让出去，当前观测和未来观测就都落在“4 帧一组”的格子里，隐表示结构相同。</p>' +
        live('张数 = 1 + 4 × 模态数，隐帧数 = 1 + (张数 − 1)/4。') + src('§3 · §4.1 · 附录 A.1 图 8 · 配置第 116、123、236、240 行') },
    { n: 3, part: '§4.1 隐帧注入', title: '把 16 × 7 的动作块铺满一个隐帧', sub: '换模态，看复制多少份、能不能整除', dur: 14, cam: [0.6, 1.12, 27, [0, 3.4, 0]],
      html: dl([['隐帧', '28 × 28 × 16 = 12,544 个数'], ['步骤', '每维缩放到 [−1, 1] → 展平 → 重复 → reshape → 覆盖占位隐帧'], ['LIBERO 动作', '16 × 7 = 112 → 正好 112 份'], ['LIBERO 本体', '9 维 → 1,393.8 份，代码向上取整再截断'], ['ALOHA 动作', '50 × 14 = 700 → 17.92 份；读出只平均完整的 17 份'], ['价值', '标量，整块同一个数；读出取整块平均，再映射回 [0, 1]']]) +
        '<p>方块阵列是一个隐帧（16 层，每层 28 × 28）。按展平顺序逐格填入，颜色是数值（蓝 −1 到橙 +1）。同一个动作元素在体积里反复出现，读出时把所有副本取平均，相当于一个小的集成。</p>' +
        '<p>这一步不经过 VAE：图像走 VAE，非图像模态直接写进隐空间，生成后也直接从隐空间读出。</p>' +
        live('复制份数 = 12,544 ÷ 元素数；读出时用 ⌊12,544 ÷ 元素数⌋ 份。') + guess('动作和本体的数值是我用正弦造的玩具值，只为看出重复的花纹。') +
        src('§4.1 · 附录 A.1 · policy_text2world_model.py replace_latent_with_action_chunk / replace_latent_with_proprio · cosmos_utils.py extract_*') },
    { n: 4, part: '§3 网络', title: '原样的 DiT：28 块，每个隐帧 196 个 token', sub: '绿色帧 σ = 0 当条件，橙色帧带噪声', dur: 13, cam: [0.2, 1.25, 36, [0, 3.6, 0]],
      html: dl([['网络', 'MinimalV1LVGDiT 2B：28 块，宽 2048，16 头'], ['patch', '1 × 2 × 2 → 每隐帧 14 × 14 = 196 token'], ['序列', 'LIBERO 9 × 196 = 1,764；11 帧 2,156'], ['每块', '自注意力（3D RoPE）→ 交叉注意力读 T5 文本 → 前馈；σ 经 AdaLN 调制'], ['逐帧 σ', '条件帧的时间嵌入用 σ_cond = 0，目标帧用当前 σ']]) +
        '<p>下面是 9 个隐帧切成 token，竖起来的是 28 个 Transformer 块。所有帧在同一个自注意力里互相看，没有专门的动作头或动作网络。</p>' +
        '<p>Cosmos 本来就支持“前几帧是干净条件”的视频续写：条件帧在输入端直接替换成真值、时间嵌入用 σ = 0，输出端也被替换回真值、不算损失。Cosmos Policy 只是把“哪几帧是条件”从“前几帧”改成任意一组帧。</p>' +
        live('token 数 = 帧数 × (28/2)²。') + src('§3 · net.py COSMOS_V1_2B_NET_MININET · policy_video2world_model.py denoise（第 394–462 行）') },
    { n: 5, part: '§4.2 / 图 12 训练', title: '同一条序列，三种掩码，三个函数', sub: '自动轮换，或者固定一种', dur: 15, cam: [0.0, 1.0, 30, [0, 1.8, 0]], camE: [0.0, 1.05, 24, [0, 5.4, 0]],
      html: dl([['策略 50%', '条件 s；目标 a、s′、V(s′)'], ['世界模型 25%', '条件 s、a；目标 s′、V(s′)'], ['价值 25%', '条件 s、a、s′；目标 V(s′)'], ['V(s′) 精调', 's、a 改成加噪且不算损失，价值只能看 s′'], ['Q(s,a) 精调', 's′ 加噪且不算损失，价值只看 s、a']]) +
        '<p>帧下面的绿条表示干净的条件帧，橙条表示要去噪并计算损失的目标（帧上蒙着噪声），半透明、没有条的是被“掩掉”的帧：它们也被加噪，但不算损失，所以对价值来说等于没有。</p>' +
        '<p>策略和世界模型的目标里都带着“多出来”的帧（策略也要生成 s′ 和 V，世界模型也要生成 V），这就是论文说的辅助目标。RoboCasa 上去掉未来状态这个辅助目标，成功率从 62.5 掉到 44.4。</p>' +
        guess('代码里回放样本还有一层：成功和失败回放先按 1:1 重采样，再各以 0.5 的概率当世界模型或价值样本。下方比例条按期望值画。') +
        src('§4.2 · 图 12 · 表 5 · policy_video2world_model.py 第 127–270 行 · libero_dataset.py 第 549–558 行') },
    { n: 6, part: '附录 A.2.1 噪声', title: '训练多给高噪声；推理停在 σ = 4', sub: '直方图是两种分布在对数轴上的概率', dur: 13, cam: [0.0, 1.2, 30, [0, 3.6, 0]],
      html: dl([['基础模型', 'ln σ ~ N(ln 4, 1.2²)'], ['Cosmos Policy', '0.7 × 对数正态 + 0.3 × U[1, 85]'], ['P(σ > 20)', '9.0% → 29.5%'], ['推理', 'σ 从 80 降到 4（EDM 原为 0.002），5 步'], ['理由', '生成从高 σ 开始，那里练得少就一步错步步错；最后几步 σ≈0 反而不准']]) +
        '<p>灰柱是基础模型的分布，橙柱是 Cosmos Policy 的混合分布，横轴是 log σ。均匀部分在 1 到 85 之间加了一层“平台”。</p>' +
        '<p>下面的圆点是推理时 5 个去噪步的 σ。没有走到 σ≈0，最后一步在 σ = 4 直接取模型给出的干净估计。</p>' +
        live('柱高 = 每个对数区间的概率，用正态分布函数当场算；右下读数是当前阈值以上的概率。') + guess('5 个步点按 EDM 常用的 ρ = 7 间隔画，代码用的采样器是 2ab 多步法，步点的精确位置我没核对。') +
        src('附录 A.2.1 图 9 · hybrid_edm_sde.py · 配置 __inference_only（sigma_max 80，sigma_min 4）') },
    { n: 7, part: '§4.2 / A.3 推理', title: '直接当策略用：并行去噪，只取动作', sub: '切换去噪步数，看延迟', dur: 13, cam: [0.0, 1.05, 30, [0, 2.4, 0]],
      html: dl([['条件', '当前本体、两张图、文本'], ['生成', '动作、未来本体、未来图、价值一起去噪'], ['步数', 'LIBERO / RoboCasa 5 步，ALOHA 10 步'], ['延迟（1 张 H100）', '1 步 0.16 s，5 步 0.61 s，10 步 0.95 s'], ['执行', 'LIBERO 16 步整块；RoboCasa 32 步里执行 16；ALOHA 50 步整块']]) +
        '<p>右边 5 个目标帧从噪声一起变干净。完成后，动作帧被“展开”：所有副本取平均，反归一化成 16 × 7 的动作块，交给机器人。未来状态和价值丢掉（也可以留着看模型的意图）。</p>' +
        '<p>RoboCasa 上只用 1 步去噪还有 66.4%（5 步 67.1%），速度约快 3.8 倍。</p>' +
        guess('去噪动画里噪声线性减小，只是示意；条形图的动作值是玩具值。') + src('§4.2 · 附录 A.3.1 · A.4.2 · 表 5 · LIBERO.md 命令') },
    { n: 8, part: '§3 / §4.3 回放和价值', title: '价值目标：γ 的幂，再映射到 [−1, 1]', sub: '一条成功、一条失败回放；切换 γ', dur: 13, cam: [0.0, 1.3, 36, [0, 0.4, 0]],
      html: dl([['奖励', '只有最后一步：成功 1，失败 0'], ['回报', 'G_t = γ^(T−1−t) · R；取第 t + K 帧的回报'], ['归一化', '2G − 1 → [−1, 1]；读出时 (x + 1)/2'], ['γ', 'LIBERO / RoboCasa 0.99；ALOHA 规划模型 0.998'], ['LIBERO 数据', '成功 1,700 条训策略；全部 2,000 条（含 300 条失败）训世界模型和价值']]) +
        '<p>上面两条线是一条 300 步的成功回放和一条失败回放上的价值目标（[0, 1] 尺度）。成功回放越接近结尾价值越高；失败回放全程是 0。</p>' +
        '<p>γ = 0.99 时离结尾 100 步就只剩 0.37，所以在全是成功的演示上，价值主要编码“离完成还有多远”。规划要分辨好坏动作，必须有失败样本，这就是要收集回放的原因。</p>' +
        live('曲线按 compute_monte_carlo_returns 当场算。') + guess('300 步的回合长度是我选的。') +
        src('§3 · §4.2 · §4.3 · dataset_common.py 第 25–55 行 · 配置 gamma') },
    { n: 9, part: '§4.3 / A.4.2 规划', title: 'best-of-8：每个候选想象 3 个未来、打 15 个分', sub: '多数均值：先投票成功/失败，再在多数里平均', dur: 16, cam: [0.0, 1.0, 36, [0, 3.0, 0]],
      html: dl([['策略模型', '原检查点，采 N = 8 个动作块（10 步去噪）'], ['规划模型', '在 648 条回放上精调：90% 世界模型 + 价值，10% 策略'], ['世界模型', '每个候选 3 个未来状态（5 步）'], ['价值', '每个未来 5 个 V(s′)（5 步），共 15 个'], ['多数均值', '阈值 0.05，过半数“成功”时取成功组均值，否则 0'], ['耗时', '8 张 H100 并行，4.9 s / 动作块']]) +
        '<p>左边是当前状态。8 条橙线是 8 个候选动作块，每条通向 3 个想象的未来（方块），每个未来上 5 个点是价值预测（绿 = 高于阈值）。右边柱子是每个候选的多数均值，最高的那个被执行。</p>' +
        '<p>只做一层搜索、执行整个动作块，不做滚动时域。ALOHA 两个难任务上平均分 59.5 → 72.0；无模型的 Q(s, a) 只到 61.3。</p>' +
        live('多数均值按 cosmos_utils.py 第 794–814 行的规则当场算。') + guess('15 个价值是固定种子生成的玩具数。') +
        src('§4.3 · §5.3 图 7 · 附录 A.3.1 · A.4.2 · cosmos_utils.py · 配置 resumeFrom50K_648_rollouts_Vsprime_value_func') },
    { n: 10, part: 'LIBERO 评测', title: 'LIBERO：3 个种子 × 2,000 回合', sub: '每个小方块是一个回合；切换步数上限对比', dur: 15, cam: [0.0, 0.66, 48, [0, 0, 0.6]],
      html: dl([['模型', '一个检查点覆盖四个套件'], ['回合', '4 套件 × 10 任务 × 50 次 × 3 种子（195、196、197）= 6,000'], ['开局', '10 步空动作，夹爪张开'], ['上限', 'Spatial 220、Object 280、Goal 300、Long 520 步（同 OpenVLA）'], ['图像', '256 渲染，只上下翻转，90% 中心裁切，模型内 224'], ['分数', '98.1 / 100.0 / 98.2 / 97.6，平均 98.5']]) +
        '<p>三层是三个种子，每层 4 个套件、每个套件 10 × 50 个回合。红色是失败：按成功率反推，Spatial 约 28 个、Object 0 个、Goal 27 个、Long 36 个（三个种子合计）。</p>' +
        '<p>切到“步数上限”可以看到 Cosmos Policy 用的是 OpenVLA 的上限，比 OpenWAM 的 600 / 700 紧得多，所以 98.5 和 OpenWAM 的 99.3 不是同一协议。</p>' +
        live('失败数 = 1,500 × (1 − 成功率)，四舍五入。') + guess('失败落在哪个种子、哪个任务、第几回合是我随机放的；论文只给套件成功率。') +
        src('§5.1 · 表 1 · LIBERO.md · run_libero_eval.py 第 172–178、394–405 行 · 本页 LIBERO 设置节') },
    { n: 11, part: '结果', title: '结果', sub: '切换表格；每根柱子是原文数字', dur: 12, cam: [0.0, 1.08, 34, [0, 3.8, 0]],
      html: dl([['LIBERO', '98.5（表 1 最高）'], ['RoboCasa', '67.1，只用 50 条演示 / 任务'], ['ALOHA', '93.6；π0.5 88.6'], ['规划', '+12.5（V(s′)）；+1.8（Q(s,a)）'], ['消融', '只预测动作：44.4']]) +
        '<p>前三张是直接当策略用的成绩，第四张是规划，第五张是 RoboCasa 的逐级消融。纵轴不一定从 0 开始，标题里写明。</p>' + src('表 1 · 表 2 · 表 3 · 图 7 · 表 5') }
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
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.5, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  /* polyline whose points are replaced every frame */
  function pline(G, n, color, o = {}) {
    const pos = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: o.opacity ?? 1 })); l.frustumCulled = false; G.add(l);
    l.userData.set = pts => { const k = Math.min(n, pts.length); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)]; pos[i * 3] = q[0]; pos[i * 3 + 1] = q[1]; pos[i * 3 + 2] = q[2] ?? 0; } g.attributes.position.needsUpdate = true; g.setDrawRange(0, k); };
    return l;
  }
  /* one shared noise texture for "noisy latent" overlays */
  let NOISE = null;
  function noiseTex() {
    if (NOISE) return NOISE; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = L.rng(7), d = g.createImageData(64, 64);
    for (let i = 0; i < 64 * 64; i++) { const v = Math.floor(r() * 255); d.data[i * 4] = v; d.data[i * 4 + 1] = v; d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
    g.putImageData(d, 0, 0); NOISE = new THREE.CanvasTexture(c); NOISE.magFilter = THREE.NearestFilter; return NOISE;
  }
  /* a latent frame drawn as a slab with an optional noise veil in front */
  function slab(G, x, y, z, color, o = {}) {
    const w = o.w ?? 1.5, h = o.h ?? 1.5, d = o.d ?? 0.5; const m = block(w, h, d, color, [x, y, z], { opacity: o.opacity }); G.add(m);
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.02, h * 1.02), new THREE.MeshBasicMaterial({ map: noiseTex(), transparent: true, opacity: 0, depthWrite: false }));
    veil.position.set(x, y, z + d / 2 + 0.02); G.add(veil);
    /* role tag under the slab: green = clean condition, orange = noisy target with loss, hidden = neither */
    const tag = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d + 0.2), new THREE.MeshBasicMaterial({ color: COL.cond })); tag.position.set(x, y - h / 2 - 0.22, z); G.add(tag);
    return { m, veil, tag, set(noise, outline, fade) {
      veil.material.opacity = noise; m.material.opacity = fade ?? 1; m.material.transparent = (fade ?? 1) < 1;
      tag.visible = !!outline; tag.material.color.setHex(outline === 2 ? COL.tgt : COL.cond);
    } };
  }
  function bar(G, x, z, w, color, o = {}) { const m = block(w, 1, o.d ?? w, color, [x, 0.5, z], { edges: false }); G.add(m); m.userData.set = h => { const v = Math.max(0.001, h); m.scale.y = v; m.position.y = (o.y0 ?? 0) + v / 2; }; return m; }
  function clearSub(sub) { LABS = LABS.filter(s => { let o = s; while (o) { if (o === sub) return false; o = o.parent; } return true; }); L.clear(sub); }

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
    G.add(L.grid(40, 20));
    const B = [];
    const pick = (b, go) => { b.userData.go = go; PICKS.push(b); };
    /* inputs */
    G.add(lab('当前状态 s', [-10.5, 8.2, 0], { size: 24, border: css(COL.cond) }));
    [['腕部图', COL.img, 1], ['主相机图', COL.img, 1], ['本体 9 维', COL.prop, 2], ['任务文本（T5）', COL.text, 3]].forEach(([t, c, go], j) => {
      const b = block(4.8, 1.0, 1.4, c, [-10.5, 6.6 - j * 1.45, 0], { opacity: 0.9 }); G.add(b); pick(b, go); B.push(b); G.add(lab(t, [-10.5, 6.6 - j * 1.45, 0.9], { size: 19 }));
    });
    /* backbone */
    const dit = block(7.2, 7.0, 3.0, 0x2b3650, [0, 4.5, 0], { opacity: 0.85 }); G.add(dit); pick(dit, 3);
    for (let k = 0; k < 7; k++) { const pl = block(6.4, 0.42, 2.4, k % 2 ? COL.attn : COL.blue, [0, 1.6 + k * 0.95, 0], { opacity: 0.55, edges: false }); G.add(pl); }
    G.add(lab('Cosmos-Predict2-2B DiT\n28 块 · 结构不改', [0, 8.9, 0], { size: 22, border: 'rgba(56,209,255,.7)' }));
    G.add(lab('一条隐帧序列\n(s, a, s′, V(s′))', [0, 4.5, 1.9], { size: 19 }));
    /* outputs */
    G.add(lab('输出', [10.5, 8.2, 0], { size: 24, border: css(COL.tgt) }));
    [['动作块 a（16 × 7）', COL.act, 2], ['未来状态 s′', COL.img, 4], ['价值 V(s′)', COL.val, 7], ['best-of-N 规划', COL.gold, 8]].forEach(([t, c, go], j) => {
      const b = block(5.2, 1.0, 1.4, c, [10.5, 6.6 - j * 1.45, 0], { opacity: 0.9 }); G.add(b); pick(b, go); B.push(b); G.add(lab(t, [10.5, 6.6 - j * 1.45, 0.9], { size: 19 }));
    });
    const fin = stream(G, 12, COL.cond, 0.12), fout = stream(G, 12, COL.tgt, 0.12);
    G.add(lab('LIBERO 98.5 · RoboCasa 67.1 · ALOHA 93.6', [0, -0.3, 2.4], { size: 18 }));
    return { update(p) {
      fin([[-8, 4.5, 0], [-3.6, 4.5, 0]], (p * 2) % 1, 1); fout([[3.6, 4.5, 0], [8, 4.5, 0]], (p * 2 + 0.5) % 1, seg(p, 0.2, 0.35));
      B.forEach((b, i) => glow(b, i < 4 ? (p < 0.4 ? 0.5 : 0.1) : (p > 0.4 ? 0.5 * seg(p, 0.4 + (i - 4) * 0.1, 0.5 + (i - 4) * 0.1) : 0.05)));
      glow(dit, 0.2 + 0.2 * Math.sin(p * Math.PI * 6) ** 2);
      cap(p < 0.4 ? '<b>输入</b>：当前观测和文本，都会变成同一条序列里的隐帧' : p < 0.75 ? '<b>没改过的视频 DiT</b>：动作、未来画面、价值都当作“视频帧”来去噪' : '<b>三个输出</b>：直接当策略只取动作；规划时用未来状态和价值挑动作。点方块跳过去');
    } };
  }

  /* ---------- scene 2: 33 images -> 9 latent frames ---------- */
  function s2(G) {
    let mode = +(OPT[0] ?? 0); const sub = new THREE.Group(); G.add(sub); let last = -1, tiles = [], slabs = [], links = [];
    function rebuild() {
      clearSub(sub); last = mode; tiles = []; slabs = []; links = [];
      const seq = mode ? SEQ11 : SEQ9, nImg = 1 + (seq.length - 1) * 4, tw = mode ? 0.52 : 0.62, x0 = -(nImg - 1) * tw / 2;
      for (let k = 0; k < nImg; k++) {
        const f = k === 0 ? 0 : 1 + Math.floor((k - 1) / 4), kind = seq[f][1], c = kind === 'i' ? COL.img : kind === 'b' && f === 0 ? 0x9aa6bf : 0x101522;
        const t = block(tw * 0.86, tw * 0.86, 0.12, c, [x0 + k * tw, 6.2, 0]); sub.add(t); tiles.push({ t, f });
      }
      const sw = 26 / seq.length, sx0 = -(seq.length - 1) * sw / 2;
      seq.forEach(([nm, kind], i) => {
        const s = slab(sub, sx0 + i * sw, 1.6, 0, KC[kind], { w: Math.min(1.7, sw * 0.8), h: 1.7, d: 0.6 }); slabs.push(s);
        sub.add(lab(nm, [sx0 + i * sw, 0.2, 0.6], { size: 16 }));
        const a = i === 0 ? 0 : 1 + (i - 1) * 4, b = i === 0 ? 0 : a + 3; const xa = x0 + a * tw, xb = x0 + b * tw;
        links.push(wire(sub, [[xa, 5.75, 0], [(xa + xb) / 2, 5.2, 0], [sx0 + i * sw, 2.6, 0]], KC[kind], { opacity: 0 }));
        if (b > a) links.push(wire(sub, [[xb, 5.75, 0], [(xa + xb) / 2, 5.2, 0]], KC[kind], { opacity: 0 }));
      });
      sub.add(lab(`${nImg} 张图（224 × 224）`, [0, 7.4, 0], { size: 20, border: 'rgba(56,209,255,.7)' }));
      sub.add(lab(`Wan2.1 VAE → ${seq.length} 个隐帧，每个 28 × 28 × 16`, [0, 3.4, 0], { size: 20, border: css(COL.tgt) }));
      sub.add(lab('彩色 = 相机画面 · 黑 = 占位（之后注入本体 / 动作 / 价值）', [0, -1.2, 0.6], { size: 16 }));
    }
    rebuild();
    const ctls = [{ label: '平台', items: ['LIBERO（9 帧）', 'RoboCasa / ALOHA（11 帧）'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      if (last !== mode) rebuild();
      const seq = mode ? SEQ11 : SEQ9, nImg = 1 + (seq.length - 1) * 4, shown = Math.round(seg(p, 0, 0.4) * nImg);
      tiles.forEach(({ t, f }, k) => { const on = k < shown; t.scale.setScalar(on ? 1 : 0.001); glow(t, on && Math.floor(p * 30) % seq.length === f ? 0.6 : 0); });
      const enc = seg(p, 0.45, 0.85); slabs.forEach((s, i) => { const on = clamp(enc * seq.length - i, 0, 1); s.m.scale.setScalar(Math.max(0.001, on)); s.set(0, 0); });
      links.forEach(l => { l.material.opacity = 0.55 * enc; });
      cap(`1 + 4 × ${seq.length - 1} = <b>${nImg}</b> 张图 → 1 + (${nImg} − 1)/4 = <b>${seq.length}</b> 个隐帧 · 每 4 张相同的图 = 同一个时刻`);
    } };
  }

  /* ---------- scene 3: latent injection into a 28x28x16 volume ---------- */
  function s3(G) {
    let mode = +(OPT[0] ?? 0);
    const H = 28, C = 16, N = H * H * C, dx = 0.24, x0 = -(H - 1) * dx / 2;
    const im = inst(BOX, N); G.add(im);
    const pos = i => { const c = Math.floor(i / (H * H)), r = i % (H * H), y = Math.floor(r / H), x = r % H; return [x0 + x * dx, 0.3 + (H - 1 - y) * dx, -c * 0.32 + 2.4]; };
    for (let i = 0; i < N; i++) setI(im, i, pos(i), 0.2);
    done(im);
    const MOD = [{ nm: 'LIBERO 动作 16×7', n: 112 }, { nm: 'LIBERO 本体 9', n: 9 }, { nm: 'ALOHA 动作 50×14', n: 700 }, { nm: '价值 1', n: 1 }];
    const vals = n => { const r = L.rng(11 + n); return Array.from({ length: n }, (_, i) => n === 1 ? 0.46 : clamp(0.8 * Math.sin(i * 0.37 + r() * 0.6) + 0.15 * (r() - 0.5), -1, 1)); };
    let V = vals(MOD[mode].n), lastM = mode;
    const cmap = v => { const t = (v + 1) / 2; return [L.lerp(0.23, 0.94, t), L.lerp(0.66, 0.59, t), L.lerp(0.88, 0.24, t)]; };
    G.add(lab('一个隐帧：16 层 × 28 × 28 = 12,544 个数', [0, 8.4, 0], { size: 20, border: 'rgba(56,209,255,.7)' }));
    G.add(lab('第 1 层', [x0 - 1.2, 0.3, 2.4], { size: 16 })); G.add(lab('第 16 层', [x0 - 1.2, 0.3, 2.4 - 15 * 0.32], { size: 16 }));
    const ctls = [{ label: '模态', items: MOD.map(m => m.nm), get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      if (lastM !== mode) { V = vals(MOD[mode].n); lastM = mode; }
      const n = MOD[mode].n, fill = Math.floor(seg(p, 0.05, 0.8) * N), full = Math.floor(N / n), copies = N / n;
      for (let i = 0; i < N; i++) { const on = i < fill, j = i % n, partial = i >= full * n; const c = on ? cmap(V[j]) : [0.1, 0.12, 0.17]; const k = partial && on ? 0.45 : 1; colI(im, i, [c[0] * k, c[1] * k, c[2] * k]); }
      done(im);
      const cur = Math.floor(fill / n);
      cap(`${MOD[mode].nm}：12,544 ÷ ${n} = <b>${Number.isInteger(copies) ? copies : copies.toFixed(2)}</b> 份` + (Number.isInteger(copies) ? '，正好整除' : `，不整除：写入时截断，读出只平均完整的 <b>${full}</b> 份（暗色是多出的残片）`) + ` · 已写入第 ${Math.min(cur + 1, Math.ceil(copies))} 份`);
    } };
  }

  /* ---------- scene 4: DiT, tokens and per-frame sigma ---------- */
  function s4(G) {
    let mode = +(OPT[0] ?? 0); const sub = new THREE.Group(); G.add(sub); let last = -1, toks = null, plates = [], nT = 0;
    function rebuild() {
      clearSub(sub); last = mode; plates = [];
      const seq = mode ? SEQ11 : SEQ9, nf = seq.length, per = 14, d = 0.16, gw = per * d + 0.35, X0 = -(nf - 1) * gw / 2;
      nT = nf * per * per; toks = inst(BOX, nT); sub.add(toks);
      let k = 0; seq.forEach(([nm, kind, c], f) => { for (let a = 0; a < per; a++) for (let b = 0; b < per; b++) { setI(toks, k, [X0 + f * gw + (b - per / 2) * d, 0.2, (a - per / 2) * d + 2.4], [d * 0.8, 0.12, d * 0.8]); const cc = hex3(KC[kind]); colI(toks, k, cc); k++; }
        sub.add(lab(nm, [X0 + f * gw, -0.5, 4.2], { size: 15 })); sub.add(lab(c ? 'σ=0' : 'σ', [X0 + f * gw, 0.9, 4.2], { size: 15, color: c ? css(COL.cond) : css(COL.tgt) })); });
      done(toks);
      for (let b = 0; b < 28; b++) { const pl = block(nf * gw * 0.92, 0.12, 1.4, b % 2 ? 0x34406a : 0x2b3650, [0, 1.6 + b * 0.27, -1.6], { opacity: 0.6, edges: false }); sub.add(pl); plates.push(pl); }
      sub.add(lab('28 个块：自注意力 → 交叉注意力（T5）→ 前馈；σ 经 AdaLN', [0, 9.9, -1.6], { size: 19, border: 'rgba(56,209,255,.7)' }));
      sub.add(lab(`${nf} 帧 × 196 = ${fmt(nT)} 个 token`, [0, -1.7, 4.2], { size: 19, border: css(COL.tgt) }));
      sub.add(lab('T5 文本', [nf * gw * 0.5 + 2.2, 5.6, -1.6], { size: 18, border: css(COL.text) }));
      wire(sub, [[nf * gw * 0.5 + 1.2, 5.6, -1.6], [nf * gw * 0.46, 5.6, -1.6]], COL.text, { opacity: 0.8 });
    }
    rebuild();
    const ctls = [{ label: '序列', items: ['LIBERO 9 帧', '11 帧'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      if (last !== mode) rebuild();
      const lev = Math.floor(p * 1.15 * 28); plates.forEach((pl, b) => { pl.material.emissive.setRGB(b === lev ? 0.25 : 0, b === lev ? 0.5 : 0, b === lev ? 0.65 : 0); });
      cap(`第 <b>${Math.min(28, lev + 1)}</b> / 28 块 · 所有 ${fmt(nT)} 个 token 在一个自注意力里互相看 · 条件帧在输入输出两端都被换回真值，不算损失`);
    } };
  }

  /* ---------- scene 5: three masks over one sequence ---------- */
  function s5(G) {
    let mode = +(OPT[0] ?? 0);
    const seq = SEQ9, sw = 2.6, X0 = -(seq.length - 1) * sw / 2, S5 = [];
    seq.forEach(([nm, kind], i) => { S5.push(slab(G, X0 + i * sw, 2.2, 0, KC[kind], { w: 1.9, h: 1.9, d: 0.6 })); G.add(lab(nm, [X0 + i * sw, i % 2 ? -0.95 : -0.1, 0.6], { size: 15 })); });
    G.add(lab('s', [X0 + 2 * sw, -2.6, 0.6], { size: 20 })); G.add(lab('a', [X0 + 4 * sw, -2.6, 0.6], { size: 20 })); G.add(lab('s′', [X0 + 6 * sw, -2.6, 0.6], { size: 20 })); G.add(lab('V(s′)', [X0 + 8 * sw, -2.6, 0.6], { size: 20 }));
    const tsub = new THREE.Group(); G.add(tsub); let tKey = null;
    /* batch proportion bar */
    const parts = [[0.5, COL.cond, '策略 50%'], [0.25, COL.blue, '世界模型 25%'], [0.25, COL.val, '价值 25%']]; let xx = -9;
    parts.forEach(([f, c, t], i) => { const b = block(18 * f - 0.1, 0.5, 0.5, c, [xx + 9 * f, 7.6, 0], { opacity: 0.85 }); G.add(b); G.add(lab(t, [xx + 9 * f, i === 2 ? 9.3 : 8.4, 0], { size: 16 })); xx += 18 * f; });
    const ctls = [{ label: '掩码', items: ['自动', ...MODES.map(m => m.nm)], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const m = mode ? mode - 1 : Math.min(2, Math.floor(p * 3)), M = MODES[m], roles = M.r(seq), q = mode ? p : (p * 3) % 1;
      const noise = 0.85 * (1 - 0.6 * seg(q, 0.3, 0.9));
      S5.forEach((s, i) => { const r = roles[i]; s.set(r === 1 ? 0 : noise, r === 1 ? 1 : r === 0 ? 2 : 0, r === 2 ? 0.25 : 1); });
      const key = M.nm; if (key !== tKey) { tKey = key; clearSub(tsub); tsub.add(lab(`${M.nm}：${M.f}`, [0, 5.4, 0], { size: 22, border: 'rgba(56,209,255,.7)' })); }
      const nT = roles.filter(r => r === 0).length, nC = roles.filter(r => r === 1).length - 1;
      cap(`<b>${M.nm}</b> · 绿条 = 干净条件（${nC} 帧 + 空白首帧）· 橙条 = 去噪并算损失（${nT} 帧）` + (roles.includes(2) ? ' · 半透明 = 被掩掉：加噪但不算损失' : ''));
    } };
  }

  /* ---------- scene 6: noise distributions ---------- */
  function s6(G) {
    const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
    const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2)), mu = Math.log(4), sd = 1.2;
    const cdfLN = s => Phi((Math.log(s) - mu) / sd), cdfU = s => clamp((s - 1) / 84, 0, 1), cdfH = s => 0.7 * cdfLN(s) + 0.3 * cdfU(s);
    const lo = Math.log(0.01), hi = Math.log(200), NB = 36, bw = 0.62, X0 = -(NB - 1) * bw / 2, BA = [], BB = [];
    for (let i = 0; i < NB; i++) { const a = Math.exp(lo + (hi - lo) * i / NB), b = Math.exp(lo + (hi - lo) * (i + 1) / NB);
      const pa = cdfLN(b) - cdfLN(a), pb = cdfH(b) - cdfH(a);
      const m1 = bar(G, X0 + i * bw - 0.14, 0, 0.26, COL.gray), m2 = bar(G, X0 + i * bw + 0.14, 0, 0.26, COL.tgt); BA.push([m1, pa]); BB.push([m2, pb]); }
    const xOf = s => X0 - bw / 2 + (Math.log(s) - lo) / (hi - lo) * NB * bw;
    [0.01, 0.1, 1, 4, 10, 85, 200].forEach(s => { G.add(lab(String(s), [xOf(s), -0.6, 0.6], { size: 15 })); wire(G, [[xOf(s), 0, 0.3], [xOf(s), -0.3, 0.3]], COL.gray, { opacity: 0.7 }); });
    G.add(lab('σ（对数轴）', [X0 + NB * bw / 2 + 2, -1.5, 0.6], { size: 16 }));
    G.add(lab('灰：基础模型 ln σ ~ N(ln 4, 1.2²)　橙：0.7 × 它 + 0.3 × U[1, 85]', [0, 8.6, 0], { size: 19, border: 'rgba(56,209,255,.7)' }));
    /* inference sigma points (EDM rho = 7 spacing, illustrative) */
    const rho = 7, smax = 80, smin = 4, steps = Array.from({ length: 5 }, (_, i) => Math.pow(smax ** (1 / rho) + i / 4 * (smin ** (1 / rho) - smax ** (1 / rho)), rho));
    const dots = steps.map(s => { const d = L.sphere(0.24, COL.val); d.userData.c = hex3(COL.val); d.position.set(xOf(s), -2.6, 0.6); G.add(d); return d; });
    G.add(lab('推理 5 步：σ 80 → 4（示意间隔）', [xOf(18), -3.6, 0.6], { size: 16 }));
    const thr = L.box(0.06, 7.4, 0.06, COL.white, { opacity: 0.8 }); G.add(thr);
    return { update(p) {
      const g = seg(p, 0, 0.35); BA.forEach(([m, v]) => m.userData.set(v * 34 * g)); BB.forEach(([m, v]) => m.userData.set(v * 34 * seg(p, 0.15, 0.5)));
      const s = Math.exp(Math.log(1) + seg(p, 0.5, 0.95) * (Math.log(80) - Math.log(1))); thr.position.set(xOf(s), 3.7, 0.2);
      const k = Math.floor(seg(p, 0.55, 1) * 5); dots.forEach((d, i) => glow(d, i === Math.min(4, k) ? 0.9 : 0.1));
      cap(`P(σ &gt; ${s < 10 ? s.toFixed(1) : s.toFixed(0)})：基础 <b>${(100 * (1 - cdfLN(s))).toFixed(1)}%</b> → Cosmos Policy <b>${(100 * (1 - cdfH(s))).toFixed(1)}%</b> · 推理第 ${Math.min(5, k + 1)} 步 σ ≈ ${steps[Math.min(4, k)].toFixed(1)}`);
    } };
  }

  /* ---------- scene 7: parallel decoding and action read-out ---------- */
  function s7(G) {
    let mode = +(OPT[0] ?? 1); const STEPS = [1, 5, 10], LAT = [0.16, 0.61, 0.95];
    const seq = SEQ9, sw = 2.4, X0 = -(seq.length - 1) * sw / 2, SL = [];
    seq.forEach(([nm, kind], i) => { SL.push(slab(G, X0 + i * sw, 5.4, 0, KC[kind], { w: 1.7, h: 1.7, d: 0.5 })); G.add(lab(nm, [X0 + i * sw, 3.5, 0.5], { size: 15 })); });
    /* unfolded 16 x 7 action chunk as bars */
    const r = L.rng(3), A = Array.from({ length: 16 }, (_, t) => Array.from({ length: 7 }, (_, d) => d === 6 ? (t < 9 ? -1 : 1) : 0.7 * Math.sin(t * 0.35 + d * 0.9) + 0.1 * (r() - 0.5)));
    const im = inst(BOX, 112); G.add(im); const ax = X0 + 4 * sw;
    G.add(lab('取平均 → 反归一化 → 16 步 × 7 维动作块', [ax, -0.4, 2.8], { size: 18, border: css(COL.act) }));
    G.add(lab('未来状态、价值：丢掉', [X0 + 7 * sw, 2.6, 0.5], { size: 16 }));
    const ctls = [{ label: '去噪步数', items: STEPS.map(s => s + ' 步'), get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const n = STEPS[mode], q = seg(p, 0.05, 0.55), k = Math.min(n, Math.floor(q * n + 1e-9));
      SL.forEach((s, i) => { const c = seq[i][2]; s.set(c ? 0 : 0.85 * (1 - k / n), c ? 1 : 2); });
      const u = seg(p, 0.6, 0.9);
      for (let t = 0; t < 16; t++) for (let d = 0; d < 7; d++) { const v = A[t][d], h = Math.max(0.02, Math.abs(v) * 1.4 * u), i = t * 7 + d; setI(im, i, [ax - 3 + t * 0.4, 0.6 + h / 2, d * 0.4 - 1.0], [0.3, h, 0.3]); const c = v >= 0 ? hex3(COL.act) : hex3(COL.blue); colI(im, i, c); }
      done(im);
      cap(`${n} 步去噪，第 <b>${k}</b> / ${n} 步 · 1 张 H100 约 <b>${LAT[mode]} s</b> 出一个动作块` + (mode === 0 ? '（RoboCasa 66.4%）' : mode === 1 ? '（LIBERO / RoboCasa 用这个）' : '（ALOHA 用这个）'));
    } };
  }

  /* ---------- scene 8: Monte Carlo returns ---------- */
  function s8(G) {
    let mode = +(OPT[0] ?? 0); const GAM = [0.99, 0.998], T = 300, W = 18, Hh = 6, X0 = -W / 2, Y0 = 1;
    const ret = (g, succ) => Array.from({ length: T }, (_, t) => succ ? Math.pow(g, T - 1 - t) : 0);
    wire(G, [[X0, Y0, 0], [X0 + W, Y0, 0]], COL.gray, { opacity: 0.8 }); wire(G, [[X0, Y0, 0], [X0, Y0 + Hh, 0]], COL.gray, { opacity: 0.8 });
    [0, 0.5, 1].forEach(v => G.add(lab(v.toFixed(1), [X0 - 0.8, Y0 + v * Hh, 0], { size: 15 })));
    [0, 100, 200, 300].forEach(t => G.add(lab(String(t), [X0 + t / T * W, Y0 - 0.6, 0], { size: 15 })));
    G.add(lab('时间步', [X0 + W + 1.2, Y0 - 0.6, 0], { size: 15 }));
    const ls = pline(G, T, COL.ok), lf = pline(G, T, COL.bad);
    G.add(lab('成功回放', [X0 + W - 1.5, Y0 + Hh + 0.6, 0], { size: 17, color: css(COL.ok) })); G.add(lab('失败回放：全程 0', [X0 + 4, Y0 + 0.6, 0], { size: 17, color: css(COL.bad) }));
    const dot = L.sphere(0.2, COL.val); G.add(dot);
    /* data mix bars */
    const mix = [[1700, COL.ok, '成功演示 1,700（策略）'], [1700, 0x2f8f5a, '回放·成功 1,700'], [300, COL.bad, '回放·失败 300']];
    mix.forEach(([n, c, t], i) => { const b = bar(G, (i - 1) * 6.5, 0, 1.4, c, { d: 1.0, y0: -6.2 }); b.userData.set(n / 1700 * 2.4); G.add(lab(t, [(i - 1) * 6.5, -6.9, 0.8], { size: 15 })); });
    G.add(lab('LIBERO 数据；代码把回放里的成功 / 失败按 1 : 1 重采样', [0, -2.8, 0], { size: 16, border: css(COL.bad) }));
    const ctls = [{ label: 'γ', items: ['0.99（LIBERO / RoboCasa）', '0.998（ALOHA 规划）'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      const g = GAM[mode], rs = ret(g, 1), rf = ret(g, 0), m = Math.max(2, Math.floor(seg(p, 0, 0.7) * T));
      ls.userData.set(rs.slice(0, m).map((v, t) => [X0 + t / T * W, Y0 + v * Hh, 0])); lf.userData.set(rf.slice(0, m).map((v, t) => [X0 + t / T * W, Y0 + v * Hh + 0.04, 0]));
      const t = Math.min(T - 1, m - 1); dot.position.set(X0 + t / T * W, Y0 + rs[t] * Hh, 0);
      cap(`γ = ${g} · 第 ${t} 步（离结尾 ${T - 1 - t} 步）：G = ${g}<sup>${T - 1 - t}</sup> = <b>${rs[t].toFixed(3)}</b> → 训练目标 2G − 1 = <b>${(2 * rs[t] - 1).toFixed(3)}</b>`);
    } };
  }

  /* ---------- scene 9: best-of-N planning ---------- */
  function s9(G) {
    const N = 8, r = L.rng(21), TH = 0.05;
    /* toy value predictions: 8 candidates x 3 futures x 5 values in [0,1] */
    const Q = Array.from({ length: N }, (_, c) => { const good = [0.62, 0.15, 0.48, 0.71, 0.05, 0.55, 0.3, 0.66][c]; return Array.from({ length: 3 }, () => Array.from({ length: 5 }, () => r() < good ? clamp(0.35 + 0.5 * r(), 0, 1) : 0.02 * r())); });
    const mm = vals => { const f = vals.flat(), s = f.filter(v => v > TH); return s.length >= f.length / 2 ? s.reduce((a, b) => a + b, 0) / s.length : 0; };
    const SC = Q.map(mm), best = SC.indexOf(Math.max(...SC));
    const s0 = block(2.2, 2.2, 0.6, COL.cond, [-12, 3.5, 0]); G.add(s0); G.add(lab('当前 s', [-12, 5.2, 0], { size: 18 }));
    const legs = [], futs = [], dots = inst(BALL, N * 15); G.add(dots);
    for (let c = 0; c < N; c++) {
      const y = 7.2 - c * 1.05, l = wire(G, [[-10.9, 3.5, 0], [-6, y, 0]], COL.act, { opacity: 0 }); legs.push(l);
      const a = block(0.9, 0.5, 0.3, COL.act, [-5.5, y, 0]); G.add(a); legs.push(a);
      for (let f = 0; f < 3; f++) { const b = block(0.7, 0.7, 0.3, COL.img, [-3.4 + f * 2.6, y, 0]); G.add(b); futs.push(b); }
    }
    const bars = SC.map((v, c) => { const b = block(1, 0.6, 0.6, COL.purple, [7, 7.2 - c * 1.05, 0], { edges: false }); G.add(b); return b; });
    G.add(lab('8 个动作块', [-5.5, 8.4, 0], { size: 16 })); G.add(lab('每个 3 个未来 s′，每个 s′ 上 5 个价值', [-0.8, 8.4, 0], { size: 16 })); G.add(lab('多数均值', [8, 8.4, 0], { size: 16 }));
    const lbls = SC.map((v, c) => { const t = lab(v.toFixed(2), [10.2, 7.2 - c * 1.05, 0], { size: 15 }); G.add(t); return t; });
    G.add(lab('每个分支：10 + 3×5 + 15×5 = 100 次去噪前向 · 8 张 H100 并行 · 4.9 s', [0, -1.6, 0], { size: 17, border: 'rgba(56,209,255,.7)' }));
    return { update(p) {
      const a = seg(p, 0, 0.2), w = seg(p, 0.2, 0.45), v = seg(p, 0.45, 0.7), s = seg(p, 0.7, 0.85), pick = p > 0.85;
      legs.forEach(l => { if (l.type === 'Line') l.material.opacity = 0.7 * a; else l.scale.setScalar(Math.max(0.001, a)); });
      futs.forEach(b => b.scale.setScalar(Math.max(0.001, w)));
      let k = 0; for (let c = 0; c < N; c++) for (let f = 0; f < 3; f++) for (let j = 0; j < 5; j++) { const val = Q[c][f][j], y = 7.2 - c * 1.05; setI(dots, k, [-3.4 + f * 2.6 - 0.32 + j * 0.16, y + 0.55 + val * 0.25, 0.2], 0.075 * v + 0.0001); colI(dots, k, hex3(val > TH ? COL.ok : COL.bad)); k++; }
      done(dots);
      bars.forEach((b, c) => { const h = Math.max(0.02, SC[c] * 5 * s); b.scale.x = h; b.position.x = 6 + h / 2; glow(b, pick && c === best ? 1 : 0); lbls[c].visible = s > 0.5; lbls[c].position.x = 12.2; });
      const cnt = Q[best].flat().filter(x => x > TH).length;
      cap(p < 0.2 ? '策略模型采 <b>8</b> 个候选动作块' : p < 0.45 ? '规划模型为每个候选想象 <b>3</b> 个未来状态' : p < 0.7 ? '每个未来状态打 <b>5</b> 个价值，共 15 个（绿 = 高于阈值 0.05）' : `候选 ${best + 1}：${cnt}/15 票成功，多数均值 <b>${SC[best].toFixed(2)}</b> 最高 → 执行它的整个动作块`);
    } };
  }

  /* ---------- scene 10: LIBERO evaluation grid ---------- */
  function s10(G) {
    let mode = +(OPT[0] ?? 0); const sub = new THREE.Group(); G.add(sub); let last = -1, im = null;
    const SR = [98.1, 100.0, 98.2, 97.6], NM = ['Spatial', 'Object', 'Goal', 'Long'], FAIL = SR.map(s => Math.round(1500 * (1 - s / 100)));
    const r = L.rng(5), fails = FAIL.map(n => { const set = new Set(); while (set.size < n) set.add(Math.floor(r() * 1500)); return set; });
    const cell = 0.15, pos = (s, seed, t, j) => [(s - 1.5) * 10 + (t - 4.5) * 0.92 + ((j % 5) - 2) * 0.17, 0.1, (seed - 1) * 3.0 + (Math.floor(j / 5) - 4.5) * 0.17];
    function rebuild() {
      clearSub(sub); last = mode;
      if (mode === 0) {
        im = inst(BOX, 6000); sub.add(im);
        NM.forEach((n, s) => sub.add(lab(`${n} ${SR[s].toFixed(1)}%`, [(s - 1.5) * 10, 0.4, -5.6], { size: 18 })));
        ['种子 195', '种子 196', '种子 197'].forEach((t, k) => sub.add(lab(t, [-21.2, 0.3, (k - 1) * 3.0], { size: 15 })));
        sub.add(lab('每块 = 10 个任务（左右）× 50 个回合（5 × 10 小格）', [0, 0.4, 5.6], { size: 16 }));
      } else {
        im = null; const lim = [[220, 280, 300, 520], [600, 600, 600, 700]], cols = [COL.act, COL.blue];
        NM.forEach((n, s) => { sub.add(lab(n, [(s - 1.5) * 6, -0.6, 1.6], { size: 17 }));
          lim.forEach((L2, k) => { const b = bar(sub, (s - 1.5) * 6 + (k - 0.5) * 1.6, 0, 1.3, cols[k]); b.userData.set(L2[s] / 80); b.userData.v = L2[s] / 80; sub.add(lab(String(L2[s]), [(s - 1.5) * 6 + (k - 0.5) * 1.6, L2[s] / 80 + 0.5, 0], { size: 15 })); }); });
        sub.add(lab('橙：Cosmos Policy（= OpenVLA）　蓝：OpenWAM', [0, -0.6, 4.2], { size: 17 }));
        sub.add(lab('最长步数（不含开局空等）', [0, 10.6, -2], { size: 19, border: 'rgba(56,209,255,.7)' }));
      }
    }
    rebuild();
    const ctls = [{ label: '看', items: ['6,000 个回合', '步数上限对比'], get: () => mode, set: k => { mode = k; } }];
    return { ctls, update(p) {
      if (last !== mode) rebuild();
      if (mode === 0) {
        const shown = Math.floor(seg(p, 0, 0.85) * 6000); let i = 0, fsum = 0;
        for (let s = 0; s < 4; s++) for (let seed = 0; seed < 3; seed++) for (let t = 0; t < 10; t++) for (let j = 0; j < 50; j++) { const idx = seed * 500 + t * 50 + j, bad = fails[s].has(idx), ord = seed * 2000 + s * 500 + t * 50 + j, on = ord < shown;
          if (on && bad) fsum++; setI(im, i, pos(s, seed, t, j), on ? cell : 0.0001); colI(im, i, hex3(bad ? COL.bad : COL.ok)); i++; }
        done(im);
        cap(`已跑 <b>${fmt(shown)}</b> / 6,000 回合 · 失败 ${fsum} · 三种子合计失败：Spatial ${FAIL[0]}、Object ${FAIL[1]}、Goal ${FAIL[2]}、Long ${FAIL[3]} → 平均 98.5%`);
      } else cap('Long 520 对 700：Cosmos Policy 的 98.5 是在更紧的上限下测的，不能和 OpenWAM 的 99.3 直接比');
    } };
  }

  /* ---------- scene 11: results ---------- */
  function s11(G) {
    let view = +(OPT[0] ?? 0); G.add(L.grid(34, 34)); const sub = new THREE.Group(); G.add(sub);
    const T = [
      { t: '表 1 · LIBERO 平均（%）', g: ['DP', 'Dita', 'π0', 'UniVLA', 'π0.5', 'OFT', 'CogVLA', 'Cosmos'], s: [['', COL.blue, [72.4, 92.3, 94.2, 95.2, 96.9, 97.1, 97.4, 98.5]]], lo: 70 },
      { t: '表 2 · RoboCasa 平均（%）', g: ['N1', 'UVA', 'DP-VLA', '+DreamGen', 'UWM', 'π0', 'N1.5', 'Video P.', 'FLARE', 'Cosmos'], s: [['', COL.cond, [49.6, 50.0, 57.3, 57.6, 60.8, 62.5, 64.1, 66.0, 66.4, 67.1]]], lo: 40 },
      { t: '图 4 / 表 3 · ALOHA 分数', g: ['X on plate', 'fold shirt', 'candies', 'ziploc', '平均'], s: [['π0.5', COL.gold, [98.3, 99.5, 95.2, 61.5, 88.6]], ['Cosmos', COL.act, [100.0, 99.5, 89.6, 85.4, 93.6]]], lo: 0 },
      { t: '图 7 · 规划（难初始条件）', g: ['candies', 'ziploc', '平均'], s: [['不规划', COL.gray, [49.0, 70.0, 59.5]], ['Q(s,a)', COL.blue, [52.0, 70.7, 61.3]], ['V(s′)', COL.purple, [60.0, 84.0, 72.0]]], lo: 0 },
      { t: '表 5 · RoboCasa 逐级消融（%）', g: ['完整', '−价值样本', '−世界模型样本', '−价值辅助', '−未来状态辅助', '1 步去噪'], s: [['', COL.act, [67.1, 66.6, 64.0, 62.5, 44.4, 66.4]]], lo: 40 }
    ];
    let bars = [], last = -1;
    function rebuild() {
      clearSub(sub); bars = []; last = view; const v = T[view], Ng = v.g.length, Ns = v.s.length, gw = Math.min(4.6, 30 / Ng), w = Math.min(1.4, (gw - 0.6) / Ns);
      v.g.forEach((nm, i) => { const x0 = (i - (Ng - 1) / 2) * gw; sub.add(lab(nm, [x0, -0.2, 2.6], { size: 16 }));
        v.s.forEach(([sn, c, vals], j) => { const x = x0 + (j - (Ns - 1) / 2) * (w + 0.08), b = block(w, 1, w, c, [x, 0.5, 0], { edges: false }); sub.add(b); const l = lab(String(vals[i]), [x, 0, 0], { size: 15 }); sub.add(l); bars.push({ b, l, v: vals[i] }); }); });
      if (Ns > 1) v.s.forEach(([sn, c], j) => { sub.add(lab(sn, [-12 + j * 4.2, 9.2, 0], { size: 18, color: css(c) })); });
      sub.add(lab(v.t + (v.lo ? `（纵轴从 ${v.lo} 起）` : ''), [Ns > 1 ? 5 : 0, 9.2, 0], { size: 21, border: 'rgba(56,209,255,.7)' }));
    }
    rebuild();
    const ctls = [{ label: '表', items: ['LIBERO', 'RoboCasa', 'ALOHA', '规划', '消融'], get: () => view, set: k => { view = k; } }];
    const MSG = ['Cosmos Policy 98.5，比 CogVLA 高 1.1 点；Long 97.6 是各方法里最高', '只用 50 条人工演示 / 任务，高于用 300 条的 GR00T-N1.5（64.1）', '密封袋 85.4 对 61.5 拉开差距；糖果碗上 π0.5 更高（95.2 对 89.6）', 'V(s′) 规划 +12.5；Q(s,a) 只 +1.8', '只预测动作时掉到 44.4：预测未来状态是关键'];
    return { ctls, update(p) {
      if (last !== view) rebuild();
      const lo = T[view].lo, g = seg(p, 0, 0.5);
      bars.forEach(({ b, l, v }) => { const h = Math.max(0.02, (v - lo) / (100 - lo) * 7 * g); b.scale.y = h; b.position.y = h / 2; l.position.y = h + 0.4; });
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
