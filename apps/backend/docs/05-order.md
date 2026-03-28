# 05-订单管理

## 📋 目录

- [概述](#概述)
- [订单列表](#订单列表)
- [订单详情](#订单详情)
- [创建订单](#创建订单)
- [取消订单](#取消订单)
- [订单支付](#订单支付)
- [订单统计](#订单统计)
- [订单状态流转](#订单状态流转)
- [数据模型](#数据模型)

## 概述

订单管理模块提供完整的订单生命周期管理，支持 Redis 高并发库存扣减和子进程异步处理。

### 核心特性

- ✅ Redis 原子操作扣减库存，避免并发冲突
- ✅ 子进程异步处理订单事件，不阻塞主流程
- ✅ 价格快照机制，订单价格不受商品价格变化影响
- ✅ 支持订单状态流转
- ✅ 自动过期订单处理
- ✅ 库存自动恢复（取消/过期订单）

## 订单列表

### API 请求

```
GET /api/orders?page=1&pageSize=10&status=pending&orderNo=ORD20260328...
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### 查询参数

| 参数 | 类型 | 必填 | 说明 | 默认值 |
|------|------|------|------|--------|
| page | number | 否 | 页码 | 1 |
| pageSize | number | 否 | 每页数量 | 10 |
| status | string | 否 | 订单状态 | - |
| orderNo | string | 否 | 订单号 | - |

### 响应示例

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "orderNo": "ORD20260328100000123",
        "userId": 1,
        "userName": "admin",
        "totalAmount": 15998.00,
        "status": "temp",
        "expireTime": "2026-03-28T10:30:00.000Z",
        "createdAt": "2026-03-28T10:00:00.000Z",
        "items": [
          {
            "id": 1,
            "orderId": 1,
            "productId": 1,
            "productName": "iPhone 15 Pro",
            "quantity": 2,
            "price": 7999.00,
            "subtotal": 15998.00
          }
        ]
      }
    ],
    "total": 10,
    "page": 1,
    "pageSize": 10
  }
}
```

## 订单详情

### API 请求

```
GET /api/orders/:id
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### 响应示例

```json
{
  "success": true,
  "data": {
    "id": 1,
    "orderNo": "ORD20260328100000123",
    "userId": 1,
    "userName": "admin",
    "totalAmount": 15998.00,
    "status": "temp",
    "expireTime": "2026-03-28T10:30:00.000Z",
    "createdAt": "2026-03-28T10:00:00.000Z",
    "items": [
      {
        "id": 1,
        "orderId": 1,
        "productId": 1,
        "productName": "iPhone 15 Pro",
        "quantity": 2,
        "price": 7999.00,
        "subtotal": 15998.00
      }
    ]
  }
}
```

## 创建订单

### API 请求

```
POST /api/orders
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
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
}
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | number | 是 | 用户ID |
| userName | string | 是 | 用户名 |
| items | array | 是 | 商品列表 |
| items[].productId | number | 是 | 商品ID |
| items[].productName | string | 是 | 商品名称 |
| items[].quantity | number | 是 | 数量 |
| items[].price | number | 是 | 单价（快照） |

### 处理流程

```
1. 生成订单号（ORD + timestamp + random）
2. 循环处理每个商品（Redis 原子操作扣减库存）：
   ├─ 从 Redis 获取库存
   ├─ 检查库存是否充足
   └─ 使用 decrBy 原子操作扣减库存
3. 如果所有商品库存扣减成功：
   ├─ 创建订单（数据库事务）
   ├─ 插入订单商品明细
   └─ 异步同步到数据库
4. 如果库存不足：
   ├─ 回滚已扣减的库存
   └─ 返回错误信息
5. 将订单创建事件发送到子进程（异步处理）
```

### 响应示例

```json
{
  "success": true,
  "message": "订单创建成功",
  "data": {
    "id": 1,
    "orderNo": "ORD20260328100000123",
    "userId": 1,
    "userName": "admin",
    "totalAmount": 15998.00,
    "status": "temp",
    "expireTime": "2026-03-28T10:30:00.000Z",
    "createdAt": "2026-03-28T10:00:00.000Z",
    "items": [
      {
        "productId": 1,
        "productName": "iPhone 15 Pro",
        "quantity": 2,
        "price": 7999.00,
        "subtotal": 15998.00
      }
    ]
  }
}
```

### 错误响应

```json
{
  "success": false,
  "message": "商品 iPhone 15 Pro 库存不足"
}
```

## 取消订单

### API 请求

```
POST /api/orders/:id/cancel
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "reason": "用户取消"
}
```

### 处理流程

```
1. 查询订单信息（加锁）
2. 检查订单状态（只能取消 temp 或 pending 状态）
3. 查询订单商品明细
4. 循环恢复库存（Redis 原子操作）：
   ├─ 使用 incrBy 原子操作恢复库存
   └─ 异步同步到数据库
5. 更新订单状态为 cancelled
6. 将订单取消事件发送到子进程（异步处理）
```

### 响应示例

```json
{
  "success": true,
  "message": "订单取消成功",
  "data": {
    "id": 1,
    "orderNo": "ORD20260328100000123",
    "status": "cancelled",
    "cancelledReason": "用户取消"
  }
}
```

## 订单支付

### API 请求

```
POST /api/orders/:id/pay
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### 处理流程

```
1. 查询订单信息（加锁）
2. 检查订单状态（只能支付 temp 状态）
3. 释放冻结库存（更新数据库）
4. 更新订单状态为 paid
5. 将订单支付事件发送到子进程（异步处理）
```

### 响应示例

```json
{
  "success": true,
  "message": "订单支付成功",
  "data": {
    "id": 1,
    "orderNo": "ORD20260328100000123",
    "status": "paid"
  }
}
```

## 订单统计

### API 请求

```
GET /api/orders/statistics
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### 响应示例

```json
{
  "success": true,
  "data": {
    "total": 100,
    "temp": 10,
    "pending": 20,
    "paid": 50,
    "shipped": 15,
    "delivered": 3,
    "cancelled": 1,
    "expired": 1,
    "totalAmount": 500000.00
  }
}
```

## 订单状态流转

### 状态定义

| 状态 | 说明 | 说明 |
|------|------|------|
| `temp` | 临时订单 | 创建后30分钟内未支付 |
| `pending` | 待支付 | 已创建，等待支付 |
| `paid` | 已支付 | 支付成功 |
| `shipped` | 已发货 | 已发货 |
| `delivered` | 已送达 | 已送达 |
| `cancelled` | 已取消 | 用户取消或系统取消 |
| `expired` | 已过期 | 30分钟后未支付自动过期 |

### 状态流转图

```
temp (临时订单)
    ↓
    ├─ 支付 → paid (已支付)
    │   ↓
    │   ├─ 发货 → shipped (已发货)
    │   │   ↓
    │   │   └─ 送达 → delivered (已送达)
    │   │
    │   └─ 取消 → cancelled (已取消)
    │
    ├─ 30分钟过期 → expired (已过期)
    │
    └─ 取消 → cancelled (已取消)
```

### 允许的状态流转

| 当前状态 | 可转换到 |
|---------|---------|
| temp | paid, cancelled |
| pending | paid, cancelled |
| paid | shipped, cancelled |
| shipped | delivered |
| delivered | - |
| cancelled | - |
| expired | - |

## 数据模型

### orders 表结构

```sql
CREATE TABLE orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(50) UNIQUE NOT NULL,
  user_id INT NOT NULL,
  user_name VARCHAR(100) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status ENUM('temp', 'pending', 'paid', 'shipped', 'delivered', 'cancelled', 'expired') DEFAULT 'temp',
  expire_time TIMESTAMP NULL,
  cancelled_reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### order_items 表结构

```sql
CREATE TABLE order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

*最后更新: 2026-03-28*