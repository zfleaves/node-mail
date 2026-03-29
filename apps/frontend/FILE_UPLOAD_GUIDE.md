# 前端文件上传使用指南

## 📋 概述

本指南介绍如何在前端使用 base64 方式上传文件到后端数据库。

## 🎯 特点

- ✅ 前端将文件转换为 base64
- ✅ 通过 JSON 格式发送数据
- ✅ 不使用 FormData
- ✅ 前端决定文件类型（图片/视频）
- ✅ 后端将 base64 数据存储到数据库

## 📦 API 接口

### 1. 上传单个文件

**接口：** `POST /api/uploads/base64`

**请求体：**
```typescript
{
  filename: string      // 文件名
  mimeType: string      // MIME 类型（如：image/jpeg, video/mp4）
  data: string          // base64 数据（格式：data:image/jpeg;base64,...）
  type: 'image' | 'video'  // 文件类型
}
```

**响应：**
```typescript
{
  success: true
  message: "文件上传成功"
  data: {
    id: string           // 文件 ID
    filename: string     // 文件名
    originalName: string // 原始文件名
    mimeType: string     // MIME 类型
    size: number         // 文件大小
    url: string          // 文件访问 URL
    type: 'image' | 'video'
    createdAt: string    // 创建时间
  }
}
```

### 2. 批量上传文件

**接口：** `POST /api/uploads/base64/batch`

**请求体：**
```typescript
{
  files: [
    {
      filename: string
      mimeType: string
      data: string
      type: 'image' | 'video'
    }
  ]
}
```

**响应：**
```typescript
{
  success: true
  message: "成功上传 X 个文件，失败 Y 个"
  data: {
    uploaded: [
      {
        id: string
        filename: string
        // ... 其他字段
      }
    ]
    failed: [
      {
        index: number
        error: string
      }
    ]
  }
}
```

### 3. 获取文件数据

**接口：** `GET /api/uploads/file/:id`

**响应：**
```typescript
{
  success: true
  data: {
    id: string
    filename: string
    mimeType: string
    data: string  // base64 数据
  }
}
```

### 4. 删除文件

**接口：** `DELETE /api/uploads/file/:id`

**响应：**
```typescript
{
  success: true
  message: "文件删除成功"
}
```

## 🛠️ 前端实现

### 安装工具函数

文件位置：`src/api/uploads.ts`

```typescript
import {
  uploadFile,
  uploadFiles,
  getFileData,
  deleteFile
} from '../api/uploads'
```

### 使用示例

#### 1. 上传单个文件

```typescript
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { uploadFile } from '../api/uploads'

const selectedFile = ref<File | null>(null)

// 选择文件
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    selectedFile.value = target.files[0]
  }
}

// 上传文件
const handleUpload = async () => {
  if (!selectedFile.value) {
    ElMessage.warning('请先选择文件')
    return
  }

  try {
    const result = await uploadFile(selectedFile.value)
    ElMessage.success('上传成功')
    console.log('文件 ID:', result.id)
    console.log('文件 URL:', result.url)
  } catch (error) {
    console.error('上传失败:', error)
    ElMessage.error('上传失败')
  }
}
```

#### 2. 批量上传文件

```typescript
import { uploadFiles } from '../api/uploads'

const files = ref<File[]>([])

// 批量上传
const handleBatchUpload = async () => {
  if (files.value.length === 0) {
    ElMessage.warning('请先选择文件')
    return
  }

  try {
    const result = await uploadFiles(files.value)
    console.log('成功上传:', result.uploaded.length)
    console.log('失败:', result.failed.length)
    
    result.uploaded.forEach(file => {
      console.log('文件 ID:', file.id)
      console.log('文件 URL:', file.url)
    })
  } catch (error) {
    console.error('批量上传失败:', error)
  }
}
```

#### 3. 在商品创建中使用

```typescript
import { uploadFiles } from '../api/uploads'

const createProductWithFiles = async () => {
  // 1. 上传图片
  const imageFiles = selectedImages.value
  const imageResult = await uploadFiles(imageFiles)
  
  // 2. 上传视频
  const videoFiles = selectedVideos.value
  const videoResult = await uploadFiles(videoFiles)
  
  // 3. 创建商品（使用返回的文件 URL）
  const productData = {
    name: productName.value,
    description: description.value,
    price: price.value,
    stock: stock.value,
    category: category.value,
    images: imageResult.uploaded.map(file => file.url),
    videos: videoResult.uploaded.map(file => file.url)
  }
  
  // 4. 创建商品
  await createProduct(productData)
}
```

