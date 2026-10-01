import { browser } from "$app/environment";
import { isPServerId, type PServerIdentity } from "$lib/serverIdentity";

export const ONBOARDING_VERSION = 1;
export const MAX_POSTGRES_SSL_ROOT_CERTIFICATE_BYTES = 1024 * 1024;

const ONBOARDING_STATE_KEY = "psoftware:onboarding:v1";
const SERVER_CONFIG_KEY = "psoftware:server-config:v1";
const DEFAULT_API_BASE_URL = "https://localhost:8000/api/v1";

export type OnboardingMode = "admin" | "user";
export type InstallTarget = "local" | "dedicated-server" | "existing-server";
export type DatabaseType = "sqlite" | "postgres";

export type SqliteDatabaseConfig = {
    type: "sqlite";
    path: string;
};

export type PostgresDatabaseConfig = {
    type: "postgres";
    host: string;
    port: number;
    database: string;
    username: string;
    sslMode: "disable" | "require" | "verify-full";
    sslRootCertificate?: string;
};

export type DatabaseConfig = SqliteDatabaseConfig | PostgresDatabaseConfig;

export type ServerConfig = {
    version: typeof ONBOARDING_VERSION;
    serverId?: string;
    serverName: string;
    installTarget: InstallTarget;
    apiBaseUrl: string;
    bindAddress: string;
    discoveryEnabled: boolean;
    discoveryHostname: string;
    database: DatabaseConfig;
    backendStatus: "pending-install" | "external";
    savedAt: string;
};

export type OnboardingState = {
    version: typeof ONBOARDING_VERSION;
    mode: OnboardingMode;
    completedAt: string;
};

function getStoredJson<T>(key: string): T | null {
    if (!browser) return null;

    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) as T : null;
    } catch (error) {
        console.error(`Unable to read ${key} from local storage:`, error);
        return null;
    }
}

function setStoredJson<T>(key: string, value: T) {
    if (!browser) return;
    localStorage.setItem(key, JSON.stringify(value));
}

function removeStoredJson(key: string) {
    if (!browser) return;
    localStorage.removeItem(key);
}

export function normalizeApiBaseUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return DEFAULT_API_BASE_URL;

    if (trimmed.startsWith("/")) {
        return trimmed.replace(/\/+$/, "");
    }

    const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;

    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "https:") {
        throw new Error("PSoft requires an HTTPS API URL.");
    }

    const path = parsed.pathname.replace(/\/+$/, "");

    if (path.endsWith("/api/v1")) {
        parsed.pathname = path;
    } else if (path.endsWith("/api")) {
        parsed.pathname = `${path}/v1`;
    } else {
        parsed.pathname = `${path}/api/v1`;
    }

    parsed.search = "";
    parsed.hash = "";

    return parsed.toString().replace(/\/$/, "");
}

export function getOnboardingState(): OnboardingState | null {
    const state = getStoredJson<OnboardingState>(ONBOARDING_STATE_KEY);
    if (!state || state.version !== ONBOARDING_VERSION || !state.completedAt) return null;
    return state;
}

export function hasCompletedOnboarding(): boolean {
    return getOnboardingState() !== null;
}

export function getServerConfig(): ServerConfig | null {
    const config = getStoredJson<ServerConfig>(SERVER_CONFIG_KEY);
    if (!config || config.version !== ONBOARDING_VERSION) return null;
    return {
        ...config,
        serverId: isPServerId(config.serverId) ? config.serverId.toLowerCase() : undefined,
        bindAddress: config.bindAddress || "0.0.0.0",
        discoveryHostname: config.discoveryHostname || "",
    };
}

export function getConfiguredServerId() {
    return getServerConfig()?.serverId ?? null;
}

export function setConfiguredServerIdentity(identity: PServerIdentity) {
    const config = getServerConfig();
    if (!config || !isPServerId(identity.serverId)) {
        throw new Error("L’identité du PServer configuré est invalide.");
    }
    const serverId = identity.serverId.toLowerCase();
    if (config.serverId && config.serverId !== serverId) {
        throw new Error("L’identité du PServer configuré a changé. Une nouvelle association est requise.");
    }
    setStoredJson<ServerConfig>(SERVER_CONFIG_KEY, {
        ...config,
        serverId,
        serverName: identity.serverName.trim() || config.serverName,
    });
}

export function getConfiguredApiBase(): string {
    return getServerConfig()?.apiBaseUrl ?? DEFAULT_API_BASE_URL;
}

export function completeAdminOnboarding(config: Omit<ServerConfig, "version" | "savedAt">) {
    const savedAt = new Date().toISOString();

    setStoredJson<ServerConfig>(SERVER_CONFIG_KEY, {
        ...config,
        version: ONBOARDING_VERSION,
        savedAt,
    });

    setStoredJson<OnboardingState>(ONBOARDING_STATE_KEY, {
        version: ONBOARDING_VERSION,
        mode: "admin",
        completedAt: savedAt,
    });
}

export function completeUserOnboarding(apiBaseUrl?: string, identity?: PServerIdentity) {
    const savedAt = new Date().toISOString();
    const serverId = identity && isPServerId(identity.serverId)
        ? identity.serverId.toLowerCase()
        : undefined;

    if (apiBaseUrl?.trim()) {
        setStoredJson<ServerConfig>(SERVER_CONFIG_KEY, {
            version: ONBOARDING_VERSION,
            serverId,
            serverName: identity?.serverName.trim() || "Serveur fourni par l'administrateur",
            installTarget: "existing-server",
            apiBaseUrl: normalizeApiBaseUrl(apiBaseUrl),
            bindAddress: "",
            discoveryEnabled: false,
            discoveryHostname: "",
            database: {
                type: "sqlite",
                path: "Gérée par le serveur",
            },
            backendStatus: "external",
            savedAt,
        });
    } else {
        removeStoredJson(SERVER_CONFIG_KEY);
    }

    setStoredJson<OnboardingState>(ONBOARDING_STATE_KEY, {
        version: ONBOARDING_VERSION,
        mode: "user",
        completedAt: savedAt,
    });
}

export function resetOnboarding() {
    if (!browser) return;
    removeStoredJson(ONBOARDING_STATE_KEY);
    removeStoredJson(SERVER_CONFIG_KEY);
}
