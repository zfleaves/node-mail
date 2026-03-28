<template>
  <div class="orders">
    <el-card>
      <template #header>
        <span>订单管理</span>
      </template>

      <el-table :data="orders" stripe v-loading="loading" style="width: 100%">
        <el-table-column prop="id" label="订单ID" width="120" />
        <el-table-column prop="user.username" label="用户" />
        <el-table-column prop="totalAmount" label="金额" width="120">
          <template #default="{ row }">
            ¥{{ row.totalAmount.toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="handleView(row)">查看</el-button>
            <el-button
              v-if="row.status === 'pending'"
              size="small"
              type="primary"
              @click="handlePay(row)"
            >
              支付
            </el-button>
            <el-button
              v-if="row.status === 'pending'"
              size="small"
              type="danger"
              @click="handleCancel(row)"
            >
              取消
            </el-button>
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
import { getOrders, payOrder, cancelOrder } from '../api/orders'
import { formatDate } from '@node-mail/utils'
import type { Order } from '../types'

const loading = ref(false)
const orders = ref<Order[]>([])
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})

const fetchOrders = async () => {
  loading.value = true
  try {
    const response = await getOrders({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    })

    if (response.success) {
      orders.value = response.data.orders
      pagination.value.total = response.data.total
    }
  } catch (error) {
    console.error('Failed to fetch orders:', error)
    ElMessage.error('获取订单列表失败')
  } finally {
    loading.value = false
  }
}

const handlePageChange = (page: number) => {
  pagination.value.page = page
  fetchOrders()
}

const handleSizeChange = (size: number) => {
  pagination.value.pageSize = size
  pagination.value.page = 1
  fetchOrders()
}

const getStatusType = (status: string) => {
  const statusMap: Record<string, any> = {
    'pending': 'warning',
    'paid': 'success',
    'shipped': 'primary',
    'completed': 'info',
    'cancelled': 'danger'
  }
  return statusMap[status] || 'info'
}

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    'pending': '待支付',
    'paid': '已支付',
    'shipped': '已发货',
    'completed': '已完成',
    'cancelled': '已取消'
  }
  return statusMap[status] || status
}

const handleView = (row: Order) => {
  ElMessage.info(`查看订单: ${row.id}`)
}

const handlePay = async (row: Order) => {
  try {
    await ElMessageBox.confirm(
      `确定要支付订单 #${row.id} 吗？金额：¥${row.totalAmount.toFixed(2)}`,
      '支付确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    loading.value = true
    await payOrder(row.id)
    ElMessage.success('支付成功')
    await fetchOrders()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('Failed to pay order:', error)
      ElMessage.error('支付失败')
    }
  } finally {
    loading.value = false
  }
}

const handleCancel = async (row: Order) => {
  try {
    await ElMessageBox.confirm(
      `确定要取消订单 #${row.id} 吗？`,
      '取消确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    loading.value = true
    await cancelOrder(row.id)
    ElMessage.success('订单已取消')
    await fetchOrders()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('Failed to cancel order:', error)
      ElMessage.error('取消失败')
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchOrders()
})
</script>

<style scoped>
.orders {
  padding: 20px;
}
</style>