<template>
  <div class="main-layout">
    <header class="main-layout__header">
      <slot name="header" />
    </header>
    <main class="main-layout__content">
      <slot />
    </main>
    <footer class="main-layout__footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<script setup lang="ts">
// MainLayout 组件
</script>

<style scoped>
.main-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-layout__header {
  flex-shrink: 0;
}

.main-layout__content {
  flex: 1;
}

.main-layout__footer {
  flex-shrink: 0;
}
</style>