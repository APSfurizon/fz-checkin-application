<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import Cropper from 'cropperjs';
import AppButton from '../atoms/AppButton.vue';
import AppInput from '../atoms/AppInput.vue';

/** Size of the exported square image, in pixels. */
const OUTPUT = 512;
/** Slack in px so floating point jitter cannot lock a drag at the boundary. */
const TOLERANCE = 0.5;

/**
 * Cropper.js v2 builds its own DOM from this string, so Vue's template
 * compiler never sees these custom elements — no vite config change needed.
 *
 * The selection is deliberately NOT movable or resizable: the crop frame is
 * fixed to the whole (square) canvas and the operator moves the photo behind
 * it instead. This is the only reliable way to guarantee the crop always
 * lands inside the photo.
 */
const CROPPER_TEMPLATE = `
<cropper-canvas background style="width: 100%; height: 100%;">
  <cropper-image initial-center-size="cover" rotatable scalable translatable></cropper-image>
  <cropper-selection initial-coverage="1" aspect-ratio="1" outlined>
    <cropper-grid role="grid" covered></cropper-grid>
  </cropper-selection>
  <cropper-handle action="move" plain></cropper-handle>
</cropper-canvas>`;

export interface FursuitFormResult {
  /** true when creating a brand new fursuit, false when editing an existing one */
  isNew: boolean;
  /** the untouched FursuitData this modal was opened with (null when creating) */
  original: any | null;
  /** original FursuitData merged with the edited fields, ready to send */
  data: any;
  /** the cropped square image, or null if the operator did not pick a new one */
  propicFile: File | null;
  /** true only when a new image was selected and cropped */
  propicChanged: boolean;
}

interface Props {
  show: boolean;
  /** pass the FursuitData object to edit it, or leave null to create a new one */
  fursuitData?: any | null;
  /** owner of the new fursuit — required in create mode */
  ownerId?: number | null;
  /** let the parent show a pending state while it saves */
  saving?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  fursuitData: null,
  ownerId: null,
  saving: false,
});

const emit = defineEmits<{
  close: [];
  confirm: [result: FursuitFormResult];
}>();

const isEdit = computed(() => !!props.fursuitData);

/* ------------------------------------------------------------------ fields */

const name = ref('');
const species = ref('');
const nameError = ref('');

/* ----------------------------------------------------------------- cropper */

const fileInput = ref<HTMLInputElement>();
const stage = ref<HTMLDivElement>();
const sourceImage = ref<HTMLImageElement>();

const objectUrl = ref<string | null>(null);
const existingPropicUrl = ref<string | null>(null);
const sourceType = ref<'image/jpeg' | 'image/png'>('image/jpeg');

let cropper: Cropper | null = null;
/** Off while we position the photo ourselves, on while the operator drags. */
let clampEnabled = false;

const hasNewImage = computed(() => !!objectUrl.value);

/**
 * Vetoes any pan or zoom that would stop the photo covering the crop frame.
 *
 * <cropper-image> keeps its layout box at the photo's natural pixel size and
 * expresses every move/zoom/rotate as a CSS matrix, with the transform origin
 * at the centre of that box. So we can project the four corners through the
 * proposed matrix and check the result still contains the selection.
 */
function onImageTransform(event: Event) {
  if (!clampEnabled) return;

  const imageElement = cropper?.getCropperImage();
  const selection = cropper?.getCropperSelection();
  if (!imageElement || !selection) return;

  const { offsetLeft: left, offsetTop: top, offsetWidth: width, offsetHeight: height } =
    imageElement;
  if (!width || !height) return;

  const [a, b, c, d, e, f] = (event as CustomEvent).detail.matrix as number[];
  const originX = left + width / 2;
  const originY = top + height / 2;

  const corners = [
    [left, top],
    [left + width, top],
    [left, top + height],
    [left + width, top + height],
  ].map(([x, y]) => {
    const dx = x - originX;
    const dy = y - originY;
    return [originX + a * dx + c * dy + e, originY + b * dx + d * dy + f];
  });

  const xs = corners.map((point) => point[0]);
  const ys = corners.map((point) => point[1]);

  const covers =
    Math.min(...xs) <= selection.x + TOLERANCE &&
    Math.min(...ys) <= selection.y + TOLERANCE &&
    Math.max(...xs) >= selection.x + selection.width - TOLERANCE &&
    Math.max(...ys) >= selection.y + selection.height - TOLERANCE;

  if (!covers) event.preventDefault();
}

