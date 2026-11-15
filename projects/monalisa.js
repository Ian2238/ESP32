/* 蒙娜麗莎 v1.6 目前接線（一般 44 腳 ESP32-S3）
 * 來源：
 *  - TFT／RGB 孔位：monalisa-devtest-v05-sensors/wiring/gen3d.py（v0.5 圖，之後各版 TFT／RGB 線都沒動）
 *  - 腳位：monalisa-devtest-v16-ticker/monalisa_player/board_config.h
 *  - DHT11：monalisa-devtest-v16-ticker/wiring/README_zh-TW.md（預定，還沒接）
 * 孔位寫法 'L:I17' = 左麵包板 I 排第 17 欄；'R:G59' = 右麵包板 G 排第 59 欄。
 */
WD.addProject({
  id: 'monalisa',
  title: '蒙娜麗莎：目前接線（v1.6）',
  short: '蒙娜麗莎 v1.6',
  subtitle: '2.4 吋 TFT＋RGB 燈；DHT11 預定',
  status: 'ok',
  intro: '一般 44 腳 ESP32-S3 跨在兩塊麵包板中間：上排插左麵包板 J 排第 2–23 欄，下排插右麵包板 C 排第 2–23 欄，USB 在第 2 欄那一端。TFT 和 RGB 燈已經接好在用；DHT11 是預定，還沒接（圖上用條紋線表示）。',
  board: { type: 's3_44', top: 'L:J2', bottom: 'R:C2' },
  modules: [
    { id: 'tft', type: 'tft', name: '2.4 吋 TFT（ILI9341 240×320）', short: 'TFT', at: 'L:E50',
      pins: ['GND', 'VCC', 'SCL', 'SDA', 'RES', 'DC', 'CS', 'BLK'], screen: 'monalisa',
      desc: 'SPI 螢幕，背面標 MRD TFT240_8P_CS。VCC 和 BLK（背光）都接 3V3。' },
    { id: 'rgb', type: 'rgbled', name: 'RGB 燈 HW-478（共陰）', short: 'RGB', at: 'L:C30', pins: ['−', 'R', 'G', 'B'], ledColor: '#ffffff',
      desc: '共陰極 RGB，R／G／B 各串 220Ω，− 接 GND。' },
    { id: 'dht', type: 'dht11', name: 'DHT11 溫濕度（預定）', short: 'DHT11', at: 'R:I59', pins: ['S', '+', '−'], status: 'planned',
      desc: '三腳模組，左到右 S、+、−。+ 只能接 3V3。' }
  ],
  wires: [
    { id: 'tft_gnd', label: 'TFT GND', func: 'gnd', from: 'L:H2', to: 'L:D50', pin: 'GND', modPin: 'GND' },
    { id: 'tft_vcc', label: 'TFT VCC', func: 'pwr', from: 'L:I22', to: 'L:D51', pin: '3V3', modPin: 'VCC', note: '接 3V3，不要接 5V' },
    { id: 'tft_sck', label: 'TFT SCL（SPI 時脈）', func: 'sig', color: '#f39c12', from: 'L:I6', to: 'L:D52', pin: '12', modPin: 'SCL' },
    { id: 'tft_mosi', label: 'TFT SDA（SPI 資料）', func: 'sig', color: '#27ae60', from: 'L:I7', to: 'L:D53', pin: '11', modPin: 'SDA' },
    { id: 'tft_rst', label: 'TFT RES（重置）', func: 'sig', color: '#8e44ad', from: 'L:I5', to: 'L:D54', pin: '13', modPin: 'RES' },
    { id: 'tft_dc', label: 'TFT DC', func: 'sig', color: '#2980b9', from: 'L:I9', to: 'L:D55', pin: '9', modPin: 'DC' },
    { id: 'tft_cs', label: 'TFT CS', func: 'sig', color: '#e84393', from: 'L:I8', to: 'L:D56', pin: '10', modPin: 'CS' },
    { id: 'tft_blk', label: 'TFT BLK（背光）', func: 'pwr', color: '#c62828', from: 'L:I23', to: 'L:D57', pin: '3V3', modPin: 'BLK', note: '背光常亮，接 3V3' },
    { id: 'rgb_r', label: 'RGB R 跳線', func: 'sig', color: '#ff7043', from: 'L:I14', to: 'L:A34', pin: '17', via: '→ 220Ω → R' },
    { id: 'rgb_rr', kind: 'resistor', label: 'R 的 220Ω', value: '220Ω', from: 'L:A34', to: 'L:A31', modPin: 'R', func: 'sig', color: '#8d6e63', note: '串在 GPIO17 和 R 之間' },
    { id: 'rgb_g', label: 'RGB G 跳線', func: 'sig', color: '#2e7d32', from: 'L:I15', to: 'L:B35', pin: '16', via: '→ 220Ω → G' },
    { id: 'rgb_gr', kind: 'resistor', label: 'G 的 220Ω', value: '220Ω', from: 'L:B35', to: 'L:B32', modPin: 'G', func: 'sig', color: '#8d6e63', note: '串在 GPIO16 和 G 之間' },
    { id: 'rgb_b', label: 'RGB B 跳線', func: 'sig', color: '#1565c0', from: 'L:I16', to: 'L:D36', pin: '15', via: '→ 220Ω → B' },
    { id: 'rgb_br', kind: 'resistor', label: 'B 的 220Ω', value: '220Ω', from: 'L:D36', to: 'L:D33', modPin: 'B', func: 'sig', color: '#8d6e63', note: '串在 GPIO15 和 B 之間' },
    { id: 'rgb_gnd', label: 'RGB −', func: 'gnd', from: 'L:I2', to: 'L:E30', pin: 'GND', modPin: '−' },
    { id: 'dht_s', label: 'DHT11 S（資料）', func: 'sig', color: '#f9a825', from: 'L:I17', to: 'R:G59', pin: '7', modPin: 'S', status: 'planned', note: '左板第 17 欄 F–I 任一空孔都可' },
    { id: 'dht_v', label: 'DHT11 +', func: 'pwr', from: 'L:G22', to: 'R:G60', pin: '3V3', modPin: '+', status: 'planned', note: 'H22、I22 已有線，用 F 或 G。只接 3V3！' },
    { id: 'dht_g', label: 'DHT11 −', func: 'gnd', from: 'R:D3', to: 'R:G61', pin: 'GND', modPin: '−', status: 'planned', note: '右板第 3 欄 D 或 E 都可' }
  ],
  steps: [
    { title: '拔 USB、放好板子', modules: [], text: '先拔掉 USB。ESP32-S3 上排插左麵包板 J2–J23，下排插右麵包板 C2–C23，USB 朝左。', warn: '接線前一定先拔 USB，接好檢查完再插回。' },
    { title: '插上 TFT', modules: ['tft'], text: 'TFT 8 支腳插左麵包板 E50–E57，左到右 GND、VCC、SCL、SDA、RES、DC、CS、BLK，螢幕朝自己。' },
    { title: 'TFT GND', wires: ['tft_gnd'], text: '黑線從左 H2（ESP32 GND）接到左 D50（和 TFT GND 同一欄）。' },
    { title: 'TFT VCC', wires: ['tft_vcc'], text: '從左 I22（3V3）接到左 D51。', warn: '接 3V3，不要接第 3 欄的 5Vin。' },
    { title: 'TFT SCL＝GPIO12', wires: ['tft_sck'], text: '從左 I6（GPIO12）接到左 D52。' },
    { title: 'TFT SDA＝GPIO11', wires: ['tft_mosi'], text: '從左 I7（GPIO11）接到左 D53。' },
    { title: 'TFT RES＝GPIO13', wires: ['tft_rst'], text: '從左 I5（GPIO13）接到左 D54。' },
    { title: 'TFT DC＝GPIO9', wires: ['tft_dc'], text: '從左 I9（GPIO9）接到左 D55。' },
    { title: 'TFT CS＝GPIO10', wires: ['tft_cs'], text: '從左 I8（GPIO10）接到左 D56。' },
    { title: 'TFT BLK 背光', wires: ['tft_blk'], text: '從左 I23（另一支 3V3）接到左 D57，背光就會常亮。' },
    { title: '插上 RGB 燈', modules: ['rgb'], text: 'RGB 模組插左麵包板 C30–C33，左到右 −、R、G、B。' },
    { title: 'R＝GPIO17（串 220Ω）', wires: ['rgb_r', 'rgb_rr'], text: '跳線從左 I14（GPIO17）到左 A34，再用 220Ω 從 A34 跨到 A31（R 那一欄）。' },
    { title: 'G＝GPIO16（串 220Ω）', wires: ['rgb_g', 'rgb_gr'], text: '跳線從左 I15（GPIO16）到左 B35，220Ω 從 B35 跨到 B32（G 那一欄）。' },
    { title: 'B＝GPIO15（串 220Ω）', wires: ['rgb_b', 'rgb_br'], text: '跳線從左 I16（GPIO15）到左 D36，220Ω 從 D36 跨到 D33（B 那一欄）。' },
    { title: 'RGB −', wires: ['rgb_gnd'], text: '黑線從左 I2（GND）接到左 E30（− 那一欄）。' },
    { title: '（預定）DHT11 放上去', modules: ['dht'], status: 'planned', text: 'DHT11 橫插右麵包板 I59–I61，左到右 S、+、−，感測窗朝外。還沒接，韌體已經會讀 GPIO7，讀不到時畫面顯示 --。' },
    { title: '（預定）DHT11 S＝GPIO7', wires: ['dht_s'], text: '從左 I17（GPIO7）接到右 G59。' },
    { title: '（預定）DHT11 +＝3V3', wires: ['dht_v'], text: '從左 G22（3V3）接到右 G60。', warn: '+ 只接 3V3，接 5V 會讓資料腳電壓超過 3.3V。' },
    { title: '（預定）DHT11 −＝GND', wires: ['dht_g'], text: '從右 D3（下排第 2 個 GND）接到右 G61。插回 USB 前再檢查一次 + 是 3V3。' }
  ],
  callouts: [
    { target: 'board', title: 'ESP32-S3 44 腳', text: '跨兩塊麵包板，上排在左 J、下排在右 C。', dx: -60, dy: 110 },
    { target: 'usb', title: 'USB-C ×2', text: 'CH343 序列口＋原生 USB。接線前先拔掉。', dx: -40, dy: -130 },
    { target: 'antenna', title: '天線', text: '上面不要壓線。', dx: 30, dy: -120 },
    { target: 'module:tft', title: '2.4 吋 TFT', text: 'SCL12・SDA11・CS10・DC9・RES13；VCC／BLK 接 3V3。', dx: 70, dy: -40 },
    { target: 'module:rgb', title: 'RGB 燈', text: 'R17・G16・B15，各串 220Ω。', dx: -20, dy: -150 },
    { target: 'module:dht', title: 'DHT11（未接）', text: 'S→GPIO7、+→3V3、−→GND。', color: '#c2410c', dx: 40, dy: 40 }
  ],
  safety: [
    '接線、拔線前先拔掉 USB。',
    'TFT 的 VCC、BLK 和 DHT11 的 + 都接 3V3（左板第 22／23 欄），不要接第 3 欄的 5Vin。',
    'RGB 的 R／G／B 每一路都要串 220Ω，不能直接接 GPIO。',
    '同一欄 A–E（或 F–J）五個孔是相通的，不同模組的腳不要插在同一欄。',
    '燒錄只燒 app（0x10000），Wi‑Fi 設定會保留。'
  ],
  tbd: [
    '兩個 USB-C 哪個是 CH343、哪個是原生 USB，在板子上的上下位置還沒對過（不影響接線）。',
    'DHT11 還沒接：右 I59–I61 如果被 TFT 擋住，可以整組移到右板其他空的 3 欄，三條線跟著改同欄。',
    'DHT11 GND 改走右 D3，是因為左板第 2 欄 F–I 依舊圖已插滿；如果現場左 2 還有空孔，插左 2 也可以。',
    '舊的 PIR（GPIO4）、HW-485（GPIO14）韌體已停用，沒畫進來；實體是否還插著待確認。舊圖 HW-485 四支腳插在同一欄（左 B40–E40）會短路，不要照舊圖重接。'
  ],
  sources: 'monalisa-devtest-v05-sensors/wiring/gen3d.py（TFT、RGB 孔位）、monalisa-devtest-v16-ticker/monalisa_player/board_config.h（腳位）、monalisa-devtest-v16-ticker/wiring/README_zh-TW.md（DHT11）。',
  code: `// 蒙娜麗莎 v1.6 腳位（摘自 board_config.h）
constexpr int TFT_SCK = 12, TFT_MOSI = 11, TFT_CS = 10;
constexpr int TFT_DC = 9, TFT_RST = 13;        // VCC、BLK 接 3V3
constexpr int LED_R_GPIO = 17;                  // 各串 220Ω
constexpr int LED_G_GPIO = 16;
constexpr int LED_B_GPIO = 15;
constexpr int DHT_GPIO = 7;                     // DHT11（預定）

#include <SPI.h>
#include <Adafruit_ILI9341.h>
Adafruit_ILI9341 tft(&SPI, TFT_DC, TFT_CS, TFT_RST);

void setup() {
  Serial.begin(115200);
  SPI.begin(TFT_SCK, -1, TFT_MOSI, TFT_CS);
  tft.begin(40000000);                          // 40 MHz
  ledcAttach(LED_R_GPIO, 5000, 10);             // 5 kHz、10-bit
  ledcAttach(LED_G_GPIO, 5000, 10);
  ledcAttach(LED_B_GPIO, 5000, 10);
}

void setColor(uint8_t r, uint8_t g, uint8_t b) {  // 共陰：數字越大越亮
  ledcWrite(LED_R_GPIO, r * 4);
  ledcWrite(LED_G_GPIO, g * 4);
  ledcWrite(LED_B_GPIO, b * 4);
}

void loop() {
  setColor(0, 220, 255);  delay(1000);   // 開機青色
  setColor(255, 200, 0);  delay(1000);   // 有通知：黃
}`,
  sim: {
    label: 'RGB 燈換色＋SPI 訊號',
    run: async (api) => {
      const seq = [[[0, 220, 255], '開機青色'], [[255, 200, 0], '有通知：黃 255,200,0'], [[255, 40, 40], '紅'], [[40, 255, 80], '綠'], [[60, 90, 255], '藍'], [[255, 255, 255], '白']];
      api.log('v1.6 模擬開機…');
      api.pulse(['tft_sck', 'tft_mosi', 'tft_cs', 'tft_dc'], 4); api.log('[tft] SPI 40 MHz：GPIO12 時脈、GPIO11 資料');
      await api.wait(1200);
      for (let round = 0; round < 3 && api.running; round++) {
        for (const [c, name] of seq) {
          if (!api.running) return;
          api.led('rgb', c);
          const ids = []; if (c[0]) ids.push('rgb_r'); if (c[1]) ids.push('rgb_g'); if (c[2]) ids.push('rgb_b');
          api.pulse(ids, 2);
          api.log(`[led] ${name}  R=${c[0]} G=${c[1]} B=${c[2]}`);
          await api.wait(1300);
        }
        api.log('[dht] 讀不到 --（GPIO7，DHT11 還沒接）');
      }
      api.led('rgb', [255, 255, 255]); api.log('模擬結束');
    }
  }
});
