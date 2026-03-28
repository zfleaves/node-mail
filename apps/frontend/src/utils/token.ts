/**
 * Token 管理工具
 * 从 localStorage 获取 token，避免循环依赖
 */

export function getToken(): string | null {
  return localStorage.getItem('user-store')
    ? JSON.parse(localStorage.getItem('user-store') || '{}').token || null
    : null
}

export function clearToken(): void {
  const storeData = localStorage.getItem('user-store')
  if (storeData) {
    const data = JSON.parse(storeData)
    data.token = ''
    data.user = null
    localStorage.setItem('user-store', JSON.stringify(data))
  }
}