/** Runs a repositioning that is allowed to break the rule, then re-arms it. */
function withClampOff(action: () => void) {
  clampEnabled = false;
  action();
  requestAnimationFrame(() => {
    clampEnabled = true;
  });
}

function destroyCropper() {
  if (!cropper) return;
  clampEnabled = false;
  cropper.getCropperImage()?.removeEventListener('transform', onImageTransform);
  cropper.destroy();
  cropper = null;
}

async function mountCropper() {
  destroyCropper();
  // Wait for Vue to put the new src on the <img> before Cropper reads it.
  await nextTick();
  if (!sourceImage.value || !stage.value) return;

  cropper = new Cropper(sourceImage.value, {
    container: stage.value,
    template: CROPPER_TEMPLATE,
  });

  const imageElement = cropper.getCropperImage();
  const canvasElement = cropper.getCropperCanvas();
  const selection = cropper.getCropperSelection();

  imageElement?.addEventListener('transform', onImageTransform);
  await imageElement?.$ready();

  // Pin the frame to the largest square the canvas can hold.
  if (canvasElement && selection) {
    const size = Math.min(canvasElement.offsetWidth, canvasElement.offsetHeight);
    selection.$change(
      (canvasElement.offsetWidth - size) / 2,
      (canvasElement.offsetHeight - size) / 2,
      size,
      size,
      1,
      true,
    );
  }

  withClampOff(() => imageElement?.$center('cover'));
}

function releaseObjectUrl() {
  destroyCropper();
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value);
  objectUrl.value = null;
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  // Reset so picking the same file twice still fires a change event.
  input.value = '';
  if (!file) return;

  releaseObjectUrl();
  sourceType.value = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  objectUrl.value = URL.createObjectURL(file);
  void mountCropper();
}

/** A quarter turn always breaks coverage, so re-fit straight afterwards. */
function rotate(angle: string) {
  const imageElement = cropper?.getCropperImage();
  withClampOff(() => {
    imageElement?.$rotate(angle);
    imageElement?.$center('cover');
  });
}

function resetFraming() {
  const imageElement = cropper?.getCropperImage();
  withClampOff(() => {
    imageElement?.$resetTransform();
    imageElement?.$center('cover');
  });
}

/* ------------------------------------------------------------------ export */

async function buildCroppedFile(): Promise<File | null> {
  const selection = cropper?.getCropperSelection();
  if (!selection) return null;

  const canvas = await selection.$toCanvas({
    width: OUTPUT,
    height: OUTPUT,
    // JPEG has no alpha channel: fill first so transparency does not turn black.
    beforeDraw: (context) => {
      if (sourceType.value !== 'image/jpeg') return;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, OUTPUT, OUTPUT);
    },
  });

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return resolve(null);
        const extension = sourceType.value === 'image/png' ? 'png' : 'jpg';
        resolve(new File([blob], `fursuit-propic.${extension}`, { type: sourceType.value }));
      },
      sourceType.value,
      0.92,
    );
  });
}

/* ----------------------------------------------------------------- actions */

async function onConfirm() {
  const trimmedName = name.value.trim();
  if (!trimmedName) {
    nameError.value = 'Enter a name for this fursuit.';
    return;
  }
  nameError.value = '';

  const propicFile = await buildCroppedFile();
  const original = props.fursuitData ?? null;
  const originalFursuit = original?.fursuit ?? null;

  // Defaults first, then everything the modal was given, then the edited fields.
  // Anything the operator cannot see here survives untouched.
  const data = {
    bringingToEvent: false,
    showInFursuitCount: true,
    showOwner: true,
    ...(original ?? {}),
    ownerId: original?.ownerId ?? props.ownerId ?? null,
    fursuit: {
      ...(originalFursuit ?? {}),
      id: originalFursuit?.id ?? null,
      name: trimmedName,
      species: species.value.trim() || null,
      ownerId: originalFursuit?.ownerId ?? original?.ownerId ?? props.ownerId ?? null,
    },
  };

  emit('confirm', {
    isNew: !original,
    original,
    data,
    propicFile,
    propicChanged: !!propicFile,
  });
}

