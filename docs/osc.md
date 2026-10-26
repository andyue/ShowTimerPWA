# OSC Control：Windows／Mac、TouchOSC 與 QLab

PC 與 Mac 都可以執行 OSC 橋接。TouchOSC 或其他能發送 OSC/UDP 的控制器可從同一個私人區網控制主控；同機的 QLab 仍可使用 localhost。一般鍵盤／藍牙簡報器／MIDI 裝置不會自動變成 OSC，需要另外映射或轉換。

## 安裝或更新（需要網路）

先安裝 [Node.js 24](https://nodejs.org/download/release/latest-v24.x/)，備份 Show File，並停止現有區網主機與 OSC 橋接。從 Tools 最底下下載：

- [Windows OSC 安裝／更新工具](https://andyue.github.io/ShowTimerPWA/downloads/Update-OSC-Windows.cmd)
- [Mac OSC 安裝／更新工具](https://andyue.github.io/ShowTimerPWA/downloads/Update-OSC-Mac.command)

執行後會下載已通過測試與部署的完整版本、安裝套件、建置網頁，接著啟動 OSC 橋接。新版存於使用者家目錄的 `ShowTimer/versions/版本號-隨機碼`，舊版保留。`ShowTimer/latest-installed.txt` 記錄新版位置。廣播與 OSC 共用同一份專案，不需要分別安裝兩套；一般主機更新工具也會更新 OSC 程式。

Mac 初次若無法雙擊，請在終端機輸入 `zsh `，把 `.command` 檔拖入再按 Enter；也可先設定執行權限，詳見[更新說明](lan.md)。

## 日常啟動（已安裝套件後可離線）

到新版資料夾：

1. 要使用區網廣播，先執行 `Start-LAN-Windows.cmd`／`Start-LAN-Mac.command`。
2. 另外開啟 `Start-OSC-Windows.cmd`／`Start-OSC-Mac.command`，保留兩個終端機視窗。
3. 在主控電腦開啟 `http://127.0.0.1:8789/`，到 Tools 的 OSC Control，輸入橋接顯示的配對碼，按「連接 OSC」。橋接網址預設 `ws://127.0.0.1:8788`。
4. 先測試開始、暫停、恢復與 Q Mark，再用於演出。結束時在各終端機按 Ctrl+C。

若只需 OSC、不廣播，更新工具已建置網頁，可直接開啟 `http://127.0.0.1:8788/` 並配對；這與 `8789`、線上網站是不同儲存來源，需匯入 Show File，演出中不要切換網址。手動下載專案者先執行 `npm ci` 和 `npm run build:lan`。

配對碼每次啟動重新產生；可用 `OSC_TOKEN` 環境變數固定，但勿提交至 Git。主控須保持頁面在前景；背景收到的指令會忽略，避免切回頁面執行過期的 Next。橋接程式不是計時主機，計時仍由網頁管理。

## TouchOSC／區網 OSC 遙控器

1. 控制器與電腦連到同一個信任的 Wi-Fi／區網，避開訪客隔離網路。
2. 執行上面的 OSC 啟動檔，終端機會列出 `TouchOSC / remote destination`。選與手機同一網路的電腦 IP。
3. TouchOSC 的 Connections → OSC，啟用一組連線：Type 選 **UDP**、Host 填**電腦區網 IP**（例如 `192.168.1.20`），Send Port 填 **53001**。手機不要填 `127.0.0.1`，也不要把 `0.0.0.0` 當目的位址。
4. 建立五個按鈕，OSC address 分別填下表指令；按下傳送單一 int 或 float `1`，放開 `0`。選用瞬時按鈕，避免 toggle 按鈕每隔一次才觸發。
5. 主控完成配對並保持前景後，按鈕即可操作計時與 Q Mark。本版不回傳 OSC 狀態，請以主控或廣播畫面確認結果。

設定欄位參考 [TouchOSC 官方 OSC 連線說明](https://hexler.net/touchosc/manual/connections-osc)。這裡直接使用 TouchOSC 的 OSC/UDP 連線，不需另外安裝用於 MIDI 的 TouchOSC Bridge。

Windows 若出現防火牆提示，只允許可信任的**私人網路**。若仍收不到，檢查 Node.js 的私人網路入站規則與 UDP 53001；不需要開放公用網路或路由器 port forwarding。Mac 若詢問 Node 的傳入網路連線，請允許。瀏覽器若詢問區域網路存取，也需允許。

啟動檔啟用 `OSC_HOST=0.0.0.0` 以接收區網封包，但程式只處理來源為 localhost 或私人 IPv4 的訊息。UDP OSC 沒有密碼認證，主控配對碼只保護瀏覽器到橋接的連線，因此請只在可信任區網使用。

## 僅接收同機 OSC（進階）

不需要區網控制時，可在專案資料夾執行 `npm run osc:bridge`，預設只綁定 `127.0.0.1`；先清除環境中已設定的 `OSC_HOST`。自訂連接埠可用 `OSC_PORT` 與 `OSC_WS_PORT`；更換主控網頁來源時，也要調整 `ALLOWED_ORIGINS`。WebSocket 始終只接受本機連線。

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


已以真實 UDP 封包與瀏覽器自動化驗證，並在 Windows／macOS CI 測試橋接。尚未實際操作 TouchOSC、QLab 或硬體遙控器；演出前請在目標設備驗證按下／放開、暫停／恢復、換段與重連。
