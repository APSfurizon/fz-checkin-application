import { ref, onMounted } from "vue";
import { getMe } from "@services/checkinApi";
import { useRouter } from "vue-router";

export function useMe() {
  const isLoggedIn = ref(false);
  const token = ref();
  const userInfo = ref({});
  const router = useRouter();

  async function login(token: string) {
    localStorage.setItem("token", token);
    // isLoggedIn.value = true;
    const me = await getMe();
    console.log(me);
    router.push({ name: "home" });
  }

  onMounted(() => {
    isLoggedIn.value = !!localStorage.getItem("token");
    getMe();
  });

  return {
    isLoggedIn,
    login,
  };
}
