/**
 * 订单创建后处理子进程
 * 负责处理订单创建后的异步业务逻辑
 * 如：发送通知、更新积分、记录日志等
 */

const db = require('../database/dataAccess');

// 模拟发送通知（实际项目中可以是短信、邮件等）
async function sendNotification(userId, message) {
  console.log(`[订单处理] 发送通知给用户 ${userId}: ${message}`);
  // 这里可以调用短信服务、邮件服务等
  // await smsService.send(userId, message);
  return true;
}

// 模拟更新用户积分
async function updateUserPoints(userId, points) {
  console.log(`[订单处理] 更新用户 ${userId} 积分: +${points}`);
  // 这里可以调用用户积分服务
  // await userService.updatePoints(userId, points);
  return true;
}

// 模拟记录订单事件日志
async function logOrderEvent(orderId, event, data = {}) {
  console.log(`[订单处理] 记录订单事件: ${orderId} - ${event}`, data);
  // 这里可以写入日志表或日志文件
  // await logService.orderEvent(orderId, event, data);
  return true;
}

/**
 * 处理订单创建后的业务逻辑
 */
async function handleOrderCreated(orderData) {
  try {
    console.log(`[订单处理] 开始处理订单创建后的业务逻辑: ${orderData.orderNo}`);
    
    // 1. 发送通知（短信/邮件）
    await sendNotification(orderData.userId, `订单 ${orderData.orderNo} 创建成功，请及时支付`);
    
    // 2. 更新用户积分（订单金额的1%）
    const points = orderData.totalAmount * 0.01;
    await updateUserPoints(orderData.userId, points);
    
    // 3. 记录订单事件日志
    await logOrderEvent(orderData.id, 'created', {
      userId: orderData.userId,
      totalAmount: orderData.totalAmount,
      itemCount: orderData.items ? orderData.items.length : 0
    });
    
    console.log(`[订单处理] 订单创建后处理完成: ${orderData.orderNo}`);
    
    return { success: true };
  } catch (error) {
    console.error('[订单处理] 处理订单创建失败:', error.message);
    throw error;
  }
}

/**
 * 处理订单支付后的业务逻辑
 */
async function handleOrderPaid(orderData) {
  try {
    console.log(`[订单处理] 开始处理订单支付后的业务逻辑: ${orderData.orderNo}`);
    
    // 1. 发送支付成功通知
    await sendNotification(orderData.userId, `订单 ${orderData.orderNo} 支付成功`);
    
    // 2. 记录支付事件
    await logOrderEvent(orderData.id, 'paid', {
      userId: orderData.userId,
      totalAmount: orderData.totalAmount
    });
    
    console.log(`[订单处理] 订单支付后处理完成: ${orderData.orderNo}`);
    
    return { success: true };
  } catch (error) {
    console.error('[订单处理] 处理订单支付失败:', error.message);
    throw error;
  }
}

/**
 * 处理订单取消后的业务逻辑
 */
async function handleOrderCancelled(orderData, reason) {
  try {
    console.log(`[订单处理] 开始处理订单取消后的业务逻辑: ${orderData.orderNo} (${reason})`);
    
    // 1. 发送取消通知
    await sendNotification(orderData.userId, `订单 ${orderData.orderNo} 已取消: ${reason}`);
    
    // 2. 记录取消事件
    await logOrderEvent(orderData.id, 'cancelled', {
      userId: orderData.userId,
      reason: reason
    });
    
    console.log(`[订单处理] 订单取消后处理完成: ${orderData.orderNo}`);
    
    return { success: true };
  } catch (error) {
    console.error('[订单处理] 处理订单取消失败:', error.message);
    throw error;
  }
}

/**
 * 发送心跳到主进程
 */
function sendHeartbeat() {
  if (process.send) {
    process.send({
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
      pid: process.pid,
      processed: orderCreatedWorker.stats?.processed || 0
    });
  }
}

/**
 * 优雅退出
 */
function gracefulShutdown(stats) {
  console.log('[订单处理] 收到退出信号，准备关闭...');

  console.log(`[订单处理] 处理统计:`, stats);
  console.log('[订单处理] 已关闭');
  process.exit(0);
}

// 子进程入口
if (require.main === module) {
  console.log('[订单处理] 子进程启动 (PID:', process.pid + ')');

  // 统计信息
  const stats = {
    processed: 0,
    failed: 0
  };

  // 存储定时器引用，用于清理
  let heartbeatTimer = null;

  // 设置心跳，每30秒发送一次
  heartbeatTimer = setInterval(sendHeartbeat, 30 * 1000);

  // 监听主进程消息
  process.on('message', (msg) => {
    console.log('[订单处理] 收到主进程消息:', msg.type);

    switch (msg.type) {
      case 'order_created':
        handleOrderCreated(msg.data)
          .then(() => {
            stats.processed++;
            process.send({ type: 'order_created_done', success: true });
          })
          .catch((err) => {
            stats.failed++;
            process.send({ type: 'order_created_done', success: false, error: err.message });
          });
        break;

      case 'order_paid':
        handleOrderPaid(msg.data)
          .then(() => {
            stats.processed++;
            process.send({ type: 'order_paid_done', success: true });
          })
          .catch((err) => {
            stats.failed++;
            process.send({ type: 'order_paid_done', success: false, error: err.message });
          });
        break;

      case 'order_cancelled':
        handleOrderCancelled(msg.data, msg.reason)
          .then(() => {
            stats.processed++;
            process.send({ type: 'order_cancelled_done', success: true });
          })
          .catch((err) => {
            stats.failed++;
            process.send({ type: 'order_cancelled_done', success: false, error: err.message });
          });
        break;

      case 'shutdown':
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        gracefulShutdown(stats);
        break;

      case 'ping':
        process.send({
          type: 'pong',
          pid: process.pid,
          stats: stats
        });
        break;

      default:
        console.log('[订单处理] 未知消息类型:', msg.type);
    }
  });

  // 监听退出信号
  process.on('SIGTERM', () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    gracefulShutdown(stats);
  });

  process.on('SIGINT', () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    gracefulShutdown(stats);
  });

  // 监听未捕获的异常
  process.on('uncaughtException', (error) => {
    console.error('[订单处理] 未捕获的异常:', error);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[订单处理] 未处理的 Promise 拒绝:', reason);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    process.exit(1);
  });
}

module.exports = {
  handleOrderCreated,
  handleOrderPaid,
  handleOrderCancelled
};