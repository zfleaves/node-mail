# 08-技术参考

## 📋 目录

- [关键文件](#关键文件)
- [安全特性](#安全特性)
- [性能优化](#性能优化)
- [环境变量](#环境变量)

## 关键文件

### 核心文件

| 文件路径 | 说明 |
|---------|------|
| `src/index.js` | 应用入口，启动服务器 |
| `src/app.js` | Express 应用配置，启动子进程 |
| `src/config/index.js` | 配置文件 |

### 路由文件

| 文件路径 | 说明 |
|---------|------|
| `src/routes/auth.js` | 认证路由 |
| `src/routes/users.js` | 用户路由 |
| `src/routes/products.js` | 商品路由 |
| `src/routes/orders.js` | 订单路由 |

### 控制器文件

| 文件路径 | 说明 |
|---------|------|
| `src/controllers/authController.js` | 认证控制器 |
| `src/controllers/userController.js` | 用户控制器 |
| `src/controllers/productController.js` | 商品控制器 |
| `src/controllers/orderController.js` | 订单控制器 |

### 数据库文件

| 文件路径 | 说明 |
|---------|------|
| `src/database/mysql.js` | MySQL 连接和操作 |
| `src/database/dataAccess.js` | 数据访问层 |
| `src/database/schema.js` | 数据库表结构 |
| `src/database/redis.js` | Redis 连接和管理 |
| `src/database/redisStock.js` | Redis 库存管理 |
| `src/utils/stockSync.js` | 库存同步工具 |

### 子进程文件

| 文件路径 | 说明 |
|---------|------|
| `src/cron/expiredOrderWorker.js` | 过期订单处理子进程 |
| `src/cron/orderCreatedWorker.js` | 订单事件处理子进程 |

### 中间件文件

| 文件路径 | 说明 |
|---------|------|
| `src/middleware/auth.js` | 身份验证中间件 |
| `src/middleware/permission.js` | 权限验证中间件 |
| `src/middleware/validation.js` | 参数验证中间件 |
| `src/middleware/errorHandler.js` | 错误处理中间件 |

### 模型文件

| 文件路径 | 说明 |
|---------|------|
| `src/models/User.js` | 用户模型 |

## 安全特性

### 1. 身份验证

- **JWT Token 验证**：使用 JWT 进行身份验证
- **Token 类型验证**：验证 JWT 的 type 字段
- **Token 过期检测**：明确返回 `TOKEN_EXPIRED` 错误码

### 2. 会话管理

- **Redis 会话**：存储用户会话信息
- **滑动过期**：用户持续操作时自动续期
- **会话撤销**：可以随时删除 Redis 会话

### 3. 密码安全

- **bcrypt 哈希**：使用 bcrypt 哈希加密存储密码
- **密码强度验证**：验证密码长度和复杂度

### 4. 权限控制

- **基于角色的访问控制（RBAC）**：admin/manager/staff
- **路由级权限验证**：使用 `requirePermission` 中间件

### 5. 参数验证

- **输入验证**：使用 `validateBody` 和 `validateParams` 中间件
- **SQL 注入防护**：使用参数化查询

### 6. 库存安全

- **乐观锁**：防止并发冲突
- **Redis 原子操作**：避免并发问题
- **库存回滚**：订单失败时自动回滚

## 性能优化

### 1. Redis 缓存

**商品库存缓存：**
```javascript
// 缓存商品库存
await cacheProductStock(productId, stock);

// 从缓存获取库存
const stock = await getProductStock(productId);
```

**会话缓存：**
```javascript
// 缓存用户会话
await createSession(sessionId, sessionData, 900);

// 获取用户会话
const session = await getSession(sessionId);
```

### 2. 异步处理

**子进程异步处理订单事件：**
```javascript
// 发送到子进程，不阻塞主流程
worker.send({
  type: 'order_created',
  data: newOrder
});
```

**异步同步库存：**
```javascript
// 不阻塞主流程
setImmediate(() => {
  updateDatabaseStock(items);
});
```

### 3. 连接池

**MySQL 连接池：**
```javascript
const pool = mysql.createPool({
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0
});
```

**Redis 连接池：**
```javascript
const redis = createClient({
  url: 'redis://localhost:6379'
});
```

### 4. 批量操作

**批量预热缓存：**
```javascript
// 批量缓存所有商品库存
await batchCacheStock();
```

**批量同步库存：**
```javascript
// 批量同步库存到数据库
await batchSyncFromDB();
```

### 5. 索引优化

**数据库索引：**
```sql
-- 用户名唯一索引
CREATE UNIQUE INDEX idx_username ON users(username);

-- 邮箱唯一索引
CREATE UNIQUE INDEX idx_email ON users(email);

-- 订单号唯一索引
CREATE UNIQUE INDEX idx_order_no ON orders(order_no);

-- 订单状态索引
CREATE INDEX idx_status ON orders(status);

-- 商品分类索引
CREATE INDEX idx_category ON products(category);
```

### 6. 分页查询

**前端分页：**
```javascript
const { page = 1, pageSize = 10 } = req.query;
const result = await getAllProducts(page, pageSize);
```

**性能对比：**

| 场景 | 旧方案（数据库锁） | 新方案（Redis 原子操作） |
|------|------------------|----------------------|
| 单次请求 | ~50ms | ~5ms |
| 100 并发 | ~5000ms（排队等待） | ~10ms（并行处理） |
| 1000 并发 | ~50000ms（连接池耗尽） | ~50ms（轻松应对） |

## 环境变量

### .env 配置

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

### 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| PORT | 服务器端口 | 3000 |
| NODE_ENV | 运行环境 | development |
| JWT_SECRET | JWT 密钥 | - |
| JWT_EXPIRES_IN | JWT 有效期 | 7d |
| DB_HOST | 数据库主机 | localhost |
| DB_PORT | 数据库端口 | 3306 |
| DB_NAME | 数据库名称 | ecommerce_admin |
| DB_USER | 数据库用户 | root |
| DB_PASSWORD | 数据库密码 | - |
| REDIS_HOST | Redis 主机 | localhost |
| REDIS_PORT | Redis 端口 | 6379 |
| REDIS_PASSWORD | Redis 密码 | - |
| REDIS_DB | Redis 数据库 | 0 |

### 生产环境配置

```env
# 生产环境
NODE_ENV=production
JWT_SECRET=your_production_secret_key
DB_PASSWORD=your_production_db_password
REDIS_PASSWORD=your_production_redis_password
```

---

*最后更新: 2026-03-28*