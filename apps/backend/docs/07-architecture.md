# 07-系统架构

## 📋 目录

- [架构概述](#架构概述)
- [子进程管理](#子进程管理)
- [优雅关闭](#优雅关闭)
- [调用链路](#调用链路)

## 架构概述

系统采用 **主进程 + 子进程** 的架构，将耗时任务异步化处理，提升系统性能和响应速度。

### 架构图

```
┌─────────────────────────────────────────┐
│             主进程 (Main)               │
│  - Express 服务器                       │
│  - API 路由处理                         │
│  - 业务逻辑处理                         │
│  - 子进程管理                           │
└──────────────┬──────────────────────────┘
               │
               ├─→ 子进程 1: 过期订单处理
               │   - 定时检查过期订单
               │   - 自动恢复库存
               │   - 发送通知
               │
               └─→ 子进程 2: 订单事件处理
                   - 发送通知
                   - 更新积分
                   - 记录日志
```

### 核心优势

- ✅ 进程隔离：子进程崩溃不影响主进程
- ✅ 自动重启：子进程异常退出自动重启
- ✅ 心跳监控：监控子进程健康状态
- ✅ 优雅关闭：支持平滑重启

## 子进程管理

### 过期订单处理子进程

**文件路径：** `src/cron/expiredOrderWorker.js`

**功能：**
- 每 60 秒检查一次过期订单
- 自动恢复过期订单的库存
- 发送过期通知

**启动流程：**
```javascript
// 1. 子进程启动
if (require.main === module) {
  console.log('[过期订单处理] 子进程启动 (PID:', process.pid + ')');

  // 2. 立即执行首次检查
  await processExpiredOrders();

  // 3. 设置定时器，每 60 秒执行一次
  setInterval(async () => {
    await processExpiredOrders();
  }, 60 * 1000);

  // 4. 设置心跳，每 30 秒发送一次
  setInterval(sendHeartbeat, 30 * 1000);
}
```

**心跳机制：**
```javascript
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

**功能：**
- 处理订单创建后的业务逻辑
- 处理订单支付后的业务逻辑
- 处理订单取消后的业务逻辑

**消息监听：**
```javascript
process.on('message', (msg) => {
  switch (msg.type) {
    case 'order_created':
      handleOrderCreated(msg.data);
      break;

    case 'order_paid':
      handleOrderPaid(msg.data);
      break;

    case 'order_cancelled':
      handleOrderCancelled(msg.data, msg.reason);
      break;
  }
});
```

### 子进程健康检查

**API 请求：**
```
GET /health/workers
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "expiredOrderWorker": {
      "pid": 12345,
      "status": "running"
    },
    "orderCreatedWorker": {
      "pid": 12346,
      "status": "running"
    }
  }
}
```

## 优雅关闭

### 关闭流程

**文件路径：** `src/index.js`

```javascript
const gracefulShutdown = (signal) => {
  console.log(`${signal} 信号接收，正在关闭服务器...`);

  // 1. 发送 shutdown 消息给子进程
  if (app.workers) {
    if (app.workers.expiredOrderWorker) {
      app.workers.expiredOrderWorker.send({ type: 'shutdown' });
    }
    if (app.workers.orderCreatedWorker) {
      app.workers.orderCreatedWorker.send({ type: 'shutdown' });
    }
  }

  // 2. 等待 5 秒（子进程优雅关闭）
  setTimeout(() => {
    // 3. 关闭服务器
    server.close(() => {
      console.log('服务器已关闭');

      // 4. 关闭 Redis 连接
      closeRedisConnection();

      process.exit(0);
    });
  }, 5000);
};
```

### 监听退出信号

```javascript
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

### 子进程关闭处理

```javascript
process.on('message', (msg) => {
  if (msg.type === 'shutdown') {
    clearInterval(processTimer);
    clearInterval(heartbeatTimer);
    gracefulShutdown();
  }
});
```

## 调用链路

### 完整调用链路图

```
客户端请求
    ↓
路由层 (src/routes/*.js)
    ↓
中间件验证 (src/middleware/*.js)
    ├── authenticate - 身份验证
    ├── requirePermission - 权限验证
    └── validateBody - 参数验证
    ↓
控制器层 (src/controllers/*.js)
    ↓
数据访问层 (src/database/dataAccess.js)
    ├── Redis 操作（库存管理）
    └── MySQL 操作（数据持久化）
    ↓
子进程异步处理 (src/cron/*.js)
    ├── 过期订单处理
    └── 订单事件处理
    ↓
返回响应
```

### 订单创建调用链路

```
POST /api/orders
    ↓
authenticate 中间件
    ├── 验证 JWT
    ├── 检查 Redis 会话
    └── 刷新会话过期时间
    ↓
createOrder 控制器
    ├── 生成订单号
    └── 调用 db.createOrder()
    ↓
createOrder 数据访问层
    ├── 循环处理商品
    │   ├── Redis 原子操作扣减库存
    │   ├── 检查库存是否充足
    │   └── 如果失败，回滚库存
    ├── 数据库事务创建订单
    ├── 插入订单商品明细
    └── 异步同步到数据库
    ↓
发送消息到子进程
    └── worker.send({ type: 'order_created' })
    ↓
返回响应
```

---

*最后更新: 2026-03-28*