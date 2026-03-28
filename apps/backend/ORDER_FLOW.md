# 电商管理后台 API 流程文档

## 1. 数据库连接流程

### 启动流程

**文件路径：** `src/index.js`

```javascript
startServer() → createApp()
```

**文件路径：** `src/app.js`

```javascript
createApp() → testConnection() → initDatabase()
```

### 数据库连接测试

**文件路径：** `src/database/mysql.js`

```javascript
testConnection()
```

**调用方法：**
- `mysql.createPool()` - 创建数据库连接池
- `pool.getConnection()` - 获取数据库连接
- `connection.release()` - 释放连接

### 数据库初始化

**文件路径：** `src/database/schema.js`

```javascript
initDatabase()
  ├── createUsersTable()
  ├── createProductsTable()
  ├── createOrdersTable()
  ├── createOrderItemsTable()
  └── insertTestData()
```

**表结构：**
- `users` - 用户表
- `products` - 商品表（包含 frozen_stock 冻结库存，version 乐观锁版本号）
- `orders` - 订单表（包含 temp 临时订单，expire_time 过期时间）
- `order_items` - 订单商品明细表

---

## 2. 订单创建流程

### API 请求

```
POST /api/orders
```

### 路由层

**文件路径：** `src/routes/orders.js`

```javascript
router.post('/', authenticate, requirePermission('orders:create'), validateBody(...), createOrder)
```

**中间件链：**
1. `authenticate` - 身份验证（`src/middleware/auth.js`）
2. `requirePermission` - 权限验证（`src/middleware/permission.js`）
3. `validateBody` - 参数验证（`src/middleware/validation.js`）

### 控制器层

**文件路径：** `src/controllers/orderController.js`

```javascript
createOrder(req, res)
  ├── 生成订单号 (ORD + timestamp + random)
  ├── db.createOrder(orderData) - 创建订单
  └── worker.send({ type: 'order_created' }) - 发送到子进程
```

### 数据访问层

**文件路径：** `src/database/dataAccess.js`

```javascript
createOrder(orderData)
  ├── 循环处理每个商品（Redis 原子操作扣减库存）：
  │     ├── getProductStock(productId) - 从 Redis 获取库存
  │     │   ├── 优先从 Redis 缓存读取
  │     │   └── 如果缓存未命中，从数据库读取并缓存
  │     ├── 检查库存是否充足
  │     └── decreaseStock(productId, quantity) - Redis 原子操作扣减库存
  │         ├── redis.decrBy(key, quantity) - 原子操作
  │         ├── 如果剩余库存 < 0，自动回滚
  │         └── 返回扣减结果（success, remaining）
  ├── 如果所有商品库存扣减成功：
  │     ├── db.transaction(async (connection) => {
  │     │   ├── connection.execute('INSERT INTO orders') - 插入订单（状态为 temp）
  │     │   ├── 循环插入订单商品明细：
  │     │   │   └── connection.execute('INSERT INTO order_items')
  │     │   └── return orderId - 返回订单 ID
  │     │   }) - 自动处理事务
  │     └── updateDatabaseStock(items) - 异步同步到数据库（不阻塞）
  └── 如果库存扣减失败：
        └── 恢复已扣减的库存，抛出错误

// Redis 库存管理（src/database/redisStock.js）：
// - 使用 Redis 原子操作（decrBy/incrBy）避免并发问题
// - 应用启动时自动预热缓存
// - 库存缓存 1 小时过期
// - 支持批量缓存和同步

// 异步同步到数据库：
// - 不阻塞订单创建流程
// - 失败时记录日志，不影响主流程
// - 提供手动同步接口（开发环境）
```

### 子进程异步处理

**文件路径：** `src/cron/orderCreatedWorker.js`

```javascript
process.on('message')
  └── handleOrderCreated(orderData)
      ├── sendNotification() - 发送通知
      ├── updateUserPoints() - 更新用户积分
      └── logOrderEvent() - 记录订单事件日志
```

---

## 3. 订单取消流程

### API 请求

```
POST /api/orders/:id/cancel
```

### 路由层

**文件路径：** `src/routes/orders.js`

```javascript
router.post('/:id/cancel', authenticate, requirePermission('orders:update'), validateParams(...), cancelOrder)
```

### 控制器层

**文件路径：** `src/controllers/orderController.js`

```javascript
cancelOrder(req, res)
  ├── db.cancelOrder(orderId, reason) - 取消订单
  └── worker.send({ type: 'order_cancelled' }) - 发送到子进程
```

### 数据访问层

**文件路径：** `src/database/dataAccess.js`

```javascript
cancelOrder(id, reason)
  ├── db.transaction(async (connection) => {
  │     ├── connection.execute('SELECT ... FOR UPDATE') - 查询订单（加锁）
  │     ├── 检查订单状态（只能取消 temp 或 pending 状态）
  │     ├── 查询订单商品明细
  │     ├── 循环恢复库存（Redis 原子操作）：
  │     │   └── increaseStock(productId, quantity) - Redis 原子操作恢复库存
  │     │       ├── redis.incrBy(key, quantity) - 原子操作
  │     │       └── 返回恢复后的库存
  │     ├── connection.execute('UPDATE orders SET status = "cancelled"') - 更新订单状态
  │     └── return orderId - 返回订单 ID
  │   }) - 自动处理事务管理
  └── updateDatabaseStockForCancel(items) - 异步同步到数据库（不阻塞）

// Redis 库存恢复：
// - 使用 Redis 原子操作（incrBy）避免并发问题
// - 恢复后立即生效，用户可以再次购买
// - 异步同步到数据库，不阻塞订单取消流程
```

### 子进程异步处理

**文件路径：** `src/cron/orderCreatedWorker.js`

```javascript
process.on('message')
  └── handleOrderCancelled(orderData, reason)
      ├── sendNotification() - 发送取消通知
      └── logOrderEvent() - 记录取消事件日志
```

---

## 4. 退出登录流程

### API 请求

```
POST /api/auth/logout
```

### 路由层

**文件路径：** `src/routes/auth.js`

```javascript
router.post('/logout', authenticate, logout)
```

### 控制器层

**文件路径：** `src/controllers/authController.js`

