#!/bin/zsh
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo '請先安裝 Node.js 24，再重新啟動。'
  read -r '?按 Enter 關閉'
  exit 1
fi
if [[ ! -f node_modules/ws/index.js ]]; then
  echo '首次設定：下載套件，需要網際網路。'
  npm ci || exit 1
fi
export OSC_HOST=0.0.0.0
echo '啟動 OSC：接受本機與私人區網設備，請保持視窗開啟。'
npm run osc:bridge
if [[ $? -ne 0 ]]; then
  read -r '?啟動失敗，請查看上方訊息。按 Enter 關閉'
fi
