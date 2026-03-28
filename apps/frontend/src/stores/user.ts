import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, logout as logoutApi, getCurrentUser } from '../api/auth'
import type { User, LoginRequest } from '../types'

export const useUserStore = defineStore('user', () => {
  // 状态
  const token = ref<string>('')
  const user = ref<User | null>(null)
  const loading = ref(false)

  // 计算属性
  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  // 方法
  async function login(credentials: LoginRequest) {
    loading.value = true
    try {
      const response = await loginApi(credentials)
      if (response.success) {
        token.value = response.data.token
        user.value = response.data.user
        return true
      }
      return false
    } catch (error) {
      console.error('Login failed:', error)
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    loading.value = true
    try {
      await logoutApi()
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      // 清除状态
      token.value = ''
      user.value = null
      loading.value = false
    }
  }

  async function fetchUserInfo() {
    if (!token.value) return false
    
    loading.value = true
    try {
      const response = await getCurrentUser()
      if (response.success) {
        user.value = response.data.user
        return true
      }
      return false
    } catch (error) {
      console.error('Fetch user info failed:', error)
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    token,
    user,
    loading,
    isLoggedIn,
    isAdmin,
    login,
    logout,
    fetchUserInfo
  }
}, {
  persist: {
    key: 'user-store',
    storage: localStorage,
    pick: ['token', 'user']
  }
})