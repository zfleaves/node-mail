/**
 * 认证中间件
 * 处理 JWT 令牌验证和用户身份认证
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { getSession, refreshSession } = require('../database/redis');

/**
 * 白名单路由配置
 * 这些路由不需要认证即可访问
 */
const WHITELIST = [
  { method: 'POST', path: '/api/auth/login' },
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/health/workers' },
  { method: 'GET', path: '/' },
];

/**
 * 检查请求是否在白名单中
 * @param {Object} req - Express 请求对象
 * @returns {boolean} - 是否在白名单中
 */
function isWhitelisted(req) {
  return WHITELIST.some(
    (route) => route.method === req.method && route.path === req.path
  );
}

/**
 * 计算 token 剩余时间（秒）
 * @param {string} token - JWT 令牌
 * @returns {number|null} - 剩余秒数，如果 token 无效则返回 null
 */
function getTokenRemainingTime(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    const remaining = decoded.exp - now;
    return remaining > 0 ? remaining : 0;
  } catch (error) {
    return null;
  }
}

/**
 * 响应中间件 - 在响应中添加 token 剩余时间
 */
function tokenInfoMiddleware(req, res, next) {
  // 保存原始的 json 方法
  const originalJson = res.json.bind(res);

  // 重写 json 方法
  res.json = function(data) {
    // 如果请求已认证且响应包含 token 信息
    if (req.user && req.token) {
      const remainingTime = getTokenRemainingTime(req.token);

      // 在响应中添加 token 信息
      if (data && typeof data === 'object') {
        if (!data.tokenInfo) {
          data.tokenInfo = {};
        }
        data.tokenInfo.expiresIn = remainingTime; // 剩余秒数
        // 注意：在新的架构中，不需要刷新 Token，因此移除 shouldRefresh
      }
    }

    return originalJson(data);
  };

  next();
}

/**
 * 从请求头中提取 JWT 令牌
 * @param {Object} req - Express 请求对象
 * @returns {string|null} - JWT 令牌
 */
function extractToken(req) {
  // 从 Authorization 头获取令牌（格式：Bearer <token>）
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * JWT 认证中间件
 * 验证请求中的 JWT 令牌，并将用户信息附加到请求对象
 * 使用 Redis 会话实现滑动过期机制
 */
async function authenticate(req, res, next) {
  try {
    // 检查是否在白名单中
    if (isWhitelisted(req)) {
      return next();
    }

    // 提取令牌
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌',
      });
    }

    // 验证令牌
    const decoded = jwt.verify(token, config.jwt.secret);

    // 检查 Redis 会话
    const sessionId = `user:${decoded.id}`;
    let session = null;

    try {
      session = await getSession(sessionId);

      if (!session) {
        // 会话不存在，即使 JWT 有效也拒绝访问
        return res.status(401).json({
          success: false,
          message: '会话已过期，请重新登录',
          code: 'SESSION_EXPIRED'
        });
      }

      // 滑动过期：刷新会话过期时间
      await refreshSession(sessionId, 900); // 15 分钟
    } catch (redisError) {
      console.error('[认证] Redis 操作失败:', redisError.message);
      // 开发环境下，Redis 失败时不影响认证流程
      if (process.env.NODE_ENV !== 'development') {
        return res.status(500).json({
          success: false,
          message: '认证过程中发生错误',
        });
      }
    }

    // 将用户信息和 token 附加到请求对象
    req.user = decoded;
    req.token = token;
    req.session = session; // 添加会话信息

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: '无效的认证令牌',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: '认证令牌已过期',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(500).json({
      success: false,
      message: '认证过程中发生错误',
    });
  }
}

/**
 * 生成 Access Token（长期令牌）
 * 由于使用 Redis 会话控制真正的过期时间，JWT 可以设置较长的有效期
 * @param {Object} user - 用户信息
 * @returns {string} - JWT 令牌
 */
function generateAccessToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    type: 'access'
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: '7d', // 7天有效期（真正的过期由 Redis 会话控制）
  });
}

/**
 * 生成 Refresh Token（长期令牌）
 * @param {Object} user - 用户信息
 * @returns {string} - JWT 令牌
 */
function generateRefreshToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    type: 'refresh'
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: '7d', // 7天有效期
  });
}

/**
 * 生成令牌对（包含 access token 和 refresh token）
 * @param {Object} user - 用户信息
 * @returns {Object} - 令牌对
 */
function generateTokens(user) {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
    expiresIn: '7d' // access token 有效期 7 天
  };
}

/**
 * 验证 Refresh Token
 * @param {string} refreshToken - 刷新令牌
 * @returns {Object|null} - 解码后的用户信息
 */
function verifyRefreshToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, config.jwt.secret);

    // 验证是否为 refresh token
    if (decoded.type !== 'refresh') {
      return null;
    }

    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * 生成 JWT 令牌（兼容旧代码）
 * @deprecated 使用 generateTokens 代替
 * @param {Object} user - 用户信息
 * @returns {string} - JWT 令牌
 */
function generateToken(user) {
  return generateAccessToken(user);
}

/**
 * 可选认证中间件
 * 如果提供了令牌则验证，但不强制要求
 */
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret);

      // 检查 Redis 会话
      const sessionId = `user:${decoded.id}`;
      let session = null;

      try {
        session = await getSession(sessionId);

        if (session) {
          // 滑动过期：刷新会话过期时间
          await refreshSession(sessionId, 900);
          req.user = decoded;
          req.session = session;
        }
      } catch (redisError) {
        // Redis 失败时不影响，继续执行
        console.error('[可选认证] Redis 操作失败:', redisError.message);
      }
    }

    next();
  } catch (error) {
    // 令牌无效或过期，但不阻止请求继续
    next();
  }
}

module.exports = {
  authenticate,
  optionalAuth,
  generateToken,
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyRefreshToken,
  tokenInfoMiddleware,
  WHITELIST
};