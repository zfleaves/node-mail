/**
 * 商品控制器
 * 处理商品管理相关的业务逻辑
 * 使用 MySQL 真实数据库
 */
const db = require('../database/dataAccess');
const { asyncHandler } = require('../middleware/errorHandler');
const { uploadFiles } = require('../config/upload');
const { processUploadedFile, deleteFiles } = require('../services/fileService');

/**
 * 获取商品列表
 * @route GET /api/products
 */
const getProductList = asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 10, category, status, keyword } = req.query;

  // 参数转换
  const pageNum = parseInt(page, 10);
  const pageSizeNum = parseInt(pageSize, 10);

  // 构建筛选条件
  const filters = {};
  if (category) filters.category = category;
  if (status) filters.status = status;
  if (keyword) filters.keyword = keyword;

  // 获取商品列表
  const result = await db.getAllProducts(pageNum, pageSizeNum, filters);

  res.json({
    success: true,
    data: result,
  });
});

/**
 * 获取商品详情
 * @route GET /api/products/info
 */
const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.query;
  const productId = parseInt(id, 10);

  const product = await db.findProductById(productId);

  if (!product) {
    return res.status(404).json({
      success: false,
      message: '商品不存在',
    });
  }

  res.json({
    success: true,
    data: product,
  });
});

/**
 * 创建商品
 * @route POST /api/products/create
 */
const createProduct = asyncHandler(async (req, res) => {
  const { name, description, price, originalPrice, stock, category, status, tags } = req.body;

  // 1. 基本参数验证
  if (!name || !price || !stock) {
    return res.status(400).json({
      success: false,
      message: '商品名称、价格和库存不能为空',
    });
  }

  // 2. 价格验证
  if (typeof price !== 'number' || price <= 0) {
    return res.status(400).json({
      success: false,
      message: '价格必须为正数',
    });
  }

  // 3. 价格精度验证（保留两位小数）
  const priceStr = price.toFixed(2);
  if (parseFloat(priceStr) !== price) {
    return res.status(400).json({
      success: false,
      message: '价格精度必须为两位小数',
    });
  }

  // 4. 原价验证（如果提供）
  if (originalPrice !== undefined) {
    if (typeof originalPrice !== 'number' || originalPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: '原价必须为正数',
      });
    }

    const originalPriceStr = originalPrice.toFixed(2);
    if (parseFloat(originalPriceStr) !== originalPrice) {
      return res.status(400).json({
        success: false,
        message: '原价精度必须为两位小数',
      });
    }

    // 验证原价必须大于等于售价
    if (originalPrice < price) {
      return res.status(400).json({
        success: false,
        message: '原价不能小于售价',
      });
    }
  }

  // 5. 库存验证
  if (typeof stock !== 'number' || stock < 0) {
    return res.status(400).json({
      success: false,
      message: '库存必须为非负整数',
    });
  }

  if (!Number.isInteger(stock)) {
    return res.status(400).json({
      success: false,
      message: '库存必须为整数',
    });
  }

  // 6. 处理上传的文件
  const uploadedFiles = [];
  
  if (req.files) {
    // 处理图片
    if (req.files.images) {
      const imageFiles = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
      for (const file of imageFiles) {
        uploadedFiles.push(processUploadedFile(file));
      }
    }
    
    // 处理视频
    if (req.files.videos) {
      const videoFiles = Array.isArray(req.files.videos) ? req.files.videos : [req.files.videos];
      for (const file of videoFiles) {
        uploadedFiles.push(processUploadedFile(file));
      }
    }
  }

  // 7. 如果提供了原价，自动计算折扣率
  const discount = originalPrice ? ((originalPrice - price) / originalPrice * 100).toFixed(2) : 0;

  // 8. 设置默认状态
  const productStatus = status || 'active';

  // 9. 设置图片和视频
  const images = uploadedFiles.filter(f => f.type === 'image').map(f => f.url);
  const videos = uploadedFiles.filter(f => f.type === 'video').map(f => f.url);
  const mainImage = images.length > 0 ? images[0] : null;

  // 10. 创建商品
  const newProduct = await db.createProduct({
    name,
    description,
    price,
    originalPrice,
    discount,
    stock,
    category,
    status: productStatus,
    tags: tags ? JSON.parse(tags) : [],
    images: JSON.stringify(images),
    videos: JSON.stringify(videos),
    mainImage
  });

  // 11. 记录价格历史
  if (newProduct) {
    await db.recordPriceHistory(newProduct.id, newProduct.price, '创建商品');
  }

  res.status(201).json({
    success: true,
    message: '商品创建成功',
    data: {
      ...newProduct,
      images: images,
      videos: videos,
      uploadedFiles
    },
  });
});

