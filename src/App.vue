<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router'
import ErrorModal from '@/components/organisms/ErrorModal.vue'
import { apiError, dismissApiError } from '@/composables/useApiError'
import { logout } from '@/services/checkinApi'

const router = useRouter()

const onLogout = () => {
  dismissApiError()
  logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="app">
    <RouterView />
    <ErrorModal
      :show="apiError.show"
      :message="apiError.message"
      :code="apiError.code"
      :request-id="apiError.requestId"
      @close="dismissApiError"
      @logout="onLogout"
    />
  </div>
</template>

<style>
/* Global styles can also go here, but we use base.css */
</style>