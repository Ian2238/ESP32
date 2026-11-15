/* 接線實驗室：資料驅動的 3D 接線演示（自製，three.js r136）
 * 每個專案一個 projects/*.js，用 WD.addProject({...}) 註冊。格式見 README_zh-TW.md。
 */
(function () {
'use strict';
const WD = window.WD = window.WD || {};
WD.projects = WD.projects || [];
WD.addProject = WD.addProject || (p => WD.projects.push(p));

const P = 0.254;                                    // 麵包板孔距 2.54 mm（1 單位 = 10 mm）
const ROWK = { r1: 0, r2: 1, A: 3, B: 4, C: 5, D: 6, E: 7, F: 10, G: 11, H: 12, I: 13, J: 14, r3: 16, r4: 17 };
const RAIL = { r1: '+', r2: '−', r3: '−', r4: '+' };
const BBOFF = { L: 0, R: 19 }, MID = 19, BB_K0 = -1, BB_K1 = 18, NCOL = 63;
const FUNC = { pwr: { name: '電源', color: '#e53935' }, gnd: { name: 'GND', color: '#222222' }, sig: { name: '訊號', color: '#1e88e5' } };
const $ = s => document.querySelector(s);
const el = (t, cls, html) => { const e = document.createElement(t); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- 座標與孔位 ----------
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function holePos(h) { return V((h.col - 32) * P, 0, (BBOFF[h.bb] + ROWK[h.row] - MID) * P); }
function stripKey(h) { if (h.row[0] === 'r') return h.bb + h.row; return h.bb + ('ABCDE'.includes(h.row) ? 't' : 'b') + h.col; }
function stripDesc(h) {
  if (h.row[0] === 'r') return `${bbName(h.bb)}${RAIL[h.row]}電源軌（整條相通）`;
  const r = 'ABCDE'.includes(h.row) ? 'A–E' : 'F–J';
  return `${bbName(h.bb)}第 ${h.col} 欄 ${r} 五孔相通`;
}
const bbName = b => (b === 'L' ? '左' : '右');
function holeName(h) { return h.row[0] === 'r' ? `${bbName(h.bb)}${RAIL[h.row]}軌${h.col}` : `${bbName(h.bb)}${h.row}${h.col}`; }
function parseHole(s) {           // 'L:J17' / 'R:G59' / 'L:r1:5'
  if (typeof s !== 'string') return s;
  const m = s.match(/^([LR]):(r[1-4]|[A-J])(\d+)$/); if (!m) throw new Error('孔位格式錯誤：' + s);
  return { bb: m[1], row: m[2], col: +m[3] };
}

const NOBOARD = { name: '（還沒選開發板）', short: '', top: [], bottom: [], none: true, sources: '', pinNotes: {} };
// ---------- 專案編譯（算出每一欄接了什麼，並核對腳位） ----------
function compile(proj) {
  const noBoard = !proj.board || !proj.board.type;
  const B = noBoard ? NOBOARD : WD.BOARDS[proj.board.type]; if (!B) throw new Error('沒有這塊板子：' + proj.board.type);
  const top = parseHole(noBoard ? 'L:J2' : proj.board.top), bot = parseHole(noBoard ? 'R:C2' : proj.board.bottom);
  const strips = {};                // key → [{kind,label,...}]
  const add = (h, item) => { const k = stripKey(h); (strips[k] = strips[k] || []).push(item); };
  const pins = [];
  B.top.forEach((t, i) => { const h = { bb: top.bb, row: top.row, col: top.col + i }; const p = { row: 'top', idx: i, label: t, hole: h }; pins.push(p); add(h, { kind: 'board', pin: p }); });
  B.bottom.forEach((t, i) => { const h = { bb: bot.bb, row: bot.row, col: bot.col + i }; const p = { row: 'bottom', idx: i, label: t, hole: h }; pins.push(p); add(h, { kind: 'board', pin: p }); });
  const mods = (proj.modules || []).map(m => {
    const at = parseHole(m.at);
    const mp = m.pins.map((n, i) => ({ name: n, hole: { bb: at.bb, row: at.row, col: at.col + i } }));
    const mm = Object.assign({}, m, { at, mpins: mp });
    mp.forEach(p => add(p.hole, { kind: 'module', mod: mm, mpin: p }));
    return mm;
  });
  const warn = [];
  const wires = (proj.wires || []).map(w0 => {
    const w = Object.assign({ func: 'sig', status: proj.status === 'planned' ? 'planned' : 'ok' }, w0);
    w.from = parseHole(w.from); w.to = parseHole(w.to);
    w.color = w.color || FUNC[w.func].color;
    const find = (h, kind) => (strips[stripKey(h)] || []).filter(x => x.kind === kind);
    const bp = find(w.from, 'board').concat(find(w.to, 'board'));
    w.boardPin = bp[0] ? bp[0].pin : null;
    const mp = find(w.to, 'module').concat(find(w.from, 'module'));
    w.modHit = mp[0] || null;
    if (w.pin != null) {
      const got = w.boardPin ? w.boardPin.label : null;
      w.pinOk = got === String(w.pin);
      if (!w.pinOk) warn.push(`${w.label}：設定寫 ${w.pin}，但 ${holeName(w.from)} 這一欄實際是 ${got || '空的'}`);
    }
    if (w.modPin != null && w.kind !== 'resistor') {
      const got = w.modHit ? w.modHit.mpin.name : null;
      w.modOk = got === w.modPin;
      if (!w.modOk) warn.push(`${w.label}：設定寫模組 ${w.modPin}，但 ${holeName(w.to)} 這一欄實際是 ${got || '空的'}`);
    }
    return w;
  });
  let steps = proj.steps;
  if (!steps) steps = wires.filter(w => w.kind !== 'resistor').map(w => ({ title: w.label, wires: [w.id] }));
  return { proj, B, top, bot, pins, mods, wires, steps, strips, warn };
}
WD.compile = compile; WD.holeName = holeName;

function gpioText(label) { return /^\d+$/.test(label) ? 'GPIO' + label : label; }
function stripContents(C, h) {
  const items = C.strips[stripKey(h)] || [];
  return items.map(x => x.kind === 'board' ? `ESP32 ${gpioText(x.pin.label)}` : `${x.mod.short || x.mod.name} ${x.mpin.name}`);
}

// ---------- 貼圖工具 ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; t._canvas = c; t._ctx = g;
  return t;
}
const FONT = '"PingFang TC","Noto Sans TC","Noto Sans CJK TC","Microsoft JhengHei",sans-serif';
const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0.05 }, o));
function box(w, h, d, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = true; m.receiveShadow = true; return m; }
function cyl(r, h, mat, seg = 20) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.castShadow = true; return m; }

// ---------- 場景 ----------
let renderer, scene, camera, controls, root, raycaster, pointer = new THREE.Vector2();
let C = null, objs = null, state = { step: -1, all: true, labels: true, sim: null };
const clock = new THREE.Clock();
const camAnim = { t: 1, from: null, to: null, tf: null, tt: null };
const hoverables = [];

