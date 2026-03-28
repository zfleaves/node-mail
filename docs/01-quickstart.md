# 01-快速开始

## 📋 目录

- [环境要求](#环境要求)
- [安装依赖](#安装依赖)
- [配置环境变量](#配置环境变量)
- [启动 Redis](#启动-redis)
- [启动服务](#启动服务)
- [测试接口](#测试接口)
- [测试账号](#测试账号)

## 环境要求

- Node.js >= 14.0.0
- MySQL >= 8.0
- Redis >= 6.0
- npm 或 pnpm

## 安装依赖

```bash
# 使用 npm
npm install

# 使用 pnpm（推荐）
pnpm install
```

## 配置环境变量

复制环境变量示例文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置以下参数：

```env
# 服务器配置
PORT=3000
NODE_ENV=development

# JWT 密钥配置
JWT_SECRET=your_super_secret_key_change_in_production
JWT_EXPIRES_IN=7d

# 数据库配置（MySQL）
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ecommerce_admin
DB_USER=root
DB_PASSWORD=root

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### 数据库准备

在启动应用前，需要先创建数据库：

```sql
CREATE DATABASE ecommerce_admin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

应用启动时会自动创建所需的表并插入测试数据。

## 启动 Redis

### Windows 用户（推荐使用 Docker）

```bash
# 启动 Redis 容器
docker run -d -p 6379:6379 --name redis redis

# 查看容器状态
docker ps

# 停止 Redis 容器
docker stop redis

# 删除 Redis 容器
docker rm redis
```

### Linux/Mac 用户

```bash
# 使用 Homebrew 安装（Mac）
brew install redis
brew services start redis

# 使用 apt 安装（Ubuntu）
sudo apt-get install redis-server
sudo systemctl start redis

# 使用 yum 安装（CentOS）
sudo yum install redis
sudo systemctl start redis
```

### 验证 Redis 连接

```bash
# 使用 redis-cli 连接
redis-cli ping

# 应该返回：PONG
```

## 启动服务

### 开发模式（推荐）

```bash
npm run dev
```

使用 `nodemon` 启动，代码修改后自动重启。

### 生产模式

```bash
npm start
```

### 启动成功标志

看到以下日志表示启动成功：

```
==================================================
🚀 服务器已启动
📍 环境: development
🔗 地址: http://localhost:3000
📚 API 文档: http://localhost:3000/
==================================================

可用的测试账号：
  管理员: admin / admin123
  经理: manager / manager123
  员工: staff / staff123
==================================================

[主进程] 启动过期订单处理子进程...
[主进程] 启动订单创建后处理子进程...
[主进程] 过期订单处理子进程已启动 (PID: xxxxx)
[主进程] 订单创建后处理子进程已启动 (PID: xxxxx)
[主进程] 已预热商品库存缓存到 Redis
```

## 测试接口

### 健康检查

```bash
curl http://localhost:3000/health
```

**响应：**
```json
{
  "success": true,
  "message": "服务运行正常",
  "timestamp": "2026-03-28T10:00:00.000Z"
}
```

### 子进程健康检查

```bash
curl http://localhost:3000/health/workers
```

**响应：**
```json
{
  "success": true,
  "data": {
    "expiredOrderWorker": {
      "pid": xxxxx,
      "status": "running"
    },
    "orderCreatedWorker": {
      "pid": xxxxx,
      "status": "running"
    }
  }
}
```

### API 信息

```bash
curl http://localhost:3000/
```

**响应：**
```json
{
  "success": true,
  "message": "电商管理后台 API",
  "version": "1.0.0",
  "database": "MySQL",
  "endpoints": {
    "auth": "/api/auth",
    "users": "/api/users",
    "products": "/api/products",
    "orders": "/api/orders"
  }
}
```

## 测试账号

系统预置了三个测试账号，用于不同角色的权限测试。

### 超级管理员

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

**权限：** 拥有所有权限，可以管理用户、商品、订单等所有资源。

### 管理员

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "manager",
    "password": "manager123"
  }'
```

**权限：** 可以管理商品和订单，但不能管理用户。

### 普通员工

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "staff",
    "password": "staff123"
  }'
```

**权限：** 只能查看订单和商品信息，不能进行创建、更新、删除操作。

## 使用获取的 Token 进行 API 调用

登录成功后会返回 `accessToken`，使用它进行后续的 API 调用：

```bash
# 获取用户列表
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 获取商品列表
curl -X GET http://localhost:3000/api/products \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 创建订单
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "userName": "admin",
    "items": [
      {
        "productId": 1,
        "productName": "iPhone 15 Pro",
        "quantity": 2,
        "price": 7999.00
      }
    ]
  }'
```

## 常见问题

### Q: Redis 连接失败怎么办？

**A:** 请检查 Redis 服务是否启动：

```bash
# 检查 Redis 是否运行
redis-cli ping

# 如果返回错误，启动 Redis 服务
# Windows (Docker)
docker start redis

# Linux/Mac
sudo systemctl start redis
```

### Q: 数据库连接失败怎么办？

**A:** 请检查以下项：

1. MySQL 服务是否启动
2. `.env` 文件中的数据库配置是否正确
3. 数据库是否已创建：`ecommerce_admin`
4. 数据库用户是否有足够的权限

### Q: 如何查看子进程日志？

**A:** 子进程日志会直接输出到控制台，与主进程日志混合显示。可以通过以下方式查看子进程状态：

```bash
curl http://localhost:3000/health/workers
```

### Q: 如何停止服务？

**A:** 按 `Ctrl + C` 优雅停止服务，系统会：

1. 停止接受新的请求
2. 关闭子进程
3. 关闭数据库连接
4. 关闭 Redis 连接
5. 退出进程

### Q: 开发环境如何启用调试？

**A:** 在 `.env` 文件中设置：

```env
NODE_ENV=development
```

开发环境下会启用：
- 详细的日志输出
- Redis 失败时不影响主流程
- 更友好的错误信息

## 下一步

- 阅读 [02-认证与授权](./02-auth.md) 了解认证机制
- 阅读 [03-用户管理](./03-user.md) 了解用户管理接口
- 阅读 [04-商品管理](./04-product.md) 了解商品管理接口
- 阅读 [05-订单管理](./05-order.md) 了解订单管理接口

---

*最后更新: 2026-03-28*