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
    next: number | null;
    previous: number | null;
}

export interface CheckinLog {
    checkinId: number;
    checkinListId: number;
    type: string;
    successful: boolean;
    autoCheckedIn: boolean;
    createdAt: string;
    datetime: string;
    localizedErrorReason?: string | null;
    optionalErrorMessage?: string | null;
    orderCode?: string;
    firstName?: string;
    lastName?: string;
    user?: UserDisplayData;
}

export interface CheckinLogsResponse {
    results: CheckinLog[];
    count: number;
    next: number | null;
    previous: number | null;
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

export async function getCheckinLogs(params: {
    createdSince?: string;
    createdBefore?: string;
    datetimeSince?: string;
    datetimeBefore?: string;
    successful?: boolean;
    checkinListId?: number;
    type?: string;
    autoCheckedIn?: boolean;
    orderBy?: string;
    page?: number;
}) {
    const response = await furpanelApi.get("checkin/logs", { params });
    return response.data as CheckinLogsResponse;
}

export async function redeemCheckin(data: {
    checkinListIds: number[];
    secret: string;
    checkinType: "ENTRY" | "EXIT";
    operatorId?: number;
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

export async function getGadgetUpdates(lastId: number) {
    const response = await furpanelApi.get("checkin/updates", { params: { lastId } });
    return response.data;
}

export async function getApsJoinModule(userId: number) {
    const response = await furpanelApi.get("membership/aps-join-module", { params: { userId } });
    return response.data;
}


export async function cancelCheckin(checkinNonce: string, reason: string, checkinListIds: number[]) {
    const response = await furpanelApi.post("checkin/cancel", {
        nonce: checkinNonce,
        explanation: reason,
        checkinListIds
    });
    return response.data;
}

export async function printBadge(operatorId: number, ids: number[], type: "USER_BADGE" | "FURSUIT_BADGE") {
    const response = await furpanelApi.post("badge/print", {
            operatorId,
            ids,
            type
        }, {
            validateStatus: () => true //Don't throw exception
        }
    );
    return response;
}

export function setToken(token: string) {
    setCookie("auth_token", token, 14);
}

export function getToken() {
    return getCookie("auth_token");
}

export function setUserInfo(userId: number, fursonaName: string) {
    setCookie("auth_user_id", String(userId), 14);
    setCookie("auth_fursona_name", fursonaName, 14);
}

export function getUserInfo() {
    const userId = parseInt(getCookie("auth_user_id") || "-1");
    const fursonaName = getCookie("auth_fursona_name") || "-";
    return { userId, fursonaName };
}

export function setOperatorId(id: number) {
    setCookie("operator_id", String(id), 14);
}

export function getOperatorId() {
    return parseInt(getCookie("operator_id") || "-1");
}

export function setCheckinListId(id: string, name: string) {
    setCookie("checkin_list_id", id, 14);
    setCookie("checkin_list_name", name, 14);
}

export function getCheckinListId() {
    return getCookie("checkin_list_id");
}

export function getCheckinListName() {
    return getCookie("checkin_list_name");
}

export function logout() {
    eraseCookie("auth_token");
    eraseCookie("operator_id");
    eraseCookie("checkin_list_id");
    eraseCookie("checkin_list_name");
    window.location.href = "/login";
}
