<script setup lang="ts">
import { useRouter } from 'vue-router';
import { computed, watch } from 'vue';
import Swal from 'sweetalert2';
import AppBadge from '../atoms/AppBadge.vue';
import AppButton from '../atoms/AppButton.vue';
import { getOperatorId, cancelCheckin, getApsJoinModule, printBadge, getCheckinListId } from '@/services/checkinApi';

interface Props {
  userData: any;
}
const router = useRouter();
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
    const res = await cancelCheckin(
      props.userData.checkinNonce,
      explanation,
      [parseInt(getCheckinListId() || '-1')]
    );
    if (res === true) {
      await Swal.fire({
        icon: 'success',
        title: 'Check-in cancelled',
        text: 'Check-in cancelled successfully.'
      });
      emit('cancelled');
      router.push('/redeem');
    }
  } catch (e: any) {
    await Swal.fire({
      icon: 'error',
      title: 'Cancellation failed',
      text: 'Failed to cancel check-in: ' + (e.response?.data?.errors?.[0]?.message || e.message)
    });
  }
};


const printUserBadge = async () => {
    const opId = getOperatorId();
    const userId = props.userData.user?.userId || props.userData.userId;
    const res = await printBadge(opId, [userId], 'USER_BADGE');
    await Swal.fire({
      icon: res.status === 200 ? 'success' : 'error',
      title: 'Badge print',
      text: res.data.message
    });
}

const printFursuitBadge = async () => {
    const opId = getOperatorId();
    let ids: number[] = [];
    props.userData.fursuits.forEach((f: any) => {
        ids.push(f.fursuit.id);
    });
    const res = await printBadge(opId, ids, 'FURSUIT_BADGE');
    await Swal.fire({
      icon: res.status === 200 ? 'success' : 'error',
      title: 'Badge print',
      text: res.data.message
    });
}

const goToApsModule = async () => {
  const userId = props.userData.user?.userId || props.userData.userId;

  const url = `membership/aps-join-module?id=${encodeURIComponent(String(userId))}`;

  try {
    const res = await getApsJoinModule(userId);

    const html = res;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');

    const cleanup = () => {
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1000);
    };

    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow?.document;
    if (!frameDoc || !iframe.contentWindow) {
      cleanup();
      throw new Error('Unable to initialize print frame.');
    }

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        cleanup();
      }
    };

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();
  } catch (e: any) {
    await Swal.fire({
      icon: 'error',
      title: 'APS module print failed',
      text: 'Failed to load APS module: ' + (e?.message || 'Unknown error')
    });
  }
};

const sponsorshipVariant = computed(() => {
  switch (props.userData.user?.sponsorship || props.userData.sponsorship) {
    case 'ULTRA_SPONSOR': return 'danger';
    case 'SUPER_SPONSOR': return 'warning';
    case 'SPONSOR': return 'info';
    default: return 'default';
  }
});

const reverseDailyDays = computed(() => {
  return [...(props.userData.dailyDays || [])].reverse();
});


// LANYARD COLORS CONFIGURATION
const getLanyardColor = (type: string) => {
  const t = type?.toUpperCase() || '';
  if (t.includes('MAIN') || t.includes('SECURITY')) return '#ff4757';
  if (t.includes('STAFF')) return '#70a1ff';
  if (t.includes('DAILY')) return '#ffffff';
  if (t.includes('ATTENDEE')) return '#2ed573';
  if (t.includes('SUPER_SPONSOR')) return '#ffa502';
  if (t.includes('SPONSOR')) return '#a29bfe';
  if (t.includes('ULTRA_SPONSOR') || t.includes('EXPLORER')) return '#eccc68';
  return '#a4b0be';
};

