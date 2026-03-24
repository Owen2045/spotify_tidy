# 專案技術棧版本紀錄 (Tech Stack Versions)

為了確保本地裸開發的環境穩定性與未來部署的一致性，本專案 (Lobster Spotify Agent 前後端分離重構) 統一採用以下經過驗證的全新技術版本。

## 🐍 後端 (Backend) - Python & FastAPI
*   **Python**: `3.13.7` (本地開發環境已確認)
*   **FastAPI**: `0.135.1`
*   **Uvicorn**: `0.42.0`
*   *(附屬套件)* **Spotipy**: `2.24.0`

## ⚛️ 前端 (Frontend) - Vite & React 19
*   **Node.js**: `24.x LTS` (本機執行引擎)
*   **npm**: `11.x` (套件管理工具)
*   **Vite**: `8.x` (建置工具)
*   **React**: `19.2.x` (UI 核心與 Hooks 框架)
*   **TypeScript**: `5.9.x` (語言標準)

> **📝 備註 (Notes)**
> - 以上為 2024/2025 業界開發的最新、最主流規格組合。這排除了所有舊版本的技術債（包含 React 18 的渲染包袱，與 Python 3.10 以前的效能限制）。
> - 未來的 `requirements.txt` 與 `package.json` 都將依賴這些版本進行鎖定 (Lock)。
> - 正式環境部署時，Docker image 建置將以此清單為最高基準原則。

---

## 📥 前端初始化與嚴格鎖定指令 (Strict Install Commands)
為了確保未來無論在哪台機器重裝、過幾年重裝，都不會因為 npm 預設的 `^` (允許小版本升級) 而默默跑版，請使用以下**「絕對指定版本」**且加上 `--save-exact` 的指令來取代預設行為：

```powershell
cd frontend
npm create vite@latest . -- --template react-ts

# 絕對鎖定：生產環境核心框架 (--save-exact 會把 package.json 寫死為 19.2.0，不加 ^)
npm install react@19.2.0 react-dom@19.2.0 --save-exact

# 絕對鎖定：開發環境建置與型別工具
npm install vite@8.0.0 typescript@5.9.0 @types/react@19.0.0 @types/react-dom@19.0.0 --save-dev --save-exact
```
