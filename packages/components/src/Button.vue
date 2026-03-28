<template>
  <button :class="['custom-button', `custom-button--${type}`]" @click="handleClick">
    <slot />
  </button>
</template>

<script setup lang="ts">
interface Props {
  type?: 'primary' | 'secondary' | 'danger'
}

withDefaults(defineProps<Props>(), {
  type: 'primary'
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const handleClick = (event: MouseEvent) => {
  emit('click', event)
}
</script>

<style scoped>
.custom-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.custom-button--primary {
  background-color: #409eff;
  color: white;
}

.custom-button--primary:hover {
  background-color: #66b1ff;
}

.custom-button--secondary {
  background-color: #f5f5f5;
  color: #606266;
}

.custom-button--secondary:hover {
  background-color: #e8e8e8;
}

.custom-button--danger {
  background-color: #f56c6c;
  color: white;
}

.custom-button--danger:hover {
  background-color: #f78989;
}
</style>