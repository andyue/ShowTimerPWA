# ShowTimer

React / TypeScript 演出計時器，前端維持 GitHub Pages 部署。

## 區網廣播試用

現場電腦與手機連同一個 Wi-Fi。Windows 安裝 [Node.js 24](https://nodejs.org/download/release/latest-v24.x/) 後，雙擊 `Start-LAN-Windows.cmd`；首次會下載依賴，之後可無外網啟動。
在現場電腦開啟 `http://127.0.0.1:8789/`，Tools → 區網廣播 → 開啟區網廣播，再用手機掃碼。
Mac／命令列可使用 `npm ci`（首次）與 `npm run lan`。

[完整步驟、試用檢查與主機更新方式](docs/lan.md)。不需固定公開 IP 或雲端服務；這是信任區網內的 HTTP 試用模式。

## 本機開發

需要 [Node.js 24](https://nodejs.org/download/release/latest-v24.x/)。

```sh
npm ci
npm run dev
```

## 最新更新

[2026-10-30 Release notes：Sub timer 技術執行計時、Qmark 排序與演出防誤按](CHANGELOG.md)

## 既有功能

- 暫停／恢復：淨演出時間不包含暫停；本次與累計暫停另外計算。
- 每次暫停保留起訖時間與可事後編輯的原因，完成紀錄同時顯示淨演出、暫停和總耗時。
- 暫停中的「結束本段」會確認後結算最後一次暫停；正常 Next 與 OSC Next 在暫停時不執行。
- Q Mark 使用淨演出時間，暫停時不能新增。
- 執行中與暫停中的狀態可在同一瀏覽器重新整理後恢復。進行中不允許新增、刪除或重排段落。
- JSON v2 與 CSV 保留暫停明細，也可讀取既有 v1 檔案。
- 一台主控、多台唯讀觀看；預設包含全部 Q Marks 與備註，新增／修改／刪除即時同步；支援 QR Code、晚加入、重連、時間校正與離線提示。
- TouchOSC／QLab OSC 控制：start、pause、resume、next、mark。橋接程式需要在主控 Mac 上執行。

目前專案為瀏覽器網頁，尚未配置離線 Service Worker 或安裝用 manifest；加入主畫面不代表可保證離線啟動。

## 廣播 與 OSC Control測試中 -- 使用與設定

- [區網廣播操作步驟](docs/lan.md)
- [雲端廣播部署與使用](docs/broadcast.md)
- [TouchOSC／QLab OSC 設定](docs/osc.md)

雲端廣播需先建立同步服務。未設定服務時，本機計時與暫停功能仍可用。

## 驗證

```sh
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build:pages
```

單元／整合測試包含毫秒精度、多次暫停、CSV／JSON 相容、WebSocket 權限、主控重連與真實 UDP OSC。
瀏覽器測試包含暫停恢復、重載保存、手機觀看端、廣播重連及模擬 QLab 指令。
實際 QLab、iOS Safari 與場地網路仍需現場驗收。

## 部署

推送 `main` 後 GitHub Actions 先執行 lint、單元／整合測試與瀏覽器測試，再建置並發布 GitHub Pages。
同步服務為獨立 Node.js 程式，不會由 Pages 自動代管；OSC 橋接也不會部署至 Pages。

Windows／Mac 的 OSC 安裝更新工具與日常啟動檔，可見 [OSC 控制說明](docs/osc.md)。支援同一區網的 TouchOSC 與 OSC/UDP 遙控器。
