import { reactive } from "vue";

export interface ApiError {
  message?: string;
  code?: string;
}

export interface ApiErrorEnvelope {
  errors: ApiError[];
  requestId?: string;
}

export const apiError = reactive({
  show: false,
  message: "",
  code: "",
  requestId: "",
});

/** Returns the envelope only if the body really is one. */
export function extractEnvelope(data: unknown): ApiErrorEnvelope | null {
  if (!data || typeof data !== "object") return null;
  const candidate = data as ApiErrorEnvelope;
  if (!Array.isArray(candidate.errors) || candidate.errors.length === 0) return null;
  return candidate;
}

export function showApiError(envelope: ApiErrorEnvelope) {
  // One at a time: an expired token fails every in-flight call at once.
  if (apiError.show) return;

  const codes = envelope.errors.map((e) => e.code).filter(Boolean) as string[];
  // Surface an auth code even if it is not the first one, so ErrorModal
  // still offers the logout button.
  const authCode = codes.find((c) => c === "UNAUTHENTICATED" || c === "401");

  apiError.message = envelope.errors.map((e) => e.message || "Unknown error").join("\n");
  apiError.code = authCode ?? codes[0] ?? "";
  apiError.requestId = envelope.requestId ?? "";
  apiError.show = true;
}

export function dismissApiError() {
  apiError.show = false;
}