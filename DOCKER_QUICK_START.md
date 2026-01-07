# Docker 快速启动指南

由于项目在 Docker 构建过程中遇到 npm/yarn 依赖安装问题，这里提供一个更简单的方案。

## 方案：本地构建 + Docker 运行

### 步骤 1：本地构建项目

```bash
# 构建 Backend
cd backend
npm install
npm run build

# 构建 Frontend  
cd ../frontend
npm install
npm run build
```

### 步骤 2：使用简化的 Dockerfile

我已经为你准备了简化版的 Dockerfile，它们会直接复制已构建的文件。

### 步骤 3：启动容器

```bash
# 在项目根目录
docker-compose up -d
```

## 当前问题说明

Docker 构建遇到的主要问题：

1. **npm 10.8.2 bug**: Node 20 自带的 npm 版本有一个已知 bug，导致安装过程中报错但不正确退出
2. **Yarn PnP 模式**: Yarn 4 默认使用 PnP 模式，不创建 node_modules 目录
3. **ESLint 配置**: Next.js 14 与新版 ESLint 的配置兼容性问题

## 推荐方案

### 方案 A：使用本地开发环境（推荐）

直接在本地运行，不使用 Docker：

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

访问：http://localhost:9641

### 方案 B：等待 Docker 构建完成

当前的 Docker 构建配置已经修复了大部分问题，但需要较长时间（约 5-10 分钟）。

如果你想继续使用 Docker，可以：

1. 等待当前构建完成
2. 或者取消构建，使用下面的简化配置

## 简化的 Docker 配置（备选）

如果你想要一个更可靠的 Docker 方案，可以使用预构建镜像或者本地构建后再打包到 Docker。

### 创建 .dockerignore

确保 `.dockerignore` 文件包含：
```
node_modules
.next
dist
.git
*.log
```

### 使用 Docker Compose

```bash
# 停止现有容器
docker-compose down

# 清理缓存
docker system prune -f

# 重新构建（使用修复后的配置）
docker-compose build

# 启动
docker-compose up -d

# 查看日志
docker-compose logs -f
```

## 故障排查

### 查看构建进度
```bash
docker-compose build --progress=plain
```

### 查看容器状态
```bash
docker-compose ps
docker-compose logs backend
docker-compose logs frontend
```

### 完全重置
```bash
docker-compose down -v
docker system prune -af
docker volume prune -f
```

## 生产环境建议

对于生产环境，建议：

1. 使用 CI/CD 流水线构建镜像
2. 将构建好的镜像推送到镜像仓库
3. 在服务器上直接拉取镜像运行

这样可以避免在生产服务器上进行耗时的构建过程。
