import api from './index'
import type { User, PaginationParams, ApiResponse } from '../types'

/**
 * 获取用户列表
 */
export function getUsers(params: PaginationParams): Promise<ApiResponse<{ users: User[]; total: number }>> {
  return api.get('/users', { params })
}

/**
 * 获取用户详情
 */
export function getUser(id: number): Promise<ApiResponse<{ user: User }>> {
  return api.get(`/users/${id}`)
}

/**
 * 创建用户
 */
export function createUser(data: Partial<User>): Promise<ApiResponse<{ user: User }>> {
  return api.post('/users', data)
}

/**
 * 更新用户
 */
export function updateUser(id: number, data: Partial<User>): Promise<ApiResponse<{ user: User }>> {
  return api.put(`/users/${id}`, data)
}

/**
 * 删除用户
 */
export function deleteUser(id: number): Promise<ApiResponse> {
  return api.delete(`/users/${id}`)
}

/**
 * 更新用户角色
 */
export function updateUserRole(id: number, role: 'admin' | 'user'): Promise<ApiResponse<{ user: User }>> {
  return api.patch(`/users/${id}/role`, { role })
}