// PORTABADGE COLORS CONFIGURATION
const getBadgeHolderColor = (type: string) => {
  const t = type?.toUpperCase() || '';
  if (t.includes('MAIN') || t.includes('SECURITY')) return '#ff4757';
  if (t.includes('STAFF')) return '#70a1ff';
  if (t.includes('FURSUIT')) return '#eccc68';
  if (t.includes('DAILY')) return '#2ed573';
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

const getGadgetName = (g: any) => {
  if (!g) return 'Unknown';
  return g.gadgetNames?.en || g.gadgetNames?.it || g.gadgetName || g.name || g.gadgetId || 'Gadget';
};

const birthPlace = computed(() => {
  const parts = [];
  if (props.userData.birthCity) parts.push(props.userData.birthCity);
  if (props.userData.birthRegion) parts.push(`(${props.userData.birthRegion})`);
  if (props.userData.birthCountry) parts.push(props.userData.birthCountry);
  return parts.length > 0 ? parts.join(' ') : '—';
});

const {optionalErrorMessage, localizedErrorReason, status} = props.userData
if(status.toLowerCase() !== 'ok') {
  let text = localizedErrorReason
  if(!!optionalErrorMessage) {
    text+= ". "+optionalErrorMessage
  }
  Swal.fire({
    icon: 'error',
    title: 'Checkin Error',
    text
  })
}

</script>

<template>
  <div class="user-card" :class="{ 'user-card--attention': userData.requiresAttention }">
    <div v-if="userData.requiresAttention" class="attention-banner">
      ⚠️ REQUIRES ATTENTION
    </div>

    <!-- HEADER AREA -->
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
          <span class="user-card__id">User Number: {{ userData.user?.userId || userData.checkinId || userData.userId }}</span>
        </div>
        <div class="user-card__sub-title-row">
          <span v-if="userData.cardsForEvent?.length" class="card-info-label">
            card: {{ userData.cardsForEvent.map((c: any) => c.cardNo).join(', ') }}
          </span>
        </div>
        <div class="user-card__badges">
          <div class="badge-with-label">
            <span class="label">Sponsor type:</span>
            <AppBadge :variant="sponsorshipVariant">{{ userData.sponsorNames?.en || userData.user?.sponsorship || userData.sponsorship || 'NONE' }}</AppBadge>
          </div>
          <AppBadge v-if="userData.user?.staffer || userData.staffer" variant="success">STAFF</AppBadge>
          <AppBadge v-if="userData.user?.dailyTicket || userData.dailyTicket" variant="info">DAILY</AppBadge>
          <AppBadge variant="default" class="status-badge" :class="{'status-badge--ok': userData.status.toLowerCase() === 'ok' || !userData.status}">Check-in status: {{ userData.status || 'OK' }}</AppBadge>
        </div>
      </div>
      <div class="user-card__order-info">
        <div class="order-code">{{ userData.orderCode }}</div>
        <div class="order-no">order no: {{ userData.orderSerial }}</div>
      </div>
    </div>

    <!-- NOTES / ALERTS (Integrated more closely to header) -->
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

    <!-- QUICK ACTIONS & CONFIG (Lanyard, Holder, Print) -->
    <div class="quick-config-actions">
      <div class="config-grid-horizontal">
        <div class="config-item">
          <label>Lanyard Type</label>
          <div 
            class="type-pill-wide" 
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
            class="type-pill-wide" 
            :style="{ 
              backgroundColor: getBadgeHolderColor(userData.portaBadgeType),
              color: getContrastColor(getBadgeHolderColor(userData.portaBadgeType))
            }"
          >
            {{ userData.portaBadgeType || 'STANDARD' }}
          </div>
        </div>
      </div>

      <div class="print-actions-row">
        <AppButton variant="primary" size="lg" @click="printUserBadge">PRINT STANDARD BADGE</AppButton>
        <AppButton 
          v-if="userData.hasFursuitBadge" 
          variant="primary"
          size="lg"
          @click="printFursuitBadge"
        >
          PRINT FURSUIT BADGE
        </AppButton>
        <AppButton 
          v-if="userData.shouldPrintApsJoinModule" 
          variant="primary"
          @click="goToApsModule"
        >
          PRINT APS MODULE
        </AppButton>
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
                <div class="fursuit-header">
                  <span class="fursuit-name">{{ f.fursuit?.name }}</span>
                  <span class="fursuit-id">#{{ f.fursuit?.id || "-" }}</span>
                </div>
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

        <!-- ROOM DATA -->
        <section v-if="userData.roomInfo" class="info-section">
          <h4 class="info-section__title">Room Data</h4>
          <div class="room-info">
            <div class="room-header">
              <strong>{{ userData.roomInfo.roomData?.roomTypeNames?.en || 'Accommodation' }}</strong>
              <div class="room-badges">
                <AppBadge v-if="userData.roomInfo.userIsOwner" variant="success">Owner</AppBadge>
                <AppBadge v-if="userData.roomInfo.confirmed" :variant="userData.roomInfo.confirmed ? 'success' : 'warning'">
                  {{ userData.roomInfo.confirmed ? 'Confirmed' : 'Pending' }}
                </AppBadge>
              </div>
            </div>
            <div class="room-details">
              <span>Capacity: {{ userData.roomInfo.roomData?.roomCapacity }}</span>
              <span>Board: {{ userData.roomInfo.board }}</span>
              <span v-if="userData.roomInfo.extraDays !== 'NONE'">Extra days: {{ userData.roomInfo.extraDays }}</span>
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

        <section v-if="userData.dailyTicket" class="info-section">
          <h4 class="info-section__title">Daily days</h4>
          <span>Today is {{ new Date().toISOString().split('T')[0] }}</span>
          <ul class="daily-days-list">
            <li v-for="(d, idx) in reverseDailyDays" :key="idx">{{ d }}</li>
          </ul>
        </section>
      </div>

      <!-- GADGETS -->
      <section v-if="userData.gadgets?.length" class="info-section">
        <h4 class="info-section__title">Gadgets ({{ userData.gadgets.length }})</h4>
        <div class="gadget-grid-visual">
          <div 
            v-for="gadget in userData.gadgets" 
            :key="gadget.gadgetId" 
            class="gadget-card-mini"
            :class="{ 'gadget-card-mini--shirt': gadget.shirt }"
          >
            <div class="gadget-card-mini__qty">{{ gadget.quantity }}x</div>
            <div class="gadget-card-mini__content">
              <span class="gadget-card-mini__name">{{ getGadgetName(gadget) }}</span>
              <span v-if="gadget.shirt && userData.shirtSize" class="gadget-card-mini__shirt-label">
                SIZE: <strong>{{ userData.shirtSize.toUpperCase() }}</strong>
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- BOTTOM ACTIONS -->
    <div class="user-card__footer">
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
  gap: 4px;
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

