# 04-商品管理

## 📋 目录

- [概述](#概述)
- [商品列表](#商品列表)
- [商品详情](#商品详情)
- [创建商品](#创建商品)
- [更新商品](#更新商品)
- [删除商品](#删除商品)
- [更新库存](#更新库存)
- [获取价格历史](#获取价格历史)
- [获取价格稳定性](#获取价格稳定性)
- [价格处理](#价格处理)
- [数据模型](#数据模型)

## 概述

商品管理模块提供完整的商品 CRUD 操作，支持 Redis 缓存以提升高并发性能。

### 核心特性

- ✅ Redis 缓存库存，提升查询性能
- ✅ Redis 原子操作扣减库存，避免并发冲突
- ✅ 价格快照机制，订单价格不受商品价格变化影响
- ✅ 支持分页、筛选、搜索
- ✅ 支持批量操作

## 商品列表

### API 请求

```
GET /api/products?page=1&pageSize=10&category=electronics&status=active
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### 查询参数

| 参数 | 类型 | 必填 | 说明 | 默认值 |
|------|------|------|------|--------|
| page | number | 否 | 页码 | 1 |
| pageSize | number | 否 | 每页数量 | 10 |
| category | string | 否 | 商品分类 | - |
| status | string | 否 | 商品状态（active/inactive） | - |
| keyword | string | 否 | 搜索关键词 | - |

### 响应示例

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "name": "iPhone 15 Pro",
        "description": "最新款 iPhone",
        "price": 7999.00,
        "originalPrice": 8999.00,
        "discount": 11.11,
        "stock": 100,
        "frozenStock": 0,
        "category": "electronics",
        "status": "active",
        "tags": ["手机", "苹果", "5G"],
        "created_at": "2026-03-28T10:00:00.000Z",
        "updated_at": "2026-03-28T10:00:00.000Z"
      }
    ],
    "total": 10,
    "page": 1,
    "pageSize": 10
  }
}
```

## 商品详情

### API 请求

```
GET /api/products/info?id=1
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 商品 ID |

### 响应示例

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "iPhone 15 Pro",
    "description": "最新款 iPhone",
    "price": 7999.00,
    "originalPrice": 8999.00,
    "discount": 11.11,
    "stock": 100,
    "frozenStock": 0,
    "category": "electronics",
    "status": "active",
    "tags": ["手机", "苹果", "5G"],
    "created_at": "2026-03-28T10:00:00.000Z",
    "updated_at": "2026-03-28T10:00:00.000Z"
  }
}
```

## 创建商品

### API 请求

**方式一：普通创建（不带文件）**
```
POST /api/products/create
Authorization: Bearer YOUR_ACCESS_TOKEN
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

**方式二：创建商品并上传文件**
```
POST /api/products/create-with-files
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

name: iPhone 15 Pro
description: 最新款 iPhone
price: 7999.00
originalPrice: 8999.00
stock: 100
category: electronics
status: active
tags: ["手机", "苹果", "5G"]
images: (文件 1)
images: (文件 2)
images: (文件 3)
videos: (文件 1)
```

### 文件上传说明

**支持的上传方式：**

1. **使用 multipart/form-data 格式**
   - 可以同时上传图片和视频
   - 支持多文件上传

2. **文件类型限制**
   - **图片**：jpeg, jpg, png, gif, webp, bmp
   - **视频**：mp4, mov, avi, mkv, wmv, flv, webm

3. **文件大小限制**
   - **图片**：最大 10MB
   - **视频**：最大 500MB
   - **总大小**：最大 500MB

4. **文件数量限制**
   - **图片**：最多 10 张
   - **视频**：最多 5 个

**cURL 示例：**
```bash
# 上传图片和视频
curl -X POST http://localhost:3000/api/products/create-with-files \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "name=iPhone 15 Pro" \
  -F "description=最新款 iPhone" \
  -F "price=7999.00" \
  -F "originalPrice=8999.00" \
  -F "stock=100" \
  -F "category=electronics" \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg" \
  -F "videos=@/path/to/video1.mp4"
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 | 验证规则 |
|------|------|------|------|----------|
| name | string | 是 | 商品名称 | - |
| description | string | 否 | 商品描述 | - |
| price | number | 是 | 当前售价 | 必须为正数，精度为两位小数 |
| originalPrice | number | 否 | 原价 | 必须为正数，精度为两位小数，不能小于售价 |
| stock | number | 是 | 库存数量 | 必须为非负整数 |
| category | string | 否 | 商品分类 | - |
| status | string | 否 | 商品状态（active/inactive） | - |
| tags | array | 否 | 商品标签 | - |

### 参数验证

**价格验证：**
- 价格必须为正数
- 价格精度必须为两位小数
- 原价必须为正数
- 原价精度必须为两位小数
- 原价不能小于售价

**库存验证：**
- 库存必须为非负整数
- 库存不能为负数

### 自动处理

**自动计算折扣率：**
```javascript
discount = ((originalPrice - price) / originalPrice * 100).toFixed(2);
```

**自动记录价格历史：**
- 创建商品时自动记录初始价格
- 记录原因：创建商品

**自动设置默认状态：**
- 如果未提供状态，默认设置为 active

### 响应示例

```json
{
  "success": true,
  "message": "商品创建成功",
  "data": {
    "id": 1,
    "name": "iPhone 15 Pro",
    "description": "最新款 iPhone",
    "price": 7999.00,
    "originalPrice": 8999.00,
    "discount": 11.11,
    "stock": 100,
    "frozenStock": 0,
    "category": "electronics",
    "status": "active",
    "tags": ["手机", "苹果", "5G"],
    "created_at": "2026-03-28T10:00:00.000Z",
    "updated_at": "2026-03-28T10:00:00.000Z"
  }
}
```

### 错误响应

**价格验证失败：**
```json
{
  "success": false,
  "message": "价格必须为正数"
}
```

**价格精度错误：**
```json
{
  "success": false,
  "message": "价格精度必须为两位小数"
}
```

**原价错误：**
```json
{
  "success": false,
  "message": "原价不能小于售价"
}
```

## 更新商品

### API 请求

```
POST /api/products/update
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "id": 1,
  "name": "iPhone 15 Pro Max",
  "price": 8999.00,
  "stock": 150
}
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 | 验证规则 |
|------|------|------|------|----------|
| id | number | 是 | 商品 ID | - |
| name | string | 否 | 商品名称 | - |
| description | string | 否 | 商品描述 | - |
| price | number | 否 | 当前售价 | 必须为正数，精度为两位小数 |
| originalPrice | number | 否 | 原价 | 必须为正数，精度为两位小数，不能小于售价 |
| stock | number | 否 | 库存数量 | 必须为非负整数 |
| category | string | 否 | 商品分类 | - |
| status | string | 否 | 商品状态 | - |
| tags | array | 否 | 商品标签 | - |

### 参数验证

**价格验证：**
- 价格必须为正数
- 价格精度必须为两位小数
- 原价必须为正数
- 原价精度必须为两位小数
- 原价不能小于售价

**库存验证：**
- 库存必须为非负整数
- 库存不能为负数

**订单检查：**
- 如果更新价格或状态，检查是否有未完成订单
- 如果有未完成订单且设置为下架状态，拒绝更新

### 自动处理

**自动计算折扣率：**
```javascript
discount = ((originalPrice - price) / originalPrice * 100).toFixed(2);
```

**自动记录价格历史：**
- 价格发生变化时自动记录
- 记录原因：价格调整
- 记录价格变化率

**自动同步 Redis 缓存：**
- 更新库存时自动同步到 Redis
- 确保缓存和数据库一致

### 响应示例

```json
{
  "success": true,
  "message": "商品更新成功",
  "data": {
    "id": 1,
    "name": "iPhone 15 Pro Max",
    "price": 8999.00,
    "originalPrice": 9999.00,
    "discount": 10.00,
    "stock": 150,
    "updated_at": "2026-03-28T11:00:00.000Z"
  }
}
```

### 错误响应

**商品不存在：**
```json
{
  "success": false,
  "message": "商品不存在"
}
```

**价格验证失败：**
```json
{
  "success": false,
  "message": "价格必须为正数"
}
```

**有未完成订单：**
```json
{
  "success": false,
  "message": "商品有未完成的订单，不能设置为下架状态"
}
```

## 删除商品

### API 请求

```
DELETE /api/products/delete
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "id": 1
}
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 商品 ID |

### 响应示例

```json
{
  "success": true,
  "message": "商品删除成功"
}
```

### 安全限制

- 不能删除有未完成订单的商品
- 需要管理员权限

## 更新库存

### API 请求

```
PATCH /api/products/stock
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "id": 1,
  "stock": 200
}
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 商品 ID |
| stock | number | 是 | 新库存数量 |

### 响应示例

```json
{
  "success": true,
  "message": "库存更新成功",
  "data": {
    "id": 1,
    "name": "iPhone 15 Pro",
    "stock": 200,
    "updated_at": "2026-03-28T10:00:00.000Z"
  }
}
```

## 获取价格历史

### API 请求

```
GET /api/products/price-history?id=1&limit=10
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### 查询参数

| 参数 | 类型 | 必填 | 说明 | 默认值 |
|------|------|------|------|--------|
| id | number | 是 | 商品 ID | - |
| limit | number | 否 | 返回记录数量 | 10 |

### 响应示例

```json
{
  "success": true,
  "data": {
    "productId": 1,
    "productName": "iPhone 15 Pro",
    "currentPrice": 7999.00,
    "history": [
      {
        "id": 1,
        "productId": 1,
        "price": 8999.00,
        "reason": "创建商品",
        "createdAt": "2026-03-28T10:00:00.000Z"
      },
      {
        "id": 2,
        "productId": 1,
        "price": 7999.00,
        "reason": "价格调整",
        "createdAt": "2026-03-28T11:00:00.000Z"
      }
    ]
  }
}
```

## 获取价格稳定性

### API 请求

```
GET /api/products/price-stability?id=1&days=30
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### 查询参数

| 参数 | 类型 | 必填 | 说明 | 默认值 |
|------|------|------|------|--------|
| id | number | 是 | 商品 ID | - |
| days | number | 否 | 统计天数 | 30 |

### 响应示例

```json
{
  "success": true,
  "data": {
    "productId": 1,
    "productName": "iPhone 15 Pro",
    "currentPrice": 7999.00,
    "avgPrice": 8499.00,
    "minPrice": 7999.00,
    "maxPrice": 8999.00,
    "volatility": 11.11,
    "trend": "decreasing",
    "priceChanges": 2,
    "message": "最近 30 天内价格波动 11.11%"
  }
}
```

### 价格稳定性说明

**价格趋势：**
- `increasing` - 上涨（变化率 > 5%）
- `decreasing` - 下跌（变化率 < -5%）
- `stable` - 稳定（变化率在 ±5% 之间）

**波动率计算：**
```javascript
volatility = ((maxPrice - minPrice) / avgPrice * 100)
```

**应用场景：**
- 价格监控：监控商品价格波动
- 定价策略：根据价格稳定性调整定价
- 促销决策：根据价格趋势决定促销时机

## 价格处理

### 价格数据结构

```javascript
{
  price: 7999.00,        // 当前售价
  originalPrice: 8999.00, // 原价
  discount: 11.11        // 折扣率（百分比）
}
```

### 价格验证

**创建商品时的验证：**
- 价格必须为正数
- 价格精度必须为两位小数
- 原价必须为正数
- 原价精度必须为两位小数
- 原价不能小于售价

**更新商品时的验证：**
- 同上验证规则
- 检查是否有未完成订单（防止价格调整影响未完成订单）

### 自动计算折扣率

创建或更新商品时，系统会自动计算折扣率：

```javascript
discount = ((originalPrice - price) / originalPrice * 100).toFixed(2);
```

### 价格快照机制

创建订单时，会保存下单时的商品价格（快照），即使后续商品价格变化，订单价格保持不变。

**订单商品数据结构：**
```javascript
{
  productId: 1,
  productName: "iPhone 15 Pro",
  quantity: 2,
  price: 7999.00,        // 下单时的价格（快照）
  subtotal: 15998.00     // 小计
}
```

### 价格历史记录

系统会自动记录所有价格变更历史，包括：
- 创建商品时的初始价格
- 每次价格调整
- 调整原因

**价格历史表结构：**
```sql
CREATE TABLE product_price_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 价格稳定性分析

系统提供价格稳定性分析功能，包括：

**分析指标：**
- 价格波动率
- 价格趋势（上涨/下跌/稳定）
- 最高/最低/平均价格
- 价格变化次数

**波动率计算：**
```javascript
volatility = ((maxPrice - minPrice) / avgPrice * 100)
```

**趋势判断：**
- `increasing` - 上涨（变化率 > 5%）
- `decreasing` - 下跌（变化率 < -5%）
- `stable` - 稳定（变化率在 ±5% 之间）

### 价格相关接口

#### 获取价格历史

**请求：**
```
GET /api/products/price-history?id=1&limit=10
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**查询参数：**
| 参数 | 类型 | 必填 | 说明 | 默认值 |
|------|------|------|------|--------|
| id | number | 是 | 商品 ID | - |
| limit | number | 否 | 返回记录数量 | 10 |

**响应示例：**
```json
{
  "success": true,
  "data": {
    "productId": 1,
    "productName": "iPhone 15 Pro",
    "currentPrice": 7999.00,
    "history": [
      {
        "id": 1,
        "productId": 1,
        "price": 8999.00,
        "reason": "创建商品",
        "createdAt": "2026-03-28T10:00:00.000Z"
      },
      {
        "id": 2,
        "productId": 1,
        "price": 7999.00,
        "reason": "价格调整",
        "createdAt": "2026-03-28T11:00:00.000Z"
      }
    ]
  }
}
```

#### 获取价格稳定性

**请求：**
```
GET /api/products/price-stability?id=1&days=30
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**查询参数：**
| 参数 | 类型 | 必填 | 说明 | 默认值 |
|------|------|------|------|--------|
| id | number | 是 | 商品 ID | - |
| days | number | 否 | 统计天数 | 30 |

**响应示例：**
```json
{
  "success": true,
  "data": {
    "productId": 1,
    "productName": "iPhone 15 Pro",
    "currentPrice": 7999.00,
    "avgPrice": 8499.00,
    "minPrice": 7999.00,
    "maxPrice": 8999.00,
    "volatility": 11.11,
    "trend": "decreasing",
    "priceChanges": 2,
    "message": "最近 30 天内价格波动 11.11%"
  }
}
```

### 价格稳定性应用场景

1. **价格监控**：监控商品价格波动，及时发现异常
2. **定价策略**：根据价格稳定性调整定价策略
3. **促销决策**：根据价格趋势决定促销时机
4. **风险控制**：避免价格频繁调整对用户体验的影响

## 数据模型

### products 表结构

```sql
CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  discount DECIMAL(5, 2),
  stock INT DEFAULT 0,
  frozen_stock INT DEFAULT 0,
  version INT DEFAULT 0,
  category VARCHAR(100),
  status ENUM('active', 'inactive') DEFAULT 'active',
  tags JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Redis 缓存结构

```javascript
// Key: product:stock:{productId}
// Value: 库存数量
// TTL: 永不过期，手动更新

// Key: product:info:{productId}
// Value: 商品详细信息
// TTL: 1小时，过期后从数据库重新加载
```

---

*最后更新: 2026-03-28*