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
- [ ] 廣播中點中央大計時器：兩台聆聽端約 0.9 秒白色淡入淡出，計時不中斷。
- [ ] 點 Q Mark 的 M 編號：對應列捲入畫面，約 1.8 秒柔和閃爍；重新排序後仍提醒正確的資料列。
- [ ] 聆聽端篩選隱藏的列被提醒時暫時顯示，提醒結束恢復原篩選。
- [ ] 快速連點不密集閃爍（提醒間隔至少 1.5 秒）；未廣播時提醒按鈕不發送。
- [ ] 斷線後重連、後加入、背景切回前景均不重播舊提醒。
- [ ] 系統開啟減少動態效果時，提醒改為暫時亮起。
- [ ] OSC bridge 配對與既有控制指令正常。
- [ ] Internet broadcast 另行驗證：公開前端及 sync server 都必須更新，舊伺服器會顯示更新提示。

提醒只提供給當下連線且位於前景的聆聽端。主控顯示的 viewer 數是伺服器送出數，不代表裝置已顯示。

舊版本保存於 `showTimerDesktop/releases/legacy/20261110-091802/`；每次成功打包會把上一個新版放入 `releases/previous/`。舊資料不自動刪除。
