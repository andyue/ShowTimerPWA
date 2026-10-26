#!/bin/zsh
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo '請先安裝 Node.js 24：https://nodejs.org/download/release/latest-v24.x/'
  read -r '?按 Enter 關閉'
  exit 1
fi
echo '請先匯出 Show File 備份，並用 Ctrl+C 停止區網主機與 OSC 橋接。'
echo '新版將安裝在使用者資料夾內的 ShowTimer，舊版會保留。'
read -r '?按 Enter 開始更新，或按 Ctrl+C 取消'
update_temp=$(mktemp -d "${TMPDIR:-/tmp}/showtimer-bootstrap.XXXXXX") || exit 1
trap 'rm -rf "$update_temp"' EXIT
if curl --fail --location --proto '=https' --tlsv1.2 --connect-timeout 15 --max-time 120 'https://raw.githubusercontent.com/andyue/ShowTimerPWA/main/scripts/update-lan.mjs' -o "$update_temp/update.mjs"; then
  node "$update_temp/update.mjs"
  result=$?
else
  result=1
fi
if [[ $result -ne 0 ]]; then
  echo '更新或啟動失敗；舊版仍保留。請查看上方錯誤訊息。'
fi
read -r '?按 Enter 關閉'
exit $result