.user-card__sub-title-row {
  margin-top: -4px;
  margin-bottom: 4px;
}

.card-info-label {
  font-size: 13px;
  color: #7bed9f;
  font-weight: 600;
  text-transform: lowercase;
}

.user-card__badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.badge-with-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.badge-with-label .label {
  font-size: 11px;
  font-weight: 800;
  color: var(--color-text-muted);
  text-transform: uppercase;
}

.status-badge {
  font-weight: 900;
  letter-spacing: 1px;
  font-size: 1.2em;
  position: absolute;
  right: 10px;
  top: 10px;
  background-color: var(--color-warning);
  color: black;
}

.status-badge--ok {
  background-color: var(--color-success);
}

.user-card__order-info {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
}

.order-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 900;
  color: #ffffff;
}

.order-no {
  font-size: 13px;
  color: var(--color-text-muted);
  font-weight: 600;
  text-transform: lowercase;
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

.quick-config-actions {
  padding: var(--spacing-xl);
  background: rgba(255, 255, 255, 0.01);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.config-grid-horizontal {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-item label {
  font-size: 10px;
  text-transform: uppercase;
  font-weight: 800;
  color: var(--color-text-muted);
  letter-spacing: 1px;
}

.type-pill-wide {
  padding: 12px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 900;
  text-align: center;
  text-transform: uppercase;
  box-shadow: var(--shadow-sm);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.print-actions-row {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

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

.daily-days-list {
  margin-left: 0;
  padding-left: 1.5em;
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
  position: relative;
}

.fursuit-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  width: 100%;
  position: relative;
}

.fursuit-id {
  font-size: 10px;
  font-weight: 900;
  color: var(--color-primary);
  opacity: 0.8;
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

.fursuit-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
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

.gadget-grid-visual {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.gadget-card-mini {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.gadget-card-mini--shirt {
  border-color: rgba(255, 71, 87, 0.3);
  background: rgba(255, 71, 87, 0.05);
}

.gadget-card-mini__qty {
  background: var(--color-primary);
  color: white;
  padding: 12px;
  font-weight: 900;
  font-size: 18px;
  min-width: 50px;
  text-align: center;
}

.gadget-card-mini--shirt .gadget-card-mini__qty {
  background: #ff4757;
}

.gadget-card-mini__content {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
}

.gadget-card-mini__name {
  font-weight: 700;
  font-size: 14px;
}

.gadget-card-mini__shirt-label {
  font-size: 10px;
  font-weight: 900;
  color: #ff4757;
  letter-spacing: 1px;
}

.user-card__footer {
  padding: var(--spacing-xl);
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
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
