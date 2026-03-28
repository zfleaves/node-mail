/**
 * 过期订单处理子进程
 * 负责定时检查并处理过期的临时订单
 */

const db = require('../database/dataAccess');

/**
 * 处理过期订单
 */
async function processExpiredOrders() {
  try {
    const count = await db.checkExpiredOrders();
    if (count > 0) {
      console.log(`[过期订单处理] 已处理 ${count} 个过期订单 (${new Date().toISOString()})`);
    }
  } catch (error) {
    console.error('[过期订单处理] 处理过期订单失败:', error.message);
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
      pid: process.pid
    });
  }
}

/**
 * 优雅退出
 */
function gracefulShutdown() {
  console.log('[过期订单处理] 收到退出信号，准备关闭...');
  
  // 清理定时器
  if (processExpiredOrders.timer) {
    clearInterval(processExpiredOrders.timer);
  }
  
  if (processExpiredOrders.heartbeatTimer) {
    clearInterval(processExpiredOrders.heartbeatTimer);
  }
  
  console.log('[过期订单处理] 已关闭');
  process.exit(0);
}

// 子进程入口
if (require.main === module) {
  console.log('[过期订单处理] 子进程启动 (PID:', process.pid + ')');
  
  // 存储定时器引用，用于清理
  let processTimer = null;
  let heartbeatTimer = null;
  
  // 立即执行一次过期订单检查
  console.log('[过期订单处理] 执行首次过期订单检查...');
  processExpiredOrders().catch(err => {
    console.error('[过期订单处理] 首次检查失败:', err);
  });
  
  // 设置定时任务，每分钟执行一次
  processTimer = setInterval(async () => {
    await processExpiredOrders().catch(err => {
      console.error('[过期订单处理] 定时检查失败:', err);
    });
  }, 60 * 1000);
  
  // 设置心跳，每30秒发送一次
  heartbeatTimer = setInterval(sendHeartbeat, 30 * 1000);
  
  // 监听主进程消息
  process.on('message', (msg) => {
    console.log('[过期订单处理] 收到主进程消息:', msg);
    
    if (msg.type === 'shutdown') {
      // 清理定时器
      if (processTimer) clearInterval(processTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      gracefulShutdown();
    } else if (msg.type === 'ping') {
      process.send({ type: 'pong', pid: process.pid });
    }
  });
  
  // 监听退出信号
  process.on('SIGTERM', () => {
    if (processTimer) clearInterval(processTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    gracefulShutdown();
  });
  
  process.on('SIGINT', () => {
    if (processTimer) clearInterval(processTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    gracefulShutdown();
  });
  
  // 监听未捕获的异常
  process.on('uncaughtException', (error) => {
    console.error('[过期订单处理] 未捕获的异常:', error);
    if (processTimer) clearInterval(processTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[过期订单处理] 未处理的 Promise 拒绝:', reason);
    if (processTimer) clearInterval(processTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    process.exit(1);
  });
}

module.exports = { processExpiredOrders };