/* 接線實驗室・自己組（首頁）
 * 空白麵包板 → 選開發板 → 從零件庫加模組 → 自動分配 GPIO、拉線、出腳位表和 #define。
 * 產生的是一個普通的 WD 專案（id: 'build'），3D／步驟／接線表沿用 app.js。
 * 腳位規則：預設 3V3；只有需要的零件才用 5V。類比只用 ADC1。避開 strap、Flash／PSRAM、USB、UART0 腳。
 * I2C、SPI 共用匯流排（SPI 每個裝置各自一支 CS）。電阻跟著主零件（LED 串 220Ω、DS18B20 上拉 4.7k）。
 */
(function () {
'use strict';
const WD = window.WD = window.WD || {};
const STORE = 'wd-builder-v1';
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- 各板子的可用腳位（依優先順序） ----------
// digital：一般數位腳（先用不佔 ADC1 的）；late：最後才用（ADC1 腳、可能接板載燈的腳）
// 沒列到的腳一律不用：S3＝0/3/45/46（strap）、19/20（USB）、26–37（Flash／OPI PSRAM）、43/44（UART0）
const PROF = {
  s3_44: {
    adc1: ['4', '5', '6', '7', '1', '2', '8', '9', '10'],
    digital: ['15', '16', '17', '18', '21', '38', '39', '40', '47', '14'],
    late: ['4', '5', '6', '7', '1', '2', '8', '9', '10', '48'],
    inputOnly: [],
    spi: { SCK: '12', MOSI: '11', MISO: '13' }, i2c: { SDA: '41', SCL: '42' },
    rules: ['不用 strap 腳 GPIO0、3、45、46', '不用 Flash／OPI PSRAM 腳 GPIO26–37（N16R8）', '不用原生 USB 腳 GPIO19、20 和 UART0（TX43／RX44）', '類比只用 ADC1（GPIO1–10），ADC2 開 Wi‑Fi 時不能讀', 'GPIO48 可能是板載 RGB 燈，排在最後']
  },
  s3_cam: {
    adc1: ['1', '2'],
    digital: ['21', '47', '14'],
    late: ['2', '1', '48'],
    inputOnly: [],
    spi: { SCK: '39', MOSI: '38', MISO: '40' }, i2c: { SDA: '41', SCL: '42' },
    rules: ['相機佔用 GPIO4–13、15–18，全部避開', '不用 strap 腳 GPIO0、3、45、46', '不用 Flash／OPI PSRAM 腳 GPIO26–37、USB 腳 19／20、UART0', '類比只剩 ADC1 的 GPIO1、2 可用', 'GPIO14 可能接板載燈、48 可能是 RGB 燈（待確認），排在後面', 'SPI 走 GPIO 矩陣（SCK39／MOSI38／MISO40），速度請設 ≤ 40 MHz']
  },
  devkitc38: {
    adc1: ['32', '33', '34', '35', 'VP', 'VN'],
    digital: ['4', '13', '14', '16', '17', '25', '26', '27'],
    late: ['32', '33'],
    inputOnly: ['34', '35', 'VP', 'VN'],
    spi: { SCK: '18', MOSI: '23', MISO: '19' }, i2c: { SDA: '21', SCL: '22' },
    rules: ['不用 Flash 腳 GPIO6–11（CLK、D0–D3、CMD）', '不用 strap 腳 GPIO0、2、5、12、15', '不用 UART0（TX1／RX3）', '類比只用 ADC1（GPIO32–39），ADC2 開 Wi‑Fi 時不能讀', 'GPIO34、35、36（VP）、39（VN）只能輸入、沒有內部上拉']
  }
};
const BOARD_ORDER = [
  { id: 's3_44', desc: 'Ian 的一般 44 腳 S3（蒙娜麗莎、氣候站那塊）' },
  { id: 's3_cam', desc: 'Ian 的 S3 CAM（OV3660），相機吃掉大部分腳' },
  { id: 'devkitc38', desc: '經典 ESP32 DevKitC 38 腳（參考用）' }
];

// ---------- 零件庫 ----------
// 腳 k：gnd｜vcc（依零件電壓）｜adc（ADC1）｜in（輸入）｜inpu（輸入、需上拉）｜out｜io（雙向）｜sda/scl｜sck/mosi/miso｜nc（不接）
const CATS = [['display', '顯示'], ['sensor', '感測器'], ['output', '輸出／致動'], ['passive', '被動元件（電阻等）']];
const PARTS = {
  oled_spi: { cat: 'display', name: '0.96 吋 OLED（7 針 SPI）', short: 'OLED', pfx: 'OLED', v: '3V3',
    model: { type: 'oled', screenText: 'SPI OLED' },
    pins: [['GND', 'gnd'], ['VCC', 'vcc'], ['SCL', 'sck', 'D0＝SPI 時脈'], ['SDA', 'mosi', 'D1＝SPI 資料'], ['RES', 'out', '重置', 'RST'], ['DC', 'out', '資料／指令', 'DC'], ['CS', 'out', '片選（每個 SPI 裝置一支）', 'CS']],
    lib: 'U8g2：U8G2_SSD1306_128X64_NONAME_F_4W_HW_SPI', desc: 'SSD1306 128×64，7 針 SPI。VCC 只接 3V3。腳序以絲印為準（有的印 D0／D1）。' },
  oled_i2c13: { cat: 'display', name: '1.3 吋 OLED（I2C，DST-013）', short: 'OLED1.3', pfx: 'OLED13', v: '3V3',
    model: { type: 'oled', screenText: '1.3" I2C' },
    pins: [['GND', 'gnd'], ['VCC', 'vcc'], ['SCL', 'scl'], ['SDA', 'sda']],
    lib: 'U8g2：U8G2_SH1106_128X64_NONAME_F_HW_I2C（位址多半 0x3C）', desc: '1.3 吋多半是 SH1106 晶片，4 針 I2C。腳序以絲印為準（有的 VCC、GND 對調）。' },
  tft24: { cat: 'display', name: '2.4 吋 TFT（ILI9341 SPI）', short: 'TFT', pfx: 'TFT', v: '3V3',
    model: { type: 'tft' },
    pins: [['GND', 'gnd'], ['VCC', 'vcc'], ['SCL', 'sck', 'SPI 時脈'], ['SDA', 'mosi', 'SPI 資料'], ['RES', 'out', '重置', 'RST'], ['DC', 'out', '資料／指令', 'DC'], ['CS', 'out', '片選', 'CS'], ['BLK', 'vcc', '背光常亮接 3V3']],
    lib: 'TFT_eSPI 或 Adafruit_ILI9341', desc: '照 Ian 那塊 8 針 ILI9341（MRD TFT240_8P_CS）。有觸控／SD 卡的大板子腳更多，以絲印為準。' },

  dht11: { cat: 'sensor', name: 'DHT11 溫濕度', short: 'DHT11', pfx: 'DHT', v: '3V3', model: { type: 'dht11' },
    pins: [['S', 'io', '資料'], ['+', 'vcc'], ['−', 'gnd']], lib: 'DHT sensor library（Adafruit）', desc: '三腳模組 S、+、−，模組上多半已有上拉電阻。+ 只接 3V3。' },
  ntc498: { cat: 'sensor', name: 'HW-498 NTC 溫度', short: 'HW-498', pfx: 'NTC', v: '3V3', model: { type: 'ntc' },
    pins: [['−', 'gnd'], ['+', 'vcc'], ['S', 'adc', '類比輸出']], desc: 'NTC 熱敏電阻模組，絲印 −、+、S。S 讀 ADC1。10k／B3950 待校正。', tbd: 'NTC 參數（10k、B3950、10k 參考電阻）待校正' },
  soil_mh: { cat: 'sensor', name: 'MH 土壤濕度', short: '土壤', pfx: 'SOIL', v: '3V3', model: { type: 'generic', pcbColor: '#1565c0', label: 'MH 土壤', height: 1.25 },
    pins: [['VCC', 'vcc'], ['GND', 'gnd'], ['DO', 'nc', '門檻數位輸出，要用再接'], ['AO', 'adc', '類比輸出，電壓越高越乾']], desc: 'MH 系列比較板：VCC、GND、DO、AO。AO 讀 ADC1，乾／濕電壓待校正。', tbd: '土壤乾／濕電壓待校正' },
  sound485: { cat: 'sensor', name: 'HW-485 聲音', short: 'HW-485', pfx: 'SOUND', v: '3V3', model: { type: 'generic', pcbColor: '#1b5e20', label: 'HW-485 🎤', height: 1.3 },
    pins: [['AO', 'adc', '類比音量'], ['G', 'gnd'], ['+', 'vcc'], ['DO', 'in', '超過門檻變 HIGH／LOW（看藍色可變電阻）']], desc: '聲音模組：AO 類比、DO 數位門檻。' },
  touch494: { cat: 'sensor', name: 'HW-494／KY-036 觸摸', short: '觸摸', pfx: 'TOUCH', v: '3V3', model: { type: 'generic', pcbColor: '#263238', label: 'HW-494 觸摸', height: 1.3 },
    pins: [['A0', 'nc', '類比輸出，一般不用'], ['G', 'gnd'], ['+', 'vcc'], ['D0', 'in', '摸到就變化']], desc: '金屬觸摸模組，讀 D0 就好。' },
  rcwl0516: { cat: 'sensor', name: 'RCWL-0516 微波雷達', short: '雷達', pfx: 'RADAR', v: '5V', model: { type: 'generic', pcbColor: '#0d47a1', label: 'RCWL-0516', height: 1.5 },
    pins: [['3V3', 'nc', '模組的 3.3V 輸出，不要接'], ['GND', 'gnd'], ['OUT', 'in', '有人＝HIGH（3.3V，可直接進 GPIO）'], ['VIN', 'vcc', '4–28V，接 5V'], ['CDS', 'nc', '光敏電阻用，不接']], desc: 'VIN 吃 4–28V，接 5V；OUT 是 3.3V 電位，可以直接接 GPIO。' },
  pir501: { cat: 'sensor', name: 'HC-SR501 人體紅外線', short: 'PIR', pfx: 'PIR', v: '5V', model: { type: 'generic', pcbColor: '#33691e', label: 'HC-SR501', height: 1.6 },
    pins: [['VCC', 'vcc', '4.5–20V，接 5V'], ['OUT', 'in', '有人＝HIGH（3.3V）'], ['GND', 'gnd']], desc: 'VCC 接 5V；OUT 是 3.3V 電位。上面兩顆可變電阻調靈敏度和延遲。' },
  sonar: { cat: 'sensor', name: '超音波 HC-SR04／JSN-SR04T', short: '超音波', pfx: 'SONAR', v: '5V', model: { type: 'generic', pcbColor: '#1565c0', label: 'HC-SR04', height: 1.4 },
    pins: [['VCC', 'vcc'], ['Trig', 'out', '觸發'], ['Echo', 'in', '⚠ 5V 輸出，要分壓', null, true], ['GND', 'gnd']], desc: '5V 供電。Echo 是 5V，一定要分壓（1kΩ＋2kΩ）再進 GPIO。JSN-SR04T 防水版接法一樣。' },
  float: { cat: 'sensor', name: '浮球開關（液位）', short: '浮球', pfx: 'FLOAT', v: '3V3', model: { type: 'generic', pcbColor: '#455a64', label: '浮球', height: 0.9 },
    pins: [['1', 'inpu', '用內部上拉，浮起／沉下＝LOW／HIGH'], ['2', 'gnd']], desc: '兩條線不分極性：一條到 GPIO（INPUT_PULLUP），一條到 GND。' },
  button: { cat: 'sensor', name: '按鈕（按下＝LOW）', short: '按鈕', pfx: 'BTN', v: '3V3', model: { type: 'generic', pcbColor: '#37474f', label: '按鈕', height: 0.8 },
    pins: [['1', 'inpu', '用內部上拉，按下＝LOW'], ['2', 'gnd']], desc: '兩腳按鈕：一腳到 GPIO（INPUT_PULLUP），一腳到 GND。要外接上拉就加「10k 上拉電阻」。' },
  ds18b20: { cat: 'sensor', name: 'DS18B20 防水溫度＋4.7k', short: 'DS18B20', pfx: 'DS18B20', v: '3V3', model: { type: 'generic', pcbColor: '#212121', label: 'DS18B20', height: 0.9 },
    pins: [['GND', 'gnd', '黑線'], ['DQ', 'io', '資料（黃線）'], ['VDD', 'vcc', '紅線']], res: { a: 'DQ', b: 'VDD', value: '4.7kΩ', note: 'DQ 和 VDD 之間的上拉電阻（1-Wire 必要）' },
    lib: 'OneWire＋DallasTemperature', desc: 'TO-92／防水線：GND 黑、DQ 黃、VDD 紅。DQ 一定要 4.7k 上拉到 3V3。' },

  ws2812: { cat: 'output', name: 'WS2812 燈條', short: 'WS2812', pfx: 'WS2812', v: '5V', model: { type: 'generic', pcbColor: '#fafafa', labelColor: '#333', label: 'WS2812 ●●●', height: 0.9, ledColor: '#ff4fd8' },
    pins: [['5V', 'vcc'], ['DIN', 'out', '資料（3.3V 推 5V 燈條）'], ['GND', 'gnd']], lib: 'Adafruit_NeoPixel 或 FastLED', desc: '5V 燈條。燈多要另接 5V 電源並共地，DIN 前串 330Ω。' },
  led220: { cat: 'output', name: 'LED＋220Ω 電阻', short: 'LED', pfx: 'LED', v: '3V3', model: { type: 'generic', pcbColor: '#5d4037', label: 'LED', height: 0.5, ledColor: '#ff3b30' },
    pins: [['A', 'out', '長腳（＋），經 220Ω 到 GPIO', null, false, '220Ω'], ['K', 'gnd', '短腳（−）']], desc: '一般 LED：長腳 A 經 220Ω 到 GPIO，短腳 K 接 GND。' },
  relay: { cat: 'output', name: '繼電器模組（5V 一路）', short: '繼電器', pfx: 'RELAY', v: '5V', model: { type: 'generic', pcbColor: '#1565c0', label: 'RELAY', height: 1.6 },
    pins: [['DC+', 'vcc'], ['DC−', 'gnd'], ['IN', 'out', '控制（注意高／低觸發）']], desc: '5V 線圈。藍色常見款是低電位觸發，3.3V 控制可能一直吸住，先實測。練習時不要接 110V。' },
  sg90: { cat: 'output', name: 'SG90 伺服馬達', short: 'SG90', pfx: 'SERVO', v: '5V', model: { type: 'generic', pcbColor: '#1e88e5', label: 'SG90', height: 1.5 },
    pins: [['GND', 'gnd', '棕線'], ['VCC', 'vcc', '紅線'], ['SIG', 'out', '橘線（PWM 50Hz）']], lib: 'ESP32Servo', desc: '棕 GND、紅 5V、橘 訊號。啟動電流大，建議另接 5V 電源並共地。' },
  buzzer: { cat: 'output', name: '蜂鳴器模組', short: '蜂鳴器', pfx: 'BUZZER', v: '3V3', model: { type: 'generic', pcbColor: '#212121', label: 'BUZZER', height: 1.1 },
    pins: [['S', 'out', '訊號'], ['+', 'vcc'], ['−', 'gnd']], desc: '主動式給 HIGH 就響；被動式要用 tone()／PWM。腳序以絲印為準。' },

  pullup10k: { cat: 'passive', name: '10k 上拉電阻（掛在按鈕／浮球）', short: '10k', pfx: 'R10K', attach: true, desc: '加了會自動掛在第一個還沒有上拉的按鈕或浮球開關：訊號腳 → 10k → 3V3。' },
  pot: { cat: 'passive', name: '可變電阻 10k', short: '可變電阻', pfx: 'POT', v: '3V3', model: { type: 'generic', pcbColor: '#0277bd', label: 'POT', height: 0.9, knob: true },
    pins: [['GND', 'gnd', '左腳'], ['W', 'adc', '中間腳（滑動端）'], ['VCC', 'vcc', '右腳']], desc: '兩邊接 3V3／GND，中間腳讀 ADC1（0–3.3V）。' }
};

// 線色
const COL = { r3: ['#e53935', '紅'], r5: ['#ff6d00', '橘'], g: ['#222222', '黑'], sck: ['#f9a825', '黃'], mosi: ['#27ae60', '綠'], miso: ['#795548', '棕'], sda: ['#1e88e5', '藍'], scl: ['#00acc1', '青'], CS: ['#e84393', '粉紅'], DC: ['#8e44ad', '紫'], RST: ['#78909c', '灰'] };
const PAL = [['#f9a825', '黃'], ['#27ae60', '綠'], ['#1e88e5', '藍'], ['#8e44ad', '紫'], ['#00acc1', '青'], ['#e84393', '粉紅'], ['#795548', '棕'], ['#78909c', '灰']];

// ---------- 狀態 ----------
let st = { board: null, parts: [], seq: 0 };
function load() { try { const s = JSON.parse(localStorage.getItem(STORE) || 'null'); if (s && Array.isArray(s.parts)) st = { board: s.board && WD.BOARDS && WD.BOARDS[s.board] ? s.board : null, parts: s.parts.filter(p => PARTS[p.t]), seq: s.seq || s.parts.length }; } catch (e) { /* 沒有 localStorage 就算了 */ } }
function save() { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (e) { } }

// ---------- 麵包板幾何 ----------
const RAILOK = c => c >= 3 && c <= 61 && (c - 3) % 6 !== 5;
// 四條「零件道」：每塊麵包板的上半（A–E）和下半（F–J），第 32 欄以後（板子佔 1–27 欄）。
// 電源軌：所有 − 軌＝GND；＋軌只有右麵包板最外側那條（右 r4）是 5V，其餘都是 3V3。
const SIDE = {
  LA: { bb: 'L', modRow: 'E', wireRows: ['D', 'C', 'B', 'A'], rails: { '3V3': 'r1', 'GND': 'r2', '5V': 'R:r4' }, name: '左', half: '上半' },
  LB: { bb: 'L', modRow: 'F', wireRows: ['G', 'H', 'I', 'J'], rails: { '3V3': 'r4', 'GND': 'r3', '5V': 'R:r4' }, name: '左', half: '下半' },
  RA: { bb: 'R', modRow: 'E', wireRows: ['D', 'C', 'B', 'A'], rails: { '3V3': 'r1', 'GND': 'r2', '5V': 'R:r4' }, name: '右', half: '上半' },
  RB: { bb: 'R', modRow: 'F', wireRows: ['G', 'H', 'I', 'J'], rails: { '3V3': 'R:r1', 'GND': 'r3', '5V': 'r4' }, name: '右', half: '下半' }
};
const LANES = { tall: ['LA', 'LB', 'RA', 'RB'], v3: ['LB', 'RA', 'LA', 'RB'], v5: ['RB', 'RA', 'LB', 'LA'] };
const railOf = (S, volt) => { const r = S.rails[volt]; return r.includes(':') ? { bb: r[0], row: r.slice(2) } : { bb: S.bb, row: r }; };
const RAILNAME = { r1: '＋軌', r2: '−軌', r3: '−軌', r4: '＋軌' };
const RPOS = { r1: '上', r2: '上', r3: '下', r4: '下' };
const COL0 = 32, COLMAX = 62, FEEDCOL = 30;
const P = 0.254;
function physW(model, n) {
  const span = (n - 1) * P;
  if (!model) return span;
  if (model.type === 'oled') return 2.75;
  if (model.type === 'tft') return 4.3;
  if (model.type === 'dht11' || model.type === 'ntc') return Math.max(span + 0.6, 1.45);
  return Math.max(span + 0.6, 1.2);
}

// ---------- 產生專案 ----------
function gpioOf(B, label) { return (B.gpioOf && B.gpioOf[label]) || label; }
function generate() {
  const proj = WD.projects.find(p => p.id === 'build');
  const B = st.board ? WD.BOARDS[st.board] : null, prof = st.board ? PROF[st.board] : null;
  const R = { modules: [], wires: [], steps: [], rows: [], warns: [], notes: [], tbd: [], defs: [], setup: [], loop: [], libs: [], callouts: [] };
  const insts = st.parts.map(p => ({ uid: p.id, t: p.t, def: PARTS[p.t] }));
  // 名稱：同型號多個就加編號
  const cnt = {}, idx = {};
  insts.forEach(i => cnt[i.t] = (cnt[i.t] || 0) + 1);
  insts.forEach(i => { idx[i.t] = (idx[i.t] || 0) + 1; i.n = idx[i.t]; i.multi = cnt[i.t] > 1; i.label = i.def.short + (i.multi ? ' #' + i.n : ''); i.pfx = i.def.pfx + (i.multi ? i.n : ''); });
  if (!B) {
    Object.assign(proj, { board: null, modules: [], wires: [], steps: [], callouts: [], code: '// 先在「組裝」選一塊開發板', safety: ['先選開發板，再加零件。'], tbd: [] });
    proj._R = R; proj.title = '自己組：空白麵包板'; proj.subtitle = '空白麵包板・先選開發板'; proj.subtitleShort = '空白麵包板，自己加板子和模組';
    return;
  }
  // 板子腳位
  const pinsByLabel = {};
  B.top.forEach((l, i) => (pinsByLabel[l] = pinsByLabel[l] || []).push({ row: 'top', hole: { bb: 'L', row: 'J', col: 2 + i }, free: ['I', 'H', 'G', 'F'] }));
  B.bottom.forEach((l, i) => (pinsByLabel[l] = pinsByLabel[l] || []).push({ row: 'bottom', hole: { bb: 'R', row: 'C', col: 2 + i }, free: ['D', 'E', 'B', 'A'] }));
  const hs = h => `${h.bb}:${h.row}${h.col}`;
  const usedHole = new Set();
  function boardHole(label, prefer) {          // 從板子這支腳的同一欄拿一個空孔
    const list = (pinsByLabel[label] || []).slice().sort((a, b) => (a.row === prefer ? -1 : 0) - (b.row === prefer ? -1 : 0));
    for (const bp of list) { const r = bp.free.shift(); if (r) return { bb: bp.hole.bb, row: r, col: bp.hole.col }; }
    return null;
  }
  function railHole(bb, row, col) {
    for (let d = 0; d < 12; d++) for (const c of [col + d, col - d]) { if (!RAILOK(c)) continue; const h = { bb, row, col: c }; if (!usedHole.has(hs(h))) { usedHole.add(hs(h)); return h; } }
    return null;
  }
  const label5V = B.top.concat(B.bottom).find(l => /^5V/.test(l)) || '5V';
  // 電源軌：用到才接
  const feeds = {};
  const BBN = { L: '左', R: '右' };
  function rail(lane, volt) {
    const rr = railOf(SIDE[lane], volt), side = rr.bb, row = rr.row;
    const key = side + row;
    if (!feeds[key]) {
      const plabel = volt === '3V3' ? '3V3' : volt === '5V' ? label5V : 'GND';
      const from = boardHole(plabel, side === 'L' ? 'top' : 'bottom');
      const to = railHole(side, row, FEEDCOL);
      if (!from || !to) { R.warns.push(`板子的 ${plabel} 腳沒有空孔可以接電源軌`); return { row, ok: false }; }
      const c = volt === 'GND' ? COL.g : volt === '5V' ? COL.r5 : COL.r3;
      const rn = `${BBN[side]}${RPOS[row]}${RAILNAME[row]}`;
      const w = { id: 'feed_' + key, label: `${plabel} → ${rn}`, func: volt === 'GND' ? 'gnd' : 'pwr', color: c[0], from: hs(from), to: hs(to), pin: plabel, via: `${rn}（${volt}）`, note: volt === '5V' ? '這條軌是 5V，只給 5V 零件用' : '' };
      R.wires.push(w); feeds[key] = { bb: side, row, name: rn, w, ok: true };
      R.steps.push({ title: `${volt} 接到${rn}`, wires: [w.id], text: `從 ${WD.holeName(from)}（板子 ${plabel}）接到 ${WD.holeName(to)}，整條${rn}就是 ${volt}。`, warn: volt === '5V' ? '這條是 5V 軌，3.3V 的零件不要接到這裡。' : '' });
      R.rows.push({ part: '電源軌', pin: rn, to: plabel, color: c, note: `整條軌都是 ${volt}`, wid: w.id });
    }
    return feeds[key];
  }
  // 1) 匯流排
  const need = { i2c: false, spi: false, miso: false };
  insts.forEach(i => (i.def.pins || []).forEach(p => { if (p[1] === 'sda' || p[1] === 'scl') need.i2c = true; if (['sck', 'mosi', 'miso'].includes(p[1])) need.spi = true; if (p[1] === 'miso') need.miso = true; }));
  const used = new Set();
  const bus = {};
  if (need.i2c) { bus.sda = prof.i2c.SDA; bus.scl = prof.i2c.SCL; used.add(bus.sda); used.add(bus.scl); }
  if (need.spi) { bus.sck = prof.spi.SCK; bus.mosi = prof.spi.MOSI; used.add(bus.sck); used.add(bus.mosi); if (need.miso) { bus.miso = prof.spi.MISO; used.add(bus.miso); } }
  const spare = [];                            // 沒用到的匯流排腳也可當一般腳
  if (!need.spi) spare.push(prof.spi.SCK, prof.spi.MOSI, prof.spi.MISO); else if (!need.miso) spare.push(prof.spi.MISO);
  if (!need.i2c) spare.push(prof.i2c.SDA, prof.i2c.SCL);
  const exists = l => !!pinsByLabel[l] && !(B.camUsed || []).includes(l);
  const dpool = prof.digital.concat(spare, prof.late).filter(exists);
  const take = (list) => { const g = list.find(l => !used.has(l) && exists(l)); if (g) used.add(g); return g || null; };
  // 2) 先分配所有訊號腳（類比 → 只能輸入 → 一般）
  const sigs = [];
  insts.forEach(i => (i.def.pins || []).forEach((p, pi) => { if (['adc', 'in', 'inpu', 'out', 'io'].includes(p[1])) sigs.push({ i, p, pi }); }));
  const order = { adc: 0, in: 1, inpu: 2, io: 2, out: 2 };
  sigs.slice().sort((a, b) => order[a.p[1]] - order[b.p[1]]).forEach(s => {
    const k = s.p[1];
    if (k === 'adc') s.g = take(prof.adc1);
    else if (k === 'in') s.g = take(prof.inputOnly) || take(dpool);
    else s.g = take(dpool.filter(l => !prof.inputOnly.includes(l)));
    if (!s.g) {
      R.warns.push(k === 'adc' ? `ADC1 腳用完了：${s.i.label} 的 ${s.p[0]} 沒有可用的類比腳（不用 ADC2，因為開 Wi‑Fi 時 ADC2 不能讀）` : `GPIO 不夠了：${s.i.label} 的 ${s.p[0]} 沒有可用腳位（已避開 strap／Flash／PSRAM／USB 腳）`);
    }
  });
  const sigOf = (i, pi) => sigs.find(s => s.i === i && s.pi === pi);
  // 3) 擺零件、拉線
  const cursor = { LA: COL0, LB: COL0, RA: COL0, RB: COL0 };
  let palI = 0;
  const busPrev = {};                          // 匯流排：板子那欄孔不夠時，從上一個裝置同一條訊號接過來
  const hasBoardStep = R.steps.length;
  R.steps.unshift({ title: '拔 USB、放好板子', text: `先拔掉 USB。${B.name}：上排插左麵包板 J2 起、下排插右麵包板 C2 起，USB 朝左。`, warn: '接線前一定先拔 USB。' });
  const pullups = insts.filter(i => i.def.attach);
  const pullTargets = insts.filter(i => i.t === 'button' || i.t === 'float');
  pullups.forEach((pu, k) => { pu.target = pullTargets[k] || null; if (pu.target) pu.target.pull = pu; else R.warns.push(`${pu.label}：沒有按鈕或浮球開關可以掛，先加一個按鈕／浮球。`); });
  insts.forEach(i => {
    const d = i.def;
    if (d.attach) {
      R.rows.push({ part: i.label, pin: '—', to: i.target ? `掛在 ${i.target.label}` : '沒有掛（先加按鈕／浮球）', color: null, note: d.desc });
      return;
    }
    const n = d.pins.length;
    const lanes = (d.model && (d.model.type === 'tft' || d.model.type === 'oled')) ? LANES.tall : d.v === '5V' ? LANES.v5 : LANES.v3;
    const hasRes = d.pins.some(p => p[5]);
    const W = physW(d.model, n), fp = Math.max(n, Math.ceil(W / P)) + 1 + (hasRes ? 2 : 0);
    let side = null;
    for (const s of lanes) if (cursor[s] + fp - 1 <= COLMAX + 1) { side = s; break; }
    if (!side) {
      R.warns.push(`麵包板放不下 ${i.label}（四條零件道都滿了），這個零件沒畫在 3D，也沒分配腳位。`);
      R.rows.push({ part: i.label, pin: '—', to: '放不下', color: null, note: '麵包板空間不夠' });
      sigs.filter(s => s.i === i && s.g).forEach(s => used.delete(s.g));
      return;
    }
    const lane = side, S = SIDE[lane]; side = S.bb;
    const c0 = cursor[lane] + (hasRes ? 2 : 0) + Math.floor((fp - (hasRes ? 2 : 0) - 1 - n) / 2);
    cursor[lane] += fp;
    const at = `${side}:${S.modRow}${c0}`;
    const mod = Object.assign({ id: i.uid, name: d.name + (i.multi ? ' #' + i.n : ''), short: i.label, at, pins: d.pins.map(p => p[0]), desc: d.desc }, d.model || {});
    if (d.model && d.model.type === 'generic') mod.type = 'generic';
    R.modules.push(mod);
    const free = {};                            // 每一欄還有哪些孔
    const freeRow = col => { const f = (free[col] = free[col] || S.wireRows.slice()); return f.shift(); };
    R.steps.push({ title: `插上 ${i.label}`, modules: [i.uid], text: `${d.name} 插${S.name}麵包板${S.half} ${S.modRow}${c0}–${S.modRow}${c0 + n - 1}，左到右 ${d.pins.map(p => p[0]).join('、')}。腳序以絲印為準。` });
    const cal = [];
    if (d.tbd) R.tbd.push(`${i.label}：${d.tbd}`);
    d.pins.forEach((p, pi) => {
      const [pn, k, pnote, role, warn5, resVal] = p;
      const col = c0 + pi, mh = { bb: side, row: S.modRow, col };
      const wid = `${i.uid}_${pi}`;
      const lab = `${i.label} ${pn}`;
      if (k === 'nc') { R.rows.push({ part: i.label, pin: pn, to: '不接', color: null, note: pnote || '' }); return; }
      if (k === 'gnd' || k === 'vcc') {
        const volt = k === 'gnd' ? 'GND' : d.v;
        const f = rail(lane, volt); if (!f.ok) return;
        const rh = railHole(f.bb, f.row, col), th = { bb: side, row: freeRow(col), col };
        if (!rh || !th.row) { R.warns.push(`${lab}：電源軌沒有空孔`); return; }
        const c = volt === 'GND' ? COL.g : volt === '5V' ? COL.r5 : COL.r3;
        const w = { id: wid, label: lab, func: volt === 'GND' ? 'gnd' : 'pwr', color: c[0], from: hs(rh), to: hs(th), modPin: pn, via: `${f.name}（${volt}）`, note: pnote || (volt === '5V' ? '5V 零件' : '') };
        R.wires.push(w);
        R.steps.push({ title: `${lab} → ${volt}`, wires: [wid], text: `從 ${WD.holeName(th)}（${lab} 同一欄）接到 ${WD.holeName(rh)}（${volt}）。` });
        R.rows.push({ part: i.label, pin: pn, to: `${volt}（經${f.name}）`, color: c, note: pnote || '', wid });
        return;
      }
      // 訊號腳
      let g = null, roleName = role || '', c;
      const busKey = { sda: 'sda', scl: 'scl', sck: 'sck', mosi: 'mosi', miso: 'miso' }[k];
      if (busKey) { g = bus[busKey]; c = COL[busKey]; roleName = busKey.toUpperCase(); }
      else { const s = sigOf(i, pi); g = s && s.g; c = role && COL[role] ? COL[role] : PAL[palI++ % PAL.length]; }
      if (!g) { R.rows.push({ part: i.label, pin: pn, to: '⚠ 沒有腳位', color: null, note: k === 'adc' ? 'ADC1 用完了' : 'GPIO 不夠' }); return; }
      const gp = gpioOf(B, g);
      const th = { bb: side, row: freeRow(col), col };
      let from = null, via = null;
      if (resVal) {                             // LED：GPIO → 電阻欄 → 220Ω → A
        const rc = col - 2, rmh = { bb: side, row: S.wireRows[0], col: rc };
        const bh = boardHole(g, side === 'L' ? 'top' : 'bottom');
        if (!bh) { R.warns.push(`${lab}：GPIO${gp} 那一欄沒有空孔`); return; }
        const w = { id: wid, label: `${lab}（GPIO${gp}）`, func: 'sig', color: c[0], from: hs(bh), to: hs(rmh), pin: g, via: `電阻欄 ${WD.holeName(rmh)}（再經 ${resVal} 到 ${pn}）` };
        const rw = { id: wid + '_r', kind: 'resistor', label: `${resVal} 電阻`, from: `${side}:${S.wireRows[1]}${rc}`, to: `${side}:${S.wireRows[1]}${col}`, value: resVal, note: `${i.label} 的限流電阻：一腳在 ${rc} 欄，一腳在 ${pn}（${col} 欄）` };
        R.wires.push(w, rw); free[col] = S.wireRows.filter(r => r !== S.wireRows[1]);
        R.steps.push({ title: `${lab} → GPIO${gp}`, wires: [wid], text: `從 ${WD.holeName(bh)}（GPIO${gp}）接到 ${WD.holeName(rmh)}（空的一欄，等一下插電阻）。` });
        R.steps.push({ title: `插 ${resVal} 電阻`, wires: [rw.id], text: `電阻一腳插 ${rw.from.slice(2)}、一腳插 ${rw.to.slice(2)}（跟 ${lab} 同一欄），電阻不分方向。` });
        R.rows.push({ part: i.label, pin: pn, to: `GPIO${gp}（經 ${resVal}）`, color: c, note: pnote || '', wid });
        R.defs.push([`${i.pfx}_PIN`, gp, `${d.name}${i.multi ? ' #' + i.n : ''}（經 ${resVal}）`]);
        R.setup.push(`pinMode(${i.pfx}_PIN, OUTPUT);`);
        cal.push(`${pn}→${gp}`);
        return;
      }
      if (busKey) {
        const prev = busPrev[busKey];
        const bh = boardHole(g, side === 'L' ? 'top' : 'bottom');
        if (bh) from = bh;
        else if (prev) { from = prev.hole; via = `接到 ${prev.label} 同一欄（${roleName} 共用）`; }
        else { R.warns.push(`${lab}：GPIO${gp} 那一欄沒有空孔`); return; }
      } else {
        from = boardHole(g, side === 'L' ? 'top' : 'bottom');
        if (!from) { R.warns.push(`${lab}：GPIO${gp} 那一欄沒有空孔`); return; }
      }
      const w = { id: wid, label: `${lab}${roleName && busKey ? '（' + roleName + '）' : ''}`, func: 'sig', color: c[0], from: hs(from), to: hs(th), modPin: pn, note: pnote || '' };
      if (!via) w.pin = g; else w.via = via;
      if (warn5) { w.status = 'tbd'; w.tbd = '這支是 5V 輸出：用 1kΩ（串）＋2kΩ（到 GND）分壓成 3.3V 再進 GPIO'; }
      R.wires.push(w);
      if (busKey) { const nx = { bb: side, row: (free[col] || [])[0], col }; if (nx.row) busPrev[busKey] = { hole: nx, label: lab }; if (nx.row) free[col].shift(); }
      R.steps.push({ title: `${lab} → GPIO${gp}${busKey ? '（' + roleName + '）' : ''}`, wires: [wid], text: via ? `從 ${WD.holeName(from)}（${via}）接到 ${WD.holeName(th)}。` : `從 ${WD.holeName(from)}（GPIO${gp}）接到 ${WD.holeName(th)}（${lab} 同一欄）。`, warn: warn5 ? w.tbd : '' });
      const shared = busKey ? `${roleName}，I2C／SPI 共用` : '';
      R.rows.push({ part: i.label, pin: pn, to: `GPIO${gp}${busKey ? '（' + roleName + '）' : ''}`, color: c, note: [shared, pnote, warn5 ? '⚠ 要分壓' : ''].filter(Boolean).join('；'), wid });
      if (!busKey) {
        const nSig = d.pins.filter(q => ['adc', 'in', 'inpu', 'out', 'io'].includes(q[1])).length;
        const nm = nSig === 1 ? `${i.pfx}_PIN` : `${i.pfx}_${(role || pn).replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'PIN' + pi}`;
        R.defs.push([nm, gp, `${d.name}${i.multi ? ' #' + i.n : ''} ${pn}`]);
        if (k === 'inpu') R.setup.push(i.pull ? `pinMode(${nm}, INPUT);          // 外接 10k 上拉` : `pinMode(${nm}, INPUT_PULLUP);   // 按下／觸發＝LOW`);
        else if (k === 'in') R.setup.push(`pinMode(${nm}, INPUT);`);
        else if (k === 'out' && i.t === 'relay') R.setup.push(`digitalWrite(${nm}, RELAY_OFF); pinMode(${nm}, OUTPUT);  // 先設關再 OUTPUT`);
        else if (k === 'out' && !role) R.setup.push(`pinMode(${nm}, OUTPUT);`);
        if (k === 'adc') R.loop.push(`int ${nm.toLowerCase()} = analogReadMilliVolts(${nm});`);
      }
      cal.push(`${pn}→${gp}`);
      // 外接上拉
      if (k === 'inpu' && i.pull) {
        const f = rail(lane, '3V3');
        const rh = f.ok && railHole(f.bb, f.row, col), rr = freeRow(col);
        if (rh && rr) {
          const rw = { id: wid + '_pu', kind: 'resistor', label: '10k 上拉', from: `${side}:${rr}${col}`, to: hs(rh), value: '10kΩ', note: `${lab} 上拉到 3V3` };
          R.wires.push(rw);
          R.steps.push({ title: `插 10k 上拉（${lab}）`, wires: [rw.id], text: `10k 一腳插 ${WD.holeName({ bb: side, row: rr, col })}（${lab} 同一欄）、一腳插 ${WD.holeName(rh)}（3V3 軌）。` });
          R.rows.push({ part: i.pull.label, pin: '兩腳', to: `${lab} ↔ 3V3`, color: null, note: '10kΩ 上拉電阻', wid: rw.id });
        }
      }
    });
    // 零件附帶的電阻（DS18B20 4.7k）
    if (d.res) {
      const ai = d.pins.findIndex(p => p[0] === d.res.a), bi = d.pins.findIndex(p => p[0] === d.res.b);
      const ra = freeRow(c0 + ai), rb = freeRow(c0 + bi);
      if (ra && rb) {
        const rw = { id: i.uid + '_res', kind: 'resistor', label: `${d.res.value} 電阻`, from: `${side}:${ra}${c0 + ai}`, to: `${side}:${rb}${c0 + bi}`, value: d.res.value, note: d.res.note };
        R.wires.push(rw);
        R.steps.push({ title: `插 ${d.res.value} 上拉（${i.label}）`, wires: [rw.id], text: `電阻一腳插 ${rw.from.slice(2)}（${d.res.a}）、一腳插 ${rw.to.slice(2)}（${d.res.b}）。` });
        R.rows.push({ part: i.label, pin: `${d.res.a}–${d.res.b}`, to: d.res.value + ' 電阻', color: null, note: d.res.note, wid: rw.id });
      }
    }
    if (d.lib) R.libs.push(`${i.label}：${d.lib}`);
    if (R.callouts.length < 6) R.callouts.push({ target: 'module:' + i.uid, title: i.label, text: cal.join('・') || d.v, dx: side === 'L' ? 30 : 20, dy: lane === 'LA' ? -90 : lane === 'RB' ? 60 : -40 });
  });
  // 程式
  const code = [];
  code.push(`// 接線實驗室・自己組（自動產生）`);
  code.push(`// 板子：${B.name}`);
  code.push(`// 只有腳位定義和初始化骨架，函式庫請自己裝。腳序以零件絲印為準。`);
  if (need.i2c) code.push('#include <Wire.h>');
  if (need.spi) code.push('#include <SPI.h>');
  code.push('');
  if (need.i2c) code.push('// I2C 共用（所有 I2C 裝置接同一組 SDA／SCL）', `#define I2C_SDA  ${gpioOf(B, bus.sda)}`, `#define I2C_SCL  ${gpioOf(B, bus.scl)}`);
  if (need.spi) code.push('// SPI 共用（SCK／MOSI 共用，每個裝置自己一支 CS）', `#define SPI_SCK  ${gpioOf(B, bus.sck)}`, `#define SPI_MOSI ${gpioOf(B, bus.mosi)}`, need.miso ? `#define SPI_MISO ${gpioOf(B, bus.miso)}` : '#define SPI_MISO -1   // 沒有裝置要讀回');
  if (insts.some(i => i.t === 'relay')) code.push('#define RELAY_ACTIVE_LOW 1   // 藍色常見款是低電位觸發；實測後再改', '#define RELAY_ON  (RELAY_ACTIVE_LOW ? LOW : HIGH)', '#define RELAY_OFF (RELAY_ACTIVE_LOW ? HIGH : LOW)');
  if (R.defs.length) { code.push('', '// 零件'); const w = Math.max(...R.defs.map(d => d[0].length)); R.defs.forEach(d => code.push(`#define ${d[0].padEnd(w)} ${String(d[1]).padEnd(3)} // ${d[2]}`)); }
  code.push('', 'void setup() {', '  Serial.begin(115200);');
  if (need.i2c) code.push('  Wire.begin(I2C_SDA, I2C_SCL);');
  if (need.spi) code.push('  SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI);');
  R.setup.forEach(s => code.push('  ' + s));
  if (R.loop.length) code.push('  analogReadResolution(12);');
  code.push('}', '', 'void loop() {');
  R.loop.forEach(s => code.push('  ' + s));
  code.push('  delay(500);', '}');
  if (R.libs.length) { code.push('', '// 建議函式庫：'); R.libs.forEach(s => code.push('//   ' + s)); }
  // 注意事項
  const safety = ['接線、拔插模組前一定先拔 USB。', '3.3V 零件只接 3V3（紅線、＋軌）；右下＋軌是 5V（橘線），只給 5V 零件。', ...PROF[st.board].rules.map(s => '腳位規則：' + s)];
  const has = t => insts.some(i => i.t === t);
  if (has('sonar')) safety.push('⚠ 超音波（HC-SR04／JSN-SR04T）的 Echo 是 5V：要分壓（Echo─1kΩ─GPIO，GPIO─2kΩ─GND）才能進 ESP32，不然會傷腳。圖上這條線標「待確認」。');
  if (has('ws2812')) safety.push('⚠ WS2812 吃 5V、資料是 3.3V：短線通常可以，不穩就加 74AHCT125 電平轉換；DIN 前串 330Ω，5V／GND 間並 1000µF；燈多要另接 5V 電源並共地。');
  if (has('sg90')) safety.push('⚠ SG90 啟動電流可到 500mA 以上，USB 5V 可能撐不住讓板子重開，建議另接 5V 電源，GND 要共地。');
  if (has('relay')) safety.push('⚠ 繼電器模組 5V 線圈；3.3V 控制低觸發款可能一直吸住，先實測。練習階段不要接 110V 市電。');
  if (has('rcwl0516') || has('pir501')) safety.push('RCWL-0516／HC-SR501 用 5V 供電，但 OUT 是 3.3V，可以直接進 GPIO。');
  if (st.board === 'devkitc38') safety.push('DevKitC 不是 Ian 手上的板子，腳序照 Espressif 官方圖，接之前對絲印。');
  R.warns.forEach(s => safety.unshift('⚠ ' + s));
  Object.assign(proj, {
    board: { type: st.board, top: 'L:J2', bottom: 'R:C2' },
    modules: R.modules, wires: R.wires, steps: R.steps, callouts: R.callouts,
    code: code.join('\n'), safety, tbd: ['所有模組腳序依常見版本畫，實際以絲印為準。'].concat(R.tbd),
    sources: '自動配線規則：Espressif ESP32-S3／ESP32 技術手冊的 strap、ADC1／ADC2、Flash／PSRAM 腳說明；板子腳序見 js/boards.js。'
  });
  proj.title = `自己組：${B.short}`;
  proj.subtitle = `${B.short}・${insts.length} 個零件・${R.wires.filter(w => w.kind !== 'resistor').length} 條線`;
  proj.subtitleShort = `${B.short}・${insts.length} 個零件`;
  proj._R = R;
}

// ---------- 畫面 ----------
function tableHTML(C) {
  const R = C.proj._R || { rows: [] };
  if (!C.proj.board) return '<p class="hint">還沒選開發板。到「組裝」分頁先選一塊板子，再加零件，這裡就會自動出腳位表。</p>';
  if (!R.rows.length) return '<p class="hint">還沒加零件。到「組裝」分頁從零件庫加模組。</p>';
  const sw = c => c ? `<i class="sw" style="background:${c[0]}"></i>${c[1]}` : '—';
  return `<p class="hint">自動分配的腳位。點一列會在 3D 標出那條線。線色是建議色（紅 3V3、橘 5V、黑 GND），不一定是你手上跳線的顏色。</p><div class="tw"><table class="bt"><thead><tr><th>零件</th><th>零件腳</th><th>接到板子腳位</th><th>線色</th><th>備註</th></tr></thead><tbody>${R.rows.filter(r => r.part === '電源軌').concat(R.rows.filter(r => r.part !== '電源軌')).map(r => `<tr${r.wid ? ` data-w="${esc(r.wid)}"` : ''}><td>${esc(r.part)}</td><td><b>${esc(r.pin)}</b></td><td><b>${esc(r.to)}</b></td><td>${sw(r.color)}</td><td>${esc(r.note)}</td></tr>`).join('')}</tbody></table></div>
  <div class="bt-act"><button id="b-copytab">複製腳位表（Tab 分隔）</button></div>`;
}
function introHTML(C) {
  const R = C.proj._R || { warns: [] };
  const n = st.parts.length;
  if (!st.board) return `<div class="sh"><span class="big">＋</span><div><b>自己組：空白麵包板</b><small>先選開發板，再加模組，會自動拉線、出腳位表</small></div></div><p>到下面「組裝」分頁：① 選開發板 ② 從零件庫按「＋」加模組。範例專案在最下面。</p>`;
  return `<div class="sh"><span class="big">${C.steps.length}</span><div><b>${esc(C.B.short)}・${n} 個零件</b><small>按「下一步」一條一條接；「組裝」分頁可再加零件</small></div></div>${R.warns.length ? `<div class="sw2">⚠ ${esc(R.warns[0])}${R.warns.length > 1 ? `（還有 ${R.warns.length - 1} 個警告，見「組裝」）` : ''}</div>` : `<p>腳位已自動分配：類比走 ADC1、避開 strap／Flash／PSRAM／USB 腳，I2C／SPI 共用匯流排。</p>`}`;
}
let firstRender = true;
function onRender(C) {
  const tab = document.getElementById('tab-build'); if (!tab) return;
  const R = C.proj._R || { warns: [] };
  const counts = {}; st.parts.forEach(p => counts[p.t] = (counts[p.t] || 0) + 1);
  const boards = BOARD_ORDER.filter(b => WD.BOARDS[b.id]).map(b => `<button class="bopt${st.board === b.id ? ' on' : ''}" data-b="${b.id}"><b>${esc(WD.BOARDS[b.id].name)}</b><small>${esc(b.desc)}</small></button>`).join('');
  const lib = CATS.map(([cid, cname]) => `<div class="pcat"><h4>${cname}</h4><div class="plist">${Object.entries(PARTS).filter(([, d]) => d.cat === cid).map(([t, d]) => `<button class="padd" data-t="${t}" ${st.board ? '' : 'disabled'} title="${esc(d.desc)}"><span>＋ ${esc(d.name)}</span>${d.v ? `<em class="v${d.v === '5V' ? ' v5' : ''}">${d.v}</em>` : ''}${counts[t] ? `<em class="cnt">×${counts[t]}</em>` : ''}</button>`).join('')}</div></div>`).join('');
  const insts = st.parts.map((p, k) => { const d = PARTS[p.t]; const same = st.parts.filter(q => q.t === p.t); const lbl = d.short + (same.length > 1 ? ' #' + (same.indexOf(p) + 1) : ''); const pins = (R.rows || []).filter(r => r.part === lbl && /GPIO/.test(r.to)).map(r => `${r.pin}→${r.to.replace(/（.*$/, '')}`).join('、'); return `<li><span><b>${esc(lbl)}</b><small>${esc(d.name)}${pins ? '・' + esc(pins) : ''}</small></span><button class="prm" data-k="${k}" title="移除">✕</button></li>`; }).join('');
  tab.innerHTML = `
    <div class="bsec"><h3>① 開發板</h3><div class="blist">${boards}</div><p class="hint">Arduino Uno 外形插不上這組雙麵包板，先不放。</p></div>
    <div class="bsec"><h3>② 已加的零件 <small>${st.parts.length} 個</small></h3>${st.parts.length ? `<ul class="plist2">${insts}</ul>` : `<p class="hint">${st.board ? '還沒加零件，從下面零件庫按「＋」。' : '先選開發板。'}</p>`}
      <div class="bt-act"><button id="b-clear" class="ghost" ${st.board || st.parts.length ? '' : 'disabled'}>清空</button></div></div>
    ${R.warns.length ? `<div class="box bad"><b>⚠ 注意</b><ul>${R.warns.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
    <div class="bsec"><h3>③ 零件庫</h3>${st.board ? '' : '<p class="hint">先選開發板才能加零件。</p>'}${lib}</div>
    <details class="bsec"><summary>自動配線規則</summary><ul class="rules"><li>電源預設 3V3（紅線）；只有伺服馬達、繼電器、WS2812、超音波、PIR、雷達用 5V（橘線、右下＋軌）。</li><li>類比輸出只接 ADC1（Wi‑Fi 開著 ADC2 不能讀）。</li><li>I2C 裝置共用 SDA／SCL；SPI 裝置共用 SCK／MOSI，各自一支 CS、DC、RES。</li><li>電阻跟著主零件：LED 串 220Ω、DS18B20 的 DQ 上拉 4.7k、按鈕可加 10k 上拉。</li>${st.board ? PROF[st.board].rules.map(s => `<li>${esc(s)}</li>`).join('') : ''}<li>腳位不夠時會在上面列出警告。</li></ul></details>
    <p class="hint">組好的內容存在這台瀏覽器（localStorage），重開網頁還在。</p>`;
  tab.querySelectorAll('.bopt').forEach(b => b.onclick = () => { st.board = b.dataset.b; commit(); });
  tab.querySelectorAll('.padd').forEach(b => b.onclick = () => { st.parts.push({ id: 'p' + (++st.seq), t: b.dataset.t }); commit(); });
  tab.querySelectorAll('.prm').forEach(b => b.onclick = () => { st.parts.splice(+b.dataset.k, 1); commit(); });
  const clr = tab.querySelector('#b-clear'); if (clr) clr.onclick = () => { if (!confirm('清空板子和所有零件？')) return; st = { board: null, parts: [], seq: 0 }; commit(); };
  const ct = document.getElementById('b-copytab');
  if (ct) ct.onclick = () => { const txt = ['零件\t零件腳\t接到板子腳位\t線色\t備註'].concat((R.rows || []).map(r => [r.part, r.pin, r.to, r.color ? r.color[1] : '', r.note].join('\t'))).join('\n'); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { ct.textContent = '已複製'; }).catch(() => { ct.textContent = '複製失敗'; }); };
  if (firstRender) { firstRender = false; const b = document.querySelector('.tabs button[data-t=build]'); if (b) b.click(); }
}
function commit() {
  save(); generate();
  const scroll = (document.getElementById('tab-build') || {}).scrollTop || 0;
  if (WD.reload) WD.reload();
  const tab = document.getElementById('tab-build'); if (tab) tab.scrollTop = scroll;
}

// ---------- 註冊 ----------
const proj = {
  id: 'build', builder: true, title: '自己組：空白麵包板', short: '自己組', status: 'ok',
  board: null, modules: [], wires: [], steps: [], tableHTML, introHTML, onRender,
  intro: '選開發板、加模組，會自動分配腳位、拉線、出腳位表。'
};
WD.projects.unshift(proj);
load(); generate();
// 給 tools/validate.js 和截圖用
WD.builder = { set(board, types) { st = { board, parts: types.map((t, k) => ({ id: 'p' + (k + 1), t })), seq: types.length }; generate(); return proj; }, apply(board, types) { this.set(board, types); save(); if (WD.reload) WD.reload(); }, PARTS, PROF, state: () => st };
})();
