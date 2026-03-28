/**
 * MySQL 数据库访问层
 * 提供统一的数据库操作接口，替代模拟数据库层
 */

const db = require('./mysql');
const {
  getProductStock,
  decreaseStock,
  increaseStock,
  syncStockFromDB,
  cacheProductStock,
} = require('./redisStock');

// ========== 用户相关操作 ==========

/**
 * 根据用户名查找用户
 * @param {string} username - 用户名
 * @returns {Promise<Object|null>} - 用户信息
 */
async function findUserByUsername(username) {
  const sql = `
    SELECT id, username, password, email, role, name, created_at, updated_at
    FROM users
    WHERE username = ?
    LIMIT 1
  `;
  const rows = await db.query(sql, [username]);
  return rows.length > 0 ? formatUser(rows[0]) : null;
}

/**
 * 根据 ID 查找用户
 * @param {number} id - 用户 ID
 * @returns {Promise<Object|null>} - 用户信息
 */
async function findUserById(id) {
  const sql = `
    SELECT id, username, password, email, role, name, created_at, updated_at
    FROM users
    WHERE id = ?
    LIMIT 1
  `;
  const rows = await db.query(sql, [id]);
  return rows.length > 0 ? formatUser(rows[0]) : null;
}

/**
 * 根据邮箱查找用户
 * @param {string} email - 邮箱
 * @returns {Promise<Object|null>} - 用户信息
 */
async function findUserByEmail(email) {
  const sql = `
    SELECT id, username, password, email, role, name, created_at, updated_at
    FROM users
    WHERE email = ?
    LIMIT 1
  `;
  const rows = await db.query(sql, [email]);
  return rows.length > 0 ? formatUser(rows[0]) : null;
}

/**
 * 获取所有用户（支持分页）
 * @param {number} page - 页码
 * @param {number} pageSize - 每页数量
 * @returns {Promise<Object>} - 用户列表数据
 */
async function getAllUsers(page = 1, pageSize = 10) {
  const offset = (page - 1) * pageSize;

  // 查询总数
  const countSql = 'SELECT COUNT(*) as total FROM users';
  const [{ total }] = await db.query(countSql);

  // 查询数据（mysql2 不支持在 LIMIT/OFFSET 中使用占位符）
  const sql = `
    SELECT id, username, email, role, name, created_at, updated_at
    FROM users
    ORDER BY id DESC
    LIMIT ${parseInt(pageSize)} OFFSET ${parseInt(offset)}
  `;
  const rows = await db.query(sql);

  return {
    data: rows.map(formatUser),
    total,
    page,
    pageSize,
  };
}

/**
 * 创建用户
 * @param {Object} userData - 用户数据
 * @returns {Promise<Object>} - 新创建的用户
 */
async function createUser(userData) {
  const sql = `
    INSERT INTO users (username, password, email, role, name)
    VALUES (?, ?, ?, ?, ?)
  `;
  const result = await db.insert(sql, [
    userData.username,
    userData.password,
    userData.email,
    userData.role,
    userData.name,
  ]);

  return findUserById(result.insertId);
}

/**
 * 更新用户
 * @param {number} id - 用户 ID
 * @param {Object} userData - 更新的用户数据
 * @returns {Promise<Object|null>} - 更新后的用户信息
 */
async function updateUser(id, userData) {
  const fields = [];
  const values = [];

  // 动态构建更新字段
  if (userData.password) {
    fields.push('password = ?');
    values.push(userData.password);
  }
  if (userData.email) {
    fields.push('email = ?');
    values.push(userData.email);
  }
  if (userData.role) {
    fields.push('role = ?');
    values.push(userData.role);
  }
  if (userData.name) {
    fields.push('name = ?');
    values.push(userData.name);
  }

  if (fields.length === 0) {
    return findUserById(id);
  }

  values.push(id);

  const sql = `
    UPDATE users
    SET ${fields.join(', ')}
    WHERE id = ?
  `;
  await db.update(sql, values);

  return findUserById(id);
}

/**
 * 删除用户
 * @param {number} id - 用户 ID
 * @returns {Promise<boolean>} - 是否删除成功
 */
async function deleteUser(id) {
  const sql = 'DELETE FROM users WHERE id = ?';
  const result = await db.remove(sql, [id]);
  return result.affectedRows > 0;
}

