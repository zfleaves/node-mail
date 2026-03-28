/**
 * 库存同步工具
 * 用于同步 Redis 中的库存到数据库，确保数据一致性
 */

const { getRedisClient } = require('../database/redis');
const db = require('../database/mysql');

/**
 * 同步单个商品库存（Redis -> 数据库）
 * @param {number} productId - 商品 ID
 * @returns {Promise<boolean>} - 是否同步成功
 */
async function syncProductStock(productId) {
  try {
    const client = await getRedisClient();
    const key = `product:stock:${productId}`;

    // 获取 Redis 中的库存
    const redisStock = await client.get(key);

    if (redisStock === null) {
      console.log(`[库存同步] 商品 ${productId} 在 Redis 中没有库存数据`);
      return false;
    }

    // 获取数据库中的库存
    const [product] = await db.query(
      'SELECT id, stock FROM products WHERE id = ?',
      [productId]
    );

    if (!product) {
      console.log(`[库存同步] 商品 ${productId} 在数据库中不存在`);
      return false;
    }

    const dbStock = product.stock;

    // 比较库存
    if (parseInt(redisStock, 10) === dbStock) {
      console.log(`[库存同步] 商品 ${productId} 库存一致: ${dbStock}`);
      return true;
    }

    // 库存不一致，以 Redis 为准更新数据库
    console.log(`[库存同步] 商品 ${productId} 库存不一致，Redis: ${redisStock}, DB: ${dbStock}，开始同步...`);

    await db.query(
      'UPDATE products SET stock = ? WHERE id = ?',
      [parseInt(redisStock, 10), productId]
    );

    console.log(`[库存同步] 商品 ${productId} 库存已同步: ${redisStock}`);
    return true;
  } catch (error) {
    console.error(`[库存同步] 同步商品 ${productId} 库存失败:`, error.message);
    return false;
  }
}

/**
 * 同步所有商品库存（Redis -> 数据库）
 * @returns {Promise<{success: number, failed: number}>} - 同步结果
 */
async function syncAllStock() {
  try {
    const client = await getRedisClient();

    // 获取所有商品库存的键
    const keys = await client.keys('product:stock:*');

    if (keys.length === 0) {
      console.log('[库存同步] 没有需要同步的商品库存');
      return { success: 0, failed: 0 };
    }

    console.log(`[库存同步] 开始同步 ${keys.length} 个商品库存...`);

    let success = 0;
    let failed = 0;

    for (const key of keys) {
      // 提取商品 ID
      const productId = parseInt(key.replace('product:stock:', ''), 10);

      const result = await syncProductStock(productId);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    console.log(`[库存同步] 同步完成，成功: ${success}，失败: ${failed}`);
    return { success, failed };
  } catch (error) {
    console.error('[库存同步] 同步所有商品库存失败:', error.message);
    return { success: 0, failed: 0 };
  }
}

/**
 * 从数据库同步到 Redis（用于数据修复）
 * @param {number} productId - 商品 ID
 * @returns {Promise<boolean>} - 是否同步成功
 */
async function syncStockFromDB(productId) {
  try {
    const client = await getRedisClient();

    // 获取数据库中的库存
    const [product] = await db.query(
      'SELECT id, stock FROM products WHERE id = ?',
      [productId]
    );

    if (!product) {
      console.log(`[库存同步] 商品 ${productId} 在数据库中不存在`);
      return false;
    }

    const key = `product:stock:${productId}`;

    // 更新 Redis 中的库存
    await client.set(key, product.stock, { EX: 3600 });
    console.log(`[库存同步] 商品 ${productId} 库存已从数据库同步到 Redis: ${product.stock}`);
    return true;
  } catch (error) {
    console.error(`[库存同步] 同步商品 ${productId} 库存（DB -> Redis）失败:`, error.message);
    return false;
  }
}

/**
 * 批量从数据库同步到 Redis
 * @returns {Promise<number>} - 同步成功的数量
 */
async function batchSyncFromDB() {
  try {
    // 获取所有商品
    const products = await db.query('SELECT id, stock FROM products');

    if (!products || products.length === 0) {
      console.log('[库存同步] 没有需要同步的商品');
      return 0;
    }

    let success = 0;

    for (const product of products) {
      const result = await syncStockFromDB(product.id);
      if (result) {
        success++;
      }
    }

    console.log(`[库存同步] 批量同步完成，成功: ${success}/${products.length}`);
    return success;
  } catch (error) {
    console.error('[库存同步] 批量同步（DB -> Redis）失败:', error.message);
    return 0;
  }
}

module.exports = {
  syncProductStock,
  syncAllStock,
  syncStockFromDB,
  batchSyncFromDB,
};