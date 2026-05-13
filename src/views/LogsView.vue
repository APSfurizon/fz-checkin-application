<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getCheckinLogs, getCheckinListId, getCheckinListName, getUserInfo } from '@/services/checkinApi';
import AppInput from '@/components/atoms/AppInput.vue';
import AppButton from '@/components/atoms/AppButton.vue';
import SearchResultItem from '@/components/molecules/SearchResultItem.vue';
import ErrorModal from '@/components/organisms/ErrorModal.vue';

const router = useRouter();
const listId = Number(getCheckinListId());
const loading = ref(false);
const results = ref<any[]>([]);
const nextPage = ref<number | null>(null);
const error = ref('');

const filters = ref({
  createdSince: '',
  createdBefore: '',
  datetimeSince: '',
  datetimeBefore: '',
  successful: '' as any,
  autoCheckedIn: '' as any,
  type: '',
  orderBy: ''
});

const handleSearch = async (reset = false) => {
  if (reset) {
    results.value = [];
    nextPage.value = null;
  }
  
  loading.value = true;
  try {
    const params: any = {
      ...filters.value,
      checkinListId: listId,
      page: nextPage.value || undefined
    };

    // Clean up empty strings or nulls
    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null || params[key] === undefined) {
        delete params[key];
      }
    });

    // Convert booleans from string
    if (params.successful === 'true') params.successful = true;
    if (params.successful === 'false') params.successful = false;
    if (params.autoCheckedIn === 'true') params.autoCheckedIn = true;
    if (params.autoCheckedIn === 'false') params.autoCheckedIn = false;

    // Convert dates to ISO string
    ['createdSince', 'createdBefore', 'datetimeSince', 'datetimeBefore'].forEach(key => {
      if (params[key]) {
        try {
          params[key] = new Date(params[key]).toISOString();
        } catch (e) {
          console.error(`Invalid date for ${key}:`, params[key]);
        }
      }
    });

    const data = await getCheckinLogs(params);
    results.value.push(...(data.results || []));
    nextPage.value = data.next || null;
  } catch (e: any) {
    error.value = e.response?.data?.errors?.[0]?.message || e.message || 'Error loading logs';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (!listId) {
    router.push('/');
    return;
  }
  handleSearch();
});

const handleBack = () => {
  router.push('/operator');
};
</script>

<template>
  <div class="logs-page container">
    <header class="logs-page__header">
      <AppButton variant="ghost" size="sm" @click="handleBack">Back</AppButton>
      <h1 class="logs-page__title">Check-in Logs</h1>
      <p>Logged in as '<i>{{ getUserInfo().fursonaName }}</i>' | List: <i>{{ getCheckinListName() }}</i></p>
    </header>

    <main class="logs-page__content">
      <section class="filters-section">
        <div class="filters-grid">
          <AppInput v-model="filters.createdSince" type="datetime-local" label="Created Since" />
          <AppInput v-model="filters.createdBefore" type="datetime-local" label="Created Before" />
          <AppInput v-model="filters.datetimeSince" type="datetime-local" label="Datetime Since" />
          <AppInput v-model="filters.datetimeBefore" type="datetime-local" label="Datetime Before" />
          
          <div class="field">
            <label class="field__label">Successful</label>
            <select v-model="filters.successful" class="field__input">
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>

          <div class="field">
            <label class="field__label">Auto Checked In</label>
            <select v-model="filters.autoCheckedIn" class="field__input">
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>

          <div class="field">
            <label class="field__label">Type</label>
            <select v-model="filters.type" class="field__input">
              <option value="">All</option>
              <option value="ENTRY">Entry</option>
              <option value="EXIT">Exit</option>
            </select>
          </div>

          <div class="field">
            <label class="field__label">Order By</label>
            <select v-model="filters.orderBy" class="field__input">
              <option value="">Default</option>
              <option value="DATE_TIME">Date Time</option>
              <option value="CREATED_AT">Created At</option>
              <option value="CREATION_ORDER">Creation Order</option>
            </select>
          </div>
        </div>

        <div class="filters-actions">
          <AppButton :loading="loading" @click="handleSearch(true)">Filter Logs</AppButton>
        </div>
      </section>

      <section class="results-section">
        <div v-if="results.length > 0" class="logs-list">
          <SearchResultItem 
            v-for="log in results" 
            :key="log.checkinId + log.createdAt"
            :title="log.user?.fursonaName ? `${log.user.fursonaName} (<i>${log.firstName} ${log.lastName}</i>)` : (log.firstName ? `<i>${log.firstName} ${log.lastName}</i>` : `Check-in ID: ${log.checkinId}`)"
            :subtitle="`${log.orderCode || 'NO-CODE'} | ${new Date(log.createdAt).toLocaleString()} ${log.localizedErrorReason ? ' | ' + log.localizedErrorReason : ''}`"
            :status="log.successful ? 'SUCCESS' : 'FAILED'"
            :statusVariant="log.successful ? 'success' : 'danger'"
            :type-label="log.type.toLowerCase() === 'entry' ? '↑ ENTRY' : '↓ EXIT'"
            :type-variant="log.type.toLowerCase() === 'entry' ? 'success' : 'danger'"
            :show-arrow="false"
            :avatar="log.user?.propic?.mediaUrl"
          />
        </div>
        <div v-else-if="!loading" class="no-results">
          No logs found for the selected filters.
        </div>

        <div v-if="nextPage" class="load-more">
          <AppButton :loading="loading" variant="secondary" @click="handleSearch()">Load more</AppButton>
        </div>
      </section>
    </main>

    <ErrorModal :show="!!error" :message="error" @close="error = ''" />
  </div>
</template>

<style scoped>
.logs-page {
  padding-top: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.logs-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.logs-page__title {
  font-size: var(--font-size-lg);
}

.filters-section {
  background-color: var(--color-surface);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-xl);
  border: 1px solid var(--color-border);
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.filters-actions {
  display: flex;
  justify-content: flex-end;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.no-results {
  text-align: center;
  color: var(--color-text-muted);
  padding: var(--spacing-xl);
}

.load-more {
  margin-top: var(--spacing-lg);
  display: flex;
  justify-content: center;
}

/* Styles for select consistent with AppInput */
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
  height: 42px; /* Match AppInput height approximately */
}

.field__input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(255, 71, 87, 0.1);
}
</style>
