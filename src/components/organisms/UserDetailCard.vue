<script setup lang="ts">
import { computed } from 'vue';
import AppBadge from '../atoms/AppBadge.vue';
import AppButton from '../atoms/AppButton.vue';
import { getOperatorId, cancelCheckin } from '@/services/checkinApi';

interface Props {
  userData: any;
}

const props = defineProps<Props>();
const emit = defineEmits(['print-badge', 'cancelled']);

const print = (type: 'standard' | 'fursuit') => {
  const opId = getOperatorId();
  const timestamp = Date.now();
  const orderCode = props.userData.orderCode;
  const printId = `${orderCode}_${opId}_${type}_${timestamp}`;
  emit('print-badge', { type, printId });
};

const handleCancel = async () => {
  const explanation = window.prompt('Please provide an explanation for cancelling this check-in:');
  if (explanation === null) return;

  try {
    const res = await cancelCheckin({
      checkinNonce: props.userData.checkinNonce,
      checkinListId: props.userData.checkinListId,
      explanation
    });
    if (res.status === 'ok' || res.success) {
      alert('Check-in cancelled successfully.');
      emit('cancelled');
    }
  } catch (e: any) {
    alert('Failed to cancel check-in: ' + (e.response?.data?.errors?.[0]?.message || e.message));
  }
};

const goToApsModule = () => {
  window.open('/membership/aps-join-module', '_blank');
};

const sponsorshipVariant = computed(() => {
  switch (props.userData.user?.sponsorship || props.userData.sponsorship) {
    case 'ULTRA_SPONSOR': return 'danger';
    case 'SUPER_SPONSOR': return 'warning';
    case 'SPONSOR': return 'info';
    default: return 'default';
  }
});

const getLanyardColor = (type: string) => {
  const t = type?.toUpperCase() || '';
  if (t.includes('MAIN') || t.includes('SECURITY')) return '#ff4757'; // Rosso
  if (t.includes('STAFF')) return '#70a1ff'; // Azzurro
  if (t.includes('DAILY')) return '#ffffff'; // Bianco
  if (t.includes('ATTENDEE')) return '#2ed573'; // Verde
  if (t.includes('SUPER_SPONSOR')) return '#ffa502'; // Arancione
  if (t.includes('SPONSOR')) return '#a29bfe'; // Viola
  if (t.includes('ULTRA_SPONSOR') || t.includes('EXPLORER')) return '#eccc68'; // Giallo (Explorer)
  return '#a4b0be';
};

const getBadgeHolderColor = (type: string) => {
  const t = type?.toUpperCase() || '';
  if (t.includes('MAIN') || t.includes('SECURITY')) return '#ff4757'; // Rosso
  if (t.includes('STAFF')) return '#70a1ff'; // Azzurro
  if (t.includes('FURSUIT')) return '#eccc68'; // Giallo
  if (t.includes('DAILY')) return '#2ed573'; // Verde
  return '#2f3542';
};

const getContrastColor = (hexColor: string) => {
  if (!hexColor) return '#ffffff';
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155 ? '#000000' : '#ffffff';
};

const birthPlace = computed(() => {
  const parts = [];
  if (props.userData.birthCity) parts.push(props.userData.birthCity);
  if (props.userData.birthRegion) parts.push(`(${props.userData.birthRegion})`);
  if (props.userData.birthCountry) parts.push(props.userData.birthCountry);
  return parts.length > 0 ? parts.join(' ') : '—';
});
</script>

