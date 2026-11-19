// uno-touch-shield-s3 v0.2 — 2.4" UNO 觸控 TFT 擴充板（8 位元並列）測試韌體，ESP32-S3 N16R8（說話機器人板）
// 步驟 1 讀驅動 ID（0xD3 / 0x04）→ 序列埠與螢幕  步驟 2 紅綠藍白填色＋文字  步驟 3 電阻式觸控（自動偵測觸控腳位、校正、點點）
// 顯示：LovyanGFX Bus_Parallel8 + Panel_ILI9341（驅動未確認，ID 不是 0x9341 會警告但照 ILI9341 跑）
// v0.2：加浮球開關讀取（GPIO18，內部上拉；LOW＝閉合、HIGH＝打開），序列埠＋螢幕顯示；高低水位對應哪個狀態待確認。
// 不使用 Wi‑Fi、不寫 NVS（燒 app 分區時保留板上已存的 Wi‑Fi）。序列埠 115200，USB CDC 與 UART0 同時輸出／輸入。
#include <Arduino.h>
#include <stdarg.h>
#define LGFX_USE_V1
#include <LovyanGFX.hpp>
#include "esp_rom_gpio.h"
#include "soc/gpio_sig_map.h"
#include "board_pins.h"

#define FW_VERSION "v0.2"
#define PIN_FLOAT PIN_FLOAT_SWITCH   // 浮球開關：一線 GPIO18（左I13）、一線 GND；INPUT_PULLUP，LOW＝接點閉合

struct Raw { int a, b, z1, z2, z; bool valid; };  // 放最前面：Arduino 自動產生的函式原型會用到

class LGFX : public lgfx::LGFX_Device {
  lgfx::Panel_ILI9341 _panel;
  lgfx::Bus_Parallel8 _bus;
 public:
  LGFX() {
    {
      auto cfg = _bus.config();
      cfg.freq_write = 10000000;   // ILI9341 寫入週期最短約 66 ns；經 245 電平轉換，保守用 10 MHz
      cfg.freq_read = 2000000;
      cfg.pin_rd = PIN_LCD_RD;
      cfg.pin_wr = PIN_LCD_WR;
      cfg.pin_rs = PIN_LCD_RS;
      cfg.pin_d0 = PIN_LCD_D0; cfg.pin_d1 = PIN_LCD_D1; cfg.pin_d2 = PIN_LCD_D2; cfg.pin_d3 = PIN_LCD_D3;
      cfg.pin_d4 = PIN_LCD_D4; cfg.pin_d5 = PIN_LCD_D5; cfg.pin_d6 = PIN_LCD_D6; cfg.pin_d7 = PIN_LCD_D7;
      _bus.config(cfg);
      _panel.setBus(&_bus);
    }
    {
      auto cfg = _panel.config();
      cfg.pin_cs = PIN_LCD_CS;
      cfg.pin_rst = PIN_LCD_RST;
      cfg.pin_busy = -1;
      cfg.memory_width = cfg.panel_width = 240;
      cfg.memory_height = cfg.panel_height = 320;
      cfg.offset_x = cfg.offset_y = 0;
      cfg.offset_rotation = 0;
      cfg.readable = true;
      cfg.invert = false;
      cfg.rgb_order = false;   // 顏色反了就在序列埠按 b
      cfg.dlen_16bit = false;
      cfg.bus_shared = false;
      _panel.config(cfg);
    }
    setPanel(&_panel);
  }
};

static LGFX tft;

// ================= 輸出（USB CDC 與 UART0 同時印） =================
static void logf(const char* fmt, ...) {
  char buf[320];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(buf, sizeof(buf), fmt, ap);
  va_end(ap);
  Serial0.print(buf); Serial0.print("\r\n");
  Serial.print(buf);  Serial.print("\r\n");
}

// ================= 狀態 =================
static bool g_rgbOrder = false, g_invert = false;
static int g_rotation = 1;  // 1 = 橫放 320x240
static uint32_t g_idRaw = 0;
static uint16_t g_id16 = 0;
static bool g_idIsIli9341 = false;

struct TouchPins { int p0 = -1, p1 = -1, q0 = -1, q1 = -1; bool found = false; };  // 板 A 兩端 (p0,p1)、板 B 兩端 (q0,q1)
static TouchPins g_tp;
struct Cal { bool ok = false; bool xIsA = true; int xr0 = 0, xr1 = 4095, yr0 = 0, yr1 = 4095; };
static Cal g_cal;
static const int CAL_M = 24;  // 校正十字離邊 24 px