#### 4. 预览文件

```typescript
import { getFileData } from '../api/uploads'

const previewFile = async (fileId: string) => {
  try {
    const fileData = await getFileData(fileId)
    // 使用 base64 数据显示图片或视频
    if (fileData.mimeType.startsWith('image/')) {
      // 显示图片
      const imgElement = document.getElementById('preview-img') as HTMLImageElement
      imgElement.src = fileData.data
    } else if (fileData.mimeType.startsWith('video/')) {
      // 显示视频
      const videoElement = document.getElementById('preview-video') as HTMLVideoElement
      videoElement.src = fileData.data
    }
  } catch (error) {
    console.error('获取文件数据失败:', error)
  }
}
```

## 🎨 UI 组件示例

### 使用 Element Plus 上传组件

```vue
<template>
  <el-upload
    :auto-upload="false"
    :on-change="handleFileChange"
    multiple
    accept="image/*,video/*"
  >
    <el-button type="primary">选择文件</el-button>
  </el-upload>
  
  <el-button type="success" @click="handleUpload" :loading="uploading">
    上传
  </el-button>
  
  <!-- 显示上传的文件 -->
  <div v-for="file in uploadedFiles" :key="file.id">
    <img v-if="file.type === 'image'" :src="getFileUrl(file.id)" style="max-width: 200px" />
    <video v-if="file.type === 'video'" :src="getFileUrl(file.id)" style="max-width: 200px" controls />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { uploadFiles } from '../api/uploads'
import type { UploadedFile } from '../api/uploads'

const selectedFiles = ref<File[]>([])
const uploadedFiles = ref<UploadedFile[]>([])
const uploading = ref(false)

const handleFileChange = (file: UploadFile) => {
  if (file.raw) {
    selectedFiles.value.push(file.raw)
  }
}

const handleUpload = async () => {
  if (selectedFiles.value.length === 0) {
    ElMessage.warning('请先选择文件')
    return
  }

  uploading.value = true
  try {
    const result = await uploadFiles(selectedFiles.value)
    uploadedFiles.value = result.uploaded
    ElMessage.success(`成功上传 ${result.uploaded.length} 个文件`)
    selectedFiles.value = []
  } catch (error) {
    console.error('上传失败:', error)
    ElMessage.error('上传失败')
  } finally {
    uploading.value = false
  }
}

const getFileUrl = (fileId: string) => {
  return `/api/uploads/file/${fileId}`
}
</script>
```

## 📊 数据流程

```
1. 用户选择文件
   ↓
2. 前端转换为 base64
   ↓
3. 构建请求数据（JSON）
   ↓
4. 发送到后端 API
   ↓
5. 后端存储到数据库
   ↓
6. 返回文件 ID 和 URL
   ↓
7. 前端获取并显示
```

## 🔍 注意事项

1. **文件大小限制**
   - 图片：最大 10MB
   - 视频：最大 500MB

2. **base64 数据大小**
   - base64 编码会使数据增大约 33%
   - 建议大文件使用分片上传或直接上传 FormData

3. **性能考虑**
   - 转换大量文件为 base64 可能影响性能
   - 建议限制同时上传的文件数量

4. **错误处理**
   - 处理网络错误
   - 处理文件类型错误
   - 处理文件大小超限

## 🚀 优势

1. **灵活性高**：前端完全控制上传流程
2. **类型安全**：TypeScript 完整类型支持
3. **易于调试**：可以直接查看 base64 数据
4. **无需中间件**：不依赖 FormData
5. **易于集成**：可以轻松集成到任何表单

## 📚 相关文件

- `apps/backend/controllers/uploadBase64Controller.js` - 后端控制器
- `apps/backend/routes/uploads.js` - 后端路由
- `apps/frontend/src/api/uploads.ts` - 前端 API 工具
- `apps/frontend/src/views/FileUploadDemo.vue` - 示例组件

---

*最后更新: 2026-03-28*