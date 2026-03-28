# Node Mail Monorepo

基于 Turborepo 的电商管理系统 Monorepo 项目，包含前端 Vue3 应用和后端 Node.js 服务。

## 项目结构

```
node-mail/
├── apps/                   # 应用目录
│   ├── backend/           # 后端服务 (Express + Node.js)
│   └── frontend/          # 前端应用 (Vue3 + TypeScript + ElementPlus)
├── packages/              # 共享包目录
│   ├── components/        # 通用组件库
│   ├── utils/             # 通用工具库
│   ├── formily/           # 表单解决方案
│   ├── layouts/           # 布局组件
│   ├── constants/         # 常量定义
│   ├── eslint-config/     # ESLint 配置
│   └── typescript-config/ # TypeScript 配置
├── turbo.json             # Turborepo 配置
└── package.json           # 根目录配置
```

## 技术栈

### 前端
- Vue 3.5
- TypeScript
- Element Plus
- Vite
- Vue Router
- Pinia
- Axios

### 后端
- Node.js
- Express
- MySQL
- Redis
- JWT
- Multer

### Monorepo 工具
- Turborepo
- pnpm workspaces
- Husky
- lint-staged
- Prettier

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 初始化 Git Hooks

```bash
pnpm prepare
```

### 开发模式

```bash
# 启动所有应用的开发模式
pnpm dev

# 只启动后端服务
pnpm dev:backend

# 只启动前端应用
pnpm dev:frontend

# 或者使用 --filter 精确指定
pnpm --filter @node-mail/backend dev
pnpm --filter @node-mail/frontend dev
```

### 构建

```bash
# 构建所有包
pnpm build

# 构建指定包
pnpm build:backend
pnpm build:frontend

# 或者使用 --filter
pnpm --filter @node-mail/frontend build
pnpm --filter @node-mail/components build
```

### 代码检查

```bash
# 运行 ESLint 检查（所有包）
pnpm lint

# 检查指定包
pnpm lint:frontend
pnpm lint:backend

# 或者使用 --filter
pnpm --filter @node-mail/frontend lint
```

### TypeScript 类型检查

```bash
# 类型检查所有包
pnpm type-check

# 检查指定包
pnpm type-check:frontend

# 或者使用 --filter
pnpm --filter @node-mail/frontend type-check
```

### 测试

```bash
# 运行所有测试
pnpm test

# 运行指定包的测试
pnpm test:frontend
pnpm test:backend

# 或者使用 --filter
pnpm --filter @node-mail/frontend test
```

### 清理

```bash
# 清理所有构建产物
pnpm clean

# 清理指定包
pnpm clean:frontend
pnpm clean:backend

# 或者使用 --filter
pnpm --filter @node-mail/frontend clean
```

### 代码格式化

```bash
# 格式化所有代码
pnpm format
```

## Git 提交规范

项目使用 Husky + lint-staged 进行代码提交检查：

- 提交前自动运行 ESLint 检查和修复
- 自动格式化代码
- 确保 TypeScript 类型检查通过

## 可用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动所有应用的开发模式 |
| `pnpm dev:backend` | 启动后端服务 |
| `pnpm dev:frontend` | 启动前端应用 |
| `pnpm build` | 构建所有包 |
| `pnpm build:backend` | 构建后端服务 |
| `pnpm build:frontend` | 构建前端应用 |
| `pnpm lint` | 运行 ESLint 检查（所有包） |
| `pnpm lint:frontend` | 检查前端代码 |
| `pnpm lint:backend` | 检查后端代码 |
| `pnpm type-check` | TypeScript 类型检查（所有包） |
| `pnpm type-check:frontend` | 检查前端类型 |
| `pnpm test` | 运行测试（所有包） |
| `pnpm test:frontend` | 运行前端测试 |
| `pnpm test:backend` | 运行后端测试 |
| `pnpm clean` | 清理所有构建产物 |
| `pnpm clean:frontend` | 清理前端构建产物 |
| `pnpm clean:backend` | 清理后端构建产物 |
| `pnpm format` | 格式化所有代码 |

## 使用 --filter 参数

对于更精确的控制，可以使用 `--filter` 参数：

```bash
# 启动特定包
pnpm --filter @node-mail/backend dev
pnpm --filter @node-mail/frontend dev

# 构建特定包
pnpm --filter @node-mail/components build

# 运行特定包的命令
pnpm --filter @node-mail/utils build
```

## 环境要求

- Node.js >= 20.19.0 || >= 22.12.0
- pnpm >= 9.0.0

## 开发指南

### 添加新的应用

1. 在 `apps/` 目录下创建新的应用目录
2. 初始化 `package.json`，配置必要的脚本
3. 运行 `pnpm install` 安装依赖
4. 在根目录的 `package.json` 中添加对应的命令

### 添加新的共享包

1. 在 `packages/` 目录下创建新的包目录
2. 配置 `package.json`，设置正确的 `name` 字段（使用 `@node-mail/` 前缀）
3. 添加必要的配置文件（如 `tsconfig.json`）
4. 创建源代码和导出文件
5. 在其他包中通过 `workspace:*` 引用

### 工作空间引用

在项目内部引用其他包时，使用工作空间协议：

```json
{
  "dependencies": {
    "@node-mail/utils": "workspace:*",
    "@node-mail/components": "workspace:*"
  }
}
```

## 常见问题

### 依赖安装失败

如果遇到依赖安装问题，尝试清理缓存：

```bash
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
rm -f pnpm-lock.yaml
pnpm install
```

### 构建错误

如果遇到构建错误，先清理构建产物：

```bash
pnpm clean
pnpm build
```

## 许可证

ISC