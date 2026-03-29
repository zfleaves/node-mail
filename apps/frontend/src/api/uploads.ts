/**
 * 文件上传工具
 * 将文件转换为 base64 并上传到后端
 */

import api from './index'

export interface UploadFile {
  filename: string
  mimeType: string
  data: string // base64 数据
  type: 'image' | 'video'
}

export interface UploadedFile {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
  data: string // base64 数据
  type: 'image' | 'video'
  createdAt: string
}

export interface UploadResult {
  uploaded: UploadedFile[]
  failed: Array<{
    index: number
    error: string
  }>
}

/**
 * 将文件转换为 base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 获取文件类型
 */
export function getFileType(file: File): 'image' | 'video' | 'other' {
  if (file.type.startsWith('image/')) {
    return 'image'
  } else if (file.type.startsWith('video/')) {
    return 'video'
  }
  return 'other'
}

/**
 * 验证文件大小
 */
export function validateFileSize(file: File, maxSizeMB: number = 10): boolean {
  const maxSize = maxSizeMB * 1024 * 1024
  return file.size <= maxSize
}

/**
 * 上传单个文件
 */
export async function uploadFile(file: File): Promise<UploadedFile> {
  // 转换为 base64
  const data = await fileToBase64(file)
  
  // 确定文件类型
  const fileType = getFileType(file)
  if (fileType === 'other') {
    throw new Error('不支持的文件类型，仅支持图片和视频')
  }

  // 构建上传数据
  const uploadData: UploadFile = {
    filename: file.name,
    mimeType: file.type,
    data,
    type: fileType
  }

  // 发送到后端，返回 { success: true, data: UploadedFile }
  const response = await api.post<{ success: boolean; data: UploadedFile }>('/uploads/base64', uploadData)
  
  // 提取实际的数据部分
  return (response as any).data
}

/**
 * 批量上传文件
 */
export async function uploadFiles(files: File[]): Promise<UploadResult> {
  // 转换所有文件为 base64
  const uploadDataArray: UploadFile[] = []
  const errors: Array<{ index: number; error: string }> = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    try {
      // 验证文件类型
      const fileType = getFileType(file)
      if (fileType === 'other') {
        errors.push({ index: i, error: '不支持的文件类型' })
        continue
      }

      // 转换为 base64
      const data = await fileToBase64(file)

      uploadDataArray.push({
        filename: file.name,
        mimeType: file.type,
        data,
        type: fileType
      })
    } catch (error) {
      errors.push({
        index: i,
        error: error instanceof Error ? error.message : '未知错误'
      })
    }
  }

  // 批量上传，返回 { success: true, data: UploadResult }
  const response = await api.post<{ success: boolean; data: UploadResult }>('/uploads/base64/batch', {
    files: uploadDataArray
  })

  // 提取实际的数据部分
  return (response as any).data
}

/**
 * 获取文件数据（base64）
 */
export async function getFileData(fileId: string): Promise<{
  id: string
  filename: string
  mimeType: string
  data: string
}> {
  return api.get(`/uploads/file/${fileId}`)
}

/**
 * 删除文件
 */
export async function deleteFile(fileId: string): Promise<void> {
  return api.delete(`/uploads/file/${fileId}`)
}

/**
 * 获取文件信息
 */
export async function getFileInfo(fileId: string): Promise<UploadedFile> {
  return api.get(`/uploads/file/${fileId}/info`)
}

export default {
  fileToBase64,
  getFileType,
  validateFileSize,
  uploadFile,
  uploadFiles,
  getFileData,
  deleteFile,
  getFileInfo
}