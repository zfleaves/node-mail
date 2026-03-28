# 06-数据库设计

## 📋 目录

- [数据库连接](#数据库连接)
- [数据库初始化](#数据库初始化)
- [事务管理](#事务管理)
- [库存管理机制](#库存管理机制)

## 数据库连接

### 连接池配置

**文件路径：** `src/database/mysql.js`

```javascript
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

### 连接测试

```javascript
async function testConnection() {
  const connection = await pool.getConnection();
  await connection.ping();
  connection.release();
  console.log('✅ MySQL 连接成功');
}
```

## 数据库初始化

### 表结构

**文件路径：** `src/database/schema.js`

```javascript
async function initDatabase() {
  await createUsersTable();
  await createProductsTable();
  await createOrdersTable();
  await createOrderItemsTable();
  await insertTestData();
}
```

### 用户表 (users)

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

### 商品表 (products)

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

### 订单表 (orders)

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

### 订单商品明细表 (order_items)

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

## 事务管理

### transaction 函数

**文件路径：** `src/database/mysql.js`

```javascript
async function transaction(callback) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
```

### 使用示例

```javascript
// 创建订单（使用事务）
const orderId = await db.transaction(async (connection) => {
  // 执行多个数据库操作
  await connection.execute('INSERT INTO orders ...');
  await connection.execute('INSERT INTO order_items ...');
  return orderId;
});
```

## 库存管理机制

### Redis 缓存结构

```javascript
// Key: product:stock:{productId}
// Value: 库存数量
// TTL: 永不过期，手动更新

// Key: product:frozen:{productId}
// Value: 冻结库存数量
// TTL: 永不过期，手动更新
```

### 库存扣减（创建订单）

```javascript
// 1. 从 Redis 获取库存
const stock = await getProductStock(productId);

// 2. 检查库存是否充足
if (stock < quantity) {
  throw new Error('库存不足');
}

// 3. 使用原子操作扣减库存
const remaining = await redis.decrBy(`product:stock:${productId}`, quantity);

// 4. 如果剩余库存 < 0，回滚
if (remaining < 0) {
  await redis.incrBy(`product:stock:${productId}`, quantity);
  throw new Error('库存不足');
}

// 5. 异步同步到数据库
updateDatabaseStock([{ productId, quantity }]);
```

### 库存恢复（取消订单）

```javascript
// 使用原子操作恢复库存
await redis.incrBy(`product:stock:${productId}`, quantity);

// 异步同步到数据库
updateDatabaseStock([{ productId, quantity }], true);
```

### 库存同步

**文件路径：** `src/utils/stockSync.js`

```javascript
// Redis -> 数据库
async function syncProductStock(productId) {
  const stock = await getProductStock(productId);
  await db.query(
    'UPDATE products SET stock = ? WHERE id = ?',
    [stock, productId]
  );
}

// 数据库 -> Redis
async function syncStockFromDB(productId) {
  const product = await db.findProductById(productId);
  await cacheProductStock(productId, product.stock);
}
```

---

*最后更新: 2026-03-28*