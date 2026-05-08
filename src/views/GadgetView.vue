<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { toggleGadget } from '@/services/checkinApi';
import { useGadgets } from '@/composables/useGadgets';
import AppButton from '@/components/atoms/AppButton.vue';
import AppInput from '@/components/atoms/AppInput.vue';
import AppBadge from '@/components/atoms/AppBadge.vue';
import ErrorModal from '@/components/organisms/ErrorModal.vue';

const router = useRouter();
const { gadgetCheckins, loading, error, loadGadgets, updateGadgetStatus } = useGadgets();
const currentTab = ref<'all' | 'to-collect' | 'collected'>('to-collect');
const searchQuery = ref('');

const filteredCheckins = computed(() => {
  let list = gadgetCheckins.value;
  
  // Filtro per Tab
  if (currentTab.value === 'to-collect') {
    list = list.filter(c => !c.gadgetCollectedAt);
  } else if (currentTab.value === 'collected') {
    list = list.filter(c => !!c.gadgetCollectedAt);
  }

  // Filtro Live Search
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(c => 
      (c.fursonaName?.toLowerCase().includes(q)) || 
      (c.firstName?.toLowerCase().includes(q)) || 
      (c.lastName?.toLowerCase().includes(q)) ||
      (c.orderCode?.toLowerCase().includes(q))
    );
  }
  
  return list;
});

const handleToggle = async (id: number, currentStatus: any) => {
  const action = currentStatus ? 'unmark as collected' : 'mark as collected';
  if (!confirm(`Are you sure you want to ${action}?`)) return;
  
  try {
    const response = await toggleGadget(id);
    if (response.success) {
      updateGadgetStatus(id, response.collectedAt);
    } else {
      error.value = response.message || 'Failed to update status';
    }
  } catch (e: any) {
    error.value = e.response?.data?.errors?.[0]?.message || 'Failed to toggle status';
  }
};

onMounted(loadGadgets);
</script>

<template>
  <div class="gadgets-page container">
    <header class="gadgets-page__header">
      <div class="header-left">
        <AppButton variant="ghost" size="sm" @click="router.push('/operator')">Back</AppButton>
        <h1 class="gadgets-page__title">Gadget Management</h1>
      </div>
      <div class="gadgets-page__actions">
        <div class="search-container">
          <AppInput v-model="searchQuery" placeholder="Search fursona, name or order..." class="compact-search" />
        </div>
        <AppButton size="sm" @click="loadGadgets">Refresh</AppButton>
      </div>
    </header>

    <nav class="gadgets-page__tabs">
      <button 
        class="tab-btn" 
        :class="{ 'tab-btn--active': currentTab === 'all' }"
        @click="currentTab = 'all'"
      >
        All ({{ gadgetCheckins.length }})
      </button>
      <button 
        class="tab-btn" 
        :class="{ 'tab-btn--active': currentTab === 'to-collect' }"
        @click="currentTab = 'to-collect'"
      >
        To Collect ({{ gadgetCheckins.filter(c => !c.gadgetCollectedAt).length }})
      </button>
      <button 
        class="tab-btn" 
        :class="{ 'tab-btn--active': currentTab === 'collected' }"
        @click="currentTab = 'collected'"
      >
        Collected ({{ gadgetCheckins.filter(c => !!c.gadgetCollectedAt).length }})
      </button>
    </nav>

    <main class="gadgets-page__content">
      <div v-if="loading" class="gadgets-page__loading">
        <div class="loader"></div>
        Loading gadgets...
      </div>
      
      <div v-else-if="filteredCheckins.length === 0" class="gadgets-page__empty">
        <div class="empty-state">
          <p v-if="searchQuery">No results found for "{{ searchQuery }}"</p>
          <p v-else-if="currentTab === 'to-collect'">All gadgets have been delivered! ✨</p>
          <p v-else-if="currentTab === 'collected'">No gadgets delivered yet.</p>
          <p v-else>The list is empty.</p>
        </div>
      </div>

      <div v-else class="compact-gadget-list">
        <div 
          v-for="item in filteredCheckins" 
          :key="item.id" 
          class="compact-card"
          :class="{ 'compact-card--collected': item.gadgetCollectedAt }"
          @click="handleToggle(item.id, item.gadgetCollectedAt)"
        >
          <div class="compact-card__avatar">
            <img v-if="item.propicUrl" :src="item.propicUrl" :alt="item.fursonaName" />
            <div v-else class="avatar-placeholder">{{ item.fursonaName?.charAt(0) || '?' }}</div>
          </div>
          
          <div class="compact-card__main">
            <div class="user-info">
              <h3 class="fursona-name">{{ item.fursonaName }}</h3>
              <span class="order-code">{{ item.orderCode }}</span>
            </div>
            
            <div class="gadget-summary">
              <div v-if="item.shirtSize" class="shirt-badge">
                👕 {{ item.shirtSize }}
              </div>
              <div class="items-pills">
                <span v-for="(g, idx) in item.gadgetList" :key="idx" class="gadget-pill">
                  {{ g.quantity }}x {{ g.name }}
                </span>
              </div>
            </div>
          </div>

          <div class="compact-card__status">
            <div :class="['status-indicator', item.gadgetCollectedAt ? 'status--collected' : 'status--pending']">
              {{ item.gadgetCollectedAt ? 'COLLECTED' : 'PENDING' }}
            </div>
          </div>
        </div>
      </div>
    </main>

    <ErrorModal 
      :show="!!error" 
      :message="error" 
      @close="error = ''" 
    />
  </div>