// ================= 小工具 =================
static void pinsToGpio(const uint8_t* pins, size_t n) {
  for (size_t i = 0; i < n; i++) esp_rom_gpio_connect_out_signal(pins[i], SIG_GPIO_OUT_IDX, false, false);  // 脫離 LCD_CAM 的 GPIO matrix
}
static int median5(int* v) {  // v[5]
  for (int i = 1; i < 5; i++) { int k = v[i], j = i - 1; while (j >= 0 && v[j] > k) { v[j + 1] = v[j]; j--; } v[j + 1] = k; }
  return v[2];
}

// ================= 顯示模式／觸控模式切換 =================
// 觸控板跟 RS、CS、D0、D1 共用腳：觸控時先釋放 LCD_CAM 匯流排，腳位當一般 GPIO／ADC；畫圖前再重新初始化匯流排。
static bool g_touchMode = false;
static void enterTouchMode() {
  if (g_touchMode) return;
  tft.waitDisplay();
  tft.releaseBus();
  pinsToGpio(uno::kLcdPins, sizeof(uno::kLcdPins));
  for (uint8_t p : uno::kLcdPins) pinMode(p, INPUT);
  pinMode(PIN_LCD_WR, OUTPUT); digitalWrite(PIN_LCD_WR, HIGH);  // WR、RD 保持高：螢幕不會被寫入／讀取
  pinMode(PIN_LCD_RD, OUTPUT); digitalWrite(PIN_LCD_RD, HIGH);
  pinMode(PIN_LCD_RST, OUTPUT); digitalWrite(PIN_LCD_RST, HIGH);
  g_touchMode = true;
}
static void enterDisplayMode() {
  if (!g_touchMode) return;
  for (uint8_t p : uno::kTouchExtended) pinMode(p, INPUT);  // 離開類比模式
  tft.initBus();
  pinMode(PIN_LCD_CS, OUTPUT); digitalWrite(PIN_LCD_CS, HIGH);
  g_touchMode = false;
}

// ================= 步驟 1：讀驅動 ID =================
struct KnownId { uint8_t a, b; const char* name; };
static const KnownId kKnown[] = {{0x93, 0x41, "ILI9341"}, {0x93, 0x42, "ILI9342"}, {0x94, 0x86, "ILI9486"}, {0x94, 0x88, "ILI9488"},
                                 {0x85, 0x52, "ST7789V"}, {0x77, 0x89, "ST7789"}, {0x93, 0x25, "ILI9325"}, {0x93, 0x28, "ILI9328"}};
