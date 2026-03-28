/**
 * 认证控制器
 * 处理登录、登出等认证相关的业务逻辑
 */
const { User } = require('../models/User');
const { generateTokens } = require('../middleware/auth');
const { createSession, deleteSession } = require('../database/redis');

/**
 * 用户登录
 * @route POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;

    // 参数验证
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空',
      });
    }

    // 验证用户
    const user = await User.login(username, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误',
      });
    }

    // 生成令牌对（access token 和 refresh token）
    const tokens = generateTokens(user);

    // 创建 Redis 会话（用于滑动过期机制）
    const sessionId = `user:${user.id}`;
    const sessionData = {
      userId: user.id,
      username: user.username,
      role: user.role,
      createdAt: new Date().toISOString(),
      userAgent: req.headers['user-agent'] || ''
    };

    try {
      await createSession(sessionId, sessionData, 900); // 15 分钟过期
      console.log(`[登录] 用户 ${user.username} 会话已创建`);
    } catch (redisError) {
      console.error('[登录] 创建 Redis 会话失败:', redisError.message);
      // 开发环境下，Redis 失败不影响登录流程
      if (process.env.NODE_ENV !== 'development') {
        throw redisError;
      }
    }

    // 返回登录信息
    res.json({
      success: true,
      message: '登录成功',
      data: {
        user,
        ...tokens,
        tokenInfo: {
          expiresIn: 900, // 会话有效期 15 分钟
          shouldRefresh: false,
          message: '会话有效期 15 分钟，持续操作自动续期'
        }
      },
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      message: '登录失败，请稍后重试',
    });
  }
}

/**
 * 获取当前用户信息
 * @route GET /api/auth/me
 */
async function getCurrentUser(req, res) {
  try {
    // 从请求中获取用户信息（由认证中间件添加）
    const userId = req.user.id;

    // 获取用户详细信息
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败',
    });
  }
}

/**
 * 用户登出
 * @route POST /api/auth/logout
 */
async function logout(req, res) {
  try {
    // 删除 Redis 会话
    if (req.user && req.user.id) {
      const sessionId = `user:${req.user.id}`;

      try {
        await deleteSession(sessionId);
        console.log(`[登出] 用户 ${req.user.username} 会话已删除`);
      } catch (redisError) {
        console.error('[登出] 删除 Redis 会话失败:', redisError.message);
        // 开发环境下，Redis 失败不影响登出流程
        if (process.env.NODE_ENV !== 'development') {
          throw redisError;
        }
      }
    }

    // 客户端需要删除本地的 token
    res.json({
      success: true,
      message: '登出成功，请清除本地令牌',
    });
  } catch (error) {
    console.error('登出错误:', error);
    res.status(500).json({
      success: false,
      message: '登出失败',
    });
  }
}

module.exports = {
  login,
  getCurrentUser,
  logout,
};