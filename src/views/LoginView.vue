<template>
  <div class="login-page">
    <div class="login-card">
      <header class="login-card__header">
        <h1 class="login-card__title">Furizon Check-in</h1>
        <p class="login-card__subtitle">Login to start operations</p>
      </header>

      <form class="login-card__form" @submit.prevent="onSubmit">
        <AppInput 
          v-model="email" 
          type="email" 
          label="Email" 
          placeholder="your@email.com" 
        />
        <AppInput 
          v-model="password" 
          type="password" 
          label="Password" 
          placeholder="••••••••" 
        />
        
        <div class="login-card__actions">
          <AppButton 
            type="submit" 
            variant="primary" 
            size="lg" 
            :disabled="!canSubmit || loading"
          >
            {{ loading ? 'Logging in...' : 'Login' }}
          </AppButton>
        </div>
      </form>
    </div>

    <ErrorModal 
      :show="!!errorMsg" 
      :message="errorMsg" 
      @close="errorMsg = ''" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { login as apiLogin } from '@/services/checkinApi';
import { useAuth } from '@/composables/useAuth';
import AppButton from '@/components/atoms/AppButton.vue';
import AppInput from '@/components/atoms/AppInput.vue';
import ErrorModal from '@/components/organisms/ErrorModal.vue';

const email = ref('');
const password = ref('');
const loading = ref(false);
const errorMsg = ref('');
const { login } = useAuth();

const canSubmit = computed(() => !!email.value && !!password.value);

async function onSubmit() {
  if (!canSubmit.value) return;

  loading.value = true;
  errorMsg.value = '';

  try {
    const data = await apiLogin({
      email: email.value,
      password: password.value,
    });

    if (data.token) {
      login(data.token);
    } else {
      errorMsg.value = 'Token not received from server.';
    }
  } catch (error: any) {
    console.error('Login error:', error);
    errorMsg.value = error.response?.data?.message || error.response?.data?.errors?.[0]?.message || 'Invalid credentials or server error.';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg);
}

.login-card {
  background-color: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  padding: var(--spacing-xl);
  border-radius: var(--radius-sm);
  width: 100%;
  max-width: 400px;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.login-card__header {
  text-align: center;
}

.login-card__title {
  color: var(--color-primary);
  font-size: var(--font-size-2xl);
  margin-bottom: var(--spacing-xs);
}

.login-card__subtitle {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.login-card__form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.login-card__actions {
  margin-top: var(--spacing-md);
  display: flex;
  flex-direction: column;
}
</style>