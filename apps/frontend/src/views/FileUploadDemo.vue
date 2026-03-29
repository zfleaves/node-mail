<template>
  <div class="file-upload-demo">
    <el-card>
      <template #header>
        <span>文件上传示例（Base64 方式）</span>
      </template>

      <!-- 单个文件上传 -->
      <div class="upload-section">
        <h4>单个文件上传</h4>
        <el-upload
          ref="singleUploadRef"
          :auto-upload="false"
          :on-change="handleSingleFileChange"
          :limit="1"
          accept="image/*,video/*"
        >
          <el-button type="primary">选择文件</el-button>
        </el-upload>
        <el-button type="success" @click="uploadSingleFile" :loading="uploading">
          上传单个文件
        </el-button>
        <div v-if="singleUploadedFile" class="file-result">
          <p>上传成功：</p>
          <p>ID: {{ singleUploadedFile.id }}</p>
          <p>文件名: {{ singleUploadedFile.filename }}</p>
          <p>原始文件名: {{ singleUploadedFile.originalName }}</p>
          <p>MIME类型: {{ singleUploadedFile.mimeType }}</p>
          <p>文件大小: {{ formatFileSize(singleUploadedFile.size) }}</p>
          <p>访问URL: {{ singleUploadedFile.url }}</p>
          <!-- 直接使用返回的 base64 数据显示图片 -->
          <img v-if="singleUploadedFile.type === 'image'" :src="singleUploadedFile.data" style="max-width: 200px; margin-top: 10px" />
          <!-- 直接使用返回的 base64 数据显示视频 -->
          <video v-if="singleUploadedFile.type === 'video'" :src="singleUploadedFile.data" style="max-width: 200px; margin-top: 10px" controls />
        </div>
      </div>

      <!-- 批量文件上传 -->
      <div class="upload-section">
        <h4>批量文件上传</h4>
        <el-upload
          ref="batchUploadRef"
          :auto-upload="false"
          :on-change="handleBatchFilesChange"
          multiple
          accept="image/*,video/*"
        >
          <el-button type="primary">选择多个文件</el-button>
        </el-upload>
        <el-button type="success" @click="uploadBatchFiles" :loading="uploading">
          批量上传
        </el-button>
        <div v-if="batchUploadResult" class="file-result">
          <p>成功上传 {{ batchUploadResult.uploaded.length }} 个文件</p>
          <p v-if="batchUploadResult.failed.length > 0">
            失败 {{ batchUploadResult.failed.length }} 个文件
          </p>
          <div class="file-list">
            <div v-for="file in batchUploadResult.uploaded" :key="file.id" class="file-item">
              <p>{{ file.filename }} ({{ formatFileSize(file.size) }})</p>
              <!-- 直接使用返回的 base64 数据显示图片 -->
              <img v-if="file.type === 'image'" :src="file.data" style="max-width: 100px; margin: 5px" />
              <!-- 直接使用返回的 base64 数据显示视频 -->
              <video v-if="file.type === 'video'" :src="file.data" style="max-width: 100px; margin: 5px" controls />
            </div>
          </div>
        </div>
      </div>

      <!-- 拖拽上传 -->
      <div class="upload-section">
        <h4>拖拽上传</h4>
        <div
          class="drop-zone"
          @drop.prevent="handleDrop"
          @dragover.prevent
          @dragleave.prevent
        >
          <p>拖拽文件到此处</p>
        </div>
        <div v-if="droppedFiles.length > 0" class="dropped-files">
          <p>已选择 {{ droppedFiles.length }} 个文件</p>
          <el-button type="success" @click="uploadDroppedFiles" :loading="uploading">
            上传拖拽的文件
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { UploadFile, UploadInstance } from 'element-plus'
import {
  uploadFile,
  uploadFiles
} from '../api/uploads'
import type { UploadedFile, UploadResult } from '../api/uploads'

const singleUploadRef = ref<UploadInstance>()
const batchUploadRef = ref<UploadInstance>()
const uploading = ref(false)
const singleFile = ref<File | null>(null)
const singleUploadedFile = ref<UploadedFile | null>(null)
const batchFiles = ref<File[]>([])
const batchUploadResult = ref<UploadResult | null>(null)
const droppedFiles = ref<File[]>([])

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// 单个文件选择
const handleSingleFileChange = (file: UploadFile) => {
  if (file.raw) {
    singleFile.value = file.raw
  }
}

// 上传单个文件
const uploadSingleFile = async () => {
  if (!singleFile.value) {
    ElMessage.warning('请先选择文件')
    return
  }

  uploading.value = true
  try {
    const result = await uploadFile(singleFile.value)
    singleUploadedFile.value = result
    ElMessage.success('文件上传成功')
    singleUploadRef.value?.clearFiles()
  } catch (error) {
    console.error('上传失败:', error)
    ElMessage.error('文件上传失败')
  } finally {
    uploading.value = false
  }
}

// 批量文件选择
const handleBatchFilesChange = (file: UploadFile) => {
  if (file.raw) {
    batchFiles.value.push(file.raw)
  }
}

// 批量上传
const uploadBatchFiles = async () => {
  if (batchFiles.value.length === 0) {
    ElMessage.warning('请先选择文件')
    return
  }

  uploading.value = true
  try {
    const result = await uploadFiles(batchFiles.value)
    batchUploadResult.value = result
    ElMessage.success(`成功上传 ${result.uploaded.length} 个文件`)
    if (result.failed.length > 0) {
      ElMessage.warning(`${result.failed.length} 个文件上传失败`)
    }
    batchUploadRef.value?.clearFiles()
    batchFiles.value = []
  } catch (error) {
    console.error('批量上传失败:', error)
    ElMessage.error('批量上传失败')
  } finally {
    uploading.value = false
  }
}

// 拖拽文件
const handleDrop = (event: DragEvent) => {
  const files = event.dataTransfer?.files
  if (files) {
    droppedFiles.value = Array.from(files)
  }
}

// 上传拖拽的文件
const uploadDroppedFiles = async () => {
  if (droppedFiles.value.length === 0) {
    ElMessage.warning('请先拖拽文件')
    return
  }

  uploading.value = true
  try {
    const result = await uploadFiles(droppedFiles.value)
    batchUploadResult.value = result
    ElMessage.success(`成功上传 ${result.uploaded.length} 个文件`)
    droppedFiles.value = []
  } catch (error) {
    console.error('上传失败:', error)
    ElMessage.error('上传失败')
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.file-upload-demo {
  padding: 20px;
}

.upload-section {
  margin-bottom: 30px;
  padding: 20px;
  border: 1px solid #e6e6e6;
  border-radius: 4px;
}

.upload-section h4 {
  margin-bottom: 15px;
  color: #333;
}

.file-result {
  margin-top: 15px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.file-result p {
  margin: 5px 0;
  color: #666;
}

.drop-zone {
  width: 100%;
  height: 150px;
  border: 2px dashed #d9d9d9;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #fafafa;
  transition: all 0.3s;
}

.drop-zone:hover {
  border-color: #409eff;
  background-color: #ecf5ff;
}

.dropped-files {
  margin-top: 15px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.file-list {
  margin-top: 10px;
  max-height: 400px;
  overflow-y: auto;
}

.file-item {
  padding: 10px;
  margin-bottom: 10px;
  background-color: white;
  border: 1px solid #e6e6e6;
  border-radius: 4px;
}

.file-item p {
  margin: 5px 0;
  font-size: 14px;
  color: #666;
}
</style>