<template>
  <div class="user-card" :class="{ 'user-card--attention': userData.requiresAttention }">
    <div v-if="userData.requiresAttention" class="attention-banner">
      ⚠️ REQUIRES ATTENTION
    </div>

    <!-- HEADER -->
    <div class="user-card__header">
      <div class="user-card__avatar">
        <img v-if="userData.user?.propic" :src="userData.user.propic.mediaUrl" alt="Propic" />
        <div v-else class="user-card__avatar-placeholder">
          {{ (userData.user?.fursonaName || userData.fursonaName || '?').charAt(0) }}
        </div>
      </div>
      <div class="user-card__main-info">
        <div class="user-card__title-row">
          <h2 class="user-card__name">{{ userData.user?.fursonaName || userData.fursonaName }}</h2>
          <span class="user-card__id">ID: {{ userData.user?.userId || userData.checkinId || userData.userId }}</span>
        </div>
        <div class="user-card__badges">
          <AppBadge :variant="sponsorshipVariant">{{ userData.user?.sponsorship || userData.sponsorship || 'NONE' }}</AppBadge>
          <AppBadge v-if="userData.user?.staffer || userData.staffer" variant="success">STAFF</AppBadge>
          <AppBadge v-if="userData.user?.dailyTicket || userData.dailyTicket" variant="info">DAILY</AppBadge>
          <AppBadge variant="default">#{{ userData.orderSerial }}</AppBadge>
          <AppBadge variant="default" class="status-badge">{{ userData.status || 'OK' }}</AppBadge>
        </div>
      </div>
      <div class="user-card__order-info">
        <div class="order-code">{{ userData.orderCode }}</div>
        <div v-if="userData.cardsForEvent?.length" class="card-no">
          Cards: {{ userData.cardsForEvent.map((c: any) => c.cardNo).join(', ') }}
        </div>
      </div>
    </div>

    <!-- NOTES -->
    <div v-if="userData.customerNote || userData.internalNote || userData.checkinTexts?.length" class="notes-grid">
      <div v-if="userData.customerNote" class="note-box note-box--customer">
        <label>Customer Note</label>
        <p>{{ userData.customerNote }}</p>
      </div>
      <div v-if="userData.internalNote" class="note-box note-box--internal">
        <label>Internal Note</label>
        <p>{{ userData.internalNote }}</p>
      </div>
      <div v-if="userData.checkinTexts?.length" class="note-box note-box--checkin">
        <label>Check-in Info</label>
        <ul>
          <li v-for="(text, idx) in userData.checkinTexts" :key="idx">{{ text }}</li>
        </ul>
      </div>
    </div>

    <div class="user-card__content">
      <!-- PERSONAL INFO -->
      <section class="info-section">
        <h4 class="info-section__title">Personal Information</h4>
        <div class="info-grid">
          <div class="info-item">
            <label>Full Name</label>
            <span>{{ userData.firstName || '—' }} {{ userData.lastName || '' }}</span>
          </div>
          <div class="info-item">
            <label>Birth Date</label>
            <span>{{ userData.birthday || '—' }}</span>
          </div>
          <div class="info-item">
            <label>Fiscal Code</label>
            <span class="mono">{{ userData.fiscalCode || '—' }}</span>
          </div>
          <div class="info-item">
            <label>Birth Place</label>
            <span>{{ birthPlace }}</span>
          </div>
          <div class="info-item">
            <label>ID Document</label>
            <span>{{ userData.idType || '—' }} | {{ userData.idNumber || '—' }}</span>
          </div>
          <div class="info-item">
            <label>ID Expiry</label>
            <span>{{ userData.idExpiry || '—' }}</span>
          </div>
          <div class="info-item">
            <label>ID Issuer</label>
            <span>{{ userData.idIssuer || '—' }}</span>
          </div>
          <div class="info-item info-item--highlight">
            <label>T-Shirt Size</label>
            <strong class="shirt-size">{{ (userData.shirtSize || '—').toUpperCase() }}</strong>
          </div>
        </div>
      </section>

      <!-- CONFIGURATION -->
      <section class="info-section">
        <h4 class="info-section__title">Lanyard & Badge Holder</h4>
        <div class="config-grid">
          <div class="config-item">
            <label>Lanyard Type</label>
            <div 
              class="type-pill" 
              :style="{ 
                backgroundColor: getLanyardColor(userData.lanyardType),
                color: getContrastColor(getLanyardColor(userData.lanyardType))
              }"
            >
              {{ userData.lanyardType || 'STANDARD' }}
            </div>
          </div>
          <div class="config-item">
            <label>Badge Holder</label>
            <div 
              class="type-pill" 
              :style="{ 
                backgroundColor: getBadgeHolderColor(userData.portaBadgeType),
                color: getContrastColor(getBadgeHolderColor(userData.portaBadgeType))
              }"
            >
              {{ userData.portaBadgeType || 'STANDARD' }}
            </div>
          </div>
        </div>
      </section>

      <div class="sub-grid">
        <!-- FURSUITS -->
        <section v-if="userData.fursuits?.length" class="info-section">
          <h4 class="info-section__title">Fursuits ({{ userData.fursuits.length }})</h4>
          <div class="fursuit-list">
            <div v-for="(f, idx) in userData.fursuits" :key="idx" class="fursuit-item">
              <div class="fursuit-item__avatar">
                <img v-if="f.fursuit?.propic" :src="f.fursuit.propic.mediaUrl" />
                <div v-else class="avatar-placeholder">{{ f.fursuit?.name?.charAt(0) || '?' }}</div>
              </div>
              <div class="fursuit-info">
                <span class="fursuit-name">{{ f.fursuit?.name }}</span>
                <span class="fursuit-specie">{{ f.fursuit?.species || f.fursuit?.specie }}</span>
                <div class="fursuit-badges">
                  <AppBadge v-if="f.bringingToEvent" size="sm" variant="success">Bringing</AppBadge>
                  <AppBadge v-if="f.fursuit?.sponsorship && f.fursuit.sponsorship !== 'NONE'" size="sm" variant="info">
                    {{ f.fursuit.sponsorship }}
                  </AppBadge>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ROOM -->
        <section v-if="userData.roomInfo" class="info-section">
          <h4 class="info-section__title">Room Data</h4>
          <div class="room-info">
            <div class="room-header">
              <strong>{{ userData.roomInfo.roomData?.roomTypeNames?.en || 'Accommodation' }}</strong>
              <div class="room-badges">
                <AppBadge v-if="userData.roomInfo.userIsOwner" variant="primary">Owner</AppBadge>
                <AppBadge :variant="userData.roomInfo.confirmed ? 'success' : 'warning'">
                  {{ userData.roomInfo.confirmed ? 'Confirmed' : 'Pending' }}
                </AppBadge>
              </div>
            </div>
            <div class="room-details">
              <span>Capacity: {{ userData.roomInfo.roomData?.roomCapacity }}</span>
              <span>Board: {{ userData.roomInfo.board }}</span>
              <span v-if="userData.roomInfo.extraDays !== 'NONE'">Extra: {{ userData.roomInfo.extraDays }}</span>
            </div>
            <div class="room-dates">
              📅 {{ userData.roomInfo.checkinDate }} to {{ userData.roomInfo.checkoutDate }}
            </div>
            <div v-if="userData.roomInfo.guests?.length" class="room-guests">
              <label>Roommates ({{ userData.roomInfo.guests.length }})</label>
              <div class="room-guests-list">
                <div v-for="g in userData.roomInfo.guests" :key="g.user.userId" class="roommate-item">
                  <div class="roommate-avatar">
                    <img v-if="g.user.propic" :src="g.user.propic.mediaUrl" />
                    <div v-else class="avatar-placeholder-xs">{{ g.user.fursonaName.charAt(0) }}</div>
                  </div>
                  <div class="roommate-info">
                    <span class="roommate-name">{{ g.user.fursonaName }}</span>
                    <AppBadge v-if="g.user.sponsorship && g.user.sponsorship !== 'NONE'" size="sm" variant="info">
                      {{ g.user.sponsorship }}
                    </AppBadge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section v-else class="info-section">
          <h4 class="info-section__title">Room Data</h4>
          <div class="no-data">No room information available.</div>
        </section>
      </div>

      <!-- GADGETS -->
      <section v-if="userData.gadgets?.length" class="info-section">
        <h4 class="info-section__title">Gadgets ({{ userData.gadgets.length }})</h4>
        <ul class="gadget-list">
          <li v-for="gadget in userData.gadgets" :key="gadget.gadgetId">
            <strong>{{ gadget.quantity }}x</strong> {{ gadget.gadgetNames?.en || gadget.gadgetNames?.it || gadget.gadgetId }}
            <span v-if="gadget.shirt" class="badge-shirt">👕 SHIRT</span>
          </li>
        </ul>
      </section>
    </div>

    <!-- ACTIONS -->
    <div class="user-card__actions">
      <AppButton variant="primary" size="lg" @click="print('standard')">PRINT STANDARD BADGE</AppButton>
      <AppButton 
        v-if="userData.hasFursuitBadge" 
        variant="secondary" 
        size="lg"
        @click="print('fursuit')"
      >
        PRINT FURSUIT BADGE
      </AppButton>
      <AppButton 
        v-if="userData.shouldPrintApsJoinModule" 
        variant="ghost" 
        @click="goToApsModule"
      >
        PRINT APS MODULE
      </AppButton>
      
      <div class="spacer"></div>
      
      <AppButton 
        variant="danger" 
        size="sm"
        @click="handleCancel"
      >
        CANCEL CHECK-IN
      </AppButton>
    </div>
  </div>
