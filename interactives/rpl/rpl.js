'use strict';
/* RPL (arXiv 2602.03002) taken apart into ten animated scenes. Terrain formulas, camera, noise, RSM and DFSV parameters come
   from the official code (amazon-far/RPL 1ca0250, holosoma 91647ee). Each scene's update(p) is a pure function of the timeline p
   plus the current toggles. Scenes 5 and 6 ray-cast a toy terrain live; scene 8 computes both DFSV curves live; scene 9 plots
   Figure 13 as read from the paper's vector paths. The humanoid is hand-made. No RPL network runs here. */
(function () {
  const qs = new URLSearchParams(location.search);
  if (qs.get('embed')) document.body.classList.add('embed');
  const L = window.Lab3D, $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (p, a, b) => L.ease(clamp((p - a) / (b - a), 0, 1));
  const COL = { exp: 0xf2c14e, stu: 0x38d1ff, slope: 0x8fbf6a, up: 0x7cb8ff, down: 0x9d8cff, stone: 0xf0963c, robot: 0xc9d4ea, force: 0xe05d5d, cam: 0x4fc98a, dim: 0x46506a, white: 0xeef2fa, ground: 0x5a6680, paper: 0xff7a59, code: 0x38d1ff, ok: 0x4fc98a, bad: 0xe05d5d, dagger: 0xd95926, hyb: 0x3987e5 };
  const hex3 = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const css = h => '#' + h.toString(16).padStart(6, '0');
  const dl = rows => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
  const guess = t => `<p class="guess"><b>示意 · </b>${t}</p>`;
  const toyb = t => `<p class="guess"><b>玩具 · </b>${t}</p>`;
  const src = t => `<p class="src">出处：${t}</p>`;
  const F13 = [["坡",[0.78,0.88,1.86,2.59,3.56,4.19,4.97,5.38,5.7,5.84,5.92,5.84,5.84,5.94,6.07,6.07,5.83,5.67,5.75,5.75,5.85,6.04,6.13,6.02,6.14,5.94,5.96,6.15,6.2,6.08,5.87,5.82,5.93,5.95,5.72,5.79,5.89,6.12,6.28,6.25,6.14,5.99,5.75,5.97,6.01,6.13,6.0,6.1,5.96,5.83,5.89,6.21,6.13,6.1,6.24,6.2,6.13,5.97,6.23,6.23,5.93,5.84,5.95,6.01,5.96,6.01,5.98,5.92,5.9,5.98,6.13,6.0,6.27,6.35,6.58,6.32,6.19,6.0,5.89,5.82,6.0,6.03,6.15,6.12,5.83,6.08,6.18,6.16,6.21,6.24,5.96,6.09,6.05,5.94,5.83,5.77,5.86,5.94,6.02,6.02,6.02,5.95,6.12,6.24,6.14,6.03,5.78,6.0,5.98,6.08,5.96,5.99,5.97,5.91,5.89,5.94,5.82,5.97,6.08,6.13,6.01,5.87,5.8,6.04,6.03,6.24,6.21,6.29,6.3,6.16,5.88,5.88,5.89,5.79,5.81,5.98,6.19,6.12,6.27,6.22,6.2,6.21,6.38,6.11,6.05,6.13,5.97,6.01,6.12,5.99,6.09,5.95,6.07,5.92,5.97,6.01,5.84,5.97,6.11,6.22,6.14,6.05,6.05,5.85,6.15,6.2,6.06,5.75,5.84,5.83,5.83,5.84,5.87,5.99,6.13,6.09,6.02,5.96,6.02,6.07,5.88,5.86,5.86,5.93,5.95,6.08,6.11,6.01,5.89,6.15,6.25,6.18,6.32,6.22,6.14,5.86,5.86,5.79,5.5,5.69,5.83],[0.78,1.85,2.94,4.08,4.8,5.46,5.83,5.73,5.95,6.09,6.0,5.82,6.07,5.98,6.07,5.86,5.99,5.95,5.93,5.76,5.52,5.87,5.98,6.17,6.1,6.12,6.14,6.12,6.08,5.83,5.76,5.94,6.01,6.16,6.01,5.96,5.99,6.15,6.12,6.13,6.0,5.81,5.63,5.59,5.69,5.67,5.64,5.59,5.57,5.55,5.73,5.76,5.74,5.69,5.62,5.55,5.54,5.57,5.64,5.77,5.75,5.47,5.64,5.68,5.57,5.72,5.71,5.69,5.51,5.26,5.24,5.2,5.45,5.48,5.62,5.61,5.54,5.49,5.32,5.24,5.18,5.12,4.97,4.94,4.99,5.13,5.23,5.31,5.37,5.32,5.4,5.27,5.14,5.17,5.05,5.11,5.1,5.08,5.19,5.38,5.59,5.57,5.51,5.5,5.25,4.88,4.89,5.13,5.25,5.19,5.18,5.25,5.26,5.26,5.21,5.22,5.12,4.95,4.89,4.91,4.84,4.72,4.71,4.88,4.75,4.98,4.75,4.75,4.74,4.76,4.81,4.88,5.06,5.13,4.85,4.82,4.81,4.73,4.67,4.64,4.46,4.44,4.32,4.34,4.53,4.68,4.69,4.83,4.88,4.67,4.7,4.72,4.66,4.53,4.57,4.77,4.82,4.79,4.76,4.86,4.93,4.73,4.7,4.66,4.51,4.39,4.37,4.11,4.24,4.47,4.51,4.53,4.39,4.4,4.28,4.51,4.53,4.65,4.51,4.4,4.43,4.33,4.31,4.52,4.59,4.62,4.39,4.41,4.47,4.55,4.71,4.68,4.72,4.65,4.51,4.72,4.82,4.84,4.69,4.59,4.5]],["上楼梯",[0.77,1.52,2.12,null,4.63,5.59,6.04,6.19,6.02,6.11,5.93,6.13,5.94,6.02,5.5,5.53,5.6,6.0,5.96,6.02,5.99,5.96,5.75,5.81,6.03,6.0,6.05,5.71,5.73,5.56,5.75,5.8,5.88,5.84,5.73,5.7,5.8,6.03,6.0,5.86,5.97,5.97,5.56,5.7,5.56,5.6,5.71,5.83,5.81,5.88,5.64,5.6,5.67,5.87,5.67,5.71,5.9,5.75,5.6,5.64,5.8,5.81,5.62,5.69,5.7,5.68,5.64,5.8,5.6,5.86,5.87,5.85,5.78,6.0,6.04,6.06,5.91,6.03,5.82,5.76,5.7,5.52,5.57,5.83,5.65,5.89,5.76,5.77,5.75,5.81,5.7,6.08,6.07,5.97,5.57,5.77,5.78,5.73,5.77,5.62,5.83,5.78,5.93,5.92,5.81,5.69,5.89,5.8,5.94,5.99,5.93,5.88,5.71,5.72,5.72,5.72,5.88,5.54,5.72,5.79,5.82,5.67,5.67,5.54,5.5,5.59,5.67,5.74,5.69,5.92,6.0,5.62,5.62,5.69,5.76,5.88,5.73,5.67,5.73,5.82,5.61,5.5,5.54,5.56,5.64,5.61,5.65,5.76,5.87,6.01,6.0,5.79,5.93,5.72,5.76,5.86,6.08,5.8,5.85,5.76,5.49,5.61,5.87,5.87,5.73,5.86,5.8,5.61,5.81,5.64,5.63,5.55,5.58,5.66,5.82,5.83,5.83,5.85,5.89,5.86,5.7,5.83,5.71,5.91,5.91,5.92,5.83,5.67,5.55,5.78,5.72,5.74,5.7,5.63,5.6,5.66,5.82,5.69,5.72,5.82,5.95],[0.77,1.15,2.74,4.11,4.92,5.08,5.53,5.68,5.81,5.89,5.97,5.73,5.66,5.89,6.21,6.41,6.54,6.3,6.49,6.26,6.17,6.12,6.21,6.23,6.2,6.17,6.24,6.05,6.05,6.02,5.97,5.96,5.93,6.06,6.17,6.01,6.02,5.9,6.06,5.91,5.95,5.89,5.44,5.52,5.51,5.7,5.75,5.85,5.78,5.75,5.71,5.79,5.78,5.79,5.89,5.85,5.91,5.81,5.9,5.96,5.9,5.66,5.73,5.53,5.56,5.71,5.64,5.66,5.62,5.67,5.59,5.59,5.6,5.87,5.74,5.7,5.68,5.68,5.77,5.85,5.76,5.43,5.47,5.57,5.16,5.34,5.54,5.62,5.57,5.59,5.75,5.8,5.76,5.63,5.71,5.83,5.7,5.88,5.96,5.83,5.65,5.56,5.78,5.78,5.8,5.76,5.77,5.74,6.07,6.06,5.83,5.56,5.5,5.66,5.54,5.55,5.75,5.77,5.86,5.78,5.69,5.63,5.64,5.63,5.58,5.44,5.26,5.52,5.66,5.6,5.64,5.67,5.97,5.83,5.86,5.52,5.58,5.23,5.33,5.41,5.45,5.33,5.26,5.21,5.23,5.33,5.6,5.75,5.54,5.57,5.52,5.43,5.17,5.16,5.29,5.37,5.2,5.2,5.31,5.43,5.43,5.37,5.36,5.24,5.39,5.38,5.43,5.0,5.33,5.36,5.54,5.54,5.38,5.49,5.5,5.56,5.12,5.15,5.05,4.94,5.06,5.06,5.23,5.24,4.85,4.93,4.85,4.97,5.08,5.12,5.07,5.02,5.23,5.2,5.1,5.19,5.16,4.99,4.89,5.02,5.07]],["下楼梯",[0.91,1.38,2.63,null,5.22,5.87,5.99,5.84,5.8,5.9,5.87,5.82,5.57,5.61,5.75,5.86,5.85,5.45,5.61,5.86,5.8,5.71,5.63,5.5,5.43,5.7,5.66,5.73,5.67,5.83,5.93,5.94,5.9,5.7,5.48,5.66,5.63,5.42,5.6,5.81,5.99,5.87,5.47,5.6,5.56,5.72,5.77,5.91,5.63,5.72,5.61,5.68,5.72,5.69,5.74,5.85,5.77,5.86,5.91,5.55,5.67,5.64,5.69,5.82,5.8,5.71,5.63,5.65,5.79,5.8,5.83,5.65,5.47,5.68,5.58,5.45,5.4,5.63,5.79,5.74,5.57,5.67,5.9,5.72,5.39,5.46,5.54,5.8,5.93,5.76,5.58,5.48,5.51,5.54,5.66,5.58,5.61,5.68,5.71,5.72,5.71,5.75,5.77,5.54,5.6,5.55,5.62,5.48,5.54,5.75,5.73,5.7,5.68,5.77,5.99,5.71,5.59,5.64,5.55,5.47,5.75,5.83,5.99,5.89,5.86,5.46,5.44,5.85,5.91,5.75,5.7,5.53,5.55,5.74,5.82,5.51,5.64,5.69,5.71,5.54,5.63,5.61,5.54,5.5,5.6,5.65,5.66,5.73,5.83,5.62,5.58,5.7,6.01,5.85,5.71,5.61,5.76,5.76,5.79,5.72,5.89,5.86,5.71,5.6,5.72,5.71,5.99,5.39,5.8,5.8,5.68,5.64,5.68,5.67,5.51,5.58,5.76,5.78,5.66,5.85,5.73,5.77,5.54,5.52,5.7,5.87,5.58,5.58,5.36,5.43,5.61,5.63,5.76,5.77,5.8,5.76,5.87,6.13,5.79,5.48,5.78],[0.91,1.61,4.43,5.41,6.26,6.32,6.26,6.04,5.87,5.9,5.85,5.77,5.81,5.66,5.57,5.51,5.62,5.68,5.66,5.79,5.7,5.4,5.38,5.5,5.69,5.61,5.54,5.59,5.46,5.52,5.36,5.46,5.57,5.44,5.5,5.44,5.25,5.2,5.16,5.16,5.12,4.96,4.7,4.76,4.77,4.93,4.95,5.21,5.33,5.29,5.11,5.15,5.17,5.16,5.06,5.08,4.99,5.07,5.11,5.15,4.86,4.75,4.79,4.91,4.89,4.87,4.81,5.0,5.16,4.98,4.73,4.88,5.03,4.87,4.98,5.04,4.83,4.71,4.49,4.33,4.34,4.22,4.13,4.15,3.91,4.02,4.08,4.27,4.46,4.55,4.52,4.37,4.34,4.34,4.14,3.88,3.97,3.8,3.88,4.04,3.95,3.85,4.21,4.15,3.99,3.98,3.95,3.9,3.81,3.72,3.69,3.58,3.51,3.47,3.53,3.51,3.47,3.85,3.85,3.87,4.14,3.96,3.78,3.77,3.73,3.83,3.58,3.44,3.48,3.4,3.3,3.36,3.34,3.38,3.53,3.62,3.46,3.35,3.35,3.28,3.39,3.31,3.31,3.43,3.49,3.33,3.28,3.47,3.47,3.28,3.19,3.15,3.31,3.34,3.29,3.55,3.62,3.54,3.73,3.6,3.53,3.5,3.57,3.7,3.59,3.39,3.22,2.81,2.87,2.96,3.06,3.16,3.14,3.4,3.4,3.25,3.25,3.26,3.25,3.21,3.35,3.31,3.39,3.46,3.43,3.37,3.13,3.14,3.09,3.06,3.18,3.24,3.34,3.25,3.3,3.43,3.52,3.74,3.56,3.42,3.27]],["梅花桩",[0.85,0.27,0.97,1.43,2.59,2.79,3.88,4.17,4.46,4.65,4.87,5.07,5.26,5.33,5.41,5.42,5.56,5.56,5.71,5.53,5.55,5.46,5.57,5.56,5.65,5.77,5.79,5.83,5.71,5.67,5.72,5.6,5.56,5.45,5.62,5.53,5.51,5.57,5.67,5.83,5.76,5.7,5.36,5.46,5.58,5.5,5.54,5.64,5.72,5.8,5.67,5.68,5.7,5.83,5.71,5.78,5.66,5.58,5.5,5.79,5.83,5.8,5.79,5.89,5.9,5.83,5.77,5.7,5.7,5.75,5.79,5.84,5.75,5.8,5.77,5.79,5.71,5.81,5.75,5.81,5.69,5.67,5.67,5.67,5.36,5.51,5.58,5.77,5.74,5.6,5.69,5.66,5.7,5.76,5.76,5.8,5.67,5.67,5.71,5.72,5.76,5.8,5.8,5.72,5.76,5.76,5.74,5.69,5.69,5.62,5.63,5.65,5.69,5.73,5.85,5.97,5.96,5.86,5.95,5.93,5.86,5.84,5.79,5.65,5.52,5.65,5.59,5.62,5.67,5.94,5.82,5.71,5.77,5.83,5.83,5.76,5.67,5.77,5.69,5.68,5.65,5.6,5.6,5.71,5.7,5.69,5.69,5.71,5.86,5.79,5.9,5.89,5.75,5.79,5.82,5.66,5.67,5.61,5.66,5.83,5.92,5.8,5.66,5.66,5.6,5.52,5.57,5.44,5.63,5.71,5.71,5.81,5.84,5.71,5.69,5.6,5.73,5.79,5.75,5.88,5.78,5.65,5.73,5.68,5.65,5.8,5.8,5.65,5.69,5.68,5.66,5.76,5.72,5.73,5.74,5.73,5.83,5.77,5.77,5.82,5.82],[0.85,0.02,0.1,0.21,0.26,0.29,0.32,0.45,0.43,0.41,0.44,0.47,0.83,1.32,1.53,1.72,1.94,2.08,2.3,2.33,2.41,2.41,2.45,2.47,2.52,2.53,2.57,2.75,2.71,2.71,2.63,2.74,2.73,2.76,2.85,2.79,2.85,2.85,2.89,2.94,2.84,2.85,2.64,2.71,2.94,2.91,3.02,3.08,3.02,3.03,3.09,3.13,3.04,3.07,3.22,3.18,3.2,3.15,3.08,3.14,3.05,3.3,3.25,3.26,3.28,3.29,3.22,3.33,3.41,3.34,3.41,3.33,3.54,3.44,3.49,3.32,3.5,3.58,3.54,3.5,3.7,3.52,3.49,3.41,3.14,3.52,3.55,3.55,3.52,3.59,3.71,3.63,3.6,3.58,3.75,3.78,3.76,3.68,3.72,3.72,3.83,3.73,3.66,3.69,3.79,3.76,3.84,3.89,3.88,3.8,3.9,3.89,3.89,3.87,3.85,3.85,3.98,3.9,3.98,4.0,4.1,4.09,4.0,3.9,3.96,4.06,4.01,4.08,4.13,4.1,4.01,4.07,4.05,3.8,3.87,4.02,4.0,4.01,4.14,4.22,4.22,4.18,4.23,4.16,4.08,4.08,4.05,4.08,4.04,4.22,4.25,4.16,4.1,4.04,4.2,4.3,4.3,4.28,4.28,4.23,4.26,4.33,4.49,4.42,4.36,4.37,4.39,4.16,4.34,4.27,4.43,4.46,4.41,4.55,4.43,4.46,4.46,4.51,4.48,4.5,4.56,4.57,4.65,null,4.16,4.2,4.2,4.18,4.47,4.42,4.47,4.44,4.34,4.24,4.27,4.53,4.52,4.6,4.64,4.67,4.59]]];

  const SCENES = [
    { n: 1, part: '总览', title: '两段：地形专家 → 看深度的学生', sub: '图 2 的 3D 版。方块可以点', dur: 13, cam: [0.25, 1.0, 16, [0.4, 0.9, -0.4]],
      html: dl([['阶段 1', '每个地形一个专家，PPO，看特权高度图，手上加随机向下的力'], ['阶段 2', 'DAgger 蒸馏成一个学生，看前后两路深度'], ['部署', '学生下身 + 蒸馏出的上身 MLP，50 Hz'], ['框架', 'holosoma（PPO-MA / DAgger-MA），训练后端 IsaacGym']]) +
        '<p>论文说四个地形族各一个专家。发布的权重有四个目录，但上楼梯和下楼梯是同一个文件，训练脚本也只有 stones、stairs、slopes 三个预设。画面里楼梯专家连着两个槽位。</p>' +
        '<p>老师按每个环境所在地形的编号选专家（代码叫 MoE 路由），学生不知道自己在哪种地形上，只能从深度图里看出来。</p>' + src('§3 · 图 2 · 代码 experiment.py、data/models') },
    { n: 2, part: '§3.1.1 地形', title: '10 行课程：难度 = 行号 / 10', sub: '亮的一行随进度往上走；看每种地形参数怎样随难度变', dur: 14, cam: [0.5, 0.95, 16, [0, 0.3, 0.1]],
      html: dl([['坡', '正切 = 0.75 d，最难一行 34.0°（论文写 37° = arctan 0.75）'], ['楼梯', '台阶高 0.01 + 0.25 d，再加 U(−0.01, 0.03)'], ['梅花桩', '边长 0.40 − 0.15 d，间隙 0.05 + 0.65 d'], ['升级', '走过 2.5 m 且到时间；到顶随机重置']]) +
        '<p>课程有 10 行，d 从 0 到 0.9，取不到 1。所以论文写的范围上限（37°、0.27 m、0.70 m 间隙）在课程里到不了，最难一行是 34.0°、0.235–0.265 m、0.635 m。</p>' +
        '<p>到顶的环境被随机分回 0 到 9 行，平均等级会停在一个饱和值。表 3 和图 13 的“6.0”很可能就是它（我的推断）。</p>' +
        guess('地形块缩小画了，真实每块 8 m × 8 m；参数是按代码公式当场算的。') + src('§3.1.1 · holosoma terrain.py · RPL terms/curriculum.py') },
    { n: 3, part: '§3.1 专家', title: '专家看脚下 1.6 m × 1.0 m 的高度图', sub: '16 × 10 个点，按高度着色；切换上身 / 下身两个智能体', dur: 13, cam: [0.9, 1.08, 6.4, [0.5, 0.75, -0.4]],
      html: dl([['高度图', '16 × 10 点，0.1 m 间距，截到 ±0.5 m'], ['下身', 'CNN (16, 16) 编码高度图 + 本体感觉 → MLP → 15 维'], ['上身', 'MLP，只看本体感觉 → 14 维'], ['评论家', '另看根线速度、末端力'], ['对称增强', '镜像损失系数 1.0']]) +
        '<p>FALCON 的双智能体：下身管行走，上身管跟踪手臂目标，各有自己的奖励，PPO 一起训。高度图只给下身。</p>' +
        '<p>代码里两个智能体看的是同一份 115 维的状态（含所有命令），不是论文写的各看各的目标。</p>' +
        toyb('楼梯是玩具几何；点的位置按机器人朝向排成 16 × 10 网格。') + src('§3、§3.1 · 代码 algo.py、observation.py') },
    { n: 4, part: '§3.1 力课程', title: '手上随机加向下的力，幅度慢慢放大', sub: '切换专家 / 蒸馏的范围；红色箭头 = 实际施加的 Fz', dur: 14, cam: [0.6, 1.2, 5.0, [0.1, 0.95, 0]],
      html: dl([['方向比', '[0, 0, 1]：只有 z（代码 x、y 的“置零概率”是 1.0）'], ['专家', 'Fz ∼ U(−60, 5) N，25% 的环境不加'], ['蒸馏', 'Fz ∼ U(−100, 5) N'], ['课程', '系数 0.1 起，平均回合长度 > 210 时 +0.02（蒸馏 +0.05）'], ['对照', '2 kg = 19.6 N，2.5 kg = 24.5 N']]) +
        '<p>论文只给了方向比。真机搬的是 2 kg，仿真到仿真用 2.5 kg 的假手，都在训练范围里。去掉力扰动，整场成功率从 10/10 掉到 3/10（表 4）。</p>' +
        toyb('每 1/6 段时间用固定种子抽一次力；课程系数按进度从 0.1 线性画到 1（真实是按回合长度涨跌）。不模拟关节力矩预算。') + src('§3.1 · 表 4 · 代码 command.py、curriculum.py') },
    { n: 5, part: '§3.2.2 渲染', title: '前后两路深度：光线同时打机器人和地形', sub: '这一幕当场算深度图。切换是否包含机器人自身网格', dur: 15, cam: [1.5708, 1.18, 7.4, [0, 1.0, -0.15]],
      html: dl([['相机', '前后各一，挂在躯干，101.41° × 69°'], ['渲染', '240 × 135 → 48 × 27（这里直接算 48 × 27）'], ['范围', '光线最远 2.5 m，深度截到 [0.1, 2.0] m'], ['自遮挡', '22 个部件网格，在部件局部系里查'], ['速度', '1024 环境 2 路 1.5 s/迭代（表 2，含物理）']]) +
        '<p>算法 1：每条光线先查机器人各部件（光线变到部件的局部坐标，不必每帧重建网格），记下最近距离作为上界；再查地形，更近就替换。所有环境、相机、像素在一个内核里并行，整条流水线录成 CUDA graph。</p>' +
        '<p>前相机看到楼梯，后相机看到梅花桩：这就是论文说的“非对称多视角输入”。打开“含机器人”可以看到腿挡住视野的一块。</p>' +
        toyb('玩具地形：前面 6 级 0.25 m × 0.15 m 台阶，后面三排 0.25 m 梅花桩（中心距 0.6 m），腿是两根方柱。相机高 0.95 m、俯 75° 按配置值画，坐标约定未核实。') + src('§3.2.2 · 算法 1 · 代码 camera.py、warp_kernels.py') },
    { n: 6, part: '§3.2.4 RSM', title: '噪声、丢点、延迟和随机侧面遮挡', sub: '切换遮挡模式和地形；看哪些像素被换成随机深度', dur: 14, cam: [0, 1.45, 9.0, [0, 1.25, 0]],
      html: dl([['噪声', '高斯，σ = 0.1 × 深度'], ['丢点', '5%，置为近平面 0.1 m'], ['large', '左 90 / 右 50 像素（240 宽），剩 41.7%'], ['small', '左 60 / 右 20，剩 66.7%'], ['概率', '坡、楼梯 (0.1, 0.30, 0.60)；梅花桩 (0.1, 0.60, 0.30)'], ['延迟', '4 帧环形缓冲，固定读 2 帧前（10 Hz 下约 200 ms）']]) +
        '<p>RSM 把左右两侧换成 [0.1, 2.0] m 的均匀随机数，逼策略看中间。连续地形多用 large，梅花桩多用 small，因为可落脚的石头可能只在视野边上。</p>' +
        '<p>代码每次渲染都重新抽模式，不是每回合一次；左右遮挡宽度不对称，论文和代码都没解释。</p>' +
        toyb('深度图来自第 5 幕的前相机；噪声、丢点、遮挡模式按固定种子生成，参数是代码的。') + src('§3.2.4 · 表 7 · 代码 camera.py、warp_depth.py') },
    { n: 7, part: '§3.2 学生', title: '每路一个 CNN，按通道切 token，和状态一起进 Transformer', sub: '方块大小只表示相对量级；粒子是一次前向的数据流', dur: 15, cam: [0.0, 1.38, 18, [0.2, 1.35, 0]],
      html: dl([['输入', '每路 2 帧 × 27 × 48；状态 5 帧 × 115'], ['CNN', '(16, 32, 32)，核 4 步长 2：27 × 48 → 13 × 24 → 6 × 12 → 3 × 6'], ['视觉 token', '32 个通道，每个 18 格 × 2 路 = 36 维，先乘 DFSV 系数'], ['Transformer', '37 个 token，64 维，4 头，4 层，取最后一个'], ['动作头', 'MLP [512, 256, 256, 128] → 下身 15 维']]) +
        '<p>论文只说 CNN + Transformer；尺寸全来自代码。和三种替代结构比，表 4：CNN+MLP 6/10、7/10，CNN+RNN 5/10、5/10，U-Net+Transformer 1/10、0/10。</p>' +
        '<p>上身是另一个 MLP，只看状态，也是从四个专家的上身蒸馏来的。</p>' +
        guess('方块和粒子是示意；数字是代码配置。') + src('§3.2、§4.4 · 代码 algo.py、vision_transformer.py、modules.py') },
    { n: 8, part: '§3.2.3 DFSV', title: '按速度命令给每路相机打分', sub: '这一幕当场算。切换哪条曲线作用在右边的特征柱上', dur: 14, cam: [0.0, 1.45, 11, [0.4, 1.35, 0]],
      html: dl([['论文', 'δ = 1 − σ(−k(⟨v, n⟩ − v_th)) = σ(k(⟨v, n⟩ − v_th))'], ['代码', '前相机 1 − σ(k(−v_x − v_th)) = σ(k(v_x + v_th))'], ['参数', '代码 k = 4，v_th = 0.2；低于 0.1 置零（论文都没给）'], ['v_x = 0', '论文 0.31 / 0.31，代码 0.69 / 0.69'], ['v_x = 0.5', '论文 0.77 / 0.06，代码 0.94 / 0.23']]) +
        '<p>两者差在阈值的符号，曲线整体平移 2 v_th = 0.4 m/s。发布的学生是按代码这条训的，所以实际生效的是代码的版本：低速时两路相机都保留大部分权重。</p>' +
        '<p>去掉 DFSV，整场成功率前进 0/10、后退 2/10（表 4）。</p>' + src('§3.2.3 · 代码 modules.py 第 52–121 行 · 精读页读者注 9') },
    { n: 9, part: '§3.2.1、§4.5', title: '学生自己走，老师在旁边报答案', sub: '切换地形看图 13 的两条曲线（只用 DAgger / 混合）', dur: 15, cam: [0.0, 1.38, 15, [1.1, 1.5, 0]],
      html: dl([['式 (1)', 'E_{k,t} ‖π_vis(s, G, D) − π_exp,k(s, G, H)‖²'], ['谁行动', '学生（取均值），老师只出标签'], ['路由', '老师按地形编号选专家（MoE）'], ['式 (2)', '混合：λ_PPO L_PPO + λ_D L_distill，λ_D 余弦降到 0.1'], ['代码', 'use_critic = False，没有 PPO 项']]) +
        '<p>论文选只用 DAgger：混合目标让四个地形的梯度几百次迭代内就互相正交，最终地形等级更低。同一团队的 PHP 跑酷得出相反结论（只用 DAgger 学不出爬墙所需的瞬间大力矩）。</p>' +
        '<p>从图 13 读数：混合在坡和上楼梯的早期其实更快，后期才掉下来；只有梅花桩是全程落后。</p>' +
        src('§3.2.1 式 (1) · §4.5 式 (2)–(4) · 图 13（矢量读数）') },
    { n: 10, part: '§4.6 部署', title: 'sim2sim 两个进程，真机整场 6/10', sub: '切换 sim2sim / 真机 / 表 4', dur: 14, cam: [0.15, 1.25, 13, [0, 1.4, 0]],
      html: dl([['sim2sim', 'MuJoCo 仿真进程 ↔ DDS ↔ holosoma_inference 策略进程；深度走共享内存'], ['真机', 'G1 + 前后两台 ZED 2i（15 Hz），Jetson Orin NX 16GB，50 Hz'], ['遥操作', 'Apple Vision Pro 给上身目标'], ['表 5', '不带负载 3/5，带 2 kg 3/5；失败：梅花桩 2、楼梯侧边 1、负载摆动 1']]) +
        '<p>整场：20° 坡、22 / 25 cm 两种踏面的楼梯、25 cm 梅花桩，任何一步踩错就算失败。6/10 的 95% 区间是 [0.31, 0.83]。</p>' +
        '<p>仓库里的 MuJoCo 场景是 20° 坡、15 cm 台阶、1.5 m 宽，和正文写的 25°、20 cm、1.2 m 不一样。</p>' +
        guess('机器人、相机和进程方块是示意；柱子是表 4、表 5 的数字。') + src('§4.3、§4.6 · 表 4 · 表 5 · 代码 rpl_sim2sim/') }
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

  /* ---------- toy problems computed on load (pure functions of fixed seeds) ---------- */
  /* DFSV, paper and code (holosoma modules.py CameraVisionMask) */
  const sig = x => 1 / (1 + Math.exp(-x));
  const K4 = 4, VTH = 0.2, CUT = 0.1;
  const dfsvPaper = v => [sig(K4 * (v - VTH)), sig(K4 * (-v - VTH))];
  const dfsvCode = v => { const f = 1 - sig(K4 * (-v - VTH)), b = 1 - sig(K4 * (v - VTH)); return [f < CUT ? 0 : f, b < CUT ? 0 : b]; };

  /* toy terrain for the ray caster: boxes [x0,x1,y0,y1,z0,z1]; robot faces +z */
  const TERR = (function () {
    const B = [[-1.6, 1.6, -0.6, 0, -0.35, 0.35]];
    for (let k = 0; k < 6; k++) B.push([-0.6, 0.6, -0.6, 0.15 * (k + 1), 0.45 + 0.25 * k, 3.2]);
    B.push([-1.6, -0.6, -0.6, 0, 0.35, 3.2], [0.6, 1.6, -0.6, 0, 0.35, 3.2], [-0.6, 0.6, -0.6, 0, 0.35, 0.45], [-1.6, 1.6, -0.7, -0.6, -3.2, -0.35]);
    for (let r = 0; r < 3; r++) for (const xc of [-0.15, 0.15]) { const zc = -0.65 - 0.6 * r; B.push([xc - 0.125, xc + 0.125, -0.6, 0, zc - 0.125, zc + 0.125]); }
    B.push([-1.6, 1.6, -0.6, 0, -3.2, -2.3]);
    return B;
  })();
  const LEGS = [[-0.16, -0.05, 0, 0.62, -0.07, 0.07], [0.05, 0.16, 0, 0.62, -0.07, 0.07], [-0.17, -0.04, 0, 0.05, -0.06, 0.16], [0.04, 0.17, 0, 0.05, -0.06, 0.16]];
  function rayBox(o, d, b) {
    let t0 = -Infinity, t1 = Infinity;
    for (let a = 0; a < 3; a++) {
      const lo = b[2 * a], hi = b[2 * a + 1];
      if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo || o[a] > hi) return Infinity; continue; }
      let ta = (lo - o[a]) / d[a], tb = (hi - o[a]) / d[a]; if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return Infinity;
    }
    return t0 > 1e-6 ? t0 : (t1 > 1e-6 ? 0 : Infinity);
  }
  const W48 = 48, H27 = 27, HFOV = 101.41 * Math.PI / 180, CAMH = 0.95, PITCH = 75 * Math.PI / 180;
  const TH = Math.tan(HFOV / 2), TV = TH * H27 / W48;
  function camBasis(back) {
    const s = back ? -1 : 1, f = [0, -Math.sin(PITCH), s * Math.cos(PITCH)];
    const r = [-s, 0, 0]; const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    return { o: [s * 0.06, CAMH, back ? -0.125 : 0.135], f, r, u };
  }
  /* returns depth (along the optical axis) per pixel, row 0 at the top, plus which object was hit */
  function renderDepth(back, withRobot) {
    const c = camBasis(back), D = new Float32Array(W48 * H27), HIT = new Uint8Array(W48 * H27);
    for (let v = 0; v < H27; v++) for (let u = 0; u < W48; u++) {
      const a = (2 * (u + 0.5) / W48 - 1) * TH, b = (1 - 2 * (v + 0.5) / H27) * TV;
      const d = [0, 1, 2].map(i => c.f[i] + a * c.r[i] + b * c.u[i]);
      const n = Math.hypot(d[0], d[1], d[2]), m = 1 / n, far = 2.5;
      let best = far / m, who = 0;
      /* robot first (bound), then terrain: Algorithm 1 */
      if (withRobot) for (const bx of LEGS) { const t = rayBox(c.o, d, bx); if (t < best) { best = t; who = 2; } }
      for (const bx of TERR) { const t = rayBox(c.o, d, bx); if (t < best) { best = t; who = 1; } }
      let z = best; /* d has unit component along f, so t is the depth along the optical axis */
      if (who === 0) z = far * m; z = clamp(z, 0.1, 2.0);
      D[v * W48 + u] = z; HIT[v * W48 + u] = who;
    }
    return { D, HIT };
  }
  const DEPTH = { f1: renderDepth(false, true), f0: renderDepth(false, false), b1: renderDepth(true, true), b0: renderDepth(true, false) };
  /* noise / dropout / RSM, code parameters; scaled from 240 px to 48 px: large 18 | 10, small 12 | 4 */
  function augment(D, mode, seed) {
    const r = L.rng(seed), out = new Float32Array(D.length), mask = new Uint8Array(D.length);
    const xl = mode === 2 ? 18 : mode === 1 ? 12 : 0, xr = mode === 2 ? 10 : mode === 1 ? 4 : 0;
    for (let i = 0; i < D.length; i++) {
      const u = i % W48; let z = D[i] + 0.1 * D[i] * L.gauss(r);
      if (r() < 0.05) z = 0.1;
      if (u < xl || u >= W48 - xr) { z = 0.1 + 1.9 * r(); mask[i] = 1; }
      out[i] = clamp(z, 0.1, 2.0);
    }
    return { out, mask };
  }
  /* depth -> colour (near bright, far dark, like a typical depth view) */
  function depthCanvas(D, mask, o = {}) {
    const c = document.createElement('canvas'); c.width = W48; c.height = H27; const g = c.getContext('2d'), im = g.createImageData(W48, H27);
    for (let i = 0; i < D.length; i++) {
      const t = 1 - (D[i] - 0.1) / 1.9, k = Math.round(30 + 215 * t);
      let rr = k, gg = k, bb = Math.min(255, k + 18);
      if (mask && mask[i] && o.tint) { rr = Math.min(255, k * 0.6 + 100); gg = k * 0.5; bb = k * 0.5; }
      if (o.robot && o.robot[i] === 2) { rr = Math.min(255, k * 0.55 + 40); gg = Math.min(255, k * 0.75 + 60); bb = Math.min(255, k * 0.6 + 40); }
      im.data[i * 4] = rr; im.data[i * 4 + 1] = gg; im.data[i * 4 + 2] = bb; im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0); return c;
  }
  function imgPlane(G, w, h, pos, o = {}) {
    const tex = new THREE.CanvasTexture(document.createElement('canvas')); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: o.opacity != null, opacity: o.opacity ?? 1 }));
    m.position.set(...pos); if (o.rotY) m.rotation.y = o.rotY; G.add(m);
    let last = null;
    m.userData.set = (canvas, key) => { if (key === last) return; last = key; m.material.map.dispose(); const t = new THREE.CanvasTexture(canvas); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; m.material.map = t; m.material.needsUpdate = true; };
    return m;
  }

  /* ---------- 3D helpers (same pattern as interactives/latent) ---------- */
  let S;
  try { S = L.makeScene($('stage'), { fov: 38, theta: 0.3, phi: 1.0, dist: 12, maxDist: 120, minDist: 1.5 }); }
  catch (e) { $('nogl').hidden = false; }
  if (!S) { showInfo(0); return; }
  const root = new THREE.Group(); S.scene.add(root);
  let LABS = [], refDist = 12, PICKS = [];
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
  const BALL = new THREE.SphereGeometry(1, 10, 8), CUBE = new THREE.BoxGeometry(1, 1, 1);
  function inst(geo, n, o = {}) { const m = L.mat(0xffffff, { opacity: o.opacity, roughness: 0.6 }); const im = new THREE.InstancedMesh(geo, m, Math.max(1, n)); im.frustumCulled = false; return im; }
  function setI(im, n, p, s) { _P.set(p[0], p[1], p[2]); if (typeof s === 'number') _Sv.set(s, s, s); else _Sv.set(s[0], s[1], s[2]); im.setMatrixAt(n, _M.compose(_P, _Q0, _Sv)); }
  function colI(im, n, c) { _C.setRGB(c[0], c[1], c[2]); im.setColorAt(n, _C); }
  function done(im) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  function block(w, h, d, color, pos, o = {}) { const m = L.box(w, h, d, color, { edgeOpacity: 0.3, opacity: o.opacity, ...o }); m.position.set(...pos); m.userData.c = hex3(color); return m; }
  const glow = (m, k) => { const c = m.userData.c; m.material.emissive.setRGB(c[0] * 0.75 * k, c[1] * 0.75 * k, c[2] * 0.75 * k); };
  function along(pts, t) { const n = pts.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1]; return [L.lerp(a[0], b[0], f), L.lerp(a[1], b[1], f), L.lerp(a[2], b[2], f)]; }
  function stream(G, n, color, r = 0.08) {
    const im = inst(BALL, n); im.material.emissive.setHex(color); im.material.emissiveIntensity = 0.55; im.material.color.setHex(color); G.add(im);
    return (pts, phase, on) => { im.visible = on > 0; if (!on) return; for (let i = 0; i < n; i++) setI(im, i, along(pts, (phase + i / n) % 1), r * on); done(im); };
  }
  const wire = (G, pts, color, o = {}) => { const l = L.line(pts, color, { opacity: o.opacity ?? 0.6, dashed: o.dashed, dash: o.dash, gap: o.gap }); G.add(l); return l; };
  function pline(G, n, color, o = {}) {
    const pos = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: o.opacity ?? 1 })); l.frustumCulled = false; l.renderOrder = o.order ?? 3; G.add(l);
    l.userData.set = pts => { const k = Math.max(1, Math.min(n, pts.length)); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)]; pos[i * 3] = q[0]; pos[i * 3 + 1] = q[1]; pos[i * 3 + 2] = q[2]; } g.attributes.position.needsUpdate = true; };
    return l;
  }
  /* a flat ribbon facing +z (GL lines are one pixel wide) */
  function ribbon(G, n, color, w = 0.06, o = {}) {
    const pos = new Float32Array(n * 6), idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: o.opacity ?? 1 })); m.frustumCulled = false; m.renderOrder = o.order ?? 2; G.add(m);
    m.userData.set = pts => { const k = Math.min(n, pts.length); for (let i = 0; i < n; i++) { const q = pts[Math.min(i, k - 1)], z = q[2] ?? 0; pos[i * 6] = q[0]; pos[i * 6 + 1] = q[1] - w / 2; pos[i * 6 + 2] = z; pos[i * 6 + 3] = q[0]; pos[i * 6 + 4] = q[1] + w / 2; pos[i * 6 + 5] = z; } g.attributes.position.needsUpdate = true; };
    return m;
  }
  function panel(G, x, y, z, w, h, o = {}) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x0c1220, transparent: true, opacity: o.opacity ?? 0.55, side: THREE.DoubleSide, depthWrite: false })); m.position.set(x + w / 2, y + h / 2, z); G.add(m); return m; }

  /* ---------- the hand-made humanoid (faces +z, pelvis at STAND) ---------- */
  function robot(color, o = {}) {
    const m = L.mat(color, { opacity: o.opacity, roughness: 0.5, depthWrite: o.opacity == null || o.opacity > 0.6 });
    const G = new THREE.Group(), mesh = g => new THREE.Mesh(g, m);
    const limb = (len, r) => { const g = new THREE.Group(), c = mesh(new THREE.CylinderGeometry(r, r * 0.82, len, 8)); c.position.y = -len / 2; g.add(c); g.add(mesh(new THREE.SphereGeometry(r, 8, 6))); return g; };
    const pelvis = new THREE.Group(); G.add(pelvis);
    pelvis.add(mesh(new THREE.BoxGeometry(0.26, 0.1, 0.14)));
    const upper = new THREE.Group(); pelvis.add(upper);
    const tor = mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.36, 10)); tor.position.y = 0.2; upper.add(tor);
    const head = mesh(new THREE.SphereGeometry(0.085, 12, 9)); head.position.y = 0.48; upper.add(head);
    const cm = L.mat(COL.cam, { emissive: 0x0a3a20 });
    const camF = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.04), cm); camF.position.set(0.06, 0.3, 0.15); upper.add(camF);
    const camB = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.04), cm); camB.position.set(-0.06, 0.3, -0.14); upper.add(camB);
    const legs = [-1, 1].map(s => { const th = limb(0.3, 0.05); th.position.set(s * 0.09, -0.04, 0); const sh = limb(0.3, 0.042); sh.position.y = -0.3; th.add(sh); const ft = mesh(new THREE.BoxGeometry(0.08, 0.035, 0.21)); ft.position.set(0, -0.31, 0.04); sh.add(ft); pelvis.add(th); return { th, sh }; });
    const arms = [-1, 1].map(s => { const up = limb(0.2, 0.034); up.position.set(s * 0.18, 0.34, 0); const lo = limb(0.2, 0.028); lo.position.y = -0.2; up.add(lo); const hand = new THREE.Group(); hand.position.y = -0.22; lo.add(hand); upper.add(up); return { up, lo, hand, s }; });
    G.userData.hands = arms.map(a => a.hand);
    G.userData.set = q => {
      pelvis.position.y = q.y ?? 0; pelvis.rotation.set(q.pitch || 0, 0, 0); upper.rotation.x = q.lean || 0;
      legs[0].th.rotation.x = -q.hL; legs[1].th.rotation.x = -q.hR; legs[0].sh.rotation.x = q.kL; legs[1].sh.rotation.x = q.kR;
      arms.forEach((a, i) => { a.up.rotation.x = -(q.sh ?? 0.25) + (i ? -1 : 1) * (q.swing || 0); a.up.rotation.z = a.s * 0.12; a.lo.rotation.x = -(q.el ?? 0.5); });
    };
    return G;
  }
  const STAND = 0.65;
  /* walking clip: t seconds, dir +1 forward / -1 backward; returns pose and root offset */
  function walk(t, amp = 1) {
    const ph = 2 * Math.PI * t / 0.8, s = Math.sin(ph);
    return { y: STAND - 0.03 + 0.012 * Math.abs(Math.cos(ph)) * amp, hL: 0.35 + 0.35 * s * amp, hR: 0.35 - 0.35 * s * amp, kL: 0.55 + 0.35 * Math.max(0, -Math.cos(ph)) * amp, kR: 0.55 + 0.35 * Math.max(0, Math.cos(ph)) * amp, swing: 0.25 * s * amp, sh: 0.3, el: 0.6 };
  }
  const standQ = () => ({ y: STAND - 0.03, hL: 0.35, hR: 0.35, kL: 0.55, kR: 0.55, sh: 0.25, el: 0.5 });
  function place(r, q, at, yaw = 0, sc = 1) { r.userData.set(q); r.position.set(...at); r.rotation.y = yaw; r.scale.setScalar(sc); }

  function buildCtl() {
    const box = $('ctl'); box.innerHTML = ''; box.hidden = true; if (!api) return;
    (api.ctls || []).forEach((c, gi) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${c.label}</span>` + c.items.map((t, k) => `<button type="button" data-g="${gi}" data-k="${k}" aria-pressed="${c.get() === k}">${t}</button>`).join('');
      box.appendChild(row); box.hidden = false;
    });
  }
  function syncCtl() { (api?.ctls || []).forEach((c, gi) => { $('ctl').querySelectorAll(`button[data-g="${gi}"]`).forEach(b => b.setAttribute('aria-pressed', String(c.get() === +b.dataset.k))); }); }

  /* terrain miniatures used in scenes 1 and 2; d in [0, 0.9]; tile of size w centred at (x, z) */
  function tile(G, type, d, x, z, w, o = {}) {
    const g = new THREE.Group(); g.position.set(x, 0, z); G.add(g); const c = [COL.slope, COL.up, COL.down, COL.stone][type];
    g.add(block(w, 0.04, w, 0x2a3346, [0, -0.02, 0], { edges: false }));
    if (type === 0) { const h = Math.max(0.01, 0.75 * d * w * 0.45), geo = new THREE.ConeGeometry(w * 0.45 * Math.SQRT2, h, 4, 1), py = new THREE.Mesh(geo, L.mat(c, { roughness: 0.8 })); py.rotation.y = Math.PI / 4; py.position.y = h / 2; py.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x0b1020, transparent: true, opacity: 0.45 }))); g.add(py); }
    else if (type === 1 || type === 2) {
      const h = Math.max(0.006, (0.01 + 0.25 * d) * w * 0.7), s = i => w * 0.9 * (1 - i * 0.22);
      for (let i = 0; i < 4; i++) {
        if (type === 1) { const hh = h * (i + 1); g.add(block(s(i), hh, s(i), c, [0, hh / 2, 0], { edgeOpacity: 0.3 })); continue; }
        const hh = h * (4 - i), a = s(i), b = i < 3 ? s(i + 1) : 0, t = (a - b) / 2, m = (a + b) / 4;
        g.add(block(a, hh, t, c, [0, hh / 2, m], { edgeOpacity: 0.3 }), block(a, hh, t, c, [0, hh / 2, -m], { edgeOpacity: 0.3 }));
        if (b > 0) g.add(block(t, hh, b, c, [m, hh / 2, 0], { edgeOpacity: 0.3 }), block(t, hh, b, c, [-m, hh / 2, 0], { edgeOpacity: 0.3 }));
      }
    }
    else { const sz = (0.40 - 0.15 * d), gap = 0.05 + 0.65 * d, sc = w / 2.6; for (let i = -1; i <= 1; i++) for (const sx of [-1, 1]) g.add(block(sz * sc, 0.12, sz * sc, c, [sx * (sz + 0.05) * sc / 2, 0.06, i * (sz + gap) * sc], { edgeOpacity: 0.25 })); }
    return g;
  }

  /* ---------- scene 1: overview ---------- */
  function s1(G) {
    G.add(L.grid(20, 20));
    const terr = [['坡', 0, -5.4], ['上楼梯', 1, -3.6], ['下楼梯', 2, -1.8], ['梅花桩', 3, 0]];
    terr.forEach(([t, k, x]) => { tile(G, k, 0.6, x, -2.4, 1.3); G.add(lab(t, [x, 1.0, -2.4], { size: 20 })); });
    const ex = [['坡专家', -5.4, 2], ['楼梯专家（一个文件）', -2.7, 3], ['梅花桩专家', 0, 2]].map(([t, x, go]) => { const b = block(1.3, 0.55, 0.9, COL.exp, [x, 0.3, 0.2]); b.userData.go = go; PICKS.push(b); G.add(b, lab(t, [x, 1.0, 0.2], { size: 18, color: css(COL.exp) })); return b; });
    [[-5.4, -5.4], [-3.6, -2.7], [-1.8, -2.7], [0, 0]].forEach(([a, b]) => wire(G, [[a, 0.05, -1.7], [b, 0.05, -0.25]], COL.exp, { opacity: 0.7 }));
    const hm = block(1.0, 0.3, 0.7, 0x8fa6c8, [-2.7, 0.15, 1.6]); hm.userData.go = 2; PICKS.push(hm); G.add(hm, lab('特权高度图 16×10', [-2.7, 0.65, 1.6], { size: 16 }));
    const stu = block(1.8, 0.8, 1.2, COL.stu, [4.2, 0.4, 0.2]); stu.userData.go = 6; PICKS.push(stu); G.add(stu, lab('学生：CNN + Transformer', [4.2, 1.35, 0.2], { size: 19, color: css(COL.stu) }));
    const cams = block(1.2, 0.3, 0.7, COL.cam, [4.2, 0.15, 1.8]); cams.userData.go = 4; PICKS.push(cams); G.add(cams, lab('前后两路深度', [4.2, 0.6, 1.8], { size: 16 }));
    const dag = block(1.1, 0.4, 0.7, 0xd95926, [2.0, 0.2, 0.2]); dag.userData.go = 8; PICKS.push(dag); G.add(dag, lab('DAgger', [2.0, -0.35, 0.6], { size: 18 }));
    const rob = robot(COL.robot); G.add(rob);
    G.add(lab('阶段 1：PPO 专家', [-2.7, 2.4, -1.0], { size: 22, color: css(COL.exp) }), lab('阶段 2：蒸馏', [3.2, 2.4, -1.0], { size: 22, color: css(COL.stu) }));
    const fa = stream(G, 8, COL.exp), fb = stream(G, 6, COL.stu);
    return { update(p) {
      const st = p < 0.45 ? 0 : p < 0.8 ? 1 : 2, q = (p * 16) % 1;
      ex.forEach(b => glow(b, st === 0 ? 0.6 : 0.1)); glow(stu, st >= 1 ? 0.6 : 0.1); glow(dag, st === 1 ? 0.7 : 0.1);
      fa([[-2.7, 0.6, 0.2], [2.0, 0.6, 0.2], [4.2, 0.6, 0.2]], q, st >= 1 ? 1 : 0); fb([[4.2, 0.4, 1.8], [4.2, 0.6, 0.2]], q, st >= 1 ? 1 : 0);
      const t = p * 13; place(rob, walk(t, st === 2 ? 1 : 0.4), [6.4, 0, -1.6 + (st === 2 ? Math.sin(t * 0.8) * 0.6 : 0)], 0, 1.4);
      cap(['阶段 1：每个地形一个 PPO 专家，看特权高度图。<b>上楼梯和下楼梯共用一个文件</b>', '阶段 2：学生自己走，专家按地形编号给标签，<b>只用 DAgger</b>', '部署：学生只看前后两路深度，来回走'][st]);
    } };
  }

  /* ---------- scene 2: terrain curriculum ---------- */
  function s2(G) {
    const names = ['坡', '上楼梯', '下楼梯', '梅花桩'], xs = [-3.3, -1.1, 1.1, 3.3], rows = [];
    for (let r = 0; r < 10; r++) { const z = 4.2 - r * 0.95; const row = xs.map((x, k) => tile(G, k, r / 10, x, z, 0.85)); rows.push(row); if (r % 3 === 0) G.add(lab(`行 ${r}`, [-4.75, 0.1, z], { size: 14 })); }
    names.forEach((t, k) => G.add(lab(t, [xs[k], 0.95, -4.95], { size: 18, color: css([COL.slope, COL.up, COL.down, COL.stone][k]) })));
    const hi = block(9.0, 0.02, 0.9, 0xffffff, [0, 0.01, 0], { opacity: 0.18, edges: false }); G.add(hi);
    const info = dynLab(G, [0, 2.4, -5.6], { size: 19, border: 'rgba(242,193,78,.8)' });
    return { update(p) {
      const r = Math.min(9, Math.floor(p * 10.5)), d = r / 10, z = 4.2 - r * 0.95; hi.position.z = z;
      rows.forEach((row, i) => row.forEach(g => g.traverse(o => { if (o.material && o.material.emissive) o.material.emissive.setScalar(i === r ? 0.18 : 0); })));
      const ang = Math.atan(0.75 * d) * 180 / Math.PI, sh = 0.01 + 0.25 * d, gap = 0.05 + 0.65 * d, sz = 0.40 - 0.15 * d;
      info(`d = ${d.toFixed(1)}　坡 ${ang.toFixed(1)}°　台阶 ${(Math.max(0, sh - 0.01)).toFixed(3)}–${(sh + 0.03).toFixed(3)} m\n梅花桩 边长 ${sz.toFixed(3)} m　间隙 ${gap.toFixed(3)} m`);
      cap(r === 9 ? '最难一行 d = 0.9：<b>34.0°、0.235–0.265 m、间隙 0.635 m</b>；论文的 37°、0.27 m、0.70 m 在课程里取不到' : `第 ${r} 行，难度 d = ${d.toFixed(1)}。走过 2.5 m 且到时间就升一行`);
    } };
  }

  /* ---------- scene 3: expert with privileged height map ---------- */
  function stairsH(x, z) { if (z < 0.45) return 0; return 0.15 * Math.min(6, Math.floor((z - 0.45) / 0.25) + 1); }
  function s3(G) {
    let view = +(OPT[0] ?? 0);
    G.add(block(2.4, 0.6, 1.0, 0x2a3346, [0, -0.3, 0], { edgeOpacity: 0.2 }));
    for (let k = 0; k < 6; k++) G.add(block(1.2, 0.15 * (k + 1), 0.25, COL.up, [0, 0.075 * (k + 1), 0.575 + 0.25 * k], { edgeOpacity: 0.3 }));
    const rob = robot(COL.robot); G.add(rob);
    const N = 160, dots = inst(BALL, N); dots.material.emissiveIntensity = 0.3; G.add(dots);
    const net = new THREE.Group(); G.add(net); net.position.set(1.5, 0, -1.4);
    const bH = block(0.5, 0.35, 0.35, 0x8fa6c8, [0, 1.4, 0]), bC = block(0.45, 0.35, 0.35, COL.exp, [0, 1.0, 0]), bM = block(0.6, 0.35, 0.35, COL.exp, [0, 0.55, 0]), bU = block(0.6, 0.35, 0.35, 0x9d8cff, [0.0, 0.1, 0]);
    net.add(bH, bC, bM, bU, lab('高度图 16×10', [0.85, 1.4, 0], { size: 15 }), lab('CNN (16,16)', [0.8, 1.0, 0], { size: 15 }), lab('下身 MLP → 15', [0.85, 0.55, 0], { size: 15 }), lab('上身 MLP → 14', [0.85, 0.1, 0], { size: 15 }));
    const st = stream(G, 6, COL.exp, 0.03);
    const ctls = [{ label: '看', items: ['下身（看高度图）', '上身（不看）'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      const t = p * 13, zr = -0.15 + 0.5 * seg(p, 0.1, 0.9);
      place(rob, walk(t, 0.6), [0, 0, zr]);
      let n = 0; for (let i = 0; i < 16; i++) for (let j = 0; j < 10; j++) { const x = -0.45 + j * 0.1, z = zr - 0.6 + i * 0.1 + 0.1, h = stairsH(x, z); setI(dots, n, [x, h + 0.02, z], view === 0 ? 0.018 : 0.006); const c = hex3(h > 0.25 ? 0xf2c14e : h > 0.05 ? 0x7cb8ff : 0x9aa6bf); colI(dots, n, c); n++; }
      done(dots);
      glow(bH, view === 0 ? 0.5 : 0); glow(bC, view === 0 ? 0.5 : 0); glow(bM, view === 0 ? 0.5 : 0); glow(bU, view === 1 ? 0.6 : 0);
      st(view === 0 ? [[0, 0.1, zr], [1.5, 1.4, -1.4], [1.5, 0.55, -1.4]] : [[0, 0.9, zr], [1.5, 0.1, -1.4]], (p * 12) % 1, 1);
      cap(view === 0 ? '下身专家：高度图 → CNN，和本体感觉拼起来进 MLP。网格 1.6 m × 1.0 m，<b>只有专家能看到</b>' : '上身专家只看本体感觉和手臂目标；地形信息不进上身');
    } };
  }

  /* ---------- scene 4: end-effector force curriculum ---------- */
  function s4(G) {
    let view = +(OPT[0] ?? 0);
    G.add(L.grid(6, 12));
    const rob = robot(COL.robot); G.add(rob);
    const arrs = [0, 1].map(() => { const a = L.arrow([0, 0, 0], [0, -0.5, 0], COL.force); G.add(a); return a; });
    const bags = [0, 1].map(() => { const b = block(0.12, 0.12, 0.12, 0xb07040, [0, 0, 0], { edgeOpacity: 0.3 }); G.add(b); return b; });
    const bar = block(0.1, 1, 0.1, COL.force, [1.1, 0.5, 0]); G.add(bar);
    const t1 = dynLab(G, [1.1, 1.45, 0], { size: 17 }), t2 = dynLab(G, [-1.2, 1.25, 0.3], { size: 17 });
    G.add(lab('课程系数', [1.1, -0.12, 0], { size: 14 }));
    const ctls = [{ label: '范围', items: ['专家 U(−60, 5) N', '蒸馏 U(−100, 5) N'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      const lo = view === 0 ? -60 : -100, ep = Math.min(5, Math.floor(p * 6)), r = L.rng(31 + ep * 7 + view * 101);
      const zero = r() < 0.25, F = zero ? 0 : lo + (5 - lo) * r(), sc = 0.1 + 0.9 * p, Fe = F * sc;
      const q = standQ(); q.sh = 0.9; q.el = 0.9; place(rob, q, [0, 0, 0]); rob.updateMatrixWorld(true);
      rob.userData.hands.forEach((h, i) => { const w = new THREE.Vector3(); h.getWorldPosition(w); const len = Math.abs(Fe) / 100 * 0.9 + 0.001, dirDown = Fe <= 0;
        arrs[i].position.copy(w); arrs[i].setDirection(new THREE.Vector3(0, dirDown ? -1 : 1, 0)); arrs[i].setLength(Math.max(0.02, len), Math.min(0.12, len * 0.4 + 0.02), 0.06); arrs[i].visible = Math.abs(Fe) > 0.3;
        bags[i].position.set(w.x, w.y - 0.12 - len * 0.2, w.z); bags[i].visible = Fe < -1; });
      bar.scale.y = sc * 1.2; bar.position.y = sc * 0.6;
      t1(`× ${sc.toFixed(2)}`); t2(zero ? '本回合不加力' : `抽到 Fz = ${F.toFixed(1)} N\n施加 ${Fe.toFixed(1)} N ≈ ${(Math.abs(Fe) / 9.81).toFixed(1)} kg`);
      cap(`第 ${ep + 1} 次重抽（固定种子）。课程系数 ${sc.toFixed(2)}：从 0.1 起，回合够长就涨。<b>真机 2 kg ≈ 19.6 N</b>`);
    } };
  }

  /* ---------- scene 5: dual-camera ray casting with a live depth image ---------- */
  function s5(G) {
    let view = +(OPT[0] ?? 1);
    /* drawn clipped to z in [-2.3, 2.0] and x in [-1.0, 1.0]; the ray caster uses the full boxes */
    TERR.forEach(b => { if (b[3] <= -0.59 || b[4] < -2.29) return; const x0 = Math.max(-1, b[0]), x1 = Math.min(1, b[1]), z0 = Math.max(-2.3, b[4]), z1 = Math.min(2.0, b[5]); if (x1 <= x0 || z1 <= z0) return;
      const c = b[4] < -0.4 ? COL.stone : b[5] > 3 && b[3] > 0 ? COL.up : 0x3a4560; G.add(block(x1 - x0, b[3] - b[2], z1 - z0, c, [(x0 + x1) / 2, (b[2] + b[3]) / 2, (z0 + z1) / 2], { edgeOpacity: 0.25, opacity: 0.95 })); });
    G.add(block(2.0, 0.02, 1.95, 0x1a2030, [0, -0.6, -1.32], { edges: false }));
    const rob = robot(COL.robot); G.add(rob); place(rob, standQ(), [0, 0, 0]);
    const legs = LEGS.map(b => { const m = block(b[1] - b[0], b[3] - b[2], b[5] - b[4], COL.cam, [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2, (b[4] + b[5]) / 2], { opacity: 0.35, edges: true }); G.add(m); return m; });
    const NR = 60, rays = [0, 1].map(k => { const pos = new Float32Array(NR * 6), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: k ? COL.stone : COL.up, transparent: true, opacity: 0.75 })); l.frustumCulled = false; G.add(l); return { pos, g }; });
    const hits = inst(BALL, NR * 2); hits.material.color.setHex(0xffffff); G.add(hits);
    const imF = imgPlane(G, 1.7, 0.96, [0, 1.85, 1.15], { rotY: Math.PI / 2 }), imB = imgPlane(G, 1.7, 0.96, [0, 1.85, -1.25], { rotY: Math.PI / 2 });
    G.add(lab('前相机 48×27（看楼梯）', [0, 2.5, 1.15], { size: 15, color: css(COL.up) }), lab('后相机 48×27（看梅花桩）', [0, 2.5, -1.25], { size: 15, color: css(COL.stone) }));
    const ctls = [{ label: '光线打', items: ['只有地形', '地形 + 机器人'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      const wr = view === 1; legs.forEach(m => { m.visible = wr; });
      const fr = DEPTH[wr ? 'f1' : 'f0'], bk = DEPTH[wr ? 'b1' : 'b0'], rowsDone = Math.floor(seg(p, 0.05, 0.75) * H27);
      const part = R => { const D = new Float32Array(R.D.length).fill(2.0), H = new Uint8Array(R.D.length); for (let i = 0; i < rowsDone * W48; i++) { D[i] = R.D[i]; H[i] = R.HIT[i]; } return depthCanvas(D, null, { robot: H }); };
      imF.userData.set(part(fr), 'f' + view + rowsDone); imB.userData.set(part(bk), 'b' + view + rowsDone);
      let hn = 0;
      [false, true].forEach((back, k) => {
        const c = camBasis(back), R = back ? bk : fr, vrow = Math.min(H27 - 1, rowsDone), P = rays[k].pos;
        for (let i = 0; i < NR; i++) {
          const u = Math.round(i / (NR - 1) * (W48 - 1)), v = (i % 2) ? vrow : Math.max(0, vrow - 6);
          const a = (2 * (u + 0.5) / W48 - 1) * TH, b = (1 - 2 * (v + 0.5) / H27) * TV, dd = [0, 1, 2].map(j => c.f[j] + a * c.r[j] + b * c.u[j]);
          const z = R.D[v * W48 + u], e = [c.o[0] + dd[0] * z, c.o[1] + dd[1] * z, c.o[2] + dd[2] * z];
          P.set([c.o[0], c.o[1], c.o[2], e[0], e[1], e[2]], i * 6); setI(hits, hn++, e, R.HIT[v * W48 + u] === 2 ? 0.025 : 0.015);
        }
        rays[k].g.attributes.position.needsUpdate = true;
      });
      done(hits);
      let nr = 0; for (let i = 0; i < W48 * H27; i++) if (fr.HIT[i] === 2) nr++;
      cap(p < 0.8 ? `逐行扫描：第 ${rowsDone} / 27 行。前相机看<b>楼梯</b>，后相机看<b>梅花桩</b>` : wr ? `前相机里 <b>${nr} / 1296</b> 个像素先打到自己的腿（绿色），这就是要建模动态机器人网格的原因` : '只打地形时，腿“透明”：仿真里看不到的自遮挡，真机上会出现');
    } };
  }

  /* ---------- scene 6: noise, dropout, RSM, delay ---------- */
  function s6(G) {
    let mode = +(OPT[0] ?? 2), terr = +(OPT[1] ?? 0);
    const big = imgPlane(G, 4.0, 2.25, [1.1, 1.7, 0]), clean = imgPlane(G, 1.9, 1.07, [-2.6, 1.55, 0]);
    G.add(lab('原始（第 5 幕的前相机）', [-2.6, 0.82, 0], { size: 14 }), lab('训练时学生看到的', [1.1, 3.1, 0], { size: 16 }));
    const fr = [0, 1, 2, 3].map(i => block(0.8, 0.45, 0.05, 0x3a4560, [-1.5 + i * 1.05, -0.35, 0], { edgeOpacity: 0.4 }));
    [0, 1, 2, 3].forEach(i => G.add(lab(i === 0 ? '最新' : `${i} 帧前`, [-1.5 + i * 1.05, -0.35, 0.05], { size: 13 })));
    fr.forEach(b => G.add(b)); const ptr = L.arrow([0.6, -1.15, 0], [0.6, -0.62, 0], COL.exp); G.add(ptr);
    G.add(lab('环形缓冲 4 帧，读第 2 帧（约 200 ms 前）', [-2.6, -1.0, 0], { size: 13 }));
    const pct = dynLab(G, [1.1, 0.38, 0], { size: 15, border: 'rgba(56,209,255,.7)' });
    const ctls = [{ label: '遮挡', items: ['none', 'small', 'large', '按概率抽'], get: () => mode, set: k => { mode = k; } }, { label: '地形', items: ['坡 / 楼梯', '梅花桩'], get: () => terr, set: k => { terr = k; } }];
    return { ctls, update(p) {
      const frame = Math.floor(p * 14 * 2), r = L.rng(500 + frame), PR = terr === 0 ? [0.1, 0.30, 0.60] : [0.1, 0.60, 0.30];
      let m = mode; if (mode === 3) { const x = r(); m = x < PR[0] ? 0 : x < PR[0] + PR[1] ? 1 : 2; }
      const A = augment(DEPTH.f1.D, m, 900 + frame);
      big.userData.set(depthCanvas(A.out, A.mask, { tint: true }), 'a' + m + '_' + frame); clean.userData.set(depthCanvas(DEPTH.f1.D, null, {}), 'clean');
      const keep = m === 2 ? 100 : m === 1 ? 160 : 240;
      pct(`${['none', 'small', 'large'][m]}：剩 ${keep}/240 列 = ${(keep / 2.4).toFixed(1)}%`);
      fr.forEach((b, i) => glow(b, i === 2 ? 0.7 : 0.05));
      cap(mode === 3 ? `每次渲染都重抽（代码）。${terr === 0 ? '坡和楼梯：none 0.1，small 0.30，<b>large 0.60</b>' : '梅花桩：none 0.1，<b>small 0.60</b>，large 0.30'}；这一帧抽到 <b>${['none', 'small', 'large'][m]}</b>` : '红色是被换成 [0.1, 2.0] m 随机深度的列；其余像素加 σ = 0.1 × 深度的噪声，5% 丢点');
    } };
  }

  /* ---------- scene 7: the student network ---------- */
  function s7(G) {
    const B = [];
    const add = (w, h, d, c, pos, t, ts = 14, dy = null) => { const b = block(w, h, d, c, pos); G.add(b); B.push(b); if (t) G.add(lab(t, [pos[0], dy == null ? pos[1] + h / 2 + 0.32 : pos[1] + dy, pos[2]], { size: ts })); return b; };
    const yF = 2.7, yB = 0.0;
    [[yF, '前', 1], [yB, '后', -1]].forEach(([y, nm, s]) => {
      const o = v => (s > 0 ? v : -v);
      add(0.2, 0.9, 1.6, COL.cam, [-7.2, y, 0], `${nm} 2×27×48`, 14, o(0.85));
      add(0.5, 0.6, 1.0, 0x5aa0d0, [-5.7, y, 0], '16@13×24', 13, -o(0.62)); add(0.6, 0.4, 0.6, 0x5aa0d0, [-4.2, y, 0], '32@6×12', 13, o(0.55)); add(0.6, 0.25, 0.35, 0x5aa0d0, [-2.7, y, 0], '32@3×6', 13, -o(0.5));
    });
    const dF = dynLab(G, [-1.3, yF + 0.45, 0], { size: 15, color: css(COL.exp) }), dB = dynLab(G, [-1.3, yB - 0.45, 0], { size: 15, color: css(COL.exp) });
    const tok = add(0.5, 2.2, 0.5, 0x7cb8ff, [-0.2, 1.35, 0], '32 token × 36', 14, -1.4);
    const st = add(0.5, 0.8, 0.5, 0x9aa6bf, [-0.2, -1.5, 0], '5 帧 × 115', 14, -0.75);
    const tf = [0, 1, 2, 3].map(i => add(0.45, 2.6, 1.0, 0xd45fa0, [1.2 + i * 0.7, 0.9, 0], null));
    G.add(lab('自注意力 ×4\n64 维 · 4 头', [2.25, 2.75, 0], { size: 14 }));
    const last = add(0.35, 0.35, 0.35, 0xf2c14e, [4.4, 0.9, 0], '最后一个 token', 13, -0.55);
    const mlp = [512, 256, 256, 128].map((n, i) => add(0.25, 0.4 + n / 300, 0.25, 0x4fc98a, [5.3 + i * 0.45, 0.9, 0], null));
    G.add(lab('MLP', [5.95, 2.95, 0], { size: 14 }));
    const out = add(0.3, 0.6, 0.3, COL.stu, [7.3, 0.9, 0], '下身 15', 14);
    const up = add(1.2, 0.45, 0.45, 0x9d8cff, [4.8, -1.5, 0], '上身 MLP → 14', 14, -0.6);
    const fl = [stream(G, 10, COL.cam, 0.06), stream(G, 10, COL.cam, 0.06), stream(G, 8, 0x9aa6bf, 0.06), stream(G, 6, 0x9d8cff, 0.06)];
    return { update(p) {
      const v = Math.sin(p * Math.PI * 2) * 0.8, [f, b] = dfsvCode(v);
      dF(`× δ前 ${f.toFixed(2)}`); dB(`× δ后 ${b.toFixed(2)}`);
      const q = (p * 14) % 1;
      fl[0]([[-7.2, yF, 0], [-2.7, yF, 0], [-1.35, yF, 0], [-0.2, 1.8, 0], [3.0, 0.9, 0], [4.4, 0.9, 0], [7.3, 0.9, 0]], q, Math.max(0.15, f));
      fl[1]([[-7.2, yB, 0], [-2.7, yB, 0], [-1.35, yB, 0], [-0.2, 0.9, 0], [3.0, 0.9, 0], [4.4, 0.9, 0], [7.3, 0.9, 0]], (q + 0.5) % 1, Math.max(0.15, b));
      fl[2]([[-0.2, -1.5, 0], [1.2, -0.2, 0], [4.4, 0.9, 0]], q, 1); fl[3]([[-0.2, -1.5, 0], [4.8, -1.5, 0]], q, 1);
      glow(tok, 0.2); tf.forEach((m, i) => glow(m, Math.abs(((p * 4) % 1) * 4 - i - 0.5) < 0.5 ? 0.6 : 0.05));
      cap(`命令 v_x = ${v.toFixed(2)} m/s：前相机特征 × ${f.toFixed(2)}，后相机 × ${b.toFixed(2)}（代码的 DFSV）。37 个 token 做 4 层自注意力，取当前帧状态 token 出动作`);
    } };
  }

  /* ---------- scene 8: DFSV curves, paper vs code ---------- */
  function s8(G) {
    let view = +(OPT[0] ?? 1);
    const X0 = -3.4, XW = 6.0, Y0 = 0, YH = 3.0, sx = v => X0 + (v + 1) / 2 * XW, sy = d => Y0 + d * YH;
    panel(G, X0 - 0.5, -0.6, -0.05, XW + 1.0, YH + 1.2);
    [0, 0.5, 1].forEach(d => { wire(G, [[X0, sy(d), 0], [X0 + XW, sy(d), 0]], 0x5a6680, { opacity: 0.5 }); G.add(lab(d.toFixed(1), [X0 - 0.3, sy(d), 0], { size: 14 })); });
    [-1, -0.5, 0, 0.5, 1].forEach(v => G.add(lab(String(v), [sx(v), -0.3, 0], { size: 14 })));
    G.add(lab('v_x（m/s）', [X0 + XW / 2, -0.75, 0], { size: 15 }), lab('δ', [X0 - 0.3, YH + 0.35, 0], { size: 16 }));
    wire(G, [[X0, sy(0.1), 0.01], [X0 + XW, sy(0.1), 0.01]], COL.bad, { opacity: 0.6, dashed: true });
    const N = 121, pts = (fn, k) => Array.from({ length: N }, (_, i) => { const v = -1 + 2 * i / (N - 1); return [sx(v), sy(fn(v)[k]), 0.02]; });
    const curves = [[dfsvPaper, 0, COL.paper], [dfsvPaper, 1, 0xffb08a], [dfsvCode, 0, COL.code], [dfsvCode, 1, 0x8fe3ff]].map(([fn, k, c]) => { const r = ribbon(G, N, c, 0.05); r.userData.set(pts(fn, k)); return r; });
    G.add(lab('论文 前', [sx(0.75), sy(dfsvPaper(0.75)[0]) - 0.35, 0], { size: 14, color: css(COL.paper) }), lab('论文 后', [sx(-0.75), sy(dfsvPaper(-0.75)[1]) - 0.35, 0], { size: 14, color: '#ffb08a' }),
      lab('代码 前', [sx(-0.55), sy(dfsvCode(-0.55)[0]) + 0.3, 0], { size: 14, color: css(COL.code) }), lab('代码 后', [sx(0.55), sy(dfsvCode(0.55)[1]) + 0.3, 0], { size: 14, color: '#8fe3ff' }), lab('置零线 0.1', [sx(0.85), sy(0.1) + 0.25, 0], { size: 13, color: '#e05d5d' }));
    const cur = wire(G, [[0, sy(0), 0.03], [0, sy(1), 0.03]], 0xffffff, { opacity: 0.8 });
    const mk = [0, 1, 2, 3].map(i => { const m = new THREE.Mesh(BALL, L.mat([COL.paper, 0xffb08a, COL.code, 0x8fe3ff][i], { emissive: 0x222222 })); m.scale.setScalar(0.09); G.add(m); return m; });
    const bars = [0, 1].map(i => { const b = block(0.5, 1, 0.5, i ? COL.stone : COL.up, [3.7 + i * 1.0, 0.5, 0]); G.add(b, lab(i ? '后相机' : '前相机', [3.7 + i * 1.0, -0.3, 0], { size: 13 })); return b; });
    const val = dynLab(G, [4.2, 3.4, 0], { size: 15, border: 'rgba(56,209,255,.7)' });
    const ctls = [{ label: '柱子按', items: ['论文公式', '代码'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      const v = -1 + 2 * (0.5 - 0.5 * Math.cos(p * Math.PI * 2)), P = dfsvPaper(v), C = dfsvCode(v);
      cur.position.x = sx(v); [P[0], P[1], C[0], C[1]].forEach((d, i) => mk[i].position.set(sx(v), sy(d), 0.06));
      const use = view === 0 ? P : C; bars.forEach((b, i) => { const h = Math.max(0.02, use[i] * 2.6); b.scale.y = h; b.position.y = h / 2; });
      val(`v_x = ${v.toFixed(2)}\n论文 ${P[0].toFixed(2)} / ${P[1].toFixed(2)}\n代码 ${C[0].toFixed(2)} / ${C[1].toFixed(2)}`);
      cap(Math.abs(v) < 0.08 ? '静止时：论文两路都 <b>0.31</b>，代码两路都 <b>0.69</b>。差在阈值的符号' : `v_x = ${v.toFixed(2)}：代码的前相机曲线比论文整体左移 0.4 m/s（后相机右移）；背向相机低于 0.1 被置零`);
    } };
  }

  /* ---------- scene 9: DAgger loop and Figure 13 ---------- */
  function s9(G) {
    let terr = +(OPT[0] ?? 3);
    const env = block(1.6, 0.9, 1.0, 0x3a4560, [-4.2, 2.6, 0]), stu = block(1.5, 0.8, 0.9, COL.stu, [-1.2, 2.6, 0]), tea = block(1.5, 0.8, 0.9, COL.exp, [-1.2, 0.6, 0]), los = block(1.0, 0.6, 0.6, 0xd95926, [1.2, 1.6, 0]);
    G.add(env, stu, tea, los, lab('环境（8192 个）', [-4.2, 3.4, 0], { size: 15 }), lab('学生 π_vis', [-1.2, 3.35, 0], { size: 15, color: css(COL.stu) }), lab('老师：按地形编号选专家', [-1.2, -0.1, 0], { size: 15, color: css(COL.exp) }), lab('MSE 式 (1)', [1.2, 2.2, 0], { size: 15 }));
    const fA = stream(G, 6, COL.stu, 0.06), fB = stream(G, 6, 0x9aa6bf, 0.06), fC = stream(G, 6, COL.exp, 0.06), fD = stream(G, 4, 0xd95926, 0.06);
    const X0 = 2.6, XW = 4.4, Y0 = -0.6, YH = 3.4, sx = i => X0 + XW * i / 200, sy = v => Y0 + YH * v / 6.6;
    panel(G, X0 - 0.4, Y0 - 0.5, -0.05, XW + 0.7, YH + 1.1);
    [0, 2, 4, 6].forEach(v => { wire(G, [[X0, sy(v), 0], [X0 + XW, sy(v), 0]], 0x5a6680, { opacity: 0.45 }); G.add(lab(String(v), [X0 - 0.22, sy(v), 0], { size: 13 })); });
    [0, 10000, 20000].forEach(x => G.add(lab(x ? x / 1000 + 'k' : '0', [sx(x / 100), Y0 - 0.25, 0], { size: 13 })));
    const ttl = dynLab(G, [X0 + XW / 2, Y0 + YH + 0.35, 0], { size: 16 });
    const rA = ribbon(G, 201, COL.dagger, 0.04), rB = ribbon(G, 201, COL.hyb, 0.04);
    G.add(lab('只用 DAgger', [X0 + 2.9, sy(1.0), 0], { size: 13, color: css(COL.dagger) }), lab('混合', [X0 + 3.95, sy(1.0), 0], { size: 13, color: css(COL.hyb) }));
    const NM = ['坡', '上楼梯', '下楼梯', '梅花桩'];
    const ctls = [{ label: '图 13', items: NM, get: () => terr, set: k => { terr = k; } }];
    return { ctls, update(p) {
      const q = (p * 12) % 1;
      fA([[-1.2, 2.6, 0], [-4.2, 2.6, 0]], q, 1); fB([[-4.2, 2.6, 0], [-4.2, 0.6, 0], [-1.2, 0.6, 0]], q, 1); fC([[-1.2, 0.6, 0], [1.2, 1.6, 0]], q, 1); fD([[1.2, 1.6, 0], [-1.2, 2.6, 0]], q, 1);
      const n = Math.max(2, Math.round(seg(p, 0.0, 0.85) * 200) + 1), mk = arr => { const out = []; let last = 0; for (let i = 0; i < n; i++) { const v = arr[i] ?? last; last = v; out.push([sx(i), sy(v), 0.02]); } return out; };
      const D = F13[terr]; rA.userData.set(mk(D[1])); rB.userData.set(mk(D[2]));
      const i = n - 1, a = D[1][i] ?? D[1][i - 1], b = D[2][i] ?? D[2][i - 1];
      ttl(`${NM[terr]} · 第 ${i * 100} 次迭代：${a.toFixed(2)} / ${b.toFixed(2)}`);
      cap(terr === 3 ? '梅花桩：混合目标<b>全程落后</b>，最后 5000 次平均 4.38 对 5.73' : terr === 2 ? '下楼梯：两者早期接近，混合<b>后期退化</b>到约 3.3' : '坡 / 上楼梯：混合在<b>早期更快</b>，后期才掉下来（图 13 矢量读数）');
    } };
  }

  /* ---------- scene 10: sim2sim and real-world deployment ---------- */
  function s10(G) {
    let view = +(OPT[0] ?? 0);
    const A = new THREE.Group(), B = new THREE.Group(), C = new THREE.Group(); G.add(A, B, C);
    const sim = block(2.2, 1.2, 1.2, 0x3a4560, [-3.2, 1.2, 0]), pol = block(2.2, 1.2, 1.2, COL.stu, [3.2, 1.2, 0]), shm = block(1.2, 0.4, 0.8, COL.cam, [0, 0.4, 0]), dds = block(1.2, 0.4, 0.8, 0x9d8cff, [0, 2.2, 0]);
    A.add(sim, pol, shm, dds, lab('仿真进程 rplmujoco\nMuJoCo 场景 + 深度渲染 + 手柄', [-3.2, 2.2, 0], { size: 15 }), lab('策略进程 rplinference\nholosoma_inference，ONNX，50 Hz', [3.2, 2.2, 0], { size: 15 }), lab('深度：共享内存', [0, 0.95, 0], { size: 14 }), lab('状态 / 指令：DDS（sdk2py）', [0, 3.1, 0], { size: 14 }));
    const fa = stream(A, 6, COL.cam, 0.07), fb = stream(A, 6, 0x9d8cff, 0.07), fc = stream(A, 6, COL.stu, 0.07);
    const BS = new THREE.Group(); BS.scale.setScalar(2.3); BS.position.set(-0.6, -0.2, 0); BS.rotation.y = Math.PI / 2; B.add(BS);
    const rob = robot(COL.robot); BS.add(rob);
    BS.add(block(1.4, 0.02, 3.2, 0x2a3346, [0, -0.01, 0.2], { edges: false }));
    for (let k = 0; k < 4; k++) BS.add(block(1.2, 0.2 * (k + 1), 1.4 - 0.25 * k, COL.up, [0, 0.1 * (k + 1), 1.1 + 0.125 * k], { edgeOpacity: 0.3 }));
    B.add(lab('Jetson Orin NX 16GB · 50 Hz', [-3.0, 3.3, 0], { size: 15 }), lab('前后 ZED 2i · 15 Hz → 48×27', [3.0, 2.9, 0], { size: 15 }), lab('Apple Vision Pro 遥操作上身', [-3.0, 1.2, 0], { size: 14 }), lab('楼梯（示意）', [3.2, -0.15, 1.2], { size: 14 }));
    const T5 = [['不带负载', 3, 5], ['带 2 kg', 3, 5], ['合计', 6, 10]], T4 = [['RPL', 20, 20], ['去 DFSV', 2, 20], ['去 RSM', 2, 20], ['两个都去', 0, 20], ['去力扰动', 6, 20], ['CNN+MLP', 13, 20], ['CNN+RNN', 10, 20], ['U-Net+T', 1, 20]];
    const mkBars = (rows, x0, dx) => rows.map(([t, a, n], i) => { const b = block(0.42, 1, 0.42, i === 0 ? COL.ok : 0x7cb8ff, [x0 + i * dx, 0.5, 0]); C.add(b, lab(t, [x0 + i * dx, i % 2 ? -0.75 : -0.3, 0], { size: 12 }), lab(`${a}/${n}`, [x0 + i * dx, 3.25, 0], { size: 13 })); return { b, v: a / n }; });
    const b5 = mkBars(T5, -6.0, 0.95), b4 = mkBars(T4, -2.2, 0.95);
    C.add(lab('表 5 真机整场', [-5.05, 3.9, 0], { size: 15 }), lab('表 4 仿真整场（前进 + 后退）', [1.1, 3.9, 0], { size: 15 }));
    const ctls = [{ label: '看', items: ['sim2sim', '真机', '表 4 / 表 5'], get: () => view, set: k => { view = k; } }];
    return { ctls, update(p) {
      A.visible = view === 0; B.visible = view === 1; C.visible = view === 2; const q = (p * 12) % 1;
      fa([[-3.2, 0.4, 0], [3.2, 0.4, 0]], q, 1); fb([[-3.2, 2.2, 0], [3.2, 2.2, 0]], q, 1); fc([[3.2, 1.6, 0.4], [-3.2, 1.6, 0.4]], q, 1);
      const t = p * 14, z = -0.5 + 0.45 * Math.sin(p * Math.PI * 2); place(rob, walk(t, 0.8), [0, 0, z], 0, 1);
      const g = seg(p, 0, 0.5); [...b5, ...b4].forEach(({ b, v }) => { const h = Math.max(0.02, v * 3 * g); b.scale.y = h; b.position.y = h / 2; });
      cap(['先开 run_sim.sh，再开 run_policy.sh；MuJoCo 窗口按 9 放绳，start 启动，R2 切行走', '真机来回走整场：20° 坡、两种踏面楼梯、25 cm 梅花桩。<b>10 次成功 6 次</b>', '仿真 RPL 20/20；真机 6/10，95% 区间 [0.31, 0.83]'][view]);
    } };
  }

  const BUILD = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10];

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
  window.__rplDebug = { DEPTH, dfsvPaper, dfsvCode, get cap() { return $('cap').textContent; } };
})();
