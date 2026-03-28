/**
 * 模拟数据库层
 * 使用内存数据模拟数据库操作
 * 在实际项目中，这里应该替换为真实的数据库连接（如 MySQL、PostgreSQL、MongoDB 等）
 */

/**
 * 模拟的用户数据
 * 角色说明：
 * - admin: 超级管理员，拥有所有权限
 * - manager: 管理员，拥有部分管理权限
 * - staff: 普通员工，只有基础操作权限
 */
const mockUsers = [
  {
    id: 1,
    username: 'admin',
    password: '$2a$10$9X5ZqZqZqZqZqZqZqZqZqOeZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZ', // bcrypt hash of 'admin123'
    email: 'admin@example.com',
    role: 'admin',
    name: '系统管理员',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 2,
    username: 'manager',
    password: '$2a$10$9X5ZqZqZqZqZqZqZqZqZqOeZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZ', // bcrypt hash of 'manager123'
    email: 'manager@example.com',
    role: 'manager',
    name: '运营经理',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: 3,
    username: 'staff',
    password: '$2a$10$9X5ZqZqZqZqZqZqZqZqZqOeZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZ', // bcrypt hash of 'staff123'
    email: 'staff@example.com',
    role: 'staff',
    name: '客服专员',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
];

/**
 * 模拟的商品数据
 */
const mockProducts = [
  {
    id: 1,
    name: 'iPhone 15 Pro',
    price: 8999.00,
    stock: 100,
    category: '数码产品',
    description: '苹果最新旗舰手机',
    status: 'active',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 2,
    name: 'MacBook Air M3',
    price: 9499.00,
    stock: 50,
    category: '电脑办公',
    description: '轻薄笔记本电脑',
    status: 'active',
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-05'),
  },
  {
    id: 3,
    name: 'AirPods Pro',
    price: 1899.00,
    stock: 200,
    category: '数码配件',
    description: '主动降噪耳机',
    status: 'active',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
  },
];

/**
 * 模拟的订单数据
 */
const mockOrders = [
  {
    id: 1,
    orderNo: 'ORD202401010001',
    userId: 101,
    userName: '张三',
    totalAmount: 8999.00,
    status: 'pending', // pending, paid, shipped, delivered, cancelled
    items: [
      {
        productId: 1,
        productName: 'iPhone 15 Pro',
        quantity: 1,
        price: 8999.00,
      },
    ],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 2,
    orderNo: 'ORD202401020001',
    userId: 102,
    userName: '李四',
    totalAmount: 11398.00,
    status: 'paid',
    items: [
      {
        productId: 2,
        productName: 'MacBook Air M3',
        quantity: 1,
        price: 9499.00,
      },
      {
        productId: 3,
        productName: 'AirPods Pro',
        quantity: 1,
        price: 1899.00,
      },
    ],
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-03'),
  },
];

/**
 * 模拟数据库操作类
 * 提供类似数据库的 CRUD 操作
 */
class MockDatabase {
  constructor() {
    this.users = [...mockUsers];
    this.products = [...mockProducts];
    this.orders = [...mockOrders];
  }

  /**
   * 生成自增 ID
   */
  _generateId(data) {
    return data.length > 0 ? Math.max(...data.map(item => item.id)) + 1 : 1;
  }

  // ========== 用户相关操作 ==========

  /**
   * 根据用户名查找用户
   */
  findUserByUsername(username) {
    return this.users.find(user => user.username === username);
  }

  /**
   * 根据 ID 查找用户
   */
  findUserById(id) {
    return this.users.find(user => user.id === id);
  }

  /**
   * 获取所有用户（支持分页）
   */
  getAllUsers(page = 1, pageSize = 10) {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return {
      data: this.users.slice(start, end),
      total: this.users.length,
      page,
      pageSize,
    };
  }

  /**
   * 创建用户
   */
  createUser(userData) {
    const newUser = {
      id: this._generateId(this.users),
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(newUser);
    return newUser;
  }

  /**
   * 更新用户
   */
  updateUser(id, userData) {
    const index = this.users.findIndex(user => user.id === id);
    if (index === -1) return null;
    
    this.users[index] = {
      ...this.users[index],
      ...userData,
      updatedAt: new Date(),
    };
    return this.users[index];
  }

  /**
   * 删除用户
   */
  deleteUser(id) {
    const index = this.users.findIndex(user => user.id === id);
    if (index === -1) return false;
    
    this.users.splice(index, 1);
    return true;
  }

  // ========== 商品相关操作 ==========

  /**
   * 获取所有商品（支持分页和筛选）
   */
  getAllProducts(page = 1, pageSize = 10, filters = {}) {
    let filtered = [...this.products];
    
    // 应用筛选条件
    if (filters.category) {
      filtered = filtered.filter(p => p.category === filters.category);
    }
    if (filters.status) {
      filtered = filtered.filter(p => p.status === filters.status);
    }
    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(keyword) || 
        p.description.toLowerCase().includes(keyword)
      );
    }
    
    // 分页
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    return {
      data: filtered.slice(start, end),
      total: filtered.length,
      page,
      pageSize,
    };
  }

  /**
   * 根据 ID 查找商品
   */
  findProductById(id) {
    return this.products.find(product => product.id === id);
  }

  /**
   * 创建商品
   */
  createProduct(productData) {
    const newProduct = {
      id: this._generateId(this.products),
      ...productData,
      status: productData.status || 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.products.push(newProduct);
    return newProduct;
  }

  /**
   * 更新商品
   */
  updateProduct(id, productData) {
    const index = this.products.findIndex(product => product.id === id);
    if (index === -1) return null;
    
    this.products[index] = {
      ...this.products[index],
      ...productData,
      updatedAt: new Date(),
    };
    return this.products[index];
  }

  /**
   * 删除商品
   */
  deleteProduct(id) {
    const index = this.products.findIndex(product => product.id === id);
    if (index === -1) return false;
    
    this.products.splice(index, 1);
    return true;
  }

  // ========== 订单相关操作 ==========

  /**
   * 获取所有订单（支持分页和筛选）
   */
  getAllOrders(page = 1, pageSize = 10, filters = {}) {
    let filtered = [...this.orders];
    
    // 应用筛选条件
    if (filters.status) {
      filtered = filtered.filter(o => o.status === filters.status);
    }
    if (filters.orderNo) {
      filtered = filtered.filter(o => o.orderNo.includes(filters.orderNo));
    }
    
    // 分页
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    return {
      data: filtered.slice(start, end),
      total: filtered.length,
      page,
      pageSize,
    };
  }

  /**
   * 根据 ID 查找订单
   */
  findOrderById(id) {
    return this.orders.find(order => order.id === id);
  }

  /**
   * 根据订单号查找订单
   */
  findOrderByOrderNo(orderNo) {
    return this.orders.find(order => order.orderNo === orderNo);
  }

  /**
   * 创建订单
   */
  createOrder(orderData) {
    const newOrder = {
      id: this._generateId(this.orders),
      ...orderData,
      status: orderData.status || 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.orders.push(newOrder);
    return newOrder;
  }

  /**
   * 更新订单状态
   */
  updateOrderStatus(id, status) {
    const index = this.orders.findIndex(order => order.id === id);
    if (index === -1) return null;
    
    this.orders[index] = {
      ...this.orders[index],
      status,
      updatedAt: new Date(),
    };
    return this.orders[index];
  }

  /**
   * 删除订单
   */
  deleteOrder(id) {
    const index = this.orders.findIndex(order => order.id === id);
    if (index === -1) return false;
    
    this.orders.splice(index, 1);
    return true;
  }
}

// 导出单例
module.exports = new MockDatabase();