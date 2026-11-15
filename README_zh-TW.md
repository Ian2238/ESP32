# 接線實驗室（wiring-demo）

互動 3D 接線演示。版面參考 learn-esp32.vercel.app（3D 板子放在麵包板上、浮動標註、右側說明面板、程式＋序列埠、下方課程列），
但程式、3D 模型和圖都是自己寫的，沒有用對方的原始碼或素材。three.js r136 放在 `js/lib/`，**完全離線可用**，不需要 CDN。

## 首頁：自己組（builder-v1）
- 打開網頁（或網址 `#build`）就是一張空白麵包板。「組裝」分頁：① 選開發板（一般 44 腳 S3、S3 CAM、ESP32 DevKitC 38 腳）② 從零件庫按「＋」加模組（可加多個、按 ✕ 移除、「清空」重來）。
- 加了零件就會自動擺上麵包板、分配 GPIO、拉線，接線表變成「零件｜零件腳｜接到板子腳位｜線色｜備註」，程式分頁出 `#define` 腳位和 setup 骨架；步驟一樣可以一條一條亮。
- 自動配線規則：電源預設 3V3（只有伺服、繼電器、WS2812、超音波、PIR、雷達用 5V，走右下＋軌）；類比只接 ADC1；不用 strap（S3：0/3/45/46）、Flash／PSRAM（S3 N16R8：26–37）、USB（19/20）、UART0；S3 CAM 避開相機腳 4–13、15–18；I2C 共用 SDA／SCL，SPI 共用 SCK／MOSI、每個裝置各自 CS；LED 串 220Ω、DS18B20 上拉 4.7k、按鈕／浮球可加 10k 上拉；腳位或麵包板空間不夠會跳警告。
- 組好的內容存在瀏覽器 localStorage。程式碼在 `js/builder.js`（零件庫 `PARTS`、各板可用腳位 `PROF`）。
- 下方「範例」是原本的三個專案（蒙娜麗莎、CAM＋OLED、氣候站），網址 `#monalisa` 等照舊。
- 測試：`node tools/validate.js`（含自己組自動配線檢查：短路、同孔、禁用腳、類比在 ADC1）、`node tools/ui-test.js`（點擊測試）、`node tools/shot.js build`（截圖）。

## 打開
- 直接雙擊 `index.html`（電腦）。新專案：`#s3-climate`（OLED＋DHT11＋HW-498 NTC）。iPhone：把整個資料夾放到 iCloud 雲碟沒辦法直接跑 JS，建議用下面「放上網」的方式，或電腦開 `python3 -m http.server` 後用手機連。
- 網址後面加 `#monalisa`、`#cam-oled` 切換專案；`#monalisa/5` 直接跳到第 5 步。
- 鍵盤：← → 上一步／下一步，Esc 全部顯示。

## 功能
- 3D：旋轉、縮放、拖曳；滑鼠移到（手機點）板子腳位、模組、線、麵包板孔，會顯示 GPIO、孔名、同一欄還接了什麼。
- 步驟：一次亮一條線（線會畫出來、其他線變淡、鏡頭自動對過去），顯示「5 / 19」、上一步／下一步／全部顯示。
- 右側分頁：步驟、接線表（線色／板子腳位／GPIO／模組腳位／說明）、程式（可複製＋模擬）、注意（安全＋待確認＋自動核對結果）、腳位圖。
- 條紋線＝預定、還沒接；黃色「待確認」標籤＝有沒確認的事。
- 模擬：程式分頁按 ▶，會讓 3D 裡的燈／OLED 動起來，訊號沿著線跑，並印出假的序列埠訊息（只是示意）。

## 新增一個專案
1. 複製 `projects/cam-oled.js` 改名，例如 `projects/aquarium.js`。
2. 在 `index.html` 最下面加一行 `<script src="projects/aquarium.js"></script>`。
3. 執行 `node tools/validate.js`：會依板子實際腳序重算每條線接到哪支 GPIO、哪支模組腳，對不上或同一欄短路會列出來。
4. 執行 `node tools/shot.js`（需要 /workspace/pw 的 playwright）截圖檢查。

設定檔重點：
```js
WD.addProject({
  id: 'aquarium', title: '…', short: '…', status: 'ok' | 'planned',
  board: { type: 's3_44' | 's3_cam', top: 'L:J2', bottom: 'R:C2' },   // 上排第 1 腳、下排第 1 腳插的孔
  modules: [{ id, type: 'tft'|'oled'|'rgbled'|'dht11'|'ntc'|'hw498'|'generic', name, short, at: 'R:I40', pins: ['GND','VCC',…], status }],
  wires: [{ id, label, func: 'pwr'|'gnd'|'sig', color, from: 'L:I3', to: 'R:G42', pin: '14', modPin: 'SCL', status: 'ok'|'planned'|'tbd', note, tbd }],
  // 電阻：{ kind: 'resistor', from, to, value: '220Ω' }
  steps: [{ title, text, wires: [...], modules: [...], warn }],         // 不寫就自動一線一步
  callouts: [{ target: 'board'|'usb'|'antenna'|'camera'|'module:<id>', title, text, dx, dy }],
  safety: [...], tbd: [...], sources: '…', code: `…`,
  sim: { label, run: async (api) => { api.led(id,[r,g,b]); api.pulse([wireId]); api.screen(id, drawFn); api.log('…'); await api.wait(ms); } }
});
```
孔名：`L:I17`＝左麵包板 I 排第 17 欄，`R:G59`＝右麵包板 G 排第 59 欄，電源軌 `L:r1:5`（r1/r4＝＋，r2/r3＝−）。
板子腳位在 `js/boards.js`（USB 在左、元件朝上，上排、下排由左到右）。新板子就加一筆。

## 板子腳序（`js/boards.js`）
- 一般 44 腳 S3（蒙娜麗莎）：上排 GND 5Vin 14 13 12 11 10 9 46 3 8 18 17 16 15 7 6 5 4 RST 3V3 3V3；下排 GND GND 19 20 21 47 48 45 0 35 36 37 38 39 40 41 42 2 1 RX TX GND。來源：monalisa-devtest-v16-ticker/wiring、v0.5 接線圖（已在實機用）。
- S3 CAM（OV3660）：上排 5V 14 13 12 11 10 9 46 3 8 18 17 16 15 7 6 5 4 EN 3V3 3V3；下排 GND 19 20 21 47 48 45 0 35 36 37 38 39 40 41 42 2 1 RX TX GND。來源：Ian 提供。

## 放上網（還沒做）
整個資料夾是純靜態檔，可以直接放 GitHub Pages、Vercel、Netlify 或 Cloudflare Pages。需要 Ian 同意，且要用個人帳號 pollikm111，再發布。