```javascript
logout(req, res)
  └── 清除客户端的 token（JWT 是无状态的，服务器端不需要存储）
```

### 说明

由于使用 JWT (JSON Web Token) 进行身份验证，token 存储在客户端，服务器端不需要维护 session。退出登录实际上是客户端删除 token。

---

## 5. 用户管理流程

### 5.1 获取用户列表

**API 请求：**
```
GET /api/users?page=1&pageSize=10
```

**路由层：**
**文件路径：** `src/routes/users.js`
```javascript
router.get('/', authenticate, requirePermission('users:read'), getUserList)
```

**控制器层：**
**文件路径：** `src/controllers/userController.js`
```javascript
getUserList(req, res)
  ├── 解析查询参数（page, pageSize）
  ├── 调用 User.getList(page, pageSize)
  └── 返回分页数据
```

### 5.2 获取用户详情

**API 请求：**
```
GET /api/users/info?id=1
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**流程：**
```
getUserById(req, res)
  ├── 从参数中提取用户ID
  ├── 调用 User.findById(id)
  ├── 如果用户不存在，返回404
  └── 返回用户详细信息
```

### 5.3 创建用户

**API 请求：**
```
POST /api/users/create
Content-Type: application/json

{
  "username": "newuser",
  "password": "password123",
  "email": "user@example.com",
  "role": "staff",
  "name": "新用户"
}
```

**流程：**
```
createUser(req, res)
  ├── 从请求体中获取用户数据
  ├── 调用 User.create(userData)
  │   ├── 验证用户名是否重复
  │   ├── 使用 bcrypt 哈希密码
  │   └── 插入数据库
  └── 返回新创建的用户信息
```

### 5.4 更新用户信息

**API 请求：**
```
POST /api/users/update
Content-Type: application/json

{
  "id": 1,
  "email": "newemail@example.com",
  "name": "新姓名"
}
```

**流程：**
```
updateUser(req, res)
  ├── 从请求体中提取用户ID
  ├── 从请求体中获取更新数据
  ├── 调用 User.update(id, userData)
  ├── 如果用户不存在，返回404
  └── 返回更新后的用户信息
```

### 5.5 删除用户

**API 请求：**
```
DELETE /api/users/delete
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "id": 1
}
```

**流程：**
```
deleteUser(req, res)
  ├── 从参数中提取用户ID
  ├── 调用 User.delete(id)
  ├── 如果用户不存在，返回404
  └── 返回删除成功消息
```

**安全限制：**
- 不能删除正在使用中的用户
- 不能删除自己
- 需要管理员权限

---

## 6. 商品管理流程

### 6.1 获取商品列表

**API 请求：**
```
GET /api/products?page=1&pageSize=10&category=electronics&status=active
```

**查询参数：**
- `page` - 页码（默认：1）
- `pageSize` - 每页数量（默认：10）
- `category` - 商品分类（可选）
- `status` - 商品状态（可选：active, inactive）
- `keyword` - 搜索关键词（可选）

**流程：**
```
getProductList(req, res)
  ├── 解析查询参数
  ├── 构建筛选条件
  ├── 调用 db.getAllProducts(page, pageSize, filters)
  │   ├── 从 Redis 缓存获取库存（优先）
  │   ├── 查询数据库获取商品列表
  │   └── 计算分页信息
  └── 返回分页数据
```

### 6.2 获取商品详情

**API 请求：**
```
GET /api/products/info?id=1
```

**流程：**
```
getProductById(req, res)
  ├── 从参数中提取商品ID
  ├── 调用 db.findProductById(productId)
  │   ├── 从 Redis 缓存获取库存（优先）
  │   ├── 查询数据库获取商品详情
  │   └── 返回完整的商品信息
  ├── 如果商品不存在，返回404
  └── 返回商品详细信息
```

**返回数据包含：**
- 商品基本信息（ID、名称、描述等）
- 价格信息（当前价格、原价、折扣等）
- 库存信息（可用库存、冻结库存）
- 分类和标签
- 创建和更新时间

### 6.3 创建商品

**API 请求：**
```
POST /api/products/create
Content-Type: application/json

{
  "name": "iPhone 15 Pro",
  "description": "最新款 iPhone",
  "price": 7999.00,
  "originalPrice": 8999.00,
  "stock": 100,
  "category": "electronics",
  "status": "active",
  "tags": ["手机", "苹果", "5G"]
}
```

**流程：**
```
createProduct(req, res)
  ├── 从请求体中获取商品数据
  ├── 验证价格和库存信息
  ├── 调用 db.createProduct(productData)
  │   ├── 插入商品信息到数据库
  │   └── 缓存库存到 Redis
  └── 返回新创建的商品信息
```

### 6.4 更新商品信息

**API 请求：**
```
POST /api/products/update
Content-Type: application/json

{
  "id": 1,
  "name": "iPhone 15 Pro Max",
  "price": 8999.00,
  "stock": 150
}
```

**流程：**
```
updateProduct(req, res)
  ├── 从请求体中提取商品ID
  ├── 从请求体中获取更新数据
  ├── 调用 db.updateProduct(productId, productData)
  │   ├── 更新数据库中的商品信息
  │   ├── 如果更新了库存，同步更新 Redis 缓存
  │   └── 返回更新后的商品信息
  ├── 如果商品不存在，返回404
  └── 返回更新后的商品信息
```

### 6.5 删除商品

**API 请求：**
```
DELETE /api/products/:id
```

**流程：**
```
deleteProduct(req, res)
  ├── 从参数中提取商品ID
  ├── 检查商品是否关联了未完成的订单
  ├── 调用 db.deleteProduct(productId)
  │   ├── 删除数据库中的商品记录
  │   └── 删除 Redis 中的库存缓存
  ├── 如果商品不存在，返回404
  └── 返回删除成功消息
```

**安全限制：**
- 不能删除有未完成订单的商品
- 需要管理员权限

### 6.6 更新商品库存

**API 请求：**
```
PATCH /api/products/:id/stock
Content-Type: application/json

