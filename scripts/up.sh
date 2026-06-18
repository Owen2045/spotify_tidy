#!/bin/bash
# 啟動開發環境，統一從 .env.dev 讀取所有環境變數
cd "$(dirname "$0")/../deploy"
docker-compose --env-file .env.dev -f compose.dev.yml up -d "$@"
