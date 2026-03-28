<template>
  <div class="custom-card">
    <div v-if="$slots.header" class="custom-card__header">
      <slot name="header" />
    </div>
    <div class="custom-card__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="custom-card__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
// Card 组件
</script>

<style scoped>
.custom-card {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
  background-color: white;
}

.custom-card__header {
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  font-weight: bold;
}

.custom-card__body {
  padding: 16px;
}

.custom-card__footer {
  padding: 12px 16px;
  border-top: 1px solid #ebeef5;
}
</style>