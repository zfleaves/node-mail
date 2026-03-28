/**
 * 订单控制器
 * 处理订单管理相关的业务逻辑
 * 使用 MySQL 真实数据库
 */
const db = require('../database/dataAccess');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 获取订单创建后处理子进程
 * 通过 app 获取，避免全局变量
 */
function getOrderCreatedWorker(req) {
  if (req.app && req.app.workers && req.app.workers.orderCreatedWorker) {
    return req.app.workers.orderCreatedWorker;
  }
  return null;
}

/**
 * 获取订单列表
 * @route GET /api/orders
 */
const getOrderList = asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 10, status, orderNo } = req.query;

  // 参数转换
  const pageNum = parseInt(page, 10);
  const pageSizeNum = parseInt(pageSize, 10);

  // 构建筛选条件
  const filters = {};
  if (status) filters.status = status;
  if (orderNo) filters.orderNo = orderNo;

  // 获取订单列表
  const result = await db.getAllOrders(pageNum, pageSizeNum, filters);

  res.json({
    success: true,
    data: result,
  });
});

/**
 * 根据 ID 获取订单详情
 * @route GET /api/orders/info
 */
const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.query;
  const orderId = parseInt(id, 10);

  const order = await db.findOrderById(orderId);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: '订单不存在',
    });
  }

  res.json({
    success: true,
    data: order,
  });
});

/**
 * 根据订单号获取订单详情
 * @route GET /api/orders/order-no
 */
const getOrderByOrderNo = asyncHandler(async (req, res) => {
  const { orderNo } = req.query;

  const order = await db.findOrderByOrderNo(orderNo);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: '订单不存在',
    });
  }

  res.json({
    success: true,
    data: order,
  });
});

/**
 * 创建订单
 * @route POST /api/orders/create
 */
const createOrder = asyncHandler(async (req, res) => {
  const orderData = req.body;

  // 生成订单号（实际项目中应该根据业务规则生成）
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  orderData.orderNo = `ORD${timestamp}${random}`;

  // 创建订单（主进程快速响应）
  const newOrder = await db.createOrder(orderData);

  // 将后续处理发送到子进程（不阻塞响应）
  const worker = getOrderCreatedWorker(req);
  if (worker) {
    worker.send({
      type: 'order_created',
      data: newOrder
    });
  } else {
    console.warn('[订单控制器] 订单创建后处理子进程未启动，跳过异步处理');
  }

  res.status(201).json({
    success: true,
    message: '订单创建成功',
    data: newOrder,
  });
});

/**
 * 更新订单状态
 * @route PATCH /api/orders/status
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id, status } = req.body;
  const orderId = parseInt(id, 10);

  // 验证订单状态流转的合法性
  const order = await db.findOrderById(orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: '订单不存在',
    });
  }

  // 定义允许的状态流转
  const allowedTransitions = {
    pending: ['paid', 'cancelled'],
    paid: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: [],
  };

  // 检查状态流转是否合法
  if (!allowedTransitions[order.status].includes(status)) {
    return res.status(400).json({
      success: false,
      message: `无法从状态 ${order.status} 转换到 ${status}`,
    });
  }

  // 更新订单状态
  const updatedOrder = await db.updateOrderStatus(orderId, status);

  res.json({
    success: true,
    message: '订单状态更新成功',
    data: updatedOrder,
  });
});

/**
 * 删除订单
 * @route DELETE /api/orders/delete
 */
const deleteOrder = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const orderId = parseInt(id, 10);

  // 删除订单
  const success = await db.deleteOrder(orderId);

  if (!success) {
    return res.status(404).json({
      success: false,
      message: '订单不存在',
    });
  }

  res.json({
    success: true,
    message: '订单删除成功',
  });
});

/**
 * 取消订单
 * @route POST /api/orders/cancel
 */
const cancelOrder = asyncHandler(async (req, res) => {
  const { id, reason } = req.body;
  const orderId = parseInt(id, 10);

  // 取消订单（会自动恢复库存）
  const updatedOrder = await db.cancelOrder(orderId, reason);

  // 将后续处理发送到子进程（不阻塞响应）
  const worker = getOrderCreatedWorker(req);
  if (worker) {
    worker.send({
      type: 'order_cancelled',
      data: updatedOrder,
      reason: reason || 'user_cancelled'
    });
  } else {
    console.warn('[订单控制器] 订单创建后处理子进程未启动，跳过异步处理');
  }

  res.json({
    success: true,
    message: '订单取消成功',
    data: updatedOrder,
  });
});

/**
 * 将临时订单标记为已支付
 * @route POST /api/orders/pay
 */
const updateOrderToPaid = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const orderId = parseInt(id, 10);

  // 将订单状态从 temp 转为 paid
  const updatedOrder = await db.updateOrderToPaid(orderId);

  // 将后续处理发送到子进程（不阻塞响应）
  const worker = getOrderCreatedWorker(req);
  if (worker) {
    worker.send({
      type: 'order_paid',
      data: updatedOrder
    });
  } else {
    console.warn('[订单控制器] 订单创建后处理子进程未启动，跳过异步处理');
  }

  res.json({
    success: true,
    message: '订单支付成功',
    data: updatedOrder,
  });
});

/**
 * 获取订单统计信息
 * @route GET /api/orders/statistics
 */
const getOrderStatistics = asyncHandler(async (req, res) => {
  const { data: orders } = await db.getAllOrders(1, 1000);

  // 计算统计数据
  const statistics = {
    total: orders.length,
    temp: 0,
    pending: 0,
    paid: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    expired: 0,
    totalAmount: 0,
  };

  orders.forEach(order => {
    statistics[order.status]++;
    statistics.totalAmount += order.totalAmount;
  });

  res.json({
    success: true,
    data: statistics,
  });
});

module.exports = {
  getOrderList,
  getOrderById,
  getOrderByOrderNo,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  updateOrderToPaid,
  deleteOrder,
  getOrderStatistics,
};