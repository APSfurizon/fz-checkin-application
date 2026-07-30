<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import AppButton from '../atoms/AppButton.vue';
import AppInput from '../atoms/AppInput.vue';
import PropicCropper from '../molecules/PropicCropper.vue';

/** The badge upload endpoint rejects anything larger. */
const OUTPUT = 512;

/** Mirrors GeneralConsts.NAME_REGEX. The /u flag is required for \p{...}. */
const NAME_REGEX = /^[\p{L}\p{N}\p{M}_\-\/!"'()\[\].,&\\? ]{2,63}$/u;

export interface UserBadgeFormResult {
  userId: number;
  /** Trimmed, already validated against NAME_REGEX. */
  fursonaName: string;
  /** False when the operator only changed the photo. */
  nameChanged: boolean;
  /** 512x512 square, or null when the photo was left alone. */
  propicFile: File | null;
}

interface Props {
  show: boolean;
  /** The UserDisplayData object (userData.user). */
  user?: any | null;
  /** Falls back to this when user.userId is absent. */
  userId?: number | null;
  saving?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  user: null,
  userId: null,
  saving: false,
});

const emit = defineEmits<{
  close: [];
  confirm: [result: UserBadgeFormResult];
}>();

const cropperRef = ref<InstanceType<typeof PropicCropper>>();

const fursonaName = ref('');
const originalName = ref('');
const photoPicked = ref(false);
const submitAttempted = ref(false);

const existingPropicUrl = computed<string | null>(
  () => props.user?.propic?.mediaUrl ?? null
);

const trimmedName = computed(() => fursonaName.value.trim());
const nameValid = computed(() => NAME_REGEX.test(trimmedName.value));
const nameChanged = computed(() => trimmedName.value !== originalName.value);

/** Nothing to send means nothing to do. */
const dirty = computed(() => nameChanged.value || photoPicked.value);

const nameError = computed(() => {
  if (nameValid.value) return '';
  if (!submitAttempted.value && trimmedName.value === '') return '';
  const value = trimmedName.value;
  if (value.length < 2) return 'Use at least 2 characters.';
  if (value.length > 63) return 'Use at most 63 characters.';
  return 'Allowed: letters, numbers, spaces and _ - / ! " \' ( ) [ ] . , & \\ ?';
});

async function onConfirm() {
  submitAttempted.value = true;
  if (!nameValid.value || !dirty.value) return;

  const userId = props.user?.userId ?? props.userId;
  if (!userId) return;

  const propicFile = photoPicked.value
    ? (await cropperRef.value?.getCroppedFile()) ?? null
    : null;

  emit('confirm', {
    userId,
    fursonaName: trimmedName.value,
    nameChanged: nameChanged.value,
    propicFile,
  });
}

function onCancel() {
  emit('close');
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') onCancel();
}

watch(
  () => props.show,
  (open) => {
    if (open) {
      const current = props.user?.fursonaName ?? '';
      fursonaName.value = current;
      originalName.value = current.trim();
      photoPicked.value = false;
      submitAttempted.value = false;
      window.addEventListener('keydown', onKeydown);
    } else {
      window.removeEventListener('keydown', onKeydown);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click.self="onCancel">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal__header">
          <h3 class="modal__title">Edit badge</h3>
          <button class="modal__close" type="button" aria-label="Close" @click="onCancel">
            &times;
          </button>
        </div>

        <div class="modal__body">
          <PropicCropper
            ref="cropperRef"
            :existing-url="existingPropicUrl"
            :output-size="OUTPUT"
            filename-base="user-propic"
            @change="photoPicked = $event"
          />

          <div class="modal__fields">
            <AppInput
              v-model="fursonaName"
              label="Fursona name"
              placeholder="Fursona name"
              :error="nameError"
            />
          </div>
        </div>

        <div class="modal__footer">
          <AppButton variant="ghost" :disabled="saving" @click="onCancel">Cancel</AppButton>
          <AppButton
            variant="primary"
            :disabled="saving || !nameValid || !dirty"
            @click="onConfirm"
          >
            {{ saving ? 'Saving…' : 'Save changes' }}
          </AppButton>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md);
  z-index: 1000;
}

.modal {
  background-color: var(--color-surface);
  border: var(--border-width) solid var(--color-primary);
  border-radius: var(--radius-sm);
  width: 100%;
  max-width: 440px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 30px rgba(255, 71, 87, 0.2);
}

.modal__header {
  padding: var(--spacing-md);
  border-bottom: var(--border-width) solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.modal__title {
  color: var(--color-primary);
  font-size: var(--font-size-base);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.modal__close {
  font-size: 1.5rem;
  line-height: 1;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
}

.modal__close:hover {
  color: var(--color-text);
}

.modal__body {
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  overflow-y: auto;
}

.modal__fields {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.modal__footer {
  padding: var(--spacing-md);
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  border-top: var(--border-width) solid var(--color-border);
  flex-shrink: 0;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: scale(0.9);
}

@media (prefers-reduced-motion: reduce) {
  .modal-enter-active,
  .modal-leave-active,
  .modal-enter-active .modal,
  .modal-leave-active .modal {
    transition: none;
  }
}
</style>
