# QLab OSC Control

區網廣播主控（`http://127.0.0.1:8789`）也可搭配此橋接；操作方式相同。

## 啟動

QLab 與 ShowTimer 主控放在同一台 Mac。安裝 Node.js 24，在專案目錄執行：

```sh
npm ci
npm run osc:bridge
```

終端機會顯示橋接位址 `ws://127.0.0.1:8788` 與隨機配對碼。開啟 ShowTimer 的 Tools，在 OSC Control 輸入並連接。配對碼每次啟動重新產生；可透過 `OSC_TOKEN` 環境變數指定固定值，但勿提交至 Git。

主控須保持頁面在前景；背景收到的指令會忽略，避免切回頁面時執行過期的 Next。橋接程式不是計時主機，計時仍由 PWA 網頁管理。

## QLab Network Cue

在 QLab 建立 OSC 的 UDP Network Patch：

- Destination：`127.0.0.1`
- Port：`53001`（這是本橋接程式接收埠，不是 QLab 自己的接收埠）

建立 Network Cue，選擇此 patch，依動作發送：

| 位址 | 行為 |
|---|---|
| `/showtimer/start` | 開始 Ready 的段落；Running/Paused/Finished 時忽略 |
| `/showtimer/pause` | 暫停；已暫停則不重複建立紀錄 |
| `/showtimer/resume` | 恢復；已執行則不重新開始 |
| `/showtimer/next` | 結束目前段落；最後一段完成演出；暫停中忽略 |
| `/showtimer/mark` | 新增淨演出時間 Q Mark；暫停中忽略 |

不帶參數，或使用單一 int/float `1`。數值 `0` 視為按鈕放開，不觸發。支援 OSC `T` 與 immediate bundle（timetag 1）；未支援未來排程 bundle、wildcard、多參數。請讓 QLab 自己排程單獨的 cue。

相同指令 500ms 內去重。這是短時間防重保護，OSC/UDP 本身沒有 exactly-once 保證；不要重送 Next 當作確認機制。橋接不排隊、不在重連後補發指令。此版為 OSC 輸入控制，未加入 OSC 狀態回送。

## 瀏覽器限制與本機備用方式

Chrome/其他瀏覽器可能要求網站存取本機網路的權限；請允許。若線上 HTTPS 網頁無法連接本機 `ws://`，可使用橋接提供的本機主控：

```sh
npm run build
npm run osc:bridge
```

開啟 `http://127.0.0.1:8788/`。它提供同一份前端，並能連接本機橋接；雲端觀看仍填 WSS 服務網址。本機 origin 與 GitHub Pages 的資料各自獨立，請先從原網站匯出 Show File，再在本機匯入；演出進行中不要切換 origin。

可用 `OSC_PORT`、`OSC_WS_PORT` 修改連接埠。若變更網頁來源，需在 `ALLOWED_ORIGINS` 加入實際 origin。WebSocket 只綁定 loopback，UDP 預設也僅接受本機。如需遠端設備，可明確設定 `OSC_HOST=0.0.0.0` 並限制場地防火牆；UDP 沒有認證，請勿對公網開放。

已以真實 UDP 封包與瀏覽器自動化驗證；尚未操作實際 QLab 應用程式。演出前請在目標 Mac／瀏覽器／QLab 版本測試開始、暫停、恢復、換段、斷線及重連。