{
  "stock": 200
}
```

**流程：**
```
updateProductStock(req, res)
  ├── 从参数中提取商品ID
  ├── 从请求体中获取新库存数量
  ├── 调用 db.updateProduct(productId, { stock })
  │   ├── 更新数据库中的库存
  │   └── 同步更新 Redis 缓存
  ├── 如果商品不存在，返回404
  └── 返回更新后的商品信息
```

---

## 7. 价格处理机制

### 7.1 价格数据结构

**商品价格字段：**
```javascript
{
  price: 7999.00,        // 当前售价
  originalPrice: 8999.00, // 原价
  discount: 11.11        // 折扣率（百分比）
}
```

### 7.2 价格计算逻辑

**创建商品时：**
```javascript
// 自动计算折扣率
if (productData.originalPrice && productData.price) {
  productData.discount = ((productData.originalPrice - productData.price) / productData.originalPrice * 100).toFixed(2);
}
```

**更新商品时：**
```javascript
// 更新价格时重新计算折扣
if (updates.price || updates.originalPrice) {
  const price = updates.price || product.price;
  const originalPrice = updates.originalPrice || product.originalPrice;
  updates.discount = ((originalPrice - price) / originalPrice * 100).toFixed(2);
}
```

### 7.3 订单价格计算

**创建订单时：**
```javascript
// 计算每个商品的小计
for (const item of items) {
  item.subtotal = item.price * item.quantity;
  totalAmount += item.subtotal;
}

// 订单总金额
orderData.totalAmount = totalAmount;
```

**订单商品数据结构：**
```javascript
{
  orderId: 1,
  productId: 1,
  productName: "iPhone 15 Pro",
  quantity: 2,
  price: 7999.00,        // 下单时的价格（快照）
  subtotal: 15998.00     // 小计
}
```

### 7.4 价格快照机制

**为什么需要价格快照？**

商品价格可能会变化（促销、调价等），但订单的价格应该保持下单时的价格不变。

**实现方式：**
```javascript
// 创建订单时，保存下单时的商品价格
const orderItem = {
  productId: item.productId,
  productName: item.productName,
  quantity: item.quantity,
  price: item.price,  // 保存下单时的价格（快照）
};

// 订单创建后，即使商品价格变化，订单价格不变
```

### 7.5 价格验证

**创建订单前验证：**
```javascript
// 验证商品价格是否合理
if (item.price <= 0 || item.price > 999999) {
  throw new Error('商品价格异常');
}

// 验证订单总金额
if (totalAmount <= 0 || totalAmount > 999999999) {
  throw new Error('订单金额异常');
}
```

**更新商品价格时验证：**
```javascript
// 验证价格格式
if (typeof price !== 'number' || price <= 0) {
  throw new Error('价格必须为正数');
}

// 验证价格精度（保留两位小数）
const priceStr = price.toFixed(2);
if (parseFloat(priceStr) !== price) {
  throw new Error('价格精度必须为两位小数');
}
```

### 7.6 价格相关接口

**获取商品价格历史：**
```
GET /api/products/:id/price-history
```

**批量获取商品价格：**
```
POST /api/products/price-batch
Content-Type: application/json

{
  "productIds": [1, 2, 3, 4, 5]
}
```

**价格预警（管理员）：**
```
GET /api/products/price-alert?threshold=1000
```
返回价格低于指定阈值的商品列表

---

## 8. JWT + Redis 会话滑动过期机制

### 概述

系统采用 JWT (JSON Web Token) + Redis 会话实现真正的滑动过期机制：

1. **JWT 认证**：Access Token（7天）用于身份验证
2. **Redis 会话**：存储用户会话信息，15分钟滑动过期
3. **真正的滑动过期**：用户持续操作时，Redis 会话自动续期，JWT 不变
4. **双层过期机制**：JWT 硬过期（7天）+ Redis 软过期（15分钟滑动）

**核心优势：**
- JWT 不需要频繁替换，减少网络开销
- Redis 会话自动续期，用户持续操作时永不过期
- 可以随时撤销会话（安全性更好）
- 支持同一用户多端登录，每个设备独立会话
- 双层过期机制，既保证安全性又提供良好用户体验

### 认证架构图

```
┌─────────────┐
│   登录流程   │
└──────┬──────┘
       │
       ├─→ POST /api/auth/login
       │
       ├─→ 验证用户名密码
       │
       ├─→ 生成 Access Token (7天)
       │
       ├─→ 创建 Redis 会话 (15分钟)
       │       key: session:user:{userId}
       │       value: { userId, username, role, createdAt }
       │       ttl: 900秒 (15分钟)
       │
       └─→ 返回 Access Token + 用户信息
           {
             accessToken: "eyJhbG...",
             tokenInfo: { expiresIn: 900 }
           }


┌─────────────────────────────────────┐
│        请求 API 流程                │
└──────────────┬──────────────────────┘
               │
               ├─→ 客户端携带 Access Token 请求
               │
               ├─→ authenticate 中间件验证 Token
               │
               ├─→ JWT 验证成功
               │
               ├─→ 检查 Redis 会话是否存在
               │
               ├─→ 会话存在？
               │   ├─→ 是 → 刷新会话过期时间（滑动过期）
               │   │        redis.expire(key, 900)
               │   │
               │   └─→ 否 → 返回 401 + SESSION_EXPIRED
               │
               ├─→ 处理业务逻辑
               │
               └─→ 返回响应


┌─────────────────────────────────────┐
│     三种认证场景                     │
└──────────────┬──────────────────────┘
               │
               ├─ 场景1：滑动过期（推荐）
               │   用户持续操作，每次请求自动刷新 Redis 会话
               │   JWT 不变，会话永不过期
               │
               ├─ 场景2：会话过期
               │   用户不操作 15 分钟后，Redis 会话过期
               │   即使 JWT 有效，也返回 401 + SESSION_EXPIRED
               │   前端需要重新登录
               │
               └─ 场景3：JWT 过期
                   JWT 有效期 7 天后过期
                   服务器返回 401 + TOKEN_EXPIRED
                   前端需要重新登录
