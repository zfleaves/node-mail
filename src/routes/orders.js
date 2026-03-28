/**
 * 订单路由
 * 定义订单管理相关的 API 端点
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { validateBody, validateParams } = require('../middleware/validation');
const {
  getOrderList,
  getOrderById,
  getOrderByOrderNo,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  updateOrderToPaid,
  deleteOrder,
  getOrderStatistics,
} = require('../controllers/orderController');

/**
 * @route   GET /api/orders
 * @desc    获取订单列表
 * @access  Private (需要 orders:read 权限)
 */
router.get(
  '/',
  authenticate,
  requirePermission('orders:read'),
  getOrderList
);

/**
 * @route   GET /api/orders/statistics
 * @desc    获取订单统计信息
 * @access  Private (需要 orders:read 权限)
 */
router.get(
  '/statistics',
  authenticate,
  requirePermission('orders:read'),
  getOrderStatistics
);

/**
 * @route   GET /api/orders/info
 * @desc    根据 ID 获取订单详情
 * @access  Private (需要 orders:read 权限)
 */
router.get(
  '/info',
  authenticate,
  requirePermission('orders:read'),
  getOrderById
);

/**
 * @route   GET /api/orders/order-no
 * @desc    根据订单号获取订单详情
 * @access  Private (需要 orders:read 权限)
 */
router.get(
  '/order-no',
  authenticate,
  requirePermission('orders:read'),
  getOrderByOrderNo
);

/**
 * @route   POST /api/orders/create
 * @desc    创建新订单
 * @access  Private (需要 orders:create 权限)
 */
router.post(
  '/create',
  authenticate,
  requirePermission('orders:create'),
  validateBody({
    userId: { required: true, validator: 'name', label: '用户 ID' },
    userName: { required: true, validator: 'name', label: '用户姓名' },
    totalAmount: { required: true, validator: 'price', label: '总金额' },
    status: { validator: 'orderStatus', label: '订单状态' },
    items: { required: true, validator: 'name', label: '订单商品' },
  }),
  createOrder
);

/**
 * @route   PATCH /api/orders/status
 * @desc    更新订单状态
 * @access  Private (需要 orders:update 权限)
 */
router.patch(
  '/status',
  authenticate,
  requirePermission('orders:update'),
  validateBody({
    id: { required: true, validator: 'name', label: '订单 ID' },
    status: { required: true, validator: 'orderStatus', label: '订单状态' },
  }),
  updateOrderStatus
);

/**
 * @route   POST /api/orders/cancel
 * @desc    取消订单
 * @access  Private (需要 orders:update 权限)
 */
router.post(
  '/cancel',
  authenticate,
  requirePermission('orders:update'),
  validateBody({
    id: { required: true, validator: 'name', label: '订单 ID' },
  }),
  cancelOrder
);

/**
 * @route   POST /api/orders/pay
 * @desc    支付订单（将临时订单转为已支付）
 * @access  Private (需要 orders:update 权限)
 */
router.post(
  '/pay',
  authenticate,
  requirePermission('orders:update'),
  validateBody({
    id: { required: true, validator: 'name', label: '订单 ID' },
  }),
  updateOrderToPaid
);

/**
 * @route   DELETE /api/orders/delete
 * @desc    删除订单
 * @access  Private (需要 orders:delete 权限)
 */
router.delete(
  '/delete',
  authenticate,
  requirePermission('orders:delete'),
  validateBody({
    id: { required: true, validator: 'name', label: '订单 ID' },
  }),
  deleteOrder
);

module.exports = router;