<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ref, computed, watch, nextTick } from 'vue';
import Swal from 'sweetalert2';
import AppBadge from '../atoms/AppBadge.vue';
import AppButton from '../atoms/AppButton.vue';
import { useGadgets } from '@/composables/useGadgets';
import { getOperatorId, cancelCheckin, getApsJoinModule, printBadge, getCheckinListId, serveGadget, updateFursuitWithImage, createFursuitWithImage, setFursuitsBroughtToEvent, addFursuitBadges, uploadUserPropic, updateFursonaName, getFullBadgeInfo } from '@/services/checkinApi';
import type { FursuitListResponse } from '@/services/checkinApi';
import UserBadgeEditModal from './UserBadgeEditModal.vue';
import type { UserBadgeFormResult } from './UserBadgeEditModal.vue';


import FursuitEditModal from './FursuitEditModal.vue';
import type { FursuitFormResult } from './FursuitEditModal.vue';


interface Props {
  userData: any;
}
const router = useRouter();
const props = defineProps<Props>();
const emit = defineEmits(['print-badge', 'cancelled']);

const isUserBadgePrinted = ref<boolean>(false);
const isFursuitBadgePrinted = ref<boolean>(false);

const { updateGadgetStatus } = useGadgets();

const showFursuitModal = ref(false);
const editingFursuit = ref<any | null>(null);
const savingFursuit = ref(false);

const onAddFursuit = () => {
  editingFursuit.value = null;   // null => create mode
  showFursuitModal.value = true;
};

const onEditFursuit = (fursuitData: any) => {
  editingFursuit.value = fursuitData;
  showFursuitModal.value = true;
};

const onFursuitConfirm = async (result: FursuitFormResult) => {
  savingFursuit.value = true;
  try {
    await saveFursuit(result);        // <- the function you'll write
    showFursuitModal.value = false;
  } finally {
    savingFursuit.value = false;
  }
};

const saveFursuit = async (result: FursuitFormResult) => {
  if (result.isNew) {
      const ownerId = result.data.ownerId ?? props.userData.user?.userId;
      // console.log(result);
      // console.log(props.userData)
      if (!ownerId) throw new Error('Missing the owner of the new fursuit.');

      const created = await createFursuitWithImage(ownerId, {
        name: result.data.fursuit.name,
        species: result.data.fursuit.species,
        bringToCurrentEvent: result.data.bringingToEvent,   // false
        showInFursuitCount: result.data.showInFursuitCount, // true
        showOwner: result.data.showOwner,                   // true
        image: result.propicFile,
      });

      // The user may have had no fursuits at all — that's the common case here.
      if (!props.userData.fursuits) props.userData.fursuits = [];
      props.userData.fursuits.push(created);

    return;
  }

  const fursuitId = result.data.fursuit.id;

  try {
    const updated = await updateFursuitWithImage(fursuitId, {
      name: result.data.fursuit.name,
      species: result.data.fursuit.species,
      // Not editable in the modal — send back exactly what came in.
      bringToCurrentEvent: result.original.bringingToEvent,
      showInFursuitCount: result.original.showInFursuitCount,
      showOwner: result.original.showOwner,
      deleteImage: false,
      image: result.propicChanged ? result.propicFile : null,
    });

    // The endpoint returns the fresh FursuitData, so swap it in place
    // instead of re-fetching the whole check-in.
    const list = props.userData.fursuits;
    const index = list?.findIndex((f: any) => f.fursuit?.id === fursuitId) ?? -1;
    if (list && index > -1) list.splice(index, 1, updated);
  } catch (e: any) {
    const message =
      e?.response?.data?.errors?.[0]?.message ??
      e?.response?.data?.message ??
      'Could not update the fursuit.';
    await Swal.fire({ icon: 'error', title: 'Update failed', text: message });
    throw e;
  }
};

/** Working selection, keyed by fursuit id. Diverges from the server until Confirm. */
const bringingDraft = ref<Record<number, boolean>>({});
/** Per-fursuit "queue this badge for the next print run". */
const toPrint = ref<Record<number, boolean>>({});
const savingBringing = ref(false);

const extraBadgeQty = ref<number | ''>('');
const addingBadges = ref(false);

