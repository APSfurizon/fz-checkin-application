<script setup lang="ts">
import AppButton from '../atoms/AppButton.vue';

interface Props {
  show: boolean;
  title?: string;
  message: string;
  code?: string;
  requestId?: string;
}

defineProps<Props>();
defineEmits(['close']);
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal">
        <div class="modal__header">
          <h3 class="modal__title">{{ title || 'Error' }}</h3>
          <button class="modal__close" @click="$emit('close')">&times;</button>
        </div>
        <div class="modal__body">
          <p class="modal__message">{{ message }}</p>
          <div v-if="code || requestId" class="modal__details">
            <span v-if="code">Code: <code>{{ code }}</code></span>
            <span v-if="requestId">ID: <code>{{ requestId }}</code></span>
          </div>
        </div>
        <div class="modal__footer">
          <AppButton variant="primary" @click="$emit('close')">Close</AppButton>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background-color: var(--color-surface);
  border: var(--border-width) solid var(--color-error);
  border-radius: var(--radius-sm);
  width: 90%;
  max-width: 400px;
  box-shadow: 0 0 30px rgba(255, 71, 87, 0.2);
}

.modal__header {
  padding: var(--spacing-md);
  border-bottom: var(--border-width) solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal__title {
  color: var(--color-error);
  font-size: var(--font-size-base);
}

.modal__close {
  font-size: 1.5rem;
  color: var(--color-text-muted);
}

.modal__body {
  padding: var(--spacing-lg);
}

.modal__message {
  line-height: 1.5;
}

.modal__details {
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 10px;
  color: var(--color-text-muted);
}

.modal__details code {
  color: var(--color-text);
  background: var(--color-background-soft);
  padding: 2px 4px;
  border-radius: 2px;
}

.modal__footer {
  padding: var(--spacing-md);
  display: flex;
  justify-content: flex-end;
}

/* Transitions */
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from, .modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal, .modal-leave-active .modal {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-enter-from .modal, .modal-leave-to .modal {
  transform: scale(0.9);
}
</style>
