import { apiGet } from "$lib/api";
import { setAuthState, type AuthUser } from "$lib/auth";
import { PSOFTWARE_VERSION } from "$lib/appInfo";
import { getConfiguredApiBase, getServerConfig, setConfiguredServerIdentity } from "$lib/onboarding";
import { isPServerId } from "$lib/serverIdentity";
import { setSettingsSnapshot } from "$lib/settings";
import { writable } from "svelte/store";

export const FRONTEND_VERSION = PSOFTWARE_VERSION;

export type ServerVersion = {
    serverId: string;
    backendVersion: string;
    apiVersion: string;
    apiMinFrontend: string;
    apiMaxFrontend: string;
    schemaVersion: number;
    serverName: string;
    publicUrl: string;
};

export type WorkspaceSetup = {
    complete: boolean;
    company: boolean;
    clientForm: boolean;
    clientIdentifier: boolean;
    clientColumns: boolean;
    operationForm: boolean;
    operationIdentifier: boolean;
    operationColumns: boolean;
    operationStatuses: boolean;
};

export const workspaceSetup = writable<WorkspaceSetup | null>(null);

export type ClientBootstrap = {
    server: ServerVersion;
    authenticated: boolean;
    settingsVersion: number;
    branding: {
        companyName: string | null;
        logoHash: string | null;
    };
    settings?: unknown;
    publicSettings?: unknown;
    user?: AuthUser;
    setup?: WorkspaceSetup;
};

export type CompatibilityStatus = {
    reachable: boolean;
    compatible: boolean;
    reason: "ok" | "unreachable" | "frontend-too-old" | "backend-too-old" | "invalid-version";
    version?: ServerVersion;
    message: string;
};

type BootstrapOptions = {
    force?: boolean;
    timeoutMs?: number;
};

let bootstrapCache: ClientBootstrap | null = null;
let pendingBootstrap: Promise<ClientBootstrap> | null = null;
let compatibilityCache: CompatibilityStatus | null = null;

function versionParts(version: string): number[] | null {
    const parts = version.split(".");
    if (parts.length < 2) return null;

    const normalized = parts.slice(0, 3).map((part) => {
        if (part === "x") return Number.NaN;
        const value = Number(part);
        return Number.isInteger(value) && value >= 0 ? value : Number.NaN;
    });

    return normalized.some(Number.isNaN) ? null : normalized;
}

function compareVersions(left: string, right: string): number | null {
    const leftParts = versionParts(left);
    const rightParts = versionParts(right);
    if (!leftParts || !rightParts) return null;

    for (let index = 0; index < 3; index += 1) {
        const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
        if (diff !== 0) return diff > 0 ? 1 : -1;
    }

    return 0;
}

function satisfiesMax(version: string, max: string): boolean | null {
    if (max.endsWith(".x")) {
        const prefix = max.slice(0, -1);
        return version.startsWith(prefix);
    }

    const comparison = compareVersions(version, max);
    return comparison === null ? null : comparison <= 0;
}

function normalizeBootstrap(response: unknown): ClientBootstrap {
    if (!response || typeof response !== "object") {
        throw new Error("Invalid bootstrap response.");
    }

    const payload = response as Partial<ClientBootstrap>;
    if (!payload.server || typeof payload.server !== "object") {
        throw new Error("Invalid bootstrap response.");
    }
    if (!isPServerId((payload.server as Partial<ServerVersion>).serverId)) {
        throw new Error("Invalid PServer identity.");
    }

    const companyName = payload.branding?.companyName;
    const logoHash = payload.branding?.logoHash;
    return {
        ...payload,
        server: payload.server,
        authenticated: payload.authenticated === true,
        settingsVersion: Number.isInteger(payload.settingsVersion) ? payload.settingsVersion : 0,
        branding: {
            companyName: typeof companyName === "string" && companyName.trim()
                ? companyName.trim().slice(0, 120)
                : null,
            logoHash: logoHash === ""
                ? ""
                : typeof logoHash === "string" && /^[a-f0-9]{64}$/i.test(logoHash)
                    ? logoHash.toLowerCase()
                    : null,
        },
    } as ClientBootstrap;
}

