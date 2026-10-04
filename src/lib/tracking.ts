import { apiGet, apiPatch, apiPost } from "$lib/api";

export type TrackingAccessMode = "token" | "password";
export type TrackingState = "disabled" | "active" | "paused" | "withdrawing" | "reconcile";
export type TrackingAction = "activate" | "pause" | "resume" | "retry" | "unpublish" | "reset" | "test";

export type TrackingConfig = {
    endpoint: string;
    public_base_url: string;
    integration_id: string;
    generation: string;
    bound_integration_id: string;
    bound_generation: string;
    key_id: string;
    has_secret: boolean;
    identifier_template: string;
    access_mode: TrackingAccessMode;
    expiry_hours: number;
    notes_enabled: boolean;
    state: TrackingState;
    sender_supported: boolean;
    sender_error: string;
    stats: {
        pending: number;
        failed: number;
        pending_bytes: number;
        last_success_at: string | null;
        last_error: string;
        withdrawals_pending: number;
    };
};

export type TrackingConfigPatch = Partial<Pick<TrackingConfig,
    "endpoint" | "public_base_url" | "integration_id" | "generation" | "key_id" |
    "identifier_template" | "access_mode" | "expiry_hours" | "notes_enabled"
>> & { signing_secret?: string };

export type OperationTracking = {
    enabled: boolean;
    public_uid: string | null;
    tracking_url: string | null;
    access_mode: TrackingAccessMode;
    published: boolean;
    state: string;
    expires_at: string | null;
    revision: string;
    pending: boolean;
    can_publish: boolean;
};

export const getTrackingConfig = (): Promise<TrackingConfig> => apiGet("/tracking/config/");
export const patchTrackingConfig = (patch: TrackingConfigPatch): Promise<TrackingConfig> => apiPatch("/tracking/config/", patch);
export const performTrackingAction = (action: TrackingAction): Promise<TrackingConfig> => apiPost("/tracking/actions/", { action });

const operationPath = (uid: string) => `/tracking/operations/${encodeURIComponent(uid)}`;
export const getOperationTracking = (uid: string): Promise<OperationTracking> => apiGet(`${operationPath(uid)}/`);
export const patchOperationTracking = (uid: string, patch: { published?: boolean; access_mode?: TrackingAccessMode }): Promise<OperationTracking> => apiPatch(`${operationPath(uid)}/`, patch);
export const rotateOperationTracking = (uid: string): Promise<OperationTracking> => apiPost(`${operationPath(uid)}/rotate/`, {});

export function trackingErrorMessage(error: unknown, fallback: string): string {
    const data = (error as { data?: unknown })?.data;
    if (data && typeof data === "object" && "detail" in data && typeof data.detail === "string") return data.detail;
    return fallback;
}