```

### 认证中间件实现

**文件路径：** `src/middleware/auth.js`

```javascript
async function authenticate(req, res, next) {
  try {
    // 1. 检查白名单
    if (isWhitelisted(req)) {
      return next();
    }

    // 2. 提取 Token
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌',
      });
    }

    // 3. 验证 JWT
    const decoded = jwt.verify(token, config.jwt.secret);

    // 4. 检查 Redis 会话
    const sessionId = `user:${decoded.id}`;
    let session = null;

    try {
      session = await getSession(sessionId);

      if (!session) {
        // 会话不存在，即使 JWT 有效也拒绝访问
        return res.status(401).json({
          success: false,
          message: '会话已过期，请重新登录',
          code: 'SESSION_EXPIRED'
        });
      }

      // 滑动过期：刷新会话过期时间
      await refreshSession(sessionId, 900); // 15 分钟
    } catch (redisError) {
      console.error('[认证] Redis 操作失败:', redisError.message);
      // 开发环境下，Redis 失败时不影响认证流程
      if (process.env.NODE_ENV !== 'development') {
        return res.status(500).json({
          success: false,
          message: '认证过程中发生错误',
        });
      }
    }

    // 5. 将用户信息和会话信息附加到请求对象
    req.user = decoded;
    req.token = token;
    req.session = session;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: '无效的认证令牌',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: '认证令牌已过期',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(500).json({
      success: false,
      message: '认证过程中发生错误',
    });
  }
}
```

### Token 生成与验证

**Token 类型：**

| Token 类型 | 有效期 | 用途 | 生成函数 |
|-----------|--------|------|----------|
| Access Token | 7天 | API 认证 | `generateAccessToken()` |

**注意：** 真正的过期时间由 Redis 会话控制（15分钟滑动过期），JWT 只是用于身份验证，可以设置较长的有效期。

**Token 结构：**

```javascript
// Access Token Payload
{
  id: 1,
  username: "admin",
  role: "admin",
  type: "access",
  iat: 1711608000,    // 签发时间
  exp: 1712212800     // 过期时间（7天后）
}
```

**Redis 会话结构：**

```javascript
// Key: session:user:1
// Value:
{
  userId: 1,
  username: "admin",
  role: "admin",
  createdAt: "2026-03-28T10:00:00.000Z",
  userAgent: "Mozilla/5.0 ..."
}
// TTL: 900秒（15分钟），每次请求自动刷新
```

### 登录接口

**API 请求：**

```
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**响应：**

```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenInfo": {
      "expiresIn": 900,
      "message": "会话有效期 15 分钟，持续操作自动续期"
    }
  }
}
```

### 认证错误处理

**会话过期：**

```json
{
  "success": false,
  "message": "会话已过期，请重新登录",
  "code": "SESSION_EXPIRED"
}
```

**Token 过期：**

```json
{
  "success": false,
  "message": "认证令牌已过期",
  "code": "TOKEN_EXPIRED"
}
```

### 登出接口

**API 请求：**

