<template>
  <div class="products">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>商品管理</span>
          <el-button type="primary" @click="handleAdd">添加商品</el-button>
        </div>
      </template>

      <el-table :data="products" stripe v-loading="loading" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="商品名称" />
        <el-table-column prop="price" label="价格" width="120">
          <template #default="{ row }">
            ¥{{ row.price.toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column prop="stock" label="库存" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        :current-page="pagination.page"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @update:current-page="handlePageChange"
        @update:page-size="handleSizeChange"
        style="margin-top: 20px"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getProducts, deleteProduct as deleteProductApi } from '../api/products'
import type { Product } from '../types'

const loading = ref(false)
const products = ref<Product[]>([])
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})

const fetchProducts = async () => {
  loading.value = true
  try {
    const response = await getProducts({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    })

    if (response.success) {
      products.value = response.data.data
      pagination.value.total = response.data.total
    }
  } catch (error) {
    console.error('Failed to fetch products:', error)
    ElMessage.error('获取商品列表失败')
  } finally {
    loading.value = false
  }
}

const handlePageChange = (page: number) => {
  pagination.value.page = page
  fetchProducts()
}

const handleSizeChange = (size: number) => {
  pagination.value.pageSize = size
  pagination.value.page = 1
  fetchProducts()
}

const getStatusType = (status: string) => {
  const statusMap: Record<string, any> = {
    'draft': 'info',
    'published': 'success',
    'sold_out': 'warning',
    'deleted': 'danger'
  }
  return statusMap[status] || 'info'
}

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    'draft': '草稿',
    'published': '已发布',
    'sold_out': '已售罄',
    'deleted': '已删除'
  }
  return statusMap[status] || status
}

const handleAdd = () => {
  ElMessage.info('添加商品功能待实现')
}

const handleEdit = (row: Product) => {
  ElMessage.info(`编辑商品: ${row.name}`)
}

const handleDelete = async (row: Product) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除商品 "${row.name}" 吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    loading.value = true
    await deleteProductApi(row.id)
    ElMessage.success('删除成功')
    await fetchProducts()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('Failed to delete product:', error)
      ElMessage.error('删除失败')
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchProducts()
})
</script>

<style scoped>
.products {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>