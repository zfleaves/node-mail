/**
 * 数据库表结构定义和初始化脚本
 * 创建用户、商品、订单等相关的数据表
 */

const db = require('./mysql');

/**
 * 创建用户表
 */
async function createUsersTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID',
      username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
      password VARCHAR(255) NOT NULL COMMENT '密码（加密存储）',
      email VARCHAR(100) NOT NULL UNIQUE COMMENT '邮箱',
      role ENUM('admin', 'manager', 'staff') NOT NULL DEFAULT 'staff' COMMENT '角色',
      name VARCHAR(100) NOT NULL COMMENT '姓名',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      INDEX idx_username (username),
      INDEX idx_email (email),
      INDEX idx_role (role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
  `;
  
  await db.query(sql);
  console.log('✅ 用户表创建成功');
}

/**
 * 创建商品表
 */
async function createProductsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS products (
      id INT PRIMARY KEY AUTO_INCREMENT COMMENT '商品ID',
      name VARCHAR(255) NOT NULL COMMENT '商品名称',
      price DECIMAL(10, 2) NOT NULL COMMENT '价格',
      original_price DECIMAL(10, 2) COMMENT '原价',
      discount DECIMAL(5, 2) COMMENT '折扣率（百分比）',
      stock INT NOT NULL DEFAULT 0 COMMENT '实际可用库存',
      frozen_stock INT NOT NULL DEFAULT 0 COMMENT '冻结库存（临时订单占用）',
      version INT NOT NULL DEFAULT 0 COMMENT '乐观锁版本号',
      category VARCHAR(100) NOT NULL COMMENT '分类',
      description TEXT COMMENT '描述',
      status ENUM('active', 'inactive', 'out_of_stock') NOT NULL DEFAULT 'active' COMMENT '状态',
      images JSON COMMENT '商品图片列表（数组）',
      videos JSON COMMENT '商品视频列表（数组）',
      main_image VARCHAR(500) COMMENT '主图',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      INDEX idx_category (category),
      INDEX idx_status (status),
      INDEX idx_stock (stock, frozen_stock)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品表';
  `;
  
  await db.query(sql);
  console.log('✅ 商品表创建成功');
  
  // 检查并添加缺失的列（兼容旧表结构）
  try {
    // 检查列是否存在
    const columns = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'ecommerce_admin' 
      AND TABLE_NAME = 'products'
    `);
    
    const columnNames = columns.map(col => col.COLUMN_NAME);
    
    // 添加 original_price 列
    if (!columnNames.includes('original_price')) {
      await db.query(`ALTER TABLE products ADD COLUMN original_price DECIMAL(10, 2) COMMENT '原价' AFTER price`);
      console.log('✅ 已添加 original_price 列');
    }
    
    // 添加 discount 列
    if (!columnNames.includes('discount')) {
      await db.query(`ALTER TABLE products ADD COLUMN discount DECIMAL(5, 2) DEFAULT 0 COMMENT '折扣率' AFTER original_price`);
      console.log('✅ 已添加 discount 列');
    }
    
    // 添加 images 列
    if (!columnNames.includes('images')) {
      await db.query(`ALTER TABLE products ADD COLUMN images JSON COMMENT '商品图片列表（数组）' AFTER status`);
      console.log('✅ 已添加 images 列');
    }
    
    // 添加 videos 列
    if (!columnNames.includes('videos')) {
      await db.query(`ALTER TABLE products ADD COLUMN videos JSON COMMENT '商品视频列表（数组）' AFTER images`);
      console.log('✅ 已添加 videos 列');
    }
    
    // 添加 main_image 列
    if (!columnNames.includes('main_image')) {
      await db.query(`ALTER TABLE products ADD COLUMN main_image VARCHAR(500) COMMENT '主图' AFTER videos`);
      console.log('✅ 已添加 main_image 列');
    }
    
  } catch (error) {
    console.error('[商品表] 检查列失败:', error.message);
  }
}

/**
 * 创建订单表
 */
async function createOrdersTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS orders (
      id INT PRIMARY KEY AUTO_INCREMENT COMMENT '订单ID',
      order_no VARCHAR(50) NOT NULL UNIQUE COMMENT '订单号',
      user_id INT NOT NULL COMMENT '用户ID',
      user_name VARCHAR(100) NOT NULL COMMENT '用户姓名',
      total_amount DECIMAL(10, 2) NOT NULL COMMENT '总金额',
      status ENUM('temp', 'pending', 'paid', 'shipped', 'delivered', 'cancelled', 'expired') NOT NULL DEFAULT 'temp' COMMENT '订单状态：temp-临时订单,pending-待支付,paid-已支付,shipped-已发货,delivered-已送达,cancelled-已取消,expired-已过期',
      expire_time TIMESTAMP NULL COMMENT '订单过期时间',
      cancelled_reason VARCHAR(255) COMMENT '取消原因',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      INDEX idx_order_no (order_no),
      INDEX idx_user_id (user_id),
      INDEX idx_status (status),
      INDEX idx_expire_time (expire_time, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';
  `;
  
  await db.query(sql);
  console.log('✅ 订单表创建成功');

  // 检查并添加缺失的列（兼容旧表结构）
  try {
    // 检查列是否存在
    const columns = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'ecommerce_admin' 
      AND TABLE_NAME = 'orders'
    `);
    
    const columnNames = columns.map(col => col.COLUMN_NAME);
    
    // 添加 expire_time 列
    if (!columnNames.includes('expire_time')) {
      await db.query(`ALTER TABLE orders ADD COLUMN expire_time TIMESTAMP NULL COMMENT '订单过期时间'`);
      console.log('✅ 已添加 expire_time 列');
    }
    
    // 添加 cancelled_reason 列
    if (!columnNames.includes('cancelled_reason')) {
      await db.query(`ALTER TABLE orders ADD COLUMN cancelled_reason VARCHAR(255) NULL COMMENT '取消原因'`);
      console.log('✅ 已添加 cancelled_reason 列');
    }
  } catch (error) {
    // 忽略错误
    console.log('⚠️  订单表列检查跳过:', error.message);
  }
}

/**
 * 创建订单商品明细表
 */
async function createOrderItemsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS order_items (
      id INT PRIMARY KEY AUTO_INCREMENT COMMENT '明细ID',
      order_id INT NOT NULL COMMENT '订单ID',
      product_id INT NOT NULL COMMENT '商品ID',
      product_name VARCHAR(255) NOT NULL COMMENT '商品名称',
      quantity INT NOT NULL DEFAULT 1 COMMENT '数量',
      price DECIMAL(10, 2) NOT NULL COMMENT '单价',
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      INDEX idx_order_id (order_id),
      INDEX idx_product_id (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单商品明细表';
  `;
  
  await db.query(sql);
  console.log('✅ 订单商品明细表创建成功');
}

/**
 * 插入初始测试数据
 */
async function insertTestData() {
  try {
    // 检查是否已有数据
    const userCount = await db.query('SELECT COUNT(*) as count FROM users');
    if (userCount[0].count > 0) {
      console.log('⚠️  数据库已有数据，跳过插入测试数据');
      return;
    }

    console.log('📝 开始插入测试数据...');

    // 插入测试用户（密码需要加密）
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // 简化处理，实际应该使用 bcrypt 加密
    const users = [
      {
        username: 'admin',
        password: hashedPassword,
        email: 'admin@example.com',
        role: 'admin',
        name: '系统管理员',
      },
      {
        username: 'manager',
        password: hashedPassword,
        email: 'manager@example.com',
        role: 'manager',
        name: '运营经理',
      },
      {
        username: 'staff',
        password: hashedPassword,
        email: 'staff@example.com',
        role: 'staff',
        name: '客服专员',
      },
    ];

    for (const user of users) {
      await db.insert(
        'INSERT INTO users (username, password, email, role, name) VALUES (?, ?, ?, ?, ?)',
        [user.username, user.password, user.email, user.role, user.name]
      );
    }
    console.log('✅ 测试用户插入成功');

    // 插入测试商品
    const products = [
      {
        name: 'iPhone 15 Pro',
        price: 8999.00,
        stock: 100,
        category: '数码产品',
        description: '苹果最新旗舰手机',
        status: 'active',
      },
      {
        name: 'MacBook Air M3',
        price: 9499.00,
        stock: 50,
        category: '电脑办公',
        description: '轻薄笔记本电脑',
        status: 'active',
      },
      {
        name: 'AirPods Pro',
        price: 1899.00,
        stock: 200,
        category: '数码配件',
        description: '主动降噪耳机',
        status: 'active',
      },
    ];

    for (const product of products) {
      await db.insert(
        'INSERT INTO products (name, price, stock, category, description, status) VALUES (?, ?, ?, ?, ?, ?)',
        [product.name, product.price, product.stock, product.category, product.description, product.status]
      );
    }
    console.log('✅ 测试商品插入成功');

    // 插入测试订单
    const orders = [
      {
        order_no: 'ORD202401010001',
        user_id: 101,
        user_name: '张三',
        total_amount: 8999.00,
        status: 'pending',
      },
      {
        order_no: 'ORD202401020001',
        user_id: 102,
        user_name: '李四',
        total_amount: 11398.00,
        status: 'paid',
      },
    ];

    for (const order of orders) {
      const result = await db.insert(
        'INSERT INTO orders (order_no, user_id, user_name, total_amount, status) VALUES (?, ?, ?, ?, ?)',
        [order.order_no, order.user_id, order.user_name, order.total_amount, order.status]
      );

      // 插入订单商品明细
      if (order.order_no === 'ORD202401010001') {
        await db.insert(
          'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)',
          [result.insertId, 1, 'iPhone 15 Pro', 1, 8999.00]
        );
      } else {
        await db.insert(
          'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)',
          [result.insertId, 2, 'MacBook Air M3', 1, 9499.00]
        );
        await db.insert(
          'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)',
          [result.insertId, 3, 'AirPods Pro', 1, 1899.00]
        );
      }
    }
    console.log('✅ 测试订单插入成功');
    console.log('✅ 测试数据插入完成');

  } catch (error) {
    console.error('❌ 插入测试数据失败:', error);
    throw error;
  }
}

/**
 * 初始化数据库
 * 创建所有表并插入测试数据
 */
async function initDatabase() {
  try {
    console.log('🔧 开始初始化数据库...');

    // 创建所有表
    await createUsersTable();
    await createProductsTable();
    await createOrdersTable();
    await createOrderItemsTable();

    // 插入测试数据
    await insertTestData();

    console.log('✅ 数据库初始化完成');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
}

module.exports = {
  initDatabase,
  createUsersTable,
  createProductsTable,
  createOrdersTable,
  createOrderItemsTable,
  insertTestData,
};