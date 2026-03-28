/**
 * 全局类型定义
 */

// 用户相关类型
export interface User {
  id: number
  username: string
  email: string
  role: 'admin' | 'user'
  avatar?: string
  createdAt: string
  updatedAt: string
}

// 登录请求
export interface LoginRequest {
  username: string
  password: string
}

// 登录响应
export interface LoginResponse {
  success: boolean
  data: {
    token: string
    user: User
    expiresIn: number
  }
  message: string
}

// 注册请求
export interface RegisterRequest {
  username: string
  email: string
  password: string
}

// 商品相关类型
export interface Product {
  id: number
  name: string
  description: string
  price: number
  stock: number
  status: 'draft' | 'published' | 'sold_out' | 'deleted'
  images: string[]
  createdAt: string
  updatedAt: string
}

// 商品列表响应
export interface ProductListResponse {
  success: boolean
  data: {
    data: Product[]
    total: number
    page: number
    pageSize: number
  }
  message: string
}

// 订单相关类型
export interface Order {
  id: number
  userId: number
  user: User
  products: OrderProduct[]
  totalAmount: number
  status: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled'
  createdAt: string
  updatedAt: string
}

export interface OrderProduct {
  productId: number
  productName: string
  quantity: number
  price: number
}

// 订单列表响应
export interface OrderListResponse {
  success: boolean
  data: {
    orders: Order[]
    total: number
    page: number
    pageSize: number
  }
  message: string
}

// 创建订单请求
export interface CreateOrderRequest {
  products: {
    productId: number
    quantity: number
  }[]
}

// 分页参数
export interface PaginationParams {
  page?: number
  pageSize?: number
}

// 通用 API 响应
export interface ApiResponse<T = any> {
  success: boolean
  data: T
  message: string
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}