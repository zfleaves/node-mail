/**
 * Redis 连接和操作模块
 * 用于会话管理和滑动过期机制
 */

const { createClient } = require('redis');
const config = require('../config');

/**
 * Redis 客户端实例
 */
let redisClient = null;

/**
 * 创建 Redis 客户端连接
 */
async function createRedisClient() {
  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('[Redis] 重连失败，已达到最大重试次数');
          return new Error('重连失败');
        }
        const delay = Math.min(retries * 100, 3000);
        console.log(`[Redis] ${delay}ms 后尝试第 ${retries + 1} 次重连...`);
        return delay;
      }
    }
  });

  client.on('error', (err) => {
    console.error('[Redis] 客户端错误:', err.message);
  });

  client.on('connect', () => {
    console.log('[Redis] 客户端已连接');
  });

  client.on('ready', () => {
    console.log('[Redis] 客户端已就绪');
  });

  client.on('end', () => {
    console.log('[Redis] 客户端连接已关闭');
  });

  await client.connect();
  return client;
}

/**
 * 获取 Redis 客户端实例（单例模式）
 */
async function getRedisClient() {
  if (!redisClient || !redisClient.isOpen) {
    redisClient = await createRedisClient();
  }
  return redisClient;
}

/**
 * 测试 Redis 连接
 */
async function testConnection() {
  try {
    const client = await getRedisClient();
    await client.ping();
    console.log('[Redis] 连接测试成功');
    return true;
  } catch (error) {
    console.error('[Redis] 连接测试失败:', error.message);
    // 开发环境下，如果没有 Redis，可以返回 false 而不是抛出错误
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Redis] 开发环境下 Redis 连接失败，将使用内存会话（仅用于测试）');
      return false;
    }
    throw error;
  }
}

/**
 * 创建会话
 * @param {string} sessionId - 会话 ID
 * @param {Object} sessionData - 会话数据
 * @param {number} ttl - 过期时间（秒），默认 15 分钟
 */
async function createSession(sessionId, sessionData, ttl = 900) {
  try {
    const client = await getRedisClient();
    const key = `session:${sessionId}`;
    const value = JSON.stringify(sessionData);

    await client.setEx(key, ttl, value);
    console.log(`[Redis] 会话已创建: ${key}, TTL: ${ttl}秒`);
    return true;
  } catch (error) {
    console.error('[Redis] 创建会话失败:', error.message);
    throw error;
  }
}

/**
 * 获取会话
 * @param {string} sessionId - 会话 ID
 */
async function getSession(sessionId) {
  try {
    const client = await getRedisClient();
    const key = `session:${sessionId}`;

    const value = await client.get(key);
    if (!value) {
      return null;
    }

    return JSON.parse(value);
  } catch (error) {
    console.error('[Redis] 获取会话失败:', error.message);
    throw error;
  }
}

/**
 * 更新会话过期时间（滑动过期）
 * @param {string} sessionId - 会话 ID
 * @param {number} ttl - 过期时间（秒），默认 15 分钟
 */
async function refreshSession(sessionId, ttl = 900) {
  try {
    const client = await getRedisClient();
    const key = `session:${sessionId}`;

    const exists = await client.exists(key);
    if (!exists) {
      return false;
    }

    await client.expire(key, ttl);
    console.log(`[Redis] 会话已刷新: ${key}, TTL: ${ttl}秒`);
    return true;
  } catch (error) {
    console.error('[Redis] 刷新会话失败:', error.message);
    throw error;
  }
}

/**
 * 删除会话
 * @param {string} sessionId - 会话 ID
 */
async function deleteSession(sessionId) {
  try {
    const client = await getRedisClient();
    const key = `session:${sessionId}`;

    await client.del(key);
    console.log(`[Redis] 会话已删除: ${key}`);
    return true;
  } catch (error) {
    console.error('[Redis] 删除会话失败:', error.message);
    throw error;
  }
}

/**
 * 关闭 Redis 连接
 */
async function closeRedisConnection() {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    console.log('[Redis] 连接已关闭');
  }
}

module.exports = {
  getRedisClient,
  testConnection,
  createSession,
  getSession,
  refreshSession,
  deleteSession,
  closeRedisConnection
};