/**
 * 上传文件到数据库（base64 方式）
 * 前端直接上传文件的 base64 数据，后端存储到数据库
 */

const db = require('../database/dataAccess');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 上传单个文件并返回文件信息
 * 前端发送 base64 编码的文件数据
 * @route POST /api/uploads/base64
 */
const uploadBase64 = asyncHandler(async (req, res) => {
  const { filename, mimeType, data, type } = req.body;

  // 参数验证
  if (!filename || !mimeType || !data || !type) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数：filename, mimeType, data, type',
    });
  }

  // 验证文件类型
  const validTypes = ['image', 'video'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      message: '文件类型必须是 image 或 video',
    });
  }

  // 验证 base64 数据格式
  if (!data.startsWith('data:')) {
    return res.status(400).json({
      success: false,
      message: '数据必须是 base64 格式（data:image/xxx;base64,...）',
    });
  }

  // 生成唯一 ID
  const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 构建文件信息
  const fileData = {
    id: fileId,
    filename: filename,
    originalName: filename,
    mimeType: mimeType,
    type: type,
    data: data, // 存储 base64 数据
    size: data.length, // base64 字符串长度
    createdAt: new Date().toISOString(),
  };

  // 存储到数据库
  try {
    await db.query(
      `INSERT INTO uploaded_files (id, filename, mime_type, type, data, size, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [fileData.id, fileData.filename, fileData.mimeType, fileData.type, fileData.data, fileData.size]
    );

    res.json({
      success: true,
      message: '文件上传成功',
      data: {
        id: fileData.id,
        filename: fileData.filename,
        originalName: fileData.originalName,
        mimeType: fileData.mimeType,
        size: fileData.size,
        url: `${req.protocol}://${req.get('host')}/api/uploads/file/${fileData.id}`,
        type: fileData.type,
        createdAt: fileData.createdAt,
      },
    });
  } catch (error) {
    console.error('[上传文件] 数据库保存失败:', error);
    
    // 如果表不存在，创建表
    if (error.code === 'ER_NO_SUCH_TABLE') {
      await createUploadedFilesTable();
      // 重试插入
      await db.query(
        `INSERT INTO uploaded_files (id, filename, mime_type, type, data, size, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [fileData.id, fileData.filename, fileData.mimeType, fileData.type, fileData.data, fileData.size]
      );

      res.json({
        success: true,
        message: '文件上传成功',
        data: {
          id: fileData.id,
          filename: fileData.filename,
          originalName: fileData.originalName,
          mimeType: fileData.mimeType,
          size: fileData.size,
          url: `${req.protocol}://${req.get('host')}/api/uploads/file/${fileData.id}`,
          type: fileData.type,
          createdAt: fileData.createdAt,
        },
      });
    } else {
      throw error;
    }
  }
});

/**
 * 批量上传文件
 * @route POST /api/uploads/base64/batch
 */
const uploadBase64Batch = asyncHandler(async (req, res) => {
  const { files } = req.body;

  // 参数验证
  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({
      success: false,
      message: '请提供文件数组',
    });
  }

  const uploadedFiles = [];
  const errors = [];

  // 处理每个文件
  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (!file.filename || !file.mimeType || !file.data || !file.type) {
      errors.push({
        index: i,
        error: '缺少必要参数：filename, mimeType, data, type',
      });
      continue;
    }

    // 验证文件类型
    const validTypes = ['image', 'video'];
    if (!validTypes.includes(file.type)) {
      errors.push({
        index: i,
        error: '文件类型必须是 image 或 video',
      });
      continue;
    }

    // 验证 base64 数据格式
    if (!file.data.startsWith('data:')) {
      errors.push({
        index: i,
        error: '数据必须是 base64 格式',
      });
      continue;
    }

    // 生成唯一 ID
    const fileId = `file_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;

    // 构建 JSON 数组格式的数据
    const fileData = {
      id: fileId,
      filename: file.filename,
      originalName: file.filename,
      mimeType: file.mimeType,
      type: file.type,
      data: file.data,
      size: file.data.length,
      createdAt: new Date().toISOString(),
    };

    try {
      await db.query(
        `INSERT INTO uploaded_files (id, filename, mime_type, type, data, size, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [fileData.id, fileData.filename, fileData.mimeType, fileData.type, fileData.data, fileData.size]
      );

      uploadedFiles.push({
        id: fileData.id,
        filename: fileData.filename,
        originalName: fileData.originalName,
        mimeType: fileData.mimeType,
        size: fileData.size,
        url: `${req.protocol}://${req.get('host')}/api/uploads/file/${fileData.id}`,
        type: fileData.type,
        createdAt: fileData.createdAt,
      });
    } catch (error) {
      console.error('[批量上传] 文件保存失败:', error);
      errors.push({
        index: i,
        error: error.message,
      });
    }
  }

  res.json({
    success: true,
    message: `成功上传 ${uploadedFiles.length} 个文件，失败 ${errors.length} 个`,
    data: {
      uploaded: uploadedFiles,
      failed: errors,
    },
  });
});

/**
 * 获取文件信息
 * @route GET /api/uploads/file/:id/info
 */
const getFileInfo = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await db.query(
    `SELECT id, filename, mime_type, type, size, created_at 
     FROM uploaded_files 
     WHERE id = ?`,
    [id]
  );

  if (result.length === 0) {
    return res.status(404).json({
      success: false,
      message: '文件不存在',
    });
  }

  res.json({
    success: true,
    data: {
      ...result[0],
      url: `${req.protocol}://${req.get('host')}/api/uploads/file/${result[0].id}`,
    },
  });
});

/**
 * 获取文件数据（base64）
 * @route GET /api/uploads/file/:id
 */
const getFileData = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await db.query(
    `SELECT data, mime_type, filename 
     FROM uploaded_files 
     WHERE id = ?`,
    [id]
  );

  if (result.length === 0) {
    return res.status(404).json({
      success: false,
      message: '文件不存在',
    });
  }

  const file = result[0];

  res.json({
    success: true,
    data: {
      id: id,
      filename: file.filename,
      mimeType: file.mime_type,
      data: file.data, // base64 数据
    },
  });
});

/**
 * 删除文件
 * @route DELETE /api/uploads/file/:id
 */
const deleteFile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await db.query(
    `DELETE FROM uploaded_files WHERE id = ?`,
    [id]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({
      success: false,
      message: '文件不存在',
    });
  }

  res.json({
    success: true,
    message: '文件删除成功',
  });
});

/**
 * 创建上传文件表
 */
async function createUploadedFilesTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS uploaded_files (
      id VARCHAR(100) PRIMARY KEY COMMENT '文件ID',
      filename VARCHAR(255) NOT NULL COMMENT '文件名',
      mime_type VARCHAR(100) NOT NULL COMMENT 'MIME类型',
      type ENUM('image', 'video') NOT NULL COMMENT '文件类型',
      data TEXT NOT NULL COMMENT 'base64数据',
      size INT NOT NULL COMMENT '数据大小',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      INDEX idx_type (type),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='上传文件表';
  `;

  await db.query(sql);
  console.log('✅ 上传文件表创建成功');
}

module.exports = {
  uploadBase64,
  uploadBase64Batch,
  getFileInfo,
  getFileData,
  deleteFile,
  createUploadedFilesTable,
};