static void readDriverId() {
  enterDisplayMode();
  uint32_t r = tft.getPanel()->readCommand(0xD3, 0, 4);   // 第 1 個位元組是 dummy，之後 00 93 41
  uint32_t r04 = tft.getPanel()->readCommand(0x04, 0, 4); // RDDID：dummy, ID1, ID2, ID3（各家不同）
  uint8_t b[4], c[4];
  for (int i = 0; i < 4; i++) { b[i] = (r >> (8 * i)) & 0xFF; c[i] = (r04 >> (8 * i)) & 0xFF; }
  g_idRaw = r;
  const char* name = nullptr;
  g_id16 = 0;
  for (int i = 0; i < 3 && !name; i++)
    for (auto& k : kKnown) if (b[i] == k.a && b[i + 1] == k.b) { name = k.name; g_id16 = (k.a << 8) | k.b; break; }
  bool allSame = (b[1] == b[2] && b[2] == b[3] && (b[1] == 0x00 || b[1] == 0xFF));
  g_idIsIli9341 = (name && g_id16 == 0x9341);
  logf("[步驟1] 驅動 ID / Driver ID");
  logf("  0xD3 raw = %02X %02X %02X %02X（第1個是 dummy）/ 0x04 raw = %02X %02X %02X %02X", b[0], b[1], b[2], b[3], c[0], c[1], c[2], c[3]);
  char line1[96], line2[96];
  if (g_idIsIli9341) {
    snprintf(line1, sizeof(line1), "驅動 ID 0x9341 = ILI9341 (OK)");
    snprintf(line2, sizeof(line2), "D3: %02X %02X %02X %02X", b[0], b[1], b[2], b[3]);
    logf("  結果：ID = 0x9341 → ILI9341 ✓ / Result: ILI9341 confirmed");
  } else if (name) {
    snprintf(line1, sizeof(line1), "警告：ID 0x%04X = %s", g_id16, name);
    snprintf(line2, sizeof(line2), "不是 ILI9341，仍照 ILI9341 設定跑");
    logf("  ⚠ 警告：ID = 0x%04X → %s，不是 ILI9341；仍照 ILI9341 設定繼續，顯示可能不對 / WARNING: not ILI9341 (%s), continuing with ILI9341 settings", g_id16, name, name);
  } else if (allSame) {
    snprintf(line1, sizeof(line1), "警告：讀不到 ID（全 %02X）", b[1]);
    snprintf(line2, sizeof(line2), "RD 沒接好或擴充板不支援讀取");
    logf("  ⚠ 警告：讀不到驅動 ID（全 %02X）。可能 RD(GPIO7) 沒接好、245 方向腳不支援讀取、或螢幕沒反應；仍照 ILI9341 設定繼續 / WARNING: ID read failed (all %02X), continuing as ILI9341", b[1], b[1]);
  } else {
    snprintf(line1, sizeof(line1), "警告：未知 ID %02X %02X %02X", b[1], b[2], b[3]);
    snprintf(line2, sizeof(line2), "不是 ILI9341，仍照 ILI9341 設定跑");
    logf("  ⚠ 警告：未知驅動 ID %02X %02X %02X，不是 ILI9341；仍照 ILI9341 設定繼續 / WARNING: unknown ID, continuing with ILI9341 settings", b[1], b[2], b[3]);
  }
  tft.setRotation(g_rotation);
  tft.fillScreen(TFT_BLACK);
  tft.setFont(&fonts::efontTW_16);
  tft.setTextSize(1);
  tft.setTextColor(g_idIsIli9341 ? TFT_GREEN : TFT_YELLOW, TFT_BLACK);
  tft.setCursor(8, 8);   tft.print("[步驟1] 驅動 ID");
  tft.setCursor(8, 40);  tft.print(line1);
  tft.setCursor(8, 64);  tft.print(line2);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setCursor(8, 100); tft.printf("D3 raw %02X %02X %02X %02X", b[0], b[1], b[2], b[3]);
  tft.setCursor(8, 124); tft.printf("04 raw %02X %02X %02X %02X", c[0], c[1], c[2], c[3]);
  delay(2500);
}

// ================= 步驟 2：填色＋文字 =================
static void colorTest() {
  enterDisplayMode();
  tft.setRotation(g_rotation);
  tft.setFont(&fonts::efontTW_16);
  tft.setTextSize(2);
  struct C { uint16_t c; const char* zh; const char* en; uint16_t fg; } cs[] = {
      {TFT_RED, "紅色", "RED", TFT_WHITE}, {TFT_GREEN, "綠色", "GREEN", TFT_BLACK},
      {TFT_BLUE, "藍色", "BLUE", TFT_WHITE}, {TFT_WHITE, "白色", "WHITE", TFT_BLACK}, {TFT_BLACK, "黑色", "BLACK", TFT_WHITE}};
  logf("[步驟2] 填色測試：紅 → 綠 → 藍 → 白 → 黑（顏色對調請按 b，反相請按 v）");
  for (auto& c : cs) {
    tft.fillScreen(c.c);
    tft.setTextColor(c.fg, c.c);
    tft.setCursor(20, 90);
    tft.printf("%s %s", c.zh, c.en);
    logf("  填 %s %s", c.zh, c.en);
    delay(900);
  }
  // 文字／座標頁
  tft.fillScreen(TFT_BLACK);
  tft.drawRect(0, 0, tft.width(), tft.height(), TFT_WHITE);
  tft.drawRect(2, 2, tft.width() - 4, tft.height() - 4, TFT_RED);
  tft.setTextSize(1);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setCursor(10, 8);  tft.print("UNO 觸控 TFT 測試");
  tft.setCursor(10, 32); tft.printf("%dx%d  旋轉=%d  %s", tft.width(), tft.height(), g_rotation, g_idIsIli9341 ? "ILI9341" : "驅動未確認");
  tft.setCursor(10, 56); tft.print("Hello 你好 ABC abc 0123456789");
  tft.setCursor(10, 80); tft.print("字是鏡像或倒的就按 o 換旋轉");
  int bw = (tft.width() - 20) / 8;
  uint16_t bars[8] = {TFT_WHITE, TFT_YELLOW, TFT_CYAN, TFT_GREEN, TFT_MAGENTA, TFT_RED, TFT_BLUE, TFT_BLACK};
  for (int i = 0; i < 8; i++) tft.fillRect(10 + i * bw, 110, bw, 40, bars[i]);
  for (int i = 0; i < tft.width() - 20; i++) { uint8_t g = i * 255 / (tft.width() - 21); tft.drawFastVLine(10 + i, 160, 24, tft.color565(g, g, g)); }
  tft.fillRect(0, 0, 12, 12, TFT_RED);
  tft.fillRect(tft.width() - 12, 0, 12, 12, TFT_GREEN);
  tft.fillRect(0, tft.height() - 12, 12, 12, TFT_BLUE);
  tft.fillRect(tft.width() - 12, tft.height() - 12, 12, 12, TFT_YELLOW);
  tft.setTextColor(TFT_CYAN, TFT_BLACK);
  tft.setCursor(10, 196); tft.print("四角：左上紅 右上綠 左下藍 右下黃");
  logf("  文字頁已畫：四角 左上紅 右上綠 左下藍 右下黃；若位置不對，請按 o 換旋轉");
  delay(3000);
}

