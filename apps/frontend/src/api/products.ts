import api from './index'
import type { Product, ProductListResponse, PaginationParams, ApiResponse } from '../types'

/**
 * 获取商品列表
 */
export function getProducts(params: PaginationParams): Promise<ProductListResponse> {
  return api.get('/products', { params })
}

/**
 * 获取商品详情
 */
export function getProduct(id: number): Promise<ApiResponse<{ product: Product }>> {
  return api.get(`/products/${id}`)
}

/**
 * 创建商品
 */
export function createProduct(data: Partial<Product>): Promise<ApiResponse<{ product: Product }>> {
  return api.post('/products', data)
}

/**
 * 更新商品
 */
export function updateProduct(id: number, data: Partial<Product>): Promise<ApiResponse<{ product: Product }>> {
  return api.put(`/products/${id}`, data)
}

/**
 * 删除商品
 */
export function deleteProduct(id: number): Promise<ApiResponse> {
  return api.delete(`/products/${id}`)
}

/**
 * 更新商品库存
 */
export function updateProductStock(id: number, stock: number): Promise<ApiResponse> {
  return api.patch(`/products/${id}/stock`, { stock })
}