# 09-文件上传

## 📋 目录

- [概述](#概述)
- [文件上传功能](#文件上传功能)
- [文件上传配置](#文件上传配置)
- [文件存储](#文件存储)
- [文件访问](#文件访问)
- [大文件处理](#大文件处理)
- [最佳实践](#最佳实践)

## 概述

系统支持商品图片和视频上传，提供了完整的文件管理功能。

### 核心特性

- ✅ 支持图片和视频上传
- ✅ 支持大文件上传（最大 500MB）
- ✅ 文件类型验证
- ✅ 文件大小限制
- ✅ 自动生成唯一文件名
- ✅ 静态文件访问
- ✅ 文件信息查询

## 文件上传功能

### 上传方式

#### 方式一：创建商品时上传文件

**API 请求：**
```
POST /api/products/create-with-files
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: multipart/form-data
```

**表单字段：**
- `name` - 商品名称（必填）
- `description` - 商品描述（必填）
- `price` - 价格（必填）
- `originalPrice` - 原价（可选）
- `stock` - 库存（必填）
- `category` - 分类（必填）
- `status` - 状态（可选）
- `tags` - 标签（可选，JSON 字符串）
- `images` - 图片文件（可选，最多 10 张）
- `videos` - 视频文件（可选，最多 5 个）

**cURL 示例：**
```bash
curl -X POST http://localhost:3000/api/products/create-with-files \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "name=iPhone 15 Pro" \
  -F "description=最新款 iPhone" \
  -F "price=7999.00" \
  -F "originalPrice=8999.00" \
  -F "stock=100" \
  -F "category=electronics" \
  -F "status=active" \
  -F 'tags=["手机","苹果","5G"]' \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg" \
  -F "images=@/path/to/image3.jpg" \
  -F "videos=@/path/to/video1.mp4"
```

**响应示例：**
```json
{
  "success": true,
  "message": "商品创建成功",
  "data": {
    "id": 1,
    "name": "iPhone 15 Pro",
    "description": "最新款 iPhone",
    "price": 7999.00,
    "originalPrice": 8999.00,
    "discount": 11.11,
    "stock": 100,
    "frozenStock": 0,
    "category": "electronics",
    "status": "active",
    "images": [
      "/uploads/images-image-1711612800000-123456789.jpg",
      "/uploads/images-image-1711612800001-987654321.jpg",
      "/uploads/images-image-1711612800002-123456780.jpg"
    ],
    "videos": [
      "/uploads/videos-video-1711612800000-987654321.mp4"
    ],
    "mainImage": "/uploads/images-image-1711612800000-123456789.jpg",
    "uploadedFiles": [
      {
        "filename": "image-1711612800000-123456789.jpg",
        "originalName": "iphone15_pro_1.jpg",
        "mimetype": "image/jpeg",
        "size": 2048576,
        "url": "/uploads/images-image-1711612800000-123456789.jpg",
        "type": "image"
      },
      {
        "filename": "image-1711612800001-987654321.jpg",
        "originalName": "iphone15_pro_2.jpg",
        "mimetype": "image/jpeg",
        "size": 3072000,
        "url": "/uploads/images-image-1711612800001-987654321.jpg",
        "type": "image"
      },
      {
        "filename": "video-1711612800000-987654321.mp4",
        "originalName": "product_demo.mp4",
        "mimetype": "video/mp4",
        "size": 15728640,
        "url": "/uploads/videos-video-1711612800000-987654321.mp4",
        "type": "video"
      }
    ],
    "createdAt": "2026-03-28T10:00:00.000Z",
    "updatedAt": "2026-03-28T10:00:00.000Z"
  }
}
```

#### 方式二：先上传文件再创建商品

**步骤 1：上传文件**
```
POST /api/uploads/products
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: multipart/form-data
```

**步骤 2：使用文件 URL 创建商品**
```
POST /api/products/create
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "name": "iPhone 15 Pro",
  "description": "最新款 iPhone",
  "price": 7999.00,
  "stock": 100,
  "category": "electronics",
  "images": [
    "/uploads/images-image-1711612800000-123456789.jpg",
    "/uploads/images-image-1711612800001-987654321.jpg"
  ],
  "videos": [
    "/uploads/videos-video-1711612800000-987654321.mp4"
  ]
}
```

### 上传接口

#### 上传商品文件

**API 请求：**
```
POST /api/uploads/products
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: multipart/form-data
```

**表单字段：**
- `images` - 图片文件（可选，最多 10 张）
- `videos` - 视频文件（可选，最多 5 个）

**cURL 示例：**
```bash
# 上传图片
curl -X POST http://localhost:3000/api/uploads/products \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg"

# 上传视频
curl -X POST http://localhost:3000/api/uploads/products \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "videos=@/path/to/video1.mp4"
```

**响应示例：**
```json
{
  "success": true,
  "message": "文件上传成功",
  "data": [
    {
      "filename": "image-1711612800000-123456789.jpg",
      "originalName": "product_image_1.jpg",
      "mimetype": "image/jpeg",
      "size": 2048576,
      "url": "/uploads/images-image-1711612800000-123456789.jpg",
      "type": "image"
    },
    {
      "filename": "video-1711612800000-987654321.mp4",
      "originalName": "product_demo.mp4",
      "mimetype": "video/mp4",
      "size": 15728640,
      "url": "/uploads/videos-video-1711612800000-987654321.mp4",
      "type": "video"
    }
  ]
}
```

## 文件上传配置

### 支持的文件类型

**图片类型：**
| 格式 | MIME 类型 | 扩展名 |
|------|----------|--------|
| JPEG | image/jpeg | .jpg, .jpeg |
| PNG | image/png | .png |
| GIF | image/gif | .gif |
| WebP | image/webp | .webp |
| BMP | image/bmp | .bmp |

**视频类型：**
| 格式 | MIME 类型 | 扩展名 |
|------|----------|--------|
| MP4 | video/mp4 | .mp4 |
| MOV | video/quicktime | .mov |
| AVI | video/x-msvideo | .avi |
| MKV | video/x-matroska | .mkv |
| WMV | video/x-ms-wmv | .wmv |
| FLV | video/x-flv | .flv |
| WebM | video/webm | .webm |

### 文件大小限制

| 文件类型 | 大小限制 |
|---------|---------|
| 图片 | 最大 10MB |
| 视频 | 最大 500MB |
| 总大小 | 最大 500MB |

### 文件数量限制

| 文件类型 | 最大数量 |
|---------|---------|
| 图片 | 10 张 |
| 视频 | 5 个 |

## 文件存储

### 存储结构

```
uploads/
├── images/
│   ├── image-1711612800000-123456789.jpg
│   ├── image-1711612800001-987654321.png
│   └── ...
└── videos/
    ├── video-1711612800000-123456789.mp4
    ├── video-1711612800001-987654321.mov
    └── ...
```

### 文件命名规则

```
{field}-{timestamp}-{random}.{ext}

示例：
- image-1711612800000-123456789.jpg
- video-1711612800000-987654321.mp4
```

- `field` - 字段名（images 或 videos）
- `timestamp` - 时间戳（毫秒）
- `random` - 随机数（确保唯一性）
- `ext` - 原始文件扩展名

## 文件访问

### 静态文件访问

系统使用 Express 静态文件服务提供文件访问。

**访问方式：**
```
http://localhost:3000/uploads/{filename}
```

**示例：**
```
http://localhost:3000/uploads/images-image-1711612800000-123456789.jpg
http://localhost:3000/uploads/videos-video-1711612800000-987654321.mp4
```

### 文件信息接口

**API 请求：**
```
GET /api/uploads/info/:filename
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "filename": "image-1711612802800-123456789.jpg",
    "size": 2048576,
    "type": "image",
    "extname": ".jpg",
    "url": "/uploads/image-1711612802800-123456789.jpg",
    "createdAt": "2026-03-28T10:00:00.000Z",
    "modifiedAt": "2026-03-28T10:00:00.000Z"
  }
}
```

### 存储统计接口

**API 请求：**
```
GET /api/uploads/stats
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "images": {
      "count": 15,
      "size": 307200000
    },
    "videos": {
      "count": 3,
      "size": 157286400
    },
    "total": {
      "count": 18,
      "size": 464486400
    }
  }
}
```

## 大文件处理

### 大文件上传优化

**1. 文件大小验证**
- 前端验证：在上传前验证文件大小
- 后端验证：multer 配置中设置大小限制
- 超出限制时返回明确的错误信息

**2. 文件类型验证**
- 前端验证：检查文件扩展名和 MIME 类型
- 后端验证：multer 文件过滤器
- 不支持的文件类型拒绝上传

**3. 存储优化**
- 使用磁盘存储，避免内存溢出
- 支持大文件分片上传（可选）
- 定期清理临时文件

### 大文件上传流程

```
1. 前端选择文件
   ↓
2. 验证文件类型和大小
   ↓
3. 分片上传（如果启用）
   ↓
4. 服务器接收并验证
   ↓
5. 存储到磁盘
   ↓
6. 返回文件 URL
   ↓
7. 前端获取并使用文件 URL
```

## 最佳实践

### 前端实现

**图片预览：**
```javascript
// 上传前预览图片
const previewImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
};

// 验证文件大小
const validateFileSize = (file, maxSizeMB) => {
  const maxSize = maxSizeMB * 1024 * 1024;
  if (file.size > maxSize) {
    alert(`文件大小超过限制（最大 ${maxSizeMB}MB）`);
    return false;
  }
  return true;
};
```

**视频预览：**
```javascript
// 上传前预览视频
const previewVideo = (file) => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight
      });
    };
    video.src = URL.createObjectURL(file);
  });
};
```

**表单提交：**
```javascript
// 使用 FormData 上传文件
const uploadProduct = async (formData) => {
  try {
    const response = await fetch('/api/products/create-with-files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      body: formData
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('商品创建成功:', result.data);
      // 使用返回的文件 URL
      const productImages = result.data.images;
      const productVideos = result.data.videos;
    }
  } catch (error) {
    console.error('上传失败:', error);
  }
};
```

### 后端优化

**1. 文件验证**
- 严格验证文件类型和大小
- 使用安全的文件名生成
- 防止路径遍历攻击

**2. 错误处理**
- 提供清晰的错误信息
- 失败时清理已上传的文件
- 记录上传日志

**3. 安全考虑**
- 验证文件内容（不仅看扩展名）
- 扫描上传的文件（可选）
- 限制文件访问权限

**4. 性能优化**
- 使用磁盘存储，避免内存溢出
- 支持文件压缩（可选）
- 使用 CDN 分发（可选）

### 生产环境建议

**1. 使用对象存储服务**
- AWS S3
- 阿里云 OSS
- 腾讯云 COS

**2. 配置 CDN**
- 加速文件访问
- 减少服务器负载
- 提升用户体验

**3. 实现图片压缩**
- 压缩大图片以节省空间
- 生成缩略图
- 使用 WebP 格式

**4. 实现视频转码**
- 统一视频格式
- 压缩视频大小
- 生成多码率版本

---

*最后更新: 2026-03-28*