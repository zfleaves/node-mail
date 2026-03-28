# 电商管理后台 API 文档

## 📚 文档导航

本文档按模块拆分，方便查阅和维护。

### 快速开始
- [01-快速开始](./01-quickstart.md) - 环境配置、启动命令、测试账号

### 核心模块
- [02-认证与授权](./02-auth.md) - 登录、登出、JWT、Redis 会话
- [03-用户管理](./03-user.md) - 用户 CRUD 操作
- [04-商品管理](./04-product.md) - 商品 CRUD、库存管理、价格处理、文件上传
- [05-订单管理](./05-order.md) - 订单创建、取消、状态流转
- [09-文件上传](./09-uploads.md) - 图片和视频上传、文件管理

### 架构设计
- [06-数据库设计](./06-database.md) - 数据库连接、事务管理、库存机制
- [07-系统架构](./07-architecture.md) - 子进程、优雅关闭、调用链路

### 参考资料
- [08-技术参考](./08-reference.md) - 关键文件、安全特性、性能优化

## 🎯 系统概述

电商管理后台是一个基于 Express + Node.js 构建的后端 API 服务，提供了完整的电商管理功能。

### 核心特性
- ✅ JWT + Redis 会话滑动过期认证
- ✅ Redis 缓存 + 原子操作高并发库存管理
- ✅ 子进程异步处理订单事件
- ✅ 乐观锁防止库存超卖
- ✅ 价格快照机制
- ✅ 优雅关闭和自动重启

### 技术栈
- **后端框架**: Express.js
- **数据库**: MySQL 8.0
- **缓存**: Redis 6.0
- **认证**: JWT (jsonwebtoken)
- **进程管理**: Node.js child_process

## 🚀 快速启动

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库和 Redis 连接

# 3. 启动 Redis
docker run -d -p 6379:6379 redis

# 4. 启动服务
npm start

# 开发模式（自动重启）
npm run dev
```

## 📡 API 端点

基础 URL: `http://localhost:3000`

### 认证接口
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息
- `POST /api/auth/logout` - 用户登出

### 用户接口
- `GET /api/users` - 获取用户列表
- `GET /api/users/info` - 获取用户详情
- `POST /api/users/create` - 创建用户
- `POST /api/users/update` - 更新用户
- `DELETE /api/users/delete` - 删除用户

### 商品接口
- `GET /api/products` - 获取商品列表
- `GET /api/products/info` - 获取商品详情
- `POST /api/products/create` - 创建商品
- `POST /api/products/create-with-files` - 创建商品并上传文件
- `POST /api/products/update` - 更新商品
- `DELETE /api/products/delete` - 删除商品
- `PATCH /api/products/stock` - 更新商品库存
- `GET /api/products/price-history` - 获取商品价格历史
- `GET /api/products/price-stability` - 获取商品价格稳定性

### 文件上传接口
- `POST /api/uploads/products` - 上传商品图片和视频
- `GET /api/uploads/:filename` - 访问上传的文件
- `GET /api/uploads/info/:filename` - 获取文件信息
- `GET /api/uploads/stats` - 获取存储统计信息

### 订单接口
- `GET /api/orders` - 获取订单列表
- `GET /api/orders/info` - 获取订单详情
- `GET /api/orders/order-no` - 根据订单号获取订单详情
- `POST /api/orders/create` - 创建订单
- `POST /api/orders/cancel` - 取消订单
- `POST /api/orders/pay` - 订单支付
- `PATCH /api/orders/status` - 更新订单状态
- `DELETE /api/orders/delete` - 删除订单
- `GET /api/orders/statistics` - 订单统计

### 健康检查
- `GET /health` - 服务健康检查
- `GET /health/workers` - 子进程健康检查

## 🔐 测试账号

| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| admin | admin123 | admin | 超级管理员 |
| manager | manager123 | manager | 管理员 |
| staff | staff123 | staff | 普通员工 |

## 📖 详细文档

请查看各个模块的详细文档以了解具体实现细节。

---

*最后更新: 2026-03-28*