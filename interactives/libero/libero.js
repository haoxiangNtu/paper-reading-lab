'use strict';
/* LIBERO (arXiv 2306.03310) taken apart into eleven animated scenes. Sizes, hyperparameters and task names come from the
   paper and from the official code at commit 8f1084e. Each scene's update(p) is a pure function of the timeline p plus the
   current toggles. The arm and its trajectories are hand-made; scenes 8 and 9 use a toy success matrix that is labelled as
   such. Scene 10 and 11 bars are the paper's / OpenVLA's numbers. No LIBERO policy runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { data: 0x38d1ff, tmpl: 0x9d8cff, obj: 0xf2c14e, bddl: 0x4fc98a, init: 0x7cb8ff, demo: 0xf0963c, pol: 0xd45fa0, eval: 0x4fc98a,
    table: 0x8a6a4a, bowl: 0x2b2f3a, plate: 0xe6ecf7, basket: 0xc9a46a, cab: 0x6b4a33, stove: 0x3b4660, red: 0xe05d5d, ok: 0x4fc98a,
    bad: 0xe05d5d, dim: 0x46506a, white: 0xeef2fa, arm: 0xc9d4ea, mem: 0x38d1ff, ewc: 0xf2a0a0, pack: 0x9d8cff, seq: 0xf0963c, gold: 0xf2c14e };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const f2 = x => x.toFixed(2), f3 = x => x.toFixed(3);
  const wrap = (t, n) => { const w = t.split(' '), out = []; let line = ''; for (const x of w) { if ((line + ' ' + x).trim().length > n && line) { out.push(line); line = x; } else line = (line + ' ' + x).trim(); } if (line) out.push(line); return out.join('\n'); };

  /* real task names from libero/libero/benchmark/libero_suite_task_map.py (commit 8f1084e) */
  const TASKS = {
    spatial: ['between the plate and the ramekin', 'next to the ramekin', 'from table center', 'on the cookie box', 'in the top drawer of the wooden cabinet', 'on the ramekin', 'next to the cookie box', 'on the stove', 'next to the plate', 'on the wooden cabinet'],
    object: ['alphabet soup', 'cream cheese', 'salad dressing', 'bbq sauce', 'ketchup', 'tomato sauce', 'butter', 'milk', 'chocolate pudding', 'orange juice'],
    goal: ['open the middle drawer of the cabinet', 'put the bowl on the stove', 'put the wine bottle on top of the cabinet', 'open the top drawer and put the bowl inside', 'put the bowl on top of the cabinet', 'push the plate to the front of the stove', 'put the cream cheese in the bowl', 'turn on the stove', 'put the bowl on the plate', 'put the wine bottle on the rack'],
    long: ['put both the alphabet soup and the tomato sauce in the basket', 'put both the cream cheese box and the butter in the basket', 'turn on the stove and put the moka pot on it', 'put the black bowl in the bottom drawer of the cabinet and close it', 'put the white mug on the left plate and put the yellow and white mug on the right plate', 'pick up the book and place it in the back compartment of the caddy', 'put the white mug on the plate and put the chocolate pudding to the right of the plate', 'put both the alphabet soup and the cream cheese box in the basket', 'put both moka pots on the stove', 'put the yellow and white mug in the microwave and close it']
  };

  const SCENES = [
    { n: 1, part: '总览', title: '从一句人类活动到一个分数', sub: '任务生成 → 演示 → 策略 → 终身学习 → 三个指标', dur: 14, cam: [0.0, 1.12, 34, [0, 3.6, 0]],
      html: dl([['任务', '130 个 = 10 + 10 + 10 + 100'], ['演示', '每任务 50 条，共 6,500 条'], ['仿真', 'robosuite 1.4.0，Panda，20 Hz'], ['策略', 'ResNet-RNN / ResNet-T / ViT-T + GMM'], ['算法', 'SeqL、ER、EWC、PackNet、MTL'], ['指标', 'FWT、NBT、AUC（按成功率）']]) +
        '<p>上排是“造任务”：从人类活动标注里提炼行为模板，生成指令，选场景写成 BDDL 文件，再得到每个任务的初始状态。</p>' +
        '<p>下排是“用任务”：人工遥操作采演示，训练以任务为条件的策略，按顺序一个个学，学的过程中和学完后用成功率打分。</p>' +
        '<p>点任意方块跳到讲它的那一幕。</p>' + src('§4 · 图 1、图 2 · 附录 D') },
    { n: 2, part: '§4.1 ①', title: '行为模板 → 自然语言指令', sub: '模板挖空，填进仿真器里有的物体', dur: 14, cam: [0.0, 1.22, 34, [0, 4.0, 0]],
      html: dl([['来源', 'Ego4D 的语言标注'], ['模板', '“Open …”“Put … on …”…'], ['填空', '仿真器里有的物体和固定件'], ['产出', '一句英文指令']]) +
        '<p>作者把 Ego4D 里人类活动的语言描述汇总成一批常用模板，再用仿真器里的物体填空，得到任务指令。论文的例子是从 “Open …” 生成 “Open the drawer of the cabinet”。</p>' +
        '<p>右边出现的是代码里真实存在的任务名（四个套件各取几个）。</p>' +
        guess('Ego4D 提炼模板的代码没有公开（在 8f1084e 里搜不到 ego4d）。左边四张模板卡是我从 130 个任务名反推的，不是作者的模板表。') + src('§4.1 Behavioral Templates and Instruction Generation · libero_suite_task_map.py') },
    { n: 3, part: '§4.1 ②③', title: '场景、BDDL 文件和 50 个固定初始状态', sub: '区域里采样摆放，谓词全真才算成功', dur: 18, cam: [0.0, 0.98, 30, [-1.5, 2.0, 0]],
      html: dl([['例子', 'KITCHEN_SCENE3：turn on the stove and put the moka pot on it'], [':regions', '每个物体一个 (x_min, y_min, x_max, y_max) 方框'], [':init', 'On(物体, 区域)'], [':goal', 'And(Turnon 炉子, On 摩卡壶 炉子的 cook_region)'], ['初始状态', '.pruned_init：50 个，原论文评测用前 20 个']]) +
        '<p>选好场景后，BDDL 文件写出每个物体的初始区域（桌面坐标的小方框，单位米）。仿真器在方框里随机摆放，就是 μ₀。为了评测可重复，代码给每个任务存了 50 个固定的初始状态，第 i 个回合用第 i 个。</p>' +
        '<p>后半段：机械臂把摩卡壶放上炉子、拧开炉子。两个谓词灯都绿了，<code>done</code> 才为真。摩卡壶放在区域外或炉子没开，都不算成功，没有部分得分。</p>' +
        guess('三个区域的范围按 BDDL 文件画（放大了 20 倍），摩卡壶区只有 5 cm × 5 cm。50 个点是页面用固定种子均匀采的，不是 .pruned_init 里的真实状态（那是 MuJoCo 状态向量，这里没有加载）。') +
        src('§4.1 Initial State Distribution · Goal Specifications · 附录 C.2 · bddl_files/libero_10/KITCHEN_SCENE3_…bddl · benchmark/__init__.py:76 · metric.py:111-122') },
    { n: 4, part: '§4.2 套件', title: '四个套件：每个只改一样东西', sub: '进度条走过 10 个任务。看同一个套件里什么变、什么不变', dur: 18, cam: [0.0, 1.0, 37, [0, 1.0, 0]],
      html: dl([['Spatial', '同一组物体，两个一样的碗，靠位置区分（陈述性）'], ['Object', '每个任务换一个物体放进篮子（陈述性）'], ['Goal', '同一摆放，只换目标（程序性）'], ['LIBERO-100', '90 个短任务（预训练）+ 10 个长任务（LIBERO-Long）']]) +
        '<p>前三个套件把知识类型拆开：Spatial 和 Object 考陈述性知识（在哪、是什么），Goal 考程序性知识（怎么做）。每个 10 个任务，作者说 10 个足以看到灾难性遗忘。</p>' +
        '<p>LIBERO-100 的知识是混在一起的。论文用 LIBERO-90 做预训练，LIBERO-Long（代码里叫 libero_10）做下游终身学习。后来 VLA 论文的“四个套件”是 Spatial、Object、Goal、Long。</p>' +
        guess('桌面上的物体是几何体拼的示意。四个框下方的文字是当前任务在代码里的真实名字。') + src('§4.2 · 附录 C.1 图 8–11 · libero_suite_task_map.py') },
    { n: 5, part: '§4.4 演示', title: '遥操作采 50 条演示', sub: 'SpaceMouse 控末端，20 Hz 记录观测和动作', dur: 14, cam: [0.25, 1.05, 22, [0, 2.0, 0]],
      html: dl([['设备', '3Dconnexion SpaceMouse'], ['频率', '20 Hz（每步 0.05 s）'], ['每任务', '50 条'], ['合计', '130 × 50 = 6,500 条'], ['记录', '两路图像、关节、夹爪、7 维动作']]) +
        '<p>人类专家用 6 自由度的 SpaceMouse 遥操作，机器人跟着末端控制器走。每一步存下观测和动作，一条演示就是 (o₀, a₀, o₁, a₁, …)。终身学习时这是唯一的训练数据（行为克隆）。</p>' +
        '<p>原始 HDF5 里保留了人停顿时的零动作。后来 OpenVLA 重生成数据时把这些帧删掉了（第 11 幕）。</p>' +
        guess('机械臂是两段式平面逆运动学的玩具，轨迹是我写的。点的个数按这条轨迹 6 秒、每秒 20 个算。') + src('§4.4 最后一段 · scripts/collect_demonstration.py（默认 spacemouse，control_freq 20）') },
    { n: 6, part: '接口', title: '策略看到什么、输出什么', sub: '两路 128×128 图像 + 9 维本体 + BERT；输出 7 维末端增量', dur: 14, cam: [0.1, 1.1, 30, [0, 1.6, 0]],
      html: dl([['图像', 'agentview、robot0_eye_in_hand，128 × 128'], ['本体', 'joint_pos 7 + gripper_qpos 2'], ['语言', 'BERT pooler_output，768 维'], ['动作', '7 维，前 6 维 ∈ [−1, 1]'], ['缩放', '× 0.05 m（位置）、× 0.5 rad（旋转）'], ['夹爪', '−1 张开，+1 闭合']]) +
        '<p>控制器是 robosuite 的 OSC_POSE：策略输出的前 3 维是末端位置增量，乘 0.05 m；接下来 3 维是轴角旋转增量，乘 0.5 rad；最后 1 维是夹爪。右边的读数按当前动作当场换算。</p>' +
        '<p>原论文的策略只用关节角和夹爪做本体输入，不用末端位姿（use_ee: false）。很多 VLA 论文改用末端位置和姿态。</p>' +
        guess('动作值是我设的一条平滑曲线，不是策略输出。') + src('env_wrapper.py:17-36 · configs/data/default.yaml · robosuite v1.4.0 osc_pose.json') },
    { n: 7, part: '§4.4 网络', title: '三种策略网络：token 怎么排', sub: '切换架构。看每一步有几个 token、语言从哪里进去', dur: 16, cam: [0.0, 1.1, 32, [0, 3.6, 0]],
      html: dl([['ResNet-RNN', '每步 169 维向量 → LSTM 1024 × 2'], ['ResNet-T', '每步 5 个 64 维 token × 10 步 = 50'], ['ViT-T', '空间 130 个 128 维 token → 每步 4 个 64 维 × 10 = 40'], ['输出', 'GMM，5 个分量，均值 tanh']]) +
        '<p><b>ResNet-RNN：</b>两路图像各过 ResNet（FiLM 注入语言）得 64 维，拼上关节 7、夹爪 2、语言 32 维，进 LSTM。</p>' +
        '<p><b>ResNet-T：</b>同样的 ResNet，但每路图像、语言、关节、夹爪各是一个 token，10 步一起进时间 transformer，块因果掩码。论文说语言只是单独 token，代码里 ResNet 也用了 FiLM。</p>' +
        '<p><b>ViT-T：</b>每路图像先过 7×7 卷积，再切 8×8 patch，得 64 个；两路 128 个加语言和汇总 token 进 7 层空间 transformer。汇总 token 降到 64 维，和语言、关节、夹爪组成每步 4 个 token。</p>' +
        '<p>三者都只看最近 10 步（transformer 用队列；RNN 推理时隐状态一直带到回合结束）。</p>' + src('§4.4 · 附录 A 图 6、7、表 5–7 · bc_rnn_policy.py · bc_transformer_policy.py · bc_vilt_policy.py · rgb_modules.py') },
    { n: 8, part: '§4.3 流程', title: '一个接一个地学：四种算法怎样防遗忘', sub: '切换算法。进度条走过 10 个任务', dur: 20, cam: [0.0, 1.12, 35, [0, 4.6, 0]],
      html: dl([['每任务', '50 epoch，batch 32，余弦 1e-4 → 1e-5'], ['评估', '每 5 epoch 20 回合，取最好检查点'], ['学完后', '在所有已学任务上各测 20 回合'], ['ER', '每任务存前 1000 个 10 步片段，回放 32 个'], ['EWC', 'λ = 5·10⁴，γ = 0.9'], ['PackNet', '每任务留剩余参数的 25%']]) +
        '<p>每个任务训练 50 个 epoch，其间评估 11 次（第 0、5、…、50 个 epoch），保留最早达到最高成功率的检查点。然后在所有学过的任务上各测 20 次，填进成功率矩阵的一行。前面任务的数据此时已不可用。</p>' +
        '<p><b>SeqL</b> 什么也不做，最容易忘。<b>ER</b> 把旧任务的一小部分数据留在记忆里，和新数据混着训。<b>EWC</b> 把重要的参数“拴”在旧值附近。<b>PackNet</b> 每学完一个任务就剪掉 75% 的可用权重、冻结剩下的，下一个任务只能用剩下的；第 k 个任务的份额是 0.25 × 0.75^(k−1)，第 10 个只有 1.9%。</p>' +
        toyb('上方的小柱子和成功率矩阵是第 9 幕同一组玩具数字。PackNet 的份额条是按代码算的真实比例。') + src('§4.3 · 附录 B.1 · 附录 D · algos/base.py、er.py、ewc.py、packnet.py') },
    { n: 9, part: '§5.1 指标', title: 'FWT、NBT、AUC 当场算', sub: '切换算法样式和 NBT 的算法。数字是对玩具矩阵当场算的', dur: 18, cam: [0.0, 1.2, 33, [0.0, 2.2, 0]], camE: [0.0, 1.2, 37, [-2.4, 3.6, 0]],
      html: dl([['c_{k,k,e}', '学任务 k 第 e 个 epoch 时，在 k 上的成功率'], ['FWT_k', '11 个点的平均（e* 之后填平）'], ['NBT_k', 'Σ_{τ>k}(c_{k,k} − c_{τ,k}) / (K − k)'], ['AUC_k', '(FWT_k + Σ_{τ>k} c_{τ,k}) / (K − k + 1)'], ['总指标', '对 k 取平均']]) +
        '<p>左边是当前任务 k 的学习曲线（11 个点）。最早的最高点 e* 之后被“填平”，当作在那里停止学习，FWT_k 就是这 11 个数的平均。</p>' +
        '<p>右边是成功率矩阵：第 τ 行是学完任务 τ 后对每个旧任务的成功率。NBT_k 看第 k 列从对角线往下掉了多少，AUC_k 把 FWT_k 和这一列对角线以下的数一起平均。</p>' +
        '<p><b>NBT 的两种算法：</b>论文式 (3) 在 k = K 时是 0/0；代码的 notebook 令 NBT_K = 0 再除以 K，并且 c_{k,k} 用学完后重测的值而不是 11 次里的最大值。切换开关看差别。</p>' +
        toyb('成功率矩阵和学习曲线按“学会—遗忘”的规则生成：峰值 0.55 到 0.9，ER 每过一个任务保留 85%，SeqL 保留 35%，PackNet 不忘但峰值逐个降低；再加 20 回合的抽样噪声，所有数取 0.05 的整数倍。不是论文数字。') +
        src('§5.1 式 (3) · 图 3 · algos/base.py:162-254 · notebooks/quick_guide_algo.ipynb compute_metric') },
    { n: 10, part: '§5.2 结果', title: '表里的数', sub: '切换指标和数据来源。柱子都是原文数字', dur: 14, cam: [0.0, 1.18, 32, [0, 4.4, 0]],
      html: dl([['表 2', 'ResNet-T，四种算法 + MTL，四个套件'], ['FWT 最好', 'SeqL（12 个组合全是）'], ['AUC 最好', 'PackNet（LIBERO-X），ER（Long，ResNet-T）'], ['图 5', '预训练在 5 个组合里都让 AUC 下降']]) +
        '<p>FWT：SeqL 最高，说明这些终身学习算法都损害了前向迁移。NBT：PackNet 最低（几乎不忘），SeqL 最高。AUC：PackNet 在三个 LIBERO-X 套件上最好；LIBERO-Long 上 ResNet-T 配 ER 更好，换 ViT-T 时 PackNet 又更好（0.34）。</p>' +
        '<p>图 5：在 LIBERO-90 上多任务预训练后再做 LIBERO-Long 终身学习，AUC 全部下降；多任务基线（青色）是参照。纵轴原文写“Success Rate”，红、棕两色其实是 AUC。</p>' +
        '<p>3 个种子的标准误多在 0.01 到 0.07，不少差距在误差内（精读页读者注 7、10）。</p>' + src('§5.2 表 2 · 图 5 · 附录 E.1 表 8') },
    { n: 11, part: 'VLA 时代', title: '同一个环境，换了数据、训练和评测', sub: '左边是原论文，右边是 OpenVLA 之后的常见做法', dur: 14, cam: [0.0, 1.12, 30, [0, 3.8, 0]],
      html: dl([['环境', '相同：robosuite、OSC_POSE、20 Hz、BDDL、50 个初始状态'], ['数据', '500 条/套件 → 432 / 454 / 428 / 379'], ['分辨率', '128 → 256，旋转 180°'], ['训练', '依次学 10 个 → 一起微调'], ['评测', '每任务 20 回合 ≤ 600 步 → 50 回合，按套件设上限'], ['指标', 'FWT/NBT/AUC → 成功率']]) +
        '<p>VLA 论文只借用了 LIBERO 的环境和套件。OpenVLA 在环境里重放原始演示，删掉不改变机器人状态的零动作帧和重放失败的演示，图像改存 256 × 256；转格式时把图像转了 180°。四个套件从 2,000 条变成 1,693 条。</p>' +
        '<p>评测从“每任务 20 回合、统一 600 步、开局 5 步零动作”变成“每任务 50 回合（正好用完 50 个初始状态）、Spatial / Object / Goal / Long 最多 220 / 280 / 300 / 520 步、开局 10 步”（OpenVLA 的设定；OpenWAM、MolmoAct2 又各不相同）。</p>' +
        '<p>另一个隐藏约束：环境 horizon = 1000，开局空等加最长步数超过 1000 时 robosuite 会报错。</p>' +
        src('OpenVLA run_libero_eval.py、regenerate_libero_dataset.py · modified_libero_rlds dataset_info.json · 精读页“VLA 里怎么用”和 OpenWAM 页读者问答 问 1') }
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
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.0, phi: 1.1, dist: 30, maxDist: 160, minDist: 3 }); }
  catch (e) { $('nogl').hidden = false; }
  const root = S ? new THREE.Group() : null; if (S) S.scene.add(root);
  let LABS = [], refDist = 30, PICKS = [];
  /* label font floor: small sizes grow most, big ones barely (default view keeps body text >= ~13 px on a 680 px stage); shorter stages (embed 520 px, phones) get up to 1.2x */
  const LSZ = (s, sc) => { const k = sc / 0.012, hs = Math.min(1.2, Math.max(1, Math.sqrt(680 / (document.getElementById('stage')?.clientHeight || 680)))); return Math.round(Math.max(s, (0.5 * s * k + 17.5) / k) * hs); };
  function lab(text, pos, o = {}) {
    const sp = L.label(text, { scale: (o.scale || 0.012) * refDist / 22, size: LSZ(o.size || 24, o.scale || 0.012), pos, color: o.color, border: o.border, bg: o.bg });
    sp.userData.s0 = sp.scale.clone(); LABS.push(sp); return sp;
  }
  /* a label whose text can change: rebuilds the sprite only when the text changes */
  function dynLab(G, pos, o = {}) {
    let sp = null, last = null;
    return t => { if (t === last) return; last = t; if (sp) { G.remove(sp); L.dispose(sp); LABS = LABS.filter(x => x !== sp); sp = null; } if (t === '') return; sp = lab(t, pos, o); G.add(sp); };
  }
  const _M = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q0 = new THREE.Quaternion(), _Sv = new THREE.Vector3(), _C = new THREE.Color();
  const BOX = new THREE.BoxGeometry(1, 1, 1), BALL = new THREE.SphereGeometry(1, 12, 9);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: o.rough ?? 0.65 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  const tint = (m, h) => { m.material.color.setHex(h); m.userData.c = hex3(h); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.14) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.5, dashed: o.dashed }); G.add(l); return l; };
  function cyl(rt, rb, h, color, pos, o = {}) { const m = L.cyl(rt, rb, h, color, o); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  /* heat colour for a success rate in [0,1]: dark blue -> teal -> yellow */
  function heat(v) { const a = [0.16, 0.2, 0.36], b = [0.15, 0.72, 0.62], c = [0.98, 0.82, 0.3]; const t = clamp(v, 0, 1); const [x, y, k] = t < 0.5 ? [a, b, t * 2] : [b, c, t * 2 - 1]; return [L.lerp(x[0], y[0], k), L.lerp(x[1], y[1], k), L.lerp(x[2], y[2], k)]; }
  function table(G, x, z, w, d, color = COL.table) { const t = block(w, 0.3, d, color, [x, -0.15, z], { edgeOpacity: 0.2 }); G.add(t); return t; }
  function bowl(color = COL.bowl) { const g = new THREE.Group(); const b = L.cyl(0.42, 0.26, 0.28, color); b.position.y = 0.14; g.add(b); return g; }
  function plate() { const g = new THREE.Group(); const b = L.cyl(0.55, 0.5, 0.06, COL.plate); b.position.y = 0.03; g.add(b); return g; }
  function basket() { const g = new THREE.Group(); const c = COL.basket, h = 0.5, w = 1.3; [[0, h / 2, w / 2, w, h, 0.06], [0, h / 2, -w / 2, w, h, 0.06], [w / 2, h / 2, 0, 0.06, h, w], [-w / 2, h / 2, 0, 0.06, h, w], [0, 0.03, 0, w, 0.06, w]].forEach(([x, y, z, a, b2, d]) => g.add(block(a, b2, d, c, [x, y, z], { edgeOpacity: 0.15 }))); return g; }
  function cabinet() { const g = new THREE.Group(); g.add(block(1.3, 1.8, 1.0, COL.cab, [0, 0.9, 0])); const dr = []; for (let i = 0; i < 3; i++) { const d = block(1.1, 0.48, 0.9, 0x7d5a40, [0, 0.35 + i * 0.56, 0.12]); g.add(d); dr.push(d); } g.userData.dr = dr; return g; }
  function stove() { const g = new THREE.Group(); g.add(block(1.5, 0.12, 1.1, COL.stove, [0, 0.06, 0])); const burn = L.cyl(0.32, 0.32, 0.03, 0x222831); burn.position.set(0, 0.14, 0); g.add(burn); g.userData.burn = burn; const knob = L.cyl(0.08, 0.08, 0.14, 0xdde3ee); knob.rotation.x = Math.PI / 2; knob.position.set(0.55, 0.08, 0.6); g.add(knob); g.userData.knob = knob; return g; }
  function can(color, h = 0.6, r = 0.18) { const g = new THREE.Group(); const b = L.cyl(r, r, h, color); b.position.y = h / 2; g.add(b); return g; }
  function moka() { const g = new THREE.Group(); const a = L.cyl(0.22, 0.28, 0.42, 0x9aa6bf); a.position.y = 0.21; const b = L.cyl(0.26, 0.2, 0.36, 0xb8c4da); b.position.y = 0.6; g.add(a, b); return g; }

  /* controls: api.ctls = [{label, items, get, set}] and optional api.read() -> string shown under the buttons */
  function buildCtl() {
    const box = $('ctl'); box.innerHTML = ''; box.hidden = true; if (!api) return;
    (api.ctls || []).forEach((c, gi) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-g="${gi}" data-k="${k}" aria-pressed="${c.get() === k}">${t}</button>`).join('');
      box.appendChild(row); box.hidden = false;
    });
    if (api.read) { const r = document.createElement('div'); r.className = 'rd'; r.id = 'rd'; box.appendChild(r); box.hidden = false; }
  }
  function syncCtl() { (api?.ctls || []).forEach((c, gi) => { $('ctl').querySelectorAll(`button[data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(c.get() === +b.dataset.k))); }); }
  function setRead(t) { const r = $('rd'); if (r && r.innerHTML !== t) r.innerHTML = t; }

  /* ---------- toy lifelong run used by scenes 8 and 9 ---------- */
  const K = 10;
  const q20 = v => Math.round(clamp(v, 0, 1) * 20) / 20; /* 20 rollouts -> multiples of 0.05 */
  function toyRun(style) {
    const r = L.rng(17 + style * 101), noise = () => (r() + r() + r() - 1.5) * 0.12;
    const peak = [], curve = [], mat = []; /* mat[tau][k] = success on task k after learning task tau (tau >= k) */
    for (let k = 0; k < K; k++) {
      let pk = 0.55 + 0.35 * r(); if (style === 2) pk *= 1 - 0.045 * k; /* PackNet: less capacity per task */
      peak.push(pk);
      const zero = style === 0 ? 0.25 * r() : style === 1 ? 0.15 * r() : 0.05 * r(); /* zero-shot at epoch 0 */
      const rate = style === 0 ? 1.4 : style === 1 ? 2.0 : 2.6;
      const c = []; for (let e = 0; e <= 10; e++) c.push(q20(zero + (pk - zero) * (1 - Math.exp(-e / rate)) + (e ? noise() * 0.6 : 0)));
      curve.push(c);
    }
    const keep = [0.35, 0.85, 1.0][style];
    for (let t = 0; t < K; t++) { mat.push([]); for (let k = 0; k <= t; k++) { const base = peak[k] * Math.pow(keep, t - k); mat[t].push(q20(base + noise() * 0.5)); } }
    return { curve, mat };
  }
  function metrics(run, mode) {
    /* mode 0: paper eq. (3) with c_kk = max_e c_kke, NBT averaged over k = 1..K-1; mode 1: notebook (NBT_K = 0, divide by K, c_kk = re-evaluated mat[k][k]) */
    const fwtK = [], nbtK = [], aucK = [], filled = [];
    for (let k = 0; k < K; k++) {
      const c = run.curve[k], best = Math.max(...c), eStar = c.indexOf(best), f = c.map((v, e) => (e >= eStar ? best : v)); filled.push({ f, eStar, best });
      const fw = f.reduce((a, b) => a + b, 0) / 11; fwtK.push(fw);
      const ckk = mode === 0 ? best : run.mat[k][k];
      let s = 0, sa = 0; for (let t = k + 1; t < K; t++) { s += ckk - run.mat[t][k]; sa += run.mat[t][k]; }
      nbtK.push(k < K - 1 ? s / (K - 1 - k) : (mode === 0 ? null : 0));
      aucK.push((fw + sa) / (K - k));
    }
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const nb = mode === 0 ? mean(nbtK.filter(v => v != null)) : nbtK.reduce((x, y) => x + y, 0) / K;
    return { fwtK, nbtK, aucK, filled, FWT: mean(fwtK), NBT: nb, AUC: mean(aucK) };
  }
  const RUNS = [toyRun(0), toyRun(1), toyRun(2)];

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    const top = [['Ego4D 标注', COL.tmpl, 1], ['行为模板', COL.tmpl, 1], ['指令', COL.obj, 1], ['场景 + BDDL', COL.bddl, 2], ['50 个初始状态', COL.init, 2]];
    const bot = [['遥操作演示 ×50', COL.demo, 4], ['观测 / 动作', COL.data, 5], ['策略 π(a|o≤t; T)', COL.pol, 6], ['依次学 10 个任务', COL.seq, 7], ['FWT · NBT · AUC', COL.eval, 8]];
    const mk = (arr, y) => arr.map(([t, c, g], i) => { const x = -12 + i * 6, m = block(3.6, 1.4, 1.4, c, [x, y, 0]); G.add(m); m.userData.go = g; PICKS.push(m); G.add(lab(t, [x, y + 1.35, 0], { size: 21 })); return m; });
    const A = mk(top, 6.4), B = mk(bot, 1.2);
    G.add(lab('造任务（§4.1、§4.2）', [0, 9.3, 0], { size: 21, color: '#9d8cff' }), lab('用任务（§4.4、§5）', [0, 4.15, 0], { size: 21, color: '#f0963c' }));
    const f1 = stream(G, 18, COL.tmpl), f2 = stream(G, 18, COL.demo), f3 = stream(G, 6, COL.init);
    const cnt = dynLab(G, [0, -1.3, 0], { size: 20 });
    return { update(p) {
      const q = (p * 6) % 1;
      f1([[-12, 6.4, 0.9], [12, 6.4, 0.9]], q, 1); f3([[12, 5.6, 0.9], [12, 2.0, 0.9], [-12, 2.0, 0.9]], q, seg(p, 0.2, 0.3)); f2([[-12, 1.2, 0.9], [12, 1.2, 0.9]], q, seg(p, 0.35, 0.45));
      const k = Math.floor(p * 5) % 5; [...A, ...B].forEach((m, i) => glow(m, (i % 5) === k ? 0.6 : 0.1));
      const n = Math.round(130 * seg(p, 0.0, 0.7));
      cnt(`${n} / 130 个任务 · ${n * 50} 条演示`);
      cap(p < 0.45 ? '上排：从人类活动的语言里提炼模板 → 指令 → 场景和 <b>BDDL</b> 文件 → 每个任务 <b>50 个固定初始状态</b>' : '下排：每个任务 <b>50 条遥操作演示</b> → 行为克隆策略 → <b>一个接一个地学</b> → 用成功率算 FWT、NBT、AUC。点方块跳到那一幕');
    } };
  }

  /* ---------- scene 2: templates -> instructions ---------- */
  function s2(G) {
    const tm = ['Open the ___', 'Put the ___ on the ___', 'Pick up the ___ and\nplace it in the ___', 'Turn on the ___'];
    const cards = tm.map((t, i) => { const y = 6.6 - i * 1.9, m = block(8.6, 1.2, 0.3, COL.tmpl, [-10.6, y, 0], { opacity: 0.85 }); G.add(m, lab(t, [-10.6, y, 0.4], { size: 17 })); return m; });
    const objs = [['bowl', COL.bowl], ['plate', COL.plate], ['drawer', COL.cab], ['stove', COL.stove], ['ketchup', COL.red], ['basket', COL.basket], ['wine bottle', 0x6a2a3a], ['cream cheese', 0xe6ecf7]];
    const chips = objs.map(([t, c], i) => { const x = -3.4 + (i % 2) * 3.6, y = 6.6 - Math.floor(i / 2) * 1.9, m = block(1.6, 0.8, 0.8, c, [x, y - 0.25, 0]); G.add(m, lab(t, [x, y + 0.55, 0], { size: 15 })); return m; });
    G.add(lab('行为模板（示意）', [-10.6, 8.4, 0], { size: 21, color: '#9d8cff' }), lab('仿真器里的物体', [-1.6, 8.4, 0], { size: 21, color: '#f2c14e' }), lab('生成的指令（真实任务名）', [9.0, 8.4, 0], { size: 21, color: '#4fc98a' }));
    const outs = [['open the middle drawer of the cabinet', 0, [2]], ['put the bowl on the plate', 1, [0, 1]], ['pick up the ketchup and place it in the basket', 2, [4, 5]], ['turn on the stove', 3, [3]], ['put the wine bottle on the rack', 1, [6]], ['put the cream cheese in the bowl', 1, [7, 0]]];
    const outLabs = outs.map(([t], i) => { const sp = lab(t, [9.0, 7.0 - i * 1.25, 0], { size: 15 }); G.add(sp); return sp; });
    const f = stream(G, 6, COL.obj, 0.16);
    return { update(p) {
      const n = Math.min(outs.length, Math.floor(p * (outs.length + 0.6))), cur = Math.min(outs.length - 1, Math.floor(p * outs.length));
      outLabs.forEach((sp, i) => { sp.visible = i < Math.max(1, n + (p > 0.02 ? 1 : 0)) && i <= cur; });
      const [txt, ti, oi] = outs[cur]; cards.forEach((m, i) => glow(m, i === ti ? 0.7 : 0.05)); chips.forEach((m, i) => glow(m, oi.includes(i) ? 0.7 : 0.0));
      const q = (p * outs.length) % 1, ty = 6.6 - ti * 1.9; f([[-6.3, ty, 0.4], [-1.6, ty, 0.6], [4.6, 7.0 - cur * 1.25, 0.4]], q, 1);
      cap(`模板 <b>${tm[ti].replace('\n', ' ')}</b> + 物体 → <b>“${txt}”</b>`);
    } };
  }

  /* ---------- scene 3: BDDL regions, fixed initial states, goal predicates ---------- */
  function s3(G) {
    table(G, 0, 0, 16, 12);
    const SC = 20; /* metres -> scene units (regions are 2 to 5 cm, so they are drawn 20x) */
    const regions = [['flat_stove_init_region', [-0.21, 0.19, -0.19, 0.21], COL.stove], ['frypan_init_region', [-0.075, -0.275, -0.025, -0.225], 0x6b7794], ['moka_pot_init_region', [0.025, -0.025, 0.075, 0.025], 0x9aa6bf]];
    const toXZ = (x, y) => [y * SC, x * SC]; /* table frame: x towards the viewer, y to the right */
    const lp = [[4, 2.6, -6.2], [-5, 2.2, -3.4], [1.0, 2.6, 2.6]];
    regions.forEach(([n, r, c], i) => { const [x0, z0] = toXZ(r[0], r[1]), [x1, z1] = toXZ(r[2], r[3]); const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0), m = block(w, 0.03, d, c, [(x0 + x1) / 2, 0.015, (z0 + z1) / 2], { opacity: 0.6, edgeOpacity: 0.9 }); G.add(m); G.add(lab(`${n}\n${Math.round(w / SC * 100)} cm × ${Math.round(d / SC * 100)} cm`, lp[i], { size: 15 })); });
    const st = stove(); st.scale.setScalar(1.6); G.add(st); const fp = can(0x6b7794, 0.18, 0.7); G.add(fp); const mk = moka(); mk.scale.setScalar(1.3); G.add(mk);
    const r = L.rng(5), samp = []; for (let i = 0; i < 50; i++) samp.push(regions.map(([, rr]) => { const x = rr[0] + (rr[2] - rr[0]) * r(), y = rr[1] + (rr[3] - rr[1]) * r(); return toXZ(x, y); }));
    const dots = inst(BALL, 150); G.add(dots);
    const arm = L.arm(COL.arm); arm.scale.setScalar(1.5); arm.position.set(0.5, 0, -7.0); G.add(arm);
    const lamp = [block(0.6, 0.6, 0.6, COL.bad, [-12.6, 3.4, 0]), block(0.6, 0.6, 0.6, COL.bad, [-12.6, 2.2, 0])]; G.add(...lamp);
    G.add(lab('Turnon(flat_stove_1)', [-9.4, 3.4, 0], { size: 17 }), lab('On(moka_pot_1, cook_region)', [-8.6, 2.2, 0], { size: 17 }));
    const dn = dynLab(G, [-10.4, 4.7, 0], { size: 20 });
    let used = 1; /* 0: all 50, 1: first 20 (paper eval) */
    const api = { ctls: [{ label: '显示', items: ['全部 50 个', '原论文评测用的前 20 个'], get: () => used, set: v => { used = v; } }], update(p) {
      const N = used ? 20 : 50, sh = seg(p, 0.02, 0.45), nShow = Math.max(1, Math.round(sh * N)), cur = Math.min(nShow - 1, Math.floor(sh * N));
      for (let i = 0; i < 50; i++) for (let j = 0; j < 3; j++) { const k = i * 3 + j, on = i < nShow; setI(dots, k, [samp[i][j][0], 0.1, samp[i][j][1]], on ? (i === cur ? 0.12 : 0.07) : 0.0001); colI(dots, k, i === cur ? [1, 0.85, 0.3] : hex3(regions[j][2]).map(v => Math.min(1, v + 0.3))); }
      done(dots);
      const s = samp[cur], [sx, sz] = s[0], [fx, fz] = s[1], [mx, mz] = s[2];
      st.position.set(sx, 0, sz); fp.position.set(fx, 0, fz);
      const g = seg(p, 0.55, 0.8), on = p > 0.86;
      const lift = Math.sin(g * Math.PI) * 2.0, px = L.lerp(mx, sx, g), pz = L.lerp(mz, sz, g), top = 0.25;
      mk.position.set(px, lift + (g > 0.98 ? top : 0), pz);
      const hand = p < 0.5 ? [mx + 1.5, 3.4, mz + 1.0] : p < 0.55 ? [mx, 1.3, mz] : p < 0.8 ? [px, lift + 1.3, pz] : [sx + 0.9, 0.9 + 1.2 * (1 - seg(p, 0.8, 0.86)), sz + 1.0];
      arm.userData.reach(hand);
      st.userData.burn.material.color.setHex(on ? 0xff5a3a : 0x222831); st.userData.burn.material.emissive.setHex(on ? 0x802010 : 0);
      const ok1 = on, ok2 = g > 0.98; tint(lamp[0], ok1 ? COL.ok : COL.bad); tint(lamp[1], ok2 ? COL.ok : COL.bad);
      dn(`done = ${ok1 && ok2 ? 'True' : 'False'}`);
      cap(p < 0.5 ? `初始状态 <b>#${cur}</b>：三个物体各在自己的 BDDL 区域里随机摆放。${used ? '原论文每任务评测 20 个回合，只用到前 20 个' : '代码给每个任务固定 50 个'}` : '目标是两个谓词的合取：<b>炉子打开</b> 且 <b>摩卡壶在炉子的 cook_region 上</b>。两个都为真，环境才返回 done');
    } };
    return api;
  }

  /* ---------- scene 4: four suites ---------- */
  function s4(G) {
    const P = [[-9, 4.8, 'LIBERO-Spatial'], [9, 4.8, 'LIBERO-Object'], [-9, -4.0, 'LIBERO-Goal'], [9, -4.0, 'LIBERO-100']];
    P.forEach(([x, y, t]) => { const tb = block(12, 0.25, 5.2, COL.table, [x, y - 0.12, 0], { edgeOpacity: 0.2 }); tb.rotation.x = 0.0; G.add(tb, lab(t, [x - 3.6, y + 3.0, 0], { size: 21, color: '#38d1ff' })); });
    const tx = P.map(([x, y]) => dynLab(G, [x, y - 1.2, 3.0], { size: 14 }));
    /* Spatial: same objects, two identical bowls in different places */
    const sp = new THREE.Group(); sp.position.set(-9, 4.8, 0); G.add(sp);
    const pl = plate(); pl.position.set(3.5, 0, 0.5); const rk = can(0xe6ecf7, 0.2, 0.35); rk.position.set(-1.0, 0, 1.2); const cb = block(1.2, 0.35, 0.8, 0xc0603a, [-3.0, 0.18, -1.0]); const cab = cabinet(); cab.position.set(-4.4, 0, 1.4); cab.scale.setScalar(0.6);
    const b1 = bowl(), b2 = bowl(); sp.add(pl, rk, cb, cab, b1, b2);
    const spots = [[-0.2, 1.3], [-1.0, 0.6], [0.4, 0], [-3.0, -1.0], [-4.4, 1.6], [-1.0, 1.2], [-2.0, -1.0], [1.6, -1.2], [2.4, 0.6], [-4.4, 1.4]];
    const ring = L.torus(0.55, 0.05, COL.gold); ring.rotation.x = Math.PI / 2; sp.add(ring);
    /* Object: ten groceries and a basket */
    const ob = new THREE.Group(); ob.position.set(9, 4.8, 0); G.add(ob); const bk = basket(); bk.position.set(3.6, 0, 0); ob.add(bk);
    const ocol = [0xd04040, 0xe6ecf7, 0x9ccf6a, 0x6a3a2a, 0xc02020, 0xe07040, 0xf2e070, 0xfafafa, 0x7a4a2a, 0xf0a030];
    const groc = ocol.map((c, i) => { const m = can(c, 0.5 + 0.2 * (i % 3), 0.2); m.position.set(-4.6 + (i % 5) * 1.5, 0, -1.0 + Math.floor(i / 5) * 1.8); ob.add(m); return m; });
    /* Goal: one fixed layout */
    const go = new THREE.Group(); go.position.set(-9, -4.0, 0); G.add(go);
    const gc = cabinet(); gc.position.set(-4, 0, -0.6); gc.scale.setScalar(0.7); const gs = stove(); gs.position.set(-1.0, 0, -0.8); const gb = bowl(); gb.position.set(0.8, 0, 1.0); const gp = plate(); gp.position.set(2.6, 0, 1.2); const wine = can(0x6a2a3a, 1.0, 0.16); wine.position.set(4.0, 0, -0.6); const rack = block(1.0, 0.7, 0.6, 0x8a6a4a, [2.4, 0.35, -1.2]); const cc = block(0.5, 0.25, 0.4, 0xe6ecf7, [-0.4, 0.13, 1.6]);
    go.add(gc, gs, gb, gp, wine, rack, cc);
    const arrow = L.arrow([0, 0, 0], [0, -1.2, 0], COL.gold); go.add(arrow);
    const gTarget = [[-4, 2.2, -0.2], [-1.0, 1.6, -0.8], [-4, 2.6, -0.6], [-4, 2.2, -0.2], [-4, 2.6, -0.6], [2.6, 1.4, 1.2], [0.8, 1.4, 1.0], [-0.45, 1.2, 0.0], [2.6, 1.4, 1.2], [2.4, 2.0, -1.2]];
    /* LIBERO-100 grid */
    const grid = inst(BOX, 100); G.add(grid);
    return { update(p) {
      const k = Math.min(9, Math.floor(p * 10));
      const [bx, bz] = spots[k]; b1.position.set(bx, k === 4 ? 0.9 : k === 3 ? 0.36 : k === 9 ? 1.08 : k === 7 ? 0.0 : 0, bz); b2.position.set(1.6, 0, -1.2 + (k === 7 ? 2.6 : 0));
      ring.position.set(bx, b1.position.y + 0.32, bz);
      groc.forEach((m, i) => { const sel = i === k, t = seg((p * 10) % 1, 0.25, 0.8); m.position.y = sel ? Math.sin(t * Math.PI) * 1.4 : 0; if (sel) { m.position.x = L.lerp(-4.6 + (i % 5) * 1.5, 3.6, t); m.position.z = L.lerp(-1.0 + Math.floor(i / 5) * 1.8, 0, t); } else { m.position.x = -4.6 + (i % 5) * 1.5; m.position.z = -1.0 + Math.floor(i / 5) * 1.8; } });
      arrow.position.set(...gTarget[k]); arrow.position.y += 0.6;
      for (let i = 0; i < 100; i++) { const r = Math.floor(i / 10), c = i % 10, isL = i >= 90; setI(grid, i, [9 - 4.5 + c * 1.0, -3.9 + 0.15, -2.2 + r * 0.48], [0.82, 0.18 + (isL && (i - 90) === k ? 0.5 : 0), 0.38]); colI(grid, i, isL ? ((i - 90) === k ? [1, 0.6, 0.25] : [0.94, 0.59, 0.24]) : [0.5, 0.55, 0.68]); }
      done(grid);
      tx[0](wrap(`任务 ${k + 1}：pick up the black bowl ${TASKS.spatial[k]} and place it on the plate`, 44));
      tx[1](wrap(`任务 ${k + 1}：pick up the ${TASKS.object[k]} and place it in the basket`, 44));
      tx[2](wrap(`任务 ${k + 1}：${TASKS.goal[k]}`, 44));
      tx[3](`灰：LIBERO-90（预训练）\n橙：LIBERO-Long 任务 ${k + 1}`);
      cap(`第 ${k + 1} 个任务。Spatial 只换<b>哪个碗</b>（金圈），Object 只换<b>哪个物体</b>，Goal 只换<b>目标</b>（金箭头），LIBERO-100 里每个任务场景都不同`);
    } };
  }

  /* ---------- scene 5: teleoperated demonstrations ---------- */
  function s5(G) {
    table(G, 0, 0, 9, 6);
    const b = bowl(); G.add(b); const pl = plate(); pl.position.set(2.4, 0, 0.6); G.add(pl);
    const arm = L.arm(COL.arm); arm.position.set(-0.5, 0, -3.4); G.add(arm);
    const mouse = new THREE.Group(); const base = block(1.2, 0.3, 0.9, 0x222831, [0, 0.15, 0]); const cap0 = L.cyl(0.38, 0.42, 0.4, 0x4a5878); cap0.position.y = 0.5; mouse.add(base, cap0); mouse.position.set(-6.4, 0, 2.4); G.add(mouse);
    G.add(lab('SpaceMouse（6 自由度）', [-6.4, 1.6, 2.4], { size: 18 }));
    const path = [[-1.8, 2.6, -0.4], [-1.6, 1.2, -0.6], [-1.6, 0.35, -0.6], [-1.6, 0.35, -0.6], [-0.4, 2.0, 0.0], [1.6, 2.0, 0.5], [2.4, 0.6, 0.6], [2.4, 0.6, 0.6], [2.0, 2.4, 0.2]];
    const N = 120; /* 6 s at 20 Hz */
    const dots = inst(BALL, N); G.add(dots);
    const cnt = dynLab(G, [3.6, 4.6, 0], { size: 20 });
    return { update(p) {
      const t = clamp(p / 0.92, 0, 1), hand = along(path, t), held = t > 0.33 && t < 0.8;
      arm.userData.reach(hand);
      const f = arm.userData; f.f1.position.x = held ? -0.12 : -0.22; f.f2.position.x = held ? 0.12 : 0.22;
      if (held) b.position.set(hand[0], hand[1] - 0.45, hand[2]); else if (t >= 0.8) b.position.set(2.4, 0.06, 0.6); else b.position.set(-1.6, 0, -0.6);
      cap0.rotation.z = Math.sin(p * 30) * 0.15; cap0.rotation.x = Math.cos(p * 23) * 0.15;
      const n = Math.round(t * N);
      for (let i = 0; i < N; i++) { setI(dots, i, along(path, i / N), i < n ? 0.07 : 0.0001); colI(dots, i, held && i === n - 1 ? [1, 0.6, 0.2] : [0.94, 0.59, 0.24]); } done(dots);
      cnt(`一条演示（示意）· 已记录 ${n} 步 = ${(n / 20).toFixed(2)} s`);
      cap(`每 0.05 s 记一步：两路图像、关节、夹爪和 7 维动作。一个任务 <b>50 条</b>，130 个任务一共 <b>6,500 条</b>`);
    } };
  }

  /* ---------- scene 6: observation / action interface ---------- */
  function s6(G) {
    table(G, 0, 0, 8, 5.6);
    const arm = L.arm(COL.arm); arm.position.set(0, 0, -2.6); G.add(arm); const bw = bowl(); bw.position.set(1.2, 0, 0.8); G.add(bw);
    /* two image planes as 8x8 pixel grids standing for 128x128 */
    const img = (x, y, t) => { const g = inst(BOX, 64); for (let i = 0; i < 64; i++) { setI(g, i, [x - 1.05 + (i % 8) * 0.3, y + 1.05 - Math.floor(i / 8) * 0.3, -3.6], [0.28, 0.28, 0.05]); } G.add(g); G.add(lab(t, [x, y + 1.7, -3.6], { size: 17 })); return g; };
    const I1 = img(-8.6, 3.4, 'agentview 128×128'), I2 = img(-8.6, 0.0, 'eye_in_hand 128×128');
    const prop = []; for (let i = 0; i < 9; i++) { const m = block(0.3, 1, 0.3, i < 7 ? 0x7cb8ff : COL.gold, [-10.2 + i * 0.4, -3.0, -3.6], { edges: false }); G.add(m); prop.push(m); }
    G.add(lab('关节 7 + 夹爪 2', [-8.6, -4.0, -3.6], { size: 16 }));
    const txt = block(2.6, 0.5, 0.3, COL.tmpl, [-8.6, 5.7, -3.6]); G.add(txt, lab('BERT 768：“put the bowl on the plate”', [-8.6, 6.5, -3.6], { size: 15 }));
    const act = []; const an = ['Δx', 'Δy', 'Δz', 'Δrx', 'Δry', 'Δrz', '夹爪']; for (let i = 0; i < 7; i++) { const m = block(0.6, 1, 0.6, i < 3 ? COL.demo : i < 6 ? COL.pol : COL.gold, [5.4 + i * 1.15, 4, -1], { edges: false }); G.add(m, lab(an[i], [5.4 + i * 1.15, 1.9, -1], { size: 13 })); act.push(m); }
    G.add(lab('动作 a ∈ [−1, 1]⁷', [8.85, 6.6, -1], { size: 18 }));
    const axis = block(8.0, 0.02, 0.02, COL.dim, [8.85, 4, -1]); G.add(axis);
    const ee = L.sphere(0.12, COL.gold); G.add(ee); const trail = inst(BALL, 40); G.add(trail);
    const rd = dynLab(G, [5.6, -1.6, 0], { size: 15 });
    const aOf = t => [0.6 * Math.sin(t * 6.2), 0.5 * Math.cos(t * 4.1), -0.3 + 0.5 * Math.sin(t * 3.0), 0.1 * Math.sin(t * 5), 0, 0.2 * Math.cos(t * 2.3), t < 0.55 ? -1 : 1];
    return { update(p) {
      const a = aOf(p);
      a.forEach((v, i) => { const m = act[i]; m.scale.y = Math.max(0.02, Math.abs(v) * 1.6); m.position.y = 4 + (v * 1.6) / 2; });
      /* integrate the end-effector over the timeline at 20 Hz: dx = a * 0.05 m per step; 1 m = 10 units */
      let x = 0.0, y = 2.0, z = 0.0; const nSteps = Math.round(p * 80), pts = [];
      for (let s = 0; s < nSteps; s++) { const b = aOf(s / 80); x += b[0] * 0.05 * 10 * 0.25; z += b[1] * 0.05 * 10 * 0.25; y = clamp(y + b[2] * 0.05 * 10 * 0.25, 0.5, 3.5); pts.push([x, y, z]); }
      ee.position.set(x, y, z); arm.userData.reach([x, y - 0.1, z]);
      for (let i = 0; i < 40; i++) { const q = pts[Math.max(0, pts.length - 1 - i * 2)] || [x, y, z]; setI(trail, i, q, i < pts.length / 2 ? 0.05 : 0.0001); } done(trail);
      for (let i = 0; i < 9; i++) { const v = i < 7 ? 0.5 + 0.4 * Math.sin(p * 5 + i) : (a[6] > 0 ? 0.2 : 0.9); prop[i].scale.y = v * 1.6; prop[i].position.y = -3.0 + v * 0.8; }
      const ph = p * 7; [I1, I2].forEach((g, j) => { for (let i = 0; i < 64; i++) { const u = (i % 8) / 7, w = Math.floor(i / 8) / 7, s2 = 0.35 + 0.3 * Math.sin(u * 3 + ph + j) * Math.cos(w * 2 - ph * 0.5); colI(g, i, [s2 * 0.9, s2, s2 * 1.1]); } done(g); });
      rd(`a = [${a.slice(0, 3).map(f2).join(', ')} | ${a.slice(3, 6).map(f2).join(', ')} | ${a[6] > 0 ? '+1' : '−1'}]\n→ Δp = [${a.slice(0, 3).map(v => (v * 5).toFixed(1)).join(', ')}] cm，Δθ ≤ ${(Math.max(...a.slice(3, 6).map(Math.abs)) * 0.5).toFixed(3)} rad，夹爪${a[6] > 0 ? '闭合' : '张开'}`);
      cap('左：策略的输入（两路 128×128 图像、9 维本体、768 维语言）。右：7 维动作，前 6 维乘 <b>0.05 m / 0.5 rad</b> 成为每步的末端增量，<b>20 Hz</b>');
    } };
  }

  /* ---------- scene 7: three architectures as token layouts ---------- */
  function s7(G) {
    let arch = 1; const T = 10;
    const tok = inst(BOX, 1400); G.add(tok);
    const head = new THREE.Group(); head.position.set(10.5, 3.2, 0); G.add(head);
    const gm = []; for (let i = 0; i < 5; i++) { const m = block(0.35, 1, 0.35, COL.pol, [i * 0.5 - 1, 0, 0], { edges: false }); head.add(m); gm.push(m); }
    G.add(lab('GMM：5 个分量', [10.5, 5.4, 0], { size: 18 }));
    const t1 = dynLab(G, [-1.5, 9.4, 0], { size: 20 }), t2 = dynLab(G, [-1.5, -1.6, 0], { size: 17 });
    const box1 = block(1, 1, 1, COL.data, [0, 0, 0], { opacity: 0.18 }); G.add(box1);
    const box2 = block(1, 1, 1, COL.tmpl, [0, 0, 0], { opacity: 0.18 }); G.add(box2);
    const tl = []; for (let t = 0; t < T; t++) { const s = lab(`t−${T - 1 - t}`, [-10 + t * 1.9, -0.4, 0], { size: 14 }); G.add(s); tl.push(s); }
    const C = { lang: [0.62, 0.55, 1.0], joint: [0.49, 0.72, 1.0], grip: [0.95, 0.76, 0.3], img1: [0.31, 0.79, 0.54], img2: [0.2, 0.62, 0.42], patch: [0.3, 0.6, 0.45], sum: [0.94, 0.59, 0.24] };
    const api = { ctls: [{ label: '架构', items: ['ResNet-RNN', 'ResNet-T', 'ViT-T'], get: () => arch, set: v => { arch = v; } }], update(p) {
      let n = 0; const put = (pos, s, c) => { setI(tok, n, pos, s); colI(tok, n, c); n++; };
      const tNow = Math.min(T - 1, Math.floor(seg(p, 0.05, 0.75) * T)), x0 = -10;
      if (arch === 0) {
        for (let t = 0; t < T; t++) { const on = t <= tNow, x = x0 + t * 1.9; const parts = [[C.img1, 64], [C.img2, 64], [C.joint, 7], [C.grip, 2], [C.lang, 32]]; let y = 0.4; parts.forEach(([c, d]) => { const h = d / 169 * 4.2; put([x, y + h / 2, 0], on ? [0.9, h, 0.9] : [0.0001, 0.0001, 0.0001], c); y += h; }); put([x, 6.4, 0], on ? [1.4, 1.0, 1.0] : [0.0001, 0.0001, 0.0001], [0.83, 0.37, 0.63]); }
        box1.visible = false; box2.visible = false;
        t1('ResNet-RNN：每步一个 169 维向量（图像 64 + 64，关节 7，夹爪 2，语言 32）→ LSTM 1024 × 2');
        t2('LSTM 单元（品红）一步步传隐状态。推理时隐状态一直带到回合结束');
      } else if (arch === 1) {
        const rows = [C.lang, C.joint, C.grip, C.img1, C.img2];
        for (let t = 0; t < T; t++) { const x = x0 + t * 1.9; rows.forEach((c, j) => put([x, 0.8 + j * 1.0, 0], t <= tNow ? [1.2, 0.75, 0.75] : [0.0001, 0.0001, 0.0001], c)); }
        box1.visible = true; box1.scale.set(19.5, 5.6, 1.6); box1.position.set(-1.45, 2.8, 0); box2.visible = false;
        t1(`ResNet-T：每步 5 个 64 维 token × ${tNow + 1} 步 = ${5 * (tNow + 1)} 个（最多 50）→ 4 层时间 transformer`);
        t2('从下到上：语言、关节、夹爪、第三人称图像、腕部图像。图像 token 来自带 FiLM 的 ResNet；输出取语言 token 的位置');
      } else {
        /* spatial transformer of the current step: 2 x 64 patches + lang + summary */
        const sx = 3.2, sy = 6.3;
        for (let i = 0; i < 128; i++) { const r = Math.floor(i / 16), c = i % 16; put([sx - 3.6 + c * 0.42 + (i >= 64 ? 0 : 0), sy - 1.5 + r * 0.38 + (i >= 64 ? 0.2 : 0), 0], [0.34, 0.3, 0.3], i < 64 ? C.img1 : C.img2); }
        put([sx + 3.6, sy, 0], [0.5, 0.5, 0.5], C.lang); put([sx + 3.6, sy + 0.9, 0], [0.6, 0.6, 0.6], C.sum);
        box2.visible = true; box2.scale.set(8.4, 4.0, 1.4); box2.position.set(sx + 0.2, sy + 0.1, 0);
        const rows = [C.lang, C.sum, C.joint, C.grip];
        for (let t = 0; t < T; t++) { const x = x0 + t * 1.9; rows.forEach((c, j) => put([x, 0.8 + j * 1.0, 0], t <= tNow ? [1.2, 0.75, 0.75] : [0.0001, 0.0001, 0.0001], c)); }
        box1.visible = true; box1.scale.set(19.5, 4.6, 1.6); box1.position.set(-1.45, 2.3, 0);
        t1(`ViT-T：上方是一步的空间 transformer（128 个 patch + 语言 + 汇总 = 130 个）；下方每步 4 个 64 维 token × ${tNow + 1} 步`);
        t2('从下到上：语言、汇总 token（橙）、关节、夹爪。汇总 token 由 128 维降到 64 维');
      }
      for (let i = n; i < 1400; i++) setI(tok, i, [0, -50, 0], 0.0001);
      done(tok);
      const k = seg(p, 0.75, 0.95), w = [0.35, 0.25, 0.2, 0.12, 0.08];
      gm.forEach((m, i) => { const h = 0.1 + w[i] * 6 * k; m.scale.y = h; m.position.y = h / 2; });
      cap(['RNN 把每步的所有输入<b>拼成一个向量</b>，时间信息靠隐状态传', '每个模态各是一个 token，<b>10 步一起</b>进时间 transformer（块因果掩码）', '先在<b>每一步内部</b>用空间 transformer 汇总 128 个 patch，再在<b>步与步之间</b>用时间 transformer'][arch] + '；最后都接 <b>GMM 头</b>采样动作');
    } };
    return api;
  }

  /* ---------- scene 8: the lifelong loop and the four algorithms ---------- */
  function s8(G) {
    let algo = 1; const AL = ['SeqL', 'ER', 'EWC', 'PackNet'], AC = [COL.seq, COL.mem, COL.ewc, COL.pack];
    const tiles = []; for (let k = 0; k < K; k++) { const m = block(1.6, 1.0, 1.0, 0x4a5878, [-13 + k * 2.1, 0.5, 0], { opacity: 0.9 }); G.add(m, lab(`T${k + 1}`, [-13 + k * 2.1, 1.5, 0.6], { size: 15 })); tiles.push(m); }
    const pol = block(3.2, 1.8, 1.6, COL.pol, [0, 5.2, 0]); G.add(pol, lab('策略 π', [0, 6.6, 0], { size: 19 }));
    const curve = inst(BOX, 11); G.add(curve); G.add(lab('当前任务的 11 次评估', [10.6, 4.0, 0], { size: 16 }));
    const matI = inst(BOX, 55); G.add(matI); G.add(lab('学完后测所有已学任务（c_τ,k）', [8.8, 11.0, 0], { size: 16 }));
    const mem = inst(BOX, 9); G.add(mem); const memL = dynLab(G, [-8.2, 8.7, 0], { size: 15 });
    const anchor = block(3.2, 1.8, 1.6, COL.ewc, [0, 5.2, -3.2], { opacity: 0.3 }); G.add(anchor); const springs = []; for (let i = 0; i < 5; i++) { const l = L.line([[-1.2 + i * 0.6, 5.2, -0.8], [-1.2 + i * 0.6, 5.2, -2.4]], COL.ewc, { opacity: 0.9 }); G.add(l); springs.push(l); }
    const packs = []; for (let k = 0; k < K; k++) { const m = block(1, 1, 1.0, 0xffffff, [0, 0, 0], { edges: false }); G.add(m); packs.push(m); } const packL = dynLab(G, [-8.2, 8.7, 0], { size: 15 });
    const fl = stream(G, 8, COL.data), fm = stream(G, 6, COL.mem);
    const run = RUNS[1];
    const api = { ctls: [{ label: '算法', items: AL, get: () => algo, set: v => { algo = v; } }], update(p) {
      const run = RUNS[algo === 3 ? 2 : algo === 0 || algo === 2 ? 0 : 1];
      const pk = clamp(p, 0, 0.999) * K, k = Math.floor(pk), fr = pk - k;
      tiles.forEach((m, i) => { tint(m, i < k ? 0x2f3a55 : i === k ? AC[algo] : 0x4a5878); glow(m, i === k ? 0.4 : 0); });
      const x = -13 + k * 2.1; fl([[x, 1.0, 0.6], [x * 0.5, 3.5, 0.6], [0, 4.4, 0.6]], (p * 30) % 1, 1);
      /* 11 evaluation points of the current task */
      const eNow = Math.floor(clamp(fr / 0.75, 0, 1) * 10.999), c = run.curve[k], best = Math.max(...c.slice(0, eNow + 1)), eb = c.indexOf(best);
      for (let e = 0; e < 11; e++) { const v = c[e], on = e <= eNow, h = Math.max(0.02, v * 3); setI(curve, e, [8.2 + e * 0.48, 0.2 + h / 2, 0], on ? [0.36, h, 0.36] : [0.0001, 0.0001, 0.0001]); colI(curve, e, e === eb && on ? [0.95, 0.76, 0.3] : [0.31, 0.79, 0.54]); } done(curve);
      /* success matrix rows filled after each task */
      let n = 0; for (let t = 0; t < K; t++) for (let j = 0; j <= t; j++) { const on = t < k || (t === k && fr > 0.8); setI(matI, n, [6 + j * 0.62, 10.2 - t * 0.62, 0], on ? [0.56, 0.56, 0.2] : [0.0001, 0.0001, 0.0001]); colI(matI, n, heat(run.mat[t][j])); n++; } done(matI);
      /* algorithm-specific mechanism */
      mem.visible = algo === 1; memL(algo === 1 ? `ER 记忆：${k} 个旧任务 × 1000 个片段 = ${k * 1000}` : ''); if (algo === 1) { for (let i = 0; i < 9; i++) { setI(mem, i, [-11 + i * 0.7, 7.6, 0], i < k ? [0.55, 0.9, 0.55] : [0.0001, 0.0001, 0.0001]); colI(mem, i, [0.22, 0.82, 1]); } done(mem); fm([[-11 + Math.max(0, k - 1) * 0.35, 7.6, 0.6], [0, 5.8, 0.6]], (p * 30) % 1, k > 0 ? 1 : 0); } else fm([[0, 0, 0], [0, 0, 0]], 0, 0);
      anchor.visible = algo === 2 && k > 0; springs.forEach(l => { l.visible = algo === 2 && k > 0; });
      let used = 0; packs.forEach((m, i) => { const share = 0.25 * Math.pow(0.75, i), on = algo === 3 && i <= k; m.visible = on; if (on) { const w = share * 16; m.scale.set(w, 0.6, 0.6); m.position.set(-12 + used * 16 + w / 2, 7.6, 0); tint(m, i === k ? COL.pack : 0x5a4a8a); used += share; } });
      packL(algo === 3 ? `PackNet：任务 ${k + 1} 分到 ${(25 * Math.pow(0.75, k)).toFixed(1)}%，还剩 ${(100 * Math.pow(0.75, k + 1)).toFixed(1)}% 未用` : '');
      glow(pol, 0.3);
      setRead(`${AL[algo]} · 学第 ${k + 1} 个任务 · epoch ${eNow * 5} · 当前最好 ${f2(best)}（e* = ${eb * 5}）`);
      cap([`<b>SeqL</b>：直接在新任务上继续训练，旧任务很快被忘（右边矩阵下方变暗）`, `<b>ER</b>：每个旧任务留前 1000 个 10 步片段，每步回放 32 个，和新任务的 32 个拼在一起`, `<b>EWC</b>：按 Fisher 重要性把参数“拴”在上一个任务的值附近（虚影和连线）`, `<b>PackNet</b>：每学完一个任务剪掉 75% 的可用权重、冻结剩下的；上方色条是每个任务分到的份额`][algo]);
    } };
    api.read = true; return api;
  }

  /* ---------- scene 9: computing FWT / NBT / AUC ---------- */
  function s9(G) {
    let sty = 1, mode = 0;
    const cv = inst(BOX, 11); G.add(cv); const fill = inst(BOX, 11); G.add(fill);
    G.add(lab('任务 k 的学习曲线 c_k,k,e', [-8.6, 5.2, 0], { size: 17 }), lab('e = 0', [-12.0, -2.4, 0], { size: 14 }), lab('50', [-5.2, -2.4, 0], { size: 14 }));
    const mt = inst(BOX, 100); G.add(mt); G.add(lab('成功率矩阵 c_τ,k（行 τ：学完第 τ 个后）', [6.4, 7.4, 0], { size: 17 }));
    const colHi = block(0.66, 6.6, 0.1, COL.gold, [0, 0, -0.2], { opacity: 0.18, edges: false }); G.add(colHi);
    const vals = [dynLab(G, [-8.6, -3.6, 0], { size: 17 }), dynLab(G, [6.4, -1.8, 0], { size: 17 })];
    const tot = dynLab(G, [0, -5.4, 0], { size: 20, color: '#f2c14e' });
    const api = { ctls: [{ label: '玩具算法', items: ['像 SeqL', '像 ER', '像 PackNet'], get: () => sty, set: v => { sty = v; } }, { label: 'NBT', items: ['论文式 (3)', '代码 notebook'], get: () => mode, set: v => { mode = v; } }], update(p) {
      const run = RUNS[sty], M = metrics(run, mode), k = Math.min(K - 1, Math.floor(clamp(p, 0, 0.999) * K)), F = M.filled[k];
      const fr = (p * K) % 1, showFill = fr > 0.35;
      for (let e = 0; e < 11; e++) { const v = run.curve[k][e], h = Math.max(0.03, v * 6.2); setI(cv, e, [-12 + e * 0.68, -1.8 + h / 2, 0], [0.5, h, 0.4]); colI(cv, e, e === F.eStar ? [0.95, 0.76, 0.3] : [0.31, 0.79, 0.54]);
        const hf = Math.max(0.03, F.f[e] * 6.2); setI(fill, e, [-12 + e * 0.68, -1.8 + hf / 2, -0.3], showFill && e > F.eStar ? [0.52, hf, 0.3] : [0.0001, 0.0001, 0.0001]); colI(fill, e, [0.95, 0.76, 0.3]); }
      done(cv); done(fill);
      for (let t = 0; t < K; t++) for (let j = 0; j < K; j++) { const i = t * K + j, on = j <= t; setI(mt, i, [3.6 + j * 0.62, 6.3 - t * 0.62, 0], on ? [0.56, 0.56, 0.2] : [0.0001, 0.0001, 0.0001]); colI(mt, i, on ? heat(run.mat[t][j]) : [0, 0, 0]); } done(mt);
      colHi.position.set(3.6 + k * 0.62, 6.3 - (K - 1) * 0.31, 0.15); colHi.scale.y = 1;
      const ckk = mode === 0 ? F.best : run.mat[k][k];
      vals[0](`FWT_${k + 1} = mean(11 点，e* = ${F.eStar * 5} 后填平) = ${f3(M.fwtK[k])}`);
      vals[1](k < K - 1 ? `NBT_${k + 1} = Σ(${f2(ckk)} − c_τ,${k + 1}) / ${K - 1 - k} = ${f3(M.nbtK[k])}\nAUC_${k + 1} = (${f3(M.fwtK[k])} + Σ c_τ,${k + 1}) / ${K - k} = ${f3(M.aucK[k])}` : `NBT_10：${mode === 0 ? '0/0，论文式未定义，跳过' : '记为 0（notebook）'}\nAUC_10 = FWT_10 = ${f3(M.aucK[k])}`);
      tot(`FWT = ${f3(M.FWT)}　NBT = ${f3(M.NBT)}　AUC = ${f3(M.AUC)}`);
      const M0 = metrics(run, 0), M1 = metrics(run, 1);
      setRead(`同一组玩具数：论文式 NBT ${f3(M0.NBT)} · notebook NBT ${f3(M1.NBT)}（差 ${f3(M0.NBT - M1.NBT)}）`);
      cap(`任务 k = ${k + 1}。左：11 次评估，<b>金色</b>是最早的最好点 e*，之后按最好值填平再平均得 FWT_k。右：第 k 列（金框）对角线往下掉多少是 NBT_k；FWT_k 和对角线以下的数一起平均是 AUC_k`);
    } };
    api.read = true; return api;
  }

  /* ---------- scene 10: results (Table 2 and Figure 5) ---------- */
  function s10(G) {
    let src10 = 0, met = 2;
    /* Table 2 (ResNet-T): [algo][suite] = [FWT, NBT, AUC]; suites L, S, O, G */
    const T2 = { SeqL: [[0.54, 0.63, 0.15], [0.72, 0.81, 0.20], [0.78, 0.76, 0.26], [0.77, 0.82, 0.22]], ER: [[0.48, 0.32, 0.32], [0.65, 0.27, 0.56], [0.67, 0.43, 0.44], [0.64, 0.34, 0.49]], EWC: [[0.13, 0.22, 0.02], [0.23, 0.33, 0.06], [0.56, 0.69, 0.16], [0.32, 0.48, 0.06]], PackNet: [[0.22, 0.08, 0.25], [0.55, 0.07, 0.63], [0.60, 0.17, 0.60], [0.63, 0.06, 0.75]] };
    const MTL = [0.48, 0.83, 0.54, 0.80];
    const F5 = [['ER\nRNN', 0.04, 0.08, 0.20], ['ER\nResNet-T', 0.22, 0.32, 0.48], ['ER\nViT-T', 0.10, 0.25, 0.46], ['EWC\nResNet-T', 0.01, 0.02, 0.48], ['PackNet\nResNet-T', 0.17, 0.25, 0.48]];
    const bars = inst(BOX, 24); G.add(bars);
    const AC = [[0.94, 0.59, 0.24], [0.22, 0.82, 1], [0.95, 0.63, 0.63], [0.62, 0.55, 1], [0.6, 0.65, 0.75]];
    const grpA = [], grpB = []; for (let i = 0; i < 4; i++) grpA.push(dynLab(G, [-9.8 + i * 6.6, -1.3, 0], { size: 16 })); for (let i = 0; i < 5; i++) grpB.push(dynLab(G, [-11.4 + i * 5.6, -1.6, 0], { size: 15 }));
    const leg = dynLab(G, [0, 10.4, 0], { size: 17 });
    G.add(block(30, 0.04, 0.04, COL.dim, [0, 0, 0]));
    let lastKey = '';
    const api = { ctls: [{ label: '来源', items: ['表 2（ResNet-T）', '图 5（预训练）'], get: () => src10, set: v => { src10 = v; } }, { label: '指标', items: ['FWT', 'NBT', 'AUC'], get: () => met, set: v => { met = v; } }], update(p) {
      const g = seg(p, 0.05, 0.6); let n = 0;
      const key = `${src10}|${met}|${g > 0.98}`, rebuild = key !== lastKey; lastKey = key;
      if (rebuild) { LABS.filter(s => s.userData.bar).forEach(s => { G.remove(s); L.dispose(s); }); LABS = LABS.filter(s => !s.userData.bar); }
      const addV = (v, x, h) => { if (!rebuild) return; const s = lab(f2(v), [x, h + 0.5, 0.6], { size: 12, scale: 0.0105 }); s.userData.bar = 1; G.add(s); };
      if (src10 === 0) {
        const sn = ['Long', 'Spatial', 'Object', 'Goal'], algos = ['SeqL', 'ER', 'EWC', 'PackNet'];
        grpB.forEach(d => d('')); for (let s = 0; s < 4; s++) { grpA[s](`LIBERO-${sn[s]}`); for (let a = 0; a < 5; a++) { const v = a < 4 ? T2[algos[a]][s][met] : (met === 2 ? MTL[s] : 0); const x = -12 + s * 6.6 + a * 1.1, h = Math.max(0.02, v * 8 * g); setI(bars, n, [x, h / 2, 0], a === 4 && met !== 2 ? [0.0001, 0.0001, 0.0001] : [0.9, h, 0.9]); colI(bars, n, AC[a]); n++; if (g > 0.98 && !(a === 4 && met !== 2)) addV(v, x, h); } }
        leg(`${['FWT ↑', 'NBT ↓', 'AUC ↑'][met]}　橙 SeqL · 蓝 ER · 粉 EWC · 紫 PackNet${met === 2 ? ' · 灰 MTL（成功率）' : ''}`);
      } else {
        grpA.forEach(d => d('')); for (let i = 0; i < 5; i++) { grpB[i](F5[i][0]); for (let j = 0; j < 3; j++) { const v = F5[i][1 + j], x = -12.6 + i * 5.6 + j * 1.2, h = Math.max(0.02, v * 8 * g); setI(bars, n, [x, h / 2, 0], [1.0, h, 1.0]); colI(bars, n, [[0.88, 0.36, 0.36], [0.55, 0.38, 0.3], [0.2, 0.75, 0.82]][j]); n++; if (g > 0.98) addV(v, x, h); } }
        leg('图 5 · LIBERO-Long　红：有预训练　棕：无预训练（AUC）　青：多任务');
      }
      for (let i = n; i < 24; i++) setI(bars, i, [0, -50, 0], 0.0001); done(bars);
      cap(src10 === 0 ? ['FWT：<b>SeqL 在四个套件上都最高</b>，终身学习算法都损害了前向迁移', 'NBT（越低越好）：<b>PackNet 几乎不忘</b>，SeqL 忘得最多', 'AUC：<b>PackNet 在 Spatial、Object、Goal 最好</b>，LIBERO-Long 上 ER 更好；MTL 不总是上界（Object 0.54 &lt; PackNet 0.60）'][met] : '在 LIBERO-90 上预训练后，五个组合的 AUC <b>全部下降</b>（−0.01 到 −0.15）');
    } };
    return api;
  }

  /* ---------- scene 11: how VLA papers use LIBERO ---------- */
  function s11(G) {
    G.add(lab('原论文（2023）', [-8, 10.2, 0], { size: 21, color: '#9d8cff' }), lab('VLA 论文（OpenVLA 之后）', [8, 10.2, 0], { size: 21, color: '#38d1ff' }));
    const raw = [500, 500, 500, 500], flt = [432, 454, 428, 379], sn = ['Spatial', 'Object', 'Goal', 'Long'];
    const bars = inst(BOX, 8); G.add(bars);
    const imA = inst(BOX, 16), imB = inst(BOX, 64); G.add(imA, imB);
    const rows = [['训练', '10 个任务依次学', '四套件一起微调'], ['评测', '每任务 20 回合，≤ 600 步', '每任务 50 回合，220 / 280 / 300 / 520 步'], ['开局', '5 步零动作', '10 步（OpenVLA）'], ['指标', 'FWT · NBT · AUC', '成功率']];
    rows.forEach(([k, a, b], i) => { const y = 2.6 - i * 1.25; G.add(lab(k, [0, y, 0], { size: 17, color: '#f2c14e' }), lab(a, [-8, y, 0], { size: 16 }), lab(b, [8, y, 0], { size: 16 })); });
    const nL = dynLab(G, [8, 4.2, 0], { size: 16 }), nR = dynLab(G, [-8, 4.2, 0], { size: 16 });
    G.add(lab('128 × 128', [-12.5, 9.0, 0], { size: 15 }), lab('256 × 256，转 180°', [3.2, 9.0, 0], { size: 15 }));
    return { update(p) {
      const g = seg(p, 0.05, 0.5);
      for (let s = 0; s < 4; s++) { const h1 = raw[s] / 500 * 3.2, h2 = L.lerp(raw[s], flt[s], g) / 500 * 3.2; setI(bars, s, [-10 + s * 1.6, 4.8 + h1 / 2, 0], [1.1, h1, 1.0]); colI(bars, s, [0.62, 0.55, 1]); setI(bars, 4 + s, [6 + s * 1.6, 4.8 + h2 / 2, 0], [1.1, h2, 1.0]); colI(bars, 4 + s, [0.22, 0.82, 1]); }
      done(bars);
      nR(`每套件 500 条，共 2,000 条`); nL(`${flt.map((v, s) => Math.round(L.lerp(500, v, g))).join(' / ')}，共 ${Math.round(L.lerp(2000, 1693, g))} 条`);
      for (let i = 0; i < 16; i++) { setI(imA, i, [-13.4 + (i % 4) * 0.6, 7.0 + Math.floor(i / 4) * 0.45, 0], [0.55, 0.4, 0.1]); const v = 0.3 + 0.5 * ((i * 7) % 5) / 5; colI(imA, i, [v, v * 0.9, v * 0.7]); } done(imA);
      const rot = seg(p, 0.55, 0.85) * Math.PI; for (let i = 0; i < 64; i++) { const u = (i % 8) - 3.5, w = Math.floor(i / 8) - 3.5, c = Math.cos(rot), s = Math.sin(rot); setI(imB, i, [2.3 + (u * c - w * s) * 0.3, 7.5 + (u * s + w * c) * 0.22, 0], [0.28, 0.2, 0.1]); const v = 0.3 + 0.5 * (((Math.floor((i % 8) / 2) + Math.floor(Math.floor(i / 8) / 2) * 4) * 7) % 5) / 5; colI(imB, i, [v, v * 0.9, v * 0.7]); } done(imB);
      cap(p < 0.5 ? 'OpenVLA 重放原始演示，删掉<b>零动作帧</b>和<b>重放失败</b>的演示：2,000 → <b>1,693</b> 条' : '图像改存 <b>256 × 256</b> 并<b>旋转 180°</b>；训练改成一起微调，评测改成每任务 50 回合、按套件设步数上限，只报<b>成功率</b>');
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11];

  /* ---------- player ---------- */
  let cur = 0, api = null, playing = !L.reduced(), t0 = 0, pNow = 0, tw = null;
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
    const G = new THREE.Group(); root.add(G); pNow = p0; api = BUILD[cur](G);
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
  const s0 = clamp((parseInt(qs.get('scene'), 10) || 1) - 1, 0, SCENES.length - 1), pq = qs.get('p');
  /* optional toggles for screenshots: ?opt=a,b sets ctl group 0 to a and group 1 to b */
  const OPT = (qs.get('opt') || '').split(',').filter(x => x !== '').map(Number);
  setPlay(playing && pq == null);
  go(s0, pq != null ? clamp(parseFloat(pq) || 0, 0, 1) : (L.reduced() ? 0.9 : 0));
  if (api?.ctls && OPT.length) { OPT.forEach((v, i) => api.ctls[i]?.set(v)); api.update(pNow); syncCtl(); }
  window.__liberoDebug = { metrics: m => RUNS.map(r => metrics(r, m)), get cap() { return $('cap').textContent; } };
})();