</template>

<style scoped>
.user-card {
  background-color: #1a1d23;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  position: relative;
  color: #f1f2f6;
  max-width: 900px;
  margin: 0 auto;
}

.user-card--attention {
  border: 2px solid var(--color-error);
}

.attention-banner {
  background-color: var(--color-error);
  color: white;
  text-align: center;
  padding: 6px;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: 2px;
}

.user-card__header {
  padding: var(--spacing-xl);
  display: flex;
  align-items: center;
  gap: var(--spacing-xl);
  background-color: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.user-card__avatar {
  width: 90px;
  height: 90px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 3px solid rgba(255, 255, 255, 0.1);
  box-shadow: var(--shadow-md);
  flex-shrink: 0;
}

.user-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-card__avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: 900;
  background: var(--color-background-soft);
  color: var(--color-text-muted);
}

.user-card__main-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.user-card__title-row {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-md);
}

.user-card__name {
  font-size: 32px;
  font-weight: 900;
  margin: 0;
  color: #ff4757;
  text-transform: uppercase;
}

.user-card__id {
  font-size: 14px;
  color: var(--color-text-muted);
  font-weight: 600;
}

.user-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.status-badge {
  font-weight: 900;
  letter-spacing: 1px;
}

.user-card__order-info {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.order-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 900;
  color: #ffffff;
}

