<script setup lang="ts">
import AppButton from '@/components/atoms/AppButton.vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const lanyardTypes = [
  { name: 'Main Staff / Security', code: 'MAIN_STAFF', color: '#ff4757' },
  { name: 'Staff', code: 'STAFF', color: '#70a1ff' },
  { name: 'Daily', code: 'DAILY', color: '#ffffff' },
  { name: 'Attendee', code: 'ATTENDEE', color: '#2ed573' },
  { name: 'Super Sponsor', code: 'SUPER_SPONSOR', color: '#ffa502' },
  { name: 'Sponsor', code: 'SPONSOR', color: '#a29bfe' },
  { name: 'Explorer', code: 'ULTRA_SPONSOR', color: '#eccc68' },
];

const badgeHolderTypes = [
  { name: 'Main Staff / Security', code: 'MAIN_STAFF', color: '#ff4757' },
  { name: 'Staff', code: 'STAFF', color: '#70a1ff' },
  { name: 'Fursuiters', code: 'FURSUIT', color: '#eccc68' },
  { name: 'Daily', code: 'DAILY', color: '#2ed573' },
  { name: 'Standard / Others', code: 'STANDARD', color: '#2f3542' },
];

const getContrastColor = (hexColor: string) => {
  if (!hexColor) return '#ffffff';
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155 ? '#000000' : '#ffffff';
};
</script>

<template>
  <div class="legend-page container">
    <header class="legend-page__header">
      <AppButton variant="ghost" size="sm" @click="router.back()">Back</AppButton>
      <h1 class="legend-page__title">Badge & Lanyard Legend</h1>
    </header>

    <div class="legend-grid">
      <section class="legend-section">
        <h2 class="section-title">Lanyards (Cordini)</h2>
        <div class="legend-list">
          <div v-for="item in lanyardTypes" :key="item.code" class="legend-item">
            <div class="preview-pill" :style="{ backgroundColor: item.color, color: getContrastColor(item.color) }">
              {{ item.code }}
            </div>
            <div class="item-info">
              <span class="item-name">{{ item.name }}</span>
              <span class="item-color-hex">{{ item.color }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="legend-section">
        <h2 class="section-title">Badge Holders (Portabadge)</h2>
        <div class="legend-list">
          <div v-for="item in badgeHolderTypes" :key="item.code" class="legend-item">
            <div class="preview-pill" :style="{ backgroundColor: item.color, color: getContrastColor(item.color) }">
              {{ item.code }}
            </div>
            <div class="item-info">
              <span class="item-name">{{ item.name }}</span>
              <span class="item-color-hex">{{ item.color }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.legend-page {
  padding: var(--spacing-xl) var(--spacing-md);
  max-width: 1000px;
}

.legend-page__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-2xl);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--spacing-lg);
}

.legend-page__title {
  font-size: var(--font-size-2xl);
  color: var(--color-primary);
}

.legend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--spacing-2xl);
}

.section-title {
  font-size: var(--font-size-lg);
  margin-bottom: var(--spacing-xl);
  color: var(--color-text);
  padding-left: var(--spacing-sm);
  border-left: 4px solid var(--color-primary);
}

.legend-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  background: var(--color-surface);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.preview-pill {
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 800;
  font-size: 14px;
  min-width: 160px;
  text-align: center;
  text-transform: uppercase;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.item-info {
  display: flex;
  flex-direction: column;
}

.item-name {
  font-weight: 600;
  font-size: 16px;
  color: var(--color-text);
}

.item-color-hex {
  font-family: monospace;
  font-size: 12px;
  color: var(--color-text-muted);
}
</style>