</template>

<style scoped>
.gadgets-page {
  padding-top: var(--spacing-xl);
  max-width: 1200px;
}

.gadgets-page__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  gap: var(--spacing-xl);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
}

.gadgets-page__title {
  font-size: var(--font-size-xl);
  color: var(--color-text);
  margin: 0;
}

.gadgets-page__actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
  justify-content: flex-end;
}

.search-container {
  max-width: 300px;
  width: 100%;
}

.gadgets-page__tabs {
  display: flex;
  gap: 2px;
  background: rgba(255, 255, 255, 0.05);
  padding: 4px;
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-xl);
  width: fit-content;
}

.tab-btn {
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.tab-btn--active {
  background: var(--color-primary);
  color: white;
  box-shadow: var(--shadow-sm);
}

/* COMPACT GRID */
.compact-gadget-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: var(--spacing-md);
}

.compact-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.compact-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.compact-card--collected {
  background: rgba(46, 213, 115, 0.03);
  border-color: rgba(46, 213, 115, 0.2);
}

.compact-card__avatar {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-surface-brighter);
  flex-shrink: 0;
}

.compact-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 800;
  color: var(--color-text-muted);
}

.compact-card__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.user-info {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.fursona-name {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.order-code {
  font-size: 11px;
  color: var(--color-text-muted);
  font-family: monospace;
}

.gadget-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.shirt-badge {
  background: rgba(255, 71, 87, 0.1);
  color: #ff4757;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 800;
}

.items-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.gadget-pill {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-muted);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.compact-card__status {
  padding-left: var(--spacing-sm);
}

.status-indicator {
  font-size: 10px;
  font-weight: 900;
  padding: 4px 8px;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.status--pending {
  background: rgba(255, 165, 2, 0.15);
  color: #ffa502;
}

.status--collected {
  background: rgba(46, 213, 115, 0.15);
  color: #2ed573;
}

.gadgets-page__empty {
  padding: 60px 0;
  text-align: center;
  color: var(--color-text-muted);
}

.loader {
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  border-top: 3px solid var(--color-primary);
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
  margin-inline: auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 900px) {
  .compact-gadget-list {
    grid-template-columns: 1fr;
  }
  .gadgets-page__header {
    flex-direction: column;
    align-items: stretch;
  }
  .gadgets-page__actions {
    flex-direction: row;
  }
}
</style>