.card-no {
  font-size: 12px;
  color: var(--color-text-muted);
  font-weight: 500;
}

.notes-grid {
  padding: var(--spacing-md) var(--spacing-xl);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-md);
  background-color: rgba(255, 71, 87, 0.08);
}

.note-box {
  padding: 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  line-height: 1.4;
}

.note-box label {
  display: block;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
  margin-bottom: 6px;
  opacity: 0.8;
  letter-spacing: 1px;
}

.note-box--customer { background: rgba(30, 144, 255, 0.15); color: #70a1ff; border-left: 3px solid #1e90ff; }
.note-box--internal { background: rgba(255, 165, 2, 0.15); color: #eccc68; border-left: 3px solid #ffa502; }
.note-box--checkin { background: rgba(46, 213, 115, 0.15); color: #7bed9f; border-left: 3px solid #2ed573; }

.user-card__content {
  padding: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.info-section__title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 2px;
  font-weight: 900;
  color: var(--color-text-muted);
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 8px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item label {
  font-size: 9px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.info-item span {
  font-size: 14px;
  color: #ffffff;
  font-weight: 600;
}

.mono { font-family: 'JetBrains Mono', monospace; font-size: 12px !important; }

.info-item--highlight .shirt-size {
  font-size: 28px;
  color: #ff4757;
  font-weight: 900;
  line-height: 1;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 32px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-item label {
  font-size: 11px;
  text-transform: uppercase;
  font-weight: 800;
  color: var(--color-text-muted);
}

.type-pill {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 800;
  color: white;
  text-align: center;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  display: inline-block;
  box-shadow: var(--shadow-sm);
  border: 1px solid rgba(255, 255, 255, 0.1);
  text-transform: uppercase;
}

.sub-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
}

.fursuit-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fursuit-item {
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(255, 255, 255, 0.03);
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.fursuit-item__avatar {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  background: #2f3542;
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.fursuit-item__avatar img {
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

.fursuit-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.fursuit-name {
  font-weight: 800;
  font-size: 16px;
  color: #ffffff;
}

.fursuit-specie {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}

.fursuit-badges {
  display: flex;
  gap: 4px;
}

.no-data {
  padding: 20px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-style: italic;
  text-align: center;
  font-size: 13px;
}

.badge-shirt {
  font-size: 10px;
  background: #ff4757;
  color: white;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 900;
  margin-left: 8px;
}

.room-info {
  background: rgba(255, 255, 255, 0.03);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.room-badges {
  display: flex;
  gap: 6px;
}

.room-details {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: #ffffff;
}

.room-details span {
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 8px;
  border-radius: 4px;
}

.room-dates {
  font-size: 13px;
  color: #7bed9f;
  font-weight: 600;
}

.room-guests {
  margin-top: 8px;
}

.room-guests label {
  font-size: 10px;
  text-transform: uppercase;
  font-weight: 800;
  color: var(--color-text-muted);
  display: block;
  margin-bottom: 8px;
}

.room-guests-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.roommate-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.03);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
}

.roommate-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--color-surface-brighter);
  flex-shrink: 0;
}

.roommate-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.roommate-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.roommate-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
}

.avatar-placeholder-xs {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--color-text-muted);
  background: rgba(255, 255, 255, 0.05);
}

.gadget-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  list-style: none;
  padding: 0;
}

.gadget-list li {
  background: rgba(255, 255, 255, 0.03);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.user-card__actions {
  padding: var(--spacing-xl);
  background-color: rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.spacer { 
  flex: 1; 
  min-width: var(--spacing-md);
}

.no-data {
  padding: 30px 20px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-style: italic;
  text-align: center;
  font-size: 14px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
}
</style>


