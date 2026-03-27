FROM node:24-slim

WORKDIR /app

# 複製依賴檔並安裝 (若存在)
COPY package.json* package-lock.json* ./
RUN if [ -f "package.json" ]; then npm install; fi

# 複製其餘源碼
COPY . .

# 開發環境下，配合外部既有架構，允許外部連線進入
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
