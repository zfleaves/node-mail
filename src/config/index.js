/**
 * 配置文件
 * 加载环境变量并提供配置访问
 */

require('dotenv').config();

/**
 * 应用配置对象
 */
const config = {
  // 服务器配置
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    env: process.env.NODE_ENV || 'development',
  },

  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // 数据库配置（模拟）
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    name: process.env.DB_NAME || 'ecommerce_admin',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },
};

module.exports = config;