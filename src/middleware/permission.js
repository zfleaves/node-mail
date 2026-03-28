/**
 * 权限控制中间件
 * 基于角色的访问控制（RBAC）
 */
const { UserRoles } = require('../models/User');

/**
 * 角色权限配置
 * 定义每个角色可以访问的资源
 */
const rolePermissions = {
  [UserRoles.ADMIN]: [
    // 用户管理
    'users:read',
    'users:create',
    'users:update',
    'users:delete',
    // 商品管理
    'products:read',
    'products:create',
    'products:update',
    'products:delete',
    // 订单管理
    'orders:read',
    'orders:create',
    'orders:update',
    'orders:delete',
    // 系统管理
    'system:config',
  ],
  [UserRoles.MANAGER]: [
    // 用户管理（有限权限）
    'users:read',
    'users:update',
    // 商品管理
    'products:read',
    'products:create',
    'products:update',
    // 订单管理
    'orders:read',
    'orders:update',
  ],
  [UserRoles.STAFF]: [
    // 商品管理（只读）
    'products:read',
    // 订单管理（只读和部分更新）
    'orders:read',
    'orders:update:status',
  ],
};

/**
 * 检查角色是否有指定权限
 * @param {string} role - 用户角色
 * @param {string} permission - 需要的权限
 * @returns {boolean} - 是否有权限
 */
function hasPermission(role, permission) {
  const permissions = rolePermissions[role] || [];
  
  // 检查精确匹配
  if (permissions.includes(permission)) {
    return true;
  }
  
  // 检查通配符权限（例如：orders:* 匹配 orders:read）
  const wildcardPermission = permission.split(':')[0] + ':*';
  if (permissions.includes(wildcardPermission)) {
    return true;
  }
  
  return false;
}

/**
 * 权限验证中间件工厂函数
 * @param {string|string[]} permissions - 需要的权限（单个或数组）
 * @returns {Function} - Express 中间件函数
 */
function requirePermission(permissions) {
  // 将权限转换为数组
  const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
  
  return (req, res, next) => {
    // 检查用户是否已认证
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证，请先登录',
      });
    }

    // 检查用户角色是否有任意一个所需权限
    const hasAnyPermission = requiredPermissions.some(permission =>
      hasPermission(req.user.role, permission)
    );

    if (!hasAnyPermission) {
      return res.status(403).json({
        success: false,
        message: '权限不足，无法访问该资源',
      });
    }

    next();
  };
}

/**
 * 角色验证中间件工厂函数
 * @param {string[]} allowedRoles - 允许的角色列表
 * @returns {Function} - Express 中间件函数
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    // 检查用户是否已认证
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证，请先登录',
      });
    }

    // 检查用户角色是否在允许的角色列表中
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足，无法访问该资源',
      });
    }

    next();
  };
}

/**
 * 检查是否为管理员
 */
function requireAdmin(req, res, next) {
  return requireRole([UserRoles.ADMIN])(req, res, next);
}

/**
 * 检查是否为管理员或经理
 */
function requireManagerOrAdmin(req, res, next) {
  return requireRole([UserRoles.ADMIN, UserRoles.MANAGER])(req, res, next);
}

module.exports = {
  hasPermission,
  requirePermission,
  requireRole,
  requireAdmin,
  requireManagerOrAdmin,
};