/* 板子定義：腳位順序以 Ian 實板為準。
 * top / bottom：USB 在左、元件朝上時，由左到右的腳位標示。
 * 44 腳一般 S3：沿用 /workspace/monalisa-devtest-v16-ticker/wiring（gen2d.py / gen3d.py）與 v0.5 接線圖，
 *   已用在蒙娜麗莎實機（TFT／RGB 燈能正常動作）。
 * S3 CAM：Ian 提供的腳位（每排 21 腳），相機佔用腳取自 cam-stream/camera_pins.h（程式設定，未實機量測）。
 */
window.WD = window.WD || {};
WD.BOARDS = {
  s3_44: {
    name: 'ESP32-S3 一般 44 腳（N16R8）',
    short: 'ESP32-S3 44 腳',
    color: '#1c2430',
    top:    ['GND','5Vin','14','13','12','11','10','9','46','3','8','18','17','16','15','7','6','5','4','RST','3V3','3V3'],
    bottom: ['GND','GND','19','20','21','47','48','45','0','35','36','37','38','39','40','41','42','2','1','RX','TX','GND'],
    pcb: { before: 1.6, after: 4.6, margin: 0.55 },   // 以麵包板孔距為單位：第一腳前、最後一腳後、排外側
    features: ['module', 'usb2', 'buttons'],
    usbNote: '兩個 USB-C：一個是 CH343 序列口（log 從這裡出來），一個是原生 USB。哪一個在上、哪一個在下 待確認。',
    sources: '腳序：monalisa-devtest-v16-ticker/wiring/gen2d.py、v0.5 接線圖；已在蒙娜麗莎實機使用。',
    pinNotes: {
      '5Vin': '5V 電源腳（USB 的 5V）。3.3V 的模組不要接這裡！',
      '3V3': '3.3V 輸出，給 TFT、感測器用。',
      'GND': '接地。所有模組的 − 都要接到這裡。',
      'RST': '重置腳（EN），一般不要接東西。',
      '0': 'Strap 腳（開機模式），盡量不要接會被拉低的東西。',
      '3': 'Strap 腳（JTAG 來源），盡量不用。',
      '45': 'Strap 腳（VDD_SPI 電壓），不要接會改變電位的東西。',
      '46': 'Strap 腳（開機訊息），盡量不用。',
      '19': '原生 USB D−，用原生 USB 時不要接。',
      '20': '原生 USB D+，用原生 USB 時不要接。',
      '35': 'N16R8 的 OPI PSRAM 佔用，不能用。',
      '36': 'N16R8 的 OPI PSRAM 佔用，不能用。',
      '37': 'N16R8 的 OPI PSRAM 佔用，不能用。',
      '48': '很多 S3 板把板載 RGB 燈接在這腳，這塊板是否如此 待確認。',
      'RX': 'UART0 RX（GPIO44），序列 log 用。',
      'TX': 'UART0 TX（GPIO43），序列 log 用（CH343 那個口）。'
    }
  },
  s3_cam: {
    name: 'ESP32-S3-N16R8 CAM（OV3660）',
    short: 'ESP32-S3 CAM',
    color: '#202a1e',
    top:    ['5V','14','13','12','11','10','9','46','3','8','18','17','16','15','7','6','5','4','EN','3V3','3V3'],
    bottom: ['GND','19','20','21','47','48','45','0','35','36','37','38','39','40','41','42','2','1','RX','TX','GND'],
    pcb: { before: 1.6, after: 3.2, margin: 0.55 },
    features: ['module', 'usb1', 'camera', 'buttons'],
    usbNote: 'USB 在左邊（Ian 提供的方向：USB 左、元件朝上）。',
    sources: '腳序：Ian 提供（每排 21 腳）。相機腳：cam-stream/camera_pins.h CAMERA_MODEL_ESP32S3_N16R8。',
    camUsed: ['4','5','6','7','8','9','10','11','12','13','15','16','17','18'],
    pinNotes: {
      '5V': '5V 電源腳。3.3V 的模組不要接這裡！',
      '3V3': '3.3V 輸出。',
      'GND': '接地。',
      'EN': '重置腳，一般不要接東西。',
      '14': '不在相機腳裡。但有些 CAM 版本把板載燈接在 GPIO14，這塊板是否如此 待確認。',
      '21': '一般 GPIO，不是 strap／USB／PSRAM。',
      '0': 'Strap 腳（BOOT 鍵），不要接。',
      '3': 'Strap 腳，盡量不用。',
      '45': 'Strap 腳，不要接。',
      '46': 'Strap 腳，盡量不用。',
      '19': '原生 USB D−，不要接。',
      '20': '原生 USB D+，不要接。',
      '35': 'OPI PSRAM 佔用，不能用。',
      '36': 'OPI PSRAM 佔用，不能用。',
      '37': 'OPI PSRAM 佔用，不能用。',
      '48': '可能是板載 RGB 燈，待確認。',
      '38': '有些版本的 RGB 燈腳，待確認。',
      'RX': 'UART0 RX（GPIO44）。',
      'TX': 'UART0 TX（GPIO43）。'
    }
  }
};
