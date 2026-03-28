/**
 * Redis 库存管理模块
 * 使用 Redis 缓存商品库存，实现高并发场景下的原子操作
 */

const { getRedisClient } = require('./redis');

/**
 * 缓存商品库存到 Redis
 * @param {number} productId - 商品 ID
 * @param {number} stock - 库存数量
 * @param {number} ttl - 过期时间（秒），默认 1 小时
 */
async function cacheProductStock(productId, stock, ttl = 3600) {
  try {
    const client = await getRedisClient();
    const key = `product:stock:${productId}`;

    // 如果缓存已存在，不覆盖（避免覆盖最新的库存数据）
    const exists = await client.exists(key);
    if (exists) {
      console.log(`[Redis库存] 商品 ${productId} 库存已缓存，跳过`);
      return false;
    }

    await client.set(key, stock, { EX: ttl });
    console.log(`[Redis库存] 商品 ${productId} 库存已缓存: ${stock}`);
    return true;
  } catch (error) {
    console.error(`[Redis库存] 缓存商品 ${productId} 库存失败:`, error.message);
    throw error;
  }
}

/**
 * 获取商品库存（优先从 Redis 缓存读取）
 * @param {number} productId - 商品 ID
 * @returns {Promise<number>} - 库存数量
 */
async function getProductStock(productId) {
  try {
    const client = await getRedisClient();
    const key = `product:stock:${productId}`;

    // 优先从 Redis 读取
    const stock = await client.get(key);
    if (stock !== null) {
      console.log(`[Redis库存] 商品 ${productId} 库存（缓存）: ${stock}`);
      return parseInt(stock, 10);
    }

    // Redis 中没有，返回 null 表示需要从数据库读取
    console.log(`[Redis库存] 商品 ${productId} 库存未缓存`);
    return null;
  } catch (error) {
    console.error(`[Redis库存] 获取商品 ${productId} 库存失败:`, error.message);
    // 开发环境下，Redis 失败时返回 null，降级到数据库
    if (process.env.NODE_ENV === 'development') {
      return null;
    }
    throw error;
  }
}

/**
 * 使用原子操作扣减库存
 * @param {number} productId - 商品 ID
 * @param {number} quantity - 扣减数量
 * @returns {Promise<{success: boolean, remaining: number|null}>} - 操作结果
 */
async function decreaseStock(productId, quantity) {
  try {
    const client = await getRedisClient();
    const key = `product:stock:${productId}`;

    // 使用原子操作扣减库存
    const remaining = await client.decrBy(key, quantity);

    console.log(`[Redis库存] 商品 ${productId} 扣减库存 ${quantity}，剩余: ${remaining}`);

    if (remaining < 0) {
      // 库存不足，回滚
      await client.incrBy(key, quantity);
      console.log(`[Redis库存] 商品 ${productId} 库存不足，已回滚`);
      return { success: false, remaining: null };
    }

    return { success: true, remaining };
  } catch (error) {
    console.error(`[Redis库存] 扣减商品 ${productId} 库存失败:`, error.message);
    // 开发环境下，Redis 失败时返回成功（降级处理）
    if (process.env.NODE_ENV === 'development') {
      return { success: true, remaining: null };
    }
    throw error;
  }
}

/**
 * 恢复库存（订单取消或过期时使用）
 * @param {number} productId - 商品 ID
 * @param {number} quantity - 恢复数量
 */
async function increaseStock(productId, quantity) {
  try {
    const client = await getRedisClient();
    const key = `product:stock:${productId}`;

    // 使用原子操作恢复库存
    const stock = await client.incrBy(key, quantity);
    console.log(`[Redis库存] 商品 ${productId} 恢复库存 ${quantity}，当前: ${stock}`);
    return stock;
  } catch (error) {
    console.error(`[Redis库存] 恢复商品 ${productId} 库存失败:`, error.message);
    // 开发环境下，Redis 失败时不抛出错误
    if (process.env.NODE_ENV === 'development') {
      return null;
    }
    throw error;
  }
}

/**
 * 批量缓存商品库存（预热缓存）
 * @param {Array<{productId: number, stock: number}>} products - 商品列表
 */
async function batchCacheStock(products) {
  try {
    const client = await getRedisClient();
    const pipeline = client.multi();

    let count = 0;
    for (const product of products) {
      const key = `product:stock:${product.productId}`;
      // 只缓存不存在的
      pipeline.exists(key);
      count++;
    }

    const results = await pipeline.exec();
    const existsArray = results.map((r) => r[1]);

    const cachePipeline = client.multi();
    let cachedCount = 0;

    for (let i = 0; i < products.length; i++) {
      if (!existsArray[i]) {
        const key = `product:stock:${products[i].productId}`;
        cachePipeline.set(key, products[i].stock, { EX: 3600 });
        cachedCount++;
      }
    }

    if (cachedCount > 0) {
      await cachePipeline.exec();
      console.log(`[Redis库存] 批量缓存 ${cachedCount} 个商品库存`);
    }

    return cachedCount;
  } catch (error) {
    console.error('[Redis库存] 批量缓存库存失败:', error.message);
    throw error;
  }
}

/**
 * 清除商品库存缓存
 * @param {number} productId - 商品 ID
 */
async function clearProductStockCache(productId) {
  try {
    const client = await getRedisClient();
    const key = `product:stock:${productId}`;
    await client.del(key);
    console.log(`[Redis库存] 已清除商品 ${productId} 库存缓存`);
    return true;
  } catch (error) {
    console.error(`[Redis库存] 清除商品 ${productId} 库存缓存失败:`, error.message);
    throw error;
  }
}

/**
 * 批量清除库存缓存（用于数据同步后）
 * @param {Array<number>} productIds - 商品 ID 列表
 */
async function batchClearStockCache(productIds) {
  try {
    const client = await getRedisClient();
    const keys = productIds.map((id) => `product:stock:${id}`);

    if (keys.length === 0) {
      return 0;
    }

    const count = await client.del(...keys);
    console.log(`[Redis库存] 已清除 ${count} 个商品库存缓存`);
    return count;
  } catch (error) {
    console.error('[Redis库存] 批量清除库存缓存失败:', error.message);
    throw error;
  }
}

/**
 * 同步数据库库存到 Redis（用于数据一致性）
 * @param {number} productId - 商品 ID
 * @param {number} dbStock - 数据库中的库存
 */
async function syncStockFromDB(productId, dbStock) {
  try {
    const client = await getRedisClient();
    const key = `product:stock:${productId}`;

    // 强制更新 Redis 中的库存
    await client.set(key, dbStock, { EX: 3600 });
    console.log(`[Redis库存] 已同步商品 ${productId} 库存: ${dbStock}`);
    return true;
  } catch (error) {
    console.error(`[Redis库存] 同步商品 ${productId} 库存失败:`, error.message);
    throw error;
  }
}

module.exports = {
  cacheProductStock,
  getProductStock,
  decreaseStock,
  increaseStock,
  batchCacheStock,
  clearProductStockCache,
  batchClearStockCache,
  syncStockFromDB,
};