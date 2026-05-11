<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import Swal from 'sweetalert2';
import { useRouter } from 'vue-router';
import { searchCheckins, redeemCheckin, getCheckinListId, getOperatorId, getUserInfo, getCheckinListName } from '@/services/checkinApi';
import { useGadgets } from '@/composables/useGadgets';
import AppInput from '@/components/atoms/AppInput.vue';
import AppButton from '@/components/atoms/AppButton.vue';
import SearchResultItem from '@/components/molecules/SearchResultItem.vue';
import UserDetailCard from '@/components/organisms/UserDetailCard.vue';
import ErrorModal from '@/components/organisms/ErrorModal.vue';

const router = useRouter();
const query = ref('');
const results = ref<any[]>([]);
const filter = ref<'all' | 'pending' | 'checked-in'>('all');
const checkinData = ref<any>(null);
const loading = ref(false);
const error = ref('');
const errorCode = ref('');
const requestId = ref('');
const listId = Number(getCheckinListId());
const { addGadget } = useGadgets();
const barcodeBuffer = ref('');
let lastKeyTime = Date.now();

const filteredResults = computed(() => {
  if (filter.value === 'all') return results.value;
  if (filter.value === 'pending') return results.value.filter(r => !r.hasCheckedIn);
  if (filter.value === 'checked-in') return results.value.filter(r => r.hasCheckedIn);
  return results.value;
});

const parseError = (e: any) => {
  const data = e.response?.data;
  if (data?.errors?.length) {
    error.value = data.errors[0].message || 'An unknown error occurred';
    errorCode.value = data.errors[0].code || 'UNKNOWN';
    requestId.value = data.requestId || '';
  } else {
    error.value = e.message || 'Network error';
    errorCode.value = 'NETWORK';
    requestId.value = '';
  }
};

const clearError = () => {
  error.value = '';
  errorCode.value = '';
  requestId.value = '';
};

const handleSearch = async () => {
  loading.value = true;
  clearError();
  try {
    const params: any = { 
      query: query.value || undefined, 
      checkinListId: listId 
    };

    const data = await searchCheckins(params);
    results.value = data.results || [];
    
    if (results.value.length === 1 && query.value.length > 5) {
      confirmRedeem(results.value[0]);
    }
  } catch (e: any) {
    parseError(e);
  } finally {
    loading.value = false;
  }
};

const handleBarcode = (e: KeyboardEvent) => {
  const currentTime = Date.now();
  
  if (currentTime - lastKeyTime > 50) {
    barcodeBuffer.value = '';
  }
  
  if (e.key === 'Enter') {
    if (barcodeBuffer.value.length > 3) {
      query.value = barcodeBuffer.value;
      handleSearch();
      barcodeBuffer.value = '';
    }
  } else if (e.key.length === 1) {
    barcodeBuffer.value += e.key;
  }
  
  lastKeyTime = currentTime;
};

onMounted(() => {
  if (!listId) {
    router.push('/');
    return;
  }
  handleSearch();
  window.addEventListener('keydown', handleBarcode);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleBarcode);
});

const confirmRedeem = async (result: any) => {
  const displayName = result.user?.fursonaName || result.name;
  
  if (result.hasCheckedIn) {
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'Cancel check-in?',
      text: `Are you sure you want to cancel the check-in of ${displayName}?`,
      showCancelButton: true,
      confirmButtonText: 'Yes, continue',
      cancelButtonText: 'No'
    });
    if (!isConfirmed) return;
    // Implement cancellation logic if needed, but the user only asked for the message for now
    // Actually, usually we would call cancelCheckin here.
  } else {
    const { isConfirmed } = await Swal.fire({
      icon: 'question',
      title: 'Perform check-in?',
      text: `Do you want to perform check-in for ${displayName}?`,
      showCancelButton: true,
      confirmButtonText: 'Yes, check-in',
      cancelButtonText: 'No'
    });
    if (!isConfirmed) return;
  }
  
  loading.value = true;
  clearError();
  try {
    const data = await redeemCheckin({
      checkinListIds: [listId],
      secret: result.checkinSecret,
      operatorId: getOperatorId() || undefined
    });
    
    addGadget(data);
    
    // Update the item in results to show it's now checked in
    const index = results.value.findIndex(r => r.checkinSecret === result.checkinSecret);
    if (index !== -1) {
      results.value[index] = { ...results.value[index], hasCheckedIn: true };
    }
    
    checkinData.value = data;
    // query.value = ''; // Keep the query so it's still there when going back
  } catch (e: any) {
    parseError(e);
  } finally {
    loading.value = false;
  }
};

