/**
 * 文件存储服务
 * 管理文件的上传、删除和访问
 */

const fs = require('fs');
const path = require('path');
const { uploadDir, imagesDir, videosDir } = require('../config/upload');

/**
 * 文件信息结构
 */
class FileInfo {
  constructor(filename, originalName, mimetype, size, url, type) {
    this.filename = filename;
    this.originalName = originalName;
    this.mimetype = mimetype;
    this.size = size;
    this.url = url;
    this.type = type; // 'image' or 'video'
  }
}

/**
 * 删除文件
 * @param {string} filename - 文件名
 * @returns {Promise<boolean>} - 是否删除成功
 */
async function deleteFile(filename) {
  return new Promise((resolve) => {
    const filePath = path.join(uploadDir, filename);
    
    if (!fs.existsSync(filePath)) {
      resolve(false);
      return;
    }
    
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('[文件删除] 删除失败:', err);
        resolve(false);
      } else {
        console.log('[文件删除] 已删除文件:', filename);
        resolve(true);
      }
    });
  });
}

/**
 * 批量删除文件
 * @param {Array<string>} filenames - 文件名数组
 * @returns {Promise<number>} - 成功删除的文件数量
 */
async function deleteFiles(filenames) {
  let deletedCount = 0;
  
  for (const filename of filenames) {
    const success = await deleteFile(filename);
    if (success) {
      deletedCount++;
    }
  }
  
  return deletedCount;
}

/**
 * 获取文件信息
 * @param {string} filename - 文件名
 * @returns {Promise<Object|null>} - 文件信息
 */
async function getFileInfo(filename) {
  return new Promise((resolve) => {
    const filePath = path.join(uploadDir, filename);
    
    if (!fs.existsSync(filePath)) {
      resolve(null);
      return;
    }
    
    fs.stat(filePath, (err, stats) => {
      if (err) {
        console.error('[文件信息] 获取失败:', err);
        resolve(null);
        return;
      }
      
      const extname = path.extname(filename).toLowerCase();
      const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(extname);
      const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm'].includes(extname);
      
      resolve({
        filename,
        size: stats.size,
        type: isImage ? 'image' : (isVideo ? 'video' : 'unknown'),
        extname,
        url: `/uploads/${filename}`,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      });
    });
  });
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} - 格式化后的文件大小
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 验证文件类型
 * @param {string} mimetype - MIME 类型
 * @returns {boolean} - 是否为支持的类型
 */
function isValidFileType(mimetype) {
  return mimetype.startsWith('image/') || mimetype.startsWith('video/');
}

/**
 * 验证文件扩展名
 * @param {string} filename - 文件名
 * @returns {boolean} - 是否为支持的扩展名
 */
function isValidFileExtension(filename) {
  const extname = path.extname(filename).toLowerCase();
  const allowedExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',  // 图片
    '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm'  // 视频
  ];
  
  return allowedExtensions.includes(extname);
}

/**
 * 处理上传的文件信息
 * @param {Object} file - multer 上传的文件对象
 * @returns {FileInfo} - 文件信息对象
 */
function processUploadedFile(file) {
  const extname = path.extname(file.originalname).toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(extname);
  
  return new FileInfo(
    file.filename,
    file.originalname,
    file.mimetype,
    file.size,
    `/uploads/${file.filename}`,
    isImage ? 'image' : 'video'
  );
}

/**
 * 清理空目录
 * @returns {Promise<number>} - 清理的目录数量
 */
async function cleanEmptyDirectories() {
  return new Promise((resolve) => {
    const directories = [uploadDir, imagesDir, videosDir];
    let cleanedCount = 0;
    
    directories.forEach(dir => {
      fs.readdir(dir, (err, files) => {
        if (!err && files.length === 0) {
          // 目录为空，可以删除（这里只是检查，不实际删除）
          console.log('[清理目录] 目录为空:', dir);
          cleanedCount++;
        }
      });
    });
    
    resolve(cleanedCount);
  });
}

/**
 * 获取存储统计信息
 * @returns {Promise<Object>} - 存储统计信息
 */
async function getStorageStats() {
  return new Promise((resolve) => {
    const stats = {
      images: { count: 0, size: 0 },
      videos: { count: 0, size: 0 },
      total: { count: 0, size: 0 }
    };
    
    // 统计图片
    fs.readdir(imagesDir, (err, files) => {
      if (err) {
        resolve(stats);
        return;
      }
      
      let pendingImages = files.length;
      
      if (pendingImages === 0) {
        // 没有图片，统计视频
        countVideos();
        return;
      }
      
      files.forEach(file => {
        const filePath = path.join(imagesDir, file);
        fs.stat(filePath, (err, fileStats) => {
          if (!err && fileStats.isFile()) {
            stats.images.count++;
            stats.images.size += fileStats.size;
            stats.total.count++;
            stats.total.size += fileStats.size;
          }
          
          pendingImages--;
          if (pendingImages === 0) {
            countVideos();
          }
        });
      });
    });
    
    function countVideos() {
      fs.readdir(videosDir, (err, files) => {
        if (err) {
          resolve(stats);
          return;
        }
        
        let pendingVideos = files.length;
        
        if (pendingVideos === 0) {
          resolve(stats);
          return;
        }
        
        files.forEach(file => {
          const filePath = path.join(videosDir, file);
          fs.stat(filePath, (err, fileStats) => {
            if (!err && fileStats.isFile()) {
              stats.videos.count++;
              stats.videos.size += fileStats.size;
              stats.total.count++;
              stats.total.size += fileStats.size;
            }
            
            pendingVideos--;
            if (pendingVideos === 0) {
              resolve(stats);
            }
          });
        });
      });
    }
  });
}

module.exports = {
  deleteFile,
  deleteFiles,
  getFileInfo,
  formatFileSize,
  isValidFileType,
  isValidFileExtension,
  processUploadedFile,
  cleanEmptyDirectories,
  getStorageStats,
  uploadDir,
  imagesDir,
  videosDir,
};