// ================= 步驟 3：電阻式觸控 =================
static void floatTouch(const uint8_t* pins, size_t n) { for (size_t i = 0; i < n; i++) pinMode(pins[i], INPUT); }
static void drive(int p, int lvl) { pinMode(p, OUTPUT); digitalWrite(p, lvl); }

// 兩支腳是否在同一片電阻板（兩端電阻幾百歐）：a 推高、b 下拉 → 讀到高；a 拉低、b 上拉 → 讀到低
static bool plateConnected(int a, int b, const uint8_t* pins, size_t n) {
  floatTouch(pins, n);
  drive(a, 1); pinMode(b, INPUT_PULLDOWN); delayMicroseconds(300);
  bool h = digitalRead(b);
  floatTouch(pins, n);
  drive(a, 0); pinMode(b, INPUT_PULLUP); delayMicroseconds(300);
  bool l = !digitalRead(b);
  floatTouch(pins, n);
  return h && l;
}

static bool detectWith(const uint8_t* pins, size_t n) {
  bool edge[6][6] = {};
  int ne = 0;
  logf("  偵測候選腳：");
  for (size_t i = 0; i < n; i++) logf("    GPIO%d", pins[i]);
  for (size_t i = 0; i < n; i++)
    for (size_t j = i + 1; j < n; j++)
      if (plateConnected(pins[i], pins[j], pins, n) && plateConnected(pins[j], pins[i], pins, n)) {
        edge[i][j] = true; ne++;
        logf("    同一片電阻板：GPIO%d ↔ GPIO%d", pins[i], pins[j]);
      }
  if (ne != 2) { logf("    找到 %d 組（要剛好 2 組）", ne); return false; }
  int e[2][2], k = 0;
  for (size_t i = 0; i < n; i++) for (size_t j = i + 1; j < n; j++) if (edge[i][j]) { e[k][0] = pins[i]; e[k][1] = pins[j]; k++; }
  if (e[0][0] == e[1][0] || e[0][0] == e[1][1] || e[0][1] == e[1][0] || e[0][1] == e[1][1]) { logf("    兩組共用同一支腳，判定失敗"); return false; }
  g_tp.p0 = e[0][0]; g_tp.p1 = e[0][1]; g_tp.q0 = e[1][0]; g_tp.q1 = e[1][1]; g_tp.found = true;
  return true;
}

static const char* pinTag(int p) {
  switch (p) { case PIN_LCD_RS: return "RS"; case PIN_LCD_CS: return "CS"; case PIN_LCD_D0: return "D0"; case PIN_LCD_D1: return "D1";
    case PIN_LCD_D6: return "D6"; case PIN_LCD_D7: return "D7"; default: return "?"; }
}

