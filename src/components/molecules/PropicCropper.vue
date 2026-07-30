<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount } from 'vue';
import Cropper from 'cropperjs';
import AppButton from '../atoms/AppButton.vue';

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
 *
 * The move handle must be the LAST child: Cropper reads the `action` attribute
 * off whatever element is under the pointer, so anything painted on top of it
 * would swallow drags.
 */
const CROPPER_TEMPLATE = `
<cropper-canvas background style="width: 100%; height: 100%;">
  <cropper-image initial-center-size="cover" rotatable scalable translatable></cropper-image>
  <cropper-selection initial-coverage="1" aspect-ratio="1" outlined>
    <cropper-grid role="grid" covered></cropper-grid>
  </cropper-selection>
  <cropper-handle action="move" plain></cropper-handle>
</cropper-canvas>`;

interface Props {
  /** Photo already on the server, shown until the operator picks a new one. */
  existingUrl?: string | null;
  /** Side of the exported square image, in pixels. */
  outputSize?: number;
  /** Used to name the exported File. */
  filenameBase?: string;
}

const props = withDefaults(defineProps<Props>(), {
  existingUrl: null,
  outputSize: 512,
  filenameBase: 'propic',
});

const emit = defineEmits<{
  /** Fires when the operator picks a photo, so the parent can track dirtiness. */
  change: [hasNewImage: boolean];
}>();

const fileInput = ref<HTMLInputElement>();
const stage = ref<HTMLDivElement>();
const sourceImage = ref<HTMLImageElement>();

const objectUrl = ref<string | null>(null);
const sourceType = ref<'image/jpeg' | 'image/png'>('image/jpeg');

let cropper: Cropper | null = null;
/** Off while we position the photo ourselves, on while the operator drags. */
let clampEnabled = false;
/** Guards against re-entering the handler via our own $setTransform. */
let correcting = false;

const hasNewImage = computed(() => !!objectUrl.value);

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Axis-aligned bounds of the image once `matrix` is applied.
 *
 * <cropper-image> keeps its layout box at the photo's natural pixel size and
 * expresses every move/zoom/rotate as a CSS matrix, with the transform origin
 * at the centre of that box — so projecting the four corners is exact for the
 * 0/90/180/270 degree rotations the buttons produce.
 */
function boundsFor(matrix: number[], box: Box): Bounds {
  const [a, b, c, d, e, f] = matrix;
  const originX = box.left + box.width / 2;
  const originY = box.top + box.height / 2;

  const xs: number[] = [];
  const ys: number[] = [];

  for (const [x, y] of [
    [box.left, box.top],
    [box.left + box.width, box.top],
    [box.left, box.top + box.height],
    [box.left + box.width, box.top + box.height],
  ]) {
    const dx = x - originX;
    const dy = y - originY;
    xs.push(originX + a * dx + c * dy + e);
    ys.push(originY + b * dx + d * dy + f);
  }

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/**
 * Keeps the photo covering the crop frame.
 *
 * Rejecting an illegal transform outright would freeze the gesture — zooming
 * out past "cover" would simply do nothing. So instead we veto the proposal
 * and immediately apply the nearest legal transform: scale back up to the
 * floor if needed, then slide the photo so every edge of the frame is covered.
 */
function onImageTransform(event: Event) {
  if (!clampEnabled || correcting) return;

  const imageElement = cropper?.getCropperImage();
  const selection = cropper?.getCropperSelection();
  if (!imageElement || !selection) return;

  const box: Box = {
    left: imageElement.offsetLeft,
    top: imageElement.offsetTop,
    width: imageElement.offsetWidth,
    height: imageElement.offsetHeight,
  };
  if (!box.width || !box.height) return;

  const matrix = [...((event as CustomEvent).detail.matrix as number[])];
  let bounds = boundsFor(matrix, box);

  const covers = (b: Bounds) =>
    b.minX <= selection.x + TOLERANCE &&
    b.minY <= selection.y + TOLERANCE &&
    b.maxX >= selection.x + selection.width - TOLERANCE &&
    b.maxY >= selection.y + selection.height - TOLERANCE;

  if (covers(bounds)) return;

  const centreX = selection.x + selection.width / 2;
  const centreY = selection.y + selection.height / 2;
  const originX = box.left + box.width / 2;
  const originY = box.top + box.height / 2;

  // 1. Zoomed out past the floor? Scale back up about the centre of the frame.
  const k = Math.max(
    1,
    selection.width / (bounds.maxX - bounds.minX),
    selection.height / (bounds.maxY - bounds.minY),
  );

  if (k > 1) {
    for (let i = 0; i < 4; i += 1) matrix[i] *= k;
    matrix[4] = k * matrix[4] + (1 - k) * (centreX - originX);
    matrix[5] = k * matrix[5] + (1 - k) * (centreY - originY);
    bounds = boundsFor(matrix, box);
  }

  // 2. Slide back until no edge of the frame is left uncovered.
  if (bounds.minX > selection.x) {
    matrix[4] += selection.x - bounds.minX;
  } else if (bounds.maxX < selection.x + selection.width) {
    matrix[4] += selection.x + selection.width - bounds.maxX;
  }

  if (bounds.minY > selection.y) {
    matrix[5] += selection.y - bounds.minY;
  } else if (bounds.maxY < selection.y + selection.height) {
    matrix[5] += selection.y + selection.height - bounds.maxY;
  }

  event.preventDefault();
  correcting = true;
  imageElement.$setTransform(matrix);
  correcting = false;
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
  emit('change', true);
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

/** Returns the cropped square, or null when no new photo was picked. */
async function getCroppedFile(): Promise<File | null> {
  const selection = cropper?.getCropperSelection();
  if (!selection) return null;

  const size = props.outputSize;

  const canvas = await selection.$toCanvas({
    width: size,
    height: size,
    // JPEG has no alpha channel: fill first so transparency does not turn black.
    beforeDraw: (context) => {
      if (sourceType.value !== 'image/jpeg') return;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, size, size);
    },
  });

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return resolve(null);
        const extension = sourceType.value === 'image/png' ? 'png' : 'jpg';
        resolve(
          new File([blob], `${props.filenameBase}.${extension}`, { type: sourceType.value })
        );
      },
      sourceType.value,
      0.92,
    );
  });
}

/** Discards any picked photo and goes back to showing existingUrl. */
function reset() {
  releaseObjectUrl();
  emit('change', false);
}

onBeforeUnmount(releaseObjectUrl);

defineExpose({ getCroppedFile, reset, hasNewImage });
</script>

<template>
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
        v-else-if="existingUrl"
        :src="existingUrl"
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
          {{ hasNewImage || existingUrl ? 'Change photo' : 'Choose photo' }}
        </AppButton>
        <template v-if="hasNewImage">
          <AppButton variant="ghost" size="sm" @click="rotate('-90deg')">Rotate left</AppButton>
          <AppButton variant="ghost" size="sm" @click="rotate('90deg')">Rotate right</AppButton>
          <AppButton variant="ghost" size="sm" @click="resetFraming">Reset</AppButton>
        </template>
      </div>

      <p v-if="hasNewImage" class="cropper__hint">
        Drag the photo to reposition it, scroll or pinch to zoom.
      </p>
      <p v-else-if="existingUrl" class="cropper__hint">
        Choose a new photo to replace this one.
      </p>
    </div>
  </div>
</template>

<style scoped>
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
</style>
