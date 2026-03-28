/**
 * MySQL 数据库连接配置
 * 使用 mysql2/promise 实现异步数据库操作
 */

const mysql = require('mysql2/promise');
const config = require('../config');

/**
 * 数据库连接池配置
 * 使用连接池可以提高性能，避免频繁创建和销毁连接
 */
const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  waitForConnections: true,
  connectionLimit: 10,        // 连接池最大连接数
  queueLimit: 0,              // 排队限制，0 表示无限制
  enableKeepAlive: true,      // 启用 TCP keep-alive
  keepAliveInitialDelay: 0,   // keep-alive 初始延迟
});

/**
 * 测试数据库连接
 * @returns {Promise<boolean>} - 连接是否成功
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL 数据库连接成功');
    console.log(`📍 数据库: ${config.database.name}`);
    console.log(`🔗 主机: ${config.database.host}:${config.database.port}`);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL 数据库连接失败:', error.message);
    return false;
  }
}

/**
 * 执行查询（SELECT）
 * @param {string} sql - SQL 查询语句
 * @param {Array} params - 查询参数
 * @returns {Promise<Array>} - 查询结果
 */
async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('数据库查询错误:', error);
    throw error;
  }
}

/**
 * 执行插入（INSERT）
 * @param {string} sql - SQL 插入语句
 * @param {Array} params - 插入参数
 * @returns {Promise<Object>} - 插入结果（包含 insertId）
 */
async function insert(sql, params = []) {
  try {
    const [result] = await pool.execute(sql, params);
    return {
      insertId: result.insertId,
      affectedRows: result.affectedRows,
    };
  } catch (error) {
    console.error('数据库插入错误:', error);
    throw error;
  }
}

/**
 * 执行更新（UPDATE）
 * @param {string} sql - SQL 更新语句
 * @param {Array} params - 更新参数
 * @returns {Promise<Object>} - 更新结果
 */
async function update(sql, params = []) {
  try {
    const [result] = await pool.execute(sql, params);
    return {
      affectedRows: result.affectedRows,
      changedRows: result.changedRows,
    };
  } catch (error) {
    console.error('数据库更新错误:', error);
    throw error;
  }
}

/**
 * 执行删除（DELETE）
 * @param {string} sql - SQL 删除语句
 * @param {Array} params - 删除参数
 * @returns {Promise<Object>} - 删除结果
 */
async function remove(sql, params = []) {
  try {
    const [result] = await pool.execute(sql, params);
    return {
      affectedRows: result.affectedRows,
    };
  } catch (error) {
    console.error('数据库删除错误:', error);
    throw error;
  }
}

/**
 * 关闭数据库连接池
 * @returns {Promise<void>}
 */
async function close() {
  try {
    await pool.end();
    console.log('数据库连接池已关闭');
  } catch (error) {
    console.error('关闭数据库连接池错误:', error);
  }
}

/**
 * 获取数据库连接（用于事务处理）
 * @returns {Promise<Object>} - 数据库连接对象
 */
async function getConnection() {
  try {
    const connection = await pool.getConnection();
    return connection;
  } catch (error) {
    console.error('获取数据库连接错误:', error);
    throw error;
  }
}

/**
 * 执行事务
 * @param {Function} callback - 事务回调函数
 * @returns {Promise<any>} - 事务执行结果
 */
async function transaction(callback) {
  const connection = await getConnection();
  
  try {
    // 开始事务
    await connection.beginTransaction();
    
    // 执行事务回调
    const result = await callback(connection);
    
    // 提交事务
    await connection.commit();
    
    return result;
  } catch (error) {
    // 回滚事务
    await connection.rollback();
    throw error;
  } finally {
    // 释放连接
    connection.release();
  }
}

module.exports = {
  pool,
  testConnection,
  query,
  insert,
  update,
  remove,
  close,
  getConnection,
  transaction,
};