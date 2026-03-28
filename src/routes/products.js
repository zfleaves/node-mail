/**
 * 商品路由
 * 定义商品管理相关的 API 端点
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { validateBody, validateParams } = require('../middleware/validation');
const { uploadFiles } = require('../config/upload');
const {
  getProductList,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductStock,
  getPriceHistory,
  getPriceStability,
} = require('../controllers/productController');

/**
 * @route   GET /api/products
 * @desc    获取商品列表
 * @access  Private (需要 products:read 权限)
 */
router.get(
  '/',
  authenticate,
  requirePermission('products:read'),
  getProductList
);

/**
 * @route   GET /api/products/info
 * @desc    根据 ID 获取商品详情
 * @access  Private (需要 products:read 权限)
 */
router.get(
  '/info',
  authenticate,
  requirePermission('products:read'),
  getProductById
);

/**
 * @route   POST /api/products/create
 * @desc    创建新商品
 * @access  Private (需要 products:create 权限)
 */
router.post(
  '/create',
  authenticate,
  requirePermission('products:create'),
  validateBody({
    name: { required: true, validator: 'name', label: '商品名称' },
    price: { required: true, validator: 'price', label: '价格' },
    stock: { required: true, validator: 'stock', label: '库存' },
    category: { required: true, validator: 'name', label: '分类' },
    description: { required: true, validator: 'name', label: '描述' },
    status: { validator: 'productStatus', label: '状态' },
  }),
  createProduct
);

/**
 * @route   POST /api/products/create-with-files
 * @desc    创建商品并上传文件
 * @access  Private (需要 products:create 权限)
 */
router.post(
  '/create-with-files',
  authenticate,
  requirePermission('products:create'),
  uploadFiles.fields([
    { name: 'images', maxCount: 10 },  // 最多上传 10 张图片
    { name: 'videos', maxCount: 5 }    // 最多上传 5 个视频
  ]),
  createProduct
);

/**
 * @route   POST /api/products/update
 * @desc    更新商品信息
 * @access  Private (需要 products:update 权限)
 */
router.post(
  '/update',
  authenticate,
  requirePermission('products:update'),
  validateBody({
    id: { required: true, validator: 'name', label: '商品 ID' },
    name: { validator: 'name', label: '商品名称' },
    price: { validator: 'price', label: '价格' },
    stock: { validator: 'stock', label: '库存' },
    category: { validator: 'name', label: '分类' },
    description: { validator: 'name', label: '描述' },
    status: { validator: 'productStatus', label: '状态' },
  }),
  updateProduct
);

/**
 * @route   DELETE /api/products/delete
 * @desc    删除商品
 * @access  Private (需要 products:delete 权限)
 */
router.delete(
  '/delete',
  authenticate,
  requirePermission('products:delete'),
  validateBody({
    id: { required: true, validator: 'name', label: '商品 ID' },
  }),
  deleteProduct
);

/**
 * @route   PATCH /api/products/stock
 * @desc    更新商品库存
 * @access  Private (需要 products:update 权限)
 */
router.patch(
  '/stock',
  authenticate,
  requirePermission('products:update'),
  validateBody({
    id: { required: true, validator: 'name', label: '商品 ID' },
    stock: { required: true, validator: 'stock', label: '库存' },
  }),
  updateProductStock
);

/**
 * @route   GET /api/products/price-history
 * @desc    获取商品价格历史
 * @access  Private (需要 products:read 权限)
 */
router.get(
  '/price-history',
  authenticate,
  requirePermission('products:read'),
  getPriceHistory
);

/**
 * @route   GET /api/products/price-stability
 * @desc    获取商品价格稳定性
 * @access  Private (需要 products:read 权限)
 */
router.get(
  '/price-stability',
  authenticate,
  requirePermission('products:read'),
  getPriceStability
);

module.exports = router;