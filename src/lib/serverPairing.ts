import { browser, dev } from "$app/environment";
import { invoke } from "@tauri-apps/api/core";
import { isPServerId, type PServerIdentity } from "$lib/serverIdentity";

export type PairingResult = PServerIdentity;

type HealthResponse = {
    ok?: boolean;
    serverId?: string;
    serverName?: string;
};

function isTauriRuntime() {
    return browser && "__TAURI_INTERNALS__" in window;
}

function canUseLocalDevelopmentProxy(apiBase: string) {
    if (!browser || !dev || isTauriRuntime()) return false;

    try {
        const url = new URL(apiBase);
        return url.protocol === "https:"
            && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
            && url.port === "8000"
            && url.pathname.replace(/\/+$/, "") === "/api/v1";
    } catch {
        return false;
    }
}

async function checkLocalDevelopmentServer(apiBase: string): Promise<PairingResult> {
    if (!browser || !dev) {
        throw new Error("L’association PServer est disponible dans l’application Windows.");
    }
    if (!canUseLocalDevelopmentProxy(apiBase)) {
        throw new Error(
            "Dans le navigateur de développement, utilisez le PServer local à l’adresse localhost:8000.",
        );
    }

    let response: Response;
    try {
        response = await fetch("/api/v1/system/health/", {
            cache: "no-store",
            credentials: "include",
        });
    } catch {
        throw new Error("Impossible de joindre le PServer local.");
    }

    if (!response.ok) {
        throw new Error(`PServer a refusé la connexion (HTTP ${response.status}).`);
    }

    const health = await response.json() as HealthResponse;
    const serverName = health.serverName?.trim();
    if (health.ok !== true || !isPServerId(health.serverId) || !serverName) {
        throw new Error("PServer n’a pas fourni une identité valide.");
    }

    return { serverId: health.serverId.toLowerCase(), serverName };
}

export function pairPServer(apiBase: string, code: string): Promise<PairingResult> {
    if (isTauriRuntime()) {
        return invoke<PairingResult>("pair_pserver", { apiBase, code });
    }
    return checkLocalDevelopmentServer(apiBase);
}

export function getPServerIdentity(apiBase: string): Promise<PairingResult> {
    if (isTauriRuntime()) {
        return invoke<PairingResult>("pserver_identity", { apiBase });
    }
    return checkLocalDevelopmentServer(apiBase);
}

export async function isPServerTrusted(apiBase: string): Promise<boolean> {
    if (isTauriRuntime()) {
        return invoke<boolean>("is_pserver_trusted", { apiBase });
    }
    await checkLocalDevelopmentServer(apiBase);
    return true;
}
