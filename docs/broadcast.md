# 計時畫面廣播

如果只需同一個場地／Wi-Fi 廣播，可以改用 [區網模式](lan.md)，不必部署雲端服務。

## 架構

GitHub Pages 提供主控與觀看網頁。`server/sync.mjs` 是可部署在託管平台的 Node.js WebSocket 服務，保存目前狀態並推送給觀看端。無需把整個前端搬離 GitHub Pages。

這個版本提供自有同步服務程式，不需 Supabase/Firebase 專案。雲端帳號與服務尚未代為建立，設定好後即可使用。

主控送出狀態變更及每 3 秒一次心跳，觀看端依時間基準自行更新畫面。連線時往返量測校正裝置時差；這不是影格精準的 timecode，網路延遲仍會影響狀態切換。

## 在 Render 或其他 Node.js 平台部署

1. 建立 Web Service，連接本 repository。
2. 使用 Node.js 24；Build command：`npm ci --omit=dev`；Start command：`npm run sync:server`。
3. 設定以下環境變數：

| 變數 | 值 |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PORT` | 使用平台提供值；本機預設 8787 |
| `ALLOWED_ORIGINS` | `https://andyue.github.io`，自訂網域時改成實際 origin，不含路徑；多個以逗號分隔 |
| `CREATE_KEY` | 自行產生的長隨機金鑰，只交給操作主控的人 |
| `DATA_FILE` | 建議設定為持久磁碟上的 `/var/data/showtimer/rooms.json` |

4. 健康檢查路徑設為 `/health`。
5. **只執行一個 instance**。若使用持久磁碟，將上述目錄掛載於持久磁碟；若未設定 `DATA_FILE`，重啟或部署服務會清除房間，需要重新分享觀看連結。
6. 取得平台的 HTTPS 網址後，將協定改為 `wss://`，填入 ShowTimer Tools 的「同步服務位址」。
7. 在 Tools 輸入 `CREATE_KEY`，按「開啟廣播」。掃描 QR Code 或分享唯讀觀看連結。

可在 GitHub repository 的 Actions variables 設定 `VITE_SYNC_URL` 作為預設位址；不設定也可在 Tools 手動填入。**不要把 CREATE_KEY 或主控憑證設成 VITE 環境變數**，因為建置後任何人都能讀到。

平台費用、休眠策略請依方案自行確認。正式演出選擇不休眠的服務，避免演出中重部署。

參考：[Render Node.js 部署](https://render.com/docs/deploy-node-express-app)、[Render WebSocket](https://render.com/docs/websocket)。

## 本機測試

分別開啟兩個終端機：

```sh
npm run dev
```

```sh
npm run sync:server
```

瀏覽器開 `http://localhost:5173`，服務位址填 `ws://localhost:8787`，本機預設金鑰留空。這個 localhost 連結僅能在同一台電腦使用；要讓手機觀看，請先部署 WSS 服務。

## 權限與恢復

- 建立房間金鑰只在此次連線期間留於記憶體；房間主控憑證放在 sessionStorage，重新整理後可接回。關閉分頁後可能無法接回，請重新建立房間。
- 觀看連結只包含隨機觀看 token，以 URL fragment 分享；不含主控 token，也不允許 publish/end 或 OSC 控制。
- 同一房間只允許一個主控連線。複製主控分頁若出現衝突，關閉其他主控後重新連線。
- 觀看連結屬持有連結即可觀看。不要公開分享私人演出連結；停止廣播即可撤銷。
- 主控的 project、Q Marks、備註不會整份上傳；只同步演出名稱、目前／下一段、狀態及計時基準。
- 斷線時觀看端保留最後狀態並顯示「時間僅供參考」；可能不知道主控已暫停或換段。重連取完整狀態，不補執行舊操作。
- 房間最後更新後 24 小時到期。停止廣播時立即移除房間；若停止時沒有連線，遠端房間會等到期才清除，觀看端顯示主控離線。
- 服務有封包大小、訊息速率與最多 100 個房間限制。公開大規模使用需另外設置入口限流及共用資料庫，目前設計為單一服務的小型演出使用。
- 手機應維持觀看頁在前景，可按「保持螢幕亮起」。系統可拒絕或撤銷，回前景會重新同步。
- 請只在一個分頁操作同一台裝置的本機 Show File，以免 localStorage 互相覆寫。
