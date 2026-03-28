import api from './index'
import type { Order, OrderListResponse, CreateOrderRequest, PaginationParams, ApiResponse } from '../types'

/**
 * 获取订单列表
 */
export function getOrders(params: PaginationParams): Promise<OrderListResponse> {
  return api.get('/orders', { params })
}

/**
 * 获取订单详情
 */
export function getOrder(id: number): Promise<ApiResponse<{ order: Order }>> {
  return api.get(`/orders/${id}`)
}

/**
 * 创建订单
 */
export function createOrder(data: CreateOrderRequest): Promise<ApiResponse<{ order: Order }>> {
  return api.post('/orders', data)
}

/**
 * 取消订单
 */
export function cancelOrder(id: number): Promise<ApiResponse> {
  return api.post(`/orders/${id}/cancel`)
}

/**
 * 支付订单
 */
export function payOrder(id: number): Promise<ApiResponse<{ order: Order }>> {
  return api.post(`/orders/${id}/pay`)
}

/**
 * 获取用户订单
 */
export function getUserOrders(params: PaginationParams): Promise<OrderListResponse> {
  return api.get('/orders/my', { params })
}