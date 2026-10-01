import { browser } from "$app/environment";
import { invoke } from "@tauri-apps/api/core";
import { get, writable } from "svelte/store";
import { isInstalledTauriApp } from "$lib/appInfo";

export type FrontendUpdateStatus =
    | { state: "unavailable"; message: string }
    | { state: "idle"; message: string }
    | { state: "available"; version: string; notes?: string; message: string }
    | { state: "installed"; version: string; message: string }
    | { state: "relaunching"; message: string }
    | { state: "error"; message: string };

const AUTO_CHECK_STORAGE_KEY = "psoft.autoCheckUpdates";
const AUTO_CHECK_DEDUPLICATION_MS = 60_000;

export const frontendUpdateStatus = writable<FrontendUpdateStatus | null>(null);
export const frontendUpdateActivity = writable<"checking" | "installing" | null>(null);

let activeUpdateOperation: Promise<FrontendUpdateStatus> | null = null;
let automaticUpdateOperation: Promise<FrontendUpdateStatus | null> | null = null;
let lastAutomaticCheckAt = 0;

type SoftwareUpdate = {
    version: string;
    notes?: string;
};

export function getAutoCheckUpdatesEnabled() {
    if (!browser) return false;
    return localStorage.getItem(AUTO_CHECK_STORAGE_KEY) !== "false";
}

export function setAutoCheckUpdatesEnabled(enabled: boolean) {
    if (!browser) return;
    localStorage.setItem(AUTO_CHECK_STORAGE_KEY, String(enabled));
}

async function runUpdateOperation(
    activity: "checking" | "installing",
    operation: () => Promise<FrontendUpdateStatus>,
) {
    if (activeUpdateOperation) return activeUpdateOperation;

    frontendUpdateActivity.set(activity);
    activeUpdateOperation = operation().then((status) => {
        frontendUpdateStatus.set(status);
        return status;
    }).finally(() => {
        frontendUpdateActivity.set(null);
        activeUpdateOperation = null;
    });

    return activeUpdateOperation;
}

function preparedStatus(update: SoftwareUpdate): FrontendUpdateStatus {
    return {
        state: "installed",
        version: update.version,
        message: `La version ${update.version} est prête. Redémarrez PSoft pour l’appliquer.`,
    };
}

export function checkFrontendUpdate(): Promise<FrontendUpdateStatus> {
    return runUpdateOperation("checking", async () => {
        if (!isInstalledTauriApp()) {
            return {
                state: "unavailable",
                message: "Les mises à jour automatiques sont disponibles uniquement dans l'application installée.",
            };
        }

        try {
            const update = await invoke<SoftwareUpdate | null>("psoftware_update_check");
            if (!update) {
                return { state: "idle", message: "PSoft est déjà à jour." };
            }
            return {
                state: "available",
                version: update.version,
                notes: update.notes,
                message: `La version ${update.version} est disponible.`,
            };
        } catch (error) {
            return {
                state: "error",
                message: error instanceof Error ? error.message : "Impossible de vérifier les mises à jour.",
            };
        }
    });
}

export function installFrontendUpdate(): Promise<FrontendUpdateStatus> {
    return runUpdateOperation("installing", async () => {
        if (!isInstalledTauriApp()) {
            return {
                state: "unavailable",
                message: "Les mises à jour automatiques sont disponibles uniquement dans l'application installée.",
            };
        }

        try {
            const update = await invoke<SoftwareUpdate | null>("psoftware_update_install");
            if (!update) return { state: "idle", message: "PSoft est déjà à jour." };

            const { relaunch } = await import("@tauri-apps/plugin-process");
            await relaunch();
            return { state: "relaunching", message: "Redémarrage de PSoft." };
        } catch (error) {
            return {
                state: "error",
                message: error instanceof Error ? error.message : "Impossible d'installer la mise à jour.",
            };
        }
    });
}

function prepareFrontendUpdate(): Promise<FrontendUpdateStatus> {
    return runUpdateOperation("installing", async () => {
        try {
            const update = await invoke<SoftwareUpdate | null>("psoftware_update_prepare");
            return update
                ? preparedStatus(update)
                : { state: "idle", message: "PSoft est déjà à jour." };
        } catch (error) {
            return {
                state: "error",
                message: error instanceof Error ? error.message : "Impossible de préparer la mise à jour.",
            };
        }
    });
}

export function runAutomaticFrontendUpdate(): Promise<FrontendUpdateStatus | null> {
    if (!isInstalledTauriApp()) return Promise.resolve(null);
    if (automaticUpdateOperation) return automaticUpdateOperation;

    automaticUpdateOperation = (async () => {
        const currentStatus = get(frontendUpdateStatus);
        if (currentStatus?.state === "installed") return currentStatus;

        try {
            const pending = await invoke<SoftwareUpdate | null>("psoftware_update_pending");
            if (pending) {
                const status = preparedStatus(pending);
                frontendUpdateStatus.set(status);
                return status;
            }
        } catch (error) {
            const status: FrontendUpdateStatus = {
                state: "error",
                message: error instanceof Error ? error.message : "Impossible de lire la mise à jour préparée.",
            };
            frontendUpdateStatus.set(status);
            return status;
        }

        if (!getAutoCheckUpdatesEnabled()) return null;
        const now = Date.now();
        if (activeUpdateOperation) return activeUpdateOperation;
        if (now - lastAutomaticCheckAt < AUTO_CHECK_DEDUPLICATION_MS) {
            return get(frontendUpdateStatus);
        }

        lastAutomaticCheckAt = now;
        return prepareFrontendUpdate();
    })().finally(() => {
        automaticUpdateOperation = null;
    });

    return automaticUpdateOperation;
}

export function applyPreparedFrontendUpdate(): Promise<FrontendUpdateStatus> {
    return runUpdateOperation("installing", async () => {
        if (!isInstalledTauriApp()) {
            return {
                state: "unavailable",
                message: "Le redémarrage automatique est disponible uniquement dans l'application installée.",
            };
        }

        try {
            const update = await invoke<SoftwareUpdate | null>("psoftware_update_apply");
            return update
                ? { state: "relaunching", message: "Redémarrage de PSoft." }
                : { state: "idle", message: "Aucune mise à jour n’est en attente." };
        } catch (error) {
            return {
                state: "error",
                message: error instanceof Error ? error.message : "Impossible d'appliquer la mise à jour.",
            };
        }
    });
}
