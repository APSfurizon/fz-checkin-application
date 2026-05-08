<script setup lang="ts">
interface Props {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

withDefaults(defineProps<Props>(), {
  variant: 'default'
});
</script>

<template>
  <span :class="['badge', `badge--${variant}`]">
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 100px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge--default {
  background-color: var(--color-secondary);
  color: var(--color-text-muted);
}

.badge--success {
  background-color: rgba(46, 213, 115, 0.1);
  color: var(--color-success);
  border: 1px solid var(--color-success);
}

.badge--warning {
  background-color: rgba(255, 165, 2, 0.1);
  color: var(--color-warning);
  border: 1px solid var(--color-warning);
}

.badge--danger {
  background-color: rgba(255, 71, 87, 0.1);
  color: var(--color-error);
  border: 1px solid var(--color-error);
}

.badge--info {
  background-color: rgba(30, 144, 255, 0.1);
  color: var(--color-info);
  border: 1px solid var(--color-info);
}
</style>