function onCancel() {
  emit('close');
}

/* --------------------------------------------------------------- lifecycle */

function resetFromProps() {
  const fursuit = props.fursuitData?.fursuit;
  name.value = fursuit?.name ?? '';
  species.value = fursuit?.species ?? fursuit?.specie ?? '';
  existingPropicUrl.value = fursuit?.propic?.mediaUrl ?? null;
  nameError.value = '';
  releaseObjectUrl();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') onCancel();
}

watch(
  () => props.show,
  (open) => {
    if (open) {
      resetFromProps();
      window.addEventListener('keydown', onKeydown);
    } else {
      releaseObjectUrl();
      window.removeEventListener('keydown', onKeydown);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  releaseObjectUrl();
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click.self="onCancel">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal__header">
          <h3 class="modal__title">{{ isEdit ? 'Edit fursuit' : 'Add fursuit' }}</h3>
          <button class="modal__close" type="button" aria-label="Close" @click="onCancel">
            &times;
          </button>
        </div>

        <div class="modal__body">
          <!-- PHOTO -->
          <div class="cropper">
            <div ref="stage" class="cropper__stage">
              <!-- Cropper.js reads this element, hides it, and builds its UI next to it. -->
              <img
                v-if="hasNewImage"
                ref="sourceImage"
                :src="objectUrl!"
                class="cropper__source"
                alt="Photo to crop"
              />
              <img
                v-else-if="existingPropicUrl"
                :src="existingPropicUrl"
                class="cropper__current"
                alt="Current photo"
              />
              <div v-else class="cropper__placeholder">No photo yet</div>
            </div>

            <div class="cropper__controls">
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                class="cropper__file"
                @change="onFileChange"
              />
              <div class="cropper__buttons">
                <AppButton variant="secondary" size="sm" @click="fileInput?.click()">
                  {{ hasNewImage || existingPropicUrl ? 'Change photo' : 'Choose photo' }}
                </AppButton>
                <template v-if="hasNewImage">
                  <AppButton variant="ghost" size="sm" @click="rotate('-90deg')">
                    Rotate left
                  </AppButton>
                  <AppButton variant="ghost" size="sm" @click="rotate('90deg')">
                    Rotate right
                  </AppButton>
                  <AppButton variant="ghost" size="sm" @click="resetFraming">Reset</AppButton>
                </template>
              </div>

              <p v-if="hasNewImage" class="cropper__hint">
                Drag the photo to reposition it, scroll or pinch to zoom.
              </p>
              <p v-else-if="existingPropicUrl" class="cropper__hint">
                Choose a new photo to replace this one.
              </p>
            </div>
          </div>

          <!-- FIELDS -->
          <div class="modal__fields">
            <AppInput v-model="name" label="Name" placeholder="Fursuit name" :error="nameError" />
            <AppInput v-model="species" label="Species" placeholder="e.g. Lucario" />
          </div>
        </div>

        <div class="modal__footer">
          <AppButton variant="ghost" :disabled="saving" @click="onCancel">Cancel</AppButton>
          <AppButton variant="primary" :disabled="saving || !name.trim()" @click="onConfirm">
            {{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add fursuit' }}
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

/* Cropper */

.cropper {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* Square: the stage IS the crop frame, so its shape defines the propic. */
.cropper__stage {
  position: relative;
  width: 100%;
  max-width: 300px;
  aspect-ratio: 1 / 1;
  margin: 0 auto;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background-color: var(--color-secondary);
  border: 2px solid rgba(255, 255, 255, 0.1);
  /* Stops the browser from scrolling the page while dragging on a tablet. */
  touch-action: none;
}

/* Cropper.js hides this itself; keep it hidden before it initialises too. */
.cropper__source {
  display: none !important;
}

.cropper__current {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cropper__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-style: italic;
}

.cropper__controls {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.cropper__buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--spacing-sm);
}

.cropper__file {
  display: none;
}

.cropper__hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.4;
  text-align: center;
  margin: 0;
}

/* Transitions */

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