// 說話機器人板（一般 44 腳 ESP32-S3 N16R8，FTDI A5069RR4A，MAC 68:ee:8f:4b:fa:58）← 2.4" UNO 觸控 TFT 擴充板（8 位元並列）
// 腳位表固定（見 wiring/wiring-uno-tft-s3.png）：
//   LCD_RS=GPIO4  LCD_CS=GPIO5  LCD_WR=GPIO6  LCD_RD=GPIO7  LCD_RST=GPIO15
//   LCD_D0=8 D1=9 D2=10 D3=11 D4=12 D5=13 D6=16 D7=17      5V→5Vin  GND→GND
// 觸控（電阻式四線）跟 RS、CS、D0、D1 共用腳（標準 MCUFRIEND 接法）；RS/CS 在 ADC1，D0/D1(GPIO8/9) 也是 ADC1。
#pragma once
#include <stdint.h>

#define PIN_LCD_RS   4
#define PIN_LCD_CS   5
#define PIN_LCD_WR   6
#define PIN_LCD_RD   7
#define PIN_LCD_RST  15
#define PIN_LCD_D0   8
#define PIN_LCD_D1   9
#define PIN_LCD_D2   10
#define PIN_LCD_D3   11
#define PIN_LCD_D4   12
#define PIN_LCD_D5   13
#define PIN_LCD_D6   16
#define PIN_LCD_D7   17
#define PIN_FLOAT_SWITCH 18   // 浮球開關（魚缸控制盤）：另一線接 GND，INPUT_PULLUP

namespace uno {
// 觸控腳位偵測：先試最標準的 4 支（RS、CS、D0、D1），找不到才加上 D6、D7（少數擴充板用 D6/D7）。
static constexpr uint8_t kTouchPrimary[4]  = {PIN_LCD_RS, PIN_LCD_CS, PIN_LCD_D0, PIN_LCD_D1};
static constexpr uint8_t kTouchExtended[6] = {PIN_LCD_RS, PIN_LCD_CS, PIN_LCD_D0, PIN_LCD_D1, PIN_LCD_D6, PIN_LCD_D7};
static constexpr uint8_t kLcdPins[13] = {PIN_LCD_D0, PIN_LCD_D1, PIN_LCD_D2, PIN_LCD_D3, PIN_LCD_D4, PIN_LCD_D5,
                                         PIN_LCD_D6, PIN_LCD_D7, PIN_LCD_RS, PIN_LCD_CS, PIN_LCD_WR, PIN_LCD_RD, PIN_LCD_RST};

constexpr bool pinOk(uint8_t p) {  // 不可碰：USB 19/20、OPI PSRAM 35-37、strapping 0/3/45/46、UART0 43/44、flash 26-32
  return !(p == 0 || p == 3 || p == 19 || p == 20 || p == 43 || p == 44 || p == 45 || p == 46 || (p >= 26 && p <= 37));
}
constexpr bool allPinsOk() {
  for (uint8_t p : kLcdPins) if (!pinOk(p)) return false;
  return true;
}
constexpr bool allDistinct() {
  for (int i = 0; i < 13; i++) for (int j = i + 1; j < 13; j++) if (kLcdPins[i] == kLcdPins[j]) return false;
  return true;
}
static_assert(allPinsOk(), "腳位撞到 USB／PSRAM／strapping／UART0");
static_assert(pinOk(PIN_FLOAT_SWITCH) && PIN_FLOAT_SWITCH != PIN_LCD_RS && PIN_FLOAT_SWITCH != PIN_LCD_CS && PIN_FLOAT_SWITCH != PIN_LCD_D0 && PIN_FLOAT_SWITCH != PIN_LCD_D1, "浮球腳不能跟觸控共用腳");
static_assert(allDistinct(), "腳位重複");
}  // namespace uno
