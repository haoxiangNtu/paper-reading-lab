/* lab3d.js — shared Three.js (r128) helpers, copied from world-model-lab/docs/lab3d.js.
   Every station: Lab3D.makeScene(host) gives a renderer + orbit camera (drag to rotate,
   wheel to zoom), a render loop that pauses when the stage is off-screen, and picking helpers. */
window.Lab3D = (function () {
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const tokens = () => ({ bg: css('--bg2'), panel: css('--panel'), line: css('--line'), fg: css('--fg'), muted: css('--muted'),
    compute: css('--compute'), memory: css('--memory'), kv: css('--kv'), token: css('--token'), weights: css('--weights'), warn: css('--warn') });
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
  /* object palette chosen to read on both the dark and the light surface */
  const C = { video: 0x3aa8e0, action: 0xf0963c, frozen: 0x6b7794, lora: 0x4fc98a, attn: 0xd45fa0, text: 0x9d8cff, image: 0x4fc98a,
    noise: 0x8e9bb8, data: 0x38d1ff, warn: 0xff7a59, table: 0x2b3650, tableLight: 0xb8c4da, grid: 0x4a5878, ghost: 0x8e9bb8,
    red: 0xe05d5d, white: 0xe6ecf7, mug: 0x7fb8ff, wood: 0x8a6a4a, metal: 0x9aa6bf, gold: 0xf2c14e };

  function makeScene(host, o = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(o.fov || 38, 2, 0.1, 2000);
    const target = new THREE.Vector3().fromArray(o.target || [0, 0, 0]);
    let theta = o.theta ?? 0.7, phi = o.phi ?? 1.1, dist = o.dist ?? 30;
    const lim = { min: o.minDist || 4, max: o.maxDist || 200 };
    function place() {
      cam.position.set(target.x + dist * Math.sin(phi) * Math.sin(theta), target.y + dist * Math.cos(phi), target.z + dist * Math.sin(phi) * Math.cos(theta));
      cam.lookAt(target);
    }
    let drag = null, moved = false;
    host.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; moved = false; host.setPointerCapture(e.pointerId); });
    host.addEventListener('pointermove', e => {
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      theta -= dx * 0.008; phi = Math.max(0.12, Math.min(1.52, phi - dy * 0.008)); drag = { x: e.clientX, y: e.clientY }; place();
    });
    const up = () => { drag = null; };
    host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
    host.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(lim.min, Math.min(lim.max, dist * (1 + Math.sign(e.deltaY) * 0.08))); place(); }, { passive: false });
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 0.95));
    const dl = new THREE.DirectionalLight(0xffffff, 0.55); dl.position.set(6, 12, 8); scene.add(dl);
    function resize() { const w = host.clientWidth || 1, h = host.clientHeight || 1; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    new ResizeObserver(resize).observe(host); resize(); place();
    let visible = true;
    new IntersectionObserver(es => { visible = es.some(x => x.isIntersecting); }, { rootMargin: '120px' }).observe(host);
    const tickers = []; let t = 0;
    function loop() { requestAnimationFrame(loop); if (!visible) return; t++; for (const f of tickers) f(t); renderer.render(scene, cam); }
    loop();
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function pick(e, objs) {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, cam); const hits = ray.intersectObjects(objs, true); return hits.length ? hits[0] : null;
    }
    function onClick(objs, fn) { host.addEventListener('click', e => { if (moved) return; fn(pick(e, typeof objs === 'function' ? objs() : objs), e); }); }
    function onHover(objs, fn) { host.addEventListener('pointermove', e => { if (drag) return; fn(pick(e, typeof objs === 'function' ? objs() : objs), e); }); }
    return { renderer, scene, cam, dl, place, pick, onClick, onHover, onTick: f => tickers.push(f),
      setView(th, ph, d, tg) { if (th != null) theta = th; if (ph != null) phi = ph; if (d != null) dist = d; if (tg) target.fromArray(tg); place(); },
      get theta() { return theta; }, get phi() { return phi; }, get dist() { return dist; }, get target() { return target; } };
  }
  function mat(color, o = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: o.roughness ?? 0.62, metalness: o.metalness ?? 0.05,
      transparent: o.opacity != null && o.opacity < 1, opacity: o.opacity ?? 1, emissive: o.emissive ?? 0x000000, side: o.side ?? THREE.FrontSide, depthWrite: o.depthWrite ?? true });
  }
  function withEdges(m, o = {}) {
    if (o.edges === false) return m;
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: o.edgeColor ?? 0x0b1020, transparent: true, opacity: o.edgeOpacity ?? 0.35 })));
    return m;
  }
  function box(w, h, d, color, o = {}) { return withEdges(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, o)), o); }
  function cyl(rt, rb, h, color, o = {}) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg || 28), mat(color, o)); }
  function sphere(r, color, o = {}) { return new THREE.Mesh(new THREE.SphereGeometry(r, o.seg || 18, o.seg || 14), mat(color, o)); }
  function torus(r, tube, color, o = {}) { return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 32), mat(color, o)); }
  const V = p => (p instanceof THREE.Vector3 ? p : new THREE.Vector3(...p));
  function line(pts, color, o = {}) {
    const g = new THREE.BufferGeometry().setFromPoints(pts.map(V));
    const m = o.dashed ? new THREE.LineDashedMaterial({ color, dashSize: o.dash || 0.4, gapSize: o.gap || 0.25, transparent: true, opacity: o.opacity ?? 1 })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity: o.opacity ?? 1 });
    const l = new THREE.Line(g, m); if (o.dashed) l.computeLineDistances(); return l;
  }
  function tube(pts, color, r = 0.08, o = {}) {
    const curve = new THREE.CatmullRomCurve3(pts.map(V));
    return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, pts.length * 4), r, 6, false), mat(color, o));
  }
  function arrow(from, to, color, o = {}) {
    const f = V(from), t = V(to); const dir = t.clone().sub(f); const len = dir.length();
    return new THREE.ArrowHelper(dir.normalize(), f, len, color, o.head ?? Math.min(0.6, len * 0.3), o.headW ?? Math.min(0.35, len * 0.15));
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  /* text label as a camera-facing sprite; dark pill with light text reads on both themes */
  function label(text, o = {}) {
    const dpr = Math.min(2, window.devicePixelRatio || 1); const size = o.size || 26;
    const font = `${o.weight || 600} ${size}px "Noto Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif`;
    const c = document.createElement('canvas'); const g = c.getContext('2d'); g.font = font;
    const lines = String(text).split('\n');
    const w = Math.ceil(Math.max(...lines.map(l => g.measureText(l).width)) + size * 0.9), h = Math.ceil(lines.length * size * 1.3 + size * 0.5);
    c.width = w * dpr; c.height = h * dpr; g.scale(dpr, dpr);
    if (o.bg !== false) { g.fillStyle = o.bg || 'rgba(12,18,32,0.74)'; roundRect(g, 0, 0, w, h, 8); g.fill(); }
    if (o.border) { g.strokeStyle = o.border; g.lineWidth = 2; roundRect(g, 1, 1, w - 2, h - 2, 7); g.stroke(); }
    g.font = font; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillStyle = o.color || '#e6ecf7';
    lines.forEach((l, i) => g.fillText(l, w / 2, (i + 0.5) * size * 1.3 + size * 0.25));
    const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: o.depthTest ?? false }));
    const s = o.scale || 0.045; sp.scale.set(w * s, h * s, 1); if (o.pos) sp.position.set(...o.pos); sp.renderOrder = 10; return sp;
  }
  function grid(size, div, color) { const g = new THREE.GridHelper(size, div, color || C.grid, color || C.grid); g.material.transparent = true; g.material.opacity = 0.3; return g; }
  function dispose(obj) { obj.traverse?.(o => { o.geometry?.dispose?.(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.map?.dispose?.(); m.dispose?.(); }); }); }
  function clear(group) { while (group.children.length) { const c = group.children.pop(); dispose(c); } }
  const ease = x => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;
  /* small seeded RNG so every reload draws the same scene */
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function gauss(r) { const u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  /* a simple two-link arm with a gripper, base at origin, pointing +x */
  function arm(color, o = {}) {
    const g = new THREE.Group();
    const base = cyl(0.55, 0.65, 0.5, 0x3b4660); base.position.y = 0.25; g.add(base);
    const shoulder = sphere(0.36, color); shoulder.position.y = 0.7; g.add(shoulder);
    const l1 = new THREE.Group(); l1.position.y = 0.7; g.add(l1);
    const seg1 = box(0.42, 2.2, 0.42, color, { edgeOpacity: 0.2 }); seg1.position.y = 1.1; l1.add(seg1);
    const elbow = sphere(0.3, color); elbow.position.y = 2.2; l1.add(elbow);
    const l2 = new THREE.Group(); l2.position.y = 2.2; l1.add(l2);
    const seg2 = box(0.34, 2.0, 0.34, color, { edgeOpacity: 0.2 }); seg2.position.y = 1.0; l2.add(seg2);
    const wrist = new THREE.Group(); wrist.position.y = 2.0; l2.add(wrist);
    const palm = box(0.6, 0.3, 0.5, 0x3b4660); palm.position.y = 0.15; wrist.add(palm);
    const f1 = box(0.1, 0.5, 0.4, C.metal), f2 = box(0.1, 0.5, 0.4, C.metal); f1.position.set(-0.22, 0.5, 0); f2.position.set(0.22, 0.5, 0); wrist.add(f1, f2);
    g.userData = { l1, l2, wrist, f1, f2 };
    /* pose the arm with simple planar IK so the gripper reaches world point p (in the arm's parent frame) */
    /* p is given in the arm group's parent frame (the group itself must not be scaled). The wrist joint
       is placed 0.75 above p so the fingers hang straight down onto it. */
    g.userData.reach = function (p) {
      const q = V(p); const sc = g.scale.x || 1; const dx = (q.x - g.position.x) / sc, dz = (q.z - g.position.z) / sc; const dyw = (q.y - g.position.y) / sc + 0.75 - 0.7;
      g.rotation.y = Math.atan2(-dz, dx); const r = Math.hypot(dx, dz);
      const L1 = 2.2, L2 = 2.0; const d = Math.max(0.3, Math.min(L1 + L2 - 0.02, Math.hypot(r, dyw)));
      const a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
      const b = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2))));
      const el = Math.atan2(dyw, r);
      l1.rotation.z = el + a - Math.PI / 2; l2.rotation.z = b - Math.PI; wrist.rotation.z = Math.PI - (l1.rotation.z + l2.rotation.z);
    };
    return g;
  }
  return { tokens, reduced, isDark, C, makeScene, mat, box, cyl, sphere, torus, line, tube, arrow, label, grid, clear, dispose, ease, lerp, rng, gauss, arm, V };
})();