function initThree() {
  const host = $('#view');
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.12; controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 3; controls.maxDistance = 60;
  controls.addEventListener('start', () => { camAnim.t = 1; });
  scene.add(new THREE.HemisphereLight(0xfff8ee, 0xb8a990, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85); sun.position.set(-6, 14, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 10, bottom: -10, near: 1, far: 40 }); sun.shadow.bias = -0.0004;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffeedd, 0.25); fill.position.set(8, 6, -6); scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.14 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.86; floor.receiveShadow = true; scene.add(floor);
  raycaster = new THREE.Raycaster();
  new ResizeObserver(resize).observe(host); resize();
  const dom = renderer.domElement;
  dom.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') pick(e, false); });
  dom.addEventListener('pointerleave', () => hideTip());
  let down = null;
  dom.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  dom.addEventListener('pointerup', e => { if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 6) pick(e, true); down = null; });
  animate();
}
function resize() {
  const host = $('#view'); const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

// ---------- 麵包板 ----------
function buildBreadboard(bb) {
  const g = new THREE.Group();
  const x0 = (0.2 - 32) * P, x1 = (NCOL + 0.8 - 32) * P;
  const z0 = (BBOFF[bb] + BB_K0 - MID) * P, z1 = (BBOFF[bb] + BB_K1 - MID) * P;
  const W = x1 - x0, D = z1 - z0, H = 0.85;
  const body = box(W, H, D, std('#efeae0', { roughness: 0.85 })); body.position.set((x0 + x1) / 2, -H / 2 - 0.002, (z0 + z1) / 2); g.add(body);
  const ppu = 34 / P;     // 每單位像素
  const tex = canvasTex(Math.round(W * ppu), Math.round(D * ppu), (c, w, h) => {
    c.fillStyle = '#f5f1e8'; c.fillRect(0, 0, w, h);
    const X = col => ((col - 32) * P - x0) * ppu, Z = k => ((BBOFF[bb] + k - MID) * P - z0) * ppu;
    c.fillStyle = '#e6dfd0'; c.fillRect(0, Z(8.5) - 0.5 * P * ppu, w, P * ppu);   // 中間溝
    c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(0, Z(8.5) - 2, w, 4);
    const hs = 0.42 * P * ppu;
    for (const r of Object.keys(ROWK)) {
      const k = ROWK[r];
      for (let col = 1; col <= NCOL; col++) {
        if (r[0] === 'r' && (col < 3 || col > 61 || (col - 3) % 6 === 5)) continue;
        c.fillStyle = '#3b3a37'; c.fillRect(X(col) - hs / 2, Z(k) - hs / 2, hs, hs);
        c.fillStyle = '#6d6a63'; c.fillRect(X(col) - hs / 2, Z(k) - hs / 2, hs, hs * 0.25);
      }
    }
    for (const [r, k] of [['r1', -0.55], ['r2', 1.55], ['r3', 15.45], ['r4', 17.55]]) {
      c.fillStyle = RAIL[r] === '+' ? '#d63b3b' : '#2a56c6'; c.fillRect(X(2), Z(k) - 2, X(62) - X(2), 4);
      c.font = `bold ${0.7 * P * ppu}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(RAIL[r], X(1.1), Z(ROWK[r])); c.fillText(RAIL[r], X(62.9), Z(ROWK[r]));
    }
    c.fillStyle = '#8a8478'; c.font = `bold ${0.55 * P * ppu}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const r of 'ABCDEFGHIJ') { c.fillText(r, X(0.55), Z(ROWK[r])); c.fillText(r, X(63.6), Z(ROWK[r])); }
    c.font = `${0.48 * P * ppu}px ${FONT}`;
    for (let col = 1; col <= NCOL; col++) if (col === 1 || col % 5 === 0) { c.fillText(col, X(col), Z(2)); c.fillText(col, X(col), Z(15)); }
    c.font = `bold ${0.9 * P * ppu}px ${FONT}`; c.fillStyle = 'rgba(120,110,95,.35)'; c.textAlign = 'left';
    c.fillText(bb === 'L' ? '左麵包板' : '右麵包板', X(1.5), Z(bb === 'L' ? -0.2 : 17.4) + (bb === 'L' ? -0.35 : 0.35) * P * ppu);
  });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  top.rotation.x = -Math.PI / 2; top.position.set((x0 + x1) / 2, 0.001, (z0 + z1) / 2); top.receiveShadow = true;
  top.userData = { bb, hoverKind: 'bb' }; hoverables.push(top);
  g.add(top);
  return g;
}

// ---------- ESP32 板 ----------
function buildBoard() {
  const B = C.B, g = new THREE.Group();
  const tp = C.pins.filter(p => p.row === 'top'), bp = C.pins.filter(p => p.row === 'bottom');
  const n = Math.max(tp.length, bp.length);
  const xA = holePos(tp[0].hole).x, xB = holePos(tp[tp.length - 1].hole).x;
  const zT = holePos(tp[0].hole).z, zB = holePos(bp[0].hole).z;
  const x0 = xA - B.pcb.before * P, x1 = xB + B.pcb.after * P, z0 = zT - B.pcb.margin * P, z1 = zB + B.pcb.margin * P;
  const W = x1 - x0, D = z1 - z0, Y = 0.86, T = 0.16;
  const pcbMat = std(B.color, { roughness: 0.55 });
  const pcb = box(W, T, D, pcbMat); pcb.position.set((x0 + x1) / 2, Y + T / 2, (z0 + z1) / 2); g.add(pcb);
  pcb.userData = { tip: () => ({ t: B.name, l: [`上排 ${B.top.length} 腳、下排 ${B.bottom.length} 腳（USB 在左）`, B.sources] }) }; hoverables.push(pcb);
  // 絲印
  const ppu = 150;
  const tex = canvasTex(Math.round(W * ppu), Math.round(D * ppu), (c, w, h) => {
    c.fillStyle = B.color; c.fillRect(0, 0, w, h);
    const X = x => (x - x0) * ppu, Z = z => (z - z0) * ppu;
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2; c.strokeRect(6, 6, w - 12, h - 12);
    const lab = (p, isTop) => {
      const q = holePos(p.hole); const x = X(q.x), z = Z(q.z);
      c.fillStyle = '#d9b45a'; c.beginPath(); c.arc(x, z, 0.36 * P * ppu, 0, 7); c.fill();
      c.fillStyle = '#4d3b12'; c.beginPath(); c.arc(x, z, 0.15 * P * ppu, 0, 7); c.fill();
      c.save(); c.translate(x, z + (isTop ? 0.62 : -0.62) * P * ppu); c.rotate(-Math.PI / 2);
      c.fillStyle = '#f2f2ea'; c.font = `bold ${Math.round(0.5 * P * ppu)}px ${FONT}`; c.textBaseline = 'middle';
      c.textAlign = isTop ? 'right' : 'left'; c.fillText(p.label, 0, 0); c.restore();
    };
    tp.forEach(p => lab(p, true)); bp.forEach(p => lab(p, false));
    c.fillStyle = 'rgba(255,255,255,.75)'; c.font = `bold ${Math.round(0.55 * P * ppu)}px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(B.short, X(xA + 1.0 * P), Z((zT + zB) / 2 + 0.0));
  });
  const silk = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
  silk.rotation.x = -Math.PI / 2; silk.position.set((x0 + x1) / 2, Y + T + 0.002, (z0 + z1) / 2); g.add(silk);
  silk.userData = pcb.userData; hoverables.push(silk);
  // 排針（黑色塑膠座＋金色針）
  const plastic = std('#141414'), gold = std('#d4a94a', { metalness: 0.8, roughness: 0.3 });
  for (const row of [tp, bp]) {
    const za = holePos(row[0].hole).z, xa = holePos(row[0].hole).x, xb = holePos(row[row.length - 1].hole).x;
    const hdr = box(xb - xa + P, 0.25, P * 0.95, plastic); hdr.position.set((xa + xb) / 2, Y - 0.125, za); g.add(hdr);
  }
  const pinGeo = new THREE.BoxGeometry(0.064, 1.2, 0.064), hitGeo = new THREE.BoxGeometry(P * 0.9, 0.35, P * 0.9);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  objs.pinMesh = {};
  for (const p of C.pins) {
    const q = holePos(p.hole);
    const pin = new THREE.Mesh(pinGeo, gold); pin.position.set(q.x, Y - 0.3, q.z); g.add(pin);
    const hit = new THREE.Mesh(hitGeo, hitMat); hit.position.set(q.x, Y + T + 0.1, q.z); g.add(hit);
    hit.userData = { tip: () => pinTip(p) }; hoverables.push(hit);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 24), new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(q.x, Y + T + 0.02, q.z); g.add(ring);
    objs.pinMesh[p.row + p.idx] = ring;
  }
  // 模組（金屬蓋＋天線）
  const f = B.features, zc = (z0 + z1) / 2;
  if (f.includes('module')) {
    const ml = 1.8, mw = Math.min(1.8, D - 0.5);
    const mx1 = x1 - 0.05, mx0 = mx1 - 2.55;
    const base = box(mx1 - mx0, 0.08, mw, std('#20262e')); base.position.set((mx0 + mx1) / 2, Y + T + 0.04, zc); g.add(base);
    const shield = box(ml, 0.3, mw - 0.12, std('#c9ccd1', { metalness: 0.85, roughness: 0.32 })); shield.position.set(mx0 + 0.06 + ml / 2, Y + T + 0.23, zc); g.add(shield);
    const stex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#c9ccd1'; c.fillRect(0, 0, w, h); c.fillStyle = '#5b6068'; c.font = `bold 34px ${FONT}`; c.textAlign = 'center'; c.save(); c.translate(w / 2, h / 2); c.rotate(-Math.PI / 2); c.fillText((B.chip || ['ESP32-S3'])[0], 0, -10); c.font = `24px ${FONT}`; c.fillText((B.chip || ['', 'N16R8'])[1], 0, 26); c.restore(); });
    const lid = new THREE.Mesh(new THREE.PlaneGeometry(ml, mw - 0.12), new THREE.MeshStandardMaterial({ map: stex, metalness: 0.6, roughness: 0.35 }));
    lid.rotation.x = -Math.PI / 2; lid.position.set(shield.position.x, Y + T + 0.385, zc); g.add(lid);
    const ant = new THREE.Mesh(new THREE.PlaneGeometry(0.62, mw - 0.1), new THREE.MeshStandardMaterial({ map: canvasTex(64, 160, (c, w, h) => { c.fillStyle = '#20262e'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c8a048'; c.lineWidth = 5; c.beginPath(); let x = 10; c.moveTo(x, 150); for (let y = 140; y > 20; y -= 18) { c.lineTo(x, y); x = x === 10 ? 54 : 10; c.lineTo(x, y); } c.stroke(); }) }));
    ant.rotation.x = -Math.PI / 2; ant.position.set(mx1 - 0.36, Y + T + 0.085, zc); g.add(ant);
    [shield, lid].forEach(m => { m.userData = { tip: () => ({ t: B.moduleTitle || 'ESP32-S3 模組', l: B.moduleLines || ['雙核 240 MHz、Wi‑Fi＋藍牙', '16 MB Flash＋8 MB PSRAM（N16R8）'] }) }; hoverables.push(m); });
    ant.userData = { tip: () => ({ t: '天線', l: ['PCB 天線，收發 2.4 GHz Wi‑Fi／藍牙', '上面不要壓金屬或線，訊號會變差'] }) }; hoverables.push(ant);
    objs.anchors.module = V(shield.position.x, Y + T + 0.4, zc);
    objs.anchors.antenna = V(ant.position.x, Y + T + 0.1, zc);
  }
  const usbMat = std('#b9bdc4', { metalness: 0.9, roughness: 0.28 });
  const usbs = f.includes('usb2') ? [zc - 0.42, zc + 0.42] : [zc];
  usbs.forEach((z, i) => {
    const u = box(0.72, 0.3, 0.9 * P * 3.6 / 3.6, usbMat); u.geometry = new THREE.BoxGeometry(0.72, 0.28, 0.88); u.position.set(x0 + 0.3, Y + T + 0.14, z); g.add(u);
    const hole = box(0.02, 0.12, 0.62, std('#111')); hole.position.set(x0 - 0.06, Y + T + 0.14, z); g.add(hole);
    u.userData = { tip: () => ({ t: usbs.length > 1 ? `USB-C（${i === 0 ? '上' : '下'}）` : 'USB-C', l: [B.usbNote, '接線前先拔掉 USB！'] }) }; hoverables.push(u);
  });
  objs.anchors.usb = V(x0 + 0.2, Y + T + 0.3, usbs[0]);
  if (f.includes('buttons')) {
    [['BOOT', zT + 0.32], ['RST', zB - 0.32]].forEach(([nm, z]) => {
      const b = box(0.32, 0.12, 0.32, std('#e8e8e8', { metalness: 0.5 })); b.position.set(x0 + 1.05, Y + T + 0.06, z); g.add(b);
      const cap = cyl(0.09, 0.08, std('#222')); cap.position.set(x0 + 1.05, Y + T + 0.15, z); g.add(cap);
      cap.userData = b.userData = { tip: () => ({ t: nm + ' 按鍵', l: [nm === 'BOOT' ? '按住再按 RST 可進下載模式（GPIO0）' : '重新開機'] }) }; hoverables.push(cap, b);
    });
  }
  if (f.includes('camera')) {
    const cx = (xA + xB) / 2 + 0.2;
    const cb = box(0.85, 0.22, 0.85, std('#111')); cb.position.set(cx, Y + T + 0.18, zc); g.add(cb);
    const lens = cyl(0.3, 0.42, std('#1a1a1a', { roughness: 0.3 }), 32); lens.position.set(cx, Y + T + 0.5, zc); g.add(lens);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), std('#2a3b6a', { metalness: 0.9, roughness: 0.05 })); glass.rotation.x = -Math.PI / 2; glass.position.set(cx, Y + T + 0.715, zc); g.add(glass);
    const rib = box(0.5, 0.03, 0.6, std('#c98a2b')); rib.position.set(cx - 0.6, Y + T + 0.03, zc); g.add(rib);
    [cb, lens, glass].forEach(m => { m.userData = { tip: () => ({ t: 'OV3660 鏡頭', l: ['相機佔用 GPIO ' + B.camUsed.join('、'), '這些腳不能再接別的東西'] }) }; hoverables.push(m); });
    objs.anchors.camera = V(cx, Y + T + 0.75, zc);
  }
  objs.anchors.board = V(xA + (xB - xA) * 0.3, Y + T, zc);
  objs.boardBox = { x0, x1, z0, z1, top: Y + T + 0.8 };
  return g;
}
function pinTip(p) {
  const B = C.B; const note = (B.pinNotes || {})[p.label]; const used = C.wires.filter(w => w.boardPin === p);
  const l = [`${p.row === 'top' ? '上排' : '下排'}第 ${p.idx + 1} 腳 · 插在 ${holeName(p.hole)}`];
  if (B.camUsed && B.camUsed.includes(p.label)) l.push('📷 相機佔用，不能接別的東西');
  if (note) l.push(note);
  used.forEach(w => l.push(`▸ 這次接：${w.label}${w.status === 'planned' ? '（未接）' : ''}`));
  return { t: gpioText(p.label), l };
}

// ---------- 模組 ----------
function moduleGroup(m) {
  const g = new THREE.Group();
  const a = holePos(m.mpins[0].hole), b = holePos(m.mpins[m.mpins.length - 1].hole);
  g.position.set((a.x + b.x) / 2, 0, a.z);
  const planned = m.status === 'planned';
  const mk = (c, o = {}) => std(c, Object.assign(planned ? { transparent: true, opacity: 0.55 } : {}, o));
  const span = b.x - a.x;
  // 排針
  const hdr = box(span + P, 0.22, P * 0.9, mk('#141414')); hdr.position.set(0, 0.11, 0); g.add(hdr);
  const gold = mk('#d4a94a', { metalness: 0.8, roughness: 0.3 });
  m.mpins.forEach(p => { const q = holePos(p.hole); const pin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), gold); pin.position.set(q.x - g.position.x, 0.1, 0); g.add(pin); });
  const tilt = new THREE.Group(); tilt.position.y = 0.22; g.add(tilt);
  const silkStrip = (w, h, color, y, front = true) => {
    const t = canvasTex(Math.round(w * 160), Math.round(h * 160), (c, cw, ch) => {
      c.fillStyle = color; c.fillRect(0, 0, cw, ch); c.fillStyle = '#fff'; c.font = `bold ${Math.round(Math.min(ch * 0.62, 0.42 * P * 160))}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      m.mpins.forEach(p => { const q = holePos(p.hole); c.fillText(p.name, (q.x - g.position.x + w / 2) * 160, ch / 2); });
    });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mk('#fff', { map: t })); pl.position.set(0, y, front ? 0.083 : -0.083); if (!front) pl.rotation.y = Math.PI; return pl;
  };
  let top = 1;
  const type = m.type;
  if (type === 'tft') {
    tilt.rotation.x = -0.09;
    const W = 4.3, H = 7.0, col = m.pcbColor || '#a3241f';
    const pcb = box(W, H, 0.16, mk(col)); pcb.position.y = H / 2; tilt.add(pcb);
    const bez = box(3.95, 5.4, 0.12, mk('#0b0b0d', { roughness: 0.3 })); bez.position.set(0, H / 2 + 0.35, 0.13); tilt.add(bez);
    let scrMat;
    if (m.screen) { const tx = new THREE.TextureLoader().load((WD.ASSETS && WD.ASSETS[m.screen]) || m.screen); tx.encoding = THREE.sRGBEncoding; scrMat = new THREE.MeshBasicMaterial({ map: tx, transparent: planned, opacity: planned ? .6 : 1 }); }
    else scrMat = new THREE.MeshBasicMaterial({ color: '#223' });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(3.67, 4.9), scrMat); scr.position.set(0, H / 2 + 0.38, 0.195); tilt.add(scr);
    tilt.add(silkStrip(W - 0.2, 0.32, col, 0.42));
    top = H + 0.3; objs.tall[m.id] = [pcb, bez]; objs.screens[m.id] = scr;
    [pcb, bez, scr].forEach(o => { o.userData = { tip: () => modTip(m) }; hoverables.push(o); });
  } else if (type === 'oled') {
    tilt.rotation.x = -0.12;
    const W = 2.75, H = 2.8, col = m.pcbColor || '#1f4fa8';
    const pcb = box(W, H, 0.14, mk(col)); pcb.position.y = H / 2; tilt.add(pcb);
    const t = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#05070a'; c.fillRect(0, 0, w, h); c.fillStyle = '#7fd4ff'; c.font = `bold 30px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(m.screenText || 'OLED', w / 2, h / 2); });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.45), new THREE.MeshBasicMaterial({ map: t, transparent: planned, opacity: planned ? .7 : 1 })); scr.position.set(0, H / 2 + 0.2, 0.08); tilt.add(scr);
    tilt.add(silkStrip(W - 0.2, 0.3, col, 0.32));
    top = H + 0.3; objs.tall[m.id] = [pcb]; objs.screens[m.id] = scr; objs.screenTex[m.id] = t;
    [pcb, scr].forEach(o => { o.userData = { tip: () => modTip(m) }; hoverables.push(o); });
  } else if (type === 'rgbled') {
    const W = Math.max(span + 0.5, 1.4), H = 1.3;
    const pcb = box(W, H, 0.14, mk('#1b1b1b')); pcb.position.y = H / 2; tilt.add(pcb);
    tilt.add(silkStrip(W - 0.1, 0.26, '#1b1b1b', 0.2));
    const ledMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color(m.ledColor || '#ffffff'), emissiveIntensity: 0.9, transparent: true, opacity: 0.88, roughness: 0.2 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), ledMat); dome.rotation.x = Math.PI / 2; dome.position.set(0, H * 0.62, 0.07);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.3, 24), ledMat); body.rotation.x = Math.PI / 2; body.position.set(0, H * 0.62, 0.07 + 0.0);
    dome.position.z = 0.22; body.position.z = 0.07; tilt.add(body, dome);
    const pl = new THREE.PointLight(m.ledColor || '#ffffff', 0.6, 4); pl.position.set(0, H * 0.62, 0.6); tilt.add(pl);
    objs.leds[m.id] = { mat: ledMat, light: pl }; objs.tall[m.id] = [pcb];
    top = H + 0.2;
    [pcb, dome, body].forEach(o => { o.userData = { tip: () => modTip(m) }; hoverables.push(o); });
  } else if (type === 'dht11') {
    const W = Math.max(span + 0.6, 1.45), H = 0.5;
    const pcb = box(W, H + 0.9, 0.14, mk('#1d1d1d')); pcb.position.y = (H + 0.9) / 2; tilt.add(pcb);
    tilt.add(silkStrip(W - 0.1, 0.26, '#1d1d1d', 0.18));
    const t = canvasTex(128, 160, (c, w, h) => { c.fillStyle = '#3b8fd9'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a6aa8'; for (let y = 16; y < h - 30; y += 18) for (let x = 14; x < w - 10; x += 22) c.fillRect(x, y, 12, 9); c.fillStyle = '#fff'; c.font = `bold 20px ${FONT}`; c.textAlign = 'center'; c.fillText('DHT11', w / 2, h - 10); });
    const s = box(1.2, 1.55, 0.55, mk('#3b8fd9', { map: t })); s.position.set(0, 0.62 + 0.78, 0.36); tilt.add(s);
    top = 2.3;
    [pcb, s].forEach(o => { o.userData = { tip: () => modTip(m) }; hoverables.push(o); });
    objs.tall[m.id] = [s];
  } else if (type === 'ntc' || type === 'hw498') {
    const W = Math.max(span + 0.6, 1.45), H = 1.25, col = m.pcbColor || '#1a1a1a';
    const pcb = box(W, H, 0.14, mk(col)); pcb.position.y = H / 2; tilt.add(pcb);
    tilt.add(silkStrip(W - 0.1, 0.26, col, 0.18));
    const drop = mk('#0b0b0b', { roughness: 0.32, metalness: 0.08 });
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), drop);
    bead.scale.set(1, 1.25, 1); bead.position.set(0, H * 0.62, 0.22); tilt.add(bead);
    const neck = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), drop);
    neck.position.set(0, H * 0.42, 0.16); tilt.add(neck);
    const lead = mk('#c9a84c', { metalness: 0.8, roughness: 0.3 });
    [-0.06, 0.06].forEach(x => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.28, 8), lead);
      w.position.set(x, H * 0.28, 0.08); w.rotation.x = 0.4; tilt.add(w);
    });
    top = H + 0.45; objs.tall[m.id] = [pcb, bead];
    [pcb, bead].forEach(o => { o.userData = { tip: () => modTip(m) }; hoverables.push(o); });
  } else {
    const W = Math.max(span + 0.6, 1.2), H = m.height || 1.2;
    const pc = m.pcbColor || '#2d6a4f';
    const pcb = box(W, H, 0.14, mk(pc)); pcb.position.y = H / 2; tilt.add(pcb);
    tilt.add(silkStrip(W - 0.1, 0.26, pc, 0.2));
    if (m.label) {
      const lw = W - 0.12, lh = Math.max(0.3, H - 0.5);
      const lt = canvasTex(Math.round(lw * 120), Math.round(lh * 120), (c, cw, ch) => { c.fillStyle = pc; c.fillRect(0, 0, cw, ch); c.fillStyle = m.labelColor || '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; let fs = Math.min(ch * 0.42, 40); c.font = `bold ${fs}px ${FONT}`; while (fs > 10 && c.measureText(m.label).width > cw * 0.92) { fs -= 2; c.font = `bold ${fs}px ${FONT}`; } c.fillText(m.label, cw / 2, ch / 2); });
      const lp = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), mk('#fff', { map: lt })); lp.position.set(0, 0.36 + lh / 2, 0.075); tilt.add(lp); lp.userData = { tip: () => modTip(m) }; hoverables.push(lp);
    }
    if (m.knob) { const k = cyl(0.3, 0.35, mk('#cfd8dc', { metalness: 0.5 })); k.rotation.x = Math.PI / 2; k.position.set(0, H * 0.6, 0.25); tilt.add(k); }
    if (m.ledColor) {
      const ledMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color(m.ledColor), emissiveIntensity: 0.9, transparent: true, opacity: 0.88, roughness: 0.2 });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), ledMat); dome.position.set(0, H + 0.1, 0); tilt.add(dome);
      const pl = new THREE.PointLight(m.ledColor, 0.5, 3); pl.position.set(0, H + 0.2, 0.4); tilt.add(pl); objs.leds[m.id] = { mat: ledMat, light: pl };
    }
    top = H + 0.2; pcb.userData = { tip: () => modTip(m) }; hoverables.push(pcb);
  }
  if (planned) {
    const tag = makeSprite('未接', '#c2410c'); tag.position.set(0, top + 0.5, 0); g.add(tag);
  }
  objs.anchors['module:' + m.id] = V(g.position.x, top, g.position.z);
  return g;
}
function modTip(m) {
  const l = [m.desc || '', `插在 ${holeName(m.mpins[0].hole)}–${m.mpins[m.mpins.length - 1].hole.col}（左到右 ${m.pins.join('、')}）`];
  if (m.status === 'planned') l.push('⚠ 預定，還沒接');
  if (m.status === 'tbd') l.push('⚠ 待確認');
  return { t: m.name, l: l.filter(Boolean) };
}
function makeSprite(text, bg) {
  const t = canvasTex(256, 96, (c, w, h) => { c.fillStyle = bg; const r = 30; c.beginPath(); c.moveTo(r, 8); c.arcTo(w - 8, 8, w - 8, h - 8, r); c.arcTo(w - 8, h - 8, 8, h - 8, r); c.arcTo(8, h - 8, 8, 8, r); c.arcTo(8, 8, w - 8, 8, r); c.fill(); c.fillStyle = '#fff'; c.font = `bold 46px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 2); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(1.1, 0.41, 1); s.renderOrder = 10; return s;
}

// ---------- 電阻 ----------
function buildResistor(w) {
  const g = new THREE.Group(); const a = holePos(w.from), b = holePos(w.to);
  const lead = std('#b8b8b8', { metalness: 0.9, roughness: 0.3 });
  const yb = 0.28, mid = a.clone().lerp(b, 0.5); const len = a.distanceTo(b);
  const pts = [a.clone(), a.clone().setY(yb), b.clone().setY(yb), b.clone()];
  const path = new THREE.CurvePath(); for (let i = 0; i < 3; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(path, 30, 0.022, 6, false), lead); g.add(tube);
  const bl = Math.min(0.62, len * 0.6);
  const t = canvasTex(128, 32, (c, W, H) => { c.fillStyle = '#d9c39a'; c.fillRect(0, 0, W, H); [['#d32f2f', 22], ['#d32f2f', 42], ['#6d4c41', 62], ['#c9a227', 100]].forEach(([cc, x]) => { c.fillStyle = cc; c.fillRect(x, 0, 10, H); }); });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, bl, 16), std('#fff', { map: t })); body.castShadow = true;
  body.position.copy(mid).setY(yb); body.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  g.add(body);
  body.userData = tube.userData = { tip: () => ({ t: `電阻 ${w.value || ''}`, l: [w.note || '', `${holeName(w.from)} ↔ ${holeName(w.to)}`].filter(Boolean) }), wire: w }; hoverables.push(body);
  return { group: g, mats: [lead, body.material], mid: mid.clone().setY(yb + 0.1), curve: new THREE.LineCurve3(a.clone().setY(yb), b.clone().setY(yb)) };
}

// ---------- 跳線 ----------
function wireCurve(w) {
  const a = holePos(w.from), b = holePos(w.to);
  const d = Math.hypot(a.x - b.x, a.z - b.z);
  let h = 0.55 + 0.07 * d;
  const bb = objs.boardBox;
  const crosses = (() => { for (let t = 0; t <= 1; t += 0.05) { const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t; if (x > bb.x0 - 0.2 && x < bb.x1 + 0.2 && z > bb.z0 - 0.2 && z < bb.z1 + 0.2) return true; } return false; })();
  if (crosses) h = Math.max(h, bb.top + 0.4);
  if (w.lift) h += w.lift;
  const up = 0.42;
  const approach = (h0) => {               // 插在高模組同一欄：從模組的另一側（背面）下來，不穿過模組
    const hit = (C.strips[stripKey(h0)] || []).find(x => x.kind === 'module' && objs.tall[x.mod.id]);
    if (!hit) return null;
    const dz = holePos(h0).z - holePos(hit.mpin.hole).z;
    if (Math.abs(dz) < 1e-6) return null;
    return V(0, 0, Math.sign(dz) * 0.85);
  };
  const ea = approach(w.from), eb = approach(w.to);
  const pa = a.clone().setY(up), pb = b.clone().setY(up);
  const qa = pa.clone().add(ea || V(0, 0, 0)), qb = pb.clone().add(eb || V(0, 0, 0));
  const pts = [a.clone().setY(0.02), pa];
  if (ea) pts.push(qa.clone().setY(up + 0.25));
  const m1 = qa.clone().lerp(qb, 0.28).setY(h), m2 = qa.clone().lerp(qb, 0.72).setY(h);
  pts.push(m1, m2);
  if (eb) pts.push(qb.clone().setY(up + 0.25));
  pts.push(pb, b.clone().setY(0.02));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
}
function stripeTex(color) {
  const t = canvasTex(64, 8, (c, w, h) => { c.fillStyle = color; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.fillRect(w / 2, 0, w / 2, h); });
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(26, 1); return t;
}
function buildWire(w) {
  if (w.kind === 'resistor') return buildResistor(w);
  const curve = wireCurve(w);
  const geo = new THREE.TubeGeometry(curve, 140, 0.04, 8, false);
  const planned = w.status === 'planned';
  const mat = new THREE.MeshStandardMaterial({ color: planned ? '#ffffff' : w.color, map: planned ? stripeTex(w.color) : null, roughness: 0.45, transparent: true, opacity: 1, emissive: new THREE.Color(w.color), emissiveIntensity: 0 });
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
  const g = new THREE.Group(); g.add(mesh);
  const glowGeo = new THREE.TubeGeometry(curve, 140, 0.095, 10, false);
  const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: w.color, transparent: true, opacity: 0.28, depthWrite: false }));
  glow.visible = false; g.add(glow);
  const hous = std('#151515', { transparent: true });
  for (const h of [w.from, w.to]) {
    const q = holePos(h);
    const c1 = box(0.12, 0.34, 0.12, hous); c1.position.set(q.x, 0.2, q.z); g.add(c1);
  }
  const fat = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.11, 6, false), new THREE.MeshBasicMaterial({ visible: false }));
  g.add(fat);
  fat.userData = mesh.userData = { tip: () => wireTip(w), wire: w }; hoverables.push(fat);
  return { group: g, mesh, glow, glowGeo, mats: [mat, hous], curve, geo, total: geo.index.count, gtotal: glowGeo.index.count, mid: curve.getPoint(0.5) };
}
function wireTip(w) {
  const l = [];
  l.push(`${holeName(w.from)} → ${holeName(w.to)}`);
  if (w.boardPin) l.push(`ESP32 ${gpioText(w.boardPin.label)}（${w.boardPin.row === 'top' ? '上排' : '下排'}第 ${w.boardPin.idx + 1} 腳）`);
  if (w.modHit) l.push(`${w.modHit.mod.name} ${w.modHit.mpin.name}`); else if (w.via) l.push(w.via);
  if (w.note) l.push(w.note);
  if (w.status === 'planned') l.push('⚠ 預定，還沒接');
  if (w.status === 'tbd') l.push('⚠ 待確認：' + (w.tbd || ''));
  return { t: w.label, l };
}

// ---------- 建立專案場景 ----------
function loadProject(id) {
  stopSim();
  const p = WD.projects.find(x => x.id === id) || WD.projects[0];
  const keepCam = C && C.proj === p && p.keepCamera;
  C = compile(p);
  if (root) scene.remove(root);
  hoverables.length = 0;
  root = new THREE.Group(); scene.add(root);
  objs = { anchors: {}, tall: {}, screens: {}, screenTex: {}, leds: {}, wires: {}, pinMesh: {} };
  root.add(buildBreadboard('L'), buildBreadboard('R'));
  objs.boardBox = { x0: 0, x1: 0, z0: 0, z1: 0, top: 0 };
  if (!C.B.none) root.add(buildBoard());
  C.mods.forEach(m => root.add(moduleGroup(m)));
  C.wires.forEach(w => { const o = buildWire(w); o.w = w; objs.wires[w.id] = o; root.add(o.group); });
  state.step = -1; state.all = true;
  document.title = `${p.title} · 接線實驗室`;
  renderUI();
  if (!keepCam) fitAll(true);
  applyStep();
  if (location.hash.slice(1).split('/')[0] !== p.id) history.replaceState(null, '', '#' + p.id);
}

// ---------- 相機 ----------
function fitBox(min, max, instant, dirOverride, margin = 0.86) {
  const center = min.clone().add(max).multiplyScalar(0.5);
  const dir = (dirOverride || camera.position.clone().sub(controls.target)).clone().normalize();
  const corners = []; for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) corners.push(V(x, y, z));
  const cam = camera.clone(); let dist = min.distanceTo(max) * 1.2 + 2;
  for (let it = 0; it < 6; it++) {           // 投影到畫面，調整距離讓整個框剛好塞進去
    cam.position.copy(center).addScaledVector(dir, dist); cam.lookAt(center); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    let m = 0; corners.forEach(c => { const v = c.clone().project(cam); m = Math.max(m, Math.abs(v.x), Math.abs(v.y)); });
    dist *= Math.max(0.5, Math.min(2, m / margin));
  }
  dist = Math.max(dist, 3.5);
  const to = center.clone().addScaledVector(dir, dist);
  if (instant) { camera.position.copy(to); controls.target.copy(center); controls.update(); camAnim.t = 1; return; }
  Object.assign(camAnim, { t: 0, from: camera.position.clone(), to, tf: controls.target.clone(), tt: center });
}
function fitAll(instant) {
  const bx = new THREE.Box3().setFromObject(root);
  const narrow = camera.aspect < 1;
  const dir = narrow ? V(0, 0.9, 0.44) : V(0, 0.74, 0.67);
  fitBox(bx.min, bx.max, instant, dir, narrow ? 0.98 : 0.9);
}
function focusWires(ws, mods) {
  const min = V(1e9, 1e9, 1e9), max = V(-1e9, -1e9, -1e9);
  const addP = v => { min.min(v); max.max(v); };
  ws.forEach(w => { addP(holePos(w.from)); addP(holePos(w.to)); if (objs.wires[w.id]) addP(objs.wires[w.id].mid); });
  (mods || []).forEach(id => { const m = C.mods.find(x => x.id === id); if (m) { m.mpins.forEach(p => addP(holePos(p.hole))); addP(objs.anchors['module:' + id]); } });
  if (min.x > 1e8) return fitAll();
  min.x -= 0.5; max.x += 0.5; min.z -= 0.5; max.z += 0.5; max.y = Math.max(max.y, 0.6);
  fitBox(min, max, false, camera.aspect < 1 ? V(0, 0.9, 0.45) : V(0, 0.8, 0.6), 0.8);
}

// ---------- 步驟 ----------
function stepWires(i) { const s = C.steps[i]; return (s && s.wires || []).map(id => C.wires.find(w => w.id === id)).filter(Boolean); }
function applyStep() {
  const all = state.all || state.step < 0;
  const act = all ? [] : stepWires(state.step);
  const actIds = new Set(act.map(w => w.id));
  const s = C.steps[state.step];
  const actMods = new Set(all ? [] : (s && s.modules || []).concat(act.map(w => w.modHit && w.modHit.mod.id).filter(Boolean)));
  for (const id in objs.wires) {
    const o = objs.wires[id], on = all || actIds.has(id);
    o.mats.forEach(m => { m.transparent = true; m.opacity = on ? 1 : 0.1; m.depthWrite = on; });
    if (o.mesh) { o.glow.visible = actIds.has(id); o.mesh.material.emissiveIntensity = actIds.has(id) ? 0.35 : 0; o.anim = actIds.has(id) ? 0 : 1; if (!actIds.has(id)) { o.geo.setDrawRange(0, Infinity); o.glowGeo.setDrawRange(0, Infinity); } }
  }
  for (const id in objs.tall) objs.tall[id].forEach(m => { m.material.transparent = true; const want = (!all && act.some(w => w.modHit && w.modHit.mod.id === id)) ? 0.28 : (C.mods.find(x => x.id === id).status === 'planned' ? 0.55 : 1); m.material.opacity = want; });
  for (const k in objs.pinMesh) objs.pinMesh[k].material.opacity = 0;
  act.forEach(w => { if (w.boardPin) objs.pinMesh[w.boardPin.row + w.boardPin.idx].material.opacity = 1; });
  if (!all) focusWires(act, s && s.modules); else if (state.step >= 0 || state._wasStep) fitAll();
  state._wasStep = !all;
  renderStepUI();
  updateHash();
}
function go(i) { if (!C.steps.length) return; state.all = false; state.step = Math.max(0, Math.min(C.steps.length - 1, i)); applyStep(); }
function showAll() { state.all = true; applyStep(); }
function updateHash() { const h = '#' + C.proj.id + (state.all ? '' : '/' + (state.step + 1)); if (location.hash !== h) history.replaceState(null, '', h); }

// ---------- 浮動標註（callouts） ----------
function calloutList() {
  const all = state.all || state.step < 0;
  if (!all) {
    const out = [];
    stepWires(state.step).forEach(w => {
      if (w.kind === 'resistor') { out.push({ p: objs.wires[w.id].mid, title: `電阻 ${w.value || ''}`, text: `${holeName(w.from)} ↔ ${holeName(w.to)}`, color: '#8d6e63', small: true }); return; }
      const bp = w.boardPin; const pa = holePos(w.from).setY(0.45), pb = holePos(w.to).setY(0.45);
      out.push({ p: pa, title: bp ? gpioText(bp.label) : holeName(w.from), text: holeName(w.from), color: w.color, small: true });
      out.push({ p: pb, title: w.modHit ? `${w.modHit.mod.short || w.modHit.mod.name} ${w.modHit.mpin.name}` : holeName(w.to), text: holeName(w.to), color: w.color, small: true });
    });
    return out;
  }
  return (C.proj.callouts || []).map(c => ({ p: objs.anchors[c.target], title: c.title, text: c.text, color: c.color || '#ff7a1a', dx: c.dx, dy: c.dy })).filter(c => c.p);
}
let calloutEls = [];
function renderCallouts() {
  const layer = $('#callouts'); const svg = $('#leaders');
  const list = state.labels ? calloutList() : [];
  const key = list.map(c => c.title + c.text).join('|');
  if (layer._key !== key) {
    layer.querySelectorAll('.co').forEach(e => e.remove()); calloutEls = [];
    list.forEach(c => { const e = el('div', 'co' + (c.small ? ' small' : ''), `<b><i style="background:${c.color}"></i>${esc(c.title)}</b>${c.text ? `<span>${esc(c.text)}</span>` : ''}`); layer.appendChild(e); calloutEls.push(e); });
    layer._key = key;
  }
  const W = layer.clientWidth, H = layer.clientHeight, narrow = W < 640;
  const rects = [];
  const sr = layer.getBoundingClientRect();
  ['.boardtag', '#legend', '.vctl'].forEach(q => { const e = document.querySelector(q); if (!e || !e.offsetWidth) return; const r = e.getBoundingClientRect(); rects.push([r.left - sr.left, r.top - sr.top, r.width, r.height]); });
  let lines = '';
  list.forEach((c, i) => {
    const e = calloutEls[i]; if (!e) return;
    const v = c.p.clone().project(camera);
    const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H;
    if (v.z > 1) { e.style.display = 'none'; return; }
    e.style.display = '';
    e.classList.toggle('compact', narrow);
    const ew = e.offsetWidth, eh = e.offsetHeight;
    let x, y;
    if (c.small || narrow) { x = sx + (c.dx != null && !narrow ? c.dx : 12); y = sy - eh - 10; }
    else {
      const dx = c.dx != null ? c.dx : (sx < W / 2 ? -160 : 60), dy = c.dy != null ? c.dy : (sy < H / 2 ? -90 : 60);
      x = sx + dx; y = sy + dy;
    }
    x = Math.max(4, Math.min(W - ew - 4, x)); y = Math.max(4, Math.min(H - eh - 4, y));
    for (let it = 0; it < 12; it++) {           // 避開重疊
      const hit = rects.find(r => x < r[0] + r[2] + 4 && x + ew + 4 > r[0] && y < r[1] + r[3] + 4 && y + eh + 4 > r[1]);
      if (!hit) break;
      y = (y + eh / 2 < hit[1] + hit[3] / 2) ? hit[1] - eh - 6 : hit[1] + hit[3] + 6;
      if (y < 4 || y + eh > H - 4) { y = Math.max(4, Math.min(H - eh - 4, y)); x = hit[0] + hit[2] + 8; if (x + ew > W) x = hit[0] - ew - 8; }
    }
    rects.push([x, y, ew, eh]);
    e.style.transform = `translate(${x}px,${y}px)`;
    const ax = Math.max(x, Math.min(x + ew, sx)), ay = Math.max(y, Math.min(y + eh, sy));
    lines += `<line x1="${sx}" y1="${sy}" x2="${ax}" y2="${ay}" stroke="${c.color}" stroke-width="1.6" stroke-dasharray="4 3"/><circle cx="${sx}" cy="${sy}" r="4.5" fill="${c.color}" stroke="#fff" stroke-width="1.5"/>`;
  });
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = lines;
}

// ---------- 滑鼠提示 ----------
function pick(e, click) {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(hoverables, false);
  let tip = null;
  for (const h of hits) {
    const u = h.object.userData;
    if (u.hoverKind === 'bb') { tip = holeTip(u.bb, h.point); if (tip) break; else continue; }
    if (u.wire && !state.all && !stepWires(state.step).includes(u.wire)) { if (click) { const si = C.steps.findIndex(s => (s.wires || []).includes(u.wire.id)); if (si >= 0) { go(si); } } continue; }
    if (u.tip) { tip = u.tip(); if (click && u.wire) { const si = C.steps.findIndex(s => (s.wires || []).includes(u.wire.id)); if (si >= 0 && si !== state.step) go(si); } break; }
  }
  if (tip) showTip(tip, e.clientX - r.left, e.clientY - r.top); else hideTip();
  renderer.domElement.style.cursor = tip ? 'pointer' : 'grab';
}
function holeTip(bb, pt) {
  const col = Math.round(pt.x / P + 32), k = pt.z / P + MID - BBOFF[bb];
  let best = null, bd = 0.42;
  for (const r in ROWK) { const d = Math.abs(ROWK[r] - k); if (d < bd) { bd = d; best = r; } }
  if (!best || col < 1 || col > NCOL || Math.abs(pt.x / P + 32 - col) > 0.42) return null;
  const h = { bb, row: best, col };
  const inside = stripContents(C, h);
  return { t: holeName(h), l: [stripDesc(h), inside.length ? '這一欄接到：' + inside.join('、') : '這一欄沒有接腳'] };
}
function showTip(t, x, y) {
  const tip = $('#tip'); tip.innerHTML = `<b>${esc(t.t)}</b>` + t.l.map(s => `<div>${esc(s)}</div>`).join('');
  tip.style.display = 'block';
  const W = tip.parentElement.clientWidth, H = tip.parentElement.clientHeight;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  tip.style.left = Math.min(W - tw - 6, Math.max(6, x + 14)) + 'px'; tip.style.top = Math.min(H - th - 6, Math.max(6, y + 14)) + 'px';
}
function hideTip() { $('#tip').style.display = 'none'; }

// ---------- UI ----------
function chip(w) { return `<i class="sw" style="background:${w.status === 'planned' ? `repeating-linear-gradient(90deg,${w.color} 0 6px,#fff 6px 10px)` : w.color}"></i>`; }
function statusBadge(st) { return st === 'planned' ? '<em class="bd pl">未接</em>' : st === 'tbd' ? '<em class="bd tb">待確認</em>' : ''; }
function renderUI() {
  const p = C.proj;
  $('#ptitle').textContent = p.title;
  $('#psub').innerHTML = esc(p.subtitle || '') + ' ' + statusBadge(p.status);
  $('#boardname').textContent = C.B.name;
  // 專案列
  const strip = $('#projects'); strip.innerHTML = '';
  let ex = 0;
  WD.projects.forEach((q) => {
    const isB = !!q.builder;
    if (!isB && ex === 0) strip.appendChild(el('span', 'pjsep', '範例'));
    const n = isB ? '＋' : String(++ex);
    const bt = q.board && q.board.type && WD.BOARDS[q.board.type];
    const sub = isB ? (q.subtitleShort || '空白麵包板，自己加板子和模組') : `${bt ? bt.short : ''}${q.status === 'planned' ? ' · 預定' : ''}`;
    const b = el('button', 'pj' + (isB ? ' bld' : '') + (q.id === p.id ? ' on' : ''), `<span class="n">${n}</span><span><b>${esc(q.short || q.title)}</b><small>${esc(sub)}</small></span>`);
    b.onclick = () => { if (location.hash.slice(1).split('/')[0] === q.id) loadProject(q.id); else location.hash = q.id; };
    strip.appendChild(b);
  });
  // 自己組：「組裝」分頁只在自己組模式出現
  const bTab = document.querySelector('.tabs button[data-t=build]');
  if (bTab) { bTab.style.display = p.builder ? '' : 'none'; if (!p.builder && bTab.classList.contains('on')) document.querySelector('.tabs button[data-t=steps]').click(); }
  // 接線表
  const rows = C.wires.map(w => {
    const bp = w.boardPin; const bpTxt = bp ? `${bp.row === 'top' ? '上' : '下'}${bp.idx + 1}（${holeName(w.from)}）` : holeName(w.from);
    const gp = bp ? gpioText(bp.label) : (w.kind === 'resistor' ? '—' : '');
    const mp = w.modHit ? `${esc(w.modHit.mod.short || w.modHit.mod.name)} <b>${esc(w.modHit.mpin.name)}</b>（${holeName(w.to)}）` : esc(w.via || holeName(w.to));
    const bad = (w.pinOk === false || w.modOk === false) ? ' <em class="bd bad">腳位不符</em>' : '';
    return `<tr data-w="${w.id}"><td>${chip(w)}${w.kind === 'resistor' ? '電阻' : esc(FUNC[w.func].name)}</td><td>${bpTxt}</td><td><b>${esc(gp)}</b></td><td>${mp}</td><td>${esc(w.label)}${w.note ? `<small>${esc(w.note)}</small>` : ''}${statusBadge(w.status)}${w.status === 'tbd' && w.tbd ? `<small>待確認：${esc(w.tbd)}</small>` : ''}${bad}</td></tr>`;
  }).join('');
  if (p.tableHTML) $('#tab-table').innerHTML = p.tableHTML(C); else $('#tab-table').innerHTML = `<p class="hint">點一列就會在 3D 裡標出那條線。線色依功能（紅＝電源、黑＝GND、其他＝訊號），不一定是你手上跳線的顏色。孔名「左I17」＝左麵包板 I 排第 17 欄。</p><div class="tw"><table><thead><tr><th>線色</th><th>板子腳位</th><th>GPIO</th><th>模組腳位</th><th>說明</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  $('#tab-table').querySelectorAll('tr[data-w]').forEach(tr => tr.onclick = () => { const si = C.steps.findIndex(s => (s.wires || []).includes(tr.dataset.w)); if (si >= 0) { go(si); if (isNarrow()) $('#stage').scrollIntoView({ behavior: 'smooth' }); } });
  // 注意事項＋待確認
  const warn = C.warn.length ? `<div class="box bad"><b>⚠ 設定檔腳位核對不符</b><ul>${C.warn.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : `<div class="box ok"><b>✓ 腳位自動核對通過</b><div>每條線的孔位都依板子實際腳序算過，和設定寫的 GPIO 一致。</div></div>`;
  $('#tab-safety').innerHTML = `<div class="box warnb"><b>接線安全</b><ul>${(p.safety || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` +
    ((p.tbd || []).length ? `<div class="box tbd"><b>待確認</b><ul>${p.tbd.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : '') + warn +
    (p.sources ? `<p class="hint">資料來源：${esc(p.sources)}</p>` : '');
  // 腳位圖
  const pinChip = (pp) => {
    const ws = C.wires.filter(w => w.boardPin === pp); const w = ws[0];
    const cam = C.B.camUsed && C.B.camUsed.includes(pp.label);
    const cls = 'pc' + (w ? ' used' : '') + (cam ? ' cam' : '') + (/GND/.test(pp.label) ? ' g' : '') + (/3V3|5V/.test(pp.label) ? ' v' : '');
    return `<span class="${cls}" title="${esc(pinTip(pp).l.join('\n'))}" style="${w ? `--c:${w.color}` : ''}">${esc(pp.label)}</span>`;
  };
  $('#tab-pins').innerHTML = `<p class="hint">USB 在左、元件朝上。上排由左到右，下排由左到右。有顏色＝這次有接；📷＝相機佔用。滑鼠移到 3D 板子的腳上也看得到說明。</p>
    <div class="pinrow"><small>上排</small>${C.pins.filter(x => x.row === 'top').map(pinChip).join('')}</div>
    <div class="pinrow"><small>下排</small>${C.pins.filter(x => x.row === 'bottom').map(pinChip).join('')}</div>
    <p class="hint">${esc(C.B.sources)}</p>`;
  if (C.B.none) $('#tab-pins').innerHTML = '<p class="hint">還沒選開發板。到「組裝」分頁先選一塊板子。</p>';
  // 程式
  $('#codepre').innerHTML = hl(p.code || '// 這個專案還沒有程式');
  $('#simbtn').style.display = p.sim ? '' : 'none';
  $('#simname').textContent = p.sim ? p.sim.label : '';
  $('#serial').textContent = p.sim ? '（按 ▶ 開始模擬；這是網頁上的示意，不是真的板子）' : '這個專案沒有模擬。';
  // 步驟清單
  const ul = $('#steplist'); ul.innerHTML = '';
  C.steps.forEach((s, i) => {
    const ws = stepWires(i);
    const li = el('li', '', `<span class="sn">${i + 1}</span><span class="st">${esc(s.title)}</span>${ws.map(chip).join('')}${statusBadge(s.status || (ws.length && ws.every(w => w.status === 'planned') ? 'planned' : ws.some(w => w.status === 'tbd') ? 'tbd' : ''))}`);
    li.onclick = () => go(i); ul.appendChild(li);
  });
  // 圖例
  const used = new Set(C.wires.map(w => w.func));
  if (p.onRender) p.onRender(C);
  $('#legend').style.display = C.wires.length ? '' : 'none';
  $('#legend').innerHTML = Object.keys(FUNC).filter(k => used.has(k)).map(k => `<span><i style="background:${FUNC[k].color}"></i>${FUNC[k].name}</span>`).join('') + (C.wires.some(w => w.status === 'planned') ? `<span><i style="background:repeating-linear-gradient(90deg,#888 0 5px,#fff 5px 8px)"></i>未接／預定</span>` : '');
}
function renderStepUI() {
  const n = C.steps.length, all = state.all || state.step < 0;
  $('#count').textContent = all ? `全部 ${n} 步` : `${state.step + 1} / ${n}`;
  $('#mcount').textContent = all ? `全部 ${n} 步` : `${state.step + 1}/${n}`;
  $('#progress i').style.width = all ? '100%' : ((state.step + 1) / n * 100) + '%';
  ['#prev', '#mprev'].forEach(s => $(s).disabled = !all && state.step <= 0);
  ['#next', '#mnext'].forEach(s => $(s).disabled = n === 0 || (!all && state.step >= n - 1));
  ['#prev', '#mprev'].forEach(s => { if (n === 0) $(s).disabled = true; });
  $('#allbtn').classList.toggle('on', all);
  const card = $('#stepcard');
  if (all && C.proj.introHTML) {
    card.innerHTML = C.proj.introHTML(C);
  } else if (all) {
    card.innerHTML = `<div class="sh"><span class="big">${n}</span><div><b>${esc(C.proj.title)}</b><small>按「下一步」從第 1 步開始，一次只亮一條線</small></div></div><p>${esc(C.proj.intro || '')}</p>`;
  } else {
    const s = C.steps[state.step], ws = stepWires(state.step);
    const pills = ws.map(w => {
      if (w.kind === 'resistor') return `<div class="conn">${chip(w)}<span>電阻 ${esc(w.value || '')}</span><span class="ar">↔</span><span>${holeName(w.from)} – ${holeName(w.to)}</span></div>`;
      const a = w.boardPin ? `<b>${esc(gpioText(w.boardPin.label))}</b> ${holeName(w.from)}` : `<b>${holeName(w.from)}</b>`;
      const b = w.modHit ? `${holeName(w.to)} <b>${esc(w.modHit.mod.short || w.modHit.mod.name)} ${esc(w.modHit.mpin.name)}</b>` : `<b>${holeName(w.to)}</b>${w.via ? ' ' + esc(w.via) : ''}`;
      return `<div class="conn">${chip(w)}<span>${a}</span><span class="ar">→</span><span>${b}</span>${statusBadge(w.status)}</div>`;
    }).join('');
    card.innerHTML = `<div class="sh"><span class="big">${state.step + 1}</span><div><b>${esc(s.title)}</b><small>第 ${state.step + 1} 步，共 ${n} 步</small></div></div>${s.text ? `<p>${esc(s.text)}</p>` : ''}${pills}${s.warn ? `<div class="sw2">⚠ ${esc(s.warn)}</div>` : ''}`;
  }
  $('#steplist').querySelectorAll('li').forEach((li, i) => li.classList.toggle('on', !all && i === state.step));
  const on = $('#steplist li.on'); if (on && !isNarrow()) on.scrollIntoView({ block: 'nearest' });
}
const isNarrow = () => window.innerWidth < 900;
function hl(code) {
  return esc(code).split('\n').map((ln, i) => {
    let s = ln.replace(/(\/\/.*)$/, '<span class="c">$1</span>');
    if (!/class="c"/.test(s) || s.indexOf('<span') > 0) s = s.replace(/\b(const|constexpr|int|void|bool|float|uint8_t|uint16_t|uint32_t|return|if|else|for|while|#include|#define|true|false)\b(?![^<]*<\/span>)/g, '<span class="k">$1</span>');
    s = s.replace(/(&quot;[^&]*&quot;)/g, '<span class="s">$1</span>');
    return `<span class="ln">${i + 1}</span>${s}`;
  }).join('\n');
}

// ---------- 即時訊號模擬 ----------
function stopSim() { if (state.sim) state.sim.running = false; state.sim = null; const b = $('#simbtn'); if (b) b.textContent = '▶ 模擬'; if (objs) for (const id in objs.wires) objs.wires[id].pulses = []; }
function startSim() {
  if (state.sim) return stopSim();
  const p = C.proj; if (!p.sim) return;
  const ser = $('#serial'); ser.textContent = '';
  const api = {
    running: true,
    log: s => { ser.textContent += s + '\n'; ser.scrollTop = ser.scrollHeight; },
    wait: ms => new Promise(r => setTimeout(r, ms)),
    led: (id, rgb) => { const L = objs.leds[id]; if (!L) return; const c = new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255); L.mat.emissive.copy(c); L.light.color.copy(c); L.light.intensity = (rgb[0] + rgb[1] + rgb[2]) ? 0.8 : 0; },
    pulse: (ids, n = 3) => { [].concat(ids).forEach(id => { const o = objs.wires[id]; if (!o) return; o.pulses = o.pulses || []; for (let i = 0; i < n; i++) o.pulses.push({ t: -i * 0.18 }); ensurePulseMesh(o); }); },
    screen: (id, draw) => { const t = objs.screenTex[id]; if (!t) return; draw(t._ctx, t._canvas.width, t._canvas.height); t.needsUpdate = true; }
  };
  state.sim = api; $('#simbtn').textContent = '■ 停止';
  Promise.resolve(p.sim.run(api)).catch(e => api.log('模擬錯誤：' + e)).finally(() => { if (state.sim === api) stopSim(); });
}
function ensurePulseMesh(o) {
  if (o.pulseMeshes) return;
  o.pulseMeshes = [0, 1, 2, 3, 4, 5].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff7c2' })); m.visible = false; root.add(m); return m; });
}

// ---------- 迴圈 ----------
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (camAnim.t < 1) {
    camAnim.t = Math.min(1, camAnim.t + dt / 0.75); const k = 1 - Math.pow(1 - camAnim.t, 3);
    camera.position.lerpVectors(camAnim.from, camAnim.to, k); controls.target.lerpVectors(camAnim.tf, camAnim.tt, k);
  }
  controls.update();
  if (objs) for (const id in objs.wires) {
    const o = objs.wires[id];
    if (o.geo && o.anim != null && o.anim < 1) { o.anim = Math.min(1, o.anim + dt / 0.9); const k = 1 - Math.pow(1 - o.anim, 2); o.geo.setDrawRange(0, Math.ceil(o.total * k / 6) * 6); o.glowGeo.setDrawRange(0, Math.ceil(o.gtotal * k / 6) * 6); }
    if (o.pulseMeshes) {
      o.pulses = (o.pulses || []).map(p => ({ t: p.t + dt * 0.9 })).filter(p => p.t < 1);
      o.pulseMeshes.forEach((m, i) => { const p = o.pulses[i]; m.visible = !!p && p.t >= 0; if (m.visible) m.position.copy(o.curve.getPoint(p.t)); });
    }
  }
  renderer.render(scene, camera);
  if (C && objs) renderCallouts();
}

// ---------- 啟動 ----------
function boot() {
  try {
    initThree();
    $('#prev').onclick = $('#mprev').onclick = () => state.all ? go(0) : go(state.step - 1);
    $('#next').onclick = $('#mnext').onclick = () => state.all ? go(0) : go(state.step + 1);
    $('#allbtn').onclick = $('#mall').onclick = showAll;
    $('#v-reset').onclick = () => fitAll();
    $('#v-in').onclick = () => zoom(0.8); $('#v-out').onclick = () => zoom(1.25);
    $('#v-l').onclick = () => orbit(0.35); $('#v-r').onclick = () => orbit(-0.35);
    $('#v-lab').onclick = () => { state.labels = !state.labels; $('#v-lab').classList.toggle('on', state.labels); };
    $('#simbtn').onclick = startSim;
    $('#copybtn').onclick = () => { const t = C.proj.code || ''; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => flash('#copybtn', '已複製')).catch(() => { const ta = el('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); flash('#copybtn', '已複製'); }); };
    document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b)); document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + b.dataset.t)); });
    window.addEventListener('keydown', e => { if (e.target.tagName === 'TEXTAREA') return; if (e.key === 'ArrowRight') $('#next').click(); if (e.key === 'ArrowLeft') $('#prev').click(); if (e.key === 'Escape') showAll(); });
    window.addEventListener('hashchange', fromHash);
    fromHash(true);
    setInterval(() => { const d = new Date(); $('#clock').textContent = d.toLocaleString('zh-TW', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }, 1000);
    setTimeout(() => { window.__ready = true; }, 300);
  } catch (e) { $('#err').textContent = '載入失敗：' + e.message; $('#err').style.display = 'block'; console.error(e); window.__ready = true; }
}
function fromHash(first) {
  const [id, st] = location.hash.slice(1).split('/');
  if (!C || C.proj.id !== (id || WD.projects[0].id)) loadProject(id || WD.projects[0].id);
  if (st) go(+st - 1); else if (!first && !state.all) showAll();
}
function zoom(f) { const d = camera.position.clone().sub(controls.target).multiplyScalar(f); Object.assign(camAnim, { t: 0, from: camera.position.clone(), to: controls.target.clone().add(d), tf: controls.target.clone(), tt: controls.target.clone() }); }
function orbit(a) { const d = camera.position.clone().sub(controls.target); d.applyAxisAngle(V(0, 1, 0), a); Object.assign(camAnim, { t: 0, from: camera.position.clone(), to: controls.target.clone().add(d), tf: controls.target.clone(), tt: controls.target.clone() }); }
function flash(sel, txt) { const b = $(sel), o = b.textContent; b.textContent = txt; setTimeout(() => b.textContent = o, 1200); }
WD.debug = () => ({ C, objs, camera, holePos });
WD.reload = () => { if (C) loadProject(C.proj.id); };
WD.go = i => go(i); WD.showAll = showAll; WD.load = id => loadProject(id); WD.state = state; WD.startSim = startSim;
window.addEventListener('DOMContentLoaded', boot);
})();