```
POST /api/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**响应：**

```json
{
  "success": true,
  "message": "登出成功，请清除本地令牌"
}
```

**说明：** 登出时会删除 Redis 会话，客户端需要清除本地的 Token。

### 前端实现指南

**推荐实现方案（拦截器模式）：**

```javascript
// 1. 创建 Axios 实例
const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// 2. 请求拦截器 - 添加 Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 3. 响应拦截器 - 处理认证错误
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 处理会话过期
    if (
      error.response &&
      error.response.status === 401 &&
      error.response.data.code === 'SESSION_EXPIRED'
    ) {
      // 跳转登录页
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // 处理 Token 过期
    if (
      error.response &&
      error.response.status === 401 &&
      error.response.data.code === 'TOKEN_EXPIRED'
    ) {
      // 跳转登录页
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

// 4. 使用示例
async function getUsers() {
  try {
    const response = await api.get('/users');
    return response.data;
  } catch (error) {
    console.error('请求失败:', error);
  }
}
```

**特点：**
- JWT 不需要自动替换，减少网络开销
- Redis 会话自动续期，用户持续操作时永不过期
- 会话过期后直接跳转登录页，不需要刷新 Token
- 实现简单，代码清晰

### 白名单路由

**文件路径：** `src/middleware/auth.js`

以下路由不需要认证：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 登录 |
| GET | /health | 健康检查 |
| GET | /health/workers | 子进程健康检查 |
| GET | / | API 信息 |

### 安全特性

1. **双层过期机制**：JWT 硬过期（7天）+ Redis 软过期（15分钟滑动）
2. **会话管理**：Redis 会话可以随时撤销
3. **Token 过期检测**：明确返回 `TOKEN_EXPIRED` 和 `SESSION_EXPIRED` 错误码
4. **白名单机制**：敏感接口需要认证
5. **密码加密**：使用 bcrypt 哈希加密
6. **HTTPS 建议**：生产环境建议使用 HTTPS 传输 Token

### 认证流程最佳实践

1. **滑动过期**：Redis 会话自动续期，用户持续操作时永不过期
2. **处理过期错误**：收到 `SESSION_EXPIRED` 或 `TOKEN_EXPIRED` 错误时，跳转登录页
3. **Token 存储**：建议使用 localStorage 或 sessionStorage
4. **定期清理**：登出时清除本地 Token

### 认证流程说明

**滑动过期机制：**

1. 用户登录后，创建 Redis 会话（15分钟过期）
2. 每次请求时，检查 Redis 会话是否存在
3. 如果会话存在，自动刷新过期时间（15分钟）
4. 如果会话不存在，返回 SESSION_EXPIRED 错误
5. 用户持续操作时，会话永不过期

**会话过期场景：**

1. 用户不操作 15 分钟后，Redis 会话自动过期
2. 即使 JWT 仍然有效（7天内），也会被拒绝访问
3. 用户需要重新登录，创建新的会话

**JWT 过期场景：**

1. JWT 有效期 7 天后过期
2. 返回 TOKEN_EXPIRED 错误
3. 用户需要重新登录

**优势：**

- 用户持续操作时，会话永不过期（真正的滑动过期）
- JWT 不需要频繁替换，减少网络开销
- 可以随时撤销会话（删除 Redis 会话）
- 支持同一用户多端登录，每个设备独立会话

---

## 9. 子进程管理流程

### 启动子进程

**文件路径：** `src/app.js`

```javascript
createApp()
  ├── startExpiredOrderWorker()
  │   ├── fork('src/cron/expiredOrderWorker.js')
  │   ├── 记录启动时间和最后心跳时间
  │   ├── 监听 message 事件
  │   │   ├── heartbeat - 更新最后心跳时间
  │   │   └── pong - 记录子进程响应
  │   ├── 监听 error 事件
  │   ├── 监听 exit 事件（自动重启）
  │   └── 返回 worker 实例（包含 pid、startTime、lastHeartbeat）
  └── startOrderCreatedWorker()
      ├── fork('src/cron/orderCreatedWorker.js')
      ├── 记录启动时间和最后心跳时间
      ├── 监听 message 事件
      │   ├── heartbeat - 更新最后心跳时间
      │   ├── pong - 记录子进程响应和统计信息
      │   ├── order_created_done - 记录订单创建后处理结果
      │   ├── order_paid_done - 记录订单支付后处理结果
      │   └── order_cancelled_done - 记录订单取消后处理结果
      ├── 监听 error 事件
      ├── 监听 exit 事件（自动重启）
      └── 返回 worker 实例（包含 pid、startTime、lastHeartbeat）

// 启动所有子进程
app.workers.expiredOrderWorker = startExpiredOrderWorker();
app.workers.orderCreatedWorker = startOrderCreatedWorker();
```

### 过期订单处理子进程

**文件路径：** `src/cron/expiredOrderWorker.js`

```javascript
// 1. 子进程启动
if (require.main === module) {
  console.log('[过期订单处理] 子进程启动 (PID:', process.pid + ')');

  // 2. 立即执行首次过期订单检查
  console.log('[过期订单处理] 执行首次过期订单检查...');
  await processExpiredOrders();

  // 3. 设置定时器，每分钟执行一次
  processTimer = setInterval(async () => {
    await processExpiredOrders();
  }, 60 * 1000);

  // 4. 设置心跳，每30秒发送一次
  heartbeatTimer = setInterval(sendHeartbeat, 30 * 1000);

  // 5. 监听主进程消息
  process.on('message', (msg) => {
    if (msg.type === 'shutdown') {
      // 清理定时器并退出
      clearInterval(processTimer);
      clearInterval(heartbeatTimer);
      gracefulShutdown();
    } else if (msg.type === 'ping') {
      // 响应 ping 消息
      process.send({ type: 'pong', pid: process.pid });
    }
  });
}

// 6. 处理过期订单的具体方法
async function processExpiredOrders() {
  try {
    const count = await db.checkExpiredOrders();
    if (count > 0) {
      console.log(`[过期订单处理] 已处理 ${count} 个过期订单 (${new Date().toISOString()})`);
    }
  } catch (error) {
    console.error('[过期订单处理] 处理过期订单失败:', error.message);
  }
}

// 7. 数据库操作（dataAccess.js）
async function checkExpiredOrders() {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 查询过期的临时订单（expire_time < NOW()）
    const [expiredOrders] = await connection.execute(
      `SELECT id FROM orders
       WHERE status = 'temp' AND expire_time < NOW()
       LIMIT 100`
    );

    let processedCount = 0;

    for (const order of expiredOrders) {
      // 查询订单商品明细
      const [items] = await connection.execute(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [order.id]
      );

      // 恢复库存
      for (const item of items) {
        await connection.execute(
          `UPDATE products
           SET stock = stock + ?, frozen_stock = frozen_stock - ?
           WHERE id = ?`,
          [item.quantity, item.quantity, item.product_id]
        );
      }

      // 更新订单状态为已过期
      await connection.execute(
        `UPDATE orders
         SET status = 'expired', cancelled_reason = '订单过期未支付'
         WHERE id = ?`,
        [order.id]
      );

      processedCount++;
    }

    await connection.commit();
    return processedCount;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// 8. 心跳发送方法
function sendHeartbeat() {
  if (process.send) {
    process.send({
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
      pid: process.pid
    });
  }
}
```

### 订单事件处理子进程

**文件路径：** `src/cron/orderCreatedWorker.js`

```javascript
// 1. 子进程启动
if (require.main === module) {
  console.log('[订单处理] 子进程启动 (PID:', process.pid + ')');

  // 2. 设置心跳，每30秒发送一次
  heartbeatTimer = setInterval(sendHeartbeat, 30 * 1000);

  // 3. 监听主进程消息
  process.on('message', (msg) => {
    switch (msg.type) {
      case 'order_created':
        // 处理订单创建后的业务逻辑
        handleOrderCreated(msg.data)
          .then(() => {
            orderCreatedWorker.stats.processed++;
            process.send({ type: 'order_created_done', success: true });
          })
          .catch((err) => {
            orderCreatedWorker.stats.failed++;
            process.send({ type: 'order_created_done', success: false, error: err.message });
          });
        break;

      case 'order_paid':
        // 处理订单支付后的业务逻辑
        handleOrderPaid(msg.data)
          .then(() => {
            orderCreatedWorker.stats.processed++;
            process.send({ type: 'order_paid_done', success: true });
          })
          .catch((err) => {
            orderCreatedWorker.stats.failed++;
            process.send({ type: 'order_paid_done', success: false, error: err.message });
          });
        break;

      case 'order_cancelled':
        // 处理订单取消后的业务逻辑
        handleOrderCancelled(msg.data, msg.reason)
          .then(() => {
            orderCreatedWorker.stats.processed++;
            process.send({ type: 'order_cancelled_done', success: true });
          })
          .catch((err) => {
            orderCreatedWorker.stats.failed++;
            process.send({ type: 'order_cancelled_done', success: false, error: err.message });
          });
        break;

      case 'shutdown':
        // 清理定时器并退出
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        gracefulShutdown();
        break;

      case 'ping':
        // 响应 ping 消息，返回统计信息
        process.send({
          type: 'pong',
          pid: process.pid,
          stats: orderCreatedWorker.stats
        });
        break;
    }
  });
}

// 4. 处理订单创建后的业务逻辑
async function handleOrderCreated(orderData) {
  console.log(`[订单处理] 开始处理订单创建后的业务逻辑: ${orderData.orderNo}`);

  // 1. 发送通知（短信/邮件）
  await sendNotification(orderData.userId, `订单 ${orderData.orderNo} 创建成功，请及时支付`);

  // 2. 更新用户积分（订单金额的1%）
  const points = orderData.totalAmount * 0.01;
  await updateUserPoints(orderData.userId, points);

  // 3. 记录订单事件日志
  await logOrderEvent(orderData.id, 'created', {
    userId: orderData.userId,
    totalAmount: orderData.totalAmount,
    itemCount: orderData.items ? orderData.items.length : 0
  });

  console.log(`[订单处理] 订单创建后处理完成: ${orderData.orderNo}`);
}

// 5. 统计信息
orderCreatedWorker.stats = {
  processed: 0,  // 成功处理的数量
  failed: 0      // 失败的数量
};
```

### 子进程健康检查

**文件路径：** `src/app.js`

```javascript
GET /health/workers
  └── 返回子进程状态
      ├── expiredOrderWorker
      │   ├── pid: 子进程 PID
      │   ├── status: 'running' | 'stopped'
      │   ├── startTime: 启动时间戳
      │   └── lastHeartbeat: 最后心跳时间戳
      └── orderCreatedWorker
          ├── pid: 子进程 PID
          ├── status: 'running' | 'stopped'
          ├── startTime: 启动时间戳
          └── lastHeartbeat: 最后心跳时间戳
```

### 子进程监控机制

**自动重启机制：**
```javascript
// 监听子进程退出
worker.on('exit', (code, signal) => {
  // 非正常退出时自动重启（非 SIGTERM 和 SIGINT 信号）
  if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGINT') {
    console.log('[主进程] 5秒后重启子进程...');
    setTimeout(() => {
      app.workers.expiredOrderWorker = startExpiredOrderWorker();
    }, 5000);
  }
});
```

**心跳机制：**
```javascript
// 子进程每30秒发送心跳
setInterval(sendHeartbeat, 30 * 1000);

// 主进程记录心跳时间
worker.on('message', (msg) => {
  if (msg.type === 'heartbeat') {
    worker.lastHeartbeat = Date.now();
  }
});

// 可以检查心跳超时（例如：超过2分钟没有心跳则认为子进程异常）
if (Date.now() - worker.lastHeartbeat > 120000) {
  console.warn('[主进程] 子进程心跳超时，可能异常');
}
```

---

## 10. 优雅关闭流程

**文件路径：** `src/index.js`

```javascript
process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

gracefulShutdown()
  ├── 发送 shutdown 消息给子进程
  ├── 等待 5 秒（子进程优雅关闭）
  ├── 关闭服务器 server.close()
  └── 退出进程 process.exit(0)
```

**子进程：** `src/cron/expiredOrderWorker.js` / `src/cron/orderCreatedWorker.js`

```javascript
process.on('message', (msg) => {
  if (msg.type === 'shutdown') {
    clearInterval() - 清除定时器
    process.exit(0)
  }
})
```

---

## 11. 完整调用链路图

```
客户端请求
    ↓
路由层 (src/routes/*.js)
    ↓
中间件验证 (src/middleware/*.js)
    ├── authenticate - 身份验证
    │   ├── 检查白名单
    │   ├── 提取和验证 JWT Token
    │   ├── 检查 Token 剩余时间
    │   ├── 自动续期（滑动过期）
    │   │   ├── 生成新 Token
    │   │   ├── 通过响应头返回
    │   │   └── 通过响应体返回
    │   └── 附加用户信息到 req.user
    ├── requirePermission - 权限验证
    └── validateBody/validateParams - 参数验证
    ↓
控制器层 (src/controllers/*.js)
    ↓
数据访问层 (src/database/dataAccess.js)
    ↓
数据库操作 (src/database/mysql.js)
    ↓
MySQL 数据库
    ↓
返回响应 + Token 信息
    ↓
子进程异步处理 (src/cron/*.js)
```

---

## 12. 关键文件列表

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
| `src/database/redis.js` | Redis 连接和会话管理 |
| `src/database/redisStock.js` | Redis 库存管理 |

### 工具文件

| 文件路径 | 说明 |
|---------|------|
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

---

## 12.5 认证关键函数

### 文件路径

`src/middleware/auth.js`

### 核心函数说明

#### 1. authenticate(req, res, next)

**功能：** JWT 认证中间件，验证请求中的 JWT 令牌，并实现自动续期

**流程：**
```javascript
authenticate(req, res, next)
  ├── 1. 检查是否在白名单中
  │   └── isWhitelisted(req) → true/false
  ├── 2. 提取 Token
  │   └── extractToken(req) → token string
  ├── 3. 验证 Token
  │   └── jwt.verify(token, secret) → decoded payload
  ├── 4. 附加用户信息
  │   ├── req.user = decoded
  │   └── req.token = token
  ├── 5. 检查剩余时间
  │   └── getTokenRemainingTime(token) → seconds
  ├── 6. 自动续期（剩余时间 > 5分钟）
  │   ├── generateAccessToken(user) → newToken
  │   ├── res.setHeader('X-New-Access-Token', newToken)
  │   └── 重写 res.json，在响应体中添加新 Token
  └── 7. 继续处理
      └── next()
```

**返回响应：**
- **成功：** 继续到下一个中间件
- **失败：** 返回 401 错误
  - 无 Token：`未提供认证令牌`
  - 无效 Token：`无效的认证令牌`
  - 过期 Token：`认证令牌已过期` + `code: 'TOKEN_EXPIRED'`

#### 2. generateAccessToken(user)

**功能：** 生成 Access Token（短期令牌，15分钟）

**参数：**
```javascript
{
  id: 1,
  username: "admin",
  role: "admin"
}
```

**返回：** JWT Token 字符串

**Payload：**
```javascript
{
  id: 1,
  username: "admin",
  role: "admin",
  type: "access",
  iat: 1711608000,
  exp: 1711608900
}
```

#### 3. generateRefreshToken(user)

**功能：** 生成 Refresh Token（长期令牌，7天）

**参数：**
```javascript
{
  id: 1,
  username: "admin"
}
```

**返回：** JWT Token 字符串

**Payload：**
```javascript
{
  id: 1,
  username: "admin",
  type: "refresh",
  iat: 1711608000,
  exp: 1712212800
}
```

#### 4. generateTokens(user)

**功能：** 生成 Token 对（Access Token + Refresh Token）

**返回：**
```javascript
{
  accessToken: "eyJhbG...",
  refreshToken: "eyJhbG...",
  expiresIn: "15m"
}
```

#### 5. verifyRefreshToken(refreshToken)

**功能：** 验证 Refresh Token

**验证内容：**
- Token 签名是否正确
- Token 是否过期
- Token 类型是否为 `refresh`

**返回：** 解码后的用户信息或 `null`

#### 6. getTokenRemainingTime(token)

**功能：** 计算 Token 剩余时间（秒）

**返回：** 剩余秒数，如果 Token 无效则返回 `null`

**示例：**
```javascript
getTokenRemainingTime(token) → 890  // 剩余 14分50秒
```

#### 7. extractToken(req)

**功能：** 从请求头中提取 JWT 令牌

**请求头格式：**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**返回：** Token 字符串或 `null`

#### 8. isWhitelisted(req)

**功能：** 检查请求是否在白名单中

**白名单路由：**
```javascript
[
  { method: 'POST', path: '/api/auth/login' },
  { method: 'POST', path: '/api/auth/refresh' },
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/health/workers' },
  { method: 'GET', path: '/' }
]
```

**返回：** `true` 或 `false`

#### 9. optionalAuth(req, res, next)

**功能：** 可选认证中间件，如果提供了 Token 则验证，但不强制要求

**使用场景：** 接口可以匿名访问，但如果提供了 Token 也可以获取用户信息

#### 10. tokenInfoMiddleware(req, res, next)

**功能：** 在响应中添加 Token 剩余时间信息

**响应示例：**
```javascript
{
  "success": true,
  "data": { ... },
  "tokenInfo": {
    "expiresIn": 890,
    "shouldRefresh": false
  }
}
```

### 函数调用关系图

```
路由层 (src/routes/*.js)
    ↓
authenticate()
    ├── isWhitelisted()
    ├── extractToken()
    ├── jwt.verify()
    ├── getTokenRemainingTime()
    └── generateAccessToken()
        └── jwt.sign()

控制器层 (src/controllers/authController.js)
    ├── login()
    │   └── generateTokens()
    │       ├── generateAccessToken()
    │       └── generateRefreshToken()
    └── refreshToken()
        └── verifyRefreshToken()
```

### 自动续期触发条件

```
Token 剩余时间 > 5 分钟 (300秒)
    ↓
满足条件
    ↓
自动续期
    ├── 生成新 Token
    ├── 通过响应头返回
    └── 通过响应体返回
```

### 认证错误处理

| 错误类型 | 错误名称 | 状态码 | 返回消息 | 错误码 |
|---------|----------|--------|----------|--------|
| Token 无效 | JsonWebTokenError | 401 | 无效的认证令牌 | - |
| Token 过期 | TokenExpiredError | 401 | 认证令牌已过期 | TOKEN_EXPIRED |
| 未提供 Token | - | 401 | 未提供认证令牌 | - |
| 其他错误 | - | 500 | 认证过程中发生错误 | - |

### Token 配置

**配置文件：** `src/config/index.js`

```javascript
jwt: {
  secret: process.env.JWT_SECRET || 'default_secret_key',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d'
}
```

**硬编码配置（auth.js）：**
- Access Token 有效期：`15m`（15分钟）
- Refresh Token 有效期：`7d`（7天）
- 自动续期阈值：`300`秒（5分钟）

---

## 13. 订单状态流转

```
temp (临时订单，30分钟有效期)
    ↓
pending (待支付) - 通过支付接口转换
    ↓
paid (已支付)
    ↓
shipped (已发货)
    ↓
delivered (已送达)

temp/pending
    ↓
cancelled (已取消) - 用户取消或系统取消

temp
    ↓
expired (已过期) - 30分钟后自动过期
```

---

## 14. 事务管理机制

### transaction 函数使用

**文件路径：** `src/database/mysql.js`

```javascript
// transaction 函数定义
async function transaction(callback) {
  const connection = await getConnection();

  try {
    // 开始事务
    await connection.beginTransaction();

    // 执行事务回调
    const result = await callback(connection);

    // 提交事务
    await connection.commit();

    return result;
  } catch (error) {
    // 回滚事务
    await connection.rollback();
    throw error;
  } finally {
    // 释放连接
    connection.release();
  }
}
```

### 使用示例

**旧方式（手动管理事务）：**
```javascript
const connection = await db.getConnection();
try {
  await connection.beginTransaction();
  // 执行操作...
  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
}
```

**新方式（使用 transaction 函数）：**
```javascript
const result = await db.transaction(async (connection) => {
  // 执行操作...
  return result;
});
```

### 优势

1. **简化代码**：不需要手动管理 beginTransaction、commit、rollback、release
2. **自动清理**：无论成功失败都会释放连接
3. **统一管理**：所有事务使用相同的错误处理逻辑
4. **防止泄露**：避免忘记释放连接导致连接泄露

### 使用 transaction 的函数

在 `dataAccess.js` 中，以下函数使用了 `transaction` 函数：

- `createOrder()` - 创建订单
- `cancelOrder()` - 取消订单
- `updateOrderToPaid()` - 更新订单为已支付
- `checkExpiredOrders()` - 检查过期订单

---

## 15. 库存管理机制

### Redis 缓存 + 原子操作架构

**核心设计：**
- 使用 Redis 缓存商品库存，提升查询性能
- 使用 Redis 原子操作（decrBy/incrBy）扣减和恢复库存
- 异步同步到数据库，保证最终一致性
- 应用启动时自动预热缓存

**数据结构：**

```
商品表结构（MySQL）：
- stock: 可用库存（用户可以购买的数量）
- frozen_stock: 冻结库存（临时订单占用的数量）
- version: 乐观锁版本号（防止并发冲突）

Redis 缓存结构：
- Key: product:stock:{productId}
- Value: 库存数量（整数）
- TTL: 3600 秒（1小时）
```

**创建订单流程：**

```
1. 从 Redis 获取库存
   ├─ 优先从 Redis 缓存读取
   └─ 如果缓存未命中，从数据库读取并缓存

2. 使用 Redis 原子操作扣减库存
   ├─ redis.decrBy(key, quantity)
   ├─ 如果剩余库存 < 0，自动回滚
   └─ 返回扣减结果（success, remaining）

3. 创建订单（数据库事务）
   ├─ 插入订单信息
   └─ 插入订单商品明细

4. 异步同步到数据库
   └─ 不阻塞订单创建流程
```

**取消订单流程：**

```
1. 使用 Redis 原子操作恢复库存
   └─ redis.incrBy(key, quantity)

2. 更新订单状态
   └─ status = 'cancelled'

3. 异步同步到数据库
   └─ 不阻塞订单取消流程
```

**库存同步机制：**

```
Redis -> 数据库（异步同步）：
- 订单创建后，异步更新数据库库存
- 订单取消后，异步恢复数据库库存
- 失败时记录日志，不影响主流程

数据库 -> Redis（缓存预热）：
- 应用启动时，自动缓存所有商品库存
- 管理员可以手动触发同步（开发环境）
- 缓存未命中时，自动从数据库加载

手动同步接口（仅开发环境）：
POST /admin/sync/redis-to-db  - 同步 Redis -> 数据库
POST /admin/sync/db-to-redis  - 同步 数据库 -> Redis
```

**高并发优势：**

```
旧方案（数据库锁）：
- 使用 FOR UPDATE 行锁
- 高并发时大量请求排队
- 数据库连接池耗尽
- 响应时间剧增

新方案（Redis 原子操作）：
- Redis 单线程处理，无锁竞争
- 原子操作天然避免并发问题
- 数据库压力大幅降低
- 响应时间极短（~5ms）
```

**数据一致性保证：**

1. **Redis 原子操作** - 保证并发安全
2. **数据库事务** - 保证订单创建的原子性
3. **异步同步** - 保证最终一致性
4. **故障降级** - Redis 故障时降级到数据库（开发环境）

**库存管理函数：**

**文件路径：** `src/database/redisStock.js`

| 函数 | 功能 |
|------|------|
| `cacheProductStock()` | 缓存商品库存到 Redis |
| `getProductStock()` | 获取商品库存（优先从 Redis） |
| `decreaseStock()` | 使用原子操作扣减库存 |
| `increaseStock()` | 使用原子操作恢复库存 |
| `batchCacheStock()` | 批量预热缓存 |
| `syncStockFromDB()` | 从数据库同步到 Redis |
| `clearProductStockCache()` | 清除商品库存缓存 |

**库存同步工具：**

**文件路径：** `src/utils/stockSync.js`

| 函数 | 功能 |
|------|------|
| `syncProductStock()` | 同步单个商品（Redis -> 数据库） |
| `syncAllStock()` | 同步所有商品（Redis -> 数据库） |
| `syncStockFromDB()` | 从数据库同步到 Redis |
| `batchSyncFromDB()` | 批量从数据库同步到 Redis |

---

## 16. 安全特性

1. **身份验证**：JWT Token 验证
2. **权限控制**：基于角色的权限验证
3. **参数验证**：请求参数格式验证
4. **乐观锁**：防止库存超卖
5. **事务处理**：保证数据一致性
6. **SQL 注入防护**：使用参数化查询
7. **密码加密**：bcrypt 哈希加密

---

## 17. 性能优化

1. **Redis 库存缓存**：
   - 商品库存缓存到 Redis，减少数据库查询
   - 使用 Redis 原子操作扣减库存，避免数据库锁
   - 应用启动时自动预热缓存
   - 缓存 1 小时过期，自动更新

2. **连接池**：MySQL 连接池管理

3. **子进程**：异步处理耗时任务

4. **进程隔离**：子进程崩溃不影响主进程

5. **自动重启**：子进程异常退出自动重启

6. **心跳机制**：监控子进程健康状态

7. **优雅关闭**：支持平滑重启

8. **异步同步**：库存变更异步同步到数据库，不阻塞主流程

---

## 18. 测试账号

| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| admin | admin123 | admin | 超级管理员 |
| manager | manager123 | manager | 管理员 |
| staff | staff123 | staff | 普通员工 |

---

## 19. 启动命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 启动生产服务器
npm start
```

---

## 20. 端口和访问

- 服务端口：3000
- 基础 URL：http://localhost:3000
- API 基础路径：/api
- 健康检查：/health
- 子进程健康检查：/health/workers

### 库存同步管理端点（仅开发环境）

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 同步 Redis -> 数据库 | POST | /admin/sync/redis-to-db | 手动触发 Redis 库存同步到数据库 |
| 同步 数据库 -> Redis | POST | /admin/sync/db-to-redis | 手动触发数据库库存同步到 Redis |

### 认证相关接口

| 接口 | 方法 | 路径 | 是否需要认证 | 说明 |
|------|------|------|-------------|------|
| 登录 | POST | /api/auth/login | 否 | 用户登录，返回 Token |
| 获取当前用户 | GET | /api/auth/me | 是 | 获取当前登录用户信息 |
| 登出 | POST | /api/auth/logout | 是 | 用户登出 |

### Redis 库存缓存测试

**测试方法：**
```bash
# 1. 查看商品库存（从 Redis 缓存读取）
curl -X GET http://localhost:3000/api/products/1

# 2. 创建订单（自动扣减 Redis 库存）
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"productId": 1, "quantity": 2}]}'

# 3. 取消订单（自动恢复 Redis 库存）
curl -X POST http://localhost:3000/api/orders/1/cancel \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 4. 手动同步库存（仅开发环境）
curl -X POST http://localhost:3000/admin/sync/redis-to-db
```

**方法 1：使用 curl**

```bash
# 保存响应头到文件
curl -D headers.txt -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 查看响应头
cat headers.txt

# 检查是否包含新的 Token
grep "X-New-Access-Token" headers.txt
```

**方法 2：使用 Postman**

1. 发送请求
2. 查看响应头的 `X-New-Access-Token` 字段
3. 查看响应体的 `tokenInfo.accessToken` 字段

**方法 3：使用浏览器开发者工具**

1. 打开 Network 标签
2. 发送请求
3. 查看响应头中的 `X-New-Access-Token`
4. 查看响应体中的 `tokenInfo`

---

*文档生成时间：2026-03-28*