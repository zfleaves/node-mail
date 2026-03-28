<template>
  <div class="users">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
          <el-button type="primary" @click="handleAdd">添加用户</el-button>
        </div>
      </template>

      <el-table :data="users" stripe v-loading="loading" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="email" label="邮箱" />
        <el-table-column prop="role" label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'danger' : 'primary'">
              {{ row.role === 'admin' ? '管理员' : '普通用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button
              size="small"
              :type="row.role === 'admin' ? 'info' : 'warning'"
              @click="handleChangeRole(row)"
            >
              {{ row.role === 'admin' ? '降为用户' : '提升管理员' }}
            </el-button>
            <el-button
              v-if="row.id !== userStore.user?.id"
              size="small"
              type="danger"
              @click="handleDelete(row)"
            >
              删除
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
import { getUsers, deleteUser, updateUserRole } from '../api/users'
import { useUserStore } from '../stores/user'
import { formatDate } from '@node-mail/utils'
import type { User } from '../types'

const loading = ref(false)
const users = ref<User[]>([])
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})
const userStore = useUserStore()

const fetchUsers = async () => {
  loading.value = true
  try {
    const response = await getUsers({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    })

    if (response.success) {
      users.value = response.data.users
      pagination.value.total = response.data.total
    }
  } catch (error) {
    console.error('Failed to fetch users:', error)
    ElMessage.error('获取用户列表失败')
  } finally {
    loading.value = false
  }
}

const handlePageChange = (page: number) => {
  pagination.value.page = page
  fetchUsers()
}

const handleSizeChange = (size: number) => {
  pagination.value.pageSize = size
  pagination.value.page = 1
  fetchUsers()
}

const handleAdd = () => {
  ElMessage.info('添加用户功能待实现')
}

const handleEdit = (row: User) => {
  ElMessage.info(`编辑用户: ${row.username}`)
}

const handleChangeRole = async (row: User) => {
  const newRole = row.role === 'admin' ? 'user' : 'admin'
  const action = newRole === 'admin' ? '提升为管理员' : '降为普通用户'
  
  try {
    await ElMessageBox.confirm(
      `确定要将用户 "${row.username}" ${action}吗？`,
      '角色变更确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    loading.value = true
    await updateUserRole(row.id, newRole)
    ElMessage.success('角色变更成功')
    await fetchUsers()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('Failed to change user role:', error)
      ElMessage.error('角色变更失败')
    }
  } finally {
    loading.value = false
  }
}

const handleDelete = async (row: User) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户 "${row.username}" 吗？此操作不可恢复！`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'error'
      }
    )
    
    loading.value = true
    await deleteUser(row.id)
    ElMessage.success('删除成功')
    await fetchUsers()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('Failed to delete user:', error)
      ElMessage.error('删除失败')
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.users {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>