<template>
  <div class="admin-layout">
    <aside class="admin-layout__sidebar">
      <slot name="sidebar" />
    </aside>
    <div class="admin-layout__main">
      <header class="admin-layout__header">
        <slot name="header" />
      </header>
      <main class="admin-layout__content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
// AdminLayout 组件
</script>

<style scoped>
.admin-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.admin-layout__sidebar {
  width: 240px;
  background-color: #304156;
  color: white;
  flex-shrink: 0;
}

.admin-layout__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.admin-layout__header {
  height: 60px;
  background-color: white;
  border-bottom: 1px solid #e6e6e6;
  flex-shrink: 0;
}

.admin-layout__content {
  flex: 1;
  overflow-y: auto;
  background-color: #f5f5f5;
}
</style>