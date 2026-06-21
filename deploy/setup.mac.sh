#!/bin/bash
# Mac mini 初始化腳本
# 用途：新機器或重裝後，一次設定好所有環境
# 執行：bash setup.mac.sh

set -e

BREW="/opt/homebrew/bin/brew"
DOCKER="/opt/homebrew/bin/docker"
DOCKER_COMPOSE="/opt/homebrew/bin/docker-compose"

echo "=== [1/4] 確認 Ollama ==="
if ! $BREW list ollama &>/dev/null; then
  $BREW install ollama
fi
$BREW services start ollama
sleep 3

echo "=== [2/4] 拉取 bge-m3 模型 ==="
/opt/homebrew/bin/ollama pull bge-m3

echo "=== [3/4] 確認 Colima / Docker ==="
if ! $DOCKER info &>/dev/null; then
  /opt/homebrew/bin/colima start
fi

echo "=== [4/4] 啟動 Docker 服務 ==="
cd ~/spotify_tidy/deploy
$DOCKER_COMPOSE --env-file .env.dev -f compose.mac.yml up -d

echo ""
echo "=== 完成 ==="
echo "Ollama:   http://localhost:11434"
echo "Frontend: http://localhost"
echo "Auth:     http://localhost/auth"
echo "Spotify:  http://localhost/spotify"
echo "NLP:      http://localhost/nlp"
