/**
 * 文件上传和访问路由
 * 提供文件上传和访问的 API 端点
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { uploadFiles } = require('../config/upload');
const { getFileInfo, getStorageStats } = require('../services/fileService');
const path = require('path');
const { uploadDir } = require('../config/upload');
const {
  uploadBase64,
  uploadBase64Batch,
  getFileInfo: getFileBase64Info,
  getFileData,
  deleteFile
} = require('../controllers/uploadBase64Controller');

/**
 * @route   POST /api/uploads/base64
 * @desc    上传单个文件（base64 方式）
 * @access  Private (需要 uploads:create 权限)
 */
router.post(
  '/base64',
  authenticate,
  requirePermission('uploads:create'),
  uploadBase64
);

/**
 * @route   POST /api/uploads/base64/batch
 * @desc    批量上传文件（base64 方式）
 * @access  Private (需要 uploads:create 权限)
 */
router.post(
  '/base64/batch',
  authenticate,
  requirePermission('uploads:create'),
  uploadBase64Batch
);

/**
 * @route   GET /api/uploads/file/:id
 * @desc    获取文件数据（base64）
 * @access  Public
 */
router.get('/file/:id', getFileData);

/**
 * @route   GET /api/uploads/file/:id/info
 * @desc    获取文件信息
 * @access  Private (需要 uploads:read 权限)
 */
router.get(
  '/file/:id/info',
  authenticate,
  requirePermission('uploads:read'),
  getFileBase64Info
);

/**
 * @route   DELETE /api/uploads/file/:id
 * @desc    删除文件
 * @access  Private (需要 uploads:delete 权限)
 */
router.delete(
  '/file/:id',
  authenticate,
  requirePermission('uploads:delete'),
  deleteFile
);

/**
 * @route   POST /api/uploads/products
 * @desc    上传商品图片和视频（FormData 方式）
 * @access  Private (需要 products:create 权限)
 */
router.post(
  '/products',
  authenticate,
  requirePermission('products:create'),
  uploadFiles.fields([
    { name: 'images', maxCount: 10 },  // 最多上传 10 张图片
    { name: 'videos', maxCount: 5 }    // 最多上传 5 个视频
  ]),
  async (req, res) => {
    try {
      const uploadedFiles = [];
      
      // 处理图片
      if (req.files.images) {
        const imageFiles = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
        for (const file of imageFiles) {
          uploadedFiles.push({
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            url: `/uploads/${file.filename}`,
            type: 'image'
          });
        }
      }
      
      // 处理视频
      if (req.files.videos) {
        const videoFiles = Array.isArray(req.files.videos) ? req.files.videos : [req.files.videos];
        for (const file of videoFiles) {
          uploadedFiles.push({
            filename: file.filename,
            originalName: file.originalName,
            mimetype: file.mimetype,
            size: file.size,
            url: `/uploads/${file.filename}`,
            type: 'video'
          });
        }
      }
      
      res.json({
        success: true,
        message: '文件上传成功',
        data: uploadedFiles,
      });
    } catch (error) {
      console.error('[文件上传] 上传失败:', error);
      res.status(500).json({
        success: false,
        message: '文件上传失败',
        error: error.message,
      });
    }
  }
);

/**
 * @route   GET /api/uploads/stats
 * @desc    获取存储统计信息
 * @access  Private (需要 uploads:read 权限)
 */
router.get(
  '/stats',
  authenticate,
  requirePermission('uploads:read'),
  async (req, res) => {
    try {
      const stats = await getStorageStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('[存储统计] 查询失败:', error);
      res.status(500).json({
        success: false,
        message: '查询存储统计失败',
      });
    }
  }
);

/**
 * @route   GET /api/uploads/info/:filename
 * @desc    获取文件信息
 * @access  Private (需要 uploads:read 权限)
 */
router.get(
  '/info/:filename',
  authenticate,
  requirePermission('uploads:read'),
  async (req, res) => {
    try {
      const filename = req.params.filename;
      const fileInfo = await getFileInfo(filename);

      if (!fileInfo) {
        return res.status(404).json({
          success: false,
          message: '文件不存在',
        });
      }

      res.json({
        success: true,
        data: fileInfo,
      });
    } catch (error) {
      console.error('[文件信息] 查询失败:', error);
      res.status(500).json({
        success: false,
        message: '查询文件信息失败',
      });
    }
  }
);

/**
 * @route   GET /api/uploads/:filename
 * @desc    访问上传的文件
 * @access  Public
 */
router.get('/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadDir, filename);

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('[文件访问] 文件不存在:', filename);
      res.status(404).json({
        success: false,
        message: '文件不存在',
      });
    }
  });
});

module.exports = router;