static bool detectTouchPins() {
  enterTouchMode();
  g_tp = TouchPins();
  logf("[步驟3] 觸控腳位自動偵測（不用碰螢幕，手指先離開）");
  bool ok = detectWith(uno::kTouchPrimary, 4);
  if (!ok) { logf("  標準 4 腳（RS CS D0 D1）沒找到，改試加上 D6 D7"); ok = detectWith(uno::kTouchExtended, 6); }
  if (ok) {
    logf("  ✓ 觸控板 A = GPIO%d(%s) ↔ GPIO%d(%s)；觸控板 B = GPIO%d(%s) ↔ GPIO%d(%s)", g_tp.p0, pinTag(g_tp.p0), g_tp.p1, pinTag(g_tp.p1),
         g_tp.q0, pinTag(g_tp.q0), g_tp.q1, pinTag(g_tp.q1));
    logf("    對照標準 MCUFRIEND：XM=RS(A2) YP=CS(A3) XP=D0(D8) YM=D1(D9)；哪片是 X、哪片是 Y 由下一步校正決定");
  } else {
    logf("  ✗ 沒偵測到觸控板。可能：這片沒有觸控、觸控排線沒插好、或腳位不在 RS/CS/D0/D1/D6/D7。");
  }
  return ok;
}

static int adcMedian(int pin) {
  int v[5];
  analogRead(pin);  // 丟掉第一次
  for (int i = 0; i < 5; i++) v[i] = analogRead(pin);
  return median5(v);
}
static int adcSpread(int* v) { int mn = 4095, mx = 0; for (int i = 0; i < 5; i++) { if (v[i] < mn) mn = v[i]; if (v[i] > mx) mx = v[i]; } return mx - mn; }

// 手指是否按著：板 A 一端拉低，板 B 一端上拉（再反過來測一次，任一方向讀到低就算），讀到低 = 兩片板被壓在一起
static bool isTouched() {
  floatTouch(uno::kTouchExtended, 6);
  drive(g_tp.p1, 0); pinMode(g_tp.q0, INPUT_PULLUP); delayMicroseconds(150);
  bool t1 = !digitalRead(g_tp.q0);
  floatTouch(uno::kTouchExtended, 6);
  drive(g_tp.q1, 0); pinMode(g_tp.p0, INPUT_PULLUP); delayMicroseconds(150);
  bool t2 = !digitalRead(g_tp.p0);
  floatTouch(uno::kTouchExtended, 6);
  return t1 || t2;
}

static Raw readRaw() {
  Raw r{0, 0, 0, 0, 0, false};
  int v[5];
  // 板 A 兩端加壓（p0 高 p1 低），讀板 B 的 q0
  floatTouch(uno::kTouchExtended, 6);
  drive(g_tp.p0, 1); drive(g_tp.p1, 0); pinMode(g_tp.q0, INPUT); delayMicroseconds(150);
  analogRead(g_tp.q0);
  for (int i = 0; i < 5; i++) v[i] = analogRead(g_tp.q0);
  int sa = adcSpread(v); r.a = median5(v);
  // 板 B 兩端加壓（q0 高 q1 低），讀板 A 的 p0
  floatTouch(uno::kTouchExtended, 6);
  drive(g_tp.q0, 1); drive(g_tp.q1, 0); pinMode(g_tp.p0, INPUT); delayMicroseconds(150);
  analogRead(g_tp.p0);
  for (int i = 0; i < 5; i++) v[i] = analogRead(g_tp.p0);
  int sb = adcSpread(v); r.b = median5(v);
  // 壓力（Adafruit TouchScreen 公式）：XP=p0 低、YM=q1 高，讀 XM=p1 與 YP=q0；z = 4095-(z2-z1)
  floatTouch(uno::kTouchExtended, 6);
  drive(g_tp.p0, 0); drive(g_tp.q1, 1); pinMode(g_tp.p1, INPUT); pinMode(g_tp.q0, INPUT); delayMicroseconds(150);
  r.z1 = adcMedian(g_tp.p1); r.z2 = adcMedian(g_tp.q0);
  r.z = 4095 - (r.z2 - r.z1);
  floatTouch(uno::kTouchExtended, 6);
  r.valid = (sa < 250 && sb < 250);
  return r;
}

