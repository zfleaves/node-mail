/**
 * Express 应用主文件
 * 配置 Express 应用和中间件
 */

const express = require('express');

const cors = require('cors');

const path = require('path');

const {
  fork
} = require('child_process');

const {
  errorHandler,
  notFound
} = require('./middleware/errorHandler');

const {
  testConnection
} = require('./database/mysql');

const {
  initDatabase
} = require('./database/schema');

const {
  testConnection: testRedisConnection
} = require('./database/redis');
const {
  batchCacheStock
} = require('./database/redisStock');
const db = require('./database/mysql');

const {
  tokenInfoMiddleware
} = require('./middleware/auth');

/**
 * 创建 Express 应用
 */
async function createApp() {
  const app = express();

  // ========== 数据库初始化 ==========

  // 测试数据库连接
  await testConnection();

  // 初始化数据库（创建表和插入测试数据）
  await initDatabase();

  // ========== Redis 初始化 ==========

  // 测试 Redis 连接
  await testRedisConnection();

  // 预热商品库存缓存
  try {
    console.log('[应用启动] 开始预热商品库存缓存...');
    const products = await db.query('SELECT id as productId, stock FROM products WHERE stock > 0');
    if (products && products.length > 0) {
      const cachedCount = await batchCacheStock(products);
      console.log(`[应用启动] 商品库存缓存预热完成，已缓存 ${cachedCount} 个商品`);
    } else {
      console.log('[应用启动] 没有需要缓存的商品库存');
    }
  } catch (error) {
    console.error('[应用启动] 预热商品库存缓存失败:', error.message);
    // 不影响应用启动
  }

  // ========== 中间件配置 ==========

  // CORS 跨域配置
  app.use(cors());

  // 解析 JSON 请求体
  app.use(express.json());
  // Express 应用中处理表单数据的关键中间件，
  app.use(express.urlencoded({
    extended: true,
    limit: '10mb' // 设置请求体大小限制
  }));

  // 静态文件服务 - 提供上传的文件访问
  app.use('/uploads', express.static('uploads'));

  // Token 信息中间件 - 在响应中添加 token 剩余时间
  app.use(tokenInfoMiddleware);

  // 请求日志中间件（开发环境）
  if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
      next();
    });
  }

  // 健康检查端点
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      message: '服务运行正常',
      timestamp: new Date().toISOString(),
    });
  });

  // 库存同步管理端点（仅开发环境）
  if (process.env.NODE_ENV === 'development') {
    const {
      syncAllStock,
      batchSyncFromDB
    } = require('./utils/stockSync');

    // 同步 Redis -> 数据库
    app.post('/admin/sync/redis-to-db', async (req, res) => {
      try {
        console.log('[库存同步] 手动触发 Redis -> 数据库同步');
        const result = await syncAllStock();
        res.json({
          success: true,
          message: '库存同步完成',
          data: result,
        });
      } catch (error) {
        console.error('[库存同步] 同步失败:', error);
        res.status(500).json({
          success: false,
          message: '库存同步失败',
        });
      }
    });

    // 同步 数据库 -> Redis
    app.post('/admin/sync/db-to-redis', async (req, res) => {
      try {
        console.log('[库存同步] 手动触发 数据库 -> Redis 同步');
        const count = await batchSyncFromDB();
        res.json({
          success: true,
          message: '库存同步完成',
          data: {
            count
          },
        });
      } catch (error) {
        console.error('[库存同步] 同步失败:', error);
        res.status(500).json({
          success: false,
          message: '库存同步失败',
        });
      }
    });
  }

  // API 信息端点
  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: '电商管理后台 API',
      version: '1.0.0',
      database: 'MySQL',
      endpoints: {
        auth: '/api/auth',
        users: '/api/users',
        products: '/api/products',
        orders: '/api/orders',
      },
    });
  });

  // ========== 路由配置 ==========

  // 导入路由模块
  const authRoutes = require('./routes/auth');
  const userRoutes = require('./routes/users');
  const productRoutes = require('./routes/products');
  const orderRoutes = require('./routes/orders');
  const uploadRoutes = require('./routes/uploads');

  // 挂载路由
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/uploads', uploadRoutes);

  // ========== 子进程管理 ==========

  // 子进程存储对象
  app.workers = {
    expiredOrderWorker: null,
    orderCreatedWorker: null
  };

  /**

     * 启动过期订单处理子进程

     */

  function startExpiredOrderWorker() {

    console.log('[主进程] 启动过期订单处理子进程...');



    const worker = fork(

      path.join(__dirname, 'cron/expiredOrderWorker.js'),

      {
        silent: false
      }

    );



    // 监听子进程消息

    worker.on('message', (msg) => {

      if (msg.type === 'heartbeat') {

        // 收到心跳，记录时间戳

        worker.lastHeartbeat = Date.now();

      } else if (msg.type === 'pong') {

        console.log('[主进程] 过期订单处理子进程响应正常');

      }

    });



    // 监听子进程错误

    worker.on('error', (err) => {

      console.error('[主进程] 过期订单处理子进程错误:', err);

    });



    // 监听子进程退出

    worker.on('exit', (code, signal) => {

      console.log(`[主进程] 过期订单处理子进程退出，代码: ${code}, 信号: ${signal}`);



      // 非正常退出时自动重启

      if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGINT') {

        console.log('[主进程] 5秒后重启过期订单处理子进程...');

        setTimeout(() => {

          app.workers.expiredOrderWorker = startExpiredOrderWorker();

        }, 5000);

      } else {

        app.workers.expiredOrderWorker = null;

      }

    });



    // 记录启动时间

    worker.startTime = Date.now();

    worker.lastHeartbeat = Date.now();



    console.log(`[主进程] 过期订单处理子进程已启动 (PID: ${worker.pid})`);

    return worker;

  }

  /**

     * 启动订单创建后处理子进程

     */

  function startOrderCreatedWorker() {

    console.log('[主进程] 启动订单创建后处理子进程...');



    const worker = fork(

      path.join(__dirname, 'cron/orderCreatedWorker.js'),

      {
        silent: false
      }

    );



    // 监听子进程消息

    worker.on('message', (msg) => {

      if (msg.type === 'heartbeat') {

        // 收到心跳，记录时间戳

        worker.lastHeartbeat = Date.now();

      } else if (msg.type === 'pong') {

        console.log('[主进程] 订单处理子进程响应正常 - 统计:', msg.stats);

      } else if (msg.type === 'order_created_done') {

        console.log(`[主进程] 订单创建后处理${msg.success ? '成功' : '失败'}`);

      } else if (msg.type === 'order_paid_done') {

        console.log(`[主进程] 订单支付后处理${msg.success ? '成功' : '失败'}`);

      } else if (msg.type === 'order_cancelled_done') {

        console.log(`[主进程] 订单取消后处理${msg.success ? '成功' : '失败'}`);

      }

    });



    // 监听子进程错误

    worker.on('error', (err) => {

      console.error('[主进程] 订单创建后处理子进程错误:', err);

    });



    // 监听子进程退出

    worker.on('exit', (code, signal) => {

      console.log(`[主进程] 订单创建后处理子进程退出，代码: ${code}, 信号: ${signal}`);



      // 非正常退出时自动重启

      if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGINT') {

        console.log('[主进程] 5秒后重启订单创建后处理子进程...');

        setTimeout(() => {

          app.workers.orderCreatedWorker = startOrderCreatedWorker();

        }, 5000);

      } else {

        app.workers.orderCreatedWorker = null;

      }

    });



    // 记录启动时间

    worker.startTime = Date.now();

    worker.lastHeartbeat = Date.now();



    console.log(`[主进程] 订单创建后处理子进程已启动 (PID: ${worker.pid})`);

    return worker;

  }

  // 启动所有子进程
  app.workers.expiredOrderWorker = startExpiredOrderWorker();
  app.workers.orderCreatedWorker = startOrderCreatedWorker();

  // 添加子进程健康检查端点
  app.get('/health/workers', (req, res) => {
    const workerStatus = {
      expiredOrderWorker: app.workers.expiredOrderWorker ? {
        pid: app.workers.expiredOrderWorker.pid,
        status: 'running'
      } : {
        status: 'stopped'
      },
      orderCreatedWorker: app.workers.orderCreatedWorker ? {
        pid: app.workers.orderCreatedWorker.pid,
        status: 'running'
      } : {
        status: 'stopped'
      }
    };

    res.json({
      success: true,
      data: workerStatus
    });
  });

  // 404 处理
  app.use(notFound);

  // 全局错误处理
  app.use(errorHandler);

  return app;
}

module.exports = createApp;