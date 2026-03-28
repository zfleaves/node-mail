# Monorepo 项目结构说明

## 目录结构

```
node-mail/
├── apps/                           # 应用目录
│   ├── backend/                    # 后端服务
│   │   ├── src/                    # 源代码
│   │   ├── docs/                   # 文档
│   │   ├── package.json            # 后端依赖配置
│   │   └── pnpm-lock.yaml          # 后端依赖锁定文件
│   │
│   └── frontend/                   # 前端应用
│       ├── src/                    # 源代码
│       │   ├── api/                # API 接口
│       │   ├── assets/             # 静态资源
│       │   ├── components/         # 组件
│       │   ├── router/             # 路由
│       │   ├── stores/             # 状态管理
│       │   ├── utils/              # 工具函数
│       │   ├── views/              # 页面视图
│       │   ├── App.vue             # 根组件
│       │   └── main.ts             # 入口文件
│       ├── env.d.ts                # TypeScript 类型定义
│       ├── index.html              # HTML 模板
│       ├── package.json            # 前端依赖配置
│       ├── tsconfig.json           # TypeScript 配置
│       └── vite.config.ts          # Vite 配置
│
├── packages/                       # 共享包目录
│   ├── components/                 # 通用组件库
│   │   ├── src/
│   │   │   ├── Button.vue          # 按钮组件
│   │   │   ├── Card.vue            # 卡片组件
│   │   │   └── index.ts            # 导出文件
│   │   └── package.json
│   │
│   ├── utils/                      # 通用工具库
│   │   ├── src/
│   │   │   └── index.ts            # 工具函数集合
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── formily/                    # 表单解决方案
│   │   ├── src/
│   │   │   └── index.ts            # 表单工具函数
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── layouts/                    # 布局组件
│   │   ├── src/
│   │   │   ├── AdminLayout.vue     # 管理后台布局
│   │   │   ├── MainLayout.vue      # 主布局
│   │   │   └── index.ts            # 导出文件
│   │   └── package.json
│   │
│   ├── constants/                  # 常量定义
│   │   ├── src/
│   │   │   └── index.ts            # 常量集合
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── eslint-config/              # ESLint 配置
│   │   ├── index.js                # 主配置
│   │   ├── base.js                 # 基础配置
│   │   ├── typescript.js           # TypeScript 配置
│   │   ├── vue.js                  # Vue 配置
│   │   └── package.json
│   │
│   └── typescript-config/          # TypeScript 配置
│       ├── base.json               # 基础配置
│       ├── vue.json                # Vue 配置
│       └── package.json
│
├── docs/                           # 项目文档
│   ├── 00-outline.md               # 文档大纲
│   ├── 01-quickstart.md            # 快速开始
│   ├── 02-auth.md                  # 认证说明
│   ├── 03-user.md                  # 用户管理
│   ├── 04-product.md               # 商品管理
│   ├── 05-order.md                 # 订单管理
│   ├── 06-database.md              # 数据库说明
│   ├── 07-architecture.md          # 架构说明
│   ├── 08-reference.md             # 参考文档
│   ├── 09-uploads.md               # 文件上传
│   ├── 10-deployment.md            # 部署指南
│   └── README.md
│
├── turbo.json                      # Turborepo 配置
├── package.json                    # 根目录配置
├── .gitignore                      # Git 忽略规则
├── .prettierrc                     # Prettier 配置
├── .prettierignore                 # Prettier 忽略规则
├── .lintstagedrc.json              # lint-staged 配置
├── README.md                       # 项目说明
├── MONOREPO_STRUCTURE.md           # 本文件
└── ORDER_FLOW.md                   # 订单流程说明
```

## 工作空间配置

### 包命名规范

所有包都使用 `@node-mail/` 前缀：

- 应用：`@node-mail/backend`, `@node-mail/frontend`
- 共享包：`@node-mail/components`, `@node-mail/utils` 等

### 依赖引用

在项目内部引用其他包时，使用 `workspace:*` 协议：

```json
{
  "dependencies": {
    "@node-mail/utils": "workspace:*",
    "@node-mail/constants": "workspace:*"
  }
}
```

## Turborepo 配置

`turbo.json` 定义了以下任务：

- `build`: 构建任务，有依赖关系，会缓存结果
- `dev`: 开发模式，不缓存，持久运行
- `lint`: 代码检查，有依赖关系，会缓存结果
- `test`: 测试任务，依赖构建结果，会缓存结果
- `type-check`: 类型检查，有依赖关系，会缓存结果
- `clean`: 清理任务，不缓存

## 常用命令

```bash
# 安装依赖
pnpm install

# 启动开发模式
pnpm dev

# 构建所有包
pnpm build

# 代码检查
pnpm lint

# 类型检查
pnpm type-check

# 格式化代码
pnpm format

# 运行测试
pnpm test

# 清理构建产物
pnpm clean
```

## 扩展指南

### 添加新的应用

1. 在 `apps/` 目录下创建新的应用目录
2. 初始化 `package.json`，配置必要的脚本
3. 在 `turbo.json` 中添加任务配置（如果需要）
4. 运行 `pnpm install` 安装依赖

### 添加新的共享包

1. 在 `packages/` 目录下创建新的包目录
2. 配置 `package.json`，设置正确的 `name` 字段
3. 添加必要的配置文件（如 `tsconfig.json`）
4. 创建源代码和导出文件
5. 在其他包中通过 `workspace:*` 引用

## 注意事项

1. **包版本管理**: 所有共享包的版本应保持一致，便于管理
2. **构建顺序**: Turborepo 会自动处理构建依赖，无需手动排序
3. **缓存策略**: 构建结果会被缓存，提高后续构建速度
4. **工作空间协议**: 内部包引用必须使用 `workspace:*`
5. **Git Hooks**: Husky 会在提交时自动运行代码检查和格式化