static void mapXY(const Raw& r, int& x, int& y) {
  int rx = g_cal.xIsA ? r.a : r.b, ry = g_cal.xIsA ? r.b : r.a;
  int W = tft.width(), H = tft.height();
  long dx = g_cal.xr1 - g_cal.xr0, dy = g_cal.yr1 - g_cal.yr0;
  if (!dx) dx = 1;
  if (!dy) dy = 1;
  x = CAL_M + (long)(rx - g_cal.xr0) * (W - 2 * CAL_M) / dx;
  y = CAL_M + (long)(ry - g_cal.yr0) * (H - 2 * CAL_M) / dy;
}

// 觸控模式下等一次穩定的觸碰，取中位數；等放開。timeout 毫秒。
static bool captureTouch(Raw& out, uint32_t timeoutMs) {
  uint32_t t0 = millis();
  int cnt = 0;
  while (millis() - t0 < timeoutMs) {
    if (isTouched()) { if (++cnt >= 4) break; } else cnt = 0;
    delay(5);
  }
  if (cnt < 4) return false;
  int as[7], bs[7], n = 0;
  while (n < 7) { Raw r = readRaw(); if (r.valid) { as[n] = r.a; bs[n] = r.b; n++; } if (!isTouched()) break; delay(3); }
  if (n < 3) return false;
  for (int i = 1; i < n; i++) { int k = as[i], j = i - 1; while (j >= 0 && as[j] > k) { as[j + 1] = as[j]; j--; } as[j + 1] = k; }
  for (int i = 1; i < n; i++) { int k = bs[i], j = i - 1; while (j >= 0 && bs[j] > k) { bs[j + 1] = bs[j]; j--; } bs[j + 1] = k; }
  out.a = as[n / 2]; out.b = bs[n / 2];
  int up = 0; uint32_t t1 = millis();
  while (up < 6 && millis() - t1 < 4000) { if (!isTouched()) up++; else up = 0; delay(5); }  // 等放開
  return true;
}

static void drawCross(int x, int y, uint16_t col) {
  tft.drawFastHLine(x - 12, y, 25, col); tft.drawFastVLine(x, y - 12, 25, col); tft.drawCircle(x, y, 7, col);
}
static void promptPage(const char* msg, int cx, int cy) {
  enterDisplayMode();
  tft.setRotation(g_rotation);
  tft.fillScreen(TFT_BLACK);
  tft.setFont(&fonts::efontTW_16); tft.setTextSize(1);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setCursor(60, tft.height() / 2 - 20); tft.print(msg);
  if (cx >= 0) drawCross(cx, cy, TFT_YELLOW);
}

static bool calibrate() {
  int W = tft.width(), H = tft.height();
  Raw tl, tr, br;
  const char* nm[3] = {"左上角", "右上角", "右下角"};
  int px[3] = {CAL_M, W - CAL_M, W - CAL_M}, py[3] = {CAL_M, CAL_M, H - CAL_M};
  Raw* out[3] = {&tl, &tr, &br};
  logf("[步驟3] 校正：請用指甲或觸控筆依序點十字（左上 → 右上 → 右下），每點 20 秒內");
  for (int i = 0; i < 3; i++) {
    char m[48]; snprintf(m, sizeof(m), "請點 %s 十字（%d/3）", nm[i], i + 1);
    promptPage(m, px[i], py[i]);
    enterTouchMode();
    if (!captureTouch(*out[i], 20000)) { logf("  ✗ 沒等到穩定觸碰（%s），校正略過；先用原始值模式", nm[i]); return false; }
    logf("  %s 原始值：A=%d B=%d", nm[i], out[i]->a, out[i]->b);
  }
  int dA = abs(tr.a - tl.a), dB = abs(tr.b - tl.b);
  g_cal.xIsA = dA >= dB;
  int xl = g_cal.xIsA ? tl.a : tl.b, xr = g_cal.xIsA ? tr.a : tr.b;
  int yt = g_cal.xIsA ? tr.b : tr.a, yb = g_cal.xIsA ? br.b : br.a;
  if (abs(xr - xl) < 600 || abs(yb - yt) < 600) { logf("  ✗ 校正範圍太小（X %d、Y %d），可能點錯位置或觸控板怪怪的", abs(xr - xl), abs(yb - yt)); return false; }
  g_cal.xr0 = xl; g_cal.xr1 = xr; g_cal.yr0 = yt; g_cal.yr1 = yb; g_cal.ok = true;
  logf("  ✓ 校正完成：螢幕 X = 觸控板 %s（GPIO%d↔GPIO%d），原始 %d→%d；螢幕 Y = 觸控板 %s，原始 %d→%d",
       g_cal.xIsA ? "A" : "B", g_cal.xIsA ? g_tp.p0 : g_tp.q0, g_cal.xIsA ? g_tp.p1 : g_tp.q1, xl, xr, g_cal.xIsA ? "B" : "A", yt, yb);
  return true;
}

