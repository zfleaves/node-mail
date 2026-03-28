/**
 * 全局错误处理中间件
 * 统一处理应用中的错误
 */

/**
 * 自定义错误类
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 错误处理中间件
 */
function errorHandler(err, req, res, next) {
  // 设置默认错误信息
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // 记录错误日志（在实际项目中应该使用日志库）
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
  });

  // 开发环境返回详细错误信息
  if (process.env.NODE_ENV === 'development') {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      error: {
        message: err.message,
        stack: err.stack,
      },
    });
  }

  // 生产环境返回简化的错误信息
  res.status(error.statusCode).json({
    success: false,
    message: error.isOperational ? error.message : '服务器内部错误',
  });
}

/**
 * 404 处理中间件
 */
function notFound(req, res, next) {
  const error = new AppError(`找不到路由: ${req.originalUrl}`, 404);
  next(error);
}

/**
 * 异步错误捕获包装器
 * 用于包装异步路由处理器，自动捕获错误
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  errorHandler,
  notFound,
  asyncHandler,
};