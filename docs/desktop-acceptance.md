# Desktop / PWA 人工驗收清單

新版 Desktop：`showTimerDesktop/dist/ShowTimerDesktop.app`。此清單由使用者操作；本次未執行按鈕測試。

- [ ] 開啟新版、關閉後重開，Show File 與設定仍保留。
- [ ] VS Code 選擇專案 `.venv`，Cmd+Shift+B 可完成新版打包。
- [ ] 工具列、對話框、錯誤提示均為英文；中央名稱為 **Sub Timer record**。原有中文演出名稱、筆記保留。
- [ ] PWA 匯出的 `.showtimer.csv`、`.showtimer.json` 可匯入 Desktop；Desktop 匯出的檔案可回到 PWA。
- [ ] 舊版 XLSX / 儲存專案可由 Desktop 匯入，確認時間、段落、M 編號與筆記。
- [ ] Start / Pause / Resume / Next / Finish / Reset 正常；暫停不增加演出淨時間。
- [ ] Sub Timer 開始、停止、筆記與記錄正常。
- [ ] Q Mark 新增、時間修改、排序、筆記、標籤篩選正常。
- [ ] LAN broadcast：同網路兩台聆聽端掃碼後可同步，聆聽端無控制演出權限。
- [ ] 廣播中點中央大計時器：Master / Client 邊緣紅框每秒閃 4 次，持續直到再次點擊。
- [ ] 點 Q Mark 編號：Client 只顯示該 Note 文字與紅框；空白 Note 不補上編號或時間。
- [ ] 再點同一編號或大時鐘：綠框持續 4 秒後恢復原畫面；點另一編號可切換 Note。
- [ ] 用 `=` 觸控／滑鼠拖曳 Q，Note 與時間隨原 Q 移動，重整後順序保留。
- [ ] 斷線時提示消失；Client 重連／後加入取得目前提示，已結束提示不重播。
- [ ] OSC bridge 配對與既有控制指令正常。
- [ ] Internet broadcast 另行驗證：Master 與 Client 都重新整理取得新版；既有 sync server 可沿用。

持續提醒僅在 Client 連線同步、主控在線且快照未過期時顯示。

舊版本保存於 `showTimerDesktop/releases/legacy/20261110-091802/`；每次成功打包會把上一個新版放入 `releases/previous/`。舊資料不自動刪除。
