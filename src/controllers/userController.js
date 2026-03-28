/**
 * 用户控制器
 * 处理用户管理相关的业务逻辑
 */
const { User } = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 获取用户列表
 * @route GET /api/users
 */
const getUserList = asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 10 } = req.query;

  // 参数转换
  const pageNum = parseInt(page, 10);
  const pageSizeNum = parseInt(pageSize, 10);

  // 获取用户列表
  const result = await User.getList(pageNum, pageSizeNum);

  res.json({
    success: true,
    data: result,
  });
});

/**
 * 根据 ID 获取用户详情
 * @route GET /api/users/info
 */
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.query;
  const userId = parseInt(id, 10);

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
});

/**
 * 创建用户
 * @route POST /api/users/create
 */
const createUser = asyncHandler(async (req, res) => {
  const userData = req.body;

  // 1. 基本参数验证
  if (!userData.username || !userData.password || !userData.email) {
    return res.status(400).json({
      success: false,
      message: '用户名、密码和邮箱不能为空',
    });
  }

  // 2. 用户名验证
  if (userData.username.length < 3 || userData.username.length > 50) {
    return res.status(400).json({
      success: false,
      message: '用户名长度必须在 3-50 个字符之间',
    });
  }

  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(userData.username)) {
    return res.status(400).json({
      success: false,
      message: '用户名只能包含字母、数字和下划线',
    });
  }

  // 3. 密码验证
  if (userData.password.length < 6) {
    return res.status(400).json({
      success: false,
      message: '密码长度不能少于 6 位',
    });
  }

  // 4. 邮箱验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userData.email)) {
    return res.status(400).json({
      success: false,
      message: '邮箱格式不正确',
    });
  }

  // 5. 角色验证
  if (userData.role && !['admin', 'manager', 'staff'].includes(userData.role)) {
    return res.status(400).json({
      success: false,
      message: '角色必须是 admin、manager 或 staff',
    });
  }

  // 6. 设置默认角色
  if (!userData.role) {
    userData.role = 'staff';
  }

  // 7. 检查用户名是否已存在
  const existingUser = await User.findByUsername(userData.username);
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: '用户名已存在',
    });
  }

  // 8. 检查邮箱是否已存在
  const existingEmail = await User.findByEmail(userData.email);
  if (existingEmail) {
    return res.status(400).json({
      success: false,
      message: '邮箱已存在',
    });
  }

  // 9. 创建用户
  const newUser = await User.create(userData);

  // 10. 返回用户信息（不包含密码）
  const { password, ...userWithoutPassword } = newUser;

  res.status(201).json({
    success: true,
    message: '用户创建成功',
    data: userWithoutPassword,
  });
});

/**
 * 更新用户信息
 * @route POST /api/users/update
 */
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const userId = parseInt(id, 10);
  const userData = req.body;

  // 更新用户
  const updatedUser = await User.update(userId, userData);

  if (!updatedUser) {
    return res.status(404).json({
      success: false,
      message: '用户不存在',
    });
  }

  res.json({
    success: true,
    message: '用户更新成功',
    data: updatedUser,
  });
});

/**
 * 删除用户
 * @route DELETE /api/users/delete
 */
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const userId = parseInt(id, 10);

  try {
    // 删除用户
    const success = await User.delete(userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
      });
    }

    res.json({
      success: true,
      message: '用户删除成功',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = {
  getUserList,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};