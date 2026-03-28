# 03-用户管理

## 📋 目录

- [概述](#概述)
- [用户列表](#用户列表)
- [用户详情](#用户详情)
- [创建用户](#创建用户)
- [更新用户](#更新用户)
- [删除用户](#删除用户)
- [数据模型](#数据模型)

## 概述

用户管理模块提供完整的用户 CRUD 操作，包括用户的创建、查询、更新和删除功能。

### 用户角色

系统支持三种角色：

| 角色 | 说明 | 权限 |
|------|------|------|
| `admin` | 超级管理员 | 所有权限 |
| `manager` | 管理员 | 商品和订单管理权限 |
| `staff` | 普通员工 | 只读权限 |

## 用户列表

### API 请求

```
GET /api/users?page=1&pageSize=10
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### 查询参数

| 参数 | 类型 | 必填 | 说明 | 默认值 |
|------|------|------|------|--------|
| page | number | 否 | 页码 | 1 |
| pageSize | number | 否 | 每页数量 | 10 |

### 响应示例

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "username": "admin",
        "email": "admin@example.com",
        "role": "admin",
        "name": "管理员",
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

## 用户详情

### API 请求

```
GET /api/users/info?id=1
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 用户 ID |

### 响应示例

```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "name": "管理员",
    "created_at": "2026-03-28T10:00:00.000Z",
    "updated_at": "2026-03-28T10:00:00.000Z"
  }
}
```

### 错误响应

```json
{
  "success": false,
  "message": "用户不存在"
}
```

## 创建用户

### API 请求

```
POST /api/users/create
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "username": "newuser",
  "password": "password123",
  "email": "user@example.com",
  "role": "staff",
  "name": "新用户"
}
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 | 验证规则 |
|------|------|------|------|----------|
| username | string | 是 | 用户名（唯一） | 3-50字符，仅字母数字下划线 |
| password | string | 是 | 密码（至少6位） | 至少6位 |
| email | string | 是 | 邮箱地址（唯一） | 标准邮箱格式 |
| role | string | 否 | 角色（admin/manager/staff） | 必须是有效角色 |
| name | string | 否 | 真实姓名 | - |

### 参数验证

**用户名验证：**
- 长度必须在 3-50 个字符之间
- 只能包含字母、数字和下划线
- 不能与已有用户名重复

**密码验证：**
- 长度不能少于 6 位
- 会自动使用 bcrypt 哈希加密存储

**邮箱验证：**
- 必须符合标准邮箱格式
- 不能与已有邮箱重复

**角色验证：**
- 必须是以下值之一：admin、manager、staff
- 默认角色为 staff

### 响应示例

```json
{
  "success": true,
  "message": "用户创建成功",
  "data": {
    "id": 4,
    "username": "newuser",
    "email": "user@example.com",
    "role": "staff",
    "name": "新用户",
    "created_at": "2026-03-28T10:00:00.000Z",
    "updated_at": "2026-03-28T10:00:00.000Z"
  }
}
```

### 错误响应

**用户名已存在：**
```json
{
  "success": false,
  "message": "用户名已存在"
}
```

**邮箱已存在：**
```json
{
  "success": false,
  "message": "邮箱已存在"
}
```

**参数验证失败：**
```json
{
  "success": false,
  "message": "用户名长度必须在 3-50 个字符之间"
}
```

## 更新用户

### API 请求

```
POST /api/users/update
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "id": 1,
  "email": "newemail@example.com",
  "name": "新姓名"
}
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 用户 ID |
| email | string | 否 | 邮箱地址（唯一） |
| role | string | 否 | 角色（admin/manager/staff） |
| name | string | 否 | 真实姓名 |
| password | string | 否 | 新密码（如需修改） |

### 响应示例

```json
{
  "success": true,
  "message": "用户更新成功",
  "data": {
    "id": 1,
    "username": "admin",
    "email": "newemail@example.com",
    "role": "admin",
    "name": "新姓名",
    "created_at": "2026-03-28T10:00:00.000Z",
    "updated_at": "2026-03-28T10:00:00.000Z"
  }
}
```

### 错误响应

```json
{
  "success": false,
  "message": "用户不存在"
}
```

## 删除用户

### API 请求

```
DELETE /api/users/delete
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "id": 1
}
```

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 用户 ID |

### 响应示例

```json
{
  "success": true,
  "message": "用户删除成功"
}
```

### 错误响应

```json
{
  "success": false,
  "message": "用户不存在"
}
```

### 安全限制

- 不能删除正在使用中的用户
- 不能删除自己
- 需要管理员权限

## 数据模型

### users 表结构

```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  role ENUM('admin', 'manager', 'staff') DEFAULT 'staff',
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 用户ID（主键） |
| username | VARCHAR(50) | 用户名（唯一） |
| password | VARCHAR(255) | 密码（bcrypt 哈希） |
| email | VARCHAR(100) | 邮箱地址（唯一） |
| role | ENUM | 角色（admin/manager/staff） |
| name | VARCHAR(100) | 真实姓名 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

---

*最后更新: 2026-03-28*