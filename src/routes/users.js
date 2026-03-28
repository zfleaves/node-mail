/**
 * 用户路由
 * 定义用户管理相关的 API 端点
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { validateBody, validateParams } = require('../middleware/validation');
const {
  getUserList,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} = require('../controllers/userController');

/**
 * @route   GET /api/users
 * @desc    获取用户列表
 * @access  Private (需要 users:read 权限)
 */
router.get(
  '/',
  authenticate,
  requirePermission('users:read'),
  getUserList
);

/**
 * @route   GET /api/users/info
 * @desc    根据 ID 获取用户详情
 * @access  Private (需要 users:read 权限)
 */
router.get(
  '/info',
  authenticate,
  requirePermission('users:read'),
  getUserById
);

/**
 * @route   POST /api/users/create
 * @desc    创建新用户
 * @access  Private (需要 users:create 权限)
 */
router.post(
  '/create',
  authenticate,
  requirePermission('users:create'),
  validateBody({
    username: { required: true, validator: 'username', label: '用户名' },
    password: { required: true, validator: 'password', label: '密码' },
    email: { required: true, validator: 'email', label: '邮箱' },
    role: { required: true, validator: 'role', label: '角色' },
    name: { required: true, validator: 'name', label: '姓名' },
  }),
  createUser
);

/**
 * @route   POST /api/users/update
 * @desc    更新用户信息
 * @access  Private (需要 users:update 权限)
 */
router.post(
  '/update',
  authenticate,
  requirePermission('users:update'),
  validateBody({
    id: { required: true, validator: 'name', label: '用户 ID' },
    email: { validator: 'email', label: '邮箱' },
    role: { validator: 'role', label: '角色' },
    name: { validator: 'name', label: '姓名' },
    password: { validator: 'password', label: '密码' },
  }),
  updateUser
);

/**
 * @route   DELETE /api/users/delete
 * @desc    删除用户
 * @access  Private (需要 users:delete 权限)
 */
router.delete(
  '/delete',
  authenticate,
  requirePermission('users:delete'),
  validateBody({
    id: { required: true, validator: 'name', label: '用户 ID' },
  }),
  deleteUser
);

module.exports = router;