// ================= 浮球開關（GPIO18） =================
static int g_floatState = -1;        // 已確認狀態：0=LOW(閉合) 1=HIGH(打開)，-1=尚未讀
static int g_floatRaw = -1; static uint32_t g_floatRawMs = 0;
static void drawFloatStatus() {
  int W = tft.width();
  tft.fillRect(W - 150, 2, 148, 20, TFT_BLACK);
  tft.setFont(&fonts::efontTW_16); tft.setTextSize(1);
  tft.setTextColor(g_floatState == 0 ? TFT_GREEN : TFT_ORANGE, TFT_BLACK);
  tft.setCursor(W - 148, 4);
  tft.print(g_floatState == 0 ? "浮球 閉合(LOW)" : "浮球 打開(HIGH)");
}
static const char* floatText(int st) { return st == 0 ? "LOW＝接點閉合" : "HIGH＝接點打開"; }
// 去彈跳 50 ms；狀態改變就印序列埠，並在螢幕右上角更新（要先切回顯示模式）
static void floatPoll(bool force = false) {
  int v = digitalRead(PIN_FLOAT);
  if (v != g_floatRaw) { g_floatRaw = v; g_floatRawMs = millis(); }
  if (force && g_floatState < 0) g_floatState = v;
  if (v != g_floatState && millis() - g_floatRawMs >= 50) {
    g_floatState = v;
    logf("[浮球] GPIO%d = %s（INPUT_PULLUP；高低水位對應哪個狀態待確認，取決於浮球朝上或朝下裝）", PIN_FLOAT, floatText(v));
    bool was = g_touchMode;
    enterDisplayMode(); drawFloatStatus();
    if (was) enterTouchMode();
  }
}

// 觸控畫點頁
static void touchPage() {
  enterDisplayMode();
  tft.setRotation(g_rotation);
  tft.fillScreen(TFT_BLACK);
  tft.setFont(&fonts::efontTW_16); tft.setTextSize(1);
  tft.setTextColor(TFT_CYAN, TFT_BLACK);
  tft.setCursor(8, 4); tft.print(g_cal.ok ? "觸控測試：點螢幕畫點" : "觸控測試（未校正，點位僅供參考）");
  tft.drawRect(0, 0, tft.width(), tft.height(), TFT_DARKGREY);
  if (g_floatState >= 0) drawFloatStatus();
}

static uint32_t g_touchCount = 0, g_lastHint = 0, g_lastTouchMs = 0;
static void touchLoopOnce() {
  enterTouchMode();
  if (!isTouched()) {
    if (millis() - g_lastHint > 10000 && millis() - g_lastTouchMs > 10000) {
      g_lastHint = millis();
      logf("[待機] 浮球=%s｜等待觸碰… 觸控板 A=GPIO%d↔%d B=GPIO%d↔%d %s（i 重讀ID、t 重新偵測校正、c 填色、k 清畫面、o 換旋轉、b 對調紅藍、v 反相）",
           g_floatState < 0 ? "?" : (g_floatState ? "HIGH打開" : "LOW閉合"), g_tp.p0, g_tp.p1, g_tp.q0, g_tp.q1, g_cal.ok ? "已校正" : "未校正");
    }
    delay(4);
    return;
  }
  Raw rs[10]; int n = 0;
  while (n < 10 && isTouched()) { Raw r = readRaw(); if (r.valid) rs[n++] = r; delay(2); }
  g_lastTouchMs = millis();
  if (!n) return;
  enterDisplayMode();
  for (int i = 0; i < n; i++) {
    int x = 0, y = 0;
    mapXY(rs[i], x, y);
    g_touchCount++;
    if (i == 0 || i == n - 1) logf("touch #%lu raw A=%d B=%d z1=%d z2=%d z=%d → x=%d y=%d%s", (unsigned long)g_touchCount, rs[i].a, rs[i].b, rs[i].z1, rs[i].z2, rs[i].z, x, y, g_cal.ok ? "" : "（未校正）");
    if (x >= 1 && y >= 1 && x < tft.width() - 1 && y < tft.height() - 1) tft.fillCircle(x, y, 3, i == n - 1 ? TFT_YELLOW : TFT_RED);
  }
  Raw& l = rs[n - 1];
  int x = 0, y = 0; mapXY(l, x, y);
  tft.fillRect(8, tft.height() - 22, tft.width() - 16, 18, TFT_BLACK);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.setCursor(8, tft.height() - 22);
  tft.printf("A%d B%d z%d  x%d y%d", l.a, l.b, l.z, x, y);
}

