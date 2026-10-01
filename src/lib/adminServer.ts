import { browser } from "$app/environment";
import { apiDelete, apiDownloadServerBackup, apiDownloadServerDatabase, apiGet, apiPatch, apiPost, apiUploadServerBackup } from "$lib/api";
import { getConfiguredApiBase } from "$lib/onboarding";

export const MAX_SERVER_BACKUP_UPLOAD_BYTES = 512 * 1024 * 1024;
export const MAX_SERVER_BACKUP_RECOVERY_KEY_BYTES = 4096;

export type AdminServerStatus = {
    running: boolean;
    pid: number;
    serviceManagement: "agent-required" | string;
    database: "sqlite" | "postgres";
    version: {
        backendVersion: string;
        apiVersion: string;
        apiMinFrontend: string;
        apiMaxFrontend: string;
        schemaVersion: number;
        serverName: string;
        publicUrl: string;
    };
};

export type ServerBackupResult = {
    engine: "sqlite" | "postgres";
    status: "success";
    destination: string;
    filename: string;
    sha256: string;
    size: number;
    verified: boolean;
    createdAt: string;
};

export type ServerBackupStatus = {
    engine: "sqlite" | "postgres";
    toolsAvailable: boolean;
    enabled: boolean;
    frequency: "daily" | "weekly" | "monthly";
    destination: string;
    keyExported: boolean;
    lastAttempt: string | null;
    lastSuccess: string | null;
    lastError: string | null;
    lastFilename: string | null;
    lastDestination: string | null;
    lastSHA256: string | null;
    lastSize: number;
    nextBackupAt: string | null;
    overdue: boolean;
    needsAttention: boolean;
};

export type ServerBackupKey = {
    key: string;
    format: "base64";
    filename: string;
};

export type ServerBackupFile = {
    filename: string;
    size: number;
    modifiedAt: string;
    sha256: string | null;
    integrity: boolean | null;
};

export type ServerBackupRestoreResult = {
    status: "staged";
    restartRequired: boolean;
    filename: string;
    sha256: string;
    size: number;
    currentBackup: ServerBackupResult;
};

export type ServerBackupRestoreUpload = {
    token: string;
    expiresAt: string;
    maxSize: number;
};

export type ServerDatabaseExportResult = {
    status: "success";
    engine: "sqlite" | "postgres";
    createdAt: string;
    destination: string;
    filename: string;
    sha256: string;
    size: number;
    encrypted: false;
    verified: true;
    exportedBy: { id: number; username: string };
};

export type ServerUpdateCheck = {
    configured: boolean;
    detail?: string;
    manifest?: unknown;
};

export type AdminServerMetric = {
    label: string;
    value: string | number | boolean | null;
};

export type AdminServerMetrics = {
    metrics: AdminServerMetric[];
};

export type AdminServerConfiguration = {
    serverName: string;
    bindAddress: string;
    addresses: string[];
    allowedHosts: string[];
    vpnNetworks: string[];
    port: number;
    publicUrl: string;
    discoveryUrl: string;
    discovery: boolean;
    restartRequired?: boolean;
};

export type ServerPairingCode = {
    code: string;
    expiresAt: number;
    serverName: string;
};

export type ServerLogLevel = "all" | "info" | "warning" | "error";

export type ServerLogRow = {
    id: string;
    offset: number;
    endOffset: number;
    level: Exclude<ServerLogLevel, "all">;
    text: string;
    user?: string;
};

export type ServerLogsResponse = {
    rows: ServerLogRow[];
    nextBefore: number | null;
    latestOffset: number;
    hasOlder: boolean;
};

export type ServerLogQuery = {
    level?: ServerLogLevel;
    search?: string;
    before?: number | null;
    after?: number | null;
    limit?: number;
};

export type ServerLogLiveToken = {
    token: string;
    expiresIn: number;
};

export type ServerLogFragment = {
    name: string;
    size: number;
    sha256: string;
    integrity: boolean;
    status: "available" | "quarantined" | "invalid" | "deleted";
    createdAt: string;
    closedAt: string;
    deleteAt: string;
    daysUntilDeletion: number;
    quarantinedAt: string | null;
    deletedAt: string | null;
};

export type ServerLogFragments = {
    results: ServerLogFragment[];
    manifestIntegrity: boolean;
    retentionDays: number;
    archiveError: string | null;
    activeCreatedAt: string | null;
    activeSize: number;
};

export function getAdminServerStatus(): Promise<AdminServerStatus> {
    return apiGet("/admin/server/status/");
}

export function getAdminServerMetrics(): Promise<AdminServerMetrics> {
    return apiGet("/admin/server/metrics/");
}

export function getAdminServerConfiguration(): Promise<AdminServerConfiguration> {
    return apiGet("/admin/server/config/");
}

