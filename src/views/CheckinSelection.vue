<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getCheckinLists, setCheckinListId, getUserInfo } from '@/services/checkinApi';
import AppButton from '@/components/atoms/AppButton.vue';
import ErrorModal from '@/components/organisms/ErrorModal.vue';

const router = useRouter();
const lists = ref<any[]>([]);
const loading = ref(true);
const error = ref('');

onMounted(async () => {
  try {
    const data = await getCheckinLists();
    lists.value = data.checkinLists || [];
  } catch (e: any) {
    error.value = e.response?.data?.errors?.[0]?.message || 'Failed to load check-in lists';
  } finally {
    loading.value = false;
  }
});

const selectList = (id: number, name: string) => {
  setCheckinListId(id.toString(), name);
  router.push('/operator');
};
</script>

<template>
  <div class="selection-page container">
    <header class="selection-page__header">
      <h1 class="selection-page__title">Furizon Check-in</h1>
      <p class="selection-page__subtitle">Logged in as '{{ getUserInfo().fursonaName }}' (ID: {{ getUserInfo().userId }})</p>
      <p class="selection-page__subtitle">Choose a check-in list to proceed</p>
    </header>

    <div v-if="loading" class="selection-page__loading">
      Loading...
    </div>

    <div v-else class="selection-page__grid">
      <div 
        v-for="list in lists" 
        :key="list.id" 
        class="list-card"
        @click="selectList(list.id, list.name)"
      >
        <h3 class="list-card__title">{{ list.name }}</h3>
        <p class="list-card__info">ID: {{ list.id }} | Progress: {{ list.checkedIn }}/{{ list.total }}</p>
        <div class="list-card__action">
          <AppButton size="sm">Select</AppButton>
        </div>
      </div>
    </div>

    <ErrorModal 
      :show="!!error" 
      :message="error" 
      @close="error = ''" 
    />
  </div>
</template>

<style scoped>
.selection-page {
  padding-top: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xl);
}

.selection-page__header {
  text-align: center;
}

.selection-page__title {
  font-size: var(--font-size-2xl);
  color: var(--color-primary);
  margin-bottom: var(--spacing-sm);
}

.selection-page__subtitle {
  color: var(--color-text-muted);
}

.selection-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
  width: 100%;
}

.list-card {
  background-color: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  padding: var(--spacing-lg);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.list-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.list-card__title {
  font-size: var(--font-size-lg);
}

.list-card__info {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.list-card__action {
  margin-top: auto;
  display: flex;
  justify-content: flex-end;
}
</style>
