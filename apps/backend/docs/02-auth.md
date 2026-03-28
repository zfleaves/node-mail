# 02-认证与授权

## 📋 目录

- [概述](#概述)
- [认证架构](#认证架构)
- [JWT + Redis 会话机制](#jwt--redis-会话机制)
- [登录流程](#登录流程)
- [退出登录流程](#退出登录流程)
- [会话滑动过期](#会话滑动过期)
- [认证中间件](#认证中间件)
- [API 接口](#api-接口)

## 概述

系统采用 **JWT (JSON Web Token) + Redis 会话** 实现认证与授权：

1. **JWT 认证**：Access Token（7天）用于身份验证
2. **Redis 会话**：存储用户会话信息，15分钟滑动过期
3. **真正的滑动过期**：用户持续操作时，Redis 会话自动续期，JWT 不变

**核心优势：**
- ✅ JWT 不需要频繁替换，减少网络开销
- ✅ Redis 会话自动续期，用户持续操作时永不过期
- ✅ 可以随时撤销会话（删除 Redis 会话）
- ✅ 支持同一用户多端登录，每个设备独立会话
- ✅ 双层过期机制：JWT 硬过期（7天）+ Redis 软过期（15分钟滑动）

## 认证架构

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
       └─→ 返回 Token + 用户信息


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

## JWT + Redis 会话机制

### Token 结构

**Access Token Payload:**
```javascript
{
  id: 1,
  username: "admin",
  role: "admin",
  type: "access",
  iat: 1711608000,    // 签发时间
  exp: 1712212800     // 过期时间（7天后）
}
```

**Redis 会话结构:**
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

### 双层过期机制

| 层级 | 过期时间 | 作用 | 触发场景 |
|------|---------|------|----------|
| **JWT 硬过期** | 7天 | 安全边界，最终保护 | JWT 签发 7 天后 |
| **Redis 软过期** | 15分钟滑动过期 | 用户体验，活跃续期 | 用户不操作 15 分钟后 |

**为什么需要两层？**

1. **JWT 硬过期（7天）：**
   - 提供**最终安全边界**
   - 即使 Redis 不可用或被绕过，JWT 也会过期
   - 防止永久有效的令牌

2. **Redis 软过期（15分钟滑动）：**
   - 提供**更好的用户体验**
   - 用户持续操作时，会话永不过期
   - 可以随时撤销会话（安全性更好）
   - 支持同一用户多端登录

## 登录流程

### API 请求

```
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

### 路由层

**文件路径：** `src/routes/auth.js`

```javascript
router.post(
  '/login',
  validateBody({
    username: { required: true, validator: 'username', label: '用户名' },
    password: { required: true, validator: 'password', label: '密码' },
  }),
  login
)
```

### 控制器层

**文件路径：** `src/controllers/authController.js`

```javascript
async function login(req, res) {
  // 1. 获取请求参数
  const { username, password } = req.body;

  // 2. 验证用户名密码
  const user = await User.login(username, password);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: '用户名或密码错误',
    });
  }

  // 3. 生成 Access Token
  const tokens = generateTokens(user);

  // 4. 创建 Redis 会话（15分钟过期）
  const sessionId = `user:${user.id}`;
  const sessionData = {
    userId: user.id,
    username: user.username,
    role: user.role,
    createdAt: new Date().toISOString(),
    userAgent: req.headers['user-agent'] || ''
  };

  await createSession(sessionId, sessionData, 900);

  // 5. 返回登录信息
  res.json({
    success: true,
    message: '登录成功',
    data: {
      user,
      accessToken: tokens.accessToken,
      tokenInfo: {
        expiresIn: 900, // 会话有效期 15 分钟
        message: '会话有效期 15 分钟，持续操作自动续期'
      }
    },
  });
}
```

### 响应示例

```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin",
      "name": "管理员"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenInfo": {
      "expiresIn": 900,
      "message": "会话有效期 15 分钟，持续操作自动续期"
    }
  }
}
```

## 退出登录流程

### API 请求

```
POST /api/auth/logout
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### 路由层

**文件路径：** `src/routes/auth.js`

```javascript
router.post('/logout', authenticate, logout)
```

### 控制器层

**文件路径：** `src/controllers/authController.js`

```javascript
async function logout(req, res) {
  // 1. 删除 Redis 会话
  if (req.user && req.user.id) {
    const sessionId = `user:${req.user.id}`;
    await deleteSession(sessionId);
  }

  // 2. 返回成功消息
  res.json({
    success: true,
    message: '登出成功，请清除本地令牌',
  });
}
```

### 说明

**注意：** 由于使用 JWT (JSON Web Token) 进行身份验证，token 存储在客户端，服务器端不需要维护 session。退出登录实际上是客户端删除 token，但服务器端会删除 Redis 会话以提供安全性。

## 会话滑动过期

### 工作原理

**Redis 会话过期机制：**

1. 用户登录后，创建 Redis 会话（15分钟过期）
2. 每次请求时，检查 Redis 会话是否存在
3. 如果会话存在，自动刷新过期时间（15分钟）
4. 如果会话不存在，返回 SESSION_EXPIRED 错误
5. 用户持续操作时，会话永不过期

### 会话过期场景

**场景1：用户持续操作**
```
00:00 - 登录，创建会话（15分钟）
00:05 - 用户操作，会话续期（15分钟）
00:10 - 用户操作，会话续期（15分钟）
00:15 - 用户操作，会话续期（15分钟）
...
用户持续操作，会话永不过期
```

**场景2：用户不操作**
```
00:00 - 登录，创建会话（15分钟）
00:14 - 用户操作，会话续期（15分钟）
00:15 - 用户停止操作
00:30 - 用户再次操作，会话已过期
        返回 401 + SESSION_EXPIRED
        前端需要重新登录
```

**场景3：JWT 过期**
```
Day 1 - 用户登录，JWT 有效期 7 天
Day 7 - 用户操作，JWT 仍然有效
Day 8 - 用户操作，JWT 已过期
        返回 401 + TOKEN_EXPIRED
        前端需要重新登录
```

## 认证中间件

### authenticate 中间件

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
    let session = await getSession(sessionId);

    if (!session) {
      // 会话不存在，即使 JWT 有效也拒绝访问
      return res.status(401).json({
        success: false,
        message: '会话已过期，请重新登录',
        code: 'SESSION_EXPIRED'
      });
    }

    // 5. 滑动过期：刷新会话过期时间
    await refreshSession(sessionId, 900); // 15 分钟

    // 6. 将用户信息和 token 附加到请求对象
    req.user = decoded;
    req.token = token;
    req.session = session;

    next();
  } catch (error) {
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

### 白名单路由

以下路由不需要认证：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 登录 |
| GET | /health | 健康检查 |
| GET | /health/workers | 子进程健康检查 |
| GET | / | API 信息 |

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

**未提供 Token：**

```json
{
  "success": false,
  "message": "未提供认证令牌"
}
```

## API 接口

### 登录

**请求：**
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
    "user": { ... },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenInfo": {
      "expiresIn": 900,
      "message": "会话有效期 15 分钟，持续操作自动续期"
    }
  }
}
```

### 获取当前用户信息

**请求：**
```
GET /api/auth/me
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "name": "管理员"
  }
}
```

### 退出登录

**请求：**
```
POST /api/auth/logout
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**响应：**
```json
{
  "success": true,
  "message": "登出成功，请清除本地令牌"
}
```

## 前端实现指南

### 请求拦截器

```javascript
// 创建 Axios 实例
const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器 - 添加 Token
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

// 响应拦截器 - 处理认证错误
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
```

## 安全特性

1. **密码加密**：使用 bcrypt 哈希加密存储
2. **Token 类型验证**：验证 JWT 的 type 字段
3. **Token 过期检测**：明确返回 `TOKEN_EXPIRED` 错误码
4. **会话验证**：每次请求检查 Redis 会话
5. **滑动过期**：用户持续操作时自动续期
6. **会话撤销**：可以随时删除 Redis 会话

---

*最后更新: 2026-03-28*