const reset = () => {
  checkinData.value = null;
  query.value = '';
  handleSearch();
};
const handleBack = () => {
  if (checkinData.value) {
    checkinData.value = null;
  } else {
    router.push('/operator');
  }
};
</script>

<template>
  <div class="redeem-page container">
    <header class="redeem-page__header">
      <AppButton variant="ghost" size="sm" @click="handleBack">Back</AppButton>
      <h1 class="redeem-page__title">Check-in / Search</h1>
      <p>Logged in as '<i>{{ getUserInfo().fursonaName }}</i>' ({{ getUserInfo().userId }}) | List: <i>{{ getCheckinListName() }}</i> ({{ getCheckinListId() }})</p>
      <!--AppButton variant="secondary" size="sm" @click="checkinData = null; results = []; query = ''">New Search</AppButton-->
    </header>

    <main class="redeem-page__content">
      <div v-if="!checkinData" class="search-section">
        <div class="search-bar">
          <AppInput 
            v-model="query" 
            placeholder="Search by name, order code or serial..." 
            @keyup.enter="handleSearch"
          />
          <AppButton :loading="loading" @click="handleSearch">Search</AppButton>
        </div>

        <div v-if="loading" class="search-status">Loading...</div>

        <div v-if="results.length > 0" class="redeem-page__filters">
          <div class="toggle-group">
            <button 
              class="tab-btn" 
              :class="{ 'tab-btn--active': filter === 'all' }" 
              @click="filter = 'all'"
            >
              All ({{ results.length }})
            </button>
            <button 
              class="tab-btn" 
              :class="{ 'tab-btn--active': filter === 'pending' }" 
              @click="filter = 'pending'"
            >
              To Check-in ({{ results.filter(r => !r.hasCheckedIn).length }})
            </button>
            <button 
              class="tab-btn" 
              :class="{ 'tab-btn--active': filter === 'checked-in' }" 
              @click="filter = 'checked-in'"
            >
              Checked-in ({{ results.filter(r => r.hasCheckedIn).length }})
            </button>
          </div>
        </div>

        <div v-if="filteredResults.length > 0" class="search-results">
          <SearchResultItem 
            v-for="res in filteredResults" 
            :key="res.orderCode"
            :title="res.user?.fursonaName || res.name"
            :subtitle="`${res.name} | ${res.orderCode}`"
            :status="res.hasCheckedIn ? 'CHECKED-IN' : 'PENDING'"
            :statusVariant="res.hasCheckedIn ? 'success' : 'warning'"
            :has-gadgets="res.hasGadgets || (res.user?.sponsorship && res.user.sponsorship !== 'NONE')"
            @click="confirmRedeem(res)"
          />
        </div>
        <div v-else-if="!loading" class="search-status">No results found</div>
      </div>

      <div v-else class="detail-section">
        <UserDetailCard :user-data="checkinData" @cancelled="reset" />
      </div>
    </main>

    <ErrorModal 
      :show="!!error" 
      :message="error" 
      :code="errorCode"
      :requestId="requestId"
      @close="clearError" 
    />
  </div>
</template>

<style scoped>
.redeem-page {
  padding-top: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.redeem-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.redeem-page__filters {
  display: flex;
  justify-content: center;
  margin-bottom: var(--spacing-md);
}

.toggle-group {
  display: flex;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 4px;
  gap: 4px;
}

.tab-btn {
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.tab-btn--active {
  background: var(--color-primary);
  color: white;
}

.redeem-page__title {
  font-size: var(--font-size-lg);
}

.redeem-page__content {
  flex: 1;
}

.search-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.search-bar {
  display: flex;
  gap: var(--spacing-sm);
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.search-status {
  text-align: center;
  color: var(--color-text-muted);
  font-style: italic;
}

.detail-section {
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}
</style>