// 格式化用户数据（数据库字段转驼峰命名）
function formatUser(row) {
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    email: row.email,
    role: row.role,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ========== 商品相关操作 ==========

/**
 * 获取所有商品（支持分页和筛选）
 * @param {number} page - 页码
 * @param {number} pageSize - 每页数量
 * @param {Object} filters - 筛选条件
 * @returns {Promise<Object>} - 商品列表数据
 */
async function getAllProducts(page = 1, pageSize = 10, filters = {}) {
  const offset = (page - 1) * pageSize;
  const conditions = [];
  const params = [];

  // 构建筛选条件
  if (filters.category) {
    conditions.push('category = ?');
    params.push(filters.category);
  }
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.keyword) {
    conditions.push('(name LIKE ? OR description LIKE ?)');
    const keyword = `%${filters.keyword}%`;
    params.push(keyword, keyword);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 查询总数
  const countSql = `SELECT COUNT(*) as total FROM products ${whereClause}`;
  const [{ total }] = await db.query(countSql, params);

  // 查询数据（mysql2 不支持在 LIMIT/OFFSET 中使用占位符）
  const sql = `
    SELECT id, name, price, stock, frozen_stock, version, category, description, status, created_at, updated_at
    FROM products
    ${whereClause}
    ORDER BY id DESC
    LIMIT ${parseInt(pageSize)} OFFSET ${parseInt(offset)}
  `;
  const rows = await db.query(sql, params);

  return {
    data: rows.map(formatProduct),
    total,
    page,
    pageSize,
  };
}

/**
 * 根据 ID 查找商品
 * @param {number} id - 商品 ID
 * @returns {Promise<Object|null>} - 商品信息
 */
async function findProductById(id) {
  const sql = `
    SELECT id, name, price, original_price, discount, stock, frozen_stock, version, 
           category, description, status, images, videos, main_image, created_at, updated_at
    FROM products
    WHERE id = ?
    LIMIT 1
  `;
  const rows = await db.query(sql, [id]);
  return rows.length > 0 ? formatProduct(rows[0]) : null;
}

/**
 * 创建商品
 * @param {Object} productData - 商品数据
 * @returns {Promise<Object>} - 新创建的商品
 */
async function createProduct(productData) {
  const sql = `
    INSERT INTO products (
      name, price, original_price, discount, stock, frozen_stock, version,
      category, description, status, images, videos, main_image
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const result = await db.insert(sql, [
    productData.name,
    productData.price,
    productData.originalPrice || null,
    productData.discount || 0,
    productData.stock,
    productData.frozenStock || 0,
    productData.version || 0,
    productData.category,
    productData.description || null,
    productData.status || 'active',
    productData.images ? JSON.stringify(productData.images) : JSON.stringify([]),
    productData.videos ? JSON.stringify(productData.videos) : JSON.stringify([]),
    productData.mainImage || null
  ]);

  return findProductById(result.insertId);
}

/**
 * 更新商品
 * @param {number} id - 商品 ID
 * @param {Object} productData - 更新的商品数据
 * @returns {Promise<Object|null>} - 更新后的商品信息
 */
async function updateProduct(id, productData) {
  const fields = [];
  const values = [];

  if (productData.name !== undefined) {
    fields.push('name = ?');
    values.push(productData.name);
  }
  if (productData.price !== undefined) {
    fields.push('price = ?');
    values.push(productData.price);
  }
  if (productData.stock !== undefined) {
    fields.push('stock = ?');
    values.push(productData.stock);
  }
  if (productData.category !== undefined) {
    fields.push('category = ?');
    values.push(productData.category);
  }
  if (productData.description !== undefined) {
    fields.push('description = ?');
    values.push(productData.description);
  }
  if (productData.status !== undefined) {
    fields.push('status = ?');
    values.push(productData.status);
  }

  if (fields.length === 0) {
    return findProductById(id);
  }

  values.push(id);

  const sql = `
    UPDATE products
    SET ${fields.join(', ')}
    WHERE id = ?
  `;
  await db.update(sql, values);

  return findProductById(id);
}

/**
 * 删除商品
 * @param {number} id - 商品 ID
 * @returns {Promise<boolean>} - 是否删除成功
 */
async function deleteProduct(id) {
  const sql = 'DELETE FROM products WHERE id = ?';
  const result = await db.remove(sql, [id]);
  return result.affectedRows > 0;
}

/**
 * 记录价格历史
 * @param {number} productId - 商品 ID
 * @param {number} price - 价格
 * @param {string} reason - 变更原因
 * @returns {Promise<void>}
 */
async function recordPriceHistory(productId, price, reason = '价格变更') {
  try {
    // 检查价格历史表是否存在，如果不存在则创建
    await db.query(`
      CREATE TABLE IF NOT EXISTS product_price_history (
        id INT PRIMARY KEY AUTO_INCREMENT,
        product_id INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        reason VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_product_id (product_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // 插入价格历史记录
    await db.insert(
      'INSERT INTO product_price_history (product_id, price, reason) VALUES (?, ?, ?)',
      [productId, price, reason]
    );

    console.log(`[价格历史] 商品 ${productId} 价格 ${price} 已记录，原因：${reason}`);
  } catch (error) {
    console.error('[价格历史] 记录失败:', error.message);
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 获取价格历史
 * @param {number} productId - 商品 ID
 * @param {number} limit - 返回记录数量
 * @returns {Promise<Array>} - 价格历史记录
 */
async function getPriceHistory(productId, limit = 10) {
  try {
    // 检查价格历史表是否存在
    const [tables] = await db.query("SHOW TABLES LIKE 'product_price_history'");
    if (tables.length === 0) {
      return [];
    }

    const sql = `
      SELECT id, product_id, price, reason, created_at
      FROM product_price_history
      WHERE product_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
    const rows = await db.query(sql, [productId, limit]);
    return rows;
  } catch (error) {
    console.error('[价格历史] 查询失败:', error.message);
    return [];
  }
}

/**
 * 检查商品是否有未完成的订单
 * @param {number} productId - 商品 ID
 * @returns {Promise<boolean>} - 是否有未完成订单
 */
async function checkPendingOrders(productId) {
  try {
    const sql = `
      SELECT COUNT(*) as count
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = ?
      AND o.status IN ('temp', 'pending', 'paid')
    `;
    const [result] = await db.query(sql, [productId]);
    return result.count > 0;
  } catch (error) {
    console.error('[订单检查] 查询失败:', error.message);
    return false;
  }
}

/**
 * 计算价格稳定性指数
 * @param {number} productId - 商品 ID
 * @param {number} days - 统计天数（默认30天）
 * @returns {Promise<Object>} - 价格稳定性信息
 */
async function getPriceStability(productId, days = 30) {
  try {
    // 检查价格历史表是否存在
    const [tables] = await db.query("SHOW TABLES LIKE 'product_price_history'");
    if (tables.length === 0) {
      return {
        productId,
        stability: 'unknown',
        message: '暂无价格历史数据'
      };
    }

    // 获取指定天数内的价格历史
    const sql = `
      SELECT price, created_at
      FROM product_price_history
      WHERE product_id = ?
      AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY created_at ASC
    `;
    const rows = await db.query(sql, [productId, days]);

    if (rows.length < 2) {
      return {
        productId,
        stability: 'unknown',
        message: '价格历史数据不足'
      };
    }

    // 计算价格波动
    const prices = rows.map(row => parseFloat(row.price));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const currentPrice = prices[prices.length - 1];
    
    // 计算价格波动率
    const volatility = ((maxPrice - minPrice) / avgPrice * 100).toFixed(2);
    
    // 计算价格趋势（最近5次变化）
    let trend = 'stable';
    if (prices.length >= 5) {
      const recentPrices = prices.slice(-5);
      const firstRecent = recentPrices[0];
      const lastRecent = recentPrices[recentPrices.length - 1];
      const changeRate = ((lastRecent - firstRecent) / firstRecent * 100).toFixed(2);
      
      if (changeRate > 5) {
        trend = 'increasing';
      } else if (changeRate < -5) {
        trend = 'decreasing';
      }
    }

    return {
      productId,
      currentPrice,
      avgPrice,
      minPrice,
      maxPrice,
      volatility: parseFloat(volatility),
      trend,
      priceChanges: rows.length,
      message: `最近 ${days} 天内价格波动 ${volatility}%`
    };
  } catch (error) {
    console.error('[价格稳定性] 计算失败:', error.message);
    return {
      productId,
      stability: 'error',
      message: '计算失败'
    };
  }
}

// 格式化商品数据
function formatProduct(row) {
  return {
    id: row.id,
    name: row.name,
    price: parseFloat(row.price),
    originalPrice: row.original_price ? parseFloat(row.original_price) : null,
    discount: row.discount ? parseFloat(row.discount) : 0,
    stock: row.stock,
    frozenStock: row.frozen_stock,
    version: row.version,
    category: row.category,
    description: row.description,
    status: row.status,
    images: row.images ? JSON.parse(row.images) : [],
    videos: row.videos ? JSON.parse(row.videos) : [],
    mainImage: row.main_image,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ========== 订单相关操作 ==========

/**
 * 获取所有订单（支持分页和筛选）
 * @param {number} page - 页码
 * @param {number} pageSize - 每页数量
 * @param {Object} filters - 筛选条件
 * @returns {Promise<Object>} - 订单列表数据
 */
async function getAllOrders(page = 1, pageSize = 10, filters = {}) {
  const offset = (page - 1) * pageSize;
  const conditions = [];
  const params = [];

  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.orderNo) {
    conditions.push('order_no LIKE ?');
    params.push(`%${filters.orderNo}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 查询总数
  const countSql = `SELECT COUNT(*) as total FROM orders ${whereClause}`;
  const [{ total }] = await db.query(countSql, params);

  // 查询订单数据（mysql2 不支持在 LIMIT/OFFSET 中使用占位符）
  const sql = `
    SELECT id, order_no, user_id, user_name, total_amount, status, expire_time, cancelled_reason, created_at, updated_at
    FROM orders
    ${whereClause}
    ORDER BY id DESC
    LIMIT ${parseInt(pageSize)} OFFSET ${parseInt(offset)}
  `;
  const rows = await db.query(sql, params);

  // 查询每个订单的商品明细
  const orders = await Promise.all(
    rows.map(async (row) => {
      const itemsSql = `
        SELECT id, product_id, product_name, quantity, price
        FROM order_items
        WHERE order_id = ?
      `;
      const items = await db.query(itemsSql, [row.id]);

      return {
        ...formatOrder(row),
        items: items.map(item => ({
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          price: parseFloat(item.price),
        })),
      };
    })
  );

  return {
    data: orders,
    total,
    page,
    pageSize,
  };
}

/**
 * 根据 ID 查找订单
 * @param {number} id - 订单 ID
 * @returns {Promise<Object|null>} - 订单信息
 */
async function findOrderById(id) {
  const sql = `
    SELECT id, order_no, user_id, user_name, total_amount, status, expire_time, cancelled_reason, created_at, updated_at
    FROM orders
    WHERE id = ?
    LIMIT 1
  `;
  const rows = await db.query(sql, [id]);
  
  if (rows.length === 0) return null;

  const row = rows[0];

  // 查询订单商品明细
  const itemsSql = `
    SELECT id, product_id, product_name, quantity, price
    FROM order_items
    WHERE order_id = ?
  `;
  const items = await db.query(itemsSql, [row.id]);

  return {
    ...formatOrder(row),
    items: items.map(item => ({
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      price: parseFloat(item.price),
    })),
  };
}

/**
 * 根据订单号查找订单
 * @param {string} orderNo - 订单号
 * @returns {Promise<Object|null>} - 订单信息
 */
async function findOrderByOrderNo(orderNo) {
  const sql = `
    SELECT id, order_no, user_id, user_name, total_amount, status, expire_time, cancelled_reason, created_at, updated_at
    FROM orders
    WHERE order_no = ?
    LIMIT 1
  `;
  const rows = await db.query(sql, [orderNo]);
  
  if (rows.length === 0) return null;

  const row = rows[0];

  // 查询订单商品明细
  const itemsSql = `
    SELECT id, product_id, product_name, quantity, price
    FROM order_items
    WHERE order_id = ?
  `;
  const items = await db.query(itemsSql, [row.id]);

  return {
    ...formatOrder(row),
    items: items.map(item => ({
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      price: parseFloat(item.price),
    })),
  };
}

/**
 * 创建订单（使用 Redis 原子操作扣减库存，高并发优化）
 * @param {Object} orderData - 订单数据
 * @returns {Promise<Object>} - 新创建的订单
 */
async function createOrder(orderData) {
  const { items, ...orderInfo } = orderData;

  // 存储扣减库存的商品，用于失败时回滚
  const deductedItems = [];

  try {
    // 第一步：使用 Redis 原子操作扣减库存
    for (const item of items) {
      // 从 Redis 获取库存
      let stock = await getProductStock(item.productId);

      // 如果 Redis 中没有库存，从数据库读取并缓存
      if (stock === null) {
        const [product] = await db.query(
          'SELECT id, stock FROM products WHERE id = ?',
          [item.productId]
        );

        if (!product) {
          throw new Error(`商品 ID ${item.productId} 不存在`);
        }

        stock = product.stock;
        // 缓存到 Redis（1小时过期）
        await cacheProductStock(item.productId, stock, 3600);
      }

      // 检查库存是否充足
      if (stock < item.quantity) {
        throw new Error(`商品 ${item.productName} 库存不足`);
      }

      // 使用 Redis 原子操作扣减库存
      const result = await decreaseStock(item.productId, item.quantity);

      if (!result.success) {
        throw new Error(`商品 ${item.productName} 库存不足`);
      }

      // 记录扣减的商品
      deductedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        productName: item.productName,
      });

      console.log(`[创建订单] 商品 ${item.productName} 库存扣减成功，剩余: ${result.remaining}`);
    }

    // 第二步：创建订单（数据库事务）
    const orderId = await db.transaction(async (connection) => {
      // 计算订单过期时间（30分钟后）
      const expireTime = new Date(Date.now() + 30 * 60 * 1000);

      // 插入订单（状态为 temp 临时订单）
      const orderSql = `
        INSERT INTO orders (order_no, user_id, user_name, total_amount, status, expire_time)
        VALUES (?, ?, ?, ?, 'temp', ?)
      `;
      const [orderResult] = await connection.execute(orderSql, [
        orderInfo.order_no,
        orderInfo.user_id,
        orderInfo.user_name,
        orderInfo.total_amount,
        expireTime,
      ]);

      // 插入订单商品明细
      for (const item of items) {
        const itemSql = `
          INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
          VALUES (?, ?, ?, ?, ?)
        `;
        await connection.execute(itemSql, [
          orderResult.insertId,
          item.productId,
          item.productName,
          item.quantity,
          item.price,
        ]);
      }

      // 异步更新数据库库存（不阻塞订单创建）
      updateDatabaseStock(deductedItems).catch((error) => {
        console.error('[创建订单] 异步更新数据库库存失败:', error);
      });

      return orderResult.insertId;
    });

    // 返回订单详细信息
    return await findOrderById(orderId);
  } catch (error) {
    // 扣减失败，回滚之前扣减的库存
    if (deductedItems.length > 0) {
      console.log(`[创建订单] 订单创建失败，回滚库存`);
      for (const item of deductedItems) {
        try {
          await increaseStock(item.productId, item.quantity);
          console.log(`[创建订单] 已回滚商品 ${item.productName} 库存 ${item.quantity}`);
        } catch (rollbackError) {
          console.error(`[创建订单] 回滚商品 ${item.productName} 库存失败:`, rollbackError.message);
        }
      }
    }

    throw error;
  }
}

/**
 * 异步更新数据库库存
 * @param {Array<{productId: number, quantity: number}>} items - 商品列表
 */
async function updateDatabaseStock(items) {
  try {
    for (const item of items) {
      await db.query(
        `UPDATE products
         SET stock = stock - ?, frozen_stock = frozen_stock + ?
         WHERE id = ? AND stock >= ?`,
        [item.quantity, item.quantity, item.productId, item.quantity]
      );
      console.log(`[创建订单] 已更新数据库库存: 商品 ${item.productId} 扣减 ${item.quantity}`);
    }
  } catch (error) {
    console.error('[创建订单] 更新数据库库存失败:', error);
    // 这里可以记录到日志或发送告警
    // 不抛出错误，避免影响订单创建
  }
}

/**
 * 更新订单状态
 * @param {number} id - 订单 ID
 * @param {string} status - 新状态
 * @returns {Promise<Object|null>} - 更新后的订单信息
 */
async function updateOrderStatus(id, status) {
  const sql = `
    UPDATE orders
    SET status = ?
    WHERE id = ?
  `;
  await db.update(sql, [status, id]);

  return findOrderById(id);
}

/**
 * 取消订单（恢复库存，使用 Redis 原子操作）
 * @param {number} id - 订单 ID
 * @param {string} reason - 取消原因
 * @returns {Promise<Object|null>} - 更新后的订单信息
 */
async function cancelOrder(id, reason = 'user_cancelled') {
  // 使用 transaction 函数简化事务管理
  return await db.transaction(async (connection) => {
    // 查询订单信息
    const [orderRows] = await connection.execute(
      'SELECT id, status FROM orders WHERE id = ? FOR UPDATE',
      [id]
    );

    if (!orderRows || orderRows.length === 0) {
      throw new Error('订单不存在');
    }

    const order = orderRows[0];

    // 只能取消 temp 或 pending 状态的订单
    if (order.status !== 'temp' && order.status !== 'pending') {
      throw new Error('订单状态不允许取消');
    }

    // 查询订单商品明细
    const [items] = await connection.execute(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
      [id]
    );

    // 使用 Redis 原子操作恢复库存
    for (const item of items) {
      const stock = await increaseStock(item.product_id, item.quantity);
      console.log(`[取消订单] 商品 ${item.product_id} 恢复库存 ${item.quantity}，当前: ${stock}`);
    }

    // 更新订单状态
    await connection.execute(
      `UPDATE orders
       SET status = 'cancelled', cancelled_reason = ?
       WHERE id = ?`,
      [reason, id]
    );

    // 异步更新数据库库存（不阻塞订单取消）
    updateDatabaseStockForCancel(items).catch((error) => {
      console.error('[取消订单] 异步更新数据库库存失败:', error);
    });

    // 返回订单 ID，在事务外查询详细信息
    return id;
  }).then((orderId) => findOrderById(orderId));
}

/**
 * 异步更新数据库库存（用于订单取消）
 * @param {Array<{product_id: number, quantity: number}>} items - 商品列表
 */
async function updateDatabaseStockForCancel(items) {
  try {
    for (const item of items) {
      await db.query(
        `UPDATE products
         SET stock = stock + ?, frozen_stock = frozen_stock - ?
         WHERE id = ?`,
        [item.quantity, item.quantity, item.product_id]
      );
      console.log(`[取消订单] 已更新数据库库存: 商品 ${item.product_id} 恢复 ${item.quantity}`);
    }
  } catch (error) {
    console.error('[取消订单] 更新数据库库存失败:', error);
    // 这里可以记录到日志或发送告警
    // 不抛出错误，避免影响订单取消
  }
}

/**
 * 将临时订单转为已支付订单
 * @param {number} id - 订单 ID
 * @returns {Promise<Object|null>} - 更新后的订单信息
 */
async function updateOrderToPaid(id) {
  // 使用 transaction 函数简化事务管理
  return await db.transaction(async (connection) => {
    // 查询订单信息
    const [orderRows] = await connection.execute(
      'SELECT id, status FROM orders WHERE id = ? FOR UPDATE',
      [id]
    );

    if (!orderRows || orderRows.length === 0) {
      throw new Error('订单不存在');
    }

    const order = orderRows[0];

    // 只能将 temp 状态的订单转为 paid
    if (order.status !== 'temp') {
      throw new Error('订单状态不允许此操作');
    }

    // 释放冻结库存（从 frozen_stock 转为已消耗）
    const [items] = await connection.execute(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
      [id]
    );

    for (const item of items) {
      await connection.execute(
        `UPDATE products
         SET frozen_stock = frozen_stock - ?
         WHERE id = ?`,
        [item.quantity, item.product_id]
      );
    }

    // 更新订单状态
    await connection.execute(
      `UPDATE orders
       SET status = 'paid', expire_time = NULL
       WHERE id = ?`,
      [id]
    );

    // 返回订单 ID，在事务外查询详细信息
    return id;
  }).then((orderId) => findOrderById(orderId));
}

/**
 * 检查并处理过期订单
 * @returns {Promise<number>} - 处理的过期订单数量
 */
async function checkExpiredOrders() {
  // 使用 transaction 函数简化事务管理
  return await db.transaction(async (connection) => {
    // 查询过期的临时订单
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

    return processedCount;
  });
}

/**
 * 删除订单
 * @param {number} id - 订单 ID
 * @returns {Promise<boolean>} - 是否删除成功
 */
async function deleteOrder(id) {
  const sql = 'DELETE FROM orders WHERE id = ?';
  const result = await db.remove(sql, [id]);
  return result.affectedRows > 0;
}

// 格式化订单数据
function formatOrder(row) {
  return {
    id: row.id,
    orderNo: row.order_no,
    userId: row.user_id,
    userName: row.user_name,
    totalAmount: parseFloat(row.total_amount),
    status: row.status,
    expireTime: row.expire_time,
    cancelledReason: row.cancelled_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  // 用户相关
  findUserByUsername,
  findUserById,
  findUserByEmail,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,

  // 商品相关
  getAllProducts,
  findProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  recordPriceHistory,
  getPriceHistory,
  checkPendingOrders,
  getPriceStability,

  // 订单相关
  getAllOrders,
  findOrderById,
  findOrderByOrderNo,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  updateOrderToPaid,
  checkExpiredOrders,
  deleteOrder,
};