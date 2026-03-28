<template>
  <div class="home">
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card class="stat-card" v-loading="loading">
          <div class="stat-content">
            <el-icon :size="40" color="#409eff"><ShoppingCart /></el-icon>
            <div class="stat-info">
              <div class="stat-label">总订单数</div>
              <div class="stat-value">{{ stats.totalOrders }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card" v-loading="loading">
          <div class="stat-content">
            <el-icon :size="40" color="#67c23a"><Goods /></el-icon>
            <div class="stat-info">
              <div class="stat-label">商品数量</div>
              <div class="stat-value">{{ stats.totalProducts }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card" v-loading="loading">
          <div class="stat-content">
            <el-icon :size="40" color="#e6a23c"><User /></el-icon>
            <div class="stat-info">
              <div class="stat-label">用户总数</div>
              <div class="stat-value">{{ stats.totalUsers }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card class="welcome-card">
          <template #header>
            <span>系统信息</span>
          </template>
          <div class="info-list">
            <div class="info-item">
              <span class="info-label">当前用户：</span>
              <span class="info-value">{{ userStore.user?.username || '未登录' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">用户角色：</span>
              <el-tag :type="userStore.isAdmin ? 'danger' : 'primary'" size="small">
                {{ userStore.isAdmin ? '管理员' : '普通用户' }}
              </el-tag>
            </div>
            <div class="info-item">
              <span class="info-label">登录时间：</span>
              <span class="info-value">{{ loginTime }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="welcome-card">
          <template #header>
            <span>快捷操作</span>
          </template>
          <div class="quick-actions">
            <el-button type="primary" @click="$router.push('/products')">
              <el-icon><Goods /></el-icon>
              管理商品
            </el-button>
            <el-button type="success" @click="$router.push('/orders')">
              <el-icon><ShoppingCart /></el-icon>
              查看订单
            </el-button>
            <el-button
              v-if="userStore.isAdmin"
              type="warning"
              @click="$router.push('/users')"
            >
              <el-icon><User /></el-icon>
              用户管理
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ShoppingCart, Goods, User } from '@element-plus/icons-vue'
import { getProducts } from '../api/products'
import { getOrders } from '../api/orders'
import { getUsers } from '../api/users'
import { useUserStore } from '../stores/user'
import { formatDate } from '@node-mail/utils'

const userStore = useUserStore()
const loading = ref(false)

const stats = ref({
  totalOrders: 0,
  totalProducts: 0,
  totalUsers: 0
})

const loginTime = computed(() => {
  const userInfo = userStore.user
  if (!userInfo) return '未登录'
  return formatDate(userInfo.createdAt, 'YYYY-MM-DD HH:mm')
})

const fetchStats = async () => {
  loading.value = true
  try {
    // 并行请求所有统计数据
    const [productsRes, ordersRes, usersRes] = await Promise.all([
      getProducts({ page: 1, pageSize: 1 }).catch(() => ({ success: false, data: { total: 0 } })),
      getOrders({ page: 1, pageSize: 1 }).catch(() => ({ success: false, data: { total: 0 } })),
      getUsers({ page: 1, pageSize: 1 }).catch(() => ({ success: false, data: { total: 0 } }))
    ])

    if (productsRes.success) {
      stats.value.totalProducts = productsRes.data.total
    }
    if (ordersRes.success) {
      stats.value.totalOrders = ordersRes.data.total
    }
    if (usersRes.success) {
      stats.value.totalUsers = usersRes.data.total
    }
  } catch (error) {
    console.error('Failed to fetch stats:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchStats()
})
</script>

<style scoped>
.home {
  padding: 20px;
}

.stat-card {
  margin-bottom: 20px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 20px;
}

.stat-info {
  flex: 1;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.welcome-card {
  min-height: 200px;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.info-label {
  color: #909399;
  font-size: 14px;
  min-width: 80px;
}

.info-value {
  color: #303133;
  font-weight: 500;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quick-actions .el-button {
  width: 100%;
  justify-content: flex-start;
}
</style>