#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo '請先安裝 Node.js 24，再重新啟動。'
  read -r '?按 Enter 關閉'
  exit 1
fi
if [[ ! -f node_modules/vite/bin/vite.js ]]; then
  echo '首次設定：下載套件，需要網際網路。'
  npm ci || exit 1
fi
npm run lan
if [[ $? -ne 0 ]]; then
  read -r '?啟動失敗，請查看上方訊息。按 Enter 關閉'
fi
