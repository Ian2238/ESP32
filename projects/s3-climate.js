/* 新板小專案：0.96 吋 7 針 SPI OLED＋DHT11＋HW-498 NTC
 * 板子：家用電腦 COM10、原生 USB、MAC 90:70:69:ea:64:54、16MB Flash、晶片內建 8MB PSRAM（esptool：Embedded PSRAM 8MB (AP_3v3)）。
 * 外形假設與蒙娜麗莎同一款 44 腳一般 S3（腳序見 js/boards.js），Ian 還沒拍這塊板的照片，外形待確認。
 */
WD.addProject({
  id: 's3-climate',
  title: '氣候站：OLED＋DHT11＋NTC（v0.1）',
  short: '氣候站 v0.1',
  subtitle: '0.96 吋 SPI OLED・DHT11・HW-498 NTC',
  status: 'ok',
  intro: '新的一塊 ESP32-S3（MAC 90:70:69:ea:64:54，COM10 原生 USB）。外形先照蒙娜麗莎那塊 44 腳板來畫：上排插左 J2–J23，下排插右 C2–C23，USB 朝左——實際外形還沒拍照，待確認。三個零件都接 3V3，不要接 5Vin。',
  board: { type: 's3_44', top: 'L:J2', bottom: 'R:C2' },
  modules: [
    { id: 'oled', type: 'oled', name: '0.96 吋 OLED（7 針 SPI SSD1306 128×64）', short: 'OLED', at: 'L:E40',
      pins: ['GND', 'VCC', 'D0', 'D1', 'RES', 'DC', 'CS'], screenText: '24.3C  56%',
      desc: '7 針 SPI：GND、VCC、D0（SCK）、D1（MOSI）、RES、DC、CS。VCC 只接 3V3。腳序以模組絲印為準。' },
    { id: 'dht', type: 'dht11', name: 'DHT11 溫濕度', short: 'DHT11', at: 'R:I40', pins: ['S', '+', '−'],
      desc: '三腳模組，左到右常見是 S、+、−（以絲印為準）。+ 只接 3V3。很多模組已有上拉電阻。' },
    { id: 'ntc', type: 'ntc', name: 'HW-498 NTC 熱敏電阻（黑滴型、三腳）', short: 'HW-498', at: 'R:I50', pins: ['S', '+', '−'], status: 'tbd',
      desc: '類比 NTC 模組，讀 ADC1（GPIO8）。腳序先照常見的 S、+、− 畫，實際以絲印為準，待確認。' }
  ],
  wires: [
    { id: 'oled_gnd', label: 'OLED GND', func: 'gnd', from: 'L:H2', to: 'L:D40', pin: 'GND', modPin: 'GND' },
    { id: 'oled_vcc', label: 'OLED VCC', func: 'pwr', from: 'L:I22', to: 'L:D41', pin: '3V3', modPin: 'VCC', note: '接 3V3，不要接 5Vin' },
    { id: 'oled_sck', label: 'OLED D0（SCK）', func: 'sig', color: '#f39c12', from: 'L:I6', to: 'L:D42', pin: '12', modPin: 'D0' },
    { id: 'oled_mosi', label: 'OLED D1（MOSI）', func: 'sig', color: '#27ae60', from: 'L:I7', to: 'L:D43', pin: '11', modPin: 'D1' },
    { id: 'oled_rst', label: 'OLED RES', func: 'sig', color: '#8e44ad', from: 'L:I5', to: 'L:D44', pin: '13', modPin: 'RES' },
    { id: 'oled_dc', label: 'OLED DC', func: 'sig', color: '#2980b9', from: 'L:I9', to: 'L:D45', pin: '9', modPin: 'DC' },
    { id: 'oled_cs', label: 'OLED CS', func: 'sig', color: '#e84393', from: 'L:I8', to: 'L:D46', pin: '10', modPin: 'CS' },
    { id: 'dht_s', label: 'DHT11 S（資料）', func: 'sig', color: '#f9a825', from: 'L:I17', to: 'R:G40', pin: '7', modPin: 'S', note: '左板第 17 欄 F–I 任一空孔都可' },
    { id: 'dht_v', label: 'DHT11 +', func: 'pwr', from: 'L:I23', to: 'R:G41', pin: '3V3', modPin: '+', note: '只接 3V3，不要接 5Vin' },
    { id: 'dht_g', label: 'DHT11 −', func: 'gnd', from: 'R:D3', to: 'R:G42', pin: 'GND', modPin: '−', note: '右板第 3 欄 D 或 E 都可' },
    { id: 'ntc_s', label: 'HW-498 S（類比）', func: 'sig', color: '#00897b', from: 'L:I12', to: 'R:G50', pin: '8', modPin: 'S', status: 'tbd', tbd: '腳序待確認：先看模組絲印，S 才是類比輸出。GPIO8＝ADC1，避開 ADC2。' },
    { id: 'ntc_v', label: 'HW-498 +', func: 'pwr', from: 'L:G22', to: 'R:G51', pin: '3V3', modPin: '+', status: 'tbd', tbd: '腳序待確認。只接 3V3。I22 已給 OLED 用，這裡用同一欄的 G22。', note: '只接 3V3，不要接 5Vin' },
    { id: 'ntc_g', label: 'HW-498 −', func: 'gnd', from: 'R:D2', to: 'R:G52', pin: 'GND', modPin: '−', status: 'tbd', tbd: '腳序待確認。' }
  ],
  steps: [
    { title: '拔 USB、放好板子', text: '先拔掉 USB。外形先照 44 腳一般 S3：上排插左麵包板 J2–J23，下排插右麵包板 C2–C23，USB 朝左。這塊新板還沒拍照，如果腳位排列不一樣就先停，不要硬接。', warn: '接線前一定先拔 USB。板子外形待確認。' },
    { title: '插上 OLED', modules: ['oled'], text: '0.96 吋 7 針 OLED 插左麵包板 E40–E46，左到右 GND、VCC、D0（SCK）、D1（MOSI）、RES、DC、CS，螢幕朝自己。先對一下絲印，有些模組腳序會不一樣。' },
    { title: 'OLED GND', wires: ['oled_gnd'], text: '黑線從左 H2（上排第 1 腳 GND）接到左 D40（和 OLED GND 同一欄）。' },
    { title: 'OLED VCC＝3V3', wires: ['oled_vcc'], text: '從左 I22（上排第 21 腳 3V3）接到左 D41。', warn: '只接 3V3，不要接第 3 欄的 5Vin。' },
    { title: 'OLED D0＝GPIO12（SCK）', wires: ['oled_sck'], text: '從左 I6（GPIO12）接到左 D42。' },
    { title: 'OLED D1＝GPIO11（MOSI）', wires: ['oled_mosi'], text: '從左 I7（GPIO11）接到左 D43。' },
    { title: 'OLED RES＝GPIO13', wires: ['oled_rst'], text: '從左 I5（GPIO13）接到左 D44。' },
    { title: 'OLED DC＝GPIO9', wires: ['oled_dc'], text: '從左 I9（GPIO9）接到左 D45。' },
    { title: 'OLED CS＝GPIO10', wires: ['oled_cs'], text: '從左 I8（GPIO10）接到左 D46。SPI 腳和蒙娜麗莎的 TFT 一樣：SCK12、MOSI11、CS10、DC9、RES13。' },
    { title: '插上 DHT11', modules: ['dht'], text: 'DHT11 橫插右麵包板 I40–I42，左到右常見是 S、+、−，感測窗朝外。先看絲印。' },
    { title: 'DHT11 S＝GPIO7', wires: ['dht_s'], text: '從左 I17（GPIO7）接到右 G40。很多 DHT11 模組板上已有上拉；如果是裸感測器，資料腳要再加 4.7k–10k 到 3V3。' },
    { title: 'DHT11 +＝3V3', wires: ['dht_v'], text: '從左 I23（另一支 3V3）接到右 G41。', warn: '+ 只接 3V3，接 5V 會讓資料腳電壓超過 3.3V。' },
    { title: 'DHT11 −＝GND', wires: ['dht_g'], text: '從右 D3（下排第 2 個 GND）接到右 G42。' },
    { title: '插上 HW-498', modules: ['ntc'], status: 'tbd', text: 'HW-498（黑色滴型熱敏電阻、三腳）插右麵包板 I50–I52。圖上先照常見的左到右 S、+、− 畫，實際腳序一定要看絲印，待確認。', warn: '腳序待確認，不要只靠這張圖插。' },
    { title: 'HW-498 S＝GPIO8（ADC1）', wires: ['ntc_s'], text: '從左 I12（GPIO8，ADC1）接到右 G50（S 那一欄）。類比腳必須走 ADC1，不要用 ADC2（GPIO11–20，開 Wi‑Fi 會不準）。', warn: '先確認這支腳的絲印是 S／AO／OUT，不是 + 或 −。' },
    { title: 'HW-498 +＝3V3', wires: ['ntc_v'], text: '從左 G22（和 OLED 同一組 3V3，I22 已有線）接到右 G51。', warn: '只接 3V3。' },
    { title: 'HW-498 −＝GND', wires: ['ntc_g'], text: '從右 D2（下排第 1 個 GND）接到右 G52。插回 USB 前再檢查一次：三個模組的電源都是 3V3，沒有接到 5Vin。' }
  ],
  callouts: [
    { target: 'board', title: 'ESP32-S3（新板）', text: '先照 44 腳外形畫，照片還沒到，待確認。MAC 90:70:69:ea:64:54。', dx: -60, dy: 110 },
    { target: 'usb', title: 'USB-C', text: '這塊目前用原生 USB（COM10）。接線前先拔掉。', dx: -40, dy: -130 },
    { target: 'antenna', title: '天線', text: '上面不要壓線。', dx: 30, dy: -120 },
    { target: 'module:oled', title: '0.96 吋 SPI OLED', text: 'D0＝12・D1＝11・CS＝10・DC＝9・RES＝13；VCC 接 3V3。', dx: 70, dy: -40 },
    { target: 'module:dht', title: 'DHT11', text: 'S→GPIO7、+→3V3、−→GND。', dx: 40, dy: 40 },
    { target: 'module:ntc', title: 'HW-498 NTC', text: 'S→GPIO8（ADC1）。腳序待確認。', color: '#c2410c', dx: 50, dy: -50 }
  ],
  safety: [
    '接線、拔線前先拔掉 USB。',
    'OLED 的 VCC、DHT11 的 +、HW-498 的 + 都接 3V3（左板第 22／23 欄），不要接第 3 欄的 5Vin。',
    '不要用 0、3、45、46（strap）、19、20（原生 USB）、35–37（這顆是 ESP32-S3R8，OPI PSRAM 佔用）。',
    'HW-498 是類比腳，只能接 ADC1（這裡用 GPIO8）。ADC2（GPIO11–20）開 Wi‑Fi 會不準，而且 11–13、9、10 已給 OLED 用。',
    '同一欄 A–E（或 F–J）五個孔是相通的，不同模組的腳不要插在同一欄。',
  ],
  tbd: [
    '這塊新板還沒拍照：外形先假設和蒙娜麗莎同一款 44 腳一般 S3。若實板腳序或 USB 位置不一樣，先不要接。',
    '兩個 USB-C 哪個是 CH343、哪個是原生 USB，上下位置待確認（目前是用原生 USB COM10）。',
    'HW-498 三腳腳序待確認（圖上先用常見的 S、+、−）。請對絲印，常見還有 −、+、S。',
    'NTC 先用 10k、B＝3950、分壓電阻 10k（NTC 在 3V3 側、10k 在 GND 側）來算溫度，標成待校正；實際電阻值和接法要對實物再校。',
    'DHT11 腳序以絲印為準；模組若沒有板上上拉，資料腳要加 4.7k–10k 到 3V3。',
    'OLED 7 針腳序以絲印為準，有些模組會對調 GND／VCC。'
  ],
  sources: '板腳序先沿用 monalisa-devtest-v16-ticker/wiring（44 腳一般 S3，外形待確認）。PSRAM：esptool 報 Embedded PSRAM 8MB (AP_3v3)，對應 ESP32-S3R8 封裝內 8MB 八線 PSRAM，編譯用 PSRAM=opi。零件與腳位是這次專案選定，尚未實機。',
  code: `// 氣候站 v0.1 腳位（/workspace/s3-climate-v01）
// OLED 7-pin SPI SSD1306  —— 腳跟蒙娜麗莎 TFT 同一組 SPI
constexpr int OLED_SCK = 12, OLED_MOSI = 11, OLED_CS = 10;
constexpr int OLED_DC  = 9,  OLED_RST  = 13;   // VCC 接 3V3，不要接 5V
constexpr int DHT_PIN  = 7;                    // DHT11 資料
constexpr int NTC_PIN  = 8;                    // HW-498 類比，ADC1；腳序待確認

#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>

Adafruit_SSD1306 oled(128, 64, &SPI, OLED_DC, OLED_RST, OLED_CS);
DHT dht(DHT_PIN, DHT11);

// NTC：10k、B=3950，假設分壓 10k 在 GND 側 —— 待校正
constexpr float NTC_R0 = 10000, NTC_B = 3950, NTC_T0 = 298.15, NTC_RREF = 10000;

void setup() {
  Serial.begin(115200);
  SPI.begin(OLED_SCK, -1, OLED_MOSI, OLED_CS);
  oled.begin(SSD1306_SWITCHCAPVCC);
  dht.begin();
  analogSetPinAttenuation(NTC_PIN, ADC_11db);
}

void loop() {
  // 每 2 秒更新：DHT 溫度／濕度＋NTC 溫度，序列埠也會印
  delay(2000);
}`,
  sim: {
    label: 'OLED 顯示溫濕度（示意）',
    run: async (api) => {
      const seq = [
        [24.3, 56, 23.8],
        [24.5, 55, 24.0],
        [24.8, 54, 24.2],
        [25.0, 54, 24.4]
      ];
      api.log('氣候站 v0.1 模擬開機…');
      api.pulse(['oled_sck', 'oled_mosi', 'oled_cs', 'oled_dc'], 4);
      api.log('[oled] SPI：SCK=GPIO12 MOSI=GPIO11 CS=GPIO10 DC=GPIO9 RES=GPIO13');
      await api.wait(800);
      for (let i = 0; i < 8 && api.running; i++) {
        const [dt, h, nt] = seq[i % seq.length];
        api.pulse(['dht_s'], 2);
        api.pulse(['ntc_s'], 2);
        api.pulse(['oled_sck', 'oled_mosi'], 3);
        api.screen('oled', (c, w, hgt) => {
          c.fillStyle = '#05070a'; c.fillRect(0, 0, w, hgt);
          c.fillStyle = '#7fd4ff'; c.textAlign = 'left'; c.textBaseline = 'middle';
          c.font = 'bold 22px sans-serif'; c.fillText('DHT  ' + dt.toFixed(1) + 'C  ' + h + '%', 16, hgt * 0.38);
          c.fillText('NTC  ' + nt.toFixed(1) + 'C', 16, hgt * 0.68);
        });
        api.log(`[dht] T=${dt.toFixed(1)}C H=${h}.0%`);
        api.log(`[ntc] T=${nt.toFixed(1)}C  (10k B=3950，待校正)`);
        await api.wait(1600);
      }
      api.log('模擬結束');
    }
  }
});
