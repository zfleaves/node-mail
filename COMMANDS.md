# 命令参考指南

## 全局命令

### 安装依赖
```bash
pnpm install
```

### 初始化 Git Hooks
```bash
pnpm prepare
```

## 开发模式

### 启动所有应用
```bash
pnpm dev
```

### 单独启动后端
```bash
pnpm dev:backend
# 或
pnpm --filter @node-mail/backend dev
```

### 单独启动前端
```bash
pnpm dev:frontend
# 或
pnpm --filter @node-mail/frontend dev
```

## 构建命令

### 构建所有包
```bash
pnpm build
```

### 构建特定包
```bash
# 后端
pnpm build:backend
pnpm --filter @node-mail/backend build

# 前端
pnpm build:frontend
pnpm --filter @node-mail/frontend build

# 共享包
pnpm --filter @node-mail/components build
pnpm --filter @node-mail/utils build
pnpm --filter @node-mail/formily build
pnpm --filter @node-mail/layouts build
pnpm --filter @node-mail/constants build
```

## 代码检查

### 检查所有包
```bash
pnpm lint
```

### 检查特定包
```bash
pnpm lint:frontend
pnpm lint:backend
pnpm --filter @node-mail/frontend lint
```

## 类型检查

### 检查所有包
```bash
pnpm type-check
```

### 检查特定包
```bash
pnpm type-check:frontend
pnpm --filter @node-mail/frontend type-check
```

## 测试

### 运行所有测试
```bash
pnpm test
```

### 运行特定包的测试
```bash
pnpm test:frontend
pnpm test:backend
pnpm --filter @node-mail/frontend test
```

## 清理

### 清理所有构建产物
```bash
pnpm clean
```

### 清理特定包
```bash
pnpm clean:frontend
pnpm clean:backend
pnpm --filter @node-mail/frontend clean
```

## 代码格式化

### 格式化所有代码
```bash
pnpm format
```

## 工作空间命令

### 查看工作空间信息
```bash
pnpm list --depth 0
```

### 为特定包安装依赖
```bash
pnpm --filter @node-mail/frontend add <package-name>
pnpm --filter @node-mail/backend add -D <dev-package-name>
```

### 移除特定包的依赖
```bash
pnpm --filter @node-mail/frontend remove <package-name>
```

## 常用组合命令

### 启动并监听所有变化
```bash
pnpm dev
```

### 构建并清理
```bash
pnpm clean && pnpm build
```

### 检查并修复代码
```bash
pnpm lint
pnpm format
```

### 完整的 CI 流程
```bash
pnpm install
pnpm lint
pnpm type-check
pnpm build
pnpm test
```

## 使用 --filter 的优势

`--filter` 参数提供更精确的控制：

1. **只操作特定的包**，节省时间和资源
2. **避免不必要的构建**，提高开发效率
3. **精确控制依赖关系**，确保正确的构建顺序

示例：
```bash
# 只构建前端及其依赖
pnpm --filter @node-mail/frontend build --filter=@node-mail/components

# 只测试 utils 包
pnpm --filter @node-mail/utils test

# 在多个包上运行命令
pnpm --filter "./packages/*" build
```