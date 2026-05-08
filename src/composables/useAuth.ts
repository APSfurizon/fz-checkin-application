import { ref } from "vue";
import { useRouter } from "vue-router";
import { getCookie, setCookie, eraseCookie } from "@/utils/cookies";

const isLoggedIn = ref(!!getCookie("auth_token"));

export function useMe() {
  const router = useRouter();

  async function login(token: string) {
    setCookie("auth_token", token, 14);
    isLoggedIn.value = true;
    router.push({ name: "selection" });
  }

  async function logout() {
    eraseCookie("auth_token");
    isLoggedIn.value = false;
    router.push({ name: "login" });
  }

  function checkAuth() {
    isLoggedIn.value = !!getCookie("auth_token");
  }

  return {
    isLoggedIn,
    login,
    logout,
    checkAuth,
  };
}

export const useAuth = useMe;
