# Docker 部署指南

本项目采用单一服务架构，前后端整合在一个 Next.js 应用中，类似 SiYuan、n8n 的部署方式。

## 前置要求

- Docker Engine 20.10+
- Docker Compose 2.0+

## 快速启动

### 使用 Docker Compose（推荐）

在项目根目录运行：

```bash
# 构建并启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

服务访问地址：
- **应用**: http://localhost:9641 （包含前端界面和 API）

### 2. 单独构建和运行

#### 构建镜像

```bash
# 构建前端镜像
cd frontend
docker build -t phabricator-dashboard-frontend .

# 构建后端镜像
cd ../backend
docker build -t phabricator-dashboard-backend .
```

#### 运行容器

```bash
# 创建网络
docker network create phabricator-network

# 运行后端
docker run -d \
  --name phabricator-backend \
  --network phabricator-network \
  -p 3000:3000 \
  --env-file ./backend/.env \
  phabricator-dashboard-backend

# 运行前端
docker run -d \
  --name phabricator-frontend \
  --network phabricator-network \
  -p 9641:9641 \
  -e NEXT_PUBLIC_API_URL=http://phabricator-backend:3000 \
  phabricator-dashboard-frontend
```

## 环境变量配置

### Backend (.env)

在 `backend/.env` 文件中配置：

```env
# Phabricator API 配置
PHABRICATOR_URL=https://your-phabricator-instance.com
PHABRICATOR_API_TOKEN=your-api-token

# 服务端口
PORT=3000
```

### Frontend

前端环境变量可以在 `docker-compose.yml` 中配置：

```yaml
environment:
  - NEXT_PUBLIC_API_URL=http://backend:3000
```

## 常用命令

```bash
# 重新构建镜像
docker-compose build

# 重新构建并启动
docker-compose up -d --build

# 查看运行状态
docker-compose ps

# 查看特定服务日志
docker-compose logs -f frontend
docker-compose logs -f backend

# 进入容器
docker-compose exec frontend sh
docker-compose exec backend sh

# 停止并删除容器
docker-compose down

# 停止、删除容器并清理卷
docker-compose down -v
```

## 生产环境部署建议

### 1. 使用环境变量文件

创建 `.env` 文件在项目根目录：

```env
# Frontend
FRONTEND_PORT=9641
NEXT_PUBLIC_API_URL=http://your-backend-url:3000

# Backend
BACKEND_PORT=3000
PHABRICATOR_URL=https://your-phabricator-instance.com
PHABRICATOR_API_TOKEN=your-api-token
```

### 2. 配置反向代理（Nginx）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:9641;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 3. 持久化数据

如果需要持久化数据，在 `docker-compose.yml` 中添加 volumes：

```yaml
services:
  frontend:
    volumes:
      - frontend-data:/app/.next/cache
  backend:
    volumes:
      - backend-data:/app/data

volumes:
  frontend-data:
  backend-data:
```

### 4. 健康检查

在 `docker-compose.yml` 中添加健康检查：

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## 故障排查

### 查看容器日志
```bash
docker-compose logs -f [service-name]
```

### 检查容器状态
```bash
docker-compose ps
docker inspect [container-name]
```

### 重启服务
```bash
docker-compose restart [service-name]
```

### 清理未使用的资源
```bash
# 清理未使用的镜像
docker image prune -a

# 清理未使用的容器
docker container prune

# 清理未使用的卷
docker volume prune
```

## 开发环境

如果需要在 Docker 中进行开发，可以使用 volume 挂载：

```yaml
services:
  frontend:
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
    command: npm run dev
```

这样可以实现热重载，修改代码后自动更新。
