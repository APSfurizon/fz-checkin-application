import { ref } from 'vue';
import { getPendingGadgets as apiGetPendingGadgets } from '@/services/checkinApi';

const gadgetCheckins = ref<any[]>([]);
const loading = ref(false);
const error = ref('');

export function useGadgets() {
  const loadGadgets = async () => {
    loading.value = true;
    error.value = '';
    try {
      const response = await apiGetPendingGadgets();
      if (response.success) {
        gadgetCheckins.value = response.data.map((item: any) => ({
          ...item,
          gadgetList: item.gadgets ? JSON.parse(item.gadgets) : []
        }));
      } else {
        error.value = response.message || 'Error loading gadgets';
      }
    } catch (e: any) {
      error.value = 'Failed to load gadgets';
    } finally {
      loading.value = false;
    }
  };

  const addGadget = (checkin: any) => {
    gadgetCheckins.value.unshift({
      ...checkin,
      gadgetList: checkin.gadgets ? (typeof checkin.gadgets === 'string' ? JSON.parse(checkin.gadgets) : checkin.gadgets) : []
    });
  };

  const updateGadgetStatus = (id: number, collectedAt: any) => {
    const index = gadgetCheckins.value.findIndex(c => c.id === id);
    if (index !== -1) {
      const updatedItem = { ...gadgetCheckins.value[index], gadgetCollectedAt: collectedAt };
      gadgetCheckins.value.splice(index, 1, updatedItem);
    }
  };

  return {
    gadgetCheckins,
    loading,
    error,
    loadGadgets,
    addGadget,
    updateGadgetStatus
  };
}