/**
 * 更新商品信息
 * @route POST /api/products/update
 */
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const productId = parseInt(id, 10);
  const productData = req.body;

  // 1. 查询商品是否存在
  const existingProduct = await db.findProductById(productId);
  if (!existingProduct) {
    return res.status(404).json({
      success: false,
      message: '商品不存在',
    });
  }

  // 2. 价格验证（如果更新价格）
  if (productData.price !== undefined) {
    if (typeof productData.price !== 'number' || productData.price <= 0) {
      return res.status(400).json({
        success: false,
        message: '价格必须为正数',
      });
    }

    const priceStr = productData.price.toFixed(2);
    if (parseFloat(priceStr) !== productData.price) {
      return res.status(400).json({
        success: false,
        message: '价格精度必须为两位小数',
      });
    }
  }

  // 3. 原价验证（如果更新原价）
  if (productData.originalPrice !== undefined) {
    if (typeof productData.originalPrice !== 'number' || productData.originalPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: '原价必须为正数',
      });
    }

    const originalPriceStr = productData.originalPrice.toFixed(2);
    if (parseFloat(originalPriceStr) !== productData.originalPrice) {
      return res.status(400).json({
        success: false,
        message: '原价精度必须为两位小数',
      });
    }

    // 验证原价必须大于等于售价
    const price = productData.price || existingProduct.price;
    if (productData.originalPrice < price) {
      return res.status(400).json({
        success: false,
        message: '原价不能小于售价',
      });
    }
  }

  // 4. 库存验证（如果更新库存）
  if (productData.stock !== undefined) {
    if (typeof productData.stock !== 'number' || productData.stock < 0) {
      return res.status(400).json({
        success: false,
        message: '库存必须为非负整数',
      });
    }

    if (!Number.isInteger(productData.stock)) {
      return res.status(400).json({
        success: false,
        message: '库存必须为整数',
      });
    }
  }

  // 5. 如果更新了价格或原价，重新计算折扣率
  if (productData.price !== undefined || productData.originalPrice !== undefined) {
    const price = productData.price || existingProduct.price;
    const originalPrice = productData.originalPrice || existingProduct.originalPrice;
    productData.discount = ((originalPrice - price) / originalPrice * 100).toFixed(2);
  }

  // 6. 检查是否有未完成的订单（如果更新价格或状态）
  if (productData.price !== undefined || productData.status !== undefined) {
    const hasPendingOrders = await db.checkPendingOrders(productId);
    if (hasPendingOrders && productData.status === 'inactive') {
      return res.status(400).json({
        success: false,
        message: '商品有未完成的订单，不能设置为下架状态',
      });
    }
  }

  // 7. 更新商品
  const updatedProduct = await db.updateProduct(productId, productData);

  // 8. 如果价格发生变化，记录价格历史
  if (productData.price !== undefined && productData.price !== existingProduct.price) {
    await db.recordPriceHistory(productId, productData.price, '价格调整');
    
    // 价格稳定性处理：记录价格变化率
    const priceChangeRate = ((productData.price - existingProduct.price) / existingProduct.price * 100).toFixed(2);
    console.log(`[价格更新] 商品 ${productId} 价格从 ${existingProduct.price} 变为 ${productData.price}，变化率 ${priceChangeRate}%`);
  }

  // 9. 如果更新了库存，同步更新 Redis 缓存
  if (productData.stock !== undefined) {
    const { cacheProductStock } = require('../database/redisStock');
    await cacheProductStock(productId, productData.stock);
    console.log(`[库存更新] 商品 ${productId} 库存已更新为 ${productData.stock}，Redis 缓存已同步`);
  }

  res.json({
    success: true,
    message: '商品更新成功',
    data: updatedProduct,
  });
});

/**
 * 删除商品
 * @route DELETE /api/products/:id
 */
const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.body;
  const productId = parseInt(id, 10);

  // 先获取商品信息，用于删除关联的文件
  const product = await db.findProductById(productId);

  if (!product) {
    return res.status(404).json({
      success: false,
      message: '商品不存在',
    });
  }

  // 解析商品图片和视频列表
  const images = product.images ? JSON.parse(product.images) : [];
  const videos = product.videos ? JSON.parse(product.videos) : [];

  // 删除所有关联的文件
  const filesToDelete = [...images, ...videos];
  if (filesToDelete.length > 0) {
    await deleteFiles(filesToDelete);
    console.log(`[删除商品] 已删除 ${filesToDelete.length} 个关联文件`);
  }

  // 删除商品
  const success = await db.deleteProduct(productId);

  res.json({
    success: true,
    message: '商品删除成功',
  });
});

/**
 * 更新商品库存
 * @route PATCH /api/products/:id/stock
 */
const updateProductStock = asyncHandler(async (req, res) => {
  const { id, stock } = req.body;
  const productId = parseInt(id, 10);

  // 查找商品
  const product = await db.findProductById(productId);
  if (!product) {
    return res.status(404).json({
      success: false,
      message: '商品不存在',
    });
  }

  // 更新库存
  const updatedProduct = await db.updateProduct(productId, { stock });

  res.json({
    success: true,
    message: '库存更新成功',
    data: updatedProduct,
  });
});

/**
 * 获取商品价格历史
 * @route GET /api/products/:id/price-history
 */
const getPriceHistory = asyncHandler(async (req, res) => {
  const { id, limit = 10 } = req.query;
  const productId = parseInt(id, 10);

  // 查找商品
  const product = await db.findProductById(productId);
  if (!product) {
    return res.status(404).json({
      success: false,
      message: '商品不存在',
    });
  }

  // 获取价格历史
  const history = await db.getPriceHistory(productId, parseInt(limit));

  res.json({
    success: true,
    data: {
      productId,
      productName: product.name,
      currentPrice: product.price,
      history
    },
  });
});

/**
 * 获取商品价格稳定性
 * @route GET /api/products/:id/price-stability
 */
const getPriceStability = asyncHandler(async (req, res) => {
  const { id, days = 30 } = req.query;
  const productId = parseInt(id, 10);

  // 查找商品
  const product = await db.findProductById(productId);
  if (!product) {
    return res.status(404).json({
      success: false,
      message: '商品不存在',
    });
  }

  // 获取价格稳定性
  const stability = await db.getPriceStability(productId, parseInt(days));

  res.json({
    success: true,
    data: {
      ...stability,
      productName: product.name
    },
  });
});

module.exports = {
  getProductList,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductStock,
  getPriceHistory,
  getPriceStability,
};