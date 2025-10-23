## 建環境

### 建.env檔
PROJECT_NAME=spotify_tidy
ENV=dev

### 執行
.\setup_env.ps1

### spotify dashboard
https://developer.spotify.com/dashboard/6b4ec9b36492403fa8c0e6ed557f8347

### 進虛擬環境
.\venv_spotify_tidy\Scripts\Activate.ps1

### 啟動
uvicorn main:app --host 127.0.0.1 --port 8765 --reload