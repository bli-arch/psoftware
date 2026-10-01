import { browser } from "$app/environment";
import { invoke } from "@tauri-apps/api/core";
import { suspendConnectivityRedirect } from "$lib/api";
import { getLocalDeviceId } from "$lib/deviceIdentity";
import { requireConnectedLocalPServer, requireLocalPServerIdentity } from "$lib/localServerControl";
import { getConfiguredApiBase, getConfiguredServerId } from "$lib/onboarding";

export type LocalServerServiceStatus = {
    available: boolean;
    elevated: boolean;
    state: "running" | "stopped" | "starting" | "stopping" | "admin-required" | "not-installed" | "unknown" | "error" | string;
    detail: string;
    executablePath?: string | null;
    serverId?: string | null;
    serverName?: string | null;
};

export type LocalServerUpdateCheck = {
    configured: boolean;
    available: boolean;
    currentVersion?: string | null;
    version?: string | null;
    notes?: string | null;
    detail: string;
};

export type LocalServerUpdateInstallResult = {
    version: string;
    backupPath: string;
    freshInstall: boolean;
    restarted: boolean;
    detail: string;
};

let cachedServiceStatus: LocalServerServiceStatus | null = null;
let pendingServiceStatus: Promise<LocalServerServiceStatus> | null = null;
export type LocalServerServiceAction = "start" | "stop" | "restart";
type LocalServiceCommand = "pserver_service_status" | "pserver_service_start" | "pserver_service_stop" | "pserver_service_restart";

export function canUseLocalServerService() {
    return browser && "__TAURI_INTERNALS__" in window;
}

export function getCachedLocalServerServiceStatus() {
    return cachedServiceStatus;
}

async function invokeService(command: LocalServiceCommand, args?: Record<string, unknown>) {
    cachedServiceStatus = await invoke<LocalServerServiceStatus>(command, args);
    return cachedServiceStatus;
}

export function getLocalServerServiceStatus() {
    if (!pendingServiceStatus) {
        pendingServiceStatus = invokeService("pserver_service_status").finally(() => {
            pendingServiceStatus = null;
        });
    }
    return pendingServiceStatus;
}

export function readLocalPServerLicense() {
    if (!canUseLocalServerService()) {
        return Promise.reject(new Error("La licence PServer est disponible uniquement dans l'application installée."));
    }

    return invoke<string>("read_pserver_license");
}

async function invokeLocalServerServiceAction(action: LocalServerServiceAction) {
    const resumeRedirects = action !== "start" ? suspendConnectivityRedirect() : null;
    try {
        return await invokeService(`pserver_service_${action}`);
    } finally {
        if (resumeRedirects) window.setTimeout(resumeRedirects, 1500);
    }
}

function authorizedLocalServerId(
    service: LocalServerServiceStatus | null,
    connectedServerId?: string | null,
) {
    return connectedServerId === undefined
        ? requireLocalPServerIdentity(service)
        : requireConnectedLocalPServer(service, connectedServerId);
}

export async function runLocalServerServiceAction(
    action: LocalServerServiceAction,
    connectedServerId?: string | null,
) {
    if (connectedServerId !== undefined) {
        authorizedLocalServerId(await getLocalServerServiceStatus(), connectedServerId);
    }
    return invokeLocalServerServiceAction(action);
}

export function friendlyLocalServerServiceError() {
    return "L’action n’a pas abouti. Vérifiez l’autorisation demandée puis réessayez.";
}

function friendlyLocalServerUpdateError(error: unknown, installing = false) {
    const apiData = typeof error === "object" && error !== null && "data" in error
        ? (error as { data?: { code?: unknown; detail?: unknown } }).data
        : undefined;
    const apiDetail = typeof apiData?.detail === "string" ? apiData.detail : "";
    const detail = apiDetail || (error instanceof Error ? error.message : String(error));
    if (apiData?.code === "BACKUP_KEY_NOT_EXPORTED" || detail.includes("BACKUP_KEY_NOT_EXPORTED")) {
        return "Impossible de créer la sauvegarde locale préalable à la mise à jour (code:BACKUP_KEY_NOT_EXPORTED).";
    }
    if (/clé de récupération/i.test(detail)) return detail;
    return installing ? "Impossible d'installer la mise à jour." : "Impossible de vérifier les mises à jour.";
}

function checkLocalServerUpdate(expectedServerId: string): Promise<LocalServerUpdateCheck> {
    return invoke("pserver_update_check", {
        request: { expectedServerId },
    });
}

export async function runLocalServerUpdateCheck(connectedServerId?: string | null) {
    try {
        const service = await getLocalServerServiceStatus();
        return await checkLocalServerUpdate(authorizedLocalServerId(service, connectedServerId));
    } catch (error) {
        throw new Error(friendlyLocalServerUpdateError(error));
    }
}

function installLocalServerUpdate(options: {
    freshInstall: boolean;
    expectedServerId: string;
}): Promise<LocalServerUpdateInstallResult> {
    return invoke("pserver_update_install", {
        request: options,
    });
}

export async function runLocalServerUpdateInstall(options: {
    freshInstall: boolean;
    connectedServerId?: string | null;
}) {
    try {
        const service = await getLocalServerServiceStatus();
        const expectedServerId = authorizedLocalServerId(service, options.connectedServerId);
        const resumeRedirects = suspendConnectivityRedirect();
        try {
            return await installLocalServerUpdate({
                freshInstall: options.freshInstall,
                expectedServerId,
            });
        } finally {
            window.setTimeout(resumeRedirects, 1500);
        }
    } catch (error) {
        throw new Error(friendlyLocalServerUpdateError(error, true));
    }
}

export async function removeLocalPServer() {
    const service = await getLocalServerServiceStatus();
    const expectedServerId = requireConnectedLocalPServer(service, getConfiguredServerId());
    const resumeRedirects = suspendConnectivityRedirect();
    try {
        return await invoke<string>("remove_local_pserver", {
            apiBase: getConfiguredApiBase(),
            deviceId: getLocalDeviceId() || null,
            expectedServerId,
        });
    } finally {
        window.setTimeout(resumeRedirects, 1500);
    }
}
