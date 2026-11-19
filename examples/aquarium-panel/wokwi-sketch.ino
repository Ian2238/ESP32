// Wokwi 接線檢查（替代用）：Wokwi 沒有 8 位元並列 TFT／UNO 擴充板，改用兩個邏輯分析儀接在同樣的 13 支腳上。
// 依序拉高每一支腳 200 ms，邏輯分析儀（laData=D0..D7、laCtl=RS,CS,WR,RD,RST）應看到依序走過。
const uint8_t pins[13] = {8, 9, 10, 11, 12, 13, 16, 17, 4, 5, 6, 7, 15};
const char* names[13] = {"D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "RS", "CS", "WR", "RD", "RST"};
const uint8_t PIN_FLOAT = 18;  // 浮球開關：INPUT_PULLUP，LOW＝接點閉合
void setup() {
  Serial.begin(115200);
  pinMode(PIN_FLOAT, INPUT_PULLUP);
  for (auto p : pins) pinMode(p, OUTPUT);
}
void loop() {
  for (int i = 0; i < 13; i++) {
    digitalWrite(pins[i], HIGH);
    Serial.printf("%s = GPIO%d HIGH\n", names[i], pins[i]);
    delay(200);
    digitalWrite(pins[i], LOW);
    Serial.printf("float GPIO18 = %s\n", digitalRead(PIN_FLOAT) ? "HIGH(打開)" : "LOW(閉合)");
  }
}
