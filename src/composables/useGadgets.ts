import { ref, watch } from "vue";
import {
  getPendingGadgets as apiGetPendingGadgets,
  getGadgetUpdates,
} from "@/services/checkinApi";

const gadgetCheckins = ref<any[]>([]);
const loading = ref(false);
const error = ref("");
const pollingActive = ref(false);
const volume = ref(Number(localStorage.getItem("gadget_volume") || "0.5"));
let pollInterval: any = null;

const SOUND_URL =
  "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

watch(volume, (val) => {
  localStorage.setItem("gadget_volume", val.toString());
});

export function useGadgets() {
  const playSound = () => {
    // Play gadget sounds
    const audio = new Audio(SOUND_URL);
    audio.volume = volume.value;
    audio.play().catch((e) => console.error("Failed to play sound:", e));
  };

  const processItems = (items: any[]) => {
    return items
      .map((item: any) => ({
        ...item,
        gadgetList: item.gadgets
          ? typeof item.gadgets === "string"
            ? JSON.parse(item.gadgets)
            : item.gadgets
          : [],
      }))
      .filter((item) => item.gadgetList.length > 0);
  };

  const loadGadgets = async () => {
    loading.value = true;
    error.value = "";
    try {
      console.log("[useGadgets] Loading gadgets...");
      const response = await apiGetPendingGadgets();
      if (response.success) {
        console.log(`[useGadgets] Received ${response.data.length} items from server`);
        gadgetCheckins.value = processItems(response.data);
        // console.log(`[useGadgets] Processed ${processed.length} items with gadgets`);
        // gadgetCheckins.value = processed.sort((a: any, b: any) => b.id - a.id);
      } else {
        error.value = response.message || "Error loading gadgets";
      }
    } catch (e: any) {
      console.error("[useGadgets] Load error:", e);
      error.value = "Failed to load gadgets";
    } finally {
      loading.value = false;
    }
  };

  const checkForUpdates = async () => {
    const validIds = gadgetCheckins.value
                                   .map((c) => Number(c.id))
                                   .filter((id) => !isNaN(id));

    if (validIds.length === 0) {
      await loadGadgets();
      return;
    }

    const uncollectedIds = gadgetCheckins.value
      .filter((c) => !c.gadgetCollectedAt)
      .map((c) => Number(c.id))
      .filter((id) => !isNaN(id));

    const lastId = Math.max(...validIds);
    try {
      const response = await getGadgetUpdates(lastId, uncollectedIds);
      if (response.success) {
        if (response.updates.length > 0) {
          const processedNew = processItems(response.updates).map((item) => ({
            ...item,
            newUntil: Date.now() + 10000,
          }));

          if (processedNew.length > 0) {
            const currentIds = new Set(gadgetCheckins.value.map((c) => c.id));
            const trulyNew = processedNew.filter(
              (item: any) => !currentIds.has(item.id),
            );

            if (trulyNew.length > 0) {
              gadgetCheckins.value = [
                ...trulyNew,
                ...gadgetCheckins.value,
              ].sort((a, b) => a.id - b.id);
              playSound();
            }
          }
        }
        if (response.isCollected) {
          Object.entries(response.isCollected).forEach(([id, collected]) => {
            if (collected) {
              console.log(`[useGadgets] Gadget ${id} has been collected by someone else, updating status...`);
              updateGadgetStatus(Number(id), collected);
            }
          });
        }
      }
    } catch (e) {
      console.error("Polling error:", e);
    }
  };

  const startPolling = (intervalMs = 5000) => {
    if (pollingActive.value) return;
    pollingActive.value = true;
    pollInterval = setInterval(checkForUpdates, intervalMs);
  };

  const stopPolling = () => {
    pollingActive.value = false;
    if (pollInterval) clearInterval(pollInterval);
  };

  const updateGadgetStatus = (id: number, collectedAt: any) => {
    const index = gadgetCheckins.value.findIndex((c) => c.id === id);
    if (index !== -1) {
      const updatedItem = {
        ...gadgetCheckins.value[index],
        gadgetCollectedAt: collectedAt,
      };
      gadgetCheckins.value.splice(index, 1, updatedItem);
    }
  };

  return {
    gadgetCheckins,
    loading,
    error,
    volume,
    loadGadgets,
    updateGadgetStatus,
    startPolling,
    stopPolling,
    pollingActive,
  };
}