// ================= 序列埠指令 =================
static void showHelp() {
  logf("指令：h 說明｜i 重讀驅動ID｜c 填色測試｜t 重新偵測觸控腳位並校正｜k 清畫面｜o 換旋轉(0-3)｜b 對調紅藍(RGB/BGR)｜v 反相");
}
static void fullTouchSetup() {
  if (!detectTouchPins()) { g_tp.found = false; return; }
  g_cal.ok = false;
  calibrate();
  touchPage();
}
static void handleCmd(int c) {
  switch (c) {
    case 'h': case '?': showHelp(); break;
    case 'i': readDriverId(); touchPage(); break;
    case 'c': colorTest(); touchPage(); break;
    case 't': fullTouchSetup(); break;
    case 'k': touchPage(); break;
    case 'o': g_rotation = (g_rotation + 1) & 3; logf("旋轉 = %d（要重新校正，按 t）", g_rotation); g_cal.ok = false; colorTest(); touchPage(); break;
    case 'b': g_rgbOrder = !g_rgbOrder; enterDisplayMode(); { auto pc = tft.getPanel()->config(); pc.rgb_order = g_rgbOrder; tft.getPanel()->config(pc); } tft.setRotation(g_rotation); logf("RGB 順序 = %s", g_rgbOrder ? "RGB" : "BGR（預設）"); colorTest(); touchPage(); break;
    case 'v': g_invert = !g_invert; enterDisplayMode(); tft.invertDisplay(g_invert); logf("反相 = %s", g_invert ? "開" : "關"); colorTest(); touchPage(); break;
    default: break;
  }
}
static void pollSerial() {
  while (Serial.available())  { int c = Serial.read();  if (c > 0 && c != '\r' && c != '\n') handleCmd(c); }
  while (Serial0.available()) { int c = Serial0.read(); if (c > 0 && c != '\r' && c != '\n') handleCmd(c); }
}

void setup() {
  Serial0.begin(115200);
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);
  delay(1500);
  logf("");
  logf("==== uno-touch-shield-s3 %s：2.4吋 UNO 觸控 TFT（8 位元並列）測試 ====", FW_VERSION);
  uint64_t mac = ESP.getEfuseMac();
  logf("板子：ESP32-S3 N16R8（說話機器人板），MAC %02x:%02x:%02x:%02x:%02x:%02x（預期 68:ee:8f:4b:fa:58）", (int)(mac & 0xFF), (int)((mac >> 8) & 0xFF), (int)((mac >> 16) & 0xFF), (int)((mac >> 24) & 0xFF), (int)((mac >> 32) & 0xFF), (int)((mac >> 40) & 0xFF));
  logf("腳位：RS=4 CS=5 WR=6 RD=7 RST=15  D0=8 D1=9 D2=10 D3=11 D4=12 D5=13 D6=16 D7=17（5V→5Vin、GND→GND；SD 卡 4 腳、F_CS、3.3V 腳不接）");
  pinMode(PIN_FLOAT, INPUT_PULLUP);
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  tft.init();
  tft.setRotation(g_rotation);
  g_touchMode = false;
  readDriverId();
  colorTest();
  showHelp();
  floatPoll(true);
  logf("[浮球] GPIO%d INPUT_PULLUP 目前 = %s（高低水位對應哪個狀態待確認）", PIN_FLOAT, floatText(g_floatState));
  fullTouchSetup();
}

void loop() {
  pollSerial();
  floatPoll();
  if (g_tp.found) touchLoopOnce();
  else {
    static uint32_t lastMsg = 0;
    if (millis() - lastMsg > 15000) { lastMsg = millis(); logf("[待機] 沒有偵測到觸控板；確認接線後按 t 重試（i 讀ID、c 填色）"); }
    delay(50);
  }
}
