/**
 * 认证路由
 * 定义认证相关的 API 端点
 */
const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validation');
const {
  login,
  getCurrentUser,
  logout,
  refreshToken,
} = require('../controllers/authController');

/**
 * @route   POST /api/auth/login
 * @desc    用户登录
 * @access  Public
 */
router.post(
  '/login',
  validateBody({
    username: { required: true, validator: 'username', label: '用户名' },
    password: { required: true, validator: 'password', label: '密码' },
  }),
  login
);

/**
 * @route   GET /api/auth/me
 * @desc    获取当前登录用户信息
 * @access  Private
 */
router.get('/me', authenticate, getCurrentUser);

/**
 * @route   POST /api/auth/logout
 * @desc    用户登出
 * @access  Private
 */
router.post('/logout', authenticate, logout);

module.exports = router;