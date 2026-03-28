import api from './index'
import type { LoginRequest, LoginResponse, RegisterRequest, ApiResponse } from '../types'

/**
 * 用户登录
 */
export function login(data: LoginRequest): Promise<LoginResponse> {
  return api.post('/auth/login', data)
}

/**
 * 用户注册
 */
export function register(data: RegisterRequest): Promise<ApiResponse<{ user: any }>> {
  return api.post('/auth/register', data)
}

/**
 * 用户登出
 */
export function logout(): Promise<ApiResponse> {
  return api.post('/auth/logout')
}

/**
 * 获取当前用户信息
 */
export function getCurrentUser(): Promise<ApiResponse<{ user: any }>> {
  return api.get('/auth/me')
}

/**
 * 刷新令牌
 */
export function refreshToken(): Promise<ApiResponse<{ token: string }>> {
  return api.post('/auth/refresh')
}