export function updateAdminServerConfiguration(
    configuration: Omit<AdminServerConfiguration, "addresses" | "discoveryUrl" | "restartRequired">,
): Promise<AdminServerConfiguration> {
    return apiPatch("/admin/server/config/", configuration);
}

export function createAdminServerPairingCode(): Promise<ServerPairingCode> {
    return apiPost("/admin/server/pairing-code/", {});
}

export function getServerLogs(query: ServerLogQuery = {}): Promise<ServerLogsResponse> {
    const params = new URLSearchParams();
    params.set("level", query.level ?? "all");
    params.set("limit", String(query.limit ?? 800));

    const search = query.search?.trim();
    if (search) params.set("search", search);
    if (typeof query.before === "number") params.set("before", String(query.before));
    if (typeof query.after === "number") params.set("after", String(query.after));

    return apiGet(`/settings/logs?${params.toString()}`);
}

export function createServerLogLiveToken(): Promise<ServerLogLiveToken> {
    return apiPost("/settings/logs/live-token", {});
}

export function getServerLogFragments(): Promise<ServerLogFragments> {
    return apiGet("/admin/server/logs/fragments/");
}

export function setServerLogFragmentQuarantine(name: string, quarantined: boolean): Promise<void> {
    return apiPost(`/admin/server/logs/fragments/${encodeURIComponent(name)}/quarantine/`, { quarantined });
}

export function deleteServerLogFragment(name: string): Promise<void> {
    return apiDelete(`/admin/server/logs/fragments/${encodeURIComponent(name)}/`);
}

export function buildServerLogLiveUrl(token: string, query: ServerLogQuery = {}) {
    const base = new URL(getConfiguredApiBase(), browser ? window.location.origin : "http://localhost");
    base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
    base.pathname = `${base.pathname.replace(/\/$/, "")}/settings/logs/live`;
    base.search = "";
    base.hash = "";
    base.searchParams.set("token", token);
    base.searchParams.set("level", query.level ?? "all");
    base.searchParams.set("limit", String(query.limit ?? 250));

    const search = query.search?.trim();
    if (search) base.searchParams.set("search", search);
    if (typeof query.after === "number") base.searchParams.set("after", String(query.after));

    return base.toString();
}

export function getServerBackupStatus(): Promise<ServerBackupStatus> {
    return apiGet("/admin/server/backups/status/");
}

export function exportServerBackupKey(): Promise<ServerBackupKey> {
    return apiPost("/admin/server/backup-key/export/", {});
}

export function confirmServerBackupKeyExport(): Promise<{ status: "confirmed" }> {
    return apiPost("/admin/server/backup-key/export-confirm/", {});
}

export function exportServerDatabase(destination: string, currentPassword: string): Promise<ServerDatabaseExportResult> {
    return apiPost("/admin/server/database/export/", { destination, current_password: currentPassword });
}

export function createServerBackup(destination?: string): Promise<ServerBackupResult> {
    return apiPost("/admin/server/backup/", destination ? { destination } : {});
}

export async function createServerPreUpdateBackup(): Promise<ServerBackupResult> {
    try {
        return await apiPost("/admin/server/backups/pre-update/", {});
    } catch (error) {
        const status = typeof error === "object" && error !== null && "status" in error
            ? (error as { status?: unknown }).status
            : undefined;
        if (status !== 404) throw error;
        return createServerBackup();
    }
}

export function downloadServerBackup(filename: string): Promise<ArrayBuffer> {
    return apiDownloadServerBackup(filename);
}

export function getServerBackups(): Promise<{ results: ServerBackupFile[] }> {
    return apiGet("/admin/server/backups/");
}

export function deleteServerBackup(filename: string): Promise<void> {
    return apiDelete(`/admin/server/backups/${encodeURIComponent(filename)}/`);
}

export function restoreServerBackup(input: {
    filename?: string;
    path?: string;
    recoveryKey?: string;
    sha256?: string;
}): Promise<ServerBackupRestoreResult> {
    return apiPost("/admin/server/backups/restore/", { ...input, confirm: true });
}

export function createServerBackupRestoreUpload(): Promise<ServerBackupRestoreUpload> {
    return apiPost("/admin/server/backups/restore-upload-token/", {});
}

export function uploadServerBackup(file: File, recoveryKey: string, token: string): Promise<ServerBackupRestoreResult> {
    return apiUploadServerBackup(file, recoveryKey, token);
}

export function downloadServerDatabase(currentPassword: string): Promise<ArrayBuffer> {
    return apiDownloadServerDatabase(currentPassword);
}

export function checkServerUpdate(): Promise<ServerUpdateCheck> {
    return apiPost("/admin/server/check-update/", {});
}

export function requestServerUpdate(): Promise<{ detail: string }> {
    return apiPost("/admin/server/update/", {});
}

export function requestServerRestart(): Promise<{ detail: string }> {
    return apiPost("/admin/server/restart/", {});
}
