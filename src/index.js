/**
 * 应用入口文件
 * 启动 Express 服务器
 */

const config = require('./config');
const createApp = require('./app');
const { closeRedisConnection } = require('./database/redis');
const { close: closeDatabaseConnection } = require('./database/mysql');

/**
 * 创建并启动服务器
 */
async function startServer() {
  try {
    // 创建 Express 应用（现在包含数据库初始化）
    const app = await createApp();

    // 启动服务器
    const server = app.listen(config.server.port, () => {
      console.log('='.repeat(50));
      console.log(`🚀 服务器已启动`);
      console.log(`📍 环境: ${config.server.env}`);
      console.log(`🔗 地址: http://localhost:${config.server.port}`);
      console.log(`📚 API 文档: http://localhost:${config.server.port}/`);
      console.log('='.repeat(50));
      console.log('\n可用的测试账号：');
      console.log('  管理员: admin / admin123');
      console.log('  经理: manager / manager123');
      console.log('  员工: staff / staff123');
      console.log('='.repeat(50));
    });

    // 优雅关闭处理
    const gracefulShutdown = (signal) => {
      console.log(`${signal} 信号接收，正在关闭服务器...`);
      
      // 关闭子进程
      if (app.workers) {
        console.log('正在关闭子进程...');
        
        if (app.workers.expiredOrderWorker) {
          app.workers.expiredOrderWorker.send({ type: 'shutdown' });
        }
        
        if (app.workers.orderCreatedWorker) {
          app.workers.orderCreatedWorker.send({ type: 'shutdown' });
        }
        
        // 给子进程5秒时间优雅关闭
        setTimeout(() => {
          if (app.workers.expiredOrderWorker) {
            app.workers.expiredOrderWorker.kill();
          }
          if (app.workers.orderCreatedWorker) {
            app.workers.orderCreatedWorker.kill();
          }
        }, 5000);
      }
      
      // 关闭服务器
      server.close(async () => {
        console.log('服务器已关闭');

        // 关闭 Redis 连接
        try {
          await closeRedisConnection();
        } catch (redisError) {
          console.error('关闭 Redis 连接失败:', redisError.message);
        }

        // 关闭数据库连接
        try {
          await closeDatabaseConnection();
        } catch (dbError) {
          console.error('关闭数据库连接失败:', dbError.message);
        }

        process.exit(0);
      });
      
      // 10秒后强制退出
      setTimeout(() => {
        console.log('强制退出');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // 未捕获的异常处理
    process.on('uncaughtException', (error) => {
      console.error('未捕获的异常:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('未处理的 Promise 拒绝:', reason);
      process.exit(1);
    });

  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer();
