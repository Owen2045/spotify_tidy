# 專案計畫：Lobster Spotify Agent (龍蝦音樂代理人)

> **架構修訂版 (v2.0)**：導入 React (SPA) 前後端分離與 Docker 多容器 (Multi-Container) 部署架構。

## 1. 核心構想 (Vision)
建立一個部署於 **本地 Mac Mini (或 K8s 叢集)** 的 AI 代理人（龍蝦/OpenClaw），透過 **WhatsApp/Telegram** 接收自然語言指令，以及透過 **React Web UI** 手動操作。系統結合 **RAG (檢索增強生成)** 技術，讓使用者能以「意境、氛圍、情緒」調動個人 Spotify 歌單，並在指定裝置上精準播放。

## 2. 技術棧 (Technical Stack)

| 層級 | 推薦核心實作 / 框架 | 說明 |
| :--- | :--- | :--- |
| **硬體環境** | Mac Mini (支援 Docker / K8s) | 負責 24/7 本地容器化守護進程與本地向量運算。 |
| **反向代理與靜態伺服器** | **Nginx** | 負責託管編譯後的 React 靜態檔案，並負責跨網域轉發 (Reverse Proxy)。 |
| **前端框架 (Frontend)** | **React + TypeScript (Vite)** | 負責提供流暢的音樂播放體驗 (SPA)，不中斷音樂播放。 |
| **後端框架 (Backend)** | **FastAPI + Uvicorn** | 純粹的 API 伺服器，負責與前端及 Agent 進行 JSON 溝通。 |
| **代理人框架** | **OpenClaw (龍蝦)** | 負責通訊橋接 (TG/WA) 與 Tool Calling 執行。 |
| **RAG 引擎 / 向量庫** | **LlamaIndex + ChromaDB** | 處理自然語言轉向量檢索，ChromaDB 採用持久化存在。 |
| **LLM 角色** | **Gemini 3 Pro + GPT-4o** | 負責數據標註 (Labeling) 與複雜任務歸納規劃。 |
| **音樂介面** | **Spotify Web API** | 透過 Spotify Connect 指定 `device_id` 遠端播放 (Spotipy實作)。 |

## 3. 系統架構圖與 Docker 容器配置 (System Infrastructure)

未來的系統將使用 **Docker Compose** 進行多容器化管理 (Multi-Container Architecture)：

*   **[Container 1] Nginx Frontend 容器**：
    *   **建置方式**：Multi-stage build。先在 Node.js 環境中執行 `npm run build` 編譯 React 源碼，之後將產出的靜態檔案 (dist/) 塞入輕量級的 Nginx 伺服器。
    *   **職責**：專職負責將最快速的 UI 畫面派發給瀏覽器，並攔截所有前端路由。

*   **[Container 2] FastAPI Backend 容器**：
    *   **建置方式**：採用 `python:3.13-slim`，僅安裝 API 邏輯與 AI 模型套件。
    *   **職責**：暴露 `8000` port。透過 CORS 規則批准前端請求。負責執行 Spotipy 登入授權、LlamaIndex 檢索搜尋，並將結果回傳給前端。

*   *(未來擴充 Container)* **[Container 3] ChromaDB 向量資料庫容器**：
    *   與 FastAPI 互通，實體資料綁定 (`Volume`) 於主機磁碟上以確保資料持久性。

## 4. 系統工作流程 (System Workflow)

### 第一階段：數據標註與建庫 (Indexing Phase)
1. **數據抓取**：FastAPI 去 Spotify API 獲取用戶歌單 (Track Name, Artist, URI)。
2. **語義化標註**：呼叫 Gemini 產出語義描述 JSON。
3. **向量化存儲**：透過 LlamaIndex 存入 ChromaDB 容器。

### 第二階段：指令與 UI 執行 (Execution Phase - SPA Mode)
1. **指令接收**：使用者在 React 前端介面點擊「查詢」或輸入「播放西方藍調」。
2. **無縫對接**：瀏覽器向 FastAPI 發送異步請求 (XHR/Fetch)，**畫面與音樂絕不重新載入或中斷**。
3. **語意檢索與播放**：FastAPI 查詢 ChromaDB 取得 `spotify_uri`，呼叫 Spotify API 於用戶裝置播放，並將成功結果 JSON 拋回給 React 介面渲染。

## 5. 關鍵設計需求 (Core Requirements)
- **單頁應用程式體驗 (SPA)**：絕對避免畫面的完全重載，維持背景播放條的不中斷。
- **Token 與流量節約**：分離前後端後，API 僅傳遞極少量的 JSON 數據而非整包 HTML。
- **本地化擴展性**：未來透過 Kubernetes (K8s) Pods 部署時，每個容器可獨立分配 CPU / RAM 資源，大幅強化穩定性。

## 6. 待辦開發清單與重構 Roadmap
- [x] **Phase 0**: 基礎 FastAPI 與 Spotify OAuth 完成 (原型驗證)。
- [ ] **Phase 1**: **(正在進行)** 建立 React/Vite 前端目錄，並將原有的 `Jinja2` 與 `StaticFiles` 廢棄，切換為純 API 架構與 CORS 設定。
- [ ] **Phase 2**: 撰寫 Nginx 與 FastAPI 各自專屬的 `Dockerfile`，並編寫統一啟動的 `docker-compose.yml`。
- [ ] **Phase 3**: 開發 Python 腳本實作「Spotify 抓取 + Gemini 標註」流程。
- [ ] **Phase 4**: 實作 LlamaIndex 與 ChromaDB 的 Indexing 邏輯。
- [ ] **Phase 5**: 開發龍蝦的 Skill 插件，將其整合。
