<script setup lang="ts">
import AppBadge from '../atoms/AppBadge.vue';

interface Props {
  title: string;
  subtitle: string;
  status?: string;
  statusVariant?: 'success' | 'warning' | 'danger' | 'info';
  typeLabel?: string;
  typeVariant?: 'success' | 'warning' | 'danger' | 'info';
  hasGadgets?: boolean;
  showArrow?: boolean;
  avatar?: string;
}

withDefaults(defineProps<Props>(), {
  showArrow: true
});
defineEmits(['click']);
</script>

<template>
  <div class="result-item" @click="$emit('click')">
    <div v-if="avatar" class="result-item__avatar">
      <img :src="avatar" alt="Avatar" />
    </div>
    <div class="result-item__content">
      <div class="result-item__header">
        <h4 class="result-item__title" v-html="title"></h4>
        <div class="header-badges">
          <AppBadge v-if="typeLabel" :variant="typeVariant" class="type-badge">{{ typeLabel }}</AppBadge>
          <AppBadge v-if="hasGadgets" variant="info" class="gadget-badge">🎁 GADGET</AppBadge>
        </div>
      </div>
      <p class="result-item__subtitle" v-html="subtitle"></p>
    </div>
    <div v-if="status" class="result-item__status">
      <AppBadge :variant="statusVariant">{{ status }}</AppBadge>
    </div>
    <div v-if="showArrow" class="result-item__arrow">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.result-item {
  display: flex;
  align-items: center;
  padding: var(--spacing-md);
  background-color: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  gap: var(--spacing-md);
}

.result-item:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-primary);
}

.result-item__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
}

.result-item__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.result-item__content {
  flex: 1;
  min-width: 0; /* Prevent overflow */
}

.result-item__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: 2px;
}

.header-badges {
  display: flex;
  gap: 4px;
}

.type-badge {
  font-size: 10px;
  padding: 2px 6px;
}

.result-item__title {
  font-size: var(--font-size-base);
  margin: 0;
}

.gadget-badge {
  font-size: 10px;
  padding: 2px 6px;
}

.result-item__subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.result-item__status {
  display: flex;
  align-items: center;
}

.result-item__arrow {
  color: var(--color-text-muted);
  opacity: 0.5;
}

.result-item:hover .result-item__arrow {
  color: var(--color-primary);
  opacity: 1;
}
</style>
