<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false
});
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="[
      'button',
      `button--${variant}`,
      `button--${size}`
    ]"
  >
    <slot />
  </button>
</template>

<style scoped>
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all var(--transition-fast);
  white-space: nowrap;
  border: var(--border-width) solid transparent;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button--primary {
  background-color: var(--color-primary);
  color: white;
}

.button--primary:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
  box-shadow: 0 0 15px rgba(255, 71, 87, 0.4);
}

.button--secondary {
  background-color: var(--color-secondary);
  color: var(--color-text);
  border-color: var(--color-border);
}

.button--secondary:hover:not(:disabled) {
  background-color: var(--color-surface-hover);
}

.button--danger {
  background-color: transparent;
  color: var(--color-error);
  border-color: var(--color-error);
}

.button--danger:hover:not(:disabled) {
  background-color: var(--color-error);
  color: white;
}

.button--ghost {
  background-color: transparent;
  color: var(--color-text-muted);
}

.button--ghost:hover:not(:disabled) {
  color: var(--color-text);
  background-color: var(--color-surface-hover);
}

.button--sm {
  padding: 0.25rem 0.75rem;
  font-size: var(--font-size-xs);
}

.button--md {
  padding: 0.5rem 1.25rem;
  font-size: var(--font-size-sm);
}

.button--lg {
  padding: 0.75rem 2rem;
  font-size: var(--font-size-base);
}
</style>
