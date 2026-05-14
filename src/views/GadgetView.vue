<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue';
import Swal from 'sweetalert2';
import { useRouter } from 'vue-router';
import { toggleGadget, getUserInfo } from '@/services/checkinApi';
import { useGadgets } from '@/composables/useGadgets';
import AppButton from '@/components/atoms/AppButton.vue';
import AppInput from '@/components/atoms/AppInput.vue';
import ErrorModal from '@/components/organisms/ErrorModal.vue';

const router = useRouter();
const { gadgetCheckins, loading, error, volume, loadGadgets, updateGadgetStatus, startPolling, stopPolling } = useGadgets();
const currentTab = ref<'all' | 'to-collect' | 'collected'>('to-collect');
const searchQuery = ref('');

const filteredCheckins = computed(() => {
  let list = gadgetCheckins.value;
  
  if (currentTab.value === 'to-collect') {
    list = list.filter(c => !c.gadgetCollectedAt);
  } else if (currentTab.value === 'collected') {
    list = list.filter(c => !!c.gadgetCollectedAt);
  }

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
  const { isConfirmed } = await Swal.fire({
    icon: 'warning',
    title: 'Confirm action',
    text: `Are you sure you want to ${action}?`,
    showCancelButton: true,
    confirmButtonText: 'Yes, continue',
    cancelButtonText: 'No'
  });
  if (!isConfirmed) return;
  
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

const getGadgetName = (g: any) => {
  if (!g) return 'Unknown';
  return g.gadgetNames?.en || g.gadgetNames?.it || g.gadgetName || g.name || g.gadgetId || 'Gadget';
};

const currentTime = ref(Date.now());
let timerInterval: any = null;

const isItemNew = (item: any) => {
  if (!item.newUntil) return false;
  return currentTime.value < item.newUntil;
};

onMounted(async () => {
  await loadGadgets();
  startPolling(3000); // Polling ogni 3 secondi
  timerInterval = setInterval(() => {
    currentTime.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  stopPolling();
  if (timerInterval) clearInterval(timerInterval);
});
</script>

<template>
  <div class="gadgets-page container">
    <header class="gadgets-page__header">
      <div class="header-left">
        <AppButton variant="ghost" size="sm" @click="router.push('/operator')">Back</AppButton>
        <h1 class="gadgets-page__title">Gadget Management</h1>
        <p>Logged as '<i>{{ getUserInfo().fursonaName }}</i>' ({{ getUserInfo().userId }})</p>
      </div>
      <div class="gadgets-page__actions">
        <div class="volume-control">
          <span class="volume-icon">{{ volume > 0 ? '🔊' : '🔇' }}</span>
          <input type="range" min="0" max="1" step="0.1" v-model="volume" class="volume-slider" />
        </div>
        <div class="search-container">
          <AppInput v-model="searchQuery" placeholder="Search fursona, name or order..." class="compact-search" />
        </div>
        <AppButton size="sm" @click="loadGadgets">FULL Refresh</AppButton>
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
          :class="{ 
            'compact-card--collected': item.gadgetCollectedAt,
            'compact-card--new': isItemNew(item)
          }"
          @click="handleToggle(item.id, item.gadgetCollectedAt)"
        >
          <div class="compact-card__avatar">
            <img v-if="item.propicUrl" :src="item.propicUrl" :alt="item.fursonaName" />
            <div v-else class="avatar-placeholder">{{ item.fursonaName?.charAt(0) || '?' }}</div>
          </div>
          
          <div class="compact-card__main">
            <div class="user-row">
              <h3 class="fursona-name">{{ item.fursonaName }}</h3>
              <span class="order-code">{{ item.orderCode }}</span>
              <div :class="['status-badge-top', item.gadgetCollectedAt ? 'status--collected' : 'status--pending']">
                {{ item.gadgetCollectedAt ? 'DONE' : 'PENDING' }}
              </div>
            </div>
            
            <div class="gadget-display">
              <div class="gadget-list-inline">
                <div v-for="(g, idx) in item.gadgetList" :key="idx" class="gadget-item">
                  <div class="gadget-item__qty">{{ g.quantity }}x</div>
                  <div class="gadget-item__details">
                    <span class="name">{{ getGadgetName(g) }}</span>
                    <span v-if="g.shirt && item.shirtSize" class="shirt-spec">
                      Size: <strong>{{ item.shirtSize.toUpperCase() }}</strong>
                    </span>
                  </div>
                </div>
                <div v-if="item.gadgetList.length === 0" class="no-gadgets">
                  No gadgets listed.
                </div>
              </div>
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
  max-width: 1300px;
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
  gap: var(--spacing-lg);
  flex: 1;
  justify-content: flex-end;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.volume-icon {
  font-size: 14px;
}

.volume-slider {
  width: 80px;
  height: 4px;
  cursor: pointer;
  accent-color: var(--color-primary);
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

.compact-gadget-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: var(--spacing-md);
}

.compact-card {
  display: flex;
  align-items: stretch;
  gap: var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
  min-height: 110px;
}

.compact-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.compact-card--collected {
  background: rgba(46, 213, 115, 0.02);
  border-color: rgba(46, 213, 115, 0.1);
  opacity: 0.6;
}

@keyframes pulse-new {
  0% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.4); border-color: #ff4757; background: rgba(255, 71, 87, 0.05); }
  50% { box-shadow: 0 0 0 10px rgba(255, 71, 87, 0); border-color: #ff4757; background: rgba(255, 71, 87, 0.1); }
  100% { box-shadow: 0 0 0 0 rgba(255, 71, 87, 0); border-color: #ff4757; background: rgba(255, 71, 87, 0.05); }
}

.compact-card--new {
  animation: pulse-new 1.5s infinite;
  border-color: #ff4757 !important;
  z-index: 10;
}

.compact-card__avatar {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-surface-brighter);
  flex-shrink: 0;
  align-self: center;
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
  font-size: 28px;
  font-weight: 800;
  color: var(--color-text-muted);
}

.compact-card__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fursona-name {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.order-code {
  font-size: 11px;
  color: var(--color-text-muted);
  font-family: monospace;
  flex: 1;
}

.status-badge-top {
  font-size: 9px;
  font-weight: 900;
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.gadget-display {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gadget-list-inline {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gadget-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.03);
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.gadget-item__qty {
  font-weight: 900;
  color: #ff4757;
  font-size: 16px;
  min-width: 30px;
}

.gadget-item__details {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.gadget-item__details .name {
  color: #ffffff;
  font-weight: 700;
  font-size: 14px;
}

.shirt-spec {
  font-size: 11px;
  background: rgba(255, 71, 87, 0.1);
  color: #ff4757;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.shirt-spec strong {
  font-size: 13px;
  font-weight: 900;
}

.no-gadgets {
  font-style: italic;
  color: var(--color-text-muted);
  font-size: 13px;
  padding: 4px;
}

.status--pending {
  background: rgba(255, 165, 2, 0.1);
  color: #ffa502;
  border: 1px solid rgba(255, 165, 2, 0.2);
}

.status--collected {
  background: rgba(46, 213, 115, 0.1);
  color: #2ed573;
  border: 1px solid rgba(46, 213, 115, 0.2);
}

.gadgets-page__empty {
  padding: 80px 0;
  text-align: center;
  color: var(--color-text-muted);
}

.loader {
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  border-top: 3px solid var(--color-primary);
  width: 32px;
  height: 32px;
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
}
</style>

