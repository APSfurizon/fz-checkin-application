import furpanelApi from "@services/axiosInstance";
import { getCookie, setCookie, eraseCookie } from "@/utils/cookies";

export interface MediaData {
    mediaId: number;
    mediaUrl: string;
    mimeType: string;
}

export interface UserDisplayData {
    userId: number;
    fursonaName: string;
    locale: string;
    language: string;
    propic?: MediaData | null;
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
    maxFursuitsBroughtToEvent: number;
    maxExtraFursuitBadges: number;
    fursuits: any[];
    lanyardType: string;
    portaBadgeType: string;
}

export interface FursuitUpdatePayload {
    name: string;
    species?: string | null;
    bringToCurrentEvent: boolean;
    showInFursuitCount: boolean;
    showOwner: boolean;
    deleteImage?: boolean;
    image?: File | null;
}

export interface FursuitDisplayData {
    id: number;
    name: string;
    species?: string | null;
    propic?: MediaData | null;
    ownerId?: number | null;
    sponsorship?: "NONE" | "SPONSOR" | "SUPER_SPONSOR" | "ULTRA_SPONSOR" | null;
}

export interface FursuitData {
    bringingToEvent: boolean;
    ownerId: number;
    showInFursuitCount: boolean;
    showOwner: boolean;
    fursuit: FursuitDisplayData;
}

export interface FursuitListResponse {
    fursuits: FursuitData[];
    bringingToEvent: number;
    maxFursuitsBroughtToEvent: number;
    maxExtraFursuitBadges: number;
    canBringFursuitsToEvent: boolean;
    allowEditBringFursuitToEvent: boolean;
}

export interface FullInfoBadgeResponse {
    mainBadge: UserDisplayData;
    badgeEditingDeadline?: string | null;
    allowedModifications: boolean;
    fursuits: FursuitListResponse;
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
    checkinType: "entry" | "exit";
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

export async function getGadgetUpdates(lastId?: number, prevIds?: number[]) {
    const response = await furpanelApi.get("checkin/updates", { params: { lastId, prevIds: prevIds?.join(',') } });
    return response.data;
}

export async function getApsJoinModule(userId: number) {
    const response = await furpanelApi.get("membership/aps-join-module",
        { params: { userId }, validateStatus: () => true });
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

export async function updateFursuitWithImage(fursuitId: number, payload: FursuitUpdatePayload) {
    const form = new FormData();
    form.append("name", payload.name);
    if (payload.species) form.append("species", payload.species);
    form.append("bring-to-current-event", String(payload.bringToCurrentEvent));
    form.append("show-in-fursuit-count", String(payload.showInFursuitCount));
    form.append("show-owner", String(payload.showOwner));
    form.append("delete-image", String(payload.deleteImage ?? false));

    // deleteImage wins on the backend, so don't waste an upload alongside it.
    if (!payload.deleteImage && payload.image) {
        form.append("image", payload.image, payload.image.name);
    }

    const response = await furpanelApi.post(`proxy/fursuits/${fursuitId}/update-with-image`, form);
    return response.data;
}

export async function createFursuitWithImage(userId: number, payload: FursuitUpdatePayload) {
    const form = new FormData();
    form.append("name", payload.name);
    if (payload.species) form.append("species", payload.species);
    form.append("user-id", String(userId));
    form.append("bring-to-current-event", String(payload.bringToCurrentEvent ?? false));
    form.append("show-in-fursuit-count", String(payload.showInFursuitCount ?? true));
    form.append("show-owner", String(payload.showOwner ?? true));

    if (payload.image) {
        form.append("image", payload.image, payload.image.name);
    }

    const response = await furpanelApi.post("proxy/fursuits/add-with-image", form);
    return response.data;
}

export async function setFursuitsBroughtToEvent(
    ownerUserId: number,
    fursuitBroughtToEventMap: Record<number, boolean>
) {
    const response = await furpanelApi.post("proxy/fursuits/bringToEvent", {
        fursuitBroughtToEventMap,
        ownerUserId
    });
    return response.data as boolean;
}

export async function addFursuitBadges(
    targetUserId: number,
    quantity: number,
    alreadyPaid: boolean
) {
    const response = await furpanelApi.post("proxy/fursuits/add-fursuit-badges", {
        targetUserId,
        quantity,
        alreadyPaid
    });
    return response;
}

export async function uploadUserPropic(userId: number, image: File) {
    const form = new FormData();
    form.append("image", image, image.name);
    const response = await furpanelApi.post(`proxy/badge/user/upload/${userId}`, form);
    return response.data as MediaData;
}

export async function updateFursonaName(userId: number, fursonaName: string) {
    const response = await furpanelApi.post("proxy/badge/update-fursona-name", {
        userId,
        fursonaName
    });
    if (response.status !== 200) {
        throw new Error(`Failed to update fursona name: ${response.status} ${response.statusText}`);
    }
    return response.data as boolean;
}

export async function getFullBadgeInfo(userId: number) {
    const response = await furpanelApi.get("proxy/badge", { params: { userId } });
    return response.data as FullInfoBadgeResponse;
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
