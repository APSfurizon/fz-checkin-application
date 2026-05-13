<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getOperatorId, setOperatorId, getCheckinListId, getCheckinListName, logout, getUserInfo } from '@/services/checkinApi';
import AppButton from '@/components/atoms/AppButton.vue';
import AppInput from '@/components/atoms/AppInput.vue';

const router = useRouter();
const operatorId = ref(getOperatorId() || '');
const listId = ref(getCheckinListId());
const listName = ref(getCheckinListName());

onMounted(() => {
  if (!listId.value) {
    router.push('/');
  }
});

const proceed = (target: string) => {
  console.log('Navigating to:', target, 'with operator:', operatorId.value);
  setOperatorId(parseInt(operatorId.value));
  router.push(target).catch(err => {
    console.error('Navigation error:', err);
  });
};
</script>

<template>
  <div class="operator-page container">
    <div class="operator-card">
      <header class="operator-card__header">
        <div class="header-center">
          <AppButton variant="ghost" size="sm" @click="router.push('/')">Back</AppButton>
          <AppButton variant="ghost" size="sm" @click="logout">Logout</AppButton>
        </div>
        <h2>Operator Setup</h2>
        <p>Enter your ID and choose an operation</p>
      </header>

      <div class="operator-card__body">
        <AppInput 
          v-model="operatorId" 
          type="number" 
          label="Operator ID" 
          placeholder="e.g. 123"
        />

        <div class="operator-card__actions">
          <AppButton 
            variant="primary" 
            :disabled="!operatorId"
            @click="proceed('/redeem')"
          >
            Search & Redeem
          </AppButton>
          
          <AppButton 
            variant="secondary" 
            :disabled="!operatorId"
            @click="proceed('/gadgets')"
          >
            Manage Gadgets
          </AppButton>
          
          <AppButton 
            variant="secondary" 
            :disabled="!operatorId"
            @click="proceed('/logs')"
          >
            View Logs
          </AppButton>

          <AppButton 
            variant="ghost" 
            size="sm"
            @click="router.push('/')"
          >
            Change List [{{listName}} ({{ listId }})]
          </AppButton>

          <p>Logged in as '{{ getUserInfo().fursonaName }}' (ID: {{ getUserInfo().userId }})</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.operator-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.operator-card {
  background-color: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  padding: var(--spacing-xl);
  border-radius: var(--radius-sm);
  width: 100%;
  max-width: 450px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  box-shadow: var(--shadow-lg);
}

.operator-card__header {
  padding: var(--spacing-xl);
  border-bottom: var(--border-width) solid var(--color-border);
  text-align: center;
}

.header-top {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xs);
}

.header-top h2 {
  flex: 1;
  margin: 0;
  margin-right: 60px; /* Offset to center title better */
}

.operator-card__header p {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.operator-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.operator-card__actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
</style>
