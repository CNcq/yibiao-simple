# ========== 阶段1：构建前端 ==========
FROM node:18-alpine AS frontend-builder

# 设置工作目录
WORKDIR /app/frontend

# 复制前端项目文件
COPY frontend/package*.json ./
COPY frontend/tsconfig.json ./
COPY frontend/tailwind.config.js ./
COPY frontend/postcss.config.js ./
COPY frontend/public ./public
COPY frontend/src ./src

# 安装依赖
RUN npm ci --only=production

# 构建前端项目
RUN npm run build

# ========== 阶段2：构建后端 ==========
FROM python:3.11-slim AS backend-builder

# 设置工作目录
WORKDIR /app/backend

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libc-dev \
    libssl-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 复制后端项目文件
COPY backend/requirements.txt ./
COPY backend/app ./app
COPY backend/run.py ./
COPY backend/configs ./configs

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements.txt

# ========== 阶段3：最终镜像 ==========
FROM python:3.11-slim

# 设置环境变量
ENV PYTHONUNBUFFERED=1 \
    FASTAPI_ENV=production \
    PORT=8000

# 设置工作目录
WORKDIR /app/backend

# 安装系统依赖（仅保留运行时必需的）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libssl1.1 \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# 从后端构建阶段复制文件
COPY --from=backend-builder /app/backend ./
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin

# 从前端构建阶段复制静态文件
COPY --from=frontend-builder /app/frontend/build /app/backend/static

# 创建必要的目录
RUN mkdir -p /app/backend/data /app/backend/logs

# 暴露端口
EXPOSE $PORT

# 启动应用
CMD ["python", "run.py"]