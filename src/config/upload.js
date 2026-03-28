/**
 * 文件上传配置
 * 配置 multer 中间件，支持图片和视频上传
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../uploads');
const imagesDir = path.join(uploadDir, 'images');
const videosDir = path.join(uploadDir, 'videos');

[uploadDir, imagesDir, videosDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * 文件存储配置
 */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 根据文件类型选择存储目录
    if (file.mimetype.startsWith('image/')) {
      cb(null, imagesDir);
    } else if (file.mimetype.startsWith('video/')) {
      cb(null, videosDir);
    } else {
      cb(new Error('不支持的文件类型'), null);
    }
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名：时间戳 + 随机数 + 原始扩展名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

/**
 * 文件过滤器
 */
const fileFilter = (req, file, cb) => {
  // 允许的图片类型
  const allowedImageTypes = /jpeg|jpg|png|gif|webp|bmp/;
  // 允许的视频类型
  const allowedVideoTypes = /mp4|mov|avi|mkv|wmv|flv|webm/;

  const extname = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype;

  if (mimetype.startsWith('image/')) {
    if (allowedImageTypes.test(extname.replace('.', ''))) {
      cb(null, true);
    } else {
      cb(new Error('只支持 jpeg, jpg, png, gif, webp, bmp 格式的图片'), false);
    }
  } else if (mimetype.startsWith('video/')) {
    if (allowedVideoTypes.test(extname.replace('.', ''))) {
      cb(null, true);
    } else {
      cb(new Error('只支持 mp4, mov, avi, mkv, wmv, flv, webm 格式的视频'), false);
    }
  } else {
    cb(new Error('只支持图片和视频文件'), false);
  }
};

/**
 * 图片上传配置
 */
const uploadImage = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: fileFilter,
});

/**
 * 视频上传配置
 */
const uploadVideo = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
  fileFilter: fileFilter,
});

/**
 * 混合上传配置（图片 + 视频）
 */
const uploadFiles = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
  fileFilter: fileFilter,
});

/**
 * 文件大小验证中间件
 */
const validateFileSize = (maxSizeMB) => {
  return (req, res, next) => {
    const maxSize = maxSizeMB * 1024 * 1024;
    
    // 检查所有上传的文件
    if (req.files) {
      const files = Object.values(req.files).flat();
      for (const file of files) {
        if (file.size > maxSize) {
          return res.status(400).json({
            success: false,
            message: `文件 ${file.originalname} 大小超过限制（最大 ${maxSizeMB}MB）`,
          });
        }
      }
    }
    
    next();
  };
};

module.exports = {
  uploadImage,
  uploadVideo,
  uploadFiles,
  validateFileSize,
  uploadDir,
  imagesDir,
  videosDir,
};