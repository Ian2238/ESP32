/* 魚缸控制盤 v0.1：2.4吋 UNO 觸控屏＋浮球液位（說話機器人 S3）
 * 板子：一般 44 腳 ESP32-S3 N16R8（FTDI 序號 A5069RR4A、MAC 68:ee:8f:4b:fa:58），腳序同 js/boards.js 的 s3_44，Ian 固定雙麵包板模板。
 * 注意：UNO 擴充板不是插在麵包板上，是用杜邦線從擴充板腳接到左板孔；3D 圖裡右板 R:I30–I44 的「擴充板」只是把 15 支腳排成一排的示意。
 * 完整 2D 接線圖／Wokwi／腳位表／韌體：examples/aquarium-panel/
 */
WD.addProject({
  id: 'aquarium-panel',
  title: '魚缸控制盤 v0.1：2.4吋 UNO 觸控屏＋浮球液位（說話機器人 S3）',
  short: '魚缸控制盤 v0.1',
  subtitle: '2.4吋 UNO 觸控 TFT・浮球開關・智慧插座',
  status: 'ok',
  intro: '一般 44 腳 S3（說話機器人板，OLED 已拆）。2.4吋 UNO 觸控 TFT 擴充板用 8 位元並列：RS4 CS5 WR6 RD7 RST15、D0–D7＝8,9,10,11,12,13,16,17，5V 接 5Vin、GND 接 GND，觸控共用 RS／CS／D0／D1。浮球開關兩線：一條 GPIO18，一條 GND。水泵／燈／風扇／加熱器用 Wi‑Fi 智慧插座（Shelly／Tasmota，區網 HTTP），麵包板上沒有 110V。完整圖、Wokwi、腳位表在 examples/aquarium-panel/。',
  board: { type: 's3_44', top: 'L:J2', bottom: 'R:C2' },
  modules: [
    { id: 'shield', type: 'generic', name: '2.4吋 UNO 觸控 TFT 擴充板（8 位元並列，以杜邦線接到左板孔；這裡把 15 支腳排成一排示意）', short: 'UNO 擴充板', at: 'R:I30',
      pins: ["GND", "5V", "D5", "D4", "D3", "D2", "D1", "D0", "D7", "D6", "RST", "RD", "WR", "CS", "RS"], label: 'UNO TFT', pcbColor: '#7a1f1f', height: 1.6,
      desc: '實物不是插在麵包板上：用杜邦線從擴充板腳接到左板孔（見接線表「板子腳位」）。SD 卡 4 腳、F_CS、3.3V 腳不接。驅動晶片未確認（Ian 說 ILI9341），韌體讀 ID 後印出。' },
    { id: 'float', type: 'generic', name: '浮球開關（2 線，不分極性）', short: '浮球', at: 'R:I52', pins: ['A', 'B'], label: '浮球', pcbColor: '#00695c', height: 1.2,
      desc: '兩線只有開／關。GPIO18 內部上拉：LOW＝接點閉合。高低水位對應哪個狀態待確認（看浮球朝上或朝下裝）。', status: 'tbd' }
  ],
  wires: [
    { id: "s_gnd", label: "擴充板 GND", func: "gnd", from: "L:I2", to: "R:G30", pin: "GND", modPin: "GND" },
    { id: "s_5v", label: "擴充板 5V", func: "pwr", from: "L:I3", to: "R:G31", pin: "5Vin", modPin: "5V", note: "5V 只接擴充板的 5V 腳（左板第 3 欄 5Vin），不接擴充板 3.3V 腳" },
    { id: "s_d5", label: "擴充板 LCD_D5", func: "sig", color: "#2c6fd6", from: "L:I5", to: "R:G32", pin: "13", modPin: "D5" },
    { id: "s_d4", label: "擴充板 LCD_D4", func: "sig", color: "#2e9b3e", from: "L:I6", to: "R:G33", pin: "12", modPin: "D4" },
    { id: "s_d3", label: "擴充板 LCD_D3", func: "sig", color: "#e6c200", from: "L:I7", to: "R:G34", pin: "11", modPin: "D3" },
    { id: "s_d2", label: "擴充板 LCD_D2", func: "sig", color: "#f08a00", from: "L:I8", to: "R:G35", pin: "10", modPin: "D2" },
    { id: "s_d1", label: "擴充板 LCD_D1", func: "sig", color: "#e02020", from: "L:I9", to: "R:G36", pin: "9", modPin: "D1" },
    { id: "s_d0", label: "擴充板 LCD_D0", func: "sig", color: "#8b5a2b", from: "L:I12", to: "R:G37", pin: "8", modPin: "D0" },
    { id: "s_d7", label: "擴充板 LCD_D7", func: "sig", color: "#808080", from: "L:I14", to: "R:G38", pin: "17", modPin: "D7" },
    { id: "s_d6", label: "擴充板 LCD_D6", func: "sig", color: "#8e44ad", from: "L:I15", to: "R:G39", pin: "16", modPin: "D6" },
    { id: "s_rst", label: "擴充板 LCD_RST", func: "sig", color: "#b8860b", from: "L:I16", to: "R:G40", pin: "15", modPin: "RST", note: "LCD_RST 接 GPIO15（左16），不是左21 的 RST/EN" },
    { id: "s_rd", label: "擴充板 LCD_RD", func: "sig", color: "#a0a0a0", from: "L:I17", to: "R:G41", pin: "7", modPin: "RD" },
    { id: "s_wr", label: "擴充板 LCD_WR", func: "sig", color: "#5b3fa0", from: "L:I18", to: "R:G42", pin: "6", modPin: "WR" },
    { id: "s_cs", label: "擴充板 LCD_CS", func: "sig", color: "#d81b8c", from: "L:I19", to: "R:G43", pin: "5", modPin: "CS" },
    { id: "s_rs", label: "擴充板 LCD_RS", func: "sig", color: "#00a8a8", from: "L:I20", to: "R:G44", pin: "4", modPin: "RS" },
    { id: "float_sig", label: "浮球 線A（訊號）", func: "sig", color: "#00897b", from: "L:I13", to: "R:G52", pin: "18", modPin: "A", note: "GPIO18 INPUT_PULLUP：LOW＝接點閉合", status: 'tbd', tbd: "高水位／低水位對應 HIGH 或 LOW，取決於浮球朝上或朝下裝" },
    { id: "float_gnd", label: "浮球 線B（GND）", func: "gnd", from: "R:D3", to: "R:G53", pin: "GND", modPin: "B", note: "右板第 3 欄 C3 是 GND，用 D 排孔；與擴充板 GND（左I2）不同孔" }
  ],
  callouts: [
    { target: 'board', title: '說話機器人 S3', text: 'ESP32-S3 N16R8，OLED 已拆。腳位固定，見接線表。', dx: -60, dy: 110 },
    { target: 'module:shield', title: 'UNO 觸控 TFT', text: '8 位元並列：D0–D7＝8,9,10,11,12,13,16,17；RS4 CS5 WR6 RD7 RST15。5V 接 5Vin。', dx: 40, dy: -80 },
    { target: 'module:float', title: '浮球開關', text: '線A→GPIO18（INPUT_PULLUP）、線B→GND。高低水位對應待確認。', color: '#c2410c', dx: 40, dy: -50 }
  ],
  safety: [
    '接線、拔線前先拔掉 USB。',
    '擴充板 5V 腳接板子的 5Vin（左板第 3 欄），擴充板的 3.3V 腳不接。浮球兩線只接 GPIO18 與 GND，不接任何電壓。',
    '水泵／燈／風扇／加熱器用 Wi‑Fi 智慧插座（Shelly／Tasmota，區網 HTTP 控制）。麵包板與擴充板上不要有任何 110V 市電線。',
    'LCD_RST 接 GPIO15（左板第 16 欄），不是左板第 21 欄的 RST／EN。',
    '不要用 0、3、45、46（strap）、19、20（USB）、35–37（OPI PSRAM）。',
  ],
  tbd: [
    '擴充板腳序以 Ian 回報的背面絲印為準，沒有看到照片；驅動晶片是否為 ILI9341 待確認（韌體讀 0xD3 ID，不是 0x9341 會警告）。',
    '浮球型號、極性、高水位／低水位對應 HIGH 或 LOW，取決於浮球朝上或朝下裝，待確認。',
    '觸控腳位（RS／CS／D0／D1 哪些是 X、Y）由韌體自動偵測＋校正；未在實機驗證。',
    '韌體只編譯過、未燒錄；觸控切換時釋放／重建 LovyanGFX 並列匯流排，未在真機驗證。'
  ],
  sources: 'Ian 固定麵包板模板（左J 第2→23欄、右C 第2→23欄）；腳位表與 2D 圖：examples/aquarium-panel/。尚未實機。',
  introHTML: (C) => `<div class="sh"><span class="big">${C.steps.length}</span><div><b>魚缸控制盤 v0.1</b><small>按「下一步」一條一條接</small></div></div><p>2.4吋 UNO 觸控 TFT（8 位元並列）＋浮球開關，接在說話機器人 S3。水泵／燈／風扇／加熱器用 Wi‑Fi 智慧插座，麵包板上沒有 110V。</p><p><a href="examples/aquarium-panel/" target="_blank" rel="noopener"><b>完整 2D 接線圖、Wokwi、腳位表、韌體 ›</b></a></p>`,
  code: `// 魚缸控制盤 v0.1 腳位（uno-touch-shield-s3 v0.2）
// 2.4吋 UNO 觸控 TFT 擴充板（8 位元並列）
#define PIN_LCD_RS   4
#define PIN_LCD_CS   5
#define PIN_LCD_WR   6
#define PIN_LCD_RD   7
#define PIN_LCD_RST  15
#define PIN_LCD_D0   8   // D0..D7 = 8, 9, 10, 11, 12, 13, 16, 17
#define PIN_LCD_D1   9
#define PIN_LCD_D2   10
#define PIN_LCD_D3   11
#define PIN_LCD_D4   12
#define PIN_LCD_D5   13
#define PIN_LCD_D6   16
#define PIN_LCD_D7   17
// 觸控共用 RS、CS、D0、D1（電阻式四線，韌體自動偵測腳位＋三點校正）
// 浮球開關：一線 GPIO18、一線 GND
#define PIN_FLOAT_SWITCH 18
void setup() {
  pinMode(PIN_FLOAT_SWITCH, INPUT_PULLUP);   // LOW＝接點閉合，HIGH＝打開
}
void loop() {
  bool closed = (digitalRead(PIN_FLOAT_SWITCH) == LOW);  // 高低水位對應哪個狀態：待確認
  delay(50);
}`
});