const maxBringable = computed<number>(() => props.userData?.maxFursuitsBroughtToEvent ?? 0);

const fursuitList = computed<any[]>(() => props.userData?.fursuits ?? []);

const bringingCount = computed(
  () => fursuitList.value.filter((f) => bringingDraft.value[f.fursuit.id]).length
);
const confirmedBringingCount = computed(
  () => fursuitList.value.filter((f) => f.bringingToEvent).length
);

/** True when the draft differs from the last applied (server) configuration. */
const bringingDirty = computed(() =>
  fursuitList.value.some((f) => !!f.bringingToEvent !== !!bringingDraft.value[f.fursuit.id])
);

const printCount = computed(
  () => fursuitList.value.filter((f) => toPrint.value[f.fursuit.id]).length
);

/**
 * @param reset true when we're looking at a different user and everything
 *              should go back to the server values; false to merge in newly
 *              added fursuits without losing the operator's current work.
 */
const syncFursuitState = (reset: boolean) => {
  const bringing: Record<number, boolean> = {};
  const printing: Record<number, boolean> = {};

  for (const f of fursuitList.value) {
    const id = f.fursuit.id;
    const known = !reset && id in bringingDraft.value;
    bringing[id] = known ? bringingDraft.value[id] : !!f.bringingToEvent;
    // Default on load: anything being brought is queued for printing.
    printing[id] = known ? toPrint.value[id] : !!f.bringingToEvent;
  }

  bringingDraft.value = bringing;
  toPrint.value = printing;
};

// New check-in: start from scratch.
watch(() => props.userData, () => {
  syncFursuitState(true);
  extraBadgeQty.value = '';
}, { immediate: true });

// Fursuit added or removed: keep what the operator already selected.
watch(
  () => fursuitList.value.map((f) => f.fursuit.id).join('|'),
  () => syncFursuitState(false)
);

const toggleBringing = (f: any) => {
  const id = f.fursuit.id;
  const next = !bringingDraft.value[id];

  if (next && maxBringable.value > 0 && bringingCount.value >= maxBringable.value) {
    Swal.fire({
      icon: 'warning',
      title: 'Limit reached',
      text: `This user can bring at most ${maxBringable.value} fursuits to the event.`
    });
    return;
  }

  bringingDraft.value[id] = next;
  // Dropping a fursuit always drops its print flag; adding one never sets it.
  if (!next) toPrint.value[id] = false;
};

const togglePrint = (f: any) => {
  const id = f.fursuit.id;
  if (!bringingDraft.value[id]) return;
  toPrint.value[id] = !toPrint.value[id];
};

const cancelBringingChanges = () => {
  for (const f of fursuitList.value) {
    const id = f.fursuit.id;
    bringingDraft.value[id] = !!f.bringingToEvent;
    if (!bringingDraft.value[id]) toPrint.value[id] = false;
  }
};

const confirmBringingChanges = async () => {
  savingBringing.value = true;
  try {
    await applyBringingSelection(
      fursuitList.value.map((f) => ({
        fursuitId: f.fursuit.id,
        bringingToEvent: !!bringingDraft.value[f.fursuit.id],
      }))
    );

    // Succeeded — the draft is now the applied configuration.
    for (const f of fursuitList.value) {
      f.bringingToEvent = !!bringingDraft.value[f.fursuit.id];
    }

    await Swal.fire({
      icon: 'success',
      title: 'Selection saved',
      timer: 1500,
      showConfirmButton: false
    });
  } catch (e: any) {
    // Deliberately NOT rolled back: the operator keeps their edits to retry.
    await Swal.fire({
      icon: 'error',
      title: 'Could not save',
      text: e?.response?.data?.errors?.[0]?.message ?? e?.message ?? 'Please try again.'
    });
  } finally {
    savingBringing.value = false;
  }
};

