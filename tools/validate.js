// 不開瀏覽器，核對每個專案的腳位：node tools/validate.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const ctx = { window: {}, document: { querySelector: () => null, createElement: () => ({ getContext: () => null }) }, console, self: {} };
ctx.window.addEventListener = () => {}; ctx.window.WD = undefined;
vm.createContext(ctx); ctx.window = ctx; ctx.addEventListener = () => {};
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const files = ['js/lib/three.min.js', 'js/boards.js', 'js/app.js', 'js/builder.js', ...[...html.matchAll(/src="(projects\/[^"]+)"/g)].map(m => m[1])];
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
// ---------- 自己組：自動配線測試 ----------
const BAN = { s3_44: ['0','3','45','46','19','20','26','27','28','29','30','31','32','33','34','35','36','37','43','44','RX','TX'],
  s3_cam: ['0','3','45','46','19','20','35','36','37','RX','TX','4','5','6','7','8','9','10','11','12','13','15','16','17','18'],
  devkitc38: ['0','2','5','12','15','CLK','D0','D1','D2','D3','CMD','RX','TX'] };
const ADC1 = { s3_44: ['1','2','3','4','5','6','7','8','9','10'], s3_cam: ['1','2'], devkitc38: ['32','33','34','35','VP','VN'] };
const allTypes = Object.keys(ctx.WD.builder.PARTS);
const cases = [
  ['s3_44', ['dht11', 'oled_spi', 'soil_mh', 'led220']],
  ['s3_44', ['oled_spi', 'tft24', 'oled_i2c13', 'oled_i2c13', 'dht11', 'ntc498', 'button', 'pullup10k', 'ds18b20', 'sonar', 'ws2812', 'sg90', 'relay']],
  ['s3_cam', ['oled_i2c13', 'dht11', 'soil_mh', 'ntc498', 'led220']],
  ['devkitc38', ['tft24', 'pot', 'button', 'pir501', 'rcwl0516', 'float', 'buzzer']],
  ['s3_44', allTypes],
  ['s3_cam', allTypes]
];
for (const [board, types] of cases) {
  const p = ctx.WD.builder.set(board, types); const C = ctx.WD.compile(p); const R = p._R; const errs = [];
  for (const [k, items] of Object.entries(C.strips)) if (items.length > 1) errs.push('短路 ' + k);
  const holes = {}; C.wires.forEach(w => [w.from, w.to].forEach(h => { const k = `${h.bb}:${h.row}${h.col}`; if (holes[k]) errs.push(`同一孔插兩條：${k}（${holes[k]}、${w.id}）`); holes[k] = w.id; }));
  C.warn.forEach(s => errs.push(s));
  C.wires.forEach(w => { if (w.boardPin && w.func === 'sig' && BAN[board].includes(w.boardPin.label)) errs.push(`用到禁用腳 ${w.boardPin.label}（${w.label}）`); });
  // 類比腳一定在 ADC1
  types.forEach((t, k) => (ctx.WD.builder.PARTS[t].pins || []).forEach((pp, pi) => { if (pp[1] !== 'adc') return; const w = C.wires.find(x => x.id === `p${k + 1}_${pi}`); if (w && !ADC1[board].includes(w.boardPin && w.boardPin.label)) errs.push(`類比腳不在 ADC1：${w.label} → ${w.boardPin && w.boardPin.label}`); }));
  // 同一支 GPIO 不能給兩個不同功能（匯流排除外）
  const byPin = {}; C.wires.filter(w => w.boardPin && w.func === 'sig').forEach(w => { const l = w.boardPin.label; (byPin[l] = byPin[l] || new Set()).add(w.label.replace(/^.*?(（[A-Z]+）)?$/, '$1') || w.id); });
  const busPins = Object.values(ctx.WD.builder.PROF[board].spi).concat(Object.values(ctx.WD.builder.PROF[board].i2c));
  for (const [l, set] of Object.entries(byPin)) if (set.size > 1 && !busPins.includes(l)) errs.push(`GPIO ${l} 被分給多個零件`);
  console.log(`\n■ 自己組 ${board}｜${types.length} 個零件｜${C.mods.length} 個上板｜${C.wires.length} 條線／電阻｜${C.steps.length} 步｜警告 ${R.warns.length}`);
  R.rows.forEach(r => console.log(`   ${r.part}\t${r.pin}\t${r.to}\t${r.color ? r.color[1] : ''}`));
  R.warns.forEach(s => console.log('   (提示) ' + s));
  errs.forEach(s => console.log('  ✗ ' + s)); bad += errs.length;
}
ctx.WD.builder.set(null, []);
console.log(bad ? `\n共 ${bad} 個問題` : '\n全部通過'); process.exit(bad ? 1 : 0);
