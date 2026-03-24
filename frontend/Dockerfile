FROM node:24-slim

WORKDIR /app

# 複製依賴檔並安裝 (若存在)
COPY package.json* package-lock.json* ./
RUN if [ -f "package.json" ]; then npm install; fi

# 複製其餘源碼
COPY . .

# 開發環境下，這行指令多數會被 docker-compose 的 command 蓋過
# Vite 需要綁定 0.0.0.0 才能讓容器外的宿主機存取
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
