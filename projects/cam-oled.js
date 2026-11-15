/* 範例：S3 CAM＋0.96 吋 OLED（預定，待確認）
 * CAM 板腳位：Ian 提供（每排 21 腳，USB 左、元件朝上）。
 * 相機佔用腳：cam-stream/camera_pins.h（GPIO4–13、15–18），GPIO14、21 不在裡面。
 * 麵包板孔位是示意：CAM 板實際插在哪幾欄還沒拍照確認。
 */
WD.addProject({
  id: 'cam-oled',
  title: 'S3 CAM＋OLED（預定接法）',
  short: 'CAM＋OLED',
  subtitle: 'I2C：SCL→GPIO14、SDA→GPIO21',
  status: 'planned',
  intro: '這是預定接法，還沒實際接過。CAM 板的位置照 44 腳那塊的放法示意（上排左 J、下排右 C、從第 2 欄開始），實際插哪幾欄待確認；但 GPIO 對應是照 Ian 給的腳序算的。',
  board: { type: 's3_cam', top: 'L:J2', bottom: 'R:C2' },
  modules: [
    { id: 'oled', type: 'oled', name: '0.96 吋 OLED（I2C）', short: 'OLED', at: 'R:I40', pins: ['GND', 'VCC', 'SCL', 'SDA'], status: 'planned', screenText: 'Hello Ian',
      desc: 'I2C OLED，一般位址 0x3C。腳序以模組絲印為準（有些是 VCC、GND 對調）。' }
  ],
  wires: [
    { id: 'o_gnd', label: 'OLED GND', func: 'gnd', from: 'R:D2', to: 'R:G40', pin: 'GND', modPin: 'GND', status: 'planned' },
    { id: 'o_vcc', label: 'OLED VCC', func: 'pwr', from: 'L:I21', to: 'R:G41', pin: '3V3', modPin: 'VCC', status: 'planned', note: '接 3V3，不要接 5V' },
    { id: 'o_scl', label: 'OLED SCL', func: 'sig', color: '#f9a825', from: 'L:I3', to: 'R:G42', pin: '14', modPin: 'SCL', status: 'tbd', tbd: '有些 CAM 版本 GPIO14 接板載燈，要先看這塊板有沒有' },
    { id: 'o_sda', label: 'OLED SDA', func: 'sig', color: '#1e88e5', from: 'R:D5', to: 'R:G43', pin: '21', modPin: 'SDA', status: 'planned' }
  ],
  steps: [
    { title: '拔 USB、放好 CAM 板', text: 'USB 朝左、鏡頭朝上。示意位置：上排插左 J2–J22，下排插右 C2–C22（實際位置待確認）。', warn: '先拔 USB。' },
    { title: '插上 OLED', modules: ['oled'], status: 'planned', text: 'OLED 插右麵包板 I40–I43，先看絲印確認腳序是 GND、VCC、SCL、SDA。' },
    { title: 'GND', wires: ['o_gnd'], text: '從右 D2（下排第 1 腳 GND）接到右 G40。' },
    { title: 'VCC＝3V3', wires: ['o_vcc'], text: '從左 I21（上排第 20 腳 3V3）接到右 G41。', warn: '只接 3V3。' },
    { title: 'SCL＝GPIO14', wires: ['o_scl'], text: '從左 I3（上排第 2 腳 GPIO14）接到右 G42。', warn: 'GPIO14 待確認：先看板上有沒有燈接在 GPIO14。' },
    { title: 'SDA＝GPIO21', wires: ['o_sda'], text: '從右 D5（下排第 4 腳 GPIO21）接到右 G43。' }
  ],
  callouts: [
    { target: 'camera', title: 'OV3660 鏡頭', text: '佔用 GPIO4–13、15–18。', dx: -80, dy: -130 },
    { target: 'usb', title: 'USB-C', text: '在左邊。接線前先拔。', dx: -30, dy: 90 },
    { target: 'module:oled', title: 'OLED（預定）', text: 'SCL14・SDA21・3V3・GND', color: '#c2410c', dx: 50, dy: -60 }
  ],
  safety: [
    '先拔 USB 再接線。',
    'OLED VCC 接 3V3（上排第 20／21 腳），不要接左上角的 5V。',
    '相機用掉 GPIO4–13、15–18，這些腳不要再接東西。',
    '不要用 0、3、45、46（strap）、19、20（USB）、35–37（PSRAM）。'
  ],
  tbd: [
    'CAM 板實際插在麵包板哪幾欄還沒拍照，圖上孔位是示意（GPIO 對應是對的）。',
    'GPIO14：有些 CAM 版本把板載燈接在 GPIO14，要先確認這塊板沒有。',
    'OLED 腳序要看實物絲印，有些模組是 VCC、GND 對調。',
    'OLED 模組電壓（3.3V 可用）以賣場規格為準。'
  ],
  sources: 'CAM 腳序：Ian 提供；相機腳：cam-stream/camera_pins.h；GPIO14 註記：cam-tft-oneboard-v0.3/pin_map.md。',
  code: `// S3 CAM + 0.96" OLED（預定）
#include <Wire.h>
#include <U8g2lib.h>
constexpr int OLED_SDA = 21;
constexpr int OLED_SCL = 14;   // 待確認板上沒有燈接 GPIO14

U8G2_SSD1306_128X64_NONAME_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE);

void setup() {
  Wire.begin(OLED_SDA, OLED_SCL);
  oled.begin();
}

void loop() {
  oled.clearBuffer();
  oled.setFont(u8g2_font_ncenB14_tr);
  oled.drawStr(8, 38, "Hello Ian");
  oled.sendBuffer();
  delay(1000);
}`,
  sim: {
    label: 'OLED 顯示（I2C 訊號）',
    run: async (api) => {
      const msgs = ['Hello Ian', 'GPIO14 SCL', 'GPIO21 SDA', '0x3C OK'];
      for (let i = 0; i < 8 && api.running; i++) {
        const t = msgs[i % msgs.length];
        api.pulse(['o_scl', 'o_sda'], 3);
        api.screen('oled', (c, w, h) => { c.fillStyle = '#05070a'; c.fillRect(0, 0, w, h); c.fillStyle = '#7fd4ff'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, w / 2, h / 2); });
        api.log(`[i2c] 0x3C ← "${t}"`);
        await api.wait(1400);
      }
      api.log('模擬結束');
    }
  }
});
