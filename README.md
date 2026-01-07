# Phabricator Dashboard MVP

一个基于 Phabricator Conduit API 的统一管理 Dashboard，用于快速替代原生 UI。

## 项目特点

- **只读系统**：仅通过 Conduit API 读取数据，不执行写操作
- **清晰架构**：三层结构（Conduit 适配层 → 领域服务层 → HTTP API 层）
- **易于扩展**：模块化设计，支持后续功能扩展
- **类型安全**：全栈 TypeScript 实现

## 核心功能模块

- ✅ 项目管理（Project）
- ✅ 任务管理（Task / Maniphest）
- ✅ 博客系统（Blog / Phame）
- ✅ 用户信息（User）

## 技术栈

### Backend
- Node.js + TypeScript
- Express
- Axios
- dotenv

### Frontend
- Next.js 14
- React 18
- TypeScript

## 项目结构

```
phabricator-dashboard/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── conduit/           # Conduit 通用适配层
│   │   │   ├── client.ts      # 通用 Conduit Client
│   │   │   ├── types.ts       # Conduit 类型定义
│   │   │   └── auth.ts        # __conduit__ 鉴权封装
│   │   ├── domains/           # 领域模块
│   │   │   ├── user/          # 用户服务
│   │   │   ├── project/       # 项目服务
│   │   │   ├── task/          # 任务服务
│   │   │   └── blog/          # 博客服务
│   │   ├── api/               # HTTP API 层
│   │   │   ├── users.ts
│   │   │   ├── projects.ts
│   │   │   ├── tasks.ts
│   │   │   └── blogs.ts
│   │   ├── config.ts          # 配置管理
│   │   └── server.ts          # 应用入口
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
└── frontend/                   # 前端应用
    ├── pages/                 # Next.js 页面
    │   ├── _app.tsx
    │   ├── index.tsx          # Dashboard 首页
    │   ├── projects.tsx       # 项目列表
    │   ├── tasks.tsx          # 任务列表
    │   └── blogs.tsx          # 博客列表
    ├── components/            # React 组件
    │   ├── layout/
    │   ├── common/
    │   ├── project/
    │   ├── task/
    │   └── blog/
    ├── lib/
    │   └── api.ts             # Backend API 调用
    ├── package.json
    ├── tsconfig.json
    └── .env.local.example
```

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd phabricator-dashboard
```

### 2. 配置后端

```bash
cd backend

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的 Phabricator 信息：
# PHA_HOST=http://your-phabricator-host.com
# PHA_TOKEN=api-xxxxxxxxxxxxxxxx
# PORT=3001

# 启动开发服务器
npm run dev
```

后端将运行在 `http://localhost:3001`

### 3. 配置前端

```bash
cd frontend

# 安装依赖
npm install

# 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local 文件：
# NEXT_PUBLIC_API_URL=http://localhost:3001

# 启动开发服务器
npm run dev
```

前端将运行在 `http://localhost:3000`

### 4. 访问应用

打开浏览器访问 `http://localhost:3000`

## API 端点

### Backend API

- `GET /api/users/me` - 获取当前用户信息
- `GET /api/users` - 搜索用户
- `GET /api/projects` - 获取项目列表
- `GET /api/tasks` - 获取任务列表
- `GET /api/tasks?status=open` - 按状态筛选任务
- `GET /api/blogs` - 获取博客文章列表
- `GET /api/blogs?published=true` - 获取已发布文章
- `GET /health` - 健康检查

### Conduit API 调用

Conduit Client 支持以下方法：

- `user.whoami` - 获取当前用户
- `user.search` - 搜索用户
- `project.search` - 搜索项目
- `maniphest.search` - 搜索任务
- `phame.post.search` - 搜索博客文章

## Conduit 鉴权说明

本项目使用标准的 Conduit API 鉴权方式：

```javascript
// 请求格式
POST /api/{method}
Content-Type: application/x-www-form-urlencoded

params={
  "__conduit__": {
    "token": "api-xxxxxxxxxxxxxxxx"
  },
  // ... 其他参数
}
```

所有 Conduit 调用都通过 `ConduitClient` 自动注入 `__conduit__` 鉴权信息。

## 生产部署

### Backend

```bash
cd backend
npm run build
npm start
```

### Frontend

```bash
cd frontend
npm run build
npm start
```

建议使用 PM2、Docker 或其他进程管理工具进行生产部署。

## 扩展开发

### 添加新的 Conduit 方法

1. 在 `backend/src/conduit/types.ts` 中定义类型
2. 在对应的 `domains/*/service.ts` 中添加方法
3. 在 `api/*.ts` 中暴露 HTTP 端点
4. 在 `frontend/lib/api.ts` 中添加前端调用

### 添加新页面

1. 在 `frontend/pages/` 中创建新页面
2. 在 `frontend/components/` 中创建对应组件
3. 在 `AppLayout.tsx` 导航中添加链接

## 注意事项

- 本系统为**只读系统**，不支持数据写入
- 确保 Phabricator API Token 具有足够的读取权限
- 生产环境请使用 HTTPS
- 建议配置 CORS 白名单

## 版本

当前版本：v0.1.0 (MVP)

## License

MIT
