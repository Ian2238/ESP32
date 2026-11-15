// 不開瀏覽器，核對每個專案的腳位：node tools/validate.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const ctx = { window: {}, document: { querySelector: () => null, createElement: () => ({ getContext: () => null }) }, console, self: {} };
ctx.window.addEventListener = () => {}; ctx.window.WD = undefined;
vm.createContext(ctx); ctx.window = ctx; ctx.addEventListener = () => {};
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const files = ['js/lib/three.min.js', 'js/boards.js', 'js/app.js', ...[...html.matchAll(/src="(projects\/[^"]+)"/g)].map(m => m[1])];
for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
let bad = 0;
for (const p of ctx.WD.projects) {
  const C = ctx.WD.compile(p);
  console.log(`\n■ ${p.id}｜${p.title}｜${C.B.name}｜${C.wires.length} 條線、${C.steps.length} 步`);
  for (const w of C.wires) {
    const bp = w.boardPin ? `${w.boardPin.row === 'top' ? '上' : '下'}${w.boardPin.idx + 1}=${w.boardPin.label}` : '—';
    const mp = w.modHit ? `${w.modHit.mod.short || w.modHit.mod.id}.${w.modHit.mpin.name}` : (w.via || '—');
    const ok = (w.pinOk !== false && w.modOk !== false) ? '✓' : '✗';
    console.log(`  ${ok} ${w.label.padEnd(16)} ${ctx.WD.holeName(w.from)}→${ctx.WD.holeName(w.to)}  板:${bp}  模組:${mp}  ${w.status}`);
  }
  const ids = new Set(C.wires.map(w => w.id));
  C.steps.forEach((s, i) => (s.wires || []).forEach(id => { if (!ids.has(id)) { C.warn.push(`步驟 ${i + 1} 指到不存在的線 ${id}`); } }));
  // 同一欄插了兩個不同的腳 → 短路
  for (const [k, items] of Object.entries(C.strips)) if (items.length > 1) { C.warn.push(`短路：${k} 同一欄有 ${items.map(x => x.kind === 'board' ? 'ESP32 ' + x.pin.label : x.mod.id + '.' + x.mpin.name).join('、')}`); }
  C.warn.forEach(s => console.log('  ⚠ ' + s)); bad += C.warn.length;
}
console.log(bad ? `\n共 ${bad} 個問題` : '\n全部通過'); process.exit(bad ? 1 : 0);
