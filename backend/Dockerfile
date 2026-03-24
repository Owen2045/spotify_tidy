FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# 複製依賴檔並安裝 (若存在)
COPY requirements.txt* ./
RUN if [ -f "requirements.txt" ]; then pip install --no-cache-dir -r requirements.txt; fi

# 複製其餘源碼
COPY . .

# 開發環境下，這行指令多數會被 docker-compose 的 command 蓋過
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