function applyBootstrap(bootstrap: ClientBootstrap) {
    if (getServerConfig()) {
        setConfiguredServerIdentity(bootstrap.server);
    }
    bootstrapCache = bootstrap;
    workspaceSetup.set(bootstrap.setup ?? null);
    setAuthState(bootstrap.authenticated, bootstrap.user ?? null);

    const settings = bootstrap.settings ?? bootstrap.publicSettings;
    if (settings) {
        setSettingsSnapshot(settings);
    }
}

function compatibilityFromVersion(version: ServerVersion): CompatibilityStatus {
    const minComparison = compareVersions(FRONTEND_VERSION, version.apiMinFrontend);
    const maxSatisfied = satisfiesMax(FRONTEND_VERSION, version.apiMaxFrontend);

    if (minComparison === null || maxSatisfied === null) {
        return {
            reachable: true,
            compatible: false,
            reason: "invalid-version",
            version,
            message: "Le serveur annonce une plage de versions invalide.",
        };
    }

    if (minComparison < 0) {
        return {
            reachable: true,
            compatible: false,
            reason: "frontend-too-old",
            version,
            message: "Cette version de PSoft est trop ancienne pour ce serveur. Mettez l'application à jour.",
        };
    }

    if (!maxSatisfied) {
        return {
            reachable: true,
            compatible: false,
            reason: "backend-too-old",
            version,
            message: "Le serveur PSoft est trop ancien. Un administrateur doit mettre le serveur à jour.",
        };
    }

    return {
        reachable: true,
        compatible: true,
        reason: "ok",
        version,
        message: "Serveur compatible.",
    };
}

export async function bootstrapClient(options: BootstrapOptions = {}): Promise<ClientBootstrap> {
    if (!options.force && bootstrapCache) return bootstrapCache;
    if (!options.force && pendingBootstrap) return pendingBootstrap;

    pendingBootstrap = apiGet("/client/bootstrap/", false, {
        redirectOnFailure: false,
        syncSettingsVersion: false,
    })
        .then(normalizeBootstrap)
        .then((bootstrap) => {
            applyBootstrap(bootstrap);
            return bootstrap;
        })
        .finally(() => {
            pendingBootstrap = null;
        });

    return pendingBootstrap;
}

export async function checkServerCompatibility(options: BootstrapOptions = {}): Promise<CompatibilityStatus> {
    if (!options.force && compatibilityCache) return compatibilityCache;

    let status: CompatibilityStatus;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        const request = bootstrapClient(options);
        const bootstrap = options.timeoutMs
            ? await Promise.race([
                request,
                new Promise<never>((_, reject) => {
                    timeout = setTimeout(
                        () => reject(new Error("PServer startup timeout.")),
                        options.timeoutMs,
                    );
                }),
            ])
            : await request;
        status = compatibilityFromVersion(bootstrap.server);
    } catch {
        status = {
            reachable: false,
            compatible: false,
            reason: "unreachable",
            message: `Impossible de contacter le serveur configuré (${getConfiguredApiBase()}).`,
        };
    } finally {
        if (timeout) clearTimeout(timeout);
    }

    compatibilityCache = status;
    return status;
}

export function clearBootstrapCache() {
    bootstrapCache = null;
    compatibilityCache = null;
}

export function getCachedCompatibilityStatus() {
    return compatibilityCache;
}

export function getCachedBootstrap() {
    return bootstrapCache;
}

export function getServerDebugSnapshot() {
    const config = getServerConfig();

    return {
        frontendVersion: FRONTEND_VERSION,
        apiBaseUrl: getConfiguredApiBase(),
        serverName: config?.serverName ?? "Non configuré",
        installTarget: config?.installTarget ?? "Non configuré",
        databaseType: config?.database.type ?? "Non configuré",
        backendStatus: config?.backendStatus ?? "Non configuré",
    };
}