const applyBringingSelection = async (
  selection: { fursuitId: number; bringingToEvent: boolean }[]
) => {
  const ownerId = props.userData.user?.userId || props.userData.userId;
  if (!ownerId) throw new Error('Missing the owner of these fursuits.');

  // Send only what actually changed — see note below.
  const applied = new Map<number, boolean>(
    fursuitList.value.map((f: any) => [f.fursuit.id, !!f.bringingToEvent])
  );

  const map: Record<number, boolean> = {};
  for (const item of selection) {
    if (applied.get(item.fursuitId) !== item.bringingToEvent) {
      map[item.fursuitId] = item.bringingToEvent;
    }
  }

  if (!Object.keys(map).length) return;

  const ok = await setFursuitsBroughtToEvent(ownerId, map);
  if (ok !== true) throw new Error('The server refused the change.');
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

const collectGadgets = async () => {
    const { isConfirmed } = await Swal.fire({
    icon: 'warning',
    title: 'Confirm action',
    text: `Are you sure you want to mark gadgets as collected?`,
    showCancelButton: true,
    confirmButtonText: 'Yes, continue',
    cancelButtonText: 'No'
  });
  if (!isConfirmed) return;
  try {
    const response = await serveGadget(props.userData.checkinApplicationId);
    if (response.success) {
      updateGadgetStatus(props.userData.checkinApplicationId, response.collectedAt);
      props.userData.gadgetCollectedAt = response.collectedAt;
      await Swal.fire({
        icon: 'success',
        title: 'Gadgets served',
        text: 'Gadgets served successfully.'
      });
    } else {
      await Swal.fire({
        icon: 'error',
        title: 'Unable to serve gadgets',
        text: 'Failed to serve gadgets'
      });
    }
  } catch (e: any) {
    await Swal.fire({
      icon: 'error',
      title: 'Unable to serve gadgets',
      text: 'Failed to serve gadgets: ' + (e.response?.data?.errors?.[0]?.message || e.message)
    });
  }
};


const printUserBadge = async () => {
  const opId = getOperatorId();
  const userId = props.userData.user?.userId || props.userData.userId;
  isUserBadgePrinted.value = true;
    const res = await printBadge(opId, [userId], 'USER_BADGE');
    await Swal.fire({
      icon: res.status === 200 ? 'success' : 'error',
      title: 'Badge print',
      text: res.data.message
    });
}

const printFursuitBadge = async () => {
    const opId = getOperatorId();
    const ids = fursuitList.value
      .filter((f: any) => toPrint.value[f.fursuit.id])
      .map((f: any) => f.fursuit.id);

    if (!ids.length) {
      await Swal.fire({
        icon: 'info',
        title: 'Nothing to print',
        text: 'No fursuit is currently marked for printing.'
      });
      return;
    }
    
    isFursuitBadgePrinted.value = true;
    const res = await printBadge(opId, ids, 'FURSUIT_BADGE');
    if (res.status === 200) {
      ids.forEach((id: number) => (toPrint.value[id] = false));
    }
    await Swal.fire({
      icon: res.status === 200 ? 'success' : 'error',
      title: 'Badge print',
      text: res.data.message
    });
}

/* ------------------------------------------- extra fursuit badges */


const maxExtraBadges = computed<number>(() => props.userData?.maxExtraFursuitBadges ?? 0);

/** How many more can still be added on top of what the order already covers. */
const extraBadgesAvailable = computed(() =>
  Math.max(0, maxExtraBadges.value - maxBringable.value)
);

const extraBadgeQtyValid = computed(() => {
  const n = extraBadgeQty.value;
  return (
    typeof n === 'number' &&
    Number.isInteger(n) &&
    n > 0 &&
    n <= extraBadgesAvailable.value
  );
});

const addExtraFursuitBadges = async () => {
  if (!extraBadgeQtyValid.value) return;
  const quantity = Number(extraBadgeQty.value);

  const answer = await Swal.fire({
    icon: 'question',
    title: 'Payment status',
    text: 'Are the new extra fursuit badges already paid? By marking yes, a completed payment '
        + 'will be automatically created on the order',
    showConfirmButton: true,
    confirmButtonText: 'Yes, already paid',
    showDenyButton: true,
    denyButtonText: 'No, they haven\'t paid yet',
    showCancelButton: true,
    cancelButtonText: 'Cancel'
  });

  // Deny is a real answer (not paid); dismiss means the operator backed out.
  if (answer.isDismissed) return;
  const alreadyPaid = answer.isConfirmed;

  addingBadges.value = true;
  try {
    const targetUserId = props.userData.user?.userId || props.userData.userId;
    if (!targetUserId) throw new Error('Missing the target user.');

    const response = await addFursuitBadges(targetUserId, quantity, alreadyPaid);
    if (response.status !== 200) {
      throw new Error('Server rejected the request: ' + response.data);
    }
    const updated = response.data as FursuitListResponse;


    if (typeof updated?.maxExtraFursuitBadges === 'number') {
      props.userData.maxExtraFursuitBadges = updated.maxExtraFursuitBadges;
    }
    if (typeof updated?.maxFursuitsBroughtToEvent === 'number') {
      props.userData.maxFursuitsBroughtToEvent = updated.maxFursuitsBroughtToEvent;
    }

    extraBadgeQty.value = '';

    await Swal.fire({
      icon: 'success',
      title: 'Badges added',
      text: `${quantity} extra fursuit badge${quantity > 1 ? 's' : ''} added to the order.`,
      timer: 2000,
      showConfirmButton: false
    });
  } catch (e: any) {
    await Swal.fire({
      icon: 'error',
      title: 'Could not add badges',
      text: e?.response?.data?.errors?.[0]?.message ?? e?.message ?? 'Please try again.'
    });
  } finally {
    addingBadges.value = false;
  }
};

const showUserModal = ref(false);
const savingUserBadge = ref(false);

const onUserBadgeConfirm = async (result: UserBadgeFormResult) => {
  savingUserBadge.value = true;
  try {
    // Photo first: it's the call most likely to be rejected (size/dimensions),
    // so a failure there leaves the name untouched.
    if (result.propicFile) {
      const media = await uploadUserPropic(result.userId, result.propicFile);
      if (props.userData.user) props.userData.user.propic = media;
    }

    if (result.nameChanged) {
      const ok = await updateFursonaName(result.userId, result.fursonaName);
      if (ok !== true) throw new Error('The server refused the new fursona name.');
      if (props.userData.user) props.userData.user.fursonaName = result.fursonaName;
      props.userData.fursonaName = result.fursonaName;
    }

    showUserModal.value = false;
    await Swal.fire({
      icon: 'success',
      title: 'Badge updated',
      timer: 1500,
      showConfirmButton: false
    });
  } catch (e: any) {
    await Swal.fire({
      icon: 'error',
      title: 'Update failed',
      text: e?.response?.data?.errors?.[0]?.message ?? e?.message ?? 'Please try again.'
    });
  } finally {
    savingUserBadge.value = false;
  }
};

const refreshing = ref(false);

const refreshBadgeInfo = async () => {
  if (bringingDirty.value) {
    const confirmed = await Swal.fire({
      icon: 'warning',
      title: 'Discard pending changes?',
      text: 'Refreshing will drop the unsaved "bring to event" selection.',
      showCancelButton: true,
      confirmButtonText: 'Refresh anyway',
      cancelButtonText: 'Keep editing'
    });
    if (!confirmed.isConfirmed) return;
  }

  refreshing.value = true;
  try {
    const userId = props.userData.user?.userId || props.userData.userId;
    if (!userId) throw new Error('Missing the user id.');

    const info = await getFullBadgeInfo(userId);

    // The endpoint is scoped to the authenticated principal; make sure it
    // honoured our userId rather than handing back the operator's own badge.
    if (info.mainBadge?.userId && Number(info.mainBadge.userId) !== Number(userId)) {
      throw new Error('The server returned a different user. Refresh aborted.');
    }

    if (props.userData.user) {
      props.userData.user.fursonaName = info.mainBadge.fursonaName;
      props.userData.user.propic = info.mainBadge.propic ?? null;
    }
    props.userData.fursonaName = info.mainBadge.fursonaName;

    props.userData.fursuits = info.fursuits.fursuits ?? [];
    props.userData.maxFursuitsBroughtToEvent = info.fursuits.maxFursuitsBroughtToEvent;
    props.userData.maxExtraFursuitBadges = info.fursuits.maxExtraFursuitBadges;

    // Let the id-list watcher settle before we overrule it below.
    await nextTick();

    // Selection back to server truth, nothing queued to print, input cleared.
    syncFursuitState(true);
    const cleared: Record<number, boolean> = {};
    for (const f of fursuitList.value) cleared[f.fursuit.id] = false;
    toPrint.value = cleared;
    extraBadgeQty.value = '';
  } catch (e: any) {
    await Swal.fire({
      icon: 'error',
      title: 'Refresh failed',
      text: e?.response?.data?.errors?.[0]?.message ?? e?.message ?? 'Please try again.'
    });
  } finally {
    refreshing.value = false;
  }
};

const goToApsModule = async () => {
  const userId = props.userData.user?.userId || props.userData.userId;

  const url = `membership/aps-join-module?id=${encodeURIComponent(String(userId))}`;

  try {
    const res = await getApsJoinModule(userId);
    if (res.errors) {
      await Swal.fire({
        icon: 'error',
        title: 'APS module print failed',
        text: 'Failed to load APS module: ' + (res.errors[0]?.message || 'Unknown error')
      });
      return;
    }

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
        props.userData.shouldPrintApsJoinModule = false;
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
  //console.log(t);
  if (t === 'MAIN_STAFF' || t === 'SECURITY_STAFF') return '#ff4757';
  if (t === 'JUNIOR_STAFF') return '#70a1ff';
  if (t === 'DAILY_BADGE') return '#ffffff';
  if (t === 'NORMAL_BADGE') return '#2ed573';
  if (t === 'SUPER_SPONSOR') return '#ffa502';
  if (t === 'NORMAL_SPONSOR') return '#a29bfe';
  if (t === 'ULTRA_SPONSOR') return '#eccc68';
  return '#a4b0be';
};

// PORTABADGE COLORS CONFIGURATION
const getBadgeHolderColor = (type: string) => {
  const t = type?.toUpperCase() || '';
  if (t === 'MAIN_AND_SECURITY_STAFF') return '#ff4757';
  if (t === 'GENERAL_STAFF') return '#70a1ff';
  if (t === 'FURSUITERS') return '#eccc68';
  if (t === 'DAILY_ATTENDEES') return '#2ed573';
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
if(status.toLowerCase() !== 'ok' && status.toLowerCase() !== 'none') {
  let text = localizedErrorReason || "";
  if(!!optionalErrorMessage) {
    text+= ". " + optionalErrorMessage;
  }
  Swal.fire({
    icon: 'error',
    title: 'Checkin Error',
    text
  })
}

const statusVariant = computed(() => {
  switch (props.userData.status) {
    case 'ok': return 'success';
    case 'incomplete': return 'info';
    case 'NONE': return 'info';
    default: return 'warning';
  }
});

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
          <button
            type="button"
            class="icon-btn user-card__edit"
            title="Edit propic and fursona name"
            aria-label="Edit propic and fursona name"
            @click="showUserModal = true"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
          </button>
          <button
            type="button"
            class="icon-btn user-card__edit"
            :disabled="refreshing"
            title="Refresh badge data (discards pending fursuit changes)"
            aria-label="Refresh badge data"
            @click="refreshBadgeInfo"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                :class="{ 'is-spinning': refreshing }">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>
        <div class="user-card__sub-title-row">
          <span class="user-card__id">User Number: {{ userData.user?.userId || userData.checkinId || userData.userId }} | </span>
          <span v-if="userData.cardsForEvent?.length" class="card-info-label">
            Card: {{ userData.cardsForEvent.map((c: any) => c.cardNo).join(', ') }}
          </span>
        </div>
        <div class="user-card__badges">
          <div class="badge-with-label">
            <span class="label">Sponsor type:</span>
            <AppBadge :variant="sponsorshipVariant">{{ userData.sponsorNames?.en || userData.user?.sponsorship || userData.sponsorship || 'NONE' }}</AppBadge>
          </div>
          <AppBadge v-if="userData.user?.staffer || userData.staffer" variant="success">STAFF</AppBadge>
          <AppBadge v-if="userData.user?.dailyTicket || userData.dailyTicket" variant="info">DAILY</AppBadge>
          <AppBadge :variant="statusVariant" class="status-badge">Check-in/out status: {{ userData.status || 'OK' }}</AppBadge>
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
        <AppButton 
          :variant="isUserBadgePrinted ? 'secondary' : 'primary'"
          size="lg"
          @click="printUserBadge"
        >
          PRINT STANDARD BADGE
        </AppButton>
        <span
          v-if="userData.hasFursuitBadge || confirmedBringingCount > 0"
          class="print-guard"
          :title="bringingDirty ? `Print disabled while 'bring fursuit to event' changes are pending` : undefined"
        >
          <AppButton
            :variant="isFursuitBadgePrinted ? 'secondary' : 'primary'"
            size="lg"
            :disabled="bringingDirty"
            @click="printFursuitBadge"
          >
            PRINT FURSUIT BADGE
          </AppButton>
        </span>
        <AppButton 
          :variant="userData.shouldPrintApsJoinModule ? 'primary' : 'ghost'"
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
        <section class="info-section">
          <div class="info-section__header">
            <h4 class="info-section__title">Fursuits ({{ userData.fursuits?.length || 0 }})</h4>
            <button
              type="button"
              class="icon-btn"
              title="Add a fursuit"
              aria-label="Add a fursuit"
              @click="onAddFursuit"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
                  stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>

          <div v-if="userData.fursuits?.length" class="fursuit-list">
            <div
              v-for="f in userData.fursuits"
              :key="f.fursuit.id"
              class="fursuit-item"
              :class="{ 'fursuit-item--bringing': bringingDraft[f.fursuit.id] }"
              role="button"
              tabindex="0"
              :aria-pressed="!!bringingDraft[f.fursuit.id]"
              @click="toggleBringing(f)"
              @keydown.enter.prevent="toggleBringing(f)"
              @keydown.space.prevent="toggleBringing(f)"
            >
              <div class="fursuit-item__avatar">
                <img v-if="f.fursuit?.propic?.mediaUrl" :src="f.fursuit.propic.mediaUrl" />
                <div v-else class="avatar-placeholder">{{ f.fursuit?.name?.charAt(0) || '?' }}</div>
              </div>
              <div class="fursuit-info">
                <div class="fursuit-header">
                  <span class="fursuit-name">{{ f.fursuit?.name }}</span>
                  <span class="fursuit-id">#{{ f.fursuit?.id || "-" }}</span>
                </div>
                <span class="fursuit-specie">{{ f.fursuit?.species || f.fursuit?.specie }}</span>
                <div class="fursuit-badges">
                  <AppBadge v-if="bringingDraft[f.fursuit.id]" size="sm" variant="success">Bringing</AppBadge>
                  <AppBadge v-if="f.fursuit?.sponsorship && f.fursuit.sponsorship !== 'NONE'" size="sm" variant="info">
                    {{ f.fursuit.sponsorship }}
                  </AppBadge>
                </div>
              </div>

              <div class="fursuit-actions">
                <button
                  type="button"
                  class="icon-btn icon-btn--print"
                  :class="{ 'is-active': toPrint[f.fursuit.id] }"
                  :disabled="!bringingDraft[f.fursuit.id]"
                  :title="toPrint[f.fursuit.id] ? 'Queued for printing' : 'Not queued for printing'"
                  :aria-label="`Toggle printing for ${f.fursuit?.name}`"
                  :aria-pressed="!!toPrint[f.fursuit.id]"
                  @click.stop="togglePrint(f)"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 9V3h12v6" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" rx="1" />
                  </svg>
                </button>

                <button
                  type="button"
                  class="icon-btn icon-btn--edit"
                  :title="`Edit ${f.fursuit?.name}`"
                  :aria-label="`Edit ${f.fursuit?.name}`"
                  @click.stop="onEditFursuit(f)"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <p v-else class="fursuit-empty">No fursuits registered.</p>

          <div v-if="userData.fursuits?.length" class="fursuit-summary">
            <span class="fursuit-summary__count">
              Bringing <strong>{{ bringingCount }}<template v-if="maxBringable">/{{ maxBringable }}</template></strong>
              fursuits to the event · {{ printCount }} selected to be printed
            </span>
            <br>
            <div class="fursuit-summary__actions">
              <AppButton variant="danger" size="sm" :disabled="!bringingDirty || savingBringing" @click="cancelBringingChanges">
                Cancel
              </AppButton>
              <AppButton variant="entry" size="sm" :disabled="!bringingDirty || savingBringing" @click="confirmBringingChanges">
                {{ savingBringing ? 'Saving…' : 'Confirm' }}
              </AppButton>
            </div>
          </div>
          <div class="extra-badges">
          <template v-if="extraBadgesAvailable > 0">
            <span>Add</span>
            <input
              v-model="extraBadgeQty"
              class="extra-badges__input"
              type="number"
              min="1"
              :max="extraBadgesAvailable"
              step="1"
              inputmode="numeric"
              :disabled="addingBadges"
              :aria-label="`Extra fursuit badges to add, up to ${extraBadgesAvailable}`"
            />
            <span>fursuit badges to the order (max {{ extraBadgesAvailable }})</span>
            <AppButton
              size="sm"
              variant="primary"
              :disabled="!extraBadgeQtyValid || addingBadges"
              @click="addExtraFursuitBadges"
            >
              {{ addingBadges ? '…' : 'OK' }}
            </AppButton>
          </template>
          <span v-else class="extra-badges__note">
            No extra fursuit badges can be added to this order.
          </span>
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
        <p></p>
        <AppButton
          v-if="!userData.gadgetCollectedAt && userData.checkinApplicationId"
          variant="entry" 
          size="sm"
          @click="collectGadgets"
        >
          Mark gadgets as collected
      </AppButton>
      <AppBadge v-if="userData.gadgetCollectedAt" variant="warning">Gadgets already collected</AppBadge>
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

    <FursuitEditModal
      :show="showFursuitModal"
      :fursuit-data="editingFursuit"
      :owner-id="userData.userId"
      :saving="savingFursuit"
      @close="showFursuitModal = false"
      @confirm="onFursuitConfirm"
    />
    <UserBadgeEditModal
      :show="showUserModal"
      :user="userData.user"
      :user-id="userData.user?.userId || userData.userId"
      :saving="savingUserBadge"
      @close="showUserModal = false"
      @confirm="onUserBadgeConfirm"
    />
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
}

.status-badge--success {
  background-color: var(--color-success);
}
.status-badge--warning {
  background-color: var(--color-warning);
}
.status-badge--info {
  color: white;
  background-color: var(--color-info);
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

.info-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.info-section__header .info-section__title {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-primary);
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.icon-btn:hover {
  color: var(--color-primary-hover);
  background: rgba(255, 71, 87, 0.12);
}

.fursuit-item {
  cursor: pointer;
  user-select: none;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.fursuit-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.fursuit-item:focus-visible {
  outline: 2px solid var(--color-info);
  outline-offset: 2px;
}

.fursuit-item--bringing {
  border-color: #eccc68;
  background: rgba(236, 204, 104, 0.07);
}

.fursuit-actions {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: flex;
  align-items: center;
  gap: 2px;
}

.fursuit-badges {
  padding-right: 58px;
}

.icon-btn:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.icon-btn--print {
  color: var(--color-text-muted);
}

.icon-btn--print.is-active {
  color: var(--color-success);
}

.icon-btn--print:hover:not(:disabled) {
  color: var(--color-success);
  background: rgba(46, 213, 115, 0.12);
}

.fursuit-summary {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.fursuit-summary__count {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.fursuit-summary__count strong {
  color: #eccc68;
}

.fursuit-summary__actions {
  display: flex;
  gap: 8px;
}

.fursuit-empty {
  font-size: 12px;
  color: var(--color-text-muted);
  font-style: italic;
}

.extra-badges {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.extra-badges__input {
  width: 78px;
  padding: 6px 8px;
  text-align: center;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.extra-badges__input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.extra-badges__input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.extra-badges__note {
  font-style: italic;
}

.user-card__edit {
  align-self: center;
}

.is-spinning {
  transform-origin: 50% 50%;
  animation: icon-spin 0.8s linear infinite;
}

@keyframes icon-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .is-spinning { animation: none; }
}

</style>
