# Phabricator Dashboard - Frontend

基于 Next.js 的前端应用，提供 Phabricator 数据的可视化界面。

## 技术栈

- Next.js 14
- React 18
- TypeScript
- 原生 CSS（内联样式）

## 安装与运行

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 生产模式
npm start
```

## 环境变量

创建 `.env.local` 文件：

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 页面结构

### Dashboard (/)
- 显示当前用户信息
- 项目、任务、博客数量统计
- 快速概览

### Projects (/projects)
- 项目列表展示
- 显示项目名称、颜色、图标等信息

### Tasks (/tasks)
- 任务列表展示
- 显示任务状态、优先级、积分等

### Blogs (/blogs)
- 博客文章列表
- 显示标题、副标题、发布状态

## 组件说明

### Layout
- `AppLayout` - 应用主布局，包含侧边导航

### Common
- `DataTable` - 通用数据表格组件

### Domain Components
- `ProjectList` - 项目列表
- `TaskList` - 任务列表
- `BlogList` - 博客列表

## API 调用

所有 API 调用通过 `lib/api.ts` 统一管理：

```typescript
import { api } from '@/lib/api';

// 获取当前用户
const user = await api.users.me();

// 获取项目列表
const projects = await api.projects.list();

// 获取任务列表
const tasks = await api.tasks.list();
const openTasks = await api.tasks.list('open');

// 获取博客列表
const blogs = await api.blogs.list();
const publishedBlogs = await api.blogs.list(true);
```

## 样式说明

当前使用内联样式实现，便于快速开发。后续可以：

1. 引入 TailwindCSS
2. 使用 CSS Modules
3. 引入 UI 组件库（如 shadcn/ui）

## 添加新页面

1. 在 `pages/` 创建新页面文件
2. 在 `components/` 创建对应组件
3. 在 `AppLayout.tsx` 添加导航链接
4. 在 `lib/api.ts` 添加 API 调用（如需要）

## 开发建议

- 使用 TypeScript 类型确保类型安全
- 组件保持简单，专注单一职责
- 统一错误处理和加载状态
- 考虑添加数据缓存（React Query）
