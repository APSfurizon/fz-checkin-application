import axios from "axios";
import { getCookie } from "@/utils/cookies";

const furpanelApi = axios.create({
  baseURL: "http://localhost:3000/api/",
});

furpanelApi.interceptors.request.use(
  (config) => {
    const token = getCookie("auth_token");
    const operatorId = getCookie("operator_id");
    const isLoginRequest = config.url && config.url.includes("login");

    if (token && !isLoginRequest) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    
    if (operatorId) {
      config.headers.set('x-operator-id', operatorId);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export default furpanelApi;
