/**
 * 数据验证中间件
 * 验证请求数据的格式和有效性
 */

/**
 * 验证规则对象
 */
const validators = {
  // 用户名验证
  username: (value) => {
    if (!value || value.trim().length === 0) {
      return { valid: false, message: '用户名不能为空' };
    }
    if (value.length < 3 || value.length > 20) {
      return { valid: false, message: '用户名长度必须在 3-20 个字符之间' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return { valid: false, message: '用户名只能包含字母、数字和下划线' };
    }
    return { valid: true };
  },

  // 密码验证
  password: (value) => {
    if (!value || value.length === 0) {
      return { valid: false, message: '密码不能为空' };
    }
    if (value.length < 6) {
      return { valid: false, message: '密码长度不能少于 6 个字符' };
    }
    return { valid: true };
  },

  // 邮箱验证
  email: (value) => {
    if (!value || value.trim().length === 0) {
      return { valid: false, message: '邮箱不能为空' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return { valid: false, message: '邮箱格式不正确' };
    }
    return { valid: true };
  },

  // 角色验证
  role: (value) => {
    const validRoles = ['admin', 'manager', 'staff'];
    if (!value || !validRoles.includes(value)) {
      return { valid: false, message: '角色必须是 admin、manager 或 staff' };
    }
    return { valid: true };
  },

  // 姓名验证
  name: (value) => {
    if (!value || value.trim().length === 0) {
      return { valid: false, message: '姓名不能为空' };
    }
    if (value.length > 50) {
      return { valid: false, message: '姓名长度不能超过 50 个字符' };
    }
    return { valid: true };
  },

  // 价格验证
  price: (value) => {
    if (value === undefined || value === null) {
      return { valid: false, message: '价格不能为空' };
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      return { valid: false, message: '价格必须是有效的正数' };
    }
    return { valid: true };
  },

  // 库存验证
  stock: (value) => {
    if (value === undefined || value === null) {
      return { valid: false, message: '库存不能为空' };
    }
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) {
      return { valid: false, message: '库存必须是非负整数' };
    }
    return { valid: true };
  },

  // 商品状态验证
  productStatus: (value) => {
    const validStatuses = ['active', 'inactive', 'out_of_stock'];
    if (!value || !validStatuses.includes(value)) {
      return { valid: false, message: '商品状态必须是 active、inactive 或 out_of_stock' };
    }
    return { valid: true };
  },

  // 订单状态验证
  orderStatus: (value) => {
    const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
    if (!value || !validStatuses.includes(value)) {
      return { valid: false, message: '订单状态必须是 pending、paid、shipped、delivered 或 cancelled' };
    }
    return { valid: true };
  },
};

/**
 * 验证请求体
 * @param {Object} rules - 验证规则对象
 * @returns {Function} - Express 中间件函数
 */
function validateBody(rules) {
  return (req, res, next) => {
    const errors = [];
    const body = req.body || {};

    // 遍历验证规则
    for (const [field, rule] of Object.entries(rules)) {
      const value = body[field];
      
      // 检查是否为必填字段
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field,
          message: `${rule.label || field} 不能为空`,
        });
        continue;
      }

      // 如果字段存在且不为空，进行验证
      if (value !== undefined && value !== null && value !== '') {
        if (rule.validator && validators[rule.validator]) {
          const result = validators[rule.validator](value);
          if (!result.valid) {
            errors.push({
              field,
              message: result.message,
            });
          }
        }
      }
    }

    // 如果有错误，返回错误信息
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: '数据验证失败',
        errors,
      });
    }

    next();
  };
}

/**
 * 验证查询参数
 * @param {Object} rules - 验证规则对象
 * @returns {Function} - Express 中间件函数
 */
function validateQuery(rules) {
  return (req, res, next) => {
    const errors = [];
    const query = req.query || {};

    // 遍历验证规则
    for (const [field, rule] of Object.entries(rules)) {
      const value = query[field];
      
      // 如果字段存在，进行验证
      if (value !== undefined && value !== null && value !== '') {
        if (rule.validator && validators[rule.validator]) {
          const result = validators[rule.validator](value);
          if (!result.valid) {
            errors.push({
              field,
              message: result.message,
            });
          }
        }
      }
    }

    // 如果有错误，返回错误信息
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors,
      });
    }

    next();
  };
}

/**
 * 验证路径参数
 * @param {Object} rules - 验证规则对象
 * @returns {Function} - Express 中间件函数
 */
function validateParams(rules) {
  return (req, res, next) => {
    const errors = [];
    const params = req.params || {};

    // 遍历验证规则
    for (const [field, rule] of Object.entries(rules)) {
      const value = params[field];
      
      // 检查是否为必填字段
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field,
          message: `${rule.label || field} 不能为空`,
        });
        continue;
      }

      // 如果字段存在且不为空，进行验证
      if (value !== undefined && value !== null && value !== '') {
        if (rule.validator && validators[rule.validator]) {
          const result = validators[rule.validator](value);
          if (!result.valid) {
            errors.push({
              field,
              message: result.message,
            });
          }
        }
      }
    }

    // 如果有错误，返回错误信息
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors,
      });
    }

    next();
  };
}

module.exports = {
  validateBody,
  validateQuery,
  validateParams,
};