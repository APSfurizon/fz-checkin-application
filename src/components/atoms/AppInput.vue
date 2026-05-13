<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  modelValue: string | number;
  type?: string;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
}

const inputElement = ref<HTMLInputElement>();

defineProps<Props>();
defineEmits(['update:modelValue']);
defineExpose({
  focus: () => inputElement.value?.focus(),
  select: () => inputElement.value?.select(),
  element: inputElement
});
</script>

<template>
  <div class="field">
    <label v-if="label" class="field__label">{{ label }}</label>
    <input
      ref="inputElement"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="field__input"
      :class="{ 'field__input--error': error }"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="error" class="field__error">{{ error }}</span>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  width: 100%;
}

.field__label {
  font-size: var(--font-size-xs);
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-text-muted);
  letter-spacing: 0.05em;
}

.field__input {
  background-color: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  color: var(--color-text);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  transition: all var(--transition-fast);
  outline: none;
}

.field__input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(255, 71, 87, 0.1);
}

.field__input--error {
  border-color: var(--color-error);
}

.field__error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
}

.field__input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
