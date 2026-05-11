import { createRouter, createWebHistory } from "vue-router";
import { useAuth } from "@composables/useAuth";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "selection",
      component: () => import("@views/CheckinSelection.vue"),
    },
    {
      path: "/operator",
      name: "operator",
      component: () => import("@views/OperatorSetup.vue"),
    },
    {
      path: "/redeem",
      name: "redeem",
      component: () => import("@views/RedeemView.vue"),
    },
    {
      path: "/redeem/:userId",
      name: "redeem-user",
      component: () => import("@views/RedeemView.vue"),
    },
    {
      path: "/gadgets",
      name: "gadgets",
      component: () => import("@views/GadgetView.vue"),
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@views/LoginView.vue"),
    },
    {
      path: "/legend",
      name: "legend",
      component: () => import("@views/LegendView.vue"),
    },
  ],
});

router.beforeEach((to) => {
  const { isLoggedIn } = useAuth();
  
  if (to.name !== "login" && !isLoggedIn.value) {
    return { name: "login" };
  }
  
  if (to.name === "login" && isLoggedIn.value) {
    return { name: "selection" };
  }
});

export default router;
