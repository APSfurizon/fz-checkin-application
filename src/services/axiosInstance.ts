import axios from "axios";
import { getCookie } from "@/utils/cookies";
import { extractEnvelope, showApiError } from "@/composables/useApiError";

/** Opt out per-request when the caller renders the error itself. */
declare module "axios" {
  export interface AxiosRequestConfig {
    skipErrorPopup?: boolean;
  }
}

const furpanelApi = axios.create({
  baseURL: "http://checkin.localfz.net:3000/api/",
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

furpanelApi.interceptors.response.use(
  (response) => {
    // Calls using validateStatus:()=>true land here even when they failed,
    // so the body has to be inspected on the success path too.
    const envelope = extractEnvelope(response.data);
    if (envelope && !response.config.skipErrorPopup) {
      showApiError(envelope);
    }
    return response;
  },
  (error) => {
    if (!axios.isCancel(error)) {
      const envelope = extractEnvelope(error.response?.data);
      if (envelope && !error.config?.skipErrorPopup) {
        showApiError(envelope);
      }
    }
    return Promise.reject(error);
  }
);

export default furpanelApi;