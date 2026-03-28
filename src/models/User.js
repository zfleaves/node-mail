/**
 * 用户模型
 * 处理用户相关的业务逻辑和数据操作
 * 使用 MySQL 真实数据库
 */
const bcrypt = require('bcryptjs');
const db = require('../database/dataAccess');

/**
 * 用户角色枚举
 */
const UserRoles = {
  ADMIN: 'admin',       // 超级管理员
  MANAGER: 'manager',   // 管理员
  STAFF: 'staff',       // 普通员工
};

/**
 * 用户模型类
 */
class User {
  /**
   * 用户登录验证
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @returns {Promise<Object|null>} - 验证成功返回用户信息，失败返回 null
   */
  static async login(username, password) {
    // 从数据库查找用户
    const user = await db.findUserByUsername(username);
    
    if (!user) {
      return null;
    }

    // 使用 bcrypt 比较密码
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return null;
    }

    // 返回用户信息（不包含密码）
    const { password: _, ...userInfo } = user;
    return userInfo;
  }

  /**
   * 根据 ID 获取用户信息
   * @param {number} id - 用户 ID
   * @returns {Promise<Object|null>} - 用户信息
   */
  static async findById(id) {
    const user = await db.findUserById(id);
    if (!user) return null;
    
    // 不返回密码
    const { password: _, ...userInfo } = user;
    return userInfo;
  }

  /**
   * 根据用户名获取用户信息
   * @param {string} username - 用户名
   * @returns {Promise<Object|null>} - 用户信息
   */
  static async findByUsername(username) {
    const user = await db.findUserByUsername(username);
    if (!user) return null;
    
    // 不返回密码
    const { password: _, ...userInfo } = user;
    return userInfo;
  }

  /**
   * 根据邮箱获取用户信息
   * @param {string} email - 邮箱
   * @returns {Promise<Object|null>} - 用户信息
   */
  static async findByEmail(email) {
    const user = await db.findUserByEmail(email);
    if (!user) return null;
    
    // 不返回密码
    const { password: _, ...userInfo } = user;
    return userInfo;
  }

  /**
   * 获取用户列表
   * @param {number} page - 页码
   * @param {number} pageSize - 每页数量
   * @returns {Promise<Object>} - 用户列表数据
   */
  static async getList(page = 1, pageSize = 10) {
    const result = await db.getAllUsers(page, pageSize);
    
    // 移除密码字段（dataAccess 层已经处理了）
    return result;
  }

  /**
   * 创建用户
   * @param {Object} userData - 用户数据
   * @returns {Promise<Object>} - 新创建的用户
   */
  static async create(userData) {
    // 检查用户名是否已存在
    const existingUser = await db.findUserByUsername(userData.username);
    if (existingUser) {
      throw new Error('用户名已存在');
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const newUser = await db.createUser({
      ...userData,
      password: hashedPassword,
    });

    // 不返回密码
    const { password: _, ...userInfo } = newUser;
    return userInfo;
  }

  /**
   * 更新用户信息
   * @param {number} id - 用户 ID
   * @param {Object} userData - 更新的用户数据
   * @returns {Promise<Object|null>} - 更新后的用户信息
   */
  static async update(id, userData) {
    // 如果更新密码，需要加密
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }

    const updatedUser = await db.updateUser(id, userData);
    if (!updatedUser) return null;

    // 不返回密码
    const { password: _, ...userInfo } = updatedUser;
    return userInfo;
  }

  /**
   * 删除用户
   * @param {number} id - 用户 ID
   * @returns {Promise<boolean>} - 是否删除成功
   */
  static async delete(id) {
    // 不允许删除 ID 为 1 的超级管理员
    if (id === 1) {
      throw new Error('不能删除超级管理员');
    }

    return await db.deleteUser(id);
  }

  /**
   * 检查用户权限
   * @param {string} userRole - 用户角色
   * @param {string} requiredRole - 需要的角色
   * @returns {boolean} - 是否有权限
   */
  static hasPermission(userRole, requiredRole) {
    const roleHierarchy = {
      [UserRoles.ADMIN]: 3,
      [UserRoles.MANAGER]: 2,
      [UserRoles.STAFF]: 1,
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }
}

// 导出角色常量和用户类
module.exports = {
  User,
  UserRoles,
};