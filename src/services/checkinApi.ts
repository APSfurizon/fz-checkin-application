import furpanelApi from "@services/axiosInstance";
import { getCookie, setCookie, eraseCookie } from "@/utils/cookies";


export interface UserDisplayData {
    userId: number;
    fursonaName: string;
    locale: string;
    language: string;
    propic?: {
        mediaId: number;
        mediaUrl: string;
        mimeType: string;
    } | null;
    sponsorship: "NONE" | "SPONSOR" | "SUPER_SPONSOR" | "ULTRA_SPONSOR";
}

export interface Gadget {
    gadgetId: string;
    gadgetNames: Record<string, string>;
    quantity: number;
    shirt: boolean;
    stackable: boolean;
}

export interface CheckinSearchResult {
    name: string;
    orderCode: string;
    checkinSecret: string;
    hasCheckedIn: boolean;
    user: UserDisplayData;
}

export interface CheckinSearchResponse {
    results: CheckinSearchResult[];
    count: number;
    next: string | null;
    previous: string | null;
}

export interface CheckinResponse {
    checkinNonce: string;
    status: "ok" | "incomplete" | "error";
    user: UserDisplayData;
    orderCode: string;
    orderSerial: number;
    gadgets: Gadget[];
    hasFursuitBadge: boolean;
    lanyardType: string;
    portaBadgeType: string;
}

export async function login(credentials: { email: string; password: string }) {
    const response = await furpanelApi.post("proxy/authentication/login", credentials);
    return response.data;
}

export async function getCheckinLists() {
    const response = await furpanelApi.get("checkin/lists");
    return response.data;
}

export async function getMe() {
    const response = await furpanelApi.get("proxy/authentication/me");
    return response.data;
}

export async function searchCheckins(params: {
    query?: string;
    checkinListId?: number;
    hasCheckedIn?: boolean;
    page?: number;
}) {
    const response = await furpanelApi.get("checkin/search", { params });
    return response.data as CheckinSearchResponse;
}

export async function redeemCheckin(data: {
    checkinListIds: number[];
    secret: string;
    operatorId?: string;
}) {
    const response = await furpanelApi.post("checkin/redeem", data);
    return response.data as CheckinResponse;
}

export async function getPendingGadgets() {
    const response = await furpanelApi.get("checkin/pending-gadgets");
    return response.data;
}

export async function serveGadget(checkinId: number) {
    const response = await furpanelApi.put(`checkin/${checkinId}/serve-gadget`);
    return response.data;
}

export async function toggleGadget(checkinId: number) {
    const response = await furpanelApi.put(`checkin/${checkinId}/toggle-gadget`);
    return response.data;
}



export async function cancelCheckin(checkinNonce: string, reason: string) {
    const response = await furpanelApi.post("checkin/cancel", {
        checkinNonce,
        reason
    });
    return response.data;
}

export function setToken(token: string) {
    setCookie("auth_token", token, 14);
}

export function getToken() {
    return getCookie("auth_token");
}

export function setOperatorId(id: string) {
    setCookie("operator_id", id, 14);
}

export function getOperatorId() {
    return getCookie("operator_id");
}

export function setCheckinListId(id: string) {
    setCookie("checkin_list_id", id, 14);
}

export function getCheckinListId() {
    return getCookie("checkin_list_id");
}

export function logout() {
    eraseCookie("auth_token");
    eraseCookie("operator_id");
    eraseCookie("checkin_list_id");
    window.location.href = "/login";
}
